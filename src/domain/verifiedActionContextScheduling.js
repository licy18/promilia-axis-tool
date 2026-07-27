import { frameToMs, msToFrame, snapMsToFrame } from './timebase';

export const VERIFIED_CONTEXT_INPUT_SEMANTICS = Object.freeze({
  IMMEDIATE_INTERRUPT: 'immediate-interrupt',
  BUFFERED_UNTIL_FRAME: 'buffered-until-frame',
  IMMEDIATE_CONTINUOUS: 'immediate-continuous',
  UNRESOLVED: 'unresolved',
});

export function projectVerifiedAttackInputChainSegment(
  source,
  chainSegment,
  sequenceIndex,
  sequenceTotal,
  attackInputChainIdentity = null
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
  const controlSkillId = Number(
    chainSegment.controlSkillId ?? source.controlSkillId
  );
  const durationSourceIdentity =
    occupancy.sourceIdentity ?? chainSegment.sourceIdentity;
  const linkTimingApplied =
    resolvedSequenceIndex >= resolvedSequenceTotal || linkWindow != null;
  const projectedIdentity = [
    attackInputChainIdentity ??
      source.attackInputChainIdentity ??
      source.identity,
    `segment:${resolvedSequenceIndex}`,
    `control:${controlSkillId}`,
    `sub:${subSkillIndex}`,
  ]
    .filter(Boolean)
    .join('|');

  return {
    ...source,
    identity: projectedIdentity,
    sequenceIndex: resolvedSequenceIndex,
    sequenceTotal: resolvedSequenceTotal,
    label: chainSegment.label ?? `A${resolvedSequenceIndex}`,
    semanticName: chainSegment.semanticName ?? source.semanticName ?? null,
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
    selectedHitIdentities: hits.map(hit => hit?.hitIdentity).filter(Boolean),
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
  variantRuntime = null,
  actions = [],
  runtimeSelections = [],
  excludedActionIds = [],
} = {}) {
  if (!entry?.attackInputSegments?.length || !graph?.attackInputChains) {
    return { status: 'not-required', entry, chain: null };
  }
  const eligibleChains = graph.attackInputChains.filter(
    chain =>
      chain.applied === true &&
      Number(chain.ownerId) === Number(ownerId) &&
      Number(chain.sourceSkillId) === Number(entry.skillId) &&
      isRuntimeConditionSatisfied({
        condition: chain.stateCondition,
        actorId,
        timeMs,
        effectIntervals,
        variantRuntime,
        excludedActionIds,
      })
  );
  const derivedChains = eligibleChains.filter(
    chain =>
      chain.entryPolicy?.kind === 'derived-or-quick-entry' &&
      isDerivedAttackChainEntryActive({
        chain,
        graph,
        actorId,
        timeMs,
        variantRuntime,
        actions,
        runtimeSelections,
      })
  );
  const conditionSelectedChains = eligibleChains.filter(
    chain =>
      !chain.entryPolicy || chain.entryPolicy.kind === 'condition-selected'
  );
  const defaultChains = eligibleChains.filter(
    chain => chain.entryPolicy?.kind === 'default'
  );
  const chains =
    derivedChains.length > 0
      ? derivedChains
      : conditionSelectedChains.length > 0
        ? conditionSelectedChains
        : defaultChains;
  if (chains.length !== 1) {
    return { status: 'not-selected', entry, chain: null };
  }

  const chain = chains[0];
  const resourceValue = resolveRuntimeResourceValue({
    variantRuntime,
    actorId,
    resourceIdentity: chain.segmentLimit?.resourceIdentity,
    timeMs,
    excludedActionIds,
  });
  const segmentLimit = resolveAttackChainSegmentLimit(
    chain.segmentLimit,
    resourceValue,
    chain.segments.length
  );
  const selectedChainSegments = chain.segments.slice(0, segmentLimit);
  const sourceSegments =
    entry.attackInputSourceSegments ?? entry.attackInputSegments;
  const segments = selectedChainSegments.map((chainSegment, index) => {
    const source = sourceSegments.find(
      segment =>
        Number(segment.controlSkillId) === Number(chainSegment.controlSkillId)
    );
    if (!source) return null;
    const sequenceIndex = index + 1;
    const sequenceTotal = selectedChainSegments.length;
    const projected = projectVerifiedAttackInputChainSegment(
      source,
      chainSegment,
      sequenceIndex,
      sequenceTotal,
      chain.chainIdentity
    );
    return projected
      ? {
          ...projected,
          attackInputChainIdentity: chain.chainIdentity,
        }
      : null;
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

function isDerivedAttackChainEntryActive({
  chain,
  graph,
  actorId,
  timeMs,
  variantRuntime,
  actions,
  runtimeSelections,
}) {
  const firstSegment = chain.segments?.[0];
  if (!firstSegment) return false;
  const quickEntry = (variantRuntime?.activeSwitchWindows ?? []).some(
    window =>
      String(window.actorId) === String(actorId) &&
      Number(window.targetControlSkillId) ===
        Number(firstSegment.controlSkillId) &&
      Number(window.targetSubSkillIndex) ===
        Number(firstSegment.subSkillIndex) &&
      Number(window.startsAtMs) <= Number(timeMs) &&
      Number(timeMs) < Number(window.endsAtMs)
  );
  if (quickEntry) return true;

  const sourceChains = (graph?.attackInputChains ?? []).filter(
    candidate =>
      candidate.applied === true &&
      candidate.phaseTransition?.applied === true &&
      candidate.phaseTransition.targetChainIdentity === chain.chainIdentity
  );
  const selectionByActionId = new Map(
    (runtimeSelections ?? []).map(selection => [
      String(selection.actionId),
      selection,
    ])
  );
  return sourceChains.some(sourceChain => {
    const transition = sourceChain.phaseTransition;
    const sourceSegment = sourceChain.segments.find(
      segment =>
        Number(segment.sequenceIndex) === Number(transition.sourceSequenceIndex)
    );
    if (!sourceSegment) return false;
    return (actions ?? []).some(action => {
      if (
        (String(action.actorId) !== String(actorId) &&
          Number(action.actorCharacterId) !== Number(chain.ownerId)) ||
        Number(action.startMs) > Number(timeMs)
      ) {
        return false;
      }
      const selection = selectionByActionId.get(String(action.id));
      const controlSkillId = Number(
        selection?.executionControlSkillId ??
          selection?.controlSkillId ??
          action.attackInput?.controlSkillId
      );
      const subSkillIndex = Number(
        selection?.selectedSubSkillIndex ??
          action.controlSubSkillIndex ??
          action.attackInput?.selectedSubSkillIndex
      );
      if (
        controlSkillId !== Number(sourceSegment.controlSkillId) ||
        subSkillIndex !== Number(sourceSegment.subSkillIndex)
      ) {
        return false;
      }
      const relativeFrame = msToFrame(
        Number(timeMs) - Number(action.startMs),
        transition.inputWindow?.frameRate ?? 60
      );
      return (
        relativeFrame >= Number(transition.inputWindow?.startFrame) &&
        relativeFrame < Number(transition.inputWindow?.endFrame)
      );
    });
  });
}

function resolveAttackChainSegmentLimit(segmentLimit, resourceValue, fallback) {
  if (!segmentLimit) return fallback;
  if (segmentLimit.kind !== 'resource-current-value') return fallback;
  const costPerSegment = Number(segmentLimit.costPerSegment);
  const maximum = Math.min(Number(segmentLimit.maximum) || fallback, fallback);
  if (!(costPerSegment > 0) || !Number.isFinite(resourceValue)) return 0;
  return Math.max(
    0,
    Math.min(maximum, Math.floor(Number(resourceValue) / costPerSegment))
  );
}

function resolveRuntimeResourceValue({
  variantRuntime,
  actorId,
  resourceIdentity,
  timeMs,
  excludedActionIds = [],
}) {
  if (!resourceIdentity) return null;
  const initial = (variantRuntime?.initialState ?? []).find(
    entry =>
      String(entry.actorId) === String(actorId) &&
      entry.resourceIdentity === resourceIdentity
  );
  let value = Number(initial?.currentValue);
  if (!Number.isFinite(value)) return null;
  const excludedActionIdSet = new Set((excludedActionIds ?? []).map(String));
  const events = (variantRuntime?.resourceEvents ?? [])
    .filter(
      event =>
        !excludedActionIdSet.has(String(event.actionId)) &&
        String(event.actorId) === String(actorId) &&
        event.payload?.resourceIdentity === resourceIdentity &&
        Number(event.timeMs) <= Number(timeMs)
    )
    .sort(
      (left, right) =>
        Number(left.timeMs) - Number(right.timeMs) ||
        Number(left.runtimeSequenceIndex) - Number(right.runtimeSequenceIndex)
    );
  for (const event of events) {
    const afterValue = Number(event.payload?.afterValue);
    if (Number.isFinite(afterValue)) value = afterValue;
  }
  return value;
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
    const matchingEdges = contextEdges.filter(
      edge =>
        Number(edge.sourceControlSkillId) ===
          Number(selection.controlSkillId) &&
        Number(edge.sourceSubSkillIndex) ===
          Number(selection.selectedSubSkillIndex)
    );
    if (!matchingEdges.length) continue;
    const predecessorEffectiveEndFrame = Number(
      selection.actualDurationFrames ??
        matchingEdges.find(edge =>
          Number.isInteger(
            Number(edge.inputScheduling?.predecessorGenericEndFrame)
          )
        )?.inputScheduling?.predecessorGenericEndFrame ??
        action.attackInput?.effectiveDurationFrames ??
        action.attackInput?.durationFrames ??
        msToFrame(action.durationMs)
    );
    if (!Number.isInteger(predecessorEffectiveEndFrame)) continue;
    const requestedExecutionStartMs = snapMsToFrame(
      Number(action.startMs) + frameToMs(predecessorEffectiveEndFrame)
    );
    const scheduling = resolveVerifiedContextInputScheduling({
      edges: matchingEdges,
      predecessorStartMs: action.startMs,
      predecessorEffectiveEndFrame,
      requestedExecutionStartMs,
    });
    if (
      !scheduling ||
      scheduling.executionStartMs > Number(timelineDurationMs) ||
      !isRuntimeConditionSatisfied({
        condition: scheduling.edge.condition,
        actorId,
        timeMs: scheduling.inputTimeMs,
        effectIntervals,
      })
    ) {
      continue;
    }
    candidates.push({
      actionId: action.id,
      startMs: scheduling.executionStartMs,
      endMs: snapMsToFrame(
        Number(action.startMs) +
          frameToMs(scheduling.edge.inputWindow?.endFrame)
      ),
      inputTimeMs: scheduling.inputTimeMs,
      predecessorEffectiveEndMs: scheduling.predecessorEffectiveEndMs,
      sourceActionStartMs: Number(action.startMs) || 0,
      edge: scheduling.edge,
      inputScheduling: scheduling,
    });
  }
  candidates.sort(
    (left, right) =>
      right.sourceActionStartMs - left.sourceActionStartMs ||
      left.startMs - right.startMs ||
      left.edge.edgeIdentity.localeCompare(right.edge.edgeIdentity)
  );
  return candidates[0] ?? null;
}

export function resolveVerifiedContextInputScheduling({
  edges = [],
  predecessorStartMs = 0,
  predecessorEffectiveEndFrame = null,
  requestedExecutionStartMs = 0,
} = {}) {
  const candidates = (edges ?? [])
    .filter(
      edge =>
        edge?.applied === true &&
        Number.isInteger(Number(edge.inputWindow?.startFrame)) &&
        Number.isInteger(Number(edge.inputWindow?.endFrame)) &&
        Number(edge.inputWindow.endFrame) > Number(edge.inputWindow.startFrame)
    )
    .sort(compareContextEdges);
  if (!candidates.length) return null;

  const predecessorStartFrame = msToFrame(predecessorStartMs);
  const requestedExecutionStartFrame = msToFrame(requestedExecutionStartMs);
  const requestedOffsetFrame =
    requestedExecutionStartFrame - predecessorStartFrame;
  const direct = candidates.filter(edge =>
    isFrameWithinVerifiedInputWindow(requestedOffsetFrame, edge.inputWindow)
  );
  if (direct.length) {
    const edge = selectContextEdge(direct, requestedOffsetFrame);
    return createContextInputSchedulingResult({
      edge,
      predecessorStartFrame,
      requestedExecutionStartFrame,
      inputOffsetFrame: requestedOffsetFrame,
      predecessorEffectiveEndFrame,
      resolutionKind: 'direct-input-window',
    });
  }

  const resolvedPredecessorEndFrame = Number(predecessorEffectiveEndFrame);
  if (
    !Number.isInteger(resolvedPredecessorEndFrame) ||
    requestedOffsetFrame !== resolvedPredecessorEndFrame
  ) {
    return null;
  }
  const edgeIntentCandidates = candidates.filter(edge => {
    const scheduling = edge.inputScheduling?.edgeIntent;
    if (scheduling?.status === 'applied') {
      return (
        Number(scheduling.predecessorGenericEndFrame) ===
        resolvedPredecessorEndFrame
      );
    }
    return Number(edge.inputWindow?.endFrame) === resolvedPredecessorEndFrame;
  });
  if (!edgeIntentCandidates.length) return null;
  const edge = [...edgeIntentCandidates].sort(
    (left, right) =>
      Number(right.inputWindow.startFrame) -
        Number(left.inputWindow.startFrame) || compareContextEdges(left, right)
  )[0];
  const inputOffsetFrame = Number(
    edge.inputScheduling?.edgeIntent?.canonicalInputFrame ??
      Number(edge.inputWindow.endFrame) - 1
  );
  if (!isFrameWithinVerifiedInputWindow(inputOffsetFrame, edge.inputWindow)) {
    return null;
  }
  return createContextInputSchedulingResult({
    edge,
    predecessorStartFrame,
    requestedExecutionStartFrame,
    inputOffsetFrame,
    predecessorEffectiveEndFrame: resolvedPredecessorEndFrame,
    resolutionKind: 'edge-intent-contextual-transition',
  });
}

export function isFrameWithinVerifiedInputWindow(frame, window) {
  const value = Number(frame);
  return (
    value >= Number(window?.startFrame) && value < Number(window?.endFrame)
  );
}

function createContextInputSchedulingResult({
  edge,
  predecessorStartFrame,
  requestedExecutionStartFrame,
  inputOffsetFrame,
  predecessorEffectiveEndFrame,
  resolutionKind,
}) {
  const inputSemantics =
    edge.inputScheduling?.inputSemantics ??
    classifyVerifiedContextInputSemantics(edge.inputWindow);
  if (inputSemantics === VERIFIED_CONTEXT_INPUT_SEMANTICS.UNRESOLVED) {
    return null;
  }
  const inputFrame = predecessorStartFrame + inputOffsetFrame;
  const generatedExecutionOffsetFrame = Number(
    edge.inputScheduling?.edgeIntent?.canonicalExecutionStartFrame
  );
  const generatedPredecessorEndFrame = Number(
    edge.inputScheduling?.edgeIntent?.canonicalPredecessorEndFrame
  );
  const isEdgeIntent = resolutionKind === 'edge-intent-contextual-transition';
  const executionOffsetFrame =
    isEdgeIntent && Number.isInteger(generatedExecutionOffsetFrame)
      ? generatedExecutionOffsetFrame
      : inputSemantics === VERIFIED_CONTEXT_INPUT_SEMANTICS.BUFFERED_UNTIL_FRAME
        ? Math.max(
            inputOffsetFrame,
            Number(edge.inputScheduling?.bufferUntilFrame) ||
              Number(predecessorEffectiveEndFrame) ||
              inputOffsetFrame
          )
        : inputOffsetFrame;
  const contextualPredecessorEndOffsetFrame =
    isEdgeIntent && Number.isInteger(generatedPredecessorEndFrame)
      ? generatedPredecessorEndFrame
      : executionOffsetFrame;
  const executionStartFrame = predecessorStartFrame + executionOffsetFrame;
  const contextualPredecessorEndFrame =
    predecessorStartFrame + contextualPredecessorEndOffsetFrame;
  return {
    edge,
    resolutionKind,
    inputSemantics,
    requestedExecutionStartFrame,
    requestedExecutionStartMs: frameToMs(requestedExecutionStartFrame),
    inputFrame,
    inputOffsetFrame,
    inputTimeMs: frameToMs(inputFrame),
    executionStartFrame,
    executionStartOffsetFrame: executionOffsetFrame,
    executionStartMs: frameToMs(executionStartFrame),
    predecessorEffectiveEndFrame: contextualPredecessorEndFrame,
    predecessorEffectiveEndOffsetFrame: contextualPredecessorEndOffsetFrame,
    predecessorEffectiveEndMs: frameToMs(contextualPredecessorEndFrame),
    inputWindow: {
      ...edge.inputWindow,
      interval: '[start,end)',
    },
    sourceIdentity: [
      edge.inputWindow?.sourceIdentity,
      edge.inputScheduling?.sourceIdentity,
      edge.sourceIdentity,
    ]
      .filter(Boolean)
      .join('|'),
    status: 'verified-context-input-scheduling-ready',
    applied: true,
  };
}

function classifyVerifiedContextInputSemantics(window) {
  const bridgeType = Number(window?.bridgeType);
  const continuousAttackType = Number(window?.continuousAttackType);
  if (bridgeType === 3) {
    return VERIFIED_CONTEXT_INPUT_SEMANTICS.IMMEDIATE_INTERRUPT;
  }
  if (bridgeType === 0 && continuousAttackType === 0) {
    return VERIFIED_CONTEXT_INPUT_SEMANTICS.BUFFERED_UNTIL_FRAME;
  }
  if (bridgeType === 0 && continuousAttackType === 1) {
    return VERIFIED_CONTEXT_INPUT_SEMANTICS.IMMEDIATE_CONTINUOUS;
  }
  return VERIFIED_CONTEXT_INPUT_SEMANTICS.UNRESOLVED;
}

function selectContextEdge(edges, inputFrame) {
  return [...edges].sort(
    (left, right) =>
      Number(right.inputWindow.startFrame) -
        Number(left.inputWindow.startFrame) ||
      Math.abs(Number(left.inputWindow.endFrame) - inputFrame) -
        Math.abs(Number(right.inputWindow.endFrame) - inputFrame) ||
      compareContextEdges(left, right)
  )[0];
}

function compareContextEdges(left, right) {
  return String(left?.edgeIdentity ?? '').localeCompare(
    String(right?.edgeIdentity ?? '')
  );
}

function isRuntimeConditionSatisfied({
  condition,
  actorId,
  timeMs,
  effectIntervals,
  variantRuntime,
  excludedActionIds = [],
}) {
  if (!condition || condition.kind === 'always') return true;
  if (
    condition.kind === 'resource-at-least' ||
    condition.kind === 'resource-below'
  ) {
    const currentValue = resolveRuntimeResourceValue({
      variantRuntime,
      actorId,
      resourceIdentity: condition.resourceIdentity,
      timeMs,
      excludedActionIds,
    });
    if (!Number.isFinite(currentValue)) return false;
    return condition.kind === 'resource-at-least'
      ? currentValue >= Number(condition.value)
      : currentValue < Number(condition.value);
  }
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
