import {
  ACTION_HIT_THREE_VALUE_DELTA_CONTRACT_NAME,
  compareThreeValueGenerationDeltas,
} from '../generation/threeValueGenerationLayer';
import {
  THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_NAME,
  THREE_VALUE_MECHANICS_OPERANDS_CONTRACT_NAME,
} from '../mechanics/threeValueMechanicsAdapter';

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
    status: createRuntimeInputStatus({ resolvedSource, appliedDeltas }),
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
    generationOutputBoundary: resolvedSource.generationOutputBoundary,
    generationOutputBoundarySourceKind:
      resolvedSource.generationOutputBoundarySourceKind,
    generationOutputBoundaryStatus:
      resolvedSource.generationOutputBoundaryStatus,
    generationOutputBoundaryReady: resolvedSource.generationOutputBoundaryReady,
    generationOutputBoundaryPath: resolvedSource.generationOutputBoundaryPath,
    generationOutputBoundaryEntryPath:
      resolvedSource.generationOutputBoundaryEntryPath,
    generationOutputBoundaryRuntimeInputSourcePath:
      resolvedSource.generationOutputBoundaryRuntimeInputSourcePath,
    generationOutputBoundaryStandardContractPath:
      resolvedSource.generationOutputBoundaryStandardContractPath,
    generationOutputBoundaryDeltasPath:
      resolvedSource.generationOutputBoundaryDeltasPath,
    generationOutputBoundaryValueSourceSlotsPath:
      resolvedSource.generationOutputBoundaryValueSourceSlotsPath,
    generationOutputBoundaryContractValidationPath:
      resolvedSource.generationOutputBoundaryContractValidationPath,
    generationOutputBoundaryStandardOutputCount:
      resolvedSource.generationOutputBoundaryStandardOutputCount,
    generationOutputBoundaryIssueCount:
      resolvedSource.generationOutputBoundaryIssueCount,
    generationEntrySourceKind: resolvedSource.generationEntrySourceKind,
    generationEntryStatus: resolvedSource.generationEntryStatus,
    standardGenerationEntrySourceKind:
      resolvedSource.standardGenerationEntrySourceKind,
    standardGenerationEntryStatus: resolvedSource.standardGenerationEntryStatus,
    generationEntryContractValidation:
      resolvedSource.generationEntryContractValidation,
    generationEntryContractValidationSourceKind:
      resolvedSource.generationEntryContractValidationSourceKind,
    generationEntryContractValidationStatus:
      resolvedSource.generationEntryContractValidationStatus,
    generationEntryContractValidationIssueCount:
      resolvedSource.generationEntryContractValidationIssueCount,
    generationEntryContractValidationValid:
      resolvedSource.generationEntryContractValidationValid,
    generationEntryAggregateValidation:
      resolvedSource.generationEntryAggregateValidation,
    generationEntryAggregateValidationSourceKind:
      resolvedSource.generationEntryAggregateValidationSourceKind,
    generationEntryAggregateValidationStatus:
      resolvedSource.generationEntryAggregateValidationStatus,
    generationEntryAggregateValidationIssueCount:
      resolvedSource.generationEntryAggregateValidationIssueCount,
    generationEntryAggregateValidationValid:
      resolvedSource.generationEntryAggregateValidationValid,
    generationLayerSourceKind: resolvedSource.generationLayerSourceKind,
    generationLayerStatus: resolvedSource.generationLayerStatus,
    standardContractSourceKind: standardContract?.sourceKind ?? null,
    standardContractStatus: standardContract?.status ?? null,
    appliedOnly: true,
    deltas: appliedDeltas,
    appliedDeltas,
    valueSourceSlots: resolvedSource.valueSourceSlots ?? [],
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
  const generationEntryReadSource = resolveGenerationEntryReadSource({
    generationOutputs,
    actionHitThreeValueDeltaGeneration,
  });
  const standardGenerationEntry = generationEntryReadSource?.value ?? null;
  const generationOutputBoundaryReadSource =
    resolveGenerationOutputBoundaryReadSource({
      generationOutputs,
    });
  const generationOutputBoundary =
    generationOutputBoundaryReadSource?.value ?? null;
  const generationEntryContractValidationReadSource =
    resolveGenerationEntryContractValidationReadSource({
      generationEntry: standardGenerationEntry,
      generationEntryReadSource,
    });
  const generationEntryContractValidation =
    generationEntryContractValidationReadSource?.value ?? null;
  const generationEntryAggregateValidation =
    generationEntryContractValidation?.aggregateValidation ?? null;
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
  const valueSourceSlotReadSource =
    resolveRuntimeInputValueSourceSlotReadSource({
      generationOutputs,
      runtimeInputSource: resolvedRuntimeInputSource,
      runtimeInputSourceReadSource,
      standardContract,
    });
  const generationReadSources = createActionHitThreeValueGenerationReadSources({
    generationOutputs,
    generationEntryReadSource,
    runtimeInputSourceReadSource,
    standardContractReadSource,
    deltaReadSource,
    valueSourceSlotReadSource,
    generationOutputBoundaryReadSource,
    generationOutputBoundary,
    generationEntryContractValidationReadSource,
    generationEntryContractValidation,
    generationEntryAggregateValidation,
  });

  return {
    runtimeInputSourceKind: resolvedRuntimeInputSource?.sourceKind ?? null,
    runtimeInputSourceStatus: resolvedRuntimeInputSource?.status ?? null,
    generationOutputsSourceKind: generationOutputs?.sourceKind ?? null,
    generationOutputsStatus: generationOutputs?.status ?? null,
    generationOutputBoundary,
    generationOutputBoundarySourceKind:
      generationOutputBoundary?.sourceKind ?? null,
    generationOutputBoundaryStatus: generationOutputBoundary?.status ?? null,
    generationOutputBoundaryReady: generationOutputBoundary?.ready === true,
    generationOutputBoundaryPath:
      generationOutputBoundaryReadSource?.path ?? '',
    generationOutputBoundaryEntryPath:
      generationOutputBoundary?.entryPath ?? '',
    generationOutputBoundaryRuntimeInputSourcePath:
      generationOutputBoundary?.runtimeInputSourcePath ?? '',
    generationOutputBoundaryStandardContractPath:
      generationOutputBoundary?.standardContractPath ?? '',
    generationOutputBoundaryDeltasPath:
      generationOutputBoundary?.deltasPath ?? '',
    generationOutputBoundaryValueSourceSlotsPath:
      generationOutputBoundary?.valueSourceSlotsPath ?? '',
    generationOutputBoundaryContractValidationPath:
      generationOutputBoundary?.contractValidationPath ?? '',
    generationOutputBoundaryStandardOutputCount: numberOrNull(
      generationOutputBoundary?.standardOutputCount
    ),
    generationOutputBoundaryIssueCount: numberOrNull(
      generationOutputBoundary?.issueCount
    ),
    standardGenerationEntrySourceKind:
      standardGenerationEntry?.sourceKind ?? null,
    standardGenerationEntryStatus: standardGenerationEntry?.status ?? null,
    generationEntryContractValidation,
    generationEntryContractValidationSourceKind:
      generationEntryContractValidation?.sourceKind ?? null,
    generationEntryContractValidationStatus:
      generationEntryContractValidation?.status ?? null,
    generationEntryContractValidationIssueCount: numberOrNull(
      generationEntryContractValidation?.issueCount
    ),
    generationEntryContractValidationValid:
      generationEntryContractValidation?.valid === true,
    generationEntryAggregateValidation,
    generationEntryAggregateValidationSourceKind:
      generationEntryAggregateValidation?.sourceKind ?? null,
    generationEntryAggregateValidationStatus:
      generationEntryAggregateValidation?.status ?? null,
    generationEntryAggregateValidationIssueCount: numberOrNull(
      generationEntryAggregateValidation?.issueCount
    ),
    generationEntryAggregateValidationValid:
      generationEntryAggregateValidation?.valid === true,
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
    valueSourceSlots: valueSourceSlotReadSource.value ?? [],
    generationReadSources,
  };
}

function resolveGenerationEntryReadSource({
  generationOutputs,
  actionHitThreeValueDeltaGeneration,
} = {}) {
  return selectGenerationReadSourceCandidate([
    createGenerationReadSourceCandidate({
      key: 'outputs.generationEntry',
      path: 'generationOutputs.outputs.generationEntry',
      tier: 'standard-output',
      value: generationOutputs?.outputs?.generationEntry,
      containerKey: 'generationEntry',
    }),
    createGenerationReadSourceCandidate({
      key: 'generationEntry',
      path: 'generationOutputs.generationEntry',
      tier: 'generation-output-field',
      value: generationOutputs?.generationEntry,
      containerKey: 'generationEntry',
    }),
    createGenerationReadSourceCandidate({
      key: 'actionHitThreeValueDeltaGeneration',
      path: 'actionHitThreeValueDeltaGeneration',
      tier: 'generation-entry-field',
      value: actionHitThreeValueDeltaGeneration,
    }),
  ]);
}

function resolveGenerationOutputBoundaryReadSource({ generationOutputs } = {}) {
  return selectGenerationReadSourceCandidate([
    createGenerationReadSourceCandidate({
      key: 'standardOutputBoundary',
      path: 'generationOutputs.standardOutputBoundary',
      tier: 'generation-output-boundary',
      value: generationOutputs?.standardOutputBoundary,
    }),
    createGenerationReadSourceCandidate({
      key: 'outputBoundary',
      path: 'generationOutputs.outputBoundary',
      tier: 'generation-output-boundary-alias',
      value: generationOutputs?.outputBoundary,
      aliasFor: 'standardOutputBoundary',
    }),
  ]);
}

function resolveGenerationEntryContractValidationReadSource({
  generationEntry,
  generationEntryReadSource,
} = {}) {
  if (!generationEntryReadSource?.present) {
    return createGenerationReadSourceCandidate({
      key: 'generationEntry.contractValidation',
      path: '',
      tier: 'missing',
      value: null,
    });
  }

  return createGenerationReadSourceCandidate({
    key: `${generationEntryReadSource.key}.contractValidation`,
    path: joinGenerationReadSourcePath(
      generationEntryReadSource.path,
      'contractValidation'
    ),
    tier: generationEntryReadSource.tier,
    value: generationEntry?.contractValidation,
    containerKey: generationEntryReadSource.containerKey,
  });
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
      key: 'outputs.generationEntry.runtimeInputSource',
      path: 'generationOutputs.outputs.generationEntry.runtimeInputSource',
      tier: 'standard-output',
      value: generationOutputs?.outputs?.generationEntry?.runtimeInputSource,
      containerKey: 'generationEntry',
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
    valueSourceSlots:
      threeValueGenerationLayer?.valueSourceSlots ??
      threeValueGenerationLayer?.standardContract?.valueSourceSlots ??
      [],
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
      key: 'outputs.generationEntry.standardContract',
      path: 'generationOutputs.outputs.generationEntry.standardContract',
      tier: 'standard-output',
      value: generationOutputs?.outputs?.generationEntry?.standardContract,
      containerKey: 'generationEntry',
    }),
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
        key: 'outputs.generationEntry.deltas',
        path: 'generationOutputs.outputs.generationEntry.deltas',
        tier: 'standard-output',
        value: generationOutputs?.outputs?.generationEntry?.deltas,
        containerKey: 'generationEntry',
      }),
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

function resolveRuntimeInputValueSourceSlotReadSource({
  generationOutputs,
  runtimeInputSource,
  runtimeInputSourceReadSource,
  standardContract,
} = {}) {
  const explicitRuntimeInputSource =
    runtimeInputSourceReadSource?.tier === 'explicit-runtime-input-source';
  const runtimeInputSourceValueSourceSlotCandidate =
    createGenerationReadSourceCandidate({
      key: `${runtimeInputSourceReadSource?.key ?? 'runtimeInputSource'}.valueSourceSlots`,
      path: joinGenerationReadSourcePath(
        runtimeInputSourceReadSource?.path,
        'valueSourceSlots'
      ),
      tier: explicitRuntimeInputSource
        ? 'explicit-runtime-input-source-field'
        : 'runtime-input-source-field',
      value: runtimeInputSource?.valueSourceSlots,
    });

  return (
    selectGenerationReadSourceCandidate([
      ...(explicitRuntimeInputSource
        ? [runtimeInputSourceValueSourceSlotCandidate]
        : []),
      createGenerationReadSourceCandidate({
        key: 'outputs.generationEntry.valueSourceSlots',
        path: 'generationOutputs.outputs.generationEntry.valueSourceSlots',
        tier: 'standard-output',
        value: generationOutputs?.outputs?.generationEntry?.valueSourceSlots,
        containerKey: 'generationEntry',
      }),
      createGenerationReadSourceCandidate({
        key: 'outputs.valueSourceSlots',
        path: 'generationOutputs.outputs.valueSourceSlots',
        tier: 'standard-output',
        value: generationOutputs?.outputs?.valueSourceSlots,
      }),
      createGenerationReadSourceCandidate({
        key: 'valueSourceSlots',
        path: 'generationOutputs.valueSourceSlots',
        tier: 'generation-output-field',
        value: generationOutputs?.valueSourceSlots,
      }),
      ...(!explicitRuntimeInputSource
        ? [runtimeInputSourceValueSourceSlotCandidate]
        : []),
      createGenerationReadSourceCandidate({
        key: 'standardContract.valueSourceSlots',
        path: 'standardContract.valueSourceSlots',
        tier: 'standard-contract-field',
        value: standardContract?.valueSourceSlots,
      }),
    ]) ??
    createGenerationReadSourceCandidate({
      key: 'valueSourceSlots',
      path: '',
      tier: 'missing',
      value: [],
    })
  );
}

function createActionHitThreeValueGenerationReadSources({
  generationOutputs,
  generationEntryReadSource,
  runtimeInputSourceReadSource,
  standardContractReadSource,
  deltaReadSource,
  valueSourceSlotReadSource,
  generationOutputBoundaryReadSource,
  generationOutputBoundary,
  generationEntryContractValidationReadSource,
  generationEntryContractValidation,
  generationEntryAggregateValidation,
}) {
  const inputs = {
    generationEntry: createGenerationReadSourceView(
      generationEntryReadSource,
      'generationEntry'
    ),
    runtimeInputSource: createGenerationReadSourceView(
      runtimeInputSourceReadSource,
      'runtimeInputSource'
    ),
    standardContract: createGenerationReadSourceView(
      standardContractReadSource,
      'standardContract'
    ),
    deltas: createGenerationReadSourceView(deltaReadSource, 'deltas'),
    valueSourceSlots: createGenerationReadSourceView(
      valueSourceSlotReadSource,
      'valueSourceSlots'
    ),
    contractValidation: createGenerationReadSourceView(
      generationEntryContractValidationReadSource,
      'contractValidation'
    ),
  };
  const inputNames = Object.keys(inputs);
  const optionalInputNames = ['valueSourceSlots'];
  const requiredInputNames = inputNames.filter(
    inputName => !optionalInputNames.includes(inputName)
  );
  const standardOutputNames = inputNames.filter(
    inputName => inputs[inputName].standardOutputPresent
  );
  const fallbackInputNames = requiredInputNames.filter(
    inputName => inputs[inputName].fallback
  );
  const generationEntryContractValidationValid =
    generationEntryContractValidation?.valid === true;
  const generationEntryAggregateValidationValid =
    generationEntryAggregateValidation?.valid === true;
  const generationOutputBoundaryReady = generationOutputBoundary
    ? generationOutputBoundary.ready === true
    : true;
  const usesLegacyGenerationFallback = inputNames.some(
    inputName =>
      !optionalInputNames.includes(inputName) &&
      inputs[inputName].legacyGenerationFallback
  );
  const standardGenerationBoundaryReady =
    generationEntryContractValidationValid &&
    requiredInputNames.every(
      inputName => inputs[inputName].standardOutputPresent
    ) &&
    generationOutputBoundaryReady &&
    !usesLegacyGenerationFallback;
  const standardGenerationAggregateBoundaryReady =
    standardGenerationBoundaryReady && generationEntryAggregateValidationValid;

  return {
    schemaVersion: 1,
    sourceKind:
      'azpr-action-hit-three-value-runtime-input-generation-read-sources',
    status: generationOutputs
      ? 'runtime-input-generation-read-sources-ready'
      : 'runtime-input-generation-read-sources-legacy',
    generationOutputsSourceKind: generationOutputs?.sourceKind ?? '',
    generationOutputsStatus: generationOutputs?.status ?? '',
    generationOutputBoundaryStatus: generationOutputBoundary?.status ?? '',
    generationOutputBoundaryReady: generationOutputBoundary?.ready === true,
    generationOutputBoundaryReadyState:
      generationOutputBoundary?.ready === true ? 'true' : 'false',
    generationOutputBoundaryPath:
      generationOutputBoundaryReadSource?.path ?? '',
    generationOutputBoundaryEntryPath:
      generationOutputBoundary?.entryPath ?? '',
    generationOutputBoundaryRuntimeInputSourcePath:
      generationOutputBoundary?.runtimeInputSourcePath ?? '',
    generationOutputBoundaryStandardContractPath:
      generationOutputBoundary?.standardContractPath ?? '',
    generationOutputBoundaryDeltasPath:
      generationOutputBoundary?.deltasPath ?? '',
    generationOutputBoundaryValueSourceSlotsPath:
      generationOutputBoundary?.valueSourceSlotsPath ?? '',
    generationOutputBoundaryContractValidationPath:
      generationOutputBoundary?.contractValidationPath ?? '',
    generationOutputBoundaryStandardOutputCount: numberOrZero(
      generationOutputBoundary?.standardOutputCount
    ),
    generationOutputBoundaryIssueCount: numberOrZero(
      generationOutputBoundary?.issueCount
    ),
    inputs,
    standardOutputNames,
    fallbackInputNames,
    standardOutputCount: standardOutputNames.length,
    fallbackInputCount: fallbackInputNames.length,
    generationEntryContractValidationStatus:
      generationEntryContractValidation?.status ?? '',
    generationEntryContractValidationIssueCount: numberOrZero(
      generationEntryContractValidation?.issueCount
    ),
    generationEntryContractValidationValid,
    generationEntryContractValidationValidState:
      generationEntryContractValidationValid ? 'true' : 'false',
    generationEntryAggregateValidationStatus:
      generationEntryAggregateValidation?.status ?? '',
    generationEntryAggregateValidationIssueCount: numberOrZero(
      generationEntryAggregateValidation?.issueCount
    ),
    generationEntryAggregateValidationValid,
    generationEntryAggregateValidationValidState:
      generationEntryAggregateValidationValid ? 'true' : 'false',
    standardGenerationBoundaryReady,
    standardGenerationBoundaryReadyState: standardGenerationBoundaryReady
      ? 'true'
      : 'false',
    standardGenerationAggregateBoundaryReady,
    standardGenerationAggregateBoundaryReadyState:
      standardGenerationAggregateBoundaryReady ? 'true' : 'false',
    usesLegacyGenerationFallback,
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
    containerKey: candidate?.containerKey ?? '',
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
  containerKey = '',
}) {
  return {
    key,
    path,
    tier,
    value,
    aliasFor,
    containerKey,
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

function createRuntimeInputStatus({ resolvedSource, appliedDeltas }) {
  if (
    resolvedSource.generationEntryContractValidation &&
    !resolvedSource.generationEntryContractValidationValid
  ) {
    return 'runtime-input-invalid-generation-entry-contract';
  }
  if (
    resolvedSource.generationEntryAggregateValidation &&
    !resolvedSource.generationEntryAggregateValidationValid
  ) {
    return 'runtime-input-invalid-generation-entry-aggregate';
  }
  return appliedDeltas.length > 0
    ? 'runtime-input-ready-with-applied-deltas'
    : 'runtime-input-ready-no-applied-deltas';
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
  const valueSourceSlotSummary =
    summarizeRuntimeInputValueSourceSlots(resolvedSource);
  return {
    contractName,
    appliedDeltaSource: ACTION_HIT_THREE_VALUE_RUNTIME_INPUT_SOURCE,
    runtimeInputSourceKind: resolvedSource.runtimeInputSourceKind,
    runtimeInputSourceStatus: resolvedSource.runtimeInputSourceStatus,
    generationOutputsSourceKind: resolvedSource.generationOutputsSourceKind,
    generationOutputsStatus: resolvedSource.generationOutputsStatus,
    generationEntrySourceKind: resolvedSource.generationEntrySourceKind,
    generationEntryStatus: resolvedSource.generationEntryStatus,
    standardGenerationEntrySourceKind:
      resolvedSource.standardGenerationEntrySourceKind,
    standardGenerationEntryStatus: resolvedSource.standardGenerationEntryStatus,
    generationEntryContractValidationSourceKind:
      resolvedSource.generationEntryContractValidationSourceKind,
    generationEntryContractValidationStatus:
      resolvedSource.generationEntryContractValidationStatus,
    generationEntryContractValidationIssueCount:
      resolvedSource.generationEntryContractValidationIssueCount,
    generationEntryContractValidationValid:
      resolvedSource.generationEntryContractValidationValid,
    generationEntryAggregateValidationSourceKind:
      resolvedSource.generationEntryAggregateValidationSourceKind,
    generationEntryAggregateValidationStatus:
      resolvedSource.generationEntryAggregateValidationStatus,
    generationEntryAggregateValidationIssueCount:
      resolvedSource.generationEntryAggregateValidationIssueCount,
    generationEntryAggregateValidationValid:
      resolvedSource.generationEntryAggregateValidationValid,
    generationLayerSourceKind: resolvedSource.generationLayerSourceKind,
    generationLayerStatus: resolvedSource.generationLayerStatus,
    standardContractSourceKind: standardContract?.sourceKind ?? null,
    standardContractStatus: standardContract?.status ?? null,
    standardContractActionCount: standardContract?.summary?.actionCount ?? null,
    standardContractHitCount: standardContract?.summary?.hitCount ?? null,
    standardContractValueSourceSlotCount:
      standardContract?.summary?.valueSourceSlotCount ?? null,
    generationOutputBoundarySourceKind:
      resolvedSource.generationOutputBoundarySourceKind,
    generationOutputBoundaryStatus:
      resolvedSource.generationOutputBoundaryStatus,
    generationOutputBoundaryReady: resolvedSource.generationOutputBoundaryReady,
    generationOutputBoundaryPath: resolvedSource.generationOutputBoundaryPath,
    generationOutputBoundaryEntryPath:
      resolvedSource.generationOutputBoundaryEntryPath,
    generationOutputBoundaryRuntimeInputSourcePath:
      resolvedSource.generationOutputBoundaryRuntimeInputSourcePath,
    generationOutputBoundaryStandardContractPath:
      resolvedSource.generationOutputBoundaryStandardContractPath,
    generationOutputBoundaryDeltasPath:
      resolvedSource.generationOutputBoundaryDeltasPath,
    generationOutputBoundaryValueSourceSlotsPath:
      resolvedSource.generationOutputBoundaryValueSourceSlotsPath,
    generationOutputBoundaryContractValidationPath:
      resolvedSource.generationOutputBoundaryContractValidationPath,
    generationOutputBoundaryStandardOutputCount:
      resolvedSource.generationOutputBoundaryStandardOutputCount,
    generationOutputBoundaryIssueCount:
      resolvedSource.generationOutputBoundaryIssueCount,
    ...valueSourceSlotSummary,
    inputDeltaCount: inputDeltas.length,
    appliedDeltaCount: appliedDeltas.length,
    ignoredDeltaCount: ignoredDeltas.length,
    appliedTrackKeys: uniqueStrings(appliedDeltas.map(delta => delta.trackKey)),
    appliedLayerKeys: uniqueStrings(appliedDeltas.map(delta => delta.layerKey)),
    mechanismContextReadyDeltaCount: appliedDeltas.filter(
      delta => delta.mechanismContextReady
    ).length,
    mechanismContextMissingDeltaCount: appliedDeltas.filter(
      delta => !delta.mechanismContextReady
    ).length,
    mechanismContextStatuses: uniqueStrings(
      appliedDeltas.map(delta => delta.mechanismContextStatus)
    ),
    mechanismConfigurationReadyDeltaCount: appliedDeltas.filter(
      delta => delta.mechanismConfigurationReady
    ).length,
    mechanismConfigurationMissingDeltaCount: appliedDeltas.filter(
      delta => !delta.mechanismConfigurationReady
    ).length,
    mechanismConfigurationStatuses: uniqueStrings(
      appliedDeltas.map(delta => delta.mechanismConfigurationStatus)
    ),
    configurationInstanceIds: uniqueStrings(
      appliedDeltas.flatMap(
        delta => delta.calculator?.configurationInstanceIds ?? []
      )
    ),
    mechanicsAdapterRequestCount: appliedDeltas.filter(
      delta =>
        delta.mechanicsAdapterRequest?.contractName ===
        THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_NAME
    ).length,
    mechanicsAdapterRequestMissingCount: appliedDeltas.filter(
      delta =>
        delta.mechanicsAdapterRequest?.contractName !==
        THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_NAME
    ).length,
    mechanicsOperandsReadyDeltaCount: appliedDeltas.filter(
      delta =>
        delta.mechanicsAdapterRequest?.sourceValue?.operands?.contractName ===
          THREE_VALUE_MECHANICS_OPERANDS_CONTRACT_NAME &&
        delta.mechanicsAdapterRequest.sourceValue.operands.ready
    ).length,
    mechanicsOperandsMissingDeltaCount: appliedDeltas.filter(
      delta =>
        delta.mechanicsAdapterRequest?.sourceValue?.operands?.contractName !==
          THREE_VALUE_MECHANICS_OPERANDS_CONTRACT_NAME ||
        !delta.mechanicsAdapterRequest.sourceValue.operands.ready
    ).length,
    mechanicsOperandsKinds: uniqueStrings(
      appliedDeltas.map(
        delta => delta.mechanicsAdapterRequest?.sourceValue?.operands?.kind
      )
    ),
    ignoredLayerCounts,
    appliedOnly: true,
    applied: true,
  };
}

function summarizeRuntimeInputValueSourceSlots(resolvedSource) {
  const valueSourceSlots = resolvedSource.valueSourceSlots ?? [];
  const readSource =
    resolvedSource.generationReadSources?.inputs?.valueSourceSlots ?? {};
  return {
    valueSourceSlotCount: valueSourceSlots.length,
    runtimeValueSourceSlotCount: valueSourceSlots.filter(
      slot => slot?.runtimeEligible
    ).length,
    replaceableValueSourceSlotCount: valueSourceSlots.filter(
      slot => slot?.replaceable
    ).length,
    runtimeInputGenerationValueSourceSlotsPath: readSource.sourcePath ?? '',
    runtimeInputGenerationValueSourceSlotsSourceTier:
      readSource.sourceTier ?? '',
    runtimeInputGenerationValueSourceSlotsStandardOutputPresent: Boolean(
      readSource.standardOutputPresent
    ),
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

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
