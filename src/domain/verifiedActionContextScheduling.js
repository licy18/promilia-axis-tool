import { frameToMs, msToFrame, snapMsToFrame } from './timebase';
import {
  VERIFIED_NORMAL_ATTACK_INPUT_PHASES,
  resolveVerifiedNormalAttackInputPhase,
} from './verifiedNormalAttackInputAuthority';

export const VERIFIED_CONTEXT_INPUT_SEMANTICS = Object.freeze({
  IMMEDIATE_INTERRUPT: 'immediate-interrupt',
  BUFFERED_UNTIL_FRAME: 'buffered-until-frame',
  IMMEDIATE_CONTINUOUS: 'immediate-continuous',
  UNRESOLVED: 'unresolved',
});

export const VERIFIED_ATTACK_INPUT_SELECTION_MODES = Object.freeze({
  CHAIN: 'chain',
  SINGLE_INPUT: 'single-input',
});

export function projectVerifiedAttackInputChainSegment(
  source,
  chainSegment,
  sequenceIndex,
  sequenceTotal,
  attackInputChainIdentity = null,
  chainSequenceIndex = sequenceIndex
) {
  if (!source || !chainSegment) return null;
  const executionTiming = chainSegment.executionTiming ?? {};
  const occupancy = executionTiming.occupancy ?? {};
  const hits = executionTiming.hits ?? [];
  const linkWindow = occupancy.linkWindow ?? null;
  const resolvedSequenceIndex = Number(sequenceIndex) || 0;
  const resolvedSequenceTotal = Number(sequenceTotal) || 0;
  const resolvedChainSequenceIndex =
    Number(chainSequenceIndex) || resolvedSequenceIndex;
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
    `segment:${resolvedChainSequenceIndex}`,
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
    chainSequenceIndex: resolvedChainSequenceIndex,
    label: chainSegment.label ?? `A${resolvedSequenceIndex}`,
    semanticName: chainSegment.semanticName ?? source.semanticName ?? null,
    attackInputChainIdentity:
      attackInputChainIdentity ?? source.attackInputChainIdentity ?? null,
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
  selectionMode = VERIFIED_ATTACK_INPUT_SELECTION_MODES.CHAIN,
} = {}) {
  if (!entry?.attackInputSegments?.length || !graph?.attackInputChains) {
    return { status: 'not-required', entry, chain: null };
  }
  const singleInput =
    selectionMode === VERIFIED_ATTACK_INPUT_SELECTION_MODES.SINGLE_INPUT;
  const activeNormalInputWindows = singleInput
    ? collectActiveNormalAttackInputWindows({
        variantRuntime,
        actorId,
        timeMs,
      })
    : [];
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
  const derivedEntries = eligibleChains
    .filter(
      chain =>
        singleInput || chain.entryPolicy?.kind === 'derived-or-quick-entry'
    )
    .map(chain =>
      resolveDerivedAttackChainEntry({
        chain,
        graph,
        actorId,
        timeMs,
        variantRuntime,
        actions,
        runtimeSelections,
      })
    )
    .filter(Boolean);
  if (
    singleInput &&
    activeNormalInputWindows.length > 0 &&
    derivedEntries.length === 0
  ) {
    const targetedChains = graph.attackInputChains.filter(
      chain =>
        chain.applied === true &&
        Number(chain.ownerId) === Number(ownerId) &&
        Number(chain.sourceSkillId) === Number(entry.skillId) &&
        activeNormalInputWindows.some(window =>
          chain.segments?.some(
            segment =>
              Number(segment.controlSkillId) ===
                Number(window.targetControlSkillId) &&
              Number(segment.subSkillIndex) ===
                Number(window.targetSubSkillIndex) &&
              (window.targetChainIdentity == null ||
                String(window.targetChainIdentity) ===
                  String(chain.chainIdentity))
          )
        )
    );
    const resourceUnavailable = targetedChains.some(chain => {
      if (!chain.segmentLimit?.resourceIdentity) return false;
      const resourceValue = resolveRuntimeResourceValue({
        variantRuntime,
        actorId,
        resourceIdentity: chain.segmentLimit.resourceIdentity,
        timeMs,
        excludedActionIds,
      });
      return (
        resolveAttackChainSegmentLimit(
          chain.segmentLimit,
          resourceValue,
          chain.segments.length
        ) < 1
      );
    });
    return {
      status: 'blocked',
      reason: resourceUnavailable
        ? 'verified-normal-attack-input-resource-unavailable'
        : 'verified-normal-attack-input-active-window-unresolved',
      reasons: [
        resourceUnavailable
          ? 'verified-derived-attack-input-requires-source-resource'
          : 'verified-normal-attack-input-active-window-target-unresolved',
      ],
      entry: null,
      chain: targetedChains.length === 1 ? targetedChains[0] : null,
      activeWindows: activeNormalInputWindows,
    };
  }
  const conditionSelectedChains = eligibleChains.filter(
    chain =>
      !chain.entryPolicy || chain.entryPolicy.kind === 'condition-selected'
  );
  const defaultChains = eligibleChains.filter(
    chain => chain.entryPolicy?.kind === 'default'
  );
  const chains =
    derivedEntries.length > 0
      ? derivedEntries.map(item => item.chain)
      : conditionSelectedChains.length > 0
        ? conditionSelectedChains
        : defaultChains;
  if (chains.length !== 1) {
    return singleInput
      ? {
          status: 'blocked',
          reason: 'verified-normal-attack-input-chain-not-selected',
          reasons: ['verified-normal-attack-input-chain-not-unique'],
          entry: null,
          chain: null,
        }
      : { status: 'not-selected', entry, chain: null };
  }

  const chain = chains[0];
  const derivedEntry =
    derivedEntries.length === 1 &&
    derivedEntries[0].chain.chainIdentity === chain.chainIdentity
      ? derivedEntries[0]
      : null;
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
  if (singleInput && derivedEntry && segmentLimit < 1) {
    return {
      status: 'blocked',
      reason: 'verified-normal-attack-input-resource-unavailable',
      reasons: ['verified-derived-attack-input-requires-source-resource'],
      entry: null,
      chain,
    };
  }
  const startSequenceIndex = derivedEntry?.sequenceIndex ?? 1;
  const selectedSegmentCount = singleInput
    ? Math.min(segmentLimit, 1)
    : segmentLimit;
  const selectedChainSegments = chain.segments.slice(
    startSequenceIndex - 1,
    startSequenceIndex - 1 + selectedSegmentCount
  );
  if (singleInput && selectedChainSegments.length !== 1) {
    return {
      status: 'blocked',
      reason: 'verified-normal-attack-input-segment-unavailable',
      reasons: ['verified-normal-attack-input-target-segment-missing'],
      entry: null,
      chain,
    };
  }
  const sourceSegments =
    entry.attackInputSourceSegments ?? entry.attackInputSegments;
  const segments = selectedChainSegments.map((chainSegment, index) => {
    const source = sourceSegments.find(
      segment =>
        Number(segment.controlSkillId) === Number(chainSegment.controlSkillId)
    );
    if (!source) return null;
    const chainSequenceIndex = Number(chainSegment.sequenceIndex);
    const sequenceIndex = singleInput ? chainSequenceIndex : index + 1;
    const sequenceTotal = singleInput
      ? chain.segments.length
      : selectedChainSegments.length;
    const projected = projectVerifiedAttackInputChainSegment(
      source,
      chainSegment,
      sequenceIndex,
      sequenceTotal,
      chain.chainIdentity,
      chainSequenceIndex
    );
    return projected
      ? {
          ...projected,
          attackInputChainIdentity: chain.chainIdentity,
        }
      : null;
  });
  if (segments.some(segment => !segment)) {
    return singleInput
      ? {
          status: 'blocked',
          reason: 'verified-normal-attack-input-source-segment-missing',
          reasons: ['verified-normal-attack-input-source-segment-missing'],
          entry: null,
          chain,
        }
      : {
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
      ...(singleInput
        ? {
            attackInputExpansionMode:
              VERIFIED_ATTACK_INPUT_SELECTION_MODES.SINGLE_INPUT,
          }
        : {}),
    },
  };
}

export function resolveVerifiedNormalAttackInputEntryBase({
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
  projectPhaseTransitions = null,
} = {}) {
  if (!entry?.attackInputSegments?.length) {
    return { status: 'not-required', entry, chain: null, phase: null };
  }
  const selectionByActionId = new Map(
    (runtimeSelections ?? []).map(selection => [
      String(selection.actionId),
      selection,
    ])
  );
  const latestAccepted = resolveLatestAcceptedActorAction({
    actions,
    selectionByActionId,
    ownerId,
    actorId,
    timeMs,
    excludedActionIds,
  });
  const acceptedAction = latestAccepted?.action
    ? {
        ...latestAccepted.action,
        actorId: latestAccepted.action.actorId ?? actorId,
        actionKind: latestAccepted.action.attackInput
          ? 'normal-attack'
          : (latestAccepted.action.actionKind ?? latestAccepted.action.type),
      }
    : null;
  const acceptedSelection = latestAccepted?.selection ?? null;
  const activeWindows = collectPendingNormalAttackInputWindows({
    variantRuntime,
    actorId,
    timeMs,
    actions,
    selectionByActionId,
    excludedActionIds,
  }).filter(
    window =>
      acceptedAction?.id != null &&
      String(window.sourceActionId) === String(acceptedAction.id)
  );
  const projectedActiveWindows = projectNormalAttackContinuationCandidates({
    entry,
    graph,
    ownerId,
    activeWindows,
    actions,
    selectionByActionId,
  });
  if (
    activeWindows.length > 0 &&
    projectedActiveWindows.length !== activeWindows.length
  ) {
    return createVerifiedNormalAttackInputBlock({
      reason: 'verified-normal-attack-input-active-window-unresolved',
      reasons: ['verified-normal-attack-input-active-window-target-unresolved'],
      phase: null,
      chain: null,
    });
  }
  const projectedPhaseTransitions =
    typeof projectPhaseTransitions === 'function'
      ? projectPhaseTransitions({
          entry,
          graph,
          ownerId,
          actorId,
          timeMs,
          effectIntervals,
          variantRuntime,
          excludedActionIds,
          acceptedAction,
          acceptedSelection,
        })
      : [];
  const continuationCandidates = [
    ...projectedActiveWindows,
    ...projectedPhaseTransitions,
  ];
  const chain = resolveNormalAttackAuthorityChain({
    entry,
    graph,
    ownerId,
    actorId,
    timeMs,
    effectIntervals,
    variantRuntime,
    excludedActionIds,
    acceptedAction,
    acceptedSelection,
    continuationCandidates,
  });
  const authorityChain = projectVerifiedNormalAttackAuthorityChain(chain);
  const phase = resolveVerifiedNormalAttackInputPhase({
    mapping: entry,
    chain: authorityChain,
    acceptedAction,
    acceptedSelection,
    actorId,
    inputTimeMs: timeMs,
    activeContinuationWindows: continuationCandidates.filter(
      candidate => candidate.relationType === 'attack-chain-continuity-window'
    ),
    specialContinuationCandidates: continuationCandidates.filter(
      candidate => candidate.relationType !== 'attack-chain-continuity-window'
    ),
  });
  if (!phase.formIdentity) {
    return createVerifiedNormalAttackInputBlock({
      reason:
        phase.reasons?.[0] ??
        'verified-normal-attack-input-structural-form-unresolved',
      reasons: phase.reasons,
      phase,
      chain,
    });
  }
  if (phase.phase === VERIFIED_NORMAL_ATTACK_INPUT_PHASES.RECOVERY_LOCKED) {
    return createVerifiedNormalAttackInputBlock({
      reason:
        phase.reasons?.[0] ?? 'verified-normal-attack-input-recovery-locked',
      reasons: phase.reasons,
      phase,
      chain,
    });
  }
  if (!phase.expected) {
    return createVerifiedNormalAttackInputBlock({
      reason: 'verified-normal-attack-input-expected-target-unresolved',
      reasons: ['verified-normal-attack-input-expected-target-unresolved'],
      phase,
      chain,
    });
  }
  const expectedChain =
    (graph?.attackInputChains ?? []).find(
      candidate =>
        candidate.applied === true &&
        Number(candidate.ownerId) === Number(ownerId) &&
        String(candidate.chainIdentity) ===
          String(phase.expected.chainIdentity ?? chain?.chainIdentity ?? '')
    ) ?? chain;
  if (
    expectedChain?.segmentLimit?.resourceIdentity &&
    resolveAttackChainSegmentLimit(
      expectedChain.segmentLimit,
      resolveRuntimeResourceValue({
        variantRuntime,
        actorId,
        resourceIdentity: expectedChain.segmentLimit.resourceIdentity,
        timeMs,
        excludedActionIds,
      }),
      expectedChain.segments.length
    ) < 1
  ) {
    return createVerifiedNormalAttackInputBlock({
      reason: 'verified-normal-attack-input-resource-unavailable',
      reasons: ['verified-derived-attack-input-requires-source-resource'],
      phase,
      chain: expectedChain,
    });
  }
  const chainSegment = (
    expectedChain?.segments ??
    entry.attackInputSegments ??
    []
  ).find(
    segment =>
      Number(segment.sequenceIndex) === Number(phase.expected.sequenceIndex) &&
      Number(segment.controlSkillId) ===
        Number(phase.expected.controlSkillId) &&
      Number(segment.subSkillIndex ?? segment.selectedSubSkillIndex) ===
        Number(phase.expected.subSkillIndex)
  );
  const sourceSegments =
    entry.attackInputSourceSegments ?? entry.attackInputSegments;
  const sourceSegment = sourceSegments.find(
    segment =>
      Number(segment.controlSkillId) === Number(phase.expected.controlSkillId)
  );
  if (!chainSegment || !sourceSegment) {
    return createVerifiedNormalAttackInputBlock({
      reason: 'verified-normal-attack-input-source-segment-missing',
      reasons: ['verified-normal-attack-input-source-segment-missing'],
      phase,
      chain: expectedChain,
    });
  }
  const sequenceTotal =
    expectedChain?.segments?.length ?? entry.attackInputSegments.length;
  const projected = projectVerifiedAttackInputChainSegment(
    sourceSegment,
    chainSegment,
    Number(phase.expected.sequenceIndex),
    sequenceTotal,
    phase.expected.chainIdentity ?? expectedChain?.chainIdentity ?? null,
    Number(phase.expected.sequenceIndex)
  );
  if (!projected) {
    return createVerifiedNormalAttackInputBlock({
      reason: 'verified-normal-attack-input-segment-unavailable',
      reasons: ['verified-normal-attack-input-target-segment-missing'],
      phase,
      chain: expectedChain,
    });
  }
  return {
    status: 'selected',
    reason: null,
    reasons: [],
    chain: expectedChain ?? null,
    phase,
    entry: {
      ...entry,
      attackInputSegments: [projected],
      attackInputChainIdentity:
        phase.expected.chainIdentity ?? expectedChain?.chainIdentity ?? null,
      attackInputExpansionMode:
        VERIFIED_ATTACK_INPUT_SELECTION_MODES.SINGLE_INPUT,
      ...(phase.expected.groupId
        ? { attackInputGroupId: phase.expected.groupId }
        : {}),
      ...(phase.expected.contextActionId
        ? { attackInputContextActionId: phase.expected.contextActionId }
        : {}),
    },
  };
}

function projectVerifiedNormalAttackAuthorityChain(chain) {
  if (!chain?.segments?.length) return chain ?? null;
  return {
    ...chain,
    segments: chain.segments.map(segment => ({
      ...segment,
      actionTiming:
        segment.actionTiming ??
        (segment.executionTiming
          ? {
              animation: segment.executionTiming.animation ?? null,
              windows: segment.executionTiming.windows ?? [],
            }
          : null),
    })),
  };
}

function resolveLatestAcceptedActorAction({
  actions,
  selectionByActionId,
  ownerId,
  actorId,
  timeMs,
  excludedActionIds,
}) {
  const excluded = new Set((excludedActionIds ?? []).map(String));
  return (actions ?? [])
    .map((action, index) => ({
      action,
      index,
      selection: selectionByActionId.get(String(action.id)) ?? null,
    }))
    .filter(({ action, selection }) => {
      if (
        excluded.has(String(action.id)) ||
        Number(action.startMs) > Number(timeMs) ||
        (Number(action.actorCharacterId ?? action.actor?.characterId) !==
          Number(ownerId) &&
          String(action.actorId ?? '') !== String(actorId ?? ''))
      ) {
        return false;
      }
      const status = String(selection?.status ?? 'ready');
      return (
        selection?.ready !== false &&
        !status.includes('blocked') &&
        !status.includes('skipped') &&
        !status.includes('unresolved')
      );
    })
    .sort(
      (left, right) =>
        Number(right.action.startMs) - Number(left.action.startMs) ||
        right.index - left.index
    )[0];
}

function collectPendingNormalAttackInputWindows({
  variantRuntime,
  actorId,
  timeMs,
  actions,
  selectionByActionId,
  excludedActionIds,
}) {
  const excluded = new Set((excludedActionIds ?? []).map(String));
  const sourceActionsById = new Map(
    (actions ?? []).map(action => [String(action.id), action])
  );
  return (variantRuntime?.activeSwitchWindows ?? []).filter(window => {
    const sourceActionId = String(window?.sourceActionId ?? '');
    const sourceAction = sourceActionsById.get(sourceActionId);
    const sourceSelection = selectionByActionId.get(sourceActionId);
    const sourceStatus = String(sourceSelection?.status ?? 'ready');
    return (
      window?.applied !== false &&
      (window.compilerBindingIdentity != null ||
        window.relationType === 'attack-chain-continuity-window') &&
      String(window.inputCommand ?? '') === 'normal-attack' &&
      String(window.actorId) === String(actorId) &&
      sourceAction != null &&
      !excluded.has(sourceActionId) &&
      Number(sourceAction.startMs) <= Number(timeMs) &&
      sourceSelection?.ready !== false &&
      !sourceStatus.includes('blocked') &&
      !sourceStatus.includes('skipped') &&
      !sourceStatus.includes('unresolved') &&
      Number.isFinite(Number(window.startsAtMs)) &&
      Number.isFinite(Number(window.endsAtMs)) &&
      Number(timeMs) < Number(window.endsAtMs)
    );
  });
}

function projectNormalAttackContinuationCandidates({
  entry,
  graph,
  ownerId,
  activeWindows,
  actions,
  selectionByActionId,
}) {
  const chains = (graph?.attackInputChains ?? []).filter(
    chain => chain.applied === true && Number(chain.ownerId) === Number(ownerId)
  );
  const mappingSegments =
    entry.attackInputSourceSegments ?? entry.attackInputSegments ?? [];
  return (activeWindows ?? []).flatMap(window => {
    const chainMatches = chains.flatMap(chain =>
      (chain.segments ?? [])
        .filter(segment => isNormalAttackWindowTarget(segment, window))
        .map(segment => ({ chain, segment }))
    );
    const mappingMatches = mappingSegments
      .filter(segment => isNormalAttackWindowTarget(segment, window))
      .map(segment => ({ chain: null, segment }));
    const matches = chainMatches.length > 0 ? chainMatches : mappingMatches;
    const uniqueMatches = [
      ...new Map(
        matches.map(match => [
          [
            match.chain?.chainIdentity ?? '',
            match.segment.sequenceIndex,
            match.segment.controlSkillId,
            match.segment.subSkillIndex ?? match.segment.selectedSubSkillIndex,
          ].join('|'),
          match,
        ])
      ).values(),
    ];
    if (uniqueMatches.length !== 1) return [];
    const match = uniqueMatches[0];
    const sourceAction = (actions ?? []).find(
      action => String(action.id) === String(window.sourceActionId)
    );
    if (!sourceAction) return [];
    const groupId =
      window.groupId ??
      sourceAction?.attackGroupId ??
      resolvePriorNormalAttackGroupId({
        actions,
        selectionByActionId,
        sourceAction,
        ownerId,
      });
    return [
      {
        ...window,
        applied: true,
        sourceKind: window.relationType ?? 'verified-special-continuation',
        chainIdentity: match.chain?.chainIdentity ?? null,
        sequenceIndex: Number(match.segment.sequenceIndex),
        controlSkillId: Number(match.segment.controlSkillId),
        subSkillIndex: Number(
          match.segment.subSkillIndex ?? match.segment.selectedSubSkillIndex
        ),
        groupId: groupId ?? null,
      },
    ];
  });
}

function isNormalAttackWindowTarget(segment, window) {
  return (
    Number(segment.controlSkillId) === Number(window.targetControlSkillId) &&
    Number(segment.subSkillIndex ?? segment.selectedSubSkillIndex) ===
      Number(window.targetSubSkillIndex) &&
    (window.targetSequenceIndex == null ||
      Number(segment.sequenceIndex) === Number(window.targetSequenceIndex)) &&
    (window.targetChainIdentity == null ||
      String(segment.attackInputChainIdentity ?? '') ===
        String(window.targetChainIdentity))
  );
}

function resolvePriorNormalAttackGroupId({
  actions,
  selectionByActionId,
  sourceAction,
  ownerId,
}) {
  if (!sourceAction) return null;
  return (
    (actions ?? [])
      .map((action, index) => ({
        action,
        index,
        selection: selectionByActionId.get(String(action.id)) ?? null,
      }))
      .filter(
        ({ action, selection }) =>
          action.attackInput &&
          Number(action.actorCharacterId ?? action.actor?.characterId) ===
            Number(ownerId) &&
          Number(action.startMs) <= Number(sourceAction.startMs) &&
          selection?.ready !== false
      )
      .sort(
        (left, right) =>
          Number(right.action.startMs) - Number(left.action.startMs) ||
          right.index - left.index
      )[0]?.action?.attackGroupId ?? null
  );
}

function resolveNormalAttackAuthorityChain({
  entry,
  graph,
  ownerId,
  actorId,
  timeMs,
  effectIntervals,
  variantRuntime,
  excludedActionIds,
  acceptedAction,
  acceptedSelection,
  continuationCandidates,
}) {
  const ownerChains = (graph?.attackInputChains ?? []).filter(
    chain =>
      chain.applied === true &&
      Number(chain.ownerId) === Number(ownerId) &&
      Number(chain.sourceSkillId) === Number(entry.skillId)
  );
  const continuationChainIdentities = [
    ...new Set(
      (continuationCandidates ?? [])
        .map(candidate => candidate.chainIdentity)
        .filter(Boolean)
    ),
  ];
  if (continuationChainIdentities.length === 1) {
    return (
      ownerChains.find(
        chain => chain.chainIdentity === continuationChainIdentities[0]
      ) ?? null
    );
  }
  const acceptedChainIdentity =
    acceptedSelection?.attackInputChainIdentity ??
    acceptedAction?.attackInputChainIdentity ??
    acceptedAction?.attackInput?.attackInputChainIdentity ??
    null;
  if (acceptedChainIdentity) {
    const acceptedChain = ownerChains.find(
      chain => String(chain.chainIdentity) === String(acceptedChainIdentity)
    );
    if (acceptedChain) return acceptedChain;
  }
  const eligible = ownerChains.filter(chain =>
    isRuntimeConditionSatisfied({
      condition: chain.stateCondition,
      actorId,
      timeMs,
      effectIntervals,
      variantRuntime,
      excludedActionIds,
    })
  );
  const conditionSelected = eligible.filter(
    chain =>
      !chain.entryPolicy || chain.entryPolicy.kind === 'condition-selected'
  );
  const defaults = eligible.filter(
    chain => chain.entryPolicy?.kind === 'default'
  );
  return conditionSelected.length === 1
    ? conditionSelected[0]
    : defaults.length === 1
      ? defaults[0]
      : eligible.length === 1
        ? eligible[0]
        : null;
}

function createVerifiedNormalAttackInputBlock({
  reason,
  reasons,
  phase,
  chain,
}) {
  return {
    status: 'blocked',
    reason,
    reasons: [...new Set((reasons ?? []).filter(Boolean))],
    entry: null,
    chain: chain ?? null,
    phase: phase ?? null,
  };
}

function collectActiveNormalAttackInputWindows({
  variantRuntime,
  actorId,
  timeMs,
}) {
  return (variantRuntime?.activeSwitchWindows ?? []).filter(
    window =>
      (window.compilerBindingIdentity != null ||
        window.relationType === 'attack-chain-continuity-window') &&
      (window.inputCommand == null ||
        String(window.inputCommand) === 'normal-attack') &&
      String(window.actorId) === String(actorId) &&
      Number(window.startsAtMs) <= Number(timeMs) &&
      Number(timeMs) < Number(window.endsAtMs)
  );
}

export function resolveDerivedAttackChainEntry({
  chain,
  graph,
  actorId,
  timeMs,
  variantRuntime,
  actions,
  runtimeSelections,
  includePendingPhaseTransition = false,
  sourceChainIdentity = null,
}) {
  if (!chain.segments?.length) return null;
  const quickEntries = collectActiveNormalAttackInputWindows({
    variantRuntime,
    actorId,
    timeMs,
  })
    .map(window => {
      const segment = chain.segments.find(
        candidate =>
          Number(candidate.controlSkillId) ===
            Number(window.targetControlSkillId) &&
          Number(candidate.subSkillIndex) ===
            Number(window.targetSubSkillIndex) &&
          (window.targetChainIdentity == null ||
            String(window.targetChainIdentity) === String(chain.chainIdentity))
      );
      return segment ? { window, segment } : null;
    })
    .filter(Boolean)
    .sort(
      (left, right) =>
        Number(right.window.startsAtMs) - Number(left.window.startsAtMs) ||
        Number(right.segment.sequenceIndex) -
          Number(left.segment.sequenceIndex) ||
        String(left.window.edgeIdentity).localeCompare(
          String(right.window.edgeIdentity)
        )
    );
  if (quickEntries.length > 0) {
    return {
      chain,
      sequenceIndex: Number(quickEntries[0].segment.sequenceIndex),
      sourceIdentity: quickEntries[0].window.sourceIdentity,
    };
  }

  const sourceChains = (graph?.attackInputChains ?? []).filter(
    candidate =>
      candidate.applied === true &&
      candidate.phaseTransition?.applied === true &&
      candidate.phaseTransition.inputCommand === 'normal-attack' &&
      candidate.phaseTransition.targetChainIdentity === chain.chainIdentity &&
      Number(candidate.ownerId) === Number(chain.ownerId) &&
      Number(candidate.sourceSkillId) === Number(chain.sourceSkillId) &&
      (sourceChainIdentity == null ||
        candidate.chainIdentity === sourceChainIdentity)
  );
  const selectionByActionId = new Map(
    (runtimeSelections ?? []).map(selection => [
      String(selection.actionId),
      selection,
    ])
  );
  let phaseEntry = null;
  for (const sourceChain of sourceChains) {
    const transition = sourceChain.phaseTransition;
    const sourceSegment = sourceChain.segments.find(
      segment =>
        Number(segment.sequenceIndex) === Number(transition.sourceSequenceIndex)
    );
    if (!sourceSegment) continue;
    const matched = (actions ?? []).find(action => {
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
        (includePendingPhaseTransition ||
          relativeFrame >= Number(transition.inputWindow?.startFrame)) &&
        relativeFrame < Number(transition.inputWindow?.endFrame)
      );
    });
    if (matched) {
      if (phaseEntry) return null;
      phaseEntry = {
        chain,
        sequenceIndex: 1,
        sourceIdentity: transition.sourceIdentity,
        sourceAction: matched,
        transition,
      };
    }
  }
  return phaseEntry;
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

export function isRuntimeConditionSatisfied({
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
