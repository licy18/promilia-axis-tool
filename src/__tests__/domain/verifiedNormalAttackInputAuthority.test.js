import { describe, expect, it } from 'vitest';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  VERIFIED_NORMAL_ATTACK_INPUT_AUTHORITY_CONTRACT_NAME,
  VERIFIED_NORMAL_ATTACK_INPUT_PHASES,
  createVerifiedNormalAttackStructuralForm,
  getVerifiedNormalAttackInputAuthorityDescriptor,
  matchVerifiedNormalAttackInput,
  resolveVerifiedNormalAttackInputPhase,
} from '../../domain/verifiedNormalAttackInputAuthority';

const MELANIA_MAPPING = mechanicsPackage.actionMappings.find(
  mapping =>
    Number(mapping.ownerId) === 112001 && mapping.actionKind === 'normal-attack'
);

describe('verified normal attack input authority', () => {
  it('publishes a frozen hash-bound policy descriptor', () => {
    const descriptor = getVerifiedNormalAttackInputAuthorityDescriptor();

    expect(descriptor).toMatchObject({
      schemaVersion: 1,
      contractName: VERIFIED_NORMAL_ATTACK_INPUT_AUTHORITY_CONTRACT_NAME,
      policyVersion: 1,
      contractHash: expect.stringMatching(/^[0-9a-f]{16}$/),
    });
    expect(Object.isFrozen(descriptor)).toBe(true);
    expect(Object.isFrozen(descriptor.phases)).toBe(true);
  });

  it('hashes the complete mapping-backed adjacency even when the graph has no chain', () => {
    expect(
      mechanicsPackage.actionVariantGraph.attackInputChains.some(
        chain => Number(chain.ownerId) === 112001
      )
    ).toBe(false);

    const first = createVerifiedNormalAttackStructuralForm({
      mapping: MELANIA_MAPPING,
    });
    const cloned = createVerifiedNormalAttackStructuralForm({
      mapping: structuredClone(MELANIA_MAPPING),
    });

    expect(first).toMatchObject({
      status: 'verified-normal-attack-structural-form-ready',
      mappingIdentity: MELANIA_MAPPING.identity,
      sourceSkillId: 11200101,
      chainIdentity: null,
      segmentCount: 5,
      formIdentity: expect.stringMatching(/^normal-attack-form:[0-9a-f]{16}$/),
    });
    expect(cloned.formIdentity).toBe(first.formIdentity);
    expect(first.segments.map(segment => segment.sequenceIndex)).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(first.segments[0].successor).toMatchObject({
      sequenceIndex: 2,
      controlSkillId: 11200102,
      subSkillIndex: 0,
      sourceIdentity: expect.any(String),
    });

    const mutated = structuredClone(MELANIA_MAPPING);
    mutated.attackInputSegments[1].sourceIdentity += '|mutated';
    expect(
      createVerifiedNormalAttackStructuralForm({ mapping: mutated })
        .formIdentity
    ).not.toBe(first.formIdentity);
  });

  it('fails closed instead of inventing a form when adjacency evidence is incomplete', () => {
    const incomplete = structuredClone(MELANIA_MAPPING);
    delete incomplete.attackInputSegments[0].linkWindow.sourceIdentity;

    expect(
      createVerifiedNormalAttackStructuralForm({ mapping: incomplete })
    ).toMatchObject({
      status: 'verified-normal-attack-structural-form-unresolved',
      formIdentity: null,
      reasons: expect.arrayContaining([
        'normal-attack-adjacency-source-identity-required',
      ]),
    });
  });

  it('builds recovery, successor, and idle phases with a strict right-open window', () => {
    const source = createMappingAttackAction({
      id: 'melania-a1',
      sequenceIndex: 1,
      groupId: 'melania-chain',
      startFrame: 0,
    });
    const at = frame =>
      resolveVerifiedNormalAttackInputPhase({
        mapping: MELANIA_MAPPING,
        acceptedAction: source,
        acceptedSelection: createSelection(source),
        actorId: source.actorId,
        inputTimeMs: frameToMs(frame),
      });

    expect(at(17)).toMatchObject({
      phase: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.RECOVERY_LOCKED,
      sourceActionId: source.id,
    });
    for (const frame of [18, 72]) {
      expect(at(frame)).toMatchObject({
        phase: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.SUCCESSOR_WINDOW,
        sourceActionId: source.id,
        expected: {
          sequenceIndex: 2,
          controlSkillId: 11200102,
          subSkillIndex: 0,
          groupId: 'melania-chain',
        },
      });
    }
    for (const frame of [73, 229]) {
      expect(at(frame)).toMatchObject({
        phase: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.RECOVERY_LOCKED,
        sourceActionId: source.id,
      });
    }
    expect(at(230)).toMatchObject({
      phase: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.IDLE,
      expected: {
        sequenceIndex: 1,
      },
    });

    const successorPhase = at(18);
    expect(
      matchVerifiedNormalAttackInput({
        action: createMappingAttackAction({
          id: 'melania-a2',
          sequenceIndex: 2,
          groupId: 'melania-chain',
          startFrame: 18,
        }),
        mapping: MELANIA_MAPPING,
        phase: successorPhase,
      })
    ).toMatchObject({ status: 'selected', accepted: true });
    expect(
      matchVerifiedNormalAttackInput({
        action: createMappingAttackAction({
          id: 'illegal-fresh-a1',
          sequenceIndex: 1,
          groupId: 'fresh-chain',
          startFrame: 18,
        }),
        mapping: MELANIA_MAPPING,
        phase: successorPhase,
      })
    ).toMatchObject({
      status: 'blocked',
      accepted: false,
      reason: 'normal-attack-successor-window-target-conflict',
    });
    expect(
      matchVerifiedNormalAttackInput({
        action: createMappingAttackAction({
          id: 'legal-fresh-a1',
          sequenceIndex: 1,
          groupId: 'fresh-chain',
          startFrame: 230,
        }),
        mapping: MELANIA_MAPPING,
        phase: at(230),
      })
    ).toMatchObject({ status: 'default', accepted: true });
  });

  it('gives a sourced special continuation priority over direct-chain state', () => {
    const source = createMappingAttackAction({
      id: 'source-a1',
      sequenceIndex: 1,
      groupId: 'source-chain',
      startFrame: 0,
    });
    const phase = resolveVerifiedNormalAttackInputPhase({
      mapping: MELANIA_MAPPING,
      acceptedAction: source,
      acceptedSelection: createSelection(source),
      actorId: source.actorId,
      inputTimeMs: frameToMs(30),
      specialContinuationCandidates: [
        {
          sourceKind: 'verified-special-continuation',
          sourceActionId: 'special-skill',
          sourceIdentity: 'verified:special:continuation',
          chainIdentity: null,
          sequenceIndex: 4,
          controlSkillId: 11200104,
          subSkillIndex: 0,
          groupId: 'source-chain',
          startsAtMs: frameToMs(20),
          endsAtMs: frameToMs(40),
        },
      ],
    });

    expect(phase).toMatchObject({
      phase: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.SUCCESSOR_WINDOW,
      sourceKind: 'verified-special-continuation',
      sourceActionId: 'special-skill',
      expected: {
        sequenceIndex: 4,
        controlSkillId: 11200104,
        subSkillIndex: 0,
      },
    });
  });
});

function createMappingAttackAction({ id, sequenceIndex, groupId, startFrame }) {
  const segment = MELANIA_MAPPING.attackInputSegments.find(
    candidate => Number(candidate.sequenceIndex) === Number(sequenceIndex)
  );
  return {
    id,
    type: 'skill',
    actionKind: 'normal-attack',
    actorId: 'actor-112001',
    skillId: 11200101,
    startMs: frameToMs(startFrame),
    attackGroupId: groupId,
    attackSequenceIndex: sequenceIndex,
    attackSequenceTotal: 5,
    attackInput: segment,
  };
}

function createSelection(action) {
  return {
    actionId: action.id,
    attackGroupId: action.attackGroupId,
    attackSequenceIndex: action.attackSequenceIndex,
    attackSequenceTotal: action.attackSequenceTotal,
    attackInputChainIdentity: action.attackInputChainIdentity ?? null,
    executionControlSkillId: action.attackInput.controlSkillId,
    selectedSubSkillIndex: action.attackInput.selectedSubSkillIndex,
  };
}

function frameToMs(frame) {
  return (Number(frame) * 1000) / 60;
}
