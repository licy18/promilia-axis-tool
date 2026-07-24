export function projectScenarioEffectiveActionTimeline({
  scenario = {},
  actionResolutionById = null,
  actionSelectionById = null,
} = {}) {
  const actions = (scenario.actions ?? []).map(action => {
    const resolution = actionResolutionById?.get?.(action.id);
    const binding = resolution?.actionBinding ?? resolution ?? {};
    const selection = actionSelectionById?.get?.(action.id) ?? {};
    const attackInput = binding.attackInputSegment ?? action.attackInput;
    const durationMs =
      action.type === 'switch'
        ? 0
        : Math.max(
            1,
            Number(binding.actualDurationMs ?? action.durationMs) || 1
          );
    return {
      ...action,
      name: binding.semanticName ?? action.name,
      durationMs,
      attackInput,
      attackSequenceTotal:
        attackInput?.sequenceTotal ?? action.attackSequenceTotal,
      runtimeContextActionId: selection.contextActionId ?? null,
    };
  });

  return {
    scenario: { ...scenario, actions },
  };
}
