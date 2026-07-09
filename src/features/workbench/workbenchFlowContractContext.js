export function createWorkbenchFlowContractContext({
  generationBundle = null,
  runtimeProjection = null,
  runtimeOutputs = null,
} = {}) {
  const generationEntry =
    generationBundle?.actionHitThreeValueDeltaGeneration ?? null;
  const standardContract =
    generationBundle?.standardContract ??
    generationEntry?.standardContract ??
    null;
  const runtimeInput = runtimeProjection?.runtimeInput ?? null;
  const runtimeOutputSource =
    runtimeOutputs ?? runtimeProjection?.runtimeOutputs ?? runtimeProjection;
  const outputContract = runtimeOutputSource?.outputContract ?? null;
  const runtimeSummary = runtimeOutputSource?.summary ?? {};
  const outputSummary = {
    ...(outputContract?.summary ?? {}),
    ...(runtimeOutputSource?.outputSummary ?? {}),
  };
  const simLogOutput = outputContract?.outputs?.simLog ?? null;
  const stateCurvesOutput = outputContract?.outputs?.stateCurves ?? null;
  const resourceCurvesOutput = outputContract?.outputs?.resourceCurves ?? null;
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
      summary: generationEntry?.summary,
      readyStatus: 'action-hit-three-value-delta-generation-ready',
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
      appliedOnly: Boolean(runtimeInput?.appliedOnly ?? true),
      ready: isReadyStatus(runtimeInput?.status),
    },
    runtimeOutput: {
      sourceKind: outputContract?.sourceKind ?? '',
      status: outputContract?.status ?? '',
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
      ready: isReadyStatus(outputContract?.status),
    },
  };
}

function createFlowSourceState({
  sourceKind = '',
  status = '',
  summary = {},
  readyStatus = '',
} = {}) {
  return {
    sourceKind: sourceKind ?? '',
    status: status ?? '',
    actionCount: numberOrZero(summary?.actionCount),
    hitCount: numberOrZero(summary?.hitCount),
    deltaCount: numberOrZero(summary?.deltaCount),
    appliedDeltaCount: numberOrZero(summary?.appliedDeltaCount),
    ready: readyStatus ? status === readyStatus : isReadyStatus(status),
  };
}

function isReadyStatus(status = '') {
  return String(status).includes('ready');
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
