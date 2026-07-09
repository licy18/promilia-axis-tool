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
  const generationInput = threeValueGenerationLayer.generationInput ?? null;
  const standardContract =
    threeValueGenerationLayer.standardContract ??
    createFallbackActionHitThreeValueDeltaContract(threeValueGenerationLayer);
  const summary = createActionHitThreeValueDeltaGenerationSummary({
    threeValueGenerationLayer,
    generationInput,
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
    generationInput,
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
  generationInput,
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
    inputPointCount: generationInput?.summary?.pointCount ?? 0,
    inputAppliedPointCount: generationInput?.summary?.appliedPointCount ?? 0,
    inputCandidatePointCount:
      generationInput?.summary?.candidatePointCount ?? 0,
    inputSampledPointCount: generationInput?.summary?.sampledPointCount ?? 0,
    inputPlaceholderPointCount:
      generationInput?.summary?.placeholderPointCount ?? 0,
    topology: standardContract.topology ?? ['Action', 'Hit', 'ThreeValueDelta'],
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
