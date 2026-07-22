import {
  createCombatSourceDisplayLabel,
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
});
