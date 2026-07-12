const RUNTIME_SAMPLE_VALIDATION_TOLERANCE = 0.0001;

export const THREE_VALUE_MECHANISM_SAMPLE_ADAPTER = {
  key: 'azpr-three-value-mechanism-sample-adapter',
  version: 1,
  contractName: 'ValidatedRuntimeSample -> ThreeValueDelta',
};

export function createThreeValueMechanismSampleAdapterOutput({
  trackKey,
  actionResultTimeline = [],
  runtimeSampleContext = null,
} = {}) {
  const points =
    trackKey === 'selfEnergyChange'
      ? createValidatedSelfEnergySamplePoints({
          actionResultTimeline,
          runtimeSampleContext,
        })
      : trackKey === 'enemyToughnessDamage'
        ? createValidatedToughnessSamplePoints({
            actionResultTimeline,
            runtimeSampleContext,
          })
        : [];

  return {
    ...THREE_VALUE_MECHANISM_SAMPLE_ADAPTER,
    status:
      points.length > 0
        ? 'validated-runtime-samples-promoted'
        : 'no-validated-runtime-samples',
    trackKey,
    pointCount: points.length,
    promotedEventKeys: points.map(point => point.runtimeSampleEventKey),
    points,
    applied: points.length > 0,
  };
}

function createValidatedSelfEnergySamplePoints({
  actionResultTimeline,
  runtimeSampleContext,
}) {
  const events = runtimeSampleContext?.events ?? [];
  const promotedEventKeys = new Set();
  const points = [];

  for (const entry of actionResultTimeline) {
    const expectations =
      entry.selfEnergyChange?.runtimeFormulaProbe?.runtimeSamplingProbe
        ?.sampleExpectations ?? [];

    for (const expectation of expectations) {
      const match = expectation.runtimeSampleMatch;
      if (match?.validationStatus !== 'offline-runtime-sample-validated') {
        continue;
      }

      const event = events.find(candidate =>
        isValidatedSelfEnergyEventForExpectation({
          candidate,
          entry,
          expectation,
          match,
        })
      );
      const validation = validateSelfEnergyAppliedEvent(event, match);
      if (!validation.valid) {
        continue;
      }

      const runtimeSampleEventKey = createRuntimeSampleEventKey(event);
      if (promotedEventKeys.has(runtimeSampleEventKey)) {
        continue;
      }
      promotedEventKeys.add(runtimeSampleEventKey);

      points.push({
        sourceKind: 'azpr-validated-runtime-mechanism-sample',
        runtimeSampleEventKey,
        captureSessionId: event.captureSessionId ?? null,
        eventIndex: numberOrNull(event.eventIndex),
        eventType: event.eventType,
        actionId: entry.actionId,
        actionName: entry.actionName,
        actionType: entry.actionType,
        actorId: entry.actorId,
        actorName: entry.actorName,
        targetId: entry.targetId,
        targetName: entry.targetName,
        skillId: numberOrNull(entry.skillId),
        roleEntityId: event.roleEntityId ?? null,
        ownerEntityId: event.ownerEntityId ?? null,
        receiverEntityId: event.receiverEntityId ?? null,
        sourceElementConfigId: numberOrNull(event.sourceElementConfigId),
        elementConfigId: numberOrNull(event.elementConfigId),
        pathId: event.pathId ?? null,
        timeMs: numberOrNull(event.timeMs),
        frameIndex: numberOrNull(event.frameIndex),
        delta: validation.delta,
        spBefore: validation.before,
        spAfter: validation.after,
        baseDelta: numberOrNull(event.baseDelta ?? event.args?.baseDelta),
        argsDelta: numberOrNull(event.args?.delta),
        recoverTagType: numberOrNull(event.recoverTagType),
        confidence: 'runtime-sample-validated',
        precision: 'captured-applied-delta',
        calculationKind: 'recover-sp-runtime-sample-confirmed',
        calculationStatus: 'runtime-final-confirmed-recover-sp-sample',
        validation,
        applied: true,
      });
    }
  }

  return points;
}

function isValidatedSelfEnergyEventForExpectation({
  candidate,
  entry,
  expectation,
  match,
}) {
  if (candidate.eventType !== 'recover-sp-applied') {
    return false;
  }
  if (
    candidate.actionId !== entry.actionId ||
    candidate.actorId !== entry.actorId
  ) {
    return false;
  }
  if (!(match.captureSessionIds ?? []).includes(candidate.captureSessionId)) {
    return false;
  }

  const elementConfigId = numberOrNull(expectation.elementConfigId);
  const candidateElementConfigIds = [
    numberOrNull(candidate.sourceElementConfigId),
    numberOrNull(candidate.elementConfigId),
  ].filter(value => value != null);
  const pathId = expectation.pathId == null ? null : String(expectation.pathId);
  const elementMatches =
    elementConfigId != null &&
    candidateElementConfigIds.includes(elementConfigId);
  const pathMatches = pathId != null && candidate.pathId === pathId;

  return elementMatches || pathMatches;
}

function validateSelfEnergyAppliedEvent(event, match) {
  if (!event) {
    return createInvalidValidation('recover-sp-applied-event-missing');
  }
  if (
    !event.roleEntityId ||
    (numberOrNull(event.frameIndex) == null &&
      numberOrNull(event.timeMs) == null)
  ) {
    return createInvalidValidation('recover-sp-owner-or-timing-incomplete');
  }
  if (
    match.finalSpCurve?.roleEntityId !== event.roleEntityId ||
    numberOrNull(event.recoverTagType) !== 0
  ) {
    return createInvalidValidation('recover-sp-owner-or-tag-mismatch');
  }

  const before = numberOrNull(event.spBefore);
  const after = numberOrNull(event.spAfter);
  const delta = numberOrNull(event.spDeltaApplied);
  const expectedDelta = numberOrNull(match.finalSpCurve?.spDeltaApplied);
  if (
    before == null ||
    after == null ||
    delta == null ||
    expectedDelta == null
  ) {
    return createInvalidValidation('recover-sp-final-values-incomplete');
  }

  const observedDelta = roundRuntimeSampleNumber(after - before);
  if (
    !numbersMatch(observedDelta, delta, RUNTIME_SAMPLE_VALIDATION_TOLERANCE) ||
    !numbersMatch(expectedDelta, delta, RUNTIME_SAMPLE_VALIDATION_TOLERANCE)
  ) {
    return createInvalidValidation('recover-sp-final-values-mismatch', {
      before,
      after,
      delta,
      observedDelta,
      expectedDelta,
    });
  }

  return {
    status: 'runtime-sample-applied-delta-validated',
    valid: true,
    before,
    after,
    delta,
    observedDelta,
    expectedDelta,
    tolerance: RUNTIME_SAMPLE_VALIDATION_TOLERANCE,
  };
}

function createValidatedToughnessSamplePoints({
  actionResultTimeline,
  runtimeSampleContext,
}) {
  const actionResultsById = new Map(
    actionResultTimeline.map(entry => [entry.actionId, entry])
  );

  return (runtimeSampleContext?.events ?? [])
    .filter(event => event.eventType === 'toughness-damage-applied')
    .map(event => {
      const entry = actionResultsById.get(event.actionId);
      const validation = validateToughnessAppliedEvent(event, entry);
      if (!validation.valid) {
        return null;
      }

      return {
        sourceKind: 'azpr-validated-runtime-mechanism-sample',
        runtimeSampleEventKey: createRuntimeSampleEventKey(event),
        captureSessionId: event.captureSessionId ?? null,
        eventIndex: numberOrNull(event.eventIndex),
        eventType: event.eventType,
        actionId: entry.actionId,
        actionName: entry.actionName,
        actionType: entry.actionType,
        actorId: entry.actorId,
        actorName: entry.actorName,
        targetId: entry.targetId,
        targetName: entry.targetName,
        skillId: numberOrNull(entry.skillId),
        targetEntityId: event.targetEntityId ?? null,
        sourceElementConfigId: numberOrNull(event.sourceElementConfigId),
        elementConfigId: numberOrNull(event.elementConfigId),
        pathId: event.pathId ?? null,
        timeMs: numberOrNull(event.timeMs),
        frameIndex: numberOrNull(event.frameIndex),
        delta: validation.delta,
        toughnessBefore: validation.before,
        toughnessAfter: validation.after,
        confidence: 'runtime-sample-validated',
        precision: 'captured-applied-delta',
        calculationKind: 'toughness-runtime-sample-confirmed',
        calculationStatus: 'runtime-final-confirmed-toughness-sample',
        validation,
        applied: true,
      };
    })
    .filter(Boolean);
}

function validateToughnessAppliedEvent(event, entry) {
  if (!entry) {
    return createInvalidValidation('toughness-action-not-found');
  }
  if (event.actorId !== entry.actorId) {
    return createInvalidValidation('toughness-actor-mismatch');
  }
  if (!event.targetEntityId || event.targetId !== entry.targetId) {
    return createInvalidValidation('toughness-target-identity-incomplete');
  }
  if (
    (numberOrNull(event.frameIndex) == null &&
      numberOrNull(event.timeMs) == null) ||
    (numberOrNull(event.sourceElementConfigId) == null && !event.pathId)
  ) {
    return createInvalidValidation('toughness-source-or-timing-incomplete');
  }

  const before = numberOrNull(event.toughnessBefore);
  const after = numberOrNull(event.toughnessAfter);
  const delta = numberOrNull(event.toughnessDeltaApplied);
  if (before == null || after == null || delta == null) {
    return createInvalidValidation('toughness-final-values-incomplete');
  }
  if (delta <= 0) {
    return createInvalidValidation('toughness-applied-delta-must-be-positive');
  }

  const observedDelta = roundRuntimeSampleNumber(before - after);
  if (
    !numbersMatch(observedDelta, delta, RUNTIME_SAMPLE_VALIDATION_TOLERANCE)
  ) {
    return createInvalidValidation('toughness-final-values-mismatch', {
      before,
      after,
      delta,
      observedDelta,
    });
  }

  return {
    status: 'runtime-sample-applied-delta-validated',
    valid: true,
    before,
    after,
    delta,
    observedDelta,
    tolerance: RUNTIME_SAMPLE_VALIDATION_TOLERANCE,
  };
}

export function createRuntimeSampleEventKey(event = {}) {
  return [
    event.captureSessionId ?? 'capture-unknown',
    numberOrNull(event.eventIndex) ?? 'event-unknown',
    event.eventType ?? 'type-unknown',
  ].join(':');
}

function createInvalidValidation(reason, values = {}) {
  return {
    status: 'runtime-sample-applied-delta-invalid',
    valid: false,
    reason,
    ...values,
    tolerance: RUNTIME_SAMPLE_VALIDATION_TOLERANCE,
  };
}

function roundRuntimeSampleNumber(value) {
  return Number(Number(value).toFixed(6));
}
import { numberOrNull, numbersMatch } from '../../domain/contractValues';
