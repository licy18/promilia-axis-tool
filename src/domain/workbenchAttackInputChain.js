import { frameToMs, msToFrame, snapMsToFrame } from './timebase';

export const ATTACK_INPUT_CHAIN_SOURCE = 'normal-attack-input-chain';
export const ATTACK_INPUT_LEGACY_UNRESOLVED = 'legacy-unresolved-duration';

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
  const segment = normalizeAttackInputSegment({
    ...(source.attackInput ?? {}),
    sequenceIndex:
      source.attackSequenceIndex ?? source.attackInput?.sequenceIndex,
    sequenceTotal:
      source.attackSequenceTotal ?? source.attackInput?.sequenceTotal,
  });
  if (!segment) {
    return legacyStatus ? { attackInputLegacyStatus: legacyStatus } : {};
  }
  return {
    attackGroupId:
      normalizeText(source.attackGroupId) ??
      `attack-group-${normalizeText(source.id) ?? 'unresolved'}`,
    attackSequenceIndex: segment.sequenceIndex,
    attackSequenceTotal: segment.sequenceTotal,
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
  if (
    !segments.length ||
    segments.some(
      segment =>
        segment.durationStatus !== 'applied' ||
        !positiveIntegerOrNull(segment.durationFrames)
    ) ||
    typeof createActionId !== 'function'
  ) {
    return [];
  }
  const actionIds = segments.map((segment, index) =>
    createActionId(segment, index)
  );
  const groupId =
    normalizeText(attackGroupId) ?? `attack-group-${actionIds[0]}`;
  let cursorMs = Math.max(0, snapMsToFrame(Number(startMs) || 0));
  return segments.map((segment, index) => {
    const actionId = actionIds[index];
    const durationMs = frameToMs(segment.durationFrames);
    const linkDelayFrames = segment.defaultLinkDelayFrames;
    const action = {
      ...(baseDraft ?? {}),
      id: actionId,
      type: 'skill',
      skillId: Number(skillId ?? entry?.skillId) || null,
      actorCharacterId: Number(actorCharacterId) || null,
      level: Math.max(1, Number(level) || 1),
      actionVariantIndex: Math.max(0, Number(entry?.actionVariantIndex) || 0),
      damageSegmentIndex: Math.max(0, Number(entry?.actionVariantIndex) || 0),
      startMs: cursorMs,
      durationMs,
      note: `普通攻击 ${segment.label} · control ${segment.controlSkillId} · ${segment.hitCount} 个命中绑定`,
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
      attackInput: segment,
    };
    cursorMs = snapMsToFrame(
      cursorMs + durationMs + frameToMs(linkDelayFrames ?? 0)
    );
    return action;
  });
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
  const refreshed = refreshAttackInputActionDrafts(actions, resolveMapping);
  const usedIds = new Set(
    refreshed.actions.map(action => String(action.id ?? ''))
  );
  const unresolvedActionIds = [];
  let changed = refreshed.changed;
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
    defaultLinkDelayFrames: nonNegativeIntegerOrNull(
      segment.defaultLinkDelayFrames
    ),
    linkWindow: normalizeLinkWindow(segment.linkWindow),
    linkTimingStatus: normalizeText(segment.linkTimingStatus) ?? 'unresolved',
    linkTimingReasons: normalizeTextArray(segment.linkTimingReasons),
    selectedHitIdentities: normalizeTextArray(segment.selectedHitIdentities),
    hitCount: Math.max(0, Number(segment.hitCount) || 0),
    classification: normalizeText(segment.classification) ?? 'unresolved',
    reasons: normalizeTextArray(segment.reasons),
    sourceIdentity: normalizeText(segment.sourceIdentity),
  };
}

function normalizeLinkWindow(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const startFrame = nonNegativeIntegerOrNull(value.startFrame);
  const endFrame = nonNegativeIntegerOrNull(value.endFrame);
  return startFrame == null && endFrame == null
    ? null
    : {
        kind: normalizeText(value.kind),
        targetControlSkillId: positiveIntegerOrNull(value.targetControlSkillId),
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

function refreshAttackInputActionDrafts(actions, resolveMapping) {
  const refreshes = new Map();
  for (const action of actions) {
    if (!action?.attackInput || action.attackInputLegacyStatus) continue;
    const mapping = resolveMapping(action);
    if (mapping?.actionKind !== 'normal-attack') continue;
    const segments = normalizeAttackInputSegments(mapping.attackInputSegments);
    const segment = segments.find(
      item =>
        item.sequenceIndex === Number(action.attackSequenceIndex) &&
        item.controlSkillId === Number(action.attackInput.controlSkillId)
    );
    if (!segment) continue;
    const oldDefaultFrames =
      positiveIntegerOrNull(action.attackInput.effectiveDurationFrames) ??
      positiveIntegerOrNull(action.attackInput.durationFrames);
    const durationWasDefault =
      oldDefaultFrames != null &&
      Math.abs(msToFrame(action.durationMs) - oldDefaultFrames) <= 1;
    refreshes.set(action.id, {
      segment,
      timingReady:
        segment.durationStatus === 'applied' &&
        positiveIntegerOrNull(segment.durationFrames) != null,
      durationWasDefault,
      oldDefaultFrames,
    });
  }
  const pristineGroups = findPristineAttackInputGroups(actions, refreshes);
  let changed = false;
  const refreshedActions = actions.map(action => {
    const refresh = refreshes.get(action.id);
    if (!refresh) return action;
    const durationFrames =
      refresh.segment.effectiveDurationFrames ?? refresh.segment.durationFrames;
    const next = {
      ...action,
      ...(refresh.timingReady && refresh.durationWasDefault
        ? { durationMs: frameToMs(durationFrames) }
        : {}),
      attackSequenceIndex: refresh.segment.sequenceIndex,
      attackSequenceTotal: refresh.segment.sequenceTotal,
      attackInput: refresh.segment,
      ...(!refresh.timingReady
        ? { attackInputLegacyStatus: ATTACK_INPUT_LEGACY_UNRESOLVED }
        : {}),
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
            !refreshes.get(action.id)?.timingReady ||
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
