import { describe, expect, it } from 'vitest';
import { createWorkbenchFlowRuntimePointSelectionState } from '../../features/workbench/workbenchFlowRuntimePointSelection';

describe('workbench flow runtime point selection', () => {
  it('describes selected runtime point state', () => {
    expect(
      createWorkbenchFlowRuntimePointSelectionState({
        statePointId: 'runtime-point-001',
      })
    ).toEqual({
      statePointId: 'runtime-point-001',
      selectedStatePointId: 'runtime-point-001',
      stateCurveFocusMode: 'selected',
      shouldSelectRuntimeAction: true,
      runtimeLogFocus: {
        source: '',
        statePointId: '',
      },
    });
  });

  it('describes cleared runtime point state', () => {
    expect(createWorkbenchFlowRuntimePointSelectionState()).toEqual({
      statePointId: '',
      selectedStatePointId: '',
      stateCurveFocusMode: 'all',
      shouldSelectRuntimeAction: false,
      runtimeLogFocus: {
        source: '',
        statePointId: '',
      },
    });
  });
});
