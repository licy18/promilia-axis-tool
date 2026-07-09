import { createThreeValueRuntimeOutputConsumerView } from '../../simulation/runtime/threeValueRuntimeOutputConsumer';

export function createWorkbenchFlowContractContext({
  generationBundle = null,
  runtimeProjection = null,
  runtimeOutputs = null,
} = {}) {
  const generationOutputs = generationBundle?.generationOutputs ?? null;
  const legacyGenerationEntry =
    generationBundle?.actionHitThreeValueDeltaGeneration ?? null;
  const generationEntry = generationOutputs ?? legacyGenerationEntry;
  const generationInput =
    generationOutputs?.generationInput ??
    generationOutputs?.outputs?.generationInput ??
    generationBundle?.generationInput ??
    legacyGenerationEntry?.generationInput ??
    legacyGenerationEntry?.threeValueGenerationLayer?.generationInput ??
    null;
  const standardContract =
    generationOutputs?.standardContract ??
    generationOutputs?.outputs?.standardContract ??
    generationBundle?.standardContract ??
    legacyGenerationEntry?.standardContract ??
    null;
  const runtimeInput = runtimeProjection?.runtimeInput ?? null;
  const runtimeInputGenerationReadSources =
    runtimeInput?.generationReadSources ?? {};
  const runtimeInputGenerationReadInputs =
    runtimeInputGenerationReadSources.inputs ?? {};
  const runtimeOutputSource =
    runtimeOutputs ?? runtimeProjection?.runtimeOutputs ?? runtimeProjection;
  const runtimeOutputConsumerView =
    createThreeValueRuntimeOutputConsumerView(runtimeOutputSource);
  const outputConsumerBoundary =
    runtimeOutputConsumerView.outputConsumerBoundary ?? {};
  const runtimeOutputReadSources =
    runtimeOutputConsumerView.outputReadSources ?? {};
  const runtimeOutputReadOutputs = runtimeOutputReadSources.outputs ?? {};
  const outputContract = runtimeOutputConsumerView.outputContract;
  const outputConsumerContract =
    runtimeOutputConsumerView.outputConsumerContract ?? null;
  const runtimeSummary = runtimeOutputConsumerView.outputSummary ?? {};
  const outputSummary = runtimeOutputConsumerView.outputSummary ?? {};
  const outputConsistency = runtimeOutputConsumerView.outputConsistency ?? {};
  const simLogOutput =
    outputConsumerContract?.outputs?.simLog ??
    outputContract?.outputs?.simLog ??
    null;
  const stateCurvesOutput =
    outputConsumerContract?.outputs?.stateCurves ??
    outputContract?.outputs?.stateCurves ??
    null;
  const resourceCurvesOutput =
    outputConsumerContract?.outputs?.resourceCurves ??
    outputContract?.outputs?.resourceCurves ??
    null;
  const contractName =
    standardContract?.name ??
    generationBundle?.contractName ??
    runtimeInput?.contractName ??
    runtimeProjection?.inputContractName ??
    '';
  const runtimeInputContext = {
    sourceKind: runtimeInput?.sourceKind ?? '',
    status: runtimeInput?.status ?? '',
    runtimeInputSourceKind: runtimeInput?.runtimeInputSourceKind ?? '',
    generationEntrySourceKind: runtimeInput?.generationEntrySourceKind ?? '',
    appliedDeltaSource:
      runtimeInput?.appliedDeltaSource ??
      runtimeInput?.summary?.appliedDeltaSource ??
      runtimeSummary.runtimeInputSource ??
      '',
    inputDeltaCount: numberOrZero(
      runtimeInput?.summary?.inputDeltaCount ?? runtimeSummary.inputDeltaCount
    ),
    appliedDeltaCount: numberOrZero(
      runtimeInput?.summary?.appliedDeltaCount ??
        runtimeSummary.appliedDeltaCount
    ),
    ignoredDeltaCount: numberOrZero(
      runtimeInput?.ignoredDeltaCount ??
        runtimeInput?.summary?.ignoredDeltaCount ??
        runtimeSummary.runtimeInputIgnoredDeltaCount
    ),
    generationReadSourcesStatus: runtimeInputGenerationReadSources.status ?? '',
    generationReadStandardOutputCount: numberOrZero(
      runtimeInputGenerationReadSources.standardOutputCount
    ),
    generationReadFallbackInputCount: numberOrZero(
      runtimeInputGenerationReadSources.fallbackInputCount
    ),
    generationReadUsesLegacyFallback: Boolean(
      runtimeInputGenerationReadSources.usesLegacyGenerationFallback
    ),
    generationStandardBoundaryReady: Boolean(
      runtimeInputGenerationReadSources.standardGenerationBoundaryReady ??
      runtimeSummary.runtimeInputGenerationStandardBoundaryReady
    ),
    generationAggregateBoundaryReady: Boolean(
      runtimeInputGenerationReadSources.standardGenerationAggregateBoundaryReady ??
      runtimeSummary.runtimeInputGenerationAggregateBoundaryReady
    ),
    generationEntryContractValidationStatus:
      runtimeInput?.generationEntryContractValidationStatus ??
      runtimeInput?.summary?.generationEntryContractValidationStatus ??
      runtimeInputGenerationReadSources.generationEntryContractValidationStatus ??
      runtimeSummary.runtimeInputGenerationEntryContractValidationStatus ??
      '',
    generationEntryContractValidationIssueCount: numberOrZero(
      runtimeInput?.generationEntryContractValidationIssueCount ??
        runtimeInput?.summary?.generationEntryContractValidationIssueCount ??
        runtimeInputGenerationReadSources.generationEntryContractValidationIssueCount ??
        runtimeSummary.runtimeInputGenerationEntryContractValidationIssueCount
    ),
    generationEntryContractValidationValid: Boolean(
      runtimeInput?.generationEntryContractValidationValid ??
      runtimeInput?.summary?.generationEntryContractValidationValid ??
      runtimeInputGenerationReadSources.generationEntryContractValidationValid ??
      runtimeSummary.runtimeInputGenerationEntryContractValidationValid
    ),
    generationEntryAggregateValidationStatus:
      runtimeInput?.generationEntryAggregateValidationStatus ??
      runtimeInput?.summary?.generationEntryAggregateValidationStatus ??
      runtimeInputGenerationReadSources.generationEntryAggregateValidationStatus ??
      runtimeSummary.runtimeInputGenerationEntryAggregateValidationStatus ??
      '',
    generationEntryAggregateValidationIssueCount: numberOrZero(
      runtimeInput?.generationEntryAggregateValidationIssueCount ??
        runtimeInput?.summary?.generationEntryAggregateValidationIssueCount ??
        runtimeInputGenerationReadSources.generationEntryAggregateValidationIssueCount ??
        runtimeSummary.runtimeInputGenerationEntryAggregateValidationIssueCount
    ),
    generationEntryAggregateValidationValid: Boolean(
      runtimeInput?.generationEntryAggregateValidationValid ??
      runtimeInput?.summary?.generationEntryAggregateValidationValid ??
      runtimeInputGenerationReadSources.generationEntryAggregateValidationValid ??
      runtimeSummary.runtimeInputGenerationEntryAggregateValidationValid
    ),
    generationEntrySourcePath:
      runtimeInputGenerationReadInputs.generationEntry?.sourcePath ?? '',
    generationRuntimeInputSourcePath:
      runtimeInputGenerationReadInputs.runtimeInputSource?.sourcePath ?? '',
    generationStandardContractSourcePath:
      runtimeInputGenerationReadInputs.standardContract?.sourcePath ?? '',
    generationDeltasSourcePath:
      runtimeInputGenerationReadInputs.deltas?.sourcePath ?? '',
    generationContractValidationSourcePath:
      runtimeInputGenerationReadInputs.contractValidation?.sourcePath ?? '',
    generationAggregateValidationSourcePath: runtimeInputGenerationReadInputs
      .contractValidation?.sourcePath
      ? `${runtimeInputGenerationReadInputs.contractValidation.sourcePath}.aggregateValidation`
      : (runtimeSummary.runtimeInputGenerationAggregateValidationPath ?? ''),
    appliedOnly: Boolean(runtimeInput?.appliedOnly ?? true),
    ready: isReadyStatus(runtimeInput?.status),
  };
  const runtimeOutputContext = {
    sourceKind: outputContract?.sourceKind ?? '',
    status: outputContract?.status ?? '',
    consumerContractSourceKind: outputConsumerContract?.sourceKind ?? '',
    consumerContractStatus: outputConsumerContract?.status ?? '',
    runtimeOutputsSourceKind: runtimeOutputSource?.sourceKind ?? '',
    runtimeOutputsStatus: runtimeOutputSource?.status ?? '',
    resourcesAlias: runtimeOutputSource?.outputAliases?.resources ?? '',
    simLogInputSource: simLogOutput?.inputSource ?? '',
    stateCurvesSourceKind: stateCurvesOutput?.sourceKind ?? '',
    resourceCurvesSourceKind: resourceCurvesOutput?.sourceKind ?? '',
    outputReadSourcesStatus: runtimeOutputReadSources.status ?? '',
    outputReadStandardOutputCount: numberOrZero(
      runtimeOutputReadSources.standardOutputCount
    ),
    outputReadFallbackOutputCount: numberOrZero(
      runtimeOutputReadSources.fallbackOutputCount
    ),
    outputReadUsesLegacyFallback: Boolean(
      runtimeOutputReadSources.usesLegacyProjectionFallback
    ),
    outputConsumerBoundaryStatus: outputConsumerBoundary.status ?? '',
    outputConsumerBoundaryReady: Boolean(outputConsumerBoundary.ready),
    outputConsumerBoundaryStandardReady: Boolean(
      outputConsumerBoundary.standardBoundaryReady
    ),
    outputConsumerBoundaryUsesLegacyFallback: Boolean(
      outputConsumerBoundary.usesLegacyProjectionFallback
    ),
    outputConsumerBoundaryStandardOutputCount: numberOrZero(
      outputConsumerBoundary.standardOutputCount
    ),
    outputConsumerBoundaryFallbackOutputCount: numberOrZero(
      outputConsumerBoundary.fallbackOutputCount
    ),
    outputReadSimLogSourcePath:
      runtimeOutputReadOutputs.simLog?.sourcePath ?? '',
    outputReadStateCurvesSourcePath:
      runtimeOutputReadOutputs.stateCurves?.sourcePath ?? '',
    outputReadResourceCurvesSourcePath:
      runtimeOutputReadOutputs.resourceCurves?.sourcePath ?? '',
    outputReadSummarySourcePath:
      runtimeOutputReadOutputs.summary?.sourcePath ?? '',
    outputCount: numberOrZero(outputSummary.outputCount),
    simLogCount: numberOrZero(
      outputSummary.simLogCount ?? runtimeSummary.simLogCount
    ),
    enemyStatePointCount: numberOrZero(
      outputSummary.enemyStatePointCount ?? runtimeSummary.enemyStatePointCount
    ),
    stateCurvePointCount: numberOrZero(
      outputSummary.stateCurvePointCount ?? runtimeSummary.stateCurvePointCount
    ),
    resourceCurvePointCount: numberOrZero(
      outputSummary.resourceCurvePointCount ??
        runtimeSummary.resourceCurvePointCount
    ),
    outputConsistencyStatus:
      outputSummary.outputConsistencyStatus ?? outputConsistency.status ?? '',
    outputConsistent: Boolean(
      outputSummary.outputConsistent ?? outputConsistency.consistent
    ),
    ready: runtimeOutputConsumerView.ready,
  };
  const runtimeContractBoundary = createWorkbenchRuntimeContractBoundary({
    runtimeInput: runtimeInputContext,
    runtimeOutput: runtimeOutputContext,
  });

  return {
    contractName,
    generationEntry: createFlowSourceState({
      sourceKind: generationEntry?.sourceKind,
      status: generationEntry?.status,
      summary:
        generationOutputs?.summary ??
        generationOutputs?.outputSummary ??
        generationEntry?.summary,
      readyStatus: generationOutputs
        ? 'generation-outputs-ready'
        : 'action-hit-three-value-delta-generation-ready',
      extra: {
        generationInputSourceKind: generationInput?.sourceKind ?? '',
        generationInputStatus: generationInput?.status ?? '',
        generationInputPointCount: numberOrZero(
          generationInput?.summary?.pointCount
        ),
        generationInputAppliedPointCount: numberOrZero(
          generationInput?.summary?.appliedPointCount
        ),
        generationInputCandidatePointCount: numberOrZero(
          generationInput?.summary?.candidatePointCount
        ),
        generationInputSampledPointCount: numberOrZero(
          generationInput?.summary?.sampledPointCount
        ),
        generationInputPlaceholderPointCount: numberOrZero(
          generationInput?.summary?.placeholderPointCount
        ),
      },
    }),
    standardContract: createFlowSourceState({
      sourceKind: standardContract?.sourceKind,
      status: standardContract?.status,
      summary: standardContract?.summary,
      readyStatus: 'action-hit-three-value-delta-contract-ready',
    }),
    runtimeInput: runtimeInputContext,
    runtimeOutput: runtimeOutputContext,
    runtimeContractBoundary,
  };
}

function createFlowSourceState({
  sourceKind = '',
  status = '',
  summary = {},
  readyStatus = '',
  extra = {},
} = {}) {
  return {
    sourceKind: sourceKind ?? '',
    status: status ?? '',
    actionCount: numberOrZero(summary?.actionCount),
    hitCount: numberOrZero(summary?.hitCount),
    deltaCount: numberOrZero(summary?.deltaCount),
    appliedDeltaCount: numberOrZero(summary?.appliedDeltaCount),
    ready: readyStatus ? status === readyStatus : isReadyStatus(status),
    ...extra,
  };
}

function createWorkbenchRuntimeContractBoundary({
  runtimeInput = {},
  runtimeOutput = {},
} = {}) {
  const generationStandardReady =
    Boolean(runtimeInput.generationStandardBoundaryReady) ||
    (runtimeInput.generationReadStandardOutputCount >= 5 &&
      runtimeInput.generationEntryContractValidationValid &&
      !runtimeInput.generationReadUsesLegacyFallback);
  const runtimeOutputStandardReady =
    Boolean(runtimeOutput.outputConsumerBoundaryStandardReady) ||
    (runtimeOutput.outputReadStandardOutputCount >= 4 &&
      !runtimeOutput.outputReadUsesLegacyFallback);
  const generationAggregateReady =
    Boolean(runtimeInput.generationAggregateBoundaryReady) ||
    (generationStandardReady &&
      runtimeInput.generationEntryAggregateValidationValid);
  const ready = Boolean(runtimeInput.ready && runtimeOutput.ready);
  const standardBoundaryReady =
    ready &&
    generationStandardReady &&
    generationAggregateReady &&
    runtimeOutputStandardReady;
  const usesLegacyFallback = Boolean(
    runtimeInput.generationReadUsesLegacyFallback ||
    runtimeOutput.outputReadUsesLegacyFallback ||
    runtimeOutput.outputConsumerBoundaryUsesLegacyFallback
  );
  const fallbackCount =
    numberOrZero(runtimeInput.generationReadFallbackInputCount) +
    numberOrZero(runtimeOutput.outputReadFallbackOutputCount);
  const simLogConnectedToAppliedDeltas = Boolean(
    runtimeInput.appliedDeltaSource &&
    runtimeInput.appliedDeltaSource === runtimeOutput.simLogInputSource
  );
  const status = !ready
    ? 'workbench-runtime-contract-boundary-incomplete'
    : standardBoundaryReady && simLogConnectedToAppliedDeltas
      ? 'workbench-runtime-contract-boundary-standard'
      : 'workbench-runtime-contract-boundary-ready-with-fallbacks';

  return {
    schemaVersion: 1,
    sourceKind: 'workbench-runtime-contract-boundary',
    status,
    ready,
    readyState: ready ? 'true' : 'false',
    standardBoundaryReady,
    standardBoundaryReadyState: standardBoundaryReady ? 'true' : 'false',
    generationStandardReady,
    generationStandardReadyState: generationStandardReady ? 'true' : 'false',
    generationAggregateReady,
    generationAggregateReadyState: generationAggregateReady ? 'true' : 'false',
    runtimeOutputStandardReady,
    runtimeOutputStandardReadyState: runtimeOutputStandardReady
      ? 'true'
      : 'false',
    simLogConnectedToAppliedDeltas,
    simLogConnectedToAppliedDeltasState: simLogConnectedToAppliedDeltas
      ? 'true'
      : 'false',
    usesLegacyFallback,
    usesLegacyFallbackState: usesLegacyFallback ? 'true' : 'false',
    fallbackCount,
    generationReadSourcesStatus: runtimeInput.generationReadSourcesStatus ?? '',
    runtimeOutputReadSourcesStatus: runtimeOutput.outputReadSourcesStatus ?? '',
    runtimeOutputConsumerBoundaryStatus:
      runtimeOutput.outputConsumerBoundaryStatus ?? '',
    runtimeOutputConsumerBoundaryReady: Boolean(
      runtimeOutput.outputConsumerBoundaryReady
    ),
    runtimeOutputConsumerBoundaryReadyState:
      runtimeOutput.outputConsumerBoundaryReady ? 'true' : 'false',
    runtimeOutputConsumerBoundaryStandardReady: Boolean(
      runtimeOutput.outputConsumerBoundaryStandardReady
    ),
    runtimeOutputConsumerBoundaryStandardReadyState:
      runtimeOutput.outputConsumerBoundaryStandardReady ? 'true' : 'false',
    generationReadStandardOutputCount: numberOrZero(
      runtimeInput.generationReadStandardOutputCount
    ),
    runtimeOutputReadStandardOutputCount: numberOrZero(
      runtimeOutput.outputReadStandardOutputCount
    ),
    generationReadFallbackInputCount: numberOrZero(
      runtimeInput.generationReadFallbackInputCount
    ),
    runtimeOutputReadFallbackOutputCount: numberOrZero(
      runtimeOutput.outputReadFallbackOutputCount
    ),
    runtimeOutputConsumerBoundaryStandardOutputCount: numberOrZero(
      runtimeOutput.outputConsumerBoundaryStandardOutputCount
    ),
    runtimeOutputConsumerBoundaryFallbackOutputCount: numberOrZero(
      runtimeOutput.outputConsumerBoundaryFallbackOutputCount
    ),
    generationEntryContractValidationStatus:
      runtimeInput.generationEntryContractValidationStatus ?? '',
    generationEntryContractValidationIssueCount: numberOrZero(
      runtimeInput.generationEntryContractValidationIssueCount
    ),
    generationEntryContractValidationValid: Boolean(
      runtimeInput.generationEntryContractValidationValid
    ),
    generationEntryContractValidationValidState:
      runtimeInput.generationEntryContractValidationValid ? 'true' : 'false',
    generationEntryAggregateValidationStatus:
      runtimeInput.generationEntryAggregateValidationStatus ?? '',
    generationEntryAggregateValidationIssueCount: numberOrZero(
      runtimeInput.generationEntryAggregateValidationIssueCount
    ),
    generationEntryAggregateValidationValid: Boolean(
      runtimeInput.generationEntryAggregateValidationValid
    ),
    generationEntryAggregateValidationValidState:
      runtimeInput.generationEntryAggregateValidationValid ? 'true' : 'false',
    generationEntrySourcePath: runtimeInput.generationEntrySourcePath ?? '',
    generationDeltasSourcePath: runtimeInput.generationDeltasSourcePath ?? '',
    generationContractValidationSourcePath:
      runtimeInput.generationContractValidationSourcePath ?? '',
    generationAggregateValidationSourcePath:
      runtimeInput.generationAggregateValidationSourcePath ?? '',
    runtimeSimLogSourcePath: runtimeOutput.outputReadSimLogSourcePath ?? '',
    runtimeSummarySourcePath: runtimeOutput.outputReadSummarySourcePath ?? '',
  };
}

function isReadyStatus(status = '') {
  return String(status).includes('ready');
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
