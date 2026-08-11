import { describe, expect, it } from 'vitest';
import {
  createControlledActorTimeline,
  resolveControlledActorAt,
} from '../../simulation/runtime/controlledActorTimeline';
import { createActionRuleDiagnostics } from '../../simulation/runtime/actionRuleDiagnostics';
import { createActionExecutionPlan } from '../../simulation/engine/actionExecutionPlan';

describe('controlled actor runtime timeline', () => {
  it('projects exact-frame controlled actor intervals from executed switch actions', () => {
    const timeline = createControlledActorTimeline({
      scenario: createScenario(),
      actionExecutionPlan: {
        actions: [
          { actionId: 'switch-b', execute: true },
          { actionId: 'switch-c', execute: true },
        ],
      },
    });

    expect(timeline).toMatchObject({
      schemaVersion: 1,
      contractName: 'AzPrControlledActorTimeline',
      initialActor: { actorId: 'actor-a', characterId: 1 },
      finalActor: { actorId: 'actor-c', characterId: 3 },
      summary: {
        transitionCount: 2,
        appliedTransitionCount: 2,
        intervalCount: 3,
      },
    });
    expect(
      timeline.transitions.map(transition => [
        transition.actionId,
        transition.frameIndex,
        transition.beforeActor.actorId,
        transition.afterActor.actorId,
        transition.status,
      ])
    ).toEqual([
      ['switch-b', 60, 'actor-a', 'actor-b', 'controlled-actor-switch-applied'],
      [
        'switch-c',
        120,
        'actor-b',
        'actor-c',
        'controlled-actor-switch-applied',
      ],
    ]);
    expect(
      timeline.intervals.map(interval => [
        interval.actorId,
        interval.startFrameIndex,
        interval.endFrameIndex,
      ])
    ).toEqual([
      ['actor-a', 0, 60],
      ['actor-b', 60, 120],
      ['actor-c', 120, 300],
    ]);
    expect(resolveControlledActorAt(timeline, 1000)?.actorId).toBe('actor-b');
    expect(
      resolveControlledActorAt(timeline, 1000, { strictlyBefore: true })
        ?.actorId
    ).toBe('actor-a');
  });

  it('keeps state stable for skipped and same-target switches', () => {
    const scenario = createScenario();
    scenario.actions = [
      scenario.actions[0],
      {
        ...scenario.actions[1],
        id: 'switch-b-again',
        startMs: 1500,
        actorId: 'actor-b',
        actor: scenario.actors[1],
        targetActorId: 'actor-b',
        targetActor: scenario.actors[1],
      },
    ];
    const timeline = createControlledActorTimeline({
      scenario,
      actionExecutionPlan: {
        actions: [
          { actionId: 'switch-b', execute: false },
          { actionId: 'switch-b-again', execute: true },
        ],
      },
    });

    expect(timeline.finalActor.actorId).toBe('actor-b');
    expect(timeline.transitions.map(row => row.status)).toEqual([
      'controlled-actor-switch-skipped',
      'controlled-actor-switch-applied',
    ]);
    expect(timeline.summary.appliedTransitionCount).toBe(1);
  });

  it('fails closed for both target changes when two switches share a frame without source order', () => {
    const scenario = createScenario();
    scenario.actions = [
      {
        ...scenario.actions[1],
        id: 'switch-z',
        startMs: 1000,
        durationMs: 0,
      },
      {
        ...scenario.actions[0],
        id: 'switch-a',
        startMs: 1000,
        durationMs: 0,
      },
    ];
    const actionRuleDiagnostics = createActionRuleDiagnostics({ scenario });
    const actionExecutionPlan = createActionExecutionPlan({
      scenario,
      actionRuleDiagnostics,
    });
    const timeline = createControlledActorTimeline({
      scenario,
      actionExecutionPlan,
    });

    expect(actionExecutionPlan.executedActionIds).toEqual([]);
    expect(actionExecutionPlan.skippedActionIds).toEqual([
      'switch-z',
      'switch-a',
    ]);
    expect(
      timeline.transitions.map(transition => [
        transition.actionId,
        transition.status,
      ])
    ).toEqual([
      ['switch-z', 'controlled-actor-switch-skipped'],
      ['switch-a', 'controlled-actor-switch-skipped'],
    ]);
    expect(timeline.finalActor.actorId).toBe('actor-a');
  });
});

function createScenario() {
  const actors = [
    { id: 'actor-a', characterId: 1, name: '角色 A' },
    { id: 'actor-b', characterId: 2, name: '角色 B' },
    { id: 'actor-c', characterId: 3, name: '角色 C' },
  ];
  return {
    time: { durationMs: 5000, fps: 60 },
    actors,
    team: { slots: actors.map(actor => ({ actorId: actor.id })) },
    initialRuntimeState: {
      controlledActor: { actorId: 'actor-a', characterId: 1 },
    },
    actions: [
      {
        id: 'switch-b',
        type: 'switch',
        startMs: 1000,
        actorId: 'actor-a',
        actor: actors[0],
        targetActorId: 'actor-b',
        targetActor: actors[1],
      },
      {
        id: 'switch-c',
        type: 'switch',
        startMs: 2000,
        actorId: 'actor-b',
        actor: actors[1],
        targetActorId: 'actor-c',
        targetActor: actors[2],
      },
    ],
  };
}
