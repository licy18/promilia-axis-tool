export const ACTION_VARIANT_INPUT_SELECTION_SCHEMA_VERSION = 1;

export function normalizeActionVariantInputSelection(value = null) {
  if (!value || typeof value !== 'object') return null;
  const selectorIdentity = textOrNull(value.selectorIdentity);
  const inputFrame = nonNegativeIntegerOrNull(
    value.inputFrame ?? value.releaseFrame
  );
  const mode = normalizeInputMode(value.mode);
  if (!selectorIdentity && !(mode === 'release' && inputFrame != null)) {
    return null;
  }
  return {
    schemaVersion: ACTION_VARIANT_INPUT_SELECTION_SCHEMA_VERSION,
    selectorIdentity,
    selectorKind: textOrNull(value.selectorKind),
    publicVariantIndex: nonNegativeIntegerOrNull(value.publicVariantIndex),
    chargeTier: positiveIntegerOrNull(value.chargeTier),
    inputFrame,
    mode,
  };
}

export function createActionVariantInputSelection({ selector, option } = {}) {
  return normalizeActionVariantInputSelection({
    selectorIdentity: option?.selectorIdentity,
    selectorKind: selector?.kind,
    publicVariantIndex: option?.publicVariantIndex,
    chargeTier: option?.chargeTier,
    inputFrame: option?.inputFrame,
    mode: selector?.mode,
  });
}

export function resolveActionVariantInputOption(contract, selection) {
  const normalized = normalizeActionVariantInputSelection(selection);
  if (!contract?.inputSelector || !normalized) return null;
  return (
    contract.inputSelector.options?.find(
      option => option.selectorIdentity === normalized.selectorIdentity
    ) ?? null
  );
}

function normalizeInputMode(value) {
  return ['press', 'hold', 'release'].includes(value) ? value : null;
}

function textOrNull(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function nonNegativeIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
