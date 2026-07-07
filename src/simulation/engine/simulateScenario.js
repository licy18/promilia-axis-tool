import { createRawDamageProjection } from '../mechanics/damage';
import { projectSimulationResult } from '../projection/projectSimulationResult';
import { ACTION_TYPES } from '../../domain/projectSchema';

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

  for (const action of scenario.actions) {
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

    if (Number(action.cooldownMs) > 0) {
      eventLog.push({
        type: 'COOLDOWN_START',
        timeMs: action.startMs,
        actionId: action.id,
        actorId: action.actorId,
        payload: {
          cooldownMs: action.cooldownMs,
          endsAtMs: action.startMs + action.cooldownMs,
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

  eventLog.push({
    type: 'SCENARIO_END',
    timeMs: scenario.time.durationMs,
    payload: {
      projectId: scenario.sourceProject.id,
    },
  });

  eventLog.sort((a, b) => a.timeMs - b.timeMs || eventPriority(a.type) - eventPriority(b.type));

  return projectSimulationResult({
    scenario,
    eventLog,
    damageEvents,
    resourceEvents,
  });
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
      targetId: action.target?.id,
      targetName: action.target?.name,
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
      timingAccuracy: action.timing?.needsTimingData ? 'placeholder' : 'authoritative',
    },
  };
}

function eventPriority(type) {
  const priorities = {
    SCENARIO_START: 0,
    ACTION_START: 1,
    TIMING_DATA_MISSING: 2,
    RESOURCE_CHANGE: 3,
    COOLDOWN_START: 4,
    DAMAGE_PROJECTED: 5,
    WAIT: 6,
    ENEMY_EVENT: 7,
    ANNOTATION: 8,
    DAMAGE_SKIPPED: 9,
    SCENARIO_END: 99,
  };

  return priorities[type] ?? 50;
}
