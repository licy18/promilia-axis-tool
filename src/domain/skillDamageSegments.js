import {
  SKILL_LEVEL_CROSSCHECK_SOURCE_KIND,
  createSkillLevelCrossCheckSegmentSource,
  resolveSkillLevelCrossCheck,
} from './skillLevelCrossCheck';

export const SKILL_DAMAGE_SEGMENT_SOURCE_KIND = 'azpr-local-hero-module-skill-level';

export function getSkillDamageSegments(skill, level = 1) {
  return resolveSkillDamageSegments(skill, level).segments;
}

export function createSkillDamageModel(skill, level = 1) {
  const resolved = resolveSkillDamageSegments(skill, level);
  return {
    source: SKILL_DAMAGE_SEGMENT_SOURCE_KIND,
    sourceKind: SKILL_DAMAGE_SEGMENT_SOURCE_KIND,
    sourcePath: resolved.sourcePath,
    skillId: resolved.skillId,
    characterId: resolved.characterId,
    fieldPaths: resolved.fieldPaths,
    level: resolved.level,
    levelIndex: resolved.levelIndex,
    labels: resolved.labels,
    values: resolved.values,
    crossCheck: resolved.crossCheck,
    diagnostics: resolved.diagnostics,
  };
}

export function resolveSkillDamageSegments(skill, level = 1) {
  const diagnostics = [];
  if (!skill) {
    return createEmptyResolution({
      level,
      diagnostics: [
        {
          code: 'skill-missing',
          severity: 'error',
          message: '技能不存在，无法解析倍率段。',
        },
      ],
    });
  }

  const levelValues = Array.isArray(skill.level?.values) ? skill.level.values : [];
  const labels = Array.isArray(skill.level?.labels) ? skill.level.labels : [];
  const clampedLevel = clampLevel(level, levelValues.length);
  const levelIndex = clampedLevel - 1;
  const values = Array.isArray(levelValues[levelIndex]) ? levelValues[levelIndex] : [];
  const sourcePath = skill.source?.heroModule ?? null;
  const fieldPaths = createSkillDamageFieldPaths(skill.id, levelIndex);
  const crossCheck = resolveSkillLevelCrossCheck(skill, clampedLevel);
  diagnostics.push(...crossCheck.diagnostics.map(createCrossCheckDiagnostic));

  if (!sourcePath) {
    diagnostics.push({
      code: 'skill-source-missing',
      severity: 'warning',
      skillId: Number(skill.id) || null,
      message: '技能缺少本地来源路径。',
    });
  }

  if (levelValues.length === 0) {
    diagnostics.push({
      code: 'skill-level-values-missing',
      severity: 'warning',
      skillId: Number(skill.id) || null,
      message: '技能缺少等级倍率表。',
    });
  }

  if (values.length === 0) {
    diagnostics.push({
      code: 'skill-level-row-missing',
      severity: 'warning',
      skillId: Number(skill.id) || null,
      level: clampedLevel,
      message: '当前等级缺少倍率行。',
    });
  }

  if (labels.length > 0 && values.length > 0 && labels.length !== values.length) {
    diagnostics.push({
      code: 'skill-level-label-value-mismatch',
      severity: 'warning',
      skillId: Number(skill.id) || null,
      level: clampedLevel,
      labelCount: labels.length,
      valueCount: values.length,
      message: '技能倍率标签数量与倍率值数量不一致。',
    });
  }

  const segments = values
    .map((value, index) => {
      const multiplier = parseSkillDamageMultiplier(value);
      if (multiplier == null) {
        diagnostics.push({
          code: 'skill-damage-multiplier-unparseable',
          severity: 'warning',
          skillId: Number(skill.id) || null,
          level: clampedLevel,
          index,
          rawValue: value,
          message: '技能倍率值无法解析为数字倍率。',
        });
        return null;
      }

      return {
        index,
        label: labels[index] ?? `segment-${index + 1}`,
        rawValue: value,
        multiplier,
        source: {
          kind: SKILL_DAMAGE_SEGMENT_SOURCE_KIND,
          path: sourcePath,
          skillId: Number(skill.id) || null,
          characterId: Number(skill.characterId) || null,
          level: clampedLevel,
          levelIndex,
          labelField: `${fieldPaths.labels}[${index}]`,
          valueField: `${fieldPaths.values}[${index}]`,
          crossCheck: createSkillLevelCrossCheckSegmentSource(crossCheck, index),
        },
      };
    })
    .filter(Boolean);

  return {
    sourceKind: SKILL_DAMAGE_SEGMENT_SOURCE_KIND,
    sourcePath,
    skillId: Number(skill.id) || null,
    characterId: Number(skill.characterId) || null,
    fieldPaths,
    level: clampedLevel,
    levelIndex,
    labels,
    values,
    crossCheck,
    segments,
    diagnostics,
  };
}

export function parseSkillDamageMultiplier(value) {
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

function createEmptyResolution({ level, diagnostics }) {
  return {
    sourceKind: SKILL_DAMAGE_SEGMENT_SOURCE_KIND,
    sourcePath: null,
    skillId: null,
    characterId: null,
    fieldPaths: createSkillDamageFieldPaths(null, 0),
    level: Math.max(1, Number(level) || 1),
    levelIndex: 0,
    labels: [],
    values: [],
    crossCheck: null,
    segments: [],
    diagnostics,
  };
}

function createSkillDamageFieldPaths(skillId, levelIndex) {
  const skillKey = skillId == null ? '<skillId>' : String(skillId);
  return {
    labels: `skillSystem.${skillKey}.skillLevel.name`,
    values: `skillSystem.${skillKey}.skillLevel.values[${Math.max(0, Number(levelIndex) || 0)}]`,
    description: `skillSystem.${skillKey}.skillDescribe`,
    sourceTable: 'BWiki/data/hero-modules/local-all/<characterId>.hero-module.local.json',
  };
}

function clampLevel(level, levelCount) {
  const maxLevel = Math.max(1, Number(levelCount) || 1);
  return Math.min(maxLevel, Math.max(1, Number(level) || 1));
}

function createCrossCheckDiagnostic(diagnostic) {
  return {
    ...diagnostic,
    sourceKind: SKILL_LEVEL_CROSSCHECK_SOURCE_KIND,
  };
}
