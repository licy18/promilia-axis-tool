import soulEssenceEffectCatalog from '../../data/generated/soulessence-effect-mechanics.json';

export const VERIFIED_BATTLE_PROPERTY_TAGS_CONTRACT_NAME =
  'AzPrVerifiedBattlePropertyTags';

export function matchesVerifiedBattlePropertyTags(
  modifierTags = [],
  hitPropertyTags = []
) {
  const required = normalizeIntegerTags(modifierTags);
  if (required.length === 0) return true;
  const available = normalizeIntegerTags(hitPropertyTags);
  return available.some(tag => required.includes(tag));
}

export function resolveVerifiedBattlePropertyTagsForHit({
  action = null,
  resolution = null,
  catalog = soulEssenceEffectCatalog,
} = {}) {
  const rawSkillTags = resolution?.controlBinding?.logic?.skillTag;
  const skillTags = parseSkillTags(rawSkillTags);
  const actionKind = String(
    resolution?.actionBinding?.actionKind ??
      action?.actionKind ??
      action?.eventType ??
      ''
  );
  const sourceIdentity =
    resolution?.controlBinding?.logic?.sourceIdentity ?? null;
  if (skillTags == null) {
    return createUnresolvedResolution({
      actionKind,
      skillTags: [],
      reason: 'battle-property-tag-source-skill-tag-missing',
      sourceIdentity,
      catalog,
    });
  }
  if (skillTags.length !== 1) {
    return createUnresolvedResolution({
      actionKind,
      skillTags,
      reason: 'battle-property-tag-multi-skill-tag-semantics-evidence-gap',
      sourceIdentity,
      catalog,
    });
  }

  const binding = (catalog?.propertyTagContract?.bindings ?? []).find(
    candidate =>
      candidate.status === 'applied' &&
      Number(candidate.skillTagId) === skillTags[0] &&
      candidate.actionKind === actionKind
  );
  if (!binding) {
    return createUnresolvedResolution({
      actionKind,
      skillTags,
      reason: 'battle-property-tag-action-mapping-evidence-gap',
      sourceIdentity,
      catalog,
    });
  }

  return {
    schemaVersion: 1,
    contractName: VERIFIED_BATTLE_PROPERTY_TAGS_CONTRACT_NAME,
    status: 'verified-battle-property-tags-ready',
    actionKind,
    skillTags,
    propertyTags: [Number(binding.propertyTag)],
    propertyTagMatchMode: 'single-exact',
    binding,
    sourceIdentity: [sourceIdentity, binding.sourceIdentity]
      .filter(Boolean)
      .join('|'),
    catalogHash: catalog?.catalogHash ?? null,
    reason: null,
    ready: true,
    applied: true,
  };
}

function createUnresolvedResolution({
  actionKind,
  skillTags,
  reason,
  sourceIdentity,
  catalog,
}) {
  return {
    schemaVersion: 1,
    contractName: VERIFIED_BATTLE_PROPERTY_TAGS_CONTRACT_NAME,
    status: 'battle-property-tag-action-mapping-evidence-gap',
    actionKind,
    skillTags,
    propertyTags: [],
    propertyTagMatchMode: null,
    binding: null,
    sourceIdentity,
    catalogHash: catalog?.catalogHash ?? null,
    reason,
    ready: false,
    applied: false,
  };
}

function parseSkillTags(value) {
  if (value == null || String(value).trim() === '') return null;
  const tags = normalizeIntegerTags(String(value).split('|'));
  return tags.length > 0 ? tags : null;
}

function normalizeIntegerTags(values) {
  return [...new Set((values ?? []).map(value => Number(String(value).trim())))]
    .filter(Number.isInteger)
    .sort((left, right) => left - right);
}
