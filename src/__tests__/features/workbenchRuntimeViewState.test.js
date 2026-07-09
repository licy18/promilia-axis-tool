import { describe, expect, it } from 'vitest';
import {
  createWorkbenchCalculatorScopeApplyState,
  createWorkbenchCalculatorScopeViewPatch,
  createWorkbenchRuntimeLogFocusState,
  createWorkbenchRuntimeFlowViewPatch,
  createWorkbenchRuntimePointSelectionApplyState,
  createWorkbenchRuntimePointSelectionViewPatch,
  createWorkbenchRuntimeViewApplyState,
} from '../../features/workbench/workbenchRuntimeViewState';

describe('workbench runtime view state', () => {
  it('normalizes runtime point selection without pulsing log focus', () => {
    expect(
      createWorkbenchRuntimePointSelectionApplyState(
        {
          statePointId: 'point-001',
          selectedStatePointId: 'point-001',
          stateCurveFocusMode: 'selected',
          shouldSelectRuntimeAction: true,
          runtimeLogFocus: {
            source: '',
            statePointId: '',
          },
        },
        {
          currentRuntimeLogFocus: {
            sequence: 4,
          },
        }
      )
    ).toEqual({
      statePointId: 'point-001',
      selectedStatePointId: 'point-001',
      stateCurveFocusMode: 'selected',
      shouldSelectRuntimeAction: true,
      runtimeLogFocus: {
        source: '',
        statePointId: '',
        sequence: 4,
      },
    });
  });

  it('normalizes runtime view focus and increments log focus sequence', () => {
    expect(
      createWorkbenchRuntimeViewApplyState(
        {
          clearRuntimeSelection: false,
          stateCurveLayerFilters: {
            applied: true,
            candidate: false,
          },
          stateCurveTrackFilters: {},
          runtimeLogFocus: {
            source: 'action-result',
            statePointId: 'point-002',
          },
        },
        {
          currentRuntimeLogFocus: {
            sequence: 4,
          },
        }
      )
    ).toEqual({
      clearRuntimeSelection: false,
      selectedStatePointId: '',
      stateCurveFocusMode: 'all',
      stateCurveLayerFilters: {
        applied: true,
        candidate: false,
      },
      stateCurveTrackFilters: {},
      shouldFocusRuntimeLog: true,
      runtimeLogFocus: {
        source: 'action-result',
        statePointId: 'point-002',
        sequence: 5,
      },
    });
  });

  it('normalizes calculator scope state without pulsing log focus', () => {
    expect(
      createWorkbenchCalculatorScopeApplyState(
        {
          calculatorScope: 'runtime',
          statePointId: 'point-003',
          selectRuntimeStatePoint: true,
          clearRuntimeSelection: false,
          stateCurveFocusMode: 'selected',
          stateCurveLayerFilters: {
            applied: true,
            candidate: false,
          },
          stateCurveTrackFilters: {},
          runtimeLogFocus: {
            source: '',
            statePointId: '',
          },
        },
        {
          currentRuntimeLogFocus: {
            sequence: 6,
          },
        }
      )
    ).toEqual({
      calculatorScope: 'runtime',
      statePointId: 'point-003',
      selectRuntimeStatePoint: true,
      clearRuntimeSelection: false,
      stateCurveFocusMode: 'selected',
      stateCurveLayerFilters: {
        applied: true,
        candidate: false,
      },
      stateCurveTrackFilters: {},
      runtimeLogFocus: {
        source: '',
        statePointId: '',
        sequence: 6,
      },
    });
  });

  it('creates standalone runtime log focus state', () => {
    expect(
      createWorkbenchRuntimeLogFocusState({
        runtimeLogFocus: {
          source: 'runtime-review-primary',
          statePointId: 'point-004',
        },
        currentRuntimeLogFocus: {
          sequence: 2,
        },
        incrementSequence: true,
      })
    ).toEqual({
      source: 'runtime-review-primary',
      statePointId: 'point-004',
      sequence: 3,
    });
  });

  it('creates a runtime point selection view patch', () => {
    expect(
      createWorkbenchRuntimePointSelectionViewPatch(
        {
          statePointId: 'point-001',
          selectedStatePointId: 'point-001',
          stateCurveFocusMode: 'selected',
          shouldSelectRuntimeAction: true,
          runtimeLogFocus: {
            source: '',
            statePointId: '',
          },
        },
        {
          currentRuntimeLogFocus: {
            sequence: 4,
          },
        }
      )
    ).toEqual({
      changes: {
        selectedStatePointId: 'point-001',
        stateCurveFocusMode: 'selected',
        runtimeLogFocus: {
          source: '',
          statePointId: '',
          sequence: 4,
        },
      },
      pulseCalculatorFocus: false,
      selectRuntimeActionStatePointId: 'point-001',
      selectRuntimeStatePointId: '',
    });
  });

  it('creates a runtime flow view patch only for requested changes', () => {
    expect(
      createWorkbenchRuntimeFlowViewPatch(
        {
          clearRuntimeSelection: false,
          stateCurveLayerFilters: {
            applied: true,
            candidate: false,
          },
          runtimeLogFocus: {
            source: 'action-result',
            statePointId: 'point-002',
          },
        },
        {
          currentRuntimeLogFocus: {
            sequence: 4,
          },
        }
      )
    ).toEqual({
      changes: {
        stateCurveLayerFilters: {
          applied: true,
          candidate: false,
        },
        runtimeLogFocus: {
          source: 'action-result',
          statePointId: 'point-002',
          sequence: 5,
        },
      },
      pulseCalculatorFocus: false,
      selectRuntimeActionStatePointId: '',
      selectRuntimeStatePointId: '',
    });
  });

  it('creates a calculator scope view patch with runtime selection operation', () => {
    expect(
      createWorkbenchCalculatorScopeViewPatch(
        {
          calculatorScope: 'runtime',
          statePointId: 'point-003',
          selectRuntimeStatePoint: true,
          clearRuntimeSelection: false,
          stateCurveFocusMode: 'selected',
          stateCurveLayerFilters: {
            applied: true,
            candidate: false,
          },
          stateCurveTrackFilters: {},
          runtimeLogFocus: {
            source: '',
            statePointId: '',
          },
        },
        {
          currentRuntimeLogFocus: {
            sequence: 6,
          },
        }
      )
    ).toEqual({
      changes: {
        calculatorScope: 'runtime',
        stateCurveLayerFilters: {
          applied: true,
          candidate: false,
        },
        stateCurveTrackFilters: {},
        runtimeLogFocus: {
          source: '',
          statePointId: '',
          sequence: 6,
        },
      },
      pulseCalculatorFocus: true,
      selectRuntimeActionStatePointId: '',
      selectRuntimeStatePointId: 'point-003',
    });
  });

  it('keeps calculator runtime selection ahead of clear selection', () => {
    expect(
      createWorkbenchCalculatorScopeViewPatch({
        calculatorScope: 'runtime',
        statePointId: 'point-003',
        selectRuntimeStatePoint: true,
        clearRuntimeSelection: true,
        stateCurveFocusMode: 'all',
      })
    ).toEqual({
      changes: {
        calculatorScope: 'runtime',
        stateCurveLayerFilters: {},
        stateCurveTrackFilters: {},
        runtimeLogFocus: {
          source: '',
          statePointId: '',
          sequence: 0,
        },
      },
      pulseCalculatorFocus: true,
      selectRuntimeActionStatePointId: '',
      selectRuntimeStatePointId: 'point-003',
    });
  });
});
