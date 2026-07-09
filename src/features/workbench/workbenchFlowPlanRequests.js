import { WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS } from './workbenchFlowPlanController';

export const WORKBENCH_FLOW_PLAN_APPLICATION_KINDS = Object.freeze({
  RUNTIME: 'runtime',
  ACTION_EDIT: 'action-edit',
});

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
