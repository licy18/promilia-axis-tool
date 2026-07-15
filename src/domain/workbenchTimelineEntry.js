import { ACTION_TYPES } from './projectSchema';

export const WORKBENCH_TIMELINE_LANE_KINDS = Object.freeze({
  ACTOR_ACTION: 'actor-action',
  ACTOR_KIBO: 'actor-kibo',
  ENEMY_EVENT: 'enemy-event',
});
export const WORKBENCH_TIMELINE_ENTRY_MIME =
  'application/x-promilia-timeline-entry';

const LANE_KIND_BY_ACTION_TYPE = Object.freeze({
  [ACTION_TYPES.SKILL]: WORKBENCH_TIMELINE_LANE_KINDS.ACTOR_ACTION,
  [ACTION_TYPES.SWITCH]: WORKBENCH_TIMELINE_LANE_KINDS.ACTOR_ACTION,
  [ACTION_TYPES.RESOURCE]: WORKBENCH_TIMELINE_LANE_KINDS.ACTOR_ACTION,
  [ACTION_TYPES.KIBO_EVENT]: WORKBENCH_TIMELINE_LANE_KINDS.ACTOR_KIBO,
  [ACTION_TYPES.ENEMY_EVENT]: WORKBENCH_TIMELINE_LANE_KINDS.ENEMY_EVENT,
});

export function createWorkbenchTimelineEntry(source = {}) {
  const type = Object.prototype.hasOwnProperty.call(
    LANE_KIND_BY_ACTION_TYPE,
    source.type
  )
    ? source.type
    : null;
  if (!type) {
    return null;
  }

  return {
    type,
    skillId: positiveIntegerOrNull(source.skillId),
    actionVariantIndex: Math.max(
      0,
      Number(source.actionVariantIndex ?? source.damageSegmentIndex) || 0
    ),
    durationMs: positiveNumberOrNull(source.durationMs),
    cooldownMs: positiveNumberOrNull(source.cooldownMs),
    eventType: textOrNull(source.eventType),
    icon: textOrNull(source.icon),
    label: textOrNull(source.label),
    timingSource: textOrNull(source.timingSource),
    needsTimingData: Boolean(source.needsTimingData),
    rawValue: source.rawValue ?? null,
    note: textOrNull(source.note),
  };
}

export function resolveWorkbenchTimelineLaneKind(entryOrAction = {}) {
  return LANE_KIND_BY_ACTION_TYPE[entryOrAction?.type] ?? null;
}

export function serializeWorkbenchTimelineEntry(source = {}) {
  const entry = createWorkbenchTimelineEntry(source);
  return entry ? JSON.stringify(entry) : '';
}

export function parseWorkbenchTimelineEntry(rawEntry) {
  const raw = String(rawEntry ?? '').trim();
  if (!raw) {
    return null;
  }
  try {
    return createWorkbenchTimelineEntry(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function isWorkbenchTimelineEntryAllowedInLane(
  entryOrAction,
  laneOrKind
) {
  const laneKind =
    typeof laneOrKind === 'string' ? laneOrKind : laneOrKind?.kind;
  return (
    Boolean(laneKind) &&
    resolveWorkbenchTimelineLaneKind(entryOrAction) === laneKind
  );
}

export function createWorkbenchTimelineBatchLaneMovePlan({
  actions = [],
  actionIds = [],
  primaryActionId = '',
  targetLane = null,
  getActionOwnerId = action =>
    action?.actorCharacterId ?? action?.actorId ?? null,
  getLaneOwnerId = lane => lane?.characterId ?? lane?.actorId ?? null,
} = {}) {
  const requestedActionIds = new Set(actionIds);
  const selectedActions = actions.filter(action =>
    requestedActionIds.has(action.id)
  );
  const primaryAction =
    selectedActions.find(action => action.id === primaryActionId) ??
    selectedActions[0] ??
    null;
  const primaryLaneKind = resolveWorkbenchTimelineLaneKind(primaryAction);
  const targetOwnerId = normalizeOwnerId(getLaneOwnerId(targetLane));
  if (
    !primaryAction ||
    !targetOwnerId ||
    targetLane?.kind !== primaryLaneKind
  ) {
    return null;
  }

  const actorLaneKinds = new Set([
    WORKBENCH_TIMELINE_LANE_KINDS.ACTOR_ACTION,
    WORKBENCH_TIMELINE_LANE_KINDS.ACTOR_KIBO,
  ]);
  const sourceOwnerIds = new Set();
  const entries = [];
  for (const action of selectedActions) {
    const laneKind = resolveWorkbenchTimelineLaneKind(action);
    const sourceOwnerId = normalizeOwnerId(getActionOwnerId(action));
    if (!actorLaneKinds.has(laneKind) || !sourceOwnerId) {
      return null;
    }
    sourceOwnerIds.add(sourceOwnerId);
    entries.push({ actionId: action.id, laneKind, sourceOwnerId });
  }
  if (entries.length === 0 || sourceOwnerIds.size !== 1) {
    return null;
  }

  return {
    actionIds: entries.map(entry => entry.actionId),
    primaryActionId: primaryAction.id,
    sourceOwnerId: entries[0].sourceOwnerId,
    targetOwnerId,
    targetLaneId: targetLane.id,
    targetLaneKind: targetLane.kind,
    entries,
    changesOwner: entries[0].sourceOwnerId !== targetOwnerId,
  };
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function positiveNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function textOrNull(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalizeOwnerId(value) {
  const text = String(value ?? '').trim();
  return text || null;
}
