import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';
import {
  createPickupEntityLedger,
  createVerifiedPickupEntityGeneration,
} from '../../simulation/mechanics/verifiedPickupEntityGeneration';

const OWNER_ID = 107002;
const OWNER_ACTOR_ID = 'actor-107002';
const OTHER_ACTOR_ID = 'actor-101010';
const pickupIdentities = [
  'misa-a3-hp-pickup',
  'misa-star-sp-pickup',
  'misa-ultimate-hp-pickup',
  'misa-ultimate-sp-pickup',
];

describe('verified pickup owner action absorb', () => {
  beforeEach(() => {
    installVerifiedCombatMechanicsPackage(createRuntimePackage());
  });

  afterEach(() => {
    clearInstalledVerifiedCombatMechanicsPackage();
  });

  it('does not couple zero-distance projectiles or controlled-actor switches to collection', () => {
    const generation = runGeneration({ includeHeavy: false });

    expect(generation.summary).toMatchObject({
      spawnedEntityCount: 6,
      collectedEntityCount: 0,
      absorbedEntityCount: 0,
      directHpEventCount: 0,
      directSpEventCount: 0,
    });
    expect(generation.entities).toHaveLength(6);
    expect(generation.entities.every(entity => !entity.destroyed)).toBe(true);
    expect(
      generation.events.some(event => event.kind === 'pickup-collected')
    ).toBe(false);
  });

  it('absorbs every listed live owner entity at the sourced action frame even when every hit misses', () => {
    const first = runGeneration({ includeHeavy: true, heavyMiss: true });
    const second = runGeneration({ includeHeavy: true, heavyMiss: true });
    const absorbed = first.events.filter(
      event => event.kind === 'pickup-absorbed'
    );

    expect(first).toEqual(second);
    expect(first.summary).toMatchObject({
      spawnedEntityCount: 6,
      collectedEntityCount: 0,
      absorbedEntityCount: 6,
      absorbAttemptCount: 1,
      absorbBindingCount: 1,
      directHpEventCount: 3,
      directSpEventCount: 3,
      tuningEffectCommandCount: 6,
    });
    expect(absorbed.map(event => event.pickupIdentity)).toEqual([
      'misa-a3-hp-pickup',
      'misa-star-sp-pickup',
      'misa-ultimate-hp-pickup',
      'misa-ultimate-hp-pickup',
      'misa-ultimate-sp-pickup',
      'misa-ultimate-sp-pickup',
    ]);
    expect(
      first.directHpEvents.map(event => [
        event.actionId,
        event.target.id,
        event.collectorActorId,
        event.effect.heal.formula.baseFunctionId,
        event.formulaResult.family,
        event.formulaResult.sourceMaximumHp,
      ])
    ).toEqual([
      [
        'misa-heavy',
        OWNER_ACTOR_ID,
        OWNER_ACTOR_ID,
        104,
        'source-max-hp-ratio-heal',
        32_199,
      ],
      [
        'misa-heavy',
        OWNER_ACTOR_ID,
        OWNER_ACTOR_ID,
        104,
        'source-max-hp-ratio-heal',
        32_199,
      ],
      [
        'misa-heavy',
        OWNER_ACTOR_ID,
        OWNER_ACTOR_ID,
        104,
        'source-max-hp-ratio-heal',
        32_199,
      ],
    ]);
    expect(
      first.directSpEvents.every(
        event =>
          event.actionId === 'misa-heavy' &&
          event.target.id === OWNER_ACTOR_ID &&
          event.effect.directSp.shareType === 2
      )
    ).toBe(true);
    expect(
      first.effectCommands.every(
        command =>
          command.targetId === OWNER_ACTOR_ID &&
          command.maxStacks === 4 &&
          command.durationMs === 24_000 &&
          command.atCapacityPolicy === 'ignore-new-no-refresh'
      )
    ).toBe(true);
  });

  it('does not create an absorb attempt for blocked or foreign-owner actions', () => {
    const blocked = runGeneration({ includeHeavy: true, heavyExecute: false });
    const foreignOwner = runGeneration({
      includeHeavy: true,
      heavyActorId: OTHER_ACTOR_ID,
      heavyCharacterId: 101010,
    });

    for (const generation of [blocked, foreignOwner]) {
      expect(generation.summary).toMatchObject({
        spawnedEntityCount: 6,
        absorbedEntityCount: 0,
        absorbAttemptCount: 0,
        directHpEventCount: 0,
        directSpEventCount: 0,
      });
    }
  });

  it('expires first and excludes same-frame spawns instead of relying on queue insertion order', () => {
    const ledger = createPickupEntityLedger({
      profiles: [
        createLedgerProfile({ lifetimeFrames: 6 }),
        createLedgerProfile({
          pickupIdentity: 'sp-pickup',
          unitId: 480041,
          poolKey: 'summon-id:480041',
          countType: 'SummonId',
        }),
      ],
    });
    const [expiring] = ledger.spawn({
      pickupIdentity: 'hp-pickup',
      ownerActorId: OWNER_ACTOR_ID,
      sourceActionId: 'old-spawn',
      spawnFrame: 0,
    }).entities;
    const [sameFrame] = ledger.spawn({
      pickupIdentity: 'sp-pickup',
      ownerActorId: OWNER_ACTOR_ID,
      sourceActionId: 'same-frame-spawn',
      spawnFrame: 6,
    }).entities;
    const result = ledger.absorbAll({
      frame: 6,
      absorberActorId: OWNER_ACTOR_ID,
      pickupIdentities: ['hp-pickup', 'sp-pickup'],
      sourceActionId: 'heavy',
      triggerIdentity: 'owner-heavy',
      sameFrameSpawnPolicy: 'exclude-same-frame-fail-closed',
    });

    expect(result.absorbed).toEqual([]);
    expect(result.rejected).toEqual([
      expect.objectContaining({
        entityId: sameFrame.entityId,
        status: 'pickup-same-frame-spawn-excluded-fail-closed',
      }),
    ]);
    expect(
      ledger.snapshot().entities.find(entity => entity.entityId === expiring.entityId)
    ).toMatchObject({ destroyed: true, destroyReason: 'natural-expiry' });
    expect(
      ledger.snapshot().entities.find(entity => entity.entityId === sameFrame.entityId)
    ).toMatchObject({ destroyed: false, rewardCount: 0 });
  });

  it('settles each entity once and makes a second or empty heavy action a stable no-op', () => {
    const ledger = createPickupEntityLedger({
      profiles: [createLedgerProfile({ maxCount: 2 })],
    });
    const entities = ledger.spawn({
      pickupIdentity: 'hp-pickup',
      ownerActorId: OWNER_ACTOR_ID,
      sourceActionId: 'spawn',
      spawnFrame: 1,
      count: 2,
    }).entities;
    const first = ledger.absorbAll({
      frame: 10,
      absorberActorId: OWNER_ACTOR_ID,
      pickupIdentities: ['hp-pickup'],
      sourceActionId: 'heavy-1',
    });
    const second = ledger.absorbAll({
      frame: 20,
      absorberActorId: OWNER_ACTOR_ID,
      pickupIdentities: ['hp-pickup'],
      sourceActionId: 'heavy-2',
    });

    expect(first.absorbed.map(row => row.entity.entityId)).toEqual(
      entities.map(entity => entity.entityId)
    );
    expect(first.absorbed.every(row => row.entity.rewardCount === 1)).toBe(
      true
    );
    expect(second.absorbed).toEqual([]);
    expect(second.attemptEvent).toMatchObject({
      candidateEntityCount: 0,
      eligibleEntityCount: 0,
    });
  });
});

function runGeneration({
  includeHeavy,
  heavyExecute = true,
  heavyMiss = false,
  heavyActorId = OWNER_ACTOR_ID,
  heavyCharacterId = OWNER_ID,
}) {
  const sourceActions = [
    createAction('a3-source', 0, 101, OWNER_ACTOR_ID, OWNER_ID),
    createAction('star-source', 17, 102, OWNER_ACTOR_ID, OWNER_ID),
    createAction('ultimate-source', 34, 103, OWNER_ACTOR_ID, OWNER_ID),
  ];
  const heavyAction = createAction(
    'misa-heavy',
    100,
    110,
    heavyActorId,
    heavyCharacterId
  );
  const actions = includeHeavy ? [...sourceActions, heavyAction] : sourceActions;
  const resolutions = new Map(
    actions.map(action => [
      action.id,
      createResolution({
        controlSkillId: action.controlSkillId,
        ownerId: action.characterId,
        miss: action.id === 'misa-heavy' && heavyMiss,
      }),
    ])
  );
  return createVerifiedPickupEntityGeneration({
    scenario: {
      time: { fps: 60, durationMs: 10_000 },
      combatScenario: {
        projectile: { targetDistance: 0, defaultWillHit: true },
        pickups: {
          autoCollect: false,
          movementPolicy: 'no-implicit-movement',
          collectionPolicy: 'owner-source-action-absorb-only',
        },
      },
      initialRuntimeState: { activeEffects: [] },
      actions,
    },
    actionExecutionPlan: {
      actions: actions.map(action => ({
        actionId: action.id,
        execute: action.id === 'misa-heavy' ? heavyExecute : true,
      })),
    },
    actionResolutionById: resolutions,
    controlledActorTimeline: {
      intervals: [
        {
          actorId: OTHER_ACTOR_ID,
          startMs: 0,
          endMs: 10_000,
        },
      ],
    },
  });
}

function createRuntimePackage() {
  const result = structuredClone(mechanicsPackage);
  const profileByIdentity = new Map(
    result.actionVariantGraph.pickupProfiles.map(profile => [
      profile.pickupIdentity,
      profile,
    ])
  );
  result.actionVariantGraph.pickupProfiles = pickupIdentities.map(identity =>
    structuredClone(profileByIdentity.get(identity))
  );
  result.actionVariantGraph.pickupSpawnBindings = [
    createSpawnBinding('a3-spawn', 101, 'misa-a3-hp-pickup', 0, 1, 0),
    createSpawnBinding('star-spawn', 102, 'misa-star-sp-pickup', 0, 1, 0),
    createSpawnBinding(
      'ultimate-hp-spawn',
      103,
      'misa-ultimate-hp-pickup',
      0,
      2,
      20
    ),
    createSpawnBinding(
      'ultimate-sp-spawn',
      103,
      'misa-ultimate-sp-pickup',
      0,
      2,
      21
    ),
  ];
  result.actionVariantGraph.pickupAbsorbBindings = [
    {
      bindingIdentity: 'owner-heavy-absorb',
      ownerId: OWNER_ID,
      controlSkillId: 110,
      subSkillIndex: 0,
      triggerFrame: 0,
      frameRate: 60,
      pickupIdentities,
      collector: 'action-owner',
      settlementGate: 'successful-action-execute',
      requiresHit: false,
      sourceTrackOrder: 15,
      sameFrameSpawnPolicy: 'exclude-same-frame-fail-closed',
      sameFrameExpiryPolicy: 'expire-before-absorb',
      applied: true,
    },
  ];
  return result;
}

function createAction(
  id,
  startMs,
  controlSkillId,
  actorId,
  characterId
) {
  return {
    id,
    type: 'skill',
    actorId,
    characterId,
    controlSkillId,
    startMs,
    level: 1,
    name: id,
    actor: {
      id: actorId,
      characterId,
      name: id,
      stats: { maxHp: 32_199 },
    },
  };
}

function createResolution({ controlSkillId, ownerId, miss }) {
  return {
    ready: true,
    owner: { id: ownerId },
    actionBinding: {
      ownerId,
      controlSkillId,
      selectedSubSkillIndex: 0,
      identity: `binding:${ownerId}:${controlSkillId}`,
    },
    hits: miss ? [] : [{ elementId: 1 }],
    allHits: miss ? [{ elementId: 1 }] : [{ elementId: 1 }],
  };
}

function createSpawnBinding(
  bindingIdentity,
  controlSkillId,
  pickupIdentity,
  triggerFrame,
  count,
  sourceOrder
) {
  return {
    bindingIdentity,
    ownerId: OWNER_ID,
    controlSkillId,
    subSkillIndex: 0,
    pickupIdentity,
    triggerFrame,
    frameRate: 60,
    count,
    sourceOrder,
    requiresHitElementId: null,
    applied: true,
  };
}

function createLedgerProfile(overrides = {}) {
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
