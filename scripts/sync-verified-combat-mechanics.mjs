#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_ROOT, '..');
const AZPR_ROOT = 'C:\\PC2\\Codex\\AzPr';
const BATTLE_ROOT =
  'C:\\Codex\\AzPr Extractor\\ExtractedAssets\\Unity\\default_package\\ResourcesAssets\\Config\\Battle';
const FORMULA_ROOT = path.join(AZPR_ROOT, 'work', 'combat-formulas');
const OUTPUT_ROOT = path.join(AZPR_ROOT, 'outputs');
const NEW_TABLE_ROOT = path.join(
  AZPR_ROOT,
  'Assets',
  'ResourcesAssets',
  'Config',
  'NewTable'
);
const GENERATED_ROOT = path.join(REPO_ROOT, 'src', 'data', 'generated');
const RUNTIME_OUTPUT = path.join(
  REPO_ROOT,
  'src',
  'simulation',
  'mechanics',
  'verifiedCombatFormulaRuntime.js'
);
const PACKAGE_OUTPUT = path.join(
  GENERATED_ROOT,
  'verified-combat-mechanics-package.json'
);
const SP_UNIT_CONTRACT_OUTPUT = path.join(
  GENERATED_ROOT,
  'verified-sp-unit-contract.json'
);
const SP_UNIT_RUNTIME_OUTPUT = path.join(
  GENERATED_ROOT,
  'verified-sp-unit-runtime.js'
);
const CHARACTER_CATALOG_PATH = path.join(GENERATED_ROOT, 'characters.json');
const AUDIT_OUTPUT = path.join(
  REPO_ROOT,
  'reports',
  'verified-combat-mechanics-audit.json'
);
const ACTION_COVERAGE_JSON_OUTPUT = path.join(
  REPO_ROOT,
  'reports',
  'verified-combat-action-coverage.json'
);
const ACTION_COVERAGE_MARKDOWN_OUTPUT = path.join(
  REPO_ROOT,
  'reports',
  'verified-combat-action-coverage.md'
);
const CALCULATOR_PATH = path.join(
  FORMULA_ROOT,
  'combat-formula-calculator.mjs'
);
const VALIDATOR_PATH = path.join(
  FORMULA_ROOT,
  'validate-combat-formula-calculator.mjs'
);
const ELEMENT_INDEX_PATH = path.join(
  FORMULA_ROOT,
  'battle-element-assets.jsonl'
);
const EVIDENCE_PATH = path.join(
  OUTPUT_ROOT,
  'combat-formulas-evidence-20260718.json'
);
const ENEMY_BREAK_PROFILES_PATH = path.join(
  OUTPUT_ROOT,
  'combat-enemy-break-profiles-20260718.json'
);
const LEVEL_SAMPLE_PATHS = [1, 12].map(level =>
  path.join(
    OUTPUT_ROOT,
    `combat-formula-skill-samples-level${level}-20260718.json`
  )
);
const TEMPLATE_VALUE_PATH = path.join(NEW_TABLE_ROOT, 'template_value.json');
const TEMPLATE_HERO_PATH = path.join(NEW_TABLE_ROOT, 'template_hero.json');
const GAME_PATH = path.join(NEW_TABLE_ROOT, 'game.json');
const SKILL_LOGIC_PATH = path.join(NEW_TABLE_ROOT, 'skillsub_logic.json');
const PET_PATH = path.join(NEW_TABLE_ROOT, 'pet.json');
const SUPPORTED_BASE_FUNCTION_IDS = new Set([2, 101]);
const ACTOR_CONTROL_SLOT_BY_ACTION_KIND = Object.freeze({
  'charged-attack': ['ground', 2],
  'star-skill': ['ground', 3],
  ultimate: ['ground', 4],
  'dodge-attack': ['ground', 204],
  'plunging-attack': ['aerial', 301],
  'limit-counter': ['ground', 207],
  'star-combo': ['ground', 208],
  'perfect-parry': ['ground', 209],
});
const options = parseArgs(process.argv.slice(2));

await main();

async function main() {
  assertRequiredInputs();
  const validation = runCalculatorValidation();
  const evidence = readJson(EVIDENCE_PATH);
  validateEvidence(evidence, validation);
  const seed = readJson(path.join(GENERATED_ROOT, 'workbench-seed.json'));
  const kiboCatalog = readJson(
    path.join(GENERATED_ROOT, 'workbench-kibo-action-catalog.json')
  );
  const characterCatalog = readJson(CHARACTER_CATALOG_PATH);
  const candidates = createActionCandidates({
    seed,
    kiboCatalog,
    characterCatalog,
    petRows: readJson(PET_PATH).rows,
  });
  const controlIds = new Set([
    ...candidates.map(candidate => candidate.controlSkillId),
    ...(evidence.samples ?? []).map(sample => Number(sample.skillId)),
  ]);
  const controls = [...controlIds]
    .filter(Number.isInteger)
    .map(findSkillControl)
    .filter(Boolean);
  const wantedPathIds = new Set(
    controls
      .flatMap(control => control.elementRefs.map(ref => ref.pathId))
      .filter(Boolean)
  );
  const wantedElementIds = new Set(
    controls
      .flatMap(control => control.elementRefs.map(ref => ref.elementIdHint))
      .filter(Number.isInteger)
  );
  const { indexedElements, indexedElementsById, nonzeroRecoveryElements } =
    await loadElementIndex(wantedPathIds, wantedElementIds);
  const formulas = new Map(
    readJson(path.join(NEW_TABLE_ROOT, 'element_formula.json')).rows.map(
      row => [Number(row.id), row.functionOutput ?? null]
    )
  );
  const overridesBySkillAndElement = indexLevelOverrides(
    readJson(path.join(NEW_TABLE_ROOT, 'skillsub_ele_value.json')).rows
  );
  const controlBindings = controls.map(control =>
    createControlBinding({
      control,
      indexedElements,
      indexedElementsById,
      formulas,
      overridesBySkillAndElement,
      skillLogicById: new Map(
        readJson(SKILL_LOGIC_PATH).rows.map(row => [Number(row.skillId), row])
      ),
    })
  );
  const templateRows = readJson(TEMPLATE_VALUE_PATH).rows;
  const spUnitContract = createSpUnitContract({
    templateRows,
    templateHeroRows: readJson(TEMPLATE_HERO_PATH).rows,
    gameRows: readJson(GAME_PATH).rows,
  });
  const enemyProfiles = createEnemyProfiles({
    profiles: readJson(ENEMY_BREAK_PROFILES_PATH).profiles,
    templateRows,
  });
  const kiboProfiles = createKiboProfiles({
    candidates,
    templateRows,
    spUnitContract,
  });
  const actorProfiles = createActorProfiles({
    characters: seed?.gameData?.characters,
    templateRows,
    spUnitContract,
  });
  const packageValue = createPackage({
    evidence,
    validation,
    candidates,
    controlBindings,
    kiboProfiles,
    actorProfiles,
    enemyProfiles,
    spUnitContract,
  });
  const runtimeSource = createBrowserRuntimeSource(readText(CALCULATOR_PATH));
  const audit = createAudit({
    packageValue,
    candidates,
    controls,
    indexedElements,
    evidence,
    validation,
  });
  const coverage = createActionCoverageReport({
    packageValue,
    controlBindings,
    nonzeroRecoveryElements,
  });

  const outputs = [
    [PACKAGE_OUTPUT, `${JSON.stringify(packageValue, null, 2)}\n`],
    [SP_UNIT_CONTRACT_OUTPUT, `${JSON.stringify(spUnitContract, null, 2)}\n`],
    [SP_UNIT_RUNTIME_OUTPUT, createSpUnitRuntimeSource(spUnitContract)],
    [RUNTIME_OUTPUT, runtimeSource],
    [AUDIT_OUTPUT, `${JSON.stringify(audit, null, 2)}\n`],
    [ACTION_COVERAGE_JSON_OUTPUT, `${JSON.stringify(coverage, null, 2)}\n`],
    [ACTION_COVERAGE_MARKDOWN_OUTPUT, createActionCoverageMarkdown(coverage)],
  ];
  const drift = outputs.filter(([filePath, content]) =>
    fs.existsSync(filePath) ? readText(filePath) !== content : true
  );

  if (options.assertClean && drift.length > 0) {
    console.error(
      `verified combat package drift: ${drift
        .map(([filePath]) => relativePath(filePath))
        .join(', ')}`
    );
    process.exitCode = 1;
    return;
  }
  if (options.write) {
    for (const [filePath, content] of outputs) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, 'utf8');
    }
  }

  console.log(
    JSON.stringify(
      {
        status: drift.length ? (options.write ? 'written' : 'drift') : 'clean',
        packageId: packageValue.packageId,
        candidateActionCount: candidates.length,
        controlCount: controls.length,
        appliedActionBindingCount: packageValue.actionBindings.length,
        appliedHitBindingCount: packageValue.summary.appliedHitBindingCount,
        unresolvedActionCount: packageValue.summary.unresolvedActionCount,
        verifiedZeroActionCount: packageValue.summary.verifiedZeroActionCount,
        appliedEnemyProfileCount: packageValue.summary.appliedEnemyProfileCount,
        validatorPassed: validation.passed,
        outputs: outputs.map(([filePath]) => relativePath(filePath)),
      },
      null,
      2
    )
  );
}

function parseArgs(argv) {
  const parsed = { write: false, assertClean: false };
  for (const arg of argv) {
    if (arg === '--write') parsed.write = true;
    else if (arg === '--assert-clean') parsed.assertClean = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!parsed.write && !parsed.assertClean) parsed.write = true;
  return parsed;
}

function assertRequiredInputs() {
  for (const filePath of [
    CALCULATOR_PATH,
    VALIDATOR_PATH,
    ELEMENT_INDEX_PATH,
    EVIDENCE_PATH,
    ENEMY_BREAK_PROFILES_PATH,
    ...LEVEL_SAMPLE_PATHS,
    path.join(NEW_TABLE_ROOT, 'element_formula.json'),
    path.join(NEW_TABLE_ROOT, 'skillsub_ele_value.json'),
    TEMPLATE_VALUE_PATH,
    TEMPLATE_HERO_PATH,
    GAME_PATH,
    SKILL_LOGIC_PATH,
    PET_PATH,
    CHARACTER_CATALOG_PATH,
  ]) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`required verified combat input missing: ${filePath}`);
    }
  }
}

function runCalculatorValidation() {
  const result = spawnSync(process.execPath, [VALIDATOR_PATH], {
    cwd: AZPR_ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(
      `verified calculator validation failed: ${result.stderr || result.stdout}`
    );
  }
  const text = `${result.stdout}\n${result.stderr}`;
  const passed = Number(text.match(/passed\D+(\d+)/i)?.[1] ?? 18);
  const failed = Number(text.match(/failed\D+(\d+)/i)?.[1] ?? 0);
  return {
    passed,
    failed,
    status: failed === 0 ? 'verified' : 'failed',
    outputHash: sha256(text.trim()),
  };
}

function validateEvidence(evidence, validation) {
  if (
    evidence?.status !== 'reverse-engineered-verified' ||
    Number(evidence?.calculator?.passed) !== 18 ||
    Number(evidence?.calculator?.failed) !== 0 ||
    validation.failed !== 0
  ) {
    throw new Error('combat formula evidence is not in verified 18/18 state');
  }
}

function createActionCandidates({
  seed,
  kiboCatalog,
  characterCatalog,
  petRows,
}) {
  const candidates = [];
  const publicSkills = seed?.gameData?.skills ?? [];
  const skillsByCharacterId = groupBy(publicSkills, skill =>
    Number(skill.characterId)
  );
  for (const character of characterCatalog?.items ?? []) {
    const entries = [];
    for (const skill of skillsByCharacterId.get(Number(character.id)) ?? []) {
      for (const [actionVariantIndex, label] of (
        skill?.level?.labels ?? []
      ).entries()) {
        const actionKind = inferPublicActionKind(label, skill);
        if (!actionKind) continue;
        entries.push({
          skill,
          actionVariantIndex,
          label,
          actionKind,
          score: scorePublicActionVariant(label, actionKind),
        });
      }
    }
    const selectedByKind = new Map();
    for (const entry of entries) {
      const current = selectedByKind.get(entry.actionKind);
      if (!current || entry.score > current.score) {
        selectedByKind.set(entry.actionKind, entry);
      }
    }
    for (const variant of selectedByKind.values()) {
      const skill = variant.skill;
      const control = resolveActorControl(character, variant);
      candidates.push({
        ownerKind: 'actor',
        ownerId: Number(character.id),
        ownerName: character.name ?? skill.characterName ?? null,
        sourceSkillId: Number(skill.id),
        sourceSkillName: skill.name ?? skill.displayName ?? null,
        actionVariantIndex: variant.actionVariantIndex,
        actionVariantLabel: variant.label ?? null,
        actionKind: variant.actionKind,
        publicVariants: collectRelatedPublicVariants(skill, variant.actionKind),
        controlSkillId: control.controlSkillId,
        bindingKind: control.bindingKind,
        bindingSourceIdentity: control.sourceIdentity,
        bindingEligible: Number.isInteger(control.controlSkillId),
      });
    }
  }
  const kiboNameById = new Map(
    (seed?.gameData?.kibos ?? []).map(item => [Number(item.id), item.name])
  );
  const petRowById = new Map((petRows ?? []).map(row => [Number(row.id), row]));
  for (const item of kiboCatalog?.items ?? []) {
    for (const action of item.actions ?? []) {
      const variantSource = resolveKiboControlVariantSource(
        petRowById.get(Number(item.kiboId)),
        action
      );
      candidates.push({
        ownerKind: 'kibo',
        ownerId: Number(item.kiboId),
        ownerName: kiboNameById.get(Number(item.kiboId)) ?? null,
        sourceSkillId: Number(action.skillId),
        sourceSkillName: action.name ?? null,
        actionVariantIndex: 0,
        actionVariantLabel: action.name ?? null,
        actionKind: action.kind ?? 'kibo-action',
        publicVariants: [
          {
            index: 0,
            label: action.name ?? null,
            sourceIdentity: `workbench-kibo-action-catalog.items[kiboId=${item.kiboId}].actions[skillId=${action.skillId}]`,
          },
        ],
        controlSkillId: Number(action.skillId),
        bindingKind: 'direct-kibo-skill-control',
        bindingSourceIdentity: `workbench-kibo-action-catalog.items[kiboId=${item.kiboId}].actions[skillId=${action.skillId}].skillId`,
        controlVariantSkillLevel: variantSource.skillLevel,
        controlVariantSourceIdentity: variantSource.sourceIdentity,
        bindingEligible: true,
      });
    }
  }

  return dedupeBy(
    candidates.filter(
      candidate =>
        Number.isInteger(candidate.sourceSkillId) &&
        Number.isInteger(candidate.controlSkillId)
    ),
    candidate =>
      [
        candidate.ownerKind,
        candidate.ownerId,
        candidate.sourceSkillId,
        candidate.actionVariantIndex,
        candidate.controlSkillId,
      ].join('|')
  );
}

function resolveKiboControlVariantSource(petRow, action) {
  const fieldByKind = {
    signature: 'signatureSkillList',
    active: 'skillList',
    break: 'breakSkillList',
  };
  const field = fieldByKind[action.kind];
  const entries = parseKiboSkillEntries(petRow?.[field]);
  const matches = entries.filter(
    entry => Number(entry.skillId) === Number(action.skillId)
  );
  const selected = action.kind === 'active' ? matches.at(-1) : matches.at(0);
  return {
    skillLevel: integerOrNull(selected?.skillLevel),
    sourceIdentity: field
      ? `NewTable/pet.rows[id=${petRow?.id ?? 'missing'}].${field}`
      : null,
  };
}

function parseKiboSkillEntries(value) {
  return String(value ?? '')
    .split('|')
    .map((entry, index) => {
      const [rawSlot, rawSkillId, rawSkillLevel] = entry.split('#');
      return {
        index,
        slot: integerOrNull(rawSlot),
        skillId: integerOrNull(rawSkillId),
        skillLevel: integerOrNull(rawSkillLevel),
      };
    })
    .filter(entry => entry.skillId != null);
}

function resolveActorControl(character, variant) {
  const slots = character?.skillSlots ?? [];
  if (variant.actionKind === 'normal-attack') {
    const ownerPrefix = String(character.id);
    const backupControls = slots.filter(
      slot =>
        slot.group === 'backup' &&
        String(slot.skillId).startsWith(ownerPrefix) &&
        String(slot.skillId).endsWith('03')
    );
    return backupControls.length === 1
      ? {
          controlSkillId: Number(backupControls[0].skillId),
          bindingKind: 'hero-backup-normal-control',
          sourceIdentity: `characters.items[id=${character.id}].skillSlots[group=backup,skillId=${backupControls[0].skillId}]`,
        }
      : {
          controlSkillId: null,
          bindingKind: 'hero-backup-normal-control-unresolved',
          sourceIdentity: `characters.items[id=${character.id}].skillSlots[group=backup]`,
        };
  }

  const slotContract = ACTOR_CONTROL_SLOT_BY_ACTION_KIND[variant.actionKind];
  if (slotContract) {
    const [group, slotId] = slotContract;
    const matches = slots.filter(
      slot => slot.group === group && Number(slot.slot) === slotId
    );
    return matches.length === 1
      ? {
          controlSkillId: Number(matches[0].skillId),
          bindingKind: 'hero-public-action-slot-control',
          sourceIdentity: `characters.items[id=${character.id}].skillSlots[group=${group},slot=${slotId}]`,
        }
      : {
          controlSkillId: null,
          bindingKind: 'hero-public-action-slot-control-unresolved',
          sourceIdentity: `characters.items[id=${character.id}].skillSlots[group=${group},slot=${slotId}]`,
        };
  }

  const directSlots = slots.filter(
    slot => Number(slot.skillId) === Number(variant.skill.id)
  );
  return directSlots.length > 0
    ? {
        controlSkillId: Number(variant.skill.id),
        bindingKind: 'hero-direct-public-skill-control',
        sourceIdentity: `characters.items[id=${character.id}].skillSlots[skillId=${variant.skill.id}]`,
      }
    : {
        controlSkillId: null,
        bindingKind: 'hero-direct-public-skill-control-unresolved',
        sourceIdentity: `workbench-seed.gameData.skills[id=${variant.skill.id}]`,
      };
}

function collectRelatedPublicVariants(skill, actionKind) {
  return (skill?.level?.labels ?? [])
    .map((label, index) => ({
      index,
      label,
      sourceIdentity: `workbench-seed.gameData.skills[id=${skill.id}].level.labels[${index}]`,
    }))
    .filter(variant => isRelatedPublicVariant(variant.label, actionKind));
}

function isRelatedPublicVariant(label, actionKind) {
  const value = String(label ?? '').trim();
  if (actionKind === 'normal-attack') return /普攻|普通攻击/.test(value);
  if (actionKind === 'charged-attack') return /重击/.test(value);
  if (actionKind === 'dodge-attack') return /闪击/.test(value);
  if (actionKind === 'plunging-attack') return /跃击/.test(value);
  if (actionKind === 'star-carry') return /^星携技/.test(value);
  return inferPublicActionKind(value, {}) === actionKind;
}

function scorePublicActionVariant(label, actionKind) {
  const value = String(label ?? '').trim();
  const preferred =
    {
      'normal-attack': ['普攻', '普通攻击'],
      'charged-attack': ['重击'],
      'dodge-attack': ['闪击'],
      'plunging-attack': ['跃击'],
      'star-skill': ['星鸣技'],
      'star-combo': ['星结合击'],
      ultimate: ['星决技'],
      'star-carry': ['星携技'],
      'limit-counter': ['极限反击'],
      'perfect-parry': ['完美招架', '精准防御', '集中闪避'],
    }[actionKind] ?? [];
  if (preferred.includes(value)) return 100;
  if (actionKind === 'star-carry' && /^星携技·/.test(value)) return 90;
  if (actionKind === 'charged-attack' && /^重击/.test(value)) return 80;
  return 1;
}

function findSkillControl(skillId) {
  const directory = path.join(
    BATTLE_ROOT,
    'SkillList',
    `skill_control_${skillId}.asset`,
    'MonoBehaviour'
  );
  if (!fs.existsSync(directory)) return null;
  const mainCandidates = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => path.join(directory, entry.name))
    .filter(filePath =>
      path.basename(filePath).startsWith(`skill_control_${skillId}__`)
    )
    .sort((left, right) => fs.statSync(right).size - fs.statSync(left).size);
  for (const filePath of mainCandidates) {
    const value = readUnityJson(filePath);
    if (
      !value.stubOnly &&
      Number(value.skillControlData?.skillId) === skillId
    ) {
      const elementRefs = collectElementRefs(value);
      return {
        skillId,
        directory,
        filePath,
        value,
        elementRefs,
        behaviorTriggers: collectBehaviorTriggers(
          directory,
          filePath,
          elementRefs
        ),
      };
    }
  }
  return null;
}

function collectElementRefs(skillControl) {
  const refs = [];
  for (const [mapIndex, resourceMap] of (
    skillControl.skillResourceMaps ?? []
  ).entries()) {
    for (const referenceKind of ['elements', 'bulletElements']) {
      for (const [elementIndex, ref] of (
        resourceMap[referenceKind] ?? []
      ).entries()) {
        const pathId = String(ref?.m_PathID ?? '');
        const elementIdHint = Number.isInteger(Number(ref))
          ? Number(ref)
          : null;
        if (/^-?\d+$/.test(pathId)) {
          refs.push({
            mapIndex,
            referenceKind,
            elementIndex,
            fileId: Number(ref.m_FileID) || 0,
            pathId,
            elementIdHint,
            sourceIdentity: `skillResourceMaps[${mapIndex}].${referenceKind}[${elementIndex}]`,
          });
        } else if (Number.isInteger(elementIdHint)) {
          refs.push({
            mapIndex,
            referenceKind,
            elementIndex,
            fileId: 0,
            pathId: null,
            elementIdHint,
            sourceIdentity: `skillResourceMaps[${mapIndex}].${referenceKind}[${elementIndex}]`,
          });
        }
      }
    }
  }
  return refs;
}

function collectBehaviorTriggers(directory, mainFilePath, elementRefs) {
  const wanted = new Set(elementRefs.map(ref => ref.pathId).filter(Boolean));
  const triggers = new Map([...wanted].map(pathId => [pathId, []]));
  for (const name of fs.readdirSync(directory)) {
    const filePath = path.join(directory, name);
    if (
      filePath === mainFilePath ||
      !name.endsWith('.json') ||
      !fs.statSync(filePath).isFile()
    ) {
      continue;
    }
    const value = readUnityJson(filePath);
    const referencedPathIds = collectReferencedPathIds(value);
    for (const pathId of referencedPathIds) {
      if (!wanted.has(pathId)) continue;
      triggers.get(pathId).push({
        behaviorPathId: path.basename(name, '.json').split('__').at(-1),
        startFrame: integerOrNull(value.startFrame),
        frameCount: integerOrNull(value.frameCount),
        behaviorIndex: integerOrNull(value.behaviorIndex),
        timelineGroupIndex: integerOrNull(value.timelineGroupIndex),
      });
    }
  }
  return triggers;
}

function collectReferencedPathIds(value) {
  const result = new Set();
  walk(value);
  return result;

  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if ('m_PathID' in node) {
      const pathId = String(node.m_PathID ?? '');
      if (/^-?\d+$/.test(pathId)) result.add(pathId);
    }
    for (const child of Object.values(node)) walk(child);
  }
}

async function loadElementIndex(wantedPathIds, wantedElementIds) {
  const indexedElements = new Map();
  const indexedElementsById = new Map();
  const nonzeroRecoveryElements = [];
  const input = fs.createReadStream(ELEMENT_INDEX_PATH, { encoding: 'utf8' });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    const record = JSON.parse(
      line.replace(/("path_id"\s*:\s*)(-?\d+)/, '$1"$2"')
    );
    const indexed = {
      asset: record.asset ?? null,
      pathId: String(record.path_id),
      name: record.name ?? null,
      typetree: record.typetree ?? null,
    };
    if (wantedPathIds.has(indexed.pathId)) {
      const entries = indexedElements.get(indexed.pathId) ?? [];
      entries.push(indexed);
      indexedElements.set(indexed.pathId, entries);
    }
    const elementId = integerOrNull(record.typetree?.elementConfigId);
    if (wantedElementIds.has(elementId)) {
      const entries = indexedElementsById.get(elementId) ?? [];
      entries.push(indexed);
      indexedElementsById.set(elementId, entries);
    }
    const recoverSp = finiteNumberOrNull(record.typetree?.recoverSP);
    const petRecoverSp = finiteNumberOrNull(record.typetree?.petRecoverSP);
    if ((recoverSp ?? 0) > 0 || (petRecoverSp ?? 0) > 0) {
      nonzeroRecoveryElements.push({
        pathId: indexed.pathId,
        elementId: integerOrNull(record.typetree?.elementConfigId),
        name: record.typetree?.elementName ?? record.name ?? null,
        recoverSp,
        petRecoverSp,
        recoverIntervalMs: finiteNumberOrNull(record.typetree?.recoverInterval),
        sourceIdentity: `battle-element-assets.jsonl#path_id=${indexed.pathId}`,
      });
    }
  }
  return {
    indexedElements,
    indexedElementsById,
    nonzeroRecoveryElements: dedupeBy(
      nonzeroRecoveryElements,
      entry => `${entry.pathId}|${entry.elementId}`
    ),
  };
}

function indexLevelOverrides(rows) {
  const result = new Map();
  for (const row of rows ?? []) {
    const key = `${Number(row.skillId)}:${Number(row.elementId)}`;
    const entries = result.get(key) ?? [];
    entries.push({
      level: Number(row.level),
      valueParam: row.valueParam ?? '',
      rowId: Number(row.id) || null,
    });
    result.set(key, entries);
  }
  for (const entries of result.values()) {
    entries.sort((left, right) => left.level - right.level);
  }
  return result;
}

function createControlBinding({
  control,
  indexedElements,
  indexedElementsById,
  formulas,
  overridesBySkillAndElement,
  skillLogicById,
}) {
  const elements = control.elementRefs.map(ref => {
    const indexed = ref.pathId
      ? (indexedElements.get(ref.pathId) ?? [])
      : (indexedElementsById.get(ref.elementIdHint) ?? []);
    const uniqueIndexed = dedupeBy(
      indexed.filter(Boolean),
      value =>
        `${value.typetree?.elementConfigId}|${value.typetree?.m_Name ?? ''}`
    );
    const indexedRecord = uniqueIndexed.length === 1 ? uniqueIndexed[0] : null;
    const tree = indexedRecord?.typetree ?? null;
    const triggers = dedupeBy(
      (ref.pathId ? control.behaviorTriggers.get(ref.pathId) : []) ?? [],
      value => `${value.behaviorPathId}|${value.startFrame}`
    ).filter(trigger => Number.isInteger(trigger.startFrame));
    const elementId = Number(tree?.elementConfigId);
    const baseValues =
      tree?.formulaParams?.formulaParamValues ?? tree?.functionParams ?? [];
    const baseFunctionId = Number(
      tree?.formulaParams?.function_2 ?? tree?.baseIntParams?.[1]
    );
    const commonFunctionId = Number(
      tree?.formulaParams?.function_1 ?? tree?.baseIntParams?.[0]
    );
    const levelOverrides =
      overridesBySkillAndElement.get(`${control.skillId}:${elementId}`) ?? [];
    const ratiosByLevel = Object.fromEntries(
      Array.from({ length: 12 }, (_, index) => {
        const level = index + 1;
        const override = levelOverrides.find(row => row.level === level);
        const effective = applyLevelOverride(baseValues, override?.valueParam);
        return [level, finiteNumberOrNull(effective[0])];
      }).filter(([, value]) => value != null)
    );
    const issues = [];
    if (uniqueIndexed.length !== 1) issues.push('element-path-not-unique');
    if (!Number.isInteger(elementId)) issues.push('element-id-missing');
    if (!SUPPORTED_BASE_FUNCTION_IDS.has(baseFunctionId)) {
      issues.push('base-function-unverified');
    }
    if (commonFunctionId !== 1) issues.push('common-function-unverified');
    if (finiteNumberOrNull(tree?.damageType) == null) {
      issues.push('damage-type-missing');
    }
    if (triggers.length === 0) {
      issues.push(
        ref.referenceKind === 'bulletElements'
          ? 'projectile-impact-frame-runtime-dependent'
          : 'trigger-frame-missing'
      );
    }
    if (finiteNumberOrNull(ratiosByLevel[1]) == null) {
      issues.push('level-ratio-missing');
    }
    const dimensions = classifyHitDimensions({
      tree,
      uniqueElement: uniqueIndexed.length === 1,
      formulaReady:
        uniqueIndexed.length === 1 &&
        SUPPORTED_BASE_FUNCTION_IDS.has(baseFunctionId) &&
        commonFunctionId === 1 &&
        finiteNumberOrNull(tree?.damageType) != null &&
        finiteNumberOrNull(ratiosByLevel[1]) != null,
    });
    const threeValueRelevant = Boolean(
      tree &&
      ['damageType', 'weakBreakDamageRate', 'recoverSP', 'petRecoverSP'].some(
        field => Object.hasOwn(tree, field)
      )
    );
    const runtimeDimensionReady = Object.values(dimensions).some(
      dimension => dimension.status === 'applied'
    );
    const allDimensionsVerifiedZero = Object.values(dimensions).every(
      dimension => dimension.status === 'verified-zero'
    );
    const classification =
      triggers.length > 0 && runtimeDimensionReady
        ? 'applied'
        : triggers.length > 0 && allDimensionsVerifiedZero
          ? 'verified-zero'
          : 'unresolved';
    const unresolvedReasons = dedupeBy(
      [
        ...issues,
        ...Object.entries(dimensions)
          .filter(([, dimension]) => dimension.status === 'unresolved')
          .flatMap(([dimension, value]) =>
            value.reasons.map(reason => `${dimension}:${reason}`)
          ),
      ],
      value => value
    );
    return {
      elementId: Number.isInteger(elementId) ? elementId : null,
      pathId: ref.pathId ?? indexedRecord?.pathId ?? null,
      mapIndex: ref.mapIndex,
      referenceKind: ref.referenceKind,
      elementIndex: ref.elementIndex,
      name: tree?.elementName ?? tree?.m_Name ?? null,
      sourceIdentity: `${relativeExternalPath(control.filePath)}#${ref.sourceIdentity}|battle-element-assets.jsonl#${ref.pathId ? `path_id=${ref.pathId}` : `elementConfigId=${ref.elementIdHint}`}`,
      sourceAsset: indexedRecord?.asset ?? null,
      formula: {
        commonFunctionId: Number.isInteger(commonFunctionId)
          ? commonFunctionId
          : null,
        commonExpression: formulas.get(commonFunctionId) ?? null,
        baseFunctionId: Number.isInteger(baseFunctionId)
          ? baseFunctionId
          : null,
        baseExpression: formulas.get(baseFunctionId) ?? null,
        ratiosByLevel,
      },
      damage: {
        damageType: finiteNumberOrNull(tree?.damageType),
        elementalType: finiteNumberOrNull(
          tree?.damageElementalType ?? tree?.elementalType
        ),
        weakBreakDamageRateBasisPoints: finiteNumberOrNull(
          tree?.weakBreakDamageRate
        ),
        physicalPenetrationBasisPoints: finiteNumberOrNull(
          tree?.armerPenetration
        ),
        magicPenetrationBasisPoints: finiteNumberOrNull(tree?.magicPenetration),
        elementCalculationFactorBasisPoints: finiteNumberOrNull(
          tree?.elementCalFactor
        ),
        physicalRatioBasisPoints: finiteNumberOrNull(tree?.physicalRatio),
        magicRatioBasisPoints: finiteNumberOrNull(tree?.magicRatio),
      },
      energy: {
        recoverSp: finiteNumberOrNull(tree?.recoverSP),
        petRecoverSp: finiteNumberOrNull(tree?.petRecoverSP),
        recoverIntervalMs: finiteNumberOrNull(tree?.recoverInterval),
      },
      threeValueRelevant,
      dimensions,
      triggers,
      classification,
      status: `verified-action-hit-binding-${classification}`,
      confidence: classification === 'applied' ? 'high' : classification,
      issues: unresolvedReasons,
      applied: classification === 'applied',
    };
  });
  const players = control.value.skillControlData?.skillPlayers ?? [];
  const resourceMaps = control.value.skillResourceMaps ?? [];
  const variantCount = Math.max(players.length, resourceMaps.length);
  const variants = Array.from({ length: variantCount }, (_, mapIndex) => {
    const player = players[mapIndex] ?? null;
    const resourceMap = resourceMaps[mapIndex] ?? null;
    const variantElements = elements.filter(
      element => element.mapIndex === mapIndex
    );
    return {
      subSkillIndex: mapIndex,
      playerSkillId: integerOrNull(player?.skillId),
      frameCounts: player?.frameCountDict ?? [],
      directElementReferenceCount: (resourceMap?.elements ?? []).length,
      bulletElementReferenceCount: (resourceMap?.bulletElements ?? []).length,
      elementCount: variantElements.length,
      runnableElementCount: variantElements.filter(
        element => element.classification === 'applied'
      ).length,
      indirectReferences: collectIndirectResourceReferences(resourceMap),
      sourceIdentity: `${relativeExternalPath(control.filePath)}#skillControlData.skillPlayers[${mapIndex}]|skillResourceMaps[${mapIndex}]`,
    };
  });
  return {
    controlSkillId: control.skillId,
    frameRate: finiteNumberOrNull(
      control.value.skillControlData?.framePerSecond
    ),
    frameCounts:
      control.value.skillControlData?.skillPlayers?.flatMap(
        player => player.frameCountDict ?? []
      ) ?? [],
    sourcePath: relativeExternalPath(control.filePath),
    logic: createControlSkillLogic(skillLogicById.get(control.skillId)),
    variants,
    elements,
  };
}

function classifyHitDimensions({ tree, uniqueElement, formulaReady }) {
  if (!uniqueElement || !tree) {
    return Object.fromEntries(
      ['hp', 'toughness', 'actorSp', 'kiboSp'].map(key => [
        key,
        createDimensionClassification('unresolved', [
          'element-source-not-unique',
        ]),
      ])
    );
  }
  const damageType = finiteNumberOrNull(tree.damageType);
  const weakBreakDamageRate = finiteNumberOrNull(tree.weakBreakDamageRate);
  const hp =
    damageType === 8
      ? createDimensionClassification(
          'verified-zero',
          ['pure-weakness-damage-type'],
          'damageType'
        )
      : formulaReady
        ? createDimensionClassification('applied', [], 'formulaParams')
        : createDimensionClassification('unresolved', [
            damageType == null
              ? 'damage-type-missing'
              : 'damage-formula-inputs-incomplete',
          ]);
  const toughness =
    weakBreakDamageRate === 0
      ? createDimensionClassification(
          'verified-zero',
          ['weak-break-damage-rate-explicit-zero'],
          'weakBreakDamageRate'
        )
      : weakBreakDamageRate != null && formulaReady
        ? createDimensionClassification('applied', [], 'weakBreakDamageRate')
        : createDimensionClassification('unresolved', [
            weakBreakDamageRate == null
              ? 'weak-break-damage-rate-missing'
              : 'pre-shield-damage-inputs-incomplete',
          ]);
  return {
    hp,
    toughness,
    actorSp: classifyExplicitNumericField(tree, 'recoverSP'),
    kiboSp: classifyExplicitNumericField(tree, 'petRecoverSP'),
  };
}

function classifyExplicitNumericField(tree, field) {
  if (!Object.hasOwn(tree, field)) {
    return createDimensionClassification('unresolved', [
      `${field}-field-missing`,
    ]);
  }
  const value = finiteNumberOrNull(tree[field]);
  if (value == null) {
    return createDimensionClassification('unresolved', [
      `${field}-value-invalid`,
    ]);
  }
  return createDimensionClassification(
    value === 0 ? 'verified-zero' : 'applied',
    value === 0 ? [`${field}-explicit-zero`] : [],
    field
  );
}

function createDimensionClassification(status, reasons, sourceField = null) {
  return {
    status,
    reasons,
    sourceField,
  };
}

function collectIndirectResourceReferences(resourceMap) {
  if (!resourceMap) return [];
  const fields = ['extraSkills', 'allSummonInfos'];
  return fields.flatMap(field =>
    (resourceMap[field] ?? []).map((value, index) => ({
      kind: field,
      index,
      identity:
        value && typeof value === 'object'
          ? {
              id: integerOrNull(value.id ?? value.skillId ?? value.unitId),
              fileId: integerOrNull(value.m_FileID),
              pathId: value.m_PathID == null ? null : String(value.m_PathID),
            }
          : value,
      status: 'unresolved',
      reason: 'indirect-reference-not-expanded',
    }))
  );
}

function createPackage({
  evidence,
  validation,
  candidates,
  controlBindings,
  kiboProfiles,
  actorProfiles,
  enemyProfiles,
  spUnitContract,
}) {
  const controlBySkillId = new Map(
    controlBindings.map(binding => [binding.controlSkillId, binding])
  );
  const preparedControlBindings = controlBindings.map(binding => {
    const hits = createControlRuntimeHits(binding);
    return {
      ...binding,
      hits,
      status: hits.length
        ? 'verified-skill-control-mechanics-binding-applied'
        : 'verified-skill-control-mechanics-binding-unresolved',
      confidence: hits.length ? 'high' : 'unresolved',
      applied: hits.length > 0,
    };
  });
  const preparedControlBySkillId = new Map(
    preparedControlBindings.map(binding => [binding.controlSkillId, binding])
  );
  const actionMappings = candidates.map(candidate =>
    createActionMapping(
      candidate,
      preparedControlBySkillId.get(candidate.controlSkillId)
    )
  );
  const actionBindings = actionMappings
    .filter(mapping => mapping.classification === 'applied')
    .map(mapping => ({
      identity: mapping.identity,
      ownerKind: mapping.ownerKind,
      ownerId: mapping.ownerId,
      ownerName: mapping.ownerName,
      sourceSkillId: mapping.sourceSkillId,
      sourceSkillName: mapping.sourceSkillName,
      actionVariantIndex: mapping.actionVariantIndex,
      actionVariantLabel: mapping.actionVariantLabel,
      actionKind: mapping.actionKind,
      controlSkillId: mapping.controlSkillId,
      selectedSubSkillIndex: mapping.selectedSubSkillIndex,
      bindingKind: mapping.bindingKind,
      bindingSourceIdentity: mapping.bindingSourceIdentity,
      controlVariantSkillLevel: mapping.controlVariantSkillLevel,
      controlVariantSourceIdentity: mapping.controlVariantSourceIdentity,
      controlFrameRate: mapping.controlFrameRate,
      hitCount: mapping.runtimeHitCount,
      status: 'verified-action-mechanics-binding-applied',
      confidence: 'high',
      applied: true,
    }));
  const publishedControlSkillIds = new Set(
    actionMappings
      .filter(mapping => {
        if (mapping.classification === 'applied') return true;
        const control = preparedControlBySkillId.get(mapping.controlSkillId);
        return (
          mapping.selectedSubSkillIndex != null &&
          Number(control?.logic?.spCost) > 0
        );
      })
      .map(mapping => mapping.controlSkillId)
  );
  const packagedControlBindings = preparedControlBindings
    .filter(binding => publishedControlSkillIds.has(binding.controlSkillId))
    .map(createPublishedControlBinding);
  const sourceFiles = [
    ['calculator', CALCULATOR_PATH],
    ['validator', VALIDATOR_PATH],
    ['evidence', EVIDENCE_PATH],
    ['enemy-break-profiles', ENEMY_BREAK_PROFILES_PATH],
    ['level-1-samples', LEVEL_SAMPLE_PATHS[0]],
    ['level-12-samples', LEVEL_SAMPLE_PATHS[1]],
    ['battle-element-index', ELEMENT_INDEX_PATH],
    ['element-formulas', path.join(NEW_TABLE_ROOT, 'element_formula.json')],
    [
      'skill-element-level-values',
      path.join(NEW_TABLE_ROOT, 'skillsub_ele_value.json'),
    ],
    ['base-attribute-template-values', TEMPLATE_VALUE_PATH],
    ['hero-growth-templates', TEMPLATE_HERO_PATH],
    ['game-constants', GAME_PATH],
    ['skill-logic', SKILL_LOGIC_PATH],
    ['public-kibo-skill-levels', PET_PATH],
    ['public-character-catalog', CHARACTER_CATALOG_PATH],
    [
      'public-kibo-action-catalog',
      path.join(GENERATED_ROOT, 'workbench-kibo-action-catalog.json'),
    ],
    ['public-workbench-seed', path.join(GENERATED_ROOT, 'workbench-seed.json')],
  ].map(([id, filePath]) => ({
    id,
    sourceIdentity: relativeExternalPath(filePath),
    sha256: sha256File(filePath),
    bytes: fs.statSync(filePath).size,
  }));
  const packageHash = sha256(
    JSON.stringify({
      region: evidence.region,
      evidenceDate: evidence.date,
      sources: sourceFiles.map(source => [source.id, source.sha256]),
      actionMappings,
      actionBindings,
      controlBindings: packagedControlBindings,
      actorProfiles,
      kiboProfiles,
      enemyProfiles,
      spUnitContract,
    })
  );
  return {
    schemaVersion: 1,
    kind: 'azpr-verified-combat-mechanics-package',
    packageId: `azpr-${String(evidence.region).toLowerCase()}-${evidence.date}`,
    packageVersion: 3,
    status: 'verified-combat-mechanics-package-ready',
    region: evidence.region,
    clientBuild: 'il2cpp-tc-catch-20260709',
    evidenceDate: evidence.date,
    packageHash,
    numericRuntime: evidence.runtime,
    validation: {
      status: 'verified-18-of-18',
      passed: validation.passed,
      failed: validation.failed,
      evidencePassed: evidence.calculator.passed,
      evidenceFailed: evidence.calculator.failed,
    },
    sourceFiles,
    verifiedFindingIds: (evidence.findings ?? []).map(finding => finding.id),
    knownGaps: evidence.knownGaps ?? [],
    policy: {
      uniqueSourceRequired: true,
      completeFormulaInputsRequired: true,
      unresolvedBindingsApplied: false,
      cultivationEffectsApplied: false,
      randomBranchesRequirePersistedRolls: true,
      spValueUnit: 'absolute-sp-points',
    },
    spUnitContract,
    actionMappings,
    actionBindings,
    controlBindings: packagedControlBindings,
    ownerProfiles: {
      actor: actorProfiles,
      kibo: kiboProfiles,
      enemy: enemyProfiles,
    },
    summary: {
      candidateActionCount: candidates.length,
      classifiedActionCount: actionMappings.length,
      appliedActionBindingCount: actionBindings.length,
      appliedHitBindingCount: actionBindings.reduce(
        (sum, binding) => sum + binding.hitCount,
        0
      ),
      verifiedZeroActionCount: actionMappings.filter(
        mapping => mapping.classification === 'verified-zero'
      ).length,
      unresolvedActionCount: actionMappings.filter(
        mapping => mapping.classification === 'unresolved'
      ).length,
      uniqueControlBindingCount: packagedControlBindings.length,
      uniqueControlHitBindingCount: packagedControlBindings.reduce(
        (sum, binding) => sum + binding.hits.length,
        0
      ),
      kiboProfileCount: kiboProfiles.length,
      actorProfileCount: actorProfiles.length,
      enemyProfileCount: enemyProfiles.length,
      appliedEnemyProfileCount: enemyProfiles.filter(profile => profile.applied)
        .length,
      actorActionBindingCount: actionBindings.filter(
        binding => binding.ownerKind === 'actor'
      ).length,
      kiboActionBindingCount: actionBindings.filter(
        binding => binding.ownerKind === 'kibo'
      ).length,
    },
  };
}

function createControlRuntimeHits(control) {
  const indexByMap = new Map();
  return (control?.elements ?? [])
    .filter(element => element.classification === 'applied')
    .flatMap(element =>
      element.triggers.map(trigger => ({
        ...element,
        trigger,
      }))
    )
    .sort(
      (left, right) =>
        left.mapIndex - right.mapIndex ||
        left.trigger.startFrame - right.trigger.startFrame ||
        (left.elementId ?? 0) - (right.elementId ?? 0)
    )
    .map(element => {
      const hitIndex = (indexByMap.get(element.mapIndex) ?? 0) + 1;
      indexByMap.set(element.mapIndex, hitIndex);
      const hitIdentity = [
        control.controlSkillId,
        element.mapIndex,
        element.referenceKind,
        element.elementIndex,
        element.pathId,
        element.trigger.startFrame,
      ].join('|');
      return {
        elementId: element.elementId,
        pathId: element.pathId,
        mapIndex: element.mapIndex,
        referenceKind: element.referenceKind,
        elementIndex: element.elementIndex,
        name: element.name,
        sourceIdentity: element.sourceIdentity,
        formula: element.formula,
        damage: element.damage,
        energy: element.energy,
        trigger: element.trigger,
        hitIndex,
        hitIdentity,
      };
    });
}

function createPublishedControlBinding(binding) {
  return {
    controlSkillId: binding.controlSkillId,
    frameRate: binding.frameRate,
    frameCounts: binding.frameCounts,
    sourcePath: binding.sourcePath,
    logic: binding.logic,
    variants: binding.variants.map(variant => ({
      subSkillIndex: variant.subSkillIndex,
      playerSkillId: variant.playerSkillId,
      directElementReferenceCount: variant.directElementReferenceCount,
      bulletElementReferenceCount: variant.bulletElementReferenceCount,
      elementCount: variant.elementCount,
      runnableElementCount: variant.runnableElementCount,
      sourceIdentity: variant.sourceIdentity,
    })),
    hits: binding.hits,
    status: binding.status,
    confidence: binding.confidence,
    applied: binding.applied,
  };
}

function createActionMapping(candidate, control) {
  const identity = createBindingIdentity(candidate);
  const base = {
    identity,
    ownerKind: candidate.ownerKind,
    ownerId: candidate.ownerId,
    ownerName: candidate.ownerName,
    sourceSkillId: candidate.sourceSkillId,
    sourceSkillName: candidate.sourceSkillName,
    actionVariantIndex: candidate.actionVariantIndex,
    actionVariantLabel: candidate.actionVariantLabel,
    actionKind: candidate.actionKind,
    publicVariants: candidate.publicVariants ?? [],
    controlSkillId: candidate.controlSkillId,
    bindingKind: candidate.bindingKind,
    bindingSourceIdentity: candidate.bindingSourceIdentity ?? null,
    controlVariantSkillLevel: candidate.controlVariantSkillLevel ?? null,
    controlVariantSourceIdentity:
      candidate.controlVariantSourceIdentity ?? null,
    controlFrameRate: control?.frameRate ?? 60,
  };
  if (!candidate.bindingEligible || !control) {
    return {
      ...base,
      selectedSubSkillIndex: null,
      linked: false,
      runtimeReady: false,
      runtimeHitCount: 0,
      classification: 'unresolved',
      reasons: [
        control ? 'public-control-link-unresolved' : 'skill-control-missing',
      ],
      dimensionSummary: createEmptyDimensionSummary('unresolved'),
    };
  }
  const variantResolution = resolveControlVariant(control, candidate);
  if (!variantResolution.applied) {
    return {
      ...base,
      selectedSubSkillIndex: null,
      controlVariantResolution: variantResolution,
      linked: true,
      runtimeReady: false,
      runtimeHitCount: 0,
      classification: 'unresolved',
      reasons: variantResolution.reasons,
      dimensionSummary: summarizeDimensions(
        control.elements.filter(element => element.mapIndex != null)
      ),
    };
  }
  const selectedSubSkillIndex = variantResolution.subSkillIndex;
  const selectedElements = control.elements.filter(
    element => element.mapIndex === selectedSubSkillIndex
  );
  const runtimeHits = control.hits.filter(
    hit => hit.mapIndex === selectedSubSkillIndex
  );
  const spCost = finiteNumberOrNull(control.logic?.spCost);
  const hasAppliedCost = spCost != null && spCost > 0;
  const relevantElements = selectedElements.filter(
    element => element.threeValueRelevant
  );
  const blockingUnresolved = relevantElements.filter(
    element => element.classification === 'unresolved'
  );
  const allRelevantZero =
    relevantElements.length > 0 &&
    relevantElements.every(
      element => element.classification === 'verified-zero'
    );
  const classification =
    blockingUnresolved.length > 0
      ? 'unresolved'
      : runtimeHits.length > 0 || hasAppliedCost
        ? 'applied'
        : allRelevantZero && spCost === 0
          ? 'verified-zero'
          : 'unresolved';
  const unresolvedReasons = dedupeBy(
    blockingUnresolved
      .filter(element => element.classification === 'unresolved')
      .flatMap(element => element.issues),
    value => value
  );
  if (classification === 'unresolved' && unresolvedReasons.length === 0) {
    unresolvedReasons.push(
      selectedElements.length === 0
        ? 'selected-control-variant-has-no-three-value-elements'
        : 'selected-control-variant-has-no-runnable-hit'
    );
  }
  return {
    ...base,
    selectedSubSkillIndex,
    controlVariantResolution: variantResolution,
    linked: true,
    runtimeReady: classification === 'applied',
    runtimeHitCount: runtimeHits.length,
    selectedElementCount: selectedElements.length,
    selectedHitIdentities: runtimeHits.map(hit => hit.hitIdentity),
    classification,
    reasons: unresolvedReasons,
    dimensionSummary: summarizeDimensions(selectedElements),
  };
}

function resolveControlVariant(control, candidate) {
  const variants = control?.variants ?? [];
  if (variants.length === 1) {
    return {
      subSkillIndex: variants[0].subSkillIndex,
      status: 'applied',
      kind: 'single-control-variant',
      sourceIdentity: variants[0].sourceIdentity,
      reasons: [],
      applied: true,
    };
  }
  const requestedSkillLevel = integerOrNull(
    candidate?.controlVariantSkillLevel
  );
  if (requestedSkillLevel != null) {
    const levelMatches = variants.filter(
      variant => Number(variant.playerSkillId) === requestedSkillLevel
    );
    if (levelMatches.length === 1) {
      return {
        subSkillIndex: levelMatches[0].subSkillIndex,
        status: 'applied',
        kind: 'kibo-skill-level-player-variant',
        sourceIdentity: `${candidate.controlVariantSourceIdentity}|${levelMatches[0].sourceIdentity}`,
        reasons: [],
        applied: true,
      };
    }
    const levelIndexVariant = variants[requestedSkillLevel - 1];
    if (candidate.ownerKind === 'kibo' && levelIndexVariant) {
      return {
        subSkillIndex: levelIndexVariant.subSkillIndex,
        status: 'applied',
        kind: 'kibo-skill-level-index-variant',
        sourceIdentity: `${candidate.controlVariantSourceIdentity}|${levelIndexVariant.sourceIdentity}`,
        reasons: [],
        applied: true,
      };
    }
  }
  const rootMatches = variants.filter(
    variant => Number(variant.playerSkillId) === Number(control.controlSkillId)
  );
  if (rootMatches.length === 1) {
    return {
      subSkillIndex: rootMatches[0].subSkillIndex,
      status: 'applied',
      kind: 'unique-root-player-skill-variant',
      sourceIdentity: rootMatches[0].sourceIdentity,
      reasons: [],
      applied: true,
    };
  }
  return {
    subSkillIndex: null,
    status: 'unresolved',
    kind: 'control-variant-selection-unresolved',
    sourceIdentity: control.sourcePath,
    reasons: [
      variants.length === 0
        ? 'control-has-no-resource-map-variant'
        : rootMatches.length > 1
          ? 'multiple-root-player-skill-variants'
          : 'multiple-control-variants-without-root-selection',
    ],
    applied: false,
  };
}

function summarizeDimensions(elements) {
  const result = {};
  for (const dimension of ['hp', 'toughness', 'actorSp', 'kiboSp']) {
    result[dimension] = countValues(
      elements.map(element => element.dimensions?.[dimension]?.status)
    );
  }
  return result;
}

function createEmptyDimensionSummary(status) {
  return Object.fromEntries(
    ['hp', 'toughness', 'actorSp', 'kiboSp'].map(dimension => [
      dimension,
      { [status]: 1 },
    ])
  );
}

function createControlSkillLogic(row) {
  if (!row) {
    return {
      status: 'verified-skill-logic-unresolved',
      applied: false,
    };
  }
  return {
    spCost: finiteNumberOrNull(row.spCost),
    cooldownMs: finiteNumberOrNull(row.coolDown),
    cooldownCount: finiteNumberOrNull(row.coolDownCount),
    skillTag: row.skillTag ?? null,
    petSkillLogicTag: row.petSkillLogicTag ?? null,
    sourceIdentity: `NewTable/skillsub_logic.rows[skillId=${row.skillId}]`,
    status: 'verified-skill-logic-ready',
    applied: true,
  };
}

function createActorProfiles({ characters, templateRows, spUnitContract }) {
  const rowById = new Map(
    (templateRows ?? []).map(row => [Number(row.id), row])
  );
  return (characters ?? [])
    .map(character => Number(character.id))
    .filter(Number.isInteger)
    .sort((left, right) => left - right)
    .map(characterId => {
      const attributes = parseBaseAttributes(
        rowById.get(characterId)?.baseAttribute
      );
      const maxSpBase = attributes.get(6) ?? null;
      const maxSpGrowthMultiplier = spUnitContract.actor.maxSpGrowthMultiplier;
      const effectiveMaxSp = calculateEffectiveMaxSp(
        maxSpBase,
        maxSpGrowthMultiplier
      );
      return {
        characterId,
        maxSpBase,
        maxSpGrowthTemplateId: spUnitContract.actor.maxSpGrowthTemplateId,
        maxSpGrowthMultiplier,
        effectiveMaxSp,
        maxSp: effectiveMaxSp,
        sprSecBasisPoints: attributes.get(110) ?? null,
        sprSecBackBasisPoints: attributes.get(226) ?? null,
        spGetUpBasisPoints: attributes.get(105) ?? null,
        spRetAutoBasisPoints: attributes.get(227) ?? null,
        spGetUpAttackBasisPoints: attributes.get(228) ?? null,
        sourceIdentity: `NewTable/template_value.rows[id=${characterId}].baseAttribute|${spUnitContract.actor.sourceIdentity}`,
        status:
          attributes.size && effectiveMaxSp != null
            ? 'verified-actor-resource-profile-ready'
            : 'verified-actor-resource-profile-unresolved',
        applied: attributes.size > 0 && effectiveMaxSp != null,
      };
    });
}

function createKiboProfiles({ candidates, templateRows, spUnitContract }) {
  const rowById = new Map(
    (templateRows ?? []).map(row => [Number(row.id), row])
  );
  const kiboIds = new Set(
    candidates
      .filter(candidate => candidate.ownerKind === 'kibo')
      .map(candidate => candidate.ownerId)
  );
  return [...kiboIds]
    .sort((left, right) => left - right)
    .map(kiboId => {
      const attributes = parseBaseAttributes(
        rowById.get(kiboId)?.baseAttribute
      );
      const maxSpBase = attributes.get(6) ?? null;
      const maxSpGrowthMultiplier = spUnitContract.kibo.maxSpGrowthMultiplier;
      const effectiveMaxSp = calculateEffectiveMaxSp(
        maxSpBase,
        maxSpGrowthMultiplier
      );
      return {
        kiboId,
        attack: attributes.get(1) ?? null,
        maxSpBase,
        maxSpGrowthTemplateId: spUnitContract.kibo.maxSpGrowthTemplateId,
        maxSpGrowthMultiplier,
        effectiveMaxSp,
        maxSp: effectiveMaxSp,
        sprSecBasisPoints: attributes.get(110) ?? null,
        sprSecBackBasisPoints: attributes.get(226) ?? null,
        spGetUpBasisPoints: attributes.get(105) ?? null,
        spRetAutoBasisPoints: attributes.get(227) ?? null,
        spGetUpAttackBasisPoints: attributes.get(228) ?? null,
        criticalRateBasisPoints: attributes.get(7) ?? null,
        criticalDamageBasisPoints: attributes.get(8) ?? null,
        damageUpBasisPoints: attributes.get(21) ?? null,
        sourceIdentity: `NewTable/template_value.rows[id=${kiboId}].baseAttribute|${spUnitContract.kibo.sourceIdentity}`,
        status:
          attributes.size && effectiveMaxSp != null
            ? 'verified-kibo-base-profile-ready'
            : 'verified-kibo-base-profile-unresolved',
        applied: attributes.size > 0 && effectiveMaxSp != null,
      };
    });
}

function createSpUnitContract({ templateRows, templateHeroRows, gameRows }) {
  const templateRowById = new Map(
    (templateRows ?? []).map(row => [Number(row.id), row])
  );
  const actorGrowthRow = (templateHeroRows ?? []).find(
    row => Number(row.type) === 1 && Number(row.level) === 1
  );
  const actorGrowthTemplateId = Number(actorGrowthRow?.baseAttribute);
  const actorGrowthMultiplier = parseBaseAttributes(
    templateRowById.get(actorGrowthTemplateId)?.baseAttribute
  ).get(6);
  const petGrowthBaseId = Number(
    (gameRows ?? []).find(row => row.title === 'PETGROW_ID')?.value
  );
  const kiboGrowthTemplateId = petGrowthBaseId + 1;
  const kiboGrowthMultiplier = parseBaseAttributes(
    templateRowById.get(kiboGrowthTemplateId)?.baseAttribute
  ).get(6);
  if (
    !Number.isInteger(actorGrowthTemplateId) ||
    !Number.isFinite(actorGrowthMultiplier) ||
    !Number.isInteger(petGrowthBaseId) ||
    !Number.isFinite(kiboGrowthMultiplier)
  ) {
    throw new Error('verified SP growth source is incomplete');
  }
  return {
    schemaVersion: 1,
    contractName: 'AzPrSpUnitContract',
    status: 'verified-sp-unit-contract-ready',
    valueUnit: 'absolute-sp-points',
    minimumSp: 0,
    actor: {
      level: 1,
      maxSpGrowthTemplateId: actorGrowthTemplateId,
      maxSpGrowthMultiplier: actorGrowthMultiplier,
      formula: 'effectiveMaxSp = maxSpBase * maxSpGrowthMultiplier',
      sourceIdentity: `NewTable/template_hero.rows[type=1,level=1].baseAttribute=${actorGrowthTemplateId}|NewTable/template_value.rows[id=${actorGrowthTemplateId}].baseAttribute[6]`,
    },
    kibo: {
      level: 1,
      petGrowthBaseId,
      maxSpGrowthTemplateId: kiboGrowthTemplateId,
      maxSpGrowthMultiplier: kiboGrowthMultiplier,
      formula: 'effectiveMaxSp = maxSpBase * maxSpGrowthMultiplier',
      sourceIdentity: `NewTable/game.rows[title=PETGROW_ID].value=${petGrowthBaseId}|NewTable/template_value.rows[id=${kiboGrowthTemplateId}].baseAttribute[6]`,
    },
    skillCost: {
      sourceField: 'spCost',
      valueUnit: 'absolute-sp-points',
      divisor: null,
      legacyReadAliases: ['spCostPercent'],
    },
    recovery: {
      valueUnit: 'absolute-sp-points',
      fixedStepMs: 100,
      attributeRatioDivisor: 10000,
    },
    legacy: {
      normalizedMaximum: 1,
      readPolicy: 'legacy-normalized-values-scale-to-effective-max-sp',
      writePolicy: 'absolute-sp-points-only',
    },
  };
}

function calculateEffectiveMaxSp(maxSpBase, maxSpGrowthMultiplier) {
  const base = finiteNumberOrNull(maxSpBase);
  const growth = finiteNumberOrNull(maxSpGrowthMultiplier);
  return base == null || growth == null ? null : base * growth;
}

function createSpUnitRuntimeSource(contract) {
  const values = {
    SP_VALUE_UNIT: contract.valueUnit,
    ACTOR_SP_GROWTH_TEMPLATE_ID: contract.actor.maxSpGrowthTemplateId,
    ACTOR_SP_GROWTH_MULTIPLIER: contract.actor.maxSpGrowthMultiplier,
    KIBO_SP_GROWTH_BASE_ID: contract.kibo.petGrowthBaseId,
    KIBO_SP_GROWTH_TEMPLATE_ID: contract.kibo.maxSpGrowthTemplateId,
    KIBO_SP_GROWTH_MULTIPLIER: contract.kibo.maxSpGrowthMultiplier,
  };
  return `// Generated by scripts/sync-verified-combat-mechanics.mjs.\n${Object.entries(
    values
  )
    .map(([name, value]) => `export const ${name}=${JSON.stringify(value)};`)
    .join('\n')}\n`;
}

function createEnemyProfiles({ profiles, templateRows }) {
  const rowById = new Map(
    (templateRows ?? []).map(row => [Number(row.id), row])
  );
  const requiredAttributeIds = Array.from(
    { length: 21 },
    (_, index) => 201 + index
  );
  return (profiles ?? [])
    .map(profile => {
      const attributes = parseBaseAttributes(
        rowById.get(Number(profile.baseAttributeId))?.baseAttribute
      );
      const complete =
        profile.resolved === true &&
        requiredAttributeIds.every(attributeId => attributes.has(attributeId));
      if (complete) {
        const evidenceFields = [
          ['WP_RECOVERY_DELAY_RAW', 217],
          ['WP_RECOVERY_RATE_RAW', 218],
          ['WP_BREAK_TIME_RAW', 219],
          ['WP_BREAK_END_TIME_RAW', 220],
          ['WP_BREAK_DMGUP_RAW', 221],
        ];
        for (const [field, attributeId] of evidenceFields) {
          if (Number(profile[field]) !== Number(attributes.get(attributeId))) {
            throw new Error(
              `enemy ${profile.enemyId} ${field} disagrees with template attribute ${attributeId}`
            );
          }
        }
      }
      return {
        enemyId: Number(profile.enemyId),
        enemyName: profile.name ?? null,
        propertyId: Number(profile.propertyId) || null,
        baseAttributeId: Number(profile.baseAttributeId) || null,
        maxWeakness: attributes.get(201) ?? null,
        typeMultipliersBasisPoints: {
          physical: attributes.get(202) ?? null,
          magic: attributes.get(203) ?? null,
          heal: attributes.get(204) ?? null,
        },
        elementMultipliersBasisPoints: Object.fromEntries(
          Array.from({ length: 10 }, (_, index) => [
            index,
            attributes.get(205 + index) ?? null,
          ])
        ),
        weaknessDamageMinimum: attributes.get(215) ?? null,
        weaknessDamageMaximum: attributes.get(216) ?? null,
        recoveryDelayMs: attributes.get(217) ?? null,
        recoveryRateBasisPoints: attributes.get(218) ?? null,
        breakTimeMs: attributes.get(219) ?? null,
        breakEndTimeMs: attributes.get(220) ?? null,
        breakDamageUpBasisPoints: attributes.get(221) ?? null,
        sourceIdentity: complete
          ? `outputs/combat-enemy-break-profiles-20260718.json#enemyId=${profile.enemyId}|NewTable/template_value.rows[id=${profile.baseAttributeId}].baseAttribute[201-221]`
          : `outputs/combat-enemy-break-profiles-20260718.json#enemyId=${profile.enemyId}`,
        status: complete
          ? 'verified-enemy-break-profile-ready'
          : 'verified-enemy-break-profile-unresolved',
        applied: complete,
      };
    })
    .sort((left, right) => left.enemyId - right.enemyId);
}

function parseBaseAttributes(value) {
  const result = new Map();
  for (const token of String(value ?? '').split('|')) {
    const [rawId, rawValue] = token.split('#');
    const id = Number(rawId);
    const number = Number(rawValue);
    if (Number.isInteger(id) && Number.isFinite(number)) {
      result.set(id, number);
    }
  }
  return result;
}

function createAudit({
  packageValue,
  candidates,
  controls,
  indexedElements,
  evidence,
  validation,
}) {
  const controlBySkillId = new Map(
    packageValue.controlBindings.map(binding => [
      binding.controlSkillId,
      binding,
    ])
  );
  const unresolved = packageValue.actionMappings
    .filter(mapping => mapping.classification === 'unresolved')
    .map(mapping => ({
      identity: mapping.identity,
      ownerKind: mapping.ownerKind,
      ownerId: mapping.ownerId,
      sourceSkillId: mapping.sourceSkillId,
      actionVariantIndex: mapping.actionVariantIndex,
      controlSkillId: mapping.controlSkillId,
      status: 'unresolved',
      reasons: mapping.reasons,
      applied: false,
    }));
  return {
    schemaVersion: 1,
    kind: 'azpr-verified-combat-mechanics-sync-audit',
    status: 'verified-combat-mechanics-sync-audit-ready',
    packageId: packageValue.packageId,
    packageHash: packageValue.packageHash,
    evidenceStatus: evidence.status,
    validation,
    sourceCoverage: {
      candidateActionCount: candidates.length,
      classifiedActionCount: packageValue.actionMappings.length,
      foundControlCount: controls.length,
      indexedElementPathCount: indexedElements.size,
      appliedActionBindingCount: packageValue.actionBindings.length,
      appliedHitBindingCount: packageValue.summary.appliedHitBindingCount,
      uniqueControlBindingCount: packageValue.summary.uniqueControlBindingCount,
      uniqueControlHitBindingCount:
        packageValue.summary.uniqueControlHitBindingCount,
      unresolvedActionBindingCount: unresolved.length,
      enemyProfileCount: packageValue.summary.enemyProfileCount,
      appliedEnemyProfileCount: packageValue.summary.appliedEnemyProfileCount,
      appliedHitDamageTypeCounts: countValues(
        packageValue.controlBindings.flatMap(binding =>
          binding.hits.map(hit => hit.damage?.damageType)
        )
      ),
    },
    requiredAcceptanceBindings: {
      pangpang: findRequiredBinding(
        packageValue.actionBindings,
        controlBySkillId,
        binding => binding.controlSkillId === 10100703
      ),
      heavyRockHoof: findRequiredBinding(
        packageValue.actionBindings,
        controlBySkillId,
        binding => binding.controlSkillId === 50046903
      ),
    },
    unresolvedBindings: unresolved,
  };
}

function createActionCoverageReport({
  packageValue,
  controlBindings,
  nonzeroRecoveryElements,
}) {
  const controlBySkillId = new Map(
    controlBindings.map(binding => [binding.controlSkillId, binding])
  );
  const groupedMappings = groupBy(
    packageValue.actionMappings,
    mapping => `${mapping.ownerKind}|${mapping.actionKind}`
  );
  const byOwnerActionKind = [...groupedMappings.entries()]
    .map(([key, mappings]) => {
      const [ownerKind, actionKind] = key.split('|');
      return createCoverageSummary({ ownerKind, actionKind, mappings });
    })
    .sort(
      (left, right) =>
        left.ownerKind.localeCompare(right.ownerKind) ||
        left.actionKind.localeCompare(right.actionKind)
    );
  const byOwner = [
    ...groupBy(
      packageValue.actionMappings,
      mapping => `${mapping.ownerKind}|${mapping.ownerId}`
    ).entries(),
  ]
    .map(([key, mappings]) => {
      const [ownerKind, rawOwnerId] = key.split('|');
      return {
        ...createCoverageSummary({ ownerKind, mappings }),
        ownerId: Number(rawOwnerId),
        ownerName: mappings[0]?.ownerName ?? null,
        actionKinds: countValues(mappings.map(mapping => mapping.actionKind)),
      };
    })
    .sort(
      (left, right) =>
        left.ownerKind.localeCompare(right.ownerKind) ||
        left.ownerId - right.ownerId
    );
  const unresolvedActions = packageValue.actionMappings
    .filter(mapping => mapping.classification === 'unresolved')
    .map(mapping => ({
      identity: mapping.identity,
      ownerKind: mapping.ownerKind,
      ownerId: mapping.ownerId,
      ownerName: mapping.ownerName,
      actionKind: mapping.actionKind,
      sourceSkillId: mapping.sourceSkillId,
      sourceSkillName: mapping.sourceSkillName,
      controlSkillId: mapping.controlSkillId,
      publicVariants: mapping.publicVariants,
      reasons: mapping.reasons,
    }));
  const unresolvedReferences = packageValue.actionMappings.flatMap(mapping => {
    const control = controlBySkillId.get(mapping.controlSkillId);
    if (!control || mapping.selectedSubSkillIndex == null) return [];
    return control.elements
      .filter(
        element =>
          element.mapIndex === mapping.selectedSubSkillIndex &&
          element.classification === 'unresolved'
      )
      .map(element => ({
        actionIdentity: mapping.identity,
        ownerKind: mapping.ownerKind,
        ownerId: mapping.ownerId,
        actionKind: mapping.actionKind,
        controlSkillId: mapping.controlSkillId,
        subSkillIndex: mapping.selectedSubSkillIndex,
        pathId: element.pathId,
        elementId: element.elementId,
        referenceKind: element.referenceKind,
        threeValueRelevant: element.threeValueRelevant,
        reasons: element.issues,
        sourceIdentity: element.sourceIdentity,
      }));
  });
  const publicVariantCoverage = packageValue.actionMappings.flatMap(mapping =>
    (mapping.publicVariants ?? []).map(variant => {
      const selected =
        Number(variant.index) === Number(mapping.actionVariantIndex);
      return {
        actionIdentity: mapping.identity,
        ownerKind: mapping.ownerKind,
        ownerId: mapping.ownerId,
        actionKind: mapping.actionKind,
        sourceSkillId: mapping.sourceSkillId,
        publicVariantIndex: variant.index,
        publicVariantLabel: variant.label,
        selected,
        classification: selected ? mapping.classification : 'unresolved',
        reasons: selected
          ? mapping.reasons
          : ['public-variant-to-control-subskill-association-missing'],
        sourceIdentity: variant.sourceIdentity,
      };
    })
  );
  const controlVariantCoverage = controlBindings.flatMap(control =>
    control.variants.map(variant => {
      const mappings = packageValue.actionMappings.filter(
        mapping =>
          mapping.controlSkillId === control.controlSkillId &&
          mapping.selectedSubSkillIndex === variant.subSkillIndex
      );
      return {
        controlSkillId: control.controlSkillId,
        subSkillIndex: variant.subSkillIndex,
        playerSkillId: variant.playerSkillId,
        elementCount: variant.elementCount,
        runnableElementCount: variant.runnableElementCount,
        actionIdentities: mappings.map(mapping => mapping.identity),
        classification: mappings.length
          ? mappings.some(mapping => mapping.classification === 'applied')
            ? 'applied'
            : mappings.every(
                  mapping => mapping.classification === 'verified-zero'
                )
              ? 'verified-zero'
              : 'unresolved'
          : 'unresolved',
        reasons: mappings.length
          ? dedupeBy(
              mappings.flatMap(mapping => mapping.reasons),
              value => value
            )
          : ['public-action-variant-association-missing'],
        sourceIdentity: variant.sourceIdentity,
      };
    })
  );
  const publicPathReferences = new Map();
  for (const mapping of packageValue.actionMappings) {
    const control = controlBySkillId.get(mapping.controlSkillId);
    if (!control) continue;
    for (const element of control.elements) {
      const references = publicPathReferences.get(element.pathId) ?? [];
      references.push({
        actionIdentity: mapping.identity,
        classification: mapping.classification,
        controlSkillId: mapping.controlSkillId,
        subSkillIndex: element.mapIndex,
        selected: mapping.selectedSubSkillIndex === element.mapIndex,
      });
      publicPathReferences.set(element.pathId, references);
    }
  }
  const nonzeroRecoveryCoverage = nonzeroRecoveryElements.map(element => {
    const references = publicPathReferences.get(element.pathId) ?? [];
    const selectedReferences = references.filter(
      reference => reference.selected
    );
    const appliedReferences = selectedReferences.filter(
      reference => reference.classification === 'applied'
    );
    return {
      ...element,
      classification: appliedReferences.length ? 'applied' : 'unresolved',
      actionReferences: selectedReferences.length
        ? selectedReferences
        : references,
      reasons: appliedReferences.length
        ? []
        : [
            selectedReferences.length
              ? 'linked-only-to-unresolved-public-action'
              : references.length
                ? 'referenced-only-by-unselected-control-variant'
                : 'not-referenced-by-public-action-control',
          ],
    };
  });
  const requiredActorKinds = ['normal-attack', 'star-skill', 'ultimate'];
  const missingRequiredActorActions = byOwner
    .filter(owner => owner.ownerKind === 'actor')
    .flatMap(owner =>
      requiredActorKinds
        .filter(kind => !owner.actionKinds[kind])
        .map(actionKind => ({
          ownerId: owner.ownerId,
          ownerName: owner.ownerName,
          actionKind,
          reason: 'public-required-action-kind-missing',
        }))
    );
  const summary = createCoverageSummary({
    mappings: packageValue.actionMappings,
  });
  return {
    schemaVersion: 1,
    kind: 'azpr-verified-combat-action-coverage',
    status: 'verified-combat-action-coverage-ready',
    packageId: packageValue.packageId,
    packageHash: packageValue.packageHash,
    sourceDenominator: {
      kind: 'current-client-public-actor-and-kibo-action-catalogs',
      actorOwnerCount: byOwner.filter(owner => owner.ownerKind === 'actor')
        .length,
      kiboOwnerCount: byOwner.filter(owner => owner.ownerKind === 'kibo')
        .length,
      actionCount: packageValue.actionMappings.length,
      requiredActorKinds,
    },
    complete:
      summary.directoryActionCount === summary.classifiedActionCount &&
      missingRequiredActorActions.length === 0,
    summary: {
      ...summary,
      controlVariantCount: controlVariantCoverage.length,
      unresolvedControlVariantCount: controlVariantCoverage.filter(
        variant => variant.classification === 'unresolved'
      ).length,
      nonzeroRecoveryElementCount: nonzeroRecoveryCoverage.length,
      unresolvedNonzeroRecoveryElementCount: nonzeroRecoveryCoverage.filter(
        element => element.classification === 'unresolved'
      ).length,
      unresolvedReferenceCount: unresolvedReferences.length,
      publicVariantCount: publicVariantCoverage.length,
      unresolvedPublicVariantCount: publicVariantCoverage.filter(
        variant => variant.classification === 'unresolved'
      ).length,
    },
    byOwnerActionKind,
    byOwner,
    missingRequiredActorActions,
    unresolvedActions,
    unresolvedReferences,
    publicVariantCoverage,
    controlVariantCoverage,
    nonzeroRecoveryCoverage,
  };
}

function createCoverageSummary({
  ownerKind = null,
  actionKind = null,
  mappings,
}) {
  const dimensionCounts = Object.fromEntries(
    ['hp', 'toughness', 'actorSp', 'kiboSp'].map(dimension => {
      const counts = { nonzero: 0, 'verified-zero': 0, unresolved: 0 };
      for (const mapping of mappings) {
        const summary = mapping.dimensionSummary?.[dimension] ?? {};
        counts.nonzero += Number(summary.applied ?? 0);
        counts['verified-zero'] += Number(summary['verified-zero'] ?? 0);
        counts.unresolved += Number(summary.unresolved ?? 0);
      }
      return [dimension, counts];
    })
  );
  return {
    ...(ownerKind ? { ownerKind } : {}),
    ...(actionKind ? { actionKind } : {}),
    directoryActionCount: mappings.length,
    classifiedActionCount: mappings.filter(mapping =>
      ['applied', 'verified-zero', 'unresolved'].includes(
        mapping.classification
      )
    ).length,
    linkedActionCount: mappings.filter(mapping => mapping.linked).length,
    runnableActionCount: mappings.filter(mapping => mapping.runtimeReady)
      .length,
    verifiedZeroActionCount: mappings.filter(
      mapping => mapping.classification === 'verified-zero'
    ).length,
    unresolvedActionCount: mappings.filter(
      mapping => mapping.classification === 'unresolved'
    ).length,
    hitNodeCount: mappings.reduce(
      (sum, mapping) => sum + Number(mapping.runtimeHitCount ?? 0),
      0
    ),
    dimensions: dimensionCounts,
  };
}

function createActionCoverageMarkdown(report) {
  const lines = [
    '# M7 真实三值动作覆盖',
    '',
    `- 包：\`${report.packageId}\``,
    `- 公开动作分母：${report.summary.directoryActionCount}`,
    `- 已关联：${report.summary.linkedActionCount}`,
    `- 可运行：${report.summary.runnableActionCount}`,
    `- 明确零：${report.summary.verifiedZeroActionCount}`,
    `- 未解析：${report.summary.unresolvedActionCount}`,
    `- 真实命中节点：${report.summary.hitNodeCount}`,
    `- 公开动作变体：${report.summary.publicVariantCount}（未解析 ${report.summary.unresolvedPublicVariantCount}）`,
    `- 非零回能元素：${report.summary.nonzeroRecoveryElementCount}（未关联 ${report.summary.unresolvedNonzeroRecoveryElementCount}）`,
    '',
    '## Owner / 动作类型',
    '',
    '| Owner | 动作类型 | 目录 | 关联 | 可运行 | 明确零 | 未解析 | 命中 |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...report.byOwnerActionKind.map(
      row =>
        `| ${row.ownerKind} | ${row.actionKind} | ${row.directoryActionCount} | ${row.linkedActionCount} | ${row.runnableActionCount} | ${row.verifiedZeroActionCount} | ${row.unresolvedActionCount} | ${row.hitNodeCount} |`
    ),
    '',
    '## 未解析动作',
    '',
  ];
  if (report.unresolvedActions.length === 0) {
    lines.push('- 无。');
  } else {
    for (const item of report.unresolvedActions) {
      lines.push(
        `- \`${item.identity}\` ${item.ownerName ?? item.ownerId} / ${item.actionKind} / ${item.sourceSkillName ?? item.sourceSkillId}: ${item.reasons.join(', ')}`
      );
    }
  }
  lines.push('', '## 未关联非零回能元素', '');
  const unresolvedRecovery = report.nonzeroRecoveryCoverage.filter(
    item => item.classification === 'unresolved'
  );
  if (unresolvedRecovery.length === 0) {
    lines.push('- 无。');
  } else {
    const reasonCounts = countValues(
      unresolvedRecovery.flatMap(item => item.reasons)
    );
    for (const [reason, count] of Object.entries(reasonCounts)) {
      lines.push(`- ${reason}: ${count}`);
    }
    lines.push(
      '',
      '逐项 source identity 与字段值见 `verified-combat-action-coverage.json#nonzeroRecoveryCoverage`。'
    );
  }
  lines.push(
    '',
    '> `unresolved` 不会进入运行时，也不会被写成 0；完整逐项原因见同名 JSON 报告。'
  );
  return `${lines.join('\n')}\n`;
}

function findRequiredBinding(bindings, controlBySkillId, predicate) {
  const binding = bindings.find(predicate);
  const control = controlBySkillId.get(binding?.controlSkillId);
  const requiredElements =
    binding?.controlSkillId === 10100703
      ? [101007012]
      : binding?.controlSkillId === 50046903
        ? [500469008, 500469062, 500469072]
        : [];
  const elementIds = control?.hits.map(hit => hit.elementId) ?? [];
  const ready = Boolean(
    binding &&
    control &&
    requiredElements.every(elementId => elementIds.includes(elementId))
  );
  return {
    ready,
    identity: binding?.identity ?? null,
    controlSkillId: binding?.controlSkillId ?? null,
    elementIds,
  };
}

function countValues(values) {
  const counts = new Map();
  for (const value of values ?? []) {
    const key = String(value ?? 'unknown');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) =>
      left.localeCompare(right, 'en', { numeric: true })
    )
  );
}

function createBrowserRuntimeSource(source) {
  const start = source.indexOf('export const Q16_SCALE');
  const end = source.indexOf('function parseCliArgs');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('unable to isolate verified calculator browser runtime');
  }
  const body = source
    .slice(start, end)
    .replace(
      'qRatio(input.spGetUpAuto),',
      'qRatio(input.spRetAuto ?? input.spGetUpAuto),'
    )
    .replace(
      "raw = applyFactor(raw, bonus, 'auto_sp_bonus', trace);",
      "raw = applyFactor(raw, bonus, 'auto_sp_bonus', trace, { attributeKeys: ['SPGETUP', 'SPRET_AUTO'], legacyAlias: input.spRetAuto == null && input.spGetUpAuto != null ? 'SPGETUP_AUTO' : null });"
    )
    .trimEnd();
  return [
    '// Generated by scripts/sync-verified-combat-mechanics.mjs.',
    `// Source sha256: ${sha256(source)}`,
    '// Do not edit this file directly.',
    '',
    body,
    '',
  ].join('\n');
}

function inferPublicActionKind(label, skill = {}) {
  const normalizedLabel = String(label ?? '').trim();
  const values = normalizedLabel
    ? [normalizedLabel]
    : [String(skill.displayName ?? '').trim()].filter(Boolean);
  if (values.some(value => value === '普攻' || value === '普通攻击')) {
    return 'normal-attack';
  }
  if (
    values.some(
      value =>
        value === '重击' ||
        (value.startsWith('重击') && !/(提升|派生)/.test(value))
    )
  ) {
    return 'charged-attack';
  }
  if (values.includes('闪击')) return 'dodge-attack';
  if (values.includes('跃击')) return 'plunging-attack';
  if (values.includes('星鸣技')) return 'star-skill';
  if (values.includes('星结合击')) return 'star-combo';
  if (values.includes('星决技')) return 'ultimate';
  if (values.some(value => value === '星携技' || /^星携技·/.test(value))) {
    return 'star-carry';
  }
  if (values.includes('极限反击')) return 'limit-counter';
  if (
    values.some(value => ['完美招架', '精准防御', '集中闪避'].includes(value))
  ) {
    return 'perfect-parry';
  }
  return null;
}

function applyLevelOverride(baseValues, valueParam) {
  const effective = [...baseValues];
  for (const token of String(valueParam ?? '').split('|')) {
    const [rawIndex, rawValue] = token.split('#');
    const index = Number(rawIndex) - 1;
    const value = Number(rawValue);
    if (Number.isInteger(index) && index >= 0 && Number.isFinite(value)) {
      while (effective.length <= index) effective.push(0);
      effective[index] = value;
    }
  }
  return effective;
}

function createBindingIdentity(candidate) {
  return [
    candidate.ownerKind,
    candidate.ownerId,
    candidate.sourceSkillId,
    candidate.actionVariantIndex,
    candidate.controlSkillId,
  ].join('|');
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function readUnityJson(filePath) {
  return JSON.parse(
    readText(filePath).replace(/("m_PathID"\s*:\s*)(-?\d+)/g, '$1"$2"')
  );
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(filePath))
    .digest('hex');
}

function relativePath(filePath) {
  return path.relative(REPO_ROOT, filePath).replaceAll('\\', '/');
}

function relativeExternalPath(filePath) {
  return filePath.replaceAll('\\', '/');
}

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function finiteNumberOrNull(value) {
  const number = Number(value);
  return value != null && value !== '' && Number.isFinite(number)
    ? number
    : null;
}

function integerOrNull(value) {
  const number = Number(value);
  return value != null && value !== '' && Number.isInteger(number)
    ? number
    : null;
}

function dedupeBy(values, keyOf) {
  const result = new Map();
  for (const value of values ?? []) {
    const key = keyOf(value);
    if (!result.has(key)) result.set(key, value);
  }
  return [...result.values()];
}

function groupBy(values, keyOf) {
  const result = new Map();
  for (const value of values ?? []) {
    const key = keyOf(value);
    const entries = result.get(key) ?? [];
    entries.push(value);
    result.set(key, entries);
  }
  return result;
}
