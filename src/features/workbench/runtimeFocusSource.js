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
  return createRuntimeFocusSourceView(source).runtimeLogScope;
}

export function isRuntimeLogFocusSource(source) {
  return createRuntimeFocusSourceView(source).isRuntimeLogFocusSource;
}

export function resolveRuntimeFocusSourceKind(source) {
  return createRuntimeFocusSourceView(source).sourceKind;
}

export function createRuntimeFocusSourceView(source = '') {
  const normalizedSource = source ?? '';
  const isRuntimeResult = isRuntimeResultFocusSource(normalizedSource);
  const isContribution = normalizedSource === 'action-contribution';
  const runtimeLogScope = isRuntimeResult
    ? 'action-result'
    : isContribution
      ? 'action-contribution'
      : normalizedSource;
  const sourceKind = resolveRuntimeFocusSourceKindFromSource(normalizedSource);
  const isRuntimeLogFocus = Boolean(isRuntimeResult || isContribution);
  return {
    source: normalizedSource,
    sourceKind,
    runtimeLogScope,
    runtimeLogLabel: getRuntimeLogFocusScopeLabel(runtimeLogScope),
    curveSelectionLabel: getRuntimeCurveSelectionSourceLabel(runtimeLogScope),
    isRuntimeResultFocus: isRuntimeResult,
    isContributionFocus: isContribution,
    isRuntimeLogFocusSource: isRuntimeLogFocus,
  };
}

function resolveRuntimeFocusSourceKindFromSource(source = '') {
  if (!source) {
    return 'none';
  }
  if (source === 'action-contribution') {
    return 'action-contribution';
  }
  if (source.includes('state-curve')) {
    return 'state-curve';
  }
  if (source.includes('resource') || source.includes('curve')) {
    return 'curve';
  }
  if (source.includes('event-log')) {
    return 'log';
  }
  if (source.includes('runtime-detail')) {
    return 'detail';
  }
  if (source.includes('action-result')) {
    return 'action-result';
  }
  return 'other';
}

function getRuntimeLogFocusScopeLabel(scope = '') {
  if (scope === 'action-result') {
    return '结果定位';
  }
  if (scope === 'action-contribution') {
    return '贡献定位';
  }
  if (scope === 'runtime') {
    return '运行视角';
  }
  return '日志筛选';
}

function getRuntimeCurveSelectionSourceLabel(scope = '') {
  if (scope === 'action-result') {
    return '动作结果定位';
  }
  if (scope === 'action-contribution') {
    return '贡献拆分定位';
  }
  return '手动选择';
}
