import { describe, expect, it } from 'vitest';
import { createWorkbenchFlowRuntime } from '../../features/workbench/workbenchFlowRuntime';

describe('workbench flow runtime', () => {
  it('applies action edit flow plans through workbench callbacks', () => {
    const calls = [];
    const runtime = createWorkbenchFlowRuntime({
      actionExists: actionId => actionId === 'action-0001',
      selectAction: (actionId, options) =>
        calls.push(['selectAction', actionId, options]),
      setActionEditFocus: focus => calls.push(['setActionEditFocus', focus]),
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
      ['selectAction', 'action-0001', { syncRuntimeResult: false }],
      [
        'setActionEditFocus',
        {
          actionId: 'action-0001',
          fieldKey: 'startMs',
          sequence: 2,
        },
      ],
    ]);
  });

  it('does not apply disabled or missing required action edit plans', () => {
    const calls = [];
    const runtime = createWorkbenchFlowRuntime({
      actionExists: () => false,
      selectAction: (...args) => calls.push(['selectAction', ...args]),
      setActionEditFocus: (...args) =>
        calls.push(['setActionEditFocus', ...args]),
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

  it('applies runtime flow plans through workbench callbacks', () => {
    const calls = [];
    const runtime = createWorkbenchFlowRuntime({
      actionExists: actionId => actionId === 'action-0001',
      selectAction: (actionId, options) =>
        calls.push(['selectAction', actionId, options]),
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
      ['selectAction', 'action-0001', { syncRuntimeResult: false }],
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
