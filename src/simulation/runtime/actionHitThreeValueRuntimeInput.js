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
  const aggregateIndex =
    createActionHitThreeValueRuntimeAggregateIndex(standardContract);
  const appliedDeltas = inputDeltas
    .filter(delta => delta?.applied)
    .map((delta, index) =>
      normalizeRuntimeInputDelta(delta, index, aggregateIndex)
    );
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
    generationReadSources: resolvedSource.generationReadSources,
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
  const runtimeInputSourceReadSource =
    resolveRuntimeInputSourceReadSource({
      runtimeInputSource,
      generationOutputs,
    }) ??
    createGenerationReadSourceCandidate({
      key: 'runtimeInputSource',
      path: '',
      tier: 'missing',
      value: null,
    });
  const resolvedRuntimeInputSource = runtimeInputSourceReadSource.value;
  const generationLayer =
    actionHitThreeValueDeltaGeneration?.threeValueGenerationLayer ??
    threeValueGenerationLayer;
  const standardContractReadSource =
    resolveActionHitThreeValueDeltaStandardContractReadSource({
      generationOutputs,
      runtimeInputSource: resolvedRuntimeInputSource,
      runtimeInputSourceReadSource,
      actionHitThreeValueDeltaGeneration,
      threeValueGenerationLayer: generationLayer,
    });
  const standardContract = standardContractReadSource.value;
  const deltaReadSource = resolveRuntimeInputDeltaReadSource({
    generationOutputs,
    runtimeInputSource: resolvedRuntimeInputSource,
    runtimeInputSourceReadSource,
    standardContract,
  });
  const generationReadSources = createActionHitThreeValueGenerationReadSources({
    generationOutputs,
    runtimeInputSourceReadSource,
    standardContractReadSource,
    deltaReadSource,
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
    deltas: deltaReadSource.value ?? [],
    generationReadSources,
  };
}

function resolveRuntimeInputSourceReadSource({
  runtimeInputSource,
  generationOutputs,
} = {}) {
  return selectGenerationReadSourceCandidate([
    createGenerationReadSourceCandidate({
      key: 'runtimeInputSource',
      path: 'runtimeInputSource',
      tier: 'explicit-runtime-input-source',
      value: runtimeInputSource,
    }),
    createGenerationReadSourceCandidate({
      key: 'outputs.runtimeInputSource',
      path: 'generationOutputs.outputs.runtimeInputSource',
      tier: 'standard-output',
      value: generationOutputs?.outputs?.runtimeInputSource,
    }),
    createGenerationReadSourceCandidate({
      key: 'outputs.runtimeInput',
      path: 'generationOutputs.outputs.runtimeInput',
      tier: 'standard-output',
      value: generationOutputs?.outputs?.runtimeInput,
      aliasFor: 'runtimeInputSource',
    }),
    createGenerationReadSourceCandidate({
      key: 'runtimeInputSource',
      path: 'generationOutputs.runtimeInputSource',
      tier: 'generation-output-field',
      value: generationOutputs?.runtimeInputSource,
    }),
    createGenerationReadSourceCandidate({
      key: 'runtimeInput',
      path: 'generationOutputs.runtimeInput',
      tier: 'generation-output-field',
      value: generationOutputs?.runtimeInput,
      aliasFor: 'runtimeInputSource',
    }),
  ]);
}

function createFallbackActionHitThreeValueDeltaStandardContract(
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
    actions: threeValueGenerationLayer?.actions ?? [],
    hits: threeValueGenerationLayer?.hits ?? [],
    deltas: threeValueGenerationLayer?.deltas ?? [],
    summary: threeValueGenerationLayer?.summary ?? {},
    applied: false,
  };
}

function resolveActionHitThreeValueDeltaStandardContractReadSource({
  generationOutputs,
  runtimeInputSource,
  runtimeInputSourceReadSource,
  actionHitThreeValueDeltaGeneration,
  threeValueGenerationLayer,
} = {}) {
  const explicitRuntimeInputSource =
    runtimeInputSourceReadSource?.tier === 'explicit-runtime-input-source';
  const runtimeInputSourceContractCandidate =
    createGenerationReadSourceCandidate({
      key: `${runtimeInputSourceReadSource?.key ?? 'runtimeInputSource'}.standardContract`,
      path: joinGenerationReadSourcePath(
        runtimeInputSourceReadSource?.path,
        'standardContract'
      ),
      tier: explicitRuntimeInputSource
        ? 'explicit-runtime-input-source-field'
        : 'runtime-input-source-field',
      value: runtimeInputSource?.standardContract,
    });
  const selected = selectGenerationReadSourceCandidate([
    ...(explicitRuntimeInputSource
      ? [runtimeInputSourceContractCandidate]
      : []),
    createGenerationReadSourceCandidate({
      key: 'outputs.standardContract',
      path: 'generationOutputs.outputs.standardContract',
      tier: 'standard-output',
      value: generationOutputs?.outputs?.standardContract,
    }),
    createGenerationReadSourceCandidate({
      key: 'standardContract',
      path: 'generationOutputs.standardContract',
      tier: 'generation-output-field',
      value: generationOutputs?.standardContract,
    }),
    ...(!explicitRuntimeInputSource
      ? [runtimeInputSourceContractCandidate]
      : []),
    createGenerationReadSourceCandidate({
      key: 'actionHitThreeValueDeltaGeneration.standardContract',
      path: 'actionHitThreeValueDeltaGeneration.standardContract',
      tier: 'generation-entry-field',
      value: actionHitThreeValueDeltaGeneration?.standardContract,
    }),
    createGenerationReadSourceCandidate({
      key: 'threeValueGenerationLayer.standardContract',
      path: 'threeValueGenerationLayer.standardContract',
      tier: 'generation-layer-field',
      value: threeValueGenerationLayer?.standardContract,
    }),
  ]);

  if (selected) {
    return selected;
  }

  return createGenerationReadSourceCandidate({
    key: 'fallbackStandardContract',
    path: 'fallbackStandardContract',
    tier: 'fallback-standard-contract',
    value: createFallbackActionHitThreeValueDeltaStandardContract(
      threeValueGenerationLayer
    ),
  });
}

function resolveRuntimeInputDeltaReadSource({
  generationOutputs,
  runtimeInputSource,
  runtimeInputSourceReadSource,
  standardContract,
} = {}) {
  const explicitRuntimeInputSource =
    runtimeInputSourceReadSource?.tier === 'explicit-runtime-input-source';
  const runtimeInputSourceDeltaCandidate = createGenerationReadSourceCandidate({
    key: `${runtimeInputSourceReadSource?.key ?? 'runtimeInputSource'}.deltas`,
    path: joinGenerationReadSourcePath(
      runtimeInputSourceReadSource?.path,
      'deltas'
    ),
    tier: explicitRuntimeInputSource
      ? 'explicit-runtime-input-source-field'
      : 'runtime-input-source-field',
    value: runtimeInputSource?.deltas,
  });

  return (
    selectGenerationReadSourceCandidate([
      ...(explicitRuntimeInputSource ? [runtimeInputSourceDeltaCandidate] : []),
      createGenerationReadSourceCandidate({
        key: 'outputs.deltas',
        path: 'generationOutputs.outputs.deltas',
        tier: 'standard-output',
        value: generationOutputs?.outputs?.deltas,
      }),
      createGenerationReadSourceCandidate({
        key: 'deltas',
        path: 'generationOutputs.deltas',
        tier: 'generation-output-field',
        value: generationOutputs?.deltas,
      }),
      ...(!explicitRuntimeInputSource
        ? [runtimeInputSourceDeltaCandidate]
        : []),
      createGenerationReadSourceCandidate({
        key: 'standardContract.deltas',
        path: 'standardContract.deltas',
        tier: 'standard-contract-field',
        value: standardContract?.deltas,
      }),
    ]) ??
    createGenerationReadSourceCandidate({
      key: 'deltas',
      path: '',
      tier: 'missing',
      value: [],
    })
  );
}

function createActionHitThreeValueGenerationReadSources({
  generationOutputs,
  runtimeInputSourceReadSource,
  standardContractReadSource,
  deltaReadSource,
}) {
  const inputs = {
    runtimeInputSource: createGenerationReadSourceView(
      runtimeInputSourceReadSource,
      'runtimeInputSource'
    ),
    standardContract: createGenerationReadSourceView(
      standardContractReadSource,
      'standardContract'
    ),
    deltas: createGenerationReadSourceView(deltaReadSource, 'deltas'),
  };
  const inputNames = Object.keys(inputs);
  const standardOutputNames = inputNames.filter(
    inputName => inputs[inputName].standardOutputPresent
  );
  const fallbackInputNames = inputNames.filter(
    inputName => inputs[inputName].fallback
  );

  return {
    schemaVersion: 1,
    sourceKind:
      'azpr-action-hit-three-value-runtime-input-generation-read-sources',
    status: generationOutputs
      ? 'runtime-input-generation-read-sources-ready'
      : 'runtime-input-generation-read-sources-legacy',
    generationOutputsSourceKind: generationOutputs?.sourceKind ?? '',
    generationOutputsStatus: generationOutputs?.status ?? '',
    inputs,
    standardOutputNames,
    fallbackInputNames,
    standardOutputCount: standardOutputNames.length,
    fallbackInputCount: fallbackInputNames.length,
    usesLegacyGenerationFallback: inputNames.some(
      inputName => inputs[inputName].legacyGenerationFallback
    ),
  };
}

function createGenerationReadSourceView(candidate, inputName) {
  const sourceTier = candidate?.tier ?? 'missing';
  return {
    inputName,
    sourceKey: candidate?.key ?? inputName,
    sourcePath: candidate?.path ?? '',
    sourceTier,
    aliasFor: candidate?.aliasFor ?? '',
    present: Boolean(candidate?.present),
    fallback:
      Boolean(candidate?.present) &&
      ![
        'standard-output',
        'explicit-runtime-input-source',
        'explicit-runtime-input-source-field',
      ].includes(sourceTier),
    standardOutputPresent:
      Boolean(candidate?.present) && sourceTier === 'standard-output',
    legacyGenerationFallback:
      Boolean(candidate?.present) &&
      [
        'generation-output-field',
        'runtime-input-source-field',
        'generation-entry-field',
        'generation-layer-field',
        'fallback-standard-contract',
        'standard-contract-field',
      ].includes(sourceTier),
  };
}

function createGenerationReadSourceCandidate({
  key,
  path,
  tier,
  value,
  aliasFor = '',
}) {
  return {
    key,
    path,
    tier,
    value,
    aliasFor,
    present: hasGenerationReadSourceValue(value),
  };
}

function selectGenerationReadSourceCandidate(candidates) {
  return candidates.find(candidate => candidate.present) ?? null;
}

function joinGenerationReadSourcePath(sourcePath, fieldPath) {
  return sourcePath && fieldPath ? `${sourcePath}.${fieldPath}` : '';
}

function hasGenerationReadSourceValue(value) {
  if (Array.isArray(value)) {
    return true;
  }
  return value !== null && value !== undefined;
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

function normalizeRuntimeInputDelta(
  delta,
  runtimeSequenceIndex,
  aggregateIndex
) {
  return {
    ...delta,
    runtimeSequenceIndex,
    delta: normalizeRuntimeInputNumber(delta.delta),
    hpDelta: normalizeRuntimeInputNumber(delta.hpDelta),
    toughnessDelta: normalizeRuntimeInputNumber(delta.toughnessDelta),
    energyDelta: normalizeRuntimeInputNumber(delta.energyDelta),
    actionThreeValueDeltaAggregate:
      aggregateIndex.actionAggregates.get(createAggregateActionKey(delta)) ??
      null,
    hitThreeValueDeltaAggregate:
      aggregateIndex.hitAggregates.get(createAggregateHitKey(delta)) ?? null,
    applied: true,
  };
}

function createActionHitThreeValueRuntimeAggregateIndex(standardContract) {
  return {
    actionAggregates: new Map(
      (standardContract?.actions ?? [])
        .filter(action => action?.threeValueDeltaAggregate)
        .map(action => [
          createAggregateActionKey(action),
          action.threeValueDeltaAggregate,
        ])
    ),
    hitAggregates: new Map(
      (standardContract?.hits ?? [])
        .filter(hit => hit?.threeValueDeltaAggregate)
        .map(hit => [createAggregateHitKey(hit), hit.threeValueDeltaAggregate])
    ),
  };
}

function createAggregateActionKey(item) {
  return createAggregateIdPart(item?.actionId ?? 'system');
}

function createAggregateHitKey(item) {
  return [
    item?.actionId ?? 'system',
    item?.hitKey,
    item?.frameIndex,
    item?.timeMs,
  ]
    .map(createAggregateIdPart)
    .join('|');
}

function createAggregateIdPart(value) {
  return String(value ?? 'none').replace(/\|/g, '/');
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
