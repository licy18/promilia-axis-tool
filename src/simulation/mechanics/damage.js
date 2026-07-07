import { createSkillLevelCrossCheckSegmentSource } from '../../domain/skillLevelCrossCheck';
import { parseSkillDamageMultiplier } from '../../domain/skillDamageSegments';
import combatFormulaEvidence from '../../data/generated/combat-formula-evidence.json';

export const DAMAGE_FORMULA_VERSION =
  'stage5-damage-layer-breakdown-v1';
const COMBAT_FORMULA_EVIDENCE_PATH =
  'src/data/generated/combat-formula-evidence.json';
const COMBAT_FORMULA_EVIDENCE_KIND =
  combatFormulaEvidence.sourceKind ?? 'azpr-combat-formula-evidence-index';

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
  const formulaBreakdown = createDamageFormulaBreakdown({
    actor,
    enemy,
    action,
    segment,
    attack,
  });
  const rawDamage = formulaBreakdown.result;

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
    formulaBreakdown,
    notes: [
      'Applies compiled actor ATK and selected action multiplier.',
      'Defense, resistance, crit, buff, equipment, kibo, and soulessence layers are structured placeholders until confirmed AzPr formulas are mapped.',
    ],
  };
}

export function createDamageFormulaBreakdown({ actor, enemy, action, segment, attack }) {
  const multiplier = Number(segment.multiplier) || 0;
  const result = Math.max(0, Math.round(attack * multiplier));

  return {
    version: DAMAGE_FORMULA_VERSION,
    status: 'partial',
    expression: 'round(baseAttack.value * actionMultiplier.value)',
    result,
    appliedLayerKeys: ['baseAttack', 'actionMultiplier'],
    unappliedLayerKeys: [
      'enemyDefense',
      'enemyResistance',
      'critical',
      'damageBonus',
    ],
    layers: {
      baseAttack: {
        label: '角色当前攻击',
        value: attack,
        source: actor.stats?.source ?? 'baseAttributes',
        applied: true,
      },
      actionMultiplier: {
        label: '动作形态倍率',
        value: multiplier,
        rawValue: segment.rawValue,
        actionVariantIndex: Number(segment.actionVariantIndex ?? segment.index ?? 0),
        hitModel: segment.hitModel ?? null,
        applied: true,
      },
      enemyDefense: {
        label: '敌人防御',
        applied: false,
        status: 'evidence-found-formula-unmapped',
        multiplier: 1,
        source: createEnemyDefenseEvidenceSource(enemy),
        defenseMultiplier: Number(enemy.defenseMultiplier) || 1,
        physicalDefense: Number(enemy.stats?.physicalDefense) || 0,
        magicalDefense: Number(enemy.stats?.magicalDefense) || 0,
      },
      enemyResistance: {
        label: '敌人抗性',
        applied: false,
        status: 'evidence-found-formula-unmapped',
        multiplier: 1,
        source: createEnemyResistanceEvidenceSource(enemy, action),
        elementId: action.elementId ?? null,
      },
      critical: {
        label: '暴击期望',
        applied: false,
        status: 'placeholder',
        multiplier: 1,
        source: actor.stats?.source ?? 'baseAttributes',
        critRate: Number(actor.stats?.critRate) || 0,
        critDamage: Number(actor.stats?.critDamage) || 0,
      },
      damageBonus: {
        label: '增伤/减伤',
        applied: false,
        status: 'placeholder',
        multiplier: 1,
        source: actor.stats?.source ?? 'baseAttributes',
        damageAmplification: Number(actor.stats?.damageAmplification) || 0,
        damageReduction: Number(actor.stats?.damageReduction) || 0,
      },
    },
    limitations: [
      'enemyDefense layer is recorded but not applied.',
      'enemyResistance layer is recorded but not applied.',
      'critical layer is recorded but not applied.',
      'damageBonus layer is recorded but not applied.',
    ],
  };
}

function createEnemyDefenseEvidenceSource(enemy) {
  const evidence = combatFormulaEvidence.enemyAttributeEvidence ?? {};

  return {
    kind: COMBAT_FORMULA_EVIDENCE_KIND,
    file: COMBAT_FORMULA_EVIDENCE_PATH,
    status: evidence.status ?? 'unknown',
    formulaStatus: combatFormulaEvidence.formulaEvidence?.status ?? 'unknown',
    relationStatus:
      combatFormulaEvidence.summary?.relationStatus ?? 'unknown',
    sourceChain: evidence.sourceChain ?? null,
    propertyId: enemy.propertyId ?? null,
    baseAttributeId: enemy.source?.enemy?.property?.baseAttributeId ?? null,
    attributeValues: mapEvidenceAttributeValues(
      enemy,
      evidence.baseDefenseAttributes ?? []
    ),
    note:
      'Enemy DEF/MDEF source fields are mapped, but defense formula application is still unconfirmed.',
  };
}

function createEnemyResistanceEvidenceSource(enemy, action) {
  const evidence = combatFormulaEvidence.enemyAttributeEvidence ?? {};

  return {
    kind: COMBAT_FORMULA_EVIDENCE_KIND,
    file: COMBAT_FORMULA_EVIDENCE_PATH,
    status: evidence.status ?? 'unknown',
    formulaStatus: combatFormulaEvidence.formulaEvidence?.status ?? 'unknown',
    relationStatus:
      combatFormulaEvidence.summary?.relationStatus ?? 'unknown',
    elementValueStatus:
      combatFormulaEvidence.elementValueEvidence?.status ?? 'unknown',
    sourceChain: evidence.sourceChain ?? null,
    propertyId: enemy.propertyId ?? null,
    baseAttributeId: enemy.source?.enemy?.property?.baseAttributeId ?? null,
    actionElementId: action.elementId ?? null,
    attributeValues: mapEvidenceAttributeValues(
      enemy,
      evidence.elementDefenseAttributes ?? []
    ),
    note:
      'Enemy element defense fields are mapped, but elementId/formula application remains unconfirmed.',
  };
}

function mapEvidenceAttributeValues(enemy, attributes) {
  return attributes.map(attribute => ({
    key: attribute.key,
    id: attribute.id ?? null,
    name: attribute.name ?? attribute.key,
    isRatio: Boolean(attribute.isRatio),
    value: getAttributeValue(enemy.baseAttributes, attribute.key, null),
  }));
}
