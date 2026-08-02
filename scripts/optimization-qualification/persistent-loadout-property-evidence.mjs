import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const PERSISTENT_LOADOUT_PROPERTY_EVIDENCE_RELATIVE_PATH =
  'scripts/optimization-qualification/evidence/persistent-loadout-property-runtime-evidence.json';

const REQUIRED_METHODS = Object.freeze([
  {
    identity:
      'Lens.Gameplay.Modules.BigWorld.InjectToOwnElementBehavior.GetInjectTargets',
    rva: '0x14231B0',
    declaration:
      'private List<EntityHandle> GetInjectTargets(InjectToOwnElementBehaviorData data) { }',
  },
  {
    identity:
      'Lens.Gameplay.Modules.BigWorld.InjectToOwnElementBehavior.Start',
    rva: '0x1425240',
    declaration: 'public override void Start() { }',
  },
  {
    identity: 'Lens.Gameplay.Modules.BigWorld.InjectToOwnElementBehavior.End',
    rva: '0x1423020',
    declaration: 'public override void End() { }',
  },
  {
    identity: 'Lens.Gameplay.Modules.BigWorld.ChangePropertyElement.Parse',
    rva: '0x137D670',
    declaration:
      'public override void Parse(TElementParams param, int skillId, CustomBattleVerifyInfo verifyInfo) { }',
  },
  {
    identity: 'Lens.Gameplay.Modules.BigWorld.ChangePropertyElement.Combine',
    rva: '0x137A120',
    declaration: 'public override void Combine(IElement element) { }',
  },
]);

const REQUIRED_FIELDS = Object.freeze([
  {
    identity: 'InjectToOwnElementBehavior.m_data',
    declaration: 'private InjectToOwnElementBehaviorData m_data; // 0x68',
  },
  {
    identity: 'InjectToOwnElementBehavior.m_elementUniqueIds',
    declaration:
      'private List<ValueTuple<int, ulong>> m_elementUniqueIds; // 0x80',
  },
  {
    identity: 'InjectToOwnElementBehaviorData.elementDataList',
    declaration: 'public List<TElementParams> elementDataList; // 0x80',
  },
  {
    identity: 'InjectToOwnElementBehaviorData.directInjectTargetType',
    declaration:
      'public EDirectInjectTargetType directInjectTargetType; // 0x88',
  },
  {
    identity: 'InjectToOwnElementBehaviorData.removeElementOnEnd',
    declaration: 'public bool removeElementOnEnd; // 0x90',
  },
  {
    identity: 'TChangePropertyElementParams.attributeID',
    declaration: 'public EBattlePropertyType attributeID; // 0xBC',
  },
  {
    identity: 'TChangePropertyElementParams.calculateType',
    declaration: 'public EPropertyCalculateType calculateType; // 0xC0',
  },
  {
    identity: 'TChangePropertyElementParams.time',
    declaration: 'public int time; // 0xD4',
  },
  {
    identity: 'TChangePropertyElementParams.defaultPropertyTags',
    declaration: 'public List<int> defaultPropertyTags; // 0xE0',
  },
]);

const REQUIRED_ENUMS = Object.freeze([
  {
    identity: 'EDirectInjectTargetType.Self',
    declaration: 'public const EDirectInjectTargetType Self = 0;',
    description: '[Description("自身")]',
  },
  {
    identity: 'ECombineType.Cover',
    declaration: 'public const ECombineType Cover = 3;',
    description: '[Description("覆盖")]',
  },
  {
    identity: 'EElementInheritType.None',
    declaration: 'public const EElementInheritType None = 0;',
    description: '[InspectorName("不继承")]',
  },
  {
    identity: 'EElementTriggerEventType.UnloadSkill',
    declaration: 'public const EElementTriggerEventType UnloadSkill = 36;',
    description: '[InspectorName("卸载技能")]',
  },
]);

const REQUIRED_RANGES = Object.freeze([
  {
    identity: 'inject-target-dispatch',
    range: '0x1423379-0x142343f',
    bytes: 198,
    sha256: 'ccb63b6921ce83ec50557bafe536497f144bd2645ff702747643544c9901971d',
  },
  {
    identity: 'inject-element-loop',
    range: '0x14253b3-0x142543f',
    bytes: 140,
    sha256: 'f9f1e9add1e9f3a628498899796f1a5d4ba439a654c8be5a58be2debc367067c',
  },
  {
    identity: 'unload-remove-gate',
    range: '0x14230ae-0x142313e',
    bytes: 144,
    sha256: '49531e7bac8c957d240bc0309a10cb92b21dd7ca9ffc3de2aba0aa92ab5bdb58',
  },
  {
    identity: 'property-duration-parse',
    range: '0x137d7f8-0x137d83a',
    bytes: 66,
    sha256: 'a02b465cf138291d1e808f264839493a16f2b6004d4edbfa392811543162e56a',
  },
  {
    identity: 'property-combine-entry',
    range: '0x137a1b6-0x137a226',
    bytes: 112,
    sha256: '8f803e4e100de3dfcb98c4e3072d41e21e0f97c9bf8810a103ff82ae07e52863',
  },
]);

const REQUIRED_SEMANTICS = Object.freeze({
  installSource:
    'skill-control-timeline-inject-to-own-element-behavior-at-frame-zero',
  installTarget: 'direct-inject-self-actor',
  timelineEndRemovalGate: 'removeElementOnEnd',
  persistentLifetime:
    'time-minus-one-and-no-timeline-end-removal-until-explicit-unload-skill',
  duplicateInitialization: 'cover-by-source-identity',
  unloadEventId: 36,
  inheritance: 'none',
});

export async function readPersistentLoadoutPropertyRuntimeEvidenceSource({
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
  validatePersistentLoadoutPropertyRuntimeEvidence(value, observations);
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

export function validatePersistentLoadoutPropertyRuntimeEvidence(
  value,
  observations
) {
  if (
    Number(value?.schemaVersion) !== 1 ||
    value?.contractName !== 'AzPrPersistentLoadoutPropertyRuntimeEvidence' ||
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
  for (const required of REQUIRED_METHODS) {
    const method = value.dumpBindings?.methods?.find(
      candidate => candidate.identity === required.identity
    );
    if (
      method?.rva !== required.rva ||
      method?.declaration !== required.declaration ||
      !dumpBindsMethod(
        observations?.dumpText,
        required.rva,
        required.declaration
      )
    ) {
      fail('method-binding-drift', required.identity);
    }
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
  for (const required of REQUIRED_ENUMS) {
    const binding = value.dumpBindings?.enums?.find(
      candidate => candidate.identity === required.identity
    );
    if (
      binding?.declaration !== required.declaration ||
      binding?.description !== required.description ||
      !observations?.dumpText?.includes(required.declaration) ||
      !observations?.dumpText?.includes(required.description)
    ) {
      fail('enum-binding-drift', required.identity);
    }
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
  assertExactProperties(
    value.semantics,
    REQUIRED_SEMANTICS,
    'semantics-drift'
  );
  return true;
}

export function assertPersistentLoadoutPropertyRuntimeEvidenceReference(
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
    `optimization-qualification-persistent-loadout-property-evidence-${code}${detail ? `:${detail}` : ''}`
  );
}
