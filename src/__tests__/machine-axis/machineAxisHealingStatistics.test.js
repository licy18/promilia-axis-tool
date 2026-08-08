import { createCanonicalCombatTrace } from '../../simulation/headless/canonicalHeadlessCombatCore';
import {
  MACHINE_AXIS_HEAL_SETTLEMENT_TYPES,
  createMachineAxisHealingStatistics,
  isMachineAxisHealSettlement,
} from '../../machine-axis/machineAxisHealingStatistics';

function healEvent({
  type = 'VERIFIED_DIRECT_HEAL',
  frame = 0,
  phasePriority = 2,
  priority = 2,
  sequence = 0,
  actorId = 'actor-1',
  actionId = 'action-1',
  payload = {},
} = {}) {
  return {
    type,
    timeMs: (frame * 1000) / 60,
    absoluteFrame: frame,
    runtimePhasePriority: phasePriority,
    runtimePriority: priority,
    runtimeSequenceIndex: sequence,
    actorId,
    actionId,
    targetId: 'actor-target',
    payload,
  };
}

describe('Machine Axis healing statistics', () => {
  it('aggregates the four canonical heal settlements and excludes suppressed and shield events', () => {
    expect(MACHINE_AXIS_HEAL_SETTLEMENT_TYPES).toEqual([
      'VERIFIED_DIRECT_HEAL',
      'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL',
      'VERIFIED_TUNING_PERIODIC_HEAL',
      'VERIFIED_KIBO_PASSIVE_DERIVED_SELF_HEAL',
    ]);
    const events = [
      healEvent({
        actorId: 'actor-1',
        actionId: 'action-1',
        payload: { requestedChange: 100, change: 60, overheal: 40 },
      }),
      healEvent({
        type: 'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL',
        actorId: 'actor-1',
        actionId: null,
        payload: { requestedChange: 50, change: 50, overheal: 0 },
      }),
      healEvent({
        type: 'VERIFIED_TUNING_PERIODIC_HEAL',
        actorId: 'actor-2',
        actionId: 'action-2',
        payload: { requestedChange: 40, change: 0 },
      }),
      healEvent({
        type: 'VERIFIED_KIBO_PASSIVE_DERIVED_SELF_HEAL',
        actorId: null,
        actionId: null,
        payload: {
          sourceActorId: 'actor-2',
          requestedHeal: 30,
          appliedHeal: 20,
          overheal: 10,
        },
      }),
      healEvent({
        type: 'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL_SUPPRESSED',
        payload: { requestedChange: 999, change: 999 },
      }),
      healEvent({
        type: 'VERIFIED_DIRECT_SHIELD',
        payload: { requestedChange: 999, change: 999 },
      }),
    ];

    const result = createMachineAxisHealingStatistics(events, {
      durationMs: 2000,
    });

    expect(result).toMatchObject({
      requestedHealing: 220,
      effectiveHealing: 130,
      overhealing: 90,
      effectiveHps: 65,
      settlementCount: 4,
    });
    expect(result.bySourceActor).toEqual([
      {
        identity: 'actor-1',
        sourceActorId: 'actor-1',
        requestedHealing: 150,
        effectiveHealing: 110,
        overhealing: 40,
        effectiveHps: 55,
        settlementCount: 2,
      },
      {
        identity: 'actor-2',
        sourceActorId: 'actor-2',
        requestedHealing: 70,
        effectiveHealing: 20,
        overhealing: 50,
        effectiveHps: 10,
        settlementCount: 2,
      },
    ]);
    expect(result.bySourceAction.map(row => row.identity)).toEqual([
      'action-1',
      'action-2',
      'actionless|actor-1',
      'actionless|actor-2',
    ]);
    expect(isMachineAxisHealSettlement(events[0])).toBe(true);
    expect(isMachineAxisHealSettlement(events.at(-1))).toBe(false);
  });

  it('counts full-health requests as overhealing while retaining zero rows for rejected real settlements', () => {
    const result = createMachineAxisHealingStatistics(
      [
        healEvent({
          actorId: 'actor-full',
          actionId: 'full-health',
          payload: { requestedChange: 100, change: 0, overheal: 100 },
        }),
        healEvent({
          actorId: 'actor-dead',
          actionId: 'dead-target',
          payload: {
            requestedChange: 0,
            change: 0,
            applied: false,
            reason: 'direct-heal-dead-target-rejected',
          },
        }),
        healEvent({
          type: 'VERIFIED_KIBO_PASSIVE_DERIVED_SELF_HEAL',
          actorId: 'actor-missing',
          actionId: null,
          payload: {
            requestedHeal: null,
            appliedHeal: 0,
            applied: false,
            reason: 'kibo-passive-derived-self-heal-target-state-missing',
          },
        }),
      ],
      { durationMs: 0 }
    );

    expect(result).toMatchObject({
      requestedHealing: 100,
      effectiveHealing: 0,
      overhealing: 100,
      effectiveHps: 0,
      settlementCount: 3,
    });
    expect(result.bySourceAction).toHaveLength(3);
    expect(
      result.bySourceAction.find(row => row.identity === 'dead-target')
    ).toMatchObject({
      requestedHealing: 0,
      effectiveHealing: 0,
      overhealing: 0,
      settlementCount: 1,
    });
  });

  it('uses a strict half-open frame interval and remaps replay action identities', () => {
    const events = [59, 60, 119, 120].map((frame, index) =>
      healEvent({
        frame,
        sequence: index,
        actionId: frame === 119 ? 'cycle-2:action-1' : 'action-1',
        payload: { requestedChange: 10, change: 10 },
      })
    );

    const result = createMachineAxisHealingStatistics(events, {
      fps: 60,
      startFrame: 60,
      endFrame: 120,
      actionIdMap: new Map([['cycle-2:action-1', 'action-1']]),
    });

    expect(result).toMatchObject({
      requestedHealing: 20,
      effectiveHealing: 20,
      overhealing: 0,
      effectiveHps: 20,
      settlementCount: 2,
    });
    expect(result.bySourceAction).toEqual([
      {
        identity: 'action-1',
        sourceActionId: 'action-1',
        sourceActorId: 'actor-1',
        requestedHealing: 20,
        effectiveHealing: 20,
        overhealing: 0,
        effectiveHps: 20,
        settlementCount: 2,
      },
    ]);
    expect(() =>
      createMachineAxisHealingStatistics(events, {
        startFrame: 60,
        endFrame: 60,
      })
    ).toThrow(/half-open healing interval/);
  });

  it('cuts kill healing by the complete runtime cursor rather than time alone', () => {
    const events = [
      healEvent({
        frame: 99,
        sequence: 100,
        payload: { requestedChange: 1, change: 1 },
      }),
      healEvent({
        frame: 100,
        phasePriority: 2,
        priority: 2,
        sequence: 50,
        payload: { requestedChange: 10, change: 10 },
      }),
      healEvent({
        frame: 100,
        phasePriority: 3,
        priority: 3,
        sequence: 80,
        payload: { requestedChange: 100, change: 100 },
      }),
      healEvent({
        frame: 100,
        phasePriority: 3,
        priority: 3,
        sequence: 81,
        payload: { requestedChange: 1000, change: 1000 },
      }),
      healEvent({
        type: 'VERIFIED_TUNING_PERIODIC_HEAL',
        frame: 100,
        phasePriority: 4,
        priority: 4,
        sequence: 60,
        payload: { requestedChange: 10000, change: 10000 },
      }),
      healEvent({
        frame: 101,
        sequence: 1,
        payload: { requestedChange: 100000, change: 100000 },
      }),
    ];
    const killCursor = {
      timeMs: (100 * 1000) / 60,
      absoluteFrame: 100,
      runtimePhasePriority: 3,
      runtimePriority: 3,
      runtimeSequenceIndex: 80,
    };

    const result = createMachineAxisHealingStatistics(events, { killCursor });

    expect(result).toMatchObject({
      requestedHealing: 111,
      effectiveHealing: 111,
      overhealing: 0,
      settlementCount: 3,
    });
    expect(result.effectiveHps).toBeCloseTo(66.6, 8);
    expect(() =>
      createMachineAxisHealingStatistics(events, {
        startFrame: 0,
        endFrame: 120,
        killCursor,
      })
    ).toThrow(/cannot be combined/);
    expect(() =>
      createMachineAxisHealingStatistics(events, {
        killCursor: { absoluteFrame: 100 },
      })
    ).toThrow(/complete kill runtime cursor/);
  });

  it('retains requestedHeal and appliedHeal in canonical trace payloads', () => {
    const trace = createCanonicalCombatTrace({
      compilation: {
        scenario: {
          time: { fps: 60 },
          actors: [],
          actions: [],
          combatScenario: {},
        },
        dataIdentity: { fixture: 'healing-projection' },
      },
      simulation: {
        scenario: { projectId: 'healing-projection', durationMs: 1000 },
        eventLog: [
          healEvent({
            type: 'VERIFIED_KIBO_PASSIVE_DERIVED_SELF_HEAL',
            payload: {
              requestedHeal: 25,
              appliedHeal: 10,
              change: 10,
              overheal: 15,
            },
          }),
        ],
        damageTimeline: [],
      },
    });

    expect(trace.events[0].payload).toMatchObject({
      requestedHeal: 25,
      appliedHeal: 10,
      change: 10,
      overheal: 15,
    });
  });
});
