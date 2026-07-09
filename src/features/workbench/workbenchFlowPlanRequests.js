import {
  WORKBENCH_FLOW_ACTION_KINDS,
  createWorkbenchFlowAction,
} from './workbenchFlowModel';
import { WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS } from './workbenchFlowPlanController';

export const WORKBENCH_FLOW_PLAN_APPLICATION_KINDS = Object.freeze({
  RUNTIME: 'runtime',
  ACTION_EDIT: 'action-edit',
});

export const WORKBENCH_FLOW_CONTROLLER_HANDLERS = Object.freeze({
  OPEN_RUNTIME_RESULTS: 'openRuntimeResults',
  SELECT_RUNTIME_RESULT: 'selectRuntimeResult',
  SELECT_RUNTIME_STATE_POINT: 'selectRuntimeStatePoint',
  SELECT_CONTRIBUTION_POINT: 'selectContributionPoint',
  FOCUS_RUNTIME_ACTION: 'focusRuntimeAction',
  FOCUS_EDIT_SOURCE: 'focusEditSource',
  RETURN_RUNTIME_RESULT: 'returnRuntimeResult',
});

export function createWorkbenchFlowActionPlanRequest(action = {}) {
  const flowAction = createWorkbenchFlowAction(action);
  if (!flowAction.canRun) {
    return createUnsupportedWorkbenchFlowActionPlanRequest({
      flowAction,
      reason: flowAction.disabledReason || 'disabled-flow-action',
    });
  }

  if (flowAction.kind === WORKBENCH_FLOW_ACTION_KINDS.OPEN_RUNTIME_RESULTS) {
    const payload = {
      actionId: flowAction.actionId,
      ...(flowAction.payload ?? {}),
    };
    return createSupportedWorkbenchFlowActionPlanRequest({
      flowAction,
      handlerKey: WORKBENCH_FLOW_CONTROLLER_HANDLERS.OPEN_RUNTIME_RESULTS,
      payload,
      request: createWorkbenchRuntimeEntryPlanRequest(payload),
    });
  }

  if (flowAction.kind === WORKBENCH_FLOW_ACTION_KINDS.SELECT_RUNTIME_RESULT) {
    const payload = {
      actionId: flowAction.actionId,
      statePointId: flowAction.statePointId,
      source: flowAction.source,
    };
    return createSupportedWorkbenchFlowActionPlanRequest({
      flowAction,
      handlerKey: WORKBENCH_FLOW_CONTROLLER_HANDLERS.SELECT_RUNTIME_RESULT,
      payload,
      request: createWorkbenchRuntimeResultReturnPlanRequest(payload),
    });
  }

  if (
    flowAction.kind === WORKBENCH_FLOW_ACTION_KINDS.SELECT_RUNTIME_STATE_POINT
  ) {
    const payload = createRuntimeStatePointFocusPayload(flowAction);
    return createSupportedWorkbenchFlowActionPlanRequest({
      flowAction,
      handlerKey: WORKBENCH_FLOW_CONTROLLER_HANDLERS.SELECT_RUNTIME_STATE_POINT,
      payload,
      request: createWorkbenchRuntimePointFocusPlanRequest(payload),
    });
  }

  if (
    flowAction.kind === WORKBENCH_FLOW_ACTION_KINDS.SELECT_CONTRIBUTION_POINT
  ) {
    const payload = createContributionPointFocusPayload(flowAction);
    return createSupportedWorkbenchFlowActionPlanRequest({
      flowAction,
      handlerKey: WORKBENCH_FLOW_CONTROLLER_HANDLERS.SELECT_CONTRIBUTION_POINT,
      payload,
      request: createWorkbenchContributionPointFocusPlanRequest(payload),
    });
  }

  if (flowAction.kind === WORKBENCH_FLOW_ACTION_KINDS.FOCUS_RUNTIME_ACTION) {
    const payload = createRuntimeActionFocusPayload(flowAction);
    return createSupportedWorkbenchFlowActionPlanRequest({
      flowAction,
      handlerKey: WORKBENCH_FLOW_CONTROLLER_HANDLERS.FOCUS_RUNTIME_ACTION,
      payload,
      request: createWorkbenchRuntimeActionEditPlanRequest(payload),
    });
  }

  if (flowAction.kind === WORKBENCH_FLOW_ACTION_KINDS.FOCUS_EDIT_SOURCE) {
    const payload = flowAction.payload ?? flowAction;
    return createSupportedWorkbenchFlowActionPlanRequest({
      flowAction,
      handlerKey: WORKBENCH_FLOW_CONTROLLER_HANDLERS.FOCUS_EDIT_SOURCE,
      payload,
      request: createWorkbenchEditSourceActionEditPlanRequest(payload),
    });
  }

  if (flowAction.kind === WORKBENCH_FLOW_ACTION_KINDS.RETURN_RUNTIME_RESULT) {
    const payload = {
      actionId: flowAction.actionId,
      statePointId: flowAction.statePointId,
      source: flowAction.source,
    };
    return createSupportedWorkbenchFlowActionPlanRequest({
      flowAction,
      handlerKey: WORKBENCH_FLOW_CONTROLLER_HANDLERS.RETURN_RUNTIME_RESULT,
      payload,
      request: createWorkbenchRuntimeResultReturnPlanRequest(payload),
    });
  }

  return createUnsupportedWorkbenchFlowActionPlanRequest({
    flowAction,
    reason: 'unsupported-flow-action-kind',
  });
}

export function createWorkbenchRuntimeEntryPlanRequest({
  actionId = '',
  fallbackToFirstRuntimePoint = false,
} = {}) {
  return createWorkbenchFlowPlanRequest({
    applicationKind: WORKBENCH_FLOW_PLAN_APPLICATION_KINDS.RUNTIME,
    methodKey: WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS.RUNTIME_ENTRY,
    payload: {
      actionId,
      fallbackToFirstRuntimePoint,
    },
  });
}

export function createWorkbenchRuntimeResultReturnPlanRequest({
  actionId = '',
  statePointId = '',
  source = '',
  defaultSource = 'action-result',
} = {}) {
  return createWorkbenchFlowPlanRequest({
    applicationKind: WORKBENCH_FLOW_PLAN_APPLICATION_KINDS.RUNTIME,
    methodKey: WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS.RUNTIME_RESULT_RETURN,
    payload: {
      actionId,
      statePointId,
      source: source || defaultSource,
    },
  });
}

export function createWorkbenchRuntimePointFocusPlanRequest({
  statePointId = '',
  source = '',
  defaultSource = 'runtime-state-point',
  preserveStateCurveFilters = false,
} = {}) {
  return createWorkbenchFlowPlanRequest({
    applicationKind: WORKBENCH_FLOW_PLAN_APPLICATION_KINDS.RUNTIME,
    methodKey: WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS.RUNTIME_POINT_FOCUS,
    payload: {
      statePointId,
      source: source || defaultSource,
      preserveStateCurveFilters: Boolean(preserveStateCurveFilters),
    },
  });
}

export function createWorkbenchContributionPointFocusPlanRequest(payload = {}) {
  const pointPayload =
    typeof payload === 'string' ? { statePointId: payload } : payload ?? {};
  return createWorkbenchRuntimePointFocusPlanRequest({
    statePointId: pointPayload.statePointId ?? '',
    source: pointPayload.runtimeFocusSource || 'action-contribution',
    preserveStateCurveFilters: Boolean(pointPayload.preserveStateCurveFilters),
  });
}

export function createWorkbenchRuntimeActionEditPlanRequest(payload = {}) {
  return createWorkbenchFlowPlanRequest({
    applicationKind: WORKBENCH_FLOW_PLAN_APPLICATION_KINDS.ACTION_EDIT,
    methodKey:
      WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS.RUNTIME_ACTION_EDIT_FOCUS,
    payload,
  });
}

export function createWorkbenchEditSourceActionEditPlanRequest(payload = {}) {
  return createWorkbenchFlowPlanRequest({
    applicationKind: WORKBENCH_FLOW_PLAN_APPLICATION_KINDS.ACTION_EDIT,
    methodKey:
      WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS.EDIT_SOURCE_ACTION_EDIT_FOCUS,
    payload,
  });
}

export function applyWorkbenchFlowPlanRequest({
  flowPlanController = null,
  request = null,
  applyRuntimeFlowPlan = () => {},
  applyActionEditFlowPlan = () => {},
} = {}) {
  const plan = createWorkbenchFlowPlanFromRequest({
    flowPlanController,
    request,
  });

  if (request?.applicationKind === WORKBENCH_FLOW_PLAN_APPLICATION_KINDS.RUNTIME) {
    return applyRuntimeFlowPlan(plan);
  }

  if (
    request?.applicationKind ===
    WORKBENCH_FLOW_PLAN_APPLICATION_KINDS.ACTION_EDIT
  ) {
    return applyActionEditFlowPlan(plan);
  }

  return plan;
}

export function createWorkbenchFlowPlanFromRequest({
  flowPlanController = null,
  request = null,
} = {}) {
  const createFlowPlan = flowPlanController?.[request?.methodKey];
  if (typeof createFlowPlan !== 'function') {
    return {};
  }
  return createFlowPlan(request?.payload ?? {});
}

function createWorkbenchFlowPlanRequest({
  applicationKind = '',
  methodKey = '',
  payload = {},
} = {}) {
  return {
    applicationKind,
    methodKey,
    payload,
  };
}

function createSupportedWorkbenchFlowActionPlanRequest({
  flowAction,
  handlerKey = '',
  payload = null,
  request = null,
} = {}) {
  return {
    supported: true,
    reason: '',
    flowAction,
    handlerKey,
    payload,
    request,
  };
}

function createUnsupportedWorkbenchFlowActionPlanRequest({
  flowAction,
  reason = '',
} = {}) {
  return {
    supported: false,
    reason,
    flowAction,
    handlerKey: '',
    payload: null,
    request: null,
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
