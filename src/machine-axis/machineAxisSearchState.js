import { msToFrame } from '../domain/timebase';
import { getVerifiedActionVariantGraph } from '../data/verifiedCombatMechanicsPackage';
import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization';

export const MACHINE_AXIS_SEARCH_STATE_SCHEMA_VERSION = 1;
export const MACHINE_AXIS_SEARCH_STATE_CONTRACT = 'AzPrMachineAxisSearchState';

export function createSearchStateSnapshot({
  run,
  pendingRun = null,
  contract = null,
  currentFrame = null,
  fps = 60,
  stateKind = 'final',
} = {}) {
  const trace = run?.trace ?? {};
  const resolvedFrame =
    nonNegativeIntegerOrNull(currentFrame) ?? deriveExecutionNodeFrame(trace);
  const state =
    stateKind === 'initial'
      ? (trace.state?.initial ?? {})
      : (trace.state?.final ?? {});
  const timeMs = resolvedFrame * (1000 / fps);
  const horizonFrames =
    positiveIntegerOrNull(contract?.scenario?.durationFrames) ??
    msToFrame(trace.scenario?.durationMs ?? 0);
  const activeActorId = deriveActiveActorId(trace);
  const snapshot = {
    schemaVersion: MACHINE_AXIS_SEARCH_STATE_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_SEARCH_STATE_CONTRACT,
    kind: 'azpr-machine-axis-search-state',
    currentFrame: resolvedFrame,
    timeMs: roundMetric(timeMs),
    remainingFrames: Math.max(0, horizonFrames - resolvedFrame),
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
    specialResources: normalizeSpecialResources({
      events: trace.resources?.special ?? [],
      initial: contract?.scenario?.initialRuntimeState?.specialResourcesByActor,
    }),
    pendingEvents: createSearchPendingEventProjection({
      run: pendingRun ?? run,
      currentFrame: resolvedFrame,
    }),
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

export function createSearchLoopClosureProjection(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new TypeError('search state snapshot is required');
  }
  return {
    schemaVersion: MACHINE_AXIS_SEARCH_STATE_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_SEARCH_STATE_CONTRACT,
    kind: 'azpr-machine-axis-search-loop-closure-state',
    activeActorId: snapshot.activeActorId ?? null,
    actors: snapshot.actors ?? [],
    kibos: snapshot.kibos ?? [],
    cooldowns: snapshot.cooldowns ?? [],
    effects: snapshot.effects ?? [],
    tuningMarks: snapshot.tuningMarks ?? [],
    specialResources: snapshot.specialResources ?? [],
    pendingEvents: snapshot.pendingEvents ?? [],
    enemy: snapshot.enemy ?? null,
  };
}

export function hashSearchState(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new TypeError('search state snapshot is required');
  }
  return hashCanonicalValue(snapshot);
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
  variantGraph = getVerifiedActionVariantGraph(),
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
    const key = [
      kind,
      frameNumber,
      details.actionId ?? '',
      details.skillId ?? '',
      details.eventIdentity ?? '',
      details.effectId ?? '',
      details.markId ?? '',
      details.resourceIdentity ?? '',
      details.hitIdentity ?? '',
      details.windowIdentity ?? '',
      details.boundaryRole ?? '',
      details.source ?? '',
    ].join('|');
    if (seen.has(key)) return;
    seen.add(key);
    nodes.push({
      frame: frameNumber,
      resumeFrame: nonNegativeIntegerOrNull(details.resumeFrame) ?? frameNumber,
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
    ...(trace.variants?.stateEvents ?? []),
    ...(trace.state?.targetEvents ?? []),
  ]) {
    const frame = resolveEventFrame(event);
    if (frame == null) continue;
    add(frame, 'state-change', {
      actionId: event.actionId ?? null,
      effectId: event.effectId ?? null,
      markId: event.markId ?? null,
      eventIdentity: event.eventIdentity ?? event.id ?? null,
      resumeFrame: frame + 1,
    });
  }
  for (const event of [
    ...(trace.resources?.actors ?? []),
    ...(trace.resources?.kibos ?? []),
    ...(trace.resources?.special ?? []),
    ...(trace.variants?.resourceEvents ?? []),
  ]) {
    if (!isMeaningfulResourceBoundary(event)) continue;
    const frame = resolveEventFrame(event);
    if (frame == null) continue;
    add(frame, 'resource-change', {
      actionId: event.actionId ?? null,
      actorId: event.actorId ?? null,
      resourceIdentity: resolveResourceEventIdentity(event),
      eventIdentity: event.eventIdentity ?? event.id ?? null,
      resumeFrame: frame + 1,
    });
  }
  for (const event of trace.damage ?? []) {
    const frame = resolveEventFrame(event);
    if (frame == null) continue;
    add(frame, 'hit-settlement', {
      actionId: event.actionId ?? null,
      hitIdentity: event.hitIdentity ?? null,
      resumeFrame: frame + 1,
    });
  }
  for (const selection of trace.variants?.selections ?? []) {
    for (const inputWindow of normalizeVariantWindows(selection)) {
      add(inputWindow.startFrame, 'window-boundary', {
        actionId: selection.actionId ?? null,
        windowIdentity: inputWindow.identity,
        boundaryRole: 'start',
        source: 'verified-action-window',
      });
      add(inputWindow.endFrame, 'window-boundary', {
        actionId: selection.actionId ?? null,
        windowIdentity: inputWindow.identity,
        boundaryRole: 'end',
        source: 'verified-action-window',
      });
    }
  }
  for (const inputWindow of createVerifiedActionWindowBoundaries({
    run,
    graph: variantGraph,
  })) {
    add(inputWindow.frame, 'window-boundary', inputWindow);
  }
  const windowFrames =
    burstWindowMs != null && Number.isFinite(Number(burstWindowMs))
      ? Math.max(1, Math.round((Number(burstWindowMs) * fps) / 1000))
      : null;
  if (windowFrames != null && windowFrames > 0) {
    for (let frame = 0; frame <= horizonFrames; frame += windowFrames) {
      add(frame, 'window-boundary', {
        source: 'objective-burst-window',
      });
    }
  }
  add(horizonFrames, 'horizon');
  return nodes.sort((left, right) => {
    if (left.frame !== right.frame) return left.frame - right.frame;
    return left.kind.localeCompare(right.kind, 'en');
  });
}

export function createSearchResourceThresholdBoundary({
  runs = [],
  resourceIdentity = null,
  currentValue = null,
  requiredValue = null,
  currentFrame = 0,
  durationFrames = null,
} = {}) {
  const normalizedIdentity = String(resourceIdentity ?? '').trim();
  const normalizedCurrent = finiteNumberOrNull(currentValue);
  const normalizedRequired = finiteNumberOrNull(requiredValue);
  const normalizedCurrentFrame = nonNegativeIntegerOrNull(currentFrame) ?? 0;
  const runList = (Array.isArray(runs) ? runs : [runs]).filter(Boolean);
  if (
    !normalizedIdentity ||
    normalizedCurrent == null ||
    normalizedRequired == null ||
    normalizedCurrent >= normalizedRequired ||
    runList.length === 0
  ) {
    return null;
  }
  const trajectories = runList.map(run =>
    createResourceTrajectory({
      run,
      resourceIdentity: normalizedIdentity,
      currentValue: normalizedCurrent,
      currentFrame: normalizedCurrentFrame,
      durationFrames,
    })
  );
  if (trajectories.some(trajectory => !trajectory.hasPositiveGrowth)) {
    return null;
  }
  const candidateFrames = [
    ...new Set(
      trajectories.flatMap(trajectory =>
        trajectory.events
          .filter(event => event.afterValue > event.beforeValue)
          .map(event => event.frame)
      )
    ),
  ].sort((left, right) => left - right);
  for (const frame of candidateFrames) {
    const resumeFrame = frame + 1;
    if (
      frame < normalizedCurrentFrame ||
      trajectories.some(trajectory => resumeFrame > trajectory.horizonFrames)
    ) {
      continue;
    }
    const values = trajectories.map(trajectory =>
      resourceValueAtFrame(trajectory, frame)
    );
    if (values.some(value => value < normalizedRequired)) continue;
    const sourceEvents = trajectories.map(trajectory =>
      [...trajectory.events]
        .reverse()
        .find(
          event => event.frame <= frame && event.afterValue > event.beforeValue
        )
    );
    const fps = trajectories[0].fps;
    return {
      frame,
      resumeFrame,
      timeMs: roundMetric(frame * (1000 / fps)),
      kind: 'resource-threshold',
      resourceIdentity: normalizedIdentity,
      currentValue: roundMetric(normalizedCurrent),
      requiredValue: roundMetric(normalizedRequired),
      reachedValues: values.map(roundMetric),
      source: 'candidate-resource-condition',
      growthSources: sourceEvents.map(event => ({
        eventIdentity: event?.eventIdentity ?? null,
        reason: event?.reason ?? null,
        sourceIdentity: event?.sourceIdentity ?? null,
      })),
      description: `${normalizedIdentity} reaches ${normalizedRequired} at frame ${frame}`,
    };
  }
  return null;
}

export function deriveExecutionNodeFrame(trace) {
  const plan = trace.executionPlan?.actions ?? [];
  return plan.reduce((latest, entry) => {
    if (entry.execute === false) return latest;
    const end = Number(entry.startMs) + Number(entry.durationMs);
    const frame = Number.isFinite(end) ? msToFrame(end) : null;
    return frame != null && frame > latest ? frame : latest;
  }, 0);
}

export function createSearchPendingEventProjection({ run, currentFrame } = {}) {
  const resolvedFrame = nonNegativeIntegerOrNull(currentFrame) ?? 0;
  const trace = run?.trace ?? {};
  const startedActionIds = new Set(
    (run?.actionResolutions ?? [])
      .filter(
        resolution =>
          nonNegativeIntegerOrNull(resolution.startFrame) != null &&
          Number(resolution.startFrame) <= resolvedFrame
      )
      .map(resolution => String(resolution.actionId ?? ''))
      .filter(Boolean)
  );
  const candidates = [
    ...(trace.damage ?? []).map(event => ({ kind: 'hit', event })),
    ...(trace.effects?.events ?? []).map(event => ({ kind: 'effect', event })),
    ...(trace.resources?.tuningMarks ?? []).map(event => ({
      kind: 'tuning-mark',
      event,
    })),
    ...(trace.resources?.special ?? []).map(event => ({
      kind: 'special-resource',
      event,
    })),
    ...(trace.variants?.resourceEvents ?? []).map(event => ({
      kind: 'variant-resource',
      event,
    })),
    ...(trace.variants?.stateEvents ?? []).map(event => ({
      kind: 'variant-state',
      event,
    })),
    ...(trace.state?.targetEvents ?? []).map(event => ({
      kind: 'target-state',
      event,
    })),
  ];
  const projection = [];
  for (const { kind, event } of candidates) {
    const actionId = String(event?.actionId ?? '');
    const frame = resolveEventFrame(event);
    if (
      !actionId ||
      !startedActionIds.has(actionId) ||
      frame == null ||
      frame <= resolvedFrame
    ) {
      continue;
    }
    projection.push({
      kind,
      frame,
      actionId,
      identity:
        event.hitIdentity ??
        event.effectId ??
        event.markId ??
        event.resourceIdentity ??
        event.payload?.resourceIdentity ??
        event.eventIdentity ??
        event.id ??
        null,
      phase: event.phase ?? event.eventPhase ?? null,
      sequence: event.runtimeSequenceIndex ?? event.sourceSequenceIndex ?? null,
    });
  }
  return projection.sort((left, right) => {
    if (left.frame !== right.frame) return left.frame - right.frame;
    const sequenceOrder =
      numberOrZero(left.sequence) - numberOrZero(right.sequence);
    if (sequenceOrder !== 0) return sequenceOrder;
    const kindOrder = left.kind.localeCompare(right.kind, 'en');
    return (
      kindOrder ||
      String(left.identity ?? '').localeCompare(
        String(right.identity ?? ''),
        'en'
      )
    );
  });
}

export function createVerifiedActionWindowBoundaries({ run, graph } = {}) {
  if (!graph || typeof graph !== 'object') return [];
  const resolutions = Array.isArray(run?.actionResolutions)
    ? run.actionResolutions
    : [];
  const windows = [];
  for (const resolution of resolutions) {
    const actionStartFrame = nonNegativeIntegerOrNull(resolution.startFrame);
    const controlSkillId = integerOrNull(resolution.resolvedControlSkillId);
    const subSkillIndex = nonNegativeIntegerOrNull(
      resolution.resolvedSubSkillIndex
    );
    if (
      actionStartFrame == null ||
      controlSkillId == null ||
      subSkillIndex == null
    ) {
      continue;
    }
    const actionId = resolution.actionId ?? null;
    for (const edge of graph.contextEdges ?? []) {
      if (
        edge?.applied !== true ||
        Number(edge.sourceControlSkillId) !== controlSkillId ||
        Number(edge.sourceSubSkillIndex) !== subSkillIndex
      ) {
        continue;
      }
      appendRelativeWindowBoundaries(windows, {
        actionId,
        actionStartFrame,
        inputWindow: edge.inputWindow,
        windowIdentity: edge.edgeIdentity,
        source: 'verified-context-edge',
        inputCommand: edge.inputCommand ?? null,
        targetControlSkillId:
          edge.executionControlSkillId ?? edge.targetControlSkillId ?? null,
        targetSubSkillIndex: edge.targetSubSkillIndex ?? null,
        sourceIdentity: edge.sourceIdentity ?? null,
      });
    }
    for (const chain of graph.attackInputChains ?? []) {
      if (chain?.applied !== true) continue;
      for (const segment of chain.segments ?? []) {
        if (
          segment?.applied !== true ||
          Number(segment.controlSkillId) !== controlSkillId ||
          Number(segment.subSkillIndex) !== subSkillIndex
        ) {
          continue;
        }
        const segmentIdentity = `${chain.chainIdentity}:segment:${segment.sequenceIndex}`;
        appendRelativeWindowBoundaries(windows, {
          actionId,
          actionStartFrame,
          inputWindow: segment.executionTiming?.occupancy?.linkWindow,
          windowIdentity: `${segmentIdentity}:link`,
          source: 'verified-attack-chain-link',
          sourceIdentity:
            segment.executionTiming?.occupancy?.linkWindow?.sourceIdentity ??
            segment.sourceIdentity ??
            null,
        });
        for (const [index, inputWindow] of (
          segment.executionTiming?.windows ?? []
        ).entries()) {
          appendRelativeWindowBoundaries(windows, {
            actionId,
            actionStartFrame,
            inputWindow,
            windowIdentity: `${segmentIdentity}:window:${index}`,
            source: 'verified-action-window',
            sourceIdentity:
              inputWindow.sourceIdentity ?? segment.sourceIdentity ?? null,
          });
        }
        if (
          Number(chain.phaseTransition?.sourceSequenceIndex) ===
          Number(segment.sequenceIndex)
        ) {
          appendRelativeWindowBoundaries(windows, {
            actionId,
            actionStartFrame,
            inputWindow: chain.phaseTransition?.inputWindow,
            windowIdentity: `${chain.chainIdentity}:phase-transition`,
            source: 'verified-attack-chain-transition',
            inputCommand: chain.phaseTransition?.inputCommand ?? null,
            targetChainIdentity:
              chain.phaseTransition?.targetChainIdentity ?? null,
            sourceIdentity: chain.phaseTransition?.sourceIdentity ?? null,
          });
        }
      }
    }
  }
  return dedupeVerifiedActionWindowBoundaries(windows).sort((left, right) => {
    if (left.frame !== right.frame) return left.frame - right.frame;
    if (left.boundaryRole !== right.boundaryRole) {
      return left.boundaryRole === 'start' ? -1 : 1;
    }
    return String(left.windowIdentity).localeCompare(
      String(right.windowIdentity),
      'en'
    );
  });
}

function appendRelativeWindowBoundaries(
  target,
  {
    actionId,
    actionStartFrame,
    inputWindow,
    windowIdentity,
    source,
    inputCommand = null,
    targetControlSkillId = null,
    targetSubSkillIndex = null,
    targetChainIdentity = null,
    sourceIdentity = null,
  } = {}
) {
  const startFrame = nonNegativeIntegerOrNull(inputWindow?.startFrame);
  const endFrame = nonNegativeIntegerOrNull(inputWindow?.endFrame);
  if (startFrame == null || endFrame == null || endFrame <= startFrame) {
    return;
  }
  const common = {
    actionId,
    windowIdentity,
    source,
    inputCommand,
    targetControlSkillId,
    targetSubSkillIndex,
    targetChainIdentity,
    sourceIdentity,
    interval: '[start,end)',
    relativeStartFrame: startFrame,
    relativeEndFrame: endFrame,
  };
  target.push({
    ...common,
    frame: actionStartFrame + startFrame,
    boundaryRole: 'start',
  });
  target.push({
    ...common,
    frame: actionStartFrame + endFrame,
    boundaryRole: 'end',
  });
}

function dedupeVerifiedActionWindowBoundaries(windows) {
  const byIdentity = new Map();
  for (const inputWindow of windows) {
    const key = `${inputWindow.actionId ?? ''}|${inputWindow.windowIdentity ?? ''}|${inputWindow.boundaryRole}|${inputWindow.frame}`;
    if (!byIdentity.has(key)) byIdentity.set(key, inputWindow);
  }
  return [...byIdentity.values()];
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

function normalizeSpecialResources({ events = [], initial = [] } = {}) {
  const byIdentity = new Map();
  for (const entry of initial ?? []) {
    const identity = String(entry.resourceIdentity ?? '');
    if (!identity) continue;
    byIdentity.set(identity, {
      actorId: entry.actorId ?? null,
      resourceIdentity: identity,
      currentValue: roundMetric(numberOrZero(entry.currentValue)),
      maxValue: roundMetric(numberOrZero(entry.maxValue)),
    });
  }
  for (const event of events ?? []) {
    const payload = event.payload ?? event;
    const identity = String(payload.resourceIdentity ?? '');
    if (!identity) continue;
    const existing = byIdentity.get(identity) ?? {};
    byIdentity.set(identity, {
      actorId: event.actorId ?? existing.actorId ?? null,
      resourceIdentity: identity,
      currentValue: roundMetric(
        numberOrZero(
          payload.currentValue ?? payload.afterValue ?? payload.after
        )
      ),
      maxValue: roundMetric(
        numberOrZero(payload.maxValue ?? existing.maxValue)
      ),
    });
  }
  return [...byIdentity.values()].sort((left, right) =>
    left.resourceIdentity.localeCompare(right.resourceIdentity, 'en')
  );
}

function normalizeEnemyState(enemy) {
  return {
    hp: roundMetric(numberOrZero(enemy.hp)),
    maxHp: roundMetric(numberOrZero(enemy.maxHp)),
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

function resolveEventFrame(event) {
  const absoluteFrame = nonNegativeIntegerOrNull(event?.absoluteFrame);
  if (absoluteFrame != null) return absoluteFrame;
  const frameIndex = nonNegativeIntegerOrNull(event?.frameIndex);
  if (frameIndex != null) return frameIndex;
  const timeMs = Number(event?.timeMs);
  return Number.isFinite(timeMs) ? msToFrame(timeMs) : null;
}

function createResourceTrajectory({
  run,
  resourceIdentity,
  currentValue,
  currentFrame,
  durationFrames,
}) {
  const trace = run?.trace ?? {};
  const fps = Number(trace.scenario?.frameRate) || 60;
  const horizonFrames =
    positiveIntegerOrNull(durationFrames) ??
    msToFrame(trace.scenario?.durationMs ?? 0);
  const events = [
    ...(trace.resources?.actors ?? []),
    ...(trace.resources?.kibos ?? []),
    ...(trace.resources?.special ?? []),
    ...(trace.variants?.resourceEvents ?? []),
  ]
    .filter(event => resolveResourceEventIdentity(event) === resourceIdentity)
    .map(event => normalizeResourceTrajectoryEvent(event))
    .filter(Boolean)
    .filter(
      event => event.frame >= currentFrame && event.frame <= horizonFrames
    )
    .sort(compareResourceTrajectoryEvents);
  return {
    fps,
    horizonFrames,
    currentFrame,
    currentValue,
    events,
    hasPositiveGrowth: events.some(
      event => event.afterValue > event.beforeValue
    ),
  };
}

function resolveResourceEventIdentity(event) {
  const payload = event?.payload ?? event ?? {};
  const explicitIdentity = String(
    event?.resourceIdentity ?? payload.resourceIdentity ?? ''
  ).trim();
  if (explicitIdentity) return explicitIdentity;
  const kiboId = positiveIntegerOrNull(event?.kiboId ?? payload.kiboId);
  if (kiboId != null) return `kibo:${kiboId}:sp`;
  const resource = String(event?.resource ?? payload.resource ?? '');
  const actorId = String(event?.actorId ?? payload.actorId ?? '');
  const actorMatch = actorId.match(/^actor-(\d+)$/);
  return resource === 'sp' && actorMatch ? `actor:${actorMatch[1]}:sp` : null;
}

function normalizeResourceTrajectoryEvent(event) {
  const payload = event?.payload ?? event ?? {};
  const frame = resolveEventFrame(event);
  const beforeValue = finiteNumberOrNull(
    event?.beforeValue ?? payload.beforeValue
  );
  const afterValue = finiteNumberOrNull(
    event?.afterValue ??
      payload.afterValue ??
      event?.currentValue ??
      payload.currentValue
  );
  if (frame == null || beforeValue == null || afterValue == null) return null;
  return {
    frame,
    beforeValue,
    afterValue,
    runtimePhasePriority: integerOrNull(event?.runtimePhasePriority) ?? 0,
    runtimePriority: integerOrNull(event?.runtimePriority) ?? 0,
    runtimeSequenceIndex: integerOrNull(event?.runtimeSequenceIndex) ?? 0,
    eventIdentity:
      event?.eventIdentity ?? event?.id ?? event?.hitKey ?? payload.id ?? null,
    reason: event?.reason ?? payload.reason ?? payload.operation ?? null,
    sourceIdentity: event?.sourceIdentity ?? payload.sourceIdentity ?? null,
  };
}

function compareResourceTrajectoryEvents(left, right) {
  if (left.frame !== right.frame) return left.frame - right.frame;
  if (left.runtimePhasePriority !== right.runtimePhasePriority) {
    return left.runtimePhasePriority - right.runtimePhasePriority;
  }
  if (left.runtimePriority !== right.runtimePriority) {
    return left.runtimePriority - right.runtimePriority;
  }
  return left.runtimeSequenceIndex - right.runtimeSequenceIndex;
}

function resourceValueAtFrame(trajectory, frame) {
  let value = trajectory.currentValue;
  for (const event of trajectory.events) {
    if (event.frame > frame) break;
    value = event.afterValue;
  }
  return value;
}

function isMeaningfulResourceBoundary(event) {
  const payload = event?.payload ?? event ?? {};
  const reason = String(event?.reason ?? payload.reason ?? '');
  if (!reason.includes('auto-sp')) return true;
  const before = Number(event?.beforeValue ?? payload.beforeValue);
  const after = Number(event?.afterValue ?? payload.afterValue);
  const max = Number(event?.maxValue ?? payload.maxValue);
  if (!Number.isFinite(before) || !Number.isFinite(after)) return false;
  return Math.floor(before) !== Math.floor(after) || after === max;
}

function normalizeVariantWindows(selection) {
  const candidates = [
    ...(Array.isArray(selection?.inputWindows) ? selection.inputWindows : []),
    ...(Array.isArray(selection?.windows) ? selection.windows : []),
    selection?.inputWindow,
    selection?.linkWindow,
  ].filter(Boolean);
  return candidates
    .map((inputWindow, index) => ({
      startFrame: nonNegativeIntegerOrNull(
        inputWindow.startFrame ?? inputWindow.start
      ),
      endFrame: nonNegativeIntegerOrNull(
        inputWindow.endFrame ?? inputWindow.end
      ),
      identity:
        inputWindow.identity ??
        `${selection?.actionId ?? 'action'}:window:${index}`,
    }))
    .filter(
      inputWindow =>
        inputWindow.startFrame != null &&
        inputWindow.endFrame != null &&
        inputWindow.endFrame >= inputWindow.startFrame
    );
}

function describeBoundary(kind, details, frame) {
  switch (kind) {
    case 'action-end':
      return `action ${details.actionId ?? ''} ends at frame ${frame}`;
    case 'cd-ready':
      return `cooldown ready at frame ${frame} (skill ${details.skillId ?? ''})`;
    case 'state-change':
      return `state change at frame ${frame} (effect ${details.effectId ?? ''} / mark ${details.markId ?? ''})`;
    case 'resource-change':
      return `resource change at frame ${frame} (${details.resourceIdentity ?? details.actorId ?? ''})`;
    case 'hit-settlement':
      return `hit settles at frame ${frame} (${details.hitIdentity ?? ''})`;
    case 'window-boundary':
      return `${details.source ?? 'action'} window ${details.boundaryRole ?? 'boundary'} at frame ${frame}`;
    case 'horizon':
      return `scenario horizon at frame ${frame}`;
    default:
      return `${kind} at frame ${frame}`;
  }
}

function positiveIntegerOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function nonNegativeIntegerOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function integerOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function finiteNumberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function roundMetric(value) {
  return Math.round(Number(value) * 1000) / 1000;
}
