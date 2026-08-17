import { describe, expect, it } from 'vitest';
import {
  createNormalAttackInputDisplayExpectation,
  createNormalAttackInputResolution,
  isRuntimeContextNormalAttackInput,
  isRuntimeResolvedNormalAttackInput,
  NORMAL_ATTACK_INPUT_RESOLUTION_MODE,
} from '../../domain/normalAttackInputResolution';

const mapping = {
  attackInputChainIdentity: 'normal-chain',
  attackInputSegments: [
    {
      sequenceIndex: 1,
      controlSkillId: 10000101,
      subSkillIndex: 0,
      attackInputChainIdentity: 'normal-chain',
    },
    {
      sequenceIndex: 4,
      controlSkillId: 10000104,
      subSkillIndex: 0,
      attackInputChainIdentity: 'normal-chain',
    },
  ],
};

describe('normal attack input resolution', () => {
  it('recognizes a runtime-resolved public left-click intent', () => {
    const action = {
      attackInputIntent: {
        kind: 'public-normal-attack',
        selectionMode: 'runtime-context',
        normalFormResolution: NORMAL_ATTACK_INPUT_RESOLUTION_MODE,
      },
      attackInputChainSelectionSource: 'runtime-projected',
    };

    expect(isRuntimeResolvedNormalAttackInput(action)).toBe(true);
    expect(isRuntimeContextNormalAttackInput(action)).toBe(true);
    expect(
      isRuntimeResolvedNormalAttackInput({
        ...action,
        attackInputIntent: {
          ...action.attackInputIntent,
          normalFormResolution: null,
        },
      })
    ).toBe(false);
    expect(
      isRuntimeResolvedNormalAttackInput({
        ...action,
        attackInputChainSelectionSource: 'user-explicit',
      })
    ).toBe(false);
  });

  it('keeps a declared A-index as display expectation only', () => {
    const expectation = createNormalAttackInputDisplayExpectation({
      mapping,
      attackInput: {
        sequenceIndex: 4,
        chainIdentity: 'normal-chain',
        contextActionId: 'display-predecessor',
        groupId: 'display-group',
      },
    });
    const resolution = createNormalAttackInputResolution({
      expectation,
      selection: {
        attackSequenceIndex: 1,
        executionControlSkillId: 10000101,
        selectedSubSkillIndex: 0,
        attackInputChainIdentity: 'normal-chain',
        contextActionId: null,
        attackGroupId: 'runtime-group',
      },
    });

    expect(expectation).toMatchObject({
      sequenceIndex: 4,
      controlSkillId: 10000104,
      subSkillIndex: 0,
    });
    expect(resolution).toMatchObject({
      status: 'corrected',
      actual: {
        sequenceIndex: 1,
        controlSkillId: 10000101,
        subSkillIndex: 0,
      },
      mismatchFields: expect.arrayContaining([
        'sequenceIndex',
        'controlSkillId',
        'contextActionId',
        'groupId',
      ]),
    });
  });

  it('reports unresolved when runtime authority selected no executable form', () => {
    const expectation = createNormalAttackInputDisplayExpectation({
      mapping,
      attackInput: { sequenceIndex: 1 },
    });

    expect(
      createNormalAttackInputResolution({ expectation, selection: null })
    ).toMatchObject({ status: 'unresolved' });
  });
});
