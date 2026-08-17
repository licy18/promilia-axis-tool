import { msToFrame } from '../domain/timebase';
import {
  getInstalledVerifiedCombatMechanicsPackage,
  getVerifiedActionVariantGraph,
  getVerifiedCombatActionMapping,
} from '../data/verifiedCombatMechanicsPackage';
import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization';
import {
  VERIFIED_NORMAL_ATTACK_INPUT_PHASES,
  createVerifiedNormalAttackStructuralForm,
  getVerifiedNormalAttackInputAuthorityDescriptor,
  matchVerifiedNormalAttackInput,
  resolveVerifiedNormalAttackInputPhase,
} from '../domain/verifiedNormalAttackInputAuthority';
import { projectActiveEffectStates } from './machineAxisEffectState';

export const MACHINE_AXIS_SEARCH_STATE_SCHEMA_VERSION = 1;
export const MACHINE_AXIS_SEARCH_STATE_CONTRACT = 'AzPrMachineAxisSearchState';

export function createSearchStateSnapshot({
  run,
  pendingRun = null,
  contract = null,
  currentFrame = null,
  fps = 60,
  stateKind = 'final',
} = {}) {
  const trace = run?.trace ?? {};
  const resolvedFrame =
    nonNegativeIntegerOrNull(currentFrame) ?? deriveExecutionNodeFrame(trace);
  const state =
    stateKind === 'initial'
      ? (trace.state?.initial ?? {})
      : (trace.state?.final ?? {});
  const timeMs = resolvedFrame * (1000 / fps);
  const horizonFrames =
    positiveIntegerOrNull(contract?.scenario?.durationFrames) ??
    msToFrame(trace.scenario?.durationMs ?? 0);
  const activeActorId = deriveActiveActorId(trace, {
    currentFrame: resolvedFrame,
    fps,
  });
  const snapshot = {
    schemaVersion: MACHINE_AXIS_SEARCH_STATE_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_SEARCH_STATE_CONTRACT,
    kind: 'azpr-machine-axis-search-state',
    currentFrame: resolvedFrame,
    timeMs: roundMetric(timeMs),
    remainingFrames: Math.max(0, horizonFrames - resolvedFrame),
    fps,
    activeActorId,
    actors: normalizeActorEnergy(state.actorEnergy ?? []),
    kibos: normalizeKiboEnergy(state.kiboEnergy ?? []),
    cooldowns: normalizeCooldownWindows(
      trace.readiness?.cooldownWindows ?? [],
      timeMs
    ),
    chargeCooldowns: normalizeChargeCooldownStates(
      trace.readiness?.cooldownState ?? []
    ),
    effects: normalizeEffectIntervals(
      trace.effects?.intervals ?? [],
      trace.effects?.events ?? [],
      timeMs
    ),
    tuningMarks: normalizeTuningMarkStacks(trace.resources?.tuningMarks ?? []),
    specialResources: normalizeSpecialResources({
      events: trace.resources?.special ?? [],
      initial: contract?.scenario?.initialRuntimeState?.specialResourcesByActor,
    }),
    attackChains: createSearchAttackChainProjection({
      trace,
      currentFrame: resolvedFrame,
      fps,
    }),
    pendingEvents: createSearchPendingEventProjection({
      run: pendingRun ?? run,
      currentFrame: resolvedFrame,
    }),
    enemy: normalizeEnemyState(state.enemy ?? {}),
    damage: {
      hpDamage: numberOrZero(run?.evaluation?.totals?.hpDamage),
      toughnessDamage: numberOrZero(run?.evaluation?.totals?.toughnessDamage),
      combatHitCount: numberOrZero(run?.evaluation?.totals?.combatHitCount),
      stateEventCount: numberOrZero(run?.evaluation?.totals?.stateEventCount),
    },
  };
  return snapshot;
}

export function createSearchLoopClosureProjection(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new TypeError('search state snapshot is required');
  }
  return {
    schemaVersion: MACHINE_AXIS_SEARCH_STATE_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_SEARCH_STATE_CONTRACT,
    kind: 'azpr-machine-axis-search-loop-closure-state',
    activeActorId: snapshot.activeActorId ?? null,
    actors: snapshot.actors ?? [],
    kibos: snapshot.kibos ?? [],
    cooldowns: snapshot.cooldowns ?? [],
    chargeCooldowns: snapshot.chargeCooldowns ?? [],
    effects: snapshot.effects ?? [],
    tuningMarks: snapshot.tuningMarks ?? [],
    specialResources: snapshot.specialResources ?? [],
    attackChains: snapshot.attackChains ?? [],
    pendingEvents: snapshot.pendingEvents ?? [],
    enemy: snapshot.enemy ?? null,
  };
}

export function createSearchAttackChainProjection({
  trace = {},
  currentFrame = 0,
  fps = 60,
  excludeActionsAtCurrentFrame = false,
} = {}) {
  const context = createNormalAttackAuthorityTraceContext({
    trace,
    currentFrame,
    fps,
    excludeActionsAtCurrentFrame,
  });
  const states = [];
  for (const actorId of context.actorIds) {
    const accepted = context.acceptedByActorId.get(actorId) ?? null;
    const mapping = resolveNormalAttackMapping({
      actorId,
      action: accepted?.action ?? null,
    });
    if (!mapping) {
      states.push(
        createUnresolvedNormalAttackProjection({
          actorId,
          accepted,
          reason: 'normal-attack-authority-mapping-unresolved',
        })
      );
      continue;
    }
    const phase = resolveVerifiedNormalAttackInputPhase({
      mapping,
      chain: resolveNormalAttackAuthorityChain({ mapping, accepted }),
      acceptedAction: accepted?.authorityAction ?? null,
      acceptedSelection: accepted?.authoritySelection ?? null,
      actorId,
      inputTimeMs: frameToMs(currentFrame, fps),
      fps,
      activeContinuationWindows: context.continuationWindows,
      specialContinuationCandidates: context.specialContinuationCandidates,
    });
    if (phase.phase === VERIFIED_NORMAL_ATTACK_INPUT_PHASES.IDLE) continue;
    states.push(
      projectNormalAttackAuthorityPhase({
        phase,
        mapping,
        accepted,
        currentFrame,
        fps,
      })
    );
  }
  return states.sort((left, right) =>
    left.actorId.localeCompare(right.actorId, 'en')
  );
}

export function createSearchNormalAttackInputProof({
  trace = {},
  fps = 60,
} = {}) {
  const actionById = new Map(
    (trace.actions ?? []).map(action => [String(action.id), action])
  );
  const selectionById = new Map(
    (trace.variants?.selections ?? []).map(selection => [
      String(selection.actionId),
      selection,
    ])
  );
  const acceptedByActorId = new Map();
  const executedActionIds = new Set();
  const issues = [];
  const decisions = [];
  for (const entry of orderExecutedTraceActions(trace)) {
    const action = actionById.get(String(entry.actionId));
    if (!action) continue;
    executedActionIds.add(String(action.id));
    if (action.type === 'switch') {
      acceptedByActorId.clear();
      continue;
    }
    if (action.type === 'kiboEvent') continue;
    const actorId = String(action.actorId ?? '');
    if (!actorId) continue;
    if (action.actionKind !== 'normal-attack') {
      const selection = selectionById.get(String(action.id)) ?? {};
      acceptedByActorId.set(actorId, {
        action,
        selection,
        authorityAction: adaptTraceActionForNormalAttackAuthority(
          action,
          selection
        ),
        authoritySelection:
          adaptTraceSelectionForNormalAttackAuthority(selection),
      });
      continue;
    }
    const selection = selectionById.get(String(action.id)) ?? {};
    const mapping = resolveNormalAttackMapping({ actorId, action });
    if (!mapping) {
      issues.push(
        normalAttackInputIssue({
          code: 'machine-axis-normal-attack-input-authority-mapping-unresolved',
          action,
          message: 'Normal-attack input mapping is unresolved',
        })
      );
      continue;
    }
    const accepted = acceptedByActorId.get(actorId) ?? null;
    const authorityAction = adaptTraceActionForNormalAttackAuthority(
      action,
      selection
    );
    const authoritySelection =
      adaptTraceSelectionForNormalAttackAuthority(selection);
    const runtimeContextDecision = createRuntimeContextNormalAttackDecision({
      action,
      selection: authoritySelection,
      mapping,
      accepted,
      actorId,
      fps,
    });
    if (runtimeContextDecision) {
      decisions.push({
        actionId: String(action.id),
        actorId,
        phase: runtimeContextDecision.phase,
        match: runtimeContextDecision.match,
      });
      if (runtimeContextDecision.match.accepted !== true) {
        issues.push(
          normalAttackInputIssue({
            code: 'machine-axis-normal-attack-input-authority-rejected',
            action,
            message: `Normal-attack runtime context rejected: ${runtimeContextDecision.match.reason ?? 'unresolved'}`,
            details: {
              reason: runtimeContextDecision.match.reason ?? null,
              phase: runtimeContextDecision.phase.phase ?? null,
              expected: runtimeContextDecision.match.expected ?? null,
              actual: runtimeContextDecision.match.actual ?? null,
              edgeIdentity: runtimeContextDecision.match.edgeIdentity ?? null,
            },
          })
        );
        continue;
      }
      acceptedByActorId.set(actorId, {
        action,
        selection,
        authorityAction,
        authoritySelection,
      });
      continue;
    }
    const phase = resolveVerifiedNormalAttackInputPhase({
      mapping,
      chain: resolveNormalAttackAuthorityChain({ mapping, accepted }),
      acceptedAction: accepted?.authorityAction ?? null,
      acceptedSelection: accepted?.authoritySelection ?? null,
      actorId,
      inputTimeMs: Number(action.startMs) || 0,
      fps,
      activeContinuationWindows: normalizeAuthorityContinuationWindows(
        trace.variants?.attackChainContinuityWindows,
        executedActionIds
      ),
      specialContinuationCandidates:
        normalizeAuthoritySpecialContinuationCandidates(
          trace.variants?.normalAttackSpecialContinuationCandidates,
          executedActionIds
        ),
    });
    const match = matchVerifiedNormalAttackInput({
      action: authorityAction,
      selection: authoritySelection,
      mapping,
      phase,
    });
    decisions.push({ actionId: String(action.id), actorId, phase, match });
    if (match.accepted !== true) {
      issues.push(
        normalAttackInputIssue({
          code: 'machine-axis-normal-attack-input-authority-rejected',
          action,
          message: `Normal-attack input rejected: ${match.reason ?? 'unresolved'}`,
          details: {
            reason: match.reason ?? null,
            phase: phase.phase ?? null,
            expected: match.expected ?? null,
            actual: match.actual ?? null,
          },
        })
      );
      continue;
    }
    acceptedByActorId.set(actorId, {
      action,
      selection,
      authorityAction,
      authoritySelection,
    });
  }
  const descriptor = getVerifiedNormalAttackInputAuthorityDescriptor();
  const proof = {
    schemaVersion: MACHINE_AXIS_SEARCH_STATE_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_SEARCH_STATE_CONTRACT,
    kind: 'azpr-machine-axis-search-normal-attack-input-proof',
    status:
      issues.length === 0
        ? 'normal-attack-input-authority-passed'
        : 'normal-attack-input-authority-rejected',
    passed: issues.length === 0,
    normalAttackInputAuthority: descriptor,
    decisionCount: decisions.length,
    decisions,
    issues,
  };
  return { ...proof, proofHash: hashCanonicalValue(proof) };
}

function createNormalAttackAuthorityTraceContext({
  trace,
  currentFrame,
  fps,
  excludeActionsAtCurrentFrame = false,
}) {
  const actionById = new Map(
    (trace.actions ?? []).map(action => [String(action.id), action])
  );
  const selectionById = new Map(
    (trace.variants?.selections ?? []).map(selection => [
      String(selection.actionId),
      selection,
    ])
  );
  const acceptedByActorId = new Map();
  const executedActionIds = new Set();
  for (const entry of orderExecutedTraceActions(trace)) {
    const action = actionById.get(String(entry.actionId));
    if (!action) continue;
    const actionStartFrame = msToFrame(Number(action.startMs) || 0, fps);
    if (
      actionStartFrame > Number(currentFrame) ||
      (excludeActionsAtCurrentFrame === true &&
        actionStartFrame === Number(currentFrame))
    ) {
      continue;
    }
    executedActionIds.add(String(action.id));
    if (action.type === 'switch') {
      acceptedByActorId.clear();
      continue;
    }
    if (action.type === 'kiboEvent') continue;
    const actorId = String(action.actorId ?? '');
    if (!actorId) continue;
    const selection = selectionById.get(String(action.id)) ?? {};
    acceptedByActorId.set(actorId, {
      action,
      selection,
      authorityAction: adaptTraceActionForNormalAttackAuthority(
        action,
        selection
      ),
      authoritySelection:
        adaptTraceSelectionForNormalAttackAuthority(selection),
    });
  }
  const continuationWindows = normalizeAuthorityContinuationWindows(
    trace.variants?.attackChainContinuityWindows,
    executedActionIds
  );
  const specialContinuationCandidates =
    normalizeAuthoritySpecialContinuationCandidates(
      trace.variants?.normalAttackSpecialContinuationCandidates,
      executedActionIds
    );
  const actorIds = new Set(acceptedByActorId.keys());
  const currentTimeMs = frameToMs(currentFrame, fps);
  for (const window of continuationWindows) {
    if (Number(window.endsAtMs) > currentTimeMs && window.actorId) {
      actorIds.add(String(window.actorId));
    }
  }
  for (const candidate of specialContinuationCandidates) {
    if (Number(candidate.endsAtMs) > currentTimeMs && candidate.actorId) {
      actorIds.add(String(candidate.actorId));
    }
  }
  return {
    acceptedByActorId,
    continuationWindows,
    specialContinuationCandidates,
    actorIds: [...actorIds].sort((left, right) =>
      left.localeCompare(right, 'en')
    ),
  };
}

function orderExecutedTraceActions(trace) {
  return [...(trace.executionPlan?.actions ?? [])]
    .filter(entry => entry.execute !== false)
    .sort(
      (left, right) =>
        Number(left.sourceSequenceIndex ?? 0) -
          Number(right.sourceSequenceIndex ?? 0) ||
        Number(left.startMs ?? 0) - Number(right.startMs ?? 0) ||
        String(left.actionId).localeCompare(String(right.actionId), 'en')
    );
}

function resolveNormalAttackMapping({ actorId, action = null }) {
  const actorCharacterId = parseActorCharacterId(actorId);
  if (action?.actionKind === 'normal-attack') {
    const mapping = getVerifiedCombatActionMapping({
      type: 'skill',
      skillId: action.skillId,
      actionKind: 'normal-attack',
      actorCharacterId,
    });
    if (mapping) return mapping;
  }
  const candidates = (
    getInstalledVerifiedCombatMechanicsPackage()?.actionMappings ?? []
  ).filter(
    mapping =>
      mapping.ownerKind === 'actor' &&
      Number(mapping.ownerId) === actorCharacterId &&
      mapping.actionKind === 'normal-attack'
  );
  return candidates.length === 1 ? candidates[0] : null;
}

function resolveNormalAttackAuthorityChain({ mapping, accepted }) {
  const chainIdentity =
    accepted?.selection?.attackInputChainIdentity ??
    accepted?.authoritySelection?.attackInputChainIdentity ??
    accepted?.action?.attackInputChainIdentity ??
    null;
  if (
    !chainIdentity ||
    String(chainIdentity) === String(mapping?.attackInputChainIdentity ?? '')
  ) {
    return null;
  }
  const actorCharacterId = parseActorCharacterId(
    accepted?.action?.actorId ?? accepted?.authorityAction?.actorId
  );
  const candidates = (
    getVerifiedActionVariantGraph()?.attackInputChains ?? []
  ).filter(
    chain =>
      String(chain?.chainIdentity ?? '') === String(chainIdentity) &&
      Number(chain?.ownerId) === Number(actorCharacterId) &&
      Number(chain?.sourceSkillId) === Number(mapping?.sourceSkillId)
  );
  return candidates.length === 1 ? candidates[0] : null;
}

function parseActorCharacterId(actorId) {
  const match = /^actor-(\d+)$/.exec(String(actorId ?? ''));
  return match ? Number(match[1]) : null;
}

function adaptTraceActionForNormalAttackAuthority(action, selection) {
  return {
    ...action,
    attackInput: {
      controlSkillId:
        selection?.controlSkillId ?? action?.controlSkillId ?? null,
      selectedSubSkillIndex:
        selection?.subSkillIndex ?? action?.subSkillIndex ?? null,
      linkTimingStatus:
        selection?.attackInputLinkTimingStatus ??
        action?.attackInputLinkTimingStatus ??
        null,
      linkWindow:
        selection?.attackInputLinkWindow ??
        action?.attackInputLinkWindow ??
        null,
      attackInputChainIdentity:
        selection?.attackInputChainIdentity ??
        action?.attackInputChainIdentity ??
        null,
    },
  };
}

function adaptTraceSelectionForNormalAttackAuthority(selection) {
  return {
    ...selection,
    executionControlSkillId:
      selection?.executionControlSkillId ?? selection?.controlSkillId ?? null,
    selectedSubSkillIndex:
      selection?.selectedSubSkillIndex ?? selection?.subSkillIndex ?? null,
  };
}

function createRuntimeContextNormalAttackDecision({
  action,
  selection,
  mapping,
  accepted,
  actorId,
  fps,
}) {
  if (selection?.sourceKind !== 'verified-input-context-variant') return null;

  const reasons = [];
  const actorCharacterId = parseActorCharacterId(actorId);
  const acceptedActionId = textOrNull(accepted?.action?.id);
  const acceptedActorId = textOrNull(accepted?.action?.actorId);
  const contextActionId = textOrNull(selection?.contextActionId);
  const edgeIdentity = textOrNull(selection?.edgeIdentity);
  const actual = {
    sequenceIndex: positiveIntegerOrNull(
      selection?.attackChainSequenceIndex ??
        selection?.attackSequenceIndex ??
        action?.attackSequenceIndex
    ),
    controlSkillId: positiveIntegerOrNull(
      selection?.executionControlSkillId ?? selection?.controlSkillId
    ),
    subSkillIndex: nonNegativeIntegerOrNull(
      selection?.selectedSubSkillIndex ?? selection?.subSkillIndex
    ),
    groupId: textOrNull(selection?.attackGroupId ?? action?.attackGroupId),
    chainIdentity: textOrNull(
      selection?.attackInputChainIdentity ?? action?.attackInputChainIdentity
    ),
    contextActionId,
  };
  const predecessorControlSkillId = positiveIntegerOrNull(
    accepted?.authoritySelection?.executionControlSkillId ??
      accepted?.authoritySelection?.controlSkillId ??
      accepted?.authorityAction?.controlSkillId ??
      accepted?.action?.controlSkillId ??
      accepted?.action?.skillId
  );
  const predecessorSubSkillIndex = nonNegativeIntegerOrNull(
    accepted?.authoritySelection?.selectedSubSkillIndex ??
      accepted?.authoritySelection?.subSkillIndex ??
      accepted?.authorityAction?.subSkillIndex ??
      accepted?.action?.subSkillIndex
  );
  const contextEdges = (
    getVerifiedActionVariantGraph()?.contextEdges ?? []
  ).filter(
    edge =>
      edge?.applied === true &&
      edge?.relationType === 'input-context-derived' &&
      edge?.inputCommand === 'normal-attack' &&
      edgeIdentity != null &&
      String(edge.edgeIdentity ?? '') === edgeIdentity
  );
  const edge = contextEdges.length === 1 ? contextEdges[0] : null;

  if (!acceptedActionId || contextActionId !== acceptedActionId) {
    reasons.push('normal-attack-runtime-context-predecessor-mismatch');
  }
  if (!acceptedActorId || acceptedActorId !== actorId) {
    reasons.push('normal-attack-runtime-context-actor-mismatch');
  }
  if (!edge) {
    reasons.push(
      contextEdges.length > 1
        ? 'normal-attack-runtime-context-edge-ambiguous'
        : 'normal-attack-runtime-context-edge-unresolved'
    );
  }
  if (edge) {
    if (Number(edge.ownerId) !== Number(actorCharacterId)) {
      reasons.push('normal-attack-runtime-context-owner-mismatch');
    }
    if (
      Number(edge.sourceControlSkillId) !== Number(predecessorControlSkillId) ||
      Number(edge.sourceSubSkillIndex) !== Number(predecessorSubSkillIndex)
    ) {
      reasons.push('normal-attack-runtime-context-source-mismatch');
    }
    if (
      Number(edge.targetControlSkillId) !== Number(mapping?.sourceSkillId) ||
      Number(edge.executionControlSkillId) !== Number(actual.controlSkillId) ||
      Number(edge.targetSubSkillIndex) !== Number(actual.subSkillIndex)
    ) {
      reasons.push('normal-attack-runtime-context-target-mismatch');
    }
    if (
      !textOrNull(selection?.sourceIdentity) ||
      String(selection.sourceIdentity) !== String(edge.sourceIdentity ?? '')
    ) {
      reasons.push('normal-attack-runtime-context-source-identity-mismatch');
    }
  }
  if (
    actual.sequenceIndex == null ||
    actual.controlSkillId == null ||
    actual.subSkillIndex == null
  ) {
    reasons.push('normal-attack-runtime-context-selection-incomplete');
  }

  const scheduling = selection?.contextualInputScheduling ?? null;
  const inputOffsetFrame = nonNegativeIntegerOrNull(
    scheduling?.inputOffsetFrame
  );
  const relativeFrame =
    accepted?.action?.startMs != null && action?.startMs != null
      ? msToFrame(Number(action.startMs) - Number(accepted.action.startMs), fps)
      : null;
  const windowStartFrame = nonNegativeIntegerOrNull(
    edge?.inputWindow?.startFrame
  );
  const windowEndFrame = positiveIntegerOrNull(edge?.inputWindow?.endFrame);
  if (
    scheduling?.applied !== true ||
    scheduling?.status !== 'verified-context-input-scheduling-ready' ||
    inputOffsetFrame == null ||
    relativeFrame == null
  ) {
    reasons.push('normal-attack-runtime-context-scheduling-unresolved');
  } else if (inputOffsetFrame !== relativeFrame) {
    reasons.push('normal-attack-runtime-context-scheduling-mismatch');
  }
  if (
    windowStartFrame == null ||
    windowEndFrame == null ||
    inputOffsetFrame == null ||
    inputOffsetFrame < windowStartFrame ||
    inputOffsetFrame >= windowEndFrame ||
    Number(scheduling?.inputWindow?.startFrame) !== windowStartFrame ||
    Number(scheduling?.inputWindow?.endFrame) !== windowEndFrame
  ) {
    reasons.push('normal-attack-runtime-context-window-mismatch');
  }

  const expected = {
    formIdentity: createVerifiedNormalAttackStructuralForm({ mapping })
      .formIdentity,
    chainIdentity: actual.chainIdentity,
    sequenceIndex: actual.sequenceIndex,
    controlSkillId: positiveIntegerOrNull(edge?.executionControlSkillId),
    subSkillIndex: nonNegativeIntegerOrNull(edge?.targetSubSkillIndex),
    groupId: actual.groupId,
    contextActionId: acceptedActionId,
  };
  const acceptedContext = reasons.length === 0;
  const phase = {
    schemaVersion: MACHINE_AXIS_SEARCH_STATE_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_SEARCH_STATE_CONTRACT,
    status: acceptedContext
      ? 'verified-normal-attack-runtime-context-selected'
      : 'verified-normal-attack-runtime-context-rejected',
    phase: acceptedContext
      ? VERIFIED_NORMAL_ATTACK_INPUT_PHASES.SUCCESSOR_WINDOW
      : VERIFIED_NORMAL_ATTACK_INPUT_PHASES.RECOVERY_LOCKED,
    actorId,
    formIdentity: expected.formIdentity,
    chainIdentity: actual.chainIdentity,
    mappingIdentity: mapping?.mappingIdentity ?? null,
    sourceSkillId: mapping?.sourceSkillId ?? null,
    sourceKind: 'verified-input-context-variant',
    sourceActionId: acceptedActionId,
    sourceIdentity: edge?.sourceIdentity ?? selection?.sourceIdentity ?? null,
    sourceGroupId:
      accepted?.authoritySelection?.attackGroupId ??
      accepted?.authorityAction?.attackGroupId ??
      null,
    edgeIdentity,
    window: edge?.inputWindow ?? null,
    relativeFrame,
    expected,
    reasons,
  };
  return {
    phase,
    match: {
      schemaVersion: MACHINE_AXIS_SEARCH_STATE_SCHEMA_VERSION,
      contractName: MACHINE_AXIS_SEARCH_STATE_CONTRACT,
      status: acceptedContext ? 'selected' : 'blocked',
      accepted: acceptedContext,
      sourceKind: 'verified-input-context-variant',
      formIdentity: expected.formIdentity,
      chainIdentity: actual.chainIdentity,
      sourceActionId: acceptedActionId,
      sourceIdentity: phase.sourceIdentity,
      edgeIdentity,
      expected,
      actual,
      reason: reasons[0] ?? null,
      reasons,
    },
  };
}

function normalizeAuthorityContinuationWindows(windows, executedActionIds) {
  return (windows ?? [])
    .filter(
      window =>
        executedActionIds.has(String(window?.sourceActionId ?? '')) &&
        window?.applied === true
    )
    .map(window => ({
      ...window,
      relationType: window.relationType ?? 'attack-chain-continuity-window',
    }));
}

function normalizeAuthoritySpecialContinuationCandidates(
  candidates,
  executedActionIds
) {
  return (candidates ?? []).filter(
    candidate =>
      executedActionIds.has(String(candidate?.sourceActionId ?? '')) &&
      candidate?.applied === true
  );
}

function projectNormalAttackAuthorityPhase({
  phase,
  mapping,
  accepted,
  currentFrame,
  fps,
}) {
  const form = createVerifiedNormalAttackStructuralForm({ mapping });
  const sequenceIndex = positiveIntegerOrNull(
    accepted?.authoritySelection?.attackSequenceIndex ??
      accepted?.authorityAction?.attackSequenceIndex
  );
  const sourceSegment = form.segments?.find(
    segment => Number(segment.sequenceIndex) === Number(sequenceIndex)
  );
  const predecessorStartFrame = accepted
    ? msToFrame(Number(accepted.action?.startMs) || 0, fps)
    : null;
  const windowFrames = projectAuthorityPhaseWindow({
    phase,
    predecessorStartFrame,
    fps,
  });
  return {
    actorId: String(phase.actorId ?? accepted?.action?.actorId ?? ''),
    authorityStatus: phase.status,
    authorityPhase: phase.phase,
    authoritySourceKind: phase.sourceKind,
    authorityPhaseProof: phase,
    authorityContractHash:
      getVerifiedNormalAttackInputAuthorityDescriptor().contractHash,
    formIdentity: phase.formIdentity,
    mappingIdentity: phase.mappingIdentity,
    chainIdentity: phase.expected?.chainIdentity ?? phase.chainIdentity ?? null,
    groupId:
      phase.expected?.groupId ??
      accepted?.authoritySelection?.attackGroupId ??
      accepted?.authorityAction?.attackGroupId ??
      null,
    sequenceIndex,
    sequenceTotal: form.segmentCount ?? null,
    nextSequenceIndex: phase.expected?.sequenceIndex ?? null,
    expectedInput: phase.expected ?? null,
    status: phase.phase,
    continuityStatus: phase.sourceKind,
    continuityActionId:
      phase.sourceActionId === accepted?.action?.id
        ? null
        : phase.sourceActionId,
    continuityEdgeIdentity: null,
    predecessorAcceptedIdentity: phase.sourceActionId ?? null,
    predecessorStartFrame,
    publicActionId: mapping.sourceSkillId ?? null,
    linkWindowStatus: phase.window ? 'applied' : 'unresolved',
    linkWindowStartFrame: windowFrames.startFrame,
    linkWindowEndFrame: windowFrames.endFrame,
    linkWindowSourceIdentity:
      phase.window?.sourceIdentity ?? phase.sourceIdentity ?? null,
    recoveryEndFrame:
      predecessorStartFrame != null && sourceSegment?.recoveryEndFrame != null
        ? predecessorStartFrame + Number(sourceSegment.recoveryEndFrame)
        : null,
    reasons: [...(phase.reasons ?? [])],
    currentFrame: Number(currentFrame),
  };
}

function projectAuthorityPhaseWindow({ phase, predecessorStartFrame, fps }) {
  if (
    Number.isFinite(Number(phase.window?.startMs)) &&
    Number.isFinite(Number(phase.window?.endMs))
  ) {
    return {
      startFrame: msToFrame(Number(phase.window.startMs), fps),
      endFrame: msToFrame(Number(phase.window.endMs), fps),
    };
  }
  const relativeStart = nonNegativeIntegerOrNull(phase.window?.startFrame);
  const relativeEnd = nonNegativeIntegerOrNull(phase.window?.endFrame);
  return {
    startFrame:
      predecessorStartFrame != null && relativeStart != null
        ? predecessorStartFrame + relativeStart
        : null,
    endFrame:
      predecessorStartFrame != null && relativeEnd != null
        ? predecessorStartFrame + relativeEnd
        : null,
  };
}

function createUnresolvedNormalAttackProjection({ actorId, accepted, reason }) {
  return {
    actorId,
    authorityStatus: 'verified-normal-attack-input-phase-unresolved',
    authorityPhase: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.RECOVERY_LOCKED,
    authoritySourceKind: 'verified-normal-attack-input-authority',
    authorityPhaseProof: null,
    authorityContractHash:
      getVerifiedNormalAttackInputAuthorityDescriptor().contractHash,
    formIdentity: null,
    mappingIdentity: null,
    chainIdentity: null,
    groupId: accepted?.authoritySelection?.attackGroupId ?? null,
    sequenceIndex: accepted?.authoritySelection?.attackSequenceIndex ?? null,
    sequenceTotal: null,
    nextSequenceIndex: null,
    expectedInput: null,
    status: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.RECOVERY_LOCKED,
    predecessorAcceptedIdentity: accepted?.action?.id ?? null,
    predecessorStartFrame: accepted
      ? msToFrame(Number(accepted.action?.startMs) || 0)
      : null,
    publicActionId: accepted?.action?.skillId ?? null,
    linkWindowStatus: 'unresolved',
    linkWindowStartFrame: null,
    linkWindowEndFrame: null,
    linkWindowSourceIdentity: null,
    recoveryEndFrame: null,
    reasons: [reason],
  };
}

function normalAttackInputIssue({ code, action, message, details = {} }) {
  return {
    code,
    path: `actions.${Number(action?.sourceSequenceIndex ?? 0)}`,
    message,
    severity: 'error',
    actionId: action?.id ?? null,
    actorId: action?.actorId ?? null,
    ...details,
  };
}

function frameToMs(frame, fps = 60) {
  return Number(((Number(frame) * 1000) / Number(fps || 60)).toFixed(6));
}

export function hashSearchState(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new TypeError('search state snapshot is required');
  }
  return hashCanonicalValue(snapshot);
}

export function searchStatesEquivalent(left, right) {
  if (!left || !right) return false;
  return hashSearchState(left) === hashSearchState(right);
}

export function deriveActiveActorId(
  trace,
  { currentFrame = null, fps = 60 } = {}
) {
  const controlled = trace?.controlledActors ?? {};
  const transitions = controlled.transitions ?? [];
  const boundaryTimeMs =
    currentFrame == null
      ? Number.POSITIVE_INFINITY
      : (Number(currentFrame) * 1000) / Number(fps || 60);
  const lastApplied = [...transitions]
    .filter(
      transition =>
        transition.applied === true &&
        Number(transition.timeMs) < boundaryTimeMs
    )
    .reverse()
    .find(Boolean);
  return (
    lastApplied?.afterActorId ??
    controlled.initialActorId ??
    trace?.scenario?.actorIds?.[0] ??
    null
  );
}

export function createSearchEventBoundaryNodes({
  run,
  durationFrames = null,
  burstWindowMs = null,
  variantGraph = getVerifiedActionVariantGraph(),
} = {}) {
  const trace = run?.trace ?? {};
  const fps = Number(trace.scenario?.frameRate) || 60;
  const horizonFrames =
    positiveIntegerOrNull(durationFrames) ??
    msToFrame(trace.scenario?.durationMs ?? 0);
  const nodes = [];
  const seen = new Set();
  const add = (frame, kind, details = {}) => {
    const frameNumber = Number(frame);
    if (!Number.isInteger(frameNumber) || frameNumber < 0) return;
    if (frameNumber > horizonFrames) return;
    const key = [
      kind,
      frameNumber,
      details.actionId ?? '',
      details.skillId ?? '',
      details.eventIdentity ?? '',
      details.effectId ?? '',
      details.markId ?? '',
      details.resourceIdentity ?? '',
      details.hitIdentity ?? '',
      details.windowIdentity ?? '',
      details.boundaryRole ?? '',
      details.source ?? '',
    ].join('|');
    if (seen.has(key)) return;
    seen.add(key);
    nodes.push({
      frame: frameNumber,
      resumeFrame: nonNegativeIntegerOrNull(details.resumeFrame) ?? frameNumber,
      timeMs: roundMetric(frameNumber * (1000 / fps)),
      kind,
      ...details,
      description: describeBoundary(kind, details, frameNumber),
    });
  };
  for (const entry of trace.executionPlan?.actions ?? []) {
    if (entry.execute === false) continue;
    const start = Number(entry.startMs);
    const span = Number(entry.durationMs);
    if (!Number.isFinite(start) || !Number.isFinite(span) || span <= 0) {
      continue;
    }
    add(msToFrame(start + span), 'action-end', {
      actionId: entry.actionId ?? null,
    });
  }
  for (const cooldownWindow of trace.readiness?.cooldownWindows ?? []) {
    const endMs = Number(cooldownWindow.endMs);
    if (!Number.isFinite(endMs)) continue;
    add(msToFrame(endMs), 'cd-ready', {
      actionId: cooldownWindow.actionId ?? null,
      skillId: cooldownWindow.skillId ?? null,
      ownerId: cooldownWindow.ownerId ?? null,
    });
  }
  for (const transaction of trace.readiness?.cooldownReductionTransactions ??
    []) {
    const frame = resolveEventFrame(transaction);
    if (frame == null) continue;
    add(frame, 'cooldown-reduction', {
      actionId: transaction.sourceActionId ?? null,
      skillId: transaction.targetSkillId ?? null,
      eventIdentity: transaction.eventIdentity ?? null,
      sourceSequencePath: transaction.sourceSequencePath ?? null,
      status: transaction.status ?? null,
      resumeFrame: frame + 1,
    });
  }
  for (const event of [
    ...(trace.effects?.events ?? []),
    ...(trace.resources?.tuningMarks ?? []),
    ...(trace.variants?.stateEvents ?? []),
    ...(trace.state?.targetEvents ?? []),
  ]) {
    const frame = resolveEventFrame(event);
    if (frame == null) continue;
    add(frame, 'state-change', {
      actionId: event.actionId ?? null,
      effectId: event.effectId ?? null,
      markId: event.markId ?? null,
      eventIdentity: event.eventIdentity ?? event.id ?? null,
      resumeFrame: frame + 1,
    });
  }
  for (const event of [
    ...(trace.resources?.actors ?? []),
    ...(trace.resources?.kibos ?? []),
    ...(trace.resources?.special ?? []),
    ...(trace.variants?.resourceEvents ?? []),
  ]) {
    if (!isMeaningfulResourceBoundary(event)) continue;
    const frame = resolveEventFrame(event);
    if (frame == null) continue;
    add(frame, 'resource-change', {
      actionId: event.actionId ?? null,
      actorId: event.actorId ?? null,
      resourceIdentity: resolveResourceEventIdentity(event),
      eventIdentity: event.eventIdentity ?? event.id ?? null,
      resumeFrame: frame + 1,
    });
  }
  for (const event of trace.damage ?? []) {
    const frame = resolveEventFrame(event);
    if (frame == null) continue;
    add(frame, 'hit-settlement', {
      actionId: event.actionId ?? null,
      hitIdentity: event.hitIdentity ?? null,
      resumeFrame: frame + 1,
    });
  }
  for (const selection of trace.variants?.selections ?? []) {
    for (const inputWindow of normalizeVariantWindows(selection)) {
      add(inputWindow.startFrame, 'window-boundary', {
        actionId: selection.actionId ?? null,
        windowIdentity: inputWindow.identity,
        boundaryRole: 'start',
        source: 'verified-action-window',
      });
      add(inputWindow.endFrame, 'window-boundary', {
        actionId: selection.actionId ?? null,
        windowIdentity: inputWindow.identity,
        boundaryRole: 'end',
        source: 'verified-action-window',
      });
    }
  }
  for (const action of trace.actions ?? []) {
    if (action?.actionKind !== 'normal-attack') continue;
    const actorId = String(action.actorId ?? '');
    const mapping = resolveNormalAttackMapping({ actorId, action });
    if (!mapping) continue;
    const form = createVerifiedNormalAttackStructuralForm({ mapping });
    const selection = (trace.variants?.selections ?? []).find(
      row => String(row.actionId) === String(action.id)
    );
    const sequenceIndex = positiveIntegerOrNull(
      selection?.attackSequenceIndex ?? action.attackSequenceIndex
    );
    const segment = form.segments?.find(
      row => Number(row.sequenceIndex) === Number(sequenceIndex)
    );
    if (!segment) continue;
    const actionStartFrame = msToFrame(Number(action.startMs) || 0, fps);
    if (segment.recoveryEndFrame != null) {
      add(
        actionStartFrame + Number(segment.recoveryEndFrame),
        'normal-attack-input-boundary',
        {
          actionId: action.id ?? null,
          windowIdentity: `${form.formIdentity}|recovery`,
          boundaryRole: 'recovery-end',
          source: 'verified-normal-attack-input-authority',
        }
      );
    }
    for (const [role, window] of [
      ['reopen-start', segment.reopenWindow],
      ['reopen-end', segment.reopenWindow],
    ]) {
      const offset =
        role === 'reopen-start' ? window?.startFrame : window?.endFrame;
      if (offset == null) continue;
      add(actionStartFrame + Number(offset), 'normal-attack-input-boundary', {
        actionId: action.id ?? null,
        windowIdentity: `${form.formIdentity}|${role}`,
        boundaryRole: role,
        source: 'verified-normal-attack-input-authority',
      });
    }
  }
  for (const inputWindow of createVerifiedActionWindowBoundaries({
    run,
    graph: variantGraph,
  })) {
    add(inputWindow.frame, 'window-boundary', inputWindow);
  }
  const windowFrames =
    burstWindowMs != null && Number.isFinite(Number(burstWindowMs))
      ? Math.max(1, Math.round((Number(burstWindowMs) * fps) / 1000))
      : null;
  if (windowFrames != null && windowFrames > 0) {
    for (let frame = 0; frame <= horizonFrames; frame += windowFrames) {
      add(frame, 'window-boundary', {
        source: 'objective-burst-window',
      });
    }
  }
  add(horizonFrames, 'horizon');
  return nodes.sort((left, right) => {
    if (left.frame !== right.frame) return left.frame - right.frame;
    return left.kind.localeCompare(right.kind, 'en');
  });
}

export function createSearchResourceThresholdBoundary({
  runs = [],
  resourceIdentity = null,
  currentValue = null,
  requiredValue = null,
  currentFrame = 0,
  durationFrames = null,
} = {}) {
  const normalizedIdentity = String(resourceIdentity ?? '').trim();
  const normalizedCurrent = finiteNumberOrNull(currentValue);
  const normalizedRequired = finiteNumberOrNull(requiredValue);
  const normalizedCurrentFrame = nonNegativeIntegerOrNull(currentFrame) ?? 0;
  const runList = (Array.isArray(runs) ? runs : [runs]).filter(Boolean);
  if (
    !normalizedIdentity ||
    normalizedCurrent == null ||
    normalizedRequired == null ||
    normalizedCurrent >= normalizedRequired ||
    runList.length === 0
  ) {
    return null;
  }
  const trajectories = runList.map(run =>
    createResourceTrajectory({
      run,
      resourceIdentity: normalizedIdentity,
      currentValue: normalizedCurrent,
      currentFrame: normalizedCurrentFrame,
      durationFrames,
    })
  );
  if (trajectories.some(trajectory => !trajectory.hasPositiveGrowth)) {
    return null;
  }
  const candidateFrames = [
    ...new Set(
      trajectories.flatMap(trajectory =>
        trajectory.events
          .filter(event => event.afterValue > event.beforeValue)
          .map(event => event.frame)
      )
    ),
  ].sort((left, right) => left - right);
  for (const frame of candidateFrames) {
    const resumeFrame = frame + 1;
    if (
      frame < normalizedCurrentFrame ||
      trajectories.some(trajectory => resumeFrame > trajectory.horizonFrames)
    ) {
      continue;
    }
    const values = trajectories.map(trajectory =>
      resourceValueAtFrame(trajectory, frame)
    );
    if (values.some(value => value < normalizedRequired)) continue;
    const sourceEvents = trajectories.map(trajectory =>
      [...trajectory.events]
        .reverse()
        .find(
          event => event.frame <= frame && event.afterValue > event.beforeValue
        )
    );
    const fps = trajectories[0].fps;
    return {
      frame,
      resumeFrame,
      timeMs: roundMetric(frame * (1000 / fps)),
      kind: 'resource-threshold',
      resourceIdentity: normalizedIdentity,
      currentValue: roundMetric(normalizedCurrent),
      requiredValue: roundMetric(normalizedRequired),
      reachedValues: values.map(roundMetric),
      source: 'candidate-resource-condition',
      growthSources: sourceEvents.map(event => ({
        eventIdentity: event?.eventIdentity ?? null,
        reason: event?.reason ?? null,
        sourceIdentity: event?.sourceIdentity ?? null,
      })),
      description: `${normalizedIdentity} reaches ${normalizedRequired} at frame ${frame}`,
    };
  }
  return null;
}

export function deriveExecutionNodeFrame(trace) {
  const plan = trace.executionPlan?.actions ?? [];
  return plan.reduce((latest, entry) => {
    if (entry.execute === false) return latest;
    const start = Number(entry.startMs);
    const duration = Number(entry.durationMs);
    const end = start + duration;
    const frame = Number.isFinite(end)
      ? duration <= 0
        ? msToFrame(start) + 1
        : msToFrame(end)
      : null;
    return frame != null && frame > latest ? frame : latest;
  }, 0);
}

export function createSearchPendingEventProjection({ run, currentFrame } = {}) {
  const resolvedFrame = nonNegativeIntegerOrNull(currentFrame) ?? 0;
  const trace = run?.trace ?? {};
  const startedActionIds = new Set(
    (run?.actionResolutions ?? [])
      .filter(
        resolution =>
          nonNegativeIntegerOrNull(resolution.startFrame) != null &&
          Number(resolution.startFrame) <= resolvedFrame
      )
      .map(resolution => String(resolution.actionId ?? ''))
      .filter(Boolean)
  );
  const candidates = [
    ...(trace.damage ?? []).map(event => ({ kind: 'hit', event })),
    ...(trace.effects?.events ?? []).map(event => ({ kind: 'effect', event })),
    ...(trace.resources?.tuningMarks ?? []).map(event => ({
      kind: 'tuning-mark',
      event,
    })),
    ...(trace.resources?.special ?? []).map(event => ({
      kind: 'special-resource',
      event,
    })),
    ...(trace.variants?.resourceEvents ?? []).map(event => ({
      kind: 'variant-resource',
      event,
    })),
    ...(trace.variants?.stateEvents ?? []).map(event => ({
      kind: 'variant-state',
      event,
    })),
    ...(trace.state?.targetEvents ?? []).map(event => ({
      kind: 'target-state',
      event,
    })),
    ...(trace.readiness?.cooldownReductionTransactions ?? []).map(event => ({
      kind: 'cooldown-reduction',
      event,
    })),
  ];
  const projection = [];
  for (const { kind, event } of candidates) {
    const actionId = String(event?.actionId ?? event?.sourceActionId ?? '');
    const frame = resolveEventFrame(event);
    if (
      !actionId ||
      !startedActionIds.has(actionId) ||
      frame == null ||
      frame <= resolvedFrame
    ) {
      continue;
    }
    projection.push({
      kind,
      frame,
      actionId,
      identity:
        event.hitIdentity ??
        event.effectId ??
        event.markId ??
        event.resourceIdentity ??
        event.payload?.resourceIdentity ??
        event.eventIdentity ??
        event.id ??
        null,
      phase: event.phase ?? event.eventPhase ?? null,
      sequence: event.runtimeSequenceIndex ?? event.sourceSequenceIndex ?? null,
      sourceSequencePath: event.sourceSequencePath ?? null,
    });
  }
  return projection.sort((left, right) => {
    if (left.frame !== right.frame) return left.frame - right.frame;
    const sequenceOrder =
      numberOrZero(left.sequence) - numberOrZero(right.sequence);
    if (sequenceOrder !== 0) return sequenceOrder;
    const kindOrder = left.kind.localeCompare(right.kind, 'en');
    return (
      kindOrder ||
      String(left.identity ?? '').localeCompare(
        String(right.identity ?? ''),
        'en'
      )
    );
  });
}

export function createVerifiedActionWindowBoundaries({ run, graph } = {}) {
  if (!graph || typeof graph !== 'object') return [];
  const resolutions = Array.isArray(run?.actionResolutions)
    ? run.actionResolutions
    : [];
  const windows = [];
  for (const resolution of resolutions) {
    const actionStartFrame = nonNegativeIntegerOrNull(resolution.startFrame);
    const controlSkillId = integerOrNull(resolution.resolvedControlSkillId);
    const subSkillIndex = nonNegativeIntegerOrNull(
      resolution.resolvedSubSkillIndex
    );
    if (
      actionStartFrame == null ||
      controlSkillId == null ||
      subSkillIndex == null
    ) {
      continue;
    }
    const actionId = resolution.actionId ?? null;
    for (const edge of graph.contextEdges ?? []) {
      if (
        edge?.applied !== true ||
        Number(edge.sourceControlSkillId) !== controlSkillId ||
        Number(edge.sourceSubSkillIndex) !== subSkillIndex
      ) {
        continue;
      }
      appendRelativeWindowBoundaries(windows, {
        actionId,
        actionStartFrame,
        inputWindow: edge.inputWindow,
        windowIdentity: edge.edgeIdentity,
        source: 'verified-context-edge',
        inputCommand: edge.inputCommand ?? null,
        targetControlSkillId:
          edge.executionControlSkillId ?? edge.targetControlSkillId ?? null,
        targetSubSkillIndex: edge.targetSubSkillIndex ?? null,
        sourceIdentity: edge.sourceIdentity ?? null,
      });
    }
    for (const chain of graph.attackInputChains ?? []) {
      if (chain?.applied !== true) continue;
      for (const segment of chain.segments ?? []) {
        if (
          segment?.applied !== true ||
          Number(segment.controlSkillId) !== controlSkillId ||
          Number(segment.subSkillIndex) !== subSkillIndex
        ) {
          continue;
        }
        const segmentIdentity = `${chain.chainIdentity}:segment:${segment.sequenceIndex}`;
        appendRelativeWindowBoundaries(windows, {
          actionId,
          actionStartFrame,
          inputWindow: segment.executionTiming?.occupancy?.linkWindow,
          windowIdentity: `${segmentIdentity}:link`,
          source: 'verified-attack-chain-link',
          sourceIdentity:
            segment.executionTiming?.occupancy?.linkWindow?.sourceIdentity ??
            segment.sourceIdentity ??
            null,
        });
        for (const [index, inputWindow] of (
          segment.executionTiming?.windows ?? []
        ).entries()) {
          appendRelativeWindowBoundaries(windows, {
            actionId,
            actionStartFrame,
            inputWindow,
            windowIdentity: `${segmentIdentity}:window:${index}`,
            source: 'verified-action-window',
            sourceIdentity:
              inputWindow.sourceIdentity ?? segment.sourceIdentity ?? null,
          });
        }
        if (
          Number(chain.phaseTransition?.sourceSequenceIndex) ===
          Number(segment.sequenceIndex)
        ) {
          appendRelativeWindowBoundaries(windows, {
            actionId,
            actionStartFrame,
            inputWindow: chain.phaseTransition?.inputWindow,
            windowIdentity: `${chain.chainIdentity}:phase-transition`,
            source: 'verified-attack-chain-transition',
            inputCommand: chain.phaseTransition?.inputCommand ?? null,
            targetChainIdentity:
              chain.phaseTransition?.targetChainIdentity ?? null,
            sourceIdentity: chain.phaseTransition?.sourceIdentity ?? null,
          });
        }
      }
    }
  }
  return dedupeVerifiedActionWindowBoundaries(windows).sort((left, right) => {
    if (left.frame !== right.frame) return left.frame - right.frame;
    if (left.boundaryRole !== right.boundaryRole) {
      return left.boundaryRole === 'start' ? -1 : 1;
    }
    return String(left.windowIdentity).localeCompare(
      String(right.windowIdentity),
      'en'
    );
  });
}

function appendRelativeWindowBoundaries(
  target,
  {
    actionId,
    actionStartFrame,
    inputWindow,
    windowIdentity,
    source,
    inputCommand = null,
    targetControlSkillId = null,
    targetSubSkillIndex = null,
    targetChainIdentity = null,
    sourceIdentity = null,
  } = {}
) {
  const startFrame = nonNegativeIntegerOrNull(inputWindow?.startFrame);
  const endFrame = nonNegativeIntegerOrNull(inputWindow?.endFrame);
  if (startFrame == null || endFrame == null || endFrame <= startFrame) {
    return;
  }
  const common = {
    actionId,
    windowIdentity,
    source,
    inputCommand,
    targetControlSkillId,
    targetSubSkillIndex,
    targetChainIdentity,
    sourceIdentity,
    interval: '[start,end)',
    relativeStartFrame: startFrame,
    relativeEndFrame: endFrame,
  };
  target.push({
    ...common,
    frame: actionStartFrame + startFrame,
    boundaryRole: 'start',
  });
  target.push({
    ...common,
    frame: actionStartFrame + endFrame,
    boundaryRole: 'end',
  });
}

function dedupeVerifiedActionWindowBoundaries(windows) {
  const byIdentity = new Map();
  for (const inputWindow of windows) {
    const key = `${inputWindow.actionId ?? ''}|${inputWindow.windowIdentity ?? ''}|${inputWindow.boundaryRole}|${inputWindow.frame}`;
    if (!byIdentity.has(key)) byIdentity.set(key, inputWindow);
  }
  return [...byIdentity.values()];
}

function normalizeActorEnergy(rows) {
  return rows
    .map(entry => ({
      actorId: String(entry.actorId ?? ''),
      sp: roundMetric(numberOrZero(entry.currentValue)),
      max: roundMetric(numberOrZero(entry.maxValue)),
    }))
    .filter(entry => entry.actorId)
    .sort((left, right) => left.actorId.localeCompare(right.actorId, 'en'));
}

function normalizeKiboEnergy(rows) {
  return rows
    .map(entry => ({
      actorId: String(entry.actorId ?? ''),
      kiboId: entry.kiboId ?? null,
      energy: roundMetric(numberOrZero(entry.currentValue)),
      max: roundMetric(numberOrZero(entry.maxValue)),
    }))
    .filter(entry => entry.actorId && entry.kiboId != null)
    .sort((left, right) => {
      const actorOrder = left.actorId.localeCompare(right.actorId, 'en');
      return actorOrder || Number(left.kiboId) - Number(right.kiboId);
    });
}

function normalizeCooldownWindows(rows, timeMs) {
  return rows
    .map(entry => ({
      actionId: entry.actionId ?? null,
      runtimeOwnerIdentity: entry.runtimeOwnerIdentity ?? null,
      ownerId: entry.ownerId ?? null,
      skillId: entry.skillId ?? null,
      chargeIndex: integerOrNull(entry.chargeIndex),
      cooldownCount: integerOrNull(entry.cooldownCount),
      endMs: roundMetric(numberOrZero(entry.endMs)),
      startMs: roundMetric(numberOrZero(entry.startMs)),
      status: entry.status ?? null,
      cooldownReductionTransactionIds: [
        ...(entry.cooldownReductionTransactionIds ?? []),
      ].sort(),
      active: Number(entry.endMs) > timeMs,
    }))
    .filter(entry => entry.active)
    .sort((left, right) => {
      const ownerOrder = String(left.ownerId ?? '').localeCompare(
        String(right.ownerId ?? ''),
        'en'
      );
      if (ownerOrder !== 0) return ownerOrder;
      const skillOrder = Number(left.skillId ?? 0) - Number(right.skillId ?? 0);
      return skillOrder || left.endMs - right.endMs;
    });
}

function normalizeChargeCooldownStates(rows) {
  return rows
    .filter(entry => entry.cooldownType === 'charge')
    .map(entry => ({
      runtimeOwnerIdentity: entry.runtimeOwnerIdentity ?? null,
      ownerId: entry.ownerId ?? null,
      skillId: entry.skillId ?? null,
      cooldownIdentity: entry.cooldownIdentity ?? null,
      fullCooldownMs: roundMetric(numberOrZero(entry.fullCooldownMs)),
      chargeMaxCount: integerOrNull(entry.chargeMaxCount),
      currentChargeCount: integerOrNull(entry.currentChargeCount),
      coolTimeMs: roundMetric(numberOrZero(entry.coolTimeMs)),
      sharedTimerRunning: entry.sharedTimerRunning === true,
      nextReadyAtMs:
        entry.nextReadyAtMs == null
          ? null
          : roundMetric(numberOrZero(entry.nextReadyAtMs)),
      lastSettlementTimeMs:
        entry.lastSettlementTimeMs == null
          ? null
          : roundMetric(numberOrZero(entry.lastSettlementTimeMs)),
      lastSettlementIdentity: entry.lastSettlementIdentity ?? null,
      lastCooldownReductionTransactionId:
        entry.lastCooldownReductionTransactionId ?? null,
      missingChargeSourceActionIds: [
        ...(entry.missingChargeSourceActionIds ?? []),
      ],
    }))
    .sort((left, right) => {
      const ownerOrder = String(left.runtimeOwnerIdentity ?? '').localeCompare(
        String(right.runtimeOwnerIdentity ?? ''),
        'en'
      );
      return (
        ownerOrder ||
        Number(left.cooldownIdentity ?? left.skillId ?? 0) -
          Number(right.cooldownIdentity ?? right.skillId ?? 0)
      );
    });
}

function normalizeEffectIntervals(rows, effectEvents, timeMs) {
  return projectActiveEffectStates({
    intervals: rows,
    effectEvents,
    timeMs,
  })
    .map(entry => ({
      effectId: entry.effectId,
      targetId: entry.targetId,
      stacks: numberOrZero(entry.stacks),
      startMs: roundMetric(numberOrZero(entry.startMs)),
      endMs: roundMetric(numberOrZero(entry.endMs)),
      modifiers: entry.modifiers,
      active: true,
    }))
    .sort((left, right) => {
      const effectOrder = String(left.effectId).localeCompare(
        String(right.effectId),
        'en'
      );
      if (effectOrder !== 0) return effectOrder;
      const targetOrder = String(left.targetId ?? '').localeCompare(
        String(right.targetId ?? ''),
        'en'
      );
      return targetOrder || left.endMs - right.endMs;
    });
}

function normalizeTuningMarkStacks(rows) {
  const byMark = new Map();
  for (const event of rows) {
    const key = `${String(event.profileKey ?? '')}|${Number(event.markId) || 0}`;
    if (event.after == null) continue;
    byMark.set(key, {
      profileKey: event.profileKey ?? null,
      markId: event.markId ?? null,
      stacks: numberOrZero(event.after),
    });
  }
  return [...byMark.values()].sort((left, right) => {
    const profileOrder = String(left.profileKey ?? '').localeCompare(
      String(right.profileKey ?? ''),
      'en'
    );
    return profileOrder || Number(left.markId ?? 0) - Number(right.markId ?? 0);
  });
}

function normalizeSpecialResources({ events = [], initial = [] } = {}) {
  const byIdentity = new Map();
  for (const entry of initial ?? []) {
    const identity = String(entry.resourceIdentity ?? '');
    if (!identity) continue;
    byIdentity.set(identity, {
      actorId: entry.actorId ?? null,
      resourceIdentity: identity,
      currentValue: roundMetric(numberOrZero(entry.currentValue)),
      maxValue: roundMetric(numberOrZero(entry.maxValue)),
    });
  }
  for (const event of events ?? []) {
    const payload = event.payload ?? event;
    const identity = String(payload.resourceIdentity ?? '');
    if (!identity) continue;
    const existing = byIdentity.get(identity) ?? {};
    byIdentity.set(identity, {
      actorId: event.actorId ?? existing.actorId ?? null,
      resourceIdentity: identity,
      currentValue: roundMetric(
        numberOrZero(
          payload.currentValue ?? payload.afterValue ?? payload.after
        )
      ),
      maxValue: roundMetric(
        numberOrZero(payload.maxValue ?? existing.maxValue)
      ),
    });
  }
  return [...byIdentity.values()].sort((left, right) =>
    left.resourceIdentity.localeCompare(right.resourceIdentity, 'en')
  );
}

function normalizeEnemyState(enemy) {
  return {
    hp: roundMetric(numberOrZero(enemy.hp)),
    maxHp: roundMetric(numberOrZero(enemy.maxHp)),
    toughness: roundMetric(numberOrZero(enemy.toughness)),
    maxToughness: roundMetric(numberOrZero(enemy.maxToughness)),
    inBreak: enemy.inBreak === true,
    breakPhase:
      enemy.breakPhase ?? (enemy.inBreak ? 'linear_recovery' : 'normal'),
    breakElapsedMs: roundMetric(numberOrZero(enemy.breakElapsedMs)),
    recoveryDelayRemainingMs: roundMetric(
      numberOrZero(enemy.recoveryDelayRemainingMs)
    ),
    defeated: Number(enemy.hp) <= 0,
    profileSourceIdentity: enemy.profileSourceIdentity ?? null,
  };
}

function resolveEventFrame(event) {
  const absoluteFrame = nonNegativeIntegerOrNull(event?.absoluteFrame);
  if (absoluteFrame != null) return absoluteFrame;
  const frameIndex = nonNegativeIntegerOrNull(event?.frameIndex);
  if (frameIndex != null) return frameIndex;
  const timeMs = Number(event?.timeMs);
  return Number.isFinite(timeMs) ? msToFrame(timeMs) : null;
}

function createResourceTrajectory({
  run,
  resourceIdentity,
  currentValue,
  currentFrame,
  durationFrames,
}) {
  const trace = run?.trace ?? {};
  const fps = Number(trace.scenario?.frameRate) || 60;
  const horizonFrames =
    positiveIntegerOrNull(durationFrames) ??
    msToFrame(trace.scenario?.durationMs ?? 0);
  const events = [
    ...(trace.resources?.actors ?? []),
    ...(trace.resources?.kibos ?? []),
    ...(trace.resources?.special ?? []),
    ...(trace.variants?.resourceEvents ?? []),
  ]
    .filter(event => resolveResourceEventIdentity(event) === resourceIdentity)
    .map(event => normalizeResourceTrajectoryEvent(event))
    .filter(Boolean)
    .filter(
      event => event.frame >= currentFrame && event.frame <= horizonFrames
    )
    .sort(compareResourceTrajectoryEvents);
  return {
    fps,
    horizonFrames,
    currentFrame,
    currentValue,
    events,
    hasPositiveGrowth: events.some(
      event => event.afterValue > event.beforeValue
    ),
  };
}

function resolveResourceEventIdentity(event) {
  const payload = event?.payload ?? event ?? {};
  const explicitIdentity = String(
    event?.resourceIdentity ?? payload.resourceIdentity ?? ''
  ).trim();
  if (explicitIdentity) return explicitIdentity;
  const kiboId = positiveIntegerOrNull(event?.kiboId ?? payload.kiboId);
  if (kiboId != null) return `kibo:${kiboId}:sp`;
  const resource = String(event?.resource ?? payload.resource ?? '');
  const actorId = String(event?.actorId ?? payload.actorId ?? '');
  const actorMatch = actorId.match(/^actor-(\d+)$/);
  return resource === 'sp' && actorMatch ? `actor:${actorMatch[1]}:sp` : null;
}

function normalizeResourceTrajectoryEvent(event) {
  const payload = event?.payload ?? event ?? {};
  const frame = resolveEventFrame(event);
  const beforeValue = finiteNumberOrNull(
    event?.beforeValue ?? payload.beforeValue
  );
  const afterValue = finiteNumberOrNull(
    event?.afterValue ??
      payload.afterValue ??
      event?.currentValue ??
      payload.currentValue
  );
  if (frame == null || beforeValue == null || afterValue == null) return null;
  return {
    frame,
    beforeValue,
    afterValue,
    runtimePhasePriority: integerOrNull(event?.runtimePhasePriority) ?? 0,
    runtimePriority: integerOrNull(event?.runtimePriority) ?? 0,
    runtimeSequenceIndex: integerOrNull(event?.runtimeSequenceIndex) ?? 0,
    eventIdentity:
      event?.eventIdentity ?? event?.id ?? event?.hitKey ?? payload.id ?? null,
    reason: event?.reason ?? payload.reason ?? payload.operation ?? null,
    sourceIdentity: event?.sourceIdentity ?? payload.sourceIdentity ?? null,
  };
}

function compareResourceTrajectoryEvents(left, right) {
  if (left.frame !== right.frame) return left.frame - right.frame;
  if (left.runtimePhasePriority !== right.runtimePhasePriority) {
    return left.runtimePhasePriority - right.runtimePhasePriority;
  }
  if (left.runtimePriority !== right.runtimePriority) {
    return left.runtimePriority - right.runtimePriority;
  }
  return left.runtimeSequenceIndex - right.runtimeSequenceIndex;
}

function resourceValueAtFrame(trajectory, frame) {
  let value = trajectory.currentValue;
  for (const event of trajectory.events) {
    if (event.frame > frame) break;
    value = event.afterValue;
  }
  return value;
}

function isMeaningfulResourceBoundary(event) {
  const payload = event?.payload ?? event ?? {};
  const reason = String(event?.reason ?? payload.reason ?? '');
  if (!reason.includes('auto-sp')) return true;
  const before = Number(event?.beforeValue ?? payload.beforeValue);
  const after = Number(event?.afterValue ?? payload.afterValue);
  const max = Number(event?.maxValue ?? payload.maxValue);
  if (!Number.isFinite(before) || !Number.isFinite(after)) return false;
  return Math.floor(before) !== Math.floor(after) || after === max;
}

function normalizeVariantWindows(selection) {
  const candidates = [
    ...(Array.isArray(selection?.inputWindows) ? selection.inputWindows : []),
    ...(Array.isArray(selection?.windows) ? selection.windows : []),
    selection?.inputWindow,
    selection?.linkWindow,
  ].filter(Boolean);
  return candidates
    .map((inputWindow, index) => ({
      startFrame: nonNegativeIntegerOrNull(
        inputWindow.startFrame ?? inputWindow.start
      ),
      endFrame: nonNegativeIntegerOrNull(
        inputWindow.endFrame ?? inputWindow.end
      ),
      identity:
        inputWindow.identity ??
        `${selection?.actionId ?? 'action'}:window:${index}`,
    }))
    .filter(
      inputWindow =>
        inputWindow.startFrame != null &&
        inputWindow.endFrame != null &&
        inputWindow.endFrame >= inputWindow.startFrame
    );
}

function describeBoundary(kind, details, frame) {
  switch (kind) {
    case 'action-end':
      return `action ${details.actionId ?? ''} ends at frame ${frame}`;
    case 'cd-ready':
      return `cooldown ready at frame ${frame} (skill ${details.skillId ?? ''})`;
    case 'cooldown-reduction':
      return `cooldown transaction ${details.eventIdentity ?? ''} settles at frame ${frame} (skill ${details.skillId ?? ''})`;
    case 'state-change':
      return `state change at frame ${frame} (effect ${details.effectId ?? ''} / mark ${details.markId ?? ''})`;
    case 'resource-change':
      return `resource change at frame ${frame} (${details.resourceIdentity ?? details.actorId ?? ''})`;
    case 'hit-settlement':
      return `hit settles at frame ${frame} (${details.hitIdentity ?? ''})`;
    case 'window-boundary':
      return `${details.source ?? 'action'} window ${details.boundaryRole ?? 'boundary'} at frame ${frame}`;
    case 'normal-attack-input-boundary':
      return `normal-attack input ${details.boundaryRole ?? 'boundary'} at frame ${frame}`;
    case 'horizon':
      return `scenario horizon at frame ${frame}`;
    default:
      return `${kind} at frame ${frame}`;
  }
}

function positiveIntegerOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function nonNegativeIntegerOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function integerOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function finiteNumberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function textOrNull(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function roundMetric(value) {
  return Math.round(Number(value) * 1000) / 1000;
}
