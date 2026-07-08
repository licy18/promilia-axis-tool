import {
  ACTION_HIT_THREE_VALUE_DELTA_CONTRACT_NAME,
  createThreeValueGenerationLayer,
} from './threeValueGenerationLayer';

export function createActionHitThreeValueDeltaGeneration({
  scenario,
  actionResultTimeline,
  candidateValueSeries,
  runtimeSampleContext,
  stateCurves,
} = {}) {
  const threeValueGenerationLayer = createThreeValueGenerationLayer({
    scenario,
    actionResultTimeline,
    candidateValueSeries,
    runtimeSampleContext,
    stateCurves,
  });
  const standardContract =
    threeValueGenerationLayer.standardContract ??
    createFallbackActionHitThreeValueDeltaContract(threeValueGenerationLayer);
  const summary = createActionHitThreeValueDeltaGenerationSummary({
    threeValueGenerationLayer,
    standardContract,
  });

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-action-hit-three-value-delta-generation-entry',
    status:
      summary.deltaCount > 0
        ? 'action-hit-three-value-delta-generation-ready'
        : 'action-hit-three-value-delta-generation-empty',
    contractName: standardContract.name,
    inputSourceKind: threeValueGenerationLayer.inputSourceKind,
    inputStatus: threeValueGenerationLayer.inputStatus,
    inputSources: threeValueGenerationLayer.inputSources ?? [],
    threeValueGenerationLayer,
    standardContract,
    actions: standardContract.actions ?? [],
    hits: standardContract.hits ?? [],
    deltas: standardContract.deltas ?? [],
    summary,
    applied: false,
  };
}

function createActionHitThreeValueDeltaGenerationSummary({
  threeValueGenerationLayer,
  standardContract,
}) {
  return {
    contractName: standardContract.name,
    generationLayerSourceKind: threeValueGenerationLayer.sourceKind,
    generationLayerStatus: threeValueGenerationLayer.status,
    standardContractSourceKind: standardContract.sourceKind,
    standardContractStatus: standardContract.status,
    inputSourceKind: threeValueGenerationLayer.inputSourceKind,
    inputStatus: threeValueGenerationLayer.inputStatus,
    topology: standardContract.topology ?? [
      'Action',
      'Hit',
      'ThreeValueDelta',
    ],
    deltaFields: standardContract.deltaFields ?? [],
    runtimeDeltaPolicy: standardContract.runtimeDeltaPolicy ?? null,
    actionCount: standardContract.summary?.actionCount ?? 0,
    hitCount: standardContract.summary?.hitCount ?? 0,
    deltaCount: standardContract.summary?.deltaCount ?? 0,
    appliedDeltaCount: standardContract.summary?.appliedDeltaCount ?? 0,
    candidateDeltaCount: standardContract.summary?.candidateDeltaCount ?? 0,
    sampledDeltaCount: standardContract.summary?.sampledDeltaCount ?? 0,
    placeholderDeltaCount: standardContract.summary?.placeholderDeltaCount ?? 0,
    applied: false,
  };
}

function createFallbackActionHitThreeValueDeltaContract(
  threeValueGenerationLayer
) {
  return {
    schemaVersion: 1,
    sourceKind:
      threeValueGenerationLayer?.sourceKind ??
      'azpr-standard-three-value-generation-layer',
    status: threeValueGenerationLayer?.status ?? null,
    name:
      threeValueGenerationLayer?.contract?.name ??
      threeValueGenerationLayer?.summary?.contractName ??
      ACTION_HIT_THREE_VALUE_DELTA_CONTRACT_NAME,
    version: threeValueGenerationLayer?.contract?.version ?? 1,
    actions: threeValueGenerationLayer?.actions ?? [],
    hits: threeValueGenerationLayer?.hits ?? [],
    deltas: threeValueGenerationLayer?.deltas ?? [],
    summary: threeValueGenerationLayer?.summary ?? {},
    applied: false,
  };
}
