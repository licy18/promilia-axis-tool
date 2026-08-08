import fixture from '../../../fixtures/machine-axis/m11-b-three-actor-120s.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';
import {
  createSearchEventBoundaryNodes,
  createSearchLoopClosureProjection,
  createSearchPendingEventProjection,
  createSearchStateSnapshot,
  deriveActiveActorId,
  hashSearchState,
  searchStatesEquivalent,
} from '../../machine-axis/machineAxisSearchState';

function cloneFixture() {
  return structuredClone(fixture);
}

describe('Machine Axis search state', () => {
  let service;
  let run;

  beforeAll(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
    service = createMachineAxisService();
    run = service.simulate(cloneFixture());
  });

  it('builds a deterministic state snapshot from a canonical run', () => {
    const snapshot = createSearchStateSnapshot({ run, contract: fixture });
    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      kind: 'azpr-machine-axis-search-state',
      activeActorId: 'actor-103002',
      fps: 60,
      actors: expect.any(Array),
      kibos: expect.any(Array),
      cooldowns: expect.any(Array),
      enemy: expect.objectContaining({
        toughness: expect.any(Number),
        maxToughness: 6667,
        defeated: false,
      }),
    });
    expect(snapshot.actors).toHaveLength(3);
    expect(snapshot.kibos).toHaveLength(3);
    expect(snapshot.damage.hpDamage).toBe(run.evaluation.totals.hpDamage);
    const hash = hashSearchState(snapshot);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
    expect(hashSearchState(snapshot)).toBe(hash);
    expect(searchStatesEquivalent(snapshot, snapshot)).toBe(true);
  });

  it('treats arrival time and prefix damage as non-equivalence keys', () => {
    const base = createSearchStateSnapshot({ run, contract: fixture });
    const later = {
      ...base,
      currentFrame: base.currentFrame + 30,
      timeMs: base.timeMs + 500,
      remainingFrames: Math.max(0, base.remainingFrames - 30),
      damage: { ...base.damage, hpDamage: base.damage.hpDamage + 100 },
    };
    expect(hashSearchState(base)).not.toBe(hashSearchState(later));
    expect(searchStatesEquivalent(base, later)).toBe(false);
    expect(createSearchLoopClosureProjection(later)).toEqual(
      createSearchLoopClosureProjection(base)
    );
  });

  it('includes shared charge count, timer, and settlement identity in the search hash', () => {
    const withChargeState = structuredClone(run);
    withChargeState.trace.readiness.cooldownState = [
      {
        runtimeOwnerIdentity: 'actor:actor-109001',
        ownerId: 'actor-109001',
        skillId: 10900112,
        cooldownIdentity: 10900112,
        cooldownType: 'charge',
        fullCooldownMs: 15_000,
        chargeMaxCount: 2,
        currentChargeCount: 0,
        coolTimeMs: 12_000,
        sharedTimerRunning: true,
        nextReadyAtMs: 17_000,
        lastSettlementTimeMs: 5_000,
        lastSettlementIdentity: 'cooldown-charge-cast|moyin-star-2',
        lastCooldownReductionTransactionId:
          'cooldown-reduction|moyin-ultimate|109001171|0',
        missingChargeSourceActionIds: ['moyin-star-2'],
      },
    ];
    const snapshot = createSearchStateSnapshot({
      run: withChargeState,
      contract: fixture,
    });
    expect(snapshot.chargeCooldowns).toEqual([
      expect.objectContaining({
        currentChargeCount: 0,
        coolTimeMs: 12_000,
        sharedTimerRunning: true,
        lastSettlementIdentity: 'cooldown-charge-cast|moyin-star-2',
      }),
    ]);

    const differentTimer = structuredClone(snapshot);
    differentTimer.chargeCooldowns[0].coolTimeMs = 11_000;
    expect(hashSearchState(differentTimer)).not.toBe(hashSearchState(snapshot));
    const differentSettlement = structuredClone(snapshot);
    differentSettlement.chargeCooldowns[0].lastSettlementIdentity =
      'cooldown-natural-recovery|10900112';
    expect(hashSearchState(differentSettlement)).not.toBe(
      hashSearchState(snapshot)
    );
  });

  it('keeps delayed settlements from already-started actions in the node state', () => {
    const pending = createSearchPendingEventProjection({
      currentFrame: 10,
      run: {
        actionResolutions: [
          { actionId: 'delayed-action', startFrame: 0 },
          { actionId: 'future-action', startFrame: 20 },
        ],
        trace: {
          damage: [
            {
              actionId: 'delayed-action',
              absoluteFrame: 10,
              hitIdentity: 'already-settled',
            },
            {
              actionId: 'delayed-action',
              absoluteFrame: 14,
              hitIdentity: 'pending-hit',
              runtimeSequenceIndex: 2,
            },
            {
              actionId: 'future-action',
              absoluteFrame: 25,
              hitIdentity: 'not-yet-started',
            },
          ],
          effects: { events: [] },
          resources: { tuningMarks: [], special: [] },
          variants: { resourceEvents: [], stateEvents: [] },
          state: { targetEvents: [] },
        },
      },
    });
    expect(pending).toEqual([
      {
        kind: 'hit',
        frame: 14,
        actionId: 'delayed-action',
        identity: 'pending-hit',
        phase: null,
        sequence: 2,
        sourceSequencePath: null,
      },
    ]);
  });

  it('infers the real execution node instead of coercing a null frame to zero', () => {
    const snapshot = createSearchStateSnapshot({ run, contract: fixture });
    const finalActionEndFrame = Math.max(
      ...run.trace.executionPlan.actions
        .filter(entry => entry.execute !== false)
        .map(entry =>
          Math.round(((entry.startMs + entry.durationMs) * 60) / 1000)
        )
    );
    expect(snapshot.currentFrame).toBe(finalActionEndFrame);
    expect(snapshot.currentFrame).toBeGreaterThan(0);
    expect(snapshot.remainingFrames).toBe(
      fixture.scenario.durationFrames - finalActionEndFrame
    );
  });

  it('does not merge states that differ in legality-relevant state', () => {
    const base = createSearchStateSnapshot({ run, contract: fixture });
    const differentBuff = {
      ...base,
      effects: [
        {
          effectId: 'battle-element:101010206',
          targetId: 'actor-101010',
          stacks: 2,
          startMs: 0,
          endMs: 60000,
        },
      ],
    };
    expect(searchStatesEquivalent(base, differentBuff)).toBe(false);

    const differentCooldown = {
      ...base,
      cooldowns: [
        {
          actionId: 'xunlang-signature',
          ownerId: 500001,
          skillId: 50000102,
          endMs: 99999,
          startMs: 0,
          status: 'skill-cooldown-window-active',
          active: true,
        },
      ],
    };
    expect(searchStatesEquivalent(base, differentCooldown)).toBe(false);

    const differentActor = {
      ...base,
      activeActorId: 'actor-101007',
    };
    expect(searchStatesEquivalent(base, differentActor)).toBe(false);

    const brokenEnemy = {
      ...base,
      enemy: { ...base.enemy, inBreak: true },
    };
    expect(searchStatesEquivalent(base, brokenEnemy)).toBe(false);
  });

  it('derives the active actor from controlled actor transitions', () => {
    expect(deriveActiveActorId(run.trace)).toBe('actor-103002');
    expect(deriveActiveActorId({ controlledActors: {} })).toBeNull();
    expect(
      deriveActiveActorId({
        controlledActors: { initialActorId: 'actor-101007' },
        scenario: { actorIds: ['actor-101007'] },
      })
    ).toBe('actor-101007');
  });

  it('extracts event boundary nodes without frame-by-frame enumeration', () => {
    const nodes = createSearchEventBoundaryNodes({
      run,
      durationFrames: 7200,
      burstWindowMs: 10000,
    });
    expect(nodes.length).toBeGreaterThan(0);
    const kinds = new Set(nodes.map(node => node.kind));
    expect(kinds.has('action-end')).toBe(true);
    expect(kinds.has('cd-ready')).toBe(true);
    expect(kinds.has('state-change')).toBe(true);
    expect(kinds.has('resource-change')).toBe(true);
    expect(kinds.has('window-boundary')).toBe(true);
    expect(kinds.has('horizon')).toBe(true);
    const frames = nodes.map(node => node.frame);
    expect([...frames].sort((a, b) => a - b)).toEqual(frames);
    expect(frames[frames.length - 1]).toBe(7200);
    expect(
      nodes.some(
        node =>
          node.kind === 'window-boundary' &&
          (node.frame === 0 || node.frame === 600)
      )
    ).toBe(true);
    expect(
      nodes
        .filter(node => node.kind === 'action-end')
        .every(node => node.actionId)
    ).toBe(true);
  });

  it('marks the enemy defeated when HP is exhausted', () => {
    const defeatedRun = {
      trace: {
        scenario: { durationMs: 120000, frameRate: 60 },
        state: { final: { enemy: { hp: 0, toughness: 100 } } },
        controlledActors: {},
      },
      evaluation: { totals: {} },
    };
    const snapshot = createSearchStateSnapshot({ run: defeatedRun });
    expect(snapshot.enemy.defeated).toBe(true);
  });
});
