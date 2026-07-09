import {
  createRuntimeStatePointContexts,
  getRuntimeOutputSummary,
  getRuntimeSimLogCount,
} from './runtimeProjectionPoints';
import { createRuntimeResultReturnContext } from './runtimeResultReturnContext';
import { createRuntimeFocusSourceView } from './runtimeFocusSource';
import { createWorkbenchFlowContractContext } from './workbenchFlowContractContext';

export const WORKBENCH_FLOW_PHASES = Object.freeze({
  ACTION_EDIT: 'action-edit',
  RUNTIME_OVERVIEW: 'runtime-overview',
  RUNTIME_RESULT: 'runtime-result',
  EDIT_RESULT_READY: 'edit-result-ready',
  EDIT_RESULT_REVIEW: 'edit-result-review',
});

export const WORKBENCH_FLOW_ACTION_KINDS = Object.freeze({
  OPEN_RUNTIME_RESULTS: 'open-runtime-results',
  SELECT_RUNTIME_RESULT: 'select-runtime-result',
  SELECT_RUNTIME_STATE_POINT: 'select-runtime-state-point',
  SELECT_CONTRIBUTION_POINT: 'select-contribution-point',
  FOCUS_RUNTIME_ACTION: 'focus-runtime-action',
  FOCUS_EDIT_SOURCE: 'focus-edit-source',
  RETURN_RUNTIME_RESULT: 'return-runtime-result',
});

export const WORKBENCH_FLOW_PRIMARY_ACTION_KEYS = Object.freeze({
  OPEN_RUNTIME_RESULTS: 'open-runtime-results',
  FOCUS_RUNTIME_ACTION: 'focus-runtime-action',
  RETURN_RUNTIME_RESULT: 'return-runtime-result',
});

export const WORKBENCH_MAIN_FLOW_REGIONS = Object.freeze({
  ACTION_EDIT: 'action-edit',
  RUNTIME_REVIEW: 'runtime-review',
});

export const WORKBENCH_MAIN_FLOW_LOOP_STATUSES = Object.freeze({
  READY: 'ready',
  ADVANCED: 'advanced',
  BLOCKED: 'blocked',
});

export const WORKBENCH_MAIN_FLOW_LOOP_STEPS = Object.freeze({
  ACTION_EDIT: 'action-edit',
  RUNTIME_OVERVIEW: 'runtime-overview',
  RUNTIME_REVIEW: 'runtime-review',
  EDIT_RESULT_READY: 'edit-result-ready',
  EDIT_RESULT_REVIEW: 'edit-result-review',
});

export const WORKBENCH_RUNTIME_REVIEW_SELECTION_STATUSES = Object.freeze({
  EMPTY: 'empty',
  OVERVIEW: 'overview',
  SELECTED: 'selected',
  PENDING_RESULT: 'pending-result',
});

export const WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS = Object.freeze({
  FOCUS_ACTION: WORKBENCH_FLOW_ACTION_KINDS.FOCUS_RUNTIME_ACTION,
  RETURN_RESULT: WORKBENCH_FLOW_ACTION_KINDS.RETURN_RUNTIME_RESULT,
});

export function createWorkbenchFlowAction({
  kind = '',
  source = '',
  actionId = '',
  statePointId = '',
  fieldKey = '',
  payload = null,
  enabled,
  disabledReason = '',
} = {}) {
  const canRun =
    enabled ??
    Boolean(kind && (statePointId || actionId || fieldKey || payload));
  return {
    kind,
    source,
    actionId: actionId ?? '',
    statePointId: statePointId ?? '',
    fieldKey: fieldKey ?? '',
    payload,
    canRun,
    disabledReason: canRun
      ? ''
      : disabledReason || 'missing-flow-action-target',
  };
}

export function createWorkbenchFlowModel({
  selectedAction = null,
  generationBundle = null,
  runtimeProjection = null,
  runtimeSelectedDetail = null,
  selectedStateCurvePointId = '',
  runtimeFocusSource = '',
  runtimeOverviewActive = false,
  actionEditFocus = null,
  actionEditResultContext = null,
  flowDispatchState = null,
} = {}) {
  const runtimeNavigationPoints =
    createRuntimeStatePointContexts(runtimeProjection);
  const selectedRuntimeNavigationIndex = runtimeNavigationPoints.findIndex(
    point => point.statePointId === selectedStateCurvePointId
  );
  const runtimeDetail = createWorkbenchFlowRuntimeDetail(
    runtimeSelectedDetail
  );
  const editResult = createWorkbenchFlowEditResult(actionEditResultContext);
  const runtimeActionEditTarget =
    createWorkbenchFlowRuntimeActionEditTarget(runtimeDetail);
  const runtimeResultReturnTarget =
    createWorkbenchFlowRuntimeResultReturnTarget({
      actionEditFocus,
      editResult,
      runtimeActionEditTarget,
      selectedActionId: selectedAction?.id ?? '',
    });
  const runtimeSimLogCount = getRuntimeSimLogCount(runtimeProjection);
  const contractContext = createWorkbenchFlowContractContext({
    generationBundle,
    runtimeProjection,
  });
  const phase = resolveWorkbenchFlowPhase({
    runtimeDetail,
    editResult,
    runtimeOverviewActive,
  });
  const controls = {
    canOpenRuntimeResults:
      contractContext.runtimeOutput.ready && runtimeSimLogCount > 0,
    canFocusRuntimeAction: runtimeDetail.canFocusAction,
    canReturnRuntimeResult: editResult.canReturn,
  };
  const primaryAction = createWorkbenchFlowPrimaryAction({
    phase,
    selectedActionId: selectedAction?.id ?? '',
    controls,
    runtimeDetail,
    editResult,
  });
  const mainFlowState = createWorkbenchMainFlowState({
    phase,
    primaryAction,
    runtimeDetail,
    runtimeActionEditTarget,
    editResult,
    runtimeResultReturnTarget,
  });
  const mainFlowSelection = createWorkbenchMainFlowSelection({
    phase,
    selectedAction,
    selectedStateCurvePointId,
    runtimeFocusSource,
    runtimeOverviewActive,
    runtimeDetail,
    editResult,
    mainFlowState,
  });
  const mainFlowDispatchResult =
    createWorkbenchMainFlowDispatchResult(flowDispatchState);
  const runtimeReviewSelection = createWorkbenchRuntimeReviewSelection({
    phase,
    runtimeDetail,
    editResult,
    selectedStateCurvePointId,
    runtimeFocusSource,
    runtimeOverviewActive,
    runtimeActionEditTarget,
    runtimeResultReturnTarget,
    mainFlowDispatchResult,
  });
  const runtimeReviewOperations = createWorkbenchRuntimeReviewOperations({
    runtimeReviewSelection,
    runtimeActionEditTarget,
    runtimeResultReturnTarget: mainFlowState.resultReturnTarget,
  });
  const runtimeReviewContextView = createWorkbenchRuntimeReviewContextView({
    runtimeReviewSelection,
    runtimeDetail,
    selectedStateCurvePointId,
  });
  const runtimeReviewPanelView = createWorkbenchRuntimeReviewPanelView({
    runtimeReviewContextView,
    runtimeReviewOperations,
    runtimeDetail,
    resultReturnContext:
      runtimeResultReturnTarget ??
      (runtimeReviewContextView.hasPendingResult
        ? mainFlowState.resultReturnTarget
        : null),
  });
  const mainFlowLoopState = createWorkbenchMainFlowLoopState({
    phase,
    mainFlowState,
    mainFlowSelection,
    mainFlowDispatchResult,
  });

  return {
    phase,
    selectedAction,
    selectedActionId: selectedAction?.id ?? '',
    selectedActionName: selectedAction?.name ?? '未选动作',
    selectedStateCurvePointId: selectedStateCurvePointId ?? '',
    runtimeFocusSource: runtimeFocusSource ?? '',
    runtimeOverviewActive: Boolean(runtimeOverviewActive),
    contractContext,
    runtimeSummary: getRuntimeOutputSummary(runtimeProjection),
    runtimeSimLogCount,
    runtimeDetail,
    runtimeActionEditTarget,
    editResult,
    runtimeResultReturnTarget,
    primaryAction,
    mainFlowState,
    mainFlowSelection,
    mainFlowDispatchResult,
    mainFlowLoopState,
    runtimeReviewSelection,
    runtimeReviewOperations,
    runtimeReviewContextView,
    runtimeReviewPanelView,
    runtimeNavigation: {
      points: runtimeNavigationPoints,
      count: runtimeNavigationPoints.length,
      index: selectedRuntimeNavigationIndex,
      previous: getRuntimeNavigationPrevious({
        runtimeNavigationPoints,
        selectedRuntimeNavigationIndex,
        runtimeOverviewActive,
      }),
      next: getRuntimeNavigationNext({
        runtimeNavigationPoints,
        selectedRuntimeNavigationIndex,
        runtimeOverviewActive,
      }),
      label: formatRuntimeNavigationLabel({
        total: runtimeNavigationPoints.length,
        selectedRuntimeNavigationIndex,
      }),
    },
    controls,
  };
}

export function createWorkbenchMainFlowDispatchResult(dispatchState = null) {
  const sequence = Number(dispatchState?.sequence ?? 0);
  const hasResult = Number.isFinite(sequence) && sequence > 0;
  const handled = Boolean(dispatchState?.handled);
  return {
    sequence: hasResult ? sequence : 0,
    status: hasResult ? (handled ? 'handled' : 'failed') : 'idle',
    handled,
    hasResult,
    kind: dispatchState?.kind ?? '',
    source: dispatchState?.source ?? '',
    handlerKey: dispatchState?.handlerKey ?? '',
    reason: dispatchState?.reason ?? '',
    actionId: dispatchState?.actionId ?? '',
    statePointId: dispatchState?.statePointId ?? '',
  };
}

export function createWorkbenchMainFlowStatusView({
  flowModel = null,
  mainFlowDispatchResult = null,
  mainFlowLoopState = null,
} = {}) {
  const dispatch =
    mainFlowDispatchResult ?? flowModel?.mainFlowDispatchResult ?? {};
  const loop = mainFlowLoopState ?? flowModel?.mainFlowLoopState ?? {};
  return {
    dispatch: {
      sequence: Number(dispatch.sequence ?? 0) || 0,
      status: dispatch.status ?? 'idle',
      handled: Boolean(dispatch.handled),
      handledState: dispatch.handled ? 'true' : 'false',
      hasResult: Boolean(dispatch.hasResult),
      hasResultState: dispatch.hasResult ? 'true' : 'false',
      kind: dispatch.kind ?? '',
      source: dispatch.source ?? '',
      handlerKey: dispatch.handlerKey ?? '',
      reason: dispatch.reason ?? '',
      actionId: dispatch.actionId ?? '',
      statePointId: dispatch.statePointId ?? '',
    },
    loop: {
      step: loop.step ?? '',
      status: loop.status ?? '',
      recoveryNeeded: Boolean(loop.recoveryNeeded),
      recoveryNeededState: loop.recoveryNeeded ? 'true' : 'false',
      nextActionKind: loop.nextActionKind ?? '',
      nextTargetKind: loop.nextTargetKind ?? '',
      currentRegion: loop.currentRegion ?? '',
      nextRegion: loop.nextRegion ?? '',
    },
  };
}

export function createWorkbenchRuntimeReviewFlowView({
  flowModel = null,
  mainFlowSelection = null,
  mainFlowState = null,
  runtimeReviewSelection = null,
  runtimeReviewOperations = null,
} = {}) {
  const selectionModel =
    mainFlowSelection ?? flowModel?.mainFlowSelection ?? {};
  const stateModel = mainFlowState ?? flowModel?.mainFlowState ?? {};
  const reviewSelection =
    runtimeReviewSelection ?? flowModel?.runtimeReviewSelection ?? {};
  const operations =
    runtimeReviewOperations ?? flowModel?.runtimeReviewOperations ?? {};
  const primaryOperation = operations.primaryOperation ?? {};
  const focusAction = operations.focusAction ?? {};
  const returnResult = operations.returnResult ?? {};
  const sourceView = createRuntimeReviewSourceView({
    source: reviewSelection.source,
    sourceView: reviewSelection.sourceView,
  });

  return {
    region: {
      currentRegion: selectionModel.currentRegion ?? '',
      nextRegion: selectionModel.nextRegion ?? '',
      nextTargetKind: stateModel.nextTargetKind ?? '',
      inspectorMode: selectionModel.inspectorMode ?? '',
      selectedActionId: selectionModel.selectedActionId ?? '',
      selectedRuntimeStatePointId:
        selectionModel.selectedRuntimeStatePointId ?? '',
      pendingRuntimeStatePointId:
        selectionModel.pendingRuntimeStatePointId ?? '',
      refreshedRuntimeStatePointId:
        selectionModel.refreshedRuntimeStatePointId ?? '',
    },
    selection: {
      status:
        reviewSelection.status ??
        WORKBENCH_RUNTIME_REVIEW_SELECTION_STATUSES.EMPTY,
      selectedActionId: reviewSelection.selectedActionId ?? '',
      selectedStatePointId: reviewSelection.selectedStatePointId ?? '',
      pendingActionId: reviewSelection.pendingActionId ?? '',
      pendingStatePointId: reviewSelection.pendingStatePointId ?? '',
      refreshedStatePointId: reviewSelection.refreshedStatePointId ?? '',
      source: sourceView.source,
      sourceKind: sourceView.sourceKind,
      sourceView,
      lastActionKind: reviewSelection.lastActionKind ?? '',
      lastActionSource: reviewSelection.lastActionSource ?? '',
      hasSelection: Boolean(reviewSelection.hasSelection),
      hasSelectionState: reviewSelection.hasSelection ? 'true' : 'false',
      hasPendingResult: Boolean(reviewSelection.hasPendingResult),
      hasPendingResultState: reviewSelection.hasPendingResult
        ? 'true'
        : 'false',
      overviewActive: Boolean(reviewSelection.overviewActive),
      overviewActiveState: reviewSelection.overviewActive ? 'true' : 'false',
    },
    operations: {
      primaryOperationKind: operations.primaryOperationKind ?? '',
      primaryOperationEnabled: Boolean(operations.primaryOperationEnabled),
      primaryOperationEnabledState: operations.primaryOperationEnabled
        ? 'true'
        : 'false',
      canRunAnyOperation: Boolean(operations.canRunAnyOperation),
      canRunAnyOperationState: operations.canRunAnyOperation
        ? 'true'
        : 'false',
      primaryActionId: primaryOperation.actionId ?? '',
      primaryStatePointId: primaryOperation.statePointId ?? '',
      primaryLabel: primaryOperation.label ?? '',
      focusActionEnabled: Boolean(focusAction.enabled),
      focusActionEnabledState: focusAction.enabled ? 'true' : 'false',
      returnResultEnabled: Boolean(returnResult.enabled),
      returnResultEnabledState: returnResult.enabled ? 'true' : 'false',
    },
  };
}

export function createWorkbenchRuntimeReviewContextView({
  flowModel = null,
  runtimeReviewSelection = null,
  runtimeDetail = null,
  selectedStateCurvePointId = '',
} = {}) {
  const selection =
    runtimeReviewSelection ?? flowModel?.runtimeReviewSelection ?? {};
  const mainFlowSelection = flowModel?.mainFlowSelection ?? {};
  const detail = runtimeDetail ?? flowModel?.runtimeDetail ?? null;
  const detailStatePointId = detail?.statePointId ?? '';
  const selectedStatePointId =
    pickRuntimeReviewContextValue(
      selection.selectedStatePointId,
      mainFlowSelection.selectedStateCurvePointId,
      mainFlowSelection.selectedRuntimeStatePointId,
      selectedStateCurvePointId,
      flowModel?.selectedStateCurvePointId,
      detailStatePointId
    ) ?? '';
  const hasSelection = Boolean(selection.hasSelection ?? selectedStatePointId);
  const detailSynced = Boolean(
    !detailStatePointId ||
      !selectedStatePointId ||
      detailStatePointId === selectedStatePointId
  );
  const source = pickRuntimeReviewContextValue(
    selection.source,
    mainFlowSelection.runtimeFocusSource
  );
  const sourceView = createRuntimeReviewSourceView({
    source,
    sourceView: selection.sourceView,
  });
  const selectedActionId =
    pickRuntimeReviewContextValue(
      selection.selectedActionId,
      mainFlowSelection.selectedActionId,
      detail?.actionId
    ) ?? '';

  return {
    status:
      selection.status ?? WORKBENCH_RUNTIME_REVIEW_SELECTION_STATUSES.EMPTY,
    selectedActionId,
    selectedStatePointId,
    pendingActionId: selection.pendingActionId ?? '',
    pendingStatePointId: selection.pendingStatePointId ?? '',
    refreshedStatePointId: selection.refreshedStatePointId ?? '',
    source: sourceView.source,
    sourceKind: sourceView.sourceKind,
    sourceView,
    hasSelection,
    hasSelectionState: hasSelection ? 'true' : 'false',
    hasPendingResult: Boolean(selection.hasPendingResult),
    hasPendingResultState: selection.hasPendingResult ? 'true' : 'false',
    overviewActive: Boolean(selection.overviewActive),
    overviewActiveState: selection.overviewActive ? 'true' : 'false',
    detailStatePointId,
    detailSynced,
    detailSyncedState: detailSynced ? 'true' : 'false',
  };
}

function pickRuntimeReviewContextValue(...values) {
  return values.find(value => value != null && value !== '');
}

export function createWorkbenchRuntimeReviewPanelView({
  flowModel = null,
  runtimeReviewContextView = null,
  runtimeReviewOperations = null,
  runtimeReviewSelection = null,
  runtimeDetail = null,
  resultReturnContext = null,
  selectedStateCurvePointId = '',
} = {}) {
  const baseContext =
    runtimeReviewContextView ??
    flowModel?.runtimeReviewContextView ??
    createWorkbenchRuntimeReviewContextView({
      flowModel,
      runtimeReviewSelection,
      runtimeDetail,
      selectedStateCurvePointId,
    });
  const sourceView = createRuntimeReviewSourceView({
    source: baseContext.source,
    sourceView: baseContext.sourceView,
  });
  const context = {
    ...baseContext,
    source: sourceView.source,
    sourceKind: sourceView.sourceKind,
    sourceView,
  };
  const operations =
    runtimeReviewOperations ?? flowModel?.runtimeReviewOperations ?? {};
  const focusAction = operations.focusAction ?? {};
  const returnResult = operations.returnResult ?? {};
  const detailModel = runtimeDetail ?? flowModel?.runtimeDetail ?? {};
  const selectedDetail = detailModel?.source ?? null;
  const returnContext =
    resultReturnContext ??
    flowModel?.runtimeResultReturnTarget ??
    (context.hasPendingResult
      ? flowModel?.mainFlowState?.resultReturnTarget
      : null) ??
    null;

  return {
    context,
    operations,
    sourceView,
    runtimeDetail: detailModel ?? null,
    selectedDetail,
    selectedDetailStatePointId:
      selectedDetail?.statePointId ?? detailModel?.statePointId ?? '',
    hasSelectedDetail: Boolean(selectedDetail ?? detailModel?.statePointId),
    hasSelectedDetailState:
      selectedDetail || detailModel?.statePointId ? 'true' : 'false',
    resultReturnContext: returnContext,
    resultReturnActionId: returnContext?.actionId ?? '',
    resultReturnStatePointId: returnContext?.statePointId ?? '',
    hasResultReturnContext: Boolean(returnContext?.statePointId),
    hasResultReturnContextState: returnContext?.statePointId
      ? 'true'
      : 'false',
    status:
      context.status ?? WORKBENCH_RUNTIME_REVIEW_SELECTION_STATUSES.EMPTY,
    selectedActionId: context.selectedActionId ?? '',
    selectedStatePointId: context.selectedStatePointId ?? '',
    source: sourceView.source,
    sourceKind: sourceView.sourceKind,
    detailSyncedState: context.detailSyncedState ?? '',
    primaryOperationKind: operations.primaryOperationKind ?? '',
    primaryOperationEnabled: Boolean(operations.primaryOperationEnabled),
    primaryOperationEnabledState: operations.primaryOperationEnabled
      ? 'true'
      : 'false',
    focusActionEnabled: Boolean(focusAction.enabled),
    focusActionEnabledState: focusAction.enabled ? 'true' : 'false',
    returnResultEnabled: Boolean(returnResult.enabled),
    returnResultEnabledState: returnResult.enabled ? 'true' : 'false',
    canRunAnyOperation: Boolean(operations.canRunAnyOperation),
    canRunAnyOperationState: operations.canRunAnyOperation ? 'true' : 'false',
  };
}

function createRuntimeReviewSourceView({
  source = '',
  sourceView = null,
} = {}) {
  const normalizedSource = source ?? '';
  if (sourceView?.source === normalizedSource) {
    return sourceView;
  }
  return createRuntimeFocusSourceView(normalizedSource);
}

export function createWorkbenchMainFlowLoopState({
  phase = '',
  mainFlowState = null,
  mainFlowSelection = null,
  mainFlowDispatchResult = null,
} = {}) {
  const primaryAction = mainFlowState?.primaryAction ?? {};
  const dispatchStatus = mainFlowDispatchResult?.status ?? 'idle';
  const recoveryNeeded = dispatchStatus === 'failed';
  return {
    step: resolveMainFlowLoopStep(phase),
    status: resolveMainFlowLoopStatus(mainFlowDispatchResult),
    recoveryNeeded,
    currentRegion: mainFlowSelection?.currentRegion ?? '',
    nextRegion: mainFlowSelection?.nextRegion ?? '',
    nextActionKind: primaryAction.kind ?? '',
    nextTargetKind: mainFlowState?.nextTargetKind ?? '',
    canRunNextAction: Boolean(primaryAction.enabled),
    targetActionId: primaryAction.actionId ?? '',
    targetStatePointId: primaryAction.statePointId ?? '',
    lastDispatchStatus: dispatchStatus,
    lastDispatchKind: mainFlowDispatchResult?.kind ?? '',
    lastDispatchHandled: Boolean(mainFlowDispatchResult?.handled),
    lastDispatchReason: recoveryNeeded
      ? (mainFlowDispatchResult?.reason ?? '')
      : '',
  };
}

export function createWorkbenchRuntimeReviewSelection({
  phase = '',
  runtimeDetail = null,
  editResult = null,
  selectedStateCurvePointId = '',
  runtimeFocusSource = '',
  runtimeOverviewActive = false,
  runtimeActionEditTarget = null,
  runtimeResultReturnTarget = null,
  mainFlowDispatchResult = null,
} = {}) {
  const selectedStatePointId =
    runtimeDetail?.statePointId ?? selectedStateCurvePointId ?? '';
  const pendingStatePointId =
    editResult?.statePointId && editResult.statePointId !== selectedStatePointId
      ? editResult.statePointId
      : '';
  const lastReviewAction = createRuntimeReviewLastAction(
    mainFlowDispatchResult
  );
  const sourceView = createRuntimeFocusSourceView(runtimeFocusSource);
  return {
    phase,
    status: resolveRuntimeReviewSelectionStatus({
      selectedStatePointId,
      pendingStatePointId,
      runtimeOverviewActive,
    }),
    selectedActionId: runtimeDetail?.actionId ?? '',
    selectedStatePointId,
    pendingActionId: pendingStatePointId ? (editResult?.actionId ?? '') : '',
    pendingStatePointId,
    refreshedStatePointId: editResult?.statePointId ?? '',
    source: sourceView.source,
    sourceKind: sourceView.sourceKind,
    sourceView,
    frameLabel: runtimeDetail?.frameLabel ?? '',
    timeMs: runtimeDetail?.timeMs ?? null,
    trackKey: runtimeDetail?.trackKey ?? '',
    trackLabel: runtimeDetail?.trackLabel ?? '',
    hasSelection: Boolean(selectedStatePointId),
    hasPendingResult: Boolean(pendingStatePointId),
    overviewActive: Boolean(runtimeOverviewActive && !selectedStatePointId),
    canFocusAction: Boolean(runtimeActionEditTarget?.canFocusAction),
    canReturnResult: Boolean(runtimeResultReturnTarget?.statePointId),
    actionEditTargetActionId: runtimeActionEditTarget?.actionId ?? '',
    actionEditTargetStatePointId: runtimeActionEditTarget?.statePointId ?? '',
    resultReturnActionId: runtimeResultReturnTarget?.actionId ?? '',
    resultReturnStatePointId: runtimeResultReturnTarget?.statePointId ?? '',
    lastActionKind: lastReviewAction.kind,
    lastActionSource: lastReviewAction.source,
    lastActionHandled: lastReviewAction.handled,
    lastActionStatePointId: lastReviewAction.statePointId,
  };
}

export function createWorkbenchRuntimeReviewOperations({
  runtimeReviewSelection = null,
  runtimeActionEditTarget = null,
  runtimeResultReturnTarget = null,
} = {}) {
  const focusAction = createRuntimeReviewFocusActionOperation({
    runtimeReviewSelection,
    runtimeActionEditTarget,
  });
  const returnResult = createRuntimeReviewReturnResultOperation({
    runtimeReviewSelection,
    runtimeResultReturnTarget,
  });
  const primaryOperationKind = resolveRuntimeReviewPrimaryOperationKind({
    runtimeReviewSelection,
    focusAction,
    returnResult,
  });
  const primaryOperation = createRuntimeReviewPrimaryOperation({
    primaryOperationKind,
    focusAction,
    returnResult,
  });
  return {
    primaryOperationKind,
    primaryOperationEnabled: primaryOperation.enabled,
    canRunAnyOperation: Boolean(focusAction.enabled || returnResult.enabled),
    selectionStatus: runtimeReviewSelection?.status ?? '',
    selectedStatePointId: runtimeReviewSelection?.selectedStatePointId ?? '',
    pendingStatePointId: runtimeReviewSelection?.pendingStatePointId ?? '',
    primaryOperation,
    focusAction,
    returnResult,
  };
}

function createWorkbenchFlowRuntimeDetail(detail) {
  const actionId = detail?.actionId ?? '';
  const statePointId = detail?.statePointId ?? '';
  return {
    source: detail ?? null,
    actionId,
    statePointId,
    frameLabel: detail?.frameLabel ?? '',
    timeMs: detail?.timeMs ?? null,
    trackKey: detail?.trackKey ?? '',
    trackLabel: detail?.trackLabel ?? '',
    label: detail
      ? [detail.frameLabel, detail.trackLabel || detail.trackKey]
          .filter(Boolean)
          .join(' · ')
      : '未选中',
    canFocusAction: Boolean(actionId),
  };
}

export function createWorkbenchFlowRuntimeActionEditTarget(runtimeDetail) {
  const actionId = runtimeDetail?.actionId ?? '';
  const statePointId = runtimeDetail?.statePointId ?? '';
  const frameLabel =
    runtimeDetail?.frameLabel || `${runtimeDetail?.timeMs ?? 0}ms`;
  return {
    actionId,
    fieldKey: 'startMs',
    frameLabel,
    statePointId,
    trackKey: runtimeDetail?.trackKey ?? '',
    trackLabel: runtimeDetail?.trackLabel ?? '',
    label: runtimeDetail?.label ?? '',
    canFocusAction: Boolean(actionId),
  };
}

export function createWorkbenchFlowRuntimeResultReturnTarget({
  actionEditFocus = null,
  editResult = null,
  runtimeActionEditTarget = null,
  selectedActionId = '',
} = {}) {
  const actionId =
    runtimeActionEditTarget?.actionId ||
    selectedActionId ||
    editResult?.actionId ||
    '';
  const originStatePointId =
    runtimeActionEditTarget?.statePointId &&
    runtimeActionEditTarget.statePointId === actionEditFocus?.originStatePointId
      ? runtimeActionEditTarget.statePointId
      : '';
  return createRuntimeResultReturnContext({
    actionId,
    focus: actionEditFocus,
    resultContext: editResult,
    originStatePointId,
  });
}

export function createWorkbenchMainFlowState({
  phase = '',
  primaryAction = null,
  runtimeDetail = null,
  runtimeActionEditTarget = null,
  editResult = null,
  runtimeResultReturnTarget = null,
} = {}) {
  const resultReturnTarget = runtimeResultReturnTarget ?? editResult ?? null;
  return {
    phase,
    primaryAction,
    runtimeDetail,
    runtimeActionEditTarget,
    editResult,
    runtimeResultReturnTarget,
    resultReturnTarget,
    nextTargetKind: resolveMainFlowNextTargetKind(primaryAction?.kind),
    currentRuntimeStatePointId: runtimeDetail?.statePointId ?? '',
    refreshedRuntimeStatePointId: editResult?.statePointId ?? '',
    actionEditStatePointId: runtimeActionEditTarget?.statePointId ?? '',
    returnStatePointId: resultReturnTarget?.statePointId ?? '',
    canFocusRuntimeAction: Boolean(runtimeActionEditTarget?.canFocusAction),
    canReturnRuntimeResult: Boolean(resultReturnTarget?.statePointId),
  };
}

export function createWorkbenchMainFlowSelection({
  phase = '',
  selectedAction = null,
  selectedStateCurvePointId = '',
  runtimeFocusSource = '',
  runtimeOverviewActive = false,
  runtimeDetail = null,
  editResult = null,
  mainFlowState = null,
} = {}) {
  const selectedRuntimeStatePointId = runtimeDetail?.statePointId ?? '';
  const pendingRuntimeStatePointId =
    editResult?.statePointId &&
    editResult.statePointId !== selectedRuntimeStatePointId
      ? editResult.statePointId
      : '';
  const currentRegion = selectedRuntimeStatePointId
    ? WORKBENCH_MAIN_FLOW_REGIONS.RUNTIME_REVIEW
    : WORKBENCH_MAIN_FLOW_REGIONS.ACTION_EDIT;

  return {
    phase,
    currentRegion,
    nextRegion: resolveMainFlowNextRegion(mainFlowState?.nextTargetKind),
    inspectorMode: resolveMainFlowInspectorMode({
      currentRegion,
      editResult,
      pendingRuntimeStatePointId,
    }),
    selectedActionId: selectedAction?.id ?? '',
    selectedActionName: selectedAction?.name ?? '未选动作',
    selectedStateCurvePointId: selectedStateCurvePointId ?? '',
    selectedRuntimeStatePointId,
    pendingRuntimeStatePointId,
    refreshedRuntimeStatePointId: editResult?.statePointId ?? '',
    runtimeFocusSource: runtimeFocusSource ?? '',
    runtimeOverviewActive: Boolean(runtimeOverviewActive),
    hasRuntimeSelection: Boolean(selectedRuntimeStatePointId),
    hasPendingRuntimeResult: Boolean(pendingRuntimeStatePointId),
  };
}

export function resolveWorkbenchMainFlowActionEditTarget({
  flowModel = null,
  fallbackTarget = null,
  statePointId = '',
} = {}) {
  const target =
    flowModel?.mainFlowState?.runtimeActionEditTarget ??
    flowModel?.runtimeActionEditTarget ??
    null;
  if (isWorkbenchMainFlowTargetUsable(target, { statePointId })) {
    return target;
  }
  return fallbackTarget ?? null;
}

export function resolveWorkbenchMainFlowResultReturnTarget({
  flowModel = null,
  fallbackTarget = null,
  statePointId = '',
} = {}) {
  const target =
    flowModel?.mainFlowState?.resultReturnTarget ??
    flowModel?.runtimeResultReturnTarget ??
    null;
  if (isWorkbenchMainFlowTargetUsable(target, { statePointId })) {
    return target;
  }
  return isWorkbenchMainFlowTargetUsable(fallbackTarget, { statePointId })
    ? fallbackTarget
    : null;
}

function isWorkbenchMainFlowTargetUsable(target, { statePointId = '' } = {}) {
  if (!target?.statePointId) {
    return false;
  }
  return !statePointId || target.statePointId === statePointId;
}

function resolveMainFlowNextTargetKind(kind = '') {
  if (kind === WORKBENCH_FLOW_ACTION_KINDS.OPEN_RUNTIME_RESULTS) {
    return 'runtime-results';
  }
  if (kind === WORKBENCH_FLOW_ACTION_KINDS.FOCUS_RUNTIME_ACTION) {
    return 'runtime-action-edit';
  }
  if (kind === WORKBENCH_FLOW_ACTION_KINDS.RETURN_RUNTIME_RESULT) {
    return 'runtime-result-return';
  }
  return '';
}

function resolveMainFlowNextRegion(nextTargetKind = '') {
  if (nextTargetKind === 'runtime-action-edit') {
    return WORKBENCH_MAIN_FLOW_REGIONS.ACTION_EDIT;
  }
  if (
    nextTargetKind === 'runtime-results' ||
    nextTargetKind === 'runtime-result-return'
  ) {
    return WORKBENCH_MAIN_FLOW_REGIONS.RUNTIME_REVIEW;
  }
  return '';
}

function resolveMainFlowInspectorMode({
  currentRegion = '',
  editResult = null,
  pendingRuntimeStatePointId = '',
} = {}) {
  if (pendingRuntimeStatePointId) {
    return 'edit-result';
  }
  if (currentRegion === WORKBENCH_MAIN_FLOW_REGIONS.RUNTIME_REVIEW) {
    return 'runtime-detail';
  }
  if (editResult?.statePointId) {
    return 'edit-result';
  }
  return 'action-properties';
}

function resolveMainFlowLoopStep(phase = '') {
  if (phase === WORKBENCH_FLOW_PHASES.RUNTIME_RESULT) {
    return WORKBENCH_MAIN_FLOW_LOOP_STEPS.RUNTIME_REVIEW;
  }
  if (phase === WORKBENCH_FLOW_PHASES.EDIT_RESULT_REVIEW) {
    return WORKBENCH_MAIN_FLOW_LOOP_STEPS.EDIT_RESULT_REVIEW;
  }
  if (phase === WORKBENCH_FLOW_PHASES.EDIT_RESULT_READY) {
    return WORKBENCH_MAIN_FLOW_LOOP_STEPS.EDIT_RESULT_READY;
  }
  if (phase === WORKBENCH_FLOW_PHASES.RUNTIME_OVERVIEW) {
    return WORKBENCH_MAIN_FLOW_LOOP_STEPS.RUNTIME_OVERVIEW;
  }
  return WORKBENCH_MAIN_FLOW_LOOP_STEPS.ACTION_EDIT;
}

function resolveMainFlowLoopStatus(dispatchResult = null) {
  if (dispatchResult?.status === 'failed') {
    return WORKBENCH_MAIN_FLOW_LOOP_STATUSES.BLOCKED;
  }
  if (dispatchResult?.status === 'handled') {
    return WORKBENCH_MAIN_FLOW_LOOP_STATUSES.ADVANCED;
  }
  return WORKBENCH_MAIN_FLOW_LOOP_STATUSES.READY;
}

function resolveRuntimeReviewSelectionStatus({
  selectedStatePointId = '',
  pendingStatePointId = '',
  runtimeOverviewActive = false,
} = {}) {
  if (selectedStatePointId) {
    return WORKBENCH_RUNTIME_REVIEW_SELECTION_STATUSES.SELECTED;
  }
  if (pendingStatePointId) {
    return WORKBENCH_RUNTIME_REVIEW_SELECTION_STATUSES.PENDING_RESULT;
  }
  if (runtimeOverviewActive) {
    return WORKBENCH_RUNTIME_REVIEW_SELECTION_STATUSES.OVERVIEW;
  }
  return WORKBENCH_RUNTIME_REVIEW_SELECTION_STATUSES.EMPTY;
}

function createRuntimeReviewLastAction(dispatchResult = null) {
  if (!isRuntimeReviewDispatch(dispatchResult)) {
    return {
      kind: '',
      source: '',
      handled: false,
      statePointId: '',
    };
  }
  return {
    kind: dispatchResult.kind ?? '',
    source: dispatchResult.source ?? '',
    handled: Boolean(dispatchResult.handled),
    statePointId: dispatchResult.statePointId ?? '',
  };
}

function isRuntimeReviewDispatch(dispatchResult = null) {
  if (!dispatchResult?.hasResult) {
    return false;
  }
  return [
    WORKBENCH_FLOW_ACTION_KINDS.SELECT_RUNTIME_RESULT,
    WORKBENCH_FLOW_ACTION_KINDS.SELECT_RUNTIME_STATE_POINT,
    WORKBENCH_FLOW_ACTION_KINDS.FOCUS_RUNTIME_ACTION,
    WORKBENCH_FLOW_ACTION_KINDS.RETURN_RUNTIME_RESULT,
  ].includes(dispatchResult.kind);
}

function createRuntimeReviewFocusActionOperation({
  runtimeReviewSelection = null,
  runtimeActionEditTarget = null,
} = {}) {
  const actionId =
    runtimeActionEditTarget?.actionId ??
    runtimeReviewSelection?.selectedActionId ??
    '';
  const statePointId =
    runtimeActionEditTarget?.statePointId ??
    runtimeReviewSelection?.selectedStatePointId ??
    '';
  const enabled = Boolean(
    runtimeReviewSelection?.hasSelection &&
      runtimeActionEditTarget?.canFocusAction &&
      actionId
  );
  return {
    kind: WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS.FOCUS_ACTION,
    enabled,
    disabledReason: enabled ? '' : 'missing-runtime-action',
    actionId,
    statePointId,
    fieldKey: runtimeActionEditTarget?.fieldKey ?? 'startMs',
    frameLabel:
      runtimeActionEditTarget?.frameLabel ??
      runtimeReviewSelection?.frameLabel ??
      '',
    timeMs: runtimeReviewSelection?.timeMs ?? null,
    trackKey:
      runtimeActionEditTarget?.trackKey ??
      runtimeReviewSelection?.trackKey ??
      '',
    trackLabel:
      runtimeActionEditTarget?.trackLabel ??
      runtimeReviewSelection?.trackLabel ??
      '',
    sourceKind:
      runtimeReviewSelection?.sourceView?.sourceKind ??
      runtimeReviewSelection?.sourceKind ??
      '',
  };
}

function createRuntimeReviewReturnResultOperation({
  runtimeReviewSelection = null,
  runtimeResultReturnTarget = null,
} = {}) {
  const actionId =
    runtimeResultReturnTarget?.actionId ??
    runtimeReviewSelection?.pendingActionId ??
    runtimeReviewSelection?.selectedActionId ??
    '';
  const statePointId =
    runtimeResultReturnTarget?.statePointId ??
    runtimeReviewSelection?.pendingStatePointId ??
    '';
  const enabled = Boolean(runtimeResultReturnTarget?.statePointId);
  return {
    kind: WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS.RETURN_RESULT,
    enabled,
    disabledReason: enabled ? '' : 'missing-runtime-result',
    actionId,
    statePointId,
    originStatePointId: runtimeResultReturnTarget?.originStatePointId ?? '',
    status: runtimeResultReturnTarget?.status ?? '',
    sourceKind:
      runtimeReviewSelection?.sourceView?.sourceKind ??
      runtimeReviewSelection?.sourceKind ??
      '',
  };
}

function resolveRuntimeReviewPrimaryOperationKind({
  runtimeReviewSelection = null,
  focusAction = null,
  returnResult = null,
} = {}) {
  if (
    runtimeReviewSelection?.hasPendingResult &&
    !runtimeReviewSelection?.hasSelection &&
    returnResult?.enabled
  ) {
    return returnResult.kind;
  }
  if (focusAction?.enabled) {
    return focusAction.kind;
  }
  if (returnResult?.enabled) {
    return returnResult.kind;
  }
  return '';
}

function createRuntimeReviewPrimaryOperation({
  primaryOperationKind = '',
  focusAction = null,
  returnResult = null,
} = {}) {
  const target =
    primaryOperationKind === focusAction?.kind
      ? focusAction
      : primaryOperationKind === returnResult?.kind
        ? returnResult
        : null;
  return {
    kind: primaryOperationKind,
    enabled: Boolean(target?.enabled),
    disabledReason: target?.disabledReason ?? 'missing-runtime-review-operation',
    label: formatRuntimeReviewPrimaryOperationLabel(primaryOperationKind),
    actionId: target?.actionId ?? '',
    statePointId: target?.statePointId ?? '',
    sourceKind: target?.sourceKind ?? '',
    target: target ?? null,
  };
}

function formatRuntimeReviewPrimaryOperationLabel(operationKind = '') {
  if (operationKind === WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS.FOCUS_ACTION) {
    return '定位动作';
  }
  if (operationKind === WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS.RETURN_RESULT) {
    return '回到结果点';
  }
  return '主操作';
}

function createWorkbenchFlowEditResult(context) {
  const actionId = context?.actionId ?? '';
  const statePointId = context?.runtimeStatePointId ?? '';
  return {
    source: context ?? null,
    status: context?.status ?? '',
    actionId,
    statePointId,
    runtimeStatePointId: statePointId,
    changeSummary: context?.changeSummary ?? '',
    originStatePointId: context?.originStatePointId ?? '',
    originTrackKey: context?.originTrackKey ?? '',
    originFrameLabel: context?.originFrameLabel ?? '',
    label: statePointId
      ? [context?.label, context?.changeSummary].filter(Boolean).join(' ')
      : '无刷新结果',
    canReturn: Boolean(statePointId),
  };
}

function resolveWorkbenchFlowPhase({
  runtimeDetail,
  editResult,
  runtimeOverviewActive,
}) {
  if (
    runtimeDetail.statePointId &&
    editResult.statePointId &&
    runtimeDetail.statePointId === editResult.statePointId
  ) {
    return WORKBENCH_FLOW_PHASES.EDIT_RESULT_REVIEW;
  }
  if (runtimeDetail.statePointId) {
    return WORKBENCH_FLOW_PHASES.RUNTIME_RESULT;
  }
  if (editResult.statePointId) {
    return WORKBENCH_FLOW_PHASES.EDIT_RESULT_READY;
  }
  if (runtimeOverviewActive) {
    return WORKBENCH_FLOW_PHASES.RUNTIME_OVERVIEW;
  }
  return WORKBENCH_FLOW_PHASES.ACTION_EDIT;
}

function createWorkbenchFlowPrimaryAction({
  phase,
  selectedActionId = '',
  controls = {},
  runtimeDetail,
  editResult,
}) {
  if (phase === WORKBENCH_FLOW_PHASES.EDIT_RESULT_READY) {
    return createPrimaryAction({
      key: WORKBENCH_FLOW_PRIMARY_ACTION_KEYS.RETURN_RUNTIME_RESULT,
      kind: WORKBENCH_FLOW_ACTION_KINDS.RETURN_RUNTIME_RESULT,
      label: '回到刷新结果',
      actionId: editResult.actionId,
      statePointId: editResult.statePointId,
      enabled: controls.canReturnRuntimeResult,
      disabledReason: 'missing-runtime-result',
    });
  }

  if (
    phase === WORKBENCH_FLOW_PHASES.RUNTIME_RESULT ||
    phase === WORKBENCH_FLOW_PHASES.EDIT_RESULT_REVIEW
  ) {
    return createPrimaryAction({
      key: WORKBENCH_FLOW_PRIMARY_ACTION_KEYS.FOCUS_RUNTIME_ACTION,
      kind: WORKBENCH_FLOW_ACTION_KINDS.FOCUS_RUNTIME_ACTION,
      label:
        phase === WORKBENCH_FLOW_PHASES.EDIT_RESULT_REVIEW
          ? '继续修改动作'
          : '编辑结果动作',
      actionId: runtimeDetail.actionId,
      statePointId: runtimeDetail.statePointId,
      enabled: controls.canFocusRuntimeAction,
      disabledReason: 'missing-runtime-action',
    });
  }

  return createPrimaryAction({
    key: WORKBENCH_FLOW_PRIMARY_ACTION_KEYS.OPEN_RUNTIME_RESULTS,
    kind: WORKBENCH_FLOW_ACTION_KINDS.OPEN_RUNTIME_RESULTS,
    label: '查看运行结果',
    actionId: selectedActionId,
    enabled: controls.canOpenRuntimeResults,
    disabledReason: 'missing-runtime-results',
  });
}

function createPrimaryAction({
  key,
  kind,
  label,
  actionId = '',
  statePointId = '',
  enabled = false,
  disabledReason = '',
}) {
  return {
    key,
    kind,
    label,
    actionId: actionId ?? '',
    statePointId: statePointId ?? '',
    enabled: Boolean(enabled),
    disabledReason: enabled ? '' : disabledReason,
  };
}

function getRuntimeNavigationPrevious({
  runtimeNavigationPoints,
  selectedRuntimeNavigationIndex,
  runtimeOverviewActive,
}) {
  if (selectedRuntimeNavigationIndex > 0) {
    return runtimeNavigationPoints[selectedRuntimeNavigationIndex - 1];
  }
  if (runtimeOverviewActive && runtimeNavigationPoints.length > 0) {
    return runtimeNavigationPoints[runtimeNavigationPoints.length - 1];
  }
  return null;
}

function getRuntimeNavigationNext({
  runtimeNavigationPoints,
  selectedRuntimeNavigationIndex,
  runtimeOverviewActive,
}) {
  if (
    selectedRuntimeNavigationIndex >= 0 &&
    selectedRuntimeNavigationIndex < runtimeNavigationPoints.length - 1
  ) {
    return runtimeNavigationPoints[selectedRuntimeNavigationIndex + 1];
  }
  if (
    selectedRuntimeNavigationIndex < 0 &&
    runtimeOverviewActive &&
    runtimeNavigationPoints.length > 0
  ) {
    return runtimeNavigationPoints[0];
  }
  return null;
}

function formatRuntimeNavigationLabel({
  total,
  selectedRuntimeNavigationIndex,
}) {
  if (total === 0) {
    return '0/0';
  }
  if (selectedRuntimeNavigationIndex < 0) {
    return `-/${total}`;
  }
  return `${selectedRuntimeNavigationIndex + 1}/${total}`;
}
