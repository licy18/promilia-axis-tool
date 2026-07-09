import { createActionHitThreeValueDeltaGeneration } from './actionHitThreeValueDeltaGeneration';
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
  const generationInput =
    actionHitThreeValueDeltaGeneration.generationInput ??
    threeValueGenerationLayer.generationInput ??
    null;
  const runtimeInputSource = createRuntimeInputSource({
    standardContract,
    threeValueGenerationLayer,
    actionHitThreeValueDeltaGeneration,
  });
  const generationEntry = createStandardGenerationEntry({
    generationInput,
    standardContract,
    runtimeInputSource,
    threeValueGenerationLayer,
    actionHitThreeValueDeltaGeneration,
  });
  const generationOutputs = createThreeValueGenerationOutputs({
    generationEntry,
    generationInput,
    standardContract,
    runtimeInputSource,
    threeValueGenerationLayer,
    actionHitThreeValueDeltaGeneration,
  });
  const summary = createThreeValueGenerationBundleSummary({
    standardContract,
    threeValueGenerationLayer,
    actionHitThreeValueDeltaGeneration,
    generationEntry,
    generationInput,
    runtimeInputSource,
    generationOutputs,
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
    generationEntry,
    generationInput,
    standardContract,
    runtimeInputSource,
    generationOutputs,
    actions: standardContract.actions,
    hits: standardContract.hits,
    deltas: standardContract.deltas,
    summary,
    applied: false,
  };
}

function createThreeValueGenerationOutputs({
  generationEntry,
  generationInput,
  standardContract,
  runtimeInputSource,
  threeValueGenerationLayer,
  actionHitThreeValueDeltaGeneration,
}) {
  const outputs = {
    generationEntry,
    generationInput,
    standardContract,
    actions: standardContract.actions,
    hits: standardContract.hits,
    deltas: standardContract.deltas,
    runtimeInputSource,
    runtimeInput: runtimeInputSource,
  };
  const outputSummary = {
    outputCount: Object.keys(outputs).length,
    actionCount: standardContract.summary?.actionCount ?? 0,
    hitCount: standardContract.summary?.hitCount ?? 0,
    deltaCount: standardContract.summary?.deltaCount ?? 0,
    appliedDeltaCount: standardContract.summary?.appliedDeltaCount ?? 0,
    candidateDeltaCount: standardContract.summary?.candidateDeltaCount ?? 0,
    sampledDeltaCount: standardContract.summary?.sampledDeltaCount ?? 0,
    placeholderDeltaCount: standardContract.summary?.placeholderDeltaCount ?? 0,
    runtimeInputSourceKind: runtimeInputSource.sourceKind,
    runtimeInputSourceStatus: runtimeInputSource.status,
    generationInputSourceKind: generationInput?.sourceKind ?? '',
    generationInputStatus: generationInput?.status ?? '',
    generationInputPointCount: generationInput?.summary?.pointCount ?? 0,
    generationInputAppliedPointCount:
      generationInput?.summary?.appliedPointCount ?? 0,
    generationInputCandidatePointCount:
      generationInput?.summary?.candidatePointCount ?? 0,
    generationInputSampledPointCount:
      generationInput?.summary?.sampledPointCount ?? 0,
    generationInputPlaceholderPointCount:
      generationInput?.summary?.placeholderPointCount ?? 0,
    runtimeDeltaPolicy: standardContract.runtimeDeltaPolicy,
    applied: false,
  };

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-three-value-generation-outputs',
    status:
      (standardContract.deltas ?? []).length > 0
        ? 'generation-outputs-ready'
        : 'generation-outputs-empty',
    contractName: standardContract.name,
    generationEntrySourceKind: actionHitThreeValueDeltaGeneration.sourceKind,
    generationEntryStatus: actionHitThreeValueDeltaGeneration.status,
    generationLayerSourceKind: threeValueGenerationLayer.sourceKind,
    generationLayerStatus: threeValueGenerationLayer.status,
    standardContractSourceKind: standardContract.sourceKind,
    standardContractStatus: standardContract.status,
    outputNames: Object.keys(outputs),
    outputAliases: {
      actionHitThreeValueDeltaGeneration: 'generationEntry',
      runtimeInput: 'runtimeInputSource',
    },
    generationEntry,
    generationInput,
    standardContract,
    actions: standardContract.actions,
    hits: standardContract.hits,
    deltas: standardContract.deltas,
    runtimeInputSource,
    runtimeInput: runtimeInputSource,
    outputs,
    summary: outputSummary,
    outputSummary,
    applied: false,
  };
}

function createStandardGenerationEntry({
  generationInput,
  standardContract,
  runtimeInputSource,
  threeValueGenerationLayer,
  actionHitThreeValueDeltaGeneration,
}) {
  const deltas = standardContract.deltas ?? [];
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-action-hit-three-value-delta-standard-generation-entry',
    status:
      deltas.length > 0
        ? 'action-hit-three-value-delta-standard-generation-entry-ready'
        : 'action-hit-three-value-delta-standard-generation-entry-empty',
    contractName: standardContract.name,
    generationEntrySourceKind: actionHitThreeValueDeltaGeneration.sourceKind,
    generationEntryStatus: actionHitThreeValueDeltaGeneration.status,
    generationLayerSourceKind: threeValueGenerationLayer.sourceKind,
    generationLayerStatus: threeValueGenerationLayer.status,
    standardContractSourceKind: standardContract.sourceKind,
    standardContractStatus: standardContract.status,
    runtimeInputSourceKind: runtimeInputSource.sourceKind,
    runtimeInputSourceStatus: runtimeInputSource.status,
    generationInput,
    standardContract,
    actions: standardContract.actions,
    hits: standardContract.hits,
    deltas,
    runtimeInputSource,
    outputs: {
      generationInput,
      standardContract,
      actions: standardContract.actions,
      hits: standardContract.hits,
      deltas,
      runtimeInputSource,
    },
    outputNames: [
      'generationInput',
      'standardContract',
      'actions',
      'hits',
      'deltas',
      'runtimeInputSource',
    ],
    summary: {
      contractName: standardContract.name,
      actionCount: standardContract.summary?.actionCount ?? 0,
      hitCount: standardContract.summary?.hitCount ?? 0,
      deltaCount: standardContract.summary?.deltaCount ?? 0,
      appliedDeltaCount: standardContract.summary?.appliedDeltaCount ?? 0,
      candidateDeltaCount: standardContract.summary?.candidateDeltaCount ?? 0,
      sampledDeltaCount: standardContract.summary?.sampledDeltaCount ?? 0,
      placeholderDeltaCount:
        standardContract.summary?.placeholderDeltaCount ?? 0,
      runtimeDeltaPolicy: standardContract.runtimeDeltaPolicy,
      applied: false,
    },
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
  generationEntry,
  generationInput,
  runtimeInputSource,
  generationOutputs,
}) {
  return {
    contractName: standardContract.name,
    generationEntrySourceKind: actionHitThreeValueDeltaGeneration.sourceKind,
    generationEntryStatus: actionHitThreeValueDeltaGeneration.status,
    generationLayerStatus: threeValueGenerationLayer.status,
    generationLayerSourceKind: threeValueGenerationLayer.sourceKind,
    standardContractStatus: standardContract.status,
    standardContractSourceKind: standardContract.sourceKind,
    standardGenerationEntrySourceKind: generationEntry.sourceKind,
    standardGenerationEntryStatus: generationEntry.status,
    generationInputSourceKind: generationInput?.sourceKind ?? '',
    generationInputStatus: generationInput?.status ?? '',
    generationInputPointCount: generationInput?.summary?.pointCount ?? 0,
    runtimeInputSourceKind: runtimeInputSource.sourceKind,
    runtimeInputSourceStatus: runtimeInputSource.status,
    generationOutputsSourceKind: generationOutputs.sourceKind,
    generationOutputsStatus: generationOutputs.status,
    generationOutputsOutputCount: generationOutputs.outputSummary.outputCount,
    actionCount: standardContract.summary?.actionCount ?? 0,
    hitCount: standardContract.summary?.hitCount ?? 0,
    deltaCount: standardContract.summary?.deltaCount ?? 0,
    appliedDeltaCount: standardContract.summary?.appliedDeltaCount ?? 0,
    candidateDeltaCount: standardContract.summary?.candidateDeltaCount ?? 0,
    sampledDeltaCount: standardContract.summary?.sampledDeltaCount ?? 0,
    placeholderDeltaCount: standardContract.summary?.placeholderDeltaCount ?? 0,
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
