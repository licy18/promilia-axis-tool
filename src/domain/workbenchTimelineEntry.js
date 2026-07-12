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
    eventType: textOrNull(source.eventType),
    label: textOrNull(source.label),
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
