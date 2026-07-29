import { describe, expect, it } from 'vitest';
import {
  createCriticalSampleKey,
  createDeterministicCriticalRandomSource,
} from '../../simulation/runtime/criticalRandomSource';

describe('deterministic critical random source', () => {
  const context = {
    actionId: 'action-1',
    hitIdentity: 'control:1|hit:1',
    hitIndex: 1,
    elementId: 101,
    timeMs: 500,
  };

  it('replays the same sequential stream for the same explicit seed', () => {
    const first = createDeterministicCriticalRandomSource({ seed: 'alpha' });
    const second = createDeterministicCriticalRandomSource({ seed: 'alpha' });
    const firstSequence = [
      first.nextSample(10_000, context),
      first.nextSample(10_000, { ...context, hitIndex: 2 }),
      first.nextSample(10_000, { ...context, timeMs: 501 }),
    ];
    const secondSequence = [
      second.nextSample(10_000, context),
      second.nextSample(10_000, { ...context, hitIndex: 2 }),
      second.nextSample(10_000, { ...context, timeMs: 501 }),
    ];

    expect(firstSequence).toEqual(secondSequence);
    expect(firstSequence.map(sample => sample.streamIndex)).toEqual([0, 1, 2]);
    expect(new Set(firstSequence.map(sample => sample.value)).size).toBe(3);
  });

  it('records stable hit coordinates without using them as mutable state', () => {
    expect(createCriticalSampleKey(context)).toBe(
      'action-1|control:1|hit:1|1|101|500'
    );
    const source = createDeterministicCriticalRandomSource({ seed: 'alpha' });
    expect(source.nextSample(10_000, context)).toMatchObject({
      streamIndex: 0,
      sampleKey: 'action-1|control:1|hit:1|1|101|500',
      value: expect.any(Number),
    });
  });
});
