import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultSourceRoot = 'C:\\PC2\\Codex\\AzPr';
const defaultOutputRoot = path.join(repoRoot, 'src', 'data', 'generated');

const sourceRoot = path.resolve(getArg('--source') ?? process.env.AZPR_DATA_ROOT ?? defaultSourceRoot);
const outputRoot = path.resolve(getArg('--out') ?? defaultOutputRoot);
const generatedAt = new Date().toISOString();

const sourceFiles = {
  heroModules: path.join(sourceRoot, 'BWiki', 'data', 'hero-modules', 'local-all'),
  elementSystem: path.join(sourceRoot, 'BWiki', 'data', 'local-element-system', 'element-system.local.json'),
  kibos: path.join(sourceRoot, 'BWiki', 'data', 'local-kibo-forms', 'all.local-kibo-forms.json'),
  equipment: path.join(sourceRoot, 'BWiki', 'data', 'local-accessory-forms', 'all.local-accessory-forms.json'),
  soulessences: path.join(sourceRoot, 'BWiki', 'data', 'local-soulessence-forms', 'all.local-soulessence-forms.json'),
  enemies: path.join(sourceRoot, 'Assets', 'ResourcesAssets', 'Config', 'NewTable', 'enemy.json'),
  enemyLang: path.join(sourceRoot, 'Assets', 'ResourcesLang', 'chs', 'Table', 'lang_enemy.json'),
  skillLevel: path.join(sourceRoot, 'Assets', 'ResourcesAssets', 'Config', 'NewTable', 'skill_level.json'),
  skillLevelLang: path.join(sourceRoot, 'Assets', 'ResourcesLang', 'chs', 'Table', 'lang_skill_level.json'),
  skillsubLogic: path.join(sourceRoot, 'Assets', 'ResourcesAssets', 'Config', 'NewTable', 'skillsub_logic.json'),
  skillsubEleValue: path.join(sourceRoot, 'Assets', 'ResourcesAssets', 'Config', 'NewTable', 'skillsub_ele_value.json'),
  elementFormula: path.join(sourceRoot, 'Assets', 'ResourcesAssets', 'Config', 'NewTable', 'element_formula.json'),
  unitProperty: path.join(sourceRoot, 'Assets', 'ResourcesAssets', 'Config', 'NewTable', 'unit_property.json'),
  templateValue: path.join(sourceRoot, 'Assets', 'ResourcesAssets', 'Config', 'NewTable', 'template_value.json'),
  battleInfo: path.join(sourceRoot, 'Assets', 'ResourcesAssets', 'Config', 'NewTable', 'battle_info.json'),
  battleInfoLang: path.join(sourceRoot, 'Assets', 'ResourcesLang', 'chs', 'Table', 'lang_battle_info.json'),
  mediaImages: path.join(sourceRoot, 'BWiki', 'knowledge', 'media', 'images'),
};

const requiredPaths = Object.values(sourceFiles);
await assertReadablePaths(requiredPaths);
await fs.mkdir(outputRoot, { recursive: true });

const [
  elementSystem,
  kiboForms,
  equipmentForms,
  soulessenceForms,
  enemyTable,
  enemyLangTable,
  skillLevelTable,
  skillLevelLangTable,
  skillsubLogicTable,
  skillsubEleValueTable,
  elementFormulaTable,
  unitPropertyTable,
  templateValueTable,
  battleInfoTable,
  battleInfoLangTable,
] = await Promise.all([
  readJson(sourceFiles.elementSystem),
  readJson(sourceFiles.kibos),
  readJson(sourceFiles.equipment),
  readJson(sourceFiles.soulessences),
  readJson(sourceFiles.enemies),
  readJson(sourceFiles.enemyLang),
  readJson(sourceFiles.skillLevel),
  readJson(sourceFiles.skillLevelLang),
  readJson(sourceFiles.skillsubLogic),
  readJson(sourceFiles.skillsubEleValue),
  readJson(sourceFiles.elementFormula),
  readJson(sourceFiles.unitProperty),
  readJson(sourceFiles.templateValue),
  readJson(sourceFiles.battleInfo),
  readJson(sourceFiles.battleInfoLang),
]);

const battleInfoLang = mapRowsById(battleInfoLangTable.rows);
const skillLevelLang = mapRowsById(skillLevelLangTable.rows);
const attributeInfoById = new Map(
  battleInfoTable.rows.map((row) => [
    Number(row.attrVal),
    {
      id: Number(row.attrVal),
      key: row.attrID,
      name: battleInfoLang.get(String(row.name))?.value ?? row.attrID,
      isRatio: Boolean(row.isRatio),
      isCalculatedRatio: Boolean(row.isCalRatio),
      showType: row.showType,
      sort: row.sort,
      icon: assetFileName(row.icon),
    },
  ]),
);

const unitProperties = new Map(unitPropertyTable.rows.map((row) => [Number(row.id), row]));
const templateValues = new Map(templateValueTable.rows.map((row) => [Number(row.id), row]));
const enemyLang = mapRowsById(enemyLangTable.rows);

const heroes = await loadHeroModules(sourceFiles.heroModules);
const elements = mapElements(elementSystem);
const { characters, skills } = mapCharactersAndSkills(heroes, attributeInfoById, unitProperties, templateValues);
const enemies = mapEnemies(enemyTable, enemyLang, attributeInfoById, unitProperties, templateValues);
const kibos = mapKibos(kiboForms);
const equipment = mapEquipment(equipmentForms);
const soulessences = mapSoulessences(soulessenceForms);
const mediaIndex = await mapMediaIndex(sourceFiles.mediaImages);
const skillLevelCrossCheck = buildSkillLevelCrossCheck({ skills, skillLevelTable, skillLevelLang });
const skillLogicIndex = buildSkillLogicIndex({ skills, skillLevelTable, skillsubLogicTable, skillsubEleValueTable });
const valueParamIndex = buildValueParamIndex({ skillLogicIndex, elementFormulaTable });
const firstVerticalSlice = buildFirstVerticalSliceData({ characters, skills, enemies });
const workbenchSeed = buildWorkbenchSeedData({ characters, skills, enemies });
const validationReport = buildValidationReport({
  characters,
  skills,
  elements,
  enemies,
  kibos,
  equipment,
  soulessences,
  mediaIndex,
  skillLevelCrossCheck,
  skillLogicIndex,
  valueParamIndex,
});

await Promise.all([
  writeJson('manifest.json', buildManifest(validationReport)),
  writeJson('attributes.json', wrapItems([...attributeInfoById.values()].sort(compareById), sourceFiles.battleInfo)),
  writeJson('elements.json', wrapItems(elements, sourceFiles.elementSystem)),
  writeJson('characters.json', wrapItems(characters, sourceFiles.heroModules)),
  writeJson('skills.json', wrapItems(skills, sourceFiles.heroModules)),
  writeJson('enemies.json', wrapItems(enemies, sourceFiles.enemies)),
  writeJson('kibos.json', wrapItems(kibos, sourceFiles.kibos)),
  writeJson('equipment.json', wrapItems(equipment, sourceFiles.equipment)),
  writeJson('soulessences.json', wrapItems(soulessences, sourceFiles.soulessences)),
  writeJson('media-index.json', mediaIndex),
  writeJson('skill-level-crosscheck.json', skillLevelCrossCheck),
  writeJson('skill-logic-index.json', skillLogicIndex),
  writeJson('value-param-index.json', valueParamIndex),
  writeJson('first-vertical-slice.json', firstVerticalSlice),
  writeJson('workbench-seed.json', workbenchSeed),
  writeJson('validation-report.json', validationReport),
]);

console.log(`Generated AzPr data into ${outputRoot}`);
console.log(JSON.stringify(validationReport.counts, null, 2));

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function assertReadablePaths(paths) {
  const missing = [];
  for (const filePath of paths) {
    try {
      await fs.access(filePath);
    } catch {
      missing.push(filePath);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing AzPr source paths:\n${missing.map((item) => `- ${item}`).join('\n')}`);
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(fileName, data) {
  await fs.writeFile(path.join(outputRoot, fileName), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function buildManifest(validationReport) {
  return {
    schemaVersion: 1,
    generatedAt,
    sourceRoot: normalizePath(sourceRoot),
    outputRoot: normalizePath(outputRoot),
    strategy: 'generated-from-local-azpr-data',
    precisionPolicy: {
      timingSource: 'missing-skill-asset-or-runtime-capture',
      timingFieldsAreAuthoritative: false,
    },
    files: {
      attributes: 'attributes.json',
      elements: 'elements.json',
      characters: 'characters.json',
      skills: 'skills.json',
      enemies: 'enemies.json',
      kibos: 'kibos.json',
      equipment: 'equipment.json',
      soulessences: 'soulessences.json',
      mediaIndex: 'media-index.json',
      skillLevelCrossCheck: 'skill-level-crosscheck.json',
      skillLogicIndex: 'skill-logic-index.json',
      valueParamIndex: 'value-param-index.json',
      firstVerticalSlice: 'first-vertical-slice.json',
      workbenchSeed: 'workbench-seed.json',
      validationReport: 'validation-report.json',
    },
    counts: validationReport.counts,
  };
}

function buildFirstVerticalSliceData({ characters, skills, enemies }) {
  const characterId = 109001;
  const skillId = 10900101;
  const enemyId = 300032;
  const character = characters.find((item) => item.id === characterId) ?? characters[0];
  const skill =
    skills.find((item) => item.id === skillId) ??
    skills.find((item) => item.characterId === character.id) ??
    skills[0];
  const enemy = enemies.find((item) => item.id === enemyId) ?? enemies.find((item) => item.property?.exists) ?? enemies[0];

  return {
    schemaVersion: 1,
    generatedAt,
    source: 'generated-from-local-azpr-data',
    purpose: 'stage-2-domain-schema-and-stage-3-simulation-seed',
    ids: {
      characterId: character.id,
      skillId: skill.id,
      enemyId: enemy.id,
    },
    gameData: {
      characters: [character],
      skills: [skill],
      enemies: [enemy],
    },
  };
}

function buildWorkbenchSeedData({ characters, skills, enemies }) {
  const compactCharacters = characters.map(compactCharacter);
  const compactSkills = skills.map(compactSkill);
  const compactEnemies = enemies.filter((enemy) => enemy.property?.exists).map(compactEnemy);

  return {
    schemaVersion: 1,
    generatedAt,
    source: 'generated-from-local-azpr-data',
    purpose: 'stage-4-workbench-editing-seed',
    defaults: {
      characterId: 109001,
      skillId: 10900101,
      enemyId: 300032,
    },
    counts: {
      characters: compactCharacters.length,
      skills: compactSkills.length,
      enemies: compactEnemies.length,
    },
    gameData: {
      characters: compactCharacters,
      skills: compactSkills,
      enemies: compactEnemies,
    },
  };
}

function compactCharacter(character) {
  return {
    id: character.id,
    name: character.name,
    englishName: character.englishName,
    rarity: character.rarity,
    position: character.position,
    element: character.element,
    weaponType: character.weaponType,
    property: {
      id: character.property.id,
      exists: character.property.exists,
      baseAttributeId: character.property.baseAttributeId,
      baseAttributes: compactBaseAttributes(character.property.baseAttributes),
    },
    icons: {
      avatar: character.icons.avatar,
    },
  };
}

function compactSkill(skill) {
  return {
    id: skill.id,
    characterId: skill.characterId,
    characterName: skill.characterName,
    name: skill.name,
    displayName: skill.displayName,
    displayType: skill.displayType,
    elementId: skill.elementId,
    icon: skill.icon,
    level: skill.level,
    cooldownMs: skill.cooldownMs,
    spCost: skill.spCost,
    needsTimingData: skill.needsTimingData,
    timingSource: skill.timingSource,
    source: skill.source,
  };
}

function compactEnemy(enemy) {
  return {
    id: enemy.id,
    name: enemy.name,
    elementIds: enemy.elementIds,
    enemyType: enemy.enemyType,
    property: {
      id: enemy.property.id,
      exists: enemy.property.exists,
      baseAttributeId: enemy.property.baseAttributeId,
      baseAttributes: compactBaseAttributes(enemy.property.baseAttributes),
    },
    icon: enemy.icon,
  };
}

function compactBaseAttributes(baseAttributes = []) {
  const keys = new Set(['ATK', 'MAXHP', 'DEF', 'MDEF', 'CRI', 'CRI_DMG', 'MAXSP', 'SPR_SEC']);
  return baseAttributes.filter((attribute) => keys.has(attribute.key));
}

function wrapItems(items, sourcePath) {
  return {
    schemaVersion: 1,
    generatedAt,
    source: normalizePath(sourcePath),
    count: items.length,
    items,
  };
}

function mapRowsById(rows = []) {
  return new Map(rows.map((row) => [String(row.id), row]));
}

function buildSkillLevelCrossCheck({ skills, skillLevelTable, skillLevelLang }) {
  const rowsBySkillId = new Map();
  for (const row of skillLevelTable.rows ?? []) {
    const skillId = Number(row.skillId);
    if (!Number.isFinite(skillId)) {
      continue;
    }
    const rows = rowsBySkillId.get(skillId) ?? [];
    rows.push(row);
    rowsBySkillId.set(skillId, rows);
  }

  const items = skills.map((skill) => buildSkillLevelCrossCheckItem(skill, rowsBySkillId, skillLevelLang));
  const summary = summarizeSkillLevelCrossCheck(items);

  return {
    schemaVersion: 1,
    generatedAt,
    sourceKind: 'azpr-newtable-skill-level-crosscheck',
    source: {
      table: normalizePath(sourceFiles.skillLevel),
      langTable: normalizePath(sourceFiles.skillLevelLang),
    },
    count: items.length,
    summary,
    items,
  };
}

function buildSkillLevelCrossCheckItem(skill, rowsBySkillId, skillLevelLang) {
  const rows = rowsBySkillId.get(Number(skill.id)) ?? [];
  const diagnostics = [];
  const rowsByLevel = new Map(rows.map((row) => [Number(row.level), row]));
  const levelCount = Math.max(skill.level?.values?.length ?? 0, rows.length);

  if (rows.length === 0) {
    diagnostics.push({
      code: 'skill-level-crosscheck-row-missing',
      severity: 'warning',
      skillId: skill.id,
      message: 'NewTable/skill_level.json 中缺少该技能的等级行。',
    });
  }

  const levels = Array.from({ length: levelCount }, (_, index) => {
    const level = index + 1;
    return buildSkillLevelCrossCheckLevel(skill, rowsByLevel.get(level), level, index, skillLevelLang);
  });

  for (const level of levels) {
    diagnostics.push(...level.diagnostics);
  }

  return {
    skillId: skill.id,
    characterId: skill.characterId,
    characterName: skill.characterName,
    skillName: skill.name ?? skill.displayName ?? null,
    status: statusFromDiagnostics(diagnostics),
    levelCount,
    matchedLevelCount: levels.filter((level) => level.status === 'matched').length,
    diagnostics,
    levels,
  };
}

function buildSkillLevelCrossCheckLevel(skill, row, level, levelIndex, skillLevelLang) {
  const diagnostics = [];
  const expectedLabels = skill.level?.labels ?? [];
  const expectedValues = skill.level?.values?.[levelIndex] ?? [];

  if (!row) {
    return {
      level,
      levelIndex,
      rowId: null,
      status: 'missing',
      labels: [],
      values: [],
      labelIds: [],
      valueIds: [],
      matches: {
        labels: false,
        values: false,
      },
      diagnostics: [
        {
          code: 'skill-level-crosscheck-level-row-missing',
          severity: 'warning',
          skillId: skill.id,
          level,
          message: 'NewTable/skill_level.json 中缺少该等级行。',
        },
      ],
    };
  }

  const labelIds = splitPipe(row.name);
  const valueIds = splitPipe(row.value);
  const labels = resolveSkillLevelLangValues(labelIds, skillLevelLang, diagnostics, skill.id, level, 'name');
  const values = resolveSkillLevelLangValues(valueIds, skillLevelLang, diagnostics, skill.id, level, 'value');
  const labelMatches = equalStringArrays(labels, expectedLabels);
  const valueMatches = equalStringArrays(values, expectedValues);

  if (!labelMatches) {
    diagnostics.push({
      code: 'skill-level-crosscheck-label-mismatch',
      severity: 'warning',
      skillId: skill.id,
      level,
      expected: expectedLabels,
      actual: labels,
      message: 'hero-module 聚合标签与 NewTable/skill_level.json 还原标签不一致。',
    });
  }

  if (!valueMatches) {
    diagnostics.push({
      code: 'skill-level-crosscheck-value-mismatch',
      severity: 'warning',
      skillId: skill.id,
      level,
      expected: expectedValues,
      actual: values,
      message: 'hero-module 聚合倍率与 NewTable/skill_level.json 还原倍率不一致。',
    });
  }

  return {
    level,
    levelIndex,
    rowId: Number(row.id),
    status: statusFromDiagnostics(diagnostics),
    labels,
    values,
    labelIds,
    valueIds,
    matches: {
      labels: labelMatches,
      values: valueMatches,
    },
    diagnostics,
  };
}

function resolveSkillLevelLangValues(ids, langRows, diagnostics, skillId, level, fieldName) {
  return ids.map((id) => {
    const row = langRows.get(String(id));
    if (!row) {
      diagnostics.push({
        code: 'skill-level-crosscheck-lang-missing',
        severity: 'warning',
        skillId,
        level,
        fieldName,
        langId: id,
        message: 'lang_skill_level.json 中缺少 NewTable 引用的语言 ID。',
      });
      return null;
    }
    return row.value;
  });
}

function summarizeSkillLevelCrossCheck(items) {
  const levels = items.flatMap((item) => item.levels);
  return {
    matchedSkills: items.filter((item) => item.status === 'matched').length,
    missingSkills: items.filter((item) => item.status === 'missing').length,
    mismatchedSkills: items.filter((item) => item.status === 'mismatch').length,
    matchedLevels: levels.filter((level) => level.status === 'matched').length,
    missingLevels: levels.filter((level) => level.status === 'missing').length,
    mismatchedLevels: levels.filter((level) => level.status === 'mismatch').length,
  };
}

function statusFromDiagnostics(diagnostics) {
  if (diagnostics.some((diagnostic) => diagnostic.code.includes('missing') && diagnostic.code.includes('row'))) {
    return 'missing';
  }
  if (diagnostics.length > 0) {
    return 'mismatch';
  }
  return 'matched';
}

function buildSkillLogicIndex({ skills, skillLevelTable, skillsubLogicTable, skillsubEleValueTable }) {
  const skillIds = new Set(skills.map((skill) => Number(skill.id)));
  const skillLevelRowsBySkillId = groupRowsByNumberKey(
    (skillLevelTable.rows ?? []).filter((row) => skillIds.has(Number(row.skillId))),
    'skillId',
  );
  const logicRowsBySubSkillId = new Map(
    (skillsubLogicTable.rows ?? [])
      .map((row) => [Number(row.skillId), row])
      .filter(([skillId]) => Number.isFinite(skillId)),
  );
  const elementRowsBySubSkillAndLevel = new Map();
  for (const row of skillsubEleValueTable.rows ?? []) {
    const key = `${Number(row.skillId)}:${Number(row.level)}`;
    const rows = elementRowsBySubSkillAndLevel.get(key) ?? [];
    rows.push(row);
    elementRowsBySubSkillAndLevel.set(key, rows);
  }

  const items = skills.map((skill) =>
    buildSkillLogicIndexItem(skill, skillLevelRowsBySkillId, logicRowsBySubSkillId, elementRowsBySubSkillAndLevel),
  );
  const summary = summarizeSkillLogicIndex(items);

  return {
    schemaVersion: 1,
    generatedAt,
    sourceKind: 'azpr-newtable-skill-logic-index',
    source: {
      skillLevelTable: normalizePath(sourceFiles.skillLevel),
      skillsubLogicTable: normalizePath(sourceFiles.skillsubLogic),
      skillsubEleValueTable: normalizePath(sourceFiles.skillsubEleValue),
    },
    count: items.length,
    summary,
    items,
  };
}

function buildValueParamIndex({ skillLogicIndex, elementFormulaTable }) {
  const statsByParamId = new Map();
  const formulas = elementFormulaTable.rows ?? [];
  const formulaVariables = uniqueStrings(
    formulas.flatMap((row) => extractFormulaVariables(row.functionOutput)).filter((variable) => variable.length === 1),
  );

  for (const item of skillLogicIndex.items ?? []) {
    for (const level of item.levels ?? []) {
      for (const elementValue of level.elementValues ?? []) {
        for (const param of parseParamPairs(elementValue.valueParam)) {
          const stat = getOrCreateValueParamStat(statsByParamId, param.id);
          stat.rowCount += 1;
          stat.skillIds.add(Number(item.skillId));
          stat.elementIds.add(Number(elementValue.elementId));
          stat.values.add(param.value);
          stat.minValue = Math.min(stat.minValue, param.value);
          stat.maxValue = Math.max(stat.maxValue, param.value);
          if (param.value === 0) {
            stat.zeroCount += 1;
          }
          if (stat.examples.length < 5) {
            stat.examples.push({
              skillId: Number(item.skillId),
              level: Number(level.level),
              rowId: Number(elementValue.rowId),
              elementId: Number(elementValue.elementId),
              valueParam: elementValue.valueParam,
            });
          }
        }
      }
    }
  }

  const params = [...statsByParamId.values()]
    .sort((left, right) => left.id - right.id)
    .map((stat) => createValueParamDescriptor(stat, formulaVariables));
  const unknownParams = params.filter((param) => param.semanticStatus !== 'confirmed');
  const observedSkillIds = uniqueNumbers([...statsByParamId.values()].flatMap((stat) => [...stat.skillIds]));
  const observedElementValueRows = uniqueNumbers(
    params.flatMap((param) => param.examples.map((example) => example.rowId)),
  ).length;

  return {
    schemaVersion: 1,
    generatedAt,
    sourceKind: 'azpr-newtable-value-param-index',
    source: {
      skillLogicIndex: 'skill-logic-index.json',
      skillsubEleValueTable: normalizePath(sourceFiles.skillsubEleValue),
      elementFormulaTable: normalizePath(sourceFiles.elementFormula),
    },
    summary: {
      parameterIds: params.length,
      observedParameterPairs: params.reduce((sum, param) => sum + param.rowCount, 0),
      observedElementValueRows: skillLogicIndex.summary?.elementValueRows ?? observedElementValueRows,
      observedSkills: observedSkillIds.length,
      formulaRows: formulas.length,
      formulaVariables,
      unresolvedParameterIds: unknownParams.map((param) => param.id),
      constantParameterIds: params.filter((param) => param.isConstant).map((param) => param.id),
    },
    params,
  };
}

function getOrCreateValueParamStat(statsByParamId, paramId) {
  if (!statsByParamId.has(paramId)) {
    statsByParamId.set(paramId, {
      id: paramId,
      rowCount: 0,
      skillIds: new Set(),
      elementIds: new Set(),
      values: new Set(),
      minValue: Infinity,
      maxValue: -Infinity,
      zeroCount: 0,
      examples: [],
    });
  }
  return statsByParamId.get(paramId);
}

function createValueParamDescriptor(stat, formulaVariables) {
  const variable = paramIdToFormulaVariable(stat.id);
  const sampleValues = [...stat.values].filter(Number.isFinite).sort((left, right) => left - right).slice(0, 12);
  const isConstant = stat.values.size === 1;
  const roleHint = isConstant
    ? `当前技能范围内恒为 ${sampleValues[0]} 的公式槽位，可能是比例/默认因子；战斗语义未确认。`
    : '当前技能范围内随技能和等级变化的公式槽位；战斗语义未确认。';

  return {
    id: stat.id,
    variable,
    variableSource: formulaVariables.includes(variable)
      ? 'inferred-from-element_formula-variable-convention'
      : 'inferred-slot-name-unseen-in-element_formula',
    label: `参数 ${stat.id}${variable ? ` / ${variable}` : ''}`,
    semanticStatus: 'unresolved',
    category: isConstant ? 'constant-formula-slot' : 'varying-formula-slot',
    roleHint,
    isConstant,
    rowCount: stat.rowCount,
    skillCount: stat.skillIds.size,
    elementCount: stat.elementIds.size,
    skillIds: [...stat.skillIds].sort((left, right) => left - right).slice(0, 20),
    sampleElementIds: [...stat.elementIds].sort((left, right) => left - right).slice(0, 20),
    minValue: Number.isFinite(stat.minValue) ? stat.minValue : null,
    maxValue: Number.isFinite(stat.maxValue) ? stat.maxValue : null,
    zeroCount: stat.zeroCount,
    sampleValues,
    examples: stat.examples,
  };
}

function extractFormulaVariables(functionOutput) {
  if (!functionOutput) {
    return [];
  }
  const reserved = new Set(['IF', 'OR', 'FLOOR', 'ROUND', 'CEILING', 'RANDOM', 'F_MIN', 'F_MAX']);
  return [...String(functionOutput).matchAll(/\b[A-Z][A-Z_]*\b/g)]
    .map((match) => match[0])
    .filter((name) => !reserved.has(name) && name.length === 1);
}

function paramIdToFormulaVariable(paramId) {
  const id = Number(paramId);
  if (!Number.isInteger(id) || id < 1 || id > 26) {
    return '';
  }
  return String.fromCharCode(64 + id);
}

function parseParamPairs(rawValue) {
  if (!rawValue) {
    return [];
  }
  return String(rawValue)
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

function buildSkillLogicIndexItem(skill, skillLevelRowsBySkillId, logicRowsBySubSkillId, elementRowsBySubSkillAndLevel) {
  const skillLevelRows = (skillLevelRowsBySkillId.get(Number(skill.id)) ?? []).sort(
    (left, right) => Number(left.level) - Number(right.level),
  );
  const diagnostics = [];

  if (skillLevelRows.length === 0) {
    diagnostics.push({
      code: 'skill-logic-skill-level-missing',
      severity: 'warning',
      skillId: skill.id,
      message: 'skill_level.json 中缺少该技能等级行，无法映射 skillsub_logic。',
    });
  }

  const subSkills = uniqueNumbers(skillLevelRows.map((row) => row.subSkillId)).map((subSkillId) =>
    buildSubSkillLogicIndex(subSkillId, skill, skillLevelRows, logicRowsBySubSkillId),
  );
  const levels = skillLevelRows.map((row, index) =>
    buildSkillLogicLevelIndex(row, index, elementRowsBySubSkillAndLevel),
  );

  for (const subSkill of subSkills) {
    diagnostics.push(...subSkill.diagnostics);
  }
  for (const level of levels) {
    diagnostics.push(...level.diagnostics);
  }

  return {
    skillId: skill.id,
    characterId: skill.characterId,
    characterName: skill.characterName,
    skillName: skill.name ?? skill.displayName ?? null,
    status: statusFromSkillLogicDiagnostics(diagnostics),
    levelCount: levels.length,
    subSkillIds: subSkills.map((subSkill) => subSkill.subSkillId),
    subSkills,
    levels,
    diagnostics,
  };
}

function buildSubSkillLogicIndex(subSkillId, skill, skillLevelRows, logicRowsBySubSkillId) {
  const diagnostics = [];
  const logicRow = logicRowsBySubSkillId.get(subSkillId);
  const displayPairs = uniqueDisplayTimingPairs(
    skillLevelRows.filter((row) => Number(row.subSkillId) === Number(subSkillId)),
  );

  if (!logicRow) {
    return {
      subSkillId,
      status: 'missing',
      logic: null,
      displayPairs,
      displayMatchesLogic: false,
      diagnostics: [
        {
          code: 'skill-logic-row-missing',
          severity: 'warning',
          skillId: skill.id,
          subSkillId,
          message: 'skillsub_logic.json 中缺少 subSkillId 对应的逻辑行。',
        },
      ],
    };
  }

  const logic = compactSkillLogicRow(logicRow);
  const displayMatchesLogic = displayPairs.some(
    (pair) => pair.cooldownMs === logic.cooldownMs && pair.spCost === logic.spCost,
  );

  if (!displayMatchesLogic) {
    diagnostics.push({
      code: 'skill-display-logic-timing-mismatch',
      severity: 'info',
      skillId: skill.id,
      subSkillId,
      displayPairs,
      logicPair: {
        cooldownMs: logic.cooldownMs,
        spCost: logic.spCost,
      },
      message: 'skill_level 显示层冷却/能量与 skillsub_logic 逻辑层冷却/能量不一致。',
    });
  }

  return {
    subSkillId,
    status: diagnostics.length > 0 ? 'mismatch' : 'mapped',
    logic,
    displayPairs,
    displayMatchesLogic,
    diagnostics,
  };
}

function buildSkillLogicLevelIndex(row, levelIndex, elementRowsBySubSkillAndLevel) {
  const subSkillId = Number(row.subSkillId);
  const level = Number(row.level);
  const elementRows = elementRowsBySubSkillAndLevel.get(`${subSkillId}:${level}`) ?? [];
  const diagnostics = [];

  if (elementRows.length === 0) {
    diagnostics.push({
      code: 'skill-element-value-row-missing',
      severity: 'info',
      skillId: Number(row.skillId),
      subSkillId,
      level,
      message: 'skillsub_ele_value.json 中没有该 subSkillId/level 的数值参数行。',
    });
  }

  return {
    level,
    levelIndex,
    skillLevelRowId: Number(row.id),
    subSkillId,
    display: {
      cooldownMs: numberOrNull(row.coolDown) ?? 0,
      spCost: numberOrNull(row.spCost) ?? 0,
    },
    elementValues: elementRows.map((elementRow) => ({
      rowId: Number(elementRow.id),
      elementId: Number(elementRow.elementId),
      valueParam: elementRow.valueParam ?? '',
    })),
    diagnostics,
  };
}

function compactSkillLogicRow(row) {
  return {
    skillLogicType: numberOrNull(row.skillLogicType),
    skillTag: row.skillTag ?? '',
    petSkillLogicTag: row.petSkillLogicTag ?? '',
    cooldownMs: numberOrNull(row.coolDown) ?? 0,
    mountCooldownMs: numberOrNull(row.mountCoolDown) ?? 0,
    kiboCooldownDefaultMs: numberOrNull(row.kiBoCoolDownDefault) ?? 0,
    kiboVersusCooldownMs: numberOrNull(row.kiBoVersusCoolDown) ?? 0,
    cooldownDefaultMs: numberOrNull(row.coolDownDefault) ?? 0,
    cooldownCount: numberOrNull(row.coolDownCount) ?? 0,
    cooldownCountDefault: numberOrNull(row.coolDownCountDefault) ?? 0,
    spCost: numberOrNull(row.spCost) ?? 0,
    selfCooldownGroup: numberOrNull(row.selfCDGroup) ?? 0,
    selfCooldownMs: numberOrNull(row.selfCD) ?? 0,
    publicCooldownGroup: numberOrNull(row.publicCDGroup) ?? 0,
    publicCooldownMs: numberOrNull(row.publicCD) ?? 0,
    gcdMs: numberOrNull(row.GCD) ?? 0,
    priority: numberOrNull(row.priority) ?? 0,
    castPriority: numberOrNull(row.castPriority) ?? 0,
    targetType: numberOrNull(row.targetType) ?? 0,
  };
}

function summarizeSkillLogicIndex(items) {
  const subSkills = items.flatMap((item) => item.subSkills);
  const levels = items.flatMap((item) => item.levels);
  const elementValueRows = levels.reduce((sum, level) => sum + level.elementValues.length, 0);
  return {
    mappedSkills: items.filter((item) => item.status === 'mapped').length,
    missingSkills: items.filter((item) => item.status === 'missing').length,
    mismatchedSkills: items.filter((item) => item.status === 'mismatch').length,
    subSkillIds: subSkills.length,
    missingLogicRows: subSkills.filter((subSkill) => subSkill.status === 'missing').length,
    displayLogicMismatchSubSkills: subSkills.filter((subSkill) => !subSkill.displayMatchesLogic).length,
    levelRows: levels.length,
    elementValueRows,
    levelsMissingElementValues: levels.filter((level) => level.elementValues.length === 0).length,
    logicRowsWithNonZeroTiming: subSkills.filter((subSkill) => hasNonZeroLogicTiming(subSkill.logic)).length,
  };
}

function statusFromSkillLogicDiagnostics(diagnostics) {
  if (diagnostics.some((diagnostic) => diagnostic.code === 'skill-logic-row-missing')) {
    return 'missing';
  }
  if (diagnostics.some((diagnostic) => diagnostic.code === 'skill-display-logic-timing-mismatch')) {
    return 'mismatch';
  }
  return 'mapped';
}

function hasNonZeroLogicTiming(logic) {
  if (!logic) {
    return false;
  }
  return [
    logic.cooldownMs,
    logic.mountCooldownMs,
    logic.kiboCooldownDefaultMs,
    logic.kiboVersusCooldownMs,
    logic.cooldownDefaultMs,
    logic.spCost,
    logic.selfCooldownMs,
    logic.publicCooldownMs,
    logic.gcdMs,
  ].some((value) => Number(value) !== 0);
}

function uniqueDisplayTimingPairs(rows) {
  const pairs = rows.map((row) => ({
    cooldownMs: numberOrNull(row.coolDown) ?? 0,
    spCost: numberOrNull(row.spCost) ?? 0,
  }));
  return uniqueByKey(pairs, (pair) => `${pair.cooldownMs}:${pair.spCost}`);
}

function uniqueNumbers(values) {
  return [...new Set(values.map((value) => Number(value)).filter(Number.isFinite))].sort((left, right) => left - right);
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value)).filter(Boolean))].sort();
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

function groupRowsByNumberKey(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const value = Number(row[key]);
    if (!Number.isFinite(value)) {
      continue;
    }
    const group = groups.get(value) ?? [];
    group.push(row);
    groups.set(value, group);
  }
  return groups;
}

async function loadHeroModules(heroModulesDir) {
  const names = await fs.readdir(heroModulesDir);
  const jsonNames = names.filter((name) => /^\d+\.hero-module\.local\.json$/.test(name)).sort();
  const modules = [];

  for (const name of jsonNames) {
    const filePath = path.join(heroModulesDir, name);
    const module = await readJson(filePath);
    if (!module.data?.id || module.data.isUsable !== 1) {
      continue;
    }

    modules.push({
      sourceFile: normalizePath(filePath),
      module,
    });
  }

  return modules;
}

function mapElements(elementSystem) {
  return elementSystem.elements
    .map((element) => ({
      id: Number(element.id),
      name: element.name,
      abbrName: element.abbrName,
      color: element.elementColor,
      icons: {
        skill: firstAssetFile(element.skillElem),
        pet: firstAssetFile(element.petElem),
        puzzle: firstAssetFile(element.petPuzzleIcon),
        dungeon: firstAssetFile(element.dungeonElementIcon),
      },
      restraint: mapRestraint(element.restraint),
      kiboRestraint: mapRestraint(element.kiboRestraint),
    }))
    .sort(compareById);
}

function mapCharactersAndSkills(heroModules, attributeInfoById, unitProperties, templateValues) {
  const characters = [];
  const skills = [];

  for (const { sourceFile, module } of heroModules) {
    const hero = module.data;
    const skillSlots = [
      ...parseSkillSlotList(hero.skillList, 'ground'),
      ...parseSkillSlotList(hero.aerialSkillList, 'aerial'),
      ...parseSkillSlotList(hero.passiveSkillList, 'passive'),
      ...parseSkillSlotList(hero.backupSkillList, 'backup'),
    ];
    const slotBySkillId = new Map();
    for (const slot of skillSlots) {
      const current = slotBySkillId.get(slot.skillId) ?? [];
      current.push({ group: slot.group, slot: slot.slot });
      slotBySkillId.set(slot.skillId, current);
    }

    characters.push({
      id: Number(hero.id),
      name: hero.name,
      englishName: hero.englishName,
      rarity: {
        id: numberOrNull(hero.rarity?.id),
        name: hero.rarity?.name ?? null,
      },
      position: {
        name: hero.position?.name ?? null,
        icon: firstString(hero.position?.icon),
        description: cleanMarkup(hero.position?.desc),
      },
      element: mapInlineElement(hero.element),
      weaponType: {
        id: numberOrNull(hero.weaponType?.id),
        name: hero.weaponType?.typeName ?? null,
      },
      battleTags: (hero.battleTag ?? []).map((tag) => ({
        id: Number(tag.id),
        title: tag.title,
        description: cleanMarkup(tag.desc),
        color: tag.color,
      })),
      cost: numberOrNull(hero.cost),
      unitId: numberOrNull(hero.unitId),
      property: mapProperty(hero.propertyId, attributeInfoById, unitProperties, templateValues),
      icons: {
        avatar: firstString(hero.avatarTexture),
        all: normalizeStringArray(hero.avatarTexture),
      },
      description: cleanMarkup(hero.dec),
      skillIds: Object.values(hero.skillSystem ?? {})
        .map((skill) => Number(skill.id))
        .filter(Boolean),
      skillSlots,
      skillAssetPaths: parseAssetPathList(hero.skillBytesPath),
      source: {
        heroModule: sourceFile,
      },
    });

    for (const skill of Object.values(hero.skillSystem ?? {})) {
      const skillId = Number(skill.id);
      if (!skillId) {
        continue;
      }

      skills.push({
        id: skillId,
        characterId: Number(hero.id),
        characterName: hero.name,
        name: normalizeZeroName(skill.name),
        displayName: normalizeZeroName(skill.skillName),
        skillType: numberOrNull(skill.skillType),
        displayType: numberOrNull(skill.skillDisplayType),
        elementId: numberOrNull(skill.skillElement),
        icon: skill.icon ?? null,
        battleIcon: skill.battleSkillIcon ?? null,
        description: {
          raw: skill.skillDescribe ?? '',
          plain: cleanMarkup(skill.skillDescribe),
          special: cleanMarkup(skill.skillSpecialDesc),
        },
        level: {
          labels: normalizeStringArray(skill.skillLevel?.name),
          costs: normalizeArray(skill.skillLevel?.golds),
          values: normalizeArray(skill.skillLevel?.values),
        },
        cooldownMs: numberOrNull(skill.skillsub_logic?.coolDown),
        spCost: numberOrNull(skill.skillsub_logic?.spCost),
        slots: slotBySkillId.get(skillId) ?? [],
        needsTimingData: true,
        timingSource: 'missing-skill-asset-or-runtime-capture',
        source: {
          heroModule: sourceFile,
        },
      });
    }
  }

  return {
    characters: characters.sort(compareById),
    skills: skills.sort(compareByCharacterThenId),
  };
}

function mapEnemies(enemyTable, enemyLang, attributeInfoById, unitProperties, templateValues) {
  return enemyTable.rows
    .filter((enemy) => enemy.isUsable === 1)
    .map((enemy) => ({
      id: Number(enemy.id),
      name: enemyLang.get(String(enemy.name))?.value ?? String(enemy.name),
      description: cleanMarkup(enemyLang.get(String(enemy.desc))?.value ?? ''),
      unitId: numberOrNull(enemy.unitId),
      enemyType: numberOrNull(enemy.enemyType),
      elementIds: parseNumberList(enemy.element),
      hpBarType: numberOrNull(enemy.hpBarType),
      hpBarWeakness: Boolean(enemy.hpBarWeakness),
      property: mapProperty(enemy.propertyId, attributeInfoById, unitProperties, templateValues),
      worldProperty: mapProperty(enemy.worldPropertyId, attributeInfoById, unitProperties, templateValues),
      skillIds: parseSkillSlotList(enemy.skillList, 'enemy').map((item) => item.skillId),
      passiveSkillIds: parseNumberList(enemy.passiveSkillList),
      skillAssetPaths: parseAssetPathList(enemy.skillBytesPath),
      icon: assetFileName(enemy.avatarTexture),
      petId: numberOrNull(enemy.petId),
      collisionType: numberOrNull(enemy.collisionType),
      source: {
        table: normalizePath(sourceFiles.enemies),
      },
    }))
    .sort(compareById);
}

function mapKibos(kiboForms) {
  return kiboForms.forms
    .map((form) => {
      const fields = fieldsToMap(form.main?.fields);
      return {
        id: numberOrNull(fields.get('id') ?? form.main?.localId),
        name: fields.get('名称') ?? form.title,
        element: fields.get('元素') ?? '',
        race: fields.get('种族') ?? '',
        stage: fields.get('阶段') ?? '',
        tags: splitTextList(fields.get('标签')),
        size: fields.get('体型') ?? '',
        jobs: splitTextList(fields.get('家园工种')),
        drops: splitTextList(fields.get('掉落素材')),
        description: cleanMarkup(fields.get('描述')),
        traits: [1, 2, 3]
          .map((index) => ({
            name: fields.get(`特性${index}`) ?? '',
            description: cleanMarkup(fields.get(`特性${index}描述`)),
          }))
          .filter((trait) => trait.name || trait.description),
        skills: [
          mapFormSkill(fields, '固定技能'),
          mapFormSkill(fields, '技能1'),
          mapFormSkill(fields, '合击技能'),
        ].filter(Boolean),
        evolution: {
          series: fields.get('进化系列') ?? '',
          next: fields.get('进化下级') ?? '',
          nextMaterial: fields.get('进化下级材料') ?? '',
          nextLevel: numberOrNull(fields.get('进化下级等级')),
        },
      };
    })
    .sort(compareById);
}

function mapEquipment(equipmentForms) {
  return equipmentForms.forms
    .map((form) => {
      const fields = fieldsToMap(form.main?.fields);
      return {
        id: numberOrNull(fields.get('id') ?? form.main?.localId),
        name: fields.get('名称') ?? form.title,
        type: fields.get('类型') ?? '',
        rarity: fields.get('稀有度') ?? '',
        icon: fields.get('图片') ?? '',
        set: fields.get('套装') ?? '',
        mainAttributes: mapIndexedAttributes(fields, '主属性'),
        subAttributes: mapIndexedAttributes(fields, '副属性'),
        description: cleanMarkup(fields.get('描述')),
        acquire: splitTextList(fields.get('获取方式')),
        unreleased: Boolean(form.unreleased),
      };
    })
    .sort(compareById);
}

function mapSoulessences(soulessenceForms) {
  return soulessenceForms.forms
    .map((form) => {
      const fields = fieldsToMap(form.main?.fields);
      return {
        id: numberOrNull(fields.get('id') ?? form.main?.localId),
        name: fields.get('名称') ?? form.title,
        icons: {
          large: fields.get('图片') ?? '',
          small: fields.get('图片2') ?? '',
        },
        rarity: fields.get('稀有度') ?? '',
        profession: fields.get('职业') ?? '',
        attribute: fields.get('属性') ?? '',
        baseStats: mapNamedStats(fields, ''),
        level80Stats: mapNamedStats(fields, '80'),
        description: cleanMarkup(fields.get('描述')),
        skill: {
          name: fields.get('技能') ?? '',
          description: cleanMarkup(fields.get('技能描述')),
          maxRankDescription: cleanMarkup(fields.get('满星技能描述')),
        },
        relatedCharacters: splitTextList(fields.get('相关角色')),
      };
    })
    .sort(compareById);
}

async function mapMediaIndex(mediaRoot) {
  const files = await listFiles(mediaRoot);
  const imageFiles = files
    .filter((filePath) => /\.(png|jpe?g|webp|gif)$/i.test(filePath))
    .map((filePath) => {
      const relativePath = normalizePath(path.relative(mediaRoot, filePath));
      return {
        fileName: path.basename(filePath),
        relativePath,
      };
    })
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'zh-CN'));

  const duplicateFileNames = findDuplicateNames(imageFiles.map((item) => item.fileName));

  return {
    schemaVersion: 1,
    generatedAt,
    source: normalizePath(mediaRoot),
    count: imageFiles.length,
    duplicateFileNameCount: duplicateFileNames.length,
    duplicateFileNames,
    items: imageFiles,
  };
}

async function listFiles(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function buildValidationReport(data) {
  const missingEnemyPropertyIds = data.enemies
    .filter((enemy) => !enemy.property.exists)
    .map((enemy) => enemy.id);
  const missingWorldEnemyPropertyIds = data.enemies
    .filter((enemy) => enemy.worldProperty.id && !enemy.worldProperty.exists)
    .map((enemy) => enemy.id);
  const missingCharacterPropertyIds = data.characters
    .filter((character) => !character.property.exists)
    .map((character) => character.id);
  const skillTimingMissingCount = data.skills.filter((skill) => skill.needsTimingData).length;
  const skillNoLevelValues = data.skills.filter((skill) => skill.level.values.length === 0).map((skill) => skill.id);
  const skillLevelCrossCheckSummary = data.skillLevelCrossCheck?.summary ?? {};
  const skillLevelCrossCheckMissingCount =
    (skillLevelCrossCheckSummary.missingSkills ?? 0) + (skillLevelCrossCheckSummary.missingLevels ?? 0);
  const skillLevelCrossCheckMismatchCount =
    (skillLevelCrossCheckSummary.mismatchedSkills ?? 0) + (skillLevelCrossCheckSummary.mismatchedLevels ?? 0);
  const skillLogicSummary = data.skillLogicIndex?.summary ?? {};
  const valueParamSummary = data.valueParamIndex?.summary ?? {};
  const nonAzPrPlaceholderNames = ['云堇', '钟离', '甘雨', '雷电将军', '温迪', '可莉'];
  const placeholderCharacters = data.characters
    .filter((character) => nonAzPrPlaceholderNames.includes(character.name))
    .map((character) => character.name);

  const warnings = [
    {
      code: 'skill-timing-missing',
      severity: 'info',
      count: skillTimingMissingCount,
      message: '技能命中帧、动作时长和取消窗口尚未从 asset 或运行时捕获获得，已统一标记 needsTimingData。',
    },
    {
      code: 'enemy-property-missing',
      severity: missingEnemyPropertyIds.length > 0 ? 'warning' : 'ok',
      count: missingEnemyPropertyIds.length,
      ids: missingEnemyPropertyIds,
      message: '敌人 propertyId 未能在 unit_property.json 中找到。',
    },
    {
      code: 'enemy-world-property-missing',
      severity: missingWorldEnemyPropertyIds.length > 0 ? 'warning' : 'ok',
      count: missingWorldEnemyPropertyIds.length,
      ids: missingWorldEnemyPropertyIds,
      message: '敌人 worldPropertyId 未能在 unit_property.json 中找到。',
    },
    {
      code: 'character-property-missing',
      severity: missingCharacterPropertyIds.length > 0 ? 'warning' : 'ok',
      count: missingCharacterPropertyIds.length,
      ids: missingCharacterPropertyIds,
      message: '角色 propertyId 未能在 unit_property.json 中找到。',
    },
    {
      code: 'skill-level-values-missing',
      severity: skillNoLevelValues.length > 0 ? 'warning' : 'ok',
      count: skillNoLevelValues.length,
      ids: skillNoLevelValues,
      message: '技能缺少等级倍率表。',
    },
    {
      code: 'skill-level-crosscheck-missing',
      severity: skillLevelCrossCheckMissingCount > 0 ? 'warning' : 'ok',
      count: skillLevelCrossCheckMissingCount,
      summary: skillLevelCrossCheckSummary,
      message: '技能倍率在 NewTable/skill_level.json 字段级校验中存在缺失行。',
    },
    {
      code: 'skill-level-crosscheck-mismatch',
      severity: skillLevelCrossCheckMismatchCount > 0 ? 'warning' : 'ok',
      count: skillLevelCrossCheckMismatchCount,
      summary: skillLevelCrossCheckSummary,
      message: 'hero-module 聚合倍率与 NewTable/skill_level.json 还原结果存在差异。',
    },
    {
      code: 'skill-logic-row-missing',
      severity: (skillLogicSummary.missingLogicRows ?? 0) > 0 ? 'warning' : 'ok',
      count: skillLogicSummary.missingLogicRows ?? 0,
      summary: skillLogicSummary,
      message: 'skillsub_logic.json 中缺少当前角色技能引用的 subSkillId。',
    },
    {
      code: 'skill-display-logic-timing-mismatch',
      severity: (skillLogicSummary.displayLogicMismatchSubSkills ?? 0) > 0 ? 'info' : 'ok',
      count: skillLogicSummary.displayLogicMismatchSubSkills ?? 0,
      summary: skillLogicSummary,
      message: 'skill_level 显示层 coolDown/spCost 与 skillsub_logic 逻辑层 coolDown/spCost 不一致，排轴应优先区分字段来源。',
    },
    {
      code: 'skill-element-value-row-missing',
      severity: (skillLogicSummary.levelsMissingElementValues ?? 0) > 0 ? 'info' : 'ok',
      count: skillLogicSummary.levelsMissingElementValues ?? 0,
      summary: skillLogicSummary,
      message: '部分技能等级没有 skillsub_ele_value 数值参数行，可能是被动、纯逻辑或无需倍率参数的技能。',
    },
    {
      code: 'skill-value-param-semantic-unresolved',
      severity: (valueParamSummary.unresolvedParameterIds?.length ?? 0) > 0 ? 'info' : 'ok',
      count: valueParamSummary.unresolvedParameterIds?.length ?? 0,
      ids: valueParamSummary.unresolvedParameterIds ?? [],
      summary: valueParamSummary,
      message: 'valueParam 参数 ID 已建立公式槽位统计，但战斗语义仍未确认，不能直接写入伤害公式。',
    },
    {
      code: 'non-azpr-placeholder-character',
      severity: placeholderCharacters.length > 0 ? 'error' : 'ok',
      count: placeholderCharacters.length,
      names: placeholderCharacters,
      message: '新版生成数据不应包含非蓝色星原占位角色。',
    },
    {
      code: 'duplicate-media-file-name',
      severity: data.mediaIndex.duplicateFileNameCount > 0 ? 'warning' : 'ok',
      count: data.mediaIndex.duplicateFileNameCount,
      names: data.mediaIndex.duplicateFileNames.slice(0, 50),
      message: '媒体目录存在同名文件，按文件名反查图标时需处理歧义。',
    },
  ];

  return {
    schemaVersion: 1,
    generatedAt,
    sourceRoot: normalizePath(sourceRoot),
    counts: {
      attributes: attributeInfoById.size,
      elements: data.elements.length,
      characters: data.characters.length,
      skills: data.skills.length,
      enemies: data.enemies.length,
      kibos: data.kibos.length,
      equipment: data.equipment.length,
      soulessences: data.soulessences.length,
      mediaFiles: data.mediaIndex.count,
      skillLevelCrossCheck: data.skillLevelCrossCheck?.count ?? 0,
      skillLogicIndex: data.skillLogicIndex?.count ?? 0,
      valueParamIndex: data.valueParamIndex?.summary?.parameterIds ?? 0,
    },
    warnings,
  };
}

function mapProperty(propertyId, attributeInfoById, unitProperties, templateValues) {
  const id = numberOrNull(propertyId);
  const unitProperty = id == null ? null : unitProperties.get(id);
  const baseAttributeId = unitProperty?.baseAttributeId ?? null;
  const templateValue = baseAttributeId == null ? null : templateValues.get(Number(baseAttributeId));

  return {
    id,
    exists: Boolean(unitProperty),
    baseAttributeId: numberOrNull(baseAttributeId),
    baseAttributes: parseBaseAttributes(templateValue?.baseAttribute, attributeInfoById),
  };
}

function parseBaseAttributes(raw, attributeInfoById) {
  if (!raw) {
    return [];
  }

  return String(raw)
    .split('|')
    .map((pair) => {
      const [idText, valueText] = pair.split('#');
      const id = Number(idText);
      const info = attributeInfoById.get(id);
      return {
        id,
        key: info?.key ?? String(id),
        name: info?.name ?? String(id),
        value: Number(valueText),
        isRatio: Boolean(info?.isRatio),
      };
    })
    .filter((item) => Number.isFinite(item.id) && Number.isFinite(item.value));
}

function mapInlineElement(element) {
  if (!element) {
    return null;
  }

  return {
    id: numberOrNull(element.id),
    name: element.name ?? null,
    abbrName: element.abbrName ?? null,
    color: element.elementColor ?? null,
    icon: assetFileName(element.skillElem),
  };
}

function mapRestraint(restraint = []) {
  return restraint.map((item) => ({
    targetId: Number(item.targetId),
    value: Number(item.value),
    percent: Number(item.percent),
  }));
}

function mapFormSkill(fields, prefix) {
  const name = fields.get(prefix);
  if (!name) {
    return null;
  }

  return {
    name,
    icon: fields.get(`${prefix}图`) ?? '',
    element: fields.get(`${prefix}元素`) ?? '',
    descriptionsByLevel: [1, 2, 3, 4, 5]
      .map((level) => ({
        level,
        description: cleanMarkup(fields.get(`${prefix}描述${level}`)),
      }))
      .filter((item) => item.description),
    needsTimingData: true,
    timingSource: 'missing-skill-asset-or-runtime-capture',
  };
}

function mapIndexedAttributes(fields, prefix) {
  const attributes = [];
  for (let index = 1; index <= 4; index += 1) {
    const name = fields.get(`${prefix}${index}`);
    const value = fields.get(`${prefix}${index}值`);
    if (name || value) {
      attributes.push({ name: name ?? '', value: value ?? '' });
    }
  }
  return attributes;
}

function mapNamedStats(fields, prefix) {
  const names = ['基础生命', '基础攻击', '基础物理防御', '基础魔法防御', '治疗加成', '攻击', '生命'];
  const stats = {};
  for (const name of names) {
    const value = fields.get(`${prefix}${name}`);
    if (value) {
      stats[name] = value;
    }
  }
  return stats;
}

function fieldsToMap(fields = []) {
  return new Map(fields.map((field) => [field.name, field.value]));
}

function splitPipe(raw) {
  if (raw == null || raw === '') {
    return [];
  }
  return String(raw)
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function equalStringArrays(left = [], right = []) {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((item, index) => item === right[index]);
}

function parseSkillSlotList(raw, group) {
  if (!raw) {
    return [];
  }

  return String(raw)
    .split('|')
    .map((item) => {
      const [slotText, skillText] = item.includes('#') ? item.split('#') : [null, item];
      return {
        group,
        slot: slotText == null ? null : numberOrNull(slotText),
        skillId: numberOrNull(skillText),
      };
    })
    .filter((item) => item.skillId != null);
}

function parseNumberList(raw) {
  if (!raw) {
    return [];
  }

  return String(raw)
    .split('|')
    .flatMap((part) => part.split(','))
    .map((value) => numberOrNull(value.includes('#') ? value.split('#').at(-1) : value))
    .filter((value) => value != null);
}

function parseAssetPathList(raw) {
  if (!raw) {
    return [];
  }

  return String(raw)
    .split('|')
    .flatMap((group) => group.split(','))
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitTextList(raw) {
  if (!raw) {
    return [];
  }

  return String(raw)
    .split(/[、,，|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  return value ? [String(value)] : [];
}

function firstString(value) {
  return normalizeStringArray(value)[0] ?? null;
}

function firstAssetFile(value) {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.file ?? assetFileName(first?.raw ?? first);
}

function assetFileName(value) {
  if (!value) {
    return null;
  }

  const first = String(value).split(',').at(-1)?.trim() ?? '';
  return first.split(/[\\/]/).at(-1) || null;
}

function cleanMarkup(value) {
  if (!value) {
    return '';
  }

  return String(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?color[^>]*>/gi, '')
    .replace(/<\/?span[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

function normalizeZeroName(value) {
  if (value == null || value === '' || value === '0') {
    return null;
  }
  return String(value);
}

function numberOrNull(value) {
  if (value == null || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizePath(filePath) {
  return filePath.replaceAll('\\', '/');
}

function findDuplicateNames(names) {
  const counts = new Map();
  for (const name of names) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function compareById(a, b) {
  return Number(a.id) - Number(b.id);
}

function compareByCharacterThenId(a, b) {
  return Number(a.characterId) - Number(b.characterId) || Number(a.id) - Number(b.id);
}
