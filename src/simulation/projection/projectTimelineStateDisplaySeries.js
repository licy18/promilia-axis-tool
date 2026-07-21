const DEFAULT_CONTINUOUS_STEP_MS = 100;
const DEFAULT_SEMANTIC_CLUSTER_MS = 100;
const TIME_EPSILON_MS = 0.001;

const METRIC_KEY_BY_TRACK = Object.freeze({
  enemyHpDamage: 'enemyHp',
  enemyToughnessDamage: 'enemyToughness',
  selfEnergyChange: 'selfEnergy',
  kiboEnergyChange: 'kiboEnergy',
});

const DECREASE_TRACKS = new Set(['enemyHpDamage', 'enemyToughnessDamage']);

export function projectTimelineStateDisplaySeries({
  trackKey,
  points = [],
  initialValue = 0,
  maxValue = null,
  durationMs = 0,
  continuousStepMs = DEFAULT_CONTINUOUS_STEP_MS,
  semanticClusterMs = DEFAULT_SEMANTIC_CLUSTER_MS,
  resolveStatePointId = () => '',
} = {}) {
  const duration = nonNegativeNumber(durationMs);
  const initial = finiteNumber(initialValue, 0);
  const orderedPoints = (Array.isArray(points) ? points : [])
    .filter(point => point?.trackKey === trackKey)
    .map((point, index) => ({ ...point, __displayOrder: index }))
    .sort(compareSimulationPoints);
  const linePoints = [{ timeMs: 0, value: initial, kind: 'endpoint' }];
  const semanticCandidates = [];
  let continuousRun = null;
  let currentValue = initial;
  let previousSimulationTimeMs = 0;

  const flushContinuousRun = () => {
    if (!continuousRun) return;
    appendLinePoints(
      linePoints,
      simplifyContinuousRun(continuousRun, maxValue)
    );
    continuousRun = null;
  };

  for (const point of orderedPoints) {
    const timeMs = clampNumber(finiteNumber(point.timeMs, 0), 0, duration);
    const beforeValue = currentValue;
    const afterValue = resolvePointAfterValue({
      point,
      trackKey,
      currentValue,
    });
    const continuousKind = resolveContinuousPointKind(point);

    if (continuousKind) {
      const joinsCurrentRun =
        continuousRun &&
        continuousRun.kind === continuousKind &&
        timeMs - continuousRun.lastTimeMs <=
          Math.max(continuousStepMs, 0) + TIME_EPSILON_MS;
      if (!joinsCurrentRun) {
        flushContinuousRun();
        const startTimeMs = Math.max(
          previousSimulationTimeMs,
          timeMs - Math.max(continuousStepMs, 0),
          0
        );
        continuousRun = {
          kind: continuousKind,
          lastTimeMs: startTimeMs,
          points: [
            {
              timeMs: startTimeMs,
              value: beforeValue,
              kind: 'continuous-boundary',
            },
          ],
        };
      }
      continuousRun.points.push({
        timeMs,
        value: afterValue,
        kind: 'continuous-control',
        sourcePoint: point,
      });
      continuousRun.lastTimeMs = timeMs;
    } else {
      flushContinuousRun();
      appendLinePoints(linePoints, [
        { timeMs, value: beforeValue, kind: 'step-before' },
        { timeMs, value: afterValue, kind: 'step-after' },
      ]);
      if (
        Math.abs(afterValue - beforeValue) > Number.EPSILON ||
        isSemanticZeroDeltaPoint(point)
      ) {
        semanticCandidates.push(
          createSemanticCandidate({
            point,
            timeMs,
            beforeValue,
            afterValue,
            resolveStatePointId,
          })
        );
      }
    }

    currentValue = afterValue;
    previousSimulationTimeMs = timeMs;
  }

  flushContinuousRun();
  appendLinePoints(linePoints, [
    { timeMs: duration, value: currentValue, kind: 'endpoint' },
  ]);

  const resolvedMaxValue = resolveSeriesMaximum({
    maxValue,
    initialValue: initial,
    linePoints,
  });
  const normalizedLinePoints = linePoints.map(point =>
    normalizeDisplayPoint(point, duration, resolvedMaxValue)
  );
  const semanticNodes = clusterSemanticCandidates(
    semanticCandidates,
    semanticClusterMs
  ).map(node => normalizeSemanticNode(node, duration, resolvedMaxValue));

  return {
    trackKey,
    initialValue: initial,
    currentValue,
    maxValue: resolvedMaxValue,
    simulationPointCount: orderedPoints.length,
    displayPointCount: normalizedLinePoints.length,
    semanticNodeCount: semanticNodes.length,
    linePoints: normalizedLinePoints,
    semanticNodes,
    valueAtTime(timeMs) {
      return resolveDisplayValueAtTime(
        normalizedLinePoints,
        clampNumber(finiteNumber(timeMs, 0), 0, duration)
      );
    },
  };
}

function resolvePointAfterValue({ point, trackKey, currentValue }) {
  const explicitAfterValue = finiteNumberOrNull(point.afterValue);
  if (explicitAfterValue != null) return explicitAfterValue;
  const metricKey = METRIC_KEY_BY_TRACK[trackKey];
  const snapshotValue = finiteNumberOrNull(
    point.stateSnapshot?.after?.[metricKey]?.currentValue
  );
  if (snapshotValue != null) return snapshotValue;
  const delta = finiteNumber(resolveTrackDelta(point, trackKey), 0);
  return DECREASE_TRACKS.has(trackKey)
    ? Math.max(0, currentValue - delta)
    : currentValue + delta;
}

function resolveTrackDelta(point, trackKey) {
  if (trackKey === 'enemyHpDamage') return point.hpDelta ?? point.delta;
  if (trackKey === 'enemyToughnessDamage') {
    return point.toughnessDelta ?? point.delta;
  }
  return point.energyDelta ?? point.delta;
}

function resolveContinuousPointKind(point) {
  const hitKey = String(point.hitKey ?? '');
  if (hitKey.startsWith('auto-sp-')) return 'auto-sp';
  if (hitKey.startsWith('verified-normal-toughness-recovery-')) {
    return 'normal-toughness-recovery';
  }
  if (hitKey.startsWith('verified-break-linear-recovery-')) {
    return 'break-linear-recovery';
  }
  if (hitKey.startsWith('verified-break-end-wait-')) {
    return 'break-end-wait';
  }
  return null;
}

function isSemanticZeroDeltaPoint(point) {
  return (
    point.semantic === true ||
    String(point.hitKey ?? '').startsWith('verified-break-exit-')
  );
}

function simplifyContinuousRun(run, maxValue) {
  const points = run.points;
  if (points.length <= 2) return points;
  const simplified = [];
  const tolerance = Math.max(
    0.00001,
    Math.abs(finiteNumber(maxValue, 0)) * 0.000001
  );
  for (const point of points) {
    simplified.push(point);
    while (
      simplified.length >= 3 &&
      isCollinearWithinTolerance(
        simplified.at(-3),
        simplified.at(-2),
        simplified.at(-1),
        tolerance
      )
    ) {
      simplified.splice(-2, 1);
    }
  }
  return simplified;
}

function isCollinearWithinTolerance(left, middle, right, tolerance) {
  const duration = right.timeMs - left.timeMs;
  if (duration <= TIME_EPSILON_MS) return false;
  const ratio = (middle.timeMs - left.timeMs) / duration;
  const expected = left.value + (right.value - left.value) * ratio;
  return Math.abs(expected - middle.value) <= tolerance;
}

function appendLinePoints(target, points) {
  for (const point of points) {
    const previous = target.at(-1);
    if (
      previous &&
      Math.abs(previous.timeMs - point.timeMs) <= TIME_EPSILON_MS &&
      Math.abs(previous.value - point.value) <= Number.EPSILON
    ) {
      previous.kind = point.kind ?? previous.kind;
      previous.sourcePoint = point.sourcePoint ?? previous.sourcePoint;
      continue;
    }
    target.push(point);
  }
}

function createSemanticCandidate({
  point,
  timeMs,
  beforeValue,
  afterValue,
  resolveStatePointId,
}) {
  const statePointId = resolveStatePointId(point) ?? '';
  return {
    id: point.sourceDeltaId ?? `${point.trackKey}-${timeMs}`,
    sourceDeltaIds: point.sourceDeltaId ? [point.sourceDeltaId] : [],
    statePointId,
    statePointIds: statePointId ? [statePointId] : [],
    actionId: point.actionId ?? '',
    hitKey: point.hitKey ?? '',
    hitKeys: point.hitKey ? [point.hitKey] : [],
    eventKinds: point.operation ? [point.operation] : [],
    timeMs,
    frameIndex: finiteNumber(point.frameIndex, 0),
    beforeValue,
    afterValue,
    currentValue: afterValue,
    delta: afterValue - beforeValue,
    eventCount: 1,
  };
}

function clusterSemanticCandidates(candidates, clusterWindowMs) {
  const clusters = [];
  for (const candidate of candidates) {
    const previous = clusters.at(-1);
    const sameAction =
      Boolean(candidate.actionId) && candidate.actionId === previous?.actionId;
    const sameFrame = candidate.frameIndex === previous?.endFrameIndex;
    const withinActionCluster =
      sameAction &&
      candidate.timeMs - previous.endTimeMs <= Math.max(clusterWindowMs, 0);
    if (previous && sameAction && (sameFrame || withinActionCluster)) {
      previous.id = candidate.id;
      previous.sourceDeltaIds.push(...candidate.sourceDeltaIds);
      previous.statePointIds.push(...candidate.statePointIds);
      previous.hitKeys.push(...candidate.hitKeys);
      previous.eventKinds.push(...candidate.eventKinds);
      previous.statePointId = candidate.statePointId || previous.statePointId;
      previous.hitKey = candidate.hitKey || previous.hitKey;
      previous.timeMs = candidate.timeMs;
      previous.frameIndex = candidate.frameIndex;
      previous.endTimeMs = candidate.timeMs;
      previous.endFrameIndex = candidate.frameIndex;
      previous.afterValue = candidate.afterValue;
      previous.currentValue = candidate.currentValue;
      previous.delta = previous.afterValue - previous.beforeValue;
      previous.eventCount += 1;
      continue;
    }
    clusters.push({
      ...candidate,
      startTimeMs: candidate.timeMs,
      endTimeMs: candidate.timeMs,
      startFrameIndex: candidate.frameIndex,
      endFrameIndex: candidate.frameIndex,
    });
  }
  return clusters.map(cluster => ({
    ...cluster,
    sourceDeltaIds: uniqueValues(cluster.sourceDeltaIds),
    statePointIds: uniqueValues(cluster.statePointIds),
    hitKeys: uniqueValues(cluster.hitKeys),
    eventKinds: uniqueValues(cluster.eventKinds),
  }));
}

function normalizeDisplayPoint(point, durationMs, maxValue) {
  return {
    ...point,
    xPercent: toPercent(point.timeMs, durationMs),
    yPercent: 100 - toPercent(point.value, maxValue),
    ratio: clampNumber(point.value / maxValue, 0, 1),
  };
}

function normalizeSemanticNode(node, durationMs, maxValue) {
  return {
    ...node,
    xPercent: toPercent(node.timeMs, durationMs),
    yPercent: 100 - toPercent(node.currentValue, maxValue),
    ratio: clampNumber(node.currentValue / maxValue, 0, 1),
  };
}

function resolveSeriesMaximum({ maxValue, initialValue, linePoints }) {
  const configured = finiteNumberOrNull(maxValue);
  if (configured != null && configured > 0) return configured;
  return Math.max(
    1,
    initialValue,
    ...linePoints.map(point => finiteNumber(point.value, 0))
  );
}

function resolveDisplayValueAtTime(points, timeMs) {
  if (points.length === 0) return 0;
  let previous = points[0];
  for (let index = 1; index < points.length; index += 1) {
    const next = points[index];
    if (next.timeMs < timeMs) {
      previous = next;
      continue;
    }
    if (Math.abs(next.timeMs - timeMs) <= TIME_EPSILON_MS) {
      let exact = next;
      while (
        index + 1 < points.length &&
        Math.abs(points[index + 1].timeMs - timeMs) <= TIME_EPSILON_MS
      ) {
        index += 1;
        exact = points[index];
      }
      return exact.value;
    }
    const duration = next.timeMs - previous.timeMs;
    if (duration <= TIME_EPSILON_MS) return next.value;
    const ratio = (timeMs - previous.timeMs) / duration;
    return previous.value + (next.value - previous.value) * ratio;
  }
  return points.at(-1).value;
}

function compareSimulationPoints(left, right) {
  return (
    finiteNumber(left.timeMs, 0) - finiteNumber(right.timeMs, 0) ||
    finiteNumber(left.runtimeSequenceIndex, left.__displayOrder) -
      finiteNumber(right.runtimeSequenceIndex, right.__displayOrder) ||
    left.__displayOrder - right.__displayOrder
  );
}

function toPercent(value, maximum) {
  if (!(maximum > 0)) return 0;
  return clampNumber((finiteNumber(value, 0) / maximum) * 100, 0, 100);
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function nonNegativeNumber(value) {
  return Math.max(0, finiteNumber(value, 0));
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function finiteNumberOrNull(value) {
  const number = Number(value);
  return value != null && value !== '' && Number.isFinite(number)
    ? number
    : null;
}

function clampNumber(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
