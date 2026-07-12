import { getAzprWorkbenchSkillCore } from '../data/azprGenerated';

const skillLevelCrossCheckData =
  getAzprWorkbenchSkillCore().skillLevelCrossCheck;

export const SKILL_LEVEL_CROSSCHECK_SOURCE_KIND =
  skillLevelCrossCheckData.sourceKind ?? 'azpr-newtable-skill-level-crosscheck';

const crossCheckBySkillId = new Map(
  (skillLevelCrossCheckData.items ?? []).map(item => [
    Number(item.skillId),
    item,
  ])
);

export function getSkillLevelCrossCheckSummary() {
  return skillLevelCrossCheckData.summary;
}

export function resolveSkillLevelCrossCheck(skill, level = 1) {
  const skillId = Number(skill?.id);
  const source = {
    sourceKind: SKILL_LEVEL_CROSSCHECK_SOURCE_KIND,
    tablePath: skillLevelCrossCheckData.source?.table ?? null,
    langTablePath: skillLevelCrossCheckData.source?.langTable ?? null,
  };

  if (!Number.isFinite(skillId)) {
    return createMissingCrossCheck(source, {
      code: 'skill-level-crosscheck-skill-missing',
      severity: 'warning',
      message: '缺少技能 ID，无法执行 NewTable 技能倍率交叉校验。',
    });
  }

  const item = crossCheckBySkillId.get(skillId);
  if (!item) {
    return createMissingCrossCheck(source, {
      code: 'skill-level-crosscheck-entry-missing',
      severity: 'warning',
      skillId,
      message: 'skill-level-crosscheck.json 中缺少该技能的校验条目。',
    });
  }

  const requestedLevel = Math.max(1, Number(level) || 1);
  let resolvedLevelIndex = item.levels.findIndex(
    (candidate, index) =>
      Number(candidate.level ?? index + 1) === requestedLevel
  );
  if (resolvedLevelIndex < 0) {
    resolvedLevelIndex = item.levels.length - 1;
  }
  const levelResult = item.levels[resolvedLevelIndex] ?? null;

  if (!levelResult) {
    return createMissingCrossCheck(source, {
      code: 'skill-level-crosscheck-level-missing',
      severity: 'warning',
      skillId,
      level: requestedLevel,
      message: 'skill-level-crosscheck.json 中缺少该技能等级的校验结果。',
    });
  }

  return {
    ...source,
    status: levelResult.status ?? 'matched',
    skillId,
    characterId: Number(item.characterId) || null,
    level: levelResult.level ?? resolvedLevelIndex + 1,
    levelIndex: levelResult.levelIndex ?? resolvedLevelIndex,
    rowId: levelResult.rowId,
    fieldPaths: createSkillLevelCrossCheckFieldPaths(
      skillId,
      levelResult.level ?? resolvedLevelIndex + 1,
      levelResult.rowId
    ),
    labels: levelResult.labels ?? skill.level?.labels ?? [],
    values:
      levelResult.values ?? skill.level?.values?.[resolvedLevelIndex] ?? [],
    expectedLabels: skill.level?.labels ?? [],
    expectedValues: skill.level?.values?.[resolvedLevelIndex] ?? [],
    labelIds: expandSequentialIds(
      levelResult.labelIds,
      resolveLevelIdRange(levelResult, item, resolvedLevelIndex, 'label')
    ),
    valueIds: expandSequentialIds(
      levelResult.valueIds,
      resolveLevelIdRange(levelResult, item, resolvedLevelIndex, 'value')
    ),
    matches: levelResult.matches ?? { labels: true, values: true },
    diagnostics: cloneDiagnostics(levelResult.diagnostics),
  };
}

function resolveLevelIdRange(levelResult, item, levelIndex, prefix) {
  const directRange = levelResult[`${prefix}IdRange`];
  if (Array.isArray(directRange)) return directRange;
  const series = item[`${prefix}IdSeries`];
  if (!Array.isArray(series) || series.length < 2) return null;
  const count = levelResult[`${prefix}IdCount`] ?? series[2];
  if (!Number.isFinite(Number(count))) return null;
  try {
    return [
      (BigInt(series[0]) + BigInt(series[1]) * BigInt(levelIndex)).toString(),
      Number(count),
    ];
  } catch {
    return null;
  }
}

export function createSkillLevelCrossCheckSegmentSource(crossCheck, index) {
  if (!crossCheck || crossCheck.status === 'missing') {
    return null;
  }

  return {
    kind: SKILL_LEVEL_CROSSCHECK_SOURCE_KIND,
    status: crossCheck.status,
    tablePath: crossCheck.tablePath,
    langTablePath: crossCheck.langTablePath,
    rowId: crossCheck.rowId,
    skillId: crossCheck.skillId,
    characterId: crossCheck.characterId,
    level: crossCheck.level,
    levelIndex: crossCheck.levelIndex,
    labelId: crossCheck.labelIds?.[index] ?? null,
    valueId: crossCheck.valueIds?.[index] ?? null,
    labelField: `${crossCheck.fieldPaths?.labels}[${index}]`,
    valueField: `${crossCheck.fieldPaths?.values}[${index}]`,
    labelMatches: Boolean(crossCheck.matches?.labels),
    valueMatches: Boolean(crossCheck.matches?.values),
  };
}

function createMissingCrossCheck(source, diagnostic) {
  return {
    ...source,
    status: 'missing',
    skillId: diagnostic.skillId ?? null,
    characterId: null,
    level: diagnostic.level ?? null,
    levelIndex: null,
    rowId: null,
    fieldPaths: null,
    labels: [],
    values: [],
    expectedLabels: [],
    expectedValues: [],
    labelIds: [],
    valueIds: [],
    matches: {
      labels: false,
      values: false,
    },
    diagnostics: [diagnostic],
  };
}

function createSkillLevelCrossCheckFieldPaths(skillId, level, rowId) {
  const rowSelector =
    rowId == null
      ? `rows[skillId=${skillId},level=${level}]`
      : `rows[id=${rowId}]`;
  return {
    row: `skill_level.${rowSelector}`,
    labels: `skill_level.${rowSelector}.name -> lang_skill_level`,
    values: `skill_level.${rowSelector}.value -> lang_skill_level`,
    description: `skill_level.${rowSelector}.skillDescribe -> lang_skill_level`,
  };
}

function cloneDiagnostics(diagnostics = []) {
  return diagnostics.map(diagnostic => ({ ...diagnostic }));
}

function expandSequentialIds(values, range) {
  if (Array.isArray(values)) return values;
  if (!Array.isArray(range) || range.length !== 2) return [];
  try {
    const first = BigInt(range[0]);
    const count = Math.max(0, Number(range[1]) || 0);
    return Array.from({ length: count }, (_, index) =>
      (first + BigInt(index)).toString()
    );
  } catch {
    return [];
  }
}
