export function projectActiveEffectModifiers({
  interval,
  effectEvents = [],
  timeMs,
} = {}) {
  if (!interval || !Array.isArray(effectEvents)) return [];
  const boundaryTimeMs = finiteNumberOrDefault(timeMs, 0);
  const intervalStartMs = finiteNumberOrDefault(interval.startMs, 0);
  const intervalEndMs = finiteNumberOrDefault(
    interval.endMs,
    Number.POSITIVE_INFINITY
  );
  const candidates = effectEvents
    .filter(event => {
      const eventTimeMs = finiteNumberOrDefault(
        event.timeMs,
        Number.NEGATIVE_INFINITY
      );
      return (
        event.effectId === interval.effectId &&
        sameOptionalIdentity(event.targetId, interval.targetId) &&
        sameOptionalIdentity(event.ownerId, interval.ownerId) &&
        eventTimeMs >= intervalStartMs &&
        eventTimeMs <= boundaryTimeMs &&
        eventTimeMs < intervalEndMs &&
        Array.isArray(event.modifiers) &&
        event.modifiers.length > 0
      );
    })
    .sort(compareEffectEvents);
  return normalizeEffectModifiers(candidates.at(-1)?.modifiers ?? []);
}

export function projectActiveEffectStates({
  intervals = [],
  effectEvents = [],
  timeMs,
} = {}) {
  const boundaryTimeMs = finiteNumberOrDefault(timeMs, 0);
  const activeByIdentity = new Map();
  if (intervals.length === 0) {
    for (const event of [...effectEvents].sort(compareEffectEvents)) {
      const eventTimeMs = finiteNumberOrDefault(
        event?.timeMs,
        Number.POSITIVE_INFINITY
      );
      if (eventTimeMs > boundaryTimeMs) break;
      const beforeIdentity = createEffectStateIdentity(event, event.before);
      const afterIdentity = createEffectStateIdentity(event, event.after);
      const operation = String(event.operation ?? '').toLowerCase();
      if (['expire', 'remove', 'consume'].includes(operation)) {
        deleteMatchingEffectState(activeByIdentity, beforeIdentity, event);
        continue;
      }
      if (operation === 'transfer' && beforeIdentity) {
        deleteMatchingEffectState(activeByIdentity, beforeIdentity, event);
      }
      const expiresAtMs = finiteNumberOrNull(event.after?.expiresAtMs);
      // Persistent effects keep their existing dedicated boundary-state path.
      if (
        !event.after ||
        expiresAtMs == null ||
        expiresAtMs <= boundaryTimeMs
      ) {
        continue;
      }
      activeByIdentity.set(afterIdentity, {
        effectId: event.effectId ?? null,
        ownerId: event.ownerId ?? null,
        targetKind: event.targetKind ?? null,
        targetId: event.after.targetId ?? event.targetId ?? null,
        stacks: Number(event.after.stacks) || 0,
        startMs: eventTimeMs,
        endMs: expiresAtMs,
        sourceIdentity: event.sourceIdentity ?? null,
        modifiers: normalizeEffectModifiers(event.modifiers),
      });
    }
  }

  for (const interval of intervals) {
    const intervalEndMs = finiteNumberOrNull(interval.endMs);
    if (
      intervalEndMs == null ||
      Number(interval.startMs) > boundaryTimeMs ||
      intervalEndMs <= boundaryTimeMs
    ) {
      continue;
    }
    const identity = createEffectStateIdentity(interval, interval);
    activeByIdentity.set(identity, {
      effectId: interval.effectId ?? null,
      ownerId: interval.ownerId ?? null,
      targetKind: interval.targetKind ?? null,
      targetId: interval.targetId ?? null,
      stacks:
        Number(interval.stacks ?? interval.stackCount ?? interval.stackAfter) ||
        0,
      startMs: finiteNumberOrDefault(interval.startMs, 0),
      endMs: intervalEndMs,
      sourceIdentity: interval.sourceIdentity ?? null,
      modifiers: projectActiveEffectModifiers({
        interval,
        effectEvents,
        timeMs: boundaryTimeMs,
      }),
    });
  }

  return [...activeByIdentity.values()]
    .filter(state => state.effectId)
    .sort(compareCanonicalRows);
}

export function normalizeEffectModifiers(modifiers = []) {
  return modifiers
    .map(modifier => ({
      kind: modifier.kind ?? null,
      attributeId: integerOrNull(modifier.attributeId),
      bucket: modifier.bucket ?? null,
      valueRaw: finiteNumberOrNull(modifier.valueRaw),
      formulaFamily: modifier.formulaFamily ?? null,
      formulaValue: finiteNumberOrNull(modifier.formulaValue),
    }))
    .sort(compareCanonicalRows);
}

function sameOptionalIdentity(left, right) {
  return left == null || right == null || String(left) === String(right);
}

function createEffectStateIdentity(event, state) {
  return String(
    state?.effectInstanceId ??
      event?.intervalId ??
      [
        event?.ownerId ?? '',
        event?.effectId ?? '',
        state?.targetId ?? event?.targetId ?? '',
      ].join('|')
  );
}

function deleteMatchingEffectState(activeByIdentity, identity, event) {
  if (identity && activeByIdentity.delete(identity)) return;
  for (const [key, state] of activeByIdentity) {
    if (
      state.effectId === event.effectId &&
      sameOptionalIdentity(state.targetId, event.targetId)
    ) {
      activeByIdentity.delete(key);
    }
  }
}

function compareEffectEvents(left, right) {
  return (
    finiteNumberOrDefault(left?.timeMs, 0) -
      finiteNumberOrDefault(right?.timeMs, 0) ||
    finiteNumberOrDefault(left?.runtimeSequenceIndex, 0) -
      finiteNumberOrDefault(right?.runtimeSequenceIndex, 0) ||
    String(left?.eventId ?? '').localeCompare(
      String(right?.eventId ?? ''),
      'en'
    )
  );
}

function compareCanonicalRows(left, right) {
  return JSON.stringify(left).localeCompare(JSON.stringify(right), 'en');
}

function integerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function finiteNumberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function finiteNumberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
