const OPERATION_KEYS = Object.freeze([
  'authoritativeCompile',
  'authoritativeSimulation',
  'placementPreviewEvaluation',
  'placementCandidateEvaluation',
]);

const counters = Object.fromEntries(OPERATION_KEYS.map(key => [key, 0]));
const durations = Object.fromEntries(
  OPERATION_KEYS.map(key => [
    key,
    {
      count: 0,
      totalMs: 0,
      maximumMs: 0,
      latestMs: 0,
    },
  ])
);

export function recordWorkbenchPerformanceOperation(operation, amount = 1) {
  if (!Object.hasOwn(counters, operation)) return;
  counters[operation] += Math.max(0, Number(amount) || 0);
}

export function resetWorkbenchPerformanceCounters() {
  for (const key of OPERATION_KEYS) {
    counters[key] = 0;
    durations[key] = {
      count: 0,
      totalMs: 0,
      maximumMs: 0,
      latestMs: 0,
    };
  }
}

export function getWorkbenchPerformanceCounters() {
  return {
    ...counters,
    durations: Object.fromEntries(
      OPERATION_KEYS.map(key => [key, { ...durations[key] }])
    ),
  };
}

export function recordWorkbenchPerformanceDuration(operation, durationMs) {
  if (!Object.hasOwn(durations, operation)) return;
  const value = Math.max(0, Number(durationMs) || 0);
  const current = durations[operation];
  current.count += 1;
  current.totalMs += value;
  current.maximumMs = Math.max(current.maximumMs, value);
  current.latestMs = value;
}

export function installWorkbenchPerformanceInstrumentation(
  target = globalThis
) {
  if (!target || !shouldExposeWorkbenchPerformanceInstrumentation(target)) {
    return null;
  }
  const api = Object.freeze({
    reset: resetWorkbenchPerformanceCounters,
    snapshot: getWorkbenchPerformanceCounters,
  });
  target.__PROMILIA_WORKBENCH_PERF__ = api;
  return api;
}

function shouldExposeWorkbenchPerformanceInstrumentation(target) {
  if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
    return true;
  }
  const location = target.location;
  return Boolean(
    location &&
    `${location.search ?? ''}${location.hash ?? ''}`.includes(
      'workbench-perf=1'
    )
  );
}
