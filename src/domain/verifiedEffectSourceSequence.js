import { getActionSourceSequencePath } from './actionSourceSequence.js';

export const VERIFIED_EFFECT_SOURCE_SEQUENCE_CONTRACT_NAME =
  'AzPrVerifiedEffectSourceSequence';

const EFFECT_SOURCE_NAMESPACE = 20;
const EFFECT_PHASE_INDEX = Object.freeze({
  before: 0,
  settlement: 1,
  after: 2,
});

export function createVerifiedEffectSourceSequencePath({
  action,
  effect,
  phase = 'settlement',
  localSequenceSuffix = [],
} = {}) {
  const actionPath = getActionSourceSequencePath(action);
  const localSourcePath = resolveVerifiedEffectLocalSourcePath(effect);
  const phaseIndex = EFFECT_PHASE_INDEX[phase];
  const suffix = normalizeNonNegativeIntegerPath(localSequenceSuffix, true);
  if (!actionPath || !localSourcePath || phaseIndex == null || !suffix) {
    return null;
  }
  return [
    ...actionPath,
    EFFECT_SOURCE_NAMESPACE,
    ...localSourcePath,
    phaseIndex,
    ...suffix,
  ];
}

export function resolveVerifiedEffectLocalSourcePath(effect) {
  const sourceOrder = effect?.sourceOrder;
  if (
    sourceOrder?.contractName !==
      VERIFIED_EFFECT_SOURCE_SEQUENCE_CONTRACT_NAME ||
    sourceOrder?.status !== 'verified-battle-effect-source-order-ready'
  ) {
    return null;
  }
  return normalizeNonNegativeIntegerPath([
    sourceOrder.timelineGroupIndex,
    sourceOrder.mapIndex,
    sourceOrder.referenceKindOrder,
    sourceOrder.elementIndex,
    sourceOrder.nodeTraversalIndex,
    sourceOrder.triggerIndex,
  ]);
}

function normalizeNonNegativeIntegerPath(value, allowEmpty = false) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) return null;
  const normalized = value.map(entry => Number(entry));
  return normalized.every(entry => Number.isInteger(entry) && entry >= 0)
    ? normalized
    : null;
}
