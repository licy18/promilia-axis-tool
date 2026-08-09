export function selectConfiguredCriticalProbeEvents(
  damageEvents = [],
  probe = {},
  fallbackHitIdentity = null
) {
  const events = Array.isArray(damageEvents) ? damageEvents : [];
  const preHit = probe?.preHitAttributeChange ?? null;
  const preHitIdentity = preHit?.hitIdentity ?? fallbackHitIdentity;
  const preHitBefore = preHit
    ? findConfiguredCriticalHit(events, preHit.beforeActionId, preHitIdentity)
    : null;
  const preHitAfter = preHit
    ? findConfiguredCriticalHit(events, preHit.afterActionId, preHitIdentity)
    : null;
  const nonCrittableProbe = probe?.nonCrittable ?? null;
  const nonCrittable = nonCrittableProbe
    ? (events.find(event =>
        configuredNonCrittableMatches(event, nonCrittableProbe)
      ) ?? null)
    : null;
  const nonCrittablePeer = nonCrittable
    ? (events.find(
        event =>
          event.actionId === nonCrittable.actionId &&
          event.eventType === 'VERIFIED_COMBAT_HIT' &&
          event.formula?.randomBranch
      ) ?? null)
    : null;
  return { preHitBefore, preHitAfter, nonCrittable, nonCrittablePeer };
}

function findConfiguredCriticalHit(events, actionId, hitIdentity) {
  if (typeof actionId !== 'string' || !actionId.trim()) return null;
  return (
    events.find(
      event =>
        event.actionId === actionId &&
        event.eventType === 'VERIFIED_COMBAT_HIT' &&
        (hitIdentity == null || event.hitIdentity === hitIdentity)
    ) ?? null
  );
}

function configuredNonCrittableMatches(event, probe) {
  return (
    typeof probe.actionId === 'string' &&
    probe.actionId.length > 0 &&
    typeof probe.eventType === 'string' &&
    probe.eventType.length > 0 &&
    Number.isInteger(Number(probe.elementId)) &&
    event.actionId === probe.actionId &&
    event.eventType === probe.eventType &&
    Number(event.elementId) === Number(probe.elementId)
  );
}
