import { frameToMs, msToFrame, snapMsToFrame } from './timebase';
import { resolveVerifiedAttackInputChainEntry } from './verifiedActionContextScheduling';
import { resolveWorkbenchActionScheduling } from './workbenchActionScheduling';

export const ATTACK_INPUT_CHAIN_SOURCE = 'normal-attack-input-chain';
export const ATTACK_INPUT_LEGACY_UNRESOLVED = 'legacy-unresolved-duration';
export const ATTACK_INPUT_INTENT_CONTRACT_NAME =
  'AzPrWorkbenchAttackInputIntent';
export const ATTACK_INPUT_CHAIN_SELECTION_SOURCES = Object.freeze({
  RUNTIME_PROJECTED: 'runtime-projected',
  USER_EXPLICIT: 'user-explicit',
});

export function normalizeAttackInputSegments(segments = []) {
  const values = (Array.isArray(segments) ? segments : [])
    .map(segment => normalizeAttackInputSegment(segment))
    .filter(Boolean)
    .sort((left, right) => left.sequenceIndex - right.sequenceIndex);
  if (!values.length) return [];
  const total = values.length;
  const identities = new Set();
  const hitIdentities = new Set();
  for (const [index, segment] of values.entries()) {
    if (
      segment.sequenceIndex !== index + 1 ||
      segment.sequenceTotal !== total ||
      identities.has(segment.identity)
    ) {
      return [];
    }
    identities.add(segment.identity);
    for (const hitIdentity of segment.selectedHitIdentities) {
      if (hitIdentities.has(hitIdentity)) return [];
      hitIdentities.add(hitIdentity);
    }
  }
  return values;
}

export function normalizeAttackInputActionFields(source = {}) {
  const legacyStatus = normalizeText(source.attackInputLegacyStatus);
  const attackInputIntent = normalizeAttackInputIntent(
    source.attackInputIntent ?? source.attackInput?.intent
  );
  const attackInputChainSelectionSource = normalizeText(
    source.attackInputChainSelectionSource
  );
  const segment = normalizeAttackInputSegment({
    ...(source.attackInput ?? {}),
    sequenceIndex:
      source.attackSequenceIndex ?? source.attackInput?.sequenceIndex,
    sequenceTotal:
      source.attackSequenceTotal ?? source.attackInput?.sequenceTotal,
  });
  if (!segment) {
    return {
      ...(attackInputIntent ? { attackInputIntent } : {}),
      ...(attackInputChainSelectionSource
        ? { attackInputChainSelectionSource }
        : {}),
      ...(legacyStatus ? { attackInputLegacyStatus: legacyStatus } : {}),
    };
  }
  return {
    attackGroupId:
      normalizeText(source.attackGroupId) ??
      `attack-group-${normalizeText(source.id) ?? 'unresolved'}`,
    attackSequenceIndex: segment.sequenceIndex,
    attackSequenceTotal: segment.sequenceTotal,
    attackInputChainIdentity: segment.attackInputChainIdentity,
    ...(attackInputIntent ? { attackInputIntent } : {}),
    ...(attackInputChainSelectionSource
      ? { attackInputChainSelectionSource }
      : {}),
    attackInput: segment,
    ...(legacyStatus ? { attackInputLegacyStatus: legacyStatus } : {}),
  };
}

export function createWorkbenchAttackInputChainDrafts({
  entry,
  actorCharacterId,
  skillId,
  level = 1,
  startMs = 0,
  attackGroupId,
  createActionId,
  baseDraft = null,
  createdAt = null,
} = {}) {
  const segments = normalizeAttackInputSegments(entry?.attackInputSegments);
  if (!segments.length || typeof createActionId !== 'function') {
    return [];
  }
  const actionIds = segments.map((segment, index) =>
    createActionId(segment, index)
  );
  const groupId =
    normalizeText(attackGroupId) ?? `attack-group-${actionIds[0]}`;
  const attackInputIntent =
    normalizeAttackInputIntent(baseDraft?.attackInputIntent) ??
    createPublicNormalAttackIntent(entry);
  const attackInputChainSelectionSource =
    normalizeText(baseDraft?.attackInputChainSelectionSource) ??
    ATTACK_INPUT_CHAIN_SELECTION_SOURCES.RUNTIME_PROJECTED;
  let cursorFrame = Math.max(0, msToFrame(Number(startMs) || 0));
  return segments.map((segment, index) => {
    const actionId = actionIds[index];
    const scheduling = resolveWorkbenchActionScheduling({
      timingStatus: segment.durationStatus,
      durationFrames: segment.durationFrames,
      actionScheduling: segment.actionScheduling,
    });
    const durationMs = scheduling.durationMs;
    const linkDelayFrames = segment.defaultLinkDelayFrames;
    const layoutDurationFrames =
      positiveIntegerOrNull(segment.effectiveDurationFrames) ??
      positiveIntegerOrNull(segment.durationFrames) ??
      positiveIntegerOrNull(scheduling.durationFrames) ??
      positiveIntegerOrNull(scheduling.planningDurationFrames) ??
      1;
    const timingReady = scheduling.status === 'verified';
    const timingReasons = normalizeTextArray([
      ...(segment.linkTimingReasons ?? []),
      ...(segment.reasons ?? []),
      ...(timingReady ? [] : ['planning-duration-not-authoritative']),
    ]);
    const action = {
      ...(baseDraft ?? {}),
      id: actionId,
      type: 'skill',
      skillId: Number(skillId ?? entry?.skillId) || null,
      actorCharacterId: Number(actorCharacterId) || null,
      level: Math.max(1, Number(level) || 1),
      actionVariantIndex: Math.max(0, Number(entry?.actionVariantIndex) || 0),
      damageSegmentIndex: Math.max(0, Number(entry?.actionVariantIndex) || 0),
      startMs: frameToMs(cursorFrame),
      durationMs,
      durationFrames: scheduling.durationFrames,
      timingSource: timingReady ? segment.durationBasis : scheduling.kind,
      timingStatus: timingReady ? 'applied' : 'unresolved',
      timingReasons,
      timingSourceIdentity: segment.durationSourceIdentity,
      needsTimingData: !timingReady,
      controlSubSkillIndex:
        scheduling.selectedSubSkillIndex ?? segment.selectedSubSkillIndex,
      actionScheduling: segment.actionScheduling,
      sourceEvidenceStatus: segment.sourceEvidenceStatus,
      scenarioRuntimeStatus: segment.scenarioRuntimeStatus,
      note: timingReady
        ? `${segment.semanticName ?? `普通攻击 ${segment.label}`} · control ${segment.controlSkillId} · ${segment.hitCount} 个命中绑定`
        : `${segment.semanticName ?? `普通攻击 ${segment.label}`} · control ${segment.controlSkillId} · ${formatPlanningDuration(scheduling)}；来源证据与场景结算分开追踪`,
      generationBatch: {
        batchId: groupId,
        source: ATTACK_INPUT_CHAIN_SOURCE,
        skillId: Number(skillId ?? entry?.skillId) || null,
        actorCharacterId: Number(actorCharacterId) || null,
        level: Math.max(1, Number(level) || 1),
        variantCount: segments.length,
        segmentCount: segments.length,
        createdAt,
      },
      attackGroupId: groupId,
      attackSequenceIndex: segment.sequenceIndex,
      attackSequenceTotal: segment.sequenceTotal,
      attackInputChainIdentity: segment.attackInputChainIdentity,
      attackInputIntent,
      attackInputChainSelectionSource,
      attackInput: segment,
    };
    cursorFrame += layoutDurationFrames + (linkDelayFrames ?? 0);
    return action;
  });
}

export function reconcileWorkbenchAttackInputIntentGroups({
  actions = [],
  graph = null,
  variantRuntime = null,
  effectIntervals = [],
  resolveMapping,
  resolveActorId,
} = {}) {
  if (
    !graph?.attackInputChains ||
    typeof resolveMapping !== 'function' ||
    typeof resolveActorId !== 'function'
  ) {
    return { actions, changed: false, reconciledGroupIds: [] };
  }
  const groups = collectRuntimeAttackInputIntentGroups(actions);
  if (!groups.length) {
    return { actions, changed: false, reconciledGroupIds: [] };
  }
  const usedActionIds = new Set(actions.map(action => String(action.id)));
  const replacements = new Map();
  for (const group of groups) {
    const first = group[0];
    const mapping = resolveMapping(first);
    if (mapping?.actionKind !== 'normal-attack') continue;
    const actorId = resolveActorId(first);
    const result = resolveVerifiedAttackInputChainEntry({
      entry: {
        ...mapping,
        skillId:
          first.attackInputIntent?.sourceSkillId ??
          mapping.sourceSkillId ??
          first.skillId,
      },
      graph,
      ownerId: first.actorCharacterId ?? mapping.ownerId,
      actorId,
      timeMs: first.startMs,
      effectIntervals,
      variantRuntime,
      actions,
      runtimeSelections: variantRuntime?.selections ?? [],
      excludedActionIds: group.map(action => action.id),
    });
    if (result.status !== 'selected') continue;
    const targetSegments = normalizeAttackInputSegments(
      result.entry.attackInputSegments
    );
    if (
      !targetSegments.length ||
      isAttackInputGroupResolved(group, targetSegments)
    ) {
      continue;
    }
    const packed = isAttackInputGroupDefaultPacked(group);
    const existingBySequenceIndex = new Map(
      group.map(action => [Number(action.attackSequenceIndex), action])
    );
    const generatedDrafts = createWorkbenchAttackInputChainDrafts({
      entry: result.entry,
      actorCharacterId: first.actorCharacterId ?? mapping.ownerId,
      skillId: first.skillId ?? mapping.sourceSkillId,
      level: first.level,
      startMs: first.startMs,
      attackGroupId: first.attackGroupId,
      baseDraft: {
        ...first,
        attackInputIntent: first.attackInputIntent,
        attackInputChainSelectionSource:
          ATTACK_INPUT_CHAIN_SELECTION_SOURCES.RUNTIME_PROJECTED,
      },
      createActionId: (_, index) => {
        const existing = existingBySequenceIndex.get(index + 1);
        if (existing) return existing.id;
        return createDerivedAttackInputActionId({
          firstActionId: first.id,
          sequenceIndex: index + 1,
          usedActionIds,
        });
      },
      createdAt: first.generationBatch?.createdAt ?? null,
    });
    const drafts = [];
    for (const [index, draft] of generatedDrafts.entries()) {
      const existing = existingBySequenceIndex.get(index + 1);
      let next = existing
        ? {
            ...existing,
            ...draft,
            id: existing.id,
            startMs: packed ? draft.startMs : existing.startMs,
          }
        : draft;
      if (!packed && !existing && index > 0) {
        const previous = drafts[index - 1];
        next = {
          ...next,
          startMs: frameToMs(
            msToFrame(previous.startMs) +
              resolveAttackInputLayoutDurationFrames(previous)
          ),
        };
      }
      drafts.push(next);
    }
    replacements.set(String(first.attackGroupId), drafts);
  }
  if (!replacements.size) {
    return { actions, changed: false, reconciledGroupIds: [] };
  }

  const emittedGroups = new Set();
  const nextActions = [];
  for (const action of actions) {
    const groupId = String(action.attackGroupId ?? '');
    const replacement = replacements.get(groupId);
    if (!replacement) {
      nextActions.push(action);
      continue;
    }
    if (!emittedGroups.has(groupId)) {
      nextActions.push(...replacement);
      emittedGroups.add(groupId);
    }
  }
  return {
    actions: nextActions,
    changed: !sameValue(actions, nextActions),
    reconciledGroupIds: [...replacements.keys()],
  };
}

export function migrateLegacyAttackInputActionDrafts(
  actions = [],
  { resolveMapping, createActionId } = {}
) {
  if (typeof resolveMapping !== 'function') {
    return {
      actions,
      changed: false,
      unresolvedActionIds: [],
    };
  }
  let intentMigrationChanged = false;
  const intentMigratedActions = actions.map(action => {
    if (
      action?.generationBatch?.source !== ATTACK_INPUT_CHAIN_SOURCE ||
      !action.attackInput ||
      normalizeAttackInputIntent(action.attackInputIntent)
    ) {
      return action;
    }
    const mapping = resolveMapping(action);
    const attackInputIntent = createPublicNormalAttackIntent(mapping);
    if (!attackInputIntent) return action;
    intentMigrationChanged = true;
    return {
      ...action,
      attackInputIntent,
      attackInputChainSelectionSource:
        ATTACK_INPUT_CHAIN_SELECTION_SOURCES.RUNTIME_PROJECTED,
    };
  });
  const refreshed = refreshAttackInputActionDrafts(
    intentMigratedActions,
    resolveMapping
  );
  const usedIds = new Set(
    refreshed.actions.map(action => String(action.id ?? ''))
  );
  const unresolvedActionIds = [];
  let changed = intentMigrationChanged || refreshed.changed;
  const result = [];
  for (const action of refreshed.actions) {
    if (
      action?.type !== 'skill' ||
      action.attackInput ||
      action.attackInputLegacyStatus
    ) {
      result.push(action);
      continue;
    }
    const mapping = resolveMapping(action);
    if (mapping?.actionKind !== 'normal-attack') {
      result.push(action);
      continue;
    }
    const segments = normalizeAttackInputSegments(mapping.attackInputSegments);
    if (!segments.length) {
      result.push({
        ...action,
        attackInputLegacyStatus: ATTACK_INPUT_LEGACY_UNRESOLVED,
      });
      unresolvedActionIds.push(action.id);
      changed = true;
      continue;
    }
    const groupId = `legacy-attack-group-${action.id}`;
    const drafts = createWorkbenchAttackInputChainDrafts({
      entry: { ...mapping, attackInputSegments: segments },
      actorCharacterId: action.actorCharacterId,
      skillId: action.skillId,
      level: action.level,
      startMs: action.startMs,
      attackGroupId: groupId,
      baseDraft: {
        targetCharacterId: action.targetCharacterId,
        resource: action.resource,
        change: action.change,
        reason: action.reason,
        eventType: action.eventType,
      },
      createActionId: (_, index) => {
        if (index === 0) return action.id;
        const requested = `${action.id}-a${String(index + 1).padStart(2, '0')}`;
        if (!usedIds.has(requested)) {
          usedIds.add(requested);
          return requested;
        }
        return createActionId?.(usedIds) ?? `${requested}-${index + 1}`;
      },
      createdAt: action.generationBatch?.createdAt ?? null,
    });
    if (drafts.length !== segments.length) {
      result.push({
        ...action,
        attackInputLegacyStatus: ATTACK_INPUT_LEGACY_UNRESOLVED,
      });
      unresolvedActionIds.push(action.id);
      changed = true;
      continue;
    }
    result.push(...drafts);
    changed = true;
  }
  return { actions: result, changed, unresolvedActionIds };
}

function normalizeAttackInputSegment(segment) {
  const identity = normalizeText(segment?.identity);
  const controlSkillId = positiveIntegerOrNull(segment?.controlSkillId);
  const effectiveDurationFrames = positiveIntegerOrNull(
    segment?.effectiveDurationFrames
  );
  const durationFrames =
    effectiveDurationFrames ?? positiveIntegerOrNull(segment?.durationFrames);
  const sequenceIndex = Math.max(0, Number(segment?.sequenceIndex) || 0);
  const sequenceTotal = Math.max(0, Number(segment?.sequenceTotal) || 0);
  if (!identity || !controlSkillId || !sequenceIndex || !sequenceTotal) {
    return null;
  }
  return {
    identity,
    sequenceIndex,
    sequenceTotal,
    label: normalizeText(segment.label) ?? `A${sequenceIndex}`,
    semanticName: normalizeText(segment.semanticName),
    attackInputChainIdentity: normalizeText(segment.attackInputChainIdentity),
    controlSkillId,
    selectedSubSkillIndex: nonNegativeIntegerOrNull(
      segment.selectedSubSkillIndex
    ),
    playerSkillId: positiveIntegerOrNull(segment.playerSkillId),
    resourceMapIndex: nonNegativeIntegerOrNull(segment.resourceMapIndex),
    animationDurationFrames: positiveIntegerOrNull(
      segment.animationDurationFrames
    ),
    animationDurationStatus:
      normalizeText(segment.animationDurationStatus) ?? 'unresolved',
    hitEndFrame: nonNegativeIntegerOrNull(segment.hitEndFrame),
    effectiveDurationFrames,
    durationFrames,
    durationStatus: normalizeText(segment.durationStatus) ?? 'unresolved',
    durationBasis: normalizeText(segment.durationBasis),
    durationSourceIdentity: normalizeText(segment.durationSourceIdentity),
    actionScheduling: normalizeActionScheduling(segment.actionScheduling),
    sourceEvidenceStatus: normalizeText(segment.sourceEvidenceStatus),
    scenarioRuntimeStatus: normalizeText(segment.scenarioRuntimeStatus),
    defaultLinkDelayFrames: nonNegativeIntegerOrNull(
      segment.defaultLinkDelayFrames
    ),
    linkWindow: normalizeLinkWindow(segment.linkWindow),
    linkTimingStatus: normalizeText(segment.linkTimingStatus) ?? 'unresolved',
    linkTimingBasis: normalizeText(segment.linkTimingBasis),
    linkSourceIdentity: normalizeText(segment.linkSourceIdentity),
    linkTimingReasons: normalizeTextArray(segment.linkTimingReasons),
    selectedHitIdentities: normalizeTextArray(segment.selectedHitIdentities),
    hitCount: Math.max(0, Number(segment.hitCount) || 0),
    classification: normalizeText(segment.classification) ?? 'unresolved',
    reasons: normalizeTextArray(segment.reasons),
    sourceIdentity: normalizeText(segment.sourceIdentity),
  };
}

function createPublicNormalAttackIntent(entry) {
  const sourceSkillId = positiveIntegerOrNull(
    entry?.skillId ?? entry?.sourceSkillId
  );
  if (!sourceSkillId) return null;
  return {
    schemaVersion: 1,
    contractName: ATTACK_INPUT_INTENT_CONTRACT_NAME,
    kind: 'public-normal-attack',
    selectionMode: 'runtime-context',
    sourceSkillId,
    actionVariantIndex:
      nonNegativeIntegerOrNull(entry?.actionVariantIndex) ?? 0,
    sourceIdentity:
      normalizeText(entry?.bindingSourceIdentity ?? entry?.sourceIdentity) ??
      `workbench-public-normal-attack-input:${sourceSkillId}`,
  };
}

function normalizeAttackInputIntent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const kind = normalizeText(value.kind);
  const selectionMode = normalizeText(value.selectionMode);
  const sourceSkillId = positiveIntegerOrNull(value.sourceSkillId);
  if (!kind || !selectionMode || !sourceSkillId) return null;
  return {
    schemaVersion: 1,
    contractName: ATTACK_INPUT_INTENT_CONTRACT_NAME,
    kind,
    selectionMode,
    sourceSkillId,
    actionVariantIndex: nonNegativeIntegerOrNull(value.actionVariantIndex) ?? 0,
    sourceIdentity:
      normalizeText(value.sourceIdentity) ??
      `workbench-public-normal-attack-input:${sourceSkillId}`,
  };
}

function normalizeActionScheduling(value) {
  const scheduling = resolveWorkbenchActionScheduling({
    actionScheduling: value,
  });
  if (!value || typeof value !== 'object') return null;
  return {
    status: scheduling.status === 'verified' ? 'exact' : 'planning',
    kind: scheduling.kind,
    durationFrames:
      scheduling.status === 'verified' ? scheduling.durationFrames : null,
    planningDurationFrames:
      scheduling.status === 'planning'
        ? scheduling.planningDurationFrames
        : null,
    selectedSubSkillIndex: scheduling.selectedSubSkillIndex,
    sourceIdentity: scheduling.sourceIdentity,
    sourceStatus: normalizeText(value.sourceStatus),
    variantModelStatus: scheduling.variantModelStatus,
    reasons: normalizeTextArray(value.reasons),
  };
}

function formatPlanningDuration(scheduling) {
  if (scheduling.kind === 'source-animation-planning-duration') {
    return `来源动画规划 ${scheduling.planningDurationFrames}F`;
  }
  return `通用规划 ${scheduling.planningDurationFrames}F`;
}

function normalizeLinkWindow(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const startFrame = nonNegativeIntegerOrNull(value.startFrame);
  const endFrame = nonNegativeIntegerOrNull(value.endFrame);
  return startFrame == null && endFrame == null
    ? null
    : {
        ...value,
        kind: normalizeText(value.kind),
        targetControlSkillId: positiveIntegerOrNull(value.targetControlSkillId),
        targetSubSkillIndex: nonNegativeIntegerOrNull(
          value.targetSubSkillIndex
        ),
        startFrame,
        endFrame,
        durationFrames: nonNegativeIntegerOrNull(value.durationFrames),
        continuousAttackType: nonNegativeIntegerOrNull(
          value.continuousAttackType
        ),
        bridgeType: nonNegativeIntegerOrNull(value.bridgeType),
        sourceIdentity: normalizeText(value.sourceIdentity),
      };
}

function collectRuntimeAttackInputIntentGroups(actions) {
  const groups = new Map();
  for (const action of actions ?? []) {
    if (
      action?.attackInputIntent?.kind !== 'public-normal-attack' ||
      action.attackInputIntent.selectionMode !== 'runtime-context' ||
      action.attackInputChainSelectionSource ===
        ATTACK_INPUT_CHAIN_SELECTION_SOURCES.USER_EXPLICIT ||
      !action.attackGroupId
    ) {
      continue;
    }
    const groupId = String(action.attackGroupId);
    if (!groups.has(groupId)) groups.set(groupId, []);
    groups.get(groupId).push(action);
  }
  return [...groups.values()]
    .map(group =>
      [...group].sort(
        (left, right) =>
          Number(left.attackSequenceIndex) - Number(right.attackSequenceIndex)
      )
    )
    .filter(group => group.length > 0);
}

function isAttackInputGroupResolved(group, targetSegments) {
  if (group.length !== targetSegments.length) return false;
  return group.every((action, index) => {
    const target = targetSegments[index];
    return (
      Number(action.attackSequenceIndex) === target.sequenceIndex &&
      Number(action.attackSequenceTotal) === target.sequenceTotal &&
      String(
        action.attackInputChainIdentity ??
          action.attackInput?.attackInputChainIdentity
      ) === String(target.attackInputChainIdentity) &&
      Number(action.attackInput?.controlSkillId) === target.controlSkillId &&
      Number(action.attackInput?.selectedSubSkillIndex) ===
        target.selectedSubSkillIndex
    );
  });
}

function isAttackInputGroupDefaultPacked(group) {
  return group.every((action, index) => {
    if (index === 0) return true;
    const previous = group[index - 1];
    const expectedStartFrame =
      msToFrame(previous.startMs) +
      resolveAttackInputLayoutDurationFrames(previous) +
      (previous.attackInput?.defaultLinkDelayFrames ?? 0);
    return msToFrame(action.startMs) === expectedStartFrame;
  });
}

function resolveAttackInputLayoutDurationFrames(action) {
  return (
    positiveIntegerOrNull(action.attackInput?.effectiveDurationFrames) ??
    positiveIntegerOrNull(action.attackInput?.durationFrames) ??
    positiveIntegerOrNull(action.durationFrames) ??
    Math.max(1, msToFrame(action.durationMs))
  );
}

function createDerivedAttackInputActionId({
  firstActionId,
  sequenceIndex,
  usedActionIds,
}) {
  const base = `${firstActionId}-a${String(sequenceIndex).padStart(2, '0')}`;
  let candidate = base;
  let suffix = 2;
  while (usedActionIds.has(String(candidate))) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  usedActionIds.add(String(candidate));
  return candidate;
}

function refreshAttackInputActionDrafts(actions, resolveMapping) {
  const refreshes = new Map();
  for (const action of actions) {
    if (!action?.attackInput || action.attackInputLegacyStatus) continue;
    const mapping = resolveMapping(action);
    if (mapping?.actionKind !== 'normal-attack') continue;
    const actionChainIdentity = normalizeText(
      action.attackInputChainIdentity ??
        action.attackInput?.attackInputChainIdentity
    );
    const mappingChainIdentity = normalizeText(
      mapping.attackInputChainIdentity ??
        mapping.attackInputSegments?.[0]?.attackInputChainIdentity
    );
    if (
      actionChainIdentity &&
      mappingChainIdentity &&
      actionChainIdentity !== mappingChainIdentity
    ) {
      continue;
    }
    const segments = normalizeAttackInputSegments(mapping.attackInputSegments);
    const segment = segments.find(
      item =>
        item.sequenceIndex === Number(action.attackSequenceIndex) &&
        item.controlSkillId === Number(action.attackInput.controlSkillId)
    );
    if (!segment) continue;
    const previousScheduling = resolveWorkbenchActionScheduling({
      timingStatus: action.timingStatus ?? action.attackInput.durationStatus,
      durationFrames:
        action.durationFrames ??
        action.attackInput.effectiveDurationFrames ??
        action.attackInput.durationFrames,
      actionScheduling:
        action.actionScheduling ?? action.attackInput.actionScheduling,
    });
    const nextScheduling = resolveWorkbenchActionScheduling({
      timingStatus: segment.durationStatus,
      durationFrames: segment.durationFrames,
      actionScheduling: segment.actionScheduling,
    });
    const oldDefaultFrames =
      positiveIntegerOrNull(action.attackInput.effectiveDurationFrames) ??
      positiveIntegerOrNull(action.attackInput.durationFrames) ??
      msToFrame(previousScheduling.durationMs);
    const durationWasDefault =
      oldDefaultFrames > 0 &&
      Math.abs(msToFrame(action.durationMs) - oldDefaultFrames) <= 1;
    refreshes.set(action.id, {
      segment,
      scheduling: nextScheduling,
      durationWasDefault,
      oldDefaultFrames,
    });
  }
  const pristineGroups = findPristineAttackInputGroups(actions, refreshes);
  let changed = false;
  const refreshedActions = actions.map(action => {
    const refresh = refreshes.get(action.id);
    if (!refresh) return action;
    const timingReady = refresh.scheduling.status === 'verified';
    const next = {
      ...action,
      ...(refresh.durationWasDefault
        ? {
            durationMs: refresh.scheduling.durationMs,
            durationFrames: timingReady
              ? refresh.scheduling.durationFrames
              : null,
            timingSource: timingReady
              ? refresh.segment.durationBasis
              : refresh.scheduling.kind,
            timingStatus: timingReady ? 'applied' : 'unresolved',
            timingReasons: normalizeTextArray([
              ...(refresh.segment.linkTimingReasons ?? []),
              ...(refresh.segment.reasons ?? []),
              ...(timingReady ? [] : ['planning-duration-not-authoritative']),
            ]),
            timingSourceIdentity: refresh.segment.durationSourceIdentity,
            needsTimingData: !timingReady,
            controlSubSkillIndex:
              refresh.scheduling.selectedSubSkillIndex ??
              refresh.segment.selectedSubSkillIndex,
            actionScheduling: refresh.segment.actionScheduling,
            sourceEvidenceStatus: refresh.segment.sourceEvidenceStatus,
            scenarioRuntimeStatus: refresh.segment.scenarioRuntimeStatus,
          }
        : {}),
      attackSequenceIndex: refresh.segment.sequenceIndex,
      attackSequenceTotal: refresh.segment.sequenceTotal,
      attackInputChainIdentity: refresh.segment.attackInputChainIdentity,
      ...(action.generationBatch?.source === ATTACK_INPUT_CHAIN_SOURCE
        ? {
            attackInputIntent:
              normalizeAttackInputIntent(action.attackInputIntent) ??
              createPublicNormalAttackIntent(mapping),
            attackInputChainSelectionSource:
              normalizeText(action.attackInputChainSelectionSource) ??
              ATTACK_INPUT_CHAIN_SELECTION_SOURCES.RUNTIME_PROJECTED,
          }
        : {}),
      attackInput: refresh.segment,
    };
    if (!sameValue(action, next)) changed = true;
    return next;
  });
  for (const group of pristineGroups) {
    let cursorMs = group[0].startMs;
    for (const originalAction of group) {
      const actionIndex = refreshedActions.findIndex(
        action => action.id === originalAction.id
      );
      if (actionIndex < 0) continue;
      const action = refreshedActions[actionIndex];
      if (Math.abs(Number(action.startMs) - Number(cursorMs)) > 0.001) {
        refreshedActions[actionIndex] = { ...action, startMs: cursorMs };
        changed = true;
      }
      cursorMs = snapMsToFrame(
        cursorMs +
          refreshedActions[actionIndex].durationMs +
          frameToMs(
            refreshedActions[actionIndex].attackInput.defaultLinkDelayFrames ??
              0
          )
      );
    }
  }
  return { actions: refreshedActions, changed };
}

function findPristineAttackInputGroups(actions, refreshes) {
  const groups = new Map();
  for (const action of actions) {
    if (!action?.attackGroupId || !refreshes.has(action.id)) continue;
    if (!groups.has(action.attackGroupId)) groups.set(action.attackGroupId, []);
    groups.get(action.attackGroupId).push(action);
  }
  return [...groups.values()]
    .map(groupActions =>
      [...groupActions].sort(
        (left, right) =>
          Number(left.attackSequenceIndex) - Number(right.attackSequenceIndex)
      )
    )
    .filter(group => {
      const expectedTotal = Number(group[0]?.attackSequenceTotal) || 0;
      if (
        expectedTotal !== group.length ||
        group.some(
          (action, index) =>
            Number(action.attackSequenceIndex) !== index + 1 ||
            !refreshes.get(action.id)?.durationWasDefault
        )
      ) {
        return false;
      }
      return group.every((action, index) => {
        if (index === 0) return true;
        const previous = group[index - 1];
        const previousRefresh = refreshes.get(previous.id);
        const expectedStartMs = snapMsToFrame(
          Number(previous.startMs) +
            frameToMs(previousRefresh.oldDefaultFrames) +
            frameToMs(previous.attackInput.defaultLinkDelayFrames ?? 0)
        );
        return Math.abs(Number(action.startMs) - expectedStartMs) <= 0.001;
      });
    });
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeTextArray(values) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : []).map(normalizeText).filter(Boolean)
    ),
  ];
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function nonNegativeIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function normalizeText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}
