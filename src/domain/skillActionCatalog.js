import { frameToMs } from './timebase';
import { getSkillActionVariants } from './skillDamageSegments';
import {
  createSkillLogicModel,
  resolveSkillCooldownSource,
} from './skillLogicModel';

export const AZPR_ACTION_KIND_ORDER = Object.freeze([
  'normal-attack',
  'charged-attack',
  'dodge-attack',
  'plunging-attack',
  'star-skill',
  'star-combo',
  'ultimate',
  'star-carry',
  'limit-counter',
  'perfect-parry',
]);

export const AZPR_ACTION_KIND_LABELS = Object.freeze({
  'normal-attack': '普通攻击',
  'charged-attack': '重击',
  'dodge-attack': '闪击',
  'plunging-attack': '跃击',
  'star-skill': '星鸣技',
  'star-combo': '星结合击',
  ultimate: '星决技',
  'star-carry': '星携技',
  'limit-counter': '极限反击',
  'perfect-parry': '完美招架',
});

export const AZPR_ACTION_DEFAULT_DURATION_FRAMES = Object.freeze({
  'normal-attack': 60,
  'charged-attack': 72,
  'dodge-attack': 36,
  'plunging-attack': 66,
  'star-skill': 90,
  'star-combo': 84,
  ultimate: 120,
  'star-carry': 54,
  'limit-counter': 48,
  'perfect-parry': 42,
});

export function getSkillActionCatalog(skills = [], level = 1) {
  const entries = [];
  for (const skill of skills) {
    const variants = getSkillActionVariants(skill, level);
    const cooldown = resolveSkillCooldownSource(
      createSkillLogicModel(skill, level)
    );
    for (const variant of variants) {
      const kind = inferCatalogActionKind(variant, skill);
      if (!kind) {
        continue;
      }

      const durationFrames = AZPR_ACTION_DEFAULT_DURATION_FRAMES[kind] ?? 60;
      entries.push({
        id: `${skill.id}:${variant.index}`,
        kind,
        icon: skill.icon ?? null,
        label: AZPR_ACTION_KIND_LABELS[kind],
        sortIndex: AZPR_ACTION_KIND_ORDER.indexOf(kind),
        skillId: Number(skill.id),
        skillName: skill.name || skill.displayName || `技能 ${skill.id}`,
        skillDisplayType: skill.displayType ?? null,
        actionVariantIndex: Number(variant.index),
        damageSegmentIndex: Number(variant.index),
        sourceLabel: variant.label,
        rawValue: variant.rawValue,
        multiplier: variant.multiplier,
        hitModel: variant.hitModel,
        durationFrames,
        durationMs: frameToMs(durationFrames),
        cooldownMs: cooldown?.durationMs ?? null,
        cooldownSourceKind: cooldown?.sourceKind ?? null,
        sourceVariant: variant,
        exactLabelMatch: isExactCatalogLabel(variant.label, kind),
      });
    }
  }

  return dedupeActionEntries(entries).sort(compareActionEntries);
}

export function inferCatalogActionKind(variant, skill = {}) {
  const label = normalizeLabel(variant?.label);
  const displayLabel = normalizeLabel(variant?.displayLabel);
  const displayName = normalizeLabel(skill?.displayName);
  const candidates = [label, displayLabel, displayName].filter(Boolean);

  if (candidates.some(item => item === '普攻' || item === '普通攻击')) {
    return 'normal-attack';
  }
  if (candidates.some(isChargedAttackLabel)) {
    return 'charged-attack';
  }
  if (candidates.includes('闪击')) {
    return 'dodge-attack';
  }
  if (candidates.includes('跃击')) {
    return 'plunging-attack';
  }
  if (candidates.includes('星鸣技')) {
    return 'star-skill';
  }
  if (candidates.includes('星结合击')) {
    return 'star-combo';
  }
  if (candidates.includes('星决技')) {
    return 'ultimate';
  }
  if (candidates.some(isStarCarryLabel)) {
    return 'star-carry';
  }
  if (candidates.includes('极限反击')) {
    return 'limit-counter';
  }
  if (
    candidates.some(item => ['完美招架', '精准防御', '集中闪避'].includes(item))
  ) {
    return 'perfect-parry';
  }

  return null;
}

function dedupeActionEntries(entries) {
  const byKind = new Map();
  for (const entry of entries) {
    const current = byKind.get(entry.kind);
    if (!current || scoreActionEntry(entry) > scoreActionEntry(current)) {
      byKind.set(entry.kind, entry);
    }
  }
  return [...byKind.values()];
}

function compareActionEntries(left, right) {
  return (
    left.sortIndex - right.sortIndex ||
    left.skillId - right.skillId ||
    left.actionVariantIndex - right.actionVariantIndex
  );
}

function scoreActionEntry(entry) {
  let score = 0;
  if (entry.exactLabelMatch) {
    score += 10;
  }
  if (entry.sourceLabel === entry.label) {
    score += 4;
  }
  if (entry.rawValue) {
    score += 1;
  }
  return score;
}

function isExactCatalogLabel(label, kind) {
  const normalized = normalizeLabel(label);
  const target = AZPR_ACTION_KIND_LABELS[kind];
  if (kind === 'normal-attack') {
    return normalized === '普攻' || normalized === '普通攻击';
  }
  if (kind === 'perfect-parry') {
    return ['完美招架', '精准防御', '集中闪避'].includes(normalized);
  }
  return normalized === target;
}

function isChargedAttackLabel(label) {
  if (label === '重击') {
    return true;
  }
  if (!label.startsWith('重击')) {
    return false;
  }
  return !/(提升|派生)/.test(label);
}

function isStarCarryLabel(label) {
  return label === '星携技' || /^星携技·/.test(label);
}

function normalizeLabel(value) {
  return String(value ?? '').trim();
}
