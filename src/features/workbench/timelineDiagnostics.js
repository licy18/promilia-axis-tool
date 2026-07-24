export const DEFAULT_TIMELINE_ACTION_DURATION_MS = 1800;
export const SYSTEM_TIMELINE_LANE_ID = 'system';
export const SYSTEM_TIMELINE_LANE_NAME = '系统';
export const ENEMY_TIMELINE_LANE_ID = 'enemy-events';
export const ENEMY_TIMELINE_LANE_NAME = '敌人';
const TIMELINE_BOUNDARY_EPSILON_MS = 0.001;

export function createTimelineDiagnostics({
  actors = [],
  actions = [],
  timelineTopology = null,
} = {}) {
  const actorLaneIds = new Set(actors.map(actor => actor.id));
  const actorNameById = new Map(actors.map(actor => [actor.id, actor.name]));
  const kiboLaneIdByActorId = new Map(
    (timelineTopology?.actorGroups ?? []).map(group => [
      group.actorId,
      group.kiboLane?.laneId,
    ])
  );
  const laneNameById = new Map([
    ...actors.map(actor => [actor.id, actor.name]),
    ...[...kiboLaneIdByActorId].map(([actorId, laneId]) => [
      laneId,
      `奇波 · ${actorNameById.get(actorId) ?? actorId}`,
    ]),
    [SYSTEM_TIMELINE_LANE_ID, SYSTEM_TIMELINE_LANE_NAME],
    [ENEMY_TIMELINE_LANE_ID, ENEMY_TIMELINE_LANE_NAME],
  ]);
  const rangesByLane = new Map();

  actions.forEach(action => {
    const laneId = resolveTimelineActionLaneId(
      action,
      actorLaneIds,
      kiboLaneIdByActorId
    );
    const range = createActionRange(
      action,
      laneId,
      laneNameById.get(laneId) ?? SYSTEM_TIMELINE_LANE_NAME
    );
    if (!rangesByLane.has(laneId)) {
      rangesByLane.set(laneId, []);
    }
    rangesByLane.get(laneId).push(range);
  });

  const overlaps = [];
  rangesByLane.forEach(ranges => {
    const sortedRanges = [...ranges].sort(compareActionRanges);
    for (let index = 0; index < sortedRanges.length; index += 1) {
      const current = sortedRanges[index];
      for (
        let nextIndex = index + 1;
        nextIndex < sortedRanges.length;
        nextIndex += 1
      ) {
        const next = sortedRanges[nextIndex];
        if (next.startMs >= current.endMs - TIMELINE_BOUNDARY_EPSILON_MS) {
          break;
        }

        const overlapStartMs = Math.max(current.startMs, next.startMs);
        const overlapEndMs = Math.min(current.endMs, next.endMs);
        if (overlapEndMs - overlapStartMs <= TIMELINE_BOUNDARY_EPSILON_MS) {
          continue;
        }
        if (
          current.contextActionId === next.actionId ||
          next.contextActionId === current.actionId
        ) {
          continue;
        }

        overlaps.push({
          id: `${current.laneId}:${current.actionId}:${next.actionId}`,
          laneId: current.laneId,
          laneName: current.laneName,
          actionIds: [current.actionId, next.actionId],
          actionNames: [current.actionName, next.actionName],
          overlapStartMs,
          overlapEndMs,
          durationMs: overlapEndMs - overlapStartMs,
        });
      }
    }
  });

  const overlapActionIds = [
    ...new Set(overlaps.flatMap(overlap => overlap.actionIds)),
  ].sort();

  return {
    overlapCount: overlaps.length,
    overlaps: overlaps.sort(compareOverlaps),
    overlapActionIds,
  };
}

export function resolveTimelineActionLaneId(
  action,
  actorLaneIds = new Set(),
  kiboLaneIdByActorId = new Map()
) {
  if (action?.type === 'enemyEvent') {
    return ENEMY_TIMELINE_LANE_ID;
  }
  if (action?.type === 'kiboEvent') {
    return (
      kiboLaneIdByActorId.get(action?.actor?.id ?? action?.actorId) ??
      SYSTEM_TIMELINE_LANE_ID
    );
  }
  if (action?.actor?.id && actorLaneIds.has(action.actor.id)) {
    return action.actor.id;
  }
  if (action?.actorId && actorLaneIds.has(action.actorId)) {
    return action.actorId;
  }
  return SYSTEM_TIMELINE_LANE_ID;
}

function createActionRange(action, laneId, laneName) {
  const startMs = Math.max(0, Number(action.startMs) || 0);
  const durationMs =
    action.type === 'switch'
      ? 0
      : Math.max(1, Number(action.durationMs) || 1);

  return {
    actionId: action.id,
    actionName: createActionName(action),
    laneId,
    laneName,
    startMs,
    endMs: startMs + durationMs,
    durationMs,
    contextActionId: action.runtimeContextActionId ?? null,
  };
}

function createActionName(action) {
  if (action.type === 'switch') {
    return `${action.name ?? '切人'} -> ${action.targetActor?.name ?? action.targetCharacterId ?? '目标'}`;
  }
  return action.name ?? action.id ?? '未命名动作';
}

function compareActionRanges(left, right) {
  return (
    left.startMs - right.startMs ||
    left.endMs - right.endMs ||
    left.actionId.localeCompare(right.actionId)
  );
}

function compareOverlaps(left, right) {
  return (
    left.overlapStartMs - right.overlapStartMs ||
    left.overlapEndMs - right.overlapEndMs ||
    left.laneId.localeCompare(right.laneId) ||
    left.id.localeCompare(right.id)
  );
}
