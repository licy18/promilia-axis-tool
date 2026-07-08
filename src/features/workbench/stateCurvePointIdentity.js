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

function normalizeStateCurvePointIdPart(value) {
  return String(value ?? 'none').replace(/\|/g, '/');
}
