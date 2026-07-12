export const THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_NAME =
  'AzPrThreeValueMechanicsAdapter';

export const THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_VERSION = 9;

export const THREE_VALUE_MECHANICS_EVALUATION_CONTRACT_NAME =
  'AzPrThreeValueMechanicsEvaluation';

export const THREE_VALUE_MECHANICS_EVALUATION_CONTRACT_VERSION = 5;

export const THREE_VALUE_MECHANICS_OPERANDS_CONTRACT_NAME =
  'AzPrThreeValueMechanicsOperands';

export const THREE_VALUE_MECHANICS_OPERANDS_CONTRACT_VERSION = 3;

export const THREE_VALUE_MECHANICS_TRACK_DEFINITIONS = {
  enemyHpDamage: {
    outputField: 'hpDelta',
  },
  enemyToughnessDamage: {
    outputField: 'toughnessDelta',
  },
  selfEnergyChange: {
    outputField: 'energyDelta',
  },
};

const DEFAULT_THREE_VALUE_MECHANICS_OPERATION_HANDLERS = {
  'round-clamped-product': calculateProductOperation,
  sum: calculateSumOperation,
  'before-minus-after': calculateBeforeMinusAfterOperation,
  'after-minus-before': calculateAfterMinusBeforeOperation,
  identity: calculateIdentityOperation,
};

export function createThreeValueMechanicsAdapterRegistry(
  adaptersByTrack = {},
  operationHandlers = {}
) {
  const existingRegistry =
    adaptersByTrack?.contractName ===
    THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_NAME;
  const registrations = existingRegistry
    ? (adaptersByTrack.adaptersByTrack ?? {})
    : (adaptersByTrack ?? {});
  const handlers = existingRegistry
    ? (adaptersByTrack.operationHandlers ?? {})
    : operationHandlers;

  return {
    schemaVersion: 1,
    contractName: THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_NAME,
    contractVersion: THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_VERSION,
    adaptersByTrack: { ...registrations },
    operationHandlers: { ...handlers },
    registrationKeys: uniqueStrings(Object.keys(registrations)),
  };
}

export function registerThreeValueMechanicsAdapter(
  registry,
  trackKey,
  adapter
) {
  const current = createThreeValueMechanicsAdapterRegistry(registry);
  return createThreeValueMechanicsAdapterRegistry(
    {
      ...current.adaptersByTrack,
      [trackKey]: adapter,
    },
    current.operationHandlers
  );
}

export function registerThreeValueMechanicsOperationHandler(
  registry,
  operation,
  handler
) {
  const current = createThreeValueMechanicsAdapterRegistry(registry);
  return createThreeValueMechanicsAdapterRegistry(current.adaptersByTrack, {
    ...current.operationHandlers,
    [operation]: handler,
  });
}

export function createThreeValueMechanicsAdapterRequest({
  trackKey,
  outputField,
  action,
  hit,
  mechanismConfiguration,
  mechanicsProfile,
  mechanicsLayerInputs,
  sourceValue,
} = {}) {
  const normalizedSourceValue = normalizeMechanicsSourceValue({
    trackKey,
    sourceValue,
  });
  return {
    schemaVersion: 1,
    contractName: THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_NAME,
    contractVersion: THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_VERSION,
    trackKey: trackKey ?? null,
    outputField:
      outputField ??
      THREE_VALUE_MECHANICS_TRACK_DEFINITIONS[trackKey]?.outputField ??
      'delta',
    action: action ?? null,
    hit: hit ?? null,
    mechanismConfiguration: mechanismConfiguration ?? null,
    mechanicsProfile: mechanicsProfile ?? DEFAULT_THREE_VALUE_MECHANICS_PROFILE,
    mechanicsLayerInputs: mechanicsLayerInputs ?? null,
    sourceValue: normalizedSourceValue,
    stateBefore: null,
    bindingStatus: 'generation-inputs-bound-runtime-state-pending',
  };
}

export function createThreeValueMechanicsAdapterInput({
  delta = {},
  stateBefore = null,
} = {}) {
  const trackKey = delta.trackKey ?? null;
  const outputField =
    THREE_VALUE_MECHANICS_TRACK_DEFINITIONS[trackKey]?.outputField ?? 'delta';
  const request = delta.mechanicsAdapterRequest ?? null;
  const mechanismContext = delta.mechanismContext ?? null;
  const mechanicsProfile =
    request?.mechanicsProfile ??
    mechanismContext?.mechanicsProfile ??
    DEFAULT_THREE_VALUE_MECHANICS_PROFILE;
  const sourceValue = normalizeMechanicsSourceValue({
    trackKey,
    sourceValue: request?.sourceValue ?? {
      value: normalizeMechanicsNumber(delta.delta) ?? 0,
      hpDelta: normalizeNullableMechanicsNumber(delta.hpDelta),
      toughnessDelta: normalizeNullableMechanicsNumber(delta.toughnessDelta),
      energyDelta: normalizeNullableMechanicsNumber(delta.energyDelta),
      sourceKind: delta.sourceKind ?? null,
      sourceIds: delta.sourceIds ?? null,
      confidence: delta.confidence ?? null,
      status: delta.calculationStatus ?? delta.calculator?.status ?? null,
    },
  });
  const mechanicsLayerInputs = bindThreeValueMechanicsLayerInputsState(
    request?.mechanicsLayerInputs ??
      createThreeValueMechanicsLayerInputs({
        trackKey,
        mechanicsProfile,
        mechanismContext,
        sourceValue,
      }),
    stateBefore
  );

  return {
    schemaVersion: 1,
    contractName: THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_NAME,
    contractVersion: THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_VERSION,
    sourceDeltaId: delta.id ?? delta.sourceDeltaId ?? null,
    trackKey,
    outputField,
    action:
      request?.action ?? createFallbackActionInput({ delta, mechanismContext }),
    hit: request?.hit ?? createFallbackHitInput({ delta, mechanismContext }),
    mechanismConfiguration:
      request?.mechanismConfiguration ??
      mechanismContext?.configuration ??
      null,
    mechanicsProfile,
    mechanicsLayerInputs,
    sourceValue,
    stateBefore,
    bindingStatus: 'mechanics-adapter-input-ready',
    generationRequest: request,
    mechanismContext,
    generatedDelta: {
      delta: normalizeMechanicsNumber(sourceValue?.value ?? delta.delta) ?? 0,
      hpDelta: normalizeNullableMechanicsNumber(
        sourceValue?.hpDelta ?? delta.hpDelta
      ),
      toughnessDelta: normalizeNullableMechanicsNumber(
        sourceValue?.toughnessDelta ?? delta.toughnessDelta
      ),
      energyDelta: normalizeNullableMechanicsNumber(
        sourceValue?.energyDelta ?? delta.energyDelta
      ),
    },
    sourceCalculatorResult: delta.calculator ?? null,
    sourceDelta: delta,
  };
}

export function resolveThreeValueMechanicsAdapter({ registry, trackKey } = {}) {
  const normalizedRegistry = createThreeValueMechanicsAdapterRegistry(registry);
  const registration =
    normalizedRegistry.adaptersByTrack[trackKey] ??
    normalizedRegistry.adaptersByTrack.default;
  const outputField =
    THREE_VALUE_MECHANICS_TRACK_DEFINITIONS[trackKey]?.outputField ?? 'delta';
  const customAdapter = normalizeCustomAdapter({
    adapter: registration,
    trackKey,
    outputField,
  });

  return {
    registry: normalizedRegistry,
    adapter:
      customAdapter ??
      createDefaultThreeValueMechanicsAdapter({
        trackKey,
        outputField,
        operationHandlers: normalizedRegistry.operationHandlers,
      }),
    registrationKey: registration
      ? normalizedRegistry.adaptersByTrack[trackKey]
        ? trackKey
        : 'default'
      : 'built-in',
  };
}

export function createThreeValueMechanicsOperands({
  trackKey,
  sourceKind,
  value,
  formulaBreakdown,
  sampleValidation,
  sourceBinding = null,
} = {}) {
  const expectedDelta = normalizeMechanicsNumber(value);
  const hpOperandSourceBinding =
    trackKey === 'enemyHpDamage'
      ? (formulaBreakdown?.operandSourceBinding ?? null)
      : null;
  const base = {
    schemaVersion: THREE_VALUE_MECHANICS_OPERANDS_CONTRACT_VERSION,
    contractName: THREE_VALUE_MECHANICS_OPERANDS_CONTRACT_NAME,
    contractVersion: THREE_VALUE_MECHANICS_OPERANDS_CONTRACT_VERSION,
    trackKey: trackKey ?? null,
    sourceKind: sourceKind ?? null,
    expectedDelta,
  };

  if (trackKey === 'enemyHpDamage') {
    const baseAttack = normalizeMechanicsNumber(
      formulaBreakdown?.layers?.baseAttack?.value
    );
    const actionMultiplier = normalizeMechanicsNumber(
      formulaBreakdown?.layers?.actionMultiplier?.value
    );
    const sourceBindingValidation = validateThreeValueHpOperandSourceBinding({
      binding: hpOperandSourceBinding,
      baseAttack,
      actionMultiplier,
      expectedDelta,
    });
    if (baseAttack != null && actionMultiplier != null) {
      return {
        ...base,
        kind: 'hp-raw-preview-product',
        status: 'hp-raw-preview-operands-ready',
        ready: true,
        ...(hpOperandSourceBinding?.ready
          ? createSourceBindingFields(
              hpOperandSourceBinding,
              sourceBindingValidation
            )
          : createCompatibleUnboundSourceBindingFields(hpOperandSourceBinding)),
        inputs: {
          baseAttack,
          actionMultiplier,
          minimum: 0,
        },
      };
    }
  }

  if (trackKey === 'selfEnergyChange') {
    const eventDeltas = (
      formulaBreakdown?.layers?.explicitResourceDelta?.events ?? []
    )
      .map(event => normalizeMechanicsNumber(event.change))
      .filter(value => value != null);
    if (eventDeltas.length > 0) {
      const explicitSourceBinding =
        sourceBinding ??
        createExplicitSelfEnergySourceBinding({
          sourceKind,
          events: formulaBreakdown?.layers?.explicitResourceDelta?.events,
          expectedDelta,
        });
      const sourceBindingValidation = validateThreeValueAppliedSourceBinding({
        binding: explicitSourceBinding,
        trackKey,
        sourceKind,
        expectedDelta,
        eventDeltas,
      });
      return {
        ...base,
        kind: 'explicit-self-energy-event-sum',
        status: 'explicit-self-energy-operands-ready',
        ready: true,
        ...(sourceBinding || explicitSourceBinding.ready
          ? createSourceBindingFields(
              explicitSourceBinding,
              sourceBindingValidation
            )
          : createCompatibleUnboundSourceBindingFields(explicitSourceBinding)),
        inputs: { eventDeltas },
      };
    }
  }

  const before = normalizeMechanicsNumber(sampleValidation?.before);
  const after = normalizeMechanicsNumber(sampleValidation?.after);
  if (before != null && after != null) {
    const decrease = trackKey === 'enemyToughnessDamage';
    const sourceBindingValidation = validateThreeValueAppliedSourceBinding({
      binding: sourceBinding,
      trackKey,
      sourceKind,
      expectedDelta,
      before,
      after,
      reportedDelta: sampleValidation?.delta,
    });
    return {
      ...base,
      kind: decrease
        ? 'validated-toughness-before-after'
        : 'validated-self-energy-before-after',
      status: 'validated-runtime-sample-operands-ready',
      ready: true,
      ...createSourceBindingFields(sourceBinding, sourceBindingValidation),
      inputs: {
        before,
        after,
        reportedDelta: normalizeMechanicsNumber(sampleValidation?.delta),
      },
    };
  }

  return {
    ...base,
    kind: 'source-value-identity',
    status: Number.isFinite(expectedDelta)
      ? 'source-value-identity-operands-ready'
      : 'source-value-identity-operands-invalid',
    ready: Number.isFinite(expectedDelta),
    inputs: { value: expectedDelta },
  };
}

export function createThreeValueMechanicsEvaluation(
  input = {},
  operationHandlers = {}
) {
  const operands = input.sourceValue?.operands ?? {};
  const capabilityResolution = resolveThreeValueMechanicsProfileCapability({
    profile: input.mechanicsProfile,
    operands,
  });
  const steps = capabilityResolution.capability?.steps ?? [];
  const stateEffectResolution = resolveThreeValueStateEffectDeclaration(
    capabilityResolution.profile,
    capabilityResolution.capability,
    input.trackKey
  );
  const layerInputs = input.mechanicsLayerInputs ?? {};
  const sharedOperands = layerInputs.inputs?.operands?.value ?? {};
  const operandSourceBindingValidation = validateMechanicsOperandSourceBinding({
    operands,
    input,
    layerInputs,
  });
  const operandSourceBindingRequired = operands.sourceBindingRequired === true;
  const operandSourceBindingApplicable = [
    'hp-raw-preview-product',
    'explicit-self-energy-event-sum',
    'validated-toughness-before-after',
    'validated-self-energy-before-after',
  ].includes(operands.kind);
  const stepResults = [];
  let previousDelta = null;
  for (const step of steps) {
    const usedLayers = (step.layerKeys ?? []).map(layerKey =>
      createMechanicsEvaluationLayerInput(layerInputs, layerKey)
    );
    const allInputsReady = usedLayers.every(layer => layer.ready);
    const execution = invokeMechanicsOperationHandler(
      operationHandlers[step.operation] ??
        DEFAULT_THREE_VALUE_MECHANICS_OPERATION_HANDLERS[step.operation],
      {
        input,
        step,
        layerInputs,
        sharedOperands,
        previousDelta,
        getLayerValue: layerKey => getLayerInputValue(layerInputs, layerKey),
      },
      !capabilityResolution.ready
        ? 'step-capability-missing'
        : !allInputsReady
          ? 'step-input-missing'
          : null
    );
    stepResults.push({
      key: step.key,
      operation: step.operation,
      usedLayers,
      ...execution,
    });
    if (!execution.ready) break;
    previousDelta = execution.delta;
  }

  const ready = Boolean(
    capabilityResolution.ready &&
    stepResults.length === steps.length &&
    stepResults.every(step => step.ready) &&
    Number.isFinite(previousDelta)
  );
  const value = ready ? previousDelta : null;
  return {
    contractName: THREE_VALUE_MECHANICS_EVALUATION_CONTRACT_NAME,
    contractVersion: THREE_VALUE_MECHANICS_EVALUATION_CONTRACT_VERSION,
    delta: value,
    ready,
    status: ready
      ? operandSourceBindingRequired && !operandSourceBindingValidation.ready
        ? 'three-value-mechanics-evaluation-ready-with-operand-source-diagnostics'
        : 'three-value-mechanics-evaluation-ready'
      : 'three-value-mechanics-evaluation-invalid',
    stepResults,
    capabilityReady: capabilityResolution.ready,
    operandSourceBindingRequired,
    operandSourceBindingState: !operandSourceBindingApplicable
      ? 'not-applicable'
      : operandSourceBindingRequired
        ? operandSourceBindingValidation.ready
          ? 'bound-ready'
          : 'bound-drift'
        : 'compatible-unbound',
    operandSourceBindingKind: operands.sourceBindingKind ?? null,
    operandSourceBindingIdentity: operands.sourceBindingIdentity ?? null,
    operandSourceBindingReady: operandSourceBindingRequired
      ? operandSourceBindingValidation.ready
      : null,
    operandSourceBindingStatus: operandSourceBindingValidation.status,
    operandSourceBindingValidation,
    stateEffectStepKey: stateEffectResolution.ready
      ? stateEffectResolution.stepKey
      : null,
  };
}

function validateMechanicsOperandSourceBinding({
  operands,
  input,
  layerInputs,
}) {
  if (operands.kind === 'hp-raw-preview-product') {
    return validateThreeValueHpOperandSourceBinding({
      binding: operands.sourceBinding,
      action: input.action,
      baseAttack: layerInputs.inputs?.actorStats?.value?.attack,
      actionMultiplier: layerInputs.inputs?.actionMultiplier?.value,
      expectedDelta: operands.expectedDelta,
    });
  }
  if (
    operands.kind === 'explicit-self-energy-event-sum' ||
    operands.kind === 'validated-toughness-before-after' ||
    operands.kind === 'validated-self-energy-before-after'
  ) {
    return validateThreeValueAppliedSourceBinding({
      binding: operands.sourceBinding,
      trackKey: input.trackKey,
      sourceKind: operands.sourceKind,
      expectedDelta: operands.expectedDelta,
      eventDeltas: operands.inputs?.eventDeltas ?? null,
      before: operands.inputs?.before,
      after: operands.inputs?.after,
      reportedDelta: operands.inputs?.reportedDelta,
      sourceIds: input.sourceValue?.sourceIds,
      action: input.action,
      hit: input.hit,
    });
  }
  return {
    required: false,
    ready: false,
    status: 'applied-source-binding-not-applicable',
    kind: null,
    identity: null,
    issueCodes: [],
    issues: [],
  };
}

function createSourceBindingFields(binding, validation) {
  return {
    sourceBindingRequired: Boolean(binding),
    sourceBindingReady: binding ? validation.ready : null,
    sourceBindingStatus: validation.status,
    sourceBindingKind:
      binding?.kind ??
      (binding?.skillVariantReference ? 'hp-skill-variant-operands' : null),
    sourceBindingIdentity:
      binding?.identity ?? binding?.skillVariantReference?.identity ?? null,
    sourceBinding: binding,
    sourceBindingValidation: validation,
  };
}

function createCompatibleUnboundSourceBindingFields(candidate) {
  return {
    sourceBindingRequired: false,
    sourceBindingReady: null,
    sourceBindingStatus: 'applied-source-binding-compatible-unbound',
    sourceBindingKind:
      candidate?.kind ??
      (candidate?.skillVariantReference ? 'hp-skill-variant-operands' : null),
    sourceBindingIdentity: null,
    sourceBinding: null,
    sourceBindingCandidate: candidate ?? null,
    sourceBindingValidation: {
      required: false,
      ready: false,
      status: 'applied-source-binding-compatible-unbound',
      kind: candidate?.kind ?? null,
      identity: null,
      issueCodes: candidate?.issueCodes ?? [],
      issues: candidate?.issues ?? [],
    },
  };
}

function createMechanicsEvaluationLayerInput(layerInputs, layerKey) {
  const inputKey = layerInputs.layers?.inputKeys?.[layerKey] ?? null;
  const layerInput = layerInputs.inputs?.[inputKey] ?? null;
  return {
    layerKey,
    inputKey,
    source: layerInput?.source ?? null,
    ready: layerInput?.ready === true,
  };
}

function invokeMechanicsOperationHandler(handler, context, blockedStatus) {
  if (blockedStatus) {
    return {
      delta: null,
      ready: false,
      status: blockedStatus,
    };
  }
  if (typeof handler !== 'function') {
    return {
      delta: null,
      ready: false,
      status: 'step-handler-missing',
    };
  }
  try {
    const result = handler(context);
    const delta = normalizeMechanicsNumber(
      typeof result === 'number' ? result : result?.delta
    );
    return {
      delta,
      ready: Number.isFinite(delta),
      status: Number.isFinite(delta) ? 'step-ready' : 'step-invalid',
    };
  } catch {
    return {
      delta: null,
      ready: false,
      status: 'step-handler-threw',
    };
  }
}

function calculateProductOperation({ getLayerValue, sharedOperands }) {
  const baseAttack = normalizeMechanicsNumber(
    getLayerValue('baseAttack')?.attack
  );
  const actionMultiplier = normalizeMechanicsNumber(
    getLayerValue('actionMultiplier')
  );
  const minimum = normalizeMechanicsNumber(sharedOperands.minimum) ?? 0;
  return baseAttack != null && actionMultiplier != null
    ? Math.max(minimum, Math.round(baseAttack * actionMultiplier))
    : null;
}

function calculateSumOperation({ sharedOperands }) {
  const eventDeltas = (sharedOperands.eventDeltas ?? [])
    .map(normalizeMechanicsNumber)
    .filter(value => value != null);
  return eventDeltas.length > 0
    ? eventDeltas.reduce((sum, value) => sum + value, 0)
    : null;
}

function calculateBeforeMinusAfterOperation({ sharedOperands }) {
  return calculateBeforeAfterOperation(sharedOperands, 'decrease');
}

function calculateAfterMinusBeforeOperation({ sharedOperands }) {
  return calculateBeforeAfterOperation(sharedOperands, 'increase');
}

function calculateBeforeAfterOperation(sharedOperands, direction) {
  return calculateBeforeAfterDelta(
    {
      before: normalizeMechanicsNumber(sharedOperands.before),
      after: normalizeMechanicsNumber(sharedOperands.after),
      reportedDelta: normalizeMechanicsNumber(sharedOperands.reportedDelta),
    },
    direction
  );
}

function calculateIdentityOperation({ sharedOperands }) {
  return normalizeMechanicsNumber(sharedOperands.value);
}

function normalizeCustomAdapter({ adapter, trackKey, outputField }) {
  if (typeof adapter === 'function') {
    return {
      key: `custom-${trackKey ?? 'unknown'}-runtime-calculator-adapter`,
      version: 1,
      outputField,
      sourceKind: 'custom-runtime-calculator-adapter',
      calculate: adapter,
      custom: true,
    };
  }
  if (!(adapter?.calculate instanceof Function)) {
    return null;
  }
  return {
    key:
      adapter.key ??
      `custom-${trackKey ?? 'unknown'}-runtime-calculator-adapter`,
    version: normalizeMechanicsNumber(adapter.version) ?? 1,
    outputField,
    sourceKind: adapter.sourceKind ?? 'custom-runtime-calculator-adapter',
    calculate: adapter.calculate,
    custom: true,
  };
}

function createDefaultThreeValueMechanicsAdapter({
  trackKey,
  outputField,
  operationHandlers,
}) {
  return {
    key: `azpr-${trackKey ?? 'unknown'}-runtime-passthrough-adapter`,
    version: 1,
    outputField,
    sourceKind: THREE_VALUE_MECHANICS_TRACK_DEFINITIONS[trackKey]
      ? 'default-runtime-passthrough-adapter'
      : 'fallback-runtime-passthrough-adapter',
    custom: false,
    calculate(input) {
      return calculateDefaultThreeValueMechanicsResult(
        input,
        operationHandlers
      );
    },
  };
}

function calculateDefaultThreeValueMechanicsResult(input, operationHandlers) {
  const evaluation = createThreeValueMechanicsEvaluation(
    input,
    operationHandlers
  );
  return {
    delta: evaluation.delta,
    status: evaluation.ready
      ? evaluation.operandSourceBindingRequired &&
        !evaluation.operandSourceBindingReady
        ? 'runtime-mechanics-evaluation-ready-with-operand-source-diagnostics'
        : 'runtime-mechanics-evaluation-ready'
      : 'runtime-mechanics-evaluation-invalid',
    sourceKind: 'three-value-mechanics-evaluation',
    mechanicsEvaluation: evaluation,
    calculatedFromLayerInputs: evaluation.ready,
  };
}

function normalizeMechanicsSourceValue({ trackKey, sourceValue }) {
  if (!sourceValue) {
    return null;
  }
  const value = normalizeMechanicsNumber(sourceValue.value);
  return {
    ...sourceValue,
    value,
    operands:
      sourceValue.operands ??
      createThreeValueMechanicsOperands({
        trackKey,
        sourceKind: sourceValue.sourceKind,
        value,
      }),
  };
}

function calculateBeforeAfterDelta(operands, direction) {
  const before = normalizeMechanicsNumber(operands.before);
  const after = normalizeMechanicsNumber(operands.after);
  if (before == null || after == null) {
    return null;
  }
  return normalizeMechanicsNumber(
    direction === 'decrease' ? before - after : after - before
  );
}

function getLayerInputValue(layerInputs, layerKey) {
  const inputKey = layerInputs.layers?.inputKeys?.[layerKey];
  return layerInputs.inputs?.[inputKey]?.value;
}

function createFallbackActionInput({ delta, mechanismContext }) {
  return {
    ...(mechanismContext?.action ?? {}),
    actionId: mechanismContext?.action?.actionId ?? delta.actionId ?? null,
    actionName: delta.actionName ?? null,
    actionType:
      mechanismContext?.action?.actionType ?? delta.actionType ?? null,
    actorId: mechanismContext?.action?.actorId ?? delta.actorId ?? null,
  };
}

function createFallbackHitInput({ delta, mechanismContext }) {
  return {
    ...(mechanismContext?.hit ?? {}),
    hitKey: mechanismContext?.hit?.hitKey ?? delta.hitKey ?? null,
    hitIndex: mechanismContext?.hit?.hitIndex ?? numberOrNull(delta.hitIndex),
    hitSkillId:
      mechanismContext?.hit?.hitSkillId ?? numberOrNull(delta.hitSkillId),
    frameIndex:
      mechanismContext?.hit?.frameIndex ?? numberOrNull(delta.frameIndex),
    timeMs: mechanismContext?.hit?.timeMs ?? numberOrNull(delta.timeMs),
  };
}

function normalizeNullableMechanicsNumber(value) {
  if (value == null || value === '') {
    return null;
  }
  return normalizeMechanicsNumber(value);
}

function normalizeMechanicsNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(6)) : null;
}

function numberOrNull(value) {
  if (value == null || value === '') {
    return null;
  }
  return normalizeMechanicsNumber(value);
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
import {
  DEFAULT_THREE_VALUE_MECHANICS_PROFILE,
  resolveThreeValueMechanicsProfileCapability,
  resolveThreeValueStateEffectDeclaration,
} from './threeValueMechanicsProfile';
import {
  bindThreeValueMechanicsLayerInputsState,
  createThreeValueMechanicsLayerInputs,
} from './threeValueMechanicsLayerInputs';
import { validateThreeValueHpOperandSourceBinding } from './threeValueHpOperandSourceBinding';
import {
  createExplicitSelfEnergySourceBinding,
  validateThreeValueAppliedSourceBinding,
} from './threeValueAppliedSourceBinding';
