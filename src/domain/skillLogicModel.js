import skillLogicIndex from '../data/generated/skill-logic-index.json';

export const SKILL_LOGIC_SOURCE_KIND = skillLogicIndex.sourceKind ?? 'azpr-newtable-skill-logic-index';
export const SKILL_LEVEL_DISPLAY_SOURCE_KIND = 'azpr-newtable-skill-level-display';

const logicBySkillId = new Map((skillLogicIndex.items ?? []).map((item) => [Number(item.skillId), item]));

export function getSkillLogicIndexSummary() {
  return skillLogicIndex.summary;
}

export function createSkillLogicModel(skill, level = 1) {
  return resolveSkillLogic(skill, level);
}

export function resolveSkillLogic(skill, level = 1) {
  const source = createSkillLogicSource();
  const skillId = Number(skill?.id);
  if (!Number.isFinite(skillId)) {
    return createMissingLogicModel(source, {
      code: 'skill-logic-skill-missing',
      severity: 'warning',
      message: '缺少技能 ID，无法解析技能逻辑字段。',
    });
  }

  const item = logicBySkillId.get(skillId);
  if (!item) {
    return createMissingLogicModel(source, {
      code: 'skill-logic-entry-missing',
      severity: 'warning',
      skillId,
      message: 'skill-logic-index.json 中缺少该技能的逻辑索引。',
    });
  }

  const resolvedLevel = clampLevel(level, item.levels.length);
  const levelIndex = resolvedLevel - 1;
  const levelRow = item.levels[levelIndex] ?? item.levels[item.levels.length - 1] ?? null;
  if (!levelRow) {
    return createMissingLogicModel(source, {
      code: 'skill-logic-level-missing',
      severity: 'warning',
      skillId,
      level: resolvedLevel,
      message: 'skill-logic-index.json 中缺少该技能等级的逻辑索引。',
    });
  }

  const subSkill = item.subSkills.find((candidate) => Number(candidate.subSkillId) === Number(levelRow.subSkillId));
  const diagnostics = [
    ...(subSkill?.diagnostics ?? []),
    ...(levelRow.diagnostics ?? []),
  ].map((diagnostic) => ({
    ...diagnostic,
    sourceKind: SKILL_LOGIC_SOURCE_KIND,
  }));

  return {
    ...source,
    status: statusFromLogicDiagnostics(diagnostics),
    skillId,
    characterId: Number(item.characterId) || null,
    level: levelRow.level,
    levelIndex: levelRow.levelIndex,
    subSkillId: levelRow.subSkillId,
    skillLevelRowId: levelRow.skillLevelRowId,
    display: createDisplayTimingModel(levelRow),
    logic: createSubSkillLogicModel(subSkill),
    elementValues: createElementValueModels(levelRow),
    diagnostics,
  };
}

function createSkillLogicSource() {
  return {
    sourceKind: SKILL_LOGIC_SOURCE_KIND,
    skillLevelTablePath: skillLogicIndex.source?.skillLevelTable ?? null,
    skillsubLogicTablePath: skillLogicIndex.source?.skillsubLogicTable ?? null,
    skillsubEleValueTablePath: skillLogicIndex.source?.skillsubEleValueTable ?? null,
  };
}

function createDisplayTimingModel(levelRow) {
  return {
    sourceKind: SKILL_LEVEL_DISPLAY_SOURCE_KIND,
    cooldownMs: levelRow.display?.cooldownMs ?? 0,
    spCost: levelRow.display?.spCost ?? 0,
    fieldPaths: {
      cooldownMs: `skill_level.rows[id=${levelRow.skillLevelRowId}].coolDown`,
      spCost: `skill_level.rows[id=${levelRow.skillLevelRowId}].spCost`,
      subSkillId: `skill_level.rows[id=${levelRow.skillLevelRowId}].subSkillId`,
    },
  };
}

function createSubSkillLogicModel(subSkill) {
  if (!subSkill?.logic) {
    return null;
  }

  const subSkillId = subSkill.subSkillId;
  return {
    sourceKind: SKILL_LOGIC_SOURCE_KIND,
    subSkillId,
    ...subSkill.logic,
    displayPairs: subSkill.displayPairs ?? [],
    displayMatchesLogic: Boolean(subSkill.displayMatchesLogic),
    fieldPaths: {
      row: `skillsub_logic.rows[skillId=${subSkillId}]`,
      cooldownMs: `skillsub_logic.rows[skillId=${subSkillId}].coolDown`,
      spCost: `skillsub_logic.rows[skillId=${subSkillId}].spCost`,
      selfCooldownMs: `skillsub_logic.rows[skillId=${subSkillId}].selfCD`,
      publicCooldownMs: `skillsub_logic.rows[skillId=${subSkillId}].publicCD`,
      gcdMs: `skillsub_logic.rows[skillId=${subSkillId}].GCD`,
    },
  };
}

function createElementValueModels(levelRow) {
  return (levelRow.elementValues ?? []).map((row) => ({
    sourceKind: SKILL_LOGIC_SOURCE_KIND,
    rowId: row.rowId,
    elementId: row.elementId,
    valueParam: row.valueParam,
    params: parseValueParam(row.valueParam),
    fieldPaths: {
      row: `skillsub_ele_value.rows[id=${row.rowId}]`,
      valueParam: `skillsub_ele_value.rows[id=${row.rowId}].valueParam`,
    },
  }));
}

function parseValueParam(valueParam) {
  if (!valueParam) {
    return [];
  }

  return String(valueParam)
    .split('|')
    .map((part) => {
      const [idText, valueText] = part.split('#');
      return {
        id: Number(idText),
        value: Number(valueText),
      };
    })
    .filter((item) => Number.isFinite(item.id) && Number.isFinite(item.value));
}

function createMissingLogicModel(source, diagnostic) {
  return {
    ...source,
    status: 'missing',
    skillId: diagnostic.skillId ?? null,
    characterId: null,
    level: diagnostic.level ?? null,
    levelIndex: null,
    subSkillId: null,
    skillLevelRowId: null,
    display: null,
    logic: null,
    elementValues: [],
    diagnostics: [{ ...diagnostic, sourceKind: SKILL_LOGIC_SOURCE_KIND }],
  };
}

function statusFromLogicDiagnostics(diagnostics) {
  if (
    diagnostics.some((diagnostic) =>
      ['skill-logic-row-missing', 'skill-logic-skill-level-missing', 'skill-logic-level-missing'].includes(
        diagnostic.code,
      ),
    )
  ) {
    return 'missing';
  }
  if (diagnostics.some((diagnostic) => diagnostic.code === 'skill-display-logic-timing-mismatch')) {
    return 'mismatch';
  }
  return 'mapped';
}

function clampLevel(level, levelCount) {
  const maxLevel = Math.max(1, Number(levelCount) || 1);
  return Math.min(maxLevel, Math.max(1, Number(level) || 1));
}
