export function getRuntimeEnemyStateCurve(runtimeProjection) {
  return (
    runtimeProjection?.stateCurves?.enemy ??
    runtimeProjection?.enemyStateCurve ??
    {}
  );
}

export function getRuntimeResourceCurveRows(runtimeProjection) {
  return (
    runtimeProjection?.resourceCurves?.curvesByActor ??
    runtimeProjection?.selfEnergyCurveByActor ??
    []
  );
}

export function createRuntimeProjectionPoints(runtimeProjection) {
  const enemyStateCurve = getRuntimeEnemyStateCurve(runtimeProjection);
  const resourceCurveRows = getRuntimeResourceCurveRows(runtimeProjection);
  return [
    ...(enemyStateCurve.points ?? []),
    ...resourceCurveRows.flatMap(actor =>
      (actor.points ?? []).map(point => ({
        ...point,
        actorId: point.actorId ?? actor.actorId ?? null,
        actorName: point.actorName ?? actor.actorName ?? null,
        resource: point.resource ?? actor.resource ?? null,
      }))
    ),
  ];
}

export function createRuntimePointByDeltaId(runtimeProjection) {
  const byId = new Map();
  for (const point of createRuntimeProjectionPoints(runtimeProjection)) {
    if (point?.sourceDeltaId) {
      byId.set(point.sourceDeltaId, point);
    }
  }
  return byId;
}
