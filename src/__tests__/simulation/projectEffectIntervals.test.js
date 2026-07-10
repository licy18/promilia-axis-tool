import { describe, expect, it } from 'vitest';
import { projectEffectRuntimeIntervals } from '../../simulation/projection/projectEffectIntervals';

describe('effect interval projection', () => {
  it('groups apply, refresh, stack, remove, and expiry events into target intervals', () => {
    const projection = projectEffectRuntimeIntervals({
      effectTimeline: {
        events: [
          createEvent({
            eventId: 'focus-applied',
            type: 'EFFECT_APPLIED',
            timeMs: 0,
            instanceKey: 'actor|actor-001|focus',
            effectId: 'focus',
            effectName: '专注',
            targetKind: 'actor',
            targetId: 'actor-001',
            targetName: '末音',
            actionId: 'action-apply',
            stackAfter: 1,
            after: createState({ stacks: 1, maxStacks: 3, expiresAtMs: 1000 }),
          }),
          createEvent({
            eventId: 'focus-refreshed',
            type: 'EFFECT_REFRESHED',
            timeMs: 500,
            instanceKey: 'actor|actor-001|focus',
            effectId: 'focus',
            effectName: '专注',
            targetKind: 'actor',
            targetId: 'actor-001',
            targetName: '末音',
            actionId: 'action-refresh',
            stackBefore: 1,
            stackAfter: 2,
            before: createState({ stacks: 1, maxStacks: 3, expiresAtMs: 1000 }),
            after: createState({ stacks: 2, maxStacks: 3, expiresAtMs: 2000 }),
          }),
          createEvent({
            eventId: 'mark-applied',
            type: 'EFFECT_APPLIED',
            timeMs: 1200,
            instanceKey: 'enemy|enemy-001|mark',
            effectId: 'mark',
            effectName: '标记',
            targetKind: 'enemy',
            targetId: 'enemy-001',
            targetName: '训练假人',
            actionId: 'action-mark',
            stackAfter: 1,
            after: createState({ stacks: 1, maxStacks: 1, expiresAtMs: null }),
          }),
          createEvent({
            eventId: 'focus-expired',
            type: 'EFFECT_EXPIRED',
            timeMs: 2000,
            instanceKey: 'actor|actor-001|focus',
            effectId: 'focus',
            effectName: '专注',
            targetKind: 'actor',
            targetId: 'actor-001',
            targetName: '末音',
            actionId: 'action-refresh',
            stackBefore: 2,
            before: createState({ stacks: 2, maxStacks: 3, expiresAtMs: 2000 }),
          }),
          createEvent({
            eventId: 'mark-removed',
            type: 'EFFECT_REMOVED',
            timeMs: 2500,
            instanceKey: 'enemy|enemy-001|mark',
            effectId: 'mark',
            effectName: '标记',
            targetKind: 'enemy',
            targetId: 'enemy-001',
            targetName: '训练假人',
            actionId: 'action-remove',
            stackBefore: 1,
            before: createState({ stacks: 1, maxStacks: 1, expiresAtMs: null }),
          }),
        ],
      },
      durationMs: 4000,
      frameRate: 60,
    });

    expect(projection).toMatchObject({
      contractName: 'AzPrEffectIntervalProjection',
      status: 'effect-interval-projection-ready',
      summary: {
        eventCount: 5,
        intervalCount: 2,
        actorTargetIntervalCount: 1,
        enemyTargetIntervalCount: 1,
        completedIntervalCount: 2,
        activeAtScenarioEndCount: 0,
        appliedToCalculators: false,
      },
    });
    expect(projection.intervals[0]).toMatchObject({
      intervalId: 'actor|actor-001|focus|interval-1',
      effectName: '专注',
      targetKind: 'actor',
      targetId: 'actor-001',
      startMs: 0,
      endMs: 2000,
      startFrame: 0,
      endFrame: 120,
      sourceActionIds: ['action-apply', 'action-refresh'],
      lifecycleEventIds: ['focus-applied', 'focus-refreshed', 'focus-expired'],
      selectionEventId: 'focus-expired',
      terminationType: 'EFFECT_EXPIRED',
      peakStacks: 2,
      maxStacks: 3,
      refreshCount: 1,
      appliedToCalculators: false,
    });
    expect(projection.intervals[1]).toMatchObject({
      intervalId: 'enemy|enemy-001|mark|interval-1',
      targetKind: 'enemy',
      startMs: 1200,
      endMs: 2500,
      terminationType: 'EFFECT_REMOVED',
      sourceActionIds: ['action-mark', 'action-remove'],
    });
  });

  it('keeps stable window ids for repeated and scenario-end active effects', () => {
    const projection = projectEffectRuntimeIntervals({
      effectTimeline: {
        events: [
          createEvent({
            eventId: 'first-apply',
            type: 'EFFECT_APPLIED',
            timeMs: 0,
            instanceKey: 'actor|actor-001|focus',
            effectId: 'focus',
            targetKind: 'actor',
            targetId: 'actor-001',
            stackAfter: 1,
            after: createState({ stacks: 1, expiresAtMs: null }),
          }),
          createEvent({
            eventId: 'first-remove',
            type: 'EFFECT_REMOVED',
            timeMs: 500,
            instanceKey: 'actor|actor-001|focus',
            effectId: 'focus',
            targetKind: 'actor',
            targetId: 'actor-001',
            stackBefore: 1,
            before: createState({ stacks: 1, expiresAtMs: null }),
          }),
          createEvent({
            eventId: 'second-apply',
            type: 'EFFECT_APPLIED',
            timeMs: 700,
            instanceKey: 'actor|actor-001|focus',
            effectId: 'focus',
            targetKind: 'actor',
            targetId: 'actor-001',
            stackAfter: 1,
            after: createState({ stacks: 1, expiresAtMs: null }),
          }),
        ],
      },
      durationMs: 2000,
    });

    expect(projection.intervals.map(interval => interval.intervalId)).toEqual([
      'actor|actor-001|focus|interval-1',
      'actor|actor-001|focus|interval-2',
    ]);
    expect(projection.intervals[1]).toMatchObject({
      startMs: 700,
      endMs: 2000,
      activeAtScenarioEnd: true,
      persistent: true,
      selectionEventId: 'second-apply',
    });
    expect(projection.summary).toMatchObject({
      intervalCount: 2,
      activeAtScenarioEndCount: 1,
      persistentIntervalCount: 1,
    });
  });
});

function createEvent(overrides) {
  return {
    runtimeSequenceIndex: 0,
    effectName: overrides.effectId,
    targetName: overrides.targetId,
    actionId: null,
    actorId: 'actor-source',
    stackBefore: 0,
    stackAfter: 0,
    before: null,
    after: null,
    appliedToCalculators: false,
    ...overrides,
  };
}

function createState({ stacks, maxStacks = 1, expiresAtMs }) {
  return {
    active: true,
    stacks,
    maxStacks,
    expiresAtMs,
    tags: [],
    modifiers: [],
    appliedToCalculators: false,
  };
}
