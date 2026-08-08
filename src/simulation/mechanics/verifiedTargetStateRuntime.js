import {
  EFFECT_OPERATIONS,
  EFFECT_STACK_MODES,
  EFFECT_TARGET_KINDS,
} from '../../domain/projectSchema';
import { isControlledActorEffectTargetKind } from '../../domain/effectTargetSemantics';
import { resolveControlledActorAt } from '../runtime/controlledActorTimeline';
import {
  compareActionSourceSequence,
  getActionSourceSequencePath,
} from '../../domain/actionSourceSequence';

export const VERIFIED_TARGET_STATE_RUNTIME_CONTRACT_NAME =
  'AzPrVerifiedTargetStateRuntime';

export function applyVerifiedTargetStateRuntime({
  scenario = null,
  actionResolutionById = new Map(),
  mechanicsPackage = null,
  controlledActorTimeline = null,
} = {}) {
  const graph = mechanicsPackage?.actionVariantGraph;
  const profiles = (graph?.targetStateProfiles ?? []).filter(
    profile => profile.applied
  );
  if (profiles.length === 0) {
    return createEmptyResult(actionResolutionById);
  }

  const profileByIdentity = new Map(
    profiles.map(profile => [profile.stateIdentity, profile])
  );
  const transactions = (graph.targetStateTransactions ?? []).filter(
    transaction =>
      transaction.applied && profileByIdentity.has(transaction.stateIdentity)
  );
  const groups = (graph.conditionalHitGroups ?? []).filter(
    group => group.applied && profileByIdentity.has(group.stateIdentity)
  );
  const runtimeBindings = (graph.runtimeEffectBindings ?? []).filter(
    binding => binding.applied
  );
  const stateByIdentity = new Map(
    profiles.map(profile => [
      profile.stateIdentity,
      {
        profile,
        layers: [],
      },
    ])
  );
  const actionById = new Map(
    (scenario?.actions ?? []).map(action => [String(action.id), action])
  );
  const events = [];
  const pending = [];
  const effectCommands = [];
  const directSpEvents = [];
  const groupResults = [];
  const actionEffectActivationResults = [];
  let eventSequence = 0;

  for (const [actionId, resolution] of actionResolutionById) {
    if (!resolution?.ready) continue;
    const action = actionById.get(String(actionId));
    if (!action) continue;
    const controlSkillId = Number(resolution.actionBinding?.controlSkillId);
    const subSkillIndex = Number(
      resolution.actionBinding?.selectedSubSkillIndex
    );
    for (const transaction of transactions) {
      if (
        Number(transaction.controlSkillId) !== controlSkillId ||
        Number(transaction.subSkillIndex) !== subSkillIndex ||
        !hasRequiredHit(resolution, transaction)
      ) {
        continue;
      }
      pending.push({
        kind: 'target-state-transaction',
        timeMs: actionFrameToMs(
          action,
          transaction.triggerFrame,
          transaction.frameRate
        ),
        priority: Number(transaction.priority) || 0,
        action,
        resolution,
        transaction,
      });
    }
    for (const group of groups) {
      if (
        Number(group.controlSkillId) !== controlSkillId ||
        Number(group.subSkillIndex) !== subSkillIndex
      ) {
        continue;
      }
      pending.push({
        kind: 'conditional-hit-group',
        timeMs: actionFrameToMs(action, group.decisionFrame, group.frameRate),
        priority: 100,
        action,
        resolution,
        group,
      });
    }
    for (const effect of resolution.effects ?? []) {
      const condition = effect.targetStateActivationCondition;
      if (
        !condition?.applied ||
        !profileByIdentity.has(condition.stateIdentity)
      ) {
        continue;
      }
      pending.push({
        kind: 'action-effect-state-condition',
        timeMs: actionFrameToMs(
          action,
          effect.trigger?.startFrame ?? 0,
          resolution.controlBinding?.frameRate ?? 60
        ),
        priority: 50,
        action,
        resolution,
        effect,
        condition,
      });
    }
    for (const [bindingSequenceIndex, binding] of runtimeBindings.entries()) {
      if (
        !['action-frame', 'action-frame-with-state'].includes(
          binding.triggerKind
        ) ||
        Number(binding.controlSkillId) !== controlSkillId ||
        Number(binding.subSkillIndex) !== subSkillIndex
      ) {
        continue;
      }
      pending.push({
        kind:
          binding.triggerKind === 'action-frame-with-state'
            ? 'runtime-effect-with-state'
            : 'runtime-effect',
        timeMs: actionFrameToMs(
          action,
          binding.triggerFrame,
          binding.frameRate
        ),
        priority: 200,
        action,
        resolution,
        binding,
        bindingSequenceIndex,
      });
    }
  }

  pending.sort(comparePending);
  for (const descriptor of pending) {
    expireTargetStates({
      stateByIdentity,
      timeMs: descriptor.timeMs,
      scenario,
      events,
      effectCommands,
      eventSequenceRef: {
        get value() {
          return eventSequence;
        },
        set value(value) {
          eventSequence = value;
        },
      },
    });
    if (descriptor.kind === 'target-state-transaction') {
      applyTargetStateTransaction({
        descriptor,
        stateByIdentity,
        scenario,
        events,
        effectCommands,
        nextSequence: () => eventSequence++,
      });
      continue;
    }
    if (descriptor.kind === 'action-effect-state-condition') {
      actionEffectActivationResults.push(
        applyActionEffectTargetStateActivationCondition({
          descriptor,
          stateByIdentity,
          events,
          nextSequence: () => eventSequence++,
        })
      );
      continue;
    }
    if (descriptor.kind === 'conditional-hit-group') {
      const result = applyConditionalHitGroup({
        descriptor,
        stateByIdentity,
        scenario,
        events,
        effectCommands,
        nextSequence: () => eventSequence++,
      });
      groupResults.push(result);
      if (result.applied) {
        for (const [
          bindingSequenceIndex,
          binding,
        ] of runtimeBindings.entries()) {
          if (
            binding.triggerKind !== 'conditional-hit-group-applied' ||
            binding.conditionalGroupIdentity !== descriptor.group.groupIdentity
          ) {
            continue;
          }
          emitRuntimeBinding({
            binding,
            action: descriptor.action,
            resolution: descriptor.resolution,
            timeMs: actionFrameToMs(
              descriptor.action,
              binding.triggerFrame,
              binding.frameRate
            ),
            scenario,
            controlledActorTimeline,
            mechanicsPackage,
            effectCommands,
            directSpEvents,
            bindingSequenceIndex,
          });
        }
      }
      continue;
    }
    if (descriptor.kind === 'runtime-effect-with-state') {
      const state = stateByIdentity.get(descriptor.binding.stateIdentity);
      const activeStacks = state?.layers.length ?? 0;
      const satisfied =
        activeStacks >= Number(descriptor.binding.minimumStacks ?? 1);
      if (!satisfied) {
        events.push({
          type: 'VERIFIED_RUNTIME_EFFECT_STATE_CONDITION_NOT_MET',
          timeMs: descriptor.timeMs,
          actionId: descriptor.action?.id ?? null,
          actorId: descriptor.action?.actorId ?? null,
          runtimeSequenceIndex: eventSequence++,
          payload: {
            bindingIdentity: descriptor.binding.bindingIdentity,
            stateIdentity: descriptor.binding.stateIdentity,
            stateName: descriptor.binding.stateName ?? null,
            minimumStacks: Number(descriptor.binding.minimumStacks),
            activeStacks,
            applied: false,
          },
        });
        continue;
      }
      emitRuntimeBinding({
        binding: descriptor.binding,
        action: descriptor.action,
        resolution: descriptor.resolution,
        timeMs: descriptor.timeMs,
        scenario,
        controlledActorTimeline,
        mechanicsPackage,
        effectCommands,
        directSpEvents,
        bindingSequenceIndex: descriptor.bindingSequenceIndex,
      });
      continue;
    }
    emitRuntimeBinding({
      binding: descriptor.binding,
      action: descriptor.action,
      resolution: descriptor.resolution,
      timeMs: descriptor.timeMs,
      scenario,
      controlledActorTimeline,
      mechanicsPackage,
      effectCommands,
      directSpEvents,
      bindingSequenceIndex: descriptor.bindingSequenceIndex,
    });
  }

  expireTargetStates({
    stateByIdentity,
    timeMs: Number(scenario?.time?.durationMs) || 0,
    scenario,
    events,
    effectCommands,
    eventSequenceRef: {
      get value() {
        return eventSequence;
      },
      set value(value) {
        eventSequence = value;
      },
    },
    includeFutureUntil: Number(scenario?.time?.durationMs) || 0,
  });

  const appliedGroupKeys = new Set(
    groupResults
      .filter(result => result.applied)
      .map(result => `${result.actionId}|${result.groupIdentity}`)
  );
  const actionEffectActivationResultByKey = new Map(
    actionEffectActivationResults.map(result => [
      createActionEffectActivationResultKey(
        result.actionId,
        result.effectIdentity
      ),
      result,
    ])
  );
  for (const [actionId, resolution] of actionResolutionById) {
    const actionGroupResults = groupResults.filter(
      result => String(result.actionId) === String(actionId)
    );
    const hits = (resolution?.hits ?? []).filter(
      hit =>
        !hit.conditionalGroupIdentity ||
        appliedGroupKeys.has(`${actionId}|${hit.conditionalGroupIdentity}`)
    );
    const originalEffects = resolution?.effects ?? [];
    const actionEffectResults = actionEffectActivationResults.filter(
      result => String(result.actionId) === String(actionId)
    );
    const effects = originalEffects.filter(effect => {
      const result = actionEffectActivationResultByKey.get(
        createActionEffectActivationResultKey(
          actionId,
          effect.effectIdentity
        )
      );
      return result?.applied !== false;
    });
    const suppressedEffects = actionEffectResults
      .filter(result => !result.applied)
      .map(result => ({
        effectIdentity: result.effectIdentity,
        elementId: result.elementId,
        reason: result.reason,
        condition: result.condition,
        sourceIdentity: result.sourceIdentity,
      }));
    actionResolutionById.set(actionId, {
      ...resolution,
      hits,
      effects: [
        ...effects,
        ...actionGroupResults
          .filter(result => result.applied && result.tuningMark)
          .map(result =>
            createConditionalTuningEffect({
              result,
              resolution,
            })
          ),
      ],
      allEffects: originalEffects,
      suppressedEffects,
      actionEffectActivationResults: actionEffectResults,
      conditionalHitGroupResults: actionGroupResults,
    });
  }

  events.sort(compareEvents);
  effectCommands.sort(compareCommands);
  directSpEvents.sort(
    (left, right) =>
      Number(left.timeMs) - Number(right.timeMs) ||
      compareActionSourceSequence(left.action, right.action)
  );
  return {
    schemaVersion: 1,
    contractName: VERIFIED_TARGET_STATE_RUNTIME_CONTRACT_NAME,
    sourceKind: 'azpr-verified-target-state-runtime',
    status: 'verified-target-state-runtime-ready',
    actionResolutionById,
    events,
    effectCommands,
    directSpEvents,
    groupResults,
    actionEffectActivationResults,
    finalState: [...stateByIdentity.values()].map(state => ({
      stateIdentity: state.profile.stateIdentity,
      targetKind: state.profile.targetKind,
      currentValue: state.layers.length,
      maxValue: state.profile.maxStacks,
      layers: state.layers.map(layer => ({ ...layer })),
    })),
    summary: {
      profileCount: profiles.length,
      eventCount: events.length,
      appliedGroupCount: groupResults.filter(result => result.applied).length,
      skippedGroupCount: groupResults.filter(result => !result.applied).length,
      appliedActionEffectConditionCount:
        actionEffectActivationResults.filter(result => result.applied).length,
      suppressedActionEffectConditionCount:
        actionEffectActivationResults.filter(result => !result.applied).length,
      effectCommandCount: effectCommands.length,
      directSpEventCount: directSpEvents.length,
    },
    ready: true,
    applied: true,
  };
}

function createEmptyResult(actionResolutionById) {
  return {
    schemaVersion: 1,
    contractName: VERIFIED_TARGET_STATE_RUNTIME_CONTRACT_NAME,
    sourceKind: 'azpr-verified-target-state-runtime',
    status: 'verified-target-state-runtime-ready-no-profiles',
    actionResolutionById,
    events: [],
    effectCommands: [],
    directSpEvents: [],
    groupResults: [],
    actionEffectActivationResults: [],
    finalState: [],
    summary: {
      profileCount: 0,
      eventCount: 0,
      appliedGroupCount: 0,
      skippedGroupCount: 0,
      appliedActionEffectConditionCount: 0,
      suppressedActionEffectConditionCount: 0,
      effectCommandCount: 0,
      directSpEventCount: 0,
    },
    ready: true,
    applied: true,
  };
}

function hasRequiredHit(resolution, transaction) {
  if (transaction.requiresHitElementId == null) return true;
  return (resolution.hits ?? []).some(
    hit =>
      Number(hit.elementId) === Number(transaction.requiresHitElementId) &&
      Number(hit.trigger?.startFrame) === Number(transaction.triggerFrame)
  );
}

function applyTargetStateTransaction({
  descriptor,
  stateByIdentity,
  scenario,
  events,
  effectCommands,
  nextSequence,
}) {
  const state = stateByIdentity.get(descriptor.transaction.stateIdentity);
  if (!state || descriptor.transaction.operation !== 'gain') return;
  const before = state.layers.length;
  const available = Math.max(0, state.profile.maxStacks - before);
  const amount = Math.min(available, descriptor.transaction.amount);
  if (
    amount <= 0 &&
    descriptor.transaction.amount > 0 &&
    state.layers.length > 0 &&
    state.profile.atCapacityPolicy === 'refresh-oldest'
  ) {
    const refreshedLayer = state.layers.shift();
    state.layers.push({
      ...refreshedLayer,
      layerIdentity: `${descriptor.transaction.transactionIdentity}|${descriptor.action.id}|${descriptor.timeMs}|refresh`,
      appliedAtMs: descriptor.timeMs,
      expiresAtMs: roundValue(
        descriptor.timeMs + descriptor.transaction.durationMs
      ),
      sourceActionId: descriptor.action.id,
      sourceSequencePath: getActionSourceSequencePath(descriptor.action),
      sourceIdentity: descriptor.transaction.sourceIdentity,
    });
    state.layers.sort(compareLayers);
    emitStateChange({
      state,
      action: descriptor.action,
      timeMs: descriptor.timeMs,
      operation: 'refresh',
      before,
      after: state.layers.length,
      sourceIdentity: descriptor.transaction.sourceIdentity,
      scenario,
      events,
      effectCommands,
      sequence: nextSequence(),
    });
    return;
  }
  for (let index = 0; index < amount; index += 1) {
    state.layers.push({
      layerIdentity: `${descriptor.transaction.transactionIdentity}|${descriptor.action.id}|${descriptor.timeMs}|${index + 1}`,
      appliedAtMs: descriptor.timeMs,
      expiresAtMs: roundValue(
        descriptor.timeMs + descriptor.transaction.durationMs
      ),
      sourceActionId: descriptor.action.id,
      sourceSequencePath: getActionSourceSequencePath(descriptor.action),
      sourceIdentity: descriptor.transaction.sourceIdentity,
    });
  }
  state.layers.sort(compareLayers);
  if (amount <= 0) return;
  emitStateChange({
    state,
    action: descriptor.action,
    timeMs: descriptor.timeMs,
    operation: 'gain',
    before,
    after: state.layers.length,
    sourceIdentity: descriptor.transaction.sourceIdentity,
    scenario,
    events,
    effectCommands,
    sequence: nextSequence(),
  });
}

function applyActionEffectTargetStateActivationCondition({
  descriptor,
  stateByIdentity,
  events,
  nextSequence,
}) {
  const state = stateByIdentity.get(descriptor.condition.stateIdentity);
  const activeStacks = state?.layers.length ?? 0;
  const minimumStacks = Number(descriptor.condition.minimumStacks ?? 1);
  const applied = activeStacks >= minimumStacks;
  const reason = applied
    ? 'target-state-activation-condition-met'
    : 'target-state-activation-condition-not-met';
  const result = {
    actionId: descriptor.action.id,
    effectIdentity: descriptor.effect.effectIdentity,
    elementId: Number(descriptor.effect.elementId),
    timeMs: descriptor.timeMs,
    stateIdentity: descriptor.condition.stateIdentity,
    activeStacks,
    minimumStacks,
    condition: descriptor.condition,
    reason,
    sourceIdentity: descriptor.condition.sourceIdentity,
    status: applied
      ? 'verified-action-effect-activation-condition-applied'
      : 'verified-action-effect-activation-condition-suppressed',
    applied,
  };
  events.push({
    ...createActionSourceSequenceFields(descriptor.action),
    type: 'VERIFIED_ACTION_EFFECT_STATE_CONDITION_EVALUATED',
    timeMs: descriptor.timeMs,
    actionId: descriptor.action.id,
    actorId: descriptor.action.actorId ?? null,
    runtimeSequenceIndex: nextSequence(),
    payload: {
      effectIdentity: descriptor.effect.effectIdentity,
      elementId: Number(descriptor.effect.elementId),
      stateIdentity: descriptor.condition.stateIdentity,
      activeStacks,
      minimumStacks,
      reason,
      sourceIdentity: descriptor.condition.sourceIdentity,
      applied,
    },
  });
  return result;
}

function createActionEffectActivationResultKey(actionId, effectIdentity) {
  return `${String(actionId)}|${String(effectIdentity)}`;
}

function applyConditionalHitGroup({
  descriptor,
  stateByIdentity,
  scenario,
  events,
  effectCommands,
  nextSequence,
}) {
  const state = stateByIdentity.get(descriptor.group.stateIdentity);
  const before = state?.layers.length ?? 0;
  const applied = before >= descriptor.group.minimumStacks;
  let consumed = 0;
  if (applied && state) {
    const band = descriptor.group.consumeBands.find(
      candidate => before >= candidate.minimumStacks
    );
    consumed = band
      ? Math.min(before, band.amount)
      : descriptor.group.fallbackConsumeAll
        ? before
        : 0;
    if (consumed > 0) {
      state.layers.splice(0, consumed);
      emitStateChange({
        state,
        action: descriptor.action,
        timeMs: descriptor.timeMs,
        operation: 'consume',
        before,
        after: state.layers.length,
        sourceIdentity: band?.sourceIdentity ?? descriptor.group.sourceIdentity,
        scenario,
        events,
        effectCommands,
        sequence: nextSequence(),
      });
    }
  }
  return {
    actionId: descriptor.action.id,
    groupIdentity: descriptor.group.groupIdentity,
    stateIdentity: descriptor.group.stateIdentity,
    timeMs: descriptor.timeMs,
    beforeStacks: before,
    consumedStacks: consumed,
    afterStacks: state?.layers.length ?? 0,
    status: applied
      ? 'verified-conditional-hit-group-applied'
      : 'verified-conditional-hit-group-condition-not-met',
    sourceIdentity: descriptor.group.sourceIdentity,
    tuningMark: descriptor.group.tuningMark ?? null,
    applied,
  };
}

function createConditionalTuningEffect({ result, resolution }) {
  const mark = result.tuningMark;
  return {
    effectIdentity: `conditional-tuning|${result.groupIdentity}|${result.actionId}`,
    semanticIdentity: `conditional-tuning|${result.groupIdentity}`,
    graphIdentity: `conditional-tuning|${result.groupIdentity}`,
    elementId: Number(mark.markId),
    mapIndex: Number(resolution.actionBinding?.selectedSubSkillIndex),
    name: mark.name,
    displayLabel: mark.name,
    kind: 'stack',
    role: 'gameplay-effect',
    trigger: {
      behaviorPathId: `conditional-tuning:${result.groupIdentity}`,
      startFrame: Number(mark.triggerFrame),
      frameCount: 1,
      targetCode: 0,
      targetKind: 'team-tuning-pool',
      targetSourceField: 'character-combat-conditional-hit-group',
      sourceIdentity: result.sourceIdentity,
    },
    target: {
      kind: 'team-tuning-pool',
      code: Number(mark.markId),
      sourceIdentity: mark.sourceIdentity,
    },
    tuningMark: mark,
    sourceIdentity: result.sourceIdentity,
    classification: 'applied',
    reasons: [],
    confidence: 'high',
    applied: true,
  };
}

function expireTargetStates({
  stateByIdentity,
  timeMs,
  scenario,
  events,
  effectCommands,
  eventSequenceRef,
  includeFutureUntil = timeMs,
}) {
  for (const state of stateByIdentity.values()) {
    while (
      state.layers.length > 0 &&
      Number(state.layers[0].expiresAtMs) <= includeFutureUntil
    ) {
      const expiresAtMs = Number(state.layers[0].expiresAtMs);
      if (expiresAtMs > timeMs) break;
      const before = state.layers.length;
      const expired = state.layers.filter(
        layer => Number(layer.expiresAtMs) === expiresAtMs
      );
      state.layers = state.layers.filter(
        layer => Number(layer.expiresAtMs) !== expiresAtMs
      );
      emitStateChange({
        state,
        action: null,
        timeMs: expiresAtMs,
        operation: 'expire',
        before,
        after: state.layers.length,
        sourceIdentity: expired.map(layer => layer.sourceIdentity).join('|'),
        sourceSequencePath: expired[0]?.sourceSequencePath
          ? [...expired[0].sourceSequencePath, 90]
          : null,
        scenario,
        events,
        effectCommands,
        sequence: eventSequenceRef.value++,
      });
    }
  }
}

function emitStateChange({
  state,
  action,
  timeMs,
  operation,
  before,
  after,
  sourceIdentity,
  sourceSequencePath = null,
  scenario,
  events,
  effectCommands,
  sequence,
}) {
  const actionSourceFields = createActionSourceSequenceFields(action);
  const resolvedSourceSequencePath =
    sourceSequencePath ?? actionSourceFields.sourceSequencePath;
  const targetId =
    state.profile.targetKind === 'enemy'
      ? String(scenario?.enemy?.id ?? 'enemy')
      : String(action?.actorId ?? '');
  events.push({
    ...actionSourceFields,
    sourceSequenceIndex:
      actionSourceFields.sourceSequenceIndex ??
      resolvedSourceSequencePath?.[0] ??
      null,
    sourceSequencePath: resolvedSourceSequencePath,
    type: 'VERIFIED_TARGET_STATE_CHANGE',
    timeMs,
    actionId: action?.id ?? null,
    actorId: action?.actorId ?? null,
    targetId,
    runtimeSequenceIndex: sequence,
    payload: {
      resource: 'target-state',
      stateIdentity: state.profile.stateIdentity,
      stateName: state.profile.name,
      operation,
      beforeValue: before,
      change: after - before,
      afterValue: after,
      currentValue: after,
      maxValue: state.profile.maxStacks,
      sourceIdentity,
      appliedToActionVariantRuntime: true,
      appliedToCalculators: false,
    },
  });
  effectCommands.push(
    createTargetStateEffectCommand({
      state,
      action,
      targetId,
      timeMs,
      operation,
      after,
      sourceIdentity,
      sourceSequencePath: resolvedSourceSequencePath,
      sequence,
    })
  );
}

function createTargetStateEffectCommand({
  state,
  action,
  targetId,
  timeMs,
  operation,
  after,
  sourceIdentity,
  sourceSequencePath,
  sequence,
}) {
  const nextExpiryMs = state.layers[0]?.expiresAtMs ?? null;
  return {
    ...createActionSourceSequenceFields(action),
    ...(Array.isArray(sourceSequencePath)
      ? {
          sourceSequenceIndex: sourceSequencePath[0] ?? null,
          sourceSequencePath,
          sourceSequenceSource: 'target-state-origin-transaction',
        }
      : {}),
    id: `verified-target-state|${state.profile.stateIdentity}|${timeMs}|${operation}|${sequence}`,
    sourceActionId: action?.id ?? null,
    sourceActionName: action?.name ?? state.profile.name,
    sourceActorId: action?.actorId ?? null,
    sourceActorName: action?.actor?.name ?? null,
    effectId: `battle-element:${state.profile.elementId}`,
    effectName: state.profile.name,
    operation: after <= 0 ? EFFECT_OPERATIONS.REMOVE : EFFECT_OPERATIONS.APPLY,
    targetKind:
      state.profile.targetKind === 'enemy'
        ? EFFECT_TARGET_KINDS.ENEMY
        : EFFECT_TARGET_KINDS.ACTOR,
    targetId,
    timeMs,
    durationMs:
      nextExpiryMs == null ? null : Math.max(0, nextExpiryMs - timeMs),
    stackMode: EFFECT_STACK_MODES.REPLACE,
    stackDelta: Math.max(1, after),
    maxStacks: state.profile.maxStacks,
    tags: ['target-state', `target-state:${state.profile.stateIdentity}`],
    sourceStatus: 'verified-action-state-generated',
    confidence: 'high',
    trackingStatus: 'applied',
    sourceIdentity: {
      actionBindingIdentity: state.profile.stateIdentity,
      effectIdentity: state.profile.stateIdentity,
      sourceIdentity: [state.profile.sourceIdentity, sourceIdentity]
        .filter(Boolean)
        .join('|'),
    },
    modifiers: [],
    appliedToCalculators: false,
    generatedVerified: true,
  };
}

function emitRuntimeBinding({
  binding,
  action,
  resolution,
  timeMs,
  scenario,
  controlledActorTimeline,
  mechanicsPackage,
  effectCommands,
  directSpEvents,
  bindingSequenceIndex,
}) {
  const targets = resolveBindingTargets({
    binding,
    action,
    timeMs,
    scenario,
    controlledActorTimeline,
  });
  if (binding.directSp) {
    for (const [targetSequenceIndex, target] of targets.entries()) {
      directSpEvents.push(
        createDirectSpEvent({
          binding,
          action,
          resolution,
          target,
          timeMs,
          bindingSequenceIndex,
          targetSequenceIndex,
        })
      );
    }
    return;
  }
  for (const target of targets) {
    effectCommands.push({
      ...createActionSourceSequenceFields(action),
      id: `verified-runtime-effect|${action.id}|${binding.bindingIdentity}|${target.kind}:${target.id}`,
      sourceActionId: action.id,
      sourceActionName: action.name,
      sourceActorId: action.actorId,
      sourceActorName: action.actor?.name ?? null,
      effectId: binding.effectId,
      effectName: binding.effectName,
      operation: EFFECT_OPERATIONS.APPLY,
      targetKind: target.kind,
      targetId: String(target.id),
      targetName: target.name ?? null,
      semanticTargetKind: binding.targetKind,
      timeMs,
      durationMs: binding.durationMs,
      stackMode:
        binding.stackMode === 'stack'
          ? EFFECT_STACK_MODES.STACK
          : binding.stackMode === 'replace'
            ? EFFECT_STACK_MODES.REPLACE
            : EFFECT_STACK_MODES.REFRESH,
      stackDelta: binding.stackDelta,
      maxStacks: binding.maxStacks,
      tags: ['character-combat-runtime-effect', `owner:${binding.ownerId}`],
      sourceStatus: 'verified-passive-effect-generated',
      confidence: 'high',
      trackingStatus: 'applied',
      sourceIdentity: {
        packageId: mechanicsPackage?.packageId ?? null,
        packageHash: mechanicsPackage?.packageHash ?? null,
        actionBindingIdentity: resolution.actionBinding?.identity ?? null,
        effectIdentity: binding.bindingIdentity,
        sourceIdentity: binding.sourceIdentity,
      },
      inheritOnControlledActorSwitch:
        binding.inheritance?.inheritOnControlledActorSwitch === true,
      inheritType: binding.inheritance?.inheritType ?? null,
      inheritanceContainerElementId:
        binding.inheritance?.containerElementId ?? null,
      inheritanceContainerPathId:
        binding.inheritance?.containerPathId ?? null,
      inheritanceSourceIdentity:
        binding.inheritance?.sourceIdentity ?? null,
      formulaSourceActorId: action.actorId,
      effectAdderActorId:
        binding.inheritance?.inheritType === 'self'
          ? String(target.id)
          : action.actorId,
      modifiers: binding.modifiers.map(modifier => ({ ...modifier })),
      appliedToCalculators: true,
      generatedVerified: true,
    });
  }
}

function resolveBindingTargets({
  binding,
  action,
  timeMs,
  scenario,
  controlledActorTimeline,
}) {
  if (binding.targetKind === 'source-actor') {
    return [
      {
        kind: EFFECT_TARGET_KINDS.ACTOR,
        id: action.actorId,
        name: action.actor?.name ?? null,
      },
    ];
  }
  if (isControlledActorEffectTargetKind(binding.targetKind)) {
    const actor = resolveControlledActorAt(controlledActorTimeline, timeMs);
    return actor
      ? [
          {
            kind: EFFECT_TARGET_KINDS.ACTOR,
            id: actor.actorId,
            name: actor.name ?? null,
          },
        ]
      : [];
  }
  if (binding.targetKind === 'team-actors') {
    return (scenario?.actors ?? []).map(actor => ({
      kind: EFFECT_TARGET_KINDS.ACTOR,
      id: actor.id,
      name: actor.name ?? null,
    }));
  }
  if (binding.targetKind === 'enemy') {
    return scenario?.enemy?.id
      ? [
          {
            kind: EFFECT_TARGET_KINDS.ENEMY,
            id: scenario.enemy.id,
            name: scenario.enemy.name ?? null,
          },
        ]
      : [];
  }
  return [];
}

function createDirectSpEvent({
  binding,
  action,
  resolution,
  target,
  timeMs,
  bindingSequenceIndex,
  targetSequenceIndex,
}) {
  const directSp = binding.directSp;
  const sourceSequencePath = createTargetStateDirectEffectSourceSequencePath({
    action,
    bindingSequenceIndex,
    targetSequenceIndex,
  });
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-verified-battle-direct-effect',
    status: 'verified-battle-direct-effect-ready',
    eventIdentity: `direct-sp|${action.id}|${binding.bindingIdentity}|${target.kind}:${target.id}`,
    kind: 'direct-sp',
    timeMs,
    action,
    actionId: action.id,
    actorId: action.actorId,
    target,
    value: directSp.value,
    formulaResult: {
      family: 'verified-declarative-direct-sp',
      status: 'applied',
      value: directSp.value,
      sourceIdentity: directSp.sourceIdentity,
      applied: true,
    },
    effect: {
      effectIdentity: binding.bindingIdentity,
      elementId: directSp.elementId,
      directSp: {
        enhanceable: directSp.enhanceable,
        shareType: directSp.shareType,
      },
    },
    resolution,
    sourceSequencePath,
    sourceSequenceStatus: sourceSequencePath
      ? 'verified-direct-effect-source-sequence-ready'
      : 'verified-direct-effect-source-sequence-unresolved',
    sourceSequenceContract: {
      contractName: 'AzPrVerifiedTargetStateDirectEffectSourceSequence',
      sourceKind: 'verified-target-state-runtime-binding-array-order',
      bindingSequenceIndex,
      targetSequenceIndex,
      bindingIdentity: binding.bindingIdentity,
    },
    sourceIdentity: binding.sourceIdentity,
    appliedToCalculators: Boolean(sourceSequencePath),
    applied: Boolean(sourceSequencePath),
  };
}

function createTargetStateDirectEffectSourceSequencePath({
  action,
  bindingSequenceIndex,
  targetSequenceIndex,
}) {
  const actionPath = getActionSourceSequencePath(action);
  const bindingIndex = Number(bindingSequenceIndex);
  const targetIndex = Number(targetSequenceIndex);
  if (
    !actionPath ||
    !Number.isInteger(bindingIndex) ||
    bindingIndex < 0 ||
    !Number.isInteger(targetIndex) ||
    targetIndex < 0
  ) {
    return null;
  }
  return [...actionPath, 30, bindingIndex, targetIndex];
}

function actionFrameToMs(action, frame, frameRate) {
  const resolvedFrameRate = Number(frameRate) || 60;
  const actionStartFrame = Number.isInteger(Number(action.startFrame))
    ? Number(action.startFrame)
    : Math.round((Number(action.startMs) * resolvedFrameRate) / 1000);
  return roundValue(
    ((actionStartFrame + Number(frame)) * 1000) / resolvedFrameRate
  );
}

function comparePending(left, right) {
  return (
    Number(left.timeMs) - Number(right.timeMs) ||
    Number(left.priority) - Number(right.priority) ||
    compareActionSourceSequence(left.action, right.action) ||
    String(
      left.transaction?.transactionIdentity ??
        left.group?.groupIdentity ??
        left.binding?.bindingIdentity ??
        left.effect?.effectIdentity
    ).localeCompare(
      String(
        right.transaction?.transactionIdentity ??
          right.group?.groupIdentity ??
          right.binding?.bindingIdentity ??
          right.effect?.effectIdentity
      )
    )
  );
}

function compareLayers(left, right) {
  return (
    Number(left.expiresAtMs) - Number(right.expiresAtMs) ||
    String(left.layerIdentity).localeCompare(String(right.layerIdentity))
  );
}

function compareEvents(left, right) {
  return (
    Number(left.timeMs) - Number(right.timeMs) ||
    Number(left.runtimeSequenceIndex) - Number(right.runtimeSequenceIndex)
  );
}

function compareCommands(left, right) {
  return (
    Number(left.timeMs) - Number(right.timeMs) ||
    compareActionSourceSequence(left, right)
  );
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

function roundValue(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e6) / 1e6;
}
