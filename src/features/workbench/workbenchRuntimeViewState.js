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

export function createWorkbenchRuntimePointSelectionViewPatch(
  selectionState = {},
  options = {}
) {
  const applyState = createWorkbenchRuntimePointSelectionApplyState(
    selectionState,
    options
  );
  return createWorkbenchRuntimeViewPatch({
    selectedStatePointId: applyState.selectedStatePointId,
    stateCurveFocusMode: applyState.stateCurveFocusMode,
    runtimeLogFocus: applyState.runtimeLogFocus,
    selectRuntimeActionStatePointId: applyState.shouldSelectRuntimeAction
      ? applyState.statePointId
      : '',
  });
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

export function createWorkbenchRuntimeFlowViewPatch(
  viewState = {},
  options = {}
) {
  const applyState = createWorkbenchRuntimeViewApplyState(viewState, options);
  return createWorkbenchRuntimeViewPatch({
    selectedStatePointId: applyState.clearRuntimeSelection
      ? applyState.selectedStatePointId
      : undefined,
    stateCurveFocusMode: applyState.clearRuntimeSelection
      ? applyState.stateCurveFocusMode
      : undefined,
    stateCurveLayerFilters: applyState.stateCurveLayerFilters,
    stateCurveTrackFilters: applyState.stateCurveTrackFilters,
    runtimeLogFocus: applyState.shouldFocusRuntimeLog
      ? applyState.runtimeLogFocus
      : null,
  });
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

export function createWorkbenchCalculatorScopeViewPatch(
  scopeState = {},
  options = {}
) {
  const applyState = createWorkbenchCalculatorScopeApplyState(
    scopeState,
    options
  );
  const shouldClearRuntimeSelection = Boolean(
    applyState.clearRuntimeSelection && !applyState.selectRuntimeStatePoint
  );
  return createWorkbenchRuntimeViewPatch({
    calculatorScope: applyState.calculatorScope,
    pulseCalculatorFocus: true,
    selectedStatePointId: shouldClearRuntimeSelection ? '' : undefined,
    stateCurveFocusMode: shouldClearRuntimeSelection
      ? applyState.stateCurveFocusMode
      : undefined,
    stateCurveLayerFilters: applyState.stateCurveLayerFilters,
    stateCurveTrackFilters: applyState.stateCurveTrackFilters,
    runtimeLogFocus: applyState.runtimeLogFocus,
    selectRuntimeStatePointId: applyState.selectRuntimeStatePoint
      ? applyState.statePointId
      : '',
  });
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

export function applyWorkbenchRuntimeViewPatch(patch = {}, handlers = {}) {
  const changes = patch?.changes ?? {};
  const appliedChanges = {};
  applyPatchChange({
    changes,
    appliedChanges,
    key: 'selectedStatePointId',
    apply: handlers.setSelectedStatePointId,
  });
  applyPatchChange({
    changes,
    appliedChanges,
    key: 'stateCurveFocusMode',
    apply: handlers.setStateCurveFocusMode,
  });
  applyPatchChange({
    changes,
    appliedChanges,
    key: 'stateCurveLayerFilters',
    cloneObject: true,
    apply: handlers.setStateCurveLayerFilters,
  });
  applyPatchChange({
    changes,
    appliedChanges,
    key: 'stateCurveTrackFilters',
    cloneObject: true,
    apply: handlers.setStateCurveTrackFilters,
  });
  applyPatchChange({
    changes,
    appliedChanges,
    key: 'calculatorScope',
    apply: handlers.setCalculatorScope,
  });
  if (patch?.pulseCalculatorFocus) {
    handlers.pulseCalculatorFocus?.();
  }
  applyPatchChange({
    changes,
    appliedChanges,
    key: 'runtimeLogFocus',
    cloneObject: true,
    apply: handlers.setRuntimeLogFocus,
  });
  const selectRuntimeActionStatePointId =
    patch?.selectRuntimeActionStatePointId ?? '';
  if (selectRuntimeActionStatePointId) {
    handlers.selectRuntimeActionStatePoint?.(
      selectRuntimeActionStatePointId
    );
  }
  const selectRuntimeStatePointId = patch?.selectRuntimeStatePointId ?? '';
  if (selectRuntimeStatePointId) {
    handlers.selectRuntimeStatePoint?.(selectRuntimeStatePointId);
  }
  return {
    appliedChanges,
    pulseCalculatorFocus: Boolean(patch?.pulseCalculatorFocus),
    selectRuntimeActionStatePointId,
    selectRuntimeStatePointId,
  };
}

function createWorkbenchRuntimeViewPatch({
  selectedStatePointId,
  stateCurveFocusMode,
  stateCurveLayerFilters = null,
  stateCurveTrackFilters = null,
  runtimeLogFocus = null,
  calculatorScope,
  pulseCalculatorFocus = false,
  selectRuntimeActionStatePointId = '',
  selectRuntimeStatePointId = '',
} = {}) {
  const changes = {};
  assignPatchChange(changes, 'selectedStatePointId', selectedStatePointId);
  assignPatchChange(changes, 'stateCurveFocusMode', stateCurveFocusMode);
  assignPatchChange(changes, 'stateCurveLayerFilters', stateCurveLayerFilters);
  assignPatchChange(changes, 'stateCurveTrackFilters', stateCurveTrackFilters);
  assignPatchChange(changes, 'runtimeLogFocus', runtimeLogFocus);
  assignPatchChange(changes, 'calculatorScope', calculatorScope);
  return {
    changes,
    pulseCalculatorFocus: Boolean(pulseCalculatorFocus),
    selectRuntimeActionStatePointId: selectRuntimeActionStatePointId ?? '',
    selectRuntimeStatePointId: selectRuntimeStatePointId ?? '',
  };
}

function assignPatchChange(changes, key, value) {
  if (value === undefined || value === null) {
    return;
  }
  changes[key] =
    value && typeof value === 'object' && !Array.isArray(value)
      ? { ...value }
      : value;
}

function applyPatchChange({
  changes = {},
  appliedChanges = {},
  key = '',
  cloneObject = false,
  apply,
} = {}) {
  if (!Object.prototype.hasOwnProperty.call(changes, key)) {
    return;
  }
  const value = changes[key];
  const nextValue =
    cloneObject && value && typeof value === 'object' && !Array.isArray(value)
      ? { ...value }
      : value;
  apply?.(nextValue);
  appliedChanges[key] = nextValue;
}
