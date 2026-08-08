import fixture from '../../../fixtures/machine-axis/m11-b-three-actor-120s.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';
import {
  createMachineAxisSearchAction,
  createMachineAxisSearchGenerator,
  deriveNextStartFrameByActor,
} from '../../machine-axis/machineAxisSearchGenerator';

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
