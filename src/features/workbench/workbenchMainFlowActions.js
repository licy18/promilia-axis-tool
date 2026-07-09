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

export function createWorkbenchMainFlowLoopAction({
  flowModel = null,
  source = '',
  recoverySource = '',
  enabled,
} = {}) {
  const loopState = flowModel?.mainFlowLoopState ?? {};
  if (loopState.recoveryNeeded) {
    return createWorkbenchMainFlowRecoveryAction({
      flowModel,
      source: recoverySource || source,
      enabled,
    });
  }
  return createWorkbenchMainFlowNextAction({
    flowModel,
    source,
    enabled,
  });
}

export function createWorkbenchMainFlowButtonView({
  flowModel = null,
  kind = '',
  fallbackTarget = null,
  fallbackEnabled,
  source = '',
} = {}) {
  const mainFlowState = flowModel?.mainFlowState ?? {};
  const primaryAction = mainFlowState.primaryAction ?? {};
  const isRuntimeReviewPrimary = isRuntimeReviewPrimaryOperationKind(
    flowModel,
    kind
  );
  const isPrimary = primaryAction.kind
    ? primaryAction.kind === kind
    : isRuntimeReviewPrimary;
  const fallback = fallbackTarget ?? {};

  if (isPrimary && isRuntimeReviewPrimary) {
    const consumer = createWorkbenchRuntimeReviewOperationConsumer({
      operationKind: kind,
      flowModel,
      source,
      target: fallback,
      context: fallback,
      enabled: fallbackEnabled,
    });
    return createMainFlowButtonView({
      kind,
      isPrimary,
      target: consumer.target,
      enabled: consumer.enabled,
      action: consumer.action,
    });
  }

  const target = fallbackTarget ?? (isPrimary ? primaryAction : {});
  return createMainFlowButtonView({
    kind,
    isPrimary,
    target,
    enabled:
      fallbackEnabled ??
      target?.enabled ??
      (isPrimary ? primaryAction.enabled : false),
  });
}

export function createWorkbenchMainFlowCommandSurface({
  flowModel = null,
  source = '',
  recoverySource = '',
  runtimeReviewPrimarySource = '',
} = {}) {
  const mainFlowState = flowModel?.mainFlowState ?? {};
  const openRuntimeResults = createWorkbenchMainFlowButtonCommand({
    flowModel,
    kind: WORKBENCH_FLOW_ACTION_KINDS.OPEN_RUNTIME_RESULTS,
    source,
    recoverySource,
    fallbackTarget: mainFlowState.primaryAction,
    fallbackEnabled: flowModel?.controls?.canOpenRuntimeResults,
    createFallbackAction: () =>
      createWorkbenchOpenRuntimeResultsFlowAction({
        flowModel,
        source,
      }),
  });
  const createRuntimeActionEditCommand = (options = {}) =>
    createWorkbenchRuntimeActionEditCommand({
      ...options,
      flowModel: options.flowModel ?? flowModel,
    });
  const runtimeActionEdit = createWorkbenchMainFlowButtonCommand({
    flowModel,
    kind: WORKBENCH_FLOW_ACTION_KINDS.FOCUS_RUNTIME_ACTION,
    source,
    recoverySource,
    fallbackTarget: mainFlowState.runtimeActionEditTarget,
    fallbackEnabled: mainFlowState.canFocusRuntimeAction,
    createFallbackAction: ({ target }) =>
      createRuntimeActionEditCommand({
        source,
        target,
        enabled: Boolean(target?.canFocusAction),
      }).action,
  });
  const createRuntimeResultReturnCommand = (options = {}) =>
    createWorkbenchRuntimeResultReturnCommand({
      ...options,
      flowModel: options.flowModel ?? flowModel,
    });
  const runtimeResultReturn = createWorkbenchMainFlowButtonCommand({
    flowModel,
    kind: WORKBENCH_FLOW_ACTION_KINDS.RETURN_RUNTIME_RESULT,
    source,
    recoverySource,
    fallbackTarget: mainFlowState.resultReturnTarget,
    fallbackEnabled: mainFlowState.canReturnRuntimeResult,
    createFallbackAction: ({ target }) =>
      createRuntimeResultReturnCommand({
        source,
        target,
      }).action,
  });
  const runtimeReviewPrimary = createWorkbenchRuntimeReviewPrimaryOperationCommand(
    {
      flowModel,
      source: runtimeReviewPrimarySource || source,
    }
  );
  const createRuntimeReviewOperationCommand = (options = {}) =>
    createWorkbenchRuntimeReviewOperationCommand({
      ...options,
      flowModel: options.flowModel ?? flowModel,
    });
  const createRuntimeReviewPanelCommandView = (options = {}) =>
    createWorkbenchRuntimeReviewPanelCommandView({
      ...options,
      flowModel: options.flowModel ?? flowModel,
    });
  const createRuntimeReviewFlowAction = (options = {}) =>
    createWorkbenchRuntimeReviewFlowAction(options);
  const createRuntimeSelectionFlowAction = (options = {}) =>
    createWorkbenchRuntimeSelectionFlowAction(options);
  const createRuntimeStatePointFlowAction = (options = {}) =>
    createWorkbenchRuntimeStatePointFlowAction(options);
  const createRuntimeResultFlowAction = (options = {}) =>
    createWorkbenchRuntimeResultFlowAction(options);
  const createFocusEditSourceFlowAction = (options = {}) =>
    createWorkbenchFocusEditSourceFlowAction(options);
  const createContributionPointFlowAction = (options = {}) =>
    createWorkbenchContributionPointFlowAction(options);

  return {
    source,
    recoverySource,
    openRuntimeResults,
    runtimeActionEdit,
    runtimeResultReturn,
    runtimeReviewPrimary,
    buttons: {
      openRuntimeResults,
      runtimeActionEdit,
      runtimeResultReturn,
    },
    actions: {
      openRuntimeResults: openRuntimeResults.action,
      runtimeActionEdit: runtimeActionEdit.action,
      runtimeResultReturn: runtimeResultReturn.action,
      runtimeReviewPrimary: runtimeReviewPrimary.action,
    },
    createRuntimeActionEditCommand,
    createRuntimeReviewOperationCommand,
    createRuntimeReviewPanelCommandView,
    createRuntimeResultReturnCommand,
    createRuntimeReviewFlowAction,
    createRuntimeSelectionFlowAction,
    createRuntimeStatePointFlowAction,
    createRuntimeResultFlowAction,
    createFocusEditSourceFlowAction,
    createContributionPointFlowAction,
  };
}

export function createWorkbenchRuntimeStatePointFlowAction(options = {}) {
  return createRuntimeStatePointFocusFlowAction(options);
}

export function createWorkbenchRuntimeSelectionFlowAction(options = {}) {
  return createWorkbenchRuntimeStatePointFlowAction(options);
}

export function createWorkbenchRuntimeResultFlowAction(options = {}) {
  return createRuntimeResultFocusFlowAction(options);
}

export function createWorkbenchRuntimeReviewFlowActionFromSurface(input = {}) {
  const { mainFlowCommandSurface, options } =
    createMainFlowSurfaceActionOptions(input);
  return (
    mainFlowCommandSurface?.createRuntimeReviewFlowAction?.(options) ??
    createWorkbenchRuntimeReviewFlowAction(options)
  );
}

export function createWorkbenchRuntimeStatePointFlowActionFromSurface(
  input = {}
) {
  const { mainFlowCommandSurface, options } =
    createMainFlowSurfaceActionOptions(input);
  return (
    mainFlowCommandSurface?.createRuntimeStatePointFlowAction?.(options) ??
    createWorkbenchRuntimeStatePointFlowAction(options)
  );
}

export function createWorkbenchRuntimeSelectionFlowActionFromSurface(
  input = {}
) {
  const { mainFlowCommandSurface, options } =
    createMainFlowSurfaceActionOptions(input);
  return (
    mainFlowCommandSurface?.createRuntimeSelectionFlowAction?.(options) ??
    mainFlowCommandSurface?.createRuntimeStatePointFlowAction?.(options) ??
    createWorkbenchRuntimeSelectionFlowAction(options)
  );
}

export function createWorkbenchRuntimeResultFlowActionFromSurface(input = {}) {
  const { mainFlowCommandSurface, options } =
    createMainFlowSurfaceActionOptions(input);
  return (
    mainFlowCommandSurface?.createRuntimeResultFlowAction?.(options) ??
    createWorkbenchRuntimeResultFlowAction(options)
  );
}

export function createWorkbenchFocusEditSourceFlowActionFromSurface(
  input = {}
) {
  const { mainFlowCommandSurface, options } =
    createMainFlowSurfaceActionOptions(input);
  return (
    mainFlowCommandSurface?.createFocusEditSourceFlowAction?.(options) ??
    createWorkbenchFocusEditSourceFlowAction(options)
  );
}

export function createWorkbenchContributionPointFlowActionFromSurface(
  input = {}
) {
  const { mainFlowCommandSurface, options } =
    createMainFlowSurfaceActionOptions(input);
  return (
    mainFlowCommandSurface?.createContributionPointFlowAction?.(options) ??
    createWorkbenchContributionPointFlowAction(options)
  );
}

export function createWorkbenchRuntimeReviewOperationCommandFromSurface(
  input = {}
) {
  const { mainFlowCommandSurface, options } =
    createMainFlowSurfaceActionOptions(input);
  return (
    mainFlowCommandSurface?.createRuntimeReviewOperationCommand?.(options) ??
    createWorkbenchRuntimeReviewOperationCommand(options)
  );
}

export function createWorkbenchRuntimeReviewPanelCommandViewFromSurface(
  input = {}
) {
  const { mainFlowCommandSurface, options } =
    createMainFlowSurfaceActionOptions(input);
  return (
    mainFlowCommandSurface?.createRuntimeReviewPanelCommandView?.(options) ??
    createWorkbenchRuntimeReviewPanelCommandView(options)
  );
}

export function createWorkbenchMainFlowActionSurface({
  mainFlowCommandSurface = null,
} = {}) {
  const bindSurfaceAction = factory => (options = {}) =>
    factory({
      mainFlowCommandSurface,
      ...options,
    });

  return {
    mainFlowCommandSurface,
    createRuntimeReviewFlowAction: bindSurfaceAction(
      createWorkbenchRuntimeReviewFlowActionFromSurface
    ),
    createRuntimeSelectionFlowAction: bindSurfaceAction(
      createWorkbenchRuntimeSelectionFlowActionFromSurface
    ),
    createRuntimeStatePointFlowAction: bindSurfaceAction(
      createWorkbenchRuntimeStatePointFlowActionFromSurface
    ),
    createRuntimeResultFlowAction: bindSurfaceAction(
      createWorkbenchRuntimeResultFlowActionFromSurface
    ),
    createFocusEditSourceFlowAction: bindSurfaceAction(
      createWorkbenchFocusEditSourceFlowActionFromSurface
    ),
    createContributionPointFlowAction: bindSurfaceAction(
      createWorkbenchContributionPointFlowActionFromSurface
    ),
  };
}

export function createWorkbenchFocusEditSourceFlowAction(options = {}) {
  return createWorkbenchFlowAction({
    kind: WORKBENCH_FLOW_ACTION_KINDS.FOCUS_EDIT_SOURCE,
    source: options.source ?? '',
    actionId: options.actionId ?? '',
    fieldKey: options.fieldKey ?? '',
    payload: options.payload ?? null,
    enabled: options.enabled,
    disabledReason: options.disabledReason ?? 'missing-edit-source',
  });
}

export function createWorkbenchContributionPointFlowAction(options = {}) {
  return createWorkbenchFlowAction({
    kind: WORKBENCH_FLOW_ACTION_KINDS.SELECT_CONTRIBUTION_POINT,
    source: options.source ?? '',
    actionId: options.actionId ?? '',
    statePointId: options.statePointId ?? '',
    payload: options.payload ?? null,
    enabled: options.enabled,
    disabledReason:
      options.disabledReason ?? 'missing-contribution-state-point',
  });
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

export function createWorkbenchRuntimeReviewOperationCommand({
  operationKind = '',
  flowModel = null,
  source = '',
  target = null,
  context = null,
  enabled,
  consumer = null,
} = {}) {
  const resolvedConsumer =
    consumer ??
    createWorkbenchRuntimeReviewOperationConsumer({
      operationKind,
      flowModel,
      source,
      target,
      context,
      enabled,
    });
  const resolvedTarget = resolvedConsumer?.target ?? {};
  const resolvedContext = resolvedConsumer?.context ?? resolvedTarget;
  const resolvedOperationKind =
    resolvedConsumer?.operationKind ?? operationKind;
  const view = {
    operationKind: resolvedOperationKind,
    source: resolvedConsumer?.source ?? source,
    enabled: Boolean(resolvedConsumer?.enabled),
    disabledReason:
      resolvedConsumer?.disabledReason ?? 'missing-runtime-review-operation',
    actionId: resolvedTarget.actionId ?? resolvedContext.actionId ?? '',
    statePointId:
      resolvedTarget.statePointId ?? resolvedContext.statePointId ?? '',
    target: resolvedTarget,
    context: resolvedContext,
    action: resolvedConsumer?.action ?? null,
  };
  return {
    ...view,
    view,
  };
}

export function createWorkbenchRuntimeReviewPanelCommandView({
  flowModel = null,
  source = '',
  focusTarget = null,
  returnContext = null,
  focusCommand = null,
  returnCommand = null,
  focusEnabled,
  returnEnabled,
} = {}) {
  const focus =
    focusCommand ??
    createWorkbenchRuntimeActionEditCommand({
      flowModel,
      source,
      target: focusTarget,
      enabled: focusEnabled,
    });
  const returnResult =
    returnCommand ??
    createWorkbenchRuntimeResultReturnCommand({
      flowModel,
      source,
      context: returnContext,
      enabled: returnEnabled,
    });

  return {
    source,
    focus,
    returnResult,
    focusTarget: focus.target,
    returnContext: returnResult.context,
    canFocus: Boolean(focus.enabled),
    canReturn: Boolean(returnResult.enabled),
    actions: {
      focus: focus.action,
      returnResult: returnResult.action,
    },
  };
}

export function createWorkbenchRuntimeActionEditCommand({
  flowModel = null,
  source = '',
  target = null,
  context = null,
  enabled,
} = {}) {
  return createWorkbenchRuntimeReviewOperationCommand({
    operationKind: WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS.FOCUS_ACTION,
    flowModel,
    source,
    target,
    context: context ?? target,
    enabled,
  });
}

export function createWorkbenchRuntimeResultReturnCommand({
  flowModel = null,
  source = '',
  target = null,
  context = null,
  enabled,
} = {}) {
  return createWorkbenchRuntimeReviewOperationCommand({
    operationKind: WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS.RETURN_RESULT,
    flowModel,
    source,
    target,
    context: context ?? target,
    enabled,
  });
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

export function createWorkbenchRuntimeReviewPrimaryOperationView({
  flowModel = null,
  source = '',
  consumer = null,
  operations = null,
  buttonView = null,
} = {}) {
  const resolvedOperations =
    operations ?? flowModel?.runtimeReviewOperations ?? null;
  const operationKind =
    consumer?.operationKind ??
    resolvedOperations?.primaryOperationKind ??
    '';
  const resolvedButtonView =
    buttonView ??
    createWorkbenchMainFlowButtonView({
      flowModel,
      kind: operationKind,
      source,
      fallbackTarget:
        resolvedOperations?.primaryOperation?.target ??
        resolvedOperations?.primaryOperation,
      fallbackEnabled: resolvedOperations?.primaryOperationEnabled,
    });
  const target = resolvedButtonView?.target ?? {};
  return {
    visible: Boolean(resolvedOperations?.canRunAnyOperation),
    operationKind,
    enabled: Boolean(resolvedButtonView?.enabled),
    isFocusAction:
      operationKind === WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS.FOCUS_ACTION,
    actionId: resolvedButtonView?.actionId ?? target.actionId ?? '',
    statePointId: resolvedButtonView?.statePointId ?? target.statePointId ?? '',
    label: resolvedOperations?.primaryOperation?.label ?? '',
    target,
    action: resolvedButtonView?.action ?? consumer?.action ?? null,
    buttonView: resolvedButtonView ?? null,
  };
}

export function createWorkbenchRuntimeReviewPrimaryOperationCommand({
  flowModel = null,
  source = '',
  view = null,
  consumer = null,
  operations = null,
} = {}) {
  const resolvedView =
    view ??
    createWorkbenchRuntimeReviewPrimaryOperationView({
      flowModel,
      source,
      consumer,
      operations,
    });
  return {
    source,
    visible: resolvedView.visible,
    operationKind: resolvedView.operationKind,
    enabled: resolvedView.enabled,
    actionId: resolvedView.actionId,
    statePointId: resolvedView.statePointId,
    label: resolvedView.label,
    target: resolvedView.target,
    view: resolvedView,
    action: resolvedView.action ?? null,
  };
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

function createWorkbenchMainFlowButtonCommand({
  flowModel = null,
  kind = '',
  source = '',
  recoverySource = '',
  fallbackTarget = null,
  fallbackEnabled,
  createFallbackAction,
} = {}) {
  const view = createWorkbenchMainFlowButtonView({
    flowModel,
    kind,
    fallbackTarget,
    fallbackEnabled,
    source,
  });
  const action = view.isPrimary
    ? createWorkbenchMainFlowLoopAction({
        flowModel,
        source,
        recoverySource,
      })
    : (view.action ??
      createFallbackAction?.({ flowModel, target: view.target, view }) ??
      null);
  return {
    ...view,
    view,
    action,
  };
}

function createMainFlowButtonView({
  kind = '',
  isPrimary = false,
  target = null,
  enabled = false,
  action = null,
} = {}) {
  const resolvedTarget = target ?? {};
  return {
    kind,
    isPrimary: Boolean(isPrimary),
    enabled: Boolean(enabled),
    actionId: resolvedTarget.actionId ?? '',
    statePointId: resolvedTarget.statePointId ?? '',
    target: resolvedTarget,
    action,
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

function createMainFlowSurfaceActionOptions(input = {}) {
  const { mainFlowCommandSurface = null, ...options } = input ?? {};
  return {
    mainFlowCommandSurface,
    options,
  };
}
