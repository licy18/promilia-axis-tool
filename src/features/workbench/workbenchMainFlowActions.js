import {
  WORKBENCH_FLOW_ACTION_KINDS,
  createWorkbenchFlowAction,
} from './workbenchFlowModel';
import { createRuntimeActionFocusFlowAction } from './runtimeActionFocusFlowAction';
import {
  createRuntimeResultFocusFlowAction,
  createRuntimeStatePointFocusFlowAction,
} from './runtimeResultFocusFlowAction';

export function createWorkbenchOpenRuntimeResultsFlowAction({
  flowModel = null,
  source = '',
  enabled,
} = {}) {
  return createWorkbenchFlowAction({
    kind: WORKBENCH_FLOW_ACTION_KINDS.OPEN_RUNTIME_RESULTS,
    source,
    actionId:
      flowModel?.mainFlowState?.primaryAction?.actionId ??
      flowModel?.selectedActionId ??
      '',
    payload: {
      runtimeSimLogCount: flowModel?.runtimeSimLogCount ?? 0,
      fallbackToFirstRuntimePoint: true,
    },
    enabled: enabled ?? Boolean(flowModel?.controls?.canOpenRuntimeResults),
    disabledReason: 'missing-runtime-results',
  });
}

export function createWorkbenchRuntimeStatePointFlowAction(options = {}) {
  return createRuntimeStatePointFocusFlowAction(options);
}

export function createWorkbenchRuntimeResultFlowAction(options = {}) {
  return createRuntimeResultFocusFlowAction(options);
}

export function createWorkbenchRuntimeActionEditFlowAction({
  source = '',
  target = null,
  enabled,
  disabledReason = 'missing-runtime-action',
} = {}) {
  return createRuntimeActionFocusFlowAction({
    source,
    detail: target,
    enabled: enabled ?? Boolean(target?.canFocusAction ?? target?.actionId),
    disabledReason,
  });
}

export function createWorkbenchRuntimeResultReturnFlowAction({
  source = '',
  target = null,
  enabled,
  disabledReason = 'missing-runtime-result',
} = {}) {
  return createWorkbenchFlowAction({
    kind: WORKBENCH_FLOW_ACTION_KINDS.RETURN_RUNTIME_RESULT,
    source,
    actionId: target?.actionId ?? '',
    statePointId: target?.statePointId ?? '',
    payload: target ?? null,
    enabled: enabled ?? Boolean(target?.canReturn ?? target?.statePointId),
    disabledReason,
  });
}
