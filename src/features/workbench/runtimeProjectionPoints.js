import { createRuntimeStateCurvePointId } from './stateCurvePointIdentity';

export function getRuntimeOutputContract(runtimeProjection) {
  return getRuntimeOutputSource(runtimeProjection)?.outputContract ?? null;
}

export function getRuntimeOutputContractOutput(runtimeProjection, outputName) {
  return (
    getRuntimeOutputContract(runtimeProjection)?.outputs?.[outputName] ?? null
  );
}

export function getRuntimeOutputSummary(runtimeProjection) {
  const runtimeOutputSource = getRuntimeOutputSource(runtimeProjection);
  const summary = runtimeOutputSource?.summary ?? {};
  const contractSummary = getRuntimeOutputContract(runtimeProjection)?.summary;
  return {
    ...summary,
    ...(contractSummary ?? {}),
    ...(runtimeOutputSource?.outputSummary ?? {}),
  };
}

export function getRuntimeSimLogRows(runtimeProjection) {
  const runtimeOutputSource = getRuntimeOutputSource(runtimeProjection);
  const simLogOutput = getRuntimeOutputContractOutput(
    runtimeProjection,
    'simLog'
  );
  const rows = runtimeOutputSource?.simLog;
  if (simLogOutput && Array.isArray(rows)) {
    return rows;
  }
  return Array.isArray(rows) ? rows : [];
}

export function getRuntimeSimLogCount(runtimeProjection) {
  const runtimeOutputSource = getRuntimeOutputSource(runtimeProjection);
  const simLogOutputCount = numberOrNull(
    getRuntimeOutputContractOutput(runtimeProjection, 'simLog')?.rowCount
  );
  if (Number.isFinite(simLogOutputCount)) {
    return simLogOutputCount;
  }

  const contractSummaryCount = numberOrNull(
    getRuntimeOutputContract(runtimeProjection)?.summary?.simLogCount
  );
  if (Number.isFinite(contractSummaryCount)) {
    return contractSummaryCount;
  }

  const outputSummaryCount = numberOrNull(
    runtimeOutputSource?.outputSummary?.simLogCount
  );
  if (Number.isFinite(outputSummaryCount)) {
    return outputSummaryCount;
  }

  const summaryCount = numberOrNull(runtimeOutputSource?.summary?.simLogCount);
  if (Number.isFinite(summaryCount)) {
    return summaryCount;
  }

  return getRuntimeSimLogRows(runtimeProjection).length;
}

export function getRuntimeEnemyStateCurve(runtimeProjection) {
  const runtimeOutputSource = getRuntimeOutputSource(runtimeProjection);
  const stateCurvesOutput = getRuntimeOutputContractOutput(
    runtimeProjection,
    'stateCurves'
  );
  if (stateCurvesOutput && runtimeOutputSource?.stateCurves?.enemy) {
    return runtimeOutputSource.stateCurves.enemy;
  }

  return (
    runtimeOutputSource?.stateCurves?.enemy ??
    runtimeProjection?.enemyStateCurve ??
    {}
  );
}

export function getRuntimeResourceCurveRows(runtimeProjection) {
  const runtimeOutputSource = getRuntimeOutputSource(runtimeProjection);
  const resourceCurvesOutput = getRuntimeOutputContractOutput(
    runtimeProjection,
    'resourceCurves'
  );
  const resourceCurves =
    runtimeOutputSource?.resourceCurves ?? runtimeOutputSource?.resources;
  if (resourceCurvesOutput && Array.isArray(resourceCurves?.curvesByActor)) {
    return resourceCurves.curvesByActor;
  }

  return (
    resourceCurves?.curvesByActor ??
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
  return getRuntimeSimLogRows(runtimeProjection)
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

function getRuntimeOutputSource(runtimeProjection) {
  return runtimeProjection?.runtimeOutputs ?? runtimeProjection ?? null;
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

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
