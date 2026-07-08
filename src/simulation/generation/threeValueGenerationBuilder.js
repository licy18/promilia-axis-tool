import {
  createActionHitThreeValueDeltaGeneration,
} from './actionHitThreeValueDeltaGeneration';
import { ACTION_HIT_THREE_VALUE_DELTA_CONTRACT_NAME } from './threeValueGenerationLayer';

export function createThreeValueGenerationBundle({
  scenario,
  actionResultTimeline,
  candidateValueSeries,
  runtimeSampleContext,
  stateCurves,
}) {
  const actionHitThreeValueDeltaGeneration =
    createActionHitThreeValueDeltaGeneration({
      scenario,
      actionResultTimeline,
      candidateValueSeries,
      runtimeSampleContext,
      stateCurves,
    });
  const threeValueGenerationLayer =
    actionHitThreeValueDeltaGeneration.threeValueGenerationLayer;
  const standardContract =
    actionHitThreeValueDeltaGeneration.standardContract ??
    createFallbackStandardContract(threeValueGenerationLayer);
  const runtimeInputSource = createRuntimeInputSource({
    standardContract,
    threeValueGenerationLayer,
    actionHitThreeValueDeltaGeneration,
  });
  const summary = createThreeValueGenerationBundleSummary({
    standardContract,
    threeValueGenerationLayer,
    actionHitThreeValueDeltaGeneration,
    runtimeInputSource,
  });

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-three-value-generation-builder-bundle',
    status:
      summary.deltaCount > 0
        ? 'three-value-generation-builder-ready'
        : 'three-value-generation-builder-empty',
    contractName: standardContract.name,
    actionHitThreeValueDeltaGeneration,
    threeValueGenerationLayer,
    standardContract,
    runtimeInputSource,
    actions: standardContract.actions,
    hits: standardContract.hits,
    deltas: standardContract.deltas,
    summary,
    applied: false,
  };
}

function createRuntimeInputSource({
  standardContract,
  threeValueGenerationLayer,
  actionHitThreeValueDeltaGeneration,
}) {
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-runtime-input-source-from-generation-builder',
    status:
      (standardContract.deltas ?? []).length > 0
        ? 'runtime-input-source-ready'
        : 'runtime-input-source-empty',
    contractName: standardContract.name,
    generationEntrySourceKind: actionHitThreeValueDeltaGeneration.sourceKind,
    generationEntryStatus: actionHitThreeValueDeltaGeneration.status,
    generationLayerSourceKind: threeValueGenerationLayer.sourceKind,
    generationLayerStatus: threeValueGenerationLayer.status,
    standardContractSourceKind: standardContract.sourceKind,
    standardContractStatus: standardContract.status,
    standardContract,
    deltas: standardContract.deltas,
    summary: {
      actionCount: standardContract.summary?.actionCount ?? 0,
      hitCount: standardContract.summary?.hitCount ?? 0,
      deltaCount: standardContract.summary?.deltaCount ?? 0,
      appliedDeltaCount: standardContract.summary?.appliedDeltaCount ?? 0,
      runtimeDeltaPolicy: standardContract.runtimeDeltaPolicy,
      applied: false,
    },
    applied: false,
  };
}

function createThreeValueGenerationBundleSummary({
  standardContract,
  threeValueGenerationLayer,
  actionHitThreeValueDeltaGeneration,
  runtimeInputSource,
}) {
  return {
    contractName: standardContract.name,
    generationEntrySourceKind: actionHitThreeValueDeltaGeneration.sourceKind,
    generationEntryStatus: actionHitThreeValueDeltaGeneration.status,
    generationLayerStatus: threeValueGenerationLayer.status,
    generationLayerSourceKind: threeValueGenerationLayer.sourceKind,
    standardContractStatus: standardContract.status,
    standardContractSourceKind: standardContract.sourceKind,
    runtimeInputSourceKind: runtimeInputSource.sourceKind,
    runtimeInputSourceStatus: runtimeInputSource.status,
    actionCount: standardContract.summary?.actionCount ?? 0,
    hitCount: standardContract.summary?.hitCount ?? 0,
    deltaCount: standardContract.summary?.deltaCount ?? 0,
    appliedDeltaCount: standardContract.summary?.appliedDeltaCount ?? 0,
    candidateDeltaCount: standardContract.summary?.candidateDeltaCount ?? 0,
    sampledDeltaCount: standardContract.summary?.sampledDeltaCount ?? 0,
    placeholderDeltaCount:
      standardContract.summary?.placeholderDeltaCount ?? 0,
    calculatorCount: standardContract.summary?.calculatorCount ?? 0,
    applied: false,
  };
}

function createFallbackStandardContract(threeValueGenerationLayer) {
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
