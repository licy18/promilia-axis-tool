import {
  THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_NAME,
  THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_VERSION,
  calculateThreeValueMechanicsOperands,
  createThreeValueMechanicsAdapterInput,
  resolveThreeValueMechanicsAdapter,
} from '../mechanics/threeValueMechanicsAdapter';

export const THREE_VALUE_RUNTIME_CALCULATOR_INVOCATION_CONTRACT_NAME =
  'ThreeValueRuntimeCalculatorInvocation';

export function createThreeValueRuntimeCalculatorInvocation({
  delta = {},
  stateBefore = null,
  threeValueMechanicsAdapterRegistry = null,
  runtimeCalculatorAdapters = {},
} = {}) {
  const input = createThreeValueMechanicsAdapterInput({ delta, stateBefore });
  const resolved = resolveThreeValueMechanicsAdapter({
    registry: threeValueMechanicsAdapterRegistry,
    trackKey: delta.trackKey,
    legacyAdapters: runtimeCalculatorAdapters,
  });
  const resolvedAdapter = resolved.adapter;
  const outputField = input.outputField;
  const operandsCalculation = calculateThreeValueMechanicsOperands(
    input.sourceValue?.operands,
    input.mechanicsProfile
  );
  const calculation = invokeRuntimeCalculatorAdapter(resolvedAdapter, input);
  const output = createRuntimeCalculatorOutput({
    delta,
    input,
    outputField,
    calculation,
    operandsCalculation,
  });
  const changed = output.delta !== input.generatedDelta.delta;
  const fallbackReason = output.fallbackReason;
  const validation = {
    outputFieldKnown: outputField !== 'delta',
    outputFinite: Number.isFinite(output.delta),
    mechanismContextPreserved:
      input.mechanismContext === (delta.mechanismContext ?? null),
    mechanismConfigurationPreserved:
      input.mechanismConfiguration ===
      (delta.mechanicsAdapterRequest?.mechanismConfiguration ??
        delta.mechanismContext?.configuration ??
        null),
    mechanicsProfilePreserved:
      input.mechanicsProfile ===
      (delta.mechanicsAdapterRequest?.mechanicsProfile ??
        delta.mechanismContext?.mechanicsProfile ??
        input.mechanicsProfile),
    mechanicsProfilePresent: Boolean(input.mechanicsProfile?.profileId),
    mechanicsLayerInputsAppliedReady:
      input.mechanicsLayerInputs?.missingRequiredCount === 0,
    generationRequestPreserved:
      input.generationRequest === (delta.mechanicsAdapterRequest ?? null),
    actionInputPresent: Boolean(input.action),
    hitInputPresent: Boolean(input.hit),
    sourceValueFinite: Number.isFinite(input.sourceValue?.value),
    operandsPresent: Boolean(input.sourceValue?.operands),
    operandsReady: operandsCalculation.ready,
    operandsMatchSource: operandsCalculation.matchesExpected !== false,
    stateBeforePresent: Boolean(stateBefore),
    adapterOutputAccepted: !fallbackReason,
  };
  const valid = Object.values(validation).every(Boolean);

  return {
    schemaVersion: 6,
    sourceKind: 'azpr-three-value-runtime-calculator-invocation',
    contractName: THREE_VALUE_RUNTIME_CALCULATOR_INVOCATION_CONTRACT_NAME,
    status: fallbackReason
      ? 'runtime-calculator-invocation-ready-with-fallback'
      : changed
        ? 'runtime-calculator-invocation-ready-replaced'
        : 'runtime-calculator-invocation-ready-passthrough',
    sourceDeltaId: input.sourceDeltaId,
    trackKey: input.trackKey,
    outputField,
    adapter: {
      key: resolvedAdapter.key,
      version: resolvedAdapter.version,
      sourceKind: resolvedAdapter.sourceKind,
      custom: resolvedAdapter.custom,
      replaceable: true,
      contractName: THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_NAME,
      contractVersion: THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_VERSION,
      registrationKey: resolved.registrationKey,
    },
    input,
    operandsCalculation,
    output,
    validation: {
      ...validation,
      valid,
    },
    changed,
    preservesGeneratedDelta: !changed,
    fallbackReason,
    applied: true,
  };
}

export function createRuntimeAppliedDeltaFromInvocation(delta, invocation) {
  return {
    ...delta,
    sourceDeltaId: delta.id ?? delta.sourceDeltaId ?? null,
    delta: invocation.output.delta,
    hpDelta: invocation.output.hpDelta,
    toughnessDelta: invocation.output.toughnessDelta,
    energyDelta: invocation.output.energyDelta,
    runtimeCalculatorInvocation: invocation,
    runtimeCalculatorAdapterKey: invocation.adapter.key,
    runtimeCalculatorInvocationStatus: invocation.status,
    runtimeCalculationChanged: invocation.changed,
    applied: true,
  };
}

export function summarizeThreeValueRuntimeCalculatorInvocations(
  invocations = []
) {
  return {
    contractName: THREE_VALUE_RUNTIME_CALCULATOR_INVOCATION_CONTRACT_NAME,
    invocationCount: invocations.length,
    passthroughInvocationCount: invocations.filter(
      invocation => invocation.preservesGeneratedDelta
    ).length,
    replacedInvocationCount: invocations.filter(
      invocation => invocation.changed
    ).length,
    fallbackInvocationCount: invocations.filter(invocation =>
      Boolean(invocation.fallbackReason)
    ).length,
    customAdapterInvocationCount: invocations.filter(
      invocation => invocation.adapter.custom
    ).length,
    mechanicsAdapterContractName: THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_NAME,
    mechanicsAdapterContractVersion:
      THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_VERSION,
    registrationKeys: uniqueStrings(
      invocations.map(invocation => invocation.adapter.registrationKey)
    ),
    operandsReadyInvocationCount: invocations.filter(
      invocation => invocation.validation.operandsReady
    ).length,
    operandsMissingInvocationCount: invocations.filter(
      invocation => !invocation.validation.operandsReady
    ).length,
    operandsMismatchInvocationCount: invocations.filter(
      invocation => !invocation.validation.operandsMatchSource
    ).length,
    operandsCalculatedInvocationCount: invocations.filter(
      invocation => invocation.output.calculatedFromOperands
    ).length,
    operandsKinds: uniqueStrings(
      invocations.map(invocation => invocation.output.operandsKind)
    ),
    mechanicsProfileIds: uniqueStrings(
      invocations.map(invocation => invocation.output.mechanicsProfileId)
    ),
    mechanicsProfileVersions: uniqueNumbers(
      invocations.map(invocation => invocation.output.mechanicsProfileVersion)
    ),
    mechanicsProfileStatuses: uniqueStrings(
      invocations.map(invocation => invocation.output.mechanicsProfileStatus)
    ),
    mechanicsProfileFallbackInvocationCount: invocations.filter(
      invocation => invocation.output.mechanicsProfileFallback
    ).length,
    mechanicsProfileCapabilityReadyInvocationCount: invocations.filter(
      invocation =>
        invocation.output.mechanicsProfileCapabilityStatus ===
        'mechanics-profile-capability-ready'
    ).length,
    mechanicsProfileCapabilityMissingInvocationCount: invocations.filter(
      invocation =>
        invocation.output.mechanicsProfileCapabilityStatus !==
        'mechanics-profile-capability-ready'
    ).length,
    adapterKeys: uniqueStrings(
      invocations.map(invocation => invocation.adapter.key)
    ),
    mechanismConfigurationReadyInvocationCount: invocations.filter(
      invocation => invocation.input.mechanismConfiguration?.ready === true
    ).length,
    mechanismConfigurationMissingInvocationCount: invocations.filter(
      invocation => invocation.input.mechanismConfiguration?.ready !== true
    ).length,
    mechanismConfigurationStatuses: uniqueStrings(
      invocations.map(
        invocation => invocation.input.mechanismConfiguration?.status
      )
    ),
    configurationInstanceIds: uniqueStrings(
      invocations.flatMap(invocation => [
        invocation.input.mechanismConfiguration?.sourceActor
          ?.configurationInstanceId,
        invocation.input.mechanismConfiguration?.targetEnemy
          ?.configurationInstanceId,
      ])
    ),
    statuses: uniqueStrings(invocations.map(invocation => invocation.status)),
    applied: true,
  };
}

function invokeRuntimeCalculatorAdapter(adapter, input) {
  try {
    return {
      result: adapter.calculate(input),
      fallbackReason: null,
    };
  } catch {
    return {
      result: null,
      fallbackReason: 'runtime-calculator-adapter-threw',
    };
  }
}

function createRuntimeCalculatorOutput({
  delta,
  input,
  outputField,
  calculation,
  operandsCalculation,
}) {
  const result = calculation.result;
  const candidateValue =
    typeof result === 'number'
      ? result
      : (result?.delta ?? result?.[outputField]);
  const normalizedCandidate = normalizeRuntimeCalculatorNumber(candidateValue);
  const fallbackReason =
    calculation.fallbackReason ??
    (Number.isFinite(normalizedCandidate)
      ? null
      : 'runtime-calculator-output-invalid');
  const outputDelta = Number.isFinite(normalizedCandidate)
    ? normalizedCandidate
    : input.generatedDelta.delta;
  const output = {
    delta: outputDelta,
    hpDelta: input.generatedDelta.hpDelta,
    toughnessDelta: input.generatedDelta.toughnessDelta,
    energyDelta: input.generatedDelta.energyDelta,
    status: fallbackReason
      ? 'runtime-calculator-fallback-generation-result'
      : (result?.status ?? 'runtime-calculator-output-ready'),
    sourceKind: fallbackReason
      ? 'generation-calculator-result-fallback'
      : (result?.sourceKind ?? 'runtime-calculator-adapter-result'),
    sourceCalculationStatus:
      delta.calculationStatus ?? delta.calculator?.status ?? null,
    operandsKind:
      result?.operandsKind ?? input.sourceValue?.operands?.kind ?? null,
    operandsStatus:
      result?.operandsStatus ?? input.sourceValue?.operands?.status ?? null,
    calculatedFromOperands: result?.calculatedFromOperands === true,
    operandsMatchSource:
      typeof result?.operandsMatchSource === 'boolean'
        ? result.operandsMatchSource
        : null,
    mechanicsProfileId:
      result?.mechanicsProfileId ?? input.mechanicsProfile?.profileId ?? null,
    mechanicsProfileVersion:
      result?.mechanicsProfileVersion ??
      input.mechanicsProfile?.profileVersion ??
      null,
    mechanicsProfileStatus:
      result?.mechanicsProfileStatus ?? input.mechanicsProfile?.status ?? null,
    mechanicsProfileFallback:
      typeof result?.mechanicsProfileFallback === 'boolean'
        ? result.mechanicsProfileFallback
        : operandsCalculation.profileFallback,
    mechanicsProfileCapabilityStatus:
      result?.mechanicsProfileCapabilityStatus ??
      operandsCalculation.capabilityStatus ??
      null,
    mechanicsProfileCapabilityApplied:
      typeof result?.mechanicsProfileCapabilityApplied === 'boolean'
        ? result.mechanicsProfileCapabilityApplied
        : operandsCalculation.capabilityApplied,
    mechanicsProfileCapabilityFallbackReason:
      result?.mechanicsProfileCapabilityFallbackReason ??
      operandsCalculation.capabilityFallbackReason ??
      null,
    fallbackReason,
  };
  if (outputField !== 'delta') {
    output[outputField] = outputDelta;
  }
  return output;
}

function normalizeRuntimeCalculatorNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(6)) : null;
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

function uniqueNumbers(values) {
  return [
    ...new Set(values.map(value => Number(value)).filter(Number.isFinite)),
  ].sort((left, right) => left - right);
}
