import { describe, expect, it } from 'vitest';
import {
  applyWorkbenchRuntimeViewPatch,
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

  it('applies runtime view patches through shared handlers', () => {
    const calls = [];
    const layerFilters = {
      applied: true,
      candidate: false,
    };
    const trackFilters = {
      enemyHpDamage: true,
    };
    const runtimeLogFocus = {
      source: 'action-result',
      statePointId: 'point-001',
      sequence: 5,
    };

    const result = applyWorkbenchRuntimeViewPatch(
      {
        changes: {
          selectedStatePointId: 'point-001',
          stateCurveFocusMode: 'selected',
          stateCurveLayerFilters: layerFilters,
          stateCurveTrackFilters: trackFilters,
          calculatorScope: 'runtime',
          runtimeLogFocus,
        },
        pulseCalculatorFocus: true,
        selectRuntimeActionStatePointId: 'point-001',
        selectRuntimeStatePointId: 'point-002',
      },
      {
        setSelectedStatePointId: value =>
          calls.push(['setSelectedStatePointId', value]),
        setStateCurveFocusMode: value =>
          calls.push(['setStateCurveFocusMode', value]),
        setStateCurveLayerFilters: value =>
          calls.push(['setStateCurveLayerFilters', value]),
        setStateCurveTrackFilters: value =>
          calls.push(['setStateCurveTrackFilters', value]),
        setCalculatorScope: value =>
          calls.push(['setCalculatorScope', value]),
        pulseCalculatorFocus: () => calls.push(['pulseCalculatorFocus']),
        setRuntimeLogFocus: value => calls.push(['setRuntimeLogFocus', value]),
        selectRuntimeActionStatePoint: value =>
          calls.push(['selectRuntimeActionStatePoint', value]),
        selectRuntimeStatePoint: value =>
          calls.push(['selectRuntimeStatePoint', value]),
      }
    );

    expect(calls).toEqual([
      ['setSelectedStatePointId', 'point-001'],
      ['setStateCurveFocusMode', 'selected'],
      [
        'setStateCurveLayerFilters',
        {
          applied: true,
          candidate: false,
        },
      ],
      [
        'setStateCurveTrackFilters',
        {
          enemyHpDamage: true,
        },
      ],
      ['setCalculatorScope', 'runtime'],
      ['pulseCalculatorFocus'],
      [
        'setRuntimeLogFocus',
        {
          source: 'action-result',
          statePointId: 'point-001',
          sequence: 5,
        },
      ],
      ['selectRuntimeActionStatePoint', 'point-001'],
      ['selectRuntimeStatePoint', 'point-002'],
    ]);
    expect(calls[2][1]).not.toBe(layerFilters);
    expect(calls[3][1]).not.toBe(trackFilters);
    expect(calls[6][1]).not.toBe(runtimeLogFocus);
    expect(result).toEqual({
      appliedChanges: {
        selectedStatePointId: 'point-001',
        stateCurveFocusMode: 'selected',
        stateCurveLayerFilters: {
          applied: true,
          candidate: false,
        },
        stateCurveTrackFilters: {
          enemyHpDamage: true,
        },
        calculatorScope: 'runtime',
        runtimeLogFocus: {
          source: 'action-result',
          statePointId: 'point-001',
          sequence: 5,
        },
      },
      pulseCalculatorFocus: true,
      selectRuntimeActionStatePointId: 'point-001',
      selectRuntimeStatePointId: 'point-002',
    });
  });
});
