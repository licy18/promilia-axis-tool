export const THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_NAME =
  'AzPrThreeValueMechanicsAdapter';

export const THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_VERSION = 3;

export const THREE_VALUE_MECHANICS_OPERANDS_CONTRACT_NAME =
  'AzPrThreeValueMechanicsOperands';

export const THREE_VALUE_MECHANICS_OPERANDS_CONTRACT_VERSION = 1;

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

const DEFAULT_THREE_VALUE_MECHANICS_ADAPTERS = Object.fromEntries(
  Object.entries(THREE_VALUE_MECHANICS_TRACK_DEFINITIONS).map(
    ([trackKey, definition]) => [
      trackKey,
      {
        key: `azpr-${trackKey}-runtime-passthrough-adapter`,
        version: 1,
        outputField: definition.outputField,
        sourceKind: 'default-runtime-passthrough-adapter',
        custom: false,
        calculate(input) {
          return calculateDefaultThreeValueMechanicsResult(input);
        },
      },
    ]
  )
);

export function createThreeValueMechanicsAdapterRegistry(adaptersByTrack = {}) {
  const registrations =
    adaptersByTrack?.contractName ===
    THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_NAME
      ? (adaptersByTrack.adaptersByTrack ?? {})
      : (adaptersByTrack ?? {});

  return {
    schemaVersion: 1,
    contractName: THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_NAME,
    contractVersion: THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_VERSION,
    adaptersByTrack: { ...registrations },
    registrationKeys: uniqueStrings(Object.keys(registrations)),
  };
}

export function registerThreeValueMechanicsAdapter(
  registry,
  trackKey,
  adapter
) {
  const current = createThreeValueMechanicsAdapterRegistry(registry);
  return createThreeValueMechanicsAdapterRegistry({
    ...current.adaptersByTrack,
    [trackKey]: adapter,
  });
}

export function createThreeValueMechanicsAdapterRequest({
  trackKey,
  outputField,
  action,
  hit,
  mechanismConfiguration,
  mechanicsProfile,
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

export function resolveThreeValueMechanicsAdapter({
  registry,
  trackKey,
  legacyAdapters = {},
} = {}) {
  const normalizedRegistry = createThreeValueMechanicsAdapterRegistry(
    registry ?? legacyAdapters
  );
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
      DEFAULT_THREE_VALUE_MECHANICS_ADAPTERS[trackKey] ??
      createFallbackThreeValueMechanicsAdapter({ trackKey, outputField }),
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
} = {}) {
  const expectedDelta = normalizeMechanicsNumber(value);
  const base = {
    schemaVersion: 1,
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
    if (baseAttack != null && actionMultiplier != null) {
      return {
        ...base,
        kind: 'hp-raw-preview-product',
        operation: 'round-clamped-product',
        status: 'hp-raw-preview-operands-ready',
        ready: true,
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
      return {
        ...base,
        kind: 'explicit-self-energy-event-sum',
        operation: 'sum',
        status: 'explicit-self-energy-operands-ready',
        ready: true,
        inputs: { eventDeltas },
      };
    }
  }

  const before = normalizeMechanicsNumber(sampleValidation?.before);
  const after = normalizeMechanicsNumber(sampleValidation?.after);
  if (before != null && after != null) {
    const decrease = trackKey === 'enemyToughnessDamage';
    return {
      ...base,
      kind: decrease
        ? 'validated-toughness-before-after'
        : 'validated-self-energy-before-after',
      operation: decrease ? 'before-minus-after' : 'after-minus-before',
      status: 'validated-runtime-sample-operands-ready',
      ready: true,
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
    operation: 'identity',
    status: Number.isFinite(expectedDelta)
      ? 'source-value-identity-operands-ready'
      : 'source-value-identity-operands-invalid',
    ready: Number.isFinite(expectedDelta),
    inputs: { value: expectedDelta },
  };
}

export function calculateThreeValueMechanicsOperands(
  operands = {},
  mechanicsProfile
) {
  const capabilityResolution = resolveThreeValueMechanicsProfileCapability({
    profile: mechanicsProfile,
    operands,
  });
  const operation = capabilityResolution.capability?.operation ?? null;
  let value = null;
  if (capabilityResolution.ready && operation === 'round-clamped-product') {
    const baseAttack = normalizeMechanicsNumber(operands.inputs?.baseAttack);
    const actionMultiplier = normalizeMechanicsNumber(
      operands.inputs?.actionMultiplier
    );
    const minimum = normalizeMechanicsNumber(operands.inputs?.minimum) ?? 0;
    if (baseAttack != null && actionMultiplier != null) {
      value = Math.max(minimum, Math.round(baseAttack * actionMultiplier));
    }
  } else if (capabilityResolution.ready && operation === 'sum') {
    const eventDeltas = (operands.inputs?.eventDeltas ?? [])
      .map(normalizeMechanicsNumber)
      .filter(item => item != null);
    if (eventDeltas.length > 0) {
      value = roundMechanicsNumber(
        eventDeltas.reduce((sum, item) => sum + item, 0)
      );
    }
  } else if (capabilityResolution.ready && operation === 'before-minus-after') {
    value = calculateBeforeAfterDelta(operands, 'decrease');
  } else if (capabilityResolution.ready && operation === 'after-minus-before') {
    value = calculateBeforeAfterDelta(operands, 'increase');
  } else if (capabilityResolution.ready && operation === 'identity') {
    value = normalizeMechanicsNumber(operands.inputs?.value);
  }

  const expectedDelta = normalizeMechanicsNumber(operands.expectedDelta);
  const ready = Number.isFinite(value);
  return {
    value,
    ready,
    status: ready
      ? 'three-value-mechanics-operands-calculated'
      : 'three-value-mechanics-operands-invalid',
    operandsKind: operands.kind ?? null,
    operation,
    profileId: capabilityResolution.profile.profileId,
    profileVersion: capabilityResolution.profile.profileVersion,
    profileStatus: capabilityResolution.profile.status,
    profileFallback: capabilityResolution.profileResolution.fallback,
    capabilityStatus: capabilityResolution.status,
    capabilityApplied: capabilityResolution.capability?.applied === true,
    capabilityFallbackReason: capabilityResolution.fallbackReason,
    expectedDelta,
    matchesExpected:
      ready && expectedDelta != null
        ? numbersMatch(value, expectedDelta)
        : null,
  };
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

function createFallbackThreeValueMechanicsAdapter({ trackKey, outputField }) {
  return {
    key: `azpr-${trackKey ?? 'unknown'}-runtime-passthrough-adapter`,
    version: 1,
    outputField,
    sourceKind: 'fallback-runtime-passthrough-adapter',
    custom: false,
    calculate(input) {
      return calculateDefaultThreeValueMechanicsResult(input);
    },
  };
}

function calculateDefaultThreeValueMechanicsResult(input) {
  const calculation = calculateThreeValueMechanicsOperands(
    input.sourceValue?.operands,
    input.mechanicsProfile
  );
  return {
    delta: calculation.value,
    status: calculation.ready
      ? 'runtime-mechanics-operands-calculated'
      : 'runtime-mechanics-operands-invalid',
    sourceKind: 'three-value-mechanics-operands',
    operandsKind: calculation.operandsKind,
    operandsStatus: calculation.status,
    calculatedFromOperands: calculation.ready,
    operandsMatchSource: calculation.matchesExpected,
    mechanicsProfileId: calculation.profileId,
    mechanicsProfileVersion: calculation.profileVersion,
    mechanicsProfileStatus: calculation.profileStatus,
    mechanicsProfileFallback: calculation.profileFallback,
    mechanicsProfileCapabilityStatus: calculation.capabilityStatus,
    mechanicsProfileCapabilityApplied: calculation.capabilityApplied,
    mechanicsProfileCapabilityFallbackReason:
      calculation.capabilityFallbackReason,
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
  const before = normalizeMechanicsNumber(operands.inputs?.before);
  const after = normalizeMechanicsNumber(operands.inputs?.after);
  if (before == null || after == null) {
    return null;
  }
  return roundMechanicsNumber(
    direction === 'decrease' ? before - after : after - before
  );
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

function roundMechanicsNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(6)) : null;
}

function numbersMatch(left, right) {
  return Math.abs(left - right) <= 0.000001;
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
} from './threeValueMechanicsProfile';
