export function createRuntimeResultReturnContext({
  actionId = '',
  focus = null,
  resultContext = null,
  originStatePointId = '',
  allowOriginResult = false,
} = {}) {
  const normalizedActionId = actionId || resultContext?.actionId || '';
  if (
    !normalizedActionId ||
    !focus?.actionId ||
    focus.editOrigin !== 'runtime-focus' ||
    focus.actionId !== normalizedActionId
  ) {
    return null;
  }

  const normalizedOriginStatePointId =
    originStatePointId || focus.originStatePointId || '';
  if (
    originStatePointId &&
    focus.originStatePointId &&
    originStatePointId !== focus.originStatePointId
  ) {
    return null;
  }
  if (!normalizedOriginStatePointId) {
    return null;
  }

  const refreshedStatePointId =
    resultContext?.actionId === normalizedActionId
      ? resultContext.runtimeStatePointId
      : '';
  const hasRefreshedResult = Boolean(refreshedStatePointId);
  if (!hasRefreshedResult && !allowOriginResult) {
    return null;
  }

  return {
    status: hasRefreshedResult ? 'refreshed-edit-result' : 'origin-result',
    actionId: normalizedActionId,
    fieldKey: focus.fieldKey ?? '',
    label: hasRefreshedResult ? '回到刷新后结果' : '回到来源结果',
    summary:
      (hasRefreshedResult
        ? resultContext?.changeSummary || focus.changeSummary
        : focus.changeSummary) ?? '',
    originStatePointId: normalizedOriginStatePointId,
    statePointId: hasRefreshedResult
      ? refreshedStatePointId
      : normalizedOriginStatePointId,
  };
}
