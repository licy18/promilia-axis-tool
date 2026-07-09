import {
  createWorkbenchFlowAction,
} from './workbenchFlowModel';
import {
  WORKBENCH_FLOW_CONTROLLER_HANDLERS,
  applyWorkbenchFlowPlanRequest,
  createWorkbenchFlowActionPlanRequest,
  createWorkbenchContributionPointFocusPlanRequest,
  createWorkbenchEditSourceActionEditPlanRequest,
  createWorkbenchRuntimeActionEditPlanRequest,
  createWorkbenchRuntimeEntryPlanRequest,
  createWorkbenchRuntimePointFocusPlanRequest,
  createWorkbenchRuntimeResultReturnPlanRequest,
} from './workbenchFlowPlanRequests';

export { WORKBENCH_FLOW_CONTROLLER_HANDLERS } from './workbenchFlowPlanRequests';

export function createWorkbenchFlowController(handlers = {}) {
  return {
    dispatch(action = {}) {
      const flowAction = createWorkbenchFlowAction(action);
      if (!flowAction.canRun) {
        return createWorkbenchFlowControllerResult({
          flowAction,
          reason: flowAction.disabledReason || 'disabled-flow-action',
        });
      }

      const actionPlanRequest = createWorkbenchFlowActionPlanRequest(
        flowAction
      );
      if (actionPlanRequest.supported) {
        return callWorkbenchFlowHandler({
          handlers,
          handlerKey: actionPlanRequest.handlerKey,
          flowAction,
          payload: actionPlanRequest.payload,
          planRequest: actionPlanRequest.request,
        });
      }

      return createWorkbenchFlowControllerResult({
        flowAction,
        reason: actionPlanRequest.reason || 'unsupported-flow-action-kind',
      });
    },
  };
}

export function createWorkbenchFlowPlanHandlers({
  flowPlanController = null,
  applyRuntimeFlowPlan = () => {},
  applyActionEditFlowPlan = () => {},
} = {}) {
  const applyPlanRequest = request =>
    applyWorkbenchFlowPlanRequest({
      flowPlanController,
      request,
      applyRuntimeFlowPlan,
      applyActionEditFlowPlan,
    });

  return {
    [WORKBENCH_FLOW_CONTROLLER_HANDLERS.OPEN_RUNTIME_RESULTS]: (
      { actionId, fallbackToFirstRuntimePoint = false } = {},
      _flowAction = null,
      planRequest = null
    ) =>
      applyPlanRequest(
        planRequest ??
          createWorkbenchRuntimeEntryPlanRequest({
            actionId,
            fallbackToFirstRuntimePoint,
          })
      ),

    [WORKBENCH_FLOW_CONTROLLER_HANDLERS.SELECT_RUNTIME_RESULT]: (
      { actionId, statePointId, source, runtimeLogFocusSource } = {},
      _flowAction = null,
      planRequest = null
    ) =>
      applyPlanRequest(
        planRequest ??
          createWorkbenchRuntimeResultReturnPlanRequest({
            actionId,
            statePointId,
            source,
            runtimeLogFocusSource,
          })
      ),

    [WORKBENCH_FLOW_CONTROLLER_HANDLERS.SELECT_RUNTIME_STATE_POINT]: (
      {
        statePointId,
        source,
        runtimeLogFocusSource,
        preserveStateCurveFilters = false,
      } = {},
      _flowAction = null,
      planRequest = null
    ) =>
      applyPlanRequest(
        planRequest ??
          createWorkbenchRuntimePointFocusPlanRequest({
            statePointId,
            source,
            runtimeLogFocusSource,
            preserveStateCurveFilters,
          })
      ),

    [WORKBENCH_FLOW_CONTROLLER_HANDLERS.SELECT_CONTRIBUTION_POINT]: (
      payload,
      _flowAction = null,
      planRequest = null
    ) =>
      applyPlanRequest(
        planRequest ?? createWorkbenchContributionPointFocusPlanRequest(payload)
      ),

    [WORKBENCH_FLOW_CONTROLLER_HANDLERS.FOCUS_RUNTIME_ACTION]: (
      payload,
      _flowAction = null,
      planRequest = null
    ) =>
      applyPlanRequest(
        planRequest ?? createWorkbenchRuntimeActionEditPlanRequest(payload)
      ),

    [WORKBENCH_FLOW_CONTROLLER_HANDLERS.FOCUS_EDIT_SOURCE]: (
      payload,
      _flowAction = null,
      planRequest = null
    ) =>
      applyPlanRequest(
        planRequest ?? createWorkbenchEditSourceActionEditPlanRequest(payload)
      ),

    [WORKBENCH_FLOW_CONTROLLER_HANDLERS.RETURN_RUNTIME_RESULT]: (
      { actionId, statePointId, source, runtimeLogFocusSource } = {},
      _flowAction = null,
      planRequest = null
    ) =>
      applyPlanRequest(
        planRequest ??
          createWorkbenchRuntimeResultReturnPlanRequest({
            actionId,
            statePointId,
            source,
            runtimeLogFocusSource,
          })
      ),
  };
}

function callWorkbenchFlowHandler({
  handlers,
  handlerKey,
  flowAction,
  payload,
  planRequest = null,
}) {
  const handler = handlers[handlerKey];
  if (typeof handler !== 'function') {
    return createWorkbenchFlowControllerResult({
      flowAction,
      handlerKey,
      reason: 'missing-flow-handler',
    });
  }
  handler(payload, flowAction, planRequest);
  return createWorkbenchFlowControllerResult({
    flowAction,
    handlerKey,
    handled: true,
  });
}

function createWorkbenchFlowControllerResult({
  flowAction,
  handlerKey = '',
  handled = false,
  reason = '',
} = {}) {
  return {
    handled,
    kind: flowAction?.kind ?? '',
    source: flowAction?.source ?? '',
    handlerKey,
    reason: handled ? '' : reason,
    action: flowAction ?? null,
  };
}
