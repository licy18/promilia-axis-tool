import { createRuntimeStateCurvePointId } from './stateCurvePointIdentity';

const RUNTIME_TRACK_META = {
  enemyHpDamage: {
    label: '敌人 HP',
    valueField: 'hpDelta',
    unit: 'damage',
  },
  enemyToughnessDamage: {
    label: '敌人韧性',
    valueField: 'toughnessDelta',
    unit: 'toughness',
  },
  selfEnergyChange: {
    label: '自身能量',
    valueField: 'energyDelta',
    unit: 'sp',
  },
};

export function createRuntimeSelectedDetail({
  runtimeProjection,
  selectedStateCurvePointId,
} = {}) {
  if (!runtimeProjection || !selectedStateCurvePointId) {
    return null;
  }

  const runtimePointRows = createRuntimePointRows(runtimeProjection);
  const pointRow = runtimePointRows.find(
    row => row.statePointId === selectedStateCurvePointId
  );
  if (!pointRow) {
    return null;
  }

  const simLogRow = findRuntimeSimLogRow({
    runtimeProjection,
    pointRow,
    selectedStateCurvePointId,
  });
  const sourceIds = pointRow.sourceIds ?? {};

  return {
    statePointId: selectedStateCurvePointId,
    sourceDeltaId: pointRow.sourceDeltaId ?? simLogRow?.sourceDeltaId ?? '',
    actionId: pointRow.actionId ?? simLogRow?.actionId ?? '',
    actionName: pointRow.actionName ?? simLogRow?.actionName ?? '',
    actorId: pointRow.actorId ?? simLogRow?.actorId ?? '',
    actorName: pointRow.actorName ?? simLogRow?.actorName ?? '',
    hitKey: pointRow.hitKey ?? simLogRow?.hitKey ?? '',
    hitIndex: pointRow.hitIndex ?? simLogRow?.hitIndex ?? null,
    frameIndex: pointRow.frameIndex ?? simLogRow?.frameIndex ?? null,
    frameLabel: pointRow.frameLabel ?? simLogRow?.frameLabel ?? '',
    timeMs: pointRow.timeMs ?? simLogRow?.timeMs ?? null,
    trackKey: pointRow.trackKey,
    trackLabel: pointRow.trackLabel ?? RUNTIME_TRACK_META[pointRow.trackKey]?.label,
    layerKey: pointRow.layerKey ?? simLogRow?.layerKey ?? 'applied',
    valueUnit: pointRow.valueUnit ?? RUNTIME_TRACK_META[pointRow.trackKey]?.unit,
    delta: pointRow.delta,
    cumulative: pointRow.cumulative,
    hpDelta: numberOrZero(pointRow.hpDelta ?? simLogRow?.hpDelta),
    toughnessDelta: numberOrZero(
      pointRow.toughnessDelta ?? simLogRow?.toughnessDelta
    ),
    energyDelta: numberOrZero(pointRow.energyDelta ?? simLogRow?.energyDelta),
    status:
      pointRow.resultStatus ??
      pointRow.sourceStatus ??
      simLogRow?.confidence ??
      'applied',
    confidence: pointRow.confidence ?? simLogRow?.confidence ?? null,
    sourceIds,
    contributionRows: createRuntimeDetailContributionRows(pointRow),
    sourceRows: createRuntimeDetailSourceRows(sourceIds),
    simLogRow,
    point: pointRow,
  };
}

function createRuntimePointRows(runtimeProjection) {
  return [
    ...createRuntimeTrackRows({
      points: runtimeProjection.enemyStateCurve?.points ?? [],
      trackKey: 'enemyHpDamage',
    }),
    ...createRuntimeTrackRows({
      points: runtimeProjection.enemyStateCurve?.points ?? [],
      trackKey: 'enemyToughnessDamage',
    }),
    ...(runtimeProjection.selfEnergyCurveByActor ?? []).flatMap(actor =>
      createRuntimeTrackRows({
        points: actor.points ?? [],
        trackKey: 'selfEnergyChange',
        actorId: actor.actorId,
        actorName: actor.actorName,
      })
    ),
  ];
}

function createRuntimeTrackRows({ points, trackKey, actorId, actorName }) {
  const meta = RUNTIME_TRACK_META[trackKey];
  if (!meta) {
    return [];
  }

  let cumulative = 0;
  return [...(points ?? [])]
    .filter(point => point.trackKey === trackKey)
    .sort(compareRuntimePoints)
    .map((point, index) => {
      const delta = numberOrZero(point[meta.valueField] ?? point.delta);
      cumulative = roundRuntimeValue(cumulative + delta);
      return {
        ...point,
        actorId: point.actorId ?? actorId,
        actorName: point.actorName ?? actorName,
        delta,
        cumulative,
        pointIndex: index,
        statePointId: createRuntimeStateCurvePointId(point, point),
        trackLabel: point.trackLabel ?? meta.label,
        valueUnit: point.valueUnit ?? meta.unit,
      };
    });
}

function findRuntimeSimLogRow({
  runtimeProjection,
  pointRow,
  selectedStateCurvePointId,
}) {
  const runtimePointByDeltaId = new Map(
    createRuntimePointRows(runtimeProjection)
      .filter(point => point.sourceDeltaId)
      .map(point => [point.sourceDeltaId, point])
  );

  return (runtimeProjection.simLog ?? []).find(row => {
    if (row.sourceDeltaId && row.sourceDeltaId === pointRow.sourceDeltaId) {
      return true;
    }
    return (
      createRuntimeStateCurvePointId(
        row,
        runtimePointByDeltaId.get(row.sourceDeltaId)
      ) === selectedStateCurvePointId
    );
  });
}

function createRuntimeDetailContributionRows(point) {
  return [
    {
      key: 'hp',
      label: '敌人 HP',
      value: point.trackKey === 'enemyHpDamage' ? numberOrZero(point.delta) : 0,
      active: point.trackKey === 'enemyHpDamage',
      signed: false,
    },
    {
      key: 'toughness',
      label: '敌人韧性',
      value:
        point.trackKey === 'enemyToughnessDamage'
          ? numberOrZero(point.delta)
          : 0,
      active: point.trackKey === 'enemyToughnessDamage',
      signed: false,
    },
    {
      key: 'energy',
      label: '自身能量',
      value:
        point.trackKey === 'selfEnergyChange' ? numberOrZero(point.delta) : 0,
      active: point.trackKey === 'selfEnergyChange',
      signed: true,
    },
  ];
}

function createRuntimeDetailSourceRows(sourceIds) {
  return [
    {
      key: 'skillIds',
      label: 'Skill',
      values: normalizeSourceList(sourceIds.skillIds),
    },
    {
      key: 'elementConfigIds',
      label: 'Element',
      values: normalizeSourceList(sourceIds.elementConfigIds),
    },
    {
      key: 'captureSessionIds',
      label: '采样',
      values: normalizeSourceList(sourceIds.captureSessionIds),
    },
    {
      key: 'pathIds',
      label: 'Path',
      values: normalizeSourceList(sourceIds.pathIds),
    },
  ];
}

function normalizeSourceList(values) {
  return Array.isArray(values) ? values.filter(value => value != null) : [];
}

function compareRuntimePoints(left, right) {
  return (
    (numberOrNull(left.frameIndex) ?? 0) -
      (numberOrNull(right.frameIndex) ?? 0) ||
    (numberOrNull(left.sequenceIndex) ?? 0) -
      (numberOrNull(right.sequenceIndex) ?? 0)
  );
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberOrZero(value) {
  return numberOrNull(value) ?? 0;
}

function roundRuntimeValue(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}
