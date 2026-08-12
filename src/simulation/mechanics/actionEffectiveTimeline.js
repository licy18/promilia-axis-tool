const projectedVerifiedContextContinuationActions = new WeakSet();

export function projectScenarioEffectiveActionTimeline({
  scenario = {},
  actionResolutionById = null,
  actionSelectionById = null,
} = {}) {
  const contextualEndByActionId = new Map();
  for (const selection of actionSelectionById?.values?.() ?? []) {
    const contextActionId = selection?.contextActionId;
    const contextualEndMs =
      selection?.contextualInputScheduling?.predecessorEffectiveEndMs;
    if (!contextActionId || !Number.isFinite(Number(contextualEndMs))) {
      continue;
    }
    const existing = contextualEndByActionId.get(contextActionId);
    contextualEndByActionId.set(
      contextActionId,
      existing == null
        ? Number(contextualEndMs)
        : Math.min(existing, Number(contextualEndMs))
    );
  }
  const actions = (scenario.actions ?? []).map(action => {
    const resolution = actionResolutionById?.get?.(action.id);
    const binding = resolution?.actionBinding ?? resolution ?? {};
    const selection = actionSelectionById?.get?.(action.id) ?? {};
    const resolvedAttackInput =
      binding.attackInputSegment ?? action.attackInput;
    const attackInput =
      selection.sourceKind === 'verified-input-context-variant' &&
      action.attackInput &&
      Number.isInteger(Number(selection.publicControlSkillId))
        ? {
            ...resolvedAttackInput,
            controlSkillId: Number(selection.publicControlSkillId),
          }
        : resolvedAttackInput;
    const genericDurationMs =
      action.type === 'switch'
        ? 0
        : Math.max(
            1,
            Number(binding.actualDurationMs ?? action.durationMs) || 1
          );
    const contextualInputScheduling =
      selection.contextualInputScheduling ?? null;
    const requestedStartMs = Number(action.startMs) || 0;
    const startMs = Number.isFinite(
      Number(contextualInputScheduling?.executionStartMs)
    )
      ? Number(contextualInputScheduling.executionStartMs)
      : requestedStartMs;
    const contextualEndMs = contextualEndByActionId.get(action.id);
    const durationMs =
      contextualEndMs == null
        ? genericDurationMs
        : Math.max(
            0,
            Math.min(genericDurationMs, contextualEndMs - requestedStartMs)
          );
    const projectedAction = {
      ...omitCallerVerifiedContextContinuation(action),
      name: binding.semanticName ?? action.name,
      startMs,
      durationMs,
      attackInput,
      attackSequenceTotal:
        attackInput?.sequenceTotal ?? action.attackSequenceTotal,
      runtimeContextActionId: selection.contextActionId ?? null,
      requestedStartMs,
      contextualInputScheduling,
      contextualEffectiveEndMs: contextualEndMs ?? null,
      ...(resolution?.ready === true &&
      selection.status === 'verified-action-variant-selection-ready' &&
      selection.sourceKind === 'verified-input-context-variant' &&
      selection.edgeIdentity &&
      selection.contextActionId
        ? {
            verifiedContextContinuation: {
              status: 'verified-context-continuation-ready',
              edgeIdentity: selection.edgeIdentity,
              contextActionId: selection.contextActionId,
              publicControlSkillId: selection.publicControlSkillId,
              executionControlSkillId: selection.executionControlSkillId,
              selectedSubSkillIndex: selection.selectedSubSkillIndex,
            },
          }
        : {}),
    };
    if (projectedAction.verifiedContextContinuation) {
      projectedVerifiedContextContinuationActions.add(projectedAction);
    }
    return projectedAction;
  });

  return {
    scenario: { ...scenario, actions },
    summary: {
      contextualTransitionCount: actions.filter(
        action => action.contextualInputScheduling?.applied
      ).length,
      contextuallyTruncatedActionCount: contextualEndByActionId.size,
    },
  };
}

export function isProjectedVerifiedContextContinuation(action) {
  return (
    action != null &&
    typeof action === 'object' &&
    projectedVerifiedContextContinuationActions.has(action) &&
    action.verifiedContextContinuation?.status ===
      'verified-context-continuation-ready'
  );
}

function omitCallerVerifiedContextContinuation(action) {
  const projected = { ...action };
  delete projected.verifiedContextContinuation;
  return projected;
}

export function isActionFrameWithinContextualOccupancy(
  action,
  frame,
  frameRate = 60
) {
  if (action?.contextualEffectiveEndMs == null) return true;
  const normalizedFrame = Number(frame);
  const normalizedFrameRate = Number(frameRate);
  if (!Number.isFinite(normalizedFrame) || !(normalizedFrameRate > 0)) {
    return false;
  }
  const relativeEndMs =
    Number(action.contextualEffectiveEndMs) - Number(action.startMs);
  return (
    Number.isFinite(relativeEndMs) &&
    (normalizedFrame * 1000) / normalizedFrameRate < relativeEndMs
  );
}
