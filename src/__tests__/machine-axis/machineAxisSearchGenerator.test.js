import fixture from '../../../fixtures/machine-axis/m11-b-three-actor-authority.json';
import giseleFixture from '../../../fixtures/character-acceptance/112001-joint-attack-runtime.json';
import mitiFixture from '../../../fixtures/character-acceptance/108003-active-surface-closure.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';
import {
  createMachineAxisSearchAction,
  createMachineAxisSearchGenerator,
  deriveNextStartFrameByActor,
} from '../../machine-axis/machineAxisSearchGenerator';
import { createSearchNormalAttackInputProof } from '../../machine-axis/machineAxisSearchState';
import { createVerifiedJointAttackRuntimeBinding } from '../../domain/verifiedJointAttackRuntimeContract';

function cloneFixture() {
  const axis = structuredClone(fixture);
  axis.actions = axis.actions.filter(action => !action.id.startsWith('a3-'));
  return axis;
}

function createRubyUltimatePrefixAxis() {
  const axis = structuredClone(fixture);
  axis.scenario.durationFrames = 700;
  const rubySlot = axis.scenario.team.find(slot => slot.slotId === 'slot-3');
  rubySlot.initialSp = 100;
  axis.scenario.initialRuntimeState = {
    controlledActor: {
      actorId: 'actor-103002',
      characterId: 103002,
    },
    specialResourcesByActor: [
      {
        actorId: 'actor-103002',
        characterId: 103002,
        resourceIdentity: 'actor:103002:element:103002047',
        currentValue: 12,
        maxValue: 12,
        inputStep: 1,
        scenarioConfigurable: true,
        activeStates: [],
      },
    ],
  };
  axis.actions = [
    {
      id: 'ruby-prefix-ultimate',
      owner: { kind: 'actor', slotId: 'slot-3' },
      intent: {
        kind: 'public-action',
        publicActionId: 10300213,
        actionKind: 'ultimate',
        level: 1,
      },
      schedule: { mode: 'absolute', frame: 0 },
    },
  ];
  return axis;
}

describe('Machine Axis search generator', () => {
  let service;
  let generator;

  beforeAll(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
    service = createMachineAxisService();
    generator = createMachineAxisSearchGenerator({ service });
  });

  it('exposes schedulable character and kibo action candidates from the catalog', () => {
    const characterActions = generator.getCharacterActionCandidates(101010);
    expect(characterActions.length).toBeGreaterThan(0);
    expect(characterActions.every(entry => entry.schedulable === true)).toBe(
      true
    );
    expect(
      characterActions.some(entry => entry.actionKind === 'normal-attack')
    ).toBe(true);

    const kiboActions = generator.getKiboActionCandidates(500001, 101010);
    expect(
      kiboActions.some(
        entry =>
          entry.actionKind === 'signature' && entry.publicActionId === 50000102
      )
    ).toBe(true);
    expect(new Set(kiboActions.map(entry => entry.actionKind))).toEqual(
      new Set(['signature', 'break'])
    );
    expect(
      kiboActions.some(entry =>
        ['normal-attack', 'active'].includes(entry.actionKind)
      )
    ).toBe(false);

    expect(
      generator.getCharacterActionCandidates(108001, {
        enforceCandidateRoster: true,
      })
    ).toEqual([]);
  });

  it('generates deterministic next-action candidates with absolute schedules', () => {
    const axis = cloneFixture();
    const candidates = generator.generateNextActions({
      axis,
      run: { trace: {} },
      nextStartFrameByActor: {},
    });
    expect(candidates.length).toBeGreaterThan(0);
    const kinds = new Set(
      candidates.map(candidate => candidate.action.intent.kind)
    );
    expect(kinds.has('public-action')).toBe(true);
    expect(kinds.has('switch')).toBe(true);
    for (const candidate of candidates) {
      expect(candidate.action.schedule).toMatchObject({
        mode: 'absolute',
        frame: expect.any(Number),
      });
      expect(candidate.action.schedule.frame).toBeGreaterThanOrEqual(0);
      expect(candidate.action.id).toMatch(/^search-action-/);
      expect(candidate.source).toMatch(/^(catalog:|catalog:)/);
    }
    const ids = candidates.map(candidate => candidate.action.id);
    expect(new Set(ids).size).toBe(ids.length);

    const secondRun = generator.generateNextActions({
      axis,
      run: { trace: {} },
      nextStartFrameByActor: {},
    });
    expect(secondRun.map(candidate => candidate.action)).toEqual(
      candidates.map(candidate => candidate.action)
    );
  });

  it('generates the three source-ordered Miti release tiers as distinct candidates', () => {
    const axis = structuredClone(mitiFixture);
    axis.actions = [];
    axis.scenario.initialRuntimeState.controlledActor = {
      actorId: 'actor-108003',
      characterId: 108003,
    };
    const candidates = generator
      .generateNextActions({
        axis,
        run: { trace: {} },
        nextStartFrameByActor: {},
        options: {
          activeActorId: 'actor-108003',
          includeKibo: false,
          includeSwitch: false,
        },
      })
      .filter(
        candidate => candidate.action.intent.actionKind === 'charged-attack'
      );

    expect(
      candidates.map(candidate => ({
        tier: candidate.action.intent.semanticVariant.chargeTier,
        releaseFrame: candidate.action.intent.semanticVariant.inputFrame,
        selectorIdentity:
          candidate.action.intent.semanticVariant.selectorIdentity,
      }))
    ).toEqual([
      { tier: 1, releaseFrame: 0, selectorIdentity: 'miti-light-charge' },
      { tier: 2, releaseFrame: 29, selectorIdentity: 'miti-medium-charge' },
      { tier: 3, releaseFrame: 67, selectorIdentity: 'miti-full-charge' },
    ]);
    expect(
      candidates.every(
        candidate =>
          candidate.action.intent.physicalInput.pressFrame === 0 &&
          candidate.action.intent.physicalInput.executionFrame === 16
      )
    ).toBe(true);
    expect(
      candidates.every(
        candidate =>
          !('semanticName' in candidate.action.intent.semanticVariant) &&
          !('sourceIdentity' in candidate.action.intent.semanticVariant) &&
          candidate.label.includes('重击') &&
          candidate.sourceIdentity.includes('owner:108003')
      )
    ).toBe(true);
    for (const candidate of candidates) {
      const generatedAxis = {
        ...axis,
        actions: [candidate.action],
      };
      const prepared = service.prepare(generatedAxis);
      expect(prepared.valid).toBe(true);
      expect(prepared.issues).toEqual([]);
      const run = service.simulate(generatedAxis);
      expect(run.actionResolutions).toHaveLength(1);
      expect(run.actionResolutions[0]).toMatchObject({
        publicActionId: 10800301,
        actionKind: 'charged-attack',
      });
    }
  });

  it('exposes only a legal opener and then the exact sourced successor with one stable group', () => {
    const axis = cloneFixture();
    axis.actions = [];
    axis.scenario.initialRuntimeState.controlledActor = {
      actorId: 'actor-101010',
      characterId: 101010,
    };
    const initial = generator.generateNextActions({
      axis,
      run: { trace: {} },
      nextStartFrameByActor: {},
      options: {
        activeActorId: 'actor-101010',
        includeKibo: false,
        includeSwitch: false,
      },
    });
    const normalOpeners = initial.filter(
      candidate => candidate.action.intent.actionKind === 'normal-attack'
    );
    expect(normalOpeners.length).toBeGreaterThan(0);
    expect(
      normalOpeners.every(
        candidate => candidate.action.intent.attackInput.sequenceIndex === 1
      )
    ).toBe(true);

    const opener = normalOpeners[0];
    const withOpener = {
      ...axis,
      actions: [opener.action],
    };
    expect(service.validate(withOpener).issues).toEqual([]);
    const run = service.simulate(withOpener);
    const next = generator.generateNextActions({
      axis: withOpener,
      run,
      nextStartFrameByActor: deriveNextStartFrameByActor(run),
      options: {
        activeActorId: 'actor-101010',
        includeKibo: false,
        includeSwitch: false,
      },
    });
    const successors = next.filter(
      candidate => candidate.action.intent.actionKind === 'normal-attack'
    );
    expect(successors).toHaveLength(1);
    expect(successors[0].action.intent.attackInput).toMatchObject({
      sequenceIndex: 2,
      groupId: opener.action.intent.attackInput.groupId,
      contextActionId: opener.action.id,
    });
    expect(successors[0].startFrame).toBeGreaterThan(opener.startFrame);
  }, 30_000);

  it('keeps 112001 inside its verified A1 continuation and recovery surface', () => {
    const axis = structuredClone(giseleFixture);
    axis.actions = [];
    axis.scenario.initialRuntimeState.controlledActor = {
      actorId: 'actor-112001',
      characterId: 112001,
    };
    const initial = generator.generateNextActions({
      axis,
      run: { trace: {} },
      nextStartFrameByActor: {},
      options: {
        activeActorId: 'actor-112001',
        includeKibo: false,
        includeSwitch: false,
      },
    });
    const opener = initial.find(
      candidate =>
        candidate.action.intent.actionKind === 'normal-attack' &&
        candidate.action.intent.attackInput.sequenceIndex === 1
    );
    expect(opener).toBeDefined();

    const withOpener = { ...axis, actions: [opener.action] };
    expect(service.validate(withOpener).issues).toEqual([]);
    const run = service.simulate(withOpener);
    const normalCandidatesAt = frame =>
      generator
        .generateNextActions({
          axis: withOpener,
          run,
          nextStartFrameByActor: { 'actor-112001': frame },
          options: {
            activeActorId: 'actor-112001',
            includeKibo: false,
            includeSwitch: false,
          },
        })
        .filter(
          candidate => candidate.action.intent.actionKind === 'normal-attack'
        );

    expect(normalCandidatesAt(17)).toEqual([]);
    const at18 = normalCandidatesAt(18);
    expect(at18).toHaveLength(1);
    expect(at18[0].action.intent.attackInput).toMatchObject({
      sequenceIndex: 2,
      groupId: opener.action.intent.attackInput.groupId,
      contextActionId: opener.action.id,
    });
    expect(at18[0].startFrame).toBe(18);
    expect(normalCandidatesAt(72)).toEqual([
      expect.objectContaining({
        startFrame: 72,
        action: expect.objectContaining({
          intent: expect.objectContaining({
            attackInput: expect.objectContaining({ sequenceIndex: 2 }),
          }),
        }),
      }),
    ]);
    expect(normalCandidatesAt(73)).toEqual([]);
    expect(normalCandidatesAt(229)).toEqual([]);
    expect(normalCandidatesAt(230)).toEqual([
      expect.objectContaining({
        startFrame: 230,
        action: expect.objectContaining({
          intent: expect.objectContaining({
            attackInput: expect.objectContaining({ sequenceIndex: 1 }),
          }),
        }),
      }),
    ]);
  }, 30_000);

  it('emits only the exact verified special continuation target and fails closed when it cannot construct it', () => {
    const axis = structuredClone(giseleFixture);
    axis.actions = [];
    axis.scenario.initialRuntimeState.controlledActor = {
      actorId: 'actor-112001',
      characterId: 112001,
    };
    const createRun = targetControlSkillId => ({
      trace: {
        controlledActors: { initialActorId: 'actor-112001' },
        actions: [
          {
            id: 'special-source',
            type: 'skill',
            actorId: 'actor-112001',
            actionKind: 'star-skill',
            startMs: 0,
          },
        ],
        executionPlan: {
          actions: [
            {
              actionId: 'special-source',
              execute: true,
              sourceSequenceIndex: 0,
              startMs: 0,
            },
          ],
        },
        variants: {
          selections: [],
          attackChainContinuityWindows: [
            {
              actorId: 'actor-112001',
              sourceActionId: 'special-source',
              relationType: 'attack-chain-continuity-window',
              inputCommand: 'normal-attack',
              targetChainIdentity: null,
              targetSequenceIndex: 4,
              targetControlSkillId,
              targetSubSkillIndex: 0,
              startsAtMs: (20 * 1000) / 60,
              endsAtMs: (40 * 1000) / 60,
              sourceIdentity: 'verified:special:continuation',
              applied: true,
            },
          ],
        },
      },
    });
    const candidates = generator
      .generateNextActions({
        axis,
        run: createRun(11200104),
        nextStartFrameByActor: { 'actor-112001': 30 },
        options: {
          activeActorId: 'actor-112001',
          includeKibo: false,
          includeSwitch: false,
        },
      })
      .filter(
        candidate => candidate.action.intent.actionKind === 'normal-attack'
      );
    expect(candidates).toHaveLength(1);
    expect(candidates[0].action.intent.attackInput).toMatchObject({
      sequenceIndex: 4,
      contextActionId: 'special-source',
    });

    const rejections = [];
    const unresolved = generator
      .generateNextActions({
        axis,
        run: createRun(99999999),
        nextStartFrameByActor: { 'actor-112001': 30 },
        options: {
          activeActorId: 'actor-112001',
          includeKibo: false,
          includeSwitch: false,
          onFormalRejection: issue => rejections.push(issue),
        },
      })
      .filter(
        candidate => candidate.action.intent.actionKind === 'normal-attack'
      );
    expect(unresolved).toEqual([]);
    expect(rejections).toContainEqual(
      expect.objectContaining({
        code: 'normal-attack-special-continuation-target-unresolved',
        authoritySourceKind: 'attack-chain-continuity-window',
      })
    );
  });

  it('derives the Ruby ultimate successor from a canonical prefix and replays the generated action', () => {
    const axis = createRubyUltimatePrefixAxis();
    const prefixRun = service.simulate(axis);
    expect(
      prefixRun.trace.variants.normalAttackSpecialContinuationCandidates
    ).toEqual([
      expect.objectContaining({
        actorId: 'actor-103002',
        sourceKind: 'input-derived',
        sourceActionId: 'ruby-prefix-ultimate',
        targetActionId: null,
        chainIdentity: 'ruby-enhanced-twelve-inputs',
        sequenceIndex: 1,
        controlSkillId: 10300201,
        subSkillIndex: 1,
        applied: true,
      }),
    ]);

    const nextStartFrameByActor = deriveNextStartFrameByActor(prefixRun);
    expect(nextStartFrameByActor).toMatchObject({
      'actor-103002': 329,
    });
    const generated = generator
      .generateNextActions({
        axis,
        run: prefixRun,
        nextStartFrameByActor,
        options: {
          activeActorId: 'actor-103002',
          includeKibo: false,
          includeSwitch: false,
        },
      })
      .filter(
        candidate => candidate.action.intent.actionKind === 'normal-attack'
      );
    expect(generated).toHaveLength(1);
    expect(generated[0]).toMatchObject({
      startFrame: 329,
      action: {
        schedule: { mode: 'absolute', frame: 329 },
        intent: {
          attackInput: {
            sequenceIndex: 1,
            chainIdentity: 'ruby-enhanced-twelve-inputs',
            contextActionId: 'ruby-prefix-ultimate',
          },
        },
      },
    });

    const atExactEnd = generator
      .generateNextActions({
        axis,
        run: prefixRun,
        nextStartFrameByActor: { 'actor-103002': 537 },
        options: {
          activeActorId: 'actor-103002',
          includeKibo: false,
          includeSwitch: false,
        },
      })
      .filter(
        candidate => candidate.action.intent.actionKind === 'normal-attack'
      );
    expect(
      atExactEnd.some(
        candidate =>
          candidate.action.intent.attackInput?.chainIdentity ===
            'ruby-enhanced-twelve-inputs' ||
          candidate.action.intent.attackInput?.contextActionId ===
            'ruby-prefix-ultimate'
      )
    ).toBe(false);

    const replayAxis = structuredClone(axis);
    replayAxis.actions.push(generated[0].action);
    const prepared = service.prepare(replayAxis);
    expect(prepared.issues).toEqual([]);
    const replay = service.simulate(replayAxis);
    expect(
      replay.trace.variants.selections.find(
        selection => selection.actionId === generated[0].action.id
      )
    ).toMatchObject({
      contextActionId: 'ruby-prefix-ultimate',
      attackInputChainIdentity: 'ruby-enhanced-twelve-inputs',
      attackSequenceIndex: 1,
    });
    expect(
      createSearchNormalAttackInputProof({
        trace: replay.trace,
        fps: 60,
      })
    ).toMatchObject({
      passed: true,
      status: 'normal-attack-input-authority-passed',
      issues: [],
    });
  }, 30_000);

  it('uses the verified A5 reopen window before animation recovery completes', () => {
    const axis = structuredClone(giseleFixture);
    axis.actions = [];
    axis.scenario.initialRuntimeState.controlledActor = {
      actorId: 'actor-112001',
      characterId: 112001,
    };
    const run = {
      trace: {
        controlledActors: { initialActorId: 'actor-112001' },
        actions: [
          {
            id: 'melania-a5',
            type: 'skill',
            actorId: 'actor-112001',
            actionKind: 'normal-attack',
            skillId: 11200101,
            startMs: 0,
            attackGroupId: 'melania-chain',
            attackSequenceIndex: 5,
            attackSequenceTotal: 5,
          },
        ],
        executionPlan: {
          actions: [
            {
              actionId: 'melania-a5',
              execute: true,
              sourceSequenceIndex: 0,
              startMs: 0,
            },
          ],
        },
        variants: {
          selections: [
            {
              actionId: 'melania-a5',
              controlSkillId: 11200105,
              subSkillIndex: 0,
              attackGroupId: 'melania-chain',
              attackSequenceIndex: 5,
              attackSequenceTotal: 5,
            },
          ],
        },
      },
    };
    const normalAt = frame =>
      generator
        .generateNextActions({
          axis,
          run,
          nextStartFrameByActor: { 'actor-112001': frame },
          options: {
            activeActorId: 'actor-112001',
            includeKibo: false,
            includeSwitch: false,
          },
        })
        .filter(
          candidate => candidate.action.intent.actionKind === 'normal-attack'
        );
    expect(normalAt(64)).toEqual([]);
    expect(normalAt(65)).toEqual([
      expect.objectContaining({
        startFrame: 65,
        action: expect.objectContaining({
          intent: expect.objectContaining({
            attackInput: expect.objectContaining({ sequenceIndex: 1 }),
          }),
        }),
      }),
    ]);
  });

  it('allocates action identities after the existing axis instead of resetting each generation', () => {
    const axis = cloneFixture();
    axis.actions = [
      {
        id: 'search-action-1',
        owner: { kind: 'system', slotId: null },
        intent: { kind: 'wait', durationFrames: 1 },
        schedule: { mode: 'absolute', frame: 0, offsetFrames: 0 },
      },
    ];
    const candidates = generator.generateNextActions({
      axis,
      run: { trace: {} },
      nextStartFrameByActor: {},
    });
    const ids = candidates.map(candidate => candidate.action.id);
    expect(ids).not.toContain('search-action-1');
    expect(
      new Set([...axis.actions.map(action => action.id), ...ids]).size
    ).toBe(axis.actions.length + ids.length);

    const selectedAlternative = candidates[2].action;
    const branchedAxis = { ...axis, actions: [selectedAlternative] };
    const nextCandidates = generator.generateNextActions({
      axis: branchedAxis,
      run: { trace: {} },
      nextStartFrameByActor: {},
    });
    expect(nextCandidates.map(candidate => candidate.action.id)).not.toContain(
      selectedAlternative.id
    );
  });

  it('excludes both joint-attack halves without the product runtime contract', () => {
    const axis = cloneFixture();
    axis.actions = [];
    const rejections = [];
    const candidates = generator.generateNextActions({
      axis,
      run: { trace: {} },
      nextStartFrameByActor: {},
      options: {
        activeActorId: 'actor-101010',
        includeSwitch: false,
        requireFormalLegality: true,
        onFormalRejection: issue => rejections.push(issue),
      },
    });
    expect(
      candidates.some(
        candidate => candidate.action.intent.actionKind === 'star-combo'
      )
    ).toBe(false);
    expect(
      candidates.some(
        candidate =>
          candidate.ownerKind === 'kibo' &&
          candidate.action.intent.publicActionId === 50000112
      )
    ).toBe(false);
    expect(rejections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'joint-attack-runtime-contract-required',
        }),
      ])
    );
  });

  it('generates one atomic joint-attack compound when the product runtime contract is bound', () => {
    const axis = cloneFixture();
    axis.actions = [];
    axis.scenario.jointAttackRuntime =
      createVerifiedJointAttackRuntimeBinding();
    const rejections = [];
    const candidates = generator.generateNextActions({
      axis,
      run: { trace: {} },
      nextStartFrameByActor: {},
      options: {
        activeActorId: 'actor-101010',
        includeSwitch: false,
        requireFormalLegality: true,
        onFormalRejection: issue => rejections.push(issue),
      },
    });
    const compounds = candidates.filter(
      candidate => candidate.compoundKind === 'joint-attack'
    );
    expect(compounds).toHaveLength(1);
    expect(compounds[0]).toMatchObject({
      ownerKind: 'compound',
      source: 'catalog:verified-joint-attack-compound',
      runtimeBindingHash: axis.scenario.jointAttackRuntime.bindingHash,
      actions: [
        expect.objectContaining({
          owner: { kind: 'actor', slotId: expect.any(String) },
          intent: expect.objectContaining({ actionKind: 'star-combo' }),
        }),
        expect.objectContaining({
          owner: { kind: 'kibo', slotId: expect.any(String) },
          intent: expect.objectContaining({ actionKind: 'break' }),
        }),
      ],
    });
    expect(new Set(compounds[0].actions.map(action => action.id)).size).toBe(2);
    expect(rejections).toEqual([]);
    expect(
      candidates.some(
        candidate =>
          candidate.compoundKind == null &&
          candidate.action.owner.kind === 'kibo' &&
          candidate.action.intent.actionKind === 'break'
      )
    ).toBe(false);
  });

  it('resets to a legal opener after an ordinary intervening skill', () => {
    const axis = cloneFixture();
    axis.actions = [];
    const run = {
      trace: {
        actions: [
          {
            id: 'chain-a1',
            type: 'skill',
            actorId: 'actor-101010',
            actionKind: 'normal-attack',
            skillId: 10101001,
            startMs: 0,
          },
          {
            id: 'chain-interruption',
            type: 'skill',
            actorId: 'actor-101010',
            actionKind: 'star-skill',
            startMs: (5 * 1000) / 60,
          },
        ],
        executionPlan: {
          actions: [
            {
              actionId: 'chain-a1',
              execute: true,
              sourceSequenceIndex: 0,
              startMs: 0,
            },
            {
              actionId: 'chain-interruption',
              execute: true,
              sourceSequenceIndex: 1,
              startMs: (5 * 1000) / 60,
            },
          ],
        },
        variants: {
          selections: [
            {
              actionId: 'chain-a1',
              attackGroupId: 'chain-group',
              attackSequenceIndex: 1,
              attackSequenceTotal: 5,
              attackInputChainIdentity: 'chain:10101001',
              attackInputLinkTimingStatus: 'applied',
              attackInputLinkWindow: {
                startFrame: 1,
                endFrame: 20,
                sourceIdentity: 'client-input-window:a1-a2',
              },
            },
          ],
        },
      },
    };
    const candidates = generator.generateNextActions({
      axis,
      run,
      nextStartFrameByActor: { 'actor-101010': 10 },
      options: {
        activeActorId: 'actor-101010',
        includeKibo: false,
        includeSwitch: false,
        requireFormalLegality: true,
      },
    });
    const normalCandidates = candidates.filter(
      candidate => candidate.action.intent.actionKind === 'normal-attack'
    );
    expect(normalCandidates.length).toBeGreaterThan(0);
    expect(
      normalCandidates.every(
        candidate => candidate.action.intent.attackInput.sequenceIndex === 1
      )
    ).toBe(true);
  });

  it('schedules candidates at the per-actor next available frame', () => {
    const axis = cloneFixture();
    const candidates = generator.generateNextActions({
      axis,
      run: { trace: {} },
      nextStartFrameByActor: { 'actor-101007': 120 },
    });
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every(candidate => candidate.startFrame >= 120)).toBe(
      true
    );
  });

  it('derives per-actor next start frames from an executed trace', () => {
    const run = service.simulate(cloneFixture());
    const nextFrames = deriveNextStartFrameByActor(run);
    const actorIds = Object.keys(nextFrames);
    expect(actorIds).toContain('actor-101007');
    expect(actorIds).toContain('actor-101010');
    expect(actorIds).toContain('actor-103002');
    for (const frame of Object.values(nextFrames)) {
      expect(Number.isInteger(frame)).toBe(true);
      expect(frame).toBeGreaterThanOrEqual(0);
    }
  });

  it('builds valid machine axis action shapes for switch, wait, and public actions', () => {
    const switchAction = createMachineAxisSearchAction({
      id: 'sw',
      ownerKind: 'actor',
      slotId: 'slot-1',
      actionKind: 'switch',
      targetSlotId: 'slot-2',
      startFrame: 10,
    });
    expect(switchAction).toEqual({
      id: 'sw',
      owner: { kind: 'actor', slotId: 'slot-1' },
      schedule: { mode: 'absolute', frame: 10, offsetFrames: 0 },
      note: 'machine-axis-search-generated',
      intent: { kind: 'switch', targetSlotId: 'slot-2' },
    });

    const waitAction = createMachineAxisSearchAction({
      id: 'wa',
      ownerKind: 'system',
      actionKind: 'wait',
      durationFrames: 3,
    });
    expect(waitAction.owner).toEqual({ kind: 'system', slotId: null });
    expect(waitAction.intent).toEqual({ kind: 'wait', durationFrames: 3 });

    const publicAction = createMachineAxisSearchAction({
      id: 'pa',
      ownerKind: 'kibo',
      slotId: 'slot-1',
      publicActionId: 50000102,
      actionKind: 'signature',
      startFrame: 5,
    });
    expect(publicAction.intent).toMatchObject({
      kind: 'public-action',
      publicActionId: 50000102,
      actionKind: 'signature',
      level: 1,
    });
  });
});
