import {
  createRuntimeStatePointContexts,
  findFirstRuntimeStatePointForAction,
} from './runtimeProjectionPoints';

export const WORKBENCH_RUNTIME_FLOW_PLAN_KINDS = Object.freeze({
  RUNTIME_ENTRY: 'runtime-entry',
  RUNTIME_POINT_FOCUS: 'runtime-point-focus',
  RUNTIME_RESULT_RETURN: 'runtime-result-return',
});

export const WORKBENCH_RUNTIME_FLOW_PLAN_MODES = Object.freeze({
  RUNTIME_RESULT: 'runtime-result',
  RUNTIME_OVERVIEW: 'runtime-overview',
  RUNTIME_POINT_EMPTY: 'runtime-point-empty',
});

const RUNTIME_APPLIED_LAYER_FILTERS = Object.freeze({
  applied: true,
  candidate: false,
  sampled: false,
  placeholder: false,
});

export function createRuntimeEntryFlowPlan({
  runtimeProjection = null,
  actionId = '',
  fallbackToFirstRuntimePoint = false,
} = {}) {
  const selectedActionRuntimePoint = findFirstRuntimeStatePointForAction(
    runtimeProjection,
    actionId
  );
  const fallbackRuntimePoint = fallbackToFirstRuntimePoint
    ? createRuntimeStatePointContexts(runtimeProjection)[0]
    : null;
  const runtimePoint = selectedActionRuntimePoint ?? fallbackRuntimePoint;
  const statePointId = runtimePoint?.statePointId ?? '';
  return createRuntimeFlowPlan({
    kind: WORKBENCH_RUNTIME_FLOW_PLAN_KINDS.RUNTIME_ENTRY,
    mode: statePointId
      ? WORKBENCH_RUNTIME_FLOW_PLAN_MODES.RUNTIME_RESULT
      : WORKBENCH_RUNTIME_FLOW_PLAN_MODES.RUNTIME_OVERVIEW,
    actionId,
    routeSource: selectedActionRuntimePoint
      ? 'selected-action-runtime-point'
      : fallbackRuntimePoint
        ? 'first-runtime-point'
        : 'runtime-overview',
    statePointId,
    calculatorScope: 'runtime',
    pulseCalculatorFocus: true,
    selectFirstRuntimePoint: false,
    selectRuntimeStatePoint: Boolean(statePointId),
    clearRuntimeSelection: !statePointId,
    stateCurveFocusMode: statePointId ? 'selected' : 'all',
    stateCurveLayerFilters: createRuntimeAppliedLayerFilters(),
    stateCurveTrackFilters: {},
  });
}

export function createRuntimePointFocusFlowPlan({
  statePointId = '',
  source = '',
  runtimeLogFocusSource = '',
  preserveStateCurveFilters = false,
} = {}) {
  const normalizedStatePointId = statePointId ?? '';
  const hasRuntimePoint = Boolean(normalizedStatePointId);
  const normalizedRuntimeLogFocusSource =
    runtimeLogFocusSource || source || '';
  const shouldApplyRuntimeCurveFilters =
    hasRuntimePoint && !preserveStateCurveFilters;
  return createRuntimeFlowPlan({
    kind: WORKBENCH_RUNTIME_FLOW_PLAN_KINDS.RUNTIME_POINT_FOCUS,
    mode: hasRuntimePoint
      ? WORKBENCH_RUNTIME_FLOW_PLAN_MODES.RUNTIME_RESULT
      : WORKBENCH_RUNTIME_FLOW_PLAN_MODES.RUNTIME_POINT_EMPTY,
    statePointId: normalizedStatePointId,
    calculatorScope: hasRuntimePoint ? 'runtime' : '',
    pulseCalculatorFocus: false,
    selectRuntimeStatePoint: true,
    clearRuntimeSelection: !hasRuntimePoint,
    stateCurveFocusMode: hasRuntimePoint ? 'selected' : 'all',
    stateCurveLayerFilters: shouldApplyRuntimeCurveFilters
      ? createRuntimeAppliedLayerFilters()
      : null,
    stateCurveTrackFilters: shouldApplyRuntimeCurveFilters ? {} : null,
    runtimeLogFocusSource: hasRuntimePoint
      ? normalizedRuntimeLogFocusSource
      : '',
  });
}

export function createRuntimeResultReturnFlowPlan({
  actionId = '',
  statePointId = '',
  source = 'action-result',
  runtimeLogFocusSource = '',
} = {}) {
  const normalizedStatePointId = statePointId ?? '';
  const hasRuntimePoint = Boolean(normalizedStatePointId);
  const normalizedRuntimeLogFocusSource =
    runtimeLogFocusSource || source || 'action-result';
  return createRuntimeFlowPlan({
    kind: WORKBENCH_RUNTIME_FLOW_PLAN_KINDS.RUNTIME_RESULT_RETURN,
    mode: hasRuntimePoint
      ? WORKBENCH_RUNTIME_FLOW_PLAN_MODES.RUNTIME_RESULT
      : WORKBENCH_RUNTIME_FLOW_PLAN_MODES.RUNTIME_POINT_EMPTY,
    actionId,
    statePointId: normalizedStatePointId,
    selectActionId: actionId,
    calculatorScope: hasRuntimePoint ? 'runtime' : '',
    pulseCalculatorFocus: false,
    selectRuntimeStatePoint: true,
    clearRuntimeSelection: !hasRuntimePoint,
    stateCurveFocusMode: hasRuntimePoint ? 'selected' : 'all',
    stateCurveLayerFilters: hasRuntimePoint
      ? createRuntimeAppliedLayerFilters()
      : null,
    stateCurveTrackFilters: hasRuntimePoint ? {} : null,
    runtimeLogFocusSource: hasRuntimePoint
      ? normalizedRuntimeLogFocusSource
      : '',
  });
}

function createRuntimeFlowPlan({
  kind,
  mode,
  actionId = '',
  selectActionId = '',
  routeSource = '',
  statePointId = '',
  calculatorScope = '',
  pulseCalculatorFocus = false,
  selectFirstRuntimePoint = false,
  selectRuntimeStatePoint = false,
  clearRuntimeSelection = false,
  stateCurveFocusMode = 'all',
  stateCurveLayerFilters = null,
  stateCurveTrackFilters = null,
  runtimeLogFocusSource = '',
} = {}) {
  return {
    kind,
    mode,
    actionId: actionId ?? '',
    selectActionId: selectActionId ?? '',
    routeSource,
    statePointId: statePointId ?? '',
    calculatorScope,
    pulseCalculatorFocus: Boolean(pulseCalculatorFocus),
    selectFirstRuntimePoint: Boolean(selectFirstRuntimePoint),
    selectRuntimeStatePoint: Boolean(selectRuntimeStatePoint),
    clearRuntimeSelection: Boolean(clearRuntimeSelection),
    stateCurveFocusMode,
    stateCurveLayerFilters,
    stateCurveTrackFilters,
    runtimeLogFocusSource,
  };
}

function createRuntimeAppliedLayerFilters() {
  return { ...RUNTIME_APPLIED_LAYER_FILTERS };
}
