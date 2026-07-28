import { projectTimelineStateDisplaySeries } from './projectTimelineStateDisplaySeries';

export const VERIFIED_TUNING_MARK_CURVE_PROJECTION_CONTRACT_NAME =
  'AzPrVerifiedTuningMarkCurveProjection';

const TUNING_MARK_VISUALS = Object.freeze({
  fire: { color: '#e97861', shortLabel: '火' },
  water: { color: '#67a9d8', shortLabel: '水' },
  ice: { color: '#83c8d6', shortLabel: '冰' },
  wind: { color: '#72bba1', shortLabel: '风' },
  wood: { color: '#8fbd66', shortLabel: '木' },
  earth: { color: '#c7a55a', shortLabel: '地' },
  thunder: { color: '#a58ac9', shortLabel: '雷' },
  light: { color: '#d6c66e', shortLabel: '光' },
  dark: { color: '#8d83aa', shortLabel: '暗' },
});

export function projectVerifiedTuningMarkCurves({
  tuningMarkRuntime = null,
  durationMs = 0,
} = {}) {
  const duration = nonNegativeNumber(durationMs);
  const events = Array.isArray(tuningMarkRuntime?.events)
    ? tuningMarkRuntime.events
    : [];
  const initialState = Array.isArray(tuningMarkRuntime?.initialState)
    ? tuningMarkRuntime.initialState
    : [];
  const eventsByMarkId = groupEventsByMarkId(events);
  const tracks = initialState.map((state, index) =>
    createTuningMarkTrack({
      state,
      events: eventsByMarkId.get(Number(state.markId)) ?? [],
      durationMs: duration,
      order: index,
    })
  );
  const visibleTracks = tracks.filter(track => track.involved);

  return {
    schemaVersion: 1,
    contractName: VERIFIED_TUNING_MARK_CURVE_PROJECTION_CONTRACT_NAME,
    sourceKind: 'azpr-verified-tuning-mark-runtime-projection',
    status: tuningMarkRuntime
      ? 'verified-tuning-mark-curves-ready'
      : 'verified-tuning-mark-curves-unavailable',
    durationMs: duration,
    tracks,
    visibleTracks,
    summary: {
      profileCount: tracks.length,
      visibleTrackCount: visibleTracks.length,
      markEventCount: events.length,
      valueEventCount: tracks.reduce(
        (sum, track) => sum + track.valueEventCount,
        0
      ),
      semanticNodeCount: tracks.reduce(
        (sum, track) => sum + track.semanticNodeCount,
        0
      ),
      applied: Boolean(tuningMarkRuntime),
    },
    applied: Boolean(tuningMarkRuntime),
  };
}

function createTuningMarkTrack({ state, events, durationMs, order }) {
  const trackKey = `tuningMark:${state.markId}`;
  const timelineEvents = events.filter(isTimelineMarkEvent);
  const valueEvents = timelineEvents.filter(isValueChangingEvent);
  const eventByIdentity = new Map(
    timelineEvents.map(event => [event.eventIdentity, event])
  );
  const initialValue = nonNegativeNumber(state.currentValue);
  const maxValue = positiveNumber(state.maxValue, 5);
  const displaySeries = projectTimelineStateDisplaySeries({
    trackKey,
    initialValue,
    maxValue,
    durationMs,
    semanticClusterMs: 0,
    points: timelineEvents.map((event, eventIndex) => ({
      trackKey,
      sourceDeltaId: event.eventIdentity,
      runtimeSequenceIndex: eventIndex,
      actionId: event.actionId ?? '',
      timeMs: event.timeMs,
      frameIndex: event.frameIndex,
      delta: Number(event.after) - Number(event.before),
      afterValue: event.after,
      semantic: Number(event.before) === Number(event.after),
    })),
  });
  const semanticNodes = displaySeries.semanticNodes.map(node => {
    const sourceEvents = node.sourceDeltaIds
      .map(identity => eventByIdentity.get(identity))
      .filter(Boolean);
    return {
      ...node,
      eventIdentity: sourceEvents.at(-1)?.eventIdentity ?? node.id,
      eventIdentities: sourceEvents.map(event => event.eventIdentity),
      eventKinds: uniqueValues(sourceEvents.map(event => event.kind)),
      sourceIdentity: sourceEvents.at(-1)?.sourceIdentity ?? null,
      sourceEvents,
    };
  });
  const profileKey = String(state.profileKey ?? 'unknown');
  const visual = TUNING_MARK_VISUALS[profileKey] ?? {
    color: '#9ba7ae',
    shortLabel: String(state.elementName ?? '?').slice(0, 1),
  };

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-verified-tuning-mark-curve',
    status: 'verified-tuning-mark-curve-ready',
    order,
    trackKey,
    markId: Number(state.markId),
    profileKey,
    elementName: state.elementName ?? visual.shortLabel,
    label: `${state.elementName ?? visual.shortLabel}印记`,
    shortLabel: visual.shortLabel,
    color: visual.color,
    valueUnit: state.valueUnit ?? 'mark-stacks',
    initialValue,
    currentValue: displaySeries.currentValue,
    maxValue,
    involved: initialValue > 0 || timelineEvents.length > 0,
    valueEventCount: valueEvents.length,
    refreshEventCount: timelineEvents.filter(
      event => event.kind === 'acquire' && event.before === event.after
    ).length,
    simulationPointCount: displaySeries.simulationPointCount,
    displayPointCount: displaySeries.displayPointCount,
    semanticNodeCount: semanticNodes.length,
    linePoints: displaySeries.linePoints,
    semanticNodes,
    valueAtTime: displaySeries.valueAtTime,
  };
}

function groupEventsByMarkId(events) {
  const grouped = new Map();
  for (const event of events) {
    const markId = Number(event?.markId);
    if (!Number.isFinite(markId)) continue;
    const bucket = grouped.get(markId) ?? [];
    bucket.push(event);
    grouped.set(markId, bucket);
  }
  for (const bucket of grouped.values()) {
    bucket.sort(
      (left, right) =>
        nonNegativeNumber(left.timeMs) - nonNegativeNumber(right.timeMs) ||
        nonNegativeNumber(left.frameIndex) -
          nonNegativeNumber(right.frameIndex) ||
        String(left.eventIdentity).localeCompare(String(right.eventIdentity))
    );
  }
  return grouped;
}

function isValueChangingEvent(event) {
  return (
    ['acquire', 'consume', 'expire'].includes(event?.kind) &&
    Number.isFinite(Number(event?.before)) &&
    Number.isFinite(Number(event?.after)) &&
    Number(event.before) !== Number(event.after)
  );
}

function isTimelineMarkEvent(event) {
  if (
    !['acquire', 'consume', 'expire'].includes(event?.kind) ||
    !Number.isFinite(Number(event?.before)) ||
    !Number.isFinite(Number(event?.after))
  ) {
    return false;
  }
  return (
    Number(event.before) !== Number(event.after) ||
    (event.kind === 'acquire' && event.decayDueAtMs != null)
  );
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function nonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
