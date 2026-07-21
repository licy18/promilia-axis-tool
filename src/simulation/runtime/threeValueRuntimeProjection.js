import { summarizeThreeValueCalculators } from '../threeValueCalculatorAdapters';
import {
  ACTION_HIT_THREE_VALUE_RUNTIME_INPUT_SOURCE,
  createThreeValueRuntimeInput,
} from './threeValueRuntimeInput';
import { createThreeValueRuntimeOutputConsumerContract } from './threeValueRuntimeOutputConsumer';
import {
  createThreeValueRuntimeHitTransactionByDeltaId,
  createThreeValueRuntimeHitTransactions,
} from './threeValueRuntimeHitTransactions';
import { createEffectRuntimeTimeline } from './effectRuntimeTimeline';
import { createKiboEnergyRuntimeCurves } from './kiboEnergyRuntimeCurves';
import { createControlledActorTimeline } from './controlledActorTimeline';
import { createActionEffectRelationGraph } from './actionEffectRelationGraph';
import {
  createThreeValueRuntimeEnemyBaseline,
  createThreeValueRuntimeSelfEnergyBaseline,
  createThreeValueRuntimeStateMetric,
  createThreeValueRuntimeStateSnapshots,
} from './threeValueRuntimeStateSnapshots';

export function createThreeValueRuntimeProjection({
  scenario,
  generationOutputs,
  runtimeInputSource,
  actionHitThreeValueDeltaGeneration,
  threeValueGenerationLayer,
  threeValueMechanicsAdapterRegistry,
  effectTimeline,
  actionExecutionPlan,
  controlledActorTimeline,
  actionEffectRelationGraph,
  verifiedCombatRuntime = null,
}) {
  const runtimeControlledActorTimeline =
    controlledActorTimeline ??
    createControlledActorTimeline({ scenario, actionExecutionPlan });
  const runtimeInput = createThreeValueRuntimeInput({
    generationOutputs,
    runtimeInputSource,
    actionHitThreeValueDeltaGeneration,
    threeValueGenerationLayer,
  });
  const generationAppliedDeltas = runtimeInput.appliedDeltas;
  const runtimeStateSnapshots = createThreeValueRuntimeStateSnapshots({
    scenario,
    appliedDeltas: generationAppliedDeltas,
    threeValueMechanicsAdapterRegistry,
  });
  const appliedDeltas = runtimeStateSnapshots.runtimeDeltas;
  const stateSnapshotByDeltaId = new Map(
    runtimeStateSnapshots.snapshots.map(snapshot => [
      snapshot.sourceDeltaId,
      snapshot,
    ])
  );
  const hitTransactions = createThreeValueRuntimeHitTransactions({
    appliedDeltas,
    stateSnapshots: runtimeStateSnapshots,
  });
  const hitTransactionByDeltaId =
    createThreeValueRuntimeHitTransactionByDeltaId(hitTransactions);
  const runtimeEffectTimeline =
    effectTimeline ??
    createEffectRuntimeTimeline({ scenario, actionExecutionPlan });
  const runtimeActionEffectRelationGraph =
    actionEffectRelationGraph ??
    createActionEffectRelationGraph({
      scenario,
      effectTimeline: runtimeEffectTimeline,
      actionExecutionPlan,
    });
  const enemyStateCurve = createThreeValueRuntimeEnemyStateCurve({
    scenario,
    appliedDeltas,
    runtimeStateSnapshots,
    stateSnapshotByDeltaId,
    hitTransactionByDeltaId,
  });
  const selfEnergyCurveByActor = createThreeValueRuntimeSelfEnergyCurveByActor({
    scenario,
    appliedDeltas,
    runtimeStateSnapshots,
    stateSnapshotByDeltaId,
    hitTransactionByDeltaId,
  });
  const kiboEnergyCurveBySlot = createKiboEnergyRuntimeCurves({
    scenario,
    verifiedCombatRuntime,
  });
  const simLog = createThreeValueRuntimeSimLog(
    appliedDeltas,
    stateSnapshotByDeltaId,
    hitTransactionByDeltaId
  );
  const resourceCurves = createThreeValueRuntimeResourceCurves({
    selfEnergyCurveByActor,
    kiboEnergyCurveBySlot,
  });
  const stateCurves = createThreeValueRuntimeStateCurves({
    enemyStateCurve,
    resourceCurves,
    runtimeStateSnapshots,
  });
  const baseSummary = summarizeThreeValueRuntimeProjection({
    runtimeInput,
    appliedDeltas,
    enemyStateCurve,
    selfEnergyCurveByActor,
    kiboEnergyCurveBySlot,
    resourceCurves,
    simLog,
    runtimeStateSnapshots,
    hitTransactions,
    effectTimeline: runtimeEffectTimeline,
    actionExecutionPlan,
    controlledActorTimeline: runtimeControlledActorTimeline,
  });
  const outputContract = createThreeValueRuntimeOutputContract({
    runtimeInput,
    appliedDeltas,
    enemyStateCurve,
    resourceCurves,
    stateCurves,
    hitTransactions,
    effectTimeline: runtimeEffectTimeline,
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
    runtimeStateSnapshots,
    hitTransactions,
    effectTimeline: runtimeEffectTimeline,
    actionExecutionPlan,
    controlledActorTimeline: runtimeControlledActorTimeline,
    actionEffectRelationGraph: runtimeActionEffectRelationGraph,
    verifiedCombatRuntime,
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
        : runtimeEffectTimeline.events.length > 0
          ? 'runtime-projection-ready-with-effect-events'
          : 'runtime-projection-ready-no-applied-deltas',
    inputContractName: runtimeInput.contractName,
    runtimeInput,
    runtimeAppliedDeltas: appliedDeltas,
    appliedOnly: true,
    outputContract,
    runtimeOutputs,
    stateCurves,
    resourceCurves,
    runtimeStateSnapshots,
    hitTransactions,
    effectTimeline: runtimeEffectTimeline,
    actionExecutionPlan,
    controlledActorTimeline: runtimeControlledActorTimeline,
    enemyStateCurve,
    selfEnergyCurveByActor,
    kiboEnergyCurveBySlot,
    verifiedCombatRuntime,
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
  runtimeStateSnapshots,
  hitTransactions,
  effectTimeline,
  actionExecutionPlan,
  controlledActorTimeline,
  actionEffectRelationGraph,
  verifiedCombatRuntime,
}) {
  const outputConsistency = createRuntimeOutputConsistency({
    outputContract,
    simLog,
    stateCurves,
    resourceCurves,
    hitTransactions,
    effectTimeline,
    actionExecutionPlan,
    summary,
  });
  const outputConsumerContract = createThreeValueRuntimeOutputConsumerContract({
    outputContract,
    simLog,
    stateCurves,
    resourceCurves,
    hitTransactions,
    effectTimeline,
    controlledActorTimeline,
    actionEffectRelationGraph,
    verifiedCombatRuntime,
    summary,
    outputConsistency,
  });
  return {
    schemaVersion: 5,
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
      stateSnapshots: 'stateCurves.snapshots',
    },
    supplementalOutputNames: [
      'controlledActorTimeline',
      'actionEffectRelationGraph',
      'verifiedCombatRuntime',
    ],
    outputContract,
    outputConsumerContract,
    consumerContract: outputConsumerContract,
    simLog,
    stateCurves,
    resourceCurves,
    resources: resourceCurves,
    stateSnapshots: runtimeStateSnapshots,
    hitTransactions,
    effectTimeline,
    actionExecutionPlan,
    controlledActorTimeline,
    actionEffectRelationGraph,
    verifiedCombatRuntime,
    summary,
    outputConsistency,
    outputs: {
      simLog,
      stateCurves,
      resourceCurves,
      hitTransactions,
      effectTimeline,
      controlledActorTimeline,
      actionEffectRelationGraph,
      verifiedCombatRuntime,
      resources: resourceCurves,
      summary,
    },
    outputSummary: {
      outputCount: outputContract.summary.outputCount,
      appliedDeltaCount: outputContract.summary.appliedDeltaCount,
      simLogCount: outputContract.summary.simLogCount,
      stateSnapshotCount: outputContract.summary.stateSnapshotCount,
      hitTransactionCount: outputContract.summary.hitTransactionCount,
      effectEventCount: outputContract.summary.effectEventCount,
      activeEffectCount: outputContract.summary.activeEffectCount,
      executionPlanActionCount: outputContract.summary.executionPlanActionCount,
      executionPlanExecutedActionCount:
        outputContract.summary.executionPlanExecutedActionCount,
      executionPlanSkippedActionCount:
        outputContract.summary.executionPlanSkippedActionCount,
      controlledActorTransitionCount:
        controlledActorTimeline?.summary?.transitionCount ?? 0,
      controlledActorIntervalCount:
        controlledActorTimeline?.summary?.intervalCount ?? 0,
      runtimeCalculatorInvocationCount:
        outputContract.summary.runtimeCalculatorInvocationCount,
      runtimeCalculatorReplacedInvocationCount:
        outputContract.summary.runtimeCalculatorReplacedInvocationCount,
      runtimeCalculatorFallbackInvocationCount:
        outputContract.summary.runtimeCalculatorFallbackInvocationCount,
      enemyStatePointCount: outputContract.summary.enemyStatePointCount,
      stateCurvePointCount: outputContract.summary.stateCurvePointCount,
      resourceCurveActorCount: outputContract.summary.resourceCurveActorCount,
      resourceCurveKiboCount: outputContract.summary.resourceCurveKiboCount,
      resourceEnergyCurveCount: outputContract.summary.resourceEnergyCurveCount,
      resourceCurveActorPointCount:
        outputContract.summary.resourceCurveActorPointCount,
      resourceCurveKiboPointCount:
        outputContract.summary.resourceCurveKiboPointCount,
      resourceCurvePointCount: outputContract.summary.resourceCurvePointCount,
      enemyHpDelta: outputContract.summary.enemyHpDelta,
      enemyToughnessDelta: outputContract.summary.enemyToughnessDelta,
      selfEnergyDelta: outputContract.summary.selfEnergyDelta,
      runtimeInputGenerationReadSourcesStatus:
        outputContract.summary.runtimeInputGenerationReadSourcesStatus,
      runtimeInputGenerationOutputBoundaryStatus:
        outputContract.summary.runtimeInputGenerationOutputBoundaryStatus,
      runtimeInputGenerationOutputBoundaryReady:
        outputContract.summary.runtimeInputGenerationOutputBoundaryReady,
      runtimeInputGenerationOutputBoundaryPath:
        outputContract.summary.runtimeInputGenerationOutputBoundaryPath,
      runtimeInputGenerationOutputBoundaryEntryPath:
        outputContract.summary.runtimeInputGenerationOutputBoundaryEntryPath,
      runtimeInputGenerationOutputBoundaryRuntimeInputSourcePath:
        outputContract.summary
          .runtimeInputGenerationOutputBoundaryRuntimeInputSourcePath,
      runtimeInputGenerationOutputBoundaryStandardContractPath:
        outputContract.summary
          .runtimeInputGenerationOutputBoundaryStandardContractPath,
      runtimeInputGenerationOutputBoundaryDeltasPath:
        outputContract.summary.runtimeInputGenerationOutputBoundaryDeltasPath,
      runtimeInputGenerationOutputBoundaryValueSourceSlotsPath:
        outputContract.summary
          .runtimeInputGenerationOutputBoundaryValueSourceSlotsPath,
      runtimeInputGenerationOutputBoundaryContractValidationPath:
        outputContract.summary
          .runtimeInputGenerationOutputBoundaryContractValidationPath,
      runtimeInputGenerationOutputBoundaryStandardOutputCount:
        outputContract.summary
          .runtimeInputGenerationOutputBoundaryStandardOutputCount,
      runtimeInputGenerationOutputBoundaryIssueCount:
        outputContract.summary.runtimeInputGenerationOutputBoundaryIssueCount,
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
  hitTransactions,
  effectTimeline,
  actionExecutionPlan,
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
  const resourceKiboPointCount = (resourceCurves?.curvesByKibo ?? []).reduce(
    (sum, kibo) => sum + (numberOrNull(kibo.pointCount) ?? 0),
    0
  );
  const stateSnapshots = stateCurves?.snapshots?.snapshots ?? [];
  const stateSnapshotCount = stateSnapshots.length;
  const runtimeCalculatorInvocationCount = stateSnapshots.filter(
    snapshot => snapshot.runtimeCalculatorInvocation
  ).length;
  const stateSnapshotByDeltaId = new Map(
    stateSnapshots.map(snapshot => [snapshot.sourceDeltaId, snapshot])
  );
  const runtimeHitTransactions = hitTransactions?.transactions ?? [];
  const hitTransactionCount = runtimeHitTransactions.length;
  const hitTransactionByDeltaId = new Map(
    runtimeHitTransactions.flatMap(transaction =>
      transaction.sourceDeltaIds.map(sourceDeltaId => [
        sourceDeltaId,
        transaction,
      ])
    )
  );
  const effectEventCount = effectTimeline?.events?.length ?? 0;
  const activeEffectCount = effectTimeline?.activeEffects?.length ?? 0;
  const executionPlanActionCount =
    actionExecutionPlan?.summary?.actionCount ?? 0;
  const executionPlanExecutedActionCount =
    actionExecutionPlan?.summary?.executedActionCount ?? 0;
  const executionPlanSkippedActionCount =
    actionExecutionPlan?.summary?.skippedActionCount ?? 0;
  const curvePoints = [
    ...(stateCurves?.enemy?.points ?? []),
    ...(resourceCurves?.curvesByActor ?? []).flatMap(
      actor => actor.points ?? []
    ),
    ...(resourceCurves?.curvesByKibo ?? []).flatMap(kibo => kibo.points ?? []),
  ];
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
      resourceCurves?.summary?.pointCount ===
      resourceActorPointCount + resourceKiboPointCount,
    summaryResourceCurveActorPointCount:
      summary.resourceCurveActorPointCount === resourceActorPointCount,
    summaryResourceCurveKiboPointCount:
      summary.resourceCurveKiboPointCount === resourceKiboPointCount,
    outputContractSummarySimLogCount:
      outputContract.summary.simLogCount === simLogCount,
    outputContractSummaryStateCurvePointCount:
      outputContract.summary.stateCurvePointCount === stateCurvePointCount,
    outputContractSummaryResourceCurveActorPointCount:
      outputContract.summary.resourceCurveActorPointCount ===
      resourceActorPointCount,
    outputContractSummaryResourceCurveKiboPointCount:
      outputContract.summary.resourceCurveKiboPointCount ===
      resourceKiboPointCount,
    summaryStateSnapshotCount:
      summary.stateSnapshotCount === stateSnapshotCount,
    summaryHitTransactionCount:
      summary.hitTransactionCount === hitTransactionCount,
    outputContractSummaryHitTransactionCount:
      outputContract.summary.hitTransactionCount === hitTransactionCount,
    summaryEffectEventCount: summary.effectEventCount === effectEventCount,
    summaryActiveEffectCount: summary.activeEffectCount === activeEffectCount,
    outputContractSummaryEffectEventCount:
      outputContract.summary.effectEventCount === effectEventCount,
    outputContractSummaryActiveEffectCount:
      outputContract.summary.activeEffectCount === activeEffectCount,
    effectTimelineSummaryEventCount:
      effectTimeline?.summary?.eventCount === effectEventCount,
    effectTimelineSummaryActiveCount:
      effectTimeline?.summary?.activeEffectCount === activeEffectCount,
    effectTimelineCalculatorIsolation:
      effectTimeline?.summary?.calculatorAppliedEffectCount ===
        (effectTimeline?.events ?? []).filter(
          event => event.appliedToCalculators === true
        ).length &&
      (effectTimeline?.events ?? [])
        .filter(event => event.appliedToCalculators === true)
        .every(
          event =>
            event.sourceStatus === 'verified-battle-effect-generated' ||
            event.sourceStatus === 'effect-inherited-from-cycle-boundary'
        ),
    summaryExecutionPlanCounts:
      summary.executionPlanActionCount === executionPlanActionCount &&
      summary.executionPlanExecutedActionCount ===
        executionPlanExecutedActionCount &&
      summary.executionPlanSkippedActionCount ===
        executionPlanSkippedActionCount,
    outputContractExecutionPlanCounts:
      outputContract.summary.executionPlanActionCount ===
        executionPlanActionCount &&
      outputContract.summary.executionPlanExecutedActionCount ===
        executionPlanExecutedActionCount &&
      outputContract.summary.executionPlanSkippedActionCount ===
        executionPlanSkippedActionCount,
    hitTransactionSourceDeltasComplete:
      hitTransactionByDeltaId.size === simLogCount &&
      simLog.every(row => hitTransactionByDeltaId.has(row.sourceDeltaId)),
    simLogHitTransactionsShared: simLog.every(
      row =>
        row.hitTransaction === hitTransactionByDeltaId.get(row.sourceDeltaId)
    ),
    stateCurveHitTransactionsShared: curvePoints.every(
      point =>
        point.hitTransaction ===
        hitTransactionByDeltaId.get(point.sourceDeltaId)
    ),
    hitTransactionStateSnapshotsShared: runtimeHitTransactions.every(
      transaction =>
        transaction.sourceDeltaIds.length ===
          transaction.stateSnapshots.length &&
        transaction.sourceDeltaIds.every(
          (sourceDeltaId, index) =>
            transaction.stateSnapshots[index] ===
            stateSnapshotByDeltaId.get(sourceDeltaId)
        )
    ),
    hitTransactionDeltaTotalsMatch:
      hitTransactions?.summary?.enemyHpDelta === summary.enemyHpDelta &&
      hitTransactions?.summary?.enemyToughnessDelta ===
        summary.enemyToughnessDelta &&
      hitTransactions?.summary?.selfEnergyDelta === summary.selfEnergyDelta,
    simLogStateSnapshotsShared: simLog.every(
      row => row.stateSnapshot === stateSnapshotByDeltaId.get(row.sourceDeltaId)
    ),
    stateCurveSnapshotsShared: curvePoints.every(
      point =>
        point.stateSnapshot === stateSnapshotByDeltaId.get(point.sourceDeltaId)
    ),
    summaryRuntimeCalculatorInvocationCount:
      summary.runtimeCalculatorInvocationCount ===
      runtimeCalculatorInvocationCount,
    simLogCalculatorInvocationsShared: simLog.every(
      row =>
        row.runtimeCalculatorInvocation ===
        row.stateSnapshot?.runtimeCalculatorInvocation
    ),
    stateCurveCalculatorInvocationsShared: curvePoints.every(
      point =>
        point.runtimeCalculatorInvocation ===
        point.stateSnapshot?.runtimeCalculatorInvocation
    ),
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
    resourceKiboPointCount,
    stateSnapshotCount,
    hitTransactionCount,
    effectEventCount,
    activeEffectCount,
    executionPlanActionCount,
    executionPlanExecutedActionCount,
    executionPlanSkippedActionCount,
    runtimeCalculatorInvocationCount,
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
  hitTransactions,
  effectTimeline,
  simLog,
  summary,
}) {
  const outputs = {
    simLog: createRuntimeSimLogOutputContract({
      runtimeInput,
      simLog,
    }),
    hitTransactions:
      createRuntimeHitTransactionsOutputContract(hitTransactions),
    effectTimeline: createRuntimeEffectTimelineOutputContract(effectTimeline),
    stateCurves: createRuntimeStateCurvesOutputContract({
      stateCurves,
      enemyStateCurve,
      resourceCurves,
    }),
    resourceCurves: createRuntimeResourceCurvesOutputContract(resourceCurves),
    summary: createRuntimeSummaryOutputContract(summary),
  };
  return {
    schemaVersion: 3,
    sourceKind: 'azpr-three-value-runtime-output-contract',
    status:
      appliedDeltas.length > 0 || effectTimeline.events.length > 0
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
      stateSnapshotCount: stateCurves.snapshots.summary.snapshotCount,
      hitTransactionCount: hitTransactions.summary.transactionCount,
      effectEventCount: effectTimeline.summary.eventCount,
      activeEffectCount: effectTimeline.summary.activeEffectCount,
      executionPlanActionCount: summary.executionPlanActionCount,
      executionPlanExecutedActionCount:
        summary.executionPlanExecutedActionCount,
      executionPlanSkippedActionCount: summary.executionPlanSkippedActionCount,
      executionPlanUnresolvedExecutedActionCount:
        summary.executionPlanUnresolvedExecutedActionCount,
      runtimeCalculatorInvocationCount:
        stateCurves.snapshots.summary.runtimeCalculatorInvocationCount,
      mechanicsAdapterContractName:
        stateCurves.snapshots.summary.mechanicsAdapterContractName,
      mechanicsAdapterContractVersion:
        stateCurves.snapshots.summary.mechanicsAdapterContractVersion,
      mechanicsAdapterRegistrationKeys:
        stateCurves.snapshots.summary.mechanicsAdapterRegistrationKeys,
      mechanicsProfileIds: stateCurves.snapshots.summary.mechanicsProfileIds,
      mechanicsProfileVersions:
        stateCurves.snapshots.summary.mechanicsProfileVersions,
      mechanicsProfileStatuses:
        stateCurves.snapshots.summary.mechanicsProfileStatuses,
      mechanicsProfileFallbackInvocationCount:
        stateCurves.snapshots.summary.mechanicsProfileFallbackInvocationCount,
      mechanicsProfileCapabilityReadyInvocationCount:
        stateCurves.snapshots.summary
          .mechanicsProfileCapabilityReadyInvocationCount,
      mechanicsProfileCapabilityMissingInvocationCount:
        stateCurves.snapshots.summary
          .mechanicsProfileCapabilityMissingInvocationCount,
      runtimeConfigurationReplayIdentities:
        stateCurves.snapshots.summary.runtimeConfigurationReplayIdentities,
      configurationRuntimeBindingReadyInvocationCount:
        stateCurves.snapshots.summary
          .configurationRuntimeBindingReadyInvocationCount,
      configurationRuntimeBindingMissingInvocationCount:
        stateCurves.snapshots.summary
          .configurationRuntimeBindingMissingInvocationCount,
      runtimeCalculatorReplacedInvocationCount:
        stateCurves.snapshots.summary.runtimeCalculatorReplacedInvocationCount,
      runtimeCalculatorFallbackInvocationCount:
        stateCurves.snapshots.summary.runtimeCalculatorFallbackInvocationCount,
      enemyStatePointCount: enemyStateCurve.pointCount,
      stateCurvePointCount: stateCurves.summary.stateCurvePointCount,
      resourceCurveActorCount: resourceCurves.summary.actorCount,
      resourceCurveKiboCount: resourceCurves.summary.kiboCount,
      resourceEnergyCurveCount: resourceCurves.summary.energyCurveCount,
      resourceCurveActorPointCount: resourceCurves.summary.actorPointCount,
      resourceCurveKiboPointCount: resourceCurves.summary.kiboPointCount,
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
    stateSnapshotField: 'stateSnapshot',
    hitTransactionField: 'hitTransaction',
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
      'runtimeCalculatorInvocation',
      'runtimeCalculatorAdapterKey',
      'runtimeCalculatorInvocationStatus',
      'runtimeCalculationChanged',
    ],
    applied: true,
  };
}

function createRuntimeHitTransactionsOutputContract(hitTransactions) {
  return {
    sourceKind: hitTransactions.sourceKind,
    status: hitTransactions.status,
    contractName: hitTransactions.contractName,
    collectionField: 'transactions',
    transactionCount: hitTransactions.summary.transactionCount,
    keyFields: ['transactionId'],
    identityFields: ['actionId', 'hitKey', 'frameIndex', 'timeMs'],
    ownershipFields: ['actorId', 'energyOwnerActorId', 'targetEnemyId'],
    valueFields: ['before', 'delta', 'stateChange', 'after'],
    sourceFields: ['sourceDeltaIds', 'stateSnapshots'],
    validationField: 'validation',
    applied: true,
  };
}

function createRuntimeEffectTimelineOutputContract(effectTimeline) {
  return {
    sourceKind: effectTimeline.sourceKind,
    status: effectTimeline.status,
    contractName: effectTimeline.contractName,
    inputContractName: effectTimeline.input?.contractName ?? '',
    eventCollectionField: 'events',
    activeCollectionField: 'activeEffects',
    eventCount: effectTimeline.summary.eventCount,
    activeEffectCount: effectTimeline.summary.activeEffectCount,
    keyFields: ['eventId', 'runtimeSequenceIndex'],
    identityFields: ['instanceKey', 'effectId'],
    ownershipFields: ['actorId', 'targetKind', 'targetId'],
    stateFields: ['before', 'after'],
    stackFields: ['stackBefore', 'stackAfter', 'stackChange'],
    calculatorIsolationField: 'appliedToCalculators',
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
    outputFields: ['enemy', 'resources', 'snapshots', 'summary'],
    enemy: {
      sourceKind: enemyStateCurve.sourceKind,
      status: enemyStateCurve.status,
      pointCount: enemyStateCurve.pointCount,
      valueFields: ['hpDelta', 'toughnessDelta'],
      stateMetricKeys: Object.keys(enemyStateCurve.stateMetrics ?? {}),
      hitTransactionField: 'hitTransaction',
    },
    resources: {
      sourceKind: resourceCurves.sourceKind,
      status: resourceCurves.status,
      actorCount: resourceCurves.summary.actorCount,
      kiboCount: resourceCurves.summary.kiboCount,
      energyCurveCount: resourceCurves.summary.energyCurveCount,
      actorPointCount: resourceCurves.summary.actorPointCount,
      kiboPointCount: resourceCurves.summary.kiboPointCount,
      pointCount: resourceCurves.summary.pointCount,
      resourceKind: resourceCurves.resourceKind,
      valueFields: ['energyDelta'],
      hitTransactionField: 'hitTransaction',
    },
    snapshots: {
      sourceKind: stateCurves.snapshots.sourceKind,
      status: stateCurves.snapshots.status,
      contractName: stateCurves.snapshots.contractName,
      snapshotCount: stateCurves.snapshots.summary.snapshotCount,
      runtimeCalculatorInvocationCount:
        stateCurves.snapshots.summary.runtimeCalculatorInvocationCount,
      keyFields: ['sourceDeltaId', 'runtimeSequenceIndex'],
      valueFields: ['before', 'stateEffectProposal', 'delta', 'after'],
      calculatorInvocationField: 'runtimeCalculatorInvocation',
    },
    summaryFields: [
      'enemyPointCount',
      'enemyHpDelta',
      'enemyToughnessDelta',
      'stateCurvePointCount',
      'resourceActorCount',
      'resourceKiboCount',
      'resourceEnergyCurveCount',
      'resourceActorPointCount',
      'resourceKiboPointCount',
      'resourcePointCount',
      'selfEnergyDelta',
      'stateSnapshotCount',
      'runtimeCalculatorInvocationCount',
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
    curveCollectionFields: ['curvesByActor', 'curvesByKibo'],
    actorCount: resourceCurves.summary.actorCount,
    kiboCount: resourceCurves.summary.kiboCount,
    energyCurveCount: resourceCurves.summary.energyCurveCount,
    activeActorCount: resourceCurves.summary.activeActorCount,
    activeKiboCount: resourceCurves.summary.activeKiboCount,
    actorPointCount: resourceCurves.summary.actorPointCount,
    kiboPointCount: resourceCurves.summary.kiboPointCount,
    pointCount: resourceCurves.summary.pointCount,
    curveKeyFields: ['actorId', 'slotId', 'kiboId'],
    pointKeyFields: ['sourceDeltaId', 'runtimeSequenceIndex'],
    valueFields: ['delta', 'energyDelta'],
    stateMetricField: 'stateMetric',
    stateSnapshotField: 'stateSnapshot',
    hitTransactionField: 'hitTransaction',
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
      'resourceCurveKiboCount',
      'resourceEnergyCurveCount',
      'resourceCurveActorPointCount',
      'resourceCurveKiboPointCount',
      'resourceCurvePointCount',
      'simLogCount',
      'stateSnapshotCount',
      'hitTransactionCount',
      'effectEventCount',
      'activeEffectCount',
      'runtimeCalculatorInvocationCount',
      'runtimeCalculatorReplacedInvocationCount',
      'runtimeCalculatorFallbackInvocationCount',
      'mechanicsAdapterRequestCount',
      'mechanicsAdapterRequestMissingCount',
      'mechanicsProfileFallbackInvocationCount',
      'mechanicsProfileCapabilityReadyInvocationCount',
      'mechanicsProfileCapabilityMissingInvocationCount',
      'calculatorCount',
      'valueSourceSlotCount',
      'runtimeValueSourceSlotCount',
      'replaceableValueSourceSlotCount',
      'runtimeInputGenerationOutputBoundaryStandardOutputCount',
      'runtimeInputGenerationOutputBoundaryIssueCount',
    ],
    sourceFields: [
      'runtimeInputSourceKind',
      'runtimeInputSourceInputKind',
      'runtimeInputSourceInputStatus',
      'runtimeGenerationEntrySourceKind',
      'runtimeGenerationEntryStatus',
      'runtimeGenerationLayerSourceKind',
      'runtimeGenerationLayerStatus',
      'runtimeInputGenerationOutputBoundaryStatus',
      'runtimeInputGenerationOutputBoundaryPath',
      'runtimeInputGenerationOutputBoundaryEntryPath',
      'runtimeInputGenerationOutputBoundaryRuntimeInputSourcePath',
      'runtimeInputGenerationOutputBoundaryStandardContractPath',
      'runtimeInputGenerationOutputBoundaryDeltasPath',
      'runtimeInputGenerationOutputBoundaryValueSourceSlotsPath',
      'runtimeInputGenerationOutputBoundaryContractValidationPath',
      'runtimeInputGenerationValueSourceSlotsPath',
      'runtimeInputGenerationValueSourceSlotsSourceTier',
      'mechanicsAdapterContractName',
      'mechanicsAdapterContractVersion',
      'mechanicsAdapterRegistrationKeys',
      'mechanicsOperandsKinds',
      'mechanicsProfileIds',
      'mechanicsProfileVersions',
      'mechanicsProfileStatuses',
    ],
    appliedOnly: summary.appliedOnly,
    applied: true,
  };
}

function createThreeValueRuntimeEnemyStateCurve({
  scenario,
  appliedDeltas,
  runtimeStateSnapshots,
  stateSnapshotByDeltaId,
  hitTransactionByDeltaId,
}) {
  const points = appliedDeltas
    .filter(delta =>
      ['enemyHpDamage', 'enemyToughnessDamage'].includes(delta.trackKey)
    )
    .map((delta, index) =>
      createThreeValueRuntimePoint(
        delta,
        index,
        stateSnapshotByDeltaId.get(delta.id ?? delta.sourceDeltaId),
        hitTransactionByDeltaId.get(delta.id ?? delta.sourceDeltaId)
      )
    );
  const hpDelta = sumThreeValueRuntimeDeltas(points, 'hpDelta');
  const toughnessDelta = sumThreeValueRuntimeDeltas(points, 'toughnessDelta');
  const baseline =
    runtimeStateSnapshots?.baseline?.enemy ??
    createThreeValueRuntimeEnemyBaseline(scenario);
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
  runtimeStateSnapshots,
  stateSnapshotByDeltaId,
  hitTransactionByDeltaId,
}) {
  const energyBaselineByActor = new Map(
    (runtimeStateSnapshots?.baseline?.selfEnergyByActor ?? []).map(actor => [
      actor.actorId,
      actor.baseline,
    ])
  );
  const actorGroups = new Map(
    (scenario?.actors ?? []).map((actor, index) => [
      actor.id,
      {
        actorId: actor.id,
        actorName: actor.name,
        resource: 'sp',
        baseline:
          energyBaselineByActor.get(actor.id) ??
          createThreeValueRuntimeSelfEnergyBaseline(actor, scenario),
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
    const stateSnapshot = stateSnapshotByDeltaId.get(
      delta.id ?? delta.sourceDeltaId
    );
    const actorId =
      stateSnapshot?.energyOwnerActorId ?? delta.actorId ?? 'unknown';
    if (!actorGroups.has(actorId)) {
      actorGroups.set(actorId, {
        actorId,
        actorName: delta.actorName ?? '未知角色',
        resource: delta.valueUnit ?? 'sp',
        baseline:
          energyBaselineByActor.get(actorId) ??
          createThreeValueRuntimeSelfEnergyBaseline({ id: actorId }, scenario),
        order: actorGroups.size,
        delta: 0,
        pointCount: 0,
        points: [],
      });
    }
    const group = actorGroups.get(actorId);
    const point = createThreeValueRuntimePoint(
      delta,
      index,
      stateSnapshot,
      hitTransactionByDeltaId.get(delta.id ?? delta.sourceDeltaId)
    );
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

function createThreeValueRuntimeSimLog(
  appliedDeltas,
  stateSnapshotByDeltaId,
  hitTransactionByDeltaId
) {
  return appliedDeltas.map((delta, index) => ({
    eventType: 'THREE_VALUE_DELTA_APPLIED',
    sequenceIndex: index,
    sourceDeltaId: delta.id ?? delta.sourceDeltaId,
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
    runtimeCalculatorInvocation: delta.runtimeCalculatorInvocation ?? null,
    runtimeCalculatorAdapterKey: delta.runtimeCalculatorAdapterKey ?? null,
    runtimeCalculatorInvocationStatus:
      delta.runtimeCalculatorInvocationStatus ?? null,
    runtimeCalculationChanged: Boolean(delta.runtimeCalculationChanged),
    confidence: delta.confidence,
    stateCurveSequenceIndex: delta.stateCurveSequenceIndex,
    runtimeSequenceIndex: delta.runtimeSequenceIndex ?? index,
    stateSnapshot:
      stateSnapshotByDeltaId.get(delta.id ?? delta.sourceDeltaId) ?? null,
    hitTransaction:
      hitTransactionByDeltaId.get(delta.id ?? delta.sourceDeltaId) ?? null,
    applied: true,
  }));
}

function createThreeValueRuntimePoint(
  delta,
  sequenceIndex,
  stateSnapshot,
  hitTransaction
) {
  return {
    sourceKind: 'three-value-runtime-input-applied-delta',
    sourceDeltaId: delta.id ?? delta.sourceDeltaId,
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
    runtimeCalculatorInvocation: delta.runtimeCalculatorInvocation ?? null,
    runtimeCalculatorAdapterKey: delta.runtimeCalculatorAdapterKey ?? null,
    runtimeCalculatorInvocationStatus:
      delta.runtimeCalculatorInvocationStatus ?? null,
    runtimeCalculationChanged: Boolean(delta.runtimeCalculationChanged),
    confidence: delta.confidence,
    sourceStatus: delta.sourceStatus,
    resultStatus: delta.resultStatus,
    sourceIds: delta.sourceIds,
    stateSnapshot: stateSnapshot ?? null,
    hitTransaction: hitTransaction ?? null,
    applied: true,
  };
}

function createThreeValueRuntimeStateCurves({
  enemyStateCurve,
  resourceCurves,
  runtimeStateSnapshots,
}) {
  return {
    sourceKind: 'azpr-runtime-state-curves-from-standard-deltas',
    status: 'runtime-state-curves-ready-from-standard-deltas',
    enemy: enemyStateCurve,
    resources: resourceCurves,
    snapshots: runtimeStateSnapshots,
    summary: {
      enemyPointCount: enemyStateCurve.pointCount,
      enemyHpDelta: enemyStateCurve.hpDelta,
      enemyToughnessDelta: enemyStateCurve.toughnessDelta,
      stateCurvePointCount: roundCurveValue(
        enemyStateCurve.pointCount + resourceCurves.summary.pointCount
      ),
      resourceActorCount: resourceCurves.summary.actorCount,
      resourceKiboCount: resourceCurves.summary.kiboCount,
      resourceEnergyCurveCount: resourceCurves.summary.energyCurveCount,
      resourceActorPointCount: resourceCurves.summary.actorPointCount,
      resourceKiboPointCount: resourceCurves.summary.kiboPointCount,
      activeResourceActorCount: resourceCurves.summary.activeActorCount,
      activeResourceKiboCount: resourceCurves.summary.activeKiboCount,
      resourcePointCount: resourceCurves.summary.pointCount,
      selfEnergyDelta: resourceCurves.summary.selfEnergyDelta,
      stateSnapshotCount: runtimeStateSnapshots.summary.snapshotCount,
      runtimeCalculatorInvocationCount:
        runtimeStateSnapshots.summary.runtimeCalculatorInvocationCount,
      stateEffectProposalReadyInvocationCount:
        runtimeStateSnapshots.summary.stateEffectProposalReadyInvocationCount,
      stateEffectProposalMissingInvocationCount:
        runtimeStateSnapshots.summary.stateEffectProposalMissingInvocationCount,
      runtimeCalculatorReplacedInvocationCount:
        runtimeStateSnapshots.summary.runtimeCalculatorReplacedInvocationCount,
      runtimeCalculatorFallbackInvocationCount:
        runtimeStateSnapshots.summary.runtimeCalculatorFallbackInvocationCount,
      applied: true,
    },
    applied: true,
  };
}

function createThreeValueRuntimeResourceCurves({
  selfEnergyCurveByActor,
  kiboEnergyCurveBySlot,
}) {
  const actorPointCount = selfEnergyCurveByActor.reduce(
    (sum, actor) => sum + actor.pointCount,
    0
  );
  const kiboPointCount = kiboEnergyCurveBySlot.reduce(
    (sum, kibo) => sum + kibo.pointCount,
    0
  );
  const pointCount = actorPointCount + kiboPointCount;
  return {
    sourceKind: 'azpr-runtime-resource-curves-from-standard-deltas',
    status:
      pointCount > 0
        ? 'resource-curves-ready-from-standard-deltas'
        : 'resource-curves-ready-no-applied-resource-deltas',
    resourceKind: 'selfEnergy',
    curvesByActor: selfEnergyCurveByActor,
    curvesByKibo: kiboEnergyCurveBySlot,
    summary: {
      actorCount: selfEnergyCurveByActor.length,
      kiboCount: kiboEnergyCurveBySlot.length,
      energyCurveCount:
        selfEnergyCurveByActor.length + kiboEnergyCurveBySlot.length,
      activeActorCount: selfEnergyCurveByActor.filter(
        actor => actor.pointCount > 0
      ).length,
      activeKiboCount: kiboEnergyCurveBySlot.filter(kibo => kibo.pointCount > 0)
        .length,
      actorPointCount,
      kiboPointCount,
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
  runtimeStateSnapshots,
  hitTransactions,
  effectTimeline,
  actionExecutionPlan,
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
    mechanicsAdapterRequestCount:
      runtimeInput.summary.mechanicsAdapterRequestCount ?? 0,
    mechanicsAdapterRequestMissingCount:
      runtimeInput.summary.mechanicsAdapterRequestMissingCount ?? 0,
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
    resourceCurveKiboCount: resourceCurves.summary.kiboCount,
    resourceEnergyCurveCount: resourceCurves.summary.energyCurveCount,
    resourceCurveActorPointCount: resourceCurves.summary.actorPointCount,
    resourceCurveKiboPointCount: resourceCurves.summary.kiboPointCount,
    activeResourceCurveActorCount: resourceCurves.summary.activeActorCount,
    activeResourceCurveKiboCount: resourceCurves.summary.activeKiboCount,
    resourceCurvePointCount: resourceCurves.summary.pointCount,
    stateSnapshotCount: runtimeStateSnapshots.summary.snapshotCount,
    stateSnapshotReadyCount: runtimeStateSnapshots.summary.readySnapshotCount,
    stateSnapshotPendingBaselineCount:
      runtimeStateSnapshots.summary.pendingBaselineSnapshotCount,
    hitTransactionCount: hitTransactions.summary.transactionCount,
    multiDeltaHitTransactionCount:
      hitTransactions.summary.multiDeltaTransactionCount,
    hitTransactionBaselineReadyCount:
      hitTransactions.summary.baselineReadyTransactionCount,
    hitTransactionPendingBaselineCount:
      hitTransactions.summary.pendingBaselineTransactionCount,
    hitTransactionValidationIssueCount:
      hitTransactions.summary.validationIssueTransactionCount,
    effectCommandCount: effectTimeline.summary.commandCount,
    effectEventCount: effectTimeline.summary.eventCount,
    effectAppliedEventCount: effectTimeline.summary.appliedEventCount,
    effectRefreshedEventCount: effectTimeline.summary.refreshedEventCount,
    effectRemovedEventCount: effectTimeline.summary.removedEventCount,
    effectExpiredEventCount: effectTimeline.summary.expiredEventCount,
    activeEffectCount: effectTimeline.summary.activeEffectCount,
    peakActiveEffectCount: effectTimeline.summary.peakActiveEffectCount,
    effectCalculatorAppliedCount:
      effectTimeline.summary.calculatorAppliedEffectCount,
    executionPlanContractName: actionExecutionPlan?.contractName ?? '',
    executionPlanActionCount: actionExecutionPlan?.summary?.actionCount ?? 0,
    executionPlanExecutedActionCount:
      actionExecutionPlan?.summary?.executedActionCount ?? 0,
    executionPlanSkippedActionCount:
      actionExecutionPlan?.summary?.skippedActionCount ?? 0,
    executionPlanUnresolvedExecutedActionCount:
      actionExecutionPlan?.summary?.unresolvedExecutedActionCount ?? 0,
    runtimeCalculatorInvocationCount:
      runtimeStateSnapshots.summary.runtimeCalculatorInvocationCount,
    runtimeCalculatorPassthroughInvocationCount:
      runtimeStateSnapshots.summary.runtimeCalculatorPassthroughInvocationCount,
    runtimeCalculatorReplacedInvocationCount:
      runtimeStateSnapshots.summary.runtimeCalculatorReplacedInvocationCount,
    runtimeCalculatorFallbackInvocationCount:
      runtimeStateSnapshots.summary.runtimeCalculatorFallbackInvocationCount,
    runtimeCalculatorCustomAdapterInvocationCount:
      runtimeStateSnapshots.summary
        .runtimeCalculatorCustomAdapterInvocationCount,
    mechanicsAdapterContractName:
      runtimeStateSnapshots.summary.mechanicsAdapterContractName,
    mechanicsAdapterContractVersion:
      runtimeStateSnapshots.summary.mechanicsAdapterContractVersion,
    mechanicsAdapterRegistrationKeys:
      runtimeStateSnapshots.summary.mechanicsAdapterRegistrationKeys,
    mechanicsProfileIds: runtimeStateSnapshots.summary.mechanicsProfileIds,
    mechanicsProfileVersions:
      runtimeStateSnapshots.summary.mechanicsProfileVersions,
    mechanicsProfileStatuses:
      runtimeStateSnapshots.summary.mechanicsProfileStatuses,
    mechanicsProfileFallbackInvocationCount:
      runtimeStateSnapshots.summary.mechanicsProfileFallbackInvocationCount,
    mechanicsProfileCapabilityReadyInvocationCount:
      runtimeStateSnapshots.summary
        .mechanicsProfileCapabilityReadyInvocationCount,
    mechanicsProfileCapabilityMissingInvocationCount:
      runtimeStateSnapshots.summary
        .mechanicsProfileCapabilityMissingInvocationCount,
    operandSourceBindingRequiredInvocationCount:
      runtimeStateSnapshots.summary.operandSourceBindingRequiredInvocationCount,
    operandSourceBindingReadyInvocationCount:
      runtimeStateSnapshots.summary.operandSourceBindingReadyInvocationCount,
    operandSourceBindingInvalidInvocationCount:
      runtimeStateSnapshots.summary.operandSourceBindingInvalidInvocationCount,
    operandSourceBindingCompatibleUnboundInvocationCount:
      runtimeStateSnapshots.summary
        .operandSourceBindingCompatibleUnboundInvocationCount,
    operandSourceBindingStates:
      runtimeStateSnapshots.summary.operandSourceBindingStates,
    operandSourceBindingKinds:
      runtimeStateSnapshots.summary.operandSourceBindingKinds,
    operandSourceBindingIssueCodes:
      runtimeStateSnapshots.summary.operandSourceBindingIssueCodes,
    stateEffectProposalReadyInvocationCount:
      runtimeStateSnapshots.summary.stateEffectProposalReadyInvocationCount,
    stateEffectProposalMissingInvocationCount:
      runtimeStateSnapshots.summary.stateEffectProposalMissingInvocationCount,
    runtimeCalculatorAdapterKeys:
      runtimeStateSnapshots.summary.runtimeCalculatorAdapterKeys,
    runtimeCalculatorInvocationStatuses:
      runtimeStateSnapshots.summary.runtimeCalculatorInvocationStatuses,
    runtimeMechanismConfigurationReadyInvocationCount:
      runtimeStateSnapshots.summary
        .runtimeMechanismConfigurationReadyInvocationCount,
    runtimeMechanismConfigurationMissingInvocationCount:
      runtimeStateSnapshots.summary
        .runtimeMechanismConfigurationMissingInvocationCount,
    runtimeConfigurationInstanceIds:
      runtimeStateSnapshots.summary.runtimeConfigurationInstanceIds,
    runtimeConfigurationReplayIdentities:
      runtimeStateSnapshots.summary.runtimeConfigurationReplayIdentities,
    configurationRuntimeBindingReadyInvocationCount:
      runtimeStateSnapshots.summary
        .configurationRuntimeBindingReadyInvocationCount,
    configurationRuntimeBindingMissingInvocationCount:
      runtimeStateSnapshots.summary
        .configurationRuntimeBindingMissingInvocationCount,
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
    mechanismContextReadyDeltaCount:
      calculatorSummary.mechanismContextReadyCount,
    mechanismContextMissingDeltaCount:
      calculatorSummary.mechanismContextMissingCount,
    mechanismContextStatuses: calculatorSummary.mechanismContextStatuses,
    mechanismConfigurationReadyDeltaCount:
      calculatorSummary.mechanismConfigurationReadyCount,
    mechanismConfigurationMissingDeltaCount:
      calculatorSummary.mechanismConfigurationMissingCount,
    mechanismConfigurationStatuses:
      calculatorSummary.mechanismConfigurationStatuses,
    configurationInstanceIds: calculatorSummary.configurationInstanceIds,
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
    runtimeInputGenerationOutputBoundaryStatus:
      runtimeInput?.generationOutputBoundaryStatus ??
      generationReadSources.generationOutputBoundaryStatus ??
      '',
    runtimeInputGenerationOutputBoundaryReady: Boolean(
      runtimeInput?.generationOutputBoundaryReady ??
      generationReadSources.generationOutputBoundaryReady
    ),
    runtimeInputGenerationOutputBoundaryPath:
      runtimeInput?.generationOutputBoundaryPath ??
      generationReadSources.generationOutputBoundaryPath ??
      '',
    runtimeInputGenerationOutputBoundaryEntryPath:
      runtimeInput?.generationOutputBoundaryEntryPath ??
      generationReadSources.generationOutputBoundaryEntryPath ??
      '',
    runtimeInputGenerationOutputBoundaryRuntimeInputSourcePath:
      runtimeInput?.generationOutputBoundaryRuntimeInputSourcePath ??
      generationReadSources.generationOutputBoundaryRuntimeInputSourcePath ??
      '',
    runtimeInputGenerationOutputBoundaryStandardContractPath:
      runtimeInput?.generationOutputBoundaryStandardContractPath ??
      generationReadSources.generationOutputBoundaryStandardContractPath ??
      '',
    runtimeInputGenerationOutputBoundaryDeltasPath:
      runtimeInput?.generationOutputBoundaryDeltasPath ??
      generationReadSources.generationOutputBoundaryDeltasPath ??
      '',
    runtimeInputGenerationOutputBoundaryValueSourceSlotsPath:
      runtimeInput?.generationOutputBoundaryValueSourceSlotsPath ??
      generationReadSources.generationOutputBoundaryValueSourceSlotsPath ??
      '',
    runtimeInputGenerationOutputBoundaryContractValidationPath:
      runtimeInput?.generationOutputBoundaryContractValidationPath ??
      generationReadSources.generationOutputBoundaryContractValidationPath ??
      '',
    runtimeInputGenerationOutputBoundaryStandardOutputCount: numberOrZero(
      runtimeInput?.generationOutputBoundaryStandardOutputCount ??
        generationReadSources.generationOutputBoundaryStandardOutputCount
    ),
    runtimeInputGenerationOutputBoundaryIssueCount: numberOrZero(
      runtimeInput?.generationOutputBoundaryIssueCount ??
        generationReadSources.generationOutputBoundaryIssueCount
    ),
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
