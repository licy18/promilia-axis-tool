import { EFFECT_RUNTIME_EVENT_TYPES } from '../runtime/effectRuntimeTimeline';

export const EFFECT_INTERVAL_PROJECTION_CONTRACT_NAME =
  'AzPrEffectIntervalProjection';

export function projectEffectRuntimeIntervals({
  effectTimeline = null,
  durationMs = 0,
  frameRate = 60,
} = {}) {
  const scenarioEndMs = normalizeScenarioEndMs(durationMs);
  const activeIntervals = new Map();
  const intervalCountByInstanceKey = new Map();
  const intervals = [];
  const events = [...(effectTimeline?.events ?? [])].sort(compareEffectEvents);

  for (const event of events) {
    const instanceKey = String(event?.instanceKey ?? '').trim();
    if (!instanceKey) {
      continue;
    }

    if (
      event.type === EFFECT_RUNTIME_EVENT_TYPES.INHERITED ||
      event.type === EFFECT_RUNTIME_EVENT_TYPES.APPLIED
    ) {
      const existing = activeIntervals.get(instanceKey);
      if (existing) {
        intervals.push(
          finalizeEffectInterval(existing, event.timeMs, {
            frameRate,
            scenarioEndMs,
            terminationType: 'EFFECT_REAPPLIED',
            activeAtScenarioEnd: false,
          })
        );
      }
      activeIntervals.set(
        instanceKey,
        createOpenEffectInterval(
          event,
          nextIntervalIndex(intervalCountByInstanceKey, instanceKey)
        )
      );
      continue;
    }

    if (event.type === EFFECT_RUNTIME_EVENT_TYPES.REFRESHED) {
      const interval =
        activeIntervals.get(instanceKey) ??
        createOpenEffectInterval(
          event,
          nextIntervalIndex(intervalCountByInstanceKey, instanceKey),
          event.before?.appliedAtMs
        );
      appendEffectIntervalEvent(interval, event);
      activeIntervals.set(instanceKey, interval);
      continue;
    }

    if (
      event.type === EFFECT_RUNTIME_EVENT_TYPES.REMOVED ||
      event.type === EFFECT_RUNTIME_EVENT_TYPES.EXPIRED
    ) {
      const interval = activeIntervals.get(instanceKey);
      if (!interval) {
        continue;
      }
      appendEffectIntervalEvent(interval, event);
      activeIntervals.delete(instanceKey);
      intervals.push(
        finalizeEffectInterval(interval, event.timeMs, {
          frameRate,
          scenarioEndMs,
          terminationType: event.type,
          activeAtScenarioEnd: false,
        })
      );
    }
  }

  for (const interval of activeIntervals.values()) {
    intervals.push(
      finalizeEffectInterval(interval, scenarioEndMs, {
        frameRate,
        scenarioEndMs,
        terminationType: null,
        activeAtScenarioEnd: true,
      })
    );
  }

  const visibleIntervals = intervals
    .filter(interval => interval.startMs <= scenarioEndMs)
    .sort(compareEffectIntervals);
  const timelineIntervals = visibleIntervals.filter(
    interval => !interval.tags.includes('tuning-mark-resource-mirror')
  );
  const timelineHiddenResourceMirrorCount =
    visibleIntervals.length - timelineIntervals.length;

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-effect-interval-projection',
    contractName: EFFECT_INTERVAL_PROJECTION_CONTRACT_NAME,
    status:
      visibleIntervals.length > 0
        ? 'effect-interval-projection-ready'
        : 'effect-interval-projection-ready-no-intervals',
    durationMs: scenarioEndMs,
    frameRate: normalizeFrameRate(frameRate),
    intervals: visibleIntervals,
    timelineIntervals,
    summary: {
      eventCount: events.length,
      intervalCount: visibleIntervals.length,
      timelineIntervalCount: timelineIntervals.length,
      timelineHiddenResourceMirrorCount,
      actorTargetIntervalCount: visibleIntervals.filter(
        interval => interval.targetKind === 'actor'
      ).length,
      enemyTargetIntervalCount: visibleIntervals.filter(
        interval => interval.targetKind === 'enemy'
      ).length,
      completedIntervalCount: visibleIntervals.filter(
        interval => !interval.activeAtScenarioEnd
      ).length,
      activeAtScenarioEndCount: visibleIntervals.filter(
        interval => interval.activeAtScenarioEnd
      ).length,
      persistentIntervalCount: visibleIntervals.filter(
        interval => interval.persistent
      ).length,
      calculatorAppliedIntervalCount: visibleIntervals.filter(
        interval => interval.appliedToCalculators
      ).length,
      appliedToCalculators: false,
    },
    appliedToCalculators: false,
  };
}

function createOpenEffectInterval(event, intervalIndex, requestedStartMs) {
  const startMs = finiteNumberOrDefault(
    requestedStartMs,
    finiteNumberOrDefault(event.timeMs, 0)
  );
  const interval = {
    intervalId: `${event.instanceKey}|interval-${intervalIndex}`,
    instanceKey: event.instanceKey,
    effectId: event.effectId ?? event.after?.effectId ?? event.before?.effectId,
    effectName:
      event.effectName ?? event.after?.effectName ?? event.before?.effectName,
    icon: event.icon ?? event.after?.icon ?? event.before?.icon ?? null,
    confidence:
      event.confidence ??
      event.after?.confidence ??
      event.before?.confidence ??
      null,
    trackingStatus:
      event.trackingStatus ??
      event.after?.trackingStatus ??
      event.before?.trackingStatus ??
      null,
    tags: uniqueValues(
      event.tags ?? event.after?.tags ?? event.before?.tags ?? []
    ),
    sourceStatus:
      event.sourceStatus ??
      event.after?.sourceStatus ??
      event.before?.sourceStatus ??
      null,
    sourceIdentity:
      cloneSourceIdentity(
        event.sourceIdentity ??
          event.after?.sourceIdentity ??
          event.before?.sourceIdentity
      ) ?? null,
    targetKind:
      event.targetKind ?? event.after?.targetKind ?? event.before?.targetKind,
    targetId: event.targetId ?? event.after?.targetId ?? event.before?.targetId,
    targetName:
      event.targetName ?? event.after?.targetName ?? event.before?.targetName,
    startMs,
    sourceActionIds: [],
    sourceActorIds: [],
    lifecycleEvents: [],
    peakStacks: 0,
    maxStacks: 1,
  };
  appendEffectIntervalEvent(interval, event);
  return interval;
}

function appendEffectIntervalEvent(interval, event) {
  if (!interval.lifecycleEvents.some(item => item.eventId === event.eventId)) {
    interval.lifecycleEvents.push(event);
  }
  if (event.actionId && !interval.sourceActionIds.includes(event.actionId)) {
    interval.sourceActionIds.push(event.actionId);
  }
  if (event.actorId && !interval.sourceActorIds.includes(event.actorId)) {
    interval.sourceActorIds.push(event.actorId);
  }
  interval.effectName = event.effectName || interval.effectName;
  interval.icon = event.icon || interval.icon;
  interval.confidence = event.confidence || interval.confidence;
  interval.trackingStatus = event.trackingStatus || interval.trackingStatus;
  interval.tags = uniqueValues([
    ...interval.tags,
    ...(event.tags ?? event.after?.tags ?? event.before?.tags ?? []),
  ]);
  interval.sourceStatus = event.sourceStatus || interval.sourceStatus;
  interval.sourceIdentity =
    cloneSourceIdentity(event.sourceIdentity) ?? interval.sourceIdentity;
  interval.targetName = event.targetName || interval.targetName;
  interval.peakStacks = Math.max(
    interval.peakStacks,
    Number(event.stackBefore) || 0,
    Number(event.stackAfter) || 0
  );
  interval.maxStacks = Math.max(
    interval.maxStacks,
    Number(event.before?.maxStacks) || 0,
    Number(event.after?.maxStacks) || 0,
    interval.peakStacks
  );
}

function finalizeEffectInterval(
  interval,
  requestedEndMs,
  { frameRate, scenarioEndMs, terminationType, activeAtScenarioEnd }
) {
  const endMs = Math.min(
    scenarioEndMs,
    Math.max(
      interval.startMs,
      finiteNumberOrDefault(requestedEndMs, scenarioEndMs)
    )
  );
  const lifecycleEvents = [...interval.lifecycleEvents].sort(
    compareEffectEvents
  );
  const lastEvent = lifecycleEvents[lifecycleEvents.length - 1] ?? null;
  const lastState = lastEvent?.after ?? lastEvent?.before ?? null;
  const appliedToCalculators = lifecycleEvents.some(
    event =>
      event.appliedToCalculators === true ||
      event.after?.appliedToCalculators === true ||
      event.before?.appliedToCalculators === true
  );
  const persistent = activeAtScenarioEnd && lastState?.expiresAtMs == null;
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-effect-interval',
    intervalId: interval.intervalId,
    instanceKey: interval.instanceKey,
    effectId: interval.effectId,
    effectName: interval.effectName || interval.effectId,
    icon: interval.icon ?? null,
    confidence: interval.confidence ?? null,
    trackingStatus: interval.trackingStatus ?? null,
    tags: [...interval.tags],
    sourceStatus: interval.sourceStatus ?? null,
    sourceIdentity: cloneSourceIdentity(interval.sourceIdentity),
    targetKind: interval.targetKind,
    targetId: interval.targetId,
    targetName: interval.targetName || interval.targetId,
    startMs: interval.startMs,
    endMs,
    durationMs: Math.max(0, endMs - interval.startMs),
    startFrame: msToFrame(interval.startMs, frameRate),
    endFrame: msToFrame(endMs, frameRate),
    sourceActionId: interval.sourceActionIds[0] ?? null,
    sourceActionIds: [...interval.sourceActionIds],
    sourceActorIds: [...interval.sourceActorIds],
    lifecycleEventIds: lifecycleEvents.map(event => event.eventId),
    lifecycleEvents,
    selectionEventId: lastEvent?.eventId ?? '',
    terminationEventId:
      terminationType === EFFECT_RUNTIME_EVENT_TYPES.REMOVED ||
      terminationType === EFFECT_RUNTIME_EVENT_TYPES.EXPIRED
        ? (lastEvent?.eventId ?? '')
        : '',
    terminationType,
    activeAtScenarioEnd,
    persistent,
    initialStacks:
      Number(lifecycleEvents[0]?.stackAfter) ||
      Number(lifecycleEvents[0]?.after?.stacks) ||
      0,
    finalStacks:
      Number(lastState?.stacks) || Number(lastEvent?.stackAfter) || 0,
    peakStacks: interval.peakStacks,
    maxStacks: interval.maxStacks,
    refreshCount: lifecycleEvents.filter(
      event => event.type === EFFECT_RUNTIME_EVENT_TYPES.REFRESHED
    ).length,
    appliedToCalculators,
  };
}

function cloneSourceIdentity(value) {
  return value && typeof value === 'object'
    ? JSON.parse(JSON.stringify(value))
    : null;
}

function nextIntervalIndex(countByInstanceKey, instanceKey) {
  const nextIndex = (countByInstanceKey.get(instanceKey) ?? 0) + 1;
  countByInstanceKey.set(instanceKey, nextIndex);
  return nextIndex;
}

function compareEffectEvents(left, right) {
  return (
    finiteNumberOrDefault(left?.timeMs, 0) -
      finiteNumberOrDefault(right?.timeMs, 0) ||
    finiteNumberOrDefault(left?.runtimeSequenceIndex, 0) -
      finiteNumberOrDefault(right?.runtimeSequenceIndex, 0) ||
    String(left?.eventId ?? '').localeCompare(String(right?.eventId ?? ''))
  );
}

function compareEffectIntervals(left, right) {
  return (
    left.startMs - right.startMs ||
    left.endMs - right.endMs ||
    left.intervalId.localeCompare(right.intervalId)
  );
}

function normalizeScenarioEndMs(value) {
  return Math.max(0, finiteNumberOrDefault(value, 0));
}

function normalizeFrameRate(value) {
  const frameRate = Number(value);
  return Number.isFinite(frameRate) && frameRate > 0 ? frameRate : 60;
}

function msToFrame(timeMs, frameRate) {
  return Math.round(
    (finiteNumberOrDefault(timeMs, 0) * normalizeFrameRate(frameRate)) / 1000
  );
}

function finiteNumberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function uniqueValues(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}
