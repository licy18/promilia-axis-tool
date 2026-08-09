import { ACTION_TYPES } from './projectSchema';
import {
  compareActionSourceSequence,
  getActionSourceSequencePath,
} from './actionSourceSequence';
import {
  getInstalledVerifiedCombatMechanicsPackage,
  getVerifiedCombatActionMapping,
} from '../data/verifiedCombatMechanicsPackage';
import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization';

export const VERIFIED_BACKGROUND_ACTION_DERIVATION_SCHEMA_VERSION = 1;
export const VERIFIED_BACKGROUND_ACTION_DERIVATION_CONTRACT =
  'AzPrVerifiedBackgroundActionDerivation';
export const VERIFIED_KIBO_AUTO_CAST_DERIVATION_KIND = 'kibo-autonomous-cast';
export const VERIFIED_KIBO_AUTO_CAST_GENERATION_CONTRACT =
  'AzPrVerifiedKiboAutoCastGeneration';
export const VERIFIED_KIBO_AUTO_CAST_REGISTRY_CONTRACT =
  'AzPrVerifiedKiboAutoCastDerivationRegistry';
export const VERIFIED_KIBO_AUTO_CAST_SOURCE_SEQUENCE_SOURCE =
  'canonical-compiler-kibo-auto-cast-order';

const VERIFIED_AUTONOMOUS_KIBO_ACTION_KINDS = new Set([
  'normal-attack',
  'active',
]);
const authoritativeRegistries = new WeakSet();

export function createVerifiedKiboAutoCastDerivation({
  actionId,
  slotId,
  canonicalSlotId = null,
  ownerActorId = null,
  ownerCharacterId,
  kiboId,
  publicActionId,
  actionKind,
  scheduledFrame,
  sequenceIndex,
  sourceSequencePath = null,
  sourceSequenceSource = null,
  controlledIntervalIdentity = null,
  controlledIntervalStartFrame = null,
  controlledIntervalEndFrame = null,
  switchExitTailStatus = 'not-crossing-switch-boundary',
  switchBoundaryFrame = null,
  switchTransitionId = null,
  switchBoundarySourceSequencePath = null,
  switchExitTailPolicyHash = null,
  mappingIdentity = null,
  mechanicsPackageId = null,
  mechanicsPackageHash = null,
  catalogHash = null,
  trigger,
  triggerTag = null,
  evidenceStatus,
}) {
  const normalizedPath = normalizeSourceSequencePath(sourceSequencePath);
  const sourceIdentity = [
    'azpr-kibo-auto-cast-v2',
    mechanicsPackageId ?? 'package-unbound',
    mechanicsPackageHash ?? 'hash-unbound',
    catalogHash ?? 'catalog-unbound',
    mappingIdentity ?? 'mapping-unbound',
    kiboId,
    slotId,
    canonicalSlotId ?? slotId,
    ownerActorId ?? 'actor-unbound',
    ownerCharacterId,
    actionId,
    publicActionId,
    actionKind,
    scheduledFrame,
    sequenceIndex,
    normalizedPath?.join('.') ?? 'sequence-unbound',
    sourceSequenceSource ?? 'sequence-source-unbound',
    controlledIntervalIdentity ?? 'interval-unbound',
    switchExitTailStatus,
    switchBoundaryFrame ?? 'no-switch-boundary',
    normalizeSourceSequencePath(switchBoundarySourceSequencePath)?.join('.') ??
      'no-switch-sequence',
    switchExitTailPolicyHash ?? 'tail-policy-unbound',
    trigger ?? 'trigger-unbound',
    triggerTag ?? 'trigger-tag-unbound',
    evidenceStatus ?? 'evidence-unbound',
  ].join(':');
  const projection = {
    schemaVersion: VERIFIED_BACKGROUND_ACTION_DERIVATION_SCHEMA_VERSION,
    contractName: VERIFIED_BACKGROUND_ACTION_DERIVATION_CONTRACT,
    kind: VERIFIED_KIBO_AUTO_CAST_DERIVATION_KIND,
    source: 'azpr-kibo-auto-cast',
    sourceIdentity,
    actionId: String(actionId),
    ownerSlotId: String(slotId),
    canonicalOwnerSlotId: String(canonicalSlotId ?? slotId),
    ownerActorId: ownerActorId == null ? null : String(ownerActorId),
    ownerCharacterId: Number(ownerCharacterId),
    kiboId: Number(kiboId),
    publicActionId: Number(publicActionId),
    actionKind: String(actionKind),
    scheduledFrame: Number(scheduledFrame),
    sequenceIndex: Number(sequenceIndex),
    sourceSequencePath: normalizedPath,
    sourceSequenceSource:
      sourceSequenceSource == null ? null : String(sourceSequenceSource),
    controlledIntervalIdentity:
      controlledIntervalIdentity == null
        ? null
        : String(controlledIntervalIdentity),
    controlledIntervalStartFrame: finiteIntegerOrNull(
      controlledIntervalStartFrame
    ),
    controlledIntervalEndFrame: finiteIntegerOrNull(controlledIntervalEndFrame),
    switchExitTailStatus: String(switchExitTailStatus),
    switchBoundaryFrame: finiteIntegerOrNull(switchBoundaryFrame),
    switchTransitionId:
      switchTransitionId == null ? null : String(switchTransitionId),
    switchBoundarySourceSequencePath: normalizeSourceSequencePath(
      switchBoundarySourceSequencePath
    ),
    switchExitTailPolicyHash:
      switchExitTailPolicyHash == null
        ? null
        : String(switchExitTailPolicyHash),
    mappingIdentity: mappingIdentity == null ? null : String(mappingIdentity),
    mechanicsPackageId:
      mechanicsPackageId == null ? null : String(mechanicsPackageId),
    mechanicsPackageHash:
      mechanicsPackageHash == null ? null : String(mechanicsPackageHash),
    catalogHash: catalogHash == null ? null : String(catalogHash),
    trigger,
    triggerTag: triggerTag == null ? null : String(triggerTag),
    priority: 'active-before-normal',
    evidenceStatus,
  };
  return {
    ...projection,
    derivationHash: hashCanonicalValue(projection),
  };
}

/**
 * Compiler-only materialization step.  It checks the scheduler output against
 * the actual compiled project, installed mechanics package, verified mapping,
 * source sequence and controlled-actor timeline before granting runtime
 * background-action authority.
 */
export function materializeVerifiedKiboAutoCastDerivationRegistry({
  generation = null,
  generationAuthoritative = false,
  actions = [],
  actors = [],
  team = null,
  initialRuntimeState = null,
  time = null,
  horizonFrameOverride = null,
} = {}) {
  const declarations = (actions ?? []).filter(isDeclaredKiboAutoCast);
  if (declarations.length === 0 && generation == null) {
    return { valid: true, registry: null, issues: [] };
  }
  const issues = [];
  if (generationAuthoritative !== true) {
    issues.push(
      registryIssue(
        'verified-kibo-auto-cast-generation-not-authoritative',
        'compileOptions.kiboAutoCastGeneration',
        'Kibo auto-cast declarations require this compilation scheduler generation'
      )
    );
    return { valid: false, registry: null, issues };
  }

  const mechanicsPackage = getInstalledVerifiedCombatMechanicsPackage();
  if (
    generation.status === 'kibo-auto-cast-generation-invalid' ||
    (generation.issues ?? []).length > 0
  ) {
    issues.push(
      registryIssue(
        'verified-kibo-auto-cast-generation-invalid',
        'compileOptions.kiboAutoCastGeneration.issues',
        'Kibo auto-cast scheduler generation contains unresolved timeline issues',
        {
          generationIssueCount: generation.issues?.length ?? 0,
          generationIssues: (generation.issues ?? []).map(clonePlain),
          controlledTimeline: clonePlain(generation.controlledTimeline),
        }
      )
    );
  }
  if (
    !mechanicsPackage ||
    generation.mechanicsPackage?.packageId !== mechanicsPackage.packageId ||
    generation.mechanicsPackage?.packageHash !== mechanicsPackage.packageHash
  ) {
    issues.push(
      registryIssue(
        'verified-kibo-auto-cast-package-mismatch',
        'compileOptions.kiboAutoCastGeneration.mechanicsPackage',
        'Kibo auto-cast generation does not match the installed mechanics package'
      )
    );
  }

  const fps = positiveNumber(time?.fps, 60);
  const horizonFrame =
    horizonFrameOverride != null &&
    Number.isInteger(Number(horizonFrameOverride))
      ? Number(horizonFrameOverride)
      : Math.round((Math.max(0, Number(time?.durationMs) || 0) * fps) / 1000);
  const compiledTimeline = createCompiledControlledTimeline({
    actions,
    actors,
    team,
    initialRuntimeState,
    fps,
  });
  const expectedTimeline = projectGenerationTimelineForHorizon(
    generation.controlledTimeline,
    horizonFrame
  );
  if (
    compiledTimeline.initialActorId !== expectedTimeline.initialActorId ||
    hashCanonicalValue(compiledTimeline.transitions) !==
      hashCanonicalValue(expectedTimeline.transitions)
  ) {
    issues.push(
      registryIssue(
        'verified-kibo-auto-cast-controlled-timeline-mismatch',
        'scenario.actions',
        'Compiled switch timeline differs from the scheduler-controlled Kibo timeline',
        {
          compiledTimeline: {
            initialActorId: compiledTimeline.initialActorId,
            transitions: compiledTimeline.transitions,
          },
          expectedTimeline,
        }
      )
    );
  }

  const entriesByActionId = new Map(
    (generation.entries ?? []).map(entry => [String(entry.actionId), entry])
  );
  const declarationsById = new Map(
    declarations.map(action => [String(action.id), action])
  );
  for (const entry of generation.entries ?? []) {
    if (
      Number(entry.scheduledFrame) <= horizonFrame &&
      !declarationsById.has(String(entry.actionId))
    ) {
      issues.push(
        registryIssue(
          'verified-kibo-auto-cast-generated-action-missing',
          `scenario.actions.${entry.actionId}`,
          `Scheduled Kibo auto-cast ${entry.actionId} is missing from the compiled project`,
          { actionId: entry.actionId }
        )
      );
    }
  }

  const compiledEntries = [];
  for (const action of declarations) {
    const actionId = String(action.id ?? '');
    const entry = entriesByActionId.get(actionId);
    const rule = action.autoCastRule;
    if (!entry) {
      issues.push(
        registryIssue(
          'verified-kibo-auto-cast-registry-entry-missing',
          `scenario.actions.${actionId}.autoCastRule`,
          `No scheduler registry entry exists for ${actionId}`,
          { actionId }
        )
      );
      continue;
    }
    const actionKind = String(action.eventType ?? action.actionKind ?? '');
    if (!VERIFIED_AUTONOMOUS_KIBO_ACTION_KINDS.has(actionKind)) {
      issues.push(
        registryIssue(
          'verified-kibo-auto-cast-kind-not-autonomous',
          `scenario.actions.${actionId}.eventType`,
          `Kibo ${actionKind || 'unknown'} is not a scheduler-authorized autonomous action`,
          { actionId, actionKind }
        )
      );
    }
    const mapping = getVerifiedCombatActionMapping({
      type: ACTION_TYPES.KIBO_EVENT,
      actor: action.actor,
      kiboId: action.kiboId,
      skillId: action.skillId,
      actionKind,
      eventType: actionKind,
    });
    if (
      !mapping ||
      String(mapping.identity) !== String(entry.mappingIdentity)
    ) {
      issues.push(
        registryIssue(
          'verified-kibo-auto-cast-mapping-mismatch',
          `scenario.actions.${actionId}`,
          `Kibo auto-cast ${actionId} does not match its installed verified mapping`,
          { actionId }
        )
      );
    }
    const controlledActorId = resolveControlledActorBeforeAction({
      timeline: compiledTimeline,
      action,
      fps,
    });
    if (
      !controlledActorId ||
      String(action.actorId ?? '') !== String(controlledActorId) ||
      String(entry.ownerActorId ?? '') !== String(controlledActorId)
    ) {
      issues.push(
        registryIssue(
          'verified-kibo-auto-cast-owner-not-controlled',
          `scenario.actions.${actionId}.actorId`,
          `Kibo auto-cast ${actionId} is not owned by the controlled actor at its source sequence`,
          {
            actionId,
            actorId: action.actorId ?? null,
            controlledActorId: controlledActorId ?? null,
            compiledControlledTransitions: compiledTimeline.transitions,
          }
        )
      );
    }
    const canonicalSlot = (team?.slots ?? []).find(
      slot => String(slot.actorId ?? '') === String(action.actorId ?? '')
    );
    const switchTransitionIncluded = (actions ?? []).some(
      candidate =>
        String(candidate.id ?? '') === String(entry.switchTransitionId ?? '')
    );
    const scheduledFrame = Math.round(
      ((Number(action.startMs) || 0) * fps) / 1000
    );
    if (
      action.type !== ACTION_TYPES.KIBO_EVENT ||
      action.autoCast !== true ||
      String(actionId) !== String(entry.actionId) ||
      Number(action.kiboId) !== Number(entry.kiboId) ||
      Number(action.skillId) !== Number(entry.publicActionId) ||
      actionKind !== String(entry.actionKind) ||
      scheduledFrame !== Number(entry.scheduledFrame) ||
      String(canonicalSlot?.slotId ?? '') !==
        String(entry.canonicalOwnerSlotId ?? '') ||
      !pathsEqual(
        getActionSourceSequencePath(action),
        entry.sourceSequencePath
      ) ||
      String(action.sourceSequenceSource ?? '') !==
        String(entry.sourceSequenceSource ?? '') ||
      String(rule?.sourceIdentity ?? '') !==
        String(entry.sourceIdentity ?? '') ||
      String(rule?.derivationHash ?? '') !==
        String(entry.derivationHash ?? '') ||
      (switchTransitionIncluded &&
        (String(action.switchExitTailPolicy?.policyHash ?? '') !==
          String(entry.switchExitTailPolicyHash ?? '') ||
          String(action.switchExitTailPolicy?.status ?? '') !==
            String(entry.switchExitTailStatus ?? '')))
    ) {
      issues.push(
        registryIssue(
          'verified-kibo-auto-cast-action-identity-mismatch',
          `scenario.actions.${actionId}`,
          `Compiled Kibo auto-cast ${actionId} differs from scheduler authority`,
          { actionId }
        )
      );
    }
    compiledEntries.push(clonePlain(entry));
  }

  if (issues.length > 0) {
    return { valid: false, registry: null, issues };
  }
  const projection = {
    schemaVersion: 1,
    contractName: VERIFIED_KIBO_AUTO_CAST_REGISTRY_CONTRACT,
    sourceKind: 'azpr-compile-owned-kibo-auto-cast-derivation-registry',
    status: 'verified-kibo-auto-cast-derivation-registry-ready',
    evidenceClosed: generation.evidenceStatus === 'static-evidence-closed',
    sourceGenerationHash: generation.generationHash,
    schedulerInputHash: generation.schedulerInputHash,
    mechanicsPackage: clonePlain(generation.mechanicsPackage),
    catalog: clonePlain(generation.catalog),
    controlledTimeline: compiledTimeline.projection,
    entries: compiledEntries.sort(compareRegistryEntries),
    triggerExclusions: (generation.triggerExclusions ?? []).map(clonePlain),
    summary: {
      entryCount: compiledEntries.length,
      controlledTransitionCount: compiledTimeline.transitions.length,
      triggerExclusionCount: generation.triggerExclusions?.length ?? 0,
    },
  };
  const registry = deepFreeze({
    ...projection,
    registryHash: hashCanonicalValue(projection),
  });
  authoritativeRegistries.add(registry);
  return { valid: true, registry, issues: [] };
}

export function isAuthoritativeKiboAutoCastDerivationRegistry(value) {
  return (
    value != null &&
    authoritativeRegistries.has(value) &&
    value.contractName === VERIFIED_KIBO_AUTO_CAST_REGISTRY_CONTRACT &&
    value.registryHash ===
      hashCanonicalValue(projectKiboAutoCastRegistry(value))
  );
}

export function projectKiboAutoCastDerivationRegistry(value) {
  if (!value || typeof value !== 'object') return null;
  return clonePlain({
    schemaVersion: value.schemaVersion ?? null,
    contractName: value.contractName ?? null,
    sourceKind: value.sourceKind ?? null,
    status: value.status ?? null,
    evidenceClosed: value.evidenceClosed === true,
    sourceGenerationHash: value.sourceGenerationHash ?? null,
    schedulerInputHash: value.schedulerInputHash ?? null,
    mechanicsPackage: value.mechanicsPackage ?? null,
    catalog: value.catalog ?? null,
    controlledTimeline: value.controlledTimeline ?? null,
    entries: value.entries ?? [],
    triggerExclusions: value.triggerExclusions ?? [],
    summary: value.summary ?? null,
    registryHash: value.registryHash ?? null,
  });
}

export function validateVerifiedKiboAutoCastDerivation(action, scenario = {}) {
  const declared = isDeclaredKiboAutoCast(action);
  if (!declared) return { declared: false, valid: false, reasons: [] };
  const rule = action?.autoCastRule;
  const reasons = [];
  const structuralReasons = [];
  const rejectStructure = reason => {
    reasons.push(reason);
    structuralReasons.push(reason);
  };
  const fps = Number(scenario?.time?.fps) || 60;
  const scheduledFrame = Math.round((Number(action?.startMs) * fps) / 1000);
  const actor = (scenario?.actors ?? []).find(
    candidate => String(candidate.id) === String(action?.actorId)
  );
  const canonicalSlot = (scenario?.team?.slots ?? []).find(
    candidate => String(candidate.actorId) === String(action?.actorId)
  );
  const expectedRule = rule
    ? createVerifiedKiboAutoCastDerivation({
        actionId: rule.actionId,
        slotId: rule.ownerSlotId,
        canonicalSlotId: rule.canonicalOwnerSlotId,
        ownerActorId: rule.ownerActorId,
        ownerCharacterId: rule.ownerCharacterId,
        kiboId: rule.kiboId,
        publicActionId: rule.publicActionId,
        actionKind: rule.actionKind,
        scheduledFrame: rule.scheduledFrame,
        sequenceIndex: rule.sequenceIndex,
        sourceSequencePath: rule.sourceSequencePath,
        sourceSequenceSource: rule.sourceSequenceSource,
        controlledIntervalIdentity: rule.controlledIntervalIdentity,
        controlledIntervalStartFrame: rule.controlledIntervalStartFrame,
        controlledIntervalEndFrame: rule.controlledIntervalEndFrame,
        switchExitTailStatus: rule.switchExitTailStatus,
        switchBoundaryFrame: rule.switchBoundaryFrame,
        switchTransitionId: rule.switchTransitionId,
        switchBoundarySourceSequencePath: rule.switchBoundarySourceSequencePath,
        switchExitTailPolicyHash: rule.switchExitTailPolicyHash,
        mappingIdentity: rule.mappingIdentity,
        mechanicsPackageId: rule.mechanicsPackageId,
        mechanicsPackageHash: rule.mechanicsPackageHash,
        catalogHash: rule.catalogHash,
        trigger: rule.trigger,
        triggerTag: rule.triggerTag,
        evidenceStatus: rule.evidenceStatus,
      })
    : null;

  if (
    !rule ||
    rule.schemaVersion !==
      VERIFIED_BACKGROUND_ACTION_DERIVATION_SCHEMA_VERSION ||
    rule.contractName !== VERIFIED_BACKGROUND_ACTION_DERIVATION_CONTRACT ||
    rule.kind !== VERIFIED_KIBO_AUTO_CAST_DERIVATION_KIND
  ) {
    rejectStructure('derivation-contract-invalid');
  }
  if (
    rule?.source !== 'azpr-kibo-auto-cast' ||
    !rule?.sourceIdentity ||
    rule.sourceIdentity !== expectedRule?.sourceIdentity ||
    rule.derivationHash !== expectedRule?.derivationHash
  ) {
    rejectStructure('derivation-source-identity-invalid');
  }
  if (!VERIFIED_AUTONOMOUS_KIBO_ACTION_KINDS.has(String(rule?.actionKind))) {
    rejectStructure('autonomous-action-kind-not-authorized');
  }
  if (
    action?.type !== ACTION_TYPES.KIBO_EVENT ||
    action?.autoCast !== true ||
    String(action?.id) !== String(rule?.actionId) ||
    Number(action?.kiboId) !== Number(rule?.kiboId) ||
    Number(action?.skillId) !== Number(rule?.publicActionId) ||
    String(action?.eventType) !== String(rule?.actionKind) ||
    scheduledFrame !== Number(rule?.scheduledFrame) ||
    !pathsEqual(
      getActionSourceSequencePath(action),
      rule?.sourceSequencePath
    ) ||
    String(action?.sourceSequenceSource ?? '') !==
      String(rule?.sourceSequenceSource ?? '')
  ) {
    rejectStructure('derived-action-identity-mismatch');
  }
  if (
    !canonicalSlot ||
    String(canonicalSlot.slotId ?? '') !==
      String(rule?.canonicalOwnerSlotId ?? rule?.ownerSlotId ?? '') ||
    !Number.isInteger(Number(rule?.ownerCharacterId)) ||
    Number(actor?.characterId) !== Number(rule?.ownerCharacterId) ||
    Number(actor?.loadout?.kiboId) !== Number(rule?.kiboId) ||
    (rule?.ownerActorId != null &&
      String(actor?.id ?? '') !== String(rule.ownerActorId))
  ) {
    rejectStructure('equipped-kibo-owner-mismatch');
  }
  if (
    rule?.trigger !== 'unconditional' ||
    rule?.triggerTag !== '0' ||
    rule?.evidenceStatus !== 'static-evidence-closed'
  ) {
    reasons.push('autonomous-trigger-evidence-open');
  }
  if (rule?.switchExitTailStatus === 'kibo-switch-exit-tail-order-unresolved') {
    reasons.push('kibo-switch-exit-tail-order-unresolved');
  }
  if (
    action?.sourceSequenceSource !==
      VERIFIED_KIBO_AUTO_CAST_SOURCE_SEQUENCE_SOURCE ||
    rule?.sourceSequenceSource !==
      VERIFIED_KIBO_AUTO_CAST_SOURCE_SEQUENCE_SOURCE
  ) {
    rejectStructure('derived-source-sequence-unverified');
  }

  const registry = scenario?.kiboAutoCastDerivationRegistry;
  const registryAuthoritative =
    isAuthoritativeKiboAutoCastDerivationRegistry(registry);
  if (!registryAuthoritative) {
    reasons.push('authoritative-derivation-registry-missing');
  }
  const registryEntry = registryAuthoritative
    ? (registry.entries ?? []).find(
        entry => String(entry.actionId) === String(action?.id)
      )
    : null;
  const authoritativeRegistryMatch =
    registryAuthoritative &&
    registryEntry != null &&
    String(registryEntry.sourceIdentity ?? '') ===
      String(rule?.sourceIdentity ?? '') &&
    String(registryEntry.derivationHash ?? '') ===
      String(rule?.derivationHash ?? '') &&
    String(registryEntry.ownerActorId ?? '') ===
      String(action?.actorId ?? '') &&
    String(registryEntry.canonicalOwnerSlotId ?? '') ===
      String(canonicalSlot?.slotId ?? '') &&
    Number(registryEntry.scheduledFrame) === scheduledFrame &&
    pathsEqual(
      registryEntry.sourceSequencePath,
      getActionSourceSequencePath(action)
    ) &&
    String(registryEntry.sourceSequenceSource ?? '') ===
      String(action?.sourceSequenceSource ?? '');
  if (registryAuthoritative && !authoritativeRegistryMatch) {
    reasons.push('authoritative-derivation-registry-mismatch');
  }
  const evidenceClosed =
    !reasons.includes('autonomous-trigger-evidence-open') &&
    registryEntry?.evidenceStatus === 'static-evidence-closed';
  return {
    declared: true,
    valid:
      reasons.length === 0 &&
      authoritativeRegistryMatch === true &&
      evidenceClosed === true,
    structurallyValid: structuralReasons.length === 0,
    evidenceClosed,
    authoritativeRegistryMatch,
    registryHash: registryAuthoritative ? registry.registryHash : null,
    reasons: unique(reasons),
    sourceIdentity: rule?.sourceIdentity ?? null,
  };
}

function isDeclaredKiboAutoCast(action) {
  return action?.autoCast === true || action?.autoCastRule != null;
}

function createCompiledControlledTimeline({
  actions,
  actors,
  team,
  initialRuntimeState,
  fps,
}) {
  const actorsById = new Map(
    (actors ?? []).map(actor => [String(actor.id ?? ''), actor])
  );
  let controlledActorId = resolveInitialControlledActorId({
    actors,
    actorsById,
    team,
    initialRuntimeState,
  });
  const initialActorId = controlledActorId;
  const transitions = [];
  const acceptedSwitchFrames = new Set();
  const orderedActions = (actions ?? [])
    .map((action, sourceIndex) => ({ action, sourceIndex }))
    .sort(
      (left, right) =>
        Math.round(((Number(left.action.startMs) || 0) * fps) / 1000) -
          Math.round(((Number(right.action.startMs) || 0) * fps) / 1000) ||
        compareActionSourceSequence(
          left.action,
          right.action,
          left.sourceIndex,
          right.sourceIndex
        )
    );
  for (const { action } of orderedActions) {
    if (action.type !== ACTION_TYPES.SWITCH) continue;
    const frame = Math.round(((Number(action.startMs) || 0) * fps) / 1000);
    if (acceptedSwitchFrames.has(frame)) continue;
    acceptedSwitchFrames.add(frame);
    if (String(action.actorId ?? '') !== String(controlledActorId ?? '')) {
      continue;
    }
    const targetActorId = String(action.targetActorId ?? '');
    if (!actorsById.has(targetActorId) || targetActorId === controlledActorId) {
      continue;
    }
    const transition = {
      switchActionId: String(action.id),
      frame,
      sourceSequencePath: getActionSourceSequencePath(action),
      fromActorId: controlledActorId,
      toActorId: targetActorId,
    };
    transitions.push(transition);
    controlledActorId = targetActorId;
  }
  return {
    initialActorId,
    transitions,
    projection: {
      initialActorId,
      transitions,
      timelineHash: hashCanonicalValue({ initialActorId, transitions }),
    },
  };
}

function resolveControlledActorBeforeAction({ timeline, action, fps }) {
  const actionFrame = Math.round(((Number(action?.startMs) || 0) * fps) / 1000);
  const actionPath = getActionSourceSequencePath(action);
  let controlledActorId = timeline.initialActorId;
  for (const transition of timeline.transitions ?? []) {
    if (Number(transition.frame) < actionFrame) {
      controlledActorId = transition.toActorId;
      continue;
    }
    if (Number(transition.frame) > actionFrame) break;
    if (actionPath == null || transition.sourceSequencePath == null) {
      return null;
    }
    if (comparePaths(transition.sourceSequencePath, actionPath) < 0) {
      controlledActorId = transition.toActorId;
    }
  }
  return controlledActorId;
}

function resolveInitialControlledActorId({
  actors,
  actorsById,
  team,
  initialRuntimeState,
}) {
  const initial = initialRuntimeState?.controlledActor;
  if (initial?.actorId && actorsById.has(String(initial.actorId))) {
    return String(initial.actorId);
  }
  const byCharacter = (actors ?? []).find(
    actor => Number(actor.characterId) === Number(initial?.characterId)
  );
  if (byCharacter) return String(byCharacter.id);
  const firstTeamActorId = team?.slots?.[0]?.actorId;
  if (firstTeamActorId != null && actorsById.has(String(firstTeamActorId))) {
    return String(firstTeamActorId);
  }
  return actors?.[0]?.id == null ? null : String(actors[0].id);
}

function projectGenerationTimelineForHorizon(value, horizonFrame) {
  return {
    initialActorId: value?.initialActorId ?? null,
    transitions: (value?.transitions ?? [])
      .filter(transition => Number(transition.frame) <= horizonFrame)
      .map(clonePlain),
  };
}

function projectKiboAutoCastRegistry(value) {
  const projection = projectKiboAutoCastDerivationRegistry(value);
  if (projection != null) delete projection.registryHash;
  return projection;
}

function registryIssue(code, path, message, details = {}) {
  return { code, path, message, severity: 'error', ...details };
}

function compareRegistryEntries(left, right) {
  return (
    Number(left.scheduledFrame) - Number(right.scheduledFrame) ||
    comparePaths(left.sourceSequencePath, right.sourceSequencePath) ||
    String(left.actionId).localeCompare(String(right.actionId), 'en')
  );
}

function comparePaths(left, right) {
  const leftPath = normalizeSourceSequencePath(left) ?? [];
  const rightPath = normalizeSourceSequencePath(right) ?? [];
  const length = Math.min(leftPath.length, rightPath.length);
  for (let index = 0; index < length; index += 1) {
    if (leftPath[index] !== rightPath[index]) {
      return leftPath[index] - rightPath[index];
    }
  }
  return leftPath.length - rightPath.length;
}

function pathsEqual(left, right) {
  const leftPath = normalizeSourceSequencePath(left);
  const rightPath = normalizeSourceSequencePath(right);
  return (
    leftPath != null &&
    rightPath != null &&
    leftPath.length === rightPath.length &&
    leftPath.every((entry, index) => entry === rightPath[index])
  );
}

function normalizeSourceSequencePath(value) {
  if (!Array.isArray(value) || value.length === 0) return null;
  const normalized = value.map(Number);
  return normalized.every(entry => Number.isInteger(entry) && entry >= 0)
    ? normalized
    : null;
}

function finiteIntegerOrNull(value) {
  if (value == null) return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function unique(values) {
  return [...new Set(values)];
}

function clonePlain(value) {
  if (value == null) return value ?? null;
  return structuredClone(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
