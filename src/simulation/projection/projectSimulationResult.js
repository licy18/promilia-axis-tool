import { createThreeValueGenerationBundle } from '../generation/threeValueGenerationBuilder';
import { ACTION_TYPES } from '../../domain/projectSchema';
import {
  createSelfEnergyDeltaSummaryByActor,
  createThreeValueRuntimeProjection,
} from '../runtime/threeValueRuntimeProjection';
import { projectVerifiedTuningMarkCurves } from './projectVerifiedTuningMarkCurves';

const DEFAULT_SKILL_ASSET_EVIDENCE_PATH =
  'src/data/generated/skill-asset-evidence.json';
let SKILL_ASSET_EVIDENCE_PATH = DEFAULT_SKILL_ASSET_EVIDENCE_PATH;
let DAMAGE_ELEMENT_FIELD_MAPPING_EVIDENCE = {};
let DAMAGE_ELEMENT_FIELD_MAPPING_EVIDENCE_KIND =
  'azpr-damage-element-field-mapping-evidence';
let DAMAGE_ELEMENT_FIELD_MAPPING_BY_SKILL_ID = new Map();
let DAMAGE_ELEMENT_FIELD_MAPPING_BY_SKILL_ID_AND_PATH_ID = new Map();
let EXTERNAL_ELEMENT_OBJECT_BY_SKILL_ID_AND_PATH_ID = new Map();
let CURRENT_SKILL_CONTROL_EVIDENCE_BY_SKILL_ID = new Map();
let SUMMON_TARGET_BY_UNIT_ID = new Map();
let projectSimulationSkillDiagnosticsStatus = {
  loaded: false,
  sourcePath: DEFAULT_SKILL_ASSET_EVIDENCE_PATH,
  skillControlCount: 0,
};

export function installProjectSimulationSkillDiagnostics(projection = {}) {
  const skillAssetEvidence = projection.skillAssetEvidence ?? projection;
  SKILL_ASSET_EVIDENCE_PATH =
    projection.sources?.skillAssetEvidence ?? DEFAULT_SKILL_ASSET_EVIDENCE_PATH;
  DAMAGE_ELEMENT_FIELD_MAPPING_EVIDENCE =
    skillAssetEvidence.damageElementFieldMappingEvidence ?? {};
  DAMAGE_ELEMENT_FIELD_MAPPING_EVIDENCE_KIND =
    DAMAGE_ELEMENT_FIELD_MAPPING_EVIDENCE.sourceKind ??
    'azpr-damage-element-field-mapping-evidence';
  DAMAGE_ELEMENT_FIELD_MAPPING_BY_SKILL_ID = new Map(
    (DAMAGE_ELEMENT_FIELD_MAPPING_EVIDENCE.skills ?? [])
      .map(skill => [Number(skill.skillId), skill])
      .filter(([skillId]) => Number.isFinite(skillId))
  );
  DAMAGE_ELEMENT_FIELD_MAPPING_BY_SKILL_ID_AND_PATH_ID =
    createDamageElementFieldMappingBySkillIdAndPathId(
      DAMAGE_ELEMENT_FIELD_MAPPING_EVIDENCE
    );
  EXTERNAL_ELEMENT_OBJECT_BY_SKILL_ID_AND_PATH_ID =
    createExternalElementObjectBySkillIdAndPathId(
      skillAssetEvidence.externalElementObjectEvidence
    );
  CURRENT_SKILL_CONTROL_EVIDENCE_BY_SKILL_ID = new Map(
    (skillAssetEvidence.currentSkillControlEvidence ?? [])
      .map(skill => [Number(skill.skillId), skill])
      .filter(([skillId]) => Number.isFinite(skillId))
  );
  SUMMON_TARGET_BY_UNIT_ID = createSummonTargetLookupByUnitId(
    skillAssetEvidence.summonTargetSkillEvidence ?? {}
  );
  projectSimulationSkillDiagnosticsStatus = {
    loaded: true,
    sourcePath: SKILL_ASSET_EVIDENCE_PATH,
    skillControlCount: CURRENT_SKILL_CONTROL_EVIDENCE_BY_SKILL_ID.size,
  };
  return { ...projectSimulationSkillDiagnosticsStatus };
}

export function resetProjectSimulationSkillDiagnostics() {
  SKILL_ASSET_EVIDENCE_PATH = DEFAULT_SKILL_ASSET_EVIDENCE_PATH;
  DAMAGE_ELEMENT_FIELD_MAPPING_EVIDENCE = {};
  DAMAGE_ELEMENT_FIELD_MAPPING_EVIDENCE_KIND =
    'azpr-damage-element-field-mapping-evidence';
  DAMAGE_ELEMENT_FIELD_MAPPING_BY_SKILL_ID = new Map();
  DAMAGE_ELEMENT_FIELD_MAPPING_BY_SKILL_ID_AND_PATH_ID = new Map();
  EXTERNAL_ELEMENT_OBJECT_BY_SKILL_ID_AND_PATH_ID = new Map();
  CURRENT_SKILL_CONTROL_EVIDENCE_BY_SKILL_ID = new Map();
  SUMMON_TARGET_BY_UNIT_ID = new Map();
  projectSimulationSkillDiagnosticsStatus = {
    loaded: false,
    sourcePath: DEFAULT_SKILL_ASSET_EVIDENCE_PATH,
    skillControlCount: 0,
  };
}

export function getProjectSimulationSkillDiagnosticsStatus() {
  return { ...projectSimulationSkillDiagnosticsStatus };
}
const AZPR_TIMELINE_FRAME_RATE = 60;
const AZPR_TIMELINE_FRAME_MS = 1000 / AZPR_TIMELINE_FRAME_RATE;
const THREE_VALUE_CURVE_TRACK_DEFINITIONS = [
  {
    key: 'enemyHpDamage',
    label: '敌人HP伤害',
    resultField: 'hpDamage',
    candidateSeriesKey: 'hpDamageFormulaParamCandidate',
    ownerScope: 'enemy',
    valueUnit: 'raw-damage',
    resultStatus: 'raw-hp-projection-applied-final-azpr-formula-unconfirmed',
    formulaStatus: 'formula-candidate-preview-unapplied',
  },
  {
    key: 'enemyToughnessDamage',
    label: '敌人韧性削减',
    resultField: 'toughnessDamage',
    candidateSeriesKey: 'toughnessDamageCandidate',
    ownerScope: 'enemy',
    valueUnit: 'raw-field',
    resultStatus: 'zero-placeholder-until-toughness-formula-confirmed',
    formulaStatus: 'weak-break-field-candidate-unapplied',
  },
  {
    key: 'selfEnergyChange',
    label: '自身能量变化',
    resultField: 'selfEnergyChange',
    candidateSeriesKey: 'selfEnergyCandidate',
    ownerScope: 'actor',
    valueUnit: 'sp',
    resultStatus: 'resource-delta-applied-recover-sp-candidate-unapplied',
    formulaStatus: 'recover-sp-runtime-probe-partially-confirmed',
  },
];
const AZPR_IL2CPP_DUMP_CS_PATH =
  'C:/Codex/AzPr Extractor/outputs/il2cpp-dump/dump.cs';
const AZPR_IL2CPP_SCRIPT_JSON_PATH =
  'C:/Codex/AzPr Extractor/outputs/il2cpp-dump/script.json';
const AZPR_IL2CPP_HEADER_PATH =
  'C:/Codex/AzPr Extractor/outputs/il2cpp-dump/il2cpp.h';
const AZPR_IL2CPP_STRING_LITERAL_PATH =
  'C:/Codex/AzPr Extractor/outputs/il2cpp-dump/stringliteral.json';
const AZPR_IL2CPP_DUMMY_DLL_PATH =
  'C:/Codex/AzPr Extractor/outputs/il2cpp-dump/DummyDll/Assembly-CSharp.dll';
const AZPR_TC_GAME_ASSEMBLY_PATH =
  'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll';
const AZPR_TC_GLOBAL_METADATA_PATH =
  'C:/AP/AzurPromilia_TC/AzurPromilia_game/AzurPromilia_Data/il2cpp_data/Metadata/global-metadata.dat';
const AZPR_JP_GAME_ASSEMBLY_PATH =
  'C:/AP/YostarGames/AZUPRO_JP/GameAssembly.dll';
const AZPR_NATIVE_DISASSEMBLY_TOOL =
  'C:/Program Files/Microsoft Visual Studio/2022/Community/VC/Tools/MSVC/14.44.35207/bin/Hostx64/x64/dumpbin.exe';
const RUNTIME_NATIVE_METHOD_SYMBOLS = [
  {
    chains: ['selfEnergyChange'],
    className: 'RecoverSPArgs',
    method: '.ctor',
    qualifiedName: 'Lens.Gameplay.Modules.BigWorld.RecoverSPArgs$$.ctor',
    address: 19218704,
    rva: '0x1254110',
    signature:
      'void RecoverSPArgs..ctor(RecoverSPArgs* __this, const MethodInfo* method)',
  },
  {
    chains: ['hpDamage'],
    className: 'AliveElementSystem',
    method: 'ExecuteDamageElement',
    qualifiedName:
      'Lens.Gameplay.Modules.BigWorld.AliveElementSystem$$ExecuteDamageElement',
    address: 20009456,
    rva: '0x13151F0',
    signature:
      'OutputDamageData AliveElementSystem.ExecuteDamageElement(DamageElement* element)',
  },
  {
    chains: ['hpDamage'],
    className: 'AliveElementSystem',
    method: 'OnExecuteDamageElement',
    qualifiedName:
      'Lens.Gameplay.Modules.BigWorld.AliveElementSystem$$OnExecuteDamageElement',
    address: 20023296,
    rva: '0x1318800',
    signature:
      'void AliveElementSystem.OnExecuteDamageElement(DamageElement* damageElement)',
  },
  {
    chains: ['hpDamage'],
    className: 'DamageElement',
    method: 'BaseExecute',
    qualifiedName: 'Lens.Gameplay.Modules.BigWorld.DamageElement$$BaseExecute',
    address: 20490112,
    rva: '0x138A780',
    signature: 'void DamageElement.BaseExecute()',
  },
  {
    chains: ['hpDamage'],
    className: 'DamageElement',
    method: 'ExecuteEffect',
    qualifiedName:
      'Lens.Gameplay.Modules.BigWorld.DamageElement$$ExecuteEffect',
    address: 20500464,
    rva: '0x138CFF0',
    signature: 'void DamageElement.ExecuteEffect()',
  },
  {
    chains: ['hpDamage'],
    className: 'DamageElement',
    method: 'Execute',
    qualifiedName: 'Lens.Gameplay.Modules.BigWorld.DamageElement$$Execute',
    address: 20500704,
    rva: '0x138D0E0',
    signature: 'void DamageElement.Execute()',
  },
  {
    chains: ['hpDamage'],
    className: 'DamageElement',
    method: 'Parse',
    qualifiedName: 'Lens.Gameplay.Modules.BigWorld.DamageElement$$Parse',
    address: 20506080,
    rva: '0x138E5E0',
    signature:
      'void DamageElement.Parse(TElementParams* param, int32 skillId, CustomBattleVerifyInfo verifyInfo)',
  },
  {
    chains: ['selfEnergyChange'],
    className: 'DamageElement',
    method: 'RecoverSP',
    qualifiedName: 'Lens.Gameplay.Modules.BigWorld.DamageElement$$RecoverSP',
    address: 20508384,
    rva: '0x138EEE0',
    signature: 'void DamageElement.RecoverSP()',
  },
  {
    chains: ['selfEnergyChange'],
    className: 'SPSystem',
    method: 'OnTransmit',
    qualifiedName: 'Lens.Gameplay.Modules.BigWorld.SPSystem$$OnTransmit',
    address: 21510128,
    rva: '0x14837F0',
    signature: 'void SPSystem.OnTransmit(int32 type, ITransmitArgs* args)',
  },
  {
    chains: ['selfEnergyChange'],
    className: 'SPSystem',
    method: 'RecoverSP',
    qualifiedName: 'Lens.Gameplay.Modules.BigWorld.SPSystem$$RecoverSP',
    address: 21512000,
    rva: '0x1483F40',
    signature:
      'void SPSystem.RecoverSP(int32 recoverTagType, float baseDelta, float delta)',
  },
  {
    chains: ['toughnessDamage'],
    className: 'WeakBreakSystem',
    method: 'OnSelfTakenDamage',
    qualifiedName:
      'Lens.Gameplay.Modules.BigWorld.WeakBreakSystem$$OnSelfTakenDamage',
    address: 21759056,
    rva: '0x14C0450',
    signature: 'void WeakBreakSystem.OnSelfTakenDamage(DamageRecord* record)',
  },
  {
    chains: ['toughnessDamage'],
    className: 'WeakBreakSystem',
    method: 'OnSelfTakenDamage',
    qualifiedName:
      'Lens.Gameplay.Modules.BigWorld.WeakBreakSystem$$OnSelfTakenDamage',
    address: 21759264,
    rva: '0x14C0520',
    signature: 'void WeakBreakSystem.OnSelfTakenDamage()',
  },
  {
    chains: ['toughnessDamage'],
    className: 'WeakBreakSystem',
    method: 'OnTransmit',
    qualifiedName: 'Lens.Gameplay.Modules.BigWorld.WeakBreakSystem$$OnTransmit',
    address: 21759392,
    rva: '0x14C05A0',
    signature:
      'void WeakBreakSystem.OnTransmit(int32 type, ITransmitArgs* args)',
  },
  {
    chains: ['toughnessDamage'],
    className: 'WeakBreakSystem',
    method: 'OnWeakPointChange',
    qualifiedName:
      'Lens.Gameplay.Modules.BigWorld.WeakBreakSystem$$OnWeakPointChange',
    address: 21762384,
    rva: '0x14C1150',
    signature: 'void WeakBreakSystem.OnWeakPointChange(EntityHandle* attacker)',
  },
  {
    chains: ['toughnessDamage'],
    className: 'WeakBreakSystem',
    method: 'UpdateWeakState',
    qualifiedName:
      'Lens.Gameplay.Modules.BigWorld.WeakBreakSystem$$UpdateWeakState',
    address: 21765248,
    rva: '0x14C1C80',
    signature: 'void WeakBreakSystem.UpdateWeakState()',
  },
  {
    chains: ['toughnessDamage'],
    className: 'WeakBreakSystem',
    method: 'WeakBreakEnd',
    qualifiedName:
      'Lens.Gameplay.Modules.BigWorld.WeakBreakSystem$$WeakBreakEnd',
    address: 21769568,
    rva: '0x14C2D60',
    signature: 'void WeakBreakSystem.WeakBreakEnd()',
  },
  {
    chains: ['toughnessDamage'],
    className: 'WeakBreakSystem',
    method: 'WeakBreakEnding',
    qualifiedName:
      'Lens.Gameplay.Modules.BigWorld.WeakBreakSystem$$WeakBreakEnding',
    address: 21769648,
    rva: '0x14C2DB0',
    signature: 'void WeakBreakSystem.WeakBreakEnding()',
  },
  {
    chains: ['toughnessDamage'],
    className: 'WeakBreakSystem',
    method: 'WeakBreaking',
    qualifiedName:
      'Lens.Gameplay.Modules.BigWorld.WeakBreakSystem$$WeakBreaking',
    address: 21771216,
    rva: '0x14C33D0',
    signature: 'void WeakBreakSystem.WeakBreaking()',
  },
  {
    chains: ['toughnessDamage'],
    className: 'WeakBreakSystem',
    method: 'WeaknessPointUpdate',
    qualifiedName:
      'Lens.Gameplay.Modules.BigWorld.WeakBreakSystem$$WeaknessPointUpdate',
    address: 21772752,
    rva: '0x14C39D0',
    signature: 'void WeakBreakSystem.WeaknessPointUpdate()',
  },
  {
    chains: ['hpDamage'],
    className: 'FormulaUtility',
    method: 'Calculate',
    qualifiedName: 'Lens.Gameplay.Modules.BigWorld.FormulaUtility$$Calculate',
    address: 25675840,
    rva: '0x187C840',
    signature:
      'MyFloat FormulaUtility.Calculate(TElement_formula* formulaData, IElement* element, List<int>* functionParams, AliveData* self, AliveData* target, AliveData* source)',
  },
  {
    chains: ['hpDamage'],
    className: 'FormulaUtility',
    method: 'GetFunctionParams',
    qualifiedName:
      'Lens.Gameplay.Modules.BigWorld.FormulaUtility$$GetFunctionParams',
    address: 25684448,
    rva: '0x187E9E0',
    signature:
      'int32 FormulaUtility.GetFunctionParams(int32 index, IElement* element, List<int>* functionParams)',
  },
  {
    chains: ['hpDamage'],
    className: 'FormulaUtility',
    method: 'GetOutputDamage',
    qualifiedName:
      'Lens.Gameplay.Modules.BigWorld.FormulaUtility$$GetOutputDamage',
    address: 25686880,
    rva: '0x187F360',
    signature:
      'OutputDamageData FormulaUtility.GetOutputDamage(IElement* element, EntityHandle* attacker, EntityHandle* executor, EntityHandle* source, int32 skillGroupId, int32 criticalRandom)',
  },
  {
    chains: ['toughnessDamage'],
    className: 'FormulaUtility',
    method: 'GetOutputWeaknessDamage',
    qualifiedName:
      'Lens.Gameplay.Modules.BigWorld.FormulaUtility$$GetOutputWeaknessDamage',
    address: 25714672,
    rva: '0x1885FF0',
    signature:
      'OutputDamageData FormulaUtility.GetOutputWeaknessDamage(IElement* element, EntityHandle* attacker, EntityHandle* executor, EntityHandle* source, int32 skillGroupId)',
  },
  {
    chains: ['hpDamage'],
    className: 'FormulaUtility',
    method: 'GetOutput',
    qualifiedName: 'Lens.Gameplay.Modules.BigWorld.FormulaUtility$$GetOutput',
    address: 25718032,
    rva: '0x1886D10',
    signature:
      'OutputDamageData FormulaUtility.GetOutput(IElement* elementConfig, EntityHandle* attacker, EntityHandle* executor, EntityHandle* source, int32 skillGroupId, int32 criticalRandom)',
  },
  {
    chains: ['hpDamage'],
    className: 'FormulaUtility',
    method: 'SkillDmgUp',
    qualifiedName: 'Lens.Gameplay.Modules.BigWorld.FormulaUtility$$SkillDmgUp',
    address: 25730464,
    rva: '0x1889DA0',
    signature:
      'MyFloat FormulaUtility.SkillDmgUp(AliveData* executorData, AliveData* attackerData, int32 skillGroupId, IElement* element, MyFloat* weaknessSkillDmgUp)',
  },
  {
    chains: ['hpDamage', 'toughnessDamage'],
    className: 'FormulaUtility',
    method: 'WeaknessPointChange',
    qualifiedName:
      'Lens.Gameplay.Modules.BigWorld.FormulaUtility$$WeaknessPointChange',
    address: 25732784,
    rva: '0x188A6B0',
    signature:
      'bool FormulaUtility.WeaknessPointChange(DamageElement* damageElement, EntityHandle* executor, EntityHandle* attacker, int32 outputType1, int32 outputType2, MyFloat weaknessSkillDmgUp, MyFloat* outputDamage, MyFloat* wk)',
  },
  {
    chains: ['hpDamage'],
    className: 'FormulaUtility',
    method: 'innerCalculate',
    qualifiedName:
      'Lens.Gameplay.Modules.BigWorld.FormulaUtility$$innerCalculate',
    address: 25735808,
    rva: '0x188B280',
    signature:
      'MyFloat FormulaUtility.innerCalculate(FormulaItem[]* items, IElement* element, List<int>* functionParams, AliveData* self, AliveData* target, AliveData* source)',
  },
];
const RUNTIME_NATIVE_STRING_LITERALS = [
  { value: 'SPSystem', address: '0xC30B400' },
  { value: 'GetOutputDamage', address: '0xC3E68F8' },
  { value: 'GetOutputWeaknessDamage', address: '0xC3E7F18' },
  { value: 'RecoverSP', address: '0xC444938' },
  { value: 'WeakBreak', address: '0xC489B48' },
  { value: 'WeaknessPointChange', address: '0xC48AA08' },
  { value: 'SkillDmgUp', address: '0xC4ACC48' },
];
const RUNTIME_FIELD_LAYOUT_EVIDENCE = [
  {
    className: 'RecoverSPArgs',
    fields: [
      'id',
      'baseDelta',
      'delta',
      'interval',
      'tagType',
      'skillId',
      'sharePercent',
      'petSharePercent',
      'petDelta',
      'isAddition',
      'additionId',
      'mainPetSharePercent',
    ],
    source: AZPR_IL2CPP_HEADER_PATH,
    sourceLineRange: 'il2cpp.h:235723-235760',
  },
  {
    className: 'FormulaUtility.OutputDamageData',
    fields: ['outputDamage', 'realDamage', 'isCritical', 'isShield'],
    source: AZPR_IL2CPP_HEADER_PATH,
    sourceLineRange: 'il2cpp.h:248082-248105',
  },
  {
    className: 'DamageElement',
    fields: [
      'm_recoverSP',
      'm_petRecoverSP',
      'm_recoverInterval',
      'criticalRandom',
      '_outputDamageData_k__BackingField',
    ],
    source: AZPR_IL2CPP_HEADER_PATH,
    sourceLineRange: 'il2cpp.h:248107-248145',
  },
  {
    className: 'SPSystem',
    fields: ['m_entityHandle', 'm_updateTimer', 'm_recoverTimerMap'],
    source: AZPR_IL2CPP_HEADER_PATH,
    sourceLineRange: 'il2cpp.h:265444-265485',
  },
  {
    className: 'WeakBreakSystem',
    fields: [
      'm_entityHandle',
      'm_attackerHandle',
      'm_lastDamageTime',
      'm_weakTime',
      'm_curWeakTime',
      'm_hasWeakPoint',
      'm_weakState',
      'm_weakElement',
    ],
    source: AZPR_IL2CPP_HEADER_PATH,
    sourceLineRange: 'il2cpp.h:265821-265877',
  },
];
const RUNTIME_NATIVE_DISASSEMBLY_EVIDENCE = {
  status: 'native-disassembly-snippets-extracted-formula-semantics-unconfirmed',
  sourceKind: 'azpr-il2cpp-native-disassembly-evidence',
  tool: 'dumpbin /disasm:nobytes /range',
  toolPath: AZPR_NATIVE_DISASSEMBLY_TOOL,
  primaryBinary: {
    path: AZPR_TC_GAME_ASSEMBLY_PATH,
    status: 'matched-to-current-extractor-metadata',
    length: 222485544,
    lastWriteTime: '2026-06-10T07:30:25+08:00',
    imageBase: '0x180000000',
    metadataPath: AZPR_TC_GLOBAL_METADATA_PATH,
    metadataLength: 39907788,
    extractorMetadataPath:
      'C:/Codex/AzPr Extractor/AzurPromilia_Data/il2cpp_data/Metadata/global-metadata.dat',
    extractorMetadataLength: 39907788,
  },
  alternateBinaries: [
    {
      path: AZPR_JP_GAME_ASSEMBLY_PATH,
      status: 'available-but-not-primary-for-current-tc-dump',
      length: 224586752,
      metadataLength: 40532016,
    },
  ],
  managedDecompilerAudit: {
    tool: 'ilspycmd 10.1.0.8386',
    target: AZPR_IL2CPP_DUMMY_DLL_PATH,
    status: 'dummy-assembly-decompiles-to-address-attributes-and-empty-stubs',
    finding:
      'DummyDll exposes [Address] attributes and default-return method stubs, not executable C# bodies.',
  },
  functionCount: 9,
  targetFunctions: [
    {
      chains: ['hpDamage'],
      className: 'FormulaUtility',
      method: 'GetOutputDamage',
      rva: '0x187F360',
      va: '0x18187F360',
      disassemblyRange: '0x18187F360-0x18187F820',
      observations: [
        'Native body exists in TC GameAssembly and starts with a full non-empty prologue.',
        'References GetOutputDamage string literal through VA 0x181C3E68F8.',
        'Resolves executor/source/element handles before the main formula path; downstream call targets are still unmapped.',
      ],
      confirmed: [
        'native-method-body-present',
        'string-literal-cross-reference-present',
      ],
      unresolved: [
        'function-param-evaluation-order-unconfirmed',
        'enemy-defense-resistance-critical-order-unconfirmed',
      ],
    },
    {
      chains: ['toughnessDamage'],
      className: 'FormulaUtility',
      method: 'GetOutputWeaknessDamage',
      rva: '0x1885FF0',
      va: '0x181885FF0',
      disassemblyRange: '0x181885FF0-0x181886150',
      observations: [
        'Native body exists and references GetOutputWeaknessDamage string literal through VA 0x181C3E7F18.',
        'Copies returned OutputDamageData-sized data back to the caller buffer after an indirect method path.',
      ],
      confirmed: [
        'native-method-body-present',
        'weakness-output-entrypoint-present',
      ],
      unresolved: [
        'weak-break-damage-rate-unit-scale-unconfirmed',
        'weakness-output-to-target-state-link-unconfirmed',
      ],
    },
    {
      chains: ['hpDamage', 'toughnessDamage'],
      className: 'FormulaUtility',
      method: 'WeaknessPointChange',
      rva: '0x188A6B0',
      va: '0x18188A6B0',
      disassemblyRange: '0x18188A6B0-0x18188A850',
      observations: [
        'Native body exists and references WeaknessPointChange string literal through VA 0x181C48AA08.',
        'Initializes an output MyFloat-like stack value before resolving executor and attacker handles.',
      ],
      confirmed: [
        'native-method-body-present',
        'hp-and-toughness-shared-helper-present',
      ],
      unresolved: [
        'outputDamage-and-wk-mutation-semantics-unconfirmed',
        'weakness-skill-dmg-up-scale-unconfirmed',
      ],
    },
    {
      chains: ['selfEnergyChange'],
      className: 'DamageElement',
      method: 'Parse',
      rva: '0x138E5E0',
      va: '0x18138E5E0',
      disassemblyRange: '0x18138E5E0-0x18138EEE0',
      observations: [
        'Copies TDamageElementParams+0x12C into DamageElement+0x240, matching m_recoverSP.',
        'Copies TDamageElementParams+0x130 into DamageElement+0x244, matching m_petRecoverSP.',
        'Copies TDamageElementParams+0x134 into DamageElement+0x248, matching m_recoverInterval.',
        'Copies additional TDamageElementParams fields into DamageElement runtime fields before execution.',
      ],
      confirmed: [
        'recover-sp-fields-copied-during-damage-element-parse',
        'damage-element-runtime-field-materialization-confirmed',
      ],
      unresolved: [
        'related-skill-level-override-application-point-unconfirmed',
        'hit-index-binding-still-unconfirmed',
      ],
    },
    {
      chains: ['selfEnergyChange'],
      className: 'DamageElement',
      method: 'RecoverSP',
      rva: '0x138EEE0',
      va: '0x18138EEE0',
      disassemblyRange: '0x18138EEE0-0x18138F609',
      observations: [
        'Native body checks DamageElement+0x240 and returns early when m_recoverSP <= 0.',
        'References RecoverSP string literal through VA 0x181C444938.',
        'Creates or reuses a RecoverSPArgs object before writing source fields into RecoverSPArgs offsets.',
        'Writes DamageElement.m_recoverSP / 10000 into RecoverSPArgs.baseDelta, then derives RecoverSPArgs.delta from baseDelta * (1 + SPGETUP + SPGETUP_ATK).',
        'Writes DamageElement.m_petRecoverSP / 10000 through the same modifier path into RecoverSPArgs.petDelta.',
        'Writes DamageElement.m_recoverInterval / 1000 into RecoverSPArgs.interval and writes tagType = 0 before transmitting type 0x12F.',
      ],
      confirmed: [
        'recover-sp-field-gates-energy-recovery-path',
        'recover-sp-source-to-base-delta-confirmed',
        'recover-sp-base-delta-divisor-10000-confirmed',
        'recover-sp-source-to-delta-modifier-path-confirmed',
        'recover-sp-delta-modifier-base-1-confirmed',
        'recover-sp-delta-modifier-properties-spgetup-spgetup-atk-confirmed',
        'pet-recover-sp-source-to-pet-delta-confirmed',
        'recover-interval-source-to-args-interval-confirmed',
        'recover-interval-divisor-1000-confirmed',
        'recover-sp-args-transmit-type-0x12f-confirmed',
        'native-method-body-present',
      ],
      unresolved: [
        'delta-runtime-modifier-property-values-unapplied',
        'recover-interval-runtime-throttle-semantics-unconfirmed',
        'damage-element-target-owner-selection-unconfirmed',
      ],
    },
    {
      chains: ['selfEnergyChange'],
      className: 'RecoverSPArgs',
      method: 'OnReset',
      rva: '0x1254070',
      va: '0x181254070',
      disassemblyRange: '0x181254070-0x181254105',
      observations: [
        'Clears RecoverSPArgs fields from id through mainPetSharePercent before object reuse.',
        'Confirms pooled or reset RecoverSPArgs instances start from zero/default values before DamageElement.RecoverSP populates fields.',
      ],
      confirmed: [
        'recover-sp-args-reset-fields-confirmed',
        'recover-sp-args-reuse-default-state-confirmed',
      ],
      unresolved: ['recover-sp-args-pool-allocation-call-target-unconfirmed'],
    },
    {
      chains: ['selfEnergyChange'],
      className: 'SPSystem',
      method: 'OnTransmit',
      rva: '0x14837F0',
      va: '0x1814837F0',
      disassemblyRange: '0x1814837F0-0x181483F40',
      observations: [
        'Branches on transmit type 0x12F before casting args to RecoverSPArgs.',
        'Uses RecoverSPArgs.id and interval for a recover timer throttle before direct recovery when isAddition is false.',
        'Calls SPSystem.RecoverSP with tagType from +0x28, baseDelta from +0x1C and delta from +0x20.',
        'Uses sharePercent, petSharePercent, petDelta and mainPetSharePercent to mutate baseDelta/delta before rebroadcasting type 0x12F to related entities.',
      ],
      confirmed: [
        'recover-sp-transmit-type-0x12f-branch-confirmed',
        'recover-sp-args-call-fields-confirmed',
        'recover-sp-interval-throttle-fields-confirmed',
        'recover-sp-share-rebroadcast-fields-confirmed',
      ],
      unresolved: [
        'recover-tag-type-enum-semantics-unconfirmed',
        'share-target-filter-semantics-unconfirmed',
        'recover-interval-timebase-unconfirmed',
      ],
    },
    {
      chains: ['selfEnergyChange'],
      className: 'SPSystem',
      method: 'RecoverSP',
      rva: '0x1483F40',
      va: '0x181483F40',
      disassemblyRange: '0x181483F40-0x181484120',
      observations: [
        'Preserves recoverTagType from edx and baseDelta/delta from xmm2/xmm3.',
        'Reads current entity resource state, adds delta to an existing float-like value, and compares against a cap-like value.',
      ],
      confirmed: [
        'sp-system-recover-sp-native-body-present',
        'delta-parameter-participates-in-resource-update-path',
      ],
      unresolved: [
        'baseDelta-vs-delta-final-role-unconfirmed',
        'resource-cap-and-rounding-rule-unconfirmed',
      ],
    },
    {
      chains: ['toughnessDamage'],
      className: 'WeakBreakSystem',
      method: 'OnTransmit',
      rva: '0x14C05A0',
      va: '0x1814C05A0',
      disassemblyRange: '0x1814C05A0-0x1814C0780',
      observations: [
        'Native body gates on enabled byte at WeakBreakSystem+0x38.',
        'Branches on transmit type values 0x64, 0x6F, 0x12B and 0x10C before resolving args.',
        'References WeakBreak string literal through VA 0x181C489B48.',
      ],
      confirmed: [
        'weak-break-system-ontransmit-native-body-present',
        'weak-break-system-transmit-type-branching-present',
      ],
      unresolved: [
        'which-transmit-type-corresponds-to-weakness-damage-unconfirmed',
        'weak-break-state-transition-scale-unconfirmed',
      ],
    },
  ],
  applied: false,
  note: 'Native disassembly proves selected target method bodies are present in the TC client binary and confirms several field-copy/gating facts, but it is not yet a full formula reconstruction.',
};
const SELF_ENERGY_RUNTIME_FIELD_MAP = [
  {
    field: 'recoverSP',
    paramField: 'TDamageElementParams.recoverSP',
    paramOffset: '0x12C',
    runtimeField: 'DamageElement.m_recoverSP',
    runtimeOffset: '0x240',
    confirmedBy: 'DamageElement.Parse@0x138E5E0',
    runtimeUse: 'gate-and-delta-source-candidate',
  },
  {
    field: 'petRecoverSP',
    paramField: 'TDamageElementParams.petRecoverSP',
    paramOffset: '0x130',
    runtimeField: 'DamageElement.m_petRecoverSP',
    runtimeOffset: '0x244',
    confirmedBy: 'DamageElement.Parse@0x138E5E0',
    runtimeUse: 'pet-share-source-candidate',
  },
  {
    field: 'recoverInterval',
    paramField: 'TDamageElementParams.recoverInterval',
    paramOffset: '0x134',
    runtimeField: 'DamageElement.m_recoverInterval',
    runtimeOffset: '0x248',
    confirmedBy: 'DamageElement.Parse@0x138E5E0',
    runtimeUse: 'throttle-interval-candidate',
  },
];
const SELF_ENERGY_RUNTIME_CHAIN_STEPS = [
  {
    step: 'parse-fields',
    method: 'DamageElement.Parse',
    functionKey: 'DamageElement.Parse@0x138E5E0',
    status: 'field-copy-confirmed',
    confirmedFacts: [
      'TDamageElementParams.recoverSP -> DamageElement.m_recoverSP',
      'TDamageElementParams.petRecoverSP -> DamageElement.m_petRecoverSP',
      'TDamageElementParams.recoverInterval -> DamageElement.m_recoverInterval',
    ],
  },
  {
    step: 'recover-gate',
    method: 'DamageElement.RecoverSP',
    functionKey: 'DamageElement.RecoverSP@0x138EEE0',
    status: 'recover-sp-positive-gate-confirmed',
    gateCondition: 'DamageElement.m_recoverSP > 0',
  },
  {
    step: 'resource-update',
    method: 'SPSystem.RecoverSP',
    functionKey: 'SPSystem.RecoverSP@0x1483F40',
    status: 'delta-update-path-confirmed-scale-unconfirmed',
    parameters: ['recoverTagType', 'baseDelta', 'delta'],
  },
];
const SELF_ENERGY_RUNTIME_UNIT_HYPOTHESES = [
  {
    key: 'raw-field',
    divisor: 1,
    status: 'observed-field-value-not-confirmed-final-unit',
  },
  {
    key: 'per-ten-thousand',
    divisor: 10000,
    status: 'common-config-scale-candidate-unconfirmed',
  },
];
const RECOVER_SP_ARGS_FIELD_MAP = [
  {
    field: 'id',
    offset: '0x18',
    type: 'int',
    runtimeUse: 'timer-map-key',
  },
  {
    field: 'baseDelta',
    offset: '0x1C',
    type: 'float',
    runtimeUse: 'sp-system-recover-sp-argument',
  },
  {
    field: 'delta',
    offset: '0x20',
    type: 'float',
    runtimeUse: 'sp-system-recover-sp-argument-and-resource-update',
  },
  {
    field: 'interval',
    offset: '0x24',
    type: 'float',
    runtimeUse: 'recover-timer-throttle',
  },
  {
    field: 'tagType',
    offset: '0x28',
    type: 'TSpElementParams.ERecoverTagType',
    runtimeUse: 'sp-system-recover-sp-argument',
  },
  {
    field: 'skillId',
    offset: '0x2C',
    type: 'int',
    runtimeUse: 'source-skill-id-carrier',
  },
  {
    field: 'sharePercent',
    offset: '0x30',
    type: 'float',
    runtimeUse: 'other-entity-baseDelta-and-delta-share-scale',
  },
  {
    field: 'petSharePercent',
    offset: '0x34',
    type: 'float',
    runtimeUse: 'pet-delta-share-scale',
  },
  {
    field: 'petDelta',
    offset: '0x38',
    type: 'float',
    runtimeUse: 'pet-share-delta-source',
  },
  {
    field: 'isAddition',
    offset: '0x3C',
    type: 'bool',
    runtimeUse: 'direct-recover-path-selector',
  },
  {
    field: 'additionId',
    offset: '0x40',
    type: 'int',
    runtimeUse: 'post-recover-addition-record-carrier',
  },
  {
    field: 'mainPetSharePercent',
    offset: '0x44',
    type: 'float',
    runtimeUse: 'main-pet-delta-share-scale',
  },
];
const SELF_ENERGY_OWNER_SHARE_INTERVAL_RULES = {
  status: 'sp-system-ontransmit-owner-share-interval-path-confirmed',
  sourceFunction: 'SPSystem.OnTransmit@0x14837F0',
  transmitType: {
    value: 303,
    hex: '0x12F',
    status: 'recover-sp-args-transmit-branch-confirmed',
  },
  directRecoverCall: {
    method: 'SPSystem.RecoverSP@0x1483F40',
    recoverTagTypeField: 'tagType@0x28',
    baseDeltaField: 'baseDelta@0x1C',
    deltaField: 'delta@0x20',
    status: 'call-argument-fields-confirmed',
  },
  intervalThrottle: {
    idField: 'id@0x18',
    intervalField: 'interval@0x24',
    timerMapField: 'SPSystem.m_recoverTimerMap@0x20',
    bypassWhen: 'isAddition@0x3C == true',
    status: 'id-and-interval-throttle-fields-confirmed',
  },
  shareRebroadcast: [
    {
      path: 'background-entity-share',
      percentField: 'sharePercent@0x30',
      baseDeltaSource: 'baseDelta@0x1C',
      deltaSource: 'delta@0x20',
      transmitType: '0x12F',
      status: 'baseDelta-and-delta-scaled-before-rebroadcast',
    },
    {
      path: 'pet-share',
      percentField: 'petSharePercent@0x34',
      deltaSource: 'petDelta@0x38',
      transmitType: '0x12F',
      status: 'pet-delta-scaled-before-rebroadcast',
    },
    {
      path: 'main-pet-share',
      percentField: 'mainPetSharePercent@0x44',
      deltaSource: 'petDelta@0x38',
      transmitType: '0x12F',
      status: 'main-pet-delta-scaled-before-rebroadcast',
    },
  ],
};
const RECOVER_SP_ENUM_EVIDENCE = {
  recoverTagType: [
    {
      name: 'AttackRecoverySp',
      value: 0,
      description: '攻击回能',
    },
    {
      name: 'AutoRecoverySp',
      value: 1,
      description: '自动回能',
    },
    {
      name: 'Other',
      value: 2,
      description: 'other',
    },
  ],
  shareType: [
    {
      name: 'NoShare',
      value: 0,
    },
    {
      name: 'ShareHalf',
      value: 1,
    },
    {
      name: 'ShareAll',
      value: 2,
    },
  ],
};
const SELF_ENERGY_NATIVE_CONSTANT_READ_EVIDENCE = {
  status: 'gameassembly-rdata-float32-values-read',
  sourceFile: 'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll',
  fileSize: 222485544,
  imageBase: '0x180000000',
  constants: [
    {
      key: 'recover-sp-modifier-base',
      va: '0x189956B08',
      rva: '0x9956B08',
      section: '.rdata',
      fileOffset: '0x9954708',
      float32: 1,
      uint32Hex: '0x3F800000',
      usage: 'RecoverSPArgs.delta/petDelta modifier base constant',
      status: 'value-confirmed',
    },
    {
      key: 'recover-interval-divisor',
      va: '0x189956D8C',
      rva: '0x9956D8C',
      section: '.rdata',
      fileOffset: '0x995498C',
      float32: 1000,
      uint32Hex: '0x447A0000',
      usage: 'DamageElement.m_recoverInterval to RecoverSPArgs.interval',
      status: 'value-confirmed',
    },
    {
      key: 'recover-sp-per-ten-thousand-divisor',
      va: '0x189956FB0',
      rva: '0x9956FB0',
      section: '.rdata',
      fileOffset: '0x9954BB0',
      float32: 10000,
      uint32Hex: '0x461C4000',
      usage: 'DamageElement.m_recoverSP/petRecoverSP raw field scale',
      status: 'value-confirmed',
    },
  ],
};
const SELF_ENERGY_SOURCE_TO_ARGS_RULES = {
  status: 'damage-element-recover-sp-source-to-args-partially-confirmed',
  sourceFunction: 'DamageElement.RecoverSP@0x138EEE0',
  argsResetFunction: 'RecoverSPArgs.OnReset@0x1254070',
  transmitType: '0x12F',
  nativeConstantReadEvidence: SELF_ENERGY_NATIVE_CONSTANT_READ_EVIDENCE,
  nativeScaleFacts: [
    {
      sourceField: 'DamageElement.m_recoverSP@0x240',
      argsField: 'RecoverSPArgs.baseDelta@0x1C',
      operation: 'int-to-float-divide-native-constant',
      nativeDivisorAddress: '0x189956FB0',
      nativeDivisorValue: 10000,
      observedConstantRole: 'per-ten-thousand-scale-confirmed',
      status: 'source-to-base-delta-divisor-confirmed',
    },
    {
      sourceField: 'DamageElement.m_recoverSP@0x240',
      argsField: 'RecoverSPArgs.delta@0x20',
      operation: 'baseDelta * (1 + SPGETUP + SPGETUP_ATK)',
      nativeConstantAddress: '0x189956B08',
      nativeConstantValue: 1,
      status: 'source-to-delta-derived-with-runtime-modifiers-confirmed',
    },
    {
      sourceField: 'DamageElement.m_petRecoverSP@0x244',
      argsField: 'RecoverSPArgs.petDelta@0x38',
      operation: 'petRecoverSPScaled * (1 + SPGETUP + SPGETUP_ATK)',
      nativeDivisorAddress: '0x189956FB0',
      nativeDivisorValue: 10000,
      nativeConstantAddress: '0x189956B08',
      nativeConstantValue: 1,
      status: 'source-to-pet-delta-derived-with-runtime-modifiers-confirmed',
    },
    {
      sourceField: 'DamageElement.m_recoverInterval@0x248',
      argsField: 'RecoverSPArgs.interval@0x24',
      operation: 'int-to-float-divide-native-constant',
      nativeDivisorAddress: '0x189956D8C',
      nativeDivisorValue: 1000,
      observedConstantRole: 'interval-timebase-divisor-confirmed',
      status: 'source-to-interval-confirmed-divisor-confirmed',
    },
    {
      sourceField: 'DamageElement.RecoverSP path',
      argsField: 'RecoverSPArgs.tagType@0x28',
      operation: 'write-enum-value-0',
      enumValue: 'AttackRecoverySp',
      status: 'damage-element-recover-sp-tag-type-zero-confirmed',
    },
  ],
  shareFieldFacts: [
    {
      argsField: 'RecoverSPArgs.sharePercent@0x30',
      source: 'BattleConfigData.shareEnergyPercent@0x108',
      status: 'share-energy-percent-source-field-confirmed',
    },
    {
      argsField: 'RecoverSPArgs.petSharePercent@0x34',
      source: 'BattleConfigData.petShareEnergyPercent@0x10C',
      status: 'pet-share-energy-percent-source-field-confirmed',
    },
    {
      argsField: 'RecoverSPArgs.mainPetSharePercent@0x44',
      source: 'constant-1.0',
      status: 'main-pet-share-percent-default-confirmed',
    },
  ],
  enumEvidence: RECOVER_SP_ENUM_EVIDENCE,
  unresolved: [
    'delta-runtime-modifier-values-unapplied',
    'recover-interval-runtime-throttle-semantics-unconfirmed',
    'share-target-filter-unconfirmed',
    'damage-element-target-owner-selection-unconfirmed',
  ],
};
const SELF_ENERGY_RUNTIME_MODIFIER_RULES = {
  status: 'damage-element-recover-sp-runtime-modifiers-partially-confirmed',
  sourceFunction: 'DamageElement.RecoverSP@0x138EEE0',
  deltaFormulaShape: {
    baseDeltaField: 'RecoverSPArgs.baseDelta@0x1C',
    deltaField: 'RecoverSPArgs.delta@0x20',
    petDeltaField: 'RecoverSPArgs.petDelta@0x38',
    expression: 'scaledSource * (1 + SPGETUP + SPGETUP_ATK)',
    nativeConstantAddress: '0x189956B08',
    nativeConstantValue: 1,
    nativeConstantStatus: 'value-confirmed-from-gameassembly-rdata',
    status: 'modifier-base-constant-confirmed-values-runtime-unapplied',
  },
  modifierSources: [
    {
      key: 'spgetup',
      propertyId: 105,
      propertyHex: '0x69',
      propertyName: 'SPGETUP',
      enumSource: 'EBattlePropertyType.SPGETUP',
      description: 'energy-recovery-amplification',
      alivePropertyFunction:
        'AliveProperty.GetBattlePropertyCurrentValue@0x12A7EE0',
      snapshotPropertyFunction:
        'SnapshotPropertyManager.GetBattlePropertyCurrentValue@0x181D240',
      conversionFunction: 'MyFloat.op_Implicit(float)@0x11B2AE0',
      isRatio: true,
      tags: null,
      status: 'property-source-confirmed-value-runtime-unapplied',
    },
    {
      key: 'spgetup-atk',
      propertyId: 228,
      propertyHex: '0xE4',
      propertyName: 'SPGETUP_ATK',
      enumSource: 'EBattlePropertyType.SPGETUP_ATK',
      description: 'attack-energy-recovery-amplification',
      alivePropertyFunction:
        'AliveProperty.GetBattlePropertyCurrentValue@0x12A7EE0',
      snapshotPropertyFunction:
        'SnapshotPropertyManager.GetBattlePropertyCurrentValue@0x181D240',
      conversionFunction: 'MyFloat.op_Implicit(float)@0x11B2AE0',
      isRatio: true,
      tags: null,
      status: 'property-source-confirmed-value-runtime-unapplied',
    },
  ],
  intervalScale: {
    sourceField: 'DamageElement.m_recoverInterval@0x248',
    argsField: 'RecoverSPArgs.interval@0x24',
    operation: 'int-to-float-divide-native-constant',
    nativeDivisorAddress: '0x189956D8C',
    nativeDivisorValue: 1000,
    status: 'divisor-value-confirmed-time-unit-unapplied',
  },
  shareConfigSources: [
    {
      argsField: 'RecoverSPArgs.sharePercent@0x30',
      sourceFunction: 'BattleConfigManager.get_Data@0x16E5BA0',
      sourceField: 'BattleConfigData.shareEnergyPercent@0x108',
      status: 'source-field-confirmed',
    },
    {
      argsField: 'RecoverSPArgs.petSharePercent@0x34',
      sourceFunction: 'BattleConfigManager.get_Data@0x16E5BA0',
      sourceField: 'BattleConfigData.petShareEnergyPercent@0x10C',
      status: 'source-field-confirmed',
    },
    {
      argsField: 'RecoverSPArgs.mainPetSharePercent@0x44',
      source: 'constant-1.0',
      status: 'constant-default-confirmed',
    },
  ],
  nativeConstantReadEvidence: SELF_ENERGY_NATIVE_CONSTANT_READ_EVIDENCE,
  unresolved: [
    'runtime-property-values-unapplied',
    'owner-and-share-target-filter-unconfirmed',
    'final-sp-curve-unconfirmed',
  ],
};
const SELF_ENERGY_RUNTIME_SAMPLE_SCHEMA = {
  status: 'runtime-sample-schema-ready-awaiting-capture',
  version: 1,
  sourceKind: 'azpr-self-energy-runtime-sample-schema',
  hookPoints: [
    {
      key: 'damage-element-recover-sp-args-built',
      functionKey: 'DamageElement.RecoverSP@0x138EEE0',
      captureWhen:
        'after RecoverSPArgs fields are written and before transmit type 0x12F',
      requiredFields: [
        'frameIndex',
        'timeMs',
        'sourceElementConfigId',
        'pathId',
        'recoverSP',
        'petRecoverSP',
        'recoverInterval',
        'spgetup',
        'spgetupAtk',
        'args.id',
        'args.baseDelta',
        'args.delta',
        'args.interval',
        'args.tagType',
        'args.skillId',
        'args.sharePercent',
        'args.petSharePercent',
        'args.petDelta',
        'args.mainPetSharePercent',
      ],
    },
    {
      key: 'alive-property-recover-sp-modifiers',
      functionKey: 'AliveProperty.GetBattlePropertyCurrentValue@0x12A7EE0',
      captureWhen: 'when id is 105 or 228 and isRatio is true',
      requiredFields: [
        'frameIndex',
        'ownerEntityId',
        'propertyId',
        'propertyName',
        'isRatio',
        'myFloatRaw',
        'floatValue',
      ],
    },
    {
      key: 'snapshot-property-recover-sp-modifiers',
      functionKey:
        'SnapshotPropertyManager.GetBattlePropertyCurrentValue@0x181D240',
      captureWhen:
        'when id is 105 or 228 and DamageElement uses attacker snapshot',
      requiredFields: [
        'frameIndex',
        'attackerEntityId',
        'propertyId',
        'propertyName',
        'isRatio',
        'myFloatRaw',
        'floatValue',
      ],
    },
    {
      key: 'sp-system-ontransmit-12f',
      functionKey: 'SPSystem.OnTransmit@0x14837F0',
      captureWhen:
        'on transmit type 0x12F before and after throttle/share logic',
      requiredFields: [
        'frameIndex',
        'receiverEntityId',
        'args.id',
        'args.interval',
        'timerMapHit',
        'timerPreviousTime',
        'timerNextTime',
        'directRecoverCalled',
        'shareRebroadcastTargets',
        'petShareTargets',
        'mainPetShareTargets',
      ],
    },
    {
      key: 'sp-system-recover-sp-applied',
      functionKey: 'SPSystem.RecoverSP@0x1483F40',
      captureWhen:
        'before and after SPSystem applies recoverTagType/baseDelta/delta',
      requiredFields: [
        'frameIndex',
        'roleEntityId',
        'recoverTagType',
        'baseDelta',
        'delta',
        'spBefore',
        'spAfter',
        'spDeltaApplied',
      ],
    },
  ],
  offlineImportShape: {
    rootFields: [
      'schemaVersion',
      'captureSessionId',
      'clientRegion',
      'clientBuild',
      'source',
      'events',
    ],
    eventCorrelationKeys: [
      'captureSessionId',
      'frameIndex',
      'sourceElementConfigId',
      'args.id',
      'roleEntityId',
    ],
    eventTypes: [
      'recover-sp-args-built',
      'recover-sp-modifier-property-read',
      'recover-sp-ontransmit-12f',
      'recover-sp-applied',
      'recover-sp-share-rebroadcast',
    ],
  },
  validationChecks: [
    {
      key: 'base-delta-scale',
      expression: 'args.baseDelta == recoverSP / 10000',
      status: 'static-divisor-confirmed-runtime-sample-required',
    },
    {
      key: 'pet-delta-scale-and-modifier',
      expression:
        'args.petDelta == petRecoverSP / 10000 * (1 + SPGETUP + SPGETUP_ATK)',
      status: 'static-formula-confirmed-runtime-sample-required',
    },
    {
      key: 'delta-scale-and-modifier',
      expression:
        'args.delta == recoverSP / 10000 * (1 + SPGETUP + SPGETUP_ATK)',
      status: 'static-formula-confirmed-runtime-sample-required',
    },
    {
      key: 'interval-scale',
      expression: 'args.interval == recoverInterval / 1000',
      status: 'static-divisor-confirmed-runtime-sample-required',
    },
    {
      key: 'final-sp-curve',
      expression:
        'spAfter - spBefore == applied delta after owner/share/throttle rules',
      status: 'runtime-sample-required',
    },
  ],
  unresolved: [
    'runtime-hook-not-connected',
    'offline-runtime-samples-not-imported',
    'spgetup-spgetup-atk-runtime-values-unconfirmed',
    'owner-share-target-filter-unconfirmed',
    'final-sp-curve-unconfirmed',
  ],
};

function createRecoverSpRuntimeSampleContext(capturesInput = []) {
  const captures = normalizeRecoverSpRuntimeSampleCaptures(capturesInput);
  const events = captures.flatMap(capture => capture.events);

  return {
    status:
      events.length > 0
        ? 'offline-runtime-samples-imported'
        : 'runtime-samples-not-imported',
    captureCount: captures.length,
    eventCount: events.length,
    importedRuntimeSampleCount: events.length,
    eventTypes: uniqueStrings(events.map(event => event.eventType)),
    captures: captures.map(capture => ({
      captureSessionId: capture.captureSessionId,
      schemaVersion: capture.schemaVersion,
      clientRegion: capture.clientRegion,
      clientBuild: capture.clientBuild,
      source: capture.source,
      eventCount: capture.events.length,
      eventTypes: uniqueStrings(capture.events.map(event => event.eventType)),
    })),
    events,
    applied: false,
  };
}

function normalizeRecoverSpRuntimeSampleCaptures(capturesInput = []) {
  return arrayOrSingle(capturesInput)
    .map((capture, captureIndex) =>
      normalizeRecoverSpRuntimeSampleCapture(capture, captureIndex)
    )
    .filter(Boolean);
}

function normalizeRecoverSpRuntimeSampleCapture(capture, captureIndex) {
  if (!capture || typeof capture !== 'object') {
    return null;
  }

  const captureSessionId =
    capture.captureSessionId ??
    capture.sessionId ??
    `runtime-sample-capture-${captureIndex + 1}`;
  const rawEvents = Array.isArray(capture.events) ? capture.events : [];

  return {
    schemaVersion: numberOrNull(capture.schemaVersion) ?? 1,
    captureSessionId,
    clientRegion: capture.clientRegion ?? null,
    clientBuild: capture.clientBuild ?? null,
    source: capture.source ?? capture.captureSource ?? null,
    events: rawEvents
      .map((event, eventIndex) =>
        normalizeRecoverSpRuntimeSampleEvent({
          event,
          eventIndex,
          captureSessionId,
        })
      )
      .filter(Boolean),
  };
}

function normalizeRecoverSpRuntimeSampleEvent({
  event,
  eventIndex,
  captureSessionId,
}) {
  if (!event || typeof event !== 'object') {
    return null;
  }
  const eventType = event.eventType ?? event.type;
  if (!eventType) {
    return null;
  }

  return {
    ...event,
    eventType,
    captureSessionId: event.captureSessionId ?? captureSessionId,
    eventIndex,
    frameIndex: numberOrNull(event.frameIndex),
    timeMs: numberOrNull(event.timeMs),
    actionId: event.actionId ?? null,
    actorId: event.actorId ?? null,
    targetId: event.targetId ?? null,
    targetEntityId: event.targetEntityId ?? null,
    sourceElementConfigId: numberOrNull(event.sourceElementConfigId),
    elementConfigId: numberOrNull(
      event.elementConfigId ?? event.sourceElementConfigId
    ),
    pathId: event.pathId == null ? null : String(event.pathId),
    roleEntityId: event.roleEntityId ?? event.receiverEntityId ?? null,
    ownerEntityId: event.ownerEntityId ?? event.attackerEntityId ?? null,
    receiverEntityId: event.receiverEntityId ?? null,
    propertyId: numberOrNull(event.propertyId),
    propertyName: event.propertyName ?? null,
    floatValue: numberOrNull(event.floatValue),
    args: normalizeRecoverSpRuntimeSampleArgs(event.args),
    recoverSP: numberOrNull(event.recoverSP),
    petRecoverSP: numberOrNull(event.petRecoverSP),
    recoverInterval: numberOrNull(event.recoverInterval),
    spgetup: numberOrNull(event.spgetup),
    spgetupAtk: numberOrNull(event.spgetupAtk),
    timerMapHit:
      typeof event.timerMapHit === 'boolean' ? event.timerMapHit : null,
    directRecoverCalled:
      typeof event.directRecoverCalled === 'boolean'
        ? event.directRecoverCalled
        : null,
    spBefore: numberOrNull(event.spBefore),
    spAfter: numberOrNull(event.spAfter),
    spDeltaApplied: numberOrNull(event.spDeltaApplied),
    toughnessBefore: numberOrNull(event.toughnessBefore),
    toughnessAfter: numberOrNull(event.toughnessAfter),
    toughnessDeltaApplied: numberOrNull(event.toughnessDeltaApplied),
    recoverTagType: numberOrNull(event.recoverTagType),
    baseDelta: numberOrNull(event.baseDelta),
    delta: numberOrNull(event.delta),
  };
}

function normalizeRecoverSpRuntimeSampleArgs(args = {}) {
  if (!args || typeof args !== 'object') {
    return {};
  }

  return {
    ...args,
    id: args.id ?? null,
    baseDelta: numberOrNull(args.baseDelta),
    delta: numberOrNull(args.delta),
    interval: numberOrNull(args.interval),
    tagType: numberOrNull(args.tagType),
    skillId: numberOrNull(args.skillId),
    sharePercent: numberOrNull(args.sharePercent),
    petSharePercent: numberOrNull(args.petSharePercent),
    petDelta: numberOrNull(args.petDelta),
    mainPetSharePercent: numberOrNull(args.mainPetSharePercent),
  };
}

export function projectSimulationResult({
  scenario,
  eventLog,
  damageEvents,
  resourceEvents,
  kiboResourceEvents = [],
  verifiedCombatRuntime = null,
  verifiedBattleEffectGeneration = null,
  verifiedTuningMarkGeneration = null,
  verifiedActionVariantRuntime = null,
  effectTimeline,
  actionRuleDiagnostics,
  actionExecutionPlan,
  controlledActorTimeline,
  actionEffectRelationGraph,
  threeValueMechanicsAdapterRegistry = null,
}) {
  const runtimeSampleContext = createRecoverSpRuntimeSampleContext(
    scenario.runtimeSampleCaptures
  );
  const actionResultTimeline = buildActionResultTimeline({
    scenario,
    damageEvents,
    resourceEvents,
    runtimeSampleContext,
    actionExecutionPlan,
    verifiedCombatRuntime,
  });
  const candidateValueSeries = buildCandidateValueSeries(
    actionResultTimeline,
    scenario.time.durationMs
  );
  const threeValueCurveFramework = buildThreeValueCurveFramework({
    scenario,
    actionResultTimeline,
    candidateValueSeries,
    runtimeSampleContext,
  });
  const threeValueGenerationBundle = createThreeValueGenerationBundle({
    scenario,
    actionResultTimeline,
    candidateValueSeries,
    runtimeSampleContext,
    actionExecutionPlan,
  });
  const threeValueGenerationLayer =
    threeValueGenerationBundle.threeValueGenerationLayer;
  const generationOutputs = threeValueGenerationBundle.generationOutputs;
  const threeValueRuntimeProjection = createThreeValueRuntimeProjection({
    scenario,
    generationOutputs,
    threeValueMechanicsAdapterRegistry,
    effectTimeline,
    actionExecutionPlan,
    controlledActorTimeline,
    actionEffectRelationGraph,
    verifiedCombatRuntime,
  });
  const runtimeOutputs = attachVerifiedSpecialResourceCurves(
    threeValueRuntimeProjection.runtimeOutputs,
    verifiedActionVariantRuntime?.curves ?? []
  );
  const tuningMarkCurveProjection = projectVerifiedTuningMarkCurves({
    tuningMarkRuntime: verifiedCombatRuntime?.tuningMarkRuntime,
    durationMs: scenario.time.durationMs,
  });
  const damageTimeline = damageEvents.map(event => ({
    eventType: event.type,
    stateEventKind: event.payload.stateEventKind ?? null,
    timeMs: event.timeMs,
    actionId: event.actionId,
    actorId: event.actorId,
    targetId: event.targetId,
    attack: event.payload.attack,
    attackSource: event.payload.attackSource,
    rawDamage: event.payload.rawDamage,
    formulaVersion: event.payload.formulaVersion,
    formulaBreakdown: event.payload.formulaBreakdown,
    hitKey: event.hitKey ?? event.payload.hitKey ?? null,
    hitIndex: event.hitIndex ?? event.payload.hitIndex ?? null,
    hitSkillId: event.hitSkillId ?? null,
    elementId: event.payload.elementId ?? null,
    toughnessDamage: event.payload.toughnessDamage ?? 0,
    segmentLabel: event.payload.segment?.label ?? null,
    multiplier: event.payload.segment?.multiplier ?? null,
    segment: event.payload.segment ?? null,
    confidence: event.payload.confidence,
    precision: event.payload.precision,
    timingAccuracy: event.payload.timingAccuracy,
  }));

  const resourceTimeline = resourceEvents.map(event => ({
    runtimeSequenceIndex: event.runtimeSequenceIndex ?? null,
    timeMs: event.timeMs,
    actionId: event.actionId,
    actorId: event.actorId,
    resource: event.payload.resource,
    change: event.payload.change,
    beforeValue: event.payload.beforeValue ?? null,
    afterValue: event.payload.afterValue ?? null,
    maxValue: event.payload.maxValue ?? null,
    reason: event.payload.reason,
    confidence: event.payload.confidence,
    hitKey: event.hitKey ?? null,
    hitIndex: event.hitIndex ?? null,
    hitSkillId: event.hitSkillId ?? null,
    elementId: event.payload.elementId ?? null,
  }));

  const kiboResourceTimeline = kiboResourceEvents.map(event => ({
    runtimeSequenceIndex: event.runtimeSequenceIndex ?? null,
    timeMs: event.timeMs,
    actionId: event.actionId,
    actorId: event.actorId,
    slotId: event.payload.slotId,
    kiboId: event.payload.kiboId,
    resource: event.payload.resource,
    change: event.payload.change,
    beforeValue: event.payload.beforeValue ?? null,
    afterValue: event.payload.afterValue ?? null,
    currentValue: event.payload.currentValue,
    maxValue: event.payload.maxValue,
    reason: event.payload.reason,
    confidence: event.payload.confidence,
    hitKey: event.hitKey ?? null,
    hitIndex: event.hitIndex ?? null,
    hitSkillId: event.hitSkillId ?? null,
    elementId: event.payload.elementId ?? null,
  }));

  const runtimeOutputSummary = runtimeOutputs.summary ?? {};
  const runtimeOutputResourceCurves =
    runtimeOutputs.resourceCurves ?? runtimeOutputs.resources ?? {};
  const totalRawDamage = runtimeOutputSummary.enemyHpDelta;
  const totalProjectedToughnessDamage =
    runtimeOutputSummary.enemyToughnessDelta;
  const totalSelfEnergyDelta = runtimeOutputSummary.selfEnergyDelta;
  const selfEnergyDeltaByActor = createSelfEnergyDeltaSummaryByActor(
    runtimeOutputResourceCurves.curvesByActor ?? []
  );
  const formulaCandidatePatternSummary =
    summarizeFormulaCandidatePatterns(actionResultTimeline);
  const formulaExecutionMatrixSummary = summarizeFormulaExecutionMatrices(
    actionResultTimeline,
    formulaCandidatePatternSummary,
    runtimeSampleContext
  );
  const timingMissingActionIds = scenario.diagnostics.missingTimingActionIds;

  return {
    schemaVersion: 1,
    scenario: {
      projectId: scenario.sourceProject.id,
      projectName: scenario.sourceProject.name,
      durationMs: scenario.time.durationMs,
      actorCount: scenario.actors.length,
      actionCount: scenario.actions.length,
      executedActionCount: actionExecutionPlan.summary.executedActionCount,
      skippedActionCount: actionExecutionPlan.summary.skippedActionCount,
      enemyId: scenario.enemy.id,
      enemyName: scenario.enemy.name,
      enemyLevel: scenario.enemy.level,
      enemyHpMultiplier: scenario.enemy.hpMultiplier,
      enemyDefenseMultiplier: scenario.enemy.defenseMultiplier,
    },
    eventLog,
    actionResultTimeline,
    candidateValueSeries,
    threeValueCurveFramework,
    threeValueGenerationBundle,
    threeValueGenerationLayer,
    generationOutputs,
    threeValueRuntimeProjection,
    runtimeOutputs,
    damageTimeline,
    resourceTimeline,
    kiboResourceTimeline,
    verifiedCombatRuntime,
    verifiedBattleEffectGeneration,
    verifiedTuningMarkGeneration,
    verifiedActionVariantRuntime,
    tuningMarkCurveProjection,
    effectTimeline: runtimeOutputs.effectTimeline,
    controlledActorTimeline: runtimeOutputs.controlledActorTimeline,
    actionEffectRelationGraph: runtimeOutputs.actionEffectRelationGraph,
    actionRuleDiagnostics,
    actionReadinessTimeline: actionRuleDiagnostics.readinessTimeline,
    actionExecutionPlan,
    summary: {
      totalRawDamage,
      totalProjectedToughnessDamage,
      totalSelfEnergyDelta,
      selfEnergyDeltaByActor,
      projectedHitCount: damageTimeline.filter(event => !event.stateEventKind)
        .length,
      resourceEventCount: resourceTimeline.length,
      actionResultCount: actionResultTimeline.length,
      actionCount: scenario.actions.length,
      executedActionCount: actionExecutionPlan.summary.executedActionCount,
      skippedActionCount: actionExecutionPlan.summary.skippedActionCount,
      unresolvedExecutedActionCount:
        actionExecutionPlan.summary.unresolvedExecutedActionCount,
      candidateValueSeriesSummary: candidateValueSeries.summary,
      threeValueCurveFrameworkSummary: threeValueCurveFramework.summary,
      threeValueGenerationBundleSummary: threeValueGenerationBundle.summary,
      threeValueGenerationLayerSummary: threeValueGenerationLayer.summary,
      threeValueGenerationOutputsSummary: generationOutputs.outputSummary,
      threeValueRuntimeProjectionSummary: runtimeOutputs.summary,
      runtimeOutputsSummary: runtimeOutputs.outputSummary,
      effectRuntimeTimelineSummary: runtimeOutputs.effectTimeline.summary,
      controlledActorTimelineSummary:
        runtimeOutputs.controlledActorTimeline.summary,
      actionRuleDiagnosticsSummary: actionRuleDiagnostics.summary,
      actionReadinessTimelineSummary:
        actionRuleDiagnostics.readinessTimeline.summary,
      actionExecutionPlanSummary: actionExecutionPlan.summary,
      formulaVersion: damageEvents[0]?.payload.formulaVersion ?? null,
      formulaCandidatePatternSummary,
      formulaExecutionMatrixSummary,
      confidence: damageTimeline.some(entry => entry.confidence === 'low')
        ? 'low'
        : 'medium',
      timingMissingActionCount: timingMissingActionIds.length,
      timingMissingActionIds,
    },
    diagnostics: {
      validationWarnings: scenario.diagnostics.validationWarnings,
      actionRules: actionRuleDiagnostics,
      limitations: [
        'Raw damage projection only; final AzPr formula is not implemented yet.',
        'Every action result tracks HP damage, toughness damage, and self energy delta; toughness and charge formulas remain unmapped until skill/effect nodes are parsed.',
        'Detailed per-skill frame timing is a later evidence layer; the three-value curve framework can run on candidate, placeholder, or imported runtime sample points first.',
        'Formula breakdown exposes unapplied layers before they are confirmed.',
        'Skill timing is placeholder when timingMissingActionCount is greater than 0.',
        'Effect runtime tracks ownership, duration, refresh, stacking, and expiry, but effect modifiers do not change three-value calculators until an AzPr effect adapter is configured.',
        'Confirmed rule-blocked actions are excluded from action results, effect commands, generation deltas, and runtime outputs; unresolved conditions remain executable.',
      ],
    },
  };
}

function attachVerifiedSpecialResourceCurves(runtimeOutputs, curves) {
  if (!Array.isArray(curves) || curves.length === 0) return runtimeOutputs;
  const stateCurves = runtimeOutputs?.stateCurves ?? {};
  const resourceCurves =
    runtimeOutputs?.resourceCurves ?? runtimeOutputs?.resources ?? {};
  const resources = stateCurves.resources ?? resourceCurves;
  const projectedResourceCurves = {
    ...resourceCurves,
    curvesBySpecialResource: curves,
  };
  const projectedStateResources = {
    ...resources,
    curvesBySpecialResource: curves,
  };
  return {
    ...runtimeOutputs,
    stateCurves: {
      ...stateCurves,
      resources: projectedStateResources,
    },
    resourceCurves: projectedResourceCurves,
    resources: projectedResourceCurves,
  };
}

function buildThreeValueCurveFramework({
  scenario,
  actionResultTimeline,
  candidateValueSeries,
  runtimeSampleContext,
}) {
  const candidateSeriesByKey = new Map(
    (candidateValueSeries.series ?? []).map(series => [series.key, series])
  );
  const chartSeriesByKey = new Map(
    (candidateValueSeries.chart?.series ?? []).map(series => [
      series.key,
      series,
    ])
  );
  const tracks = THREE_VALUE_CURVE_TRACK_DEFINITIONS.map(definition =>
    createThreeValueCurveTrack({
      definition,
      scenario,
      actionResultTimeline,
      candidateSeries: candidateSeriesByKey.get(definition.candidateSeriesKey),
      chartSeries: chartSeriesByKey.get(definition.candidateSeriesKey),
    })
  );
  const candidateTrackCount = tracks.filter(
    track => track.candidatePointCount > 0
  ).length;
  const candidatePointCount = tracks.reduce(
    (sum, track) => sum + track.candidatePointCount,
    0
  );
  const chartPointCount = tracks.reduce(
    (sum, track) => sum + track.chartPointCount,
    0
  );
  const stateCurves = buildThreeValueStateCurves({
    scenario,
    actionResultTimeline,
    tracks,
    candidateValueSeries,
    runtimeSampleContext,
  });

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-three-value-curve-framework',
    status: 'three-value-curve-framework-ready-details-deferred',
    developmentFocus: 'framework-first-before-frame-perfecting',
    frameRate: AZPR_TIMELINE_FRAME_RATE,
    frameMs: roundTimelineMs(AZPR_TIMELINE_FRAME_MS),
    timebase: {
      granularity: 'one-frame',
      frameRate: AZPR_TIMELINE_FRAME_RATE,
      frameMs: roundTimelineMs(AZPR_TIMELINE_FRAME_MS),
      frameIndexBase: 0,
    },
    computationContract: {
      inputLayers: [
        'confirmed-action-result-values',
        'candidate-hit-values',
        'runtime-sample-captures',
        'placeholder-values',
      ],
      curvePointPolicy:
        'points may be candidate or sampled; unapplied candidates never change final totals',
      unresolvedTimingPolicy:
        'keep candidate/source/display frames separate until concrete skill frames are confirmed',
      valueApplicationPolicy:
        'only explicit applied result slots affect totals; candidate curves stay applied=false',
    },
    tracks,
    stateCurves,
    summary: {
      trackCount: tracks.length,
      candidateTrackCount,
      candidatePointCount,
      chartPointCount,
      stateCurvePointCount: stateCurves.summary.pointCount,
      appliedStatePointCount: stateCurves.summary.appliedPointCount,
      candidateStatePointCount: stateCurves.summary.candidatePointCount,
      sampledStatePointCount: stateCurves.summary.sampledPointCount,
      placeholderStatePointCount: stateCurves.summary.placeholderPointCount,
      actionResultCount: actionResultTimeline.length,
      actionCount: scenario.actions.length,
      actorCount: scenario.actors.length,
      detailsDeferred: true,
      applied: false,
    },
    applied: false,
  };
}

function compareNullableTimelineNumber(left, right) {
  const leftNumber = numberOrNull(left);
  const rightNumber = numberOrNull(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }
  if (Number.isFinite(leftNumber)) {
    return -1;
  }
  if (Number.isFinite(rightNumber)) {
    return 1;
  }
  return 0;
}

function createThreeValueCurveTrack({
  definition,
  scenario,
  actionResultTimeline,
  candidateSeries,
  chartSeries,
}) {
  const resultValues = actionResultTimeline
    .map(entry => numberOrNull(entry[definition.resultField]?.value))
    .filter(Number.isFinite);
  const projectedValue = resultValues.reduce((sum, value) => sum + value, 0);

  return {
    key: definition.key,
    label: definition.label,
    resultField: definition.resultField,
    candidateSeriesKey: definition.candidateSeriesKey,
    ownerScope: definition.ownerScope,
    valueUnit: definition.valueUnit,
    status:
      candidateSeries?.pointCount > 0
        ? 'track-ready-with-candidate-points'
        : resultValues.length > 0
          ? 'track-ready-with-action-results'
          : 'track-ready-waiting-for-values',
    resultStatus: definition.resultStatus,
    formulaStatus: definition.formulaStatus,
    resultSlotCount: resultValues.length,
    projectedValue,
    projectedValueByActor:
      definition.ownerScope === 'actor'
        ? summarizeProjectedValueByActor({
            scenario,
            actionResultTimeline,
            resultField: definition.resultField,
          })
        : [],
    candidatePointCount: candidateSeries?.pointCount ?? 0,
    chartPointCount: chartSeries?.pointCount ?? 0,
    chartFrameMin: numberOrNull(chartSeries?.frameMin),
    chartFrameMax: numberOrNull(chartSeries?.frameMax),
    timeOrderStatus: chartSeries?.timeOrderStatus ?? 'no-candidate-points',
    applied: false,
  };
}

function buildThreeValueStateCurves({
  scenario,
  actionResultTimeline,
  tracks,
  candidateValueSeries,
  runtimeSampleContext,
}) {
  const chartSeriesByKey = new Map(
    (candidateValueSeries.chart?.series ?? []).map(series => [
      series.key,
      series,
    ])
  );
  const curveTracks = tracks.map(track =>
    createThreeValueStateCurveTrack({
      track,
      scenario,
      actionResultTimeline,
      chartSeries: chartSeriesByKey.get(track.candidateSeriesKey),
      runtimeSampleContext,
    })
  );
  const layerSummaries = curveTracks.flatMap(track =>
    track.layers.map(layer => ({
      trackKey: track.trackKey,
      layerKey: layer.key,
      pointCount: layer.pointCount,
      finalCumulative: layer.finalCumulative,
      status: layer.status,
    }))
  );
  const summary = summarizeThreeValueStateCurves(curveTracks);

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-three-value-delta-cumulative-state-curves',
    status:
      summary.pointCount > 0
        ? 'state-curves-built-with-delta-cumulative-layers'
        : 'state-curves-ready-waiting-for-points',
    frameRate: AZPR_TIMELINE_FRAME_RATE,
    frameMs: roundTimelineMs(AZPR_TIMELINE_FRAME_MS),
    layerKeys: ['applied', 'candidate', 'sampled', 'placeholder'],
    curvePolicy: {
      deltaMeaning:
        'per-point value change in the layer-specific unit and confidence',
      cumulativeMeaning:
        'running sum inside the same track/layer; candidate cumulative is diagnostic only',
      layerIsolation:
        'applied, candidate, sampled and placeholder layers are never mixed when accumulating',
      replacementPolicy:
        'later confirmed formulas or runtime samples can replace candidate/placeholder layers without changing track keys',
    },
    summary,
    layerSummaries,
    tracks: curveTracks,
    applied: false,
  };
}

function createThreeValueStateCurveTrack({
  track,
  scenario,
  actionResultTimeline,
  chartSeries,
  runtimeSampleContext,
}) {
  const appliedLayer = createAppliedStateCurveLayer(
    track,
    actionResultTimeline
  );
  const candidateLayer = createCandidateStateCurveLayer(track, chartSeries);
  const sampledLayer = createSampledStateCurveLayer({
    track,
    scenario,
    runtimeSampleContext,
  });
  const placeholderLayer = createPlaceholderStateCurveLayer({
    track,
    actionResultTimeline,
    occupiedActionIds: new Set([
      ...appliedLayer.points.map(point => point.actionId).filter(Boolean),
      ...candidateLayer.points.map(point => point.actionId).filter(Boolean),
      ...sampledLayer.points.map(point => point.actionId).filter(Boolean),
    ]),
  });
  const layers = [appliedLayer, candidateLayer, sampledLayer, placeholderLayer];
  const pointCount = layers.reduce((sum, layer) => sum + layer.pointCount, 0);

  return {
    trackKey: track.key,
    label: track.label,
    ownerScope: track.ownerScope,
    valueUnit: track.valueUnit,
    status:
      pointCount > 0
        ? 'state-curve-track-ready'
        : 'state-curve-track-waiting-for-points',
    pointCount,
    layers,
    applied: false,
  };
}

function createAppliedStateCurveLayer(track, actionResultTimeline) {
  const points = actionResultTimeline
    .map((entry, index) => {
      const result = entry[track.resultField];
      const delta = numberOrNull(result?.value);
      if (!result?.applied || !Number.isFinite(delta)) {
        return null;
      }

      const timeMs = numberOrNull(entry.timeMs) ?? 0;
      const frameIndex = msToTimelineFrame(timeMs);
      return {
        sourceKind: 'action-result-applied-value',
        actionId: entry.actionId,
        actionName: entry.actionName,
        actionType: entry.actionType,
        actorId: entry.actorId,
        actorName: entry.actorName,
        targetId: entry.targetId,
        targetName: entry.targetName,
        skillId: numberOrNull(entry.skillId),
        sequenceIndex: index,
        timeMs: roundTimelineMs(timeMs),
        frameIndex,
        frameLabel: formatTimelineFrame(frameIndex),
        delta,
        elementConfigIds: createAppliedStateCurveElementConfigIds(result),
        resultStatus: result.status ?? null,
        sourceStatus: result.sourceEvidence?.status ?? null,
        confidence: result.confidence ?? null,
        precision: result.precision ?? null,
        applied: true,
      };
    })
    .filter(Boolean);

  return createStateCurveLayer({
    key: 'applied',
    label: '已应用结果',
    sourceKind: 'action-result-applied-values',
    statusWhenEmpty: 'no-applied-result-points',
    valueUnit: track.valueUnit,
    points,
    applied: true,
  });
}

function createAppliedStateCurveElementConfigIds(result) {
  const sourceEvidence = result?.sourceEvidence;
  return uniqueNumbers([
    ...(sourceEvidence?.matchedElementConfigIds ?? []),
    ...(sourceEvidence?.logicElementIds ?? []),
    ...(sourceEvidence?.candidates ?? []).map(candidate =>
      numberOrNull(candidate.elementConfigId)
    ),
  ]);
}

function createCandidateStateCurveLayer(track, chartSeries) {
  const points = (chartSeries?.points ?? [])
    .map((point, index) => {
      const delta = numberOrNull(point.value);
      if (!Number.isFinite(delta)) {
        return null;
      }

      const frameIndex =
        numberOrNull(point.displayFrameIndex) ??
        msToTimelineFrame(point.displayTimeMs ?? point.sourceTimeMs ?? 0);
      const timeMs =
        numberOrNull(point.displayTimeMs) ??
        roundTimelineMs(frameIndex * AZPR_TIMELINE_FRAME_MS);

      return {
        sourceKind: 'candidate-chart-point',
        actionId: point.actionId,
        actionName: point.actionName,
        actorId: point.actorId ?? null,
        actorName: point.actorName ?? null,
        skillId: point.skillId,
        hitSkillId: point.hitSkillId,
        hitIndex: point.hitIndex,
        sequenceIndex: point.sequenceIndex ?? index,
        timeMs: roundTimelineMs(timeMs),
        frameIndex,
        frameLabel: formatTimelineFrame(frameIndex),
        sourceFrameIndex: numberOrNull(point.sourceFrameIndex),
        displayFrameIndex: numberOrNull(point.displayFrameIndex),
        localFrameIndex: numberOrNull(point.localFrameIndex),
        chainStartFrame: numberOrNull(point.chainStartFrame),
        delta,
        valueSamples: point.valueSamples ?? [],
        candidateCount: point.candidateCount ?? null,
        elementConfigIds: point.elementConfigIds ?? [],
        sourceStatus: point.sourceStatus ?? null,
        triggerTimingStatus: point.triggerTimingStatus ?? null,
        timeAdjustmentStatus: point.timeAdjustmentStatus ?? null,
        applied: false,
      };
    })
    .filter(Boolean);

  return createStateCurveLayer({
    key: 'candidate',
    label: '候选值',
    sourceKind: 'candidate-value-chart-points',
    statusWhenEmpty: 'no-candidate-points',
    valueUnit: chartSeries?.unit ?? track.valueUnit,
    points,
    applied: false,
  });
}

function createSampledStateCurveLayer({
  track,
  scenario,
  runtimeSampleContext,
}) {
  const runtimeSampleCount =
    runtimeSampleContext?.captureCount ??
    scenario.runtimeSampleCaptures?.length ??
    0;
  const points = createSampledStateCurvePoints({
    track,
    runtimeSampleContext,
  });
  return createStateCurveLayer({
    key: 'sampled',
    label: '真实采样',
    sourceKind: 'runtime-sample-captures',
    statusWhenEmpty:
      runtimeSampleCount > 0
        ? 'runtime-samples-present-mapping-pending'
        : 'runtime-samples-not-imported',
    valueUnit: track.valueUnit,
    points,
    applied: false,
    extra: {
      runtimeSampleCount,
      importedRuntimeSampleCount:
        runtimeSampleContext?.importedRuntimeSampleCount ?? 0,
      mappingStatus:
        points.length > 0
          ? 'runtime-samples-mapped-to-state-curve'
          : runtimeSampleCount > 0
            ? 'sample-to-curve-mapping-pending'
            : 'waiting-for-runtime-samples',
    },
  });
}

function createSampledStateCurvePoints({ track, runtimeSampleContext }) {
  if (track.key !== 'selfEnergyChange') {
    return [];
  }

  return (runtimeSampleContext?.events ?? [])
    .filter(event => event.eventType === 'recover-sp-applied')
    .map((event, index) => {
      const delta =
        numberOrNull(event.spDeltaApplied) ??
        numberOrNull(event.delta) ??
        numberOrNull(event.args?.delta);
      if (!Number.isFinite(delta)) {
        return null;
      }
      const frameIndex =
        numberOrNull(event.frameIndex) ?? msToTimelineFrame(event.timeMs ?? 0);
      const timeMs =
        numberOrNull(event.timeMs) ??
        roundTimelineMs(frameIndex * AZPR_TIMELINE_FRAME_MS);

      return {
        sourceKind: 'runtime-recover-sp-applied-sample',
        captureSessionId: event.captureSessionId ?? null,
        eventIndex: numberOrNull(event.eventIndex) ?? index,
        eventType: event.eventType,
        actionId: event.actionId,
        actorId: event.actorId,
        roleEntityId: event.roleEntityId,
        ownerEntityId: event.ownerEntityId,
        receiverEntityId: event.receiverEntityId,
        sourceElementConfigId: numberOrNull(event.sourceElementConfigId),
        elementConfigId: numberOrNull(event.elementConfigId),
        pathId: event.pathId ?? null,
        timeMs: roundTimelineMs(timeMs),
        frameIndex,
        frameLabel: formatTimelineFrame(frameIndex),
        delta,
        spBefore: numberOrNull(event.spBefore),
        spAfter: numberOrNull(event.spAfter),
        baseDelta: numberOrNull(event.baseDelta ?? event.args?.baseDelta),
        argsDelta: numberOrNull(event.args?.delta),
        recoverTagType: numberOrNull(event.recoverTagType),
        applied: false,
      };
    })
    .filter(Boolean);
}

function createPlaceholderStateCurveLayer({
  track,
  actionResultTimeline,
  occupiedActionIds,
}) {
  const points = actionResultTimeline
    .filter(entry => !occupiedActionIds.has(entry.actionId))
    .map((entry, index) => {
      const timeMs = numberOrNull(entry.timeMs) ?? 0;
      const frameIndex = msToTimelineFrame(timeMs);
      return {
        sourceKind: 'action-result-placeholder',
        actionId: entry.actionId,
        actionName: entry.actionName,
        actorId: entry.actorId,
        actorName: entry.actorName,
        sequenceIndex: index,
        timeMs: roundTimelineMs(timeMs),
        frameIndex,
        frameLabel: formatTimelineFrame(frameIndex),
        delta: 0,
        resultStatus: entry[track.resultField]?.status ?? null,
        applied: false,
      };
    });

  return createStateCurveLayer({
    key: 'placeholder',
    label: '占位',
    sourceKind: 'action-result-placeholders',
    statusWhenEmpty: 'no-placeholder-points-needed',
    valueUnit: track.valueUnit,
    points,
    applied: false,
  });
}

function createStateCurveLayer({
  key,
  label,
  sourceKind,
  statusWhenEmpty,
  valueUnit,
  points,
  applied,
  extra = {},
}) {
  const integratedPoints = integrateStateCurvePoints(points);
  const cumulativeValues = integratedPoints.map(point => point.cumulative);

  return {
    key,
    label,
    sourceKind,
    status:
      integratedPoints.length > 0
        ? 'delta-cumulative-points-built'
        : statusWhenEmpty,
    valueUnit,
    pointCount: integratedPoints.length,
    frameMin: minNumber(integratedPoints.map(point => point.frameIndex)),
    frameMax: maxNumber(integratedPoints.map(point => point.frameIndex)),
    deltaMin: minNumber(integratedPoints.map(point => point.delta)),
    deltaMax: maxNumber(integratedPoints.map(point => point.delta)),
    cumulativeMin: minNumber(cumulativeValues),
    cumulativeMax: maxNumber(cumulativeValues),
    finalCumulative:
      integratedPoints.length > 0
        ? integratedPoints[integratedPoints.length - 1].cumulative
        : 0,
    points: integratedPoints,
    ...extra,
    applied,
  };
}

function integrateStateCurvePoints(points) {
  let cumulative = 0;
  return [...points].sort(compareStateCurvePoints).map((point, index) => {
    const delta = numberOrNull(point.delta) ?? 0;
    cumulative = roundCurveValue(cumulative + delta);
    return {
      ...point,
      sequenceIndex: point.sequenceIndex ?? index,
      delta,
      cumulative,
    };
  });
}

function compareStateCurvePoints(a, b) {
  const frameA = numberOrNull(a.frameIndex) ?? 0;
  const frameB = numberOrNull(b.frameIndex) ?? 0;
  if (frameA !== frameB) {
    return frameA - frameB;
  }
  const sequenceA = numberOrNull(a.sequenceIndex) ?? 0;
  const sequenceB = numberOrNull(b.sequenceIndex) ?? 0;
  return sequenceA - sequenceB;
}

function summarizeThreeValueStateCurves(tracks) {
  const layers = tracks.flatMap(track => track.layers);
  const pointCount = layers.reduce((sum, layer) => sum + layer.pointCount, 0);
  const countLayerPoints = key =>
    layers
      .filter(layer => layer.key === key)
      .reduce((sum, layer) => sum + layer.pointCount, 0);

  return {
    trackCount: tracks.length,
    layerCount: layers.length,
    pointCount,
    appliedPointCount: countLayerPoints('applied'),
    candidatePointCount: countLayerPoints('candidate'),
    sampledPointCount: countLayerPoints('sampled'),
    placeholderPointCount: countLayerPoints('placeholder'),
    cumulativeLayerCount: layers.filter(layer => layer.pointCount > 0).length,
    applied: false,
  };
}

function summarizeProjectedValueByActor({
  scenario,
  actionResultTimeline,
  resultField,
}) {
  const summaries = new Map(
    scenario.actors.map(actor => [
      actor.id,
      {
        actorId: actor.id,
        actorName: actor.name,
        value: 0,
      },
    ])
  );

  for (const entry of actionResultTimeline) {
    if (!entry.actorId) {
      continue;
    }
    if (!summaries.has(entry.actorId)) {
      summaries.set(entry.actorId, {
        actorId: entry.actorId,
        actorName: entry.actorName,
        value: 0,
      });
    }
    summaries.get(entry.actorId).value +=
      numberOrNull(entry[resultField]?.value) ?? 0;
  }

  return [...summaries.values()];
}

function summarizeSelfEnergyByActor(scenario, actionResultTimeline) {
  const summaries = new Map(
    scenario.actors.map(actor => [
      actor.id,
      {
        actorId: actor.id,
        actorName: actor.name,
        resource: 'sp',
        delta: 0,
      },
    ])
  );

  for (const entry of actionResultTimeline) {
    if (!entry.actorId) {
      continue;
    }
    if (!summaries.has(entry.actorId)) {
      summaries.set(entry.actorId, {
        actorId: entry.actorId,
        actorName: entry.actorName,
        resource: entry.selfEnergyChange.resource,
        delta: 0,
      });
    }
    const summary = summaries.get(entry.actorId);
    summary.delta += entry.selfEnergyChange.value;
    summary.resource = entry.selfEnergyChange.resource ?? summary.resource;
  }

  return [...summaries.values()];
}

function buildCandidateValueSeries(actionResultTimeline, durationMs) {
  const hitCandidates = actionResultTimeline.flatMap(entry =>
    (entry.hitCandidates ?? []).map((hitCandidate, index) => ({
      ...hitCandidate,
      sequenceIndex: index,
    }))
  );
  const series = [
    createCandidateSeries({
      key: 'hpDamageFormulaParamCandidate',
      label: 'HP参数候选',
      valueKind: 'TDamageElementParams.formulaParamValues',
      unit: 'raw-param',
      hitCandidates,
      getValues: createHpCandidateSeriesValues,
    }),
    createCandidateSeries({
      key: 'toughnessDamageCandidate',
      label: '削韧候选',
      valueKind: 'TDamageElementParams.weakBreakDamageRate',
      unit: 'raw-field',
      hitCandidates,
      getValues: hitCandidate =>
        hitCandidate.toughnessDamage?.weakBreakDamageRates ?? [],
    }),
    createCandidateSeries({
      key: 'selfEnergyCandidate',
      label: '能量候选',
      valueKind: 'TDamageElementParams.recoverSP',
      unit: 'raw-field',
      hitCandidates,
      getValues: hitCandidate =>
        hitCandidate.selfEnergyChange?.recoverSPValues ?? [],
    }),
  ];
  const activeSeries = series.filter(item => item.pointCount > 0);
  const pointCount = activeSeries.reduce(
    (sum, item) => sum + item.pointCount,
    0
  );
  const chart = buildCandidateValueChart(activeSeries, durationMs);

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-action-result-candidate-value-series',
    status:
      pointCount > 0
        ? 'candidate-value-series-found-unapplied'
        : 'candidate-value-series-missing',
    frameRate: AZPR_TIMELINE_FRAME_RATE,
    summary: {
      seriesCount: activeSeries.length,
      pointCount,
      hitCandidateCount: hitCandidates.length,
      actionCount: new Set(hitCandidates.map(item => item.actionId)).size,
      chartPointCount: chart.summary.pointCount,
      displayFrameAdjustmentCount: chart.summary.displayFrameAdjustmentCount,
      timeOrderStatus: chart.summary.timeOrderStatus,
      applied: false,
    },
    series,
    chart,
    applied: false,
  };
}

function buildCandidateValueChart(series, durationMs) {
  const normalizedDurationMs = Math.max(0, numberOrNull(durationMs) ?? 0);
  const chartSeries = series
    .map(item => createCandidateChartSeries(item, normalizedDurationMs))
    .filter(item => item.pointCount > 0);
  const pointCount = chartSeries.reduce(
    (sum, item) => sum + item.pointCount,
    0
  );
  const displayFrameAdjustmentCount = chartSeries.reduce(
    (sum, item) => sum + item.displayFrameAdjustmentCount,
    0
  );

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-candidate-value-series-chart',
    status:
      pointCount > 0
        ? 'candidate-chart-found-unapplied'
        : 'candidate-chart-missing',
    durationMs: normalizedDurationMs,
    frameRate: AZPR_TIMELINE_FRAME_RATE,
    frameMs: roundTimelineMs(AZPR_TIMELINE_FRAME_MS),
    frameCount: Math.max(
      1,
      Math.round(normalizedDurationMs / AZPR_TIMELINE_FRAME_MS)
    ),
    summary: {
      seriesCount: chartSeries.length,
      pointCount,
      displayFrameAdjustmentCount,
      timeOrderStatus:
        displayFrameAdjustmentCount > 0
          ? 'source-times-non-monotonic-display-adjusted'
          : pointCount > 0
            ? 'source-times-monotonic'
            : 'no-candidate-points',
      applied: false,
    },
    series: chartSeries,
    applied: false,
  };
}

function createCandidateChartSeries(series, durationMs) {
  let previousDisplayFrameIndex = -1;
  let displayFrameAdjustmentCount = 0;
  const points = (series.points ?? [])
    .map((point, index) => {
      const chartPoint = createCandidateChartPoint({
        point,
        index,
        series,
        durationMs,
        previousDisplayFrameIndex,
      });
      if (!chartPoint) {
        return null;
      }
      previousDisplayFrameIndex = chartPoint.displayFrameIndex;
      if (chartPoint.displayFrameIndex !== chartPoint.sourceFrameIndex) {
        displayFrameAdjustmentCount += 1;
      }
      return chartPoint;
    })
    .filter(Boolean);

  return {
    key: series.key,
    label: series.label,
    valueKind: series.valueKind,
    unit: series.unit,
    status:
      points.length > 0
        ? 'candidate-chart-points-found-unapplied'
        : 'candidate-chart-points-missing',
    pointCount: points.length,
    valueMin: series.valueMin,
    valueMax: series.valueMax,
    valueRange: series.valueRange,
    frameMin: minNumber(points.map(point => point.displayFrameIndex)),
    frameMax: maxNumber(points.map(point => point.displayFrameIndex)),
    displayFrameAdjustmentCount,
    timeOrderStatus:
      displayFrameAdjustmentCount > 0
        ? 'source-times-non-monotonic-display-adjusted'
        : points.length > 0
          ? 'source-times-monotonic'
          : 'no-candidate-points',
    polylinePoints: points
      .map(point => `${point.xPercent},${point.yPercent}`)
      .join(' '),
    points,
    applied: false,
  };
}

function createCandidateChartPoint({
  point,
  index,
  series,
  durationMs,
  previousDisplayFrameIndex,
}) {
  const sourceTimeMs = numberOrNull(point.timeMs);
  if (!Number.isFinite(sourceTimeMs)) {
    return null;
  }

  const sourceFrameIndex = Math.max(
    0,
    Math.round(sourceTimeMs / AZPR_TIMELINE_FRAME_MS)
  );
  const displayFrameIndex = Math.max(
    sourceFrameIndex,
    previousDisplayFrameIndex + 1
  );
  const displayTimeMs = roundTimelineMs(
    displayFrameIndex * AZPR_TIMELINE_FRAME_MS
  );
  const value = Number(point.value);
  const valueMin = numberOrNull(series.valueMin) ?? value;
  const valueMax = numberOrNull(series.valueMax) ?? valueMin;
  const valueRange = Math.max(1, valueMax - valueMin);
  const yPercent =
    valueMax === valueMin
      ? 50
      : roundChartPercent(100 - ((value - valueMin) / valueRange) * 100);

  return {
    actionId: point.actionId,
    actionName: point.actionName,
    actionVariantLabel: point.actionVariantLabel,
    skillId: point.skillId,
    hitSkillId: point.hitSkillId,
    hitIndex: point.hitIndex,
    sequenceIndex: point.sequenceIndex ?? index,
    localFrameIndex: numberOrNull(point.primaryFrame),
    chainStartFrame: numberOrNull(point.chainStartFrame),
    absoluteFrameIndex: numberOrNull(point.absolutePrimaryFrame),
    sequenceTimingStatus: point.sequenceTimingStatus ?? null,
    sequenceTimingSourceStatus: point.sequenceTimingSourceStatus ?? null,
    sourceFrameIndex,
    sourceTimeMs: roundTimelineMs(sourceTimeMs),
    displayFrameIndex,
    displayFrameLabel: formatTimelineFrame(displayFrameIndex),
    displayTimeMs,
    timeAdjustmentStatus:
      displayFrameIndex !== sourceFrameIndex
        ? 'sequence-display-frame-adjusted'
        : point.sequenceTimingStatus === 'absolute-hit-frame-candidate-found'
          ? 'event-bridge-absolute-time-kept'
          : 'source-time-kept',
    xPercent: roundChartPercent(
      durationMs > 0 ? (displayTimeMs / durationMs) * 100 : 0
    ),
    yPercent,
    value: point.value,
    valueMin: point.valueMin,
    valueMax: point.valueMax,
    valueSamples: point.valueSamples ?? [],
    candidateCount: point.candidateCount,
    elementConfigIds: point.elementConfigIds ?? [],
    elementDetails: point.elementDetails ?? [],
    summonTargetEvidenceSummary: point.summonTargetEvidenceSummary ?? null,
    triggerTimingStatus: point.triggerTimingStatus ?? null,
    sourceStatus: point.sourceStatus,
    applied: false,
  };
}

function createCandidateSeries({
  key,
  label,
  valueKind,
  unit,
  hitCandidates,
  getValues,
}) {
  const points = hitCandidates
    .map((hitCandidate, index) =>
      createCandidateSeriesPoint(hitCandidate, index, getValues(hitCandidate))
    )
    .filter(Boolean);
  const values = points.map(point => point.value).filter(Number.isFinite);
  const valueMin = minNumber(values);
  const valueMax = maxNumber(values);

  return {
    key,
    label,
    valueKind,
    unit,
    status:
      points.length > 0
        ? 'candidate-points-found-unapplied'
        : 'candidate-points-missing',
    pointCount: points.length,
    valueMin,
    valueMax,
    valueRange: numberRange(valueMin, valueMax),
    points,
    applied: false,
  };
}

function createCandidateSeriesPoint(hitCandidate, sequenceIndex, rawValues) {
  const valueSamples = uniqueNumbers(rawValues);
  if (valueSamples.length === 0) {
    return null;
  }
  const valueMin = minNumber(valueSamples);
  const valueMax = maxNumber(valueSamples);

  return {
    actionId: hitCandidate.actionId,
    actionName: hitCandidate.actionName,
    actionVariantLabel: hitCandidate.actionVariantLabel,
    skillId: numberOrNull(hitCandidate.skillId),
    hitSkillId: numberOrNull(hitCandidate.hitSkillId),
    hitIndex: numberOrNull(hitCandidate.hitIndex),
    sequenceIndex,
    frameRate: hitCandidate.frameRate ?? AZPR_TIMELINE_FRAME_RATE,
    primaryFrame: numberOrNull(hitCandidate.primaryFrame),
    localCandidateTimeMs: numberOrNull(hitCandidate.localCandidateTimeMs),
    absolutePrimaryFrame: numberOrNull(hitCandidate.absolutePrimaryFrame),
    absoluteCandidateTimeMs: numberOrNull(hitCandidate.absoluteCandidateTimeMs),
    chainStartFrame: numberOrNull(hitCandidate.chainStartFrame),
    sequenceTimingStatus: hitCandidate.sequenceTimingStatus ?? null,
    sequenceTimingSourceStatus: hitCandidate.sequenceTimingSourceStatus ?? null,
    timeMs: numberOrNull(hitCandidate.candidateTimeMs),
    value: valueMax,
    valueMin,
    valueMax,
    valueSamples,
    candidateCount: valueSamples.length,
    elementConfigIds: hitCandidate.damageElementElementConfigIds ?? [],
    elementDetails: createCandidateElementDetails(hitCandidate),
    summonTargetEvidenceSummary:
      hitCandidate.summonTargetEvidenceSummary ?? null,
    triggerTimingStatus:
      hitCandidate.summonTargetEvidenceSummary?.triggerTimingStatus ?? null,
    sourceStatus: hitCandidate.status,
    applied: false,
  };
}

function createHpCandidateSeriesValues(hitCandidate) {
  const rawFormulaParamValues = (hitCandidate.candidates ?? []).flatMap(
    candidate => candidate.hpDamage?.rawFormulaParamValues ?? []
  );
  return rawFormulaParamValues
    .map(numberOrNull)
    .filter(value => Number.isFinite(value) && value > 0 && value !== 10000);
}

function createCandidateElementDetails(hitCandidate) {
  return (hitCandidate.candidates ?? []).map(candidate => ({
    sourceKind: candidate.sourceKind ?? null,
    elementConfigId: numberOrNull(candidate.elementConfigId),
    elementName: candidate.elementName ?? null,
    pathId: candidate.pathId ?? null,
    sourceElementConfigId: numberOrNull(candidate.sourceElementConfigId),
    sourcePathId: candidate.sourcePathId ?? null,
    summonTarget: candidate.summonTarget ?? null,
    hpDamage: candidate.hpDamage
      ? {
          status: candidate.hpDamage.status ?? null,
          rawFormulaParamValues: createHpCandidateSeriesValues({
            candidates: [candidate],
          }),
          formulaFunctionIds: uniqueNumbers(
            Object.values(candidate.hpDamage.formulaFunctionIds ?? {})
              .map(numberOrNull)
              .filter(Number.isFinite)
          ),
          formulaFunctionMatchedIds: uniqueNumbers(
            candidate.hpDamage.formulaFunctionMatchedIds ?? []
          ),
          formulaFunctionRefs: createCandidateFormulaFunctionRefs(
            candidate.hpDamage.formulaFunctionEvidence
          ),
          formulaFunctionEvidence:
            candidate.hpDamage.formulaFunctionEvidence ?? null,
        }
      : null,
    toughnessDamage: candidate.toughnessDamage
      ? {
          status: candidate.toughnessDamage.status ?? null,
          weakBreakDamageRate: numberOrNull(
            candidate.toughnessDamage.weakBreakDamageRate
          ),
          hitType: numberOrNull(candidate.toughnessDamage.hitType),
          interruptPriority: numberOrNull(
            candidate.toughnessDamage.interruptPriority
          ),
          useOneBreak: numberOrNull(candidate.toughnessDamage.useOneBreak),
        }
      : null,
    selfEnergyChange: candidate.selfEnergyChange
      ? {
          status: candidate.selfEnergyChange.status ?? null,
          recoverSP: numberOrNull(candidate.selfEnergyChange.recoverSP),
          petRecoverSP: numberOrNull(candidate.selfEnergyChange.petRecoverSP),
          recoverInterval: numberOrNull(
            candidate.selfEnergyChange.recoverInterval
          ),
          ownerScope: candidate.selfEnergyChange.ownerScope ?? null,
        }
      : null,
    skillLevelBridge: compactCandidateSkillLevelBridge(
      candidate.skillLevelBridge
    ),
    applied: false,
  }));
}

function createCandidateFormulaFunctionRefs(evidence) {
  return (evidence?.functionRefs ?? []).map(ref => ({
    field: ref.field ?? null,
    functionId: numberOrNull(ref.functionId),
    functionOutput: ref.elementFormulaRow?.functionOutput ?? null,
    variables: ref.elementFormulaRow?.variables ?? [],
    variableInputs: (ref.variableInputs ?? []).map(input => ({
      variable: input.variable ?? null,
      paramId: numberOrNull(input.paramId),
      formulaParamSlot: numberOrNull(input.formulaParamSlot),
      formulaParamValue: numberOrNull(input.formulaParamValue),
      slotStatus: input.slotStatus ?? null,
    })),
    applied: ref.applied === true,
  }));
}

function compactCandidateSkillLevelBridge(bridge) {
  if (!bridge) {
    return null;
  }
  return {
    status: bridge.status ?? null,
    source: bridge.source ?? null,
    levelRows: numberOrNull(bridge.levelRows) ?? 0,
    parameterIds: bridge.parameterIds ?? [],
    varyingParameterIds: bridge.varyingParameterIds ?? [],
    formulaSlotAlignment:
      bridge.formulaSlotAlignment ??
      compactFormulaSlotAlignment(bridge.formulaParamAlignment),
    firstLevel: bridge.firstLevel
      ? {
          level: numberOrNull(bridge.firstLevel.level),
          valueParam: bridge.firstLevel.valueParam ?? null,
        }
      : null,
    lastLevel: bridge.lastLevel
      ? {
          level: numberOrNull(bridge.lastLevel.level),
          valueParam: bridge.lastLevel.valueParam ?? null,
        }
      : null,
    relatedElementLevelBridge: compactRelatedElementLevelBridge(
      bridge.relatedElementLevelBridge
    ),
  };
}

function compactRelatedElementLevelBridge(bridge) {
  if (!bridge) {
    return null;
  }

  return {
    status: bridge.status ?? null,
    source: bridge.source ?? null,
    elementConfigId: numberOrNull(bridge.elementConfigId),
    sourceSkillId: numberOrNull(bridge.sourceSkillId),
    derivedSkillId: numberOrNull(bridge.derivedSkillId),
    primarySkillId: numberOrNull(bridge.primarySkillId),
    primaryRelationStatus: bridge.primaryRelationStatus ?? null,
    candidateSkillIds: bridge.candidateSkillIds ?? [],
    candidateCount: numberOrNull(bridge.candidateCount) ?? 0,
    levelRows: numberOrNull(bridge.levelRows) ?? 0,
    parameterIds: bridge.parameterIds ?? [],
    varyingParameterIds: bridge.varyingParameterIds ?? [],
    inheritanceStatus: bridge.inheritanceStatus ?? null,
    formulaSlotAlignment: compactFormulaSlotAlignment(
      bridge.formulaParamAlignment
    ),
    firstLevel: bridge.firstLevel
      ? {
          level: numberOrNull(bridge.firstLevel.level),
          valueParam: bridge.firstLevel.valueParam ?? null,
        }
      : null,
    lastLevel: bridge.lastLevel
      ? {
          level: numberOrNull(bridge.lastLevel.level),
          valueParam: bridge.lastLevel.valueParam ?? null,
        }
      : null,
    candidates: (bridge.candidates ?? []).slice(0, 3).map(candidate => ({
      skillId: numberOrNull(candidate.skillId),
      relationStatus: candidate.relationStatus ?? null,
      derivedFromElementId: candidate.derivedFromElementId === true,
      parentSkillId: numberOrNull(candidate.parentSkillId),
      skillModuleTag: numberOrNull(candidate.skillModuleTag),
      characterSlotRefs: (candidate.characterSlotRefs ?? [])
        .slice(0, 4)
        .map(ref => ({
          characterId: numberOrNull(ref.characterId),
          characterName: ref.characterName ?? null,
          group: ref.group ?? null,
          slot: numberOrNull(ref.slot),
        })),
      skillLevelRowCount: numberOrNull(candidate.skillLevelRowCount) ?? 0,
      skillLevelLevels: candidate.skillLevelLevels ?? [],
      levelRows: numberOrNull(candidate.levelRows) ?? 0,
      parameterIds: candidate.parameterIds ?? [],
      varyingParameterIds: candidate.varyingParameterIds ?? [],
      formulaSlotAlignment: compactFormulaSlotAlignment(
        candidate.formulaParamAlignment
      ),
      firstLevel: candidate.firstLevel
        ? {
            level: numberOrNull(candidate.firstLevel.level),
            valueParam: candidate.firstLevel.valueParam ?? null,
          }
        : null,
      lastLevel: candidate.lastLevel
        ? {
            level: numberOrNull(candidate.lastLevel.level),
            valueParam: candidate.lastLevel.valueParam ?? null,
          }
        : null,
      applied: false,
    })),
    note: bridge.note ?? null,
    applied: false,
  };
}

const PREFERRED_FORMULA_CANDIDATE_STRATEGY =
  'function_2-current-level-value-param';

function summarizeFormulaCandidatePatterns(actionResultTimeline) {
  const baseActionSummaries = actionResultTimeline
    .map(createFormulaCandidatePatternActionSummary)
    .filter(Boolean);

  if (baseActionSummaries.length === 0) {
    return {
      status: 'no-comparable-formula-candidate-patterns',
      actionCount: actionResultTimeline.length,
      comparableActionCount: 0,
      preferredStrategy: PREFERRED_FORMULA_CANDIDATE_STRATEGY,
      strategies: [],
      skillControlBehaviorCorrelations: [],
      actionSummaries: [],
      applied: false,
      note: 'Formula candidate pattern summary is evidence-only until the runtime DamageElement execution chain is confirmed.',
    };
  }

  const skillControlBehaviorCorrelations =
    createSkillControlBehaviorCorrelations(baseActionSummaries);
  const skillControlBehaviorCorrelationBySkillId = new Map(
    skillControlBehaviorCorrelations.map(correlation => [
      Number(correlation.skillId),
      correlation,
    ])
  );
  const actionSummaries = baseActionSummaries.map(summary => ({
    ...summary,
    skillControlBehaviorCorrelation:
      compactSkillControlBehaviorCorrelationForAction(
        skillControlBehaviorCorrelationBySkillId.get(Number(summary.skillId)),
        summary
      ),
  }));

  const requiredScales = finiteValues(
    actionSummaries.map(item => item.requiredScaleToRaw)
  );
  const requiredPerHitScales = finiteValues(
    actionSummaries.map(item => item.requiredPerHitScaleToRaw)
  );
  const actionMultipliers = finiteValues(
    actionSummaries.map(item => item.actionMultiplier)
  );
  const rawProjectionValues = finiteValues(
    actionSummaries.map(item => item.rawProjectionValue)
  );
  const previewRoundedValues = finiteValues(
    actionSummaries.map(item => item.previewRoundedValue)
  );
  const requiredScaleMin = minNumber(requiredScales);
  const requiredScaleMax = maxNumber(requiredScales);
  const actionMultiplierMin = minNumber(actionMultipliers);
  const actionMultiplierMax = maxNumber(actionMultipliers);
  const uniquePreviewRoundedValues = uniqueNumbers(previewRoundedValues);

  return {
    status:
      actionSummaries.length > 1
        ? 'formula-candidate-patterns-found'
        : 'single-formula-candidate-pattern',
    actionCount: actionResultTimeline.length,
    comparableActionCount: actionSummaries.length,
    preferredStrategy: PREFERRED_FORMULA_CANDIDATE_STRATEGY,
    strategies: uniqueStrings(actionSummaries.map(item => item.strategy)),
    requiredScaleMin,
    requiredScaleMax,
    requiredScaleRange: numberRange(requiredScaleMin, requiredScaleMax),
    requiredPerHitScaleMin: minNumber(requiredPerHitScales),
    requiredPerHitScaleMax: maxNumber(requiredPerHitScales),
    actionMultiplierMin,
    actionMultiplierMax,
    actionMultiplierRange: numberRange(
      actionMultiplierMin,
      actionMultiplierMax
    ),
    rawProjectionMin: minNumber(rawProjectionValues),
    rawProjectionMax: maxNumber(rawProjectionValues),
    previewRoundedValueCount: uniquePreviewRoundedValues.length,
    previewRoundedValues: uniquePreviewRoundedValues,
    scaleSpreadStatus: createScaleSpreadStatus(requiredScales),
    previewValueStatus:
      uniquePreviewRoundedValues.length <= 1
        ? 'same-preview-across-actions'
        : 'preview-varies-by-action',
    behaviorCorrelationStatus: inferBehaviorCorrelationStatus(
      skillControlBehaviorCorrelations
    ),
    missingRuntimeScaleStatus: inferMissingRuntimeScaleStatus({
      actionSummaries,
      actionMultiplierMin,
      actionMultiplierMax,
      uniquePreviewRoundedValues,
    }),
    skillControlBehaviorCorrelations,
    actionSummaries,
    applied: false,
    note: 'Formula candidate patterns compare unconfirmed DamageElement previews against current raw HP projection; they are diagnostics only.',
  };
}

function createFormulaCandidatePatternActionSummary(entry) {
  const sourceEvidence = entry.hpDamage?.sourceEvidence;
  const preview = selectComparableFormulaCombinationPreview(
    sourceEvidence?.formulaCandidatePreview?.combinationPreviews ?? []
  );
  const comparison = preview?.comparison;
  if (
    !preview ||
    comparison?.status !== 'compared-to-raw-projection' ||
    !Number.isFinite(numberOrNull(comparison.requiredScaleToRaw))
  ) {
    return null;
  }

  const rawProjection =
    sourceEvidence?.formulaCandidatePreview?.rawProjection ?? {};
  const candidate = (sourceEvidence?.candidates ?? []).find(
    item => Number(item.elementConfigId) === Number(preview.elementConfigId)
  );

  return {
    actionId: entry.actionId,
    actionName: entry.actionName,
    actionType: entry.actionType,
    actorId: entry.actorId,
    actorName: entry.actorName,
    skillId: entry.skillId,
    actionVariantIndex: numberOrNull(sourceEvidence?.actionVariantIndex),
    actionVariantLabel: sourceEvidence?.actionVariantLabel ?? null,
    elementConfigId: numberOrNull(preview.elementConfigId),
    strategy: preview.strategy,
    expression: preview.expression,
    inputSource: preview.inputSource,
    rawProjectionValue: numberOrNull(comparison.rawProjectionValue),
    previewRoundedValue: numberOrNull(comparison.previewRoundedValue),
    ratioToRawProjection: numberOrNull(comparison.ratioToRawProjection),
    requiredScaleToRaw: numberOrNull(comparison.requiredScaleToRaw),
    requiredPerHitScaleToRaw: numberOrNull(comparison.requiredPerHitScaleToRaw),
    actionMultiplier: numberOrNull(rawProjection.actionMultiplier),
    rawMultiplier: rawProjection.rawMultiplier ?? null,
    hitCount: numberOrNull(preview.hitCount),
    damageFields: compactDamageFieldPatternValues(
      candidate?.fieldCandidate?.damageFields
    ),
    status: 'formula-candidate-pattern-comparable',
    applied: false,
  };
}

function selectComparableFormulaCombinationPreview(previews) {
  return (
    previews.find(
      preview =>
        preview.strategy === PREFERRED_FORMULA_CANDIDATE_STRATEGY &&
        preview.comparison?.status === 'compared-to-raw-projection'
    ) ??
    previews.find(
      preview => preview.comparison?.status === 'compared-to-raw-projection'
    ) ??
    null
  );
}

function summarizeFormulaExecutionMatrices(
  actionResultTimeline,
  formulaCandidatePatternSummary = null,
  runtimeSampleContext = null
) {
  const behaviorBindingEvidenceByActionId =
    createFormulaPatternBindingEvidenceByActionId(
      formulaCandidatePatternSummary
    );
  const actionSummaries = actionResultTimeline
    .map(entry =>
      createFormulaExecutionMatrixActionSummary(
        entry,
        behaviorBindingEvidenceByActionId.get(entry.actionId),
        runtimeSampleContext
      )
    )
    .filter(Boolean);
  const rows = actionSummaries.flatMap(summary => summary.rows ?? []);

  if (rows.length === 0) {
    return {
      status: 'no-formula-execution-matrices',
      actionCount: actionResultTimeline.length,
      matrixActionCount: 0,
      rowCount: 0,
      elementCount: 0,
      preferredStrategy: PREFERRED_FORMULA_CANDIDATE_STRATEGY,
      actionSummaries: [],
      elementSummaries: [],
      applied: false,
      note: 'Formula execution matrix summary is evidence-only until DamageElement runtime execution is confirmed.',
    };
  }

  const requiredScales = finiteValues(rows.map(row => row.requiredScaleToRaw));
  const requiredPerHitScales = finiteValues(
    rows.map(row => row.requiredPerHitScaleToRaw)
  );
  const previewRoundedValues = finiteValues(
    rows.map(row => row.previewRoundedValue)
  );
  const rawProjectionValues = finiteValues(
    rows.map(row => row.rawProjectionValue)
  );
  const rowsWithLargeDifference = rows.filter(
    row => row.differenceStatus === 'large-difference'
  ).length;
  const rowsWithSlotOverrideCandidates = rows.filter(
    row => row.slotOverrideCandidateCount > 0
  ).length;
  const rowsWithDirectSlotMatches = rows.filter(
    row => row.directSlotMatchCount > 0
  ).length;
  const rowsWithHitBindings = rows.filter(row => row.boundHitCount > 0).length;
  const elementSummaries = createFormulaExecutionElementSummaries(rows);
  const requiredScaleMin = minNumber(requiredScales);
  const requiredScaleMax = maxNumber(requiredScales);
  const requiredPerHitScaleMin = minNumber(requiredPerHitScales);
  const requiredPerHitScaleMax = maxNumber(requiredPerHitScales);
  const hitBindingGapSummary =
    createFormulaExecutionHitBindingGapSummary(actionSummaries);

  return {
    status:
      actionSummaries.length > 1
        ? 'formula-execution-matrices-found'
        : 'single-formula-execution-matrix',
    actionCount: actionResultTimeline.length,
    matrixActionCount: actionSummaries.length,
    actionVariantCount: uniqueStrings(
      actionSummaries.map(summary => summary.actionVariantLabel)
    ).length,
    actionVariantLabels: uniqueStrings(
      actionSummaries.map(summary => summary.actionVariantLabel)
    ),
    rowCount: rows.length,
    elementCount: elementSummaries.length,
    preferredStrategy: PREFERRED_FORMULA_CANDIDATE_STRATEGY,
    requiredScaleMin,
    requiredScaleMax,
    requiredScaleRange: numberRange(requiredScaleMin, requiredScaleMax),
    requiredPerHitScaleMin,
    requiredPerHitScaleMax,
    requiredPerHitScaleRange: numberRange(
      requiredPerHitScaleMin,
      requiredPerHitScaleMax
    ),
    rawProjectionMin: minNumber(rawProjectionValues),
    rawProjectionMax: maxNumber(rawProjectionValues),
    previewRoundedValueCount: uniqueNumbers(previewRoundedValues).length,
    previewRoundedValues: uniqueNumbers(previewRoundedValues),
    scaleSpreadStatus: createScaleSpreadStatus(requiredScales),
    perHitScaleSpreadStatus: createScaleSpreadStatus(requiredPerHitScales),
    hitBindingCoverageStatus: createFormulaMatrixCoverageStatus({
      matchedCount: rowsWithHitBindings,
      totalCount: rows.length,
      allStatus: 'all-rows-have-hit-bindings',
      partialStatus: 'some-rows-missing-hit-bindings',
      noneStatus: 'no-rows-have-hit-bindings',
    }),
    slotOverrideCoverageStatus: createFormulaMatrixCoverageStatus({
      matchedCount: rowsWithSlotOverrideCandidates,
      totalCount: rows.length,
      allStatus: 'all-rows-have-slot-override-candidates',
      partialStatus: 'some-rows-missing-slot-override-candidates',
      noneStatus: 'no-rows-have-slot-override-candidates',
    }),
    rowsWithLargeDifference,
    rowsWithSlotOverrideCandidates,
    rowsWithDirectSlotMatches,
    rowsWithHitBindings,
    hitBindingGapSummary,
    unresolved: uniqueStrings(rows.flatMap(row => row.unresolved ?? [])),
    diagnostics: {
      functionCombinationOrderStatus: 'unconfirmed',
      levelOverrideApplicationStatus: 'unconfirmed',
      perHitMultiplierAllocationStatus: 'unconfirmed',
      crossActionMatrixStatus:
        actionSummaries.length > 1
          ? 'cross-action-matrix-summary-built'
          : 'needs-more-action-samples',
      scaleSpreadStatus: createScaleSpreadStatus(requiredScales),
      hitBindingCoverageStatus: createFormulaMatrixCoverageStatus({
        matchedCount: rowsWithHitBindings,
        totalCount: rows.length,
        allStatus: 'all-rows-have-hit-bindings',
        partialStatus: 'some-rows-missing-hit-bindings',
        noneStatus: 'no-rows-have-hit-bindings',
      }),
      hitBindingGapStatus: hitBindingGapSummary.status,
    },
    actionSummaries,
    elementSummaries,
    applied: false,
    note: 'Formula execution matrices aggregate unconfirmed per-action DamageElement diagnostics; they do not define final HP/toughness/energy formulas.',
  };
}

function createFormulaExecutionMatrixActionSummary(
  entry,
  behaviorBindingEvidence = null,
  runtimeSampleContext = null
) {
  const matrix = entry.hpDamage?.sourceEvidence?.formulaExecutionEvidenceMatrix;
  if (!matrix || matrix.rowCount <= 0) {
    return null;
  }

  const rawProjection =
    entry.hpDamage?.sourceEvidence?.formulaCandidatePreview?.rawProjection ??
    {};
  const rows = (matrix.rows ?? [])
    .map(row =>
      compactFormulaExecutionMatrixSummaryRow({
        entry,
        matrix,
        rawProjection,
        row,
      })
    )
    .filter(Boolean);
  const requiredScales = finiteValues(rows.map(row => row.requiredScaleToRaw));
  const requiredPerHitScales = finiteValues(
    rows.map(row => row.requiredPerHitScaleToRaw)
  );
  const rowsWithLargeDifference = rows.filter(
    row => row.differenceStatus === 'large-difference'
  ).length;
  const rowsWithHitBindings = rows.filter(row => row.boundHitCount > 0).length;
  const matrixElementConfigIds = uniqueNumbers(
    rows.map(row => row.elementConfigId)
  );
  const hitBindingGap = createFormulaExecutionHitBindingGap({
    actionId: entry.actionId,
    actionName: entry.actionName,
    skillId: entry.skillId,
    actionVariantLabel: matrix.actionVariantLabel,
    rowCount: rows.length,
    rowsWithHitBindings,
    matrixElementConfigIds,
    actionLevelElementSource:
      entry.hpDamage?.sourceEvidence?.actionLevelElementSource ?? null,
    behaviorBindingEvidence,
    runtimeSampleContext,
  });

  return {
    actionId: entry.actionId,
    actionName: entry.actionName,
    actionType: entry.actionType,
    actorId: entry.actorId,
    actorName: entry.actorName,
    skillId: entry.skillId,
    actionVariantIndex: matrix.actionVariantIndex,
    actionVariantLabel: matrix.actionVariantLabel,
    rawMultiplier: rawProjection.rawMultiplier ?? null,
    actionMultiplier: numberOrNull(rawProjection.actionMultiplier),
    rowCount: rows.length,
    elementConfigIds: matrixElementConfigIds,
    requiredScaleMin: minNumber(requiredScales),
    requiredScaleMax: maxNumber(requiredScales),
    requiredPerHitScaleMin: minNumber(requiredPerHitScales),
    requiredPerHitScaleMax: maxNumber(requiredPerHitScales),
    rowsWithLargeDifference,
    rowsWithHitBindings,
    slotOverrideCandidateCount: rows.reduce(
      (sum, row) => sum + row.slotOverrideCandidateCount,
      0
    ),
    directSlotMatchCount: rows.reduce(
      (sum, row) => sum + row.directSlotMatchCount,
      0
    ),
    hitBindingCoverageStatus: createFormulaMatrixCoverageStatus({
      matchedCount: rowsWithHitBindings,
      totalCount: rows.length,
      allStatus: 'all-rows-have-hit-bindings',
      partialStatus: 'some-rows-missing-hit-bindings',
      noneStatus: 'no-rows-have-hit-bindings',
    }),
    hitBindingGap,
    unresolved: uniqueStrings(rows.flatMap(row => row.unresolved ?? [])),
    rows,
    status: 'formula-execution-matrix-action-summary',
    applied: false,
  };
}

function compactFormulaExecutionMatrixSummaryRow({
  entry,
  matrix,
  rawProjection,
  row,
}) {
  const preferred = row.preferredFunctionOrderCandidate;
  if (!preferred) {
    return null;
  }

  const gap = row.perHitScaleGap ?? {};
  const slotOverrideCandidateVariables = uniqueStrings(
    (row.slotOverrideCandidates ?? []).map(slot => slot.variable)
  );
  const directSlotMatchVariables = uniqueStrings(
    (row.directSlotMatches ?? []).map(slot => slot.variable)
  );

  return {
    actionId: entry.actionId,
    actionName: entry.actionName,
    actionVariantIndex: matrix.actionVariantIndex,
    actionVariantLabel: matrix.actionVariantLabel,
    skillId: entry.skillId,
    elementConfigId: row.elementConfigId,
    pathId: row.pathId ?? null,
    hitIndexes: row.hitIndexes ?? [],
    hitBindingStatus: row.hitBindingStatus,
    preferredStrategy: preferred.strategy ?? null,
    expression: preferred.expression ?? null,
    inputSource: preferred.inputSource ?? null,
    rawMultiplier: rawProjection.rawMultiplier ?? null,
    actionMultiplier: numberOrNull(rawProjection.actionMultiplier),
    rawProjectionValue: numberOrNull(gap.rawProjectionValue),
    previewRoundedValue: numberOrNull(gap.previewRoundedValue),
    ratioToRawProjection: numberOrNull(gap.ratioToRawProjection),
    requiredScaleToRaw: numberOrNull(gap.requiredScaleToRaw),
    requiredPerHitScaleToRaw: numberOrNull(gap.requiredPerHitScaleToRaw),
    hitCount: numberOrNull(gap.hitCount),
    boundHitCount: numberOrNull(gap.boundHitCount) ?? 0,
    differenceStatus: gap.differenceStatus ?? null,
    functionOrderCandidateCount: row.functionOrderCandidates?.length ?? 0,
    slotOverrideCandidateCount: row.slotOverrideCandidates?.length ?? 0,
    slotOverrideCandidateVariables,
    directSlotMatchCount: row.directSlotMatches?.length ?? 0,
    directSlotMatchVariables,
    unresolved: row.unresolved ?? [],
    applied: false,
  };
}

function createFormulaExecutionElementSummaries(rows) {
  const byElement = new Map();

  for (const row of rows) {
    if (!byElement.has(row.elementConfigId)) {
      byElement.set(row.elementConfigId, []);
    }
    byElement.get(row.elementConfigId).push(row);
  }

  return [...byElement.entries()]
    .map(([elementConfigId, elementRows]) => {
      const requiredScales = finiteValues(
        elementRows.map(row => row.requiredScaleToRaw)
      );
      const requiredPerHitScales = finiteValues(
        elementRows.map(row => row.requiredPerHitScaleToRaw)
      );
      const rowsWithHitBindings = elementRows.filter(
        row => row.boundHitCount > 0
      ).length;
      const requiredScaleMin = minNumber(requiredScales);
      const requiredScaleMax = maxNumber(requiredScales);
      const requiredPerHitScaleMin = minNumber(requiredPerHitScales);
      const requiredPerHitScaleMax = maxNumber(requiredPerHitScales);

      return {
        elementConfigId,
        actionCount: uniqueStrings(elementRows.map(row => row.actionId)).length,
        actionIds: uniqueStrings(elementRows.map(row => row.actionId)),
        actionVariantLabels: uniqueStrings(
          elementRows.map(row => row.actionVariantLabel)
        ),
        hitIndexes: uniqueNumbers(elementRows.flatMap(row => row.hitIndexes)),
        rowCount: elementRows.length,
        requiredScaleMin,
        requiredScaleMax,
        requiredScaleRange: numberRange(requiredScaleMin, requiredScaleMax),
        requiredPerHitScaleMin,
        requiredPerHitScaleMax,
        requiredPerHitScaleRange: numberRange(
          requiredPerHitScaleMin,
          requiredPerHitScaleMax
        ),
        scaleSpreadStatus: createScaleSpreadStatus(requiredScales),
        slotOverrideCandidateVariables: uniqueStrings(
          elementRows.flatMap(row => row.slotOverrideCandidateVariables)
        ),
        directSlotMatchVariables: uniqueStrings(
          elementRows.flatMap(row => row.directSlotMatchVariables)
        ),
        rowsWithLargeDifference: elementRows.filter(
          row => row.differenceStatus === 'large-difference'
        ).length,
        rowsWithHitBindings,
        hitBindingCoverageStatus: createFormulaMatrixCoverageStatus({
          matchedCount: rowsWithHitBindings,
          totalCount: elementRows.length,
          allStatus: 'all-rows-have-hit-bindings',
          partialStatus: 'some-rows-missing-hit-bindings',
          noneStatus: 'no-rows-have-hit-bindings',
        }),
        unresolved: uniqueStrings(
          elementRows.flatMap(row => row.unresolved ?? [])
        ),
        applied: false,
      };
    })
    .sort(
      (left, right) =>
        Number(left.elementConfigId) - Number(right.elementConfigId)
    );
}

function createFormulaMatrixCoverageStatus({
  matchedCount,
  totalCount,
  allStatus,
  partialStatus,
  noneStatus,
}) {
  if (totalCount <= 0 || matchedCount <= 0) {
    return noneStatus;
  }
  return matchedCount >= totalCount ? allStatus : partialStatus;
}

function createFormulaPatternBindingEvidenceByActionId(
  formulaCandidatePatternSummary
) {
  const byActionId = new Map();
  for (const correlation of formulaCandidatePatternSummary?.skillControlBehaviorCorrelations ??
    []) {
    for (const binding of correlation.actionVariantBindingCandidates ?? []) {
      if (!binding?.actionId) {
        continue;
      }
      byActionId.set(
        binding.actionId,
        compactFormulaPatternBindingEvidence(binding, correlation)
      );
    }
  }
  return byActionId;
}

function compactFormulaPatternBindingEvidence(binding, correlation) {
  const candidates = (binding.candidates ?? [])
    .slice(0, 5)
    .map(compactFormulaPatternBindingCandidate);
  const primaryCandidates = candidates.filter(
    candidate => candidate.confidence === binding.confidence
  );
  const summaryCandidates =
    primaryCandidates.length > 0 ? primaryCandidates : candidates;

  return {
    status: binding.status ?? 'action-variant-binding-candidate-missing',
    actionId: binding.actionId ?? null,
    actionVariantIndex: numberOrNull(binding.actionVariantIndex),
    actionVariantLabel: binding.actionVariantLabel ?? null,
    rawMultiplier: binding.rawMultiplier ?? null,
    confidence: binding.confidence ?? 'none',
    candidateCount: numberOrNull(binding.candidateCount) ?? candidates.length,
    primaryCandidateCount: summaryCandidates.length,
    sourceNames: uniqueStrings(
      summaryCandidates
        .map(candidate => candidate.sourceName)
        .filter(value => value != null)
    ),
    sourceTrackNames: uniqueStrings(
      summaryCandidates
        .map(candidate => candidate.sourceTrackName)
        .filter(value => value != null)
    ),
    sourceStartFrames: uniqueNumbers(
      summaryCandidates.map(candidate => candidate.sourceStartFrame)
    ),
    stateNames: uniqueStrings(
      summaryCandidates.flatMap(candidate => candidate.stateNames)
    ),
    hitEffects: uniqueStrings(
      summaryCandidates.flatMap(candidate => candidate.hitEffects)
    ),
    subSkillIds: uniqueNumbers(
      summaryCandidates.flatMap(candidate => candidate.subSkillIds)
    ),
    bindingStatuses: uniqueStrings(
      summaryCandidates
        .map(candidate => candidate.bindingStatus)
        .filter(value => value != null)
    ),
    stateTimingEvidenceStatus: correlation.stateTimingEvidenceStatus ?? null,
    correlationStatus: correlation.correlationStatus ?? null,
    candidates,
    applied: false,
  };
}

function compactFormulaPatternBindingCandidate(candidate) {
  return {
    sourceName: candidate.sourceName ?? null,
    sourceTrackName: candidate.sourceTrackName ?? null,
    sourceStartFrame: numberOrNull(candidate.sourceStartFrame),
    sourceEndFrame: numberOrNull(candidate.sourceEndFrame),
    stateNames: candidate.stateNames ?? [],
    hitEffects: candidate.hitEffects ?? [],
    subSkillIds: candidate.subSkillIds ?? [],
    elementBaseRefCount: numberOrNull(candidate.elementBaseRefCount) ?? 0,
    elementPathIds: candidate.elementPathIds ?? [],
    elementRoundedPathIds: candidate.elementRoundedPathIds ?? [],
    scriptClassNames: candidate.scriptClassNames ?? [],
    score: numberOrNull(candidate.score),
    confidence: candidate.confidence ?? 'none',
    bindingStatus: candidate.bindingStatus ?? null,
    reasons: candidate.reasons ?? [],
    applied: false,
  };
}

function createFormulaExecutionHitBindingGap({
  actionId,
  actionName,
  skillId,
  actionVariantLabel,
  rowCount,
  rowsWithHitBindings,
  matrixElementConfigIds = [],
  actionLevelElementSource = null,
  behaviorBindingEvidence,
  runtimeSampleContext = null,
}) {
  const missingRowCount = Math.max(0, rowCount - rowsWithHitBindings);
  if (missingRowCount === 0) {
    return {
      status: 'hit-bindings-complete',
      actionId,
      actionName,
      skillId: numberOrNull(skillId),
      actionVariantLabel,
      matrixRowCount: rowCount,
      rowsWithHitBindings,
      missingRowCount: 0,
      behaviorBindingCandidateCount:
        numberOrNull(behaviorBindingEvidence?.candidateCount) ?? 0,
      applied: false,
    };
  }

  const behaviorBindingCandidateCount =
    numberOrNull(behaviorBindingEvidence?.candidateCount) ?? 0;
  const externalElementBinding = createHitBindingGapExternalElementBinding({
    skillId,
    behaviorBindingEvidence,
    runtimeSampleContext,
  });
  const elementSourceAlignment = createHitBindingGapElementSourceAlignment({
    actionLevelElementSource,
    matrixElementConfigIds,
    externalElementBinding,
  });
  return {
    status:
      behaviorBindingCandidateCount > 0
        ? 'skill-control-binding-candidate-found-hit-elements-unresolved'
        : 'skill-control-binding-candidate-missing',
    actionId,
    actionName,
    skillId: numberOrNull(skillId),
    actionVariantLabel,
    matrixRowCount: rowCount,
    rowsWithHitBindings,
    missingRowCount,
    behaviorBindingStatus: behaviorBindingEvidence?.status ?? null,
    behaviorBindingConfidence: behaviorBindingEvidence?.confidence ?? 'none',
    behaviorBindingCandidateCount,
    sourceNames: behaviorBindingEvidence?.sourceNames ?? [],
    sourceTrackNames: behaviorBindingEvidence?.sourceTrackNames ?? [],
    sourceStartFrames: behaviorBindingEvidence?.sourceStartFrames ?? [],
    stateNames: behaviorBindingEvidence?.stateNames ?? [],
    hitEffects: behaviorBindingEvidence?.hitEffects ?? [],
    subSkillIds: behaviorBindingEvidence?.subSkillIds ?? [],
    bindingStatuses: behaviorBindingEvidence?.bindingStatuses ?? [],
    stateTimingEvidenceStatus:
      behaviorBindingEvidence?.stateTimingEvidenceStatus ?? null,
    behaviorBindingEvidence: behaviorBindingEvidence ?? null,
    externalElementBinding,
    elementSourceAlignment,
    unresolved: [
      'hit-damage-element-binding-unresolved',
      externalElementBinding.damageElementCandidateCount > 0
        ? 'external-damage-element-hit-binding-unconfirmed'
        : 'external-element-object-binding-unconfirmed',
      ...(elementSourceAlignment.status ===
      'external-damage-elements-diverge-from-action-level-elements'
        ? ['action-level-and-skill-control-element-source-divergence']
        : []),
    ],
    applied: false,
  };
}

function createFormulaExecutionHitBindingGapSummary(actionSummaries) {
  const gaps = actionSummaries
    .map(summary => summary.hitBindingGap)
    .filter(gap => (gap?.missingRowCount ?? 0) > 0);
  const gapsWithBindingCandidates = gaps.filter(
    gap => (gap.behaviorBindingCandidateCount ?? 0) > 0
  );
  const externalElementBindingSummary =
    createHitBindingGapExternalElementBindingSummary(gaps);
  const elementSourceAlignmentSummary =
    createHitBindingGapElementSourceAlignmentSummary(gaps);
  const missingRowCount = gaps.reduce(
    (sum, gap) => sum + (gap.missingRowCount ?? 0),
    0
  );

  return {
    status:
      gaps.length === 0
        ? 'all-actions-have-hit-bindings'
        : gapsWithBindingCandidates.length === gaps.length
          ? 'all-missing-hit-actions-have-skill-control-candidates'
          : gapsWithBindingCandidates.length > 0
            ? 'some-missing-hit-actions-have-skill-control-candidates'
            : 'missing-hit-actions-lack-skill-control-candidates',
    actionCount: actionSummaries.length,
    missingActionCount: gaps.length,
    missingRowCount,
    actionsWithBindingCandidates: gapsWithBindingCandidates.length,
    actionVariantLabels: uniqueStrings(
      gaps.map(gap => gap.actionVariantLabel).filter(value => value != null)
    ),
    candidateSourceNames: uniqueStrings(
      gaps.flatMap(gap => gap.sourceNames ?? [])
    ),
    candidateStateNames: uniqueStrings(
      gaps.flatMap(gap => gap.stateNames ?? [])
    ),
    candidateHitEffects: uniqueStrings(
      gaps.flatMap(gap => gap.hitEffects ?? [])
    ),
    candidateSubSkillIds: uniqueNumbers(
      gaps.flatMap(gap => gap.subSkillIds ?? [])
    ),
    bindingStatuses: uniqueStrings(
      gaps.flatMap(gap => gap.bindingStatuses ?? [])
    ),
    externalElementBindingSummary,
    elementSourceAlignmentSummary,
    gaps,
    applied: false,
  };
}

function createHitBindingGapExternalElementBinding({
  skillId,
  behaviorBindingEvidence,
  runtimeSampleContext = null,
}) {
  const numericSkillId = numberOrNull(skillId);
  const sourceCandidates = selectPrimaryHitBindingBehaviorCandidates(
    behaviorBindingEvidence
  );
  if (!Number.isFinite(numericSkillId)) {
    return {
      status: 'skill-id-missing-for-external-element-binding',
      sourceKind: 'azpr-hit-binding-external-element-candidate',
      file: SKILL_ASSET_EVIDENCE_PATH,
      skillId: null,
      sourceCandidateCount: sourceCandidates.length,
      elementBaseRefCount: 0,
      resolvedElementRefCount: 0,
      damageElementRefCount: 0,
      damageElementCandidateCount: 0,
      candidates: [],
      unresolved: ['skill-id-missing'],
      applied: false,
    };
  }

  const candidates = sourceCandidates.map(candidate =>
    createHitBindingGapExternalElementCandidate({
      skillId: numericSkillId,
      candidate,
    })
  );
  const elementRefs = candidates.flatMap(candidate => candidate.elementRefs);
  const resolvedElementRefs = elementRefs.filter(
    ref => ref.objectStatus === 'resolved-in-element-assets-bundle'
  );
  const damageElementRefs = elementRefs.filter(ref => ref.isDamageElement);
  const uniqueDamageElementRefs = uniqueElementRefsByPath(damageElementRefs);
  const uniqueExternalRefs = uniqueElementRefsByPath(resolvedElementRefs);
  const skillLevelBridgeStatuses = uniqueStrings(
    uniqueDamageElementRefs
      .map(ref => ref.damageElementFieldMapping?.skillLevelBridge?.status)
      .filter(value => value != null)
  );
  const relatedElementLevelBridges = uniqueDamageElementRefs
    .map(
      ref =>
        ref.damageElementFieldMapping?.skillLevelBridge
          ?.relatedElementLevelBridge
    )
    .filter(Boolean);
  const relatedSkillLevelBridgeStatuses = uniqueStrings(
    relatedElementLevelBridges.map(bridge => bridge.status)
  );
  const relatedSkillLevelBridgePrimarySkillIds = uniqueNumbers(
    relatedElementLevelBridges.map(bridge => bridge.primarySkillId)
  );
  const relatedSkillLevelBridgeLevelRows = relatedElementLevelBridges.reduce(
    (sum, bridge) => sum + (numberOrNull(bridge.levelRows) ?? 0),
    0
  );
  const relatedSkillLevelBridgeInheritanceStatuses = uniqueStrings(
    relatedElementLevelBridges.map(bridge => bridge.inheritanceStatus)
  );
  const runtimeParameterSourceEvidence =
    createHitBindingGapRuntimeParameterSourceEvidence({
      skillId: numericSkillId,
      sourceCandidates,
      damageElementRefs: uniqueDamageElementRefs,
    });
  const runtimeApplicationTraceEvidence =
    createHitBindingGapRuntimeApplicationTraceEvidence({
      damageElementRefs: uniqueDamageElementRefs,
      runtimeParameterSourceEvidence,
    });
  const runtimeNativeDisassemblyFunctionKeys =
    runtimeApplicationTraceEvidence?.runtimeNativeDisassemblyFunctionKeys ?? [];
  const runtimeSelfEnergyFormulaProbe = createSelfEnergyRuntimeFormulaProbe(
    uniqueDamageElementRefs.map(ref => ({
      elementConfigId: ref.elementConfigId,
      pathId: ref.pathId,
      fieldCandidate: ref.damageElementFieldMapping?.selfEnergyChange,
    })),
    {
      sourceStatus: 'external-damage-element-candidates',
      runtimeSampleContext,
    }
  );
  const unresolved = uniqueStrings([
    'hit-index-binding-unconfirmed',
    'damage-element-execution-order-unconfirmed',
    'per-action-hit-count-unconfirmed',
    ...(skillLevelBridgeStatuses.includes(
      'skillsub-element-level-bridge-missing'
    )
      ? ['damage-element-level-bridge-missing']
      : []),
    ...(relatedSkillLevelBridgeStatuses.length > 0
      ? ['related-skill-level-inheritance-unconfirmed']
      : []),
    ...(runtimeParameterSourceEvidence?.candidateCount > 0
      ? ['runtime-parameter-source-application-unconfirmed']
      : []),
    ...(runtimeApplicationTraceEvidence?.trackedValueChainCount > 0
      ? ['runtime-application-native-disassembly-semantics-unconfirmed']
      : []),
    'toughness-unit-scale',
    'self-energy-owner-and-share-rule',
  ]);

  return {
    status: createExternalElementBindingStatus({
      sourceCandidateCount: sourceCandidates.length,
      resolvedElementRefCount: resolvedElementRefs.length,
      damageElementRefCount: damageElementRefs.length,
    }),
    sourceKind: 'azpr-hit-binding-external-element-candidate',
    file: SKILL_ASSET_EVIDENCE_PATH,
    skillId: numericSkillId,
    sourceCandidateCount: sourceCandidates.length,
    elementBaseRefCount: elementRefs.length,
    resolvedElementRefCount: resolvedElementRefs.length,
    uniqueExternalElementObjectCount: uniqueExternalRefs.length,
    damageElementRefCount: damageElementRefs.length,
    damageElementCandidateCount: uniqueDamageElementRefs.length,
    sourceNames: uniqueStrings(
      sourceCandidates
        .map(candidate => candidate.sourceName)
        .filter(value => value != null)
    ),
    sourceTrackNames: uniqueStrings(
      sourceCandidates
        .map(candidate => candidate.sourceTrackName)
        .filter(value => value != null)
    ),
    sourceStartFrames: uniqueNumbers(
      sourceCandidates.map(candidate => candidate.sourceStartFrame)
    ),
    sourceEndFrames: uniqueNumbers(
      sourceCandidates.map(candidate => candidate.sourceEndFrame)
    ),
    stateNames: uniqueStrings(
      sourceCandidates.flatMap(candidate => candidate.stateNames)
    ),
    hitEffects: uniqueStrings(
      sourceCandidates.flatMap(candidate => candidate.hitEffects)
    ),
    subSkillIds: uniqueNumbers(
      sourceCandidates.flatMap(candidate => candidate.subSkillIds)
    ),
    elementPathIds: uniqueStrings(
      elementRefs.map(ref => ref.pathId).filter(value => value != null)
    ),
    elementRoundedPathIds: uniqueStrings(
      sourceCandidates.flatMap(candidate => candidate.elementRoundedPathIds)
    ),
    scriptClassNames: uniqueStrings(
      uniqueExternalRefs
        .map(ref => ref.scriptClassName)
        .filter(value => value != null)
    ),
    damageElementPathIds: uniqueStrings(
      uniqueDamageElementRefs
        .map(ref => ref.pathId)
        .filter(value => value != null)
    ),
    damageElementConfigIds: uniqueNumbers(
      uniqueDamageElementRefs.map(ref => ref.elementConfigId)
    ),
    damageElementNames: uniqueStrings(
      uniqueDamageElementRefs
        .map(ref => ref.mName ?? ref.elementName)
        .filter(value => value != null)
    ),
    hpFormulaFunctionIds: uniqueNumbers(
      uniqueDamageElementRefs.flatMap(ref =>
        Object.values(
          ref.damageElementFieldMapping?.hpDamage?.formulaFunctionIds ?? {}
        )
      )
    ),
    hpFormulaFunctionOutputs: uniqueStrings(
      uniqueDamageElementRefs.flatMap(ref =>
        collectFormulaFunctionOutputs(
          ref.damageElementFieldMapping?.hpDamage?.formulaFunctionEvidence
        )
      )
    ),
    hpRawFormulaParamValueSamples: uniqueNumbers(
      uniqueDamageElementRefs.flatMap(
        ref => ref.damageElementFieldMapping?.hpDamage?.rawFormulaParamValues
      )
    ).slice(0, 12),
    weakBreakDamageRates: uniqueNumbers(
      uniqueDamageElementRefs.map(
        ref =>
          ref.damageElementFieldMapping?.toughnessDamage?.weakBreakDamageRate
      )
    ),
    recoverSPValues: uniqueNumbers(
      uniqueDamageElementRefs.map(
        ref => ref.damageElementFieldMapping?.selfEnergyChange?.recoverSP
      )
    ),
    petRecoverSPValues: uniqueNumbers(
      uniqueDamageElementRefs.map(
        ref => ref.damageElementFieldMapping?.selfEnergyChange?.petRecoverSP
      )
    ),
    recoverIntervals: uniqueNumbers(
      uniqueDamageElementRefs.map(
        ref => ref.damageElementFieldMapping?.selfEnergyChange?.recoverInterval
      )
    ),
    skillLevelBridgeStatuses,
    relatedSkillLevelBridgeStatuses,
    relatedSkillLevelBridgePrimarySkillIds,
    relatedSkillLevelBridgeLevelRows,
    relatedSkillLevelBridgeInheritanceStatuses,
    runtimeParameterSourceEvidence,
    runtimeParameterSourceStatuses: runtimeParameterSourceEvidence
      ? [runtimeParameterSourceEvidence.status]
      : [],
    runtimeParameterSourceCandidateCount:
      runtimeParameterSourceEvidence?.candidateCount ?? 0,
    runtimeParameterSourceSkillIds:
      runtimeParameterSourceEvidence?.relatedSkillIds ?? [],
    runtimeApplicationTraceEvidence,
    runtimeApplicationTraceStatuses: runtimeApplicationTraceEvidence
      ? [runtimeApplicationTraceEvidence.status]
      : [],
    runtimeApplicationTraceChainCount:
      runtimeApplicationTraceEvidence?.trackedValueChainCount ?? 0,
    runtimeMethodBodyStatuses: runtimeApplicationTraceEvidence
      ? [runtimeApplicationTraceEvidence.methodBodyStatus]
      : [],
    runtimeNativeMethodSymbolStatuses:
      runtimeApplicationTraceEvidence?.nativeMethodSymbolEvidence?.status !=
      null
        ? [runtimeApplicationTraceEvidence.nativeMethodSymbolEvidence.status]
        : [],
    runtimeNativeMethodSymbolKeys:
      runtimeApplicationTraceEvidence?.runtimeNativeMethodSymbolKeys ?? [],
    runtimeNativeMethodSymbolCount:
      runtimeApplicationTraceEvidence?.runtimeNativeMethodSymbolCount ?? 0,
    runtimeNativeDisassemblyStatuses:
      runtimeApplicationTraceEvidence?.nativeDisassemblyEvidence?.status != null
        ? [runtimeApplicationTraceEvidence.nativeDisassemblyEvidence.status]
        : [],
    runtimeNativeDisassemblyFunctionCount:
      runtimeApplicationTraceEvidence?.nativeDisassemblyEvidence
        ?.functionCount ?? 0,
    runtimeNativeDisassemblyFunctionKeys,
    runtimeSelfEnergyFormulaProbe,
    runtimeSelfEnergyFormulaProbeStatuses:
      runtimeSelfEnergyFormulaProbe.status !==
      'recover-sp-runtime-probe-missing'
        ? [runtimeSelfEnergyFormulaProbe.status]
        : [],
    runtimeSelfEnergyFormulaProbeCandidateCount:
      runtimeSelfEnergyFormulaProbe.candidateCount,
    runtimeSelfEnergyFormulaProbeGateOpenCount:
      runtimeSelfEnergyFormulaProbe.gateOpenCount,
    runtimeSelfEnergySourceToArgsProbeStatuses:
      runtimeSelfEnergyFormulaProbe.sourceToArgsProbe?.status !==
      'source-to-args-subprobe-missing'
        ? [runtimeSelfEnergyFormulaProbe.sourceToArgsProbe.status]
        : [],
    runtimeSelfEnergySourceToArgsProbeCandidateCount:
      runtimeSelfEnergyFormulaProbe.sourceToArgsProbe?.candidateCount ?? 0,
    runtimeSelfEnergySourceToArgsProbeGateOpenCount:
      runtimeSelfEnergyFormulaProbe.sourceToArgsProbe?.gateOpenCount ?? 0,
    runtimeSelfEnergyModifierProbeStatuses:
      runtimeSelfEnergyFormulaProbe.runtimeModifierProbe?.status !==
      'runtime-modifier-subprobe-missing'
        ? [runtimeSelfEnergyFormulaProbe.runtimeModifierProbe.status]
        : [],
    runtimeSelfEnergyModifierProbeCandidateCount:
      runtimeSelfEnergyFormulaProbe.runtimeModifierProbe?.candidateCount ?? 0,
    runtimeSelfEnergyModifierProbeGateOpenCount:
      runtimeSelfEnergyFormulaProbe.runtimeModifierProbe?.gateOpenCount ?? 0,
    runtimeSelfEnergyOwnerShareIntervalProbeStatuses:
      runtimeSelfEnergyFormulaProbe.ownerShareIntervalProbe?.status !==
      'owner-share-interval-subprobe-missing'
        ? [runtimeSelfEnergyFormulaProbe.ownerShareIntervalProbe.status]
        : [],
    runtimeSelfEnergyOwnerShareIntervalProbeCandidateCount:
      runtimeSelfEnergyFormulaProbe.ownerShareIntervalProbe?.candidateCount ??
      0,
    runtimeSelfEnergyOwnerShareIntervalProbeGateOpenCount:
      runtimeSelfEnergyFormulaProbe.ownerShareIntervalProbe?.gateOpenCount ?? 0,
    runtimeSelfEnergySamplingProbeStatuses:
      runtimeSelfEnergyFormulaProbe.runtimeSamplingProbe?.status !==
      'runtime-sampling-schema-missing'
        ? [runtimeSelfEnergyFormulaProbe.runtimeSamplingProbe.status]
        : [],
    runtimeSelfEnergySamplingProbeCandidateCount:
      runtimeSelfEnergyFormulaProbe.runtimeSamplingProbe?.candidateCount ?? 0,
    runtimeSelfEnergySamplingProbeGateOpenCount:
      runtimeSelfEnergyFormulaProbe.runtimeSamplingProbe?.gateOpenCount ?? 0,
    candidates,
    unresolved,
    applied: false,
    note: 'External element refs are resolved as hit-binding candidates only; final hit index, DamageElement execution and HP/toughness/energy formulas remain unconfirmed.',
  };
}

function createHitBindingGapRuntimeParameterSourceEvidence({
  skillId,
  sourceCandidates,
  damageElementRefs,
}) {
  const relatedRows = uniqueElementRefsByPath(damageElementRefs)
    .map(ref => ({
      ref,
      bridge:
        ref.damageElementFieldMapping?.skillLevelBridge
          ?.relatedElementLevelBridge,
    }))
    .filter(row => row.bridge);

  const sourceStateNames = uniqueStrings(
    sourceCandidates.flatMap(candidate => candidate.stateNames ?? [])
  );
  const sourceSubSkillIds = uniqueNumbers(
    sourceCandidates.flatMap(candidate => candidate.subSkillIds ?? [])
  );
  const sourceHitEffects = uniqueStrings(
    sourceCandidates.flatMap(candidate => candidate.hitEffects ?? [])
  );
  const sourceStartFrames = uniqueNumbers(
    sourceCandidates.map(candidate => candidate.sourceStartFrame)
  );
  const sourceEndFrames = uniqueNumbers(
    sourceCandidates.map(candidate => candidate.sourceEndFrame)
  );
  const damageElementConfigIds = uniqueNumbers(
    relatedRows.map(row => row.ref.elementConfigId)
  );
  const relatedSkillIds = uniqueNumbers(
    relatedRows.flatMap(row => [
      row.bridge.primarySkillId,
      ...(row.bridge.candidateSkillIds ?? []),
    ])
  );
  const derivedSkillIds = uniqueNumbers(
    relatedRows.map(row => row.bridge.derivedSkillId)
  );
  const characterSlotRefs = uniqueCharacterSlotRefs(
    relatedRows.flatMap(row =>
      (row.bridge.candidates ?? []).flatMap(
        candidate => candidate.characterSlotRefs ?? []
      )
    )
  );
  const relationFindings = uniqueStrings([
    ...(sourceSubSkillIds.length > 0
      ? ['skill-control-source-subskill-uses-external-damage-element']
      : []),
    ...(sourceHitEffects.length > 0
      ? ['skill-control-hit-effect-links-external-damage-element']
      : []),
    ...(damageElementConfigIds.some(elementConfigId =>
      relatedSkillIds.includes(Math.trunc(Number(elementConfigId) / 10))
    )
      ? ['element-config-id-derived-related-skill-id']
      : []),
    ...(derivedSkillIds.some(skillIdValue =>
      relatedSkillIds.includes(skillIdValue)
    )
      ? ['related-bridge-primary-skill-matches-derived-skill-id']
      : []),
    ...(characterSlotRefs.length > 0
      ? ['related-skill-present-in-character-slot']
      : []),
    'il2cpp-damage-element-parse-receives-skill-id',
    'il2cpp-skill-element-injector-executes-damage-element',
  ]);

  return {
    status:
      relatedRows.length > 0
        ? 'runtime-parameter-source-candidates-found-application-unconfirmed'
        : 'runtime-parameter-source-candidates-missing',
    sourceKind: 'azpr-runtime-parameter-source-candidate',
    file: SKILL_ASSET_EVIDENCE_PATH,
    sourceSkillId: numberOrNull(skillId),
    sourceStateNames,
    sourceSubSkillIds,
    sourceHitEffects,
    sourceStartFrames,
    sourceEndFrames,
    damageElementConfigIds,
    damageElementPathIds: uniqueStrings(
      relatedRows.map(row => row.ref.pathId).filter(value => value != null)
    ),
    relatedSkillIds,
    derivedSkillIds,
    characterSlotRefs,
    candidateCount: relatedRows.length,
    relationFindings,
    runtimeMethodEvidence: [
      {
        className: 'DamageElement',
        method:
          'Parse(TElementParams param, int skillId, CustomBattleVerifyInfo verifyInfo)',
        finding: 'damage-element-parse-receives-skill-id',
        source: 'C:/Codex/AzPr Extractor/outputs/il2cpp-dump/dump.cs',
        sourceLineRange: 'dump.cs:274573-274708',
      },
      {
        className: 'SkillElementInjector',
        method: 'ExecuteDamageElement(DamageElement element)',
        finding: 'skill-element-injector-executes-damage-element',
        source: 'C:/Codex/AzPr Extractor/outputs/il2cpp-dump/dump.cs',
        sourceLineRange: 'dump.cs:272567-272576',
      },
    ],
    evidenceRows: relatedRows.map(row => ({
      elementConfigId: numberOrNull(row.ref.elementConfigId),
      pathId: row.ref.pathId ?? null,
      elementName: row.ref.elementName ?? null,
      bridgeStatus: row.bridge.status ?? null,
      primarySkillId: numberOrNull(row.bridge.primarySkillId),
      primaryRelationStatus: row.bridge.primaryRelationStatus ?? null,
      candidateSkillIds: row.bridge.candidateSkillIds ?? [],
      levelRows: numberOrNull(row.bridge.levelRows) ?? 0,
      parameterIds: row.bridge.parameterIds ?? [],
      varyingParameterIds: row.bridge.varyingParameterIds ?? [],
      formulaSlotConclusion:
        row.bridge.formulaSlotAlignment?.conclusion ?? null,
      inheritanceStatus: row.bridge.inheritanceStatus ?? null,
    })),
    unresolved: uniqueStrings([
      'damage-element-hit-index-binding-unconfirmed',
      'runtime-related-skill-level-selection-unconfirmed',
      'runtime-parameter-source-application-unconfirmed',
      'function-combination-order-unconfirmed',
    ]),
    applied: false,
    note: 'This groups source subSkill, external DamageElement and related skill-level rows as a runtime parameter-source candidate only; it is not applied to final HP/toughness/energy formulas.',
  };
}

function createHitBindingGapRuntimeApplicationTraceEvidence({
  damageElementRefs,
  runtimeParameterSourceEvidence,
}) {
  const refs = uniqueElementRefsByPath(damageElementRefs);
  const damageElementConfigIds = uniqueNumbers(
    refs.map(ref => ref.elementConfigId)
  );
  const hasDamageElement = refs.length > 0;
  const hpFormulaFunctionIds = uniqueNumbers(
    refs.flatMap(ref =>
      Object.values(
        ref.damageElementFieldMapping?.hpDamage?.formulaFunctionIds ?? {}
      )
    )
  );
  const weakBreakDamageRates = uniqueNumbers(
    refs.map(
      ref => ref.damageElementFieldMapping?.toughnessDamage?.weakBreakDamageRate
    )
  );
  const recoverSPValues = uniqueNumbers(
    refs.map(ref => ref.damageElementFieldMapping?.selfEnergyChange?.recoverSP)
  );
  const petRecoverSPValues = uniqueNumbers(
    refs.map(
      ref => ref.damageElementFieldMapping?.selfEnergyChange?.petRecoverSP
    )
  );
  const recoverIntervals = uniqueNumbers(
    refs.map(
      ref => ref.damageElementFieldMapping?.selfEnergyChange?.recoverInterval
    )
  );
  const trackedValueChainCount = [
    hpFormulaFunctionIds.length > 0,
    weakBreakDamageRates.length > 0,
    recoverSPValues.length > 0 ||
      petRecoverSPValues.length > 0 ||
      recoverIntervals.length > 0,
  ].filter(Boolean).length;
  const nativeMethodSymbolEvidence = hasDamageElement
    ? createRuntimeNativeMethodSymbolEvidence()
    : null;
  const nativeDisassemblyEvidence =
    nativeMethodSymbolEvidence?.nativeDisassemblyEvidence ?? null;
  const runtimeNativeDisassemblyFunctionKeys =
    getRuntimeNativeDisassemblyFunctionKeys(nativeDisassemblyEvidence);

  return {
    status: hasDamageElement
      ? 'runtime-application-entrypoints-found-native-disassembly-snippets'
      : 'runtime-application-entrypoints-missing',
    sourceKind: 'azpr-runtime-application-trace-evidence',
    file: SKILL_ASSET_EVIDENCE_PATH,
    damageElementConfigIds,
    damageElementPathIds: uniqueStrings(
      refs.map(ref => ref.pathId).filter(value => value != null)
    ),
    trackedValueChainCount,
    methodBodyStatus:
      nativeDisassemblyEvidence?.status ??
      nativeMethodSymbolEvidence?.methodBodyStatus ??
      'il2cpp-dump-signatures-only',
    methodBodyAvailabilityStatus:
      nativeDisassemblyEvidence?.status ??
      nativeMethodSymbolEvidence?.status ??
      'native-method-symbols-not-evaluated',
    runtimeNativeMethodSymbolCount:
      nativeMethodSymbolEvidence?.methodCount ?? 0,
    runtimeNativeMethodSymbolKeys: nativeMethodSymbolEvidence?.methodKeys ?? [],
    runtimeNativeDisassemblyFunctionCount:
      nativeDisassemblyEvidence?.functionCount ?? 0,
    runtimeNativeDisassemblyFunctionKeys,
    nativeMethodSymbolEvidence,
    nativeDisassemblyEvidence,
    parameterOverrideStatus:
      (runtimeParameterSourceEvidence?.candidateCount ?? 0) > 0
        ? 'related-skill-level-candidate-found-execution-override-order-unconfirmed'
        : 'related-skill-level-candidate-missing',
    hpDamage: {
      status:
        hpFormulaFunctionIds.length > 0
          ? 'formula-output-entrypoints-found-application-order-unconfirmed'
          : 'formula-output-entrypoints-missing',
      inputFieldSources: [
        'TDamageElementParams.formulaParams.function_1',
        'TDamageElementParams.formulaParams.function_2',
        'TDamageElementParams.formulaParams.formulaParamValues',
      ],
      formulaFunctionIds: hpFormulaFunctionIds,
      runtimeEntryPoints: [
        {
          className: 'DamageElement',
          methods: [
            'ExecuteEffect',
            'Execute',
            'BaseExecute',
            'Parse(TElementParams param, int skillId, CustomBattleVerifyInfo verifyInfo)',
          ],
          source: 'C:/Codex/AzPr Extractor/outputs/il2cpp-dump/dump.cs',
          sourceLineRange: 'dump.cs:274573-274708',
        },
        {
          className: 'FormulaUtility',
          methods: [
            'GetOutput',
            'GetOutputDamage',
            'Calculate',
            'innerCalculate',
            'GetFunctionParams',
            'SkillDmgUp',
            'WeaknessPointChange',
          ],
          source: 'C:/Codex/AzPr Extractor/outputs/il2cpp-dump/dump.cs',
          sourceLineRange: 'dump.cs:336831-336898',
        },
        {
          className: 'FormulaUtility.OutputDamageData',
          fields: ['outputDamage', 'realDamage', 'isCritical', 'isShield'],
          source: 'C:/Codex/AzPr Extractor/outputs/il2cpp-dump/dump.cs',
          sourceLineRange: 'dump.cs:336798-336814',
        },
      ],
      nativeMethodSymbols: getRuntimeNativeMethodSymbolsByChain('hpDamage'),
      unresolved: [
        'function-combination-order-unconfirmed',
        'formula-param-override-order-unconfirmed',
        'enemy-defense-resistance-critical-target-state-unconfirmed',
      ],
      applied: false,
    },
    toughnessDamage: {
      status:
        weakBreakDamageRates.length > 0
          ? 'weak-break-entrypoints-found-unit-scale-unconfirmed'
          : 'weak-break-entrypoints-missing',
      inputFieldSources: [
        'TDamageElementParams.weakBreakDamageRate',
        'TDamageElementParams.useOneBreak',
      ],
      weakBreakDamageRates,
      runtimeEntryPoints: [
        {
          className: 'FormulaUtility',
          methods: ['GetOutputWeaknessDamage', 'WeaknessPointChange'],
          source: 'C:/Codex/AzPr Extractor/outputs/il2cpp-dump/dump.cs',
          sourceLineRange: 'dump.cs:336887-336898',
        },
        {
          className: 'WeakBreakSystem',
          methods: [
            'OnTransmit',
            'UpdateWeakState',
            'WeakBreaking',
            'WeakBreakEnding',
            'WeakBreakEnd',
            'WeaknessPointUpdate',
          ],
          source: 'C:/Codex/AzPr Extractor/outputs/il2cpp-dump/dump.cs',
          sourceLineRange: 'dump.cs:289239-289419',
        },
      ],
      nativeMethodSymbols:
        getRuntimeNativeMethodSymbolsByChain('toughnessDamage'),
      unresolved: [
        'weak-break-unit-scale-unconfirmed',
        'weak-break-state-gating-unconfirmed',
        'target-weakness-state-application-unconfirmed',
      ],
      applied: false,
    },
    selfEnergyChange: {
      status:
        recoverSPValues.length > 0 ||
        petRecoverSPValues.length > 0 ||
        recoverIntervals.length > 0
          ? 'recover-sp-entrypoints-found-owner-share-unconfirmed'
          : 'recover-sp-entrypoints-missing',
      inputFieldSources: [
        'TDamageElementParams.recoverSP',
        'TDamageElementParams.petRecoverSP',
        'TDamageElementParams.recoverInterval',
      ],
      recoverSPValues,
      petRecoverSPValues,
      recoverIntervals,
      runtimeEntryPoints: [
        {
          className: 'DamageElement',
          methods: ['RecoverSP'],
          source: 'C:/Codex/AzPr Extractor/outputs/il2cpp-dump/dump.cs',
          sourceLineRange: 'dump.cs:274596-274672',
        },
        {
          className: 'RecoverSPArgs',
          fields: [
            'baseDelta',
            'delta',
            'interval',
            'tagType',
            'skillId',
            'sharePercent',
            'petSharePercent',
            'petDelta',
            'mainPetSharePercent',
          ],
          source: 'C:/Codex/AzPr Extractor/outputs/il2cpp-dump/dump.cs',
          sourceLineRange: 'dump.cs:256196-256211',
        },
        {
          className: 'SPSystem',
          methods: ['OnTransmit', 'RecoverSP'],
          fields: ['m_recoverTimerMap'],
          source: 'C:/Codex/AzPr Extractor/outputs/il2cpp-dump/dump.cs',
          sourceLineRange: 'dump.cs:288763-288851',
        },
      ],
      nativeMethodSymbols:
        getRuntimeNativeMethodSymbolsByChain('selfEnergyChange'),
      unresolved: [
        'self-energy-owner-unconfirmed',
        'sp-share-percent-rule-unconfirmed',
        'recover-interval-trigger-rule-unconfirmed',
      ],
      applied: false,
    },
    unresolved: [
      'native-disassembly-semantics-unconfirmed',
      'runtime-call-target-mapping-unconfirmed',
      'runtime-parameter-override-order-unconfirmed',
      'hp-toughness-energy-application-points-unconfirmed',
    ],
    applied: false,
    note: 'This records runtime entry points, data carriers and selected native disassembly snippets for HP, toughness and self energy. Formula semantics remain evidence-only until call targets, order and units are confirmed.',
  };
}

function createRuntimeNativeMethodSymbolEvidence() {
  const methodKeys = uniqueStrings(
    RUNTIME_NATIVE_METHOD_SYMBOLS.map(createRuntimeMethodSymbolKey)
  );
  const chainMethodCounts = ['hpDamage', 'toughnessDamage', 'selfEnergyChange']
    .map(chain => ({
      chain,
      methodCount: getRuntimeNativeMethodSymbolsByChain(chain).length,
    }))
    .filter(item => item.methodCount > 0);

  return {
    status: 'native-addresses-and-signatures-found-method-bodies-not-extracted',
    sourceKind: 'azpr-il2cpp-native-method-symbol-evidence',
    methodBodyStatus:
      'native-addresses-and-signatures-found-method-bodies-not-extracted',
    sourceFiles: [
      {
        kind: 'il2cpp-signature-stubs',
        path: AZPR_IL2CPP_DUMP_CS_PATH,
        status: 'available-signatures-only',
      },
      {
        kind: 'il2cpp-script-method-addresses',
        path: AZPR_IL2CPP_SCRIPT_JSON_PATH,
        status: 'available-native-addresses-and-signatures',
      },
      {
        kind: 'il2cpp-field-layout-header',
        path: AZPR_IL2CPP_HEADER_PATH,
        status: 'available-field-layouts',
      },
      {
        kind: 'il2cpp-string-literals',
        path: AZPR_IL2CPP_STRING_LITERAL_PATH,
        status: 'available-target-entrypoint-literals',
      },
      {
        kind: 'dummy-assembly',
        path: AZPR_IL2CPP_DUMMY_DLL_PATH,
        status: 'available-metadata-stubs-no-managed-bodies',
      },
    ],
    availableEvidence: [
      'dump.cs exposes C# signatures and fields',
      'script.json exposes native method addresses and signatures',
      'il2cpp.h exposes field layouts for DamageElement, RecoverSPArgs, SPSystem and WeakBreakSystem',
      'stringliteral.json contains target runtime names',
    ],
    missingEvidence: [
      'managed C# method bodies',
      'full IDA/Ghidra/C++ pseudocode and call target map for target RVAs',
      'runtime hook trace confirming call order and units',
    ],
    methodCount: methodKeys.length,
    methodKeys,
    chainMethodCounts,
    targetMethods: RUNTIME_NATIVE_METHOD_SYMBOLS,
    fieldLayoutEvidence: RUNTIME_FIELD_LAYOUT_EVIDENCE,
    stringLiteralEvidence: RUNTIME_NATIVE_STRING_LITERALS,
    nativeDisassemblyEvidence: RUNTIME_NATIVE_DISASSEMBLY_EVIDENCE,
    applied: false,
    note: 'Native addresses make the runtime application entrypoints locatable; selected disassembly snippets are attached separately, while application order, scaling units and trigger conditions remain unconfirmed.',
  };
}

function getRuntimeNativeMethodSymbolsByChain(chain) {
  return RUNTIME_NATIVE_METHOD_SYMBOLS.filter(symbol =>
    (symbol.chains ?? []).includes(chain)
  );
}

function createRuntimeMethodSymbolKey(symbol) {
  return `${symbol.qualifiedName}@${symbol.rva}`;
}

function getRuntimeNativeDisassemblyFunctionKeys(evidence) {
  return uniqueStrings(
    (evidence?.targetFunctions ?? []).map(
      createRuntimeNativeDisassemblyFunctionKey
    )
  );
}

function createRuntimeNativeDisassemblyFunctionKey(target) {
  return `${target.className}.${target.method}@${target.rva}`;
}

function selectPrimaryHitBindingBehaviorCandidates(behaviorBindingEvidence) {
  const candidates = behaviorBindingEvidence?.candidates ?? [];
  const primaryCandidates = candidates.filter(
    candidate => candidate.confidence === behaviorBindingEvidence?.confidence
  );
  return primaryCandidates.length > 0 ? primaryCandidates : candidates;
}

function createHitBindingGapExternalElementCandidate({ skillId, candidate }) {
  const elementPathIds = uniqueStrings(candidate.elementPathIds ?? []);
  const elementRefs = elementPathIds.map(pathId =>
    createHitBindingGapExternalElementRef({ skillId, pathId })
  );
  const damageElementRefCount = elementRefs.filter(
    ref => ref.isDamageElement
  ).length;
  const resolvedElementRefCount = elementRefs.filter(
    ref => ref.objectStatus === 'resolved-in-element-assets-bundle'
  ).length;

  return {
    sourceName: candidate.sourceName ?? null,
    sourceTrackName: candidate.sourceTrackName ?? null,
    sourceStartFrame: numberOrNull(candidate.sourceStartFrame),
    sourceEndFrame: numberOrNull(candidate.sourceEndFrame),
    stateNames: candidate.stateNames ?? [],
    hitEffects: candidate.hitEffects ?? [],
    subSkillIds: candidate.subSkillIds ?? [],
    confidence: candidate.confidence ?? 'none',
    bindingStatus: candidate.bindingStatus ?? null,
    reasons: candidate.reasons ?? [],
    elementPathIds,
    elementRoundedPathIds: candidate.elementRoundedPathIds ?? [],
    elementBaseRefCount: elementRefs.length,
    resolvedElementRefCount,
    damageElementRefCount,
    damageElementConfigIds: uniqueNumbers(
      elementRefs
        .filter(ref => ref.isDamageElement)
        .map(ref => ref.elementConfigId)
    ),
    status:
      damageElementRefCount > 0
        ? 'damage-element-field-candidate-found'
        : resolvedElementRefCount > 0
          ? 'external-elements-resolved-without-damage-fields'
          : 'external-element-objects-unresolved',
    elementRefs,
    applied: false,
  };
}

function createHitBindingGapExternalElementRef({ skillId, pathId }) {
  const externalObject = findExternalElementObjectBySkillPathId(
    skillId,
    pathId
  );
  const fieldMapping = findDamageElementFieldMappingBySkillPathId(
    skillId,
    pathId
  );
  const scriptClassName =
    externalObject?.scriptTypeCandidate?.className ??
    fieldMapping?.scriptTypeCandidate?.className ??
    null;

  return {
    pathId: pathId ?? null,
    objectStatus:
      externalObject?.status ?? 'external-element-object-not-resolved',
    elementConfigId: numberOrNull(
      externalObject?.elementConfigId ?? fieldMapping?.elementConfigId
    ),
    mName: externalObject?.mName ?? null,
    elementName:
      externalObject?.elementName ?? fieldMapping?.elementName ?? null,
    describe: externalObject?.describe ?? fieldMapping?.describe ?? null,
    scriptClassName,
    mediaPackNames: uniqueStrings([
      ...(externalObject?.mediaPackNames ?? []),
      ...(fieldMapping?.mediaPackNames ?? []),
    ]),
    isDamageElement:
      Boolean(fieldMapping) || scriptClassName === 'TDamageElementParams',
    damageElementFieldMapping: fieldMapping
      ? compactHitBindingDamageElementFieldMapping(fieldMapping)
      : null,
    applied: false,
  };
}

function compactHitBindingDamageElementFieldMapping(mapping) {
  return {
    elementConfigId: numberOrNull(mapping.elementConfigId),
    pathId: mapping.pathId ?? null,
    containerPath: mapping.containerPath ?? null,
    mediaPackNames: mapping.mediaPackNames ?? [],
    hpDamage: mapping.hpDamage
      ? {
          status: mapping.hpDamage.status ?? null,
          formulaFunctionIds: mapping.hpDamage.formulaFunctionIds ?? {},
          formulaFunctionEvidence: compactFormulaFunctionEvidence(
            mapping.hpDamage.formulaFunctionEvidence
          ),
          formulaSlotCandidates: mapping.hpDamage.formulaSlotCandidates ?? [],
          rawFormulaParamValues: mapping.hpDamage.rawFormulaParamValues ?? [],
          damageFields: compactDamageFieldPatternValues(
            mapping.hpDamage.damageFields
          ),
        }
      : null,
    toughnessDamage: mapping.toughnessDamage
      ? {
          status: mapping.toughnessDamage.status ?? null,
          weakBreakDamageRate: numberOrNull(
            mapping.toughnessDamage.weakBreakDamageRate
          ),
          hitType: numberOrNull(mapping.toughnessDamage.hitType),
          knockBackId: numberOrNull(mapping.toughnessDamage.knockBackId),
          knockBackForce: numberOrNull(mapping.toughnessDamage.knockBackForce),
          interruptPriority: numberOrNull(
            mapping.toughnessDamage.interruptPriority
          ),
          useOneBreak: numberOrNull(mapping.toughnessDamage.useOneBreak),
        }
      : null,
    selfEnergyChange: mapping.selfEnergyChange
      ? {
          status: mapping.selfEnergyChange.status ?? null,
          recoverSP: numberOrNull(mapping.selfEnergyChange.recoverSP),
          petRecoverSP: numberOrNull(mapping.selfEnergyChange.petRecoverSP),
          recoverInterval: numberOrNull(
            mapping.selfEnergyChange.recoverInterval
          ),
          ownerScope: mapping.selfEnergyChange.ownerScope ?? null,
        }
      : null,
    skillLevelBridge: {
      status: mapping.skillLevelBridge?.status ?? null,
      source: mapping.skillLevelBridge?.source ?? null,
      levelRows: numberOrNull(mapping.skillLevelBridge?.levelRows) ?? 0,
      parameterIds: mapping.skillLevelBridge?.parameterIds ?? [],
      varyingParameterIds: mapping.skillLevelBridge?.varyingParameterIds ?? [],
      formulaSlotAlignment: compactFormulaSlotAlignment(
        mapping.skillLevelBridge?.formulaParamAlignment
      ),
      firstLevel: mapping.skillLevelBridge?.firstLevel
        ? {
            level: numberOrNull(mapping.skillLevelBridge.firstLevel.level),
            valueParam: mapping.skillLevelBridge.firstLevel.valueParam ?? null,
          }
        : null,
      lastLevel: mapping.skillLevelBridge?.lastLevel
        ? {
            level: numberOrNull(mapping.skillLevelBridge.lastLevel.level),
            valueParam: mapping.skillLevelBridge.lastLevel.valueParam ?? null,
          }
        : null,
      relatedElementLevelBridge: compactRelatedElementLevelBridge(
        mapping.skillLevelBridge?.relatedElementLevelBridge
      ),
    },
    unresolved: mapping.unresolved ?? [],
    applied: false,
  };
}

function createExternalElementBindingStatus({
  sourceCandidateCount,
  resolvedElementRefCount,
  damageElementRefCount,
}) {
  if (sourceCandidateCount <= 0) {
    return 'behavior-binding-candidates-missing';
  }
  if (damageElementRefCount > 0) {
    return 'damage-element-field-candidates-found-hit-binding-unconfirmed';
  }
  if (resolvedElementRefCount > 0) {
    return 'external-elements-resolved-no-damage-field-candidates';
  }
  return 'external-element-objects-unresolved';
}

function createHitBindingGapExternalElementBindingSummary(gaps) {
  const bindings = gaps.map(gap => gap.externalElementBinding).filter(Boolean);
  const bindingsWithResolvedElements = bindings.filter(
    binding => (binding.resolvedElementRefCount ?? 0) > 0
  );
  const bindingsWithDamageElements = bindings.filter(
    binding => (binding.damageElementCandidateCount ?? 0) > 0
  );
  const damageElementRefs = uniqueElementRefsByPath(
    bindings.flatMap(binding =>
      (binding.candidates ?? []).flatMap(candidate =>
        (candidate.elementRefs ?? []).filter(ref => ref.isDamageElement)
      )
    )
  );
  const runtimeNativeMethodSymbolKeys = uniqueStrings(
    bindings.flatMap(binding => binding.runtimeNativeMethodSymbolKeys ?? [])
  );
  const runtimeNativeDisassemblyFunctionKeys = uniqueStrings(
    bindings.flatMap(
      binding => binding.runtimeNativeDisassemblyFunctionKeys ?? []
    )
  );

  return {
    status:
      gaps.length === 0
        ? 'no-hit-binding-gaps'
        : bindingsWithDamageElements.length === gaps.length
          ? 'all-candidate-gaps-have-damage-element-field-candidates'
          : bindingsWithDamageElements.length > 0
            ? 'some-candidate-gaps-have-damage-element-field-candidates'
            : bindingsWithResolvedElements.length > 0
              ? 'external-elements-resolved-no-damage-field-candidates'
              : 'external-element-binding-candidates-missing',
    gapCount: gaps.length,
    gapsWithExternalElementCandidates: bindingsWithResolvedElements.length,
    gapsWithDamageElementCandidates: bindingsWithDamageElements.length,
    damageElementCandidateCount: damageElementRefs.length,
    damageElementConfigIds: uniqueNumbers(
      damageElementRefs.map(ref => ref.elementConfigId)
    ),
    damageElementPathIds: uniqueStrings(
      damageElementRefs.map(ref => ref.pathId).filter(value => value != null)
    ),
    sourceStartFrames: uniqueNumbers(
      bindings.flatMap(binding => binding.sourceStartFrames ?? [])
    ),
    stateNames: uniqueStrings(
      bindings.flatMap(binding => binding.stateNames ?? [])
    ),
    hitEffects: uniqueStrings(
      bindings.flatMap(binding => binding.hitEffects ?? [])
    ),
    subSkillIds: uniqueNumbers(
      bindings.flatMap(binding => binding.subSkillIds ?? [])
    ),
    scriptClassNames: uniqueStrings(
      bindings.flatMap(binding => binding.scriptClassNames ?? [])
    ),
    hpFormulaFunctionIds: uniqueNumbers(
      bindings.flatMap(binding => binding.hpFormulaFunctionIds ?? [])
    ),
    hpFormulaFunctionOutputs: uniqueStrings(
      bindings.flatMap(binding => binding.hpFormulaFunctionOutputs ?? [])
    ),
    weakBreakDamageRates: uniqueNumbers(
      bindings.flatMap(binding => binding.weakBreakDamageRates ?? [])
    ),
    recoverSPValues: uniqueNumbers(
      bindings.flatMap(binding => binding.recoverSPValues ?? [])
    ),
    skillLevelBridgeStatuses: uniqueStrings(
      bindings.flatMap(binding => binding.skillLevelBridgeStatuses ?? [])
    ),
    relatedSkillLevelBridgeStatuses: uniqueStrings(
      bindings.flatMap(binding => binding.relatedSkillLevelBridgeStatuses ?? [])
    ),
    relatedSkillLevelBridgePrimarySkillIds: uniqueNumbers(
      bindings.flatMap(
        binding => binding.relatedSkillLevelBridgePrimarySkillIds ?? []
      )
    ),
    relatedSkillLevelBridgeLevelRows: bindings.reduce(
      (sum, binding) =>
        sum + (numberOrNull(binding.relatedSkillLevelBridgeLevelRows) ?? 0),
      0
    ),
    relatedSkillLevelBridgeInheritanceStatuses: uniqueStrings(
      bindings.flatMap(
        binding => binding.relatedSkillLevelBridgeInheritanceStatuses ?? []
      )
    ),
    gapsWithRelatedSkillLevelBridges: bindings.filter(
      binding => (binding.relatedSkillLevelBridgeStatuses ?? []).length > 0
    ).length,
    runtimeParameterSourceStatuses: uniqueStrings(
      bindings.flatMap(binding => binding.runtimeParameterSourceStatuses ?? [])
    ),
    runtimeParameterSourceCandidateCount: bindings.reduce(
      (sum, binding) =>
        sum + (numberOrNull(binding.runtimeParameterSourceCandidateCount) ?? 0),
      0
    ),
    runtimeParameterSourceSkillIds: uniqueNumbers(
      bindings.flatMap(binding => binding.runtimeParameterSourceSkillIds ?? [])
    ),
    gapsWithRuntimeParameterSourceCandidates: bindings.filter(
      binding =>
        (numberOrNull(binding.runtimeParameterSourceCandidateCount) ?? 0) > 0
    ).length,
    runtimeApplicationTraceStatuses: uniqueStrings(
      bindings.flatMap(binding => binding.runtimeApplicationTraceStatuses ?? [])
    ),
    runtimeApplicationTraceChainCount: bindings.reduce(
      (sum, binding) =>
        sum + (numberOrNull(binding.runtimeApplicationTraceChainCount) ?? 0),
      0
    ),
    gapsWithRuntimeApplicationTraceEvidence: bindings.filter(
      binding =>
        (numberOrNull(binding.runtimeApplicationTraceChainCount) ?? 0) > 0
    ).length,
    runtimeMethodBodyStatuses: uniqueStrings(
      bindings.flatMap(binding => binding.runtimeMethodBodyStatuses ?? [])
    ),
    runtimeNativeMethodSymbolStatuses: uniqueStrings(
      bindings.flatMap(
        binding => binding.runtimeNativeMethodSymbolStatuses ?? []
      )
    ),
    runtimeNativeMethodSymbolCount: runtimeNativeMethodSymbolKeys.length,
    gapsWithRuntimeNativeMethodSymbols: bindings.filter(
      binding => (binding.runtimeNativeMethodSymbolKeys ?? []).length > 0
    ).length,
    runtimeNativeDisassemblyStatuses: uniqueStrings(
      bindings.flatMap(
        binding => binding.runtimeNativeDisassemblyStatuses ?? []
      )
    ),
    runtimeNativeDisassemblyFunctionCount:
      runtimeNativeDisassemblyFunctionKeys.length,
    gapsWithRuntimeNativeDisassembly: bindings.filter(
      binding => (binding.runtimeNativeDisassemblyFunctionKeys ?? []).length > 0
    ).length,
    runtimeSelfEnergyFormulaProbeStatuses: uniqueStrings(
      bindings.flatMap(
        binding => binding.runtimeSelfEnergyFormulaProbeStatuses ?? []
      )
    ),
    runtimeSelfEnergyFormulaProbeCandidateCount: bindings.reduce(
      (sum, binding) =>
        sum +
        (numberOrNull(binding.runtimeSelfEnergyFormulaProbeCandidateCount) ??
          0),
      0
    ),
    runtimeSelfEnergyFormulaProbeGateOpenCount: bindings.reduce(
      (sum, binding) =>
        sum +
        (numberOrNull(binding.runtimeSelfEnergyFormulaProbeGateOpenCount) ?? 0),
      0
    ),
    gapsWithRuntimeSelfEnergyFormulaProbe: bindings.filter(
      binding =>
        (numberOrNull(binding.runtimeSelfEnergyFormulaProbeCandidateCount) ??
          0) > 0
    ).length,
    runtimeSelfEnergySourceToArgsProbeStatuses: uniqueStrings(
      bindings.flatMap(
        binding => binding.runtimeSelfEnergySourceToArgsProbeStatuses ?? []
      )
    ),
    runtimeSelfEnergySourceToArgsProbeCandidateCount: bindings.reduce(
      (sum, binding) =>
        sum +
        (numberOrNull(
          binding.runtimeSelfEnergySourceToArgsProbeCandidateCount
        ) ?? 0),
      0
    ),
    runtimeSelfEnergySourceToArgsProbeGateOpenCount: bindings.reduce(
      (sum, binding) =>
        sum +
        (numberOrNull(
          binding.runtimeSelfEnergySourceToArgsProbeGateOpenCount
        ) ?? 0),
      0
    ),
    gapsWithRuntimeSelfEnergySourceToArgsProbe: bindings.filter(
      binding =>
        (numberOrNull(
          binding.runtimeSelfEnergySourceToArgsProbeCandidateCount
        ) ?? 0) > 0
    ).length,
    runtimeSelfEnergyModifierProbeStatuses: uniqueStrings(
      bindings.flatMap(
        binding => binding.runtimeSelfEnergyModifierProbeStatuses ?? []
      )
    ),
    runtimeSelfEnergyModifierProbeCandidateCount: bindings.reduce(
      (sum, binding) =>
        sum +
        (numberOrNull(binding.runtimeSelfEnergyModifierProbeCandidateCount) ??
          0),
      0
    ),
    runtimeSelfEnergyModifierProbeGateOpenCount: bindings.reduce(
      (sum, binding) =>
        sum +
        (numberOrNull(binding.runtimeSelfEnergyModifierProbeGateOpenCount) ??
          0),
      0
    ),
    gapsWithRuntimeSelfEnergyModifierProbe: bindings.filter(
      binding =>
        (numberOrNull(binding.runtimeSelfEnergyModifierProbeCandidateCount) ??
          0) > 0
    ).length,
    runtimeSelfEnergyOwnerShareIntervalProbeStatuses: uniqueStrings(
      bindings.flatMap(
        binding =>
          binding.runtimeSelfEnergyOwnerShareIntervalProbeStatuses ?? []
      )
    ),
    runtimeSelfEnergyOwnerShareIntervalProbeCandidateCount: bindings.reduce(
      (sum, binding) =>
        sum +
        (numberOrNull(
          binding.runtimeSelfEnergyOwnerShareIntervalProbeCandidateCount
        ) ?? 0),
      0
    ),
    runtimeSelfEnergyOwnerShareIntervalProbeGateOpenCount: bindings.reduce(
      (sum, binding) =>
        sum +
        (numberOrNull(
          binding.runtimeSelfEnergyOwnerShareIntervalProbeGateOpenCount
        ) ?? 0),
      0
    ),
    gapsWithRuntimeSelfEnergyOwnerShareIntervalProbe: bindings.filter(
      binding =>
        (numberOrNull(
          binding.runtimeSelfEnergyOwnerShareIntervalProbeCandidateCount
        ) ?? 0) > 0
    ).length,
    runtimeSelfEnergySamplingProbeStatuses: uniqueStrings(
      bindings.flatMap(
        binding => binding.runtimeSelfEnergySamplingProbeStatuses ?? []
      )
    ),
    runtimeSelfEnergySamplingProbeCandidateCount: bindings.reduce(
      (sum, binding) =>
        sum +
        (numberOrNull(binding.runtimeSelfEnergySamplingProbeCandidateCount) ??
          0),
      0
    ),
    runtimeSelfEnergySamplingProbeGateOpenCount: bindings.reduce(
      (sum, binding) =>
        sum +
        (numberOrNull(binding.runtimeSelfEnergySamplingProbeGateOpenCount) ??
          0),
      0
    ),
    gapsWithRuntimeSelfEnergySamplingProbe: bindings.filter(
      binding =>
        (numberOrNull(binding.runtimeSelfEnergySamplingProbeCandidateCount) ??
          0) > 0
    ).length,
    unresolved: uniqueStrings(
      bindings.flatMap(binding => binding.unresolved ?? [])
    ),
    applied: false,
  };
}

function createHitBindingGapElementSourceAlignment({
  actionLevelElementSource,
  matrixElementConfigIds,
  externalElementBinding,
}) {
  const actionLevelElementConfigIds = uniqueNumbers(
    actionLevelElementSource?.elementConfigIds ?? []
  );
  const matrixIds = uniqueNumbers(matrixElementConfigIds ?? []);
  const externalDamageElementConfigIds = uniqueNumbers(
    externalElementBinding?.damageElementConfigIds ?? []
  );
  const overlapElementConfigIds = intersectNumbers(
    actionLevelElementConfigIds,
    externalDamageElementConfigIds
  );
  const actionLevelOnlyElementConfigIds = differenceNumbers(
    actionLevelElementConfigIds,
    externalDamageElementConfigIds
  );
  const externalOnlyElementConfigIds = differenceNumbers(
    externalDamageElementConfigIds,
    actionLevelElementConfigIds
  );

  return {
    status: createElementSourceAlignmentStatus({
      actionLevelElementConfigIds,
      externalDamageElementConfigIds,
      overlapElementConfigIds,
    }),
    sourceKind: 'azpr-hit-binding-element-source-alignment',
    actionLevelSourceKind:
      actionLevelElementSource?.sourceKind ??
      'skill_logic.currentLevel.elementValues',
    actionLevelSourceTable:
      actionLevelElementSource?.skillsubEleValueTablePath ?? null,
    actionLevelSkillId: numberOrNull(actionLevelElementSource?.skillId),
    actionLevelSubSkillId: numberOrNull(actionLevelElementSource?.subSkillId),
    actionLevel: numberOrNull(actionLevelElementSource?.level),
    actionLevelSkillLevelRowId: numberOrNull(
      actionLevelElementSource?.skillLevelRowId
    ),
    actionLevelElementConfigIds,
    actionLevelRows: actionLevelElementSource?.rows ?? [],
    matrixElementConfigIds: matrixIds,
    externalSourceKind:
      externalElementBinding?.sourceKind ??
      'azpr-hit-binding-external-element-candidate',
    externalElementSourceKind: 'skill_control.elementBaseDatas',
    externalStateNames: externalElementBinding?.stateNames ?? [],
    externalSubSkillIds: externalElementBinding?.subSkillIds ?? [],
    externalHitEffects: externalElementBinding?.hitEffects ?? [],
    externalDamageElementConfigIds,
    externalDamageElementPathIds:
      externalElementBinding?.damageElementPathIds ?? [],
    overlapElementConfigIds,
    actionLevelOnlyElementConfigIds,
    externalOnlyElementConfigIds,
    actionLevelOnlyCount: actionLevelOnlyElementConfigIds.length,
    externalOnlyCount: externalOnlyElementConfigIds.length,
    overlapCount: overlapElementConfigIds.length,
    matrixMatchesActionLevel:
      differenceNumbers(matrixIds, actionLevelElementConfigIds).length === 0 &&
      differenceNumbers(actionLevelElementConfigIds, matrixIds).length === 0,
    externalSkillLevelBridgeStatuses:
      externalElementBinding?.skillLevelBridgeStatuses ?? [],
    finding: createElementSourceAlignmentFinding({
      actionLevelElementConfigIds,
      externalDamageElementConfigIds,
      overlapElementConfigIds,
    }),
    unresolved: uniqueStrings([
      'action-variant-element-selection-unconfirmed',
      'skill-control-subskill-to-skill-level-bridge-unconfirmed',
      ...((externalElementBinding?.skillLevelBridgeStatuses ?? []).includes(
        'skillsub-element-level-bridge-missing'
      )
        ? ['external-damage-element-level-bridge-missing']
        : []),
      'runtime-parameter-inheritance-or-override-unconfirmed',
    ]),
    applied: false,
  };
}

function createElementSourceAlignmentStatus({
  actionLevelElementConfigIds,
  externalDamageElementConfigIds,
  overlapElementConfigIds,
}) {
  if (externalDamageElementConfigIds.length === 0) {
    return 'external-damage-elements-missing';
  }
  if (actionLevelElementConfigIds.length === 0) {
    return 'action-level-elements-missing';
  }
  if (overlapElementConfigIds.length === 0) {
    return 'external-damage-elements-diverge-from-action-level-elements';
  }
  if (
    overlapElementConfigIds.length === actionLevelElementConfigIds.length &&
    overlapElementConfigIds.length === externalDamageElementConfigIds.length
  ) {
    return 'external-damage-elements-match-action-level-elements';
  }
  return 'external-damage-elements-partially-overlap-action-level-elements';
}

function createElementSourceAlignmentFinding({
  actionLevelElementConfigIds,
  externalDamageElementConfigIds,
  overlapElementConfigIds,
}) {
  if (externalDamageElementConfigIds.length === 0) {
    return 'skill-control-damage-element-candidates-missing';
  }
  if (actionLevelElementConfigIds.length === 0) {
    return 'action-level-skill-logic-element-values-missing';
  }
  if (overlapElementConfigIds.length === 0) {
    return 'skill-control-subskill-damage-element-not-in-action-level-values';
  }
  if (
    overlapElementConfigIds.length === actionLevelElementConfigIds.length &&
    overlapElementConfigIds.length === externalDamageElementConfigIds.length
  ) {
    return 'skill-control-damage-elements-match-action-level-values';
  }
  return 'skill-control-damage-elements-partially-overlap-action-level-values';
}

function createHitBindingGapElementSourceAlignmentSummary(gaps) {
  const alignments = gaps
    .map(gap => gap.elementSourceAlignment)
    .filter(Boolean);
  const divergent = alignments.filter(
    alignment =>
      alignment.status ===
      'external-damage-elements-diverge-from-action-level-elements'
  );
  const overlapping = alignments.filter(alignment =>
    [
      'external-damage-elements-match-action-level-elements',
      'external-damage-elements-partially-overlap-action-level-elements',
    ].includes(alignment.status)
  );
  const missing = alignments.filter(alignment =>
    [
      'external-damage-elements-missing',
      'action-level-elements-missing',
    ].includes(alignment.status)
  );

  return {
    status:
      gaps.length === 0
        ? 'no-hit-binding-gaps'
        : divergent.length === gaps.length
          ? 'all-candidate-gaps-have-action-level-external-element-divergence'
          : divergent.length > 0
            ? 'some-candidate-gaps-have-action-level-external-element-divergence'
            : overlapping.length === gaps.length
              ? 'all-candidate-gaps-overlap-action-level-elements'
              : missing.length > 0
                ? 'some-candidate-gaps-missing-element-source-alignment'
                : 'element-source-alignment-unclassified',
    gapCount: gaps.length,
    alignedGapCount: alignments.length,
    divergentGapCount: divergent.length,
    overlappingGapCount: overlapping.length,
    missingGapCount: missing.length,
    actionLevelElementConfigIds: uniqueNumbers(
      alignments.flatMap(alignment => alignment.actionLevelElementConfigIds)
    ),
    matrixElementConfigIds: uniqueNumbers(
      alignments.flatMap(alignment => alignment.matrixElementConfigIds)
    ),
    externalDamageElementConfigIds: uniqueNumbers(
      alignments.flatMap(alignment => alignment.externalDamageElementConfigIds)
    ),
    overlapElementConfigIds: uniqueNumbers(
      alignments.flatMap(alignment => alignment.overlapElementConfigIds)
    ),
    actionLevelOnlyElementConfigIds: uniqueNumbers(
      alignments.flatMap(alignment => alignment.actionLevelOnlyElementConfigIds)
    ),
    externalOnlyElementConfigIds: uniqueNumbers(
      alignments.flatMap(alignment => alignment.externalOnlyElementConfigIds)
    ),
    actionLevelSubSkillIds: uniqueNumbers(
      alignments.map(alignment => alignment.actionLevelSubSkillId)
    ),
    externalSubSkillIds: uniqueNumbers(
      alignments.flatMap(alignment => alignment.externalSubSkillIds)
    ),
    externalStateNames: uniqueStrings(
      alignments.flatMap(alignment => alignment.externalStateNames)
    ),
    externalHitEffects: uniqueStrings(
      alignments.flatMap(alignment => alignment.externalHitEffects)
    ),
    externalSkillLevelBridgeStatuses: uniqueStrings(
      alignments.flatMap(
        alignment => alignment.externalSkillLevelBridgeStatuses
      )
    ),
    findings: uniqueStrings(alignments.map(alignment => alignment.finding)),
    unresolved: uniqueStrings(
      alignments.flatMap(alignment => alignment.unresolved ?? [])
    ),
    applied: false,
  };
}

function uniqueElementRefsByPath(refs) {
  const byPath = new Map();
  for (const ref of refs ?? []) {
    const key = ref?.pathId == null ? null : String(ref.pathId);
    if (!key || byPath.has(key)) {
      continue;
    }
    byPath.set(key, ref);
  }
  return [...byPath.values()];
}

function uniqueCharacterSlotRefs(refs) {
  const byKey = new Map();
  for (const ref of refs ?? []) {
    const key = [
      ref?.characterId,
      ref?.characterName,
      ref?.group,
      ref?.slot,
    ].join('|');
    if (byKey.has(key)) {
      continue;
    }
    byKey.set(key, {
      characterId: numberOrNull(ref?.characterId),
      characterName: ref?.characterName ?? null,
      group: ref?.group ?? null,
      slot: numberOrNull(ref?.slot),
    });
  }
  return [...byKey.values()];
}

function collectFormulaFunctionOutputs(evidence) {
  return (evidence?.functionRefs ?? [])
    .map(ref => ref.elementFormulaRow?.functionOutput)
    .filter(value => value != null);
}

function intersectNumbers(left, right) {
  const rightSet = new Set(uniqueNumbers(right));
  return uniqueNumbers(left).filter(value => rightSet.has(value));
}

function differenceNumbers(left, right) {
  const rightSet = new Set(uniqueNumbers(right));
  return uniqueNumbers(left).filter(value => !rightSet.has(value));
}

function attachFormulaExecutionEvidenceMatrix(hpDamage, action, hitCandidates) {
  const sourceEvidence = hpDamage?.sourceEvidence;
  const formulaCandidatePreview = sourceEvidence?.formulaCandidatePreview;
  if (!sourceEvidence || !formulaCandidatePreview) {
    return hpDamage;
  }

  return {
    ...hpDamage,
    sourceEvidence: {
      ...sourceEvidence,
      formulaExecutionEvidenceMatrix: createFormulaExecutionEvidenceMatrix({
        action,
        sourceEvidence,
        formulaCandidatePreview,
        hitCandidates,
      }),
    },
  };
}

function createFormulaExecutionEvidenceMatrix({
  action,
  sourceEvidence,
  formulaCandidatePreview,
  hitCandidates,
}) {
  const rows = (sourceEvidence?.candidates ?? [])
    .map(candidate =>
      createFormulaExecutionEvidenceMatrixRow({
        action,
        candidate,
        formulaCandidatePreview,
        hitCandidates,
      })
    )
    .filter(Boolean);
  const unresolved = uniqueStrings(rows.flatMap(row => row.unresolved ?? []));
  const rowsWithLargeDifference = rows.filter(
    row => row.perHitScaleGap?.differenceStatus === 'large-difference'
  ).length;
  const rowsWithSlotOverrideCandidates = rows.filter(
    row => row.slotOverrideCandidates.length > 0
  ).length;
  const rowsWithHitBindings = rows.filter(
    row => row.hitIndexes.length > 0
  ).length;

  return {
    status:
      rows.length > 0
        ? 'evidence-matrix-built-execution-unconfirmed'
        : 'no-formula-execution-evidence',
    actionId: action?.id ?? null,
    actionName: action?.name ?? null,
    actionType: action?.type ?? null,
    actorId: action?.actorId ?? null,
    actorName: action?.actor?.name ?? null,
    skillId: numberOrNull(action?.skillId),
    actionVariantIndex: numberOrNull(sourceEvidence?.actionVariantIndex),
    actionVariantLabel: sourceEvidence?.actionVariantLabel ?? null,
    hitCount:
      numberOrNull(formulaCandidatePreview?.rawProjection?.hitCount) ??
      hitCandidates.length,
    elementCount: uniqueNumbers(rows.map(row => row.elementConfigId)).length,
    rowCount: rows.length,
    preferredStrategy: PREFERRED_FORMULA_CANDIDATE_STRATEGY,
    rows,
    diagnostics: {
      functionCombinationOrderStatus: 'unconfirmed',
      levelOverrideApplicationStatus: 'unconfirmed',
      perHitMultiplierAllocationStatus: 'unconfirmed',
      rowsWithLargeDifference,
      rowsWithSlotOverrideCandidates,
      rowsWithHitBindings,
      unresolved,
      note: 'Function order, level-value override point and per-hit multiplier allocation remain unconfirmed.',
    },
    unresolved,
    applied: false,
    note: 'DamageElement execution matrix is evidence-only and must not be used as the final HP/toughness/energy formula until runtime execution is confirmed.',
  };
}

function createFormulaExecutionEvidenceMatrixRow({
  action,
  candidate,
  formulaCandidatePreview,
  hitCandidates,
}) {
  const elementConfigId = numberOrNull(candidate.elementConfigId);
  if (!Number.isFinite(elementConfigId)) {
    return null;
  }

  const functionOrderCandidates = prioritizeFormulaExecutionCandidates(
    (formulaCandidatePreview.combinationPreviews ?? [])
      .filter(preview => Number(preview.elementConfigId) === elementConfigId)
      .map(compactFormulaExecutionCombinationCandidate)
  );
  const preferredFunctionOrderCandidate =
    selectComparableFormulaExecutionCandidate(functionOrderCandidates);
  const slotSummaries =
    candidate.skillLevelBridge?.formulaSlotAlignment?.parameterSummaries ?? [];
  const slotOverrideCandidates = slotSummaries
    .filter(
      summary => summary.relationStatus === 'level-scaling-override-candidate'
    )
    .map(compactFormulaExecutionSlotSummary);
  const directSlotMatches = slotSummaries
    .filter(summary => summary.relationStatus === 'constant-direct-slot-match')
    .map(compactFormulaExecutionSlotSummary);
  const hitIndexes = collectFormulaExecutionHitIndexes(
    hitCandidates,
    elementConfigId
  );

  return {
    actionId: action?.id ?? null,
    actionName: action?.name ?? null,
    actionVariantLabel:
      action?.selectedActionVariant?.label ??
      action?.selectedDamageSegment?.label ??
      null,
    skillId: numberOrNull(action?.skillId),
    elementConfigId,
    pathId: candidate.pathId ?? null,
    hitIndexes,
    hitBindingStatus:
      hitIndexes.length > 0
        ? 'per-hit-candidate-bound'
        : 'per-hit-candidate-not-found',
    functionOrderCandidates,
    preferredFunctionOrderCandidate,
    slotOverrideCandidates,
    directSlotMatches,
    perHitScaleGap: createFormulaExecutionPerHitScaleGap({
      preferredFunctionOrderCandidate,
      hitIndexes,
    }),
    unresolved: [
      'function-combination-order-unconfirmed',
      'level-override-application-point-unconfirmed',
      'per-hit-multiplier-allocation-unconfirmed',
    ],
    applied: false,
  };
}

function prioritizeFormulaExecutionCandidates(candidates) {
  return [...candidates].sort((left, right) => {
    const preferredDelta =
      Number(right.strategy === PREFERRED_FORMULA_CANDIDATE_STRATEGY) -
      Number(left.strategy === PREFERRED_FORMULA_CANDIDATE_STRATEGY);
    if (preferredDelta !== 0) {
      return preferredDelta;
    }

    const comparableDelta =
      Number(right.comparisonStatus === 'compared-to-raw-projection') -
      Number(left.comparisonStatus === 'compared-to-raw-projection');
    if (comparableDelta !== 0) {
      return comparableDelta;
    }

    return String(left.strategy).localeCompare(String(right.strategy));
  });
}

function compactFormulaExecutionCombinationCandidate(preview) {
  const comparison = preview.comparison ?? {};
  return {
    strategy: preview.strategy ?? null,
    expression: preview.expression ?? null,
    inputSource: preview.inputSource ?? null,
    functionValues: Object.fromEntries(
      Object.entries(preview.functionValues ?? {}).map(([key, value]) => [
        key,
        numberOrNull(value),
      ])
    ),
    value: numberOrNull(preview.value),
    roundedValue: numberOrNull(preview.roundedValue),
    hitCount: numberOrNull(preview.hitCount),
    comparisonStatus: comparison.status ?? null,
    rawProjectionValue: numberOrNull(comparison.rawProjectionValue),
    previewRoundedValue: numberOrNull(comparison.previewRoundedValue),
    ratioToRawProjection: numberOrNull(comparison.ratioToRawProjection),
    requiredScaleToRaw: numberOrNull(comparison.requiredScaleToRaw),
    requiredPerHitScaleToRaw: numberOrNull(comparison.requiredPerHitScaleToRaw),
    differenceStatus: comparison.differenceStatus ?? null,
    status: preview.status ?? null,
    applied: preview.applied === true,
  };
}

function selectComparableFormulaExecutionCandidate(candidates) {
  return (
    candidates.find(
      candidate =>
        candidate.strategy === PREFERRED_FORMULA_CANDIDATE_STRATEGY &&
        candidate.comparisonStatus === 'compared-to-raw-projection'
    ) ??
    candidates.find(
      candidate => candidate.comparisonStatus === 'compared-to-raw-projection'
    ) ??
    null
  );
}

function compactFormulaExecutionSlotSummary(summary) {
  return {
    id: numberOrNull(summary.id),
    variable: summary.variable ?? null,
    relationStatus: summary.relationStatus ?? null,
    formulaParamValue: numberOrNull(summary.formulaParamValue),
    firstLevelValue: numberOrNull(summary.firstLevelValue),
    lastLevelValue: numberOrNull(summary.lastLevelValue),
    minValue: numberOrNull(summary.minValue),
    maxValue: numberOrNull(summary.maxValue),
    levelRows: numberOrNull(summary.levelRows) ?? 0,
    progression: summary.progression
      ? {
          status: summary.progression.status ?? null,
          step: numberOrNull(summary.progression.step),
          isArithmetic: summary.progression.isArithmetic === true,
        }
      : null,
    applied: false,
  };
}

function collectFormulaExecutionHitIndexes(hitCandidates, elementConfigId) {
  return uniqueNumbers(
    (hitCandidates ?? [])
      .filter(hitCandidate =>
        (hitCandidate.candidates ?? []).some(
          candidate => Number(candidate.elementConfigId) === elementConfigId
        )
      )
      .map(hitCandidate => hitCandidate.hitIndex)
  );
}

function createFormulaExecutionPerHitScaleGap({
  preferredFunctionOrderCandidate,
  hitIndexes,
}) {
  if (!preferredFunctionOrderCandidate) {
    return {
      status: 'no-comparable-function-order-candidate',
      hitCount: hitIndexes.length,
      boundHitCount: hitIndexes.length,
      applied: false,
    };
  }

  return {
    status: Number.isFinite(preferredFunctionOrderCandidate.requiredScaleToRaw)
      ? 'requires-runtime-scale-or-hit-allocation'
      : 'missing-comparable-scale',
    rawProjectionValue: preferredFunctionOrderCandidate.rawProjectionValue,
    previewRoundedValue: preferredFunctionOrderCandidate.previewRoundedValue,
    ratioToRawProjection: preferredFunctionOrderCandidate.ratioToRawProjection,
    requiredScaleToRaw: preferredFunctionOrderCandidate.requiredScaleToRaw,
    requiredPerHitScaleToRaw:
      preferredFunctionOrderCandidate.requiredPerHitScaleToRaw,
    hitCount: preferredFunctionOrderCandidate.hitCount ?? hitIndexes.length,
    boundHitCount: hitIndexes.length,
    differenceStatus: preferredFunctionOrderCandidate.differenceStatus,
    applied: false,
  };
}

function compactDamageFieldPatternValues(damageFields = {}) {
  return {
    amp: numberOrNull(damageFields.amp),
    physicalRatio: numberOrNull(damageFields.physicalRatio),
    elementCalFactor: numberOrNull(damageFields.elementCalFactor),
    formulaParamsCount: Array.isArray(damageFields.formulaParams)
      ? damageFields.formulaParams.length
      : 0,
  };
}

function createSkillControlBehaviorCorrelations(actionSummaries) {
  const skillIds = uniqueNumbers(actionSummaries.map(item => item.skillId));
  return skillIds.map(skillId =>
    createSkillControlBehaviorCorrelation(
      skillId,
      actionSummaries.filter(item => Number(item.skillId) === Number(skillId))
    )
  );
}

function createSkillControlBehaviorCorrelation(skillId, actionSummaries = []) {
  const evidence = CURRENT_SKILL_CONTROL_EVIDENCE_BY_SKILL_ID.get(
    Number(skillId)
  );
  if (!evidence) {
    return {
      status: 'no-skill-control-evidence',
      scope: 'skill-level',
      skillId: numberOrNull(skillId),
      correlationStatus: 'skill-control-evidence-missing',
      applied: false,
    };
  }

  if (evidence.status !== 'found') {
    return {
      status: evidence.status ?? 'skill-control-evidence-unavailable',
      scope: 'skill-level',
      skillId: numberOrNull(skillId),
      characterId: numberOrNull(evidence.characterId),
      skillName: evidence.skillName ?? null,
      expectedDirectory: evidence.expectedDirectory ?? null,
      correlationStatus: 'skill-control-evidence-missing',
      applied: false,
    };
  }

  const hpLaneCandidates =
    evidence.effectLaneCandidatesByLane?.hpDamage ??
    (evidence.effectLaneCandidates ?? []).filter(chain =>
      (chain.laneHints ?? []).includes('hpDamage')
    );
  const hpBehaviorChains = (
    evidence.effectLaneBehaviorChainsByLane?.hpDamage ??
    evidence.effectLaneBehaviorChains ??
    []
  ).filter(chain => (chain.laneHints ?? []).includes('hpDamage'));
  const actionVariantBindingCandidates = createActionVariantBindingCandidates(
    actionSummaries,
    hpBehaviorChains,
    Number(skillId)
  );
  const actionVariantBindingSummary = summarizeActionVariantBindings(
    actionVariantBindingCandidates
  );
  const stateTimingEvidence = compactSkillStateTimingEvidence(
    evidence.stateTimingEvidence
  );
  const sampledResolvedHpBehaviors = hpBehaviorChains.flatMap(chain =>
    (chain.resolvedBehaviors ?? []).map(behavior => ({
      ...behavior,
      sourceName: chain.sourceName ?? null,
      sourceStartFrame: numberOrNull(chain.sourceStartFrame),
      sourceEndFrame: numberOrNull(chain.sourceEndFrame),
    }))
  );
  const resourceBindings = summarizeSkillControlResourceBindings(
    sampledResolvedHpBehaviors
  );

  return {
    status:
      (evidence.effectLaneCandidateSummary?.hpDamage?.count ?? 0) > 0
        ? 'skill-level-hp-behavior-candidates-found'
        : 'skill-level-hp-behavior-candidates-missing',
    sourceKind: 'azpr-skill-control-behavior-chain-evidence',
    file: SKILL_ASSET_EVIDENCE_PATH,
    scope: 'skill-level-not-action-variant-bound',
    skillId: numberOrNull(skillId),
    characterId: numberOrNull(evidence.characterId),
    skillName: evidence.skillName ?? null,
    hpLaneCandidateCount:
      numberOrNull(evidence.effectLaneCandidateSummary?.hpDamage?.count) ?? 0,
    behaviorListRefCount:
      numberOrNull(evidence.behaviorReferenceSummary?.behaviorListRefs) ?? 0,
    resolvedBehaviorListRefCount:
      numberOrNull(
        evidence.behaviorReferenceSummary?.resolvedBehaviorListRefs
      ) ?? 0,
    resolvedHpBehaviorRefCount:
      numberOrNull(
        evidence.behaviorReferenceSummary?.resolvedBehaviorRefsByLane?.hpDamage
      ) ?? 0,
    scriptTypeCandidateBehaviorRefCount:
      numberOrNull(
        evidence.behaviorReferenceSummary?.scriptTypeCandidateBehaviorRefs
      ) ?? 0,
    externalElementBaseRefCount:
      numberOrNull(
        evidence.behaviorReferenceSummary?.externalElementBaseRefs
      ) ?? 0,
    resourceMapMatchedElementBaseRefCount:
      numberOrNull(
        evidence.behaviorReferenceSummary?.resourceMapMatchedElementBaseRefs
      ) ?? 0,
    resourceMapUnmatchedElementBaseRefCount:
      numberOrNull(
        evidence.behaviorReferenceSummary?.resourceMapUnmatchedElementBaseRefs
      ) ?? 0,
    sampledHpBehaviorChainCount: hpBehaviorChains.length,
    sampledHpLaneCandidateCount: hpLaneCandidates.length,
    sampledResolvedHpBehaviorCount: sampledResolvedHpBehaviors.length,
    stateTimingEvidence,
    actionVariantBindingSummary,
    actionVariantBindingCandidates,
    hitFrameStartFrames: uniqueNumbers(
      sampledResolvedHpBehaviors.map(behavior => behavior.startFrame)
    ),
    hitFrameWindows: createSkillControlHitFrameWindows(hpBehaviorChains),
    resourceBindings,
    sampledBehaviorChains: hpBehaviorChains
      .slice(0, 5)
      .map(compactSkillControlBehaviorChain),
    correlationStatus: 'skill-level-only-action-variant-binding-unresolved',
    actionVariantBindingStatus:
      actionVariantBindingSummary.boundCandidateCount > 0
        ? 'action-variant-binding-candidates-generated-unconfirmed'
        : 'action-variant-binding-candidates-missing',
    stateTimingEvidenceStatus:
      stateTimingEvidence?.status ?? 'state-timing-evidence-missing',
    applied: false,
    note: 'Skill control behavior evidence is linked at skill level only; action-variant and per-hit runtime binding remain unconfirmed.',
  };
}

function createActionVariantBindingCandidates(
  actionSummaries,
  hpBehaviorChains,
  skillId
) {
  const compactChains = hpBehaviorChains.map(compactBehaviorChainForBinding);
  return actionSummaries.map(actionSummary => {
    const candidates = compactChains
      .map(chain =>
        scoreBehaviorChainForActionVariant(actionSummary, chain, skillId)
      )
      .filter(candidate => candidate.score > 0)
      .sort(compareActionVariantBindingCandidates)
      .slice(0, 5);

    return {
      actionId: actionSummary.actionId,
      actionVariantIndex: actionSummary.actionVariantIndex,
      actionVariantLabel: actionSummary.actionVariantLabel,
      rawMultiplier: actionSummary.rawMultiplier,
      status:
        candidates.length > 0
          ? 'action-variant-binding-candidates-found'
          : 'action-variant-binding-candidates-missing',
      confidence: candidates[0]?.confidence ?? 'none',
      candidateCount: candidates.length,
      candidates,
      applied: false,
    };
  });
}

function summarizeActionVariantBindings(bindings) {
  const bound = bindings.filter(item => item.candidateCount > 0);
  return {
    actionVariantCount: bindings.length,
    boundCandidateCount: bound.length,
    confidenceLevels: uniqueStrings(bound.map(item => item.confidence)),
    statuses: uniqueStrings(bindings.map(item => item.status)),
  };
}

function compactBehaviorChainForBinding(chain) {
  const resolvedBehaviors = chain.resolvedBehaviors ?? [];
  const refs = resolvedBehaviors.flatMap(
    behavior => behavior.elementBaseDataRefs ?? []
  );
  const matches = refs.flatMap(ref => ref.resourceMapMatches ?? []);

  return {
    sourceName: chain.sourceName ?? null,
    sourceTrackName: chain.sourceTrackName ?? null,
    sourceStartFrame: numberOrNull(chain.sourceStartFrame),
    sourceEndFrame: numberOrNull(chain.sourceEndFrame),
    behaviorStartFrames: uniqueNumbers(
      resolvedBehaviors.map(behavior => behavior.startFrame)
    ),
    behaviorFrameCounts: uniqueNumbers(
      resolvedBehaviors.map(behavior => behavior.frameCount)
    ),
    resolvedBehaviorPathIds: uniqueStrings(
      resolvedBehaviors.map(behavior => behavior.pathId)
    ),
    scriptClassNames: uniqueStrings(
      resolvedBehaviors.map(behavior => behavior.scriptTypeCandidate?.className)
    ),
    elementBaseRefCount: refs.length,
    subSkillIds: uniqueNumbers(matches.flatMap(match => match.subSkillIds)),
    stateNames: uniqueStrings(matches.flatMap(match => match.stateNames)),
    hitEffects: uniqueStrings(matches.flatMap(match => match.hitEffects)),
    elementRoundedPathIds: uniqueStrings(refs.map(ref => ref.roundedPathId)),
    elementPathIds: uniqueStrings(refs.map(ref => ref.pathId)),
  };
}

function scoreBehaviorChainForActionVariant(actionSummary, chain, skillId) {
  const label = normalizeBindingText(actionSummary.actionVariantLabel);
  const sourceName = normalizeBindingText(chain.sourceName);
  const isNormalAction = label === '普攻' || label === '普通攻击';
  const isExplicitNormalChain = sourceName.includes('普通');
  const expectedDerivedSubSkillId = Number.isFinite(skillId)
    ? skillId * 10 + 1
    : null;
  let score = 0;
  const reasons = [];

  if (isNormalAction && isExplicitNormalChain) {
    score += 60;
    reasons.push('normal-action-name-match');
  }
  if (
    isNormalAction &&
    (chain.stateNames.includes('Skill0_1') ||
      chain.subSkillIds.includes(Number(skillId)))
  ) {
    score += 35;
    reasons.push('normal-action-state-or-subskill-match');
  }
  if (!isNormalAction && !isExplicitNormalChain) {
    score += 20;
    reasons.push('non-normal-shared-chain-name-candidate');
  }
  if (
    !isNormalAction &&
    (chain.stateNames.includes('Skill0_6') ||
      chain.subSkillIds.includes(expectedDerivedSubSkillId))
  ) {
    score += 35;
    reasons.push('non-normal-shared-state-or-derived-subskill-candidate');
  }
  if (chain.scriptClassNames.includes('InjectToTargetKeyFrameBehaviorData')) {
    score += 10;
    reasons.push('inject-to-target-keyframe-behavior');
  }
  if (chain.elementBaseRefCount > 0) {
    score += 5;
    reasons.push('element-base-data-linked');
  }

  return {
    ...chain,
    score,
    confidence: createActionVariantBindingConfidence(score),
    bindingStatus: createActionVariantBindingStatus({
      isNormalAction,
      isExplicitNormalChain,
      score,
    }),
    reasons,
    applied: false,
  };
}

function createActionVariantBindingConfidence(score) {
  if (score >= 90) {
    return 'medium';
  }
  if (score >= 60) {
    return 'low';
  }
  if (score > 0) {
    return 'weak';
  }
  return 'none';
}

function createActionVariantBindingStatus({
  isNormalAction,
  isExplicitNormalChain,
  score,
}) {
  if (score <= 0) {
    return 'not-a-candidate';
  }
  if (isNormalAction && isExplicitNormalChain) {
    return 'normal-action-name-state-candidate-unconfirmed';
  }
  return 'shared-action-family-candidate-unconfirmed';
}

function compareActionVariantBindingCandidates(left, right) {
  return (
    right.score - left.score ||
    (left.sourceStartFrame ?? 0) - (right.sourceStartFrame ?? 0) ||
    String(left.sourceName).localeCompare(String(right.sourceName))
  );
}

function normalizeBindingText(value) {
  return String(value ?? '').trim();
}

function summarizeSkillControlResourceBindings(behaviors) {
  const refs = behaviors.flatMap(
    behavior => behavior.elementBaseDataRefs ?? []
  );
  const matches = refs.flatMap(ref => ref.resourceMapMatches ?? []);

  return {
    sampledElementBaseRefCount: refs.length,
    sampledMatchedElementBaseRefCount: refs.filter(
      ref => (ref.resourceMapMatchCount ?? 0) > 0
    ).length,
    subSkillIds: uniqueNumbers(matches.flatMap(match => match.subSkillIds)),
    stateNames: uniqueStrings(matches.flatMap(match => match.stateNames)),
    effects: uniqueStrings(matches.flatMap(match => match.effects)),
    hitEffects: uniqueStrings(matches.flatMap(match => match.hitEffects)),
    elementRoundedPathIds: uniqueStrings(refs.map(ref => ref.roundedPathId)),
    elementPathIds: uniqueStrings(refs.map(ref => ref.pathId)),
  };
}

function compactSkillStateTimingEvidence(evidence) {
  if (!evidence) {
    return null;
  }
  return {
    status: evidence.status ?? 'state-timing-evidence-missing',
    scope: evidence.scope ?? 'skill-level-action-state-candidates',
    bindingStatus:
      evidence.bindingStatus ?? 'state-timing-evidence-candidates-unconfirmed',
    hpStateWindowCount: numberOrNull(evidence.hpStateWindowCount) ?? 0,
    timingControlChainCount:
      numberOrNull(evidence.timingControlChainCount) ?? 0,
    animationStateControlCount:
      numberOrNull(evidence.animationStateControlCount) ?? 0,
    eventBridgeControlCount:
      numberOrNull(evidence.eventBridgeControlCount) ?? 0,
    hpStateNames: evidence.hpStateNames ?? [],
    animationStateNames: evidence.animationStateNames ?? [],
    eventBridgeSkillIds: evidence.eventBridgeSkillIds ?? [],
    eventBridgeTypes: evidence.eventBridgeTypes ?? [],
    eventBridgeValues: evidence.eventBridgeValues ?? [],
    eventBridgeTargetSkillControlEvidence:
      compactEventBridgeTargetSkillControlEvidence(
        evidence.eventBridgeTargetSkillControlEvidence
      ),
    stateFindings: (evidence.stateFindings ?? []).slice(0, 6).map(item => ({
      stateName: item.stateName ?? null,
      status: item.status ?? null,
      hpWindowCount: numberOrNull(item.hpWindowCount) ?? 0,
      hpStartFrames: item.hpStartFrames ?? [],
      subSkillIds: item.subSkillIds ?? [],
      hitEffects: item.hitEffects ?? [],
      animationControlCount: numberOrNull(item.animationControlCount) ?? 0,
      animationFrameWindows: (item.animationFrameWindows ?? [])
        .slice(0, 3)
        .map(window => ({
          sourceName: window.sourceName ?? null,
          sourceStartFrame: numberOrNull(window.sourceStartFrame),
          sourceEndFrame: numberOrNull(window.sourceEndFrame),
          aniStartFrame: numberOrNull(window.aniStartFrame),
          aniEndFrame: numberOrNull(window.aniEndFrame),
          aniLength: numberOrNull(window.aniLength),
        })),
      overlappingEventBridgeCount:
        numberOrNull(item.overlappingEventBridgeCount) ?? 0,
      overlappingEventBridgeNames: item.overlappingEventBridgeNames ?? [],
      applied: false,
    })),
    animationStateControls: (evidence.animationStateControls ?? [])
      .slice(0, 4)
      .map(item => ({
        sourceName: item.sourceName ?? null,
        sourceStartFrame: numberOrNull(item.sourceStartFrame),
        sourceEndFrame: numberOrNull(item.sourceEndFrame),
        selectedStateName: item.selectedStateName ?? null,
        behaviorStartFrame: numberOrNull(item.behaviorStartFrame),
        behaviorFrameCount: numberOrNull(item.behaviorFrameCount),
        timelineGroupIndex: numberOrNull(item.timelineGroupIndex),
        aniLength: numberOrNull(item.aniLength),
        aniStartFrame: numberOrNull(item.aniStartFrame),
        aniEndFrame: numberOrNull(item.aniEndFrame),
      })),
    eventBridgeControls: (evidence.eventBridgeControls ?? [])
      .slice(0, 5)
      .map(item => ({
        sourceName: item.sourceName ?? null,
        sourceStartFrame: numberOrNull(item.sourceStartFrame),
        sourceEndFrame: numberOrNull(item.sourceEndFrame),
        skillId: numberOrNull(item.skillId),
        bridge: numberOrNull(item.bridge),
        type: numberOrNull(item.type),
        frameIndex: numberOrNull(item.frameIndex),
        allowAttack: numberOrNull(item.allowAttack),
        allowMove: numberOrNull(item.allowMove),
        allowJump: numberOrNull(item.allowJump),
        allowDodge: numberOrNull(item.allowDodge),
        allowedInputs: item.allowedInputs ?? [],
      })),
    applied: false,
  };
}

function compactEventBridgeTargetSkillControlEvidence(evidence) {
  if (!evidence) {
    return null;
  }
  return {
    status: evidence.status ?? 'event-bridge-target-skill-controls-missing',
    directTargetSkillIds: evidence.directTargetSkillIds ?? [],
    targetSkillIds: evidence.targetSkillIds ?? [],
    targetSkillControlCount:
      numberOrNull(evidence.targetSkillControlCount) ?? 0,
    foundTargetSkillControlCount:
      numberOrNull(evidence.foundTargetSkillControlCount) ?? 0,
    missingTargetSkillControlCount:
      numberOrNull(evidence.missingTargetSkillControlCount) ?? 0,
    childSkillTargetIds: evidence.childSkillTargetIds ?? [],
    chainDepthMax: numberOrNull(evidence.chainDepthMax),
    targetAnimationStateNames: evidence.targetAnimationStateNames ?? [],
    targetHpTrackNames: evidence.targetHpTrackNames ?? [],
    normalAttackChainCandidate: evidence.normalAttackChainCandidate
      ? {
          status: evidence.normalAttackChainCandidate.status ?? null,
          chainSkillIds:
            evidence.normalAttackChainCandidate.chainSkillIds ?? [],
          chainLength:
            numberOrNull(evidence.normalAttackChainCandidate.chainLength) ?? 0,
          animationStateNames:
            evidence.normalAttackChainCandidate.animationStateNames ?? [],
          hpTimelineCandidateCount:
            numberOrNull(
              evidence.normalAttackChainCandidate.hpTimelineCandidateCount
            ) ?? 0,
          hpTrackNames: evidence.normalAttackChainCandidate.hpTrackNames ?? [],
          bridgeTargetSkillIds:
            evidence.normalAttackChainCandidate.bridgeTargetSkillIds ?? [],
          applied: false,
        }
      : null,
    normalAttackHitChainCandidate: evidence.normalAttackHitChainCandidate
      ? compactNormalAttackHitChainCandidate(
          evidence.normalAttackHitChainCandidate
        )
      : null,
    targetSkillControls: (evidence.targetSkillControls ?? [])
      .slice(0, 6)
      .map(item => ({
        skillId: numberOrNull(item.skillId),
        status: item.status ?? null,
        skillTableStatus: item.skillTableStatus ?? null,
        parentSkill: numberOrNull(item.parentSkill),
        relationToSourceSkill: item.relationToSourceSkill ?? null,
        discoveryDepth: numberOrNull(item.discoveryDepth),
        discoveredFromSkillId: numberOrNull(item.discoveredFromSkillId),
        animationStateControlCount:
          numberOrNull(item.animationStateControlCount) ?? 0,
        animationStateNames: item.animationStateNames ?? [],
        hpTimelineCandidateCount:
          numberOrNull(item.hpTimelineCandidateCount) ?? 0,
        hpTimelineCandidates: (item.hpTimelineCandidates ?? [])
          .slice(0, 4)
          .map(candidate => ({
            name: candidate.name ?? null,
            trackName: candidate.trackName ?? null,
            startFrame: numberOrNull(candidate.startFrame),
            endFrame: numberOrNull(candidate.endFrame),
          })),
        eventBridgeSkillIds: item.eventBridgeSkillIds ?? [],
      })),
    applied: false,
  };
}

function compactNormalAttackHitChainCandidate(candidate) {
  return {
    status: candidate.status ?? null,
    bindingStatus: candidate.bindingStatus ?? null,
    expectedHitCount: numberOrNull(candidate.expectedHitCount),
    expectedHitCountSource: candidate.expectedHitCountSource ?? null,
    descriptionSectionTitle: candidate.descriptionSectionTitle ?? null,
    candidateHitGroupCount: numberOrNull(candidate.candidateHitGroupCount) ?? 0,
    coverageStatus: candidate.coverageStatus ?? null,
    chainSkillIds: candidate.chainSkillIds ?? [],
    animationStateNames: candidate.animationStateNames ?? [],
    hpTimelineCandidateCount:
      numberOrNull(candidate.hpTimelineCandidateCount) ?? 0,
    hpTrackNames: candidate.hpTrackNames ?? [],
    damageElementFieldMappingStatus:
      candidate.damageElementFieldMappingStatus ?? null,
    damageElementMappedHitGroupCount:
      numberOrNull(candidate.damageElementMappedHitGroupCount) ?? 0,
    damageElementFieldMappingCount:
      numberOrNull(candidate.damageElementFieldMappingCount) ?? 0,
    damageElementElementConfigIds:
      candidate.damageElementElementConfigIds ?? [],
    damageElementPathIds: candidate.damageElementPathIds ?? [],
    hitGroups: (candidate.hitGroups ?? []).slice(0, 6).map(group => ({
      hitIndex: numberOrNull(group.hitIndex),
      label: group.label ?? null,
      candidateSource: group.candidateSource ?? null,
      skillId: numberOrNull(group.skillId),
      discoveryDepth: numberOrNull(group.discoveryDepth),
      discoveredFromSkillId: numberOrNull(group.discoveredFromSkillId),
      animationStateNames: group.animationStateNames ?? [],
      hpTimelineCandidateCount:
        numberOrNull(group.hpTimelineCandidateCount) ?? 0,
      candidateCountStatus: group.candidateCountStatus ?? null,
      hpFrameStartFrames: group.hpFrameStartFrames ?? [],
      hpTrackNames: group.hpTrackNames ?? [],
      subSkillIds: group.subSkillIds ?? [],
      hitEffects: group.hitEffects ?? [],
      behaviorChainCandidateCount:
        numberOrNull(group.behaviorChainCandidateCount) ?? 0,
      resolvedBehaviorCount: numberOrNull(group.resolvedBehaviorCount) ?? 0,
      externalElementBaseRefCount:
        numberOrNull(group.externalElementBaseRefCount) ?? 0,
      resourceMapMatchedElementBaseRefCount:
        numberOrNull(group.resourceMapMatchedElementBaseRefCount) ?? 0,
      resourceMapUnmatchedElementBaseRefCount:
        numberOrNull(group.resourceMapUnmatchedElementBaseRefCount) ?? 0,
      externalElementObjectReferenceCount:
        numberOrNull(group.externalElementObjectReferenceCount) ?? 0,
      externalElementObjectReferences: (
        group.externalElementObjectReferences ?? []
      )
        .slice(0, 8)
        .map(compactNormalAttackExternalElementObjectReference),
      elementBaseDataRefs: (group.elementBaseDataRefs ?? [])
        .slice(0, 12)
        .map(compactNormalAttackHitElementBaseDataRef),
      damageElementFieldMappingStatus:
        group.damageElementFieldMappingStatus ?? null,
      damageElementFieldMappingCount:
        numberOrNull(group.damageElementFieldMappingCount) ?? 0,
      damageElementElementConfigIds: group.damageElementElementConfigIds ?? [],
      damageElementPathIds: group.damageElementPathIds ?? [],
      damageElementFieldMappings: (group.damageElementFieldMappings ?? [])
        .slice(0, 6)
        .map(compactNormalAttackHitDamageElementFieldMapping),
      confidence: group.confidence ?? null,
      bindingStatus: group.bindingStatus ?? null,
      hpTimelineCandidates: (group.hpTimelineCandidates ?? [])
        .slice(0, 12)
        .map(item => ({
          name: item.name ?? null,
          trackName: item.trackName ?? null,
          startFrame: numberOrNull(item.startFrame),
          endFrame: numberOrNull(item.endFrame),
          stateNames: item.stateNames ?? [],
          subSkillIds: item.subSkillIds ?? [],
          hitEffects: item.hitEffects ?? [],
        })),
      applied: false,
    })),
    applied: false,
  };
}

function compactNormalAttackExternalElementObjectReference(ref) {
  return {
    elementConfigId: numberOrNull(ref.elementConfigId),
    pathId: ref.pathId ?? null,
    roundedPathId: ref.roundedPathId ?? null,
    status: ref.status ?? null,
    scriptTypeClassName: ref.scriptTypeClassName ?? null,
    inferredRole: ref.inferredRole ?? null,
    formulaParamBuffReferenceIds: ref.formulaParamBuffReferenceIds ?? [],
    summonFields: ref.summonFields
      ? {
          summonUnitId: numberOrNull(ref.summonFields.summonUnitId),
          summonLifeTime: numberOrNull(ref.summonFields.summonLifeTime),
          summonCount: numberOrNull(ref.summonFields.summonCount),
          summonTotalMaxCount: numberOrNull(
            ref.summonFields.summonTotalMaxCount
          ),
        }
      : null,
    summonTargetSkillEvidence: ref.summonTargetSkillEvidence
      ? {
          status: ref.summonTargetSkillEvidence.status ?? null,
          summonUnitId: numberOrNull(
            ref.summonTargetSkillEvidence.summonUnitId
          ),
          relationStatus: ref.summonTargetSkillEvidence.relationStatus ?? null,
          targetSkillIds: ref.summonTargetSkillEvidence.targetSkillIds ?? [],
          damageElementObjectCount:
            numberOrNull(
              ref.summonTargetSkillEvidence.damageElementObjectCount
            ) ?? 0,
          damageElementConfigIds:
            ref.summonTargetSkillEvidence.damageElementConfigIds ?? [],
          applied: ref.summonTargetSkillEvidence.applied === true,
          calculationBoundary:
            ref.summonTargetSkillEvidence.calculationBoundary ?? null,
        }
      : null,
    applied: false,
  };
}

function compactNormalAttackHitElementBaseDataRef(ref) {
  return {
    fileId: numberOrNull(ref.fileId),
    pathId: ref.pathId ?? null,
    roundedPathId: ref.roundedPathId ?? null,
    status: ref.status ?? null,
    resourceMapMatchCount: numberOrNull(ref.resourceMapMatchCount) ?? 0,
    resourceMapMatches: (ref.resourceMapMatches ?? [])
      .slice(0, 3)
      .map(match => ({
        stateNames: match.stateNames ?? [],
        subSkillIds: match.subSkillIds ?? [],
        hitEffects: match.hitEffects ?? [],
      })),
  };
}

function compactNormalAttackHitDamageElementFieldMapping(mapping) {
  return {
    elementConfigId: numberOrNull(mapping.elementConfigId),
    pathId: mapping.pathId ?? null,
    elementName: mapping.elementName ?? null,
    scriptTypeCandidate: mapping.scriptTypeCandidate
      ? {
          status: mapping.scriptTypeCandidate.status,
          confidence: mapping.scriptTypeCandidate.confidence,
          className: mapping.scriptTypeCandidate.className,
        }
      : null,
    hpDamage: {
      status: mapping.hpDamage?.status ?? null,
      formulaFunctionIds: mapping.hpDamage?.formulaFunctionIds ?? {},
      formulaFunctionStatus: mapping.hpDamage?.formulaFunctionStatus ?? null,
      formulaFunctionMatchedIds:
        mapping.hpDamage?.formulaFunctionMatchedIds ?? [],
      formulaFunctionEvidence: compactFormulaFunctionEvidence(
        mapping.hpDamage?.formulaFunctionEvidence
      ),
      rawFormulaParamValues: mapping.hpDamage?.rawFormulaParamValues ?? [],
      damageFields: compactDamageFieldPatternValues(
        mapping.hpDamage?.damageFields
      ),
    },
    toughnessDamage: {
      status: mapping.toughnessDamage?.status ?? null,
      weakBreakDamageRate: numberOrNull(
        mapping.toughnessDamage?.weakBreakDamageRate
      ),
      hitType: numberOrNull(mapping.toughnessDamage?.hitType),
      interruptPriority: numberOrNull(
        mapping.toughnessDamage?.interruptPriority
      ),
      useOneBreak: numberOrNull(mapping.toughnessDamage?.useOneBreak),
    },
    selfEnergyChange: {
      status: mapping.selfEnergyChange?.status ?? null,
      recoverSP: numberOrNull(mapping.selfEnergyChange?.recoverSP),
      petRecoverSP: numberOrNull(mapping.selfEnergyChange?.petRecoverSP),
      recoverInterval: numberOrNull(mapping.selfEnergyChange?.recoverInterval),
      ownerScope: mapping.selfEnergyChange?.ownerScope ?? null,
    },
    skillLevelBridge: {
      status: mapping.skillLevelBridge?.status ?? null,
      source: mapping.skillLevelBridge?.source ?? null,
      levelRows: numberOrNull(mapping.skillLevelBridge?.levelRows) ?? 0,
      parameterIds: mapping.skillLevelBridge?.parameterIds ?? [],
      varyingParameterIds: mapping.skillLevelBridge?.varyingParameterIds ?? [],
      formulaSlotAlignment:
        mapping.skillLevelBridge?.formulaSlotAlignment ??
        compactFormulaSlotAlignment(
          mapping.skillLevelBridge?.formulaParamAlignment
        ),
      firstLevel: mapping.skillLevelBridge?.firstLevel
        ? {
            level: numberOrNull(mapping.skillLevelBridge.firstLevel.level),
            valueParam: mapping.skillLevelBridge.firstLevel.valueParam ?? null,
          }
        : null,
      lastLevel: mapping.skillLevelBridge?.lastLevel
        ? {
            level: numberOrNull(mapping.skillLevelBridge.lastLevel.level),
            valueParam: mapping.skillLevelBridge.lastLevel.valueParam ?? null,
          }
        : null,
      relatedElementLevelBridge: compactRelatedElementLevelBridge(
        mapping.skillLevelBridge?.relatedElementLevelBridge
      ),
    },
    applied: false,
  };
}

function createSkillControlHitFrameWindows(hpBehaviorChains) {
  return hpBehaviorChains
    .map(chain => ({
      sourceName: chain.sourceName ?? null,
      sourceStartFrame: numberOrNull(chain.sourceStartFrame),
      sourceEndFrame: numberOrNull(chain.sourceEndFrame),
      resolvedBehaviorCount: (chain.resolvedBehaviors ?? []).length,
      behaviorStartFrames: uniqueNumbers(
        (chain.resolvedBehaviors ?? []).map(behavior => behavior.startFrame)
      ),
      behaviorFrameCounts: uniqueNumbers(
        (chain.resolvedBehaviors ?? []).map(behavior => behavior.frameCount)
      ),
      elementBaseRefCount: (chain.resolvedBehaviors ?? []).reduce(
        (sum, behavior) => sum + (behavior.externalElementBaseRefCount ?? 0),
        0
      ),
    }))
    .sort(
      (left, right) =>
        (left.sourceStartFrame ?? 0) - (right.sourceStartFrame ?? 0) ||
        String(left.sourceName).localeCompare(String(right.sourceName))
    );
}

function compactSkillControlBehaviorChain(chain) {
  return {
    laneHints: chain.laneHints ?? [],
    sourceName: chain.sourceName ?? null,
    sourceStartFrame: numberOrNull(chain.sourceStartFrame),
    sourceEndFrame: numberOrNull(chain.sourceEndFrame),
    behaviorRefCount: (chain.behaviorRefs ?? []).length,
    resolvedBehaviorCount: (chain.resolvedBehaviors ?? []).length,
    resolvedBehaviors: (chain.resolvedBehaviors ?? [])
      .slice(0, 3)
      .map(compactSkillControlResolvedBehavior),
  };
}

function compactSkillControlResolvedBehavior(behavior) {
  const refs = behavior.elementBaseDataRefs ?? [];
  const matches = refs.flatMap(ref => ref.resourceMapMatches ?? []);
  return {
    pathId: behavior.pathId ?? null,
    scriptTypeCandidate: behavior.scriptTypeCandidate
      ? {
          status: behavior.scriptTypeCandidate.status,
          confidence: behavior.scriptTypeCandidate.confidence,
          className: behavior.scriptTypeCandidate.className,
        }
      : null,
    startFrame: numberOrNull(behavior.startFrame),
    frameCount: numberOrNull(behavior.frameCount),
    externalElementBaseRefCount:
      numberOrNull(behavior.externalElementBaseRefCount) ?? 0,
    resourceMapMatchedElementBaseRefCount:
      numberOrNull(behavior.resourceMapMatchedElementBaseRefCount) ?? 0,
    elementBaseDataRefs: refs.slice(0, 5).map(ref => ({
      pathId: ref.pathId ?? null,
      roundedPathId: ref.roundedPathId ?? null,
      resourceMapMatchCount: numberOrNull(ref.resourceMapMatchCount) ?? 0,
    })),
    resourceBindings: {
      subSkillIds: uniqueNumbers(matches.flatMap(match => match.subSkillIds)),
      stateNames: uniqueStrings(matches.flatMap(match => match.stateNames)),
      hitEffects: uniqueStrings(matches.flatMap(match => match.hitEffects)),
    },
  };
}

function compactSkillControlBehaviorCorrelationForAction(
  correlation,
  actionSummary
) {
  if (!correlation) {
    return null;
  }
  const bindingCandidate = correlation.actionVariantBindingCandidates?.find(
    item => item.actionId === actionSummary.actionId
  );
  const primaryBindingCandidates = (bindingCandidate?.candidates ?? []).filter(
    item => item.confidence === bindingCandidate.confidence
  );
  const bindingStateNames = uniqueStrings(
    primaryBindingCandidates.flatMap(item => item.stateNames ?? [])
  );
  const stateTimingFindings = (
    correlation.stateTimingEvidence?.stateFindings ?? []
  ).filter(item => bindingStateNames.includes(item.stateName));
  return {
    status: correlation.status,
    scope: correlation.scope,
    hpLaneCandidateCount: correlation.hpLaneCandidateCount ?? 0,
    resolvedHpBehaviorRefCount: correlation.resolvedHpBehaviorRefCount ?? 0,
    sampledHpBehaviorChainCount: correlation.sampledHpBehaviorChainCount ?? 0,
    hitFrameStartFrames: correlation.hitFrameStartFrames ?? [],
    stateNames: correlation.resourceBindings?.stateNames ?? [],
    hitEffects: correlation.resourceBindings?.hitEffects ?? [],
    correlationStatus: correlation.correlationStatus,
    actionVariantBindingStatus: correlation.actionVariantBindingStatus,
    stateTimingEvidenceStatus: correlation.stateTimingEvidenceStatus,
    stateTimingFindings,
    actionVariantBindingCandidate: bindingCandidate
      ? {
          status: bindingCandidate.status,
          confidence: bindingCandidate.confidence,
          candidateCount: bindingCandidate.candidateCount,
          candidates: (bindingCandidate.candidates ?? [])
            .slice(0, 3)
            .map(item => ({
              sourceName: item.sourceName,
              sourceStartFrame: item.sourceStartFrame,
              sourceEndFrame: item.sourceEndFrame,
              stateNames: item.stateNames,
              subSkillIds: item.subSkillIds,
              hitEffects: item.hitEffects,
              score: item.score,
              confidence: item.confidence,
              bindingStatus: item.bindingStatus,
              reasons: item.reasons,
            })),
        }
      : null,
    applied: false,
  };
}

function inferBehaviorCorrelationStatus(correlations) {
  if (correlations.length === 0) {
    return 'no-skill-control-correlation';
  }
  if (
    correlations.some(
      correlation =>
        correlation.status === 'skill-level-hp-behavior-candidates-found'
    )
  ) {
    return 'skill-level-behavior-candidates-found-action-binding-unresolved';
  }
  return 'skill-level-behavior-candidates-missing';
}

function inferMissingRuntimeScaleStatus({
  actionSummaries,
  actionMultiplierMin,
  actionMultiplierMax,
  uniquePreviewRoundedValues,
}) {
  if (actionSummaries.length < 2) {
    return 'needs-more-action-samples';
  }
  if (
    uniquePreviewRoundedValues.length <= 1 &&
    Number.isFinite(actionMultiplierMin) &&
    Number.isFinite(actionMultiplierMax) &&
    Math.abs(actionMultiplierMax - actionMultiplierMin) > 0.01
  ) {
    return 'tracks-description-multiplier-before-runtime-hit-mapping';
  }
  return 'needs-runtime-hit-node-correlation';
}

function createScaleSpreadStatus(values) {
  const min = minNumber(values);
  const max = maxNumber(values);
  if (!Number.isFinite(min) || !Number.isFinite(max) || values.length < 2) {
    return 'single-sample';
  }
  return Math.abs(max - min) > 0.1
    ? 'varies-by-action-variant'
    : 'stable-across-action-variants';
}

function finiteValues(values) {
  return values.map(numberOrNull).filter(Number.isFinite);
}

function minNumber(values) {
  const finite = finiteValues(values);
  return finite.length > 0 ? Math.min(...finite) : null;
}

function maxNumber(values) {
  const finite = finiteValues(values);
  return finite.length > 0 ? Math.max(...finite) : null;
}

function numberRange(min, max) {
  return Number.isFinite(min) && Number.isFinite(max) ? max - min : null;
}

function buildActionResultTimeline({
  scenario,
  damageEvents,
  resourceEvents,
  runtimeSampleContext = null,
  actionExecutionPlan = null,
  verifiedCombatRuntime = null,
}) {
  if (verifiedCombatRuntime?.ready) {
    return buildVerifiedActionResultTimeline({
      scenario,
      damageEvents,
      resourceEvents,
      runtimeSampleContext,
      actionExecutionPlan,
      verifiedCombatRuntime,
    });
  }
  const damageByActionId = groupEventsByActionId(damageEvents);
  const resourcesByActionId = groupEventsByActionId(resourceEvents);
  const executionByActionId = new Map(
    (actionExecutionPlan?.actions ?? []).map(entry => [entry.actionId, entry])
  );

  return scenario.actions
    .filter(action => executionByActionId.get(action.id)?.execute !== false)
    .map(action => {
      const executionEntry = executionByActionId.get(action.id) ?? null;
      const actionDamageEvents = damageByActionId.get(action.id) ?? [];
      const actionResourceEvents = resourcesByActionId.get(action.id) ?? [];
      const primaryDamageEvent = actionDamageEvents[0] ?? null;
      const damageElementSource = createActionDamageElementSource(action);
      const hitCandidateResult = createActionHitCandidateResult({
        action,
        damageElementSource,
      });
      const hitCandidates = hitCandidateResult.hitCandidates;
      const hpDamage = attachFormulaExecutionEvidenceMatrix(
        createHpDamageResult(action, primaryDamageEvent, damageElementSource),
        action,
        hitCandidates
      );

      return {
        actionId: action.id,
        actionType: action.type,
        actionName: action.name,
        timeMs: action.startMs,
        durationMs: action.durationMs,
        actorId: action.actorId ?? null,
        actorName: action.actor?.name ?? null,
        targetId: action.targetId ?? null,
        targetName: action.target?.name ?? null,
        skillId: action.skillId ?? null,
        executionStatus: executionEntry?.status ?? 'scheduled',
        readinessStatus: executionEntry?.readinessStatus ?? 'ready',
        executionPlanEntry: executionEntry,
        hpDamage,
        toughnessDamage: createToughnessDamageResult(
          action,
          primaryDamageEvent,
          damageElementSource
        ),
        selfEnergyChange: createSelfEnergyChangeResult(
          action,
          actionResourceEvents,
          damageElementSource,
          runtimeSampleContext
        ),
        hitCandidateSummary: summarizeActionHitCandidates(
          hitCandidates,
          hitCandidateResult.sequenceTimingEvidence
        ),
        hitCandidates,
        sourceEventTypes: [
          ...actionDamageEvents.map(event => event.type),
          ...actionResourceEvents.map(event => event.type),
        ],
      };
    });
}

function buildVerifiedActionResultTimeline({
  scenario,
  damageEvents,
  resourceEvents,
  runtimeSampleContext,
  actionExecutionPlan,
  verifiedCombatRuntime,
}) {
  const damageByActionId = groupEventsByActionId(damageEvents);
  const resourcesByActionId = groupEventsByActionId(resourceEvents);
  const executionByActionId = new Map(
    (actionExecutionPlan?.actions ?? []).map(entry => [entry.actionId, entry])
  );
  const rows = [];

  for (const action of scenario.actions ?? []) {
    const executionEntry = executionByActionId.get(action.id) ?? null;
    if (executionEntry?.execute === false) continue;
    const actionDamageEvents = damageByActionId.get(action.id) ?? [];
    const actionResourceEvents = resourcesByActionId.get(action.id) ?? [];
    const damageElementSource = createActionDamageElementSource(action);
    const resolution = verifiedCombatRuntime.actionResolutionById.get(
      action.id
    );

    for (const damageEvent of actionDamageEvents) {
      rows.push(
        createVerifiedActionResultEntry({
          action,
          executionEntry,
          damageEvent,
          damageElementSource,
          verifiedMechanicsStatus: resolution?.status ?? null,
        })
      );
    }
    for (const resourceEvent of actionResourceEvents) {
      rows.push(
        createVerifiedResourceResultEntry({
          action,
          executionEntry,
          resourceEvent,
          damageElementSource,
          runtimeSampleContext,
          verifiedMechanicsStatus: resolution?.status ?? null,
        })
      );
    }
    if (actionDamageEvents.length === 0 && actionResourceEvents.length === 0) {
      rows.push(
        createVerifiedEmptyActionResultEntry({
          action,
          executionEntry,
          verifiedMechanicsStatus:
            resolution?.status ?? 'verified-action-mechanics-unresolved',
        })
      );
    }
  }

  for (const resourceEvent of resourcesByActionId.get(null) ?? []) {
    const actor = (scenario.actors ?? []).find(
      item => item.id === resourceEvent.actorId
    );
    rows.push(
      createVerifiedResourceResultEntry({
        action: {
          id: null,
          type: ACTION_TYPES.RESOURCE,
          name: actor ? `${actor.name} 自动回能` : '自动回能',
          actorId: resourceEvent.actorId ?? null,
          actor,
          targetId: null,
          startMs: resourceEvent.timeMs,
          durationMs: 0,
          skillId: null,
        },
        executionEntry: null,
        resourceEvent,
        damageElementSource: null,
        runtimeSampleContext,
        verifiedMechanicsStatus: 'verified-auto-sp-runtime-event',
      })
    );
  }

  for (const damageEvent of damageByActionId.get(null) ?? []) {
    rows.push(
      createVerifiedActionResultEntry({
        action: {
          id: null,
          type: ACTION_TYPES.ENEMY_EVENT,
          name: damageEvent.payload?.segment?.label ?? '敌人韧性状态变化',
          actorId: damageEvent.actorId ?? null,
          actor: null,
          targetId: damageEvent.targetId ?? scenario.enemy?.id ?? null,
          target: scenario.enemy ?? null,
          startMs: damageEvent.timeMs,
          durationMs: 0,
          skillId: null,
        },
        executionEntry: null,
        damageEvent,
        damageElementSource: null,
        verifiedMechanicsStatus: 'verified-weakness-state-runtime-event',
      })
    );
  }

  return rows.sort(compareVerifiedActionResultEntries);
}

function createVerifiedActionResultEntry({
  action,
  executionEntry,
  damageEvent,
  damageElementSource,
  verifiedMechanicsStatus,
}) {
  return createVerifiedResultEntryBase({
    action,
    executionEntry,
    timeMs: damageEvent.timeMs,
    hitKey: damageEvent.hitKey ?? damageEvent.payload?.hitKey ?? null,
    hitIndex: damageEvent.hitIndex ?? damageEvent.payload?.hitIndex ?? null,
    hitSkillId: damageEvent.hitSkillId ?? null,
    elementId: damageEvent.payload?.elementId ?? null,
    runtimeSequenceIndex: damageEvent.runtimeSequenceIndex ?? null,
    verifiedMechanicsStatus,
    hpDamage: createHpDamageResult(action, damageEvent, damageElementSource),
    toughnessDamage: createToughnessDamageResult(
      action,
      damageEvent,
      damageElementSource
    ),
    selfEnergyChange: createVerifiedNotApplicableResult(
      'self-energy-change',
      'verified-hit-has-no-owner-resource-event'
    ),
    sourceEventTypes: [damageEvent.type],
  });
}

function createVerifiedResourceResultEntry({
  action,
  executionEntry,
  resourceEvent,
  damageElementSource,
  runtimeSampleContext,
  verifiedMechanicsStatus,
}) {
  const actorId = resourceEvent.actorId ?? action.actorId ?? null;
  const actorName =
    resourceEvent.payload?.actorName ??
    (actorId === action.actorId ? action.actor?.name : null);
  return {
    ...createVerifiedResultEntryBase({
      action,
      executionEntry,
      timeMs: resourceEvent.timeMs,
      hitKey: resourceEvent.hitKey ?? null,
      hitIndex: resourceEvent.hitIndex ?? null,
      hitSkillId: resourceEvent.hitSkillId ?? null,
      elementId: resourceEvent.payload?.elementId ?? null,
      runtimeSequenceIndex: resourceEvent.runtimeSequenceIndex ?? null,
      verifiedMechanicsStatus,
      hpDamage: createVerifiedNotApplicableResult(
        'hp-damage',
        'verified-resource-event-only'
      ),
      toughnessDamage: createVerifiedNotApplicableResult(
        'toughness-damage',
        'verified-resource-event-only'
      ),
      selfEnergyChange: createSelfEnergyChangeResult(
        action,
        [resourceEvent],
        damageElementSource,
        runtimeSampleContext
      ),
      sourceEventTypes: [resourceEvent.type],
    }),
    actorId,
    actorName,
    runtimeSequenceIndex: resourceEvent.runtimeSequenceIndex ?? null,
  };
}

function createVerifiedEmptyActionResultEntry({
  action,
  executionEntry,
  verifiedMechanicsStatus,
}) {
  return createVerifiedResultEntryBase({
    action,
    executionEntry,
    timeMs: action.startMs,
    hitKey: 'verified-unresolved',
    hitIndex: null,
    hitSkillId: null,
    elementId: null,
    verifiedMechanicsStatus,
    hpDamage: createVerifiedNotApplicableResult(
      'hp-damage',
      verifiedMechanicsStatus
    ),
    toughnessDamage: createVerifiedNotApplicableResult(
      'toughness-damage',
      verifiedMechanicsStatus
    ),
    selfEnergyChange: createVerifiedNotApplicableResult(
      'self-energy-change',
      verifiedMechanicsStatus
    ),
    sourceEventTypes: [],
  });
}

function createVerifiedResultEntryBase({
  action,
  executionEntry,
  timeMs,
  hitKey,
  hitIndex,
  hitSkillId,
  elementId,
  runtimeSequenceIndex = null,
  verifiedMechanicsStatus,
  hpDamage,
  toughnessDamage,
  selfEnergyChange,
  sourceEventTypes,
}) {
  return {
    actionId: action.id,
    actionType: action.type,
    actionName: action.name,
    timeMs,
    durationMs: action.durationMs,
    actorId: action.actorId ?? null,
    actorName: action.actor?.name ?? null,
    targetId: action.targetId ?? null,
    targetName: action.target?.name ?? null,
    skillId: action.skillId ?? null,
    hitKey,
    hitIndex,
    hitSkillId,
    elementId,
    runtimeSequenceIndex,
    executionStatus: executionEntry?.status ?? 'scheduled',
    readinessStatus: executionEntry?.readinessStatus ?? 'ready',
    executionPlanEntry: executionEntry,
    verifiedMechanicsStatus,
    hpDamage,
    toughnessDamage,
    selfEnergyChange,
    hitCandidateSummary: summarizeActionHitCandidates([], null),
    hitCandidates: [],
    sourceEventTypes,
  };
}

function createVerifiedNotApplicableResult(kind, status) {
  return {
    value: 0,
    applied: false,
    status,
    precision: 'verified-unapplied',
    confidence: 'verified',
    formulaBreakdown: createNotApplicableBreakdown({
      kind,
      status,
      reason: 'No verified event for this track at this frame.',
    }),
    sourceEvidence: null,
  };
}

function compareVerifiedActionResultEntries(left, right) {
  return (
    Number(left.timeMs) - Number(right.timeMs) ||
    Number(left.runtimeSequenceIndex ?? Number.MAX_SAFE_INTEGER) -
      Number(right.runtimeSequenceIndex ?? Number.MAX_SAFE_INTEGER) ||
    String(left.actionId ?? '').localeCompare(String(right.actionId ?? '')) ||
    Number(left.hitIndex ?? 0) - Number(right.hitIndex ?? 0) ||
    String(left.hitKey ?? '').localeCompare(String(right.hitKey ?? '')) ||
    String(left.actorId ?? '').localeCompare(String(right.actorId ?? ''))
  );
}

function createActionHitCandidateResult({ action, damageElementSource }) {
  if (!isNormalAttackAction(action)) {
    return {
      hitCandidates: [],
      sequenceTimingEvidence: null,
    };
  }

  const hitChain = getActionNormalAttackHitChainCandidate(action);
  if (!hitChain?.hitGroups?.length) {
    return {
      hitCandidates: [],
      sequenceTimingEvidence: null,
    };
  }
  const sequenceTimingEvidence = createNormalAttackSequenceTimingEvidence(
    action,
    hitChain
  );

  return {
    sequenceTimingEvidence,
    hitCandidates: hitChain.hitGroups.map(hitGroup =>
      createHitCandidatePreview({
        action,
        hitGroup,
        damageElementSource,
        hitChain,
        sequenceTimingEvidence,
      })
    ),
  };
}

function isNormalAttackAction(action) {
  if (!isSkillAction(action)) {
    return false;
  }

  const hitModel = action.selectedActionVariant?.hitModel;
  const label =
    action.selectedActionVariant?.label ??
    action.selectedDamageSegment?.label ??
    action.name;
  return (
    hitModel?.kind === 'normal-attack' ||
    normalizeBindingText(label) === '普攻' ||
    normalizeBindingText(label) === '普通攻击'
  );
}

function getActionNormalAttackHitChainCandidate(action) {
  const evidence = CURRENT_SKILL_CONTROL_EVIDENCE_BY_SKILL_ID.get(
    Number(action.skillId)
  );
  return (
    evidence?.stateTimingEvidence?.eventBridgeTargetSkillControlEvidence
      ?.normalAttackHitChainCandidate ?? null
  );
}

function createNormalAttackSequenceTimingEvidence(action, hitChain) {
  const sourceSkillId = numberOrNull(action.skillId);
  const evidence = CURRENT_SKILL_CONTROL_EVIDENCE_BY_SKILL_ID.get(
    Number(sourceSkillId)
  );
  const stateTimingEvidence = evidence?.stateTimingEvidence ?? null;
  const targetEvidence =
    stateTimingEvidence?.eventBridgeTargetSkillControlEvidence ?? null;
  const hitGroups = [...(hitChain.hitGroups ?? [])].sort(
    (left, right) => Number(left.hitIndex) - Number(right.hitIndex)
  );
  if (!sourceSkillId || hitGroups.length === 0 || !stateTimingEvidence) {
    return {
      status: 'normal-attack-sequence-timing-missing',
      sourceKind: 'azpr-normal-attack-sequence-timing-candidate',
      frameRate: AZPR_TIMELINE_FRAME_RATE,
      transitionCount: Math.max(0, hitGroups.length - 1),
      resolvedTransitionCount: 0,
      hitTimingCount: 0,
      hitTimings: [],
      transitions: [],
      applied: false,
    };
  }

  const controlsBySkillId = createSkillTimingControlsBySkillId({
    sourceSkillId,
    stateTimingEvidence,
    targetSkillControls: targetEvidence?.targetSkillControls ?? [],
  });
  const chainStartFrames = new Map([[sourceSkillId, 0]]);
  const transitions = [];

  for (let index = 1; index < hitGroups.length; index += 1) {
    const previousSkillId = numberOrNull(hitGroups[index - 1].skillId);
    const skillId = numberOrNull(hitGroups[index].skillId);
    const previousStartFrame = chainStartFrames.get(previousSkillId);
    const transition = findNormalAttackSequenceTransition({
      fromSkillId: previousSkillId,
      toSkillId: skillId,
      controlsBySkillId,
    });
    const chainStartFrame =
      Number.isFinite(previousStartFrame) && transition
        ? previousStartFrame + transition.bridgeStartFrame
        : null;

    if (Number.isFinite(chainStartFrame)) {
      chainStartFrames.set(skillId, chainStartFrame);
    }

    transitions.push({
      fromSkillId: previousSkillId,
      toSkillId: skillId,
      status: transition
        ? 'event-bridge-target-transition-found'
        : 'event-bridge-target-transition-missing',
      bridgeStartFrame: transition?.bridgeStartFrame ?? null,
      bridgeFrameIndex: transition?.bridgeFrameIndex ?? null,
      bridgeEndFrame: transition?.bridgeEndFrame ?? null,
      sourceBehaviorFrameCount: transition?.sourceBehaviorFrameCount ?? null,
      allowedInputs: transition?.allowedInputs ?? [],
      chainStartFrame,
      applied: false,
    });
  }

  const hitTimings = hitGroups.map(hitGroup => {
    const skillId = numberOrNull(hitGroup.skillId);
    const localFrameStartFrames = uniqueNumbers(
      hitGroup.hpFrameStartFrames ?? []
    );
    const localPrimaryFrame = localFrameStartFrames[0] ?? null;
    const chainStartFrame = chainStartFrames.get(skillId);
    const absoluteFrameStartFrames = Number.isFinite(chainStartFrame)
      ? localFrameStartFrames.map(frame => chainStartFrame + frame)
      : [];
    const absolutePrimaryFrame =
      Number.isFinite(chainStartFrame) && Number.isFinite(localPrimaryFrame)
        ? chainStartFrame + localPrimaryFrame
        : null;
    const animationSummary = summarizeSequenceAnimationControls(
      controlsBySkillId.get(skillId)?.animationStateControls ?? []
    );

    return {
      hitIndex: numberOrNull(hitGroup.hitIndex),
      skillId,
      status: Number.isFinite(absolutePrimaryFrame)
        ? 'absolute-hit-frame-candidate-found'
        : 'absolute-hit-frame-candidate-missing',
      chainStartFrame: Number.isFinite(chainStartFrame)
        ? chainStartFrame
        : null,
      localPrimaryFrame,
      localFrameStartFrames,
      absolutePrimaryFrame,
      absoluteFrameStartFrames,
      absoluteCandidateTimeMs: Number.isFinite(absolutePrimaryFrame)
        ? roundTimelineMs(
            action.startMs + frameToTimelineMs(absolutePrimaryFrame)
          )
        : null,
      animationStateNames: hitGroup.animationStateNames ?? [],
      animationControlCount: animationSummary.animationControlCount,
      animationFrameStartMin: animationSummary.animationFrameStartMin,
      animationFrameEndMax: animationSummary.animationFrameEndMax,
      applied: false,
    };
  });
  const resolvedTransitionCount = transitions.filter(
    transition => transition.status === 'event-bridge-target-transition-found'
  ).length;
  const absoluteFrames = hitTimings
    .map(hitTiming => hitTiming.absolutePrimaryFrame)
    .filter(Number.isFinite);

  return {
    status:
      resolvedTransitionCount === Math.max(0, hitGroups.length - 1) &&
      absoluteFrames.length === hitGroups.length
        ? 'normal-attack-sequence-absolute-frame-candidates-found'
        : resolvedTransitionCount > 0
          ? 'normal-attack-sequence-absolute-frame-candidates-partial'
          : 'normal-attack-sequence-absolute-frame-candidates-missing',
    sourceKind: 'azpr-normal-attack-sequence-timing-candidate',
    frameRate: AZPR_TIMELINE_FRAME_RATE,
    sourceSkillId,
    transitionCount: Math.max(0, hitGroups.length - 1),
    resolvedTransitionCount,
    hitTimingCount: hitTimings.length,
    absoluteFrameStatus: isStrictlyIncreasing(absoluteFrames)
      ? 'absolute-hit-frames-strictly-increasing'
      : 'absolute-hit-frames-not-strictly-increasing',
    absolutePrimaryFrames: absoluteFrames,
    transitions,
    hitTimings,
    applied: false,
  };
}

function createSkillTimingControlsBySkillId({
  sourceSkillId,
  stateTimingEvidence,
  targetSkillControls,
}) {
  const controlsBySkillId = new Map();
  controlsBySkillId.set(sourceSkillId, {
    skillId: sourceSkillId,
    animationStateControls: stateTimingEvidence.animationStateControls ?? [],
    eventBridgeControls: stateTimingEvidence.eventBridgeControls ?? [],
  });
  for (const target of targetSkillControls ?? []) {
    const skillId = numberOrNull(target.skillId);
    if (!Number.isFinite(skillId)) {
      continue;
    }
    controlsBySkillId.set(skillId, {
      skillId,
      animationStateControls: target.animationStateControls ?? [],
      eventBridgeControls: target.eventBridgeControls ?? [],
    });
  }
  return controlsBySkillId;
}

function findNormalAttackSequenceTransition({
  fromSkillId,
  toSkillId,
  controlsBySkillId,
}) {
  if (!Number.isFinite(fromSkillId) || !Number.isFinite(toSkillId)) {
    return null;
  }
  const controls =
    controlsBySkillId.get(fromSkillId)?.eventBridgeControls ?? [];
  const candidates = controls
    .filter(control => numberOrNull(control.skillId) === toSkillId)
    .map(control => ({
      bridgeStartFrame: numberOrNull(
        control.behaviorStartFrame ?? control.sourceStartFrame
      ),
      bridgeFrameIndex: numberOrNull(control.frameIndex) ?? 0,
      sourceBehaviorFrameCount: numberOrNull(control.behaviorFrameCount),
      allowedInputs: control.allowedInputs ?? [],
      bridgeEndFrame:
        numberOrNull(control.behaviorStartFrame ?? control.sourceStartFrame) !=
          null && numberOrNull(control.behaviorFrameCount) != null
          ? numberOrNull(
              control.behaviorStartFrame ?? control.sourceStartFrame
            ) + numberOrNull(control.behaviorFrameCount)
          : null,
    }))
    .filter(candidate => Number.isFinite(candidate.bridgeStartFrame))
    .sort((left, right) => left.bridgeStartFrame - right.bridgeStartFrame);

  return candidates[0] ?? null;
}

function summarizeSequenceAnimationControls(animationStateControls) {
  const starts = (animationStateControls ?? [])
    .map(control =>
      numberOrNull(
        control.behaviorStartFrame ??
          control.sourceStartFrame ??
          control.aniStartFrame
      )
    )
    .filter(Number.isFinite);
  const ends = (animationStateControls ?? [])
    .map(control => {
      const start = numberOrNull(
        control.behaviorStartFrame ??
          control.sourceStartFrame ??
          control.aniStartFrame
      );
      const frameCount = numberOrNull(
        control.behaviorFrameCount ?? control.aniLength
      );
      const explicitEnd = numberOrNull(
        control.sourceEndFrame ?? control.aniEndFrame
      );
      if (Number.isFinite(start) && Number.isFinite(frameCount)) {
        return start + frameCount;
      }
      return explicitEnd;
    })
    .filter(Number.isFinite);

  return {
    animationControlCount: animationStateControls?.length ?? 0,
    animationFrameStartMin: minNumber(starts),
    animationFrameEndMax: maxNumber(ends),
  };
}

function isStrictlyIncreasing(values) {
  if (values.length <= 1) {
    return values.length === 1;
  }
  return values.every(
    (value, index) => index === 0 || value > values[index - 1]
  );
}

function createHitCandidatePreview({
  action,
  hitGroup,
  damageElementSource,
  hitChain,
  sequenceTimingEvidence,
}) {
  const directMappings = hitGroup.damageElementFieldMappings ?? [];
  const summonTargetResult =
    createSummonTargetHitCandidateMappingResult(hitGroup);
  const mappings = [...directMappings, ...summonTargetResult.mappings];
  const actionLevelCandidateByElementId = new Map(
    (damageElementSource?.candidates ?? [])
      .map(candidate => [Number(candidate.elementConfigId), candidate])
      .filter(([elementConfigId]) => Number.isFinite(elementConfigId))
  );
  const mergedMappings = mappings.map(mapping =>
    mergeHitCandidateMappingEvidence(
      mapping,
      actionLevelCandidateByElementId.get(Number(mapping.elementConfigId))
    )
  );
  const frameStartFrames = uniqueNumbers(hitGroup.hpFrameStartFrames ?? []);
  const primaryFrame = frameStartFrames[0] ?? null;
  const localCandidateTimeMs =
    primaryFrame == null
      ? null
      : roundTimelineMs(action.startMs + frameToTimelineMs(primaryFrame));
  const hitTiming = (sequenceTimingEvidence?.hitTimings ?? []).find(
    timing => Number(timing.hitIndex) === Number(hitGroup.hitIndex)
  );
  const absolutePrimaryFrame = numberOrNull(hitTiming?.absolutePrimaryFrame);
  const absoluteCandidateTimeMs = numberOrNull(
    hitTiming?.absoluteCandidateTimeMs
  );
  const candidateTimeMs = Number.isFinite(absoluteCandidateTimeMs)
    ? absoluteCandidateTimeMs
    : localCandidateTimeMs;
  const actionLevelMatchedElementIds =
    damageElementSource?.matchedElementConfigIds ?? [];
  const actionLevelElementMatchCount = directMappings.filter(mapping =>
    actionLevelMatchedElementIds.includes(Number(mapping.elementConfigId))
  ).length;
  const resourceMapElementRefCount =
    numberOrNull(hitGroup.resourceMapElementRefCount) ?? 0;
  const formulaParamBuffReferenceCount =
    numberOrNull(hitGroup.formulaParamBuffReferenceCount) ?? 0;
  const hasResourceMapElementRefs =
    resourceMapElementRefCount > 0 ||
    (numberOrNull(hitGroup.resourceMapMatchedElementBaseRefCount) ?? 0) > 0;

  return {
    sourceKind: 'azpr-normal-attack-per-hit-damage-element-candidate',
    file: SKILL_ASSET_EVIDENCE_PATH,
    actionId: action.id,
    actionName: action.name,
    actionVariantIndex: numberOrNull(
      action.actionVariantIndex ?? action.damageSegmentIndex
    ),
    actionVariantLabel:
      action.selectedActionVariant?.label ??
      action.selectedDamageSegment?.label ??
      null,
    skillId: numberOrNull(action.skillId),
    expectedHitCount: numberOrNull(hitChain.expectedHitCount),
    hitIndex: numberOrNull(hitGroup.hitIndex),
    label: hitGroup.label ?? null,
    candidateSource: hitGroup.candidateSource ?? null,
    hitSkillId: numberOrNull(hitGroup.skillId),
    animationStateNames: hitGroup.animationStateNames ?? [],
    frameRate: AZPR_TIMELINE_FRAME_RATE,
    frameStartFrames,
    primaryFrame,
    localCandidateTimeMs,
    absolutePrimaryFrame,
    absoluteFrameStartFrames: hitTiming?.absoluteFrameStartFrames ?? [],
    absoluteCandidateTimeMs,
    chainStartFrame: numberOrNull(hitTiming?.chainStartFrame),
    sequenceTimingStatus: hitTiming?.status ?? null,
    sequenceTimingSourceStatus: sequenceTimingEvidence?.status ?? null,
    timeMsCandidates: frameStartFrames.map(frame =>
      roundTimelineMs(action.startMs + frameToTimelineMs(frame))
    ),
    candidateTimeMs,
    hpTimelineCandidateCount:
      numberOrNull(hitGroup.hpTimelineCandidateCount) ?? 0,
    behaviorChainCandidateCount:
      numberOrNull(hitGroup.behaviorChainCandidateCount) ?? 0,
    resolvedBehaviorCount: numberOrNull(hitGroup.resolvedBehaviorCount) ?? 0,
    externalElementBaseRefCount:
      numberOrNull(hitGroup.externalElementBaseRefCount) ?? 0,
    resourceMapElementRefCount,
    resourceMapMatchedElementBaseRefCount:
      numberOrNull(hitGroup.resourceMapMatchedElementBaseRefCount) ?? 0,
    resourceMapUnmatchedElementBaseRefCount:
      numberOrNull(hitGroup.resourceMapUnmatchedElementBaseRefCount) ?? 0,
    externalElementObjectReferenceCount:
      numberOrNull(hitGroup.externalElementObjectReferenceCount) ?? 0,
    formulaParamBuffReferenceCount,
    formulaParamBuffReferenceIds: hitGroup.formulaParamBuffReferenceIds ?? [],
    hasFormulaParamBuffReferences: formulaParamBuffReferenceCount > 0,
    formulaParamBuffReferences: hitGroup.formulaParamBuffReferences ?? [],
    damageElementFieldMappingStatus:
      createHitCandidateDamageElementMappingStatus({
        hitGroup,
        directMappingCount: directMappings.length,
        summonTargetMappingCount: summonTargetResult.mappings.length,
      }),
    damageElementFieldMappingCount: mappings.length,
    directDamageElementFieldMappingCount: directMappings.length,
    summonTargetDamageElementFieldMappingCount:
      summonTargetResult.mappings.length,
    summonTargetEvidenceSummary: summonTargetResult.summary,
    actionLevelElementMatchCount,
    actionLevelElementMatchStatus:
      actionLevelElementMatchCount > 0
        ? 'some-hit-elements-bridge-to-action-element-values'
        : summonTargetResult.mappings.length > 0
          ? 'summon-target-elements-not-bridged-to-action-element-values'
          : 'hit-elements-not-bridged-to-action-element-values',
    damageElementElementConfigIds: uniqueNumbers(
      mappings.map(mapping => mapping.elementConfigId)
    ),
    hpDamage: summarizeHitCandidateHpDamage(mergedMappings),
    toughnessDamage: summarizeHitCandidateToughnessDamage(mergedMappings),
    selfEnergyChange: summarizeHitCandidateSelfEnergyChange(mergedMappings),
    candidates: mergedMappings.map(compactHitCandidateDamageElementMapping),
    sequenceTiming: hitTiming
      ? {
          status: hitTiming.status,
          chainStartFrame: hitTiming.chainStartFrame,
          localPrimaryFrame: hitTiming.localPrimaryFrame,
          absolutePrimaryFrame: hitTiming.absolutePrimaryFrame,
          localFrameStartFrames: hitTiming.localFrameStartFrames,
          absoluteFrameStartFrames: hitTiming.absoluteFrameStartFrames,
          absoluteCandidateTimeMs: hitTiming.absoluteCandidateTimeMs,
          animationControlCount: hitTiming.animationControlCount,
          animationFrameStartMin: hitTiming.animationFrameStartMin,
          animationFrameEndMax: hitTiming.animationFrameEndMax,
          applied: false,
        }
      : null,
    status:
      mappings.length > 0
        ? directMappings.length === 0 && summonTargetResult.mappings.length > 0
          ? 'per-hit-summon-target-candidate-fields-found-trigger-unconfirmed'
          : summonTargetResult.mappings.length > 0
            ? 'per-hit-candidate-and-summon-target-fields-found-formula-unapplied'
            : 'per-hit-candidate-fields-found-formula-unapplied'
        : formulaParamBuffReferenceCount > 0
          ? 'per-hit-buff-reference-found-fields-missing'
          : hasResourceMapElementRefs
            ? 'per-hit-resource-map-elements-found-fields-missing'
            : 'per-hit-candidate-fields-missing',
    unresolved: [
      'damage-element-execution-order',
      'multi-candidate-combination-rule',
      'per-hit-scale-or-hit-count-weight',
      'enemy-defense-and-resistance-application',
      'self-energy-owner-and-interval-rule',
      ...(summonTargetResult.mappings.length > 0
        ? [
            'summon-target-trigger-frame-unconfirmed',
            'summon-target-hit-count-unconfirmed',
            'summon-target-runtime-ownership-unconfirmed',
          ]
        : []),
    ],
    applied: false,
  };
}

function createHitCandidateDamageElementMappingStatus({
  hitGroup,
  directMappingCount,
  summonTargetMappingCount,
}) {
  if (directMappingCount > 0 && summonTargetMappingCount > 0) {
    return 'direct-and-summon-target-damage-element-fields-found';
  }
  if (summonTargetMappingCount > 0) {
    return 'summon-target-damage-element-fields-found-trigger-unconfirmed';
  }
  return hitGroup.damageElementFieldMappingStatus ?? null;
}

function createSummonTargetHitCandidateMappingResult(hitGroup) {
  const summonRefs = (hitGroup.externalElementObjectReferences ?? []).filter(
    ref => ref.summonTargetSkillEvidence
  );
  const mappings = [];
  const summaries = [];

  for (const ref of summonRefs) {
    const target = findSummonTargetEvidence(ref);
    const compactSummary = ref.summonTargetSkillEvidence;
    if (!target) {
      continue;
    }

    summaries.push({
      status: compactSummary?.status ?? target.status ?? null,
      summonUnitId:
        numberOrNull(compactSummary?.summonUnitId) ??
        numberOrNull(target.summonUnitId),
      sourceElementConfigId: numberOrNull(ref.elementConfigId),
      sourcePathId: ref.pathId ?? null,
      targetSkillIds:
        compactSummary?.targetSkillIds ?? target.targetSkillIds ?? [],
      damageElementConfigIds:
        compactSummary?.damageElementConfigIds ??
        target.damageElementConfigIds ??
        [],
      triggerFrameCandidateSummaries: (target.targetSkills ?? [])
        .map(createSummonTargetSkillControlFrameSummary)
        .filter(Boolean),
      calculationBoundary:
        compactSummary?.calculationBoundary ??
        target.calculationBoundary ??
        null,
    });

    for (const targetSkill of target.targetSkills ?? []) {
      for (const mapping of targetSkill.damageElementFieldMappings ?? []) {
        mappings.push(
          createSummonTargetHitCandidateMapping({
            mapping,
            ref,
            target,
            targetSkill,
            compactSummary,
          })
        );
      }
    }
  }

  if (mappings.length === 0) {
    return {
      mappings: [],
      summary: null,
    };
  }

  return {
    mappings,
    summary: {
      status: 'summon-target-damage-element-candidates-linked-unapplied',
      sourceKind: 'azpr-summon-target-hit-candidate-summary',
      sourceElementConfigIds: uniqueNumbers(
        summaries.map(summary => summary.sourceElementConfigId)
      ),
      sourcePathIds: uniqueStrings(
        summaries.map(summary => summary.sourcePathId)
      ),
      summonUnitIds: uniqueNumbers(
        summaries.map(summary => summary.summonUnitId)
      ),
      targetSkillIds: uniqueNumbers(
        summaries.flatMap(summary => summary.targetSkillIds)
      ),
      damageElementConfigIds: uniqueNumbers(
        summaries.flatMap(summary => summary.damageElementConfigIds)
      ),
      damageElementCandidateCount: mappings.length,
      triggerTimingStatus: createSummonTargetTriggerTimingStatus(summaries),
      triggerFrameCandidates: uniqueNumbers(
        summaries.flatMap(summary =>
          (summary.triggerFrameCandidateSummaries ?? []).flatMap(
            item => item.candidateStartFrames ?? []
          )
        )
      ),
      triggerFrameCandidateSummaries: compactSummonTargetFrameSummaries(
        summaries.flatMap(
          summary => summary.triggerFrameCandidateSummaries ?? []
        )
      ),
      hitCountStatus: 'summon-target-hit-count-unconfirmed',
      runtimeOwnershipStatus: 'summon-target-runtime-ownership-unconfirmed',
      calculationBoundary:
        summaries.find(summary => summary.calculationBoundary)
          ?.calculationBoundary ?? null,
      applied: false,
    },
  };
}

function findSummonTargetEvidence(ref) {
  const summonUnitId =
    numberOrNull(ref.summonTargetSkillEvidence?.summonUnitId) ??
    numberOrNull(ref.summonFields?.summonUnitId);
  if (!Number.isFinite(summonUnitId)) {
    return null;
  }
  return SUMMON_TARGET_BY_UNIT_ID.get(summonUnitId) ?? null;
}

function createSummonTargetHitCandidateMapping({
  mapping,
  ref,
  target,
  targetSkill,
  compactSummary,
}) {
  return {
    ...mapping,
    sourceKind: 'azpr-summon-target-damage-element-candidate',
    sourceElementConfigId: numberOrNull(ref.elementConfigId),
    sourcePathId: ref.pathId ?? null,
    sourceScriptTypeClassName: ref.scriptTypeClassName ?? null,
    summonTarget: {
      status:
        compactSummary?.status ??
        target.status ??
        'summon-target-damage-elements-found',
      summonUnitId:
        numberOrNull(compactSummary?.summonUnitId) ??
        numberOrNull(target.summonUnitId),
      sourceElementConfigId: numberOrNull(ref.elementConfigId),
      sourcePathId: ref.pathId ?? null,
      relationStatus:
        compactSummary?.relationStatus ?? target.relationStatus ?? null,
      targetSkillId: numberOrNull(targetSkill.skillId),
      targetSkillIds:
        compactSummary?.targetSkillIds ?? target.targetSkillIds ?? [],
      battlefieldItemId: numberOrNull(target.battlefieldItem?.id),
      battlefieldItemParam: target.battlefieldItem?.param ?? null,
      skillControlStatus: targetSkill.skillControlDirectory?.status ?? null,
      triggerTimingStatus:
        createSummonTargetSkillControlFrameSummary(targetSkill)?.status ??
        'summon-target-trigger-frame-unconfirmed',
      triggerFrameCandidates:
        createSummonTargetSkillControlFrameSummary(targetSkill)
          ?.candidateStartFrames ?? [],
      triggerFrameCandidateSummary:
        createSummonTargetSkillControlFrameSummary(targetSkill),
      hitCountStatus: 'summon-target-hit-count-unconfirmed',
      runtimeOwnershipStatus: 'summon-target-runtime-ownership-unconfirmed',
      calculationBoundary:
        compactSummary?.calculationBoundary ??
        target.calculationBoundary ??
        null,
      applied: false,
    },
    skillLevelBridge: createSummonTargetSkillLevelBridge({
      mapping,
      targetSkill,
    }),
    unresolved: uniqueStrings([
      ...(mapping.unresolved ?? []),
      createSummonTargetSkillControlFrameSummary(targetSkill)?.status ??
        'summon-target-trigger-frame-unconfirmed',
      'summon-target-hit-count-unconfirmed',
      'summon-target-runtime-ownership-unconfirmed',
    ]),
    applied: false,
  };
}

function createSummonTargetTriggerTimingStatus(summaries) {
  const hasFrameCandidates = summaries.some(summary =>
    (summary.triggerFrameCandidateSummaries ?? []).some(
      item => (item.candidateStartFrames ?? []).length > 0
    )
  );
  return hasFrameCandidates
    ? 'summon-target-trigger-frame-candidates-found-unconfirmed'
    : 'summon-target-trigger-frame-unconfirmed';
}

function compactSummonTargetFrameSummaries(summaries) {
  const seen = new Set();
  const result = [];
  for (const summary of summaries) {
    const key = `${summary.targetSkillId ?? ''}:${(
      summary.candidateStartFrames ?? []
    ).join(',')}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(summary);
  }
  return result;
}

function createSummonTargetSkillControlFrameSummary(targetSkill) {
  const directory = targetSkill?.skillControlDirectory;
  if (!directory) {
    return null;
  }
  const triggerSummary = directory.triggerFrameCandidateSummary ?? {};
  const candidateStartFrames = uniqueNumbers(
    triggerSummary.candidateStartFrames ?? directory.startFrameCandidates ?? []
  );
  return {
    status:
      candidateStartFrames.length > 0
        ? 'summon-target-trigger-frame-candidates-found-unconfirmed'
        : 'summon-target-trigger-frame-unconfirmed',
    sourceKind:
      triggerSummary.sourceKind ??
      'azpr-summon-target-skill-control-frame-candidate-summary',
    targetSkillId: numberOrNull(targetSkill.skillId),
    skillControlStatus: directory.status ?? null,
    jsonFileCount: numberOrNull(directory.jsonFileCount),
    parsedReadableJsonFiles: numberOrNull(directory.parsedReadableJsonFiles),
    candidateStartFrames,
    frameRange: directory.frameRange ?? triggerSummary.frameRange ?? null,
    timelineControlCount: numberOrNull(directory.timelineControlSampleCount),
    behaviorNodeCount: numberOrNull(directory.behaviorNodeSampleCount),
    hpBehaviorChainCount: numberOrNull(directory.hpBehaviorChainCount),
    externalElementBaseRefCount: numberOrNull(
      directory.behaviorReferenceSummary?.externalElementBaseRefs
    ),
    applied: false,
  };
}

function createSummonTargetSkillLevelBridge({ mapping, targetSkill }) {
  const elementId = numberOrNull(mapping.elementConfigId);
  const valueSummary = (targetSkill.skillElementValueSummaries ?? []).find(
    summary => Number(summary.elementId) === elementId
  );
  if (!valueSummary) {
    return mapping.skillLevelBridge ?? null;
  }

  return {
    ...(mapping.skillLevelBridge ?? {}),
    status:
      mapping.skillLevelBridge?.status ??
      'summon-target-skillsub-element-level-bridge-found',
    source: 'summon-target-skill-element-values',
    sourceSkillId: numberOrNull(targetSkill.skillId),
    elementConfigId: elementId,
    levelRows:
      numberOrNull(valueSummary.rowCount) ??
      numberOrNull(mapping.skillLevelBridge?.levelRows) ??
      0,
    parameterIds: valueSummary.parameterIds ?? [],
    varyingParameterIds: valueSummary.varyingParameterIds ?? [],
    firstLevel: compactSummonTargetLevelValue(valueSummary.firstLevel),
    lastLevel: compactSummonTargetLevelValue(valueSummary.lastLevel),
    formulaSlotAlignment: createSummonTargetFormulaSlotAlignment({
      mapping,
      valueSummary,
    }),
    applied: false,
  };
}

function compactSummonTargetLevelValue(levelRow) {
  if (!levelRow) {
    return null;
  }
  return {
    level: numberOrNull(levelRow.level),
    rowId: numberOrNull(levelRow.id),
    valueParam: levelRow.valueParam ?? null,
    paramPairs: (levelRow.paramPairs ?? []).map(pair => ({
      id: numberOrNull(pair.id),
      value: numberOrNull(pair.value),
    })),
  };
}

function createSummonTargetFormulaSlotAlignment({ mapping, valueSummary }) {
  const base =
    mapping.skillLevelBridge?.formulaParamAlignment ??
    mapping.skillLevelBridge?.formulaSlotAlignment ??
    null;
  if (!base?.parameterSummaries?.length) {
    return compactFormulaSlotAlignment(base);
  }

  const firstPairs = new Map(
    (valueSummary.firstLevel?.paramPairs ?? []).map(pair => [
      Number(pair.id),
      Number(pair.value),
    ])
  );
  const lastPairs = new Map(
    (valueSummary.lastLevel?.paramPairs ?? []).map(pair => [
      Number(pair.id),
      Number(pair.value),
    ])
  );
  const varyingIds = new Set(
    (valueSummary.varyingParameterIds ?? []).map(id => Number(id))
  );
  const rowCount = numberOrNull(valueSummary.rowCount) ?? 0;
  const parameterSummaries = base.parameterSummaries.map(summary => {
    const id = Number(summary.id);
    const firstLevelValue = firstPairs.get(id) ?? summary.firstLevelValue;
    const lastLevelValue = lastPairs.get(id) ?? summary.lastLevelValue;
    const minValue = Math.min(Number(firstLevelValue), Number(lastLevelValue));
    const maxValue = Math.max(Number(firstLevelValue), Number(lastLevelValue));
    const isConstantAcrossLevels =
      Number(firstLevelValue) === Number(lastLevelValue);
    const directSlotMatch =
      Number(summary.formulaParamValue) === Number(firstLevelValue) &&
      Number(summary.formulaParamValue) === Number(lastLevelValue);
    const relationStatus = directSlotMatch
      ? 'constant-direct-slot-match'
      : varyingIds.has(id)
        ? 'level-scaling-override-candidate'
        : 'constant-override-candidate';
    const step =
      rowCount > 1 &&
      Number.isFinite(firstLevelValue) &&
      Number.isFinite(lastLevelValue)
        ? (Number(lastLevelValue) - Number(firstLevelValue)) / (rowCount - 1)
        : null;

    return {
      ...summary,
      levelRows: rowCount || summary.levelRows,
      firstLevelValue,
      lastLevelValue,
      minValue,
      maxValue,
      isConstantAcrossLevels,
      relationStatus,
      progression: {
        status:
          rowCount > 1
            ? isConstantAcrossLevels
              ? 'constant-across-levels'
              : 'arithmetic-progression-candidate-unverified'
            : 'insufficient-level-rows',
        step,
        isArithmetic: rowCount > 1 && !isConstantAcrossLevels,
      },
    };
  });
  const directSlotMatchParamIds = parameterSummaries
    .filter(summary => summary.relationStatus === 'constant-direct-slot-match')
    .map(summary => summary.id);
  const overrideCandidateParamIds = parameterSummaries
    .filter(summary => summary.relationStatus !== 'constant-direct-slot-match')
    .map(summary => summary.id);

  return compactFormulaSlotAlignment({
    ...base,
    status: 'summon-target-skill-level-slot-alignment-unverified',
    conclusion:
      overrideCandidateParamIds.length > 0
        ? 'slot-override-candidate-unconfirmed'
        : 'constant-slot-match-unconfirmed',
    directSlotMatchParamIds,
    overrideCandidateParamIds,
    parameterSummaries,
  });
}

function mergeHitCandidateMappingEvidence(mapping, actionLevelCandidate) {
  if (!actionLevelCandidate) {
    return mapping;
  }

  return {
    ...mapping,
    hpDamage: mapping.hpDamage
      ? {
          ...actionLevelCandidate.hpDamage,
          ...mapping.hpDamage,
          formulaFunctionEvidence:
            mapping.hpDamage.formulaFunctionEvidence ??
            actionLevelCandidate.hpDamage?.formulaFunctionEvidence ??
            null,
          formulaSlotCandidates:
            mapping.hpDamage.formulaSlotCandidates ??
            actionLevelCandidate.hpDamage?.formulaSlotCandidates ??
            [],
        }
      : mapping.hpDamage,
    skillLevelBridge: {
      ...actionLevelCandidate.skillLevelBridge,
      ...mapping.skillLevelBridge,
      formulaParamAlignment:
        mapping.skillLevelBridge?.formulaParamAlignment ??
        actionLevelCandidate.skillLevelBridge?.formulaParamAlignment ??
        actionLevelCandidate.skillLevelBridge?.formulaSlotAlignment ??
        null,
      formulaSlotAlignment:
        mapping.skillLevelBridge?.formulaSlotAlignment ??
        actionLevelCandidate.skillLevelBridge?.formulaSlotAlignment ??
        null,
      firstLevel:
        mapping.skillLevelBridge?.firstLevel ??
        actionLevelCandidate.skillLevelBridge?.firstLevel ??
        null,
      lastLevel:
        mapping.skillLevelBridge?.lastLevel ??
        actionLevelCandidate.skillLevelBridge?.lastLevel ??
        null,
      relatedElementLevelBridge:
        mapping.skillLevelBridge?.relatedElementLevelBridge ??
        actionLevelCandidate.skillLevelBridge?.relatedElementLevelBridge ??
        null,
    },
  };
}

function summarizeHitCandidateHpDamage(mappings) {
  const hpMappings = mappings.filter(mapping => mapping.hpDamage);
  return {
    status:
      hpMappings.length > 0
        ? 'candidate-fields-found-formula-unmapped'
        : 'candidate-fields-missing',
    candidateCount: hpMappings.length,
    formulaFunctionIds: uniqueNumbers(
      hpMappings.flatMap(mapping =>
        Object.values(mapping.hpDamage?.formulaFunctionIds ?? {})
      )
    ),
    formulaFunctionStatuses: uniqueStrings(
      hpMappings.map(mapping => mapping.hpDamage?.formulaFunctionStatus)
    ),
    formulaFunctionMatchedIds: uniqueNumbers(
      hpMappings.flatMap(
        mapping => mapping.hpDamage?.formulaFunctionMatchedIds ?? []
      )
    ),
    rawFormulaParamValueSamples: uniqueNumbers(
      hpMappings.flatMap(mapping => mapping.hpDamage?.rawFormulaParamValues)
    ).slice(0, 12),
    applied: false,
  };
}

function summarizeHitCandidateToughnessDamage(mappings) {
  const toughnessMappings = mappings.filter(mapping => mapping.toughnessDamage);
  return {
    status:
      toughnessMappings.length > 0
        ? 'candidate-fields-found-formula-unmapped'
        : 'candidate-fields-missing',
    candidateCount: toughnessMappings.length,
    weakBreakDamageRates: uniqueNumbers(
      toughnessMappings.map(
        mapping => mapping.toughnessDamage?.weakBreakDamageRate
      )
    ),
    hitTypes: uniqueNumbers(
      toughnessMappings.map(mapping => mapping.toughnessDamage?.hitType)
    ),
    interruptPriorities: uniqueNumbers(
      toughnessMappings.map(
        mapping => mapping.toughnessDamage?.interruptPriority
      )
    ),
    useOneBreakValues: uniqueNumbers(
      toughnessMappings.map(mapping => mapping.toughnessDamage?.useOneBreak)
    ),
    applied: false,
  };
}

function summarizeHitCandidateSelfEnergyChange(mappings) {
  const energyMappings = mappings.filter(mapping => mapping.selfEnergyChange);
  const runtimeFormulaProbe =
    createSelfEnergyRuntimeFormulaProbe(energyMappings);
  return {
    status:
      energyMappings.length > 0
        ? 'candidate-fields-found-formula-unmapped'
        : 'candidate-fields-missing',
    candidateCount: energyMappings.length,
    recoverSPValues: uniqueNumbers(
      energyMappings.map(mapping => mapping.selfEnergyChange?.recoverSP)
    ),
    petRecoverSPValues: uniqueNumbers(
      energyMappings.map(mapping => mapping.selfEnergyChange?.petRecoverSP)
    ),
    recoverIntervals: uniqueNumbers(
      energyMappings.map(mapping => mapping.selfEnergyChange?.recoverInterval)
    ),
    ownerScopes: uniqueStrings(
      energyMappings.map(mapping => mapping.selfEnergyChange?.ownerScope)
    ),
    runtimeFormulaProbe,
    applied: false,
  };
}

function createSelfEnergyRuntimeFormulaProbe(candidates, options = {}) {
  const samples = (candidates ?? [])
    .map(normalizeSelfEnergyRuntimeProbeSample)
    .filter(Boolean);
  const gateOpenCount = samples.filter(sample => sample.gateOpen).length;
  const recoverSPValues = uniqueNumbers(
    samples.map(sample => sample.recoverSP).filter(value => value != null)
  );
  const petRecoverSPValues = uniqueNumbers(
    samples.map(sample => sample.petRecoverSP).filter(value => value != null)
  );
  const recoverIntervals = uniqueNumbers(
    samples.map(sample => sample.recoverInterval).filter(value => value != null)
  );
  const sourceToArgsProbe = createSelfEnergySourceToArgsProbe(samples);
  const runtimeModifierProbe = createSelfEnergyRuntimeModifierProbe(samples);
  const ownerShareIntervalProbe =
    createSelfEnergyOwnerShareIntervalProbe(samples);
  const runtimeSamplingProbe = createSelfEnergyRuntimeSamplingProbe(
    samples,
    options.runtimeSampleContext,
    {
      action: options.action,
      sourceStatus: options.sourceStatus,
    }
  );

  return {
    status:
      samples.length > 0
        ? 'recover-sp-runtime-probe-built-unapplied'
        : 'recover-sp-runtime-probe-missing',
    sourceKind: 'azpr-self-energy-runtime-formula-probe',
    sourceStatus: options.sourceStatus ?? null,
    candidateCount: samples.length,
    gateOpenCount,
    gateCondition: 'DamageElement.m_recoverSP > 0',
    runtimeFieldMap: SELF_ENERGY_RUNTIME_FIELD_MAP,
    runtimeChainSteps: SELF_ENERGY_RUNTIME_CHAIN_STEPS,
    unitHypotheses: SELF_ENERGY_RUNTIME_UNIT_HYPOTHESES,
    recoverSpArgsFieldMap: RECOVER_SP_ARGS_FIELD_MAP,
    sourceToArgsProbe,
    runtimeModifierProbe,
    ownerShareIntervalProbe,
    runtimeSamplingProbe,
    recoverSPValues,
    petRecoverSPValues,
    recoverIntervals,
    perTenThousandRecoverSPValues: uniqueNumbers(
      recoverSPValues
        .map(value => scalePerTenThousand(value))
        .filter(value => value != null)
    ),
    perTenThousandPetRecoverSPValues: uniqueNumbers(
      petRecoverSPValues
        .map(value => scalePerTenThousand(value))
        .filter(value => value != null)
    ),
    perTenThousandRecoverIntervals: uniqueNumbers(
      recoverIntervals
        .map(value => scalePerTenThousand(value))
        .filter(value => value != null)
    ),
    samples,
    unresolved: [
      'recover-sp-final-unit-unconfirmed',
      'delta-runtime-modifier-values-unapplied',
      'recover-interval-runtime-throttle-semantics-unconfirmed',
      'share-target-filter-unconfirmed',
      'baseDelta-vs-delta-role-unconfirmed',
      'runtime-samples-not-imported',
    ],
    applied: false,
  };
}

function createSelfEnergySourceToArgsProbe(samples) {
  const candidateCount = samples.length;
  const gateOpenCount = samples.filter(sample => sample.gateOpen).length;

  return {
    status:
      candidateCount > 0
        ? 'source-to-args-subprobe-built-unapplied'
        : 'source-to-args-subprobe-missing',
    sourceKind: 'azpr-self-energy-source-to-args-subprobe',
    sourceFunction: 'DamageElement.RecoverSP@0x138EEE0',
    argsResetFunction: 'RecoverSPArgs.OnReset@0x1254070',
    candidateCount,
    gateOpenCount,
    confirmedRuntimeRules: SELF_ENERGY_SOURCE_TO_ARGS_RULES,
    candidateMappings: {
      recoverSP: {
        candidateSourceField: 'TDamageElementParams.recoverSP',
        runtimeField: 'DamageElement.m_recoverSP@0x240',
        recoverSpArgsFields: [
          'baseDelta@0x1C',
          'delta@0x20-derived-with-runtime-modifiers',
        ],
        status: 'source-to-baseDelta-confirmed-delta-derived-unapplied',
      },
      petRecoverSP: {
        candidateSourceField: 'TDamageElementParams.petRecoverSP',
        runtimeField: 'DamageElement.m_petRecoverSP@0x244',
        recoverSpArgsFields: ['petDelta@0x38-derived-with-runtime-modifiers'],
        status: 'source-to-petDelta-confirmed-modifiers-unapplied',
      },
      recoverInterval: {
        candidateSourceField: 'TDamageElementParams.recoverInterval',
        runtimeField: 'DamageElement.m_recoverInterval@0x248',
        recoverSpArgsFields: ['interval@0x24'],
        status: 'source-to-interval-confirmed-divisor-confirmed',
      },
      recoverTagType: {
        candidateSourceField: 'DamageElement.RecoverSP path',
        recoverSpArgsFields: ['tagType@0x28'],
        enumValue: {
          name: 'AttackRecoverySp',
          value: 0,
        },
        status: 'damage-element-recover-sp-tag-type-zero-confirmed',
      },
    },
    samples: samples.map(sample => ({
      elementConfigId: sample.elementConfigId,
      pathId: sample.pathId,
      gateOpen: sample.gateOpen,
      argsConstructionCandidates: {
        baseDelta: {
          sourceField: sample.recoverSP,
          nativeDivisorAddress: '0x189956FB0',
          nativeDivisorValue: 10000,
          perTenThousandCandidate: scalePerTenThousand(sample.recoverSP),
          status: 'source-to-baseDelta-confirmed-unit-confirmed',
        },
        delta: {
          sourceField: sample.recoverSP,
          baseDeltaCandidate: scalePerTenThousand(sample.recoverSP),
          modifierBaseConstantAddress: '0x189956B08',
          modifierBaseConstantValue: 1,
          modifierPropertyIds:
            SELF_ENERGY_RUNTIME_MODIFIER_RULES.modifierSources.map(
              source => source.propertyId
            ),
          modifierStatus: 'runtime-modifier-sources-confirmed-values-unapplied',
          status: 'derived-from-baseDelta-with-runtime-modifiers-unapplied',
        },
        petDelta: {
          sourceField: sample.petRecoverSP,
          basePetDeltaCandidate: scalePerTenThousand(sample.petRecoverSP),
          nativeDivisorAddress: '0x189956FB0',
          nativeDivisorValue: 10000,
          modifierBaseConstantAddress: '0x189956B08',
          modifierBaseConstantValue: 1,
          modifierPropertyIds:
            SELF_ENERGY_RUNTIME_MODIFIER_RULES.modifierSources.map(
              source => source.propertyId
            ),
          modifierStatus: 'runtime-modifier-sources-confirmed-values-unapplied',
          status: 'derived-from-petRecoverSP-with-runtime-modifiers-unapplied',
        },
        interval: {
          sourceField: sample.recoverInterval,
          nativeDivisorAddress: '0x189956D8C',
          nativeDivisorValue: 1000,
          intervalSecondsCandidate:
            sample.recoverInterval == null
              ? null
              : sample.recoverInterval / 1000,
          divisorStatus: 'native-divisor-value-confirmed-time-unit-unapplied',
          status: 'source-to-interval-confirmed-timebase-unconfirmed',
        },
        tagType: {
          value: 0,
          name: 'AttackRecoverySp',
          status: 'constant-on-damage-element-recover-sp-path',
        },
      },
      applied: false,
    })),
    unresolved: SELF_ENERGY_SOURCE_TO_ARGS_RULES.unresolved,
    applied: false,
  };
}

function createSelfEnergyRuntimeModifierProbe(samples) {
  const candidateCount = samples.length;
  const gateOpenCount = samples.filter(sample => sample.gateOpen).length;
  const modifierPropertyIds =
    SELF_ENERGY_RUNTIME_MODIFIER_RULES.modifierSources.map(
      source => source.propertyId
    );

  return {
    status:
      candidateCount > 0
        ? 'runtime-modifier-subprobe-built-unapplied'
        : 'runtime-modifier-subprobe-missing',
    sourceKind: 'azpr-self-energy-runtime-modifier-subprobe',
    sourceFunction: 'DamageElement.RecoverSP@0x138EEE0',
    candidateCount,
    gateOpenCount,
    confirmedRuntimeRules: SELF_ENERGY_RUNTIME_MODIFIER_RULES,
    modifierPropertyIds,
    samples: samples.map(sample => ({
      elementConfigId: sample.elementConfigId,
      pathId: sample.pathId,
      gateOpen: sample.gateOpen,
      deltaFormulaPreview: {
        baseDeltaCandidate: scalePerTenThousand(sample.recoverSP),
        petBaseDeltaCandidate: scalePerTenThousand(sample.petRecoverSP),
        modifierPropertyIds,
        formulaShape: 'base * (1 + SPGETUP + SPGETUP_ATK)',
        nativeConstantAddress:
          SELF_ENERGY_RUNTIME_MODIFIER_RULES.deltaFormulaShape
            .nativeConstantAddress,
        nativeConstantValue:
          SELF_ENERGY_RUNTIME_MODIFIER_RULES.deltaFormulaShape
            .nativeConstantValue,
        status: 'modifier-base-constant-confirmed-values-runtime-unapplied',
      },
      intervalScaleCandidate: {
        sourceField: sample.recoverInterval,
        nativeDivisorAddress:
          SELF_ENERGY_RUNTIME_MODIFIER_RULES.intervalScale.nativeDivisorAddress,
        nativeDivisorValue:
          SELF_ENERGY_RUNTIME_MODIFIER_RULES.intervalScale.nativeDivisorValue,
        intervalSecondsCandidate:
          sample.recoverInterval == null ? null : sample.recoverInterval / 1000,
        status: 'divisor-value-confirmed-time-unit-unapplied',
      },
      shareConfigCandidates:
        SELF_ENERGY_RUNTIME_MODIFIER_RULES.shareConfigSources,
      applied: false,
    })),
    unresolved: SELF_ENERGY_RUNTIME_MODIFIER_RULES.unresolved,
    applied: false,
  };
}

function createSelfEnergyOwnerShareIntervalProbe(samples) {
  const candidateCount = samples.length;
  const gateOpenCount = samples.filter(sample => sample.gateOpen).length;

  return {
    status:
      candidateCount > 0
        ? 'owner-share-interval-subprobe-built-unapplied'
        : 'owner-share-interval-subprobe-missing',
    sourceKind: 'azpr-self-energy-owner-share-interval-subprobe',
    sourceFunction: 'SPSystem.OnTransmit@0x14837F0',
    candidateCount,
    gateOpenCount,
    fieldMap: RECOVER_SP_ARGS_FIELD_MAP,
    confirmedRuntimeRules: SELF_ENERGY_OWNER_SHARE_INTERVAL_RULES,
    candidateMappings: {
      recoverSP: {
        candidateSourceField: 'TDamageElementParams.recoverSP',
        recoverSpArgsCandidates: ['baseDelta@0x1C', 'delta@0x20'],
        status: 'source-to-baseDelta-confirmed-delta-derived-unapplied',
      },
      petRecoverSP: {
        candidateSourceField: 'TDamageElementParams.petRecoverSP',
        recoverSpArgsCandidates: ['petDelta@0x38'],
        status: 'source-to-petDelta-confirmed-modifiers-unapplied',
      },
      recoverInterval: {
        candidateSourceField: 'TDamageElementParams.recoverInterval',
        recoverSpArgsCandidates: ['interval@0x24'],
        status: 'source-to-interval-confirmed-divisor-confirmed',
      },
    },
    samples: samples.map(sample => ({
      elementConfigId: sample.elementConfigId,
      pathId: sample.pathId,
      gateOpen: sample.gateOpen,
      recoverSpArgsCandidates: {
        baseDelta: sample.scaledCandidates,
        delta: sample.scaledCandidates,
        petDelta: {
          rawField: sample.petRecoverSP,
          perTenThousand: scalePerTenThousand(sample.petRecoverSP),
        },
        interval: {
          rawField: sample.recoverInterval,
          nativeDivisorAddress: '0x189956D8C',
          nativeDivisorValue: 1000,
          intervalSecondsCandidate:
            sample.recoverInterval == null
              ? null
              : sample.recoverInterval / 1000,
        },
      },
      applied: false,
    })),
    unresolved: [
      'delta-runtime-modifier-values-unapplied',
      'owner-entity-selection-unconfirmed',
      'background-share-target-filter-unconfirmed',
      'pet-share-target-filter-unconfirmed',
      'recover-interval-runtime-throttle-semantics-unconfirmed',
      'recover-tag-type-non-damage-element-paths-unconfirmed',
    ],
    applied: false,
  };
}

function createSelfEnergyRuntimeSamplingProbe(
  samples,
  runtimeSampleContext = null,
  options = {}
) {
  const candidateCount = samples.length;
  const gateOpenCount = samples.filter(sample => sample.gateOpen).length;
  const requiredEventTypes =
    SELF_ENERGY_RUNTIME_SAMPLE_SCHEMA.offlineImportShape.eventTypes;
  const importedRuntimeSampleCount =
    runtimeSampleContext?.importedRuntimeSampleCount ?? 0;
  const sampleExpectations = samples.map(sample =>
    createSelfEnergyRuntimeSampleExpectation({
      sample,
      runtimeSampleContext,
      options,
    })
  );
  const matchedSampleCount = sampleExpectations.filter(
    expectation => (expectation.runtimeSampleMatch?.matchedEventCount ?? 0) > 0
  ).length;
  const validatedSampleCount = sampleExpectations.filter(
    expectation =>
      expectation.runtimeSampleMatch?.validationStatus ===
      'offline-runtime-sample-validated'
  ).length;
  const failedSampleCount = sampleExpectations.filter(
    expectation =>
      expectation.runtimeSampleMatch?.validationStatus ===
      'offline-runtime-sample-validation-failed'
  ).length;
  const sampleImportSummary = {
    status: createRuntimeSampleImportSummaryStatus({
      candidateCount,
      importedRuntimeSampleCount,
      matchedSampleCount,
      validatedSampleCount,
      failedSampleCount,
    }),
    sourceStatus: options.sourceStatus ?? null,
    captureCount: runtimeSampleContext?.captureCount ?? 0,
    importedRuntimeSampleCount,
    importedEventTypes: runtimeSampleContext?.eventTypes ?? [],
    requiredEventTypes,
    matchedSampleCount,
    validatedSampleCount,
    failedSampleCount,
    missingSampleCount: Math.max(0, candidateCount - matchedSampleCount),
    validationStatuses: uniqueStrings(
      sampleExpectations
        .map(expectation => expectation.runtimeSampleMatch?.validationStatus)
        .filter(Boolean)
    ),
    applied: false,
  };

  return {
    status: createRuntimeSamplingProbeStatus({
      candidateCount,
      importedRuntimeSampleCount,
      matchedSampleCount,
      validatedSampleCount,
      failedSampleCount,
    }),
    sourceKind: 'azpr-self-energy-runtime-sampling-subprobe',
    sourceFunction: 'DamageElement.RecoverSP@0x138EEE0',
    candidateCount,
    gateOpenCount,
    importedRuntimeSampleCount,
    importStatus: createRuntimeSampleImportStatus({
      importedRuntimeSampleCount,
      matchedSampleCount,
      validatedSampleCount,
      failedSampleCount,
    }),
    sampleSchema: SELF_ENERGY_RUNTIME_SAMPLE_SCHEMA,
    requiredEventTypes,
    sampleImportSummary,
    runtimeSampleCaptures: runtimeSampleContext?.captures ?? [],
    sampleExpectations,
    unresolved: createRuntimeSamplingProbeUnresolved({
      importedRuntimeSampleCount,
      matchedSampleCount,
      candidateCount,
      failedSampleCount,
    }),
    applied: false,
  };
}

function createSelfEnergyRuntimeSampleExpectation({
  sample,
  runtimeSampleContext,
  options,
}) {
  const runtimeSampleMatch = createSelfEnergyRuntimeSampleMatch({
    sample,
    runtimeSampleContext,
    action: options.action,
  });

  return {
    elementConfigId: sample.elementConfigId,
    pathId: sample.pathId,
    gateOpen: sample.gateOpen,
    expectedRecoverSpArgs: {
      baseDelta: scalePerTenThousand(sample.recoverSP),
      deltaFormula: 'recoverSP / 10000 * (1 + SPGETUP + SPGETUP_ATK)',
      petDeltaFormula: 'petRecoverSP / 10000 * (1 + SPGETUP + SPGETUP_ATK)',
      intervalSecondsCandidate:
        sample.recoverInterval == null ? null : sample.recoverInterval / 1000,
      tagType: {
        value: 0,
        name: 'AttackRecoverySp',
      },
    },
    requiredRuntimeValues: [
      {
        propertyId: 105,
        propertyName: 'SPGETUP',
      },
      {
        propertyId: 228,
        propertyName: 'SPGETUP_ATK',
      },
    ],
    correlationKeys:
      SELF_ENERGY_RUNTIME_SAMPLE_SCHEMA.offlineImportShape.eventCorrelationKeys,
    runtimeSampleMatch,
    status:
      runtimeSampleMatch?.validationStatus ??
      'sample-contract-ready-awaiting-runtime-events',
  };
}

function createSelfEnergyRuntimeSampleMatch({
  sample,
  runtimeSampleContext,
  action,
}) {
  if (!runtimeSampleContext?.eventCount) {
    return null;
  }

  const events = findRecoverSpRuntimeSampleEventsForSample({
    sample,
    runtimeSampleContext,
    action,
  });
  const eventTypeCounts = countRuntimeSampleEventsByType(events);

  if (events.length === 0) {
    return {
      status: 'offline-runtime-sample-missing',
      validationStatus: 'offline-runtime-sample-missing',
      matchedEventCount: 0,
      eventTypeCounts,
      validationResults: [],
      applied: false,
    };
  }

  const argsEvent = findRuntimeSampleEvent(events, 'recover-sp-args-built');
  const onTransmitEvent = findRuntimeSampleEvent(
    events,
    'recover-sp-ontransmit-12f'
  );
  const appliedEvent = findRuntimeSampleEvent(events, 'recover-sp-applied');
  const shareEvents = events.filter(
    event => event.eventType === 'recover-sp-share-rebroadcast'
  );
  const spgetup = findRecoverSpModifierValue(events, 105, argsEvent?.spgetup);
  const spgetupAtk = findRecoverSpModifierValue(
    events,
    228,
    argsEvent?.spgetupAtk
  );
  const expectedBaseDelta = scalePerTenThousand(sample.recoverSP);
  const expectedPetBaseDelta = scalePerTenThousand(sample.petRecoverSP);
  const modifierMultiplier =
    spgetup == null || spgetupAtk == null ? null : 1 + spgetup + spgetupAtk;
  const expectedDelta =
    expectedBaseDelta == null || modifierMultiplier == null
      ? null
      : roundRuntimeSampleNumber(expectedBaseDelta * modifierMultiplier);
  const expectedPetDelta =
    expectedPetBaseDelta == null || modifierMultiplier == null
      ? null
      : roundRuntimeSampleNumber(expectedPetBaseDelta * modifierMultiplier);
  const expectedInterval =
    sample.recoverInterval == null
      ? null
      : roundRuntimeSampleNumber(sample.recoverInterval / 1000);
  const appliedDelta = getRuntimeAppliedSpDelta(appliedEvent);

  const validationResults = [
    createRuntimeSampleValidationResult({
      key: 'base-delta-scale',
      expression: 'args.baseDelta == recoverSP / 10000',
      expected: expectedBaseDelta,
      actual: argsEvent?.args?.baseDelta,
      missingReason: argsEvent ? null : 'recover-sp-args-built-missing',
    }),
    createRuntimeSampleValidationResult({
      key: 'delta-scale-and-modifier',
      expression:
        'args.delta == recoverSP / 10000 * (1 + SPGETUP + SPGETUP_ATK)',
      expected: expectedDelta,
      actual: argsEvent?.args?.delta,
      missingReason:
        argsEvent && modifierMultiplier != null
          ? null
          : 'recover-sp-args-or-modifier-values-missing',
    }),
    createRuntimeSampleValidationResult({
      key: 'pet-delta-scale-and-modifier',
      expression:
        'args.petDelta == petRecoverSP / 10000 * (1 + SPGETUP + SPGETUP_ATK)',
      expected: expectedPetDelta,
      actual: argsEvent?.args?.petDelta,
      missingReason:
        argsEvent && modifierMultiplier != null
          ? null
          : 'recover-sp-args-or-modifier-values-missing',
    }),
    createRuntimeSampleValidationResult({
      key: 'interval-scale',
      expression: 'args.interval == recoverInterval / 1000',
      expected: expectedInterval,
      actual: argsEvent?.args?.interval,
      missingReason: argsEvent ? null : 'recover-sp-args-built-missing',
    }),
    createRuntimeSampleValidationResult({
      key: 'final-sp-curve',
      expression:
        'spAfter - spBefore == applied delta after owner/share/throttle rules',
      expected: argsEvent?.args?.delta,
      actual: appliedDelta,
      missingReason:
        argsEvent && appliedEvent ? null : 'recover-sp-applied-missing',
    }),
  ];
  const validationStatus =
    createRuntimeSampleValidationStatus(validationResults);

  return {
    status: 'offline-runtime-sample-events-matched',
    validationStatus,
    matchedEventCount: events.length,
    eventTypeCounts,
    captureSessionIds: uniqueStrings(
      events.map(event => event.captureSessionId).filter(Boolean)
    ),
    correlationIds: uniqueStrings(
      events.map(event => event.args?.id).filter(Boolean)
    ),
    frameIndexes: uniqueNumbers(events.map(event => event.frameIndex)),
    roleEntityIds: uniqueStrings(
      events
        .map(event => event.roleEntityId ?? event.receiverEntityId)
        .filter(Boolean)
    ),
    modifierValues: {
      SPGETUP: spgetup,
      SPGETUP_ATK: spgetupAtk,
      multiplier: modifierMultiplier,
    },
    expectedRuntimeArgs: {
      baseDelta: expectedBaseDelta,
      delta: expectedDelta,
      petDelta: expectedPetDelta,
      interval: expectedInterval,
    },
    observedRuntimeArgs: {
      id: argsEvent?.args?.id ?? null,
      baseDelta: argsEvent?.args?.baseDelta ?? null,
      delta: argsEvent?.args?.delta ?? null,
      petDelta: argsEvent?.args?.petDelta ?? null,
      interval: argsEvent?.args?.interval ?? null,
      tagType: argsEvent?.args?.tagType ?? null,
      sharePercent: argsEvent?.args?.sharePercent ?? null,
      petSharePercent: argsEvent?.args?.petSharePercent ?? null,
      mainPetSharePercent: argsEvent?.args?.mainPetSharePercent ?? null,
    },
    onTransmit: onTransmitEvent
      ? {
          timerMapHit: onTransmitEvent.timerMapHit,
          directRecoverCalled: onTransmitEvent.directRecoverCalled,
          receiverEntityId: onTransmitEvent.receiverEntityId,
          shareRebroadcastTargetCount:
            onTransmitEvent.shareRebroadcastTargets?.length ?? 0,
          petShareTargetCount: onTransmitEvent.petShareTargets?.length ?? 0,
          mainPetShareTargetCount:
            onTransmitEvent.mainPetShareTargets?.length ?? 0,
        }
      : null,
    finalSpCurve: appliedEvent
      ? {
          roleEntityId: appliedEvent.roleEntityId,
          spBefore: appliedEvent.spBefore,
          spAfter: appliedEvent.spAfter,
          spDeltaApplied: appliedDelta,
          recoverTagType: appliedEvent.recoverTagType,
        }
      : null,
    shareRebroadcastEventCount: shareEvents.length,
    validationResults,
    applied: false,
  };
}

function findRecoverSpRuntimeSampleEventsForSample({
  sample,
  runtimeSampleContext,
  action,
}) {
  const actionId = action?.id ?? null;
  const sampleElementId = numberOrNull(sample.elementConfigId);
  const samplePathId = sample.pathId == null ? null : String(sample.pathId);
  const primaryEvents = (runtimeSampleContext.events ?? []).filter(event => {
    if (actionId && event.actionId && event.actionId !== actionId) {
      return false;
    }
    return (
      (sampleElementId != null &&
        (event.sourceElementConfigId === sampleElementId ||
          event.elementConfigId === sampleElementId)) ||
      (samplePathId != null && event.pathId === samplePathId)
    );
  });
  const correlationIds = new Set(
    primaryEvents
      .map(event => event.args?.id)
      .filter(value => value != null && String(value).length > 0)
  );

  return (runtimeSampleContext.events ?? [])
    .filter(event => {
      if (actionId && event.actionId && event.actionId !== actionId) {
        return false;
      }
      if (primaryEvents.includes(event)) {
        return true;
      }
      return event.args?.id != null && correlationIds.has(event.args.id);
    })
    .sort(
      (left, right) =>
        (numberOrNull(left.frameIndex) ?? 0) -
          (numberOrNull(right.frameIndex) ?? 0) ||
        (numberOrNull(left.eventIndex) ?? 0) -
          (numberOrNull(right.eventIndex) ?? 0)
    );
}

function findRuntimeSampleEvent(events, eventType) {
  return events.find(event => event.eventType === eventType) ?? null;
}

function findRecoverSpModifierValue(events, propertyId, fallbackValue = null) {
  const event = events.find(
    item =>
      item.eventType === 'recover-sp-modifier-property-read' &&
      Number(item.propertyId) === Number(propertyId)
  );
  return numberOrNull(event?.floatValue ?? fallbackValue);
}

function getRuntimeAppliedSpDelta(appliedEvent) {
  if (!appliedEvent) {
    return null;
  }
  const explicitDelta = numberOrNull(appliedEvent.spDeltaApplied);
  if (explicitDelta != null) {
    return explicitDelta;
  }
  const before = numberOrNull(appliedEvent.spBefore);
  const after = numberOrNull(appliedEvent.spAfter);
  if (before == null || after == null) {
    return null;
  }
  return roundRuntimeSampleNumber(after - before);
}

function createRuntimeSampleValidationResult({
  key,
  expression,
  expected,
  actual,
  missingReason = null,
  tolerance = 0.0001,
}) {
  const numericExpected = numberOrNull(expected);
  const numericActual = numberOrNull(actual);
  if (missingReason || numericExpected == null || numericActual == null) {
    return {
      key,
      expression,
      status: 'missing-runtime-value',
      expected: numericExpected,
      actual: numericActual,
      tolerance,
      reason: missingReason ?? 'expected-or-actual-missing',
    };
  }

  const difference = roundRuntimeSampleNumber(numericActual - numericExpected);
  return {
    key,
    expression,
    status:
      Math.abs(difference) <= tolerance
        ? 'passed'
        : 'failed-runtime-value-mismatch',
    expected: numericExpected,
    actual: numericActual,
    difference,
    tolerance,
  };
}

function createRuntimeSampleValidationStatus(validationResults) {
  if (validationResults.length === 0) {
    return 'offline-runtime-sample-missing';
  }
  if (validationResults.every(result => result.status === 'passed')) {
    return 'offline-runtime-sample-validated';
  }
  if (validationResults.some(result => result.status.includes('failed'))) {
    return 'offline-runtime-sample-validation-failed';
  }
  return 'offline-runtime-sample-validation-incomplete';
}

function createRuntimeSamplingProbeStatus({
  candidateCount,
  importedRuntimeSampleCount,
  matchedSampleCount,
  validatedSampleCount,
  failedSampleCount,
}) {
  if (candidateCount <= 0) {
    return 'runtime-sampling-schema-missing';
  }
  if (importedRuntimeSampleCount <= 0) {
    return 'runtime-sampling-schema-built-awaiting-capture';
  }
  if (failedSampleCount > 0) {
    return 'runtime-sampling-offline-samples-validation-failed';
  }
  if (validatedSampleCount >= candidateCount) {
    return 'runtime-sampling-offline-samples-validated';
  }
  if (matchedSampleCount > 0) {
    return 'runtime-sampling-offline-samples-partially-validated';
  }
  return 'runtime-sampling-offline-samples-imported-no-matches';
}

function createRuntimeSampleImportStatus({
  importedRuntimeSampleCount,
  matchedSampleCount,
  validatedSampleCount,
  failedSampleCount,
}) {
  if (importedRuntimeSampleCount <= 0) {
    return 'runtime-samples-not-imported';
  }
  if (failedSampleCount > 0) {
    return 'offline-runtime-samples-validation-failed';
  }
  if (validatedSampleCount > 0) {
    return 'offline-runtime-samples-validated';
  }
  if (matchedSampleCount > 0) {
    return 'offline-runtime-samples-matched-validation-incomplete';
  }
  return 'offline-runtime-samples-imported-no-matches';
}

function createRuntimeSampleImportSummaryStatus({
  candidateCount,
  importedRuntimeSampleCount,
  matchedSampleCount,
  validatedSampleCount,
  failedSampleCount,
}) {
  if (importedRuntimeSampleCount <= 0) {
    return 'runtime-sample-import-missing';
  }
  if (failedSampleCount > 0) {
    return 'runtime-sample-import-validation-failed';
  }
  if (candidateCount > 0 && validatedSampleCount >= candidateCount) {
    return 'runtime-sample-import-validated';
  }
  if (matchedSampleCount > 0) {
    return 'runtime-sample-import-partial';
  }
  return 'runtime-sample-import-no-matches';
}

function createRuntimeSamplingProbeUnresolved({
  importedRuntimeSampleCount,
  matchedSampleCount,
  candidateCount,
  failedSampleCount,
}) {
  return uniqueStrings([
    ...SELF_ENERGY_RUNTIME_SAMPLE_SCHEMA.unresolved.filter(item =>
      importedRuntimeSampleCount > 0
        ? item !== 'offline-runtime-samples-not-imported'
        : true
    ),
    ...(matchedSampleCount < candidateCount && importedRuntimeSampleCount > 0
      ? ['runtime-sample-coverage-incomplete']
      : []),
    ...(failedSampleCount > 0 ? ['runtime-sample-validation-failed'] : []),
  ]);
}

function countRuntimeSampleEventsByType(events) {
  return events.reduce((counts, event) => {
    counts[event.eventType] = (counts[event.eventType] ?? 0) + 1;
    return counts;
  }, {});
}

function roundRuntimeSampleNumber(value) {
  const number = numberOrNull(value);
  return number == null ? null : Number(number.toFixed(6));
}

function normalizeSelfEnergyRuntimeProbeSample(candidate) {
  const fieldCandidate =
    candidate?.fieldCandidate ?? candidate?.selfEnergyChange ?? candidate;
  if (!fieldCandidate) {
    return null;
  }

  const recoverSP = numberOrNull(fieldCandidate.recoverSP);
  const petRecoverSP = numberOrNull(fieldCandidate.petRecoverSP);
  const recoverInterval = numberOrNull(fieldCandidate.recoverInterval);
  if (recoverSP == null && petRecoverSP == null && recoverInterval == null) {
    return null;
  }

  return {
    elementConfigId: numberOrNull(candidate?.elementConfigId),
    pathId: candidate?.pathId ?? null,
    status: fieldCandidate.status ?? null,
    ownerScope: fieldCandidate.ownerScope ?? null,
    recoverSP,
    petRecoverSP,
    recoverInterval,
    gateOpen: Number(recoverSP) > 0,
    scaledCandidates: {
      rawField: {
        recoverSP,
        petRecoverSP,
        recoverInterval,
      },
      perTenThousand: {
        recoverSP: scalePerTenThousand(recoverSP),
        petRecoverSP: scalePerTenThousand(petRecoverSP),
        recoverInterval: scalePerTenThousand(recoverInterval),
      },
    },
    applied: false,
  };
}

function scalePerTenThousand(value) {
  const number = numberOrNull(value);
  return number == null ? null : Number((number / 10000).toFixed(6));
}

function compactHitCandidateDamageElementMapping(mapping) {
  return {
    sourceKind: mapping.sourceKind ?? null,
    elementConfigId: numberOrNull(mapping.elementConfigId),
    pathId: mapping.pathId ?? null,
    elementName: mapping.elementName ?? null,
    sourceElementConfigId: numberOrNull(mapping.sourceElementConfigId),
    sourcePathId: mapping.sourcePathId ?? null,
    summonTarget: mapping.summonTarget ?? null,
    hpDamage: mapping.hpDamage
      ? {
          status: mapping.hpDamage.status ?? null,
          formulaFunctionIds: mapping.hpDamage.formulaFunctionIds ?? {},
          formulaFunctionStatus: mapping.hpDamage.formulaFunctionStatus ?? null,
          formulaFunctionMatchedIds:
            mapping.hpDamage.formulaFunctionMatchedIds ?? [],
          formulaFunctionEvidence: compactFormulaFunctionEvidence(
            mapping.hpDamage.formulaFunctionEvidence
          ),
          rawFormulaParamValues: mapping.hpDamage.rawFormulaParamValues ?? [],
          damageFields: compactDamageFieldPatternValues(
            mapping.hpDamage.damageFields
          ),
        }
      : null,
    toughnessDamage: mapping.toughnessDamage
      ? {
          status: mapping.toughnessDamage.status ?? null,
          weakBreakDamageRate: numberOrNull(
            mapping.toughnessDamage.weakBreakDamageRate
          ),
          hitType: numberOrNull(mapping.toughnessDamage.hitType),
          interruptPriority: numberOrNull(
            mapping.toughnessDamage.interruptPriority
          ),
          useOneBreak: numberOrNull(mapping.toughnessDamage.useOneBreak),
        }
      : null,
    selfEnergyChange: mapping.selfEnergyChange
      ? {
          status: mapping.selfEnergyChange.status ?? null,
          recoverSP: numberOrNull(mapping.selfEnergyChange.recoverSP),
          petRecoverSP: numberOrNull(mapping.selfEnergyChange.petRecoverSP),
          recoverInterval: numberOrNull(
            mapping.selfEnergyChange.recoverInterval
          ),
          ownerScope: mapping.selfEnergyChange.ownerScope ?? null,
        }
      : null,
    skillLevelBridge: {
      status: mapping.skillLevelBridge?.status ?? null,
      source: mapping.skillLevelBridge?.source ?? null,
      levelRows: numberOrNull(mapping.skillLevelBridge?.levelRows) ?? 0,
      parameterIds: mapping.skillLevelBridge?.parameterIds ?? [],
      varyingParameterIds: mapping.skillLevelBridge?.varyingParameterIds ?? [],
      formulaSlotAlignment:
        mapping.skillLevelBridge?.formulaSlotAlignment ??
        compactFormulaSlotAlignment(
          mapping.skillLevelBridge?.formulaParamAlignment
        ),
      firstLevel: mapping.skillLevelBridge?.firstLevel
        ? {
            level: numberOrNull(mapping.skillLevelBridge.firstLevel.level),
            valueParam: mapping.skillLevelBridge.firstLevel.valueParam ?? null,
          }
        : null,
      lastLevel: mapping.skillLevelBridge?.lastLevel
        ? {
            level: numberOrNull(mapping.skillLevelBridge.lastLevel.level),
            valueParam: mapping.skillLevelBridge.lastLevel.valueParam ?? null,
          }
        : null,
      relatedElementLevelBridge: compactRelatedElementLevelBridge(
        mapping.skillLevelBridge?.relatedElementLevelBridge
      ),
    },
    applied: false,
  };
}

function summarizeActionHitCandidates(hitCandidates, sequenceTimingEvidence) {
  if (hitCandidates.length === 0) {
    return {
      status: 'no-per-hit-candidates',
      hitCandidateCount: 0,
      damageElementFieldMappingCount: 0,
      mappedHitCandidateCount: 0,
      sequenceTimingStatus:
        sequenceTimingEvidence?.status ??
        'normal-attack-sequence-timing-not-applicable',
      applied: false,
    };
  }

  const mappedHitCandidates = hitCandidates.filter(
    candidate => candidate.damageElementFieldMappingCount > 0
  );
  const summonTargetHitCandidates = hitCandidates.filter(
    candidate =>
      (numberOrNull(
        candidate.summonTargetEvidenceSummary?.damageElementCandidateCount
      ) ?? 0) > 0
  );

  return {
    status:
      mappedHitCandidates.length === hitCandidates.length
        ? 'all-hit-candidates-have-damage-element-fields'
        : mappedHitCandidates.length > 0
          ? 'partial-hit-candidates-have-damage-element-fields'
          : 'hit-candidates-missing-damage-element-fields',
    hitCandidateCount: hitCandidates.length,
    mappedHitCandidateCount: mappedHitCandidates.length,
    damageElementFieldMappingCount: hitCandidates.reduce(
      (sum, candidate) => sum + candidate.damageElementFieldMappingCount,
      0
    ),
    summonTargetMappedHitCandidateCount: summonTargetHitCandidates.length,
    summonTargetDamageElementFieldMappingCount: hitCandidates.reduce(
      (sum, candidate) =>
        sum +
        (numberOrNull(candidate.summonTargetDamageElementFieldMappingCount) ??
          0),
      0
    ),
    summonTargetDamageElementConfigIds: uniqueNumbers(
      hitCandidates.flatMap(
        candidate =>
          candidate.summonTargetEvidenceSummary?.damageElementConfigIds ?? []
      )
    ),
    summonTargetSkillIds: uniqueNumbers(
      hitCandidates.flatMap(
        candidate => candidate.summonTargetEvidenceSummary?.targetSkillIds ?? []
      )
    ),
    summonUnitIds: uniqueNumbers(
      hitCandidates.flatMap(
        candidate => candidate.summonTargetEvidenceSummary?.summonUnitIds ?? []
      )
    ),
    summonTargetTriggerTimingStatuses: uniqueStrings(
      hitCandidates.map(
        candidate => candidate.summonTargetEvidenceSummary?.triggerTimingStatus
      )
    ),
    summonTargetTriggerFrameCandidates: uniqueNumbers(
      hitCandidates.flatMap(
        candidate =>
          candidate.summonTargetEvidenceSummary?.triggerFrameCandidates ?? []
      )
    ),
    frameRate: AZPR_TIMELINE_FRAME_RATE,
    primaryFrames: hitCandidates
      .map(candidate => numberOrNull(candidate.primaryFrame))
      .filter(Number.isFinite),
    absolutePrimaryFrames: uniqueNumbers(
      hitCandidates
        .map(candidate => numberOrNull(candidate.absolutePrimaryFrame))
        .filter(Number.isFinite)
    ),
    sequenceChainStartFrames: uniqueNumbers(
      hitCandidates
        .map(candidate => numberOrNull(candidate.chainStartFrame))
        .filter(Number.isFinite)
    ),
    sequenceTimingStatus:
      sequenceTimingEvidence?.status ?? 'normal-attack-sequence-timing-missing',
    sequenceTimingSourceKind: sequenceTimingEvidence?.sourceKind ?? null,
    sequenceTimingTransitionCount:
      numberOrNull(sequenceTimingEvidence?.transitionCount) ?? 0,
    sequenceTimingResolvedTransitionCount:
      numberOrNull(sequenceTimingEvidence?.resolvedTransitionCount) ?? 0,
    sequenceTimingAbsoluteFrameStatus:
      sequenceTimingEvidence?.absoluteFrameStatus ?? null,
    sequenceTimingTransitions: (sequenceTimingEvidence?.transitions ?? []).map(
      transition => ({
        fromSkillId: numberOrNull(transition.fromSkillId),
        toSkillId: numberOrNull(transition.toSkillId),
        status: transition.status ?? null,
        bridgeStartFrame: numberOrNull(transition.bridgeStartFrame),
        bridgeFrameIndex: numberOrNull(transition.bridgeFrameIndex),
        bridgeEndFrame: numberOrNull(transition.bridgeEndFrame),
        chainStartFrame: numberOrNull(transition.chainStartFrame),
        allowedInputs: transition.allowedInputs ?? [],
        applied: false,
      })
    ),
    candidateElementConfigIds: uniqueNumbers(
      hitCandidates.flatMap(
        candidate => candidate.damageElementElementConfigIds
      )
    ),
    hpFormulaFunctionIds: uniqueNumbers(
      hitCandidates.flatMap(candidate => candidate.hpDamage.formulaFunctionIds)
    ),
    toughnessWeakBreakDamageRates: uniqueNumbers(
      hitCandidates.flatMap(
        candidate => candidate.toughnessDamage.weakBreakDamageRates
      )
    ),
    selfEnergyRecoverSPValues: uniqueNumbers(
      hitCandidates.flatMap(
        candidate => candidate.selfEnergyChange.recoverSPValues
      )
    ),
    applied: false,
  };
}

function frameToTimelineMs(frame) {
  return (Number(frame) * 1000) / AZPR_TIMELINE_FRAME_RATE;
}

function roundTimelineMs(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(6)) : null;
}

function msToTimelineFrame(value) {
  const timeMs = numberOrNull(value) ?? 0;
  return Math.max(0, Math.round(timeMs / AZPR_TIMELINE_FRAME_MS));
}

function roundCurveValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(6)) : 0;
}

function roundChartPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Number(Math.min(100, Math.max(0, number)).toFixed(4));
}

function formatTimelineFrame(frameIndex) {
  const frame = Math.max(0, Math.round(Number(frameIndex) || 0));
  const seconds = Math.floor(frame / AZPR_TIMELINE_FRAME_RATE);
  const remainFrames = frame % AZPR_TIMELINE_FRAME_RATE;
  return `${seconds}s${remainFrames}f`;
}

function createHpDamageResult(action, damageEvent, damageElementSource) {
  if (!damageEvent) {
    const sourceEvidence = createDamageElementChainSource(
      damageElementSource,
      'hpDamage'
    );
    return {
      value: 0,
      applied: false,
      status: isSkillAction(action)
        ? 'no-parseable-hp-damage'
        : 'not-applicable',
      formulaBreakdown: createNotApplicableBreakdown({
        kind: 'hp-damage',
        status: isSkillAction(action)
          ? 'no-parseable-hp-damage'
          : 'not-applicable',
        reason: isSkillAction(action)
          ? 'Skill action has no parseable damage multiplier.'
          : 'Non-skill action does not project HP damage.',
      }),
      sourceEvidence,
    };
  }

  if (damageEvent.payload?.stateEventKind) {
    return createVerifiedNotApplicableResult(
      'hp-damage',
      'verified-toughness-state-event-only'
    );
  }

  const sourceEvidence = attachFormulaCandidatePreview(
    createDamageElementChainSource(damageElementSource, 'hpDamage'),
    damageEvent.payload
  );

  return {
    value: damageEvent.payload.rawDamage,
    applied: true,
    status: 'raw-hp-projection',
    precision: damageEvent.payload.precision,
    confidence: damageEvent.payload.confidence,
    formulaBreakdown: attachDamageElementSourceToHpBreakdown(
      damageEvent.payload.formulaBreakdown,
      damageElementSource,
      damageEvent.payload
    ),
    sourceEvidence,
  };
}

function createToughnessDamageResult(action, damageEvent, damageElementSource) {
  if (damageEvent?.payload?.verifiedCombat === true) {
    const value = Number(damageEvent.payload.toughnessDamage) || 0;
    const sourceIdentity =
      damageEvent.payload.bindingIdentity ??
      damageEvent.payload.formulaBreakdown?.sourceIdentity ??
      null;
    return {
      value,
      applied: true,
      status: damageEvent.payload.stateEventKind
        ? 'verified-toughness-state-change-applied'
        : 'verified-toughness-damage-applied',
      precision: damageEvent.payload.precision,
      confidence: damageEvent.payload.confidence,
      sourceEvidence: {
        status: 'verified-combat-source-bound',
        sourceIdentity,
        elementConfigId: damageEvent.payload.elementId ?? null,
      },
      formulaBreakdown: {
        version: damageEvent.payload.stateEventKind
          ? 'azpr-verified-toughness-state-v1'
          : 'azpr-verified-toughness-damage-v1',
        status: 'verified-combat-formula-applied',
        expression: damageEvent.payload.stateEventKind
          ? damageEvent.payload.formulaBreakdown?.expression
          : 'verified weakness deduction from the same hit transaction',
        result: value,
        sourceIdentity,
        appliedLayerKeys: ['verifiedCombatHit'],
        unappliedLayerKeys: ['useOneBreak', 'cultivationEffects'],
        layers: {
          verifiedCombatHit: {
            value,
            applied: true,
            source: sourceIdentity,
          },
        },
      },
    };
  }
  const hasSkillDamage = isSkillAction(action) && Boolean(damageEvent);
  const sourceEvidence = createDamageElementChainSource(
    damageElementSource,
    'toughnessDamage'
  );
  const hasCandidateFields =
    sourceEvidence?.status === 'candidate-fields-found';

  return {
    value: 0,
    applied: false,
    status: hasSkillDamage
      ? hasCandidateFields
        ? 'candidate-fields-found-formula-unmapped'
        : 'formula-unmapped'
      : 'not-applicable',
    precision: 'unmapped',
    confidence: hasCandidateFields ? 'source-evidence' : 'unknown',
    sourceEvidence,
    formulaBreakdown: {
      version: 'stage5-toughness-breakdown-placeholder-v1',
      status: hasSkillDamage
        ? hasCandidateFields
          ? 'candidate-fields-found-formula-unmapped'
          : 'formula-unmapped'
        : 'not-applicable',
      expression: null,
      result: 0,
      appliedLayerKeys: [],
      unappliedLayerKeys: hasSkillDamage
        ? [
            'actionToughnessValue',
            'enemyToughnessState',
            'weaknessOrBreakModifier',
          ]
        : [],
      layers: {
        actionToughnessValue: {
          label: '动作削韧值',
          applied: false,
          status: hasSkillDamage
            ? hasCandidateFields
              ? 'candidate-fields-found-formula-unmapped'
              : 'skill-effect-node-unmapped'
            : 'not-applicable',
          source: sourceEvidence ?? {
            status: 'pending-skill-control-effect-node-mapping',
            note: 'pending skill_control/effect node mapping for toughness damage',
          },
        },
        enemyToughnessState: {
          label: '敌人韧性状态',
          applied: false,
          status: hasSkillDamage
            ? 'enemy-toughness-fields-unmapped'
            : 'not-applicable',
          source: 'pending enemy toughness table/effect evidence',
        },
      },
      limitations: hasSkillDamage
        ? [
            'Toughness damage must be mapped independently from HP damage.',
            hasCandidateFields
              ? 'TDamageElementParams toughness candidate fields are linked, but unit scale and target state rules are still unmapped.'
              : 'Current skill_control evidence is not yet resolved to toughness effect nodes.',
          ]
        : [],
    },
  };
}

function createSelfEnergyChangeResult(
  action,
  resourceEvents,
  damageElementSource,
  runtimeSampleContext = null
) {
  const energyEvents = resourceEvents.filter(event =>
    ['sp', 'energy'].includes(String(event.payload.resource))
  );
  const explicitDelta = energyEvents.reduce(
    (sum, event) => sum + (Number(event.payload.change) || 0),
    0
  );
  const hasExplicitDelta = energyEvents.length > 0;
  const skillAction = isSkillAction(action);
  const sourceEvidence = createDamageElementChainSource(
    damageElementSource,
    'selfEnergyChange',
    {
      action,
      runtimeSampleContext,
    }
  );
  const hasCandidateFields =
    sourceEvidence?.status === 'candidate-fields-found';
  const verifiedResource = energyEvents.some(
    event => event.payload?.verifiedCombat === true
  );

  return {
    value: explicitDelta,
    applied: hasExplicitDelta,
    status: hasExplicitDelta
      ? verifiedResource
        ? 'verified-resource-change-applied'
        : skillAction
          ? 'explicit-cost-applied-charge-formula-unmapped'
          : 'explicit-resource-delta-applied'
      : skillAction
        ? hasCandidateFields
          ? 'candidate-fields-found-charge-formula-unmapped'
          : 'charge-formula-unmapped'
        : 'not-applicable',
    resource: energyEvents[0]?.payload.resource ?? 'sp',
    precision: hasExplicitDelta
      ? verifiedResource
        ? 'verified-q16.16-resource-event'
        : 'explicit-delta'
      : 'unmapped',
    confidence: hasExplicitDelta
      ? energyEvents[0].payload.confidence
      : hasCandidateFields
        ? 'source-evidence'
        : 'unknown',
    sourceEvidence,
    runtimeFormulaProbe: sourceEvidence?.selfEnergyRuntimeFormulaProbe ?? null,
    formulaBreakdown: {
      version: verifiedResource
        ? 'azpr-verified-self-energy-v1'
        : 'stage5-self-energy-breakdown-placeholder-v1',
      status: hasExplicitDelta
        ? verifiedResource
          ? 'verified-resource-change-applied'
          : skillAction
            ? 'explicit-cost-applied-charge-formula-unmapped'
            : 'explicit-resource-delta-applied'
        : skillAction
          ? hasCandidateFields
            ? 'candidate-fields-found-charge-formula-unmapped'
            : 'charge-formula-unmapped'
          : 'not-applicable',
      expression: hasExplicitDelta
        ? 'sum(explicit self resource deltas)'
        : null,
      result: explicitDelta,
      appliedLayerKeys: hasExplicitDelta ? ['explicitResourceDelta'] : [],
      unappliedLayerKeys: verifiedResource
        ? ['cultivationEffects', 'unverifiedCallbacks']
        : skillAction
          ? ['actionChargeGain', 'hitEnergyGain', 'passiveEnergyModifiers']
          : [],
      layers: {
        explicitResourceDelta: {
          label: '显式资源变化',
          value: explicitDelta,
          applied: hasExplicitDelta,
          events: energyEvents.map((event, eventIndex) => ({
            eventIndex,
            eventType: event.type,
            actionId: event.actionId,
            actorId: event.actorId,
            timeMs: event.timeMs,
            resource: event.payload.resource,
            change: event.payload.change,
            reason: event.payload.reason,
            confidence: event.payload.confidence,
            hitKey: event.hitKey ?? null,
            hitIndex: event.hitIndex ?? null,
            hitSkillId: event.hitSkillId ?? null,
            elementId: event.payload.elementId ?? null,
            packageId: event.payload.packageId ?? null,
            sourceIdentity: event.payload.sourceIdentity ?? null,
          })),
        },
        actionChargeGain: {
          label: '动作充能',
          applied: false,
          status: skillAction
            ? hasCandidateFields
              ? 'candidate-fields-found-formula-unmapped'
              : 'formula-unmapped'
            : 'not-applicable',
          source: sourceEvidence ?? {
            status:
              'pending-skill-control-effect-node-and-skillsub-logic-mapping',
            note: 'pending skill_control/effect node and skillsub_logic energy mapping',
          },
        },
      },
      limitations: skillAction
        ? [
            'Current result applies explicit skill cost when present.',
            hasCandidateFields
              ? 'TDamageElementParams recoverSP candidate fields are linked, but owner, sharing and interval trigger rules are still unmapped.'
              : 'Energy gain/charge formula is still unmapped and must be tracked separately from HP damage.',
          ]
        : [],
    },
  };
}

function createActionDamageElementSource(action) {
  if (!isSkillAction(action)) {
    return null;
  }

  const skillId = Number(action.skillId);
  const skillMapping = DAMAGE_ELEMENT_FIELD_MAPPING_BY_SKILL_ID.get(skillId);
  const logicElementRows = action.logicModel?.elementValues ?? [];
  const logicElementIds = uniqueNumbers(
    logicElementRows.map(row => row.elementId)
  );
  const actionLevelElementSource = createActionLevelElementSource({
    action,
    skillId,
    logicElementRows,
    logicElementIds,
  });
  const logicElementRowByElementId = new Map(
    logicElementRows
      .map(row => [Number(row.elementId), row])
      .filter(([elementId]) => Number.isFinite(elementId))
  );

  if (!skillMapping) {
    return {
      kind: DAMAGE_ELEMENT_FIELD_MAPPING_EVIDENCE_KIND,
      file: SKILL_ASSET_EVIDENCE_PATH,
      status: 'no-damage-element-field-mapping-for-skill',
      skillId,
      actionVariantIndex: Number(
        action.actionVariantIndex ?? action.damageSegmentIndex ?? 0
      ),
      actionVariantLabel:
        action.selectedActionVariant?.label ??
        action.selectedDamageSegment?.label ??
        null,
      actionLevelElementSource,
      logicElementIds,
      matchedElementConfigIds: [],
      unbridgedElementConfigIds: [],
      candidates: [],
    };
  }

  const fieldMappings = skillMapping.fieldMappings ?? [];
  const matchedMappings = fieldMappings
    .filter(mapping =>
      logicElementIds.includes(Number(mapping.elementConfigId))
    )
    .sort(
      (left, right) =>
        Number(left.elementConfigId) - Number(right.elementConfigId)
    );
  const unbridgedElementConfigIds = fieldMappings
    .filter(
      mapping =>
        mapping.skillLevelBridge?.status ===
        'skillsub-element-level-bridge-missing'
    )
    .map(mapping => Number(mapping.elementConfigId))
    .filter(Number.isFinite);

  return {
    kind: DAMAGE_ELEMENT_FIELD_MAPPING_EVIDENCE_KIND,
    file: SKILL_ASSET_EVIDENCE_PATH,
    status:
      matchedMappings.length > 0
        ? 'candidate-fields-bridged-to-action-element-values'
        : 'candidate-fields-found-no-action-element-bridge',
    skillId,
    actionVariantIndex: Number(
      action.actionVariantIndex ?? action.damageSegmentIndex ?? 0
    ),
    actionVariantLabel:
      action.selectedActionVariant?.label ??
      action.selectedDamageSegment?.label ??
      null,
    actionLevelElementSource,
    logicElementIds,
    matchedElementConfigIds: matchedMappings.map(mapping =>
      Number(mapping.elementConfigId)
    ),
    unbridgedElementConfigIds,
    totalDamageElementCandidates: fieldMappings.length,
    bridgeMatchedLevelRows: matchedMappings.reduce(
      (sum, mapping) => sum + (mapping.skillLevelBridge?.levelRows ?? 0),
      0
    ),
    candidates: matchedMappings.map(mapping =>
      compactDamageElementMapping(
        mapping,
        logicElementRowByElementId.get(Number(mapping.elementConfigId))
      )
    ),
    note: 'TDamageElementParams fields are linked as candidate source evidence only; final HP/toughness/energy formulas remain unmapped.',
  };
}

function compactDamageElementMapping(mapping, currentLogicElementValue = null) {
  return {
    elementConfigId: Number(mapping.elementConfigId),
    pathId: mapping.pathId,
    containerPath: mapping.containerPath,
    mediaPackNames: mapping.mediaPackNames ?? [],
    currentLogicElementValue: compactCurrentLogicElementValue(
      currentLogicElementValue
    ),
    hpDamage: mapping.hpDamage
      ? {
          status: mapping.hpDamage.status,
          formulaFunctionIds: mapping.hpDamage.formulaFunctionIds,
          formulaFunctionEvidence: compactFormulaFunctionEvidence(
            mapping.hpDamage.formulaFunctionEvidence
          ),
          formulaSlotCandidates: mapping.hpDamage.formulaSlotCandidates,
          damageFields: mapping.hpDamage.damageFields,
        }
      : null,
    toughnessDamage: mapping.toughnessDamage
      ? {
          status: mapping.toughnessDamage.status,
          weakBreakDamageRate: mapping.toughnessDamage.weakBreakDamageRate,
          hitType: mapping.toughnessDamage.hitType,
          knockBackId: mapping.toughnessDamage.knockBackId,
          knockBackForce: mapping.toughnessDamage.knockBackForce,
          interruptPriority: mapping.toughnessDamage.interruptPriority,
          useOneBreak: mapping.toughnessDamage.useOneBreak,
        }
      : null,
    selfEnergyChange: mapping.selfEnergyChange
      ? {
          status: mapping.selfEnergyChange.status,
          recoverSP: mapping.selfEnergyChange.recoverSP,
          petRecoverSP: mapping.selfEnergyChange.petRecoverSP,
          recoverInterval: mapping.selfEnergyChange.recoverInterval,
          ownerScope: mapping.selfEnergyChange.ownerScope,
        }
      : null,
    skillLevelBridge: {
      status: mapping.skillLevelBridge?.status ?? 'unknown',
      levelRows: mapping.skillLevelBridge?.levelRows ?? 0,
      parameterIds: mapping.skillLevelBridge?.parameterIds ?? [],
      varyingParameterIds: mapping.skillLevelBridge?.varyingParameterIds ?? [],
      formulaSlotAlignment: compactFormulaSlotAlignment(
        mapping.skillLevelBridge?.formulaParamAlignment
      ),
      firstLevel: mapping.skillLevelBridge?.firstLevel
        ? {
            level: mapping.skillLevelBridge.firstLevel.level,
            valueParam: mapping.skillLevelBridge.firstLevel.valueParam,
          }
        : null,
      lastLevel: mapping.skillLevelBridge?.lastLevel
        ? {
            level: mapping.skillLevelBridge.lastLevel.level,
            valueParam: mapping.skillLevelBridge.lastLevel.valueParam,
          }
        : null,
      relatedElementLevelBridge: compactRelatedElementLevelBridge(
        mapping.skillLevelBridge?.relatedElementLevelBridge
      ),
    },
  };
}

function createActionLevelElementSource({
  action,
  skillId,
  logicElementRows,
  logicElementIds,
}) {
  const logicModel = action.logicModel ?? {};
  return {
    sourceKind: 'skill_logic.currentLevel.elementValues',
    sourcePath: 'skill-logic-index.json.levels.elementValues',
    skillsubEleValueTablePath: logicModel.skillsubEleValueTablePath ?? null,
    skillId: numberOrNull(skillId),
    level: numberOrNull(logicModel.level),
    levelIndex: numberOrNull(logicModel.levelIndex),
    subSkillId: numberOrNull(logicModel.subSkillId),
    skillLevelRowId: numberOrNull(logicModel.skillLevelRowId),
    elementConfigIds: logicElementIds,
    rowCount: logicElementRows.length,
    rows: logicElementRows.map(row => ({
      rowId: numberOrNull(row.rowId),
      elementConfigId: numberOrNull(row.elementId),
      valueParam: row.valueParam ?? '',
      paramPairs: parseValueParamPairs(row.valueParam),
      fieldPaths: row.fieldPaths ?? null,
      applied: false,
    })),
    applied: false,
  };
}

function createDamageElementChainSource(
  damageElementSource,
  chainKey,
  options = {}
) {
  if (!damageElementSource) {
    return null;
  }

  const candidates = damageElementSource.candidates
    .map(candidate => ({
      elementConfigId: candidate.elementConfigId,
      pathId: candidate.pathId,
      mediaPackNames: candidate.mediaPackNames,
      currentLogicElementValue: candidate.currentLogicElementValue,
      fieldCandidate: candidate[chainKey],
      skillLevelBridge: candidate.skillLevelBridge,
    }))
    .filter(candidate => candidate.fieldCandidate);
  const selfEnergyRuntimeFormulaProbe = createSelfEnergyRuntimeFormulaProbe(
    candidates,
    {
      sourceStatus:
        candidates.length > 0
          ? 'action-level-damage-element-candidates'
          : damageElementSource.status,
      action: options.action,
      runtimeSampleContext: options.runtimeSampleContext,
    }
  );

  return {
    kind: damageElementSource.kind,
    file: damageElementSource.file,
    status:
      candidates.length > 0
        ? 'candidate-fields-found'
        : damageElementSource.status,
    skillId: damageElementSource.skillId,
    actionVariantIndex: damageElementSource.actionVariantIndex,
    actionVariantLabel: damageElementSource.actionVariantLabel,
    actionLevelElementSource: damageElementSource.actionLevelElementSource,
    logicElementIds: damageElementSource.logicElementIds,
    matchedElementConfigIds: damageElementSource.matchedElementConfigIds,
    unbridgedElementConfigIds: damageElementSource.unbridgedElementConfigIds,
    candidateCount: candidates.length,
    bridgeMatchedLevelRows: damageElementSource.bridgeMatchedLevelRows ?? 0,
    formulaSlotAlignmentSummary: createFormulaSlotAlignmentSummary(candidates),
    formulaFunctionSummary:
      chainKey === 'hpDamage' ? createFormulaFunctionSummary(candidates) : [],
    selfEnergyRuntimeFormulaProbe:
      selfEnergyRuntimeFormulaProbe.status !==
      'recover-sp-runtime-probe-missing'
        ? selfEnergyRuntimeFormulaProbe
        : null,
    formulaCandidatePreview: null,
    candidates,
    note: damageElementSource.note,
  };
}

function compactCurrentLogicElementValue(row) {
  if (!row) {
    return null;
  }

  return {
    rowId: row.rowId ?? null,
    elementId: Number(row.elementId),
    valueParam: row.valueParam ?? '',
    paramPairs: parseValueParamPairs(row.valueParam),
  };
}

function compactFormulaFunctionEvidence(evidence) {
  if (!evidence) {
    return null;
  }

  return {
    status: evidence.status ?? 'unknown',
    relationStatus: evidence.relationStatus ?? 'unknown',
    applied: evidence.applied === true,
    matchedFunctionIds: evidence.matchedFunctionIds ?? [],
    unmatchedFunctionIds: evidence.unmatchedFunctionIds ?? [],
    functionRefs: (evidence.functionRefs ?? []).map(ref => ({
      field: ref.field,
      functionId: ref.functionId,
      status: ref.status,
      relationStatus: ref.relationStatus,
      elementFormulaRow: ref.elementFormulaRow
        ? {
            id: ref.elementFormulaRow.id,
            functionOutput: ref.elementFormulaRow.functionOutput,
            variables: ref.elementFormulaRow.variables ?? [],
          }
        : null,
      variableInputs: (ref.variableInputs ?? []).map(input => ({
        variable: input.variable,
        paramId: input.paramId,
        formulaParamSlot: input.formulaParamSlot,
        formulaParamValue: input.formulaParamValue,
        slotStatus: input.slotStatus,
      })),
      applied: ref.applied === true,
    })),
  };
}

function compactFormulaSlotAlignment(alignment) {
  if (!alignment) {
    return null;
  }

  return {
    status: alignment.status ?? 'unknown',
    conclusion: alignment.conclusion ?? 'unknown',
    directSlotMatchParamIds: alignment.directSlotMatchParamIds ?? [],
    overrideCandidateParamIds: alignment.overrideCandidateParamIds ?? [],
    parameterSummaries: (alignment.parameterSummaries ?? []).map(parameter => ({
      id: parameter.id,
      variable: parameter.variable,
      relationStatus: parameter.relationStatus,
      formulaParamValue: parameter.formulaParamValue,
      firstLevelValue: parameter.firstLevelValue,
      lastLevelValue: parameter.lastLevelValue,
      minValue: parameter.minValue,
      maxValue: parameter.maxValue,
      isConstantAcrossLevels: parameter.isConstantAcrossLevels,
      levelRows: parameter.levelRows,
      progression: parameter.progression
        ? {
            status: parameter.progression.status,
            step: parameter.progression.step,
            isArithmetic: parameter.progression.isArithmetic,
          }
        : null,
    })),
  };
}

function createFormulaSlotAlignmentSummary(candidates) {
  const summaries = candidates.flatMap(
    candidate =>
      candidate.skillLevelBridge?.formulaSlotAlignment?.parameterSummaries ?? []
  );
  const byParam = new Map();

  for (const summary of summaries) {
    const key = `${summary.id}:${summary.relationStatus}`;
    if (!byParam.has(key)) {
      byParam.set(key, {
        ...summary,
        candidateCount: 0,
      });
    }
    byParam.get(key).candidateCount += 1;
  }

  return [...byParam.values()].sort(
    (left, right) => Number(left.id) - Number(right.id)
  );
}

function createFormulaFunctionSummary(candidates) {
  const refs = candidates.flatMap(candidate =>
    (candidate.fieldCandidate?.formulaFunctionEvidence?.functionRefs ?? []).map(
      ref => ({
        ...ref,
        elementConfigId: candidate.elementConfigId,
      })
    )
  );
  const byRef = new Map();

  for (const ref of refs) {
    const key = [
      ref.field,
      ref.functionId,
      ref.elementFormulaRow?.functionOutput ?? '',
    ].join(':');
    if (!byRef.has(key)) {
      byRef.set(key, {
        field: ref.field,
        functionId: ref.functionId,
        status: ref.status,
        relationStatus: ref.relationStatus,
        functionOutput: ref.elementFormulaRow?.functionOutput ?? null,
        variables: ref.elementFormulaRow?.variables ?? [],
        variableInputs: [],
        candidateElementConfigIds: [],
        candidateCount: 0,
        applied: false,
      });
    }

    const summary = byRef.get(key);
    summary.candidateCount += 1;
    summary.candidateElementConfigIds.push(ref.elementConfigId);
    summary.variableInputs = mergeFormulaFunctionVariableInputs(
      summary.variableInputs,
      ref.variableInputs ?? []
    );
  }

  return [...byRef.values()]
    .map(summary => ({
      ...summary,
      candidateElementConfigIds: uniqueNumbers(
        summary.candidateElementConfigIds
      ),
      variableInputs: summary.variableInputs.sort(
        (left, right) => Number(left.paramId) - Number(right.paramId)
      ),
    }))
    .sort(
      (left, right) =>
        Number(left.functionId) - Number(right.functionId) ||
        String(left.field).localeCompare(String(right.field))
    );
}

function mergeFormulaFunctionVariableInputs(existingInputs, nextInputs) {
  const byVariable = new Map(
    existingInputs.map(input => [
      `${input.variable}:${input.paramId}:${input.formulaParamValue}`,
      { ...input },
    ])
  );

  for (const input of nextInputs) {
    const key = `${input.variable}:${input.paramId}:${input.formulaParamValue}`;
    if (!byVariable.has(key)) {
      byVariable.set(key, {
        variable: input.variable,
        paramId: input.paramId,
        formulaParamSlot: input.formulaParamSlot,
        formulaParamValue: input.formulaParamValue,
        slotStatus: input.slotStatus,
        candidateCount: 0,
      });
    }
    byVariable.get(key).candidateCount += 1;
  }

  return [...byVariable.values()];
}

function attachFormulaCandidatePreview(sourceEvidence, damagePayload) {
  if (!sourceEvidence || !damagePayload) {
    return sourceEvidence;
  }

  const formulaCandidatePreview = createFormulaCandidatePreview(
    sourceEvidence,
    damagePayload
  );
  return {
    ...sourceEvidence,
    formulaCandidatePreview,
  };
}

function createFormulaCandidatePreview(sourceEvidence, damagePayload) {
  const candidates = sourceEvidence.candidates ?? [];
  const functionPreviews = candidates.flatMap(candidate =>
    createCandidateFormulaFunctionPreviews(candidate, damagePayload)
  );
  const comparablePreviews = functionPreviews.filter(
    item => item.comparison?.status === 'compared-to-raw-projection'
  );
  const largeDifferencePreviews = comparablePreviews.filter(
    item => item.comparison?.differenceStatus === 'large-difference'
  );
  const combinationPreviews = createFormulaCombinationPreviews({
    functionPreviews,
    damagePayload,
  });

  return {
    status:
      functionPreviews.length > 0
        ? 'candidate-preview-computed-combination-unconfirmed'
        : 'no-formula-function-preview',
    applied: false,
    baseAttack: {
      key: 'self.ATK[0]',
      value: numberOrNull(damagePayload.attack),
      source: damagePayload.attackSource ?? null,
    },
    rawProjection: {
      value: numberOrNull(damagePayload.rawDamage),
      expression:
        damagePayload.formulaBreakdown?.expression ??
        'round(baseAttack.value * actionMultiplier.value)',
      actionMultiplier: numberOrNull(damagePayload.segment?.multiplier),
      rawMultiplier: damagePayload.segment?.rawValue ?? null,
      source: 'current-skill-level-description-raw-projection',
    },
    functionPreviews,
    combinationPreviews,
    diagnostics: {
      comparablePreviewCount: comparablePreviews.length,
      largeDifferenceCount: largeDifferencePreviews.length,
      combinationPreviewCount: combinationPreviews.length,
      combinationLargeDifferenceCount: combinationPreviews.filter(
        item => item.comparison?.differenceStatus === 'large-difference'
      ).length,
      statuses: uniqueStrings(
        [
          ...functionPreviews.map(
            item =>
              item.comparison?.differenceStatus ??
              item.comparison?.status ??
              item.status
          ),
          ...combinationPreviews.map(
            item =>
              item.comparison?.differenceStatus ??
              item.comparison?.status ??
              item.status
          ),
        ].filter(Boolean)
      ),
      note: 'Preview values are evidence diagnostics only. They do not define DamageElement function combination order or final damage.',
    },
  };
}

function createFormulaCombinationPreviews({ functionPreviews, damagePayload }) {
  const byElement = new Map();
  for (const preview of functionPreviews) {
    if (!byElement.has(preview.elementConfigId)) {
      byElement.set(preview.elementConfigId, []);
    }
    byElement.get(preview.elementConfigId).push(preview);
  }

  return [...byElement.entries()].flatMap(([elementConfigId, previews]) =>
    createFormulaCombinationPreviewsForElement({
      elementConfigId,
      previews,
      damagePayload,
    })
  );
}

function createFormulaCombinationPreviewsForElement({
  elementConfigId,
  previews,
  damagePayload,
}) {
  const f1 = previews.find(item => item.field === 'function_1');
  const f2 = previews.find(item => item.field === 'function_2');
  const hitCount = numberOrNull(damagePayload.segment?.hitModel?.hitCount);
  const variants = [];

  for (const source of ['formulaParamPreview', 'currentLevelPreview']) {
    const sourceLabel =
      source === 'currentLevelPreview'
        ? 'current-level-value-param'
        : 'formula-param-values';
    const f1Value = numberOrNull(f1?.[source]?.value);
    const f2Value = numberOrNull(f2?.[source]?.value);

    if (Number.isFinite(f2Value)) {
      variants.push(
        createFormulaCombinationPreview({
          elementConfigId,
          strategy: `function_2-${sourceLabel}`,
          expression: 'function_2',
          value: f2Value,
          source,
          functionValues: { function_2: f2Value },
          hitCount,
          rawProjectionValue: damagePayload.rawDamage,
        })
      );
    }

    if (Number.isFinite(f1Value) && Number.isFinite(f2Value)) {
      variants.push(
        createFormulaCombinationPreview({
          elementConfigId,
          strategy: `function_1-times-function_2-${sourceLabel}`,
          expression: 'function_1 * function_2',
          value: f1Value * f2Value,
          source,
          functionValues: {
            function_1: f1Value,
            function_2: f2Value,
          },
          hitCount,
          rawProjectionValue: damagePayload.rawDamage,
        }),
        createFormulaCombinationPreview({
          elementConfigId,
          strategy: `function_1-plus-function_2-${sourceLabel}`,
          expression: 'function_1 + function_2',
          value: f1Value + f2Value,
          source,
          functionValues: {
            function_1: f1Value,
            function_2: f2Value,
          },
          hitCount,
          rawProjectionValue: damagePayload.rawDamage,
        })
      );
    }
  }

  return variants;
}

function createFormulaCombinationPreview({
  elementConfigId,
  strategy,
  expression,
  value,
  source,
  functionValues,
  hitCount,
  rawProjectionValue,
}) {
  const roundedValue = Math.round(value);
  const comparison = createCombinationPreviewComparison({
    rawProjectionValue,
    roundedValue,
    hitCount,
  });

  return {
    elementConfigId,
    strategy,
    expression,
    inputSource:
      source === 'currentLevelPreview'
        ? 'skill_logic.currentLevel.valueParam'
        : 'TDamageElementParams.formulaParamValues',
    functionValues,
    value,
    roundedValue,
    hitCount,
    comparison,
    status: 'combination-preview-computed',
    applied: false,
  };
}

function createCombinationPreviewComparison({
  rawProjectionValue,
  roundedValue,
  hitCount,
}) {
  const rawValue = numberOrNull(rawProjectionValue);
  if (!Number.isFinite(rawValue) || !Number.isFinite(roundedValue)) {
    return {
      status: 'not-compared',
      reason: 'missing-raw-or-preview-value',
    };
  }

  const delta = roundedValue - rawValue;
  const ratioToRawProjection = rawValue === 0 ? null : roundedValue / rawValue;
  const requiredScaleToRaw =
    roundedValue === 0 ? null : rawValue / roundedValue;
  const requiredPerHitScaleToRaw =
    Number.isFinite(hitCount) &&
    hitCount > 0 &&
    Number.isFinite(requiredScaleToRaw)
      ? requiredScaleToRaw / hitCount
      : null;
  const absoluteRatio =
    ratioToRawProjection == null ? null : Math.abs(1 - ratioToRawProjection);

  return {
    status: 'compared-to-raw-projection',
    rawProjectionValue: rawValue,
    previewRoundedValue: roundedValue,
    delta,
    ratioToRawProjection,
    requiredScaleToRaw,
    requiredPerHitScaleToRaw,
    differenceStatus:
      absoluteRatio != null && absoluteRatio > 0.1
        ? 'large-difference'
        : 'close-to-raw-projection',
  };
}

function createCandidateFormulaFunctionPreviews(candidate, damagePayload) {
  const refs =
    candidate.fieldCandidate?.formulaFunctionEvidence?.functionRefs ?? [];
  return refs.map(ref =>
    createFormulaFunctionPreview({
      ref,
      candidate,
      damagePayload,
    })
  );
}

function createFormulaFunctionPreview({ ref, candidate, damagePayload }) {
  const functionOutput = ref.elementFormulaRow?.functionOutput ?? null;
  const formulaParamInputs = buildFormulaPreviewInputs({
    ref,
    candidate,
    damagePayload,
    mode: 'formula-param-values',
  });
  const currentLevelInputs = buildFormulaPreviewInputs({
    ref,
    candidate,
    damagePayload,
    mode: 'current-level-value-param',
  });
  const formulaParamEvaluation = evaluateFormulaOutput(
    functionOutput,
    formulaParamInputs.values
  );
  const currentLevelEvaluation = evaluateFormulaOutput(
    functionOutput,
    currentLevelInputs.values
  );
  const preferredEvaluation =
    currentLevelEvaluation.status === 'computed'
      ? currentLevelEvaluation
      : formulaParamEvaluation;
  const comparison = createFormulaPreviewComparison({
    functionOutput,
    rawProjectionValue: damagePayload.rawDamage,
    evaluation: preferredEvaluation,
  });

  return {
    elementConfigId: candidate.elementConfigId,
    field: ref.field,
    functionId: ref.functionId,
    functionOutput,
    status:
      formulaParamEvaluation.status === 'computed' ||
      currentLevelEvaluation.status === 'computed'
        ? 'preview-computed'
        : 'preview-unsupported',
    applied: false,
    formulaParamPreview: {
      inputSource: 'TDamageElementParams.formulaParamValues',
      inputs: formulaParamInputs.publicInputs,
      value: formulaParamEvaluation.value,
      roundedValue: formulaParamEvaluation.roundedValue,
      status: formulaParamEvaluation.status,
      reason: formulaParamEvaluation.reason ?? null,
    },
    currentLevelPreview: {
      inputSource: 'skill_logic.currentLevel.valueParam',
      valueParam: candidate.currentLogicElementValue?.valueParam ?? null,
      rowId: candidate.currentLogicElementValue?.rowId ?? null,
      inputs: currentLevelInputs.publicInputs,
      value: currentLevelEvaluation.value,
      roundedValue: currentLevelEvaluation.roundedValue,
      status: currentLevelEvaluation.status,
      reason: currentLevelEvaluation.reason ?? null,
    },
    comparison,
    unresolved: [
      'function-combination-order',
      'value-param-override-rule',
      'hit-count-and-segment-binding',
      'enemy-defense-and-resistance-application',
    ],
  };
}

function buildFormulaPreviewInputs({ ref, candidate, damagePayload, mode }) {
  const values = {
    SELF_ATK_0: numberOrNull(damagePayload.attack),
  };
  const publicInputs = [
    {
      key: 'self.ATK[0]',
      value: values.SELF_ATK_0,
      source: damagePayload.attackSource ?? null,
    },
  ];
  const currentParamPairs = new Map(
    (candidate.currentLogicElementValue?.paramPairs ?? []).map(pair => [
      Number(pair.id),
      pair,
    ])
  );

  for (const input of ref.variableInputs ?? []) {
    const paramId = Number(input.paramId);
    const currentPair = currentParamPairs.get(paramId);
    const selectedValue =
      mode === 'current-level-value-param' &&
      Number.isFinite(currentPair?.value)
        ? currentPair.value
        : input.formulaParamValue;

    values[input.variable] = numberOrNull(selectedValue);
    publicInputs.push({
      key: input.variable,
      paramId,
      value: numberOrNull(selectedValue),
      source:
        mode === 'current-level-value-param' &&
        Number.isFinite(currentPair?.value)
          ? 'skill_logic.currentLevel.valueParam'
          : 'TDamageElementParams.formulaParamValues',
      fallbackUsed:
        mode === 'current-level-value-param' &&
        !Number.isFinite(currentPair?.value),
      formulaParamValue: numberOrNull(input.formulaParamValue),
      currentLevelValue: Number.isFinite(currentPair?.value)
        ? currentPair.value
        : null,
    });
  }

  return {
    values,
    publicInputs,
  };
}

function evaluateFormulaOutput(functionOutput, inputValues) {
  if (!functionOutput) {
    return {
      status: 'unsupported',
      value: null,
      roundedValue: null,
      reason: 'missing-function-output',
    };
  }

  const expression = normalizeFormulaExpression(functionOutput);
  if (!expression) {
    return {
      status: 'unsupported',
      value: null,
      roundedValue: null,
      reason: 'unsupported-formula-expression',
    };
  }

  const missingInput = [...expression.matchAll(/\b[A-Z][A-Z0-9_]*\b/g)]
    .map(match => match[0])
    .find(name => !Number.isFinite(inputValues[name]));
  if (missingInput) {
    return {
      status: 'unsupported',
      value: null,
      roundedValue: null,
      reason: `missing-input-${missingInput}`,
    };
  }

  const substituted = expression.replace(/\b[A-Z][A-Z0-9_]*\b/g, name =>
    String(inputValues[name])
  );
  const value = evaluateArithmeticExpression(substituted);
  if (!Number.isFinite(value)) {
    return {
      status: 'unsupported',
      value: null,
      roundedValue: null,
      reason: 'evaluation-failed',
    };
  }

  return {
    status: 'computed',
    value,
    roundedValue: Math.round(value),
    reason: null,
  };
}

function normalizeFormulaExpression(functionOutput) {
  const expression = String(functionOutput)
    .replaceAll('self.ATK[0]', 'SELF_ATK_0')
    .replace(/\s+/g, '');
  return /^[0-9A-Z_+\-*/().]+$/.test(expression) ? expression : '';
}

function evaluateArithmeticExpression(expression) {
  let index = 0;

  function parseExpression() {
    let value = parseTerm();
    while (index < expression.length) {
      const operator = expression[index];
      if (operator !== '+' && operator !== '-') {
        break;
      }
      index += 1;
      const next = parseTerm();
      value = operator === '+' ? value + next : value - next;
    }
    return value;
  }

  function parseTerm() {
    let value = parseFactor();
    while (index < expression.length) {
      const operator = expression[index];
      if (operator !== '*' && operator !== '/') {
        break;
      }
      index += 1;
      const next = parseFactor();
      value = operator === '*' ? value * next : value / next;
    }
    return value;
  }

  function parseFactor() {
    if (expression[index] === '(') {
      index += 1;
      const value = parseExpression();
      if (expression[index] !== ')') {
        return NaN;
      }
      index += 1;
      return value;
    }

    const start = index;
    if (expression[index] === '-') {
      index += 1;
    }
    while (/[0-9.]/.test(expression[index] ?? '')) {
      index += 1;
    }
    if (start === index) {
      return NaN;
    }
    return Number(expression.slice(start, index));
  }

  const value = parseExpression();
  return index === expression.length ? value : NaN;
}

function createFormulaPreviewComparison({
  functionOutput,
  rawProjectionValue,
  evaluation,
}) {
  const rawValue = numberOrNull(rawProjectionValue);
  const usesAttack = String(functionOutput ?? '').includes('self.ATK[0]');
  if (!usesAttack) {
    return {
      status: 'not-compared-scalar-candidate',
      reason: 'formula-output-does-not-reference-self-attack',
    };
  }
  if (evaluation.status !== 'computed' || !Number.isFinite(rawValue)) {
    return {
      status: 'not-compared',
      reason: evaluation.reason ?? 'missing-raw-projection',
    };
  }

  const roundedValue = evaluation.roundedValue;
  const delta = roundedValue - rawValue;
  const ratioToRawProjection = rawValue === 0 ? null : roundedValue / rawValue;
  const absoluteRatio =
    ratioToRawProjection == null ? null : Math.abs(1 - ratioToRawProjection);

  return {
    status: 'compared-to-raw-projection',
    rawProjectionValue: rawValue,
    previewRoundedValue: roundedValue,
    delta,
    ratioToRawProjection,
    differenceStatus:
      absoluteRatio != null && absoluteRatio > 0.1
        ? 'large-difference'
        : 'close-to-raw-projection',
  };
}

function parseValueParamPairs(rawValue) {
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

function createSummonTargetLookupByUnitId(evidence) {
  const byUnitId = new Map();
  for (const target of evidence?.targets ?? []) {
    const summonUnitId = numberOrNull(target.summonUnitId);
    if (!Number.isFinite(summonUnitId)) {
      continue;
    }
    byUnitId.set(summonUnitId, target);
  }
  return byUnitId;
}

function createDamageElementFieldMappingBySkillIdAndPathId(evidence) {
  return createSkillPathLookup(evidence?.skills, 'fieldMappings');
}

function createExternalElementObjectBySkillIdAndPathId(evidence) {
  return createSkillPathLookup(evidence?.skills, 'objects');
}

function createSkillPathLookup(skills = [], collectionKey) {
  const bySkillId = new Map();
  for (const skill of skills ?? []) {
    const skillId = numberOrNull(skill.skillId);
    if (!Number.isFinite(skillId)) {
      continue;
    }

    const byPathId = new Map();
    for (const item of skill[collectionKey] ?? []) {
      addPathLookupItem(byPathId, item?.pathId, item);
    }
    bySkillId.set(skillId, byPathId);
  }
  return bySkillId;
}

function addPathLookupItem(byPathId, pathId, item) {
  const key = pathLookupKey(pathId);
  if (key && !byPathId.has(key)) {
    byPathId.set(key, item);
  }
}

function findExternalElementObjectBySkillPathId(skillId, pathId) {
  return findSkillPathLookupItem(
    EXTERNAL_ELEMENT_OBJECT_BY_SKILL_ID_AND_PATH_ID,
    skillId,
    pathId
  );
}

function findDamageElementFieldMappingBySkillPathId(skillId, pathId) {
  return findSkillPathLookupItem(
    DAMAGE_ELEMENT_FIELD_MAPPING_BY_SKILL_ID_AND_PATH_ID,
    skillId,
    pathId
  );
}

function findSkillPathLookupItem(bySkillId, skillId, pathId) {
  const numericSkillId = numberOrNull(skillId);
  const key = pathLookupKey(pathId);
  if (!Number.isFinite(numericSkillId) || !key) {
    return null;
  }
  return bySkillId.get(numericSkillId)?.get(key) ?? null;
}

function pathLookupKey(pathId) {
  const key = String(pathId ?? '').trim();
  return key.length > 0 ? key : null;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function arrayOrSingle(value) {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function attachDamageElementSourceToHpBreakdown(
  formulaBreakdown,
  damageElementSource,
  damagePayload = null
) {
  const sourceEvidence = attachFormulaCandidatePreview(
    createDamageElementChainSource(damageElementSource, 'hpDamage'),
    damagePayload
  );
  if (!formulaBreakdown || !sourceEvidence) {
    return formulaBreakdown;
  }

  return {
    ...formulaBreakdown,
    unappliedLayerKeys: uniqueStrings([
      ...(formulaBreakdown.unappliedLayerKeys ?? []),
      'damageElementFields',
    ]),
    layers: {
      ...(formulaBreakdown.layers ?? {}),
      damageElementFields: {
        label: '伤害元素字段',
        applied: false,
        status:
          sourceEvidence.status === 'candidate-fields-found'
            ? 'candidate-fields-found-formula-unmapped'
            : sourceEvidence.status,
        source: sourceEvidence,
      },
    },
    limitations: uniqueStrings([
      ...(formulaBreakdown.limitations ?? []),
      'TDamageElementParams HP candidate fields are linked, but formula scaling and hit-to-action mapping are still unmapped.',
    ]),
  };
}

function createNotApplicableBreakdown({ kind, status, reason }) {
  return {
    version: `stage5-${kind}-not-applicable-v1`,
    status,
    expression: null,
    result: 0,
    appliedLayerKeys: [],
    unappliedLayerKeys: [],
    layers: {},
    limitations: [reason],
  };
}

function groupEventsByActionId(events) {
  const groups = new Map();
  for (const event of events) {
    const group = groups.get(event.actionId) ?? [];
    group.push(event);
    groups.set(event.actionId, group);
  }
  return groups;
}

function isSkillAction(action) {
  return action.type === 'skill';
}

function uniqueNumbers(values) {
  return [
    ...new Set(values.map(value => Number(value)).filter(Number.isFinite)),
  ].sort((left, right) => left - right);
}

function uniqueStrings(values) {
  return [
    ...new Set(
      values
        .filter(value => value != null && String(value).trim() !== '')
        .map(value => String(value))
    ),
  ];
}
