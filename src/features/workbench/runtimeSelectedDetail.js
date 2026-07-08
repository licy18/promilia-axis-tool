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
    stateLabel: pointRow.stateLabel ?? null,
    stateValue: pointRow.stateValue ?? null,
    stateValueStatus: pointRow.stateValueStatus ?? null,
    baselineStatus: pointRow.baselineStatus ?? null,
    baselineInitialValue: pointRow.baselineInitialValue ?? null,
    baselineMaxValue: pointRow.baselineMaxValue ?? null,
    baselineConfirmed: Boolean(pointRow.baselineConfirmed),
    rawStateValue: pointRow.rawStateValue ?? null,
    overrunValue: pointRow.overrunValue ?? 0,
    calculator: pointRow.calculator ?? simLogRow?.calculator ?? null,
    calculatorKey:
      pointRow.calculatorKey ??
      pointRow.calculator?.key ??
      simLogRow?.calculatorKey ??
      simLogRow?.calculator?.key ??
      null,
    calculationKind:
      pointRow.calculationKind ??
      pointRow.calculator?.kind ??
      simLogRow?.calculationKind ??
      simLogRow?.calculator?.kind ??
      null,
    calculationStatus:
      pointRow.calculationStatus ??
      pointRow.calculator?.status ??
      simLogRow?.calculationStatus ??
      simLogRow?.calculator?.status ??
      null,
    calculationReplaceable:
      pointRow.calculationReplaceable ??
      pointRow.calculator?.replaceable ??
      simLogRow?.calculationReplaceable ??
      simLogRow?.calculator?.replaceable ??
      null,
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
    calculatorRows: createRuntimeDetailCalculatorRows(pointRow, simLogRow),
    simLogRow,
    point: pointRow,
  };
}

function createRuntimePointRows(runtimeProjection) {
  return [
    ...createRuntimeTrackRows({
      points: runtimeProjection.enemyStateCurve?.points ?? [],
      trackKey: 'enemyHpDamage',
      stateMetric: runtimeProjection.enemyStateCurve?.stateMetrics?.hp,
    }),
    ...createRuntimeTrackRows({
      points: runtimeProjection.enemyStateCurve?.points ?? [],
      trackKey: 'enemyToughnessDamage',
      stateMetric: runtimeProjection.enemyStateCurve?.stateMetrics?.toughness,
    }),
    ...(runtimeProjection.selfEnergyCurveByActor ?? []).flatMap(actor =>
      createRuntimeTrackRows({
        points: actor.points ?? [],
        trackKey: 'selfEnergyChange',
        actorId: actor.actorId,
        actorName: actor.actorName,
        stateMetric: actor.stateMetric,
      })
    ),
  ];
}

function createRuntimeTrackRows({
  points,
  trackKey,
  actorId,
  actorName,
  stateMetric = null,
}) {
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
      const pointState = createRuntimePointState(stateMetric, cumulative);
      return {
        ...point,
        actorId: point.actorId ?? actorId,
        actorName: point.actorName ?? actorName,
        delta,
        cumulative,
        stateLabel: pointState.stateLabel,
        stateValue: pointState.stateValue,
        rawStateValue: pointState.rawStateValue,
        overrunValue: pointState.overrunValue,
        stateValueStatus: pointState.stateValueStatus,
        baselineStatus: pointState.baselineStatus,
        baselineInitialValue: pointState.baselineInitialValue,
        baselineMaxValue: pointState.baselineMaxValue,
        baselineConfirmed: pointState.baselineConfirmed,
        calculator: point.calculator ?? null,
        calculatorKey: point.calculatorKey ?? point.calculator?.key ?? null,
        calculationKind:
          point.calculationKind ?? point.calculator?.kind ?? null,
        calculationStatus:
          point.calculationStatus ?? point.calculator?.status ?? null,
        calculationReplaceable:
          point.calculationReplaceable ?? point.calculator?.replaceable ?? null,
        pointIndex: index,
        statePointId: createRuntimeStateCurvePointId(point, point),
        trackLabel: point.trackLabel ?? meta.label,
        valueUnit: point.valueUnit ?? meta.unit,
      };
    });
}

function createRuntimePointState(stateMetric, cumulative) {
  const initialValue = strictNumberOrNull(stateMetric?.initialValue);
  const baselineConfirmed = Number.isFinite(initialValue);
  const rawStateValue = baselineConfirmed
    ? roundRuntimeValue(
        stateMetric?.deltaDirection === 'decrease'
          ? initialValue - numberOrZero(cumulative)
          : initialValue + numberOrZero(cumulative)
      )
    : null;
  const stateValue =
    rawStateValue != null && stateMetric?.deltaDirection === 'decrease'
      ? Math.max(0, rawStateValue)
      : rawStateValue;

  return {
    stateLabel: stateMetric?.stateLabel ?? null,
    stateValue,
    rawStateValue,
    overrunValue:
      rawStateValue != null && stateMetric?.deltaDirection === 'decrease'
        ? Math.max(0, roundRuntimeValue(-rawStateValue))
        : 0,
    stateValueStatus: baselineConfirmed
      ? 'state-derived-from-baseline-and-cumulative-delta'
      : (stateMetric?.stateStatus ?? 'state-baseline-pending'),
    baselineStatus: stateMetric?.baselineStatus ?? null,
    baselineInitialValue: baselineConfirmed ? initialValue : null,
    baselineMaxValue: stateMetric?.maxValue ?? null,
    baselineConfirmed,
  };
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

export function createRuntimeDetailCalculatorRows(point, simLogRow) {
  const runtimePoint = point ?? {};
  const logRow = simLogRow ?? {};
  const calculator = runtimePoint.calculator ?? logRow.calculator ?? null;
  const calculatorKey =
    runtimePoint.calculatorKey ??
    calculator?.key ??
    logRow.calculatorKey ??
    logRow.calculator?.key ??
    null;
  const kind =
    runtimePoint.calculationKind ??
    calculator?.kind ??
    logRow.calculationKind ??
    logRow.calculator?.kind ??
    null;
  const status =
    runtimePoint.calculationStatus ??
    calculator?.status ??
    logRow.calculationStatus ??
    logRow.calculator?.status ??
    null;
  const replaceable =
    runtimePoint.calculationReplaceable ??
    calculator?.replaceable ??
    logRow.calculationReplaceable ??
    logRow.calculator?.replaceable ??
    null;
  const unresolved = normalizeSourceList(calculator?.unresolved);

  return [
    {
      key: 'calculator',
      label: '适配器',
      value: formatCalculatorKey(calculatorKey, runtimePoint.trackKey),
      rawValue: calculatorKey,
    },
    {
      key: 'kind',
      label: '来源',
      value: formatCalculationKind(kind, runtimePoint.trackKey),
      rawValue: kind,
    },
    {
      key: 'replaceable',
      label: '替换',
      value: replaceable === false ? '已固定' : '可替换',
      rawValue: replaceable,
    },
    {
      key: 'status',
      label: '公式',
      value: formatCalculationStatus(status),
      rawValue: status,
    },
    {
      key: 'unresolved',
      label: '缺口',
      value: formatUnresolvedItems(unresolved),
      rawValue: unresolved,
    },
  ];
}

function formatCalculatorKey(calculatorKey, trackKey) {
  if (calculatorKey === 'azpr-hp-delta-calculator') {
    return 'HP适配器';
  }
  if (calculatorKey === 'azpr-toughness-delta-calculator') {
    return '削韧适配器';
  }
  if (calculatorKey === 'azpr-self-energy-delta-calculator') {
    return '能量适配器';
  }
  if (trackKey === 'enemyHpDamage') {
    return 'HP适配器';
  }
  if (trackKey === 'enemyToughnessDamage') {
    return '削韧适配器';
  }
  if (trackKey === 'selfEnergyChange') {
    return '能量适配器';
  }
  return calculatorKey ?? '未知适配器';
}

function formatCalculationKind(kind, trackKey) {
  if (kind === 'raw-result-preview') {
    return 'HP预览';
  }
  if (kind === 'damage-element-candidate-preview') {
    return 'HP候选';
  }
  if (kind === 'weak-break-result-preview') {
    return '削韧预览';
  }
  if (kind === 'weak-break-field-candidate-preview') {
    return '削韧候选';
  }
  if (kind === 'explicit-resource-event-or-cost-preview') {
    return '能量事件';
  }
  if (kind === 'recover-sp-candidate-preview') {
    return '能量候选';
  }
  if (kind === 'recover-sp-runtime-sample') {
    return '能量采样';
  }
  if (kind === 'placeholder') {
    return '占位';
  }
  if (trackKey === 'enemyHpDamage') {
    return 'HP预览';
  }
  if (trackKey === 'enemyToughnessDamage') {
    return '削韧候选';
  }
  if (trackKey === 'selfEnergyChange') {
    return '能量候选';
  }
  return kind ?? '未知来源';
}

function formatCalculationStatus(status) {
  if (!status) {
    return '待确认';
  }
  if (String(status).includes('raw-hp-projection')) {
    return '公式未确认';
  }
  if (String(status).includes('explicit-cost-applied')) {
    return '消耗已应用';
  }
  if (String(status).includes('recover-sp-runtime-sample')) {
    return '采样未应用';
  }
  if (String(status).includes('recover-sp')) {
    return '充能未确认';
  }
  if (String(status).includes('toughness')) {
    return '削韧未确认';
  }
  if (String(status).includes('placeholder')) {
    return '占位待确认';
  }
  if (String(status).includes('candidate')) {
    return '候选未确认';
  }
  return status;
}

function formatUnresolvedItems(items) {
  const mapped = normalizeSourceList(items)
    .map(formatUnresolvedItem)
    .filter(Boolean);
  return mapped.length > 0 ? mapped.join('、') : '无';
}

function formatUnresolvedItem(item) {
  const key = String(item ?? '');
  if (key === 'final-azpr-formula-confirmation') {
    return '最终公式';
  }
  if (key === 'enemy-defense-resistance-critical-order') {
    return '防御抗性顺序';
  }
  if (key === 'hit-to-damage-element-binding') {
    return '命中绑定';
  }
  if (key === 'weak-break-damage-rate-unit-scale') {
    return '削韧倍率单位';
  }
  if (key === 'target-toughness-state-baseline') {
    return '韧性基线';
  }
  if (key === 'initial-current-sp-baseline') {
    return '初始能量';
  }
  if (key === 'recover-sp-owner-share-and-throttle') {
    return '能量归属/共享';
  }
  return key;
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

function strictNumberOrNull(value) {
  if (value == null || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundRuntimeValue(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}
