import { CRITICAL_RANDOM_ALGORITHM } from '../../domain/combatCriticalPolicy';

export function createDeterministicCriticalRandomSource({ seed } = {}) {
  if (seed == null || seed === '') {
    throw new TypeError(
      'A deterministic critical random source requires a seed'
    );
  }
  let state = mixTextToUint32(String(seed)) || 0x6d2b79f5;
  let streamIndex = 0;

  const source = {
    algorithm: CRITICAL_RANDOM_ALGORITHM,
    seed,
    nextSample(maxExclusive = 10_000, context = {}) {
      const maximum = normalizeMaximum(maxExclusive);
      state = xorshift32(state);
      const sample = Object.freeze({
        value: state % maximum,
        streamIndex,
        sampleKey: createCriticalSampleKey(context),
      });
      streamIndex += 1;
      return sample;
    },
    nextInt(maxExclusive = 10_000, context = {}) {
      return source.nextSample(maxExclusive, context).value;
    },
  };
  return Object.freeze(source);
}

export function createCriticalSampleKey({
  actionId = '',
  hitIdentity = '',
  hitIndex = '',
  elementId = '',
  timeMs = '',
} = {}) {
  return [actionId, hitIdentity, hitIndex, elementId, timeMs].join('|');
}

function normalizeMaximum(value) {
  const maximum = Math.trunc(Number(value));
  if (!Number.isInteger(maximum) || maximum <= 0) {
    throw new RangeError('maxExclusive must be a positive integer');
  }
  return maximum;
}

function mixTextToUint32(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return avalanche32(hash);
}

function xorshift32(value) {
  let result = value >>> 0;
  result ^= result << 13;
  result ^= result >>> 17;
  result ^= result << 5;
  return result >>> 0;
}

function avalanche32(value) {
  let result = value >>> 0;
  result ^= result >>> 16;
  result = Math.imul(result, 0x7feb352d) >>> 0;
  result ^= result >>> 15;
  result = Math.imul(result, 0x846ca68b) >>> 0;
  result ^= result >>> 16;
  return result >>> 0;
}
