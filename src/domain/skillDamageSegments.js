import {
  SKILL_LEVEL_CROSSCHECK_SOURCE_KIND,
  createSkillLevelCrossCheckSegmentSource,
  resolveSkillLevelCrossCheck,
} from './skillLevelCrossCheck';

export const SKILL_ACTION_VARIANT_SOURCE_KIND = 'azpr-local-hero-module-skill-level-action-variant';
export const SKILL_DAMAGE_SEGMENT_SOURCE_KIND = SKILL_ACTION_VARIANT_SOURCE_KIND;

export function getSkillDamageSegments(skill, level = 1) {
  return getSkillActionVariants(skill, level);
}

export function getSkillActionVariants(skill, level = 1) {
  return resolveSkillActionVariants(skill, level).variants;
}

export function createSkillDamageModel(skill, level = 1) {
  const resolved = resolveSkillActionVariants(skill, level);
  return {
    source: SKILL_ACTION_VARIANT_SOURCE_KIND,
    sourceKind: SKILL_ACTION_VARIANT_SOURCE_KIND,
    sourcePath: resolved.sourcePath,
    skillId: resolved.skillId,
    characterId: resolved.characterId,
    fieldPaths: resolved.fieldPaths,
    level: resolved.level,
    levelIndex: resolved.levelIndex,
    labels: resolved.labels,
    values: resolved.values,
    variants: resolved.variants,
    actionVariants: resolved.variants,
    segments: resolved.variants,
    crossCheck: resolved.crossCheck,
    diagnostics: resolved.diagnostics,
  };
}

export function resolveSkillDamageSegments(skill, level = 1) {
  return resolveSkillActionVariants(skill, level);
}

export function resolveSkillActionVariants(skill, level = 1) {
  const diagnostics = [];
  if (!skill) {
    return createEmptyResolution({
      level,
      diagnostics: [
        {
          code: 'skill-missing',
          severity: 'error',
          message: '技能不存在，无法解析动作形态倍率。',
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
  const descriptionSections = parseSkillDescriptionSections(getSkillDescriptionPlain(skill));
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

  const variants = values
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

      const label = labels[index] ?? `action-${index + 1}`;
      const descriptionSection = findDescriptionSectionForValue(descriptionSections, label, index);
      const kind = inferSkillActionKind(label, descriptionSection?.title);
      const hitModel = createActionHitModel({
        kind,
        label,
        rawValue: value,
        multiplier,
        descriptionSection,
      });

      return {
        index,
        actionVariantIndex: index,
        kind,
        label,
        displayLabel: descriptionSection?.title ?? normalizeActionVariantLabel(label),
        rawValue: value,
        multiplier,
        descriptionSection,
        hitModel,
        hitSegments: hitModel.segments,
        damageSegments: hitModel.segments,
        source: {
          kind: SKILL_ACTION_VARIANT_SOURCE_KIND,
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
    sourceKind: SKILL_ACTION_VARIANT_SOURCE_KIND,
    sourcePath,
    skillId: Number(skill.id) || null,
    characterId: Number(skill.characterId) || null,
    fieldPaths,
    level: clampedLevel,
    levelIndex,
    labels,
    values,
    crossCheck,
    variants,
    actionVariants: variants,
    segments: variants,
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
    sourceKind: SKILL_ACTION_VARIANT_SOURCE_KIND,
    sourcePath: null,
    skillId: null,
    characterId: null,
    fieldPaths: createSkillDamageFieldPaths(null, 0),
    level: Math.max(1, Number(level) || 1),
    levelIndex: 0,
    labels: [],
    values: [],
    crossCheck: null,
    variants: [],
    actionVariants: [],
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

function getSkillDescriptionPlain(skill) {
  return String(skill?.description?.plain ?? skill?.description?.raw ?? skill?.skillDescribe ?? '');
}

function parseSkillDescriptionSections(description) {
  const sections = [];
  const text = stripRichTextTags(description);
  const pattern = /【([^】]+)】([\s\S]*?)(?=【[^】]+】|$)/g;
  let match = pattern.exec(text);

  while (match) {
    sections.push({
      title: match[1].trim(),
      text: match[2].trim(),
      rawText: match[0].trim(),
    });
    match = pattern.exec(text);
  }

  return sections;
}

function findDescriptionSectionForValue(sections, label, index) {
  const token = `{${index}}`;
  return (
    sections.find((section) => section.text.includes(token)) ??
    sections.find((section) => labelsMatch(section.title, label)) ??
    null
  );
}

function createActionHitModel({ kind, label, rawValue, multiplier, descriptionSection }) {
  const hitCount = kind === 'normal-attack' ? parseNormalAttackHitCount(descriptionSection?.text) : 1;
  const segmentCount = Math.max(1, hitCount ?? 1);
  const distributionStatus = kind === 'normal-attack' && segmentCount > 1 ? 'total-only' : 'single-aggregate';
  const source = hitCount ? 'description' : 'aggregate';

  return {
    kind,
    source,
    status: distributionStatus,
    hitCount: segmentCount,
    totalRawValue: rawValue,
    totalMultiplier: multiplier,
    distributionStatus,
    segments: Array.from({ length: segmentCount }, (_, index) =>
      createHitSegment({
        kind,
        label,
        rawValue,
        multiplier,
        index,
        count: segmentCount,
        distributionStatus,
      }),
    ),
  };
}

function createHitSegment({ kind, label, rawValue, multiplier, index, count, distributionStatus }) {
  const aggregate = count <= 1;
  return {
    index,
    hitIndex: index + 1,
    label: aggregate ? normalizeActionVariantLabel(label) : `${normalizeActionVariantLabel(label)} ${index + 1}段`,
    rawValue: aggregate ? rawValue : null,
    multiplier: aggregate ? multiplier : null,
    totalRawValue: rawValue,
    totalMultiplier: multiplier,
    sourceStatus: aggregate ? 'aggregate-value' : 'description-hit-count-only',
    distributionStatus,
    kind,
  };
}

function inferSkillActionKind(label, descriptionTitle) {
  const text = `${label ?? ''} ${descriptionTitle ?? ''}`;
  if (/普攻|普通攻击/.test(text)) {
    return 'normal-attack';
  }
  if (/重击/.test(text)) {
    return 'charged-attack';
  }
  if (/闪击|闪避攻击/.test(text)) {
    return 'dodge-attack';
  }
  if (/跃击|下落攻击|空中攻击/.test(text)) {
    return 'plunging-attack';
  }
  return 'skill-action';
}

function parseNormalAttackHitCount(text = '') {
  const source = String(text);
  const patterns = [
    /至多([一二三四五六七八九十\d]+)段的?普通攻击/,
    /进行([一二三四五六七八九十\d]+)段的?普通攻击/,
    /普通攻击[^。；;]*?([一二三四五六七八九十\d]+)段/,
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    const number = parseChineseNumber(match?.[1]);
    if (number) {
      return number;
    }
  }

  return null;
}

function parseChineseNumber(value) {
  if (value == null || value === '') {
    return null;
  }
  const text = String(value).trim();
  if (/^\d+$/.test(text)) {
    const number = Number(text);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  const digits = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };

  if (text === '十') {
    return 10;
  }
  if (text.includes('十')) {
    const [tensText, onesText] = text.split('十');
    const tens = tensText ? digits[tensText] : 1;
    const ones = onesText ? digits[onesText] : 0;
    const number = tens * 10 + ones;
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  return digits[text] ?? null;
}

function labelsMatch(left, right) {
  const normalizedLeft = normalizeForLabelMatch(left);
  const normalizedRight = normalizeForLabelMatch(right);
  return normalizedLeft === normalizedRight || getLabelAliases(left).includes(normalizedRight);
}

function getLabelAliases(label) {
  const normalized = normalizeForLabelMatch(label);
  const aliases = new Map([
    ['普攻', ['普通攻击']],
    ['普通攻击', ['普攻']],
    ['闪击', ['闪避攻击']],
    ['闪避攻击', ['闪击']],
    ['跃击', ['下落攻击', '空中攻击']],
    ['下落攻击', ['跃击']],
  ]);
  return aliases.get(normalized) ?? [];
}

function normalizeActionVariantLabel(label) {
  return String(label ?? '').trim() || '动作形态';
}

function normalizeForLabelMatch(label) {
  return normalizeActionVariantLabel(label).replace(/\s+/g, '');
}

function stripRichTextTags(text) {
  return String(text).replace(/<[^>]+>/g, '');
}
