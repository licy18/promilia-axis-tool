import {
  createBattlePropertyEffectDisplayLabel,
  createCombatSourceDisplayLabel,
  createEffectSourceDisplayLabel,
  inspectSourceDisplayText,
  isSourceDisplayTextSafe,
} from '../../domain/sourceDisplayText';

describe('source display text', () => {
  it('rejects replacement characters and common mojibake without discarding raw evidence', () => {
    expect(inspectSourceDisplayText('寒悠悠普攻')).toMatchObject({
      displayable: true,
      status: 'source-name-ready',
    });
    expect(inspectSourceDisplayText('�չ�1 �ӵ�hit1')).toMatchObject({
      rawText: '�չ�1 �ӵ�hit1',
      displayable: false,
      status: 'corrupt-source-encoding',
    });
    expect(isSourceDisplayTextSafe('Buff ï¿½ damage')).toBe(false);
    expect(isSourceDisplayTextSafe('锟斤拷技能')).toBe(false);
  });

  it('creates stable semantic fallbacks while retaining source status and identity', () => {
    expect(
      createCombatSourceDisplayLabel({
        sourceText: '�ӵ�hit1',
        referenceKind: 'bulletElements',
        sequence: 2,
        sourceIdentity: 'battle:path:42',
      })
    ).toEqual({
      displayLabel: '弹体 2',
      rawSourceName: '�ӵ�hit1',
      sourceNameStatus: 'corrupt-source-encoding',
      sourceIdentity: 'battle:path:42',
    });
    expect(
      createCombatSourceDisplayLabel({
        sourceText: '',
        referenceKind: 'nested-damage',
        sequence: 3,
      }).displayLabel
    ).toBe('追加命中 3');
  });

  it('uses Azur Promilia tuning terminology without mutating raw evidence', () => {
    expect(
      createEffectSourceDisplayLabel({
        sourceText: '精通加成',
      })
    ).toMatchObject({
      displayLabel: '调谐强度加成',
      rawSourceName: '精通加成',
    });
    expect(
      createBattlePropertyEffectDisplayLabel({
        sourceText: 'Buff 全队精通提升',
        attributeId: 229,
        targetKind: 'team-actors',
      })
    ).toMatchObject({
      displayLabel: '全队调谐强度提升',
      rawSourceName: 'Buff 全队精通提升',
    });
    expect(
      createBattlePropertyEffectDisplayLabel({
        sourceText: 'Buff 主控精通提升',
        attributeId: 229,
        targetKind: 'controlling-actor',
      })
    ).toMatchObject({
      displayLabel: '主控角色调谐强度提升',
      rawSourceName: 'Buff 主控精通提升',
    });
  });
});
