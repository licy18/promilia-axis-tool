import {
  ACTOR_SP_GROWTH_MULTIPLIER,
  ACTOR_SP_GROWTH_TEMPLATE_ID,
  KIBO_SP_GROWTH_BASE_ID,
  KIBO_SP_GROWTH_MULTIPLIER,
  KIBO_SP_GROWTH_TEMPLATE_ID,
  SP_VALUE_UNIT,
} from '../data/generated/verified-sp-unit-runtime.js';

export const AZPR_SP_UNIT_CONTRACT = Object.freeze({
  valueUnit: SP_VALUE_UNIT,
  actor: {
    maxSpGrowthTemplateId: ACTOR_SP_GROWTH_TEMPLATE_ID,
    maxSpGrowthMultiplier: ACTOR_SP_GROWTH_MULTIPLIER,
  },
  kibo: {
    petGrowthBaseId: KIBO_SP_GROWTH_BASE_ID,
    maxSpGrowthTemplateId: KIBO_SP_GROWTH_TEMPLATE_ID,
    maxSpGrowthMultiplier: KIBO_SP_GROWTH_MULTIPLIER,
  },
});
export const AZPR_DEFAULT_EFFECTIVE_MAX_SP = ACTOR_SP_GROWTH_MULTIPLIER;

export function createActorSpResourceProfile(baseAttributes = []) {
  const maxSpBase = finiteNumber(findMaxSpAttribute(baseAttributes)?.value);
  const effectiveMaxSp = calculateEffectiveMaxSp(
    maxSpBase,
    ACTOR_SP_GROWTH_MULTIPLIER
  );
  return {
    valueUnit: SP_VALUE_UNIT,
    maxSpBase,
    maxSpGrowthTemplateId: ACTOR_SP_GROWTH_TEMPLATE_ID,
    maxSpGrowthMultiplier: ACTOR_SP_GROWTH_MULTIPLIER,
    effectiveMaxSp,
  };
}

export function applyActorSpResourceProfile(
  baseAttributes = [],
  profile = createActorSpResourceProfile(baseAttributes)
) {
  const effectiveMaxSp = positiveNumber(profile?.effectiveMaxSp);
  return (Array.isArray(baseAttributes) ? baseAttributes : []).map(attribute =>
    attribute?.key === 'MAXSP' && effectiveMaxSp
      ? {
          ...attribute,
          value: effectiveMaxSp,
          baseValue: profile.maxSpBase,
          growthTemplateId: profile.maxSpGrowthTemplateId,
          growthMultiplier: profile.maxSpGrowthMultiplier,
          valueUnit: SP_VALUE_UNIT,
        }
      : attribute
  );
}

export function resolveActorEffectiveMaxSp(value) {
  const explicit = positiveNumber(
    value?.spResourceProfile?.effectiveMaxSp ??
      value?.resourceProfile?.effectiveMaxSp
  );
  if (explicit) return explicit;
  const attribute = findMaxSpAttribute(
    value?.baseAttributes ?? value?.property?.baseAttributes ?? value
  );
  const projected = positiveNumber(
    attribute?.valueUnit === SP_VALUE_UNIT
      ? attribute.value
      : attribute?.effectiveValue
  );
  return (
    projected ??
    calculateEffectiveMaxSp(
      attribute?.value,
      ACTOR_SP_GROWTH_MULTIPLIER
    )
  );
}

export function resolveKiboEffectiveMaxSp(maxSpBase = 1) {
  return calculateEffectiveMaxSp(
    maxSpBase,
    KIBO_SP_GROWTH_MULTIPLIER
  );
}

export function scaleLegacyNormalizedSpValue(
  value,
  effectiveMaxSp = AZPR_DEFAULT_EFFECTIVE_MAX_SP
) {
  const current = finiteNumber(value);
  const maximum = positiveNumber(effectiveMaxSp);
  return current == null || !maximum || current < 0 || current > 1
    ? current
    : Number((current * maximum).toFixed(6));
}

function calculateEffectiveMaxSp(base, growthMultiplier) {
  const normalizedBase = positiveNumber(base);
  const normalizedGrowth = positiveNumber(growthMultiplier);
  return normalizedBase && normalizedGrowth
    ? normalizedBase * normalizedGrowth
    : null;
}

function findMaxSpAttribute(value) {
  return (Array.isArray(value) ? value : []).find(
    attribute => attribute?.key === 'MAXSP' || Number(attribute?.id) === 6
  );
}

function finiteNumber(value) {
  const number = Number(value);
  return value != null && value !== '' && Number.isFinite(number)
    ? number
    : null;
}

function positiveNumber(value) {
  const number = finiteNumber(value);
  return number > 0 ? number : null;
}
