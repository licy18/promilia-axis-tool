import { describe, expect, it } from 'vitest';
import { resolveWorkbenchActionScheduling } from '../../domain/workbenchActionScheduling';
import { frameToMs } from '../../domain/timebase';

describe('workbench action scheduling', () => {
  it('keeps verified occupancy and gives unresolved actions a planning-only width', () => {
    expect(
      resolveWorkbenchActionScheduling({
        timingStatus: 'applied',
        durationFrames: 47,
      })
    ).toMatchObject({
      status: 'verified',
      kind: 'exact-selected-variant-occupancy',
      durationFrames: 47,
      durationMs: frameToMs(47),
      needsTimingData: false,
    });

    expect(
      resolveWorkbenchActionScheduling({
        timingStatus: 'unresolved',
        durationFrames: null,
      })
    ).toMatchObject({
      status: 'planning',
      kind: 'generic-planning-duration',
      durationFrames: null,
      durationMs: frameToMs(30),
      planningDurationFrames: 30,
      needsTimingData: true,
    });

    expect(
      resolveWorkbenchActionScheduling({
        actionScheduling: {
          status: 'planning',
          kind: 'source-animation-planning-duration',
          planningDurationFrames: 171,
          sourceStatus: 'verified-animation-duration',
          variantModelStatus: 'variant-condition-not-yet-modeled',
        },
      })
    ).toMatchObject({
      status: 'planning',
      kind: 'source-animation-planning-duration',
      durationMs: frameToMs(171),
      planningDurationFrames: 171,
      variantModelStatus: 'variant-condition-not-yet-modeled',
      needsTimingData: true,
    });
  });
});
