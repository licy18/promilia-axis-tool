import { msToFrame } from '../domain/timebase';
import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization';

export const MACHINE_AXIS_SEARCH_STATE_SCHEMA_VERSION = 1;
export const MACHINE_AXIS_SEARCH_STATE_CONTRACT = 'AzPrMachineAxisSearchState';

const STATE_HASH_EXCLUDED_KEYS = new Set([
  'currentFrame',
  'timeMs',
  'remainingFrames',
  'damage',
]);

export function createSearchStateSnapshot({
  run,
  currentFrame = null,
  fps = 60,
} = {}) {
  const trace = run?.trace ?? {};
  const state = trace.state?.final ?? {};
  const timeMs = frameToTimeMs(currentFrame, fps, trace);
  const durationFrames =
    positiveIntegerOrNull(currentFrame) ??
    msToFrame(trace.scenario?.durationMs ?? 0);
  const activeActorId = deriveActiveActorId(trace);
  const snapshot = {
    schemaVersion: MACHINE_AXIS_SEARCH_STATE_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_SEARCH_STATE_CONTRACT,
    kind: 'azpr-machine-axis-search-state',
    currentFrame: Math.max(0, durationFrames),
    timeMs: roundMetric(timeMs),
    remainingFrames: Math.max(
      0,
      msToFrame(trace.scenario?.durationMs ?? 0) - durationFrames
    ),
    fps,
    activeActorId,
    actors: normalizeActorEnergy(state.actorEnergy ?? []),
    kibos: normalizeKiboEnergy(state.kiboEnergy ?? []),
    cooldowns: normalizeCooldownWindows(
      trace.readiness?.cooldownWindows ?? [],
      timeMs
    ),
    effects: normalizeEffectIntervals(trace.effects?.intervals ?? [], timeMs),
    tuningMarks: normalizeTuningMarkStacks(trace.resources?.tuningMarks ?? []),
    enemy: normalizeEnemyState(state.enemy ?? {}),
    damage: {
      hpDamage: numberOrZero(run?.evaluation?.totals?.hpDamage),
      toughnessDamage: numberOrZero(run?.evaluation?.totals?.toughnessDamage),
      combatHitCount: numberOrZero(run?.evaluation?.totals?.combatHitCount),
      stateEventCount: numberOrZero(run?.evaluation?.totals?.stateEventCount),
    },
  };
  return snapshot;
}

export function hashSearchState(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new TypeError('search state snapshot is required');
  }
  const projection = {};
  for (const [key, value] of Object.entries(snapshot)) {
    if (!STATE_HASH_EXCLUDED_KEYS.has(key)) {
      projection[key] = value;
    }
  }
  return hashCanonicalValue(projection);
}

export function searchStatesEquivalent(left, right) {
  if (!left || !right) return false;
  return hashSearchState(left) === hashSearchState(right);
}

export function deriveActiveActorId(trace) {
  const controlled = trace?.controlledActors ?? {};
  const transitions = controlled.transitions ?? [];
  const lastApplied = [...transitions]
    .reverse()
    .find(transition => transition.applied === true);
  return (
    lastApplied?.afterActorId ??
    controlled.initialActorId ??
    trace?.scenario?.actorIds?.[0] ??
    null
  );
}

export function createSearchEventBoundaryNodes({
  run,
  durationFrames = null,
  burstWindowMs = null,
} = {}) {
  const trace = run?.trace ?? {};
  const fps = Number(trace.scenario?.frameRate) || 60;
  const horizonFrames =
    positiveIntegerOrNull(durationFrames) ??
    msToFrame(trace.scenario?.durationMs ?? 0);
  const nodes = [];
  const seen = new Set();
  const add = (frame, kind, details = {}) => {
    const frameNumber = Number(frame);
    if (!Number.isInteger(frameNumber) || frameNumber < 0) return;
    if (frameNumber > horizonFrames) return;
    const key = `${kind}|${frameNumber}|${details.actionId ?? ''}|${details.skillId ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    nodes.push({
      frame: frameNumber,
      timeMs: roundMetric(frameNumber * (1000 / fps)),
      kind,
      ...details,
      description: describeBoundary(kind, details, frameNumber),
    });
  };
  for (const entry of trace.executionPlan?.actions ?? []) {
    if (entry.execute === false) continue;
    const start = Number(entry.startMs);
    const span = Number(entry.durationMs);
    if (!Number.isFinite(start) || !Number.isFinite(span) || span <= 0) {
      continue;
    }
    add(msToFrame(start + span), 'action-end', {
      actionId: entry.actionId ?? null,
    });
  }
  for (const cooldownWindow of trace.readiness?.cooldownWindows ?? []) {
    const endMs = Number(cooldownWindow.endMs);
    if (!Number.isFinite(endMs)) continue;
    add(msToFrame(endMs), 'cd-ready', {
      actionId: cooldownWindow.actionId ?? null,
      skillId: cooldownWindow.skillId ?? null,
      ownerId: cooldownWindow.ownerId ?? null,
    });
  }
  for (const event of [
    ...(trace.effects?.events ?? []),
    ...(trace.resources?.tuningMarks ?? []),
  ]) {
    const timeMs = Number(event.timeMs);
    if (!Number.isFinite(timeMs)) continue;
    add(msToFrame(timeMs), 'state-change', {
      actionId: event.actionId ?? null,
      effectId: event.effectId ?? null,
      markId: event.markId ?? null,
    });
  }
  const windowFrames =
    burstWindowMs != null && Number.isFinite(Number(burstWindowMs))
      ? Math.max(1, Math.round((Number(burstWindowMs) * fps) / 1000))
      : null;
  if (windowFrames != null && windowFrames > 0) {
    for (let frame = 0; frame <= horizonFrames; frame += windowFrames) {
      add(frame, 'window-boundary');
    }
  }
  add(horizonFrames, 'horizon');
  return nodes.sort((left, right) => {
    if (left.frame !== right.frame) return left.frame - right.frame;
    return left.kind.localeCompare(right.kind, 'en');
  });
}

function frameToTimeMs(currentFrame, fps, trace) {
  if (positiveIntegerOrNull(currentFrame) != null) {
    return Number(currentFrame) * (1000 / fps);
  }
  const plan = trace.executionPlan?.actions ?? [];
  const lastEnd = plan.reduce((latest, entry) => {
    if (entry.execute === false) return latest;
    const end = Number(entry.startMs) + Number(entry.durationMs);
    return Number.isFinite(end) && end > latest ? end : latest;
  }, 0);
  return lastEnd;
}

function normalizeActorEnergy(rows) {
  return rows
    .map(entry => ({
      actorId: String(entry.actorId ?? ''),
      sp: roundMetric(numberOrZero(entry.currentValue)),
      max: roundMetric(numberOrZero(entry.maxValue)),
    }))
    .filter(entry => entry.actorId)
    .sort((left, right) => left.actorId.localeCompare(right.actorId, 'en'));
}

function normalizeKiboEnergy(rows) {
  return rows
    .map(entry => ({
      actorId: String(entry.actorId ?? ''),
      kiboId: entry.kiboId ?? null,
      energy: roundMetric(numberOrZero(entry.currentValue)),
      max: roundMetric(numberOrZero(entry.maxValue)),
    }))
    .filter(entry => entry.actorId && entry.kiboId != null)
    .sort((left, right) => {
      const actorOrder = left.actorId.localeCompare(right.actorId, 'en');
      return actorOrder || Number(left.kiboId) - Number(right.kiboId);
    });
}

function normalizeCooldownWindows(rows, timeMs) {
  return rows
    .map(entry => ({
      actionId: entry.actionId ?? null,
      ownerId: entry.ownerId ?? null,
      skillId: entry.skillId ?? null,
      endMs: roundMetric(numberOrZero(entry.endMs)),
      startMs: roundMetric(numberOrZero(entry.startMs)),
      status: entry.status ?? null,
      active: Number(entry.endMs) > timeMs,
    }))
    .filter(entry => entry.active)
    .sort((left, right) => {
      const ownerOrder = String(left.ownerId ?? '').localeCompare(
        String(right.ownerId ?? ''),
        'en'
      );
      if (ownerOrder !== 0) return ownerOrder;
      const skillOrder = Number(left.skillId ?? 0) - Number(right.skillId ?? 0);
      return skillOrder || left.endMs - right.endMs;
    });
}

function normalizeEffectIntervals(rows, timeMs) {
  return rows
    .map(entry => ({
      effectId: entry.effectId ?? null,
      targetId: entry.targetId ?? null,
      stacks: numberOrZero(
        entry.stacks ?? entry.stackCount ?? entry.stackAfter
      ),
      startMs: roundMetric(numberOrZero(entry.startMs)),
      endMs: roundMetric(numberOrZero(entry.endMs)),
      active: Number(entry.startMs) <= timeMs && Number(entry.endMs) > timeMs,
    }))
    .filter(entry => entry.active && entry.effectId)
    .sort((left, right) => {
      const effectOrder = String(left.effectId).localeCompare(
        String(right.effectId),
        'en'
      );
      if (effectOrder !== 0) return effectOrder;
      const targetOrder = String(left.targetId ?? '').localeCompare(
        String(right.targetId ?? ''),
        'en'
      );
      return targetOrder || left.endMs - right.endMs;
    });
}

function normalizeTuningMarkStacks(rows) {
  const byMark = new Map();
  for (const event of rows) {
    const key = `${String(event.profileKey ?? '')}|${Number(event.markId) || 0}`;
    if (event.after == null) continue;
    byMark.set(key, {
      profileKey: event.profileKey ?? null,
      markId: event.markId ?? null,
      stacks: numberOrZero(event.after),
    });
  }
  return [...byMark.values()].sort((left, right) => {
    const profileOrder = String(left.profileKey ?? '').localeCompare(
      String(right.profileKey ?? ''),
      'en'
    );
    return profileOrder || Number(left.markId ?? 0) - Number(right.markId ?? 0);
  });
}

function normalizeEnemyState(enemy) {
  return {
    toughness: roundMetric(numberOrZero(enemy.toughness)),
    maxToughness: roundMetric(numberOrZero(enemy.maxToughness)),
    inBreak: enemy.inBreak === true,
    breakElapsedMs: roundMetric(numberOrZero(enemy.breakElapsedMs)),
    recoveryDelayRemainingMs: roundMetric(
      numberOrZero(enemy.recoveryDelayRemainingMs)
    ),
    defeated: Number(enemy.hp) <= 0,
  };
}

function describeBoundary(kind, details, frame) {
  switch (kind) {
    case 'action-end':
      return `action ${details.actionId ?? ''} ends at frame ${frame}`;
    case 'cd-ready':
      return `cooldown ready at frame ${frame} (skill ${details.skillId ?? ''})`;
    case 'state-change':
      return `state change at frame ${frame} (effect ${details.effectId ?? ''} / mark ${details.markId ?? ''})`;
    case 'window-boundary':
      return `burst window boundary at frame ${frame}`;
    case 'horizon':
      return `scenario horizon at frame ${frame}`;
    default:
      return `${kind} at frame ${frame}`;
  }
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function roundMetric(value) {
  return Math.round(Number(value) * 1000) / 1000;
}
