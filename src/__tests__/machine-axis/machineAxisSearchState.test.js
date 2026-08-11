import fixture from '../../../fixtures/machine-axis/m11-b-three-actor-120s.json';
import giseleFixture from '../../../fixtures/character-acceptance/112001-joint-attack-runtime.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';
import {
  createSearchAttackChainProjection,
  createSearchEventBoundaryNodes,
  createSearchLoopClosureProjection,
  createSearchNormalAttackInputProof,
  createSearchPendingEventProjection,
  createSearchStateSnapshot,
  deriveActiveActorId,
  deriveExecutionNodeFrame,
  hashSearchState,
  searchStatesEquivalent,
} from '../../machine-axis/machineAxisSearchState';

function cloneFixture() {
  const axis = structuredClone(fixture);
  axis.actions = axis.actions.filter(action => !action.id.startsWith('a3-'));
  return axis;
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
    const snapshot = createSearchStateSnapshot({
      run,
      contract: cloneFixture(),
    });
    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      kind: 'azpr-machine-axis-search-state',
      activeActorId: 'actor-103002',
      fps: 60,
      actors: expect.any(Array),
      kibos: expect.any(Array),
      cooldowns: expect.any(Array),
      enemy: expect.objectContaining({
        hp: 690.24,
        maxHp: 690.24,
        toughness: 213.344,
        maxToughness: 213.344,
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
    const base = createSearchStateSnapshot({ run, contract: cloneFixture() });
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
      contract: cloneFixture(),
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
    const snapshot = createSearchStateSnapshot({
      run,
      contract: cloneFixture(),
    });
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
      cloneFixture().scenario.durationFrames - finalActionEndFrame
    );
  });

  it('does not merge states that differ in legality-relevant state', () => {
    const base = createSearchStateSnapshot({ run, contract: cloneFixture() });
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

  it('keeps the complete verified 112001 continuation phase in the state hash', () => {
    const axis = structuredClone(giseleFixture);
    axis.actions = [
      {
        id: 'melania-a1',
        owner: { kind: 'actor', slotId: 'slot-1' },
        intent: {
          kind: 'public-action',
          publicActionId: 11200101,
          actionKind: 'normal-attack',
          attackInput: { sequenceIndex: 1, groupId: 'melania-chain' },
          level: 1,
        },
        schedule: { mode: 'absolute', frame: 0, offsetFrames: 0 },
      },
    ];
    axis.scenario.initialRuntimeState.controlledActor = {
      actorId: 'actor-112001',
      characterId: 112001,
    };
    const melaniaRun = service.simulate(axis);
    const at17 = createSearchAttackChainProjection({
      trace: melaniaRun.trace,
      currentFrame: 17,
      fps: 60,
    });
    expect(at17).toEqual([
      expect.objectContaining({
        actorId: 'actor-112001',
        authorityPhase: 'recovery-locked',
        authorityContractHash: expect.stringMatching(/^[0-9a-f]{16}$/),
        formIdentity: expect.stringMatching(/^normal-attack-form:/),
        chainIdentity: null,
        nextSequenceIndex: 2,
        recoveryEndFrame: 230,
      }),
    ]);
    for (const frame of [18, 72]) {
      expect(
        createSearchAttackChainProjection({
          trace: melaniaRun.trace,
          currentFrame: frame,
          fps: 60,
        })
      ).toEqual([
        expect.objectContaining({
          authorityPhase: 'successor-window',
          nextSequenceIndex: 2,
          linkWindowStartFrame: 18,
          linkWindowEndFrame: 73,
        }),
      ]);
    }
    for (const frame of [73, 229]) {
      expect(
        createSearchAttackChainProjection({
          trace: melaniaRun.trace,
          currentFrame: frame,
          fps: 60,
        })
      ).toEqual([
        expect.objectContaining({
          authorityPhase: 'recovery-locked',
          recoveryEndFrame: 230,
        }),
      ]);
    }
    expect(
      createSearchAttackChainProjection({
        trace: melaniaRun.trace,
        currentFrame: 230,
        fps: 60,
      })
    ).toEqual([]);

    const base = createSearchStateSnapshot({ run, contract: cloneFixture() });
    expect(hashSearchState({ ...base, attackChains: at17 })).not.toBe(
      hashSearchState(base)
    );
  }, 30_000);

  it('rejects a repeated A1 before an objective can score it', () => {
    const axis = structuredClone(giseleFixture);
    axis.actions = [
      {
        id: 'melania-a1-1',
        owner: { kind: 'actor', slotId: 'slot-1' },
        intent: {
          kind: 'public-action',
          publicActionId: 11200101,
          actionKind: 'normal-attack',
          attackInput: { sequenceIndex: 1, groupId: 'melania-chain-1' },
          level: 1,
        },
        schedule: { mode: 'absolute', frame: 0, offsetFrames: 0 },
      },
    ];
    axis.scenario.initialRuntimeState.controlledActor = {
      actorId: 'actor-112001',
      characterId: 112001,
    };
    const illegalTrace = structuredClone(service.simulate(axis).trace);
    const firstAction = illegalTrace.actions.find(
      action => action.id === 'melania-a1-1'
    );
    const firstSelection = illegalTrace.variants.selections.find(
      selection => selection.actionId === 'melania-a1-1'
    );
    illegalTrace.actions.push({
      ...structuredClone(firstAction),
      id: 'melania-a1-2',
      startMs: (18 * 1000) / 60,
      attackGroupId: 'melania-chain-2',
    });
    illegalTrace.executionPlan.actions.push({
      actionId: 'melania-a1-2',
      execute: true,
      status: 'scheduled',
      sourceSequenceIndex: 1,
      startMs: (18 * 1000) / 60,
    });
    illegalTrace.variants.selections.push({
      ...structuredClone(firstSelection),
      actionId: 'melania-a1-2',
      attackGroupId: 'melania-chain-2',
    });
    const proof = createSearchNormalAttackInputProof({
      trace: illegalTrace,
      fps: 60,
    });
    expect(proof).toMatchObject({
      passed: false,
      status: 'normal-attack-input-authority-rejected',
      normalAttackInputAuthority: {
        contractHash: expect.stringMatching(/^[0-9a-f]{16}$/),
      },
      issues: [
        expect.objectContaining({
          code: 'machine-axis-normal-attack-input-authority-rejected',
          actionId: 'melania-a1-2',
          phase: 'successor-window',
        }),
      ],
    });
  }, 30_000);

  it('derives the active actor from controlled actor transitions', () => {
    expect(deriveActiveActorId(run.trace)).toBe('actor-103002');
    expect(deriveActiveActorId(run.trace, { currentFrame: 0, fps: 60 })).toBe(
      run.trace.controlledActors.initialActorId
    );
    const firstTransition = run.trace.controlledActors.transitions.find(
      transition => transition.applied === true
    );
    if (firstTransition) {
      const transitionFrame = Math.round(
        (Number(firstTransition.timeMs) * 60) / 1000
      );
      expect(
        deriveActiveActorId(run.trace, {
          currentFrame: transitionFrame,
          fps: 60,
        })
      ).toBe(run.trace.controlledActors.initialActorId);
      expect(
        deriveActiveActorId(run.trace, {
          currentFrame: transitionFrame + 1,
          fps: 60,
        })
      ).toBe(firstTransition.afterActorId);
    }
    expect(deriveActiveActorId({ controlledActors: {} })).toBeNull();
    expect(
      deriveActiveActorId({
        controlledActors: { initialActorId: 'actor-101007' },
        scenario: { actorIds: ['actor-101007'] },
      })
    ).toBe('actor-101007');
  });

  it('advances a zero-duration switch past its frame before hashing the controlled actor state', () => {
    const trace = {
      scenario: {
        actorIds: ['actor-a', 'actor-b'],
        durationMs: 2000,
      },
      actions: [
        {
          id: 'switch-to-b',
          type: 'switch',
          actorId: 'actor-a',
          targetActorId: 'actor-b',
          startMs: 1000,
          durationMs: 0,
        },
      ],
      executionPlan: {
        actions: [
          {
            actionId: 'switch-to-b',
            execute: true,
            startMs: 1000,
            durationMs: 0,
          },
        ],
      },
      controlledActors: {
        initialActorId: 'actor-a',
        transitions: [
          {
            actionId: 'switch-to-b',
            applied: true,
            timeMs: 1000,
            afterActorId: 'actor-b',
          },
        ],
      },
      state: { final: {} },
    };
    const boundaryFrame = deriveExecutionNodeFrame(trace);
    expect(boundaryFrame).toBe(61);
    expect(deriveActiveActorId(trace, { currentFrame: 60, fps: 60 })).toBe(
      'actor-a'
    );
    expect(
      deriveActiveActorId(trace, { currentFrame: boundaryFrame, fps: 60 })
    ).toBe('actor-b');

    const before = createSearchStateSnapshot({
      run: { trace, evaluation: {} },
      contract: { scenario: { durationFrames: 120 } },
      currentFrame: 60,
    });
    const after = createSearchStateSnapshot({
      run: { trace, evaluation: {} },
      contract: { scenario: { durationFrames: 120 } },
      currentFrame: boundaryFrame,
    });
    expect(before.activeActorId).toBe('actor-a');
    expect(after.activeActorId).toBe('actor-b');
    expect(searchStatesEquivalent(before, after)).toBe(false);
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
