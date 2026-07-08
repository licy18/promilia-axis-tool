import { describe, expect, it } from 'vitest';
import {
  isRuntimeResultFocusSource,
  normalizeRuntimeLogFocusScope,
} from '../../features/workbench/runtimeFocusSource';

describe('runtime focus source', () => {
  it('groups runtime result entry sources under the action-result scope', () => {
    for (const source of [
      'action-result',
      'analysis-action-result',
      'analysis-edit-result',
      'properties-panel',
      'event-log-runtime-detail',
      'runtime-detail',
      'workbench-flow-panel',
    ]) {
      expect(isRuntimeResultFocusSource(source)).toBe(true);
      expect(normalizeRuntimeLogFocusScope(source)).toBe('action-result');
    }
  });

  it('keeps contribution and manual sources distinct', () => {
    expect(isRuntimeResultFocusSource('action-contribution')).toBe(false);
    expect(normalizeRuntimeLogFocusScope('action-contribution')).toBe(
      'action-contribution'
    );
    expect(normalizeRuntimeLogFocusScope('resource-runtime-curve')).toBe(
      'resource-runtime-curve'
    );
  });
});
