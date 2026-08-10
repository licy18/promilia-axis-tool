import fixture from '../../../fixtures/machine-axis/m11-b-three-actor-120s.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';
import {
  createMachineAxisSearchAction,
  createMachineAxisSearchGenerator,
  deriveNextStartFrameByActor,
} from '../../machine-axis/machineAxisSearchGenerator';
import { createVerifiedJointAttackRuntimeBinding } from '../../domain/verifiedJointAttackRuntimeContract';

function cloneFixture() {
  return structuredClone(fixture);
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
      runtimeBindingHash:
        axis.scenario.jointAttackRuntime.bindingHash,
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
