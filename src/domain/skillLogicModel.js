import skillLogicIndex from '../data/generated/skill-logic-index.json';
import valueParamIndex from '../data/generated/value-param-index.json';
import { parseSkillDamageMultiplier } from './skillDamageSegments';

export const SKILL_LOGIC_SOURCE_KIND = skillLogicIndex.sourceKind ?? 'azpr-newtable-skill-logic-index';
export const SKILL_LEVEL_DISPLAY_SOURCE_KIND = 'azpr-newtable-skill-level-display';
export const VALUE_PARAM_SOURCE_KIND = valueParamIndex.sourceKind ?? 'azpr-newtable-value-param-index';

const logicBySkillId = new Map((skillLogicIndex.items ?? []).map((item) => [Number(item.skillId), item]));
const valueParamDescriptorsById = new Map((valueParamIndex.params ?? []).map((item) => [Number(item.id), item]));

export function getSkillLogicIndexSummary() {
  return skillLogicIndex.summary;
}

export function getValueParamIndexSummary() {
  return valueParamIndex.summary;
}

export function createSkillLogicModel(skill, level = 1, options = {}) {
  return resolveSkillLogic(skill, level, options);
}

export function resolveSkillLogic(skill, level = 1, options = {}) {
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
  const elementValues = createElementValueModels(levelRow);
  const damageParameterLinks = createDamageParameterLinks(options.damageModel, elementValues);
  const diagnostics = [
    ...(subSkill?.diagnostics ?? []),
    ...(levelRow.diagnostics ?? []),
    ...damageParameterLinks.flatMap((link) => link.diagnostics),
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
    elementValues,
    valueParamSummary: createValueParamSummary(elementValues, damageParameterLinks),
    damageParameterLinks,
    diagnostics,
  };
}

function createSkillLogicSource() {
  return {
    sourceKind: SKILL_LOGIC_SOURCE_KIND,
    skillLevelTablePath: skillLogicIndex.source?.skillLevelTable ?? null,
    skillsubLogicTablePath: skillLogicIndex.source?.skillsubLogicTable ?? null,
    skillsubEleValueTablePath: skillLogicIndex.source?.skillsubEleValueTable ?? null,
    valueParamIndexSourceKind: VALUE_PARAM_SOURCE_KIND,
    elementFormulaTablePath: valueParamIndex.source?.elementFormulaTable ?? null,
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

function createDamageParameterLinks(damageModel, elementValues) {
  const values = damageModel?.values ?? [];
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }

  const params = flattenValueParams(elementValues);
  return values.map((rawValue, index) => {
    const candidates = createDamageValueCandidates(rawValue);
    const matches = findValueParamMatches(params, candidates);
    const status = matches.length > 0 ? 'matched' : candidates.length > 0 ? 'unmatched' : 'unparseable';
    const diagnostics =
      status === 'matched'
        ? []
        : [
            {
              code:
                status === 'unparseable'
                  ? 'skill-value-param-damage-segment-unparseable'
                  : 'skill-value-param-damage-segment-unmatched',
              severity: 'info',
              skillId: damageModel.skillId,
              level: damageModel.level,
              segmentIndex: index,
              rawValue,
              candidateValues: candidates.map((candidate) => candidate.value),
              unmatchedParamIds: uniqueNumbers(params.map((param) => param.paramId)),
              message:
                status === 'unparseable'
                  ? '技能倍率段无法解析，无法与 skillsub_ele_value.valueParam 建立数值关联。'
                  : '技能倍率段与当前等级 valueParam 未发现直接数值匹配，暂不能把 valueParam 当作倍率公式来源。',
            },
          ];

    return {
      segmentIndex: index,
      label: damageModel.labels?.[index] ?? `segment-${index + 1}`,
      rawValue,
      multiplier: parseSkillDamageMultiplier(rawValue),
      status,
      candidates,
      matches,
      unmatchedParamIds: uniqueNumbers(
        params
          .filter((param) => !matches.some((match) => match.rowId === param.rowId && match.paramId === param.paramId))
          .map((param) => param.paramId),
      ),
      diagnostics,
    };
  });
}

function createDamageValueCandidates(rawValue) {
  const multiplier = parseSkillDamageMultiplier(rawValue);
  const rawNumber = parseRawNumber(rawValue);
  if (multiplier == null || rawNumber == null) {
    return [];
  }

  return uniqueByKey(
    [
      {
        kind: 'raw-number',
        value: normalizeCandidateValue(rawNumber),
      },
      {
        kind: 'multiplier',
        value: normalizeCandidateValue(multiplier),
      },
      {
        kind: 'basis-points',
        value: normalizeCandidateValue(rawNumber * 100),
      },
      {
        kind: 'ten-thousand-ratio',
        value: normalizeCandidateValue(multiplier * 10000),
      },
    ],
    (candidate) => String(candidate.value),
  );
}

function findValueParamMatches(params, candidates) {
  return params.flatMap((param) =>
    candidates
      .filter((candidate) => nearlyEqual(param.value, candidate.value))
      .map((candidate) => ({
        rowId: param.rowId,
        elementId: param.elementId,
        paramId: param.paramId,
        value: param.value,
        matchedAs: candidate.kind,
        fieldPath: param.fieldPath,
      })),
  );
}

function createValueParamSummary(elementValues, damageParameterLinks) {
  const params = flattenValueParams(elementValues);
  const matches = damageParameterLinks.flatMap((link) => link.matches);
  const semanticStatusCounts = countBy(params, (param) => param.descriptor.semanticStatus);
  return {
    rowCount: elementValues.length,
    paramCount: params.length,
    uniqueParamIds: uniqueNumbers(params.map((param) => param.paramId)),
    semanticStatusCounts,
    unresolvedParamIds: uniqueNumbers(
      params
        .filter((param) => param.descriptor.semanticStatus !== 'confirmed')
        .map((param) => param.paramId),
    ),
    constantParamIds: uniqueNumbers(
      params.filter((param) => param.descriptor.isConstant).map((param) => param.paramId),
    ),
    directMatchCount: matches.length,
    linkedSegmentCount: damageParameterLinks.filter((link) => link.status === 'matched').length,
    unmatchedSegmentCount: damageParameterLinks.filter((link) => link.status === 'unmatched').length,
    unexplainedParamIds: uniqueNumbers(
      params
        .filter((param) => !matches.some((match) => match.rowId === param.rowId && match.paramId === param.paramId))
        .map((param) => param.paramId),
    ),
  };
}

function flattenValueParams(elementValues) {
  return elementValues.flatMap((row) =>
    row.params.map((param) => ({
      rowId: row.rowId,
      elementId: row.elementId,
      paramId: param.id,
      value: param.value,
      descriptor: param.descriptor,
      fieldPath: `${row.fieldPaths.valueParam}[${param.id}]`,
    })),
  );
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
        descriptor: createValueParamDescriptor(idText),
      };
    })
    .filter((item) => Number.isFinite(item.id) && Number.isFinite(item.value));
}

function createValueParamDescriptor(paramId) {
  const id = Number(paramId);
  const descriptor = valueParamDescriptorsById.get(id);
  if (!descriptor) {
    return {
      sourceKind: VALUE_PARAM_SOURCE_KIND,
      id,
      variable: '',
      label: `参数 ${Number.isFinite(id) ? id : '?'}`,
      semanticStatus: 'unknown',
      category: 'unknown-formula-slot',
      roleHint: '当前 value-param-index.json 未记录该参数 ID；战斗语义未确认。',
      isConstant: false,
      rowCount: 0,
      skillCount: 0,
      elementCount: 0,
      minValue: null,
      maxValue: null,
      sampleValues: [],
    };
  }

  return {
    sourceKind: VALUE_PARAM_SOURCE_KIND,
    id: descriptor.id,
    variable: descriptor.variable,
    variableSource: descriptor.variableSource,
    label: descriptor.label,
    semanticStatus: descriptor.semanticStatus,
    category: descriptor.category,
    roleHint: descriptor.roleHint,
    isConstant: Boolean(descriptor.isConstant),
    rowCount: descriptor.rowCount,
    skillCount: descriptor.skillCount,
    elementCount: descriptor.elementCount,
    minValue: descriptor.minValue,
    maxValue: descriptor.maxValue,
    sampleValues: descriptor.sampleValues ?? [],
  };
}

function parseRawNumber(rawValue) {
  if (rawValue == null || rawValue === '') {
    return null;
  }
  const number = Number(String(rawValue).trim().replace('%', ''));
  return Number.isFinite(number) ? number : null;
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
    valueParamSummary: {
      rowCount: 0,
      paramCount: 0,
      uniqueParamIds: [],
      semanticStatusCounts: {},
      unresolvedParamIds: [],
      constantParamIds: [],
      directMatchCount: 0,
      linkedSegmentCount: 0,
      unmatchedSegmentCount: 0,
      unexplainedParamIds: [],
    },
    damageParameterLinks: [],
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

function uniqueNumbers(values) {
  return [...new Set(values.map((value) => Number(value)).filter(Number.isFinite))].sort((left, right) => left - right);
}

function uniqueByKey(items, createKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = createKey(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function countBy(items, createKey) {
  return items.reduce((counts, item) => {
    const key = createKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function nearlyEqual(left, right) {
  return Math.abs(Number(left) - Number(right)) < 0.000001;
}

function normalizeCandidateValue(value) {
  return Number(Number(value).toFixed(6));
}
