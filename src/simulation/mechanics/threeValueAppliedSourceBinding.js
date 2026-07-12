export const THREE_VALUE_APPLIED_SOURCE_BINDING_CONTRACT_NAME =
  'AzPrThreeValueAppliedSourceBinding';

export const THREE_VALUE_APPLIED_SOURCE_BINDING_CONTRACT_VERSION = 1;

export function createExplicitSelfEnergySourceBinding({
  sourceKind,
  events = [],
  expectedDelta,
} = {}) {
  const normalizedEvents = events.map((event, index) => ({
    eventIndex: nonNegativeIntegerOrNull(event?.eventIndex) ?? index,
    eventType: textOrNull(event?.eventType),
    actionId: textOrNull(event?.actionId),
    actorId: textOrNull(event?.actorId),
    timeMs: numberOrNull(event?.timeMs),
    resource: textOrNull(event?.resource),
    change: numberOrNull(event?.change),
    reason: textOrNull(event?.reason),
    confidence: textOrNull(event?.confidence),
  }));
  const issues = [];
  if (normalizedEvents.length === 0)
    issues.push('explicit-energy-events-missing');
  if (
    normalizedEvents.some(
      event =>
        !event.eventType ||
        !event.actionId ||
        !event.actorId ||
        event.timeMs == null ||
        !event.resource ||
        event.change == null ||
        !event.reason
    )
  ) {
    issues.push('explicit-energy-event-identity-incomplete');
  }
  const calculatedDelta = roundNumber(
    normalizedEvents.reduce((sum, event) => sum + (event.change ?? 0), 0)
  );
  if (!numbersMatch(calculatedDelta, expectedDelta)) {
    issues.push('explicit-energy-event-sum-mismatch');
  }

  return finalizeBinding({
    kind: 'explicit-self-energy-events',
    trackKey: 'selfEnergyChange',
    sourceKind,
    expectedDelta,
    identityValues: normalizedEvents,
    sources: { events: normalizedEvents },
    issues,
  });
}

export function createValidatedRuntimeSampleSourceBinding({
  trackKey,
  sourceKind,
  point = {},
  sampleValidation = point.validation,
} = {}) {
  const before = numberOrNull(sampleValidation?.before);
  const after = numberOrNull(sampleValidation?.after);
  const delta = numberOrNull(sampleValidation?.delta ?? point.delta);
  const sample = {
    runtimeSampleEventKey: textOrNull(point.runtimeSampleEventKey),
    captureSessionId: textOrNull(point.captureSessionId),
    eventIndex: nonNegativeIntegerOrNull(point.eventIndex),
    eventType: textOrNull(point.eventType),
    actionId: textOrNull(point.actionId),
    actorId: textOrNull(point.actorId),
    targetId: textOrNull(point.targetId),
    roleEntityId: textOrNull(point.roleEntityId),
    targetEntityId: textOrNull(point.targetEntityId),
    sourceElementConfigId: positiveIntegerOrNull(point.sourceElementConfigId),
    elementConfigId: positiveIntegerOrNull(point.elementConfigId),
    pathId: textOrNull(point.pathId),
    frameIndex: nonNegativeIntegerOrNull(point.frameIndex),
    timeMs: numberOrNull(point.timeMs),
    before,
    after,
    delta,
  };
  const issues = [];
  if (sampleValidation?.valid !== true) {
    issues.push('validated-runtime-sample-not-valid');
  }
  if (
    !sample.runtimeSampleEventKey ||
    !sample.captureSessionId ||
    !sample.eventType ||
    !sample.actionId ||
    !sample.actorId ||
    (sample.frameIndex == null && sample.timeMs == null) ||
    (sample.sourceElementConfigId == null && !sample.pathId) ||
    sample.before == null ||
    sample.after == null ||
    sample.delta == null
  ) {
    issues.push('validated-runtime-sample-identity-incomplete');
  }
  if (trackKey === 'selfEnergyChange' && !sample.roleEntityId) {
    issues.push('validated-runtime-sample-energy-owner-missing');
  }
  if (trackKey === 'enemyToughnessDamage' && !sample.targetEntityId) {
    issues.push('validated-runtime-sample-toughness-target-missing');
  }
  if (!numbersMatch(sample.delta, point.delta)) {
    issues.push('validated-runtime-sample-delta-mismatch');
  }

  return finalizeBinding({
    kind: 'validated-runtime-sample',
    trackKey,
    sourceKind,
    expectedDelta: point.delta,
    identityValues: sample,
    sources: { sample },
    issues,
  });
}

export function validateThreeValueAppliedSourceBinding({
  binding,
  trackKey,
  sourceKind,
  expectedDelta,
  eventDeltas = null,
  before = null,
  after = null,
  reportedDelta = null,
  sourceIds = null,
  action = null,
  hit = null,
} = {}) {
  if (!binding) return notProvidedValidation();
  const issues = [];
  const add = code => {
    if (!issues.includes(code)) issues.push(code);
  };
  if (
    binding.contractName !== THREE_VALUE_APPLIED_SOURCE_BINDING_CONTRACT_NAME ||
    Number(binding.contractVersion) !==
      THREE_VALUE_APPLIED_SOURCE_BINDING_CONTRACT_VERSION
  ) {
    add('applied-source-binding-contract-invalid');
  }
  if (binding.ready !== true) add('applied-source-binding-not-ready');
  if (!textOrNull(binding.identity))
    add('applied-source-binding-identity-missing');
  const identityValues =
    binding.kind === 'explicit-self-energy-events'
      ? (binding.sources?.events ?? [])
      : binding.kind === 'validated-runtime-sample'
        ? (binding.sources?.sample ?? {})
        : null;
  if (
    identityValues &&
    binding.identity !==
      createBindingIdentity(
        binding.kind,
        binding.trackKey,
        binding.sourceKind,
        identityValues
      )
  ) {
    add('applied-source-binding-identity-content-mismatch');
  }
  if (binding.trackKey !== trackKey)
    add('applied-source-binding-track-mismatch');
  if (sourceKind && binding.sourceKind !== sourceKind) {
    add('applied-source-binding-source-kind-mismatch');
  }
  if (!numbersMatch(binding.expectedDelta, expectedDelta)) {
    add('applied-source-binding-expected-delta-mismatch');
  }

  if (binding.kind === 'explicit-self-energy-events') {
    const boundEvents = binding.sources?.events ?? [];
    if (Array.isArray(eventDeltas)) {
      const boundDeltas = boundEvents.map(event => event.change);
      if (!numberArraysMatch(boundDeltas, eventDeltas)) {
        add('explicit-energy-event-deltas-mismatch');
      }
    }
    if (
      action &&
      boundEvents.some(
        event =>
          event.actionId !== textOrNull(action.id ?? action.actionId) ||
          event.actorId !== textOrNull(action.actorId)
      )
    ) {
      add('explicit-energy-event-action-mismatch');
    }
  } else if (binding.kind === 'validated-runtime-sample') {
    const sample = binding.sources?.sample ?? {};
    if (!numbersMatch(sample.before, before)) add('sample-before-mismatch');
    if (!numbersMatch(sample.after, after)) add('sample-after-mismatch');
    if (!numbersMatch(sample.delta, reportedDelta ?? expectedDelta)) {
      add('sample-reported-delta-mismatch');
    }
    if (
      action &&
      (sample.actionId !== textOrNull(action.id ?? action.actionId) ||
        sample.actorId !== textOrNull(action.actorId))
    ) {
      add('sample-action-mismatch');
    }
    if (
      hit &&
      sample.frameIndex != null &&
      nonNegativeIntegerOrNull(hit.frameIndex) !== sample.frameIndex
    ) {
      add('sample-frame-mismatch');
    }
    if (sourceIds) {
      if (
        !(sourceIds.captureSessionIds ?? []).includes(sample.captureSessionId)
      ) {
        add('sample-capture-session-mismatch');
      }
      if (
        sample.sourceElementConfigId != null &&
        !(sourceIds.elementConfigIds ?? []).includes(
          sample.sourceElementConfigId
        )
      ) {
        add('sample-element-config-mismatch');
      }
      if (sample.pathId && !(sourceIds.pathIds ?? []).includes(sample.pathId)) {
        add('sample-path-mismatch');
      }
    }
  } else {
    add('applied-source-binding-kind-unsupported');
  }

  const ready = issues.length === 0;
  return {
    required: true,
    ready,
    status: ready
      ? 'applied-source-binding-valid'
      : 'applied-source-binding-drift-detected',
    kind: binding.kind ?? null,
    identity: binding.identity ?? null,
    issueCodes: issues,
    issues: issues.map(code => ({ code })),
  };
}

function finalizeBinding({
  kind,
  trackKey,
  sourceKind,
  expectedDelta,
  identityValues,
  sources,
  issues,
}) {
  const ready = issues.length === 0;
  const identity = ready
    ? createBindingIdentity(kind, trackKey, sourceKind, identityValues)
    : null;
  return {
    schemaVersion: 1,
    contractName: THREE_VALUE_APPLIED_SOURCE_BINDING_CONTRACT_NAME,
    contractVersion: THREE_VALUE_APPLIED_SOURCE_BINDING_CONTRACT_VERSION,
    kind,
    trackKey,
    sourceKind: textOrNull(sourceKind),
    identity,
    expectedDelta: numberOrNull(expectedDelta),
    sources,
    status: ready
      ? 'applied-source-binding-ready'
      : 'applied-source-binding-invalid',
    ready,
    issueCodes: [...issues],
    issues: issues.map(code => ({ code })),
  };
}

function createBindingIdentity(kind, trackKey, sourceKind, identityValues) {
  return `azpr-applied-source-v1-${stableHash(
    JSON.stringify([kind, trackKey, sourceKind, identityValues])
  )}`;
}

function notProvidedValidation() {
  return {
    required: false,
    ready: false,
    status: 'applied-source-binding-not-provided',
    kind: null,
    identity: null,
    issueCodes: [],
    issues: [],
  };
}

function numberArraysMatch(left, right) {
  return (
    left.length === right.length &&
    left.every((value, index) => numbersMatch(value, right[index]))
  );
}

function numbersMatch(left, right) {
  const leftNumber = numberOrNull(left);
  const rightNumber = numberOrNull(right);
  return (
    leftNumber != null &&
    rightNumber != null &&
    Math.abs(leftNumber - rightNumber) <= 0.000001
  );
}

function stableHash(value) {
  let hash = 0x811c9dc5;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function roundNumber(value) {
  return Number(Number(value).toFixed(6));
}

function positiveIntegerOrNull(value) {
  const number = numberOrNull(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function nonNegativeIntegerOrNull(value) {
  const number = numberOrNull(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function numberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function textOrNull(value) {
  const text = String(value ?? '').trim();
  return text || null;
}
