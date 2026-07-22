import {
  DEFAULT_WORKBENCH_TIMELINE_DURATION_MS,
  WORKBENCH_TIMELINE_DURATION_OPTIONS_MS,
  createWorkbenchTimelineDurationChange,
  createWorkbenchTimelineTicks,
  normalizeWorkbenchTimelineDuration,
} from '../../domain/workbenchTimelineDuration';

describe('workbench timeline duration', () => {
  it('defaults to 120 seconds and exposes the supported project durations', () => {
    expect(DEFAULT_WORKBENCH_TIMELINE_DURATION_MS).toBe(120_000);
    expect(WORKBENCH_TIMELINE_DURATION_OPTIONS_MS).toEqual([
      30_000, 60_000, 90_000, 120_000, 180_000,
    ]);
    expect(normalizeWorkbenchTimelineDuration()).toBe(120_000);
    expect(normalizeWorkbenchTimelineDuration(60_000)).toBe(60_000);
  });

  it('blocks shortening that would clip an action, cycle, effect, or runtime event', () => {
    const result = createWorkbenchTimelineDurationChange({
      currentDurationMs: 120_000,
      requestedDurationMs: 60_000,
      actions: [{ id: 'late-action', startMs: 59_500, durationMs: 1_000 }],
      cycleBoundaries: [{ id: 'late-cycle', timeMs: 61_000 }],
      effectIntervals: [{ intervalId: 'late-buff', endMs: 62_000 }],
      runtimeEvents: [{ eventId: 'late-event', timeMs: 63_000 }],
    });

    expect(result.allowed).toBe(false);
    expect(result.blockers.map(blocker => blocker.kind)).toEqual([
      'action',
      'cycle-boundary',
      'effect-interval',
      'runtime-event',
    ]);
    expect(result.message).toContain('63s');
  });

  it('extends without moving content and creates readable duration-aware ticks', () => {
    expect(
      createWorkbenchTimelineDurationChange({
        currentDurationMs: 30_000,
        requestedDurationMs: 120_000,
        actions: [{ id: 'action', startMs: 5_000, durationMs: 1_000 }],
      })
    ).toMatchObject({ allowed: true, durationMs: 120_000, blockers: [] });

    const ticks = createWorkbenchTimelineTicks({
      durationMs: 120_000,
      pixelsPerSecond: 24,
      zoom: 1,
    });
    expect(ticks[0]).toMatchObject({ timeMs: 0, label: '0s' });
    expect(ticks.at(-1)).toMatchObject({ timeMs: 120_000, label: '120s' });
    expect(ticks.some(tick => tick.timeMs === 60_000)).toBe(true);
    expect(ticks.length).toBeLessThan(40);
  });
});
