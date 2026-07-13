import { describe, expect, it } from 'vitest';
import manifest from '../../data/generated/runtime-capture-hook-manifest.json';

describe('runtime capture hook manifest', () => {
  it('pins source-backed TC combat hook targets and field offsets', () => {
    expect(manifest).toMatchObject({
      schemaVersion: 1,
      game: 'azur-promilia',
      kind: 'runtime-capture-hook-manifest',
      manifestId: 'azpr-tc-20260709-three-value-runtime-capture-v2',
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
        methodCount: 10,
        fieldCount: 30,
        energyMethodCount: 7,
        toughnessMethodCount: 3,
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
    ).toEqual({
      'AliveProperty.GetBattlePropertyCurrentValue': '0x12A7EE0',
      'AliveProperty.SetSp': '0x12AC280',
      'AliveProperty.SetWeaknessPoint': '0x12AC8A0',
      'SnapshotPropertyManager.GetBattlePropertyCurrentValue': '0x181D240',
      'DamageElement.RecoverSP': '0x138EEE0',
      'SPSystem.OnTransmit': '0x14837F0',
      'SPSystem.RecoverSP': '0x1483F40',
      'PetEntity.PetUltimateCdTime': '0x152D9F0',
      'FormulaUtility.GetOutputWeaknessDamage': '0x1885FF0',
      'FormulaUtility.WeaknessPointChange': '0x188A6B0',
    });
    expect(
      manifest.methods
        .filter(method =>
          method.eventTypes.includes('recover-sp-modifier-property-read')
        )
        .map(method => method.captureWhen)
    ).toEqual([
      { argumentName: 'id', values: [105, 228] },
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
      'AliveProperty.m_weaknessPoint': '0x48',
      'BaseElement.<elementId>k__BackingField': '0x120',
      'BaseElement.<skillId>k__BackingField': '0x12C',
      'BaseElement.p_sourceID': '0x38',
      'PetEntity.data': '0x1C0',
      'BaseData.<entityId>k__BackingField': '0x128',
      'BaseData.<configId>k__BackingField': '0x140',
    });
  });
});
