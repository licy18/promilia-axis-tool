import { compareThreeValueGenerationDeltas } from '../generation/threeValueGenerationLayer';

const STANDARD_THREE_VALUE_CONTRACT_NAME = 'Action -> Hit -> ThreeValueDelta';

export function createThreeValueRuntimeInput({ threeValueGenerationLayer }) {
  const inputDeltas = [...(threeValueGenerationLayer?.deltas ?? [])].sort(
    compareThreeValueGenerationDeltas
  );
  const appliedDeltas = inputDeltas
    .filter(delta => delta?.applied)
    .map((delta, index) => normalizeRuntimeInputDelta(delta, index));
  const ignoredDeltas = inputDeltas.filter(delta => !delta?.applied);
  const contractName =
    threeValueGenerationLayer?.contract?.name ??
    threeValueGenerationLayer?.summary?.contractName ??
    STANDARD_THREE_VALUE_CONTRACT_NAME;
  const summary = summarizeThreeValueRuntimeInput({
    contractName,
    inputDeltas,
    appliedDeltas,
    ignoredDeltas,
  });

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-runtime-input-from-three-value-generation-layer',
    status:
      appliedDeltas.length > 0
        ? 'runtime-input-ready-with-applied-deltas'
        : 'runtime-input-ready-no-applied-deltas',
    contractName,
    inputSourceKind:
      threeValueGenerationLayer?.sourceKind ??
      'azpr-standard-three-value-generation-layer',
    inputStatus: threeValueGenerationLayer?.status ?? null,
    appliedOnly: true,
    deltas: appliedDeltas,
    appliedDeltas,
    ignoredDeltaCount: ignoredDeltas.length,
    summary,
    applied: true,
  };
}

function normalizeRuntimeInputDelta(delta, runtimeSequenceIndex) {
  return {
    ...delta,
    runtimeSequenceIndex,
    delta: normalizeRuntimeInputNumber(delta.delta),
    hpDelta: normalizeRuntimeInputNumber(delta.hpDelta),
    toughnessDelta: normalizeRuntimeInputNumber(delta.toughnessDelta),
    energyDelta: normalizeRuntimeInputNumber(delta.energyDelta),
    applied: true,
  };
}

function summarizeThreeValueRuntimeInput({
  contractName,
  inputDeltas,
  appliedDeltas,
  ignoredDeltas,
}) {
  const ignoredLayerCounts = countByKey(
    ignoredDeltas,
    delta => delta?.layerKey ?? 'unknown'
  );
  return {
    contractName,
    inputDeltaCount: inputDeltas.length,
    appliedDeltaCount: appliedDeltas.length,
    ignoredDeltaCount: ignoredDeltas.length,
    appliedTrackKeys: uniqueStrings(appliedDeltas.map(delta => delta.trackKey)),
    appliedLayerKeys: uniqueStrings(appliedDeltas.map(delta => delta.layerKey)),
    ignoredLayerCounts,
    appliedOnly: true,
    applied: true,
  };
}

function countByKey(items, getKey) {
  const counts = new Map();
  for (const item of items) {
    const key = String(getKey(item) ?? 'unknown');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => left.key.localeCompare(right.key));
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

function normalizeRuntimeInputNumber(value) {
  if (value == null || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(6)) : null;
}
