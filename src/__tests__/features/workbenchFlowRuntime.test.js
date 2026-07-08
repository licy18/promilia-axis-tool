import { describe, expect, it } from 'vitest';
import { createWorkbenchFlowRuntime } from '../../features/workbench/workbenchFlowRuntime';

describe('workbench flow runtime', () => {
  it('applies action edit flow plans through shared action edit state', () => {
    const calls = [];
    const runtime = createWorkbenchFlowRuntime({
      actionExists: actionId => actionId === 'action-0001',
      applyActionEditState: editState =>
        calls.push(['applyActionEditState', editState]),
    });

    expect(
      runtime.applyActionEditFlowPlan({
        kind: 'runtime-action-focus',
        canApply: true,
        actionId: 'action-0001',
        requiresExistingAction: true,
        actionEditFocus: {
          actionId: 'action-0001',
          fieldKey: 'startMs',
          sequence: 2,
        },
      })
    ).toMatchObject({
      applied: true,
      kind: 'runtime-action-focus',
    });

    expect(calls).toEqual([
      [
        'applyActionEditState',
        {
          actionId: 'action-0001',
          actionSelection: {
            requestedActionId: 'action-0001',
            actionId: 'action-0001',
            shouldSelectAction: true,
            syncRuntimeResult: false,
          },
          actionEditFocus: {
            actionId: 'action-0001',
            fieldKey: 'startMs',
            sequence: 2,
          },
        },
      ],
    ]);
  });

  it('does not apply disabled or missing required action edit plans', () => {
    const calls = [];
    const runtime = createWorkbenchFlowRuntime({
      actionExists: () => false,
      applyActionEditState: (...args) =>
        calls.push(['applyActionEditState', ...args]),
    });

    expect(
      runtime.applyActionEditFlowPlan({
        kind: 'edit-source-focus',
        canApply: false,
      })
    ).toMatchObject({
      applied: false,
      reason: 'disabled-action-edit-flow-plan',
    });
    expect(
      runtime.applyActionEditFlowPlan({
        kind: 'runtime-action-focus',
        canApply: true,
        actionId: 'missing-action',
        requiresExistingAction: true,
      })
    ).toMatchObject({
      applied: false,
      reason: 'missing-action-draft',
    });
    expect(calls).toEqual([]);
  });

  it('applies optional action edit focus without selecting a missing action', () => {
    const calls = [];
    const runtime = createWorkbenchFlowRuntime({
      actionExists: () => false,
      applyActionEditState: editState =>
        calls.push(['applyActionEditState', editState]),
    });

    expect(
      runtime.applyActionEditFlowPlan({
        kind: 'edit-source-focus',
        canApply: true,
        actionId: 'missing-action',
        requiresExistingAction: false,
        actionEditFocus: {
          actionId: 'missing-action',
          fieldKey: 'level',
        },
      })
    ).toMatchObject({
      applied: true,
      kind: 'edit-source-focus',
    });

    expect(calls).toEqual([
      [
        'applyActionEditState',
        {
          actionId: 'missing-action',
          actionSelection: {
            requestedActionId: 'missing-action',
            actionId: '',
            shouldSelectAction: false,
            syncRuntimeResult: false,
          },
          actionEditFocus: {
            actionId: 'missing-action',
            fieldKey: 'level',
          },
        },
      ],
    ]);
  });

  it('applies runtime flow plans through workbench callbacks', () => {
    const calls = [];
    const runtime = createWorkbenchFlowRuntime({
      actionExists: actionId => actionId === 'action-0001',
      applyActionSelectionState: selectionState =>
        calls.push(['applyActionSelectionState', selectionState]),
      setCalculatorScope: scope => calls.push(['setCalculatorScope', scope]),
      applyRuntimePointSelectionState: selectionState =>
        calls.push(['applyRuntimePointSelectionState', selectionState]),
      applyRuntimeViewState: viewState =>
        calls.push(['applyRuntimeViewState', viewState]),
    });

    expect(
      runtime.applyRuntimeFlowPlan({
        kind: 'runtime-result-return',
        selectActionId: 'action-0001',
        calculatorScope: 'runtime',
        pulseCalculatorFocus: false,
        selectRuntimeStatePoint: true,
        statePointId: 'point-001',
        stateCurveLayerFilters: {
          applied: true,
          candidate: false,
        },
        stateCurveTrackFilters: {},
        runtimeLogFocusSource: 'action-result',
      })
    ).toMatchObject({
      applied: true,
      kind: 'runtime-result-return',
    });

    expect(calls).toEqual([
      [
        'applyActionSelectionState',
        {
          requestedActionId: 'action-0001',
          actionId: 'action-0001',
          shouldSelectAction: true,
          syncRuntimeResult: false,
        },
      ],
      ['setCalculatorScope', 'runtime'],
      [
        'applyRuntimePointSelectionState',
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
      ],
      [
        'applyRuntimeViewState',
        {
          clearRuntimeSelection: false,
          stateCurveFocusMode: 'all',
          stateCurveLayerFilters: {
            applied: true,
            candidate: false,
          },
          stateCurveTrackFilters: {},
          runtimeLogFocus: {
            source: 'action-result',
            statePointId: 'point-001',
          },
        },
      ],
    ]);
  });

  it('applies direct runtime point selection through the shared selection state', () => {
    const calls = [];
    const runtime = createWorkbenchFlowRuntime({
      applyRuntimePointSelectionState: selectionState =>
        calls.push(['applyRuntimePointSelectionState', selectionState]),
    });

    expect(
      runtime.applyRuntimePointSelection({
        statePointId: 'point-direct',
      })
    ).toMatchObject({
      applied: true,
      kind: 'runtime-point-selection',
    });

    expect(calls).toEqual([
      [
        'applyRuntimePointSelectionState',
        {
          statePointId: 'point-direct',
          selectedStatePointId: 'point-direct',
          stateCurveFocusMode: 'selected',
          shouldSelectRuntimeAction: true,
          runtimeLogFocus: {
            source: '',
            statePointId: '',
          },
        },
      ],
    ]);
  });

  it('applies calculator scope selection through the shared scope state', () => {
    const calls = [];
    const runtime = createWorkbenchFlowRuntime({
      getFirstRuntimeStatePointId: () => 'point-first',
      applyCalculatorScopeState: scopeState =>
        calls.push(['applyCalculatorScopeState', scopeState]),
    });

    expect(
      runtime.applyCalculatorScope({
        scope: 'runtime',
      })
    ).toMatchObject({
      applied: true,
      kind: 'calculator-scope-selection',
    });

    expect(calls).toEqual([
      [
        'applyCalculatorScopeState',
        {
          calculatorScope: 'runtime',
          statePointId: 'point-first',
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
        },
      ],
    ]);
  });

  it('applies runtime overview clearing and pulsed calculator focus', () => {
    const calls = [];
    const runtime = createWorkbenchFlowRuntime({
      getFirstRuntimeStatePointId: () => 'point-unused',
      applyCalculatorScopeState: scopeState =>
        calls.push(['applyCalculatorScopeState', scopeState]),
      applyRuntimeViewState: viewState =>
        calls.push(['applyRuntimeViewState', viewState]),
    });

    runtime.applyRuntimeFlowPlan({
      kind: 'runtime-entry',
      calculatorScope: 'runtime',
      pulseCalculatorFocus: true,
      selectFirstRuntimePoint: false,
      selectRuntimeStatePoint: false,
      clearRuntimeSelection: true,
      stateCurveFocusMode: 'all',
    });

    expect(calls).toEqual([
      [
        'applyCalculatorScopeState',
        {
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
          runtimeLogFocus: {
            source: '',
            statePointId: '',
          },
        },
      ],
      [
        'applyRuntimeViewState',
        {
          clearRuntimeSelection: true,
          stateCurveFocusMode: 'all',
          stateCurveLayerFilters: null,
          stateCurveTrackFilters: null,
          runtimeLogFocus: {
            source: '',
            statePointId: '',
          },
        },
      ],
    ]);
  });
});
