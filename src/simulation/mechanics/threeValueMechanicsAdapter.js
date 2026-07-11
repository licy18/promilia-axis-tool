export const THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_NAME =
  'AzPrThreeValueMechanicsAdapter';

export const THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_VERSION = 1;

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
          return {
            delta: input.sourceValue.value,
            status: 'runtime-calculator-passthrough-generation-result',
            sourceKind: 'generation-calculator-result',
          };
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
  sourceValue,
} = {}) {
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
    sourceValue: sourceValue ?? null,
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
  const sourceValue = request?.sourceValue ?? {
    value: normalizeMechanicsNumber(delta.delta) ?? 0,
    hpDelta: normalizeNullableMechanicsNumber(delta.hpDelta),
    toughnessDelta: normalizeNullableMechanicsNumber(delta.toughnessDelta),
    energyDelta: normalizeNullableMechanicsNumber(delta.energyDelta),
    sourceKind: delta.sourceKind ?? null,
    sourceIds: delta.sourceIds ?? null,
    confidence: delta.confidence ?? null,
    status: delta.calculationStatus ?? delta.calculator?.status ?? null,
  };

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
      return {
        delta: input.sourceValue.value,
        status: 'runtime-calculator-passthrough-generation-result',
      };
    },
  };
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
