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
import {
  compareActionSourceSequence,
  getActionSourceSequencePath,
} from '../../domain/actionSourceSequence';
import { msToFrame } from '../../domain/timebase';
import { resolveActionHitWillHit } from '../../domain/actionHitOverrides';
import { resolveVerifiedActionLevelValue } from '../../domain/verifiedActionLevel';
import { resolveVerifiedChargingReleaseWindow } from '../../domain/verifiedChargingReleaseSelection';
import {
  VERIFIED_NORMAL_ATTACK_INPUT_PHASES,
  matchVerifiedNormalAttackInput,
  resolveVerifiedNormalAttackInputPhase,
} from '../../domain/verifiedNormalAttackInputAuthority';
import {
  isRuntimeContextNormalAttackInput,
  isRuntimeResolvedNormalAttackInput,
} from '../../domain/normalAttackInputResolution';
import {
  applyVerifiedSwitchExitTailSettlement,
  isVerifiedSwitchExitTailPolicy,
} from '../generation/verifiedSwitchExitTailPolicy';

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
      activeThresholdEffects: new Map(),
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
          activeThresholdEffects: new Map(),
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
        profile.runtimeGenerationMode === 'action-variant-runtime' ||
        profile.runtimeGenerationMode === 'persistent-property-runtime' ||
        profile.runtimeGenerationMode === 'controlled-entry-property-runtime')
  );
  const graph = mechanicsPackage.actionVariantGraph;
  const publicControlSkillIdsByOwner = new Map();
  for (const mapping of mechanicsPackage.actionMappings ?? []) {
    if (mapping.ownerKind !== 'actor') continue;
    const ownerKey = Number(mapping.ownerId);
    if (!publicControlSkillIdsByOwner.has(ownerKey)) {
      publicControlSkillIdsByOwner.set(ownerKey, new Set());
    }
    publicControlSkillIdsByOwner
      .get(ownerKey)
      .add(Number(mapping.controlSkillId));
  }
  const switchBindings = graph.edges
    .filter(edge => edge.applied)
    .sort(compareBindings);
  const contextBindings = (graph.contextEdges ?? [])
    .filter(edge => edge.applied)
    .sort(compareBindings);
  const chargingReleaseBindings = (graph.chargingReleaseBindings ?? [])
    .filter(binding => binding.applied)
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
        compareActionSourceSequence(
          left.action,
          right.action,
          left.index,
          right.index
        )
    );

  const actionResolutionById = new Map();
  const selectionByActionId = new Map();
  const activeSwitchWindows = [];
  const switchWindowHistory = [];
  const pendingEvents = [];
  const resourceEvents = [];
  const stateEvents = [];
  const variantEvents = [];
  const normalAttackSpecialContinuationCandidates = [];
  const effectCommands = [];
  const tuningMarkTransactions = [];
  const resourceGateEvents = [];
  const companionEvents = [];
  const companionAttackTransactions = [];
  const companionStateByActorId = new Map();
  const executionBlocks = [];
  const lastResolvedActionByActorId = new Map();
  const resolvedActionContextById = new Map();
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
      } else if (event.kind === 'companion-attack') {
        applyCompanionAttack(event);
      } else if (event.kind === 'companion-expire') {
        applyCompanionExpiration(event);
      } else if (event.kind === 'companion-despawn') {
        applyCompanionDespawn(event);
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
    const gateResult = resolveResourceOperationHitGate({
      operation,
      action: descriptor.action,
      resolution: descriptor.resolution,
      scenario,
    });
    if (operation.hitGate) {
      resourceGateEvents.push({
        type: 'VERIFIED_SPECIAL_RESOURCE_HIT_GATE',
        timeMs: descriptor.timeMs,
        actionId: descriptor.action.id,
        actorId: descriptor.action.actorId,
        runtimeSequenceIndex: runtimeSequenceIndex++,
        payload: {
          operationIdentity: operation.operationIdentity,
          gate: operation.hitGate,
          candidateCount: gateResult.candidateCount,
          landedCount: gateResult.landedCount,
          passed: gateResult.landedCount > 0,
          sourceIdentity: operation.sourceIdentity,
          appliedToActionVariantRuntime: true,
        },
      });
    }
    if (gateResult.landedCount <= 0) return;
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
        beforeValue +
          resolveOperationAmount(operation, descriptor.action) *
            gateResult.landedCount,
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
      const removedState = state.activeStates.get(
        Number(operation.stateElementId)
      );
      state.activeStates.delete(Number(operation.stateElementId));
      removeStateSwitchWindows({
        windows: activeSwitchWindows,
        actorId: descriptor.action.actorId,
        stateElementId: operation.stateElementId,
      });
      if (removedState) {
        effectCommands.push(
          createStateEffectCommand({
            mechanicsPackage,
            actorState: state,
            actorId: descriptor.action.actorId,
            sourceActionId: descriptor.action.id,
            timeMs: descriptor.timeMs,
            durationMs: null,
            transition: transition ?? {
              stateElementId: Number(operation.stateElementId),
              stateName: operation.stateName ?? removedState.name,
              sourceIdentity: operation.sourceIdentity,
            },
            sourceIdentity: operation.sourceIdentity,
            operation: EFFECT_OPERATIONS.REMOVE,
          })
        );
      }
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
      for (const grant of transition.tuningMarkGrants ?? []) {
        if (grant.applied !== true || !(Number(grant.stackDelta) > 0)) {
          continue;
        }
        tuningMarkTransactions.push({
          transactionIdentity: [
            transition.transitionIdentity,
            grant.markId,
            descriptor.action?.id ?? 'unknown-action',
            descriptor.timeMs,
          ].join('|'),
          kind: 'threshold-grant',
          timeMs: descriptor.timeMs,
          action: descriptor.action,
          actionId: descriptor.action?.id ?? null,
          actorId: descriptor.action?.actorId ?? state.actor.id,
          ownerId: Number(state.profile.ownerId),
          resourceIdentity: state.profile.resourceIdentity,
          stateElementId: Number(transition.stateElementId),
          profileKey: grant.profileKey,
          markId: Number(grant.markId),
          stackDelta: Number(grant.stackDelta),
          sourceIdentity: grant.sourceIdentity,
          status: 'verified-threshold-tuning-mark-grant-ready',
          applied: true,
        });
      }
      for (const grant of transition.effectGrants ?? []) {
        if (grant.applied !== true) continue;
        const previousUntil = Number(
          state.activeThresholdEffects.get(grant.effectId) ??
            Number.NEGATIVE_INFINITY
        );
        const operation =
          descriptor.timeMs < previousUntil
            ? EFFECT_OPERATIONS.REFRESH
            : EFFECT_OPERATIONS.APPLY;
        state.activeThresholdEffects.set(
          grant.effectId,
          descriptor.timeMs + Number(grant.durationMs)
        );
        effectCommands.push(
          createThresholdEffectGrantCommand({
            mechanicsPackage,
            actorState: state,
            action: descriptor.action,
            timeMs: descriptor.timeMs,
            transition,
            grant,
            operation,
          })
        );
      }
      if (transition.companionProfile?.applied === true) {
        enterOrRefreshCompanion({
          actorState: state,
          action: descriptor.action,
          timeMs: descriptor.timeMs,
          profile: transition.companionProfile,
          sourceIdentity: transition.sourceIdentity,
        });
      }
    }
  };

  const applySwitchWindow = descriptor => {
    const state = actorStateById.get(descriptor.action.actorId);
    const stateDependentCondition =
      descriptor.binding?.condition &&
      descriptor.binding.condition.kind !== 'always';
    const conditionSatisfied =
      !stateDependentCondition ||
      (state && isSwitchConditionSatisfied(descriptor.binding, state));
    if (!conditionSatisfied) {
      return;
    }
    const inputWindow = descriptor.binding.inputWindow;
    const actionStartMs = Number(descriptor.action.startMs) || 0;
    const startsAtMs = normalizeRuntimeMs(
      inputWindow
        ? actionStartMs + framesToMs(inputWindow.startFrame, FRAME_RATE)
        : descriptor.timeMs
    );
    const endsAtMs = normalizeRuntimeMs(
      inputWindow
        ? actionStartMs + framesToMs(inputWindow.endFrame, FRAME_RATE)
        : startsAtMs + Number(descriptor.binding.durationMs)
    );
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

  const enterOrRefreshCompanion = ({
    actorState,
    action,
    timeMs,
    profile,
    sourceIdentity,
  }) => {
    const actorId = action?.actorId ?? actorState.actor.id;
    const previous = companionStateByActorId.get(actorId);
    const previousActive =
      previous?.active === true && Number(timeMs) < Number(previous.endsAtMs);
    const revision = Number(previous?.revision ?? 0) + 1;
    const companion = {
      actorId,
      ownerId: Number(actorState.profile.ownerId),
      profile,
      revision,
      periodicRevision: Number(previous?.periodicRevision ?? 0) + 1,
      startsAtMs: Number(timeMs),
      endsAtMs: Number(timeMs) + Number(profile.durationMs),
      sourceActionId: action?.id ?? null,
      sourceIdentity,
      active: true,
    };
    companionStateByActorId.set(actorId, companion);
    companionEvents.push(
      createCompanionEvent({
        kind: previousActive ? 'refresh' : 'summon',
        timeMs,
        action,
        companion,
        sourceIdentity,
      })
    );
    pendingEvents.push({
      kind: 'companion-expire',
      timeMs: companion.endsAtMs,
      actorId,
      revision,
      sourceActionId: action?.id ?? null,
      sourceIdentity,
      priority: 0,
    });
    const periodic = profile.periodicAttack;
    if (
      periodic?.applied !== false &&
      Number(periodic.initialDelayMs) > 0 &&
      Number(periodic.cadenceMs) > 0
    ) {
      pendingEvents.push({
        kind: 'companion-attack',
        attackKind: 'periodic',
        timeMs: Number(timeMs) + Number(periodic.initialDelayMs),
        actorId,
        revision,
        periodicRevision: companion.periodicRevision,
        action,
        resolution: null,
        attackProfile: periodic,
        priority: 3,
      });
    }
  };

  const scheduleCompanionResponses = ({
    action,
    resolution,
    executionControlSkillId,
    selectedSubSkillIndex,
  }) => {
    const companion = companionStateByActorId.get(action.actorId);
    if (
      companion?.active !== true ||
      Number(action.startMs) >= Number(companion.endsAtMs)
    ) {
      return;
    }
    const responses = (companion.profile.actionResponses ?? []).filter(
      response =>
        Number(response.sourceControlSkillId) ===
          Number(executionControlSkillId) &&
        Number(response.sourceSubSkillIndex) === Number(selectedSubSkillIndex)
    );
    for (const response of responses) {
      const group = response.conditionalDamageGroup;
      const scheduledHits = [];
      let hitIndex = 0;
      for (const triggerFrame of group.triggerFrames ?? []) {
        for (const hitDelayMs of group.hitDelaysMs ?? [0]) {
          hitIndex += 1;
          const timeMs =
            Number(action.startMs) +
            framesToMs(triggerFrame, group.frameRate) +
            Number(hitDelayMs);
          if (isPostSwitchOwnerBoundEvent({ scenario, action, timeMs })) {
            continue;
          }
          scheduledHits.push({
            kind: 'companion-attack',
            attackKind: 'action-response',
            timeMs,
            actorId: action.actorId,
            revision: companion.revision,
            periodicRevision: companion.periodicRevision,
            action,
            resolution,
            attackProfile: response,
            hitIndex,
            triggerFrame,
            hitDelayMs,
            priority: 3,
          });
        }
      }
      if (scheduledHits.length > 0 && response.cancelPeriodicOnStart) {
        companion.periodicRevision += 1;
      }
      pendingEvents.push(...scheduledHits);
      if (
        response.endsCompanionAtFrame != null &&
        Number.isInteger(Number(response.endsCompanionAtFrame))
      ) {
        const timeMs =
          Number(action.startMs) +
          framesToMs(response.endsCompanionAtFrame, group.frameRate);
        if (!isPostSwitchOwnerBoundEvent({ scenario, action, timeMs })) {
          pendingEvents.push({
            kind: 'companion-despawn',
            timeMs,
            actorId: action.actorId,
            revision: companion.revision,
            sourceActionId: action.id,
            sourceIdentity: response.sourceIdentity,
            reason: 'action-response-complete',
            priority: 0,
          });
        }
      }
    }
  };

  const applyCompanionAttack = descriptor => {
    const companion = companionStateByActorId.get(descriptor.actorId);
    if (
      companion?.active !== true ||
      companion.revision !== descriptor.revision ||
      Number(descriptor.timeMs) >= Number(companion.endsAtMs) ||
      (descriptor.attackKind === 'periodic' &&
        companion.periodicRevision !== descriptor.periodicRevision)
    ) {
      return;
    }
    const group = descriptor.attackProfile.conditionalDamageGroup;
    const hitDescriptors = [];
    if (descriptor.attackKind === 'periodic') {
      let hitIndex = 0;
      for (const triggerFrame of group.triggerFrames ?? []) {
        for (const hitDelayMs of group.hitDelaysMs ?? [0]) {
          hitIndex += 1;
          hitDescriptors.push({
            hitIndex,
            timeMs:
              Number(descriptor.timeMs) +
              framesToMs(triggerFrame, group.frameRate) +
              Number(hitDelayMs),
            triggerFrame,
            hitDelayMs,
          });
        }
      }
    } else {
      hitDescriptors.push({
        hitIndex: descriptor.hitIndex,
        timeMs: Number(descriptor.timeMs),
        triggerFrame: descriptor.triggerFrame,
        hitDelayMs: descriptor.hitDelayMs,
      });
    }
    for (const hit of hitDescriptors) {
      companionAttackTransactions.push({
        transactionIdentity: [
          companion.profile.companionIdentity,
          companion.revision,
          descriptor.attackProfile.attackIdentity,
          hit.hitIndex,
          hit.timeMs,
        ].join('|'),
        kind: 'companion-conditional-damage',
        attackKind: descriptor.attackKind,
        timeMs: hit.timeMs,
        action: descriptor.action,
        actionId: descriptor.action?.id ?? companion.sourceActionId,
        actorId: descriptor.actorId,
        ownerId: companion.ownerId,
        companionUnitId: companion.profile.unitId,
        companionIdentity: companion.profile.companionIdentity,
        companionRevision: companion.revision,
        attackProfile: descriptor.attackProfile,
        conditionalDamageGroup: group,
        hitIndex: hit.hitIndex,
        triggerFrame: hit.triggerFrame,
        hitDelayMs: hit.hitDelayMs,
        resolution: descriptor.resolution,
        targetKind: companion.profile.targetKind,
        ownership: companion.profile.ownership,
        sourceIdentity: descriptor.attackProfile.sourceIdentity,
        status: 'verified-companion-attack-transaction-ready',
        applied: true,
      });
    }
    companionEvents.push(
      createCompanionEvent({
        kind: descriptor.attackKind,
        timeMs: descriptor.timeMs,
        action: descriptor.action,
        companion,
        sourceIdentity: descriptor.attackProfile.sourceIdentity,
        attackIdentity: descriptor.attackProfile.attackIdentity,
        attackCount: hitDescriptors.length,
      })
    );
    if (descriptor.attackKind === 'periodic') {
      const nextTimeMs =
        Number(descriptor.timeMs) + Number(descriptor.attackProfile.cadenceMs);
      if (nextTimeMs < Number(companion.endsAtMs)) {
        pendingEvents.push({
          ...descriptor,
          timeMs: nextTimeMs,
          priority: 3,
        });
      }
    }
  };

  const applyCompanionExpiration = descriptor => {
    const companion = companionStateByActorId.get(descriptor.actorId);
    if (
      companion?.active !== true ||
      companion.revision !== descriptor.revision ||
      companion.endsAtMs !== descriptor.timeMs
    ) {
      return;
    }
    despawnCompanion({
      actorId: descriptor.actorId,
      timeMs: descriptor.timeMs,
      sourceActionId: descriptor.sourceActionId,
      sourceIdentity: descriptor.sourceIdentity,
      reason: 'duration-expired',
    });
  };

  const applyCompanionDespawn = descriptor => {
    const companion = companionStateByActorId.get(descriptor.actorId);
    if (
      companion?.active !== true ||
      companion.revision !== descriptor.revision
    ) {
      return;
    }
    despawnCompanion({
      actorId: descriptor.actorId,
      timeMs: descriptor.timeMs,
      sourceActionId: descriptor.sourceActionId,
      sourceIdentity: descriptor.sourceIdentity,
      reason: descriptor.reason,
    });
  };

  const despawnCompanion = ({
    actorId,
    timeMs,
    sourceActionId,
    sourceIdentity,
    reason,
  }) => {
    const companion = companionStateByActorId.get(actorId);
    if (companion?.active !== true) return;
    companion.active = false;
    companion.periodicRevision += 1;
    companionEvents.push(
      createCompanionEvent({
        kind: 'despawn',
        timeMs,
        action: sourceActionId ? { id: sourceActionId, actorId } : null,
        companion,
        sourceIdentity,
        reason,
      })
    );
  };

  for (const [actorId, actorState] of actorStateById) {
    const transition = thresholdTransitionByOwnerId.get(
      Number(actorState.profile.ownerId)
    );
    const inheritedState = transition
      ? actorState.activeStates.get(Number(transition.stateElementId))
      : null;
    if (inheritedState && transition.companionProfile?.applied === true) {
      enterOrRefreshCompanion({
        actorState,
        action: {
          id: inheritedState.sourceActionId,
          actorId,
        },
        timeMs: 0,
        profile: {
          ...transition.companionProfile,
          durationMs:
            inheritedState.expiresAtMs ??
            transition.companionProfile.durationMs,
        },
        sourceIdentity:
          inheritedState.sourceIdentity ?? transition.sourceIdentity,
      });
    }
  }

  for (const actorState of variantActorStateById.values()) {
    const characterId = Number(
      actorState?.actor?.characterId ?? actorState?.profile?.ownerId
    );
    for (const passiveProfile of passiveEffects) {
      if (
        passiveProfile.runtimeGenerationMode !==
          'persistent-property-runtime' ||
        Number(passiveProfile.ownerId) !== characterId
      ) {
        continue;
      }
      for (const trigger of passiveProfile.triggerBindings ?? []) {
        effectCommands.push(
          createPersistentPassiveEffectCommand({
            mechanicsPackage,
            actorState,
            profile: passiveProfile,
            trigger,
            timeMs: 0,
          })
        );
      }
    }
  }

  for (const interval of controlledActorTimeline?.intervals ?? []) {
    const actorState =
      variantActorStateById.get(String(interval.actorId)) ??
      [...variantActorStateById.values()].find(
        candidate =>
          Number(candidate.actor?.characterId) === Number(interval.characterId)
      );
    if (!actorState) continue;
    for (const passiveProfile of passiveEffects) {
      if (
        passiveProfile.runtimeGenerationMode !==
          'controlled-entry-property-runtime' ||
        Number(passiveProfile.ownerId) !== Number(interval.characterId)
      ) {
        continue;
      }
      for (const trigger of passiveProfile.triggerBindings ?? []) {
        effectCommands.push(
          createPersistentPassiveEffectCommand({
            mechanicsPackage,
            actorState,
            profile: passiveProfile,
            trigger,
            timeMs: Number(interval.startMs) || 0,
            sourceKind: 'controlled-entry',
            sourceTransitionId: interval.sourceTransitionId,
          })
        );
      }
    }
  }

  for (const { action } of actions) {
    const actionTimeMs = Number(action.startMs) || 0;
    flushPending(actionTimeMs);
    removeExpiredSwitchWindows(activeSwitchWindows, actionTimeMs);
    if (action.type === ACTION_TYPES.SWITCH) {
      for (const [actorId, companion] of companionStateByActorId) {
        if (
          companion.active === true &&
          companion.profile.dieWithChangeHero === true &&
          (action.actorId == null || String(action.actorId) === String(actorId))
        ) {
          despawnCompanion({
            actorId,
            timeMs: actionTimeMs,
            sourceActionId: action.id,
            sourceIdentity: companion.profile.sourceIdentity,
            reason: 'controlled-character-switched',
          });
        }
      }
      lastResolvedActionByActorId.clear();
      resolvedActionContextById.clear();
      removeAttackChainContinuityWindows(activeSwitchWindows);
      continue;
    }
    const mapping = getVerifiedCombatActionMapping(action);
    const tracksActorActionContext = action.type === ACTION_TYPES.SKILL;
    const clearActorActionContext = () => {
      if (tracksActorActionContext) {
        lastResolvedActionByActorId.delete(action.actorId);
      }
    };
    const rememberActorActionContext = context => {
      if (!tracksActorActionContext || !context) return;
      lastResolvedActionByActorId.set(action.actorId, context);
      resolvedActionContextById.set(String(action.id), context);
    };
    const runtimeResolvedNormalInput =
      mapping?.actionKind === 'normal-attack' &&
      isRuntimeResolvedNormalAttackInput(action);
    if (tracksActorActionContext && mapping?.actionKind !== 'normal-attack') {
      removeAttackChainContinuityWindows(activeSwitchWindows, action.actorId);
    }
    const actorState = variantActorStateById.get(action.actorId);
    const scenarioActor = actorById.get(String(action.actorId));
    const characterId = Number(
      action.actor?.characterId ??
        scenarioActor?.characterId ??
        actorState?.profile?.ownerId
    );
    const contextPredecessor = tracksActorActionContext
      ? resolveContextPredecessor({
          action,
          lastResolvedActionByActorId,
          resolvedActionContextById,
        })
      : null;
    const initialPublicControlSkillId = resolveActionControlSkillId(
      action,
      mapping
    );
    let contextSelection = actorState
      ? resolveContextVariantSelection({
          contextBindings,
          previous: contextPredecessor,
          actorState,
          controlSkillId: initialPublicControlSkillId,
          selectedSubSkillIndex:
            mapping?.actionKind === 'normal-attack' &&
            !runtimeResolvedNormalInput
              ? resolveRequestedContextTargetSubSkillIndex(action)
              : null,
          requestedExecutionControlSkillId:
            mapping?.actionKind === 'normal-attack' &&
            !runtimeResolvedNormalInput
              ? resolveRequestedContextExecutionControlSkillId(action, mapping)
              : null,
          allowAnyTargetControlSkillId: runtimeResolvedNormalInput,
          timeMs: actionTimeMs,
          inputCommand: mapping?.actionKind ?? null,
          required:
            !runtimeResolvedNormalInput &&
            hasExplicitContextPredecessor(action),
          attackGroupId: runtimeResolvedNormalInput
            ? (contextPredecessor?.attackGroupId ?? null)
            : (action.attackGroupId ?? null),
        })
      : { status: 'none', binding: null };
    const contextConsumesInput = [
      'selected',
      'conflict',
      'ambiguous',
      'missing',
      'group-conflict',
    ].includes(contextSelection.status);
    let attackChainSelection = contextConsumesInput
      ? { status: 'context-selected', action, chain: null, segment: null }
      : resolveAttackInputChainAction({
          action,
          mapping,
          actorState,
          attackInputChains,
          activeSwitchWindows,
          previous: tracksActorActionContext
            ? lastResolvedActionByActorId.get(action.actorId)
            : null,
          timeMs: actionTimeMs,
        });
    if (
      attackChainSelection.status === 'blocked' ||
      attackChainSelection.status === 'phase-blocked'
    ) {
      const block =
        attackChainSelection.status === 'phase-blocked'
          ? createNormalAttackInputPhaseExecutionBlock({
              action,
              actorState,
              selection: attackChainSelection,
            })
          : createAttackChainExecutionBlock({
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
        sourceKind:
          attackChainSelection.authorityPhase?.sourceKind ??
          'verified-active-attack-input-chain',
        sourceIdentity:
          attackChainSelection.authorityPhase?.sourceIdentity ??
          attackChainSelection.chain?.sourceIdentity ??
          null,
        status: block.reason,
      });
      clearActorActionContext();
      continue;
    }
    if (
      runtimeResolvedNormalInput &&
      isWithinResolvedActionOccupancy({
        predecessor: contextPredecessor,
        inputTimeMs: actionTimeMs,
      }) &&
      !isVerifiedRuntimeNormalAttackContinuation({
        predecessor: contextPredecessor,
        contextSelection,
        attackChainSelection,
        activeSwitchWindows,
        switchWindowHistory,
        switchBindings,
      })
    ) {
      const block = createNormalAttackInputOccupancyExecutionBlock({
        action,
        actorState,
        predecessor: contextPredecessor,
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
        sourceKind: block.sourceKind,
        sourceIdentity: block.sourceIdentity,
        status: block.reason,
      });
      clearActorActionContext();
      continue;
    }
    const runtimeContextNormalAttackForm =
      runtimeResolvedNormalInput && contextSelection.binding
        ? materializeRuntimeContextNormalAttackInput({
            action,
            mapping,
            contextSelection,
          })
        : null;
    const runtimeAction =
      runtimeContextNormalAttackForm ?? attackChainSelection.action ?? action;
    const publicControlSkillId = contextSelection.binding
      ? Number(contextSelection.binding.targetControlSkillId)
      : contextConsumesInput
        ? initialPublicControlSkillId
        : resolveActionControlSkillId(runtimeAction, mapping);
    if (!contextConsumesInput && actorState) {
      contextSelection = resolveContextVariantSelection({
        contextBindings,
        previous: contextPredecessor,
        actorState,
        controlSkillId: publicControlSkillId,
        selectedSubSkillIndex:
          mapping?.actionKind === 'normal-attack' && !runtimeResolvedNormalInput
            ? resolveRequestedContextTargetSubSkillIndex(runtimeAction)
            : null,
        requestedExecutionControlSkillId:
          mapping?.actionKind === 'normal-attack' && !runtimeResolvedNormalInput
            ? resolveRequestedContextExecutionControlSkillId(
                runtimeAction,
                mapping
              )
            : null,
        allowAnyTargetControlSkillId: runtimeResolvedNormalInput,
        timeMs: actionTimeMs,
        inputCommand: mapping?.actionKind ?? null,
        required:
          !runtimeResolvedNormalInput && hasExplicitContextPredecessor(action),
        attackGroupId: runtimeResolvedNormalInput
          ? (contextPredecessor?.attackGroupId ?? null)
          : (runtimeAction.attackGroupId ?? null),
      });
    }
    const directExecutionForm = resolveDirectPublicActionExecutionForm({
      publicActionForms,
      ownerId: characterId,
      publicControlSkillId,
      actorState,
    });
    const executionPrerequisite = resolveExecutionPrerequisite({
      prerequisite: directExecutionForm?.executionPrerequisite,
      scenario,
      action: runtimeAction,
    });
    if (executionPrerequisite.status === 'blocked') {
      const block = createExecutionPrerequisiteBlock({
        action,
        actorState,
        publicControlSkillId,
        directExecutionForm,
        executionPrerequisite,
      });
      executionBlocks.push(block);
      actionResolutionById.set(action.id, {
        ...resolveVerifiedCombatActionMechanics(runtimeAction, {
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
        controlSkillId: publicControlSkillId,
        executionControlSkillId:
          directExecutionForm?.executionControlSkillId ?? null,
        selectedSubSkillIndex:
          directExecutionForm?.executionSubSkillIndex ?? null,
        selectionReason: block.reason,
        sourceKind: 'verified-scenario-execution-prerequisite',
        sourceIdentity:
          directExecutionForm?.executionPrerequisite?.sourceIdentity ?? null,
        status: block.reason,
      });
      clearActorActionContext();
      continue;
    }
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
      if (
        ['conflict', 'ambiguous', 'missing', 'group-conflict'].includes(
          contextSelection.status
        )
      ) {
        const block = createContextWindowConflictBlock({
          action,
          actorState,
          controlSkillId: publicControlSkillId,
          contextSelection,
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
            executionControlSkillId: null,
            contract: null,
            inputSelection: null,
            selectedSubSkillIndex: null,
            selectionSource: null,
            resolution: null,
            status: block.reason,
          })
        );
        continue;
      }
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
      const resolvedInputSelection = resolveDerivedInputSelection({
        action: runtimeAction,
        contract: derivedControlContract,
      });
      const delegatedChargingBinding =
        resolvedInputSelection.status === 'invalid' &&
        resolvedInputSelection.selection?.mode === 'release' &&
        contextSelection.binding
          ? chargingReleaseBindings.find(
              binding =>
                Number(binding.ownerId) === Number(characterId) &&
                Number(binding.sourceControlSkillId) ===
                  Number(contextSelection.binding.executionControlSkillId) &&
                Number(binding.sourceSubSkillIndex) ===
                  Number(contextSelection.binding.targetSubSkillIndex) &&
                String(binding.actionKind) === String(mapping?.actionKind)
            )
          : null;
      const inputSelection = delegatedChargingBinding
        ? {
            ...resolvedInputSelection,
            status: 'delegated-to-charging-release',
            reason: 'release-frame-owned-by-charging-release-binding',
            delegatedBindingIdentity: delegatedChargingBinding.bindingIdentity,
          }
        : resolvedInputSelection;
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
        directExecutionForm?.executionSubSkillIndex ??
        inputSelection.option?.subSkillIndex ??
        explicitSubSkillIndex ??
        (derivedControlContract?.inputSelector?.resolutionStatus === 'applied'
          ? null
          : defaultSelection?.subSkillIndex) ??
        selectedSubSkillIndex;
      executionControlSkillId =
        contextSelection.binding?.executionControlSkillId ??
        directExecutionForm?.executionControlSkillId ??
        inputSelection.option?.executionControlSkillId ??
        publicControlSkillId;
      if (
        activeSelection.status === 'selected' &&
        activeSelection.binding &&
        Number(activeSelection.binding.targetControlSkillId) !==
          Number(publicControlSkillId) &&
        activeSelection.binding.inputCommand === mapping?.actionKind
      ) {
        executionControlSkillId = Number(
          activeSelection.binding.targetControlSkillId
        );
        selectedSubSkillIndex = Number(
          activeSelection.binding.targetSubSkillIndex
        );
        selectionSource = {
          sourceKind:
            'verified-active-switch-skill-index-window-derived-control',
          sourceIdentity: activeSelection.binding.sourceIdentity,
          decisionFrame: activeSelection.binding.activationFrame ?? 0,
          semanticName: activeSelection.binding.semanticName ?? null,
        };
      }
      selectionSource = contextSelection.binding
        ? {
            sourceKind: 'verified-input-context-variant',
            sourceIdentity: contextSelection.binding.sourceIdentity,
            decisionFrame: contextSelection.binding.decisionFrame,
            contextActionId: contextSelection.previous?.actionId ?? null,
            executionTiming: contextSelection.binding.executionTiming ?? null,
            semanticIdentity: contextSelection.binding.semanticIdentity ?? null,
            semanticName: contextSelection.binding.semanticName ?? null,
            edgeIdentity: contextSelection.binding.edgeIdentity ?? null,
            contextualInputScheduling:
              action.contextualInputScheduling ??
              contextSelection.inputScheduling ??
              null,
          }
        : attackChainSelection.segment
          ? {
              sourceKind:
                attackChainSelection.authorityPhase?.sourceKind ??
                'verified-active-attack-input-chain',
              sourceIdentity:
                attackChainSelection.authorityPhase?.sourceIdentity ??
                [
                  attackChainSelection.chain?.sourceIdentity,
                  attackChainSelection.segment.sourceIdentity,
                ]
                  .filter(Boolean)
                  .join('|'),
              decisionFrame: attackChainSelection.chain?.decisionFrame ?? 0,
              chainIdentity: attackChainSelection.chain?.chainIdentity ?? null,
              chainSequenceIndex: attackChainSelection.sequenceIndex,
              contextActionId:
                attackChainSelection.authorityPhase?.expected
                  ?.contextActionId ??
                attackChainSelection.derivedEntry?.sourceActionId ??
                null,
              edgeIdentity:
                attackChainSelection.authorityPhase?.edgeIdentity ??
                attackChainSelection.derivedEntry?.edgeIdentity ??
                null,
              semanticIdentity: `${attackChainSelection.authorityPhase?.formIdentity ?? attackChainSelection.chain?.chainIdentity}:segment:${attackChainSelection.segment.sequenceIndex}`,
              semanticName: attackChainSelection.segment.semanticName
                ? attackChainSelection.segment.semanticName
                : attackChainSelection.chain?.semanticNamePrefix
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
            : directExecutionForm
              ? {
                  sourceKind: `verified-public-action-form-${directExecutionForm.selectionKind}`,
                  sourceIdentity: directExecutionForm.sourceIdentity,
                  decisionFrame: directExecutionForm.decisionFrame ?? 0,
                  executionTiming: directExecutionForm.executionTiming,
                  semanticIdentity: directExecutionForm.semanticIdentity,
                  semanticName: directExecutionForm.semanticName,
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
      if (
        mapping?.actionKind === 'normal-attack' &&
        !activeSelection.binding &&
        !contextSelection.binding &&
        (!attackChainSelection.segment || !runtimeResolvedNormalInput)
      ) {
        const chaseWindow = activeSwitchWindows.find(
          window =>
            window.actorId === action.actorId &&
            window.inputCommand === 'normal-attack' &&
            window.targetControlSkillId != null &&
            !publicControlSkillIdsByOwner
              .get(characterId)
              ?.has(Number(window.targetControlSkillId)) &&
            (runtimeResolvedNormalInput ||
              action.contextActionId === window.sourceActionId) &&
            runtimeWindowContainsTime(window, actionTimeMs)
        );
        if (chaseWindow) {
          const chaseControlBinding = (
            mechanicsPackage.actionVariantControlBindings ?? []
          ).find(
            binding =>
              Number(binding.controlSkillId) ===
              Number(chaseWindow.targetControlSkillId)
          );
          const chaseVariant = (chaseControlBinding?.variants ?? []).find(
            variant =>
              Number(variant.subSkillIndex) ===
              Number(chaseWindow.targetSubSkillIndex)
          );
          const automaticContinuation = switchBindings.find(
            binding =>
              Number(binding.ownerId) === Number(characterId) &&
              Number(binding.sourceControlSkillId) ===
                Number(chaseWindow.targetControlSkillId) &&
              Number(binding.sourceSubSkillIndex) ===
                Number(chaseWindow.targetSubSkillIndex) &&
              binding.relationType === 'automatic-continuation'
          );
          const chaseFrames = Number(
            automaticContinuation?.activationFrame ??
              chaseVariant?.frameCounts?.[0]?.frameCount ??
              chaseControlBinding?.frameCounts?.[0]?.frameCount ??
              230
          );
          const sourceAction = (scenario?.actions ?? []).find(
            candidate => candidate.id === chaseWindow.sourceActionId
          );
          const predecessorStartMs = Number(sourceAction?.startMs) || 0;
          const inputFrame = msToFrame(actionTimeMs);
          const inputOffsetFrame = inputFrame - msToFrame(predecessorStartMs);
          executionControlSkillId = Number(chaseWindow.targetControlSkillId);
          selectedSubSkillIndex = Number(chaseWindow.targetSubSkillIndex);
          selectionSource = {
            sourceKind:
              'verified-active-switch-skill-index-window-derived-control',
            sourceIdentity: chaseWindow.sourceIdentity,
            decisionFrame: chaseWindow.activationFrame ?? 0,
            semanticName: chaseWindow.semanticName ?? null,
            contextActionId: chaseWindow.sourceActionId,
            executionTiming: {
              subSkillIndex: Number(chaseWindow.targetSubSkillIndex),
              occupancy: {
                status: 'applied',
                startFrame: 0,
                endFrame: chaseFrames,
                durationFrames: chaseFrames,
                frameRate: FRAME_RATE,
                sourceKind: 'verified-derived-control-frame-count',
                sourceIdentity:
                  automaticContinuation?.sourceIdentity ??
                  chaseControlBinding?.sourcePath ??
                  chaseWindow.sourceIdentity,
              },
              animation: {
                status: 'applied',
                startFrame: 0,
                endFrame: chaseFrames,
                durationFrames: chaseFrames,
                frameRate: FRAME_RATE,
                sourceIdentity:
                  automaticContinuation?.sourceIdentity ??
                  chaseControlBinding?.sourcePath ??
                  chaseWindow.sourceIdentity,
              },
              input: null,
              status: 'applied',
            },
            contextualInputScheduling: {
              resolutionKind: 'direct-input-window',
              inputSemantics: 'immediate-interrupt',
              requestedExecutionStartFrame: inputFrame,
              requestedExecutionStartMs: actionTimeMs,
              inputFrame,
              inputOffsetFrame,
              inputTimeMs: actionTimeMs,
              executionStartFrame: inputFrame,
              executionStartOffsetFrame: inputOffsetFrame,
              executionStartMs: actionTimeMs,
              predecessorEffectiveEndFrame: inputFrame,
              predecessorEffectiveEndOffsetFrame: inputOffsetFrame,
              predecessorEffectiveEndMs: actionTimeMs,
              status: 'verified-context-input-scheduling-ready',
              applied: true,
            },
          };
        }
      }
    }

    const chargingBinding = chargingReleaseBindings.find(
      binding =>
        Number(binding.ownerId) === Number(characterId) &&
        Number(binding.sourceControlSkillId) ===
          Number(executionControlSkillId) &&
        Number(binding.sourceSubSkillIndex) === Number(selectedSubSkillIndex) &&
        String(binding.actionKind) === String(mapping?.actionKind)
    );
    let chargingSelection = null;
    let sourceChargingResolution = null;
    if (chargingBinding) {
      const normalizedReleaseInput = normalizeActionVariantInputSelection(
        runtimeAction.variantInputSelection
      );
      chargingSelection = resolveVerifiedChargingReleaseWindow({
        windows: chargingBinding.windows,
        releaseFrame: normalizedReleaseInput?.inputFrame,
        precedence: chargingBinding.precedence,
      });
      if (!chargingSelection.ready) {
        const block = createChargingReleaseExecutionBlock({
          action,
          actorState,
          binding: chargingBinding,
          selection: chargingSelection,
        });
        executionBlocks.push(block);
        actionResolutionById.set(action.id, {
          ...resolveVerifiedCombatActionMechanics(runtimeAction, {
            selectedControlSkillId: executionControlSkillId,
            selectedSubSkillIndex,
            selectionSource,
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
          controlSkillId: executionControlSkillId,
          selectedSubSkillIndex,
          chargingReleaseSelection: chargingSelection,
          appliedAssumptionIdentity: chargingBinding.assumptionIdentity,
          status: block.reason,
        });
        clearActorActionContext();
        continue;
      }
      sourceChargingResolution = resolveVerifiedCombatActionMechanics(
        runtimeAction,
        {
          selectedControlSkillId: executionControlSkillId,
          selectedSubSkillIndex,
          selectionSource,
          combatScenario: scenario.combatScenario,
        }
      );
      const selectedRelease = chargingSelection.selected;
      const inheritedSource = selectionSource;
      executionControlSkillId = Number(selectedRelease.executionControlSkillId);
      selectedSubSkillIndex = Number(selectedRelease.executionSubSkillIndex);
      selectionSource = {
        ...(inheritedSource ?? {}),
        sourceKind: 'verified-charging-release-window',
        sourceIdentity: [
          inheritedSource?.sourceIdentity,
          chargingBinding.sourceIdentity,
          selectedRelease.sourceIdentity,
        ]
          .filter(Boolean)
          .join('|'),
        decisionFrame: chargingSelection.releaseFrame,
        executionTiming: selectedRelease.executionTiming,
        semanticIdentity: selectedRelease.semanticIdentity,
        semanticName: selectedRelease.semanticName,
        chargingRelease: {
          bindingIdentity: chargingBinding.bindingIdentity,
          sourceControlSkillId: chargingBinding.sourceControlSkillId,
          sourceSubSkillIndex: chargingBinding.sourceSubSkillIndex,
          releaseFrame: chargingSelection.releaseFrame,
          selectedWindowIdentity: chargingSelection.selectedWindowIdentity,
          candidateWindowIdentities:
            chargingSelection.candidateWindowIdentities,
          precedence: chargingBinding.precedence,
          boundary: chargingBinding.boundary,
          assumptionIdentity: chargingBinding.assumptionIdentity,
          assumptionVersion: chargingBinding.assumptionVersion,
          assumptionHash: chargingBinding.assumptionHash,
        },
      };
    }

    if (mapping?.actionKind === 'normal-attack') {
      const resolvedAttackChainSelection =
        attackChainSelection.chain && attackChainSelection.segment
          ? {
              chain: attackChainSelection.chain,
              segment: attackChainSelection.segment,
              sequenceIndex: attackChainSelection.sequenceIndex,
            }
          : resolveUniqueExecutedAttackInputChainSegment({
              mapping,
              actorState,
              attackInputChains,
              executionControlSkillId,
              selectedSubSkillIndex,
            });
      if (resolvedAttackChainSelection?.chain) {
        attackChainSelection = {
          ...attackChainSelection,
          status: 'selected',
          ...resolvedAttackChainSelection,
        };
        selectionSource = {
          ...(selectionSource ?? {}),
          chainIdentity:
            resolvedAttackChainSelection.chain.chainIdentity ?? null,
          chainSequenceIndex: resolvedAttackChainSelection.sequenceIndex,
          semanticIdentity: `${resolvedAttackChainSelection.chain.chainIdentity}:segment:${resolvedAttackChainSelection.sequenceIndex}`,
          semanticName:
            resolvedAttackChainSelection.segment.semanticName ??
            selectionSource?.semanticName ??
            null,
        };
      }
    }

    if (attackChainSelection.derivedEntry) {
      const candidate = attackChainSelection.derivedEntry;
      normalAttackSpecialContinuationCandidates.push({
        actorId: candidate.actorId,
        sourceKind: candidate.sourceKind,
        sourceActionId: candidate.sourceActionId,
        sourceIdentity: candidate.sourceIdentity,
        chainIdentity: candidate.chainIdentity,
        sequenceIndex: candidate.sequenceIndex,
        controlSkillId: candidate.controlSkillId,
        subSkillIndex: candidate.subSkillIndex,
        groupId: candidate.groupId,
        startsAtMs: candidate.startsAtMs,
        endsAtMs: candidate.endsAtMs,
        targetActionId: action.id,
        applied: true,
      });
    }

    let resolution = applyAttackInputChainTimingResolution({
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
    if (chargingBinding && chargingSelection?.ready) {
      resolution = composeVerifiedChargingReleaseResolution({
        resolution,
        sourceResolution: sourceChargingResolution,
        binding: chargingBinding,
        selection: chargingSelection,
      });
    }
    if (
      mapping?.actionKind === 'perfect-parry' &&
      Number(characterId) === 109001 &&
      resolution.ready
    ) {
      const chainHits =
        (mechanicsPackage.actionVariantControlBindings ?? [])
          .find(binding => Number(binding.controlSkillId) === 10900149)
          ?.hits?.filter(hit => Number(hit.mapIndex) === 1) ?? [];
      if (chainHits.length > 0) {
        const maxChainFrame = Math.max(
          ...chainHits.map(hit => Number(hit.trigger?.startFrame) || 0)
        );
        const currentDuration = Number(
          resolution.actionBinding?.actionTiming?.occupancy?.durationFrames ?? 0
        );
        const effectiveDuration = Math.max(currentDuration, maxChainFrame + 1);
        resolution.hits = [...(resolution.hits ?? []), ...chainHits];
        resolution.actionBinding = {
          ...resolution.actionBinding,
          selectedHitIdentities: [
            ...(resolution.actionBinding?.selectedHitIdentities ?? []),
            ...chainHits.map(hit => hit.hitIdentity),
          ],
          runtimeHitCount:
            Number(resolution.actionBinding?.runtimeHitCount ?? 0) +
            chainHits.length,
          actionTiming: resolution.actionBinding?.actionTiming
            ? {
                ...resolution.actionBinding.actionTiming,
                occupancy: {
                  ...resolution.actionBinding.actionTiming.occupancy,
                  durationFrames: effectiveDuration,
                  endFrame: effectiveDuration,
                  status: 'applied',
                },
              }
            : undefined,
        };
        resolution.actualDurationFrames = effectiveDuration;
      }
    }
    resolution = applyVerifiedSwitchExitTailSettlement({
      policy: action.switchExitTailPolicy,
      resolution,
      mechanicsPackage,
    });
    actionResolutionById.set(action.id, resolution);
    selectionByActionId.set(
      action.id,
      createVariantSelectionRecord({
        action: runtimeAction,
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
    if (!resolution.ready || !Number.isInteger(executionControlSkillId)) {
      const structuralContext = createStructuralAuthorityOnlyActionContext({
        action: runtimeAction,
        mapping,
        chain: attackChainSelection.chain,
        selection: attackChainSelection,
        resolution,
        executionControlSkillId,
        selectedSubSkillIndex,
      });
      if (structuralContext) {
        rememberActorActionContext(structuralContext);
      } else {
        clearActorActionContext();
      }
      continue;
    }
    if (isVerifiedEmptyNormalAttackTimingResolution(resolution)) {
      const structuralContext = createVerifiedEmptyNormalAttackActionContext({
        action: runtimeAction,
        mapping,
        chain: attackChainSelection.chain,
        selection: attackChainSelection,
        resolution,
        executionControlSkillId,
        selectedSubSkillIndex,
        verifiedContextContinuation: contextSelection.status === 'selected',
      });
      rememberActorActionContext(structuralContext);
      continue;
    }
    if (!actorState) {
      const resolvedActionContext = createResolvedActionContext({
        action: runtimeAction,
        mapping,
        chain: attackChainSelection.chain,
        selection: attackChainSelection,
        resolution,
        executionControlSkillId,
        selectedSubSkillIndex,
      });
      rememberActorActionContext(resolvedActionContext);
      continue;
    }

    const continuationWindow = tracksActorActionContext
      ? createAttackChainContinuationWindow({
          actorState,
          action,
          actionTimeMs,
          executionControlSkillId,
          selectedSubSkillIndex,
          previous: lastResolvedActionByActorId.get(action.actorId),
          attackInputChains,
          activeSwitchWindows,
        })
      : null;
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
      clearActorActionContext();
      continue;
    }

    scheduleCompanionResponses({
      action,
      resolution,
      executionControlSkillId,
      selectedSubSkillIndex,
    });

    for (const operation of selectedOperations) {
      const operationTimeMs =
        actionTimeMs + framesToMs(operation.triggerFrame, operation.frameRate);
      if (
        !isActionFrameWithinContextualOccupancy(
          action,
          operation.triggerFrame,
          operation.frameRate ?? FRAME_RATE
        ) ||
        isPostSwitchOwnerBoundEvent({
          scenario,
          action,
          timeMs: operationTimeMs,
        })
      ) {
        continue;
      }
      pendingEvents.push({
        kind: 'resource-operation',
        timeMs: operationTimeMs,
        action,
        resolution,
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
      if (!isSwitchBindingWithinContextualOccupancy(action, binding)) {
        continue;
      }
      const bindingTimeMs =
        actionTimeMs + framesToMs(binding.activationFrame, FRAME_RATE);
      if (
        isPostSwitchOwnerBoundEvent({
          scenario,
          action,
          timeMs: bindingTimeMs,
        })
      ) {
        continue;
      }
      pendingEvents.push({
        kind: 'switch-window',
        timeMs: bindingTimeMs,
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
          ) ||
          isPostSwitchOwnerBoundEvent({
            scenario,
            action,
            timeMs:
              actionTimeMs +
              framesToMs(trigger.triggerFrame, trigger.frameRate),
          })
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
    const resolvedActionContext = createResolvedActionContext({
      action: runtimeAction,
      mapping,
      chain: attackChainSelection.chain,
      selection: attackChainSelection,
      resolution,
      executionControlSkillId,
      selectedSubSkillIndex,
    });
    rememberActorActionContext(resolvedActionContext);
  }

  flushPending(Number(scenario?.time?.durationMs) || 0);
  const targetStateRuntime = applyVerifiedTargetStateRuntime({
    scenario,
    actionResolutionById,
    mechanicsPackage,
    controlledActorTimeline,
  });
  effectCommands.push(...targetStateRuntime.effectCommands);
  for (const event of companionEvents) {
    if (event.runtimeSequenceIndex == null) {
      event.runtimeSequenceIndex = runtimeSequenceIndex++;
    }
  }
  resourceEvents.sort(compareRuntimeEvents);
  resourceGateEvents.sort(compareRuntimeEvents);
  stateEvents.sort(compareRuntimeEvents);
  variantEvents.sort(compareRuntimeEvents);
  companionEvents.sort(compareRuntimeEvents);
  companionAttackTransactions.sort(compareRuntimeEvents);
  const curves = createSpecialResourceCurves({
    actorStateById,
    resourceEvents,
    durationMs: Number(scenario?.time?.durationMs) || 0,
  });
  const projectedNormalAttackSpecialContinuationCandidates =
    mergeNormalAttackSpecialContinuationCandidates({
      consumedCandidates: normalAttackSpecialContinuationCandidates,
      pendingCandidates:
        projectPendingNormalAttackSpecialContinuationCandidates({
          switchWindowHistory,
          attackInputChains,
        }),
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
    resourceGateEvents,
    stateEvents,
    variantEvents,
    effectCommands,
    tuningMarkTransactions,
    companionEvents,
    companionAttackTransactions,
    normalAttackSpecialContinuationCandidates:
      projectedNormalAttackSpecialContinuationCandidates,
    directSpEvents: targetStateRuntime.directSpEvents,
    targetStateRuntime,
    activeSwitchWindows: switchWindowHistory,
    eventLog: [
      ...resourceEvents,
      ...resourceGateEvents,
      ...variantEvents,
      ...companionEvents,
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
      companion: companionStateByActorId.get(curve.actorId)
        ? {
            companionIdentity: companionStateByActorId.get(curve.actorId)
              .profile.companionIdentity,
            unitId: companionStateByActorId.get(curve.actorId).profile.unitId,
            active: companionStateByActorId.get(curve.actorId).active === true,
            revision: companionStateByActorId.get(curve.actorId).revision,
            endsAtMs: companionStateByActorId.get(curve.actorId).endsAtMs,
          }
        : null,
    })),
    summary: {
      profileCount: curves.length,
      selectionCount: selectionByActionId.size,
      changedVariantCount: [...actionResolutionById.values()].filter(
        resolution => resolution.variantSelection?.changed
      ).length,
      resourceEventCount: resourceEvents.length,
      resourceGateEventCount: resourceGateEvents.length,
      stateEventCount: stateEvents.length,
      effectCommandCount: effectCommands.length,
      tuningMarkTransactionCount: tuningMarkTransactions.length,
      companionEventCount: companionEvents.length,
      companionAttackTransactionCount: companionAttackTransactions.length,
      normalAttackSpecialContinuationCandidateCount:
        projectedNormalAttackSpecialContinuationCandidates.length,
      targetStateEventCount: targetStateRuntime.events.length,
      conditionalHitGroupCount: targetStateRuntime.groupResults.length,
      directSpEventCount: targetStateRuntime.directSpEvents.length,
      executionBlockCount: executionBlocks.length,
      switchExitTailSettlementCount: [...actionResolutionById.values()].filter(
        resolution => resolution.switchExitTailSettlement != null
      ).length,
      switchExitCancelledPacketCount: [...actionResolutionById.values()].reduce(
        (sum, resolution) =>
          sum +
          Number(
            resolution.switchExitTailSettlement?.cancelledPacketCount ?? 0
          ),
        0
      ),
    },
    ready: true,
    applied: true,
  };
}

function isSwitchBindingWithinContextualOccupancy(action, binding) {
  if (
    isActionFrameWithinContextualOccupancy(
      action,
      binding.activationFrame,
      FRAME_RATE
    )
  ) {
    return true;
  }
  if (
    binding?.relationType !== 'automatic-continuation' ||
    action?.contextualEffectiveEndMs == null
  ) {
    return false;
  }
  const contextualEndFrame = msToFrame(
    Number(action.contextualEffectiveEndMs) - Number(action.startMs),
    FRAME_RATE
  );
  return Number(binding.activationFrame) === contextualEndFrame;
}

function isPostSwitchOwnerBoundEvent({ scenario, action, timeMs }) {
  const policy = action?.switchExitTailPolicy;
  if (!isVerifiedSwitchExitTailPolicy(policy) || policy.ownerKind !== 'actor') {
    return false;
  }
  const fps = Number(scenario?.time?.fps) || FRAME_RATE;
  const switchBoundaryTimeMs =
    (Number(policy.switchBoundaryFrame) * 1000) / fps;
  return (
    Number.isFinite(Number(timeMs)) &&
    Number.isFinite(switchBoundaryTimeMs) &&
    Number(timeMs) > switchBoundaryTimeMs
  );
}

function projectPendingNormalAttackSpecialContinuationCandidates({
  switchWindowHistory = [],
  attackInputChains = [],
} = {}) {
  return (switchWindowHistory ?? [])
    .filter(
      window =>
        window?.applied === true &&
        window.compilerBindingIdentity != null &&
        window.relationType !== 'attack-chain-continuity-window' &&
        String(window.inputCommand ?? '') === 'normal-attack' &&
        window.actorId != null &&
        window.sourceActionId != null &&
        Number.isFinite(Number(window.startsAtMs)) &&
        Number.isFinite(Number(window.endsAtMs)) &&
        Number(window.endsAtMs) > Number(window.startsAtMs) &&
        Number.isInteger(Number(window.targetControlSkillId)) &&
        Number.isInteger(Number(window.targetSubSkillIndex))
    )
    .map(window => {
      const matches = (attackInputChains ?? []).flatMap(chain => {
        if (
          chain?.applied !== true ||
          (chain.entryPolicy?.kind !== 'derived-or-quick-entry' &&
            !(
              window.relationType === 'automatic-continuation' &&
              chain.entryPolicy?.kind === 'default'
            )) ||
          Number(chain.ownerId) !== Number(window.ownerId) ||
          (window.targetChainIdentity != null &&
            String(chain.chainIdentity) !== String(window.targetChainIdentity))
        ) {
          return [];
        }
        return (chain.segments ?? [])
          .filter(
            segment =>
              segment?.applied === true &&
              Number(segment.controlSkillId) ===
                Number(window.targetControlSkillId) &&
              Number(segment.subSkillIndex) ===
                Number(window.targetSubSkillIndex)
          )
          .map(segment => ({ chain, segment }));
      });
      const uniqueMatches = [
        ...new Map(
          matches.map(match => [
            `${match.chain.chainIdentity}|${match.segment.sequenceIndex}`,
            match,
          ])
        ).values(),
      ];
      if (uniqueMatches.length !== 1) return null;
      const [{ chain, segment }] = uniqueMatches;
      return {
        actorId: window.actorId,
        sourceKind: window.relationType ?? 'input-derived',
        sourceActionId: window.sourceActionId,
        sourceIdentity: window.sourceIdentity ?? null,
        chainIdentity: chain.chainIdentity,
        sequenceIndex: Number(segment.sequenceIndex),
        controlSkillId: Number(segment.controlSkillId),
        subSkillIndex: Number(segment.subSkillIndex),
        groupId: null,
        startsAtMs: Number(window.startsAtMs),
        endsAtMs: Number(window.endsAtMs),
        targetActionId: null,
        applied: true,
      };
    })
    .filter(Boolean);
}

function mergeNormalAttackSpecialContinuationCandidates({
  consumedCandidates = [],
  pendingCandidates = [],
} = {}) {
  const byIdentity = new Map();
  for (const candidate of [
    ...(pendingCandidates ?? []),
    ...(consumedCandidates ?? []),
  ]) {
    const identity = [
      candidate.actorId ?? '',
      candidate.sourceKind ?? '',
      candidate.sourceActionId ?? '',
      candidate.chainIdentity ?? '',
      candidate.sequenceIndex ?? '',
      candidate.controlSkillId ?? '',
      candidate.subSkillIndex ?? '',
      candidate.groupId ?? '',
      candidate.startsAtMs ?? '',
      candidate.endsAtMs ?? '',
    ].join('|');
    const previous = byIdentity.get(identity);
    if (
      !previous ||
      (previous.targetActionId == null && candidate.targetActionId != null)
    ) {
      byIdentity.set(identity, candidate);
    }
  }
  return [...byIdentity.values()].sort(
    (left, right) =>
      Number(left.startsAtMs ?? 0) - Number(right.startsAtMs ?? 0) ||
      String(left.sourceActionId ?? '').localeCompare(
        String(right.sourceActionId ?? ''),
        'en'
      ) ||
      String(left.targetActionId ?? '').localeCompare(
        String(right.targetActionId ?? ''),
        'en'
      )
  );
}

function resolveContextPredecessor({
  action,
  lastResolvedActionByActorId,
  resolvedActionContextById,
}) {
  const contextActionId =
    action?.runtimeContextActionId ?? action?.contextActionId ?? null;
  if (contextActionId == null) {
    return lastResolvedActionByActorId.get(action.actorId) ?? null;
  }
  const predecessor =
    resolvedActionContextById.get(String(contextActionId)) ?? null;
  return predecessor &&
    String(predecessor.actorId ?? '') === String(action.actorId ?? '')
    ? predecessor
    : null;
}

function createResolvedActionContext({
  action,
  mapping,
  chain,
  selection,
  resolution,
  executionControlSkillId,
  selectedSubSkillIndex,
}) {
  return {
    actionId: action.id,
    action,
    mapping,
    chain,
    actorId: action.actorId,
    actionKind: mapping?.actionKind ?? action.actionKind ?? null,
    controlSkillId: executionControlSkillId,
    selectedSubSkillIndex,
    startMs: Number(action.startMs) || 0,
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
      action.attackInputChainIdentity ?? chain?.chainIdentity ?? null,
    attackSequenceIndex:
      selection.sequenceIndex ?? action.attackSequenceIndex ?? null,
    attackChainSequenceIndex:
      selection.sequenceIndex ?? action.attackSequenceIndex ?? null,
    ready: true,
    mechanicsReady: true,
    contextReady: true,
  };
}

function isWithinResolvedActionOccupancy({ predecessor, inputTimeMs }) {
  if (!predecessor?.ready) return false;
  const startMs = Number(predecessor.startMs);
  const effectiveDurationFrames = Number(predecessor.effectiveDurationFrames);
  if (!Number.isFinite(startMs)) return false;
  if (Number.isFinite(effectiveDurationFrames) && effectiveDurationFrames > 0) {
    return msToFrame(Number(inputTimeMs) - startMs) < effectiveDurationFrames;
  }
  const durationMs = Number(predecessor.action?.durationMs);
  return (
    Number.isFinite(durationMs) &&
    durationMs > 0 &&
    Number(inputTimeMs) < startMs + durationMs - 0.000001
  );
}

function isVerifiedRuntimeNormalAttackContinuation({
  predecessor,
  contextSelection,
  attackChainSelection,
  activeSwitchWindows,
  switchWindowHistory,
  switchBindings,
}) {
  const predecessorActionId = String(predecessor?.actionId ?? '');
  if (contextSelection?.status != null && contextSelection.status !== 'none') {
    return true;
  }
  if (
    (switchBindings ?? []).some(
      binding =>
        Number(binding?.sourceControlSkillId) ===
          Number(predecessor?.controlSkillId) &&
        Number(binding?.sourceSubSkillIndex) ===
          Number(predecessor?.selectedSubSkillIndex) &&
        String(binding?.inputCommand ?? '') === 'normal-attack'
    )
  ) {
    return true;
  }
  if (
    predecessorActionId &&
    [...(activeSwitchWindows ?? []), ...(switchWindowHistory ?? [])].some(
      window =>
        String(window?.sourceActionId ?? '') === predecessorActionId &&
        String(window?.inputCommand ?? '') === 'normal-attack'
    )
  ) {
    return true;
  }
  if (Number(contextSelection?.sourceCandidateCount) > 0) {
    return true;
  }
  if (contextSelection?.fallback === 'default-input') {
    return true;
  }
  if (contextSelection?.status === 'selected' && contextSelection.binding) {
    return true;
  }
  if (
    attackChainSelection?.status !== 'selected' ||
    attackChainSelection.authorityPhase?.phase !==
      VERIFIED_NORMAL_ATTACK_INPUT_PHASES.SUCCESSOR_WINDOW
  ) {
    return false;
  }
  if (!predecessorActionId) return false;
  return [
    attackChainSelection.authorityPhase?.expected?.contextActionId,
    attackChainSelection.authorityPhase?.sourceActionId,
    attackChainSelection.derivedEntry?.sourceActionId,
  ].some(
    sourceActionId => String(sourceActionId ?? '') === predecessorActionId
  );
}

function createStructuralAuthorityOnlyActionContext({
  action,
  mapping,
  chain,
  selection,
  resolution,
  executionControlSkillId,
  selectedSubSkillIndex,
}) {
  if (
    mapping?.actionKind !== 'normal-attack' ||
    selection?.status !== 'selected' ||
    selection?.authorityMatch?.accepted !== true ||
    !selection.segment?.sourceIdentity ||
    !(Number(selection.segment.durationFrames) > 0) ||
    !Number.isInteger(Number(executionControlSkillId)) ||
    !Number.isInteger(Number(selectedSubSkillIndex))
  ) {
    return null;
  }
  return {
    ...createResolvedActionContext({
      action,
      mapping,
      chain,
      selection,
      resolution,
      executionControlSkillId,
      selectedSubSkillIndex,
    }),
    mechanicsReady: false,
    contextReady: false,
    structuralAuthorityOnly: true,
  };
}

function isVerifiedEmptyNormalAttackTimingResolution(resolution) {
  return (
    resolution?.status ===
      'verified-combat-action-mechanics-verified-empty-timing-only' &&
    resolution?.mechanicsSurface?.kind === 'verified-empty-normal-attack-timing'
  );
}

function createVerifiedEmptyNormalAttackActionContext({
  action,
  mapping,
  chain,
  selection,
  resolution,
  executionControlSkillId,
  selectedSubSkillIndex,
  verifiedContextContinuation = false,
}) {
  return {
    ...createResolvedActionContext({
      action,
      mapping,
      chain,
      selection,
      resolution,
      executionControlSkillId,
      selectedSubSkillIndex,
    }),
    mechanicsReady: false,
    contextReady: verifiedContextContinuation,
    structuralAuthorityOnly: true,
    verifiedEmptyTimingOnly: true,
    verifiedContextContinuationOnly: verifiedContextContinuation,
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
    mapping?.ownerKind === 'kibo' ||
    !Number.isInteger(Number(action?.attackSequenceIndex))
  ) {
    return { status: 'not-required', action, chain: null, segment: null };
  }
  const ownerId = Number(mapping.ownerId ?? actorState?.profile?.ownerId);
  const ownerChains = (attackInputChains ?? []).filter(
    chain =>
      chain.applied === true &&
      Number(chain.ownerId) === ownerId &&
      Number(chain.sourceSkillId) === Number(mapping.sourceSkillId)
  );
  const explicitChainIdentity =
    action.attackInputChainIdentity ??
    action.attackInput?.attackInputChainIdentity ??
    null;
  const runtimeContextIntent = isRuntimeContextNormalAttackInput(action);
  const matchingChains = ownerChains.filter(chain =>
    isRuntimeConditionSatisfied(chain.stateCondition, actorState)
  );
  const derivedEntries = matchingChains
    .filter(
      candidate => candidate.entryPolicy?.kind === 'derived-or-quick-entry'
    )
    .map(candidate =>
      resolveRuntimeDerivedAttackChainEntry({
        chain: candidate,
        ownerChains,
        actorState,
        actorId: action.actorId,
        activeSwitchWindows,
        previous,
        timeMs,
      })
    )
    .filter(Boolean);
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
      const nextSequenceIndex =
        Number(previous.attackChainSequenceIndex) ||
        Number(previous.attackSequenceIndex) ||
        null;
      continuedSequenceIndex =
        nextSequenceIndex != null &&
        nextSequenceIndex + 1 === Number(action.attackSequenceIndex)
          ? nextSequenceIndex + 1
          : null;
    }
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
  const authorityRequired =
    runtimeContextIntent ||
    action.attackInputChainSelectionSource === 'user-explicit';
  if (!authorityRequired) {
    if (!chain) {
      return { status: 'not-required', action, chain: null, segment: null };
    }
    const sequenceIndex =
      continuedSequenceIndex ??
      derivedEntry?.sequenceIndex ??
      Number(action.attackSequenceIndex);
    const legacySelection = materializeLegacyAttackInputSelection({
      action,
      mapping,
      chain,
      sequenceIndex,
    });
    return legacySelection
      ? {
          status: 'selected',
          ...legacySelection,
          derivedEntry,
        }
      : { status: 'blocked', action, chain, segment: null };
  }
  const previousChain = matchingChains.find(
    candidate =>
      previous?.attackInputChainIdentity != null &&
      String(candidate.chainIdentity) ===
        String(previous.attackInputChainIdentity)
  );
  const phase = resolveVerifiedNormalAttackInputPhase({
    mapping,
    chain: previousChain ?? chain,
    acceptedAction: previous?.action ?? null,
    acceptedSelection: previous,
    actorId: action.actorId,
    inputTimeMs: timeMs,
    fps: FRAME_RATE,
    activeContinuationWindows: activeSwitchWindows,
    specialContinuationCandidates: derivedEntries,
  });
  if (!derivedEntry && phase.expected) {
    const authorityDerivedEntries = derivedEntries.filter(
      candidate =>
        String(candidate.sourceActionId ?? '') ===
          String(phase.expected.contextActionId ?? '') &&
        String(candidate.chainIdentity ?? '') ===
          String(phase.expected.chainIdentity ?? '') &&
        Number(candidate.sequenceIndex) ===
          Number(phase.expected.sequenceIndex) &&
        Number(candidate.controlSkillId) ===
          Number(phase.expected.controlSkillId) &&
        Number(candidate.subSkillIndex) === Number(phase.expected.subSkillIndex)
    );
    if (authorityDerivedEntries.length === 1) {
      [derivedEntry] = authorityDerivedEntries;
    }
  }
  let selection = null;
  if (runtimeContextIntent && phase.expected) {
    selection = materializeAuthorityAttackInputSelection({
      action,
      mapping,
      ownerChains,
      expected: phase.expected,
    });
  } else {
    const exactRequestedChain = resolveExactRequestedAttackInputChain({
      action,
      ownerChains: matchingChains,
      explicitChainIdentity,
    });
    const sequenceIndex =
      Number(action.attackSequenceIndex) || continuedSequenceIndex;
    selection = materializeExistingAttackInputSelection({
      action,
      mapping,
      chain: exactRequestedChain ?? chain,
      sequenceIndex,
    });
  }
  if (!selection) {
    return {
      status: 'blocked',
      action,
      chain,
      segment: null,
      authorityPhase: phase,
    };
  }
  const authorityMatch = matchVerifiedNormalAttackInput({
    action: selection.action,
    mapping,
    phase,
  });
  if (!authorityMatch.accepted) {
    return {
      status: 'phase-blocked',
      action: selection.action,
      chain: selection.chain,
      segment: selection.segment,
      sequenceIndex: selection.sequenceIndex,
      authorityPhase: phase,
      authorityMatch,
    };
  }
  return {
    status: 'selected',
    chain: selection.chain,
    segment: selection.segment,
    action: selection.action,
    sequenceIndex: selection.sequenceIndex,
    derivedEntry,
    authorityPhase: phase,
    authorityMatch,
  };
}

function materializeLegacyAttackInputSelection({
  action,
  mapping,
  chain,
  sequenceIndex,
}) {
  const segment = chain.segments.find(
    item => Number(item.sequenceIndex) === Number(sequenceIndex)
  );
  if (!segment) return null;
  const sourceSegment = (
    mapping.attackInputSourceSegments ??
    mapping.attackInputSegments ??
    []
  ).find(
    item => Number(item.controlSkillId) === Number(segment.controlSkillId)
  );
  if (!sourceSegment) return null;
  const projectedSegment = projectVerifiedAttackInputChainSegment(
    sourceSegment,
    segment,
    sequenceIndex,
    chain.segments.length
  );
  if (!projectedSegment) return null;
  return {
    chain,
    segment,
    sequenceIndex,
    action: {
      ...action,
      actionKind: mapping?.actionKind ?? action.actionKind ?? null,
      attackInputChainIdentity: chain.chainIdentity,
      controlSubSkillIndex: segment.subSkillIndex,
      attackInput: projectedSegment,
    },
  };
}

function resolveExactRequestedAttackInputChain({
  action,
  ownerChains,
  explicitChainIdentity,
}) {
  if (explicitChainIdentity) {
    return (
      (ownerChains ?? []).find(
        candidate =>
          String(candidate.chainIdentity) === String(explicitChainIdentity)
      ) ?? null
    );
  }
  const sequenceIndex = Number(action.attackSequenceIndex);
  const controlSkillId = Number(action.attackInput?.controlSkillId);
  const subSkillIndex = Number(
    action.attackInput?.subSkillIndex ??
      action.attackInput?.selectedSubSkillIndex
  );
  if (
    !Number.isInteger(sequenceIndex) ||
    !Number.isInteger(controlSkillId) ||
    !Number.isInteger(subSkillIndex)
  ) {
    return null;
  }
  const matches = (ownerChains ?? []).filter(candidate =>
    candidate.segments?.some(
      segment =>
        Number(segment.sequenceIndex) === sequenceIndex &&
        Number(segment.controlSkillId) === controlSkillId &&
        Number(segment.subSkillIndex) === subSkillIndex
    )
  );
  return matches.length === 1 ? matches[0] : null;
}

function materializeAuthorityAttackInputSelection({
  action,
  mapping,
  ownerChains,
  expected,
}) {
  const chain = (ownerChains ?? []).find(
    candidate =>
      expected.chainIdentity != null &&
      String(candidate.chainIdentity) === String(expected.chainIdentity)
  );
  const segment = chain?.segments?.find(
    candidate =>
      Number(candidate.sequenceIndex) === Number(expected.sequenceIndex) &&
      Number(candidate.controlSkillId) === Number(expected.controlSkillId) &&
      Number(candidate.subSkillIndex) === Number(expected.subSkillIndex)
  );
  const sourceSegment = findAttackInputSourceSegment({
    mapping,
    controlSkillId: expected.controlSkillId,
    subSkillIndex: expected.subSkillIndex,
    sequenceIndex: chain ? null : expected.sequenceIndex,
    allowSubSkillProjection: Boolean(chain),
  });
  if (!sourceSegment || (chain && !segment)) return null;
  const projectedSegment = chain
    ? projectVerifiedAttackInputChainSegment(
        sourceSegment,
        segment,
        Number(expected.sequenceIndex),
        chain.segments.length
      )
    : {
        ...sourceSegment,
        sequenceIndex: Number(expected.sequenceIndex),
        sequenceTotal: Number(
          sourceSegment.sequenceTotal ?? mapping.attackInputSegments?.length
        ),
        attackInputChainIdentity: null,
      };
  if (!projectedSegment) return null;
  return createMaterializedAttackInputSelection({
    action,
    actionKind: mapping?.actionKind ?? action.actionKind ?? null,
    chain,
    segment: segment ?? sourceSegment,
    projectedSegment,
    sequenceIndex: Number(expected.sequenceIndex),
    groupId: expected.groupId,
    contextActionId: expected.contextActionId,
  });
}

function materializeExistingAttackInputSelection({
  action,
  mapping,
  chain,
  sequenceIndex,
}) {
  const segment = chain?.segments?.find(
    item => Number(item.sequenceIndex) === Number(sequenceIndex)
  );
  const requestedControlSkillId =
    segment?.controlSkillId ?? action.attackInput?.controlSkillId;
  const requestedSubSkillIndex =
    segment?.subSkillIndex ??
    action.attackInput?.subSkillIndex ??
    action.attackInput?.selectedSubSkillIndex ??
    action.controlSubSkillIndex;
  const sourceSegment = findAttackInputSourceSegment({
    mapping,
    controlSkillId: requestedControlSkillId,
    subSkillIndex: requestedSubSkillIndex,
    sequenceIndex: chain ? null : sequenceIndex,
    allowSubSkillProjection: Boolean(chain),
  });
  if (!sourceSegment || (chain && !segment)) return null;
  const projectedSegment = chain
    ? projectVerifiedAttackInputChainSegment(
        sourceSegment,
        segment,
        sequenceIndex,
        chain.segments.length
      )
    : sourceSegment;
  if (!projectedSegment) return null;
  return createMaterializedAttackInputSelection({
    action,
    actionKind: mapping?.actionKind ?? action.actionKind ?? null,
    chain,
    segment: segment ?? sourceSegment,
    projectedSegment,
    sequenceIndex,
    groupId: action.attackGroupId,
    contextActionId:
      action.runtimeContextActionId ?? action.contextActionId ?? null,
  });
}

function findAttackInputSourceSegment({
  mapping,
  controlSkillId,
  subSkillIndex,
  sequenceIndex,
  allowSubSkillProjection = false,
}) {
  const candidatePools = allowSubSkillProjection
    ? [
        mapping.attackInputSourceSegments ?? [],
        mapping.attackInputSegments ?? [],
      ]
    : [
        mapping.attackInputSegments ?? [],
        mapping.attackInputSourceSegments ?? [],
      ];
  for (const candidates of candidatePools) {
    const matches = candidates.filter(
      candidate =>
        Number(candidate.controlSkillId) === Number(controlSkillId) &&
        (allowSubSkillProjection ||
          Number(candidate.subSkillIndex ?? candidate.selectedSubSkillIndex) ===
            Number(subSkillIndex)) &&
        (sequenceIndex == null ||
          candidate.sequenceIndex == null ||
          Number(candidate.sequenceIndex) === Number(sequenceIndex))
    );
    if (matches.length > 0) return matches.length === 1 ? matches[0] : null;
  }
  return null;
}

function createMaterializedAttackInputSelection({
  action,
  actionKind,
  chain,
  segment,
  projectedSegment,
  sequenceIndex,
  groupId,
  contextActionId,
}) {
  const attackInputChainIdentity = chain?.chainIdentity ?? null;
  const attackSequenceTotal = Number(
    chain?.segments?.length ?? projectedSegment.sequenceTotal
  );
  return {
    chain,
    segment,
    sequenceIndex,
    action: {
      ...action,
      actionKind: actionKind ?? action.actionKind ?? null,
      attackGroupId: groupId ?? action.attackGroupId,
      attackSequenceIndex: sequenceIndex,
      attackSequenceTotal,
      attackInputChainIdentity,
      runtimeContextActionId:
        contextActionId ?? action.runtimeContextActionId ?? null,
      controlSubSkillIndex: Number(
        segment.subSkillIndex ?? segment.selectedSubSkillIndex
      ),
      attackInput: {
        ...projectedSegment,
        sequenceIndex,
        sequenceTotal: attackSequenceTotal,
        attackInputChainIdentity,
      },
    },
  };
}

function resolveRuntimeDerivedAttackChainEntry({
  chain,
  ownerChains,
  actorState,
  actorId,
  activeSwitchWindows,
  previous,
  timeMs,
}) {
  if (
    !chain.segments?.length ||
    !hasAttackChainEntryResource(chain, actorState)
  ) {
    return null;
  }
  const quickEntries = (activeSwitchWindows ?? [])
    .filter(
      window =>
        (window.compilerBindingIdentity != null ||
          window.relationType === 'attack-chain-continuity-window') &&
        String(window.actorId) === String(actorId) &&
        runtimeWindowContainsTime(window, timeMs)
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
      sourceActionId: quickEntries[0].window.sourceActionId,
      actorId,
      chainIdentity: chain.chainIdentity,
      controlSkillId: Number(quickEntries[0].segment.controlSkillId),
      subSkillIndex: Number(quickEntries[0].segment.subSkillIndex),
      groupId: previous?.attackGroupId ?? null,
      startsAtMs: Number(quickEntries[0].window.startsAtMs),
      endsAtMs: Number(quickEntries[0].window.endsAtMs),
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
        sourceActionId: previous.actionId,
        actorId,
        chainIdentity: chain.chainIdentity,
        controlSkillId: Number(chain.segments[0].controlSkillId),
        subSkillIndex: Number(chain.segments[0].subSkillIndex),
        groupId: previous.attackGroupId ?? null,
        startsAtMs:
          Number(previous.startMs) +
          framesToMs(transition.inputWindow.startFrame, FRAME_RATE),
        endsAtMs:
          Number(previous.startMs) +
          framesToMs(transition.inputWindow.endFrame, FRAME_RATE),
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
  if (!actorState) return false;
  const costPerSegment = Number(segmentLimit.costPerSegment);
  return costPerSegment > 0 && Number(actorState.current) >= costPerSegment;
}

function resolveUniqueExecutedAttackInputChainSegment({
  mapping,
  actorState,
  attackInputChains,
  executionControlSkillId,
  selectedSubSkillIndex,
}) {
  if (
    mapping?.ownerKind === 'kibo' ||
    !Number.isInteger(Number(executionControlSkillId)) ||
    !Number.isInteger(Number(selectedSubSkillIndex))
  ) {
    return null;
  }
  const matches = (attackInputChains ?? []).flatMap(chain => {
    if (
      chain.applied !== true ||
      Number(chain.ownerId) !== Number(mapping.ownerId) ||
      Number(chain.sourceSkillId) !== Number(mapping.sourceSkillId) ||
      !isRuntimeConditionSatisfied(chain.stateCondition, actorState) ||
      !hasAttackChainEntryResource(chain, actorState)
    ) {
      return [];
    }
    return (chain.segments ?? [])
      .filter(
        segment =>
          Number(segment.controlSkillId) === Number(executionControlSkillId) &&
          Number(segment.subSkillIndex) === Number(selectedSubSkillIndex)
      )
      .map(segment => ({
        chain,
        segment,
        sequenceIndex: Number(segment.sequenceIndex),
      }));
  });
  const uniqueMatches = [
    ...new Map(
      matches.map(match => [
        `${match.chain.chainIdentity}|${match.sequenceIndex}`,
        match,
      ])
    ).values(),
  ];
  return uniqueMatches.length === 1 ? uniqueMatches[0] : null;
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
          runtimeWindowContainsTime(window, actionTimeMs)
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
  if (!resolution?.actionBinding || !segment) return resolution;
  const durationFrames = Number(segment.durationFrames);
  if (!(durationFrames > 0)) return resolution;
  const frameRate = Number(resolution.controlBinding?.frameRate) || FRAME_RATE;
  const timingSourceKind = chain
    ? 'verified-attack-input-chain'
    : 'verified-normal-attack-structural-segment';
  const occupancy = {
    ...(resolution.actionBinding.actionTiming?.occupancy ?? {}),
    status: 'applied',
    sourceKind: timingSourceKind,
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
            durationBasis: timingSourceKind,
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
      attackInputChainIdentity: chain?.chainIdentity ?? null,
    },
  };
}

function materializeRuntimeContextNormalAttackInput({
  action,
  mapping,
  contextSelection,
}) {
  const binding = contextSelection?.binding;
  if (!binding) return null;
  const executionControlSkillId = Number(binding.executionControlSkillId);
  const selectedSubSkillIndex = Number(binding.targetSubSkillIndex ?? 0);
  const matchingSegments = (mapping?.attackInputSegments ?? []).filter(
    segment =>
      Number(segment.controlSkillId) === executionControlSkillId &&
      Number(segment.subSkillIndex ?? segment.selectedSubSkillIndex ?? 0) ===
        selectedSubSkillIndex
  );
  const predecessor = contextSelection.previous ?? null;
  const sequenceIndex =
    matchingSegments.length === 1
      ? Number(matchingSegments[0].sequenceIndex)
      : predecessor?.actionKind !== 'normal-attack'
        ? 1
        : Number(action.attackSequenceIndex);
  const attackGroupId =
    predecessor?.actionKind === 'normal-attack'
      ? (predecessor.attackGroupId ?? action.attackGroupId ?? null)
      : (action.attackGroupId ?? null);
  return {
    ...action,
    attackGroupId,
    attackSequenceIndex: sequenceIndex,
    runtimeContextActionId: predecessor?.actionId ?? null,
    controlSubSkillIndex: selectedSubSkillIndex,
    attackInput: {
      ...(action.attackInput ?? {}),
      sequenceIndex,
      controlSkillId: executionControlSkillId,
      subSkillIndex: selectedSubSkillIndex,
      selectedSubSkillIndex,
    },
  };
}

function resolveContextVariantSelection({
  contextBindings,
  previous,
  actorState,
  controlSkillId,
  selectedSubSkillIndex = null,
  requestedExecutionControlSkillId = null,
  allowAnyTargetControlSkillId = false,
  timeMs,
  inputCommand = null,
  required = false,
  attackGroupId = null,
}) {
  if (!previous?.ready) {
    return required
      ? {
          status: 'missing',
          binding: null,
          previous: null,
          conflictingEdges: [],
        }
      : { status: 'none', binding: null, previous: null };
  }
  if (previous.contextReady === false) {
    return { status: 'none', binding: null, previous: null };
  }
  const sourceCandidates = (contextBindings ?? []).filter(binding => {
    if (
      Number(binding.ownerId) !== Number(actorState.profile.ownerId) ||
      Number(binding.sourceControlSkillId) !==
        Number(previous.controlSkillId) ||
      Number(binding.sourceSubSkillIndex) !==
        Number(previous.selectedSubSkillIndex) ||
      (inputCommand != null &&
        String(binding.inputCommand ?? '') !== String(inputCommand)) ||
      !isRuntimeConditionSatisfied(binding.condition, actorState)
    ) {
      return false;
    }
    return true;
  });
  if (!sourceCandidates.length) {
    return {
      status: 'none',
      binding: null,
      previous,
      sourceCandidateCount: 0,
    };
  }
  if (
    required &&
    inputCommand === 'normal-attack' &&
    requestedExecutionControlSkillId == null &&
    !sourceCandidates.every(
      binding => binding.outsideWindowFallback === 'default-input'
    )
  ) {
    return {
      status: 'conflict',
      binding: null,
      previous,
      conflictingEdges: sourceCandidates,
    };
  }
  if (
    inputCommand === 'normal-attack' &&
    previous.actionKind === 'normal-attack' &&
    String(previous.attackGroupId ?? '') !== String(attackGroupId ?? '')
  ) {
    return {
      status: 'group-conflict',
      binding: null,
      previous,
      conflictingEdges: sourceCandidates,
    };
  }
  const scheduled = sourceCandidates
    .map(binding => ({
      binding,
      inputScheduling: resolveVerifiedContextInputScheduling({
        edges: [binding],
        predecessorStartMs: previous.startMs,
        predecessorEffectiveEndFrame: previous.effectiveDurationFrames,
        requestedExecutionStartMs: timeMs,
      }),
    }))
    .filter(candidate => candidate.inputScheduling);
  if (!scheduled.length) {
    if (
      sourceCandidates.every(
        binding => binding.outsideWindowFallback === 'default-input'
      )
    ) {
      return {
        status: 'none',
        binding: null,
        previous,
        fallback: 'default-input',
        sourceCandidateCount: sourceCandidates.length,
      };
    }
    return required
      ? {
          status: 'missing',
          binding: null,
          previous,
          conflictingEdges: sourceCandidates,
        }
      : {
          status: 'none',
          binding: null,
          previous,
          sourceCandidateCount: sourceCandidates.length,
        };
  }
  const requestedSubSkillIndex = Number(selectedSubSkillIndex);
  const hasRequestedSubSkillIndex =
    selectedSubSkillIndex != null && Number.isInteger(requestedSubSkillIndex);
  const candidates = scheduled.filter(
    candidate =>
      (allowAnyTargetControlSkillId ||
        Number(candidate.binding.targetControlSkillId) ===
          Number(controlSkillId)) &&
      (requestedExecutionControlSkillId == null ||
        Number(candidate.binding.executionControlSkillId) ===
          Number(requestedExecutionControlSkillId)) &&
      (!hasRequestedSubSkillIndex ||
        Number(candidate.binding.targetSubSkillIndex ?? 0) ===
          requestedSubSkillIndex)
  );
  if (!candidates.length) {
    return {
      status: 'conflict',
      binding: null,
      previous,
      inputScheduling: scheduled[0].inputScheduling,
      conflictingEdges: scheduled.map(candidate => candidate.binding),
    };
  }
  if (candidates.length !== 1) {
    return {
      status: 'ambiguous',
      binding: null,
      previous,
      inputScheduling: candidates[0].inputScheduling,
      conflictingEdges: candidates.map(candidate => candidate.binding),
    };
  }
  return {
    status: 'selected',
    binding: candidates[0].binding,
    previous,
    inputScheduling: candidates[0].inputScheduling,
  };
}

function hasExplicitContextPredecessor(action) {
  return (
    action?.runtimeContextActionId != null || action?.contextActionId != null
  );
}

function resolveRequestedContextTargetSubSkillIndex(action) {
  const value = Number(
    action?.attackInput?.selectedSubSkillIndex ??
      action?.attackInput?.subSkillIndex ??
      action?.controlSubSkillIndex
  );
  return Number.isInteger(value) ? value : null;
}

function resolveRequestedContextExecutionControlSkillId(action, mapping) {
  const verifiedContextExecutionControlSkillId = Number(
    action?.attackInput?.contextVariant?.executionControlSkillId
  );
  if (Number.isInteger(verifiedContextExecutionControlSkillId)) {
    return verifiedContextExecutionControlSkillId;
  }
  const identity = action?.attackInput?.identity;
  if (!identity) return null;
  const matches = [
    ...(mapping?.attackInputSegments ?? []),
    ...(mapping?.attackInputSourceSegments ?? []),
  ].filter(segment => String(segment.identity ?? '') === String(identity));
  const values = [
    ...new Set(
      matches
        .map(segment => Number(segment.controlSkillId))
        .filter(Number.isInteger)
    ),
  ];
  return values.length === 1 ? values[0] : null;
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

function resolveExecutionPrerequisite({ prerequisite, scenario, action }) {
  if (!prerequisite) return { status: 'not-required' };
  if (
    prerequisite.applied !== true ||
    prerequisite.kind !== 'scenario-event-at-action-frame'
  ) {
    return {
      status: 'blocked',
      reason: 'verified-action-execution-prerequisite-unresolved',
    };
  }
  const frameRate = Number(scenario?.time?.fps) || FRAME_RATE;
  const actionFrame = Math.round(
    ((Number(action?.startMs) || 0) * frameRate) / 1000
  );
  const toleranceFrames = Math.max(
    0,
    Number(prerequisite.toleranceFrames) || 0
  );
  const matchingEvent =
    (scenario?.actions ?? []).find(candidate => {
      if (
        candidate.type !== ACTION_TYPES.ENEMY_EVENT ||
        candidate.eventType !== prerequisite.eventType
      ) {
        return false;
      }
      const eventFrame = Math.round(
        ((Number(candidate.startMs) || 0) * frameRate) / 1000
      );
      return Math.abs(eventFrame - actionFrame) <= toleranceFrames;
    }) ?? null;
  return matchingEvent
    ? {
        status: 'satisfied',
        eventActionId: matchingEvent.id,
        eventFrame: actionFrame,
      }
    : {
        status: 'blocked',
        reason: 'verified-action-execution-prerequisite-missing',
        eventFrame: actionFrame,
      };
}

function isRuntimeConditionSatisfied(condition, actorState) {
  if (!condition) return true;
  if (condition.kind === 'always') return true;
  if (!actorState) return false;
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

function createPersistentPassiveEffectCommand({
  mechanicsPackage,
  actorState,
  profile,
  trigger,
  timeMs,
  sourceKind = 'battle-start',
  sourceTransitionId = null,
}) {
  const effectIdentity = profile.passiveIdentity;
  return {
    id: `verified-passive|${sourceKind}|${effectIdentity}|${
      sourceTransitionId ?? trigger.triggerIdentity
    }|${timeMs}`,
    sourceActionId: null,
    sourceActionName: null,
    sourceActorId: actorState.actor.id,
    sourceActorName: actorState.actor.name,
    effectId: profile.effectId,
    effectName: profile.name,
    operation: EFFECT_OPERATIONS.APPLY,
    targetKind: EFFECT_TARGET_KINDS.ACTOR,
    targetId: String(actorState.actor.id),
    targetName: actorState.actor.name,
    timeMs,
    durationMs: profile.durationMs,
    stackMode: EFFECT_STACK_MODES.REFRESH,
    stackDelta: profile.stackDelta ?? 1,
    maxStacks: profile.maxStacks ?? 1,
    tags: ['passive', `passive:${profile.skillId}`],
    sourceStatus: 'verified-passive-effect-generated',
    confidence: 'high',
    trackingStatus: 'applied',
    sourceIdentity: {
      packageId: mechanicsPackage.packageId,
      packageHash: mechanicsPackage.packageHash,
      actionBindingIdentity: sourceKind,
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
    edgeIdentity: selectionSource?.edgeIdentity ?? null,
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
    chargingRelease: selectionSource?.chargingRelease ?? null,
    appliedAssumptionIdentity:
      selectionSource?.chargingRelease?.assumptionIdentity ?? null,
    appliedAssumptionVersion:
      selectionSource?.chargingRelease?.assumptionVersion ?? null,
    appliedAssumptionHash:
      selectionSource?.chargingRelease?.assumptionHash ?? null,
    attackInputChainIdentity: selectionSource?.chainIdentity ?? null,
    attackChainSequenceIndex: selectionSource?.chainSequenceIndex ?? null,
    ...(action.attackGroupId == null
      ? {}
      : {
          attackGroupId: action.attackGroupId,
          attackSequenceIndex: action.attackSequenceIndex ?? null,
          attackSequenceTotal: action.attackSequenceTotal ?? null,
          attackInputLinkTimingStatus:
            action.attackInput?.linkTimingStatus ?? null,
          attackInputLinkWindow: action.attackInput?.linkWindow
            ? {
                startFrame: action.attackInput.linkWindow.startFrame ?? null,
                endFrame: action.attackInput.linkWindow.endFrame ?? null,
                targetControlSkillId:
                  action.attackInput.linkWindow.targetControlSkillId ?? null,
                targetSubSkillIndex:
                  action.attackInput.linkWindow.targetSubSkillIndex ?? null,
                allowAttack: action.attackInput.linkWindow.allowAttack ?? null,
                sourceIdentity:
                  action.attackInput.linkWindow.sourceIdentity ?? null,
              }
            : null,
        }),
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

function composeVerifiedChargingReleaseResolution({
  resolution,
  sourceResolution,
  binding,
  selection,
}) {
  const sourceWrapperReady =
    sourceResolution?.ready === true ||
    isVerifiedChargingReleaseSourceWrapperResolution({
      sourceResolution,
      binding,
      selection,
    });
  if (!resolution?.ready || !sourceWrapperReady || !selection?.ready) {
    return {
      ...(resolution ?? {}),
      ready: false,
      applied: false,
      status: 'verified-charging-release-composition-unresolved',
      reasons: [
        ...(resolution?.reasons ?? []),
        ...(sourceResolution?.reasons ?? []),
        'charging-release-source-or-target-resolution-unready',
      ],
    };
  }
  const releaseFrame = Number(selection.releaseFrame);
  const releaseDurationFrames = Number(
    resolution.actionBinding?.actionTiming?.occupancy?.durationFrames ??
      resolution.actionBinding?.actualDurationFrames ??
      0
  );
  const durationFrames = releaseFrame + releaseDurationFrames;
  const frameRate = Number(resolution.controlBinding?.frameRate) || FRAME_RATE;
  const sourceHits = (sourceResolution.hits ?? []).filter(
    hit => Number(hit.trigger?.startFrame) < releaseFrame
  );
  const sourceAllHits = (
    sourceResolution.allHits ??
    sourceResolution.hits ??
    []
  ).filter(hit => Number(hit.trigger?.startFrame) < releaseFrame);
  const sourceEffects = (sourceResolution.effects ?? []).filter(
    effect => Number(effect.trigger?.startFrame) < releaseFrame
  );
  const releaseHits = (resolution.hits ?? []).map(hit =>
    shiftChargingReleaseRecord(hit, releaseFrame, binding.bindingIdentity)
  );
  const releaseAllHits = (resolution.allHits ?? resolution.hits ?? []).map(
    hit =>
      shiftChargingReleaseRecord(hit, releaseFrame, binding.bindingIdentity)
  );
  const releaseEffects = (resolution.effects ?? []).map(effect =>
    shiftChargingReleaseRecord(effect, releaseFrame, binding.bindingIdentity)
  );
  const hits = [...sourceHits, ...releaseHits];
  const allHits = [...sourceAllHits, ...releaseAllHits];
  const effects = [...sourceEffects, ...releaseEffects];
  const chargingRelease = {
    bindingIdentity: binding.bindingIdentity,
    sourceControlSkillId: binding.sourceControlSkillId,
    sourceSubSkillIndex: binding.sourceSubSkillIndex,
    executionControlSkillId: Number(selection.selected.executionControlSkillId),
    executionSubSkillIndex: Number(selection.selected.executionSubSkillIndex),
    releaseFrame,
    releaseDurationFrames,
    durationFrames,
    selectedWindowIdentity: selection.selectedWindowIdentity,
    candidateWindowIdentities: selection.candidateWindowIdentities,
    overlappingCandidateCount: selection.overlappingCandidateCount,
    precedence: binding.precedence,
    boundary: binding.boundary,
    assumptionIdentity: binding.assumptionIdentity,
    assumptionVersion: binding.assumptionVersion,
    assumptionHash: binding.assumptionHash,
    status: 'verified-charging-release-composition-ready',
    applied: true,
  };
  return {
    ...resolution,
    status: 'verified-combat-action-mechanics-charging-release-ready',
    hits,
    allHits,
    effects,
    controlBinding: {
      ...resolution.controlBinding,
      hits,
      effects,
      compositeControlSegments: [
        {
          controlSkillId: binding.sourceControlSkillId,
          subSkillIndex: binding.sourceSubSkillIndex,
          startFrame: 0,
          endFrame: releaseFrame,
          boundary: 'right-open',
        },
        {
          controlSkillId: Number(selection.selected.executionControlSkillId),
          subSkillIndex: Number(selection.selected.executionSubSkillIndex),
          startFrame: releaseFrame,
          endFrame: durationFrames,
          boundary: 'right-open',
        },
      ],
    },
    actionBinding: {
      ...resolution.actionBinding,
      actualDurationFrames: durationFrames,
      actualDurationMs: framesToMs(durationFrames, frameRate),
      effectiveOccupancyFrames: durationFrames,
      selectedHitIdentities: hits.map(hit => hit.hitIdentity),
      selectedEffectIdentities: effects.map(effect => effect.effectIdentity),
      runtimeHitCount: hits.length,
      runtimeEffectCount: effects.filter(
        effect => effect.classification === 'applied'
      ).length,
      actionTiming: {
        ...(resolution.actionBinding?.actionTiming ?? {}),
        status: 'applied',
        occupancy: {
          ...(resolution.actionBinding?.actionTiming?.occupancy ?? {}),
          startFrame: 0,
          endFrame: durationFrames,
          durationFrames,
          frameRate,
          status: 'applied',
          sourceKind: 'verified-charging-release-composition',
          sourceIdentity: binding.sourceIdentity,
        },
      },
      chargingRelease,
      appliedAssumptionIdentities: [binding.assumptionIdentity],
    },
    chargingRelease,
    appliedAssumptionIdentities: [binding.assumptionIdentity],
  };
}

function isVerifiedChargingReleaseSourceWrapperResolution({
  sourceResolution,
  binding,
  selection,
}) {
  const actionBinding = sourceResolution?.actionBinding;
  const timing = actionBinding?.actionTiming;
  const occupancy = timing?.occupancy;
  const authority = timing?.chargedInputAuthority;
  const [domainStartFrame, domainEndFrame] =
    occupancy?.releaseFrameDomain ?? [];
  const releaseFrame = Number(selection?.releaseFrame);
  return (
    binding?.applied === true &&
    selection?.ready === true &&
    Number(actionBinding?.controlSkillId) ===
      Number(binding.sourceControlSkillId) &&
    Number(actionBinding?.selectedSubSkillIndex) ===
      Number(binding.sourceSubSkillIndex) &&
    timing?.status === 'applied' &&
    occupancy?.status === 'applied' &&
    occupancy?.effectiveDurationRequiresChargingRelease === true &&
    occupancy?.sourceKind ===
      'installed-client-static-charged-wrapper-release-domain' &&
    authority?.applied === true &&
    authority?.compositeChargingRelease != null &&
    Number.isInteger(Number(domainStartFrame)) &&
    Number.isInteger(Number(domainEndFrame)) &&
    releaseFrame >= Number(domainStartFrame) &&
    releaseFrame < Number(domainEndFrame)
  );
}

function shiftChargingReleaseRecord(record, frameOffset, bindingIdentity) {
  const trigger = record?.trigger ?? {};
  const shift = value =>
    Number.isFinite(Number(value)) ? Number(value) + frameOffset : value;
  const shiftFrameCondition = condition =>
    condition && typeof condition === 'object'
      ? {
          ...condition,
          ...(condition.triggerFrame == null
            ? {}
            : { triggerFrame: shift(condition.triggerFrame) }),
          ...(condition.decisionFrame == null
            ? {}
            : { decisionFrame: shift(condition.decisionFrame) }),
          ...(Array.isArray(condition.triggerFrames)
            ? { triggerFrames: condition.triggerFrames.map(shift) }
            : {}),
        }
      : condition;
  return {
    ...record,
    trigger: {
      ...trigger,
      startFrame: shift(trigger.startFrame),
      impactFrame: shift(trigger.impactFrame),
      endFrame: shift(trigger.endFrame),
      sourceIdentity: [
        trigger.sourceIdentity,
        `charging-release:${bindingIdentity}:offset=${frameOffset}`,
      ]
        .filter(Boolean)
        .join('|'),
    },
    hitActivation: shiftFrameCondition(record.hitActivation),
    landedHitActivationCondition: shiftFrameCondition(
      record.landedHitActivationCondition
    ),
    runtimeCondition: shiftFrameCondition(record.runtimeCondition),
    chargingReleaseFrameOffset: frameOffset,
    sourceIdentity: [
      record.sourceIdentity,
      `charging-release:${bindingIdentity}:offset=${frameOffset}`,
    ]
      .filter(Boolean)
      .join('|'),
  };
}

function createChargingReleaseExecutionBlock({
  action,
  actorState,
  binding,
  selection,
}) {
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-verified-charging-release-execution-block',
    code: 'verified-charging-release-selection-unresolved',
    status: 'unresolved',
    executable: false,
    actionId: action.id,
    actionName: action.name ?? action.id,
    actorId: action.actorId ?? null,
    ownerId: actorState?.profile?.ownerId ?? binding.ownerId,
    controlSkillId: binding.sourceControlSkillId,
    selectedSubSkillIndex: binding.sourceSubSkillIndex,
    bindingIdentity: binding.bindingIdentity,
    appliedAssumptionIdentity: binding.assumptionIdentity,
    releaseFrame: selection.releaseFrame,
    candidateWindowIdentities: selection.candidateWindowIdentities ?? [],
    reason: selection.status,
    reasons: selection.reasons ?? [selection.status],
    sourceIdentity: binding.sourceIdentity,
    appliedToCalculators: true,
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
      inputStep: state.profile.inputStep,
      scenarioConfigurable: state.profile.scenarioConfigurable === true,
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
  if (
    mapping?.actionKind === 'normal-attack' &&
    mapping?.ownerKind !== 'kibo'
  ) {
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
      runtimeWindowContainsTime(window, timeMs)
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
  if (binding.condition.kind === 'always') return true;
  if (binding.condition.kind === 'resource-at-least') {
    return state.current >= Number(binding.condition.value || 0);
  }
  if (binding.condition.kind === 'resource-state-active') {
    return state.activeStates.has(Number(binding.condition.stateElementId));
  }
  return false;
}

function resolveOperationAmount(operation, action) {
  const level = resolveVerifiedActionLevelValue(action);
  return Number(
    operation.amountByLevel?.[level] ?? operation.amountByLevel?.[1] ?? 0
  );
}

function resolveResourceOperationHitGate({
  operation,
  action,
  resolution,
  scenario,
}) {
  const gate = operation.hitGate;
  if (!gate) return { candidateCount: 1, landedCount: 1 };
  if (gate.kind !== 'landed-action-hit') {
    return { candidateCount: 0, landedCount: 0 };
  }
  const candidates = (resolution?.hits ?? []).filter(
    hit =>
      Number(hit.elementId) === Number(gate.elementId) &&
      Number(hit.trigger?.startFrame) === Number(gate.triggerFrame) &&
      (!gate.behaviorPathId ||
        hit.trigger?.behaviorPathId === gate.behaviorPathId)
  );
  const defaultWillHit =
    (scenario?.combatScenario?.projectile?.defaultWillHit ??
      scenario?.projectile?.defaultWillHit) !== false;
  const landedCount = candidates
    .slice(0, Number(gate.maximumMatches) || 1)
    .filter(hit =>
      resolveActionHitWillHit(
        action,
        resolveRuntimeHitIdentity(hit),
        defaultWillHit
      )
    ).length;
  return { candidateCount: candidates.length, landedCount };
}

function resolveRuntimeHitIdentity(hit) {
  return String(
    hit?.identity ??
      hit?.hitIdentity ??
      hit?.sourceIdentity ??
      `${hit?.elementId ?? 'element'}|${hit?.hitIndex ?? 'hit'}`
  );
}

function createThresholdEffectGrantCommand({
  mechanicsPackage,
  actorState,
  action,
  timeMs,
  transition,
  grant,
  operation,
}) {
  return {
    id: `verified-threshold-effect|${action.id}|${grant.effectId}|${timeMs}`,
    sourceActionId: action.id,
    sourceActionName: action.name,
    sourceActorId: action.actorId,
    sourceActorName: action.actor?.name ?? actorState.actor.name,
    effectId: grant.effectId,
    effectName: grant.name,
    operation,
    targetKind: EFFECT_TARGET_KINDS.ACTOR,
    targetId: String(action.actorId),
    targetName: action.actor?.name ?? actorState.actor.name,
    timeMs,
    durationMs: grant.durationMs,
    stackMode: EFFECT_STACK_MODES.REFRESH,
    stackDelta: 1,
    maxStacks: 1,
    tags: ['special-resource-threshold', `state:${transition.stateElementId}`],
    sourceStatus: 'verified-threshold-effect-generated',
    confidence: 'high',
    trackingStatus: 'applied',
    sourceIdentity: {
      packageId: mechanicsPackage.packageId,
      packageHash: mechanicsPackage.packageHash,
      actionBindingIdentity: transition.transitionIdentity,
      effectIdentity: grant.effectId,
      sourceIdentity: grant.sourceIdentity,
    },
    modifiers: (grant.modifiers ?? []).map(modifier => ({
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

function createCompanionEvent({
  kind,
  timeMs,
  action,
  companion,
  sourceIdentity,
  reason = null,
  attackIdentity = null,
  attackCount = null,
}) {
  return {
    type: `VERIFIED_COMPANION_${String(kind).toUpperCase().replaceAll('-', '_')}`,
    kind,
    timeMs: Number(timeMs),
    actionId: action?.id ?? null,
    actorId: companion.actorId,
    payload: {
      companionIdentity: companion.profile.companionIdentity,
      companionUnitId: companion.profile.unitId,
      companionRevision: companion.revision,
      ownerId: companion.ownerId,
      ownership: companion.profile.ownership,
      targetKind: companion.profile.targetKind,
      startsAtMs: companion.startsAtMs,
      endsAtMs: companion.endsAtMs,
      attackIdentity,
      attackCount,
      reason,
      sourceIdentity,
      appliedToActionVariantRuntime: true,
    },
  };
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
    ...createActionSourceSequenceFields(action),
    code: 'VERIFIED_SPECIAL_RESOURCE_INSUFFICIENT',
    status: 'blocked',
    reason: 'verified-special-resource-insufficient',
    reasons: ['special-resource-consume-precondition-failed'],
    sourceKind: 'azpr-verified-special-resource-runtime',
    sourceIdentity: operations.map(operation => operation.sourceIdentity),
    actionId: action.id,
    actionName: action.name,
    actorId: action.actorId,
    runtimeOwnerIdentity: action.actorId,
    ownerKind: 'actor',
    ownerId: Number(actorState.profile.ownerId),
    timeMs: action.startMs,
    controlSkillId,
    selectedSubSkillIndex,
    resourceIdentity: actorState.profile.resourceIdentity,
    resourceKind: 'special-resource',
    resourceName: actorState.profile.name,
    requiredValue,
    currentValue: actorState.current,
    maxValue: actorState.profile.capacity,
    valueUnit: 'verified-special-resource-points',
  };
}

function createVariantExecutionBlock({
  action,
  actorState,
  controlSkillId,
  activeSelection,
}) {
  return {
    ...createActionSourceSequenceFields(action),
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

function createContextWindowConflictBlock({
  action,
  actorState,
  controlSkillId,
  contextSelection,
}) {
  const status = contextSelection.status;
  const statusFields =
    status === 'ambiguous'
      ? {
          code: 'VERIFIED_ACTION_CONTEXT_WINDOW_AMBIGUOUS',
          reason: 'verified-context-window-input-ambiguous',
          primaryReason: 'open-context-window-target-ambiguous',
          message: `${action.name ?? '动作'}命中多个相同目标的派生衔接窗口，无法唯一选择执行形态`,
        }
      : status === 'missing'
        ? {
            code: 'VERIFIED_ACTION_CONTEXT_WINDOW_MISSING',
            reason: 'verified-context-window-input-missing',
            primaryReason: 'explicit-context-window-not-open',
            message: `${action.name ?? '动作'}显式引用前动作，但执行时刻不在任何权威派生衔接窗口内`,
          }
        : status === 'group-conflict'
          ? {
              code: 'VERIFIED_ACTION_CONTEXT_GROUP_CONFLICT',
              reason: 'verified-context-window-group-conflict',
              primaryReason: 'normal-context-attack-group-mismatch',
              message: `${action.name ?? '动作'}与前置普通攻击不属于同一输入组`,
            }
          : {
              code: 'VERIFIED_ACTION_CONTEXT_WINDOW_CONFLICT',
              reason: 'verified-context-window-input-conflict',
              primaryReason: 'open-context-window-target-mismatch',
              message: `${action.name ?? '动作'}落在前动作的派生衔接窗口内，但输入目标不是窗口允许的形态`,
            };
  const edges = contextSelection.conflictingEdges ?? [];
  const scheduling = contextSelection.inputScheduling ?? null;
  const expectedTargets = [
    ...new Set(
      edges.map(
        edge =>
          `${edge.targetControlSkillId ?? ''}/${edge.targetSubSkillIndex ?? 0}`
      )
    ),
  ].sort();
  return {
    ...createActionSourceSequenceFields(action),
    code: statusFields.code,
    status: 'blocked',
    reason: statusFields.reason,
    reasons: [
      statusFields.primaryReason,
      `requested-control:${controlSkillId ?? ''}`,
      `expected-targets:${expectedTargets.join(',') || 'none'}`,
    ],
    message: statusFields.message,
    sourceKind: 'azpr-verified-action-variant-runtime',
    sourceIdentity: edges.map(edge => edge.sourceIdentity).filter(Boolean),
    actionId: action.id,
    actionName: action.name,
    actorId: action.actorId,
    timeMs: action.startMs,
    controlSkillId,
    requestedControlSkillId: controlSkillId,
    expectedControlSkillIds: expectedTargets,
    contextActionId: contextSelection.previous?.actionId ?? null,
    inputWindow: scheduling?.edge?.inputWindow ?? edges[0]?.inputWindow ?? null,
    resourceIdentity: actorState?.profile?.resourceIdentity ?? null,
    resourceName: actorState?.profile?.name ?? null,
    requiredValue: null,
    currentValue: actorState?.current ?? null,
    maxValue: actorState?.profile?.capacity ?? null,
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
    ...createActionSourceSequenceFields(action),
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

function createExecutionPrerequisiteBlock({
  action,
  actorState,
  publicControlSkillId,
  directExecutionForm,
  executionPrerequisite,
}) {
  const prerequisite = directExecutionForm?.executionPrerequisite;
  return {
    ...createActionSourceSequenceFields(action),
    code: 'VERIFIED_ACTION_EXECUTION_PREREQUISITE_MISSING',
    status: 'blocked',
    reason:
      executionPrerequisite.reason ??
      'verified-action-execution-prerequisite-missing',
    reasons: [
      `scenario-event-required:${prerequisite?.eventType ?? 'unknown'}`,
    ],
    message: `${action.name ?? '动作'}需要同帧场景事件“${prerequisite?.eventType ?? '未知事件'}”`,
    sourceKind: 'azpr-verified-action-variant-runtime',
    sourceIdentity: prerequisite?.sourceIdentity ?? null,
    actionId: action.id,
    actionName: action.name,
    actorId: action.actorId,
    timeMs: action.startMs,
    controlSkillId: publicControlSkillId,
    executionControlSkillId:
      directExecutionForm?.executionControlSkillId ?? null,
    selectedSubSkillIndex: directExecutionForm?.executionSubSkillIndex ?? null,
    resourceIdentity: actorState?.profile?.resourceIdentity ?? null,
    resourceName: actorState?.profile?.name ?? null,
    requiredEventType: prerequisite?.eventType ?? null,
    requiredEventFrame: executionPrerequisite.eventFrame ?? null,
  };
}

function createAttackChainExecutionBlock({ action, actorState, chain }) {
  return {
    ...createActionSourceSequenceFields(action),
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

function createNormalAttackInputPhaseExecutionBlock({
  action,
  actorState,
  selection,
}) {
  const match = selection.authorityMatch;
  const phase = selection.authorityPhase;
  return {
    ...createActionSourceSequenceFields(action),
    code: 'VERIFIED_NORMAL_ATTACK_INPUT_PHASE_CONFLICT',
    status: 'blocked',
    reason: 'verified-normal-attack-input-phase-conflict',
    reasons: match?.reasons?.length
      ? match.reasons
      : ['normal-attack-input-phase-unresolved'],
    message: `${actorState?.actor?.name ?? action.actor?.name ?? '角色'} 的普攻输入不符合当前 ${phase?.phase ?? 'unresolved'} 阶段，动作不执行`,
    sourceKind:
      phase?.sourceKind ?? 'azpr-verified-normal-attack-input-authority',
    sourceIdentity: phase?.sourceIdentity ?? null,
    formIdentity: phase?.formIdentity ?? null,
    attackInputChainIdentity: phase?.chainIdentity ?? null,
    expectedAttackInput: phase?.expected ?? null,
    actualAttackInput: match?.actual ?? null,
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

function createNormalAttackInputOccupancyExecutionBlock({
  action,
  actorState,
  predecessor,
}) {
  return {
    ...createActionSourceSequenceFields(action),
    code: 'VERIFIED_NORMAL_ATTACK_INPUT_OCCUPANCY_BLOCKED',
    status: 'blocked',
    reason: 'verified-normal-attack-input-occupancy-blocked',
    reasons: ['normal-attack-input-has-no-executable-form-during-occupancy'],
    message: `${actorState?.actor?.name ?? action.actor?.name ?? '角色'} 当前动作占用期内没有可执行的普攻续段，本次左键输入不执行`,
    sourceKind: 'azpr-verified-normal-attack-input-authority',
    sourceIdentity: predecessor?.sourceIdentity ?? null,
    blockingActionId: predecessor?.actionId ?? null,
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

function createActionSourceSequenceFields(action) {
  const sourceSequencePath = getActionSourceSequencePath(action);
  return {
    sourceSequenceIndex:
      action?.sourceSequenceIndex ?? sourceSequencePath?.[0] ?? null,
    sourceSequencePath,
    sourceSequenceSource:
      action?.sourceSequenceSource ?? 'scenario-action-array-order',
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
  const normalizedTimeMs = normalizeRuntimeMs(timeMs);
  for (let index = windows.length - 1; index >= 0; index -= 1) {
    if (normalizeRuntimeMs(windows[index].endsAtMs) <= normalizedTimeMs) {
      windows.splice(index, 1);
    }
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

function normalizeRuntimeMs(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(6)) : number;
}

function runtimeWindowContainsTime(window, timeMs) {
  const normalizedTimeMs = normalizeRuntimeMs(timeMs);
  return (
    normalizeRuntimeMs(window?.startsAtMs) <= normalizedTimeMs &&
    normalizedTimeMs < normalizeRuntimeMs(window?.endsAtMs)
  );
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
    resourceGateEvents: [],
    stateEvents: [],
    variantEvents: [],
    effectCommands: [],
    tuningMarkTransactions: [],
    companionEvents: [],
    companionAttackTransactions: [],
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
      resourceGateEventCount: 0,
      stateEventCount: 0,
      effectCommandCount: 0,
      tuningMarkTransactionCount: 0,
      companionEventCount: 0,
      companionAttackTransactionCount: 0,
      targetStateEventCount: 0,
      conditionalHitGroupCount: 0,
      directSpEventCount: 0,
      executionBlockCount: 0,
    },
    ready: false,
    applied: false,
  };
}
