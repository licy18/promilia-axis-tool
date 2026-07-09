import { summarizeThreeValueCalculators } from '../threeValueCalculatorAdapters';
import {
  ACTION_HIT_THREE_VALUE_RUNTIME_INPUT_SOURCE,
  createThreeValueRuntimeInput,
} from './threeValueRuntimeInput';
import { createThreeValueRuntimeOutputConsumerContract } from './threeValueRuntimeOutputConsumer';

export function createThreeValueRuntimeProjection({
  scenario,
  generationOutputs,
  runtimeInputSource,
  actionHitThreeValueDeltaGeneration,
  threeValueGenerationLayer,
}) {
  const runtimeInput = createThreeValueRuntimeInput({
    generationOutputs,
    runtimeInputSource,
    actionHitThreeValueDeltaGeneration,
    threeValueGenerationLayer,
  });
  const appliedDeltas = runtimeInput.appliedDeltas;
  const enemyStateCurve = createThreeValueRuntimeEnemyStateCurve({
    scenario,
    appliedDeltas,
  });
  const selfEnergyCurveByActor = createThreeValueRuntimeSelfEnergyCurveByActor({
    scenario,
    appliedDeltas,
  });
  const simLog = createThreeValueRuntimeSimLog(appliedDeltas);
  const resourceCurves = createThreeValueRuntimeResourceCurves(
    selfEnergyCurveByActor
  );
  const stateCurves = createThreeValueRuntimeStateCurves({
    enemyStateCurve,
    resourceCurves,
  });
  const baseSummary = summarizeThreeValueRuntimeProjection({
    runtimeInput,
    appliedDeltas,
    enemyStateCurve,
    selfEnergyCurveByActor,
    resourceCurves,
    simLog,
  });
  const outputContract = createThreeValueRuntimeOutputContract({
    runtimeInput,
    appliedDeltas,
    enemyStateCurve,
    resourceCurves,
    stateCurves,
    simLog,
    summary: baseSummary,
  });
  const summary = {
    ...baseSummary,
    runtimeOutputContractSourceKind: outputContract.sourceKind,
    runtimeOutputContractStatus: outputContract.status,
    runtimeOutputContractOutputCount: outputContract.summary.outputCount,
  };
  const runtimeOutputs = createThreeValueRuntimeOutputs({
    outputContract,
    simLog,
    stateCurves,
    resourceCurves,
    summary,
  });

  return {
    schemaVersion: 1,
    sourceKind: runtimeInput.runtimeInputSourceKind
      ? 'azpr-runtime-projection-from-runtime-input-source'
      : 'azpr-runtime-projection-from-three-value-generation-layer',
    status:
      appliedDeltas.length > 0
        ? runtimeInput.runtimeInputSourceKind
          ? 'runtime-projection-ready-from-runtime-input-source'
          : 'runtime-projection-ready-from-generation-layer'
        : 'runtime-projection-ready-no-applied-deltas',
    inputContractName: runtimeInput.contractName,
    runtimeInput,
    appliedOnly: true,
    outputContract,
    runtimeOutputs,
    stateCurves,
    resourceCurves,
    enemyStateCurve,
    selfEnergyCurveByActor,
    simLog,
    summary,
    applied: true,
  };
}

function createThreeValueRuntimeOutputs({
  outputContract,
  simLog,
  stateCurves,
  resourceCurves,
  summary,
}) {
  const outputConsistency = createRuntimeOutputConsistency({
    outputContract,
    simLog,
    stateCurves,
    resourceCurves,
    summary,
  });
  const outputConsumerContract = createThreeValueRuntimeOutputConsumerContract({
    outputContract,
    simLog,
    stateCurves,
    resourceCurves,
    summary,
    outputConsistency,
  });
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-three-value-runtime-outputs',
    status:
      outputContract.status === 'runtime-output-contract-ready'
        ? 'runtime-outputs-ready'
        : 'runtime-outputs-ready-no-applied-deltas',
    inputContractName: outputContract.inputContractName,
    inputSourceKind: outputContract.inputSourceKind,
    runtimeInputSourceKind: outputContract.runtimeInputSourceKind,
    outputNames: outputContract.outputNames,
    outputAliases: {
      resources: 'resourceCurves',
    },
    outputContract,
    outputConsumerContract,
    consumerContract: outputConsumerContract,
    simLog,
    stateCurves,
    resourceCurves,
    resources: resourceCurves,
    summary,
    outputConsistency,
    outputs: {
      simLog,
      stateCurves,
      resourceCurves,
      resources: resourceCurves,
      summary,
    },
    outputSummary: {
      outputCount: outputContract.summary.outputCount,
      appliedDeltaCount: outputContract.summary.appliedDeltaCount,
      simLogCount: outputContract.summary.simLogCount,
      enemyStatePointCount: outputContract.summary.enemyStatePointCount,
      stateCurvePointCount: outputContract.summary.stateCurvePointCount,
      resourceCurveActorCount: outputContract.summary.resourceCurveActorCount,
      resourceCurvePointCount: outputContract.summary.resourceCurvePointCount,
      enemyHpDelta: outputContract.summary.enemyHpDelta,
      enemyToughnessDelta: outputContract.summary.enemyToughnessDelta,
      selfEnergyDelta: outputContract.summary.selfEnergyDelta,
      runtimeInputGenerationReadSourcesStatus:
        outputContract.summary.runtimeInputGenerationReadSourcesStatus,
      runtimeInputGenerationReadStandardOutputCount:
        outputContract.summary.runtimeInputGenerationReadStandardOutputCount,
      runtimeInputGenerationReadFallbackInputCount:
        outputContract.summary.runtimeInputGenerationReadFallbackInputCount,
      runtimeInputGenerationReadUsesLegacyFallback:
        outputContract.summary.runtimeInputGenerationReadUsesLegacyFallback,
      runtimeInputGenerationStandardBoundaryReady:
        outputContract.summary.runtimeInputGenerationStandardBoundaryReady,
      runtimeInputGenerationEntryContractValidationStatus:
        outputContract.summary
          .runtimeInputGenerationEntryContractValidationStatus,
      runtimeInputGenerationEntryContractValidationIssueCount:
        outputContract.summary
          .runtimeInputGenerationEntryContractValidationIssueCount,
      runtimeInputGenerationEntryContractValidationValid:
        outputContract.summary
          .runtimeInputGenerationEntryContractValidationValid,
      runtimeInputGenerationEntryAggregateValidationStatus:
        outputContract.summary
          .runtimeInputGenerationEntryAggregateValidationStatus,
      runtimeInputGenerationEntryAggregateValidationIssueCount:
        outputContract.summary
          .runtimeInputGenerationEntryAggregateValidationIssueCount,
      runtimeInputGenerationEntryAggregateValidationValid:
        outputContract.summary
          .runtimeInputGenerationEntryAggregateValidationValid,
      runtimeInputGenerationAggregateBoundaryReady:
        outputContract.summary.runtimeInputGenerationAggregateBoundaryReady,
      runtimeInputGenerationEntryPath:
        outputContract.summary.runtimeInputGenerationEntryPath,
      runtimeInputGenerationRuntimeInputSourcePath:
        outputContract.summary.runtimeInputGenerationRuntimeInputSourcePath,
      runtimeInputGenerationStandardContractPath:
        outputContract.summary.runtimeInputGenerationStandardContractPath,
      runtimeInputGenerationDeltasPath:
        outputContract.summary.runtimeInputGenerationDeltasPath,
      runtimeInputGenerationContractValidationPath:
        outputContract.summary.runtimeInputGenerationContractValidationPath,
      runtimeInputGenerationAggregateValidationPath:
        outputContract.summary.runtimeInputGenerationAggregateValidationPath,
      valueSourceSlotCount: outputContract.summary.valueSourceSlotCount,
      runtimeValueSourceSlotCount:
        outputContract.summary.runtimeValueSourceSlotCount,
      replaceableValueSourceSlotCount:
        outputContract.summary.replaceableValueSourceSlotCount,
      runtimeInputGenerationValueSourceSlotsPath:
        outputContract.summary.runtimeInputGenerationValueSourceSlotsPath,
      runtimeInputGenerationValueSourceSlotsSourceTier:
        outputContract.summary.runtimeInputGenerationValueSourceSlotsSourceTier,
      runtimeInputGenerationValueSourceSlotsStandardOutputPresent:
        outputContract.summary
          .runtimeInputGenerationValueSourceSlotsStandardOutputPresent,
      outputConsumerContractSourceKind: outputConsumerContract.sourceKind,
      outputConsumerContractStatus: outputConsumerContract.status,
      outputConsistencyStatus: outputConsistency.status,
      outputConsistent: outputConsistency.consistent,
      applied: true,
    },
    applied: true,
  };
}

function createRuntimeOutputConsistency({
  outputContract,
  simLog,
  stateCurves,
  resourceCurves,
  summary,
}) {
  const simLogCount = simLog.length;
  const enemyStatePointCount =
    numberOrNull(stateCurves?.enemy?.pointCount) ?? 0;
  const resourceCurvePointCount =
    numberOrNull(resourceCurves?.summary?.pointCount) ?? 0;
  const stateCurvePointCount = roundCurveValue(
    enemyStatePointCount + resourceCurvePointCount
  );
  const resourceActorPointCount = (resourceCurves?.curvesByActor ?? []).reduce(
    (sum, actor) => sum + (numberOrNull(actor.pointCount) ?? 0),
    0
  );
  const checks = {
    summarySimLogCount: summary.simLogCount === simLogCount,
    summaryEnemyStatePointCount:
      summary.enemyStatePointCount === enemyStatePointCount,
    summaryResourceCurvePointCount:
      summary.resourceCurvePointCount === resourceCurvePointCount,
    summaryStateCurvePointCount:
      summary.stateCurvePointCount === stateCurvePointCount,
    stateCurvesSummaryPointCount:
      stateCurves?.summary?.stateCurvePointCount === stateCurvePointCount,
    resourceCurvesSummaryPointCount:
      resourceCurves?.summary?.pointCount === resourceActorPointCount,
    outputContractSummarySimLogCount:
      outputContract.summary.simLogCount === simLogCount,
    outputContractSummaryStateCurvePointCount:
      outputContract.summary.stateCurvePointCount === stateCurvePointCount,
  };
  const consistent = Object.values(checks).every(Boolean);
  return {
    sourceKind: 'azpr-runtime-output-consistency',
    status: consistent
      ? 'runtime-output-consistent'
      : 'runtime-output-inconsistent',
    simLogCount,
    enemyStatePointCount,
    resourceCurvePointCount,
    stateCurvePointCount,
    resourceActorPointCount,
    checks,
    consistent,
    applied: true,
  };
}

function createThreeValueRuntimeOutputContract({
  runtimeInput,
  appliedDeltas,
  enemyStateCurve,
  resourceCurves,
  stateCurves,
  simLog,
  summary,
}) {
  const outputs = {
    simLog: createRuntimeSimLogOutputContract({
      runtimeInput,
      simLog,
    }),
    stateCurves: createRuntimeStateCurvesOutputContract({
      stateCurves,
      enemyStateCurve,
      resourceCurves,
    }),
    resourceCurves: createRuntimeResourceCurvesOutputContract(resourceCurves),
    summary: createRuntimeSummaryOutputContract(summary),
  };
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-three-value-runtime-output-contract',
    status:
      appliedDeltas.length > 0
        ? 'runtime-output-contract-ready'
        : 'runtime-output-contract-ready-no-applied-deltas',
    inputContractName: runtimeInput.contractName,
    inputSourceKind: runtimeInput.sourceKind,
    runtimeInputSourceKind: runtimeInput.runtimeInputSourceKind,
    generationEntrySourceKind: runtimeInput.generationEntrySourceKind,
    outputNames: Object.keys(outputs),
    outputs,
    summary: {
      outputCount: Object.keys(outputs).length,
      appliedDeltaCount: appliedDeltas.length,
      simLogCount: simLog.length,
      enemyStatePointCount: enemyStateCurve.pointCount,
      stateCurvePointCount: stateCurves.summary.stateCurvePointCount,
      resourceCurveActorCount: resourceCurves.summary.actorCount,
      resourceCurvePointCount: resourceCurves.summary.pointCount,
      enemyHpDelta: summary.enemyHpDelta,
      enemyToughnessDelta: summary.enemyToughnessDelta,
      selfEnergyDelta: summary.selfEnergyDelta,
      runtimeInputGenerationReadSourcesStatus:
        summary.runtimeInputGenerationReadSourcesStatus,
      runtimeInputGenerationReadStandardOutputCount:
        summary.runtimeInputGenerationReadStandardOutputCount,
      runtimeInputGenerationReadFallbackInputCount:
        summary.runtimeInputGenerationReadFallbackInputCount,
      runtimeInputGenerationReadUsesLegacyFallback:
        summary.runtimeInputGenerationReadUsesLegacyFallback,
      runtimeInputGenerationStandardBoundaryReady:
        summary.runtimeInputGenerationStandardBoundaryReady,
      runtimeInputGenerationEntryContractValidationStatus:
        summary.runtimeInputGenerationEntryContractValidationStatus,
      runtimeInputGenerationEntryContractValidationIssueCount:
        summary.runtimeInputGenerationEntryContractValidationIssueCount,
      runtimeInputGenerationEntryContractValidationValid:
        summary.runtimeInputGenerationEntryContractValidationValid,
      runtimeInputGenerationEntryAggregateValidationStatus:
        summary.runtimeInputGenerationEntryAggregateValidationStatus,
      runtimeInputGenerationEntryAggregateValidationIssueCount:
        summary.runtimeInputGenerationEntryAggregateValidationIssueCount,
      runtimeInputGenerationEntryAggregateValidationValid:
        summary.runtimeInputGenerationEntryAggregateValidationValid,
      runtimeInputGenerationAggregateBoundaryReady:
        summary.runtimeInputGenerationAggregateBoundaryReady,
      runtimeInputGenerationEntryPath: summary.runtimeInputGenerationEntryPath,
      runtimeInputGenerationRuntimeInputSourcePath:
        summary.runtimeInputGenerationRuntimeInputSourcePath,
      runtimeInputGenerationStandardContractPath:
        summary.runtimeInputGenerationStandardContractPath,
      runtimeInputGenerationDeltasPath:
        summary.runtimeInputGenerationDeltasPath,
      runtimeInputGenerationContractValidationPath:
        summary.runtimeInputGenerationContractValidationPath,
      runtimeInputGenerationAggregateValidationPath:
        summary.runtimeInputGenerationAggregateValidationPath,
      valueSourceSlotCount: summary.valueSourceSlotCount,
      runtimeValueSourceSlotCount: summary.runtimeValueSourceSlotCount,
      replaceableValueSourceSlotCount: summary.replaceableValueSourceSlotCount,
      runtimeInputGenerationValueSourceSlotsPath:
        summary.runtimeInputGenerationValueSourceSlotsPath,
      runtimeInputGenerationValueSourceSlotsSourceTier:
        summary.runtimeInputGenerationValueSourceSlotsSourceTier,
      runtimeInputGenerationValueSourceSlotsStandardOutputPresent:
        summary.runtimeInputGenerationValueSourceSlotsStandardOutputPresent,
      applied: true,
    },
    applied: true,
  };
}

function createRuntimeSimLogOutputContract({ runtimeInput, simLog }) {
  return {
    sourceKind: 'azpr-runtime-sim-log-output',
    status:
      simLog.length > 0
        ? 'runtime-sim-log-ready'
        : 'runtime-sim-log-ready-no-applied-deltas',
    inputSource: ACTION_HIT_THREE_VALUE_RUNTIME_INPUT_SOURCE,
    inputSourceKind: runtimeInput.sourceKind,
    rowCount: simLog.length,
    keyFields: ['sourceDeltaId', 'runtimeSequenceIndex'],
    eventType: 'THREE_VALUE_DELTA_APPLIED',
    valueFields: ['delta', 'hpDelta', 'toughnessDelta', 'energyDelta'],
    aggregateFields: [
      'actionThreeValueDeltaAggregate',
      'hitThreeValueDeltaAggregate',
    ],
    calculatorFields: [
      'calculatorKey',
      'calculatorVersion',
      'calculationKind',
      'calculationStatus',
      'calculationReplaceable',
    ],
    applied: true,
  };
}

function createRuntimeStateCurvesOutputContract({
  stateCurves,
  enemyStateCurve,
  resourceCurves,
}) {
  return {
    sourceKind: stateCurves.sourceKind,
    status: stateCurves.status,
    outputFields: ['enemy', 'resources', 'summary'],
    enemy: {
      sourceKind: enemyStateCurve.sourceKind,
      status: enemyStateCurve.status,
      pointCount: enemyStateCurve.pointCount,
      valueFields: ['hpDelta', 'toughnessDelta'],
      stateMetricKeys: Object.keys(enemyStateCurve.stateMetrics ?? {}),
    },
    resources: {
      sourceKind: resourceCurves.sourceKind,
      status: resourceCurves.status,
      actorCount: resourceCurves.summary.actorCount,
      pointCount: resourceCurves.summary.pointCount,
      resourceKind: resourceCurves.resourceKind,
      valueFields: ['energyDelta'],
    },
    summaryFields: [
      'enemyPointCount',
      'enemyHpDelta',
      'enemyToughnessDelta',
      'stateCurvePointCount',
      'resourceActorCount',
      'resourcePointCount',
      'selfEnergyDelta',
    ],
    applied: true,
  };
}

function createRuntimeResourceCurvesOutputContract(resourceCurves) {
  return {
    sourceKind: resourceCurves.sourceKind,
    status: resourceCurves.status,
    resourceKind: resourceCurves.resourceKind,
    curveCollectionField: 'curvesByActor',
    actorCount: resourceCurves.summary.actorCount,
    activeActorCount: resourceCurves.summary.activeActorCount,
    pointCount: resourceCurves.summary.pointCount,
    curveKeyFields: ['actorId'],
    pointKeyFields: ['sourceDeltaId', 'runtimeSequenceIndex'],
    valueFields: ['delta', 'energyDelta'],
    stateMetricField: 'stateMetric',
    applied: true,
  };
}

function createRuntimeSummaryOutputContract(summary) {
  return {
    sourceKind: 'azpr-runtime-summary-output',
    status: 'runtime-summary-ready',
    source: summary.source,
    valueFields: [
      'enemyHpDelta',
      'enemyToughnessDelta',
      'selfEnergyDelta',
      'enemyHpInitial',
      'enemyHpRemaining',
      'enemyToughnessInitial',
      'enemyToughnessRemaining',
    ],
    countFields: [
      'inputDeltaCount',
      'appliedDeltaCount',
      'enemyStatePointCount',
      'stateCurvePointCount',
      'selfEnergyPointCount',
      'resourceCurveActorCount',
      'resourceCurvePointCount',
      'simLogCount',
      'calculatorCount',
      'valueSourceSlotCount',
      'runtimeValueSourceSlotCount',
      'replaceableValueSourceSlotCount',
    ],
    sourceFields: [
      'runtimeInputSourceKind',
      'runtimeInputSourceInputKind',
      'runtimeInputSourceInputStatus',
      'runtimeGenerationEntrySourceKind',
      'runtimeGenerationEntryStatus',
      'runtimeGenerationLayerSourceKind',
      'runtimeGenerationLayerStatus',
      'runtimeInputGenerationValueSourceSlotsPath',
      'runtimeInputGenerationValueSourceSlotsSourceTier',
    ],
    appliedOnly: summary.appliedOnly,
    applied: true,
  };
}

function createThreeValueRuntimeEnemyStateCurve({ scenario, appliedDeltas }) {
  const points = appliedDeltas
    .filter(delta =>
      ['enemyHpDamage', 'enemyToughnessDamage'].includes(delta.trackKey)
    )
    .map((delta, index) => createThreeValueRuntimePoint(delta, index));
  const hpDelta = sumThreeValueRuntimeDeltas(points, 'hpDelta');
  const toughnessDelta = sumThreeValueRuntimeDeltas(points, 'toughnessDelta');
  const baseline = createThreeValueRuntimeEnemyBaseline(scenario);
  const stateMetrics = {
    hp: createThreeValueRuntimeStateMetric({
      key: 'hp',
      label: '敌人 HP',
      valueUnit: 'hp',
      baseline: baseline.hp,
      delta: hpDelta,
      deltaDirection: 'decrease',
      stateLabel: '剩余',
    }),
    toughness: createThreeValueRuntimeStateMetric({
      key: 'toughness',
      label: '敌人韧性',
      valueUnit: 'toughness',
      baseline: baseline.toughness,
      delta: toughnessDelta,
      deltaDirection: 'decrease',
      stateLabel: '剩余',
    }),
  };

  return {
    sourceKind: 'three-value-runtime-input-applied-enemy-deltas',
    status:
      points.length > 0
        ? 'enemy-state-curve-ready-from-applied-deltas'
        : 'enemy-state-curve-ready-no-applied-deltas',
    pointCount: points.length,
    frameMin: minNumber(points.map(point => point.frameIndex)),
    frameMax: maxNumber(points.map(point => point.frameIndex)),
    hpDelta,
    toughnessDelta,
    baseline,
    stateMetrics,
    hpInitial: stateMetrics.hp.initialValue,
    hpRemaining: stateMetrics.hp.currentValue,
    hpBaselineStatus: stateMetrics.hp.baselineStatus,
    toughnessInitial: stateMetrics.toughness.initialValue,
    toughnessRemaining: stateMetrics.toughness.currentValue,
    toughnessBaselineStatus: stateMetrics.toughness.baselineStatus,
    points,
    applied: true,
  };
}

function createThreeValueRuntimeSelfEnergyCurveByActor({
  scenario,
  appliedDeltas,
}) {
  const actorGroups = new Map(
    scenario.actors.map((actor, index) => [
      actor.id,
      {
        actorId: actor.id,
        actorName: actor.name,
        resource: 'sp',
        baseline: createThreeValueRuntimeSelfEnergyBaseline(actor),
        order: index,
        delta: 0,
        pointCount: 0,
        points: [],
      },
    ])
  );
  const selfEnergyDeltas = appliedDeltas.filter(
    delta => delta.trackKey === 'selfEnergyChange'
  );

  for (const [index, delta] of selfEnergyDeltas.entries()) {
    const actorId = delta.actorId ?? 'unknown';
    if (!actorGroups.has(actorId)) {
      actorGroups.set(actorId, {
        actorId,
        actorName: delta.actorName ?? '未知角色',
        resource: delta.valueUnit ?? 'sp',
        baseline: createThreeValueRuntimeSelfEnergyBaseline(null),
        order: actorGroups.size,
        delta: 0,
        pointCount: 0,
        points: [],
      });
    }
    const group = actorGroups.get(actorId);
    const point = createThreeValueRuntimePoint(delta, index);
    group.points.push(point);
    group.pointCount += 1;
    group.delta = roundCurveValue(
      group.delta + (numberOrNull(point.energyDelta) ?? 0)
    );
    group.resource = point.valueUnit ?? group.resource;
  }

  return [...actorGroups.values()]
    .map(group => ({
      actorId: group.actorId,
      actorName: group.actorName,
      resource: group.resource,
      delta: roundCurveValue(group.delta),
      baseline: group.baseline,
      stateMetric: createThreeValueRuntimeStateMetric({
        key: 'selfEnergy',
        label: '自身能量',
        valueUnit: group.resource,
        baseline: group.baseline,
        delta: roundCurveValue(group.delta),
        deltaDirection: 'increase',
        stateLabel: '当前',
      }),
      pointCount: group.pointCount,
      points: group.points.sort(compareThreeValueRuntimePoints),
      applied: true,
      order: group.order,
    }))
    .sort((left, right) => left.order - right.order)
    .map(({ order, ...group }) => group);
}

function createThreeValueRuntimeSimLog(appliedDeltas) {
  return appliedDeltas.map((delta, index) => ({
    eventType: 'THREE_VALUE_DELTA_APPLIED',
    sequenceIndex: index,
    sourceDeltaId: delta.id,
    timeMs: delta.timeMs,
    frameIndex: delta.frameIndex,
    frameLabel: delta.frameLabel,
    actionId: delta.actionId,
    actionName: delta.actionName,
    actorId: delta.actorId,
    actorName: delta.actorName,
    hitKey: delta.hitKey,
    hitIndex: delta.hitIndex,
    trackKey: delta.trackKey,
    layerKey: delta.layerKey,
    delta: normalizeThreeValueRuntimeNumber(delta.delta),
    hpDelta: normalizeThreeValueRuntimeNumber(delta.hpDelta),
    toughnessDelta: normalizeThreeValueRuntimeNumber(delta.toughnessDelta),
    energyDelta: normalizeThreeValueRuntimeNumber(delta.energyDelta),
    actionThreeValueDeltaAggregate:
      delta.actionThreeValueDeltaAggregate ?? null,
    hitThreeValueDeltaAggregate: delta.hitThreeValueDeltaAggregate ?? null,
    calculator: delta.calculator ?? null,
    calculatorKey: delta.calculatorKey ?? delta.calculator?.key ?? null,
    calculatorVersion:
      numberOrNull(delta.calculatorVersion ?? delta.calculator?.version) ??
      null,
    calculationKind: delta.calculationKind ?? delta.calculator?.kind ?? null,
    calculationStatus:
      delta.calculationStatus ?? delta.calculator?.status ?? null,
    calculationReplaceable:
      typeof delta.calculationReplaceable === 'boolean'
        ? delta.calculationReplaceable
        : (delta.calculator?.replaceable ?? null),
    confidence: delta.confidence,
    stateCurveSequenceIndex: delta.stateCurveSequenceIndex,
    runtimeSequenceIndex: delta.runtimeSequenceIndex ?? index,
    applied: true,
  }));
}

function createThreeValueRuntimePoint(delta, sequenceIndex) {
  return {
    sourceKind: 'three-value-runtime-input-applied-delta',
    sourceDeltaId: delta.id,
    sequenceIndex,
    runtimeSequenceIndex: delta.runtimeSequenceIndex ?? sequenceIndex,
    stateCurveSequenceIndex: delta.stateCurveSequenceIndex,
    actionId: delta.actionId,
    actionName: delta.actionName,
    actionType: delta.actionType,
    actorId: delta.actorId,
    actorName: delta.actorName,
    hitKey: delta.hitKey,
    hitIndex: delta.hitIndex,
    hitSkillId: delta.hitSkillId,
    frameIndex: delta.frameIndex,
    frameLabel: delta.frameLabel,
    timeMs: delta.timeMs,
    trackKey: delta.trackKey,
    trackLabel: delta.trackLabel,
    layerKey: delta.layerKey,
    valueUnit: delta.valueUnit,
    delta: normalizeThreeValueRuntimeNumber(delta.delta),
    hpDelta: normalizeThreeValueRuntimeNumber(delta.hpDelta),
    toughnessDelta: normalizeThreeValueRuntimeNumber(delta.toughnessDelta),
    energyDelta: normalizeThreeValueRuntimeNumber(delta.energyDelta),
    actionThreeValueDeltaAggregate:
      delta.actionThreeValueDeltaAggregate ?? null,
    hitThreeValueDeltaAggregate: delta.hitThreeValueDeltaAggregate ?? null,
    calculator: delta.calculator ?? null,
    calculatorKey: delta.calculatorKey ?? delta.calculator?.key ?? null,
    calculatorVersion:
      numberOrNull(delta.calculatorVersion ?? delta.calculator?.version) ??
      null,
    calculationKind: delta.calculationKind ?? delta.calculator?.kind ?? null,
    calculationStatus:
      delta.calculationStatus ?? delta.calculator?.status ?? null,
    calculationReplaceable:
      typeof delta.calculationReplaceable === 'boolean'
        ? delta.calculationReplaceable
        : (delta.calculator?.replaceable ?? null),
    confidence: delta.confidence,
    sourceStatus: delta.sourceStatus,
    resultStatus: delta.resultStatus,
    sourceIds: delta.sourceIds,
    applied: true,
  };
}

function createThreeValueRuntimeStateCurves({
  enemyStateCurve,
  resourceCurves,
}) {
  return {
    sourceKind: 'azpr-runtime-state-curves-from-standard-deltas',
    status: 'runtime-state-curves-ready-from-standard-deltas',
    enemy: enemyStateCurve,
    resources: resourceCurves,
    summary: {
      enemyPointCount: enemyStateCurve.pointCount,
      enemyHpDelta: enemyStateCurve.hpDelta,
      enemyToughnessDelta: enemyStateCurve.toughnessDelta,
      stateCurvePointCount: roundCurveValue(
        enemyStateCurve.pointCount + resourceCurves.summary.pointCount
      ),
      resourceActorCount: resourceCurves.summary.actorCount,
      activeResourceActorCount: resourceCurves.summary.activeActorCount,
      resourcePointCount: resourceCurves.summary.pointCount,
      selfEnergyDelta: resourceCurves.summary.selfEnergyDelta,
      applied: true,
    },
    applied: true,
  };
}

function createThreeValueRuntimeResourceCurves(selfEnergyCurveByActor) {
  const pointCount = selfEnergyCurveByActor.reduce(
    (sum, actor) => sum + actor.pointCount,
    0
  );
  return {
    sourceKind: 'azpr-runtime-resource-curves-from-standard-deltas',
    status:
      pointCount > 0
        ? 'resource-curves-ready-from-standard-deltas'
        : 'resource-curves-ready-no-applied-resource-deltas',
    resourceKind: 'selfEnergy',
    curvesByActor: selfEnergyCurveByActor,
    summary: {
      actorCount: selfEnergyCurveByActor.length,
      activeActorCount: selfEnergyCurveByActor.filter(
        actor => actor.pointCount > 0
      ).length,
      pointCount,
      selfEnergyDelta: roundCurveValue(
        selfEnergyCurveByActor.reduce(
          (sum, actor) => sum + (numberOrNull(actor.delta) ?? 0),
          0
        )
      ),
      applied: true,
    },
    applied: true,
  };
}

function summarizeThreeValueRuntimeProjection({
  runtimeInput,
  appliedDeltas,
  enemyStateCurve,
  selfEnergyCurveByActor,
  resourceCurves,
  simLog,
}) {
  const selfEnergyPointCount = selfEnergyCurveByActor.reduce(
    (sum, actor) => sum + actor.pointCount,
    0
  );
  const calculatorSummary = summarizeThreeValueCalculators(appliedDeltas);
  const generationReadSummary =
    summarizeRuntimeInputGenerationReadSources(runtimeInput);

  return {
    inputContractName: runtimeInput.contractName,
    inputDeltaCount: runtimeInput.summary.inputDeltaCount,
    runtimeInputStatus: runtimeInput.status,
    runtimeInputSourceKind: runtimeInput.sourceKind,
    runtimeInputSourceInputKind: runtimeInput.runtimeInputSourceKind,
    runtimeInputSourceInputStatus: runtimeInput.runtimeInputSourceStatus,
    runtimeGenerationEntrySourceKind: runtimeInput.generationEntrySourceKind,
    runtimeGenerationEntryStatus: runtimeInput.generationEntryStatus,
    runtimeGenerationLayerSourceKind: runtimeInput.generationLayerSourceKind,
    runtimeGenerationLayerStatus: runtimeInput.generationLayerStatus,
    runtimeInputIgnoredDeltaCount: runtimeInput.ignoredDeltaCount,
    valueSourceSlotCount: runtimeInput.summary.valueSourceSlotCount ?? 0,
    runtimeValueSourceSlotCount:
      runtimeInput.summary.runtimeValueSourceSlotCount ?? 0,
    replaceableValueSourceSlotCount:
      runtimeInput.summary.replaceableValueSourceSlotCount ?? 0,
    runtimeInputGenerationValueSourceSlotsPath:
      runtimeInput.summary.runtimeInputGenerationValueSourceSlotsPath ?? '',
    runtimeInputGenerationValueSourceSlotsSourceTier:
      runtimeInput.summary.runtimeInputGenerationValueSourceSlotsSourceTier ??
      '',
    runtimeInputGenerationValueSourceSlotsStandardOutputPresent: Boolean(
      runtimeInput.summary
        .runtimeInputGenerationValueSourceSlotsStandardOutputPresent
    ),
    ...generationReadSummary,
    appliedDeltaCount: appliedDeltas.length,
    enemyHpDelta: sumThreeValueRuntimeDeltas(appliedDeltas, 'hpDelta'),
    enemyToughnessDelta: sumThreeValueRuntimeDeltas(
      appliedDeltas,
      'toughnessDelta'
    ),
    selfEnergyDelta: sumThreeValueRuntimeDeltas(appliedDeltas, 'energyDelta'),
    selfEnergyActorCount: selfEnergyCurveByActor.length,
    enemyStatePointCount: enemyStateCurve.pointCount,
    stateCurvePointCount: roundCurveValue(
      enemyStateCurve.pointCount + resourceCurves.summary.pointCount
    ),
    selfEnergyPointCount,
    resourceCurveActorCount: resourceCurves.summary.actorCount,
    activeResourceCurveActorCount: resourceCurves.summary.activeActorCount,
    resourceCurvePointCount: resourceCurves.summary.pointCount,
    enemyHpInitial: enemyStateCurve.stateMetrics?.hp?.initialValue ?? null,
    enemyHpRemaining: enemyStateCurve.stateMetrics?.hp?.currentValue ?? null,
    enemyHpBaselineStatus:
      enemyStateCurve.stateMetrics?.hp?.baselineStatus ?? null,
    enemyToughnessInitial:
      enemyStateCurve.stateMetrics?.toughness?.initialValue ?? null,
    enemyToughnessRemaining:
      enemyStateCurve.stateMetrics?.toughness?.currentValue ?? null,
    enemyToughnessBaselineStatus:
      enemyStateCurve.stateMetrics?.toughness?.baselineStatus ?? null,
    selfEnergyBaselineReadyActorCount: selfEnergyCurveByActor.filter(
      actor => actor.stateMetric?.baselineConfirmed
    ).length,
    simLogCount: simLog.length,
    calculatorCount: calculatorSummary.calculatorCount,
    calculatorKeys: calculatorSummary.calculatorKeys,
    calculatorReplaceableDeltaCount:
      calculatorSummary.calculatorReplaceableDeltaCount,
    calculatorStatuses: calculatorSummary.statuses,
    calculatorSummary,
    source: ACTION_HIT_THREE_VALUE_RUNTIME_INPUT_SOURCE,
    runtimeInputSource: ACTION_HIT_THREE_VALUE_RUNTIME_INPUT_SOURCE,
    appliedOnly: true,
    applied: true,
  };
}

function summarizeRuntimeInputGenerationReadSources(runtimeInput) {
  const generationReadSources = runtimeInput?.generationReadSources ?? {};
  const generationReadInputs = generationReadSources.inputs ?? {};
  return {
    runtimeInputGenerationReadSourcesStatus: generationReadSources.status ?? '',
    runtimeInputGenerationReadStandardOutputCount: numberOrZero(
      generationReadSources.standardOutputCount
    ),
    runtimeInputGenerationReadFallbackInputCount: numberOrZero(
      generationReadSources.fallbackInputCount
    ),
    runtimeInputGenerationReadUsesLegacyFallback: Boolean(
      generationReadSources.usesLegacyGenerationFallback
    ),
    runtimeInputGenerationStandardBoundaryReady: Boolean(
      generationReadSources.standardGenerationBoundaryReady
    ),
    runtimeInputGenerationEntryContractValidationStatus:
      runtimeInput?.generationEntryContractValidationStatus ??
      generationReadSources.generationEntryContractValidationStatus ??
      '',
    runtimeInputGenerationEntryContractValidationIssueCount: numberOrZero(
      runtimeInput?.generationEntryContractValidationIssueCount ??
        generationReadSources.generationEntryContractValidationIssueCount
    ),
    runtimeInputGenerationEntryContractValidationValid: Boolean(
      runtimeInput?.generationEntryContractValidationValid ??
      generationReadSources.generationEntryContractValidationValid
    ),
    runtimeInputGenerationEntryAggregateValidationStatus:
      runtimeInput?.generationEntryAggregateValidationStatus ??
      generationReadSources.generationEntryAggregateValidationStatus ??
      '',
    runtimeInputGenerationEntryAggregateValidationIssueCount: numberOrZero(
      runtimeInput?.generationEntryAggregateValidationIssueCount ??
        generationReadSources.generationEntryAggregateValidationIssueCount
    ),
    runtimeInputGenerationEntryAggregateValidationValid: Boolean(
      runtimeInput?.generationEntryAggregateValidationValid ??
      generationReadSources.generationEntryAggregateValidationValid
    ),
    runtimeInputGenerationAggregateBoundaryReady: Boolean(
      generationReadSources.standardGenerationAggregateBoundaryReady
    ),
    runtimeInputGenerationEntryPath:
      generationReadInputs.generationEntry?.sourcePath ?? '',
    runtimeInputGenerationRuntimeInputSourcePath:
      generationReadInputs.runtimeInputSource?.sourcePath ?? '',
    runtimeInputGenerationStandardContractPath:
      generationReadInputs.standardContract?.sourcePath ?? '',
    runtimeInputGenerationDeltasPath:
      generationReadInputs.deltas?.sourcePath ?? '',
    runtimeInputGenerationContractValidationPath:
      generationReadInputs.contractValidation?.sourcePath ?? '',
    runtimeInputGenerationAggregateValidationPath: generationReadInputs
      .contractValidation?.sourcePath
      ? `${generationReadInputs.contractValidation.sourcePath}.aggregateValidation`
      : '',
  };
}

export function createSelfEnergyDeltaSummaryByActor(selfEnergyCurveByActor) {
  return selfEnergyCurveByActor.map(actor => ({
    actorId: actor.actorId,
    actorName: actor.actorName,
    resource: actor.resource,
    delta: actor.delta,
    currentValue: actor.stateMetric?.currentValue ?? null,
    baselineStatus: actor.stateMetric?.baselineStatus ?? null,
  }));
}

function createThreeValueRuntimeEnemyBaseline(scenario) {
  const enemy = scenario?.enemy ?? {};
  const baseHp = firstRuntimeNumber(
    enemy.stats?.maxHp,
    enemy.maxHp,
    enemy.baseHp,
    enemy.source?.enemy?.stats?.maxHp,
    enemy.source?.enemy?.maxHp
  );
  const hpMultiplier = firstRuntimeNumber(enemy.hpMultiplier, 1) ?? 1;
  const hpInitial = Number.isFinite(baseHp)
    ? roundCurveValue(baseHp * hpMultiplier)
    : null;

  return {
    hp: {
      sourceKind: 'scenario-enemy-hp-baseline',
      sourceStatus:
        hpInitial == null
          ? 'baseline-pending-missing-scenario-enemy-max-hp'
          : 'baseline-derived-from-scenario-enemy-max-hp',
      sourcePath: 'scenario.enemy.stats.maxHp * scenario.enemy.hpMultiplier',
      initialValue: hpInitial,
      baseValue: Number.isFinite(baseHp) ? baseHp : null,
      multiplier: Number.isFinite(hpMultiplier) ? hpMultiplier : null,
      valueUnit: 'hp',
      applied: hpInitial != null,
    },
    toughness: {
      sourceKind: 'scenario-enemy-toughness-baseline',
      sourceStatus: 'baseline-pending-azpr-enemy-toughness-state',
      sourcePath: 'pending enemy weak-break/toughness state evidence',
      initialValue: null,
      baseValue: null,
      multiplier: null,
      valueUnit: 'toughness',
      applied: false,
    },
  };
}

function createThreeValueRuntimeSelfEnergyBaseline(actor) {
  const initialValue = firstRuntimeNumber(
    actor?.initialSp,
    actor?.initialEnergy,
    actor?.resourceState?.sp,
    actor?.resources?.sp,
    actor?.stats?.sp
  );
  const maxValue = firstRuntimeNumber(
    actor?.stats?.maxSp,
    actor?.maxSp,
    actor?.baseAttributes?.find(item => item.key === 'MAXSP')?.value
  );

  return {
    sourceKind: 'scenario-actor-self-energy-baseline',
    sourceStatus:
      initialValue == null
        ? 'baseline-pending-azpr-initial-self-energy'
        : 'baseline-derived-from-scenario-actor-self-energy',
    sourcePath:
      initialValue == null
        ? 'pending battle start/current SP evidence'
        : 'scenario.actor.initialSp|initialEnergy|resourceState.sp',
    initialValue: initialValue == null ? null : roundCurveValue(initialValue),
    maxValue: maxValue == null ? null : roundCurveValue(maxValue),
    maxValueSourceStatus:
      maxValue == null ? 'max-sp-missing' : 'max-sp-derived-from-actor-stats',
    valueUnit: 'sp',
    applied: initialValue != null,
  };
}

function createThreeValueRuntimeStateMetric({
  key,
  label,
  valueUnit,
  baseline,
  delta,
  deltaDirection,
  stateLabel,
}) {
  const initialValue = strictRuntimeNumberOrNull(baseline?.initialValue);
  const normalizedDelta = normalizeThreeValueRuntimeNumber(delta) ?? 0;
  const baselineConfirmed = Number.isFinite(initialValue);
  const rawCurrentValue = baselineConfirmed
    ? roundCurveValue(
        deltaDirection === 'decrease'
          ? initialValue - normalizedDelta
          : initialValue + normalizedDelta
      )
    : null;
  const currentValue =
    rawCurrentValue != null && deltaDirection === 'decrease'
      ? Math.max(0, rawCurrentValue)
      : rawCurrentValue;

  return {
    key,
    label,
    stateLabel,
    valueUnit: baseline?.valueUnit ?? valueUnit,
    initialValue: baselineConfirmed ? initialValue : null,
    maxValue: baseline?.maxValue ?? null,
    delta: normalizedDelta,
    rawCurrentValue,
    currentValue,
    overrunValue:
      rawCurrentValue != null && deltaDirection === 'decrease'
        ? Math.max(0, roundCurveValue(-rawCurrentValue))
        : 0,
    remainingValue: deltaDirection === 'decrease' ? currentValue : null,
    deltaDirection,
    baselineConfirmed,
    baselineStatus:
      baseline?.sourceStatus ??
      (baselineConfirmed ? 'baseline-confirmed' : 'baseline-pending'),
    stateStatus: baselineConfirmed
      ? 'state-derived-from-baseline-and-applied-delta'
      : 'state-baseline-pending',
    sourceKind: baseline?.sourceKind ?? null,
    sourcePath: baseline?.sourcePath ?? null,
    baseValue: baseline?.baseValue ?? null,
    multiplier: baseline?.multiplier ?? null,
    applied: baselineConfirmed,
  };
}

function firstRuntimeNumber(...values) {
  for (const value of values) {
    const number = strictRuntimeNumberOrNull(value);
    if (Number.isFinite(number)) {
      return number;
    }
  }
  return null;
}

function strictRuntimeNumberOrNull(value) {
  if (value == null || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sumThreeValueRuntimeDeltas(items, field) {
  return roundCurveValue(
    items.reduce((sum, item) => {
      const value = numberOrNull(item[field]);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0)
  );
}

function normalizeThreeValueRuntimeNumber(value) {
  if (value == null || value === '') {
    return null;
  }
  const numericValue = numberOrNull(value);
  return Number.isFinite(numericValue) ? roundCurveValue(numericValue) : null;
}

function compareThreeValueRuntimePoints(left, right) {
  return (
    compareNullableTimelineNumber(left.frameIndex, right.frameIndex) ||
    compareNullableTimelineNumber(left.timeMs, right.timeMs) ||
    compareNullableTimelineNumber(left.sequenceIndex, right.sequenceIndex) ||
    String(left.sourceDeltaId ?? '').localeCompare(
      String(right.sourceDeltaId ?? '')
    )
  );
}

function compareNullableTimelineNumber(left, right) {
  const leftNumber = numberOrNull(left);
  const rightNumber = numberOrNull(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }
  if (Number.isFinite(leftNumber)) {
    return -1;
  }
  if (Number.isFinite(rightNumber)) {
    return 1;
  }
  return 0;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function finiteValues(values) {
  return values.map(numberOrNull).filter(Number.isFinite);
}

function minNumber(values) {
  const finite = finiteValues(values);
  return finite.length > 0 ? Math.min(...finite) : null;
}

function maxNumber(values) {
  const finite = finiteValues(values);
  return finite.length > 0 ? Math.max(...finite) : null;
}

function roundCurveValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(6)) : 0;
}
