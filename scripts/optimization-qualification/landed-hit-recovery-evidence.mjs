import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const LANDED_HIT_RECOVERY_EVIDENCE_RELATIVE_PATH =
  'scripts/optimization-qualification/evidence/landed-hit-recovery-runtime-evidence.json';

const REQUIRED_METHODS = Object.freeze([
  [
    'Lens.Gameplay.Modules.BigWorld.DamageElement.Parse',
    '0x138E5E0',
    'public override void Parse(TElementParams param, int skillId, CustomBattleVerifyInfo verifyInfo) { }',
  ],
  [
    'Lens.Gameplay.Modules.BigWorld.DamageElement.RecoverSP',
    '0x138EEE0',
    'public void RecoverSP() { }',
  ],
  [
    'Lens.Gameplay.Modules.BigWorld.AliveElementSystem.OnExecuteDamageElement',
    '0x1318800',
    'public virtual void OnExecuteDamageElement(DamageElement damageElement) { }',
  ],
  [
    'Lens.Gameplay.Modules.BigWorld.AliveElementSystem.ExecuteDamageElement',
    '0x13151F0',
    'private FormulaUtility.OutputDamageData ExecuteDamageElement(DamageElement element) { }',
  ],
  [
    'Lens.Gameplay.Modules.BigWorld.AliveEntity.get_isMainControl',
    '0x1293A40',
    'public bool get_isMainControl() { }',
  ],
  [
    'Lens.Gameplay.Modules.BigWorld.SPSystem.OnTransmit',
    '0x14837F0',
    'public void OnTransmit(ETransmitType type, ITransmitArgs args) { }',
  ],
  [
    'Lens.Gameplay.Modules.BigWorld.SPSystem.RecoverSP',
    '0x1483F40',
    'private void RecoverSP(TSpElementParams.ERecoverTagType recoverTagType, float baseDelta, float delta) { }',
  ],
]);

const REQUIRED_DECLARATIONS = Object.freeze([
  ['DamageElement.m_recoverSP', 'private int m_recoverSP; // 0x240'],
  ['DamageElement.m_petRecoverSP', 'private int m_petRecoverSP; // 0x244'],
  [
    'DamageElement.m_recoverInterval',
    'private int m_recoverInterval; // 0x248',
  ],
  ['TDamageElementParams.recoverSP', 'public int recoverSP; // 0x12C'],
  [
    'TDamageElementParams.petRecoverSP',
    'public int petRecoverSP; // 0x130',
  ],
  [
    'TDamageElementParams.recoverInterval',
    'public int recoverInterval; // 0x134',
  ],
  [
    'EPlayerNetworkState.LocalControlled',
    'public const EPlayerNetworkState LocalControlled = 0;',
  ],
  [
    'EPlayerNetworkState.RemoteControlled',
    'public const EPlayerNetworkState RemoteControlled = 1;',
  ],
  [
    'EPlayerNetworkState.LocalAIControlled',
    'public const EPlayerNetworkState LocalAIControlled = 2;',
  ],
]);

const REQUIRED_RANGES = Object.freeze([
  [
    'damage-element-parse-recovery-fields',
    '0x138E5E0-0x138E830',
    592,
    'e737b61250a072be4921e4acb37517faf14fa9689c35b583949bdae71fef67d2',
  ],
  [
    'damage-element-recover-sp',
    '0x138EEE0-0x138F610',
    1840,
    '6772fcc07b9bd09bc7c354a4c72bb6f8c2db80034739c00737bfd947ea6e0958',
  ],
  [
    'element-executor-source-resolution',
    '0x1318B3E-0x1318B79',
    59,
    'a510b8fcc408a058a7124f71f6bf4abbacbdaa11ef47a7faf614c325212793a5',
  ],
  [
    'remote-recovery-branch',
    '0x1318E02-0x1318E57',
    85,
    '44bf4ecc167ca62f2a5e666ede933a208cc90269a27d64bd72521e48990b96ac',
  ],
  [
    'local-damage-settlement-call',
    '0x131932C-0x1319360',
    52,
    'dc12ad1cfcb0f39a891b4c2b117b1109b7cdc0da2730db690cadc3359628de20',
  ],
  [
    'local-main-control-gates-and-recovery-call',
    '0x1319559-0x1319599',
    64,
    'c71ee84e6a02fa8fff89c218c0d6e5fbe912f68224fb07db29f7119a9cb21f18',
  ],
  [
    'alive-entity-is-main-control',
    '0x1293A40-0x1293A91',
    81,
    '7652ab35e9d4ff29dc2dd89982618d72de93258c963f53219bbdd68f56188378',
  ],
  [
    'sp-system-on-transmit',
    '0x14837F0-0x1483F40',
    1872,
    '0fdd9a3a02d9eb6caf31bf99805c9fcfbf325362d2bdbebbe1de29f9c4ae2cff',
  ],
  [
    'sp-system-recover-sp',
    '0x1483F40-0x1484260',
    800,
    '67a7b086f9e911b622c7dcb9cea2334cc4ceece9689ef14f89c384813d094650',
  ],
  [
    'sp-system-actor-recover-dispatch',
    '0x1483A50-0x1483A70',
    32,
    '9e95670343fb32fbc2cbdbf87b80520d505b63c228a40e86b74886bdeb052ac5',
  ],
  [
    'sp-system-kibo-recover-dispatch',
    '0x1483E00-0x1483E20',
    32,
    'a25dca5c6cf172b97884b3594d784667d484dc324318b56ea18fe2cd9bfe8fd8',
  ],
]);

const REQUIRED_CALL_GRAPH = Object.freeze({
  parseCopies: [
    ['0x138E7F5', '0x12C', '0x240', 'recoverSP'],
    ['0x138E801', '0x130', '0x244', 'petRecoverSP'],
    ['0x138E80D', '0x134', '0x248', 'recoverInterval'],
  ],
  localBranch: {
    damageSettlementCallRva: '0x131935A',
    damageSettlementTargetRva: '0x13151F0',
    executorMainControlCallRva: '0x1319567',
    sourceMainControlCallRva: '0x1319582',
    mainControlTargetRva: '0x1293A40',
    recoveryCallRva: '0x1319594',
    recoveryTargetRva: '0x138EEE0',
  },
  remoteBranch: {
    addRemoteElementCallRva: '0x1318E48',
    recoveryCallRva: '0x1318E52',
    recoveryTargetRva: '0x138EEE0',
  },
  spSystem: {
    onTransmitRva: '0x14837F0',
    recoverSpRva: '0x1483F40',
    actorRecoverDispatchCallRva: '0x1483A64',
    kiboRecoverDispatchCallRva: '0x1483E14',
  },
});

const REQUIRED_SEMANTICS = Object.freeze({
  isMainControlField: 'AliveData.playerNetworkState@0x348',
  isMainControlCondition: 'EPlayerNetworkState.LocalControlled=0',
  localExecutorGateRequired: true,
  localSourceGateRequired: true,
  remoteBranchKind: 'replicated-remote-element',
  canonicalBranchKind: 'local-authored-action',
  canonicalExecutorAuthority: 'execution-plan-local-action-provenance',
  canonicalSourceAuthority: 'execution-plan-local-source-provenance',
  controlledActorTimelineRepresentsActiveActorNotNetworkAuthority: true,
  controlledActorTimelineRecoveryGate: false,
  damageFormulaReadinessIndependentAfterAuthorityGates: true,
  unresolvedDamageMayStillRecoverAfterAuthorityGates: true,
  unknownOrDriftedLandedTransactionFailsClosed: true,
});

export async function readLandedHitRecoveryRuntimeEvidenceSource({
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
      REQUIRED_RANGES.map(([identity, range]) => {
        const rangeBytes = readPortableExecutableRvaRange(binary, range);
        return [
          identity,
          {
            range,
            bytes: rangeBytes.byteLength,
            sha256: hashBytes(rangeBytes),
          },
        ];
      })
    ),
  };
  validateLandedHitRecoveryRuntimeEvidence(value, observations);
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

export function validateLandedHitRecoveryRuntimeEvidence(value, observations) {
  if (
    Number(value?.schemaVersion) !== 1 ||
    value?.contractName !== 'AzPrLandedHitRecoveryRuntimeEvidence' ||
    value?.conclusion?.status !== 'applied'
  ) {
    fail('contract-invalid');
  }
  assertIdentity(
    value.reviewedBinary,
    observations?.binaryIdentity,
    'binary-mismatch'
  );
  assertIdentity(
    value.reviewedIl2CppDump,
    observations?.dumpIdentity,
    'dump-mismatch'
  );

  for (const [identity, rva, declaration] of REQUIRED_METHODS) {
    const record = (value.dumpBindings?.methods ?? []).find(
      candidate => candidate.identity === identity
    );
    if (
      record?.rva !== rva ||
      record?.declaration !== declaration ||
      !dumpBindsMethod(observations?.dumpText, rva, declaration)
    ) {
      fail('method-binding-drift', identity);
    }
  }
  for (const [identity, declaration] of REQUIRED_DECLARATIONS) {
    const records = identity.startsWith('EPlayerNetworkState.')
      ? value.dumpBindings?.enums
      : value.dumpBindings?.fields;
    const record = (records ?? []).find(
      candidate => candidate.identity === identity
    );
    if (
      record?.declaration !== declaration ||
      !observations?.dumpText?.includes(declaration)
    ) {
      fail('declaration-drift', identity);
    }
  }
  for (const [identity, range, bytes, sha256] of REQUIRED_RANGES) {
    const record = (value.binaryRanges ?? []).find(
      candidate => candidate.identity === identity
    );
    const observed = observations?.rangeHashes?.[identity];
    if (
      record?.range !== range ||
      Number(record?.bytes) !== bytes ||
      record?.sha256 !== sha256 ||
      observed?.range !== range ||
      Number(observed?.bytes) !== bytes ||
      observed?.sha256 !== sha256
    ) {
      fail(
        'range-drift',
        `${identity}:recordRange=${record?.range ?? 'missing'}:expectedRange=${range}:observedRange=${observed?.range ?? 'missing'}:recordBytes=${record?.bytes ?? 'missing'}:expectedBytes=${bytes}:observedBytes=${observed?.bytes ?? 'missing'}:record=${record?.sha256 ?? 'missing'}:expected=${sha256}:observed=${observed?.sha256 ?? 'missing'}`
      );
    }
  }

  const parseCopies = value.callGraph?.parseCopies ?? [];
  for (const [callSiteRva, sourceOffset, destinationOffset, field] of
    REQUIRED_CALL_GRAPH.parseCopies) {
    const record = parseCopies.find(candidate => candidate.field === field);
    if (
      record?.callSiteRva !== callSiteRva ||
      record?.sourceOffset !== sourceOffset ||
      record?.destinationOffset !== destinationOffset
    ) {
      fail('callsite-drift', `parse:${field}`);
    }
  }
  assertExactProperties(
    value.callGraph?.localBranch,
    REQUIRED_CALL_GRAPH.localBranch,
    'callsite-drift',
    'local-branch'
  );
  assertExactProperties(
    value.callGraph?.remoteBranch,
    REQUIRED_CALL_GRAPH.remoteBranch,
    'callsite-drift',
    'remote-branch'
  );
  assertExactProperties(
    value.callGraph?.spSystem,
    REQUIRED_CALL_GRAPH.spSystem,
    'callsite-drift',
    'sp-system'
  );
  assertExactProperties(
    value.runtimeSemantics,
    REQUIRED_SEMANTICS,
    'gate-semantics-drift',
    'runtime-semantics'
  );
  return true;
}

export function assertLandedHitRecoveryRuntimeEvidenceReference(
  reference,
  source
) {
  const required = {
    path: source?.path,
    bytes: source?.bytes,
    sha256: source?.sha256,
    binaryPath: source?.value?.reviewedBinary?.path,
    binaryBytes: source?.value?.reviewedBinary?.bytes,
    binarySha256: source?.value?.reviewedBinary?.sha256,
    il2CppDumpPath: source?.value?.reviewedIl2CppDump?.path,
    il2CppDumpBytes: source?.value?.reviewedIl2CppDump?.bytes,
    il2CppDumpSha256: source?.value?.reviewedIl2CppDump?.sha256,
  };
  assertExactProperties(
    reference,
    required,
    'report-reference-drift',
    'acceptance-report'
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

function assertExactProperties(actual, expected, code, identity) {
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (actual?.[key] !== expectedValue) {
      fail(code, `${identity}:${key}`);
    }
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
    `optimization-qualification-landed-hit-recovery-evidence-${code}${detail ? `:${detail}` : ''}`
  );
}
