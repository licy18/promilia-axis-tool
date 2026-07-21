import {
  getInstalledVerifiedCombatMechanicsPackage,
  getVerifiedCombatActionMapping,
  resolveVerifiedCombatActionMechanics,
} from '../../data/verifiedCombatMechanicsPackage';
import { ACTION_TYPES } from '../../domain/projectSchema';

export const VERIFIED_ACTION_VARIANT_RUNTIME_CONTRACT_NAME =
  'AzPrVerifiedActionVariantRuntime';

const FRAME_RATE = 60;

export function createVerifiedActionVariantRuntime({
  scenario = null,
  actionExecutionPlan = null,
} = {}) {
  const mechanicsPackage = getInstalledVerifiedCombatMechanicsPackage();
  if (!mechanicsPackage?.specialResourceCatalog?.profiles) {
    return createUnavailableRuntime(
      'verified-special-resource-catalog-not-installed'
    );
  }

  const executionByActionId = new Map(
    (actionExecutionPlan?.actions ?? []).map(entry => [entry.actionId, entry])
  );
  const profileByCharacterId = new Map(
    mechanicsPackage.specialResourceCatalog.profiles
      .filter(profile => profile.applied)
      .map(profile => [Number(profile.ownerId), profile])
  );
  const actorStateById = new Map();
  for (const actor of scenario?.actors ?? []) {
    const profile = profileByCharacterId.get(Number(actor.characterId));
    if (!profile) continue;
    const inherited = (
      scenario?.initialRuntimeState?.specialResourcesByActor ?? []
    ).find(
      entry =>
        entry.actorId === actor.id &&
        entry.resourceIdentity === profile.resourceIdentity
    );
    actorStateById.set(actor.id, {
      actor,
      profile,
      initialValue: clamp(
        inherited?.currentValue ?? profile.initialValue,
        0,
        profile.capacity
      ),
      current: clamp(
        inherited?.currentValue ?? profile.initialValue,
        0,
        profile.capacity
      ),
      activeStates: new Map(
        (inherited?.activeStates ?? []).map(state => [
          Number(state.elementId),
          {
            ...state,
            expiresAtMs:
              state.remainingDurationMs == null
                ? null
                : Number(state.remainingDurationMs),
          },
        ])
      ),
    });
  }

  const operations = mechanicsPackage.specialResourceCatalog.operationBindings
    .filter(operation => operation.applied)
    .sort(compareBindings);
  const graph = mechanicsPackage.actionVariantGraph;
  const switchBindings = graph.edges
    .filter(edge => edge.applied)
    .sort(compareBindings);
  const defaultSelectionByControl = new Map(
    graph.defaultSelections.map(selection => [
      `${selection.ownerId}|${selection.controlSkillId}`,
      selection,
    ])
  );
  const actions = (scenario?.actions ?? [])
    .filter(
      action =>
        executionByActionId.get(action.id)?.execute !== false &&
        [ACTION_TYPES.SKILL, ACTION_TYPES.KIBO_EVENT].includes(action.type)
    )
    .map((action, index) => ({ action, index }))
    .sort(
      (left, right) =>
        Number(left.action.startMs) - Number(right.action.startMs) ||
        left.index - right.index
    );

  const actionResolutionById = new Map();
  const selectionByActionId = new Map();
  const activeSwitchWindows = [];
  const pendingEvents = [];
  const resourceEvents = [];
  const stateEvents = [];
  const variantEvents = [];
  const executionBlocks = [];
  let runtimeSequenceIndex = 0;

  for (const [actorId, state] of actorStateById) {
    for (const activeState of state.activeStates.values()) {
      if (activeState.expiresAtMs != null) {
        pendingEvents.push({
          kind: 'state-expire',
          timeMs: activeState.expiresAtMs,
          actorId,
          stateElementId: Number(activeState.elementId),
          sourceActionId: activeState.sourceActionId,
          sourceIdentity: activeState.sourceIdentity,
          priority: 0,
        });
      }
      for (const binding of switchBindings) {
        if (
          binding.ownerId !== state.profile.ownerId ||
          binding.condition?.kind !== 'resource-state-active' ||
          Number(binding.condition.stateElementId) !==
            Number(activeState.elementId)
        ) {
          continue;
        }
        activeSwitchWindows.push({
          ...binding,
          actorId,
          sourceActionId: activeState.sourceActionId,
          startsAtMs: 0,
          endsAtMs:
            activeState.expiresAtMs ??
            (Number.isFinite(Number(scenario?.time?.durationMs))
              ? Number(scenario.time.durationMs)
              : Number.POSITIVE_INFINITY),
        });
      }
    }
  }

  const flushPending = limitMs => {
    pendingEvents.sort(comparePendingEvents);
    while (pendingEvents.length && pendingEvents[0].timeMs <= limitMs) {
      const event = pendingEvents.shift();
      if (event.kind === 'resource-operation') {
        applyResourceOperation(event);
      } else if (event.kind === 'switch-window') {
        applySwitchWindow(event);
      } else if (event.kind === 'state-expire') {
        applyStateExpiration(event);
      }
      pendingEvents.sort(comparePendingEvents);
    }
  };

  const applyResourceOperation = descriptor => {
    const state = actorStateById.get(descriptor.action.actorId);
    if (!state) return;
    const operation = descriptor.binding;
    const beforeValue = state.current;
    let afterValue = beforeValue;
    if (operation.operation === 'gain') {
      afterValue = clamp(
        beforeValue + resolveOperationAmount(operation, descriptor.action),
        0,
        state.profile.capacity
      );
    } else if (operation.operation === 'consume') {
      afterValue = clamp(
        beforeValue - Number(operation.requiredValue || 0),
        0,
        state.profile.capacity
      );
    } else if (operation.operation === 'clear') {
      afterValue = 0;
    } else if (operation.operation === 'transform') {
      const expiresAtMs =
        Number(operation.stateDurationMs) > 0
          ? descriptor.timeMs + Number(operation.stateDurationMs)
          : null;
      state.activeStates.set(Number(operation.stateElementId), {
        elementId: Number(operation.stateElementId),
        name: operation.stateName,
        appliedAtMs: descriptor.timeMs,
        expiresAtMs,
        sourceActionId: descriptor.action.id,
        sourceIdentity: operation.sourceIdentity,
      });
      if (expiresAtMs != null) {
        pendingEvents.push({
          kind: 'state-expire',
          timeMs: expiresAtMs,
          actorId: descriptor.action.actorId,
          stateElementId: Number(operation.stateElementId),
          sourceActionId: descriptor.action.id,
          sourceIdentity: operation.sourceIdentity,
          priority: 0,
        });
      }
    } else if (operation.operation === 'transform-remove') {
      state.activeStates.delete(Number(operation.stateElementId));
    }
    state.current = afterValue;
    const event = {
      type: operation.operation.startsWith('transform')
        ? 'VERIFIED_SPECIAL_RESOURCE_STATE_CHANGE'
        : 'VERIFIED_SPECIAL_RESOURCE_CHANGE',
      timeMs: descriptor.timeMs,
      actionId: descriptor.action.id,
      actorId: descriptor.action.actorId,
      runtimeSequenceIndex: runtimeSequenceIndex++,
      payload: {
        resource: 'special-resource',
        resourceIdentity: state.profile.resourceIdentity,
        resourceName: state.profile.name,
        ownerCharacterId: state.profile.ownerId,
        operation: operation.operation,
        beforeValue,
        change: afterValue - beforeValue,
        afterValue,
        currentValue: afterValue,
        maxValue: state.profile.capacity,
        stateElementId: operation.stateElementId,
        stateName: operation.stateName,
        stateDurationMs: operation.stateDurationMs,
        sourceIdentity: operation.sourceIdentity,
        confidence: 'verified',
        appliedToActionVariantRuntime: true,
        appliedToCalculators: false,
      },
    };
    if (operation.operation.startsWith('transform')) stateEvents.push(event);
    resourceEvents.push(event);
  };

  const applySwitchWindow = descriptor => {
    const state = actorStateById.get(descriptor.action.actorId);
    if (!state || !isSwitchConditionSatisfied(descriptor.binding, state)) {
      return;
    }
    const durationMs = Number(descriptor.binding.durationMs);
    activeSwitchWindows.push({
      ...descriptor.binding,
      actorId: descriptor.action.actorId,
      sourceActionId: descriptor.action.id,
      startsAtMs: descriptor.timeMs,
      endsAtMs: descriptor.timeMs + durationMs,
    });
  };

  const applyStateExpiration = descriptor => {
    const state = actorStateById.get(descriptor.actorId);
    const active = state?.activeStates.get(descriptor.stateElementId);
    if (!active || active.expiresAtMs !== descriptor.timeMs) return;
    state.activeStates.delete(descriptor.stateElementId);
    const event = {
      type: 'VERIFIED_SPECIAL_RESOURCE_STATE_EXPIRED',
      timeMs: descriptor.timeMs,
      actionId: descriptor.sourceActionId,
      actorId: descriptor.actorId,
      runtimeSequenceIndex: runtimeSequenceIndex++,
      payload: {
        resource: 'special-resource',
        resourceIdentity: state.profile.resourceIdentity,
        resourceName: state.profile.name,
        ownerCharacterId: state.profile.ownerId,
        operation: 'expire',
        beforeValue: state.current,
        change: 0,
        afterValue: state.current,
        currentValue: state.current,
        maxValue: state.profile.capacity,
        stateElementId: descriptor.stateElementId,
        stateName: active.name,
        sourceIdentity: descriptor.sourceIdentity,
        confidence: 'verified',
        appliedToActionVariantRuntime: true,
        appliedToCalculators: false,
      },
    };
    stateEvents.push(event);
    resourceEvents.push(event);
  };

  for (const { action } of actions) {
    const actionTimeMs = Number(action.startMs) || 0;
    flushPending(actionTimeMs);
    removeExpiredSwitchWindows(activeSwitchWindows, actionTimeMs);
    const mapping = getVerifiedCombatActionMapping(action);
    const controlSkillId = resolveActionControlSkillId(action, mapping);
    const actorState = actorStateById.get(action.actorId);
    const characterId = Number(
      action.actor?.characterId ?? actorState?.profile?.ownerId
    );
    let selectedSubSkillIndex = mapping?.selectedSubSkillIndex ?? null;
    let selectionSource = null;

    if (actorState && Number.isInteger(controlSkillId)) {
      const activeSelection = resolveActiveSwitchSelection({
        activeSwitchWindows,
        actorId: action.actorId,
        controlSkillId,
        timeMs: actionTimeMs,
        actionKind: mapping?.actionKind,
      });
      if (activeSelection.status === 'ambiguous') {
        const block = createVariantExecutionBlock({
          action,
          actorState,
          controlSkillId,
          activeSelection,
        });
        executionBlocks.push(block);
        actionResolutionById.set(action.id, {
          ...resolveVerifiedCombatActionMechanics(action),
          ready: false,
          applied: false,
          status: block.reason,
          reasons: block.reasons,
        });
        continue;
      }
      const defaultSelection = defaultSelectionByControl.get(
        `${characterId}|${controlSkillId}`
      );
      selectedSubSkillIndex =
        activeSelection.binding?.targetSubSkillIndex ??
        defaultSelection?.subSkillIndex ??
        selectedSubSkillIndex;
      selectionSource = activeSelection.binding
        ? {
            sourceKind: 'verified-active-switch-skill-index-window',
            sourceIdentity: activeSelection.binding.sourceIdentity,
            decisionFrame: activeSelection.binding.decisionFrame,
          }
        : defaultSelection
          ? {
              sourceKind: 'verified-client-default-subskill-index',
              sourceIdentity: defaultSelection.sourceIdentity,
              decisionFrame: defaultSelection.decisionFrame,
            }
          : null;
    }

    const resolution = resolveVerifiedCombatActionMechanics(action, {
      selectedSubSkillIndex,
      selectionSource,
    });
    actionResolutionById.set(action.id, resolution);
    selectionByActionId.set(action.id, {
      actionId: action.id,
      actorId: action.actorId,
      ownerId: characterId || null,
      controlSkillId,
      selectedSubSkillIndex,
      sourceKind: selectionSource?.sourceKind ?? 'action-mapping-selection',
      sourceIdentity:
        selectionSource?.sourceIdentity ??
        resolution.actionBinding?.bindingSourceIdentity ??
        null,
      decisionFrame: selectionSource?.decisionFrame ?? 0,
      actualDurationFrames:
        resolution.actionBinding?.actualDurationFrames ??
        resolution.actionBinding?.actionTiming?.occupancy?.durationFrames ??
        null,
      actualDurationMs:
        resolution.actionBinding?.actualDurationMs ??
        framesToMs(
          resolution.actionBinding?.actionTiming?.occupancy?.durationFrames,
          resolution.controlBinding?.frameRate
        ),
      status: resolution.ready
        ? 'verified-action-variant-selection-ready'
        : 'unresolved-action-variant-selection',
    });
    if (!resolution.ready || !actorState || !Number.isInteger(controlSkillId)) {
      continue;
    }

    const selectedOperations = operations.filter(
      operation =>
        operation.ownerId === characterId &&
        operation.controlSkillId === controlSkillId &&
        operation.subSkillIndex === selectedSubSkillIndex
    );
    const requiredAtDecision = selectedOperations
      .filter(
        operation =>
          operation.operation === 'consume' && operation.triggerFrame === 0
      )
      .reduce(
        (sum, operation) => sum + Number(operation.requiredValue || 0),
        0
      );
    if (requiredAtDecision > actorState.current) {
      const block = createResourceExecutionBlock({
        action,
        actorState,
        controlSkillId,
        selectedSubSkillIndex,
        requiredValue: requiredAtDecision,
        operations: selectedOperations,
      });
      executionBlocks.push(block);
      actionResolutionById.set(action.id, {
        ...resolution,
        ready: false,
        applied: false,
        status: block.reason,
        reasons: block.reasons,
      });
      continue;
    }

    for (const operation of selectedOperations) {
      pendingEvents.push({
        kind: 'resource-operation',
        timeMs:
          actionTimeMs +
          framesToMs(operation.triggerFrame, operation.frameRate),
        action,
        binding: operation,
        priority: operation.operation.startsWith('transform') ? 1 : 0,
      });
    }
    for (const binding of switchBindings) {
      if (
        binding.ownerId !== characterId ||
        binding.sourceControlSkillId !== controlSkillId ||
        binding.sourceSubSkillIndex !== selectedSubSkillIndex
      ) {
        continue;
      }
      pendingEvents.push({
        kind: 'switch-window',
        timeMs: actionTimeMs + framesToMs(binding.activationFrame, FRAME_RATE),
        action,
        binding,
        priority: 2,
      });
    }
    flushPending(actionTimeMs);
    const selection = selectionByActionId.get(action.id);
    variantEvents.push({
      type: 'VERIFIED_ACTION_VARIANT_SELECTED',
      timeMs: actionTimeMs,
      actionId: action.id,
      actorId: action.actorId,
      runtimeSequenceIndex: runtimeSequenceIndex++,
      payload: selection,
    });
  }

  flushPending(Number(scenario?.time?.durationMs) || 0);
  resourceEvents.sort(compareRuntimeEvents);
  stateEvents.sort(compareRuntimeEvents);
  variantEvents.sort(compareRuntimeEvents);
  const curves = createSpecialResourceCurves({
    actorStateById,
    resourceEvents,
    durationMs: Number(scenario?.time?.durationMs) || 0,
  });
  return {
    schemaVersion: 1,
    contractName: VERIFIED_ACTION_VARIANT_RUNTIME_CONTRACT_NAME,
    sourceKind: 'azpr-verified-action-variant-and-special-resource-runtime',
    status: 'verified-action-variant-runtime-ready',
    packageId: mechanicsPackage.packageId,
    packageHash: mechanicsPackage.packageHash,
    actionResolutionById,
    actionResolutions: [...actionResolutionById.values()],
    selectionByActionId,
    selections: [...selectionByActionId.values()],
    resourceEvents,
    stateEvents,
    variantEvents,
    eventLog: [...resourceEvents, ...variantEvents].sort(compareRuntimeEvents),
    executionBlocks,
    curves,
    initialState: curves.map(curve => ({
      actorId: curve.actorId,
      characterId: curve.characterId,
      resourceIdentity: curve.resourceIdentity,
      currentValue: curve.initialValue,
      maxValue: curve.maxValue,
    })),
    finalState: curves.map(curve => ({
      actorId: curve.actorId,
      characterId: curve.characterId,
      resourceIdentity: curve.resourceIdentity,
      currentValue: curve.currentValue,
      maxValue: curve.maxValue,
      activeStates: [
        ...(actorStateById.get(curve.actorId)?.activeStates.values() ?? []),
      ],
    })),
    summary: {
      profileCount: curves.length,
      selectionCount: selectionByActionId.size,
      changedVariantCount: [...actionResolutionById.values()].filter(
        resolution => resolution.variantSelection?.changed
      ).length,
      resourceEventCount: resourceEvents.length,
      stateEventCount: stateEvents.length,
      executionBlockCount: executionBlocks.length,
    },
    ready: true,
    applied: true,
  };
}

function createSpecialResourceCurves({
  actorStateById,
  resourceEvents,
  durationMs,
}) {
  return [...actorStateById.entries()].map(([actorId, state]) => {
    const initialValue = Number(state.initialValue) || 0;
    const points = resourceEvents
      .filter(event => event.actorId === actorId)
      .map((event, index) => ({
        trackKey: `specialResource:${actorId}:${state.profile.elementId}`,
        sourceDeltaId: `special-resource|${actorId}|${index}|${event.runtimeSequenceIndex}`,
        actionId: event.actionId,
        actorId,
        timeMs: event.timeMs,
        frameIndex: Math.round((event.timeMs * FRAME_RATE) / 1000),
        beforeValue: event.payload.beforeValue,
        afterValue: event.payload.afterValue,
        delta: event.payload.change,
        hitKey: `special-resource-${event.payload.operation}-${event.runtimeSequenceIndex}`,
        semantic: true,
        operation: event.payload.operation,
        stateElementId: event.payload.stateElementId,
        stateName: event.payload.stateName,
        sourceIdentity: event.payload.sourceIdentity,
      }));
    return {
      trackKey: `specialResource:${actorId}:${state.profile.elementId}`,
      actorId,
      characterId: state.actor.characterId,
      actorName: state.actor.name,
      resourceIdentity: state.profile.resourceIdentity,
      resourceName: state.profile.name,
      elementId: state.profile.elementId,
      initialValue,
      currentValue: points.at(-1)?.afterValue ?? initialValue,
      maxValue: state.profile.capacity,
      durationMs,
      stateMetric: {
        initialValue,
        currentValue: points.at(-1)?.afterValue ?? initialValue,
        maxValue: state.profile.capacity,
      },
      points,
      pointCount: points.length,
      sourceIdentity: state.profile.sourceIdentity,
      status: 'verified-special-resource-curve-ready',
    };
  });
}

function resolveActionControlSkillId(action, mapping) {
  if (mapping?.actionKind === 'normal-attack') {
    const controlSkillId = Number(action.attackInput?.controlSkillId);
    return Number.isInteger(controlSkillId) ? controlSkillId : null;
  }
  const controlSkillId = Number(mapping?.controlSkillId);
  return Number.isInteger(controlSkillId) ? controlSkillId : null;
}

function resolveActiveSwitchSelection({
  activeSwitchWindows,
  actorId,
  controlSkillId,
  timeMs,
  actionKind,
}) {
  const allCandidates = activeSwitchWindows.filter(
    window =>
      window.actorId === actorId &&
      window.targetControlSkillId === controlSkillId &&
      window.startsAtMs <= timeMs &&
      timeMs < window.endsAtMs
  );
  const candidates = selectSwitchWindowsForActionKind(
    allCandidates,
    actionKind
  );
  if (candidates.length === 0) return { status: 'default', binding: null };
  const latestStart = Math.max(...candidates.map(window => window.startsAtMs));
  const latest = candidates.filter(window => window.startsAtMs === latestStart);
  const subSkillIndexes = new Set(
    latest.map(window => window.targetSubSkillIndex)
  );
  if (subSkillIndexes.size !== 1) {
    return {
      status: 'ambiguous',
      binding: null,
      candidates: latest,
      reasons: ['active-switch-skill-index-target-ambiguous'],
    };
  }
  return {
    status: 'selected',
    binding: latest.sort((left, right) =>
      left.edgeIdentity.localeCompare(right.edgeIdentity)
    )[0],
  };
}

function selectSwitchWindowsForActionKind(candidates, actionKind) {
  const preferredSlots =
    {
      'normal-attack': [1, 0],
      'dodge-attack': [204],
      'charged-attack': [2, 0, 702],
    }[actionKind] ?? [];
  if (preferredSlots.length === 0) return candidates;
  for (const skillSlot of preferredSlots) {
    const matches = candidates.filter(
      candidate => Number(candidate.skillSlot) === skillSlot
    );
    if (matches.length > 0) return matches;
  }
  return [];
}

function isSwitchConditionSatisfied(binding, state) {
  if (!binding.condition) return true;
  if (binding.condition.kind === 'resource-at-least') {
    return state.current >= Number(binding.condition.value || 0);
  }
  if (binding.condition.kind === 'resource-state-active') {
    return state.activeStates.has(Number(binding.condition.stateElementId));
  }
  return false;
}

function resolveOperationAmount(operation, action) {
  const level = Math.max(1, Math.min(12, Number(action.skillLevel) || 1));
  return Number(
    operation.amountByLevel?.[level] ?? operation.amountByLevel?.[1] ?? 0
  );
}

function createResourceExecutionBlock({
  action,
  actorState,
  controlSkillId,
  selectedSubSkillIndex,
  requiredValue,
  operations,
}) {
  return {
    code: 'VERIFIED_SPECIAL_RESOURCE_INSUFFICIENT',
    status: 'blocked',
    reason: 'verified-special-resource-insufficient',
    reasons: ['special-resource-consume-precondition-failed'],
    sourceKind: 'azpr-verified-special-resource-runtime',
    sourceIdentity: operations.map(operation => operation.sourceIdentity),
    actionId: action.id,
    actionName: action.name,
    actorId: action.actorId,
    timeMs: action.startMs,
    controlSkillId,
    selectedSubSkillIndex,
    resourceIdentity: actorState.profile.resourceIdentity,
    resourceName: actorState.profile.name,
    requiredValue,
    currentValue: actorState.current,
    maxValue: actorState.profile.capacity,
  };
}

function createVariantExecutionBlock({
  action,
  actorState,
  controlSkillId,
  activeSelection,
}) {
  return {
    code: 'VERIFIED_ACTION_VARIANT_AMBIGUOUS',
    status: 'unresolved',
    reason: 'verified-action-variant-selection-ambiguous',
    reasons: activeSelection.reasons,
    sourceKind: 'azpr-verified-action-variant-runtime',
    sourceIdentity: activeSelection.candidates.map(
      candidate => candidate.sourceIdentity
    ),
    actionId: action.id,
    actionName: action.name,
    actorId: action.actorId,
    timeMs: action.startMs,
    controlSkillId,
    resourceIdentity: actorState.profile.resourceIdentity,
    resourceName: actorState.profile.name,
    requiredValue: null,
    currentValue: actorState.current,
    maxValue: actorState.profile.capacity,
  };
}

function removeExpiredSwitchWindows(windows, timeMs) {
  for (let index = windows.length - 1; index >= 0; index -= 1) {
    if (windows[index].endsAtMs <= timeMs) windows.splice(index, 1);
  }
}

function comparePendingEvents(left, right) {
  return (
    left.timeMs - right.timeMs ||
    Number(left.priority || 0) - Number(right.priority || 0) ||
    String(
      left.binding?.operationIdentity ?? left.binding?.edgeIdentity ?? ''
    ).localeCompare(
      String(
        right.binding?.operationIdentity ?? right.binding?.edgeIdentity ?? ''
      )
    )
  );
}

function compareRuntimeEvents(left, right) {
  return (
    Number(left.timeMs) - Number(right.timeMs) ||
    Number(left.runtimeSequenceIndex) - Number(right.runtimeSequenceIndex)
  );
}

function compareBindings(left, right) {
  return String(
    left.operationIdentity ?? left.edgeIdentity ?? ''
  ).localeCompare(String(right.operationIdentity ?? right.edgeIdentity ?? ''));
}

function framesToMs(frame, frameRate = FRAME_RATE) {
  const value = Number(frame);
  return Number.isFinite(value)
    ? (value * 1000) / (Number(frameRate) || FRAME_RATE)
    : 0;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}

function createUnavailableRuntime(reason) {
  return {
    schemaVersion: 1,
    contractName: VERIFIED_ACTION_VARIANT_RUNTIME_CONTRACT_NAME,
    sourceKind: 'azpr-verified-action-variant-and-special-resource-runtime',
    status: reason,
    actionResolutionById: new Map(),
    actionResolutions: [],
    selectionByActionId: new Map(),
    selections: [],
    resourceEvents: [],
    stateEvents: [],
    variantEvents: [],
    eventLog: [],
    executionBlocks: [],
    curves: [],
    summary: {
      profileCount: 0,
      selectionCount: 0,
      changedVariantCount: 0,
      resourceEventCount: 0,
      stateEventCount: 0,
      executionBlockCount: 0,
    },
    ready: false,
    applied: false,
  };
}
