export const ACTION_COOLDOWN_EVALUATION_CONTRACT_NAME =
  'AzPrActionCooldownEvaluation';
export const ACTION_COOLDOWN_EVALUATION_CONTRACT_VERSION = 1;
export const ACTION_COOLDOWN_EVALUATION_ADAPTER_CONTRACT_NAME =
  'AzPrActionCooldownEvaluationAdapter';
export const ACTION_COOLDOWN_EVALUATION_ADAPTER_CONTRACT_VERSION = 1;

export function createActionCooldownEvaluation({
  action,
  ownerKind,
  ownerId,
  baseCooldown,
  scenario = null,
  priorCooldownWindows = [],
  adapter = null,
} = {}) {
  const normalizedBase = normalizeBaseCooldown(baseCooldown);
  if (!normalizedBase) {
    return null;
  }

  const adapterEntry = normalizeCooldownAdapter(adapter);
  const request = createActionCooldownAdapterRequest({
    action,
    ownerKind,
    ownerId,
    baseCooldown: normalizedBase,
    scenario,
    priorCooldownWindows,
  });
  let rawResult = null;
  let adapterError = null;
  if (adapterEntry) {
    try {
      rawResult = adapterEntry.evaluate(request);
    } catch (error) {
      adapterError = error;
    }
  }
  const adapterResult = normalizeAdapterResult(rawResult, normalizedBase);
  const effectiveDurationMs =
    adapterResult?.effectiveDurationMs ?? normalizedBase.durationMs;
  const effectiveChargeCount =
    adapterResult?.effectiveChargeCount ?? normalizedBase.chargeCount;
  const modifiers = adapterResult?.modifiers ?? [];
  const changed =
    effectiveDurationMs !== normalizedBase.durationMs ||
    effectiveChargeCount !== normalizedBase.chargeCount ||
    modifiers.length > 0;

  return {
    schemaVersion: 1,
    contractName: ACTION_COOLDOWN_EVALUATION_CONTRACT_NAME,
    contractVersion: ACTION_COOLDOWN_EVALUATION_CONTRACT_VERSION,
    status: !adapterEntry
      ? 'cooldown-evaluation-base-only'
      : adapterResult
        ? changed
          ? 'cooldown-evaluation-adapted'
          : 'cooldown-evaluation-adapter-passthrough'
        : 'cooldown-evaluation-adapter-fallback',
    actionId: action?.id ?? null,
    skillId: positiveIntegerOrNull(action?.skillId),
    ownerKind: ownerKind ?? null,
    ownerId: ownerId ?? null,
    evaluatedAtMs: nonNegativeNumber(action?.startMs) ?? 0,
    base: normalizedBase,
    effective: {
      durationMs: effectiveDurationMs,
      chargeCount: effectiveChargeCount,
    },
    modifiers,
    appliedModifierCount: modifiers.length,
    adapterIdentity: adapterEntry
      ? {
          contractName:
            adapterEntry.contractName ??
            ACTION_COOLDOWN_EVALUATION_ADAPTER_CONTRACT_NAME,
          contractVersion:
            adapterEntry.contractVersion ??
            ACTION_COOLDOWN_EVALUATION_ADAPTER_CONTRACT_VERSION,
          adapterId: adapterResult?.adapterId ?? adapterEntry.adapterId ?? null,
          sourceStatus: adapterResult?.sourceStatus ?? null,
        }
      : null,
    adapterFallbackReason: adapterError
      ? 'adapter-threw'
      : adapterEntry && !adapterResult
        ? 'adapter-result-invalid'
        : null,
  };
}

export function createActionCooldownAdapterRequest({
  action,
  ownerKind,
  ownerId,
  baseCooldown,
  scenario,
  priorCooldownWindows = [],
} = {}) {
  return {
    schemaVersion: 1,
    contractName: ACTION_COOLDOWN_EVALUATION_ADAPTER_CONTRACT_NAME,
    contractVersion: ACTION_COOLDOWN_EVALUATION_ADAPTER_CONTRACT_VERSION,
    action: action ?? null,
    actionId: action?.id ?? null,
    skillId: positiveIntegerOrNull(action?.skillId),
    owner: {
      kind: ownerKind ?? null,
      id: ownerId ?? null,
    },
    evaluatedAtMs: nonNegativeNumber(action?.startMs) ?? 0,
    baseCooldown: { ...baseCooldown },
    context: {
      scenario: scenario ?? null,
      priorCooldownWindows: [...priorCooldownWindows],
      processedActionIds: uniqueValues(
        priorCooldownWindows.map(window => window?.actionId)
      ),
      runtimeEffectState: null,
      runtimeEffectStateStatus: 'not-bound-currently',
    },
  };
}

function normalizeCooldownAdapter(adapter) {
  if (typeof adapter === 'function') {
    return {
      evaluate: adapter,
      contractName: ACTION_COOLDOWN_EVALUATION_ADAPTER_CONTRACT_NAME,
      contractVersion: ACTION_COOLDOWN_EVALUATION_ADAPTER_CONTRACT_VERSION,
      adapterId: null,
    };
  }
  if (typeof adapter?.evaluate !== 'function') {
    return null;
  }
  return {
    evaluate: request => adapter.evaluate(request),
    contractName: adapter.contractName,
    contractVersion: adapter.contractVersion,
    adapterId: adapter.adapterId ?? adapter.id ?? null,
  };
}

function normalizeBaseCooldown(baseCooldown) {
  const durationMs = positiveNumber(baseCooldown?.cooldownMs);
  if (durationMs == null) {
    return null;
  }
  return {
    durationMs,
    chargeCount: positiveInteger(baseCooldown?.cooldownCount, 1),
    source: cloneObject(baseCooldown?.source),
    sourceIdentity: cloneObject(baseCooldown?.sourceIdentity),
    confidence: baseCooldown?.confidence ?? null,
  };
}

function normalizeAdapterResult(result, baseCooldown) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return null;
  }
  const effectiveDurationMs =
    positiveNumber(result.effectiveDurationMs ?? result.durationMs) ??
    baseCooldown.durationMs;
  const effectiveChargeCount = positiveInteger(
    result.effectiveChargeCount ?? result.chargeCount,
    baseCooldown.chargeCount
  );
  return {
    effectiveDurationMs,
    effectiveChargeCount,
    modifiers: (Array.isArray(result.modifiers) ? result.modifiers : [])
      .map(modifier => cloneObject(modifier))
      .filter(Boolean),
    adapterId: result.adapterIdentity?.adapterId ?? result.adapterId ?? null,
    sourceStatus: result.sourceStatus ?? null,
  };
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function nonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function positiveInteger(value, fallback = null) {
  const number = Math.trunc(Number(value));
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function positiveIntegerOrNull(value) {
  return positiveInteger(value, null);
}

function cloneObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...value }
    : null;
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}
