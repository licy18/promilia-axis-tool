import { describe, expect, it } from 'vitest';
import { createRuntimeEffectReview } from '../../features/workbench/runtimeEffectReview';

describe('runtime effect review', () => {
  it('replays active effects at a runtime time point or selected effect event', () => {
    const applied = createEffectEvent({
      eventId: 'effect-applied',
      type: 'EFFECT_APPLIED',
      timeMs: 1000,
      runtimeSequenceIndex: 0,
      after: createEffectState({ stacks: 1, updatedAtMs: 1000 }),
    });
    const refreshed = createEffectEvent({
      eventId: 'effect-refreshed',
      type: 'EFFECT_REFRESHED',
      timeMs: 2000,
      runtimeSequenceIndex: 1,
      after: createEffectState({ stacks: 2, updatedAtMs: 2000 }),
    });
    const expired = createEffectEvent({
      eventId: 'effect-expired',
      type: 'EFFECT_EXPIRED',
      timeMs: 5000,
      runtimeSequenceIndex: 2,
      after: null,
    });
    const effectTimeline = { events: [expired, refreshed, applied] };

    expect(
      createRuntimeEffectReview({ effectTimeline, selectedTimeMs: 1500 })
    ).toMatchObject({
      reviewTimeMs: 1500,
      selectedEventId: 'effect-applied',
      activeEffects: [{ effectId: 'tracked-effect', stacks: 1 }],
      summary: {
        activeEffectCount: 1,
        followsRuntimeStatePoint: true,
        appliedToCalculators: false,
      },
    });

    expect(
      createRuntimeEffectReview({
        effectTimeline,
        selectedEventId: 'effect-refreshed',
      })
    ).toMatchObject({
      reviewTimeMs: 2000,
      selectedEventId: 'effect-refreshed',
      activeEffects: [{ effectId: 'tracked-effect', stacks: 2 }],
      summary: {
        activeEffectCount: 1,
        followsRuntimeStatePoint: false,
      },
    });

    expect(
      createRuntimeEffectReview({ effectTimeline, selectedTimeMs: 6000 })
        .activeEffects
    ).toEqual([]);
  });
});

function createEffectEvent({
  eventId,
  type,
  timeMs,
  runtimeSequenceIndex,
  after,
}) {
  return {
    eventId,
    type,
    timeMs,
    runtimeSequenceIndex,
    instanceKey: 'actor|actor-109001|tracked-effect',
    actionId: 'action-0001',
    effectId: 'tracked-effect',
    effectName: '测试增益',
    targetId: 'actor-109001',
    targetName: '末音',
    after,
  };
}

function createEffectState({ stacks, updatedAtMs }) {
  return {
    active: true,
    instanceKey: 'actor|actor-109001|tracked-effect',
    effectId: 'tracked-effect',
    effectName: '测试增益',
    targetId: 'actor-109001',
    targetName: '末音',
    updatedAtMs,
    expiresAtMs: 5000,
    stacks,
    maxStacks: 3,
    tags: [],
    modifiers: [],
    appliedToCalculators: false,
  };
}
