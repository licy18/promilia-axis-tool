import { createRuntimeStateCurvePointId } from './stateCurvePointIdentity';

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

export function createRuntimeStatePointContexts(runtimeProjection) {
  const pointByDeltaId = createRuntimePointByDeltaId(runtimeProjection);
  return (runtimeProjection?.simLog ?? [])
    .map(row => createRuntimeStatePointContext(row, pointByDeltaId))
    .filter(Boolean)
    .sort((left, right) => compareRuntimeStateRows(left.row, right.row));
}

export function findFirstRuntimeStatePointForAction(
  runtimeProjection,
  actionId,
  { preferredTrackKey = '' } = {}
) {
  if (!actionId) {
    return null;
  }
  const contexts = createRuntimeStatePointContexts(runtimeProjection).filter(
    context => context.row?.actionId === actionId
  );
  return (
    findPreferredRuntimeStatePointContext(contexts, preferredTrackKey) ??
    contexts[0] ??
    null
  );
}

function createRuntimeStatePointContext(row, pointByDeltaId) {
  if (!row) {
    return null;
  }
  const point = pointByDeltaId.get(row.sourceDeltaId) ?? null;
  const statePointId = createRuntimeStateCurvePointId(row, point);
  if (!statePointId) {
    return null;
  }
  return {
    row,
    point,
    statePointId,
  };
}

function findPreferredRuntimeStatePointContext(contexts, preferredTrackKey) {
  if (!preferredTrackKey) {
    return null;
  }
  return (
    contexts.find(context => {
      return (
        context.row?.trackKey === preferredTrackKey ||
        context.point?.trackKey === preferredTrackKey
      );
    }) ?? null
  );
}

function compareRuntimeStateRows(left, right) {
  return (
    compareOptionalNumber(left?.frameIndex, right?.frameIndex) ||
    compareOptionalNumber(left?.sequenceIndex, right?.sequenceIndex) ||
    String(left?.sourceDeltaId ?? '').localeCompare(
      String(right?.sourceDeltaId ?? '')
    )
  );
}

function compareOptionalNumber(left, right) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  const hasLeft = Number.isFinite(leftNumber);
  const hasRight = Number.isFinite(rightNumber);
  if (hasLeft && hasRight) {
    return leftNumber - rightNumber;
  }
  if (hasLeft) {
    return -1;
  }
  if (hasRight) {
    return 1;
  }
  return 0;
}
