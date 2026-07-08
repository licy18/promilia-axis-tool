import {
  WORKBENCH_FLOW_ACTION_KINDS,
  createWorkbenchFlowAction,
} from './workbenchFlowModel';
import { createRuntimeActionFocusFlowAction } from './runtimeActionFocusFlowAction';
import {
  createRuntimeResultFocusFlowAction,
  createRuntimeStatePointFocusFlowAction,
} from './runtimeResultFocusFlowAction';

export const WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS = Object.freeze({
  SELECT_STATE_POINT: WORKBENCH_FLOW_ACTION_KINDS.SELECT_RUNTIME_STATE_POINT,
  SELECT_RESULT: WORKBENCH_FLOW_ACTION_KINDS.SELECT_RUNTIME_RESULT,
  FOCUS_ACTION: WORKBENCH_FLOW_ACTION_KINDS.FOCUS_RUNTIME_ACTION,
  RETURN_RESULT: WORKBENCH_FLOW_ACTION_KINDS.RETURN_RUNTIME_RESULT,
});

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

export function createWorkbenchMainFlowRecoveryAction({
  flowModel = null,
  source = '',
  enabled,
} = {}) {
  const loopState = flowModel?.mainFlowLoopState ?? {};
  if (!loopState.recoveryNeeded) {
    return createWorkbenchFlowAction({
      kind:
        loopState.nextActionKind ??
        flowModel?.mainFlowState?.primaryAction?.kind ??
        '',
      source,
      actionId: loopState.targetActionId ?? '',
      statePointId: loopState.targetStatePointId ?? '',
      enabled: false,
      disabledReason: 'main-flow-recovery-not-needed',
    });
  }
  return createWorkbenchMainFlowNextAction({
    flowModel,
    source,
    enabled: enabled ?? Boolean(loopState.canRunNextAction),
  });
}

export function createWorkbenchRuntimeStatePointFlowAction(options = {}) {
  return createRuntimeStatePointFocusFlowAction(options);
}

export function createWorkbenchRuntimeResultFlowAction(options = {}) {
  return createRuntimeResultFocusFlowAction(options);
}

export function createWorkbenchRuntimeReviewFlowAction({
  kind = '',
  source = '',
  detail = null,
  target = null,
  context = null,
  actionId = '',
  statePointId = '',
  payload,
  enabled,
  disabledReason,
} = {}) {
  if (
    kind === WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.SELECT_STATE_POINT
  ) {
    return createWorkbenchRuntimeStatePointFlowAction({
      source,
      detail,
      actionId,
      statePointId,
      payload,
      enabled,
      disabledReason,
    });
  }

  if (kind === WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.SELECT_RESULT) {
    return createWorkbenchRuntimeResultFlowAction({
      source,
      detail,
      actionId,
      statePointId,
      payload,
      enabled,
      disabledReason,
    });
  }

  if (kind === WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.FOCUS_ACTION) {
    return createWorkbenchRuntimeActionEditFlowAction({
      source,
      target: target ?? detail,
      enabled,
      disabledReason,
    });
  }

  if (kind === WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.RETURN_RESULT) {
    return createWorkbenchRuntimeResultReturnFlowAction({
      source,
      target: target ?? context ?? detail,
      enabled,
      disabledReason,
    });
  }

  return createWorkbenchFlowAction({
    kind,
    source,
    actionId: actionId ?? '',
    statePointId: statePointId ?? '',
    payload: payload ?? target ?? context ?? detail ?? null,
    enabled: false,
    disabledReason: 'unsupported-runtime-review-flow-action',
  });
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
