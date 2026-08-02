import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const FOUR_PIECE_SET_STACK_EVIDENCE_RELATIVE_PATH =
  'scripts/optimization-qualification/evidence/four-piece-set-stack-runtime-evidence.json';

const REQUIRED_METHODS = Object.freeze([
  ['Lens.Gameplay.Modules.BigWorld.ChangePropertyElement.Combine', '0x137A120', 'public override void Combine(IElement element) { }'],
  ['Lens.Gameplay.Modules.BigWorld.ChangePropertyConditionArrayObject.CombineLayer', '0x1383360', 'public void CombineLayer(int addLayer) { }'],
  ['Lens.Gameplay.Modules.BigWorld.ChangePropertyConditionArrayObject.DecreaseLayer', '0x13834A0', 'public void DecreaseLayer(int reduceLayer) { }'],
  ['Lens.Gameplay.Modules.BigWorld.BaseElement.get_endTime', '0x136E3E0', 'public float get_endTime() { }'],
  ['Lens.Gameplay.Modules.BigWorld.BaseElement.set_endTime', '0x136F920', 'public void set_endTime(float value) { }'],
].map(([identity, rva, declaration]) => ({ identity, rva, declaration })));

const REQUIRED_FIELDS = Object.freeze([
  ['TElementParams.combineType', 'public ECombineType combineType; // 0x38'],
  ['TElementParams.combineNumber', 'public int combineNumber; // 0x3C'],
  ['TElementParams.inheritType', 'public EElementInheritType inheritType; // 0x78'],
  ['TChangePropertyElementParams.time', 'public int time; // 0xD4'],
  ['ChangePropertyConditionArrayObject.layer', 'private int <layer>k__BackingField; // 0x60'],
].map(([identity, declaration]) => ({ identity, declaration })));

const REQUIRED_ENUMS = Object.freeze([
  ['ECombineType.Overlying', 'public const ECombineType Overlying = 4;', '[Description("叠加")]'],
  ['EElementTriggerEventType.BeforeDamage', 'public const EElementTriggerEventType BeforeDamage = 1;', '[InspectorName("造成伤害前")]'],
  ['EElementTriggerFixedConditionType.CheckSkillType', 'public const EElementTriggerFixedConditionType CheckSkillType = 11;', '[Description("事件技能Tag")]'],
  ['ESkillTagType.NormalAttack', 'public const ESkillTagType NormalAttack = 1;', '[Description("角色普攻")]'],
].map(([identity, declaration, description]) => ({
  identity,
  declaration,
  description,
})));

const REQUIRED_RANGES = Object.freeze([
  ['shared-end-time-refresh', '0x137a29c-0x137a362', 198, 'c9b44d20eb717cef1349d749d1f0e7936eb398df03d064e17ab7676432fc276e'],
  ['overlying-branch-cap-delta', '0x137a40d-0x137a51f', 274, '68f76b96aa6fbcc85cd8f7f1397c009b23571920240f14f12763922fc2bcb2dc'],
  ['positive-layer-delta-apply', '0x137a570-0x137a57d', 13, '25c2721127275dec57b7f9a01f9e1dc0eee7600bc35181b21594a5f62b64972c'],
  ['single-aggregate-layer-increment', '0x13833f3-0x1383432', 63, '05781e39f68eef544c4f5fd5a05f6c92c0a464fbc3c680afe889125a4e735cd8'],
  ['single-aggregate-layer-decrement', '0x1383537-0x1383575', 62, '138dd7ad457ee7e3524e754c8f39d27a9f762744e166e4b5fe553bb47805fef4'],
].map(([identity, range, bytes, sha256]) => ({ identity, range, bytes, sha256 })));

const REQUIRED_DEFINITIONS = Object.freeze([
  {
    setId: 2,
    pieces: 4,
    skillId: 19998004,
    triggerElementId: 199999020,
    eventId: 1,
    triggerTargetType: 0,
    conditionLogicValue: 0,
    conditions: [],
    effectTargetType: 0,
    propertyElementId: 199999021,
    attributeId: 7,
    calculateType: 1,
    sourceRawA: 200,
    commonFunctionId: 1,
    baseFunctionId: 5,
    commonRatioRaw: 10000,
    durationMs: 6000,
    combineType: 4,
    combineNumber: 5,
    executeTargetType: 0,
    inheritType: 0,
    unloadTriggerElementId: 199999039,
    removerElementId: 199999040,
    removedElementIds: [199999020, 199999039],
  },
  {
    setId: 4,
    pieces: 4,
    skillId: 19998003,
    triggerElementId: 199999018,
    eventId: 1,
    triggerTargetType: 0,
    conditionLogicValue: 0,
    conditions: [{ conditionType: 11, conditionValue: 1, conditionExtra: 0 }],
    effectTargetType: 0,
    propertyElementId: 199999019,
    attributeId: 1,
    calculateType: 2,
    sourceRawA: 100,
    commonFunctionId: 1,
    baseFunctionId: 3,
    commonRatioRaw: 10000,
    durationMs: 24000,
    combineType: 4,
    combineNumber: 7,
    executeTargetType: 0,
    inheritType: 0,
    unloadTriggerElementId: 199999035,
    removerElementId: 199999036,
    removedElementIds: [199999018, 199999035],
  },
]);

const REQUIRED_SEMANTICS = Object.freeze({
  triggerPhase: 'before-damage-dispatch-before-current-packet-settlement',
  emptyConditionList: 'reviewed-before-damage-trigger-always-matches',
  conditionSelector: 'event-final-control-binding-skill-tags',
  sourceTarget: 'equipped-self-actor',
  combineType: 'overlying-capped-single-aggregate-layer',
  stackCapSource: 'property-combine-number',
  stackLifetime: 'shared-absolute-end-time-refreshed-to-later-expiry',
  expiryInterval: 'right-open',
  duplicateInstallation: 'one-runtime-binding-per-actor-set-threshold',
  threshold: 'selected-valid-equipment-piece-count-greater-than-or-equal',
  unload: 'remove-trigger-roots-and-let-existing-timed-property-expire-at-original-absolute-end',
  inheritance: 'none',
});

export async function readFourPieceSetStackRuntimeEvidenceSource({
  sourcePath,
  gameAssemblyPath,
  il2CppDumpPath,
  projectRoot,
}) {
  const [sourceBytes, binary, dumpBytes] = await Promise.all([
    fs.readFile(sourcePath),
    fs.readFile(gameAssemblyPath),
    fs.readFile(il2CppDumpPath),
  ]);
  const value = JSON.parse(sourceBytes.toString('utf8'));
  const observations = {
    binaryIdentity: createFileIdentity(gameAssemblyPath, binary),
    dumpIdentity: createFileIdentity(il2CppDumpPath, dumpBytes),
    dumpText: dumpBytes.toString('utf8'),
    rangeHashes: Object.fromEntries(
      REQUIRED_RANGES.map(required => {
        const bytes = readPortableExecutableRvaRange(binary, required.range);
        return [required.identity, {
          range: required.range,
          bytes: bytes.byteLength,
          sha256: hashBytes(bytes),
        }];
      })
    ),
  };
  validateFourPieceSetStackRuntimeEvidence(value, observations);
  return {
    path: normalizeSourcePath(sourcePath, projectRoot),
    bytes: sourceBytes.byteLength,
    sha256: hashBytes(sourceBytes),
    value: {
      ...value,
      verifiedBinary: observations.binaryIdentity,
      verifiedIl2CppDump: observations.dumpIdentity,
    },
    observations,
  };
}

export function validateFourPieceSetStackRuntimeEvidence(value, observations) {
  if (
    Number(value?.schemaVersion) !== 1 ||
    value?.contractName !== 'AzPrFourPieceSetBeforeDamageStackRuntimeEvidence' ||
    value?.conclusion?.status !== 'applied'
  ) {
    fail('contract-invalid');
  }
  assertIdentity(value.reviewedBinary, observations?.binaryIdentity, 'binary-drift');
  assertIdentity(value.reviewedIl2CppDump, observations?.dumpIdentity, 'dump-drift');
  for (const required of REQUIRED_METHODS) {
    const actual = value.dumpBindings?.methods?.find(row => row.identity === required.identity);
    if (
      actual?.rva !== required.rva ||
      actual?.declaration !== required.declaration ||
      !dumpBindsMethod(observations?.dumpText, required.rva, required.declaration)
    ) {
      fail('method-binding-drift', required.identity);
    }
  }
  for (const required of REQUIRED_FIELDS) {
    const actual = value.dumpBindings?.fields?.find(row => row.identity === required.identity);
    if (
      actual?.declaration !== required.declaration ||
      !observations?.dumpText?.includes(required.declaration)
    ) {
      fail('field-binding-drift', required.identity);
    }
  }
  for (const required of REQUIRED_ENUMS) {
    const actual = value.dumpBindings?.enums?.find(row => row.identity === required.identity);
    if (
      actual?.declaration !== required.declaration ||
      actual?.description !== required.description ||
      !observations?.dumpText?.includes(required.declaration) ||
      !observations?.dumpText?.includes(required.description)
    ) {
      fail('enum-binding-drift', required.identity);
    }
  }
  for (const required of REQUIRED_RANGES) {
    const actual = value.binaryRanges?.find(row => row.identity === required.identity);
    const observed = observations?.rangeHashes?.[required.identity];
    if (
      actual?.range !== required.range ||
      Number(actual?.bytes) !== required.bytes ||
      actual?.sha256 !== required.sha256 ||
      observed?.range !== required.range ||
      Number(observed?.bytes) !== required.bytes ||
      observed?.sha256 !== required.sha256
    ) {
      fail('range-drift', required.identity);
    }
  }
  if (JSON.stringify(value.reviewedDefinitions) !== JSON.stringify(REQUIRED_DEFINITIONS)) {
    fail('reviewed-definition-drift');
  }
  assertExactProperties(value.semantics, REQUIRED_SEMANTICS, 'semantics-drift');
  return true;
}

export function assertFourPieceSetStackRuntimeEvidenceReference(reference, source) {
  assertExactProperties(reference, {
    path: source?.path,
    bytes: source?.bytes,
    sha256: source?.sha256,
    binaryPath: source?.value?.reviewedBinary?.path,
    binaryBytes: source?.value?.reviewedBinary?.bytes,
    binarySha256: source?.value?.reviewedBinary?.sha256,
    il2CppDumpPath: source?.value?.reviewedIl2CppDump?.path,
    il2CppDumpBytes: source?.value?.reviewedIl2CppDump?.bytes,
    il2CppDumpSha256: source?.value?.reviewedIl2CppDump?.sha256,
  }, 'report-reference-drift');
  return true;
}

function createFileIdentity(sourcePath, bytes) {
  return {
    path: sourcePath.replaceAll('\\', '/'),
    bytes: bytes.byteLength,
    sha256: hashBytes(bytes),
  };
}

function assertIdentity(expected, observed, code) {
  if (
    normalizeIdentityPath(expected?.path) !== normalizeIdentityPath(observed?.path) ||
    Number(expected?.bytes) !== Number(observed?.bytes) ||
    expected?.sha256 !== observed?.sha256
  ) {
    fail(code);
  }
}

function assertExactProperties(actual, expected, code) {
  for (const [key, value] of Object.entries(expected)) {
    if (actual?.[key] !== value) fail(code, key);
  }
}

function dumpBindsMethod(text, rva, declaration) {
  const source = String(text ?? '');
  let declarationIndex = source.indexOf(declaration);
  while (declarationIndex >= 0) {
    const prefix = source.slice(Math.max(0, declarationIndex - 300), declarationIndex);
    const matches = [...prefix.matchAll(/\/\/ RVA: (0x[0-9A-F]+)/gu)];
    if (matches.at(-1)?.[1] === rva) return true;
    declarationIndex = source.indexOf(declaration, declarationIndex + declaration.length);
  }
  return false;
}

function readPortableExecutableRvaRange(binary, range) {
  const match = String(range).match(/^0x([0-9a-f]+)-0x([0-9a-f]+)$/iu);
  if (!match) fail('range-format-invalid', range);
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
      if (rva >= virtualAddress && rva < virtualAddress + Math.max(virtualSize, rawSize)) {
        return rawOffset + rva - virtualAddress;
      }
    }
    fail('range-outside-binary', `0x${rva.toString(16)}`);
  };
  return binary.subarray(resolveOffset(startRva), resolveOffset(endRva));
}

function normalizeIdentityPath(value) {
  return String(value ?? '').replaceAll('\\', '/');
}

function normalizeSourcePath(sourcePath, projectRoot) {
  const relative = path.relative(projectRoot, sourcePath);
  return relative.startsWith('..')
    ? sourcePath.replaceAll('\\', '/')
    : relative.replaceAll('\\', '/');
}

function hashBytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function fail(code, detail = null) {
  throw new Error(`optimization-qualification-four-piece-set-stack-evidence-${code}${detail ? `:${detail}` : ''}`);
}
