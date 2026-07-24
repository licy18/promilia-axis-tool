import { frameToMs, snapMsToFrame } from './timebase';

export function projectVerifiedAttackInputChainSegment(
  source,
  chainSegment,
  sequenceIndex,
  sequenceTotal
) {
  if (!source || !chainSegment) return null;
  const executionTiming = chainSegment.executionTiming ?? {};
  const occupancy = executionTiming.occupancy ?? {};
  const hits = executionTiming.hits ?? [];
  const linkWindow = occupancy.linkWindow ?? null;
  const resolvedSequenceIndex = Number(sequenceIndex) || 0;
  const resolvedSequenceTotal = Number(sequenceTotal) || 0;
  const durationFrames = Number(
    occupancy.durationFrames ?? chainSegment.durationFrames
  );
  const subSkillIndex = Number(chainSegment.subSkillIndex);
  const durationSourceIdentity =
    occupancy.sourceIdentity ?? chainSegment.sourceIdentity;
  const linkTimingApplied =
    resolvedSequenceIndex >= resolvedSequenceTotal || linkWindow != null;

  return {
    ...source,
    sequenceIndex: resolvedSequenceIndex,
    sequenceTotal: resolvedSequenceTotal,
    label: `A${resolvedSequenceIndex}`,
    selectedSubSkillIndex: subSkillIndex,
    effectiveDurationFrames: durationFrames,
    durationFrames,
    durationSourceIdentity,
    actionScheduling: {
      ...source.actionScheduling,
      durationFrames,
      selectedSubSkillIndex: subSkillIndex,
      sourceIdentity: durationSourceIdentity,
    },
    linkWindow,
    linkTimingStatus: linkTimingApplied ? 'applied' : 'unresolved',
    linkTimingBasis: occupancy.sourceKind ?? null,
    linkSourceIdentity:
      linkWindow?.sourceIdentity ?? occupancy.sourceIdentity ?? null,
    selectedHitIdentities: hits
      .map(hit => hit?.hitIdentity)
      .filter(Boolean),
    hitCount: hits.length,
  };
}

export function resolveVerifiedAttackInputChainEntry({
  entry = null,
  graph = null,
  ownerId = null,
  actorId = null,
  timeMs = 0,
  effectIntervals = [],
} = {}) {
  if (!entry?.attackInputSegments?.length || !graph?.attackInputChains) {
    return { status: 'not-required', entry, chain: null };
  }
  const chains = graph.attackInputChains.filter(
    chain =>
      chain.applied === true &&
      Number(chain.ownerId) === Number(ownerId) &&
      Number(chain.sourceSkillId) === Number(entry.skillId) &&
      isRuntimeConditionSatisfied({
        condition: chain.stateCondition,
        actorId,
        timeMs,
        effectIntervals,
      })
  );
  if (chains.length !== 1) {
    return { status: 'not-selected', entry, chain: null };
  }

  const chain = chains[0];
  const segments = chain.segments.map((chainSegment, index) => {
    const source = entry.attackInputSegments.find(
      segment =>
        Number(segment.controlSkillId) === Number(chainSegment.controlSkillId)
    );
    if (!source) return null;
    const sequenceIndex = index + 1;
    const sequenceTotal = chain.segments.length;
    return projectVerifiedAttackInputChainSegment(
      source,
      chainSegment,
      sequenceIndex,
      sequenceTotal
    );
  });
  if (segments.some(segment => !segment)) {
    return {
      status: 'source-segment-missing',
      entry,
      chain,
    };
  }
  return {
    status: 'selected',
    chain,
    entry: {
      ...entry,
      attackInputSegments: segments,
      attackInputChainIdentity: chain.chainIdentity,
    },
  };
}

export function resolveVerifiedContextActionStartMs({
  actions = [],
  selections = [],
  graph = null,
  ownerId = null,
  actorId = null,
  targetControlSkillId = null,
  effectIntervals = [],
  timelineDurationMs = Number.POSITIVE_INFINITY,
} = {}) {
  const contextEdges = (graph?.contextEdges ?? []).filter(
    edge =>
      edge.applied === true &&
      Number(edge.ownerId) === Number(ownerId) &&
      Number(edge.targetControlSkillId) === Number(targetControlSkillId)
  );
  if (!contextEdges.length) return null;

  const selectionByActionId = new Map(
    (selections ?? []).map(selection => [selection.actionId, selection])
  );
  const candidates = [];
  for (const action of actions ?? []) {
    if (
      Number(action.actorCharacterId ?? action.actor?.characterId) !==
      Number(ownerId)
    ) {
      continue;
    }
    const selection = selectionByActionId.get(action.id) ?? {
      controlSkillId: action.attackInput?.controlSkillId,
      selectedSubSkillIndex:
        action.controlSubSkillIndex ??
        action.attackInput?.selectedSubSkillIndex,
    };
    if (
      !Number.isInteger(Number(selection?.controlSkillId)) ||
      !Number.isInteger(Number(selection?.selectedSubSkillIndex))
    ) {
      continue;
    }
    for (const edge of contextEdges) {
      if (
        Number(edge.sourceControlSkillId) !==
          Number(selection.controlSkillId) ||
        Number(edge.sourceSubSkillIndex) !==
          Number(selection.selectedSubSkillIndex)
      ) {
        continue;
      }
      const frameRate = Number(edge.inputWindow?.frameRate) || 60;
      const startMs = snapMsToFrame(
        Number(action.startMs) +
          frameToMs(edge.inputWindow?.startFrame, frameRate)
      );
      const endMs = snapMsToFrame(
        Number(action.startMs) +
          frameToMs(edge.inputWindow?.endFrame, frameRate)
      );
      if (
        startMs < 0 ||
        startMs > endMs ||
        startMs > Number(timelineDurationMs) ||
        !isRuntimeConditionSatisfied({
          condition: edge.condition,
          actorId,
          timeMs: startMs,
          effectIntervals,
        })
      ) {
        continue;
      }
      candidates.push({
        actionId: action.id,
        startMs,
        endMs,
        sourceActionStartMs: Number(action.startMs) || 0,
        edge,
      });
    }
  }
  candidates.sort(
    (left, right) =>
      right.sourceActionStartMs - left.sourceActionStartMs ||
      left.startMs - right.startMs ||
      left.edge.edgeIdentity.localeCompare(right.edge.edgeIdentity)
  );
  return candidates[0] ?? null;
}

export function isFrameWithinVerifiedInputWindow(frame, window) {
  const value = Number(frame);
  return (
    value >= Number(window?.startFrame) && value < Number(window?.endFrame)
  );
}

function isRuntimeConditionSatisfied({
  condition,
  actorId,
  timeMs,
  effectIntervals,
}) {
  if (!condition || condition.kind === 'always') return true;
  const stateActive = (effectIntervals ?? []).some(
    interval =>
      String(interval.effectId) ===
        `battle-element:${condition.stateElementId}` &&
      String(interval.targetId) === String(actorId) &&
      Number(interval.startMs) <= Number(timeMs) &&
      Number(timeMs) < Number(interval.endMs)
  );
  if (condition.kind === 'resource-state-active') return stateActive;
  if (condition.kind === 'resource-state-inactive') return !stateActive;
  return false;
}
