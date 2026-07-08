import { createWorkbenchFlowRuntimePointSelectionState } from './workbenchFlowRuntimePointSelection';

export function createWorkbenchFlowRuntime({
  actionExists = () => false,
  selectAction = () => {},
  setActionEditFocus = () => {},
  focusCalculatorScope = () => {},
  setCalculatorScope = () => {},
  applyRuntimePointSelectionState = null,
  selectRuntimeStatePoint = () => {},
  clearRuntimeSelection = () => {},
  setStateCurveLayerFilters = () => {},
  setStateCurveTrackFilters = () => {},
  focusRuntimeLog = () => {},
} = {}) {
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

  return {
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
      if (actionExists(flowPlan.actionId)) {
        selectAction(flowPlan.actionId, { syncRuntimeResult: false });
      } else if (flowPlan.requiresExistingAction) {
        return createFlowRuntimeResult({
          applied: false,
          kind: flowPlan.kind,
          reason: 'missing-action-draft',
        });
      }

      setActionEditFocus({ ...(flowPlan.actionEditFocus ?? {}) });
      return createFlowRuntimeResult({
        applied: true,
        kind: flowPlan.kind,
      });
    },

    applyRuntimeFlowPlan(plan = {}) {
      const flowPlan = plan ?? {};
      if (flowPlan.selectActionId && actionExists(flowPlan.selectActionId)) {
        selectAction(flowPlan.selectActionId, { syncRuntimeResult: false });
      }

      if (flowPlan.calculatorScope) {
        if (flowPlan.pulseCalculatorFocus) {
          focusCalculatorScope(flowPlan.calculatorScope, {
            selectFirstRuntimePoint: flowPlan.selectFirstRuntimePoint,
          });
        } else {
          setCalculatorScope(flowPlan.calculatorScope);
        }
      }

      if (flowPlan.selectRuntimeStatePoint) {
        applyRuntimePointSelectionStateForPoint(flowPlan.statePointId);
      } else if (flowPlan.clearRuntimeSelection) {
        clearRuntimeSelection({
          stateCurveFocusMode: flowPlan.stateCurveFocusMode || 'all',
        });
      }

      if (flowPlan.stateCurveLayerFilters) {
        setStateCurveLayerFilters({ ...flowPlan.stateCurveLayerFilters });
      }
      if (flowPlan.stateCurveTrackFilters) {
        setStateCurveTrackFilters({ ...flowPlan.stateCurveTrackFilters });
      }
      if (flowPlan.runtimeLogFocusSource && flowPlan.statePointId) {
        focusRuntimeLog({
          source: flowPlan.runtimeLogFocusSource,
          statePointId: flowPlan.statePointId,
        });
      }

      return createFlowRuntimeResult({
        applied: true,
        kind: flowPlan.kind,
      });
    },
  };
}

function createFlowRuntimeResult({ applied, kind = '', reason = '' } = {}) {
  return {
    applied: Boolean(applied),
    kind: kind ?? '',
    reason: applied ? '' : reason,
  };
}
