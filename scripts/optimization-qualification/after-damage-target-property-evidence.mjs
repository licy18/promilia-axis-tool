import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const AFTER_DAMAGE_TARGET_PROPERTY_EVIDENCE_RELATIVE_PATH =
  'scripts/optimization-qualification/evidence/after-damage-target-property-runtime-evidence.json';

const REQUIRED_METHODS = Object.freeze(
  [
    [
      'Lens.Gameplay.Modules.BigWorld.AliveElementSystem.OnExecuteDamageElement',
      '0x1318800',
      'public virtual void OnExecuteDamageElement(DamageElement damageElement) { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.DamageEventTriggerUtility.OnAfterAttack',
      '0x1871F20',
      'public static void OnAfterAttack(TDamageElementParams config, EntityHandle p_source, EntityHandle p_attacker, EntityHandle p_executor, BaseElement.SkillInfo skillInfo) { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.TriggerElement.GetTriggerTarget',
      '0x13BBF50',
      'private List<EntityHandle> GetTriggerTarget(ElementTriggerDataBase triggerData, int targetType, int factionType, bool onlyCheck) { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.BuffElement.Execute',
      '0x1372EF0',
      'public override void Execute() { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.BuffElement.ExecuteInjectElements',
      '0x1372040',
      'private void ExecuteInjectElements() { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.BuffElement.Combine',
      '0x1370DD0',
      'public override void Combine(IElement element) { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.TriggerElement.Parse',
      '0x13BD9C0',
      'public override void Parse(TElementParams param, int skillId, CustomBattleVerifyInfo verifyInfo) { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.TriggerElement.CanTrigger',
      '0x13B5770',
      'private bool CanTrigger(ElementTriggerDataBase triggerData) { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.TriggerElement.Trigger',
      '0x13BFE80',
      'private void Trigger(List<TTriggerElementParams.TriggerElementEffect> effectList, ElementTriggerDataBase triggerData) { }',
    ],
    [
      'Lens.Gameplay.Modules.BigWorld.TriggerElement.get_triggerCount',
      '0x13C04C0',
      'private int get_triggerCount() { }',
    ],
  ].map(([identity, rva, declaration]) => ({ identity, rva, declaration }))
);

const REQUIRED_FIELDS = Object.freeze(
  [
    [
      'TTriggerElementParams.triggerType',
      'public EElementTriggerType triggerType; // 0xD0',
    ],
    [
      'TTriggerElementParams.triggerCounter',
      'public int triggerCounter; // 0x108',
    ],
    ['TriggerElement.m_triggerCount', 'private int m_triggerCount; // 0x250'],
    [
      'TriggerElement.m_cfgTriggerCounter',
      'private int m_cfgTriggerCounter; // 0x254',
    ],
    ['TBuffElementParams.time', 'public int time; // 0xBC'],
    [
      'TBuffElementParams.injectElementDataList',
      'public List<TElementParams> injectElementDataList; // 0xC8',
    ],
  ].map(([identity, declaration]) => ({ identity, declaration }))
);

const REQUIRED_ENUMS = Object.freeze(
  [
    [
      'EElementTriggerEventType.AfterDamage',
      'public const EElementTriggerEventType AfterDamage = 2;',
      '[InspectorName("造成伤害后")]',
    ],
    [
      'EElementTriggerType.TriggerEvent',
      'public const EElementTriggerType TriggerEvent = 1;',
      '[Description("事件触发")]',
    ],
    [
      'EElementTriggerConditionType.OR',
      'public const EElementTriggerConditionType OR = 1;',
      null,
    ],
    [
      'EElementTriggerFixedConditionType.CheckSkillType',
      'public const EElementTriggerFixedConditionType CheckSkillType = 11;',
      '[Description("事件技能Tag")]',
    ],
    [
      'ESkillTagType.NormalAttack',
      'public const ESkillTagType NormalAttack = 1;',
      '[Description("角色普攻")]',
    ],
    [
      'ESkillTagType.WhackAttack',
      'public const ESkillTagType WhackAttack = 2;',
      '[Description("角色重击")]',
    ],
    [
      'ETriggerEffectTargetType.Target',
      'public const ETriggerEffectTargetType Target = 1;',
      '[Description("目标")]',
    ],
    [
      'ECombineType.Cover',
      'public const ECombineType Cover = 3;',
      '[Description("覆盖")]',
    ],
    [
      'EBattlePropertyType.WDM_PHYSICAL',
      'public const EBattlePropertyType WDM_PHYSICAL = 202;',
      '[Description("弱点伤害倍率_物理")]',
    ],
    [
      'EBattlePropertyType.WDM_MAGIC',
      'public const EBattlePropertyType WDM_MAGIC = 203;',
      '[Description("弱点伤害倍率_魔法")]',
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
      'damage-before-settlement-after-order',
      '0x1319260-0x13193d0',
      368,
      '6ff8e96a6bfb84f825a2f6de65cbdc246649e7b78804be6d9eea944dfedfde43',
    ],
    [
      'after-damage-event-dispatch',
      '0x1872020-0x187205b',
      59,
      '15d094315a03a2dbbf1c191a5b864b1fdc2aba76ddff0510532050755d66cfdb',
    ],
    [
      'trigger-target-routing',
      '0x13bc0ec-0x13bc13a',
      78,
      '27350ed1ab4c4758c4a54a62f4631b3fa352413b05a763d4d098ac77b7a27291',
    ],
    [
      'buff-execute-inject-call',
      '0x1372fd3-0x1373065',
      146,
      '0a6750f3772aaa47536c6fc344cc83e47a605e05be833866ede3169eb779edeb',
    ],
    [
      'buff-cover-refresh-and-reinject',
      '0x1370f3f-0x1371118',
      473,
      'ec7b134866849b898f12c8e1433b6d4d10893339427b585790fe317f3190b445',
    ],
    [
      'trigger-parse-counter-init-and-config',
      '0x13bdab9-0x13bdb65',
      172,
      '8762f0988866b44d4ad071376233fd64e2645d79c644eab524ac99865f86aa03',
    ],
    [
      'trigger-can-trigger-counter-gate',
      '0x13b57cd-0x13b57ef',
      34,
      'e365aa3edcf46b074fe4daa4a1d5ac372f6923513f1300b4b05e5eeb67fd2b3f',
    ],
    [
      'trigger-commit-counter-and-free',
      '0x13bffa9-0x13bffe0',
      55,
      '94dd375bd8567d73917d542ac82a7695d8b13b384533ac7e01563a0282f878bb',
    ],
    [
      'trigger-count-mode-dispatch',
      '0x13c0501-0x13c0534',
      51,
      'd24a19c16030f558160140e9f5890032c033e569019a8129d6c858ec144c084e',
    ],
  ].map(([identity, range, bytes, sha256]) => ({
    identity,
    range,
    bytes,
    sha256,
  }))
);

const REQUIRED_DEFINITION = Object.freeze({
  setId: 6,
  pieces: 4,
  skillId: 19998008,
  triggerElementId: 199999063,
  triggerPathId: -2660561195248504300,
  triggerType: 1,
  eventId: 2,
  triggerTargetType: 0,
  conditionLogicValue: 1,
  conditions: [
    { conditionType: 11, conditionValue: 1, conditionExtra: 0 },
    { conditionType: 11, conditionValue: 2, conditionExtra: 0 },
  ],
  triggerCounter: 999999,
  effectTargetType: 1,
  wrapperElementId: 199999071,
  wrapperPathId: 6349252756564460000,
  wrapperDurationMs: 24000,
  wrapperCombineType: 3,
  properties: [
    {
      elementId: 199999064,
      pathId: -5884995951490395000,
      attributeId: 202,
      calculateType: 1,
      sourceRawA: 2000,
      commonFunctionId: 1,
      baseFunctionId: 5,
      commonRatioRaw: 10000,
      leafDurationMs: -1,
      combineType: 3,
      combineNumber: -1,
      executeTargetType: 0,
      inheritType: 0,
    },
    {
      elementId: 199999070,
      pathId: 7187107487063477000,
      attributeId: 203,
      calculateType: 1,
      sourceRawA: 2000,
      commonFunctionId: 1,
      baseFunctionId: 5,
      commonRatioRaw: 10000,
      leafDurationMs: -1,
      combineType: 3,
      combineNumber: -1,
      executeTargetType: 0,
      inheritType: 0,
    },
  ],
  unloadTriggerElementId: 199999065,
  unloadTriggerPathId: -6224086841716568000,
  removerElementId: 199999066,
  removerPathId: 5596010208760866000,
  removedElementIds: [199999065, 199999063],
});

const REQUIRED_SEMANTICS = Object.freeze({
  triggerPhase: 'after-damage-dispatch-after-current-packet-settlement',
  observer: 'equipped-self-actor-source-events',
  condition: 'final-control-binding-skill-tag-1-or-2',
  effectTarget: 'native-damage-event-target-entity',
  wrapper: 'buff-element-cover-refresh-single-instance',
  propertyLeaves: 'both-physical-and-magic-weakness-absorption-modifiers',
  currentPacketVisibility: 'not-visible-to-triggering-packet',
  triggerCounterMode: 'event-trigger-type-uses-configured-counter',
  triggerCounterInitialState: 'runtime-count-initializes-to-zero',
  triggerCounterGate:
    'configured-limit-minus-one-or-higher-admitted-count-blocks-next-trigger',
  triggerCounterCommit:
    'increment-on-accepted-trigger-and-free-source-at-positive-limit',
  triggerCounterZeroFallback:
    'event-trigger-zero-configured-counter-resolves-to-one',
  triggerCounterLifetime: 'finite-positive-999999-not-unlimited-sentinel',
  expiryInterval: 'right-open',
  unload:
    'remove-source-trigger-roots-only-existing-target-wrapper-expires-at-original-end',
  inheritance: 'none',
});

export async function readAfterDamageTargetPropertyRuntimeEvidenceSource({
  sourcePath,
  gameAssemblyPath,
  il2CppDumpPath,
  localizationPath,
  battleElementAssetsPath,
  skillControlPath,
  projectRoot,
}) {
  const [
    sourceBytes,
    binary,
    dumpBytes,
    localizationBytes,
    battleElementAssetBytes,
    skillControlBytes,
  ] = await Promise.all([
    fs.readFile(sourcePath),
    fs.readFile(gameAssemblyPath),
    fs.readFile(il2CppDumpPath),
    fs.readFile(localizationPath),
    fs.readFile(battleElementAssetsPath),
    fs.readFile(skillControlPath),
  ]);
  const value = JSON.parse(sourceBytes.toString('utf8'));
  const observations = {
    binaryIdentity: createFileIdentity(gameAssemblyPath, binary),
    dumpIdentity: createFileIdentity(il2CppDumpPath, dumpBytes),
    localizationIdentity: createFileIdentity(
      localizationPath,
      localizationBytes
    ),
    battleElementAssetsIdentity: createFileIdentity(
      battleElementAssetsPath,
      battleElementAssetBytes
    ),
    skillControlIdentity: createFileIdentity(
      skillControlPath,
      skillControlBytes
    ),
    localizationText: localizationBytes.toString('utf8'),
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
  validateAfterDamageTargetPropertyRuntimeEvidence(value, observations);
  return {
    path: normalizeSourcePath(sourcePath, projectRoot),
    bytes: sourceBytes.byteLength,
    sha256: hashBytes(sourceBytes),
    value: structuredClone(value),
    observations,
  };
}

export function validateAfterDamageTargetPropertyRuntimeEvidence(
  value,
  observations
) {
  if (
    Number(value?.schemaVersion) !== 1 ||
    value?.contractName !== 'AzPrAfterDamageTargetPropertyRuntimeEvidence' ||
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
  assertIdentity(
    value.reviewedLocalization,
    observations?.localizationIdentity,
    'localization-drift'
  );
  assertIdentity(
    value.reviewedBattleElementAssets,
    observations?.battleElementAssetsIdentity,
    'battle-element-assets-drift'
  );
  assertIdentity(
    value.reviewedSkillControl,
    observations?.skillControlIdentity,
    'skill-control-drift'
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
    ) {
      fail('method-binding-drift', required.identity);
    }
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
    ) {
      fail('enum-binding-drift', required.identity);
    }
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
    ) {
      fail('range-drift', required.identity);
    }
  }
  if (
    JSON.stringify(value.reviewedDefinition) !==
    JSON.stringify(REQUIRED_DEFINITION)
  ) {
    fail('reviewed-definition-drift');
  }
  assertExactProperties(value.semantics, REQUIRED_SEMANTICS, 'semantics-drift');
  if (
    value.sourceConflict?.localizedSkillText == null ||
    !observations?.localizationText?.includes(
      `\"value\": \"${value.sourceConflict.localizedSkillText}\"`
    ) ||
    value.sourceConflict?.resolution !==
      'executable-wrapper-and-property-leaves-control-value-and-duration' ||
    Number(value.sourceConflict?.resolvedValueBasisPoints) !== 2000 ||
    Number(value.sourceConflict?.resolvedDurationMs) !== 24000
  ) {
    fail('source-conflict-resolution-drift');
  }
  return true;
}

export function assertAfterDamageTargetPropertyRuntimeEvidenceReference(
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
      localizationPath: source?.value?.reviewedLocalization?.path,
      localizationBytes: source?.value?.reviewedLocalization?.bytes,
      localizationSha256: source?.value?.reviewedLocalization?.sha256,
      battleElementAssetsPath: source?.value?.reviewedBattleElementAssets?.path,
      battleElementAssetsBytes:
        source?.value?.reviewedBattleElementAssets?.bytes,
      battleElementAssetsSha256:
        source?.value?.reviewedBattleElementAssets?.sha256,
      skillControlPath: source?.value?.reviewedSkillControl?.path,
      skillControlBytes: source?.value?.reviewedSkillControl?.bytes,
      skillControlSha256: source?.value?.reviewedSkillControl?.sha256,
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
    `optimization-qualification-after-damage-target-property-evidence-${code}${detail ? `:${detail}` : ''}`
  );
}
