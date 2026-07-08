import {
  createRuntimeStatePointContexts,
  getRuntimeOutputSummary,
  getRuntimeSimLogCount,
} from './runtimeProjectionPoints';
import { createRuntimeResultReturnContext } from './runtimeResultReturnContext';
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
