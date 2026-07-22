import { WORKBENCH_FRAME_MS, snapMsToFrame } from './timebase';

export const DEFAULT_WORKBENCH_TIMELINE_DURATION_MS = 120_000;
export const WORKBENCH_TIMELINE_DURATION_OPTIONS_MS = Object.freeze([
  30_000, 60_000, 90_000, 120_000, 180_000,
]);
export const WORKBENCH_TIMELINE_BASE_PIXELS_PER_SECOND = 24;

const TIMELINE_TICK_INTERVAL_OPTIONS_SECONDS = Object.freeze([
  1, 2, 5, 10, 15, 30, 60,
]);

export function normalizeWorkbenchTimelineDuration(
  value,
  fallback = DEFAULT_WORKBENCH_TIMELINE_DURATION_MS
) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return Math.max(WORKBENCH_FRAME_MS, Number(fallback) || 0);
  }
  return Math.max(WORKBENCH_FRAME_MS, snapMsToFrame(number));
}

export function createWorkbenchTimelineDurationChange({
  currentDurationMs,
  requestedDurationMs,
  actions = [],
  cycleBoundaries = [],
  effectIntervals = [],
  runtimeEvents = [],
} = {}) {
  const current = normalizeWorkbenchTimelineDuration(currentDurationMs);
  const durationMs = normalizeWorkbenchTimelineDuration(requestedDurationMs);
  if (durationMs >= current) {
    return { allowed: true, durationMs, blockers: [], message: '' };
  }

  const blockers = [
    ...actions.flatMap(action => {
      const startMs = finiteNonNegative(action?.startMs);
      const endMs = startMs + finiteNonNegative(action?.durationMs);
      return endMs > durationMs
        ? [
            {
              kind: 'action',
              identity: action?.id ?? '',
              timeMs: endMs,
            },
          ]
        : [];
    }),
    ...cycleBoundaries.flatMap(boundary => {
      const timeMs = finiteNonNegative(boundary?.timeMs);
      return timeMs >= durationMs
        ? [
            {
              kind: 'cycle-boundary',
              identity: boundary?.id ?? '',
              timeMs,
            },
          ]
        : [];
    }),
    ...effectIntervals.flatMap(interval => {
      const timeMs = finiteNonNegative(interval?.endMs);
      return timeMs > durationMs
        ? [
            {
              kind: 'effect-interval',
              identity: interval?.intervalId ?? interval?.effectId ?? '',
              timeMs,
            },
          ]
        : [];
    }),
    ...runtimeEvents.flatMap(event => {
      const timeMs = finiteNonNegative(event?.timeMs);
      return timeMs > durationMs
        ? [
            {
              kind: 'runtime-event',
              identity: event?.eventId ?? event?.id ?? '',
              timeMs,
            },
          ]
        : [];
    }),
  ].sort((left, right) => left.timeMs - right.timeMs);
  const lastRequiredMs = Math.max(
    0,
    ...blockers.map(blocker => blocker.timeMs)
  );
  return {
    allowed: blockers.length === 0,
    durationMs,
    blockers,
    message: blockers.length
      ? `无法缩短到 ${formatSeconds(durationMs)}：现有内容延伸至 ${formatSeconds(lastRequiredMs)}`
      : '',
  };
}

export function createWorkbenchTimelineTicks({
  durationMs,
  pixelsPerSecond = WORKBENCH_TIMELINE_BASE_PIXELS_PER_SECOND,
  zoom = 1,
  minimumTickSpacingPx = 80,
} = {}) {
  const normalizedDurationMs = normalizeWorkbenchTimelineDuration(durationMs);
  const normalizedPixelsPerSecond = Math.max(1, Number(pixelsPerSecond) || 1);
  const normalizedZoom = Math.max(0.1, Number(zoom) || 1);
  const targetSeconds =
    Math.max(1, Number(minimumTickSpacingPx) || 1) /
    (normalizedPixelsPerSecond * normalizedZoom);
  const intervalSeconds =
    TIMELINE_TICK_INTERVAL_OPTIONS_SECONDS.find(
      candidate => candidate >= targetSeconds
    ) ?? TIMELINE_TICK_INTERVAL_OPTIONS_SECONDS.at(-1);
  const intervalMs = intervalSeconds * 1000;
  const ticks = [];
  for (let timeMs = 0; timeMs <= normalizedDurationMs; timeMs += intervalMs) {
    ticks.push(createTick(timeMs, normalizedDurationMs));
  }
  if (ticks.at(-1)?.timeMs !== normalizedDurationMs) {
    ticks.push(createTick(normalizedDurationMs, normalizedDurationMs));
  }
  return ticks;
}

function createTick(timeMs, durationMs) {
  return {
    timeMs,
    label: formatSeconds(timeMs),
    leftPercent: (timeMs / durationMs) * 100,
  };
}

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function formatSeconds(timeMs) {
  const seconds = Number(timeMs) / 1000;
  return `${Number(seconds.toFixed(3))}s`;
}
