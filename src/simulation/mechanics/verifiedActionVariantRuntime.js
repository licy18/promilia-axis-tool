import {
  getInstalledVerifiedCombatMechanicsPackage,
  getVerifiedCombatActionMapping,
  getVerifiedDerivedControlContract,
  resolveVerifiedCombatActionMechanics,
} from '../../data/verifiedCombatMechanicsPackage';
import {
  normalizeActionVariantInputSelection,
  resolveActionVariantInputOption,
} from '../../domain/actionVariantInputSelection';
import { isActionFrameWithinContextualOccupancy } from './actionEffectiveTimeline';
import {
  projectVerifiedAttackInputChainSegment,
  resolveVerifiedContextInputScheduling,
} from '../../domain/verifiedActionContextScheduling';
import {
  ACTION_TYPES,
  EFFECT_OPERATIONS,
  EFFECT_STACK_MODES,
  EFFECT_TARGET_KINDS,
} from '../../domain/projectSchema';
import { applyVerifiedTargetStateRuntime } from './verifiedTargetStateRuntime';

export const VERIFIED_ACTION_VARIANT_RUNTIME_CONTRACT_NAME =
  'AzPrVerifiedActionVariantRuntime';

const FRAME_RATE = 60;

export function createVerifiedActionVariantRuntime({
  scenario = null,
  actionExecutionPlan = null,
  controlledActorTimeline = null,
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
  const actorById = new Map(
    (scenario?.actors ?? []).map(actor => [String(actor.id), actor])
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
  const variantActorStateById = new Map(
    (scenario?.actors ?? []).map(actor => {
      const resourceState = actorStateById.get(actor.id);
      return [
        actor.id,
        resourceState ?? {
          actor,
          profile: {
            ownerId: Number(actor.characterId),
            resourceIdentity: null,
            name: actor.name ?? null,
            capacity: 0,
            initialValue: 0,
            applied: false,
          },
          initialValue: 0,
          current: 0,
          activeStates: new Map(),
        },
      ];
    })
  );

  const thresholdTransitions = (
    mechanicsPackage.specialResourceCatalog.thresholdTransitions ?? []
  ).filter(transition => transition.applied);
  const thresholdTransitionByOwnerId = new Map(
    thresholdTransitions.map(transition => [
      Number(transition.ownerId),
      transition,
    ])
  );
  const suppressedOperationIdentities = new Set(
    thresholdTransitions.flatMap(
      transition => transition.suppressedOperationIdentities ?? []
    )
  );
  const operations = mechanicsPackage.specialResourceCatalog.operationBindings
    .filter(
      operation =>
        operation.applied &&
        !suppressedOperationIdentities.has(operation.operationIdentity)
    )
    .sort(compareBindings);
  const passiveEffects = (
    mechanicsPackage.specialResourceCatalog.passiveEffects ?? []
  ).filter(
    profile =>
      profile.applied &&
      (profile.runtimeGenerationMode == null ||
        profile.runtimeGenerationMode === 'action-variant-runtime')
  );
  const graph = mechanicsPackage.actionVariantGraph;
  const switchBindings = graph.edges
    .filter(edge => edge.applied)
    .sort(compareBindings);
  const contextBindings = (graph.contextEdges ?? [])
    .filter(edge => edge.applied)
    .sort(compareBindings);
  const publicActionForms = (graph.publicActionForms ?? []).filter(
    form => form.applied
  );
  const attackInputChains = (graph.attackInputChains ?? [])
    .filter(chain => chain.applied)
    .sort((left, right) =>
      String(left.chainIdentity).localeCompare(String(right.chainIdentity))
    );
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
        [
          ACTION_TYPES.SKILL,
          ACTION_TYPES.KIBO_EVENT,
          ACTION_TYPES.SWITCH,
        ].includes(action.type)
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
  const switchWindowHistory = [];
  const pendingEvents = [];
  const resourceEvents = [];
  const stateEvents = [];
  const variantEvents = [];
  const effectCommands = [];
  const executionBlocks = [];
  const lastResolvedActionByActorId = new Map();
  let runtimeSequenceIndex = 0;

  for (const [actorId, state] of actorStateById) {
    for (const activeState of state.activeStates.values()) {
      const transition = thresholdTransitionByOwnerId.get(
        Number(state.profile.ownerId)
      );
      if (
        transition &&
        Number(transition.stateElementId) === Number(activeState.elementId)
      ) {
        effectCommands.push(
          createStateEffectCommand({
            mechanicsPackage,
            actorState: state,
            actorId,
            sourceActionId: activeState.sourceActionId,
            timeMs: 0,
            durationMs: activeState.expiresAtMs,
            transition,
            sourceIdentity:
              activeState.sourceIdentity ?? transition.sourceIdentity,
            operation: EFFECT_OPERATIONS.APPLY,
          })
        );
      }
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
        const window = {
          ...binding,
          actorId,
          sourceActionId: activeState.sourceActionId,
          startsAtMs: 0,
          endsAtMs:
            activeState.expiresAtMs ??
            (Number.isFinite(Number(scenario?.time?.durationMs))
              ? Number(scenario.time.durationMs)
              : Number.POSITIVE_INFINITY),
        };
        activeSwitchWindows.push(window);
        switchWindowHistory.push(window);
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

  const emitResourceChange = ({
    actorState,
    action,
    timeMs,
    operation,
    beforeValue,
    afterValue,
    stateElementId = null,
    stateName = null,
    stateDurationMs = null,
    sourceIdentity = null,
    eventType = 'VERIFIED_SPECIAL_RESOURCE_CHANGE',
  }) => {
    const event = {
      type: eventType,
      timeMs,
      actionId: action?.id ?? null,
      actorId: action?.actorId ?? actorState.actor.id,
      runtimeSequenceIndex: runtimeSequenceIndex++,
      payload: {
        resource: 'special-resource',
        resourceIdentity: actorState.profile.resourceIdentity,
        resourceName: actorState.profile.name,
        ownerCharacterId: actorState.profile.ownerId,
        operation,
        beforeValue,
        change: afterValue - beforeValue,
        afterValue,
        currentValue: afterValue,
        maxValue: actorState.profile.capacity,
        stateElementId,
        stateName,
        stateDurationMs,
        sourceIdentity,
        confidence: 'verified',
        appliedToActionVariantRuntime: true,
        appliedToCalculators: false,
      },
    };
    resourceEvents.push(event);
    if (eventType === 'VERIFIED_SPECIAL_RESOURCE_STATE_CHANGE') {
      stateEvents.push(event);
    }
    return event;
  };

  const enterOrRefreshState = ({
    actorState,
    action,
    timeMs,
    stateElementId,
    stateName,
    stateDurationMs,
    sourceIdentity,
    transition = null,
  }) => {
    const normalizedStateElementId = Number(stateElementId);
    const previous = actorState.activeStates.get(normalizedStateElementId);
    const durationMs = Number(stateDurationMs);
    const expiresAtMs = durationMs > 0 ? Number(timeMs) + durationMs : null;
    const activeState = {
      elementId: normalizedStateElementId,
      name: stateName,
      appliedAtMs: previous?.appliedAtMs ?? timeMs,
      refreshedAtMs: previous ? timeMs : null,
      expiresAtMs,
      sourceActionId: action?.id ?? previous?.sourceActionId ?? null,
      sourceIdentity,
    };
    actorState.activeStates.set(normalizedStateElementId, activeState);
    removeStateSwitchWindows({
      windows: activeSwitchWindows,
      actorId: action?.actorId ?? actorState.actor.id,
      stateElementId: normalizedStateElementId,
    });
    for (const binding of switchBindings) {
      if (
        binding.ownerId !== actorState.profile.ownerId ||
        binding.condition?.kind !== 'resource-state-active' ||
        Number(binding.condition.stateElementId) !== normalizedStateElementId
      ) {
        continue;
      }
      const window = {
        ...binding,
        actorId: action?.actorId ?? actorState.actor.id,
        sourceActionId: action?.id ?? previous?.sourceActionId ?? null,
        startsAtMs: timeMs,
        endsAtMs: expiresAtMs ?? Number.POSITIVE_INFINITY,
      };
      activeSwitchWindows.push(window);
      switchWindowHistory.push(window);
    }
    if (expiresAtMs != null) {
      pendingEvents.push({
        kind: 'state-expire',
        timeMs: expiresAtMs,
        actorId: action?.actorId ?? actorState.actor.id,
        stateElementId: normalizedStateElementId,
        sourceActionId: action?.id ?? previous?.sourceActionId ?? null,
        sourceIdentity,
        priority: 0,
      });
    }
    emitResourceChange({
      actorState,
      action,
      timeMs,
      operation: previous ? 'refresh' : 'transform',
      beforeValue: actorState.current,
      afterValue: actorState.current,
      stateElementId: normalizedStateElementId,
      stateName,
      stateDurationMs: durationMs > 0 ? durationMs : null,
      sourceIdentity,
      eventType: 'VERIFIED_SPECIAL_RESOURCE_STATE_CHANGE',
    });
    effectCommands.push(
      createStateEffectCommand({
        mechanicsPackage,
        actorState,
        actorId: action?.actorId ?? actorState.actor.id,
        sourceActionId: action?.id ?? previous?.sourceActionId ?? null,
        timeMs,
        durationMs: durationMs > 0 ? durationMs : null,
        transition: transition ?? {
          stateElementId: normalizedStateElementId,
          stateName,
          sourceIdentity,
        },
        sourceIdentity,
        operation: previous
          ? EFFECT_OPERATIONS.REFRESH
          : EFFECT_OPERATIONS.APPLY,
      })
    );
  };

  const applyResourceOperation = descriptor => {
    const state = actorStateById.get(descriptor.action.actorId);
    if (!state) return;
    const operation = descriptor.binding;
    const transition = thresholdTransitionByOwnerId.get(
      Number(state.profile.ownerId)
    );
    if (
      operation.operation === 'gain' &&
      transition?.suppressGainWhileStateActive &&
      state.activeStates.has(Number(transition.stateElementId))
    ) {
      return;
    }
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
    } else if (operation.operation === 'set-to-capacity') {
      afterValue = state.profile.capacity;
    } else if (operation.operation === 'transform') {
      enterOrRefreshState({
        actorState: state,
        action: descriptor.action,
        timeMs: descriptor.timeMs,
        stateElementId: operation.stateElementId,
        stateName: operation.stateName,
        stateDurationMs: operation.stateDurationMs,
        sourceIdentity: operation.sourceIdentity,
        transition,
      });
      return;
    } else if (operation.operation === 'transform-remove') {
      state.activeStates.delete(Number(operation.stateElementId));
      removeStateSwitchWindows({
        windows: activeSwitchWindows,
        actorId: descriptor.action.actorId,
        stateElementId: operation.stateElementId,
      });
    }
    state.current = afterValue;
    emitResourceChange({
      actorState: state,
      action: descriptor.action,
      timeMs: descriptor.timeMs,
      operation: operation.operation,
      beforeValue,
      afterValue,
      stateElementId: operation.stateElementId,
      stateName: operation.stateName,
      stateDurationMs: operation.stateDurationMs,
      sourceIdentity: operation.sourceIdentity,
      eventType: operation.operation.startsWith('transform')
        ? 'VERIFIED_SPECIAL_RESOURCE_STATE_CHANGE'
        : 'VERIFIED_SPECIAL_RESOURCE_CHANGE',
    });

    if (
      operation.operation === 'gain' &&
      transition &&
      beforeValue < Number(transition.threshold) &&
      afterValue >= Number(transition.threshold)
    ) {
      const thresholdValue = state.current;
      state.current =
        transition.resourceOperation === 'clear' ? 0 : state.current;
      if (state.current !== thresholdValue) {
        emitResourceChange({
          actorState: state,
          action: descriptor.action,
          timeMs: descriptor.timeMs,
          operation: 'threshold-clear',
          beforeValue: thresholdValue,
          afterValue: state.current,
          stateElementId: transition.stateElementId,
          stateName: transition.stateName,
          stateDurationMs: transition.stateDurationMs,
          sourceIdentity: transition.sourceIdentity,
        });
      }
      enterOrRefreshState({
        actorState: state,
        action: descriptor.action,
        timeMs: descriptor.timeMs,
        stateElementId: transition.stateElementId,
        stateName: transition.stateName,
        stateDurationMs: transition.stateDurationMs,
        sourceIdentity: transition.sourceIdentity,
        transition,
      });
    }
  };

  const applySwitchWindow = descriptor => {
    const state = actorStateById.get(descriptor.action.actorId);
    if (!state || !isSwitchConditionSatisfied(descriptor.binding, state)) {
      return;
    }
    const inputWindow = descriptor.binding.inputWindow;
    const actionStartMs = Number(descriptor.action.startMs) || 0;
    const startsAtMs = inputWindow
      ? actionStartMs + framesToMs(inputWindow.startFrame, FRAME_RATE)
      : descriptor.timeMs;
    const endsAtMs = inputWindow
      ? actionStartMs + framesToMs(inputWindow.endFrame, FRAME_RATE)
      : startsAtMs + Number(descriptor.binding.durationMs);
    const window = {
      ...descriptor.binding,
      actorId: descriptor.action.actorId,
      sourceActionId: descriptor.action.id,
      startsAtMs,
      endsAtMs,
    };
    activeSwitchWindows.push(window);
    switchWindowHistory.push(window);
  };

  const applyStateExpiration = descriptor => {
    const state = actorStateById.get(descriptor.actorId);
    const active = state?.activeStates.get(descriptor.stateElementId);
    if (!active || active.expiresAtMs !== descriptor.timeMs) return;
    state.activeStates.delete(descriptor.stateElementId);
    removeStateSwitchWindows({
      windows: activeSwitchWindows,
      actorId: descriptor.actorId,
      stateElementId: descriptor.stateElementId,
    });
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
    if (action.type === ACTION_TYPES.SWITCH) {
      lastResolvedActionByActorId.clear();
      removeAttackChainContinuityWindows(activeSwitchWindows);
      continue;
    }
    const mapping = getVerifiedCombatActionMapping(action);
    if (mapping?.actionKind !== 'normal-attack') {
      removeAttackChainContinuityWindows(
        activeSwitchWindows,
        action.actorId
      );
    }
    const actorState = variantActorStateById.get(action.actorId);
    const scenarioActor = actorById.get(String(action.actorId));
    const characterId = Number(
      action.actor?.characterId ??
        scenarioActor?.characterId ??
        actorState?.profile?.ownerId
    );
    const attackChainSelection = resolveAttackInputChainAction({
      action,
      mapping,
      actorState,
      attackInputChains,
      activeSwitchWindows,
      previous: lastResolvedActionByActorId.get(action.actorId),
      timeMs: actionTimeMs,
    });
    if (attackChainSelection.status === 'blocked') {
      const block = createAttackChainExecutionBlock({
        action,
        actorState,
        chain: attackChainSelection.chain,
      });
      executionBlocks.push(block);
      actionResolutionById.set(action.id, {
        ...resolveVerifiedCombatActionMechanics(action, {
          combatScenario: scenario.combatScenario,
        }),
        ready: false,
        applied: false,
        status: block.reason,
        reasons: block.reasons,
      });
      selectionByActionId.set(action.id, {
        actionId: action.id,
        actorId: action.actorId,
        ownerId: characterId || null,
        controlSkillId: null,
        selectedSubSkillIndex: null,
        selectionReason: block.reason,
        sourceKind: 'verified-active-attack-input-chain',
        sourceIdentity: attackChainSelection.chain?.sourceIdentity ?? null,
        status: block.reason,
      });
      lastResolvedActionByActorId.delete(action.actorId);
      continue;
    }
    const runtimeAction = attackChainSelection.action ?? action;
    const publicControlSkillId = resolveActionControlSkillId(
      runtimeAction,
      mapping
    );
    const directExecutionForm = resolveDirectPublicActionExecutionForm({
      publicActionForms,
      ownerId: characterId,
      publicControlSkillId,
      actorState,
    });
    const derivedControlContract = getVerifiedDerivedControlContract({
      ownerKind: mapping?.ownerKind ?? 'actor',
      ownerId: characterId,
      controlSkillId: publicControlSkillId,
    });
    let executionControlSkillId =
      directExecutionForm?.executionControlSkillId ?? publicControlSkillId;
    let selectedSubSkillIndex =
      directExecutionForm?.executionSubSkillIndex ??
      mapping?.selectedSubSkillIndex ??
      null;
    let selectionSource = directExecutionForm
      ? {
          sourceKind: `verified-public-action-form-${directExecutionForm.selectionKind}`,
          sourceIdentity: directExecutionForm.sourceIdentity,
          decisionFrame: directExecutionForm.decisionFrame ?? 0,
          executionTiming: directExecutionForm.executionTiming,
          semanticIdentity: directExecutionForm.semanticIdentity,
          semanticName: directExecutionForm.semanticName,
        }
      : null;

    if (Number.isInteger(publicControlSkillId)) {
      const activeSelection = actorState
        ? resolveActiveSwitchSelection({
            activeSwitchWindows,
            actorId: action.actorId,
            controlSkillId: publicControlSkillId,
            timeMs: actionTimeMs,
            actionKind: mapping?.actionKind,
          })
        : { status: 'none', binding: null };
      const contextSelection = actorState
        ? resolveContextVariantSelection({
            contextBindings,
            previous: lastResolvedActionByActorId.get(action.actorId),
            actorState,
            controlSkillId: publicControlSkillId,
            timeMs: actionTimeMs,
          })
        : { status: 'none', binding: null };
      if (
        activeSelection.status === 'ambiguous' &&
        !attackChainSelection.segment &&
        !contextSelection.binding
      ) {
        const block = createVariantExecutionBlock({
          action,
          actorState,
          controlSkillId: publicControlSkillId,
          activeSelection,
        });
        executionBlocks.push(block);
        actionResolutionById.set(action.id, {
          ...resolveVerifiedCombatActionMechanics(action, {
            combatScenario: scenario.combatScenario,
          }),
          ready: false,
          applied: false,
          status: block.reason,
          reasons: block.reasons,
        });
        continue;
      }
      const defaultSelection = defaultSelectionByControl.get(
        `${characterId}|${publicControlSkillId}`
      );
      const inputSelection = resolveDerivedInputSelection({
        action: runtimeAction,
        contract: derivedControlContract,
      });
      if (inputSelection.status === 'invalid') {
        const block = createInputVariantExecutionBlock({
          action,
          actorState,
          controlSkillId: publicControlSkillId,
          contract: derivedControlContract,
          inputSelection,
        });
        executionBlocks.push(block);
        actionResolutionById.set(action.id, {
          ...resolveVerifiedCombatActionMechanics(action, {
            combatScenario: scenario.combatScenario,
          }),
          ready: false,
          applied: false,
          status: block.reason,
          reasons: block.reasons,
        });
        selectionByActionId.set(
          action.id,
          createVariantSelectionRecord({
            action,
            characterId,
            publicControlSkillId,
            executionControlSkillId: publicControlSkillId,
            contract: derivedControlContract,
            inputSelection,
            selectedSubSkillIndex: null,
            selectionSource: null,
            resolution: null,
            status: block.reason,
          })
        );
        continue;
      }
      const explicitSubSkillIndex = Number.isInteger(
        Number(runtimeAction.controlSubSkillIndex)
      )
        ? Number(runtimeAction.controlSubSkillIndex)
        : null;
      selectedSubSkillIndex =
        contextSelection.binding?.targetSubSkillIndex ??
        attackChainSelection.segment?.subSkillIndex ??
        activeSelection.binding?.targetSubSkillIndex ??
        inputSelection.option?.subSkillIndex ??
        explicitSubSkillIndex ??
        directExecutionForm?.executionSubSkillIndex ??
        (derivedControlContract?.inputSelector?.resolutionStatus === 'applied'
          ? null
          : defaultSelection?.subSkillIndex) ??
        selectedSubSkillIndex;
      executionControlSkillId =
        contextSelection.binding?.executionControlSkillId ??
        inputSelection.option?.executionControlSkillId ??
        directExecutionForm?.executionControlSkillId ??
        publicControlSkillId;
      selectionSource = contextSelection.binding
        ? {
            sourceKind: 'verified-input-context-variant',
            sourceIdentity: contextSelection.binding.sourceIdentity,
            decisionFrame: contextSelection.binding.decisionFrame,
            contextActionId: contextSelection.previous?.actionId ?? null,
            executionTiming: contextSelection.binding.executionTiming ?? null,
            semanticIdentity: contextSelection.binding.semanticIdentity ?? null,
            semanticName: contextSelection.binding.semanticName ?? null,
            contextualInputScheduling:
              action.contextualInputScheduling ??
              contextSelection.inputScheduling ??
              null,
          }
        : attackChainSelection.segment
          ? {
              sourceKind: 'verified-active-attack-input-chain',
              sourceIdentity: [
                attackChainSelection.chain.sourceIdentity,
                attackChainSelection.segment.sourceIdentity,
              ].join('|'),
              decisionFrame: attackChainSelection.chain.decisionFrame,
              chainIdentity: attackChainSelection.chain.chainIdentity,
              chainSequenceIndex: attackChainSelection.sequenceIndex,
              semanticIdentity: `${attackChainSelection.chain.chainIdentity}:segment:${attackChainSelection.segment.sequenceIndex}`,
              semanticName: attackChainSelection.segment.semanticName
                ? attackChainSelection.segment.semanticName
                : attackChainSelection.chain.semanticNamePrefix
                  ? `${attackChainSelection.chain.semanticNamePrefix} ${attackChainSelection.segment.label ?? `A${attackChainSelection.segment.sequenceIndex}`}`
                  : (action.name ??
                    `A${attackChainSelection.segment.sequenceIndex}`),
            }
          : activeSelection.binding
            ? {
                sourceKind: 'verified-active-switch-skill-index-window',
                sourceIdentity: activeSelection.binding.sourceIdentity,
                decisionFrame: activeSelection.binding.decisionFrame,
              }
            : inputSelection.option
              ? {
                  sourceKind: inputSelection.sourceKind,
                  sourceIdentity: inputSelection.option.sourceIdentity,
                  decisionFrame: derivedControlContract?.decisionFrame ?? 0,
                  executionTiming: inputSelection.option.executionTiming,
                  semanticIdentity: inputSelection.option.selectorIdentity,
                  semanticName: inputSelection.option.label,
                }
              : explicitSubSkillIndex != null
                ? {
                    sourceKind: 'workbench-explicit-input-variant',
                    sourceIdentity: `${action.id}|controlSubSkillIndex=${explicitSubSkillIndex}`,
                    decisionFrame: 0,
                  }
                : directExecutionForm
                  ? {
                      sourceKind: `verified-public-action-form-${directExecutionForm.selectionKind}`,
                      sourceIdentity: directExecutionForm.sourceIdentity,
                      decisionFrame: directExecutionForm.decisionFrame ?? 0,
                      executionTiming: directExecutionForm.executionTiming,
                      semanticIdentity: directExecutionForm.semanticIdentity,
                      semanticName: directExecutionForm.semanticName,
                    }
                : defaultSelection
                  ? {
                      sourceKind: 'verified-client-default-subskill-index',
                      sourceIdentity: defaultSelection.sourceIdentity,
                      decisionFrame: defaultSelection.decisionFrame,
                    }
                  : null;
      const semanticForm = resolvePublicActionForm({
        publicActionForms,
        ownerId: characterId,
        publicControlSkillId,
        executionControlSkillId,
        selectedSubSkillIndex,
        actorState,
      });
      if (semanticForm) {
        selectionSource = {
          ...(selectionSource ?? {}),
          sourceKind:
            selectionSource?.sourceKind ??
            `verified-public-action-form-${semanticForm.selectionKind}`,
          sourceIdentity:
            selectionSource?.sourceIdentity ?? semanticForm.sourceIdentity,
          decisionFrame:
            selectionSource?.decisionFrame ?? semanticForm.decisionFrame ?? 0,
          executionTiming:
            selectionSource?.executionTiming ?? semanticForm.executionTiming,
          semanticIdentity: semanticForm.semanticIdentity,
          semanticName: semanticForm.semanticName,
        };
      }
    }

    const resolution = applyAttackInputChainTimingResolution({
      resolution: resolveVerifiedCombatActionMechanics(runtimeAction, {
        selectedControlSkillId: executionControlSkillId,
        selectedSubSkillIndex,
        selectionSource,
        combatScenario: scenario.combatScenario,
      }),
      chain: attackChainSelection.chain,
      segment: attackChainSelection.segment,
      attackInputSegment: runtimeAction.attackInput,
    });
    actionResolutionById.set(action.id, resolution);
    selectionByActionId.set(
      action.id,
      createVariantSelectionRecord({
        action,
        characterId,
        publicControlSkillId,
        executionControlSkillId,
        contract: derivedControlContract,
        inputSelection: resolveDerivedInputSelection({
          action: runtimeAction,
          contract: derivedControlContract,
        }),
        selectedSubSkillIndex,
        selectionSource,
        resolution,
      })
    );
    if (
      !resolution.ready ||
      !actorState ||
      !Number.isInteger(executionControlSkillId)
    ) {
      lastResolvedActionByActorId.delete(action.actorId);
      continue;
    }

    const continuationWindow = createAttackChainContinuationWindow({
      actorState,
      action,
      actionTimeMs,
      executionControlSkillId,
      selectedSubSkillIndex,
      previous: lastResolvedActionByActorId.get(action.actorId),
      attackInputChains,
      activeSwitchWindows,
    });
    if (continuationWindow) {
      activeSwitchWindows.push(continuationWindow);
      switchWindowHistory.push(continuationWindow);
    }

    const selectedOperations = operations.filter(
      operation =>
        operation.ownerId === characterId &&
        operation.controlSkillId === executionControlSkillId &&
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
        controlSkillId: executionControlSkillId,
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
      lastResolvedActionByActorId.delete(action.actorId);
      continue;
    }

    for (const operation of selectedOperations) {
      if (
        !isActionFrameWithinContextualOccupancy(
          action,
          operation.triggerFrame,
          operation.frameRate ?? FRAME_RATE
        )
      ) {
        continue;
      }
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
        binding.sourceControlSkillId !== executionControlSkillId ||
        binding.sourceSubSkillIndex !== selectedSubSkillIndex
      ) {
        continue;
      }
      if (
        !isActionFrameWithinContextualOccupancy(
          action,
          binding.activationFrame,
          FRAME_RATE
        )
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
    for (const passiveProfile of passiveEffects) {
      if (Number(passiveProfile.ownerId) !== characterId) continue;
      for (const trigger of passiveProfile.triggerBindings ?? []) {
        if (
          Number(trigger.controlSkillId) !== executionControlSkillId ||
          Number(trigger.subSkillIndex) !== selectedSubSkillIndex
        ) {
          continue;
        }
        if (
          !isActionFrameWithinContextualOccupancy(
            action,
            trigger.triggerFrame,
            trigger.frameRate ?? FRAME_RATE
          )
        ) {
          continue;
        }
        effectCommands.push(
          createPassiveEffectCommand({
            mechanicsPackage,
            action,
            actorState,
            resolution,
            profile: passiveProfile,
            trigger,
            timeMs:
              actionTimeMs +
              framesToMs(trigger.triggerFrame, trigger.frameRate),
          })
        );
      }
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
    lastResolvedActionByActorId.set(action.actorId, {
      actionId: action.id,
      actorId: action.actorId,
      controlSkillId: executionControlSkillId,
      selectedSubSkillIndex,
      startMs: actionTimeMs,
      effectiveDurationFrames:
        resolution.actionBinding?.effectiveOccupancyFrames ??
        resolution.actionBinding?.actualDurationFrames ??
        resolution.actionBinding?.actionTiming?.occupancy?.durationFrames ??
        null,
      sourceIdentity:
        resolution.actionBinding?.bindingSourceIdentity ??
        resolution.actionBinding?.sourceIdentity ??
        null,
      attackGroupId: action.attackGroupId ?? null,
      attackInputChainIdentity:
        attackChainSelection.chain?.chainIdentity ?? null,
      attackSequenceIndex: attackChainSelection.sequenceIndex ?? null,
      attackChainSequenceIndex: attackChainSelection.sequenceIndex ?? null,
      ready: true,
    });
  }

  flushPending(Number(scenario?.time?.durationMs) || 0);
  const targetStateRuntime = applyVerifiedTargetStateRuntime({
    scenario,
    actionResolutionById,
    mechanicsPackage,
    controlledActorTimeline,
  });
  effectCommands.push(...targetStateRuntime.effectCommands);
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
    effectCommands,
    directSpEvents: targetStateRuntime.directSpEvents,
    targetStateRuntime,
    activeSwitchWindows: switchWindowHistory,
    eventLog: [
      ...resourceEvents,
      ...variantEvents,
      ...targetStateRuntime.events,
    ].sort(compareRuntimeEvents),
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
      effectCommandCount: effectCommands.length,
      targetStateEventCount: targetStateRuntime.events.length,
      conditionalHitGroupCount: targetStateRuntime.groupResults.length,
      directSpEventCount: targetStateRuntime.directSpEvents.length,
      executionBlockCount: executionBlocks.length,
    },
    ready: true,
    applied: true,
  };
}

function resolveAttackInputChainAction({
  action,
  mapping,
  actorState,
  attackInputChains,
  activeSwitchWindows = [],
  previous = null,
  timeMs = 0,
}) {
  if (
    mapping?.actionKind !== 'normal-attack' ||
    !actorState ||
    !Number.isInteger(Number(action?.attackSequenceIndex))
  ) {
    return { status: 'not-required', action, chain: null, segment: null };
  }
  const ownerChains = (attackInputChains ?? []).filter(
    chain =>
      chain.applied === true &&
      Number(chain.ownerId) === Number(actorState.profile.ownerId) &&
      Number(chain.sourceSkillId) === Number(mapping.sourceSkillId)
  );
  const explicitChainIdentity =
    action.attackInputChainIdentity ??
    action.attackInput?.attackInputChainIdentity ??
    null;
  const runtimeContextIntent =
    action.attackInputIntent?.kind === 'public-normal-attack' &&
    action.attackInputIntent?.selectionMode === 'runtime-context' &&
    action.attackInputChainSelectionSource !== 'user-explicit';
  let chain = null;
  let derivedEntry = null;
  let continuedSequenceIndex = null;
  if (explicitChainIdentity && !runtimeContextIntent) {
    chain =
      ownerChains.find(
        candidate => candidate.chainIdentity === explicitChainIdentity
      ) ?? null;
    if (
      chain &&
      !isRuntimeConditionSatisfied(chain.stateCondition, actorState)
    ) {
      return { status: 'blocked', action, chain, segment: null };
    }
  } else {
    const matchingChains = ownerChains.filter(chain =>
      isRuntimeConditionSatisfied(chain.stateCondition, actorState)
    );
    const continuedChain =
      Number(action.attackSequenceIndex) > 1 &&
      previous?.ready &&
      previous.attackGroupId != null &&
      String(previous.attackGroupId) === String(action.attackGroupId)
        ? matchingChains.find(
            candidate =>
              candidate.chainIdentity === previous.attackInputChainIdentity
          )
        : null;
    if (continuedChain) {
      continuedSequenceIndex =
        Number(previous.attackChainSequenceIndex) ||
        Number(previous.attackSequenceIndex) ||
        null;
      if (continuedSequenceIndex != null) continuedSequenceIndex += 1;
    }
    const derivedEntries = matchingChains
      .filter(
        candidate =>
          candidate.entryPolicy?.kind === 'derived-or-quick-entry'
      )
      .map(candidate =>
        resolveRuntimeDerivedAttackChainEntry({
          chain: candidate,
          ownerChains,
          actorState,
          activeSwitchWindows,
          previous,
          timeMs,
        })
      )
      .filter(Boolean);
    const conditionSelected = matchingChains.filter(
      candidate =>
        !candidate.entryPolicy ||
        candidate.entryPolicy.kind === 'condition-selected'
    );
    const defaults = matchingChains.filter(
      candidate => candidate.entryPolicy?.kind === 'default'
    );
    chain =
      continuedChain ??
      (derivedEntries.length === 1
        ? derivedEntries[0].chain
        : conditionSelected.length === 1
          ? conditionSelected[0]
          : defaults.length === 1
            ? defaults[0]
            : matchingChains.length === 1
              ? matchingChains[0]
              : null);
    derivedEntry =
      chain && derivedEntries.length === 1 ? derivedEntries[0] : null;
  }
  if (!chain) {
    return { status: 'not-required', action, chain: null, segment: null };
  }
  const sequenceIndex =
    continuedSequenceIndex ??
    derivedEntry?.sequenceIndex ??
    Number(action.attackSequenceIndex);
  const segment = chain.segments.find(
    item => Number(item.sequenceIndex) === sequenceIndex
  );
  if (!segment) {
    return { status: 'blocked', action, chain, segment: null };
  }
  const sourceSegment = (
    mapping.attackInputSourceSegments ??
    mapping.attackInputSegments ??
    []
  ).find(
    item => Number(item.controlSkillId) === Number(segment.controlSkillId)
  );
  if (!sourceSegment) {
    return { status: 'blocked', action, chain, segment: null };
  }
  const projectedSegment = projectVerifiedAttackInputChainSegment(
    sourceSegment,
    segment,
    sequenceIndex,
    chain.segments.length
  );
  if (!projectedSegment) {
    return { status: 'blocked', action, chain, segment: null };
  }
  return {
    status: 'selected',
    chain,
    segment,
    action: {
      ...action,
      attackInputChainIdentity: chain.chainIdentity,
      controlSubSkillIndex: segment.subSkillIndex,
      attackInput: projectedSegment,
    },
    sequenceIndex,
    derivedEntry,
  };
}

function resolveRuntimeDerivedAttackChainEntry({
  chain,
  ownerChains,
  actorState,
  activeSwitchWindows,
  previous,
  timeMs,
}) {
  if (!chain.segments?.length || !hasAttackChainEntryResource(chain, actorState)) {
    return null;
  }
  const quickEntries = (activeSwitchWindows ?? [])
    .filter(
      window =>
      (window.compilerBindingIdentity != null ||
        window.relationType === 'attack-chain-continuity-window') &&
      String(window.actorId) === String(actorState.actor.id) &&
      Number(window.startsAtMs) <= Number(timeMs) &&
      Number(timeMs) < Number(window.endsAtMs)
    )
    .map(window => {
      const segment = chain.segments.find(
        candidate =>
          Number(candidate.controlSkillId) ===
            Number(window.targetControlSkillId) &&
          Number(candidate.subSkillIndex) ===
            Number(window.targetSubSkillIndex) &&
          (window.targetChainIdentity == null ||
            String(window.targetChainIdentity) === String(chain.chainIdentity))
      );
      return segment ? { window, segment } : null;
    })
    .filter(Boolean)
    .sort(
      (left, right) =>
        Number(right.window.startsAtMs) - Number(left.window.startsAtMs) ||
        Number(right.segment.sequenceIndex) -
          Number(left.segment.sequenceIndex) ||
        String(left.window.edgeIdentity).localeCompare(
          String(right.window.edgeIdentity)
        )
    );
  if (quickEntries.length > 0) {
    return {
      chain,
      sequenceIndex: Number(quickEntries[0].segment.sequenceIndex),
      sourceKind: quickEntries[0].window.relationType,
      sourceIdentity: quickEntries[0].window.sourceIdentity,
    };
  }
  if (!previous?.ready) return null;

  for (const sourceChain of ownerChains ?? []) {
    const transition = sourceChain.phaseTransition;
    if (
      transition?.applied !== true ||
      transition.targetChainIdentity !== chain.chainIdentity
    ) {
      continue;
    }
    const sourceSegment = sourceChain.segments?.find(
      segment =>
        Number(segment.sequenceIndex) === Number(transition.sourceSequenceIndex)
    );
    if (
      !sourceSegment ||
      Number(previous.controlSkillId) !==
        Number(sourceSegment.controlSkillId) ||
      Number(previous.selectedSubSkillIndex) !==
        Number(sourceSegment.subSkillIndex)
    ) {
      continue;
    }
    const relativeFrame = Math.round(
      ((Number(timeMs) - Number(previous.startMs)) * FRAME_RATE) / 1000
    );
    if (
      relativeFrame >= Number(transition.inputWindow?.startFrame) &&
      relativeFrame < Number(transition.inputWindow?.endFrame)
    ) {
      return {
        chain,
        sequenceIndex: 1,
        sourceKind: 'attack-chain-phase-transition',
        sourceIdentity: transition.sourceIdentity,
      };
    }
  }
  return null;
}

function hasAttackChainEntryResource(chain, actorState) {
  const segmentLimit = chain.segmentLimit;
  if (!segmentLimit || segmentLimit.kind !== 'resource-current-value') {
    return true;
  }
  const costPerSegment = Number(segmentLimit.costPerSegment);
  return costPerSegment > 0 && Number(actorState.current) >= costPerSegment;
}

function createAttackChainContinuationWindow({
  actorState,
  action,
  actionTimeMs,
  executionControlSkillId,
  selectedSubSkillIndex,
  previous,
  attackInputChains,
  activeSwitchWindows,
}) {
  if (!actorState || !previous?.ready || !previous.attackInputChainIdentity) {
    return null;
  }
  const chain = (attackInputChains ?? []).find(
    candidate =>
      candidate.applied === true &&
      Number(candidate.ownerId) === Number(actorState.profile.ownerId) &&
      String(candidate.chainIdentity) ===
        String(previous.attackInputChainIdentity)
  );
  if (!chain) return null;
  const previousSequenceIndex =
    Number(previous.attackChainSequenceIndex) ||
    Number(previous.attackSequenceIndex);
  const targetSequenceIndex = previousSequenceIndex + 1;
  const targetSegment = chain.segments?.find(
    segment => Number(segment.sequenceIndex) === targetSequenceIndex
  );
  if (!targetSegment || !hasAttackChainEntryResource(chain, actorState)) {
    return null;
  }
  const matchingRule = (chain.continuityRules ?? []).find(
    rule =>
      rule.applied === true &&
      Number(rule.intermediaryControlSkillId) ===
        Number(executionControlSkillId) &&
      Number(rule.intermediarySubSkillIndex) ===
        Number(selectedSubSkillIndex) &&
      isRuntimeConditionSatisfied(rule.condition, actorState) &&
      (activeSwitchWindows ?? []).some(
        window =>
          String(window.actorId) === String(actorState.actor.id) &&
          Number(window.targetControlSkillId) ===
            Number(rule.requiredActiveTargetControlSkillId) &&
          Number(window.targetSubSkillIndex) ===
            Number(rule.requiredActiveTargetSubSkillIndex) &&
          Number(window.startsAtMs) <= Number(actionTimeMs) &&
          Number(actionTimeMs) < Number(window.endsAtMs)
      )
  );
  if (!matchingRule) return null;
  const startsAtMs =
    Number(actionTimeMs) +
    framesToMs(matchingRule.inputWindow.startFrame, FRAME_RATE);
  const endsAtMs =
    Number(actionTimeMs) +
    framesToMs(matchingRule.inputWindow.endFrame, FRAME_RATE);
  return {
    edgeIdentity: `attack-chain-continuity:${action.id}:${matchingRule.ruleIdentity}:${targetSequenceIndex}`,
    ownerId: Number(actorState.profile.ownerId),
    actorId: action.actorId,
    sourceActionId: action.id,
    sourceControlSkillId: Number(executionControlSkillId),
    sourceSubSkillIndex: Number(selectedSubSkillIndex),
    targetControlSkillId: Number(targetSegment.controlSkillId),
    targetSubSkillIndex: Number(targetSegment.subSkillIndex),
    targetChainIdentity: chain.chainIdentity,
    targetSequenceIndex,
    activationFrame: Number(matchingRule.inputWindow.startFrame),
    decisionFrame: Number(matchingRule.inputWindow.startFrame),
    durationMs: endsAtMs - startsAtMs,
    inputWindow: matchingRule.inputWindow,
    relationType: 'attack-chain-continuity-window',
    inputCommand: matchingRule.inputCommand,
    condition: matchingRule.condition,
    startsAtMs,
    endsAtMs,
    sourceIdentity: matchingRule.sourceIdentity,
    status: 'applied',
    applied: true,
  };
}

function applyAttackInputChainTimingResolution({
  resolution,
  chain,
  segment,
  attackInputSegment,
}) {
  if (!resolution?.actionBinding || !chain || !segment) return resolution;
  const durationFrames = Number(segment.durationFrames);
  if (!(durationFrames > 0)) return resolution;
  const frameRate = Number(resolution.controlBinding?.frameRate) || FRAME_RATE;
  const occupancy = {
    ...(resolution.actionBinding.actionTiming?.occupancy ?? {}),
    status: 'applied',
    sourceKind: 'verified-attack-input-chain',
    durationFrames,
    startFrame: 0,
    endFrame: durationFrames,
    sourceIdentity: segment.sourceIdentity,
    reasons: [],
  };
  return {
    ...resolution,
    actionBinding: {
      ...resolution.actionBinding,
      attackInputSegment: attackInputSegment
        ? {
            ...attackInputSegment,
            selectedSubSkillIndex: segment.subSkillIndex,
            durationFrames,
            effectiveDurationFrames: durationFrames,
            durationStatus: 'applied',
            durationBasis: 'verified-attack-input-chain',
            durationSourceIdentity: segment.sourceIdentity,
          }
        : resolution.actionBinding.attackInputSegment,
      actionTiming: {
        ...(resolution.actionBinding.actionTiming ?? {}),
        status: 'applied',
        selectedSubSkillIndex: segment.subSkillIndex,
        occupancy,
        sourceIdentity: segment.sourceIdentity,
        reasons: [],
      },
      effectiveOccupancyFrames: durationFrames,
      actualDurationFrames: durationFrames,
      actualDurationMs: framesToMs(durationFrames, frameRate),
      timingStatus: 'applied',
      attackInputChainIdentity: chain.chainIdentity,
    },
  };
}

function resolveContextVariantSelection({
  contextBindings,
  previous,
  actorState,
  controlSkillId,
  timeMs,
}) {
  if (!previous?.ready) {
    return { status: 'none', binding: null, previous: null };
  }
  const candidates = (contextBindings ?? []).filter(binding => {
    if (
      Number(binding.ownerId) !== Number(actorState.profile.ownerId) ||
      Number(binding.sourceControlSkillId) !==
        Number(previous.controlSkillId) ||
      Number(binding.sourceSubSkillIndex) !==
        Number(previous.selectedSubSkillIndex) ||
      Number(binding.targetControlSkillId) !== Number(controlSkillId) ||
      !isRuntimeConditionSatisfied(binding.condition, actorState)
    ) {
      return false;
    }
    return true;
  });
  const inputScheduling = resolveVerifiedContextInputScheduling({
    edges: candidates,
    predecessorStartMs: previous.startMs,
    predecessorEffectiveEndFrame: previous.effectiveDurationFrames,
    requestedExecutionStartMs: timeMs,
  });
  if (!inputScheduling) {
    return { status: 'none', binding: null, previous };
  }
  return {
    status: 'selected',
    binding: inputScheduling.edge,
    previous,
    inputScheduling,
  };
}

function resolvePublicActionForm({
  publicActionForms,
  ownerId,
  publicControlSkillId,
  executionControlSkillId,
  selectedSubSkillIndex,
  actorState,
}) {
  return (
    (publicActionForms ?? []).find(
      form =>
        Number(form.ownerId) === Number(ownerId) &&
        Number(form.publicControlSkillId) === Number(publicControlSkillId) &&
        Number(form.executionControlSkillId) ===
          Number(executionControlSkillId) &&
        Number(form.executionSubSkillIndex) === Number(selectedSubSkillIndex) &&
        isRuntimeConditionSatisfied(form.condition, actorState)
    ) ?? null
  );
}

function resolveDirectPublicActionExecutionForm({
  publicActionForms,
  ownerId,
  publicControlSkillId,
  actorState,
}) {
  return (
    (publicActionForms ?? []).find(
      form =>
        Number(form.ownerId) === Number(ownerId) &&
        Number(form.publicControlSkillId) === Number(publicControlSkillId) &&
        ['direct-execution', 'wrapper-derived-execution'].includes(
          form.selectionKind
        ) &&
        isRuntimeConditionSatisfied(form.condition, actorState)
    ) ?? null
  );
}

function isRuntimeConditionSatisfied(condition, actorState) {
  if (!condition) return true;
  if (condition.kind === 'always') return true;
  if (condition.kind === 'resource-state-active') {
    return actorState.activeStates.has(Number(condition.stateElementId));
  }
  if (condition.kind === 'resource-state-inactive') {
    return !actorState.activeStates.has(Number(condition.stateElementId));
  }
  if (condition.kind === 'resource-at-least') {
    return actorState.current >= Number(condition.value || 0);
  }
  if (condition.kind === 'resource-below') {
    return actorState.current < Number(condition.value || 0);
  }
  return false;
}

function createStateEffectCommand({
  mechanicsPackage,
  actorState,
  actorId,
  sourceActionId,
  timeMs,
  durationMs,
  transition,
  sourceIdentity,
  operation,
}) {
  const effectIdentity = `special-resource-state:${transition.stateElementId}`;
  return {
    id: `verified-state|${sourceActionId ?? 'inherited'}|${effectIdentity}|${timeMs}`,
    sourceActionId: sourceActionId ?? null,
    sourceActionName: transition.stateName,
    sourceActorId: actorId,
    sourceActorName: actorState.actor.name,
    effectId: `battle-element:${transition.stateElementId}`,
    effectName: transition.stateName,
    operation,
    targetKind: EFFECT_TARGET_KINDS.ACTOR,
    targetId: String(actorId),
    targetName: actorState.actor.name,
    timeMs,
    durationMs,
    stackMode: EFFECT_STACK_MODES.REPLACE,
    stackDelta: 1,
    maxStacks: 1,
    tags: ['special-resource-state', 'action-variant-state'],
    sourceStatus: 'verified-action-state-generated',
    confidence: 'high',
    trackingStatus: 'applied',
    sourceIdentity: {
      packageId: mechanicsPackage.packageId,
      packageHash: mechanicsPackage.packageHash,
      actionBindingIdentity: transition.transitionIdentity ?? effectIdentity,
      effectIdentity,
      sourceIdentity,
    },
    modifiers: [],
    appliedToCalculators: false,
    generatedVerified: true,
  };
}

function createPassiveEffectCommand({
  mechanicsPackage,
  action,
  actorState,
  resolution,
  profile,
  trigger,
  timeMs,
}) {
  const effectIdentity = profile.passiveIdentity;
  return {
    id: `verified-passive|${action.id}|${effectIdentity}|${trigger.triggerIdentity}`,
    sourceActionId: action.id,
    sourceActionName: action.name,
    sourceActorId: action.actorId,
    sourceActorName: action.actor?.name ?? actorState.actor.name,
    effectId: profile.effectId,
    effectName: profile.name,
    operation: EFFECT_OPERATIONS.APPLY,
    targetKind: EFFECT_TARGET_KINDS.ACTOR,
    targetId: String(action.actorId),
    targetName: action.actor?.name ?? actorState.actor.name,
    timeMs,
    durationMs: profile.durationMs,
    stackMode: EFFECT_STACK_MODES.STACK,
    stackDelta: trigger.stackDelta ?? profile.stackDelta,
    maxStacks: profile.maxStacks,
    tags: ['passive', `passive:${profile.skillId}`],
    sourceStatus: 'verified-passive-effect-generated',
    confidence: 'high',
    trackingStatus: 'applied',
    sourceIdentity: {
      packageId: mechanicsPackage.packageId,
      packageHash: mechanicsPackage.packageHash,
      actionBindingIdentity: resolution.actionBinding.identity,
      effectIdentity,
      sourceIdentity: [profile.sourceIdentity, trigger.sourceIdentity].join(
        '|'
      ),
    },
    modifiers: profile.modifiers.map(modifier => ({
      kind: 'battle-property',
      attributeId: modifier.attributeId,
      bucket: modifier.bucket,
      valueRaw: modifier.valueRaw,
      propertyTags: modifier.propertyTags ?? [],
      sourceIdentity: modifier.sourceIdentity,
    })),
    appliedToCalculators: true,
    generatedVerified: true,
  };
}

function resolveDerivedInputSelection({ action, contract } = {}) {
  const selector = contract?.inputSelector;
  if (selector?.resolutionStatus !== 'applied') {
    return { status: 'not-required', option: null, selection: null };
  }
  const requested = normalizeActionVariantInputSelection(
    action?.variantInputSelection
  );
  if (requested) {
    const option = resolveActionVariantInputOption(contract, requested);
    return option
      ? {
          status: 'selected',
          option,
          selection: requested,
          sourceKind: 'workbench-semantic-input-variant',
        }
      : {
          status: 'invalid',
          option: null,
          selection: requested,
          reason: 'selected-input-variant-not-in-current-contract',
        };
  }

  const publicVariantIndex = Number(action?.actionVariantIndex);
  const publicOption = selector.options?.find(
    option => Number(option.publicVariantIndex) === publicVariantIndex
  );
  if (publicOption) {
    return {
      status: 'selected',
      option: publicOption,
      selection: null,
      sourceKind: 'workbench-public-action-input-variant',
    };
  }

  const legacySubSkillIndex = Number(action?.controlSubSkillIndex);
  const legacyOption = Number.isInteger(legacySubSkillIndex)
    ? selector.options?.find(
        option => Number(option.subSkillIndex) === legacySubSkillIndex
      )
    : null;
  if (legacyOption) {
    return {
      status: 'selected',
      option: legacyOption,
      selection: null,
      sourceKind: 'legacy-workbench-explicit-subskill',
    };
  }

  return {
    status: 'invalid',
    option: null,
    selection: null,
    reason: 'input-variant-selection-required',
  };
}

function createVariantSelectionRecord({
  action,
  characterId,
  publicControlSkillId,
  executionControlSkillId,
  contract,
  inputSelection,
  selectedSubSkillIndex,
  selectionSource,
  resolution,
  status = null,
}) {
  const selector = contract?.inputSelector;
  return {
    actionId: action.id,
    actorId: action.actorId,
    ownerId: characterId || null,
    publicControlSkillId,
    controlSkillId: executionControlSkillId,
    executionControlSkillId,
    selectedSubSkillIndex,
    semanticIdentity:
      selectionSource?.semanticIdentity ??
      resolution?.actionBinding?.semanticIdentity ??
      null,
    semanticName:
      selectionSource?.semanticName ??
      resolution?.actionBinding?.semanticName ??
      action.name ??
      null,
    controlSource: contract?.controlSource ?? 'single-variant',
    contractIdentity: contract?.contractIdentity ?? null,
    contractResolutionStatus: contract?.resolutionStatus ?? 'applied',
    inputSelector:
      selector == null
        ? null
        : {
            kind: selector.kind,
            mode: selector.mode,
            holdRange: selector.holdRange ?? null,
            resolutionStatus: selector.resolutionStatus,
            options: (selector.options ?? []).map(option => ({
              selectorIdentity: option.selectorIdentity,
              label: option.label,
              publicVariantIndex: option.publicVariantIndex,
              executionControlSkillId: option.executionControlSkillId,
              executionSubSkillIndex: option.executionSubSkillIndex,
              subSkillIndex: option.subSkillIndex,
              playerSkillId: option.playerSkillId,
              durationFrames: option.durationFrames,
              chargeTier: option.chargeTier,
              sourceIdentity: option.sourceIdentity,
              resolutionStatus: option.resolutionStatus,
            })),
          },
    inputSelectionStatus: inputSelection?.status ?? 'not-required',
    selectedInputIdentity:
      inputSelection?.option?.selectorIdentity ??
      inputSelection?.selection?.selectorIdentity ??
      null,
    selectionReason:
      selectionSource?.sourceKind ?? inputSelection?.reason ?? null,
    contextActionId: selectionSource?.contextActionId ?? null,
    contextualInputScheduling:
      selectionSource?.contextualInputScheduling ?? null,
    inputFrame: selectionSource?.contextualInputScheduling?.inputFrame ?? null,
    inputTimeMs:
      selectionSource?.contextualInputScheduling?.inputTimeMs ?? null,
    executionStartFrame:
      selectionSource?.contextualInputScheduling?.executionStartFrame ?? null,
    executionStartMs:
      selectionSource?.contextualInputScheduling?.executionStartMs ?? null,
    predecessorEffectiveEndFrame:
      selectionSource?.contextualInputScheduling
        ?.predecessorEffectiveEndFrame ?? null,
    predecessorEffectiveEndMs:
      selectionSource?.contextualInputScheduling?.predecessorEffectiveEndMs ??
      null,
    attackInputChainIdentity: selectionSource?.chainIdentity ?? null,
    attackChainSequenceIndex: selectionSource?.chainSequenceIndex ?? null,
    sourceKind: selectionSource?.sourceKind ?? 'action-mapping-selection',
    sourceIdentity:
      selectionSource?.sourceIdentity ??
      resolution?.actionBinding?.bindingSourceIdentity ??
      null,
    decisionFrame:
      selectionSource?.decisionFrame ?? contract?.decisionFrame ?? 0,
    actualDurationFrames:
      resolution?.actionBinding?.actualDurationFrames ??
      resolution?.actionBinding?.actionTiming?.occupancy?.durationFrames ??
      null,
    animationDurationFrames:
      resolution?.actionBinding?.animationDurationFrames ??
      resolution?.actionBinding?.actionTiming?.animation?.durationFrames ??
      null,
    status:
      status ??
      (resolution?.ready
        ? 'verified-action-variant-selection-ready'
        : 'unresolved-action-variant-selection'),
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

function createInputVariantExecutionBlock({
  action,
  actorState,
  controlSkillId,
  contract,
  inputSelection,
}) {
  return {
    code: 'VERIFIED_ACTION_INPUT_VARIANT_REQUIRED',
    status: 'unresolved',
    reason: 'verified-action-input-variant-unresolved',
    reasons: [inputSelection?.reason ?? 'input-variant-selection-required'],
    sourceKind: 'azpr-verified-action-variant-runtime',
    sourceIdentity: contract?.sourceIdentity ?? [],
    actionId: action.id,
    actionName: action.name,
    actorId: action.actorId,
    timeMs: action.startMs,
    controlSkillId,
    resourceIdentity: actorState?.profile?.resourceIdentity ?? null,
    resourceName: actorState?.profile?.name ?? null,
    requiredValue: null,
    currentValue: actorState?.current ?? null,
    maxValue: actorState?.profile?.capacity ?? null,
  };
}

function createAttackChainExecutionBlock({ action, actorState, chain }) {
  return {
    code: 'VERIFIED_ATTACK_INPUT_CHAIN_COMPLETE',
    status: 'blocked',
    reason: 'verified-attack-input-chain-complete',
    reasons: ['active-attack-input-chain-has-no-segment-at-sequence-index'],
    message: `${actorState?.actor?.name ?? action.actor?.name ?? '角色'} 当前形态的普攻链只有 ${chain?.segments?.length ?? 0} 段，A${action.attackSequenceIndex} 不执行`,
    sourceKind: 'azpr-verified-action-variant-runtime',
    sourceIdentity: chain?.sourceIdentity ?? null,
    actionId: action.id,
    actionName: action.name,
    actorId: action.actorId,
    timeMs: action.startMs,
    controlSkillId: null,
    selectedSubSkillIndex: null,
    resourceIdentity: actorState?.profile?.resourceIdentity ?? null,
    resourceName: actorState?.profile?.name ?? null,
    requiredValue: null,
    currentValue: actorState?.current ?? null,
    maxValue: actorState?.profile?.capacity ?? null,
  };
}

function removeAttackChainContinuityWindows(windows, actorId = null) {
  for (let index = windows.length - 1; index >= 0; index -= 1) {
    const window = windows[index];
    if (
      window.relationType === 'attack-chain-continuity-window' &&
      (actorId == null || String(window.actorId) === String(actorId))
    ) {
      windows.splice(index, 1);
    }
  }
}

function removeStateSwitchWindows({ windows, actorId, stateElementId }) {
  for (let index = windows.length - 1; index >= 0; index -= 1) {
    const window = windows[index];
    if (
      window.actorId === actorId &&
      window.condition?.kind === 'resource-state-active' &&
      Number(window.condition.stateElementId) === Number(stateElementId)
    ) {
      windows.splice(index, 1);
    }
  }
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
    effectCommands: [],
    directSpEvents: [],
    targetStateRuntime: null,
    eventLog: [],
    executionBlocks: [],
    curves: [],
    summary: {
      profileCount: 0,
      selectionCount: 0,
      changedVariantCount: 0,
      resourceEventCount: 0,
      stateEventCount: 0,
      effectCommandCount: 0,
      targetStateEventCount: 0,
      conditionalHitGroupCount: 0,
      directSpEventCount: 0,
      executionBlockCount: 0,
    },
    ready: false,
    applied: false,
  };
}
