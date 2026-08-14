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
        size: 97428254,
        sha256:
          '0ea1f95a5fe8beb0c4b6c5dc2434c72c3e2a38cf94701b240aac35bca6bd817a',
        clientRegion: 'TW',
        moduleName: 'GameAssembly.dll',
        imageBase: '0x180000000',
        module: {
          size: 222485544,
          sha256:
            'c60d13795629f0851b1399338f375eb378aef2098515d41841f30ccc3463c22b',
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

    expect(
      Object.fromEntries(
        manifest.methods.map(method => [method.key, method.rva])
      )
    ).toMatchObject({
      'AliveProperty.GetBattlePropertyCurrentValue': '0x12A7EE0',
      'AliveProperty.SetSp': '0x12AC280',
      'AliveProperty.SetWeaknessPoint': '0x12AC8A0',
      'AliveProperty.SetHpByHurt': '0x12AB970',
      'AliveProperty.get_breakDmgUp': '0x12AD660',
      'SnapshotPropertyManager.GetBattlePropertyCurrentValue': '0x181D240',
      'DamageElement.RecoverSP': '0x138EEE0',
      'SPSystem.OnTransmit': '0x14837F0',
      'SPSystem.RecoverSP': '0x1483F40',
      'PetEntity.PetUltimateCdTime': '0x152D9F0',
      'FormulaUtility.GetOutputWeaknessDamage': '0x1885FF0',
      'FormulaUtility.GetOutputDamage': '0x187F360',
      'FormulaUtility.GetOutputRealDamage': '0x1883DB0',
      'FormulaUtility.WeaknessPointChange': '0x188A6B0',
      'FormulaUtility.ChangeHP': '0x187C950',
      'ControlProperty.get_inWeakState': '0x12CF070',
      'ControlProperty.GetWeakState': '0x12CBDF0',
      'ControlProperty.SetWeakState': '0x12CDE00',
      'DamageElement.Execute': '0x138D0E0',
      'WeakBreakSystem.UpdateWeakState': '0x14C1C80',
      'WeakBreakSystem.UpdateWeakBreakEnd': '0x14C1AC0',
      'WeakBreakSystem.WeaknessPointUpdate': '0x14C39D0',
      'WeakBreakSystem.OnUpdate_LocalControlled': '0x14C0EA0',
      'WeakBreakSystem.OnUpdate_RemoteControlled': '0x14C10B0',
      'UnityEngine.Time.get_deltaTime': '0x94C2760',
      'UnityEngine.Time.get_frameCount': '0x94C28B0',
    });
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
    expect(
      Object.fromEntries(
        manifest.fields.map(field => [field.key, field.offset])
      )
    ).toMatchObject({
      'DamageElement.m_recoverSP': '0x240',
      'DamageElement.m_petRecoverSP': '0x244',
      'DamageElement.m_recoverInterval': '0x248',
      'RecoverSPArgs.id': '0x18',
      'RecoverSPArgs.delta': '0x20',
      'RecoverSPArgs.mainPetSharePercent': '0x44',
      'SPSystem.m_entityHandle': '0x10',
      'SPSystem.m_recoverTimerMap': '0x20',
      'AliveProperty.m_sp': '0x40',
      'AliveProperty.m_hp': '0x38',
      'AliveProperty.m_weaknessPoint': '0x48',
      'ControlProperty.m_weakState': '0x68',
      'WeakBreakSystem.m_curWeakTime': '0x34',
      'WeakBreakSystem.m_curWeakEndTime': '0x40',
      'WeakBreakSystem.m_weakState': '0x60',
      'FormulaUtility.OutputDamageData.outputDamage': '0x0',
      'FormulaUtility.OutputDamageData.realDamage': '0x8',
      'BaseElement.<elementId>k__BackingField': '0x120',
      'BaseElement.<skillId>k__BackingField': '0x12C',
      'BaseElement.p_sourceID': '0x38',
      'PetEntity.data': '0x1C0',
      'BaseData.<entityId>k__BackingField': '0x128',
      'BaseData.<configId>k__BackingField': '0x140',
    });

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
