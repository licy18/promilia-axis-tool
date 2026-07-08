import {
  WORKBENCH_FLOW_ACTION_KINDS,
  WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS,
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
    if (isRuntimeReviewPrimaryOperationKind(flowModel, nextActionKind)) {
      return createWorkbenchRuntimeReviewPrimaryOperationFlowAction({
        flowModel,
        source,
        enabled: canRunNextAction,
      });
    }
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
    if (isRuntimeReviewPrimaryOperationKind(flowModel, nextActionKind)) {
      return createWorkbenchRuntimeReviewPrimaryOperationFlowAction({
        flowModel,
        source,
        enabled: canRunNextAction,
      });
    }
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

export function createWorkbenchRuntimeReviewOperationFlowAction({
  operationKind = '',
  flowModel = null,
  source = '',
  target = null,
  context = null,
  enabled,
} = {}) {
  return createWorkbenchRuntimeReviewOperationConsumer({
    operationKind,
    flowModel,
    source,
    target,
    context,
    enabled,
  }).action;
}

export function createWorkbenchRuntimeReviewOperationConsumer({
  operationKind = '',
  flowModel = null,
  source = '',
  target = null,
  context = null,
  enabled,
} = {}) {
  const operations = flowModel?.runtimeReviewOperations ?? null;
  const resolvedOperationKind =
    operationKind || operations?.primaryOperationKind || '';
  const operationTarget = resolveRuntimeReviewOperationTarget({
    operations,
    operationKind: resolvedOperationKind,
    fallbackTarget: target ?? context,
  });
  const operationEnabled = resolveRuntimeReviewOperationEnabled({
    operationKind: resolvedOperationKind,
    operationTarget,
    enabled,
  });
  const disabledReason =
    operationTarget?.disabledReason || 'missing-runtime-review-operation';

  let action;

  if (
    resolvedOperationKind ===
    WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS.FOCUS_ACTION
  ) {
    action = createWorkbenchRuntimeReviewFlowAction({
      kind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.FOCUS_ACTION,
      source,
      target: operationTarget,
      enabled: operationEnabled,
      disabledReason,
    });
  } else if (
    resolvedOperationKind ===
    WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS.RETURN_RESULT
  ) {
    action = createWorkbenchRuntimeReviewFlowAction({
      kind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.RETURN_RESULT,
      source,
      context: operationTarget,
      enabled: operationEnabled,
      disabledReason,
    });
  } else {
    action = createWorkbenchFlowAction({
      kind: resolvedOperationKind,
      source,
      actionId: operationTarget?.actionId ?? '',
      statePointId:
        operationTarget?.statePointId ??
        operations?.selectedStatePointId ??
        operations?.pendingStatePointId ??
        '',
      payload: operationTarget ?? operations ?? null,
      enabled: false,
      disabledReason,
    });
  }

  return {
    operationKind: resolvedOperationKind,
    source,
    target: operationTarget ?? {},
    context: operationTarget ?? {},
    enabled: operationEnabled,
    disabledReason,
    action,
  };
}

export function createWorkbenchRuntimeReviewPrimaryOperationFlowAction({
  flowModel = null,
  source = '',
  enabled,
} = {}) {
  const operations = flowModel?.runtimeReviewOperations ?? null;
  return createWorkbenchRuntimeReviewOperationFlowAction({
    operationKind: operations?.primaryOperationKind ?? '',
    flowModel,
    source,
    enabled: enabled ?? operations?.primaryOperationEnabled,
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

function getRuntimeReviewOperationTarget({
  operations = null,
  operationKind = '',
} = {}) {
  if (
    operationKind === WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS.FOCUS_ACTION
  ) {
    return operations?.focusAction ?? null;
  }

  if (
    operationKind === WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS.RETURN_RESULT
  ) {
    return operations?.returnResult ?? null;
  }

  return null;
}

function resolveRuntimeReviewOperationTarget({
  operations = null,
  operationKind = '',
  fallbackTarget = null,
} = {}) {
  const primaryOperation = operations?.primaryOperation ?? null;
  const primaryOperationTarget = primaryOperation?.target ?? primaryOperation;
  const modelOperation = getRuntimeReviewOperationTarget({
    operations,
    operationKind,
  });
  if (
    primaryOperation?.kind === operationKind &&
    hasRuntimeReviewOperationPayload(primaryOperationTarget)
  ) {
    return primaryOperationTarget;
  }
  if (hasRuntimeReviewOperationPayload(modelOperation)) {
    return modelOperation;
  }
  if (hasRuntimeReviewOperationPayload(fallbackTarget)) {
    return fallbackTarget;
  }
  if (
    primaryOperation?.kind === operationKind &&
    hasRuntimeReviewOperationShape(primaryOperationTarget)
  ) {
    return primaryOperationTarget;
  }
  if (hasRuntimeReviewOperationShape(modelOperation)) {
    return modelOperation;
  }
  if (hasRuntimeReviewOperationShape(fallbackTarget)) {
    return fallbackTarget;
  }
  return null;
}

function resolveRuntimeReviewOperationEnabled({
  operationKind = '',
  operationTarget = null,
  enabled,
} = {}) {
  if (enabled != null) {
    return Boolean(enabled);
  }
  if (operationTarget?.enabled != null) {
    return Boolean(operationTarget.enabled);
  }
  if (
    operationKind === WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS.FOCUS_ACTION
  ) {
    return Boolean(operationTarget?.canFocusAction ?? operationTarget?.actionId);
  }
  if (
    operationKind === WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS.RETURN_RESULT
  ) {
    return Boolean(operationTarget?.canReturn ?? operationTarget?.statePointId);
  }
  return false;
}

function hasRuntimeReviewOperationPayload(target = null) {
  return Boolean(
    target &&
      (target.actionId ||
        target.statePointId ||
        target.originStatePointId ||
        target.canFocusAction ||
        target.canReturn)
  );
}

function hasRuntimeReviewOperationShape(target = null) {
  return Boolean(target && Object.keys(target).length);
}

function isRuntimeReviewPrimaryOperationKind(flowModel = null, actionKind = '') {
  return Boolean(
    actionKind &&
      flowModel?.runtimeReviewOperations?.primaryOperationKind === actionKind
  );
}
