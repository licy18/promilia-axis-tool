import { normalizeActionHitCriticalPolicy } from './combatCriticalPolicy';

export function normalizeActionHitOverrides(value = null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([identity, override]) => {
        const hitIdentity = normalizeText(identity);
        if (!hitIdentity || !override || typeof override !== 'object') {
          return null;
        }
        const criticalPolicy =
          override.criticalPolicy == null
            ? null
            : normalizeActionHitCriticalPolicy(override.criticalPolicy);
        return [
          hitIdentity,
          {
            willHit:
              override.willHit == null ? true : Boolean(override.willHit),
            ...(criticalPolicy ? { criticalPolicy } : {}),
          },
        ];
      })
      .filter(Boolean)
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
  );
}

export function resolveActionHitWillHit(
  action,
  hitIdentity,
  defaultWillHit = true
) {
  const identity = normalizeText(hitIdentity);
  if (!identity) return Boolean(defaultWillHit);
  const override = action?.hitOverrides?.[identity];
  return override?.willHit == null
    ? Boolean(defaultWillHit)
    : Boolean(override.willHit);
}

function normalizeText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}
