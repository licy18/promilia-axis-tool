import { ACTION_TYPES, createSkillAction } from '../../domain/projectSchema';
import { frameToMs, msToFrame } from '../../domain/timebase';
import {
  attachDerivedActionSourceSequence,
  compareActionSourceSequence,
  getActionSourceSequencePath,
} from '../../domain/actionSourceSequence';
import {
  getInstalledVerifiedCombatMechanicsPackage,
  getVerifiedCombatActionMappingByIdentity,
  getVerifiedSwitchTriggerProfile,
} from '../../data/verifiedCombatMechanicsPackage';
import { hashCanonicalValue } from '../headless/canonicalSerialization';

export const SWITCH_TRIGGER_GENERATION_CONTRACT_NAME =
  'AzPrSwitchTriggeredActionGeneration';
export const SWITCH_TRIGGER_BINDING_CONTRACT_NAME = 'AzPrSwitchTriggerBinding';
export const SWITCH_TRIGGERED_ACTION_KIND = 'switch-triggered-star-carry';

const authoritativeSwitchTriggerGenerations = new WeakSet();

export function createSwitchTriggeredActionGeneration({
  actions = [],
  actors = [],
  team = null,
  initialRuntimeState = null,
  time = null,
  skillsById = new Map(),
  targetId = null,
} = {}) {
  const actorsById = new Map(actors.map(actor => [actor.id, actor]));
  const initialActor = resolveInitialActor({
    actors,
    actorsById,
    team,
    initialRuntimeState,
  });
  const frameRate = positiveNumber(time?.fps, 60);
  const switches = actions
    .filter(action => action.type === ACTION_TYPES.SWITCH)
    .sort(compareActions);
  const acceptedSwitchByFrame = new Map();
  const bindings = [];
  const derivedActions = [];
  const cooldownReadyAtByOwnerAction = new Map();
  let controlledActor = initialActor;

  for (const switchAction of switches) {
    const frameIndex = msToFrame(switchAction.startMs, frameRate);
    const acceptedSwitch = acceptedSwitchByFrame.get(frameIndex);
    if (acceptedSwitch) {
      bindings.push(
        createRejectedSwitchBinding({
          switchAction,
          frameIndex,
          reason: 'parent-switch-frame-conflict',
          blockingSwitchEventId: acceptedSwitch.id,
        })
      );
      continue;
    }
    acceptedSwitchByFrame.set(frameIndex, switchAction);

    const beforeActor = controlledActor;
    if (
      !beforeActor ||
      String(switchAction.actorId ?? '') !== String(beforeActor.id ?? '')
    ) {
      bindings.push(
        createRejectedSwitchBinding({
          switchAction,
          frameIndex,
          reason: 'parent-switch-source-not-controlled',
        })
      );
      continue;
    }
    const targetActor = actorsById.get(switchAction.targetActorId) ?? null;
    if (!targetActor) {
      bindings.push(
        createRejectedSwitchBinding({
          switchAction,
          frameIndex,
          reason: 'parent-switch-target-missing',
        })
      );
      continue;
    }
    if (targetActor === beforeActor) {
      bindings.push(
        createRejectedSwitchBinding({
          switchAction,
          frameIndex,
          reason: 'parent-switch-noop',
        })
      );
      continue;
    }

    const phaseOwners = [
      { triggerPhase: 'on-exit', owner: beforeActor },
      { triggerPhase: 'on-enter', owner: targetActor },
    ];
    for (const [phaseSequenceIndex, phaseOwner] of phaseOwners.entries()) {
      const result = createPhaseBinding({
        switchAction,
        frameIndex,
        frameRate,
        beforeActor,
        targetActor,
        phaseOwner,
        phaseSequenceIndex,
        skillsById,
        targetId,
        cooldownReadyAtByOwnerAction,
      });
      if (!result) continue;
      bindings.push(result.binding);
      if (result.action) derivedActions.push(result.action);
    }
    controlledActor = targetActor;
  }

  const bindingBySwitchEventId = groupBy(
    bindings,
    binding => binding.switchEventId
  );
  const mechanicsPackage = getInstalledVerifiedCombatMechanicsPackage();
  const projection = {
    schemaVersion: 1,
    contractName: SWITCH_TRIGGER_GENERATION_CONTRACT_NAME,
    sourceKind: 'azpr-verified-switch-trigger-action-generation',
    mechanicsPackage: mechanicsPackage
      ? {
          packageId: mechanicsPackage.packageId,
          packageHash: mechanicsPackage.packageHash,
        }
      : { packageId: null, packageHash: null },
    status: bindings.some(
      binding =>
        !['applied', 'suppressed-cooldown-active'].includes(
          binding.resolutionStatus
        )
    )
      ? 'switch-trigger-generation-ready-with-unresolved-bindings'
      : 'switch-trigger-generation-ready',
    bindings,
    bindingBySwitchEventId,
    actions: derivedActions.sort(compareActions),
    summary: {
      switchEventCount: switches.length,
      bindingCount: bindings.length,
      appliedBindingCount: bindings.filter(
        binding => binding.resolutionStatus === 'applied'
      ).length,
      unresolvedBindingCount: bindings.filter(
        binding =>
          !['applied', 'suppressed-cooldown-active'].includes(
            binding.resolutionStatus
          )
      ).length,
      cooldownSuppressedBindingCount: bindings.filter(
        binding => binding.resolutionStatus === 'suppressed-cooldown-active'
      ).length,
      derivedActionCount: derivedActions.length,
      onEnterDerivedActionCount: derivedActions.filter(
        action => action.switchTriggerBinding?.triggerPhase === 'on-enter'
      ).length,
      onExitDerivedActionCount: derivedActions.filter(
        action => action.switchTriggerBinding?.triggerPhase === 'on-exit'
      ).length,
    },
  };
  const generation = deepFreeze({
    ...projection,
    generationHash: hashCanonicalValue(projection),
  });
  authoritativeSwitchTriggerGenerations.add(generation);
  return generation;
}

export function isAuthoritativeSwitchTriggerGeneration(value) {
  if (
    !value ||
    !authoritativeSwitchTriggerGenerations.has(value) ||
    value.contractName !== SWITCH_TRIGGER_GENERATION_CONTRACT_NAME
  ) {
    return false;
  }
  const projection = { ...value };
  delete projection.generationHash;
  return value.generationHash === hashCanonicalValue(projection);
}

export function isSwitchTriggeredDerivedAction(action) {
  return (
    action?.derivedAction?.kind === SWITCH_TRIGGERED_ACTION_KIND ||
    action?.switchTriggerBinding?.contractName ===
      SWITCH_TRIGGER_BINDING_CONTRACT_NAME
  );
}

/**
 * Formal/runtime consumers must not treat the loose UI marker above as an
 * authority boundary.  A verified switch-derived action is one materialized
 * by this compilation's generation result and still bound to the exact parent
 * switch, owner and source-sequence path.
 */
export function validateSwitchTriggeredDerivedAction(action, scenario = {}) {
  if (!isSwitchTriggeredDerivedAction(action)) {
    return { declared: false, valid: false, reasons: [] };
  }
  const reasons = [];
  const generation = scenario?.switchTriggerGeneration;
  if (!isAuthoritativeSwitchTriggerGeneration(generation)) {
    reasons.push('compiled-generation-not-authoritative');
  }
  const generatedAction = (generation?.actions ?? []).find(
    candidate => String(candidate.id) === String(action?.id)
  );
  const bindingId = String(
    action?.derivedAction?.bindingId ??
      action?.switchTriggerBinding?.bindingId ??
      ''
  );
  const binding = (generation?.bindings ?? []).find(
    candidate => String(candidate.bindingId) === bindingId
  );
  const parentActionId = String(
    action?.derivedAction?.parentActionId ?? action?.parentActionId ?? ''
  );
  const parentAction = (scenario?.actions ?? []).find(
    candidate =>
      candidate?.type === ACTION_TYPES.SWITCH &&
      String(candidate.id) === parentActionId
  );
  const actionPath = getActionSourceSequencePath(action);
  const parentPath = getActionSourceSequencePath(parentAction);
  const localIndex = Number(action?.localSourceSequenceIndex);
  const expectedPath =
    parentPath && Number.isInteger(localIndex) && localIndex >= 0
      ? [...parentPath, localIndex]
      : null;

  if (!generatedAction) reasons.push('compiled-generation-action-missing');
  if (!binding) reasons.push('compiled-generation-binding-missing');
  if (!parentAction) reasons.push('parent-switch-action-missing');
  if (
    action?.derivedAction?.schemaVersion !== 1 ||
    action?.derivedAction?.kind !== SWITCH_TRIGGERED_ACTION_KIND ||
    action?.derivedAction?.readOnly !== true ||
    action?.readOnly !== true
  ) {
    reasons.push('derived-declaration-invalid');
  }
  if (
    binding?.contractName !== SWITCH_TRIGGER_BINDING_CONTRACT_NAME ||
    binding?.applied !== true ||
    binding?.resolutionStatus !== 'applied' ||
    binding?.materializationStatus !== 'materialized'
  ) {
    reasons.push('binding-not-materialized-applied');
  }
  if (
    binding &&
    (String(binding.switchEventId) !== parentActionId ||
      String(binding.sourceOwnerId) !== String(parentAction?.actorId ?? '') ||
      String(binding.starCarryOwnerId) !== String(action?.actorId) ||
      String(binding.bindingId) !== bindingId)
  ) {
    reasons.push('binding-owner-or-parent-mismatch');
  }
  if (
    generatedAction &&
    (String(generatedAction.actorId) !== String(action?.actorId) ||
      String(generatedAction.parentActionId) !== parentActionId ||
      String(generatedAction.skillId) !== String(action?.skillId) ||
      Number(generatedAction.startMs) !== Number(action?.startMs) ||
      String(generatedAction.switchTriggerBinding?.bindingId ?? '') !==
        bindingId)
  ) {
    reasons.push('generated-action-identity-mismatch');
  }
  if (
    !expectedPath ||
    !pathsEqual(actionPath, expectedPath) ||
    !pathsEqual(action?.parentSourceSequencePath, parentPath) ||
    action?.sourceSequenceSource !== 'switch-trigger-parent-local-order'
  ) {
    reasons.push('derived-source-sequence-mismatch');
  }
  return {
    declared: true,
    valid: reasons.length === 0,
    reasons,
    bindingId: bindingId || null,
    parentActionId: parentActionId || null,
  };
}

export function isVerifiedSwitchTriggeredDerivedAction(action, scenario = {}) {
  return validateSwitchTriggeredDerivedAction(action, scenario).valid === true;
}

function createPhaseBinding({
  switchAction,
  frameIndex,
  frameRate,
  beforeActor,
  targetActor,
  phaseOwner,
  phaseSequenceIndex,
  skillsById,
  targetId,
  cooldownReadyAtByOwnerAction,
}) {
  const owner = phaseOwner.owner;
  if (!owner) return null;
  const profile = getVerifiedSwitchTriggerProfile(
    owner.characterId,
    phaseOwner.triggerPhase
  );
  if (!profile) return null;

  const mapping = profile.starCarryActionIdentity
    ? getVerifiedCombatActionMappingByIdentity(profile.starCarryActionIdentity)
    : null;
  const skill = mapping
    ? (skillsById.get(Number(mapping.sourceSkillId)) ?? null)
    : null;
  const reasons = [...(profile.reasons ?? [])];
  if (profile.applied && !mapping) {
    reasons.push('verified-star-carry-action-mapping-not-installed');
  }
  if (mapping && !skill) {
    reasons.push('public-star-carry-skill-record-missing');
  }
  const applied = Boolean(profile.applied && mapping && skill);
  const bindingId = createBindingId(
    switchAction.id,
    phaseOwner.triggerPhase,
    owner.id
  );
  const binding = {
    schemaVersion: 1,
    contractName: SWITCH_TRIGGER_BINDING_CONTRACT_NAME,
    bindingId,
    switchEventId: switchAction.id,
    sourceSequenceIndex: switchAction.sourceSequenceIndex ?? null,
    sourceSequencePath: getActionSourceSequencePath(switchAction) ?? null,
    localSourceSequenceIndex: phaseSequenceIndex,
    triggerPhase: phaseOwner.triggerPhase,
    sourceOwnerId: beforeActor?.id ?? null,
    sourceOwnerCharacterId: beforeActor?.characterId ?? null,
    targetOwnerId: targetActor?.id ?? null,
    targetOwnerCharacterId: targetActor?.characterId ?? null,
    starCarryOwnerId: owner.id,
    starCarryOwnerCharacterId: owner.characterId,
    starCarryOwnerName: owner.name ?? null,
    starCarryActionIdentity: profile.starCarryActionIdentity,
    sourceSkillId: profile.sourceSkillId,
    controlSkillId: profile.controlSkillId,
    triggerFrame: frameIndex,
    triggerFrameOffset: profile.triggerFrameOffset ?? 0,
    conditions: [...(profile.conditions ?? [])],
    sourceIdentity: profile.sourceIdentity,
    sourceIdentities: [...(profile.sourceIdentities ?? [])],
    mechanicsClassification: profile.mechanicsClassification,
    mechanicsReasons: [...(profile.mechanicsReasons ?? [])],
    resolutionStatus: applied
      ? 'applied'
      : (profile.resolutionStatus ?? 'static-evidence-gap'),
    reasons,
    applied,
  };
  if (!applied) return { binding, action: null };

  const durationFrames = resolveMappingDurationFrames(mapping);
  const startFrame = Math.max(
    0,
    frameIndex + Number(profile.triggerFrameOffset ?? 0)
  );
  const startMs = frameToMs(startFrame, frameRate);
  const cooldown = resolveVerifiedMappingCooldown(mapping);
  const cooldownKey = `${owner.id}|${profile.starCarryActionIdentity}`;
  const cooldownReadyAtMs = Number(
    cooldownReadyAtByOwnerAction.get(cooldownKey) ?? 0
  );
  const cooldownGate = resolveSwitchTriggeredCooldownGate({
    ownerId: owner.id,
    actionIdentity: profile.starCarryActionIdentity,
    startMs,
    cooldownDurationMs: cooldown?.durationMs,
    cooldownSourceIdentity: cooldown?.sourceIdentity,
    readyAtMs: cooldownReadyAtMs,
  });
  if (cooldownGate.status === 'suppressed-cooldown-active') {
    return {
      binding: {
        ...binding,
        resolutionStatus: 'suppressed-cooldown-active',
        materializationStatus: 'not-materialized',
        cooldownDurationMs: cooldownGate.cooldownDurationMs,
        cooldownReadyAtMs: cooldownGate.cooldownReadyAtMs,
        cooldownRemainingMs: cooldownGate.cooldownRemainingMs,
        cooldownSourceIdentity: cooldownGate.cooldownSourceIdentity,
        reasons: [...reasons, 'verified-star-carry-cooldown-active'],
        applied: false,
      },
      action: null,
    };
  }
  if (cooldownGate.status === 'materialized-with-cooldown') {
    cooldownReadyAtByOwnerAction.set(cooldownKey, cooldownGate.nextReadyAtMs);
  }
  const materializedBinding = {
    ...binding,
    materializationStatus: 'materialized',
    cooldownDurationMs: cooldownGate.cooldownDurationMs,
    cooldownReadyAtMs: cooldownGate.nextReadyAtMs,
    cooldownRemainingMs: 0,
    cooldownSourceIdentity: cooldownGate.cooldownSourceIdentity,
  };
  const action = createSkillAction({
    id: createDerivedActionId(
      switchAction.id,
      phaseOwner.triggerPhase,
      owner.id
    ),
    actorId: owner.id,
    skill,
    targetId,
    startMs,
    durationFrames,
    durationMs: frameToMs(durationFrames, frameRate),
    timingSource:
      mapping.actionTiming?.occupancy?.sourceKind ??
      'verified-switch-trigger-action-timing',
    timingStatus: mapping.actionTiming?.status ?? 'unresolved',
    timingReasons: mapping.actionTiming?.reasons ?? [],
    timingSourceIdentity:
      mapping.actionTiming?.occupancy?.sourceIdentity ??
      mapping.bindingSourceIdentity,
    needsTimingData: mapping.actionTiming?.status !== 'applied',
    controlSubSkillIndex: mapping.selectedSubSkillIndex,
    actionScheduling: mapping.actionScheduling,
    sourceEvidenceStatus: mapping.sourceEvidenceStatus,
    scenarioRuntimeStatus: mapping.scenarioRuntimeStatus,
    note: `${phaseOwner.triggerPhase === 'on-enter' ? '入场' : '退场'}切人事件自动触发`,
  });
  return {
    binding: materializedBinding,
    action: attachDerivedActionSourceSequence(
      {
        ...action,
        durationFrames,
        name: skill.name ?? action.name,
        actionKind: 'star-carry',
        parentActionId: switchAction.id,
        hitOverrides: switchAction.hitOverrides ?? null,
        switchTriggerBinding: materializedBinding,
        derivedAction: {
          schemaVersion: 1,
          kind: SWITCH_TRIGGERED_ACTION_KIND,
          parentActionId: switchAction.id,
          bindingId,
          readOnly: true,
        },
        readOnly: true,
      },
      switchAction,
      phaseSequenceIndex,
      'switch-trigger-parent-local-order'
    ),
  };
}

function createRejectedSwitchBinding({
  switchAction,
  frameIndex,
  reason,
  blockingSwitchEventId = null,
}) {
  return {
    schemaVersion: 1,
    contractName: SWITCH_TRIGGER_BINDING_CONTRACT_NAME,
    bindingId: `${switchAction.id}|switch-trigger-rejected`,
    switchEventId: switchAction.id,
    triggerPhase: null,
    sourceOwnerId: null,
    sourceOwnerCharacterId: null,
    targetOwnerId: switchAction.targetActorId ?? null,
    targetOwnerCharacterId: switchAction.targetCharacterId ?? null,
    starCarryOwnerId: null,
    starCarryOwnerCharacterId: null,
    starCarryOwnerName: null,
    starCarryActionIdentity: null,
    sourceSkillId: null,
    controlSkillId: null,
    triggerFrame: frameIndex,
    triggerFrameOffset: 0,
    conditions: [],
    sourceIdentity: 'azpr-exact-frame-switch-event-contract',
    sourceIdentities: ['azpr-exact-frame-switch-event-contract'],
    resolutionStatus: 'parent-switch-rejected',
    reasons: [reason],
    blockingSwitchEventId,
    applied: false,
  };
}

function resolveMappingDurationFrames(mapping) {
  const duration = Number(
    mapping.actionScheduling?.durationFrames ??
      mapping.actionScheduling?.planningDurationFrames ??
      mapping.actionTiming?.occupancy?.durationFrames
  );
  return Number.isInteger(duration) && duration > 0 ? duration : null;
}

function resolveVerifiedMappingCooldown(mapping) {
  const cooldown = mapping?.actionTiming?.cooldown;
  const durationMs = Number(cooldown?.cooldownMs);
  if (cooldown?.status !== 'applied' || !(durationMs > 0)) return null;
  return {
    durationMs,
    sourceIdentity: cooldown.sourceIdentity ?? null,
  };
}

export function resolveSwitchTriggeredCooldownGate({
  ownerId = null,
  actionIdentity = null,
  startMs = 0,
  cooldownDurationMs = null,
  cooldownSourceIdentity = null,
  readyAtMs = 0,
} = {}) {
  const durationMs = Number(cooldownDurationMs);
  const normalizedStartMs = Number(startMs) || 0;
  const normalizedReadyAtMs = Number(readyAtMs) || 0;
  const base = {
    ownerId,
    actionIdentity,
    cooldownDurationMs: durationMs > 0 ? durationMs : null,
    cooldownSourceIdentity,
    cooldownReadyAtMs: durationMs > 0 ? normalizedReadyAtMs : null,
    cooldownRemainingMs: 0,
    nextReadyAtMs: durationMs > 0 ? normalizedStartMs + durationMs : null,
  };
  if (!(durationMs > 0)) {
    return { ...base, status: 'materialized-without-verified-cooldown' };
  }
  if (normalizedStartMs < normalizedReadyAtMs) {
    return {
      ...base,
      status: 'suppressed-cooldown-active',
      cooldownRemainingMs: normalizedReadyAtMs - normalizedStartMs,
      nextReadyAtMs: normalizedReadyAtMs,
    };
  }
  return { ...base, status: 'materialized-with-cooldown' };
}

function resolveInitialActor({
  actors,
  actorsById,
  team,
  initialRuntimeState,
}) {
  const initial = initialRuntimeState?.controlledActor;
  if (initial?.actorId && actorsById.has(initial.actorId)) {
    return actorsById.get(initial.actorId);
  }
  const byCharacterId = actors.find(
    actor => Number(actor.characterId) === Number(initial?.characterId)
  );
  if (byCharacterId) return byCharacterId;
  const firstTeamActorId = team?.slots?.[0]?.actorId;
  return actorsById.get(firstTeamActorId) ?? actors[0] ?? null;
}

function createBindingId(switchEventId, phase, actorId) {
  return `${switchEventId}|${phase}|${actorId}|star-carry-binding`;
}

function createDerivedActionId(switchEventId, phase, actorId) {
  return `${switchEventId}--${phase}--${actorId}--star-carry`;
}

function groupBy(values, keyOf) {
  const groups = {};
  for (const value of values) {
    const key = keyOf(value);
    (groups[key] ??= []).push(value);
  }
  return groups;
}

function compareActions(left, right) {
  return (
    Number(left.startMs) - Number(right.startMs) ||
    compareActionSourceSequence(left, right)
  );
}

function pathsEqual(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((entry, index) => Number(entry) === Number(right[index]))
  );
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
