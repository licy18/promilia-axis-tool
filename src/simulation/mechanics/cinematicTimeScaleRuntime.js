import { getVerifiedCombatActionMapping } from '../../data/verifiedCombatMechanicsPackage';

export const CINEMATIC_TIME_SCALE_RUNTIME_CONTRACT_NAME =
  'AzPrCinematicTimeScaleRuntime';

const DEFAULT_FRAME_RATE = 60;

export function createCinematicTimeScaleRuntime({
  scenario = null,
  actionExecutionPlan = null,
} = {}) {
  const executionByActionId = new Map(
    (actionExecutionPlan?.actions ?? []).map(entry => [entry.actionId, entry])
  );
  const disabledByRuntimeMode =
    scenario?.combatScenario?.multiplayerOnline === true ||
    scenario?.combatScenario?.kiboBattle === true;
  const windows = [];
  const unresolved = [];

  for (const action of scenario?.actions ?? []) {
    if (executionByActionId.get(action.id)?.execute === false) continue;
    const mapping = getVerifiedCombatActionMapping(action);
    const binding = mapping?.cinematicTimeScale;
    if (!binding) continue;
    // Client disables CullEntityTimeScaleBehavior entirely in multiplayer and
    // Kibo-battle modes. Missing single-player cinematic evidence therefore
    // cannot block a mode where the behavior is not installed at runtime.
    if (disabledByRuntimeMode) continue;
    if (binding.status === 'unresolved') {
      unresolved.push({
        actionId: action.id,
        skillId: action.skillId ?? null,
        reasons: binding.reasons ?? ['cinematic-time-scale-unresolved'],
      });
      continue;
    }
    if (binding.applied !== true) continue;
    for (const source of binding.windows ?? []) {
      const frameRate = positiveNumber(source.frameRate, DEFAULT_FRAME_RATE);
      const startFrame = nonNegativeNumber(source.startFrame);
      const durationFrames = positiveNumber(source.durationFrames, null);
      if (durationFrames == null) continue;
      const startMs = roundValue(
        nonNegativeNumber(action.startMs) + (startFrame * 1000) / frameRate
      );
      const endMs = roundValue(startMs + (durationFrames * 1000) / frameRate);
      windows.push({
        actionId: action.id,
        actorId: action.actorId ?? null,
        skillId: action.skillId ?? null,
        actionKind: mapping.actionKind ?? action.actionKind ?? null,
        startMs,
        endMs,
        durationMs: roundValue(endMs - startMs),
        startFrame,
        durationFrames,
        frameRate,
        scaleMode: source.scaleMode ?? 'curve',
        campTypeFilter: source.campTypeFilter ?? null,
        campTypeFilterName: source.campTypeFilterName ?? null,
        entityTypeFilter: source.entityTypeFilter ?? null,
        entityTypeFilterNames: source.entityTypeFilterNames ?? [],
        affectsEnemyMonsterClock: source.affectsEnemyMonsterClock === true,
        affectsPlayerHeroClock: source.affectsPlayerHeroClock === true,
        sourceIdentity: source.sourceIdentity ?? null,
      });
    }
  }

  windows.sort(compareWindows);
  const enemyPauseWindows = mergePauseWindows(
    windows.filter(
      window =>
        window.scaleMode === 'paused' &&
        window.affectsEnemyMonsterClock === true
    )
  );
  const playerHeroPauseWindows = mergePauseWindows(
    windows.filter(
      window =>
        window.scaleMode === 'paused' && window.affectsPlayerHeroClock === true
    )
  );
  return {
    schemaVersion: 1,
    contractName: CINEMATIC_TIME_SCALE_RUNTIME_CONTRACT_NAME,
    status:
      unresolved.length > 0
        ? 'cinematic-time-scale-runtime-unresolved'
        : windows.length > 0
          ? 'cinematic-time-scale-runtime-ready'
          : disabledByRuntimeMode
            ? 'cinematic-time-scale-runtime-disabled-by-client-mode'
            : 'cinematic-time-scale-runtime-ready-no-windows',
    wallClockPolicy: 'continues',
    scoreClockPolicy: 'wall-time-includes-cinematic-window',
    dungeonTimerPolicy: 'continues-without-pause-world',
    actorClockPolicy: 'client-camp-and-entity-filtered',
    enemyClockPolicy: 'pause-during-filtered-zero-scale-window',
    actionOccupancyPolicy: 'unchanged',
    disabledByRuntimeMode,
    windows,
    enemyPauseWindows,
    playerHeroPauseWindows,
    unresolved,
    complete: unresolved.length === 0,
    applied: enemyPauseWindows.length > 0 || playerHeroPauseWindows.length > 0,
    summary: {
      actionWindowCount: windows.length,
      enemyPauseWindowCount: enemyPauseWindows.length,
      enemyPausedDurationMs: roundValue(
        enemyPauseWindows.reduce(
          (sum, window) => sum + (window.endMs - window.startMs),
          0
        )
      ),
      playerHeroPauseWindowCount: playerHeroPauseWindows.length,
      unresolvedActionCount: unresolved.length,
    },
  };
}

export function advanceEnemyClockTime(runtime, startMs, durationMs) {
  return advanceClockTime(runtime?.enemyPauseWindows, startMs, durationMs);
}

export function advanceClockTime(pauseWindows, startMs, durationMs) {
  let current = nonNegativeNumber(startMs);
  let remaining = nonNegativeNumber(durationMs);
  if (remaining <= 0) return roundValue(current);

  for (const window of pauseWindows ?? []) {
    const start = nonNegativeNumber(window.startMs);
    const end = Math.max(start, nonNegativeNumber(window.endMs));
    if (end <= current) continue;
    if (start > current) {
      const activeBeforeWindow = start - current;
      if (remaining <= activeBeforeWindow) {
        return roundValue(current + remaining);
      }
      remaining -= activeBeforeWindow;
      current = start;
    }
    if (current < end) current = end;
  }
  return roundValue(current + remaining);
}

export function isEnemyClockPausedAt(runtime, timeMs) {
  const time = nonNegativeNumber(timeMs);
  return (runtime?.enemyPauseWindows ?? []).some(
    window => time >= Number(window.startMs) && time < Number(window.endMs)
  );
}

function mergePauseWindows(windows) {
  const merged = [];
  for (const window of [...windows].sort(compareWindows)) {
    const previous = merged.at(-1);
    if (!previous || Number(window.startMs) > Number(previous.endMs)) {
      merged.push({
        startMs: window.startMs,
        endMs: window.endMs,
        durationMs: roundValue(window.endMs - window.startMs),
        sourceActionIds: [window.actionId],
        sourceSkillIds: [window.skillId],
        sourceIdentities: [window.sourceIdentity].filter(Boolean),
      });
      continue;
    }
    previous.endMs = Math.max(Number(previous.endMs), Number(window.endMs));
    previous.durationMs = roundValue(previous.endMs - previous.startMs);
    previous.sourceActionIds = uniqueStrings([
      ...previous.sourceActionIds,
      window.actionId,
    ]);
    previous.sourceSkillIds = uniqueNumbers([
      ...previous.sourceSkillIds,
      window.skillId,
    ]);
    previous.sourceIdentities = uniqueStrings([
      ...previous.sourceIdentities,
      window.sourceIdentity,
    ]);
  }
  return merged;
}

function compareWindows(left, right) {
  return (
    Number(left.startMs) - Number(right.startMs) ||
    Number(left.endMs) - Number(right.endMs) ||
    String(left.actionId ?? '').localeCompare(String(right.actionId ?? '')) ||
    String(left.sourceIdentity ?? '').localeCompare(
      String(right.sourceIdentity ?? '')
    )
  );
}

function uniqueStrings(values) {
  return [...new Set(values.map(value => String(value ?? '')).filter(Boolean))];
}

function uniqueNumbers(values) {
  return [
    ...new Set(values.map(Number).filter(value => Number.isFinite(value))),
  ];
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function nonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function roundValue(value) {
  return Number(Number(value).toFixed(6));
}
