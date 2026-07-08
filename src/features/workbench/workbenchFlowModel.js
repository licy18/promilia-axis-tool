import {
  createRuntimeStatePointContexts,
  getRuntimeOutputSummary,
  getRuntimeSimLogCount,
} from './runtimeProjectionPoints';

export const WORKBENCH_FLOW_PHASES = Object.freeze({
  ACTION_EDIT: 'action-edit',
  RUNTIME_OVERVIEW: 'runtime-overview',
  RUNTIME_RESULT: 'runtime-result',
  EDIT_RESULT_READY: 'edit-result-ready',
  EDIT_RESULT_REVIEW: 'edit-result-review',
});

export const WORKBENCH_FLOW_ACTION_KINDS = Object.freeze({
  SELECT_RUNTIME_RESULT: 'select-runtime-result',
  SELECT_RUNTIME_STATE_POINT: 'select-runtime-state-point',
  SELECT_CONTRIBUTION_POINT: 'select-contribution-point',
  FOCUS_RUNTIME_ACTION: 'focus-runtime-action',
  FOCUS_EDIT_SOURCE: 'focus-edit-source',
  RETURN_RUNTIME_RESULT: 'return-runtime-result',
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
  runtimeProjection = null,
  runtimeSelectedDetail = null,
  selectedStateCurvePointId = '',
  runtimeFocusSource = '',
  runtimeOverviewActive = false,
  actionEditResultContext = null,
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
  const runtimeSimLogCount = getRuntimeSimLogCount(runtimeProjection);

  return {
    phase: resolveWorkbenchFlowPhase({
      runtimeDetail,
      editResult,
      runtimeOverviewActive,
    }),
    selectedAction,
    selectedActionId: selectedAction?.id ?? '',
    selectedActionName: selectedAction?.name ?? '未选动作',
    selectedStateCurvePointId: selectedStateCurvePointId ?? '',
    runtimeFocusSource: runtimeFocusSource ?? '',
    runtimeOverviewActive: Boolean(runtimeOverviewActive),
    runtimeSummary: getRuntimeOutputSummary(runtimeProjection),
    runtimeSimLogCount,
    runtimeDetail,
    editResult,
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
    controls: {
      canOpenRuntimeResults: runtimeSimLogCount > 0,
      canFocusRuntimeAction: runtimeDetail.canFocusAction,
      canReturnRuntimeResult: editResult.canReturn,
    },
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
