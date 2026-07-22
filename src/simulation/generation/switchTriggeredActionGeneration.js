import { ACTION_TYPES, createSkillAction } from '../../domain/projectSchema';
import { frameToMs, msToFrame } from '../../domain/timebase';
import {
  getVerifiedCombatActionMappingByIdentity,
  getVerifiedSwitchTriggerProfile,
} from '../../data/verifiedCombatMechanicsPackage';

export const SWITCH_TRIGGER_GENERATION_CONTRACT_NAME =
  'AzPrSwitchTriggeredActionGeneration';
export const SWITCH_TRIGGER_BINDING_CONTRACT_NAME = 'AzPrSwitchTriggerBinding';
export const SWITCH_TRIGGERED_ACTION_KIND = 'switch-triggered-star-carry';

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
    for (const phaseOwner of phaseOwners) {
      const result = createPhaseBinding({
        switchAction,
        frameIndex,
        frameRate,
        beforeActor,
        targetActor,
        phaseOwner,
        skillsById,
        targetId,
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
  return {
    schemaVersion: 1,
    contractName: SWITCH_TRIGGER_GENERATION_CONTRACT_NAME,
    sourceKind: 'azpr-verified-switch-trigger-action-generation',
    status: bindings.some(binding => binding.resolutionStatus !== 'applied')
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
        binding => binding.resolutionStatus !== 'applied'
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
}

export function isSwitchTriggeredDerivedAction(action) {
  return (
    action?.derivedAction?.kind === SWITCH_TRIGGERED_ACTION_KIND ||
    action?.switchTriggerBinding?.contractName ===
      SWITCH_TRIGGER_BINDING_CONTRACT_NAME
  );
}

function createPhaseBinding({
  switchAction,
  frameIndex,
  frameRate,
  beforeActor,
  targetActor,
  phaseOwner,
  skillsById,
  targetId,
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
  const action = createSkillAction({
    id: createDerivedActionId(
      switchAction.id,
      phaseOwner.triggerPhase,
      owner.id
    ),
    actorId: owner.id,
    skill,
    targetId,
    startMs: frameToMs(startFrame, frameRate),
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
    binding,
    action: {
      ...action,
      durationFrames,
      name: skill.name ?? action.name,
      actionKind: 'star-carry',
      parentActionId: switchAction.id,
      switchTriggerBinding: binding,
      derivedAction: {
        schemaVersion: 1,
        kind: SWITCH_TRIGGERED_ACTION_KIND,
        parentActionId: switchAction.id,
        bindingId,
        readOnly: true,
      },
      readOnly: true,
    },
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
      mapping.actionTiming?.occupancy?.durationFrames
  );
  return Number.isInteger(duration) && duration > 0 ? duration : null;
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
    String(left.id).localeCompare(String(right.id))
  );
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
