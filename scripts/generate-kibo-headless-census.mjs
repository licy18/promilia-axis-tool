import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_AZPR_ROOT = 'C:/PC2/Codex/AzPr';
const DEFAULT_EXTRACTOR_ROOT =
  'C:/Codex/AzPr Extractor/ExtractedAssets/Unity/default_package/ResourcesAssets/Config/Battle';

const EXPECTED_DENOMINATORS = Object.freeze({
  kiboCount: 122,
  publicActionCount: 366,
  fixedSkillUniqueCount: 172,
});

const FIXED_ACTION_SUPPORT_SLOTS = new Set([205, 401, 402, 403]);
const FIXED_NON_COMBAT_SLOTS = new Set([
  501, 502, 504, 505, 506, 507, 508, 602, 603, 50206,
]);
const FIXED_SLOT_SEMANTICS = Object.freeze({
  205: {
    name: 'PetUltraBlink',
    scope: 'pve-combat-action-support',
    sourceIdentity:
      'dump.cs#ESkillSlotType.PetUltraBlink=205',
  },
  401: {
    name: 'JumpBack',
    scope: 'pve-combat-action-support',
    sourceIdentity: 'dump.cs#ESkillSlotType.JumpBack=401',
  },
  402: {
    name: 'JumpLeft',
    scope: 'pve-combat-action-support',
    sourceIdentity: 'dump.cs#ESkillSlotType.JumpLeft=402',
  },
  403: {
    name: 'JumpRight',
    scope: 'pve-combat-action-support',
    sourceIdentity: 'dump.cs#ESkillSlotType.JumpRight=403',
  },
  501: {
    name: 'PetPuzzleSkill',
    scope: 'non-combat-capability',
    sourceIdentity: 'dump.cs#ESkillSlotType.PetPuzzleSkill=501',
  },
  502: {
    name: 'PetPuzzleBlink',
    scope: 'non-combat-capability',
    sourceIdentity: 'dump.cs#ESkillSlotType.PetPuzzleBlink=502',
  },
  504: {
    name: 'PetCommunicate',
    scope: 'non-combat-capability',
    sourceIdentity: 'dump.cs#ESkillSlotType.PetCommunicate=504',
  },
  505: {
    name: 'PetDecoration',
    scope: 'non-combat-capability',
    sourceIdentity:
      'dump.cs#SystemConst.systemEnum.petDecoration=505',
  },
  506: {
    name: 'PetRelease',
    scope: 'non-combat-capability',
    sourceIdentity:
      'dump.cs#SystemConst.systemEnum.petRelease=506',
  },
  507: {
    name: 'PetFeed',
    scope: 'non-combat-capability',
    sourceIdentity:
      'dump.cs#SystemConst.systemEnum.petFeed=507',
  },
  508: {
    name: 'PetBox',
    scope: 'non-combat-capability',
    sourceIdentity:
      'dump.cs#SystemConst.systemEnum.petBox=508',
  },
  602: {
    name: 'KiBoVersusCommonSkill',
    scope: 'non-combat-capability',
    sourceIdentity:
      'dump.cs#ESkillType.KiBoVersusCommonSkill1=701/KiBoVersusCommonSkill2=702|GameAssembly.dll#EnterKiBoVersusCommonSkill/DoKiBoVersusCommonSkill1/DoKiBoVersusCommonSkill2',
  },
  603: {
    name: 'KiBoVersusCommonSkill',
    scope: 'non-combat-capability',
    sourceIdentity:
      'dump.cs#ESkillType.KiBoVersusCommonSkill1=701/KiBoVersusCommonSkill2=702|GameAssembly.dll#EnterKiBoVersusCommonSkill/DoKiBoVersusCommonSkill1/DoKiBoVersusCommonSkill2',
  },
  50206: {
    name: 'PetPuzzleBlinkTypoAnomaly',
    scope: 'non-combat-capability',
    sourceIdentity:
      'pet.json#rows[id=500007/500024/500025/500043].fixedSkillList#50206|four-occurrence-anomaly-consistent-with-PetPuzzleBlink-502-slot|not-in-public-action-surface',
  },
});
const PROPERTY_BUCKET_BY_CALCULATE_TYPE = Object.freeze({
  0: 'dynamicForce',
  1: 'dynamicExtra',
  2: 'dynamicPercent',
});
const ENTITY_TYPE_NAME_BY_ID = Object.freeze({
  6: 'Item',
  14: 'Monster',
  24: 'KiBo',
  26: 'DefenseTower',
  27: 'BaseTower',
});
const SKILL_TAG_NAME_BY_ID = Object.freeze({
  13: 'PetNormalSkill',
  14: 'PetUltraSkill',
  15: 'PetJointStrikeSkill',
  16: 'PetBreakSkill',
  21: 'PetPassiveSkill',
});
const BATTLE_PROPERTY_NAME_BY_ID = Object.freeze({
  21: 'SHOOT_DMGUP',
  57: 'WATER_SHOOTDMGUP',
  105: 'SPGETUP',
  115: 'CD_SKILL',
});
const DAMAGE_TYPE_NAME_BY_ID = Object.freeze({
  0: 'None',
  1: 'MeleePhysical',
  2: 'RangePhysical',
  3: 'MeleeMagic',
  4: 'RangeMagic',
  5: 'Heal',
  6: 'Real',
  7: 'Dot',
  8: 'Weakness',
  9: 'All',
  10: 'StackOverLimit',
  11: 'Shield',
  12: 'Zero',
});
const DAMAGE_ELEMENTAL_TYPE_NAME_BY_ID = Object.freeze({
  0: 'None',
  1: 'Fire',
  2: 'Wind',
  3: 'Earth',
  4: 'Wood',
  5: 'Ice',
  6: 'Aqua',
  7: 'Thunder',
  8: 'Lumiere',
  9: 'Dark',
  10: 'All',
});
const ELEMENT_CLEAR_TYPE_FLAGS = Object.freeze({
  2: 'sourceDeadClear',
  4: 'sourceExitRiderClear',
  8: 'sourceExitBattleFieldClear',
  16: 'executorExitBattleFieldClear',
  32: 'EnterBattleClear',
  64: 'ExitBattleClear',
});
const REAL_DAMAGE_BLOCKED_FORMULA_IDS = Object.freeze([
  103, 104, 106, 107, 108, 109, 40011001, 40011002,
]);
const ENTITY_ELEMENTAL_TYPE_NAME_BY_MASK = Object.freeze({
  2: 'Fire',
  4: 'Wind',
  8: 'Earth',
  16: 'Wood',
  32: 'Ice',
  64: 'Aqua',
  128: 'Thunder',
  256: 'Lumiere',
  512: 'Dark',
});

export async function createKiboHeadlessCensus({
  repoRoot = DEFAULT_REPO_ROOT,
  azprRoot = DEFAULT_AZPR_ROOT,
  extractorBattleRoot = DEFAULT_EXTRACTOR_ROOT,
} = {}) {
  const sources = createSourcePaths({
    repoRoot,
    azprRoot,
    extractorBattleRoot,
  });
  const [
    kiboDocument,
    publicRuntimeCoverage,
    petDocument,
    skillDocument,
    skillLevelDocument,
    skillLogicDocument,
    elementFormulaDocument,
    languageText,
    verifiedMechanicsDocument,
  ] = await Promise.all([
    readJson(sources.kibos),
    readJson(sources.publicRuntimeCoverage),
    readJson(sources.petTable),
    readJson(sources.skillTable),
    readJson(sources.skillLevelTable),
    readJson(sources.skillLogicTable),
    readJson(sources.elementFormulaTable),
    fs.readFile(sources.skillLevelLanguage, 'utf8'),
    readJson(sources.verifiedMechanics),
  ]);

  const kibos = kiboDocument.items ?? [];
  const workbenchKiboIds = new Set(kibos.map(kibo => Number(kibo.id)));
  const pets = (petDocument.rows ?? []).filter(pet =>
    workbenchKiboIds.has(Number(pet.id))
  );
  const skillsById = new Map(
    (skillDocument.rows ?? []).map(row => [Number(row.id), row])
  );
  const skillLevelsBySkillId = groupRows(skillLevelDocument.rows ?? [], row =>
    Number(row.skillId)
  );
  const skillLogicById = new Map(
    (skillLogicDocument.rows ?? []).map(row => [Number(row.skillId), row])
  );
  const elementFormulasById = new Map(
    (elementFormulaDocument.rows ?? []).map(row => [Number(row.id), row])
  );
  const languageById = parseInt64LanguageRows(languageText);
  const kiboById = new Map(kibos.map(kibo => [Number(kibo.id), kibo]));
  const staticKiboCatalog = verifiedMechanicsDocument.staticPropertyCatalog?.kibo ?? {};
  const kiboStaticAudit = {
    profiles: new Map(
      (staticKiboCatalog.profiles ?? []).map(profile => [
        Number(profile.kiboId),
        profile,
      ])
    ),
    levelGrowthRows: staticKiboCatalog.levelGrowth ?? [],
    hobbyRows: staticKiboCatalog.hobbies ?? [],
    intimacyRows: staticKiboCatalog.intimacyLevels ?? [],
    comprehensionGrades: staticKiboCatalog.comprehensionGrades ?? [],
  };

  const fixedOccurrences = pets.flatMap(pet =>
    parseSkillList(pet.fixedSkillList).map(entry => ({
      kiboId: Number(pet.id),
      slot: entry.slot,
      skillId: entry.skillId,
      level: entry.level,
      sourceField: 'fixedSkillList',
    }))
  );
  const pveOccurrences = pets.flatMap(pet =>
    createPropertySkillOccurrences({
      pet,
      field: 'fPropertyskillList',
      mirrorField: 'bPropertyskillList',
      scopeClass: 'pve-combat-talent-passive',
      kibo: kiboById.get(Number(pet.id)),
      skillLevelsBySkillId,
      languageById,
    })
  );
  const pvpOccurrences = pets.flatMap(pet =>
    createPropertySkillOccurrences({
      pet,
      field: 'kiboFPropertyskillList',
      mirrorField: 'kiboBPropertyskillList',
      scopeClass: 'pvp-kibo-versus',
      kibo: kiboById.get(Number(pet.id)),
      skillLevelsBySkillId,
      languageById,
    })
  );

  const publicActions = (publicRuntimeCoverage.actions ?? []).filter(
    action => action.ownerKind === 'kibo'
  );
  const fixedSkills = createFixedSkillRows({
    occurrences: fixedOccurrences,
    skillsById,
    skillLevelsBySkillId,
    skillLogicById,
    languageById,
    publicActionSkillIds: new Set(
      publicActions.map(action => Number(action.sourceSkillId))
    ),
    sources,
  });
  const pvePassiveSkills = await createPvePassiveRows({
    occurrences: pveOccurrences,
    skillsById,
    skillLevelsBySkillId,
    skillLogicById,
    elementFormulasById,
    extractorBattleRoot,
    sources,
  });
  const pvpPassiveSkills = createPvpPassiveRows({
    occurrences: pvpOccurrences,
    skillsById,
    skillLevelsBySkillId,
    skillLogicById,
    sources,
  });
  const actionRows = publicActions.map(createPublicActionClosureRow);

  assertDenominator(
    'Workbench kibo',
    kibos.length,
    EXPECTED_DENOMINATORS.kiboCount
  );
  assertDenominator(
    'public kibo action',
    publicActions.length,
    EXPECTED_DENOMINATORS.publicActionCount
  );
  assertDenominator(
    'unique fixed skill',
    fixedSkills.length,
    EXPECTED_DENOMINATORS.fixedSkillUniqueCount
  );

  const generatedAt =
    kiboDocument.generatedAt ??
    publicRuntimeCoverage.generatedAt ??
    'source-generated-at-unavailable';
  const reportSources = createPortableReportSources(sources);
  const mechanicsCatalog = createPassiveMechanicsCatalog({
    generatedAt,
    pvePassiveSkills,
    sources,
  });
  const census = {
    schemaVersion: 1,
    kind: 'azpr-kibo-headless-mechanics-census',
    status: 'kibo-headless-mechanics-census-ready-with-explicit-gaps',
    generatedAt,
    denominators: {
      ...EXPECTED_DENOMINATORS,
      pvePassiveOccurrenceCount: pveOccurrences.length,
      pvePassiveUniqueCount: pvePassiveSkills.length,
      pvpPassiveOccurrenceCount: pvpOccurrences.length,
      pvpPassiveUniqueCount: pvpPassiveSkills.length,
    },
    sources: reportSources,
    fixedSkills,
    pvePassiveSkills,
    pvpPassiveSkills,
    publicActions: actionRows,
    summary: {
      fixedSkillClassification: countClosure(fixedSkills),
      pvePassiveMechanics: countClosure(pvePassiveSkills),
      pvpPassiveClassification: countClosure(pvpPassiveSkills),
      publicActionClosure: countClosure(actionRows),
      fixedSkillScopeClasses: countValues(
        fixedSkills.map(row => row.scopeClass)
      ),
      publicActionKinds: countValues(actionRows.map(row => row.actionKind)),
      traitTextMatchCount: [...pveOccurrences, ...pvpOccurrences].filter(
        row => row.traitTextMatch === true
      ).length,
      propertyFieldMirrorMismatchCount: [
        ...pveOccurrences,
        ...pvpOccurrences,
      ].filter(row => row.mirrorAligned === false).length,
    },
  };
  const maturityMatrix = createMaturityMatrix({
    generatedAt,
    kibos,
    fixedSkills,
    pvePassiveSkills,
    pvpPassiveSkills,
    publicActions: actionRows,
    sources: reportSources,
    staticAudit: kiboStaticAudit,
  });

  return {
    census,
    mechanicsCatalog,
    maturityMatrix,
  };
}

function createPortableReportSources(sources) {
  return {
    ...sources,
    kibos: 'src/data/generated/kibos.json',
    publicRuntimeCoverage: 'reports/verified-public-runtime-coverage.json',
  };
}

function createSourcePaths({ repoRoot, azprRoot, extractorBattleRoot }) {
  const tableRoot = path.join(
    azprRoot,
    'Assets',
    'ResourcesAssets',
    'Config',
    'NewTable'
  );
  return {
    kibos: path.join(repoRoot, 'src', 'data', 'generated', 'kibos.json'),
    verifiedMechanics: path.join(
      repoRoot,
      'src',
      'data',
      'generated',
      'verified-combat-mechanics-package.json'
    ),
    publicRuntimeCoverage: path.join(
      repoRoot,
      'reports',
      'verified-public-runtime-coverage.json'
    ),
    petTable: path.join(tableRoot, 'pet.json'),
    skillTable: path.join(tableRoot, 'skill.json'),
    skillLevelTable: path.join(tableRoot, 'skill_level.json'),
    skillLogicTable: path.join(tableRoot, 'skillsub_logic.json'),
    elementFormulaTable: path.join(tableRoot, 'element_formula.json'),
    skillLevelLanguage: path.join(
      azprRoot,
      'Assets',
      'ResourcesLang',
      'chs',
      'Table',
      'lang_skill_level.json'
    ),
    extractorBattleRoot,
    il2cppSlotEnum:
      'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs#PetUltraBlink/PetPuzzleSkill/KiBoVersusCommonSkill',
    il2cppPetPropertyInit:
      'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs#DataPropertyUtility.InitPetData/ResetPetAttr/IsFpropertyskill',
    il2cppDirectInjectTargetEnum:
      'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs#EDirectInjectTargetType.Self=0',
    il2cppPlayerTeamElementContract:
      'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs#EDirectInjectTargetType.Player=15/EElementTag.PlayerAllEntity=1000/PlayerAllHeroes=1001/PlayerAllPets=1002',
    il2cppEntityElementalTypeCondition:
      'C:/Codex/AzPr Extractor/outputs/il2cpp-dump/dump.cs#ChangePropertyConditionType.EntityElementType=1/ETargetType.Target=1/ECheckType.Inject=0/EEntityElementalType.Thunder=128',
    gameAssemblyPlayerTeamElementRuntime:
      'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll#InjectToOwnElementBehavior.GetInjectTargets@0x1814231B0/Player=15@0x181424462/AliveElementSystem.AfterTeamElement@0x181310290/ChangePropertyElement.CopyTo@0x18137A680/SetExecutor@0x18137D9F0',
    gameAssemblyInjectToOwnRootOwnership:
      'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll#InjectToOwnElementBehavior.Start@0x181425240/m_entity-pet-kibo-attacker-source/BaseElement.SetExecutor@0x18136CA20/AfterTeamElement-copy-preserves-attacker-source',
    gameAssemblyEntityElementalTypeCondition:
      'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll#ChangePropertyConditionObject.CheckCondition@0x1813845B0/ElementProperty.HasTargetElementType@0x1812D5350',
    il2cppTimeTriggerContract:
      'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs#EElementTriggerType.TimeEvent=0/ETimeEventTriggerType.LoopEvent=1/TTriggerElementParams.timeExeFirstFrame/triggerFrequency/triggerIntervalTimes/duration',
    gameAssemblyTimeTriggerRuntime:
      'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll#TriggerElement.Parse@0x1813BD9C0/BeforeExecute@0x1813B4AE0/Execute@0x1813B8880/OnUpdate@0x1813BD190/BaseElement.Update@0x18136D8A0/Trigger@0x1813BFE80/TriggerEffect@0x1813BE0C0',
    gameAssemblyElementFormulaRuntime:
      'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll#TriggerElement.CheckCondition@0x1813B58F0/FormulaUtility.Calculate@0x18187C840/CalcByOperator@0x18187B320/CalcAttributeValue@0x18187AF4E/AliveProperty.get_hp@0x1812ADB20',
    gameAssemblyRealDamageRuntime:
      'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll#FormulaUtility.GetOutputRealDamage@0x181883DB0/_CheckBlockFormulaId@0x18188AEB0/blockFormulaIdArr=103,104,106,107,108,109,40011001,40011002/FormulaUtility.ChangeHP@0x18187C950',
    gameAssemblyElementOwnerTargetRuntime:
      'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll#TriggerElement.TriggerEffect@0x1813BE0C0/ETriggerEffectTargetType.ElementOwner=11/trigger-data-self-element-owner/InjectToOwnElementBehavior.Start@0x181425240',
    gameAssemblyCooldownAttributeRuntime:
      'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll#CoolDown.get_coolDown@RVA0x12D0670/property115@0x12D06F6/dynamicChangePercent@0x12D0723/dynamicExtra@0x12D073D/(1+all+slot)*base@0x12D0823,0x12D0831,0x12D083F/get_minCd@0x12D08A4/Mathf.Max@0x12D08CA/CoolDown.get_minCd@RVA0x12D0A80',
    gameAssemblyCooldownPropertyMutationRuntime:
      'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll#AliveProperty.ChangeProperty@RVA0x12A6A00/calculateType.Percentage=2@0x12A6F38/SetDynamicChangePercent@0x12A7057,0x12A713C->0x12BF750/ChangePropertyElement.Combine@RVA0x137A120/combineType4@0x137A432/old+incoming+Math.Min(combineNumber)@0x137A481-0x137A4F0/CombineLayer@RVA0x1383360/DecreaseLayer@RVA0x13834A0',
    gameAssemblyAcceptedSkillStartRuntime:
      'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll#AliveSkillSystem.ITransmit.OnTransmit@RVA0x13EAA20/SkillStart=11/m_skills-accepted-lookup@0x13EB6CF,0x13EB6D9/reject-without-BeforeSkill@0x13EC19A/setCD-check@0x13EB730/CoolDown.Cast@0x13EB757,0x13EB7ED,0x13EB818/BeforeSkill@0x13EB8D1',
    gameAssemblyPetSkillCooldownEntryRuntime:
      'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll#CastPetUltimateAction.CastSkill@RVA0x13C3B80/get_coolDown@0x13C3CD3/RefreshCoolTime@0x13C3CEA/SkillStart@0x13C3E72/SkillUtility.CastJointStrikeSkill@RVA0x18B1EB0/PetJoint-slot601@0x18B2111/JointStrikeSkillCastSkillAction.OnEnter@RVA0x19B6990/CastPetSkill@0x19B6C4E/Pet-SkillStart@0x19B63F9',
    gameAssemblySkillTransmitArgsDefaults:
      'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll#SkillTransmitArgs.setCD+0x62/costHint+0x66/ctor@0x12552A8,0x12552B0=setCD1/OnReset@0x1255124=setCD1,0x12551E4=costHint1/generic-setCD-false-skips-Cast-but-still-BeforeSkill@0x13EB730->0x13EB822->0x13EB8D1',
    gameAssemblyCooldownDebugRuntime:
      'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll#CoolDown.get_coolDown-debug-read@0x12D0847/debug-multiply-only-if-positive@0x12D0975/Macro.cctor@RVA0x1225B10/default-zero@0x1225D36,0x1225F4A',
    gameAssemblySkillMinimumCooldownRuntime:
      'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll#SkillUtility.GetMicCdPer@RVA0x18B5350/SkillPlayer.GetMicCdPer@RVA0x13E91A0/SKILL_MIN_CD_PER-string@RVA0xC303620/GetSkill->GetMicCdPer@0x4A9064C->AliveProperty.SetSkillMinCdPer@0x12AC1F0/alternate@0x4FA27AA,0x4FA27C0',
    gameSkillMinimumCooldownConfig: `${path.join(tableRoot, 'game.json')}#SKILL_MIN_CD_PER=2500|2500|2500`,
    gameAssemblyHealRuntime:
      'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll#DamageElement.BeforeExecute@0x18138BA10/Parse@0x18138E5E0/FormulaUtility.GetOutputHeal@0x181882B60/FormulaUtility.ChangeHP@0x18187C950',
    il2cppBattlePropertyType:
      'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs#EBattlePropertyType.SHOOT_DMGUP=21/SPEED_RATIO=45/WATER_SHOOTDMGUP=57/CD_SKILL=115',
    il2cppChangePropertyConditions:
      'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs#ChangePropertyConditionData.ConditionType.CurSkillTag=5/ETargetType.Self=0/ECheckType.Inject=0/Away=1(持续检测条件是否满足)',
    il2cppElementTriggerConditions:
      'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs#EElementTriggerFixedConditionType.TargetEntityType=2/CheckSkillType=11/EElementTriggerConditionType.AND=0/OR=1/EEntityType',
    il2cppElementTriggerEvents:
      'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs#EElementTriggerEventType.AfterDamage=2/AfterReceiveDamage=4/BeforeSkill=5',
    il2cppTriggerEffectTargets:
      'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs#ETriggerEffectTargetType.Self=0/Target=1/PetOwner=8/ElementOwner=11',
    il2cppTriggerDataDamage:
      'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs#ElementTriggerDataBase.source/target/self+ElementTriggerData_Damage',
    il2cppSkillTagEnum:
      'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs#ESkillTagType.PetNormalSkill=13/PetUltraSkill=14/PetJointStrikeSkill=15/PetBreakSkill=16/PetPassiveSkill=21',
    il2cppTriggerCounter:
      'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs#TTriggerElementParams.triggerCounter=检测事件次数',
    gameAssemblyTriggerCounterRuntime:
      'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll#TriggerElement.Parse@0x1813BD9C0/CanTrigger@0x1813B5770/Trigger@0x1813BFE80/OnReset_Internal@0x1813BC7F0/get_triggerCount@0x1813C04C0',
    gameAssemblyTriggerParseConfigFields:
      'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll#TriggerElement.Parse@0x1813BD9C0 reads TTriggerElementParams offsets 0x13c/0x140/0x144 but not sustainElement offset 0x138',
    il2cppDamageElementContract:
      'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs#TDamageElementParams.EDamageSourceType.Attacker=0/EDamageType.MeleePhysical=1/Real=6/EDamageElementalType.Fire=1/ignoreDamageEvent=忽略受承伤事件',
    il2cppPetOwnerDamageSourcePassiveContract:
      'C:/Codex/AzPr Extractor/outputs/il2cpp-dump/dump.cs#EDirectInjectTargetType.PetOwner=7/EElementTriggerEventType.AfterDamage=2/EElementTriggerFixedConditionType.CheckDamageType=4/EDamageType.All=9/EDamageElementalType.Aqua=6/Lumiere=8/ETriggerEffectTargetType.Source=2/EBattlePropertyType.SPGETUP=105/EElementClearType.executorExitBattleFieldClear=16|ExitBattleClear=64',
  };
}

const PRACTICAL_UNLIMITED_TRIGGER_COUNTER = 9_999_999;

export function classifyTriggerCounterLifetime(rawValue) {
  const configuredTriggerCounter = Number(rawValue);
  if (!Number.isInteger(configuredTriggerCounter)) {
    return {
      configuredTriggerCounter: null,
      triggerLifetime: 'evidence-open',
      maxTriggerCount: null,
      triggerLifetimeBasis: 'trigger-counter-not-an-integer',
    };
  }
  if (configuredTriggerCounter === -1) {
    return {
      configuredTriggerCounter,
      triggerLifetime: 'unlimited',
      maxTriggerCount: null,
      triggerLifetimeBasis:
        'negative-sentinel-not-limited-by-trigger-element-can-trigger',
    };
  }
  if (configuredTriggerCounter === PRACTICAL_UNLIMITED_TRIGGER_COUNTER) {
    return {
      configuredTriggerCounter,
      triggerLifetime: 'unlimited',
      maxTriggerCount: null,
      triggerLifetimeBasis:
        'current-client-practical-unlimited-sentinel-9999999',
    };
  }
  if (configuredTriggerCounter > 0) {
    return {
      configuredTriggerCounter,
      triggerLifetime: 'finite',
      maxTriggerCount: configuredTriggerCounter,
      triggerLifetimeBasis:
        'positive-limit-enforced-by-trigger-element-can-trigger',
    };
  }
  return {
    configuredTriggerCounter,
    triggerLifetime: 'evidence-open',
    maxTriggerCount: null,
    triggerLifetimeBasis: 'zero-counter-runtime-semantics-not-observed',
  };
}

function createFixedSkillRows({
  occurrences,
  skillsById,
  skillLevelsBySkillId,
  skillLogicById,
  languageById,
  publicActionSkillIds,
  sources,
}) {
  return [...groupRows(occurrences, row => row.skillId).entries()]
    .map(([skillId, skillOccurrences]) => {
      const slots = uniqueSorted(skillOccurrences.map(row => row.slot));
      const slotSemantics = slots.map(slot => FIXED_SLOT_SEMANTICS[slot] ?? null);
      const knownSlotScopes = uniqueSorted(
        slotSemantics.map(entry => entry?.scope ?? 'unknown')
      );
      const allSlotsKnown = slotSemantics.every(Boolean);
      const scopeClass =
        allSlotsKnown && knownSlotScopes.length === 1
          ? knownSlotScopes[0]
          : 'unresolved';
      const inPublicActionSurface =
        publicActionSkillIds?.has(Number(skillId)) === true;
      const nonCombatGuardFailed =
        scopeClass === 'non-combat-capability' && inPublicActionSurface;
      const closureClass =
        scopeClass === 'unresolved' || nonCombatGuardFailed
          ? 'unresolved'
          : 'evidence-closed';
      const firstLevel = firstSkillLevel(skillLevelsBySkillId, skillId);
      return {
        skillId,
        scopeClass,
        closureClass,
        confidence: closureClass === 'evidence-closed' ? 'high' : 'low',
        slots,
        kiboIds: uniqueSorted(skillOccurrences.map(row => row.kiboId)),
        occurrenceCount: skillOccurrences.length,
        sourceName: resolveLanguageValue(languageById, firstLevel?.name),
        sourceDescription: resolveLanguageValue(
          languageById,
          firstLevel?.skillDescribe
        ),
        slotSemantics,
        tableEvidence: {
          skillRow: skillsById.has(skillId),
          skillLevelRow: Boolean(firstLevel),
          skillLogicRow: skillLogicById.has(skillId),
          inPublicActionSurface,
        },
        unresolvedReasons:
          closureClass === 'unresolved'
            ? [
                ...(allSlotsKnown ? [] : ['fixed-skill-slot-semantics-not-yet-evidence-closed']),
                ...(nonCombatGuardFailed
                  ? ['fixed-skill-classified-non-combat-but-in-public-action-surface']
                  : []),
              ]
            : [],
        provenance: [
          `${sources.petTable}#rows[id].fixedSkillList`,
          sources.skillTable,
          sources.skillLevelTable,
          sources.skillLogicTable,
          sources.il2cppSlotEnum,
          ...slotSemantics.map(entry => entry?.sourceIdentity).filter(Boolean),
          'reports/verified-public-runtime-coverage.json#actions[ownerKind=kibo]',
        ],
      };
    })
    .sort((a, b) => a.skillId - b.skillId);
}

async function createPvePassiveRows({
  occurrences,
  skillsById,
  skillLevelsBySkillId,
  skillLogicById,
  elementFormulasById,
  extractorBattleRoot,
  sources,
}) {
  const rows = [];
  for (const [skillId, skillOccurrences] of groupRows(
    occurrences,
    row => row.skillId
  )) {
    const assetEvidence = await parseVerifiedPropertyEffectPassive({
      skillId,
      extractorBattleRoot,
      elementFormulasById,
    });
    const firstOccurrence = skillOccurrences[0];
    const firstLevel = firstSkillLevel(skillLevelsBySkillId, skillId);
    const sourceName =
      firstOccurrence?.sourceName ?? firstOccurrence?.traitName ?? null;
    const sourceDescription =
      firstOccurrence?.sourceDescription ??
      firstOccurrence?.traitDescription ??
      null;
    const mechanic = assetEvidence.mechanic
      ? {
          ...assetEvidence.mechanic,
          sourceTextDifferences: createPassiveSourceTextDifferences({
            sourceDescription,
            mechanic: assetEvidence.mechanic,
          }),
        }
      : null;
    const runtimeReady = mechanic && (mechanic.runtimeGaps?.length ?? 0) === 0;
    rows.push({
      skillId,
      scopeClass: 'pve-combat-talent-passive',
      closureClass: mechanic ? 'evidence-closed' : 'unresolved',
      classificationStatus: 'evidence-closed',
      runtimeStatus: runtimeReady ? 'runtime-ready' : 'runtime-unresolved',
      confidence: mechanic ? 'high' : 'low',
      sourceName,
      sourceDescription,
      kiboIds: uniqueSorted(skillOccurrences.map(row => row.kiboId)),
      occurrenceCount: skillOccurrences.length,
      fieldMirrorAligned: skillOccurrences.every(row => row.mirrorAligned),
      traitTextMatched: skillOccurrences.every(row => row.traitTextMatch),
      tableEvidence: {
        skillRow: skillsById.has(skillId),
        skillLevelRow: Boolean(firstLevel),
        skillLogicRow: skillLogicById.has(skillId),
        skillControlAsset: assetEvidence.controlSourceFiles.length > 0,
        elementAssetCount: assetEvidence.elementSourceFiles.length,
      },
      mechanic,
      ...(assetEvidence.unresolvedEvidence
        ? { unresolvedEvidence: assetEvidence.unresolvedEvidence }
        : {}),
      unresolvedReasons: mechanic
        ? []
        : uniqueValues(assetEvidence.unresolvedReasons),
      provenance: [
        `${sources.petTable}#rows[id].fPropertyskillList`,
        sources.skillTable,
        sources.skillLevelTable,
        sources.skillLogicTable,
        sources.il2cppPetPropertyInit,
        sources.il2cppDirectInjectTargetEnum,
        ...([
          'equipped-kibo-player-team-property-effect',
          'equipped-kibo-player-team-periodic-heal',
        ].includes(mechanic?.mechanismFamily)
          ? [
              sources.il2cppPlayerTeamElementContract,
              sources.gameAssemblyPlayerTeamElementRuntime,
              ...(mechanic.targetProjection?.filter
                ? [
                    sources.il2cppEntityElementalTypeCondition,
                    sources.gameAssemblyEntityElementalTypeCondition,
                  ]
                : []),
            ]
          : []),
        ...(mechanic?.mechanismFamily ===
        'equipped-kibo-player-team-periodic-heal'
          ? [
              sources.il2cppTimeTriggerContract,
              sources.gameAssemblyTimeTriggerRuntime,
              sources.gameAssemblyElementFormulaRuntime,
              sources.gameAssemblyHealRuntime,
              sources.gameAssemblyInjectToOwnRootOwnership,
            ]
          : []),
        ...(mechanic?.mechanismFamily ===
        'equipped-kibo-before-skill-composite-effect'
          ? [
              sources.gameAssemblyElementFormulaRuntime,
              sources.gameAssemblyRealDamageRuntime,
              sources.gameAssemblyElementOwnerTargetRuntime,
              sources.gameAssemblyInjectToOwnRootOwnership,
              sources.il2cppChangePropertyConditions,
            ]
          : []),
        ...(mechanic?.mechanismFamily ===
        'on-pet-owner-damage-source-property-effect'
          ? [sources.il2cppPetOwnerDamageSourcePassiveContract]
          : []),
        ...(mechanic?.beforeSkillTriggers?.some(
          entry => (entry.cooldownPropertyEffects?.length ?? 0) > 0
        )
          ? [
              sources.gameAssemblyCooldownAttributeRuntime,
              sources.gameAssemblyCooldownPropertyMutationRuntime,
              sources.gameAssemblyAcceptedSkillStartRuntime,
              sources.gameAssemblyPetSkillCooldownEntryRuntime,
              sources.gameAssemblySkillTransmitArgsDefaults,
              sources.gameAssemblyCooldownDebugRuntime,
              sources.gameAssemblySkillMinimumCooldownRuntime,
              sources.gameSkillMinimumCooldownConfig,
            ]
          : []),
        sources.il2cppBattlePropertyType,
        sources.il2cppElementTriggerConditions,
        sources.il2cppElementTriggerEvents,
        sources.il2cppTriggerEffectTargets,
        sources.il2cppTriggerDataDamage,
        sources.il2cppSkillTagEnum,
        sources.il2cppTriggerCounter,
        sources.gameAssemblyTriggerCounterRuntime,
        sources.gameAssemblyTriggerParseConfigFields,
        sources.il2cppDamageElementContract,
        sources.elementFormulaTable,
        ...assetEvidence.controlSourceFiles,
        ...assetEvidence.elementSourceFiles,
      ],
    });
  }
  return rows.sort((a, b) => a.skillId - b.skillId);
}

function createPassiveSourceTextDifferences({ sourceDescription, mechanic }) {
  const differences = [];
  const beforeSkillTrigger =
    mechanic?.trigger?.event === 'skill-before'
      ? mechanic.trigger
      : (mechanic?.beforeSkillTriggers ?? [])
          .map(entry => entry?.trigger)
          .find(trigger => trigger?.event === 'skill-before');
  if (
    beforeSkillTrigger &&
    /释放(?:一次)?特技后/.test(String(sourceDescription ?? ''))
  ) {
    differences.push({
      field: 'trigger.activationOrder',
      sourceTextClaim: '释放特技后',
      runtimeEvidence: 'EElementTriggerEventType.BeforeSkill=5',
      selectedRuntimeContract:
        beforeSkillTrigger.activationOrder ?? 'before-action',
      resolution: 'runtime-asset-authoritative-text-kept-for-cross-check',
    });
  }
  const reachableElementDescriptions = uniqueValues(
    mechanic?.sourceGraph?.reachableElementDescriptions ?? []
  ).filter(Boolean);
  const sourcePercentClaims = extractPercentClaims(sourceDescription);
  const elementPercentClaims = uniqueSorted(
    reachableElementDescriptions.flatMap(extractPercentClaims)
  );
  if (
    sourcePercentClaims.length > 0 &&
    elementPercentClaims.length > 0 &&
    sourcePercentClaims.join('|') !== elementPercentClaims.join('|')
  ) {
    const effects = [
      ...(mechanic.effects ?? []),
      ...[mechanic.effect].filter(Boolean),
      ...(mechanic.conditionalPropertyEffects ?? []),
      ...(mechanic.staticPropertyEffects ?? []),
      ...(mechanic.scenarioStartEffects ?? []),
      ...(mechanic.beforeSkillTriggers ?? []).flatMap(entry => [
        ...(entry.cooldownPropertyEffects ?? []),
        ...(entry.propertyEffects ?? []),
      ]),
    ];
    const propertyNumericEvidence = effects.flatMap(effect =>
      (effect.modifiers ?? []).map(modifier => ({
        attributeId: modifier.attributeId,
        bucket: modifier.bucket,
        valueRaw: modifier.valueRaw,
        sourceElementId: modifier.sourceElementId,
      }))
    );
    const healNumericEvidence = mechanic.heal?.formula
      ? [
          {
            kind: 'target-max-hp-ratio',
            coefficientRaw: mechanic.heal.formula.coefficientRaw,
            coefficientBasisPoints:
              mechanic.heal.formula.coefficientBasisPoints,
            baseExpression: mechanic.heal.formula.baseExpression,
            sourceElementId: mechanic.heal.sourceElementId,
          },
        ]
      : [];
    differences.push({
      field:
        healNumericEvidence.length > 0
          ? 'heal.formula.coefficientRaw'
          : 'effect.modifiers.valueRaw',
      sourceTextClaim: String(sourceDescription),
      runtimeAssetTextClaims: reachableElementDescriptions,
      runtimeNumericEvidence: [
        ...propertyNumericEvidence,
        ...healNumericEvidence,
      ],
      selectedRuntimeContract: 'numeric-element-config',
      resolution:
        'numeric-runtime-config-authoritative-text-difference-retained',
    });
  }
  return differences;
}

function extractPercentClaims(value) {
  return uniqueSorted(
    [...String(value ?? '').matchAll(/(-?\d+(?:\.\d+)?)%/g)].map(match =>
      Number(match[1])
    )
  );
}

function createPvpPassiveRows({
  occurrences,
  skillsById,
  skillLevelsBySkillId,
  skillLogicById,
  sources,
}) {
  return [...groupRows(occurrences, row => row.skillId).entries()]
    .map(([skillId, skillOccurrences]) => {
      const firstOccurrence = skillOccurrences[0];
      return {
        skillId,
        scopeClass: 'pvp-kibo-versus',
        closureClass: 'evidence-closed',
        classificationStatus: 'evidence-closed',
        runtimeStatus: 'out-of-pve-runtime-scope',
        confidence: 'high',
        sourceName:
          firstOccurrence?.sourceName ?? firstOccurrence?.traitName ?? null,
        sourceDescription:
          firstOccurrence?.sourceDescription ??
          firstOccurrence?.traitDescription ??
          null,
        kiboIds: uniqueSorted(skillOccurrences.map(row => row.kiboId)),
        occurrenceCount: skillOccurrences.length,
        fieldMirrorAligned: skillOccurrences.every(row => row.mirrorAligned),
        traitTextMatched: skillOccurrences.every(row => row.traitTextMatch),
        tableEvidence: {
          skillRow: skillsById.has(skillId),
          skillLevelRow: Boolean(
            firstSkillLevel(skillLevelsBySkillId, skillId)
          ),
          skillLogicRow: skillLogicById.has(skillId),
        },
        unresolvedReasons: [],
        provenance: [
          `${sources.petTable}#rows[id].kiboFPropertyskillList`,
          sources.skillTable,
          sources.skillLevelTable,
          sources.skillLogicTable,
        ],
      };
    })
    .sort((a, b) => a.skillId - b.skillId);
}

async function parseVerifiedPropertyEffectPassive({
  skillId,
  extractorBattleRoot,
  elementFormulasById,
}) {
  const controlDirectory = path.join(
    extractorBattleRoot,
    'SkillList',
    `skill_control_${skillId}.asset`,
    'MonoBehaviour'
  );
  const elementRoot = path.join(extractorBattleRoot, 'Element');
  const controlObjects = await readJsonDirectory(controlDirectory);
  const controlSourceFiles = controlObjects.map(row => row.sourceFile);
  const controlRoot = controlObjects.find(
    row => Number(row.value?.skillControlData?.skillId) === Number(skillId)
  );
  const behaviors = controlObjects.filter(row =>
    Array.isArray(row.value?.elementDataList)
  );
  const behavior = behaviors[0] ?? null;
  const elementDirectories = (
    await safeReadDirectory(elementRoot, {
      withFileTypes: true,
    })
  ).filter(
    entry =>
      entry.isDirectory() &&
      entry.name.startsWith(`ast_${skillId}`) &&
      entry.name.endsWith('.asset')
  );
  const elementObjects = [];
  for (const directory of elementDirectories) {
    elementObjects.push(
      ...(await readJsonDirectory(
        path.join(elementRoot, directory.name, 'MonoBehaviour')
      ))
    );
  }
  const elementSourceFiles = elementObjects.map(row => row.sourceFile);
  const unresolvedReasons = [];
  if (!controlRoot) {
    unresolvedReasons.push('passive-control-root-missing');
  }
  if (elementObjects.length === 0) {
    unresolvedReasons.push('passive-element-assets-missing');
  }
  if (unresolvedReasons.length > 0) {
    return {
      mechanic: null,
      unresolvedReasons,
      controlSourceFiles,
      elementSourceFiles,
    };
  }

  const beforeSkillCompositeEvidence = parseBeforeSkillCompositeEffectPassive({
    controlRoot,
    behaviors,
    elementObjects,
    elementFormulasById,
  });
  if (beforeSkillCompositeEvidence) {
    return {
      mechanic: beforeSkillCompositeEvidence.mechanic ?? null,
      unresolvedReasons: beforeSkillCompositeEvidence.unresolvedReasons ?? [],
      ...(beforeSkillCompositeEvidence.evidence
        ? { unresolvedEvidence: beforeSkillCompositeEvidence.evidence }
        : {}),
      controlSourceFiles,
      elementSourceFiles,
    };
  }

  const compositeStaticAndDamageMechanic =
    parseCompositeStaticAndDamagePropertyEffectPassive({
      controlRoot,
      behaviors,
      elementObjects,
    });
  if (compositeStaticAndDamageMechanic) {
    return {
      mechanic: compositeStaticAndDamageMechanic,
      unresolvedReasons: [],
      controlSourceFiles,
      elementSourceFiles,
    };
  }

  const playerTeamPeriodicHealMechanic = parsePlayerTeamPeriodicHealPassive({
    controlRoot,
    behaviors,
    elementObjects,
    elementFormulasById,
  });
  if (playerTeamPeriodicHealMechanic) {
    return {
      mechanic: playerTeamPeriodicHealMechanic,
      unresolvedReasons: [],
      controlSourceFiles,
      elementSourceFiles,
    };
  }

  const playerTeamPropertyMechanic = parsePlayerTeamPropertyEffectPassive({
    controlRoot,
    behaviors,
    elementObjects,
  });
  if (playerTeamPropertyMechanic) {
    return {
      mechanic: playerTeamPropertyMechanic,
      unresolvedReasons: [],
      controlSourceFiles,
      elementSourceFiles,
    };
  }

  const staticSelfMechanic = parseStaticPropertyEffectPassive({
    controlRoot,
    behaviors,
    elementObjects,
  });
  if (staticSelfMechanic) {
    return {
      mechanic: staticSelfMechanic,
      unresolvedReasons: [],
      controlSourceFiles,
      elementSourceFiles,
    };
  }

  if (!behavior) {
    return {
      mechanic: null,
      unresolvedReasons: ['passive-control-element-injection-missing'],
      controlSourceFiles,
      elementSourceFiles,
    };
  }

  const petOwnerDamageSourceMechanic =
    parsePetOwnerDamageSourcePropertyEffectPassive({
      controlRoot,
      behaviors,
      elementObjects,
    });
  if (petOwnerDamageSourceMechanic) {
    return {
      mechanic: petOwnerDamageSourceMechanic,
      unresolvedReasons: [],
      controlSourceFiles,
      elementSourceFiles,
    };
  }

  const beforeSkillMechanic = parseBeforeSkillPropertyEffectPassive({
    controlRoot,
    behaviors,
    elementObjects,
  });
  if (beforeSkillMechanic) {
    return {
      mechanic: beforeSkillMechanic,
      unresolvedReasons: [],
      controlSourceFiles,
      elementSourceFiles,
    };
  }

  const damageSelfMechanic = parseDamageSelfPropertyEffectPassive({
    controlRoot,
    behaviors,
    elementObjects,
  });
  if (damageSelfMechanic) {
    return {
      mechanic: damageSelfMechanic,
      unresolvedReasons: [],
      controlSourceFiles,
      elementSourceFiles,
    };
  }

  const derivedDamageMechanic = parseDerivedDamagePassive({
    controlRoot,
    behaviors,
    elementObjects,
    elementFormulasById,
  });
  if (derivedDamageMechanic) {
    return {
      mechanic: derivedDamageMechanic,
      unresolvedReasons: [],
      controlSourceFiles,
      elementSourceFiles,
    };
  }

  const derivedDotSelfHealMechanic = parseDerivedDotAndSelfHealPassive({
    controlRoot,
    behaviors,
    elementObjects,
    elementFormulasById,
  });
  if (derivedDotSelfHealMechanic) {
    return {
      mechanic: derivedDotSelfHealMechanic,
      unresolvedReasons: [],
      controlSourceFiles,
      elementSourceFiles,
    };
  }

  const receiveDamageMechanic =
    parseAfterReceiveDamageSelfPropertyEffectPassive({
      controlRoot,
      behaviors,
      elementObjects,
    });
  if (receiveDamageMechanic) {
    return {
      mechanic: receiveDamageMechanic,
      unresolvedReasons: [],
      controlSourceFiles,
      elementSourceFiles,
    };
  }

  const retaliationDamageMechanic =
    parseAfterReceiveDamageRetaliationDamagePassive({
      controlRoot,
      behaviors,
      elementObjects,
      elementFormulasById,
    });
  if (retaliationDamageMechanic) {
    return {
      mechanic: retaliationDamageMechanic,
      unresolvedReasons: [],
      controlSourceFiles,
      elementSourceFiles,
    };
  }

  const incomingDamageEvidence = parseIncomingDamagePropertyEffectEvidence({
    controlRoot,
    behaviors,
    elementObjects,
  });
  if (incomingDamageEvidence) {
    return {
      mechanic: null,
      unresolvedReasons: incomingDamageEvidence.unresolvedReasons,
      unresolvedEvidence: incomingDamageEvidence.evidence,
      controlSourceFiles,
      elementSourceFiles,
    };
  }

  const areaAuraMechanic = parseAreaAuraPropertyPassive({
    controlRoot,
    behaviors,
    elementObjects,
  });
  if (areaAuraMechanic) {
    return {
      mechanic: areaAuraMechanic,
      unresolvedReasons: [],
      controlSourceFiles,
      elementSourceFiles,
    };
  }

  const damageTriggerCandidates = elementObjects.filter(
    row =>
      Array.isArray(row.value?.triggerEffectList) &&
      row.value.triggerEffectList.length >= 1 &&
      row.value.triggerType === 1 &&
      row.value.triggerParam1 === 2 &&
      Number.isFinite(Number(row.value.triggerInv)) &&
      Number(row.value.triggerInv) >= 0 &&
      row.value.triggerEffectList.every(
        effect =>
          Number(effect.effectType) === 0 && Number(effect.targetType) === 1
      )
  );
  const triggerCandidates = damageTriggerCandidates.filter(row =>
    isSupportedDamageTriggerCondition(row.value)
  );
  const allTriggerElements = elementObjects.filter(row =>
    Array.isArray(row.value?.triggerEffectList)
  );
  const wrapperCandidates = elementObjects.filter(
    row =>
      Array.isArray(row.value?.injectElementDataList) &&
      row.value.injectElementDataList.length >= 1 &&
      Number(row.value?.combineNumber) >= 1 &&
      [3, 4].includes(Number(row.value?.combineType)) &&
      Number.isFinite(Number(row.value?.time)) &&
      Number(row.value.time) >= -1
  );
  const propertyCandidates = elementObjects.filter(
    row =>
      Number.isInteger(Number(row.value?.attributeID)) &&
      Object.hasOwn(
        PROPERTY_BUCKET_BY_CALCULATE_TYPE,
        Number(row.value?.calculateType)
      ) &&
      Number.isFinite(Number(row.value?.time)) &&
      Number(row.value.time) >= -1 &&
      Array.isArray(row.value?.functionParams) &&
      Number.isFinite(Number(row.value.functionParams[0])) &&
      (row.value.defaultConditions?.length ?? 0) === 0 &&
      (row.value.changePeopertyConditionArrayDatas?.length ?? 0) === 0
  );
  if (triggerCandidates.length !== 1) {
    if (
      damageTriggerCandidates.length === 1 &&
      damageTriggerCandidates[0].value.triggerConditionList?.length > 0
    ) {
      unresolvedReasons.push(
        `passive-trigger-condition-semantics-unresolved:${damageTriggerCandidates[0].value.triggerConditionList
          .map(
            condition =>
              `${condition.conditionParam1}/${condition.conditionParam2}/${condition.conditionParam3}/${condition.conditionParam4}`
          )
          .join(',')}`
      );
    } else {
      unresolvedReasons.push(
        'passive-supported-damage-trigger-shape-not-unique'
      );
    }
  }
  if (allTriggerElements.length !== 1) {
    unresolvedReasons.push('passive-additional-trigger-elements-unmodeled');
  }
  const trigger = triggerCandidates[0];
  if (!trigger) {
    return {
      mechanic: null,
      unresolvedReasons,
      controlSourceFiles,
      elementSourceFiles,
    };
  }

  const triggerTargetPathIds = extractObjectPathIds(
    trigger.raw,
    'targetElement'
  );
  const uniqueTriggerTargetPathIds = uniqueValues(triggerTargetPathIds);
  const behaviorPathIds = extractArrayPathIds(behavior.raw, 'elementDataList');
  const controlResourcePathIds = extractArrayPathIds(
    controlRoot.raw,
    'elements'
  );
  if (
    triggerTargetPathIds.length !== trigger.value.triggerEffectList.length ||
    uniqueTriggerTargetPathIds.length !== triggerTargetPathIds.length
  ) {
    unresolvedReasons.push('passive-trigger-target-reference-not-unique');
  }
  if (!behaviorPathIds.includes(trigger.pathId)) {
    unresolvedReasons.push('passive-control-trigger-reference-mismatch');
  }
  const propertyByPathId = new Map(
    propertyCandidates.map(row => [row.pathId, row])
  );
  const wrapperByPathId = new Map(
    wrapperCandidates.map(row => [row.pathId, row])
  );
  const effectGraphs = [];
  for (const triggerTargetPathId of uniqueTriggerTargetPathIds) {
    const wrapper = wrapperByPathId.get(triggerTargetPathId) ?? null;
    const directProperty = propertyByPathId.get(triggerTargetPathId) ?? null;
    let properties = [];
    if (wrapper) {
      const wrapperChildPathIds = extractArrayPathIds(
        wrapper.raw,
        'injectElementDataList'
      );
      properties = wrapperChildPathIds
        .map(pathId => propertyByPathId.get(pathId))
        .filter(Boolean);
      if (
        properties.length !== wrapperChildPathIds.length ||
        properties.length === 0
      ) {
        unresolvedReasons.push('passive-wrapper-property-reference-mismatch');
      }
    } else if (
      directProperty &&
      [1, 3, 4].includes(Number(directProperty.value.combineType))
    ) {
      properties = [directProperty];
    } else {
      unresolvedReasons.push(
        'passive-trigger-property-effect-reference-unresolved'
      );
    }
    const effectContainer = wrapper ?? directProperty;
    if (effectContainer && properties.length > 0) {
      effectGraphs.push({ effectContainer, properties });
    }
  }
  const fullElementPathIds = uniqueSorted([
    trigger.pathId,
    ...effectGraphs.flatMap(({ effectContainer, properties }) => [
      effectContainer.pathId,
      ...properties.map(row => row.pathId),
    ]),
  ]);
  if (
    fullElementPathIds.some(pathId => !controlResourcePathIds.includes(pathId))
  ) {
    unresolvedReasons.push('passive-control-resource-map-incomplete');
  }
  if (
    controlResourcePathIds.some(pathId => !fullElementPathIds.includes(pathId))
  ) {
    unresolvedReasons.push('passive-unmodeled-control-resource-elements');
  }
  if (unresolvedReasons.length > 0) {
    return {
      mechanic: null,
      unresolvedReasons,
      controlSourceFiles,
      elementSourceFiles,
    };
  }

  const effects = effectGraphs.map(({ effectContainer, properties }) => {
    const effectTime = Number(effectContainer.value.time);
    const effectCombineType = Number(effectContainer.value.combineType);
    return {
      target: 'enemy',
      durationMs: effectTime === -1 ? null : effectTime,
      expiration: effectTime === -1 ? 'battle-exit' : 'duration',
      stackMode: effectCombineType === 4 ? 'stack' : 'refresh',
      stackDelta: 1,
      maxStacks:
        effectCombineType === 4
          ? Number(effectContainer.value.combineNumber)
          : 1,
      refreshRule:
        effectCombineType === 4
          ? 'stack-and-refresh-duration'
          : 'refresh-duration',
      sourceElementId: Number(effectContainer.value.elementConfigId),
      sourcePathId: effectContainer.pathId,
      modifiers: properties.map(row => ({
        kind: 'battle-property',
        attributeId: Number(row.value.attributeID),
        bucket:
          PROPERTY_BUCKET_BY_CALCULATE_TYPE[Number(row.value.calculateType)],
        valueRaw: Number(row.value.functionParams[0]),
        sourceElementId: Number(row.value.elementConfigId),
        sourcePathId: row.pathId,
      })),
    };
  });
  const triggerCondition = parseDamageTriggerCondition(trigger.value);
  const triggerLifetime = classifyTriggerCounterLifetime(
    trigger.value.triggerCounter
  );
  return {
    mechanic: {
      mechanismFamily: 'on-kibo-damage-enemy-property-effect',
      trigger: {
        event: 'damage-dealt',
        sourceScope: 'equipped-kibo',
        target: 'hit-enemy',
        internalCooldownMs: Number(trigger.value.triggerInv),
        activationOrder: 'after-triggering-hit',
        activationDelayMs: 0.001,
        sourceElementId: Number(trigger.value.elementConfigId),
        sourcePathId: trigger.pathId,
        ...triggerLifetime,
        triggerLimitScope: 'passive-element-lifetime',
        ...(triggerCondition ? { condition: triggerCondition } : {}),
      },
      ...(effects.length === 1 ? { effect: effects[0] } : { effects }),
      ownership: {
        source: 'equipped-kibo',
        effectAdder: 'equipped-kibo',
        foregroundRequirement: 'none-in-source-assets',
      },
      scenarioAssumptions: [],
      evidenceStatus: 'source-verified',
    },
    unresolvedReasons: [],
    controlSourceFiles,
    elementSourceFiles,
  };
}

function isSupportedDamageTriggerCondition(trigger) {
  const conditions = trigger?.triggerConditionList ?? [];
  return (
    conditions.length === 0 || parseDamageTriggerCondition(trigger) != null
  );
}

function parseDamageTriggerCondition(trigger) {
  return (
    parseDamageTargetEntityCondition(trigger) ?? parseSkillTagCondition(trigger)
  );
}

function parseDamageTargetEntityCondition(trigger) {
  const conditions = trigger?.triggerConditionList ?? [];
  if (conditions.length === 0) return null;
  if (Number(trigger?.triggerConditionType) !== 1) return null;
  if (
    conditions.some(
      condition =>
        Number(condition.conditionParam1) !== 2 ||
        Number(condition.conditionParam3) !== 0 ||
        Number(condition.conditionParam4) !== 0 ||
        !Object.hasOwn(
          ENTITY_TYPE_NAME_BY_ID,
          Number(condition.conditionParam2)
        )
    )
  ) {
    return null;
  }
  const targetEntityTypes = uniqueSorted(
    conditions.map(condition => Number(condition.conditionParam2))
  );
  return {
    kind: 'target-entity-type',
    logic: 'or',
    fixedConditionType: 2,
    fixedConditionName: 'TargetEntityType',
    targetEntityTypes,
    targetEntityTypeNames: targetEntityTypes.map(
      entityType => ENTITY_TYPE_NAME_BY_ID[entityType]
    ),
  };
}

function parseDamageTypeAndElementalTypeCondition(trigger) {
  const conditions = trigger?.triggerConditionList ?? [];
  const conditionLogic = Number(trigger?.triggerConditionType);
  if (conditions.length === 0 || ![0, 1].includes(conditionLogic)) return null;
  if (
    conditions.some(
      condition =>
        Number(condition.conditionParam1) !== 4 ||
        Number(condition.conditionParam4) !== 0 ||
        !Object.hasOwn(
          DAMAGE_TYPE_NAME_BY_ID,
          Number(condition.conditionParam2)
        ) ||
        !Object.hasOwn(
          DAMAGE_ELEMENTAL_TYPE_NAME_BY_ID,
          Number(condition.conditionParam3)
        )
    )
  ) {
    return null;
  }
  const clauses = conditions.map(condition => ({
    damageType: Number(condition.conditionParam2),
    damageTypeName: DAMAGE_TYPE_NAME_BY_ID[Number(condition.conditionParam2)],
    elementalType: Number(condition.conditionParam3),
    elementalTypeName:
      DAMAGE_ELEMENTAL_TYPE_NAME_BY_ID[Number(condition.conditionParam3)],
  }));
  const damageTypes = uniqueSorted(clauses.map(clause => clause.damageType));
  const elementalTypes = uniqueSorted(
    clauses.map(clause => clause.elementalType)
  );
  return {
    kind: 'damage-type-and-elemental-type',
    logic: conditionLogic === 0 ? 'and' : 'or',
    fixedConditionType: 4,
    fixedConditionName: 'CheckDamageType',
    damageTypes,
    damageTypeNames: damageTypes.map(
      damageType => DAMAGE_TYPE_NAME_BY_ID[damageType]
    ),
    elementalTypes,
    elementalTypeNames: elementalTypes.map(
      elementalType => DAMAGE_ELEMENTAL_TYPE_NAME_BY_ID[elementalType]
    ),
    clauses,
  };
}

function decodeElementClearTypeFlags(clearType) {
  const normalized = Number(clearType);
  if (!Number.isInteger(normalized) || normalized < 0) return [];
  return Object.entries(ELEMENT_CLEAR_TYPE_FLAGS)
    .filter(([flag]) => (normalized & Number(flag)) !== 0)
    .map(([, name]) => name);
}

function parsePetOwnerDamageSourcePropertyEffectPassive({
  controlRoot,
  behaviors,
  elementObjects,
}) {
  if (behaviors.length !== 1) return null;
  const behavior = behaviors[0];
  if (Number(behavior.value?.directInjectTargetType) !== 7) return null;
  const rootPathIds = uniqueValues(
    extractArrayPathIds(behavior.raw, 'elementDataList')
  );
  if (rootPathIds.length !== 1) return null;

  const elementByPathId = new Map(
    elementObjects.map(element => [element.pathId, element])
  );
  const trigger = elementByPathId.get(rootPathIds[0]) ?? null;
  const triggerCondition = parseDamageTypeAndElementalTypeCondition(
    trigger?.value
  );
  const triggerEffects = trigger?.value?.triggerEffectList ?? [];
  if (
    !trigger ||
    triggerEffects.length !== 1 ||
    Number(trigger.value.triggerType) !== 1 ||
    Number(trigger.value.triggerParam1) !== 2 ||
    !Number.isFinite(Number(trigger.value.triggerInv)) ||
    Number(trigger.value.triggerInv) < 0 ||
    Number(triggerEffects[0].effectType) !== 0 ||
    Number(triggerEffects[0].targetType) !== 2 ||
    !triggerCondition ||
    (trigger.value.zeroEffectList?.length ?? 0) > 0 ||
    (trigger.value.finishEffectList?.length ?? 0) > 0 ||
    (trigger.value.zeroTriggerConditionList?.length ?? 0) > 0 ||
    (trigger.value.finishTriggerConditionList?.length ?? 0) > 0
  ) {
    return null;
  }

  const targetPathIds = extractObjectPathIds(trigger.raw, 'targetElement');
  if (targetPathIds.length !== 1) return null;
  const property = elementByPathId.get(targetPathIds[0]) ?? null;
  if (
    !property ||
    !isPlainPropertyElement(property.value) ||
    ![1, 3, 4].includes(Number(property.value.combineType))
  ) {
    return null;
  }

  const reachablePathIds = uniqueValues([trigger.pathId, property.pathId]);
  const controlResourcePathIds = uniqueValues(
    extractArrayPathIds(controlRoot.raw, 'elements')
  );
  if (!hasExactPathCoverage(controlResourcePathIds, reachablePathIds)) {
    return null;
  }

  const triggerLifetime = classifyTriggerCounterLifetime(
    trigger.value.triggerCounter
  );
  const effectTime = Number(property.value.time);
  const combineType = Number(property.value.combineType);
  const clearType = Number(property.value.clearType);
  const unreachableAssetElements = createUnreachableAssetElements({
    elementObjects,
    reachablePathIds: controlResourcePathIds,
  });
  return {
    mechanismFamily: 'on-pet-owner-damage-source-property-effect',
    controlInjection: {
      event: 'scenario-start',
      sourceScope: 'equipped-kibo',
      target: 'pet-owner',
      runtimeTargetKind: 'actor',
      directInjectTargetType: 7,
      directInjectTargetName: 'PetOwner',
      activationFrame: Number(behavior.value.startFrame),
      frameCount: Number(behavior.value.frameCount),
      removeElementOnEnd: Number(behavior.value.removeElementOnEnd) === 1,
      rootElementId: Number(trigger.value.elementConfigId),
      rootPathId: trigger.pathId,
    },
    trigger: {
      event: 'damage-dealt',
      eventType: 2,
      eventName: 'AfterDamage',
      sourceScope: 'pet-owner',
      target: 'damage-event-source',
      runtimeTargetKind: 'actor',
      triggerEffectTargetType: 2,
      triggerEffectTargetName: 'Source',
      internalCooldownMs: Number(trigger.value.triggerInv),
      activationOrder: 'after-triggering-hit',
      activationDelayMs: 0.001,
      sourceElementId: Number(trigger.value.elementConfigId),
      sourcePathId: trigger.pathId,
      ...triggerLifetime,
      triggerLimitScope: 'passive-element-lifetime',
      condition: triggerCondition,
    },
    effect: {
      target: 'pet-owner',
      runtimeTargetKind: 'actor',
      triggerEffectTargetType: 2,
      triggerEffectTargetName: 'Source',
      durationMs: effectTime === -1 ? null : effectTime,
      expiration:
        effectTime === -1
          ? 'target-exit-battlefield-or-battle-exit'
          : 'duration-or-clear-type',
      expirationTriggers: decodeElementClearTypeFlags(clearType),
      stackMode: combineType === 4 ? 'stack' : 'refresh',
      stackDelta: 1,
      maxStacks:
        combineType === 4
          ? Math.max(1, Number(property.value.combineNumber) || 1)
          : 1,
      refreshRule:
        combineType === 4 && effectTime === -1
          ? 'stack-until-clear'
          : combineType === 4
            ? 'stack-and-refresh-duration'
            : 'refresh-duration',
      combineType,
      combineNumber: Number(property.value.combineNumber),
      exitBattleClear: Number(property.value.exitBattleClear) === 1,
      clearType,
      clearTypeFlags: decodeElementClearTypeFlags(clearType),
      sourceElementId: Number(property.value.elementConfigId),
      sourcePathId: property.pathId,
      modifiers: [createBattlePropertyModifier(property)],
    },
    sourceGraph: {
      controlRootElementId: Number(trigger.value.elementConfigId),
      controlRootPathId: trigger.pathId,
      reachableElementIds: reachablePathIds.map(pathId =>
        Number(elementByPathId.get(pathId)?.value?.elementConfigId)
      ),
      reachablePathIds,
      reachableElementDescriptions: reachablePathIds
        .map(pathId =>
          String(elementByPathId.get(pathId)?.value?.describe ?? '')
        )
        .filter(Boolean),
      unreachableAssetElements,
      controlResourceCoverage: 'exact',
    },
    ownership: {
      source: 'equipped-kibo',
      controlInjectionTarget: 'pet-owner',
      triggerElementOwner: 'pet-owner',
      triggerEventSource: 'pet-owner-damage-source',
      triggeredEffectTarget: 'pet-owner-damage-source',
      foregroundRequirement: 'none-in-source-assets',
    },
    scenarioAssumptions: [],
    evidenceStatus: 'source-verified',
  };
}

function parseDamageSelfPropertyEffectPassive({
  controlRoot,
  behaviors,
  elementObjects,
}) {
  if (behaviors.length !== 1) return null;
  const behavior = behaviors[0];
  if (Number(behavior.value.directInjectTargetType) !== 0) return null;
  const behaviorPathIds = uniqueValues(
    extractArrayPathIds(behavior.raw, 'elementDataList')
  );
  if (behaviorPathIds.length !== 1) return null;

  const elementByPathId = new Map(
    elementObjects.map(element => [element.pathId, element])
  );
  const trigger = elementByPathId.get(behaviorPathIds[0]) ?? null;
  if (
    !trigger ||
    !Array.isArray(trigger.value?.triggerEffectList) ||
    trigger.value.triggerEffectList.length < 1 ||
    Number(trigger.value.triggerType) !== 1 ||
    Number(trigger.value.triggerParam1) !== 2 ||
    !Number.isFinite(Number(trigger.value.triggerInv)) ||
    Number(trigger.value.triggerInv) < 0 ||
    !trigger.value.triggerEffectList.every(
      effect =>
        Number(effect.effectType) === 0 && Number(effect.targetType) === 0
    ) ||
    !isSupportedDamageTriggerCondition(trigger.value)
  ) {
    return null;
  }

  const targetPathIds = extractObjectPathIds(trigger.raw, 'targetElement');
  if (
    targetPathIds.length !== trigger.value.triggerEffectList.length ||
    uniqueValues(targetPathIds).length !== targetPathIds.length
  ) {
    return null;
  }
  const properties = targetPathIds
    .map(pathId => elementByPathId.get(pathId))
    .filter(Boolean);
  if (
    properties.length !== targetPathIds.length ||
    properties.length === 0 ||
    properties.some(
      property =>
        !isPlainPropertyElement(property.value) ||
        ![1, 3, 4].includes(Number(property.value.combineType))
    )
  ) {
    return null;
  }

  const reachablePathIds = uniqueValues([
    trigger.pathId,
    ...properties.map(property => property.pathId),
  ]);
  const controlResourcePathIds = extractArrayPathIds(
    controlRoot.raw,
    'elements'
  );
  if (
    controlResourcePathIds.length !== reachablePathIds.length ||
    uniqueValues(controlResourcePathIds).length !==
      controlResourcePathIds.length ||
    reachablePathIds.some(pathId => !controlResourcePathIds.includes(pathId)) ||
    controlResourcePathIds.some(pathId => !reachablePathIds.includes(pathId))
  ) {
    return null;
  }

  const triggerLifetime = classifyTriggerCounterLifetime(
    trigger.value.triggerCounter
  );
  const triggerCondition = parseDamageTriggerCondition(trigger.value);
  const effects = properties.map(property => {
    const effectTime = Number(property.value.time);
    const combineType = Number(property.value.combineType);
    return {
      target: 'equipped-kibo',
      runtimeTargetKind: 'kibo',
      triggerEffectTargetType: 0,
      triggerEffectTargetName: 'Self',
      durationMs: effectTime === -1 ? null : effectTime,
      expiration: effectTime === -1 ? 'battle-exit' : 'duration',
      stackMode: combineType === 4 ? 'stack' : 'refresh',
      stackDelta: 1,
      maxStacks:
        combineType === 4
          ? Math.max(1, Number(property.value.combineNumber) || 1)
          : 1,
      refreshRule:
        combineType === 4 ? 'stack-and-refresh-duration' : 'refresh-duration',
      sourceElementId: Number(property.value.elementConfigId),
      sourcePathId: property.pathId,
      modifiers: [
        {
          kind: 'battle-property',
          attributeId: Number(property.value.attributeID),
          bucket:
            PROPERTY_BUCKET_BY_CALCULATE_TYPE[
              Number(property.value.calculateType)
            ],
          valueRaw: Number(property.value.functionParams[0]),
          sourceElementId: Number(property.value.elementConfigId),
          sourcePathId: property.pathId,
        },
      ],
    };
  });
  const unreachableAssetElements = elementObjects
    .filter(row => !controlResourcePathIds.includes(row.pathId))
    .map(row => ({
      sourceElementId: Number(row.value?.elementConfigId),
      sourcePathId: row.pathId,
      reason: 'not-referenced-by-control-resource-map',
    }));

  return {
    mechanismFamily: 'on-kibo-damage-self-property-effect',
    trigger: {
      event: 'damage-dealt',
      sourceScope: 'equipped-kibo',
      target: 'equipped-kibo',
      internalCooldownMs: Number(trigger.value.triggerInv),
      activationOrder: 'after-triggering-hit',
      activationDelayMs: 0.001,
      sourceElementId: Number(trigger.value.elementConfigId),
      sourcePathId: trigger.pathId,
      ...triggerLifetime,
      triggerLimitScope: 'passive-element-lifetime',
      ...(triggerCondition ? { condition: triggerCondition } : {}),
    },
    ...(effects.length === 1 ? { effect: effects[0] } : { effects }),
    sourceGraph: {
      controlRootElementId: Number(trigger.value.elementConfigId),
      controlRootPathId: trigger.pathId,
      reachableElementIds: reachablePathIds.map(pathId =>
        Number(elementByPathId.get(pathId)?.value?.elementConfigId)
      ),
      reachablePathIds,
      unreachableAssetElements,
    },
    ownership: {
      source: 'equipped-kibo',
      triggeredEffectTarget: 'equipped-kibo',
      effectAdder: 'equipped-kibo',
      foregroundRequirement: 'none-in-source-assets',
    },
    scenarioAssumptions: [],
    evidenceStatus: 'source-verified',
  };
}

function parseSkillTagCondition(trigger) {
  const conditions = trigger?.triggerConditionList ?? [];
  if (conditions.length === 0) return null;
  const conditionLogic = Number(trigger?.triggerConditionType);
  if (![0, 1].includes(conditionLogic)) return null;
  if (
    conditions.some(
      condition =>
        Number(condition.conditionParam1) !== 11 ||
        Number(condition.conditionParam3) !== 0 ||
        Number(condition.conditionParam4) !== 0 ||
        !Object.hasOwn(SKILL_TAG_NAME_BY_ID, Number(condition.conditionParam2))
    )
  ) {
    return null;
  }
  const requiredSkillTags = uniqueSorted(
    conditions.map(condition => Number(condition.conditionParam2))
  );
  return {
    kind: 'skill-tag',
    logic: conditionLogic === 0 ? 'and' : 'or',
    fixedConditionType: 11,
    fixedConditionName: 'CheckSkillType',
    requiredSkillTags,
    requiredSkillTagNames: requiredSkillTags.map(
      skillTag => SKILL_TAG_NAME_BY_ID[skillTag]
    ),
  };
}

function parseBeforeSkillCompositeEffectPassive({
  controlRoot,
  behaviors,
  elementObjects,
  elementFormulasById,
}) {
  if (behaviors.length !== 1) return null;
  const behavior = behaviors[0];
  if (Number(behavior.value?.directInjectTargetType) !== 0) return null;

  const rootPathIds = uniqueValues(
    extractArrayPathIds(behavior.raw, 'elementDataList')
  );
  const controlResourcePathIds = uniqueValues(
    extractArrayPathIds(controlRoot.raw, 'elements')
  );
  const elementByPathId = new Map(
    elementObjects.map(element => [element.pathId, element])
  );
  const rootElements = rootPathIds
    .map(pathId => elementByPathId.get(pathId))
    .filter(Boolean);
  if (
    rootPathIds.length === 0 ||
    rootElements.length !== rootPathIds.length ||
    controlResourcePathIds.length === 0
  ) {
    return null;
  }

  const directConditionalRealDamage =
    parseDirectConditionalRealDamageBeforeSkillComposite({
      behavior,
      rootElements,
      rootPathIds,
      controlResourcePathIds,
      elementByPathId,
      elementObjects,
      elementFormulasById,
    });
  if (directConditionalRealDamage) {
    return { mechanic: directConditionalRealDamage };
  }

  const wrappedCooldownCandidate = parseWrappedCooldownBeforeSkillComposite({
    behavior,
    rootElements,
    rootPathIds,
    controlResourcePathIds,
    elementByPathId,
    elementObjects,
    elementFormulasById,
  });
  if (wrappedCooldownCandidate) {
    return { mechanic: wrappedCooldownCandidate };
  }
  return null;
}

function parseDirectConditionalRealDamageBeforeSkillComposite({
  behavior,
  rootElements,
  rootPathIds,
  controlResourcePathIds,
  elementByPathId,
  elementObjects,
  elementFormulasById,
}) {
  if (rootElements.length !== 2) return null;
  const conditionalProperties = rootElements
    .map(row => ({ row, condition: parsePropertySkillTagCondition(row.value) }))
    .filter(row => row.condition);
  const triggers = rootElements.filter(row => isBeforeSkillTrigger(row));
  if (conditionalProperties.length !== 1 || triggers.length !== 1) return null;

  const conditionalProperty = conditionalProperties[0];
  const trigger = triggers[0];
  const triggerCondition = parseSkillTagCondition(trigger.value);
  const triggerTargetPathIds = extractObjectPathIds(
    trigger.raw,
    'targetElement'
  );
  const triggerEffect = trigger.value.triggerEffectList?.[0] ?? null;
  if (
    triggerTargetPathIds.length !== 1 ||
    Number(triggerEffect?.effectType) !== 0 ||
    Number(triggerEffect?.targetType) !== 11 ||
    !triggerCondition ||
    conditionalProperty.condition.requiredSkillTags.join('|') !==
      triggerCondition.requiredSkillTags.join('|')
  ) {
    return null;
  }
  const damageElement = elementByPathId.get(triggerTargetPathIds[0]) ?? null;
  const realDamage = parseCurrentHealthRealDamageElement({
    element: damageElement,
    elementFormulasById,
  });
  if (!realDamage) return null;

  const reachablePathIds = uniqueValues([...rootPathIds, damageElement.pathId]);
  if (!hasExactPathCoverage(controlResourcePathIds, reachablePathIds)) {
    return null;
  }
  const unreachableAssetElements = createUnreachableAssetElements({
    elementObjects,
    reachablePathIds,
  });
  const rootElementIds = rootElements.map(row =>
    Number(row.value.elementConfigId)
  );

  return {
    mechanismFamily: 'equipped-kibo-before-skill-composite-effect',
    controlInjection: {
      event: 'scenario-start',
      target: 'equipped-kibo',
      runtimeTargetKind: 'kibo',
      directInjectTargetType: 0,
      directInjectTargetName: 'Self',
      removeElementOnEnd: Number(behavior.value.removeElementOnEnd) === 1,
      rootElementIds,
      rootPathIds,
    },
    conditionalPropertyEffects: [
      createPropertyEffectEvidence({
        element: conditionalProperty.row,
        target: 'equipped-kibo',
        runtimeTargetKind: 'kibo',
        activation: 'passive-injection',
        condition: conditionalProperty.condition,
      }),
    ],
    beforeSkillTriggers: [
      {
        trigger: createBeforeSkillTriggerEvidence({
          trigger,
          condition: triggerCondition,
        }),
        effectTargets: [
          {
            target: 'equipped-kibo',
            runtimeTargetKind: 'kibo',
            triggerEffectTargetType: 11,
            triggerEffectTargetName: 'ElementOwner',
          },
        ],
        vitalChanges: [realDamage],
      },
    ],
    sourceGraph: {
      controlRootElementIds: rootElementIds,
      controlRootPathIds: rootPathIds,
      controlResourceElementIds: controlResourcePathIds.map(pathId =>
        Number(elementByPathId.get(pathId)?.value?.elementConfigId)
      ),
      controlResourcePathIds,
      reachableElementIds: reachablePathIds.map(pathId =>
        Number(elementByPathId.get(pathId)?.value?.elementConfigId)
      ),
      reachablePathIds,
      reachableElementDescriptions: reachablePathIds
        .map(pathId =>
          String(elementByPathId.get(pathId)?.value?.describe ?? '')
        )
        .filter(Boolean),
      unreachableAssetElements,
    },
    ownership: {
      source: 'equipped-kibo',
      elementOwner: 'equipped-kibo',
      formulaSelf: 'equipped-kibo',
      vitalChangeTarget: 'equipped-kibo',
      effectAdder: 'equipped-kibo',
      foregroundRequirement: 'none-in-source-assets',
    },
    nativeEvidenceContract: {
      propertyCondition: {
        evaluation: 'continuous-condition-check',
        maxChangeCountSemantics: 'opaque-not-used-as-trigger-limit',
      },
      formula103: {
        expression: realDamage.formula.baseExpression,
        self: 'element-owner-equipped-kibo-current-health',
        blockedFormulaIds: [...REAL_DAMAGE_BLOCKED_FORMULA_IDS],
        formulaIdIsBlocked: true,
        blockedConsequence:
          'skip-battle-config-miscellaneous-damage-multiplier',
      },
      realDamage: {
        outputPath: 'FormulaUtility.GetOutputRealDamage',
        minimumNominalOutput: 1,
        shieldPolicy: 'bypass',
        restraintPolicy: 'bypass',
        hpMutationPath: 'FormulaUtility.ChangeHP',
      },
      elementOwnerTarget: {
        triggerEffectTargetType: 11,
        triggerEffectTargetName: 'ElementOwner',
        sourceEntityRole: 'element-attacker-source-equipped-kibo',
        targetEntityRole: 'trigger-data-self-element-owner-equipped-kibo',
        rootOwnership:
          'InjectToOwnRoot-preserves-equipped-kibo-attacker-and-source',
      },
      skillCastOrder: [
        'resource-cost-committed',
        'cooldown-cast-committed',
        'current-skill-slot-written',
        'before-skill-trigger',
        'current-skill-id-written',
        'skill-start-event',
        'skill-player-start',
      ],
      lethalBoundary: {
        canReduceEquippedKiboToZero: true,
        synchronousSkillPlayerStartContinues: true,
        futureHitAfterDeathUpdateStatus:
          'unresolved-runtime-diagnostic-required',
      },
    },
    scenarioAssumptions: [],
    evidenceStatus: 'source-verified',
  };
}

function parseWrappedCooldownBeforeSkillComposite({
  behavior,
  rootElements,
  rootPathIds,
  controlResourcePathIds,
  elementByPathId,
  elementObjects,
  elementFormulasById,
}) {
  if (rootElements.length !== 1) return null;
  const wrapper = rootElements[0];
  if (
    !Array.isArray(wrapper.value?.injectElementDataList) ||
    wrapper.value.injectElementDataList.length !== 2 ||
    Number(wrapper.value.combineType) !== 3 ||
    Number(wrapper.value.combineNumber) !== 1 ||
    Number(wrapper.value.time) !== -1 ||
    Number(wrapper.value.exitBattleClear) !== 1
  ) {
    return null;
  }
  const childPathIds = extractArrayPathIds(
    wrapper.raw,
    'injectElementDataList'
  );
  if (childPathIds.length !== 2 || uniqueValues(childPathIds).length !== 2) {
    return null;
  }
  const children = childPathIds
    .map(pathId => elementByPathId.get(pathId))
    .filter(Boolean);
  if (children.length !== 2) return null;
  const staticProperties = children.filter(row =>
    isPlainPropertyElement(row.value)
  );
  const triggers = children.filter(row => isBeforeSkillTrigger(row));
  if (staticProperties.length !== 1 || triggers.length !== 1) return null;
  const staticProperty = staticProperties[0];
  if (
    Number(staticProperty.value.attributeID) !== 57 ||
    Number(staticProperty.value.calculateType) !== 1 ||
    Number(staticProperty.value.functionParams?.[0]) !== 2000 ||
    Number(staticProperty.value.combineType) !== 3 ||
    Number(staticProperty.value.combineNumber) !== 1 ||
    Number(staticProperty.value.time) !== -1
  ) {
    return null;
  }

  const trigger = triggers[0];
  const triggerCondition = parseSkillTagCondition(trigger.value);
  const triggerTargetPathIds = extractObjectPathIds(
    trigger.raw,
    'targetElement'
  );
  const triggerEffect = trigger.value.triggerEffectList?.[0] ?? null;
  if (
    triggerTargetPathIds.length !== 1 ||
    Number(triggerEffect?.effectType) !== 0 ||
    Number(triggerEffect?.targetType) !== 0 ||
    triggerCondition?.logic !== 'or' ||
    triggerCondition.requiredSkillTags.join('|') !== '14|15'
  ) {
    return null;
  }
  const cooldownProperty = elementByPathId.get(triggerTargetPathIds[0]) ?? null;
  if (
    !cooldownProperty ||
    !isPlainPropertyElement(cooldownProperty.value) ||
    Number(cooldownProperty.value.attributeID) !== 115 ||
    Number(cooldownProperty.value.calculateType) !== 2 ||
    Number(cooldownProperty.value.formulaParams?.function_2) !== 3 ||
    String(elementFormulasById?.get(3)?.functionOutput ?? '') !== 'A/10000' ||
    Number(cooldownProperty.value.functionParams?.[0]) !== -500 ||
    Number(cooldownProperty.value.combineType) !== 4 ||
    Number(cooldownProperty.value.combineNumber) !== 4 ||
    Number(cooldownProperty.value.time) !== -1 ||
    Number(cooldownProperty.value.exitBattleClear) !== 1
  ) {
    return null;
  }
  const reachablePathIds = uniqueValues([
    ...rootPathIds,
    ...childPathIds,
    cooldownProperty.pathId,
  ]);
  if (
    !hasExactPathCoverage(controlResourcePathIds, reachablePathIds) ||
    elementObjects.some(row => !reachablePathIds.includes(row.pathId))
  ) {
    return null;
  }
  return {
    mechanismFamily: 'equipped-kibo-before-skill-composite-effect',
    controlInjection: {
      event: 'scenario-start',
      target: 'equipped-kibo',
      runtimeTargetKind: 'kibo',
      directInjectTargetType: 0,
      directInjectTargetName: 'Self',
      removeElementOnEnd: Number(behavior.value.removeElementOnEnd) === 1,
      rootElementIds: [Number(wrapper.value.elementConfigId)],
      rootPathIds,
    },
    compositeWrapper: createElementLifecycleEvidence(wrapper),
    staticPropertyEffects: [
      createPropertyEffectEvidence({
        element: staticProperty,
        target: 'equipped-kibo',
        runtimeTargetKind: 'kibo',
        activation: 'parent-wrapper-injection',
        parentElement: wrapper,
      }),
    ],
    beforeSkillTriggers: [
      {
        trigger: {
          ...createBeforeSkillTriggerEvidence({
            trigger,
            condition: triggerCondition,
          }),
          acceptanceGate: 'accepted-skill-start',
          activationOrder:
            'after-accepted-skill-resolution-and-optional-cooldown-cast-before-skill-start',
          currentActionCooldownStackSnapshot: 'pre-trigger',
        },
        effectTargets: [
          {
            target: 'equipped-kibo',
            runtimeTargetKind: 'kibo',
            triggerEffectTargetType: 0,
            triggerEffectTargetName: 'Self',
          },
        ],
        cooldownPropertyEffects: [
          createPropertyEffectEvidence({
            element: cooldownProperty,
            target: 'equipped-kibo',
            runtimeTargetKind: 'kibo',
            activation: 'before-skill-trigger',
          }),
        ],
      },
    ],
    sourceGraph: {
      controlRootElementIds: [Number(wrapper.value.elementConfigId)],
      controlRootPathIds: rootPathIds,
      controlResourceElementIds: controlResourcePathIds.map(pathId =>
        Number(elementByPathId.get(pathId)?.value?.elementConfigId)
      ),
      controlResourcePathIds,
      reachableElementIds: reachablePathIds.map(pathId =>
        Number(elementByPathId.get(pathId)?.value?.elementConfigId)
      ),
      reachablePathIds,
      reachableElementDescriptions: reachablePathIds
        .map(pathId =>
          String(elementByPathId.get(pathId)?.value?.describe ?? '')
        )
        .filter(Boolean),
      unreachableAssetElements: [],
    },
    ownership: {
      source: 'equipped-kibo',
      elementOwner: 'equipped-kibo',
      staticPropertyTarget: 'equipped-kibo',
      triggeredPropertyTarget: 'equipped-kibo',
      effectAdder: 'equipped-kibo',
      foregroundRequirement: 'none-in-source-assets',
    },
    nativeEvidenceContract: {
      cooldownAttribute: {
        attributeId: 115,
        attributeName: 'CD_SKILL',
        calculateType: 2,
        calculateTypeName: 'Percentage',
        configuredBucket: 'dynamicPercent',
        elementFormulaId: 3,
        elementFormulaExpression: 'A/10000',
        valueRawPerStack: -500,
        percentBasisPointsPerStack: -500,
        maxStacks: 4,
        mutationPath: 'AliveProperty.ChangeProperty->SetDynamicChangePercent',
      },
      stacking: {
        combineType: 4,
        combineMode: 'old-plus-incoming-clamped-to-combine-number',
        combineNumber: 4,
        stackDeltaPerAcceptedSkillStart: 1,
        durationMs: null,
        expiration: 'battle-exit',
        refreshRule: 'stack-and-refresh-duration',
      },
      cooldownFormula: {
        expression:
          'max(baseCooldown*(1+(allSkillCdPercent+slotCdPercent)/10000),baseCooldown*skillMinCdPer/10000)',
        percentDenominator: 10000,
        allSkillPercentSource: {
          attributeId: 115,
          attributeName: 'CD_SKILL',
          bucket: 'dynamicPercent',
        },
        slotPercentSource: 'skill-slot-cooldown-property',
        clampFunction: 'Mathf.Max',
      },
      minimumCooldown: {
        configKey: 'SKILL_MIN_CD_PER',
        configuredValuesRaw: '2500|2500|2500',
        petEntityType: 11,
        kiboEntityType: 24,
        petMinimumBasisPoints: 2500,
        kiboMinimumBasisPoints: 2500,
        minimumMultiplier: 0.25,
        fourStackMultiplierBasisPoints: 8000,
        fourStackHitsMinimumClamp: false,
      },
      debugOverride: {
        field: 'Macro.DEBUG_AllSkillCDMultiValue',
        defaultValue: 0,
        activeOnlyWhenPositive: true,
        normalPveFormulaContribution: 0,
      },
      acceptedSkillStart: {
        contract: 'accepted-skill-start',
        transmitType: 11,
        transmitTypeName: 'SkillStart',
        acceptanceCheck: 'skill-present-in-alive-skill-system',
        rejectedUnknownSkillTriggersBeforeSkill: false,
        rejectedResourceOrActionRuleRequestAddsStack: false,
        triggerEvent: 'BeforeSkill',
        triggerEventType: 5,
      },
      currentVsSubsequentCooldownOrder: {
        currentAcceptedActionUses: 'pre-trigger-stack-count',
        newStackAppliesTo: 'subsequent-accepted-action-cooldown',
        normalSetCdTrueOrder: [
          'accepted-skill-start',
          'cooldown-cast-with-old-stack-count',
          'before-skill-trigger',
          'add-or-cap-cooldown-stack',
          'skill-start',
        ],
        acceptedActionCurrentMultipliersBasisPoints: [
          10000, 9500, 9000, 8500, 8000,
        ],
        acceptedActionPostTriggerStacks: [1, 2, 3, 4, 4],
      },
      publicKiboEntrypoints: {
        petUltra: {
          skillTag: 14,
          skillTagName: 'PetUltraSkill',
          setCdDefault: true,
          entersAcceptedSkillStart: true,
        },
        petJointStrike: {
          skillTag: 15,
          skillTagName: 'PetJointStrikeSkill',
          kiboSkillSlot: 601,
          setCdDefault: true,
          entersAcceptedSkillStart: true,
        },
      },
      genericSetCdFalseCaveat: {
        setCd: false,
        cooldownCastExecuted: false,
        beforeSkillStillTriggers: true,
        acceptedSkillStartStillRequired: true,
        policy:
          'do-not-globally-require-cooldown-cast-for-before-skill-trigger',
      },
      rvas: {
        coolDownGet: '0x12D0670',
        coolDownGetMinimum: '0x12D0A80',
        alivePropertyChangeProperty: '0x12A6A00',
        changePropertyElementCombine: '0x137A120',
        aliveSkillSystemOnTransmit: '0x13EAA20',
        castPetUltimateActionCastSkill: '0x13C3B80',
        skillUtilityCastJointStrikeSkill: '0x18B1EB0',
        jointStrikeSkillCastSkillActionOnEnter: '0x19B6990',
        macroStaticConstructor: '0x1225B10',
        skillUtilityGetMinimumCooldownPercent: '0x18B5350',
        skillPlayerGetMinimumCooldownPercent: '0x13E91A0',
      },
    },
    scenarioAssumptions: [],
    evidenceStatus: 'source-verified',
  };
}

function parsePropertySkillTagCondition(value) {
  const conditions = value?.defaultConditions ?? [];
  if (
    !isPropertyElement(value) ||
    Number(value.checkType) !== 1 ||
    conditions.length === 0 ||
    (value.changePeopertyConditionArrayDatas?.length ?? 0) > 0 ||
    conditions.some(
      condition =>
        Number(condition.conditionType) !== 5 ||
        Number(condition.targetType) !== 0 ||
        Number(condition.entityElementalType) !== 1023 ||
        Number(condition.subConditionType_Element) !== 0 ||
        Number(condition.skillId) !== 0 ||
        Number(condition.elementTag) !== 0 ||
        Number(condition.elementId) !== 0 ||
        !Object.hasOwn(SKILL_TAG_NAME_BY_ID, Number(condition.skillTag)) ||
        !Number.isFinite(Number(condition.maxChangeCount))
    )
  ) {
    return null;
  }
  const requiredSkillTags = uniqueSorted(
    conditions.map(condition => Number(condition.skillTag))
  );
  return {
    kind: 'battle-property-default-skill-tag',
    checkType: 1,
    checkTypeName: 'Away',
    evaluation: 'continuous-condition-check',
    requiredSkillTags,
    requiredSkillTagNames: requiredSkillTags.map(
      skillTag => SKILL_TAG_NAME_BY_ID[skillTag]
    ),
    conditions: conditions.map(condition => ({
      conditionType: Number(condition.conditionType),
      conditionTypeName: 'CurSkillTag',
      targetType: Number(condition.targetType),
      targetTypeName: 'Self',
      skillTag: Number(condition.skillTag),
      skillTagName: SKILL_TAG_NAME_BY_ID[Number(condition.skillTag)],
      entityElementalType: Number(condition.entityElementalType),
      subConditionTypeElement: Number(condition.subConditionType_Element),
      skillId: Number(condition.skillId),
      elementTag: Number(condition.elementTag),
      elementId: Number(condition.elementId),
      maxChangeCount: Number(condition.maxChangeCount),
      maxChangeCountSemantics: 'opaque-not-used-as-trigger-limit',
    })),
  };
}

function isBeforeSkillTrigger(element) {
  const value = element?.value;
  return (
    Array.isArray(value?.triggerEffectList) &&
    value.triggerEffectList.length === 1 &&
    Number(value.triggerType) === 1 &&
    Number(value.triggerParam1) === 5 &&
    Number(value.triggerParam2) === 0 &&
    Number.isFinite(Number(value.triggerInv)) &&
    Number(value.triggerInv) >= 0 &&
    parseSkillTagCondition(value) != null &&
    (value.zeroEffectList?.length ?? 0) === 0 &&
    (value.finishEffectList?.length ?? 0) === 0 &&
    (value.zeroTriggerConditionList?.length ?? 0) === 0 &&
    (value.finishTriggerConditionList?.length ?? 0) === 0
  );
}

function parseCurrentHealthRealDamageElement({ element, elementFormulasById }) {
  const value = element?.value;
  if (!value) return null;
  const commonFunctionId = Number(
    value.formulaParams?.function_1 ?? value.baseIntParams?.[0]
  );
  const baseFunctionId = Number(
    value.formulaParams?.function_2 ?? value.baseIntParams?.[1]
  );
  const coefficientRaw = Number(
    value.formulaParams?.formulaParamValues?.[0] ?? value.functionParams?.[0]
  );
  const commonExpression = String(
    elementFormulasById?.get(commonFunctionId)?.functionOutput ?? ''
  );
  const baseExpression = String(
    elementFormulasById?.get(baseFunctionId)?.functionOutput ?? ''
  );
  if (
    commonFunctionId !== 1 ||
    commonExpression !== 'G/10000' ||
    baseFunctionId !== 103 ||
    baseExpression !== '(self.CURRENT_HEALTH*A)/10000' ||
    !Number.isFinite(coefficientRaw) ||
    coefficientRaw < 0 ||
    Number(value.damageSourceType) !== 0 ||
    Number(value.damageType) !== 6 ||
    Number(value.damageElementalType) !== 0 ||
    Number(value.ignoreDamageEvent) !== 1 ||
    Number(value.damageMinimunValueType) !== 0 ||
    Number(value.minimunHpValue) !== 0 ||
    Number(value.physicalRatio) !== 0 ||
    Number(value.magicRatio) !== 0 ||
    !Number.isFinite(Number(value.weakBreakDamageRate)) ||
    !Number.isFinite(Number(value.armerPenetration)) ||
    !Number.isFinite(Number(value.magicPenetration)) ||
    !Number.isFinite(Number(value.elementCalFactor))
  ) {
    return null;
  }
  return {
    kind: 'damage',
    target: 'equipped-kibo',
    runtimeTargetKind: 'kibo',
    source: 'equipped-kibo',
    sourceElementId: Number(value.elementConfigId),
    sourcePathId: element.pathId,
    sourceAttribute: {
      entityRole: 'element-owner-equipped-kibo',
      formulaSymbol: 'self.CURRENT_HEALTH',
      valueKind: 'current-vital',
    },
    formula: {
      commonFunctionId,
      commonExpression,
      baseFunctionId,
      baseExpression,
      coefficientRaw,
      coefficientBasisPoints: coefficientRaw,
      formulaSelf: 'element-owner-equipped-kibo',
    },
    damage: {
      damageSourceType: Number(value.damageSourceType),
      damageSourceTypeName: 'Attacker',
      damageType: Number(value.damageType),
      damageTypeName: 'Real',
      elementalType: Number(value.damageElementalType),
      elementalTypeName: 'None',
      weakBreakDamageRateBasisPoints: Number(value.weakBreakDamageRate),
      physicalPenetrationBasisPoints: Number(value.armerPenetration),
      magicPenetrationBasisPoints: Number(value.magicPenetration),
      elementCalculationFactorBasisPoints: Number(value.elementCalFactor),
      physicalRatioBasisPoints: Number(value.physicalRatio),
      magicRatioBasisPoints: Number(value.magicRatio),
      recoverSp: Number(value.recoverSP),
      petRecoverSp: Number(value.petRecoverSP),
    },
    minimumHpPolicy: {
      damageMinimumValueType: Number(value.damageMinimunValueType),
      minimumHpValue: Number(value.minimunHpValue),
      nominalDamageMinimum: 1,
      minimumRemainingHp: null,
      canReduceTargetToZero: true,
    },
    integerization: {
      mode: 'q16-round-to-nearest-ties-to-even',
      expression: 'roundToEven(max(1,current-health*coefficient/10000))',
    },
    auxiliaryFormula: {
      function3: Number(value.function_3),
      runtimeRead: false,
      policy: 'ignored-by-damage-element-real-output-path',
    },
    eventPolicy: {
      ignoreDamageEvent: true,
      emitsDamageTriggerEvents: false,
      recursivePassiveTrigger: false,
      attackerSideBeforeAfterAttackEvents: 'suppressed',
      receiveSideFlagPolicy: 'not-suppressed-by-ignore-damage-event',
      receiveSideEvents: 'dispatch-depends-on-main-control-status-unresolved',
    },
    criticalPolicy: 'not-applicable-real-damage',
    shieldPolicy: 'bypass',
    restraintPolicy: 'bypass',
  };
}

function createBeforeSkillTriggerEvidence({ trigger, condition }) {
  const triggerLifetime = classifyTriggerCounterLifetime(
    trigger.value.triggerCounter
  );
  return {
    event: 'skill-before',
    sourceScope: 'equipped-kibo',
    target: 'skill-caster',
    internalCooldownMs: Number(trigger.value.triggerInv),
    activationOrder: 'after-resource-and-cooldown-before-skill-start',
    activationDelayMs: 0,
    sourceElementId: Number(trigger.value.elementConfigId),
    sourcePathId: trigger.pathId,
    ...triggerLifetime,
    triggerLimitScope: 'passive-element-lifetime',
    condition,
  };
}

function createPropertyEffectEvidence({
  element,
  target,
  runtimeTargetKind,
  activation,
  condition = null,
  parentElement = null,
}) {
  const time = Number(element.value.time);
  const combineType = Number(element.value.combineType);
  return {
    target,
    runtimeTargetKind,
    activation,
    ...(condition ? { condition } : {}),
    durationMs: time === -1 ? null : time,
    expiration:
      time === -1
        ? parentElement
          ? 'parent-element-lifetime'
          : 'battle-exit'
        : 'duration',
    stackMode: combineType === 4 ? 'stack' : 'replace',
    stackDelta: 1,
    maxStacks:
      combineType === 4
        ? Math.max(1, Number(element.value.combineNumber) || 1)
        : 1,
    refreshRule:
      combineType === 4
        ? 'stack-and-refresh-duration'
        : 'replace-existing-instance',
    combineType,
    combineNumber: Number(element.value.combineNumber),
    exitBattleClear: Number(element.value.exitBattleClear) === 1,
    ...(parentElement
      ? {
          parentElementId: Number(parentElement.value.elementConfigId),
          parentPathId: parentElement.pathId,
        }
      : {}),
    sourceElementId: Number(element.value.elementConfigId),
    sourcePathId: element.pathId,
    modifiers: [createBattlePropertyModifier(element)],
  };
}

function createBattlePropertyModifier(element) {
  const attributeId = Number(element.value.attributeID);
  return {
    kind: 'battle-property',
    attributeId,
    ...(BATTLE_PROPERTY_NAME_BY_ID[attributeId]
      ? { attributeName: BATTLE_PROPERTY_NAME_BY_ID[attributeId] }
      : {}),
    bucket:
      PROPERTY_BUCKET_BY_CALCULATE_TYPE[Number(element.value.calculateType)],
    valueRaw: Number(element.value.functionParams[0]),
    sourceElementId: Number(element.value.elementConfigId),
    sourcePathId: element.pathId,
  };
}

function createElementLifecycleEvidence(element) {
  const time = Number(element.value.time);
  const combineType = Number(element.value.combineType);
  return {
    sourceElementId: Number(element.value.elementConfigId),
    sourcePathId: element.pathId,
    durationMs: time === -1 ? null : time,
    expiration: time === -1 ? 'battle-exit' : 'duration',
    combineType,
    combineNumber: Number(element.value.combineNumber),
    stackMode: combineType === 4 ? 'stack' : 'replace',
    exitBattleClear: Number(element.value.exitBattleClear) === 1,
    clearType: Number(element.value.clearType),
  };
}

function createUnreachableAssetElements({ elementObjects, reachablePathIds }) {
  return elementObjects
    .filter(row => !reachablePathIds.includes(row.pathId))
    .map(row => ({
      sourceElementId: Number(row.value?.elementConfigId),
      sourcePathId: row.pathId,
      assetName: row.value?.m_Name ?? null,
      description: row.value?.describe ?? null,
      reason: 'not-referenced-by-control-resource-map',
    }));
}

function hasExactPathCoverage(actualPathIds, expectedPathIds) {
  return (
    actualPathIds.length === expectedPathIds.length &&
    uniqueValues(actualPathIds).length === actualPathIds.length &&
    actualPathIds.every(pathId => expectedPathIds.includes(pathId)) &&
    expectedPathIds.every(pathId => actualPathIds.includes(pathId))
  );
}

function isPropertyElement(value) {
  return (
    Number.isInteger(Number(value?.attributeID)) &&
    Object.hasOwn(
      PROPERTY_BUCKET_BY_CALCULATE_TYPE,
      Number(value?.calculateType)
    ) &&
    Number.isFinite(Number(value?.time)) &&
    Number(value.time) >= -1 &&
    Array.isArray(value?.functionParams) &&
    Number.isFinite(Number(value.functionParams[0]))
  );
}

function parseBeforeSkillPropertyEffectPassive({
  controlRoot,
  behaviors,
  elementObjects,
}) {
  if (behaviors.length !== 1) return null;
  const behavior = behaviors[0];
  if (Number(behavior.value?.directInjectTargetType) !== 0) return null;
  const behaviorPathIds = extractArrayPathIds(behavior.raw, 'elementDataList');
  if (behaviorPathIds.length !== 1) return null;

  const triggers = elementObjects.filter(row =>
    Array.isArray(row.value?.triggerEffectList)
  );
  if (triggers.length !== 1) return null;
  const trigger = triggers[0];
  const triggerEffects = trigger.value.triggerEffectList ?? [];
  const triggerTargetPathIds = extractObjectPathIds(
    trigger.raw,
    'targetElement'
  );
  const condition = parseSkillTagCondition(trigger.value);
  if (
    Number(trigger.value.triggerType) !== 1 ||
    Number(trigger.value.triggerParam1) !== 5 ||
    Number(trigger.value.triggerParam2) !== 0 ||
    !Number.isFinite(Number(trigger.value.triggerInv)) ||
    Number(trigger.value.triggerInv) < 0 ||
    !condition ||
    triggerEffects.length === 0 ||
    triggerTargetPathIds.length !== triggerEffects.length ||
    triggerEffects.some(
      effect =>
        Number(effect.effectType) !== 0 ||
        ![0, 8].includes(Number(effect.targetType))
    ) ||
    behaviorPathIds[0] !== trigger.pathId ||
    (trigger.value.zeroEffectList?.length ?? 0) > 0 ||
    (trigger.value.finishEffectList?.length ?? 0) > 0 ||
    (trigger.value.zeroTriggerConditionList?.length ?? 0) > 0 ||
    (trigger.value.finishTriggerConditionList?.length ?? 0) > 0
  ) {
    return null;
  }
  const targetPathIds = uniqueValues(triggerTargetPathIds);
  if (targetPathIds.length !== 1) return null;
  const property = elementObjects.find(row => row.pathId === targetPathIds[0]);
  if (!isPlainPropertyElement(property?.value)) return null;
  const accountedPathIds = new Set([trigger.pathId, property.pathId]);
  const controlResourcePathIds = extractArrayPathIds(
    controlRoot.raw,
    'elements'
  );
  if (
    controlResourcePathIds.length !== accountedPathIds.size ||
    controlResourcePathIds.some(pathId => !accountedPathIds.has(pathId)) ||
    elementObjects.some(row => !accountedPathIds.has(row.pathId))
  ) {
    return null;
  }

  const targets = uniqueSorted(
    triggerEffects.map(effect => Number(effect.targetType))
  ).map(triggerEffectTargetType => ({
    target: triggerEffectTargetType === 0 ? 'equipped-kibo' : 'pet-owner',
    runtimeTargetKind: triggerEffectTargetType === 0 ? 'kibo' : 'actor',
    triggerEffectTargetType,
    triggerEffectTargetName:
      triggerEffectTargetType === 0 ? 'Self' : 'PetOwner',
  }));
  const effectTime = Number(property.value.time);
  const effectCombineType = Number(property.value.combineType);
  const triggerLifetime = classifyTriggerCounterLifetime(
    trigger.value.triggerCounter
  );
  const effect = {
    targets: targets.map(target => target.target),
    durationMs: effectTime === -1 ? null : effectTime,
    expiration: effectTime === -1 ? 'battle-exit' : 'duration',
    stackMode: effectCombineType === 4 ? 'stack' : 'refresh',
    stackDelta: 1,
    maxStacks:
      effectCombineType === 4
        ? Math.max(1, Number(property.value.combineNumber) || 1)
        : 1,
    refreshRule:
      effectCombineType === 4
        ? 'stack-and-refresh-duration'
        : 'refresh-duration',
    sourceElementId: Number(property.value.elementConfigId),
    sourcePathId: property.pathId,
    modifiers: [
      {
        kind: 'battle-property',
        attributeId: Number(property.value.attributeID),
        bucket:
          PROPERTY_BUCKET_BY_CALCULATE_TYPE[
            Number(property.value.calculateType)
          ],
        valueRaw: Number(property.value.functionParams[0]),
        sourceElementId: Number(property.value.elementConfigId),
        sourcePathId: property.pathId,
      },
    ],
  };
  return {
    mechanismFamily: 'before-kibo-skill-property-effect',
    trigger: {
      event: 'skill-before',
      sourceScope: 'equipped-kibo',
      target: 'skill-caster',
      internalCooldownMs: Number(trigger.value.triggerInv),
      activationOrder: 'before-action',
      activationDelayMs: 0,
      sourceElementId: Number(trigger.value.elementConfigId),
      sourcePathId: trigger.pathId,
      ...triggerLifetime,
      triggerLimitScope: 'passive-element-lifetime',
      condition,
    },
    effect,
    targets,
    ownership: {
      source: 'equipped-kibo',
      effectAdder: 'equipped-kibo',
      effectTargets: targets.map(target => target.target),
      triggerEffectTargetTypes: targets.map(
        target => target.triggerEffectTargetType
      ),
      triggerEffectTargetNames: targets.map(
        target => target.triggerEffectTargetName
      ),
      foregroundRequirement: 'none-in-source-assets',
    },
    scenarioAssumptions: [],
    evidenceStatus: 'source-verified',
  };
}

function isPlainPropertyElement(value) {
  return (
    Number.isInteger(Number(value?.attributeID)) &&
    Object.hasOwn(
      PROPERTY_BUCKET_BY_CALCULATE_TYPE,
      Number(value?.calculateType)
    ) &&
    Number.isFinite(Number(value?.time)) &&
    Number(value.time) >= -1 &&
    Array.isArray(value?.functionParams) &&
    Number.isFinite(Number(value.functionParams[0])) &&
    (value.defaultConditions?.length ?? 0) === 0 &&
    (value.changePeopertyConditionArrayDatas?.length ?? 0) === 0
  );
}

function parseAreaAuraPropertyPassive({
  controlRoot,
  behaviors,
  elementObjects,
}) {
  // Verified shape: the control behavior injects one area-detection element
  // whose ElementAddListWithDelete applies a plain battle property to
  // entities inside the area (e.g. 520059 华丽姿态: 15m radius, 500ms check,
  // ATK -20%). The control resource map must contain exactly the area and
  // the property elements. Any other elements with the same skill prefix but
  // no control/behavior/reference edge (e.g. orphan SwitchEnter chains) are
  // documented in `orphanElements` and are never claimed as active.
  const uniqueBehaviors = [];
  const seenBehaviorPathIds = new Set();
  for (const row of behaviors) {
    if (row.pathId != null && seenBehaviorPathIds.has(row.pathId)) continue;
    if (row.pathId != null) seenBehaviorPathIds.add(row.pathId);
    uniqueBehaviors.push(row);
  }
  if (uniqueBehaviors.length !== 1) return null;
  const behavior = uniqueBehaviors[0];
  if (Number(behavior.value?.directInjectTargetType) !== 0) return null;
  const behaviorPathIds = extractArrayPathIds(behavior.raw, 'elementDataList');
  if (behaviorPathIds.length !== 1) return null;

  const area = elementObjects.find(row => row.pathId === behaviorPathIds[0]);
  if (!area) return null;
  const areaValue = area.value ?? {};
  if (
    !Number.isFinite(Number(areaValue.areaType)) ||
    !Number.isFinite(Number(areaValue.Radius)) ||
    Number(areaValue.Radius) <= 0 ||
    !Number.isFinite(Number(areaValue.CheckInterval)) ||
    Number(areaValue.CheckInterval) <= 0 ||
    !Array.isArray(areaValue.ElementAddListWithDelete) ||
    areaValue.ElementAddListWithDelete.length === 0
  ) {
    return null;
  }

  const auraPathIds = extractObjectPathIds(
    area.raw,
    'ElementParams'
  );
  const auraEntries = areaValue.ElementAddListWithDelete;
  if (
    auraPathIds.length !== auraEntries.length ||
    auraPathIds.length !== uniqueValues(auraPathIds).length
  ) {
    return null;
  }
  const auraProperties = auraPathIds.map(pathId =>
    elementObjects.find(row => row.pathId === pathId)
  );
  if (
    auraProperties.length !== 1 ||
    !isPlainPropertyElement(auraProperties[0]?.value)
  ) {
    return null;
  }
  const property = auraProperties[0];

  const controlResourcePathIds = uniqueValues(
    extractArrayPathIds(controlRoot.raw, 'elements')
  );
  const accounted = new Set([area.pathId, property.pathId]);
  if (
    controlResourcePathIds.length !== accounted.size ||
    controlResourcePathIds.some(pathId => !accounted.has(pathId))
  ) {
    return null;
  }

  const orphanElements = elementObjects
    .filter(row => !accounted.has(row.pathId))
    .map(row => {
      const hasTriggerEffectList = Array.isArray(row.value?.triggerEffectList);
      return {
        elementConfigId: Number(row.value?.elementConfigId),
        pathId: row.pathId,
        describe:
          row.value?.describe ??
          row.value?.elementName ??
          row.value?.m_Name ??
          null,
        hasTriggerEffectList,
        reason: hasTriggerEffectList
          ? 'passive-switch-enter-trigger-chain-not-in-control-resource-map'
          : 'not-in-control-resource-map',
      };
    });

  const effectTime = Number(property.value.time);
  const effectCombineType = Number(property.value.combineType);
  const effect = {
    targets: ['enemies-in-radius'],
    durationMs: effectTime === -1 ? null : effectTime,
    expiration: effectTime === -1 ? 'area-active' : 'duration',
    stackMode: effectCombineType === 4 ? 'stack' : 'refresh',
    stackDelta: 1,
    maxStacks:
      effectCombineType === 4
        ? Math.max(1, Number(property.value.combineNumber) || 1)
        : 1,
    refreshRule:
      effectCombineType === 4
        ? 'stack-and-refresh-duration'
        : 'refresh-duration',
    sourceElementId: Number(property.value.elementConfigId),
    sourcePathId: property.pathId,
    modifiers: [
      {
        kind: 'battle-property',
        attributeId: Number(property.value.attributeID),
        bucket:
          PROPERTY_BUCKET_BY_CALCULATE_TYPE[
            Number(property.value.calculateType)
          ],
        valueRaw: Number(property.value.functionParams[0]),
        sourceElementId: Number(property.value.elementConfigId),
        sourcePathId: property.pathId,
      },
    ],
  };
  return {
    mechanismFamily: 'equipped-kibo-area-aura-property-effect',
    trigger: {
      event: 'area-tick',
      sourceScope: 'equipped-kibo-field',
      target: 'enemies-in-radius',
      areaType: Number(areaValue.areaType),
      radius: Number(areaValue.Radius),
      height: Number.isFinite(Number(areaValue.Height))
        ? Number(areaValue.Height)
        : null,
      checkIntervalMs: Number(areaValue.CheckInterval),
      durationMs: Number.isFinite(Number(areaValue.Duration))
        ? Number(areaValue.Duration)
        : null,
      addWithDelete: true,
      campType: Number(auraEntries[0]?.CampType),
      sourceElementId: Number(area.value.elementConfigId),
      sourcePathId: area.pathId,
      triggerLifetime: 'unlimited',
      triggerLimitScope: 'passive-area-lifetime',
    },
    effect,
    orphanElements,
    ownership: {
      source: 'equipped-kibo',
      effectAdder: 'area-detection-element',
      effectTargets: ['enemies-in-radius'],
      foregroundRequirement: 'none-in-source-assets',
    },
    scenarioAssumptions: [],
    evidenceStatus: 'source-verified',
    runtimeGaps: [],
  };
}

function parseCompositeStaticAndDamagePropertyEffectPassive({
  controlRoot,
  behaviors,
  elementObjects,
}) {
  if (behaviors.length !== 1) return null;
  const behavior = behaviors[0];
  if (Number(behavior.value.directInjectTargetType) !== 0) return null;

  const rootPathIds = uniqueValues(
    extractArrayPathIds(behavior.raw, 'elementDataList')
  );
  if (rootPathIds.length !== 1) return null;
  const elementByPathId = new Map(
    elementObjects.map(element => [element.pathId, element])
  );
  const compositeRoot = elementByPathId.get(rootPathIds[0]) ?? null;
  if (
    !compositeRoot ||
    !Array.isArray(compositeRoot.value?.injectElementDataList) ||
    compositeRoot.value.injectElementDataList.length < 2 ||
    ![3, 4].includes(Number(compositeRoot.value?.combineType)) ||
    !Number.isFinite(Number(compositeRoot.value?.time)) ||
    Number(compositeRoot.value.time) < -1
  ) {
    return null;
  }

  const compositeChildPathIds = extractArrayPathIds(
    compositeRoot.raw,
    'injectElementDataList'
  );
  if (
    compositeChildPathIds.length !==
      compositeRoot.value.injectElementDataList.length ||
    uniqueValues(compositeChildPathIds).length !== compositeChildPathIds.length
  ) {
    return null;
  }
  const compositeChildren = compositeChildPathIds
    .map(pathId => elementByPathId.get(pathId))
    .filter(Boolean);
  if (compositeChildren.length !== compositeChildPathIds.length) return null;

  const staticProperties = compositeChildren.filter(row =>
    isPlainPropertyElement(row.value)
  );
  const triggerCandidates = compositeChildren.filter(
    row =>
      Array.isArray(row.value?.triggerEffectList) &&
      row.value.triggerEffectList.length >= 1 &&
      Number(row.value.triggerType) === 1 &&
      Number(row.value.triggerParam1) === 2 &&
      Number.isFinite(Number(row.value.triggerInv)) &&
      Number(row.value.triggerInv) >= 0 &&
      row.value.triggerEffectList.every(
        effect =>
          Number(effect.effectType) === 0 && Number(effect.targetType) === 1
      ) &&
      isSupportedDamageTriggerCondition(row.value)
  );
  if (
    staticProperties.length !== 1 ||
    triggerCandidates.length !== 1 ||
    compositeChildren.length !== 2
  ) {
    return null;
  }
  const staticProperty = staticProperties[0];
  const trigger = triggerCandidates[0];
  const triggerTargetPathIds = extractObjectPathIds(
    trigger.raw,
    'targetElement'
  );
  if (
    triggerTargetPathIds.length !== trigger.value.triggerEffectList.length ||
    uniqueValues(triggerTargetPathIds).length !== triggerTargetPathIds.length ||
    triggerTargetPathIds.length !== 1
  ) {
    return null;
  }
  const damageProperty = elementByPathId.get(triggerTargetPathIds[0]) ?? null;
  if (
    !damageProperty ||
    !isPlainPropertyElement(damageProperty.value) ||
    ![1, 3, 4].includes(Number(damageProperty.value.combineType))
  ) {
    return null;
  }

  const reachablePathIds = uniqueValues([
    compositeRoot.pathId,
    staticProperty.pathId,
    trigger.pathId,
    damageProperty.pathId,
  ]);
  const controlResourcePathIds = extractArrayPathIds(
    controlRoot.raw,
    'elements'
  );
  if (
    controlResourcePathIds.length !== reachablePathIds.length ||
    uniqueValues(controlResourcePathIds).length !==
      controlResourcePathIds.length ||
    reachablePathIds.some(pathId => !controlResourcePathIds.includes(pathId)) ||
    controlResourcePathIds.some(pathId => !reachablePathIds.includes(pathId))
  ) {
    return null;
  }

  const staticTime = Number(staticProperty.value.time);
  const staticCombineType = Number(staticProperty.value.combineType);
  const damageTime = Number(damageProperty.value.time);
  const damageCombineType = Number(damageProperty.value.combineType);
  const triggerLifetime = classifyTriggerCounterLifetime(
    trigger.value.triggerCounter
  );
  const triggerCondition = parseDamageTriggerCondition(trigger.value);
  const unreachableAssetElements = elementObjects
    .filter(row => !controlResourcePathIds.includes(row.pathId))
    .map(row => ({
      sourceElementId: Number(row.value?.elementConfigId),
      sourcePathId: row.pathId,
      reason: 'not-referenced-by-control-resource-map',
    }));

  return {
    mechanismFamily: 'equipped-kibo-self-and-on-damage-enemy-property-effect',
    scenarioStartTrigger: {
      event: 'scenario-start',
      sourceScope: 'equipped-kibo',
      target: 'equipped-kibo',
      activationOrder: 'scenario-start',
      activationDelayMs: 0,
      sourceElementId: Number(compositeRoot.value.elementConfigId),
      sourcePathId: compositeRoot.pathId,
    },
    scenarioStartEffects: [
      {
        target: 'equipped-kibo',
        durationMs: staticTime === -1 ? null : staticTime,
        expiration: staticTime === -1 ? 'battle-exit' : 'duration',
        stackMode: staticCombineType === 4 ? 'stack' : 'replace',
        stackDelta: 1,
        maxStacks:
          staticCombineType === 4
            ? Math.max(1, Number(staticProperty.value.combineNumber) || 1)
            : 1,
        refreshRule:
          staticCombineType === 4
            ? 'stack-and-refresh-duration'
            : 'not-applicable-single-scenario-start-application',
        sourceElementId: Number(staticProperty.value.elementConfigId),
        sourcePathId: staticProperty.pathId,
        modifiers: [
          {
            kind: 'battle-property',
            attributeId: Number(staticProperty.value.attributeID),
            bucket:
              PROPERTY_BUCKET_BY_CALCULATE_TYPE[
                Number(staticProperty.value.calculateType)
              ],
            valueRaw: Number(staticProperty.value.functionParams[0]),
            sourceElementId: Number(staticProperty.value.elementConfigId),
            sourcePathId: staticProperty.pathId,
          },
        ],
      },
    ],
    scenarioStartTargets: [
      {
        target: 'equipped-kibo',
        runtimeTargetKind: 'kibo',
        directInjectTargetType: 0,
        directInjectTargetName: 'Self',
      },
    ],
    trigger: {
      event: 'damage-dealt',
      sourceScope: 'equipped-kibo',
      target: 'hit-enemy',
      internalCooldownMs: Number(trigger.value.triggerInv),
      activationOrder: 'after-triggering-hit',
      activationDelayMs: 0.001,
      sourceElementId: Number(trigger.value.elementConfigId),
      sourcePathId: trigger.pathId,
      ...triggerLifetime,
      triggerLimitScope: 'passive-element-lifetime',
      ...(triggerCondition ? { condition: triggerCondition } : {}),
    },
    effects: [
      {
        target: 'enemy',
        durationMs: damageTime === -1 ? null : damageTime,
        expiration: damageTime === -1 ? 'battle-exit' : 'duration',
        stackMode: damageCombineType === 4 ? 'stack' : 'refresh',
        stackDelta: 1,
        maxStacks:
          damageCombineType === 4
            ? Math.max(1, Number(damageProperty.value.combineNumber) || 1)
            : 1,
        refreshRule:
          damageCombineType === 4
            ? 'stack-and-refresh-duration'
            : 'refresh-duration',
        sourceElementId: Number(damageProperty.value.elementConfigId),
        sourcePathId: damageProperty.pathId,
        modifiers: [
          {
            kind: 'battle-property',
            attributeId: Number(damageProperty.value.attributeID),
            bucket:
              PROPERTY_BUCKET_BY_CALCULATE_TYPE[
                Number(damageProperty.value.calculateType)
              ],
            valueRaw: Number(damageProperty.value.functionParams[0]),
            sourceElementId: Number(damageProperty.value.elementConfigId),
            sourcePathId: damageProperty.pathId,
          },
        ],
      },
    ],
    sourceGraph: {
      controlRootElementId: Number(compositeRoot.value.elementConfigId),
      controlRootPathId: compositeRoot.pathId,
      reachableElementIds: reachablePathIds.map(pathId =>
        Number(elementByPathId.get(pathId)?.value?.elementConfigId)
      ),
      reachablePathIds,
      unreachableAssetElements,
    },
    ownership: {
      source: 'equipped-kibo',
      scenarioStartEffectTarget: 'equipped-kibo',
      triggeredEffectTarget: 'hit-enemy',
      effectAdder: 'equipped-kibo',
      foregroundRequirement: 'none-in-source-assets',
    },
    scenarioAssumptions: [],
    evidenceStatus: 'source-verified',
  };
}

function parseAfterReceiveDamageSelfPropertyEffectPassive({
  controlRoot,
  behaviors,
  elementObjects,
}) {
  if (behaviors.length !== 1) return null;
  const behavior = behaviors[0];
  const triggers = elementObjects.filter(
    row =>
      Array.isArray(row.value?.triggerEffectList) &&
      row.value.triggerEffectList.length === 1 &&
      Number(row.value.triggerType) === 1 &&
      Number(row.value.triggerParam1) === 4 &&
      (row.value.triggerConditionList?.length ?? 0) === 0 &&
      Number(row.value.triggerEffectList[0]?.effectType) === 0 &&
      [0, 1].includes(Number(row.value.triggerEffectList[0]?.targetType)) &&
      Number.isFinite(Number(row.value.triggerInv)) &&
      Number(row.value.triggerInv) >= 0
  );
  const allTriggerElements = elementObjects.filter(row =>
    Array.isArray(row.value?.triggerEffectList)
  );
  if (triggers.length !== 1 || allTriggerElements.length !== 1) return null;
  const trigger = triggers[0];
  const targetPathIds = extractObjectPathIds(trigger.raw, 'targetElement');
  if (targetPathIds.length !== 1) return null;
  const property =
    elementObjects.find(row => row.pathId === targetPathIds[0]) ?? null;
  if (!property || !isPropertyElement(property.value)) return null;
  const behaviorPathIds = extractArrayPathIds(behavior.raw, 'elementDataList');
  if (behaviorPathIds.length !== 1 || behaviorPathIds[0] !== trigger.pathId) {
    return null;
  }
  const controlResourcePathIds = extractArrayPathIds(
    controlRoot.raw,
    'elements'
  );
  const reachablePathIds = [trigger.pathId, property.pathId];
  if (!hasExactPathCoverage(controlResourcePathIds, reachablePathIds)) {
    return null;
  }
  const targetType = Number(trigger.value.triggerEffectList[0].targetType);
  const triggerLifetime = classifyTriggerCounterLifetime(
    trigger.value.triggerCounter
  );
  const effect = createPropertyEffectEvidence({
    element: property,
    target: targetType === 1 ? 'damaged-kibo' : 'equipped-kibo',
    runtimeTargetKind: 'kibo',
    activation: 'after-receive-damage',
  });
  return {
    mechanismFamily: 'after-kibo-receive-damage-self-property-effect',
    trigger: {
      event: 'damage-received',
      eventType: 4,
      eventName: 'AfterReceiveDamage',
      sourceScope: 'equipped-kibo',
      target: targetType === 1 ? 'damaged-kibo' : 'equipped-kibo',
      internalCooldownMs: Number(trigger.value.triggerInv),
      activationOrder: 'after-receive-damage-settlement',
      activationDelayMs: 0,
      sourceElementId: Number(trigger.value.elementConfigId),
      sourcePathId: trigger.pathId,
      ...triggerLifetime,
      triggerLimitScope: 'passive-element-lifetime',
      sourceIdentity: [
        'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs#EElementTriggerEventType.AfterReceiveDamage=4',
        `battle-element-assets.jsonl#path_id=${trigger.pathId};elementId=${Number(
          trigger.value.elementConfigId
        )}`,
      ],
    },
    effect,
    ownership: {
      source: 'equipped-kibo',
      scenarioStartEffectTarget: null,
      triggeredEffectTarget:
        targetType === 1 ? 'damaged-kibo' : 'equipped-kibo',
      effectAdder: 'equipped-kibo',
      foregroundRequirement: 'none-in-source-assets',
    },
    sourceGraph: {
      triggerElementId: Number(trigger.value.elementConfigId),
      triggerPathId: trigger.pathId,
      propertyElementId: Number(property.value.elementConfigId),
      propertyPathId: property.pathId,
      reachablePathIds,
    },
    runtimeGaps: [],
    scenarioAssumptions: [],
    evidenceStatus: 'source-verified',
  };
}

function parseIncomingDamagePropertyEffectEvidence({
  controlRoot,
  behaviors,
  elementObjects,
}) {
  if (behaviors.length !== 1) return null;
  const behavior = behaviors[0];
  if (Number(behavior.value.directInjectTargetType) !== 0) return null;
  const behaviorPathIds = extractArrayPathIds(behavior.raw, 'elementDataList');
  const triggerCandidates = elementObjects.filter(
    row =>
      Array.isArray(row.value?.triggerEffectList) &&
      row.value.triggerEffectList.length === 1 &&
      Number(row.value.triggerType) === 1 &&
      Number(row.value.triggerParam1) === 4 &&
      Number(row.value.triggerEffectList[0]?.effectType) === 0 &&
      Number(row.value.triggerEffectList[0]?.targetType) === 1 &&
      (row.value.triggerConditionList?.length ?? 0) === 0
  );
  const allTriggerElements = elementObjects.filter(row =>
    Array.isArray(row.value?.triggerEffectList)
  );
  if (
    triggerCandidates.length !== 1 ||
    allTriggerElements.length !== 1 ||
    behaviorPathIds.length !== 1
  ) {
    return null;
  }
  const trigger = triggerCandidates[0];
  if (behaviorPathIds[0] !== trigger.pathId) return null;
  const targetPathIds = extractObjectPathIds(trigger.raw, 'targetElement');
  if (targetPathIds.length !== 1) return null;
  const property =
    elementObjects.find(row => row.pathId === targetPathIds[0]) ?? null;
  if (!property || !isPlainPropertyElement(property.value)) return null;
  const controlResourcePathIds = extractArrayPathIds(
    controlRoot.raw,
    'elements'
  );
  const reachablePathIds = [trigger.pathId, property.pathId];
  if (
    controlResourcePathIds.length !== reachablePathIds.length ||
    uniqueValues(controlResourcePathIds).length !==
      controlResourcePathIds.length ||
    controlResourcePathIds.some(pathId => !reachablePathIds.includes(pathId)) ||
    reachablePathIds.some(pathId => !controlResourcePathIds.includes(pathId))
  ) {
    return null;
  }

  const sustainElementId = Number(trigger.value.sustainElement);
  return {
    unresolvedReasons: [
      'passive-after-receive-damage-event-runtime-not-modeled',
      'passive-after-receive-damage-target-entity-role-unresolved',
    ],
    evidence: {
      controlInjection: {
        targetType: 0,
        targetName: 'Self',
        triggerElementId: Number(trigger.value.elementConfigId),
        triggerPathId: trigger.pathId,
      },
      trigger: {
        eventType: 4,
        eventName: 'AfterReceiveDamage',
        triggerEffectTargetType: 1,
        triggerEffectTargetName: 'Target',
        internalCooldownMs: Number(trigger.value.triggerInv),
        ...classifyTriggerCounterLifetime(trigger.value.triggerCounter),
        sustainElementId:
          Number.isInteger(sustainElementId) && sustainElementId > 0
            ? sustainElementId
            : null,
        sustainElementRuntimeStatus:
          'config-field-not-read-by-trigger-element-parse',
      },
      effect: {
        targetRole: 'event-target-unresolved',
        durationMs: Number(property.value.time),
        sourceElementId: Number(property.value.elementConfigId),
        sourcePathId: property.pathId,
        modifiers: [
          {
            kind: 'battle-property',
            attributeId: Number(property.value.attributeID),
            bucket:
              PROPERTY_BUCKET_BY_CALCULATE_TYPE[
                Number(property.value.calculateType)
              ],
            valueRaw: Number(property.value.functionParams[0]),
          },
        ],
      },
      triggerDataContract: {
        type: 'ElementTriggerData_Damage',
        fields: ['source', 'target', 'self'],
        unresolvedMapping:
          'AfterReceiveDamage event producer to ElementTriggerDataBase.target',
      },
      controlResourceCoverage: 'exact',
      scenarioAssumptions: [],
    },
  };
}

function parseDerivedDamagePassive({
  controlRoot,
  behaviors,
  elementObjects,
  elementFormulasById,
}) {
  if (behaviors.length !== 1) return null;
  const behavior = behaviors[0];
  if (Number(behavior.value.directInjectTargetType) !== 0) return null;
  const behaviorPathIds = extractArrayPathIds(behavior.raw, 'elementDataList');
  const triggerCandidates = elementObjects.filter(
    row =>
      Array.isArray(row.value?.triggerEffectList) &&
      row.value.triggerEffectList.length === 1 &&
      Number(row.value.triggerType) === 1 &&
      Number(row.value.triggerParam1) === 2 &&
      Number(row.value.triggerEffectList[0]?.effectType) === 0 &&
      Number(row.value.triggerEffectList[0]?.targetType) === 1 &&
      Number.isFinite(Number(row.value.triggerInv)) &&
      Number(row.value.triggerInv) >= 0 &&
      isSupportedDamageTriggerCondition(row.value)
  );
  const allTriggerElements = elementObjects.filter(row =>
    Array.isArray(row.value?.triggerEffectList)
  );
  if (
    triggerCandidates.length !== 1 ||
    allTriggerElements.length !== 1 ||
    behaviorPathIds.length !== 1
  ) {
    return null;
  }
  const trigger = triggerCandidates[0];
  if (behaviorPathIds[0] !== trigger.pathId) return null;
  const targetPathIds = extractObjectPathIds(trigger.raw, 'targetElement');
  if (targetPathIds.length !== 1) return null;
  const damageElement =
    elementObjects.find(row => row.pathId === targetPathIds[0]) ?? null;
  if (!damageElement) return null;
  const damage = damageElement.value;
  const commonFunctionId = Number(
    damage.formulaParams?.function_1 ?? damage.baseIntParams?.[0]
  );
  const baseFunctionId = Number(
    damage.formulaParams?.function_2 ?? damage.baseIntParams?.[1]
  );
  const coefficientRaw = Number(
    damage.formulaParams?.formulaParamValues?.[0] ?? damage.functionParams?.[0]
  );
  const commonFormula = elementFormulasById?.get(commonFunctionId) ?? null;
  const baseFormula = elementFormulasById?.get(baseFunctionId) ?? null;
  if (
    commonFunctionId !== 1 ||
    baseFunctionId !== 4 ||
    !Number.isFinite(coefficientRaw) ||
    coefficientRaw < 0 ||
    String(baseFormula?.functionOutput ?? '') !== 'source.ATK[0]*A/10000' ||
    Number(damage.damageSourceType) !== 0 ||
    Number(damage.damageType) !== 1 ||
    Number(damage.damageElementalType) !== 1 ||
    Number(damage.ignoreDamageEvent) !== 1 ||
    !Number.isFinite(Number(damage.weakBreakDamageRate)) ||
    !Number.isFinite(Number(damage.armerPenetration)) ||
    !Number.isFinite(Number(damage.magicPenetration)) ||
    !Number.isFinite(Number(damage.elementCalFactor)) ||
    !Number.isFinite(Number(damage.physicalRatio)) ||
    !Number.isFinite(Number(damage.magicRatio))
  ) {
    return null;
  }
  const controlResourcePathIds = extractArrayPathIds(
    controlRoot.raw,
    'elements'
  );
  const reachablePathIds = [trigger.pathId, damageElement.pathId];
  if (
    controlResourcePathIds.length !== reachablePathIds.length ||
    uniqueValues(controlResourcePathIds).length !==
      controlResourcePathIds.length ||
    controlResourcePathIds.some(pathId => !reachablePathIds.includes(pathId)) ||
    reachablePathIds.some(pathId => !controlResourcePathIds.includes(pathId)) ||
    elementObjects.some(row => !reachablePathIds.includes(row.pathId))
  ) {
    return null;
  }

  const triggerLifetime = classifyTriggerCounterLifetime(
    trigger.value.triggerCounter
  );
  const triggerCondition = parseDamageTriggerCondition(trigger.value);
  const sustainElementId = Number(trigger.value.sustainElement);
  const ratiosByLevel = Object.fromEntries(
    Array.from({ length: 12 }, (_, index) => [index + 1, coefficientRaw])
  );
  return {
    mechanismFamily: 'on-kibo-damage-derived-damage',
    trigger: {
      event: 'damage-dealt',
      sourceScope: 'equipped-kibo',
      target: 'hit-enemy',
      internalCooldownMs: Number(trigger.value.triggerInv),
      activationOrder: 'after-triggering-hit',
      activationDelayMs: 0.001,
      sourceElementId: Number(trigger.value.elementConfigId),
      sourcePathId: trigger.pathId,
      ...triggerLifetime,
      triggerLimitScope: 'passive-element-lifetime',
      sustainElementId:
        Number.isInteger(sustainElementId) && sustainElementId > 0
          ? sustainElementId
          : null,
      sustainElementRuntimeStatus:
        'config-field-not-read-by-trigger-element-parse',
      ...(triggerCondition ? { condition: triggerCondition } : {}),
    },
    derivedDamage: {
      target: 'enemy',
      source: 'equipped-kibo',
      sourceAttribute: {
        entityRole: 'element-source-equipped-kibo',
        attributeId: 1,
        attributeName: 'ATK',
      },
      sourceElementId: Number(damage.elementConfigId),
      sourcePathId: damageElement.pathId,
      formula: {
        commonFunctionId,
        commonExpression: commonFormula?.functionOutput ?? null,
        baseFunctionId,
        baseExpression: baseFormula.functionOutput,
        coefficientRaw,
        ratiosByLevel,
      },
      damage: {
        damageSourceType: Number(damage.damageSourceType),
        damageSourceTypeName: 'Attacker',
        damageType: Number(damage.damageType),
        damageTypeName: 'MeleePhysical',
        elementalType: Number(damage.damageElementalType),
        elementalTypeName: 'Fire',
        weakBreakDamageRateBasisPoints: Number(damage.weakBreakDamageRate),
        physicalPenetrationBasisPoints: Number(damage.armerPenetration),
        magicPenetrationBasisPoints: Number(damage.magicPenetration),
        elementCalculationFactorBasisPoints: Number(damage.elementCalFactor),
        physicalRatioBasisPoints: Number(damage.physicalRatio),
        magicRatioBasisPoints: Number(damage.magicRatio),
        recoverSp: Number(damage.recoverSP),
        petRecoverSp: Number(damage.petRecoverSP),
      },
      eventPolicy: {
        ignoreDamageEvent: true,
        emitsDamageTriggerEvents: false,
        recursivePassiveTrigger: false,
      },
      criticalPolicy: 'scenario-policy-with-derived-hit-override',
    },
    ownership: {
      source: 'equipped-kibo',
      formulaSource: 'equipped-kibo',
      effectAdder: 'equipped-kibo',
      target: 'hit-enemy',
      foregroundRequirement: 'none-in-source-assets',
    },
    scenarioAssumptions: [],
    evidenceStatus: 'source-verified',
  };
}

function parseDerivedDotAndSelfHealPassive({
  controlRoot,
  behaviors,
  elementObjects,
  elementFormulasById,
}) {
  if (behaviors.length !== 1) return null;
  const behavior = behaviors[0];
  if (Number(behavior.value.directInjectTargetType) !== 0) return null;
  const behaviorPathIds = extractArrayPathIds(behavior.raw, 'elementDataList');
  if (behaviorPathIds.length !== 1) return null;
  const trigger =
    elementObjects.find(row => row.pathId === behaviorPathIds[0]) ?? null;
  if (!trigger) return null;
  const triggerValue = trigger.value ?? {};
  const triggerEffects = Array.isArray(triggerValue.triggerEffectList)
    ? triggerValue.triggerEffectList
    : [];
  if (
    Number(triggerValue.triggerType) !== 1 ||
    Number(triggerValue.triggerParam1) !== 2 ||
    triggerEffects.length !== 2 ||
    !triggerEffects.every(effect => Number(effect.effectType) === 0) ||
    !Number.isFinite(Number(triggerValue.triggerInv)) ||
    Number(triggerValue.triggerInv) < 0 ||
    !isSupportedDamageTriggerCondition(triggerValue)
  ) {
    return null;
  }
  const effectTargetTypes = triggerEffects
    .map(effect => Number(effect.targetType))
    .sort((left, right) => left - right);
  if (effectTargetTypes.join('|') !== '0|1') return null;
  const triggerTargetPathIds = extractObjectPathIds(
    trigger.raw,
    'targetElement'
  );
  if (triggerTargetPathIds.length !== 2) return null;
  const relayPathIdByTargetType = Object.fromEntries(
    triggerEffects.map((effect, index) => [
      Number(effect.targetType),
      triggerTargetPathIds[index],
    ])
  );
  const relayDot =
    elementObjects.find(
      row => row.pathId === relayPathIdByTargetType[1]
    ) ?? null;
  const relayHeal =
    elementObjects.find(
      row => row.pathId === relayPathIdByTargetType[0]
    ) ?? null;
  if (!relayDot || !relayHeal) return null;
  for (const relay of [relayDot, relayHeal]) {
    const value = relay.value ?? {};
    const effects = Array.isArray(value.triggerEffectList)
      ? value.triggerEffectList
      : [];
    if (
      Number(value.triggerType) !== 0 ||
      Number(value.triggerParam1) !== 1 ||
      Number(value.triggerParam2) !== 1000 ||
      Number(value.timeExeFirstFrame) !== 1 ||
      Number(value.duration) !== 5000 ||
      effects.length !== 1 ||
      Number(effects[0].effectType) !== 0 ||
      Number(effects[0].targetType) !== 0 ||
      (value.triggerConditionList?.length ?? 0) !== 0
    ) {
      return null;
    }
  }
  const relayDotTargetPathIds = extractObjectPathIds(
    relayDot.raw,
    'targetElement'
  );
  const relayHealTargetPathIds = extractObjectPathIds(
    relayHeal.raw,
    'targetElement'
  );
  if (
    relayDotTargetPathIds.length !== 1 ||
    relayHealTargetPathIds.length !== 1
  ) {
    return null;
  }
  const dot =
    elementObjects.find(
      row => row.pathId === relayDotTargetPathIds[0]
    ) ?? null;
  const heal =
    elementObjects.find(
      row => row.pathId === relayHealTargetPathIds[0]
    ) ?? null;
  if (!dot || !heal) return null;
  const dotValue = dot.value ?? {};
  const healValue = heal.value ?? {};

  const readFormula = value => ({
    commonFunctionId: Number(
      value.formulaParams?.function_1 ?? value.baseIntParams?.[0]
    ),
    baseFunctionId: Number(
      value.formulaParams?.function_2 ?? value.baseIntParams?.[1]
    ),
    coefficientRaw: Number(
      value.formulaParams?.formulaParamValues?.[0] ?? value.functionParams?.[0]
    ),
  });
  const dotFormula = readFormula(dotValue);
  const healFormula = readFormula(healValue);
  const dotCommonFormula =
    elementFormulasById?.get(dotFormula.commonFunctionId) ?? null;
  const dotBaseFormula =
    elementFormulasById?.get(dotFormula.baseFunctionId) ?? null;
  const healCommonFormula =
    elementFormulasById?.get(healFormula.commonFunctionId) ?? null;
  const healBaseFormula =
    elementFormulasById?.get(healFormula.baseFunctionId) ?? null;
  const isValidSourceAtkFormula = (common, base, commonFormula, baseFormula) =>
    common === 1 &&
    base === 4 &&
    String(baseFormula?.functionOutput ?? '') === 'source.ATK[0]*A/10000';
  if (
    !isValidSourceAtkFormula(
      dotFormula.commonFunctionId,
      dotFormula.baseFunctionId,
      dotCommonFormula,
      dotBaseFormula
    ) ||
    !isValidSourceAtkFormula(
      healFormula.commonFunctionId,
      healFormula.baseFunctionId,
      healCommonFormula,
      healBaseFormula
    ) ||
    !Number.isFinite(dotFormula.coefficientRaw) ||
    dotFormula.coefficientRaw < 0 ||
    !Number.isFinite(healFormula.coefficientRaw) ||
    healFormula.coefficientRaw < 0 ||
    Number(dotValue.damageSourceType) !== 0 ||
    Number(dotValue.damageType) !== 7 ||
    Number(dotValue.damageElementalType) !== 0 ||
    Number(dotValue.weakBreakDamageRate) !== 2000 ||
    Number(dotValue.armerPenetration) !== 5000 ||
    Number(dotValue.magicPenetration) !== 5000 ||
    Number(dotValue.elementCalFactor) !== 10000 ||
    Number(dotValue.physicalRatio) !== 0 ||
    Number(dotValue.magicRatio) !== 0 ||
    Number(dotValue.ignoreDamageEvent) !== 1 ||
    Number(dotValue.recoverSP) !== 0 ||
    Number(dotValue.petRecoverSP) !== 0 ||
    Number(healValue.damageSourceType) !== 0 ||
    Number(healValue.damageType) !== 5 ||
    Number(healValue.damageElementalType) !== 0 ||
    Number(healValue.healUp) !== 10000 ||
    Number(healValue.ignoreDamageEvent) !== 0 ||
    Number(healValue.recoverInterval) !== 9999
  ) {
    return null;
  }
  const controlResourcePathIds = extractArrayPathIds(
    controlRoot.raw,
    'elements'
  );
  const reachablePathIds = [
    trigger.pathId,
    relayDot.pathId,
    dot.pathId,
    relayHeal.pathId,
    heal.pathId,
  ];
  if (
    controlResourcePathIds.length !== reachablePathIds.length ||
    uniqueValues(controlResourcePathIds).length !==
      controlResourcePathIds.length ||
    controlResourcePathIds.some(
      pathId => !reachablePathIds.includes(pathId)
    ) ||
    reachablePathIds.some(
      pathId => !controlResourcePathIds.includes(pathId)
    ) ||
    elementObjects.some(row => !reachablePathIds.includes(row.pathId))
  ) {
    return null;
  }
  const triggerLifetime = classifyTriggerCounterLifetime(
    triggerValue.triggerCounter
  );
  const createRatiosByLevel = coefficientRaw =>
    Object.fromEntries(
      Array.from({ length: 12 }, (_, index) => [index + 1, coefficientRaw])
    );
  return {
    mechanismFamily: 'on-kibo-damage-derived-dot-and-self-heal',
    trigger: {
      event: 'damage-dealt',
      eventType: 2,
      eventName: 'AfterDamage',
      sourceScope: 'equipped-kibo',
      target: 'hit-enemy',
      internalCooldownMs: Number(triggerValue.triggerInv),
      activationOrder: 'after-triggering-hit',
      activationDelayMs: 0.001,
      sourceElementId: Number(triggerValue.elementConfigId),
      sourcePathId: trigger.pathId,
      ...triggerLifetime,
      triggerLimitScope: 'passive-element-lifetime',
    },
    derivedPeriodic: {
      durationMs: 5000,
      intervalMs: 1000,
      timeExeFirstFrame: true,
      schedules: [
        {
          kind: 'derived-dot',
          target: 'hit-enemy',
          targetKind: 'enemy',
          sourceAttribute: {
            entityRole: 'element-source-equipped-kibo',
            attributeId: 1,
            attributeName: 'ATK',
          },
          sourceElementId: Number(dotValue.elementConfigId),
          sourcePathId: dot.pathId,
          formula: {
            commonFunctionId: dotFormula.commonFunctionId,
            commonExpression: dotCommonFormula?.functionOutput ?? null,
            baseFunctionId: dotFormula.baseFunctionId,
            baseExpression: dotBaseFormula.functionOutput,
            coefficientRaw: dotFormula.coefficientRaw,
            ratiosByLevel: createRatiosByLevel(dotFormula.coefficientRaw),
          },
          damage: {
            damageSourceType: Number(dotValue.damageSourceType),
            damageSourceTypeName: 'Attacker',
            damageType: Number(dotValue.damageType),
            damageTypeName: 'Dot',
            elementalType: Number(dotValue.damageElementalType),
            elementalTypeName: 'None',
            weakBreakDamageRateBasisPoints: Number(dotValue.weakBreakDamageRate),
            physicalPenetrationBasisPoints: Number(dotValue.armerPenetration),
            magicPenetrationBasisPoints: Number(dotValue.magicPenetration),
            elementCalculationFactorBasisPoints: Number(
              dotValue.elementCalFactor
            ),
            physicalRatioBasisPoints: Number(dotValue.physicalRatio),
            magicRatioBasisPoints: Number(dotValue.magicRatio),
            recoverSp: Number(dotValue.recoverSP),
            petRecoverSp: Number(dotValue.petRecoverSP),
          },
          eventPolicy: {
            ignoreDamageEvent: true,
            emitsDamageTriggerEvents: false,
            recursivePassiveTrigger: false,
          },
          relay: {
            sourceElementId: Number(relayDot.value.elementConfigId),
            sourcePathId: relayDot.pathId,
            durationMs: 5000,
            intervalMs: 1000,
            timeExeFirstFrame: true,
          },
        },
        {
          kind: 'self-heal',
          target: 'equipped-kibo',
          targetKind: 'kibo',
          sourceElementId: Number(healValue.elementConfigId),
          sourcePathId: heal.pathId,
          formula: {
            commonFunctionId: healFormula.commonFunctionId,
            commonExpression: healCommonFormula?.functionOutput ?? null,
            baseFunctionId: healFormula.baseFunctionId,
            baseExpression: healBaseFormula.functionOutput,
            coefficientRaw: healFormula.coefficientRaw,
            ratiosByLevel: createRatiosByLevel(healFormula.coefficientRaw),
          },
          heal: {
            kind: 'heal',
            damageType: Number(healValue.damageType),
            damageTypeName: 'Heal',
            healUp: Number(healValue.healUp),
            recoverIntervalMs: Number(healValue.recoverInterval),
            ignoreDamageEvent: Number(healValue.ignoreDamageEvent),
          },
          relay: {
            sourceElementId: Number(relayHeal.value.elementConfigId),
            sourcePathId: relayHeal.pathId,
            durationMs: 5000,
            intervalMs: 1000,
            timeExeFirstFrame: true,
          },
        },
      ],
    },
    ownership: {
      source: 'equipped-kibo',
      formulaSource: 'equipped-kibo',
      effectAdder: 'equipped-kibo',
      dotTarget: 'hit-enemy',
      healTarget: 'equipped-kibo',
      foregroundRequirement: 'none-in-source-assets',
    },
    scenarioAssumptions: [],
    evidenceStatus: 'source-verified',
  };
}

function parseAfterReceiveDamageRetaliationDamagePassive({
  controlRoot,
  behaviors,
  elementObjects,
  elementFormulasById,
}) {
  if (behaviors.length !== 1) return null;
  const behavior = behaviors[0];
  if (Number(behavior.value.directInjectTargetType) !== 0) return null;
  const behaviorPathIds = extractArrayPathIds(behavior.raw, 'elementDataList');
  if (behaviorPathIds.length !== 1) return null;
  const triggerCandidates = elementObjects.filter(
    row =>
      Array.isArray(row.value?.triggerEffectList) &&
      row.value.triggerEffectList.length === 1 &&
      Number(row.value.triggerType) === 1 &&
      Number(row.value.triggerParam1) === 4 &&
      Number(row.value.triggerEffectList[0]?.effectType) === 0 &&
      Number(row.value.triggerEffectList[0]?.targetType) === 1 &&
      Number.isFinite(Number(row.value.triggerInv)) &&
      Number(row.value.triggerInv) >= 0 &&
      isSupportedDamageTriggerCondition(row.value)
  );
  const allTriggerElements = elementObjects.filter(row =>
    Array.isArray(row.value?.triggerEffectList)
  );
  if (
    triggerCandidates.length !== 1 ||
    allTriggerElements.length !== 1 ||
    behaviorPathIds[0] !== triggerCandidates[0].pathId
  ) {
    return null;
  }
  const trigger = triggerCandidates[0];
  const targetPathIds = extractObjectPathIds(trigger.raw, 'targetElement');
  if (targetPathIds.length !== 1) return null;
  const damageElement =
    elementObjects.find(row => row.pathId === targetPathIds[0]) ?? null;
  if (!damageElement) return null;
  const damage = damageElement.value ?? {};
  const commonFunctionId = Number(
    damage.formulaParams?.function_1 ?? damage.baseIntParams?.[0]
  );
  const baseFunctionId = Number(
    damage.formulaParams?.function_2 ?? damage.baseIntParams?.[1]
  );
  const coefficientRaw = Number(
    damage.formulaParams?.formulaParamValues?.[0] ?? damage.functionParams?.[0]
  );
  const commonFormula = elementFormulasById?.get(commonFunctionId) ?? null;
  const baseFormula = elementFormulasById?.get(baseFunctionId) ?? null;
  if (
    commonFunctionId !== 1 ||
    baseFunctionId !== 4 ||
    String(baseFormula?.functionOutput ?? '') !== 'source.ATK[0]*A/10000' ||
    !Number.isFinite(coefficientRaw) ||
    coefficientRaw < 0 ||
    Number(damage.damageSourceType) !== 0 ||
    Number(damage.damageType) !== 4 ||
    Number(damage.damageElementalType) !== 7 ||
    Number(damage.weakBreakDamageRate) !== 2000 ||
    Number(damage.armerPenetration) !== 10000 ||
    Number(damage.magicPenetration) !== -1 ||
    Number(damage.elementCalFactor) !== 10000 ||
    Number(damage.physicalRatio) !== 0 ||
    Number(damage.magicRatio) !== 10000 ||
    Number(damage.ignoreDamageEvent) !== 0 ||
    Number(damage.recoverSP) !== 0 ||
    Number(damage.petRecoverSP) !== 0
  ) {
    return null;
  }
  const controlResourcePathIds = extractArrayPathIds(
    controlRoot.raw,
    'elements'
  );
  const reachablePathIds = [trigger.pathId, damageElement.pathId];
  if (
    controlResourcePathIds.length !== reachablePathIds.length ||
    uniqueValues(controlResourcePathIds).length !==
      controlResourcePathIds.length ||
    controlResourcePathIds.some(
      pathId => !reachablePathIds.includes(pathId)
    ) ||
    reachablePathIds.some(
      pathId => !controlResourcePathIds.includes(pathId)
    ) ||
    elementObjects.some(row => !reachablePathIds.includes(row.pathId))
  ) {
    return null;
  }
  const triggerLifetime = classifyTriggerCounterLifetime(
    trigger.value.triggerCounter
  );
  const ratiosByLevel = Object.fromEntries(
    Array.from({ length: 12 }, (_, index) => [index + 1, coefficientRaw])
  );
  return {
    mechanismFamily: 'after-kibo-receive-damage-retaliation-damage-effect',
    trigger: {
      event: 'damage-received',
      eventType: 4,
      eventName: 'AfterReceiveDamage',
      sourceScope: 'equipped-kibo',
      target: 'attacker',
      internalCooldownMs: Number(trigger.value.triggerInv),
      activationOrder: 'after-receive-damage-settlement',
      activationDelayMs: 0.001,
      sourceElementId: Number(trigger.value.elementConfigId),
      sourcePathId: trigger.pathId,
      ...triggerLifetime,
      triggerLimitScope: 'passive-element-lifetime',
    },
    derivedDamage: {
      target: 'attacker',
      targetRuntimeKind: 'enemy',
      source: 'equipped-kibo',
      sourceAttribute: {
        entityRole: 'element-source-equipped-kibo',
        attributeId: 1,
        attributeName: 'ATK',
      },
      sourceElementId: Number(damage.elementConfigId),
      sourcePathId: damageElement.pathId,
      formula: {
        commonFunctionId,
        commonExpression: commonFormula?.functionOutput ?? null,
        baseFunctionId,
        baseExpression: baseFormula.functionOutput,
        coefficientRaw,
        ratiosByLevel,
      },
      damage: {
        damageSourceType: Number(damage.damageSourceType),
        damageSourceTypeName: 'Attacker',
        damageType: Number(damage.damageType),
        damageTypeName: 'ElementSkill',
        elementalType: Number(damage.damageElementalType),
        elementalTypeName: 'Thunder',
        weakBreakDamageRateBasisPoints: Number(damage.weakBreakDamageRate),
        physicalPenetrationBasisPoints: Number(damage.armerPenetration),
        magicPenetrationBasisPoints: Number(damage.magicPenetration),
        elementCalculationFactorBasisPoints: Number(damage.elementCalFactor),
        physicalRatioBasisPoints: Number(damage.physicalRatio),
        magicRatioBasisPoints: Number(damage.magicRatio),
        recoverSp: Number(damage.recoverSP),
        petRecoverSp: Number(damage.petRecoverSP),
      },
      eventPolicy: {
        ignoreDamageEvent: false,
        emitsDamageTriggerEvents: false,
        recursivePassiveTrigger: false,
      },
      criticalPolicy: 'scenario-policy-with-derived-hit-override',
    },
    ownership: {
      source: 'equipped-kibo',
      formulaSource: 'equipped-kibo',
      effectAdder: 'equipped-kibo',
      target: 'attacker',
      foregroundRequirement: 'none-in-source-assets',
    },
    scenarioAssumptions: [
      'attacker-resolved-to-scenario-enemy-single-enemy-model',
    ],
    evidenceStatus: 'source-verified',
  };
}

function parsePlayerTeamPeriodicHealPassive({
  controlRoot,
  behaviors,
  elementObjects,
  elementFormulasById,
}) {
  if (behaviors.length !== 1) return null;
  const behavior = behaviors[0];
  if (Number(behavior.value.directInjectTargetType) !== 15) return null;

  const behaviorPathIds = extractArrayPathIds(behavior.raw, 'elementDataList');
  const controlResourcePathIds = extractArrayPathIds(
    controlRoot.raw,
    'elements'
  );
  if (
    behaviorPathIds.length !== 1 ||
    controlResourcePathIds.length !== 2 ||
    uniqueValues(controlResourcePathIds).length !== 2
  ) {
    return null;
  }
  const triggerElement =
    elementObjects.find(row => row.pathId === behaviorPathIds[0]) ?? null;
  if (!triggerElement) return null;
  const trigger = triggerElement.value ?? {};
  const triggerTags = uniqueSorted(
    (trigger.types ?? []).map(Number).filter(Number.isInteger)
  );
  const triggerCondition = trigger.triggerConditionList?.[0] ?? null;
  if (
    triggerTags.join('|') !== '500|1000' ||
    Number(trigger.combineType) !== 3 ||
    Number(trigger.combineNumber) !== 1 ||
    Number(trigger.exitBattleClear) !== 1 ||
    Number(trigger.clearType) !== 64 ||
    Number(trigger.triggerType) !== 0 ||
    Number(trigger.triggerParam1) !== 1 ||
    !Number.isFinite(Number(trigger.triggerParam2)) ||
    Number(trigger.triggerParam2) <= 0 ||
    Number(trigger.timeExeFirstFrame) !== 1 ||
    Number(trigger.triggerFrequency) !== 0 ||
    Number(trigger.triggerInv) !== 0 ||
    Number(trigger.triggerIntervalTimes) !== 1 ||
    Number(trigger.duration) !== -1 ||
    trigger.triggerConditionList?.length !== 1 ||
    Number(trigger.triggerConditionType) !== 0 ||
    Number(triggerCondition?.conditionParam1) !== 10000 ||
    Number(triggerCondition?.conditionParam2) !== 211 ||
    Number(triggerCondition?.conditionParam3) !== 0 ||
    Number(triggerCondition?.conditionParam4) !== 0 ||
    trigger.triggerEffectList?.length !== 1 ||
    Number(trigger.triggerEffectList[0]?.effectType) !== 0 ||
    Number(trigger.triggerEffectList[0]?.targetType) !== 0
  ) {
    return null;
  }

  const targetPathIds = extractObjectPathIds(
    triggerElement.raw,
    'targetElement'
  );
  if (targetPathIds.length !== 1) return null;
  const healElement =
    elementObjects.find(row => row.pathId === targetPathIds[0]) ?? null;
  if (!healElement) return null;
  const heal = healElement.value ?? {};
  const healTags = uniqueSorted(
    (heal.types ?? []).map(Number).filter(Number.isInteger)
  );
  const commonFunctionId = Number(
    heal.formulaParams?.function_1 ?? heal.baseIntParams?.[0]
  );
  const baseFunctionId = Number(
    heal.formulaParams?.function_2 ?? heal.baseIntParams?.[1]
  );
  const coefficientRaw = Number(
    heal.formulaParams?.formulaParamValues?.[0] ?? heal.functionParams?.[0]
  );
  const executionGateScaleRaw = Number(heal.functionParams?.[6]);
  const configuredPostFunctionId = Number(heal.function_3);
  const configuredPostCoefficientRaw = Number(heal.functionParams?.[5]);
  const commonFormula = elementFormulasById?.get(commonFunctionId) ?? null;
  const baseFormula = elementFormulasById?.get(baseFunctionId) ?? null;
  const conditionFormula = elementFormulasById?.get(211) ?? null;
  const configuredPostFormula =
    elementFormulasById?.get(configuredPostFunctionId) ?? null;
  if (
    healTags.join('|') !== '21' ||
    Number(heal.damageSourceType) !== 0 ||
    Number(heal.damageType) !== 5 ||
    Number(heal.damageElementalType) !== 0 ||
    Number(heal.ignoreDamageEvent) !== 0 ||
    Number(heal.elementCalFactor) !== 10000 ||
    Number(heal.healUp) !== 10000 ||
    Number(heal.physicalRatio) !== 0 ||
    Number(heal.magicRatio) !== 0 ||
    Number(heal.recoverSP) !== 0 ||
    Number(heal.petRecoverSP) !== 0 ||
    commonFunctionId !== 1 ||
    String(commonFormula?.functionOutput ?? '') !== 'G/10000' ||
    baseFunctionId !== 104 ||
    String(baseFormula?.functionOutput ?? '') !== '(self.MAXHP[0]*A)/10000' ||
    !Number.isFinite(coefficientRaw) ||
    coefficientRaw <= 0 ||
    executionGateScaleRaw !== 10000 ||
    configuredPostFunctionId !== 201 ||
    configuredPostCoefficientRaw !== 4000 ||
    String(configuredPostFormula?.functionOutput ?? '') !== 'F/10000' ||
    String(conditionFormula?.functionOutput ?? '') !==
      'IF(self.CURRENT_HEALTH/self.MAXHP[0]<Z/10000,1,0)'
  ) {
    return null;
  }

  const reachablePathIds = [triggerElement.pathId, healElement.pathId];
  if (
    controlResourcePathIds.some(pathId => !reachablePathIds.includes(pathId)) ||
    reachablePathIds.some(pathId => !controlResourcePathIds.includes(pathId)) ||
    elementObjects.some(row => !reachablePathIds.includes(row.pathId))
  ) {
    return null;
  }

  const triggerElementId = Number(trigger.elementConfigId);
  const healElementId = Number(heal.elementConfigId);
  const intervalMs = Number(trigger.triggerParam2);
  const targetProjection = {
    container: 'player',
    directInjectTargetType: 15,
    directInjectTargetName: 'Player',
    teamElementTag: 1000,
    teamElementTagName: 'PlayerAllEntity',
    scope: 'local-player-all-entities',
    runtimeTargetKinds: ['actor', 'kibo'],
    propagationOrder:
      'player-container-execute-then-copy-and-rebind-each-local-team-entity',
  };
  return {
    mechanismFamily: 'equipped-kibo-player-team-periodic-heal',
    trigger: {
      event: 'time-loop',
      triggerType: 0,
      triggerTypeName: 'TimeEvent',
      loopType: 1,
      loopTypeName: 'LoopEvent',
      intervalMs,
      timeExeFirstFrame: true,
      firstTriggerPolicy: 'first-positive-delta-update',
      laterTriggerThreshold: 'strict-elapsed-greater-than-ordinal-interval',
      exactThresholdTriggers: false,
      sparseUpdateCatchUp: 'at-most-one-trigger-per-update',
      conditionFailureConsumesPeriod: true,
      frequencyPolicy: 'unlimited',
      configuredTriggerFrequency: Number(trigger.triggerFrequency),
      configuredTriggerCounter: Number(trigger.triggerCounter),
      configuredTriggerIntervalTimes: Number(trigger.triggerIntervalTimes),
      triggerCounterRuntimeStatus: 'not-read-by-time-event-path',
      triggerIntervalTimesRuntimeStatus: 'not-read-by-time-event-path',
      sourceElementId: triggerElementId,
      sourcePathId: triggerElement.pathId,
    },
    condition: {
      kind: 'target-current-hp-ratio',
      formulaId: 211,
      expression: conditionFormula.functionOutput,
      evaluationEntity: 'team-copy-executor-self',
      currentHpAttributeId: -2,
      maxHpAttributeId: 5,
      thresholdRaw: Number(triggerCondition.conditionParam1),
      thresholdBasisPoints: Number(triggerCondition.conditionParam1),
      operator: 'strict-less-than',
      matchedWhen: 'current-hp-ratio-below-one',
    },
    rootEffect: {
      sourceElementId: triggerElementId,
      sourcePathId: triggerElement.pathId,
      durationMs: null,
      expiration: 'battle-exit-or-passive-skill-stop',
      stackMode: 'replace',
      stackDelta: 1,
      maxStacks: 1,
      combineType: 3,
      combineTypeName: 'Cover',
      refreshRule:
        'same-root-cover-preserves-first-root-attacker-source-and-trigger-phase',
      passiveSkillStopCleanup: true,
      exitBattleClear: true,
      clearType: 64,
    },
    heal: {
      kind: 'heal',
      target: 'team-copy-holder-self',
      sourceElementId: healElementId,
      sourcePathId: healElement.pathId,
      damageType: 5,
      damageTypeName: 'Heal',
      formula: {
        commonFunctionId,
        commonExpression: commonFormula.functionOutput,
        commonFunctionConsumer:
          'damage-element-before-execute-gate-scale-not-second-heal-formula',
        executionGateScaleRaw,
        baseFunctionId,
        baseExpression: baseFormula.functionOutput,
        coefficientRaw,
        coefficientBasisPoints: coefficientRaw,
        minimumNominalHeal: 1,
        maxHpAttributeId: 5,
        maxHpEvaluationEntity: 'inject-to-own-gameplay-kibo-root-attacker',
        configuredPostFunctionId,
        configuredPostExpression: configuredPostFormula.functionOutput,
        configuredPostCoefficientRaw,
        configuredPostRuntimeStatus:
          'configured-but-unread-by-damage-element-parse-and-get-output-heal',
      },
      outputClamp: 'min-nominal-and-max-hp-minus-current-hp',
      fullHealthPolicy: 'no-hp-change-and-no-heal-record',
      deadTargetPolicy: 'before-execute-hp-less-than-or-equal-zero-rejects',
      healModifierAttributes: {
        sourceAttributeId: 23,
        sourceAttributeName: 'SHOOT_HEALUP',
        sourceEvaluationEntity: 'inject-to-own-gameplay-kibo-root-attacker',
        targetAttributeId: 24,
        targetAttributeName: 'SUFFER_HEALUP',
        targetEvaluationEntity: 'team-copy-executor-holder',
        combinationFormula:
          'base-heal*(1+source-shoot-heal-up+target-suffer-heal-up)',
        route: 'non-ignore-heal-up-tag-general-heal-path',
      },
      recoverSp: 0,
      petRecoverSp: 0,
    },
    targets: [
      {
        target: 'local-player-all-entities',
        runtimeTargetKinds: ['actor', 'kibo'],
        directInjectTargetType: 15,
        directInjectTargetName: 'Player',
      },
    ],
    targetProjection,
    sourceGraph: {
      controlRootElementIds: [triggerElementId],
      controlRootPathIds: [triggerElement.pathId],
      reachableElementIds: [triggerElementId, healElementId],
      reachablePathIds,
      reachableElementDescriptions: [
        String(trigger.describe ?? ''),
        String(heal.describe ?? ''),
      ].filter(Boolean),
      unreachableAssetElements: [],
    },
    ownership: {
      source: 'equipped-kibo',
      rootHolder: 'local-player-all-entities',
      rootAttacker: 'inject-to-own-gameplay-kibo-entity',
      rootSource: 'inject-to-own-gameplay-kibo-entity',
      rootAttackerRuntimeEntityStatus:
        'native-inject-to-own-start-and-team-copy-verified',
      rootOwnershipPropagation:
        'after-team-element-copy-preserves-attacker-source-and-rebinds-executor-only',
      healFormulaSelf: 'root-attacker',
      healFormulaSourceMaxHp: 'root-attacker',
      healFormulaSourceShootHealUp: 'root-attacker',
      healTarget: 'team-copy-executor-holder',
      healTargetSufferHealUp: 'team-copy-executor-holder',
      directInjectTargetType: 15,
      directInjectTargetName: 'Player',
      teamCopyTargets: ['local-heroes', 'local-pets', 'local-player-kibos'],
      foregroundRequirement: 'none-in-source-assets',
      multiSourceNumericalPolicy: 'single-cover-root-per-concrete-target',
      multiSourceAttribution:
        'first-native-cover-survivor-source-order-unresolved',
    },
    scenarioAssumptions: [],
    evidenceStatus: 'source-verified',
  };
}

function parsePlayerTeamPropertyEffectPassive({
  controlRoot,
  behaviors,
  elementObjects,
}) {
  if (behaviors.length !== 1) return null;
  const directInjectTargetTypes = uniqueSorted(
    behaviors.map(behavior => Number(behavior.value.directInjectTargetType))
  );
  if (
    directInjectTargetTypes.length !== 1 ||
    directInjectTargetTypes[0] !== 15
  ) {
    return null;
  }

  const controlResourcePathIds = extractArrayPathIds(
    controlRoot.raw,
    'elements'
  );
  const rootPathIds = uniqueValues(
    behaviors.flatMap(behavior =>
      extractArrayPathIds(behavior.raw, 'elementDataList')
    )
  );
  if (
    controlResourcePathIds.length !== 1 ||
    rootPathIds.length !== 1 ||
    rootPathIds[0] !== controlResourcePathIds[0]
  ) {
    return null;
  }
  const controlResourcePathIdSet = new Set(controlResourcePathIds);
  const reachableElementObjects = elementObjects.filter(row =>
    controlResourcePathIdSet.has(row.pathId)
  );
  if (reachableElementObjects.length !== 1) return null;

  const propertyElement = reachableElementObjects[0];
  const property = propertyElement.value ?? {};
  const elementTags = uniqueSorted(
    (property.types ?? []).map(Number).filter(Number.isInteger)
  );
  if (
    !elementTags.includes(1000) ||
    elementTags.some(tag => ![53, 1000].includes(tag)) ||
    Number(property.changeType) !== 0 ||
    !Number.isInteger(Number(property.attributeID)) ||
    !Object.hasOwn(
      PROPERTY_BUCKET_BY_CALCULATE_TYPE,
      Number(property.calculateType)
    ) ||
    !Array.isArray(property.functionParams) ||
    !Number.isFinite(Number(property.functionParams[0])) ||
    Number(property.time) !== -1 ||
    Number(property.combineType) !== 3 ||
    Number(property.combineNumber) !== 1 ||
    Number(property.checkType) !== 0 ||
    (property.defaultPropertyTags?.length ?? 0) !== 0 ||
    (property.changePeopertyConditionArrayDatas?.length ?? 0) !== 0 ||
    Array.isArray(property.triggerEffectList) ||
    Array.isArray(property.injectElementDataList)
  ) {
    return null;
  }

  const defaultConditions = property.defaultConditions ?? [];
  if (defaultConditions.length > 1) return null;
  let filter = null;
  if (defaultConditions.length === 1) {
    const condition = defaultConditions[0] ?? {};
    const elementalTypeMask = Number(condition.entityElementalType);
    if (
      Number(condition.conditionType) !== 1 ||
      !Number.isInteger(elementalTypeMask) ||
      elementalTypeMask <= 0 ||
      (elementalTypeMask & ~1023) !== 0 ||
      Number(condition.targetType) !== 1 ||
      Number(condition.subConditionType_Element) !== 0 ||
      Number(condition.skillId) !== 0 ||
      Number(condition.elementTag) !== 0 ||
      Number(condition.elementId) !== 0 ||
      Number(condition.skillTag) !== 0 ||
      !Number.isFinite(Number(condition.maxChangeCount))
    ) {
      return null;
    }
    filter = {
      kind: 'entity-elemental-type-mask',
      operator: 'bitwise-overlap-nonzero',
      conditionType: 1,
      conditionTypeName: 'EntityElementType',
      checkType: 0,
      checkTypeName: 'Inject',
      targetType: 1,
      targetTypeName: 'Target',
      evaluationEntity: 'team-copy-execute-entity',
      elementalTypeMask,
      elementalTypeName:
        ENTITY_ELEMENTAL_TYPE_NAME_BY_MASK[elementalTypeMask] ?? null,
      ignoredConfigFields: {
        subConditionType_Element: Number(condition.subConditionType_Element),
        maxChangeCount: Number(condition.maxChangeCount),
        reason:
          'condition-type-1-native-branch-does-not-read-sub-condition-or-max-change-count',
      },
    };
  }

  const sourceElementId = Number(property.elementConfigId);
  const targetProjection = {
    container: 'player',
    directInjectTargetType: 15,
    directInjectTargetName: 'Player',
    teamElementTag: 1000,
    teamElementTagName: 'PlayerAllEntity',
    scope: 'local-player-all-entities',
    runtimeTargetKinds: ['actor', 'kibo'],
    propagationOrder:
      'player-container-execute-then-copy-and-rebind-each-local-team-entity',
    ...(filter ? { filter } : {}),
  };
  const effect = {
    target: 'local-player-all-entities',
    targets: ['local-player-all-entities'],
    durationMs: null,
    expiration: 'battle-exit',
    stackMode: 'replace',
    stackDelta: 1,
    maxStacks: 1,
    refreshRule: 'same-effect-replacement-at-scenario-start',
    sourceElementId,
    sourcePathId: propertyElement.pathId,
    modifiers: [
      {
        kind: 'battle-property',
        attributeId: Number(property.attributeID),
        bucket:
          PROPERTY_BUCKET_BY_CALCULATE_TYPE[Number(property.calculateType)],
        valueRaw: Number(property.functionParams[0]),
        sourceElementId,
        sourcePathId: propertyElement.pathId,
      },
    ],
    ...(filter ? { condition: filter } : {}),
  };
  const unreachableAssetElements = elementObjects
    .filter(row => !controlResourcePathIdSet.has(row.pathId))
    .map(row => ({
      sourceElementId: Number(row.value?.elementConfigId),
      sourcePathId: row.pathId,
      reason: 'not-referenced-by-control-resource-map',
    }));

  return {
    mechanismFamily: 'equipped-kibo-player-team-property-effect',
    trigger: {
      event: 'scenario-start',
      sourceScope: 'equipped-kibo',
      target: 'local-player-all-entities',
      targets: ['local-player-all-entities'],
      internalCooldownMs: 0,
      activationOrder: 'scenario-start',
      activationDelayMs: 0,
      sourceElementIds: [sourceElementId],
      sourcePathIds: [propertyElement.pathId],
    },
    effect,
    targets: [
      {
        target: 'local-player-all-entities',
        runtimeTargetKinds: ['actor', 'kibo'],
        directInjectTargetType: 15,
        directInjectTargetName: 'Player',
      },
    ],
    targetProjection,
    sourceGraph: {
      controlRootElementIds: [sourceElementId],
      controlRootPathIds: [propertyElement.pathId],
      reachableElementIds: [sourceElementId],
      reachablePathIds: [propertyElement.pathId],
      reachableElementDescriptions: [String(property.describe ?? '')].filter(
        Boolean
      ),
      unreachableAssetElements,
    },
    ownership: {
      source: 'equipped-kibo',
      effectAdder: 'equipped-kibo',
      effectTarget: 'local-player-all-entities',
      directInjectTargetType: 15,
      directInjectTargetName: 'Player',
      teamCopyTargets: ['local-heroes', 'local-pets', 'local-player-kibos'],
      foregroundRequirement: 'none-in-source-assets',
    },
    scenarioAssumptions: [],
    evidenceStatus: 'source-verified',
  };
}

function parseStaticPropertyEffectPassive({
  controlRoot,
  behaviors,
  elementObjects,
}) {
  const resourceRootPathIds = extractArrayPathIds(
    controlRoot.raw,
    'elements'
  );
  if (behaviors.length === 0 && resourceRootPathIds.length === 0) return null;
  const directInjectTargetTypes =
    behaviors.length > 0
      ? uniqueSorted(
          behaviors.map(behavior =>
            Number(behavior.value.directInjectTargetType)
          )
        )
      : [0];
  if (
    directInjectTargetTypes.length === 0 ||
    directInjectTargetTypes.some(value => ![0, 7].includes(value))
  ) {
    return null;
  }
  const controlResourcePathIds = extractArrayPathIds(
    controlRoot.raw,
    'elements'
  );
  if (controlResourcePathIds.length === 0) return null;
  const controlResourcePathIdSet = new Set(controlResourcePathIds);
  const reachableElementObjects = elementObjects.filter(row =>
    controlResourcePathIdSet.has(row.pathId)
  );
  if (reachableElementObjects.length !== controlResourcePathIds.length) {
    return null;
  }
  if (
    reachableElementObjects.some(row =>
      Array.isArray(row.value?.triggerEffectList)
    )
  ) {
    return null;
  }

  const propertyCandidates = reachableElementObjects.filter(
    row =>
      Number.isInteger(Number(row.value?.attributeID)) &&
      Object.hasOwn(
        PROPERTY_BUCKET_BY_CALCULATE_TYPE,
        Number(row.value?.calculateType)
      ) &&
      Number.isFinite(Number(row.value?.time)) &&
      Number(row.value.time) >= -1 &&
      Array.isArray(row.value?.functionParams) &&
      Number.isFinite(Number(row.value.functionParams[0])) &&
      (row.value.defaultConditions?.length ?? 0) === 0 &&
      (row.value.changePeopertyConditionArrayDatas?.length ?? 0) === 0
  );
  const propertyByPathId = new Map(
    propertyCandidates.map(row => [row.pathId, row])
  );
  const rootPathIds =
    behaviors.length > 0
      ? uniqueValues(
          behaviors.flatMap(behavior =>
            extractArrayPathIds(behavior.raw, 'elementDataList')
          )
        )
      : resourceRootPathIds;
  if (rootPathIds.length === 0) return null;
  const effectGraphs = [];
  const accountedPathIds = new Set();
  const wrapperRoots = [];
  const directRootPathIds = [];
  for (const rootPathId of rootPathIds) {
    const wrapper = reachableElementObjects.find(
      row =>
        row.pathId === rootPathId &&
        Array.isArray(row.value?.injectElementDataList) &&
        row.value.injectElementDataList.length > 0 &&
        Number.isFinite(Number(row.value?.time)) &&
        Number(row.value.time) >= -1
    );
    if (wrapper) wrapperRoots.push(wrapper);
    else directRootPathIds.push(rootPathId);
  }
  for (const wrapper of wrapperRoots) {
    const childPathIds = extractArrayPathIds(
      wrapper.raw,
      'injectElementDataList'
    );
    const properties = childPathIds
      .map(pathId => propertyByPathId.get(pathId))
      .filter(Boolean);
    if (properties.length === 0 || properties.length !== childPathIds.length) {
      return null;
    }
    effectGraphs.push({ effectContainer: wrapper, properties });
    accountedPathIds.add(wrapper.pathId);
    for (const property of properties) {
      accountedPathIds.add(property.pathId);
    }
  }
  for (const rootPathId of directRootPathIds) {
    if (accountedPathIds.has(rootPathId)) continue;
    const directProperty = propertyByPathId.get(rootPathId) ?? null;
    if (!directProperty) return null;
    effectGraphs.push({
      effectContainer: directProperty,
      properties: [directProperty],
    });
    accountedPathIds.add(directProperty.pathId);
  }
  if (effectGraphs.length === 0) return null;
  if (
    controlResourcePathIds.length !== accountedPathIds.size ||
    controlResourcePathIds.some(pathId => !accountedPathIds.has(pathId))
  ) {
    return null;
  }

  const targets = directInjectTargetTypes.map(directInjectTargetType => ({
    target: directInjectTargetType === 0 ? 'equipped-kibo' : 'pet-owner',
    runtimeTargetKind: directInjectTargetType === 0 ? 'kibo' : 'actor',
    directInjectTargetType,
    directInjectTargetName: directInjectTargetType === 0 ? 'Self' : 'PetOwner',
  }));
  const effects = effectGraphs.map(({ effectContainer, properties }) => {
    const effectTime = Number(effectContainer.value.time);
    const combineType = Number(effectContainer.value.combineType);
    return {
      ...(targets.length === 1 ? { target: targets[0].target } : {}),
      targets: targets.map(target => target.target),
      durationMs: effectTime === -1 ? null : effectTime,
      expiration: effectTime === -1 ? 'battle-exit' : 'duration',
      stackMode: combineType === 4 ? 'stack' : 'replace',
      stackDelta: 1,
      maxStacks:
        combineType === 4
          ? Math.max(1, Number(effectContainer.value.combineNumber) || 1)
          : 1,
      refreshRule:
        combineType === 4
          ? 'stack-and-refresh-duration'
          : 'not-applicable-single-scenario-start-application',
      sourceElementId: Number(effectContainer.value.elementConfigId),
      sourcePathId: effectContainer.pathId,
      modifiers: properties.map(row => ({
        kind: 'battle-property',
        attributeId: Number(row.value.attributeID),
        bucket:
          PROPERTY_BUCKET_BY_CALCULATE_TYPE[Number(row.value.calculateType)],
        valueRaw: Number(row.value.functionParams[0]),
        sourceElementId: Number(row.value.elementConfigId),
        sourcePathId: row.pathId,
      })),
    };
  });
  const mechanismFamily =
    directInjectTargetTypes.length === 2
      ? 'equipped-kibo-and-owner-property-effect'
      : directInjectTargetTypes[0] === 7
        ? 'equipped-kibo-owner-property-effect'
        : 'equipped-kibo-self-property-effect';
  const unreachableAssetElements = elementObjects
    .filter(row => !controlResourcePathIdSet.has(row.pathId))
    .map(row => ({
      sourceElementId: Number(row.value?.elementConfigId),
      sourcePathId: row.pathId,
      reason: 'not-referenced-by-control-resource-map',
    }));
  return {
    mechanismFamily,
    trigger: {
      event: 'scenario-start',
      sourceScope: 'equipped-kibo',
      ...(targets.length === 1 ? { target: targets[0].target } : {}),
      targets: targets.map(target => target.target),
      internalCooldownMs: 0,
      activationOrder: 'scenario-start',
      activationDelayMs: 0,
      sourceElementIds: effects.map(effect => effect.sourceElementId),
      sourcePathIds: effects.map(effect => effect.sourcePathId),
    },
    ...(effects.length === 1 ? { effect: effects[0] } : { effects }),
    targets,
    ...(unreachableAssetElements.length > 0
      ? {
          sourceGraph: {
            controlRootElementIds: effects.map(
              effect => effect.sourceElementId
            ),
            controlRootPathIds: effects.map(effect => effect.sourcePathId),
            reachableElementIds: controlResourcePathIds.map(pathId =>
              Number(
                reachableElementObjects.find(row => row.pathId === pathId)
                  ?.value?.elementConfigId
              )
            ),
            reachablePathIds: controlResourcePathIds,
            reachableElementDescriptions: controlResourcePathIds
              .map(pathId =>
                String(
                  reachableElementObjects.find(row => row.pathId === pathId)
                    ?.value?.describe ?? ''
                )
              )
              .filter(Boolean),
            unreachableAssetElements,
          },
        }
      : {}),
    ownership: {
      source: 'equipped-kibo',
      effectAdder: 'equipped-kibo',
      ...(targets.length === 1
        ? {
            effectTarget: targets[0].target,
            directInjectTargetType: targets[0].directInjectTargetType,
            directInjectTargetName: targets[0].directInjectTargetName,
          }
        : {}),
      effectTargets: targets.map(target => target.target),
      directInjectTargetTypes,
      directInjectTargetNames: targets.map(
        target => target.directInjectTargetName
      ),
      foregroundRequirement: 'none-in-source-assets',
    },
    scenarioAssumptions: [],
    evidenceStatus: 'source-verified',
  };
}

function createPropertySkillOccurrences({
  pet,
  field,
  mirrorField,
  scopeClass,
  kibo,
  skillLevelsBySkillId,
  languageById,
}) {
  const entries = parseSkillList(pet[field]);
  const mirrorEntries = parseSkillList(pet[mirrorField]);
  const mirrorIdentity = mirrorEntries.map(createSkillListIdentity).join('|');
  const sourceIdentity = entries.map(createSkillListIdentity).join('|');
  const traits = kibo?.traits ?? [];
  return entries.map((entry, index) => {
    const levelRow = firstSkillLevel(skillLevelsBySkillId, entry.skillId);
    const sourceName = resolveLanguageValue(languageById, levelRow?.name);
    const sourceDescription = resolveLanguageValue(
      languageById,
      levelRow?.skillDescribe
    );
    const matchedTrait = sourceDescription
      ? traits.find(
          trait =>
            normalizeText(trait.description) ===
            normalizeText(sourceDescription)
        )
      : null;
    const fallbackTrait =
      scopeClass === 'pve-combat-talent-passive'
        ? (traits[index] ?? null)
        : (traits[traits.length - entries.length + index] ?? null);
    return {
      kiboId: Number(pet.id),
      slot: entry.slot,
      skillId: entry.skillId,
      level: entry.level,
      sourceField: field,
      mirrorField,
      mirrorAligned: sourceIdentity === mirrorIdentity,
      sourceName,
      sourceDescription,
      traitName: (matchedTrait ?? fallbackTrait)?.name ?? null,
      traitDescription: (matchedTrait ?? fallbackTrait)?.description ?? null,
      traitTextMatch: Boolean(matchedTrait),
      scopeClass,
    };
  });
}

function createPublicActionClosureRow(action) {
  const reasons = uniqueValues(action.reasons ?? []);
  const ZERO_DISTANCE_POLICY_COVERED_REASONS = new Set([
    'trigger-frame-missing',
    'projectile-impact-frame-runtime-dependent',
  ]);
  const strictEvidenceClosed =
    action.runnable === true &&
    reasons.length === 0 &&
    action.scenarioRuntimeStatus === 'source-verified';
  const scenarioAssumed =
    action.runnable === true &&
    action.scenarioRuntimeStatus === 'scenario-assumed-zero-distance';
  const policyCovered =
    scenarioAssumed &&
    reasons.every(reason => ZERO_DISTANCE_POLICY_COVERED_REASONS.has(reason));
  return {
    identity: action.identity,
    kiboId: Number(action.ownerId),
    kiboName: action.ownerName,
    actionKind: action.actionKind,
    sourceSkillId: Number(action.sourceSkillId),
    controlSkillId: Number(action.controlSkillId),
    closureClass: strictEvidenceClosed
      ? 'evidence-closed'
      : policyCovered
        ? 'evidence-closed'
      : scenarioAssumed
        ? 'scenario-assumed'
        : 'unresolved',
    runtimeStatus: action.runtimeStatus,
    runnable: action.runnable === true,
    sourceEvidenceStatus: action.sourceEvidenceStatus,
    scenarioRuntimeStatus: action.scenarioRuntimeStatus,
    reasons,
    ...(action.scenarioRuntimeStatus === 'scenario-assumed-zero-distance'
      ? {
          zeroDistancePolicy: {
            approved: 'user-approved-sync-rebaseline-2026-08-05',
            coversAllReasons: policyCovered,
            coveredReasons: reasons.filter(reason =>
              ZERO_DISTANCE_POLICY_COVERED_REASONS.has(reason)
            ),
            unresolvedReasons: reasons.filter(
              reason => !ZERO_DISTANCE_POLICY_COVERED_REASONS.has(reason)
            ),
          },
        }
      : {}),
    timing: action.timing,
    dimensions: action.dimensions,
    semanticEffects: action.semanticEffects,
    provenance: [action.sourceIdentity],
  };
}

function createPassiveMechanicsCatalog({
  generatedAt,
  pvePassiveSkills,
  sources,
}) {
  const definitions = pvePassiveSkills
    .filter(row => row.mechanic)
    .map(row => ({
      skillId: row.skillId,
      kiboIds: row.kiboIds,
      name: row.sourceName,
      description: row.sourceDescription,
      confidence: row.confidence,
      provenance: row.provenance,
      ...row.mechanic,
    }));
  const unresolved = pvePassiveSkills
    .filter(row => !row.mechanic)
    .map(row => ({
      skillId: row.skillId,
      kiboIds: row.kiboIds,
      reasons: row.unresolvedReasons,
      ...(row.unresolvedEvidence ? { evidence: row.unresolvedEvidence } : {}),
      provenance: row.provenance,
    }));
  const triggerLifetime = {
    unlimited: 0,
    finite: 0,
    'evidence-open': 0,
  };
  for (const definition of definitions) {
    const classification = definition.trigger?.triggerLifetime;
    if (Object.hasOwn(triggerLifetime, classification)) {
      triggerLifetime[classification] += 1;
    }
  }
  return {
    schemaVersion: 1,
    kind: 'azpr-kibo-passive-mechanics-catalog',
    status:
      unresolved.length > 0
        ? 'kibo-passive-mechanics-ready-with-explicit-gaps'
        : 'kibo-passive-mechanics-ready',
    generatedAt,
    source: {
      petTable: sources.petTable,
      skillTable: sources.skillTable,
      skillLevelTable: sources.skillLevelTable,
      skillLogicTable: sources.skillLogicTable,
      extractorBattleRoot: sources.extractorBattleRoot,
    },
    definitions,
    unresolved,
    summary: {
      uniquePvePassiveCount: pvePassiveSkills.length,
      evidenceClosed: definitions.length,
      scenarioAssumed: 0,
      unresolved: unresolved.length,
      triggerLifetime,
      applied: true,
    },
    applied: true,
  };
}

function createMaturityMatrix({
  generatedAt,
  kibos,
  fixedSkills,
  pvePassiveSkills,
  pvpPassiveSkills,
  publicActions,
  sources,
  staticAudit,
}) {
  const fixedByKibo = groupRows(
    fixedSkills.flatMap(skill =>
      skill.kiboIds.map(kiboId => ({ kiboId, skill }))
    ),
    row => row.kiboId
  );
  const pveByKibo = groupRows(
    pvePassiveSkills.flatMap(skill =>
      skill.kiboIds.map(kiboId => ({ kiboId, skill }))
    ),
    row => row.kiboId
  );
  const pvpByKibo = groupRows(
    pvpPassiveSkills.flatMap(skill =>
      skill.kiboIds.map(kiboId => ({ kiboId, skill }))
    ),
    row => row.kiboId
  );
  const actionsByKibo = groupRows(publicActions, row => row.kiboId);
  const rows = kibos.map(kibo => {
    const kiboId = Number(kibo.id);
    const actions = actionsByKibo.get(kiboId) ?? [];
    const pveRows = (pveByKibo.get(kiboId) ?? []).map(row => row.skill);
    const pvpRows = (pvpByKibo.get(kiboId) ?? []).map(row => row.skill);
    const fixedRows = (fixedByKibo.get(kiboId) ?? []).map(row => row.skill);
    const actionByKind = Object.fromEntries(
      actions.map(action => [action.actionKind, action])
    );
    const passiveReady =
      pveRows.length > 0 &&
      pveRows.every(row => row.runtimeStatus === 'runtime-ready');
    const actionsReady = ['signature', 'active', 'break'].every(
      kind => actionByKind[kind]?.closureClass === 'evidence-closed'
    );
    const fixedClassified = fixedRows.every(
      row => row.closureClass === 'evidence-closed'
    );
    const staticProfile = staticAudit?.profiles.get(kiboId);
    const staticAuditReady =
      staticProfile?.applied === true &&
      (staticProfile.speciesAttributes?.length ?? 0) > 0 &&
      (staticAudit?.levelGrowthRows?.length ?? 0) === 100 &&
      (staticAudit?.hobbyRows?.length ?? 0) > 0 &&
      (staticAudit?.intimacyRows?.length ?? 0) > 0 &&
      (staticAudit?.comprehensionGrades?.length ?? 0) > 0;
    const remainingGaps = [
      !passiveReady ? 'pve-passive-runtime-incomplete' : null,
      !actionsReady ? 'public-action-closure-incomplete' : null,
      !fixedClassified ? 'fixed-skill-classification-incomplete' : null,
      !staticAuditReady ? 'static-attribute-inheritance-audit-pending' : null,
    ].filter(Boolean);
    return {
      kiboId,
      kiboName: kibo.name,
      staticAttributes: {
        status: staticAuditReady
          ? 'evidence-closed'
          : 'generated-data-present-inheritance-audit-pending',
        closureClass: staticAuditReady ? 'evidence-closed' : 'unresolved',
        evidence: {
          profileApplied: staticProfile?.applied === true,
          speciesAttributeCount: staticProfile?.speciesAttributes?.length ?? 0,
          levelGrowthRows: staticAudit?.levelGrowthRows?.length ?? 0,
          hobbyRows: staticAudit?.hobbyRows?.length ?? 0,
          intimacyRows: staticAudit?.intimacyRows?.length ?? 0,
          comprehensionGrades: staticAudit?.comprehensionGrades?.length ?? 0,
        },
      },
      talentPassive: {
        pveSkillIds: pveRows.map(row => row.skillId),
        pveRuntimeStatus: passiveReady ? 'runtime-ready' : 'runtime-unresolved',
        pvpSkillIds: pvpRows.map(row => row.skillId),
        pvpClassificationStatus: pvpRows.every(
          row => row.classificationStatus === 'evidence-closed'
        )
          ? 'evidence-closed'
          : 'unresolved',
        fixedSkillIds: fixedRows.map(row => row.skillId),
        fixedClassificationStatus: fixedClassified
          ? 'evidence-closed'
          : 'unresolved',
      },
      actions: {
        signature: actionByKind.signature ?? null,
        active: actionByKind.active ?? null,
        break: actionByKind.break ?? null,
      },
      sp: summarizeActionDimension(actions, ['actorSp', 'kiboSp']),
      hit: summarizeActionDimension(actions, ['enemyHp', 'enemyToughness']),
      effects: summarizeActionDimension(actions, [
        'healing',
        'shield',
        'dynamicProperty',
        'tuningMark',
      ]),
      zeroDistanceClosure: countClosure(actions),
      machineOptimizationReady:
        passiveReady &&
        actionsReady &&
        fixedClassified &&
        remainingGaps.length === 0,
      remainingGaps,
    };
  });
  return {
    schemaVersion: 1,
    kind: 'azpr-kibo-machine-optimization-maturity-matrix',
    status: 'kibo-maturity-matrix-ready-with-explicit-gaps',
    generatedAt,
    sources: {
      kibos: sources.kibos,
      census: 'reports/kibo-headless/kibo-mechanics-census.json',
      publicRuntimeCoverage: sources.publicRuntimeCoverage,
    },
    rows,
    summary: {
      kiboCount: rows.length,
      machineOptimizationReadyCount: rows.filter(
        row => row.machineOptimizationReady
      ).length,
      machineOptimizationReadyKiboIds: rows
        .filter(row => row.machineOptimizationReady)
        .map(row => row.kiboId),
      actionClosure: countClosure(publicActions),
      pvePassiveMechanics: countClosure(pvePassiveSkills),
      fixedSkillClassification: countClosure(fixedSkills),
      staticAttributeInheritance: {
        evidenceClosed: rows.filter(
          row => row.staticAttributes.closureClass === 'evidence-closed'
        ).length,
        unresolved: rows.filter(
          row => row.staticAttributes.closureClass !== 'evidence-closed'
        ).length,
      },
    },
  };
}

function summarizeActionDimension(actions, keys) {
  const counts = {};
  for (const action of actions) {
    for (const key of keys) {
      for (const [status, count] of Object.entries(
        action.dimensions?.[key] ?? {}
      )) {
        counts[status] = (counts[status] ?? 0) + Number(count);
      }
    }
  }
  return {
    statuses: counts,
    closureClass:
      (counts.unresolved ?? 0) > 0 ? 'unresolved' : 'evidence-closed',
  };
}

function parseSkillList(value) {
  if (!String(value ?? '').trim()) return [];
  return String(value)
    .split('|')
    .map(part => part.split('#').map(valuePart => Number(valuePart)))
    .filter(parts => Number.isInteger(parts[0]) && Number.isInteger(parts[1]))
    .map(parts => ({
      slot: parts[0],
      skillId: parts[1],
      level: Number.isInteger(parts[2]) ? parts[2] : null,
    }));
}

function createSkillListIdentity(entry) {
  return `${entry.slot}#${entry.skillId}#${entry.level ?? ''}`;
}

function parseInt64LanguageRows(raw) {
  const result = new Map();
  const pattern = /"id"\s*:\s*(-?\d+)\s*,\s*"value"\s*:\s*("(?:\\.|[^"\\])*")/g;
  for (const match of raw.matchAll(pattern)) {
    result.set(match[1], JSON.parse(match[2]));
  }
  return result;
}

function resolveLanguageValue(languageById, id) {
  if (id == null || id === '') return null;
  const value = languageById.get(String(id));
  return String(value ?? '').trim() || null;
}

function normalizeText(value) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function firstSkillLevel(skillLevelsBySkillId, skillId) {
  return (skillLevelsBySkillId.get(Number(skillId)) ?? [])
    .slice()
    .sort((a, b) => Number(a.level) - Number(b.level))[0];
}

async function readJsonDirectory(directory) {
  const entries = await safeReadDirectory(directory, { withFileTypes: true });
  const rows = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const sourceFile = path.join(directory, entry.name).replaceAll('\\', '/');
    const raw = await fs.readFile(sourceFile, 'utf8');
    const value = JSON.parse(raw);
    if (value.stubOnly === true) continue;
    rows.push({
      sourceFile,
      raw,
      value,
      pathId: extractPathIdFromFileName(entry.name),
    });
  }
  return rows;
}

function extractPathIdFromFileName(fileName) {
  return fileName.match(/__(-?\d+)\.json$/)?.[1] ?? null;
}

function extractObjectPathIds(raw, key) {
  const pattern = new RegExp(
    `"${escapeRegExp(key)}"\\s*:\\s*\\{[^}]*"m_PathID"\\s*:\\s*(-?\\d+)`,
    'g'
  );
  return [...raw.matchAll(pattern)].map(match => match[1]);
}

function extractArrayPathIds(raw, key) {
  const keyIndex = raw.indexOf(`"${key}"`);
  if (keyIndex < 0) return [];
  const arrayStart = raw.indexOf('[', keyIndex);
  if (arrayStart < 0) return [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let arrayEnd = -1;
  for (let index = arrayStart; index < raw.length; index += 1) {
    const char = raw[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === '[') {
      depth += 1;
    } else if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        arrayEnd = index;
        break;
      }
    }
  }
  if (arrayEnd < 0) return [];
  return [
    ...raw
      .slice(arrayStart, arrayEnd + 1)
      .matchAll(/"m_PathID"\s*:\s*(-?\d+)/g),
  ].map(match => match[1]);
}

function groupRows(rows, keySelector) {
  const result = new Map();
  for (const row of rows) {
    const key = keySelector(row);
    const group = result.get(key) ?? [];
    group.push(row);
    result.set(key, group);
  }
  return result;
}

function countClosure(rows) {
  const counts = {
    evidenceClosed: 0,
    scenarioAssumed: 0,
    unresolved: 0,
  };
  for (const row of rows) {
    if (row.closureClass === 'evidence-closed') {
      counts.evidenceClosed += 1;
    } else if (row.closureClass === 'scenario-assumed') {
      counts.scenarioAssumed += 1;
    } else {
      counts.unresolved += 1;
    }
  }
  return counts;
}

function countValues(values) {
  return Object.fromEntries(
    [...groupRows(values, value => value).entries()]
      .map(([value, rows]) => [value, rows.length])
      .sort(([a], [b]) => String(a).localeCompare(String(b)))
  );
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) =>
    typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a).localeCompare(String(b))
  );
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertDenominator(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(
      `${label} denominator drifted: expected ${expected}, received ${actual}`
    );
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function safeReadDirectory(directory, options) {
  try {
    return await fs.readdir(directory, options);
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

function stringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeOrAssertOutputs({ repoRoot, outputs, write, assertClean }) {
  const targets = [
    {
      path: path.join(
        repoRoot,
        'reports',
        'kibo-headless',
        'kibo-mechanics-census.json'
      ),
      value: outputs.census,
    },
    {
      path: path.join(
        repoRoot,
        'reports',
        'kibo-headless',
        'kibo-maturity-matrix.json'
      ),
      value: outputs.maturityMatrix,
    },
    {
      path: path.join(
        repoRoot,
        'src',
        'data',
        'generated',
        'kibo-passive-mechanics.json'
      ),
      value: outputs.mechanicsCatalog,
    },
  ];
  const dirty = [];
  for (const target of targets) {
    const expected = stringify(target.value);
    if (assertClean) {
      let actual = null;
      try {
        actual = await fs.readFile(target.path, 'utf8');
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
      if (actual !== expected) dirty.push(target.path);
    }
    if (write) {
      await fs.mkdir(path.dirname(target.path), { recursive: true });
      await fs.writeFile(target.path, expected, 'utf8');
    }
  }
  if (dirty.length > 0) {
    throw new Error(
      `Kibo headless generated outputs are stale:\n${dirty.join('\n')}`
    );
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const repoRoot = DEFAULT_REPO_ROOT;
  const outputs = await createKiboHeadlessCensus({ repoRoot });
  await writeOrAssertOutputs({
    repoRoot,
    outputs,
    write: args.has('--write'),
    assertClean: args.has('--assert-clean'),
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        denominators: outputs.census.denominators,
        fixedSkillClassification:
          outputs.census.summary.fixedSkillClassification,
        pvePassiveMechanics: outputs.census.summary.pvePassiveMechanics,
        publicActionClosure: outputs.census.summary.publicActionClosure,
        machineOptimizationReadyCount:
          outputs.maturityMatrix.summary.machineOptimizationReadyCount,
      },
      null,
      2
    )}\n`
  );
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  await main();
}
