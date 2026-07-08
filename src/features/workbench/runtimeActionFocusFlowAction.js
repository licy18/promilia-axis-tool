import {
  WORKBENCH_FLOW_ACTION_KINDS,
  createWorkbenchFlowAction,
} from './workbenchFlowModel';

export function createRuntimeActionFocusFlowAction({
  source = '',
  detail = null,
  enabled,
  disabledReason = 'missing-runtime-action',
} = {}) {
  const actionId = detail?.actionId ?? '';
  const statePointId = detail?.statePointId ?? '';
  const payload = {
    actionId,
    fieldKey: detail?.fieldKey || 'startMs',
    frameLabel: detail?.frameLabel ?? formatRuntimeFocusFrameLabel(detail),
    statePointId,
    trackKey: detail?.trackKey ?? '',
  };

  return createWorkbenchFlowAction({
    kind: WORKBENCH_FLOW_ACTION_KINDS.FOCUS_RUNTIME_ACTION,
    source,
    actionId,
    statePointId,
    payload,
    enabled: enabled ?? Boolean(actionId),
    disabledReason,
  });
}

function formatRuntimeFocusFrameLabel(detail) {
  return `${detail?.timeMs ?? 0}ms`;
}
