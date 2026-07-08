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
      flowModel?.mainFlowLoopState?.targetActionId ||
      flowModel?.mainFlowState?.primaryAction?.actionId ||
      flowModel?.selectedActionId ||
      '',
    payload: {
      runtimeSimLogCount: flowModel?.runtimeSimLogCount ?? 0,
      fallbackToFirstRuntimePoint: true,
    },
    enabled: enabled ?? Boolean(flowModel?.controls?.canOpenRuntimeResults),
    disabledReason: 'missing-runtime-results',
  });
}

export function createWorkbenchMainFlowNextAction({
  flowModel = null,
  source = '',
  enabled,
} = {}) {
  const loopState = flowModel?.mainFlowLoopState ?? {};
  const primaryAction = flowModel?.mainFlowState?.primaryAction ?? {};
  const nextActionKind =
    loopState.nextActionKind ?? primaryAction.kind ?? '';
  const canRunNextAction =
    enabled ?? Boolean(loopState.canRunNextAction ?? primaryAction.enabled);

  if (nextActionKind === WORKBENCH_FLOW_ACTION_KINDS.OPEN_RUNTIME_RESULTS) {
    return createWorkbenchOpenRuntimeResultsFlowAction({
      flowModel,
      source,
      enabled: canRunNextAction,
    });
  }

  if (nextActionKind === WORKBENCH_FLOW_ACTION_KINDS.FOCUS_RUNTIME_ACTION) {
    return createWorkbenchRuntimeActionEditFlowAction({
      source,
      target: createMainFlowLoopTarget({
        loopState,
        target: flowModel?.mainFlowState?.runtimeActionEditTarget,
      }),
      enabled: canRunNextAction,
    });
  }

  if (nextActionKind === WORKBENCH_FLOW_ACTION_KINDS.RETURN_RUNTIME_RESULT) {
    return createWorkbenchRuntimeResultReturnFlowAction({
      source,
      target: createMainFlowLoopTarget({
        loopState,
        target: flowModel?.mainFlowState?.resultReturnTarget,
      }),
      enabled: canRunNextAction,
    });
  }

  return createWorkbenchFlowAction({
    kind: nextActionKind,
    source,
    actionId: loopState.targetActionId ?? '',
    statePointId: loopState.targetStatePointId ?? '',
    enabled: false,
    disabledReason: 'missing-main-flow-next-action',
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

function createMainFlowLoopTarget({ loopState = {}, target = null } = {}) {
  return {
    ...(target ?? {}),
    actionId: target?.actionId || loopState.targetActionId || '',
    statePointId: target?.statePointId || loopState.targetStatePointId || '',
  };
}
