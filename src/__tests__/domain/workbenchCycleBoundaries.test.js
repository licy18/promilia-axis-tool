import { describe, expect, it } from 'vitest';
import {
  addWorkbenchCycleBoundary,
  normalizeWorkbenchCycleBoundaries,
  updateWorkbenchCycleBoundary,
} from '../../domain/workbenchCycleBoundaries';

describe('workbench cycle boundaries', () => {
  it('normalizes boundaries to unique 60fps times and stable ids', () => {
    expect(
      normalizeWorkbenchCycleBoundaries(
        [
          { id: 'late', timeMs: 1500.4 },
          { id: 'early', time: 500.2 },
          { id: 'duplicate-time', timeMs: 500 },
          { id: 'late', timeMs: 2000 },
          { id: 'start', timeMs: 0 },
          { id: 'end', timeMs: 30000 },
        ],
        30000
      )
    ).toEqual([
      { id: 'early', timeMs: 500 },
      { id: 'late', timeMs: 1500 },
      { id: 'cycle-boundary-0001', timeMs: 2000 },
    ]);
  });

  it('adds, moves, deduplicates, and rejects out-of-range boundaries', () => {
    const first = addWorkbenchCycleBoundary([], 1000, 30000);
    const second = addWorkbenchCycleBoundary(first.boundaries, 2000, 30000);

    expect(first.createdBoundary).toEqual({
      id: 'cycle-boundary-0001',
      timeMs: 1000,
    });
    expect(second.createdBoundary).toEqual({
      id: 'cycle-boundary-0002',
      timeMs: 2000,
    });
    expect(
      updateWorkbenchCycleBoundary(
        second.boundaries,
        'cycle-boundary-0002',
        1516,
        30000
      )
    ).toEqual([
      { id: 'cycle-boundary-0001', timeMs: 1000 },
      { id: 'cycle-boundary-0002', timeMs: 1516.666667 },
    ]);
    expect(
      updateWorkbenchCycleBoundary(
        second.boundaries,
        'cycle-boundary-0002',
        1000,
        30000
      )
    ).toEqual(second.boundaries);
    expect(
      addWorkbenchCycleBoundary(second.boundaries, 0, 30000)
    ).toMatchObject({ createdBoundary: null });
  });
});
