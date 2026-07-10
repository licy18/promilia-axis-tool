export function createRuntimeEffectReview({
  effectTimeline = null,
  selectedTimeMs = null,
  selectedEventId = '',
} = {}) {
  const events = [...(effectTimeline?.events ?? [])].sort(
    (left, right) =>
      Number(left.timeMs) - Number(right.timeMs) ||
      Number(left.runtimeSequenceIndex) - Number(right.runtimeSequenceIndex)
  );
  const explicitEventIndex = selectedEventId
    ? events.findIndex(event => event.eventId === selectedEventId)
    : -1;
  const hasSelectedTime =
    selectedTimeMs != null &&
    selectedTimeMs !== '' &&
    Number.isFinite(Number(selectedTimeMs));
  const selectedTime = hasSelectedTime ? Number(selectedTimeMs) : null;
  const reviewEventIndex =
    explicitEventIndex >= 0
      ? explicitEventIndex
      : hasSelectedTime
        ? findLastEventIndexAtOrBefore(events, selectedTime)
        : events.length - 1;
  const reviewTimeMs =
    explicitEventIndex >= 0
      ? Number(events[explicitEventIndex].timeMs)
      : hasSelectedTime
        ? selectedTime
        : Number(events[reviewEventIndex]?.timeMs ?? 0);
  const activeByInstanceKey = new Map();

  events.forEach((event, index) => {
    const included =
      explicitEventIndex >= 0
        ? index <= explicitEventIndex
        : Number(event.timeMs) <= reviewTimeMs;
    if (!included) {
      return;
    }
    if (event.after?.active !== false && event.after?.instanceKey) {
      activeByInstanceKey.set(
        event.after.instanceKey,
        cloneEffect(event.after)
      );
      return;
    }
    if (event.instanceKey) {
      activeByInstanceKey.delete(event.instanceKey);
    }
  });

  const selectedEvent = events[reviewEventIndex] ?? null;
  const activeEffects = [...activeByInstanceKey.values()].sort(
    (left, right) =>
      compareOptionalNumber(left.expiresAtMs, right.expiresAtMs) ||
      left.instanceKey.localeCompare(right.instanceKey)
  );

  return {
    status:
      events.length > 0
        ? 'runtime-effect-review-ready'
        : 'runtime-effect-review-ready-no-events',
    reviewTimeMs,
    selectedEventId: selectedEvent?.eventId ?? '',
    selectedEvent,
    events,
    activeEffects,
    summary: {
      eventCount: events.length,
      activeEffectCount: activeEffects.length,
      reviewEventIndex,
      followsRuntimeStatePoint: hasSelectedTime && explicitEventIndex < 0,
      appliedToCalculators: false,
    },
  };
}

function findLastEventIndexAtOrBefore(events, timeMs) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (Number(events[index].timeMs) <= timeMs) {
      return index;
    }
  }
  return -1;
}

function cloneEffect(effect) {
  return {
    ...effect,
    tags: [...(effect.tags ?? [])],
    modifiers: (effect.modifiers ?? []).map(modifier => ({ ...modifier })),
  };
}

function compareOptionalNumber(left, right) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  const hasLeft = Number.isFinite(leftNumber);
  const hasRight = Number.isFinite(rightNumber);
  if (hasLeft && hasRight) {
    return leftNumber - rightNumber;
  }
  if (hasLeft) {
    return -1;
  }
  if (hasRight) {
    return 1;
  }
  return 0;
}
