import { describe, expect, it } from 'vitest';
import {
  WORKBENCH_FLOW_RUNTIME_SCOPES,
  createWorkbenchFlowRuntimeScopeState,
} from '../../features/workbench/workbenchFlowRuntimeScope';

describe('workbench flow runtime scope', () => {
  it('describes runtime scope with a selected first runtime point', () => {
    expect(
      createWorkbenchFlowRuntimeScopeState({
        scope: WORKBENCH_FLOW_RUNTIME_SCOPES.RUNTIME,
        firstRuntimeStatePointId: 'runtime-point-001',
      })
    ).toEqual({
      calculatorScope: 'runtime',
      statePointId: 'runtime-point-001',
      selectRuntimeStatePoint: true,
      clearRuntimeSelection: false,
      stateCurveFocusMode: 'selected',
      stateCurveLayerFilters: {
        applied: true,
        candidate: false,
        sampled: false,
        placeholder: false,
      },
      stateCurveTrackFilters: {},
      runtimeLogFocus: {
        source: '',
        statePointId: '',
      },
    });
  });

  it('describes runtime scope overview when no runtime point is selected', () => {
    expect(
      createWorkbenchFlowRuntimeScopeState({
        scope: WORKBENCH_FLOW_RUNTIME_SCOPES.RUNTIME,
      })
    ).toMatchObject({
      calculatorScope: 'runtime',
      statePointId: '',
      selectRuntimeStatePoint: false,
      clearRuntimeSelection: true,
      stateCurveFocusMode: 'all',
      stateCurveLayerFilters: {
        applied: true,
        candidate: false,
        sampled: false,
        placeholder: false,
      },
      stateCurveTrackFilters: {},
    });
  });

  it('describes generation scope and clears runtime selection', () => {
    expect(
      createWorkbenchFlowRuntimeScopeState({
        scope: WORKBENCH_FLOW_RUNTIME_SCOPES.GENERATION,
        firstRuntimeStatePointId: 'runtime-point-ignored',
      })
    ).toMatchObject({
      calculatorScope: 'generation',
      statePointId: '',
      selectRuntimeStatePoint: false,
      clearRuntimeSelection: true,
      stateCurveFocusMode: 'all',
      stateCurveLayerFilters: {
        applied: false,
        candidate: true,
        sampled: true,
        placeholder: true,
      },
      stateCurveTrackFilters: {},
    });
  });
});
