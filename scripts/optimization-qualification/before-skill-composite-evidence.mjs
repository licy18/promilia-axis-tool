import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const BEFORE_SKILL_COMPOSITE_EVIDENCE_RELATIVE_PATH =
  'scripts/optimization-qualification/evidence/before-skill-composite-runtime-evidence.json';

const REQUIRED_METHODS = Object.freeze(
  [
    [
      'Lens.Gameplay.Modules.BigWorld.TriggerElement.CheckTriggerCondition',
      '0x13B6A50',
      'private bool CheckTriggerCondition(TTriggerElementParams.TriggerElementCondition condition, ElementTriggerDataBase triggerData) { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.TriggerElement.TriggerEventElementHandler',
      '0x13BFB50',
      'private void TriggerEventElementHandler(ElementTriggerDataBase triggerData) { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.TriggerElement.Parse',
      '0x13BD9C0',
      'public override void Parse(TElementParams param, int skillId, CustomBattleVerifyInfo verifyInfo) { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.TriggerElement.GetTriggerTarget',
      '0x13BBF50',
      'private List<EntityHandle> GetTriggerTarget(ElementTriggerDataBase triggerData, int targetType, int factionType, bool onlyCheck) { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.TriggerElement.GetAllHero',
      '0x13B8E30',
      'private void GetAllHero(ref List<EntityHandle> targets, bool onlyCheck) { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.SpElement.Execute',
      '0x13A5480',
      'public override void Execute() { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.SpElement.Parse',
      '0x13A6090',
      'public override void Parse(TElementParams param, int skillId, CustomBattleVerifyInfo verifyInfo) { }',
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
    [
      'Lens.Gameplay.Modules.BigWorld.FormulaUtility.GetOutputHeal',
      '0x1882B60',
      'private static FormulaUtility.OutputDamageData GetOutputHeal(IElement elementConfig, EntityHandle attackerHandle, EntityHandle executorHandle, EntityHandle sourceHandle) { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.FormulaUtility.ChangeHP',
      '0x187C950',
      'private static bool ChangeHP(EntityHandle attacker, EntityHandle executor, AliveData executorData, MyFloat value, ref int lockResult, out bool changeHpIndex) { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.SkillUtility.InvokeTriggerElement_SkillHandle',
      '0x18B6400',
      'public static void InvokeTriggerElement_SkillHandle(EntityHandle source, EntityHandle self, EntityHandle target, EElementTriggerEventType type, int skillSlot, int skillID, TElementParams element) { }',
    ],
  ].map(([identity, rva, declaration]) => ({ identity, rva, declaration }))
);

const REQUIRED_FIELDS = Object.freeze(
  [
    ['TTriggerElementParams.triggerInv', 'public int triggerInv; // 0x104'],
    [
      'TTriggerElementParams.triggerCounter',
      'public int triggerCounter; // 0x108',
    ],
    [
      'TSpElementParams.shareType',
      'public TSpElementParams.ESPShareType shareType; // 0xC0',
    ],
    [
      'TSpElementParams.petShareType',
      'public TSpElementParams.ESPShareType petShareType; // 0xD8',
    ],
    [
      'TSpElementParams.mainPetShareType',
      'public TSpElementParams.ESPShareType mainPetShareType; // 0xDC',
    ],
  ].map(([identity, declaration]) => ({ identity, declaration }))
);

const REQUIRED_ENUMS = Object.freeze(
  [
    [
      'EElementTriggerEventType.BeforeSkill',
      'public const EElementTriggerEventType BeforeSkill = 5;',
      '[InspectorName("释放技能前")]',
    ],
    [
      'EElementTriggerFixedConditionType.CheckSkillType',
      'public const EElementTriggerFixedConditionType CheckSkillType = 11;',
      '[Description("事件技能Tag")]',
    ],
    [
      'EElementTriggerFixedConditionType.CheckSelfStayType',
      'public const EElementTriggerFixedConditionType CheckSelfStayType = 14;',
      '[Description("Self驻场类型")]',
    ],
    [
      'ESkillTagType.NormalSkill',
      'public const ESkillTagType NormalSkill = 3;',
      '[Description("角色小技能")]',
    ],
    [
      'EHeroPetStayType.Control',
      'public const EHeroPetStayType Control = 0;',
      '[InspectorName("主控")]',
    ],
    [
      'EElementTriggerTargetType.Self',
      'public const EElementTriggerTargetType Self = 0;',
      '[Description("自身")]',
    ],
    [
      'ETriggerEffectTargetType.AllHero',
      'public const ETriggerEffectTargetType AllHero = 15;',
      '[Description("玩家所有角色（不包括联机玩家）")]',
    ],
    [
      'TSpElementParams.ESPShareType.ShareAll',
      'public const TSpElementParams.ESPShareType ShareAll = 2;',
      null,
    ],
  ].map(([identity, declaration, description]) => ({
    identity,
    declaration,
    description,
  }))
);

const REQUIRED_RANGES = Object.freeze(
  [
    [
      'before-skill-dispatch',
      '0x13eb8a8-0x13eb8d6',
      46,
      '53dce8773de6891fcd5a16c6c3e56f9705c34b3f56d02a6f5d4fee4ce5349bbd',
    ],
    [
      'condition-skill-tag',
      '0x13b72a8-0x13b7376',
      206,
      '16ca879faaba69c126030c0e7a3777487063402bcf8e8e157d3a65da43e8bc17',
    ],
    [
      'condition-self-stay',
      '0x13b7488-0x13b7570',
      232,
      '35172a6b6ec99dc2717a5f6c1dc9211ef05da744e80f1cf5cfa04c770255934a',
    ],
    [
      'interval-gate-before-condition',
      '0x13bfc35-0x13bfcd3',
      158,
      '488d1c79d0bfa25411e557ac8c98a58228522b698d4dc6fe42cdcbafdab88833',
    ],
    [
      'successful-trigger-interval-commit',
      '0x13bfd56-0x13bfda9',
      83,
      '804292b6a2286c85b50cda5c61bb9b78de155650f290afdb68884c0e4fb7dccd',
    ],
    [
      'trigger-interval-ms-parse',
      '0x13bdbae-0x13bdbee',
      64,
      '26a2066e4a24b0b8b1a5bf2c45c2bcd015c7331fc7fa8e3b7a1d621a5637ec01',
    ],
    [
      'all-hero-target-routing',
      '0x13bc21e-0x13bc232',
      20,
      'b6b2042aba09f9fac28ba5a04af90e4f526bf59edb67c6a7e528680211557446',
    ],
    [
      'sp-params-parse',
      '0x13a6180-0x13a61ed',
      109,
      '44f818d5af842541e3a65a660f88fa1e9d8a7956133017cd462650e626448b4a',
    ],
    [
      'sp-share-all-transmit',
      '0x13a5987-0x13a5b4d',
      454,
      '89f6aadc9f885e61f934f5c61870c1e7c602220e08ae46311f88e36e25b6986f',
    ],
    [
      'sp-system-main-settlement',
      '0x1483968-0x1483a69',
      257,
      '57f40489f7946782c3ad5eee1d79fa95f6b8763b9d961e59f125b137f217350b',
    ],
    [
      'sp-system-team-share',
      '0x1483c0f-0x1483d1e',
      271,
      '4068007372ea38e76fd90468190f560b6375f103b757dc4480f54d16a4a2096c',
    ],
    [
      'sp-system-cap',
      '0x1483fbb-0x1484232',
      631,
      '1be3b39c05d745bf3b6ead134761a372f29c115e8675be0efe1f433bdaf640bb',
    ],
    [
      'heal-source-target-modifiers',
      '0x1882fa8-0x188300d',
      101,
      'ca3742b16019a92ce15d75195fe81ba59d8d14609dd0815cfe66bee932cca056',
    ],
    [
      'heal-settlement-change-hp',
      '0x18835b8-0x18835f1',
      57,
      '1d7e71694b6c2c68007fc18e628bd68fccc5c800573c9d0657ab983f8e5bd3cb',
    ],
  ].map(([identity, range, bytes, sha256]) => ({
    identity,
    range,
    bytes,
    sha256,
  }))
);

const REQUIRED_DEFINITION = Object.freeze({
  setId: 1,
  pieces: 4,
  skillId: 19998006,
  triggerElementId: 199999024,
  triggerPathId: -2802459635003440600,
  eventId: 5,
  triggerTargetType: 0,
  conditionLogicValue: 0,
  conditions: [
    { conditionType: 11, conditionValue: 3, conditionExtra: 0 },
    { conditionType: 14, conditionValue: 0, conditionExtra: 0 },
  ],
  intervalMs: 12000,
  triggerCounter: -1,
  effects: [
    {
      effectIndex: 0,
      targetType: 0,
      elementId: 199999026,
      pathId: 5780315057243861000,
      kind: 'direct-sp',
      recoverType: 0,
      shareType: 2,
      petShareType: 0,
      mainPetShareType: 0,
      sourceRawValue: 16,
      commonFunctionId: 1,
      baseFunctionId: 5,
    },
    {
      effectIndex: 1,
      targetType: 15,
      elementId: 199999085,
      pathId: 892380267004970900,
      kind: 'direct-heal',
      damageType: 5,
      commonFunctionId: 1,
      baseFunctionId: 108,
      sourceRawA: 400,
      baseExpression: '(target.MAXHP[0]*A)/10000',
    },
  ],
  unloadTriggerElementId: 199999045,
  removerElementId: 199999046,
  removedElementIds: [199999045, 199999024],
});

const REQUIRED_SEMANTICS = Object.freeze({
  triggerPhase:
    'before-skill-dispatch-for-executed-action-before-action-settlement',
  conditionLogic: 'all-conditions-must-match',
  conditionFailureConsumesInterval: false,
  intervalUnit: 'milliseconds-parsed-to-seconds-by-native-runtime',
  intervalBoundary: 'right-open-suppression-exact-boundary-admitted',
  intervalPersistence:
    'absolute-last-accepted-trigger-time-per-installed-trigger',
  skillSelector: 'event-final-control-binding-skill-tag',
  staySelector: 'native-self-entity-control-stay-type',
  spScale: 'raw-points',
  heroShare: 'share-all-full-value-to-player-heroes',
  petShare: 'independent-fields-no-share-when-zero',
  healFormula:
    'target-max-hp-times-a-divided-by-10000-then-source-healup-target-healdown',
  allHeroTarget: 'player-heroes-excluding-network-players-and-pets',
  effectOrdering: 'trigger-effect-list-order-under-one-trigger-transaction',
});

export async function readBeforeSkillCompositeRuntimeEvidenceSource({
  sourcePath,
  gameAssemblyPath,
  il2CppDumpPath,
  elementFormulaPath,
  projectRoot,
}) {
  const [sourceBytes, binary, dumpBytes, formulaBytes] = await Promise.all([
    fs.readFile(sourcePath),
    fs.readFile(gameAssemblyPath),
    fs.readFile(il2CppDumpPath),
    fs.readFile(elementFormulaPath),
  ]);
  const value = JSON.parse(sourceBytes.toString('utf8'));
  const formulaRows = JSON.parse(formulaBytes.toString('utf8'));
  const observations = {
    binaryIdentity: createFileIdentity(gameAssemblyPath, binary),
    dumpIdentity: createFileIdentity(il2CppDumpPath, dumpBytes),
    formulaIdentity: createFileIdentity(elementFormulaPath, formulaBytes),
    dumpText: dumpBytes.toString('utf8'),
    formula108: (formulaRows.rows ?? formulaRows).find(
      row => Number(row.id) === 108
    ),
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
  validateBeforeSkillCompositeRuntimeEvidence(value, observations);
  return {
    path: normalizeSourcePath(sourcePath, projectRoot),
    bytes: sourceBytes.byteLength,
    sha256: hashBytes(sourceBytes),
    value: {
      ...value,
      verifiedBinary: observations.binaryIdentity,
      verifiedIl2CppDump: observations.dumpIdentity,
      verifiedElementFormula: observations.formulaIdentity,
    },
    observations,
  };
}

export function validateBeforeSkillCompositeRuntimeEvidence(
  value,
  observations
) {
  if (
    Number(value?.schemaVersion) !== 1 ||
    value?.contractName !==
      'AzPrBeforeSkillCompositeImmediateRuntimeEvidence' ||
    value?.conclusion?.status !== 'applied'
  )
    fail('contract-invalid');
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
    value.reviewedElementFormula,
    observations?.formulaIdentity,
    'formula-source-drift'
  );
  for (const required of REQUIRED_METHODS) {
    const actual = value.dumpBindings?.methods?.find(
      row => row.identity === required.identity
    );
    if (
      actual?.rva !== required.rva ||
      actual?.declaration !== required.declaration ||
      !dumpBindsMethod(
        observations?.dumpText,
        required.rva,
        required.declaration
      )
    )
      fail('method-binding-drift', required.identity);
  }
  for (const required of REQUIRED_FIELDS) {
    const actual = value.dumpBindings?.fields?.find(
      row => row.identity === required.identity
    );
    if (
      actual?.declaration !== required.declaration ||
      !observations?.dumpText?.includes(required.declaration)
    ) {
      fail('field-binding-drift', required.identity);
    }
  }
  for (const required of REQUIRED_ENUMS) {
    const actual = value.dumpBindings?.enums?.find(
      row => row.identity === required.identity
    );
    if (
      actual?.declaration !== required.declaration ||
      actual?.description !== required.description ||
      !observations?.dumpText?.includes(required.declaration) ||
      (required.description != null &&
        !observations?.dumpText?.includes(required.description))
    )
      fail('enum-binding-drift', required.identity);
  }
  for (const required of REQUIRED_RANGES) {
    const actual = value.binaryRanges?.find(
      row => row.identity === required.identity
    );
    const observed = observations?.rangeHashes?.[required.identity];
    if (
      actual?.range !== required.range ||
      Number(actual?.bytes) !== required.bytes ||
      actual?.sha256 !== required.sha256 ||
      observed?.range !== required.range ||
      Number(observed?.bytes) !== required.bytes ||
      observed?.sha256 !== required.sha256
    )
      fail('range-drift', required.identity);
  }
  if (
    JSON.stringify(value.reviewedDefinition) !==
    JSON.stringify(REQUIRED_DEFINITION)
  ) {
    fail('reviewed-definition-drift');
  }
  if (
    Number(observations?.formula108?.id) !== 108 ||
    observations?.formula108?.functionOutput !==
      REQUIRED_DEFINITION.effects[1].baseExpression
  )
    fail('formula-row-drift');
  assertExactProperties(value.semantics, REQUIRED_SEMANTICS, 'semantics-drift');
  return true;
}

export function assertBeforeSkillCompositeRuntimeEvidenceReference(
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
      elementFormulaPath: source?.value?.reviewedElementFormula?.path,
      elementFormulaBytes: source?.value?.reviewedElementFormula?.bytes,
      elementFormulaSha256: source?.value?.reviewedElementFormula?.sha256,
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
  )
    fail(code);
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
  throw new Error(
    `optimization-qualification-before-skill-composite-evidence-${code}${detail ? `:${detail}` : ''}`
  );
}
