import {
  WORKBENCH_FLOW_ACTION_KINDS,
  createWorkbenchFlowAction,
} from './workbenchFlowModel';

export function createRuntimeStatePointFocusFlowAction({
  source = '',
  detail = null,
  actionId = '',
  statePointId = '',
  payload,
  enabled,
  disabledReason = 'missing-runtime-state-point',
} = {}) {
  const normalizedActionId =
    actionId || detail?.row?.actionId || detail?.actionId || '';
  const normalizedStatePointId =
    statePointId ||
    detail?.statePointId ||
    detail?.runtimeStatePointId ||
    '';

  return createWorkbenchFlowAction({
    kind: WORKBENCH_FLOW_ACTION_KINDS.SELECT_RUNTIME_STATE_POINT,
    source,
    actionId: normalizedActionId,
    statePointId: normalizedStatePointId,
    payload: payload === undefined ? (detail ?? null) : payload,
    enabled: enabled ?? Boolean(normalizedStatePointId),
    disabledReason,
  });
}

export function createRuntimeResultFocusFlowAction({
  source = '',
  detail = null,
  actionId = '',
  statePointId = '',
  payload = null,
  enabled,
  disabledReason = 'missing-runtime-state-point',
} = {}) {
  const normalizedActionId = actionId || detail?.actionId || '';
  const normalizedStatePointId =
    statePointId ||
    detail?.statePointId ||
    detail?.runtimeStatePointId ||
    '';

  return createWorkbenchFlowAction({
    kind: WORKBENCH_FLOW_ACTION_KINDS.SELECT_RUNTIME_RESULT,
    source,
    actionId: normalizedActionId,
    statePointId: normalizedStatePointId,
    payload,
    enabled: enabled ?? Boolean(normalizedStatePointId),
    disabledReason,
  });
}
