import {
  createRuntimeStatePointContexts,
  getRuntimeOutputSummary,
  getRuntimeSimLogCount,
} from './runtimeProjectionPoints';
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
    editResult,
    primaryAction,
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
