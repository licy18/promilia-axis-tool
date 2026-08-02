import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const GET_ELEMENT_TYPE_EVIDENCE_RELATIVE_PATH =
  'scripts/optimization-qualification/evidence/soulessence-get-element-type-runtime-evidence.json';

const REQUIRED_METHOD = Object.freeze({
  identity:
    'Lens.Gameplay.Modules.BigWorld.TriggerElement.CheckTriggerCondition',
  rva: '0x13B6A50',
  declaration:
    'private bool CheckTriggerCondition(TTriggerElementParams.TriggerElementCondition condition, ElementTriggerDataBase triggerData) { }',
});

const REQUIRED_FIELDS = Object.freeze([
  {
    identity: 'ElementTriggerDataBase.elementParams',
    declaration: 'public TElementParams elementParams; // 0x30',
  },
  {
    identity: 'TElementParams.types',
    declaration: 'public List<int> types; // 0x30',
  },
  {
    identity: 'TriggerElementCondition.conditionParam1',
    declaration: 'public int conditionParam1; // 0x0',
  },
  {
    identity: 'TriggerElementCondition.conditionParam2',
    declaration: 'public int conditionParam2; // 0x4',
  },
]);

const REQUIRED_ENUM = Object.freeze({
  identity: 'EElementTriggerFixedConditionType.CheckElementType',
  declaration:
    'public const EElementTriggerFixedConditionType CheckElementType = 8;',
  description: '[Description("事件元素类型")]',
});

const REQUIRED_RANGES = Object.freeze([
  {
    identity: 'condition-type-dispatch',
    range: '0x13B6BFE-0x13B6C1D',
    bytes: 31,
    sha256: '85c789191b0c13fb41f3327c5823752da33db7990ac50e84fa8d80521a966f1c',
  },
  {
    identity: 'check-element-type-branch',
    range: '0x13B6ED6-0x13B6F47',
    bytes: 113,
    sha256: '9410b014caad3ea1cb1dbd0a18137edf76916c747f9c4e9d2c768dad390da16c',
  },
  {
    identity: 'condition-type-jump-table',
    range: '0x13B7C04-0x13B7C60',
    bytes: 92,
    sha256: '60b110520bef07c8acd48f2da1b98bfd0f0aff8dee6c3989d15df521a2a366f3',
  },
]);

const REQUIRED_CONSUMER = Object.freeze({
  dispatch: {
    conditionTypeFieldOffset: '0x0',
    conditionTypeIndex: 8,
    conditionTypeTargetRva: '0x13B6ED6',
  },
  type8Branch: {
    eventElementParamsFieldOffset: '0x30',
    elementTypesFieldOffset: '0x30',
    conditionValueFieldOffset: '0x4',
    listContainsTargetRva: '0x60E9EB0',
  },
});

const REQUIRED_SEMANTICS = Object.freeze({
  selector: 'current-event-element-params-types-contains-condition-value',
  heldElementCollectionRead: false,
  damageTemplateSubstitution: false,
  linkedLeafSyntheticDispatch: false,
});

export async function readGetElementTypeRuntimeEvidenceSource({
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
        return [
          required.identity,
          {
            range: required.range,
            bytes: bytes.byteLength,
            sha256: hashBytes(bytes),
          },
        ];
      })
    ),
  };
  validateGetElementTypeRuntimeEvidence(value, observations);
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

export function validateGetElementTypeRuntimeEvidence(value, observations) {
  if (
    Number(value?.schemaVersion) !== 1 ||
    value?.contractName !== 'AzPrGetElementTypeRuntimeEvidence' ||
    value?.conclusion?.status !== 'applied'
  ) {
    fail('contract-invalid');
  }
  assertIdentity(
    value.reviewedBinary,
    observations?.binaryIdentity,
    'binary-drift'
  );
  assertIdentity(
    value.reviewedIl2CppDump,
    observations?.dumpIdentity,
    'dump-drift'
  );
  const method = value.dumpBindings?.methods?.find(
    candidate => candidate.identity === REQUIRED_METHOD.identity
  );
  if (
    method?.rva !== REQUIRED_METHOD.rva ||
    method?.declaration !== REQUIRED_METHOD.declaration ||
    !dumpBindsMethod(
      observations?.dumpText,
      REQUIRED_METHOD.rva,
      REQUIRED_METHOD.declaration
    )
  ) {
    fail('method-binding-drift');
  }
  for (const required of REQUIRED_FIELDS) {
    const field = value.dumpBindings?.fields?.find(
      candidate => candidate.identity === required.identity
    );
    if (
      field?.declaration !== required.declaration ||
      !observations?.dumpText?.includes(required.declaration)
    ) {
      fail('field-binding-drift', required.identity);
    }
  }
  const enumBinding = value.dumpBindings?.enums?.find(
    candidate => candidate.identity === REQUIRED_ENUM.identity
  );
  if (
    enumBinding?.declaration !== REQUIRED_ENUM.declaration ||
    enumBinding?.description !== REQUIRED_ENUM.description ||
    !observations?.dumpText?.includes(REQUIRED_ENUM.declaration) ||
    !observations?.dumpText?.includes(REQUIRED_ENUM.description)
  ) {
    fail('enum-binding-drift');
  }
  for (const required of REQUIRED_RANGES) {
    const record = value.binaryRanges?.find(
      candidate => candidate.identity === required.identity
    );
    const observed = observations?.rangeHashes?.[required.identity];
    if (
      record?.range !== required.range ||
      Number(record?.bytes) !== required.bytes ||
      record?.sha256 !== required.sha256 ||
      observed?.range !== required.range ||
      Number(observed?.bytes) !== required.bytes ||
      observed?.sha256 !== required.sha256
    ) {
      fail('range-drift', required.identity);
    }
  }
  if (
    value.conditionConsumer?.identity !== REQUIRED_METHOD.identity ||
    value.conditionConsumer?.rva !== REQUIRED_METHOD.rva
  ) {
    fail('consumer-identity-drift');
  }
  assertExactProperties(
    value.conditionConsumer?.dispatch,
    REQUIRED_CONSUMER.dispatch,
    'dispatch-drift'
  );
  assertExactProperties(
    value.conditionConsumer?.type8Branch,
    REQUIRED_CONSUMER.type8Branch,
    'type8-branch-drift'
  );
  assertExactProperties(value.semantics, REQUIRED_SEMANTICS, 'semantics-drift');
  return true;
}

export function assertGetElementTypeRuntimeEvidenceReference(
  reference,
  source
) {
  assertExactProperties(
    reference,
    {
      path: source?.path,
      bytes: source?.bytes,
      sha256: source?.sha256,
      binaryPath: source?.value?.reviewedBinary?.path,
      binaryBytes: source?.value?.reviewedBinary?.bytes,
      binarySha256: source?.value?.reviewedBinary?.sha256,
      il2CppDumpPath: source?.value?.reviewedIl2CppDump?.path,
      il2CppDumpBytes: source?.value?.reviewedIl2CppDump?.bytes,
      il2CppDumpSha256: source?.value?.reviewedIl2CppDump?.sha256,
    },
    'report-reference-drift'
  );
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
    normalizeIdentityPath(expected?.path) !==
      normalizeIdentityPath(observed?.path) ||
    Number(expected?.bytes) !== Number(observed?.bytes) ||
    expected?.sha256 !== observed?.sha256
  ) {
    fail(code);
  }
}

function normalizeIdentityPath(value) {
  return String(value ?? '').replaceAll('\\', '/');
}

function assertExactProperties(actual, expected, code) {
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (actual?.[key] !== expectedValue) fail(code, key);
  }
}

function dumpBindsMethod(text, rva, declaration) {
  const source = String(text ?? '');
  let declarationIndex = source.indexOf(declaration);
  while (declarationIndex >= 0) {
    const prefix = source.slice(
      Math.max(0, declarationIndex - 300),
      declarationIndex
    );
    const matches = [...prefix.matchAll(/\/\/ RVA: (0x[0-9A-F]+)/gu)];
    if (matches.at(-1)?.[1] === rva) return true;
    declarationIndex = source.indexOf(
      declaration,
      declarationIndex + declaration.length
    );
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
      if (
        rva >= virtualAddress &&
        rva < virtualAddress + Math.max(virtualSize, rawSize)
      ) {
        return rawOffset + rva - virtualAddress;
      }
    }
    fail('range-outside-binary', `0x${rva.toString(16)}`);
  };
  return binary.subarray(resolveOffset(startRva), resolveOffset(endRva));
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
  throw new Error(
    `optimization-qualification-get-element-type-evidence-${code}${detail ? `:${detail}` : ''}`
  );
}
