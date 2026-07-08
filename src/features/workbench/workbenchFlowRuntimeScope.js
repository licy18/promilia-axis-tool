export const WORKBENCH_FLOW_RUNTIME_SCOPES = Object.freeze({
  RUNTIME: 'runtime',
  GENERATION: 'generation',
});

const RUNTIME_LAYER_FILTERS = Object.freeze({
  applied: true,
  candidate: false,
  sampled: false,
  placeholder: false,
});

const GENERATION_LAYER_FILTERS = Object.freeze({
  applied: false,
  candidate: true,
  sampled: true,
  placeholder: true,
});

export function createWorkbenchFlowRuntimeScopeState({
  scope = '',
  firstRuntimeStatePointId = '',
} = {}) {
  const calculatorScope =
    scope === WORKBENCH_FLOW_RUNTIME_SCOPES.RUNTIME
      ? WORKBENCH_FLOW_RUNTIME_SCOPES.RUNTIME
      : WORKBENCH_FLOW_RUNTIME_SCOPES.GENERATION;
  const runtimeStatePointId = firstRuntimeStatePointId ?? '';
  const isRuntimeScope =
    calculatorScope === WORKBENCH_FLOW_RUNTIME_SCOPES.RUNTIME;
  const selectRuntimeStatePoint = Boolean(
    isRuntimeScope && runtimeStatePointId
  );

  return {
    calculatorScope,
    statePointId: selectRuntimeStatePoint ? runtimeStatePointId : '',
    selectRuntimeStatePoint,
    clearRuntimeSelection: !selectRuntimeStatePoint,
    stateCurveFocusMode: selectRuntimeStatePoint ? 'selected' : 'all',
    stateCurveLayerFilters: isRuntimeScope
      ? { ...RUNTIME_LAYER_FILTERS }
      : { ...GENERATION_LAYER_FILTERS },
    stateCurveTrackFilters: {},
    runtimeLogFocus: {
      source: '',
      statePointId: '',
    },
  };
}
