import { createActionHitThreeValueDeltaGeneration } from './actionHitThreeValueDeltaGeneration';
import {
  ACTION_HIT_THREE_VALUE_DELTA_CONTRACT_NAME,
  THREE_VALUE_DELTA_FIELDS,
} from './threeValueGenerationLayer';

const STANDARD_GENERATION_ENTRY_OUTPUT_NAMES = [
  'generationInput',
  'standardContract',
  'actions',
  'hits',
  'deltas',
  'valueSourceSlots',
  'runtimeInputSource',
];
const STANDARD_GENERATION_ENTRY_TOPOLOGY = ['Action', 'Hit', 'ThreeValueDelta'];

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
    valueSourceSlots: standardContract.valueSourceSlots ?? [],
    runtimeInputSource,
    runtimeInput: runtimeInputSource,
  };
  const standardOutputBoundary = createThreeValueGenerationOutputBoundary({
    generationEntry,
    outputs,
    standardContract,
    runtimeInputSource,
  });
  const outputSummary = {
    outputCount: Object.keys(outputs).length,
    actionCount: standardContract.summary?.actionCount ?? 0,
    hitCount: standardContract.summary?.hitCount ?? 0,
    deltaCount: standardContract.summary?.deltaCount ?? 0,
    appliedDeltaCount: standardContract.summary?.appliedDeltaCount ?? 0,
    candidateDeltaCount: standardContract.summary?.candidateDeltaCount ?? 0,
    sampledDeltaCount: standardContract.summary?.sampledDeltaCount ?? 0,
    placeholderDeltaCount: standardContract.summary?.placeholderDeltaCount ?? 0,
    valueSourceSlotCount: standardContract.summary?.valueSourceSlotCount ?? 0,
    runtimeValueSourceSlotCount:
      standardContract.summary?.runtimeValueSourceSlotCount ?? 0,
    replaceableValueSourceSlotCount:
      standardContract.summary?.replaceableValueSourceSlotCount ?? 0,
    runtimeInputSourceKind: runtimeInputSource.sourceKind,
    runtimeInputSourceStatus: runtimeInputSource.status,
    generationEntryContractValidationStatus:
      generationEntry.contractValidation?.status ?? '',
    generationEntryContractValidationIssueCount:
      generationEntry.contractValidation?.issueCount ?? 0,
    generationEntryAggregateValidationStatus:
      generationEntry.contractValidation?.aggregateValidation?.status ?? '',
    generationEntryAggregateValidationIssueCount:
      generationEntry.contractValidation?.aggregateValidation?.issueCount ?? 0,
    generationEntryBoundaryStatus:
      generationEntry.standardEntryBoundary?.status ?? '',
    generationEntryBoundaryReady:
      generationEntry.standardEntryBoundary?.ready === true,
    generationEntryBoundaryIssueCount:
      generationEntry.standardEntryBoundary?.issueCount ?? 0,
    generationOutputBoundaryStatus: standardOutputBoundary.status,
    generationOutputBoundaryReady: standardOutputBoundary.ready,
    generationOutputBoundaryPath: 'generationOutputs.standardOutputBoundary',
    generationOutputBoundaryEntryPath: standardOutputBoundary.entryPath,
    generationOutputBoundaryRuntimeInputSourcePath:
      standardOutputBoundary.runtimeInputSourcePath,
    generationOutputBoundaryStandardContractPath:
      standardOutputBoundary.standardContractPath,
    generationOutputBoundaryDeltasPath: standardOutputBoundary.deltasPath,
    generationOutputBoundaryValueSourceSlotsPath:
      standardOutputBoundary.valueSourceSlotsPath,
    generationOutputBoundaryContractValidationPath:
      standardOutputBoundary.contractValidationPath,
    generationOutputBoundaryStandardOutputCount:
      standardOutputBoundary.standardOutputCount,
    generationOutputBoundaryIssueCount: standardOutputBoundary.issueCount,
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
    valueSourceSlots: standardContract.valueSourceSlots ?? [],
    runtimeInputSource,
    runtimeInput: runtimeInputSource,
    standardOutputBoundary,
    outputBoundary: standardOutputBoundary,
    outputs,
    summary: outputSummary,
    outputSummary,
    applied: false,
  };
}

function createThreeValueGenerationOutputBoundary({
  generationEntry,
  outputs,
  standardContract,
  runtimeInputSource,
}) {
  const contractValidation = generationEntry.contractValidation ?? {};
  const aggregateValidation = contractValidation.aggregateValidation ?? {};
  const checks = [
    createGenerationOutputBoundaryCheck({
      key: 'entry-required-outputs-present',
      valid: STANDARD_GENERATION_ENTRY_OUTPUT_NAMES.every(
        name => outputs[name] !== null && outputs[name] !== undefined
      ),
    }),
    createGenerationOutputBoundaryCheck({
      key: 'entry-output-present',
      valid: outputs.generationEntry === generationEntry,
    }),
    createGenerationOutputBoundaryCheck({
      key: 'runtime-input-source-output-present',
      valid: outputs.runtimeInputSource === runtimeInputSource,
    }),
    createGenerationOutputBoundaryCheck({
      key: 'runtime-input-alias-present',
      valid: outputs.runtimeInput === runtimeInputSource,
    }),
    createGenerationOutputBoundaryCheck({
      key: 'entry-runtime-input-source-reference',
      valid: generationEntry.runtimeInputSource === runtimeInputSource,
    }),
    createGenerationOutputBoundaryCheck({
      key: 'entry-standard-contract-reference',
      valid: generationEntry.standardContract === standardContract,
    }),
    createGenerationOutputBoundaryCheck({
      key: 'entry-deltas-reference',
      valid: generationEntry.deltas === standardContract.deltas,
    }),
    createGenerationOutputBoundaryCheck({
      key: 'entry-value-source-slots-reference',
      valid:
        generationEntry.valueSourceSlots === standardContract.valueSourceSlots,
    }),
    createGenerationOutputBoundaryCheck({
      key: 'entry-contract-validation-valid',
      valid: contractValidation.valid === true,
    }),
    createGenerationOutputBoundaryCheck({
      key: 'entry-aggregate-validation-valid',
      valid: aggregateValidation.valid === true,
    }),
  ];
  const failedChecks = checks.filter(check => !check.valid);

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-action-hit-three-value-generation-output-boundary',
    status:
      failedChecks.length > 0
        ? 'generation-output-boundary-invalid'
        : 'generation-output-boundary-ready',
    contractName: standardContract.name,
    entryPath: 'generationOutputs.outputs.generationEntry',
    runtimeInputSourcePath:
      'generationOutputs.outputs.generationEntry.runtimeInputSource',
    runtimeInputAliasPath: 'generationOutputs.outputs.runtimeInput',
    standardContractPath:
      'generationOutputs.outputs.generationEntry.standardContract',
    deltasPath: 'generationOutputs.outputs.generationEntry.deltas',
    valueSourceSlotsPath:
      'generationOutputs.outputs.generationEntry.valueSourceSlots',
    contractValidationPath:
      'generationOutputs.outputs.generationEntry.contractValidation',
    aggregateValidationPath:
      'generationOutputs.outputs.generationEntry.contractValidation.aggregateValidation',
    outputNames: Object.keys(outputs),
    requiredEntryOutputNames: STANDARD_GENERATION_ENTRY_OUTPUT_NAMES,
    standardOutputNames: [
      'generationEntry',
      'runtimeInputSource',
      'standardContract',
      'deltas',
      'valueSourceSlots',
      'contractValidation',
    ],
    standardOutputCount: 6,
    actionCount: standardContract.summary?.actionCount ?? 0,
    hitCount: standardContract.summary?.hitCount ?? 0,
    deltaCount: standardContract.summary?.deltaCount ?? 0,
    appliedDeltaCount: standardContract.summary?.appliedDeltaCount ?? 0,
    valueSourceSlotCount: standardContract.summary?.valueSourceSlotCount ?? 0,
    runtimeValueSourceSlotCount:
      standardContract.summary?.runtimeValueSourceSlotCount ?? 0,
    replaceableValueSourceSlotCount:
      standardContract.summary?.replaceableValueSourceSlotCount ?? 0,
    contractValidationStatus: contractValidation.status ?? '',
    contractValidationIssueCount: numberOrZero(contractValidation.issueCount),
    aggregateValidationStatus: aggregateValidation.status ?? '',
    aggregateValidationIssueCount: numberOrZero(aggregateValidation.issueCount),
    checkCount: checks.length,
    issueCount: failedChecks.length,
    issueKeys: failedChecks.map(check => check.key),
    checks,
    ready: failedChecks.length === 0,
    usesLegacyFallback: false,
    runtimeDeltaPolicy: standardContract.runtimeDeltaPolicy,
    applied: false,
  };
}

function createGenerationOutputBoundaryCheck({ key, valid }) {
  return {
    key,
    status: valid ? 'valid' : 'invalid',
    valid: Boolean(valid),
  };
}

function createStandardGenerationEntry({
  generationInput,
  standardContract,
  runtimeInputSource,
  threeValueGenerationLayer,
  actionHitThreeValueDeltaGeneration,
}) {
  const actions = standardContract.actions ?? [];
  const hits = standardContract.hits ?? [];
  const deltas = standardContract.deltas ?? [];
  const valueSourceSlots = standardContract.valueSourceSlots ?? [];
  const entry = {
    schemaVersion: 1,
    sourceKind: 'azpr-action-hit-three-value-delta-standard-generation-entry',
    status: '',
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
    actions,
    hits,
    deltas,
    valueSourceSlots,
    runtimeInputSource,
    outputs: {
      generationInput,
      standardContract,
      actions,
      hits,
      deltas,
      valueSourceSlots,
      runtimeInputSource,
    },
    outputNames: STANDARD_GENERATION_ENTRY_OUTPUT_NAMES,
    applied: false,
  };
  const contractValidation = validateStandardGenerationEntryContract(entry);
  const standardEntryBoundary = createStandardGenerationEntryBoundary({
    generationEntry: entry,
    contractValidation,
  });
  return {
    ...entry,
    status: !contractValidation.valid
      ? 'action-hit-three-value-delta-standard-generation-entry-contract-invalid'
      : deltas.length > 0
        ? 'action-hit-three-value-delta-standard-generation-entry-ready'
        : 'action-hit-three-value-delta-standard-generation-entry-empty',
    contractValidation,
    standardEntryBoundary,
    entryBoundary: standardEntryBoundary,
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
      valueSourceSlotCount: standardContract.summary?.valueSourceSlotCount ?? 0,
      runtimeValueSourceSlotCount:
        standardContract.summary?.runtimeValueSourceSlotCount ?? 0,
      replaceableValueSourceSlotCount:
        standardContract.summary?.replaceableValueSourceSlotCount ?? 0,
      runtimeDeltaPolicy: standardContract.runtimeDeltaPolicy,
      contractValidationStatus: contractValidation.status,
      contractValidationIssueCount: contractValidation.issueCount,
      aggregateValidationStatus: contractValidation.aggregateValidation.status,
      aggregateValidationIssueCount:
        contractValidation.aggregateValidation.issueCount,
      entryBoundaryStatus: standardEntryBoundary.status,
      entryBoundaryReady: standardEntryBoundary.ready,
      entryBoundaryIssueCount: standardEntryBoundary.issueCount,
      applied: false,
    },
    applied: false,
  };
}

function createStandardGenerationEntryBoundary({
  generationEntry,
  contractValidation,
}) {
  const standardContract = generationEntry.standardContract;
  const aggregateValidation = contractValidation.aggregateValidation ?? {};
  const checks = [
    createGenerationEntryBoundaryCheck({
      key: 'entry-output-names',
      valid: arraysEqual(
        generationEntry.outputNames,
        STANDARD_GENERATION_ENTRY_OUTPUT_NAMES
      ),
    }),
    createGenerationEntryBoundaryCheck({
      key: 'entry-generation-input-present',
      valid: Boolean(generationEntry.generationInput),
    }),
    createGenerationEntryBoundaryCheck({
      key: 'entry-standard-contract-present',
      valid: Boolean(standardContract),
    }),
    createGenerationEntryBoundaryCheck({
      key: 'entry-actions-reference',
      valid: generationEntry.actions === standardContract?.actions,
    }),
    createGenerationEntryBoundaryCheck({
      key: 'entry-hits-reference',
      valid: generationEntry.hits === standardContract?.hits,
    }),
    createGenerationEntryBoundaryCheck({
      key: 'entry-deltas-reference',
      valid: generationEntry.deltas === standardContract?.deltas,
    }),
    createGenerationEntryBoundaryCheck({
      key: 'entry-value-source-slots-reference',
      valid:
        generationEntry.valueSourceSlots === standardContract?.valueSourceSlots,
    }),
    createGenerationEntryBoundaryCheck({
      key: 'entry-runtime-input-source-present',
      valid: Boolean(generationEntry.runtimeInputSource),
    }),
    createGenerationEntryBoundaryCheck({
      key: 'entry-runtime-input-source-contract-reference',
      valid:
        generationEntry.runtimeInputSource?.standardContract ===
        standardContract,
    }),
    createGenerationEntryBoundaryCheck({
      key: 'entry-runtime-input-source-deltas-reference',
      valid:
        generationEntry.runtimeInputSource?.deltas === generationEntry.deltas,
    }),
    createGenerationEntryBoundaryCheck({
      key: 'entry-runtime-input-source-value-source-slots-reference',
      valid:
        generationEntry.runtimeInputSource?.valueSourceSlots ===
        generationEntry.valueSourceSlots,
    }),
    createGenerationEntryBoundaryCheck({
      key: 'entry-contract-validation-valid',
      valid: contractValidation.valid === true,
    }),
    createGenerationEntryBoundaryCheck({
      key: 'entry-aggregate-validation-valid',
      valid: aggregateValidation.valid === true,
    }),
  ];
  const failedChecks = checks.filter(check => !check.valid);

  return {
    schemaVersion: 1,
    sourceKind:
      'azpr-action-hit-three-value-delta-standard-generation-entry-boundary',
    status:
      failedChecks.length > 0
        ? 'standard-generation-entry-boundary-invalid'
        : 'standard-generation-entry-boundary-ready',
    contractName:
      standardContract?.name ?? ACTION_HIT_THREE_VALUE_DELTA_CONTRACT_NAME,
    entryPath: 'generationEntry',
    generationInputPath: 'generationEntry.generationInput',
    standardContractPath: 'generationEntry.standardContract',
    actionsPath: 'generationEntry.actions',
    hitsPath: 'generationEntry.hits',
    deltasPath: 'generationEntry.deltas',
    valueSourceSlotsPath: 'generationEntry.valueSourceSlots',
    runtimeInputSourcePath: 'generationEntry.runtimeInputSource',
    contractValidationPath: 'generationEntry.contractValidation',
    aggregateValidationPath:
      'generationEntry.contractValidation.aggregateValidation',
    outputNames: generationEntry.outputNames ?? [],
    requiredOutputNames: STANDARD_GENERATION_ENTRY_OUTPUT_NAMES,
    standardOutputNames: [
      ...STANDARD_GENERATION_ENTRY_OUTPUT_NAMES,
      'contractValidation',
    ],
    standardOutputCount: STANDARD_GENERATION_ENTRY_OUTPUT_NAMES.length + 1,
    actionCount: generationEntry.actions?.length ?? 0,
    hitCount: generationEntry.hits?.length ?? 0,
    deltaCount: generationEntry.deltas?.length ?? 0,
    valueSourceSlotCount: generationEntry.valueSourceSlots?.length ?? 0,
    contractValidationStatus: contractValidation.status ?? '',
    contractValidationIssueCount: numberOrZero(contractValidation.issueCount),
    aggregateValidationStatus: aggregateValidation.status ?? '',
    aggregateValidationIssueCount: numberOrZero(aggregateValidation.issueCount),
    checkCount: checks.length,
    issueCount: failedChecks.length,
    issueKeys: failedChecks.map(check => check.key),
    checks,
    ready: failedChecks.length === 0,
    applied: false,
  };
}

function createGenerationEntryBoundaryCheck({ key, valid }) {
  return {
    key,
    status: valid ? 'valid' : 'invalid',
    valid: Boolean(valid),
  };
}

export function validateStandardGenerationEntryContract(generationEntry = {}) {
  const standardContract = generationEntry.standardContract;
  const actions = generationEntry.actions;
  const hits = generationEntry.hits;
  const deltas = generationEntry.deltas;
  const valueSourceSlots = generationEntry.valueSourceSlots;
  const actionKeys = new Set(
    (actions ?? []).map(action => createGenerationEntryActionKey(action))
  );
  const hitKeys = new Set(
    (hits ?? []).map(hit => createGenerationEntryHitKey(hit))
  );
  const hitDeltaIds = new Set(
    (hits ?? []).flatMap(hit => [
      ...(hit.deltaIds ?? []),
      ...(hit.deltas ?? []).map(delta => delta?.id),
    ])
  );
  const aggregateValidation = validateGenerationEntryAggregates({
    actions,
    hits,
  });
  const checks = [
    createGenerationEntryValidationCheck({
      key: 'contract-name',
      valid:
        (standardContract?.name ?? generationEntry.contractName) ===
        ACTION_HIT_THREE_VALUE_DELTA_CONTRACT_NAME,
    }),
    createGenerationEntryValidationCheck({
      key: 'topology',
      valid: arraysEqual(
        standardContract?.topology,
        STANDARD_GENERATION_ENTRY_TOPOLOGY
      ),
    }),
    createGenerationEntryValidationCheck({
      key: 'output-names',
      valid: arraysEqual(
        generationEntry.outputNames,
        STANDARD_GENERATION_ENTRY_OUTPUT_NAMES
      ),
    }),
    createGenerationEntryValidationCheck({
      key: 'standard-contract-actions-reference',
      valid: actions === standardContract?.actions,
    }),
    createGenerationEntryValidationCheck({
      key: 'standard-contract-hits-reference',
      valid: hits === standardContract?.hits,
    }),
    createGenerationEntryValidationCheck({
      key: 'standard-contract-deltas-reference',
      valid: deltas === standardContract?.deltas,
    }),
    createGenerationEntryValidationCheck({
      key: 'standard-contract-value-source-slots-reference',
      valid: valueSourceSlots === standardContract?.valueSourceSlots,
    }),
    createGenerationEntryValidationCheck({
      key: 'runtime-input-source-contract-reference',
      valid:
        generationEntry.runtimeInputSource?.standardContract ===
        standardContract,
    }),
    createGenerationEntryValidationCheck({
      key: 'runtime-input-source-deltas-reference',
      valid: generationEntry.runtimeInputSource?.deltas === deltas,
    }),
    createGenerationEntryValidationCheck({
      key: 'runtime-input-source-value-source-slots-reference',
      valid:
        generationEntry.runtimeInputSource?.valueSourceSlots ===
        valueSourceSlots,
    }),
    createGenerationEntryValidationCheck({
      key: 'outputs-standard-contract-reference',
      valid: generationEntry.outputs?.standardContract === standardContract,
    }),
    createGenerationEntryValidationCheck({
      key: 'outputs-actions-reference',
      valid: generationEntry.outputs?.actions === actions,
    }),
    createGenerationEntryValidationCheck({
      key: 'outputs-hits-reference',
      valid: generationEntry.outputs?.hits === hits,
    }),
    createGenerationEntryValidationCheck({
      key: 'outputs-deltas-reference',
      valid: generationEntry.outputs?.deltas === deltas,
    }),
    createGenerationEntryValidationCheck({
      key: 'outputs-value-source-slots-reference',
      valid: generationEntry.outputs?.valueSourceSlots === valueSourceSlots,
    }),
    createGenerationEntryValidationCheck({
      key: 'summary-action-count',
      valid:
        numberOrZero(standardContract?.summary?.actionCount) ===
        actions?.length,
    }),
    createGenerationEntryValidationCheck({
      key: 'summary-hit-count',
      valid: numberOrZero(standardContract?.summary?.hitCount) === hits?.length,
    }),
    createGenerationEntryValidationCheck({
      key: 'summary-delta-count',
      valid:
        numberOrZero(standardContract?.summary?.deltaCount) === deltas?.length,
    }),
    createGenerationEntryValidationCheck({
      key: 'summary-applied-delta-count',
      valid:
        numberOrZero(standardContract?.summary?.appliedDeltaCount) ===
        countMatching(deltas, delta => delta?.applied),
    }),
    createGenerationEntryValidationCheck({
      key: 'delta-required-fields',
      valid: (deltas ?? []).every(delta =>
        ['id', 'hitKey', 'frameIndex', 'timeMs', 'trackKey', 'layerKey'].every(
          field => delta?.[field] !== null && delta?.[field] !== undefined
        )
      ),
    }),
    createGenerationEntryValidationCheck({
      key: 'deltas-linked-to-actions',
      valid: (deltas ?? []).every(delta =>
        actionKeys.has(createGenerationEntryActionKey(delta))
      ),
    }),
    createGenerationEntryValidationCheck({
      key: 'deltas-linked-to-hits',
      valid: (deltas ?? []).every(delta =>
        hitKeys.has(createGenerationEntryHitKey(delta))
      ),
    }),
    createGenerationEntryValidationCheck({
      key: 'deltas-listed-by-hits',
      valid: (deltas ?? []).every(delta => hitDeltaIds.has(delta?.id)),
    }),
    ...aggregateValidation.checks.map(check =>
      createGenerationEntryValidationCheck({
        key: check.key,
        valid: check.valid,
      })
    ),
  ];
  const failedChecks = checks.filter(check => !check.valid);

  return {
    schemaVersion: 1,
    sourceKind:
      'azpr-action-hit-three-value-delta-generation-entry-contract-validation',
    status:
      failedChecks.length > 0
        ? 'generation-entry-contract-invalid'
        : 'generation-entry-contract-valid',
    contractName:
      standardContract?.name ??
      generationEntry.contractName ??
      ACTION_HIT_THREE_VALUE_DELTA_CONTRACT_NAME,
    topology: standardContract?.topology ?? [],
    outputNames: generationEntry.outputNames ?? [],
    actionCount: actions?.length ?? 0,
    hitCount: hits?.length ?? 0,
    deltaCount: deltas?.length ?? 0,
    valueSourceSlotCount: valueSourceSlots?.length ?? 0,
    checkCount: checks.length,
    issueCount: failedChecks.length,
    issueKeys: failedChecks.map(check => check.key),
    checks,
    aggregateValidation,
    valid: failedChecks.length === 0,
    applied: false,
  };
}

function validateGenerationEntryAggregates({ actions, hits }) {
  const checks = [
    createGenerationEntryValidationCheck({
      key: 'action-aggregate-delta-counts',
      valid: (actions ?? []).every(action => {
        const actionDeltas = getGenerationEntryActionDeltas(action);
        return (
          numberOrZero(action?.threeValueDeltaAggregate?.deltaCount) ===
          actionDeltas.length
        );
      }),
    }),
    createGenerationEntryValidationCheck({
      key: 'hit-aggregate-delta-counts',
      valid: (hits ?? []).every(hit => {
        const hitDeltas = hit?.deltas ?? [];
        return (
          numberOrZero(hit?.threeValueDeltaAggregate?.deltaCount) ===
          hitDeltas.length
        );
      }),
    }),
    createGenerationEntryValidationCheck({
      key: 'action-aggregate-layer-fields',
      valid: (actions ?? []).every(action =>
        aggregateMatchesDeltas(
          action?.threeValueDeltaAggregate,
          getGenerationEntryActionDeltas(action)
        )
      ),
    }),
    createGenerationEntryValidationCheck({
      key: 'hit-aggregate-layer-fields',
      valid: (hits ?? []).every(hit =>
        aggregateMatchesDeltas(hit?.threeValueDeltaAggregate, hit?.deltas ?? [])
      ),
    }),
  ];
  const failedChecks = checks.filter(check => !check.valid);

  return {
    schemaVersion: 1,
    sourceKind:
      'azpr-action-hit-three-value-delta-generation-entry-aggregate-validation',
    status:
      failedChecks.length > 0
        ? 'generation-entry-aggregate-invalid'
        : 'generation-entry-aggregate-valid',
    actionCount: actions?.length ?? 0,
    hitCount: hits?.length ?? 0,
    checkCount: checks.length,
    issueCount: failedChecks.length,
    issueKeys: failedChecks.map(check => check.key),
    checks,
    valid: failedChecks.length === 0,
    applied: false,
  };
}

function getGenerationEntryActionDeltas(action) {
  return (action?.hits ?? []).flatMap(hit => hit?.deltas ?? []);
}

function aggregateMatchesDeltas(aggregate, deltas) {
  const normalizedDeltas = deltas ?? [];
  if (!aggregate) {
    return normalizedDeltas.length === 0;
  }

  if (numberOrZero(aggregate.deltaCount) !== normalizedDeltas.length) {
    return false;
  }

  const expectedLayerKeys = sortGenerationEntryLayerKeys(
    uniqueStrings(normalizedDeltas.map(delta => delta?.layerKey ?? 'unknown'))
  );
  if (!arraysEqual(aggregate.layerKeys, expectedLayerKeys)) {
    return false;
  }

  for (const layerKey of expectedLayerKeys) {
    const layerDeltas = normalizedDeltas.filter(
      delta => (delta?.layerKey ?? 'unknown') === layerKey
    );
    const aggregateLayer = aggregate.layers?.[layerKey];
    if (!aggregateLayer) {
      return false;
    }

    if (numberOrZero(aggregateLayer.deltaCount) !== layerDeltas.length) {
      return false;
    }

    const expectedTrackKeys = uniqueStrings(
      layerDeltas.map(delta => delta?.trackKey)
    );
    if (!setsEqualStrings(aggregateLayer.trackKeys ?? [], expectedTrackKeys)) {
      return false;
    }

    for (const field of THREE_VALUE_DELTA_FIELDS) {
      if (
        roundGenerationEntryNumber(aggregateLayer[field]) !==
        sumGenerationEntryDeltaField(layerDeltas, field)
      ) {
        return false;
      }
    }
  }

  return true;
}

function sumGenerationEntryDeltaField(deltas, field) {
  return roundGenerationEntryNumber(
    (deltas ?? []).reduce((sum, delta) => {
      const value = Number(delta?.[field]);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0)
  );
}

function sortGenerationEntryLayerKeys(layerKeys) {
  return [...layerKeys].sort(
    (left, right) =>
      getGenerationEntryLayerOrder(left) -
        getGenerationEntryLayerOrder(right) ||
      String(left ?? '').localeCompare(String(right ?? ''))
  );
}

function getGenerationEntryLayerOrder(layerKey) {
  const order = ['applied', 'candidate', 'sampled', 'placeholder'];
  const index = order.indexOf(layerKey);
  return index >= 0 ? index : 99;
}

function setsEqualStrings(left, right) {
  return arraysEqual(uniqueStrings(left), uniqueStrings(right));
}

function roundGenerationEntryNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(6)) : 0;
}

function createGenerationEntryValidationCheck({ key, valid }) {
  return {
    key,
    status: valid ? 'valid' : 'invalid',
    valid: Boolean(valid),
  };
}

function createGenerationEntryActionKey(item) {
  return createGenerationEntryIdPart(item?.actionId ?? 'system');
}

function createGenerationEntryHitKey(item) {
  return [
    item?.actionId ?? 'system',
    item?.hitKey,
    item?.frameIndex,
    item?.timeMs,
  ]
    .map(createGenerationEntryIdPart)
    .join('|');
}

function createGenerationEntryIdPart(value) {
  return String(value ?? 'none').replace(/\|/g, '/');
}

function arraysEqual(left, right) {
  const leftItems = left ?? [];
  const rightItems = right ?? [];
  return (
    leftItems.length === rightItems.length &&
    leftItems.every((item, index) => item === rightItems[index])
  );
}

function countMatching(items, predicate) {
  return (items ?? []).filter(predicate).length;
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function uniqueStrings(values) {
  return [
    ...new Set(
      (values ?? [])
        .filter(value => value != null && String(value).trim() !== '')
        .map(value => String(value))
    ),
  ].sort();
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
    valueSourceSlots: standardContract.valueSourceSlots ?? [],
    summary: {
      actionCount: standardContract.summary?.actionCount ?? 0,
      hitCount: standardContract.summary?.hitCount ?? 0,
      deltaCount: standardContract.summary?.deltaCount ?? 0,
      appliedDeltaCount: standardContract.summary?.appliedDeltaCount ?? 0,
      valueSourceSlotCount: standardContract.summary?.valueSourceSlotCount ?? 0,
      runtimeValueSourceSlotCount:
        standardContract.summary?.runtimeValueSourceSlotCount ?? 0,
      replaceableValueSourceSlotCount:
        standardContract.summary?.replaceableValueSourceSlotCount ?? 0,
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
    standardGenerationEntryContractValidationStatus:
      generationEntry.contractValidation?.status ?? '',
    standardGenerationEntryContractValidationIssueCount:
      generationEntry.contractValidation?.issueCount ?? 0,
    standardGenerationEntryAggregateValidationStatus:
      generationEntry.contractValidation?.aggregateValidation?.status ?? '',
    standardGenerationEntryAggregateValidationIssueCount:
      generationEntry.contractValidation?.aggregateValidation?.issueCount ?? 0,
    standardGenerationEntryBoundaryStatus:
      generationEntry.standardEntryBoundary?.status ?? '',
    standardGenerationEntryBoundaryReady:
      generationEntry.standardEntryBoundary?.ready === true,
    standardGenerationEntryBoundaryIssueCount:
      generationEntry.standardEntryBoundary?.issueCount ?? 0,
    generationOutputBoundaryStatus:
      generationOutputs.standardOutputBoundary?.status ?? '',
    generationOutputBoundaryReady:
      generationOutputs.standardOutputBoundary?.ready === true,
    generationOutputBoundaryIssueCount:
      generationOutputs.standardOutputBoundary?.issueCount ?? 0,
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
    valueSourceSlotCount: standardContract.summary?.valueSourceSlotCount ?? 0,
    runtimeValueSourceSlotCount:
      standardContract.summary?.runtimeValueSourceSlotCount ?? 0,
    replaceableValueSourceSlotCount:
      standardContract.summary?.replaceableValueSourceSlotCount ?? 0,
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
    valueSourceSlots: threeValueGenerationLayer?.valueSourceSlots ?? [],
    summary: threeValueGenerationLayer?.summary ?? {},
    applied: false,
  };
}
