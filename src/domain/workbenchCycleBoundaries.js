import { createCycleBoundary } from './projectSchema';
import { WORKBENCH_FRAME_MS, snapMsToFrame } from './timebase';
import { DEFAULT_WORKBENCH_TIMELINE_DURATION_MS } from './workbenchTimelineDuration';

export const DEFAULT_WORKBENCH_DURATION_MS =
  DEFAULT_WORKBENCH_TIMELINE_DURATION_MS;

export function normalizeWorkbenchCycleBoundaries(
  cycleBoundaries = [],
  durationMs = DEFAULT_WORKBENCH_DURATION_MS
) {
  const normalizedDurationMs = Math.max(
    WORKBENCH_FRAME_MS,
    Number(durationMs) || DEFAULT_WORKBENCH_DURATION_MS
  );
  const usedIds = new Set();
  const usedTimes = new Set();
  const normalized = [];

  for (const source of Array.isArray(cycleBoundaries) ? cycleBoundaries : []) {
    const timeMs = snapMsToFrame(source?.timeMs ?? source?.time);
    if (
      timeMs <= 0 ||
      timeMs >= normalizedDurationMs ||
      usedTimes.has(timeMs)
    ) {
      continue;
    }
    const requestedId = String(source?.id ?? '').trim();
    const id =
      requestedId && !usedIds.has(requestedId)
        ? requestedId
        : createNextWorkbenchCycleBoundaryId(usedIds);
    usedIds.add(id);
    usedTimes.add(timeMs);
    normalized.push(createCycleBoundary({ id, timeMs }));
  }

  return normalized.sort(
    (left, right) =>
      left.timeMs - right.timeMs || left.id.localeCompare(right.id)
  );
}

export function addWorkbenchCycleBoundary(
  cycleBoundaries,
  timeMs,
  durationMs = DEFAULT_WORKBENCH_DURATION_MS
) {
  const current = normalizeWorkbenchCycleBoundaries(
    cycleBoundaries,
    durationMs
  );
  const normalizedTimeMs = snapMsToFrame(timeMs);
  if (
    normalizedTimeMs <= 0 ||
    normalizedTimeMs >= durationMs ||
    current.some(boundary => boundary.timeMs === normalizedTimeMs)
  ) {
    return { boundaries: current, createdBoundary: null };
  }
  const id = createNextWorkbenchCycleBoundaryId(
    new Set(current.map(boundary => boundary.id))
  );
  const boundaries = normalizeWorkbenchCycleBoundaries(
    [...current, { id, timeMs: normalizedTimeMs }],
    durationMs
  );
  return {
    boundaries,
    createdBoundary: boundaries.find(boundary => boundary.id === id) ?? null,
  };
}

export function updateWorkbenchCycleBoundary(
  cycleBoundaries,
  boundaryId,
  timeMs,
  durationMs = DEFAULT_WORKBENCH_DURATION_MS
) {
  const current = normalizeWorkbenchCycleBoundaries(
    cycleBoundaries,
    durationMs
  );
  const target = current.find(boundary => boundary.id === boundaryId);
  if (!target) {
    return current;
  }
  const normalizedTimeMs = snapMsToFrame(timeMs);
  if (
    normalizedTimeMs <= 0 ||
    normalizedTimeMs >= durationMs ||
    current.some(
      boundary =>
        boundary.id !== boundaryId && boundary.timeMs === normalizedTimeMs
    )
  ) {
    return current;
  }
  return normalizeWorkbenchCycleBoundaries(
    current.map(boundary =>
      boundary.id === boundaryId
        ? { ...boundary, timeMs: normalizedTimeMs }
        : boundary
    ),
    durationMs
  );
}

export function createNextWorkbenchCycleBoundaryId(usedBoundaryIds) {
  const usedIds = usedBoundaryIds ?? new Set();
  const maxIndex = [...usedIds].reduce((maximum, boundaryId) => {
    const match = String(boundaryId).match(/^cycle-boundary-(\d+)$/);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  let nextIndex = maxIndex + 1;
  let boundaryId = `cycle-boundary-${String(nextIndex).padStart(4, '0')}`;
  while (usedIds.has(boundaryId)) {
    nextIndex += 1;
    boundaryId = `cycle-boundary-${String(nextIndex).padStart(4, '0')}`;
  }
  usedIds.add(boundaryId);
  return boundaryId;
}
