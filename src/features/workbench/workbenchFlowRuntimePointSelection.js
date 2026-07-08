export function createWorkbenchFlowRuntimePointSelectionState({
  statePointId = '',
} = {}) {
  const runtimeStatePointId = statePointId ?? '';
  const hasRuntimeStatePoint = Boolean(runtimeStatePointId);

  return {
    statePointId: runtimeStatePointId,
    selectedStatePointId: runtimeStatePointId,
    stateCurveFocusMode: hasRuntimeStatePoint ? 'selected' : 'all',
    shouldSelectRuntimeAction: hasRuntimeStatePoint,
    runtimeLogFocus: {
      source: '',
      statePointId: '',
    },
  };
}
