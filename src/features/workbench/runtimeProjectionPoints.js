import { createRuntimeStateCurvePointId } from './stateCurvePointIdentity';
import {
  createThreeValueRuntimeOutputConsumerView,
  getThreeValueRuntimeEnemyStateCurve,
  getThreeValueRuntimeOutputContract,
  getThreeValueRuntimeOutputContractOutput,
  getThreeValueRuntimeOutputSummary,
  getThreeValueRuntimeResourceCurveRows,
  getThreeValueRuntimeSimLogCount,
  getThreeValueRuntimeSimLogRows,
} from '../../simulation/runtime/threeValueRuntimeOutputConsumer';

export function getRuntimeOutputContract(runtimeProjection) {
  return getThreeValueRuntimeOutputContract(runtimeProjection);
}

export function getRuntimeOutputContractOutput(runtimeProjection, outputName) {
  return getThreeValueRuntimeOutputContractOutput(
    runtimeProjection,
    outputName
  );
}

export function getRuntimeOutputSummary(runtimeProjection) {
  return getThreeValueRuntimeOutputSummary(runtimeProjection);
}

export function getRuntimeSimLogRows(runtimeProjection) {
  return getThreeValueRuntimeSimLogRows(runtimeProjection);
}

export function getRuntimeSimLogCount(runtimeProjection) {
  return getThreeValueRuntimeSimLogCount(runtimeProjection);
}

export function getRuntimeEnemyStateCurve(runtimeProjection) {
  return getThreeValueRuntimeEnemyStateCurve(runtimeProjection);
}

export function getRuntimeResourceCurveRows(runtimeProjection) {
  return getThreeValueRuntimeResourceCurveRows(runtimeProjection);
}

export function createRuntimeProjectionPoints(runtimeProjection) {
  const consumerView =
    createThreeValueRuntimeOutputConsumerView(runtimeProjection);
  const enemyStateCurve = consumerView.enemyStateCurve;
  const resourceCurveRows = consumerView.resourceCurveRows;
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
