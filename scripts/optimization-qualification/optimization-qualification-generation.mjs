import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

import optimizationScenarioPolicy from '../../src/data/generated/optimization-scenario-policy.json' with { type: 'json' };

import { hashCanonicalValue } from '../../src/simulation/headless/canonicalSerialization.js';
import { deriveOptimizationQualificationStageGate } from '../../src/optimization-qualification/optimizationQualificationStageGate.js';
import {
  createDynamicLoadoutEffectCensus,
  createSoulEssenceEffectMechanicsCatalog,
} from './soulessence-effect-generation.mjs';
import {
  assertLandedHitRecoveryRuntimeEvidenceReference,
  LANDED_HIT_RECOVERY_EVIDENCE_RELATIVE_PATH,
  readLandedHitRecoveryRuntimeEvidenceSource,
} from './landed-hit-recovery-evidence.mjs';
import {
  assertGetElementTypeRuntimeEvidenceReference,
  GET_ELEMENT_TYPE_EVIDENCE_RELATIVE_PATH,
  readGetElementTypeRuntimeEvidenceSource,
} from './get-element-type-evidence.mjs';
import {
  assertPersistentLoadoutPropertyRuntimeEvidenceReference,
  PERSISTENT_LOADOUT_PROPERTY_EVIDENCE_RELATIVE_PATH,
  readPersistentLoadoutPropertyRuntimeEvidenceSource,
} from './persistent-loadout-property-evidence.mjs';
import {
  assertPeriodicPersistentPropertyRuntimeEvidenceReference,
  PERIODIC_PERSISTENT_PROPERTY_EVIDENCE_RELATIVE_PATH,
  readPeriodicPersistentPropertyRuntimeEvidenceSource,
} from './periodic-persistent-property-evidence.mjs';
import {
  assertFourPieceSetStackRuntimeEvidenceReference,
  FOUR_PIECE_SET_STACK_EVIDENCE_RELATIVE_PATH,
  readFourPieceSetStackRuntimeEvidenceSource,
} from './four-piece-set-stack-evidence.mjs';
import {
  assertBeforeSkillCompositeRuntimeEvidenceReference,
  BEFORE_SKILL_COMPOSITE_EVIDENCE_RELATIVE_PATH,
  readBeforeSkillCompositeRuntimeEvidenceSource,
} from './before-skill-composite-evidence.mjs';
import {
  AFTER_DAMAGE_TARGET_PROPERTY_EVIDENCE_RELATIVE_PATH,
  assertAfterDamageTargetPropertyRuntimeEvidenceReference,
  readAfterDamageTargetPropertyRuntimeEvidenceSource,
} from './after-damage-target-property-evidence.mjs';
import {
  AFTER_DAMAGE_EMPTY_CONDITION_EVIDENCE_RELATIVE_PATH,
  assertAfterDamageEmptyConditionRuntimeEvidenceReference,
  readAfterDamageEmptyConditionRuntimeEvidenceSource,
} from './soulessence-after-damage-empty-condition-evidence.mjs';
import {
  ACTIVATION_CONDITION_EVIDENCE_RELATIVE_PATH,
  assertActivationConditionRuntimeEvidenceReference,
  readActivationConditionRuntimeEvidenceSource,
} from './soulessence-activation-condition-evidence.mjs';
import {
  assertSetThreeSourceIdentityEvidenceReference,
  readSetThreeSourceIdentityEvidenceSource,
  SET_THREE_SOURCE_IDENTITY_EVIDENCE_RELATIVE_PATH,
} from './set-three-source-identity-evidence.mjs';

export const OPTIMIZATION_QUALIFICATION_GENERATED_AT =
  '2026-08-07T00:00:00.000Z';

export const FROZEN_B3_SOURCE_HASHES = Object.freeze({
  characters:
    'eddd0616c72711bf45c56020768e52f656d41ed596bcc6a7c1528aae5b0c61a0',
  kibos: '62924087a58001de0216110a07c4a7e13954f0c0d90ad13a1861b4a4701522f0',
  equipment: '1a0b4c8879f9560aacadf0647a615cd04c3a6f6505d8e25334c7c506ad6647c9',
  soulessences:
    'cd455e6cab217c5898e35e290b7d7e9d65b42a20bd0f71250a90377dfb93badd',
  verifiedMechanics:
    'd8006922503a02fa9921856a9fbbb3406e8b0d2a93b943474df367e8c4342df2',
  'newTable:accessory.json':
    '449ed58b7e0d034c7c1fb48114468078810a97e4a61fe596cea53c19208c4b39',
  'newTable:accessory_customed.json':
    '531e9ada45156f0151d21f959495cd7fd12e8f55a6d7b51997a9f2ac1d9dbb30',
  'newTable:accessory_level.json':
    '39c07d5436f4b4b505e6977c9d1ec7d85b440a446c529e4c44ef8964e1eecd93',
  'newTable:accessory_main.json':
    '3a62df2b012a1b78a9f8596df2fa6b228eff32b437754359f3cab296074484b8',
  'newTable:accessory_set.json':
    'c1968106de40dd6648658841fce5d849fc89de9f2dbfde0709656c10e0d87b47',
  'newTable:accessory_sub_parameter.json':
    '1f8fb9f09bd8132973cc4ddb1b517c96e5526bb5bedf982b0121e6916aac334b',
  'newTable:game.json':
    '0d4bd1fe373896eba7b8dc555b4fc3153c3021fbaf12402f8451a1a006d0f831',
  'newTable:hero_break.json':
    '502f166017f7fbbdd4b55e5b73551faf41348986d149b2ff5165a026ba96db67',
  'newTable:hero_rank.json':
    '6baad7776ca8b4128c4c0c4ebf18300bf473b09dd26ca7576614e3f2deaf35c0',
  'newTable:pet_favorability.json':
    '4c8c337cbd9a3c9d7f81907a21f947eac48bdf362765921f5adecf8496c1122e',
  'newTable:pet_talent_upgrade.json':
    'cc9dc34abee41cd5df75472c83af2e93e1f060e5764041be498dfdfffb6a6625',
  'newTable:skill_level.json':
    '6f661653182ddf7a36a64534c7a1a6c20b42a96d73baa1e9455649340c7881bf',
  'newTable:skillsub_ele_value.json':
    '836178c72056b4946005cb9d48dc372627ee415f19f0fb73b55809fb1641c1ba',
  'newTable:skillsub_logic.json':
    'ca6da39f122466a32b229b9599ecfc34dbdbbf6e10a157c529d43d1043b8f4b7',
  'newTable:soulessence.json':
    'a8b3222840e8c28a4bb770b55f4dd9d815720493717a2c9ed0ce7471d9bbed29',
  'newTable:soulessence_level.json':
    'f12a49b9cb5a910026a7edbc0bc39231b6d00d9c8339a9f8b51980d4951b7fb6',
  'newTable:soulessence_rank.json':
    '48f4c975f8da914f89fde42191e80d746e62b86dbcdad2b714b2f38f3f555986',
  'newTable:soulessence_value.json':
    'bf21d3a7c1579ddd16c6abcb52d0a7e5dd90c007274a3fea6fc647f96a084a7b',
  'newTable:talent_rank.json':
    '10a718dcc0c9e5c989aae12c03087e2036054107748df3605cb7aae25af8c0c7',
  'newTable:talent_rune.json':
    '7c31b396c6418b48fbb8311771fb1c3a0c9bf460f6940fac38dcd62114cf9689',
  battleElementAssets:
    '059535b45b7b64db59e5cdc49eb6f60bf9fc4b1bb547aaa74f773f2752406346',
  soulEffectControlClosure:
    'fc30b3421db5c04a517a29f81e969c428b33ade9392ef806fad56a29cd1fcdfe',
  setSkillEffectControlClosure:
    '8985e7ce5fa74b703caf39430e29aa3a4db212348df6653b1529f58cf4b7c18d',
  equipmentInstanceTerms:
    '4b5ddb03534713fcecbbc41c911c88a3eb57c5f6f3d06cc68a7c3f08f39c34b7',
  il2cppRuntimeContracts:
    '0ea1f95a5fe8beb0c4b6c5dc2434c72c3e2a38cf94701b240aac35bca6bd817a',
  heroRankRuntimeEvidence:
    '15b104602e833d29e35c8a452c0ee3b3b6b9fe6d0b8cc1dd55f32c37883c88c8',
  soulEffectGetElementRuntimeEvidence:
    '06db8dd699ccad3a5b28b1099b5879ff6dd0990620d230918342d5ee80988ab3',
  soulEffectGetElementTypeRuntimeEvidence:
    '4054d0d97a146faeb56f1fcb518126c1ca41edb698c3ed722fe5247e4ffff56a',
  soulEffectBeforeDamageRuntimeEvidence:
    '9a134964698a7bb6dacc25e917759b69b0ec4fb63df4863501d02c9df904d14e',
  soulEffectNonDamageRuntimeEvidence:
    'b70e084ba7f5edfc65f70dbb3b8aab6f8ac30888a252627f4412e2d1b9a768a1',
  battlePropertyTagMatchingRuntimeEvidence:
    'a908a614ebc04462e082cc17f7df28c1da0c072a367e5f99ef208f7cb475b544',
  soulEffectKillCriticalEventRuntimeEvidence:
    'cd482fcba7d9ff16fc202318744d4098a4dfeedebe1cbde550f7081eac4503f6',
  landedHitRecoveryRuntimeEvidence:
    '634c979cda572f8fff1509bbf888240aebe8fad7728f357ce06390fee364a248',
  persistentLoadoutPropertyRuntimeEvidence:
    'c8b9205b959a241f284dcacb4a27cbe63fc62cd028766777f50cca8941ecea57',
  periodicPersistentPropertyRuntimeEvidence:
    '479c3b907deebb17d8a8d21713b552b5ad4174a032ea0b9dcaea937781dd1c25',
  fourPieceSetStackRuntimeEvidence:
    'ae357c59a494f724c9ce36fde79df3fd505f1434c01c4b87697d5770f9cc98dc',
  beforeSkillCompositeRuntimeEvidence:
    '165b87b2d5ea01f1a2f7f72a828b6a1eeeca19ef1f429003b2dccca457686212',
  afterDamageTargetPropertyRuntimeEvidence:
    'c60a582cda07b5e017cb47751a323f8958a6b1e292dc1a7f5bb34e7904374447',
  soulessenceAfterDamageEmptyConditionRuntimeEvidence:
    '6d5ce341ac84ce65013669a691f9e6e6c599b834ffb26e99b0065ad504d88626',
  soulessenceActivationConditionRuntimeEvidence:
    'b0c55784e49903448c4003b3fc33f70f895e8a090f8af7bef5910fae576d563e',
  elementFormula:
    'ebbdb6b9bd8117015f596be3055674d32963a68f3abe0a8865fef4373012515e',
  setThreeSourceIdentityEvidence:
    '4649262068c0e4a4ff860b0a059d673072d9a180317daf7d764c0e9b4d453577',
});

export const FROZEN_B3_DENOMINATORS = Object.freeze({
  characterOptimizationObjects: 9,
  sourceCharacterAliases: 10,
  kibos: 43,
  soulEssences: 62,
  equipment: 137,
  setSkills: 12,
});

const TARGET_ELEMENTS = new Set(['风', '雷']);
const FORMAL_CHARACTER_OPTIMIZATION_OBJECT_IDS = new Set(
  optimizationScenarioPolicy.candidateRoster.formalOptimizationObjectIds
    .filter(identity => identity !== 'STARBORN')
    .map(Number)
);
const STARBORN_SOURCE_CHARACTER_IDS = Object.freeze([199001, 199002]);
const KIBO_DNA_PRODUCT_SCOPE = Object.freeze({
  status: 'not-applicable',
  reason: 'kibo-dna-out-of-scope-current-version',
  canonicalValue: [],
});
const HERO_RANK_PRODUCT_DECISION = Object.freeze({
  decision: 'unimplemented-dead-config',
  decidedAt: '2026-08-07',
  summary:
    'hero_rank is unimplemented dead config in the current client: no UI page, no protocol request, no system-open entry, dangling guide behavior, no gameplay consumer of TDHeroRank, and every HeroRank-named client artifact actually refers to talent_rank. Cultivation state and values are not affected by hero_rank; the optimizer does not specify it.',
});
const EQUIPMENT_SLOT_BY_TYPE = Object.freeze({
  1: 'weapon',
  2: 'top',
  3: 'bottom',
  4: 'earring',
  5: 'ring',
});
const CULTIVATION_SOURCE_FILES = Object.freeze([
  'accessory.json',
  'accessory_main.json',
  'accessory_customed.json',
  'accessory_level.json',
  'accessory_set.json',
  'accessory_sub_parameter.json',
  'game.json',
  'hero_break.json',
  'hero_rank.json',
  'pet_talent_upgrade.json',
  'pet_favorability.json',
  'skill_level.json',
  'skillsub_ele_value.json',
  'skillsub_logic.json',
  'soulessence.json',
  'soulessence_level.json',
  'soulessence_rank.json',
  'soulessence_value.json',
  'talent_rank.json',
  'talent_rune.json',
]);

export async function createOptimizationQualificationArtifacts({
  projectRoot,
  newTableRoot = 'C:/PC2/Codex/AzPr/Assets/ResourcesAssets/Config/NewTable',
  battleElementAssetsPath = 'C:/PC2/Codex/AzPr/work/combat-formulas/battle-element-assets.jsonl',
  skillControlRoot = 'C:/Codex/AzPr Extractor/ExtractedAssets/Unity/default_package/ResourcesAssets/Config/Battle/SkillList',
  equipmentInstanceTermsPath = 'C:/PC2/Codex/AzPr/Assets/ResourcesLang/chs/Table/lang_words.json',
  il2cppRuntimeContractsPath = 'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs',
  heroRankRuntimeEvidencePath = null,
  soulEffectGetElementRuntimeEvidencePath = null,
  soulEffectGetElementTypeRuntimeEvidencePath = null,
  soulEffectBeforeDamageRuntimeEvidencePath = null,
  soulEffectNonDamageRuntimeEvidencePath = null,
  battlePropertyTagMatchingRuntimeEvidencePath = null,
  soulEffectKillCriticalEventRuntimeEvidencePath = null,
  landedHitRecoveryRuntimeEvidencePath = null,
  persistentLoadoutPropertyRuntimeEvidencePath = null,
  periodicPersistentPropertyRuntimeEvidencePath = null,
  fourPieceSetStackRuntimeEvidencePath = null,
  beforeSkillCompositeRuntimeEvidencePath = null,
  afterDamageTargetPropertyRuntimeEvidencePath = null,
  soulessenceAfterDamageEmptyConditionRuntimeEvidencePath = null,
  soulessenceActivationConditionRuntimeEvidencePath = null,
  setThreeSourceIdentityEvidencePath = null,
  dynamicLoadoutAcceptanceReportPath = null,
  gameAssemblyPath = 'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll',
  skillLocalizationPath = 'C:/PC2/Codex/AzPr/Assets/ResourcesLang/chs/Table/lang_skill.json',
} = {}) {
  if (!projectRoot) throw new TypeError('projectRoot is required');
  const generatedRoot = path.join(projectRoot, 'src', 'data', 'generated');
  const sourceDefinitions = {
    characters: path.join(generatedRoot, 'characters.json'),
    kibos: path.join(generatedRoot, 'kibos.json'),
    equipment: path.join(generatedRoot, 'equipment.json'),
    soulessences: path.join(generatedRoot, 'soulessences.json'),
    verifiedMechanics: path.join(
      generatedRoot,
      'verified-combat-mechanics-package.json'
    ),
    characterAcceptance: path.join(
      generatedRoot,
      'character-acceptance-catalog.json'
    ),
    visualAcceptance: path.join(
      generatedRoot,
      'm12-b3-visual-acceptance-catalog.json'
    ),
    kiboPassives: path.join(generatedRoot, 'kibo-passive-mechanics.json'),
    kiboMaturity: path.join(
      projectRoot,
      'reports',
      'kibo-headless',
      'kibo-maturity-matrix.json'
    ),
  };
  const sources = {};
  for (const [key, sourcePath] of Object.entries(sourceDefinitions)) {
    sources[key] = await readSource(sourcePath, projectRoot);
  }
  for (const fileName of CULTIVATION_SOURCE_FILES) {
    sources[`newTable:${fileName}`] = await readSource(
      path.join(newTableRoot, fileName),
      projectRoot
    );
  }
  sources.equipmentInstanceTerms = await readEquipmentInstanceTermsSource(
    equipmentInstanceTermsPath,
    projectRoot
  );
  sources.il2cppRuntimeContracts = await readIl2CppRuntimeContractsSource(
    il2cppRuntimeContractsPath,
    projectRoot
  );
  sources.heroRankRuntimeEvidence = await readHeroRankRuntimeEvidenceSource(
    heroRankRuntimeEvidencePath ??
      path.join(
        projectRoot,
        'scripts',
        'optimization-qualification',
        'evidence',
        'hero-rank-runtime-evidence.json'
      ),
    gameAssemblyPath,
    sources.il2cppRuntimeContracts,
    projectRoot
  );
  sources.soulEffectGetElementRuntimeEvidence =
    await readSoulEffectGetElementRuntimeEvidenceSource(
      soulEffectGetElementRuntimeEvidencePath ??
        path.join(
          projectRoot,
          'scripts',
          'optimization-qualification',
          'evidence',
          'soulessence-get-element-runtime-evidence.json'
        ),
      gameAssemblyPath,
      projectRoot
    );
  sources.soulEffectGetElementTypeRuntimeEvidence =
    await readGetElementTypeRuntimeEvidenceSource({
      sourcePath:
        soulEffectGetElementTypeRuntimeEvidencePath ??
        path.join(
          projectRoot,
          ...GET_ELEMENT_TYPE_EVIDENCE_RELATIVE_PATH.split('/')
        ),
      gameAssemblyPath,
      il2CppDumpPath: il2cppRuntimeContractsPath,
      projectRoot,
    });
  sources.soulEffectBeforeDamageRuntimeEvidence =
    await readSoulEffectBeforeDamageRuntimeEvidenceSource(
      soulEffectBeforeDamageRuntimeEvidencePath ??
        path.join(
          projectRoot,
          'scripts',
          'optimization-qualification',
          'evidence',
          'soulessence-before-damage-runtime-evidence.json'
        ),
      gameAssemblyPath,
      projectRoot
    );
  sources.soulEffectNonDamageRuntimeEvidence =
    await readSoulEffectNonDamageRuntimeEvidenceSource({
      sourcePath:
        soulEffectNonDamageRuntimeEvidencePath ??
        path.join(
          projectRoot,
          'scripts',
          'optimization-qualification',
          'evidence',
          'soulessence-non-damage-runtime-evidence.json'
        ),
      il2CppDumpPath: il2cppRuntimeContractsPath,
      gameAssemblyPath,
      projectRoot,
    });
  sources.battlePropertyTagMatchingRuntimeEvidence =
    await readBattlePropertyTagMatchingRuntimeEvidenceSource({
      sourcePath:
        battlePropertyTagMatchingRuntimeEvidencePath ??
        path.join(
          projectRoot,
          'scripts',
          'optimization-qualification',
          'evidence',
          'battle-property-tag-matching-runtime-evidence.json'
        ),
      gameAssemblyPath,
      il2CppDumpPath: il2cppRuntimeContractsPath,
      projectRoot,
    });
  sources.soulEffectKillCriticalEventRuntimeEvidence =
    await readSoulEffectKillCriticalEventRuntimeEvidenceSource({
      sourcePath:
        soulEffectKillCriticalEventRuntimeEvidencePath ??
        path.join(
          projectRoot,
          'scripts',
          'optimization-qualification',
          'evidence',
          'soulessence-kill-critical-event-runtime-evidence.json'
        ),
      gameAssemblyPath,
      il2CppDumpPath: il2cppRuntimeContractsPath,
      projectRoot,
    });
  sources.il2cppRuntimeContracts.value.battlePropertyTags =
    attachBattlePropertyTagMatchingEvidence(
      sources.il2cppRuntimeContracts.value.battlePropertyTags,
      sources.battlePropertyTagMatchingRuntimeEvidence.value
    );
  sources.landedHitRecoveryRuntimeEvidence =
    await readLandedHitRecoveryRuntimeEvidenceSource({
      sourcePath:
        landedHitRecoveryRuntimeEvidencePath ??
        path.join(
          projectRoot,
          ...LANDED_HIT_RECOVERY_EVIDENCE_RELATIVE_PATH.split('/')
        ),
      gameAssemblyPath,
      il2CppDumpPath: il2cppRuntimeContractsPath,
      projectRoot,
    });
  sources.persistentLoadoutPropertyRuntimeEvidence =
    await readPersistentLoadoutPropertyRuntimeEvidenceSource({
      sourcePath:
        persistentLoadoutPropertyRuntimeEvidencePath ??
        path.join(
          projectRoot,
          ...PERSISTENT_LOADOUT_PROPERTY_EVIDENCE_RELATIVE_PATH.split('/')
        ),
      gameAssemblyPath,
      il2CppDumpPath: il2cppRuntimeContractsPath,
      projectRoot,
    });
  sources.periodicPersistentPropertyRuntimeEvidence =
    await readPeriodicPersistentPropertyRuntimeEvidenceSource({
      sourcePath:
        periodicPersistentPropertyRuntimeEvidencePath ??
        path.join(
          projectRoot,
          ...PERIODIC_PERSISTENT_PROPERTY_EVIDENCE_RELATIVE_PATH.split('/')
        ),
      gameAssemblyPath,
      il2CppDumpPath: il2cppRuntimeContractsPath,
      battleElementAssetsPath,
      elementFormulaPath: path.join(newTableRoot, 'element_formula.json'),
      projectRoot,
    });
  sources.fourPieceSetStackRuntimeEvidence =
    await readFourPieceSetStackRuntimeEvidenceSource({
      sourcePath:
        fourPieceSetStackRuntimeEvidencePath ??
        path.join(
          projectRoot,
          ...FOUR_PIECE_SET_STACK_EVIDENCE_RELATIVE_PATH.split('/')
        ),
      gameAssemblyPath,
      il2CppDumpPath: il2cppRuntimeContractsPath,
      projectRoot,
    });
  sources.beforeSkillCompositeRuntimeEvidence =
    await readBeforeSkillCompositeRuntimeEvidenceSource({
      sourcePath:
        beforeSkillCompositeRuntimeEvidencePath ??
        path.join(
          projectRoot,
          ...BEFORE_SKILL_COMPOSITE_EVIDENCE_RELATIVE_PATH.split('/')
        ),
      gameAssemblyPath,
      il2CppDumpPath: il2cppRuntimeContractsPath,
      elementFormulaPath: path.join(newTableRoot, 'element_formula.json'),
      projectRoot,
    });
  sources.afterDamageTargetPropertyRuntimeEvidence =
    await readAfterDamageTargetPropertyRuntimeEvidenceSource({
      sourcePath:
        afterDamageTargetPropertyRuntimeEvidencePath ??
        path.join(
          projectRoot,
          ...AFTER_DAMAGE_TARGET_PROPERTY_EVIDENCE_RELATIVE_PATH.split('/')
        ),
      gameAssemblyPath,
      il2CppDumpPath: il2cppRuntimeContractsPath,
      localizationPath: skillLocalizationPath,
      battleElementAssetsPath,
      skillControlPath: path.join(
        skillControlRoot,
        'skill_control_19998008.asset',
        'MonoBehaviour',
        'skill_control_19998008__3385592889625444843.json'
      ),
      projectRoot,
    });
  sources.soulessenceAfterDamageEmptyConditionRuntimeEvidence =
    await readAfterDamageEmptyConditionRuntimeEvidenceSource({
      sourcePath:
        soulessenceAfterDamageEmptyConditionRuntimeEvidencePath ??
        path.join(
          projectRoot,
          ...AFTER_DAMAGE_EMPTY_CONDITION_EVIDENCE_RELATIVE_PATH.split('/')
        ),
      gameAssemblyPath,
      il2CppDumpPath: il2cppRuntimeContractsPath,
      projectRoot,
    });
  const elementFormulaPath = path.join(newTableRoot, 'element_formula.json');
  const elementFormulaBytes = await fs.readFile(elementFormulaPath);
  sources.elementFormula = {
    path: elementFormulaPath.replaceAll('\\', '/'),
    bytes: elementFormulaBytes.byteLength,
    sha256: createHash('sha256').update(elementFormulaBytes).digest('hex'),
    value: JSON.parse(elementFormulaBytes.toString('utf8')),
  };
  sources.soulessenceActivationConditionRuntimeEvidence =
    await readActivationConditionRuntimeEvidenceSource({
      sourcePath:
        soulessenceActivationConditionRuntimeEvidencePath ??
        path.join(
          projectRoot,
          ...ACTIVATION_CONDITION_EVIDENCE_RELATIVE_PATH.split('/')
        ),
      gameAssemblyPath,
      il2CppDumpPath: il2cppRuntimeContractsPath,
      elementFormulaPath,
      projectRoot,
    });
  const setSkillControlRoot = path.resolve(skillControlRoot);
  const formalSetThreeControlRoot = path.join(
    setSkillControlRoot,
    'skill_control_19998005.asset',
    'MonoBehaviour'
  );
  const nearMatchSetFourControlRoot = path.join(
    setSkillControlRoot,
    'skill_control_19998003.asset',
    'MonoBehaviour'
  );
  sources.setThreeSourceIdentityEvidence =
    await readSetThreeSourceIdentityEvidenceSource({
      sourcePath:
        setThreeSourceIdentityEvidencePath ??
        path.join(
          projectRoot,
          ...SET_THREE_SOURCE_IDENTITY_EVIDENCE_RELATIVE_PATH.split('/')
        ),
      accessorySetPath: path.join(newTableRoot, 'accessory_set.json'),
      skillTablePath: path.join(newTableRoot, 'skill.json'),
      localizationPaths: {
        chs: skillLocalizationPath,
        jp: 'C:/PC2/Codex/AzPr/Assets_JP_JA_CB2/ResourcesLang/jp/Table/lang_skill.json',
        kr: 'C:/PC2/Codex/AzPr/Assets_KR_KO_CB2/ResourcesLang/kr/Table/lang_skill.json',
        cht: 'C:/PC2/Codex/AzPr/Assets_TW_TC_CB2/ResourcesLang/cht/Table/lang_skill.json',
      },
      battleElementAssetsPath,
      formalControlFiles: {
        main: path.join(
          formalSetThreeControlRoot,
          'skill_control_19998005__-2339022120750825272.json'
        ),
        trackInstall: path.join(
          formalSetThreeControlRoot,
          'MonoBehaviour_-5874771271388107138__-5874771271388107138.json'
        ),
        trackUnload: path.join(
          formalSetThreeControlRoot,
          'MonoBehaviour_-4955137497584177538__-4955137497584177538.json'
        ),
        behaviorInstall: path.join(
          formalSetThreeControlRoot,
          'MonoBehaviour_-7665508558900367746__-7665508558900367746.json'
        ),
        behaviorUnload: path.join(
          formalSetThreeControlRoot,
          'MonoBehaviour_-7993432668986282370__-7993432668986282370.json'
        ),
      },
      nearMatchControlFiles: {
        main: path.join(
          nearMatchSetFourControlRoot,
          'skill_control_19998003__-3103682062580946589.json'
        ),
        behavior: path.join(
          nearMatchSetFourControlRoot,
          'MonoBehaviour_-6651836192383337979__-6651836192383337979.json'
        ),
      },
      battleElementBundlePath:
        'C:/AP/AzurPromilia_TC/AzurPromilia_game/azurpromilia_Data/StreamingAssets/.res/default_package/fwtvymrpqatpf4ytyfvwqg',
      skillControlBundlePath:
        'C:/AP/AzurPromilia_TC/AzurPromilia_game/azurpromilia_Data/StreamingAssets/.res/default_package/sxtotgjsgmmqba8fd86yjw',
      extractedUnityRoot: 'C:/Codex/AzPr Extractor/ExtractedAssets/Unity',
      projectRoot,
    });
  const acceptanceReport = JSON.parse(
    await fs.readFile(
      dynamicLoadoutAcceptanceReportPath ??
        path.join(
          projectRoot,
          'reports',
          'm12',
          'm12-b3-c-dynamic-loadout-effect-acceptance.json'
        ),
      'utf8'
    )
  );
  assertLandedHitRecoveryRuntimeEvidenceReference(
    acceptanceReport?.sourceClosure?.landedHitRecoveryRuntimeEvidence,
    sources.landedHitRecoveryRuntimeEvidence
  );
  assertGetElementTypeRuntimeEvidenceReference(
    acceptanceReport?.sourceClosure?.getElementTypeRuntimeEvidence,
    sources.soulEffectGetElementTypeRuntimeEvidence
  );
  assertSoulEffectNonDamageRuntimeEvidenceReference(
    acceptanceReport?.sourceClosure?.nonDamageRuntimeEvidence,
    sources.soulEffectNonDamageRuntimeEvidence
  );
  assertBattlePropertyTagMatchingRuntimeEvidenceReference(
    acceptanceReport?.sourceClosure?.battlePropertyTagMatchingRuntimeEvidence,
    sources.battlePropertyTagMatchingRuntimeEvidence
  );
  assertSoulEffectKillCriticalEventRuntimeEvidenceReference(
    acceptanceReport?.sourceClosure?.killCriticalEventRuntimeEvidence,
    sources.soulEffectKillCriticalEventRuntimeEvidence
  );
  assertPersistentLoadoutPropertyRuntimeEvidenceReference(
    acceptanceReport?.sourceClosure?.persistentLoadoutPropertyRuntimeEvidence,
    sources.persistentLoadoutPropertyRuntimeEvidence
  );
  assertPeriodicPersistentPropertyRuntimeEvidenceReference(
    acceptanceReport?.sourceClosure?.periodicPersistentPropertyRuntimeEvidence,
    sources.periodicPersistentPropertyRuntimeEvidence
  );
  assertFourPieceSetStackRuntimeEvidenceReference(
    acceptanceReport?.sourceClosure?.fourPieceSetStackRuntimeEvidence,
    sources.fourPieceSetStackRuntimeEvidence
  );
  assertBeforeSkillCompositeRuntimeEvidenceReference(
    acceptanceReport?.sourceClosure?.beforeSkillCompositeRuntimeEvidence,
    sources.beforeSkillCompositeRuntimeEvidence
  );
  assertAfterDamageTargetPropertyRuntimeEvidenceReference(
    acceptanceReport?.sourceClosure?.afterDamageTargetPropertyRuntimeEvidence,
    sources.afterDamageTargetPropertyRuntimeEvidence
  );
  assertAfterDamageEmptyConditionRuntimeEvidenceReference(
    acceptanceReport?.sourceClosure?.afterDamageEmptyConditionRuntimeEvidence,
    sources.soulessenceAfterDamageEmptyConditionRuntimeEvidence
  );
  assertActivationConditionRuntimeEvidenceReference(
    acceptanceReport?.sourceClosure
      ?.soulessenceActivationConditionRuntimeEvidence,
    sources.soulessenceActivationConditionRuntimeEvidence
  );
  assertSetThreeSourceIdentityEvidenceReference(
    acceptanceReport?.sourceClosure?.setThreeSourceIdentityEvidence,
    sources.setThreeSourceIdentityEvidence
  );
  sources.il2cppRuntimeContracts.value.soulEffectTriggers =
    attachSoulEffectGetElementRuntimeEvidence(
      sources.il2cppRuntimeContracts.value.soulEffectTriggers,
      sources.soulEffectGetElementRuntimeEvidence.value,
      sources.soulEffectGetElementTypeRuntimeEvidence.value
    );
  sources.il2cppRuntimeContracts.value.soulEffectTriggers =
    attachSoulEffectBeforeDamageRuntimeEvidence(
      sources.il2cppRuntimeContracts.value.soulEffectTriggers,
      sources.soulEffectBeforeDamageRuntimeEvidence.value
    );
  sources.il2cppRuntimeContracts.value.soulEffectTriggers =
    attachSoulEffectNonDamageRuntimeEvidence(
      sources.il2cppRuntimeContracts.value.soulEffectTriggers,
      sources.soulEffectNonDamageRuntimeEvidence.value
    );
  sources.il2cppRuntimeContracts.value.soulEffectTriggers =
    attachSoulEffectKillCriticalEventRuntimeEvidence(
      sources.il2cppRuntimeContracts.value.soulEffectTriggers,
      sources.soulEffectKillCriticalEventRuntimeEvidence.value
    );
  const characters = sources.characters.value.items ?? [];
  const kibos = sources.kibos.value.items ?? [];
  const equipment = sources.equipment.value.items ?? [];
  const soulEssences = sources.soulessences.value.items ?? [];
  const mechanics = sources.verifiedMechanics.value;
  const staticCatalog = mechanics.staticPropertyCatalog ?? {};
  const publicEquipmentIds = new Set(equipment.map(row => Number(row.id)));
  const publicKiboIds = new Set(
    (sources.kiboMaturity.value.rows ?? []).map(row => Number(row.kiboId))
  );

  const targetCharacters = characters
    .filter(character =>
      FORMAL_CHARACTER_OPTIMIZATION_OBJECT_IDS.has(Number(character.id))
    )
    .sort(sortByNumericId);
  const starbornAliases = STARBORN_SOURCE_CHARACTER_IDS.map(characterId =>
    requireById(characters, characterId, 'STARBORN source character')
  );
  const starbornProjections = starbornAliases.map(projectStarbornMechanics);
  const starbornMechanismHashes = starbornProjections.map(hashCanonicalValue);
  if (new Set(starbornMechanismHashes).size !== 1) {
    throw new Error(
      `optimization-qualification-starborn-mechanism-drift:${starbornMechanismHashes.join(',')}`
    );
  }

  const characterObjects = [
    ...targetCharacters.map(character =>
      projectCharacterOptimizationObject(character)
    ),
    {
      optimizationObjectId: 'STARBORN',
      displayName: '星临者',
      sourceCharacterIds: [...STARBORN_SOURCE_CHARACTER_IDS],
      sourceNames: starbornAliases.map(character => character.name),
      elements: ['无'],
      position: starbornAliases[0].position?.name ?? null,
      weaponType: starbornAliases[0].weaponType?.name ?? null,
      mechanismHash: starbornMechanismHashes[0],
      aliasMechanismHashes: Object.fromEntries(
        STARBORN_SOURCE_CHARACTER_IDS.map((characterId, index) => [
          characterId,
          starbornMechanismHashes[index],
        ])
      ),
      sourceIdentity:
        'generated/characters.json#items[id=199001|199002]:normalized-mechanics',
    },
  ];
  const targetKibos = kibos
    .filter(kibo => publicKiboIds.has(Number(kibo.id)))
    .filter(kibo => hasTargetElement(kibo.element))
    .sort(sortByNumericId)
    .map(projectKiboRosterRecord);
  const soulEssenceProfilesById = new Map(
    (staticCatalog.soulessences ?? []).map(profile => [
      Number(profile.soulessenceId),
      profile,
    ])
  );
  let publicSoulEssences = soulEssences
    .slice()
    .sort(sortByNumericId)
    .map(item =>
      projectSoulEssenceRosterRecord(
        item,
        soulEssenceProfilesById.get(Number(item.id)) ?? null
      )
    );
  const setSkills = (staticCatalog.accessorySets ?? [])
    .slice()
    .sort(
      (left, right) =>
        Number(left.setId) - Number(right.setId) ||
        Number(left.pieces) - Number(right.pieces)
    )
    .map(projectSetSkillRosterRecord);
  const soulEssenceEffects = await createSoulEssenceEffectMechanicsCatalog({
    soulEssences: publicSoulEssences,
    soulDefinitionRows: sources['newTable:soulessence.json'].value.rows ?? [],
    skillLogicRows: sources['newTable:skillsub_logic.json'].value.rows ?? [],
    skillElementValueRows:
      sources['newTable:skillsub_ele_value.json'].value.rows ?? [],
    battleElementAssetsPath,
    skillControlRoot,
    generatedAt: OPTIMIZATION_QUALIFICATION_GENERATED_AT,
    projectRoot,
    setSkills,
    propertyTagContract:
      sources.il2cppRuntimeContracts.value.battlePropertyTags,
    triggerContract: sources.il2cppRuntimeContracts.value.soulEffectTriggers,
    tuningMechanicsCatalog: mechanics.tuningMechanicsCatalog,
    persistentLoadoutPropertyRuntimeEvidence:
      sources.persistentLoadoutPropertyRuntimeEvidence.value,
    periodicPersistentPropertyRuntimeEvidence:
      sources.periodicPersistentPropertyRuntimeEvidence.value,
    fourPieceSetStackRuntimeEvidence:
      sources.fourPieceSetStackRuntimeEvidence.value,
    beforeSkillCompositeRuntimeEvidence:
      sources.beforeSkillCompositeRuntimeEvidence.value,
    afterDamageTargetPropertyRuntimeEvidence:
      sources.afterDamageTargetPropertyRuntimeEvidence.value,
    beforeDamageEmptyConditionRuntimeEvidence:
      sources.soulEffectBeforeDamageRuntimeEvidence.value,
    afterDamageEmptyConditionRuntimeEvidence:
      sources.soulessenceAfterDamageEmptyConditionRuntimeEvidence.value,
    activationConditionRuntimeEvidence:
      sources.soulessenceActivationConditionRuntimeEvidence.value,
    elementFormulaRows: sources.elementFormula.value.rows ?? [],
    setThreeSourceIdentityEvidence:
      sources.setThreeSourceIdentityEvidence.value,
  });
  sources.battleElementAssets = {
    ...soulEssenceEffects.sourceSnapshot.battleElements,
    value: {
      rowCount: soulEssenceEffects.sourceSnapshot.battleElements.rowCount,
    },
  };
  sources.soulEffectControlClosure = {
    ...soulEssenceEffects.sourceSnapshot.controlClosure,
    value: {
      skillCount: soulEssenceEffects.sourceSnapshot.controlClosure.skillCount,
      fileCount: soulEssenceEffects.sourceSnapshot.controlClosure.fileCount,
    },
  };
  sources.setSkillEffectControlClosure = {
    ...soulEssenceEffects.sourceSnapshot.setSkillControlClosure,
    value: {
      skillCount:
        soulEssenceEffects.sourceSnapshot.setSkillControlClosure.skillCount,
      fileCount:
        soulEssenceEffects.sourceSnapshot.setSkillControlClosure.fileCount,
    },
  };
  assertFrozenSourceHashes(sources);
  const soulEffectById = new Map(
    soulEssenceEffects.definitions.map(definition => [
      Number(definition.soulEssenceId),
      definition,
    ])
  );
  publicSoulEssences = publicSoulEssences.map(item => {
    const effectMechanics =
      soulEffectById.get(Number(item.soulEssenceId)) ?? null;
    return {
      ...item,
      sourceEffectStatus: item.effectStatus,
      effectStatus:
        effectMechanics?.runtimeStatus ?? 'effect-mechanics-profile-missing',
      effectMechanics,
    };
  });
  const dynamicLoadoutEffectCensus =
    createDynamicLoadoutEffectCensus(soulEssenceEffects);
  const equipmentProfilesById = new Map(
    (staticCatalog.equipment ?? []).map(profile => [
      Number(profile.equipmentId),
      profile,
    ])
  );
  const publicEquipment = equipment
    .slice()
    .sort(sortByNumericId)
    .map(item =>
      projectEquipmentRosterRecord(
        item,
        equipmentProfilesById.get(Number(item.id)) ?? null
      )
    );
  const denominators = {
    characterOptimizationObjects: characterObjects.length,
    sourceCharacterAliases:
      targetCharacters.length + STARBORN_SOURCE_CHARACTER_IDS.length,
    kibos: targetKibos.length,
    soulEssences: publicSoulEssences.length,
    equipment: publicEquipment.length,
    setSkills: setSkills.length,
  };
  assertDenominators(denominators);
  if (
    publicEquipment.some(record => !publicEquipmentIds.has(record.equipmentId))
  ) {
    throw new Error('optimization-qualification-public-equipment-subset-drift');
  }

  const cultivationCatalog = createCultivationCatalog({
    sources,
    mechanics,
    characterObjects,
    targetKibos,
    publicSoulEssences,
    publicEquipment,
  });
  const manifests = createQualificationManifests({
    characterObjects,
    targetKibos,
    publicSoulEssences,
    publicEquipment,
    setSkills,
    staticCatalog,
    characterAcceptance: sources.characterAcceptance.value,
    visualAcceptance: sources.visualAcceptance.value,
    kiboPassives: sources.kiboPassives.value,
    kiboMaturity: sources.kiboMaturity.value,
    cultivationCatalog,
    setSkillEffectDefinitions: soulEssenceEffects.setSkillDefinitions,
  });
  const bindingMatrix = createBindingMatrix({
    characterObjects,
    targetKibos,
    publicSoulEssences,
    publicEquipment,
    setSkills,
    manifests,
  });
  const sourceSnapshot = createSourceSnapshot(sources);
  const roster = finalizeHash(
    {
      schemaVersion: 1,
      contractName: 'AzPrOptimizationQualificationRoster',
      kind: 'azpr-optimization-qualification-roster',
      generatedAt: OPTIMIZATION_QUALIFICATION_GENERATED_AT,
      phase: 'M12-B3-E16',
      sourceSnapshot,
      filterContract: {
        optimizationScenarioPolicyId: optimizationScenarioPolicy.policyId,
        optimizationScenarioPolicyHash: optimizationScenarioPolicy.policyHash,
        candidateRosterPolicyId:
          optimizationScenarioPolicy.candidateRoster.rosterPolicyId,
        candidateRosterHash:
          optimizationScenarioPolicy.candidateRoster.rosterHash,
        formalCharacterOptimizationObjectIds:
          optimizationScenarioPolicy.candidateRoster
            .formalOptimizationObjectIds,
        characterFilter:
          'frozen-candidate-roster-policy-instead-of-element-only-filter',
        kiboElements: ['风', '雷'],
        kiboElementField: 'kibos.items[].element',
        discreteTagDelimiter: '、',
        kiboPublicDenominator:
          'reports/kibo-headless/kibo-maturity-matrix.json#rows',
        starbornOptimizationObject: 'STARBORN',
        starbornSourceCharacterIds: [...STARBORN_SOURCE_CHARACTER_IDS],
      },
      productScope: {
        kiboDna: structuredClone(KIBO_DNA_PRODUCT_SCOPE),
        optimizationScenario: structuredClone(optimizationScenarioPolicy),
        characterRoster: structuredClone(
          optimizationScenarioPolicy.candidateRoster
        ),
        productScenarioExcludedCharacters: structuredClone(
          optimizationScenarioPolicy.candidateRoster
            .productScenarioExcludedCharacters
        ),
      },
      denominators,
      characters: characterObjects,
      kibos: targetKibos,
      soulEssences: publicSoulEssences,
      equipment: publicEquipment,
      setSkills,
      starborn: {
        optimizationObjectId: 'STARBORN',
        sourceCharacterIds: [...STARBORN_SOURCE_CHARACTER_IDS],
        normalizedMechanismHash: starbornMechanismHashes[0],
        aliasHashesEqual: new Set(starbornMechanismHashes).size === 1,
        projection: starbornProjections[0],
      },
    },
    'rosterHash'
  );
  const manifestDocument = finalizeHash(
    {
      schemaVersion: 1,
      contractName: 'AzPrOptimizationQualificationManifests',
      kind: 'azpr-optimization-qualification-manifests',
      generatedAt: OPTIMIZATION_QUALIFICATION_GENERATED_AT,
      rosterHash: roster.rosterHash,
      records: manifests,
      summary: summarizeManifests(manifests),
    },
    'manifestsHash'
  );
  const bindingDocument = finalizeHash(
    {
      schemaVersion: 1,
      contractName: 'AzPrOptimizationQualificationBindingMatrix',
      kind: 'azpr-optimization-qualification-binding-matrix',
      generatedAt: OPTIMIZATION_QUALIFICATION_GENERATED_AT,
      rosterHash: roster.rosterHash,
      ...bindingMatrix,
    },
    'bindingMatrixHash'
  );
  const gaps = createGapLedger(manifests);
  const implementationCapabilities = createImplementationCapabilities({
    roster,
    cultivationCatalog,
    bindingDocument,
  });
  const gapDocument = finalizeHash(
    {
      schemaVersion: 1,
      contractName: 'AzPrOptimizationQualificationGapLedger',
      kind: 'azpr-optimization-qualification-gap-ledger',
      generatedAt: OPTIMIZATION_QUALIFICATION_GENERATED_AT,
      rosterHash: roster.rosterHash,
      implementedCapabilities: implementationCapabilities,
      records: gaps,
      summary: summarizeGaps(gaps),
    },
    'ledgerHash'
  );
  const catalog = createQualificationCatalog({
    roster,
    manifestDocument,
    gapDocument,
    bindingDocument,
    cultivationCatalog,
  });
  const summary = createSummary({
    roster,
    manifestDocument,
    gapDocument,
    bindingDocument,
    catalog,
  });
  return {
    roster,
    manifests: manifestDocument,
    gaps: gapDocument,
    bindingMatrix: bindingDocument,
    catalog,
    soulEssenceEffects,
    dynamicLoadoutEffectCensus,
    summary,
    markdown: createMarkdownSummary(summary, catalog),
  };
}

function createQualificationManifests({
  characterObjects,
  targetKibos,
  publicSoulEssences,
  publicEquipment,
  setSkills,
  staticCatalog,
  characterAcceptance,
  visualAcceptance,
  kiboPassives,
  kiboMaturity,
  cultivationCatalog,
  setSkillEffectDefinitions,
}) {
  const actorStaticIds = new Set(
    (staticCatalog.actor?.profiles ?? []).map(profile =>
      Number(profile.characterId)
    )
  );
  const characterAcceptanceById = new Map(
    (characterAcceptance.entries ?? []).map(entry => [
      Number(entry.ownerId),
      entry,
    ])
  );
  const visualAcceptanceById = new Map(
    (visualAcceptance?.entries ?? []).map(entry => [
      `${entry.objectKind}:${entry.objectId}`,
      entry,
    ])
  );
  const kiboMaturityById = new Map(
    (kiboMaturity.rows ?? []).map(row => [Number(row.kiboId), row])
  );
  const unresolvedPassiveByKiboId = new Map();
  for (const unresolved of kiboPassives.unresolved ?? []) {
    for (const kiboId of unresolved.kiboIds ?? []) {
      unresolvedPassiveByKiboId.set(Number(kiboId), unresolved);
    }
  }
  const records = [];
  const cultivationCharacterById = new Map(
    cultivationCatalog.character.profiles.map(profile => [
      Number(profile.characterId),
      profile,
    ])
  );
  for (const actor of characterObjects) {
    const sourceIds = actor.sourceCharacterIds.map(Number);
    const acceptanceEntries = sourceIds
      .map(characterId => characterAcceptanceById.get(characterId))
      .filter(Boolean);
    const blockers = [];
    if (!sourceIds.every(characterId => actorStaticIds.has(characterId))) {
      blockers.push(
        blocker(
          'actor-static-profile-missing',
          'not-implemented',
          'Verified static actor profile is missing for at least one source identity.'
        )
      );
    }
    if (acceptanceEntries.length !== sourceIds.length) {
      blockers.push(
        blocker(
          'character-acceptance-not-published',
          'not-implemented',
          'No published M11-D acceptance manifest covers every source identity.'
        )
      );
    }
    if (
      acceptanceEntries.length !== sourceIds.length ||
      acceptanceEntries.some(entry => entry.optimizationReady !== true)
    ) {
      blockers.push(
        blocker(
          'character-not-optimization-ready',
          'not-implemented',
          'Character acceptance maturity has not reached optimization-ready.'
        )
      );
    }
    if (
      cultivationCatalog.character.levelBreakthrough
        .attributeApplicationStatus !== 'runtime-applied' &&
      cultivationCatalog.character.levelBreakthrough
        .attributeApplicationStatus !== 'not-applicable'
    ) {
      blockers.push(
        blocker(
          'strict-character-cultivation-runtime-partial',
          'evidence-insufficient',
          'hero_rank level legality is indexed, but attribute application and skill availability require a final-panel adjacent-rank capture or a proven upstream construction path.'
        )
      );
    }
    const skillUnlockGaps =
      cultivationCatalog.character.levelBreakthrough.skillUnlockMode ===
      'not-applicable'
        ? []
        : sourceIds.flatMap(characterId =>
            (
              cultivationCharacterById.get(characterId)
                ?.levelBreakthroughRanks ?? []
            )
              .filter(
                row =>
                  row.skillUnlock?.availabilityStatus === 'static-evidence-gap'
              )
              .map(row => ({
                characterId,
                rank: row.rank,
                skillId: row.skillUnlock.skillId,
                expectedPassiveSkillIds:
                  row.skillUnlock.expectedPassiveSkillIds ?? [],
                sourceIdentity: row.sourceIdentity,
              }))
          );
    if (skillUnlockGaps.length) {
      blockers.push(
        blocker(
          'level-breakthrough-skill-unlock-source-mismatch',
          'evidence-insufficient',
          'hero_rank unlock skill does not match the character passive slots; neither availability nor runtime effect identity is inferred.',
          { records: skillUnlockGaps }
        )
      );
    }
    records.push(
      qualificationRecord({
        objectKind: 'character',
        objectId: actor.optimizationObjectId,
        displayName: actor.displayName,
        sourceIdentities: sourceIds.map(
          id => `generated/characters.json#items[id=${id}]`
        ),
        maturityState:
          acceptanceEntries.length === sourceIds.length
            ? acceptanceEntries.every(
                entry => entry.optimizationReady === true
              )
              ? 'optimization-ready'
              : 'runtime-integrated'
            : 'extracted',
        blockers,
        evidence: {
          sourceCharacterIds: sourceIds,
          mechanismHash: actor.mechanismHash,
          characterAcceptanceManifestHashes: acceptanceEntries.map(
            entry => entry.manifestHash
          ),
        },
      })
    );
  }
  for (const kibo of targetKibos) {
    const maturity = kiboMaturityById.get(kibo.kiboId);
    const unresolvedPassive = unresolvedPassiveByKiboId.get(kibo.kiboId);
    const kiboVisual = visualAcceptanceById.get(`kibo:${kibo.kiboId}`);
    const blockers = [
      ...createVisualAcceptanceBlocker(
        kiboVisual,
        'kibo-visual-acceptance-not-published',
        'Kibo',
        'kibo-visual-acceptance-evidence-blocked'
      ),
    ];
    if (!maturity || maturity.machineOptimizationReady !== true) {
      blockers.push(
        blocker(
          'kibo-headless-maturity-not-ready',
          'not-implemented',
          'Kibo headless maturity has not reached machine optimization ready.'
        )
      );
    }
    if (unresolvedPassive) {
      blockers.push(
        blocker(
          'kibo-passive-static-evidence-gap',
          'evidence-insufficient',
          (unresolvedPassive.reasons ?? []).join('|') ||
            'Kibo passive evidence remains unresolved.',
          { skillId: unresolvedPassive.skillId }
        )
      );
    }
    records.push(
      qualificationRecord({
        objectKind: 'kibo',
        objectId: String(kibo.kiboId),
        displayName: kibo.name,
        sourceIdentities: [
          `generated/kibos.json#items[id=${kibo.kiboId}]`,
          `reports/kibo-headless/kibo-maturity-matrix.json#rows[kiboId=${kibo.kiboId}]`,
        ],
        maturityState:
          blockers.length === 0
            ? 'optimization-ready'
            : maturity?.actions &&
                Object.values(maturity.actions).every(action => action?.runnable)
            ? 'runtime-integrated'
            : 'extracted',
        blockers,
        evidence: {
          kiboId: kibo.kiboId,
          actionCount: kibo.actionCount,
          passiveSkillId: unresolvedPassive?.skillId ?? null,
          headlessRuntimeReady: maturity?.machineOptimizationReady === true,
          kiboDna: structuredClone(KIBO_DNA_PRODUCT_SCOPE),
        },
      })
    );
  }
  for (const soul of publicSoulEssences) {
    const soulVisual = visualAcceptanceById.get(
      `soul-essence:${soul.soulEssenceId}`
    );
    const effectApplied =
      soul.effectMechanics?.runtimeStatus === 'runtime-applied';
    const effectRuntimeGaps = soul.effectMechanics?.runtimeGaps ?? [
      'effect-mechanics-profile-missing',
    ];
    const effectGapCategory =
      effectRuntimeGaps.length > 0 &&
      effectRuntimeGaps.every(reason =>
        String(reason).endsWith('-evidence-gap')
      )
        ? 'evidence-insufficient'
        : 'not-implemented';
    const blockers = [
      ...(effectApplied
        ? []
        : [
            blocker(
              'soulessence-effect-skill-dynamic-unapplied',
              effectGapCategory,
              'The soul essence effect skill is source-indexed but its dynamic operator is not yet applied.',
              {
                skillId: soul.effectSkillId,
                reasons: effectRuntimeGaps,
              }
            ),
            blocker(
              'strict-soulessence-cultivation-runtime-partial',
              effectGapCategory,
              'Soul essence level/rank legality and star-driven skill levels are resolved; this effect skill remains dynamically unapplied.'
            ),
          ]),
      ...createVisualAcceptanceBlocker(
        soulVisual,
        'soulessence-visual-acceptance-not-published',
        'soul essence'
      ),
    ];
    records.push(
      qualificationRecord({
        objectKind: 'soul-essence',
        objectId: String(soul.soulEssenceId),
        displayName: soul.name,
        sourceIdentities: [
          `generated/soulessences.json#items[id=${soul.soulEssenceId}]`,
          soul.sourceIdentity,
        ].filter(Boolean),
        maturityState:
          soulVisual?.maturityState ??
          (effectApplied ? 'runtime-integrated' : 'extracted'),
        blockers,
        evidence: {
          ...soul,
          visualAcceptanceManifestHash: soulVisual?.manifestHash ?? null,
        },
      })
    );
  }
  for (const item of publicEquipment) {
    const equipmentVisual = visualAcceptanceById.get(
      `equipment:${item.equipmentId}`
    );
    const blockers = [
      ...createVisualAcceptanceBlocker(
        equipmentVisual,
        'equipment-visual-acceptance-not-published',
        'equipment instance contract'
      ),
    ];
    if (!item.staticProfileApplied) {
      blockers.push(
        blocker(
          'equipment-static-profile-missing',
          'not-implemented',
          'No verified static equipment profile is available.'
        )
      );
    }
    records.push(
      qualificationRecord({
        objectKind: 'equipment',
        objectId: String(item.equipmentId),
        displayName: item.name,
        sourceIdentities: [
          `generated/equipment.json#items[id=${item.equipmentId}]`,
          item.sourceIdentity,
        ].filter(Boolean),
        maturityState: equipmentVisual?.maturityState ?? 'extracted',
        blockers,
        evidence: {
          ...item,
          visualAcceptanceManifestHash: equipmentVisual?.manifestHash ?? null,
        },
      })
    );
  }
  const setSkillEffectByKey = new Map(
    (setSkillEffectDefinitions ?? []).map(definition => [
      `${definition.setId}:${definition.pieces}`,
      definition,
    ])
  );
  for (const setSkill of setSkills) {
    const setSkillVisual = visualAcceptanceById.get(
      `set-skill:${setSkill.setId}:${setSkill.pieces}`
    );
    const effectMechanics = setSkillEffectByKey.get(
      `${setSkill.setId}:${setSkill.pieces}`
    );
    const effectApplied = effectMechanics?.runtimeStatus === 'runtime-applied';
    const effectRuntimeGaps = effectMechanics?.runtimeGaps ?? [
      'set-skill-effect-mechanics-profile-missing',
    ];
    const effectGapCategory =
      effectRuntimeGaps.length > 0 &&
      effectRuntimeGaps.every(reason =>
        String(reason).endsWith('-evidence-gap')
      )
        ? 'evidence-insufficient'
        : 'not-implemented';
    records.push(
      qualificationRecord({
        objectKind: 'set-skill',
        objectId: `${setSkill.setId}:${setSkill.pieces}`,
        displayName: `套装 ${setSkill.setId} ${setSkill.pieces}件`,
        sourceIdentities: [setSkill.sourceIdentity],
        maturityState:
          setSkillVisual?.maturityState ??
          (effectApplied ? 'runtime-integrated' : 'extracted'),
        blockers: [
          ...(effectApplied
            ? []
            : [
                blocker(
                  'set-skill-dynamic-unapplied',
                  effectGapCategory,
                  'The accessory set skill is tracked but not applied by the dynamic runtime.',
                  {
                    skillId: setSkill.skillId,
                    reasons: effectRuntimeGaps,
                  }
                ),
              ]),
          ...createVisualAcceptanceBlocker(
            setSkillVisual,
            'set-skill-visual-acceptance-not-published',
            'set skill'
          ),
        ],
        evidence: {
          ...setSkill,
          effectMechanics,
          visualAcceptanceManifestHash: setSkillVisual?.manifestHash ?? null,
        },
      })
    );
  }
  return records.sort(compareQualificationRecords);
}

function createCultivationCatalog({
  sources,
  mechanics,
  characterObjects,
  targetKibos,
  publicSoulEssences,
  publicEquipment,
}) {
  const talentRows = sources['newTable:pet_talent_upgrade.json'].value.rows;
  const favorabilityRows = sources['newTable:pet_favorability.json'].value.rows;
  const talentValues = Object.fromEntries(
    [1, 3, 4, 5].map(attributeId => [
      attributeId,
      talentRows
        .filter(row => Number(row.attrId) === attributeId)
        .sort((left, right) => Number(left.level) - Number(right.level))
        .map(row => ({
          level: Number(row.level),
          value: Number(row.InterA),
          nextValue: Number(row.InterB),
          sourceIdentity: `NewTable/pet_talent_upgrade.rows[id=${row.id}]`,
        })),
    ])
  );
  const bondLevels = favorabilityRows
    .slice()
    .sort((left, right) => Number(left.level) - Number(right.level))
    .map(row => ({
      level: Number(row.level),
      inheritanceBasisPoints: Number(row.levelEffect),
      sourceIdentity: `NewTable/pet_favorability.rows[level=${row.level}]`,
    }));
  const runeById = new Map(
    sources['newTable:talent_rune.json'].value.rows.map(row => [
      Number(row.id),
      {
        runeId: Number(row.id),
        attributes: parseAttributePairs(row.runeAttribute),
        skillUpgrade: parseSkillPair(row.runeSkill),
        sourceIdentity: `NewTable/talent_rune.rows[id=${row.id}]`,
      },
    ])
  );
  const sourceCharacterIds = characterObjects.flatMap(
    item => item.sourceCharacterIds
  );
  const productBoundaryByOwnerSkillId = new Map(
    (mechanics.characterCombatProductBoundaries?.entries ?? []).map(entry => [
      `${Number(entry.ownerId)}:${Number(entry.skillId)}`,
      entry,
    ])
  );
  const characterPassiveSkillIdsById = new Map(
    (sources.characters.value.items ?? []).map(character => [
      Number(character.id),
      (character.skillSlots ?? [])
        .filter(slot => slot.group === 'passive')
        .map(slot => Number(slot.skillId)),
    ])
  );
  const positionBySourceCharacterId = new Map(
    characterObjects.flatMap(item =>
      item.sourceCharacterIds.map(characterId => [
        Number(characterId),
        item.position ?? null,
      ])
    )
  );
  const characterProfiles = sourceCharacterIds.map(characterId => ({
    characterId: Number(characterId),
    position: positionBySourceCharacterId.get(Number(characterId)) ?? null,
    starGiftRanks: sources['newTable:talent_rank.json'].value.rows
      .filter(row => Number(row.heroId) === Number(characterId))
      .sort((left, right) => Number(left.rank) - Number(right.rank))
      .map(row => ({
        rank: Number(row.rank),
        attributes: parseAttributePairs(row.attribute),
        nodes: parseIntegerList(row.rankBreakthroughItem).map(
          (runeId, nodeIndex) => ({
            nodeIndex,
            ...(runeById.get(runeId) ?? {
              runeId,
              attributes: [],
              skillUpgrade: null,
              sourceIdentity: null,
            }),
          })
        ),
        sourceIdentity: `NewTable/talent_rank.rows[id=${row.id},heroId=${row.heroId},rank=${row.rank}]`,
      })),
    levelBreakthroughRanks: createLevelBreakthroughRanks(
      sources['newTable:hero_rank.json'].value.rows
        .filter(row => Number(row.heroId) === Number(characterId))
        .sort((left, right) => Number(left.rank) - Number(right.rank)),
      {
        productBoundaryByOwnerSkillId,
        characterPassiveSkillIds:
          characterPassiveSkillIdsById.get(Number(characterId)) ?? [],
      }
    ),
  }));
  const skillLevelsBySkillId = groupBy(
    sources['newTable:skill_level.json'].value.rows,
    row => Number(row.skillId)
  );
  const soulDefinitionById = new Map(
    sources['newTable:soulessence.json'].value.rows.map(row => [
      Number(row.id),
      row,
    ])
  );
  const soulRanksById = groupBy(
    sources['newTable:soulessence_rank.json'].value.rows,
    row => Number(row.relatedId)
  );
  const soulEssenceProfiles = publicSoulEssences.map(item => {
    const definition = soulDefinitionById.get(Number(item.soulEssenceId));
    const effectSkillId = Number(definition?.reishiSkill) || null;
    const rankRows = (soulRanksById.get(Number(item.soulEssenceId)) ?? [])
      .slice()
      .sort((left, right) => Number(left.rank) - Number(right.rank));
    const starLevels = (skillLevelsBySkillId.get(effectSkillId) ?? [])
      .slice()
      .sort((left, right) => Number(left.level) - Number(right.level))
      .map(row => ({
        star: Number(row.level),
        skillLevel: Number(row.level),
        sourceIdentity: `NewTable/skill_level.rows[id=${row.id},skillId=${row.skillId},level=${row.level}]`,
      }));
    return {
      soulEssenceId: Number(item.soulEssenceId),
      profession: item.profession ? String(item.profession).trim() : null,
      rarity: Number(definition?.rarity) || null,
      maximumLevel: Number(item.maximumLevel) || null,
      ranks: rankRows.map(row => ({
        rank: Number(row.rank),
        levelLimit: Number(row.rankLevelLimit),
        sourceIdentity: `NewTable/soulessence_rank.rows[id=${row.id},relatedId=${row.relatedId},rank=${row.rank}]`,
      })),
      effectSkill: {
        skillId: effectSkillId,
        starLevels,
        status:
          starLevels.length === 4 &&
          starLevels.every((row, index) => row.star === index + 1)
            ? (item.effectMechanics?.runtimeStatus ??
              'source-indexed-runtime-unapplied')
            : 'static-evidence-gap',
        mechanismFamily: item.effectMechanics?.mechanismFamily ?? null,
        catalogDefinitionHash: item.effectMechanics
          ? hashCanonicalValue(item.effectMechanics)
          : null,
        sourceIdentity: `NewTable/soulessence.rows[id=${item.soulEssenceId}].reishiSkill`,
      },
      sourceIdentity: item.sourceIdentity,
    };
  });
  const equipmentBySlot = Object.fromEntries(
    Object.values(EQUIPMENT_SLOT_BY_TYPE).map(slot => [
      slot,
      publicEquipment
        .filter(item => item.slot === slot)
        .map(item => item.equipmentId),
    ])
  );
  const equipmentScoreFormula = sources['newTable:game.json'].value.rows.find(
    row => row.title === 'EQUIPMENT_SCORE_FORMULA_PARAM'
  );
  const equipmentScoreFormulaParameters = String(
    equipmentScoreFormula?.value ?? ''
  )
    .split('|')
    .filter(Boolean)
    .map(Number);
  const fixedOptimizationProfile = {
    character: {
      level: 80,
      starGiftRank: 7,
      completedStarGiftAttributeRank: 6,
      currentRankNodeSelection: 'all',
    },
    kibo: {
      level: 80,
      talentLevelsByAttributeId: { 1: 10, 3: 10, 4: 10, 5: 10 },
      resolvedTalentValuesByAttributeId: { 1: 120, 3: 120, 4: 120, 5: 120 },
      bondLevel: 1,
      inheritanceBasisPoints: 900,
      dnaFactors: [],
    },
    soulEssence: { level: 80, rank: 6, star: 1 },
    equipment: {
      rarity: 4,
      enhancementLevel: 9,
      tuningScore: 110,
      instanceTier: 'starborn',
      bGoldSide: true,
      maxValue: 110,
    },
    optimizationEnumeratedDimensions: [],
  };
  return {
    schemaVersion: 1,
    contractName: 'AzPrOptimizationCultivationCatalog',
    fixedOptimizationProfile: {
      ...fixedOptimizationProfile,
      fixedProfileHash: hashCanonicalValue(fixedOptimizationProfile),
    },
    character: {
      optimizationObjectIds: characterObjects.map(
        item => item.optimizationObjectId
      ),
      level: { minimum: 1, maximum: 100 },
      starGiftRank: { minimum: 0, maximum: 7 },
      starGiftNodes: {
        status:
          'source-indexed-current-rank-nodes-applied-prior-rank-attributes-applied',
        sourceIdentity: 'NewTable/talent_rank|NewTable/talent_rune',
      },
      levelBreakthrough: {
        status: 'not-applicable-unimplemented-dead-config',
        levelTemplateIncludesBreakthroughAttributes: 'not-applicable',
        applicationMode: 'not-applicable',
        attributeApplicationStatus: 'not-applicable',
        skillUnlockMode: 'not-applicable',
        productDecision: HERO_RANK_PRODUCT_DECISION,
        sourceIdentity:
          'NewTable/hero_rank.rankLevelLimit|attribute|skill|scripts/optimization-qualification/evidence/hero-rank-runtime-evidence.json',
        runtimeEvidence: structuredClone(sources.heroRankRuntimeEvidence.value),
      },
      profiles: characterProfiles,
    },
    kibo: {
      kiboIds: targetKibos.map(item => item.kiboId),
      level: { minimum: 1, maximum: 100 },
      coreTalentAttributeIds: [1, 3, 4, 5],
      talentLevel: { minimum: 1, maximum: 20 },
      talentValues,
      dnaFactors: {
        status: KIBO_DNA_PRODUCT_SCOPE.status,
        reason: KIBO_DNA_PRODUCT_SCOPE.reason,
        normalizedValue: [],
        acceptedInput: 'empty-only',
        nonEmptyInputCode:
          'machine-axis-cultivation-kibo-dna-unsupported-in-current-version',
      },
      bondLevel: { minimum: 1, maximum: 10 },
      bondLevels,
      initialEffectiveBondLevel: 1,
      initialInheritanceBasisPoints: 900,
    },
    soulEssence: {
      soulEssenceIds: publicSoulEssences.map(item => item.soulEssenceId),
      level: { minimum: 1, maximum: 100 },
      rank: { minimum: 1, maximum: 6 },
      star: { minimum: 1, maximum: 4 },
      profiles: soulEssenceProfiles,
      effectStatus: {
        status: publicSoulEssences.every(
          item => item.effectMechanics?.runtimeStatus === 'runtime-applied'
        )
          ? 'runtime-applied'
          : 'partially-runtime-applied',
        runtimeAppliedCount: publicSoulEssences.filter(
          item => item.effectMechanics?.runtimeStatus === 'runtime-applied'
        ).length,
        unresolvedCount: publicSoulEssences.filter(
          item => item.effectMechanics?.runtimeStatus !== 'runtime-applied'
        ).length,
      },
    },
    equipment: {
      equipmentIdsBySlot: equipmentBySlot,
      profiles: publicEquipment.map(item => ({
        equipmentId: item.equipmentId,
        slot: item.slot,
        setId: item.setId,
        rarity: item.rarity,
        maximumEnhancementLevel: item.maximumLevel,
        sourceIdentity: item.sourceIdentity,
      })),
      rarity: { minimum: 1, maximum: 4 },
      enhancementLevelByRarity: {
        1: { minimum: 0, maximum: 0 },
        2: { minimum: 0, maximum: 3 },
        3: { minimum: 0, maximum: 6 },
        4: { minimum: 0, maximum: 9 },
      },
      tuningScore: {
        minimum: 0,
        maximumFromCurrentTable: 80,
        ordinaryMaximum: 100,
        starbornMaximum: 110,
        status: 'source-indexed-instance-runtime-applied',
        sourceIdentity:
          'IL2CPP/Azur.Gameplay.UI.AccessoryData.score|bGoldSide|maxValue|ResourcesLang/chs/Table/lang_words.json#id=-2424279961521123336',
      },
      tuningFormula: {
        status:
          equipmentScoreFormulaParameters.length === 4 &&
          equipmentScoreFormulaParameters.every(Number.isFinite)
            ? 'source-indexed-static-runtime-applied'
            : 'evidence-insufficient',
        parameters: equipmentScoreFormulaParameters,
        expression: 'ceil(base*0.85)+ceil(base*0.6*0.0125*(tuningScore-20))',
        sourceIdentity:
          'NewTable/game.rows[title=EQUIPMENT_SCORE_FORMULA_PARAM]',
      },
      instanceEvidence: {
        runtimeFields: structuredClone(
          sources.il2cppRuntimeContracts.value.equipmentInstance
        ),
        productTerms: structuredClone(sources.equipmentInstanceTerms.value),
      },
      instanceTiers: [
        {
          identity: 'normal',
          bGoldSide: false,
          maximum: 100,
          maximumRule: 'less-than-or-equal',
          sourceIdentity:
            'IL2CPP/Azur.Gameplay.UI.AccessoryData.bGoldSide|maxValue|ResourcesLang/chs/Table/lang_words.json#id=-2424279961521123336',
        },
        {
          identity: 'starborn',
          bGoldSide: true,
          maximum: 110,
          maximumRule: 'exact',
          sourceIdentity:
            'IL2CPP/Azur.Gameplay.UI.AccessoryData.bGoldSide|maxValue|ResourcesLang/chs/Table/lang_words.json#id=-2424279961521123336',
        },
      ],
    },
  };
}

function createBindingMatrix({
  characterObjects,
  targetKibos,
  publicSoulEssences,
  publicEquipment,
  setSkills,
  manifests,
}) {
  const manifestByKey = new Map(
    manifests.map(record => [`${record.objectKind}:${record.objectId}`, record])
  );
  const actorKibo = characterObjects.flatMap(actor =>
    targetKibos.map(kibo => ({
      actorObjectId: String(actor.optimizationObjectId),
      kiboId: kibo.kiboId,
      compatible: true,
      qualificationReady:
        manifestByKey.get(`character:${actor.optimizationObjectId}`)
          ?.optimizationReady === true &&
        manifestByKey.get(`kibo:${kibo.kiboId}`)?.optimizationReady === true,
      runtimeOwnerIdentity: 'actorSlotId+kiboId',
    }))
  );
  const actorSoulEssence = characterObjects.flatMap(actor =>
    publicSoulEssences.map(soul => {
      const compatible = !soul.profession || soul.profession === actor.position;
      return {
        actorObjectId: String(actor.optimizationObjectId),
        soulEssenceId: soul.soulEssenceId,
        compatible,
        reason: compatible
          ? soul.profession
            ? 'profession-match'
            : 'universal-profession'
          : 'profession-mismatch',
        qualificationReady:
          compatible &&
          manifestByKey.get(`character:${actor.optimizationObjectId}`)
            ?.optimizationReady === true &&
          manifestByKey.get(`soul-essence:${soul.soulEssenceId}`)
            ?.optimizationReady === true,
      };
    })
  );
  const actorEquipment = characterObjects.flatMap(actor =>
    publicEquipment.map(item => ({
      actorObjectId: String(actor.optimizationObjectId),
      equipmentId: item.equipmentId,
      slot: item.slot,
      setId: item.setId,
      compatible: true,
      reason: 'public-equipment-slot-contract',
      qualificationReady:
        manifestByKey.get(`character:${actor.optimizationObjectId}`)
          ?.optimizationReady === true &&
        manifestByKey.get(`equipment:${item.equipmentId}`)
          ?.optimizationReady === true,
    }))
  );
  const setSkillThresholds = setSkills.map(item => ({
    setId: item.setId,
    pieces: item.pieces,
    skillId: item.skillId,
    qualificationReady:
      manifestByKey.get(`set-skill:${item.setId}:${item.pieces}`)
        ?.optimizationReady === true,
    sourceIdentity: item.sourceIdentity,
  }));
  return {
    policy: {
      duplicateKiboSpeciesAcrossDifferentActors: 'allowed',
      sameActorSlotDuplicateKiboBinding: 'not-applicable-one-kibo-per-slot',
      kiboCooldownOwnerIdentity: 'actorSlotId+kiboId',
      sourceIdentity: 'product-contract:m11-r1-duplicate-kibo-slot-runtime',
    },
    actorKibo,
    actorSoulEssence,
    actorEquipment,
    setSkillThresholds,
    equipmentSlots: Object.fromEntries(
      Object.values(EQUIPMENT_SLOT_BY_TYPE).map(slot => [
        slot,
        publicEquipment
          .filter(item => item.slot === slot)
          .map(item => item.equipmentId),
      ])
    ),
    summary: {
      actorKiboEdgeCount: actorKibo.length,
      actorKiboQualifiedEdgeCount: actorKibo.filter(
        edge => edge.qualificationReady
      ).length,
      actorSoulEssenceEdgeCount: actorSoulEssence.length,
      actorSoulEssenceCompatibleEdgeCount: actorSoulEssence.filter(
        edge => edge.compatible
      ).length,
      actorSoulEssenceQualifiedEdgeCount: actorSoulEssence.filter(
        edge => edge.qualificationReady
      ).length,
      actorEquipmentEdgeCount: actorEquipment.length,
      actorEquipmentQualifiedEdgeCount: actorEquipment.filter(
        edge => edge.qualificationReady
      ).length,
      setSkillThresholdCount: setSkillThresholds.length,
      setSkillThresholdQualifiedCount: setSkillThresholds.filter(
        edge => edge.qualificationReady
      ).length,
      equipmentSlotCount: Object.keys(EQUIPMENT_SLOT_BY_TYPE).length,
    },
  };
}

function createQualificationCatalog({
  roster,
  manifestDocument,
  gapDocument,
  bindingDocument,
  cultivationCatalog,
}) {
  const records = manifestDocument.records.map(record => ({
    objectKind: record.objectKind,
    objectId: record.objectId,
    displayName: record.displayName,
    maturityState: record.maturityState,
    optimizationReady: record.optimizationReady,
    blockerCodes: record.blockers.map(item => item.code),
    manifestHash: record.manifestHash,
  }));
  const admission = {
    characters: records
      .filter(
        record => record.objectKind === 'character' && record.optimizationReady
      )
      .map(record => record.objectId),
    kibos: records
      .filter(
        record => record.objectKind === 'kibo' && record.optimizationReady
      )
      .map(record => Number(record.objectId)),
    soulEssences: records
      .filter(
        record =>
          record.objectKind === 'soul-essence' && record.optimizationReady
      )
      .map(record => Number(record.objectId)),
    equipment: records
      .filter(
        record => record.objectKind === 'equipment' && record.optimizationReady
      )
      .map(record => Number(record.objectId)),
    setSkills: records
      .filter(
        record => record.objectKind === 'set-skill' && record.optimizationReady
      )
      .map(record => record.objectId),
  };
  const embeddedBindingMatrix = structuredClone(bindingDocument);
  const stageGate = deriveOptimizationQualificationStageGate({
    records,
    admission,
    denominators: roster.denominators,
    bindingMatrix: embeddedBindingMatrix,
  });
  const value = {
    schemaVersion: 1,
    contractName: 'AzPrOptimizationQualificationCatalog',
    kind: 'azpr-optimization-qualification-catalog',
    generatedAt: OPTIMIZATION_QUALIFICATION_GENERATED_AT,
    rosterHash: roster.rosterHash,
    manifestsHash: manifestDocument.manifestsHash,
    gapLedgerHash: gapDocument.ledgerHash,
    bindingMatrixHash: bindingDocument.bindingMatrixHash,
    sourceSnapshotHash: roster.sourceSnapshot.sourceSnapshotHash,
    denominators: roster.denominators,
    records,
    admission,
    bindingMatrix: embeddedBindingMatrix,
    cultivation: cultivationCatalog,
    summary: {
      ...manifestDocument.summary,
      gameplayBlockingGapCount: gapDocument.summary.blockingUniqueGapCount,
      bindingQualifiedEdgeCount:
        bindingDocument.summary.actorKiboQualifiedEdgeCount +
        bindingDocument.summary.actorSoulEssenceQualifiedEdgeCount +
        bindingDocument.summary.actorEquipmentQualifiedEdgeCount +
        bindingDocument.summary.setSkillThresholdQualifiedCount,
      qualificationStage: stageGate,
      formalOptimizationUnlocked: stageGate.formalOptimizationUnlocked,
      m12cLocked: stageGate.m12cLocked,
    },
  };
  return finalizeHash(value, 'catalogHash');
}

function createSummary({
  roster,
  manifestDocument,
  gapDocument,
  bindingDocument,
  catalog,
}) {
  return {
    phase: 'M12-B3-E16',
    status: 'b3-e16-implemented',
    denominators: roster.denominators,
    sourceSnapshotHash: roster.sourceSnapshot.sourceSnapshotHash,
    rosterHash: roster.rosterHash,
    manifestsHash: manifestDocument.manifestsHash,
    ledgerHash: gapDocument.ledgerHash,
    bindingMatrixHash: bindingDocument.bindingMatrixHash,
    catalogHash: catalog.catalogHash,
    maturityCounts: manifestDocument.summary.maturityCounts,
    optimizationReadyCounts: manifestDocument.summary.optimizationReadyCounts,
    gapCounts: gapDocument.summary,
    m12cLocked: catalog.summary.m12cLocked,
  };
}

function createLevelBreakthroughRanks(
  rows,
  { productBoundaryByOwnerSkillId, characterPassiveSkillIds }
) {
  return rows.map((row, index) => {
    const unlockedSkillId = positiveIntegerOrNull(row.skill);
    const ownerId = Number(row.heroId);
    const skillBelongsToCharacter = unlockedSkillId
      ? characterPassiveSkillIds.includes(unlockedSkillId)
      : true;
    const productBoundary = unlockedSkillId
      ? productBoundaryByOwnerSkillId.get(`${ownerId}:${unlockedSkillId}`)
      : null;
    return {
      rank: Number(row.rank),
      minimumLevel: index === 0 ? 1 : Number(rows[index - 1].rankLevelLimit),
      levelLimit: Number(row.rankLevelLimit),
      attributes: parseAttributePairs(row.attribute),
      unlockedSkillId,
      ...(unlockedSkillId
        ? {
            skillUnlock: {
              skillId: unlockedSkillId,
              declarationStatus: 'source-indexed-table-declaration',
              availabilityStatus: 'not-applicable',
              effectRuntimeStatus: 'not-applicable',
              ...(!skillBelongsToCharacter
                ? {
                    reason: 'hero-rank-skill-id-not-in-character-passive-slots',
                    expectedPassiveSkillIds: [...characterPassiveSkillIds],
                  }
                : {}),
              ...(productBoundary
                ? {
                    reason: productBoundary.reason,
                    productBoundaryIdentity: productBoundary.boundaryIdentity,
                  }
                : {}),
              productDecision: HERO_RANK_PRODUCT_DECISION.decision,
            },
          }
        : {}),
      runtimeApplicationStatus: 'not-applicable-unimplemented-dead-config',
      sourceIdentity: `NewTable/hero_rank.rows[id=${row.id},heroId=${row.heroId},rank=${row.rank}]`,
    };
  });
}

function projectCharacterOptimizationObject(character) {
  return {
    optimizationObjectId: String(character.id),
    displayName: character.name,
    sourceCharacterIds: [Number(character.id)],
    sourceNames: [character.name],
    elements: splitTags(character.element?.abbrName),
    position: character.position?.name ?? null,
    weaponType: character.weaponType?.name ?? null,
    mechanismHash: hashCanonicalValue(
      projectCharacterSourceMechanics(character)
    ),
    sourceIdentity: `generated/characters.json#items[id=${character.id}]`,
  };
}

function projectCharacterSourceMechanics(character) {
  return {
    rarity: character.rarity,
    position: character.position,
    element: character.element,
    weaponType: character.weaponType,
    battleTags: character.battleTags,
    cost: character.cost,
    baseAttributes: character.property?.baseAttributes ?? [],
    skillSlots: (character.skillSlots ?? []).map(slot => ({
      group: slot.group,
      slot: slot.slot,
      skillId: Number(slot.skillId),
    })),
  };
}

function projectStarbornMechanics(character) {
  const ownerPrefix = Number(character.id) * 100;
  const normalizeSkillId = skillId => {
    const numericSkillId = Number(skillId);
    return Math.trunc(numericSkillId / 100) === Number(character.id)
      ? { ownerSkillSuffix: numericSkillId - ownerPrefix }
      : { sharedSkillId: numericSkillId };
  };
  return {
    rarity: character.rarity,
    position: character.position,
    element: character.element,
    weaponType: character.weaponType,
    battleTags: character.battleTags,
    cost: character.cost,
    baseAttributes: character.property?.baseAttributes ?? [],
    skillIds: (character.skillIds ?? []).map(normalizeSkillId),
    skillSlots: (character.skillSlots ?? []).map(slot => ({
      group: slot.group,
      slot: slot.slot,
      skillIdentity: normalizeSkillId(slot.skillId),
    })),
  };
}

function projectKiboRosterRecord(kibo) {
  const actions = (kibo.skills ?? []).filter(skill =>
    ['signature', 'active', 'break'].includes(skill.kind)
  );
  return {
    kiboId: Number(kibo.id),
    name: kibo.name,
    elements: splitTags(kibo.element),
    elementClass: splitTags(kibo.element).length === 1 ? 'single' : 'dual',
    race: kibo.race ?? null,
    stage: kibo.stage ?? null,
    actionCount: actions.length,
    actions: actions.map(action => ({
      publicActionId: Number(action.skillId),
      actionKind: action.kind,
      name: action.name ?? null,
    })),
    pvePassiveSkillIds: (kibo.sourceSkills?.fixedSkillIds ?? []).filter(
      skillId => Number(skillId) >= 520000 && Number(skillId) < 530000
    ),
    sourceIdentity: `generated/kibos.json#items[id=${kibo.id}]`,
  };
}

function projectSoulEssenceRosterRecord(item, profile) {
  return {
    soulEssenceId: Number(item.id),
    name: item.name,
    rarity: item.rarity ?? null,
    profession: item.profession ?? null,
    effectSkillName: item.skill?.name ?? null,
    maximumLevel: profile?.maximumLevel ?? null,
    maximumRank: profile?.maximumRank ?? null,
    staticProfileApplied: profile?.applied === true,
    effectSkillId: profile?.effectSkill?.skillId ?? null,
    effectStatus: profile?.effectSkill?.status ?? 'profile-missing',
    sourceIdentity: profile?.sourceIdentity ?? null,
  };
}

function projectEquipmentRosterRecord(item, profile) {
  const slot = slotFromEquipmentType(item.type, profile?.slotType);
  return {
    equipmentId: Number(item.id),
    name: item.name,
    slot,
    rarity: parseRarity(item.rarity),
    setName: item.set || null,
    setId: profile?.setId ?? null,
    maximumLevel: profile?.maximumLevel ?? null,
    fixedSubAttributeCount: (profile?.subAttributes ?? []).filter(
      attribute => attribute.status === 'verified-fixed-sub-attribute'
    ).length,
    variableSubAttributeCount: (profile?.subAttributes ?? []).filter(
      attribute => attribute.minimum !== attribute.maximum
    ).length,
    staticProfileApplied: profile?.applied === true,
    sourceIdentity: profile?.sourceIdentity ?? null,
  };
}

function projectSetSkillRosterRecord(record) {
  return {
    setId: Number(record.setId),
    pieces: Number(record.pieces),
    skillId: Number(record.skillId),
    status: record.status,
    appliedToStaticPanel: record.appliedToStaticPanel === true,
    sourceIdentity: record.sourceIdentity,
  };
}

function qualificationRecord({
  objectKind,
  objectId,
  displayName,
  sourceIdentities,
  maturityState,
  blockers,
  evidence,
}) {
  const value = {
    objectKind,
    objectId: String(objectId),
    displayName,
    sourceIdentities,
    maturityState,
    optimizationReady:
      blockers.length === 0 && maturityState === 'optimization-ready',
    blockers,
    evidence,
  };
  return { ...value, manifestHash: hashCanonicalValue(value) };
}

function blocker(code, category, message, details = {}) {
  return { code, category, message, ...details };
}

function createVisualAcceptanceBlocker(
  visualEntry,
  notPublishedCode,
  subjectName,
  notReadyCode = 'acceptance-product-visual-signoff-pending'
) {
  if (!visualEntry) {
    return [
      blocker(
        notPublishedCode,
        'not-implemented',
        `No product visual acceptance manifest exists for this ${subjectName}.`
      ),
    ];
  }
  if (visualEntry.optimizationReady !== true) {
    return [
      blocker(
        notReadyCode,
        'not-implemented',
        notReadyCode === 'kibo-visual-acceptance-evidence-blocked'
          ? 'Kibo visual acceptance manifest is published but headless maturity or runtime evidence remains blocked.'
          : 'Visual acceptance manifest is published but product signoff or blocking evidence remains.',
        {
          manifestHash: visualEntry.manifestHash ?? null,
          manifestBlockers: visualEntry.blockers ?? [],
        }
      ),
    ];
  }
  return [];
}

function createGapLedger(manifests) {
  return manifests.flatMap(manifest =>
    manifest.blockers.map(item => {
      const value = {
        gapIdentity: `${manifest.objectKind}:${manifest.objectId}:${item.code}`,
        objectKind: manifest.objectKind,
        objectId: manifest.objectId,
        code: item.code,
        category: item.category,
        blocking: true,
        message: item.message,
        sourceIdentities: manifest.sourceIdentities,
        details: Object.fromEntries(
          Object.entries(item).filter(
            ([key]) => !['code', 'category', 'message'].includes(key)
          )
        ),
      };
      return { ...value, gapHash: hashCanonicalValue(value) };
    })
  );
}

function createImplementationCapabilities({
  roster,
  cultivationCatalog,
  bindingDocument,
}) {
  return [
    {
      capabilityIdentity: 'b3-frozen-roster-and-source-drift-gate',
      status: 'implemented',
      evidence: [roster.sourceSnapshot.sourceSnapshotHash, roster.rosterHash],
    },
    {
      capabilityIdentity: 'b3-starborn-single-object-alias-normalization',
      status: 'implemented',
      evidence: [roster.starborn.normalizedMechanismHash],
    },
    {
      capabilityIdentity: 'b3-strict-cultivation-schema-and-canonical-hash',
      status: 'implemented',
      evidence: [
        'schemas/azpr-optimization-cultivation-profile-v1.schema.json',
      ],
    },
    {
      capabilityIdentity: 'b3-supported-cultivation-static-runtime-projection',
      status: 'implemented',
      evidence: [
        'src/optimization-qualification/optimizationQualificationProtocol.js',
        'src/simulation/mechanics/verifiedCombatStaticProperties.js',
      ],
    },
    {
      capabilityIdentity:
        'b3-character-star-gift-projection-with-hero-rank-dead-config',
      status: 'implemented',
      evidence: [
        cultivationCatalog.character.starGiftNodes.sourceIdentity,
        cultivationCatalog.character.levelBreakthrough.sourceIdentity,
        'src/simulation/mechanics/verifiedCombatStaticProperties.js',
      ],
    },
    {
      capabilityIdentity: 'b3-hero-rank-unimplemented-dead-config-closure',
      status: 'implemented',
      evidence: [
        cultivationCatalog.character.levelBreakthrough.productDecision.decision,
        cultivationCatalog.character.levelBreakthrough.runtimeEvidence
          .productDecision.decision,
        'scripts/optimization-qualification/evidence/hero-rank-runtime-evidence.json',
      ],
    },
    {
      capabilityIdentity: 'b3-hero-rank-legality-and-evidence-boundary',
      status: 'implemented',
      evidence: [
        cultivationCatalog.character.levelBreakthrough.sourceIdentity,
        cultivationCatalog.character.levelBreakthrough.runtimeEvidence
          .reviewedBinary.sha256,
        'scripts/optimization-qualification/evidence/hero-rank-runtime-evidence.json',
      ],
    },
    {
      capabilityIdentity: 'b3-kibo-four-talent-source-mapping',
      status: 'implemented',
      evidence: [
        cultivationCatalog.kibo.talentValues['1'].find(row => row.level === 10)
          .sourceIdentity,
      ],
    },
    {
      capabilityIdentity: 'b3-kibo-dna-empty-only-product-scope',
      status:
        cultivationCatalog.kibo.dnaFactors.status === 'not-applicable' &&
        cultivationCatalog.kibo.dnaFactors.acceptedInput === 'empty-only'
          ? 'implemented'
          : 'not-implemented',
      evidence: [
        'schemas/azpr-optimization-cultivation-profile-v1.schema.json',
        'schemas/azpr-machine-axis-v1.schema.json',
      ],
    },
    {
      capabilityIdentity: 'b3-soulessence-star-skill-level-source-index',
      status: cultivationCatalog.soulEssence.profiles.every(
        profile =>
          profile.effectSkill.status === 'source-indexed-runtime-unapplied'
      )
        ? 'implemented'
        : 'evidence-insufficient',
      evidence: [
        'NewTable/soulessence.reishiSkill',
        'NewTable/skill_level.rows[skillId=reishiSkill,level=1..4]',
      ],
    },
    {
      capabilityIdentity: 'b3-kibo-bond-level-one-nine-percent',
      status: 'implemented',
      evidence: [cultivationCatalog.kibo.bondLevels[0].sourceIdentity],
    },
    {
      capabilityIdentity: 'b3-equipment-tuning-formula-source-index',
      status:
        cultivationCatalog.equipment.tuningFormula.status ===
        'source-indexed-static-runtime-applied'
          ? 'implemented'
          : 'evidence-insufficient',
      evidence: [cultivationCatalog.equipment.tuningFormula.sourceIdentity],
    },
    {
      capabilityIdentity: 'b3-equipment-instance-tier-runtime',
      status:
        cultivationCatalog.equipment.tuningScore.status ===
        'source-indexed-instance-runtime-applied'
          ? 'implemented'
          : 'evidence-insufficient',
      evidence: cultivationCatalog.equipment.instanceTiers.map(
        entry => entry.sourceIdentity
      ),
    },
    {
      capabilityIdentity: 'b3-duplicate-kibo-species-slot-runtime-binding',
      status: 'implemented',
      evidence: [bindingDocument.policy.sourceIdentity],
    },
    {
      capabilityIdentity: 'b3-formal-catalog-hard-rejection',
      status: 'implemented',
      evidence: [
        'src/optimization-qualification/optimizationQualificationProtocol.js',
      ],
    },
  ];
}

function summarizeManifests(records) {
  return {
    objectCount: records.length,
    maturityCounts: countBy(records, record => record.maturityState),
    optimizationReadyCounts: Object.fromEntries(
      ['character', 'kibo', 'soul-essence', 'equipment', 'set-skill'].map(
        kind => [
          kind,
          records.filter(
            record => record.objectKind === kind && record.optimizationReady
          ).length,
        ]
      )
    ),
    optimizationReadyTotal: records.filter(record => record.optimizationReady)
      .length,
  };
}

function summarizeGaps(records) {
  return {
    blockingUniqueGapCount: records.filter(record => record.blocking).length,
    byCategory: countBy(records, record => record.category),
    byCode: countBy(records, record => record.code),
    byObjectKind: countBy(records, record => record.objectKind),
  };
}

function createSourceSnapshot(sources) {
  const files = Object.fromEntries(
    Object.entries(sources).map(([key, source]) => {
      const record = {
        path: source.path,
        sha256: source.sha256,
        bytes: source.bytes,
      };
      if (
        key === 'heroRankRuntimeEvidence' ||
        key === 'soulEffectGetElementRuntimeEvidence' ||
        key === 'soulEffectGetElementTypeRuntimeEvidence' ||
        key === 'soulEffectBeforeDamageRuntimeEvidence' ||
        key === 'soulEffectNonDamageRuntimeEvidence' ||
        key === 'landedHitRecoveryRuntimeEvidence' ||
        key === 'persistentLoadoutPropertyRuntimeEvidence' ||
        key === 'periodicPersistentPropertyRuntimeEvidence' ||
        key === 'fourPieceSetStackRuntimeEvidence' ||
        key === 'beforeSkillCompositeRuntimeEvidence' ||
        key === 'afterDamageTargetPropertyRuntimeEvidence' ||
        key === 'soulessenceAfterDamageEmptyConditionRuntimeEvidence' ||
        key === 'soulessenceActivationConditionRuntimeEvidence' ||
        key === 'battlePropertyTagMatchingRuntimeEvidence' ||
        key === 'soulEffectKillCriticalEventRuntimeEvidence' ||
        key === 'elementFormula' ||
        key === 'setThreeSourceIdentityEvidence'
      ) {
        record.value = structuredClone(source.value);
      }
      return [key, record];
    })
  );
  return {
    files,
    sourceSnapshotHash: hashCanonicalValue(files),
  };
}

function createMarkdownSummary(summary, catalog) {
  const ready = summary.optimizationReadyCounts;
  const gapCounts = summary.gapCounts.byCategory;
  return (
    '# M12-B3-E16 Qualification Baseline With Set Closure\n\n' +
    `- Status: \`${summary.status}\`\n` +
    `- Source snapshot: \`${summary.sourceSnapshotHash}\`\n` +
    `- Roster: \`${summary.rosterHash}\`\n` +
    `- Catalog: \`${summary.catalogHash}\`\n` +
    `- Denominators: characters ${summary.denominators.characterOptimizationObjects}, Kibo ${summary.denominators.kibos}, soul essence ${summary.denominators.soulEssences}, equipment ${summary.denominators.equipment}, set skills ${summary.denominators.setSkills}\n` +
    `- Optimization ready: characters ${ready.character}, Kibo ${ready.kibo}, soul essence ${ready['soul-essence']}, equipment ${ready.equipment}, set skills ${ready['set-skill']}\n` +
    `- Blocking gaps: not implemented ${gapCounts['not-implemented'] ?? 0}, evidence insufficient ${gapCounts['evidence-insufficient'] ?? 0}\n` +
    '- Implemented baseline capabilities: frozen source drift gate, STARBORN alias normalization, strict cultivation schema/hash, completed star-gift static projection, hero_rank closed as unimplemented dead config (no cultivation state/value effect; optimizer input not required), Kibo talent/bond with canonical empty-only DNA, soul-essence star skill-level resolution, source-backed normal/starborn equipment instances, segmented tuning formula, duplicate-Kibo slot identity, formal whole-stage rejection, and the first source-closed hit-after-damage loadout effect family.\n' +
    '- Dynamic loadout batches: C2-C16 retain their accepted trigger, transaction, ordering, healing, persistent-root, four-piece, target-debuff, periodic-root, and PVE passive contracts. E21 resolves set-skill:3:4 against the current executable graph: the permanent MAXHP +2% root is runtime-applied, the every-five-received-hits MAXHP +5% branch is retained as a sourced scenario N/A for the passive-Boss trial, and all 12/12 set skills are optimization-ready.\n' +
    `- STARBORN alias mechanism hash: \`${catalog.records.find(record => record.objectId === 'STARBORN')?.manifestHash ?? 'missing'}\` (source aliases 199001/199002 are one optimization object)\n` +
    '- Duplicate Kibo species across different actor slots: allowed; runtime owner is `actorSlotId+kiboId`.\n' +
    '- M12-C remains locked. This baseline does not run team, loadout, or axis search.\n'
  );
}

async function readSource(sourcePath, projectRoot) {
  const bytes = await fs.readFile(sourcePath);
  return {
    path: normalizeSourcePath(sourcePath, projectRoot),
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    value: JSON.parse(bytes.toString('utf8')),
  };
}

async function readEquipmentInstanceTermsSource(sourcePath, projectRoot) {
  const bytes = await fs.readFile(sourcePath);
  const text = bytes.toString('utf8');
  const sourceId = '-2424279961521123336';
  const value = '缘星装备固定拥有110的同调评分上限，普通装备上限最多为100';
  if (!text.includes(`"id": ${sourceId}`) || !text.includes(value)) {
    throw new Error(
      'optimization-qualification-equipment-instance-terms-missing'
    );
  }
  return {
    path: normalizeSourcePath(sourcePath, projectRoot),
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    value: {
      rowId: sourceId,
      value,
      ordinaryMaximum: 100,
      starbornMaximum: 110,
    },
  };
}

async function readIl2CppRuntimeContractsSource(sourcePath, projectRoot) {
  const bytes = await fs.readFile(sourcePath);
  const text = bytes.toString('utf8');
  const heroDataBlock = extractIl2CppTypeBlock(text, {
    namespace: 'Azur.Gameplay.PlayerModule',
    declaration:
      'public class HeroData : IStoreData<HeroItemInfo>, IStoreData<HeroAttrInfo>, IStoreData<HeroBattleInfo>, IStoreData<KiboDuelHeroAttrInfo>',
  });
  const attrModuleInfoBlock = extractIl2CppTypeBlock(text, {
    namespace: 'Azur.Gameplay.PlayerModule',
    declaration: 'public class AttrModuleInfo',
  });
  const gameUtilBlock = extractIl2CppTypeBlock(text, {
    namespace: 'Lens.Gameplay.UI.Util',
    declaration: 'public static class GameUtil',
  });
  const skillTagBlock = extractIl2CppTypeBlock(text, {
    namespace: 'Lens.Gameplay.Modules.BigWorld',
    declaration: 'public enum ESkillTagType',
  });
  const heroPetStayTypeBlock = extractIl2CppTypeBlock(text, {
    namespace: 'Gameplay.Modules.BigWorld.Core.Enum',
    declaration: 'public enum EHeroPetStayType',
  });
  const battlePropertyTagBlock = extractIl2CppTypeBlock(text, {
    namespace: 'Lens.Gameplay.Modules.BigWorld',
    declaration: 'public enum EBattlePropertyTag',
  });
  const skillSlotBlock = extractIl2CppTypeBlock(text, {
    namespace: 'Lens.Gameplay.Modules.BigWorld',
    declaration: 'public enum ESkillSlotType',
  });
  const triggerConditionLogicBlock = extractIl2CppTypeBlock(text, {
    namespace: 'Lens.Gameplay.Modules.BigWorld',
    declaration: 'public enum EElementTriggerConditionType',
  });
  const triggerFixedConditionBlock = extractIl2CppTypeBlock(text, {
    namespace: 'Lens.Gameplay.Modules.BigWorld',
    declaration: 'public enum EElementTriggerFixedConditionType',
  });
  const triggerEventTypeBlock = extractIl2CppTypeBlock(text, {
    namespace: 'Lens.Gameplay.Modules.BigWorld',
    declaration: 'public enum EElementTriggerEventType',
  });
  const triggerSourceTargetBlock = extractIl2CppTypeBlock(text, {
    namespace: 'Lens.Gameplay.Modules.BigWorld',
    declaration: 'public enum EElementTriggerTargetType',
  });
  const triggerEffectTargetBlock = extractIl2CppTypeBlock(text, {
    namespace: 'Lens.Gameplay.Modules.BigWorld',
    declaration: 'public enum ETriggerEffectTargetType',
  });
  const buffElementParamsBlock = extractIl2CppTypeBlock(text, {
    namespace: 'Lens.Gameplay.Modules.BigWorld.Config',
    declaration: 'public class TBuffElementParams : TElementParams',
  });
  const battlePropertyTags = createBattlePropertyTagContract({
    sourcePath: normalizeSourcePath(sourcePath, projectRoot),
    skillTagBlock,
    battlePropertyTagBlock,
  });
  const soulEffectTriggers = createSoulEffectTriggerContract({
    sourcePath: normalizeSourcePath(sourcePath, projectRoot),
    skillSlotBlock,
    skillTagBlock,
    heroPetStayTypeBlock,
    triggerConditionLogicBlock,
    triggerFixedConditionBlock,
    triggerEventTypeBlock,
    triggerSourceTargetBlock,
    triggerEffectTargetBlock,
    buffElementParamsBlock,
  });
  const heroRuntimeDeclarations = {
    fields: ['public int lv;', 'public int heroRank;'].map(declaration => ({
      declaration,
      present: heroDataBlock.includes(declaration),
    })),
    methods: [
      createIl2CppMethodRecord({
        identity: 'Azur.Gameplay.PlayerModule.HeroData.Populate(HeroAttrInfo)',
        typeBlock: heroDataBlock,
        declaration: 'public void Populate(HeroAttrInfo heroInfo) { }',
      }),
      createIl2CppMethodRecord({
        identity: 'Azur.Gameplay.PlayerModule.HeroData.Populate(HeroItemInfo)',
        typeBlock: heroDataBlock,
        declaration: 'public void Populate(HeroItemInfo heroInfo) { }',
      }),
      createIl2CppMethodRecord({
        identity: 'Azur.Gameplay.PlayerModule.HeroData.RefreshAttributes',
        typeBlock: heroDataBlock,
        declaration:
          'private void RefreshAttributes(AttrModuleInfo info, Dictionary<int, AttrInfo> attrDict, bool isBattle = False) { }',
      }),
      createIl2CppMethodRecord({
        identity: 'Azur.Gameplay.PlayerModule.HeroData.RefreshHeroSkill',
        typeBlock: heroDataBlock,
        declaration:
          'private void RefreshHeroSkill(AttrModuleInfo info, bool isBattle = False) { }',
      }),
      createIl2CppMethodRecord({
        identity:
          'Azur.Gameplay.PlayerModule.AttrModuleInfo..ctor(HeroAttrInfo)',
        typeBlock: attrModuleInfoBlock,
        declaration: 'public void .ctor(HeroAttrInfo info) { }',
      }),
      createIl2CppMethodRecord({
        identity:
          'Azur.Gameplay.PlayerModule.AttrModuleInfo.RefreshModules(HeroAttrInfo)',
        typeBlock: attrModuleInfoBlock,
        declaration: 'public void RefreshModules(HeroAttrInfo info) { }',
      }),
      createIl2CppMethodRecord({
        identity: 'Lens.Gameplay.UI.Util.GameUtil.PackAttrInfoByFightAttr',
        typeBlock: gameUtilBlock,
        declaration:
          'public static void PackAttrInfoByFightAttr(FightAttr fa, Dictionary<int, AttrInfo> result) { }',
      }),
    ],
  };
  const missingHeroFields = heroRuntimeDeclarations.fields
    .filter(field => !field.present)
    .map(field => field.declaration);
  if (missingHeroFields.length) {
    throw new Error(
      `optimization-qualification-il2cpp-hero-runtime-field-missing:${missingHeroFields.join('|')}`
    );
  }
  const requiredEquipmentFragments = [
    'public class AccessoryData // TypeDefIndex: 16369',
    'public int score;',
    'public bool bGoldSide;',
    'public int maxValue;',
  ];
  const missing = requiredEquipmentFragments.filter(
    fragment => !text.includes(fragment)
  );
  if (missing.length) {
    throw new Error(
      `optimization-qualification-il2cpp-runtime-contract-missing:${missing.join('|')}`
    );
  }
  return {
    path: normalizeSourcePath(sourcePath, projectRoot),
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    value: {
      heroRuntimeDeclarations,
      battlePropertyTags,
      soulEffectTriggers,
      equipmentInstance: {
        fields: ['score', 'bGoldSide', 'maxValue'],
        instanceOwned: true,
      },
    },
  };
}

function createSoulEffectTriggerContract({
  sourcePath,
  skillSlotBlock,
  skillTagBlock,
  heroPetStayTypeBlock,
  triggerConditionLogicBlock,
  triggerFixedConditionBlock,
  triggerEventTypeBlock,
  triggerSourceTargetBlock,
  triggerEffectTargetBlock,
  buffElementParamsBlock,
}) {
  const logicBindings = [
    { value: 0, enumName: 'AND', runtimeLogic: 'and' },
    { value: 1, enumName: 'OR', runtimeLogic: 'or' },
  ].map(binding => {
    assertIl2CppEnumMember({
      block: triggerConditionLogicBlock,
      enumName: 'EElementTriggerConditionType',
      memberName: binding.enumName,
      value: binding.value,
    });
    return {
      ...binding,
      status: 'applied',
      sourceIdentity: `${sourcePath}#EElementTriggerConditionType.${binding.enumName}=${binding.value}`,
    };
  });
  const conditionTypeBindings = [
    {
      value: 8,
      enumName: 'CheckElementType',
      selectorKind: 'event-element-type',
      description: '事件元素类型',
    },
    {
      value: 10,
      enumName: 'HasElementId',
      selectorKind: 'held-element-id',
      description: '任意触发目标拥有元素ID',
    },
    {
      value: 6,
      enumName: 'CheckSkillSlot',
      selectorKind: 'skill-slot',
      description: '事件技能槽位',
    },
    {
      value: 11,
      enumName: 'CheckSkillType',
      selectorKind: 'skill-tag',
      description: '事件技能Tag',
    },
    {
      value: 12,
      enumName: 'CheckTargetElementId',
      selectorKind: 'target-element-id',
      description: 'Target拥有元素ID',
    },
    {
      value: 13,
      enumName: 'CheckElementId',
      selectorKind: 'event-element-id',
      description: '事件元素ID是',
    },
    {
      value: 14,
      enumName: 'CheckSelfStayType',
      selectorKind: 'self-stay-type',
      description: 'Self驻场类型',
    },
  ].map(binding => {
    assertIl2CppEnumMember({
      block: triggerFixedConditionBlock,
      enumName: 'EElementTriggerFixedConditionType',
      memberName: binding.enumName,
      value: binding.value,
      description: binding.description,
    });
    return {
      ...binding,
      status: 'applied',
      sourceIdentity: `${sourcePath}#EElementTriggerFixedConditionType.${binding.enumName}=${binding.value}`,
    };
  });
  const skillSlotBindings = [
    {
      value: 1,
      enumName: 'Attack',
      actionKinds: ['normal-attack'],
      description: '普通攻击',
    },
    {
      value: 4,
      enumName: 'UltraSkill',
      actionKinds: ['ultimate'],
      description: '大招',
    },
  ].map(binding => {
    assertIl2CppEnumMember({
      block: skillSlotBlock,
      enumName: 'ESkillSlotType',
      memberName: binding.enumName,
      value: binding.value,
      description: binding.description,
    });
    return {
      ...binding,
      status: 'applied',
      sourceIdentity: `${sourcePath}#ESkillSlotType.${binding.enumName}=${binding.value}`,
    };
  });
  const skillTagDeclarations = [
    ['NormalAttack', 1, 'normal-attack', '角色普攻'],
    ['WhackAttack', 2, 'charged-attack', '角色重击'],
    ['NormalSkill', 3, 'star-skill', '角色小技能'],
    ['UltraSkill', 4, 'ultimate', '角色大招'],
    ['PetCommandSkill', 5, [], '角色指挥技能'],
    ['Dodge', 6, 'dodge-attack', '角色闪避'],
    ['Jump', 7, 'plunging-attack', '角色跳跃'],
    ['ExitSkill', 8, [], '角色流场技'],
    ['AerialAttack', 9, 'plunging-attack', '角色下落攻击'],
    ['ExtremityAttack', 11, 'limit-counter', '角色极限反击'],
    ['PerfectDodge', 12, 'perfect-parry', '角色完美闪避'],
    ['PetUltraSkill', 14, [], '宠物大招'],
    ['HeroJointStrikeSkill', 17, 'star-combo', '角色合击技能'],
    ['EntrySkill', 22, 'star-carry', '角色入场技', 'switch-triggered-on-enter'],
  ];
  const skillTagBindings = skillTagDeclarations.map(
    ([enumName, value, actionKind, description, provenanceRequirement]) => {
      assertIl2CppEnumMember({
        block: skillTagBlock,
        enumName: 'ESkillTagType',
        memberName: enumName,
        value,
        description,
      });
      return {
        value,
        enumName,
        actionKinds: Array.isArray(actionKind) ? actionKind : [actionKind],
        provenanceRequirement: provenanceRequirement ?? null,
        status: 'applied',
        sourceIdentity: `${sourcePath}#ESkillTagType.${enumName}=${value}`,
      };
    }
  );
  const stayTypeBindings = [
    {
      value: 0,
      enumName: 'Control',
      runtimeKind: 'controlled-actor',
      description: '主控',
    },
  ].map(binding => {
    assertIl2CppEnumMember({
      block: heroPetStayTypeBlock,
      enumName: 'EHeroPetStayType',
      memberName: binding.enumName,
      value: binding.value,
      description: binding.description,
      annotationKind: 'InspectorName',
    });
    return {
      ...binding,
      status: 'applied',
      sourceIdentity: `${sourcePath}#EHeroPetStayType.${binding.enumName}=${binding.value}`,
    };
  });
  const eventBindings = [
    [1, 'BeforeDamage', 'hit-before-damage', '造成伤害前'],
    [2, 'AfterDamage', 'hit-after-damage', '造成伤害后'],
    [5, 'BeforeSkill', 'action-start', '释放技能前'],
    [6, 'AfterSkill', 'action-end', '释放技能后'],
    [9, 'BeforeGetElement', 'element-before-acquire', '获取元素前'],
    [10, 'AfterGetElement', 'element-after-acquire', '获取元素后'],
    [
      25,
      'BeforeCriticalDamage',
      'hit-before-critical-damage',
      '造成暴击伤害前',
    ],
    [34, 'SwitchEnter', 'switch-enter', '切入'],
    [36, 'UnloadSkill', 'loadout-uninstall', '卸载技能'],
    [32, 'KillEvent', 'kill-event', '击杀事件'],
    [40, 'OnGotShield', 'shield-after-acquire', '添加护盾时'],
    [44, 'AfterHeal', 'heal-after-settlement', '造成治疗后'],
  ].map(([value, enumName, frameAnchor, description]) => {
    assertIl2CppEnumMember({
      block: triggerEventTypeBlock,
      enumName: 'EElementTriggerEventType',
      memberName: enumName,
      value,
      description,
      annotationKind: 'InspectorName',
    });
    return {
      value,
      enumName,
      name: enumName,
      frameAnchor,
      status: 'applied',
      sourceIdentity: `${sourcePath}#EElementTriggerEventType.${enumName}=${value}`,
    };
  });
  const triggerTargetBindings = [
    {
      value: 0,
      enumName: 'Self',
      sourceKind: 'equipped-actor-source-events',
      description: '自身',
    },
    {
      value: 2,
      enumName: 'Source',
      sourceKind: 'event-source-actor-events',
      description: '元素来源',
    },
    {
      value: 12,
      enumName: 'Pet',
      sourceKind: 'pet-actor',
      description: '宠物',
    },
    {
      value: 9,
      enumName: 'SelfPet',
      sourceKind: 'self-pet-actor',
      description: '自带宠物',
    },
  ].map(binding => {
    assertIl2CppEnumMember({
      block: triggerSourceTargetBlock,
      enumName: 'EElementTriggerTargetType',
      memberName: binding.enumName,
      value: binding.value,
      description: binding.description,
    });
    return {
      ...binding,
      status: 'applied',
      sourceIdentity: `${sourcePath}#EElementTriggerTargetType.${binding.enumName}=${binding.value}`,
    };
  });
  const targetBindings = [
    {
      value: 0,
      enumName: 'Self',
      targetKind: 'self-actor',
      description: '自身',
    },
    {
      value: 1,
      enumName: 'Target',
      targetKind: 'event-target-actor',
      description: '目标',
    },
    {
      value: 3,
      enumName: 'ControllingHero',
      targetKind: 'controlling-hero',
      description: '当前英雄',
    },
    {
      value: 9,
      enumName: 'Pet',
      targetKind: 'pet-actor',
      description: '宠物',
    },
    {
      value: 15,
      enumName: 'AllHero',
      targetKind: 'team-actors',
      description: '玩家所有角色（不包括联机玩家）',
    },
  ].map(binding => {
    assertIl2CppEnumMember({
      block: triggerEffectTargetBlock,
      enumName: 'ETriggerEffectTargetType',
      memberName: binding.enumName,
      value: binding.value,
      description: binding.description,
    });
    return {
      ...binding,
      status: 'applied',
      sourceIdentity: `${sourcePath}#ETriggerEffectTargetType.${binding.enumName}=${binding.value}`,
    };
  });
  const value = {
    sourceKind: 'il2cpp-soulessence-trigger-contract',
    sourceIdentity: [
      'EElementTriggerConditionType',
      'EElementTriggerFixedConditionType',
      'EElementTriggerEventType',
      'EElementTriggerTargetType',
      'ESkillSlotType',
      'ESkillTagType',
      'EHeroPetStayType',
      'ETriggerEffectTargetType',
    ]
      .map(identity => `${sourcePath}#${identity}`)
      .join('|'),
    logicBindings,
    conditionTypeBindings,
    eventBindings,
    triggerTargetBindings,
    skillSlotBindings,
    skillTagBindings,
    stayTypeBindings,
    targetBindings,
    buffElementWrapper: createBuffElementWrapperContract({
      sourcePath,
      buffElementParamsBlock,
    }),
  };
  return { ...value, contractHash: hashCanonicalValue(value) };
}

function createBuffElementWrapperContract({
  sourcePath,
  buffElementParamsBlock,
}) {
  const fields = [
    'public int time;',
    'public List<TElementParams> injectElementDataList;',
    'public List<TElementParams> notDelElementDataList;',
  ].map(declaration => ({
    declaration,
    present: buffElementParamsBlock.includes(declaration),
  }));
  if (fields.some(field => !field.present)) {
    throw new Error('soulessence-buff-element-wrapper-contract-incomplete');
  }
  return {
    runtimeType: 'TBuffElementParams',
    elementType: 'BuffElement',
    durationField: 'time',
    attachedChildrenField: 'injectElementDataList',
    detachedChildrenField: 'notDelElementDataList',
    fields,
    status: 'applied',
    sourceIdentity: `${sourcePath}#TBuffElementParams.time|injectElementDataList|notDelElementDataList`,
  };
}

export async function readBattlePropertyTagMatchingRuntimeEvidenceSource({
  sourcePath,
  gameAssemblyPath,
  il2CppDumpPath,
  projectRoot,
}) {
  const bytes = await fs.readFile(sourcePath);
  const value = JSON.parse(bytes.toString('utf8'));
  const binaryIdentity = await readBinaryIdentity(gameAssemblyPath);
  const dumpIdentity = await readBinaryIdentity(il2CppDumpPath);
  const binary = await fs.readFile(gameAssemblyPath);
  const dumpText = await fs.readFile(il2CppDumpPath, 'utf8');
  const rangeHashes = Object.fromEntries(
    (value.binaryRanges ?? []).map(record => [
      record.range,
      createHash('sha256')
        .update(readPortableExecutableRvaRange(binary, record.range))
        .digest('hex'),
    ])
  );
  const dumpFragments = [
    ...(value.dumpBindings?.methods ?? []).flatMap(record => [
      `// RVA: ${record.rva}`,
      record.declaration,
    ]),
    ...(value.dumpBindings?.fields ?? []).map(record => record.declaration),
    ...(value.dumpBindings?.enums ?? []).flatMap(record => [
      record.description,
      record.declaration,
    ]),
  ];
  const observations = {
    binaryIdentity,
    dumpIdentity,
    rangeHashes,
    rangeCount: Object.keys(rangeHashes).length,
    dumpFragmentsPresent: dumpFragments.every(fragment =>
      dumpText.includes(fragment)
    ),
  };
  validateBattlePropertyTagMatchingRuntimeEvidence(value, observations);
  return {
    path: normalizeSourcePath(sourcePath, projectRoot),
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    value: {
      ...value,
      verifiedBinary: binaryIdentity,
      verifiedIl2CppDump: dumpIdentity,
    },
    observations,
  };
}

export function validateBattlePropertyTagMatchingRuntimeEvidence(
  value,
  observations
) {
  if (
    value?.contractName !== 'AzPrBattlePropertyTagMatchingRuntimeEvidence' ||
    Number(value?.schemaVersion) !== 1 ||
    value?.conclusion?.status !== 'applied'
  ) {
    throw new Error(
      'optimization-qualification-property-tag-matching-evidence-contract-invalid'
    );
  }
  if (
    Number(value.reviewedBinary?.bytes) !==
      Number(observations?.binaryIdentity?.bytes) ||
    value.reviewedBinary?.sha256 !== observations?.binaryIdentity?.sha256
  ) {
    throw new Error(
      'optimization-qualification-property-tag-matching-evidence-binary-mismatch'
    );
  }
  if (
    Number(value.reviewedIl2CppDump?.bytes) !==
      Number(observations?.dumpIdentity?.bytes) ||
    value.reviewedIl2CppDump?.sha256 !== observations?.dumpIdentity?.sha256 ||
    observations?.dumpFragmentsPresent !== true
  ) {
    throw new Error(
      'optimization-qualification-property-tag-matching-evidence-dump-drift'
    );
  }
  const expectedMethods = [
    {
      identity:
        'Lens.Gameplay.Modules.BigWorld.BattlePropertyData.DynamicBattlePropertyValue.GetValue',
      rva: '0x12D3300',
      declaration: 'public MyFloat GetValue(List<int> tags) { }',
    },
    {
      identity:
        'Lens.Gameplay.Modules.BigWorld.BattlePropertyData.DynamicBattlePropertyValue.SetValue',
      rva: '0x12D34F0',
      declaration: 'public void SetValue(int tag, MyFloat value) { }',
    },
    {
      identity:
        'Lens.Gameplay.Modules.BigWorld.BattlePropertyData.GetPropertyValue',
      rva: '0x12BE540',
      declaration:
        'public MyFloat GetPropertyValue(bool isRatio, List<int> tags) { }',
    },
  ];
  if (
    JSON.stringify(value.dumpBindings?.methods) !==
    JSON.stringify(expectedMethods)
  ) {
    throw new Error(
      'optimization-qualification-property-tag-matching-evidence-method-drift'
    );
  }
  if (
    value.dumpBindings?.fields?.[0]?.identity !==
      'Lens.Gameplay.Modules.BigWorld.BattlePropertyData.DynamicBattlePropertyValue.m_propertyValues' ||
    value.dumpBindings?.fields?.[0]?.declaration !==
      'private Dictionary<int, MyFloat> m_propertyValues; // 0x10'
  ) {
    throw new Error(
      'optimization-qualification-property-tag-matching-evidence-field-drift'
    );
  }
  if (
    value.semantics?.multipleModifierTags !== 'any-overlap-event-driven' ||
    value.semantics?.singleModifierTag !== 'exact-membership-special-case' ||
    value.semantics?.emptyModifierTags !== 'unscoped-base-tag-0' ||
    Number(value.semantics?.baseTag) !== 0
  ) {
    throw new Error(
      'optimization-qualification-property-tag-matching-evidence-semantics-drift'
    );
  }
  for (const evidenceRange of value.binaryRanges ?? []) {
    if (
      observations?.rangeHashes?.[evidenceRange.range] !== evidenceRange.sha256
    ) {
      throw new Error(
        `optimization-qualification-property-tag-matching-evidence-range-drift:${evidenceRange.range}`
      );
    }
  }
}

export function assertBattlePropertyTagMatchingRuntimeEvidenceReference(
  reference,
  source
) {
  if (
    reference?.path !== source.path ||
    Number(reference?.bytes) !== Number(source.bytes) ||
    reference?.sha256 !== source.sha256 ||
    reference?.binaryPath !== source.value.reviewedBinary?.path ||
    Number(reference?.binaryBytes) !==
      Number(source.value.reviewedBinary?.bytes) ||
    reference?.binarySha256 !== source.value.reviewedBinary?.sha256 ||
    reference?.il2CppDumpPath !== source.value.reviewedIl2CppDump?.path ||
    Number(reference?.il2CppDumpBytes) !==
      Number(source.value.reviewedIl2CppDump?.bytes) ||
    reference?.il2CppDumpSha256 !== source.value.reviewedIl2CppDump?.sha256 ||
    Number(reference?.rangeCount) !== (source.value.binaryRanges ?? []).length
  ) {
    throw new Error(
      'optimization-qualification-property-tag-matching-evidence-report-reference-drift'
    );
  }
}

export async function readSoulEffectKillCriticalEventRuntimeEvidenceSource({
  sourcePath,
  gameAssemblyPath,
  il2CppDumpPath,
  projectRoot,
}) {
  const bytes = await fs.readFile(sourcePath);
  const value = JSON.parse(bytes.toString('utf8'));
  const binaryIdentity = await readBinaryIdentity(gameAssemblyPath);
  const dumpIdentity = await readBinaryIdentity(il2CppDumpPath);
  const binary = await fs.readFile(gameAssemblyPath);
  const dumpText = await fs.readFile(il2CppDumpPath, 'utf8');
  const rangeHashes = Object.fromEntries(
    (value.binaryRanges ?? []).map(record => [
      record.range,
      createHash('sha256')
        .update(readPortableExecutableRvaRange(binary, record.range))
        .digest('hex'),
    ])
  );
  const dumpFragments = [
    ...(value.dumpBindings?.methods ?? []).flatMap(record => [
      `// RVA: ${record.rva}`,
      record.declaration,
    ]),
    ...(value.dumpBindings?.enums ?? []).flatMap(record => [
      record.description,
      record.declaration,
    ]),
  ];
  const observations = {
    binaryIdentity,
    dumpIdentity,
    rangeHashes,
    rangeCount: Object.keys(rangeHashes).length,
    dumpFragmentsPresent: dumpFragments.every(fragment =>
      dumpText.includes(fragment)
    ),
  };
  validateSoulEffectKillCriticalEventRuntimeEvidence(value, observations);
  return {
    path: normalizeSourcePath(sourcePath, projectRoot),
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    value: {
      ...value,
      verifiedBinary: binaryIdentity,
      verifiedIl2CppDump: dumpIdentity,
    },
    observations,
  };
}

export function validateSoulEffectKillCriticalEventRuntimeEvidence(
  value,
  observations
) {
  if (
    value?.contractName !== 'AzPrSoulEssenceKillCriticalEventRuntimeEvidence' ||
    Number(value?.schemaVersion) !== 1 ||
    value?.conclusion?.status !== 'applied'
  ) {
    throw new Error(
      'optimization-qualification-kill-critical-event-evidence-contract-invalid'
    );
  }
  if (
    Number(value.reviewedBinary?.bytes) !==
      Number(observations?.binaryIdentity?.bytes) ||
    value.reviewedBinary?.sha256 !== observations?.binaryIdentity?.sha256
  ) {
    throw new Error(
      'optimization-qualification-kill-critical-event-evidence-binary-mismatch'
    );
  }
  if (
    Number(value.reviewedIl2CppDump?.bytes) !==
      Number(observations?.dumpIdentity?.bytes) ||
    value.reviewedIl2CppDump?.sha256 !== observations?.dumpIdentity?.sha256 ||
    observations?.dumpFragmentsPresent !== true
  ) {
    throw new Error(
      'optimization-qualification-kill-critical-event-evidence-dump-drift'
    );
  }
  const expectedMethods = [
    {
      identity: 'FormulaUtility.GetOutputDamage',
      rva: '0x187F360',
      declaration:
        'private static FormulaUtility.OutputDamageData GetOutputDamage(IElement element, EntityHandle attackerHandle, EntityHandle executorHandle, EntityHandle sourceHandle, int skillGroupId, int criticalRandom) { }',
    },
    {
      identity: 'DamageService.TriggerKillEvent',
      rva: '0x306E6E0',
      declaration:
        'public void TriggerKillEvent(EntityHandle aliveEntityHandle) { }',
    },
    {
      identity:
        'Lens.Gameplay.Modules.BigWorld.SkillUtility.InvokeTriggerElementHandle',
      rva: '0x18B5D50',
      declaration:
        'public static void InvokeTriggerElementHandle(EntityHandle source, EntityHandle self, EntityHandle target, EElementTriggerEventType type, TElementParams element) { }',
    },
  ];
  if (
    JSON.stringify(value.dumpBindings?.methods) !==
    JSON.stringify(expectedMethods)
  ) {
    throw new Error(
      'optimization-qualification-kill-critical-event-evidence-method-drift'
    );
  }
  if (
    Number(value.semantics?.beforeCriticalDamage?.eventId) !== 25 ||
    value.semantics?.beforeCriticalDamage?.frameAnchor !==
      'hit-before-critical-damage' ||
    Number(value.semantics?.killEvent?.eventId) !== 32 ||
    value.semantics?.killEvent?.frameAnchor !== 'kill-event' ||
    ![25, 32].every(eventId =>
      value.semantics?.emptyConditionEvents?.includes(eventId)
    )
  ) {
    throw new Error(
      'optimization-qualification-kill-critical-event-evidence-semantics-drift'
    );
  }
  for (const evidenceRange of value.binaryRanges ?? []) {
    if (
      observations?.rangeHashes?.[evidenceRange.range] !== evidenceRange.sha256
    ) {
      throw new Error(
        `optimization-qualification-kill-critical-event-evidence-range-drift:${evidenceRange.range}`
      );
    }
  }
}

export function assertSoulEffectKillCriticalEventRuntimeEvidenceReference(
  reference,
  source
) {
  if (
    reference?.path !== source.path ||
    Number(reference?.bytes) !== Number(source.bytes) ||
    reference?.sha256 !== source.sha256 ||
    reference?.binaryPath !== source.value.reviewedBinary?.path ||
    Number(reference?.binaryBytes) !==
      Number(source.value.reviewedBinary?.bytes) ||
    reference?.binarySha256 !== source.value.reviewedBinary?.sha256 ||
    reference?.il2CppDumpPath !== source.value.reviewedIl2CppDump?.path ||
    Number(reference?.il2CppDumpBytes) !==
      Number(source.value.reviewedIl2CppDump?.bytes) ||
    reference?.il2CppDumpSha256 !== source.value.reviewedIl2CppDump?.sha256 ||
    Number(reference?.rangeCount) !== (source.value.binaryRanges ?? []).length
  ) {
    throw new Error(
      'optimization-qualification-kill-critical-event-evidence-report-reference-drift'
    );
  }
}

function attachSoulEffectKillCriticalEventRuntimeEvidence(
  triggerContract,
  evidence
) {
  if (
    triggerContract?.sourceKind !== 'il2cpp-soulessence-trigger-contract' ||
    evidence?.conclusion?.status !== 'applied'
  ) {
    throw new Error(
      'optimization-qualification-kill-critical-event-evidence-attach-invalid'
    );
  }
  const eventBindings = triggerContract.eventBindings ?? [];
  for (const binding of eventBindings) {
    if (
      Number(binding.value) ===
        Number(evidence.semantics.beforeCriticalDamage.eventId) &&
      binding.frameAnchor !==
        evidence.semantics.beforeCriticalDamage.frameAnchor
    ) {
      throw new Error(
        'optimization-qualification-kill-critical-event-frame-anchor-drift'
      );
    }
    if (
      Number(binding.value) === Number(evidence.semantics.killEvent.eventId) &&
      binding.frameAnchor !== evidence.semantics.killEvent.frameAnchor
    ) {
      throw new Error(
        'optimization-qualification-kill-event-frame-anchor-drift'
      );
    }
  }
  const value = {
    ...triggerContract,
    soulEventRuntime: {
      status: evidence.conclusion.status,
      contractName: evidence.contractName,
      beforeCriticalDamage: structuredClone(
        evidence.semantics.beforeCriticalDamage
      ),
      killEvent: structuredClone(evidence.semantics.killEvent),
      emptyConditionEvents: [
        ...(evidence.semantics.emptyConditionEvents ?? []),
      ],
      consumer: structuredClone(evidence.consumer ?? null),
      sourceIdentity: evidence.conclusion.sourceIdentity,
    },
  };
  return { ...value, contractHash: hashCanonicalValue(value) };
}

function attachBattlePropertyTagMatchingEvidence(contract, evidence) {
  if (
    contract?.sourceKind !== 'il2cpp-battle-property-tag-contract' ||
    evidence?.conclusion?.status !== 'applied'
  ) {
    throw new Error(
      'optimization-qualification-property-tag-matching-evidence-attach-invalid'
    );
  }
  const value = {
    ...contract,
    matchSemantics: {
      emptyModifierTags: evidence.semantics.emptyModifierTags,
      singleModifierTag: evidence.semantics.singleModifierTag,
      multipleModifierTags: evidence.semantics.multipleModifierTags,
    },
    matchingRuntimeEvidence: {
      contractName: evidence.contractName,
      status: evidence.conclusion.status,
      ranges: (evidence.binaryRanges ?? []).map(record => ({
        identity: record.identity,
        range: record.range,
        sha256: record.sha256,
      })),
      sourceIdentity: evidence.conclusion.sourceIdentity,
    },
  };
  return { ...value, contractHash: hashCanonicalValue(value) };
}

function createBattlePropertyTagContract({
  sourcePath,
  skillTagBlock,
  battlePropertyTagBlock,
}) {
  const bindingDeclarations = [
    {
      skillTagName: 'NormalAttack',
      skillTagId: 1,
      skillDescription: '角色普攻',
      actionKind: 'normal-attack',
      propertyTagName: 'NormalAttack',
      propertyTag: 300,
      propertyDescription: '[属性Tag]普攻',
    },
    {
      skillTagName: 'WhackAttack',
      skillTagId: 2,
      skillDescription: '角色重击',
      actionKind: 'charged-attack',
      propertyTagName: 'Skill1',
      propertyTag: 301,
      propertyDescription: '[属性Tag]重击',
    },
    {
      skillTagName: 'NormalSkill',
      skillTagId: 3,
      skillDescription: '角色小技能',
      actionKind: 'star-skill',
      propertyTagName: 'Skill2',
      propertyTag: 302,
      propertyDescription: '[属性Tag]技能',
    },
    {
      skillTagName: 'UltraSkill',
      skillTagId: 4,
      skillDescription: '角色大招',
      actionKind: 'ultimate',
      propertyTagName: 'UltraSkill',
      propertyTag: 303,
      propertyDescription: '[属性Tag]大招',
    },
  ];
  const bindings = bindingDeclarations.map(binding => {
    assertIl2CppEnumMember({
      block: skillTagBlock,
      enumName: 'ESkillTagType',
      memberName: binding.skillTagName,
      value: binding.skillTagId,
      description: binding.skillDescription,
    });
    assertIl2CppEnumMember({
      block: battlePropertyTagBlock,
      enumName: 'EBattlePropertyTag',
      memberName: binding.propertyTagName,
      value: binding.propertyTag,
      description: binding.propertyDescription,
    });
    return {
      skillTagId: binding.skillTagId,
      skillTagName: binding.skillTagName,
      actionKind: binding.actionKind,
      propertyTag: binding.propertyTag,
      propertyTagName: binding.propertyTagName,
      status: 'applied',
      sourceIdentity: `${sourcePath}#ESkillTagType.${binding.skillTagName}=${binding.skillTagId}|${sourcePath}#EBattlePropertyTag.${binding.propertyTagName}=${binding.propertyTag}`,
    };
  });
  const unresolvedPropertyTags = [
    ['EvadeAttack', 304],
    ['ReboundCounterattack', 305],
    ['EvadeBoostAttack', 306],
    ['Overdrive', 307],
    ['Disorder', 308],
    ['PetSkill', 309],
    ['PetUltraSkill', 310],
    ['PetJointStrikeSkill', 311],
    ['DotDamage', 312],
    ['RealDamage', 313],
    ['AerialAttack', 314],
    ['EnterSkill', 315],
    ['ExitSkill', 316],
  ].map(([propertyTagName, propertyTag]) => {
    assertIl2CppEnumMember({
      block: battlePropertyTagBlock,
      enumName: 'EBattlePropertyTag',
      memberName: propertyTagName,
      value: propertyTag,
    });
    return {
      propertyTag,
      propertyTagName,
      status: 'static-evidence-gap',
      reason: 'battle-property-tag-action-binding-not-evidence-closed',
      sourceIdentity: `${sourcePath}#EBattlePropertyTag.${propertyTagName}=${propertyTag}`,
    };
  });
  const value = {
    sourceKind: 'il2cpp-battle-property-tag-contract',
    sourceIdentity: `${sourcePath}#ESkillTagType|${sourcePath}#EBattlePropertyTag`,
    matchSemantics: {
      emptyModifierTags: 'unscoped',
      singleModifierTag: 'exact-membership',
      multipleModifierTags: 'evidence-open-runtime-blocked',
    },
    bindings,
    unresolvedPropertyTags,
  };
  return { ...value, contractHash: hashCanonicalValue(value) };
}

function assertIl2CppEnumMember({
  block,
  enumName,
  memberName,
  value,
  description = null,
  annotationKind = 'Description',
}) {
  const declaration = `public const ${enumName} ${memberName} = ${value};`;
  if (!block.includes(declaration)) {
    throw new Error(
      `optimization-qualification-il2cpp-enum-member-missing:${enumName}.${memberName}=${value}`
    );
  }
  if (
    description != null &&
    !block.includes(`[${annotationKind}("${description}")]`)
  ) {
    throw new Error(
      `optimization-qualification-il2cpp-enum-description-missing:${enumName}.${memberName}`
    );
  }
}

const binaryHashCache = new Map();

async function readHeroRankRuntimeEvidenceSource(
  sourcePath,
  gameAssemblyPath,
  il2cppRuntimeContracts,
  projectRoot
) {
  const bytes = await fs.readFile(sourcePath);
  const value = JSON.parse(bytes.toString('utf8'));
  if (
    value?.contractName !== 'AzPrHeroRankRuntimeEvidence' ||
    Number(value?.schemaVersion) !== 1
  ) {
    throw new Error(
      'optimization-qualification-hero-rank-evidence-contract-invalid'
    );
  }
  if (!value.adjacentRankCapture) {
    throw new Error(
      'optimization-qualification-hero-rank-evidence-capture-boundary-missing'
    );
  }
  const binaryIdentity = await readBinaryIdentity(gameAssemblyPath);
  if (
    Number(value.reviewedBinary?.bytes) !== binaryIdentity.bytes ||
    value.reviewedBinary?.sha256 !== binaryIdentity.sha256
  ) {
    throw new Error(
      'optimization-qualification-hero-rank-evidence-binary-mismatch'
    );
  }
  assertHeroRankRuntimeMethodBindings(
    value,
    il2cppRuntimeContracts.value.heroRuntimeDeclarations
  );
  assertHeroRankRuntimeCallEdges(value);
  assertHeroRankExpectedDeltaCoverage(value);
  validateHeroRankAdjacentRankCaptureComparisons(value);
  if (
    value.adjacentRankCapture.status === 'captured' &&
    (!value.adjacentRankCapture.captureIdentity ||
      !Array.isArray(value.adjacentRankCapture.comparisons) ||
      value.adjacentRankCapture.comparisons.length === 0)
  ) {
    throw new Error(
      'optimization-qualification-hero-rank-evidence-capture-incomplete'
    );
  }
  if (
    value.conclusion?.attributeApplicationStatus === 'runtime-applied' &&
    value.adjacentRankCapture.status !== 'captured'
  ) {
    throw new Error(
      'optimization-qualification-hero-rank-evidence-applied-without-capture'
    );
  }
  if (value.productDecision?.decision === 'unimplemented-dead-config') {
    if (
      value.conclusion?.attributeApplicationStatus !== 'not-applicable' ||
      value.conclusion?.applicationMode !== 'not-applicable' ||
      value.conclusion?.staticClosureBoundary?.adjacentRankCaptureRequired !==
        false ||
      value.conclusion?.clientSemantics?.productDecision !==
        'unimplemented-dead-config'
    ) {
      throw new Error(
        'optimization-qualification-hero-rank-evidence-decision-inconsistent'
      );
    }
  }
  return {
    path: normalizeSourcePath(sourcePath, projectRoot),
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    value: {
      ...value,
      verifiedBinary: binaryIdentity,
      il2cppDeclarationSource: {
        path: il2cppRuntimeContracts.path,
        sha256: il2cppRuntimeContracts.sha256,
      },
    },
  };
}

export function assertHeroRankExpectedDeltaCoverage(evidence) {
  const expectedDeltas = evidence?.adjacentRankCapture?.expectedDeltas;
  if (!Array.isArray(expectedDeltas) || expectedDeltas.length < 12) {
    throw new Error(
      'optimization-qualification-hero-rank-evidence-expected-delta-coverage-missing'
    );
  }
  const invalid = expectedDeltas.filter(
    delta =>
      !delta?.sourceCharacterId ||
      Number(delta?.level) !== 80 ||
      Number(delta?.lowerRank) !== 2 ||
      Number(delta?.higherRank) !== 3 ||
      delta?.emptyLoadout !== true ||
      !Array.isArray(delta?.attributes) ||
      delta.attributes.length === 0
  );
  if (invalid.length) {
    throw new Error(
      `optimization-qualification-hero-rank-evidence-expected-delta-invalid:${invalid
        .map(delta => delta?.sourceCharacterId ?? 'unknown')
        .join(',')}`
    );
  }
}

export function validateHeroRankAdjacentRankCaptureComparisons(evidence) {
  const capture = evidence?.adjacentRankCapture;
  if (capture?.status !== 'captured') {
    return;
  }
  if (
    !capture.captureIdentity ||
    !Array.isArray(capture.comparisons) ||
    capture.comparisons.length === 0
  ) {
    throw new Error(
      'optimization-qualification-hero-rank-evidence-capture-incomplete'
    );
  }
  const expectedBySource = new Map(
    (capture.expectedDeltas ?? []).map(delta => [
      Number(delta.sourceCharacterId),
      delta,
    ])
  );
  for (const comparison of capture.comparisons) {
    const expected = expectedBySource.get(Number(comparison.sourceCharacterId));
    if (
      !expected ||
      Number(comparison.level) !== 80 ||
      Number(comparison.lowerRank) !== 2 ||
      Number(comparison.higherRank) !== 3 ||
      comparison.emptyLoadout !== true
    ) {
      throw new Error(
        `optimization-qualification-hero-rank-evidence-capture-comparison-invalid:${comparison.sourceCharacterId}`
      );
    }
    const actualDelta = normalizeAttributePairs(comparison.actualDelta);
    const expectedDelta = normalizeAttributePairs(expected.expectedDelta);
    if (
      actualDelta.size !== expectedDelta.size ||
      [...actualDelta.entries()].some(
        ([attributeId, value]) =>
          Number(expectedDelta.get(attributeId)) !== Number(value)
      )
    ) {
      throw new Error(
        `optimization-qualification-hero-rank-evidence-capture-delta-mismatch:${comparison.sourceCharacterId}`
      );
    }
  }
}

function normalizeAttributePairs(rawValue) {
  return new Map(
    String(rawValue ?? '')
      .split('|')
      .filter(Boolean)
      .map(part => {
        const [attributeId, value] = part.split('#');
        return [Number(attributeId), Number(value)];
      })
  );
}

async function readSoulEffectGetElementRuntimeEvidenceSource(
  sourcePath,
  gameAssemblyPath,
  projectRoot
) {
  const bytes = await fs.readFile(sourcePath);
  const value = JSON.parse(bytes.toString('utf8'));
  if (
    value?.contractName !== 'AzPrSoulEssenceGetElementRuntimeEvidence' ||
    Number(value?.schemaVersion) !== 1 ||
    value?.conclusion?.status !== 'applied'
  ) {
    throw new Error(
      'optimization-qualification-get-element-evidence-contract-invalid'
    );
  }
  const binaryIdentity = await readBinaryIdentity(gameAssemblyPath);
  if (
    Number(value.reviewedBinary?.bytes) !== binaryIdentity.bytes ||
    value.reviewedBinary?.sha256 !== binaryIdentity.sha256
  ) {
    throw new Error(
      'optimization-qualification-get-element-evidence-binary-mismatch'
    );
  }
  const binary = await fs.readFile(gameAssemblyPath);
  const ranges = [
    value.consumer?.beforeMutation,
    value.consumer?.combineThenAfterMutation,
    value.consumer?.newElementAfterExecution,
  ];
  for (const evidenceRange of ranges) {
    const rangeBytes = readPortableExecutableRvaRange(
      binary,
      evidenceRange?.range
    );
    if (
      !evidenceRange?.callRva ||
      createHash('sha256').update(rangeBytes).digest('hex') !==
        evidenceRange.sha256
    ) {
      throw new Error(
        `optimization-qualification-get-element-evidence-range-drift:${evidenceRange?.range ?? 'missing'}`
      );
    }
  }
  const semantics = value.dispatchSemantics ?? {};
  if (
    Number(semantics.beforeMutationEventId) !== 9 ||
    Number(semantics.afterMutationEventId) !== 10 ||
    semantics.zeroDeltaRefreshDispatch !== 'applied-acquisition-event' ||
    semantics.initialStateDispatch !== false ||
    semantics.consumeDispatch !== false ||
    semantics.expireDispatch !== false ||
    semantics.failedOrUnexecutedDispatch !== false
  ) {
    throw new Error(
      'optimization-qualification-get-element-evidence-semantics-incomplete'
    );
  }
  return {
    path: normalizeSourcePath(sourcePath, projectRoot),
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    value: {
      ...value,
      verifiedBinary: binaryIdentity,
    },
  };
}

async function readSoulEffectBeforeDamageRuntimeEvidenceSource(
  sourcePath,
  gameAssemblyPath,
  projectRoot
) {
  const bytes = await fs.readFile(sourcePath);
  const value = JSON.parse(bytes.toString('utf8'));
  if (
    value?.contractName !== 'AzPrSoulEssenceBeforeDamageRuntimeEvidence' ||
    Number(value?.schemaVersion) !== 1 ||
    value?.conclusion?.status !== 'applied'
  ) {
    throw new Error(
      'optimization-qualification-before-damage-evidence-contract-invalid'
    );
  }
  const binaryIdentity = await readBinaryIdentity(gameAssemblyPath);
  if (
    Number(value.reviewedBinary?.bytes) !== binaryIdentity.bytes ||
    value.reviewedBinary?.sha256 !== binaryIdentity.sha256
  ) {
    throw new Error(
      'optimization-qualification-before-damage-evidence-binary-mismatch'
    );
  }
  const binary = await fs.readFile(gameAssemblyPath);
  const ranges = [
    value.consumer?.orderedDispatch,
    value.consumer?.beforeAttack,
    value.consumer?.afterAttack,
  ];
  for (const evidenceRange of ranges) {
    const rangeBytes = readPortableExecutableRvaRange(
      binary,
      evidenceRange?.range
    );
    if (
      createHash('sha256').update(rangeBytes).digest('hex') !==
      evidenceRange?.sha256
    ) {
      throw new Error(
        `optimization-qualification-before-damage-evidence-range-drift:${evidenceRange?.range ?? 'missing'}`
      );
    }
  }
  const consumer = value.consumer ?? {};
  const semantics = value.dispatchSemantics ?? {};
  if (
    consumer.beforeAttack?.callRva !== '0x1319276' ||
    consumer.damageSettlement?.callRva !== '0x131935A' ||
    consumer.afterAttack?.callRva !== '0x13193C7' ||
    Number(semantics.beforeDamageEventId) !== 1 ||
    Number(semantics.afterDamageEventId) !== 2 ||
    semantics.beforeDamagePrecedesSettlement !== true ||
    semantics.afterDamageFollowsSettlement !== true ||
    semantics.samePacketBeforeDamageVisible !== true ||
    semantics.ordinaryLandedHitDispatch !== true ||
    semantics.tuningDamagePacketDispatch !== true ||
    semantics.missDispatch !== false ||
    semantics.failedOrUnexecutedDispatch !== false
  ) {
    throw new Error(
      'optimization-qualification-before-damage-evidence-semantics-incomplete'
    );
  }
  return {
    path: normalizeSourcePath(sourcePath, projectRoot),
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    value: { ...value, verifiedBinary: binaryIdentity },
  };
}

export async function readSoulEffectNonDamageRuntimeEvidenceSource({
  sourcePath,
  gameAssemblyPath,
  il2CppDumpPath,
  projectRoot,
}) {
  const bytes = await fs.readFile(sourcePath);
  const value = JSON.parse(bytes.toString('utf8'));
  const binaryIdentity = await readBinaryIdentity(gameAssemblyPath);
  const dumpIdentity = await readBinaryIdentity(il2CppDumpPath);
  const binary = await fs.readFile(gameAssemblyPath);
  const dumpText = await fs.readFile(il2CppDumpPath, 'utf8');
  const rangeHashes = Object.fromEntries(
    Object.values(value.consumer ?? {})
      .filter(record => record?.range)
      .map(record => [
        record.range,
        createHash('sha256')
          .update(readPortableExecutableRvaRange(binary, record.range))
          .digest('hex'),
      ])
  );
  const dumpFragments = [
    ...(value.dumpBindings?.methods ?? []).flatMap(record => [
      `// RVA: ${record.rva}`,
      record.declaration,
    ]),
    ...(value.dumpBindings?.triggerTargetEnum ?? []).map(
      record =>
        `public const EElementTriggerTargetType ${record.enumName} = ${record.value};`
    ),
    ...(value.dumpBindings?.combineTypeEnum ?? []).map(
      record =>
        `public const ECombineType ${record.enumName} = ${record.value};`
    ),
    ...(value.dumpBindings?.triggerDataFields ?? []).map(
      record => `public EntityHandle ${record.field}; // ${record.offset}`
    ),
    ...(value.dumpBindings?.propertyFields ?? []).map(
      record => record.declaration
    ),
  ];
  const observations = {
    binaryIdentity,
    dumpIdentity,
    rangeHashes,
    rangeCount: Object.keys(rangeHashes).length,
    dumpFragmentsPresent: dumpFragments.every(fragment =>
      dumpText.includes(fragment)
    ),
  };
  validateSoulEffectNonDamageRuntimeEvidence(value, observations);
  return {
    path: normalizeSourcePath(sourcePath, projectRoot),
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    value: {
      ...value,
      verifiedBinary: binaryIdentity,
      verifiedIl2CppDump: dumpIdentity,
    },
    observations,
  };
}

export function validateSoulEffectNonDamageRuntimeEvidence(
  value,
  observations
) {
  const expectedMethods = [
    {
      identity:
        'Lens.Gameplay.Modules.BigWorld.TriggerElement.GetTriggerTarget',
      rva: '0x13BBF50',
      declaration:
        'private List<EntityHandle> GetTriggerTarget(ElementTriggerDataBase triggerData, int targetType, int factionType, bool onlyCheck) { }',
    },
    {
      identity: 'Lens.Gameplay.Modules.BigWorld.TriggerElement.CheckCondition',
      rva: '0x13B58F0',
      declaration:
        'private bool CheckCondition(TTriggerElementParams.TriggerConditionType conditionType, ElementTriggerDataBase triggerData) { }',
    },
    {
      identity:
        'Lens.Gameplay.Modules.BigWorld.AliveElementSystem.OnExecuteNormalElement',
      rva: '0x13195C0',
      declaration:
        'public virtual void OnExecuteNormalElement(IElement element) { }',
    },
  ];
  const expectedRouting = [
    {
      value: 0,
      enumName: 'Self',
      field: 'self',
      fieldOffset: '0x28',
      caseRva: '0x13BC109',
    },
    {
      value: 1,
      enumName: 'Target',
      field: 'target',
      fieldOffset: '0x20',
      caseRva: '0x13BC11B',
    },
    {
      value: 2,
      enumName: 'Source',
      field: 'source',
      fieldOffset: '0x18',
      caseRva: '0x13BC12D',
    },
  ];
  if (
    value?.contractName !== 'AzPrSoulEssenceNonDamageRuntimeEvidence' ||
    Number(value?.schemaVersion) !== 2 ||
    value?.conclusion?.status !== 'applied'
  ) {
    throw new Error(
      'optimization-qualification-non-damage-evidence-contract-invalid'
    );
  }
  if (
    Number(value.reviewedBinary?.bytes) !==
      Number(observations?.binaryIdentity?.bytes) ||
    value.reviewedBinary?.sha256 !== observations?.binaryIdentity?.sha256
  ) {
    throw new Error(
      'optimization-qualification-non-damage-evidence-binary-mismatch'
    );
  }
  if (
    Number(value.reviewedIl2CppDump?.bytes) !==
      Number(observations?.dumpIdentity?.bytes) ||
    value.reviewedIl2CppDump?.sha256 !== observations?.dumpIdentity?.sha256 ||
    observations?.dumpFragmentsPresent !== true ||
    JSON.stringify(value.dumpBindings?.methods) !==
      JSON.stringify(expectedMethods)
  ) {
    throw new Error(
      'optimization-qualification-non-damage-evidence-dump-binding-drift'
    );
  }
  const expectedPropertyFields = [
    {
      identity:
        'Lens.Gameplay.Modules.BigWorld.AliveProperty.shieldHitValueList',
      declaration:
        'private List<ShieldData> <shieldHitValueList>k__BackingField; // 0x88',
    },
  ];
  if (
    JSON.stringify(value.dumpBindings?.propertyFields) !==
    JSON.stringify(expectedPropertyFields)
  ) {
    throw new Error(
      'optimization-qualification-non-damage-evidence-property-field-drift'
    );
  }
  for (const evidenceRange of Object.values(value.consumer ?? {}).filter(
    record => record?.range
  )) {
    if (
      observations?.rangeHashes?.[evidenceRange.range] !== evidenceRange.sha256
    ) {
      throw new Error(
        `optimization-qualification-non-damage-evidence-range-drift:${evidenceRange.range}`
      );
    }
  }
  if (
    JSON.stringify(value.triggerTargetRouting?.bindings) !==
      JSON.stringify(expectedRouting) ||
    value.triggerTargetRouting?.consumer !==
      'Lens.Gameplay.Modules.BigWorld.TriggerElement.GetTriggerTarget' ||
    value.triggerTargetRouting?.rva !== '0x13BBF50' ||
    Number(value.sourceObserver?.triggerTargetType) !== 2 ||
    value.sourceObserver?.enumName !== 'Source' ||
    value.sourceObserver?.runtimeSourceKind !== 'event-source-actor-events'
  ) {
    throw new Error(
      'optimization-qualification-non-damage-evidence-trigger-target-routing-drift'
    );
  }
  if (
    value.emptyConditionSemantics?.emptyOrResult !== true ||
    value.emptyConditionSemantics?.emptyAndResult !== true ||
    ![34, 40, 44].every(eventId =>
      value.emptyConditionSemantics?.supportedEventIds?.includes(eventId)
    ) ||
    ![34, 40, 44].every(eventId =>
      value.emptyConditionEvents?.includes(eventId)
    )
  ) {
    throw new Error(
      'optimization-qualification-non-damage-evidence-empty-condition-drift'
    );
  }
  const block = value.combineSemantics?.block;
  if (
    Number(block?.combineType) !== 5 ||
    block?.enumName !== 'Block' ||
    block?.runtimeMode !== 'block-while-active-same-config' ||
    block?.identityComparison !== 'IElement.config-reference-equality' ||
    block?.activeDuplicateRefreshes !== false ||
    block?.activeDuplicateStacks !== false ||
    block?.activeDuplicateIsFreed !== true ||
    block?.reapplyAfterRemovalOrExpiry !== true ||
    block?.expiryInterval !== 'right-open'
  ) {
    throw new Error(
      'optimization-qualification-non-damage-evidence-block-semantics-drift'
    );
  }
  if (
    Number(value.switchEnter?.eventId) !== 34 ||
    value.switchEnter?.frameAnchor !== 'switch-enter' ||
    value.switchEnter?.initialForegroundDispatch !== false ||
    value.switchEnter?.noOpDispatch !== false ||
    value.switchEnter?.failedOrUnexecutedDispatch !== false ||
    value.switchEnter?.minimumIntervalUnit !== 'milliseconds' ||
    Number(value.onGotShield?.eventId) !== 40 ||
    value.onGotShield?.frameAnchor !== 'shield-after-acquire' ||
    value.onGotShield?.zeroValueDispatch !== false ||
    value.onGotShield?.inheritedStateDispatch !== false ||
    value.onGotShield?.failedOrRejectedDispatch !== false ||
    value.onGotShield?.refreshReplacementSemantics !== 'applied' ||
    value.onGotShield?.emptyShieldListGate?.consumer !==
      'Lens.Gameplay.Modules.BigWorld.ShieldElement.Execute' ||
    value.onGotShield?.emptyShieldListGate?.field !==
      'AliveProperty.shieldHitValueList' ||
    value.onGotShield?.emptyShieldListGate?.fieldOffset !== '0x88' ||
    value.onGotShield?.emptyShieldListGate?.listSizeOffset !== '0x18' ||
    Number(value.afterHeal?.eventId) !== 44 ||
    value.afterHeal?.frameAnchor !== 'heal-after-settlement' ||
    value.afterHeal?.zeroEffectiveChangeDispatch !== true ||
    value.afterHeal?.failedOrRejectedDispatch !== false ||
    Number(value.effectTarget?.effectTargetType) !== 1 ||
    value.effectTarget?.runtimeTargetKind !== 'event-target-actor'
  ) {
    throw new Error(
      'optimization-qualification-non-damage-evidence-semantics-incomplete'
    );
  }
}

export function assertSoulEffectNonDamageRuntimeEvidenceReference(
  reference,
  source
) {
  const rangeCount = Object.values(source.value.consumer ?? {}).filter(
    record => record?.range
  ).length;
  if (
    reference?.path !== source.path ||
    Number(reference?.bytes) !== Number(source.bytes) ||
    reference?.sha256 !== source.sha256 ||
    reference?.binaryPath !== source.value.reviewedBinary?.path ||
    Number(reference?.binaryBytes) !==
      Number(source.value.reviewedBinary?.bytes) ||
    reference?.binarySha256 !== source.value.reviewedBinary?.sha256 ||
    reference?.il2CppDumpPath !== source.value.reviewedIl2CppDump?.path ||
    Number(reference?.il2CppDumpBytes) !==
      Number(source.value.reviewedIl2CppDump?.bytes) ||
    reference?.il2CppDumpSha256 !== source.value.reviewedIl2CppDump?.sha256 ||
    Number(reference?.rangeCount) !== rangeCount
  ) {
    throw new Error(
      'optimization-qualification-non-damage-evidence-report-reference-drift'
    );
  }
}

function attachSoulEffectGetElementRuntimeEvidence(
  triggerContract,
  evidence,
  elementTypeEvidence
) {
  const sourceVisibility = evidence?.sourceVisibility ?? {};
  const triggerTargetBinding = triggerContract.triggerTargetBindings?.find(
    binding =>
      Number(binding.value) === Number(sourceVisibility.triggerTargetType)
  );
  if (
    !triggerTargetBinding ||
    triggerTargetBinding.enumName !== sourceVisibility.enumName ||
    triggerTargetBinding.sourceKind !== sourceVisibility.runtimeSourceKind
  ) {
    throw new Error(
      'optimization-qualification-get-element-source-visibility-drift'
    );
  }
  const value = {
    ...triggerContract,
    getElementRuntime: {
      status: evidence.conclusion.status,
      contractName: evidence.contractName,
      beforeMutationEventId: Number(
        evidence.dispatchSemantics.beforeMutationEventId
      ),
      afterMutationEventId: Number(
        evidence.dispatchSemantics.afterMutationEventId
      ),
      appliedAcquisitionSources: [
        ...(evidence.dispatchSemantics.appliedAcquisitionSources ?? []),
      ],
      zeroDeltaRefreshDispatch:
        evidence.dispatchSemantics.zeroDeltaRefreshDispatch,
      initialStateDispatch: evidence.dispatchSemantics.initialStateDispatch,
      consumeDispatch: evidence.dispatchSemantics.consumeDispatch,
      expireDispatch: evidence.dispatchSemantics.expireDispatch,
      failedOrUnexecutedDispatch:
        evidence.dispatchSemantics.failedOrUnexecutedDispatch,
      sourceVisibility: structuredClone(sourceVisibility),
      consumer: structuredClone(evidence.consumer),
      elementTypeCondition: {
        status: elementTypeEvidence.conclusion.status,
        conditionTypeIndex: Number(
          elementTypeEvidence.conditionConsumer.dispatch.conditionTypeIndex
        ),
        conditionTypeTargetRva:
          elementTypeEvidence.conditionConsumer.dispatch.conditionTypeTargetRva,
        selector: elementTypeEvidence.semantics.selector,
        consumer: structuredClone(elementTypeEvidence.conditionConsumer),
        reviewedBinary: structuredClone(elementTypeEvidence.reviewedBinary),
        reviewedIl2CppDump: structuredClone(
          elementTypeEvidence.reviewedIl2CppDump
        ),
        sourceIdentity: elementTypeEvidence.conclusion.sourceIdentity,
      },
      reviewedBinary: structuredClone(evidence.reviewedBinary),
      sourceIdentity: evidence.conclusion.sourceIdentity,
    },
  };
  const { contractHash: _contractHash, ...hashInput } = value;
  return { ...hashInput, contractHash: hashCanonicalValue(hashInput) };
}

function attachSoulEffectBeforeDamageRuntimeEvidence(
  triggerContract,
  evidence
) {
  const sourceVisibility = evidence?.sourceVisibility ?? {};
  const triggerTargetBinding = triggerContract.triggerTargetBindings?.find(
    binding =>
      Number(binding.value) === Number(sourceVisibility.triggerTargetType)
  );
  const beforeEvent = triggerContract.eventBindings?.find(
    binding => Number(binding.value) === 1
  );
  const afterEvent = triggerContract.eventBindings?.find(
    binding => Number(binding.value) === 2
  );
  if (
    !triggerTargetBinding ||
    triggerTargetBinding.enumName !== sourceVisibility.enumName ||
    triggerTargetBinding.sourceKind !== sourceVisibility.runtimeSourceKind ||
    beforeEvent?.frameAnchor !== 'hit-before-damage' ||
    afterEvent?.frameAnchor !== 'hit-after-damage'
  ) {
    throw new Error(
      'optimization-qualification-before-damage-source-binding-drift'
    );
  }
  const semantics = evidence.dispatchSemantics;
  const value = {
    ...triggerContract,
    beforeDamageRuntime: {
      status: evidence.conclusion.status,
      contractName: evidence.contractName,
      beforeDamageEventId: Number(semantics.beforeDamageEventId),
      afterDamageEventId: Number(semantics.afterDamageEventId),
      beforeDamagePrecedesSettlement: semantics.beforeDamagePrecedesSettlement,
      afterDamageFollowsSettlement: semantics.afterDamageFollowsSettlement,
      samePacketBeforeDamageVisible: semantics.samePacketBeforeDamageVisible,
      ordinaryLandedHitDispatch: semantics.ordinaryLandedHitDispatch,
      tuningDamagePacketDispatch: semantics.tuningDamagePacketDispatch,
      missDispatch: semantics.missDispatch,
      failedOrUnexecutedDispatch: semantics.failedOrUnexecutedDispatch,
      eventElementIdentity: semantics.eventElementIdentity,
      emptyConditionEvents: evidence.emptyConditionEvents ?? [],
      sourceVisibility: structuredClone(sourceVisibility),
      consumer: structuredClone(evidence.consumer),
      reviewedBinary: structuredClone(evidence.reviewedBinary),
      sourceIdentity: evidence.conclusion.sourceIdentity,
    },
  };
  const { contractHash: _contractHash, ...hashInput } = value;
  return { ...hashInput, contractHash: hashCanonicalValue(hashInput) };
}

function attachSoulEffectNonDamageRuntimeEvidence(triggerContract, evidence) {
  const switchEvent = triggerContract.eventBindings?.find(
    binding => Number(binding.value) === Number(evidence.switchEnter?.eventId)
  );
  const shieldEvent = triggerContract.eventBindings?.find(
    binding => Number(binding.value) === Number(evidence.onGotShield?.eventId)
  );
  const healEvent = triggerContract.eventBindings?.find(
    binding => Number(binding.value) === Number(evidence.afterHeal?.eventId)
  );
  const effectTarget = triggerContract.targetBindings?.find(
    binding =>
      Number(binding.value) === Number(evidence.effectTarget?.effectTargetType)
  );
  const sourceObserver = triggerContract.triggerTargetBindings?.find(
    binding =>
      Number(binding.value) ===
      Number(evidence.sourceObserver?.triggerTargetType)
  );
  if (
    switchEvent?.frameAnchor !== evidence.switchEnter?.frameAnchor ||
    shieldEvent?.frameAnchor !== evidence.onGotShield?.frameAnchor ||
    healEvent?.frameAnchor !== evidence.afterHeal?.frameAnchor ||
    effectTarget?.enumName !== evidence.effectTarget?.enumName ||
    effectTarget?.targetKind !== evidence.effectTarget?.runtimeTargetKind ||
    sourceObserver?.enumName !== evidence.sourceObserver?.enumName ||
    sourceObserver?.sourceKind !== evidence.sourceObserver?.runtimeSourceKind
  ) {
    throw new Error(
      'optimization-qualification-non-damage-source-binding-drift'
    );
  }
  const value = {
    ...triggerContract,
    nonDamageRuntime: {
      status: evidence.conclusion.status,
      contractName: evidence.contractName,
      switchEnter: structuredClone(evidence.switchEnter),
      onGotShield: structuredClone(evidence.onGotShield),
      afterHeal: structuredClone(evidence.afterHeal),
      sourceVisibility: structuredClone(evidence.sourceVisibility),
      sourceObserver: structuredClone(evidence.sourceObserver),
      triggerTargetRouting: structuredClone(evidence.triggerTargetRouting),
      effectTarget: structuredClone(evidence.effectTarget),
      emptyConditionSemantics: structuredClone(
        evidence.emptyConditionSemantics
      ),
      emptyConditionEvents: [...(evidence.emptyConditionEvents ?? [])],
      combineSemantics: structuredClone(evidence.combineSemantics),
      consumer: structuredClone(evidence.consumer),
      reviewedBinary: structuredClone(evidence.reviewedBinary),
      reviewedIl2CppDump: structuredClone(evidence.reviewedIl2CppDump),
      sourceIdentity: evidence.conclusion.sourceIdentity,
    },
  };
  const { contractHash: _contractHash, ...hashInput } = value;
  return { ...hashInput, contractHash: hashCanonicalValue(hashInput) };
}

function readPortableExecutableRvaRange(binary, range) {
  const match = String(range).match(/^0x([0-9a-f]+)-0x([0-9a-f]+)$/iu);
  if (!match) throw new Error(`invalid PE RVA range: ${range}`);
  const startRva = Number.parseInt(match[1], 16);
  const endRva = Number.parseInt(match[2], 16);
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
    throw new Error(`PE RVA outside sections: 0x${rva.toString(16)}`);
  };
  return binary.subarray(resolveOffset(startRva), resolveOffset(endRva));
}

function extractIl2CppTypeBlock(text, { namespace, declaration }) {
  const namespaceMarker = `// Namespace: ${namespace}`;
  let namespaceIndex = text.indexOf(namespaceMarker);
  while (namespaceIndex >= 0) {
    const nextNamespaceIndex = text.indexOf(
      '// Namespace:',
      namespaceIndex + namespaceMarker.length
    );
    const typeIndex = text.indexOf(declaration, namespaceIndex);
    if (
      typeIndex >= 0 &&
      (nextNamespaceIndex < 0 || typeIndex < nextNamespaceIndex)
    ) {
      const end = nextNamespaceIndex < 0 ? text.length : nextNamespaceIndex;
      return text.slice(namespaceIndex, end);
    }
    namespaceIndex = text.indexOf(
      namespaceMarker,
      namespaceIndex + namespaceMarker.length
    );
  }
  throw new Error(
    `optimization-qualification-il2cpp-type-missing:${namespace}.${declaration}`
  );
}

function createIl2CppMethodRecord({ identity, typeBlock, declaration }) {
  const declarationIndex = typeBlock.indexOf(declaration);
  if (declarationIndex < 0) {
    throw new Error(
      `optimization-qualification-il2cpp-method-missing:${identity}`
    );
  }
  const prefix = typeBlock.slice(
    Math.max(0, declarationIndex - 300),
    declarationIndex
  );
  const rvaMatches = [...prefix.matchAll(/\/\/ RVA: (0x[0-9A-F]+)/g)];
  const rva = rvaMatches.at(-1)?.[1] ?? null;
  if (!rva) {
    throw new Error(
      `optimization-qualification-il2cpp-method-rva-missing:${identity}`
    );
  }
  return { identity, declaration, rva };
}

function assertHeroRankRuntimeMethodBindings(evidence, declarations) {
  const declarationRvaByIdentity = new Map(
    (declarations.methods ?? []).map(method => [method.identity, method.rva])
  );
  for (const observation of evidence.methodBodyObservations ?? []) {
    const declarationRva = declarationRvaByIdentity.get(observation.identity);
    if (
      !declarationRva ||
      declarationRva.toUpperCase() !== String(observation.rva).toUpperCase()
    ) {
      throw new Error(
        `optimization-qualification-hero-rank-evidence-method-binding-mismatch:${observation.identity}`
      );
    }
  }
  const requiredIdentities = [
    'Azur.Gameplay.PlayerModule.HeroData.Populate(HeroAttrInfo)',
    'Azur.Gameplay.PlayerModule.HeroData.RefreshAttributes',
    'Azur.Gameplay.PlayerModule.HeroData.Populate(HeroItemInfo)',
  ];
  for (const identity of requiredIdentities) {
    if (
      !(evidence.methodBodyObservations ?? []).some(
        observation => observation.identity === identity
      )
    ) {
      throw new Error(
        `optimization-qualification-hero-rank-evidence-method-missing:${identity}`
      );
    }
  }
}

function assertHeroRankRuntimeCallEdges(evidence) {
  const observationByIdentity = new Map(
    (evidence.methodBodyObservations ?? []).map(observation => [
      observation.identity,
      observation,
    ])
  );
  const requiredEdges = [
    {
      source: 'Azur.Gameplay.PlayerModule.HeroData.Populate(HeroAttrInfo)',
      target: 'Azur.Gameplay.PlayerModule.AttrModuleInfo..ctor/RefreshModules',
      targetRvas: ['0x244EE60', '0x244E9F0'],
    },
    {
      source: 'Azur.Gameplay.PlayerModule.HeroData.Populate(HeroAttrInfo)',
      target: 'Azur.Gameplay.PlayerModule.HeroData.RefreshAttributes',
      targetRva: '0x2458C00',
    },
    {
      source: 'Azur.Gameplay.PlayerModule.HeroData.Populate(HeroAttrInfo)',
      target: 'Azur.Gameplay.PlayerModule.HeroData.RefreshHeroSkill',
      targetRva: '0x2458F50',
    },
    {
      source: 'Azur.Gameplay.PlayerModule.HeroData.RefreshAttributes',
      target: 'Lens.Gameplay.UI.Util.GameUtil.PackAttrInfoByFightAttr',
      targetRva: '0x39714F0',
    },
  ];
  for (const required of requiredEdges) {
    const source = observationByIdentity.get(required.source);
    const edge = (source?.callEdges ?? []).find(
      candidate => candidate.target === required.target
    );
    const targetRvaMatches = required.targetRva
      ? String(edge?.targetRva).toUpperCase() ===
        required.targetRva.toUpperCase()
      : (required.targetRvas ?? []).every(expected =>
          (edge?.targetRvas ?? []).some(
            actual => String(actual).toUpperCase() === expected.toUpperCase()
          )
        );
    if (!edge || edge.status !== 'observed' || !targetRvaMatches) {
      throw new Error(
        `optimization-qualification-hero-rank-evidence-call-edge-missing:${required.source}->${required.target}`
      );
    }
  }
}

async function readBinaryIdentity(sourcePath) {
  const stats = await fs.stat(sourcePath);
  const cacheKey = `${path.resolve(sourcePath)}:${stats.size}:${stats.mtimeMs}`;
  if (!binaryHashCache.has(cacheKey)) {
    const bytes = await fs.readFile(sourcePath);
    binaryHashCache.set(cacheKey, {
      path: sourcePath.replaceAll('\\', '/'),
      bytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
  return structuredClone(binaryHashCache.get(cacheKey));
}

function assertFrozenSourceHashes(sources) {
  for (const [key, expectedHash] of Object.entries(FROZEN_B3_SOURCE_HASHES)) {
    const actualHash = sources[key]?.sha256;
    if (actualHash !== expectedHash) {
      throw new Error(
        `optimization-qualification-source-drift:${key}:expected=${expectedHash}:actual=${actualHash ?? 'missing'}`
      );
    }
  }
}

function assertDenominators(actual) {
  for (const [key, expected] of Object.entries(FROZEN_B3_DENOMINATORS)) {
    if (actual[key] !== expected) {
      throw new Error(
        `optimization-qualification-denominator-drift:${key}:expected=${expected}:actual=${actual[key]}`
      );
    }
  }
}

function finalizeHash(value, key) {
  return { ...value, [key]: hashCanonicalValue(value) };
}

function normalizeSourcePath(sourcePath, projectRoot) {
  const relative = path.relative(projectRoot, sourcePath);
  return relative.startsWith('..')
    ? sourcePath.replaceAll('\\', '/')
    : relative.replaceAll('\\', '/');
}

function splitTags(value) {
  return String(value ?? '')
    .split('、')
    .map(entry => entry.trim())
    .filter(Boolean);
}

function hasTargetElement(value) {
  return splitTags(value).some(element => TARGET_ELEMENTS.has(element));
}

function requireById(rows, id, label) {
  const row = rows.find(entry => Number(entry.id) === Number(id));
  if (!row) throw new Error(`${label} missing: ${id}`);
  return row;
}

function sortByNumericId(left, right) {
  return Number(left.id) - Number(right.id);
}

function compareQualificationRecords(left, right) {
  const byKind = left.objectKind.localeCompare(right.objectKind, 'en');
  if (byKind) return byKind;
  return left.objectId.localeCompare(right.objectId, 'en', { numeric: true });
}

function slotFromEquipmentType(typeName, slotType) {
  const byName = {
    武器: 'weapon',
    上装: 'top',
    下装: 'bottom',
    耳饰: 'earring',
    戒指: 'ring',
  };
  return byName[typeName] ?? EQUIPMENT_SLOT_BY_TYPE[Number(slotType)] ?? null;
}

function parseRarity(value) {
  const match = String(value ?? '').match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function parseIntegerList(value) {
  return String(value ?? '')
    .split('|')
    .map(Number)
    .filter(number => Number.isInteger(number) && number > 0);
}

function parseAttributePairs(value) {
  return String(value ?? '')
    .split('|')
    .filter(Boolean)
    .map(entry => {
      const [id, amount] = entry.split('#').map(Number);
      return { id, value: amount };
    })
    .filter(
      entry => Number.isInteger(entry.id) && Number.isFinite(entry.value)
    );
}

function parseSkillPair(value) {
  if (String(value ?? '').trim() === '') return null;
  const [skillIndex, level] = String(value).split('#').map(Number);
  if (
    !Number.isInteger(skillIndex) ||
    skillIndex < 0 ||
    !Number.isInteger(level) ||
    level <= 0
  ) {
    return null;
  }
  return { skillIndex, level };
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function groupBy(records, selector) {
  return records.reduce((map, record) => {
    const key = selector(record);
    const rows = map.get(key) ?? [];
    rows.push(record);
    map.set(key, rows);
    return map;
  }, new Map());
}

function countBy(records, selector) {
  return Object.fromEntries(
    [
      ...records.reduce((map, record) => {
        const key = String(selector(record));
        map.set(key, (map.get(key) ?? 0) + 1);
        return map;
      }, new Map()),
    ].sort(([left], [right]) => left.localeCompare(right, 'en'))
  );
}
