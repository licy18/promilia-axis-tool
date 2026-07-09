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
    runtimeInput: {
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
      generationReadSourcesStatus:
        runtimeInputGenerationReadSources.status ?? '',
      generationReadStandardOutputCount: numberOrZero(
        runtimeInputGenerationReadSources.standardOutputCount
      ),
      generationReadFallbackInputCount: numberOrZero(
        runtimeInputGenerationReadSources.fallbackInputCount
      ),
      generationReadUsesLegacyFallback: Boolean(
        runtimeInputGenerationReadSources.usesLegacyGenerationFallback
      ),
      generationRuntimeInputSourcePath:
        runtimeInputGenerationReadInputs.runtimeInputSource?.sourcePath ?? '',
      generationStandardContractSourcePath:
        runtimeInputGenerationReadInputs.standardContract?.sourcePath ?? '',
      generationDeltasSourcePath:
        runtimeInputGenerationReadInputs.deltas?.sourcePath ?? '',
      appliedOnly: Boolean(runtimeInput?.appliedOnly ?? true),
      ready: isReadyStatus(runtimeInput?.status),
    },
    runtimeOutput: {
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
      outputCount: numberOrZero(outputSummary.outputCount),
      simLogCount: numberOrZero(
        outputSummary.simLogCount ?? runtimeSummary.simLogCount
      ),
      enemyStatePointCount: numberOrZero(
        outputSummary.enemyStatePointCount ??
          runtimeSummary.enemyStatePointCount
      ),
      stateCurvePointCount: numberOrZero(
        outputSummary.stateCurvePointCount ??
          runtimeSummary.stateCurvePointCount
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
    },
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

function isReadyStatus(status = '') {
  return String(status).includes('ready');
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
