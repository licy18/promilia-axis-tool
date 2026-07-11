export function createThreeValueRuntimeOutputConsumerContract({
  outputContract = null,
  simLog = [],
  stateCurves = null,
  resourceCurves = null,
  hitTransactions = null,
  effectTimeline = null,
  summary = {},
  outputConsistency = null,
} = {}) {
  const simLogRows = Array.isArray(simLog) ? simLog : [];
  const stateCurveSummary = stateCurves?.summary ?? {};
  const stateSnapshots = stateCurves?.snapshots ?? null;
  const resourceCurveSummary = resourceCurves?.summary ?? {};
  const hitTransactionRows = Array.isArray(hitTransactions?.transactions)
    ? hitTransactions.transactions
    : [];
  const effectEventRows = Array.isArray(effectTimeline?.events)
    ? effectTimeline.events
    : [];
  const contractSummary = outputContract?.summary ?? {};
  const contractOutputs = outputContract?.outputs ?? {};
  const outputConsistencyStatus =
    outputConsistency?.status ?? summary.outputConsistencyStatus ?? '';
  const canonicalOutputNames = Array.isArray(outputContract?.outputNames)
    ? outputContract.outputNames
    : ['simLog', 'stateCurves', 'resourceCurves', 'summary'];

  return {
    schemaVersion: canonicalOutputNames.includes('effectTimeline')
      ? 3
      : canonicalOutputNames.includes('hitTransactions')
        ? 2
        : 1,
    sourceKind: 'azpr-three-value-runtime-output-consumer-contract',
    status:
      outputContract?.status === 'runtime-output-contract-ready'
        ? 'runtime-output-consumer-contract-ready'
        : 'runtime-output-consumer-contract-ready-no-applied-deltas',
    contractSourceKind: outputContract?.sourceKind ?? '',
    contractStatus: outputContract?.status ?? '',
    canonicalOutputNames,
    aliases: {
      resources: 'resourceCurves',
    },
    outputs: {
      simLog: {
        outputName: 'simLog',
        dataPath: 'runtimeOutputs.simLog',
        contractPath: 'runtimeOutputs.outputContract.outputs.simLog',
        sourceKind: contractOutputs.simLog?.sourceKind ?? '',
        status: contractOutputs.simLog?.status ?? '',
        inputSource: contractOutputs.simLog?.inputSource ?? '',
        inputSourceKind: contractOutputs.simLog?.inputSourceKind ?? '',
        rowCount: simLogRows.length,
        keyFields: contractOutputs.simLog?.keyFields ?? [
          'sourceDeltaId',
          'runtimeSequenceIndex',
        ],
        valueFields: contractOutputs.simLog?.valueFields ?? [
          'delta',
          'hpDelta',
          'toughnessDelta',
          'energyDelta',
        ],
      },
      hitTransactions: {
        outputName: 'hitTransactions',
        dataPath: 'runtimeOutputs.hitTransactions',
        contractPath: 'runtimeOutputs.outputContract.outputs.hitTransactions',
        sourceKind: contractOutputs.hitTransactions?.sourceKind ?? '',
        status: contractOutputs.hitTransactions?.status ?? '',
        contractName: contractOutputs.hitTransactions?.contractName ?? '',
        transactionCount: hitTransactionRows.length,
        collectionField:
          contractOutputs.hitTransactions?.collectionField ?? 'transactions',
        keyFields: contractOutputs.hitTransactions?.keyFields ?? [
          'transactionId',
        ],
        valueFields: contractOutputs.hitTransactions?.valueFields ?? [
          'before',
          'delta',
          'stateChange',
          'after',
        ],
      },
      effectTimeline: {
        outputName: 'effectTimeline',
        dataPath: 'runtimeOutputs.effectTimeline',
        contractPath: 'runtimeOutputs.outputContract.outputs.effectTimeline',
        sourceKind: contractOutputs.effectTimeline?.sourceKind ?? '',
        status: contractOutputs.effectTimeline?.status ?? '',
        contractName: contractOutputs.effectTimeline?.contractName ?? '',
        eventCount: effectEventRows.length,
        activeEffectCount: numberOrZero(
          effectTimeline?.summary?.activeEffectCount
        ),
        eventCollectionField:
          contractOutputs.effectTimeline?.eventCollectionField ?? 'events',
        activeCollectionField:
          contractOutputs.effectTimeline?.activeCollectionField ??
          'activeEffects',
        keyFields: contractOutputs.effectTimeline?.keyFields ?? [
          'eventId',
          'runtimeSequenceIndex',
        ],
      },
      stateCurves: {
        outputName: 'stateCurves',
        dataPath: 'runtimeOutputs.stateCurves',
        contractPath: 'runtimeOutputs.outputContract.outputs.stateCurves',
        sourceKind: contractOutputs.stateCurves?.sourceKind ?? '',
        status: contractOutputs.stateCurves?.status ?? '',
        enemyPointCount: numberOrZero(
          stateCurves?.enemy?.pointCount ?? stateCurveSummary.enemyPointCount
        ),
        stateCurvePointCount: numberOrZero(
          stateCurveSummary.stateCurvePointCount ??
            contractSummary.stateCurvePointCount
        ),
        outputFields: contractOutputs.stateCurves?.outputFields ?? [
          'enemy',
          'resources',
          'snapshots',
          'summary',
        ],
        stateSnapshotCount: numberOrZero(
          stateSnapshots?.summary?.snapshotCount ??
            contractSummary.stateSnapshotCount
        ),
        runtimeCalculatorInvocationCount: numberOrZero(
          stateSnapshots?.summary?.runtimeCalculatorInvocationCount ??
            contractSummary.runtimeCalculatorInvocationCount
        ),
      },
      resourceCurves: {
        outputName: 'resourceCurves',
        dataPath: 'runtimeOutputs.resourceCurves',
        aliasPath: 'runtimeOutputs.resources',
        contractPath: 'runtimeOutputs.outputContract.outputs.resourceCurves',
        sourceKind: contractOutputs.resourceCurves?.sourceKind ?? '',
        status: contractOutputs.resourceCurves?.status ?? '',
        actorCount: numberOrZero(
          resourceCurveSummary.actorCount ??
            contractSummary.resourceCurveActorCount
        ),
        pointCount: numberOrZero(
          resourceCurveSummary.pointCount ??
            contractSummary.resourceCurvePointCount
        ),
        curveCollectionField:
          contractOutputs.resourceCurves?.curveCollectionField ??
          'curvesByActor',
      },
      summary: {
        outputName: 'summary',
        dataPath: 'runtimeOutputs.summary',
        contractPath: 'runtimeOutputs.outputContract.outputs.summary',
        sourceKind: contractOutputs.summary?.sourceKind ?? '',
        status: contractOutputs.summary?.status ?? '',
        valueFields: contractOutputs.summary?.valueFields ?? [],
        countFields: contractOutputs.summary?.countFields ?? [],
      },
    },
    summary: {
      outputCount: numberOrZero(
        contractSummary.outputCount ??
          summary.outputCount ??
          outputContract?.outputNames?.length ??
          4
      ),
      appliedDeltaCount: numberOrZero(
        contractSummary.appliedDeltaCount ?? summary.appliedDeltaCount
      ),
      simLogCount: numberOrZero(
        summary.simLogCount ?? contractSummary.simLogCount ?? simLogRows.length
      ),
      stateSnapshotCount: numberOrZero(
        stateSnapshots?.summary?.snapshotCount ??
          summary.stateSnapshotCount ??
          contractSummary.stateSnapshotCount
      ),
      hitTransactionCount: numberOrZero(
        hitTransactions?.summary?.transactionCount ??
          summary.hitTransactionCount ??
          contractSummary.hitTransactionCount ??
          hitTransactionRows.length
      ),
      effectEventCount: numberOrZero(
        effectTimeline?.summary?.eventCount ??
          summary.effectEventCount ??
          contractSummary.effectEventCount ??
          effectEventRows.length
      ),
      activeEffectCount: numberOrZero(
        effectTimeline?.summary?.activeEffectCount ??
          summary.activeEffectCount ??
          contractSummary.activeEffectCount
      ),
      runtimeCalculatorInvocationCount: numberOrZero(
        stateSnapshots?.summary?.runtimeCalculatorInvocationCount ??
          summary.runtimeCalculatorInvocationCount ??
          contractSummary.runtimeCalculatorInvocationCount
      ),
      mechanicsAdapterContractName:
        stateSnapshots?.summary?.mechanicsAdapterContractName ??
        summary.mechanicsAdapterContractName ??
        '',
      mechanicsAdapterContractVersion: numberOrZero(
        stateSnapshots?.summary?.mechanicsAdapterContractVersion ??
          summary.mechanicsAdapterContractVersion
      ),
      mechanicsAdapterRegistrationKeys:
        stateSnapshots?.summary?.mechanicsAdapterRegistrationKeys ??
        summary.mechanicsAdapterRegistrationKeys ??
        [],
      mechanicsOperandsReadyInvocationCount: numberOrZero(
        stateSnapshots?.summary?.mechanicsOperandsReadyInvocationCount ??
          summary.mechanicsOperandsReadyInvocationCount
      ),
      mechanicsOperandsMissingInvocationCount: numberOrZero(
        stateSnapshots?.summary?.mechanicsOperandsMissingInvocationCount ??
          summary.mechanicsOperandsMissingInvocationCount
      ),
      mechanicsOperandsMismatchInvocationCount: numberOrZero(
        stateSnapshots?.summary?.mechanicsOperandsMismatchInvocationCount ??
          summary.mechanicsOperandsMismatchInvocationCount
      ),
      mechanicsOperandsCalculatedInvocationCount: numberOrZero(
        stateSnapshots?.summary?.mechanicsOperandsCalculatedInvocationCount ??
          summary.mechanicsOperandsCalculatedInvocationCount
      ),
      mechanicsOperandsKinds:
        stateSnapshots?.summary?.mechanicsOperandsKinds ??
        summary.mechanicsOperandsKinds ??
        [],
      runtimeCalculatorReplacedInvocationCount: numberOrZero(
        stateSnapshots?.summary?.runtimeCalculatorReplacedInvocationCount ??
          summary.runtimeCalculatorReplacedInvocationCount ??
          contractSummary.runtimeCalculatorReplacedInvocationCount
      ),
      runtimeCalculatorFallbackInvocationCount: numberOrZero(
        stateSnapshots?.summary?.runtimeCalculatorFallbackInvocationCount ??
          summary.runtimeCalculatorFallbackInvocationCount ??
          contractSummary.runtimeCalculatorFallbackInvocationCount
      ),
      mechanicsAdapterRequestCount: numberOrZero(
        summary.mechanicsAdapterRequestCount ??
          contractSummary.mechanicsAdapterRequestCount
      ),
      mechanicsAdapterRequestMissingCount: numberOrZero(
        summary.mechanicsAdapterRequestMissingCount ??
          contractSummary.mechanicsAdapterRequestMissingCount
      ),
      enemyStatePointCount: numberOrZero(
        stateCurves?.enemy?.pointCount ??
          stateCurveSummary.enemyPointCount ??
          contractSummary.enemyStatePointCount ??
          summary.enemyStatePointCount
      ),
      stateCurvePointCount: numberOrZero(
        stateCurveSummary.stateCurvePointCount ??
          contractSummary.stateCurvePointCount ??
          summary.stateCurvePointCount
      ),
      resourceCurveActorCount: numberOrZero(
        resourceCurveSummary.actorCount ??
          contractSummary.resourceCurveActorCount ??
          summary.resourceCurveActorCount
      ),
      resourceCurvePointCount: numberOrZero(
        resourceCurveSummary.pointCount ??
          contractSummary.resourceCurvePointCount ??
          summary.resourceCurvePointCount
      ),
      enemyHpDelta: numberOrZero(
        summary.enemyHpDelta ?? contractSummary.enemyHpDelta
      ),
      enemyToughnessDelta: numberOrZero(
        summary.enemyToughnessDelta ?? contractSummary.enemyToughnessDelta
      ),
      selfEnergyDelta: numberOrZero(
        summary.selfEnergyDelta ?? contractSummary.selfEnergyDelta
      ),
      runtimeInputGenerationOutputBoundaryStatus:
        summary.runtimeInputGenerationOutputBoundaryStatus ??
        contractSummary.runtimeInputGenerationOutputBoundaryStatus ??
        '',
      runtimeInputGenerationOutputBoundaryReady: Boolean(
        summary.runtimeInputGenerationOutputBoundaryReady ??
        contractSummary.runtimeInputGenerationOutputBoundaryReady
      ),
      runtimeInputGenerationOutputBoundaryPath:
        summary.runtimeInputGenerationOutputBoundaryPath ??
        contractSummary.runtimeInputGenerationOutputBoundaryPath ??
        '',
      runtimeInputGenerationOutputBoundaryEntryPath:
        summary.runtimeInputGenerationOutputBoundaryEntryPath ??
        contractSummary.runtimeInputGenerationOutputBoundaryEntryPath ??
        '',
      runtimeInputGenerationOutputBoundaryRuntimeInputSourcePath:
        summary.runtimeInputGenerationOutputBoundaryRuntimeInputSourcePath ??
        contractSummary.runtimeInputGenerationOutputBoundaryRuntimeInputSourcePath ??
        '',
      runtimeInputGenerationOutputBoundaryStandardContractPath:
        summary.runtimeInputGenerationOutputBoundaryStandardContractPath ??
        contractSummary.runtimeInputGenerationOutputBoundaryStandardContractPath ??
        '',
      runtimeInputGenerationOutputBoundaryDeltasPath:
        summary.runtimeInputGenerationOutputBoundaryDeltasPath ??
        contractSummary.runtimeInputGenerationOutputBoundaryDeltasPath ??
        '',
      runtimeInputGenerationOutputBoundaryValueSourceSlotsPath:
        summary.runtimeInputGenerationOutputBoundaryValueSourceSlotsPath ??
        contractSummary.runtimeInputGenerationOutputBoundaryValueSourceSlotsPath ??
        '',
      runtimeInputGenerationOutputBoundaryContractValidationPath:
        summary.runtimeInputGenerationOutputBoundaryContractValidationPath ??
        contractSummary.runtimeInputGenerationOutputBoundaryContractValidationPath ??
        '',
      runtimeInputGenerationOutputBoundaryStandardOutputCount: numberOrZero(
        summary.runtimeInputGenerationOutputBoundaryStandardOutputCount ??
          contractSummary.runtimeInputGenerationOutputBoundaryStandardOutputCount
      ),
      runtimeInputGenerationOutputBoundaryIssueCount: numberOrZero(
        summary.runtimeInputGenerationOutputBoundaryIssueCount ??
          contractSummary.runtimeInputGenerationOutputBoundaryIssueCount
      ),
      outputConsistencyStatus,
      outputConsistent: Boolean(
        summary.outputConsistent ?? outputConsistency?.consistent
      ),
      applied: true,
    },
    applied: true,
  };
}

export function createThreeValueRuntimeOutputConsumerView(runtimeProjection) {
  const runtimeOutputSourceResolution =
    getThreeValueRuntimeOutputSourceResolution(runtimeProjection);
  const runtimeOutputSource = runtimeOutputSourceResolution.source;
  const outputReadSources = createThreeValueRuntimeOutputReadSources(
    runtimeOutputSource,
    runtimeOutputSourceResolution
  );
  const outputContract = runtimeOutputSource?.outputContract ?? null;
  const outputSummary = getThreeValueRuntimeOutputSummary(runtimeOutputSource);
  const simLog = getThreeValueRuntimeSimLogRows(runtimeOutputSource);
  const stateCurves = getThreeValueRuntimeStateCurves(runtimeOutputSource);
  const stateSnapshots =
    getThreeValueRuntimeStateSnapshots(runtimeOutputSource);
  const hitTransactions =
    getThreeValueRuntimeHitTransactions(runtimeOutputSource);
  const effectTimeline =
    getThreeValueRuntimeEffectTimeline(runtimeOutputSource);
  const resourceCurves =
    getThreeValueRuntimeResourceCurves(runtimeOutputSource);
  const outputConsistency = runtimeOutputSource?.outputConsistency ?? {};
  const outputConsumerContract =
    runtimeOutputSource?.outputConsumerContract ??
    runtimeOutputSource?.consumerContract ??
    createThreeValueRuntimeOutputConsumerContract({
      outputContract,
      simLog,
      stateCurves,
      resourceCurves,
      hitTransactions,
      effectTimeline,
      summary: outputSummary,
      outputConsistency,
    });
  const outputConsumerBoundary = createThreeValueRuntimeOutputConsumerBoundary({
    runtimeOutputSourceResolution,
    outputReadSources,
    outputConsumerContract,
  });
  const enemyStateCurve =
    stateCurves?.enemy ?? runtimeOutputSource?.enemyStateCurve ?? {};
  const resourceCurveRows = Array.isArray(resourceCurves?.curvesByActor)
    ? resourceCurves.curvesByActor
    : (runtimeOutputSource?.selfEnergyCurveByActor ?? []);

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-three-value-runtime-output-consumer-view',
    status: runtimeOutputSource
      ? 'runtime-output-consumer-view-ready'
      : 'runtime-output-consumer-view-missing',
    runtimeOutputsSourceKind: runtimeOutputSource?.sourceKind ?? '',
    runtimeOutputsStatus: runtimeOutputSource?.status ?? '',
    outputContract,
    outputConsumerContract,
    consumerContract: outputConsumerContract,
    outputConsumerBoundary,
    outputConsistency,
    outputSummary,
    simLog,
    stateCurves,
    stateSnapshots,
    hitTransactions,
    effectTimeline,
    resourceCurves,
    resources: resourceCurves,
    enemyStateCurve,
    resourceCurveRows,
    summary: {
      outputCount: numberOrZero(outputSummary.outputCount),
      simLogCount: getThreeValueRuntimeSimLogCount(runtimeOutputSource),
      enemyStatePointCount: numberOrZero(
        outputSummary.enemyStatePointCount ?? enemyStateCurve?.pointCount
      ),
      stateCurvePointCount: numberOrZero(outputSummary.stateCurvePointCount),
      stateSnapshotCount: numberOrZero(
        outputSummary.stateSnapshotCount ??
          stateSnapshots?.summary?.snapshotCount
      ),
      hitTransactionCount: numberOrZero(
        outputSummary.hitTransactionCount ??
          hitTransactions?.summary?.transactionCount
      ),
      effectEventCount: numberOrZero(
        outputSummary.effectEventCount ?? effectTimeline?.summary?.eventCount
      ),
      activeEffectCount: numberOrZero(
        outputSummary.activeEffectCount ??
          effectTimeline?.summary?.activeEffectCount
      ),
      runtimeCalculatorInvocationCount: numberOrZero(
        outputSummary.runtimeCalculatorInvocationCount ??
          stateSnapshots?.summary?.runtimeCalculatorInvocationCount
      ),
      resourceCurvePointCount: numberOrZero(
        outputSummary.resourceCurvePointCount
      ),
      resourceCurveActorCount: numberOrZero(
        outputSummary.resourceCurveActorCount
      ),
      outputConsumerContractStatus: outputConsumerContract?.status ?? '',
      outputConsumerBoundaryStatus: outputConsumerBoundary.status,
      outputConsumerBoundaryReady: outputConsumerBoundary.ready,
      outputConsumerBoundaryStandardReady:
        outputConsumerBoundary.standardBoundaryReady,
      outputConsumerBoundaryUsesLegacyFallback:
        outputConsumerBoundary.usesLegacyProjectionFallback,
      outputConsistencyStatus:
        outputSummary.outputConsistencyStatus ?? outputConsistency.status ?? '',
      outputConsistent: Boolean(
        outputSummary.outputConsistent ?? outputConsistency.consistent
      ),
    },
    ready:
      Boolean(runtimeOutputSource) &&
      (isReadyStatus(outputConsumerContract?.status) ||
        isReadyStatus(outputContract?.status) ||
        isReadyStatus(runtimeOutputSource?.status)),
    runtimeOutputSourceResolution: createRuntimeOutputSourceResolutionView(
      runtimeOutputSourceResolution
    ),
    outputReadSources,
  };
}

export function createThreeValueRuntimeOutputConsumerBoundary({
  runtimeOutputSourceResolution = {},
  outputReadSources = {},
  outputConsumerContract = null,
} = {}) {
  const ready = Boolean(
    runtimeOutputSourceResolution.ready &&
    isReadyStatus(outputConsumerContract?.status)
  );
  const standardOutputCount = numberOrZero(
    outputReadSources.standardOutputCount
  );
  const fallbackOutputCount = numberOrZero(
    outputReadSources.fallbackOutputCount
  );
  const usesLegacyProjectionFallback = Boolean(
    outputReadSources.usesLegacyProjectionFallback ||
    runtimeOutputSourceResolution.legacyProjectionFallback
  );
  const standardBoundaryReady = Boolean(
    ready && standardOutputCount >= 4 && !usesLegacyProjectionFallback
  );

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-three-value-runtime-output-consumer-boundary',
    status: !ready
      ? 'runtime-output-consumer-boundary-missing'
      : standardBoundaryReady
        ? 'runtime-output-consumer-boundary-standard'
        : 'runtime-output-consumer-boundary-ready-with-fallbacks',
    ready,
    readyState: ready ? 'true' : 'false',
    standardBoundaryReady,
    standardBoundaryReadyState: standardBoundaryReady ? 'true' : 'false',
    sourcePath: runtimeOutputSourceResolution.sourcePath ?? '',
    sourceTier: runtimeOutputSourceResolution.sourceTier ?? '',
    runtimeOutputsSourceKind: runtimeOutputSourceResolution.sourceKind ?? '',
    runtimeOutputsStatus: runtimeOutputSourceResolution.status ?? '',
    outputConsumerContractSourceKind: outputConsumerContract?.sourceKind ?? '',
    outputConsumerContractStatus: outputConsumerContract?.status ?? '',
    outputReadSourcesStatus: outputReadSources.status ?? '',
    standardOutputNames: outputReadSources.standardOutputNames ?? [],
    fallbackOutputNames: outputReadSources.fallbackOutputNames ?? [],
    standardOutputCount,
    fallbackOutputCount,
    usesLegacyProjectionFallback,
    usesLegacyProjectionFallbackState: usesLegacyProjectionFallback
      ? 'true'
      : 'false',
    applied: true,
  };
}

export function getThreeValueRuntimeOutputSourceResolution(runtimeProjection) {
  const hasRuntimeOutputsEnvelope = Boolean(runtimeProjection?.runtimeOutputs);
  const source = hasRuntimeOutputsEnvelope
    ? runtimeProjection.runtimeOutputs
    : (runtimeProjection ?? null);
  const directRuntimeOutputs =
    !hasRuntimeOutputsEnvelope &&
    source?.sourceKind === 'azpr-three-value-runtime-outputs';
  const sourceTier = hasRuntimeOutputsEnvelope
    ? 'runtime-outputs-envelope'
    : directRuntimeOutputs
      ? 'runtime-outputs-direct'
      : source
        ? 'legacy-projection'
        : 'missing';
  const sourcePath = hasRuntimeOutputsEnvelope
    ? 'runtimeProjection.runtimeOutputs'
    : directRuntimeOutputs
      ? 'runtimeOutputs'
      : source
        ? 'runtimeProjection'
        : '';

  return {
    source,
    sourcePath,
    sourceTier,
    sourceKind: source?.sourceKind ?? '',
    status: source?.status ?? '',
    hasRuntimeOutputsEnvelope,
    directRuntimeOutputs,
    legacyProjectionFallback: sourceTier === 'legacy-projection',
    ready: Boolean(source),
  };
}

export function getThreeValueRuntimeOutputSource(runtimeProjection) {
  return getThreeValueRuntimeOutputSourceResolution(runtimeProjection).source;
}

export function getThreeValueRuntimeOutputContract(runtimeProjection) {
  return (
    getThreeValueRuntimeOutputSource(runtimeProjection)?.outputContract ?? null
  );
}

export function getThreeValueRuntimeOutputContractOutput(
  runtimeProjection,
  outputName
) {
  return (
    getThreeValueRuntimeOutputContract(runtimeProjection)?.outputs?.[
      outputName
    ] ?? null
  );
}

export function getThreeValueRuntimeOutputSummary(runtimeProjection) {
  const runtimeOutputSource =
    getThreeValueRuntimeOutputSource(runtimeProjection);
  const outputContract = runtimeOutputSource?.outputContract ?? null;
  return {
    ...(runtimeOutputSource?.outputs?.summary ?? {}),
    ...(runtimeOutputSource?.summary ?? {}),
    ...(outputContract?.summary ?? {}),
    ...(runtimeOutputSource?.outputSummary ?? {}),
    ...(runtimeOutputSource?.outputConsumerContract?.summary ?? {}),
  };
}

export function getThreeValueRuntimeSimLogRows(runtimeProjection) {
  const runtimeOutputSource =
    getThreeValueRuntimeOutputSource(runtimeProjection);
  const rows =
    runtimeOutputSource?.outputs?.simLog ?? runtimeOutputSource?.simLog;
  return Array.isArray(rows) ? rows : [];
}

export function getThreeValueRuntimeSimLogCount(runtimeProjection) {
  const runtimeOutputSource =
    getThreeValueRuntimeOutputSource(runtimeProjection);
  const consumerSummaryCount = numberOrNull(
    runtimeOutputSource?.outputConsumerContract?.summary?.simLogCount
  );
  if (Number.isFinite(consumerSummaryCount)) {
    return consumerSummaryCount;
  }

  const simLogOutputCount = numberOrNull(
    getThreeValueRuntimeOutputContractOutput(runtimeProjection, 'simLog')
      ?.rowCount
  );
  if (Number.isFinite(simLogOutputCount)) {
    return simLogOutputCount;
  }

  const outputSummary = getThreeValueRuntimeOutputSummary(runtimeProjection);
  const outputSummaryCount = numberOrNull(outputSummary.simLogCount);
  if (Number.isFinite(outputSummaryCount)) {
    return outputSummaryCount;
  }

  return getThreeValueRuntimeSimLogRows(runtimeProjection).length;
}

export function getThreeValueRuntimeStateCurves(runtimeProjection) {
  const runtimeOutputSource =
    getThreeValueRuntimeOutputSource(runtimeProjection);
  return (
    runtimeOutputSource?.outputs?.stateCurves ??
    runtimeOutputSource?.stateCurves ??
    {}
  );
}

export function getThreeValueRuntimeStateSnapshots(runtimeProjection) {
  const runtimeOutputSource =
    getThreeValueRuntimeOutputSource(runtimeProjection);
  return (
    getThreeValueRuntimeStateCurves(runtimeProjection)?.snapshots ??
    runtimeOutputSource?.stateSnapshots ??
    {}
  );
}

export function getThreeValueRuntimeHitTransactions(runtimeProjection) {
  const runtimeOutputSource =
    getThreeValueRuntimeOutputSource(runtimeProjection);
  return (
    runtimeOutputSource?.outputs?.hitTransactions ??
    runtimeOutputSource?.hitTransactions ??
    {}
  );
}

export function getThreeValueRuntimeEffectTimeline(runtimeProjection) {
  const runtimeOutputSource =
    getThreeValueRuntimeOutputSource(runtimeProjection);
  return (
    runtimeOutputSource?.outputs?.effectTimeline ??
    runtimeOutputSource?.effectTimeline ??
    {}
  );
}

export function getThreeValueRuntimeEnemyStateCurve(runtimeProjection) {
  const runtimeOutputSource =
    getThreeValueRuntimeOutputSource(runtimeProjection);
  return (
    getThreeValueRuntimeStateCurves(runtimeProjection)?.enemy ??
    runtimeOutputSource?.enemyStateCurve ??
    {}
  );
}

export function getThreeValueRuntimeResourceCurves(runtimeProjection) {
  const runtimeOutputSource =
    getThreeValueRuntimeOutputSource(runtimeProjection);
  return (
    runtimeOutputSource?.outputs?.resourceCurves ??
    runtimeOutputSource?.resourceCurves ??
    runtimeOutputSource?.resources ??
    {}
  );
}

export function getThreeValueRuntimeResourceCurveRows(runtimeProjection) {
  const runtimeOutputSource =
    getThreeValueRuntimeOutputSource(runtimeProjection);
  const resourceCurves = getThreeValueRuntimeResourceCurves(runtimeProjection);
  if (Array.isArray(resourceCurves?.curvesByActor)) {
    return resourceCurves.curvesByActor;
  }

  return runtimeOutputSource?.selfEnergyCurveByActor ?? [];
}

function isReadyStatus(status = '') {
  return String(status).includes('ready');
}

function createRuntimeOutputSourceResolutionView(resolution) {
  return {
    sourcePath: resolution.sourcePath,
    sourceTier: resolution.sourceTier,
    sourceKind: resolution.sourceKind,
    status: resolution.status,
    hasRuntimeOutputsEnvelope: resolution.hasRuntimeOutputsEnvelope,
    directRuntimeOutputs: resolution.directRuntimeOutputs,
    legacyProjectionFallback: resolution.legacyProjectionFallback,
    ready: resolution.ready,
  };
}

function createThreeValueRuntimeOutputReadSources(
  runtimeOutputSource,
  runtimeOutputSourceResolution
) {
  const sourcePath = runtimeOutputSourceResolution.sourcePath;
  const sourceTier = runtimeOutputSourceResolution.sourceTier;
  const outputs = {
    simLog: resolveRuntimeOutputReadSource({
      runtimeOutputSource,
      sourcePath,
      sourceTier,
      outputName: 'simLog',
      fieldName: 'simLog',
    }),
    hitTransactions: resolveRuntimeOutputReadSource({
      runtimeOutputSource,
      sourcePath,
      sourceTier,
      outputName: 'hitTransactions',
      fieldName: 'hitTransactions',
    }),
    effectTimeline: resolveRuntimeOutputReadSource({
      runtimeOutputSource,
      sourcePath,
      sourceTier,
      outputName: 'effectTimeline',
      fieldName: 'effectTimeline',
    }),
    stateCurves: resolveRuntimeOutputReadSource({
      runtimeOutputSource,
      sourcePath,
      sourceTier,
      outputName: 'stateCurves',
      fieldName: 'stateCurves',
      aliasFieldName: 'enemyStateCurve',
    }),
    resourceCurves: resolveRuntimeOutputReadSource({
      runtimeOutputSource,
      sourcePath,
      sourceTier,
      outputName: 'resourceCurves',
      fieldName: 'resourceCurves',
      aliasFieldNames: ['resources', 'selfEnergyCurveByActor'],
    }),
    summary: resolveRuntimeSummaryReadSource({
      runtimeOutputSource,
      sourcePath,
      sourceTier,
    }),
  };
  const outputNames = Object.keys(outputs);
  const standardOutputNames = outputNames.filter(
    outputName => outputs[outputName].standardOutputPresent
  );
  const fallbackOutputNames = outputNames.filter(
    outputName => outputs[outputName].fallback
  );
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-three-value-runtime-output-read-sources',
    status: runtimeOutputSource
      ? 'runtime-output-read-sources-ready'
      : 'runtime-output-read-sources-missing',
    root: createRuntimeOutputSourceResolutionView(
      runtimeOutputSourceResolution
    ),
    outputs,
    standardOutputNames,
    fallbackOutputNames,
    standardOutputCount: standardOutputNames.length,
    fallbackOutputCount: fallbackOutputNames.length,
    usesLegacyProjectionFallback: outputNames.some(
      outputName => outputs[outputName].legacyProjectionFallback
    ),
  };
}

function resolveRuntimeOutputReadSource({
  runtimeOutputSource,
  sourcePath,
  sourceTier,
  outputName,
  fieldName,
  aliasFieldName = '',
  aliasFieldNames = [],
}) {
  const fieldTier =
    sourceTier === 'legacy-projection'
      ? 'legacy-projection-field'
      : 'runtime-output-field';
  const aliases = [
    ...(aliasFieldName ? [aliasFieldName] : []),
    ...aliasFieldNames,
  ];
  const candidates = [
    createReadSourceCandidate({
      key: `outputs.${fieldName}`,
      path: joinReadSourcePath(sourcePath, `outputs.${fieldName}`),
      tier: 'standard-output',
      present: hasValue(runtimeOutputSource?.outputs?.[fieldName]),
    }),
    createReadSourceCandidate({
      key: fieldName,
      path: joinReadSourcePath(sourcePath, fieldName),
      tier: fieldTier,
      present: hasValue(runtimeOutputSource?.[fieldName]),
    }),
  ];
  for (const alias of aliases) {
    candidates.push(
      createReadSourceCandidate({
        key: alias,
        path: joinReadSourcePath(sourcePath, alias),
        tier: fieldTier,
        present: hasValue(runtimeOutputSource?.[alias]),
        aliasFor: fieldName,
      })
    );
  }
  const selected =
    candidates.find(candidate => candidate.present) ??
    createMissingReadSourceCandidate(outputName);

  return {
    outputName,
    sourceKey: selected.key,
    sourcePath: selected.path,
    sourceTier: selected.tier,
    aliasFor: selected.aliasFor,
    present: selected.present,
    fallback: selected.present && selected.tier !== 'standard-output',
    standardOutputPresent: candidates.some(
      candidate => candidate.present && candidate.tier === 'standard-output'
    ),
    legacyProjectionFallback:
      selected.present && selected.tier === 'legacy-projection-field',
    candidateSourcePaths: candidates
      .filter(candidate => candidate.present)
      .map(candidate => candidate.path),
  };
}

function resolveRuntimeSummaryReadSource({
  runtimeOutputSource,
  sourcePath,
  sourceTier,
}) {
  const fieldTier =
    sourceTier === 'legacy-projection'
      ? 'legacy-projection-field'
      : 'runtime-output-summary-field';
  const candidates = [
    createReadSourceCandidate({
      key: 'outputs.summary',
      path: joinReadSourcePath(sourcePath, 'outputs.summary'),
      tier: 'standard-output',
      present: hasObjectValue(runtimeOutputSource?.outputs?.summary),
    }),
    createReadSourceCandidate({
      key: 'summary',
      path: joinReadSourcePath(sourcePath, 'summary'),
      tier: fieldTier,
      present: hasObjectValue(runtimeOutputSource?.summary),
    }),
    createReadSourceCandidate({
      key: 'outputContract.summary',
      path: joinReadSourcePath(sourcePath, 'outputContract.summary'),
      tier: 'runtime-output-contract-summary',
      present: hasObjectValue(runtimeOutputSource?.outputContract?.summary),
    }),
    createReadSourceCandidate({
      key: 'outputSummary',
      path: joinReadSourcePath(sourcePath, 'outputSummary'),
      tier: 'runtime-output-summary-alias',
      present: hasObjectValue(runtimeOutputSource?.outputSummary),
    }),
    createReadSourceCandidate({
      key: 'outputConsumerContract.summary',
      path: joinReadSourcePath(sourcePath, 'outputConsumerContract.summary'),
      tier: 'runtime-output-consumer-contract-summary',
      present: hasObjectValue(
        runtimeOutputSource?.outputConsumerContract?.summary
      ),
    }),
  ];
  const presentCandidates = candidates.filter(candidate => candidate.present);
  const selected =
    presentCandidates[presentCandidates.length - 1] ??
    createMissingReadSourceCandidate('summary');

  return {
    outputName: 'summary',
    sourceKey: selected.key,
    sourcePath: selected.path,
    sourceTier: selected.tier,
    aliasFor: selected.aliasFor,
    present: selected.present,
    fallback:
      selected.present &&
      !['standard-output', 'runtime-output-consumer-contract-summary'].includes(
        selected.tier
      ),
    standardOutputPresent: presentCandidates.some(
      candidate => candidate.tier === 'standard-output'
    ),
    legacyProjectionFallback:
      selected.present && selected.tier === 'legacy-projection-field',
    mergeSourcePaths: presentCandidates.map(candidate => candidate.path),
    candidateSourcePaths: presentCandidates.map(candidate => candidate.path),
  };
}

function createReadSourceCandidate({
  key,
  path,
  tier,
  present,
  aliasFor = '',
}) {
  return {
    key,
    path,
    tier,
    present: Boolean(present),
    aliasFor,
  };
}

function createMissingReadSourceCandidate(outputName) {
  return {
    key: outputName,
    path: '',
    tier: 'missing',
    present: false,
    aliasFor: '',
  };
}

function joinReadSourcePath(sourcePath, fieldPath) {
  return sourcePath && fieldPath ? `${sourcePath}.${fieldPath}` : '';
}

function hasValue(value) {
  return value !== null && value !== undefined;
}

function hasObjectValue(value) {
  return Boolean(value && typeof value === 'object');
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
