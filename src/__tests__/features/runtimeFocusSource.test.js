import { describe, expect, it } from 'vitest';
import {
  createRuntimeFocusSourceView,
  isRuntimeLogFocusSource,
  isRuntimeResultFocusSource,
  normalizeRuntimeLogFocusScope,
  resolveRuntimeFocusSourceKind,
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
    expect(isRuntimeLogFocusSource('action-contribution')).toBe(true);
    expect(normalizeRuntimeLogFocusScope('action-contribution')).toBe(
      'action-contribution'
    );
    expect(resolveRuntimeFocusSourceKind('action-contribution')).toBe(
      'action-contribution'
    );
    expect(normalizeRuntimeLogFocusScope('resource-runtime-curve')).toBe(
      'resource-runtime-curve'
    );
    expect(resolveRuntimeFocusSourceKind('resource-runtime-curve')).toBe(
      'curve'
    );
  });

  it('creates one runtime focus source view for panels', () => {
    expect(createRuntimeFocusSourceView('analysis-action-result')).toEqual({
      source: 'analysis-action-result',
      sourceKind: 'action-result',
      runtimeLogScope: 'action-result',
      runtimeLogLabel: '结果定位',
      curveSelectionLabel: '动作结果定位',
      isRuntimeResultFocus: true,
      isContributionFocus: false,
      isRuntimeLogFocusSource: true,
    });

    expect(createRuntimeFocusSourceView('action-contribution')).toEqual({
      source: 'action-contribution',
      sourceKind: 'action-contribution',
      runtimeLogScope: 'action-contribution',
      runtimeLogLabel: '贡献定位',
      curveSelectionLabel: '贡献拆分定位',
      isRuntimeResultFocus: false,
      isContributionFocus: true,
      isRuntimeLogFocusSource: true,
    });

    expect(createRuntimeFocusSourceView('state-curve-point')).toMatchObject({
      sourceKind: 'state-curve',
      runtimeLogScope: 'state-curve-point',
      runtimeLogLabel: '日志筛选',
      curveSelectionLabel: '手动选择',
      isRuntimeLogFocusSource: false,
    });
  });
});
