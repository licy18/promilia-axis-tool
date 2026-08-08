import { describe, expect, it } from 'vitest';
import { createPickupEntityLedger } from '../../simulation/mechanics/verifiedPickupEntityGeneration';

describe('verified pickup entity ledger', () => {
  it('uses [spawn + 2F, spawn + 900F) and rejects ghost collection', () => {
    const ledger = createPickupEntityLedger({
      profiles: [createProfile()],
    });
    const [entity] = ledger.spawn({
      pickupIdentity: 'hp-pickup',
      ownerActorId: 'actor-owner',
      sourceActionId: 'a3',
      spawnFrame: 100,
    }).entities;

    expect(
      ledger.collect({
        entityId: 'pickup|missing',
        collectorActorId: 'actor-owner',
        frame: 102,
      }).event.status
    ).toBe('pickup-entity-not-found');
    expect(
      ledger.collect({
        entityId: entity.entityId,
        collectorActorId: 'actor-enemy',
        frame: 102,
        allied: false,
      }).event.status
    ).toBe('pickup-collector-not-allied');
    expect(
      ledger.collect({
        entityId: entity.entityId,
        collectorActorId: 'actor-owner',
        frame: 102,
        distance: 0.01,
      }).event.status
    ).toBe('pickup-collector-outside-radius');

    expect(
      ledger.collect({
        entityId: entity.entityId,
        collectorActorId: 'actor-owner',
        frame: 101,
      }).event.status
    ).toBe('pickup-collision-window-not-open');
    expect(
      ledger.collect({
        entityId: entity.entityId,
        collectorActorId: 'actor-owner',
        frame: 102,
      })
    ).toMatchObject({
      collected: true,
      event: { status: 'pickup-entity-collected', rewardCount: 1 },
    });
    expect(
      ledger.collect({
        entityId: entity.entityId,
        collectorActorId: 'actor-second-ally',
        frame: 102,
      }).event.status
    ).toBe('pickup-entity-already-collected');

    const [rightOpen] = ledger.spawn({
      pickupIdentity: 'hp-pickup',
      ownerActorId: 'actor-owner',
      sourceActionId: 'a3-right-open',
      spawnFrame: 2000,
    }).entities;
    expect(
      ledger.collect({
        entityId: rightOpen.entityId,
        collectorActorId: 'actor-owner',
        frame: 2900,
      }).event.status
    ).toBe('pickup-entity-expired');
    expect(
      ledger.snapshot().events.filter(
        event =>
          event.kind === 'pickup-expired' &&
          event.entityId === rightOpen.entityId
      )
    ).toEqual([
      expect.objectContaining({
        frame: 2900,
        status: 'pickup-entity-expired',
        applied: true,
      }),
    ]);
  });

  it('allows different entities to resolve on the same frame in stable spawn order', () => {
    const ledger = createPickupEntityLedger({
      profiles: [createProfile({ maxCount: 6 })],
    });
    const spawned = ledger.spawn({
      pickupIdentity: 'hp-pickup',
      ownerActorId: 'actor-owner',
      sourceActionId: 'ultimate',
      spawnFrame: 300,
      sourceOrder: 20,
      count: 3,
    }).entities;

    expect(spawned).toHaveLength(3);
    expect(spawned.map(entity => entity.entityId)).toEqual([
      'pickup|hp-pickup|ultimate|300|20|0|1',
      'pickup|hp-pickup|ultimate|300|20|1|2',
      'pickup|hp-pickup|ultimate|300|20|2|3',
    ]);
    expect(
      spawned.map(entity =>
        ledger.collect({
          entityId: entity.entityId,
          collectorActorId: 'actor-owner',
          frame: 302,
        }).collected
      )
    ).toEqual([true, true, true]);
    expect(
      ledger
        .snapshot()
        .events.filter(event => event.kind === 'pickup-collected')
        .map(event => event.entityId)
    ).toEqual(spawned.map(entity => entity.entityId));
  });

  it('keeps pools independent and rejects replacement at an evidenced capacity gap', () => {
    const ledger = createPickupEntityLedger({
      profiles: [
        createProfile({ maxCount: 2 }),
        createProfile({
          pickupIdentity: 'sp-pickup',
          countType: 'SummonId',
          poolKey: 'summon-id:480041',
          unitId: 480041,
          maxCount: 2,
        }),
      ],
    });
    const hp = ledger.spawn({
      pickupIdentity: 'hp-pickup',
      ownerActorId: 'actor-owner',
      sourceActionId: 'ultimate-hp',
      spawnFrame: 400,
      count: 3,
    });
    const sp = ledger.spawn({
      pickupIdentity: 'sp-pickup',
      ownerActorId: 'actor-owner',
      sourceActionId: 'ultimate-sp',
      spawnFrame: 400,
      count: 2,
    });

    expect(hp.entities).toHaveLength(2);
    expect(hp.rejected).toEqual([
      expect.objectContaining({
        status: 'pickup-capacity-rejected-conservative-policy',
        applied: false,
      }),
    ]);
    expect(sp.entities).toHaveLength(2);
    expect(new Set([...hp.entities, ...sp.entities].map(row => row.poolKey))).toEqual(
      new Set([
        'actor-owner|SummonTempData|summon-temp:480042|480042',
        'actor-owner|SummonId|summon-id:480041|480041',
      ])
    );
  });
});

function createProfile(overrides = {}) {
  return {
    pickupIdentity: 'hp-pickup',
    countType: 'SummonTempData',
    poolKey: 'summon-temp:480042',
    unitId: 480042,
    maxCount: 1,
    collisionDelayFrames: 2,
    lifetimeFrames: 900,
    collisionRadius: 0,
    ...overrides,
  };
}
