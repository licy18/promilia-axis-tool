export const DAMAGE_FORMULA_VERSION = 'stage3-raw-attack-multiplier-v1';

export function parsePercentMultiplier(value) {
  if (value == null || value === '') {
    return null;
  }

  const text = String(value).trim();
  const number = Number(text.replace('%', ''));
  if (!Number.isFinite(number)) {
    return null;
  }

  return text.includes('%') ? number / 100 : number;
}

export function parseDamageSegments(action) {
  const labels = action.damageModel?.labels ?? [];
  const values = action.damageModel?.values ?? [];

  return values
    .map((value, index) => {
      const multiplier = parsePercentMultiplier(value);
      if (multiplier == null) {
        return null;
      }

      return {
        index,
        label: labels[index] ?? `segment-${index + 1}`,
        rawValue: value,
        multiplier,
      };
    })
    .filter(Boolean);
}

export function getAttributeValue(baseAttributes, key, fallback = 0) {
  const attribute = (baseAttributes ?? []).find((item) => item.key === key);
  return Number.isFinite(attribute?.value) ? attribute.value : fallback;
}

export function createRawDamageProjection({ actor, enemy, action, segment }) {
  const attack = getAttributeValue(actor.baseAttributes, 'ATK');
  const rawDamage = Math.max(0, Math.round(attack * segment.multiplier));

  return {
    formulaVersion: DAMAGE_FORMULA_VERSION,
    confidence: 'low',
    precision: 'raw-pre-mitigation',
    actorId: actor.id,
    actorName: actor.name,
    enemyId: enemy.id,
    enemyName: enemy.name,
    actionId: action.id,
    skillId: action.skillId,
    skillName: action.name,
    segment,
    attack,
    rawDamage,
    notes: [
      'Uses actor ATK and selected skill multiplier only.',
      'Does not apply final AzPr defense, resistance, crit, buff, equipment, kibo, or soulessence formulas yet.',
    ],
  };
}
