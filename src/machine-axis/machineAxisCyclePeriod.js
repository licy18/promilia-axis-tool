import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization';

export const MACHINE_AXIS_EVENTUAL_PERIOD_POLICY =
  'eventual-periodic-operation-and-metrics-v1';

export function findEventualPeriodicSequenceCandidates(
  values = [],
  {
    minimumRepeats = 3,
    maxPeriodCycles = 4,
    signature = value => hashCanonicalValue(value),
  } = {}
) {
  if (!Array.isArray(values)) {
    throw new TypeError('Periodic sequence values must be an array');
  }
  if (typeof signature !== 'function') {
    throw new TypeError('Periodic sequence signature must be a function');
  }
  const requiredRepeats = positiveInteger(minimumRepeats, 3);
  const periodLimit = Math.min(
    positiveInteger(maxPeriodCycles, 4),
    Math.floor(values.length / requiredRepeats)
  );
  if (periodLimit < 1) return [];

  const signatures = values.map((value, index) =>
    String(signature(value, index))
  );
  const candidates = [];
  for (
    let transientCycleCount = 0;
    transientCycleCount < values.length;
    transientCycleCount += 1
  ) {
    for (let periodCycles = 1; periodCycles <= periodLimit; periodCycles += 1) {
      const stableCycleCount = values.length - transientCycleCount;
      const repeatedCycleCount = Math.floor(stableCycleCount / periodCycles);
      if (repeatedCycleCount < requiredRepeats) continue;
      let stable = true;
      for (
        let index = transientCycleCount + periodCycles;
        index < values.length;
        index += 1
      ) {
        const periodIndex =
          transientCycleCount + ((index - transientCycleCount) % periodCycles);
        if (signatures[index] !== signatures[periodIndex]) {
          stable = false;
          break;
        }
      }
      if (!stable) continue;
      candidates.push({
        policy: MACHINE_AXIS_EVENTUAL_PERIOD_POLICY,
        transientCycleCount,
        stableCycleCount,
        periodCycles,
        repeatedCycleCount,
        minimumRepeats: requiredRepeats,
        periodValues: values.slice(
          transientCycleCount,
          transientCycleCount + periodCycles
        ),
        periodSignatures: signatures.slice(
          transientCycleCount,
          transientCycleCount + periodCycles
        ),
      });
    }
  }
  return candidates.sort(
    (left, right) =>
      left.transientCycleCount - right.transientCycleCount ||
      left.periodCycles - right.periodCycles
  );
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}
