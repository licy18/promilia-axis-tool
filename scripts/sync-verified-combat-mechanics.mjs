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
const ACTION_TIMING_COVERAGE_JSON_OUTPUT = path.join(
  REPO_ROOT,
  'reports',
  'verified-combat-action-timing-coverage.json'
);
const ACTION_TIMING_COVERAGE_MARKDOWN_OUTPUT = path.join(
  REPO_ROOT,
  'reports',
  'verified-combat-action-timing-coverage.md'
);
const ACTION_VARIANT_RESOURCE_JSON_OUTPUT = path.join(
  REPO_ROOT,
  'reports',
  'verified-action-variant-resource-coverage.json'
);
const ACTION_VARIANT_RESOURCE_MARKDOWN_OUTPUT = path.join(
  REPO_ROOT,
  'reports',
  'verified-action-variant-resource-coverage.md'
);
const EFFECT_COVERAGE_JSON_OUTPUT = path.join(
  REPO_ROOT,
  'reports',
  'verified-combat-effect-coverage.json'
);
const EFFECT_COVERAGE_MARKDOWN_OUTPUT = path.join(
  REPO_ROOT,
  'reports',
  'verified-combat-effect-coverage.md'
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
const MECHANISM_KNOWLEDGE_PATH = path.join(
  AZPR_ROOT,
  'BWiki',
  'data',
  'combat-formula-knowledge.json'
);
const PROPERTY_SOURCES_PATH = path.join(
  OUTPUT_ROOT,
  'combat-property-sources-20260719.json'
);
const SP_RECOVERY_SHARING_PATH = path.join(
  OUTPUT_ROOT,
  'combat-sp-recovery-sharing-20260719.json'
);
const OVERLIMIT_MECHANICS_PATH = path.join(
  OUTPUT_ROOT,
  'combat-overlimit-mechanics-20260718.json'
);
const COEFFICIENT_RANGES_PATH = path.join(
  OUTPUT_ROOT,
  'combat-coefficient-ranges-20260718.json'
);
const ENEMY_BREAK_PROFILES_PATH = path.join(
  OUTPUT_ROOT,
  'combat-enemy-break-profiles-20260718.json'
);
const IL2CPP_DUMP_PATH = path.join(
  OUTPUT_ROOT,
  'il2cpp-tc-catch-20260709',
  'dump.cs'
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
const STATIC_PROPERTY_TABLE_NAMES = Object.freeze([
  'accessory',
  'accessory_main',
  'accessory_set',
  'accessory_sub_parameter',
  'battle_info',
  'hero',
  'hero_favorability_info',
  'pet',
  'pet_attributeinheritance',
  'pet_favorability',
  'pet_hobby',
  'pet_learningtalent',
  'skill',
  'soulessence',
  'soulessence_rank',
  'soulessence_value',
  'talent_rank',
  'talent_rune',
  'unit_property',
]);
const STATIC_PROPERTY_TABLE_PATHS = Object.freeze(
  Object.fromEntries(
    STATIC_PROPERTY_TABLE_NAMES.map(name => [
      name,
      path.join(NEW_TABLE_ROOT, `${name}.json`),
    ])
  )
);
const SUPPORTED_BASE_FUNCTION_IDS = new Set([2, 101]);
const BATTLE_MECHANIC_SCRIPT_PATH_IDS = Object.freeze({
  layerControl: '-7197581663443823049',
  immuneElement: '-6202966891751637497',
  switchSkillIndex: '4215197971971398012',
});
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
  const mechanismEvidence = createMechanismEvidenceManifest();
  const battleTargetTypeContract = createBattleTargetTypeContract();
  const overlimitMechanics = readJson(OVERLIMIT_MECHANICS_PATH);
  const seed = readJson(path.join(GENERATED_ROOT, 'workbench-seed.json'));
  const kiboCatalog = readJson(
    path.join(GENERATED_ROOT, 'workbench-kibo-action-catalog.json')
  );
  const characterCatalog = readJson(CHARACTER_CATALOG_PATH);
  const specialResourceIdentityDiscovery =
    discoverSpecialResourceIdentityHints(characterCatalog);
  const skillLogicRows = readJson(SKILL_LOGIC_PATH).rows;
  const skillLogicById = new Map(
    skillLogicRows.map(row => [Number(row.skillId), row])
  );
  const candidates = createActionCandidates({
    seed,
    kiboCatalog,
    characterCatalog,
    petRows: readJson(PET_PATH).rows,
    skillLogicById,
  });
  const publicControlIds = new Set([
    ...candidates.map(candidate => candidate.controlSkillId),
    ...candidates.flatMap(candidate =>
      (candidate.attackInputControls ?? []).map(
        segment => segment.controlSkillId
      )
    ),
    ...(evidence.samples ?? []).map(sample => Number(sample.skillId)),
  ]);
  const controlIds = new Set([
    ...publicControlIds,
    ...(characterCatalog?.items ?? [])
      .filter(character =>
        specialResourceIdentityDiscovery.ownerIds.has(Number(character.id))
      )
      .flatMap(character =>
        (character.skillSlots ?? [])
          .filter(slot => slot.group !== 'passive')
          .map(slot => Number(slot.skillId))
      ),
  ]);
  const controls = [...controlIds]
    .filter(Number.isInteger)
    .map(skillId => findSkillControl(skillId, battleTargetTypeContract))
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
  const {
    indexedElements,
    indexedElementsById,
    allIndexedElements,
    allIndexedElementsById,
    nonzeroRecoveryElements,
  } = await loadElementIndex(wantedPathIds, wantedElementIds);
  const tuningMechanicsCatalog = createTuningMechanicsCatalog({
    snapshot: overlimitMechanics,
    allIndexedElements,
    allIndexedElementsById,
  });
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
      allIndexedElements,
      allIndexedElementsById,
      formulas,
      overridesBySkillAndElement,
      skillLogicById,
      tuningMechanicsCatalog,
    })
  );
  const publicControlBindings = controlBindings.filter(binding =>
    publicControlIds.has(binding.controlSkillId)
  );
  const supportControlBindings = controlBindings.filter(
    binding => !publicControlIds.has(binding.controlSkillId)
  );
  const specialResourceCatalog = createSpecialResourceCatalog({
    discovery: specialResourceIdentityDiscovery,
    controlBindings,
  });
  const actionVariantGraph = createActionVariantGraph({
    candidates,
    controlBindings,
    specialResourceCatalog,
  });
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
  const staticPropertyTables = Object.fromEntries(
    Object.entries(STATIC_PROPERTY_TABLE_PATHS).map(([name, filePath]) => [
      name,
      readJson(filePath).rows ?? [],
    ])
  );
  const staticPropertyCatalog = createStaticPropertyCatalog({
    tables: staticPropertyTables,
    templateRows,
    templateHeroRows: readJson(TEMPLATE_HERO_PATH).rows,
    publicCharacters: seed?.gameData?.characters ?? [],
    publicKibos: seed?.gameData?.kibos ?? [],
    propertySourceSnapshot: readJson(PROPERTY_SOURCES_PATH),
    spUnitContract,
  });
  const packageValue = createPackage({
    evidence,
    validation,
    mechanismEvidence,
    candidates,
    controlBindings: publicControlBindings,
    supportControlBindings,
    kiboProfiles,
    actorProfiles,
    enemyProfiles,
    spUnitContract,
    staticPropertyCatalog,
    tuningMechanicsCatalog,
    specialResourceCatalog,
    actionVariantGraph,
  });
  const semanticEffectCatalog = createSemanticEffectCatalog({
    controlBindings: publicControlBindings,
    packageValue,
    battleTargetTypeContract,
  });
  const runtimeSource = createBrowserRuntimeSource(readText(CALCULATOR_PATH));
  const audit = createAudit({
    packageValue,
    candidates,
    controls,
    indexedElements,
    evidence,
    validation,
    staticPropertyCatalog,
  });
  const coverage = createActionCoverageReport({
    packageValue,
    controlBindings,
    nonzeroRecoveryElements,
  });
  const timingCoverage = createActionTimingCoverageReport(packageValue);
  const effectCoverage = createEffectCoverageReport(
    packageValue,
    semanticEffectCatalog
  );
  const actionVariantResourceCoverage =
    createActionVariantResourceCoverageReport(packageValue);

  const outputs = [
    [PACKAGE_OUTPUT, `${JSON.stringify(packageValue, null, 2)}\n`],
    [SP_UNIT_CONTRACT_OUTPUT, `${JSON.stringify(spUnitContract, null, 2)}\n`],
    [SP_UNIT_RUNTIME_OUTPUT, createSpUnitRuntimeSource(spUnitContract)],
    [RUNTIME_OUTPUT, runtimeSource],
    [AUDIT_OUTPUT, `${JSON.stringify(audit, null, 2)}\n`],
    [ACTION_COVERAGE_JSON_OUTPUT, `${JSON.stringify(coverage, null, 2)}\n`],
    [ACTION_COVERAGE_MARKDOWN_OUTPUT, createActionCoverageMarkdown(coverage)],
    [
      ACTION_TIMING_COVERAGE_JSON_OUTPUT,
      `${JSON.stringify(timingCoverage, null, 2)}\n`,
    ],
    [
      ACTION_TIMING_COVERAGE_MARKDOWN_OUTPUT,
      createActionTimingCoverageMarkdown(timingCoverage),
    ],
    [
      EFFECT_COVERAGE_JSON_OUTPUT,
      `${JSON.stringify(effectCoverage, null, 2)}\n`,
    ],
    [
      EFFECT_COVERAGE_MARKDOWN_OUTPUT,
      createEffectCoverageMarkdown(effectCoverage),
    ],
    [
      ACTION_VARIANT_RESOURCE_JSON_OUTPUT,
      `${JSON.stringify(actionVariantResourceCoverage, null, 2)}\n`,
    ],
    [
      ACTION_VARIANT_RESOURCE_MARKDOWN_OUTPUT,
      createActionVariantResourceCoverageMarkdown(
        actionVariantResourceCoverage
      ),
    ],
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
        appliedEffectBindingCount:
          packageValue.summary.appliedEffectBindingCount,
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
    MECHANISM_KNOWLEDGE_PATH,
    PROPERTY_SOURCES_PATH,
    SP_RECOVERY_SHARING_PATH,
    OVERLIMIT_MECHANICS_PATH,
    COEFFICIENT_RANGES_PATH,
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
    ...Object.values(STATIC_PROPERTY_TABLE_PATHS),
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

function discoverSpecialResourceIdentityHints(characterCatalog) {
  const publicCharacterById = new Map(
    (characterCatalog?.items ?? []).map(character => [
      Number(character.id),
      character,
    ])
  );
  const source = readText(IL2CPP_DUMP_PATH);
  const hints = [];
  const unresolvedOwners = [];
  const classPattern =
    /public class ModuleChargingSkill(\d+)\s*:[^{]+\{([\s\S]*?)(?=\n\})/g;
  for (const match of source.matchAll(classPattern)) {
    const classOwnerId = Number(match[1]);
    const body = match[2];
    const constants = [
      ...body.matchAll(/private const int\s+([\w]+)\s*=\s*(\d+)\s*;/g),
    ].map(value => ({ field: value[1], value: Number(value[2]) }));
    const ownerConstant = constants.find(value =>
      /hero.*id/i.test(value.field)
    );
    const ownerId = ownerConstant?.value ?? classOwnerId;
    const character = publicCharacterById.get(ownerId);
    if (!character) continue;
    const elementConstants = constants.filter(value =>
      /elementid$/i.test(value.field)
    );
    if (elementConstants.length === 0) {
      unresolvedOwners.push({
        ownerId,
        ownerName: character.name ?? null,
        moduleClass: `ModuleChargingSkill${classOwnerId}`,
        reason: 'charging-module-has-no-static-element-identity',
        sourceIdentity: `${relativeExternalPath(IL2CPP_DUMP_PATH)}#ModuleChargingSkill${classOwnerId}`,
      });
      continue;
    }
    const primary =
      elementConstants.find(value => /acc/i.test(value.field)) ??
      elementConstants.find(value => /burst/i.test(value.field)) ??
      elementConstants[0];
    hints.push({
      ownerId,
      ownerName: character.name ?? null,
      moduleClass: `ModuleChargingSkill${classOwnerId}`,
      primaryElementId: primary.value,
      primaryElementField: primary.field,
      stateElements: elementConstants
        .filter(value => value !== primary)
        .map(value => ({ elementId: value.value, field: value.field })),
      sourceIdentity: `${relativeExternalPath(IL2CPP_DUMP_PATH)}#ModuleChargingSkill${classOwnerId}.${primary.field}`,
    });
  }
  return {
    ownerIds: new Set(hints.map(hint => hint.ownerId)),
    hints,
    unresolvedOwners,
    sourceIdentity: relativeExternalPath(IL2CPP_DUMP_PATH),
  };
}

function createSpecialResourceCatalog({ discovery, controlBindings }) {
  const evidenceSources = new Map();
  const profiles = (discovery?.hints ?? [])
    .map(hint => {
      const primaryAsset = readBattleElementAsset(hint.primaryElementId);
      if (!primaryAsset) {
        return {
          ownerId: hint.ownerId,
          ownerName: hint.ownerName,
          resourceIdentity: `actor:${hint.ownerId}:element:${hint.primaryElementId}`,
          elementId: hint.primaryElementId,
          status: 'unresolved-special-resource-element-asset-missing',
          reasons: ['special-resource-element-asset-missing'],
          applied: false,
        };
      }
      registerEvidenceSource(evidenceSources, primaryAsset);
      const stateElements = hint.stateElements
        .map(state => {
          const asset = readBattleElementAsset(state.elementId);
          if (!asset) return null;
          registerEvidenceSource(evidenceSources, asset);
          return {
            elementId: state.elementId,
            field: state.field,
            pathId: asset.pathId,
            name: asset.tree.elementName ?? asset.tree.m_Name ?? null,
            durationMs: finiteNumberOrNull(
              asset.tree.time ?? asset.tree.duration
            ),
            combineType: integerOrNull(asset.tree.combineType),
            sourceIdentity: asset.sourceIdentity,
          };
        })
        .filter(Boolean);
      const capacity = resolveSpecialResourceCapacity(primaryAsset.tree);
      const applied = Number.isFinite(capacity) && capacity > 0;
      return {
        ownerId: hint.ownerId,
        ownerName: hint.ownerName,
        resourceIdentity: `actor:${hint.ownerId}:element:${hint.primaryElementId}`,
        elementId: hint.primaryElementId,
        pathId: primaryAsset.pathId,
        name: resolveSpecialResourceDisplayName(primaryAsset.tree),
        sourceName: primaryAsset.tree.elementName ?? primaryAsset.tree.m_Name,
        capacity: applied ? capacity : null,
        initialValue: 0,
        initialValueStatus: 'verified-scenario-initial-element-layer-zero',
        initialValueSourceIdentity:
          'AzPrVerifiedSpecialResourceRuntime#empty-runtime-element-state',
        combineType: integerOrNull(primaryAsset.tree.combineType),
        stateElements,
        moduleClass: hint.moduleClass,
        sourceIdentity: [hint.sourceIdentity, primaryAsset.sourceIdentity].join(
          '|'
        ),
        status: applied
          ? 'verified-special-resource-profile-ready'
          : 'unresolved-special-resource-capacity',
        reasons: applied ? [] : ['special-resource-capacity-unresolved'],
        applied,
      };
    })
    .sort((left, right) => left.ownerId - right.ownerId);
  const operationBindings = createSpecialResourceOperationBindings({
    profiles: profiles.filter(profile => profile.applied),
    controlBindings,
  });
  const unresolvedOwners = [
    ...(discovery?.unresolvedOwners ?? []),
    ...profiles
      .filter(profile => !profile.applied)
      .map(profile => ({
        ownerId: profile.ownerId,
        ownerName: profile.ownerName,
        reason: profile.reasons?.[0] ?? profile.status,
        sourceIdentity: profile.sourceIdentity ?? null,
      })),
  ];
  return {
    schemaVersion: 1,
    kind: 'azpr-verified-special-resource-catalog',
    status: 'verified-special-resource-catalog-ready',
    profiles,
    operationBindings,
    unresolvedOwners,
    evidenceSources: [...evidenceSources.values()].sort((left, right) =>
      left.id.localeCompare(right.id)
    ),
    summary: {
      profileCount: profiles.length,
      appliedProfileCount: profiles.filter(profile => profile.applied).length,
      operationCount: operationBindings.length,
      appliedOperationCount: operationBindings.filter(
        operation => operation.applied
      ).length,
      unresolvedOperationCount: operationBindings.filter(
        operation => !operation.applied
      ).length,
      unresolvedOwnerCount: unresolvedOwners.length,
    },
  };
}

function readBattleElementAsset(elementId) {
  const directory = path.join(
    BATTLE_ROOT,
    'Element',
    `ast_${elementId}.asset`,
    'MonoBehaviour'
  );
  if (!fs.existsSync(directory)) return null;
  const candidates = fs
    .readdirSync(directory)
    .filter(fileName => fileName.endsWith('.json'))
    .map(fileName => {
      const filePath = path.join(directory, fileName);
      return { filePath, tree: readJson(filePath) };
    })
    .filter(candidate => Number(candidate.tree.elementConfigId) === elementId);
  if (candidates.length !== 1) return null;
  const { filePath, tree } = candidates[0];
  const pathId = path.basename(filePath, '.json').split('__').at(-1);
  return {
    elementId,
    pathId,
    filePath,
    tree,
    sourceIdentity: `${relativeExternalPath(filePath)}#elementConfigId=${elementId}`,
    sha256: sha256File(filePath),
    bytes: fs.statSync(filePath).size,
  };
}

function registerEvidenceSource(target, asset) {
  target.set(asset.filePath, {
    id: `special-resource-element-${asset.elementId}`,
    sourceIdentity: relativeExternalPath(asset.filePath),
    sha256: asset.sha256,
    bytes: asset.bytes,
  });
}

function resolveSpecialResourceCapacity(tree = {}) {
  const combineType = Number(tree.combineType);
  const combineNumber = Number(tree.combineNumber);
  if (
    combineType === 4 &&
    Number.isFinite(combineNumber) &&
    combineNumber > 0
  ) {
    return combineNumber;
  }
  if (combineType === 5) return 1;
  return null;
}

function resolveSpecialResourceDisplayName(tree = {}) {
  const description = String(tree.describe ?? '').trim();
  const countedObject = description.match(/^\d+\s*发(.+)$/)?.[1]?.trim();
  if (countedObject) return countedObject;
  return String(tree.elementName ?? tree.m_Name ?? '角色资源')
    .replace(/^buff资源\s*/i, '')
    .replace(/\s+pre_[\w_]+$/i, '')
    .replace(/buff$/i, '')
    .trim();
}

function createSpecialResourceOperationBindings({ profiles, controlBindings }) {
  const profileByOwnerId = new Map(
    profiles.map(profile => [profile.ownerId, profile])
  );
  const bindings = [];
  for (const control of controlBindings ?? []) {
    const ownerId = resolveControlOwnerId(
      control.controlSkillId,
      profileByOwnerId.keys()
    );
    const profile = profileByOwnerId.get(ownerId);
    if (!profile) continue;
    const stateByPathId = new Map(
      profile.stateElements.map(state => [String(state.pathId), state])
    );
    for (const root of control.effectGraph ?? []) {
      const triggers = createSemanticRootTriggerContracts(control, root);
      const nodeByIdentity = new Map(
        root.nodes.map(node => [node.nodeIdentity, node])
      );
      for (const node of root.nodes) {
        const mechanic = node.mechanic;
        const targetPaths = new Set(
          (mechanic?.targetPathIds ?? []).map(String)
        );
        if (targetPaths.has(String(profile.pathId))) {
          if (mechanic.kind === 'layer-control') {
            appendSpecialResourceOperationBindings(bindings, {
              profile,
              control,
              root,
              node,
              triggers,
              operation: 'gain',
              amountByLevel: node.formula?.valueByLevel ?? {},
              requiredValue: null,
            });
          } else if (
            mechanic.kind === 'immune-element' &&
            mechanic.immuneType === 1
          ) {
            appendSpecialResourceOperationBindings(bindings, {
              profile,
              control,
              root,
              node,
              triggers,
              operation: mechanic.immuneLayerType === 0 ? 'consume' : 'clear',
              amountByLevel: null,
              requiredValue: mechanic.immuneLayerType === 0 ? 1 : 0,
            });
          }
        }
        for (const [statePathId, state] of stateByPathId) {
          if (
            targetPaths.has(statePathId) &&
            mechanic?.kind === 'immune-element' &&
            mechanic.immuneType === 1
          ) {
            appendSpecialResourceOperationBindings(bindings, {
              profile,
              control,
              root,
              node,
              triggers,
              operation: 'transform-remove',
              state,
              amountByLevel: null,
              requiredValue: 0,
            });
          }
        }
      }
      const rootNode = nodeByIdentity.get(`element:${root.rootPathId}`);
      if (rootNode && String(root.rootPathId) === String(profile.pathId)) {
        appendSpecialResourceOperationBindings(bindings, {
          profile,
          control,
          root,
          node: rootNode,
          triggers,
          operation: 'gain',
          amountByLevel: { 1: 1 },
          requiredValue: null,
        });
      }
      const state = stateByPathId.get(String(root.rootPathId));
      if (rootNode && state) {
        appendSpecialResourceOperationBindings(bindings, {
          profile,
          control,
          root,
          node: rootNode,
          triggers,
          operation: 'transform',
          state,
          amountByLevel: { 1: 1 },
          requiredValue: null,
        });
      }
    }
  }
  return dedupeBy(bindings, binding => binding.operationIdentity).sort(
    (left, right) =>
      left.ownerId - right.ownerId ||
      left.controlSkillId - right.controlSkillId ||
      left.subSkillIndex - right.subSkillIndex ||
      (left.triggerFrame ?? Number.MAX_SAFE_INTEGER) -
        (right.triggerFrame ?? Number.MAX_SAFE_INTEGER) ||
      left.operationIdentity.localeCompare(right.operationIdentity)
  );
}

function appendSpecialResourceOperationBindings(
  target,
  {
    profile,
    control,
    root,
    node,
    triggers,
    operation,
    state = null,
    amountByLevel,
    requiredValue,
  }
) {
  for (const trigger of triggers) {
    const applied =
      trigger.resolution === 'static-resolved' &&
      Number.isInteger(trigger.startFrame) &&
      (operation !== 'gain' ||
        Object.values(amountByLevel ?? {}).some(value =>
          Number.isFinite(value)
        ));
    const operationIdentity = [
      profile.resourceIdentity,
      control.controlSkillId,
      root.mapIndex,
      node.pathId,
      operation,
      state?.elementId ?? '',
      trigger.startFrame ?? 'missing',
    ].join('|');
    target.push({
      operationIdentity,
      ownerId: profile.ownerId,
      resourceIdentity: profile.resourceIdentity,
      controlSkillId: control.controlSkillId,
      subSkillIndex: root.mapIndex,
      operation,
      amountByLevel,
      requiredValue,
      stateElementId: state?.elementId ?? null,
      stateName: state?.name ?? null,
      stateDurationMs: state?.durationMs ?? null,
      triggerFrame: Number.isInteger(trigger.startFrame)
        ? trigger.startFrame
        : null,
      frameRate: control.frameRate ?? 60,
      behaviorPathId: trigger.behaviorPathId,
      sourceElementId: node.elementId,
      sourcePathId: node.pathId,
      sourceIdentity: [
        root.sourceIdentity,
        node.sourceIdentity,
        node.mechanic?.sourceIdentity,
        trigger.sourceIdentity,
      ]
        .filter(Boolean)
        .join('|'),
      status: applied
        ? 'verified-special-resource-operation-ready'
        : 'unresolved-special-resource-operation',
      reasons: applied ? [] : trigger.reasons,
      applied,
    });
  }
}

function resolveControlOwnerId(controlSkillId, ownerIds) {
  const control = String(controlSkillId ?? '');
  const matches = [...ownerIds].filter(ownerId =>
    control.startsWith(String(ownerId))
  );
  return matches.length === 1 ? matches[0] : null;
}

function createActionVariantGraph({
  candidates,
  controlBindings,
  specialResourceCatalog,
}) {
  const profiles = specialResourceCatalog.profiles.filter(
    profile => profile.applied
  );
  const ownerIds = profiles.map(profile => profile.ownerId);
  const profileByOwnerId = new Map(
    profiles.map(profile => [profile.ownerId, profile])
  );
  const controlBySkillId = new Map(
    controlBindings.map(control => [control.controlSkillId, control])
  );
  const actionKindsByControl = new Map();
  const publicActionsByControl = new Map();
  for (const candidate of candidates ?? []) {
    if (!ownerIds.includes(candidate.ownerId)) continue;
    appendMapArray(
      actionKindsByControl,
      candidate.controlSkillId,
      candidate.actionKind
    );
    appendMapArray(publicActionsByControl, candidate.controlSkillId, {
      ownerId: candidate.ownerId,
      sourceSkillId: candidate.sourceSkillId,
      actionKind: candidate.actionKind,
      actionVariantIndex: candidate.actionVariantIndex,
    });
    for (const segment of candidate.attackInputControls ?? []) {
      appendMapArray(
        actionKindsByControl,
        segment.controlSkillId,
        'normal-attack'
      );
      appendMapArray(publicActionsByControl, segment.controlSkillId, {
        ownerId: candidate.ownerId,
        sourceSkillId: candidate.sourceSkillId,
        actionKind: 'normal-attack',
        actionVariantIndex: candidate.actionVariantIndex,
        attackSequenceIndex: segment.sequenceIndex,
      });
    }
  }
  const nodes = [];
  const defaultSelections = [];
  for (const control of controlBindings) {
    const ownerId = resolveControlOwnerId(control.controlSkillId, ownerIds);
    if (!profileByOwnerId.has(ownerId)) continue;
    for (const variant of control.variants ?? []) {
      nodes.push({
        nodeIdentity: createActionVariantNodeIdentity(
          ownerId,
          control.controlSkillId,
          variant.subSkillIndex
        ),
        ownerId,
        controlSkillId: control.controlSkillId,
        subSkillIndex: variant.subSkillIndex,
        playerSkillId: variant.playerSkillId,
        actionKinds: dedupeBy(
          actionKindsByControl.get(control.controlSkillId) ?? [],
          value => value
        ),
        publicActions: dedupeBy(
          publicActionsByControl.get(control.controlSkillId) ?? [],
          value => JSON.stringify(value)
        ),
        frameCounts: variant.frameCounts,
        sourceIdentity: variant.sourceIdentity,
        status: 'verified-action-variant-node-ready',
      });
    }
    const defaultVariant = (control.variants ?? []).find(
      variant => variant.subSkillIndex === 0
    );
    if (defaultVariant) {
      defaultSelections.push({
        ownerId,
        controlSkillId: control.controlSkillId,
        subSkillIndex: 0,
        decisionFrame: 0,
        sourceIdentity: `${defaultVariant.sourceIdentity}|client-skill-sub-index-default=0`,
        status: 'verified-default-subskill-selection-ready',
        applied: true,
      });
    }
  }
  const nodeIdentities = new Set(nodes.map(node => node.nodeIdentity));
  const switchBindings = [];
  for (const control of controlBindings) {
    const ownerId = resolveControlOwnerId(control.controlSkillId, ownerIds);
    const profile = profileByOwnerId.get(ownerId);
    if (!profile) continue;
    const stateByElementId = new Map(
      profile.stateElements.map(state => [state.elementId, state])
    );
    for (const root of control.effectGraph ?? []) {
      const triggers = createSemanticRootTriggerContracts(control, root);
      const rootState = stateByElementId.get(root.rootElementId) ?? null;
      for (const node of root.nodes ?? []) {
        if (node.mechanic?.kind !== 'switch-skill-index') continue;
        const relationPath = resolveEffectGraphRelationPath(
          root,
          node.nodeIdentity
        );
        const isDirectRoot = node.nodeIdentity === `element:${root.rootPathId}`;
        const isStateLifecycleChild =
          Boolean(rootState) &&
          relationPath.length > 0 &&
          relationPath.every(edge =>
            ['injectElementDataList', 'notDelElementDataList'].includes(
              edge.relation
            )
          );
        const relationResolved = isDirectRoot || isStateLifecycleChild;
        const targetControlSkillId = node.mechanic.targetControlSkillId;
        const targetSubSkillIndex = node.mechanic.targetSubSkillIndex;
        const targetIdentity = createActionVariantNodeIdentity(
          ownerId,
          targetControlSkillId,
          targetSubSkillIndex
        );
        const durationMs =
          positiveFiniteNumberOrNull(node.mechanic.durationMs) ??
          positiveFiniteNumberOrNull(rootState?.durationMs);
        const requiredResourceOperation =
          specialResourceCatalog.operationBindings.find(
            operation =>
              operation.ownerId === ownerId &&
              operation.controlSkillId === targetControlSkillId &&
              operation.subSkillIndex === targetSubSkillIndex &&
              operation.operation === 'consume' &&
              operation.applied
          ) ?? null;
        for (const trigger of triggers) {
          const applied =
            trigger.resolution === 'static-resolved' &&
            Number.isInteger(trigger.startFrame) &&
            nodeIdentities.has(targetIdentity) &&
            durationMs != null &&
            relationResolved;
          switchBindings.push({
            edgeIdentity: [
              createActionVariantNodeIdentity(
                ownerId,
                control.controlSkillId,
                root.mapIndex
              ),
              targetIdentity,
              node.pathId,
              trigger.startFrame ?? 'missing',
            ].join('->'),
            ownerId,
            from: createActionVariantNodeIdentity(
              ownerId,
              control.controlSkillId,
              root.mapIndex
            ),
            to: targetIdentity,
            parentIdentity: root.graphIdentity,
            sourceRelationPath: relationPath.map(edge => ({
              relation: edge.relation,
              from: edge.from,
              to: edge.to,
            })),
            relationType: 'input-derived',
            inputCommand:
              (actionKindsByControl.get(targetControlSkillId) ?? [])[0] ??
              'skill-input',
            sourceControlSkillId: control.controlSkillId,
            sourceSubSkillIndex: root.mapIndex,
            targetControlSkillId,
            targetSubSkillIndex,
            skillSlot: node.mechanic.skillSlot,
            sourceElementId: node.elementId,
            sourcePathId: node.pathId,
            activationFrame: Number.isInteger(trigger.startFrame)
              ? trigger.startFrame
              : null,
            decisionFrame: 0,
            durationMs,
            condition: rootState
              ? {
                  kind: 'resource-state-active',
                  resourceIdentity: profile.resourceIdentity,
                  stateElementId: rootState.elementId,
                  stateName: rootState.name,
                  sourceIdentity: rootState.sourceIdentity,
                }
              : requiredResourceOperation
                ? {
                    kind: 'resource-at-least',
                    resourceIdentity: profile.resourceIdentity,
                    value: requiredResourceOperation.requiredValue,
                    sourceIdentity: requiredResourceOperation.sourceIdentity,
                  }
                : null,
            sourceIdentity: [
              root.sourceIdentity,
              node.sourceIdentity,
              node.mechanic.sourceIdentity,
              trigger.sourceIdentity,
            ]
              .filter(Boolean)
              .join('|'),
            status: applied
              ? 'verified-action-variant-edge-ready'
              : 'unresolved-action-variant-edge',
            reasons: applied
              ? []
              : dedupeBy(
                  [
                    ...trigger.reasons,
                    ...(nodeIdentities.has(targetIdentity)
                      ? []
                      : ['switch-target-control-variant-missing']),
                    ...(durationMs == null
                      ? ['switch-duration-unresolved']
                      : []),
                    ...(relationResolved
                      ? []
                      : ['switch-wrapper-relation-unresolved']),
                  ],
                  value => value
                ),
            applied,
          });
        }
      }
    }
  }
  const dedupedSwitchBindings = dedupeBy(
    switchBindings,
    binding => binding.edgeIdentity
  ).sort(
    (left, right) =>
      left.ownerId - right.ownerId ||
      left.sourceControlSkillId - right.sourceControlSkillId ||
      (left.activationFrame ?? Number.MAX_SAFE_INTEGER) -
        (right.activationFrame ?? Number.MAX_SAFE_INTEGER) ||
      left.edgeIdentity.localeCompare(right.edgeIdentity)
  );
  return {
    schemaVersion: 1,
    kind: 'azpr-verified-action-variant-graph',
    status: 'verified-action-variant-graph-ready',
    nodes,
    edges: dedupedSwitchBindings,
    defaultSelections,
    policy: {
      inputDerivedVariantsAreIndependentInputs: true,
      sameInputStateTransformSelectsOneVariant: true,
      automaticFollowUpsRequireExplicitBattleEvidence: true,
      descriptionsDoNotSelectVariants: true,
    },
    summary: {
      ownerCount: new Set(nodes.map(node => node.ownerId)).size,
      nodeCount: nodes.length,
      edgeCount: dedupedSwitchBindings.length,
      appliedEdgeCount: dedupedSwitchBindings.filter(edge => edge.applied)
        .length,
      unresolvedEdgeCount: dedupedSwitchBindings.filter(edge => !edge.applied)
        .length,
      resourceConditionEdgeCount: dedupedSwitchBindings.filter(
        edge => edge.condition?.resourceIdentity
      ).length,
      automaticEdgeCount: dedupedSwitchBindings.filter(
        edge => edge.relationType === 'automatic'
      ).length,
    },
  };
}

function createActionVariantNodeIdentity(
  ownerId,
  controlSkillId,
  subSkillIndex
) {
  return `actor:${ownerId}|control:${controlSkillId}|sub:${subSkillIndex}`;
}

function positiveFiniteNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function createActionCandidates({
  seed,
  kiboCatalog,
  characterCatalog,
  petRows,
  skillLogicById,
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
      const attackInputControls =
        variant.actionKind === 'normal-attack'
          ? resolveActorAttackInputControls(character, variant, skillLogicById)
          : [];
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
        ...(attackInputControls.length ? { attackInputControls } : {}),
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

function resolveActorAttackInputControls(character, variant, skillLogicById) {
  const ownerPrefix = String(character?.id ?? '');
  const availableControlIds = new Set([
    Number(variant?.skill?.id),
    ...(character?.skillSlots ?? [])
      .filter(slot => slot.group === 'backup')
      .map(slot => Number(slot.skillId)),
  ]);
  const controls = [];
  for (let sequenceIndex = 1; sequenceIndex <= 9; sequenceIndex += 1) {
    const controlSkillId = Number(
      `${ownerPrefix}${String(sequenceIndex).padStart(2, '0')}`
    );
    const logic = skillLogicById?.get(controlSkillId);
    const controlDirectory = path.join(
      BATTLE_ROOT,
      'SkillList',
      `skill_control_${controlSkillId}.asset`,
      'MonoBehaviour'
    );
    if (
      !availableControlIds.has(controlSkillId) ||
      String(logic?.skillTag ?? '') !== '1' ||
      !fs.existsSync(controlDirectory)
    ) {
      break;
    }
    controls.push({
      sequenceIndex,
      controlSkillId,
      sourceIdentity:
        sequenceIndex === 1
          ? `workbench-seed.gameData.skills[id=${variant.skill.id}]|NewTable/skillsub_logic.rows[skillId=${controlSkillId}].skillTag`
          : `characters.items[id=${character.id}].skillSlots[group=backup,skillId=${controlSkillId}]|NewTable/skillsub_logic.rows[skillId=${controlSkillId}].skillTag`,
    });
  }
  return controls.map(control => ({
    ...control,
    sequenceTotal: controls.length,
  }));
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

function findSkillControl(skillId, battleTargetTypeContract) {
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
        playerEventBridges: collectSkillPlayerEventBridges(directory, value),
        behaviorTriggers: collectBehaviorTriggers(
          directory,
          filePath,
          elementRefs
        ),
        semanticBehaviorTriggers: collectSemanticBehaviorTriggers(
          directory,
          filePath,
          elementRefs,
          battleTargetTypeContract
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

function collectSkillPlayerEventBridges(directory, skillControl) {
  const objectFiles = createUnityObjectFileIndex(directory);
  return (skillControl.skillControlData?.skillPlayers ?? []).map(
    (player, subSkillIndex) =>
      (player.skillTrackDatas ?? []).flatMap((trackRef, trackIndex) => {
        const track = readReferencedUnityObject(objectFiles, trackRef);
        return (track?.value?.behaviorlineControl ?? []).flatMap(
          (behaviorLine, behaviorLineIndex) =>
            (behaviorLine.behaviorList ?? []).flatMap(behaviorRef => {
              const behavior = readReferencedUnityObject(
                objectFiles,
                behaviorRef
              );
              if (!behavior || !isEventBridgeBehavior(behavior.value))
                return [];
              const startFrame = integerOrNull(behavior.value.startFrame);
              const frameCount = integerOrNull(behavior.value.frameCount);
              if (
                startFrame == null ||
                startFrame < 0 ||
                frameCount == null ||
                frameCount <= 0
              ) {
                return [];
              }
              return [
                {
                  subSkillIndex,
                  trackIndex,
                  behaviorLineIndex,
                  behaviorLineName:
                    String(
                      behaviorLine.name ?? behaviorLine.trackName ?? ''
                    ).trim() || null,
                  trackPathId: track?.pathId ?? null,
                  behaviorPathId: behavior.pathId,
                  startFrame,
                  frameCount,
                  endFrame: startFrame + frameCount,
                  allowAttack:
                    behavior.value.allowAttack === true ||
                    Number(behavior.value.allowAttack) === 1,
                  bridgeType: integerOrNull(behavior.value.bridge),
                  continuousAttackType: integerOrNull(behavior.value.type),
                  targetSkillId: integerOrNull(behavior.value.skillId),
                  skillIndex: integerOrNull(behavior.value.skillIndex),
                  frameIndex: integerOrNull(behavior.value.frameIndex),
                  baseOnInput:
                    behavior.value.baseOnInput === true ||
                    Number(behavior.value.baseOnInput) === 1,
                  inputToIndex:
                    behavior.value.inputToIndex === true ||
                    Number(behavior.value.inputToIndex) === 1,
                  sourceIdentity: `${relativeExternalPath(track.filePath)}#behaviorlineControl[${behaviorLineIndex}].behaviorList[pathId=${behavior.pathId}]|${relativeExternalPath(behavior.filePath)}`,
                },
              ];
            })
        );
      })
  );
}

function createUnityObjectFileIndex(directory) {
  const result = new Map();
  for (const name of fs.readdirSync(directory)) {
    if (!name.endsWith('.json')) continue;
    const match = name.match(/__(-?\d+)\.json$/);
    if (!match) continue;
    const pathId = match[1];
    const filePath = path.join(directory, name);
    const score = name.startsWith('MonoBehaviour_') ? 2 : 1;
    const current = result.get(pathId);
    if (!current || score > current.score) {
      result.set(pathId, { filePath, score });
    }
  }
  return result;
}

function readReferencedUnityObject(objectFiles, reference) {
  const pathId = String(reference?.m_PathID ?? '');
  const indexed = objectFiles.get(pathId);
  if (!indexed) return null;
  return {
    pathId,
    filePath: indexed.filePath,
    value: readUnityJson(indexed.filePath),
  };
}

function isEventBridgeBehavior(value) {
  return (
    value &&
    typeof value === 'object' &&
    Object.hasOwn(value, 'allowAttack') &&
    Object.hasOwn(value, 'bridge') &&
    Object.hasOwn(value, 'type') &&
    Object.hasOwn(value, 'skillId')
  );
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
      const target = resolveBehaviorElementTarget(value, pathId);
      triggers.get(pathId).push({
        behaviorPathId: path.basename(name, '.json').split('__').at(-1),
        startFrame: integerOrNull(value.startFrame),
        frameCount: integerOrNull(value.frameCount),
        behaviorIndex: integerOrNull(value.behaviorIndex),
        timelineGroupIndex: integerOrNull(value.timelineGroupIndex),
        targetCode: target.code,
        targetKind: target.kind,
        targetSourceField: target.sourceField,
        sourceIdentity: `${relativeExternalPath(filePath)}#startFrame|${target.sourceField ?? 'target-unresolved'}`,
      });
    }
  }
  return triggers;
}

function resolveBehaviorElementTarget(value, pathId) {
  if (
    arrayContainsPathId(value?.toOwnElementDatas, pathId) ||
    arrayContainsPathId(value?.toOwnElements, pathId)
  ) {
    return {
      code: 4,
      kind: 'source-owner',
      sourceField: 'toOwnElementDatas',
    };
  }
  if (arrayContainsPathId(value?.elementDataList, pathId)) {
    return createBehaviorTarget(
      integerOrNull(value.directInjectTargetType),
      'directInjectTargetType'
    );
  }
  if (arrayContainsPathId(value?.elementIdDatas, pathId)) {
    return createBehaviorTarget(integerOrNull(value.targetType), 'targetType');
  }
  return {
    code: null,
    kind: 'unresolved',
    sourceField: null,
  };
}

function createBehaviorTarget(code, sourceField) {
  return {
    code,
    kind:
      code === 1
        ? 'enemy'
        : code === 4
          ? 'source-owner'
          : code === 2
            ? 'ally-unresolved'
            : code === 3
              ? 'any-unresolved'
              : 'unresolved',
    sourceField,
  };
}

function createBattleTargetTypeContract() {
  const source = readText(IL2CPP_DUMP_PATH);
  const enumNames = [
    'EDirectInjectTargetType',
    'ETargetType',
    'EElementTriggerTargetType',
    'ETriggerEffectTargetType',
  ];
  const enums = Object.fromEntries(
    enumNames.map(enumName => [enumName, parseIl2CppEnum(source, enumName)])
  );
  assertEnumMember(enums.EDirectInjectTargetType, 'Self', 0);
  assertEnumMember(enums.EDirectInjectTargetType, 'ControllingHero', 1);
  assertEnumMember(enums.ETargetType, 'Enemy', 1);
  assertEnumMember(enums.ETargetType, 'Self', 4);
  return {
    schemaVersion: 1,
    kind: 'azpr-battle-target-type-contract',
    status: 'verified-battle-target-type-contract-ready',
    clientBuild: 'il2cpp-tc-catch-20260709',
    sourceIdentity: `${relativeExternalPath(IL2CPP_DUMP_PATH)}#EDirectInjectTargetType|ETargetType|EElementTriggerTargetType|ETriggerEffectTargetType`,
    sourceSha256: sha256File(IL2CPP_DUMP_PATH),
    enums,
  };
}

function parseIl2CppEnum(source, enumName) {
  const marker = `public enum ${enumName}`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`missing IL2CPP enum ${enumName}`);
  const bodyStart = source.indexOf('{', start);
  const bodyEnd = source.indexOf('\n}', bodyStart);
  if (bodyStart < 0 || bodyEnd < 0) {
    throw new Error(`invalid IL2CPP enum ${enumName}`);
  }
  const members = {};
  const expression = new RegExp(
    `public const ${enumName}\\s+([A-Za-z0-9_]+)\\s*=\\s*(-?\\d+);`,
    'g'
  );
  for (const match of source.slice(bodyStart, bodyEnd).matchAll(expression)) {
    members[match[1]] = Number(match[2]);
  }
  if (Object.keys(members).length === 0) {
    throw new Error(`empty IL2CPP enum ${enumName}`);
  }
  return {
    sourceIdentity: `${relativeExternalPath(IL2CPP_DUMP_PATH)}#${enumName}`,
    members,
  };
}

function assertEnumMember(definition, member, expectedValue) {
  if (definition?.members?.[member] !== expectedValue) {
    throw new Error(
      `IL2CPP enum drift: ${member} expected ${expectedValue}, received ${definition?.members?.[member]}`
    );
  }
}

function collectSemanticBehaviorTriggers(
  directory,
  mainFilePath,
  elementRefs,
  battleTargetTypeContract
) {
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
      const target = resolveSemanticBehaviorElementTarget(
        value,
        pathId,
        battleTargetTypeContract
      );
      triggers.get(pathId).push({
        behaviorPathId: path.basename(name, '.json').split('__').at(-1),
        startFrame: integerOrNull(value.startFrame),
        frameCount: integerOrNull(value.frameCount),
        behaviorIndex: integerOrNull(value.behaviorIndex),
        timelineGroupIndex: integerOrNull(value.timelineGroupIndex),
        target: target,
        sourceIdentity: `${relativeExternalPath(filePath)}#startFrame|${target.sourceField ?? 'target-unresolved'}`,
      });
    }
  }
  return new Map(
    [...triggers.entries()].map(([pathId, entries]) => [
      pathId,
      dedupeBy(
        entries,
        entry =>
          `${entry.behaviorPathId}|${entry.startFrame}|${entry.target.sourceField}|${entry.target.code}`
      ),
    ])
  );
}

function resolveSemanticBehaviorElementTarget(
  value,
  pathId,
  battleTargetTypeContract
) {
  for (const field of [
    'toOwnElementDatas',
    'toOwnElements',
    'toOwnElementBaseDatas',
  ]) {
    if (arrayContainsPathId(value?.[field], pathId)) {
      return {
        code: null,
        kind: 'source-owner',
        sourceField: field,
        enumName: null,
        enumMember: 'ExplicitOwnElementList',
        resolution: 'static-resolved',
        runtimeReason: null,
        sourceIdentity: `${relativeExternalPath(IL2CPP_DUMP_PATH)}#IElementSkillBehaviourData`,
      };
    }
  }
  if (arrayContainsPathId(value?.elementDataList, pathId)) {
    return createSemanticBehaviorTarget(
      integerOrNull(value.directInjectTargetType),
      'directInjectTargetType',
      'EDirectInjectTargetType',
      battleTargetTypeContract
    );
  }
  for (const field of ['elementIdDatas', 'elementBaseDatas']) {
    if (arrayContainsPathId(value?.[field], pathId)) {
      return createSemanticBehaviorTarget(
        integerOrNull(value.targetType),
        'targetType',
        'ETargetType',
        battleTargetTypeContract,
        field
      );
    }
  }
  return {
    code: null,
    kind: 'unresolved',
    sourceField: null,
    enumName: null,
    enumMember: null,
    resolution: 'static-evidence-gap',
    runtimeReason: null,
    sourceIdentity: null,
  };
}

function createSemanticBehaviorTarget(
  code,
  sourceField,
  enumName,
  battleTargetTypeContract,
  containerField = sourceField
) {
  const definition = battleTargetTypeContract.enums[enumName];
  const enumMember = Object.entries(definition.members).find(
    ([, value]) => value === code
  )?.[0];
  const classification = classifyBattleTargetMember(enumName, enumMember);
  return {
    code,
    kind: classification.kind,
    sourceField,
    containerField,
    enumName,
    enumMember: enumMember ?? null,
    resolution: enumMember ? classification.resolution : 'static-evidence-gap',
    runtimeReason: enumMember ? classification.runtimeReason : null,
    sourceIdentity: `${definition.sourceIdentity}.${enumMember ?? `unknown-${code}`}`,
  };
}

function classifyBattleTargetMember(enumName, enumMember) {
  if (enumName === 'ETargetType') {
    return (
      {
        Enemy: targetMember('enemy'),
        Ally: targetMember('ally'),
        Any: targetMember(
          'any',
          'runtime-dependent',
          'runtime-target-selection-any'
        ),
        Self: targetMember('source-owner'),
        MonsterGroupConfigPos: targetMember(
          'monster-group-config-position',
          'runtime-dependent',
          'runtime-target-selection-config-position'
        ),
      }[enumMember] ?? targetMember('unresolved', 'static-evidence-gap')
    );
  }
  if (enumName === 'EDirectInjectTargetType') {
    return (
      {
        Self: targetMember('source-owner'),
        ControllingHero: targetMember('controlling-actor'),
        ControllingPet: targetMember('controlling-kibo'),
        AllHero: targetMember('team-actors'),
        AllPet: targetMember('team-kibos'),
        AllyKiBo: targetMember('ally-kibo'),
        EnemyKiBo: targetMember(
          'enemy-kibo',
          'runtime-dependent',
          'runtime-target-selection-enemy-kibo'
        ),
        PetOwner: targetMember('owner-actor'),
        SelfPet: targetMember('owner-kibo'),
        Pet: targetMember(
          'kibo',
          'runtime-dependent',
          'runtime-target-selection-kibo'
        ),
        CurrentMaxHp: targetMember(
          'actor-by-current-max-hp',
          'runtime-dependent',
          'runtime-target-selection-current-max-hp'
        ),
        CurrentMinHp: targetMember(
          'actor-by-current-min-hp',
          'runtime-dependent',
          'runtime-target-selection-current-min-hp'
        ),
        CurrentMaxHpPercent: targetMember(
          'actor-by-current-max-hp-percent',
          'runtime-dependent',
          'runtime-target-selection-current-max-hp-percent'
        ),
        CurrentMinHpPercent: targetMember(
          'actor-by-current-min-hp-percent',
          'runtime-dependent',
          'runtime-target-selection-current-min-hp-percent'
        ),
        ClosetEntity: targetMember(
          'closest-entity',
          'runtime-dependent',
          'runtime-target-selection-closest-entity'
        ),
        Player: targetMember('player'),
        AllyHero: targetMember('ally-actor'),
        AllEntiiesWithoutSelf: targetMember('all-entities-without-self'),
      }[enumMember] ?? targetMember('unresolved', 'static-evidence-gap')
    );
  }
  return targetMember('unresolved', 'static-evidence-gap');
}

function targetMember(
  kind,
  resolution = 'static-resolved',
  runtimeReason = null
) {
  return { kind, resolution, runtimeReason };
}

function arrayContainsPathId(values, pathId) {
  return (values ?? []).some(value => {
    if (value && typeof value === 'object') {
      return String(value.m_PathID ?? '') === pathId;
    }
    return String(value ?? '') === pathId;
  });
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
  const allIndexedElements = new Map();
  const allIndexedElementsById = new Map();
  const nonzeroRecoveryElements = [];
  const input = fs.createReadStream(ELEMENT_INDEX_PATH, { encoding: 'utf8' });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    const record = JSON.parse(
      line.replace(/("(?:path_id|m_PathID)"\s*:\s*)(-?\d+)/g, '$1"$2"')
    );
    const indexed = {
      asset: record.asset ?? null,
      pathId: String(record.path_id),
      name: record.name ?? null,
      typetree: record.typetree ?? null,
    };
    appendMapArray(allIndexedElements, indexed.pathId, indexed);
    const allElementId = integerOrNull(record.typetree?.elementConfigId);
    if (allElementId != null) {
      appendMapArray(allIndexedElementsById, allElementId, indexed);
    }
    if (wantedPathIds.has(indexed.pathId)) {
      appendMapArray(indexedElements, indexed.pathId, indexed);
    }
    const elementId = integerOrNull(record.typetree?.elementConfigId);
    if (wantedElementIds.has(elementId)) {
      appendMapArray(indexedElementsById, elementId, indexed);
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
    allIndexedElements,
    allIndexedElementsById,
    nonzeroRecoveryElements: dedupeBy(
      nonzeroRecoveryElements,
      entry => `${entry.pathId}|${entry.elementId}`
    ),
  };
}

function appendMapArray(map, key, value) {
  const entries = map.get(key) ?? [];
  entries.push(value);
  map.set(key, entries);
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
  allIndexedElements,
  allIndexedElementsById,
  formulas,
  overridesBySkillAndElement,
  skillLogicById,
  tuningMechanicsCatalog,
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
  const effectGraph = createControlEffectGraph({
    control,
    allIndexedElements,
    allIndexedElementsById,
    formulas,
    overridesBySkillAndElement,
    tuningMechanicsCatalog,
  });
  const effects = createControlRuntimeEffects({ effectGraph, control });
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
      eventBridges: control.playerEventBridges?.[mapIndex] ?? [],
      directElementReferenceCount: (resourceMap?.elements ?? []).length,
      bulletElementReferenceCount: (resourceMap?.bulletElements ?? []).length,
      elementCount: variantElements.length,
      runnableElementCount: variantElements.filter(
        element => element.classification === 'applied'
      ).length,
      effectNodeCount: effectGraph
        .filter(root => root.mapIndex === mapIndex)
        .reduce((sum, root) => sum + root.nodes.length, 0),
      runnableEffectCount: effects.filter(
        effect =>
          effect.mapIndex === mapIndex && effect.classification === 'applied'
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
    effectGraph,
    effects,
    semanticBehaviorTriggers: control.semanticBehaviorTriggers,
  };
}

function createControlEffectGraph({
  control,
  allIndexedElements,
  allIndexedElementsById,
  formulas,
  overridesBySkillAndElement,
  tuningMechanicsCatalog,
}) {
  return control.elementRefs.map(ref => {
    const rootResolution = resolveIndexedElementReference({
      reference: ref,
      elementsByPathId: allIndexedElements,
      elementsById: allIndexedElementsById,
    });
    const nodes = [];
    const edges = [];
    const visited = new Set();
    if (rootResolution.record) {
      visit(rootResolution.record, null, null, 0);
    }
    return {
      graphIdentity: [
        control.skillId,
        ref.mapIndex,
        ref.referenceKind,
        ref.elementIndex,
        ref.pathId ?? `element-${ref.elementIdHint}`,
      ].join('|'),
      controlSkillId: control.skillId,
      mapIndex: ref.mapIndex,
      referenceKind: ref.referenceKind,
      elementIndex: ref.elementIndex,
      rootPathId: ref.pathId ?? rootResolution.record?.pathId ?? null,
      rootElementId:
        integerOrNull(rootResolution.record?.typetree?.elementConfigId) ??
        ref.elementIdHint,
      sourceIdentity: `${relativeExternalPath(control.filePath)}#${ref.sourceIdentity}`,
      sourceStatus: rootResolution.status,
      nodes,
      edges,
      appliedNodeCount: nodes.filter(node => node.classification === 'applied')
        .length,
      verifiedZeroNodeCount: nodes.filter(
        node => node.classification === 'verified-zero'
      ).length,
      unresolvedNodeCount: nodes.filter(
        node => node.classification === 'unresolved'
      ).length,
    };

    function visit(record, parentIdentity, relation, depth) {
      const nodeIdentity = `element:${record.pathId}`;
      if (parentIdentity) {
        edges.push({
          from: parentIdentity,
          to: nodeIdentity,
          relation,
          status: 'verified-battle-element-reference-resolved',
        });
      }
      if (visited.has(nodeIdentity) || depth > 12) return;
      visited.add(nodeIdentity);
      const node = createBattleEffectGraphNode({
        record,
        controlSkillId: control.skillId,
        formulas,
        overridesBySkillAndElement,
        depth,
        tuningMechanicsCatalog,
      });
      nodes.push(node);
      for (const childReference of collectBattleElementChildReferences(
        record.typetree
      )) {
        const childResolution = resolveIndexedElementReference({
          reference: childReference,
          elementsByPathId: allIndexedElements,
          elementsById: allIndexedElementsById,
        });
        if (!childResolution.record) {
          edges.push({
            from: nodeIdentity,
            to:
              childReference.pathId ??
              `element:${childReference.elementIdHint ?? 'unresolved'}`,
            relation: childReference.relation,
            status: childResolution.status,
          });
          continue;
        }
        visit(
          childResolution.record,
          nodeIdentity,
          childReference.relation,
          depth + 1
        );
      }
    }
  });
}

function resolveIndexedElementReference({
  reference,
  elementsByPathId,
  elementsById,
}) {
  const candidates = reference.pathId
    ? (elementsByPathId.get(String(reference.pathId)) ?? [])
    : (elementsById.get(Number(reference.elementIdHint)) ?? []);
  const unique = dedupeBy(
    candidates,
    candidate =>
      `${candidate.pathId}|${candidate.typetree?.elementConfigId}|${candidate.typetree?.m_Name ?? ''}`
  );
  return {
    record: unique.length === 1 ? unique[0] : null,
    status:
      unique.length === 1
        ? 'verified-battle-element-source-unique'
        : unique.length > 1
          ? 'battle-element-source-ambiguous'
          : 'battle-element-source-missing',
  };
}

function collectBattleElementChildReferences(tree = {}) {
  const references = [];
  const pathFields = [
    'injectElementDataList',
    'elementDataList',
    'notDelElementDataList',
    'triggerEffectList',
    'zeroEffectList',
    'finishEffectList',
    'additionalHitElementDataList',
    'injectElementDataList_1',
    'injectElementDataList_2',
    'injectElementDataEffects',
    'layerInfoList',
  ];
  for (const field of pathFields) {
    for (const pathId of collectNestedPathIds(tree[field])) {
      references.push({ pathId, elementIdHint: null, relation: field });
    }
  }
  const idFields = ['sustainElement', 'injectElementList', 'notDelElementList'];
  for (const field of idFields) {
    const values = Array.isArray(tree[field]) ? tree[field] : [tree[field]];
    for (const value of values) {
      const elementIdHint = integerOrNull(value);
      if (elementIdHint == null || elementIdHint <= 0) continue;
      references.push({ pathId: null, elementIdHint, relation: field });
    }
  }
  return dedupeBy(
    references,
    reference =>
      `${reference.relation}|${reference.pathId ?? ''}|${reference.elementIdHint ?? ''}`
  );
}

function collectNestedPathIds(value) {
  const result = new Set();
  walk(value);
  return [...result];
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (/^-?\d+$/.test(String(node.m_PathID ?? ''))) {
      result.add(String(node.m_PathID));
      return;
    }
    for (const child of Object.values(node)) walk(child);
  }
}

function createBattleEffectGraphNode({
  record,
  controlSkillId,
  formulas,
  overridesBySkillAndElement,
  depth,
  tuningMechanicsCatalog,
}) {
  const tree = record.typetree ?? {};
  const elementId = integerOrNull(tree.elementConfigId);
  const kind = resolveBattleElementKind(tree);
  const baseValues =
    tree.formulaParams?.formulaParamValues ?? tree.functionParams ?? [];
  const baseFunctionId = integerOrNull(
    tree.formulaParams?.function_2 ?? tree.baseIntParams?.[1]
  );
  const commonFunctionId = integerOrNull(
    tree.formulaParams?.function_1 ?? tree.baseIntParams?.[0]
  );
  const tuningProfile = resolveTuningProfileForBattleElement(
    tuningMechanicsCatalog,
    { kind, elementId }
  );
  const mechanic = createBattleMechanicNodeContract(tree);
  const levelOverrides =
    overridesBySkillAndElement.get(`${controlSkillId}:${elementId}`) ?? [];
  const effectiveParamsByLevel = Object.fromEntries(
    Array.from({ length: 12 }, (_, index) => {
      const level = index + 1;
      const override = levelOverrides.find(row => row.level === level);
      return [level, applyLevelOverride(baseValues, override?.valueParam)];
    })
  );
  const classification = classifyBattleEffectNode({
    tree,
    kind,
    commonFunctionId,
    baseFunctionId,
    valueByLevel: Object.fromEntries(
      Object.entries(effectiveParamsByLevel).map(([level, values]) => [
        level,
        finiteNumberOrNull(values?.[0]),
      ])
    ),
    depth,
    tuningMechanicsCatalog,
  });
  return {
    nodeIdentity: `element:${record.pathId}`,
    pathId: record.pathId,
    elementId,
    name: tree.elementName ?? tree.m_Name ?? record.name ?? null,
    kind,
    depth,
    sourceIdentity: `battle-element-assets.jsonl#path_id=${record.pathId}`,
    sourceScriptPathId: String(tree.m_Script?.m_PathID ?? '') || null,
    mechanic,
    formula: {
      commonFunctionId,
      commonExpression: formulas.get(commonFunctionId) ?? null,
      baseFunctionId,
      baseExpression: formulas.get(baseFunctionId) ?? null,
      valueByLevel: Object.fromEntries(
        Object.entries(effectiveParamsByLevel).map(([level, values]) => [
          level,
          finiteNumberOrNull(values?.[0]),
        ])
      ),
    },
    lifecycle: {
      durationMs: finiteNumberOrNull(tree.time ?? tree.duration),
      combineType: integerOrNull(tree.combineType),
      combineNumber: integerOrNull(tree.combineNumber),
      maxCount: integerOrNull(tree.maxCount),
      mutuallyExclusiveId: integerOrNull(tree.mutuallyExclusiveId),
      isLasting: Number(tree.isLasting) === 1,
      frequencyType: integerOrNull(tree.frequencyType),
      frequency: integerOrNull(tree.frequency),
      tags: (tree.types ?? []).map(Number).filter(Number.isFinite),
    },
    propertyChange:
      kind === 'property-change'
        ? {
            changeType: integerOrNull(tree.changeType),
            attributeId: integerOrNull(tree.attributeID),
            calculateType: integerOrNull(tree.calculateType),
            defaultPropertyTags: (tree.defaultPropertyTags ?? []).map(Number),
            hasConditions:
              (tree.defaultConditions ?? []).length > 0 ||
              (tree.changePeopertyConditionArrayDatas ?? []).length > 0,
          }
        : null,
    directSp:
      kind === 'sp'
        ? {
            recoverType: integerOrNull(tree.recoverType),
            recoverTagType: integerOrNull(tree.recoverTagType),
            shareType: integerOrNull(tree.shareType),
            petShareType: integerOrNull(tree.petShareType),
            mainPetShareType: integerOrNull(tree.mainPetShareType),
            enhanceable: Number(tree.enhanceable) === 1,
          }
        : null,
    damage:
      kind === 'damage'
        ? {
            damageType: integerOrNull(tree.damageType),
            elementalType: integerOrNull(
              tree.damageElementalType ?? tree.elementalType
            ),
          }
        : null,
    shield:
      kind === 'shield'
        ? {
            calculateType: integerOrNull(tree.calculateType),
            shieldParams: (tree.shieldParams ?? []).map(Number),
            teamShield: Number(tree.teamShield) === 1,
          }
        : null,
    tuningMark:
      kind === 'stack' && tuningProfile
        ? createTuningMarkNodeContract(tree, tuningProfile)
        : null,
    tuningOverlimit:
      kind === 'inject' && tuningProfile
        ? {
            profileKey: tuningProfile.key,
            element: tuningProfile.element,
            markId: tuningProfile.markId,
            packetElementId: tuningProfile.overlimitPacket.elementId,
            sourceIdentity: tuningProfile.overlimitPacket.sourceIdentity,
          }
        : null,
    judgment:
      kind === 'judgment'
        ? {
            judgmentType: integerOrNull(tree.judgmentType),
            consume: Number(tree.consume) === 1,
            consumeMode: integerOrNull(tree.consumeMode),
            consumeLayerNum: integerOrNull(tree.consumeLayerNum),
            consumeLayerMaxNum: integerOrNull(tree.consumeLayerMaxNum),
            markElementIds: (tree.elementArr ?? [])
              .map(Number)
              .filter(Number.isInteger),
            canConsume: Number(tree.canConsume) === 1,
            checkTarget: integerOrNull(tree.checkTarget),
            executeTarget: integerOrNull(tree.executeTarget),
            insufficientPathIds: collectNestedPathIds(
              tree.injectElementDataList_1
            ),
            sufficientPathIds: collectNestedPathIds(
              tree.injectElementDataList_2
            ),
            effectPathIds: collectNestedPathIds(tree.injectElementDataEffects),
          }
        : null,
    dimensions: classification.dimensions,
    classification: classification.status,
    reasons: classification.reasons,
    status: `verified-battle-effect-node-${classification.status}`,
    applied: classification.status === 'applied',
  };
}

function createBattleMechanicNodeContract(tree = {}) {
  const sourceScriptPathId = String(tree.m_Script?.m_PathID ?? '');
  if (sourceScriptPathId === BATTLE_MECHANIC_SCRIPT_PATH_IDS.layerControl) {
    return {
      kind: 'layer-control',
      amountByLevelSource: 'formulaParams.formulaParamValues[0]',
      targetPathIds: collectNestedPathIds(tree.injectElementDataList),
      injectType: integerOrNull(tree.injectType),
      status: 'verified-layer-control-contract-ready',
      sourceIdentity: `IL2CPP:${sourceScriptPathId}|injectElementDataList|formulaParams.formulaParamValues[0]`,
    };
  }
  if (sourceScriptPathId === BATTLE_MECHANIC_SCRIPT_PATH_IDS.immuneElement) {
    return {
      kind: 'immune-element',
      immuneType: integerOrNull(tree.immuneType),
      immuneLayerType: integerOrNull(tree.immuneLayerType),
      destroySelf: integerOrNull(tree.destroySelf),
      targetPathIds: collectNestedPathIds(tree.elementDataList),
      status: 'verified-immune-element-contract-ready',
      sourceIdentity: `IL2CPP:${sourceScriptPathId}|immuneType|immuneLayerType|elementDataList`,
    };
  }
  if (sourceScriptPathId === BATTLE_MECHANIC_SCRIPT_PATH_IDS.switchSkillIndex) {
    return {
      kind: 'switch-skill-index',
      targetControlSkillId: integerOrNull(tree.skillID),
      targetSubSkillIndex: integerOrNull(tree.subSkillIndex),
      skillSlot: integerOrNull(tree.skillSlot),
      durationMs: finiteNumberOrNull(tree.duration ?? tree.time),
      switchOriginalSkill: Number(tree.switchOriginalSkill) === 1,
      status: 'verified-switch-skill-index-contract-ready',
      sourceIdentity: `IL2CPP:${sourceScriptPathId}|skillID|subSkillIndex|duration`,
    };
  }
  return null;
}

function resolveBattleElementKind(tree) {
  if (Object.hasOwn(tree, 'damageType')) return 'damage';
  if (Object.hasOwn(tree, 'attributeID')) return 'property-change';
  if (Object.hasOwn(tree, 'recoverType')) return 'sp';
  if (Object.hasOwn(tree, 'shieldParams')) return 'shield';
  if (Object.hasOwn(tree, 'judgmentType')) return 'judgment';
  if (Object.hasOwn(tree, 'sustainElement')) return 'pack';
  if (Object.hasOwn(tree, 'layerInfoList')) return 'stack';
  if (Object.hasOwn(tree, 'injectElementDataList')) return 'inject';
  return 'other';
}

function classifyBattleEffectNode({
  tree,
  kind,
  commonFunctionId,
  baseFunctionId,
  valueByLevel,
  depth,
  tuningMechanicsCatalog,
}) {
  const dimensions = Object.fromEntries(
    [
      'damage',
      'toughness',
      'sp',
      'hp',
      'shield',
      'dynamicProperty',
      'mark',
    ].map(key => [
      key,
      createDimensionClassification('verified-zero', [
        `element-kind-${kind}-does-not-write-${key}`,
      ]),
    ])
  );
  const reasons = [];
  const literalValues = Object.values(valueByLevel).filter(
    value => value != null
  );
  const literalReady =
    commonFunctionId === 1 &&
    baseFunctionId === 5 &&
    literalValues.length === 12;
  const literalZero = literalReady && literalValues.every(value => value === 0);
  const elementId = integerOrNull(tree.elementConfigId);
  const tuningProfile = resolveTuningProfileForBattleElement(
    tuningMechanicsCatalog,
    { kind, elementId }
  );

  if (kind === 'property-change') {
    if (!literalReady) reasons.push('property-formula-not-literal-function-5');
    if (integerOrNull(tree.changeType) !== 0) {
      reasons.push('property-change-type-not-battle-property');
    }
    if (![0, 1, 2].includes(integerOrNull(tree.calculateType))) {
      reasons.push('property-calculate-type-not-dynamic-bucket');
    }
    if (
      (tree.defaultConditions ?? []).length > 0 ||
      (tree.changePeopertyConditionArrayDatas ?? []).length > 0
    ) {
      reasons.push('property-conditions-not-expanded');
    }
    if (![null, 0].includes(integerOrNull(tree.frequencyType))) {
      reasons.push('property-frequency-not-single-application');
    }
    dimensions.dynamicProperty = createDimensionClassification(
      reasons.length ? 'unresolved' : literalZero ? 'verified-zero' : 'applied',
      reasons,
      'formulaParams.formulaParamValues[0]'
    );
  } else if (kind === 'sp') {
    if (integerOrNull(tree.recoverType) !== 0) {
      reasons.push('sp-recover-type-not-direct-sp');
    }
    if (!literalReady) reasons.push('sp-formula-not-literal-function-5');
    dimensions.sp = createDimensionClassification(
      reasons.length ? 'unresolved' : literalZero ? 'verified-zero' : 'applied',
      reasons,
      'formulaParams.formulaParamValues[0]'
    );
  } else if (kind === 'damage' && Number(tree.damageType) === 5) {
    if (!literalReady) reasons.push('heal-formula-not-literal-function-5');
    dimensions.hp = createDimensionClassification(
      reasons.length ? 'unresolved' : literalZero ? 'verified-zero' : 'applied',
      reasons,
      'formulaParams.formulaParamValues[0]'
    );
  } else if (
    kind === 'shield' ||
    (kind === 'damage' && Number(tree.damageType) === 11)
  ) {
    if (!literalReady) reasons.push('shield-formula-not-literal-function-5');
    dimensions.shield = createDimensionClassification(
      reasons.length ? 'unresolved' : literalZero ? 'verified-zero' : 'applied',
      reasons,
      'formulaParams.formulaParamValues[0]'
    );
  } else if (kind === 'damage') {
    if (depth > 0) {
      reasons.push('nested-damage-trigger-lifecycle-not-expanded');
      dimensions.damage = createDimensionClassification(
        'unresolved',
        reasons,
        'damageType'
      );
    }
  } else if (kind === 'stack' && tuningProfile) {
    const tuningMark = createTuningMarkNodeContract(tree, tuningProfile);
    if (!tuningMark.applied) reasons.push(...tuningMark.reasons);
    dimensions.mark = createDimensionClassification(
      tuningMark.applied ? 'applied' : 'unresolved',
      tuningMark.reasons,
      'elementConfigId|layerInfoList|additionalHitRefreshTime'
    );
  } else if (kind === 'inject' && tuningProfile) {
    dimensions.mark = createDimensionClassification(
      'applied',
      [],
      'elementConfigId|notDelElementDataList'
    );
  } else if (['pack', 'stack', 'judgment'].includes(kind)) {
    reasons.push(
      kind === 'judgment'
        ? 'judgment-condition-runtime-unimplemented'
        : `${kind}-lifecycle-runtime-unimplemented`
    );
    dimensions.mark = createDimensionClassification(
      'unresolved',
      reasons,
      'elementConfigId'
    );
  } else if (kind === 'inject') {
    reasons.push('inject-wrapper-classified-through-child-edges');
  } else {
    reasons.push('battle-element-kind-not-calculator-supported');
  }

  const statuses = Object.values(dimensions).map(dimension => dimension.status);
  const status = statuses.includes('applied')
    ? 'applied'
    : statuses.includes('unresolved') || reasons.length > 0
      ? 'unresolved'
      : 'verified-zero';
  return { status, reasons: dedupeBy(reasons, value => value), dimensions };
}

function createControlRuntimeEffects({ effectGraph, control }) {
  return effectGraph.flatMap(root => {
    const runtimeNodes = root.nodes.filter(node => {
      if (
        [
          'property-change',
          'sp',
          'shield',
          'pack',
          'stack',
          'judgment',
          'inject',
        ].includes(node.kind)
      ) {
        return true;
      }
      if (node.kind !== 'damage') return false;
      return (
        [5, 11].includes(Number(node.damage?.damageType)) || node.depth > 0
      );
    });
    const triggers = root.rootPathId
      ? (control.behaviorTriggers.get(root.rootPathId) ?? [])
      : [];
    const effectiveTriggers = triggers.length > 0 ? triggers : [null];
    return runtimeNodes.flatMap(node =>
      effectiveTriggers.map((trigger, triggerIndex) =>
        createControlRuntimeEffectBinding({
          root,
          node,
          trigger,
          triggerIndex,
        })
      )
    );
  });
}

function createControlRuntimeEffectBinding({
  root,
  node,
  trigger,
  triggerIndex,
}) {
  const relationPath = resolveEffectGraphRelationPath(root, node.nodeIdentity);
  const ancestorNodes = relationPath
    .map(edge =>
      root.nodes.find(candidate => candidate.nodeIdentity === edge.from)
    )
    .filter(Boolean);
  const tuningBinding = resolveTuningEffectBindingContract({
    node,
    relationPath,
    ancestorNodes,
  });
  const target =
    tuningBinding?.target ??
    (node.kind === 'sp'
      ? {
          kind: 'source-owner',
          code: null,
          sourceIdentity: `${node.sourceIdentity}|SpElement.Execute.source`,
        }
      : {
          kind: trigger?.targetKind ?? 'unresolved',
          code: trigger?.targetCode ?? null,
          sourceIdentity: trigger?.sourceIdentity ?? null,
        });
  const reasons = [
    ...node.reasons.filter(
      reason =>
        !tuningBinding ||
        ![
          'stack-lifecycle-runtime-unimplemented',
          'inject-wrapper-classified-through-child-edges',
        ].includes(reason)
    ),
    ...(tuningBinding?.reasons ?? []),
  ];
  if (!trigger || !Number.isInteger(trigger.startFrame)) {
    reasons.push('effect-trigger-frame-missing');
  }
  if (!['source-owner', 'enemy', 'team-tuning-pool'].includes(target.kind)) {
    reasons.push(
      target.kind ? `effect-target-${target.kind}` : 'effect-target-unresolved'
    );
  }
  if (
    !tuningBinding &&
    node.depth > 0 &&
    relationPath.some(
      edge =>
        !['injectElementDataList', 'notDelElementDataList'].includes(
          edge.relation
        )
    )
  ) {
    reasons.push('nested-effect-wrapper-semantics-unresolved');
  }
  const stack = tuningBinding
    ? {
        mode: 'stack',
        maxStacks: tuningBinding.maxStacks ?? 1,
        instanceScope: 'team-tuning-pool',
        reasons: [],
      }
    : resolveEffectStackContract(node.lifecycle);
  reasons.push(...stack.reasons);
  const effectiveDurationMs = resolveEffectDurationMs(node, ancestorNodes);
  if (node.kind === 'property-change' && effectiveDurationMs === 0) {
    reasons.push('property-duration-zero-unresolved');
  }
  const valueByLevel = node.formula.valueByLevel;
  const blockingReasons = dedupeBy(
    reasons.filter(
      reason =>
        !reason.endsWith('-does-not-write-damage') &&
        !reason.endsWith('-does-not-write-toughness') &&
        !reason.endsWith('-does-not-write-sp') &&
        !reason.endsWith('-does-not-write-hp') &&
        !reason.endsWith('-does-not-write-shield') &&
        !reason.endsWith('-does-not-write-dynamicProperty') &&
        !reason.endsWith('-does-not-write-mark')
    ),
    value => value
  );
  const baseApplied =
    node.classification === 'applied' && tuningBinding?.applied !== false;
  const classification =
    baseApplied && blockingReasons.length === 0
      ? 'applied'
      : node.classification === 'verified-zero' && blockingReasons.length === 0
        ? 'verified-zero'
        : 'unresolved';
  const dimensions = Object.fromEntries(
    Object.entries(node.dimensions).map(([key, dimension]) => [
      key,
      baseApplied &&
      dimension.status === 'applied' &&
      classification !== 'applied'
        ? createDimensionClassification(
            'unresolved',
            blockingReasons,
            dimension.sourceField
          )
        : dimension,
    ])
  );
  return {
    effectIdentity: [
      root.graphIdentity,
      node.nodeIdentity,
      trigger?.startFrame ?? 'unresolved-frame',
      triggerIndex,
    ].join('|'),
    graphIdentity: root.graphIdentity,
    controlSkillId: root.controlSkillId,
    mapIndex: root.mapIndex,
    rootElementId: root.rootElementId,
    rootPathId: root.rootPathId,
    elementId: node.elementId,
    pathId: node.pathId,
    name: node.name,
    kind: node.kind,
    depth: node.depth,
    relationPath,
    trigger,
    target,
    lifecycle: {
      durationMs: effectiveDurationMs,
      stackMode: stack.mode,
      stackDelta: 1,
      maxStacks: stack.maxStacks,
      instanceScope: stack.instanceScope,
      combineType: node.lifecycle.combineType,
      mutuallyExclusiveId: node.lifecycle.mutuallyExclusiveId,
      tags: node.lifecycle.tags,
    },
    propertyChange: node.propertyChange && {
      ...node.propertyChange,
      bucket:
        node.propertyChange.calculateType === 0
          ? 'dynamicForce'
          : node.propertyChange.calculateType === 1
            ? 'dynamicExtra'
            : node.propertyChange.calculateType === 2
              ? 'dynamicPercent'
              : 'unresolved',
      valueByLevel,
    },
    directSp: node.directSp && {
      ...node.directSp,
      valueByLevel,
    },
    heal:
      node.kind === 'damage' && node.damage?.damageType === 5
        ? { valueByLevel }
        : null,
    shield: (node.kind === 'shield' || node.damage?.damageType === 11) && {
      ...node.shield,
      valueByLevel,
    },
    tuningMark:
      tuningBinding?.kind === 'acquire' ? tuningBinding.contract : null,
    tuningOverlimit:
      tuningBinding?.kind === 'consume' ? tuningBinding.contract : null,
    formula: {
      commonFunctionId: node.formula.commonFunctionId,
      baseFunctionId: node.formula.baseFunctionId,
      commonExpression: node.formula.commonExpression,
      baseExpression: node.formula.baseExpression,
    },
    sourceIdentity: `battle-effect:${root.controlSkillId}:${root.mapIndex}:${node.pathId}:${trigger?.behaviorPathId ?? 'unresolved'}:${trigger?.startFrame ?? 'unresolved'}`,
    dimensions,
    classification,
    reasons: blockingReasons,
    status: `verified-action-effect-binding-${classification}`,
    confidence: classification === 'applied' ? 'high' : classification,
    applied: classification === 'applied',
  };
}

function resolveTuningEffectBindingContract({
  node,
  relationPath,
  ancestorNodes,
}) {
  if (node.tuningMark) {
    const unsafeRelations = relationPath
      .map(edge => edge.relation)
      .filter(relation => relation !== 'injectElementDataList');
    const reasons = [
      ...(node.tuningMark.reasons ?? []),
      ...unsafeRelations.map(
        relation => `tuning-mark-relation-${relation}-unresolved`
      ),
    ];
    return {
      kind: 'acquire',
      target: {
        kind: 'team-tuning-pool',
        code: node.tuningMark.markId,
        sourceIdentity: node.tuningMark.sourceIdentity,
      },
      maxStacks: node.tuningMark.maxStacks,
      contract: {
        ...node.tuningMark,
        stackDelta: 1,
      },
      reasons: dedupeBy(reasons, value => value),
      applied: node.tuningMark.applied && reasons.length === 0,
    };
  }
  if (!node.tuningOverlimit) return null;

  const judgmentNode = [...ancestorNodes]
    .reverse()
    .find(candidate => candidate.judgment);
  const judgment = judgmentNode?.judgment ?? null;
  const markIds = [
    ...new Set(
      (judgment?.markElementIds ?? []).map(Number).filter(Number.isInteger)
    ),
  ];
  const judgmentEdge = judgmentNode
    ? relationPath.find(edge => edge.from === judgmentNode.nodeIdentity)
    : null;
  const reasons = [];
  if (!judgment) reasons.push('tuning-consume-judgment-missing');
  if (judgment && !judgment.consume) {
    reasons.push('tuning-consume-disabled');
  }
  if (
    markIds.length !== 1 ||
    markIds[0] !== Number(node.tuningOverlimit.markId)
  ) {
    reasons.push('tuning-consume-mark-identity-ambiguous');
  }
  if (
    !judgmentEdge ||
    !['injectElementDataList_2', 'injectElementDataEffects'].includes(
      judgmentEdge.relation
    )
  ) {
    reasons.push('tuning-consume-success-branch-unresolved');
  }
  const minimumStacks = positiveIntegerOrNull(judgment?.consumeLayerNum) ?? 1;
  const configuredMaximum = positiveIntegerOrNull(judgment?.consumeLayerMaxNum);
  return {
    kind: 'consume',
    target: {
      kind: 'enemy',
      code: null,
      sourceIdentity: node.tuningOverlimit.sourceIdentity,
    },
    maxStacks: configuredMaximum ?? 5,
    contract: {
      ...node.tuningOverlimit,
      minimumStacks,
      maximumStacks: configuredMaximum,
      consumeMode: integerOrNull(judgment?.consumeMode),
      judgmentElementId: integerOrNull(judgmentNode?.elementId),
      judgmentPathId: judgmentNode?.pathId ?? null,
      judgmentSourceIdentity: judgmentNode?.sourceIdentity ?? null,
    },
    reasons: dedupeBy(reasons, value => value),
    applied: reasons.length === 0,
  };
}

function resolveEffectGraphRelationPath(root, targetIdentity) {
  if (targetIdentity === `element:${root.rootPathId}`) return [];
  const edgeByTarget = new Map(root.edges.map(edge => [edge.to, edge]));
  const result = [];
  const visited = new Set();
  let cursor = targetIdentity;
  while (edgeByTarget.has(cursor) && !visited.has(cursor)) {
    visited.add(cursor);
    const edge = edgeByTarget.get(cursor);
    result.unshift(edge);
    cursor = edge.from;
  }
  return result;
}

function resolveEffectDurationMs(node, ancestors) {
  const own = finiteNumberOrNull(node.lifecycle.durationMs);
  if (own != null && own >= 0) return own;
  const inherited = [...ancestors]
    .reverse()
    .map(ancestor => finiteNumberOrNull(ancestor.lifecycle.durationMs))
    .find(value => value != null && value > 0);
  return inherited ?? null;
}

function resolveEffectStackContract(lifecycle) {
  const combineType = integerOrNull(lifecycle.combineType);
  if (combineType === 1) {
    return {
      mode: 'replace',
      maxStacks: 1,
      instanceScope: 'source-action',
      reasons: [],
    };
  }
  if ([0, 3].includes(combineType)) {
    return {
      mode: 'replace',
      maxStacks: 1,
      instanceScope: 'target-effect',
      reasons: [],
    };
  }
  if (combineType === 4) {
    const maxStacks =
      positiveIntegerOrNull(lifecycle.maxCount) ??
      positiveIntegerOrNull(lifecycle.combineNumber);
    return {
      mode: 'stack',
      maxStacks: maxStacks ?? 1,
      instanceScope: 'target-effect',
      reasons: maxStacks ? [] : ['effect-stack-maximum-unresolved'],
    };
  }
  return {
    mode: 'refresh',
    maxStacks: 1,
    instanceScope: 'target-effect',
    reasons: ['effect-combine-semantics-unresolved'],
  };
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
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

function createMechanismEvidenceManifest() {
  const definitions = [
    {
      id: 'combat-formula-knowledge',
      filePath: MECHANISM_KNOWLEDGE_PATH,
      validate: value =>
        value?.status === 'reverse-engineered-verified' &&
        Array.isArray(value?.entries) &&
        value.entries.length > 0,
    },
    {
      id: 'combat-property-sources',
      filePath: PROPERTY_SOURCES_PATH,
      validate: value =>
        value?.formulas?.staticPanelRaw ===
          'S = EB * (1 + EP_raw/10000) + EE' &&
        value?.character?.baseGrowth?.characterCount === 17 &&
        value?.kibo?.baseGrowth?.battlePetCount === 147,
    },
    {
      id: 'combat-sp-recovery-sharing',
      filePath: SP_RECOVERY_SHARING_PATH,
      validate: value =>
        value?.runtime &&
        value?.currentConfiguration &&
        Array.isArray(value?.evidence),
    },
    {
      id: 'combat-overlimit-mechanics',
      filePath: OVERLIMIT_MECHANICS_PATH,
      validate: value =>
        Array.isArray(value?.markContainers) &&
        Array.isArray(value?.tuningProfiles),
    },
    {
      id: 'combat-formulas-evidence',
      filePath: EVIDENCE_PATH,
      validate: value =>
        value?.calculator?.passed === 18 && value?.calculator?.failed === 0,
    },
    {
      id: 'combat-coefficient-ranges',
      filePath: COEFFICIENT_RANGES_PATH,
      validate: value =>
        Array.isArray(value?.propertyGuards) && value.propertyGuards.length > 0,
    },
    {
      id: 'combat-enemy-break-profiles',
      filePath: ENEMY_BREAK_PROFILES_PATH,
      validate: value =>
        Array.isArray(value?.profiles) && value.profiles.length > 0,
    },
  ];
  const sources = definitions.map(definition => {
    const value = readJson(definition.filePath);
    if (!definition.validate(value)) {
      throw new Error(
        `verified mechanism source structure invalid: ${definition.id}`
      );
    }
    return {
      id: definition.id,
      version: String(value.version ?? value.schemaVersion ?? 'unversioned'),
      sourceStatus: value.status ?? null,
      validationStatus: 'verified-source-structure-ready',
      sourceIdentity: relativeExternalPath(definition.filePath),
      sha256: sha256File(definition.filePath),
      bytes: fs.statSync(definition.filePath).size,
    };
  });
  return {
    schemaVersion: 1,
    contractName: 'AzPrVerifiedMechanismEvidenceManifest',
    status: 'verified-mechanism-evidence-manifest-ready',
    sources,
  };
}

function createTuningMechanicsCatalog({
  snapshot,
  allIndexedElements,
  allIndexedElementsById,
}) {
  const records = dedupeBy([...allIndexedElements.values()].flat(), record =>
    String(record.pathId)
  );
  const recordByPathId = new Map(
    records.map(record => [String(record.pathId), record])
  );
  const containersById = new Map(
    (snapshot.markContainers ?? []).map(container => [
      Number(container.elementConfigId),
      container,
    ])
  );
  const standardTemplatesById = new Map(
    (snapshot.standardTemplates ?? []).map(template => [
      Number(template.elementConfigId),
      template,
    ])
  );
  const heldTemplatesByMarkId = new Map();
  for (const template of snapshot.heldTuningDamageTemplates ?? []) {
    const markId = Number(template.markElementId);
    heldTemplatesByMarkId.set(markId, [
      ...(heldTemplatesByMarkId.get(markId) ?? []),
      createPublishedTuningDamageTemplate(template),
    ]);
  }

  const profiles = (snapshot.tuningProfiles ?? []).map(profile => {
    const markId = Number(profile.markId);
    const container = containersById.get(markId);
    if (!container) {
      throw new Error(`verified tuning container missing: ${markId}`);
    }
    const packetRecord = resolveTuningOverlimitPacketRecord({
      profile,
      records,
      recordByPathId,
    });
    const layerComponentIds = [
      ...new Set(
        (container.layers ?? []).flatMap(layer =>
          (layer.linkedElementIds ?? []).map(Number).filter(Number.isInteger)
        )
      ),
    ];
    const discoveredPersistentModifiers = layerComponentIds.flatMap(
      componentId => {
        const candidates = dedupeBy(
          allIndexedElementsById.get(componentId) ?? [],
          record => String(record.pathId)
        );
        if (candidates.length !== 1) return [];
        const record = candidates[0];
        const tree = record.typetree ?? {};
        const attributeId = integerOrNull(tree.attributeID);
        const calculateType = integerOrNull(tree.calculateType);
        const valueRaw = finiteNumberOrNull(
          tree.formulaParams?.formulaParamValues?.[0] ??
            tree.functionParams?.[0]
        );
        if (
          attributeId == null ||
          attributeId <= 0 ||
          valueRaw == null ||
          ![0, 1, 2].includes(calculateType) ||
          (tree.defaultConditions ?? []).length > 0 ||
          (tree.changePeopertyConditionArrayDatas ?? []).length > 0
        ) {
          return [];
        }
        return [
          {
            componentId,
            attributeId,
            bucket: resolveDynamicPropertyBucket(calculateType),
            valueRaw,
            propertyTags: (tree.defaultPropertyTags ?? []).map(Number),
            sourceIdentity: `battle-element-assets.jsonl#path_id=${record.pathId}`,
            status: 'verified-tuning-persistent-modifier-ready',
            applied: true,
          },
        ];
      }
    );
    const persistentModifiers = resolveTuningPersistentModifiers({
      profile,
      discovered: discoveredPersistentModifiers,
    });
    const layerDurations = [
      ...new Set(
        (container.layers ?? [])
          .map(layer => Number(layer.disperseSeconds) * 1000)
          .filter(Number.isFinite)
      ),
    ];
    if (layerDurations.length !== 1) {
      throw new Error(`verified tuning layer duration ambiguous: ${markId}`);
    }
    const overlimitTemplate = standardTemplatesById.get(
      Number(profile.primaryDamageId)
    );
    if (!overlimitTemplate) {
      throw new Error(`verified tuning damage template missing: ${markId}`);
    }
    return {
      key: String(profile.key),
      element: String(profile.element),
      markId,
      maxStacks: Number(container.maxMarks),
      layerDurationMs: layerDurations[0],
      heldReadyMs: Number(container.additionalHitRefreshSeconds) * 1000,
      layerComponentIds,
      additionalHitComponentIds: (container.additionalHitElements ?? [])
        .map(component => Number(component.elementConfigId))
        .filter(Number.isInteger),
      persistentModifiers,
      heldDamageTemplates: heldTemplatesByMarkId.get(markId) ?? [],
      heldEffect: profile.heldEffect ?? null,
      overlimitDamage: {
        ...profile.overlimitDamage,
        template: createPublishedTuningDamageTemplate(overlimitTemplate),
      },
      overlimitExtra: profile.overlimitExtra ?? null,
      overlimitPacket: {
        elementId: Number(packetRecord.typetree.elementConfigId),
        pathId: String(packetRecord.pathId),
        sourceIdentity: `battle-element-assets.jsonl#path_id=${packetRecord.pathId}`,
      },
      sourceIdentity: [
        `combat-overlimit-mechanics-20260718.json#tuningProfiles[key=${profile.key}]`,
        `combat-overlimit-mechanics-20260718.json#markContainers[elementConfigId=${markId}]`,
        `battle-element-assets.jsonl#path_id=${packetRecord.pathId}`,
      ].join('|'),
      status: 'verified-tuning-profile-ready',
      applied: true,
    };
  });
  if (
    profiles.length !== 9 ||
    new Set(profiles.map(profile => profile.markId)).size !== 9 ||
    profiles.some(
      profile =>
        profile.maxStacks !== 5 ||
        profile.layerDurationMs !== 20_000 ||
        profile.heldReadyMs !== 5_000 ||
        profile.heldDamageTemplates.length === 0
    )
  ) {
    throw new Error('verified tuning profile coverage invalid');
  }
  return {
    schemaVersion: 1,
    contractName: 'AzPrVerifiedTuningMechanicsCatalog',
    status: 'verified-tuning-mechanics-catalog-ready',
    valueUnit: 'mark-stacks',
    mastery: {
      propertyId: Number(snapshot.mastery?.propertyId),
      q16Raw: Number(snapshot.mastery?.q16Raw),
      configuredConstant: Number(snapshot.mastery?.configuredConstant),
      sourceIdentity: 'combat-overlimit-mechanics-20260718.json#mastery',
    },
    profiles,
    summary: {
      profileCount: profiles.length,
      markContainerCount: profiles.length,
      persistentModifierCount: profiles.reduce(
        (sum, profile) => sum + profile.persistentModifiers.length,
        0
      ),
      heldDamageTemplateCount: profiles.reduce(
        (sum, profile) => sum + profile.heldDamageTemplates.length,
        0
      ),
      overlimitPacketCount: profiles.length,
      applied: true,
    },
    sourceIdentity: 'combat-overlimit-mechanics-20260718.json',
    applied: true,
  };
}

function resolveTuningOverlimitPacketRecord({
  profile,
  records,
  recordByPathId,
}) {
  const primaryDamageId = Number(profile.primaryDamageId);
  const candidates = records.filter(record => {
    const tree = record.typetree ?? {};
    if (resolveBattleElementKind(tree) !== 'inject') return false;
    const childIds = collectBattleElementChildReferences(tree)
      .map(reference => {
        if (reference.pathId) {
          const child = recordByPathId.get(String(reference.pathId));
          return integerOrNull(child?.typetree?.elementConfigId);
        }
        return integerOrNull(reference.elementIdHint);
      })
      .filter(Number.isInteger);
    return childIds.includes(primaryDamageId);
  });
  if (candidates.length !== 1) {
    throw new Error(
      `verified tuning overlimit packet not unique: ${profile.key} (${candidates.length})`
    );
  }
  return candidates[0];
}

function resolveTuningPersistentModifiers({ profile, discovered }) {
  const heldEffect = profile.heldEffect ?? {};
  const declaredAttributeIds = [
    ...(heldEffect.attributeIds ?? []),
    heldEffect.attributeId,
  ]
    .map(Number)
    .filter(value => Number.isInteger(value) && value > 0);
  const declaredRaw = finiteNumberOrNull(heldEffect.rawPerMark);
  if (declaredAttributeIds.length === 0 || declaredRaw == null) {
    return discovered;
  }
  const discoveredByAttributeId = new Map(
    discovered.map(modifier => [modifier.attributeId, modifier])
  );
  return [...new Set(declaredAttributeIds)].map(
    attributeId =>
      discoveredByAttributeId.get(attributeId) ?? {
        componentId: integerOrNull(heldEffect.componentId),
        attributeId,
        bucket:
          heldEffect.unit === 'percent' ? 'dynamicPercent' : 'dynamicExtra',
        valueRaw: declaredRaw,
        propertyTags: [],
        sourceIdentity: `combat-overlimit-mechanics-20260718.json#tuningProfiles[key=${profile.key}].heldEffect`,
        status: 'verified-tuning-persistent-modifier-ready',
        applied: true,
      }
  );
}

function createPublishedTuningDamageTemplate(template = {}) {
  return {
    elementConfigId: integerOrNull(template.elementConfigId),
    damageType: integerOrNull(template.damageType),
    elementalType: integerOrNull(
      template.damageElementalType ?? template.elementalType
    ),
    coefficientRaw: integerOrNull(
      template.attackCoefficientRaw ?? template.heldMarkCoefficientRaw
    ),
    weakBreakDamageRateBasisPoints: integerOrNull(template.weakBreakDamageRate),
    physicalPenetrationBasisPoints: integerOrNull(template.armerPenetration),
    magicPenetrationBasisPoints: integerOrNull(template.magicPenetration),
    elementCalculationFactorBasisPoints: integerOrNull(
      template.elementCalFactor
    ),
    physicalRatioBasisPoints: integerOrNull(template.physicalRatio),
    magicRatioBasisPoints: integerOrNull(template.magicRatio),
    usesTuningStrength: template.usesTuningStrength !== false,
    sourceIdentity: `combat-overlimit-mechanics-20260718.json#elementConfigId=${template.elementConfigId}`,
  };
}

function resolveDynamicPropertyBucket(calculateType) {
  if (calculateType === 0) return 'dynamicForce';
  if (calculateType === 1) return 'dynamicExtra';
  if (calculateType === 2) return 'dynamicPercent';
  return 'unresolved';
}

function resolveTuningProfileForBattleElement(
  tuningMechanicsCatalog,
  { kind, elementId }
) {
  if (!tuningMechanicsCatalog || elementId == null) return null;
  if (kind === 'stack') {
    return (
      tuningMechanicsCatalog.profiles.find(
        profile => profile.markId === Number(elementId)
      ) ?? null
    );
  }
  if (kind === 'inject') {
    return (
      tuningMechanicsCatalog.profiles.find(
        profile => profile.overlimitPacket.elementId === Number(elementId)
      ) ?? null
    );
  }
  return null;
}

function createTuningMarkNodeContract(tree, profile) {
  const layers = tree.layerInfoList ?? [];
  const maxStacks = Math.max(
    0,
    ...layers.map(layer => integerOrNull(layer.layerCnt) ?? 0)
  );
  const durationValues = [
    ...new Set(
      layers
        .map(layer =>
          fixedQ16SecondsToMs(layer.layerDisperseTime?._serializedValue)
        )
        .filter(value => value != null)
    ),
  ];
  const layerDurationMs =
    durationValues.length === 1 ? durationValues[0] : null;
  const heldReadyMs = Number(tree.additionalHitRefreshTime) * 1000;
  const reasons = [];
  if (maxStacks !== profile.maxStacks) reasons.push('tuning-mark-max-mismatch');
  if (layerDurationMs !== profile.layerDurationMs) {
    reasons.push('tuning-mark-layer-duration-mismatch');
  }
  if (heldReadyMs !== profile.heldReadyMs) {
    reasons.push('tuning-mark-held-ready-mismatch');
  }
  return {
    profileKey: profile.key,
    element: profile.element,
    markId: profile.markId,
    maxStacks,
    layerDurationMs,
    heldReadyMs,
    layerComponentIds: profile.layerComponentIds,
    additionalHitComponentIds: profile.additionalHitComponentIds,
    sourceIdentity: profile.sourceIdentity,
    reasons,
    status: reasons.length
      ? 'verified-tuning-mark-node-unresolved'
      : 'verified-tuning-mark-node-ready',
    applied: reasons.length === 0,
  };
}

function fixedQ16SecondsToMs(value) {
  const raw = finiteNumberOrNull(value);
  return raw == null ? null : Math.round((raw / 65_536) * 1000);
}

function createStaticPropertyCatalog({
  tables,
  templateRows,
  templateHeroRows,
  publicCharacters,
  publicKibos,
  propertySourceSnapshot,
  spUnitContract,
}) {
  const templateById = new Map(
    (templateRows ?? []).map(row => [Number(row.id), row])
  );
  const unitPropertyById = new Map(
    (tables.unit_property ?? []).map(row => [Number(row.id), row])
  );
  const talentRuneById = new Map(
    (tables.talent_rune ?? []).map(row => [Number(row.id), row])
  );
  const skillById = new Map(
    (tables.skill ?? []).map(row => [Number(row.id), row])
  );
  const verifiedHeroes = (tables.hero ?? []).filter(
    row => Number(row.isCollect) === 1 && Number(row.isUsable) === 1
  );
  const verifiedKibos = (tables.pet ?? []).filter(
    row => row.isBattle === true && templateById.has(Number(row.id))
  );
  const actorProfiles = verifiedHeroes.map(hero => {
    const property = unitPropertyById.get(Number(hero.propertyId));
    const baseTemplateId = Number(property?.baseAttributeId);
    const baseTemplate = templateById.get(baseTemplateId);
    return {
      characterId: Number(hero.id),
      propertyId: Number(hero.propertyId),
      baseTemplateId,
      templateAttributes: parseAttributeEntries(baseTemplate?.baseAttribute),
      sourceIdentity: `NewTable/hero.rows[id=${hero.id}].propertyId=${hero.propertyId}|NewTable/unit_property.rows[id=${hero.propertyId}].baseAttributeId=${baseTemplateId}|NewTable/template_value.rows[id=${baseTemplateId}].baseAttribute`,
      status: baseTemplate
        ? 'verified-static-actor-profile-ready'
        : 'verified-static-actor-profile-unresolved',
      applied: Boolean(baseTemplate),
    };
  });
  const actorLevelGrowth = (templateHeroRows ?? [])
    .filter(
      row => Number(row.type) === 1 && Number.isInteger(Number(row.level))
    )
    .map(row => ({
      level: Number(row.level),
      templateId: Number(row.baseAttribute),
      attributes: parseAttributeEntries(
        templateById.get(Number(row.baseAttribute))?.baseAttribute
      ),
      sourceIdentity: `NewTable/template_hero.rows[type=1,level=${row.level}].baseAttribute=${row.baseAttribute}|NewTable/template_value.rows[id=${row.baseAttribute}].baseAttribute`,
    }))
    .sort((left, right) => left.level - right.level);
  const starGiftProfiles = verifiedHeroes.map(hero => ({
    characterId: Number(hero.id),
    ranks: (tables.talent_rank ?? [])
      .filter(row => Number(row.heroId) === Number(hero.id))
      .sort((left, right) => Number(left.rank) - Number(right.rank))
      .map(row => {
        const runeIds = parseIntegerList(row.rankBreakthroughItem);
        return {
          rank: Number(row.rank),
          attributes: parseAttributeEntries(row.attribute),
          runeIds,
          runeAttributes: sumAttributeEntryLists(
            runeIds.map(runeId =>
              parseAttributeEntries(talentRuneById.get(runeId)?.runeAttribute)
            )
          ),
          sourceIdentity: `NewTable/talent_rank.rows[id=${row.id},heroId=${hero.id},rank=${row.rank}].attribute+rankBreakthroughItem|NewTable/talent_rune.rows[id in ${runeIds.join(',')}].runeAttribute`,
        };
      }),
  }));
  const favorabilityProfiles = verifiedHeroes.map(hero => ({
    characterId: Number(hero.id),
    levels: (tables.hero_favorability_info ?? [])
      .filter(row => Number(row.heroId) === Number(hero.id))
      .map(row => ({
        level: Number(row.favorabilityLevel),
        attributes: parseAttributeEntries(row.levelUpAttribute),
        sourceIdentity: `NewTable/hero_favorability_info.rows[id=${row.id}].levelUpAttribute`,
      }))
      .sort((left, right) => left.level - right.level),
  }));
  const soulessenceProfiles = (tables.soulessence ?? []).map(item => {
    const valuePrefix = Number(item.attribute) * 1000;
    const levels = (tables.soulessence_value ?? [])
      .filter(row => {
        const id = Number(row.id);
        return id > valuePrefix && id < valuePrefix + 1000;
      })
      .map(row => ({
        level: Number(row.id) - valuePrefix,
        attributes: parseAttributeEntries(row.baseAttribute),
        sourceIdentity: `NewTable/soulessence_value.rows[id=${row.id}].baseAttribute`,
      }))
      .sort((left, right) => left.level - right.level);
    const ranks = (tables.soulessence_rank ?? [])
      .filter(row => Number(row.relatedId) === Number(item.id))
      .map(row => ({
        rank: Number(row.rank),
        levelLimit: Number(row.rankLevelLimit),
        attributes: parseAttributeEntries(row.rankUpAttributeAll),
        sourceIdentity: `NewTable/soulessence_rank.rows[id=${row.id},relatedId=${item.id},rank=${row.rank}].rankUpAttributeAll`,
      }))
      .sort((left, right) => left.rank - right.rank);
    const skill = skillById.get(Number(item.reishiSkill));
    return {
      soulessenceId: Number(item.id),
      attributeTemplateId: Number(item.attribute),
      levels,
      ranks,
      maximumLevel: levels.at(-1)?.level ?? null,
      maximumRank: ranks.at(-1)?.rank ?? null,
      effectSkill: {
        skillId: Number(item.reishiSkill) || null,
        skillType: Number(skill?.skillType) || null,
        status:
          Number(skill?.skillType) === 2
            ? 'numeric-static-skill-requires-attribute-binding'
            : 'effect-skill-dynamic-unapplied',
        appliedToStaticPanel: false,
        sourceIdentity: `NewTable/soulessence.rows[id=${item.id}].reishiSkill|NewTable/skill.rows[id=${item.reishiSkill}].skillType`,
      },
      sourceIdentity: `NewTable/soulessence.rows[id=${item.id}]`,
      status: levels.length
        ? 'verified-static-soulessence-profile-ready'
        : 'verified-static-soulessence-profile-unresolved',
      applied: levels.length > 0,
    };
  });
  const mainRowsByGroup = groupBy(tables.accessory_main ?? [], row =>
    String(row.groupId)
  );
  const subRowsByGroup = groupBy(tables.accessory_sub_parameter ?? [], row =>
    String(row.groupId)
  );
  const equipmentProfiles = (tables.accessory ?? []).map(item => {
    const mainGroupId = parseAttributeEntries(item.mainAttr)[0]?.id ?? null;
    const mainRows = mainRowsByGroup.get(String(mainGroupId)) ?? [];
    const mainLevels = [
      ...groupBy(mainRows, row => String(row.level)).entries(),
    ]
      .map(([level, rows]) => ({
        level: Number(level),
        attributes: rows
          .map(row => ({
            id: Number(row.battleInfo),
            value: Number(row.value),
          }))
          .filter(
            entry => Number.isFinite(entry.id) && Number.isFinite(entry.value)
          ),
        sourceIdentity: `NewTable/accessory_main.rows[groupId=${mainGroupId},level=${level}]`,
      }))
      .sort((left, right) => left.level - right.level);
    const subAttributes = (subRowsByGroup.get(String(item.subParameter)) ?? [])
      .map(row => ({
        id: Number(row.parameter),
        minimum: Number(row.minValue),
        maximum: Number(row.maxValue),
        value:
          Number(row.minValue) === Number(row.maxValue)
            ? Number(row.minValue)
            : null,
        status:
          Number(row.minValue) === Number(row.maxValue)
            ? 'verified-fixed-sub-attribute'
            : 'unresolved-random-sub-attribute',
        sourceIdentity: `NewTable/accessory_sub_parameter.rows[id=${row.id},groupId=${item.subParameter}]`,
      }))
      .filter(entry => Number.isFinite(entry.id));
    return {
      equipmentId: Number(item.id),
      slotType: Number(item.type),
      setId: Number(item.setId) || null,
      mainGroupId,
      maximumLevel: mainLevels.at(-1)?.level ?? null,
      mainLevels,
      subAttributes,
      sourceIdentity: `NewTable/accessory.rows[id=${item.id}]`,
      status: mainLevels.length
        ? 'verified-static-equipment-profile-ready'
        : 'verified-static-equipment-profile-unresolved',
      applied: mainLevels.length > 0,
    };
  });
  const accessorySets = (tables.accessory_set ?? []).flatMap(row =>
    parseAttributeEntries(row.skill).map(entry => {
      const skill = skillById.get(Number(entry.value));
      return {
        setId: Number(row.id),
        pieces: Number(entry.id),
        skillId: Number(entry.value),
        skillType: Number(skill?.skillType) || null,
        status:
          Number(skill?.skillType) === 2
            ? 'numeric-static-set-skill-requires-attribute-binding'
            : 'effect-set-skill-dynamic-unapplied',
        appliedToStaticPanel: false,
        sourceIdentity: `NewTable/accessory_set.rows[id=${row.id}].skill|NewTable/skill.rows[id=${entry.value}].skillType`,
      };
    })
  );
  const kiboProfiles = verifiedKibos.map(kibo => ({
    kiboId: Number(kibo.id),
    speciesAttributes: parseAttributeEntries(
      templateById.get(Number(kibo.id))?.baseAttribute
    ),
    sourceIdentity: `NewTable/pet.rows[id=${kibo.id},isBattle=true]|NewTable/template_value.rows[id=${kibo.id}].baseAttribute`,
    status: 'verified-static-kibo-profile-ready',
    applied: true,
  }));
  const kiboLevelGrowth = Array.from({ length: 100 }, (_, index) => index + 1)
    .map(level => {
      const templateId = Number(spUnitContract.kibo.petGrowthBaseId) + level;
      const template = templateById.get(templateId);
      return template
        ? {
            level,
            templateId,
            attributes: parseAttributeEntries(template.baseAttribute),
            sourceIdentity: `NewTable/template_value.rows[id=${templateId}].baseAttribute`,
          }
        : null;
    })
    .filter(Boolean);
  const hobbies = (tables.pet_hobby ?? []).map(row => ({
    hobbyId: Number(row.id),
    attributes: parseAttributeEntries(row.baseAttribute),
    sourceIdentity: `NewTable/pet_hobby.rows[id=${row.id}].baseAttribute`,
  }));
  const comprehensionGrades = (tables.pet_learningtalent ?? []).map(row => {
    const [minimum, maximum] = parseIntegerList(row.range);
    return {
      attributeEnumId: Number(row.enumId),
      grade: String(row.level),
      minimum,
      maximum,
      sourceIdentity: `NewTable/pet_learningtalent.rows[id=${row.id}].range`,
    };
  });
  const intimacyLevels = (tables.pet_favorability ?? []).map(row => ({
    level: Number(row.level),
    inheritanceBasisPoints: Number(row.levelEffect),
    sourceIdentity: `NewTable/pet_favorability.rows[id=${row.id}].levelEffect`,
  }));
  const inheritance = (tables.pet_attributeinheritance ?? []).map(row => ({
    sourceAttributeId: Number(row.attrVal),
    adjustment: Number(row.adjustment),
    targetAttributeId: Number(row.petAttrVal),
    sourceIdentity: `NewTable/pet_attributeinheritance.rows[id=${row.id}]`,
  }));
  const attributeDefinitions = (tables.battle_info ?? [])
    .map(row => {
      const [rawGroupId, rawGroupType] = String(row.attrGroup ?? '').split('|');
      const id = Number(row.attrVal);
      return {
        id,
        key: id === 227 ? 'SPRET_AUTO' : row.attrID,
        tableKey: row.attrID,
        isRatio: Number(row.isRatio) === 1,
        rawScale: Number(row.isCalRatio) === 1 ? 10000 : 1,
        groupId: integerOrNull(rawGroupId),
        groupType: integerOrNull(rawGroupType),
        minimum: row.useMininumValue ? Number(row.minimumValue) : null,
        maximum: row.useMaximumValue ? Number(row.maximumValue) : null,
      };
    })
    .filter(row => Number.isInteger(row.id));
  const identityAudit = createStaticPropertyIdentityAudit({
    publicCharacters,
    publicKibos,
    verifiedHeroes,
    verifiedKibos,
    actorProfiles,
    kiboProfiles,
  });
  if (
    identityAudit.verifiedActorCount !==
      Number(propertySourceSnapshot?.character?.baseGrowth?.characterCount) ||
    identityAudit.verifiedKiboCount !==
      Number(propertySourceSnapshot?.kibo?.baseGrowth?.battlePetCount)
  ) {
    throw new Error(
      `static property identity counts drift from verified snapshot: actors=${identityAudit.verifiedActorCount}/${propertySourceSnapshot?.character?.baseGrowth?.characterCount}, kibos=${identityAudit.verifiedKiboCount}/${propertySourceSnapshot?.kibo?.baseGrowth?.battlePetCount}`
    );
  }
  return {
    schemaVersion: 1,
    contractName: 'AzPrVerifiedStaticPropertyCatalog',
    status: 'verified-static-property-catalog-ready',
    formula: {
      staticPanel: 'S=EB*(1+EP_raw/10000)+EE',
      settlementOrder: [
        'external-base-sum',
        'external-percent-sum',
        'external-base-percent-product',
        'external-extra-sum',
      ],
      actorCoreLevel:
        'integrate(hero-level-growth * actor-template-factor / 10000)',
      kiboCoreLevel: 'integrate(kibo-level-growth * species-factor / 10000)',
      kiboPanel:
        'round(integrate(kibo-level-base*hobby*comprehension)+hero-inheritance)',
      integrate: 'floor(round(value*10000)/10000)',
    },
    policy: {
      unknownSourcesApplied: false,
      ambiguousSubAttributesApplied: false,
      effectSoulessenceSkillsAppliedToStaticPanel: false,
      effectAccessorySetSkillsAppliedToStaticPanel: false,
      compiledOutputsPersisted: false,
    },
    attributeDefinitions,
    attributeGroups: propertySourceSnapshot.attributeGroups,
    actor: {
      profiles: actorProfiles,
      levelGrowth: actorLevelGrowth,
      starGifts: starGiftProfiles,
      favorability: favorabilityProfiles,
    },
    soulessences: soulessenceProfiles,
    equipment: equipmentProfiles,
    accessorySets,
    kibo: {
      profiles: kiboProfiles,
      levelGrowth: kiboLevelGrowth,
      hobbies,
      comprehensionGrades,
      intimacyLevels,
      inheritance,
    },
    identityAudit,
    sourceIdentity: relativeExternalPath(PROPERTY_SOURCES_PATH),
  };
}

function createStaticPropertyIdentityAudit({
  publicCharacters,
  publicKibos,
  verifiedHeroes,
  verifiedKibos,
  actorProfiles,
  kiboProfiles,
}) {
  const workbenchActors = new Map(
    (publicCharacters ?? []).map(item => [Number(item.id), item])
  );
  const workbenchKibos = new Map(
    (publicKibos ?? []).map(item => [Number(item.kiboId ?? item.id), item])
  );
  const verifiedActorIds = new Set(verifiedHeroes.map(item => Number(item.id)));
  const verifiedKiboIds = new Set(verifiedKibos.map(item => Number(item.id)));
  const actorProfileById = new Map(
    actorProfiles.map(item => [Number(item.characterId), item])
  );
  const kiboProfileById = new Map(
    kiboProfiles.map(item => [Number(item.kiboId), item])
  );
  const actors = [...new Set([...workbenchActors.keys(), ...verifiedActorIds])]
    .sort((left, right) => left - right)
    .map(id => ({
      id,
      name: workbenchActors.get(id)?.name ?? null,
      inWorkbenchCatalog: workbenchActors.has(id),
      inVerifiedCollectibleSet: verifiedActorIds.has(id),
      classification:
        workbenchActors.has(id) && verifiedActorIds.has(id)
          ? actorProfileById.get(id)?.applied
            ? 'applicable'
            : 'unresolved'
          : workbenchActors.has(id)
            ? 'non-current-public-directory'
            : 'not-exposed-in-current-workbench-catalog',
    }));
  const kibos = [...new Set([...workbenchKibos.keys(), ...verifiedKiboIds])]
    .sort((left, right) => left - right)
    .map(id => ({
      id,
      name: workbenchKibos.get(id)?.name ?? null,
      inWorkbenchCatalog: workbenchKibos.has(id),
      inVerifiedBattleSet: verifiedKiboIds.has(id),
      classification:
        workbenchKibos.has(id) && verifiedKiboIds.has(id)
          ? kiboProfileById.get(id)?.applied
            ? 'applicable'
            : 'unresolved'
          : workbenchKibos.has(id)
            ? 'non-current-public-directory'
            : 'not-exposed-in-current-workbench-catalog',
    }));
  return {
    status: 'verified-static-property-identity-audit-ready',
    workbenchActorCount: workbenchActors.size,
    verifiedActorCount: verifiedActorIds.size,
    workbenchKiboCount: workbenchKibos.size,
    verifiedKiboCount: verifiedKiboIds.size,
    actorClassifications: countValues(actors.map(item => item.classification)),
    kiboClassifications: countValues(kibos.map(item => item.classification)),
    actors,
    kibos,
  };
}

function parseAttributeEntries(value) {
  return [...parseBaseAttributes(value).entries()]
    .map(([id, amount]) => ({ id: Number(id), value: Number(amount) }))
    .filter(entry => Number.isFinite(entry.id) && Number.isFinite(entry.value))
    .sort((left, right) => left.id - right.id);
}

function sumAttributeEntryLists(lists) {
  const values = new Map();
  for (const entries of lists ?? []) {
    for (const entry of entries ?? []) {
      values.set(entry.id, (values.get(entry.id) ?? 0) + entry.value);
    }
  }
  return [...values.entries()]
    .map(([id, value]) => ({ id, value }))
    .sort((left, right) => left.id - right.id);
}

function parseIntegerList(value) {
  return String(value ?? '')
    .split(/[|,]/)
    .map(item => Number(String(item).split('#')[0]))
    .filter(Number.isInteger);
}

function createPackage({
  evidence,
  validation,
  mechanismEvidence,
  candidates,
  controlBindings,
  supportControlBindings,
  kiboProfiles,
  actorProfiles,
  enemyProfiles,
  spUnitContract,
  staticPropertyCatalog,
  tuningMechanicsCatalog,
  specialResourceCatalog,
  actionVariantGraph,
}) {
  const prepareControlBinding = binding => {
    const hits = createControlRuntimeHits(binding);
    const appliedEffectCount = binding.effects.filter(
      effect => effect.classification === 'applied'
    ).length;
    return {
      ...binding,
      hits,
      status:
        hits.length || appliedEffectCount
          ? 'verified-skill-control-mechanics-binding-applied'
          : 'verified-skill-control-mechanics-binding-unresolved',
      confidence: hits.length || appliedEffectCount ? 'high' : 'unresolved',
      applied: hits.length > 0 || appliedEffectCount > 0,
    };
  };
  const preparedControlBindings = controlBindings.map(prepareControlBinding);
  const preparedSupportControlBindings = supportControlBindings.map(
    prepareControlBinding
  );
  const preparedControlBySkillId = new Map(
    [...preparedControlBindings, ...preparedSupportControlBindings].map(
      binding => [binding.controlSkillId, binding]
    )
  );
  const battleEffectNodes = dedupeBy(
    preparedControlBindings.flatMap(binding =>
      binding.effectGraph.flatMap(root =>
        root.nodes.map(node => ({
          ...node,
          catalogIdentity: createBattleEffectCatalogIdentity(
            binding.controlSkillId,
            node.nodeIdentity
          ),
          dimensions: createPublishedEffectDimensions(node.dimensions),
        }))
      )
    ),
    node => node.catalogIdentity
  ).sort((left, right) =>
    left.catalogIdentity.localeCompare(right.catalogIdentity)
  );
  const actionMappings = candidates.map(candidate => {
    const control = preparedControlBySkillId.get(candidate.controlSkillId);
    const mechanicsMapping = createActionMapping(candidate, control);
    if (candidate.actionKind !== 'normal-attack') {
      return attachActionTimingContract(
        mechanicsMapping,
        createPublicActionTimingContract({
          candidate,
          mapping: mechanicsMapping,
          control,
        })
      );
    }
    const attackInputSegments = createAttackInputSegments(
      candidate,
      preparedControlBySkillId
    );
    const actionTiming =
      createAttackInputChainTimingContract(attackInputSegments);
    const mapping = attachActionTimingContract(mechanicsMapping, actionTiming);
    return {
      ...mapping,
      attackInputChainStatus:
        attackInputSegments.length > 0
          ? 'verified-attack-input-chain-classified'
          : 'verified-attack-input-chain-unresolved',
      attackInputSegments,
      attackInputSegmentCount: attackInputSegments.length,
      attackInputAppliedSegmentCount: attackInputSegments.filter(
        segment => segment.classification === 'applied'
      ).length,
      attackInputUnresolvedSegmentCount: attackInputSegments.filter(
        segment => segment.classification === 'unresolved'
      ).length,
    };
  });
  const actionBindings = actionMappings.flatMap(mapping => {
    const runtimeBindings =
      mapping.actionKind === 'normal-attack'
        ? (mapping.attackInputSegments ?? []).filter(
            segment => segment.classification === 'applied'
          )
        : mapping.classification === 'applied'
          ? [mapping]
          : [];
    return runtimeBindings.map(binding => ({
      identity: binding.identity,
      aggregateIdentity:
        mapping.actionKind === 'normal-attack' ? mapping.identity : null,
      ownerKind: mapping.ownerKind,
      ownerId: mapping.ownerId,
      ownerName: mapping.ownerName,
      sourceSkillId: mapping.sourceSkillId,
      sourceSkillName: mapping.sourceSkillName,
      actionVariantIndex: mapping.actionVariantIndex,
      actionVariantLabel: binding.label ?? mapping.actionVariantLabel,
      actionKind: mapping.actionKind,
      controlSkillId: binding.controlSkillId,
      selectedSubSkillIndex: binding.selectedSubSkillIndex,
      bindingKind:
        mapping.actionKind === 'normal-attack'
          ? 'hero-normal-attack-input-control'
          : mapping.bindingKind,
      bindingSourceIdentity:
        binding.sourceIdentity ?? mapping.bindingSourceIdentity,
      controlVariantSkillLevel:
        binding.controlVariantSkillLevel ?? mapping.controlVariantSkillLevel,
      controlVariantSourceIdentity:
        binding.controlVariantSourceIdentity ??
        mapping.controlVariantSourceIdentity,
      controlFrameRate: binding.controlFrameRate ?? mapping.controlFrameRate,
      hitCount: binding.hitCount ?? mapping.runtimeHitCount,
      effectCount: binding.effectCount ?? mapping.runtimeEffectCount ?? 0,
      selectedEffectIdentities:
        binding.selectedEffectIdentities ??
        mapping.selectedEffectIdentities ??
        [],
      ...(mapping.actionKind === 'normal-attack'
        ? {
            attackSequenceIndex: binding.sequenceIndex,
            attackSequenceTotal: binding.sequenceTotal,
          }
        : {}),
      status: 'verified-action-mechanics-binding-applied',
      confidence: 'high',
      applied: true,
    }));
  });
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
  for (const mapping of actionMappings) {
    for (const segment of mapping.attackInputSegments ?? []) {
      if (Number.isInteger(segment.controlSkillId)) {
        publishedControlSkillIds.add(segment.controlSkillId);
      }
    }
  }
  const packagedControlBindings = preparedControlBindings
    .filter(binding => publishedControlSkillIds.has(binding.controlSkillId))
    .map(createPublishedControlBinding);
  const supportControlSkillIds = new Set([
    ...(specialResourceCatalog.operationBindings ?? [])
      .map(operation => operation.controlSkillId)
      .filter(Number.isInteger),
    ...(actionVariantGraph.nodes ?? [])
      .map(node => node.controlSkillId)
      .filter(Number.isInteger),
  ]);
  const packagedControlSkillIds = new Set(
    packagedControlBindings.map(binding => binding.controlSkillId)
  );
  const packagedSupportControlBindings = dedupeBy(
    [...preparedControlBindings, ...preparedSupportControlBindings].filter(
      binding =>
        supportControlSkillIds.has(binding.controlSkillId) &&
        !packagedControlSkillIds.has(binding.controlSkillId)
    ),
    binding => binding.controlSkillId
  ).map(createPublishedControlBinding);
  const sourceFiles = [
    ['calculator', CALCULATOR_PATH],
    ['validator', VALIDATOR_PATH],
    ['evidence', EVIDENCE_PATH],
    ['mechanism-knowledge', MECHANISM_KNOWLEDGE_PATH],
    ['property-sources', PROPERTY_SOURCES_PATH],
    ['sp-recovery-sharing', SP_RECOVERY_SHARING_PATH],
    ['overlimit-mechanics', OVERLIMIT_MECHANICS_PATH],
    ['coefficient-ranges', COEFFICIENT_RANGES_PATH],
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
    ...Object.entries(STATIC_PROPERTY_TABLE_PATHS).map(([name, filePath]) => [
      `static-property-table-${name}`,
      filePath,
    ]),
  ].map(([id, filePath]) => ({
    id,
    sourceIdentity: relativeExternalPath(filePath),
    sha256: sha256File(filePath),
    bytes: fs.statSync(filePath).size,
  }));
  sourceFiles.push(...(specialResourceCatalog.evidenceSources ?? []));
  const packageHash = sha256(
    JSON.stringify({
      region: evidence.region,
      evidenceDate: evidence.date,
      sources: sourceFiles.map(source => [source.id, source.sha256]),
      actionMappings,
      actionBindings,
      controlBindings: packagedControlBindings,
      actionVariantControlBindings: packagedSupportControlBindings,
      actorProfiles,
      kiboProfiles,
      enemyProfiles,
      spUnitContract,
      mechanismEvidence,
      staticPropertyCatalog,
      tuningMechanicsCatalog,
      battleEffectNodes,
      specialResourceCatalog,
      actionVariantGraph,
    })
  );
  return {
    schemaVersion: 1,
    kind: 'azpr-verified-combat-mechanics-package',
    packageId: `azpr-${String(evidence.region).toLowerCase()}-${evidence.date}`,
    packageVersion: 11,
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
    mechanismEvidence,
    verifiedFindingIds: (evidence.findings ?? []).map(finding => finding.id),
    knownGaps: evidence.knownGaps ?? [],
    policy: {
      uniqueSourceRequired: true,
      completeFormulaInputsRequired: true,
      unresolvedBindingsApplied: false,
      cultivationEffectsApplied: false,
      verifiedLiteralBattleEffectsApplied: true,
      unsupportedEffectFunctionsRemainUnresolved: true,
      randomBranchesRequirePersistedRolls: true,
      spValueUnit: 'absolute-sp-points',
    },
    spUnitContract,
    staticPropertyCatalog,
    tuningMechanicsCatalog,
    specialResourceCatalog,
    actionVariantGraph,
    battleEffectCatalog: {
      schemaVersion: 1,
      kind: 'azpr-verified-battle-effect-node-catalog',
      status: 'verified-battle-effect-node-catalog-ready',
      nodes: battleEffectNodes,
      summary: {
        nodeCount: battleEffectNodes.length,
        kindCounts: countValues(battleEffectNodes.map(node => node.kind)),
        appliedNodeCount: battleEffectNodes.filter(
          node => node.classification === 'applied'
        ).length,
        verifiedZeroNodeCount: battleEffectNodes.filter(
          node => node.classification === 'verified-zero'
        ).length,
        unresolvedNodeCount: battleEffectNodes.filter(
          node => node.classification === 'unresolved'
        ).length,
      },
    },
    actionMappings,
    actionBindings,
    controlBindings: packagedControlBindings,
    actionVariantControlBindings: packagedSupportControlBindings,
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
      actionVariantSupportControlBindingCount:
        packagedSupportControlBindings.length,
      uniqueControlHitBindingCount: packagedControlBindings.reduce(
        (sum, binding) => sum + binding.hits.length,
        0
      ),
      appliedEffectBindingCount: packagedControlBindings.reduce(
        (sum, binding) =>
          sum +
          binding.effects.filter(effect => effect.classification === 'applied')
            .length,
        0
      ),
      verifiedZeroEffectBindingCount: packagedControlBindings.reduce(
        (sum, binding) =>
          sum +
          binding.effects.filter(
            effect => effect.classification === 'verified-zero'
          ).length,
        0
      ),
      unresolvedEffectBindingCount: packagedControlBindings.reduce(
        (sum, binding) =>
          sum +
          binding.effects.filter(
            effect => effect.classification === 'unresolved'
          ).length,
        0
      ),
      battleEffectNodeCount: battleEffectNodes.length,
      specialResourceProfileCount:
        specialResourceCatalog.summary.appliedProfileCount,
      specialResourceOperationCount:
        specialResourceCatalog.summary.appliedOperationCount,
      actionVariantNodeCount: actionVariantGraph.summary.nodeCount,
      actionVariantEdgeCount: actionVariantGraph.summary.appliedEdgeCount,
      kiboProfileCount: kiboProfiles.length,
      actorProfileCount: actorProfiles.length,
      enemyProfileCount: enemyProfiles.length,
      collectibleActorProfileCount:
        staticPropertyCatalog.identityAudit.verifiedActorCount,
      battleKiboProfileCount:
        staticPropertyCatalog.identityAudit.verifiedKiboCount,
      workbenchActorIdentityCount:
        staticPropertyCatalog.identityAudit.workbenchActorCount,
      workbenchKiboIdentityCount:
        staticPropertyCatalog.identityAudit.workbenchKiboCount,
      appliedEnemyProfileCount: enemyProfiles.filter(profile => profile.applied)
        .length,
      actorActionBindingCount: actionBindings.filter(
        binding => binding.ownerKind === 'actor'
      ).length,
      kiboActionBindingCount: actionBindings.filter(
        binding => binding.ownerKind === 'kibo'
      ).length,
      attackInputChainCount: actionMappings.filter(
        mapping => mapping.actionKind === 'normal-attack'
      ).length,
      attackInputSegmentCount: actionMappings.reduce(
        (sum, mapping) => sum + (mapping.attackInputSegments?.length ?? 0),
        0
      ),
      appliedAttackInputSegmentCount: actionMappings.reduce(
        (sum, mapping) =>
          sum +
          (mapping.attackInputSegments ?? []).filter(
            segment => segment.classification === 'applied'
          ).length,
        0
      ),
      unresolvedAttackInputSegmentCount: actionMappings.reduce(
        (sum, mapping) =>
          sum +
          (mapping.attackInputSegments ?? []).filter(
            segment => segment.classification === 'unresolved'
          ).length,
        0
      ),
      appliedAttackInputTimingCount: actionMappings.reduce(
        (sum, mapping) =>
          sum +
          (mapping.attackInputSegments ?? []).filter(
            segment => segment.effectiveDurationStatus === 'applied'
          ).length,
        0
      ),
      unresolvedAttackInputTimingCount: actionMappings.reduce(
        (sum, mapping) =>
          sum +
          (mapping.attackInputSegments ?? []).filter(
            segment => segment.effectiveDurationStatus !== 'applied'
          ).length,
        0
      ),
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
        hitIndex,
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
      frameCounts: variant.frameCounts,
      directElementReferenceCount: variant.directElementReferenceCount,
      bulletElementReferenceCount: variant.bulletElementReferenceCount,
      elementCount: variant.elementCount,
      runnableElementCount: variant.runnableElementCount,
      effectNodeCount: variant.effectNodeCount,
      runnableEffectCount: variant.runnableEffectCount,
      sourceIdentity: variant.sourceIdentity,
    })),
    hits: binding.hits,
    effects: binding.effects.map(createPublishedRuntimeEffectBinding),
    effectGraph: binding.effectGraph.map(root => ({
      ...root,
      nodeIdentities: root.nodes.map(node =>
        createBattleEffectCatalogIdentity(
          binding.controlSkillId,
          node.nodeIdentity
        )
      ),
      nodes: undefined,
    })),
    status: binding.status,
    confidence: binding.confidence,
    applied: binding.applied,
  };
}

function createBattleEffectCatalogIdentity(controlSkillId, nodeIdentity) {
  return `${controlSkillId}|${nodeIdentity}`;
}

function createPublishedRuntimeEffectBinding(effect) {
  return {
    ...effect,
    dimensions: createPublishedEffectDimensions(effect.dimensions),
  };
}

function createPublishedEffectDimensions(dimensions) {
  return Object.fromEntries(
    Object.entries(dimensions ?? {}).map(([dimension, value]) => [
      dimension,
      {
        status: value.status,
        sourceField: value.sourceField ?? null,
      },
    ])
  );
}

function createSemanticEffectCatalog({
  controlBindings,
  packageValue,
  battleTargetTypeContract,
}) {
  const publishedControlIds = new Set(
    packageValue.controlBindings.map(binding => binding.controlSkillId)
  );
  const publicActionByRawEffect = new Map();
  for (const mapping of packageValue.actionMappings) {
    const selectedEffectIdentities = new Set([
      ...(mapping.selectedEffectIdentities ?? []),
      ...(mapping.attackInputSegments ?? []).flatMap(
        segment => segment.selectedEffectIdentities ?? []
      ),
    ]);
    for (const effectIdentity of selectedEffectIdentities) {
      appendMapArray(publicActionByRawEffect, effectIdentity, {
        actionIdentity: mapping.identity,
        ownerKind: mapping.ownerKind,
        ownerId: mapping.ownerId,
        ownerName: mapping.ownerName,
        actionKind: mapping.actionKind,
        sourceSkillId: mapping.sourceSkillId,
        sourceSkillName: mapping.sourceSkillName,
      });
    }
  }

  const candidates = controlBindings
    .filter(binding => publishedControlIds.has(binding.controlSkillId))
    .flatMap(binding =>
      binding.effectGraph.flatMap(root => {
        const runtimeNodes = root.nodes.filter(isRuntimeEffectGraphNode);
        const triggers = createSemanticRootTriggerContracts(binding, root);
        return runtimeNodes.flatMap(node => {
          const rawEffects = binding.effects.filter(
            effect =>
              effect.graphIdentity === root.graphIdentity &&
              effect.pathId === node.pathId
          );
          return triggers.map(trigger =>
            createSemanticEffectCandidate({
              root,
              node,
              trigger,
              rawEffects,
              publicActionByRawEffect,
            })
          );
        });
      })
    );
  const grouped = new Map();
  for (const candidate of candidates) {
    const entries = grouped.get(candidate.semanticKey) ?? [];
    entries.push(candidate);
    grouped.set(candidate.semanticKey, entries);
  }
  const semanticEffects = [...grouped.values()]
    .map(mergeSemanticEffectCandidates)
    .sort((left, right) =>
      left.semanticIdentity.localeCompare(right.semanticIdentity, 'en', {
        numeric: true,
      })
    );
  return {
    schemaVersion: 1,
    kind: 'azpr-semantic-battle-effect-catalog',
    status: 'verified-semantic-battle-effect-catalog-ready',
    targetTypeContract: battleTargetTypeContract,
    semanticEffects,
  };
}

function isRuntimeEffectGraphNode(node) {
  if (
    [
      'property-change',
      'sp',
      'shield',
      'pack',
      'stack',
      'judgment',
      'inject',
    ].includes(node.kind)
  ) {
    return true;
  }
  if (node.kind !== 'damage') return false;
  return [5, 11].includes(Number(node.damage?.damageType)) || node.depth > 0;
}

function createSemanticRootTriggerContracts(binding, root) {
  if (root.referenceKind === 'bulletElements') {
    return [
      {
        kind: 'projectile-impact',
        resolution: 'runtime-dependent',
        startFrame: null,
        frameCount: null,
        behaviorPathId: null,
        target: {
          code: null,
          kind: 'runtime-hit-target',
          sourceField: 'skillResourceMaps[].bulletElements',
          enumName: null,
          enumMember: null,
          resolution: 'runtime-dependent',
          runtimeReason: 'runtime-target-from-projectile-collision',
          sourceIdentity: root.sourceIdentity,
        },
        reasons: [
          'runtime-trigger-projectile-collision-frame',
          'runtime-target-from-projectile-collision',
        ],
        sourceIdentity: root.sourceIdentity,
      },
    ];
  }
  const sourceTriggers = root.rootPathId
    ? (binding.semanticBehaviorTriggers?.get(root.rootPathId) ?? [])
    : [];
  if (sourceTriggers.length === 0) {
    return [
      {
        kind: 'battle-behavior-event',
        resolution: 'static-evidence-gap',
        startFrame: null,
        frameCount: null,
        behaviorPathId: null,
        target: {
          code: null,
          kind: 'unresolved',
          sourceField: null,
          enumName: null,
          enumMember: null,
          resolution: 'static-evidence-gap',
          runtimeReason: null,
          sourceIdentity: null,
        },
        reasons: [
          'effect-trigger-frame-static-evidence-gap',
          'effect-target-static-evidence-gap',
        ],
        sourceIdentity: root.sourceIdentity,
      },
    ];
  }
  return sourceTriggers.map(trigger => ({
    kind: 'battle-behavior-event',
    resolution: Number.isInteger(trigger.startFrame)
      ? 'static-resolved'
      : 'static-evidence-gap',
    startFrame: trigger.startFrame,
    frameCount: trigger.frameCount,
    behaviorPathId: trigger.behaviorPathId,
    target: trigger.target,
    reasons: [
      ...(Number.isInteger(trigger.startFrame)
        ? []
        : ['effect-trigger-frame-static-evidence-gap']),
      ...(trigger.target.resolution === 'static-evidence-gap'
        ? ['effect-target-static-evidence-gap']
        : trigger.target.runtimeReason
          ? [trigger.target.runtimeReason]
          : []),
    ],
    sourceIdentity: trigger.sourceIdentity,
  }));
}

function createSemanticEffectCandidate({
  root,
  node,
  trigger,
  rawEffects,
  publicActionByRawEffect,
}) {
  const relationPath = resolveEffectGraphRelationPath(root, node.nodeIdentity);
  const role = classifySemanticEffectRole(node, root);
  const target = resolveSemanticEffectTarget(node, trigger, rawEffects);
  const triggerKey =
    trigger.resolution === 'runtime-dependent'
      ? `runtime:${root.rootPathId ?? root.graphIdentity}`
      : trigger.behaviorPathId != null
        ? `${trigger.behaviorPathId}:${trigger.startFrame ?? 'missing'}`
        : 'static-evidence-gap';
  const semanticKey = [
    root.controlSkillId,
    root.mapIndex,
    node.pathId,
    triggerKey,
  ].join('|');
  const rawEffectIdentities = rawEffects.map(effect => effect.effectIdentity);
  const publicActions = dedupeBy(
    rawEffectIdentities.flatMap(
      identity => publicActionByRawEffect.get(identity) ?? []
    ),
    action => action.actionIdentity
  );
  const reasons = createSemanticEffectReasons({
    role,
    node,
    rawEffects,
    trigger,
    target,
  });
  const resolution = resolveSemanticPlacementResolution({ trigger, target });
  const classification = resolveSemanticMechanicClassification(
    role,
    node,
    rawEffects
  );
  return {
    semanticKey,
    semanticIdentity: `semantic-effect:${semanticKey}`,
    controlSkillId: root.controlSkillId,
    mapIndex: root.mapIndex,
    elementId: node.elementId,
    pathId: node.pathId,
    name: node.name,
    kind: node.kind,
    role,
    conditional: relationPath.some(edge =>
      [
        'triggerEffectList',
        'zeroEffectList',
        'finishEffectList',
        'injectElementDataList_1',
        'injectElementDataList_2',
        'injectElementDataEffects',
      ].includes(edge.relation)
    ),
    relationPath,
    trigger,
    target,
    placementResolution: resolution,
    staticallyResolvable: resolution === 'static-resolved',
    lifecycle: {
      durationMs: resolveSemanticEffectDuration(node, relationPath, root),
      tags: node.lifecycle.tags,
      combineType: node.lifecycle.combineType,
      maxCount: node.lifecycle.maxCount,
    },
    classification,
    dimensions: createPublishedEffectDimensions(node.dimensions),
    reasons,
    rawEffectIdentities,
    graphIdentities: [root.graphIdentity],
    rootBattleIdentities: [root.rootPathId],
    battleIdentities: [node.pathId],
    sourceIdentities: dedupeBy(
      [node.sourceIdentity, root.sourceIdentity, trigger.sourceIdentity].filter(
        Boolean
      ),
      value => value
    ),
    publicActions,
    calculationMultiplicity: resolveSemanticCalculationMultiplicity(target),
  };
}

function classifySemanticEffectRole(node, root) {
  if (node.tuningMark || node.tuningOverlimit) return 'gameplay-effect';
  if (node.kind === 'judgment') return 'condition';
  const hasChildren = root.edges.some(
    edge => edge.from === node.nodeIdentity && edge.status.includes('resolved')
  );
  if (['inject', 'pack'].includes(node.kind)) return 'wrapper';
  if (node.kind === 'stack' && hasChildren) return 'wrapper';
  return 'gameplay-effect';
}

function resolveSemanticEffectTarget(node, trigger, rawEffects) {
  const appliedTarget = rawEffects.find(effect =>
    ['team-tuning-pool', 'enemy'].includes(effect.target?.kind)
  )?.target;
  if (node.tuningMark || node.tuningOverlimit) {
    return {
      ...(appliedTarget ?? { kind: 'unresolved', code: null }),
      resolution: appliedTarget ? 'static-resolved' : 'static-evidence-gap',
      enumName: null,
      enumMember: null,
      sourceField: 'verified-tuning-mechanics',
      runtimeReason: null,
    };
  }
  if (node.kind === 'sp') {
    return {
      kind: 'source-owner',
      code: null,
      resolution: 'static-resolved',
      enumName: null,
      enumMember: 'SpElement.Execute.source',
      sourceField: 'SpElement.Execute.source',
      runtimeReason: null,
      sourceIdentity: node.sourceIdentity,
    };
  }
  return trigger.target;
}

function createSemanticEffectReasons({
  role,
  node,
  rawEffects,
  trigger,
  target,
}) {
  const reasons = [
    ...node.reasons,
    ...rawEffects.flatMap(effect => effect.reasons),
  ]
    .map(normalizeSemanticEffectReason)
    .filter(Boolean)
    .filter(reason => !reason.startsWith('effect-target-'))
    .filter(reason => reason !== 'effect-trigger-frame-missing')
    .filter(
      reason =>
        role !== 'wrapper' ||
        reason !== 'inject-wrapper-classified-through-child-edges'
    );
  reasons.push(...trigger.reasons);
  if (
    target.resolution === 'static-evidence-gap' &&
    !reasons.includes('effect-target-static-evidence-gap')
  ) {
    reasons.push('effect-target-static-evidence-gap');
  }
  if (target.runtimeReason) reasons.push(target.runtimeReason);
  if (role === 'wrapper') reasons.push('semantic-wrapper-not-gameplay-effect');
  if (role === 'condition') {
    reasons.push('semantic-condition-not-standalone-gameplay-effect');
  }
  return dedupeBy(reasons, value => value);
}

function normalizeSemanticEffectReason(reason) {
  return (
    {
      'pack-state-machine-deferred-to-m8-c':
        'pack-lifecycle-runtime-unimplemented',
      'stack-state-machine-deferred-to-m8-c':
        'stack-lifecycle-runtime-unimplemented',
      'judgment-state-machine-deferred-to-m8-c':
        'judgment-condition-runtime-unimplemented',
      'nested-effect-wrapper-semantics-unresolved':
        'wrapper-condition-semantics-unresolved',
      'nested-damage-trigger-lifecycle-not-expanded':
        'nested-damage-runtime-family-unimplemented',
    }[reason] ?? reason
  );
}

function resolveSemanticPlacementResolution({ trigger, target }) {
  if (
    trigger.resolution === 'runtime-dependent' ||
    target.resolution === 'runtime-dependent'
  ) {
    return 'runtime-dependent';
  }
  if (
    trigger.resolution === 'static-evidence-gap' ||
    target.resolution === 'static-evidence-gap'
  ) {
    return 'static-evidence-gap';
  }
  return 'static-resolved';
}

function resolveSemanticMechanicClassification(role, node, rawEffects) {
  if (role !== 'gameplay-effect') return 'structural';
  if (rawEffects.some(effect => effect.classification === 'applied')) {
    return 'applied';
  }
  if (
    rawEffects.length > 0 &&
    rawEffects.every(effect => effect.classification === 'verified-zero')
  ) {
    return 'verified-zero';
  }
  return node.classification === 'verified-zero'
    ? 'verified-zero'
    : 'unresolved';
}

function resolveSemanticEffectDuration(node, relationPath, root) {
  const ancestors = relationPath
    .map(edge =>
      root.nodes.find(candidate => candidate.nodeIdentity === edge.from)
    )
    .filter(Boolean);
  return resolveEffectDurationMs(node, ancestors);
}

function resolveSemanticCalculationMultiplicity(target) {
  const groupTargets = new Set([
    'team-actors',
    'team-kibos',
    'all-entities-without-self',
  ]);
  if (groupTargets.has(target.kind)) {
    return {
      mode: 'per-recipient-runtime-copy',
      semanticRecordCount: 1,
      runtimeCopyCount: 'resolved-at-runtime',
    };
  }
  return {
    mode:
      target.resolution === 'runtime-dependent'
        ? 'runtime-selected-recipient'
        : 'single-semantic-target',
    semanticRecordCount: 1,
    runtimeCopyCount: target.resolution === 'runtime-dependent' ? 1 : null,
  };
}

function mergeSemanticEffectCandidates(candidates) {
  const first = candidates[0];
  const rawEffectIdentities = dedupeBy(
    candidates.flatMap(candidate => candidate.rawEffectIdentities),
    value => value
  );
  const publicActions = dedupeBy(
    candidates.flatMap(candidate => candidate.publicActions),
    action => action.actionIdentity
  ).sort((left, right) =>
    left.actionIdentity.localeCompare(right.actionIdentity, 'en', {
      numeric: true,
    })
  );
  const classifications = candidates.map(candidate => candidate.classification);
  return {
    ...first,
    graphIdentities: dedupeBy(
      candidates.flatMap(candidate => candidate.graphIdentities),
      value => value
    ).sort(),
    rootBattleIdentities: dedupeBy(
      candidates.flatMap(candidate => candidate.rootBattleIdentities),
      value => value
    ).sort(),
    battleIdentities: dedupeBy(
      candidates.flatMap(candidate => candidate.battleIdentities),
      value => value
    ).sort(),
    sourceIdentities: dedupeBy(
      candidates.flatMap(candidate => candidate.sourceIdentities),
      value => value
    ).sort(),
    rawEffectIdentities,
    rawEffectBindingCount: rawEffectIdentities.length,
    collapsedCandidateCount: candidates.length,
    publicActions,
    owners: dedupeBy(
      publicActions.map(action => ({
        ownerKind: action.ownerKind,
        ownerId: action.ownerId,
        ownerName: action.ownerName,
      })),
      owner => `${owner.ownerKind}:${owner.ownerId}`
    ),
    reasons: dedupeBy(
      candidates.flatMap(candidate => candidate.reasons),
      value => value
    ),
    classification: classifications.includes('applied')
      ? 'applied'
      : classifications.includes('unresolved')
        ? 'unresolved'
        : classifications.includes('verified-zero')
          ? 'verified-zero'
          : 'structural',
  };
}

function createPublicActionTimingContract({ candidate, mapping, control }) {
  const variantTimings = (control?.variants ?? []).map(variant =>
    createControlVariantTimingContract({
      control,
      variant,
      actionKind: candidate.actionKind,
    })
  );
  const selected = variantTimings.find(
    timing => timing.subSkillIndex === mapping.selectedSubSkillIndex
  );
  if (selected) {
    return createSelectedActionTimingContract({
      actionKind: candidate.actionKind,
      control,
      selected,
      variantTimings,
      sourceKind: 'selected-skill-control-player-variant',
    });
  }
  const appliedVariants = variantTimings.filter(
    timing => timing.occupancy.status === 'applied'
  );
  const uniqueDurations = [
    ...new Set(appliedVariants.map(timing => timing.occupancy.durationFrames)),
  ];
  if (
    variantTimings.length > 0 &&
    appliedVariants.length === variantTimings.length &&
    uniqueDurations.length === 1
  ) {
    const representative = appliedVariants[0];
    return createSelectedActionTimingContract({
      actionKind: candidate.actionKind,
      control,
      selected: {
        ...representative,
        occupancy: {
          ...representative.occupancy,
          sourceKind: 'invariant-across-control-player-variants',
          sourceIdentity: appliedVariants
            .map(timing => timing.occupancy.sourceIdentity)
            .join('|'),
        },
      },
      variantTimings,
      sourceKind: 'invariant-across-control-player-variants',
    });
  }
  return createUnresolvedActionTimingContract({
    actionKind: candidate.actionKind,
    control,
    variantTimings,
    reasons: [
      variantTimings.length === 0
        ? 'skill-control-player-variant-missing'
        : appliedVariants.length !== variantTimings.length
          ? 'control-player-variant-duration-unresolved'
          : 'control-player-variant-duration-not-invariant',
    ],
  });
}

function createControlVariantTimingContract({
  control,
  variant,
  actionKind,
  occupancyResolver = resolveStandaloneActionOccupancy,
  occupancyContext = {},
}) {
  const frameRate = positiveNumberOrNull(control?.frameRate) ?? 60;
  const selectedAnimationFrame = resolveDefaultFrameCount(variant.frameCounts);
  const animation = selectedAnimationFrame
    ? {
        startFrame: 0,
        endFrame: selectedAnimationFrame.frameCount,
        durationFrames: selectedAnimationFrame.frameCount,
        frameRate,
        status: 'applied',
        sourceKind: 'skill-control-player-animation-range',
        sourceIdentity: `${variant.sourceIdentity}.frameCountDict[key=${selectedAnimationFrame.key}]`,
        conversion: `${selectedAnimationFrame.frameCount} source frames at ${frameRate}fps`,
      }
    : {
        startFrame: 0,
        endFrame: null,
        durationFrames: null,
        frameRate,
        status: 'unresolved',
        sourceKind: 'skill-control-player-animation-range',
        sourceIdentity: variant.sourceIdentity,
        conversion: null,
      };
  const hits = (control?.hits ?? [])
    .filter(hit => hit.mapIndex === variant.subSkillIndex)
    .map(hit => ({
      hitIdentity: hit.hitIdentity,
      elementId: hit.elementId,
      pathId: hit.pathId,
      frame: nonNegativeIntegerOrNull(hit.trigger?.startFrame),
      sourceIdentity: hit.trigger?.sourceIdentity ?? hit.sourceIdentity,
    }))
    .filter(hit => hit.frame != null)
    .sort(
      (left, right) =>
        left.frame - right.frame ||
        left.hitIdentity.localeCompare(right.hitIdentity)
    );
  const windows = normalizeActionTimingWindows(variant.eventBridges);
  const occupancy = occupancyResolver({
    actionKind,
    animation,
    hits,
    windows,
    variant,
    ...occupancyContext,
  });
  const holdDurationMs = positiveNumberOrNull(
    control?.logic?.holdTriggerTimeMs
  );
  const inputMode =
    control?.logic?.inputTriggerType === 1 && holdDurationMs != null
      ? 'hold'
      : 'press';
  return {
    schemaVersion: 1,
    subSkillIndex: variant.subSkillIndex,
    playerSkillId: variant.playerSkillId,
    frameRate,
    input: {
      mode: inputMode,
      pressFrame: 0,
      holdDurationMs: inputMode === 'hold' ? holdDurationMs : null,
      holdFrames:
        inputMode === 'hold'
          ? Math.round((holdDurationMs / 1000) * frameRate)
          : null,
      status:
        control?.logic?.inputTriggerType == null ? 'unresolved' : 'applied',
      sourceIdentity: control?.logic?.sourceIdentity
        ? `${control.logic.sourceIdentity}.inputTriggerType|${control.logic.sourceIdentity}.holdTriggerTime`
        : null,
    },
    occupancy,
    animation,
    hits,
    hitEnvelope: createHitEnvelope(hits),
    windows,
    cooldown: createActionTimingCooldown(control?.logic),
    sourceIdentity: variant.sourceIdentity,
  };
}

function resolveStandaloneActionOccupancy({ animation }) {
  if (animation.status !== 'applied') {
    return createUnresolvedOccupancy('skill-control-animation-range-missing', {
      sourceIdentity: animation.sourceIdentity,
      frameRate: animation.frameRate,
    });
  }
  if (animation.durationFrames === 1) {
    return createUnresolvedOccupancy(
      'one-frame-public-action-requires-explicit-instant-evidence',
      {
        sourceIdentity: animation.sourceIdentity,
        frameRate: animation.frameRate,
      }
    );
  }
  return {
    startFrame: 0,
    endFrame: animation.durationFrames,
    durationFrames: animation.durationFrames,
    frameRate: animation.frameRate,
    status: 'applied',
    sourceKind: 'skill-control-player-action-range',
    sourceIdentity: animation.sourceIdentity,
    conversion: animation.conversion,
    reasons: [],
  };
}

function createUnresolvedOccupancy(reason, { sourceIdentity, frameRate } = {}) {
  return {
    startFrame: 0,
    endFrame: null,
    durationFrames: null,
    frameRate: frameRate ?? null,
    status: 'unresolved',
    sourceKind: 'unresolved-action-occupancy',
    sourceIdentity: sourceIdentity ?? null,
    conversion: null,
    reasons: [reason],
  };
}

function normalizeActionTimingWindows(bridges = []) {
  return dedupeBy(
    (bridges ?? [])
      .map(bridge => {
        const startFrame = nonNegativeIntegerOrNull(bridge.startFrame);
        const endFrame = nonNegativeIntegerOrNull(bridge.endFrame);
        if (startFrame == null || endFrame == null || endFrame <= startFrame) {
          return null;
        }
        return {
          kind: classifyActionTimingWindow(bridge),
          startFrame,
          endFrame,
          durationFrames: endFrame - startFrame,
          targetControlSkillId: positiveIntegerOrNull(bridge.targetSkillId),
          allowAttack: Boolean(bridge.allowAttack),
          baseOnInput: Boolean(bridge.baseOnInput),
          inputToIndex: Boolean(bridge.inputToIndex),
          bridgeType: nonNegativeIntegerOrNull(bridge.bridgeType),
          continuousAttackType: nonNegativeIntegerOrNull(
            bridge.continuousAttackType
          ),
          sourceIdentity: bridge.sourceIdentity,
        };
      })
      .filter(Boolean),
    window =>
      [
        window.kind,
        window.startFrame,
        window.endFrame,
        window.targetControlSkillId,
        window.bridgeType,
        window.continuousAttackType,
      ].join('|')
  ).sort(
    (left, right) =>
      left.startFrame - right.startFrame ||
      left.endFrame - right.endFrame ||
      left.sourceIdentity.localeCompare(right.sourceIdentity)
  );
}

function classifyActionTimingWindow(bridge) {
  if (positiveIntegerOrNull(bridge.targetSkillId)) {
    return bridge.baseOnInput || bridge.inputToIndex
      ? 'input-derived-window'
      : 'control-transition-window';
  }
  if (bridge.allowAttack) return 'attack-reopen-window';
  return 'cancel-or-derived-window';
}

function createHitEnvelope(hits) {
  if (!hits.length) {
    return {
      firstFrame: null,
      lastFrame: null,
      status: 'unresolved',
      sourceIdentities: [],
    };
  }
  return {
    firstFrame: hits[0].frame,
    lastFrame: hits.at(-1).frame,
    status: 'applied',
    sourceIdentities: hits.map(hit => hit.sourceIdentity),
  };
}

function createActionTimingCooldown(logic) {
  const cooldownMs = nonNegativeNumberOrNull(logic?.cooldownMs);
  return {
    cooldownMs,
    chargeCount: positiveIntegerOrNull(logic?.cooldownCount),
    status: cooldownMs == null ? 'unresolved' : 'applied',
    sourceIdentity: logic?.sourceIdentity
      ? `${logic.sourceIdentity}.coolDown|${logic.sourceIdentity}.coolDownCount`
      : null,
  };
}

function createSelectedActionTimingContract({
  actionKind,
  control,
  selected,
  variantTimings,
  sourceKind,
}) {
  return {
    schemaVersion: 1,
    kind: 'azpr-public-action-timing',
    actionKind,
    controlSkillId: control?.controlSkillId ?? null,
    selectedSubSkillIndex: selected.subSkillIndex,
    frameRate: selected.frameRate,
    input: selected.input,
    occupancy: selected.occupancy,
    animation: selected.animation,
    hits: selected.hits,
    hitEnvelope: selected.hitEnvelope,
    windows: selected.windows,
    cooldown: selected.cooldown,
    variantTimings,
    status: selected.occupancy.status,
    sourceKind,
    sourceIdentity: selected.occupancy.sourceIdentity,
    reasons: selected.occupancy.reasons ?? [],
  };
}

function createUnresolvedActionTimingContract({
  actionKind,
  control,
  variantTimings,
  reasons,
}) {
  return {
    schemaVersion: 1,
    kind: 'azpr-public-action-timing',
    actionKind,
    controlSkillId: control?.controlSkillId ?? null,
    selectedSubSkillIndex: null,
    frameRate: positiveNumberOrNull(control?.frameRate) ?? 60,
    input: createControlInputTrigger(control?.logic),
    occupancy: createUnresolvedOccupancy(reasons[0], {
      sourceIdentity: control?.sourcePath ?? null,
      frameRate: positiveNumberOrNull(control?.frameRate) ?? 60,
    }),
    animation: {
      startFrame: 0,
      endFrame: null,
      durationFrames: null,
      status: 'unresolved',
      sourceIdentity: control?.sourcePath ?? null,
    },
    hits: [],
    hitEnvelope: createHitEnvelope([]),
    windows: [],
    cooldown: createActionTimingCooldown(control?.logic),
    variantTimings,
    status: 'unresolved',
    sourceKind: 'unresolved-action-occupancy',
    sourceIdentity: control?.sourcePath ?? null,
    reasons,
  };
}

function attachActionTimingContract(mapping, actionTiming) {
  const mechanicsClassification = mapping.classification;
  const timingReady = actionTiming.status === 'applied';
  return {
    ...mapping,
    mechanicsClassification,
    actionTiming,
    timingStatus: actionTiming.status,
    classification: timingReady ? mechanicsClassification : 'unresolved',
    runtimeReady: timingReady && mapping.runtimeReady,
    complete: timingReady && mapping.complete,
    reasons: dedupeBy(
      [
        ...(mapping.reasons ?? []),
        ...(timingReady ? [] : actionTiming.reasons),
      ],
      value => value
    ),
  };
}

function createAttackInputChainTimingContract(segments) {
  const timingReady =
    segments.length > 0 &&
    segments.every(segment => segment.durationStatus === 'applied');
  const durationFrames = timingReady
    ? segments.reduce(
        (sum, segment) =>
          sum + segment.durationFrames + (segment.defaultLinkDelayFrames ?? 0),
        0
      )
    : null;
  return {
    schemaVersion: 1,
    kind: 'azpr-normal-attack-input-chain-timing',
    status: timingReady ? 'applied' : 'unresolved',
    frameRate: segments[0]?.controlFrameRate ?? 60,
    input: {
      mode: 'press',
      inputCount: segments.length,
      status: segments.length ? 'applied' : 'unresolved',
    },
    occupancy: {
      startFrame: 0,
      endFrame: durationFrames,
      durationFrames,
      status: timingReady ? 'applied' : 'unresolved',
      sourceKind: 'normal-attack-input-segment-chain',
      sourceIdentity: timingReady
        ? segments.map(segment => segment.durationSourceIdentity).join('|')
        : null,
      reasons: timingReady
        ? []
        : ['normal-attack-input-segment-duration-unresolved'],
    },
    segmentCount: segments.length,
    reasons: timingReady
      ? []
      : ['normal-attack-input-segment-duration-unresolved'],
  };
}

function createAttackInputSegments(candidate, controlBySkillId) {
  const inputs = candidate.attackInputControls ?? [];
  const segments = inputs.map((input, segmentIndex) => {
    const control = controlBySkillId.get(input.controlSkillId);
    const mapping = createActionMapping(
      {
        ...candidate,
        controlSkillId: input.controlSkillId,
        bindingKind: 'hero-normal-attack-input-control',
        bindingSourceIdentity: input.sourceIdentity,
        attackInputControls: undefined,
      },
      control
    );
    const selectedHitIdentities = mapping.selectedHitIdentities ?? [];
    const selectedEffectIdentities = mapping.selectedEffectIdentities ?? [];
    const timing = resolveAttackInputSegmentTiming(
      control,
      mapping.selectedSubSkillIndex,
      {
        nextControlSkillId: inputs[segmentIndex + 1]?.controlSkillId ?? null,
        selectedHitIdentities,
      }
    );
    const mechanicsClassification = mapping.classification;
    const timingReady = timing.status === 'applied';
    return {
      identity: `${mapping.identity}|attack-input-${input.sequenceIndex}`,
      sequenceIndex: input.sequenceIndex,
      sequenceTotal: input.sequenceTotal,
      label: `A${input.sequenceIndex}`,
      controlSkillId: input.controlSkillId,
      selectedSubSkillIndex: mapping.selectedSubSkillIndex,
      playerSkillId:
        control?.variants?.find(
          variant => variant.subSkillIndex === mapping.selectedSubSkillIndex
        )?.playerSkillId ?? null,
      resourceMapIndex: mapping.selectedSubSkillIndex,
      controlFrameRate: mapping.controlFrameRate,
      controlVariantSkillLevel: mapping.controlVariantSkillLevel,
      controlVariantSourceIdentity: mapping.controlVariantSourceIdentity,
      inputTrigger: mapping.inputTrigger,
      animationDurationFrames: timing.animationDurationFrames,
      animationDurationStatus: timing.animationDurationStatus,
      animationDurationSourceIdentity: timing.animationDurationSourceIdentity,
      hitEndFrame: timing.hitEndFrame,
      hitEndSourceIdentity: timing.hitEndSourceIdentity,
      effectiveDurationFrames: timing.effectiveDurationFrames,
      effectiveDurationStatus: timing.effectiveDurationStatus,
      durationFrames: timing.durationFrames,
      durationStatus: timing.status,
      durationBasis: timing.durationBasis,
      durationSourceIdentity: timing.sourceIdentity,
      defaultLinkDelayFrames: timing.effectiveDurationFrames == null ? null : 0,
      linkWindow: timing.linkWindow,
      linkWindows: timing.linkWindows,
      linkTimingStatus: timing.linkTimingStatus,
      linkTimingReasons: timing.linkTimingReasons,
      actionTiming: timing.actionTiming,
      variantTimings: timing.variantTimings,
      selectedHitIdentities,
      selectedEffectIdentities,
      hitCount: mapping.runtimeHitCount ?? 0,
      effectCount: mapping.runtimeEffectCount ?? 0,
      effectDimensionSummary: mapping.effectDimensionSummary,
      mechanicsClassification,
      classification: timingReady ? mechanicsClassification : 'unresolved',
      runtimeReady: timingReady && mapping.runtimeReady,
      reasons: dedupeBy(
        [...(mapping.reasons ?? []), ...(timingReady ? [] : timing.reasons)],
        value => value
      ),
      sourceIdentity: `${input.sourceIdentity}|${control?.sourcePath ?? 'skill-control-missing'}`,
    };
  });
  const hitOwners = new Map();
  for (const segment of segments) {
    for (const hitIdentity of segment.selectedHitIdentities) {
      if (hitOwners.has(hitIdentity)) {
        throw new Error(
          `normal attack hit ${hitIdentity} belongs to multiple input segments: ${hitOwners.get(hitIdentity)} and ${segment.identity}`
        );
      }
      hitOwners.set(hitIdentity, segment.identity);
    }
  }
  return segments;
}

function resolveAttackInputSegmentTiming(
  control,
  selectedSubSkillIndex,
  { nextControlSkillId = null, selectedHitIdentities = [] } = {}
) {
  const variantTimings = (control?.variants ?? []).map(variant =>
    createControlVariantTimingContract({
      control,
      variant,
      actionKind: 'normal-attack',
      occupancyResolver: resolveNormalAttackInputOccupancy,
      occupancyContext: { nextControlSkillId },
    })
  );
  const selectedVariantTiming = variantTimings.find(
    timing => timing.subSkillIndex === selectedSubSkillIndex
  );
  const appliedVariants = variantTimings.filter(
    timing => timing.occupancy.status === 'applied'
  );
  const uniqueOccupancyDurations = [
    ...new Set(appliedVariants.map(timing => timing.occupancy.durationFrames)),
  ];
  const invariantVariantTiming =
    !selectedVariantTiming &&
    variantTimings.length > 0 &&
    appliedVariants.length === variantTimings.length &&
    uniqueOccupancyDurations.length === 1
      ? appliedVariants[0]
      : null;
  const resolvedVariantTiming = selectedVariantTiming ?? invariantVariantTiming;
  const selectedHitSet = new Set(selectedHitIdentities);
  const selectedHits = resolvedVariantTiming
    ? resolvedVariantTiming.hits.filter(
        hit => selectedHitSet.size === 0 || selectedHitSet.has(hit.hitIdentity)
      )
    : [];
  const hitEnvelope = createHitEnvelope(selectedHits);
  const occupancy = resolvedVariantTiming?.occupancy ?? null;
  const timingReady = occupancy?.status === 'applied';
  const unresolvedReason =
    variantTimings.length === 0
      ? 'skill-control-player-variant-missing'
      : selectedSubSkillIndex != null
        ? 'selected-control-player-variant-duration-unresolved'
        : appliedVariants.length !== variantTimings.length
          ? 'control-player-variant-duration-unresolved'
          : 'control-player-variant-duration-not-invariant';
  const reasons = timingReady
    ? []
    : dedupeBy(
        [
          unresolvedReason,
          ...(occupancy?.reasons ?? []),
          ...variantTimings.flatMap(timing => timing.occupancy.reasons ?? []),
        ],
        value => value
      );
  const actionTiming = timingReady
    ? createSelectedActionTimingContract({
        actionKind: 'normal-attack',
        control,
        selected: resolvedVariantTiming,
        variantTimings,
        sourceKind: selectedVariantTiming
          ? 'selected-skill-control-player-variant'
          : 'invariant-across-control-player-variants',
      })
    : createUnresolvedActionTimingContract({
        actionKind: 'normal-attack',
        control,
        variantTimings,
        reasons,
      });
  const linkWindow = timingReady ? (occupancy.linkWindow ?? null) : null;
  const linkWindows = resolvedVariantTiming
    ? selectNormalAttackInputWindows(
        resolvedVariantTiming.windows,
        nextControlSkillId
      )
    : [];
  return {
    animationDurationFrames:
      resolvedVariantTiming?.animation.durationFrames ?? null,
    animationDurationStatus:
      resolvedVariantTiming?.animation.status ?? 'unresolved',
    animationDurationSourceIdentity:
      resolvedVariantTiming?.animation.sourceIdentity ?? null,
    hitEndFrame: hitEnvelope.lastFrame,
    hitEndSourceIdentity: hitEnvelope.sourceIdentities.at(-1) ?? null,
    effectiveDurationFrames: timingReady ? occupancy.durationFrames : null,
    effectiveDurationStatus: timingReady ? 'applied' : 'unresolved',
    durationFrames: timingReady ? occupancy.durationFrames : null,
    status: timingReady ? 'applied' : 'unresolved',
    durationBasis: timingReady
      ? occupancy.sourceKind
      : 'unresolved-action-occupancy',
    sourceIdentity: timingReady ? occupancy.sourceIdentity : null,
    linkWindow,
    linkWindows,
    linkTimingStatus: timingReady ? 'applied' : 'unresolved',
    linkTimingReasons: reasons,
    reasons,
    actionTiming,
    variantTimings,
  };
}

function resolveNormalAttackInputOccupancy({
  animation,
  hits,
  windows,
  nextControlSkillId,
}) {
  const matchingWindows = selectNormalAttackInputWindows(
    windows,
    nextControlSkillId
  );
  const linkWindow = matchingWindows[0] ?? null;
  if (!linkWindow) {
    return createUnresolvedOccupancy(
      nextControlSkillId
        ? 'next-control-event-bridge-window-unavailable'
        : 'attack-reopen-event-bridge-window-unavailable',
      {
        sourceIdentity: animation.sourceIdentity,
        frameRate: animation.frameRate,
      }
    );
  }
  const finalHitFrame = hits.at(-1)?.frame ?? null;
  const occupancyEndFrame = Math.max(
    linkWindow.startFrame,
    finalHitFrame ?? linkWindow.startFrame
  );
  if (occupancyEndFrame > linkWindow.endFrame) {
    return createUnresolvedOccupancy('input-window-ends-before-final-hit', {
      sourceIdentity: linkWindow.sourceIdentity,
      frameRate: animation.frameRate,
    });
  }
  if (occupancyEndFrame <= 1) {
    return createUnresolvedOccupancy(
      'one-frame-public-action-requires-explicit-instant-evidence',
      {
        sourceIdentity: linkWindow.sourceIdentity,
        frameRate: animation.frameRate,
      }
    );
  }
  return {
    startFrame: 0,
    endFrame: occupancyEndFrame,
    durationFrames: occupancyEndFrame,
    frameRate: animation.frameRate,
    status: 'applied',
    sourceKind: nextControlSkillId
      ? 'next-control-input-window'
      : 'attack-reopen-window',
    sourceIdentity: linkWindow.sourceIdentity,
    conversion: `${occupancyEndFrame} source frames at ${animation.frameRate}fps`,
    reasons: [],
    linkWindow,
  };
}

function selectNormalAttackInputWindows(windows, nextControlSkillId) {
  return (windows ?? []).filter(window =>
    nextControlSkillId
      ? window.targetControlSkillId === nextControlSkillId
      : window.allowAttack
  );
}

function resolveDefaultFrameCount(frameCounts) {
  const values = (frameCounts ?? [])
    .map(value => ({
      key: Number(value?.key),
      frameCount: Math.max(0, Number(value?.frameCount) || 0),
    }))
    .filter(value => value.frameCount > 0);
  return values.find(value => value.key === 0) ?? values[0] ?? null;
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
    inputTrigger: createControlInputTrigger(control?.logic),
  };
  if (!candidate.bindingEligible || !control) {
    return {
      ...base,
      selectedSubSkillIndex: null,
      linked: false,
      runtimeReady: false,
      runtimeHitCount: 0,
      runtimeEffectCount: 0,
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
      runtimeEffectCount: 0,
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
  const runtimeEffects = control.effects.filter(
    effect => effect.mapIndex === selectedSubSkillIndex
  );
  const appliedEffects = runtimeEffects.filter(
    effect => effect.classification === 'applied'
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
    runtimeHits.length > 0 || hasAppliedCost || appliedEffects.length > 0
      ? 'applied'
      : allRelevantZero && spCost === 0
        ? 'verified-zero'
        : 'unresolved';
  const unresolvedReasons = dedupeBy(
    [
      ...blockingUnresolved.flatMap(element => element.issues),
      ...runtimeEffects
        .filter(effect => effect.classification === 'unresolved')
        .flatMap(effect => effect.reasons),
    ],
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
    runtimeEffectCount: appliedEffects.length,
    selectedElementCount: selectedElements.length,
    selectedHitIdentities: runtimeHits.map(hit => hit.hitIdentity),
    selectedEffectIdentities: runtimeEffects.map(
      effect => effect.effectIdentity
    ),
    classification,
    complete: unresolvedReasons.length === 0,
    reasons: unresolvedReasons,
    dimensionSummary: summarizeDimensions(selectedElements),
    effectDimensionSummary: summarizeEffectDimensions(runtimeEffects),
  };
}

function summarizeEffectDimensions(effects) {
  const result = {};
  for (const dimension of [
    'damage',
    'toughness',
    'sp',
    'hp',
    'shield',
    'dynamicProperty',
    'mark',
  ]) {
    result[dimension] = countValues(
      effects.map(effect => effect.dimensions?.[dimension]?.status)
    );
  }
  return result;
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
    inputTriggerType: integerOrNull(row.inputTriggerType),
    holdTriggerTimeMs: finiteNumberOrNull(row.holdTriggerTime),
    sourceIdentity: `NewTable/skillsub_logic.rows[skillId=${row.skillId}]`,
    status: 'verified-skill-logic-ready',
    applied: true,
  };
}

function createControlInputTrigger(logic) {
  const triggerType = integerOrNull(logic?.inputTriggerType);
  if (triggerType == null) return null;
  const holdTriggerTimeMs = Math.max(
    0,
    finiteNumberOrNull(logic?.holdTriggerTimeMs) ?? 0
  );
  return {
    triggerType,
    triggerTypeName:
      triggerType === 0
        ? 'Down'
        : triggerType === 1
          ? 'Press'
          : triggerType === 2
            ? 'Up'
            : 'Unknown',
    mode: triggerType === 1 && holdTriggerTimeMs > 0 ? 'hold' : 'press',
    holdTriggerTimeMs,
    sourceKind: 'azpr-skillsub-logic-input-trigger',
    sourceIdentity: `${logic.sourceIdentity}.inputTriggerType|${logic.sourceIdentity}.holdTriggerTime`,
    status: 'verified-input-trigger-ready',
    confidence: 'high',
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
    .map(([name, value]) => `export const ${name}=${runtimeLiteral(value)};`)
    .join('\n')}\n`;
}

function runtimeLiteral(value) {
  if (typeof value !== 'string') return JSON.stringify(value);
  return `'${value
    .replaceAll('\\', '\\\\')
    .replaceAll(String.fromCharCode(39), String.fromCharCode(92, 39))}'`;
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
  staticPropertyCatalog,
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
    mechanismEvidence: packageValue.mechanismEvidence,
    staticPropertyIdentityAudit: staticPropertyCatalog.identityAudit,
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
      appliedEffectBindingCount: packageValue.summary.appliedEffectBindingCount,
      verifiedZeroEffectBindingCount:
        packageValue.summary.verifiedZeroEffectBindingCount,
      unresolvedEffectBindingCount:
        packageValue.summary.unresolvedEffectBindingCount,
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

function createActionTimingCoverageReport(packageValue) {
  const actionTimings = packageValue.actionMappings.map(mapping =>
    createActionTimingCoverageRow({
      identity: mapping.identity,
      rowKind: 'public-action',
      ownerKind: mapping.ownerKind,
      ownerId: mapping.ownerId,
      ownerName: mapping.ownerName,
      actionKind: mapping.actionKind,
      sourceSkillId: mapping.sourceSkillId,
      sourceSkillName: mapping.sourceSkillName,
      controlSkillId: mapping.controlSkillId,
      timing: mapping.actionTiming,
      sourceIdentity: mapping.bindingSourceIdentity,
    })
  );
  const attackInputSegments = packageValue.actionMappings.flatMap(mapping =>
    (mapping.attackInputSegments ?? []).map(segment =>
      createActionTimingCoverageRow({
        identity: segment.identity,
        rowKind: 'normal-attack-input-segment',
        ownerKind: mapping.ownerKind,
        ownerId: mapping.ownerId,
        ownerName: mapping.ownerName,
        actionKind: mapping.actionKind,
        sourceSkillId: mapping.sourceSkillId,
        sourceSkillName: mapping.sourceSkillName,
        controlSkillId: segment.controlSkillId,
        sequenceIndex: segment.sequenceIndex,
        sequenceTotal: segment.sequenceTotal,
        timing: segment.actionTiming,
        sourceIdentity: segment.sourceIdentity,
      })
    )
  );
  const publicVariants = packageValue.actionMappings.flatMap(mapping =>
    (mapping.publicVariants ?? []).map(variant => {
      const selected =
        Number(variant.index) === Number(mapping.actionVariantIndex);
      return {
        identity: `${mapping.identity}|public-variant-${variant.index}`,
        actionIdentity: mapping.identity,
        ownerKind: mapping.ownerKind,
        ownerId: mapping.ownerId,
        ownerName: mapping.ownerName,
        actionKind: mapping.actionKind,
        sourceSkillId: mapping.sourceSkillId,
        publicVariantIndex: variant.index,
        publicVariantLabel: variant.label,
        selected,
        status: selected ? mapping.timingStatus : 'unresolved',
        durationFrames: selected
          ? (mapping.actionTiming?.occupancy?.durationFrames ?? null)
          : null,
        sourceIdentity: variant.sourceIdentity,
        reasons: selected
          ? (mapping.actionTiming?.reasons ?? [])
          : ['public-variant-action-timing-association-missing'],
      };
    })
  );
  const controlVariants = packageValue.actionMappings.flatMap(mapping =>
    (mapping.actionTiming?.variantTimings ?? []).map(variant => ({
      identity: `${mapping.identity}|control-variant-${variant.subSkillIndex}`,
      actionIdentity: mapping.identity,
      ownerKind: mapping.ownerKind,
      ownerId: mapping.ownerId,
      ownerName: mapping.ownerName,
      actionKind: mapping.actionKind,
      controlSkillId: mapping.controlSkillId,
      subSkillIndex: variant.subSkillIndex,
      playerSkillId: variant.playerSkillId,
      status: variant.occupancy?.status ?? 'unresolved',
      durationFrames: variant.occupancy?.durationFrames ?? null,
      sourceKind:
        variant.occupancy?.sourceKind ?? 'unresolved-action-occupancy',
      sourceIdentity:
        variant.occupancy?.sourceIdentity ?? variant.sourceIdentity,
      reasons: variant.occupancy?.reasons ?? [],
      input: variant.input,
      occupancy: variant.occupancy,
      animation: variant.animation,
      hitEnvelope: variant.hitEnvelope,
      windows: variant.windows,
      cooldown: variant.cooldown,
    }))
  );
  const timingRows = [...actionTimings, ...attackInputSegments];
  const oneFrameRows = [...timingRows, ...controlVariants].filter(
    row => row.durationFrames === 1
  );
  const abnormalLongRows = [...timingRows, ...controlVariants].filter(
    row => Number(row.durationFrames) > 600
  );
  const unresolvedRows = timingRows.filter(row => row.status !== 'applied');
  const byOwnerActionKindSourceStatus = [
    ...groupBy(
      actionTimings,
      row =>
        `${row.ownerKind}|${row.actionKind}|${row.sourceKind}|${row.status}`
    ).entries(),
  ]
    .map(([key, rows]) => {
      const [ownerKind, actionKind, sourceKind, status] = key.split('|');
      return {
        ownerKind,
        actionKind,
        sourceKind,
        status,
        count: rows.length,
      };
    })
    .sort(
      (left, right) =>
        left.ownerKind.localeCompare(right.ownerKind) ||
        left.actionKind.localeCompare(right.actionKind) ||
        left.sourceKind.localeCompare(right.sourceKind) ||
        left.status.localeCompare(right.status)
    );
  return {
    schemaVersion: 1,
    kind: 'azpr-verified-combat-action-timing-coverage',
    status: 'verified-combat-action-timing-coverage-ready',
    packageId: packageValue.packageId,
    packageHash: packageValue.packageHash,
    sourceDenominator: {
      kind: 'current-client-public-actor-and-kibo-action-catalogs',
      publicActionCount: actionTimings.length,
      publicVariantCount: publicVariants.length,
      normalAttackInputSegmentCount: attackInputSegments.length,
      controlPlayerVariantCount: controlVariants.length,
    },
    summary: {
      appliedActionCount: actionTimings.filter(row => row.status === 'applied')
        .length,
      unresolvedActionCount: actionTimings.filter(
        row => row.status !== 'applied'
      ).length,
      appliedAttackInputSegmentCount: attackInputSegments.filter(
        row => row.status === 'applied'
      ).length,
      unresolvedAttackInputSegmentCount: attackInputSegments.filter(
        row => row.status !== 'applied'
      ).length,
      appliedPublicVariantCount: publicVariants.filter(
        row => row.status === 'applied'
      ).length,
      unresolvedPublicVariantCount: publicVariants.filter(
        row => row.status !== 'applied'
      ).length,
      oneFrameCount: oneFrameRows.length,
      abnormalLongCount: abnormalLongRows.length,
      unresolvedReasonCounts: countValues(
        unresolvedRows.flatMap(row => row.reasons)
      ),
    },
    byOwnerActionKindSourceStatus,
    actions: actionTimings,
    attackInputSegments,
    publicVariants,
    controlVariants,
    unresolved: unresolvedRows,
    oneFrame: oneFrameRows,
    abnormalLong: abnormalLongRows,
  };
}

function createActionTimingCoverageRow({ timing, ...identity }) {
  const occupancy = timing?.occupancy ?? null;
  return {
    ...identity,
    status: timing?.status ?? occupancy?.status ?? 'unresolved',
    durationFrames: occupancy?.durationFrames ?? null,
    frameRate: timing?.frameRate ?? occupancy?.frameRate ?? null,
    sourceKind:
      occupancy?.sourceKind ??
      timing?.sourceKind ??
      'unresolved-action-occupancy',
    sourceIdentity:
      occupancy?.sourceIdentity ??
      timing?.sourceIdentity ??
      identity.sourceIdentity ??
      null,
    reasons: timing?.reasons ?? occupancy?.reasons ?? [],
    input: timing?.input ?? null,
    occupancy,
    animation: timing?.animation ?? null,
    hitEnvelope: timing?.hitEnvelope ?? null,
    hitFrames: (timing?.hits ?? []).map(hit => hit.frame),
    windows: timing?.windows ?? [],
    cooldown: timing?.cooldown ?? null,
  };
}

function createActionTimingCoverageMarkdown(report) {
  const lines = [
    '# M9-A 全动作时长与输入占轴审计',
    '',
    `- 包：\`${report.packageId}\``,
    `- 公开动作：${report.sourceDenominator.publicActionCount}（已确认 ${report.summary.appliedActionCount}，未解析 ${report.summary.unresolvedActionCount}）`,
    `- 公开变体：${report.sourceDenominator.publicVariantCount}（已确认 ${report.summary.appliedPublicVariantCount}，未解析 ${report.summary.unresolvedPublicVariantCount}）`,
    `- 普攻输入段：${report.sourceDenominator.normalAttackInputSegmentCount}（已确认 ${report.summary.appliedAttackInputSegmentCount}，未解析 ${report.summary.unresolvedAttackInputSegmentCount}）`,
    `- SkillControl/player 变体：${report.sourceDenominator.controlPlayerVariantCount}`,
    `- 一帧占轴：${report.summary.oneFrameCount}`,
    `- 异常长占轴（>600f）：${report.summary.abnormalLongCount}`,
    '',
    '## Owner / 动作类型 / 来源状态',
    '',
    '| Owner | 动作类型 | 占轴来源 | 状态 | 数量 |',
    '| --- | --- | --- | --- | ---: |',
    ...report.byOwnerActionKindSourceStatus.map(
      row =>
        `| ${row.ownerKind} | ${row.actionKind} | ${row.sourceKind} | ${row.status} | ${row.count} |`
    ),
    '',
    '## 未解析占轴',
    '',
  ];
  if (report.unresolved.length === 0) {
    lines.push('- 无。');
  } else {
    for (const item of report.unresolved) {
      lines.push(
        `- \`${item.identity}\`：${item.reasons.join('、') || 'action-occupancy-unresolved'}`
      );
    }
  }
  lines.push('', '## 一帧与异常长占轴', '');
  if (report.oneFrame.length === 0 && report.abnormalLong.length === 0) {
    lines.push('- 无。');
  } else {
    for (const item of report.oneFrame) {
      lines.push(
        `- 一帧：\`${item.identity}\`（${item.sourceIdentity ?? '无来源'}）`
      );
    }
    for (const item of report.abnormalLong) {
      lines.push(
        `- 异常长：\`${item.identity}\`，${item.durationFrames}f（${item.sourceIdentity ?? '无来源'}）`
      );
    }
  }
  lines.push(
    '',
    '> 动作占轴、动画、命中、输入/派生窗口和冷却分别记录；命中帧与冷却不得作为动作块时长兜底。'
  );
  return `${lines.join('\n')}\n`;
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
  const attackInputChains = packageValue.actionMappings
    .filter(mapping => mapping.actionKind === 'normal-attack')
    .map(mapping => ({
      actionIdentity: mapping.identity,
      ownerId: mapping.ownerId,
      ownerName: mapping.ownerName,
      sourceSkillId: mapping.sourceSkillId,
      sequenceTotal: mapping.attackInputSegments?.length ?? 0,
      appliedSegmentCount: mapping.attackInputAppliedSegmentCount ?? 0,
      unresolvedSegmentCount: mapping.attackInputUnresolvedSegmentCount ?? 0,
      segments: mapping.attackInputSegments ?? [],
    }));
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
      attackInputChainCount: attackInputChains.length,
      attackInputSegmentCount: attackInputChains.reduce(
        (sum, chain) => sum + chain.sequenceTotal,
        0
      ),
      appliedAttackInputSegmentCount: attackInputChains.reduce(
        (sum, chain) => sum + chain.appliedSegmentCount,
        0
      ),
      unresolvedAttackInputSegmentCount: attackInputChains.reduce(
        (sum, chain) => sum + chain.unresolvedSegmentCount,
        0
      ),
      appliedAttackInputTimingCount: attackInputChains.reduce(
        (sum, chain) =>
          sum +
          chain.segments.filter(
            segment => segment.effectiveDurationStatus === 'applied'
          ).length,
        0
      ),
      unresolvedAttackInputTimingCount: attackInputChains.reduce(
        (sum, chain) =>
          sum +
          chain.segments.filter(
            segment => segment.effectiveDurationStatus !== 'applied'
          ).length,
        0
      ),
    },
    byOwnerActionKind,
    byOwner,
    missingRequiredActorActions,
    unresolvedActions,
    unresolvedReferences,
    publicVariantCoverage,
    controlVariantCoverage,
    nonzeroRecoveryCoverage,
    attackInputChains,
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
    `- 普攻输入链：${report.summary.attackInputChainCount} 条 / ${report.summary.attackInputSegmentCount} 个输入段（可运行 ${report.summary.appliedAttackInputSegmentCount}，未解析 ${report.summary.unresolvedAttackInputSegmentCount}）`,
    `- 普攻输入时序：已确认 ${report.summary.appliedAttackInputTimingCount}，未确认 ${report.summary.unresolvedAttackInputTimingCount}`,
    '',
    '## 普攻输入链',
    '',
    '| 角色 | 输入段 | 可运行 | 未解析 | control |',
    '| --- | ---: | ---: | ---: | --- |',
    ...report.attackInputChains.map(
      chain =>
        `| ${chain.ownerName ?? chain.ownerId} | ${chain.sequenceTotal} | ${chain.appliedSegmentCount} | ${chain.unresolvedSegmentCount} | ${chain.segments.map(segment => segment.controlSkillId).join(' / ')} |`
    ),
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

function createActionVariantResourceCoverageReport(packageValue) {
  const catalog = packageValue.specialResourceCatalog;
  const graph = packageValue.actionVariantGraph;
  const owners = catalog.profiles.map(profile => {
    const operations = catalog.operationBindings.filter(
      operation => operation.ownerId === profile.ownerId
    );
    const edges = graph.edges.filter(edge => edge.ownerId === profile.ownerId);
    return {
      ownerId: profile.ownerId,
      ownerName: profile.ownerName,
      resourceIdentity: profile.resourceIdentity,
      resourceName: profile.name,
      capacity: profile.capacity,
      initialValue: profile.initialValue,
      stateElements: profile.stateElements,
      operationSummary: countValues(
        operations.map(operation =>
          operation.applied
            ? operation.operation
            : `unresolved:${operation.operation}`
        )
      ),
      actionVariantSummary: {
        total: edges.length,
        applied: edges.filter(edge => edge.applied).length,
        unresolved: edges.filter(edge => !edge.applied).length,
        resourceConditioned: edges.filter(
          edge => edge.condition?.resourceIdentity
        ).length,
      },
      unresolvedOperations: operations.filter(operation => !operation.applied),
      unresolvedVariantEdges: edges.filter(edge => !edge.applied),
    };
  });
  return {
    schemaVersion: 1,
    kind: 'azpr-verified-action-variant-resource-coverage',
    status: 'verified-action-variant-resource-coverage-ready',
    packageId: packageValue.packageId,
    packageHash: packageValue.packageHash,
    summary: {
      ...catalog.summary,
      ...graph.summary,
    },
    owners,
    unresolvedOwners: catalog.unresolvedOwners,
  };
}

function createActionVariantResourceCoverageMarkdown(report) {
  const lines = [
    '# Verified Action Variant And Resource Coverage',
    '',
    `- Package: \`${report.packageId}\``,
    `- Resource profiles: ${report.summary.appliedProfileCount}/${report.summary.profileCount}`,
    `- Resource operations: ${report.summary.appliedOperationCount}/${report.summary.operationCount}`,
    `- Variant edges: ${report.summary.appliedEdgeCount}/${report.summary.edgeCount}`,
    `- Variant nodes: ${report.summary.nodeCount}`,
    '',
    '| Owner | Resource | Capacity | Operations | Variant edges |',
    '| --- | --- | ---: | --- | ---: |',
    ...report.owners.map(owner => {
      const operations = Object.entries(owner.operationSummary)
        .map(([key, value]) => `${key}=${value}`)
        .join(', ');
      return `| ${owner.ownerName ?? owner.ownerId} (${owner.ownerId}) | ${owner.resourceName} | ${owner.capacity ?? 'unresolved'} | ${operations || '-'} | ${owner.actionVariantSummary.applied}/${owner.actionVariantSummary.total} |`;
    }),
    '',
    '## Unresolved summary',
    '',
  ];
  const unresolved = [
    ...report.unresolvedOwners.map(owner => ({
      identity: `owner:${owner.ownerId}`,
      reasons: [owner.reason],
    })),
    ...report.owners.flatMap(owner => [
      ...owner.unresolvedOperations.map(operation => ({
        identity: operation.operationIdentity,
        reasons: operation.reasons,
      })),
      ...owner.unresolvedVariantEdges.map(edge => ({
        identity: edge.edgeIdentity,
        reasons: edge.reasons,
      })),
    ]),
  ];
  const reasonCounts = countValues(
    unresolved.flatMap(item => item.reasons ?? ['unresolved'])
  );
  lines.push(
    ...(unresolved.length
      ? Object.entries(reasonCounts).map(
          ([reason, count]) => `- ${reason}: ${count}`
        )
      : ['- None.']),
    '',
    'Complete unresolved identities and source evidence are retained in `verified-action-variant-resource-coverage.json`.'
  );
  return `${lines.join('\n')}\n`;
}

function createEffectCoverageReport(packageValue) {
  const effectByIdentity = new Map(
    packageValue.controlBindings.flatMap(binding =>
      binding.effects.map(effect => [effect.effectIdentity, effect])
    )
  );
  const actions = packageValue.actionMappings.map(mapping => {
    const selectedIdentities = new Set([
      ...(mapping.selectedEffectIdentities ?? []),
      ...(mapping.attackInputSegments ?? []).flatMap(
        segment => segment.selectedEffectIdentities ?? []
      ),
    ]);
    const effects = [...selectedIdentities]
      .map(identity => effectByIdentity.get(identity))
      .filter(Boolean);
    return {
      actionIdentity: mapping.identity,
      ownerKind: mapping.ownerKind,
      ownerId: mapping.ownerId,
      ownerName: mapping.ownerName,
      actionKind: mapping.actionKind,
      sourceSkillId: mapping.sourceSkillId,
      sourceSkillName: mapping.sourceSkillName,
      effectBindingCount: effects.length,
      appliedEffectCount: effects.filter(
        effect => effect.classification === 'applied'
      ).length,
      verifiedZeroEffectCount: effects.filter(
        effect => effect.classification === 'verified-zero'
      ).length,
      unresolvedEffectCount: effects.filter(
        effect => effect.classification === 'unresolved'
      ).length,
      dimensions: Object.fromEntries(
        [
          'damage',
          'toughness',
          'sp',
          'hp',
          'shield',
          'dynamicProperty',
          'mark',
        ].map(dimension => [
          dimension,
          countValues(
            effects.map(effect => effect.dimensions?.[dimension]?.status)
          ),
        ])
      ),
      effectIdentities: effects.map(effect => effect.effectIdentity),
    };
  });
  const effects = [...effectByIdentity.values()];
  const unresolved = effects
    .filter(effect => effect.classification === 'unresolved')
    .map(effect => ({
      effectIdentity: effect.effectIdentity,
      controlSkillId: effect.controlSkillId,
      mapIndex: effect.mapIndex,
      elementId: effect.elementId,
      kind: effect.kind,
      dimensions: Object.fromEntries(
        Object.entries(effect.dimensions ?? {}).map(([dimension, value]) => [
          dimension,
          value.status,
        ])
      ),
      reasons: effect.reasons,
      sourceIdentity: effect.sourceIdentity,
    }));
  const graphNodes = packageValue.battleEffectCatalog?.nodes ?? [];
  return {
    schemaVersion: 1,
    kind: 'azpr-verified-combat-effect-coverage',
    status: 'verified-combat-effect-coverage-ready',
    packageId: packageValue.packageId,
    packageHash: packageValue.packageHash,
    sourceDenominator: {
      kind: 'current-client-public-action-control-battle-element-graph',
      actionCount: actions.length,
      controlCount: packageValue.controlBindings.length,
      directRootCount: packageValue.controlBindings.reduce(
        (sum, binding) => sum + binding.effectGraph.length,
        0
      ),
      graphNodeCount: graphNodes.length,
    },
    summary: {
      effectBindingCount: effects.length,
      appliedEffectBindingCount: effects.filter(
        effect => effect.classification === 'applied'
      ).length,
      verifiedZeroEffectBindingCount: effects.filter(
        effect => effect.classification === 'verified-zero'
      ).length,
      unresolvedEffectBindingCount: unresolved.length,
      kindCounts: countValues(graphNodes.map(node => node.kind)),
      bindingKindCounts: countValues(effects.map(effect => effect.kind)),
      unresolvedReasonCounts: countValues(
        unresolved.flatMap(effect => effect.reasons)
      ),
      dimensions: Object.fromEntries(
        [
          'damage',
          'toughness',
          'sp',
          'hp',
          'shield',
          'dynamicProperty',
          'mark',
        ].map(dimension => [
          dimension,
          countValues(
            effects.map(effect => effect.dimensions?.[dimension]?.status)
          ),
        ])
      ),
    },
    actions,
    unresolved,
  };
}

function createEffectCoverageMarkdown(report) {
  const lines = [
    '# M8-B Battle 效果覆盖',
    '',
    `- 包：\`${report.packageId}\``,
    `- 公开动作：${report.sourceDenominator.actionCount}`,
    `- 控制：${report.sourceDenominator.controlCount}`,
    `- 直接元素根：${report.sourceDenominator.directRootCount}`,
    `- 效果图节点：${report.sourceDenominator.graphNodeCount}`,
    `- 效果绑定：${report.summary.effectBindingCount}`,
    `- 可计算：${report.summary.appliedEffectBindingCount}`,
    `- 明确零：${report.summary.verifiedZeroEffectBindingCount}`,
    `- 未解析：${report.summary.unresolvedEffectBindingCount}`,
    '',
    '## 元素类型',
    '',
    ...Object.entries(report.summary.kindCounts).map(
      ([kind, count]) => `- ${kind}: ${count}`
    ),
    '',
    '## 未解析原因',
    '',
    ...Object.entries(report.summary.unresolvedReasonCounts).map(
      ([reason, count]) => `- ${reason}: ${count}`
    ),
    '',
    '> 只有真实触发帧、唯一目标且公式输入可安全解释的维度进入运行时；其余逐项来源见同名 JSON。',
  ];
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
      // Generated source contains nested single-quoted runtime literals.
      // eslint-disable-next-line quotes
      `raw = applyFactor(raw, bonus, 'auto_sp_bonus', trace);`,
      // eslint-disable-next-line quotes
      `raw = applyFactor(raw, bonus, 'auto_sp_bonus', trace, { attributeKeys: ['SPGETUP', 'SPRET_AUTO'], legacyAlias: input.spRetAuto == null && input.spGetUpAuto != null ? 'SPGETUP_AUTO' : null });`
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

function finiteNumberOrNull(value) {
  const number = Number(value);
  return value != null && value !== '' && Number.isFinite(number)
    ? number
    : null;
}

function positiveNumberOrNull(value) {
  const number = Number(value);
  return value != null && value !== '' && Number.isFinite(number) && number > 0
    ? number
    : null;
}

function nonNegativeNumberOrNull(value) {
  const number = Number(value);
  return value != null && value !== '' && Number.isFinite(number) && number >= 0
    ? number
    : null;
}

function nonNegativeIntegerOrNull(value) {
  const number = Number(value);
  return value != null &&
    value !== '' &&
    Number.isInteger(number) &&
    number >= 0
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
