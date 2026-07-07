import { createSkillLevelCrossCheckSegmentSource } from '../../domain/skillLevelCrossCheck';
import { parseSkillDamageMultiplier } from '../../domain/skillDamageSegments';

export const DAMAGE_FORMULA_VERSION =
  'stage5-current-panel-attack-multiplier-v1';

export function parsePercentMultiplier(value) {
  return parseSkillDamageMultiplier(value);
}

export function parseDamageSegments(action) {
  if (Array.isArray(action.damageModel?.variants) && action.damageModel.variants.length > 0) {
    return action.damageModel.variants.map((variant) => ({
      ...variant,
      index: Number(variant.index),
      actionVariantIndex: Number(variant.actionVariantIndex ?? variant.index),
      source: createDamageSegmentSource(
        action.damageModel,
        Number(variant.index),
        action.logicModel,
        variant.source
      ),
    }));
  }

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
        source: createDamageSegmentSource(
          action.damageModel,
          index,
          action.logicModel,
          null
        ),
      };
    })
    .filter(Boolean);
}

function createDamageSegmentSource(damageModel = {}, index, logicModel = null, variantSource = null) {
  if (variantSource) {
    return {
      ...variantSource,
      valueParamLink:
        logicModel?.damageParameterLinks?.find(
          link => Number(link.segmentIndex) === Number(index)
        ) ?? null,
    };
  }

  const fieldPaths = damageModel.fieldPaths ?? {};
  return {
    kind: damageModel.sourceKind ?? damageModel.source ?? 'unknown',
    path: damageModel.sourcePath ?? null,
    skillId: damageModel.skillId ?? null,
    characterId: damageModel.characterId ?? null,
    level: damageModel.level ?? null,
    levelIndex: damageModel.levelIndex ?? null,
    labelField: fieldPaths.labels ? `${fieldPaths.labels}[${index}]` : null,
    valueField: fieldPaths.values ? `${fieldPaths.values}[${index}]` : null,
    crossCheck: createSkillLevelCrossCheckSegmentSource(
      damageModel.crossCheck,
      index
    ),
    valueParamLink:
      logicModel?.damageParameterLinks?.find(
        link => Number(link.segmentIndex) === Number(index)
      ) ?? null,
  };
}

export function getAttributeValue(baseAttributes, key, fallback = 0) {
  const attribute = (baseAttributes ?? []).find(item => item.key === key);
  return Number.isFinite(attribute?.value) ? attribute.value : fallback;
}

export function createRawDamageProjection({ actor, enemy, action, segment }) {
  const attack = Number.isFinite(actor.stats?.attack)
    ? actor.stats.attack
    : getAttributeValue(actor.baseAttributes, 'ATK');
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
    attackSource: actor.stats?.source ?? 'baseAttributes',
    rawDamage,
    notes: [
      'Uses compiled actor ATK and selected skill multiplier only.',
      'Does not apply final AzPr defense, resistance, crit, buff, equipment, kibo, or soulessence formulas yet.',
    ],
  };
}
