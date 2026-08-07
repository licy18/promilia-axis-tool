#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  createCombatSourceDisplayLabel,
  createEffectSourceDisplayLabel,
  isSourceDisplayTextSafe,
} from '../src/domain/sourceDisplayText.js';
import { VERIFIED_EFFECT_SOURCE_SEQUENCE_CONTRACT_NAME } from '../src/domain/verifiedEffectSourceSequence.js';
import { createCharacterCombatOutputRecords } from './character-combat/character-combat-profile-pipeline.mjs';
import { createCharacterCombatStatDependencies } from './character-combat/character-combat-contract-compiler.mjs';
import { createCharacterCombatGoldenRuntime } from './character-combat/character-combat-golden-runtime.mjs';
import {
  augmentCharacterCombatActionCandidates,
  collectCharacterCombatRequiredControlSkillIds,
  createCharacterCombatControlPolicyIndex,
  createCharacterCombatProductionBuild,
  discoverCharacterCombatRecipes,
} from './character-combat/character-combat-production-orchestrator.mjs';
import {
  applyCharacterCombatProductBoundaries,
  assertUnnamedSecondaryPassiveRuntimeIsolation,
  createCharacterCombatProductBoundaryMarkdown,
  discoverUnnamedSecondaryPassiveBoundaries,
} from './character-combat/character-combat-product-boundaries.mjs';

const SCRIPT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_ROOT, '..');
const AZPR_ROOT = 'C:\\PC2\\Codex\\AzPr';
const BATTLE_ROOT =
  'C:\\Codex\\AzPr Extractor\\ExtractedAssets\\Unity\\default_package\\ResourcesAssets\\Config\\Battle';
const HERO_SUBSKILL_ROOT =
  'C:\\Codex\\AzPr Extractor\\ExtractedAssets\\Unity\\default_package\\Program\\Battle\\Character\\Config\\Hero';
const PET_SUBSKILL_ROOT =
  'C:\\Codex\\AzPr Extractor\\ExtractedAssets\\Unity\\default_package\\Program\\Battle\\Character\\Config\\Pet';
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
const CHARACTER_COMBAT_RECIPE_ROOT = path.join(
  SCRIPT_ROOT,
  'character-combat',
  'profile-recipes'
);
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
const XIAOYU_ACTION_OCCUPANCY_JSON_OUTPUT = path.join(
  REPO_ROOT,
  'reports',
  'm9-r3-r2-xiaoyu-action-occupancy-audit.json'
);
const XIAOYU_ACTION_OCCUPANCY_MARKDOWN_OUTPUT = path.join(
  REPO_ROOT,
  'reports',
  'm9-r3-r2-xiaoyu-action-occupancy-audit.md'
);
const XIAOYU_HIDDEN_INPUT_JSON_OUTPUT = path.join(
  REPO_ROOT,
  'reports',
  'm9-r3-r2-r2-xiaoyu-hidden-input-audit.json'
);
const XIAOYU_HIDDEN_INPUT_MARKDOWN_OUTPUT = path.join(
  REPO_ROOT,
  'reports',
  'm9-r3-r2-r2-xiaoyu-hidden-input-audit.md'
);
const CONTEXTUAL_INPUT_SCHEDULING_JSON_OUTPUT = path.join(
  REPO_ROOT,
  'reports',
  'm9-r3-r2-r3-contextual-input-scheduling-audit.json'
);
const CONTEXTUAL_INPUT_SCHEDULING_MARKDOWN_OUTPUT = path.join(
  REPO_ROOT,
  'reports',
  'm9-r3-r2-r3-contextual-input-scheduling-audit.md'
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
const DERIVED_CONTROL_COVERAGE_JSON_OUTPUT = path.join(
  REPO_ROOT,
  'reports',
  'verified-derived-control-coverage.json'
);
const DERIVED_CONTROL_COVERAGE_MARKDOWN_OUTPUT = path.join(
  REPO_ROOT,
  'reports',
  'verified-derived-control-coverage.md'
);
const SWITCH_TRIGGER_COVERAGE_JSON_OUTPUT = path.join(
  REPO_ROOT,
  'reports',
  'verified-switch-trigger-coverage.json'
);
const SWITCH_TRIGGER_COVERAGE_MARKDOWN_OUTPUT = path.join(
  REPO_ROOT,
  'reports',
  'verified-switch-trigger-coverage.md'
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
const PUBLIC_RUNTIME_COVERAGE_JSON_OUTPUT = path.join(
  REPO_ROOT,
  'reports',
  'verified-public-runtime-coverage.json'
);
const PUBLIC_RUNTIME_COVERAGE_MARKDOWN_OUTPUT = path.join(
  REPO_ROOT,
  'reports',
  'verified-public-runtime-coverage.md'
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
const GAME_ASSEMBLY_PATH =
  'C:\\AP\\AzurPromilia_TC\\AzurPromilia_game\\GameAssembly.dll';
const TUNING_CONSUME_PRIORITY_EVIDENCE_PATH = path.join(
  SCRIPT_ROOT,
  'evidence',
  'tuning-consume-priority-runtime-evidence.json'
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
const bulletInjectionContractCache = new Map();
const unityObjectFileIndexCache = new Map();
let externalGameplayObjectFileIndexCache = null;
let petExternalGameplayObjectFileIndexCache = null;
// element_formula.json aliases: id 4 and id 110 both resolve to
// `source.ATK[0]*A/10000`, so function 110 is a supported damage base.
const SUPPORTED_BASE_FUNCTION_IDS = new Set([2, 101, 110, 116, 119]);

function resolveElementFormulaInputs(tree) {
  const formulaParams = tree?.formulaParams;
  const hasFormulaParams =
    formulaParams != null &&
    !(
      Number(formulaParams.function_1) === 0 &&
      Number(formulaParams.function_2) === 0 &&
      (formulaParams.formulaParamValues?.length ?? 0) === 0
    );
  return {
    commonFunctionId: hasFormulaParams
      ? integerOrNull(formulaParams.function_1)
      : integerOrNull(tree?.baseIntParams?.[0]),
    baseFunctionId: hasFormulaParams
      ? integerOrNull(formulaParams.function_2)
      : integerOrNull(tree?.baseIntParams?.[1]),
    values: hasFormulaParams
      ? formulaParams.formulaParamValues ?? []
      : tree?.functionParams ?? [],
  };
}
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
const M9_PRODUCT_DENOMINATOR = Object.freeze({
  publicActionCount: 563,
  actorOwnerCount: 20,
  kiboOwnerCount: 122,
});
const DEFAULT_CHARACTER_COMBAT_RECIPES = discoverCharacterCombatRecipes({
  recipeRoot: CHARACTER_COMBAT_RECIPE_ROOT,
});
let tuningConsumePriorityRuntimeEvidenceCache = null;
const XIAOYU_PROFILE_RECIPE = DEFAULT_CHARACTER_COMBAT_RECIPES.find(
  recipe => recipe.goldStandard === true
);
if (!XIAOYU_PROFILE_RECIPE) {
  throw new Error('gold standard character combat recipe missing');
}
const XIAOYU_MECHANICS = Object.freeze(
  XIAOYU_PROFILE_RECIPE.mechanicsDiscovery
);
const XIAOYU_SYSTEM_CONTROL_SKILL_IDS = new Set([
  80102, 10800115, 10900115, 10900125,
]);
const SWITCH_SKILL_SLOT_CONTRACTS = Object.freeze([
  Object.freeze({
    slot: 201,
    triggerPhase: 'on-exit',
    enumName: 'ExitSkill',
    label: '退场',
  }),
  Object.freeze({
    slot: 203,
    triggerPhase: 'on-enter',
    enumName: 'EnterSkill',
    label: '入场',
  }),
]);
if (isDirectExecution()) {
  await runCli();
}

export async function createVerifiedCombatMechanicsBuild({
  recipes: recipeOverrides,
} = {}) {
  const discoveredRecipes =
    recipeOverrides ??
    discoverCharacterCombatRecipes({
      recipeRoot: CHARACTER_COMBAT_RECIPE_ROOT,
    });
  assertRequiredInputs();
  const seed = readJson(path.join(GENERATED_ROOT, 'workbench-seed.json'));
  const characterCatalog = readJson(CHARACTER_CATALOG_PATH);
  const productBoundaryReport = discoverUnnamedSecondaryPassiveBoundaries({
    characterCatalog,
    skills: seed.gameData?.skills ?? [],
  });
  if (
    productBoundaryReport.status !== 'unnamed-secondary-passive-boundary-ready'
  ) {
    throw new Error(
      `character combat product boundary incomplete: ${JSON.stringify(
        productBoundaryReport.unresolved
      )}`
    );
  }
  const productBoundaryMarkdown = createCharacterCombatProductBoundaryMarkdown(
    productBoundaryReport
  );
  const recipes = applyCharacterCombatProductBoundaries({
    recipes: discoveredRecipes,
    boundaryReport: productBoundaryReport,
  });
  const controlPolicyBySkillId =
    createCharacterCombatControlPolicyIndex(recipes);
  const validation = runCalculatorValidation();
  const evidence = readJson(EVIDENCE_PATH);
  validateEvidence(evidence, validation);
  validateTuningConsumePriorityRuntimeEvidence();
  const mechanismEvidence = createMechanismEvidenceManifest();
  const battleTargetTypeContract = createBattleTargetTypeContract();
  const overlimitMechanics = readJson(OVERLIMIT_MECHANICS_PATH);
  const kiboCatalog = readJson(
    path.join(GENERATED_ROOT, 'workbench-kibo-action-catalog.json')
  );
  const specialResourceIdentityDiscovery =
    discoverSpecialResourceIdentityHints(characterCatalog);
  const skillLogicRows = readJson(SKILL_LOGIC_PATH).rows;
  const skillLogicById = new Map(
    skillLogicRows.map(row => [Number(row.skillId), row])
  );
  const candidates = augmentCharacterCombatActionCandidates({
    candidates: createActionCandidates({
      seed,
      kiboCatalog,
      characterCatalog,
      petRows: readJson(PET_PATH).rows,
      skillLogicById,
    }),
    recipes,
    characterCatalog,
    skills: seed.gameData?.skills ?? [],
  });
  for (const candidate of candidates) {
    if (candidate.ownerKind !== 'kibo') continue;
    const controlSkillId = Number(candidate.controlSkillId);
    if (!Number.isInteger(controlSkillId) || controlSkillId <= 0) continue;
    if (controlPolicyBySkillId.has(controlSkillId)) continue;
    controlPolicyBySkillId.set(controlSkillId, {
      ownerId: Number(candidate.ownerId) || null,
      controlSkillId,
      behaviorTriggerScope: 'skill-player',
      allowRuntimeTargetZeroDistance: true,
      bulletInjectionMode: 'recursive-immediate',
      runtimeEffectsUseScenarioTriggers: true,
      sourceIdentity:
        'm12-b3-kibo-zero-distance-profile|user-approved-sync-rebaseline-2026-08-05|frozen-zero-distance-scenario-assumption',
    });
  }
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
    ...collectCharacterCombatRequiredControlSkillIds(recipes),
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
    .map(skillId =>
      findSkillControl(
        skillId,
        battleTargetTypeContract,
        controlPolicyBySkillId.get(skillId)
      )
    )
    .filter(Boolean);
  const wantedPathIds = new Set(
    controls
      .flatMap(control => control.elementRefs.map(ref => ref.pathId))
      .filter(Boolean)
  );
  const wantedElementIds = new Set(
    controls
      .flatMap(control => [
        ...control.elementRefs.map(ref => ref.elementIdHint),
        ...(control.bulletLaunches ?? []).map(launch => launch.elementId),
      ])
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
    allIndexedElements,
  });
  const publicCharacterIds = (characterCatalog?.items ?? [])
    .map(character => Number(character.id))
    .filter(Number.isInteger);
  const characterCombatCompilerOperators = {
    normalizeControlWindows(control, subSkillIndex) {
      const variant = control?.variants?.find(
        item => Number(item.subSkillIndex) === Number(subSkillIndex)
      );
      return normalizeControlTransitionWindows(variant?.eventBridges);
    },
    resolveControlVariantTiming({ control, subSkillIndex, actionKind }) {
      const preparedControl = {
        ...control,
        hits: createControlRuntimeHits(control),
      };
      const variant = preparedControl.variants?.find(
        item => Number(item.subSkillIndex) === Number(subSkillIndex)
      );
      if (!variant) return null;
      return createControlVariantTimingContract({
        control: preparedControl,
        variant,
        actionKind,
        occupancyResolver: resolveVerifiedActionInputOccupancy,
      });
    },
    resolveNormalAttackTiming({ control, subSkillIndex, nextControlSkillId }) {
      const variant = control?.variants?.find(
        item => Number(item.subSkillIndex) === Number(subSkillIndex)
      );
      if (!variant) return null;
      const occupancyTiming = createControlVariantTimingContract({
        control,
        variant,
        actionKind: 'normal-attack',
        occupancyResolver: resolveNormalAttackInputOccupancy,
        occupancyContext: { nextControlSkillId },
      });
      const preparedControl = {
        ...control,
        hits: createControlRuntimeHits(control),
      };
      const executionTiming = createControlVariantTimingContract({
        control: preparedControl,
        variant,
        actionKind: 'normal-attack',
        occupancyResolver: resolveNormalAttackInputOccupancy,
        occupancyContext: { nextControlSkillId },
      });
      return {
        ...executionTiming,
        occupancy: occupancyTiming.occupancy,
      };
    },
    readElementAsset: readBattleElementAsset,
    createSemanticRootTriggers: createSemanticRootTriggerContracts,
    resolveControlOwnerId(control) {
      return resolveControlOwnerId(control?.controlSkillId, publicCharacterIds);
    },
  };
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
  let xiaoyuHiddenInputDerivationAudit = null;
  let xiaoyuActionOccupancyAudit = null;
  let xiaoyuHiddenInputAudit = null;
  const characterCombatBuild = await createCharacterCombatProductionBuild({
    recipes,
    characterCatalog,
    skills: seed.gameData?.skills ?? [],
    productBoundaryReport,
    productBoundaryMarkdown,
    compilerEvidence: {
      controls: controlBindings,
      specialResourceProfiles: specialResourceCatalog.profiles,
      specialResourceOperations: specialResourceCatalog.operationBindings,
      tuningMarkProfiles: tuningMechanicsCatalog.profiles,
      skills: seed.gameData?.skills ?? [],
    },
    compilerOperators: characterCombatCompilerOperators,
    actionVariantGraph,
    specialResourceCatalog,
    prepareCompiledOwners({ ownerCompilations }) {
      const goldRecipe = recipes.find(recipe => recipe.goldStandard === true);
      const goldCompilation = ownerCompilations.find(
        compilation =>
          Number(compilation.ownerId) === Number(goldRecipe?.ownerId)
      );
      if (!goldRecipe || !goldCompilation) return;
      xiaoyuHiddenInputDerivationAudit = createXiaoyuHiddenInputDerivationAudit(
        {
          characterCatalog,
          controlBySkillId: new Map(
            controlBindings.map(control => [control.controlSkillId, control])
          ),
          actionVariantGraph,
          attackInputChains: goldCompilation.contracts.attackInputChains,
          publicActionForms: goldCompilation.contracts.publicActionForms,
          contextEdges: goldCompilation.contracts.contextEdges,
        }
      );
      actionVariantGraph.hiddenInputDerivationCatalog = {
        schemaVersion: xiaoyuHiddenInputDerivationAudit.schemaVersion,
        kind: 'xiaoyu-hidden-input-derivation-catalog',
        status: xiaoyuHiddenInputDerivationAudit.status,
        ownerId: xiaoyuHiddenInputDerivationAudit.ownerId,
        publicExecutionFormCount:
          xiaoyuHiddenInputDerivationAudit.publicExecutionFormCount,
        publicExecutionFormsCovered:
          xiaoyuHiddenInputDerivationAudit.publicExecutionFormsCovered,
        starCarryConclusion:
          xiaoyuHiddenInputDerivationAudit.starCarryConclusion,
        summary: xiaoyuHiddenInputDerivationAudit.summary,
      };
      actionVariantGraph.summary.hiddenInputAuditRowCount =
        xiaoyuHiddenInputDerivationAudit.rows.length;
      actionVariantGraph.summary.hiddenInputPublicExecutionFormCount =
        xiaoyuHiddenInputDerivationAudit.publicExecutionFormCount;
    },
    createMechanicsPackage({ ownerCompilations }) {
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
        characterCatalog,
        characterCombatOwnerCompilations: ownerCompilations,
      });
      assertUnnamedSecondaryPassiveRuntimeIsolation({
        recipes,
        ownerCompilations,
        mechanicsPackage: packageValue,
        boundaryReport: productBoundaryReport,
      });
      packageValue.characterCombatProductBoundaries = {
        schemaVersion: productBoundaryReport.schemaVersion,
        kind: productBoundaryReport.kind,
        status: productBoundaryReport.status,
        policy: productBoundaryReport.policy,
        entries: productBoundaryReport.entries.map(entry => ({
          boundaryIdentity: entry.boundaryIdentity,
          ownerId: entry.ownerId,
          ownerName: entry.ownerName,
          skillId: entry.skillId,
          passiveSlotIndex: entry.passiveSlotIndex,
          classification: entry.classification,
          reason: entry.reason,
          sourceIdentities: entry.sourceIdentities,
        })),
        summary: productBoundaryReport.summary,
      };
      packageValue.summary.unnamedSecondaryPassiveCount =
        productBoundaryReport.summary.matchedCharacterCount;
      packageValue.packageHash = sha256(
        JSON.stringify({
          basePackageHash: packageValue.packageHash,
          characterCombatProductBoundaries:
            packageValue.characterCombatProductBoundaries,
        })
      );
      const semanticEffectCatalog = createSemanticEffectCatalog({
        controlBindings: publicControlBindings,
        packageValue,
        battleTargetTypeContract,
      });
      packageValue.semanticEffectCatalog = createSemanticEffectRuntimeCatalog(
        semanticEffectCatalog,
        packageValue.specialResourceCatalog?.passiveEffects ?? []
      );
      packageValue.packageHash = sha256(
        JSON.stringify({
          basePackageHash: packageValue.packageHash,
          semanticEffectCatalog,
        })
      );
      packageValue.summary.semanticEffectCount =
        semanticEffectCatalog.semanticEffects.length;
      packageValue.summary.semanticGameplayEffectCount =
        semanticEffectCatalog.semanticEffects.filter(
          effect => effect.role === 'gameplay-effect'
        ).length;
      packageValue.summary.semanticAppliedEffectCount =
        semanticEffectCatalog.semanticEffects.filter(
          effect =>
            effect.role === 'gameplay-effect' &&
            effect.classification === 'applied'
        ).length;
      assertPublishedDisplayLabels(packageValue);
      return {
        mechanicsPackage: packageValue,
        sharedContext: { semanticEffectCatalog },
      };
    },
    createStatDependenciesForOwner({ ownerId, compilation, semanticEffects }) {
      return createCharacterCombatStatDependencies({
        ownerId,
        staticPropertyCatalog,
        actorProfiles,
        passiveEffects: compilation.contracts.passiveEffects,
        semanticEffects,
      });
    },
    createGoldenRuntimeForOwner({ recipe, mechanicsPackage }) {
      return createCharacterCombatGoldenRuntime({
        repositoryRoot: REPO_ROOT,
        mechanicsPackage,
        recipe,
      });
    },
    createReportsForOwner({ recipe, mechanicsPackage }) {
      if (recipe.goldStandard !== true) return {};
      if (!xiaoyuHiddenInputDerivationAudit) {
        throw new Error('gold standard hidden input audit missing');
      }
      xiaoyuActionOccupancyAudit =
        createXiaoyuActionOccupancyAudit(mechanicsPackage);
      xiaoyuHiddenInputAudit = createXiaoyuHiddenInputDerivationReport({
        packageValue: mechanicsPackage,
        audit: xiaoyuHiddenInputDerivationAudit,
      });
      return {
        actionOccupancy: xiaoyuActionOccupancyAudit,
        hiddenInputDerivation: xiaoyuHiddenInputAudit,
      };
    },
    finalizeMechanicsPackage({ mechanicsPackage, pipelineArtifacts }) {
      mechanicsPackage.summary.characterCombatProfileCount =
        pipelineArtifacts.catalog.summary.compiledProfileCount;
      mechanicsPackage.summary.characterCombatRuntimeAppliedProfileCount =
        pipelineArtifacts.catalog.summary.runtimeAppliedProfileCount;
      mechanicsPackage.summary.characterCombatUiVerifiedProfileCount =
        pipelineArtifacts.catalog.summary.uiVerifiedProfileCount;
      mechanicsPackage.summary.characterCombatCompleteProfileCount =
        pipelineArtifacts.catalog.summary.characterCompleteCount;
      mechanicsPackage.packageHash = sha256(
        JSON.stringify({
          basePackageHash: mechanicsPackage.packageHash,
          characterCombatProfileCatalog:
            mechanicsPackage.characterCombatProfileCatalog,
        })
      );
    },
  });
  const packageValue = characterCombatBuild.mechanicsPackage;
  const semanticEffectCatalog =
    characterCombatBuild.sharedContext.semanticEffectCatalog;
  const characterCombatArtifacts = characterCombatBuild.pipelineArtifacts;
  assertUnnamedSecondaryPassiveRuntimeIsolation({
    recipes,
    ownerCompilations: characterCombatBuild.ownerCompilations,
    mechanicsPackage: packageValue,
    boundaryReport: productBoundaryReport,
  });
  const elementInheritanceAudit = createElementInheritanceFieldAudit({
    allIndexedElementsById,
    controlBindings,
  });
  const characterCombatVerificationGoldens = [];
  for (const recipe of recipes) {
    for (const scenarioRecipe of recipe.verificationGoldenScenarios ?? []) {
      const goldenRuntime = await createCharacterCombatGoldenRuntime({
        repositoryRoot: REPO_ROOT,
        mechanicsPackage: packageValue,
        recipe: {
          ...recipe,
          goldenScenario: scenarioRecipe,
        },
      });
      if (goldenRuntime.validation?.passed !== true) {
        throw new Error(
          `character combat verification golden failed: ${recipe.ownerId}/${scenarioRecipe.scenarioIdentity}`
        );
      }
      characterCombatVerificationGoldens.push({
        ownerId: Number(recipe.ownerId),
        fileName: String(
          scenarioRecipe.outputFileName ??
            `${scenarioRecipe.scenarioIdentity}.json`
        )
          .replace(/[^a-z0-9._-]+/gi, '-')
          .replace(/^-+|-+$/g, ''),
        goldenRuntime,
      });
    }
  }
  if (!xiaoyuActionOccupancyAudit || !xiaoyuHiddenInputAudit) {
    throw new Error('gold standard character combat reports missing');
  }
  xiaoyuActionOccupancyAudit.packageHash = packageValue.packageHash;
  xiaoyuHiddenInputAudit.packageHash = packageValue.packageHash;
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
  const contextualInputSchedulingAudit =
    createContextualInputSchedulingAuditReport({
      packageValue,
      xiaoyuHiddenInputAudit,
    });
  const effectCoverage = createEffectCoverageReport(
    packageValue,
    semanticEffectCatalog
  );
  const actionVariantResourceCoverage =
    createActionVariantResourceCoverageReport(packageValue);
  const derivedControlCoverage =
    createDerivedControlCoverageReport(packageValue);
  const switchTriggerCoverage = createSwitchTriggerCoverageReport(packageValue);
  const publicRuntimeCoverage = createPublicRuntimeCoverageReport({
    packageValue,
    actionCoverage: coverage,
    timingCoverage,
    effectCoverage,
    actionVariantResourceCoverage,
    characterCombatArtifacts,
  });

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
      XIAOYU_ACTION_OCCUPANCY_JSON_OUTPUT,
      `${JSON.stringify(xiaoyuActionOccupancyAudit, null, 2)}\n`,
    ],
    [
      XIAOYU_ACTION_OCCUPANCY_MARKDOWN_OUTPUT,
      createXiaoyuActionOccupancyMarkdown(xiaoyuActionOccupancyAudit),
    ],
    [
      XIAOYU_HIDDEN_INPUT_JSON_OUTPUT,
      `${JSON.stringify(xiaoyuHiddenInputAudit, null, 2)}\n`,
    ],
    [
      XIAOYU_HIDDEN_INPUT_MARKDOWN_OUTPUT,
      createXiaoyuHiddenInputMarkdown(xiaoyuHiddenInputAudit),
    ],
    [
      CONTEXTUAL_INPUT_SCHEDULING_JSON_OUTPUT,
      `${JSON.stringify(contextualInputSchedulingAudit, null, 2)}\n`,
    ],
    [
      CONTEXTUAL_INPUT_SCHEDULING_MARKDOWN_OUTPUT,
      createContextualInputSchedulingMarkdown(contextualInputSchedulingAudit),
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
    [
      DERIVED_CONTROL_COVERAGE_JSON_OUTPUT,
      `${JSON.stringify(derivedControlCoverage, null, 2)}\n`,
    ],
    [
      DERIVED_CONTROL_COVERAGE_MARKDOWN_OUTPUT,
      createDerivedControlCoverageMarkdown(derivedControlCoverage),
    ],
    [
      SWITCH_TRIGGER_COVERAGE_JSON_OUTPUT,
      `${JSON.stringify(switchTriggerCoverage, null, 2)}\n`,
    ],
    [
      SWITCH_TRIGGER_COVERAGE_MARKDOWN_OUTPUT,
      createSwitchTriggerCoverageMarkdown(switchTriggerCoverage),
    ],
    [
      PUBLIC_RUNTIME_COVERAGE_JSON_OUTPUT,
      `${JSON.stringify(publicRuntimeCoverage, null, 2)}\n`,
    ],
    [
      PUBLIC_RUNTIME_COVERAGE_MARKDOWN_OUTPUT,
      createPublicRuntimeCoverageMarkdown(publicRuntimeCoverage),
    ],
    ...createCharacterCombatOutputRecords(characterCombatArtifacts).map(
      record => [path.resolve(REPO_ROOT, record.relativePath), record.content]
    ),
    ...characterCombatVerificationGoldens.map(record => [
      path.resolve(
        REPO_ROOT,
        'reports',
        'm10',
        String(record.ownerId),
        record.fileName
      ),
      `${JSON.stringify(record.goldenRuntime, null, 2)}\n`,
    ]),
    [
      path.resolve(
        REPO_ROOT,
        'reports',
        'm10',
        'controlled-actor-inheritance-audit.json'
      ),
      `${JSON.stringify(elementInheritanceAudit, null, 2)}\n`,
    ],
    [
      path.resolve(
        REPO_ROOT,
        'reports',
        'm10',
        'controlled-actor-inheritance-audit.md'
      ),
      createElementInheritanceFieldAuditMarkdown(elementInheritanceAudit),
    ],
  ];
  return {
    ...characterCombatBuild,
    outputs,
    summary: {
      packageId: packageValue.packageId,
      candidateActionCount: candidates.length,
      controlCount: controls.length,
      appliedActionBindingCount: packageValue.actionBindings.length,
      appliedHitBindingCount: packageValue.summary.appliedHitBindingCount,
      appliedEffectBindingCount: packageValue.summary.appliedEffectBindingCount,
      unresolvedActionCount: packageValue.summary.unresolvedActionCount,
      verifiedZeroActionCount: packageValue.summary.verifiedZeroActionCount,
      appliedEnemyProfileCount: packageValue.summary.appliedEnemyProfileCount,
      validatorPassed: validation.passed,
    },
  };
}

async function runCli() {
  const options = parseArgs(process.argv.slice(2));
  const build = await createVerifiedCombatMechanicsBuild();
  const drift = build.outputs.filter(([filePath, content]) =>
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
    for (const [filePath, content] of build.outputs) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, 'utf8');
    }
  }

  console.log(
    JSON.stringify(
      {
        status: drift.length ? (options.write ? 'written' : 'drift') : 'clean',
        ...build.summary,
        outputs: build.outputs.map(([filePath]) => relativePath(filePath)),
      },
      null,
      2
    )
  );
}

function isDirectExecution() {
  if (!process.argv[1]) return false;
  return (
    path.resolve(process.argv[1]).toLowerCase() ===
    fileURLToPath(import.meta.url).toLowerCase()
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
    IL2CPP_DUMP_PATH,
    GAME_ASSEMBLY_PATH,
    TUNING_CONSUME_PRIORITY_EVIDENCE_PATH,
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

function validateTuningConsumePriorityRuntimeEvidence() {
  const evidence = readJson(TUNING_CONSUME_PRIORITY_EVIDENCE_PATH);
  if (
    evidence?.contractName !== 'AzPrTuningConsumePriorityRuntimeEvidence' ||
    evidence?.status !== 'verified'
  ) {
    throw new Error('tuning consume priority runtime evidence is not verified');
  }
  const binary = fs.readFileSync(GAME_ASSEMBLY_PATH);
  if (
    binary.length !== Number(evidence.binary?.bytes) ||
    sha256(binary) !== evidence.binary?.sha256
  ) {
    throw new Error('tuning consume priority GameAssembly identity drift');
  }
  const dumpSource = readText(IL2CPP_DUMP_PATH);
  for (const declaration of evidence.dump?.requiredDeclarations ?? []) {
    if (!dumpSource.includes(declaration)) {
      throw new Error(
        `tuning consume priority declaration missing: ${declaration}`
      );
    }
  }
  if (
    !dumpSource.includes(
      `// RVA: 0x${evidence.selection.consumerMethodRva.slice(2).toUpperCase()}`
    ) ||
    !dumpSource.includes(
      `// RVA: 0x${evidence.injection.injectMethodRva.slice(2).toUpperCase()}`
    )
  ) {
    throw new Error('tuning consume priority method RVA drift');
  }
  const selectionBytes = readPortableExecutableRvaRange(
    binary,
    evidence.selection.candidateLoopRange
  );
  const injectionBytes = readPortableExecutableRvaRange(
    binary,
    evidence.injection.selectedPacketLookupRange
  );
  if (
    sha256(selectionBytes) !== evidence.selection.candidateLoopSha256 ||
    sha256(injectionBytes) !== evidence.injection.selectedPacketLookupSha256
  ) {
    throw new Error('tuning consume priority disassembly window drift');
  }
  if (
    evidence.selection.candidateOrder !== 'element-arr-index-ascending' ||
    evidence.selection.selectionRule !==
      'first-candidate-with-layer-count-greater-than-or-equal-to-consume-layer-num' ||
    evidence.injection.packetRule !==
      'lookup-inject-element-data-dict-by-selected-consume-element-id'
  ) {
    throw new Error('tuning consume priority semantic evidence drift');
  }
  tuningConsumePriorityRuntimeEvidenceCache = evidence;
  return evidence;
}

function getTuningConsumePriorityRuntimeEvidence() {
  return (
    tuningConsumePriorityRuntimeEvidenceCache ??
    validateTuningConsumePriorityRuntimeEvidence()
  );
}

function readPortableExecutableRvaRange(binary, range) {
  const match = String(range).match(/^0x([0-9a-f]+)-0x([0-9a-f]+)$/iu);
  if (!match) throw new Error(`invalid PE RVA range: ${range}`);
  const startRva = Number.parseInt(match[1], 16);
  const endRva = Number.parseInt(match[2], 16);
  if (!(endRva > startRva)) throw new Error(`empty PE RVA range: ${range}`);
  const peOffset = binary.readUInt32LE(0x3c);
  const sectionCount = binary.readUInt16LE(peOffset + 6);
  const optionalHeaderSize = binary.readUInt16LE(peOffset + 20);
  const sectionTableOffset = peOffset + 24 + optionalHeaderSize;
  const resolveOffset = rva => {
    for (let index = 0; index < sectionCount; index += 1) {
      const offset = sectionTableOffset + index * 40;
      const virtualSize = binary.readUInt32LE(offset + 8);
      const virtualAddress = binary.readUInt32LE(offset + 12);
      const rawSize = binary.readUInt32LE(offset + 16);
      const rawOffset = binary.readUInt32LE(offset + 20);
      if (
        rva >= virtualAddress &&
        rva < virtualAddress + Math.max(virtualSize, rawSize)
      ) {
        return rawOffset + rva - virtualAddress;
      }
    }
    throw new Error(`PE RVA is outside all sections: 0x${rva.toString(16)}`);
  };
  return binary.subarray(resolveOffset(startRva), resolveOffset(endRva));
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
        .map((state, stateIndex) => {
          const asset = readBattleElementAsset(state.elementId);
          if (!asset) return null;
          registerEvidenceSource(evidenceSources, asset);
          const displayName = createEffectSourceDisplayLabel({
            sourceText: asset.tree.elementName ?? asset.tree.m_Name,
            sequence: stateIndex + 1,
            sourceIdentity: asset.sourceIdentity,
          });
          return {
            elementId: state.elementId,
            field: state.field,
            pathId: asset.pathId,
            name: displayName.displayLabel,
            displayLabel: displayName.displayLabel,
            rawSourceName: displayName.rawSourceName,
            sourceNameStatus: displayName.sourceNameStatus,
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
      const rawResourceName = resolveSpecialResourceDisplayName(
        primaryAsset.tree
      );
      const displayName = createEffectSourceDisplayLabel({
        sourceText: rawResourceName,
        sourceIdentity: primaryAsset.sourceIdentity,
      });
      return {
        ownerId: hint.ownerId,
        ownerName: hint.ownerName,
        resourceIdentity: `actor:${hint.ownerId}:element:${hint.primaryElementId}`,
        elementId: hint.primaryElementId,
        pathId: primaryAsset.pathId,
        name: displayName.displayLabel,
        displayLabel: displayName.displayLabel,
        rawSourceName: rawResourceName,
        sourceNameStatus: displayName.sourceNameStatus,
        sourceName: primaryAsset.tree.elementName ?? primaryAsset.tree.m_Name,
        capacity: applied ? capacity : null,
        initialValue: 0,
        inputStep: 1,
        scenarioConfigurable: applied,
        initialValueStatus: 'scenario-configurable-initial-state',
        initialValueSourceIdentity:
          'AzPrCombatScenario#initialRuntimeState.specialResourcesByActor',
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
      return { filePath, tree: readUnityJson(filePath) };
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
  allIndexedElements,
}) {
  const profiles = specialResourceCatalog.profiles.filter(
    profile => profile.applied
  );
  const ownerIds = [
    ...new Set(
      (candidates ?? [])
        .map(candidate => Number(candidate.ownerId))
        .filter(Number.isInteger)
    ),
  ];
  const profileByOwnerId = new Map(
    profiles.map(profile => [profile.ownerId, profile])
  );
  const actionKindsByControl = new Map();
  const publicActionsByControl = new Map();
  for (const candidate of candidates ?? []) {
    appendMapArray(
      actionKindsByControl,
      candidate.controlSkillId,
      candidate.actionKind
    );
    appendMapArray(publicActionsByControl, candidate.controlSkillId, {
      ownerKind: candidate.ownerKind,
      ownerId: candidate.ownerId,
      sourceSkillId: candidate.sourceSkillId,
      actionKind: candidate.actionKind,
      actionVariantIndex: candidate.actionVariantIndex,
      publicVariants: candidate.publicVariants ?? [],
      sourceIdentity: candidate.bindingSourceIdentity ?? null,
    });
    for (const segment of candidate.attackInputControls ?? []) {
      appendMapArray(
        actionKindsByControl,
        segment.controlSkillId,
        'normal-attack'
      );
      appendMapArray(publicActionsByControl, segment.controlSkillId, {
        ownerKind: candidate.ownerKind,
        ownerId: candidate.ownerId,
        sourceSkillId: candidate.sourceSkillId,
        actionKind: 'normal-attack',
        actionVariantIndex: candidate.actionVariantIndex,
        attackSequenceIndex: segment.sequenceIndex,
        publicVariants: candidate.publicVariants ?? [],
        sourceIdentity: segment.sourceIdentity ?? null,
      });
    }
  }
  const nodes = [];
  const defaultSelections = [];
  for (const control of controlBindings) {
    const ownerId = resolveControlOwnerId(control.controlSkillId, ownerIds);
    if (!Number.isInteger(ownerId)) continue;
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
    const stateByElementId = new Map(
      (profile?.stateElements ?? []).map(state => [state.elementId, state])
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
                  resourceIdentity: profile?.resourceIdentity ?? null,
                  stateElementId: rootState.elementId,
                  stateName: rootState.name,
                  sourceIdentity: rootState.sourceIdentity,
                }
              : requiredResourceOperation
                ? {
                    kind: 'resource-at-least',
                    resourceIdentity: profile?.resourceIdentity ?? null,
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
  const conditionDiscoveries = createActionVariantConditionDiscoveries({
    controlBindings,
    publicActionsByControl,
    defaultSelections,
    switchBindings: dedupedSwitchBindings,
    specialResourceCatalog,
    allIndexedElements,
  });
  const derivedControlContracts = createDerivedControlContracts({
    controlBindings,
    publicActionsByControl,
    defaultSelections,
    switchBindings: dedupedSwitchBindings,
    conditionDiscoveries,
  });
  return {
    schemaVersion: 2,
    kind: 'azpr-verified-action-variant-graph',
    status: 'verified-action-variant-graph-ready',
    nodes,
    edges: dedupedSwitchBindings,
    defaultSelections,
    conditionDiscoveries,
    derivedControlContracts,
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
      modeledOwnerCount: new Set(
        dedupedSwitchBindings
          .filter(edge => edge.applied)
          .map(edge => edge.ownerId)
      ).size,
      automaticEdgeCount: dedupedSwitchBindings.filter(
        edge => edge.relationType === 'automatic'
      ).length,
      conditionDiscoveryCount: conditionDiscoveries.length,
      conditionDiscoveryStatusCounts: countValues(
        conditionDiscoveries.map(discovery => discovery.status)
      ),
      derivedControlContractCount: derivedControlContracts.length,
      derivedControlOwnerCount: new Set(
        derivedControlContracts.map(contract => contract.ownerId)
      ).size,
      derivedControlSourceCounts: countValues(
        derivedControlContracts.map(contract => contract.controlSource)
      ),
      derivedControlResolutionStatusCounts: countValues(
        derivedControlContracts.map(contract => contract.resolutionStatus)
      ),
    },
  };
}

function createXiaoyuHiddenInputDerivationAudit({
  characterCatalog,
  controlBySkillId,
  actionVariantGraph,
  attackInputChains,
  publicActionForms,
  contextEdges,
}) {
  const publicExecutionForms = [
    ...attackInputChains.flatMap(chain =>
      chain.segments.map(segment => ({
        publicActionIdentity: `${chain.chainIdentity}|A${segment.sequenceIndex}`,
        actionKind: 'normal-attack',
        semanticName: `${
          chain.stateCondition.kind === 'resource-state-active'
            ? '爆发普攻'
            : '普通攻击'
        } A${segment.sequenceIndex}`,
        sourceControlSkillId: segment.controlSkillId,
        sourceSubSkillIndex: segment.subSkillIndex,
        condition: chain.stateCondition,
        sourceIdentity: segment.sourceIdentity,
      }))
    ),
    ...publicActionForms.map(form => ({
      publicActionIdentity: form.formIdentity,
      actionKind: form.publicActionKind,
      semanticName: form.semanticName,
      sourceControlSkillId: form.executionControlSkillId,
      sourceSubSkillIndex: form.executionSubSkillIndex,
      condition: form.condition,
      sourceIdentity: form.sourceIdentity,
    })),
    ...dedupeBy(
      (actionVariantGraph.nodes ?? [])
        .filter(
          node =>
            Number(node.ownerId) === XIAOYU_MECHANICS.ownerId &&
            (node.actionKinds ?? []).some(
              actionKind =>
                !['normal-attack', 'charged-attack'].includes(actionKind)
            )
        )
        .flatMap(node =>
          (node.actionKinds ?? [])
            .filter(
              actionKind =>
                !['normal-attack', 'charged-attack'].includes(actionKind) &&
                !publicActionForms.some(
                  form =>
                    form.publicActionKind === actionKind &&
                    Number(form.publicControlSkillId) ===
                      Number(node.controlSkillId)
                )
            )
            .map(actionKind => {
              const publicAction = (node.publicActions ?? []).find(
                action => action.actionKind === actionKind
              );
              return {
                publicActionIdentity: [
                  `actor:${XIAOYU_MECHANICS.ownerId}`,
                  actionKind,
                  `control:${node.controlSkillId}`,
                  `sub:${node.subSkillIndex}`,
                ].join('|'),
                actionKind,
                semanticName:
                  publicAction?.publicVariants?.[0]?.label ??
                  formatXiaoyuActionKind(actionKind),
                sourceControlSkillId: node.controlSkillId,
                sourceSubSkillIndex: node.subSkillIndex,
                condition: { kind: 'always' },
                sourceIdentity: [
                  node.sourceIdentity,
                  publicAction?.sourceIdentity,
                ]
                  .filter(Boolean)
                  .join('|'),
              };
            })
        ),
      form => form.publicActionIdentity
    ),
  ];
  const publicExecutionFormIdentities = new Set(
    publicExecutionForms.map(form => form.publicActionIdentity)
  );
  if (
    publicExecutionForms.length !== 21 ||
    publicExecutionFormIdentities.size !== 21
  ) {
    throw new Error(
      `Xiaoyu public execution form coverage mismatch: ${publicExecutionForms.length}/${publicExecutionFormIdentities.size}`
    );
  }

  const attackChainLinkKeys = new Set(
    attackInputChains.flatMap(chain =>
      chain.segments.flatMap(segment => {
        const link = segment.executionTiming?.occupancy?.linkWindow;
        return link
          ? [
              createXiaoyuWindowKey({
                sourceControlSkillId: segment.controlSkillId,
                sourceSubSkillIndex: segment.subSkillIndex,
                window: link,
              }),
            ]
          : [];
      })
    )
  );
  const contextEdgeByWindowKey = new Map(
    contextEdges.map(edge => [
      createXiaoyuWindowKey({
        sourceControlSkillId: edge.sourceControlSkillId,
        sourceSubSkillIndex: edge.sourceSubSkillIndex,
        window: {
          ...edge.inputWindow,
          targetControlSkillId: edge.executionControlSkillId,
          targetSubSkillIndex: edge.targetSubSkillIndex,
        },
      }),
      edge,
    ])
  );
  const publicRows = publicExecutionForms.flatMap(form =>
    createXiaoyuHiddenInputRowsForForm({
      form,
      controlBySkillId,
      attackChainLinkKeys,
      contextEdgeByWindowKey,
    })
  );
  const wrapperRows = createXiaoyuWrapperControlRows({
    controlBySkillId,
    contextEdgeByWindowKey,
    attackChainLinkKeys,
  });
  const character = (characterCatalog?.items ?? []).find(
    item => Number(item.id) === XIAOYU_MECHANICS.ownerId
  );
  const declaredBackupControls = (character?.skillSlots ?? [])
    .filter(slot => slot.group === 'backup')
    .map(slot => {
      const controlSkillId = Number(slot.skillId);
      const control = controlBySkillId.get(controlSkillId);
      return {
        controlSkillId,
        controlPresent: Boolean(control),
        role: resolveXiaoyuBackupControlRole(controlSkillId),
        status: control
          ? 'verified-backup-control-source-present'
          : 'backup-control-asset-not-present',
        exclusionReason: control
          ? null
          : 'declared-backup-control-has-no-extracted-skill-control-asset',
        sourceIdentity: `characters.items[id=${XIAOYU_MECHANICS.ownerId}].skillSlots[group=backup,skillId=${controlSkillId}]`,
      };
    })
    .sort((left, right) => left.controlSkillId - right.controlSkillId);
  const starCarryConclusion = createXiaoyuStarCarryDerivationConclusion({
    character,
    controlBySkillId,
    publicRows,
    wrapperRows,
  });
  const rows = [...publicRows, ...wrapperRows].sort(compareXiaoyuAuditRows);
  const coveredPublicExecutionForms = new Set(
    publicRows
      .filter(row => row.sourceControlPresent)
      .map(row => row.publicActionIdentity)
  );
  return {
    schemaVersion: 1,
    kind: 'xiaoyu-hidden-input-derivation-audit',
    status: 'verified-xiaoyu-hidden-input-derivation-audit-ready',
    ownerId: XIAOYU_MECHANICS.ownerId,
    ownerName: character?.name ?? '涂山小玉',
    frameRate: 60,
    publicExecutionFormCount: publicExecutionForms.length,
    publicExecutionFormsCovered: coveredPublicExecutionForms.size,
    publicExecutionForms,
    rows,
    declaredBackupControls,
    starCarryConclusion,
    summary: {
      publicExecutionFormCount: publicExecutionForms.length,
      publicExecutionFormsCovered: coveredPublicExecutionForms.size,
      missingPublicExecutionFormCount:
        publicExecutionForms.length - coveredPublicExecutionForms.size,
      rowCount: rows.length,
      publicRowCount: publicRows.length,
      supportRowCount: wrapperRows.length,
      appliedContextEdgeCount: contextEdges.filter(edge => edge.applied).length,
      specifiedInputDerivationCount: rows.filter(
        row => row.relationType === 'specified-input-derived'
      ).length,
      attackChainLinkCount: rows.filter(
        row => row.relationType === 'attack-chain-link'
      ).length,
      directControlLinkCount: rows.filter(
        row => row.relationType === 'direct-control-input'
      ).length,
      ordinaryWindowCount: rows.filter(
        row => row.relationType === 'ordinary-cancel-or-reopen'
      ).length,
      systemControlExclusionCount: rows.filter(
        row => row.relationType === 'system-or-movement-control'
      ).length,
      relationTypeCounts: countValues(rows.map(row => row.relationType)),
      statusCounts: countValues(rows.map(row => row.status)),
    },
    sourceIdentity: dedupeBy(
      [
        ...publicExecutionForms.map(form => form.sourceIdentity),
        ...rows.map(row => row.sourceIdentity),
        ...starCarryConclusion.sourceIdentities,
      ].filter(Boolean),
      value => value
    ),
  };
}

function createXiaoyuHiddenInputRowsForForm({
  form,
  controlBySkillId,
  attackChainLinkKeys,
  contextEdgeByWindowKey,
}) {
  const control = controlBySkillId.get(Number(form.sourceControlSkillId));
  const variant = control?.variants?.find(
    item => Number(item.subSkillIndex) === Number(form.sourceSubSkillIndex)
  );
  const windows = normalizeControlTransitionWindows(variant?.eventBridges);
  if (!control || !variant) {
    return [
      createXiaoyuAuditRow({
        form,
        sourceControlPresent: Boolean(control),
        relationType: 'source-control-unresolved',
        status: 'source-control-or-subskill-missing',
        applied: false,
        exclusionReason: 'source-control-or-subskill-missing',
      }),
    ];
  }
  if (!windows.length) {
    return [
      createXiaoyuAuditRow({
        form,
        sourceControlPresent: true,
        relationType: 'no-control-window',
        status: 'verified-no-hidden-input-window',
        applied: false,
        exclusionReason: 'no-behaviorline-control-window',
      }),
    ];
  }
  return windows.map((window, windowIndex) => {
    const key = createXiaoyuWindowKey({
      sourceControlSkillId: form.sourceControlSkillId,
      sourceSubSkillIndex: form.sourceSubSkillIndex,
      window,
    });
    const contextEdge = contextEdgeByWindowKey.get(key);
    const classification = classifyXiaoyuControlWindow({
      form,
      window,
      contextEdge,
      attackChainLinked: attackChainLinkKeys.has(key),
    });
    return createXiaoyuAuditRow({
      form,
      sourceControlPresent: true,
      window,
      windowIndex,
      contextEdge,
      ...classification,
    });
  });
}

function createXiaoyuAuditRow({
  form,
  sourceControlPresent,
  window = null,
  windowIndex = 0,
  contextEdge = null,
  relationType,
  inputCommand = null,
  condition = null,
  targetSemanticName = null,
  status,
  applied,
  exclusionReason,
}) {
  return {
    rowIdentity: [
      form.publicActionIdentity,
      `control:${form.sourceControlSkillId}`,
      `sub:${form.sourceSubSkillIndex}`,
      window
        ? `window:${window.startFrame}-${window.endFrame}:${windowIndex}`
        : 'window:none',
      `target:${window?.targetControlSkillId ?? 0}`,
      `sub:${window?.targetSubSkillIndex ?? 0}`,
    ].join('|'),
    publicActionIdentity: form.publicActionIdentity,
    actionKind: form.actionKind,
    sourceSemanticName: form.semanticName,
    sourceControlSkillId: form.sourceControlSkillId,
    sourceSubSkillIndex: form.sourceSubSkillIndex,
    sourceControlPresent,
    inputCommand,
    inputWindow: window
      ? {
          startFrame: window.startFrame,
          endFrame: window.endFrame,
          frameRate: 60,
          interval: '[start,end)',
        }
      : null,
    condition: condition ?? form.condition ?? { kind: 'always' },
    targetControlSkillId: window?.targetControlSkillId ?? null,
    targetSubSkillIndex: window?.targetSubSkillIndex ?? null,
    semanticName: targetSemanticName,
    relationType,
    behaviorLineName: window?.behaviorLineName ?? null,
    allowedInputCommands: window?.allowedInputCommands ?? [],
    evidence: {
      bridgeType: window?.bridgeType ?? null,
      continuousAttackType: window?.continuousAttackType ?? null,
      interruptBehavior: window?.interruptBehavior ?? null,
      frameIndex: window?.frameIndex ?? null,
      allowAttack: window?.allowAttack ?? false,
      baseOnInput: window?.baseOnInput ?? false,
      inputToIndex: window?.inputToIndex ?? false,
      sourceIdentity: window?.sourceIdentity ?? form.sourceIdentity,
    },
    sourceIdentity: [
      form.sourceIdentity,
      window?.sourceIdentity,
      contextEdge?.sourceIdentity,
    ]
      .filter(Boolean)
      .join('|'),
    status,
    applied,
    exclusionReason: exclusionReason ?? null,
  };
}

function classifyXiaoyuControlWindow({
  form,
  window,
  contextEdge,
  attackChainLinked,
}) {
  if (contextEdge) {
    return {
      relationType: 'specified-input-derived',
      inputCommand: contextEdge.inputCommand,
      condition: contextEdge.condition,
      targetSemanticName: contextEdge.semanticName,
      status: 'verified-input-context-edge-applied',
      applied: true,
      exclusionReason: null,
    };
  }
  if (attackChainLinked) {
    return {
      relationType: 'attack-chain-link',
      inputCommand: 'normal-attack',
      condition: form.condition,
      targetSemanticName: resolveXiaoyuTargetSemanticName(window),
      status: 'verified-attack-input-chain-link-applied',
      applied: true,
      exclusionReason: null,
    };
  }
  if (
    XIAOYU_SYSTEM_CONTROL_SKILL_IDS.has(Number(window.targetControlSkillId))
  ) {
    return {
      relationType: 'system-or-movement-control',
      inputCommand: 'system-control',
      condition: form.condition,
      targetSemanticName: `系统控制 ${window.targetControlSkillId}`,
      status: 'verified-system-control-excluded',
      applied: false,
      exclusionReason: 'system-or-movement-control-is-not-public-action',
    };
  }
  if (window.targetControlSkillId == null) {
    return {
      relationType: 'ordinary-cancel-or-reopen',
      inputCommand:
        resolveXiaoyuInputCommand(window) ??
        window.allowedInputCommands?.[0] ??
        null,
      condition: form.condition,
      targetSemanticName: null,
      status: 'verified-ordinary-control-window',
      applied: false,
      exclusionReason: 'window-does-not-select-an-action-control',
    };
  }
  return {
    relationType: 'direct-control-input',
    inputCommand: resolveXiaoyuInputCommand(
      window,
      inferXiaoyuCommandForTarget(window.targetControlSkillId)
    ),
    condition: inferXiaoyuWindowCondition(window, form.condition),
    targetSemanticName: resolveXiaoyuTargetSemanticName(window),
    status: 'verified-direct-control-input-ready',
    applied: true,
    exclusionReason: null,
  };
}

function createXiaoyuWrapperControlRows({
  controlBySkillId,
  contextEdgeByWindowKey,
  attackChainLinkKeys,
}) {
  const wrapperTriggers = [
    {
      sourceControlSkillId: XIAOYU_MECHANICS.evadeForwardControlSkillId,
      sourceSubSkillIndex: 0,
      sourceSemanticName: '前向闪避系统槽',
      elementId: XIAOYU_MECHANICS.evadeForwardWrapperElementId,
    },
    {
      sourceControlSkillId: XIAOYU_MECHANICS.evadeBackControlSkillId,
      sourceSubSkillIndex: 0,
      sourceSemanticName: '后向闪避系统槽',
      elementId: XIAOYU_MECHANICS.evadeBackWrapperElementId,
    },
  ].map(definition => {
    const asset = readBattleElementAsset(definition.elementId);
    const trigger = (asset?.tree?.triggerEffectList ?? []).find(
      effect =>
        Number(effect.effectType) === 1 &&
        Number(effect.param1) ===
          XIAOYU_MECHANICS.limitCounterWrapperControlSkillId
    );
    const targetSubSkillIndex = nonNegativeIntegerOrNull(trigger?.param3);
    const applied = targetSubSkillIndex != null;
    return {
      rowIdentity: [
        `system-slot:${definition.sourceControlSkillId}`,
        `element:${definition.elementId}`,
        `target:${XIAOYU_MECHANICS.limitCounterWrapperControlSkillId}`,
        `sub:${targetSubSkillIndex ?? 'missing'}`,
      ].join('|'),
      publicActionIdentity: `system-slot:${definition.sourceControlSkillId}`,
      actionKind: 'system-evade-wrapper',
      sourceSemanticName: definition.sourceSemanticName,
      sourceControlSkillId: definition.sourceControlSkillId,
      sourceSubSkillIndex: definition.sourceSubSkillIndex,
      sourceControlPresent: controlBySkillId.has(
        definition.sourceControlSkillId
      ),
      inputCommand: null,
      inputWindow: null,
      condition: {
        kind: 'battle-element-trigger-condition',
        conditionParam1:
          asset?.tree?.triggerConditionList?.[0]?.conditionParam1 ?? null,
        conditionParam2:
          asset?.tree?.triggerConditionList?.[0]?.conditionParam2 ?? null,
      },
      targetControlSkillId: XIAOYU_MECHANICS.limitCounterWrapperControlSkillId,
      targetSubSkillIndex,
      semanticName: '极限反击闪避包装控制',
      relationType: 'conditional-wrapper-trigger',
      behaviorLineName: null,
      allowedInputCommands: [],
      evidence: {
        elementId: definition.elementId,
        effectType: trigger?.effectType ?? null,
        sourceIdentity: asset?.sourceIdentity ?? null,
      },
      sourceIdentity: asset?.sourceIdentity ?? null,
      status: applied
        ? 'verified-conditional-wrapper-trigger-ready'
        : 'wrapper-trigger-static-evidence-gap',
      applied,
      exclusionReason: applied ? null : 'wrapper-trigger-target-missing',
    };
  });
  const wrapperForm = {
    publicActionIdentity: 'support-control:10101041',
    actionKind: 'limit-counter-wrapper',
    semanticName: '极限反击闪避包装控制',
    sourceControlSkillId: XIAOYU_MECHANICS.limitCounterWrapperControlSkillId,
    sourceSubSkillIndex: 0,
    condition: { kind: 'runtime-wrapper-selection' },
    sourceIdentity: controlBySkillId.get(
      XIAOYU_MECHANICS.limitCounterWrapperControlSkillId
    )?.sourcePath,
  };
  const wrapperControl = controlBySkillId.get(
    XIAOYU_MECHANICS.limitCounterWrapperControlSkillId
  );
  const wrapperWindowRows = (wrapperControl?.variants ?? []).flatMap(variant =>
    createXiaoyuHiddenInputRowsForForm({
      form: {
        ...wrapperForm,
        publicActionIdentity: `support-control:10101041/sub${variant.subSkillIndex}`,
        sourceSubSkillIndex: variant.subSkillIndex,
      },
      controlBySkillId,
      contextEdgeByWindowKey,
      attackChainLinkKeys,
    })
  );
  const supportForms = [
    {
      publicActionIdentity: 'support-control:10101049/sub0',
      actionKind: 'perfect-parry-runtime-support',
      semanticName: '完美招架运行时包装 1',
      sourceControlSkillId: XIAOYU_MECHANICS.perfectParryRuntimeControlSkillId,
      sourceSubSkillIndex: 0,
      condition: { kind: 'runtime-support-control' },
      sourceIdentity: controlBySkillId.get(
        XIAOYU_MECHANICS.perfectParryRuntimeControlSkillId
      )?.sourcePath,
    },
    {
      publicActionIdentity: 'support-control:10101049/sub1',
      actionKind: 'perfect-parry-runtime-support',
      semanticName: '完美招架运行时包装 2',
      sourceControlSkillId: XIAOYU_MECHANICS.perfectParryRuntimeControlSkillId,
      sourceSubSkillIndex: 1,
      condition: { kind: 'runtime-support-control' },
      sourceIdentity: controlBySkillId.get(
        XIAOYU_MECHANICS.perfectParryRuntimeControlSkillId
      )?.sourcePath,
    },
  ];
  const supportRows = supportForms.flatMap(form =>
    createXiaoyuHiddenInputRowsForForm({
      form,
      controlBySkillId,
      contextEdgeByWindowKey,
      attackChainLinkKeys,
    })
  );
  return [...wrapperTriggers, ...wrapperWindowRows, ...supportRows];
}

function createXiaoyuStarCarryDerivationConclusion({
  character,
  controlBySkillId,
  publicRows,
  wrapperRows,
}) {
  const starCarryControl = controlBySkillId.get(
    XIAOYU_MECHANICS.starCarryControlSkillId
  );
  const directEdges = [...publicRows, ...wrapperRows].filter(
    row =>
      Number(row.sourceControlSkillId) ===
        XIAOYU_MECHANICS.starCarryControlSkillId &&
      Number(row.targetControlSkillId) ===
        XIAOYU_MECHANICS.derivedChargedControlSkillId
  );
  const switchSlot = (character?.skillSlots ?? []).find(
    slot =>
      Number(slot.slot) === 203 &&
      Number(slot.skillId) === XIAOYU_MECHANICS.starCarryControlSkillId
  );
  const wrapperSources = wrapperRows.filter(
    row =>
      Number(row.targetControlSkillId) ===
      XIAOYU_MECHANICS.limitCounterWrapperControlSkillId
  );
  const verifiedNotFound =
    Boolean(starCarryControl) &&
    Boolean(switchSlot) &&
    directEdges.length === 0 &&
    wrapperSources.every(
      row =>
        Number(row.sourceControlSkillId) !==
        XIAOYU_MECHANICS.starCarryControlSkillId
    );
  return {
    sourceControlSkillId: XIAOYU_MECHANICS.starCarryControlSkillId,
    sourceSubSkillIndex: 0,
    switchSkillSlot: 203,
    triggerPhase: 'on-enter',
    targetControlSkillId: XIAOYU_MECHANICS.derivedChargedControlSkillId,
    directDerivedEdgeCount: directEdges.length,
    wrapperControlSkillId: XIAOYU_MECHANICS.limitCounterWrapperControlSkillId,
    wrapperSourceControlSkillIds: dedupeBy(
      wrapperSources.map(row => row.sourceControlSkillId),
      value => value
    ).sort((left, right) => left - right),
    conclusion:
      '当前客户端入场槽直接执行 10101021/sub0；其 EventBridge 与效果链未发现指向 10101042。10101041 来自闪避系统槽并桥接极限反击，传闻更可能混淆了极限反击路径。',
    sourceIdentities: dedupeBy(
      [
        starCarryControl?.sourcePath,
        switchSlot
          ? `characters.items[id=${XIAOYU_MECHANICS.ownerId}].skillSlots[slot=203,skillId=${XIAOYU_MECHANICS.starCarryControlSkillId}]`
          : null,
        ...wrapperSources.map(row => row.sourceIdentity),
      ].filter(Boolean),
      value => value
    ),
    status: verifiedNotFound
      ? 'verified-not-found-in-current-client'
      : 'star-carry-derived-input-audit-incomplete',
    applied: false,
    exclusionReason: verifiedNotFound
      ? 'no-direct-or-reachable-star-carry-to-derived-charged-edge'
      : 'star-carry-execution-chain-evidence-incomplete',
  };
}

function inferXiaoyuWindowCondition(window, fallback) {
  const name = String(window?.behaviorLineName ?? '');
  if (/未爆发/.test(name)) {
    return {
      kind: 'resource-state-inactive',
      stateElementId: XIAOYU_MECHANICS.stateElementId,
      sourceIdentity: window.sourceIdentity,
    };
  }
  if (/爆发/.test(name)) {
    return {
      kind: 'resource-state-active',
      stateElementId: XIAOYU_MECHANICS.stateElementId,
      sourceIdentity: window.sourceIdentity,
    };
  }
  return fallback ?? { kind: 'always' };
}

function inferXiaoyuCommandForTarget(targetControlSkillId) {
  const target = Number(targetControlSkillId);
  if (
    [
      XIAOYU_MECHANICS.chargedControlSkillId,
      XIAOYU_MECHANICS.derivedChargedControlSkillId,
    ].includes(target)
  ) {
    return 'charged-attack';
  }
  if (
    [
      10101001,
      10101002,
      10101003,
      10101004,
      10101005,
      XIAOYU_MECHANICS.limitCounterControlSkillId,
    ].includes(target)
  ) {
    return 'normal-attack';
  }
  return null;
}

function resolveXiaoyuTargetSemanticName(window) {
  const controlSkillId = Number(window?.targetControlSkillId);
  const subSkillIndex = Number(window?.targetSubSkillIndex);
  if (controlSkillId === XIAOYU_MECHANICS.derivedChargedControlSkillId) {
    return subSkillIndex === 1 ? '强化特殊重击' : '特殊重击';
  }
  if (controlSkillId === XIAOYU_MECHANICS.chargedControlSkillId) {
    return subSkillIndex === 1 ? '连续重击' : '普通重击';
  }
  if (controlSkillId === XIAOYU_MECHANICS.limitCounterControlSkillId) {
    return '极限反击';
  }
  const normalControls = {
    10101001: '普攻 A1',
    10101002: '普攻 A2',
    10101003: '普攻 A3',
    10101004: '普攻 A4 / 爆发 A2',
    10101005: '普攻 A5 / 爆发 A3',
  };
  return (
    normalControls[controlSkillId] ??
    `control ${controlSkillId}/sub${subSkillIndex}`
  );
}

function createXiaoyuWindowKey({
  sourceControlSkillId,
  sourceSubSkillIndex,
  window,
}) {
  return [
    Number(sourceControlSkillId),
    Number(sourceSubSkillIndex),
    Number(window?.startFrame),
    Number(window?.endFrame),
    Number(window?.targetControlSkillId),
    Number(window?.targetSubSkillIndex),
  ].join('|');
}

function resolveXiaoyuBackupControlRole(controlSkillId) {
  return (
    {
      10101002: 'normal-attack-chain',
      10101003: 'normal-attack-chain',
      10101004: 'normal-attack-chain',
      10101005: 'normal-attack-chain',
      10101041: 'limit-counter-wrapper',
      10101042: 'derived-charged-execution',
      10101049: 'perfect-parry-runtime-support',
    }[controlSkillId] ?? 'declared-backup-unresolved'
  );
}

function formatXiaoyuActionKind(actionKind) {
  return (
    {
      'dodge-attack': '闪避攻击',
      'plunging-attack': '下落攻击',
      'star-skill': '星鸣技',
      'star-combo': '星结合击',
      ultimate: '星决技',
      'star-carry': '星携技',
      'limit-counter': '极限反击',
      'perfect-parry': '完美招架',
    }[actionKind] ?? actionKind
  );
}

function compareXiaoyuAuditRows(left, right) {
  return (
    String(left.publicActionIdentity).localeCompare(
      String(right.publicActionIdentity)
    ) ||
    Number(left.sourceSubSkillIndex) - Number(right.sourceSubSkillIndex) ||
    Number(left.inputWindow?.startFrame ?? -1) -
      Number(right.inputWindow?.startFrame ?? -1) ||
    String(left.rowIdentity).localeCompare(String(right.rowIdentity))
  );
}

function normalizeControlTransitionWindows(bridges = []) {
  const bridgeBySourceIdentity = new Map(
    (bridges ?? []).map(bridge => [bridge.sourceIdentity, bridge])
  );
  return normalizeActionTimingWindows(bridges).map(window => {
    const source = bridgeBySourceIdentity.get(window.sourceIdentity);
    return {
      ...window,
      allowedInputCommands: dedupeBy(
        source?.allowedInputCommands ?? [],
        value => value
      ),
      behaviorLineName: source?.behaviorLineName ?? null,
    };
  });
}

function resolveXiaoyuInputCommand(window, fallback = null) {
  const commands = window?.allowedInputCommands ?? [];
  if (commands.includes('charged-attack')) return 'charged-attack';
  if (commands.includes('normal-attack')) return 'normal-attack';
  if (commands.includes('star-skill')) return 'star-skill';
  if (commands.includes('ultimate')) return 'ultimate';
  return fallback;
}

function classifyVerifiedEventBridgeInputSemantics(window) {
  if (Number(window?.bridgeType) === 3) {
    return 'immediate-interrupt';
  }
  if (
    Number(window?.bridgeType) === 0 &&
    Number(window?.continuousAttackType) === 0
  ) {
    return 'buffered-until-frame';
  }
  if (
    Number(window?.bridgeType) === 0 &&
    Number(window?.continuousAttackType) === 1
  ) {
    return 'immediate-continuous';
  }
  return 'unresolved';
}

function classifyInputWindowAgainstOccupancy({ window, occupancyEndFrame }) {
  if (!window || occupancyEndFrame == null) return 'unresolved';
  const startFrame = Number(window.startFrame);
  const endFrame = Number(window.endFrame);
  if (startFrame === occupancyEndFrame) {
    return 'window-start-equals-generic-occupancy';
  }
  if (startFrame < occupancyEndFrame && occupancyEndFrame < endFrame) {
    return 'generic-occupancy-inside-window';
  }
  if (endFrame === occupancyEndFrame) {
    return 'window-end-equals-generic-occupancy';
  }
  if (endFrame < occupancyEndFrame) {
    return 'window-before-generic-occupancy';
  }
  if (startFrame > occupancyEndFrame) {
    return 'window-after-generic-occupancy';
  }
  return 'unresolved';
}

function createDerivedControlContracts({
  controlBindings,
  publicActionsByControl,
  defaultSelections,
  switchBindings,
  conditionDiscoveries,
}) {
  const publicControlIds = new Set(
    [...publicActionsByControl.keys()].map(Number).filter(Number.isInteger)
  );
  const discoveriesByOwnerControl = new Map(
    conditionDiscoveries.map(discovery => [
      `${discovery.ownerId}|${discovery.controlSkillId}`,
      discovery,
    ])
  );
  const contracts = [];

  for (const control of controlBindings) {
    const publicActions =
      publicActionsByControl.get(control.controlSkillId) ?? [];
    const actorActions = publicActions.filter(
      action => action.ownerKind === 'actor'
    );
    if (actorActions.length === 0) continue;
    const ownerGroups = groupBy(actorActions, action => Number(action.ownerId));
    for (const [rawOwnerId, ownerActions] of ownerGroups) {
      const ownerId = Number(rawOwnerId);
      if (!Number.isInteger(ownerId)) continue;
      const incomingEdges = switchBindings.filter(
        edge =>
          Number(edge.ownerId) === ownerId &&
          Number(edge.targetControlSkillId) === Number(control.controlSkillId)
      );
      const outgoingEdges = switchBindings.filter(
        edge =>
          Number(edge.ownerId) === ownerId &&
          Number(edge.sourceControlSkillId) === Number(control.controlSkillId)
      );
      const eventBridgeRelations = (control.variants ?? []).flatMap(variant =>
        (variant.eventBridges ?? [])
          .filter(
            bridge =>
              publicControlIds.has(Number(bridge.targetSkillId)) ||
              bridge.baseOnInput ||
              bridge.inputToIndex
          )
          .map(bridge => ({
            sourceSubSkillIndex: variant.subSkillIndex,
            targetControlSkillId: positiveIntegerOrNull(bridge.targetSkillId),
            targetSubSkillIndex:
              bridge.baseOnInput || bridge.inputToIndex
                ? nonNegativeIntegerOrNull(bridge.skillIndex)
                : null,
            startFrame: bridge.startFrame,
            endFrame: bridge.endFrame,
            baseOnInput: bridge.baseOnInput,
            inputToIndex: bridge.inputToIndex,
            bridgeType: bridge.bridgeType,
            continuousAttackType: bridge.continuousAttackType,
            sourceIdentity: bridge.sourceIdentity,
          }))
      );
      if (
        (control.variants ?? []).length <= 1 &&
        incomingEdges.length === 0 &&
        outgoingEdges.length === 0 &&
        eventBridgeRelations.length === 0
      ) {
        continue;
      }

      const discovery = discoveriesByOwnerControl.get(
        `${ownerId}|${control.controlSkillId}`
      );
      const publicVariants = dedupeBy(
        ownerActions.flatMap(action => action.publicVariants ?? []),
        variant => `${variant.index}|${variant.label}|${variant.sourceIdentity}`
      ).sort((left, right) => Number(left.index) - Number(right.index));
      const variants = (control.variants ?? []).map(variant => ({
        subSkillIndex: variant.subSkillIndex,
        playerSkillId: variant.playerSkillId,
        durationFrames:
          resolveDefaultFrameCount(variant.frameCounts)?.frameCount ?? null,
        sourceIdentity: variant.sourceIdentity,
      }));
      const inputTrigger = createControlInputTrigger(control.logic);
      const inputSelector = createDerivedInputSelector({
        ownerId,
        controlSkillId: control.controlSkillId,
        actionKinds: dedupeBy(
          ownerActions.map(action => action.actionKind),
          value => value
        ),
        publicVariants,
        variants,
        inputTrigger,
        eventBridgeRelations,
      });
      const resourceConditions = dedupeBy(
        incomingEdges
          .filter(edge => edge.condition?.kind === 'resource-at-least')
          .map(edge => ({
            targetSubSkillIndex: edge.targetSubSkillIndex,
            ...edge.condition,
            edgeIdentity: edge.edgeIdentity,
            applied: edge.applied,
          })),
        condition =>
          `${condition.edgeIdentity}|${condition.targetSubSkillIndex}`
      );
      const stateConditions = dedupeBy(
        incomingEdges
          .filter(edge => edge.condition?.kind === 'resource-state-active')
          .map(edge => ({
            targetSubSkillIndex: edge.targetSubSkillIndex,
            ...edge.condition,
            edgeIdentity: edge.edgeIdentity,
            applied: edge.applied,
          })),
        condition =>
          `${condition.edgeIdentity}|${condition.targetSubSkillIndex}`
      );
      const predecessorConditions = dedupeBy(
        incomingEdges
          .filter(edge => !edge.condition)
          .map(edge => ({
            kind: 'prior-action-switch-window',
            sourceControlSkillId: edge.sourceControlSkillId,
            sourceSubSkillIndex: edge.sourceSubSkillIndex,
            targetSubSkillIndex: edge.targetSubSkillIndex,
            activationFrame: edge.activationFrame,
            durationMs: edge.durationMs,
            edgeIdentity: edge.edgeIdentity,
            sourceIdentity: edge.sourceIdentity,
            applied: edge.applied,
          })),
        condition => condition.edgeIdentity
      );
      const automaticFollowUps = [];
      const candidateSources = [];
      if (inputSelector || eventBridgeRelations.length > 0) {
        candidateSources.push('input-controlled');
      }
      if (resourceConditions.length > 0) {
        candidateSources.push('resource-controlled');
      }
      if (stateConditions.length > 0 || predecessorConditions.length > 0) {
        candidateSources.push('state-controlled');
      }
      if (automaticFollowUps.length > 0) {
        candidateSources.push('automatic-follow-up');
      }
      const controlSources = dedupeBy(candidateSources, value => value);
      const controlSource =
        controlSources.length > 1
          ? 'combined'
          : (controlSources[0] ?? 'not-yet-modeled');
      const resolutionStatus = resolveDerivedControlStatus({
        discovery,
        inputSelector,
        inputRelations: eventBridgeRelations,
        incomingEdges,
        automaticFollowUps,
        controlSources,
      });
      const defaultSelection = defaultSelections.find(
        selection =>
          Number(selection.ownerId) === ownerId &&
          Number(selection.controlSkillId) === Number(control.controlSkillId)
      );
      contracts.push({
        contractIdentity: `actor:${ownerId}|control:${control.controlSkillId}|derived-control`,
        ownerKind: 'actor',
        ownerId,
        controlSkillId: Number(control.controlSkillId),
        actionKinds: dedupeBy(
          ownerActions.map(action => action.actionKind),
          value => value
        ),
        publicActions: ownerActions,
        controlSource,
        candidateControlSources: controlSources,
        decisionFrame: 0,
        inputSelector,
        inputRelations: eventBridgeRelations,
        holdRange: inputSelector?.holdRange ?? null,
        chargeTier: inputSelector?.options ?? [],
        resourceCondition: resourceConditions,
        resourceCost: resourceConditions.map(condition => ({
          resourceIdentity: condition.resourceIdentity,
          value: condition.value,
          targetSubSkillIndex: condition.targetSubSkillIndex,
          sourceIdentity: condition.sourceIdentity,
        })),
        stateCondition: [...stateConditions, ...predecessorConditions],
        automaticFollowUps,
        selectedSubSkillIndex: null,
        defaultSelection: defaultSelection ?? null,
        variants,
        sourceIdentity: dedupeBy(
          [
            control.sourcePath,
            control.logic?.sourceIdentity,
            ...publicVariants.map(variant => variant.sourceIdentity),
            ...incomingEdges.map(edge => edge.sourceIdentity),
            ...outgoingEdges.map(edge => edge.sourceIdentity),
            ...eventBridgeRelations.map(relation => relation.sourceIdentity),
          ].filter(Boolean),
          value => value
        ),
        resolutionStatus,
        reasons: createDerivedControlReasons({
          discovery,
          inputSelector,
          inputRelations: eventBridgeRelations,
          controlSources,
          automaticFollowUps,
        }),
      });
    }
  }

  return contracts.sort(
    (left, right) =>
      left.ownerId - right.ownerId ||
      left.controlSkillId - right.controlSkillId ||
      left.contractIdentity.localeCompare(right.contractIdentity)
  );
}

function createDerivedInputSelector({
  ownerId,
  controlSkillId,
  actionKinds,
  publicVariants,
  variants,
  inputTrigger,
  eventBridgeRelations,
}) {
  const chargedHoldCandidate =
    actionKinds.includes('charged-attack') &&
    inputTrigger?.mode === 'hold' &&
    publicVariants.length > 1;
  const bridgeInputCandidate = eventBridgeRelations.some(
    relation => relation.baseOnInput || relation.inputToIndex
  );
  if (!chargedHoldCandidate && !bridgeInputCandidate) return null;

  const orderedMappingReady =
    chargedHoldCandidate &&
    publicVariants.length === variants.length &&
    publicVariants.length > 1;
  const options = orderedMappingReady
    ? publicVariants.map((variant, index) => ({
        selectorIdentity: `actor:${ownerId}|control:${controlSkillId}|public-variant:${variant.index}`,
        label: variant.label,
        publicVariantIndex: variant.index,
        subSkillIndex: variants[index].subSkillIndex,
        playerSkillId: variants[index].playerSkillId,
        durationFrames: variants[index].durationFrames,
        chargeTier: index + 1,
        sourceIdentity: [
          variant.sourceIdentity,
          variants[index].sourceIdentity,
          inputTrigger.sourceIdentity,
        ].join('|'),
        resolutionStatus: 'applied',
      }))
    : publicVariants.map((variant, index) => ({
        selectorIdentity: `actor:${ownerId}|control:${controlSkillId}|public-variant:${variant.index}`,
        label: variant.label,
        publicVariantIndex: variant.index,
        subSkillIndex: null,
        playerSkillId: null,
        durationFrames: null,
        chargeTier: index + 1,
        sourceIdentity: variant.sourceIdentity,
        resolutionStatus: 'not-yet-modeled',
      }));
  return {
    kind: chargedHoldCandidate ? 'charge-tier' : 'follow-up-input',
    mode: inputTrigger?.mode ?? 'press',
    holdRange:
      inputTrigger?.mode === 'hold'
        ? {
            minimumHoldMs: inputTrigger.holdTriggerTimeMs,
            maximumHoldMs: null,
            sourceIdentity: inputTrigger.sourceIdentity,
            resolutionStatus: 'partially-resolved',
          }
        : null,
    options,
    eventBridgeRelations,
    sourceIdentity: dedupeBy(
      [
        inputTrigger?.sourceIdentity,
        ...eventBridgeRelations.map(relation => relation.sourceIdentity),
      ].filter(Boolean),
      value => value
    ),
    resolutionStatus: orderedMappingReady ? 'applied' : 'not-yet-modeled',
  };
}

function resolveDerivedControlStatus({
  discovery,
  inputSelector,
  inputRelations,
  incomingEdges,
  automaticFollowUps,
  controlSources,
}) {
  const statuses = [];
  if (inputSelector) statuses.push(inputSelector.resolutionStatus);
  if (!inputSelector && inputRelations.length > 0) {
    statuses.push('partially-resolved');
  }
  if (incomingEdges.length > 0) {
    statuses.push(
      incomingEdges.every(edge => edge.applied)
        ? 'applied'
        : incomingEdges.some(edge => edge.applied)
          ? 'partially-resolved'
          : normalizeDerivedControlResolutionStatus(discovery?.status)
    );
  }
  if (automaticFollowUps.length > 0) statuses.push('not-yet-modeled');
  if (controlSources.length === 0) {
    return normalizeDerivedControlResolutionStatus(discovery?.status);
  }
  if (statuses.every(status => status === 'applied')) return 'applied';
  if (
    statuses.some(
      status => status === 'applied' || status === 'partially-resolved'
    )
  ) {
    return 'partially-resolved';
  }
  if (statuses.includes('runtime-dependent')) return 'runtime-dependent';
  if (statuses.includes('static-evidence-gap')) return 'static-evidence-gap';
  return 'not-yet-modeled';
}

function normalizeDerivedControlResolutionStatus(status) {
  return status === 'variant-condition-not-yet-modeled' || !status
    ? 'not-yet-modeled'
    : status;
}

function createDerivedControlReasons({
  discovery,
  inputSelector,
  inputRelations,
  controlSources,
  automaticFollowUps,
}) {
  return dedupeBy(
    [
      ...(discovery?.reasons ?? []),
      ...(controlSources.length === 0
        ? ['derived-control-source-not-yet-modeled']
        : []),
      ...(inputSelector?.resolutionStatus === 'not-yet-modeled'
        ? ['input-selector-to-subskill-relation-not-yet-modeled']
        : []),
      ...(!inputSelector && inputRelations.length > 0
        ? ['event-bridge-input-semantics-partially-modeled']
        : []),
      ...(automaticFollowUps.length > 0
        ? ['automatic-follow-up-runtime-not-yet-modeled']
        : []),
    ],
    value => value
  );
}

function createActionVariantConditionDiscoveries({
  controlBindings,
  publicActionsByControl,
  defaultSelections,
  switchBindings,
  specialResourceCatalog,
  allIndexedElements,
}) {
  const multiVariantControlIds = new Set(
    controlBindings
      .filter(control => (control.variants ?? []).length > 1)
      .map(control => Number(control.controlSkillId))
  );
  const globalCandidatesByControl = discoverGlobalVariantConditionCandidates({
    allIndexedElements,
    targetControlIds: multiVariantControlIds,
  });
  const profileByOwnerId = new Map(
    (specialResourceCatalog.profiles ?? []).map(profile => [
      Number(profile.ownerId),
      profile,
    ])
  );
  const discoveries = [];

  for (const control of controlBindings) {
    if ((control.variants ?? []).length <= 1) continue;
    const publicActions =
      publicActionsByControl.get(control.controlSkillId) ?? [];
    const ownerGroups = groupBy(publicActions, action =>
      Number(action.ownerId)
    );
    for (const [rawOwnerId, ownerActions] of ownerGroups) {
      const ownerId = Number(rawOwnerId);
      if (!Number.isInteger(ownerId)) continue;
      const edges = switchBindings.filter(
        edge =>
          Number(edge.ownerId) === ownerId &&
          Number(edge.targetControlSkillId) === Number(control.controlSkillId)
      );
      const appliedEdges = edges.filter(edge => edge.applied);
      const unresolvedEdges = edges.filter(edge => !edge.applied);
      const globalCandidates =
        globalCandidatesByControl.get(Number(control.controlSkillId)) ?? [];
      const profile = profileByOwnerId.get(ownerId) ?? null;
      const resourceEdges = edges.filter(
        edge => edge.condition?.resourceIdentity
      );
      const publicVariants = dedupeBy(
        ownerActions.flatMap(action => action.publicVariants ?? []),
        variant => `${variant.index}|${variant.label}|${variant.sourceIdentity}`
      );
      const defaultSelection = defaultSelections.find(
        selection =>
          Number(selection.ownerId) === ownerId &&
          Number(selection.controlSkillId) === Number(control.controlSkillId)
      );
      const status = classifyVariantConditionDiscovery({
        appliedEdges,
        unresolvedEdges,
      });
      const identity = `actor:${ownerId}|control:${control.controlSkillId}|variant-condition-discovery`;
      discoveries.push({
        identity,
        ownerKind: ownerActions[0]?.ownerKind ?? 'unknown',
        ownerId,
        controlSkillId: Number(control.controlSkillId),
        actionKinds: dedupeBy(
          ownerActions.map(action => action.actionKind),
          value => value
        ),
        publicActions: dedupeBy(ownerActions, action =>
          [
            action.sourceSkillId,
            action.actionKind,
            action.actionVariantIndex,
            action.attackSequenceIndex ?? '',
          ].join('|')
        ),
        publicVariants,
        variantCount: control.variants.length,
        variantDurations: control.variants.map(variant => ({
          subSkillIndex: variant.subSkillIndex,
          playerSkillId: variant.playerSkillId,
          frameCounts: variant.frameCounts,
          sourceIdentity: variant.sourceIdentity,
        })),
        defaultSelection: defaultSelection ?? null,
        status,
        sourceFamilies: [
          {
            kind: 'skillsub-logic',
            status: control.logic?.applied
              ? 'checked-no-subskill-selector'
              : 'static-evidence-gap',
            inputTriggerType: control.logic?.inputTriggerType ?? null,
            holdTriggerTimeMs: control.logic?.holdTriggerTimeMs ?? null,
            sourceIdentity: control.logic?.sourceIdentity ?? null,
          },
          {
            kind: 'public-skill-slots-and-labels',
            status:
              publicVariants.length > 1
                ? 'candidate-labels-only'
                : 'checked-no-distinct-public-input-variant',
            variants: publicVariants,
            sourceIdentities: ownerActions
              .map(action => action.sourceIdentity)
              .filter(Boolean),
          },
          {
            kind: 'battle-switch-relations',
            status:
              appliedEdges.length > 0
                ? unresolvedEdges.length > 0
                  ? 'partially-applied'
                  : 'applied'
                : unresolvedEdges.length > 0 || globalCandidates.length > 0
                  ? 'candidate-not-yet-modeled'
                  : 'checked-no-relation-found',
            appliedEdgeCount: appliedEdges.length,
            unresolvedEdgeCount: unresolvedEdges.length,
            edges: edges.map(edge => ({
              edgeIdentity: edge.edgeIdentity,
              targetSubSkillIndex: edge.targetSubSkillIndex,
              condition: edge.condition,
              reasons: edge.reasons,
              sourceIdentity: edge.sourceIdentity,
              applied: edge.applied,
            })),
            globalCandidates,
          },
          {
            kind: 'resource-state-judgment',
            status: resourceEdges.some(edge => edge.applied)
              ? 'applied'
              : profile || resourceEdges.length > 0
                ? 'candidate-not-yet-modeled'
                : 'checked-no-resource-condition-found',
            resourceIdentity: profile?.resourceIdentity ?? null,
            stateElementIds: (profile?.stateElements ?? []).map(
              state => state.elementId
            ),
            edgeCount: resourceEdges.length,
            sourceIdentity: profile?.sourceIdentity ?? null,
          },
          {
            kind: 'input-hold-chain',
            status: control.variants.some(
              variant => (variant.eventBridges ?? []).length > 0
            )
              ? 'candidate-input-relations-found'
              : 'checked-no-variant-selecting-input-relation',
            inputTrigger: createControlInputTrigger(control.logic),
            variants: control.variants.map(variant => ({
              subSkillIndex: variant.subSkillIndex,
              eventBridgeCount: (variant.eventBridges ?? []).length,
              targetControlSkillIds: [
                ...new Set(
                  (variant.eventBridges ?? [])
                    .map(bridge => positiveIntegerOrNull(bridge.targetSkillId))
                    .filter(value => value != null)
                ),
              ],
              inputControlledBridgeCount: (variant.eventBridges ?? []).filter(
                bridge => bridge.baseOnInput || bridge.inputToIndex
              ).length,
              automaticBridgeCount: (variant.eventBridges ?? []).filter(
                bridge =>
                  positiveIntegerOrNull(bridge.targetSkillId) != null &&
                  !bridge.baseOnInput &&
                  !bridge.inputToIndex
              ).length,
              sourceIdentity: variant.sourceIdentity,
            })),
          },
        ],
        reasons:
          status === 'variant-condition-not-yet-modeled'
            ? ['variant-condition-source-families-audited-not-yet-modeled']
            : dedupeBy(
                unresolvedEdges.flatMap(edge => edge.reasons ?? []),
                value => value
              ),
      });
    }
  }

  return discoveries.sort(
    (left, right) =>
      left.ownerId - right.ownerId ||
      left.controlSkillId - right.controlSkillId ||
      left.identity.localeCompare(right.identity)
  );
}

function discoverGlobalVariantConditionCandidates({
  allIndexedElements,
  targetControlIds,
}) {
  const result = new Map();
  const records = dedupeBy(
    [...(allIndexedElements?.values() ?? [])].flat(),
    record => String(record.pathId)
  );
  for (const record of records) {
    const tree = record.typetree ?? {};
    const sourceIdentity = `battle-element-assets.jsonl#path_id=${record.pathId}`;
    const scriptPathId = String(tree.m_Script?.m_PathID ?? '');
    if (scriptPathId === BATTLE_MECHANIC_SCRIPT_PATH_IDS.switchSkillIndex) {
      const targetControlSkillId = integerOrNull(tree.skillID);
      const targetSubSkillIndex = integerOrNull(tree.subSkillIndex);
      if (
        targetControlIds.has(targetControlSkillId) &&
        targetSubSkillIndex != null
      ) {
        appendMapArray(result, targetControlSkillId, {
          kind: 'verified-switch-skill-index-element-candidate',
          elementId: integerOrNull(tree.elementConfigId),
          targetSubSkillIndex,
          durationMs: finiteNumberOrNull(tree.duration ?? tree.time),
          sourceIdentity,
          status: 'candidate-not-yet-linked-to-public-action-lifecycle',
        });
      }
    }
    for (const [effectIndex, effect] of (
      tree.triggerEffectList ?? []
    ).entries()) {
      const targetControlSkillId =
        integerOrNull(effect.effectType) === 1
          ? integerOrNull(effect.param1)
          : null;
      const targetSubSkillIndex = integerOrNull(effect.param3);
      if (
        !targetControlIds.has(targetControlSkillId) ||
        targetSubSkillIndex == null
      ) {
        continue;
      }
      appendMapArray(result, targetControlSkillId, {
        kind: 'legacy-trigger-effect-variant-candidate',
        elementId: integerOrNull(tree.elementConfigId),
        targetSubSkillIndex,
        triggerType: integerOrNull(tree.triggerType),
        triggerConditions: tree.triggerConditionList ?? [],
        sourceIdentity: `${sourceIdentity}#triggerEffectList[${effectIndex}]`,
        status: 'candidate-semantics-not-yet-modeled',
      });
    }
  }
  for (const [controlSkillId, candidates] of result) {
    result.set(
      controlSkillId,
      dedupeBy(
        candidates,
        candidate =>
          `${candidate.kind}|${candidate.elementId}|${candidate.targetSubSkillIndex}|${candidate.sourceIdentity}`
      )
    );
  }
  return result;
}
function classifyVariantConditionDiscovery({ appliedEdges, unresolvedEdges }) {
  if (appliedEdges.length > 0 && unresolvedEdges.length > 0) {
    return 'partially-resolved';
  }
  if (appliedEdges.length > 0) return 'resolved';
  if (unresolvedEdges.length === 0) {
    return 'variant-condition-not-yet-modeled';
  }
  const categories = new Set(
    unresolvedEdges
      .flatMap(edge => edge.reasons ?? [])
      .map(classifyProductGapReason)
  );
  if (categories.size === 1 && categories.has('runtime-dependent')) {
    return 'runtime-dependent';
  }
  return 'static-evidence-gap';
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

function findSkillControl(
  skillId,
  battleTargetTypeContract,
  runtimePolicy = null
) {
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
      const gameplayGraph = collectSkillPlayerGameplayGraph(directory, value);
      const bulletLaunches = collectBulletLaunchContracts(
        value,
        runtimePolicy,
        gameplayGraph
      );
      return {
        skillId,
        runtimePolicy,
        directory,
        filePath,
        value,
        elementRefs,
        bulletLaunches,
        gameplayGraph,
        playerEventBridges: collectSkillPlayerEventBridges(
          value,
          gameplayGraph
        ),
        behaviorTriggers: collectBehaviorTriggers(
          directory,
          filePath,
          elementRefs,
          gameplayGraph
        ),
        semanticBehaviorTriggers: collectSemanticBehaviorTriggers(
          directory,
          filePath,
          elementRefs,
          battleTargetTypeContract,
          gameplayGraph
        ),
      };
    }
  }
  return null;
}

function collectBulletLaunchContracts(
  skillControl,
  runtimePolicy = null,
  gameplayGraph = null
) {
  const frameRate =
    positiveNumberOrNull(skillControl.skillControlData?.framePerSecond) ?? 60;
  const launches = [];
  for (const {
    subSkillIndex,
    trackIndex,
    behaviorLineIndex,
    behavior,
  } of gameplayGraph?.behaviors ?? []) {
    const configs = behavior?.value?.bulletShootDataConfigs;
    const startFrame = integerOrNull(behavior?.value?.startFrame);
    if (!Array.isArray(configs) || startFrame == null || startFrame < 0) {
      continue;
    }
    for (const [configIndex, config] of configs.entries()) {
      const repeatCount = Math.max(1, integerOrNull(config.bulletCount) ?? 1);
      for (const [bulletIndex, bullet] of (config.bullets ?? []).entries()) {
        const bulletId = positiveIntegerOrNull(bullet?.bulletId);
        const delayMs = nonNegativeNumberOrNull(bullet?.delayTime) ?? 0;
        if (!bulletId) continue;
        const injection = readBulletInjectionContract(bulletId);
        const injectedElements =
          runtimePolicy?.bulletInjectionMode === 'recursive-static-timed'
            ? collectStaticTimedBulletInjectionElements(bulletId)
            : runtimePolicy?.bulletInjectionMode === 'recursive-immediate'
              ? collectImmediateBulletInjectionElements(bulletId)
              : (injection.elements ?? []);
        for (let repeatIndex = 0; repeatIndex < repeatCount; repeatIndex += 1) {
          for (const [elementIndex, element] of injectedElements.entries()) {
            const totalDelayMs =
              delayMs + (nonNegativeNumberOrNull(element.delayMs) ?? 0);
            const delayFrames = Math.round((totalDelayMs / 1000) * frameRate);
            const launchFrame = startFrame + delayFrames;
            launches.push({
              subSkillIndex,
              trackIndex,
              behaviorLineIndex,
              behaviorPathId: behavior.pathId,
              configIndex,
              bulletIndex,
              repeatIndex,
              elementIndex,
              bulletId: element.bulletId ?? bulletId,
              rootBulletId: bulletId,
              elementId: element.elementId,
              startFrame,
              delayMs: totalDelayMs,
              delayFrames,
              launchFrame,
              targetType: element.targetType ?? injection.targetType,
              targetKind:
                (element.targetType ?? injection.targetType) === 1
                  ? 'skill-target'
                  : 'runtime-target',
              launchIdentity: [
                `control:${skillControl.skillControlData.skillId}`,
                `sub:${subSkillIndex}`,
                `behavior:${behavior.pathId}`,
                `config:${configIndex}`,
                `bullet:${bulletId}:${bulletIndex}:${repeatIndex}`,
                ...(element.bulletId && element.bulletId !== bulletId
                  ? [`nested-bullet:${element.bulletId}`]
                  : []),
                ...(element.executionIdentity
                  ? [`execution:${element.executionIdentity}`]
                  : []),
                `element:${element.elementId}:${elementIndex}`,
              ].join('|'),
              sourceIdentity: [
                `${relativeExternalPath(behavior.filePath)}#startFrame|bulletShootDataConfigs[${configIndex}].bullets[${bulletIndex}]`,
                injection.sourceIdentity,
                element.sourceIdentity,
              ]
                .filter(Boolean)
                .join('|'),
              status:
                (element.targetType ?? injection.targetType) === 1
                  ? 'verified-projectile-launch-ready'
                  : (element.executionStatus ??
                    'runtime-projectile-target-dependent'),
            });
          }
        }
      }
    }
  }
  return dedupeBy(launches, launch => launch.launchIdentity).sort(
    (left, right) =>
      left.subSkillIndex - right.subSkillIndex ||
      left.launchFrame - right.launchFrame ||
      left.launchIdentity.localeCompare(right.launchIdentity)
  );
}

function readBulletInjectionContract(bulletId) {
  if (bulletInjectionContractCache.has(bulletId)) {
    return bulletInjectionContractCache.get(bulletId);
  }
  const directory = path.join(
    BATTLE_ROOT,
    'BulletList',
    `ast_bullet_${bulletId}.asset`,
    'MonoBehaviour'
  );
  if (!fs.existsSync(directory)) {
    const missing = {
      bulletId,
      targetType: null,
      elements: [],
      sourceIdentity: null,
      status: 'bullet-asset-missing',
    };
    bulletInjectionContractCache.set(bulletId, missing);
    return missing;
  }
  const candidates = fs
    .readdirSync(directory)
    .filter(name => name.endsWith('.json'))
    .map(name => path.join(directory, name));
  let selected = null;
  for (const filePath of candidates) {
    const value = readUnityJson(filePath);
    if (!Array.isArray(value?.bulletLogicObjects)) continue;
    selected = { filePath, value };
    break;
  }
  const elements = [];
  const immediateNestedBullets = [];
  const staticTimedElements = [];
  const staticTimedNestedBullets = [];
  if (selected) {
    for (const [logicIndex, logic] of (
      selected.value.bulletLogicObjects ?? []
    ).entries()) {
      const timing = resolveStaticBulletLogicTiming(logic);
      for (const [actionIndex, action] of (
        logic?.actionObjects ?? []
      ).entries()) {
        const objectPath = `bulletLogicObjects[${logicIndex}].actionObjects[${actionIndex}]`;
        const actionDelayMs =
          nonNegativeNumberOrNull(action?.doDelayActionTime) ?? 0;
        if (
          Number(action?.actionType) === 0 &&
          Array.isArray(action?.actionElementParameter?.elementInfos)
        ) {
          for (const [
            index,
            info,
          ] of action.actionElementParameter.elementInfos.entries()) {
            const elementId = positiveIntegerOrNull(info?.elementId);
            if (!elementId) continue;
            const sourceIdentity = `${relativeExternalPath(selected.filePath)}#${objectPath}.actionElementParameter.elementInfos[${index}].elementId`;
            elements.push({
              bulletId,
              elementId,
              sourceIdentity,
            });
            if (timing.applied) {
              staticTimedElements.push({
                bulletId,
                elementId,
                targetType: integerOrNull(selected.value.bulletTargetType),
                delayMs: timing.delayMs + actionDelayMs,
                executionIdentity: [
                  `bullet:${bulletId}`,
                  `logic:${logicIndex}`,
                  `action:${actionIndex}`,
                  `element:${index}`,
                ].join('|'),
                executionStatus: timing.status,
                sourceIdentity: [timing.sourceIdentity, sourceIdentity].join(
                  '|'
                ),
              });
            }
          }
        }

        if (Number(action?.actionType) !== 3) continue;
        for (const [configIndex, config] of (
          action?.actionSummonBulletParameter?.bulletShootDataConfigs ?? []
        ).entries()) {
          for (const [nestedIndex, nestedBullet] of (
            config?.bullets ?? []
          ).entries()) {
            const nestedBulletId = positiveIntegerOrNull(
              nestedBullet?.bulletId
            );
            const nestedDelayMs =
              nonNegativeNumberOrNull(nestedBullet?.delayTime) ?? 0;
            if (!nestedBulletId) continue;
            const sourceIdentity = `${relativeExternalPath(selected.filePath)}#${objectPath}.actionSummonBulletParameter.bulletShootDataConfigs[${configIndex}].bullets[${nestedIndex}]`;
            if (actionDelayMs === 0 && nestedDelayMs === 0) {
              immediateNestedBullets.push({
                bulletId: nestedBulletId,
                sourceIdentity,
              });
            }
            if (timing.applied) {
              staticTimedNestedBullets.push({
                bulletId: nestedBulletId,
                delayMs: timing.delayMs + actionDelayMs + nestedDelayMs,
                executionIdentity: [
                  `bullet:${bulletId}`,
                  `logic:${logicIndex}`,
                  `action:${actionIndex}`,
                  `nested:${nestedBulletId}:${configIndex}:${nestedIndex}`,
                ].join('|'),
                executionStatus: timing.status,
                sourceIdentity: [timing.sourceIdentity, sourceIdentity].join(
                  '|'
                ),
              });
            }
          }
        }
      }
    }
  }
  const contract = {
    bulletId,
    targetType: integerOrNull(selected?.value?.bulletTargetType),
    elements: dedupeBy(elements, element => element.sourceIdentity),
    immediateNestedBullets: dedupeBy(
      immediateNestedBullets,
      nested => `${nested.bulletId}|${nested.sourceIdentity}`
    ),
    staticTimedElements: dedupeBy(
      staticTimedElements,
      element =>
        `${element.elementId}|${element.executionIdentity}|${element.delayMs}`
    ),
    staticTimedNestedBullets: dedupeBy(
      staticTimedNestedBullets,
      nested =>
        `${nested.bulletId}|${nested.executionIdentity}|${nested.delayMs}`
    ),
    sourceIdentity: selected
      ? `${relativeExternalPath(selected.filePath)}#bulletTargetType|bulletLogicObjects`
      : null,
    status:
      selected && elements.length
        ? 'verified-bullet-injection-contract-ready'
        : 'bullet-injection-contract-unresolved',
  };
  bulletInjectionContractCache.set(bulletId, contract);
  return contract;
}

function resolveStaticBulletLogicTiming(logic) {
  const conditions = logic?.conditionObjects ?? [];
  if (Number(logic?.operatorType ?? 0) !== 0 || conditions.length !== 1) {
    return {
      delayMs: 0,
      status: 'bullet-logic-condition-static-evidence-gap',
      sourceIdentity: null,
      applied: false,
    };
  }
  const condition = conditions[0];
  const conditionType = integerOrNull(condition?.conditionType);
  if (conditionType === 0) {
    return {
      delayMs: 0,
      status: 'scenario-assumed-zero-distance',
      sourceIdentity: 'conditionType=0(collision)|targetDistance=0',
      applied: true,
    };
  }
  if (conditionType === 3) {
    const lifeTime = nonNegativeNumberOrNull(condition?.lifeTime);
    return {
      delayMs: lifeTime ?? 0,
      status:
        lifeTime == null
          ? 'bullet-timer-duration-static-evidence-gap'
          : 'verified-bullet-timer-ready',
      sourceIdentity:
        lifeTime == null
          ? 'conditionType=3(timer)|lifeTime=unresolved'
          : `conditionType=3(timer)|lifeTime=${lifeTime}`,
      applied: lifeTime != null,
    };
  }
  return {
    delayMs: 0,
    status: `bullet-condition-${conditionType ?? 'unknown'}-runtime-dependent`,
    sourceIdentity: `conditionType=${conditionType ?? 'unknown'}`,
    applied: false,
  };
}

function collectImmediateBulletInjectionElements(
  bulletId,
  visited = new Set()
) {
  if (visited.has(bulletId)) return [];
  const nextVisited = new Set(visited);
  nextVisited.add(bulletId);
  const contract = readBulletInjectionContract(bulletId);
  return dedupeBy(
    [
      ...(contract.elements ?? []),
      ...(contract.immediateNestedBullets ?? []).flatMap(nested =>
        collectImmediateBulletInjectionElements(
          nested.bulletId,
          nextVisited
        ).map(element => ({
          ...element,
          sourceIdentity: [nested.sourceIdentity, element.sourceIdentity]
            .filter(Boolean)
            .join('|'),
        }))
      ),
    ],
    element =>
      `${element.bulletId}|${element.elementId}|${element.sourceIdentity}`
  );
}

function collectStaticTimedBulletInjectionElements(
  bulletId,
  visited = new Set(),
  accumulatedDelayMs = 0,
  parentSources = []
) {
  if (visited.has(bulletId)) return [];
  const nextVisited = new Set(visited);
  nextVisited.add(bulletId);
  const contract = readBulletInjectionContract(bulletId);
  return dedupeBy(
    [
      ...(contract.staticTimedElements ?? []).map(element => ({
        ...element,
        delayMs:
          accumulatedDelayMs + (nonNegativeNumberOrNull(element.delayMs) ?? 0),
        sourceIdentity: [...parentSources, element.sourceIdentity]
          .filter(Boolean)
          .join('|'),
      })),
      ...(contract.staticTimedNestedBullets ?? []).flatMap(nested =>
        collectStaticTimedBulletInjectionElements(
          nested.bulletId,
          nextVisited,
          accumulatedDelayMs + (nonNegativeNumberOrNull(nested.delayMs) ?? 0),
          [...parentSources, nested.sourceIdentity]
        )
      ),
    ],
    element =>
      [
        element.bulletId,
        element.elementId,
        element.delayMs,
        element.executionIdentity,
        element.sourceIdentity,
      ].join('|')
  );
}

function walkUnityObject(value, visitor, pathParts = []) {
  if (!value || typeof value !== 'object') return;
  visitor(value, pathParts.join('.'));
  for (const [key, child] of Object.entries(value)) {
    if (!child || typeof child !== 'object') continue;
    if (Array.isArray(child)) {
      child.forEach((entry, index) =>
        walkUnityObject(entry, visitor, [...pathParts, `${key}[${index}]`])
      );
    } else {
      walkUnityObject(child, visitor, [...pathParts, key]);
    }
  }
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

function createRuntimeControlElementRefs(control) {
  const refs = [...(control.elementRefs ?? [])];
  if (!control.runtimePolicy?.bulletInjectionMode) {
    return refs;
  }
  const seenElementIds = new Set(
    refs
      .filter(ref => Number.isInteger(ref.elementIdHint))
      .map(ref => `${ref.mapIndex}|${ref.elementIdHint}`)
  );
  const nextElementIndexByMap = new Map();
  for (const ref of refs) {
    nextElementIndexByMap.set(
      ref.mapIndex,
      Math.max(
        nextElementIndexByMap.get(ref.mapIndex) ?? 0,
        Number(ref.elementIndex) + 1
      )
    );
  }
  for (const launch of control.bulletLaunches ?? []) {
    const key = `${launch.subSkillIndex}|${launch.elementId}`;
    if (seenElementIds.has(key)) continue;
    const elementIndex = nextElementIndexByMap.get(launch.subSkillIndex) ?? 0;
    refs.push({
      mapIndex: launch.subSkillIndex,
      referenceKind: 'bulletElements',
      elementIndex,
      fileId: 0,
      pathId: null,
      elementIdHint: launch.elementId,
      sourceIdentity: `generatedProjectileElements[subSkillIndex=${launch.subSkillIndex},elementId=${launch.elementId}]|${launch.sourceIdentity}`,
    });
    nextElementIndexByMap.set(launch.subSkillIndex, elementIndex + 1);
    seenElementIds.add(key);
  }
  return refs;
}

function collectSkillPlayerEventBridges(skillControl, gameplayGraph = null) {
  const result = (skillControl.skillControlData?.skillPlayers ?? []).map(
    () => []
  );
  for (const {
    subSkillIndex,
    trackIndex,
    track,
    behaviorLineIndex,
    behaviorLine,
    behavior,
  } of gameplayGraph?.behaviors ?? []) {
    if (!behavior || !isEventBridgeBehavior(behavior.value)) continue;
    const startFrame = integerOrNull(behavior.value.startFrame);
    const frameCount = integerOrNull(behavior.value.frameCount);
    if (
      startFrame == null ||
      startFrame < 0 ||
      frameCount == null ||
      frameCount <= 0
    ) {
      continue;
    }
    result[subSkillIndex].push({
      subSkillIndex,
      trackIndex,
      behaviorLineIndex,
      behaviorLineName:
        String(behaviorLine.name ?? behaviorLine.trackName ?? '').trim() ||
        null,
      trackPathId: track?.pathId ?? null,
      behaviorPathId: behavior.pathId,
      startFrame,
      frameCount,
      endFrame: startFrame + frameCount,
      allowAttack:
        behavior.value.allowAttack === true ||
        Number(behavior.value.allowAttack) === 1,
      allowedInputCommands: collectBehaviorAllowedInputCommands(behavior.value),
      bridgeType: integerOrNull(behavior.value.bridge),
      continuousAttackType: integerOrNull(behavior.value.type),
      interruptBehavior: integerOrNull(behavior.value.interruptBehavior),
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
    });
  }
  return result;
}

function collectBehaviorAllowedInputCommands(value = {}) {
  return [
    ['allowAttack', 'normal-attack'],
    ['allowSkill1', 'charged-attack'],
    ['allowSkill2', 'star-skill'],
    ['allowSkill3', 'ultimate'],
    ['allowDodge', 'dodge'],
    ['allowJump', 'jump'],
    ['allowJointStrikeSkill', 'star-combo'],
    ['allowCountermeasuresSkill', 'perfect-parry'],
  ]
    .filter(([field]) => value[field] === true || Number(value[field]) === 1)
    .map(([, command]) => command);
}

function createUnityObjectFileIndex(directory) {
  const cacheKey = path.resolve(directory);
  const cached = unityObjectFileIndexCache.get(cacheKey);
  if (cached) return cached;
  const result = new Map();
  if (!fs.existsSync(directory)) {
    unityObjectFileIndexCache.set(cacheKey, result);
    return result;
  }
  for (const name of fs.readdirSync(directory).sort()) {
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
  unityObjectFileIndexCache.set(cacheKey, result);
  return result;
}

function collectSubSkillObjectIndex(root) {
  const result = new Map();
  if (!fs.existsSync(root)) return result;
  const ownerDirectories = fs
    .readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(root, entry.name))
    .sort();
  for (const ownerDirectory of ownerDirectories) {
    const subSkillDirectory = path.join(ownerDirectory, 'SubSkill');
    if (!fs.existsSync(subSkillDirectory)) continue;
    const assetDirectories = fs
      .readdirSync(subSkillDirectory, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => path.join(subSkillDirectory, entry.name, 'MonoBehaviour'))
      .filter(directory => fs.existsSync(directory))
      .sort();
    for (const directory of assetDirectories) {
      for (const [pathId, indexed] of createUnityObjectFileIndex(directory)) {
        const entries = result.get(pathId) ?? [];
        entries.push(indexed);
        result.set(pathId, entries);
      }
    }
  }
  for (const entries of result.values()) {
    entries.sort((left, right) => left.filePath.localeCompare(right.filePath));
  }
  return result;
}

function createExternalGameplayObjectFileIndex() {
  if (externalGameplayObjectFileIndexCache) {
    return externalGameplayObjectFileIndexCache;
  }
  externalGameplayObjectFileIndexCache = collectSubSkillObjectIndex(
    HERO_SUBSKILL_ROOT
  );
  return externalGameplayObjectFileIndexCache;
}

function createPetExternalGameplayObjectFileIndex() {
  if (petExternalGameplayObjectFileIndexCache) {
    return petExternalGameplayObjectFileIndexCache;
  }
  petExternalGameplayObjectFileIndexCache = collectSubSkillObjectIndex(
    PET_SUBSKILL_ROOT
  );
  return petExternalGameplayObjectFileIndexCache;
}

function resolveExternalGameplayObjectFileIndex(directory) {
  const assetDirectory = path.basename(path.dirname(directory));
  if (/^skill_control_5\d+\.asset$/i.test(assetDirectory)) {
    return createPetExternalGameplayObjectFileIndex();
  }
  return createExternalGameplayObjectFileIndex();
}

function readGameplayObjectReference(directory, reference) {
  const fileId = integerOrNull(reference?.m_FileID) ?? 0;
  if (fileId === 0) {
    return readReferencedUnityObject(
      createUnityObjectFileIndex(directory),
      reference
    );
  }
  const pathId = String(reference?.m_PathID ?? '');
  const candidates =
    resolveExternalGameplayObjectFileIndex(directory).get(pathId) ?? [];
  const completeCandidates = candidates.filter(
    candidate => !readUnityJson(candidate.filePath).stubOnly
  );
  if (completeCandidates.length !== 1) return null;
  const selected = completeCandidates[0];
  return {
    pathId,
    filePath: selected.filePath,
    value: readUnityJson(selected.filePath),
  };
}

function collectSkillPlayerGameplayGraph(directory, skillControl) {
  const tracks = [];
  const behaviors = [];
  const unresolvedTrackReferences = [];
  const unresolvedBehaviorReferences = [];
  for (const [subSkillIndex, player] of (
    skillControl.skillControlData?.skillPlayers ?? []
  ).entries()) {
    for (const [trackIndex, trackRef] of (
      player.skillTrackDatas ?? []
    ).entries()) {
      const track = readGameplayObjectReference(directory, trackRef);
      if (!track || track.value?.stubOnly) {
        unresolvedTrackReferences.push({
          subSkillIndex,
          trackIndex,
          fileId: integerOrNull(trackRef?.m_FileID),
          pathId: String(trackRef?.m_PathID ?? ''),
        });
        continue;
      }
      tracks.push({ subSkillIndex, trackIndex, track });
      for (const [behaviorLineIndex, behaviorLine] of (
        track.value?.behaviorlineControl ?? []
      ).entries()) {
        for (const [behaviorIndex, behaviorRef] of (
          behaviorLine.behaviorList ?? []
        ).entries()) {
          const behavior = readGameplayObjectReference(
            path.dirname(track.filePath),
            behaviorRef
          );
          if (!behavior || behavior.value?.stubOnly) {
            unresolvedBehaviorReferences.push({
              subSkillIndex,
              trackIndex,
              behaviorLineIndex,
              behaviorIndex,
              fileId: integerOrNull(behaviorRef?.m_FileID),
              pathId: String(behaviorRef?.m_PathID ?? ''),
              trackSourceIdentity: relativeExternalPath(track.filePath),
            });
            continue;
          }
          behaviors.push({
            subSkillIndex,
            trackIndex,
            track,
            behaviorLineIndex,
            behaviorLine,
            behaviorIndex,
            behavior,
          });
        }
      }
    }
  }
  return {
    tracks,
    behaviors,
    unresolvedTrackReferences,
    unresolvedBehaviorReferences,
    status:
      unresolvedTrackReferences.length === 0 &&
      unresolvedBehaviorReferences.length === 0
        ? 'verified-gameplay-graph-ready'
        : 'gameplay-graph-reference-unresolved',
  };
}

function createGameplayBehaviorSubSkillIndex(gameplayGraph) {
  const result = new Map();
  for (const entry of gameplayGraph?.behaviors ?? []) {
    const pathId = String(entry.behavior?.pathId ?? '');
    if (!pathId) continue;
    const indexes = result.get(pathId) ?? new Set();
    indexes.add(Number(entry.subSkillIndex));
    result.set(pathId, indexes);
  }
  return new Map(
    [...result.entries()].map(([pathId, indexes]) => [
      pathId,
      [...indexes].sort((left, right) => left - right),
    ])
  );
}

function collectGameplayBehaviorSourceFiles(directory, mainFilePath, graph) {
  const localFiles = fs.existsSync(directory)
    ? fs
        .readdirSync(directory)
        .filter(name => name.endsWith('.json'))
        .map(name => path.join(directory, name))
        .filter(filePath => filePath !== mainFilePath)
    : [];
  const mainHash = fs.existsSync(mainFilePath)
    ? sha256File(mainFilePath)
    : null;
  const files = dedupeBy(
    [
      ...localFiles,
      ...(graph?.behaviors ?? []).map(entry => entry.behavior.filePath),
    ],
    filePath => path.resolve(filePath).toLowerCase()
  ).sort();
  // Re-export artifacts can leave byte-identical `__2.json` copies of the
  // main control file next to the canonical export. Such duplicates are not
  // behavior sources and would otherwise publish bogus frameless triggers
  // for every resource-map element reference.
  const byContent = new Map();
  for (const filePath of files) {
    if (mainHash != null && sha256File(filePath) === mainHash) continue;
    const contentHash = sha256File(filePath);
    const current = byContent.get(contentHash);
    const score = (candidate) =>
      path.basename(candidate).endsWith('.json') &&
      /__\d+\.json$/.test(path.basename(candidate))
        ? 1
        : 0;
    if (!current || score(filePath) < score(current)) {
      byContent.set(contentHash, filePath);
    }
  }
  return [...byContent.values()].sort();
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

function collectBehaviorTriggers(
  directory,
  mainFilePath,
  elementRefs,
  gameplayGraph = null
) {
  const wanted = new Set(elementRefs.map(ref => ref.pathId).filter(Boolean));
  const triggers = new Map([...wanted].map(pathId => [pathId, []]));
  const subSkillIndexesByBehavior =
    createGameplayBehaviorSubSkillIndex(gameplayGraph);
  for (const filePath of collectGameplayBehaviorSourceFiles(
    directory,
    mainFilePath,
    gameplayGraph
  )) {
    const name = path.basename(filePath);
    const value = readUnityJson(filePath);
    const referencedPathIds = collectReferencedPathIds(value);
    for (const pathId of referencedPathIds) {
      if (!wanted.has(pathId)) continue;
      const target = resolveBehaviorElementTarget(value, pathId);
      const behaviorPathId = path.basename(name, '.json').split('__').at(-1);
      triggers.get(pathId).push({
        behaviorPathId,
        subSkillIndexes:
          subSkillIndexesByBehavior.get(String(behaviorPathId)) ?? null,
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
  for (const field of [
    'toOwnElementDatas',
    'toOwnElements',
    'toOwnElementBaseDatas',
  ]) {
    if (arrayContainsPathId(value?.[field], pathId)) {
      return {
        code: 4,
        kind: 'source-owner',
        sourceField: field,
      };
    }
  }
  if (arrayContainsPathId(value?.elementDataList, pathId)) {
    return createBehaviorTarget(
      integerOrNull(value.directInjectTargetType),
      'directInjectTargetType'
    );
  }
  for (const field of ['elementIdDatas', 'elementBaseDatas']) {
    if (arrayContainsPathId(value?.[field], pathId)) {
      return createBehaviorTarget(
        integerOrNull(value.targetType),
        'targetType'
      );
    }
  }
  return {
    code: null,
    kind: 'unresolved',
    sourceField: null,
  };
}

function createBehaviorTarget(code, sourceField) {
  const directInjectKinds = {
    0: 'source-owner',
    1: 'controlling-actor',
    2: 'controlling-kibo',
    3: 'team-actors',
    4: 'team-kibos',
    5: 'ally-kibo',
    6: 'enemy-kibo',
    7: 'owner-actor',
    8: 'owner-kibo',
  };
  const targetTypeKinds = {
    1: 'enemy',
    2: 'ally',
    3: 'any',
    4: 'source-owner',
  };
  return {
    code,
    kind:
      sourceField === 'directInjectTargetType'
        ? directInjectKinds[code] ?? 'unresolved'
        : targetTypeKinds[code] ?? 'unresolved',
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
  battleTargetTypeContract,
  gameplayGraph = null
) {
  const wanted = new Set(elementRefs.map(ref => ref.pathId).filter(Boolean));
  const triggers = new Map([...wanted].map(pathId => [pathId, []]));
  const subSkillIndexesByBehavior =
    createGameplayBehaviorSubSkillIndex(gameplayGraph);
  for (const filePath of collectGameplayBehaviorSourceFiles(
    directory,
    mainFilePath,
    gameplayGraph
  )) {
    const name = path.basename(filePath);
    const value = readUnityJson(filePath);
    const referencedPathIds = collectReferencedPathIds(value);
    for (const pathId of referencedPathIds) {
      if (!wanted.has(pathId)) continue;
      const target = resolveSemanticBehaviorElementTarget(
        value,
        pathId,
        battleTargetTypeContract
      );
      const behaviorPathId = path.basename(name, '.json').split('__').at(-1);
      triggers.get(pathId).push({
        behaviorPathId,
        subSkillIndexes:
          subSkillIndexesByBehavior.get(String(behaviorPathId)) ?? null,
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
          `${entry.behaviorPathId}|${entry.startFrame}|${entry.target.sourceField}|${entry.target.code}|${(entry.subSkillIndexes ?? []).join(',')}`
      ),
    ])
  );
}

function selectBehaviorTriggersForSubSkill(
  triggerMap,
  pathId,
  subSkillIndex,
  scopeMode
) {
  const entries = pathId ? (triggerMap?.get(pathId) ?? []) : [];
  if (scopeMode !== 'skill-player') return entries;
  const scopedEntries = entries.filter(
    entry =>
      Array.isArray(entry.subSkillIndexes) && entry.subSkillIndexes.length > 0
  );
  if (scopedEntries.length === 0) return entries;
  return scopedEntries.filter(entry =>
    entry.subSkillIndexes.includes(Number(subSkillIndex))
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
        Ally: targetMember(
          'ally',
          'runtime-dependent',
          'runtime-target-selection-ally'
        ),
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

function createElementInheritanceFieldAudit({
  allIndexedElementsById,
  controlBindings,
}) {
  const reachableElementIds = new Set(
    (controlBindings ?? []).flatMap(binding =>
      (binding.effectGraph ?? []).flatMap(root =>
        (root.nodes ?? [])
          .map(node => integerOrNull(node.elementId))
          .filter(Number.isInteger)
      )
    )
  );
  const records = [];
  for (const [elementId, entries] of allIndexedElementsById.entries()) {
    for (const entry of entries ?? []) {
      const inheritTypeRaw = integerOrNull(entry.typetree?.inheritType);
      if (![1, 2].includes(inheritTypeRaw)) continue;
      records.push({
        elementId: Number(elementId),
        pathId: entry.pathId,
        name: entry.typetree?.elementName ?? entry.name ?? null,
        inheritType: inheritTypeRaw === 1 ? 'self' : 'source',
        inheritTypeRaw,
        isTeamElement: Number(entry.typetree?.inherit) === 1,
        teamElementRaw: integerOrNull(entry.typetree?.inherit),
        reachabilityStatus: reachableElementIds.has(Number(elementId))
          ? 'reachable-battle-effect-graph'
          : 'legacy-unreachable-evidence',
        sourceIdentity: `battle-element-assets.jsonl#path_id=${entry.pathId}`,
      });
    }
  }
  const dedupedRecords = dedupeBy(
    records,
    record => `${record.elementId}|${record.pathId}`
  ).sort(
    (left, right) =>
      left.elementId - right.elementId ||
      String(left.pathId).localeCompare(String(right.pathId))
  );
  const matrix = Object.fromEntries(
    ['self', 'source'].flatMap(inheritType =>
      [false, true].map(isTeamElement => {
        const key = `${inheritType}|team-element-${isTeamElement ? 'true' : 'false'}`;
        return [
          key,
          dedupedRecords.filter(
            record =>
              record.inheritType === inheritType &&
              record.isTeamElement === isTeamElement
          ).length,
        ];
      })
    )
  );
  const nonMigratingRegressionElementIds = [101010206, 103002275];
  const nonMigratingRegressionEvidence = nonMigratingRegressionElementIds.map(
    elementId => {
      const entry = (allIndexedElementsById.get(elementId) ?? [])[0];
      return {
        elementId,
        name: entry?.typetree?.elementName ?? entry?.name ?? null,
        inheritType: 'none',
        inheritTypeRaw: integerOrNull(entry?.typetree?.inheritType),
        isTeamElement: Number(entry?.typetree?.inherit) === 1,
        teamElementRaw: integerOrNull(entry?.typetree?.inherit),
        expectedRuntimeStatus: 'fixed-owner-no-controlled-actor-transfer',
        sourceIdentity: entry
          ? `battle-element-assets.jsonl#path_id=${entry.pathId}`
          : null,
      };
    }
  );
  const legacyUnreachableElementIds = [
    101010030, 101010039, 101010081, 103002040, 103002079, 103002157,
  ];
  const legacyUnreachableEvidence = legacyUnreachableElementIds.map(
    elementId => {
      const candidates = dedupedRecords.filter(
        record => record.elementId === elementId
      );
      return {
        elementId,
        records: candidates,
        status:
          candidates.length > 0 &&
          candidates.every(
            record =>
              record.reachabilityStatus === 'legacy-unreachable-evidence'
          )
            ? 'legacy-unreachable-evidence'
            : 'inheritance-evidence-reachability-drift',
        applied: false,
        exclusionReason:
          'no-current-skill-list-or-reachable-character-combat-contract-reference',
      };
    }
  );
  return {
    schemaVersion: 1,
    kind: 'azpr-element-inheritance-field-audit',
    status: legacyUnreachableEvidence.every(
      evidence => evidence.status === 'legacy-unreachable-evidence'
    )
      ? 'verified-element-inheritance-field-audit-ready'
      : 'element-inheritance-field-audit-drift',
    policy: {
      controlledActorTransferGate: 'inheritType',
      teamElementField: 'inherit',
      teamElementAffectsTransfer: false,
      supportedInheritTypes: {
        0: 'none',
        1: 'self',
        2: 'source',
      },
    },
    summary: {
      nonzeroInheritTypeRecordCount: dedupedRecords.length,
      matrix,
      reachableRecordCount: dedupedRecords.filter(
        record => record.reachabilityStatus === 'reachable-battle-effect-graph'
      ).length,
      legacyUnreachableRecordCount: dedupedRecords.filter(
        record => record.reachabilityStatus === 'legacy-unreachable-evidence'
      ).length,
    },
    nonMigratingRegressionEvidence,
    legacyUnreachableEvidence,
    records: dedupedRecords,
  };
}

function createElementInheritanceFieldAuditMarkdown(audit) {
  const matrix = audit.summary.matrix;
  return [
    '# Controlled-actor inheritance field audit',
    '',
    `Status: \`${audit.status}\``,
    '',
    '## Field contract',
    '',
    '- Controlled-actor transfer is gated only by `inheritType`.',
    '- `inherit` is retained as `isTeamElement` evidence and does not gate transfer.',
    '',
    '## Nonzero inheritType matrix',
    '',
    `- Self / team=true: ${matrix['self|team-element-true']}`,
    `- Self / team=false: ${matrix['self|team-element-false']}`,
    `- Source / team=true: ${matrix['source|team-element-true']}`,
    `- Source / team=false: ${matrix['source|team-element-false']}`,
    '',
    '## Fixed-owner negative regressions',
    '',
    ...audit.nonMigratingRegressionEvidence.map(
      record =>
        `- ${record.elementId}: team=${record.isTeamElement}, inheritType=${record.inheritTypeRaw}, expected=${record.expectedRuntimeStatus}`
    ),
    '',
    '## Legacy unreachable evidence',
    '',
    ...audit.legacyUnreachableEvidence.map(
      record =>
        `- ${record.elementId}: ${record.status}; ${record.exclusionReason}`
    ),
    '',
  ].join('\n');
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
  const runtimeElementRefs = createRuntimeControlElementRefs(control);
  const elements = runtimeElementRefs.map(ref => {
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
      selectBehaviorTriggersForSubSkill(
        control.behaviorTriggers,
        ref.pathId,
        ref.mapIndex,
        control.runtimePolicy?.behaviorTriggerScope
      ),
      value => `${value.behaviorPathId}|${value.startFrame}`
    ).filter(trigger => Number.isInteger(trigger.startFrame));
    const elementId = Number(tree?.elementConfigId);
    const kiboZeroDistancePolicy =
      String(control.runtimePolicy?.sourceIdentity ?? '').startsWith(
        'm12-b3-kibo-zero-distance-profile'
      );
    const scenarioTriggers =
      Number.isInteger(elementId) &&
      (ref.referenceKind === 'bulletElements' || kiboZeroDistancePolicy)
        ? (control.bulletLaunches ?? [])
            .filter(
              launch =>
                launch.subSkillIndex === ref.mapIndex &&
                launch.elementId === elementId &&
                (launch.targetKind === 'skill-target' ||
                  (control.runtimePolicy?.allowRuntimeTargetZeroDistance ===
                    true &&
                    launch.targetKind === 'runtime-target'))
            )
            .map(launch => ({
              kind: 'projectile-zero-distance-impact',
              behaviorPathId: launch.behaviorPathId,
              startFrame: launch.launchFrame,
              launchFrame: launch.launchFrame,
              travelFrames: 0,
              impactFrame: launch.launchFrame,
              frameCount: 1,
              bulletId: launch.bulletId,
              bulletIndex: launch.bulletIndex,
              repeatIndex: launch.repeatIndex,
              launchIdentity: launch.launchIdentity,
              targetKind: 'enemy',
              sourceEvidenceStatus: 'runtime-dependent',
              scenarioRuntimeStatus: 'scenario-assumed-zero-distance',
              sourceIdentity: launch.sourceIdentity,
            }))
        : [];
    if (
      kiboZeroDistancePolicy &&
      triggers.length === 0 &&
      scenarioTriggers.length === 0 &&
      [1, 2, 3, 4, 5, 6, 7, 9, 10].includes(Number(tree?.damageType))
    ) {
      // Approved zero-distance scenario: a kibo damage element without a
      // behavior track or bullet launch still lands immediately at skill
      // execution (frame 0) under the frozen zero-distance assumption.
      scenarioTriggers.push({
        kind: 'zero-distance-skill-execution',
        behaviorPathId: null,
        startFrame: 0,
        launchFrame: 0,
        travelFrames: 0,
        impactFrame: 0,
        frameCount: 1,
        bulletId: null,
        bulletIndex: null,
        repeatIndex: null,
        launchIdentity: null,
        targetKind: 'enemy',
        sourceEvidenceStatus: 'runtime-dependent',
        scenarioRuntimeStatus: 'scenario-assumed-zero-distance',
        sourceIdentity: `${relativeExternalPath(control.filePath)}#${ref.sourceIdentity}|zero-distance-skill-execution`,
      });
    }
    const resolvedFormula = resolveElementFormulaInputs(tree);
    const baseValues = resolvedFormula.values;
    const baseFunctionId = Number(resolvedFormula.baseFunctionId);
    const commonFunctionId = Number(resolvedFormula.commonFunctionId);
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
    const threeValueRelevant = Boolean(
      tree &&
      ['damageType', 'weakBreakDamageRate', 'recoverSP', 'petRecoverSP'].some(
        field => Object.hasOwn(tree, field)
      )
    );
    const healElementVerified =
      Number(tree?.damageType) === 5 &&
      commonFunctionId === 1 &&
      [2, 3, 5, 11, 104, 108, 122].includes(baseFunctionId) &&
      finiteNumberOrNull(ratiosByLevel[1]) != null;
    const issues = [];
    if (uniqueIndexed.length !== 1) issues.push('element-path-not-unique');
    if (!Number.isInteger(elementId)) issues.push('element-id-missing');
    if (
      threeValueRelevant &&
      !healElementVerified &&
      !SUPPORTED_BASE_FUNCTION_IDS.has(baseFunctionId)
    ) {
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
      healElementVerified,
      formulaReady:
        uniqueIndexed.length === 1 &&
        SUPPORTED_BASE_FUNCTION_IDS.has(baseFunctionId) &&
        commonFunctionId === 1 &&
        finiteNumberOrNull(tree?.damageType) != null &&
        finiteNumberOrNull(ratiosByLevel[1]) != null,
    });
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
    const scenarioClassification =
      scenarioTriggers.length > 0 && runtimeDimensionReady
        ? 'applied'
        : scenarioTriggers.length > 0 && allDimensionsVerifiedZero
          ? 'verified-zero'
          : classification;
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
    const sourceName = createCombatSourceDisplayLabel({
      sourceText: tree?.elementName ?? tree?.m_Name,
      referenceKind: ref.referenceKind,
      sequence: Number(ref.elementIndex) + 1,
      sourceIdentity: `${relativeExternalPath(control.filePath)}#${ref.sourceIdentity}`,
    });
    return {
      elementId: Number.isInteger(elementId) ? elementId : null,
      pathId: ref.pathId ?? indexedRecord?.pathId ?? null,
      mapIndex: ref.mapIndex,
      referenceKind: ref.referenceKind,
      elementIndex: ref.elementIndex,
      name: tree?.elementName ?? tree?.m_Name ?? null,
      rawSourceName: sourceName.rawSourceName,
      sourceNameStatus: sourceName.sourceNameStatus,
      displayLabel: sourceName.displayLabel,
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
      scenarioTriggers,
      classification,
      scenarioClassification,
      status: `verified-action-hit-binding-${classification}`,
      confidence: classification === 'applied' ? 'high' : classification,
      issues: unresolvedReasons,
      applied: classification === 'applied',
    };
  });
  const players = control.value.skillControlData?.skillPlayers ?? [];
  const resourceMaps = control.value.skillResourceMaps ?? [];
  const kiboZeroDistancePolicy = String(
    control.runtimePolicy?.sourceIdentity ?? ''
  ).startsWith('m12-b3-kibo-zero-distance-profile');
  const resolvedElements = kiboZeroDistancePolicy
    ? Array.from(
        elements
          .reduce((byElement, element) => {
            const key = `${element.mapIndex}|${
              Number.isInteger(element.elementId)
                ? element.elementId
                : `path:${element.pathId ?? `${element.referenceKind}:${element.elementIndex}`}`
            }`;
            const current = byElement.get(key);
            if (
              !current ||
              kiboElementBindingRank(element) >
                kiboElementBindingRank(current)
            ) {
              byElement.set(key, element);
            }
            return byElement;
          }, new Map())
          .values()
      )
    : elements;
  const effectGraph = createControlEffectGraph({
    control: {
      ...control,
      elementRefs: runtimeElementRefs,
    },
    allIndexedElements,
    allIndexedElementsById,
    formulas,
    overridesBySkillAndElement,
    tuningMechanicsCatalog,
  });
  const effects = createControlRuntimeEffects({
    effectGraph,
    control,
    elements: resolvedElements,
  });
  const variantCount = Math.max(players.length, resourceMaps.length);
  const variants = Array.from({ length: variantCount }, (_, mapIndex) => {
    const player = players[mapIndex] ?? null;
    const resourceMap = resourceMaps[mapIndex] ?? null;
    const variantElements = resolvedElements.filter(
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
    runtimePolicy: control.runtimePolicy,
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
    elements: resolvedElements,
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
  const roots = control.elementRefs.map(ref => {
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

    function visit(record, parentIdentity, relation, depth, layerActivation = null) {
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
      const node = {
        ...createBattleEffectGraphNode({
          record,
          controlSkillId: control.skillId,
          formulas,
          overridesBySkillAndElement,
          depth,
          incomingRelation: relation,
          layerActivation,
          tuningMechanicsCatalog,
        }),
        sourceTraversalIndex: nodes.length,
      };
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
        const layerActivation =
          childReference.relation === 'layerInfoList'
            ? resolveLayerActivationForChild(
                record.typetree,
                childResolution.record
              )
            : null;
        visit(
          childResolution.record,
          nodeIdentity,
          childReference.relation,
          depth + 1,
          layerActivation
        );
      }
    }
  });
  if (
    !String(control.runtimePolicy?.sourceIdentity ?? '').startsWith(
      'm12-b3-kibo-zero-distance-profile'
    )
  ) {
    return roots;
  }
  const uniqueRoots = Array.from(
    roots
      .reduce((byElement, root) => {
        const key = `${root.mapIndex}|${
          Number.isInteger(root.rootElementId)
            ? root.rootElementId
            : `path:${root.rootPathId ?? `${root.referenceKind}:${root.elementIndex}`}`
        }`;
        const current = byElement.get(key);
        if (
          !current ||
          (root.referenceKind === 'elements' &&
            current.referenceKind !== 'elements')
        ) {
          byElement.set(key, root);
        }
        return byElement;
      }, new Map())
      .values()
  );
  // A resourceMap can list an element that is only reachable as an injected
  // child of another behavior-triggered root. That child already inherits the
  // parent trigger inside its own root graph, so a separate child-covered root
  // with no applied nodes would only publish an unresolved duplicate effect.
  const coveredAsChild = new Set();
  for (const root of uniqueRoots) {
    for (const node of root.nodes) {
      if (node.depth > 0 && Number.isInteger(node.elementId)) {
        coveredAsChild.add(`${root.mapIndex}|${node.elementId}`);
      }
    }
  }
  return uniqueRoots.filter(root => {
    if (!coveredAsChild.has(`${root.mapIndex}|${root.rootElementId}`)) {
      return true;
    }
    const staticTriggers = selectBehaviorTriggersForSubSkill(
      control.behaviorTriggers,
      root.rootPathId,
      root.mapIndex,
      control.runtimePolicy?.behaviorTriggerScope
    );
    const scenarioTriggers =
      control.runtimePolicy?.runtimeEffectsUseScenarioTriggers === true
        ? (control.bulletLaunches ?? []).filter(
            launch =>
              launch.subSkillIndex === root.mapIndex &&
              launch.elementId === root.rootElementId
          )
        : [];
    return staticTriggers.length > 0 || scenarioTriggers.length > 0;
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
  // triggerEffectList/zeroEffectList/finishEffectList entries reference the
  // child element by `param1` (elementConfigId) alongside the PPtr target.
  const effectListFields = [
    'triggerEffectList',
    'zeroEffectList',
    'finishEffectList',
  ];
  for (const field of effectListFields) {
    for (const entry of Array.isArray(tree[field]) ? tree[field] : []) {
      if (entry && Number(entry.effectType) === 0) {
        const elementIdHint = integerOrNull(entry.param1);
        if (elementIdHint != null && elementIdHint > 0) {
          references.push({ pathId: null, elementIdHint, relation: field });
        }
      }
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

function resolveLayerActivationForChild(parentTree = {}, childRecord = {}) {
  const layerElementId = integerOrNull(parentTree.elementConfigId);
  if (layerElementId == null) return null;
  const entries = Array.isArray(parentTree.layerInfoList)
    ? parentTree.layerInfoList
    : [];
  let minLayerCount = null;
  for (const entry of entries) {
    const layerCnt = integerOrNull(entry.layerCnt);
    if (layerCnt == null || layerCnt <= 0) continue;
    const references = collectNestedPathIds(entry.elementDataList);
    if (references.includes(String(childRecord.pathId))) {
      minLayerCount =
        minLayerCount == null ? layerCnt : Math.min(minLayerCount, layerCnt);
    }
  }
  if (minLayerCount == null) return null;
  return {
    conditionType: 6,
    layerElementId,
    minLayerCount,
  };
}

function createBattleEffectGraphNode({
  record,
  controlSkillId,
  formulas,
  overridesBySkillAndElement,
  depth,
  incomingRelation = null,
  layerActivation = null,
  tuningMechanicsCatalog,
}) {
  const tree = record.typetree ?? {};
  const elementId = integerOrNull(tree.elementConfigId);
  const kind = resolveBattleElementKind(tree);
  const resolvedFormula = resolveElementFormulaInputs(tree);
  const baseValues = resolvedFormula.values;
  const baseFunctionId = resolvedFormula.baseFunctionId;
  const commonFunctionId = resolvedFormula.commonFunctionId;
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
  const formulaParameterContract = createFormulaParameterContract(
    effectiveParamsByLevel
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
    incomingRelation,
    tuningMechanicsCatalog,
  });
  const rawSourceName = tree.elementName ?? tree.m_Name ?? record.name ?? null;
  const sourceName = createEffectSourceDisplayLabel({
    sourceText: rawSourceName,
    effectKind: kind,
    sourceIdentity: `battle-element-assets.jsonl#path_id=${record.pathId}`,
  });
  return {
    nodeIdentity: `element:${record.pathId}`,
    pathId: record.pathId,
    elementId,
    name: rawSourceName,
    rawSourceName: sourceName.rawSourceName,
    sourceNameStatus: sourceName.sourceNameStatus,
    displayLabel: sourceName.displayLabel,
    kind,
    depth,
    incomingRelation,
    activationConditions: dedupeBy(
      [
        ...(classification.activationConditions ?? []),
        ...(layerActivation ? [layerActivation] : []),
      ],
      condition => JSON.stringify(condition)
    ),
    propertyConditionStatus: classification.propertyConditionStatus ?? null,
    sourceIdentity: `battle-element-assets.jsonl#path_id=${record.pathId}`,
    sourceScriptPathId: String(tree.m_Script?.m_PathID ?? '') || null,
    mechanic,
    formula: {
      commonFunctionId,
      commonExpression: formulas.get(commonFunctionId) ?? null,
      baseFunctionId,
      baseExpression: formulas.get(baseFunctionId) ?? null,
      ...formulaParameterContract,
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
            specialPropertyType: integerOrNull(tree.specialPropertyType),
            specialPropertyTypeName:
              integerOrNull(tree.specialPropertyType) === 1
                ? 'ALL_PROPERTY_SHOOTDMGUP'
                : integerOrNull(tree.specialPropertyType) === 2
                  ? 'ALL_PROPERTY_DEFENSE'
                  : null,
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
            candidateEffectMappings: (Array.isArray(
              tree.injectElementDataEffects
            )
              ? tree.injectElementDataEffects
              : []
            ).map((entry, priorityIndex) => ({
              priorityIndex,
              markId: integerOrNull(entry?.elementAttr),
              packetPathIds: collectNestedPathIds(entry?.elements),
            })),
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

function createFormulaParameterContract(paramsByLevel) {
  const parameterSets = [];
  const setIndexByValue = new Map();
  const levelParameterSetIndices = [];
  for (let level = 1; level <= 12; level += 1) {
    const values = paramsByLevel[level] ?? paramsByLevel[String(level)] ?? [];
    const key = JSON.stringify(values);
    let setIndex = setIndexByValue.get(key);
    if (setIndex == null) {
      setIndex = parameterSets.length;
      setIndexByValue.set(key, setIndex);
      parameterSets.push(values);
    }
    levelParameterSetIndices.push(setIndex);
  }
  return { parameterSets, levelParameterSetIndices };
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
  incomingRelation = null,
  tuningMechanicsCatalog,
}) {
  const propertyConditionResult = parsePropertyChangeActivationConditions(tree);
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
    [3, 5, 11].includes(baseFunctionId) &&
    literalValues.length === 12;
  const literalZero = literalReady && literalValues.every(value => value === 0);
  const elementId = integerOrNull(tree.elementConfigId);
  const tuningProfile = resolveTuningProfileForBattleElement(
    tuningMechanicsCatalog,
    { kind, elementId }
  );

  if (kind === 'property-change') {
    const elementLayerPropertyReady =
      commonFunctionId === 1 &&
      baseFunctionId === 120 &&
      literalValues.length === 12;
    if (!literalReady && !elementLayerPropertyReady) {
      reasons.push('property-formula-not-literal-function-5');
    }
    const propertyChangeType = integerOrNull(tree.changeType);
    const specialPropertyType = integerOrNull(tree.specialPropertyType);
    const isAllPropertyBattleModifier =
      propertyChangeType === 2 && [1, 2].includes(specialPropertyType);
    if (propertyChangeType !== 0 && !isAllPropertyBattleModifier) {
      reasons.push('property-change-type-not-battle-property');
    }
    if (![0, 1, 2].includes(integerOrNull(tree.calculateType))) {
      reasons.push('property-calculate-type-not-dynamic-bucket');
    }
    if (propertyConditionResult.unsupported.length > 0) {
      reasons.push('property-condition-element-state-runtime-evidence-required');
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
    const recoverType = integerOrNull(tree.recoverType);
    if (recoverType !== 0 && recoverType !== 3) {
      reasons.push('sp-recover-type-not-direct-sp');
    }
    if (!literalReady) reasons.push('sp-formula-not-literal-function-5');
    dimensions.sp = createDimensionClassification(
      reasons.length ? 'unresolved' : literalZero ? 'verified-zero' : 'applied',
      reasons,
      'formulaParams.formulaParamValues[0]'
    );
  } else if (kind === 'damage' && Number(tree.damageType) === 5) {
    const sourceAtkHealReady =
      commonFunctionId === 1 &&
      baseFunctionId === 2 &&
      literalValues.length === 12;
    const maxHpRatioHealReady =
      commonFunctionId === 1 &&
      [104, 108, 122].includes(baseFunctionId) &&
      literalValues.length === 12;
    if (!literalReady && !sourceAtkHealReady && !maxHpRatioHealReady) {
      reasons.push('heal-formula-not-literal-function-5');
    }
    dimensions.hp = createDimensionClassification(
      reasons.length ? 'unresolved' : literalZero ? 'verified-zero' : 'applied',
      reasons,
      'formulaParams.formulaParamValues[0]'
    );
  } else if (
    kind === 'shield' ||
    (kind === 'damage' && Number(tree.damageType) === 11)
  ) {
    const maxHpRatioShieldReady =
      [1, 104, 108].includes(commonFunctionId) &&
      baseFunctionId === 12 &&
      literalValues.length === 12;
    if (!literalReady && !maxHpRatioShieldReady) {
      reasons.push('shield-formula-not-literal-function-5');
    }
    dimensions.shield = createDimensionClassification(
      reasons.length ? 'unresolved' : literalZero ? 'verified-zero' : 'applied',
      reasons,
      'formulaParams.formulaParamValues[0]'
    );
  } else if (kind === 'damage') {
    if (
      depth > 0 &&
      [
        'additionalHitElementDataList',
        'triggerEffectList',
        'sustainElement',
      ].includes(incomingRelation)
    ) {
      dimensions.damage = createDimensionClassification(
        'applied',
        [],
        incomingRelation
      );
    } else if (depth > 0) {
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
  } else if (kind === 'pack') {
    const childReferenceCount = collectBattleElementChildReferences(
      tree
    ).length;
    if (childReferenceCount > 0) {
      dimensions.wrapper = createDimensionClassification(
        'applied',
        [],
        'elementConfigId|sustainElement|elementDataList|injectElementDataList|triggerEffectList'
      );
    } else if (Number(tree.sustainElement) === 0) {
      // Leaf marker packs (e.g. 标记元素) only register the element id on the
      // target; they produce no three-value delta, so keep them non-blocking.
      dimensions.mark = createDimensionClassification('verified-zero', [
        'marker-leaf-does-not-write-mark',
      ]);
    } else {
      reasons.push('pack-lifecycle-runtime-unimplemented');
      dimensions.mark = createDimensionClassification(
        'unresolved',
        reasons,
        'elementConfigId'
      );
    }
  } else if (['stack', 'judgment'].includes(kind)) {
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
    const childReferenceCount = collectBattleElementChildReferences(
      tree
    ).length;
    if (childReferenceCount > 0) {
      dimensions.wrapper = createDimensionClassification(
        'applied',
        [],
        'elementConfigId|injectElementDataList|elementDataList'
      );
    } else {
      reasons.push('inject-wrapper-classified-through-child-edges');
    }
  } else {
    reasons.push('battle-element-kind-not-calculator-supported');
  }

  const statuses = Object.values(dimensions).map(dimension => dimension.status);
  const status = statuses.includes('applied')
    ? 'applied'
    : statuses.includes('unresolved') || reasons.length > 0
      ? 'unresolved'
      : 'verified-zero';
  return {
    status,
    reasons: dedupeBy(reasons, value => value),
    dimensions,
    activationConditions: propertyConditionResult?.conditions ?? [],
    propertyConditionStatus: propertyConditionResult
      ? propertyConditionResult.unsupported.length > 0
        ? 'property-condition-element-state-runtime-evidence-required'
        : propertyConditionResult.conditions.length > 0
          ? 'property-conditions-expanded'
          : null
      : null,
  };
}

function parsePropertyChangeActivationConditions(tree = {}) {
  const rawConditions = [
    ...(tree.defaultConditions ?? []),
    ...(tree.changePeopertyConditionArrayDatas ?? []),
  ].filter(condition => condition && typeof condition === 'object');
  const conditions = [];
  const unsupported = [];
  for (const condition of rawConditions) {
    const conditionType = integerOrNull(condition.conditionType);
    if (conditionType == null || conditionType === 0) continue;
    if ([1, 2, 3, 4, 5].includes(conditionType)) {
      conditions.push({
        conditionType,
        conditionTypeName:
          conditionType === 1
            ? 'EntityElementType'
            : conditionType === 2
              ? 'CurSkillId'
              : conditionType === 3
                ? 'HasElementTag'
                : conditionType === 4
                  ? 'HasElementId'
              : 'CurSkillTag',
        entityElementalType: integerOrNull(condition.entityElementalType) ?? 0,
        skillId: integerOrNull(condition.skillId) ?? 0,
        skillTag: integerOrNull(condition.skillTag) ?? 0,
        elementTag: integerOrNull(condition.elementTag) ?? 0,
        elementId: integerOrNull(condition.elementId) ?? 0,
        subConditionType:
          integerOrNull(condition.subConditionType_Element) ?? 0,
        targetType: integerOrNull(condition.targetType) ?? 0,
        maxChangeCount: integerOrNull(condition.maxChangeCount) ?? 0,
      });
    } else {
      unsupported.push({
        conditionType,
        conditionTypeName:
          `Unknown-${conditionType}`,
        elementTag: integerOrNull(condition.elementTag) ?? 0,
        elementId: integerOrNull(condition.elementId) ?? 0,
        subConditionType:
          integerOrNull(condition.subConditionType_Element) ?? 0,
        targetType: integerOrNull(condition.targetType) ?? 0,
        maxChangeCount: integerOrNull(condition.maxChangeCount) ?? 0,
      });
    }
  }
  return { conditions, unsupported };
}

function createControlRuntimeEffects({ effectGraph, control, elements = [] }) {
  const kiboZeroDistancePolicy = String(
    control.runtimePolicy?.sourceIdentity ?? ''
  ).startsWith('m12-b3-kibo-zero-distance-profile');
  const triggerPresence = new Map(
    effectGraph.map(root => [
      root.graphIdentity,
      {
        static: selectBehaviorTriggersForSubSkill(
          control.behaviorTriggers,
          root.rootPathId,
          root.mapIndex,
          control.runtimePolicy?.behaviorTriggerScope
        ),
        scenario:
          control.runtimePolicy?.runtimeEffectsUseScenarioTriggers === true
            ? (elements.find(
                element =>
                  element.mapIndex === root.mapIndex &&
                  element.referenceKind === root.referenceKind &&
                  element.elementIndex === root.elementIndex
              )?.scenarioTriggers ?? [])
            : [],
      },
    ])
  );
  const childCoveredElementIds = new Set();
  for (const root of effectGraph) {
    const presence = triggerPresence.get(root.graphIdentity);
    if (
      !presence ||
      (presence.static.length === 0 && presence.scenario.length === 0)
    ) {
      continue;
    }
    for (const node of root.nodes) {
      if (node.depth > 0 && Number.isInteger(node.elementId)) {
        childCoveredElementIds.add(`${root.mapIndex}|${node.elementId}`);
      }
    }
  }
  const bindings = effectGraph.flatMap(root => {
    const presence = triggerPresence.get(root.graphIdentity);
    if (
      kiboZeroDistancePolicy &&
      presence &&
      presence.static.length === 0 &&
      presence.scenario.length === 0 &&
      childCoveredElementIds.has(`${root.mapIndex}|${root.rootElementId}`)
    ) {
      return [];
    }
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
    const staticTriggers = presence?.static ?? [];
    const scenarioTriggers = presence?.scenario ?? [];
    const triggers =
      staticTriggers.length > 0 ? staticTriggers : scenarioTriggers;
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
  if (!kiboZeroDistancePolicy) return bindings;
  // Kibo controls can list the same element in both `elements` and
  // `bulletElements`; after the zero-distance scenario triggers are shared,
  // both refs resolve to the same runtime effect. Emit one binding per
  // element/node/trigger so the runtime does not apply the element twice.
  return dedupeBy(
    bindings,
    effect =>
      [
        effect.mapIndex,
        effect.elementId,
        effect.pathId,
        effect.kind,
        effect.depth,
        effect.trigger?.startFrame ?? 'unresolved-frame',
        effect.sourceOrder?.triggerIndex ?? 0,
        effect.target?.kind ?? 'unresolved',
      ].join('|')
  );
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
    root,
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
    ).filter(
      reason =>
        node.kind !== 'inject' ||
        node.classification === 'applied' ||
        reason !== 'inject-wrapper-classified-through-child-edges'
    ),
    ...(tuningBinding?.reasons ?? []),
  ];
  if (!trigger || !Number.isInteger(trigger.startFrame)) {
    reasons.push('effect-trigger-frame-missing');
  }
  if (
    ![
      'source-owner',
      'enemy',
      'team-tuning-pool',
      'ally',
      'team-actors',
      'team-kibos',
      'owner-actor',
      'owner-kibo',
      'controlling-actor',
      'controlling-kibo',
      'player',
    ].includes(target.kind)
  ) {
    reasons.push(
      target.kind ? `effect-target-${target.kind}` : 'effect-target-unresolved'
    );
  }
  if (
    !tuningBinding &&
    node.depth > 0 &&
    relationPath.some(
      edge =>
        ![
          'injectElementDataList',
          'notDelElementDataList',
          'elementDataList',
          'additionalHitElementDataList',
          'triggerEffectList',
          'sustainElement',
          'layerInfoList',
          'zeroEffectList',
          'finishEffectList',
        ].includes(edge.relation)
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
    rawSourceName: node.rawSourceName,
    sourceNameStatus: node.sourceNameStatus,
    displayLabel: node.displayLabel,
    kind: node.kind,
    depth: node.depth,
    relationPath,
    trigger,
    activationConditions: node.activationConditions ?? [],
    propertyConditionStatus: node.propertyConditionStatus ?? null,
    sourceOrder: createBattleEffectSourceOrder({
      root,
      node,
      trigger,
      triggerIndex,
    }),
    target,
    scenarioRuntimeStatus:
      trigger?.scenarioRuntimeStatus ??
      (trigger ? 'source-verified' : 'scenario-runtime-unresolved'),
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
    directSp:
      node.directSp?.recoverType === 0
        ? {
            ...node.directSp,
            valueByLevel,
          }
        : null,
    cooldownReduction:
      node.directSp?.recoverType === 3
        ? {
            recoverType: 3,
            valueByLevel,
          }
        : null,
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

function createBattleEffectSourceOrder({ root, node, trigger, triggerIndex }) {
  const referenceKindOrder =
    root.referenceKind === 'elements'
      ? 0
      : root.referenceKind === 'bulletElements'
        ? 1
        : null;
  const fields = {
    timelineGroupIndex: integerOrNull(trigger?.timelineGroupIndex),
    mapIndex: integerOrNull(root.mapIndex),
    referenceKindOrder,
    elementIndex: integerOrNull(root.elementIndex),
    nodeTraversalIndex: integerOrNull(node.sourceTraversalIndex),
    triggerIndex: integerOrNull(triggerIndex),
  };
  const missingFields = Object.entries(fields)
    .filter(([, value]) => !Number.isInteger(value) || value < 0)
    .map(([field]) => field);
  return {
    contractName: VERIFIED_EFFECT_SOURCE_SEQUENCE_CONTRACT_NAME,
    status:
      missingFields.length === 0
        ? 'verified-battle-effect-source-order-ready'
        : 'verified-battle-effect-source-order-unresolved',
    referenceKind: root.referenceKind ?? null,
    ...fields,
    missingFields,
    sourceIdentity: [
      root.sourceIdentity,
      node.sourceIdentity ?? `element:${node.pathId}`,
      trigger?.sourceIdentity ?? 'trigger-unresolved',
    ].join('|'),
  };
}

function resolveTuningEffectBindingContract({
  root,
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
  const markIds = (judgment?.markElementIds ?? [])
    .map(Number)
    .filter(Number.isInteger);
  const judgmentEdge = judgmentNode
    ? relationPath.find(edge => edge.from === judgmentNode.nodeIdentity)
    : null;
  const reasons = [];
  if (!judgment) reasons.push('tuning-consume-judgment-missing');
  if (judgment && !judgment.consume) {
    reasons.push('tuning-consume-disabled');
  }
  if (!markIds.includes(Number(node.tuningOverlimit.markId))) {
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
  const judgmentCandidates = createTuningJudgmentCandidates({
    root,
    node,
    judgment,
    reasons,
  });
  const currentCandidate = judgmentCandidates.find(
    candidate =>
      candidate.markId === Number(node.tuningOverlimit.markId) &&
      candidate.packetElementId === Number(node.tuningOverlimit.packetElementId)
  );
  if (!currentCandidate) {
    reasons.push('tuning-consume-current-packet-not-in-candidate-map');
  }
  const prioritySelection =
    markIds.length > 1 && Number(judgment?.consumeMode) === 0;
  if (markIds.length > 1 && Number(judgment?.consumeMode) !== 0) {
    reasons.push('tuning-consume-multi-candidate-mode-unresolved');
  }
  const priorityEvidence = prioritySelection
    ? createTuningConsumePriorityEvidenceContract()
    : null;
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
      judgmentCandidateMarkIds: markIds,
      judgmentGroupIdentity: [
        'tuning-consume-judgment',
        root.controlSkillId,
        root.mapIndex,
        judgmentNode?.elementId ?? 'unknown-element',
        judgmentNode?.pathId ?? 'unknown-path',
      ].join(':'),
      judgmentCandidates,
      runtimeSelectionMode: prioritySelection
        ? 'priority-first-sufficient-candidate'
        : 'single-mark-packet',
      priorityDirection: prioritySelection
        ? priorityEvidence.candidateOrder
        : null,
      priorityRuntimeEvidence: priorityEvidence,
    },
    reasons: dedupeBy(reasons, value => value),
    applied: reasons.length === 0,
  };
}

function createTuningJudgmentCandidates({ root, node, judgment, reasons }) {
  const markIds = (judgment?.markElementIds ?? [])
    .map(Number)
    .filter(Number.isInteger);
  const mappings = judgment?.candidateEffectMappings ?? [];
  if (
    markIds.length === 1 &&
    Number(node.tuningOverlimit?.markId) === markIds[0]
  ) {
    return [
      {
        priorityIndex: 0,
        markId: markIds[0],
        packetElementId: integerOrNull(node.tuningOverlimit?.packetElementId),
        packetPathId: node.pathId ?? null,
        packetSourceIdentity:
          node.tuningOverlimit?.sourceIdentity ?? node.sourceIdentity ?? null,
      },
    ];
  }
  if (mappings.length !== markIds.length) {
    reasons.push('tuning-consume-candidate-mapping-count-mismatch');
  }
  return markIds.map((markId, priorityIndex) => {
    const mapping = mappings[priorityIndex] ?? null;
    if (Number(mapping?.markId) !== markId) {
      reasons.push('tuning-consume-candidate-mark-order-mismatch');
    }
    const packetNodes = (mapping?.packetPathIds ?? [])
      .map(pathId =>
        root.nodes.find(
          candidate => String(candidate.pathId) === String(pathId)
        )
      )
      .filter(candidate => candidate?.tuningOverlimit);
    if (packetNodes.length !== 1) {
      reasons.push('tuning-consume-candidate-packet-mapping-unresolved');
    }
    const packetNode = packetNodes[0] ?? null;
    if (
      packetNode &&
      Number(packetNode.tuningOverlimit.markId) !== Number(markId)
    ) {
      reasons.push('tuning-consume-candidate-packet-profile-mismatch');
    }
    return {
      priorityIndex,
      markId,
      packetElementId:
        integerOrNull(packetNode?.tuningOverlimit?.packetElementId) ??
        integerOrNull(packetNode?.elementId),
      packetPathId: packetNode?.pathId ?? mapping?.packetPathIds?.[0] ?? null,
      packetSourceIdentity:
        packetNode?.tuningOverlimit?.sourceIdentity ??
        packetNode?.sourceIdentity ??
        null,
    };
  });
}

function createTuningConsumePriorityEvidenceContract() {
  const evidence = getTuningConsumePriorityRuntimeEvidence();
  return {
    sourceIdentity: evidence.sourceIdentity,
    binaryPath: evidence.binary.path,
    binarySha256: evidence.binary.sha256,
    dumpPath: evidence.dump.path,
    dumpRequiredDeclarations: evidence.dump.requiredDeclarations,
    consumerClassName: evidence.selection.className,
    consumerMethod: evidence.selection.consumerMethod,
    consumerMethodRva: evidence.selection.consumerMethodRva,
    candidateLoopRange: evidence.selection.candidateLoopRange,
    candidateLoopSha256: evidence.selection.candidateLoopSha256,
    insufficientFallbackRange: evidence.selection.insufficientFallbackRange,
    selectedElementStoreRva: evidence.selection.selectedElementStoreRva,
    candidateOrder: evidence.selection.candidateOrder,
    selectionRule: evidence.selection.selectionRule,
    fallbackRule: evidence.selection.fallbackRule,
    noCandidateRule: evidence.selection.noCandidateRule,
    injectMethod: evidence.injection.injectMethod,
    injectMethodRva: evidence.injection.injectMethodRva,
    selectedPacketLookupRange: evidence.injection.selectedPacketLookupRange,
    selectedPacketLookupSha256: evidence.injection.selectedPacketLookupSha256,
    packetRule: evidence.injection.packetRule,
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

function classifyHitDimensions({
  tree,
  uniqueElement,
  healElementVerified = false,
  formulaReady,
}) {
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
  if (damageType === 5) {
    return {
      hp: healElementVerified
        ? createDimensionClassification('applied', [], 'formulaParams')
        : createDimensionClassification('unresolved', [
            'heal-formula-not-literal-function-5',
          ]),
      toughness: createDimensionClassification('verified-zero', [
        'heal-element-no-toughness',
      ]),
      actorSp: classifyExplicitNumericField(tree, 'recoverSP'),
      kiboSp: classifyExplicitNumericField(tree, 'petRecoverSP'),
    };
  }
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
      createPublishedTuningDamageTemplate(
        template,
        resolveTuningDamageSourceRecord({
          elementId: template.elementConfigId,
          allIndexedElementsById,
        })
      ),
    ]);
  }

  const profiles = (snapshot.tuningProfiles ?? []).map(profile => {
    const markId = Number(profile.markId);
    const container = containersById.get(markId);
    if (!container) {
      throw new Error(`verified tuning container missing: ${markId}`);
    }
    const markContainerSourceRecord = resolveTuningMarkContainerSourceRecord({
      markId,
      allIndexedElementsById,
    });
    const markContainerElementTypes = [
      ...new Set(
        (markContainerSourceRecord.typetree?.types ?? [])
          .map(Number)
          .filter(Number.isInteger)
      ),
    ].sort((left, right) => left - right);
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
          resolveElementFormulaInputs(tree).values?.[0]
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
    const overlimitDamageSourceRecord = resolveTuningDamageSourceRecord({
      elementId: profile.primaryDamageId,
      allIndexedElementsById,
      required: true,
    });
    return {
      key: String(profile.key),
      element: String(profile.element),
      markId,
      markContainer: {
        elementId: markId,
        pathId: String(markContainerSourceRecord.pathId),
        kind: 'stack-element',
        elementTypes: markContainerElementTypes,
        elementTypeSourceIdentity: `battle-element-assets.jsonl#path_id=${markContainerSourceRecord.pathId}.types`,
        sourceIdentity: `battle-element-assets.jsonl#path_id=${markContainerSourceRecord.pathId}`,
        status: 'verified-tuning-mark-container-ready',
        applied: true,
      },
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
        template: createPublishedTuningDamageTemplate(
          overlimitTemplate,
          overlimitDamageSourceRecord
        ),
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
        profile.markContainer?.elementTypes?.length === 0 ||
        !profile.markContainer.elementTypes.includes(41) ||
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

function resolveTuningMarkContainerSourceRecord({
  markId,
  allIndexedElementsById,
}) {
  const candidates = dedupeBy(
    allIndexedElementsById.get(Number(markId)) ?? [],
    record => String(record.pathId)
  ).filter(record => {
    const tree = record.typetree ?? {};
    return (
      Number(tree.elementConfigId) === Number(markId) &&
      Number(tree.combineType) === 4 &&
      Number(tree.combineNumber) === 5 &&
      Array.isArray(tree.types)
    );
  });
  if (candidates.length !== 1) {
    throw new Error(
      `verified tuning mark container source not unique: ${markId} (${candidates.length})`
    );
  }
  return candidates[0];
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

function resolveTuningDamageSourceRecord({
  elementId,
  allIndexedElementsById,
  required = false,
}) {
  const candidates = dedupeBy(
    allIndexedElementsById.get(Number(elementId)) ?? [],
    record => String(record.pathId)
  );
  if (candidates.length === 1) return candidates[0];
  if (required) {
    throw new Error(
      `verified tuning damage source not unique: ${elementId} (${candidates.length})`
    );
  }
  return null;
}

function createPublishedTuningDamageTemplate(
  template = {},
  sourceRecord = null
) {
  const elementTypes = [
    ...new Set(
      (sourceRecord?.typetree?.types ?? []).map(Number).filter(Number.isInteger)
    ),
  ].sort((left, right) => left - right);
  const elementTypeSourceIdentity = sourceRecord
    ? `battle-element-assets.jsonl#path_id=${sourceRecord.pathId}.types`
    : null;
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
    elementTypes,
    elementTypeSourceIdentity,
    sourceIdentity: [
      `combat-overlimit-mechanics-20260718.json#elementConfigId=${template.elementConfigId}`,
      elementTypeSourceIdentity,
    ]
      .filter(Boolean)
      .join('|'),
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
  const effectLayerCount = Math.max(
    0,
    ...layers.map(layer => integerOrNull(layer.layerCnt) ?? 0)
  );
  // The mark stack capacity is a game-wide evidence-backed cap from
  // combat-overlimit-mechanics (maxStacks=5 for every tuning profile).
  // layerInfoList only declares which layer levels carry an extra effect;
  // marks with fewer declared effect layers (e.g. wood 550) still cap at 5.
  const maxStacks = profile.maxStacks;
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
  if (effectLayerCount > profile.maxStacks) {
    reasons.push('tuning-mark-max-mismatch');
  }
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
    effectLayerCount,
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
        defaultRaw: Number(row.attrDefault),
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

function createSwitchTriggerCatalog({ characterCatalog, actionMappings }) {
  const il2cppSource = readText(IL2CPP_DUMP_PATH);
  for (const contract of SWITCH_SKILL_SLOT_CONTRACTS) {
    const enumPattern = new RegExp(
      `ESkillSlotType\\s+${contract.enumName}\\s*=\\s*${contract.slot}`
    );
    if (!enumPattern.test(il2cppSource)) {
      throw new Error(
        `verified switch skill slot enum missing: ${contract.enumName}=${contract.slot}`
      );
    }
  }

  const starCarryMappings = actionMappings.filter(
    mapping =>
      mapping.ownerKind === 'actor' && mapping.actionKind === 'star-carry'
  );
  const profiles = (characterCatalog?.items ?? [])
    .map(character => {
      const ownerId = Number(character.id);
      const slots = (character.skillSlots ?? [])
        .map(slot => ({ ...slot, slot: Number(slot.slot) }))
        .filter(slot =>
          SWITCH_SKILL_SLOT_CONTRACTS.some(
            contract => contract.slot === slot.slot
          )
        );
      const slot = slots.length === 1 ? slots[0] : null;
      const phaseContract = SWITCH_SKILL_SLOT_CONTRACTS.find(
        contract => contract.slot === slot?.slot
      );
      const sourceSkillId = Number(slot?.skillId);
      const mappings = starCarryMappings.filter(
        mapping =>
          Number(mapping.ownerId) === ownerId &&
          Number(mapping.sourceSkillId) === sourceSkillId
      );
      const mapping = mappings.length === 1 ? mappings[0] : null;
      const reasons = [];
      if (slots.length === 0) {
        reasons.push('public-switch-skill-slot-missing');
      } else if (slots.length > 1) {
        reasons.push('public-switch-skill-slot-ambiguous');
      }
      if (slot && mappings.length === 0) {
        reasons.push('star-carry-action-mapping-missing');
      } else if (mappings.length > 1) {
        reasons.push('star-carry-action-mapping-ambiguous');
      }
      const applied = Boolean(slot && phaseContract && mapping);
      const sourceIdentity = slot
        ? `characters.items[id=${ownerId}].skillSlots[slot=${slot.slot},skillId=${sourceSkillId}]`
        : `characters.items[id=${ownerId}].skillSlots`;
      const sourceIdentities = [
        sourceIdentity,
        `${relativeExternalPath(STATIC_PROPERTY_TABLE_PATHS.hero)}#rows[id=${ownerId}].skillList[slot=${slot?.slot ?? 'missing'}]`,
        `${relativeExternalPath(IL2CPP_DUMP_PATH)}#ESkillSlotType.${phaseContract?.enumName ?? 'Unknown'}=${slot?.slot ?? 'missing'}`,
        ...(mapping?.bindingSourceIdentity
          ? [mapping.bindingSourceIdentity]
          : []),
      ];
      return {
        profileIdentity: `actor:${ownerId}|switch-trigger:${phaseContract?.triggerPhase ?? 'unresolved'}|skill:${Number.isInteger(sourceSkillId) ? sourceSkillId : 'missing'}`,
        ownerKind: 'actor',
        ownerId,
        ownerName: character.name ?? null,
        triggerPhase: phaseContract?.triggerPhase ?? null,
        triggerLabel: phaseContract?.label ?? null,
        skillSlot: slot?.slot ?? null,
        sourceSkillId: Number.isInteger(sourceSkillId) ? sourceSkillId : null,
        starCarryActionIdentity: mapping?.identity ?? null,
        controlSkillId: mapping?.controlSkillId ?? null,
        actionVariantIndex: mapping?.actionVariantIndex ?? null,
        triggerFrameOffset: 0,
        conditions: [],
        manualReleaseStatus: 'switch-trigger-only',
        mechanicsClassification: mapping?.classification ?? 'unresolved',
        mechanicsReasons: [...(mapping?.reasons ?? [])],
        sourceIdentity,
        sourceIdentities: [...new Set(sourceIdentities.filter(Boolean))],
        resolutionStatus: applied ? 'applied' : 'static-evidence-gap',
        reasons,
        applied,
      };
    })
    .sort((left, right) => left.ownerId - right.ownerId);
  const appliedProfiles = profiles.filter(profile => profile.applied);
  const unresolvedProfiles = profiles.filter(profile => !profile.applied);
  return {
    schemaVersion: 1,
    kind: 'azpr-verified-switch-trigger-catalog',
    contractName: 'AzPrVerifiedSwitchTriggerCatalog',
    status: 'verified-switch-trigger-catalog-ready',
    sourceKind: 'azpr-hero-skill-slot-and-il2cpp-switch-enum',
    profiles,
    summary: {
      profileCount: profiles.length,
      appliedProfileCount: appliedProfiles.length,
      unresolvedProfileCount: unresolvedProfiles.length,
      onEnterProfileCount: profiles.filter(
        profile => profile.triggerPhase === 'on-enter'
      ).length,
      onExitProfileCount: profiles.filter(
        profile => profile.triggerPhase === 'on-exit'
      ).length,
      appliedOnEnterProfileCount: appliedProfiles.filter(
        profile => profile.triggerPhase === 'on-enter'
      ).length,
      appliedOnExitProfileCount: appliedProfiles.filter(
        profile => profile.triggerPhase === 'on-exit'
      ).length,
      switchTriggeredOnlyCount: profiles.filter(
        profile => profile.manualReleaseStatus === 'switch-trigger-only'
      ).length,
      reasonCounts: countValues(
        unresolvedProfiles.flatMap(profile => profile.reasons)
      ),
    },
  };
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
  characterCatalog,
  characterCombatOwnerCompilations = [],
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
  const characterCombatCompilationByOwnerId = new Map(
    characterCombatOwnerCompilations.map(compilation => [
      Number(compilation.ownerId),
      compilation,
    ])
  );
  const battleEffectNodes = dedupeBy(
    preparedControlBindings.flatMap(binding =>
      binding.effectGraph.flatMap(root =>
        root.nodes.map(node => ({
          ...node,
          formula: {
            ...node.formula,
            parameterSets: undefined,
            levelParameterSetIndices: undefined,
          },
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
    const defaultSelection = findDefaultActionVariantSelection(
      actionVariantGraph,
      candidate.ownerId,
      candidate.controlSkillId
    );
    const variantConditionDiscovery = findActionVariantConditionDiscovery(
      actionVariantGraph,
      candidate.ownerId,
      candidate.controlSkillId
    );
    const mechanicsMapping = createActionMapping(candidate, control, {
      defaultSelection,
      resourceTransactions: specialResourceCatalog.operationBindings,
      variantModelStatus: classifyActionVariantModelStatus({
        graph: actionVariantGraph,
        ownerId: candidate.ownerId,
        controlSkillId: candidate.controlSkillId,
        control,
      }),
      variantConditionDiscovery,
    });
    if (candidate.actionKind !== 'normal-attack') {
      const withTiming = attachActionTimingContract(
        mechanicsMapping,
        createPublicActionTimingContract({
          candidate,
          mapping: mechanicsMapping,
          control,
          ownerCompilation: characterCombatCompilationByOwnerId.get(
            Number(candidate.ownerId)
          ),
        })
      );
      return attachActionSchedulingContract({
        mapping: withTiming,
        control,
        defaultSelection,
      });
    }
    const attackInputSegments = createAttackInputSegments(
      candidate,
      preparedControlBySkillId,
      actionVariantGraph,
      specialResourceCatalog.operationBindings
    );
    const actionTiming =
      createAttackInputChainTimingContract(attackInputSegments);
    const mapping = attachActionSchedulingContract({
      mapping: attachActionTimingContract(mechanicsMapping, actionTiming),
      control,
      defaultSelection,
    });
    return {
      ...mapping,
      actionScheduling:
        createAttackInputChainSchedulingContract(attackInputSegments),
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
  const switchTriggerCatalog = createSwitchTriggerCatalog({
    characterCatalog,
    actionMappings,
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
    for (const segment of getAuditAttackInputSegments(mapping)) {
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
      switchTriggerCatalog,
    })
  );
  return {
    schemaVersion: 1,
    kind: 'azpr-verified-combat-mechanics-package',
    packageId: `azpr-${String(evidence.region).toLowerCase()}-${evidence.date}`,
    packageVersion: 15,
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
    switchTriggerCatalog,
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
      switchTriggerProfileCount: switchTriggerCatalog.summary.profileCount,
      appliedSwitchTriggerProfileCount:
        switchTriggerCatalog.summary.appliedProfileCount,
      unresolvedSwitchTriggerProfileCount:
        switchTriggerCatalog.summary.unresolvedProfileCount,
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

function kiboElementBindingRank(element) {
  const status =
    element.classification === 'applied'
      ? 4
      : element.scenarioClassification === 'applied'
        ? 3
        : element.classification === 'verified-zero' ||
            element.scenarioClassification === 'verified-zero'
          ? 2
          : 1;
  const refTieBreak = element.referenceKind === 'elements' ? 1 : 0;
  return status * 2 + refTieBreak;
}

function createControlRuntimeHits(control) {
  const indexByMap = new Map();
  return (control?.elements ?? [])
    .filter(
      element =>
        (element.classification === 'applied' ||
          element.scenarioClassification === 'applied') &&
        Number(element.damage?.damageType) !== 5
    )
    .flatMap(element => [
      ...(element.classification === 'applied'
        ? element.triggers.map(trigger => ({
            ...element,
            trigger,
            sourceEvidenceStatus: 'applied',
            scenarioRuntimeStatus: 'source-verified',
          }))
        : []),
      ...(element.scenarioClassification === 'applied'
        ? (element.scenarioTriggers ?? []).map(trigger => ({
            ...element,
            trigger,
            sourceEvidenceStatus:
              trigger.sourceEvidenceStatus ?? 'runtime-dependent',
            scenarioRuntimeStatus:
              trigger.scenarioRuntimeStatus ?? 'scenario-assumed-zero-distance',
          }))
        : []),
    ])
    .sort(
      (left, right) =>
        left.mapIndex - right.mapIndex ||
        left.trigger.startFrame - right.trigger.startFrame ||
        (left.elementId ?? 0) - (right.elementId ?? 0)
    )
    .map(element => {
      const hitIndex = (indexByMap.get(element.mapIndex) ?? 0) + 1;
      indexByMap.set(element.mapIndex, hitIndex);
      const hitIdentity = element.trigger.launchIdentity
        ? [
            control.controlSkillId,
            element.mapIndex,
            'projectile',
            element.elementId,
            element.trigger.bulletId,
            element.trigger.bulletIndex,
            element.trigger.repeatIndex,
            element.trigger.launchIdentity,
          ].join('|')
        : [
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
        rawSourceName: element.rawSourceName,
        sourceNameStatus: element.sourceNameStatus,
        displayLabel: element.displayLabel,
        sourceIdentity: element.sourceIdentity,
        formula: element.formula,
        damage: element.damage,
        energy: element.energy,
        trigger: element.trigger,
        sourceEvidenceStatus: element.sourceEvidenceStatus,
        scenarioRuntimeStatus: element.scenarioRuntimeStatus,
        conditionalGroupIdentity:
          element.trigger?.conditionalGroupIdentity ??
          element.conditionalGroupIdentity ??
          null,
        runtimeCondition:
          element.trigger?.runtimeCondition ?? element.runtimeCondition ?? null,
        hitIndex,
        hitIdentity,
      };
    });
}

function assertPublishedDisplayLabels(packageValue) {
  const displayLabels = [
    ...(packageValue.controlBindings ?? []).flatMap(binding =>
      (binding.hits ?? []).map(hit => hit.displayLabel)
    ),
    ...(packageValue.actionVariantControlBindings ?? []).flatMap(binding =>
      (binding.hits ?? []).map(hit => hit.displayLabel)
    ),
    ...(packageValue.battleEffectCatalog?.nodes ?? []).map(
      node => node.displayLabel
    ),
    ...(packageValue.semanticEffectCatalog?.semanticEffects ?? []).map(
      effect => effect.displayLabel
    ),
    ...(packageValue.specialResourceCatalog?.profiles ?? []).flatMap(
      profile => [
        profile.displayLabel,
        ...(profile.stateElements ?? []).map(state => state.displayLabel),
      ]
    ),
  ].filter(value => value != null && value !== '');
  const corruptLabels = displayLabels.filter(
    value => !isSourceDisplayTextSafe(value)
  );
  if (corruptLabels.length > 0) {
    throw new Error(
      `verified combat display label guard failed: ${corruptLabels
        .slice(0, 3)
        .join(' | ')}`
    );
  }
}

function createPublishedControlBinding(binding) {
  return {
    controlSkillId: binding.controlSkillId,
    runtimePolicy: binding.runtimePolicy ?? null,
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
      ...getAuditAttackInputSegments(mapping).flatMap(
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
  const formulas = dedupeBy(
    semanticEffects.map(effect => ({
      formulaIdentity: createSemanticFormulaIdentity(effect),
      controlSkillId: effect.controlSkillId,
      pathId: effect.pathId,
      sourceIdentities: effect.sourceIdentities,
      formula: effect.formula,
    })),
    entry => entry.formulaIdentity
  ).sort((left, right) =>
    left.formulaIdentity.localeCompare(right.formulaIdentity, 'en', {
      numeric: true,
    })
  );
  const publishedEffects = semanticEffects.map(effect => ({
    ...effect,
    formulaIdentity: createSemanticFormulaIdentity(effect),
    formula: undefined,
  }));
  return {
    schemaVersion: 1,
    kind: 'azpr-semantic-battle-effect-catalog',
    status: 'verified-semantic-battle-effect-catalog-ready',
    targetTypeContract: battleTargetTypeContract,
    formulas,
    semanticEffects: publishedEffects,
  };
}

function createSemanticEffectRuntimeCatalog(catalog, passiveProfiles = []) {
  const compiledPassiveProfiles = passiveProfiles.filter(
    profile =>
      profile.applied === true &&
      profile.runtimeGenerationMode === 'action-variant-runtime'
  );
  const isCompiledPassiveEffect = effect =>
    compiledPassiveProfiles.some(
      profile =>
        [profile.effectElementId, profile.propertyElementId].some(
          elementId => Number(elementId) === Number(effect.elementId)
        ) &&
        (profile.triggerBindings ?? []).some(
          trigger =>
            Number(trigger.controlSkillId) === Number(effect.controlSkillId) &&
            Number(trigger.subSkillIndex) === Number(effect.mapIndex) &&
            Number(trigger.triggerFrame) === Number(effect.trigger?.startFrame)
        )
    );
  const semanticEffects = catalog.semanticEffects.filter(
    effect =>
      effect.classification === 'applied' &&
      effect.role === 'gameplay-effect' &&
      !effect.tuningMark &&
      !effect.tuningOverlimit &&
      effect.formulaRuntime?.applied === true &&
      !isCompiledPassiveEffect(effect) &&
      Boolean(
        effect.propertyChange || effect.directSp || effect.heal || effect.shield
      )
  );
  const formulaIdentities = new Set(
    semanticEffects.map(effect => effect.formulaIdentity)
  );
  return {
    schemaVersion: 1,
    kind: 'azpr-semantic-battle-effect-runtime-catalog',
    status: 'verified-semantic-battle-effect-runtime-catalog-ready',
    targetTypeContract: catalog.targetTypeContract,
    formulas: catalog.formulas.filter(entry =>
      formulaIdentities.has(entry.formulaIdentity)
    ),
    semanticEffects,
    summary: {
      fullSemanticEffectCount: catalog.semanticEffects.length,
      runtimeEffectCount: semanticEffects.length,
      compiledPassiveEffectCount: catalog.semanticEffects.filter(
        isCompiledPassiveEffect
      ).length,
      runtimeFormulaCount: formulaIdentities.size,
      sourceKind: catalog.kind,
    },
  };
}

function createSemanticFormulaIdentity(effect) {
  return `battle-effect-formula:${effect.controlSkillId}:${effect.mapIndex}:${effect.pathId}`;
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
  const sourceTriggers = selectBehaviorTriggersForSubSkill(
    binding.semanticBehaviorTriggers,
    root.rootPathId,
    root.mapIndex,
    binding.runtimePolicy?.behaviorTriggerScope
  );
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
  const verifiedCharacterBinding = hasVerifiedCharacterCombatEffectBinding(
    rawEffects,
    node.elementId
  );
  const formulaRuntime = createSemanticFormulaRuntimeContract(node, {
    verifiedCharacterBinding,
  });
  const reasons = createSemanticEffectReasons({
    role,
    node,
    rawEffects,
    trigger,
    target,
    formulaRuntime,
  });
  const resolution = resolveSemanticPlacementResolution({ trigger, target });
  const classification = resolveSemanticMechanicClassification({
    role,
    node,
    rawEffects,
    reasons,
    placementResolution: resolution,
  });
  const stack = resolveEffectStackContract(node.lifecycle);
  const boundLifecycle = rawEffects.find(
    effect =>
      effect.status === 'verified-action-effect-lifecycle-binding-applied' &&
      Number(effect.elementId) === Number(node.elementId) &&
      effect.lifecycle
  )?.lifecycle;
  return {
    semanticKey,
    semanticIdentity: `semantic-effect:${semanticKey}`,
    controlSkillId: root.controlSkillId,
    mapIndex: root.mapIndex,
    elementId: node.elementId,
    pathId: node.pathId,
    name: node.name,
    rawSourceName: node.rawSourceName,
    sourceNameStatus: node.sourceNameStatus,
    displayLabel: node.displayLabel,
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
      durationMs:
        boundLifecycle?.durationMs ??
        resolveSemanticEffectDuration(node, relationPath, root),
      tags: node.lifecycle.tags,
      combineType: node.lifecycle.combineType,
      maxCount: node.lifecycle.maxCount,
      stackMode: stack.mode,
      stackDelta: boundLifecycle?.stackDelta ?? 1,
      maxStacks: boundLifecycle?.maxStacks ?? stack.maxStacks,
      instanceScope: stack.instanceScope,
      inheritance: boundLifecycle?.inheritance ?? null,
    },
    mechanic: node.mechanic,
    formula: node.formula,
    formulaRuntime,
    activationConditions: dedupeBy(
      rawEffects.flatMap(effect => effect.activationConditions ?? []),
      condition => JSON.stringify(condition)
    ),
    propertyConditionStatus:
      rawEffects.find(effect => effect.propertyConditionStatus)?.propertyConditionStatus ??
      null,
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
    },
    directSp:
      node.directSp?.recoverType === 0
        ? {
            ...node.directSp,
          }
        : null,
    cooldownReduction:
      node.directSp?.recoverType === 3
        ? {
            recoverType: 3,
            valueByLevel: node.formula?.valueByLevel ?? null,
          }
        : null,
    heal: node.kind === 'damage' && node.damage?.damageType === 5 ? {} : null,
    shield: (node.kind === 'shield' || node.damage?.damageType === 11) && {
      ...node.shield,
    },
    damage: node.damage,
    tuningMark: node.tuningMark,
    tuningOverlimit: node.tuningOverlimit,
    judgment: node.judgment,
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

function createSemanticFormulaRuntimeContract(
  node,
  { verifiedCharacterBinding = false } = {}
) {
  const commonFunctionId = Number(node.formula?.commonFunctionId);
  const baseFunctionId = Number(node.formula?.baseFunctionId);
  if (commonFunctionId === 1 && baseFunctionId === 5) {
    return {
      registry: 'AzPrVerifiedBattleEffectFormulaRegistry',
      family: 'literal-a-with-common-ratio',
      evaluator: 'q16.16-literal-a-times-g',
      status: 'applied',
      applied: true,
    };
  }
  if (commonFunctionId === 1 && baseFunctionId === 11) {
    return {
      registry: 'AzPrVerifiedBattleEffectFormulaRegistry',
      family: 'literal-a-direct',
      evaluator: 'q16.16-direct-literal-a',
      status: 'applied',
      applied: true,
    };
  }
  if (
    commonFunctionId === 1 &&
    baseFunctionId === 2 &&
    Number(node.damage?.damageType) === 5
  ) {
    return {
      registry: 'AzPrVerifiedBattleEffectFormulaRegistry',
      family: 'source-atk-ratio-heal',
      evaluator: 'q16.16-source-atk-times-a-per-10000',
      status: 'applied',
      applied: true,
    };
  }
  if (
    verifiedCharacterBinding &&
    commonFunctionId === 1 &&
    baseFunctionId === 3
  ) {
    return {
      registry: 'AzPrVerifiedBattleEffectFormulaRegistry',
      family: 'basis-point-property-a-with-common-ratio',
      evaluator: 'q16.16-basis-point-a-times-g',
      status: 'applied',
      applied: true,
    };
  }
  if (
    verifiedCharacterBinding &&
    commonFunctionId === 1 &&
    baseFunctionId === 2008
  ) {
    return {
      registry: 'AzPrVerifiedBattleEffectFormulaRegistry',
      family: 'source-tuning-ratio-with-common-ratio',
      evaluator: 'q16.16-source-tuning-times-a-times-g',
      status: 'applied',
      applied: true,
    };
  }
  if ([119, 107205, 107207].includes(baseFunctionId)) {
    return {
      registry: 'AzPrVerifiedBattleEffectFormulaRegistry',
      family: 'verified-tuning-state-formula',
      evaluator: 'verified-tuning-mark-runtime',
      status: 'delegated',
      applied: false,
    };
  }
  return {
    registry: 'AzPrVerifiedBattleEffectFormulaRegistry',
    family: `unsupported-${commonFunctionId || 0}-${baseFunctionId || 0}`,
    evaluator: null,
    status: 'unresolved',
    applied: false,
  };
}

function resolveSemanticEffectTarget(node, trigger, rawEffects) {
  const appliedTarget = rawEffects.find(
    effect =>
      effect.classification === 'applied' &&
      effect.target?.kind &&
      effect.target.kind !== 'unresolved' &&
      (['team-tuning-pool', 'enemy'].includes(effect.target.kind) ||
        effect.status === 'verified-action-effect-lifecycle-binding-applied')
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
  if (appliedTarget) {
    return {
      ...trigger.target,
      ...appliedTarget,
      resolution: 'static-resolved',
      sourceField: 'verified-character-combat-effect-binding',
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
  formulaRuntime,
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
        !formulaRuntime.applied ||
        reason !== 'property-formula-not-literal-function-5'
    )
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

function hasVerifiedCharacterCombatEffectBinding(rawEffects, elementId) {
  return rawEffects.some(
    effect =>
      effect.status === 'verified-action-effect-lifecycle-binding-applied' &&
      effect.classification === 'applied' &&
      Number(effect.elementId) === Number(elementId)
  );
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

function resolveSemanticMechanicClassification({
  role,
  node,
  rawEffects,
  reasons,
  placementResolution,
}) {
  if (role !== 'gameplay-effect') return 'structural';
  if (placementResolution !== 'static-resolved') return 'unresolved';
  if (reasons.length > 0) return 'unresolved';
  if (
    node.classification === 'applied' ||
    rawEffects.some(effect => effect.classification === 'applied')
  ) {
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

function createPublicActionTimingContract({
  candidate,
  mapping,
  control,
  ownerCompilation,
}) {
  const occupancyResolver =
    ownerCompilation?.timingPolicy === 'verified-input-reopen'
      ? resolveVerifiedActionInputOccupancy
      : resolveStandaloneActionOccupancy;
  const variantTimings = (control?.variants ?? []).map(variant =>
    createControlVariantTimingContract({
      control,
      variant,
      actionKind: candidate.actionKind,
      occupancyResolver,
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

function resolveVerifiedActionInputOccupancy({ animation, hits, windows }) {
  if (animation.status !== 'applied') {
    return createUnresolvedOccupancy('skill-control-animation-range-missing', {
      sourceIdentity: animation.sourceIdentity,
      frameRate: animation.frameRate,
    });
  }
  const lastHitFrame =
    hits.length > 0
      ? Math.max(...hits.map(hit => Number(hit.frame)).filter(Number.isFinite))
      : null;
  const candidates = (windows ?? [])
    .filter(
      window =>
        window.allowAttack === true &&
        (lastHitFrame == null || window.startFrame >= lastHitFrame)
    )
    .sort(
      (left, right) =>
        left.startFrame - right.startFrame ||
        left.endFrame - right.endFrame ||
        left.sourceIdentity.localeCompare(right.sourceIdentity)
    );
  const reopen = candidates[0];
  if (!reopen) {
    return createUnresolvedOccupancy(
      'verified-action-effective-occupancy-window-unresolved',
      {
        sourceIdentity: animation.sourceIdentity,
        frameRate: animation.frameRate,
      }
    );
  }
  return {
    startFrame: 0,
    endFrame: reopen.startFrame,
    durationFrames: reopen.startFrame,
    frameRate: animation.frameRate,
    status: 'applied',
    sourceKind: reopen.targetControlSkillId
      ? 'verified-specific-input-window'
      : 'verified-unconditional-attack-reopen-window',
    sourceIdentity: reopen.sourceIdentity,
    conversion: `${reopen.startFrame} source frames at ${animation.frameRate}fps`,
    animationDurationFrames: animation.durationFrames,
    lastHitFrame,
    reopenWindow: reopen,
    windowRole: reopen.targetControlSkillId
      ? 'specific-input-transition'
      : 'unconditional-attack-reopen',
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
          targetSubSkillIndex: nonNegativeIntegerOrNull(bridge.skillIndex),
          allowAttack: Boolean(bridge.allowAttack),
          baseOnInput: Boolean(bridge.baseOnInput),
          inputToIndex: Boolean(bridge.inputToIndex),
          bridgeType: nonNegativeIntegerOrNull(bridge.bridgeType),
          continuousAttackType: nonNegativeIntegerOrNull(
            bridge.continuousAttackType
          ),
          interruptBehavior: nonNegativeIntegerOrNull(bridge.interruptBehavior),
          frameIndex: nonNegativeIntegerOrNull(bridge.frameIndex),
          allowedInputCommands: dedupeBy(
            bridge.allowedInputCommands ?? [],
            value => value
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
        window.targetSubSkillIndex,
        window.bridgeType,
        window.continuousAttackType,
        window.interruptBehavior,
        window.frameIndex,
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
  return {
    ...mapping,
    mechanicsClassification,
    actionTiming,
    timingStatus: actionTiming.status,
    classification: mechanicsClassification,
    runtimeReady: mapping.runtimeReady,
    complete: mapping.complete,
    reasons: dedupeBy(
      [...(mapping.reasons ?? []), ...(actionTiming.reasons ?? [])],
      value => value
    ),
  };
}

function attachActionSchedulingContract({
  mapping,
  control,
  defaultSelection,
}) {
  const actionScheduling = createActionSchedulingContract({
    actionTiming: mapping.actionTiming,
    control,
    defaultSelection,
    variantModelStatus: mapping.variantModelStatus,
  });
  return {
    ...mapping,
    schedulable: Boolean(mapping.controlSkillId && control),
    actionScheduling,
    sourceEvidenceStatus:
      mapping.sourceEvidenceStatus ??
      mapping.mechanicsClassification ??
      mapping.classification,
    scenarioRuntimeStatus:
      mapping.scenarioRuntimeStatus ??
      (mapping.runtimeReady
        ? 'scenario-runtime-ready'
        : 'scenario-runtime-unresolved'),
  };
}

function createActionSchedulingContract({
  actionTiming,
  control,
  defaultSelection,
  variantModelStatus = 'resolved',
}) {
  const selectedSubSkillIndex =
    nonNegativeIntegerOrNull(actionTiming?.selectedSubSkillIndex) ??
    nonNegativeIntegerOrNull(defaultSelection?.subSkillIndex);
  const selectedTiming = (actionTiming?.variantTimings ?? []).find(
    timing => timing.subSkillIndex === selectedSubSkillIndex
  );
  const exactTiming =
    actionTiming?.status === 'applied'
      ? actionTiming
      : selectedTiming?.occupancy?.status === 'applied'
        ? selectedTiming
        : null;
  const exactOccupancy = exactTiming?.occupancy;
  if (positiveIntegerOrNull(exactOccupancy?.durationFrames)) {
    return {
      status: 'exact',
      kind: 'exact-selected-variant-occupancy',
      durationFrames: exactOccupancy.durationFrames,
      planningDurationFrames: null,
      selectedSubSkillIndex,
      sourceIdentity: exactOccupancy.sourceIdentity,
      sourceStatus: 'verified-input-occupancy',
      variantModelStatus,
      reasons: [],
    };
  }
  const animation = selectedTiming?.animation;
  if (
    animation?.status === 'applied' &&
    positiveIntegerOrNull(animation.durationFrames)
  ) {
    return {
      status: 'planning',
      kind: 'source-animation-planning-duration',
      durationFrames: null,
      planningDurationFrames: animation.durationFrames,
      selectedSubSkillIndex,
      sourceIdentity: animation.sourceIdentity,
      sourceStatus: 'verified-animation-duration',
      variantModelStatus,
      reasons: actionTiming?.reasons ?? [],
    };
  }
  return {
    status: 'planning',
    kind: 'generic-planning-duration',
    durationFrames: null,
    planningDurationFrames: 30,
    selectedSubSkillIndex,
    sourceIdentity: control?.sourcePath ?? null,
    sourceStatus: 'unresolved-control-identity',
    variantModelStatus: 'unresolved-control-identity',
    reasons: actionTiming?.reasons ?? ['skill-control-player-variant-missing'],
  };
}

function findDefaultActionVariantSelection(graph, ownerId, controlSkillId) {
  return (
    graph?.defaultSelections?.find(
      selection =>
        Number(selection.ownerId) === Number(ownerId) &&
        Number(selection.controlSkillId) === Number(controlSkillId)
    ) ?? null
  );
}

function findActionVariantConditionDiscovery(graph, ownerId, controlSkillId) {
  return (
    graph?.conditionDiscoveries?.find(
      discovery =>
        Number(discovery.ownerId) === Number(ownerId) &&
        Number(discovery.controlSkillId) === Number(controlSkillId)
    ) ?? null
  );
}

function classifyActionVariantModelStatus({
  graph,
  ownerId,
  controlSkillId,
  control,
}) {
  if ((control?.variants ?? []).length <= 1) return 'resolved';
  const discovery = findActionVariantConditionDiscovery(
    graph,
    ownerId,
    controlSkillId
  );
  if (discovery?.status) return discovery.status;
  const edges = (graph?.edges ?? []).filter(
    edge =>
      Number(edge.ownerId) === Number(ownerId) &&
      Number(edge.targetControlSkillId) === Number(controlSkillId)
  );
  const appliedCount = edges.filter(edge => edge.applied).length;
  const unresolvedCount = edges.length - appliedCount;
  if (appliedCount > 0 && unresolvedCount > 0) return 'partially-resolved';
  if (appliedCount > 0) return 'resolved';
  return 'variant-condition-not-yet-modeled';
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

function createAttackInputChainSchedulingContract(segments) {
  const schedulings = (segments ?? [])
    .map(segment => segment.actionScheduling)
    .filter(Boolean);
  if (!segments.length || schedulings.length !== segments.length) {
    return {
      status: 'planning',
      kind: 'generic-planning-duration',
      durationFrames: null,
      planningDurationFrames: 30,
      selectedSubSkillIndex: null,
      sourceIdentity: null,
      sourceStatus: 'unresolved-control-identity',
      variantModelStatus: 'unresolved-control-identity',
      reasons: ['normal-attack-input-segment-control-identity-unresolved'],
    };
  }
  const totalFrames = schedulings.reduce(
    (sum, scheduling, index) =>
      sum +
      Number(
        scheduling.durationFrames ?? scheduling.planningDurationFrames ?? 0
      ) +
      Number(segments[index]?.defaultLinkDelayFrames ?? 0),
    0
  );
  const hasGeneric = schedulings.some(
    scheduling => scheduling.kind === 'generic-planning-duration'
  );
  const hasSourcePlanning = schedulings.some(
    scheduling => scheduling.kind === 'source-animation-planning-duration'
  );
  const hasPlanning = schedulings.some(
    scheduling => scheduling.status === 'planning'
  );
  const variantStatuses = new Set(
    schedulings.map(scheduling => scheduling.variantModelStatus)
  );
  const variantModelStatus = variantStatuses.has('partially-resolved')
    ? 'partially-resolved'
    : variantStatuses.has('variant-condition-not-yet-modeled')
      ? 'variant-condition-not-yet-modeled'
      : variantStatuses.has('static-evidence-gap')
        ? 'static-evidence-gap'
        : variantStatuses.has('runtime-dependent')
          ? 'runtime-dependent'
          : 'resolved';
  return {
    status: hasPlanning ? 'planning' : 'exact',
    kind: hasPlanning
      ? hasSourcePlanning
        ? 'source-animation-planning-duration'
        : 'generic-planning-duration'
      : 'exact-selected-variant-occupancy',
    durationFrames: hasPlanning ? null : totalFrames,
    planningDurationFrames: hasPlanning ? totalFrames : null,
    selectedSubSkillIndex: null,
    sourceIdentity: schedulings
      .map(scheduling => scheduling.sourceIdentity)
      .filter(Boolean)
      .join('|'),
    sourceStatus: hasPlanning
      ? hasSourcePlanning
        ? 'verified-animation-duration'
        : 'unresolved-control-identity'
      : 'verified-input-occupancy',
    variantModelStatus,
    containsGenericFallback: hasGeneric,
    reasons: dedupeBy(
      schedulings.flatMap(scheduling => scheduling.reasons ?? []),
      value => value
    ),
  };
}

function createAttackInputSegments(
  candidate,
  controlBySkillId,
  actionVariantGraph,
  resourceTransactions = []
) {
  const inputs = candidate.attackInputControls ?? [];
  const segments = inputs.map((input, segmentIndex) => {
    const control = controlBySkillId.get(input.controlSkillId);
    const defaultSelection = findDefaultActionVariantSelection(
      actionVariantGraph,
      candidate.ownerId,
      input.controlSkillId
    );
    const mapping = createActionMapping(
      {
        ...candidate,
        controlSkillId: input.controlSkillId,
        bindingKind: 'hero-normal-attack-input-control',
        bindingSourceIdentity: input.sourceIdentity,
        attackInputControls: undefined,
      },
      control,
      {
        defaultSelection,
        resourceTransactions,
        variantModelStatus: classifyActionVariantModelStatus({
          graph: actionVariantGraph,
          ownerId: candidate.ownerId,
          controlSkillId: input.controlSkillId,
          control,
        }),
        variantConditionDiscovery: findActionVariantConditionDiscovery(
          actionVariantGraph,
          candidate.ownerId,
          input.controlSkillId
        ),
      }
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
    const actionScheduling = createActionSchedulingContract({
      actionTiming: timing.actionTiming,
      control,
      defaultSelection,
      variantModelStatus: mapping.variantModelStatus,
    });
    return {
      identity: `${mapping.identity}|attack-input-${input.sequenceIndex}`,
      sequenceIndex: input.sequenceIndex,
      sequenceTotal: input.sequenceTotal,
      label: `A${input.sequenceIndex}`,
      controlSkillId: input.controlSkillId,
      selectedSubSkillIndex: mapping.selectedSubSkillIndex,
      schedulable: mapping.schedulable,
      sourceEvidenceStatus: mapping.sourceEvidenceStatus,
      scenarioRuntimeStatus: mapping.scenarioRuntimeStatus,
      variantConditionDiscovery: mapping.variantConditionDiscovery,
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
      actionScheduling,
      sourceEvidenceStatus: mapping.sourceEvidenceStatus,
      scenarioRuntimeStatus: mapping.scenarioRuntimeStatus,
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
      classification: mechanicsClassification,
      runtimeReady: mapping.runtimeReady,
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
  const finalHitFrame = hits.at(-1)?.frame ?? null;
  const linkWindow =
    matchingWindows.find(
      window => finalHitFrame == null || window.startFrame >= finalHitFrame
    ) ??
    matchingWindows.find(window => {
      const occupancyEndFrame = Math.max(
        window.startFrame,
        finalHitFrame ?? window.startFrame
      );
      return occupancyEndFrame <= window.endFrame;
    }) ??
    null;
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
      : window.kind === 'attack-reopen-window' || window.allowAttack === true
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

function createActionMapping(
  candidate,
  control,
  {
    defaultSelection = null,
    resourceTransactions = [],
    variantModelStatus = 'resolved',
    variantConditionDiscovery = null,
  } = {}
) {
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
    schedulable: Boolean(candidate.bindingEligible && control),
    catalogDeclaration: candidate.catalogDeclaration ?? null,
    variantModelStatus,
    variantConditionDiscovery,
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
      sourceEvidenceStatus: 'static-evidence-gap',
      scenarioRuntimeStatus: 'scenario-runtime-unresolved',
      reasons: [
        control ? 'public-control-link-unresolved' : 'skill-control-missing',
      ],
      dimensionSummary: createEmptyDimensionSummary('unresolved'),
    };
  }
  const variantResolution = resolveControlVariant(control, candidate, {
    defaultSelection,
  });
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
      sourceEvidenceStatus: 'static-evidence-gap',
      scenarioRuntimeStatus: 'scenario-runtime-unresolved',
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
  const sourceRuntimeHits = runtimeHits.filter(
    hit => hit.sourceEvidenceStatus === 'applied'
  );
  const scenarioRuntimeHits = runtimeHits.filter(
    hit => hit.scenarioRuntimeStatus === 'scenario-assumed-zero-distance'
  );
  const runtimeEffects = control.effects.filter(
    effect => effect.mapIndex === selectedSubSkillIndex
  );
  const appliedEffects = runtimeEffects.filter(
    effect => effect.classification === 'applied'
  );
  const scenarioRuntimeEffects = runtimeEffects.filter(
    effect =>
      effect.classification === 'applied' &&
      effect.scenarioRuntimeStatus === 'scenario-assumed-zero-distance'
  );
  const scenarioCoveredElements = selectedElements.filter(
    element => element.scenarioClassification === 'applied'
  );
  const appliedResourceTransactions = resourceTransactions.filter(
    transaction =>
      transaction.applied === true &&
      Number(transaction.ownerId) === Number(candidate.ownerId) &&
      Number(transaction.controlSkillId) === Number(candidate.controlSkillId) &&
      Number(transaction.subSkillIndex) === Number(selectedSubSkillIndex)
  );
  const spCost = finiteNumberOrNull(control.logic?.spCost);
  const hasAppliedCost = spCost != null && spCost > 0;
  const hasAppliedResourceTransaction = appliedResourceTransactions.length > 0;
  const relevantElements = selectedElements.filter(
    element => element.threeValueRelevant
  );
  const blockingUnresolved = relevantElements.filter(
    element =>
      element.classification === 'unresolved' &&
      element.scenarioClassification !== 'applied'
  );
  const allRelevantZero =
    relevantElements.length > 0 &&
    relevantElements.every(
      element => element.classification === 'verified-zero'
    );
  const classification =
    runtimeHits.length > 0 ||
    hasAppliedCost ||
    hasAppliedResourceTransaction ||
    appliedEffects.length > 0
      ? 'applied'
      : allRelevantZero && spCost === 0
        ? 'verified-zero'
        : 'unresolved';
  const sourceClassification =
    sourceRuntimeHits.length > 0 ||
    hasAppliedCost ||
    hasAppliedResourceTransaction ||
    appliedEffects.length > 0
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
    runtimeResourceTransactionCount: appliedResourceTransactions.length,
    selectedResourceTransactionIdentities: appliedResourceTransactions.map(
      transaction => transaction.operationIdentity
    ),
    selectedElementCount: selectedElements.length,
    selectedHitIdentities: runtimeHits.map(hit => hit.hitIdentity),
    selectedEffectIdentities: runtimeEffects.map(
      effect => effect.effectIdentity
    ),
    classification,
    sourceEvidenceStatus:
      sourceClassification === 'applied'
        ? 'applied'
        : scenarioRuntimeHits.length > 0 ||
            scenarioRuntimeEffects.length > 0 ||
            scenarioCoveredElements.length > 0
          ? 'runtime-dependent'
          : sourceClassification === 'verified-zero'
            ? 'verified-zero'
            : 'static-evidence-gap',
    scenarioRuntimeStatus:
      scenarioRuntimeHits.length > 0 ||
      scenarioRuntimeEffects.length > 0 ||
      scenarioCoveredElements.length > 0
        ? 'scenario-assumed-zero-distance'
        : classification === 'applied'
          ? 'source-verified'
          : 'scenario-runtime-unresolved',
    scenarioResolvedHitCount: scenarioRuntimeHits.length,
    scenarioResolvedEffectCount: scenarioRuntimeEffects.length,
    scenarioResolvedElementCount: scenarioCoveredElements.length,
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

function resolveControlVariant(
  control,
  candidate,
  { defaultSelection = null } = {}
) {
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
  const defaultVariant = variants.find(
    variant =>
      Number(variant.subSkillIndex) === Number(defaultSelection?.subSkillIndex)
  );
  if (defaultVariant) {
    return {
      subSkillIndex: defaultVariant.subSkillIndex,
      status: 'applied',
      kind: 'verified-client-default-subskill-index',
      sourceIdentity:
        defaultSelection.sourceIdentity ?? defaultVariant.sourceIdentity,
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

function createXiaoyuActionOccupancyAudit(packageValue) {
  const rows = [];
  const mappings = packageValue.actionMappings.filter(
    mapping => Number(mapping.ownerId) === XIAOYU_MECHANICS.ownerId
  );
  for (const mapping of mappings) {
    if (
      mapping.actionKind === 'normal-attack' ||
      mapping.actionKind === 'charged-attack'
    ) {
      continue;
    }
    for (const timing of mapping.actionTiming?.variantTimings ?? []) {
      rows.push(
        createXiaoyuActionOccupancyAuditRow({
          identity: `${mapping.identity}|sub:${timing.subSkillIndex}`,
          publicActionIdentity: mapping.identity,
          actionKind: mapping.actionKind,
          semanticName: mapping.actionName ?? mapping.actionKind,
          controlSkillId: mapping.controlSkillId,
          subSkillIndex: timing.subSkillIndex,
          timing,
          context: 'public-action-control',
        })
      );
    }
  }
  for (const chain of packageValue.actionVariantGraph?.attackInputChains ??
    []) {
    if (Number(chain.ownerId) !== XIAOYU_MECHANICS.ownerId) continue;
    const burst = chain.stateCondition?.kind === 'resource-state-active';
    for (const segment of chain.segments ?? []) {
      rows.push(
        createXiaoyuActionOccupancyAuditRow({
          identity: `${chain.chainIdentity}|input:${segment.sequenceIndex}`,
          publicActionIdentity: `actor:${XIAOYU_MECHANICS.ownerId}:normal-attack`,
          actionKind: 'normal-attack',
          semanticName: `${burst ? '爆发普攻' : '普通攻击'} A${segment.sequenceIndex}`,
          controlSkillId: segment.controlSkillId,
          subSkillIndex: segment.subSkillIndex,
          timing: segment.executionTiming,
          context: chain.chainIdentity,
          sourceIdentity: segment.sourceIdentity,
        })
      );
    }
  }
  for (const form of packageValue.actionVariantGraph?.publicActionForms ?? []) {
    if (Number(form.ownerId) !== XIAOYU_MECHANICS.ownerId) continue;
    rows.push(
      createXiaoyuActionOccupancyAuditRow({
        identity: form.formIdentity,
        publicActionIdentity: form.publicActionIdentity,
        actionKind: form.publicActionKind,
        semanticName: form.semanticName,
        controlSkillId: form.executionControlSkillId,
        subSkillIndex: form.executionSubSkillIndex,
        timing: form.executionTiming,
        context: form.selectionKind,
        sourceIdentity: form.sourceIdentity,
      })
    );
  }
  rows.sort(
    (left, right) =>
      String(left.actionKind).localeCompare(String(right.actionKind)) ||
      Number(left.controlSkillId) - Number(right.controlSkillId) ||
      Number(left.subSkillIndex) - Number(right.subSkillIndex) ||
      String(left.identity).localeCompare(String(right.identity))
  );
  return {
    schemaVersion: 1,
    kind: 'm9-r3-r2-xiaoyu-action-occupancy-audit',
    status: 'xiaoyu-action-occupancy-audit-ready',
    ownerId: XIAOYU_MECHANICS.ownerId,
    ownerName: '涂山小玉',
    frameRate: 60,
    rows,
    summary: {
      rowCount: rows.length,
      exactOccupancyCount: rows.filter(row => row.occupancyStatus === 'applied')
        .length,
      planningOccupancyCount: rows.filter(
        row => row.occupancyStatus === 'planning'
      ).length,
      unresolvedOccupancyCount: rows.filter(
        row => row.occupancyStatus === 'unresolved'
      ).length,
      animationTailRemovedCount: rows.filter(
        row =>
          Number(row.animationDurationFrames) >
          Number(row.effectiveOccupancyFrames)
      ).length,
      publicActionKindCount: new Set(rows.map(row => row.actionKind)).size,
    },
    sourceIdentity: [
      'Battle/SkillList/skill_control_101010*.asset',
      'skillControlData.skillPlayers|skillResourceMaps',
      'EventBridge behaviorlineControl',
    ],
  };
}

function createXiaoyuActionOccupancyAuditRow({
  identity,
  publicActionIdentity,
  actionKind,
  semanticName,
  controlSkillId,
  subSkillIndex,
  timing,
  context,
  sourceIdentity = null,
}) {
  const hitFrames = (timing?.hits ?? [])
    .map(hit => Number(hit.frame))
    .filter(Number.isFinite);
  const occupancyStatus =
    timing?.occupancy?.status === 'applied'
      ? 'applied'
      : Number(timing?.animation?.durationFrames) > 0
        ? 'planning'
        : 'unresolved';
  return {
    identity,
    publicActionIdentity,
    actionKind,
    semanticName,
    context,
    controlSkillId,
    subSkillIndex,
    animationDurationFrames:
      positiveIntegerOrNull(timing?.animation?.durationFrames) ?? null,
    firstHitFrame: hitFrames.length > 0 ? Math.min(...hitFrames) : null,
    lastHitFrame: hitFrames.length > 0 ? Math.max(...hitFrames) : null,
    effectiveOccupancyFrames:
      positiveIntegerOrNull(timing?.occupancy?.durationFrames) ??
      positiveIntegerOrNull(timing?.animation?.durationFrames) ??
      null,
    occupancyStatus,
    occupancySourceKind:
      timing?.occupancy?.sourceKind ??
      (occupancyStatus === 'planning'
        ? 'source-animation-planning-duration'
        : 'unresolved'),
    reopenWindow: timing?.occupancy?.reopenWindow ?? null,
    selectedWindowRole: timing?.occupancy?.windowRole ?? null,
    windowKindCounts: countValues(
      (timing?.windows ?? []).map(window => window.kind)
    ),
    windows: timing?.windows ?? [],
    animationSourceIdentity: timing?.animation?.sourceIdentity ?? null,
    occupancySourceIdentity:
      timing?.occupancy?.sourceIdentity ?? sourceIdentity ?? null,
    reasons: timing?.occupancy?.reasons ?? [],
  };
}

function createXiaoyuActionOccupancyMarkdown(report) {
  const lines = [
    '# M9-R3-R2 涂山小玉动作占轴审计',
    '',
    `- 动作/形态行：${report.summary.rowCount}`,
    `- 精确占轴：${report.summary.exactOccupancyCount}`,
    `- 动画规划占轴：${report.summary.planningOccupancyCount}`,
    `- 未解析：${report.summary.unresolvedOccupancyCount}`,
    `- 已剔除收招尾帧：${report.summary.animationTailRemovedCount}`,
    '',
    '| 动作 | 语义形态 | control/sub | 动画 | 首末命中 | 有效占轴 | 占轴窗 | 状态 | 来源 |',
    '| --- | --- | --- | ---: | --- | ---: | --- | --- | --- |',
    ...report.rows.map(
      row =>
        `| ${row.actionKind} | ${row.semanticName} | ${row.controlSkillId}/sub${row.subSkillIndex} | ${row.animationDurationFrames ?? '-'}F | ${row.firstHitFrame ?? '-'}-${row.lastHitFrame ?? '-'}F | ${row.effectiveOccupancyFrames ?? '-'}F | ${row.selectedWindowRole ?? '-'} | ${row.occupancyStatus} | ${row.occupancySourceKind} |`
    ),
    '',
    '完整动画、命中帧、输入/派生窗口和有效占轴分别保留；时间轴阻塞只消费 effective occupancy。',
  ];
  return `${lines.join('\n')}\n`;
}

function createXiaoyuHiddenInputDerivationReport({ packageValue, audit }) {
  if (
    !audit ||
    audit.ownerId !== XIAOYU_MECHANICS.ownerId ||
    audit.publicExecutionFormCount !== 21 ||
    audit.publicExecutionFormsCovered !== 21 ||
    audit.summary?.appliedContextEdgeCount !== 7
  ) {
    throw new Error('Xiaoyu hidden input derivation audit is incomplete');
  }
  return {
    ...audit,
    packageId: packageValue.packageId,
    packageHash: packageValue.packageHash,
    sourceIdentity: dedupeBy(
      [
        ...(audit.sourceIdentity ?? []),
        'Battle/SkillList/skill_control_101010*.asset',
        'EventBridge behaviorlineControl[startFrame,frameCount,skillId,skillIndex]',
        'characters.items[id=101010].skillSlots',
      ],
      value => value
    ),
  };
}

function createXiaoyuHiddenInputMarkdown(report) {
  const appliedContextRows = report.rows.filter(
    row => row.status === 'verified-input-context-edge-applied'
  );
  const formSummaries = report.publicExecutionForms.map(form => {
    const rows = report.rows.filter(
      row => row.publicActionIdentity === form.publicActionIdentity
    );
    return {
      ...form,
      rowCount: rows.length,
      appliedCount: rows.filter(row => row.applied).length,
      specifiedDerivedCount: rows.filter(
        row => row.relationType === 'specified-input-derived'
      ).length,
      status: rows.some(row => row.sourceControlPresent)
        ? 'covered'
        : 'source-missing',
    };
  });
  const lines = [
    '# M9-R3-R2-R2 涂山小玉隐藏输入派生审计',
    '',
    `- 公开执行形态：${report.publicExecutionFormsCovered}/${report.publicExecutionFormCount}`,
    `- EventBridge / 支持控制审计行：${report.summary.rowCount}`,
    `- 已接入上下文派生边：${report.summary.appliedContextEdgeCount}`,
    `- 普攻链直接接续：${report.summary.attackChainLinkCount}`,
    `- 系统/移动控制排除：${report.summary.systemControlExclusionCount}`,
    '',
    '## 已接入指定输入派生',
    '',
    '| 来源动作 | source control/sub | 输入 | 半开窗口 | 目标形态 | target control/sub | 条件 |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...appliedContextRows.map(
      row =>
        `| ${row.sourceSemanticName} | ${row.sourceControlSkillId}/sub${row.sourceSubSkillIndex} | ${row.inputCommand ?? '-'} | [${row.inputWindow.startFrame}, ${row.inputWindow.endFrame})F | ${row.semanticName} | ${row.targetControlSkillId}/sub${row.targetSubSkillIndex} | ${row.condition?.kind ?? 'always'} |`
    ),
    '',
    '## 公开形态覆盖',
    '',
    '| 形态 | control/sub | 窗口行 | 已应用关系 | 指定派生 | 状态 |',
    '| --- | --- | ---: | ---: | ---: | --- |',
    ...formSummaries.map(
      form =>
        `| ${form.semanticName} | ${form.sourceControlSkillId}/sub${form.sourceSubSkillIndex} | ${form.rowCount} | ${form.appliedCount} | ${form.specifiedDerivedCount} | ${form.status} |`
    ),
    '',
    '## 星携技核查',
    '',
    `- 结论：${report.starCarryConclusion.conclusion}`,
    `- 状态：${report.starCarryConclusion.status}`,
    `- 入场执行：10101021/sub0；直接指向 10101042 的边：${report.starCarryConclusion.directDerivedEdgeCount}`,
    `- 10101041 来源控制：${report.starCarryConclusion.wrapperSourceControlSkillIds.join(', ') || '无'}`,
    '',
    '普通取消/重开窗口、普攻连段、指定输入派生、状态分支和系统控制分别保留；窗口统一采用 [startFrame, endFrame) 半开区间。',
    '',
  ];
  return lines.join('\n');
}

function createContextualInputSchedulingAuditReport({
  packageValue,
  xiaoyuHiddenInputAudit,
}) {
  const timingSources = collectPublicActionTimingSources(packageValue);
  const globalRows = dedupeBy(
    timingSources.flatMap(source =>
      (source.timing?.windows ?? []).map((window, windowIndex) =>
        createContextualInputSchedulingAuditRow({
          ...source,
          window,
          windowIndex,
        })
      )
    ),
    row => row.rowIdentity
  );
  const successorWindowCounts = countValues(
    globalRows.map(row =>
      [
        row.sourceControlSkillId,
        row.sourceSubSkillIndex,
        row.targetControlSkillId ?? 0,
        row.targetSubSkillIndex ?? 0,
        row.inputCommand ?? 'none',
      ].join('|')
    )
  );
  const rows = globalRows.map(row => {
    const successorKey = [
      row.sourceControlSkillId,
      row.sourceSubSkillIndex,
      row.targetControlSkillId ?? 0,
      row.targetSubSkillIndex ?? 0,
      row.inputCommand ?? 'none',
    ].join('|');
    return {
      ...row,
      hasMultipleWindowsForSuccessor:
        Number(successorWindowCounts[successorKey] ?? 0) > 1,
    };
  });
  const timingByControlAndSub = new Map(
    timingSources.map(source => [
      `${source.sourceControlSkillId}|${source.sourceSubSkillIndex}`,
      source,
    ])
  );
  const contextEdgeByWindow = new Map(
    (packageValue.actionVariantGraph?.contextEdges ?? []).map(edge => [
      [
        edge.sourceControlSkillId,
        edge.sourceSubSkillIndex,
        edge.inputWindow?.startFrame,
        edge.inputWindow?.endFrame,
        edge.executionControlSkillId,
        edge.targetSubSkillIndex,
      ].join('|'),
      edge,
    ])
  );
  const xiaoyuRows = (xiaoyuHiddenInputAudit.rows ?? []).map(row => {
    const timingSource = timingByControlAndSub.get(
      `${row.sourceControlSkillId}|${row.sourceSubSkillIndex}`
    );
    const edge = contextEdgeByWindow.get(
      [
        row.sourceControlSkillId,
        row.sourceSubSkillIndex,
        row.inputWindow?.startFrame,
        row.inputWindow?.endFrame,
        row.targetControlSkillId,
        row.targetSubSkillIndex,
      ].join('|')
    );
    const timing = timingSource?.timing ?? null;
    const window = row.inputWindow
      ? {
          ...row.inputWindow,
          ...(row.evidence ?? {}),
          allowedInputCommands: row.allowedInputCommands ?? [],
          sourceIdentity: row.evidence?.sourceIdentity ?? row.sourceIdentity,
        }
      : null;
    const scheduling = window
      ? createContextualInputSchedulingAuditRow({
          publicActionIdentity: row.publicActionIdentity,
          actionKind: row.actionKind,
          semanticName: row.sourceSemanticName,
          sourceControlSkillId: row.sourceControlSkillId,
          sourceSubSkillIndex: row.sourceSubSkillIndex,
          timing,
          sourceIdentity: row.sourceIdentity,
          window,
          windowIndex: 0,
          contextEdge: edge,
          inputCommand: row.inputCommand,
          condition: row.condition,
        })
      : null;
    return {
      ...row,
      animationDurationFrames:
        scheduling?.animationDurationFrames ??
        timing?.animation?.durationFrames ??
        null,
      firstHitFrame:
        scheduling?.firstHitFrame ?? timing?.hitEnvelope?.firstFrame ?? null,
      lastHitFrame:
        scheduling?.lastHitFrame ?? timing?.hitEnvelope?.lastFrame ?? null,
      genericOccupancyFrames:
        scheduling?.genericOccupancyFrames ??
        timing?.occupancy?.durationFrames ??
        null,
      inputSemantics:
        scheduling?.inputSemantics ??
        classifyVerifiedEventBridgeInputSemantics(window),
      windowClassification: scheduling?.windowClassification ?? 'unresolved',
      canonicalInputFrame: scheduling?.canonicalInputFrame ?? null,
      executionStartFrame: scheduling?.executionStartFrame ?? null,
      contextualPredecessorEndFrame:
        scheduling?.contextualPredecessorEndFrame ?? null,
      edgeToEdgeBefore: scheduling?.edgeToEdgeBefore ?? 'not-applicable',
      edgeToEdgeAfter: scheduling?.edgeToEdgeAfter ?? 'not-applicable',
      contextEdgeIdentity: scheduling?.contextEdgeIdentity ?? null,
      schedulingStatus:
        scheduling?.status ??
        (window ? 'unresolved-window-scheduling' : 'no-control-window'),
      unresolvedReason:
        scheduling?.unresolvedReason ??
        row.exclusionReason ??
        (window ? null : 'no-control-window'),
      inputSchedulingSourceIdentity:
        scheduling?.inputSchedulingSourceIdentity ?? row.sourceIdentity,
    };
  });
  const categoryCounts = countValues(rows.map(row => row.windowClassification));
  return {
    schemaVersion: 1,
    kind: 'verified-contextual-input-scheduling-audit',
    status: 'verified-contextual-input-scheduling-audit-ready',
    frameRate: 60,
    packageId: packageValue.packageId,
    packageHash: packageValue.packageHash,
    policy: {
      sourceWindowInterval: '[start,end)',
      immediateInterrupt:
        'inputFrame=executionStartFrame=contextualPredecessorEndFrame',
      bufferedInput:
        'inputFrame remains inside the source window; execution uses the verified buffer boundary',
      edgeIntent:
        'map only a generic edge with source evidence to a canonical valid input; never make endFrame inclusive',
    },
    rows,
    xiaoyu: {
      ownerId: XIAOYU_MECHANICS.ownerId,
      publicExecutionFormCount: xiaoyuHiddenInputAudit.publicExecutionFormCount,
      rowCount: xiaoyuRows.length,
      expectedRowCount: 89,
      rows: xiaoyuRows,
    },
    summary: {
      publicTimingSourceCount: timingSources.length,
      verifiedWindowCount: rows.length,
      resolvedInputSemanticsCount: rows.filter(
        row => row.inputSemantics !== 'unresolved'
      ).length,
      unresolvedInputSemanticsCount: rows.filter(
        row => row.inputSemantics === 'unresolved'
      ).length,
      edgeIntentResolvedCount: rows.filter(
        row => row.edgeToEdgeAfter === 'resolved'
      ).length,
      multipleWindowSuccessorCount: rows.filter(
        row => row.hasMultipleWindowsForSuccessor
      ).length,
      categoryCounts,
      xiaoyuPublicExecutionFormCount:
        xiaoyuHiddenInputAudit.publicExecutionFormCount,
      xiaoyuWindowAuditRowCount: xiaoyuRows.length,
      xiaoyuAppliedContextEdgeCount:
        xiaoyuHiddenInputAudit.summary.appliedContextEdgeCount,
    },
    sourceIdentity: [
      'Battle/SkillList/skill_control_*.asset#EventBridgeBehavior',
      'client-runtime:EventBridgeBehavior.Start/OnEvent/Update',
      ...dedupeBy(
        rows.map(row => row.inputSchedulingSourceIdentity).filter(Boolean),
        value => value
      ),
    ],
  };
}

function collectPublicActionTimingSources(packageValue) {
  return (packageValue.actionMappings ?? []).flatMap(mapping => {
    const base = {
      publicActionIdentity: mapping.identity,
      actionKind: mapping.actionKind,
      semanticName: mapping.name ?? mapping.actionName ?? mapping.actionKind,
      sourceControlSkillId: mapping.controlSkillId,
      sourceSubSkillIndex: mapping.selectedSubSkillIndex ?? 0,
      sourceIdentity: mapping.bindingSourceIdentity ?? mapping.sourceIdentity,
    };
    const sources = [];
    for (const timing of mapping.actionTiming?.variantTimings ?? []) {
      sources.push({
        ...base,
        sourceSubSkillIndex: timing.subSkillIndex,
        timing,
      });
    }
    if (
      mapping.actionTiming &&
      !(mapping.actionTiming.variantTimings?.length > 0)
    ) {
      sources.push({ ...base, timing: mapping.actionTiming });
    }
    for (const segment of getAuditAttackInputSegments(mapping)) {
      if (!segment.actionTiming) continue;
      sources.push({
        publicActionIdentity: segment.identity,
        actionKind: 'normal-attack',
        semanticName: segment.label,
        sourceControlSkillId: segment.controlSkillId,
        sourceSubSkillIndex: segment.selectedSubSkillIndex ?? 0,
        sourceIdentity:
          segment.durationSourceIdentity ?? segment.sourceIdentity,
        timing: segment.actionTiming,
      });
    }
    return sources;
  });
}

function createContextualInputSchedulingAuditRow({
  publicActionIdentity,
  actionKind,
  semanticName,
  sourceControlSkillId,
  sourceSubSkillIndex,
  timing,
  sourceIdentity,
  window,
  windowIndex,
  contextEdge = null,
  inputCommand = null,
  condition = null,
}) {
  const contextScheduling = contextEdge?.inputScheduling ?? null;
  const genericOccupancyFrames =
    nonNegativeIntegerOrNull(contextScheduling?.predecessorGenericEndFrame) ??
    nonNegativeIntegerOrNull(timing?.occupancy?.durationFrames);
  const inputSemantics =
    contextScheduling?.inputSemantics ??
    classifyVerifiedEventBridgeInputSemantics(window);
  const windowClassification =
    contextScheduling?.windowClassification ??
    classifyInputWindowAgainstOccupancy({
      window,
      occupancyEndFrame: genericOccupancyFrames,
    });
  const inside =
    genericOccupancyFrames != null &&
    genericOccupancyFrames >= Number(window.startFrame) &&
    genericOccupancyFrames < Number(window.endFrame);
  const endAligned =
    genericOccupancyFrames != null &&
    genericOccupancyFrames === Number(window.endFrame);
  const canonicalInputFrame =
    nonNegativeIntegerOrNull(
      contextScheduling?.edgeIntent?.canonicalInputFrame
    ) ??
    (inside
      ? genericOccupancyFrames
      : endAligned
        ? Number(window.endFrame) - 1
        : null);
  const immediate = ['immediate-interrupt', 'immediate-continuous'].includes(
    inputSemantics
  );
  const executionStartFrame =
    nonNegativeIntegerOrNull(
      contextScheduling?.edgeIntent?.canonicalExecutionStartFrame
    ) ??
    (canonicalInputFrame == null
      ? null
      : immediate
        ? canonicalInputFrame
        : (nonNegativeIntegerOrNull(window.frameIndex) ??
          genericOccupancyFrames));
  const contextualPredecessorEndFrame =
    nonNegativeIntegerOrNull(
      contextScheduling?.edgeIntent?.canonicalPredecessorEndFrame
    ) ?? executionStartFrame;
  const resolvable =
    canonicalInputFrame != null &&
    inputSemantics !== 'unresolved' &&
    executionStartFrame != null;
  return {
    rowIdentity: [
      publicActionIdentity,
      `control:${sourceControlSkillId}`,
      `sub:${sourceSubSkillIndex}`,
      `window:${window.startFrame}-${window.endFrame}:${windowIndex}`,
      `target:${window.targetControlSkillId ?? 0}`,
      `sub:${window.targetSubSkillIndex ?? 0}`,
    ].join('|'),
    publicActionIdentity,
    actionKind,
    semanticName,
    sourceControlSkillId,
    sourceSubSkillIndex,
    inputCommand:
      inputCommand ??
      window.allowedInputCommands?.[0] ??
      (window.allowAttack ? 'normal-attack' : null),
    inputWindow: {
      startFrame: window.startFrame,
      endFrame: window.endFrame,
      interval: '[start,end)',
    },
    condition: condition ?? { kind: 'source-window' },
    targetControlSkillId: window.targetControlSkillId ?? null,
    targetSubSkillIndex: window.targetSubSkillIndex ?? null,
    animationDurationFrames: timing?.animation?.durationFrames ?? null,
    firstHitFrame: timing?.hitEnvelope?.firstFrame ?? null,
    lastHitFrame: timing?.hitEnvelope?.lastFrame ?? null,
    genericOccupancyFrames,
    inputSemantics,
    windowClassification,
    canonicalInputFrame,
    executionStartFrame,
    contextualPredecessorEndFrame,
    edgeToEdgeBefore: endAligned
      ? 'rejected-by-half-open-window'
      : inside
        ? 'already-inside-source-window'
        : 'not-applicable',
    edgeToEdgeAfter: resolvable ? 'resolved' : 'not-applicable',
    contextEdgeIdentity: contextEdge?.edgeIdentity ?? null,
    status: resolvable
      ? 'verified-contextual-input-scheduling-ready'
      : 'contextual-input-scheduling-unresolved',
    unresolvedReason: resolvable
      ? null
      : genericOccupancyFrames == null
        ? 'predecessor-effective-occupancy-unresolved'
        : inputSemantics === 'unresolved'
          ? 'event-bridge-input-execution-semantics-unresolved'
          : 'generic-edge-has-no-verified-window-mapping',
    evidence: {
      bridgeType: window.bridgeType ?? null,
      continuousAttackType: window.continuousAttackType ?? null,
      interruptBehavior: window.interruptBehavior ?? null,
      frameIndex: window.frameIndex ?? null,
      baseOnInput: window.baseOnInput ?? false,
      inputToIndex: window.inputToIndex ?? false,
    },
    inputSchedulingSourceIdentity: [
      sourceIdentity,
      window.sourceIdentity,
      timing?.occupancy?.sourceIdentity,
      'client-runtime:EventBridgeBehavior.Start/OnEvent/Update',
    ]
      .filter(Boolean)
      .join('|'),
  };
}

function createContextualInputSchedulingMarkdown(report) {
  const xiaoyuApplied = report.xiaoyu.rows.filter(
    row => row.contextEdgeIdentity != null
  );
  return [
    '# M9-R3-R2-R3 派生输入与动作接续审计',
    '',
    `- 小玉公开执行形态：${report.xiaoyu.publicExecutionFormCount}`,
    `- 小玉窗口审计：${report.xiaoyu.rowCount}/${report.xiaoyu.expectedRowCount}`,
    `- 全公开动作窗口：${report.summary.verifiedWindowCount}`,
    `- 已解析输入/执行语义：${report.summary.resolvedInputSemanticsCount}`,
    `- 可解析贴边接续：${report.summary.edgeIntentResolvedCount}`,
    `- 同一后继多窗口行：${report.summary.multipleWindowSuccessorCount}`,
    '',
    '原始窗口始终保持 `[startFrame, endFrame)`；贴边修复通过分离输入帧、执行起点和前动作关系性结束帧完成。',
    '',
    '## 小玉已应用上下文派生',
    '',
    '| 来源 | control/sub | 窗口 | 通用占轴 | 语义 | 规范输入 | 执行起点 | 前动作结束 | 贴边结果 |',
    '| --- | --- | --- | ---: | --- | ---: | ---: | ---: | --- |',
    ...xiaoyuApplied.map(
      row =>
        `| ${row.sourceSemanticName} | ${row.sourceControlSkillId}/sub${row.sourceSubSkillIndex} | [${row.inputWindow.startFrame},${row.inputWindow.endFrame})F | ${formatOptionalFrame(row.genericOccupancyFrames)} | ${row.inputSemantics} | ${formatOptionalFrame(row.canonicalInputFrame)} | ${formatOptionalFrame(row.executionStartFrame)} | ${formatOptionalFrame(row.contextualPredecessorEndFrame)} | ${row.edgeToEdgeAfter} |`
    ),
    '',
    '## 全量分类',
    '',
    ...Object.entries(report.summary.categoryCounts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `- ${key}: ${value}`),
    '',
  ].join('\n');
}

function formatOptionalFrame(value) {
  return value == null ? '-' : `${value}F`;
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
      scheduling: mapping.actionScheduling,
      variantModelStatus: mapping.variantModelStatus,
      variantConditionDiscovery: mapping.variantConditionDiscovery,
      sourceIdentity: mapping.bindingSourceIdentity,
    })
  );
  const attackInputSegments = packageValue.actionMappings.flatMap(mapping =>
    getAuditAttackInputSegments(mapping).map(segment =>
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
        scheduling: segment.actionScheduling,
        variantModelStatus: segment.actionScheduling?.variantModelStatus,
        variantConditionDiscovery: segment.variantConditionDiscovery,
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
  const schedulingRows = [...actionTimings, ...attackInputSegments];
  const schedulingKindCounts = countValues(
    schedulingRows.map(row => row.schedulingKind)
  );
  const variantConditionDiscoveries =
    packageValue.actionVariantGraph?.conditionDiscoveries ?? [];
  const variantConditionFocus = variantConditionDiscoveries.filter(
    discovery => {
      const mappings = packageValue.actionMappings.filter(
        mapping =>
          mapping.actionKind !== 'normal-attack' &&
          Number(mapping.ownerId) === Number(discovery.ownerId) &&
          Number(mapping.controlSkillId) === Number(discovery.controlSkillId) &&
          mapping.controlVariantResolution?.kind ===
            'verified-client-default-subskill-index'
      );
      return mappings.some(mapping => {
        const durations = [
          ...new Set(
            (mapping.variantConditionDiscovery?.variantDurations ?? [])
              .flatMap(variant => variant.frameCounts ?? [])
              .map(frame => positiveIntegerOrNull(frame.frameCount))
              .filter(Boolean)
          ),
        ];
        return durations.length > 1;
      });
    }
  );
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
      schedulingKindCounts,
      exactSelectedVariantOccupancyCount:
        schedulingKindCounts['exact-selected-variant-occupancy'] ?? 0,
      sourceAnimationPlanningDurationCount:
        schedulingKindCounts['source-animation-planning-duration'] ?? 0,
      genericPlanningDurationCount:
        schedulingKindCounts['generic-planning-duration'] ?? 0,
      unresolvedControlIdentityCount: schedulingRows.filter(
        row => row.variantModelStatus === 'unresolved-control-identity'
      ).length,
      variantModelStatusCounts: countValues(
        schedulingRows.map(row => row.variantModelStatus)
      ),
      variantConditionDiscoveryStatusCounts: countValues(
        variantConditionDiscoveries.map(discovery => discovery.status)
      ),
      variantConditionFocusCount: variantConditionFocus.length,
    },
    byOwnerActionKindSourceStatus,
    actions: actionTimings,
    attackInputSegments,
    publicVariants,
    controlVariants,
    variantConditionDiscoveries,
    variantConditionFocus,
    unresolved: unresolvedRows,
    oneFrame: oneFrameRows,
    abnormalLong: abnormalLongRows,
  };
}

function createActionTimingCoverageRow({
  timing,
  scheduling,
  variantModelStatus,
  ...identity
}) {
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
    schedulingStatus: scheduling?.status ?? 'planning',
    schedulingKind: scheduling?.kind ?? 'generic-planning-duration',
    planningDurationFrames: scheduling?.planningDurationFrames ?? null,
    schedulingDurationFrames: scheduling?.durationFrames ?? null,
    schedulingSourceIdentity: scheduling?.sourceIdentity ?? null,
    schedulingSourceStatus: scheduling?.sourceStatus ?? null,
    variantModelStatus:
      scheduling?.variantModelStatus ??
      variantModelStatus ??
      'unresolved-control-identity',
    variantConditionDiscovery: identity.variantConditionDiscovery ?? null,
  };
}

function createActionTimingCoverageMarkdown(report) {
  const lines = [
    '# M9-A 全动作时长与输入占轴审计',
    '',
    `- 包：\`${report.packageId}\``,
    `- 公开动作：${report.sourceDenominator.publicActionCount}（来源占轴已确认 ${report.summary.appliedActionCount}，尚未确认 ${report.summary.unresolvedActionCount}；公开动作均按独立 schedulable 合同判断）`,
    `- 公开变体：${report.sourceDenominator.publicVariantCount}（来源占轴已确认 ${report.summary.appliedPublicVariantCount}，尚未确认 ${report.summary.unresolvedPublicVariantCount}）`,
    `- 普攻输入段：${report.sourceDenominator.normalAttackInputSegmentCount}（输入占轴已确认 ${report.summary.appliedAttackInputSegmentCount}，尚未确认 ${report.summary.unresolvedAttackInputSegmentCount}）`,
    `- SkillControl/player 变体：${report.sourceDenominator.controlPlayerVariantCount}`,
    `- 一帧占轴：${report.summary.oneFrameCount}`,
    `- 异常长占轴（>600f）：${report.summary.abnormalLongCount}`,
    `- 精确选中变体占轴：${report.summary.exactSelectedVariantOccupancyCount}`,
    `- 来源动画规划长度：${report.summary.sourceAnimationPlanningDurationCount}`,
    `- 通用规划长度：${report.summary.genericPlanningDurationCount}`,
    `- control 身份未解析：${report.summary.unresolvedControlIdentityCount}`,
    `- 变体条件发现：${Object.entries(
      report.summary.variantConditionDiscoveryStatusCounts
    )
      .map(([status, count]) => `${status} ${count}`)
      .join(' / ')}`,
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
    '## 多变体条件发现',
    '',
    '| Owner | 动作类型 | Control | 状态 | 已审计来源 |',
    '| --- | --- | ---: | --- | --- |',
    ...report.variantConditionFocus.map(discovery => {
      const action = report.actions.find(
        row =>
          Number(row.ownerId) === Number(discovery.ownerId) &&
          Number(row.controlSkillId) === Number(discovery.controlSkillId)
      );
      return `| ${action?.ownerName ?? discovery.ownerId} | ${discovery.actionKinds.join(' / ')} | ${discovery.controlSkillId} | ${discovery.status} | ${discovery.sourceFamilies.map(source => source.kind).join(' / ')} |`;
    }),
    '',
    '> `variant-condition-not-yet-modeled` 表示条件来源已进入发现审计、但尚未形成可执行选择边；它不是“证据证明无法解析”。只有完成来源链审计后，才会区分 `static-evidence-gap` 或 `runtime-dependent`。',
    '',
    '## 尚未确认的输入占轴',
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
    .filter(
      mapping =>
        !['applied', 'verified-zero'].includes(mapping.sourceEvidenceStatus) &&
        !(
          mapping.scenarioRuntimeStatus ===
            'scenario-assumed-zero-distance' &&
          (mapping.reasons ?? []).length === 0
        )
    )
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
      sourceEvidenceStatus: mapping.sourceEvidenceStatus,
      scenarioRuntimeStatus: mapping.scenarioRuntimeStatus,
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
        scenarioClassification: element.scenarioClassification,
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
        classification: element.classification,
        scenarioClassification: element.scenarioClassification,
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
    const scenarioAppliedReferences = selectedReferences.filter(
      reference =>
        reference.classification === 'applied' ||
        reference.scenarioClassification === 'applied'
    );
    return {
      ...element,
      classification: appliedReferences.length ? 'applied' : 'unresolved',
      scenarioClassification: scenarioAppliedReferences.length
        ? 'applied'
        : 'unresolved',
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
    .map(mapping => {
      const segments = getAuditAttackInputSegments(mapping);
      return {
        actionIdentity: mapping.identity,
        ownerId: mapping.ownerId,
        ownerName: mapping.ownerName,
        sourceSkillId: mapping.sourceSkillId,
        sequenceTotal: segments.length,
        appliedSegmentCount: segments.filter(
          segment => segment.classification === 'applied'
        ).length,
        unresolvedSegmentCount: segments.filter(
          segment => segment.classification === 'unresolved'
        ).length,
        segments,
      };
    });
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
      scenarioResolvedNonzeroRecoveryElementCount:
        nonzeroRecoveryCoverage.filter(
          element => element.scenarioClassification === 'applied'
        ).length,
      scenarioResolvedProjectileHitCount: packageValue.controlBindings.reduce(
        (sum, control) =>
          sum +
          control.hits.filter(
            hit =>
              hit.scenarioRuntimeStatus === 'scenario-assumed-zero-distance'
          ).length,
        0
      ),
      disabledScenarioHitCount: 0,
      unresolvedProjectileLaunchCount: unresolvedReferences.filter(
        reference =>
          reference.referenceKind === 'bulletElements' &&
          reference.scenarioClassification !== 'applied' &&
          reference.reasons.includes(
            'projectile-impact-frame-runtime-dependent'
          )
      ).length,
      unresolvedProjectileFormulaCount: unresolvedReferences.filter(
        reference =>
          reference.referenceKind === 'bulletElements' &&
          reference.reasons.some(reason =>
            reason.includes('function-unverified')
          )
      ).length,
      unresolvedProjectileTargetCount: unresolvedReferences.filter(
        reference =>
          reference.referenceKind === 'bulletElements' &&
          reference.reasons.some(reason => reason.includes('target'))
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
    sourceAppliedActionCount: mappings.filter(
      mapping => mapping.sourceEvidenceStatus === 'applied'
    ).length,
    sourceRuntimeDependentActionCount: mappings.filter(
      mapping => mapping.sourceEvidenceStatus === 'runtime-dependent'
    ).length,
    sourceStaticEvidenceGapActionCount: mappings.filter(
      mapping => mapping.sourceEvidenceStatus === 'static-evidence-gap'
    ).length,
    scenarioResolvedActionCount: mappings.filter(
      mapping =>
        mapping.scenarioRuntimeStatus === 'scenario-assumed-zero-distance'
    ).length,
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
    `- 场景可运行：${report.summary.runnableActionCount}`,
    `- 来源静态可应用：${report.summary.sourceAppliedActionCount}`,
    `- 来源运行时依赖：${report.summary.sourceRuntimeDependentActionCount}`,
    `- 零距离场景补全：${report.summary.scenarioResolvedActionCount}`,
    `- 来源静态证据缺口：${report.summary.sourceStaticEvidenceGapActionCount}`,
    `- 明确零：${report.summary.verifiedZeroActionCount}`,
    `- 未解析：${report.summary.unresolvedActionCount}`,
    `- 真实命中节点：${report.summary.hitNodeCount}`,
    `- 公开动作变体：${report.summary.publicVariantCount}（未解析 ${report.summary.unresolvedPublicVariantCount}）`,
    `- 非零回能元素：${report.summary.nonzeroRecoveryElementCount}（未关联 ${report.summary.unresolvedNonzeroRecoveryElementCount}）`,
    `- 零距离投射物命中：${report.summary.scenarioResolvedProjectileHitCount}（仍缺发射帧 ${report.summary.unresolvedProjectileLaunchCount}、仍缺公式 ${report.summary.unresolvedProjectileFormulaCount}、仍缺目标 ${report.summary.unresolvedProjectileTargetCount}）`,
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

function createDerivedControlCoverageReport(packageValue) {
  const contracts =
    packageValue.actionVariantGraph?.derivedControlContracts ?? [];
  const contractIdentities = new Set(
    contracts.map(contract => contract.contractIdentity)
  );
  const multiVariantCandidates = (
    packageValue.actionVariantGraph?.conditionDiscoveries ?? []
  ).filter(discovery => discovery.ownerKind === 'actor');
  const omittedMultiVariantCandidates = multiVariantCandidates.filter(
    discovery =>
      !contractIdentities.has(
        `actor:${discovery.ownerId}|control:${discovery.controlSkillId}|derived-control`
      )
  );
  const publicActionIdentities = new Set(
    contracts.flatMap(contract =>
      (contract.publicActions ?? []).map(action =>
        [
          action.ownerId,
          action.sourceSkillId,
          action.actionKind,
          action.actionVariantIndex,
          action.attackSequenceIndex ?? '',
        ].join('|')
      )
    )
  );
  const byOwnerActionKind = [
    ...groupBy(contracts, contract => {
      const actionKinds = contract.actionKinds?.length
        ? contract.actionKinds
        : ['unclassified'];
      return `${contract.ownerId}|${actionKinds.join('+')}`;
    }).entries(),
  ]
    .map(([key, rows]) => {
      const [ownerId, actionKinds] = key.split('|');
      return {
        ownerId: Number(ownerId),
        actionKinds: actionKinds.split('+'),
        controlCount: rows.length,
        controlSourceCounts: countValues(rows.map(row => row.controlSource)),
        resolutionStatusCounts: countValues(
          rows.map(row => row.resolutionStatus)
        ),
      };
    })
    .sort(
      (left, right) =>
        left.ownerId - right.ownerId ||
        left.actionKinds.join('+').localeCompare(right.actionKinds.join('+'))
    );
  return {
    schemaVersion: 1,
    kind: 'azpr-verified-derived-control-coverage',
    status: 'verified-derived-control-coverage-ready',
    packageId: packageValue.packageId,
    packageHash: packageValue.packageHash,
    sourceDenominator: {
      kind: 'current-client-public-actor-derived-control-candidates',
      actorOwnerCount: new Set(contracts.map(contract => contract.ownerId))
        .size,
      publicActionCount: publicActionIdentities.size,
      controlCount: contracts.length,
      multiVariantControlCount: multiVariantCandidates.length,
      controlPlayerVariantCount: contracts.reduce(
        (sum, contract) => sum + (contract.variants?.length ?? 0),
        0
      ),
    },
    summary: {
      controlSourceCounts: countValues(
        contracts.map(contract => contract.controlSource)
      ),
      candidateControlSourceCounts: countValues(
        contracts.flatMap(contract => contract.candidateControlSources ?? [])
      ),
      resolutionStatusCounts: countValues(
        contracts.map(contract => contract.resolutionStatus)
      ),
      inputSelectorCount: contracts.filter(contract => contract.inputSelector)
        .length,
      appliedInputSelectorCount: contracts.filter(
        contract => contract.inputSelector?.resolutionStatus === 'applied'
      ).length,
      resourceControlledCount: contracts.filter(contract =>
        contract.candidateControlSources?.includes('resource-controlled')
      ).length,
      stateControlledCount: contracts.filter(contract =>
        contract.candidateControlSources?.includes('state-controlled')
      ).length,
      automaticFollowUpCount: contracts.filter(contract =>
        contract.candidateControlSources?.includes('automatic-follow-up')
      ).length,
      silentOmissionCount: omittedMultiVariantCandidates.length,
    },
    byOwnerActionKind,
    controls: contracts,
    omittedMultiVariantCandidates,
    unresolved: contracts.filter(
      contract => contract.resolutionStatus !== 'applied'
    ),
  };
}

function createDerivedControlCoverageMarkdown(report) {
  const lines = [
    '# M9-R2 全角色派生控制覆盖',
    '',
    `- 包：\`${report.packageId}\``,
    `- 固定分母：${report.sourceDenominator.actorOwnerCount} 名角色 / ${report.sourceDenominator.publicActionCount} 个公开动作引用 / ${report.sourceDenominator.controlCount} 个派生 control / ${report.sourceDenominator.controlPlayerVariantCount} 个 player/resourceMap 变体`,
    `- 控制源：${Object.entries(report.summary.controlSourceCounts)
      .map(([key, value]) => `${key}=${value}`)
      .join('，')}`,
    `- 解析状态：${Object.entries(report.summary.resolutionStatusCounts)
      .map(([key, value]) => `${key}=${value}`)
      .join('，')}`,
    `- 输入选择器：${report.summary.appliedInputSelectorCount}/${report.summary.inputSelectorCount} 已建立明确 public variant → subskill 关系`,
    `- 静默遗漏：${report.summary.silentOmissionCount}`,
    '',
    '## Owner / 动作类型',
    '',
    '| Owner | 动作类型 | control | 控制源 | 解析状态 |',
    '| ---: | --- | ---: | --- | --- |',
    ...report.byOwnerActionKind.map(
      row =>
        `| ${row.ownerId} | ${row.actionKinds.join(' / ')} | ${row.controlCount} | ${Object.entries(
          row.controlSourceCounts
        )
          .map(([key, value]) => `${key}=${value}`)
          .join('<br>')} | ${Object.entries(row.resolutionStatusCounts)
          .map(([key, value]) => `${key}=${value}`)
          .join('<br>')} |`
    ),
    '',
    '## 待收口合同',
    '',
  ];
  if (report.unresolved.length === 0) {
    lines.push('- 无。');
  } else {
    for (const contract of report.unresolved) {
      lines.push(
        `- \`${contract.contractIdentity}\` ${contract.actionKinds.join(' / ')}：${contract.resolutionStatus}；${contract.reasons.join(', ') || '来源已分类，运行时尚未接入'}`
      );
    }
  }
  lines.push(
    '',
    '> `not-yet-modeled` 表示实现覆盖尚未完成；`static-evidence-gap` 与 `runtime-dependent` 才表示证据或运行时输入边界。完整条件、变体时长和 source identity 见同名 JSON。'
  );
  return `${lines.join('\n')}\n`;
}

function createSwitchTriggerCoverageReport(packageValue) {
  const catalog = packageValue.switchTriggerCatalog;
  return {
    schemaVersion: 1,
    kind: 'azpr-verified-switch-trigger-coverage',
    status: 'verified-switch-trigger-coverage-ready',
    packageId: packageValue.packageId,
    packageHash: packageValue.packageHash,
    sourceDenominator: {
      kind: 'current-client-public-actor-switch-skill-slots',
      actorOwnerCount: catalog.summary.profileCount,
      switchSkillSlotCount: catalog.summary.profileCount,
      onEnterSlotCount: catalog.summary.onEnterProfileCount,
      onExitSlotCount: catalog.summary.onExitProfileCount,
    },
    summary: { ...catalog.summary },
    profiles: catalog.profiles,
    unresolvedProfiles: catalog.profiles.filter(profile => !profile.applied),
  };
}

function createSwitchTriggerCoverageMarkdown(report) {
  const lines = [
    '# M9-R2 星携技切人触发覆盖',
    '',
    `- 包：\`${report.packageId}\``,
    `- 固定分母：${report.sourceDenominator.actorOwnerCount} 名公开角色 / ${report.sourceDenominator.onEnterSlotCount} 个入场槽 / ${report.sourceDenominator.onExitSlotCount} 个退场槽`,
    `- 可确定派生：${report.summary.appliedProfileCount}/${report.summary.profileCount}`,
    `- 静态证据缺口：${report.summary.unresolvedProfileCount}`,
    '',
    '| 角色 | 阶段 | 技能槽 | 技能 | 触发绑定 | 机制状态 |',
    '| --- | --- | ---: | ---: | --- | --- |',
    ...report.profiles.map(
      profile =>
        `| ${profile.ownerName ?? profile.ownerId} (${profile.ownerId}) | ${profile.triggerLabel ?? '待确认'} | ${profile.skillSlot ?? '-'} | ${profile.sourceSkillId ?? '-'} | ${profile.resolutionStatus} | ${profile.mechanicsClassification} |`
    ),
    '',
    '## 静态证据缺口',
    '',
  ];
  if (report.unresolvedProfiles.length === 0) {
    lines.push('- 无。');
  } else {
    for (const profile of report.unresolvedProfiles) {
      lines.push(
        `- \`${profile.profileIdentity}\`：${profile.reasons.join(', ')}`
      );
    }
  }
  lines.push(
    '',
    '> 入场/退场阶段来自 `hero.skillList` 的 201/203 槽位与客户端 `ESkillSlotType` 枚举；动作机制自身的 applied/unresolved 状态单独保留，不因切人触发关系成立而升级。'
  );
  return `${lines.join('\n')}\n`;
}

function createEffectCoverageReport(packageValue, semanticEffectCatalog) {
  const effectByIdentity = new Map(
    packageValue.controlBindings.flatMap(binding =>
      binding.effects.map(effect => [effect.effectIdentity, effect])
    )
  );
  const actions = packageValue.actionMappings.map(mapping => {
    const selectedIdentities = new Set([
      ...(mapping.selectedEffectIdentities ?? []),
      ...getAuditAttackInputSegments(mapping).flatMap(
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
  const semanticEffects = semanticEffectCatalog?.semanticEffects ?? [];
  const semanticGameplayEffects = semanticEffects.filter(
    effect => effect.role === 'gameplay-effect'
  );
  const semanticUnresolved = semanticGameplayEffects.filter(
    effect => effect.classification === 'unresolved'
  );
  for (const action of actions) {
    const actionSemanticEffects = semanticGameplayEffects.filter(effect =>
      effect.publicActions.some(
        reference => reference.actionIdentity === action.actionIdentity
      )
    );
    action.semanticEffectCount = actionSemanticEffects.length;
    action.semanticAppliedEffectCount = actionSemanticEffects.filter(
      effect => effect.classification === 'applied'
    ).length;
    action.semanticVerifiedZeroEffectCount = actionSemanticEffects.filter(
      effect => effect.classification === 'verified-zero'
    ).length;
    action.semanticUnresolvedEffectCount = actionSemanticEffects.filter(
      effect => effect.classification === 'unresolved'
    ).length;
    action.semanticEffectIdentities = actionSemanticEffects.map(
      effect => effect.semanticIdentity
    );
  }
  return {
    schemaVersion: 2,
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
      rawReferenceEdgeCount: packageValue.controlBindings.reduce(
        (sum, binding) =>
          sum +
          binding.effectGraph.reduce(
            (edgeSum, root) => edgeSum + (root.edges?.length ?? 0),
            0
          ),
        0
      ),
      graphNodeCount: graphNodes.length,
      semanticEffectCount: semanticEffects.length,
      semanticGameplayEffectCount: semanticGameplayEffects.length,
    },
    summary: {
      semanticEffectCount: semanticEffects.length,
      semanticGameplayEffectCount: semanticGameplayEffects.length,
      semanticStructuralCount:
        semanticEffects.length - semanticGameplayEffects.length,
      semanticAppliedCount: semanticGameplayEffects.filter(
        effect => effect.classification === 'applied'
      ).length,
      semanticVerifiedZeroCount: semanticGameplayEffects.filter(
        effect => effect.classification === 'verified-zero'
      ).length,
      semanticUnresolvedCount: semanticUnresolved.length,
      semanticPlacementCounts: countValues(
        semanticGameplayEffects.map(effect => effect.placementResolution)
      ),
      semanticKindCounts: countValues(
        semanticGameplayEffects.map(effect => effect.kind)
      ),
      semanticFormulaFamilyCounts: countValues(
        semanticGameplayEffects.map(effect => effect.formulaRuntime?.family)
      ),
      semanticUnresolvedReasonCounts: countValues(
        semanticUnresolved.flatMap(effect => effect.reasons)
      ),
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
    semanticEffects,
    actions,
    unresolved,
  };
}

function createEffectCoverageMarkdown(report) {
  const lines = [
    '# M9-C Battle 语义效果覆盖',
    '',
    `- 包：\`${report.packageId}\``,
    `- 公开动作：${report.sourceDenominator.actionCount}`,
    `- 控制：${report.sourceDenominator.controlCount}`,
    `- 直接元素根：${report.sourceDenominator.directRootCount}`,
    `- 原始引用边：${report.sourceDenominator.rawReferenceEdgeCount}`,
    `- 效果图节点：${report.sourceDenominator.graphNodeCount}`,
    `- 去重语义效果：${report.summary.semanticEffectCount}`,
    `- 最终玩法效果：${report.summary.semanticGameplayEffectCount}`,
    `- 结构包装/条件：${report.summary.semanticStructuralCount}`,
    `- 语义可计算：${report.summary.semanticAppliedCount}`,
    `- 语义明确零：${report.summary.semanticVerifiedZeroCount}`,
    `- 语义未解析：${report.summary.semanticUnresolvedCount}`,
    '',
    '## 语义放置',
    '',
    ...Object.entries(report.summary.semanticPlacementCounts).map(
      ([status, count]) => `- ${status}: ${count}`
    ),
    '',
    '## 公式族',
    '',
    ...Object.entries(report.summary.semanticFormulaFamilyCounts).map(
      ([family, count]) => `- ${family}: ${count}`
    ),
    '',
    '## 原始边审计',
    '',
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
    ...Object.entries(report.summary.semanticUnresolvedReasonCounts).map(
      ([reason, count]) => `- ${reason}: ${count}`
    ),
    '',
    '> 只有真实触发帧、唯一目标且公式输入可安全解释的维度进入运行时；其余逐项来源见同名 JSON。',
  ];
  return `${lines.join('\n')}\n`;
}

function createPublicRuntimeCoverageReport({
  packageValue,
  actionCoverage,
  timingCoverage,
  effectCoverage,
  actionVariantResourceCoverage,
  characterCombatArtifacts,
}) {
  const timingByAction = new Map(
    timingCoverage.actions.map(action => [action.identity, action])
  );
  const effectByAction = new Map(
    effectCoverage.actions.map(action => [action.actionIdentity, action])
  );
  const variantEdgesByOwnerControl = groupBy(
    packageValue.actionVariantGraph?.edges ?? [],
    edge => `${edge.ownerId}|${edge.sourceControlSkillId}`
  );
  const resourceProfileByOwner = new Map(
    (packageValue.specialResourceCatalog?.profiles ?? []).map(profile => [
      Number(profile.ownerId),
      profile,
    ])
  );
  const characterRuntimeCoverageByAction = new Map(
    (characterCombatArtifacts?.ownerArtifacts ?? []).flatMap(artifact =>
      (artifact.runtimeCoverage?.actionRows ?? []).map(row => [
        row.actionIdentity,
        row,
      ])
    )
  );
  const actions = packageValue.actionMappings.map(mapping => {
    const timing = timingByAction.get(mapping.identity) ?? null;
    const effect = effectByAction.get(mapping.identity) ?? null;
    const variantEdges =
      variantEdgesByOwnerControl.get(
        `${mapping.ownerId}|${mapping.controlSkillId}`
      ) ?? [];
    const characterRuntimeCoverage = characterRuntimeCoverageByAction.get(
      mapping.identity
    );
    const normalizedReasons = dedupeBy(
      [
        ...(mapping.reasons ?? []),
        ...(characterRuntimeCoverage?.reasons ?? []),
      ].map(normalizeProductGapReason),
      value => value
    );
    const gapResolution = classifyProductActionGap(normalizedReasons);
    const runtimeReady =
      characterRuntimeCoverage?.runtimeReady ?? mapping.runtimeReady;
    const runtimeStatus = runtimeReady
      ? 'runnable'
      : mapping.classification === 'verified-zero'
        ? 'verified-zero'
        : characterRuntimeCoverage?.settlementStatus ===
            'runtime-evidence-required'
          ? 'runtime-evidence-required'
          : characterRuntimeCoverage?.settlementStatus === 'static-evidence-gap'
            ? 'static-evidence-gap'
            : gapResolution.status;
    const resourceProfile = resourceProfileByOwner.get(Number(mapping.ownerId));
    const settlementDimensions =
      characterRuntimeCoverage?.requiresDamageSettlement === true
        ? mergePublicFormSettlementDimensions(
            characterRuntimeCoverage.publicFormSettlements
          )
        : null;
    return {
      identity: mapping.identity,
      ownerKind: mapping.ownerKind,
      ownerId: mapping.ownerId,
      ownerName: mapping.ownerName,
      actionKind: mapping.actionKind,
      sourceSkillId: mapping.sourceSkillId,
      sourceSkillName: mapping.sourceSkillName,
      controlSkillId: mapping.controlSkillId,
      selectedSubSkillIndex: mapping.selectedSubSkillIndex,
      runtimeStatus,
      runnable: Boolean(runtimeReady),
      rawRuntimeReady:
        characterRuntimeCoverage?.rawRuntimeReady ??
        Boolean(mapping.runtimeReady),
      schedulable: mapping.schedulable !== false,
      sourceEvidenceStatus:
        mapping.sourceEvidenceStatus ?? 'static-evidence-gap',
      scenarioRuntimeStatus:
        characterRuntimeCoverage?.scenarioRuntimeStatus ??
        mapping.scenarioRuntimeStatus ??
        'scenario-runtime-unresolved',
      mechanicsClassification: mapping.mechanicsClassification,
      timing: {
        status: timing?.status ?? mapping.timingStatus ?? 'unresolved',
        durationFrames: timing?.durationFrames ?? null,
        sourceKind: timing?.sourceKind ?? null,
        schedulingKind: mapping.actionScheduling?.kind ?? null,
        planningDurationFrames:
          mapping.actionScheduling?.planningDurationFrames ?? null,
        variantModelStatus:
          mapping.actionScheduling?.variantModelStatus ??
          mapping.variantModelStatus,
      },
      variants: summarizeProductVariantEdges(variantEdges),
      specialResource: resourceProfile
        ? {
            status: resourceProfile.applied ? 'applied' : 'static-evidence-gap',
            resourceIdentity: resourceProfile.resourceIdentity,
            capacity: resourceProfile.capacity,
          }
        : { status: 'not-applicable' },
      dimensions: {
        enemyHp: settlementDimensions?.hp ?? mapping.dimensionSummary?.hp ?? {},
        enemyToughness:
          settlementDimensions?.toughness ??
          mapping.dimensionSummary?.toughness ??
          {},
        actorSp:
          settlementDimensions?.actorSp ??
          mapping.dimensionSummary?.actorSp ??
          {},
        kiboSp:
          settlementDimensions?.kiboSp ??
          mapping.dimensionSummary?.kiboSp ??
          {},
        healing: effect?.dimensions?.hp ?? {},
        shield: effect?.dimensions?.shield ?? {},
        dynamicProperty: effect?.dimensions?.dynamicProperty ?? {},
        tuningMark: effect?.dimensions?.mark ?? {},
      },
      semanticEffects: {
        total: effect?.semanticEffectCount ?? 0,
        applied: effect?.semanticAppliedEffectCount ?? 0,
        verifiedZero: effect?.semanticVerifiedZeroEffectCount ?? 0,
        unresolved: effect?.semanticUnresolvedEffectCount ?? 0,
      },
      settlement: characterRuntimeCoverage
        ? {
            required:
              characterRuntimeCoverage.requiresDamageSettlement === true,
            status: characterRuntimeCoverage.settlementStatus ?? 'not-required',
            hitCount: Number(characterRuntimeCoverage.hitCount ?? 0),
            publicForms: characterRuntimeCoverage.publicFormSettlements ?? [],
          }
        : null,
      reasons: normalizedReasons,
      sourceIdentity: mapping.bindingSourceIdentity ?? null,
    };
  });
  const actorOwnerCount = new Set(
    actions
      .filter(action => action.ownerKind === 'actor')
      .map(action => action.ownerId)
  ).size;
  const kiboOwnerCount = new Set(
    actions
      .filter(action => action.ownerKind === 'kibo')
      .map(action => action.ownerId)
  ).size;
  const unresolvedActions = actions.filter(
    action => !['runnable', 'verified-zero'].includes(action.runtimeStatus)
  );
  const unclassifiedUnresolvedActions = unresolvedActions.filter(
    action => action.runtimeStatus === 'unclassified-gap'
  );
  const requiredActorKinds = new Set([
    'normal-attack',
    'star-skill',
    'ultimate',
  ]);
  const actorCoreActions = actions.filter(
    action =>
      action.ownerKind === 'actor' && requiredActorKinds.has(action.actionKind)
  );
  const requiredKiboKinds = new Set(['active', 'break', 'signature']);
  const kiboCoreActions = actions.filter(
    action =>
      action.ownerKind === 'kibo' && requiredKiboKinds.has(action.actionKind)
  );
  const recoveryCoverage = actionCoverage.nonzeroRecoveryCoverage.map(item => {
    const reason = item.reasons?.[0] ?? null;
    const productScope =
      item.classification === 'applied'
        ? 'applied-current-public-action'
        : reason === 'linked-only-to-unresolved-public-action'
          ? 'current-public-action-unresolved'
          : reason === 'referenced-only-by-unselected-control-variant'
            ? 'public-unselected-control-variant'
            : reason === 'not-referenced-by-public-action-control'
              ? 'outside-current-public-action-catalog'
              : 'unclassified';
    return {
      pathId: item.pathId,
      elementId: item.elementId,
      recoverSp: item.recoverSp,
      petRecoverSp: item.petRecoverSp,
      recoverIntervalMs: item.recoverIntervalMs,
      productScope,
      actionReferences: item.actionReferences,
      sourceIdentity: item.sourceIdentity,
    };
  });
  const recoveryScopeCounts = countValues(
    recoveryCoverage.map(item => item.productScope)
  );
  const byOwnerActionKind = [
    ...groupBy(
      actions,
      action => `${action.ownerKind}|${action.actionKind}`
    ).entries(),
  ]
    .map(([key, groupedActions]) => {
      const [ownerKind, actionKind] = key.split('|');
      return {
        ownerKind,
        actionKind,
        actionCount: groupedActions.length,
        runtimeStatusCounts: countValues(
          groupedActions.map(action => action.runtimeStatus)
        ),
        timingStatusCounts: countValues(
          groupedActions.map(action => action.timing.status)
        ),
      };
    })
    .sort(
      (left, right) =>
        left.ownerKind.localeCompare(right.ownerKind) ||
        left.actionKind.localeCompare(right.actionKind)
    );
  const gateChecks = {
    publicActionDenominator:
      actions.length === M9_PRODUCT_DENOMINATOR.publicActionCount,
    actorOwnerDenominator:
      actorOwnerCount === M9_PRODUCT_DENOMINATOR.actorOwnerCount,
    kiboOwnerDenominator:
      kiboOwnerCount === M9_PRODUCT_DENOMINATOR.kiboOwnerCount,
    everyPublicActionClassified:
      actions.length === actionCoverage.summary.classifiedActionCount,
    requiredActorCoreActionsPresent:
      actorCoreActions.length ===
        M9_PRODUCT_DENOMINATOR.actorOwnerCount * requiredActorKinds.size &&
      actionCoverage.missingRequiredActorActions.length === 0,
    requiredKiboActionsPresent:
      kiboCoreActions.length ===
      M9_PRODUCT_DENOMINATOR.kiboOwnerCount * requiredKiboKinds.size,
    everyUnresolvedActionExplained: unclassifiedUnresolvedActions.length === 0,
    everyNonzeroRecoveryElementScoped:
      recoveryCoverage.length ===
        Object.values(recoveryScopeCounts).reduce(
          (sum, count) => sum + count,
          0
        ) && !recoveryScopeCounts.unclassified,
  };
  const gatePassed = Object.values(gateChecks).every(Boolean);
  if (!gatePassed) {
    const unclassifiedSummary = unclassifiedUnresolvedActions
      .slice(0, 8)
      .map(action => `${action.identity}:${action.reasons.join('|')}`)
      .join('; ');
    throw new Error(
      `M9 public runtime coverage gate failed: ${Object.entries(gateChecks)
        .filter(([, passed]) => !passed)
        .map(([name]) => name)
        .join(', ')}${unclassifiedSummary ? ` [${unclassifiedSummary}]` : ''}`
    );
  }
  return {
    schemaVersion: 1,
    kind: 'azpr-verified-public-runtime-coverage',
    status: 'verified-public-runtime-coverage-ready',
    packageId: packageValue.packageId,
    packageHash: packageValue.packageHash,
    fixedProductDenominator: M9_PRODUCT_DENOMINATOR,
    complete: gatePassed,
    gate: { passed: gatePassed, checks: gateChecks },
    summary: {
      publicActionCount: actions.length,
      actorOwnerCount,
      kiboOwnerCount,
      runnableActionCount: actions.filter(action => action.runnable).length,
      sourceAppliedActionCount: actions.filter(
        action => action.sourceEvidenceStatus === 'applied'
      ).length,
      sourceRuntimeDependentActionCount: actions.filter(
        action => action.sourceEvidenceStatus === 'runtime-dependent'
      ).length,
      sourceStaticEvidenceGapActionCount: actions.filter(
        action => action.sourceEvidenceStatus === 'static-evidence-gap'
      ).length,
      scenarioResolvedActionCount: actions.filter(
        action =>
          action.scenarioRuntimeStatus === 'scenario-assumed-zero-distance'
      ).length,
      verifiedZeroActionCount: actions.filter(
        action => action.runtimeStatus === 'verified-zero'
      ).length,
      unresolvedActionCount: unresolvedActions.length,
      unresolvedStatusCounts: countValues(
        unresolvedActions.map(action => action.runtimeStatus)
      ),
      unclassifiedUnresolvedActionCount: unclassifiedUnresolvedActions.length,
      actorCoreActionCount: actorCoreActions.length,
      actorCoreRunnableCount: actorCoreActions.filter(action => action.runnable)
        .length,
      kiboCoreActionCount: kiboCoreActions.length,
      kiboCoreRunnableCount: kiboCoreActions.filter(action => action.runnable)
        .length,
      nonzeroRecoveryElementCount: recoveryCoverage.length,
      recoveryScopeCounts,
      actionDimensions: actionCoverage.summary.dimensions,
      effectDimensions: effectCoverage.summary.dimensions,
      semanticEffects: {
        total: effectCoverage.summary.semanticEffectCount,
        gameplay: effectCoverage.summary.semanticGameplayEffectCount,
        applied: effectCoverage.summary.semanticAppliedCount,
        verifiedZero: effectCoverage.summary.semanticVerifiedZeroCount,
        unresolved: effectCoverage.summary.semanticUnresolvedCount,
      },
      timing: timingCoverage.summary,
      actionVariantsAndResources: actionVariantResourceCoverage.summary,
    },
    byOwnerActionKind,
    actorCoreActions,
    kiboCoreActions,
    actions,
    unresolvedActions,
    recoveryCoverage,
  };
}

function mergePublicFormSettlementDimensions(publicFormSettlements = []) {
  const dimensions = {};
  for (const dimension of ['hp', 'toughness', 'actorSp', 'kiboSp']) {
    dimensions[dimension] = {};
    for (const row of publicFormSettlements) {
      for (const [status, count] of Object.entries(
        row.dimensionSummary?.[dimension] ?? {}
      )) {
        dimensions[dimension][status] =
          Number(dimensions[dimension][status] ?? 0) + Number(count ?? 0);
      }
    }
  }
  return dimensions;
}

function summarizeProductVariantEdges(edges) {
  if (!edges.length) return { status: 'not-applicable', total: 0 };
  const applied = edges.filter(edge => edge.applied).length;
  return {
    status:
      applied === edges.length
        ? 'applied'
        : applied > 0
          ? 'partially-applied'
          : 'static-evidence-gap',
    total: edges.length,
    applied,
    unresolved: edges.length - applied,
  };
}

function normalizeProductGapReason(reason) {
  const replacements = {
    'pack-lifecycle-runtime-unimplemented':
      'pack-lifecycle-semantics-evidence-gap',
    'judgment-condition-runtime-unimplemented':
      'judgment-condition-semantics-evidence-gap',
    'nested-damage-trigger-lifecycle-not-expanded':
      'nested-damage-trigger-lifecycle-evidence-gap',
  };
  return replacements[reason] ?? String(reason ?? 'unclassified-gap');
}

function classifyProductActionGap(reasons) {
  if (!reasons.length) return { status: 'unclassified-gap' };
  const categories = new Set(reasons.map(classifyProductGapReason));
  if (categories.has('unclassified')) return { status: 'unclassified-gap' };
  if (categories.has('not-yet-modeled')) {
    return { status: 'variant-condition-not-yet-modeled' };
  }
  if (
    categories.has('runtime-dependent') &&
    categories.has('static-evidence-gap')
  ) {
    return { status: 'runtime-and-evidence-gap' };
  }
  return {
    status: categories.has('runtime-dependent')
      ? 'runtime-dependent'
      : 'static-evidence-gap',
  };
}

function classifyProductGapReason(reason) {
  if (/not-yet-modeled/.test(reason)) return 'not-yet-modeled';
  if (
    /(runtime-dependent|projectile-(impact|collision)|runtime-target|runtime-trigger|runtime-selection|random-target)/.test(
      reason
    )
  ) {
    return 'runtime-dependent';
  }
  if (
    /(missing|unresolved|incomplete|unverified|not-invariant|no-runnable|not-expanded|evidence-gap|ambiguous|mismatch|unsupported|without-root-selection|multiple-root|classified-through|not-literal|has-no-resource-map|has-no-three-value|control-identity)/.test(
      reason
    )
  ) {
    return 'static-evidence-gap';
  }
  return 'unclassified';
}

function createPublicRuntimeCoverageMarkdown(report) {
  const recovery = report.summary.recoveryScopeCounts;
  const lines = [
    '# M9-D 公开动作运行时覆盖',
    '',
    `- 包：\`${report.packageId}\``,
    `- 固定产品分母：${report.summary.publicActionCount} 个公开动作 / ${report.summary.actorOwnerCount} 名角色 / ${report.summary.kiboOwnerCount} 只奇波`,
    `- 场景可运行：${report.summary.runnableActionCount}`,
    `- 来源静态可应用：${report.summary.sourceAppliedActionCount}`,
    `- 来源运行时依赖：${report.summary.sourceRuntimeDependentActionCount}`,
    `- 零距离场景补全：${report.summary.scenarioResolvedActionCount}`,
    `- 来源静态证据缺口：${report.summary.sourceStaticEvidenceGapActionCount}`,
    `- 明确零：${report.summary.verifiedZeroActionCount}`,
    `- 未解析：${report.summary.unresolvedActionCount}（未分类 ${report.summary.unclassifiedUnresolvedActionCount}）`,
    `- 角色核心动作：${report.summary.actorCoreRunnableCount}/${report.summary.actorCoreActionCount} 可运行`,
    `- 奇波 active / break / signature：${report.summary.kiboCoreRunnableCount}/${report.summary.kiboCoreActionCount} 可运行`,
    '',
    '## 未解析边界',
    '',
    ...Object.entries(report.summary.unresolvedStatusCounts).map(
      ([status, count]) => `- ${status}: ${count}`
    ),
    '',
    '## 非零命中回能元素',
    '',
    `- 当前公开动作已应用：${recovery['applied-current-public-action'] ?? 0}`,
    `- 当前公开动作因动作证据缺口未应用：${recovery['current-public-action-unresolved'] ?? 0}`,
    `- 仅属于公开动作未选 control 变体：${recovery['public-unselected-control-variant'] ?? 0}`,
    `- 不属于当前公开动作目录：${recovery['outside-current-public-action-catalog'] ?? 0}`,
    '',
    '## Owner / 动作类型',
    '',
    '| Owner | 动作类型 | 分母 | 可运行 | 运行时依赖 | 证据缺口 | 混合缺口 |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: |',
    ...report.byOwnerActionKind.map(row => {
      const counts = row.runtimeStatusCounts;
      return `| ${row.ownerKind} | ${row.actionKind} | ${row.actionCount} | ${counts.runnable ?? 0} | ${counts['runtime-dependent'] ?? 0} | ${counts['static-evidence-gap'] ?? 0} | ${counts['runtime-and-evidence-gap'] ?? 0} |`;
    }),
    '',
    '## 发布守门',
    '',
    ...Object.entries(report.gate.checks).map(
      ([name, passed]) => `- ${passed ? '通过' : '失败'}：${name}`
    ),
    '',
    '> 目录外 DamageElement 与未选 control 变体不再计入当前公开动作产品缺口；逐动作、逐维和逐来源 identity 见同名 JSON。',
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

function getAuditAttackInputSegments(mapping) {
  return (
    mapping?.attackInputSourceSegments ?? mapping?.attackInputSegments ?? []
  );
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
  const body = injectStackOverLimitElementFactor(
    source
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
      .trimEnd()
  );
  return [
    '// Generated by scripts/sync-verified-combat-mechanics.mjs.',
    `// Source sha256: ${sha256(source)}`,
    '// Do not edit this file directly.',
    '',
    body,
    '',
  ].join('\n');
}

function injectStackOverLimitElementFactor(source) {
  const start = source.indexOf(
    'export function calculateStackOverLimitDamage(input = {})'
  );
  const end = source.indexOf('export function calculateRealDamage', start);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('unable to isolate StackOverLimit calculator runtime');
  }
  const segment = source.slice(start, end);
  const marker = '  const general = calculateGeneralFactor(input);';
  const markerIndex = segment.indexOf(marker);
  if (markerIndex < 0 || segment.indexOf(marker, markerIndex + 1) >= 0) {
    throw new Error('StackOverLimit general-factor insertion point drifted');
  }
  const insertion = [
    '  if (Number(input.attackerElementUp ?? 0) !== 0) {',
    '    const element = calculateElementFactor(input);',
    "    raw = applyFactor(raw, BigInt(element.raw), 'element', trace);",
    '  }',
    marker,
  ].join('\n');
  const transformed = segment.replace(marker, insertion);
  return `${source.slice(0, start)}${transformed}${source.slice(end)}`;
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
  const absolutePath = path.resolve(filePath);
  const repositoryRelativePath = path.relative(REPO_ROOT, absolutePath);
  if (
    repositoryRelativePath &&
    !repositoryRelativePath.startsWith(`..${path.sep}`) &&
    repositoryRelativePath !== '..' &&
    !path.isAbsolute(repositoryRelativePath)
  ) {
    return repositoryRelativePath.replaceAll('\\', '/');
  }
  return absolutePath.replaceAll('\\', '/');
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
