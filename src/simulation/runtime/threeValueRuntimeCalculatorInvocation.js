export const THREE_VALUE_RUNTIME_CALCULATOR_INVOCATION_CONTRACT_NAME =
  'ThreeValueRuntimeCalculatorInvocation';

const DELTA_FIELD_BY_TRACK_KEY = {
  enemyHpDamage: 'hpDelta',
  enemyToughnessDamage: 'toughnessDelta',
  selfEnergyChange: 'energyDelta',
};

const DEFAULT_RUNTIME_CALCULATOR_ADAPTERS = Object.fromEntries(
  Object.entries(DELTA_FIELD_BY_TRACK_KEY).map(([trackKey, outputField]) => [
    trackKey,
    {
      key: `azpr-${trackKey}-runtime-passthrough-adapter`,
      version: 1,
      outputField,
      sourceKind: 'default-runtime-passthrough-adapter',
      custom: false,
      calculate(input) {
        return {
          delta: input.generatedDelta.delta,
          status: 'runtime-calculator-passthrough-generation-result',
          sourceKind: 'generation-calculator-result',
        };
      },
    },
  ])
);

export function createThreeValueRuntimeCalculatorInvocation({
  delta = {},
  stateBefore = null,
  runtimeCalculatorAdapters = {},
} = {}) {
  const outputField = DELTA_FIELD_BY_TRACK_KEY[delta.trackKey] ?? 'delta';
  const resolvedAdapter = resolveRuntimeCalculatorAdapter({
    trackKey: delta.trackKey,
    outputField,
    runtimeCalculatorAdapters,
  });
  const input = {
    sourceDeltaId: delta.id ?? delta.sourceDeltaId ?? null,
    trackKey: delta.trackKey ?? null,
    outputField,
    generatedDelta: {
      delta: normalizeRuntimeCalculatorNumber(delta.delta) ?? 0,
      hpDelta: normalizeNullableRuntimeCalculatorNumber(delta.hpDelta),
      toughnessDelta: normalizeNullableRuntimeCalculatorNumber(
        delta.toughnessDelta
      ),
      energyDelta: normalizeNullableRuntimeCalculatorNumber(delta.energyDelta),
    },
    mechanismContext: delta.mechanismContext ?? null,
    mechanismConfiguration: delta.mechanismContext?.configuration ?? null,
    stateBefore,
    sourceCalculatorResult: delta.calculator ?? null,
    sourceDelta: delta,
  };
  const calculation = invokeRuntimeCalculatorAdapter(resolvedAdapter, input);
  const output = createRuntimeCalculatorOutput({
    delta,
    input,
    outputField,
    calculation,
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
      (delta.mechanismContext?.configuration ?? null),
    stateBeforePresent: Boolean(stateBefore),
    adapterOutputAccepted: !fallbackReason,
  };
  const valid = Object.values(validation).every(Boolean);

  return {
    schemaVersion: 2,
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
    },
    input,
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

function resolveRuntimeCalculatorAdapter({
  trackKey,
  outputField,
  runtimeCalculatorAdapters,
}) {
  const customAdapter = runtimeCalculatorAdapters?.[trackKey];
  if (typeof customAdapter === 'function') {
    return {
      key: `custom-${trackKey ?? 'unknown'}-runtime-calculator-adapter`,
      version: 1,
      outputField,
      sourceKind: 'custom-runtime-calculator-adapter',
      calculate: customAdapter,
      custom: true,
    };
  }
  if (customAdapter?.calculate instanceof Function) {
    return {
      key:
        customAdapter.key ??
        `custom-${trackKey ?? 'unknown'}-runtime-calculator-adapter`,
      version: normalizeRuntimeCalculatorNumber(customAdapter.version) ?? 1,
      outputField,
      sourceKind:
        customAdapter.sourceKind ?? 'custom-runtime-calculator-adapter',
      calculate: customAdapter.calculate,
      custom: true,
    };
  }
  return (
    DEFAULT_RUNTIME_CALCULATOR_ADAPTERS[trackKey] ?? {
      key: `azpr-${trackKey ?? 'unknown'}-runtime-passthrough-adapter`,
      version: 1,
      outputField,
      sourceKind: 'fallback-runtime-passthrough-adapter',
      custom: false,
      calculate(input) {
        return {
          delta: input.generatedDelta.delta,
          status: 'runtime-calculator-passthrough-generation-result',
        };
      },
    }
  );
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
    fallbackReason,
  };
  if (outputField !== 'delta') {
    output[outputField] = outputDelta;
  }
  return output;
}

function normalizeNullableRuntimeCalculatorNumber(value) {
  if (value == null || value === '') {
    return null;
  }
  return normalizeRuntimeCalculatorNumber(value);
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
