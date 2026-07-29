export const CANONICAL_HASH_ALGORITHM = 'fnv1a64-utf8-v1';

export function canonicalizeValue(value) {
  return canonicalize(value, new WeakSet());
}

export function stableStringify(value) {
  return JSON.stringify(canonicalizeValue(value));
}

export function hashCanonicalValue(value) {
  const bytes = new TextEncoder().encode(stableStringify(value));
  let hash = 0xcbf29ce484222325n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

function canonicalize(value, ancestors) {
  if (
    value == null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return { $number: 'NaN' };
    if (value === Number.POSITIVE_INFINITY) return { $number: 'Infinity' };
    if (value === Number.NEGATIVE_INFINITY) return { $number: '-Infinity' };
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value === 'bigint') return { $bigint: value.toString() };
  if (typeof value === 'undefined') return { $undefined: true };
  if (typeof value === 'function' || typeof value === 'symbol') {
    return { $unsupported: typeof value };
  }
  if (value instanceof Date) return { $date: value.toISOString() };
  if (ancestors.has(value)) {
    throw new TypeError('Canonical values cannot contain circular references');
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map(entry => canonicalize(entry, ancestors));
    }
    if (value instanceof Map) {
      return {
        $map: [...value.entries()]
          .map(([key, entry]) => [
            canonicalize(key, ancestors),
            canonicalize(entry, ancestors),
          ])
          .sort((left, right) =>
            stableStringify(left[0]).localeCompare(
              stableStringify(right[0]),
              'en'
            )
          ),
      };
    }
    if (value instanceof Set) {
      return {
        $set: [...value]
          .map(entry => canonicalize(entry, ancestors))
          .sort((left, right) =>
            stableStringify(left).localeCompare(stableStringify(right), 'en')
          ),
      };
    }

    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right, 'en'))
        .filter(key => value[key] !== undefined)
        .map(key => [key, canonicalize(value[key], ancestors)])
    );
  } finally {
    ancestors.delete(value);
  }
}
