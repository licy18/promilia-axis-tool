export function createWorkbenchRuntimePointSelectionApplyState(
  selectionState = {},
  { currentRuntimeLogFocus = null } = {}
) {
  return {
    statePointId: selectionState.statePointId ?? '',
    selectedStatePointId: selectionState.selectedStatePointId ?? '',
    stateCurveFocusMode: selectionState.stateCurveFocusMode || 'all',
    shouldSelectRuntimeAction: Boolean(
      selectionState.shouldSelectRuntimeAction
    ),
    runtimeLogFocus: createWorkbenchRuntimeLogFocusState({
      runtimeLogFocus: selectionState.runtimeLogFocus,
      currentRuntimeLogFocus,
    }),
  };
}

export function createWorkbenchRuntimeViewApplyState(
  viewState = {},
  { currentRuntimeLogFocus = null } = {}
) {
  const shouldFocusRuntimeLog = Boolean(
    viewState.runtimeLogFocus?.statePointId
  );
  return {
    clearRuntimeSelection: Boolean(viewState.clearRuntimeSelection),
    selectedStatePointId: '',
    stateCurveFocusMode: viewState.stateCurveFocusMode || 'all',
    stateCurveLayerFilters: viewState.stateCurveLayerFilters
      ? { ...viewState.stateCurveLayerFilters }
      : null,
    stateCurveTrackFilters: viewState.stateCurveTrackFilters
      ? { ...viewState.stateCurveTrackFilters }
      : null,
    shouldFocusRuntimeLog,
    runtimeLogFocus: createWorkbenchRuntimeLogFocusState({
      runtimeLogFocus: viewState.runtimeLogFocus,
      currentRuntimeLogFocus,
      incrementSequence: shouldFocusRuntimeLog,
    }),
  };
}

export function createWorkbenchCalculatorScopeApplyState(
  scopeState = {},
  { currentRuntimeLogFocus = null } = {}
) {
  return {
    calculatorScope: scopeState.calculatorScope ?? 'generation',
    statePointId: scopeState.statePointId ?? '',
    selectRuntimeStatePoint: Boolean(scopeState.selectRuntimeStatePoint),
    clearRuntimeSelection: Boolean(scopeState.clearRuntimeSelection),
    stateCurveFocusMode: scopeState.stateCurveFocusMode || 'all',
    stateCurveLayerFilters: scopeState.stateCurveLayerFilters
      ? { ...scopeState.stateCurveLayerFilters }
      : {},
    stateCurveTrackFilters: scopeState.stateCurveTrackFilters
      ? { ...scopeState.stateCurveTrackFilters }
      : {},
    runtimeLogFocus: createWorkbenchRuntimeLogFocusState({
      runtimeLogFocus: scopeState.runtimeLogFocus,
      currentRuntimeLogFocus,
    }),
  };
}

export function createWorkbenchRuntimeLogFocusState({
  runtimeLogFocus = null,
  currentRuntimeLogFocus = null,
  incrementSequence = false,
} = {}) {
  const statePointId = runtimeLogFocus?.statePointId ?? '';
  const sequence = Number(currentRuntimeLogFocus?.sequence ?? 0) || 0;
  return {
    source: runtimeLogFocus?.source ?? '',
    statePointId,
    sequence: sequence + (incrementSequence && statePointId ? 1 : 0),
  };
}
