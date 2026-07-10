import { createWorkbenchRuntimeOutputConsumerView } from './runtimeProjectionPoints';
import { createThreeValueCalculatorDisplayRows } from '../../simulation/threeValueCalculatorAdapters';

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

const RUNTIME_STATE_METRIC_META = {
  enemyHp: {
    label: '敌人 HP',
    unit: 'hp',
    deltaDirection: 'decrease',
  },
  enemyToughness: {
    label: '敌人韧性',
    unit: 'toughness',
    deltaDirection: 'decrease',
  },
  selfEnergy: {
    label: '自身能量',
    unit: 'sp',
    deltaDirection: 'increase',
  },
};

export function createRuntimeSelectedDetail({
  runtimeProjection,
  selectedStateCurvePointId,
} = {}) {
  if (!runtimeProjection || !selectedStateCurvePointId) {
    return null;
  }

  const runtimeOutputView =
    createWorkbenchRuntimeOutputConsumerView(runtimeProjection);
  const runtimeStatePointContexts = runtimeOutputView.statePointContexts;
  const selectedContext = runtimeStatePointContexts.find(
    context => context.statePointId === selectedStateCurvePointId
  );
  if (!selectedContext) {
    return null;
  }

  const runtimePointRows = createRuntimePointRows(
    runtimeOutputView,
    runtimeStatePointContexts
  );
  const pointRow = runtimePointRows.find(
    row => row.statePointId === selectedStateCurvePointId
  );
  if (!pointRow) {
    return null;
  }

  const simLogRow = selectedContext.row ?? null;
  const sourceIds = pointRow.sourceIds ?? {};
  const actionThreeValueDeltaAggregate =
    pointRow.actionThreeValueDeltaAggregate ??
    simLogRow?.actionThreeValueDeltaAggregate ??
    null;
  const hitThreeValueDeltaAggregate =
    pointRow.hitThreeValueDeltaAggregate ??
    simLogRow?.hitThreeValueDeltaAggregate ??
    null;
  const stateSnapshot =
    pointRow.stateSnapshot ?? simLogRow?.stateSnapshot ?? null;
  const hitTransaction =
    pointRow.hitTransaction ?? simLogRow?.hitTransaction ?? null;

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
    trackLabel:
      pointRow.trackLabel ?? RUNTIME_TRACK_META[pointRow.trackKey]?.label,
    layerKey: pointRow.layerKey ?? simLogRow?.layerKey ?? 'applied',
    valueUnit:
      pointRow.valueUnit ?? RUNTIME_TRACK_META[pointRow.trackKey]?.unit,
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
    actionThreeValueDeltaAggregate,
    hitThreeValueDeltaAggregate,
    stateSnapshot,
    hitTransaction,
    reviewUnit: hitTransaction ? 'hit-transaction' : 'delta',
    transactionId: hitTransaction?.transactionId ?? '',
    transactionDeltaCount: hitTransaction?.deltaCount ?? 1,
    sourceDeltaIds:
      hitTransaction?.sourceDeltaIds ??
      [pointRow.sourceDeltaId ?? simLogRow?.sourceDeltaId].filter(Boolean),
    transactionDelta: hitTransaction?.delta ?? null,
    transactionStateChange: hitTransaction?.stateChange ?? null,
    threeValueStateRows: createRuntimeThreeValueStateRows({
      stateSnapshot,
      hitTransaction,
      actorRows: runtimeOutputView.resourceCurveRows,
      fallbackActorId: pointRow.actorId ?? simLogRow?.actorId ?? '',
      fallbackActorName: pointRow.actorName ?? simLogRow?.actorName ?? '',
    }),
    reviewStatus:
      hitTransaction?.status ??
      pointRow.resultStatus ??
      pointRow.sourceStatus ??
      simLogRow?.confidence ??
      'applied',
    status:
      pointRow.resultStatus ??
      pointRow.sourceStatus ??
      simLogRow?.confidence ??
      'applied',
    confidence: pointRow.confidence ?? simLogRow?.confidence ?? null,
    sourceIds,
    contributionRows: createRuntimeDetailContributionRows(
      pointRow,
      hitThreeValueDeltaAggregate,
      hitTransaction
    ),
    sourceRows: createRuntimeDetailSourceRows(sourceIds),
    calculatorRows: createRuntimeDetailCalculatorRows(pointRow, simLogRow),
    simLogRow,
    point: pointRow,
  };
}

export function createRuntimeThreeValueStateRows({
  stateSnapshot,
  hitTransaction = null,
  actorRows = [],
  fallbackActorId = '',
  fallbackActorName = '',
} = {}) {
  const stateTransition = hitTransaction ?? stateSnapshot;
  if (
    !stateTransition?.before ||
    !stateTransition?.delta ||
    !stateTransition?.after
  ) {
    return [];
  }

  const energyOwnerActorId =
    stateTransition.energyOwnerActorId ??
    stateTransition.before.selfEnergy?.actorId ??
    stateTransition.after.selfEnergy?.actorId ??
    '';
  const energyOwnerActorName = resolveRuntimeActorName({
    actorId: energyOwnerActorId,
    actorRows,
    fallbackActorId,
    fallbackActorName,
  });
  const changedMetricKeys = new Set(stateTransition.changedMetricKeys ?? []);

  return Object.entries(RUNTIME_STATE_METRIC_META).map(
    ([metricKey, metricMeta]) => {
      const before = stateTransition.before[metricKey] ?? null;
      const after = stateTransition.after[metricKey] ?? null;
      const beforeValue = strictNumberOrNull(before?.currentValue);
      const afterValue = strictNumberOrNull(after?.currentValue);
      const rawDelta = strictNumberOrNull(stateTransition.delta[metricKey]);
      const providedStateChange = strictNumberOrNull(
        stateTransition.stateChange?.[metricKey]
      );
      const delta =
        providedStateChange ??
        resolveRuntimeStateImpactDelta({
          beforeValue,
          afterValue,
          rawDelta,
          deltaDirection: metricMeta.deltaDirection,
        });

      return {
        key: metricKey,
        label: metricMeta.label,
        unit: metricMeta.unit,
        actorId: metricKey === 'selfEnergy' ? energyOwnerActorId : '',
        actorName: metricKey === 'selfEnergy' ? energyOwnerActorName : '',
        beforeValue,
        rawDelta,
        delta,
        afterValue,
        initialValue: strictNumberOrNull(before?.initialValue),
        maxValue: strictNumberOrNull(after?.maxValue ?? before?.maxValue),
        baselineConfirmed:
          before?.baselineConfirmed === true &&
          after?.baselineConfirmed === true,
        baselineStatus: after?.baselineStatus ?? before?.baselineStatus ?? null,
        primary:
          stateTransition.primaryMetricKey === metricKey ||
          Boolean(hitTransaction && changedMetricKeys.has(metricKey)),
        changed:
          changedMetricKeys.has(metricKey) ||
          (rawDelta != null && rawDelta !== 0),
        before,
        after,
      };
    }
  );
}

function resolveRuntimeStateImpactDelta({
  beforeValue,
  afterValue,
  rawDelta,
  deltaDirection,
}) {
  if (beforeValue != null && afterValue != null) {
    return roundRuntimeValue(afterValue - beforeValue);
  }
  if (rawDelta == null) {
    return null;
  }
  return roundRuntimeValue(
    deltaDirection === 'decrease' ? -rawDelta : rawDelta
  );
}

function resolveRuntimeActorName({
  actorId,
  actorRows,
  fallbackActorId,
  fallbackActorName,
}) {
  if (!actorId) {
    return fallbackActorName || '';
  }
  const actor = (actorRows ?? []).find(row => row.actorId === actorId);
  if (actor?.actorName) {
    return actor.actorName;
  }
  return fallbackActorId === actorId ? fallbackActorName || '' : '';
}

function createRuntimePointRows(runtimeOutputView, runtimeStatePointContexts) {
  const enemyStateCurve = runtimeOutputView.enemyStateCurve;
  const resourceCurveRows = runtimeOutputView.resourceCurveRows;
  const contextByDeltaId = createRuntimeContextByDeltaId(
    runtimeStatePointContexts
  );
  return [
    ...createRuntimeTrackRows({
      points: enemyStateCurve.points ?? [],
      trackKey: 'enemyHpDamage',
      stateMetric: enemyStateCurve.stateMetrics?.hp,
      contextByDeltaId,
    }),
    ...createRuntimeTrackRows({
      points: enemyStateCurve.points ?? [],
      trackKey: 'enemyToughnessDamage',
      stateMetric: enemyStateCurve.stateMetrics?.toughness,
      contextByDeltaId,
    }),
    ...resourceCurveRows.flatMap(actor =>
      createRuntimeTrackRows({
        points: actor.points ?? [],
        trackKey: 'selfEnergyChange',
        actorId: actor.actorId,
        actorName: actor.actorName,
        stateMetric: actor.stateMetric,
        contextByDeltaId,
      })
    ),
  ];
}

function createRuntimeContextByDeltaId(runtimeStatePointContexts) {
  return new Map(
    (runtimeStatePointContexts ?? [])
      .filter(context => context.row?.sourceDeltaId)
      .map(context => [context.row.sourceDeltaId, context])
  );
}

function createRuntimeTrackRows({
  points,
  trackKey,
  actorId,
  actorName,
  stateMetric = null,
  contextByDeltaId,
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
      const context = contextByDeltaId.get(point.sourceDeltaId);
      if (!context?.statePointId) {
        return null;
      }
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
        actionThreeValueDeltaAggregate:
          point.actionThreeValueDeltaAggregate ??
          context?.row?.actionThreeValueDeltaAggregate ??
          null,
        hitThreeValueDeltaAggregate:
          point.hitThreeValueDeltaAggregate ??
          context?.row?.hitThreeValueDeltaAggregate ??
          null,
        calculatorKey: point.calculatorKey ?? point.calculator?.key ?? null,
        calculationKind:
          point.calculationKind ?? point.calculator?.kind ?? null,
        calculationStatus:
          point.calculationStatus ?? point.calculator?.status ?? null,
        calculationReplaceable:
          point.calculationReplaceable ?? point.calculator?.replaceable ?? null,
        pointIndex: index,
        statePointId: context.statePointId,
        trackLabel: point.trackLabel ?? meta.label,
        valueUnit: point.valueUnit ?? meta.unit,
      };
    })
    .filter(Boolean);
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

function createRuntimeDetailContributionRows(
  point,
  hitAggregate = null,
  hitTransaction = null
) {
  const appliedAggregate = hitAggregate?.layers?.applied ?? null;
  const transactionDelta = hitTransaction?.delta ?? null;
  const changedMetricKeys = new Set(hitTransaction?.changedMetricKeys ?? []);
  return [
    {
      key: 'hp',
      label: '敌人 HP',
      value:
        transactionDelta != null
          ? numberOrZero(transactionDelta.enemyHp)
          : appliedAggregate != null
            ? numberOrZero(appliedAggregate.hpDelta)
            : point.trackKey === 'enemyHpDamage'
              ? numberOrZero(point.delta)
              : 0,
      active: hitTransaction
        ? changedMetricKeys.has('enemyHp')
        : point.trackKey === 'enemyHpDamage',
      signed: false,
    },
    {
      key: 'toughness',
      label: '敌人韧性',
      value:
        transactionDelta != null
          ? numberOrZero(transactionDelta.enemyToughness)
          : appliedAggregate != null
            ? numberOrZero(appliedAggregate.toughnessDelta)
            : point.trackKey === 'enemyToughnessDamage'
              ? numberOrZero(point.delta)
              : 0,
      active: hitTransaction
        ? changedMetricKeys.has('enemyToughness')
        : point.trackKey === 'enemyToughnessDamage',
      signed: false,
    },
    {
      key: 'energy',
      label: '自身能量',
      value:
        transactionDelta != null
          ? numberOrZero(transactionDelta.selfEnergy)
          : appliedAggregate != null
            ? numberOrZero(appliedAggregate.energyDelta)
            : point.trackKey === 'selfEnergyChange'
              ? numberOrZero(point.delta)
              : 0,
      active: hitTransaction
        ? changedMetricKeys.has('selfEnergy')
        : point.trackKey === 'selfEnergyChange',
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
  return createThreeValueCalculatorDisplayRows(point, simLogRow);
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
