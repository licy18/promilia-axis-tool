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

function normalizeStateCurvePointIdPart(value) {
  return String(value ?? 'none').replace(/\|/g, '/');
}
