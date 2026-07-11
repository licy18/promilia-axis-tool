import {
  EFFECT_OPERATIONS,
  EFFECT_STACK_MODES,
  EFFECT_TARGET_KINDS,
} from '../../domain/projectSchema';

export const ACTION_EFFECT_COMMAND_CONTRACT_NAME = 'AzPrActionEffectCommand';
export const EFFECT_RUNTIME_TIMELINE_CONTRACT_NAME =
  'AzPrEffectRuntimeTimeline';

export const EFFECT_RUNTIME_EVENT_TYPES = Object.freeze({
  INHERITED: 'EFFECT_INHERITED',
  APPLIED: 'EFFECT_APPLIED',
  REFRESHED: 'EFFECT_REFRESHED',
  REMOVED: 'EFFECT_REMOVED',
  EXPIRED: 'EFFECT_EXPIRED',
});

export function createActionEffectRuntimeInput({
  scenario = {},
  actionExecutionPlan = null,
} = {}) {
  const validationIssues = [];
  const executionPlanByActionId = new Map(
    (actionExecutionPlan?.actions ?? []).map(entry => [entry.actionId, entry])
  );
  const inputCommands = (scenario.actions ?? []).flatMap(
    (action, actionIndex) =>
      (action.effectCommands ?? []).map((command, commandIndex) => ({
        action,
        actionIndex,
        command,
        commandIndex,
        executionEntry: executionPlanByActionId.get(action.id) ?? null,
      }))
  );
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
      calculatorAppliedCommandCount: 0,
      applied: true,
    },
    applied: true,
  };
}

export function createEffectRuntimeTimeline({
  scenario = {},
  effectInput = null,
  actionExecutionPlan = null,
} = {}) {
  const input =
    effectInput ??
    createActionEffectRuntimeInput({ scenario, actionExecutionPlan });
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

  for (const command of input.commands) {
    expireRuntimeEffects({
      activeByInstanceKey,
      timeMs: command.timeMs,
      scenario,
      emitEvent,
    });
    applyRuntimeEffectCommand({
      command,
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
      enemyTargetEventCount: events.filter(
        event => event.targetKind === EFFECT_TARGET_KINDS.ENEMY
      ).length,
      effectIds: uniqueValues(events.map(event => event.effectId)),
      targetIds: uniqueValues(events.map(event => event.targetId)),
      calculatorAppliedEffectCount: 0,
      applied: true,
    },
    applied: true,
  };
}

function isInheritedEffectTargetAvailable(effect, scenario) {
  if (effect.targetKind === EFFECT_TARGET_KINDS.ENEMY) {
    return effect.targetId === scenario?.enemy?.id;
  }
  if (effect.targetKind === EFFECT_TARGET_KINDS.ACTOR) {
    return (scenario?.actors ?? []).some(actor => actor.id === effect.targetId);
  }
  return false;
}

function createInheritedRuntimeEffectState(effect) {
  const remainingDurationMs = strictNumberOrNull(effect.remainingDurationMs);
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-runtime-active-effect',
    instanceKey: effect.instanceKey,
    effectId: effect.effectId,
    effectName: effect.effectName,
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
    modifiers: Array.isArray(effect.modifiers)
      ? effect.modifiers.map(modifier => ({ ...modifier }))
      : [],
    sourceStatus: 'effect-inherited-from-cycle-boundary',
    appliedToCalculators: false,
    active: true,
  };
}

function normalizeEffectRuntimeCommand(entry, validationIssues, scenario) {
  const { action, actionIndex, command, commandIndex, executionEntry } = entry;
  const commandPath = `scenario.actions[${actionIndex}].effectCommands[${commandIndex}]`;
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

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-action-effect-runtime-command',
    contractName: ACTION_EFFECT_COMMAND_CONTRACT_NAME,
    status: 'action-effect-runtime-command-ready',
    commandId: String(
      command.id ?? `${action.id}|effect-command|${commandIndex}`
    ),
    sourceActionId: command.sourceActionId ?? action.id ?? null,
    sourceActionName: command.sourceActionName ?? action.name ?? null,
    sourceActorId: command.sourceActorId ?? action.actorId ?? null,
    sourceActorName: command.sourceActorName ?? action.actor?.name ?? null,
    effectId,
    effectName: String(command.effectName ?? effectId),
    operation: command.operation,
    targetKind: command.targetKind,
    targetId,
    targetName: command.targetName ?? null,
    instanceKey: createEffectInstanceKey({
      targetKind: command.targetKind,
      targetId,
      effectId,
    }),
    timeMs: roundEffectValue(timeMs),
    frameIndex: msToFrame(timeMs, strictNumberOrNull(scenario.time?.fps) ?? 60),
    durationMs: strictNumberOrNull(command.durationMs),
    stackMode: command.stackMode,
    stackDelta: positiveIntegerOrDefault(command.stackDelta, 1),
    maxStacks: positiveIntegerOrDefault(command.maxStacks, 1),
    tags: uniqueValues(command.tags),
    sourceStatus: command.sourceStatus ?? 'project-configured-effect-command',
    modifiers: Array.isArray(command.modifiers)
      ? command.modifiers.map(modifier => ({ ...modifier }))
      : [],
    appliedToCalculators: false,
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
    appliedToCalculators: false,
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
    expiresAtMs,
    stacks,
    maxStacks,
    refreshCount: existing.refreshCount + 1,
    revision: existing.revision + 1,
    tags: uniqueValues([...existing.tags, ...command.tags]),
    modifiers: command.modifiers,
    sourceStatus: command.sourceStatus,
    appliedToCalculators: false,
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
    commandId: command?.commandId ?? null,
    operation:
      command?.operation ??
      (type === EFFECT_RUNTIME_EVENT_TYPES.INHERITED ? 'inherit' : 'expire'),
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
    },
    sourceStatus: command?.sourceStatus ?? state?.sourceStatus ?? null,
    modifiers: (command?.modifiers ?? state?.modifiers ?? []).map(modifier => ({
      ...modifier,
    })),
    appliedToCalculators: false,
    payload: {
      effectId: state?.effectId ?? command?.effectId ?? null,
      effectName: state?.effectName ?? command?.effectName ?? null,
      targetKind: state?.targetKind ?? command?.targetKind ?? null,
      targetId: state?.targetId ?? command?.targetId ?? null,
      stackBefore,
      stackAfter,
      expiresAtMs: after?.expiresAtMs ?? null,
      appliedToCalculators: false,
    },
    applied: true,
  };
}

function cloneEffectState(effect) {
  return effect
    ? {
        ...effect,
        tags: [...effect.tags],
        modifiers: effect.modifiers.map(modifier => ({ ...modifier })),
      }
    : null;
}

function createEffectInstanceKey({ targetKind, targetId, effectId }) {
  return [targetKind, targetId, effectId].map(createEffectIdPart).join('|');
}

function createEffectIdPart(value) {
  return String(value ?? 'none').replace(/\|/g, '/');
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
