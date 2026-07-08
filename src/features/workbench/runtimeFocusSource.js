const RUNTIME_RESULT_FOCUS_SOURCES = new Set([
  'action-result',
  'analysis-action-result',
  'analysis-edit-result',
  'properties-panel',
  'event-log-runtime-detail',
  'runtime-detail',
  'workbench-flow-panel',
]);

export function isRuntimeResultFocusSource(source) {
  return RUNTIME_RESULT_FOCUS_SOURCES.has(source);
}

export function normalizeRuntimeLogFocusScope(source) {
  if (isRuntimeResultFocusSource(source)) {
    return 'action-result';
  }
  if (source === 'action-contribution') {
    return 'action-contribution';
  }
  return source ?? '';
}
