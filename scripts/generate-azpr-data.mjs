import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const defaultSourceRoot = 'C:\\PC2\\Codex\\AzPr';
const defaultExtractorRoot = 'C:\\Codex\\AzPr Extractor';
const defaultOutputRoot = path.join(repoRoot, 'src', 'data', 'generated');

const sourceRoot = path.resolve(
  getArg('--source') ?? process.env.AZPR_DATA_ROOT ?? defaultSourceRoot
);
const extractorRoot = path.resolve(
  getArg('--extractor') ??
    process.env.AZPR_EXTRACTOR_ROOT ??
    defaultExtractorRoot
);
const outputRoot = path.resolve(getArg('--out') ?? defaultOutputRoot);
const generatedAt = new Date().toISOString();
const extractorSkillListRoot = path.join(
  extractorRoot,
  'ExtractedAssets',
  'Unity',
  'default_package',
  'ResourcesAssets',
  'Config',
  'Battle',
  'SkillList'
);
const extractorYooIndexRoot = path.join(
  extractorRoot,
  'outputs',
  'axis-skill-yoo-index'
);

const sourceFiles = {
  heroModules: path.join(
    sourceRoot,
    'BWiki',
    'data',
    'hero-modules',
    'local-all'
  ),
  elementSystem: path.join(
    sourceRoot,
    'BWiki',
    'data',
    'local-element-system',
    'element-system.local.json'
  ),
  kibos: path.join(
    sourceRoot,
    'BWiki',
    'data',
    'local-kibo-forms',
    'all.local-kibo-forms.json'
  ),
  equipment: path.join(
    sourceRoot,
    'BWiki',
    'data',
    'local-accessory-forms',
    'all.local-accessory-forms.json'
  ),
  soulessences: path.join(
    sourceRoot,
    'BWiki',
    'data',
    'local-soulessence-forms',
    'all.local-soulessence-forms.json'
  ),
  enemies: path.join(
    sourceRoot,
    'Assets',
    'ResourcesAssets',
    'Config',
    'NewTable',
    'enemy.json'
  ),
  enemyLang: path.join(
    sourceRoot,
    'Assets',
    'ResourcesLang',
    'chs',
    'Table',
    'lang_enemy.json'
  ),
  skillLevel: path.join(
    sourceRoot,
    'Assets',
    'ResourcesAssets',
    'Config',
    'NewTable',
    'skill_level.json'
  ),
  skillLevelLang: path.join(
    sourceRoot,
    'Assets',
    'ResourcesLang',
    'chs',
    'Table',
    'lang_skill_level.json'
  ),
  skillTable: path.join(
    sourceRoot,
    'Assets',
    'ResourcesAssets',
    'Config',
    'NewTable',
    'skill.json'
  ),
  heroTable: path.join(
    sourceRoot,
    'Assets',
    'ResourcesAssets',
    'Config',
    'NewTable',
    'hero.json'
  ),
  heroTestTable: path.join(
    sourceRoot,
    'Assets',
    'ResourcesAssets',
    'Config',
    'NewTable',
    'hero_test.json'
  ),
  petTable: path.join(
    sourceRoot,
    'Assets',
    'ResourcesAssets',
    'Config',
    'NewTable',
    'pet.json'
  ),
  kiboDuelTable: path.join(
    sourceRoot,
    'Assets',
    'ResourcesAssets',
    'Config',
    'NewTable',
    'kibo_duel.json'
  ),
  worldItemTable: path.join(
    sourceRoot,
    'Assets',
    'ResourcesAssets',
    'Config',
    'NewTable',
    'world_item.json'
  ),
  worldResourceTable: path.join(
    sourceRoot,
    'Assets',
    'ResourcesAssets',
    'Config',
    'NewTable',
    'world_resource.json'
  ),
  battlefieldItemTable: path.join(
    sourceRoot,
    'Assets',
    'ResourcesAssets',
    'Config',
    'NewTable',
    'battlefield_item.json'
  ),
  skillsubLogic: path.join(
    sourceRoot,
    'Assets',
    'ResourcesAssets',
    'Config',
    'NewTable',
    'skillsub_logic.json'
  ),
  skillsubEleValue: path.join(
    sourceRoot,
    'Assets',
    'ResourcesAssets',
    'Config',
    'NewTable',
    'skillsub_ele_value.json'
  ),
  elementFormula: path.join(
    sourceRoot,
    'Assets',
    'ResourcesAssets',
    'Config',
    'NewTable',
    'element_formula.json'
  ),
  unitProperty: path.join(
    sourceRoot,
    'Assets',
    'ResourcesAssets',
    'Config',
    'NewTable',
    'unit_property.json'
  ),
  templateValue: path.join(
    sourceRoot,
    'Assets',
    'ResourcesAssets',
    'Config',
    'NewTable',
    'template_value.json'
  ),
  templateHero: path.join(
    sourceRoot,
    'Assets',
    'ResourcesAssets',
    'Config',
    'NewTable',
    'template_hero.json'
  ),
  talentRank: path.join(
    sourceRoot,
    'Assets',
    'ResourcesAssets',
    'Config',
    'NewTable',
    'talent_rank.json'
  ),
  talentRune: path.join(
    sourceRoot,
    'Assets',
    'ResourcesAssets',
    'Config',
    'NewTable',
    'talent_rune.json'
  ),
  battleInfo: path.join(
    sourceRoot,
    'Assets',
    'ResourcesAssets',
    'Config',
    'NewTable',
    'battle_info.json'
  ),
  battleInfoLang: path.join(
    sourceRoot,
    'Assets',
    'ResourcesLang',
    'chs',
    'Table',
    'lang_battle_info.json'
  ),
  roleAttributeWorkbook: path.join(
    sourceRoot,
    'BWiki',
    'generated',
    'spreadsheets',
    'role-attribute-dynamic-current-rank.xlsx'
  ),
  mediaImages: path.join(sourceRoot, 'BWiki', 'knowledge', 'media', 'images'),
};

const ROLE_PANEL_CORE_ATTRIBUTE_KEYS = Object.freeze({
  攻击: 'attack',
  生命: 'maxHp',
  物理防御: 'physicalDefense',
  魔法防御: 'magicalDefense',
  调谐强度: 'tuningStrength',
  暴击率: 'critRate',
  暴击伤害: 'critDamage',
  伤害增幅: 'damageAmplification',
  伤害减免: 'damageReduction',
});

const ROLE_PANEL_DISPLAY_ATTRIBUTE_NAMES = new Set([
  '攻击',
  '生命',
  '物理防御',
  '魔法防御',
  '调谐强度',
  '暴击率',
  '暴击伤害',
  '伤害增幅',
  '伤害减免',
  '治疗加成',
  '能量回复增幅',
]);

const ROLE_PANEL_DESIRED_ATTR_NAMES = [
  '攻击',
  '物理防御',
  '魔法防御',
  '生命',
  '调谐强度',
  '暴击率',
  '暴击伤害',
  '伤害增幅',
  '伤害减免',
  '物理伤害增幅',
  '魔法伤害增幅',
  '物理伤害减免',
  '魔法伤害减免',
  '攻击加成',
  '物理防御加成',
  '魔法防御加成',
  '生命加成',
  '风属性伤害增幅',
  '雷属性伤害增幅',
  '火属性伤害增幅',
  '水属性伤害增幅',
  '木属性伤害增幅',
  '冰属性伤害增幅',
  '地属性伤害增幅',
  '光属性伤害增幅',
  '暗属性伤害增幅',
  '治疗加成',
  '架势条破坏效率',
  '能量回复增幅',
];

const NORMALIZED_BASE_ATTRIBUTE_IDS = new Set([1, 3, 4, 5, 35, 229]);
const ENEMY_BASE_DEFENSE_ATTRIBUTE_KEYS = Object.freeze(['DEF', 'MDEF']);
const ELEMENT_DEFENSE_ATTRIBUTE_KEYS = Object.freeze([
  'NORMAL_DEFENSE',
  'FIRE_DEFENSE',
  'WIND_DEFENSE',
  'EARTH_DEFENSE',
  'WOOD_DEFENSE',
  'ICE_DEFENSE',
  'WATER_DEFENSE',
  'ELEC_DEFENSE',
  'LIGHT_DEFENSE',
  'DARK_DEFENSE',
]);
const WEAK_POINT_DAMAGE_ATTRIBUTE_KEYS = Object.freeze([
  'WDM_PHYSICAL',
  'WDM_MAGIC',
  'WDM_HEAL',
  'WDM_NORMAL',
  'WDM_FIRE',
  'WDM_WIND',
  'WDM_EARTH',
  'WDM_WOOD',
  'WDM_ICE',
  'WDM_WATER',
  'WDM_ELEC',
  'WDM_LIGHT',
  'WDM_DARK',
  'WDM_MIN',
  'WDM_MAX',
]);
const SKILL_CONTROL_SAMPLE_FILE_LIMIT = 80;
const SKILL_CONTROL_SAMPLE_NODE_LIMIT = 8;
const SKILL_EFFECT_LANE_SAMPLE_LIMIT = 12;
const SKILL_EFFECT_LANES = Object.freeze([
  {
    key: 'hpDamage',
    label: '敌人 HP 伤害',
    patterns: [/攻击碰撞/, /伤害/, /\bdamage\b/i, /\bhit\b/i],
  },
  {
    key: 'toughnessDamage',
    label: '敌人韧性削减',
    patterns: [/韧/, /失衡/, /削韧/, /破衡/, /\bstagger\b/i, /\btough/i],
  },
  {
    key: 'selfEnergyChange',
    label: '自身能量变化',
    patterns: [/能量/, /充能/, /蓄能/, /回能/, /\bsp\b/i, /\benergy\b/i, /\bcharge\b/i],
  },
  {
    key: 'elementEffect',
    label: '元素/属性效果',
    patterns: [/元素/, /\belement\b/i],
  },
  {
    key: 'timingControl',
    label: '动作/时序控制',
    patterns: [/动作/, /跳转/, /打断/, /连击/, /桥接/, /移动/, /位移/, /前摇/, /全程/],
  },
  {
    key: 'presentation',
    label: '表现/音画资源',
    patterns: [/SFX/i, /特效/, /镜头/, /\bVO\b/i, /武器/, /广播/, /宠物响应/],
  },
]);
const SKILL_ASSET_EVIDENCE_TABLES = Object.freeze([
  {
    key: 'heroTable',
    name: 'hero.json',
    ownerKind: 'hero',
    skillFields: [
      'attackSkill',
      'skillList',
      'aerialSkillList',
      'passiveSkillList',
      'backupSkillList',
      'skillSystem',
    ],
  },
  {
    key: 'enemyTable',
    name: 'enemy.json',
    ownerKind: 'enemy',
    skillFields: ['skillList'],
  },
  {
    key: 'heroTestTable',
    name: 'hero_test.json',
    ownerKind: 'hero-test',
    skillFields: ['skillList'],
  },
  {
    key: 'petTable',
    name: 'pet.json',
    ownerKind: 'pet',
    skillFields: ['skillList'],
  },
  {
    key: 'kiboDuelTable',
    name: 'kibo_duel.json',
    ownerKind: 'kibo-duel',
    skillFields: ['skillList'],
  },
  {
    key: 'worldItemTable',
    name: 'world_item.json',
    ownerKind: 'world-item',
    skillFields: ['skillList'],
  },
  {
    key: 'worldResourceTable',
    name: 'world_resource.json',
    ownerKind: 'world-resource',
    skillFields: ['skillList'],
  },
  {
    key: 'battlefieldItemTable',
    name: 'battlefield_item.json',
    ownerKind: 'battlefield-item',
    skillFields: ['skillList'],
  },
]);

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
  skillTable,
  heroTable,
  heroTestTable,
  petTable,
  kiboDuelTable,
  worldItemTable,
  worldResourceTable,
  battlefieldItemTable,
  skillsubLogicTable,
  skillsubEleValueTable,
  elementFormulaTable,
  unitPropertyTable,
  templateValueTable,
  templateHeroTable,
  talentRankTable,
  talentRuneTable,
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
  readJson(sourceFiles.skillTable),
  readJson(sourceFiles.heroTable),
  readJson(sourceFiles.heroTestTable),
  readJson(sourceFiles.petTable),
  readJson(sourceFiles.kiboDuelTable),
  readJson(sourceFiles.worldItemTable),
  readJson(sourceFiles.worldResourceTable),
  readJson(sourceFiles.battlefieldItemTable),
  readJson(sourceFiles.skillsubLogic),
  readJson(sourceFiles.skillsubEleValue),
  readJson(sourceFiles.elementFormula),
  readJson(sourceFiles.unitProperty),
  readJson(sourceFiles.templateValue),
  readJson(sourceFiles.templateHero),
  readJson(sourceFiles.talentRank),
  readJson(sourceFiles.talentRune),
  readJson(sourceFiles.battleInfo),
  readJson(sourceFiles.battleInfoLang),
]);

const battleInfoLang = mapRowsById(battleInfoLangTable.rows);
const skillLevelLang = mapRowsById(skillLevelLangTable.rows);
const attributeInfoById = new Map(
  battleInfoTable.rows.map(row => [
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
  ])
);

const unitProperties = new Map(
  unitPropertyTable.rows.map(row => [Number(row.id), row])
);
const templateValues = new Map(
  templateValueTable.rows.map(row => [Number(row.id), row])
);
const enemyLang = mapRowsById(enemyLangTable.rows);

const heroes = await loadHeroModules(sourceFiles.heroModules);
const elements = mapElements(elementSystem);
const { characters, skills } = mapCharactersAndSkills(
  heroes,
  attributeInfoById,
  unitProperties,
  templateValues
);
const enemies = mapEnemies(
  enemyTable,
  enemyLang,
  attributeInfoById,
  unitProperties,
  templateValues
);
const kibos = mapKibos(kiboForms);
const equipment = mapEquipment(equipmentForms);
const soulessences = mapSoulessences(soulessenceForms);
const mediaIndex = await mapMediaIndex(sourceFiles.mediaImages);
const skillLevelCrossCheck = buildSkillLevelCrossCheck({
  skills,
  skillLevelTable,
  skillLevelLang,
});
const skillLogicIndex = buildSkillLogicIndex({
  skills,
  skillLevelTable,
  skillsubLogicTable,
  skillsubEleValueTable,
});
const valueParamIndex = buildValueParamIndex({
  skillLogicIndex,
  elementFormulaTable,
});
const combatFormulaEvidence = buildCombatFormulaEvidenceIndex({
  enemies,
  skillLogicIndex,
  skillsubEleValueTable,
  elementFormulaTable,
  attributeInfoById,
});
const skillAssetEvidence = await buildSkillAssetEvidenceIndex({
  characters,
  skills,
  tables: {
    skillTable,
    heroTable,
    enemyTable,
    heroTestTable,
    petTable,
    kiboDuelTable,
    worldItemTable,
    worldResourceTable,
    battlefieldItemTable,
  },
});
const characterAttributePanels = buildCharacterAttributePanels({
  characters,
  attributeInfoById,
  unitProperties,
  templateValues,
  templateHeroTable,
  talentRankTable,
  talentRuneTable,
  battleInfoTable,
});
const characterAttributePanelByCharacterId = new Map(
  characterAttributePanels.items.map(panel => [
    Number(panel.characterId),
    panel,
  ])
);
const firstVerticalSlice = buildFirstVerticalSliceData({
  characters,
  skills,
  enemies,
  characterAttributePanelByCharacterId,
});
const workbenchSeed = buildWorkbenchSeedData({
  characters,
  skills,
  enemies,
  characterAttributePanelByCharacterId,
});
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
  combatFormulaEvidence,
  skillAssetEvidence,
  characterAttributePanels,
});

await Promise.all([
  writeJson('manifest.json', buildManifest(validationReport)),
  writeJson(
    'attributes.json',
    wrapItems(
      [...attributeInfoById.values()].sort(compareById),
      sourceFiles.battleInfo
    )
  ),
  writeJson('elements.json', wrapItems(elements, sourceFiles.elementSystem)),
  writeJson('characters.json', wrapItems(characters, sourceFiles.heroModules)),
  writeJson('skills.json', wrapItems(skills, sourceFiles.heroModules)),
  writeJson('enemies.json', wrapItems(enemies, sourceFiles.enemies)),
  writeJson('kibos.json', wrapItems(kibos, sourceFiles.kibos)),
  writeJson('equipment.json', wrapItems(equipment, sourceFiles.equipment)),
  writeJson(
    'soulessences.json',
    wrapItems(soulessences, sourceFiles.soulessences)
  ),
  writeJson('media-index.json', mediaIndex),
  writeJson('skill-level-crosscheck.json', skillLevelCrossCheck),
  writeJson('skill-logic-index.json', skillLogicIndex),
  writeJson('value-param-index.json', valueParamIndex),
  writeJson('combat-formula-evidence.json', combatFormulaEvidence),
  writeJson('skill-asset-evidence.json', skillAssetEvidence),
  writeJson('character-attribute-panels.json', characterAttributePanels),
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
    throw new Error(
      `Missing AzPr source paths:\n${missing.map(item => `- ${item}`).join('\n')}`
    );
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(fileName, data) {
  await fs.writeFile(
    path.join(outputRoot, fileName),
    `${JSON.stringify(data, null, 2)}\n`,
    'utf8'
  );
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
      combatFormulaEvidence: 'combat-formula-evidence.json',
      skillAssetEvidence: 'skill-asset-evidence.json',
      characterAttributePanels: 'character-attribute-panels.json',
      firstVerticalSlice: 'first-vertical-slice.json',
      workbenchSeed: 'workbench-seed.json',
      validationReport: 'validation-report.json',
    },
    counts: validationReport.counts,
  };
}

function buildFirstVerticalSliceData({
  characters,
  skills,
  enemies,
  characterAttributePanelByCharacterId,
}) {
  const characterId = 109001;
  const skillId = 10900101;
  const enemyId = 300032;
  const character =
    characters.find(item => item.id === characterId) ?? characters[0];
  const skill =
    skills.find(item => item.id === skillId) ??
    skills.find(item => item.characterId === character.id) ??
    skills[0];
  const enemy =
    enemies.find(item => item.id === enemyId) ??
    enemies.find(item => item.property?.exists) ??
    enemies[0];

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
      characters: [
        attachCharacterAttributePanel(
          character,
          characterAttributePanelByCharacterId
        ),
      ],
      skills: [skill],
      enemies: [enemy],
    },
  };
}

function buildWorkbenchSeedData({
  characters,
  skills,
  enemies,
  characterAttributePanelByCharacterId,
}) {
  const compactCharacters = characters.map(character =>
    compactCharacter(character, characterAttributePanelByCharacterId)
  );
  const compactSkills = skills.map(compactSkill);
  const compactEnemies = enemies
    .filter(enemy => enemy.property?.exists)
    .map(compactEnemy);

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

function compactCharacter(
  character,
  characterAttributePanelByCharacterId = new Map()
) {
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
    attributePanel: compactCharacterAttributePanel(
      characterAttributePanelByCharacterId.get(Number(character.id))
    ),
  };
}

function compactSkill(skill) {
  return {
    id: skill.id,
    characterId: skill.characterId,
    characterName: skill.characterName,
    name: skill.name,
    displayName: skill.displayName,
    skillType: skill.skillType,
    displayType: skill.displayType,
    elementId: skill.elementId,
    icon: skill.icon,
    description: skill.description,
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
  const keys = new Set([
    'ATK',
    'MAXHP',
    'DEF',
    'MDEF',
    'CRI',
    'CRI_DMG',
    'MAXSP',
    'SPR_SEC',
  ]);
  return baseAttributes.filter(attribute => keys.has(attribute.key));
}

function attachCharacterAttributePanel(
  character,
  characterAttributePanelByCharacterId = new Map()
) {
  return {
    ...character,
    attributePanel: compactCharacterAttributePanel(
      characterAttributePanelByCharacterId.get(Number(character.id))
    ),
  };
}

function compactCharacterAttributePanel(panel) {
  if (!panel) {
    return null;
  }

  return {
    characterId: panel.characterId,
    characterName: panel.characterName,
    level: panel.level,
    currentRank: panel.currentRank,
    rankBonusIncludedThrough: panel.rankBonusIncludedThrough,
    currentRankRunes: panel.currentRankRunes,
    sourceKind: panel.sourceKind,
    core: compactCharacterAttributePanelCore(panel.core),
  };
}

function compactCharacterAttributePanelCore(core = {}) {
  return Object.fromEntries(
    Object.entries(core).map(([key, attribute]) => [
      key,
      {
        name: attribute.name,
        effectiveValue: attribute.effectiveValue,
        displayText: attribute.displayText,
        isRatio: attribute.isRatio,
        fixedPanelValue: attribute.fixedPanelValue,
        percentBonusValue: attribute.percentBonusValue,
      },
    ])
  );
}

function buildCharacterAttributePanels({
  characters,
  attributeInfoById,
  unitProperties,
  templateValues,
  templateHeroTable,
  talentRankTable,
  talentRuneTable,
  battleInfoTable,
}) {
  const defaultLevel = 80;
  const defaultCurrentRank = 7;
  const displayAttrs = buildRoleDisplayAttributes({
    attributeInfoById,
    talentRankTable,
    talentRuneTable,
    battleInfoTable,
  });
  const levelCoeffByKey = buildLevelAttributeCoeffMap({
    templateHeroTable,
    templateValues,
    relevantAttrIds: displayAttrs.relevantAttrIds,
  });
  const factorByKey = buildCharacterAttributeFactorMap({
    characters,
    unitProperties,
    templateValues,
    relevantAttrIds: displayAttrs.relevantAttrIds,
  });
  const starRows = buildCharacterStarAttributeRows({
    characters,
    talentRankTable,
    talentRuneTable,
  });
  const starCache = new Map();
  const staticBaseConfig = (characterId, level, attrId) => {
    if (!attrId) {
      return 0;
    }
    const attrNumber = Number(attrId);
    const levelCoeff = Number(
      levelCoeffByKey.get(`${level}|${attrNumber}`) || 0
    );
    const factor = Number(factorByKey.get(`${characterId}|${attrNumber}`) || 0);
    return (
      (levelCoeff * factor) /
      (NORMALIZED_BASE_ATTRIBUTE_IDS.has(attrNumber) ? 10000 : 1)
    );
  };
  const staticStarVal = (characterId, rankLimit, attrId, sourceType) => {
    if (!attrId) {
      return 0;
    }
    const effectiveRankLimit =
      sourceType === '临阶' ? Math.max(0, rankLimit - 1) : rankLimit;
    const key = `${characterId}|${effectiveRankLimit}|${attrId}|${sourceType}`;
    if (starCache.has(key)) {
      return starCache.get(key);
    }

    let total = 0;
    for (const row of starRows) {
      if (
        row.characterId !== Number(characterId) ||
        row.attributeId !== Number(attrId) ||
        row.rank > effectiveRankLimit ||
        row.sourceType !== sourceType
      ) {
        continue;
      }
      total += Number(row.value || 0);
    }
    starCache.set(key, total);
    return total;
  };

  const items = characters
    .map(character =>
      buildCharacterAttributePanelItem({
        character,
        defaultLevel,
        defaultCurrentRank,
        displayAttrs: displayAttrs.items,
        staticBaseConfig,
        staticStarVal,
      })
    )
    .sort(compareById);

  return {
    schemaVersion: 1,
    generatedAt,
    sourceKind: 'azpr-role-attribute-current-rank-panel',
    source: {
      referenceWorkbook: normalizePath(sourceFiles.roleAttributeWorkbook),
      sourceBuilder: normalizePath(
        path.join(
          sourceRoot,
          'BWiki',
          'work',
          'hero-xlsx-audit',
          'build_dynamic_role_attribute_workbook.mjs'
        )
      ),
      tables: {
        templateHero: normalizePath(sourceFiles.templateHero),
        talentRank: normalizePath(sourceFiles.talentRank),
        talentRune: normalizePath(sourceFiles.talentRune),
        unitProperty: normalizePath(sourceFiles.unitProperty),
        templateValue: normalizePath(sourceFiles.templateValue),
        battleInfo: normalizePath(sourceFiles.battleInfo),
        battleInfoLang: normalizePath(sourceFiles.battleInfoLang),
      },
    },
    policy: {
      level: defaultLevel,
      currentRank: defaultCurrentRank,
      currentRankRunes: 'all-selected',
      rankBonusIncludedThrough: defaultCurrentRank - 1,
      formula:
        'final = (levelBase + starBase) * (1 + percentAddRaw / 10000) + fixedAdd; HP floors, other grouped values round.',
    },
    summary: {
      characters: items.length,
      attributesPerCharacter: displayAttrs.items.length,
      panelRows: items.reduce((sum, item) => sum + item.attributes.length, 0),
      starAttributeRows: starRows.length,
      level: defaultLevel,
      currentRank: defaultCurrentRank,
    },
    items,
  };
}

function buildCharacterAttributePanelItem({
  character,
  defaultLevel,
  defaultCurrentRank,
  displayAttrs,
  staticBaseConfig,
  staticStarVal,
}) {
  const attributes = displayAttrs.map(attr =>
    buildCharacterAttributePanelRow({
      character,
      level: defaultLevel,
      currentRank: defaultCurrentRank,
      attr,
      staticBaseConfig,
      staticStarVal,
    })
  );
  const core = {};
  for (const attribute of attributes) {
    const key = ROLE_PANEL_CORE_ATTRIBUTE_KEYS[attribute.name];
    if (key) {
      core[key] = attribute;
    }
  }

  return {
    id: character.id,
    characterId: character.id,
    characterName: character.name,
    level: defaultLevel,
    currentRank: defaultCurrentRank,
    currentRankRunes: 'all-selected',
    rankBonusIncludedThrough: defaultCurrentRank - 1,
    sourceKind: 'role-attribute-dynamic-current-rank',
    core,
    attributes,
  };
}

function buildCharacterAttributePanelRow({
  character,
  level,
  currentRank,
  attr,
  staticBaseConfig,
  staticStarVal,
}) {
  const levelBase = staticBaseConfig(character.id, level, attr.baseAttrId);
  const starBase =
    staticStarVal(character.id, currentRank, attr.baseAttrId, '星赐') +
    staticStarVal(character.id, currentRank, attr.baseAttrId, '临阶');
  const fixedAdd =
    staticBaseConfig(character.id, level, attr.fixedAttrId) +
    staticStarVal(character.id, currentRank, attr.fixedAttrId, '星赐') +
    staticStarVal(character.id, currentRank, attr.fixedAttrId, '临阶');
  const percentAddRaw =
    staticBaseConfig(character.id, level, attr.percentAttrId) +
    staticStarVal(character.id, currentRank, attr.percentAttrId, '星赐') +
    staticStarVal(character.id, currentRank, attr.percentAttrId, '临阶');
  const formulaRaw = attr.percentAttrId
    ? (levelBase + starBase) * (1 + percentAddRaw / 10000) + fixedAdd
    : levelBase + starBase + fixedAdd;
  const fixedPanelValue = attr.isRatio
    ? null
    : panelNumber(levelBase + starBase + fixedAdd, attr.baseAttrId);
  const percentBonusValue =
    attr.isRatio || !attr.percentAttrId || percentAddRaw === 0
      ? null
      : Math.floor((fixedPanelValue * percentAddRaw) / 10000);
  const panelTotalValue = attr.isRatio
    ? null
    : fixedPanelValue + (percentBonusValue ?? 0);
  const effectiveValue = attr.isRatio ? formulaRaw / 10000 : panelTotalValue;

  return {
    name: attr.name,
    key: attr.key,
    displayAttrId: attr.displayAttrId,
    baseAttrId: attr.baseAttrId,
    percentAttrId: attr.percentAttrId,
    fixedAttrId: attr.fixedAttrId,
    kind: attr.kind,
    isRatio: attr.isRatio,
    levelBase: roundMetric(levelBase),
    starBase: roundMetric(starBase),
    fixedAdd: roundMetric(fixedAdd),
    percentAddRaw: roundMetric(percentAddRaw),
    formulaRaw: roundMetric(formulaRaw),
    fixedPanelValue,
    percentBonusValue,
    panelTotalValue,
    effectiveValue: roundMetric(effectiveValue),
    displayText: attr.isRatio
      ? percentText(effectiveValue)
      : displaySplitText(fixedPanelValue, percentBonusValue),
    displayInPanel: ROLE_PANEL_DISPLAY_ATTRIBUTE_NAMES.has(attr.name),
  };
}

function buildRoleDisplayAttributes({
  attributeInfoById,
  talentRankTable,
  talentRuneTable,
  battleInfoTable,
}) {
  const relevantAttrIds = new Set([
    1, 3, 4, 5, 7, 8, 21, 22, 25, 27, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60,
    105, 222, 229, 1001, 1003, 1004, 1005,
  ]);

  for (const row of talentRankTable.rows ?? []) {
    for (const attrId of parseAttributePairs(row.attribute).keys()) {
      relevantAttrIds.add(attrId);
    }
  }
  for (const row of talentRuneTable.rows ?? []) {
    for (const attrId of parseAttributePairs(row.runeAttribute).keys()) {
      relevantAttrIds.add(attrId);
    }
  }

  const groupMap = new Map();
  for (const row of battleInfoTable.rows ?? []) {
    if (!row.attrGroup) {
      continue;
    }
    const [groupId, groupType] = String(row.attrGroup).split('|').map(Number);
    if (!groupMap.has(groupId)) {
      groupMap.set(groupId, {});
    }
    groupMap.get(groupId)[groupType] = Number(row.attrVal);
  }

  const attrIdByDisplayName = new Map();
  for (const attrId of relevantAttrIds) {
    const name = roleAttributeName(attrId, attributeInfoById, battleInfoTable);
    if (!attrIdByDisplayName.has(name)) {
      attrIdByDisplayName.set(name, attrId);
    }
  }

  const items = [];
  for (const name of ROLE_PANEL_DESIRED_ATTR_NAMES) {
    if (!attrIdByDisplayName.has(name)) {
      continue;
    }
    const attrId = attrIdByDisplayName.get(name);
    const group = groupMap.get(attrId);
    const info = attributeInfoById.get(Number(attrId));
    if (group && group[1] === attrId) {
      items.push({
        name,
        key: info?.key ?? String(attrId),
        displayAttrId: attrId,
        baseAttrId: group[1] || attrId,
        percentAttrId: group[2] || null,
        fixedAttrId: group[3] || null,
        isRatio: false,
        kind: '分组最终属性',
      });
    } else {
      items.push({
        name,
        key: info?.key ?? String(attrId),
        displayAttrId: attrId,
        baseAttrId: attrId,
        percentAttrId: null,
        fixedAttrId: null,
        isRatio: Boolean(info?.isRatio),
        kind: '独立属性',
      });
    }
  }

  return { items, relevantAttrIds };
}

function roleAttributeName(attrId, attributeInfoById, battleInfoTable) {
  const row = (battleInfoTable.rows ?? []).find(
    item => Number(item.attrVal) === Number(attrId)
  );
  const base = attributeInfoById.get(Number(attrId))?.name ?? String(attrId);
  const group = String(row?.attrGroup || '');
  if (group.endsWith('|2')) {
    return `${base}加成`;
  }
  if (group.endsWith('|3')) {
    return `${base}固定加成`;
  }
  return base;
}

function buildLevelAttributeCoeffMap({
  templateHeroTable,
  templateValues,
  relevantAttrIds,
}) {
  const map = new Map();
  for (const templateHero of templateHeroTable.rows ?? []) {
    const templateValue = templateValues.get(
      Number(templateHero.baseAttribute)
    );
    const attrs = parseAttributePairs(templateValue?.baseAttribute);
    for (const attrId of relevantAttrIds) {
      if (attrs.has(attrId)) {
        map.set(`${Number(templateHero.level)}|${attrId}`, attrs.get(attrId));
      }
    }
  }
  return map;
}

function buildCharacterAttributeFactorMap({
  characters,
  unitProperties,
  templateValues,
  relevantAttrIds,
}) {
  const map = new Map();
  for (const character of characters) {
    const property = unitProperties.get(Number(character.property?.id));
    const templateValue = templateValues.get(Number(property?.baseAttributeId));
    const attrs = parseAttributePairs(templateValue?.baseAttribute);
    for (const attrId of relevantAttrIds) {
      if (attrs.has(attrId)) {
        map.set(`${Number(character.id)}|${attrId}`, attrs.get(attrId));
      }
    }
  }
  return map;
}

function buildCharacterStarAttributeRows({
  characters,
  talentRankTable,
  talentRuneTable,
}) {
  const characterIds = new Set(
    characters.map(character => Number(character.id))
  );
  const talentRuneById = new Map(
    (talentRuneTable.rows ?? []).map(row => [Number(row.id), row])
  );
  const rows = [];

  for (const rank of talentRankTable.rows ?? []) {
    const characterId = Number(rank.heroId);
    if (!characterIds.has(characterId)) {
      continue;
    }
    for (const runeId of parseNumberList(rank.rankBreakthroughItem)) {
      const rune = talentRuneById.get(Number(runeId));
      if (!rune) {
        continue;
      }
      for (const [attributeId, value] of parseAttributePairs(
        rune.runeAttribute
      )) {
        rows.push({
          characterId,
          rank: Number(rank.rank),
          sourceType: '星赐',
          sourceId: Number(rune.id),
          attributeId,
          value,
        });
      }
    }
    for (const [attributeId, value] of parseAttributePairs(rank.attribute)) {
      rows.push({
        characterId,
        rank: Number(rank.rank),
        sourceType: '临阶',
        sourceId: Number(rank.id),
        attributeId,
        value,
      });
    }
  }

  return rows;
}

function parseAttributePairs(rawValue) {
  const pairs = new Map();
  if (!rawValue) {
    return pairs;
  }
  for (const part of String(rawValue).split('|')) {
    if (!part) {
      continue;
    }
    const [left, right] = part.split('#');
    const id = Number(left);
    const value = Number(right);
    if (Number.isFinite(id) && Number.isFinite(value)) {
      pairs.set(id, value);
    }
  }
  return pairs;
}

function panelNumber(value, baseAttrId) {
  return Number(baseAttrId) === 5 ? Math.floor(value) : Math.round(value);
}

function roundMetric(value) {
  return Number.isFinite(value) ? Number(value.toFixed(4)) : 0;
}

function percentText(value) {
  const percent = Number(value) * 100;
  return `${percent.toFixed(2).replace(/\.?0+$/, '')}%`;
}

function displaySplitText(fixedPanelValue, percentBonusValue) {
  if (percentBonusValue == null || percentBonusValue === 0) {
    return String(fixedPanelValue ?? 0);
  }
  return `${fixedPanelValue}+${percentBonusValue}`;
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
  return new Map(rows.map(row => [String(row.id), row]));
}

function buildSkillLevelCrossCheck({
  skills,
  skillLevelTable,
  skillLevelLang,
}) {
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

  const items = skills.map(skill =>
    buildSkillLevelCrossCheckItem(skill, rowsBySkillId, skillLevelLang)
  );
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
  const rowsByLevel = new Map(rows.map(row => [Number(row.level), row]));
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
    return buildSkillLevelCrossCheckLevel(
      skill,
      rowsByLevel.get(level),
      level,
      index,
      skillLevelLang
    );
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
    matchedLevelCount: levels.filter(level => level.status === 'matched')
      .length,
    diagnostics,
    levels,
  };
}

function buildSkillLevelCrossCheckLevel(
  skill,
  row,
  level,
  levelIndex,
  skillLevelLang
) {
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
  const labels = resolveSkillLevelLangValues(
    labelIds,
    skillLevelLang,
    diagnostics,
    skill.id,
    level,
    'name'
  );
  const values = resolveSkillLevelLangValues(
    valueIds,
    skillLevelLang,
    diagnostics,
    skill.id,
    level,
    'value'
  );
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
      message:
        'hero-module 聚合标签与 NewTable/skill_level.json 还原标签不一致。',
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
      message:
        'hero-module 聚合倍率与 NewTable/skill_level.json 还原倍率不一致。',
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

function resolveSkillLevelLangValues(
  ids,
  langRows,
  diagnostics,
  skillId,
  level,
  fieldName
) {
  return ids.map(id => {
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
  const levels = items.flatMap(item => item.levels);
  return {
    matchedSkills: items.filter(item => item.status === 'matched').length,
    missingSkills: items.filter(item => item.status === 'missing').length,
    mismatchedSkills: items.filter(item => item.status === 'mismatch').length,
    matchedLevels: levels.filter(level => level.status === 'matched').length,
    missingLevels: levels.filter(level => level.status === 'missing').length,
    mismatchedLevels: levels.filter(level => level.status === 'mismatch')
      .length,
  };
}

function statusFromDiagnostics(diagnostics) {
  if (
    diagnostics.some(
      diagnostic =>
        diagnostic.code.includes('missing') && diagnostic.code.includes('row')
    )
  ) {
    return 'missing';
  }
  if (diagnostics.length > 0) {
    return 'mismatch';
  }
  return 'matched';
}

function buildSkillLogicIndex({
  skills,
  skillLevelTable,
  skillsubLogicTable,
  skillsubEleValueTable,
}) {
  const skillIds = new Set(skills.map(skill => Number(skill.id)));
  const skillLevelRowsBySkillId = groupRowsByNumberKey(
    (skillLevelTable.rows ?? []).filter(row =>
      skillIds.has(Number(row.skillId))
    ),
    'skillId'
  );
  const logicRowsBySubSkillId = new Map(
    (skillsubLogicTable.rows ?? [])
      .map(row => [Number(row.skillId), row])
      .filter(([skillId]) => Number.isFinite(skillId))
  );
  const elementRowsBySubSkillAndLevel = new Map();
  for (const row of skillsubEleValueTable.rows ?? []) {
    const key = `${Number(row.skillId)}:${Number(row.level)}`;
    const rows = elementRowsBySubSkillAndLevel.get(key) ?? [];
    rows.push(row);
    elementRowsBySubSkillAndLevel.set(key, rows);
  }

  const items = skills.map(skill =>
    buildSkillLogicIndexItem(
      skill,
      skillLevelRowsBySkillId,
      logicRowsBySubSkillId,
      elementRowsBySubSkillAndLevel
    )
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
    formulas
      .flatMap(row => extractFormulaVariables(row.functionOutput))
      .filter(variable => variable.length === 1)
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
    .map(stat => createValueParamDescriptor(stat, formulaVariables));
  const unknownParams = params.filter(
    param => param.semanticStatus !== 'confirmed'
  );
  const observedSkillIds = uniqueNumbers(
    [...statsByParamId.values()].flatMap(stat => [...stat.skillIds])
  );
  const observedElementValueRows = uniqueNumbers(
    params.flatMap(param => param.examples.map(example => example.rowId))
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
      observedParameterPairs: params.reduce(
        (sum, param) => sum + param.rowCount,
        0
      ),
      observedElementValueRows:
        skillLogicIndex.summary?.elementValueRows ?? observedElementValueRows,
      observedSkills: observedSkillIds.length,
      formulaRows: formulas.length,
      formulaVariables,
      unresolvedParameterIds: unknownParams.map(param => param.id),
      constantParameterIds: params
        .filter(param => param.isConstant)
        .map(param => param.id),
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
  const sampleValues = [...stat.values]
    .filter(Number.isFinite)
    .sort((left, right) => left - right)
    .slice(0, 12);
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
    skillIds: [...stat.skillIds]
      .sort((left, right) => left - right)
      .slice(0, 20),
    sampleElementIds: [...stat.elementIds]
      .sort((left, right) => left - right)
      .slice(0, 20),
    minValue: Number.isFinite(stat.minValue) ? stat.minValue : null,
    maxValue: Number.isFinite(stat.maxValue) ? stat.maxValue : null,
    zeroCount: stat.zeroCount,
    sampleValues,
    examples: stat.examples,
  };
}

function buildCombatFormulaEvidenceIndex({
  enemies,
  skillLogicIndex,
  skillsubEleValueTable,
  elementFormulaTable,
  attributeInfoById,
}) {
  const formulas = elementFormulaTable.rows ?? [];
  const formulaIds = new Set(formulas.map(row => Number(row.id)));
  const allElementValueRows = skillsubEleValueTable.rows ?? [];
  const currentElementValueRows = collectSkillLogicElementValueRows(skillLogicIndex);
  const allElementIds = uniqueNumbers(
    allElementValueRows.map(row => Number(row.elementId))
  );
  const currentElementIds = uniqueNumbers(
    currentElementValueRows.map(row => Number(row.elementId))
  );
  const directAllElementFormulaMatches = allElementIds.filter(id => formulaIds.has(id));
  const directCurrentElementFormulaMatches = currentElementIds.filter(id => formulaIds.has(id));
  const enemiesWithProperty = enemies.filter(enemy => enemy.property?.exists);
  const enemiesWithBaseDefense = enemiesWithProperty.filter(enemy =>
    ENEMY_BASE_DEFENSE_ATTRIBUTE_KEYS.every(key => hasAttributeKey(enemy.property, key))
  );
  const enemiesWithElementDefense = enemiesWithProperty.filter(enemy =>
    ELEMENT_DEFENSE_ATTRIBUTE_KEYS.every(key => hasAttributeKey(enemy.property, key))
  );
  const enemiesWithWeakPointDamage = enemiesWithProperty.filter(enemy =>
    WEAK_POINT_DAMAGE_ATTRIBUTE_KEYS.every(key => hasAttributeKey(enemy.property, key))
  );
  const sampleEnemy =
    enemies.find(enemy => Number(enemy.id) === 300032) ??
    enemiesWithBaseDefense[0] ??
    enemies[0] ??
    null;

  return {
    schemaVersion: 1,
    generatedAt,
    sourceKind: 'azpr-combat-formula-evidence-index',
    source: {
      enemies: 'enemies.json',
      skillLogicIndex: 'skill-logic-index.json',
      enemyTable: normalizePath(sourceFiles.enemies),
      unitPropertyTable: normalizePath(sourceFiles.unitProperty),
      templateValueTable: normalizePath(sourceFiles.templateValue),
      battleInfoTable: normalizePath(sourceFiles.battleInfo),
      skillsubEleValueTable: normalizePath(sourceFiles.skillsubEleValue),
      elementFormulaTable: normalizePath(sourceFiles.elementFormula),
    },
    summary: {
      enemyCount: enemies.length,
      enemiesWithProperty: enemiesWithProperty.length,
      enemiesWithBaseDefense: enemiesWithBaseDefense.length,
      enemiesWithElementDefense: enemiesWithElementDefense.length,
      enemiesWithWeakPointDamage: enemiesWithWeakPointDamage.length,
      missingPropertyEnemyIds: enemies
        .filter(enemy => !enemy.property?.exists)
        .map(enemy => enemy.id),
      allElementValueRows: allElementValueRows.length,
      currentSkillElementValueRows: currentElementValueRows.length,
      allUniqueElementIds: allElementIds.length,
      currentSkillUniqueElementIds: currentElementIds.length,
      elementFormulaRows: formulas.length,
      directAllElementFormulaIdMatches: directAllElementFormulaMatches.length,
      directCurrentElementFormulaIdMatches: directCurrentElementFormulaMatches.length,
      relationStatus:
        directAllElementFormulaMatches.length > 0
          ? 'direct-elementId-formulaId-match-found'
          : 'no-direct-elementId-to-element_formula-id-match',
    },
    enemyAttributeEvidence: {
      status:
        enemiesWithBaseDefense.length > 0 && enemiesWithElementDefense.length > 0
          ? 'enemy-property-attributes-found'
          : 'enemy-property-attributes-incomplete',
      sourceChain:
        'enemy.propertyId -> unit_property.baseAttributeId -> template_value.baseAttribute -> battle_info.attrVal',
      baseDefenseAttributes: mapAttributeEvidence(
        ENEMY_BASE_DEFENSE_ATTRIBUTE_KEYS,
        attributeInfoById
      ),
      elementDefenseAttributes: mapAttributeEvidence(
        ELEMENT_DEFENSE_ATTRIBUTE_KEYS,
        attributeInfoById
      ),
      weakPointDamageAttributes: mapAttributeEvidence(
        WEAK_POINT_DAMAGE_ATTRIBUTE_KEYS,
        attributeInfoById
      ),
      sampleEnemy: sampleEnemy ? createCombatFormulaSampleEnemy(sampleEnemy) : null,
    },
    formulaEvidence: {
      status: 'formula-rows-found-without-elementId-direct-link',
      attackFormulaRows: mapFormulaRows(
        formulas.filter(row => /\bself\.ATK\b/.test(String(row.functionOutput)))
      ),
      magicAttackFormulaRows: mapFormulaRows(
        formulas.filter(row => /\bself\.MATK\b/.test(String(row.functionOutput)))
      ),
      selfDefenseFormulaRows: mapFormulaRows(
        formulas.filter(row => /\bself\.DEF\b/.test(String(row.functionOutput)))
      ),
      targetReferenceFormulaRows: mapFormulaRows(
        formulas.filter(row => /\btarget\./.test(String(row.functionOutput))).slice(0, 24)
      ),
      directElementFormulaIdMatches: directCurrentElementFormulaMatches,
    },
    elementValueEvidence: {
      status:
        directCurrentElementFormulaMatches.length > 0
          ? 'direct-element-formula-match-found'
          : 'element-values-have-params-but-no-direct-formula-id-link',
      currentSkillElementValueRows: currentElementValueRows.length,
      currentSkillUniqueElementIds: currentElementIds.length,
      sampleRows: currentElementValueRows.slice(0, 12),
      directElementFormulaIdMatches: directCurrentElementFormulaMatches,
      note:
        'skillsub_ele_value.elementId does not equal element_formula.id in the current local tables; asset/effect-node tracing is still required before applying formula rows.',
    },
  };
}

async function buildSkillAssetEvidenceIndex({ characters, skills, tables }) {
  const currentSkillIds = new Set(skills.map(skill => Number(skill.id)));
  const currentCharacterIds = new Set(
    characters.map(character => Number(character.id))
  );
  const skillTableRows = tables.skillTable?.rows ?? [];
  const skillTableById = new Map(
    skillTableRows.map(row => [Number(row.id), row]).filter(([id]) =>
      Number.isFinite(id)
    )
  );
  const probes = {
    azprSkillRoot: await createPathStatus(
      path.join(
        sourceRoot,
        'Assets',
        'ResourcesAssets',
        'Config',
        'Battle',
        'Skill'
      )
    ),
    azprSkillPreloadRoot: await createPathStatus(
      path.join(
        sourceRoot,
        'Assets',
        'ResourcesAssets',
        'Config',
        'Battle',
        'SkillPreload'
      )
    ),
    azprSkillListRoot: await createPathStatus(
      path.join(
        sourceRoot,
        'Assets',
        'ResourcesAssets',
        'Config',
        'Battle',
        'SkillList'
      )
    ),
    extractorSkillListRoot: await createPathStatus(extractorSkillListRoot),
    extractorYooIndexRoot: await createPathStatus(extractorYooIndexRoot),
  };
  const tableEvidence = SKILL_ASSET_EVIDENCE_TABLES.map(spec =>
    buildSkillAssetTableEvidence(spec, tables[spec.key], currentSkillIds)
  );
  const uniqueSkillBytesPaths = uniqueStrings(
    tableEvidence.flatMap(item => item.uniqueSkillBytesPaths)
  );
  const skillBytesPathStatuses =
    await buildSkillBytesPathStatuses(uniqueSkillBytesPaths);
  const skillControlDirs = await listSkillControlDirs(extractorSkillListRoot);
  const skillControlBySkillId = new Map(
    skillControlDirs.map(item => [Number(item.skillId), item])
  );
  const currentSkillControlEvidence = [];

  for (const skill of skills) {
    currentSkillControlEvidence.push(
      await buildSkillControlEvidenceItem(skill, skillControlBySkillId)
    );
  }

  const currentHeroRows = buildCurrentHeroSkillRows(
    tables.heroTable,
    currentCharacterIds,
    currentSkillIds
  );
  const foundCurrentSkillControls = currentSkillControlEvidence.filter(
    item => item.status === 'found'
  );
  const missingCurrentSkillControls = currentSkillControlEvidence.filter(
    item => item.status === 'missing'
  );
  const laneCandidateSkillCounts = summarizeLaneCandidateSkillCounts(
    currentSkillControlEvidence
  );
  const currentSkillsWithSkillTableRow = skills.filter(skill =>
    skillTableById.has(Number(skill.id))
  );
  const skillBytesPathOwnerRows = tableEvidence.reduce(
    (sum, item) => sum + item.rowsWithSkillBytesPath,
    0
  );
  const existingSkillBytesPathCount = skillBytesPathStatuses.filter(
    item => item.existsInAzPrAssets
  ).length;

  return {
    schemaVersion: 1,
    generatedAt,
    sourceKind: 'azpr-skill-asset-evidence-index',
    source: {
      sourceRoot: normalizePath(sourceRoot),
      extractorRoot: normalizePath(extractorRoot),
      skillTable: normalizePath(sourceFiles.skillTable),
      extractorSkillListRoot: normalizePath(extractorSkillListRoot),
      extractorYooIndexRoot: normalizePath(extractorYooIndexRoot),
      tables: Object.fromEntries(
        SKILL_ASSET_EVIDENCE_TABLES.map(spec => [
          spec.name,
          normalizePath(skillAssetSourceFile(spec)),
        ])
      ),
      fallbackPolicy:
        'If C:/PC2/Codex/AzPr lacks Config/Battle/Skill assets, use AzPr Extractor Unity exports under default_package/ResourcesAssets/Config/Battle/SkillList.',
    },
    probes,
    summary: {
      skillTableRows: skillTableRows.length,
      currentSkillCount: skills.length,
      currentHeroCount: characters.length,
      currentSkillsWithSkillTableRow: currentSkillsWithSkillTableRow.length,
      currentSkillsWithExtractedSkillControl: foundCurrentSkillControls.length,
      currentSkillsMissingExtractedSkillControl: missingCurrentSkillControls.length,
      skillBytesPathOwnerRows,
      uniqueSkillBytesPaths: uniqueSkillBytesPaths.length,
      existingSkillBytesPathsInAzPrAssets: existingSkillBytesPathCount,
      extractedSkillControlDirectories: skillControlDirs.length,
      parsedCurrentSkillControlSampleFiles: currentSkillControlEvidence.reduce(
        (sum, item) => sum + (item.parsedJsonSampleFiles ?? 0),
        0
      ),
      timelineControlSampleCount: currentSkillControlEvidence.reduce(
        (sum, item) => sum + (item.timelineControlSampleCount ?? 0),
        0
      ),
      behaviorNodeSampleCount: currentSkillControlEvidence.reduce(
        (sum, item) => sum + (item.behaviorNodeSampleCount ?? 0),
        0
      ),
      effectLaneCandidateSkills: laneCandidateSkillCounts,
      hpDamageCandidateSkills: laneCandidateSkillCounts.hpDamage ?? 0,
      toughnessCandidateSkills: laneCandidateSkillCounts.toughnessDamage ?? 0,
      selfEnergyCandidateSkills: laneCandidateSkillCounts.selfEnergyChange ?? 0,
      relationStatus:
        foundCurrentSkillControls.length > 0
          ? 'skill-control-assets-found-in-azpr-extractor'
          : probes.extractorSkillListRoot.exists
            ? 'no-current-skill-control-assets-found'
            : 'azpr-extractor-skill-list-missing',
    },
    tableEvidence,
    currentHeroRows,
    skillBytesPathStatuses: skillBytesPathStatuses.slice(0, 80),
    currentSkillControlEvidence,
    sampleSkillControls: foundCurrentSkillControls.slice(0, 20),
    nextTraceTargets: buildSkillControlTraceTargets(foundCurrentSkillControls),
  };
}

function buildSkillAssetTableEvidence(spec, table, currentSkillIds) {
  const rows = table?.rows ?? [];
  const skillIds = new Set();
  const currentSkillRefs = new Set();
  const uniqueSkillBytesPaths = new Set();
  const sampleRows = [];
  let rowsWithSkillReferences = 0;
  let rowsWithSkillBytesPath = 0;

  for (const row of rows) {
    const skillRefsByField = {};
    for (const field of spec.skillFields) {
      const refs = parseSkillReferenceIds(row[field]);
      if (refs.length > 0) {
        skillRefsByField[field] = refs;
      }
    }

    const rowSkillIds = uniqueNumbers(Object.values(skillRefsByField).flat());
    const skillBytesPaths = parseAssetPathList(row.skillBytesPath);
    if (rowSkillIds.length > 0) {
      rowsWithSkillReferences += 1;
    }
    if (skillBytesPaths.length > 0) {
      rowsWithSkillBytesPath += 1;
      for (const assetPath of skillBytesPaths) {
        uniqueSkillBytesPaths.add(assetPath);
      }
    }
    for (const skillId of rowSkillIds) {
      skillIds.add(skillId);
      if (currentSkillIds.has(Number(skillId))) {
        currentSkillRefs.add(skillId);
      }
    }

    if (
      sampleRows.length < 12 &&
      (rowSkillIds.length > 0 || skillBytesPaths.length > 0)
    ) {
      sampleRows.push({
        ownerId: numberOrNull(row.id),
        ownerKind: spec.ownerKind,
        skillRefsByField,
        currentSkillRefs: rowSkillIds.filter(skillId =>
          currentSkillIds.has(Number(skillId))
        ),
        skillBytesPaths,
      });
    }
  }

  return {
    table: spec.name,
    ownerKind: spec.ownerKind,
    source: normalizePath(skillAssetSourceFile(spec)),
    rows: rows.length,
    rowsWithSkillReferences,
    rowsWithSkillBytesPath,
    uniqueSkillIds: skillIds.size,
    currentSkillRefs: currentSkillRefs.size,
    uniqueSkillBytesPaths: [...uniqueSkillBytesPaths].sort(),
    sampleRows,
  };
}

function summarizeLaneCandidateSkillCounts(currentSkillControlEvidence) {
  return Object.fromEntries(
    SKILL_EFFECT_LANES.map(lane => [
      lane.key,
      currentSkillControlEvidence.filter(
        item => (item.effectLaneCandidateSummary?.[lane.key]?.count ?? 0) > 0
      ).length,
    ])
  );
}

function buildCurrentHeroSkillRows(heroTable, currentCharacterIds, currentSkillIds) {
  return (heroTable?.rows ?? [])
    .filter(row => currentCharacterIds.has(Number(row.id)))
    .map(row => {
      const fields = [
        'attackSkill',
        'skillList',
        'aerialSkillList',
        'passiveSkillList',
        'backupSkillList',
        'skillSystem',
      ];
      const skillRefsByField = {};
      for (const field of fields) {
        const refs = parseSkillReferenceIds(row[field]);
        if (refs.length > 0) {
          skillRefsByField[field] = refs;
        }
      }
      const skillIds = uniqueNumbers(Object.values(skillRefsByField).flat());

      return {
        heroId: Number(row.id),
        source: normalizePath(sourceFiles.heroTable),
        skillRefsByField,
        currentSkillRefs: skillIds.filter(skillId =>
          currentSkillIds.has(Number(skillId))
        ),
        skillBytesPaths: parseAssetPathList(row.skillBytesPath),
      };
    })
    .sort((left, right) => left.heroId - right.heroId);
}

async function buildSkillBytesPathStatuses(assetPaths) {
  const statuses = [];
  for (const assetPath of assetPaths) {
    const resolvedPath = resolveAzPrResourcesAssetPath(assetPath);
    statuses.push({
      assetPath,
      resolvedPath: normalizePath(resolvedPath),
      existsInAzPrAssets: await pathExists(resolvedPath),
    });
  }
  return statuses.sort((left, right) =>
    left.assetPath.localeCompare(right.assetPath)
  );
}

async function buildSkillControlEvidenceItem(skill, skillControlBySkillId) {
  const expectedDirectory = path.join(
    extractorSkillListRoot,
    `skill_control_${skill.id}.asset`
  );
  const controlDir = skillControlBySkillId.get(Number(skill.id));
  if (!controlDir) {
    return {
      skillId: Number(skill.id),
      characterId: Number(skill.characterId),
      characterName: skill.characterName,
      skillName: skill.name ?? skill.displayName ?? null,
      status: 'missing',
      expectedDirectory: normalizePath(expectedDirectory),
    };
  }

  const monoBehaviourRoot = path.join(controlDir.fullPath, 'MonoBehaviour');
  const jsonFiles = await listJsonFileNames(monoBehaviourRoot);
  const aggregate = createEmptySkillControlNodeEvidence();
  let parsedJsonSampleFiles = 0;
  let unreadableJsonSampleFiles = 0;

  for (const fileName of jsonFiles.slice(0, SKILL_CONTROL_SAMPLE_FILE_LIMIT)) {
    try {
      const json = await readJson(path.join(monoBehaviourRoot, fileName));
      parsedJsonSampleFiles += 1;
      mergeSkillControlNodeEvidence(
        aggregate,
        extractSkillControlNodeEvidence(json, fileName)
      );
    } catch {
      unreadableJsonSampleFiles += 1;
    }
  }

  return {
    skillId: Number(skill.id),
    characterId: Number(skill.characterId),
    characterName: skill.characterName,
    skillName: skill.name ?? skill.displayName ?? null,
    status: 'found',
    directory: normalizePath(controlDir.fullPath),
    monoBehaviourRoot: normalizePath(monoBehaviourRoot),
    jsonFileCount: jsonFiles.length,
    parsedJsonSampleFiles,
    unreadableJsonSampleFiles,
    sampleFiles: jsonFiles.slice(0, 5),
    timelineControlSampleCount: aggregate.timelineControlCount,
    behaviorNodeSampleCount: aggregate.behaviorNodeCount,
    frameCandidateSampleCount: aggregate.frameCandidateCount,
    elementListCandidateSampleCount: aggregate.elementListCandidateCount,
    effectLaneCandidateSummary: aggregate.laneCandidateSummary,
    effectLaneCandidates: aggregate.laneCandidates,
    frameRange: buildFrameRange(aggregate.startFrames, aggregate.endFrames),
    sampleNodeCandidates: aggregate.candidates.slice(
      0,
      SKILL_CONTROL_SAMPLE_NODE_LIMIT
    ),
  };
}

function extractSkillControlNodeEvidence(json, fileName) {
  const evidence = createEmptySkillControlNodeEvidence();
  const stack = [json];

  while (stack.length > 0) {
    const value = stack.pop();
    if (!value || typeof value !== 'object') {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        stack.push(item);
      }
      continue;
    }

    if (Array.isArray(value.behaviorlineControl)) {
      for (const control of value.behaviorlineControl) {
        if (!control || typeof control !== 'object') {
          continue;
        }
        evidence.timelineControlCount += 1;
        collectFrameEvidence(evidence, control);
        pushSkillControlCandidate(
          evidence,
          compactSkillControlCandidate(control, fileName, 'timeline-control')
        );
      }
    }

    if (isBehaviorNodeCandidate(value)) {
      evidence.behaviorNodeCount += 1;
      collectFrameEvidence(evidence, value);
      if (Array.isArray(value.elementList) && value.elementList.length > 0) {
        evidence.elementListCandidateCount += 1;
      }
      if (
        value.startFrame != null ||
        value.endFrame != null ||
        value.frameCount != null
      ) {
        evidence.frameCandidateCount += 1;
      }
      pushSkillControlCandidate(
        evidence,
        compactSkillControlCandidate(value, fileName, 'behavior-node')
      );
    }

    for (const nestedValue of Object.values(value)) {
      if (nestedValue && typeof nestedValue === 'object') {
        stack.push(nestedValue);
      }
    }
  }

  return evidence;
}

function createEmptySkillControlNodeEvidence() {
  return {
    timelineControlCount: 0,
    behaviorNodeCount: 0,
    frameCandidateCount: 0,
    elementListCandidateCount: 0,
    startFrames: [],
    endFrames: [],
    candidates: [],
    laneCandidateSummary: Object.fromEntries(
      SKILL_EFFECT_LANES.map(lane => [
        lane.key,
        {
          label: lane.label,
          count: 0,
        },
      ])
    ),
    laneCandidates: [],
  };
}

function mergeSkillControlNodeEvidence(target, source) {
  target.timelineControlCount += source.timelineControlCount;
  target.behaviorNodeCount += source.behaviorNodeCount;
  target.frameCandidateCount += source.frameCandidateCount;
  target.elementListCandidateCount += source.elementListCandidateCount;
  target.startFrames.push(...source.startFrames);
  target.endFrames.push(...source.endFrames);
  for (const candidate of source.candidates) {
    pushSkillControlCandidateSample(target, candidate);
  }
  for (const [key, summary] of Object.entries(source.laneCandidateSummary)) {
    target.laneCandidateSummary[key].count += summary.count;
  }
  for (const candidate of source.laneCandidates) {
    pushSkillEffectLaneCandidateSample(target, candidate);
  }
}

function collectFrameEvidence(evidence, value) {
  const startFrame = numberOrNull(value.startFrame);
  const endFrame = numberOrNull(value.endFrame);
  const frameCount = numberOrNull(value.frameCount);

  if (startFrame != null) {
    evidence.startFrames.push(startFrame);
  }
  if (endFrame != null) {
    evidence.endFrames.push(endFrame);
  } else if (startFrame != null && frameCount != null) {
    evidence.endFrames.push(startFrame + frameCount);
  }
}

function pushSkillControlCandidate(evidence, candidate) {
  pushSkillControlCandidateSample(evidence, candidate);
  pushSkillEffectLaneCandidate(evidence, candidate);
}

function pushSkillControlCandidateSample(evidence, candidate) {
  if (candidate && evidence.candidates.length < SKILL_CONTROL_SAMPLE_NODE_LIMIT) {
    evidence.candidates.push(candidate);
  }
}

function pushSkillEffectLaneCandidate(evidence, candidate) {
  if (!candidate?.laneHints?.length) {
    return;
  }

  if (
    candidate.type === 'behavior-node' &&
    candidate.trackName &&
    candidate.behaviorListCount != null
  ) {
    return;
  }

  for (const lane of candidate.laneHints) {
    if (evidence.laneCandidateSummary[lane]) {
      evidence.laneCandidateSummary[lane].count += 1;
    }
  }

  if (evidence.laneCandidates.length < SKILL_EFFECT_LANE_SAMPLE_LIMIT) {
    pushSkillEffectLaneCandidateSample(evidence, candidate);
  }
}

function pushSkillEffectLaneCandidateSample(evidence, candidate) {
  if (evidence.laneCandidates.length < SKILL_EFFECT_LANE_SAMPLE_LIMIT) {
    evidence.laneCandidates.push(candidate);
  }
}

function compactSkillControlCandidate(value, fileName, type) {
  const laneHints = classifySkillEffectLanes(value);
  return compactObject({
    type,
    laneHints,
    laneHintSource: laneHints.length > 0 ? 'name-trackName-string-pattern' : null,
    file: fileName,
    name: value.name ?? null,
    trackName: value.trackName ?? null,
    trackIndex: numberOrNull(value.trackIndex),
    trackGroupIndex: numberOrNull(value.trackGroupIndex),
    timelineGroupIndex: numberOrNull(value.timelineGroupIndex),
    behaviorGroupId: numberOrNull(value.behaviorGroupId),
    behaviorIndex: numberOrNull(value.behaviorIndex),
    startFrame: numberOrNull(value.startFrame),
    endFrame: numberOrNull(value.endFrame),
    frameCount: numberOrNull(value.frameCount),
    eventType: numberOrNull(value.eventType),
    eventId: numberOrNull(value.eventID),
    value: value.value ?? null,
    stringValue: value.stringValue ?? null,
    intParam: numberOrNull(value.intParam),
    floatParam: numberOrNull(value.floatParam),
    specialState: numberOrNull(value.specialState),
    battlePropertyType: numberOrNull(value.battlePropertyType),
    elementList: summarizeElementList(value.elementList),
    eventFrameCount: Array.isArray(value.eventFrame)
      ? value.eventFrame.length
      : null,
    behaviorListCount: Array.isArray(value.behaviorList)
      ? value.behaviorList.length
      : null,
  });
}

function classifySkillEffectLanes(value) {
  const text = [
    value.name,
    value.trackName,
    value.stringValue,
    value.eventName,
    value.behaviorName,
  ]
    .filter(Boolean)
    .join(' ');
  if (!text) {
    return [];
  }

  return SKILL_EFFECT_LANES.filter(lane =>
    lane.patterns.some(pattern => pattern.test(text))
  ).map(lane => lane.key);
}

function summarizeElementList(elementList) {
  if (!Array.isArray(elementList) || elementList.length === 0) {
    return [];
  }

  return elementList.slice(0, 5).map(item => {
    if (item && typeof item === 'object') {
      return compactObject({
        elementId: numberOrNull(item.elementId ?? item.elementID ?? item.id),
        value: item.value ?? null,
        fileId: numberOrNull(item.m_FileID),
        pathId: numberOrNull(item.m_PathID),
      });
    }
    return item;
  });
}

function isBehaviorNodeCandidate(value) {
  return [
    'eventType',
    'eventID',
    'startFrame',
    'endFrame',
    'frameCount',
    'elementList',
    'specialState',
    'battlePropertyType',
    'behaviorGroupId',
    'timelineGroupIndex',
    'behaviorIndex',
  ].some(key => Object.prototype.hasOwnProperty.call(value, key));
}

function buildFrameRange(startFrames, endFrames) {
  if (startFrames.length === 0 && endFrames.length === 0) {
    return null;
  }

  return {
    minStartFrame: startFrames.length > 0 ? Math.min(...startFrames) : null,
    maxEndFrame: endFrames.length > 0 ? Math.max(...endFrames) : null,
  };
}

function buildSkillControlTraceTargets(foundSkillControls) {
  return [...foundSkillControls]
    .sort((left, right) => {
      if (left.skillId === 10900101) {
        return -1;
      }
      if (right.skillId === 10900101) {
        return 1;
      }
      return (
        (right.behaviorNodeSampleCount ?? 0) -
          (left.behaviorNodeSampleCount ?? 0) ||
        Number(left.skillId) - Number(right.skillId)
      );
    })
    .slice(0, 16)
    .map(item => ({
      skillId: item.skillId,
      characterId: item.characterId,
      characterName: item.characterName,
      skillName: item.skillName,
      directory: item.directory,
      jsonFileCount: item.jsonFileCount,
      frameRange: item.frameRange,
      timelineControlSampleCount: item.timelineControlSampleCount,
      behaviorNodeSampleCount: item.behaviorNodeSampleCount,
      sampleNodeCandidates: item.sampleNodeCandidates.slice(0, 3),
      nextStep:
        'Parse MonoBehaviour references into action segments, hit frames, effect nodes, and formula candidates.',
    }));
}

async function listSkillControlDirs(root) {
  if (!(await pathExists(root))) {
    return [];
  }

  const entries = await fs.readdir(root, { withFileTypes: true });
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const match = /^skill_control_(\d+)\.asset$/i.exec(entry.name);
      if (!match) {
        return null;
      }
      return {
        skillId: Number(match[1]),
        name: entry.name,
        fullPath: path.join(root, entry.name),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.skillId - right.skillId);
}

async function listJsonFileNames(root) {
  if (!(await pathExists(root))) {
    return [];
  }

  const entries = await fs.readdir(root, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => entry.name)
    .sort();
}

async function createPathStatus(filePath) {
  return {
    path: normalizePath(filePath),
    exists: await pathExists(filePath),
  };
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseSkillReferenceIds(rawValue) {
  return uniqueNumbers(parseNumberList(rawValue).filter(value => value >= 100000));
}

function skillAssetSourceFile(spec) {
  return spec.key === 'enemyTable' ? sourceFiles.enemies : sourceFiles[spec.key];
}

function resolveAzPrResourcesAssetPath(assetPath) {
  return path.join(
    sourceRoot,
    'Assets',
    'ResourcesAssets',
    ...String(assetPath).split(/[\\/]/).filter(Boolean)
  );
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => {
      if (item == null) {
        return false;
      }
      if (Array.isArray(item) && item.length === 0) {
        return false;
      }
      return item !== '';
    })
  );
}

function collectSkillLogicElementValueRows(skillLogicIndex) {
  return (skillLogicIndex.items ?? []).flatMap(item =>
    (item.levels ?? []).flatMap(level =>
      (level.elementValues ?? []).map(elementValue => ({
        skillId: Number(item.skillId),
        level: Number(level.level),
        rowId: Number(elementValue.rowId),
        elementId: Number(elementValue.elementId),
        valueParam: elementValue.valueParam,
      }))
    )
  );
}

function hasAttributeKey(property, key) {
  return Boolean((property?.baseAttributes ?? []).some(attribute => attribute.key === key));
}

function getAttributeByKey(property, key) {
  return (property?.baseAttributes ?? []).find(attribute => attribute.key === key) ?? null;
}

function mapAttributeEvidence(keys, attributeInfoById) {
  const infoByKey = new Map([...attributeInfoById.values()].map(info => [info.key, info]));
  return keys.map(key => {
    const info = infoByKey.get(key);
    return {
      key,
      id: info?.id ?? null,
      name: info?.name ?? key,
      isRatio: Boolean(info?.isRatio),
    };
  });
}

function createCombatFormulaSampleEnemy(enemy) {
  return {
    id: enemy.id,
    name: enemy.name,
    propertyId: enemy.property?.id ?? null,
    baseAttributeId: enemy.property?.baseAttributeId ?? null,
    sourceChain: {
      enemyTableField: 'propertyId',
      unitPropertyField: 'baseAttributeId',
      templateValueField: 'baseAttribute',
    },
    baseDefenseValues: Object.fromEntries(
      ENEMY_BASE_DEFENSE_ATTRIBUTE_KEYS.map(key => [
        key,
        getAttributeByKey(enemy.property, key)?.value ?? null,
      ])
    ),
    elementDefenseValues: Object.fromEntries(
      ELEMENT_DEFENSE_ATTRIBUTE_KEYS.map(key => [
        key,
        getAttributeByKey(enemy.property, key)?.value ?? null,
      ])
    ),
    weakPointDamageValues: Object.fromEntries(
      WEAK_POINT_DAMAGE_ATTRIBUTE_KEYS.map(key => [
        key,
        getAttributeByKey(enemy.property, key)?.value ?? null,
      ])
    ),
  };
}

function mapFormulaRows(rows) {
  return rows.map(row => ({
    id: Number(row.id),
    functionOutput: row.functionOutput,
    variables: extractFormulaVariables(row.functionOutput),
  }));
}

function extractFormulaVariables(functionOutput) {
  if (!functionOutput) {
    return [];
  }
  const reserved = new Set([
    'IF',
    'OR',
    'FLOOR',
    'ROUND',
    'CEILING',
    'RANDOM',
    'F_MIN',
    'F_MAX',
  ]);
  return [...String(functionOutput).matchAll(/\b[A-Z][A-Z_]*\b/g)]
    .map(match => match[0])
    .filter(name => !reserved.has(name) && name.length === 1);
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
    .map(part => {
      const [idText, valueText] = part.split('#');
      return {
        id: Number(idText),
        value: Number(valueText),
      };
    })
    .filter(item => Number.isFinite(item.id) && Number.isFinite(item.value));
}

function buildSkillLogicIndexItem(
  skill,
  skillLevelRowsBySkillId,
  logicRowsBySubSkillId,
  elementRowsBySubSkillAndLevel
) {
  const skillLevelRows = (
    skillLevelRowsBySkillId.get(Number(skill.id)) ?? []
  ).sort((left, right) => Number(left.level) - Number(right.level));
  const diagnostics = [];

  if (skillLevelRows.length === 0) {
    diagnostics.push({
      code: 'skill-logic-skill-level-missing',
      severity: 'warning',
      skillId: skill.id,
      message: 'skill_level.json 中缺少该技能等级行，无法映射 skillsub_logic。',
    });
  }

  const subSkills = uniqueNumbers(
    skillLevelRows.map(row => row.subSkillId)
  ).map(subSkillId =>
    buildSubSkillLogicIndex(
      subSkillId,
      skill,
      skillLevelRows,
      logicRowsBySubSkillId
    )
  );
  const levels = skillLevelRows.map((row, index) =>
    buildSkillLogicLevelIndex(row, index, elementRowsBySubSkillAndLevel)
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
    subSkillIds: subSkills.map(subSkill => subSkill.subSkillId),
    subSkills,
    levels,
    diagnostics,
  };
}

function buildSubSkillLogicIndex(
  subSkillId,
  skill,
  skillLevelRows,
  logicRowsBySubSkillId
) {
  const diagnostics = [];
  const logicRow = logicRowsBySubSkillId.get(subSkillId);
  const displayPairs = uniqueDisplayTimingPairs(
    skillLevelRows.filter(row => Number(row.subSkillId) === Number(subSkillId))
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
    pair => pair.cooldownMs === logic.cooldownMs && pair.spCost === logic.spCost
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
      message:
        'skill_level 显示层冷却/能量与 skillsub_logic 逻辑层冷却/能量不一致。',
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

function buildSkillLogicLevelIndex(
  row,
  levelIndex,
  elementRowsBySubSkillAndLevel
) {
  const subSkillId = Number(row.subSkillId);
  const level = Number(row.level);
  const elementRows =
    elementRowsBySubSkillAndLevel.get(`${subSkillId}:${level}`) ?? [];
  const diagnostics = [];

  if (elementRows.length === 0) {
    diagnostics.push({
      code: 'skill-element-value-row-missing',
      severity: 'info',
      skillId: Number(row.skillId),
      subSkillId,
      level,
      message:
        'skillsub_ele_value.json 中没有该 subSkillId/level 的数值参数行。',
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
    elementValues: elementRows.map(elementRow => ({
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
  const subSkills = items.flatMap(item => item.subSkills);
  const levels = items.flatMap(item => item.levels);
  const elementValueRows = levels.reduce(
    (sum, level) => sum + level.elementValues.length,
    0
  );
  return {
    mappedSkills: items.filter(item => item.status === 'mapped').length,
    missingSkills: items.filter(item => item.status === 'missing').length,
    mismatchedSkills: items.filter(item => item.status === 'mismatch').length,
    subSkillIds: subSkills.length,
    missingLogicRows: subSkills.filter(
      subSkill => subSkill.status === 'missing'
    ).length,
    displayLogicMismatchSubSkills: subSkills.filter(
      subSkill => !subSkill.displayMatchesLogic
    ).length,
    levelRows: levels.length,
    elementValueRows,
    levelsMissingElementValues: levels.filter(
      level => level.elementValues.length === 0
    ).length,
    logicRowsWithNonZeroTiming: subSkills.filter(subSkill =>
      hasNonZeroLogicTiming(subSkill.logic)
    ).length,
  };
}

function statusFromSkillLogicDiagnostics(diagnostics) {
  if (
    diagnostics.some(
      diagnostic => diagnostic.code === 'skill-logic-row-missing'
    )
  ) {
    return 'missing';
  }
  if (
    diagnostics.some(
      diagnostic => diagnostic.code === 'skill-display-logic-timing-mismatch'
    )
  ) {
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
  ].some(value => Number(value) !== 0);
}

function uniqueDisplayTimingPairs(rows) {
  const pairs = rows.map(row => ({
    cooldownMs: numberOrNull(row.coolDown) ?? 0,
    spCost: numberOrNull(row.spCost) ?? 0,
  }));
  return uniqueByKey(pairs, pair => `${pair.cooldownMs}:${pair.spCost}`);
}

function uniqueNumbers(values) {
  return [
    ...new Set(values.map(value => Number(value)).filter(Number.isFinite)),
  ].sort((left, right) => left - right);
}

function uniqueStrings(values) {
  return [
    ...new Set(values.map(value => String(value)).filter(Boolean)),
  ].sort();
}

function uniqueByKey(items, createKey) {
  const seen = new Set();
  return items.filter(item => {
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
  const jsonNames = names
    .filter(name => /^\d+\.hero-module\.local\.json$/.test(name))
    .sort();
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
    .map(element => ({
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

function mapCharactersAndSkills(
  heroModules,
  attributeInfoById,
  unitProperties,
  templateValues
) {
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
      battleTags: (hero.battleTag ?? []).map(tag => ({
        id: Number(tag.id),
        title: tag.title,
        description: cleanMarkup(tag.desc),
        color: tag.color,
      })),
      cost: numberOrNull(hero.cost),
      unitId: numberOrNull(hero.unitId),
      property: mapProperty(
        hero.propertyId,
        attributeInfoById,
        unitProperties,
        templateValues
      ),
      icons: {
        avatar: firstString(hero.avatarTexture),
        all: normalizeStringArray(hero.avatarTexture),
      },
      description: cleanMarkup(hero.dec),
      skillIds: Object.values(hero.skillSystem ?? {})
        .map(skill => Number(skill.id))
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

function mapEnemies(
  enemyTable,
  enemyLang,
  attributeInfoById,
  unitProperties,
  templateValues
) {
  return enemyTable.rows
    .filter(enemy => enemy.isUsable === 1)
    .map(enemy => ({
      id: Number(enemy.id),
      name: enemyLang.get(String(enemy.name))?.value ?? String(enemy.name),
      description: cleanMarkup(enemyLang.get(String(enemy.desc))?.value ?? ''),
      unitId: numberOrNull(enemy.unitId),
      enemyType: numberOrNull(enemy.enemyType),
      elementIds: parseNumberList(enemy.element),
      hpBarType: numberOrNull(enemy.hpBarType),
      hpBarWeakness: Boolean(enemy.hpBarWeakness),
      property: mapProperty(
        enemy.propertyId,
        attributeInfoById,
        unitProperties,
        templateValues
      ),
      worldProperty: mapProperty(
        enemy.worldPropertyId,
        attributeInfoById,
        unitProperties,
        templateValues
      ),
      skillIds: parseSkillSlotList(enemy.skillList, 'enemy').map(
        item => item.skillId
      ),
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
    .map(form => {
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
          .map(index => ({
            name: fields.get(`特性${index}`) ?? '',
            description: cleanMarkup(fields.get(`特性${index}描述`)),
          }))
          .filter(trait => trait.name || trait.description),
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
    .map(form => {
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
    .map(form => {
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
    .filter(filePath => /\.(png|jpe?g|webp|gif)$/i.test(filePath))
    .map(filePath => {
      const relativePath = normalizePath(path.relative(mediaRoot, filePath));
      return {
        fileName: path.basename(filePath),
        relativePath,
      };
    })
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'zh-CN'));

  const duplicateFileNames = findDuplicateNames(
    imageFiles.map(item => item.fileName)
  );

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
    .filter(enemy => !enemy.property.exists)
    .map(enemy => enemy.id);
  const missingWorldEnemyPropertyIds = data.enemies
    .filter(enemy => enemy.worldProperty.id && !enemy.worldProperty.exists)
    .map(enemy => enemy.id);
  const missingCharacterPropertyIds = data.characters
    .filter(character => !character.property.exists)
    .map(character => character.id);
  const skillTimingMissingCount = data.skills.filter(
    skill => skill.needsTimingData
  ).length;
  const skillNoLevelValues = data.skills
    .filter(skill => skill.level.values.length === 0)
    .map(skill => skill.id);
  const skillLevelCrossCheckSummary = data.skillLevelCrossCheck?.summary ?? {};
  const skillLevelCrossCheckMissingCount =
    (skillLevelCrossCheckSummary.missingSkills ?? 0) +
    (skillLevelCrossCheckSummary.missingLevels ?? 0);
  const skillLevelCrossCheckMismatchCount =
    (skillLevelCrossCheckSummary.mismatchedSkills ?? 0) +
    (skillLevelCrossCheckSummary.mismatchedLevels ?? 0);
  const skillLogicSummary = data.skillLogicIndex?.summary ?? {};
  const valueParamSummary = data.valueParamIndex?.summary ?? {};
  const combatFormulaEvidenceSummary =
    data.combatFormulaEvidence?.summary ?? {};
  const skillAssetEvidenceSummary = data.skillAssetEvidence?.summary ?? {};
  const characterAttributePanelSummary =
    data.characterAttributePanels?.summary ?? {};
  const missingCharacterAttributePanelCount = Math.max(
    0,
    data.characters.length - (characterAttributePanelSummary.characters ?? 0)
  );
  const nonAzPrPlaceholderNames = [
    '云堇',
    '钟离',
    '甘雨',
    '雷电将军',
    '温迪',
    '可莉',
  ];
  const placeholderCharacters = data.characters
    .filter(character => nonAzPrPlaceholderNames.includes(character.name))
    .map(character => character.name);

  const warnings = [
    {
      code: 'skill-timing-missing',
      severity: 'info',
      count: skillTimingMissingCount,
      message:
        '技能命中帧、动作时长和取消窗口尚未从 asset 或运行时捕获获得，已统一标记 needsTimingData。',
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
      message:
        'hero-module 聚合倍率与 NewTable/skill_level.json 还原结果存在差异。',
    },
    {
      code: 'skill-logic-row-missing',
      severity:
        (skillLogicSummary.missingLogicRows ?? 0) > 0 ? 'warning' : 'ok',
      count: skillLogicSummary.missingLogicRows ?? 0,
      summary: skillLogicSummary,
      message: 'skillsub_logic.json 中缺少当前角色技能引用的 subSkillId。',
    },
    {
      code: 'skill-display-logic-timing-mismatch',
      severity:
        (skillLogicSummary.displayLogicMismatchSubSkills ?? 0) > 0
          ? 'info'
          : 'ok',
      count: skillLogicSummary.displayLogicMismatchSubSkills ?? 0,
      summary: skillLogicSummary,
      message:
        'skill_level 显示层 coolDown/spCost 与 skillsub_logic 逻辑层 coolDown/spCost 不一致，排轴应优先区分字段来源。',
    },
    {
      code: 'skill-element-value-row-missing',
      severity:
        (skillLogicSummary.levelsMissingElementValues ?? 0) > 0 ? 'info' : 'ok',
      count: skillLogicSummary.levelsMissingElementValues ?? 0,
      summary: skillLogicSummary,
      message:
        '部分技能等级没有 skillsub_ele_value 数值参数行，可能是被动、纯逻辑或无需倍率参数的技能。',
    },
    {
      code: 'skill-value-param-semantic-unresolved',
      severity:
        (valueParamSummary.unresolvedParameterIds?.length ?? 0) > 0
          ? 'info'
          : 'ok',
      count: valueParamSummary.unresolvedParameterIds?.length ?? 0,
      ids: valueParamSummary.unresolvedParameterIds ?? [],
      summary: valueParamSummary,
      message:
        'valueParam 参数 ID 已建立公式槽位统计，但战斗语义仍未确认，不能直接写入伤害公式。',
    },
    {
      code: 'combat-formula-evidence-direct-link-missing',
      severity:
        (combatFormulaEvidenceSummary.directCurrentElementFormulaIdMatches ?? 0) > 0
          ? 'ok'
          : 'info',
      count: combatFormulaEvidenceSummary.directCurrentElementFormulaIdMatches ?? 0,
      summary: combatFormulaEvidenceSummary,
      message:
        '已建立敌人属性与公式证据索引，但当前 skillsub_ele_value.elementId 未直接匹配 element_formula.id，仍需 asset/效果节点追踪。',
    },
    {
      code: 'skill-asset-effect-node-unmapped',
      severity:
        (skillAssetEvidenceSummary.currentSkillsWithExtractedSkillControl ?? 0) > 0
          ? 'info'
          : 'warning',
      count:
        skillAssetEvidenceSummary.currentSkillsMissingExtractedSkillControl ?? 0,
      summary: skillAssetEvidenceSummary,
      message:
        'C:/PC2/Codex/AzPr 当前缺少 Config/Battle/Skill 实体资源；已按规则从 AzPr Extractor SkillList 建立 skill_control 候选索引，但还未解析为命中帧/效果节点/公式映射。',
    },
    {
      code: 'character-attribute-panel-missing',
      severity: missingCharacterAttributePanelCount > 0 ? 'warning' : 'ok',
      count: missingCharacterAttributePanelCount,
      summary: characterAttributePanelSummary,
      message: '角色当前数值面板快照缺失，后续倍率转伤害前必须补齐。',
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
      combatFormulaEvidence:
        data.combatFormulaEvidence?.summary?.elementFormulaRows ?? 0,
      skillAssetEvidence:
        data.skillAssetEvidence?.summary?.currentSkillsWithExtractedSkillControl ??
        0,
      characterAttributePanels:
        data.characterAttributePanels?.summary?.characters ?? 0,
    },
    warnings,
  };
}

function mapProperty(
  propertyId,
  attributeInfoById,
  unitProperties,
  templateValues
) {
  const id = numberOrNull(propertyId);
  const unitProperty = id == null ? null : unitProperties.get(id);
  const baseAttributeId = unitProperty?.baseAttributeId ?? null;
  const templateValue =
    baseAttributeId == null
      ? null
      : templateValues.get(Number(baseAttributeId));

  return {
    id,
    exists: Boolean(unitProperty),
    baseAttributeId: numberOrNull(baseAttributeId),
    baseAttributes: parseBaseAttributes(
      templateValue?.baseAttribute,
      attributeInfoById
    ),
  };
}

function parseBaseAttributes(raw, attributeInfoById) {
  if (!raw) {
    return [];
  }

  return String(raw)
    .split('|')
    .map(pair => {
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
    .filter(item => Number.isFinite(item.id) && Number.isFinite(item.value));
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
  return restraint.map(item => ({
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
      .map(level => ({
        level,
        description: cleanMarkup(fields.get(`${prefix}描述${level}`)),
      }))
      .filter(item => item.description),
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
  const names = [
    '基础生命',
    '基础攻击',
    '基础物理防御',
    '基础魔法防御',
    '治疗加成',
    '攻击',
    '生命',
  ];
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
  return new Map(fields.map(field => [field.name, field.value]));
}

function splitPipe(raw) {
  if (raw == null || raw === '') {
    return [];
  }
  return String(raw)
    .split('|')
    .map(item => item.trim())
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
    .map(item => {
      const [slotText, skillText] = item.includes('#')
        ? item.split('#')
        : [null, item];
      return {
        group,
        slot: slotText == null ? null : numberOrNull(slotText),
        skillId: numberOrNull(skillText),
      };
    })
    .filter(item => item.skillId != null);
}

function parseNumberList(raw) {
  if (!raw) {
    return [];
  }

  return String(raw)
    .split('|')
    .flatMap(part => part.split(','))
    .map(value =>
      numberOrNull(value.includes('#') ? value.split('#').at(-1) : value)
    )
    .filter(value => value != null);
}

function parseAssetPathList(raw) {
  if (!raw) {
    return [];
  }

  return String(raw)
    .split('|')
    .flatMap(group => group.split(','))
    .map(item => item.trim())
    .filter(Boolean);
}

function splitTextList(raw) {
  if (!raw) {
    return [];
  }

  return String(raw)
    .split(/[、,，|]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item)).filter(Boolean);
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
  return (
    Number(a.characterId) - Number(b.characterId) || Number(a.id) - Number(b.id)
  );
}
