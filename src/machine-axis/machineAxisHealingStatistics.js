const HEAL_SETTLEMENT_TYPE_VALUES = [
  'VERIFIED_DIRECT_HEAL',
  'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL',
  'VERIFIED_TUNING_PERIODIC_HEAL',
  'VERIFIED_KIBO_PASSIVE_DERIVED_SELF_HEAL',
];

export const MACHINE_AXIS_HEAL_SETTLEMENT_TYPES = Object.freeze([
  ...HEAL_SETTLEMENT_TYPE_VALUES,
]);

const HEAL_SETTLEMENT_TYPES = new Set(HEAL_SETTLEMENT_TYPE_VALUES);
const DEFAULT_FPS = 60;
const CURSOR_MISSING_SEQUENCE = Number.MAX_SAFE_INTEGER;

export function createMachineAxisHealingStatistics(
  events = [],
  {
    durationMs = null,
    fps = DEFAULT_FPS,
    startFrame = null,
    endFrame = null,
    killCursor = null,
    actionIdMap = null,
  } = {}
) {
  const scope = normalizeHealingScope({
    durationMs,
    fps,
    startFrame,
    endFrame,
    killCursor,
  });
  const totals = createHealingAccumulator();
  const bySourceActor = new Map();
  const bySourceAction = new Map();

  for (const event of events ?? []) {
    if (!isMachineAxisHealSettlement(event)) continue;
    if (!healingEventWithinScope(event, scope)) continue;

    const settlement = normalizeHealSettlement(event, actionIdMap);
    accumulateHealing(totals, settlement);

    const actorIdentity = settlement.sourceActorId ?? 'unattributed';
    const actorRow = bySourceActor.get(actorIdentity) ?? {
      identity: actorIdentity,
      sourceActorId: settlement.sourceActorId,
      ...createHealingAccumulator(),
    };
    accumulateHealing(actorRow, settlement);
    bySourceActor.set(actorIdentity, actorRow);

    const actionIdentity = createSourceActionIdentity(settlement);
    const actionRow = bySourceAction.get(actionIdentity) ?? {
      identity: actionIdentity,
      sourceActionId: settlement.sourceActionId,
      sourceActorId: settlement.sourceActorId,
      ...createHealingAccumulator(),
    };
    accumulateHealing(actionRow, settlement);
    bySourceAction.set(actionIdentity, actionRow);
  }

  return {
    requestedHealing: roundMetric(totals.requestedHealing),
    effectiveHealing: roundMetric(totals.effectiveHealing),
    overhealing: roundMetric(totals.overhealing),
    effectiveHps: calculateEffectiveHps(
      totals.effectiveHealing,
      scope.durationMs
    ),
    settlementCount: totals.settlementCount,
    bySourceActor: finalizeContributionRows(bySourceActor, scope.durationMs),
    bySourceAction: finalizeContributionRows(bySourceAction, scope.durationMs),
  };
}

export function isMachineAxisHealSettlement(event) {
  return HEAL_SETTLEMENT_TYPES.has(String(event?.type ?? ''));
}

function normalizeHealingScope({
  durationMs,
  fps,
  startFrame,
  endFrame,
  killCursor,
}) {
  const normalizedFps = positiveNumber(fps) ?? DEFAULT_FPS;
  const hasStart = startFrame != null;
  const hasEnd = endFrame != null;
  if (killCursor != null && (hasStart || hasEnd)) {
    throw new TypeError('Cycle bounds and kill cursor cannot be combined');
  }
  if (hasStart || hasEnd) {
    if (
      !Number.isInteger(startFrame) ||
      !Number.isInteger(endFrame) ||
      startFrame < 0 ||
      endFrame <= startFrame
    ) {
      throw new TypeError('A non-empty half-open healing interval is required');
    }
    return {
      kind: 'cycle',
      fps: normalizedFps,
      startFrame,
      endFrame,
      killCursor: null,
      durationMs: ((endFrame - startFrame) * 1000) / normalizedFps,
    };
  }
  if (killCursor != null) {
    const normalizedKillCursor = normalizeRuntimeCursor(
      killCursor,
      normalizedFps,
      {
        requireComplete: true,
      }
    );
    if (normalizedKillCursor == null) {
      throw new TypeError('A complete kill runtime cursor is required');
    }
    const suppliedDuration = nonNegativeNumber(durationMs);
    const cursorDuration = nonNegativeNumber(killCursor.timeMs);
    return {
      kind: 'kill',
      fps: normalizedFps,
      startFrame: 0,
      endFrame: null,
      killCursor: normalizedKillCursor,
      durationMs:
        suppliedDuration ??
        cursorDuration ??
        (normalizedKillCursor.absoluteFrame * 1000) / normalizedFps,
    };
  }
  return {
    kind: 'full',
    fps: normalizedFps,
    startFrame: null,
    endFrame: null,
    killCursor: null,
    durationMs: nonNegativeNumber(durationMs) ?? 0,
  };
}

function healingEventWithinScope(event, scope) {
  if (scope.kind === 'full') return true;
  const cursor = normalizeRuntimeCursor(event, scope.fps);
  if (cursor == null) return false;
  if (scope.kind === 'cycle') {
    return (
      cursor.absoluteFrame >= scope.startFrame &&
      cursor.absoluteFrame < scope.endFrame
    );
  }
  return compareRuntimeCursors(cursor, scope.killCursor) <= 0;
}

function normalizeRuntimeCursor(value, fps, { requireComplete = false } = {}) {
  const absoluteFrame = integerOrNull(value?.absoluteFrame);
  const timeMs = finiteNumberOrNull(value?.timeMs);
  const resolvedFrame =
    absoluteFrame ??
    (timeMs == null ? null : Math.round((timeMs * Number(fps)) / 1000));
  if (resolvedFrame == null) return null;
  const runtimePhasePriority = finiteNumberOrNull(value?.runtimePhasePriority);
  const runtimePriority = finiteNumberOrNull(value?.runtimePriority);
  const runtimeSequenceIndex = finiteNumberOrNull(value?.runtimeSequenceIndex);
  if (
    requireComplete &&
    (runtimePhasePriority == null ||
      runtimePriority == null ||
      runtimeSequenceIndex == null)
  ) {
    return null;
  }
  return {
    absoluteFrame: resolvedFrame,
    runtimePhasePriority: runtimePhasePriority ?? 0,
    runtimePriority: runtimePriority ?? 0,
    runtimeSequenceIndex: runtimeSequenceIndex ?? CURSOR_MISSING_SEQUENCE,
  };
}

function compareRuntimeCursors(left, right) {
  return (
    left.absoluteFrame - right.absoluteFrame ||
    left.runtimePhasePriority - right.runtimePhasePriority ||
    left.runtimePriority - right.runtimePriority ||
    left.runtimeSequenceIndex - right.runtimeSequenceIndex
  );
}

function normalizeHealSettlement(event, actionIdMap) {
  const payload = event?.payload ?? {};
  const suppliedRequested = firstFiniteNumber(
    payload.requestedChange,
    payload.requestedHeal
  );
  const suppliedEffective = firstFiniteNumber(
    payload.appliedHeal,
    payload.change
  );
  const suppliedOverheal = nonNegativeNumber(payload.overheal);
  const effectiveHealing = Math.max(0, suppliedEffective ?? 0);
  const requestedHealing = Math.max(
    0,
    effectiveHealing,
    suppliedRequested ?? effectiveHealing + (suppliedOverheal ?? 0)
  );
  const rawActionId = textOrNull(event?.actionId ?? payload.sourceActionId);
  return {
    requestedHealing,
    effectiveHealing,
    overhealing: Math.max(0, requestedHealing - effectiveHealing),
    settlementCount: 1,
    sourceActorId: textOrNull(event?.actorId ?? payload.sourceActorId),
    sourceActionId: remapActionId(rawActionId, actionIdMap),
  };
}

function remapActionId(actionId, actionIdMap) {
  if (actionId == null || actionIdMap == null) return actionId;
  const mapped =
    typeof actionIdMap.get === 'function'
      ? actionIdMap.get(actionId)
      : actionIdMap[actionId];
  return textOrNull(mapped) ?? actionId;
}

function createSourceActionIdentity(settlement) {
  if (settlement.sourceActionId != null) return settlement.sourceActionId;
  return `actionless|${settlement.sourceActorId ?? 'unattributed'}`;
}

function createHealingAccumulator() {
  return {
    requestedHealing: 0,
    effectiveHealing: 0,
    overhealing: 0,
    settlementCount: 0,
  };
}

function accumulateHealing(target, settlement) {
  target.requestedHealing += Number(settlement.requestedHealing) || 0;
  target.effectiveHealing += Number(settlement.effectiveHealing) || 0;
  target.overhealing += Number(settlement.overhealing) || 0;
  target.settlementCount += Number(settlement.settlementCount) || 0;
}

function finalizeContributionRows(rows, durationMs) {
  return [...rows.values()]
    .map(row => ({
      ...row,
      requestedHealing: roundMetric(row.requestedHealing),
      effectiveHealing: roundMetric(row.effectiveHealing),
      overhealing: roundMetric(row.overhealing),
      effectiveHps: calculateEffectiveHps(row.effectiveHealing, durationMs),
    }))
    .sort((left, right) => left.identity.localeCompare(right.identity, 'en'));
}

function calculateEffectiveHps(effectiveHealing, durationMs) {
  const durationSeconds = Number(durationMs) / 1000;
  return durationSeconds > 0
    ? roundMetric(Number(effectiveHealing) / durationSeconds)
    : 0;
}

function firstFiniteNumber(...values) {
  for (const value of values) {
    const normalized = finiteNumberOrNull(value);
    if (normalized != null) return normalized;
  }
  return null;
}

function finiteNumberOrNull(value) {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function nonNegativeNumber(value) {
  const normalized = finiteNumberOrNull(value);
  return normalized != null && normalized >= 0 ? normalized : null;
}

function positiveNumber(value) {
  const normalized = finiteNumberOrNull(value);
  return normalized != null && normalized > 0 ? normalized : null;
}

function integerOrNull(value) {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const normalized = Number(value);
  return Number.isInteger(normalized) ? normalized : null;
}

function textOrNull(value) {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized === '' ? null : normalized;
}

function roundMetric(value) {
  return Number(Number(value ?? 0).toFixed(8));
}
