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
const SIFLIYA_MAPPING = mechanicsPackage.actionMappings.find(
  mapping =>
    Number(mapping.ownerId) === 107001 && mapping.actionKind === 'normal-attack'
);
const MISA_MAPPING = mechanicsPackage.actionMappings.find(
  mapping =>
    Number(mapping.ownerId) === 107002 && mapping.actionKind === 'normal-attack'
);
const RUBY_MAPPING = mechanicsPackage.actionMappings.find(
  mapping =>
    Number(mapping.ownerId) === 103002 && mapping.actionKind === 'normal-attack'
);
const RUBY_ENHANCED_CHAIN =
  mechanicsPackage.actionVariantGraph.attackInputChains.find(
    chain => chain.chainIdentity === 'ruby-enhanced-twelve-inputs'
  );

describe('verified normal attack input authority', () => {
  it('publishes a frozen hash-bound policy descriptor', () => {
    const descriptor = getVerifiedNormalAttackInputAuthorityDescriptor();

    expect(descriptor).toMatchObject({
      schemaVersion: 1,
      contractName: VERIFIED_NORMAL_ATTACK_INPUT_AUTHORITY_CONTRACT_NAME,
      policyVersion: 2,
      structuralFallbackPolicy:
        'verified-graph-then-unique-mapping-reachable-prefix',
      reachablePrefixPolicy:
        'unique-a1-exact-control-subskill-contiguous-adjacency',
      contractHash: expect.stringMatching(/^[0-9a-f]{16}$/),
    });
    expect(descriptor.contractHash).not.toBe('780cb44a08c522eb');
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

  it('follows only the uniquely verified reachable prefix when unrelated source segments remain', () => {
    const sifliya = createVerifiedNormalAttackStructuralForm({
      mapping: SIFLIYA_MAPPING,
    });
    const misa = createVerifiedNormalAttackStructuralForm({
      mapping: MISA_MAPPING,
    });

    expect(sifliya).toMatchObject({
      status: 'verified-normal-attack-structural-form-ready',
      segmentCount: 2,
      segments: [
        {
          sequenceIndex: 1,
          controlSkillId: 10700101,
          subSkillIndex: 0,
          successor: {
            sequenceIndex: 2,
            controlSkillId: 10700102,
            subSkillIndex: 4,
          },
        },
        {
          sequenceIndex: 2,
          controlSkillId: 10700102,
          subSkillIndex: 4,
          successor: null,
        },
      ],
    });
    expect(misa).toMatchObject({
      status: 'verified-normal-attack-structural-form-ready',
      segmentCount: 4,
    });
    expect(misa.segments.map(segment => segment.controlSkillId)).toEqual([
      10700201, 10700202, 10700203, 10700204,
    ]);
  });

  it('keeps the sourced Sifliya A1 boundary right-open without inventing A3', () => {
    const source = createMappingAttackAction({
      id: 'sifliya-a1',
      sequenceIndex: 1,
      groupId: 'sifliya-chain',
      startFrame: 0,
      mapping: SIFLIYA_MAPPING,
      actorId: 'actor-107001',
    });
    const at = frame =>
      resolveVerifiedNormalAttackInputPhase({
        mapping: SIFLIYA_MAPPING,
        acceptedAction: source,
        acceptedSelection: createSelection(source),
        actorId: source.actorId,
        inputTimeMs: frameToMs(frame),
      });

    expect(at(19)).toMatchObject({
      phase: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.RECOVERY_LOCKED,
      reasons: ['normal-attack-successor-window-not-open'],
    });
    for (const frame of [20, 71]) {
      expect(at(frame)).toMatchObject({
        phase: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.SUCCESSOR_WINDOW,
        expected: {
          sequenceIndex: 2,
          controlSkillId: 10700102,
          subSkillIndex: 4,
        },
      });
    }
    expect(at(72)).toMatchObject({
      phase: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.RECOVERY_LOCKED,
      reasons: ['normal-attack-recovery-not-complete'],
    });
  });

  it('fails closed when a verified adjacency target is missing or ambiguous', () => {
    const missing = structuredClone(MELANIA_MAPPING);
    missing.attackInputSegments[0].linkWindow.targetControlSkillId = 99999901;
    expect(
      createVerifiedNormalAttackStructuralForm({ mapping: missing })
    ).toMatchObject({
      status: 'verified-normal-attack-structural-form-unresolved',
      reasons: expect.arrayContaining([
        'normal-attack-adjacency-target-unresolved',
      ]),
    });

    const ambiguous = structuredClone(MELANIA_MAPPING);
    ambiguous.attackInputSegments.push({
      ...structuredClone(ambiguous.attackInputSegments[1]),
      identity: 'ambiguous-a2',
      sourceIdentity: 'ambiguous-a2-source',
    });
    expect(
      createVerifiedNormalAttackStructuralForm({ mapping: ambiguous })
    ).toMatchObject({
      status: 'verified-normal-attack-structural-form-unresolved',
      reasons: expect.arrayContaining([
        'normal-attack-adjacency-target-ambiguous',
      ]),
    });
  });

  it('uses Ruby sourced attack reopen windows for derived enhanced successors', () => {
    const form = createVerifiedNormalAttackStructuralForm({
      mapping: RUBY_MAPPING,
      chain: RUBY_ENHANCED_CHAIN,
    });
    expect(form).toMatchObject({
      status: 'verified-normal-attack-structural-form-ready',
      chainIdentity: 'ruby-enhanced-twelve-inputs',
      segmentCount: 12,
      reasons: [],
    });
    expect(form.segments[0]).toMatchObject({
      sequenceIndex: 1,
      controlSkillId: 10300201,
      subSkillIndex: 1,
      linkWindow: {
        kind: 'attack-reopen-window',
        startFrame: 24,
        endFrame: 210,
        allowAttack: true,
        sourceIdentity: expect.any(String),
      },
      reopenWindow: null,
      successor: {
        sequenceIndex: 2,
        controlSkillId: 10300201,
        subSkillIndex: 2,
      },
    });

    const source = createChainAttackAction({
      id: 'ruby-enhanced-e1',
      chain: RUBY_ENHANCED_CHAIN,
      sequenceIndex: 1,
      groupId: 'ruby-enhanced-chain',
      startFrame: 0,
    });
    const at = frame =>
      resolveVerifiedNormalAttackInputPhase({
        mapping: RUBY_MAPPING,
        chain: RUBY_ENHANCED_CHAIN,
        acceptedAction: source,
        acceptedSelection: createSelection(source),
        actorId: source.actorId,
        inputTimeMs: frameToMs(frame),
      });
    expect(at(23)).toMatchObject({
      phase: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.RECOVERY_LOCKED,
      reasons: ['normal-attack-successor-window-not-open'],
    });
    for (const frame of [24, 209]) {
      expect(at(frame)).toMatchObject({
        phase: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.SUCCESSOR_WINDOW,
        expected: {
          chainIdentity: 'ruby-enhanced-twelve-inputs',
          sequenceIndex: 2,
          controlSkillId: 10300201,
          subSkillIndex: 2,
          groupId: 'ruby-enhanced-chain',
        },
      });
    }
    expect(at(210)).toMatchObject({
      phase: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.IDLE,
      expected: { sequenceIndex: 1 },
      reasons: [],
    });
  });

  it('fails closed when Ruby derived enhanced succession loses reopen evidence', () => {
    const chain = structuredClone(RUBY_ENHANCED_CHAIN);
    chain.segments[0].executionTiming.windows =
      chain.segments[0].executionTiming.windows.filter(
        window => window.kind !== 'attack-reopen-window'
      );
    expect(
      createVerifiedNormalAttackStructuralForm({
        mapping: RUBY_MAPPING,
        chain,
      })
    ).toMatchObject({
      status: 'verified-normal-attack-structural-form-unresolved',
      formIdentity: null,
      reasons: expect.arrayContaining([
        'normal-attack-adjacency-target-mismatch',
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
          sourceActionId: source.id,
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
      sourceActionId: source.id,
      expected: {
        sequenceIndex: 4,
        controlSkillId: 11200104,
        subSkillIndex: 0,
      },
    });
  });

  it('allows an explicit final-segment reopen window and keeps its end right-open', () => {
    const source = createMappingAttackAction({
      id: 'melania-a5',
      sequenceIndex: 5,
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

    expect(at(64)).toMatchObject({
      phase: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.RECOVERY_LOCKED,
    });
    for (const frame of [65, 179]) {
      expect(at(frame)).toMatchObject({
        phase: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.REOPEN_WINDOW,
        expected: { sequenceIndex: 1 },
      });
    }
    expect(at(180)).toMatchObject({
      phase: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.IDLE,
      expected: { sequenceIndex: 1 },
    });
  });

  it('does not let a raw action forge the verified structural successor window', () => {
    const source = createMappingAttackAction({
      id: 'forged-window-a1',
      sequenceIndex: 1,
      groupId: 'melania-chain',
      startFrame: 0,
    });
    source.attackInput = {
      ...source.attackInput,
      linkTimingStatus: 'applied',
      linkWindow: {
        kind: 'control-transition-window',
        startFrame: 0,
        endFrame: 230,
        targetControlSkillId: 11200105,
        targetSubSkillIndex: 0,
        sourceIdentity: 'forged:raw-action-window',
      },
    };
    const phase = resolveVerifiedNormalAttackInputPhase({
      mapping: MELANIA_MAPPING,
      acceptedAction: source,
      acceptedSelection: createSelection(source),
      actorId: source.actorId,
      inputTimeMs: frameToMs(1),
    });

    expect(phase).toMatchObject({
      phase: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.RECOVERY_LOCKED,
      sourceIdentity:
        MELANIA_MAPPING.attackInputSegments[0].linkWindow.sourceIdentity,
      reasons: ['normal-attack-successor-window-not-open'],
    });
  });

  it('fails closed for malformed or ambiguous sourced special continuations', () => {
    const source = createMappingAttackAction({
      id: 'accepted-special-source',
      sequenceIndex: 1,
      groupId: 'source-chain',
      startFrame: 0,
    });
    const resolve = candidates =>
      resolveVerifiedNormalAttackInputPhase({
        mapping: MELANIA_MAPPING,
        acceptedAction: source,
        acceptedSelection: createSelection(source),
        actorId: source.actorId,
        inputTimeMs: frameToMs(30),
        specialContinuationCandidates: candidates,
      });
    const common = {
      actorId: source.actorId,
      sourceKind: 'verified-special-continuation',
      sourceActionId: source.id,
      sourceIdentity: 'verified:test:special',
      startsAtMs: frameToMs(20),
      endsAtMs: frameToMs(40),
      groupId: source.attackGroupId,
    };
    const malformed = resolve([{ ...common, sequenceIndex: 2 }]);
    expect(malformed).toMatchObject({
      phase: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.RECOVERY_LOCKED,
      reasons: ['normal-attack-special-continuation-target-unresolved'],
    });
    expect(
      matchVerifiedNormalAttackInput({
        action: createMappingAttackAction({
          id: 'fallback-a1',
          sequenceIndex: 1,
          groupId: 'fresh-chain',
          startFrame: 30,
        }),
        mapping: MELANIA_MAPPING,
        phase: malformed,
      })
    ).toMatchObject({ status: 'blocked', accepted: false });

    const ambiguous = resolve([
      {
        ...common,
        sequenceIndex: 2,
        controlSkillId: 11200102,
        subSkillIndex: 0,
      },
      {
        ...common,
        sourceIdentity: 'verified:test:special-conflict',
        sequenceIndex: 3,
        controlSkillId: 11200103,
        subSkillIndex: 0,
      },
    ]);
    expect(ambiguous).toMatchObject({
      phase: VERIFIED_NORMAL_ATTACK_INPUT_PHASES.RECOVERY_LOCKED,
      reasons: ['normal-attack-special-continuation-target-ambiguous'],
    });
  });
});

function createMappingAttackAction({
  id,
  sequenceIndex,
  groupId,
  startFrame,
  mapping = MELANIA_MAPPING,
  actorId = 'actor-112001',
}) {
  const segment = mapping.attackInputSegments.find(
    candidate => Number(candidate.sequenceIndex) === Number(sequenceIndex)
  );
  return {
    id,
    type: 'skill',
    actionKind: 'normal-attack',
    actorId,
    skillId: mapping.sourceSkillId,
    startMs: frameToMs(startFrame),
    attackGroupId: groupId,
    attackSequenceIndex: sequenceIndex,
    attackSequenceTotal: 5,
    attackInput: segment,
  };
}

function createChainAttackAction({
  id,
  chain,
  sequenceIndex,
  groupId,
  startFrame,
}) {
  const segment = chain.segments.find(
    candidate => Number(candidate.sequenceIndex) === Number(sequenceIndex)
  );
  return {
    id,
    type: 'skill',
    actionKind: 'normal-attack',
    actorId: 'actor-103002',
    skillId: chain.sourceSkillId,
    startMs: frameToMs(startFrame),
    attackGroupId: groupId,
    attackSequenceIndex: sequenceIndex,
    attackInputChainIdentity: chain.chainIdentity,
    attackInput: {
      ...segment,
      attackInputChainIdentity: chain.chainIdentity,
    },
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
