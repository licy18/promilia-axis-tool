import { describe, expect, it } from 'vitest';
import { selectConfiguredCriticalProbeEvents } from '../../../scripts/character-acceptance/critical-probe-acceptance.mjs';

describe('configured critical acceptance probes', () => {
  const events = [
    criticalHit('before', 'shared-hit'),
    criticalHit('after', 'shared-hit'),
    {
      actionId: 'mixed-action',
      eventType: 'VERIFIED_TUNING_DAMAGE',
      elementId: 251,
      formula: { status: 'verified-tuning-formula-applied' },
    },
    criticalHit('mixed-action', 'peer-hit'),
  ];

  it('selects the configured before, after, and non-crittable peers exactly', () => {
    expect(
      selectConfiguredCriticalProbeEvents(
        events,
        {
          preHitAttributeChange: {
            beforeActionId: 'before',
            afterActionId: 'after',
            hitIdentity: 'shared-hit',
          },
          nonCrittable: {
            actionId: 'mixed-action',
            eventType: 'VERIFIED_TUNING_DAMAGE',
            elementId: 251,
          },
        },
        'fallback-hit'
      )
    ).toEqual({
      preHitBefore: events[0],
      preHitAfter: events[1],
      nonCrittable: events[2],
      nonCrittablePeer: events[3],
    });
  });

  it('fails closed for a wrong hit identity or an incomplete non-crittable selector', () => {
    const wrongHit = selectConfiguredCriticalProbeEvents(events, {
      preHitAttributeChange: {
        beforeActionId: 'before',
        afterActionId: 'after',
        hitIdentity: 'wrong-hit',
      },
    });
    expect(wrongHit.preHitBefore).toBeNull();
    expect(wrongHit.preHitAfter).toBeNull();

    for (const nonCrittable of [
      { eventType: 'VERIFIED_TUNING_DAMAGE', elementId: 251 },
      { actionId: 'mixed-action', elementId: 251 },
      { actionId: 'mixed-action', eventType: 'VERIFIED_TUNING_DAMAGE' },
    ]) {
      expect(
        selectConfiguredCriticalProbeEvents(events, { nonCrittable })
          .nonCrittable
      ).toBeNull();
    }
  });
});

function criticalHit(actionId, hitIdentity) {
  return {
    actionId,
    hitIdentity,
    eventType: 'VERIFIED_COMBAT_HIT',
    formula: { randomBranch: { critical: false } },
  };
}
