import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const PERIODIC_PERSISTENT_PROPERTY_EVIDENCE_RELATIVE_PATH =
  'scripts/optimization-qualification/evidence/periodic-persistent-property-runtime-evidence.json';

const REQUIRED_METHODS = Object.freeze([
  ['Lens.Gameplay.Modules.BigWorld.TriggerElement.OnUpdate', '0x13BD190', 'protected override void OnUpdate(float deltaTime) { }'],
  ['Lens.Gameplay.Modules.BigWorld.TriggerElement.CheckCondition', '0x13B58F0', 'private bool CheckCondition(TTriggerElementParams.TriggerConditionType conditionType, ElementTriggerDataBase triggerData) { }'],
  ['Lens.Gameplay.Modules.BigWorld.TriggerElement.CheckNormalCondition', '0x13B5E60', 'private bool CheckNormalCondition(TTriggerElementParams.TriggerElementCondition condition, ElementTriggerDataBase triggerData) { }'],
  ['Lens.Gameplay.Modules.BigWorld.TriggerElement.GetTriggerTarget', '0x13BBF50', 'private List<EntityHandle> GetTriggerTarget(ElementTriggerDataBase triggerData, int targetType, int factionType, bool onlyCheck) { }'],
  ['Lens.Gameplay.Modules.BigWorld.TriggerElement.GetSelfPet', '0x13BB640', 'private EntityHandle GetSelfPet() { }'],
  ['Lens.Gameplay.Modules.BigWorld.TriggerElement.TriggerEffect', '0x13BE0C0', 'private void TriggerEffect(TTriggerElementParams.TriggerElementEffect effect, EntityHandle handle, int effectIndex, ElementTriggerDataBase triggerData) { }'],
  ['Lens.Gameplay.Modules.BigWorld.ChangePropertyElement.Parse', '0x137D670', 'public override void Parse(TElementParams param, int skillId, CustomBattleVerifyInfo verifyInfo) { }'],
  ['Lens.Gameplay.Modules.BigWorld.ChangePropertyElement.Combine', '0x137A120', 'public override void Combine(IElement element) { }'],
  ['Lens.Gameplay.Modules.BigWorld.FormulaUtility.Calculate', '0x187C840', 'public static MyFloat Calculate(TElement_formula formulaData, IElement element, List<int> functionParams, AliveData self, AliveData target, AliveData source) { }'],
].map(([identity, rva, declaration]) => ({ identity, rva, declaration })));

const REQUIRED_FIELDS = Object.freeze([
  ['TriggerElement.m_count', 'private int m_count; // 0x248'],
  ['TriggerElement.m_currentTriggerFrequency', 'private int m_currentTriggerFrequency; // 0x264'],
  ['TriggerElement.m_timeExeFirstFrame', 'private bool m_timeExeFirstFrame; // 0x268'],
  ['TriggerElement.m_triggerParam1', 'private int m_triggerParam1; // 0x27C'],
  ['TriggerElement.m_triggerParam2', 'private int m_triggerParam2; // 0x280'],
  ['TriggerElement.m_interval', 'private MyFloat m_interval; // 0x288'],
  ['TTriggerElementParams.triggerConditionList', 'public List<TTriggerElementParams.TriggerElementCondition> triggerConditionList; // 0x118'],
  ['TTriggerElementParams.triggerEffectList', 'public List<TTriggerElementParams.TriggerElementEffect> triggerEffectList; // 0x130'],
  ['TTriggerElementParams.duration', 'public int duration; // 0x144'],
].map(([identity, declaration]) => ({ identity, declaration })));

const REQUIRED_ENUMS = Object.freeze([
  ['EElementTriggerType.TimeEvent', 'public const EElementTriggerType TimeEvent = 0;', '[Description("时间触发")]'],
  ['EElementTimeTriggerType.LoopEvent', 'public const EElementTimeTriggerType LoopEvent = 1;', '[Description("循环倒计时触发")]'],
  ['EElementTriggerConditionType.AND', 'public const EElementTriggerConditionType AND = 0;', null],
  ['EElementNormalFixedConditionType.HasElementId', 'public const EElementNormalFixedConditionType HasElementId = 1;', '[Description("目标主体拥有元素ID")]'],
  ['ETriggerEffectTargetType.Self', 'public const ETriggerEffectTargetType Self = 0;', '[Description("自身")]'],
  ['ETriggerEffectTargetType.SelfPet', 'public const ETriggerEffectTargetType SelfPet = 13;', '[Description("自带宠物")]'],
  ['ECombineType.Cover', 'public const ECombineType Cover = 3;', '[Description("覆盖")]'],
].map(([identity, declaration, description]) => ({ identity, declaration, description })));

const REQUIRED_RANGES = Object.freeze([
  ['normal-has-element-id', '0x13b6199-0x13b633a', 417, '97a526442d59fa271d8697815e98541be2c7707f3640f9944631572163bb770d'],
  ['formula-condition-dispatch', '0x13b5c03-0x13b5d38', 309, '493a6f9776561a152a1574bca22737181f059b63fe6c6efa5e1fed9ffd58e261'],
  ['time-loop-trigger', '0x13bd342-0x13bd44e', 268, '97a8043162ac0e62490f97db4f71c23be6f89243ac6aead17cd8ff60d7056d62'],
  ['effect-target-dispatch-through-self-pet', '0x13bc0ec-0x13bc20f', 291, 'f25c9db991989c1653918dd7f018afdccfd037b5399f1ebfb5328115452f9c08'],
  ['self-pet-resolution', '0x13bb640-0x13bb81a', 474, 'aab9af9314211588668381c399b11aa4ed7473654b8a66774ae43fbe1933f771'],
  ['trigger-effect-target-call', '0x13be3fc-0x13be428', 44, '3ed3a002eb89229c8142d9fcbffbeff4868271fee328d761e4fdf9dacbad9f31'],
  ['property-duration-parse', '0x137d7f8-0x137d83a', 66, 'a02b465cf138291d1e808f264839493a16f2b6004d4edbfa392811543162e56a'],
  ['property-cover-combine', '0x137a1b6-0x137a226', 112, '8f803e4e100de3dfcb98c4e3072d41e21e0f97c9bf8810a103ff82ae07e52863'],
].map(([identity, range, bytes, sha256]) => ({ identity, range, bytes, sha256 })));

const REQUIRED_ROOTS = Object.freeze([
  { rootElementId: 19004600, intervalMs: 1000, markElementId: 250, strictThreshold: 1, targetType: 0, leafElementId: 19004601, leafDurationMs: 1100, deleteChildElementOnUnload: true, propertyTags: [302, 303], attributeId: 21, combineNumber: 0, baseFunctionId: 5, disposition: 'runtime-applied', multiPropertyTagSemantics: { contractName: 'AzPrBattlePropertyTagMatchingRuntimeEvidence', matchMode: 'any-overlap-event-driven', sourceIdentity: 'GameAssembly.dll#BattlePropertyData.DynamicBattlePropertyValue.GetValue@0x12D3300/SetValue@0x12D34F0/BattlePropertyData.GetPropertyValue@0x12BE540' } },
  { rootElementId: 19006000, intervalMs: 1000, markElementId: 750, strictThreshold: 2, targetType: 0, leafElementId: 19006001, leafDurationMs: 1100, deleteChildElementOnUnload: true, propertyTags: [], attributeId: 8, combineNumber: 0, baseFunctionId: 5, disposition: 'runtime-applied' },
  { rootElementId: 19004901, intervalMs: 1000, markElementId: 650, strictThreshold: 1, targetType: 0, leafElementId: 19004902, leafDurationMs: 1200, deleteChildElementOnUnload: false, propertyTags: [], attributeId: 222, combineNumber: -1, baseFunctionId: 5, disposition: 'runtime-applied', requiresHasElementId: true },
  { rootElementId: 19007701, intervalMs: 2000, markElementId: null, strictThreshold: null, targetType: 13, leafElementId: 19007702, leafDurationMs: 2300, deleteChildElementOnUnload: false, propertyTags: [], attributeId: 21, combineNumber: -1, baseFunctionId: 5, disposition: 'runtime-applied' },
]);

const REQUIRED_SEMANTICS = Object.freeze({
  installation: 'frame-zero-self-root-installed-once-from-loadout-control',
  timeLoop: 'first-positive-update-when-timeExeFirstFrame-then-strict-elapsed-greater-than-ordinal-times-interval',
  conditionCadence: 'period-counter-advances-before-condition-check-so-failed-condition-consumes-that-period',
  formulaCondition: 'condition-type-at-least-5000-loads-element-formula-by-condition-value-and-compares-calculated-result-to-zero',
  normalHasElementId: 'condition-type-1-checks-the-trigger-subject-current-element-collection-for-the-config-id',
  conditionLogic: 'and',
  effectTargetSelf: 'trigger-effect-target-type-0-resolves-native-self',
  effectTargetSelfPet: 'trigger-effect-target-type-13-dispatches-to-GetSelfPet',
  leafLifetime: 'finite-property-leaf-duration-is-independent-from-persistent-root-lifetime',
  cover: 'same-source-property-leaf-refreshes-without-stacking',
  rightOpenLifetime: 'active-from-apply-inclusive-until-expiry-exclusive',
  unload: 'root-removal-stops-future-periodic-triggers-and-deleteChildElement-controls-immediate-child-removal',
  sameFrameCanonicalOrder: 'periodic-on-update-settlement-follows-already-materialized-action-and-tuning-transactions-at-the-same-frame',
  multiPropertyTagMatch: 'any-overlap-event-driven',
});

export async function readPeriodicPersistentPropertyRuntimeEvidenceSource({ sourcePath, gameAssemblyPath, il2CppDumpPath, battleElementAssetsPath, elementFormulaPath, projectRoot }) {
  const [sourceBytes, binary, dumpBytes, battleBytes, formulaBytes] = await Promise.all([
    fs.readFile(sourcePath), fs.readFile(gameAssemblyPath), fs.readFile(il2CppDumpPath), fs.readFile(battleElementAssetsPath), fs.readFile(elementFormulaPath),
  ]);
  const value = JSON.parse(sourceBytes.toString('utf8'));
  const observations = {
    binaryIdentity: createFileIdentity(gameAssemblyPath, binary),
    dumpIdentity: createFileIdentity(il2CppDumpPath, dumpBytes),
    battleIdentity: createFileIdentity(battleElementAssetsPath, battleBytes),
    formulaIdentity: createFileIdentity(elementFormulaPath, formulaBytes),
    dumpText: dumpBytes.toString('utf8'),
    battleRows: readBattleRows(battleBytes.toString('utf8')),
    formulaRows: JSON.parse(formulaBytes.toString('utf8')).rows ?? [],
    rangeHashes: Object.fromEntries(REQUIRED_RANGES.map(required => {
      const bytes = readPortableExecutableRvaRange(binary, required.range);
      return [required.identity, { range: required.range, bytes: bytes.byteLength, sha256: hashBytes(bytes) }];
    })),
  };
  validatePeriodicPersistentPropertyRuntimeEvidence(value, observations);
  return {
    path: normalizeSourcePath(sourcePath, projectRoot), bytes: sourceBytes.byteLength, sha256: hashBytes(sourceBytes),
    value: { ...value, verifiedBinary: observations.binaryIdentity, verifiedIl2CppDump: observations.dumpIdentity }, observations,
  };
}

export function validatePeriodicPersistentPropertyRuntimeEvidence(value, observations) {
  if (Number(value?.schemaVersion) !== 1 || value?.contractName !== 'AzPrPeriodicPersistentPropertyRuntimeEvidence' || value?.conclusion?.status !== 'applied') fail('contract-invalid');
  assertIdentity(value.reviewedBinary, observations?.binaryIdentity, 'binary-drift');
  assertIdentity(value.reviewedIl2CppDump, observations?.dumpIdentity, 'dump-drift');
  assertIdentity(value.reviewedBattleElements, observations?.battleIdentity, 'battle-elements-drift');
  assertIdentity(value.reviewedElementFormula, observations?.formulaIdentity, 'element-formula-drift');
  for (const required of REQUIRED_METHODS) {
    const row = value.dumpBindings?.methods?.find(candidate => candidate.identity === required.identity);
    if (row?.rva !== required.rva || row?.declaration !== required.declaration || !dumpBindsMethod(observations?.dumpText, required.rva, required.declaration)) fail('method-binding-drift', required.identity);
  }
  for (const required of REQUIRED_FIELDS) {
    const row = value.dumpBindings?.fields?.find(candidate => candidate.identity === required.identity);
    if (row?.declaration !== required.declaration || !observations?.dumpText?.includes(required.declaration)) fail('field-binding-drift', required.identity);
  }
  for (const required of REQUIRED_ENUMS) {
    const row = value.dumpBindings?.enums?.find(candidate => candidate.identity === required.identity);
    if (row?.declaration !== required.declaration || row?.description !== required.description || !observations?.dumpText?.includes(required.declaration) || (required.description != null && !observations?.dumpText?.includes(required.description))) fail('enum-binding-drift', required.identity);
  }
  for (const required of REQUIRED_RANGES) {
    const row = value.binaryRanges?.find(candidate => candidate.identity === required.identity);
    const observed = observations?.rangeHashes?.[required.identity];
    if (row?.range !== required.range || Number(row?.bytes) !== required.bytes || row?.sha256 !== required.sha256 || observed?.range !== required.range || Number(observed?.bytes) !== required.bytes || observed?.sha256 !== required.sha256) fail('range-drift', required.identity);
  }
  const formula = observations?.formulaRows?.find(row => Number(row.id) === 1007);
  if (value.formulaContract?.expression !== 'IF(self.ELEMENT_LAYERS[J]>K,G,0)' || formula?.functionOutput !== value.formulaContract.expression || value.formulaContract.comparison !== 'strictly-greater-than') fail('formula-contract-drift');
  const rowsById = new Map((observations?.battleRows ?? []).map(row => [Number(row.typetree?.elementConfigId), row]));
  for (const required of REQUIRED_ROOTS) validateRootContract(value, rowsById, required);
  assertExactProperties(value.semantics, REQUIRED_SEMANTICS, 'semantics-drift');
  const applied = value.conclusion?.runtimeAppliedRootElementIds ?? [];
  const blocked = value.conclusion?.evidenceInsufficientRootElementIds ?? [];
  if (JSON.stringify(applied) !== JSON.stringify([19004600, 19004901, 19006000, 19007701]) || JSON.stringify(blocked) !== JSON.stringify([])) fail('conclusion-drift');
  return true;
}

export function assertPeriodicPersistentPropertyRuntimeEvidenceReference(reference, source) {
  assertExactProperties(reference, {
    path: source?.path, bytes: source?.bytes, sha256: source?.sha256,
    binaryPath: source?.value?.reviewedBinary?.path, binaryBytes: source?.value?.reviewedBinary?.bytes, binarySha256: source?.value?.reviewedBinary?.sha256,
    il2CppDumpPath: source?.value?.reviewedIl2CppDump?.path, il2CppDumpBytes: source?.value?.reviewedIl2CppDump?.bytes, il2CppDumpSha256: source?.value?.reviewedIl2CppDump?.sha256,
    battleElementsPath: source?.value?.reviewedBattleElements?.path, battleElementsBytes: source?.value?.reviewedBattleElements?.bytes, battleElementsSha256: source?.value?.reviewedBattleElements?.sha256,
    elementFormulaPath: source?.value?.reviewedElementFormula?.path, elementFormulaBytes: source?.value?.reviewedElementFormula?.bytes, elementFormulaSha256: source?.value?.reviewedElementFormula?.sha256,
  }, 'report-reference-drift');
  return true;
}

function validateRootContract(value, rowsById, required) {
  const contract = value.rootContracts?.find(row => Number(row.rootElementId) === required.rootElementId);
  const root = rowsById.get(required.rootElementId)?.typetree;
  const leafRow = rowsById.get(required.leafElementId);
  const leaf = leafRow?.typetree;
  if (!contract || !root || !leaf) fail('root-source-missing', required.rootElementId);
  const conditions = root.triggerConditionList ?? [];
  const formulaCondition = conditions.find(row => Number(row.conditionParam1) === 10000 && Number(row.conditionParam2) === 1007);
  const hasElementCondition = conditions.find(row => Number(row.conditionParam1) === 1 && Number(row.conditionParam2) === required.markElementId);
  const targetEffect = (root.triggerEffectList ?? [])[0];
  if (Number(root.triggerType) !== 0 || Number(root.triggerParam1) !== 1 || Number(root.triggerParam2) !== required.intervalMs || Number(root.timeExeFirstFrame) !== 1 || Number(root.triggerCounter) !== -1 || Number(root.duration) !== -1 || Number(root.triggerConditionType) !== 0 || Boolean(Number(root.deleteChildElement)) !== required.deleteChildElementOnUnload || Number(targetEffect?.targetType) !== required.targetType || Number(targetEffect?.targetElement?.m_PathID) !== Number(leafRow.path_id)) fail('root-fields-drift', required.rootElementId);
  if (required.markElementId == null ? conditions.length !== 0 : (!formulaCondition || Number(root.formulaParams?.formulaParamValues?.[9]) !== required.markElementId || Number(root.formulaParams?.formulaParamValues?.[10]) !== required.strictThreshold)) fail('root-condition-drift', required.rootElementId);
  if (Boolean(required.requiresHasElementId) !== Boolean(hasElementCondition)) fail('root-has-element-condition-drift', required.rootElementId);
  if (Number(leaf.attributeID) !== required.attributeId || Number(leaf.calculateType) !== 1 || Number(leaf.time) !== required.leafDurationMs || Number(leaf.combineType) !== 3 || Number(leaf.combineNumber) !== required.combineNumber || Number(leaf.executeTargetType) !== 0 || Number(leaf.inheritType) !== 0 || Number(leaf.formulaParams?.function_1) !== 1 || Number(leaf.formulaParams?.function_2) !== required.baseFunctionId || Number(leaf.formulaParams?.formulaParamValues?.[6]) !== 10000 || JSON.stringify(leaf.defaultPropertyTags ?? []) !== JSON.stringify(required.propertyTags)) fail('leaf-fields-drift', required.leafElementId);
  if (Number(contract.intervalMs) !== required.intervalMs || Number(contract.targetType) !== required.targetType || Number(contract.leafElementId) !== required.leafElementId || Number(contract.leafDurationMs) !== required.leafDurationMs || contract.deleteChildElementOnUnload !== required.deleteChildElementOnUnload || JSON.stringify(contract.propertyTags ?? []) !== JSON.stringify(required.propertyTags) || contract.disposition !== required.disposition || Number(contract.leaf?.attributeId) !== required.attributeId || Number(contract.leaf?.combineNumber) !== required.combineNumber || Number(contract.leaf?.baseFunctionId) !== required.baseFunctionId) fail('artifact-root-contract-drift', required.rootElementId);
  if (required.multiPropertyTagSemantics && (JSON.stringify(contract.multiPropertyTagSemantics ?? {}) !== JSON.stringify(required.multiPropertyTagSemantics))) fail('artifact-multi-property-tag-semantics-drift', required.rootElementId);
}

function readBattleRows(text) {
  const ids = new Set(REQUIRED_ROOTS.flatMap(row => [row.rootElementId, row.leafElementId]));
  return String(text).split(/\r?\n/u).filter(line => [...ids].some(id => line.includes(`\"elementConfigId\": ${id}`))).map(line => JSON.parse(line));
}

function createFileIdentity(sourcePath, bytes) { return { path: sourcePath.replaceAll('\\', '/'), bytes: bytes.byteLength, sha256: hashBytes(bytes) }; }
function assertIdentity(expected, observed, code) { if (normalizeIdentityPath(expected?.path) !== normalizeIdentityPath(observed?.path) || Number(expected?.bytes) !== Number(observed?.bytes) || expected?.sha256 !== observed?.sha256) fail(code); }
function normalizeIdentityPath(value) { return String(value ?? '').replaceAll('\\', '/'); }
function assertExactProperties(actual, expected, code) { for (const [key, expectedValue] of Object.entries(expected)) if (actual?.[key] !== expectedValue) fail(code, key); }
function dumpBindsMethod(text, rva, declaration) { const source=String(text ?? ''); let index=source.indexOf(declaration); while(index>=0){ const prefix=source.slice(Math.max(0,index-300),index); const matches=[...prefix.matchAll(/\/\/ RVA: (0x[0-9A-F]+)/gu)]; if(matches.at(-1)?.[1]===rva)return true; index=source.indexOf(declaration,index+declaration.length); } return false; }
function readPortableExecutableRvaRange(binary, range) { const match=String(range).match(/^0x([0-9a-f]+)-0x([0-9a-f]+)$/iu); if(!match)fail('range-format-invalid',range); const start=Number.parseInt(match[1],16); const end=Number.parseInt(match[2],16); const pe=binary.readUInt32LE(0x3c); const count=binary.readUInt16LE(pe+6); const opt=binary.readUInt16LE(pe+20); const table=pe+24+opt; const offset=rva=>{ for(let i=0;i<count;i+=1){const at=table+i*40; const virtualSize=binary.readUInt32LE(at+8); const virtualAddress=binary.readUInt32LE(at+12); const rawSize=binary.readUInt32LE(at+16); const rawOffset=binary.readUInt32LE(at+20); if(rva>=virtualAddress&&rva<virtualAddress+Math.max(virtualSize,rawSize))return rawOffset+rva-virtualAddress;} fail('range-outside-binary',`0x${rva.toString(16)}`);}; return binary.subarray(offset(start),offset(end)); }
function normalizeSourcePath(sourcePath, projectRoot) { const relative=path.relative(projectRoot,sourcePath); return relative.startsWith('..')?sourcePath.replaceAll('\\','/'):relative.replaceAll('\\','/'); }
function hashBytes(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function fail(code, detail=null) { throw new Error(`optimization-qualification-periodic-persistent-property-evidence-${code}${detail?`:${detail}`:''}`); }
