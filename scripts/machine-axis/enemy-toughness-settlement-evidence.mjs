import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

export const ENEMY_TOUGHNESS_SETTLEMENT_EVIDENCE_RELATIVE_PATH =
  'scripts/machine-axis/evidence/enemy-toughness-settlement-runtime-evidence.json';
export const ENEMY_TOUGHNESS_SETTLEMENT_REPORT_RELATIVE_PATH =
  'reports/m12/m12-b3-enemy-toughness-settlement-evidence-20260808.json';

const EXPECTED_IDENTITIES = Object.freeze({
  binary: {
    path: 'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll',
    bytes: 222485544,
    sha256: 'c60d13795629f0851b1399338f375eb378aef2098515d41841f30ccc3463c22b',
  },
  dump: {
    path: 'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs',
    bytes: 97428254,
    sha256: '0ea1f95a5fe8beb0c4b6c5dc2434c72c3e2a38cf94701b240aac35bca6bd817a',
  },
  script: {
    path: 'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/script.json',
    bytes: 368815582,
    sha256: '604394cf001aea1e3acee698a145392b0e808db7e0ff917ca337cf92ef876c0b',
  },
});

const REQUIRED_METHODS = Object.freeze(
  [
    [
      'Lens.Gameplay.Modules.BigWorld.DamageElement.Execute',
      '0x138D0E0',
      'public override void Execute() { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.FormulaUtility.GetOutput',
      '0x1886D10',
      'public static FormulaUtility.OutputDamageData GetOutput(IElement elementConfig, EntityHandle attackerHandle, EntityHandle executorHandle, EntityHandle sourceHandle, int skillGroupId, int criticalRandom) { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.FormulaUtility.GetOutputDamage',
      '0x187F360',
      'private static FormulaUtility.OutputDamageData GetOutputDamage(IElement element, EntityHandle attackerHandle, EntityHandle executorHandle, EntityHandle sourceHandle, int skillGroupId, int criticalRandom) { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.FormulaUtility.GetOutputRealDamage',
      '0x1883DB0',
      'private static FormulaUtility.OutputDamageData GetOutputRealDamage(IElement element, EntityHandle attackerHandle, EntityHandle executorHandle, EntityHandle sourceHandle, int skillGroupId) { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.FormulaUtility.GetOutputWeaknessDamage',
      '0x1885FF0',
      'private static FormulaUtility.OutputDamageData GetOutputWeaknessDamage(IElement element, EntityHandle attackerHandle, EntityHandle executorHandle, EntityHandle sourceHandle, int skillGroupId) { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.FormulaUtility.WeaknessPointChange',
      '0x188A6B0',
      'private static bool WeaknessPointChange(DamageElement damageElement, EntityHandle executor, EntityHandle attacker, int outputType1, int outputType2, MyFloat weaknessSkillDmgUp, ref MyFloat outputDamage, out MyFloat wk) { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.FormulaUtility.ChangeHP',
      '0x187C950',
      'private static bool ChangeHP(EntityHandle attacker, EntityHandle executor, AliveData executorData, MyFloat value, ref int lockResult, out bool changeHpIndex) { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.AliveProperty.SetWeaknessPoint',
      '0x12AC8A0',
      'public bool SetWeaknessPoint(MyFloat v, bool force = False) { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.AliveProperty.get_breakDmgUp',
      '0x12AD660',
      'public MyFloat get_breakDmgUp() { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.AliveProperty.SetHpByHurt',
      '0x12AB970',
      'public void SetHpByHurt(MyFloat value) { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.ControlProperty.get_inWeakState',
      '0x12CF070',
      'public bool get_inWeakState() { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.ControlProperty.SetWeakState',
      '0x12CDE00',
      'public void SetWeakState(EWeakBreakState state) { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.ControlProperty.GetWeakState',
      '0x12CBDF0',
      'public EWeakBreakState GetWeakState() { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.WeakBreakSystem.RecoverBreakTimingByBreakData',
      '0x14C1410',
      'private void RecoverBreakTimingByBreakData() { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.WeakBreakSystem.UpdateWeakState',
      '0x14C1C80',
      'private void UpdateWeakState() { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.WeakBreakSystem.WeakBreaking',
      '0x14C33D0',
      'private void WeakBreaking() { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.WeakBreakSystem.WeakBreakEnding',
      '0x14C2DB0',
      'private void WeakBreakEnding() { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.WeakBreakSystem.UpdateWeakBreakEnd',
      '0x14C1AC0',
      'private void UpdateWeakBreakEnd() { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.WeakBreakSystem.WeaknessPointUpdate',
      '0x14C39D0',
      'private void WeaknessPointUpdate() { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.WeakBreakSystem.OnAttributeCacheUpdate',
      '0x14BF6F0',
      'private void OnAttributeCacheUpdate(int arg1, EntryInfo arg2) { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.WeakBreakSystem.IUpdate.OnUpdateDeltaTime',
      '0x14BF5D0',
      'private void Lens.Gameplay.Modules.BigWorld.IUpdate.OnUpdateDeltaTime(float deltaTime) { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.WeakBreakSystem.OnUpdate_LocalControlled',
      '0x14C0EA0',
      'private void OnUpdate_LocalControlled() { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.WeakBreakSystem.OnUpdate_RemoteControlled',
      '0x14C10B0',
      'private void OnUpdate_RemoteControlled() { }',
    ],
    [
      'UnityEngine.Time.get_deltaTime',
      '0x94C2760',
      'public static float get_deltaTime() { }',
    ],
    [
      'UnityEngine.Time.get_frameCount',
      '0x94C28B0',
      'public static int get_frameCount() { }',
    ],
  ].map(([identity, rva, declaration]) => ({ identity, rva, declaration }))
);

const REQUIRED_FIELDS = Object.freeze(
  [
    ['AliveProperty.m_hp', 'private MyFloat m_hp; // 0x38'],
    [
      'AliveProperty.m_weaknessPoint',
      'private MyFloat m_weaknessPoint; // 0x48',
    ],
    [
      'ControlProperty.m_weakState',
      'private EWeakBreakState m_weakState; // 0x68',
    ],
    [
      'WeakBreakSystem.m_lastDamageTime',
      'private MyFloat m_lastDamageTime; // 0x28',
    ],
    ['WeakBreakSystem.m_weakTime', 'private float m_weakTime; // 0x30'],
    ['WeakBreakSystem.m_curWeakTime', 'private float m_curWeakTime; // 0x34'],
    ['WeakBreakSystem.m_weakEndTime', 'private float m_weakEndTime; // 0x3C'],
    [
      'WeakBreakSystem.m_curWeakEndTime',
      'private float m_curWeakEndTime; // 0x40',
    ],
    [
      'WeakBreakSystem.m_weakState',
      'private EWeakBreakState m_weakState; // 0x60',
    ],
    [
      'FormulaUtility.OutputDamageData.outputDamage',
      'public MyFloat outputDamage; // 0x0',
    ],
    [
      'FormulaUtility.OutputDamageData.realDamage',
      'public MyFloat realDamage; // 0x8',
    ],
  ].map(([identity, declaration]) => ({ identity, declaration }))
);

const REQUIRED_ENUMS = Object.freeze(
  [
    ['EWeakBreakState.None', 'public const EWeakBreakState None = 0;'],
    [
      'EWeakBreakState.WeakBreaking',
      'public const EWeakBreakState WeakBreaking = 1;',
    ],
    [
      'EWeakBreakState.WeakBreakEnding',
      'public const EWeakBreakState WeakBreakEnding = 2;',
    ],
    [
      'EBattlePropertyType.WP_RECOVERY_DELAY',
      'public const EBattlePropertyType WP_RECOVERY_DELAY = 217;',
    ],
    [
      'EBattlePropertyType.WP_RECOVERY_RATE',
      'public const EBattlePropertyType WP_RECOVERY_RATE = 218;',
    ],
    [
      'EBattlePropertyType.WP_BREAK_TIME',
      'public const EBattlePropertyType WP_BREAK_TIME = 219;',
    ],
    [
      'EBattlePropertyType.WP_BREAK_END_TIME',
      'public const EBattlePropertyType WP_BREAK_END_TIME = 220;',
    ],
    [
      'EBattlePropertyType.WP_BREAK_DMGUP',
      'public const EBattlePropertyType WP_BREAK_DMGUP = 221;',
    ],
  ].map(([identity, declaration]) => ({ identity, declaration }))
);

const REQUIRED_RANGES = Object.freeze(
  [
    [
      'damage-pre-break-read-and-toughness-dispatch',
      '0x18811DA-0x18812E4',
      266,
      'd85609360244fbdab2412b5a3d4be14a7e72da1fc30c13aa241fe000c9d10b90',
    ],
    [
      'damage-hp-settlement-call',
      '0x18823EE-0x1882413',
      37,
      '77d36a13557a00f1ea0b122561e8f4c62de3abcaf6af28bb42298515d7c40816',
    ],
    [
      'weakness-change-set-point-primary',
      '0x188AC27-0x188AC9A',
      115,
      '5a667dfd57131f6171502105eba3d18cc14385d79b3bf050e8811ebccad614e2',
    ],
    [
      'weakness-change-set-point-force',
      '0x188AD41-0x188ADD1',
      144,
      '51ce934ee68a398ba1c8f4ec4d316a0aef91caaebfb275bd5c072a577e5fe439',
    ],
    [
      'damage-element-execute-output-call',
      '0x138D3E0-0x138D450',
      112,
      '4cb6eea4551b105b03665553d6f9cad28eaa41c2730c267abba339c567f6cf1f',
    ],
    [
      'real-damage-break-multiplier-and-toughness',
      '0x18849D3-0x1884AE7',
      276,
      'deec2fc8787a8ebda7e129abdf2a405975aedfe89f30d54c3f9012059b1f5d94',
    ],
    [
      'pure-toughness-broken-gate-and-hp-call',
      '0x18864D9-0x18869B4',
      1243,
      '6933c850ff41457e2a256024983476a9aaca4c050bb8ad53e0f492037446cdca',
    ],
    [
      'weak-state-cache-transition',
      '0x14BF761-0x14BF85F',
      254,
      '5b01e6199edb7b5ea4e840e67f5c774559d1038d17eb59157d328a7f50e500de',
    ],
    [
      'performance-state-mirror',
      '0x14C0CB1-0x14C0E20',
      367,
      '571b12aad3c2ed91c0218b1fa8f69e8a93dd1278914bdad7159a77d9bf728af3',
    ],
    [
      'local-control-state-dispatch',
      '0x14C103A-0x14C10A1',
      103,
      'b71f3b7d8dc33fbe625c8fb9939c21c39ab8879a3f9d10c0d0e1ba4b302fa165',
    ],
    [
      'break-timer-delta-and-linear-recovery',
      '0x14C1E97-0x14C20C6',
      559,
      '33838b61026895a3b30b2f557d105b096bed0f187195d094045c0e21d4542679',
    ],
    [
      'break-to-ending-transition',
      '0x14C20CB-0x14C21D0',
      261,
      '856ed1f5f71347177bc4e5585b2fe31d75b130eda98d1abd2a6308acae7a83a4',
    ],
    [
      'break-ending-right-open-transition',
      '0x14C1B0D-0x14C1BD6',
      201,
      '395e579be736dee3b94ba26f8e9c2510172845a012e1fa749dc1f73197138c5d',
    ],
    [
      'normal-recovery-per-update-delta',
      '0x14C3A21-0x14C3DA3',
      898,
      'cfe098feffb8dec35ad62b21a775523eb50bbd156e3d73499f0aba22ed873afa',
    ],
    [
      'remote-control-performance-only',
      '0x14C10B0-0x14C10FD',
      77,
      'b4f7dec6c8e2b9c8808e5d814edd4e9f654c78d0cd28d8187834c5e972faf8cb',
    ],
    [
      'weak-state-field-set',
      '0x12CDE00-0x12CDE56',
      86,
      'afa83dd1c5cdaade0685a4124b3a4e88ff1b91de1dc4d2d04adb4c62d7605cd3',
    ],
    [
      'weak-state-field-get',
      '0x12CBDF0-0x12CBE36',
      70,
      '32cd86a8e40548b57c0c5012039ed0d7468b961621727143bdeacdc3c7ed7a7a',
    ],
  ].map(([identity, range, bytes, sha256]) => ({
    identity,
    range,
    bytes,
    sha256,
  }))
);

const REQUIRED_CALLSITES = Object.freeze(
  [
    [
      'damage-read-current-weak-state',
      '0x187F360',
      '0x18811DF',
      '0x12CF070',
      'e88cdea4ff',
    ],
    [
      'damage-apply-weakness-change',
      '0x187F360',
      '0x18812DF',
      '0x188A6B0',
      'e8cc930000',
    ],
    [
      'damage-apply-hp-change',
      '0x187F360',
      '0x188240E',
      '0x187C950',
      'e83da5ffff',
    ],
    [
      'weakness-change-set-point-primary',
      '0x188A6B0',
      '0x188AC91',
      '0x12AC8A0',
      'e80a1ca2ff',
    ],
    [
      'weakness-change-set-point-force',
      '0x188A6B0',
      '0x188ADC8',
      '0x12AC8A0',
      'e8d31aa2ff',
    ],
    [
      'damage-element-execute-get-output',
      '0x138D0E0',
      '0x138D432',
      '0x1886D10',
      'e8d9984f00',
    ],
    [
      'local-update-breaking-state',
      '0x14C0EA0',
      '0x14C1083',
      '0x14C1C80',
      'e9f80b0000',
    ],
    [
      'local-update-normal-recovery',
      '0x14C0EA0',
      '0x14C109C',
      '0x14C39D0',
      'e92f290000',
    ],
  ].map(([identity, callerRva, callsiteRva, targetRva, opcodeHex]) => ({
    identity,
    callerRva,
    callsiteRva,
    targetRva,
    opcodeHex,
  }))
);

const REQUIRED_CLOSES = Object.freeze([
  'single-packet-break-multiplier-reads-pre-change-weak-state',
  'single-packet-ordinary-and-real-hp-output-use-profile-property-221-not-hardcoded-two-x',
  'single-packet-toughness-change-dispatch-precedes-change-hp',
  'pure-toughness-output-does-not-apply-break-hp-multiplier-and-is-gated-while-broken',
  'weak-break-state-enum-values-none-zero-breaking-one-ending-two',
  'local-controlled-break-and-recovery-timers-advance-by-per-update-delta-not-fixed-100ms',
  'local-controlled-break-end-comparison-transitions-at-greater-than-or-equal',
  'remote-controlled-update-runs-performance-mirroring-only',
]);

const REQUIRED_LEAVES_OPEN = Object.freeze([
  'same-frame-damage-element-queue-order-and-immediate-weak-state-visibility',
  'break-end-state-update-versus-hit-order-in-the-same-client-frame',
  'finite-hp-lethal-packet-and-post-death-tail-packet-disposition',
  'authoritative-local-versus-remote-network-path-for-the-zero-distance-passive-boss-scenario',
]);

export async function readEnemyToughnessSettlementEvidenceSource({
  sourcePath,
  gameAssemblyPath,
  il2CppDumpPath,
  il2CppScriptPath,
  captureManifestPath,
  projectRoot,
}) {
  const [sourceBytes, binary, dumpBytes, captureManifestBytes, scriptIdentity] =
    await Promise.all([
      fs.readFile(sourcePath),
      fs.readFile(gameAssemblyPath),
      fs.readFile(il2CppDumpPath),
      fs.readFile(captureManifestPath),
      createFileIdentityFromStream(il2CppScriptPath),
    ]);
  const value = JSON.parse(sourceBytes.toString('utf8'));
  const captureManifest = JSON.parse(captureManifestBytes.toString('utf8'));
  const observations = {
    binaryIdentity: createFileIdentity(gameAssemblyPath, binary),
    dumpIdentity: createFileIdentity(il2CppDumpPath, dumpBytes),
    scriptIdentity,
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
    callsites: Object.fromEntries(
      REQUIRED_CALLSITES.map(required => [
        required.identity,
        readDirectCallsite(binary, required.callsiteRva),
      ])
    ),
    captureManifest,
    captureManifestReference: {
      path: normalizeSourcePath(captureManifestPath, projectRoot),
      bytes: captureManifestBytes.byteLength,
      sha256: hashBytes(captureManifestBytes),
      manifestId: captureManifest.manifestId,
    },
  };
  validateEnemyToughnessSettlementEvidence(value, observations);
  const source = {
    path: normalizeSourcePath(sourcePath, projectRoot),
    bytes: sourceBytes.byteLength,
    sha256: hashBytes(sourceBytes),
    value,
    observations,
  };
  return {
    ...source,
    report: createEnemyToughnessSettlementEvidenceReport(source),
  };
}

export function validateEnemyToughnessSettlementEvidence(value, observations) {
  if (
    Number(value?.schemaVersion) !== 1 ||
    value?.contractName !==
      'AzPrEnemyToughnessSettlementClientRuntimeEvidence' ||
    value?.evidenceId !==
      'azpr-tc-20260709-enemy-toughness-settlement-static-v1'
  ) {
    fail('contract-invalid');
  }
  assertIdentity(
    value.reviewedBinary,
    EXPECTED_IDENTITIES.binary,
    'binary-contract-drift'
  );
  assertIdentity(
    value.reviewedIl2CppDump,
    EXPECTED_IDENTITIES.dump,
    'dump-contract-drift'
  );
  assertIdentity(
    value.reviewedIl2CppScript,
    EXPECTED_IDENTITIES.script,
    'script-contract-drift'
  );
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
  assertIdentity(
    value.reviewedIl2CppScript,
    observations?.scriptIdentity,
    'script-drift'
  );

  assertRowsAndDumpBindings(
    value.dumpBindings?.methods,
    REQUIRED_METHODS,
    observations?.dumpText,
    'method-binding-drift',
    true
  );
  assertRowsAndDumpBindings(
    value.dumpBindings?.fields,
    REQUIRED_FIELDS,
    observations?.dumpText,
    'field-binding-drift'
  );
  assertRowsAndDumpBindings(
    value.dumpBindings?.enums,
    REQUIRED_ENUMS,
    observations?.dumpText,
    'enum-binding-drift'
  );
  assertExactRows(value.binaryRanges, REQUIRED_RANGES, 'range-contract-drift');
  for (const required of REQUIRED_RANGES) {
    const observed = observations?.rangeHashes?.[required.identity];
    if (
      observed?.range !== required.range ||
      Number(observed?.bytes) !== required.bytes ||
      observed?.sha256 !== required.sha256
    ) {
      fail('range-drift', required.identity);
    }
  }
  assertExactRows(
    value.directCallsites,
    REQUIRED_CALLSITES,
    'callsite-contract-drift'
  );
  for (const required of REQUIRED_CALLSITES) {
    const observed = observations?.callsites?.[required.identity];
    if (
      observed?.callsiteRva !== required.callsiteRva ||
      observed?.targetRva !== required.targetRva ||
      observed?.opcodeHex !== required.opcodeHex
    ) {
      fail('callsite-drift', required.identity);
    }
  }
  if (
    value.conclusion?.status !== 'static-partial-controlled-capture-required' ||
    value.conclusion?.formalReady !== false ||
    value.conclusion?.blockerCode !==
      'machine-axis-enemy-settlement-client-order-open' ||
    JSON.stringify(value.conclusion?.closes) !==
      JSON.stringify(REQUIRED_CLOSES) ||
    JSON.stringify(value.conclusion?.leavesOpen) !==
      JSON.stringify(REQUIRED_LEAVES_OPEN)
  ) {
    fail('conclusion-drift');
  }
  if (
    value.captureRequirement?.manifestId !==
      'azpr-tc-20260709-three-value-runtime-capture-v3' ||
    value.captureRequirement?.captureKind !== 'toughness' ||
    value.captureRequirement?.acceptance !==
      'real controlled-session records only; no synthetic capture may close leavesOpen'
  ) {
    fail('capture-requirement-drift');
  }
  const captureManifest = observations?.captureManifest;
  if (
    captureManifest?.manifestId !== value.captureRequirement.manifestId ||
    captureManifest?.summary?.realRuntimeCaptureAvailable !== false ||
    captureManifest?.runtimeRequirements?.automaticLaunchAllowed !== false ||
    captureManifest?.runtimeRequirements?.automaticAttachAllowed !== false ||
    captureManifest?.runtimeRequirements?.antiCheatBypassAllowed !== false
  ) {
    fail('capture-manifest-drift');
  }
  const hookKeys = new Set(captureManifest?.methods?.map(row => row.key));
  for (const hook of value.captureRequirement.requiredHooks ?? []) {
    if (!hookKeys.has(hook)) fail('capture-hook-missing', hook);
  }
  return true;
}

export function createEnemyToughnessSettlementEvidenceReport(source) {
  const payload = {
    schemaVersion: 1,
    reportName: 'AzPrMachineAxisEnemyToughnessSettlementEvidence',
    phase: 'M12-B3-OPT-T2',
    generatedOn: '2026-08-08',
    evidenceArtifact: {
      path: source.path,
      bytes: source.bytes,
      sha256: source.sha256,
      evidenceId: source.value.evidenceId,
    },
    clientSources: {
      binary: source.observations.binaryIdentity,
      il2CppDump: source.observations.dumpIdentity,
      il2CppScript: source.observations.scriptIdentity,
    },
    validatedBindings: {
      methods: source.value.dumpBindings.methods,
      fields: source.value.dumpBindings.fields,
      enums: source.value.dumpBindings.enums,
      binaryRanges: source.value.binaryRanges,
      directCallsites: source.value.directCallsites,
    },
    captureManifest: source.observations.captureManifestReference,
    conclusion: source.value.conclusion,
    captureRequirement: source.value.captureRequirement,
  };
  return {
    ...payload,
    reportHash: hashBytes(Buffer.from(JSON.stringify(payload), 'utf8')),
  };
}

export function assertEnemyToughnessSettlementEvidenceReference(
  reference,
  source
) {
  const expected = {
    path: source?.path,
    bytes: source?.bytes,
    sha256: source?.sha256,
    binaryPath: normalizePath(source?.value?.reviewedBinary?.path),
    binaryBytes: source?.value?.reviewedBinary?.bytes,
    binarySha256: source?.value?.reviewedBinary?.sha256,
    il2CppDumpPath: normalizePath(source?.value?.reviewedIl2CppDump?.path),
    il2CppDumpBytes: source?.value?.reviewedIl2CppDump?.bytes,
    il2CppDumpSha256: source?.value?.reviewedIl2CppDump?.sha256,
    il2CppScriptPath: normalizePath(source?.value?.reviewedIl2CppScript?.path),
    il2CppScriptBytes: source?.value?.reviewedIl2CppScript?.bytes,
    il2CppScriptSha256: source?.value?.reviewedIl2CppScript?.sha256,
  };
  assertExactObject(reference, expected, 'report-reference-drift');
  return true;
}

export function assertEnemyToughnessSettlementReportReference(
  reference,
  observed
) {
  assertExactObject(
    {
      identity: reference?.identity,
      bytes: reference?.bytes,
      sha256: reference?.sha256,
      reportHash: reference?.reportHash,
    },
    {
      identity: observed?.path,
      bytes: observed?.bytes,
      sha256: observed?.sha256,
      reportHash: observed?.value?.reportHash,
    },
    'generated-report-reference-drift'
  );
  return true;
}

async function createFileIdentityFromStream(sourcePath) {
  const [sourceStat, sha256] = await Promise.all([
    fs.stat(sourcePath),
    hashFile(sourcePath),
  ]);
  return {
    path: normalizePath(sourcePath),
    bytes: sourceStat.size,
    sha256,
  };
}

function createFileIdentity(sourcePath, bytes) {
  return {
    path: normalizePath(sourcePath),
    bytes: bytes.byteLength,
    sha256: hashBytes(bytes),
  };
}

function assertRowsAndDumpBindings(
  actualRows,
  expectedRows,
  dumpText,
  code,
  methodRows = false
) {
  assertExactRows(actualRows, expectedRows, code);
  for (const row of expectedRows) {
    const bound = methodRows
      ? dumpBindsMethod(dumpText, row.rva, row.declaration)
      : String(dumpText ?? '').includes(row.declaration);
    if (!bound) fail(code, row.identity);
  }
}

function assertExactRows(actualRows, expectedRows, code) {
  if (!Array.isArray(actualRows) || actualRows.length !== expectedRows.length) {
    fail(code, 'row-count');
  }
  for (let index = 0; index < expectedRows.length; index += 1) {
    assertExactObject(actualRows[index], expectedRows[index], code);
  }
}

function assertExactObject(actual, expected, code) {
  if (
    !actual ||
    Object.keys(actual).length !== Object.keys(expected).length ||
    Object.entries(expected).some(([key, value]) => actual[key] !== value)
  ) {
    fail(code);
  }
}

function assertIdentity(actual, expected, code) {
  if (
    normalizeIdentityPath(actual?.path) !==
      normalizeIdentityPath(expected?.path) ||
    Number(actual?.bytes) !== Number(expected?.bytes) ||
    actual?.sha256 !== expected?.sha256
  ) {
    fail(code);
  }
}

function dumpBindsMethod(text, rva, declaration) {
  const source = String(text ?? '');
  let declarationIndex = source.indexOf(declaration);
  while (declarationIndex >= 0) {
    const prefix = source.slice(
      Math.max(0, declarationIndex - 400),
      declarationIndex
    );
    const matches = [...prefix.matchAll(/\/\/ RVA: (0x[0-9A-F]+)/gu)];
    if (matches.at(-1)?.[1] === rva) return true;
    declarationIndex = source.indexOf(declaration, declarationIndex + 1);
  }
  return false;
}

function readDirectCallsite(binary, callsiteRva) {
  const callsite = Number.parseInt(callsiteRva, 16);
  const bytes = readPortableExecutableRvaRange(
    binary,
    `${callsiteRva}-0x${(callsite + 5).toString(16).toUpperCase()}`
  );
  if (bytes.byteLength !== 5 || (bytes[0] !== 0xe8 && bytes[0] !== 0xe9)) {
    fail('callsite-opcode-invalid', callsiteRva);
  }
  const relative = bytes.readInt32LE(1);
  return {
    callsiteRva,
    targetRva: `0x${(callsite + 5 + relative).toString(16).toUpperCase()}`,
    opcodeHex: bytes.toString('hex'),
  };
}

function readPortableExecutableRvaRange(binary, range) {
  const [startText, endText] = String(range).split('-');
  const start = Number.parseInt(startText, 16);
  const end = Number.parseInt(endText, 16);
  if (!(start >= 0) || !(end > start)) fail('range-invalid', range);
  const peOffset = binary.readUInt32LE(0x3c);
  const sectionCount = binary.readUInt16LE(peOffset + 6);
  const optionalHeaderSize = binary.readUInt16LE(peOffset + 20);
  const sectionTableOffset = peOffset + 24 + optionalHeaderSize;
  for (let index = 0; index < sectionCount; index += 1) {
    const offset = sectionTableOffset + index * 40;
    const virtualSize = binary.readUInt32LE(offset + 8);
    const virtualAddress = binary.readUInt32LE(offset + 12);
    const rawSize = binary.readUInt32LE(offset + 16);
    const rawOffset = binary.readUInt32LE(offset + 20);
    const sectionEnd = virtualAddress + Math.max(virtualSize, rawSize);
    if (start >= virtualAddress && end <= sectionEnd) {
      const fileStart = rawOffset + start - virtualAddress;
      return binary.subarray(fileStart, fileStart + end - start);
    }
  }
  fail('range-unmapped', range);
}

function normalizeIdentityPath(value) {
  return normalizePath(value).toLowerCase();
}

function normalizePath(value) {
  return String(value ?? '').replaceAll('\\', '/');
}

function normalizeSourcePath(sourcePath, projectRoot) {
  const relative = path.relative(projectRoot, sourcePath);
  return relative && !relative.startsWith('..')
    ? normalizePath(relative)
    : normalizePath(sourcePath);
}

async function hashFile(sourcePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(sourcePath)) hash.update(chunk);
  return hash.digest('hex');
}

function hashBytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function fail(code, detail = null) {
  throw new Error(
    ['enemy-toughness-settlement-evidence', code, detail]
      .filter(Boolean)
      .join(':')
  );
}
