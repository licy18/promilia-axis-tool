import { createRawDamageProjection } from '../mechanics/damage';
import { projectSimulationResult } from '../projection/projectSimulationResult';
import { ACTION_TYPES } from '../../domain/projectSchema';
import { createEffectRuntimeTimeline } from '../runtime/effectRuntimeTimeline';
import { createActionRuleDiagnostics } from '../runtime/actionRuleDiagnostics';
import {
  createActionExecutionPlan,
  createActionExecutionPlanIndex,
} from './actionExecutionPlan';

export function simulateScenario(scenario) {
  const eventLog = [
    {
      type: 'SCENARIO_START',
      timeMs: 0,
      payload: {
        projectId: scenario.sourceProject.id,
        projectName: scenario.sourceProject.name,
      },
    },
  ];

  const damageEvents = [];
  const resourceEvents = [];
  const actionRuleDiagnostics = createActionRuleDiagnostics({ scenario });
  const actionExecutionPlan = createActionExecutionPlan({
    scenario,
    actionRuleDiagnostics,
  });
  const executionPlanByActionId =
    createActionExecutionPlanIndex(actionExecutionPlan);

  for (const action of scenario.actions) {
    const executionEntry = executionPlanByActionId.get(action.id);
    if (executionEntry?.execute === false) {
      eventLog.push(createActionSkippedEvent(action, executionEntry));
      continue;
    }
    eventLog.push(createActionStartEvent(action));

    const resourceActionEvent = createResourceActionEvent(action);
    if (resourceActionEvent) {
      resourceEvents.push(resourceActionEvent);
      eventLog.push(resourceActionEvent);
      continue;
    }

    const nonCombatEvent = createNonCombatEvent(action);
    if (nonCombatEvent) {
      eventLog.push(nonCombatEvent);
      continue;
    }

    if (action.timing?.needsTimingData) {
      eventLog.push({
        type: 'TIMING_DATA_MISSING',
        timeMs: action.startMs,
        actionId: action.id,
        payload: {
          actionName: action.name,
          timingSource: action.timing.source,
        },
      });
    }

    if (Number(action.spCost) > 0) {
      const event = {
        type: 'RESOURCE_CHANGE',
        timeMs: action.startMs,
        actionId: action.id,
        actorId: action.actorId,
        payload: {
          resource: 'sp',
          change: -Number(action.spCost),
          reason: 'skill-cost',
          confidence: 'medium',
        },
      };
      resourceEvents.push(event);
      eventLog.push(event);
    }

    const cooldownMs = resolveActionCooldownMs(action);
    if (cooldownMs > 0) {
      eventLog.push({
        type: 'COOLDOWN_START',
        timeMs: action.startMs,
        actionId: action.id,
        actorId: action.actorId,
        payload: {
          cooldownMs,
          endsAtMs: action.startMs + cooldownMs,
          sourceKind:
            action.logicModel?.logic?.sourceKind ?? 'skill-display-cooldown',
        },
      });
    }

    const damageEvent = createDamageEvent(action, scenario.enemy);
    if (damageEvent) {
      damageEvents.push(damageEvent);
      eventLog.push(damageEvent);
    } else {
      eventLog.push({
        type: 'DAMAGE_SKIPPED',
        timeMs: action.startMs,
        actionId: action.id,
        payload: {
          reason: 'no-parseable-skill-multiplier',
        },
      });
    }
  }

  const effectTimeline = createEffectRuntimeTimeline({
    scenario,
    actionExecutionPlan,
  });
  eventLog.push(...effectTimeline.events);

  eventLog.push({
    type: 'SCENARIO_END',
    timeMs: scenario.time.durationMs,
    payload: {
      projectId: scenario.sourceProject.id,
    },
  });

  eventLog.sort(
    (a, b) =>
      a.timeMs - b.timeMs || eventPriority(a.type) - eventPriority(b.type)
  );

  return projectSimulationResult({
    scenario,
    eventLog,
    damageEvents,
    resourceEvents,
    effectTimeline,
    actionRuleDiagnostics,
    actionExecutionPlan,
  });
}

function resolveActionCooldownMs(action) {
  const cooldownMs = Number(
    action.logicModel?.logic?.cooldownMs ?? action.cooldownMs
  );
  return Number.isFinite(cooldownMs) && cooldownMs > 0 ? cooldownMs : 0;
}

function createNonCombatEvent(action) {
  if (action.type === ACTION_TYPES.WAIT) {
    return {
      type: 'WAIT',
      timeMs: action.startMs,
      actionId: action.id,
      payload: {
        actionName: action.name,
        durationMs: action.durationMs,
        note: action.note,
      },
    };
  }

  if (action.type === ACTION_TYPES.SWITCH) {
    return {
      type: 'SWITCH',
      timeMs: action.startMs,
      actionId: action.id,
      actorId: action.actorId,
      payload: {
        actionName: action.name,
        fromActorName: action.actor?.name,
        targetActorId: action.targetActorId,
        targetActorName: action.targetActor?.name,
        durationMs: action.durationMs,
        note: action.note,
      },
    };
  }

  if (action.type === ACTION_TYPES.ANNOTATION) {
    return {
      type: 'ANNOTATION',
      timeMs: action.startMs,
      actionId: action.id,
      payload: {
        actionName: action.name,
        note: action.note,
      },
    };
  }

  if (action.type === ACTION_TYPES.ENEMY_EVENT) {
    return {
      type: 'ENEMY_EVENT',
      timeMs: action.startMs,
      actionId: action.id,
      targetId: action.target?.id,
      payload: {
        actionName: action.name,
        enemyName: action.target?.name,
        eventType: action.eventType,
        note: action.note,
      },
    };
  }

  return null;
}

function createResourceActionEvent(action) {
  if (action.type !== ACTION_TYPES.RESOURCE) {
    return null;
  }

  return {
    type: 'RESOURCE_CHANGE',
    timeMs: action.startMs,
    actionId: action.id,
    actorId: action.actorId,
    payload: {
      resource: action.resource,
      change: Number(action.change) || 0,
      reason: action.reason || 'manual-axis-resource',
      confidence: 'manual',
      note: action.note,
    },
  };
}

function createActionStartEvent(action) {
  return {
    type: 'ACTION_START',
    timeMs: action.startMs,
    actionId: action.id,
    actorId: action.actorId,
    payload: {
      actionName: action.name,
      actionType: action.type,
      skillId: action.skillId,
      actorName: action.actor?.name,
      targetActorName: action.targetActor?.name,
      targetId: action.target?.id,
      targetName: action.target?.name,
    },
  };
}

function createActionSkippedEvent(action, executionEntry) {
  return {
    type: 'ACTION_SKIPPED',
    timeMs: action.startMs,
    actionId: action.id,
    actorId: action.actorId,
    payload: {
      actionName: action.name,
      actionType: action.type,
      reason: executionEntry.skipReason,
      executionStatus: executionEntry.status,
      readinessStatus: executionEntry.readinessStatus,
      diagnosticIds: executionEntry.diagnosticIds,
      violationCodes: executionEntry.violationCodes,
    },
  };
}

function createDamageEvent(action, enemy) {
  const segment = action.selectedDamageSegment;
  if (!segment || !action.actor || !action.target) {
    return null;
  }

  const projection = createRawDamageProjection({
    actor: action.actor,
    enemy,
    action,
    segment,
  });

  return {
    type: 'DAMAGE_PROJECTED',
    timeMs: action.startMs,
    actionId: action.id,
    actorId: action.actorId,
    targetId: action.targetId,
    payload: {
      ...projection,
      timingAccuracy: action.timing?.needsTimingData
        ? 'placeholder'
        : 'authoritative',
    },
  };
}

function eventPriority(type) {
  const priorities = {
    SCENARIO_START: 0,
    EFFECT_EXPIRED: 1,
    ACTION_SKIPPED: 2,
    ACTION_START: 2,
    TIMING_DATA_MISSING: 3,
    RESOURCE_CHANGE: 4,
    EFFECT_INHERITED: 5,
    EFFECT_APPLIED: 5,
    EFFECT_REFRESHED: 5,
    EFFECT_REMOVED: 5,
    COOLDOWN_START: 6,
    DAMAGE_PROJECTED: 7,
    WAIT: 8,
    SWITCH: 9,
    ENEMY_EVENT: 10,
    ANNOTATION: 11,
    DAMAGE_SKIPPED: 12,
    SCENARIO_END: 99,
  };

  return priorities[type] ?? 50;
}
