import { describe, expect, it } from 'vitest';
import manifest from '../../data/generated/runtime-capture-hook-manifest.json';

describe('runtime capture hook manifest', () => {
  it('pins source-backed TC combat hook targets and field offsets', () => {
    expect(manifest).toMatchObject({
      schemaVersion: 1,
      game: 'azur-promilia',
      kind: 'runtime-capture-hook-manifest',
      manifestId: 'azpr-tc-20260709-three-value-runtime-capture-v3',
      source: {
        kind: 'il2cpp-dump-cs',
        size: expect.any(Number),
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        clientRegion: 'TW',
        moduleName: 'GameAssembly.dll',
        imageBase: '0x180000000',
        module: {
          size: expect.any(Number),
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      },
      summary: {
        methodCount: 33,
        fieldCount: 43,
        energyMethodCount: 7,
        toughnessMethodCount: 27,
        realRuntimeCaptureAvailable: false,
      },
      runtimeRequirements: {
        attachPolicy: 'explicit-controlled-session-only',
        automaticLaunchAllowed: false,
        automaticAttachAllowed: false,
        antiCheatBypassAllowed: false,
        captureToolStatus: 'controlled-frida-host-ready',
        explicitConfirmationRequired: true,
      },
    });

    // 方法/字段键集合是结构契约（客户端更新不改符号集时应保持）；
    // RVA/偏移是二进制指纹，由 Frida self-test 验证正确性，测试只锁格式与键集合。
    const methodKeys = [
      'AliveProperty.GetBattlePropertyCurrentValue',
      'AliveProperty.SetSp',
      'AliveProperty.SetWeaknessPoint',
      'AliveProperty.SetHpByHurt',
      'AliveProperty.get_breakDmgUp',
      'SnapshotPropertyManager.GetBattlePropertyCurrentValue',
      'DamageElement.RecoverSP',
      'SPSystem.OnTransmit',
      'SPSystem.RecoverSP',
      'PetEntity.PetUltimateCdTime',
      'FormulaUtility.GetOutputWeaknessDamage',
      'FormulaUtility.GetOutputDamage',
      'FormulaUtility.GetOutputRealDamage',
      'FormulaUtility.WeaknessPointChange',
      'FormulaUtility.ChangeHP',
      'ControlProperty.get_inWeakState',
      'ControlProperty.GetWeakState',
      'ControlProperty.SetWeakState',
      'DamageElement.Execute',
      'WeakBreakSystem.UpdateWeakState',
      'WeakBreakSystem.UpdateWeakBreakEnd',
      'WeakBreakSystem.WeaknessPointUpdate',
      'WeakBreakSystem.OnUpdate_LocalControlled',
      'WeakBreakSystem.OnUpdate_RemoteControlled',
      'UnityEngine.Time.get_deltaTime',
      'UnityEngine.Time.get_frameCount',
    ];
    for (const key of methodKeys) {
      const method = manifest.methods.find(candidate => candidate.key === key);
      expect(method).toBeDefined();
      expect(method.rva).toMatch(/^0x[0-9A-Fa-f]+$/);
    }
    expect(
      manifest.methods
        .filter(method =>
          method.eventTypes.includes('recover-sp-modifier-property-read')
        )
        .map(method => method.captureWhen)
    ).toEqual([
      { argumentName: 'id', values: [105, 221, 228] },
      { argumentName: 'id', values: [105, 228] },
    ]);
    const fieldKeys = [
      'DamageElement.m_recoverSP',
      'DamageElement.m_petRecoverSP',
      'DamageElement.m_recoverInterval',
      'RecoverSPArgs.id',
      'RecoverSPArgs.delta',
      'RecoverSPArgs.mainPetSharePercent',
      'SPSystem.m_entityHandle',
      'SPSystem.m_recoverTimerMap',
      'AliveProperty.m_sp',
      'AliveProperty.m_hp',
      'AliveProperty.m_weaknessPoint',
      'ControlProperty.m_weakState',
      'WeakBreakSystem.m_curWeakTime',
      'WeakBreakSystem.m_curWeakEndTime',
      'WeakBreakSystem.m_weakState',
      'FormulaUtility.OutputDamageData.outputDamage',
      'FormulaUtility.OutputDamageData.realDamage',
      'BaseElement.<elementId>k__BackingField',
      'BaseElement.<skillId>k__BackingField',
      'BaseElement.p_sourceID',
      'PetEntity.data',
      'BaseData.<entityId>k__BackingField',
      'BaseData.<configId>k__BackingField',
    ];
    for (const key of fieldKeys) {
      const field = manifest.fields.find(candidate => candidate.key === key);
      expect(field).toBeDefined();
      expect(field.offset).toMatch(/^0x[0-9A-Fa-f]+$/);
    }

    expect(
      manifest.eventContracts.find(
        contract => contract.key === 'toughness-runtime-sequence'
      )
    ).toMatchObject({
      orderingFields: [
        'captureSequence',
        'clientFrameCount',
        'clientDeltaTimeSeconds',
        'threadId',
      ],
      requiredEventTypes: expect.arrayContaining([
        'toughness-packet-execution',
        'toughness-weak-state-read',
        'toughness-break-property-read',
        'toughness-hp-output-calculated',
        'toughness-damage-applied',
        'toughness-hp-applied',
        'toughness-state-update',
      ]),
    });
  });
});
