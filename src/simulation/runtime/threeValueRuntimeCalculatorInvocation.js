import {
  THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_NAME,
  THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_VERSION,
  THREE_VALUE_MECHANICS_EVALUATION_CONTRACT_NAME,
  THREE_VALUE_MECHANICS_EVALUATION_CONTRACT_VERSION,
  createThreeValueMechanicsAdapterInput,
  resolveThreeValueMechanicsAdapter,
} from '../mechanics/threeValueMechanicsAdapter';
import { THREE_VALUE_STATE_EFFECT_BY_TRACK_KEY } from '../mechanics/threeValueMechanicsProfile';

export const THREE_VALUE_RUNTIME_CALCULATOR_INVOCATION_CONTRACT_NAME =
  'ThreeValueRuntimeCalculatorInvocation';

export const THREE_VALUE_STATE_EFFECT_PROPOSAL_CONTRACT_NAME =
  'AzPrThreeValueStateEffectProposal';

export const THREE_VALUE_STATE_EFFECT_PROPOSAL_CONTRACT_VERSION = 1;

export function createThreeValueRuntimeCalculatorInvocation({
  delta = {},
  stateBefore = null,
  runtimeOwnership = null,
  threeValueMechanicsAdapterRegistry = null,
} = {}) {
  const input = createThreeValueMechanicsAdapterInput({ delta, stateBefore });
  const resolved = resolveThreeValueMechanicsAdapter({
    registry: threeValueMechanicsAdapterRegistry,
    trackKey: delta.trackKey,
  });
  const resolvedAdapter = resolved.adapter;
  const outputField = input.outputField;
  const calculation = invokeRuntimeCalculatorAdapter(resolvedAdapter, input);
  const output = createRuntimeCalculatorOutput({
    delta,
    input,
    outputField,
    calculation,
  });
  const stateEffectProposal = createThreeValueStateEffectProposal({
    input,
    output,
    runtimeOwnership,
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
    mechanicsEvaluationReady:
      resolvedAdapter.custom || output.mechanicsEvaluation?.ready === true,
    stateBeforePresent: Boolean(stateBefore),
    adapterOutputAccepted: !fallbackReason,
    stateEffectProposalReady: stateEffectProposal.ready,
  };
  const valid = Object.values(validation).every(Boolean);

  return {
    schemaVersion: 9,
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
      evaluationContractName: THREE_VALUE_MECHANICS_EVALUATION_CONTRACT_NAME,
      evaluationContractVersion:
        THREE_VALUE_MECHANICS_EVALUATION_CONTRACT_VERSION,
    },
    input,
    mechanicsEvaluation: output.mechanicsEvaluation,
    stateEffectProposal,
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
    stateEffectProposal: invocation.stateEffectProposal,
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
    mechanicsEvaluationReadyInvocationCount: invocations.filter(
      invocation => invocation.mechanicsEvaluation?.ready === true
    ).length,
    mechanicsEvaluationMissingInvocationCount: invocations.filter(
      invocation => !invocation.mechanicsEvaluation?.ready
    ).length,
    mechanicsEvaluationOperations: uniqueStrings(
      invocations.flatMap(
        invocation =>
          invocation.mechanicsEvaluation?.stepResults?.map(
            step => step.operation
          ) ?? []
      )
    ),
    stateEffectProposalReadyInvocationCount: invocations.filter(
      invocation => invocation.stateEffectProposal?.ready === true
    ).length,
    stateEffectProposalMissingInvocationCount: invocations.filter(
      invocation => invocation.stateEffectProposal?.ready !== true
    ).length,
    mechanicsProfileIds: uniqueStrings(
      invocations.map(invocation => invocation.input.mechanicsProfile?.profileId)
    ),
    mechanicsProfileVersions: uniqueNumbers(
      invocations.map(
        invocation => invocation.input.mechanicsProfile?.profileVersion
      )
    ),
    mechanicsProfileStatuses: uniqueStrings(
      invocations.map(
        invocation =>
          invocation.input.mechanicsProfile?.status
      )
    ),
    mechanicsProfileFallbackInvocationCount: invocations.filter(
      invocation =>
        invocation.input.mechanismContext?.mechanicsProfileSelection
          ?.fallback === true
    ).length,
    mechanicsProfileCapabilityReadyInvocationCount: invocations.filter(
      invocation => invocation.mechanicsEvaluation?.capabilityReady === true
    ).length,
    mechanicsProfileCapabilityMissingInvocationCount: invocations.filter(
      invocation => invocation.mechanicsEvaluation?.capabilityReady !== true
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

export function createThreeValueStateEffectProposal({
  input,
  output,
  runtimeOwnership,
} = {}) {
  const expected = THREE_VALUE_STATE_EFFECT_BY_TRACK_KEY[input?.trackKey];
  const targetId =
    expected?.target === 'energyOwner'
      ? (input?.mechanismContext?.ownership?.energyOwnerActorId ??
        runtimeOwnership?.energyOwnerActorId ??
        input?.action?.actorId ??
        null)
      : (input?.mechanismContext?.ownership?.targetEnemyId ??
        runtimeOwnership?.targetEnemyId ??
        input?.action?.targetId ??
        null);
  const failureReason = !expected
    ? 'track-unknown'
    : !targetId
      ? 'target-missing'
      : !input?.stateBefore?.[expected.readMetric]
        ? 'read-state-missing'
        : !Number.isFinite(output?.delta)
          ? 'delta-invalid'
          : null;
  const ready = !failureReason;
  return {
    contractName: THREE_VALUE_STATE_EFFECT_PROPOSAL_CONTRACT_NAME,
    contractVersion: THREE_VALUE_STATE_EFFECT_PROPOSAL_CONTRACT_VERSION,
    status: ready ? 'state-effect-proposal-ready' : 'state-effect-proposal-invalid',
    ready,
    failureReason,
    sourceStepKey: output?.mechanicsEvaluation?.stateEffectStepKey ?? null,
    trackKey: input?.trackKey ?? null,
    readMetric: expected?.readMetric ?? null,
    writeMetric: expected?.writeMetric ?? null,
    targetKind: expected?.target === 'energyOwner' ? 'actor' : 'enemy',
    targetId,
    applyMode: expected?.applyMode ?? null,
    delta: normalizeRuntimeCalculatorNumber(output?.delta),
    hitKey: input?.hit?.hitKey ?? null,
    frameIndex: normalizeRuntimeCalculatorNumber(input?.hit?.frameIndex),
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
  const mechanicsEvaluation = result?.mechanicsEvaluation ?? null;
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
    calculatedFromLayerInputs:
      result?.calculatedFromLayerInputs === true,
    mechanicsEvaluation,
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
