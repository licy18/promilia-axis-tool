import {
  WORKBENCH_FLOW_ACTION_KINDS,
  createWorkbenchFlowAction,
} from './workbenchFlowModel';

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
          payload: flowAction.statePointId,
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
          payload: flowAction.statePointId,
        });
      }

      if (
        flowAction.kind === WORKBENCH_FLOW_ACTION_KINDS.FOCUS_RUNTIME_ACTION
      ) {
        return callWorkbenchFlowHandler({
          handlers,
          handlerKey: WORKBENCH_FLOW_CONTROLLER_HANDLERS.FOCUS_RUNTIME_ACTION,
          flowAction,
          payload: flowAction.payload ?? flowAction,
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
