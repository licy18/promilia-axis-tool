export function createStateCurvePointId({
  trackKey,
  layerKey,
  point = {},
  pointIndex = 0,
} = {}) {
  return [
    trackKey,
    layerKey,
    point.actionId ?? point.eventType ?? 'point',
    point.frameIndex ?? point.timeMs ?? pointIndex,
    point.sequenceIndex ?? point.eventIndex ?? point.hitIndex ?? pointIndex,
  ]
    .map(normalizeStateCurvePointIdPart)
    .join('|');
}

export function createStateCurveFrameGroupKey(point = {}) {
  return [
    point.actionId ?? point.eventType ?? 'point',
    normalizeStateCurvePointIdPart(
      Number.isFinite(Number(point.frameIndex))
        ? Number(point.frameIndex)
        : (point.timeMs ?? point.frameLabel ?? 'time')
    ),
    normalizeStateCurvePointIdPart(
      Number.isFinite(Number(point.hitIndex))
        ? `hit${Number(point.hitIndex)}`
        : (point.eventIndex ??
            point.sequenceIndex ??
            point.eventType ??
            'event')
    ),
  ].join('|');
}

export function createRuntimeStateCurvePointId(row, point) {
  if (!row && !point) {
    return '';
  }

  const stateCurveSequenceIndex =
    numberOrNull(row?.stateCurveSequenceIndex) ??
    numberOrNull(point?.stateCurveSequenceIndex) ??
    parseRuntimeStateCurveSequenceIndex(row?.hitKey ?? point?.hitKey) ??
    numberOrNull(point?.sequenceIndex) ??
    numberOrNull(row?.sequenceIndex) ??
    0;

  return createStateCurvePointId({
    trackKey: row?.trackKey ?? point?.trackKey,
    layerKey: row?.layerKey ?? point?.layerKey ?? 'applied',
    point: {
      ...(point ?? {}),
      ...(row ?? {}),
      sequenceIndex: stateCurveSequenceIndex,
    },
    pointIndex: stateCurveSequenceIndex,
  });
}

function normalizeStateCurvePointIdPart(value) {
  return String(value ?? 'none').replace(/\|/g, '/');
}

function parseRuntimeStateCurveSequenceIndex(hitKey) {
  const match = String(hitKey ?? '').match(/-point-(\d+)$/);
  return match ? Number(match[1]) : null;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
