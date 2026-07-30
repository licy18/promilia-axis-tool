import {
  EFFECT_OPERATIONS,
  EFFECT_STACK_MODES,
  EFFECT_TARGET_KINDS,
} from '../../domain/projectSchema';
import {
  createActionEffectRelationId,
  resolveActionEffectRelationKind,
} from './actionEffectRelationGraph';
import { createEffectSourceDisplayLabel } from '../../domain/sourceDisplayText';
import { isControlledActorEffectTargetKind } from '../../domain/effectTargetSemantics';

export const ACTION_EFFECT_COMMAND_CONTRACT_NAME = 'AzPrActionEffectCommand';
export const EFFECT_RUNTIME_TIMELINE_CONTRACT_NAME =
  'AzPrEffectRuntimeTimeline';

export const EFFECT_RUNTIME_EVENT_TYPES = Object.freeze({
  INHERITED: 'EFFECT_INHERITED',
  TRANSFERRED: 'EFFECT_TRANSFERRED',
  APPLIED: 'EFFECT_APPLIED',
  REFRESHED: 'EFFECT_REFRESHED',
  REMOVED: 'EFFECT_REMOVED',
  EXPIRED: 'EFFECT_EXPIRED',
});

export function createActionEffectRuntimeInput({
  scenario = {},
  actionExecutionPlan = null,
  generatedCommands = [],
} = {}) {
  const validationIssues = [];
  const executionPlanByActionId = new Map(
    (actionExecutionPlan?.actions ?? []).map(entry => [entry.actionId, entry])
  );
  const projectCommands = (scenario.actions ?? []).flatMap(
    (action, actionIndex) =>
      (action.effectCommands ?? []).map((command, commandIndex) => ({
        action,
        actionIndex,
        command,
        commandIndex,
        executionEntry: executionPlanByActionId.get(action.id) ?? null,
        generated: false,
      }))
  );
  const actionIndexById = new Map(
    (scenario.actions ?? []).map((action, index) => [action.id, index])
  );
  const actionById = new Map(
    (scenario.actions ?? []).map(action => [action.id, action])
  );
  const verifiedCommands = (generatedCommands ?? []).map(
    (command, commandIndex) => {
      const action = actionById.get(command.sourceActionId) ?? null;
      return {
        action,
        actionIndex: actionIndexById.get(command.sourceActionId) ?? -1,
        command,
        commandIndex,
        executionEntry:
          executionPlanByActionId.get(command.sourceActionId) ?? null,
        generated: true,
      };
    }
  );
  const inputCommands = [...projectCommands, ...verifiedCommands];
  const executableInputCommands = inputCommands.filter(
    entry => entry.executionEntry?.execute !== false
  );
  const blockedCommandCount =
    inputCommands.length - executableInputCommands.length;
  const commands = executableInputCommands
    .map(entry =>
      normalizeEffectRuntimeCommand(entry, validationIssues, scenario)
    )
    .filter(Boolean)
    .sort(compareEffectRuntimeCommands)
    .map((command, runtimeSequenceIndex) => ({
      ...command,
      runtimeSequenceIndex,
    }));

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-action-effect-runtime-input',
    contractName: ACTION_EFFECT_COMMAND_CONTRACT_NAME,
    status:
      validationIssues.length > 0
        ? 'action-effect-runtime-input-ready-with-validation-issues'
        : commands.length > 0
          ? 'action-effect-runtime-input-ready'
          : 'action-effect-runtime-input-ready-no-commands',
    commands,
    validation: {
      valid: validationIssues.length === 0,
      issueCount: validationIssues.length,
      issues: validationIssues,
    },
    summary: {
      inputCommandCount: inputCommands.length,
      executableInputCommandCount: executableInputCommands.length,
      blockedCommandCount,
      commandCount: commands.length,
      ignoredCommandCount: inputCommands.length - commands.length,
      actionCount: uniqueValues(commands.map(command => command.sourceActionId))
        .length,
      effectCount: uniqueValues(commands.map(command => command.effectId))
        .length,
      targetCount: uniqueValues(commands.map(command => command.instanceKey))
        .length,
      operationCounts: createCountRows(
        countByKey(commands, command => command.operation)
      ),
      stackModeCounts: createCountRows(
        countByKey(commands, command => command.stackMode)
      ),
      modifierCount: commands.reduce(
        (sum, command) => sum + command.modifiers.length,
        0
      ),
      calculatorAppliedCommandCount: commands.filter(
        command => command.appliedToCalculators
      ).length,
      applied: true,
    },
    applied: true,
  };
}

export function createEffectRuntimeTimeline({
  scenario = {},
  effectInput = null,
  actionExecutionPlan = null,
  generatedCommands = [],
  controlledActorTimeline = null,
} = {}) {
  const input =
    effectInput ??
    createActionEffectRuntimeInput({
      scenario,
      actionExecutionPlan,
      generatedCommands,
    });
  const activeByInstanceKey = new Map();
  const events = [];
  let peakActiveEffectCount = 0;

  const emitEvent = event => {
    const activeEffects = sortEffectStates([...activeByInstanceKey.values()]);
    events.push({
      ...event,
      runtimeSequenceIndex: events.length,
      activeEffectCountAfter: activeEffects.length,
      activeEffectKeysAfter: activeEffects.map(effect => effect.instanceKey),
    });
    peakActiveEffectCount = Math.max(
      peakActiveEffectCount,
      activeEffects.length
    );
  };

  for (const inheritedEffect of scenario?.initialRuntimeState?.activeEffects ??
    []) {
    if (!isInheritedEffectTargetAvailable(inheritedEffect, scenario)) {
      continue;
    }
    const effect = createInheritedRuntimeEffectState(inheritedEffect);
    activeByInstanceKey.set(effect.instanceKey, effect);
    emitEvent(
      createEffectRuntimeEvent({
        type: EFFECT_RUNTIME_EVENT_TYPES.INHERITED,
        command: null,
        before: null,
        after: effect,
        scenario,
        timeMs: 0,
        status: 'effect-runtime-inherited',
      })
    );
  }

  const runtimeDescriptors = createEffectRuntimeDescriptors({
    commands: input.commands,
    controlledActorTimeline,
  });
  for (const descriptor of runtimeDescriptors) {
    expireRuntimeEffects({
      activeByInstanceKey,
      timeMs: descriptor.timeMs,
      scenario,
      emitEvent,
    });
    if (descriptor.kind === 'controlled-actor-transition') {
      clearBattlefieldExitEffects({
        transition: descriptor.transition,
        activeByInstanceKey,
        scenario,
        emitEvent,
      });
      transferControlledActorEffects({
        transition: descriptor.transition,
        activeByInstanceKey,
        scenario,
        emitEvent,
      });
      continue;
    }
    applyRuntimeEffectCommand({
      command: descriptor.command,
      activeByInstanceKey,
      scenario,
      emitEvent,
    });
  }

  expireRuntimeEffects({
    activeByInstanceKey,
    timeMs: strictNumberOrNull(scenario.time?.durationMs) ?? Infinity,
    scenario,
    emitEvent,
  });

  const activeEffects = sortEffectStates([...activeByInstanceKey.values()]);
  const eventTypeCounts = countByKey(events, event => event.type);
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-effect-runtime-timeline',
    contractName: EFFECT_RUNTIME_TIMELINE_CONTRACT_NAME,
    status:
      events.length > 0
        ? 'effect-runtime-timeline-ready'
        : 'effect-runtime-timeline-ready-no-events',
    input,
    events,
    activeEffects,
    summary: {
      inputCommandCount: input.summary.inputCommandCount,
      executableInputCommandCount:
        input.summary.executableInputCommandCount ?? input.summary.commandCount,
      blockedCommandCount: input.summary.blockedCommandCount ?? 0,
      commandCount: input.summary.commandCount,
      eventCount: events.length,
      inheritedEventCount:
        eventTypeCounts.get(EFFECT_RUNTIME_EVENT_TYPES.INHERITED) ?? 0,
      transferredEventCount:
        eventTypeCounts.get(EFFECT_RUNTIME_EVENT_TYPES.TRANSFERRED) ?? 0,
      appliedEventCount:
        eventTypeCounts.get(EFFECT_RUNTIME_EVENT_TYPES.APPLIED) ?? 0,
      refreshedEventCount:
        eventTypeCounts.get(EFFECT_RUNTIME_EVENT_TYPES.REFRESHED) ?? 0,
      removedEventCount:
        eventTypeCounts.get(EFFECT_RUNTIME_EVENT_TYPES.REMOVED) ?? 0,
      expiredEventCount:
        eventTypeCounts.get(EFFECT_RUNTIME_EVENT_TYPES.EXPIRED) ?? 0,
      stackedRefreshEventCount: events.filter(
        event =>
          event.type === EFFECT_RUNTIME_EVENT_TYPES.REFRESHED &&
          event.stackChange > 0
      ).length,
      activeEffectCount: activeEffects.length,
      peakActiveEffectCount,
      persistentActiveEffectCount: activeEffects.filter(
        effect => effect.expiresAtMs == null
      ).length,
      actorTargetEventCount: events.filter(
        event => event.targetKind === EFFECT_TARGET_KINDS.ACTOR
      ).length,
      kiboTargetEventCount: events.filter(
        event => event.targetKind === EFFECT_TARGET_KINDS.KIBO
      ).length,
      enemyTargetEventCount: events.filter(
        event => event.targetKind === EFFECT_TARGET_KINDS.ENEMY
      ).length,
      effectIds: uniqueValues(events.map(event => event.effectId)),
      targetIds: uniqueValues(events.map(event => event.targetId)),
      calculatorAppliedEffectCount: events.filter(
        event => event.appliedToCalculators
      ).length,
      applied: true,
    },
    applied: true,
  };
}

export function resolveActiveEffectsAt(
  timeline,
  timeMs,
  { targetKind = null, targetId = null, calculatorOnly = false } = {}
) {
  const activeByInstanceKey = new Map();
  for (const event of timeline?.events ?? []) {
    if (Number(event.timeMs) > Number(timeMs)) break;
    if (event.type === EFFECT_RUNTIME_EVENT_TYPES.TRANSFERRED) {
      activeByInstanceKey.delete(
        event.previousInstanceKey ?? event.before?.instanceKey
      );
    }
    if (event.after?.active) {
      activeByInstanceKey.set(event.instanceKey, event.after);
    } else {
      activeByInstanceKey.delete(event.instanceKey);
    }
  }
  return sortEffectStates([...activeByInstanceKey.values()]).filter(effect => {
    if (targetKind && effect.targetKind !== targetKind) return false;
    if (targetId != null && String(effect.targetId) !== String(targetId)) {
      return false;
    }
    return !calculatorOnly || effect.appliedToCalculators === true;
  });
}

function isInheritedEffectTargetAvailable(effect, scenario) {
  if (effect.targetKind === EFFECT_TARGET_KINDS.ENEMY) {
    return String(effect.targetId) === String(scenario?.enemy?.id);
  }
  if (
    [EFFECT_TARGET_KINDS.ACTOR, EFFECT_TARGET_KINDS.KIBO].includes(
      effect.targetKind
    )
  ) {
    return (scenario?.actors ?? []).some(
      actor => String(actor.id) === String(effect.targetId)
    );
  }
  return false;
}

function createInheritedRuntimeEffectState(effect) {
  const remainingDurationMs = strictNumberOrNull(effect.remainingDurationMs);
  const appliedToCalculators = isVerifiedCalculatorEffectState(effect);
  const effectDisplay = createEffectSourceDisplayLabel({
    sourceText: effect.effectName,
    sourceIdentity: effect.sourceIdentity,
  });
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-runtime-active-effect',
    instanceKey: appliedToCalculators
      ? createEffectInstanceKey({
          targetKind: effect.targetKind,
          targetId: effect.targetId,
          effectId: effect.effectId,
          calculatorScope: true,
        })
      : effect.instanceKey,
    effectId: effect.effectId,
    effectName: effectDisplay.displayLabel,
    rawSourceName: effect.rawSourceName ?? effectDisplay.rawSourceName,
    sourceNameStatus: effect.sourceNameStatus ?? effectDisplay.sourceNameStatus,
    sourceActionId: effect.sourceActionId ?? null,
    sourceActorId: effect.sourceActorId ?? null,
    sourceActorName: effect.sourceActorName ?? null,
    targetKind: effect.targetKind ?? null,
    targetId: effect.targetId,
    targetName: effect.targetName ?? null,
    appliedAtMs: 0,
    updatedAtMs: 0,
    durationMs: remainingDurationMs,
    expiresAtMs: remainingDurationMs,
    stacks: positiveIntegerOrDefault(effect.stacks, 1),
    maxStacks: positiveIntegerOrDefault(effect.maxStacks, 1),
    refreshCount: Math.max(0, Number(effect.refreshCount) || 0),
    revision: positiveIntegerOrDefault(effect.revision, 1),
    tags: uniqueValues(effect.tags),
    icon: effect.icon ?? null,
    confidence: effect.confidence ?? null,
    trackingStatus: effect.trackingStatus ?? null,
    sourceIdentity: cloneSourceIdentity(effect.sourceIdentity),
    semanticTargetKind: effect.semanticTargetKind ?? null,
    inheritOnControlledActorSwitch:
      effect.inheritOnControlledActorSwitch === true,
    inheritType: normalizeEffectInheritType(effect.inheritType),
    inheritanceContainerElementId:
      strictNumberOrNull(effect.inheritanceContainerElementId) ?? null,
    inheritanceContainerPathId: effect.inheritanceContainerPathId ?? null,
    inheritanceSourceIdentity: effect.inheritanceSourceIdentity ?? null,
    formulaSourceActorId:
      effect.formulaSourceActorId ?? effect.sourceActorId ?? null,
    effectAdderActorId:
      effect.effectAdderActorId ?? effect.sourceActorId ?? null,
    clearCarrierActorId:
      effect.clearCarrierActorId ??
      ([EFFECT_TARGET_KINDS.ACTOR, EFFECT_TARGET_KINDS.KIBO].includes(
        effect.targetKind
      )
        ? effect.targetId
        : null),
    expiration: effect.expiration ?? null,
    expirationTriggers: uniqueValues(effect.expirationTriggers),
    clearType: strictNumberOrNull(effect.clearType),
    clearTypeFlags: uniqueValues(effect.clearTypeFlags),
    effectInstanceId:
      effect.effectInstanceId ??
      createEffectInstanceId({
        effectId: effect.effectId,
        sourceActionId: effect.sourceActionId,
        appliedAtMs: 0,
      }),
    transferCount: Math.max(0, Number(effect.transferCount) || 0),
    modifiers: Array.isArray(effect.modifiers)
      ? effect.modifiers.map(modifier => ({ ...modifier }))
      : [],
    sourceStatus: 'effect-inherited-from-cycle-boundary',
    appliedToCalculators,
    active: true,
  };
}

function isVerifiedCalculatorEffectState(effect) {
  if (effect?.appliedToCalculators !== true) return false;
  if (
    ![
      'verified-battle-effect-generated',
      'verified-passive-effect-generated',
      'verified-tuning-mark-generated',
      'effect-inherited-from-cycle-boundary',
    ].includes(effect.sourceStatus)
  ) {
    return false;
  }
  return Boolean(
    effect.sourceIdentity?.packageId &&
    effect.sourceIdentity?.effectIdentity &&
    effect.sourceIdentity?.actionBindingIdentity
  );
}

function normalizeEffectRuntimeCommand(entry, validationIssues, scenario) {
  const {
    action,
    actionIndex,
    command,
    commandIndex,
    executionEntry,
    generated,
  } = entry;
  const commandPath = generated
    ? `generatedCommands[${commandIndex}]`
    : `scenario.actions[${actionIndex}].effectCommands[${commandIndex}]`;
  const effectId = String(command?.effectId ?? '').trim();
  const targetId = String(command?.targetId ?? '').trim();
  if (!effectId || !targetId) {
    validationIssues.push({
      code: 'effect-command-identity-missing',
      path: commandPath,
      effectId,
      targetId,
    });
    return null;
  }
  if (!Object.values(EFFECT_OPERATIONS).includes(command.operation)) {
    validationIssues.push({
      code: 'effect-command-operation-invalid',
      path: `${commandPath}.operation`,
      value: command.operation,
    });
    return null;
  }
  if (!Object.values(EFFECT_TARGET_KINDS).includes(command.targetKind)) {
    validationIssues.push({
      code: 'effect-command-target-kind-invalid',
      path: `${commandPath}.targetKind`,
      value: command.targetKind,
    });
    return null;
  }
  if (!Object.values(EFFECT_STACK_MODES).includes(command.stackMode)) {
    validationIssues.push({
      code: 'effect-command-stack-mode-invalid',
      path: `${commandPath}.stackMode`,
      value: command.stackMode,
    });
    return null;
  }

  const timeMs = strictNumberOrNull(
    command.timeMs ??
      (Number(action.startMs) || 0) + (Number(command.offsetMs) || 0)
  );
  if (timeMs == null || timeMs < 0) {
    validationIssues.push({
      code: 'effect-command-time-invalid',
      path: `${commandPath}.timeMs`,
      value: command.timeMs,
    });
    return null;
  }

  const appliedToCalculators =
    generated === true &&
    command.generatedVerified === true &&
    [
      'verified-battle-effect-generated',
      'verified-passive-effect-generated',
      'verified-tuning-mark-generated',
    ].includes(command.sourceStatus) &&
    command.appliedToCalculators === true;
  const sourceActionId = command.sourceActionId ?? action?.id ?? null;
  const commandOwnerIdentity = sourceActionId ?? 'generated-global';
  const effectDisplay = createEffectSourceDisplayLabel({
    sourceText: command.effectName,
    sourceIdentity: command.sourceIdentity,
  });

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-action-effect-runtime-command',
    contractName: ACTION_EFFECT_COMMAND_CONTRACT_NAME,
    status: 'action-effect-runtime-command-ready',
    commandId: String(
      command.id ?? `${commandOwnerIdentity}|effect-command|${commandIndex}`
    ),
    sourceActionId,
    sourceActionName: command.sourceActionName ?? action?.name ?? null,
    sourceActorId: command.sourceActorId ?? action?.actorId ?? null,
    sourceActorName: command.sourceActorName ?? action?.actor?.name ?? null,
    effectId,
    effectName:
      effectDisplay.sourceNameStatus === 'source-name-missing'
        ? String(effectId)
        : effectDisplay.displayLabel,
    rawSourceName: command.rawSourceName ?? effectDisplay.rawSourceName,
    sourceNameStatus:
      command.sourceNameStatus ?? effectDisplay.sourceNameStatus,
    operation: command.operation,
    targetKind: command.targetKind,
    targetId,
    targetName: command.targetName ?? null,
    instanceKey: createEffectInstanceKey({
      targetKind: command.targetKind,
      targetId,
      effectId,
      calculatorScope: appliedToCalculators,
    }),
    timeMs: roundEffectValue(timeMs),
    frameIndex: msToFrame(timeMs, strictNumberOrNull(scenario.time?.fps) ?? 60),
    durationMs: strictNumberOrNull(command.durationMs),
    expiration: command.expiration ?? null,
    expirationTriggers: uniqueValues(command.expirationTriggers),
    clearType: strictNumberOrNull(command.clearType),
    clearTypeFlags: uniqueValues([
      ...(command.clearTypeFlags ?? []),
      ...(command.expirationTriggers ?? []),
    ]),
    stackMode: command.stackMode,
    stackDelta: positiveIntegerOrDefault(command.stackDelta, 1),
    maxStacks: positiveIntegerOrDefault(command.maxStacks, 1),
    tags: uniqueValues(command.tags),
    sourceStatus: command.sourceStatus ?? 'project-configured-effect-command',
    icon: command.icon ?? null,
    confidence: command.confidence ?? null,
    trackingStatus: command.trackingStatus ?? null,
    sourceIdentity: cloneSourceIdentity(command.sourceIdentity),
    semanticTargetKind:
      command.semanticTargetKind ??
      command.targetSemantics?.kind ??
      command.targetKind ??
      null,
    inheritOnControlledActorSwitch:
      command.inheritOnControlledActorSwitch === true,
    inheritType: normalizeEffectInheritType(command.inheritType),
    inheritanceContainerElementId:
      strictNumberOrNull(command.inheritanceContainerElementId) ?? null,
    inheritanceContainerPathId: command.inheritanceContainerPathId ?? null,
    inheritanceSourceIdentity: command.inheritanceSourceIdentity ?? null,
    formulaSourceActorId:
      command.formulaSourceActorId ??
      command.sourceActorId ??
      action?.actorId ??
      null,
    effectAdderActorId:
      command.effectAdderActorId ??
      resolveInitialEffectAdderActorId({
        inheritType: command.inheritType,
        sourceActorId:
          command.formulaSourceActorId ??
          command.sourceActorId ??
          action?.actorId ??
          null,
        targetId,
      }),
    clearCarrierActorId:
      command.clearCarrierActorId ??
      ([EFFECT_TARGET_KINDS.ACTOR, EFFECT_TARGET_KINDS.KIBO].includes(
        command.targetKind
      )
        ? targetId
        : null),
    modifiers: Array.isArray(command.modifiers)
      ? command.modifiers.map(modifier => ({ ...modifier }))
      : [],
    appliedToCalculators,
    sourceCommand: command,
    sourceActionIndex: actionIndex,
    sourceCommandIndex: commandIndex,
    executionPlanStatus: executionEntry?.status ?? 'scheduled',
    applied: true,
  };
}

function applyRuntimeEffectCommand({
  command,
  activeByInstanceKey,
  scenario,
  emitEvent,
}) {
  const existing = activeByInstanceKey.get(command.instanceKey) ?? null;
  if (command.operation === EFFECT_OPERATIONS.REMOVE) {
    if (existing) {
      activeByInstanceKey.delete(command.instanceKey);
    }
    emitEvent(
      createEffectRuntimeEvent({
        type: EFFECT_RUNTIME_EVENT_TYPES.REMOVED,
        command,
        before: existing,
        after: null,
        scenario,
        status: existing
          ? 'effect-runtime-removed'
          : 'effect-runtime-remove-no-active-instance',
      })
    );
    return;
  }

  if (!existing) {
    const after = createRuntimeEffectState(command);
    activeByInstanceKey.set(command.instanceKey, after);
    emitEvent(
      createEffectRuntimeEvent({
        type: EFFECT_RUNTIME_EVENT_TYPES.APPLIED,
        command,
        before: null,
        after,
        scenario,
        status:
          command.operation === EFFECT_OPERATIONS.REFRESH
            ? 'effect-runtime-refresh-missing-applied'
            : 'effect-runtime-applied',
      })
    );
    return;
  }

  const after = refreshRuntimeEffectState(existing, command);
  activeByInstanceKey.set(command.instanceKey, after);
  emitEvent(
    createEffectRuntimeEvent({
      type: EFFECT_RUNTIME_EVENT_TYPES.REFRESHED,
      command,
      before: existing,
      after,
      scenario,
      status: 'effect-runtime-refreshed',
    })
  );
}

function createEffectRuntimeDescriptors({ commands, controlledActorTimeline }) {
  return [
    ...(commands ?? []).map(command => ({
      kind: 'effect-command',
      timeMs: command.timeMs,
      priority: 0,
      identity: command.commandId,
      command,
      transition: null,
    })),
    ...(controlledActorTimeline?.transitions ?? [])
      .filter(transition => transition.applied === true)
      .map(transition => ({
        kind: 'controlled-actor-transition',
        timeMs: roundEffectValue(transition.timeMs),
        priority: 1,
        identity:
          transition.transitionId ?? transition.actionId ?? 'controlled-switch',
        command: null,
        transition,
      })),
  ].sort(
    (left, right) =>
      left.timeMs - right.timeMs ||
      left.priority - right.priority ||
      String(left.identity).localeCompare(String(right.identity))
  );
}

function transferControlledActorEffects({
  transition,
  activeByInstanceKey,
  scenario,
  emitEvent,
}) {
  const beforeTargetId = String(transition?.beforeActor?.actorId ?? '').trim();
  const afterTargetId = String(transition?.afterActor?.actorId ?? '').trim();
  if (!beforeTargetId || !afterTargetId || beforeTargetId === afterTargetId) {
    return;
  }
  const afterTargetName =
    transition?.afterActor?.actorName ??
    scenario?.actors?.find(actor => String(actor.id) === afterTargetId)?.name ??
    null;
  const transferableEffects = sortEffectStates(
    [...activeByInstanceKey.values()].filter(
      effect =>
        effect.active === true &&
        effect.inheritOnControlledActorSwitch === true &&
        isControlledActorEffectTargetKind(effect.semanticTargetKind) &&
        effect.targetKind === EFFECT_TARGET_KINDS.ACTOR &&
        String(effect.targetId) === beforeTargetId
    )
  );
  for (const before of transferableEffects) {
    if (activeByInstanceKey.get(before.instanceKey) !== before) continue;
    const afterInstanceKey = createEffectInstanceKey({
      targetKind: EFFECT_TARGET_KINDS.ACTOR,
      targetId: afterTargetId,
      effectId: before.effectId,
      calculatorScope: before.appliedToCalculators === true,
    });
    activeByInstanceKey.delete(before.instanceKey);
    const after = {
      ...before,
      instanceKey: afterInstanceKey,
      targetId: afterTargetId,
      targetName: afterTargetName,
      updatedAtMs: roundEffectValue(transition.timeMs),
      revision: before.revision + 1,
      transferCount: (Number(before.transferCount) || 0) + 1,
      effectAdderActorId:
        normalizeEffectInheritType(before.inheritType) === 'self'
          ? afterTargetId
          : before.effectAdderActorId,
      inheritedFromTargetId: beforeTargetId,
      inheritedByTransitionId:
        transition.transitionId ?? transition.actionId ?? null,
    };
    activeByInstanceKey.set(afterInstanceKey, after);
    emitEvent(
      createEffectRuntimeEvent({
        type: EFFECT_RUNTIME_EVENT_TYPES.TRANSFERRED,
        command: null,
        before,
        after,
        scenario,
        timeMs: transition.timeMs,
        status: 'effect-runtime-controlled-actor-transferred',
        transition,
      })
    );
  }
}

function clearBattlefieldExitEffects({
  transition,
  activeByInstanceKey,
  scenario,
  emitEvent,
}) {
  const exitingActorId = String(transition?.beforeActor?.actorId ?? '').trim();
  if (!exitingActorId) return;
  const dueEffects = sortEffectStates(
    [...activeByInstanceKey.values()].filter(
      effect =>
        effect.active === true &&
        (shouldClearForCarrierExit(effect, exitingActorId) ||
          shouldClearForSourceExit(effect, exitingActorId))
    )
  );
  for (const effect of dueEffects) {
    if (activeByInstanceKey.get(effect.instanceKey) !== effect) continue;
    activeByInstanceKey.delete(effect.instanceKey);
    emitEvent(
      createEffectRuntimeEvent({
        type: EFFECT_RUNTIME_EVENT_TYPES.REMOVED,
        command: null,
        before: effect,
        after: null,
        scenario,
        timeMs: transition.timeMs,
        status: 'effect-runtime-executor-exit-battlefield-cleared',
        transition,
      })
    );
  }
}

function shouldClearForCarrierExit(effect, exitingActorId) {
  const clearType = Number(effect.clearType) || 0;
  const configured =
    (clearType & 16) !== 0 ||
    effect.clearTypeFlags?.includes('executorExitBattleFieldClear');
  return (
    configured &&
    String(
      effect.clearCarrierActorId ??
        ([EFFECT_TARGET_KINDS.ACTOR, EFFECT_TARGET_KINDS.KIBO].includes(
          effect.targetKind
        )
          ? effect.targetId
          : '')
    ) === exitingActorId
  );
}

function shouldClearForSourceExit(effect, exitingActorId) {
  const clearType = Number(effect.clearType) || 0;
  const configured =
    (clearType & 8) !== 0 ||
    effect.clearTypeFlags?.includes('sourceExitBattleFieldClear');
  return configured && String(effect.sourceActorId ?? '') === exitingActorId;
}

function expireRuntimeEffects({
  activeByInstanceKey,
  timeMs,
  scenario,
  emitEvent,
}) {
  const dueEffects = sortEffectStates(
    [...activeByInstanceKey.values()].filter(
      effect => effect.expiresAtMs != null && effect.expiresAtMs <= timeMs
    )
  );
  for (const effect of dueEffects) {
    if (activeByInstanceKey.get(effect.instanceKey) !== effect) {
      continue;
    }
    activeByInstanceKey.delete(effect.instanceKey);
    emitEvent(
      createEffectRuntimeEvent({
        type: EFFECT_RUNTIME_EVENT_TYPES.EXPIRED,
        command: null,
        before: effect,
        after: null,
        scenario,
        timeMs: effect.expiresAtMs,
        status: 'effect-runtime-expired',
      })
    );
  }
}

function createRuntimeEffectState(command) {
  const stacks = Math.min(command.maxStacks, command.stackDelta);
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-runtime-active-effect',
    instanceKey: command.instanceKey,
    effectId: command.effectId,
    effectName: command.effectName,
    sourceActionId: command.sourceActionId,
    sourceActorId: command.sourceActorId,
    sourceActorName: command.sourceActorName,
    targetKind: command.targetKind,
    targetId: command.targetId,
    targetName: command.targetName,
    appliedAtMs: command.timeMs,
    updatedAtMs: command.timeMs,
    durationMs: command.durationMs,
    expiration: command.expiration,
    expirationTriggers: command.expirationTriggers,
    clearType: command.clearType,
    clearTypeFlags: command.clearTypeFlags,
    expiresAtMs:
      command.durationMs == null
        ? null
        : roundEffectValue(command.timeMs + command.durationMs),
    stacks,
    maxStacks: command.maxStacks,
    refreshCount: 0,
    revision: 1,
    tags: command.tags,
    modifiers: command.modifiers,
    sourceStatus: command.sourceStatus,
    icon: command.icon,
    confidence: command.confidence,
    trackingStatus: command.trackingStatus,
    sourceIdentity: cloneSourceIdentity(command.sourceIdentity),
    semanticTargetKind: command.semanticTargetKind,
    inheritOnControlledActorSwitch:
      command.inheritOnControlledActorSwitch === true,
    inheritType: command.inheritType,
    inheritanceContainerElementId: command.inheritanceContainerElementId,
    inheritanceContainerPathId: command.inheritanceContainerPathId,
    inheritanceSourceIdentity: command.inheritanceSourceIdentity,
    formulaSourceActorId: command.formulaSourceActorId,
    effectAdderActorId: command.effectAdderActorId,
    clearCarrierActorId: command.clearCarrierActorId,
    effectInstanceId: createEffectInstanceId({
      effectId: command.effectId,
      sourceActionId: command.sourceActionId,
      appliedAtMs: command.timeMs,
    }),
    transferCount: 0,
    appliedToCalculators: command.appliedToCalculators === true,
    active: true,
  };
}

function refreshRuntimeEffectState(existing, command) {
  const maxStacks = Math.max(existing.maxStacks, command.maxStacks);
  const stacks = resolveRefreshedEffectStacks(existing, command, maxStacks);
  const expiresAtMs = resolveRefreshedEffectExpiry(existing, command);
  return {
    ...existing,
    effectName: command.effectName || existing.effectName,
    sourceActionId: command.sourceActionId,
    sourceActorId: command.sourceActorId,
    sourceActorName: command.sourceActorName,
    updatedAtMs: command.timeMs,
    durationMs:
      command.durationMs == null ? existing.durationMs : command.durationMs,
    expiration: command.expiration ?? existing.expiration ?? null,
    expirationTriggers: uniqueValues([
      ...(existing.expirationTriggers ?? []),
      ...(command.expirationTriggers ?? []),
    ]),
    clearType: command.clearType ?? existing.clearType ?? null,
    clearTypeFlags: uniqueValues([
      ...(existing.clearTypeFlags ?? []),
      ...(command.clearTypeFlags ?? []),
    ]),
    expiresAtMs,
    stacks,
    maxStacks,
    refreshCount: existing.refreshCount + 1,
    revision: existing.revision + 1,
    tags: uniqueValues([...existing.tags, ...command.tags]),
    modifiers: command.modifiers,
    sourceStatus: command.sourceStatus,
    icon: command.icon ?? existing.icon ?? null,
    confidence: command.confidence ?? existing.confidence ?? null,
    trackingStatus: command.trackingStatus ?? existing.trackingStatus ?? null,
    sourceIdentity:
      cloneSourceIdentity(command.sourceIdentity) ??
      cloneSourceIdentity(existing.sourceIdentity),
    semanticTargetKind:
      command.semanticTargetKind ?? existing.semanticTargetKind ?? null,
    inheritOnControlledActorSwitch:
      command.inheritOnControlledActorSwitch === true ||
      existing.inheritOnControlledActorSwitch === true,
    inheritType: command.inheritType ?? existing.inheritType ?? null,
    inheritanceContainerElementId:
      command.inheritanceContainerElementId ??
      existing.inheritanceContainerElementId ??
      null,
    inheritanceContainerPathId:
      command.inheritanceContainerPathId ??
      existing.inheritanceContainerPathId ??
      null,
    inheritanceSourceIdentity:
      command.inheritanceSourceIdentity ??
      existing.inheritanceSourceIdentity ??
      null,
    formulaSourceActorId:
      command.formulaSourceActorId ??
      existing.formulaSourceActorId ??
      existing.sourceActorId ??
      null,
    effectAdderActorId:
      command.effectAdderActorId ??
      existing.effectAdderActorId ??
      existing.sourceActorId ??
      null,
    clearCarrierActorId:
      command.clearCarrierActorId ??
      existing.clearCarrierActorId ??
      ([EFFECT_TARGET_KINDS.ACTOR, EFFECT_TARGET_KINDS.KIBO].includes(
        existing.targetKind
      )
        ? existing.targetId
        : null),
    appliedToCalculators:
      command.appliedToCalculators === true ||
      existing.appliedToCalculators === true,
  };
}

function resolveRefreshedEffectStacks(existing, command, maxStacks) {
  if (command.stackMode === EFFECT_STACK_MODES.STACK) {
    return Math.min(maxStacks, existing.stacks + command.stackDelta);
  }
  if (command.stackMode === EFFECT_STACK_MODES.REPLACE) {
    return Math.min(maxStacks, command.stackDelta);
  }
  return existing.stacks;
}

function resolveRefreshedEffectExpiry(existing, command) {
  if (command.durationMs == null) {
    return existing.expiresAtMs;
  }
  return roundEffectValue(command.timeMs + command.durationMs);
}

function createEffectRuntimeEvent({
  type,
  command,
  before,
  after,
  scenario,
  timeMs = command?.timeMs,
  status,
  transition = null,
}) {
  const state = after ?? before;
  const normalizedTimeMs = roundEffectValue(timeMs);
  const stackBefore = before?.stacks ?? 0;
  const stackAfter = after?.stacks ?? 0;
  const revision = after?.revision ?? before?.revision ?? 0;
  const instanceKey = state?.instanceKey ?? command?.instanceKey ?? '';
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-effect-runtime-event',
    status,
    eventId: [instanceKey, type, normalizedTimeMs, revision]
      .map(createEffectIdPart)
      .join('|'),
    eventType: type,
    type,
    timeMs: normalizedTimeMs,
    frameIndex: msToFrame(
      normalizedTimeMs,
      strictNumberOrNull(scenario.time?.fps) ?? 60
    ),
    actionId: command?.sourceActionId ?? state?.sourceActionId ?? null,
    actorId: command?.sourceActorId ?? state?.sourceActorId ?? null,
    targetId: state?.targetId ?? command?.targetId ?? null,
    targetKind: state?.targetKind ?? command?.targetKind ?? null,
    effectId: state?.effectId ?? command?.effectId ?? null,
    effectName: state?.effectName ?? command?.effectName ?? null,
    instanceKey,
    previousInstanceKey:
      type === EFFECT_RUNTIME_EVENT_TYPES.TRANSFERRED
        ? (before?.instanceKey ?? null)
        : null,
    commandId: command?.commandId ?? null,
    relationId: command?.commandId
      ? createActionEffectRelationId(command.commandId)
      : null,
    relationKind: command?.operation
      ? resolveActionEffectRelationKind(command.operation)
      : null,
    operation:
      command?.operation ??
      (type === EFFECT_RUNTIME_EVENT_TYPES.INHERITED
        ? 'inherit'
        : type === EFFECT_RUNTIME_EVENT_TYPES.TRANSFERRED
          ? 'transfer'
          : type === EFFECT_RUNTIME_EVENT_TYPES.REMOVED
            ? 'remove'
            : 'expire'),
    stackMode: command?.stackMode ?? null,
    stackBefore,
    stackAfter,
    stackChange: stackAfter - stackBefore,
    before: cloneEffectState(before),
    after: cloneEffectState(after),
    ownership: {
      sourceActionId: command?.sourceActionId ?? state?.sourceActionId ?? null,
      sourceActorId: command?.sourceActorId ?? state?.sourceActorId ?? null,
      targetKind: state?.targetKind ?? command?.targetKind ?? null,
      targetId: state?.targetId ?? command?.targetId ?? null,
      previousTargetId: before?.targetId ?? null,
      nextTargetId: after?.targetId ?? null,
    },
    controlledActorTransitionId:
      transition?.transitionId ?? transition?.actionId ?? null,
    controlledActorTransitionActionId: transition?.actionId ?? null,
    sourceStatus: command?.sourceStatus ?? state?.sourceStatus ?? null,
    icon: command?.icon ?? state?.icon ?? null,
    confidence: command?.confidence ?? state?.confidence ?? null,
    trackingStatus: command?.trackingStatus ?? state?.trackingStatus ?? null,
    tags: uniqueValues(command?.tags ?? state?.tags),
    sourceIdentity: cloneSourceIdentity(
      command?.sourceIdentity ?? state?.sourceIdentity
    ),
    modifiers: (command?.modifiers ?? state?.modifiers ?? []).map(modifier => ({
      ...modifier,
    })),
    appliedToCalculators: state?.appliedToCalculators === true,
    payload: {
      effectId: state?.effectId ?? command?.effectId ?? null,
      effectName: state?.effectName ?? command?.effectName ?? null,
      targetKind: state?.targetKind ?? command?.targetKind ?? null,
      targetId: state?.targetId ?? command?.targetId ?? null,
      stackBefore,
      stackAfter,
      expiresAtMs: after?.expiresAtMs ?? null,
      appliedToCalculators: state?.appliedToCalculators === true,
      trackingStatus: command?.trackingStatus ?? state?.trackingStatus ?? null,
      previousTargetId: before?.targetId ?? null,
      nextTargetId: after?.targetId ?? null,
      inheritType: state?.inheritType ?? null,
      effectInstanceId: state?.effectInstanceId ?? null,
    },
    applied: true,
  };
}

function cloneEffectState(effect) {
  return effect
    ? {
        ...effect,
        tags: [...effect.tags],
        sourceIdentity: cloneSourceIdentity(effect.sourceIdentity),
        modifiers: effect.modifiers.map(modifier => ({ ...modifier })),
      }
    : null;
}

function cloneSourceIdentity(value) {
  return value && typeof value === 'object'
    ? JSON.parse(JSON.stringify(value))
    : null;
}

function createEffectInstanceKey({
  targetKind,
  targetId,
  effectId,
  calculatorScope = false,
}) {
  return [
    targetKind,
    targetId,
    effectId,
    ...(calculatorScope ? ['verified-calculator'] : []),
  ]
    .map(createEffectIdPart)
    .join('|');
}

function createEffectIdPart(value) {
  return String(value ?? 'none').replace(/\|/g, '/');
}

function createEffectInstanceId({ effectId, sourceActionId, appliedAtMs }) {
  return [effectId, sourceActionId ?? 'unknown-action', appliedAtMs]
    .map(createEffectIdPart)
    .join('|');
}

function normalizeEffectInheritType(value) {
  if (value === 1 || value === '1' || value === 'self') return 'self';
  if (value === 2 || value === '2' || value === 'source') return 'source';
  return null;
}

function resolveInitialEffectAdderActorId({
  inheritType,
  sourceActorId,
  targetId,
}) {
  return normalizeEffectInheritType(inheritType) === 'self'
    ? targetId
    : sourceActorId;
}

function compareEffectRuntimeCommands(left, right) {
  return (
    left.timeMs - right.timeMs ||
    left.sourceActionIndex - right.sourceActionIndex ||
    left.sourceCommandIndex - right.sourceCommandIndex ||
    left.commandId.localeCompare(right.commandId)
  );
}

function sortEffectStates(states) {
  return [...states].sort(
    (left, right) =>
      compareOptionalNumber(left.expiresAtMs, right.expiresAtMs) ||
      left.instanceKey.localeCompare(right.instanceKey)
  );
}

function compareOptionalNumber(left, right) {
  const leftNumber = strictNumberOrNull(left);
  const rightNumber = strictNumberOrNull(right);
  if (leftNumber != null && rightNumber != null) {
    return leftNumber - rightNumber;
  }
  if (leftNumber != null) {
    return -1;
  }
  if (rightNumber != null) {
    return 1;
  }
  return 0;
}

function msToFrame(timeMs, frameRate) {
  return Math.round((Number(timeMs) * Number(frameRate || 60)) / 1000);
}

function positiveIntegerOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function strictNumberOrNull(value) {
  if (value == null || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundEffectValue(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

function uniqueValues(values) {
  return [
    ...new Set((values ?? []).filter(value => value != null && value !== '')),
  ];
}

function countByKey(items, getKey) {
  const counts = new Map();
  for (const item of items ?? []) {
    const key = getKey(item);
    if (!key) {
      continue;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function createCountRows(counts) {
  return [...counts.entries()].map(([key, count]) => ({ key, count }));
}
