import { ACTION_TYPES } from '../../domain/projectSchema';

export const CONTROLLED_ACTOR_TIMELINE_SCHEMA_VERSION = 1;
export const CONTROLLED_ACTOR_TIMELINE_CONTRACT_NAME =
  'AzPrControlledActorTimeline';

export function createControlledActorTimeline({
  scenario = null,
  actionExecutionPlan = null,
} = {}) {
  const actors = Array.isArray(scenario?.actors) ? scenario.actors : [];
  const actorsById = new Map(actors.map(actor => [actor.id, actor]));
  const initialActor = resolveInitialControlledActor(scenario, actorsById);
  const durationMs = nonNegativeNumber(scenario?.time?.durationMs);
  const frameRate = positiveNumber(scenario?.time?.fps, 60);
  const executionByActionId = new Map(
    (actionExecutionPlan?.actions ?? []).map(entry => [entry.actionId, entry])
  );
  const transitions = [];
  let controlledActor = initialActor;

  for (const action of sortSwitchActions(scenario?.actions)) {
    const execution = executionByActionId.get(action.id);
    const beforeActor = controlledActor;
    const targetActor = actorsById.get(action.targetActorId) ?? null;
    const executable = execution?.execute !== false;
    const applied = Boolean(
      executable && targetActor && targetActor !== beforeActor
    );
    if (applied) {
      controlledActor = targetActor;
    }
    transitions.push({
      transitionId: `controlled-actor-transition-${action.id}`,
      actionId: action.id,
      timeMs: clampNumber(action.startMs, 0, durationMs),
      frameIndex: timeToFrame(action.startMs, frameRate),
      sourceActor: createActorIdentity(action.actor),
      beforeActor: createActorIdentity(beforeActor),
      targetActor: createActorIdentity(targetActor),
      afterActor: createActorIdentity(controlledActor),
      status: !executable
        ? 'controlled-actor-switch-skipped'
        : !targetActor
          ? 'controlled-actor-switch-target-missing'
          : targetActor === beforeActor
            ? 'controlled-actor-switch-noop'
            : 'controlled-actor-switch-applied',
      applied,
    });
  }

  const intervals = createControlledActorIntervals({
    initialActor,
    transitions,
    durationMs,
    frameRate,
  });
  const appliedTransitions = transitions.filter(
    transition => transition.applied
  );

  return {
    schemaVersion: CONTROLLED_ACTOR_TIMELINE_SCHEMA_VERSION,
    contractName: CONTROLLED_ACTOR_TIMELINE_CONTRACT_NAME,
    sourceKind: 'azpr-controlled-actor-runtime-timeline',
    status: initialActor
      ? 'controlled-actor-timeline-ready'
      : 'controlled-actor-timeline-ready-no-actors',
    initialActor: createActorIdentity(initialActor),
    finalActor: createActorIdentity(controlledActor),
    transitions,
    intervals,
    summary: {
      actorCount: actors.length,
      transitionCount: transitions.length,
      appliedTransitionCount: appliedTransitions.length,
      skippedTransitionCount: transitions.length - appliedTransitions.length,
      intervalCount: intervals.length,
      durationMs,
      frameRate,
    },
    applied: true,
  };
}

export function resolveControlledActorAt(
  timeline,
  timeMs,
  { strictlyBefore = false } = {}
) {
  const targetTimeMs = nonNegativeNumber(timeMs);
  let actor = timeline?.initialActor ?? null;
  for (const transition of timeline?.transitions ?? []) {
    const transitionTimeMs = nonNegativeNumber(transition.timeMs);
    if (
      transitionTimeMs > targetTimeMs ||
      (strictlyBefore && transitionTimeMs === targetTimeMs)
    ) {
      break;
    }
    if (transition.applied && transition.afterActor) {
      actor = transition.afterActor;
    }
  }
  return actor ? { ...actor } : null;
}

function resolveInitialControlledActor(scenario, actorsById) {
  const initial = scenario?.initialRuntimeState?.controlledActor;
  const actorByInitialId = initial?.actorId
    ? actorsById.get(initial.actorId)
    : null;
  if (actorByInitialId) return actorByInitialId;

  const actorByCharacterId = [...actorsById.values()].find(
    actor => Number(actor.characterId) === Number(initial?.characterId)
  );
  if (actorByCharacterId) return actorByCharacterId;

  const firstTeamActorId = scenario?.team?.slots?.[0]?.actorId;
  return (
    actorsById.get(firstTeamActorId) ?? actorsById.values().next().value ?? null
  );
}

function sortSwitchActions(actions) {
  return (Array.isArray(actions) ? actions : [])
    .filter(action => action.type === ACTION_TYPES.SWITCH)
    .sort(
      (left, right) =>
        nonNegativeNumber(left.startMs) - nonNegativeNumber(right.startMs) ||
        String(left.id).localeCompare(String(right.id))
    );
}

function createControlledActorIntervals({
  initialActor,
  transitions,
  durationMs,
  frameRate,
}) {
  if (!initialActor) return [];
  const intervals = [];
  let actor = initialActor;
  let startMs = 0;
  let sourceTransitionId = null;

  for (const transition of transitions) {
    if (!transition.applied) continue;
    if (transition.timeMs > startMs) {
      intervals.push(
        createInterval({
          actor,
          startMs,
          endMs: transition.timeMs,
          frameRate,
          sourceTransitionId,
        })
      );
    }
    actor = transition.afterActor;
    startMs = transition.timeMs;
    sourceTransitionId = transition.transitionId;
  }

  if (durationMs >= startMs) {
    intervals.push(
      createInterval({
        actor,
        startMs,
        endMs: durationMs,
        frameRate,
        sourceTransitionId,
      })
    );
  }
  return intervals;
}

function createInterval({
  actor,
  startMs,
  endMs,
  frameRate,
  sourceTransitionId,
}) {
  const identity = createActorIdentity(actor);
  return {
    intervalId: `controlled-actor-interval-${identity.actorId}-${timeToFrame(startMs, frameRate)}`,
    actor: identity,
    actorId: identity.actorId,
    characterId: identity.characterId,
    startMs,
    endMs,
    startFrameIndex: timeToFrame(startMs, frameRate),
    endFrameIndex: timeToFrame(endMs, frameRate),
    sourceTransitionId,
  };
}

function createActorIdentity(actor) {
  if (!actor) return null;
  return {
    actorId: actor.actorId ?? actor.id ?? null,
    characterId: numberOrNull(actor.characterId),
    actorName: actor.actorName ?? actor.name ?? null,
  };
}

function timeToFrame(timeMs, frameRate) {
  return Math.max(
    0,
    Math.round((nonNegativeNumber(timeMs) * frameRate) / 1000)
  );
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function nonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clampNumber(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, nonNegativeNumber(value)));
}
