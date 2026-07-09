import {
  createEditSourceActionEditFocusPlan,
  createRuntimeActionEditFocusPlan,
} from './workbenchActionEditFlowPlan';
import {
  createRuntimeEntryFlowPlan,
  createRuntimePointFocusFlowPlan,
  createRuntimeResultReturnFlowPlan,
} from './workbenchRuntimeFlowPlan';

export const WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS = Object.freeze({
  RUNTIME_ENTRY: 'createRuntimeEntryPlan',
  RUNTIME_POINT_FOCUS: 'createRuntimePointFocusPlan',
  RUNTIME_RESULT_RETURN: 'createRuntimeResultReturnPlan',
  RUNTIME_ACTION_EDIT_FOCUS: 'createRuntimeActionEditFocusPlan',
  EDIT_SOURCE_ACTION_EDIT_FOCUS: 'createEditSourceActionEditFocusPlan',
});

export function createWorkbenchFlowPlanController({
  getRuntimeProjection = () => null,
  getSelectedActionId = () => '',
  getActionEditFocusSequence = () => 0,
} = {}) {
  return {
    [WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS.RUNTIME_ENTRY]({
      actionId = '',
      fallbackToFirstRuntimePoint = false,
    } = {}) {
      return createRuntimeEntryFlowPlan({
        runtimeProjection: getRuntimeProjection(),
        actionId: actionId || getSelectedActionId(),
        fallbackToFirstRuntimePoint,
      });
    },

    [WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS.RUNTIME_POINT_FOCUS]({
      statePointId = '',
      source = '',
      runtimeLogFocusSource = '',
      preserveStateCurveFilters = false,
    } = {}) {
      return createRuntimePointFocusFlowPlan({
        statePointId,
        source,
        runtimeLogFocusSource,
        preserveStateCurveFilters,
      });
    },

    [WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS.RUNTIME_RESULT_RETURN]({
      actionId = '',
      statePointId = '',
      source = 'action-result',
      runtimeLogFocusSource = '',
    } = {}) {
      return createRuntimeResultReturnFlowPlan({
        actionId,
        statePointId,
        source,
        runtimeLogFocusSource,
      });
    },

    [WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS.RUNTIME_ACTION_EDIT_FOCUS](
      payload = {}
    ) {
      return createRuntimeActionEditFocusPlan({
        ...payload,
        sequence: getActionEditFocusSequence(),
      });
    },

    [WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS.EDIT_SOURCE_ACTION_EDIT_FOCUS](
      source = {}
    ) {
      return createEditSourceActionEditFocusPlan({
        source,
        sequence: getActionEditFocusSequence(),
      });
    },
  };
}
