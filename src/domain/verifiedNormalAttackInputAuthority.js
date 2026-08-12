import {
  CANONICAL_HASH_ALGORITHM,
  hashCanonicalValue,
} from '../simulation/headless/canonicalSerialization.js';
import { msToFrame } from './timebase.js';

export const VERIFIED_NORMAL_ATTACK_INPUT_AUTHORITY_SCHEMA_VERSION = 1;
export const VERIFIED_NORMAL_ATTACK_INPUT_AUTHORITY_CONTRACT_NAME =
  'AzPrVerifiedNormalAttackInputAuthority';
export const VERIFIED_NORMAL_ATTACK_INPUT_AUTHORITY_POLICY_VERSION = 2;

export const VERIFIED_NORMAL_ATTACK_INPUT_PHASES = deepFreeze({
  SUCCESSOR_WINDOW: 'successor-window',
  RECOVERY_LOCKED: 'recovery-locked',
  REOPEN_WINDOW: 'reopen-window',
  IDLE: 'idle',
});

const AUTHORITY_DESCRIPTOR_SOURCE = deepFreeze({
  schemaVersion: VERIFIED_NORMAL_ATTACK_INPUT_AUTHORITY_SCHEMA_VERSION,
  contractName: VERIFIED_NORMAL_ATTACK_INPUT_AUTHORITY_CONTRACT_NAME,
  policyVersion: VERIFIED_NORMAL_ATTACK_INPUT_AUTHORITY_POLICY_VERSION,
  kind: 'azpr-verified-normal-attack-input-authority',
  hashAlgorithm: CANONICAL_HASH_ALGORITHM,
  intervalPolicy: 'right-open',
  specialContinuationPrecedence: 'special-before-direct',
  openerPolicy: 'a1-only-outside-exclusive-successor-windows',
  structuralFallbackPolicy:
    'verified-graph-then-unique-mapping-reachable-prefix',
  reachablePrefixPolicy:
    'unique-a1-exact-control-subskill-contiguous-adjacency',
  structuralFormFields: [
    'mappingIdentity',
    'sourceSkillId',
    'chainIdentity',
    'segment.sequenceIndex',
    'segment.controlSkillId',
    'segment.subSkillIndex',
    'segment.sourceIdentity',
    'segment.recoveryEndFrame',
    'segment.recoverySourceIdentity',
    'segment.reopenWindow.startFrame',
    'segment.reopenWindow.endFrame',
    'segment.reopenWindow.sourceIdentity',
    'adjacency.window.startFrame',
    'adjacency.window.endFrame',
    'adjacency.window.sourceIdentity',
    'adjacency.successor.sequenceIndex',
    'adjacency.successor.controlSkillId',
    'adjacency.successor.subSkillIndex',
    'adjacency.successor.sourceIdentity',
  ],
  phases: VERIFIED_NORMAL_ATTACK_INPUT_PHASES,
});

const AUTHORITY_DESCRIPTOR = deepFreeze({
  ...AUTHORITY_DESCRIPTOR_SOURCE,
  contractHash: hashCanonicalValue(AUTHORITY_DESCRIPTOR_SOURCE),
});

export function getVerifiedNormalAttackInputAuthorityDescriptor() {
  return AUTHORITY_DESCRIPTOR;
}

export function createVerifiedNormalAttackStructuralForm({
  mapping,
  chain = null,
} = {}) {
  const primary = createStructuralForm({ mapping, chain });
  if (
    chain &&
    chain?.entryPolicy?.kind !== 'derived-or-quick-entry' &&
    primary.status === 'verified-normal-attack-structural-form-unresolved' &&
    primary.reasons.some(reason =>
      [
        'normal-attack-adjacency-window-required',
        'normal-attack-adjacency-target-mismatch',
      ].includes(reason)
    )
  ) {
    return createStructuralForm({ mapping, chain: null });
  }
  return primary;
}

function createStructuralForm({ mapping, chain }) {
  const reasons = [];
  const mappingIdentity = textOrNull(mapping?.identity);
  const sourceSkillId = positiveIntegerOrNull(mapping?.sourceSkillId);
  const chainIdentity = textOrNull(
    chain?.chainIdentity ?? mapping?.attackInputChainIdentity
  );
  if (mapping?.actionKind !== 'normal-attack') {
    reasons.push('normal-attack-mapping-required');
  }
  if (!mappingIdentity) {
    reasons.push('normal-attack-mapping-identity-required');
  }
  if (sourceSkillId == null) {
    reasons.push('normal-attack-source-skill-id-required');
  }

  const sourceSegments = chain?.segments
    ? [...chain.segments].sort(
        (left, right) =>
          Number(left?.sequenceIndex) - Number(right?.sequenceIndex)
      )
    : collectMappingReachableSegments(mapping, reasons);
  if (sourceSegments.length === 0) {
    reasons.push('normal-attack-segments-required');
  }
  const segments = sourceSegments.map((segment, index) => {
    const sequenceIndex = positiveIntegerOrNull(segment?.sequenceIndex);
    const controlSkillId = positiveIntegerOrNull(segment?.controlSkillId);
    const subSkillIndex = nonNegativeIntegerOrNull(
      segment?.subSkillIndex ?? segment?.selectedSubSkillIndex
    );
    const sourceIdentity = textOrNull(segment?.sourceIdentity);
    if (sequenceIndex !== index + 1) {
      reasons.push('normal-attack-segment-sequence-not-contiguous');
    }
    if (controlSkillId == null || subSkillIndex == null) {
      reasons.push('normal-attack-segment-target-required');
    }
    if (!sourceIdentity) {
      reasons.push('normal-attack-segment-source-identity-required');
    }
    const recoveryEndFrame = resolveSegmentRecoveryEndFrame(segment);
    const recoverySourceIdentity =
      resolveSegmentRecoverySourceIdentity(segment);
    if (recoveryEndFrame == null || !recoverySourceIdentity) {
      reasons.push('normal-attack-segment-recovery-evidence-required');
    }
    return {
      sequenceIndex,
      controlSkillId,
      subSkillIndex,
      sourceIdentity,
      linkTimingStatus:
        textOrNull(segment?.linkTimingStatus) ??
        (resolveSegmentLinkWindow(segment) ? 'applied' : 'unresolved'),
      linkWindow: projectVerifiedWindow(resolveSegmentLinkWindow(segment)),
      recoveryEndFrame,
      recoverySourceIdentity,
      reopenWindow: projectVerifiedWindow(resolveSegmentReopenWindow(segment)),
      successor: null,
    };
  });

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const successor = segments[index + 1];
    const sourceSegment = sourceSegments[index];
    segment.successor = successor
      ? {
          sequenceIndex: successor.sequenceIndex,
          controlSkillId: successor.controlSkillId,
          subSkillIndex: successor.subSkillIndex,
          sourceIdentity: successor.sourceIdentity,
        }
      : null;
    const directSuccessorMatches =
      segment.linkWindow?.targetControlSkillId === successor.controlSkillId &&
      segment.linkWindow?.targetSubSkillIndex === successor.subSkillIndex;
    if (
      chain &&
      !directSuccessorMatches &&
      supportsDerivedReopenSuccessor({
        mapping,
        chain,
        sourceSegment,
        reopenWindow: segment.reopenWindow,
      })
    ) {
      segment.linkWindow = segment.reopenWindow;
      segment.linkTimingStatus = 'applied';
    }
    segment.reopenWindow = null;
    if (!segment.linkWindow) {
      reasons.push('normal-attack-adjacency-window-required');
      continue;
    }
    if (!segment.linkWindow.sourceIdentity) {
      reasons.push('normal-attack-adjacency-source-identity-required');
    }
    if (
      chain &&
      !directSuccessorMatches &&
      segment.linkWindow.kind !== 'attack-reopen-window'
    ) {
      reasons.push('normal-attack-adjacency-target-mismatch');
    }
  }

  const uniqueReasons = [...new Set(reasons)].sort((left, right) =>
    left.localeCompare(right, 'en')
  );
  if (uniqueReasons.length > 0) {
    return {
      schemaVersion: VERIFIED_NORMAL_ATTACK_INPUT_AUTHORITY_SCHEMA_VERSION,
      contractName: VERIFIED_NORMAL_ATTACK_INPUT_AUTHORITY_CONTRACT_NAME,
      status: 'verified-normal-attack-structural-form-unresolved',
      mappingIdentity,
      sourceSkillId,
      chainIdentity,
      formIdentity: null,
      segmentCount: segments.length,
      segments,
      reasons: uniqueReasons,
    };
  }

  const formProjection = {
    schemaVersion: VERIFIED_NORMAL_ATTACK_INPUT_AUTHORITY_SCHEMA_VERSION,
    policyVersion: VERIFIED_NORMAL_ATTACK_INPUT_AUTHORITY_POLICY_VERSION,
    mappingIdentity,
    sourceSkillId,
    chainIdentity,
    segments: segments.map(segment => ({
      sequenceIndex: segment.sequenceIndex,
      controlSkillId: segment.controlSkillId,
      subSkillIndex: segment.subSkillIndex,
      sourceIdentity: segment.sourceIdentity,
      linkTimingStatus: segment.linkTimingStatus,
      linkWindow: segment.linkWindow,
      recoveryEndFrame: segment.recoveryEndFrame,
      recoverySourceIdentity: segment.recoverySourceIdentity,
      reopenWindow: segment.reopenWindow,
      successor: segment.successor,
    })),
  };
  return {
    schemaVersion: VERIFIED_NORMAL_ATTACK_INPUT_AUTHORITY_SCHEMA_VERSION,
    contractName: VERIFIED_NORMAL_ATTACK_INPUT_AUTHORITY_CONTRACT_NAME,
    status: 'verified-normal-attack-structural-form-ready',
    mappingIdentity,
    sourceSkillId,
    chainIdentity,
    formIdentity: `normal-attack-form:${hashCanonicalValue(formProjection)}`,
    segmentCount: segments.length,
    segments,
    reasons: [],
  };
}

function supportsDerivedReopenSuccessor({
  mapping,
  chain,
  sourceSegment,
  reopenWindow,
}) {
  if (
    chain?.applied !== true ||
    chain?.entryPolicy?.kind !== 'derived-or-quick-entry' ||
    !textOrNull(chain?.entryPolicy?.sourceIdentity) ||
    chain?.stateCondition?.kind !== 'resource-at-least' ||
    !textOrNull(chain?.stateCondition?.resourceIdentity) ||
    !textOrNull(chain?.stateCondition?.sourceIdentity) ||
    chain?.segmentLimit?.kind !== 'resource-current-value' ||
    chain.segmentLimit.resourceIdentity !==
      chain.stateCondition.resourceIdentity ||
    !(Number(chain.segmentLimit.costPerSegment) > 0) ||
    !textOrNull(chain.segmentLimit.sourceIdentity)
  ) {
    return false;
  }
  const mappingOpeners = (mapping?.attackInputSegments ?? []).filter(
    candidate => positiveIntegerOrNull(candidate?.sequenceIndex) === 1
  );
  if (mappingOpeners.length !== 1) return false;
  const opener = mappingOpeners[0];
  const openerControlSkillId = positiveIntegerOrNull(opener?.controlSkillId);
  const openerSubSkillIndex = nonNegativeIntegerOrNull(
    opener?.subSkillIndex ?? opener?.selectedSubSkillIndex
  );
  const nextControlSkillId = positiveIntegerOrNull(
    sourceSegment?.nextControlSkillId
  );
  const rawLinkWindow = resolveSegmentLinkWindow(sourceSegment);
  const rawReopenWindow = resolveSegmentReopenWindow(sourceSegment);
  return (
    openerControlSkillId != null &&
    openerSubSkillIndex != null &&
    nextControlSkillId === openerControlSkillId &&
    positiveIntegerOrNull(rawLinkWindow?.targetControlSkillId) ===
      openerControlSkillId &&
    nonNegativeIntegerOrNull(rawLinkWindow?.targetSubSkillIndex) ===
      openerSubSkillIndex &&
    reopenWindow?.kind === 'attack-reopen-window' &&
    reopenWindow.allowAttack === true &&
    Boolean(reopenWindow.sourceIdentity) &&
    rawReopenWindow?.allowAttack === true &&
    (rawReopenWindow.allowedInputCommands ?? []).includes('normal-attack')
  );
}

function collectMappingReachableSegments(mapping, reasons) {
  const candidates = [
    ...(mapping?.attackInputSegments ??
      mapping?.attackInputSourceSegments ??
      []),
  ];
  const openers = candidates.filter(
    segment => positiveIntegerOrNull(segment?.sequenceIndex) === 1
  );
  if (openers.length !== 1) {
    if (openers.length > 1) {
      reasons.push('normal-attack-opener-target-ambiguous');
    }
    return openers.slice(0, 1);
  }
  const reachable = [openers[0]];
  const visited = new Set([openers[0]]);
  while (true) {
    const current = reachable.at(-1);
    const window = projectVerifiedWindow(resolveSegmentLinkWindow(current));
    if (!window || window.targetControlSkillId == null) break;
    const matches = candidates.filter(
      candidate =>
        !visited.has(candidate) &&
        positiveIntegerOrNull(candidate?.controlSkillId) ===
          window.targetControlSkillId &&
        nonNegativeIntegerOrNull(
          candidate?.subSkillIndex ?? candidate?.selectedSubSkillIndex
        ) === window.targetSubSkillIndex
    );
    if (matches.length !== 1) {
      reasons.push(
        matches.length > 1
          ? 'normal-attack-adjacency-target-ambiguous'
          : 'normal-attack-adjacency-target-unresolved'
      );
      break;
    }
    const next = matches[0];
    if (
      positiveIntegerOrNull(next.sequenceIndex) !==
      positiveIntegerOrNull(current.sequenceIndex) + 1
    ) {
      reasons.push('normal-attack-segment-sequence-not-contiguous');
      break;
    }
    reachable.push(next);
    visited.add(next);
  }
  return reachable;
}

export function resolveVerifiedNormalAttackInputPhase({
  mapping,
  chain = null,
  acceptedAction = null,
  acceptedSelection = null,
  actorId = null,
  inputTimeMs = 0,
  fps = 60,
  activeContinuationWindows = [],
  specialContinuationCandidates = [],
} = {}) {
  const form = createVerifiedNormalAttackStructuralForm({ mapping, chain });
  const normalizedActorId = textOrNull(
    actorId ?? acceptedAction?.actorId ?? acceptedSelection?.actorId
  );
  const special = resolveSpecialContinuationPhase({
    form,
    actorId: normalizedActorId,
    acceptedActionId: acceptedAction?.id ?? null,
    inputTimeMs,
    activeContinuationWindows,
    specialContinuationCandidates,
  });
  if (special) return special;

  if (!acceptedAction || acceptedAction.actionKind !== 'normal-attack') {
    return createIdlePhase({ form, actorId: normalizedActorId });
  }
  if (form.status !== 'verified-normal-attack-structural-form-ready') {
    return createPhase({
      phase: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.RECOVERY_LOCKED,
      form,
      actorId: normalizedActorId,
      sourceKind: 'verified-normal-attack-structural-form',
      sourceActionId: acceptedAction.id,
      sourceIdentity: null,
      reasons: form.reasons,
    });
  }

  const actual = readNormalAttackInputSelection({
    action: acceptedAction,
    selection: acceptedSelection,
    mapping,
  });
  const sourceSegment = form.segments.find(
    segment =>
      segment.sequenceIndex === actual.sequenceIndex &&
      segment.controlSkillId === actual.controlSkillId &&
      segment.subSkillIndex === actual.subSkillIndex
  );
  if (!sourceSegment) {
    return createPhase({
      phase: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.RECOVERY_LOCKED,
      form,
      actorId: normalizedActorId,
      sourceKind: 'verified-normal-attack-structural-form',
      sourceActionId: acceptedAction.id,
      sourceIdentity: null,
      reasons: ['normal-attack-accepted-segment-not-in-structural-form'],
    });
  }

  const window = sourceSegment.linkWindow;
  const linkTimingStatus = sourceSegment.linkTimingStatus;
  const relativeFrame = msToFrame(
    Number(inputTimeMs) - Number(acceptedAction.startMs ?? 0),
    fps
  );
  const base = {
    form,
    actorId: normalizedActorId,
    sourceKind: 'verified-normal-attack-direct-successor',
    sourceActionId: acceptedAction.id,
    sourceIdentity: window?.sourceIdentity ?? sourceSegment.sourceIdentity,
    sourceGroupId: actual.groupId,
    window,
    relativeFrame,
  };
  if (sourceSegment.successor) {
    const expected = createExpectedInput({
      form,
      segment: sourceSegment.successor,
      groupId: actual.groupId,
      sourceActionId: acceptedAction.id,
    });
    if (linkTimingStatus !== 'applied' || !window) {
      return createPhase({
        ...base,
        phase: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.RECOVERY_LOCKED,
        expected,
        reasons: ['normal-attack-successor-window-unresolved'],
      });
    }
    if (relativeFrame < window.startFrame) {
      return createPhase({
        ...base,
        phase: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.RECOVERY_LOCKED,
        expected,
        reasons: ['normal-attack-successor-window-not-open'],
      });
    }
    if (relativeFrame < window.endFrame) {
      return createPhase({
        ...base,
        phase: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.SUCCESSOR_WINDOW,
        expected,
        reasons: [],
      });
    }
    return createPostWindowPhase({
      base,
      form,
      sourceSegment,
      expected,
      relativeFrame,
      actorId: normalizedActorId,
      sourceActionId: acceptedAction.id,
    });
  }

  const opener = form.segments[0] ?? null;
  const expected = createExpectedInput({
    form,
    segment: opener,
    groupId: null,
    sourceActionId: acceptedAction.id,
  });
  return createPostWindowPhase({
    base,
    form,
    sourceSegment,
    expected,
    relativeFrame,
    actorId: normalizedActorId,
    sourceActionId: acceptedAction.id,
  });
}

function createPostWindowPhase({
  base,
  form,
  sourceSegment,
  expected,
  relativeFrame,
  actorId,
  sourceActionId,
}) {
  if (
    sourceSegment.reopenWindow &&
    isFrameInWindow(relativeFrame, sourceSegment.reopenWindow)
  ) {
    return createPhase({
      ...base,
      phase: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.REOPEN_WINDOW,
      window: sourceSegment.reopenWindow,
      expected: createExpectedInput({
        form,
        segment: form.segments[0] ?? null,
        groupId: null,
        sourceActionId,
      }),
      reasons: [],
    });
  }
  if (
    sourceSegment.recoveryEndFrame == null ||
    relativeFrame < sourceSegment.recoveryEndFrame
  ) {
    return createPhase({
      ...base,
      phase: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.RECOVERY_LOCKED,
      expected,
      reasons: ['normal-attack-recovery-not-complete'],
    });
  }
  return createIdlePhase({ form, actorId });
}

export function matchVerifiedNormalAttackInput({
  action = null,
  selection = null,
  mapping = null,
  phase = null,
} = {}) {
  if (!phase) {
    return createMatchResult({
      status: 'unresolved',
      accepted: false,
      reason: 'normal-attack-input-phase-required',
      phase,
      actual: null,
    });
  }
  const actual = readNormalAttackInputSelection({ action, selection, mapping });
  if (phase.phase === VERIFIED_NORMAL_ATTACK_INPUT_PHASES.RECOVERY_LOCKED) {
    return createMatchResult({
      status: 'blocked',
      accepted: false,
      reason: phase.reasons?.[0] ?? 'normal-attack-input-recovery-locked',
      phase,
      actual,
    });
  }
  const expected = phase.expected;
  if (!expected) {
    return createMatchResult({
      status: 'unresolved',
      accepted: false,
      reason: 'normal-attack-input-expected-target-unresolved',
      phase,
      actual,
    });
  }
  const contextAuthorized =
    isRuntimeContextInput(action) &&
    textOrNull(action?.runtimeContextActionId ?? selection?.contextActionId) ===
      textOrNull(phase.sourceActionId);
  const targetMatches =
    actual.sequenceIndex === expected.sequenceIndex &&
    actual.controlSkillId === expected.controlSkillId &&
    actual.subSkillIndex === expected.subSkillIndex;
  const groupMatches =
    expected.groupId == null ||
    actual.groupId === expected.groupId ||
    contextAuthorized;
  const chainMatches =
    expected.chainIdentity == null ||
    actual.chainIdentity == null ||
    actual.chainIdentity === expected.chainIdentity;
  if (!targetMatches || !groupMatches || !chainMatches) {
    return createMatchResult({
      status: 'blocked',
      accepted: false,
      reason:
        phase.phase === VERIFIED_NORMAL_ATTACK_INPUT_PHASES.SUCCESSOR_WINDOW
          ? 'normal-attack-successor-window-target-conflict'
          : 'normal-attack-opener-required-outside-successor-window',
      phase,
      actual,
    });
  }
  return createMatchResult({
    status:
      phase.phase === VERIFIED_NORMAL_ATTACK_INPUT_PHASES.SUCCESSOR_WINDOW
        ? 'selected'
        : 'default',
    accepted: true,
    reason: null,
    phase,
    actual,
  });
}

function resolveSpecialContinuationPhase({
  form,
  actorId,
  acceptedActionId,
  inputTimeMs,
  activeContinuationWindows,
  specialContinuationCandidates,
}) {
  const rawCandidates = [
    ...(activeContinuationWindows ?? [])
      .filter(
        window =>
          window?.applied === true &&
          window.relationType === 'attack-chain-continuity-window' &&
          window.inputCommand === 'normal-attack'
      )
      .map(window => ({
        actorId: window.actorId,
        sourceKind: window.relationType,
        sourceActionId: window.sourceActionId,
        sourceIdentity: window.sourceIdentity,
        chainIdentity: window.targetChainIdentity,
        sequenceIndex: window.targetSequenceIndex,
        controlSkillId: window.targetControlSkillId,
        subSkillIndex: window.targetSubSkillIndex,
        groupId: window.groupId ?? null,
        startsAtMs: window.startsAtMs,
        endsAtMs: window.endsAtMs,
      })),
    ...(specialContinuationCandidates ?? []),
  ].filter(
    candidate =>
      (actorId == null ||
        candidate?.actorId == null ||
        String(candidate.actorId) === actorId) &&
      acceptedActionId != null &&
      String(candidate?.sourceActionId ?? '') === String(acceptedActionId) &&
      Number(inputTimeMs) < Number(candidate?.endsAtMs)
  );
  if (rawCandidates.length === 0) return null;
  const candidates = rawCandidates
    .map(normalizeSpecialContinuationCandidate)
    .filter(Boolean);
  if (candidates.length !== rawCandidates.length) {
    return createPhase({
      phase: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.RECOVERY_LOCKED,
      form,
      actorId,
      sourceKind: 'verified-special-continuation-unresolved',
      sourceActionId: acceptedActionId,
      sourceIdentity: null,
      reasons: ['normal-attack-special-continuation-target-unresolved'],
    });
  }
  const latestStart = Math.max(
    ...candidates.map(candidate => candidate.startsAtMs)
  );
  const latest = candidates.filter(
    candidate => candidate.startsAtMs === latestStart
  );
  const targetKeys = new Set(
    latest.map(candidate =>
      [
        candidate.chainIdentity ?? '',
        candidate.sequenceIndex,
        candidate.controlSkillId,
        candidate.subSkillIndex,
        candidate.groupId ?? '',
      ].join('|')
    )
  );
  if (targetKeys.size !== 1) {
    return createPhase({
      phase: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.RECOVERY_LOCKED,
      form,
      actorId,
      sourceKind: 'verified-special-continuation-ambiguous',
      sourceActionId: null,
      sourceIdentity: null,
      reasons: ['normal-attack-special-continuation-target-ambiguous'],
    });
  }
  const selected = [...latest].sort((left, right) =>
    String(left.sourceIdentity).localeCompare(
      String(right.sourceIdentity),
      'en'
    )
  )[0];
  const expected = {
    formIdentity: form.formIdentity,
    chainIdentity: selected.chainIdentity,
    sequenceIndex: selected.sequenceIndex,
    controlSkillId: selected.controlSkillId,
    subSkillIndex: selected.subSkillIndex,
    groupId: selected.groupId,
    contextActionId: selected.sourceActionId,
  };
  return createPhase({
    phase:
      Number(inputTimeMs) < selected.startsAtMs
        ? VERIFIED_NORMAL_ATTACK_INPUT_PHASES.RECOVERY_LOCKED
        : VERIFIED_NORMAL_ATTACK_INPUT_PHASES.SUCCESSOR_WINDOW,
    form,
    actorId,
    sourceKind: selected.sourceKind,
    sourceActionId: selected.sourceActionId,
    sourceIdentity: selected.sourceIdentity,
    sourceGroupId: selected.groupId,
    window: {
      startMs: selected.startsAtMs,
      endMs: selected.endsAtMs,
      sourceIdentity: selected.sourceIdentity,
    },
    expected,
    reasons:
      Number(inputTimeMs) < selected.startsAtMs
        ? ['normal-attack-special-continuation-window-not-open']
        : [],
  });
}

function normalizeSpecialContinuationCandidate(candidate) {
  const sourceIdentity = textOrNull(candidate?.sourceIdentity);
  const sequenceIndex = positiveIntegerOrNull(
    candidate?.sequenceIndex ?? candidate?.targetSequenceIndex
  );
  const controlSkillId = positiveIntegerOrNull(
    candidate?.controlSkillId ?? candidate?.targetControlSkillId
  );
  const subSkillIndex = nonNegativeIntegerOrNull(
    candidate?.subSkillIndex ?? candidate?.targetSubSkillIndex
  );
  const startsAtMs = finiteNumberOrNull(candidate?.startsAtMs);
  const endsAtMs = finiteNumberOrNull(candidate?.endsAtMs);
  if (
    !sourceIdentity ||
    sequenceIndex == null ||
    controlSkillId == null ||
    subSkillIndex == null ||
    startsAtMs == null ||
    endsAtMs == null ||
    endsAtMs <= startsAtMs
  ) {
    return null;
  }
  return {
    actorId: textOrNull(candidate?.actorId),
    sourceKind:
      textOrNull(candidate?.sourceKind ?? candidate?.relationType) ??
      'verified-special-continuation',
    sourceActionId: textOrNull(candidate?.sourceActionId),
    sourceIdentity,
    chainIdentity: textOrNull(
      candidate?.chainIdentity ?? candidate?.targetChainIdentity
    ),
    sequenceIndex,
    controlSkillId,
    subSkillIndex,
    groupId: textOrNull(candidate?.groupId),
    startsAtMs,
    endsAtMs,
  };
}

function createIdlePhase({ form, actorId }) {
  return createPhase({
    phase: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.IDLE,
    form,
    actorId,
    sourceKind: 'verified-normal-attack-idle',
    sourceActionId: null,
    sourceIdentity: null,
    expected: createExpectedInput({
      form,
      segment: form.segments?.[0] ?? null,
      groupId: null,
      sourceActionId: null,
    }),
    reasons:
      form.status === 'verified-normal-attack-structural-form-ready'
        ? []
        : form.reasons,
  });
}

function createPhase({
  phase,
  form,
  actorId,
  sourceKind,
  sourceActionId,
  sourceIdentity,
  sourceGroupId = null,
  window = null,
  relativeFrame = null,
  expected = null,
  reasons = [],
}) {
  return {
    schemaVersion: VERIFIED_NORMAL_ATTACK_INPUT_AUTHORITY_SCHEMA_VERSION,
    contractName: VERIFIED_NORMAL_ATTACK_INPUT_AUTHORITY_CONTRACT_NAME,
    status: `verified-normal-attack-input-phase-${phase}`,
    phase,
    actorId,
    formIdentity: form.formIdentity,
    chainIdentity: form.chainIdentity,
    mappingIdentity: form.mappingIdentity,
    sourceSkillId: form.sourceSkillId,
    sourceKind,
    sourceActionId: textOrNull(sourceActionId),
    sourceIdentity: textOrNull(sourceIdentity),
    sourceGroupId: textOrNull(sourceGroupId),
    window,
    relativeFrame,
    expected,
    reasons: [...new Set(reasons ?? [])],
  };
}

function createExpectedInput({ form, segment, groupId, sourceActionId }) {
  if (!segment) return null;
  return {
    formIdentity: form.formIdentity,
    chainIdentity: form.chainIdentity,
    sequenceIndex: segment.sequenceIndex,
    controlSkillId: segment.controlSkillId,
    subSkillIndex: segment.subSkillIndex,
    groupId: textOrNull(groupId),
    contextActionId: textOrNull(sourceActionId),
  };
}

function createMatchResult({ status, accepted, reason, phase, actual }) {
  return {
    schemaVersion: VERIFIED_NORMAL_ATTACK_INPUT_AUTHORITY_SCHEMA_VERSION,
    contractName: VERIFIED_NORMAL_ATTACK_INPUT_AUTHORITY_CONTRACT_NAME,
    status,
    accepted,
    sourceKind: phase?.sourceKind ?? null,
    formIdentity: phase?.formIdentity ?? null,
    chainIdentity: phase?.chainIdentity ?? null,
    sourceActionId: phase?.sourceActionId ?? null,
    sourceIdentity: phase?.sourceIdentity ?? null,
    expected: phase?.expected ?? null,
    actual,
    reason,
    reasons: reason ? [reason] : [],
  };
}

function readNormalAttackInputSelection({ action, selection, mapping }) {
  const runtimeContext = isRuntimeContextInput(action);
  return {
    sequenceIndex: positiveIntegerOrNull(
      selection?.attackChainSequenceIndex ??
        selection?.attackSequenceIndex ??
        (runtimeContext
          ? (action?.attackInput?.chainSequenceIndex ??
            action?.attackInput?.sequenceIndex)
          : (action?.attackChainSequenceIndex ??
            action?.attackSequenceIndex ??
            action?.attackInput?.chainSequenceIndex ??
            action?.attackInput?.sequenceIndex))
    ),
    controlSkillId: positiveIntegerOrNull(
      selection?.executionControlSkillId ??
        selection?.controlSkillId ??
        action?.attackInput?.controlSkillId ??
        mapping?.controlSkillId
    ),
    subSkillIndex: nonNegativeIntegerOrNull(
      selection?.selectedSubSkillIndex ??
        action?.attackInput?.subSkillIndex ??
        action?.attackInput?.selectedSubSkillIndex ??
        action?.controlSubSkillIndex
    ),
    groupId: textOrNull(selection?.attackGroupId ?? action?.attackGroupId),
    chainIdentity: textOrNull(
      selection?.attackInputChainIdentity ??
        action?.attackInput?.attackInputChainIdentity ??
        action?.attackInputChainIdentity
    ),
    contextActionId: textOrNull(
      selection?.contextActionId ??
        action?.runtimeContextActionId ??
        action?.contextActionId
    ),
  };
}

function resolveSegmentLinkWindow(segment) {
  return (
    segment?.executionTiming?.occupancy?.linkWindow ??
    segment?.linkWindow ??
    null
  );
}

function resolveSegmentRecoveryEndFrame(segment) {
  return nonNegativeIntegerOrNull(
    segment?.executionTiming?.animation?.endFrame ??
      segment?.actionTiming?.animation?.endFrame ??
      segment?.animationDurationFrames ??
      segment?.animationDuration
  );
}

function resolveSegmentRecoverySourceIdentity(segment) {
  return textOrNull(
    segment?.executionTiming?.animation?.sourceIdentity ??
      segment?.actionTiming?.animation?.sourceIdentity ??
      segment?.animationDurationSourceIdentity
  );
}

function resolveSegmentReopenWindow(segment) {
  return (
    segment?.executionTiming?.windows ??
    segment?.actionTiming?.windows ??
    segment?.linkWindows ??
    []
  ).find(window => window?.kind === 'attack-reopen-window');
}

function isFrameInWindow(frame, window) {
  return frame >= window.startFrame && frame < window.endFrame;
}

function projectVerifiedWindow(window) {
  if (!window || typeof window !== 'object') return null;
  const startFrame = nonNegativeIntegerOrNull(window.startFrame);
  const endFrame = nonNegativeIntegerOrNull(window.endFrame);
  if (startFrame == null || endFrame == null || endFrame <= startFrame) {
    return null;
  }
  return {
    kind: textOrNull(window.kind),
    startFrame,
    endFrame,
    targetControlSkillId: positiveIntegerOrNull(window.targetControlSkillId),
    targetSubSkillIndex: nonNegativeIntegerOrNull(window.targetSubSkillIndex),
    allowAttack: window.allowAttack === true,
    sourceIdentity: textOrNull(window.sourceIdentity),
  };
}

function isRuntimeContextInput(action) {
  return (
    action?.attackInputIntent?.kind === 'public-normal-attack' &&
    action?.attackInputIntent?.selectionMode === 'runtime-context' &&
    action?.attackInputChainSelectionSource !== 'user-explicit'
  );
}

function positiveIntegerOrNull(value) {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
}

function nonNegativeIntegerOrNull(value) {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized >= 0 ? normalized : null;
}

function finiteNumberOrNull(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function textOrNull(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
