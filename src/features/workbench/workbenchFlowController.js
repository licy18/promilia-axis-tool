import {
  WORKBENCH_FLOW_ACTION_KINDS,
  createWorkbenchFlowAction,
} from './workbenchFlowModel';
import {
  applyWorkbenchFlowPlanRequest,
  createWorkbenchContributionPointFocusPlanRequest,
  createWorkbenchEditSourceActionEditPlanRequest,
  createWorkbenchRuntimeActionEditPlanRequest,
  createWorkbenchRuntimeEntryPlanRequest,
  createWorkbenchRuntimePointFocusPlanRequest,
  createWorkbenchRuntimeResultReturnPlanRequest,
} from './workbenchFlowPlanRequests';

export const WORKBENCH_FLOW_CONTROLLER_HANDLERS = Object.freeze({
  OPEN_RUNTIME_RESULTS: 'openRuntimeResults',
  SELECT_RUNTIME_RESULT: 'selectRuntimeResult',
  SELECT_RUNTIME_STATE_POINT: 'selectRuntimeStatePoint',
  SELECT_CONTRIBUTION_POINT: 'selectContributionPoint',
  FOCUS_RUNTIME_ACTION: 'focusRuntimeAction',
  FOCUS_EDIT_SOURCE: 'focusEditSource',
  RETURN_RUNTIME_RESULT: 'returnRuntimeResult',
});

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

      if (
        flowAction.kind === WORKBENCH_FLOW_ACTION_KINDS.OPEN_RUNTIME_RESULTS
      ) {
        return callWorkbenchFlowHandler({
          handlers,
          handlerKey: WORKBENCH_FLOW_CONTROLLER_HANDLERS.OPEN_RUNTIME_RESULTS,
          flowAction,
          payload: {
            actionId: flowAction.actionId,
            ...(flowAction.payload ?? {}),
          },
        });
      }

      if (
        flowAction.kind === WORKBENCH_FLOW_ACTION_KINDS.SELECT_RUNTIME_RESULT
      ) {
        return callWorkbenchFlowHandler({
          handlers,
          handlerKey: WORKBENCH_FLOW_CONTROLLER_HANDLERS.SELECT_RUNTIME_RESULT,
          flowAction,
          payload: {
            actionId: flowAction.actionId,
            statePointId: flowAction.statePointId,
            source: flowAction.source,
          },
        });
      }

      if (
        flowAction.kind ===
        WORKBENCH_FLOW_ACTION_KINDS.SELECT_RUNTIME_STATE_POINT
      ) {
        return callWorkbenchFlowHandler({
          handlers,
          handlerKey:
            WORKBENCH_FLOW_CONTROLLER_HANDLERS.SELECT_RUNTIME_STATE_POINT,
          flowAction,
          payload: createRuntimeStatePointFocusPayload(flowAction),
        });
      }

      if (
        flowAction.kind ===
        WORKBENCH_FLOW_ACTION_KINDS.SELECT_CONTRIBUTION_POINT
      ) {
        return callWorkbenchFlowHandler({
          handlers,
          handlerKey:
            WORKBENCH_FLOW_CONTROLLER_HANDLERS.SELECT_CONTRIBUTION_POINT,
          flowAction,
          payload: createContributionPointFocusPayload(flowAction),
        });
      }

      if (
        flowAction.kind === WORKBENCH_FLOW_ACTION_KINDS.FOCUS_RUNTIME_ACTION
      ) {
        return callWorkbenchFlowHandler({
          handlers,
          handlerKey: WORKBENCH_FLOW_CONTROLLER_HANDLERS.FOCUS_RUNTIME_ACTION,
          flowAction,
          payload: createRuntimeActionFocusPayload(flowAction),
        });
      }

      if (flowAction.kind === WORKBENCH_FLOW_ACTION_KINDS.FOCUS_EDIT_SOURCE) {
        return callWorkbenchFlowHandler({
          handlers,
          handlerKey: WORKBENCH_FLOW_CONTROLLER_HANDLERS.FOCUS_EDIT_SOURCE,
          flowAction,
          payload: flowAction.payload ?? flowAction,
        });
      }

      if (
        flowAction.kind === WORKBENCH_FLOW_ACTION_KINDS.RETURN_RUNTIME_RESULT
      ) {
        return callWorkbenchFlowHandler({
          handlers,
          handlerKey: WORKBENCH_FLOW_CONTROLLER_HANDLERS.RETURN_RUNTIME_RESULT,
          flowAction,
          payload: {
            actionId: flowAction.actionId,
            statePointId: flowAction.statePointId,
            source: flowAction.source,
          },
        });
      }

      return createWorkbenchFlowControllerResult({
        flowAction,
        reason: 'unsupported-flow-action-kind',
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
    [WORKBENCH_FLOW_CONTROLLER_HANDLERS.OPEN_RUNTIME_RESULTS]: ({
      actionId,
      fallbackToFirstRuntimePoint = false,
    } = {}) =>
      applyPlanRequest(
        createWorkbenchRuntimeEntryPlanRequest({
          actionId,
          fallbackToFirstRuntimePoint,
        })
      ),

    [WORKBENCH_FLOW_CONTROLLER_HANDLERS.SELECT_RUNTIME_RESULT]: ({
      actionId,
      statePointId,
      source,
    } = {}) =>
      applyPlanRequest(
        createWorkbenchRuntimeResultReturnPlanRequest({
          actionId,
          statePointId,
          source,
        })
      ),

    [WORKBENCH_FLOW_CONTROLLER_HANDLERS.SELECT_RUNTIME_STATE_POINT]: ({
      statePointId,
      source,
      preserveStateCurveFilters = false,
    } = {}) =>
      applyPlanRequest(
        createWorkbenchRuntimePointFocusPlanRequest({
          statePointId,
          source,
          preserveStateCurveFilters,
        })
      ),

    [WORKBENCH_FLOW_CONTROLLER_HANDLERS.SELECT_CONTRIBUTION_POINT]: payload =>
      applyPlanRequest(
        createWorkbenchContributionPointFocusPlanRequest(payload)
      ),

    [WORKBENCH_FLOW_CONTROLLER_HANDLERS.FOCUS_RUNTIME_ACTION]: payload =>
      applyPlanRequest(createWorkbenchRuntimeActionEditPlanRequest(payload)),

    [WORKBENCH_FLOW_CONTROLLER_HANDLERS.FOCUS_EDIT_SOURCE]: payload =>
      applyPlanRequest(createWorkbenchEditSourceActionEditPlanRequest(payload)),

    [WORKBENCH_FLOW_CONTROLLER_HANDLERS.RETURN_RUNTIME_RESULT]: ({
      actionId,
      statePointId,
      source,
    } = {}) =>
      applyPlanRequest(
        createWorkbenchRuntimeResultReturnPlanRequest({
          actionId,
          statePointId,
          source,
        })
      ),
  };
}

function createRuntimeActionFocusPayload(flowAction) {
  const payload =
    flowAction?.payload && typeof flowAction.payload === 'object'
      ? { ...flowAction.payload }
      : {};
  return {
    ...payload,
    actionId: payload.actionId || flowAction?.actionId || '',
    statePointId: payload.statePointId || flowAction?.statePointId || '',
    source: payload.source || flowAction?.source || '',
  };
}

function createRuntimeStatePointFocusPayload(flowAction) {
  const payload =
    flowAction?.payload && typeof flowAction.payload === 'object'
      ? { ...flowAction.payload }
      : {};
  return {
    ...payload,
    actionId: flowAction?.actionId || payload.actionId || '',
    statePointId: flowAction?.statePointId || payload.statePointId || '',
    source: flowAction?.source || payload.source || '',
  };
}

function createContributionPointFocusPayload(flowAction) {
  const payload =
    flowAction?.payload && typeof flowAction.payload === 'object'
      ? { ...flowAction.payload }
      : {};
  return {
    ...payload,
    actionId: flowAction?.actionId || payload.actionId || '',
    statePointId: flowAction?.statePointId || payload.statePointId || '',
    source: flowAction?.source || payload.source || '',
    runtimeFocusSource: payload.runtimeFocusSource || 'action-contribution',
    preserveStateCurveFilters: Boolean(payload.preserveStateCurveFilters),
  };
}

function callWorkbenchFlowHandler({
  handlers,
  handlerKey,
  flowAction,
  payload,
}) {
  const handler = handlers[handlerKey];
  if (typeof handler !== 'function') {
    return createWorkbenchFlowControllerResult({
      flowAction,
      handlerKey,
      reason: 'missing-flow-handler',
    });
  }
  handler(payload, flowAction);
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
