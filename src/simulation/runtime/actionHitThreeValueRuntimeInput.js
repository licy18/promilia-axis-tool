import {
  ACTION_HIT_THREE_VALUE_DELTA_CONTRACT_NAME,
  compareThreeValueGenerationDeltas,
} from '../generation/threeValueGenerationLayer';

export const ACTION_HIT_THREE_VALUE_RUNTIME_INPUT_SOURCE =
  'threeValueRuntimeInput.appliedDeltas';

export function createActionHitThreeValueRuntimeInput({
  generationOutputs,
  runtimeInputSource,
  actionHitThreeValueDeltaGeneration,
  threeValueGenerationLayer,
} = {}) {
  const resolvedSource = resolveActionHitThreeValueRuntimeInputSource({
    generationOutputs,
    runtimeInputSource,
    actionHitThreeValueDeltaGeneration,
    threeValueGenerationLayer,
  });
  const standardContract = resolvedSource.standardContract;
  const inputDeltas = [...(resolvedSource.deltas ?? [])].sort(
    compareThreeValueGenerationDeltas
  );
  const appliedDeltas = inputDeltas
    .filter(delta => delta?.applied)
    .map((delta, index) => normalizeRuntimeInputDelta(delta, index));
  const ignoredDeltas = inputDeltas.filter(delta => !delta?.applied);
  const contractName =
    standardContract?.name ??
    standardContract?.summary?.contractName ??
    ACTION_HIT_THREE_VALUE_DELTA_CONTRACT_NAME;
  const summary = summarizeActionHitThreeValueRuntimeInput({
    contractName,
    resolvedSource,
    standardContract,
    inputDeltas,
    appliedDeltas,
    ignoredDeltas,
  });

  return {
    schemaVersion: 1,
    sourceKind: createRuntimeInputSourceKind(resolvedSource),
    status:
      appliedDeltas.length > 0
        ? 'runtime-input-ready-with-applied-deltas'
        : 'runtime-input-ready-no-applied-deltas',
    contractName,
    appliedDeltaSource: ACTION_HIT_THREE_VALUE_RUNTIME_INPUT_SOURCE,
    inputSourceKind:
      standardContract?.sourceKind ??
      'azpr-action-hit-three-value-delta-standard-contract',
    inputStatus: standardContract?.status ?? null,
    runtimeInputSourceKind: resolvedSource.runtimeInputSourceKind,
    runtimeInputSourceStatus: resolvedSource.runtimeInputSourceStatus,
    generationOutputsSourceKind: resolvedSource.generationOutputsSourceKind,
    generationOutputsStatus: resolvedSource.generationOutputsStatus,
    generationEntrySourceKind: resolvedSource.generationEntrySourceKind,
    generationEntryStatus: resolvedSource.generationEntryStatus,
    generationLayerSourceKind: resolvedSource.generationLayerSourceKind,
    generationLayerStatus: resolvedSource.generationLayerStatus,
    standardContractSourceKind: standardContract?.sourceKind ?? null,
    standardContractStatus: standardContract?.status ?? null,
    appliedOnly: true,
    deltas: appliedDeltas,
    appliedDeltas,
    ignoredDeltaCount: ignoredDeltas.length,
    summary,
    applied: true,
  };
}

function resolveActionHitThreeValueRuntimeInputSource({
  generationOutputs,
  runtimeInputSource,
  actionHitThreeValueDeltaGeneration,
  threeValueGenerationLayer,
}) {
  const generationOutputRuntimeInputSource =
    generationOutputs?.runtimeInputSource ??
    generationOutputs?.runtimeInput ??
    generationOutputs?.outputs?.runtimeInputSource ??
    generationOutputs?.outputs?.runtimeInput ??
    null;
  const resolvedRuntimeInputSource =
    runtimeInputSource ?? generationOutputRuntimeInputSource;
  const generationLayer =
    actionHitThreeValueDeltaGeneration?.threeValueGenerationLayer ??
    threeValueGenerationLayer;
  const standardContract = resolveActionHitThreeValueDeltaStandardContract({
    generationOutputs,
    runtimeInputSource: resolvedRuntimeInputSource,
    actionHitThreeValueDeltaGeneration,
    threeValueGenerationLayer: generationLayer,
  });

  return {
    runtimeInputSourceKind: resolvedRuntimeInputSource?.sourceKind ?? null,
    runtimeInputSourceStatus: resolvedRuntimeInputSource?.status ?? null,
    generationOutputsSourceKind: generationOutputs?.sourceKind ?? null,
    generationOutputsStatus: generationOutputs?.status ?? null,
    generationEntrySourceKind:
      resolvedRuntimeInputSource?.generationEntrySourceKind ??
      actionHitThreeValueDeltaGeneration?.sourceKind ??
      null,
    generationEntryStatus:
      resolvedRuntimeInputSource?.generationEntryStatus ??
      actionHitThreeValueDeltaGeneration?.status ??
      null,
    generationLayerSourceKind:
      resolvedRuntimeInputSource?.generationLayerSourceKind ??
      actionHitThreeValueDeltaGeneration?.summary?.generationLayerSourceKind ??
      generationLayer?.sourceKind ??
      'azpr-standard-three-value-generation-layer',
    generationLayerStatus:
      resolvedRuntimeInputSource?.generationLayerStatus ??
      actionHitThreeValueDeltaGeneration?.summary?.generationLayerStatus ??
      generationLayer?.status ??
      null,
    standardContract,
    deltas:
      resolvedRuntimeInputSource?.deltas ??
      generationOutputs?.deltas ??
      generationOutputs?.outputs?.deltas ??
      standardContract?.deltas ??
      [],
  };
}

function resolveActionHitThreeValueDeltaStandardContract({
  generationOutputs,
  runtimeInputSource,
  actionHitThreeValueDeltaGeneration,
  threeValueGenerationLayer,
} = {}) {
  if (runtimeInputSource?.standardContract) {
    return runtimeInputSource.standardContract;
  }

  if (generationOutputs?.standardContract) {
    return generationOutputs.standardContract;
  }

  if (generationOutputs?.outputs?.standardContract) {
    return generationOutputs.outputs.standardContract;
  }

  if (actionHitThreeValueDeltaGeneration?.standardContract) {
    return actionHitThreeValueDeltaGeneration.standardContract;
  }

  if (threeValueGenerationLayer?.standardContract) {
    return threeValueGenerationLayer.standardContract;
  }

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
    actions: threeValueGenerationLayer?.actions ?? [],
    hits: threeValueGenerationLayer?.hits ?? [],
    deltas: threeValueGenerationLayer?.deltas ?? [],
    summary: threeValueGenerationLayer?.summary ?? {},
    applied: false,
  };
}

function createRuntimeInputSourceKind(resolvedSource) {
  if (resolvedSource.runtimeInputSourceKind) {
    return 'azpr-runtime-input-from-generation-builder-source';
  }
  if (resolvedSource.generationEntrySourceKind) {
    return 'azpr-runtime-input-from-action-hit-three-value-delta-generation';
  }
  return 'azpr-runtime-input-from-three-value-generation-layer';
}

function normalizeRuntimeInputDelta(delta, runtimeSequenceIndex) {
  return {
    ...delta,
    runtimeSequenceIndex,
    delta: normalizeRuntimeInputNumber(delta.delta),
    hpDelta: normalizeRuntimeInputNumber(delta.hpDelta),
    toughnessDelta: normalizeRuntimeInputNumber(delta.toughnessDelta),
    energyDelta: normalizeRuntimeInputNumber(delta.energyDelta),
    applied: true,
  };
}

function summarizeActionHitThreeValueRuntimeInput({
  contractName,
  resolvedSource,
  standardContract,
  inputDeltas,
  appliedDeltas,
  ignoredDeltas,
}) {
  const ignoredLayerCounts = countByKey(
    ignoredDeltas,
    delta => delta?.layerKey ?? 'unknown'
  );
  return {
    contractName,
    appliedDeltaSource: ACTION_HIT_THREE_VALUE_RUNTIME_INPUT_SOURCE,
    runtimeInputSourceKind: resolvedSource.runtimeInputSourceKind,
    runtimeInputSourceStatus: resolvedSource.runtimeInputSourceStatus,
    generationOutputsSourceKind: resolvedSource.generationOutputsSourceKind,
    generationOutputsStatus: resolvedSource.generationOutputsStatus,
    generationEntrySourceKind: resolvedSource.generationEntrySourceKind,
    generationEntryStatus: resolvedSource.generationEntryStatus,
    generationLayerSourceKind: resolvedSource.generationLayerSourceKind,
    generationLayerStatus: resolvedSource.generationLayerStatus,
    standardContractSourceKind: standardContract?.sourceKind ?? null,
    standardContractStatus: standardContract?.status ?? null,
    standardContractActionCount: standardContract?.summary?.actionCount ?? null,
    standardContractHitCount: standardContract?.summary?.hitCount ?? null,
    inputDeltaCount: inputDeltas.length,
    appliedDeltaCount: appliedDeltas.length,
    ignoredDeltaCount: ignoredDeltas.length,
    appliedTrackKeys: uniqueStrings(appliedDeltas.map(delta => delta.trackKey)),
    appliedLayerKeys: uniqueStrings(appliedDeltas.map(delta => delta.layerKey)),
    ignoredLayerCounts,
    appliedOnly: true,
    applied: true,
  };
}

function countByKey(items, getKey) {
  const counts = new Map();
  for (const item of items) {
    const key = String(getKey(item) ?? 'unknown');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function uniqueStrings(values) {
  return [
    ...new Set(
      values
        .filter(value => value != null && String(value).trim() !== '')
        .map(value => String(value))
    ),
  ].sort();
}

function normalizeRuntimeInputNumber(value) {
  if (value == null || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(6)) : null;
}
