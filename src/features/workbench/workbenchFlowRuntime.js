import { createWorkbenchFlowRuntimePointSelectionState } from './workbenchFlowRuntimePointSelection';
import { createWorkbenchFlowRuntimeScopeState } from './workbenchFlowRuntimeScope';

export function createWorkbenchFlowRuntime({
  actionExists = () => false,
  selectAction = () => {},
  setActionEditFocus = () => {},
  applyActionSelectionState = null,
  applyActionEditState = null,
  setCalculatorScope = () => {},
  getFirstRuntimeStatePointId = () => '',
  applyCalculatorScopeState = null,
  applyRuntimePointSelectionState = null,
  applyRuntimeViewState = null,
  selectRuntimeStatePoint = () => {},
  clearRuntimeSelection = () => {},
  setStateCurveLayerFilters = () => {},
  setStateCurveTrackFilters = () => {},
  focusRuntimeLog = () => {},
} = {}) {
  function createActionSelectionState(actionId = '') {
    const requestedActionId = actionId ?? '';
    const shouldSelectAction = Boolean(
      requestedActionId && actionExists(requestedActionId)
    );
    return {
      requestedActionId,
      actionId: shouldSelectAction ? requestedActionId : '',
      shouldSelectAction,
      syncRuntimeResult: false,
    };
  }

  function applyActionSelectionStateForAction(actionId = '') {
    const selectionState = createActionSelectionState(actionId);
    if (!selectionState.shouldSelectAction) {
      return selectionState;
    }
    if (typeof applyActionSelectionState === 'function') {
      applyActionSelectionState(selectionState);
    } else {
      selectAction(selectionState.actionId, {
        syncRuntimeResult: selectionState.syncRuntimeResult,
      });
    }
    return selectionState;
  }

  function createActionEditState(flowPlan = {}) {
    const actionSelection = createActionSelectionState(flowPlan.actionId);
    return {
      actionId: flowPlan.actionId ?? '',
      actionSelection,
      actionEditFocus: { ...(flowPlan.actionEditFocus ?? {}) },
    };
  }

  function applyActionEditStateForPlan(flowPlan = {}) {
    const editState = createActionEditState(flowPlan);
    if (typeof applyActionEditState === 'function') {
      applyActionEditState(editState);
    } else {
      if (editState.actionSelection.shouldSelectAction) {
        selectAction(editState.actionSelection.actionId, {
          syncRuntimeResult: editState.actionSelection.syncRuntimeResult,
        });
      }
      setActionEditFocus({ ...editState.actionEditFocus });
    }
    return editState;
  }

  function applyRuntimePointSelectionStateForPoint(statePointId = '') {
    const selectionState = createWorkbenchFlowRuntimePointSelectionState({
      statePointId,
    });
    if (typeof applyRuntimePointSelectionState === 'function') {
      applyRuntimePointSelectionState(selectionState);
    } else {
      selectRuntimeStatePoint(selectionState.statePointId);
    }
    return selectionState;
  }

  function applyCalculatorScopeStateForScope(
    scope = '',
    { selectFirstRuntimePoint = true } = {}
  ) {
    const firstRuntimeStatePointId = selectFirstRuntimePoint
      ? getFirstRuntimeStatePointId()
      : '';
    const scopeState = createWorkbenchFlowRuntimeScopeState({
      scope,
      firstRuntimeStatePointId,
    });
    if (typeof applyCalculatorScopeState === 'function') {
      applyCalculatorScopeState(scopeState);
    } else {
      setCalculatorScope(scopeState.calculatorScope);
    }
    return scopeState;
  }

  function applyRuntimeViewStateForPlan(flowPlan = {}) {
    const viewState = createRuntimeViewState(flowPlan);
    if (!hasRuntimeViewStateChanges(viewState)) {
      return viewState;
    }
    if (typeof applyRuntimeViewState === 'function') {
      applyRuntimeViewState(viewState);
      return viewState;
    }
    if (viewState.clearRuntimeSelection) {
      clearRuntimeSelection({
        stateCurveFocusMode: viewState.stateCurveFocusMode,
      });
    }
    if (viewState.stateCurveLayerFilters) {
      setStateCurveLayerFilters({ ...viewState.stateCurveLayerFilters });
    }
    if (viewState.stateCurveTrackFilters) {
      setStateCurveTrackFilters({ ...viewState.stateCurveTrackFilters });
    }
    if (viewState.runtimeLogFocus.statePointId) {
      focusRuntimeLog({ ...viewState.runtimeLogFocus });
    }
    return viewState;
  }

  return {
    applyCalculatorScope({
      scope = '',
      selectFirstRuntimePoint = true,
    } = {}) {
      applyCalculatorScopeStateForScope(scope, { selectFirstRuntimePoint });
      return createFlowRuntimeResult({
        applied: true,
        kind: 'calculator-scope-selection',
      });
    },

    applyRuntimePointSelection({ statePointId = '' } = {}) {
      applyRuntimePointSelectionStateForPoint(statePointId);
      return createFlowRuntimeResult({
        applied: true,
        kind: 'runtime-point-selection',
      });
    },

    applyActionEditFlowPlan(plan = {}) {
      const flowPlan = plan ?? {};
      if (!flowPlan.canApply) {
        return createFlowRuntimeResult({
          applied: false,
          kind: flowPlan.kind,
          reason: 'disabled-action-edit-flow-plan',
        });
      }
      const actionSelection = createActionSelectionState(flowPlan.actionId);
      if (!actionSelection.shouldSelectAction && flowPlan.requiresExistingAction) {
        return createFlowRuntimeResult({
          applied: false,
          kind: flowPlan.kind,
          reason: 'missing-action-draft',
        });
      }

      applyActionEditStateForPlan(flowPlan);
      return createFlowRuntimeResult({
        applied: true,
        kind: flowPlan.kind,
      });
    },

    applyRuntimeFlowPlan(plan = {}) {
      const flowPlan = plan ?? {};
      if (flowPlan.selectActionId) {
        applyActionSelectionStateForAction(flowPlan.selectActionId);
      }

      if (flowPlan.calculatorScope) {
        if (flowPlan.pulseCalculatorFocus) {
          applyCalculatorScopeStateForScope(flowPlan.calculatorScope, {
            selectFirstRuntimePoint: flowPlan.selectFirstRuntimePoint,
          });
        } else {
          setCalculatorScope(flowPlan.calculatorScope);
        }
      }

      if (flowPlan.selectRuntimeStatePoint) {
        applyRuntimePointSelectionStateForPoint(flowPlan.statePointId);
      }
      applyRuntimeViewStateForPlan(flowPlan);

      return createFlowRuntimeResult({
        applied: true,
        kind: flowPlan.kind,
      });
    },
  };
}

function createRuntimeViewState(flowPlan = {}) {
  return {
    clearRuntimeSelection: Boolean(flowPlan.clearRuntimeSelection),
    stateCurveFocusMode: flowPlan.stateCurveFocusMode || 'all',
    stateCurveLayerFilters: flowPlan.stateCurveLayerFilters
      ? { ...flowPlan.stateCurveLayerFilters }
      : null,
    stateCurveTrackFilters: flowPlan.stateCurveTrackFilters
      ? { ...flowPlan.stateCurveTrackFilters }
      : null,
    runtimeLogFocus:
      flowPlan.runtimeLogFocusSource && flowPlan.statePointId
        ? {
            source: flowPlan.runtimeLogFocusSource,
            statePointId: flowPlan.statePointId,
          }
        : {
            source: '',
            statePointId: '',
          },
  };
}

function hasRuntimeViewStateChanges(viewState = {}) {
  return Boolean(
    viewState.clearRuntimeSelection ||
      viewState.stateCurveLayerFilters ||
      viewState.stateCurveTrackFilters ||
      viewState.runtimeLogFocus?.statePointId
  );
}

function createFlowRuntimeResult({ applied, kind = '', reason = '' } = {}) {
  return {
    applied: Boolean(applied),
    kind: kind ?? '',
    reason: applied ? '' : reason,
  };
}
