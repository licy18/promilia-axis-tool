export function numberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function positiveIntegerOrNull(value) {
  const number = numberOrNull(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export function nonNegativeIntegerOrNull(value) {
  const number = numberOrNull(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

export function textOrNull(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

export function numbersMatch(left, right, tolerance = 1e-9) {
  const leftNumber = numberOrNull(left);
  const rightNumber = numberOrNull(right);
  return (
    leftNumber != null &&
    rightNumber != null &&
    Math.abs(leftNumber - rightNumber) <= tolerance
  );
}

export function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export function stableHash(value) {
  const text = String(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createSkillVariantSourceIdentity(source = {}) {
  const values = [
    textOrNull(source?.kind),
    textOrNull(source?.path),
    positiveIntegerOrNull(source?.skillId),
    positiveIntegerOrNull(source?.characterId),
    positiveIntegerOrNull(source?.level),
    nonNegativeIntegerOrNull(source?.levelIndex),
    textOrNull(source?.labelField),
    textOrNull(source?.valueField),
  ];
  return values.some(value => value != null)
    ? `azpr-skill-variant-source-v1-${stableHash(JSON.stringify(values))}`
    : null;
}

export function createCodeDiagnostics(issueCodes = []) {
  return {
    issueCodes: [...issueCodes],
    issues: issueCodes.map(code => ({ code })),
  };
}
