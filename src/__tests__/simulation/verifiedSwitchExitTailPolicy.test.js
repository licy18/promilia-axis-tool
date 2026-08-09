import { beforeEach, describe, expect, it } from 'vitest';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import {
  ACTOR_SWITCH_EXIT_TAIL_UNRESOLVED,
  KIBO_SWITCH_EXIT_TAIL_UNRESOLVED,
  attachVerifiedSwitchExitTailPolicies,
  createVerifiedSwitchExitTailPolicy,
  isVerifiedSwitchExitTailPolicy,
} from '../../simulation/generation/verifiedSwitchExitTailPolicy';

function createMapping({ hits = ['hit'], effects = [] } = {}) {
  return {
    identity: 'fixture-mapping',
    controlSkillId: 100,
    complete: true,
    selectedHitIdentities: hits,
    selectedEffectIdentities: effects,
  };
}

function createPackage({ hits = [], effects = [] } = {}) {
  return {
    packageId: 'fixture-package',
    packageHash: 'fixture-package-hash',
    controlBindings: [
      {
        controlSkillId: 100,
        applied: true,
        hits,
        effects,
      },
    ],
  };
}

function createPolicy({
  ownerKind = 'actor',
  mapping = createMapping(),
  mechanicsPackage = createPackage({
    hits: [
      {
        hitIdentity: 'hit',
        trigger: { startFrame: 30, sourceIdentity: 'direct-hit@30' },
      },
    ],
  }),
  actionPath = [0],
  switchPath = [1],
  actionStartFrame = 0,
  boundaryFrame = 20,
} = {}) {
  return createVerifiedSwitchExitTailPolicy({
    ownerKind,
    actionId: 'action',
    ownerActorId: 'actor-a',
    actionStartFrame,
    actionDurationFrames: 60,
    actionSourceSequencePath: actionPath,
    mapping,
    mechanicsPackage,
    switchActionId: 'switch-a-b',
    switchBoundaryFrame: boundaryFrame,
    switchBoundarySourceSequencePath: switchPath,
    switchToActorId: 'actor-b',
  });
}

describe('verified switch-exit tail policy', () => {
  beforeEach(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
  });

  it('fails closed for a future actor-bound hit instead of blanket-finishing the old skill', () => {
    const policy = createPolicy();
    expect(policy).toMatchObject({
      ownerKind: 'actor',
      status: ACTOR_SWITCH_EXIT_TAIL_UNRESOLVED,
      evidenceClosed: false,
      rejectionCode: ACTOR_SWITCH_EXIT_TAIL_UNRESOLVED,
      packetEvidence: [
        expect.objectContaining({
          packetIdentity: 'hit',
          settlementFrame: 30,
          disposition: 'future-owner-bound-packet-unresolved',
        }),
      ],
    });
  });

  it('retains a detached projectile launched before exit exactly as a canonical continuation', () => {
    const policy = createPolicy({
      ownerKind: 'kibo',
      mechanicsPackage: createPackage({
        hits: [
          {
            hitIdentity: 'hit',
            trigger: {
              kind: 'projectile-impact',
              launchFrame: 10,
              impactFrame: 30,
              sourceIdentity: 'projectile@10->30',
            },
          },
        ],
      }),
    });
    expect(policy).toMatchObject({
      ownerKind: 'kibo',
      status: 'detached-packet-continuation-closed',
      evidenceClosed: true,
      rejectionCode: null,
      packetEvidence: [
        expect.objectContaining({
          materializationFrame: 10,
          settlementFrame: 30,
          disposition: 'detached-packet-retained',
        }),
      ],
    });
  });

  it('retains an effect materialized before exit without reactivating the old owner', () => {
    const policy = createPolicy({
      mapping: createMapping({ hits: [], effects: ['field'] }),
      mechanicsPackage: createPackage({
        effects: [
          {
            effectIdentity: 'field',
            trigger: { startFrame: 10, sourceIdentity: 'field@10' },
          },
        ],
      }),
    });
    expect(policy).toMatchObject({
      status: 'pre-materialized-effect-continuation-closed',
      evidenceClosed: true,
      packetEvidence: [
        expect.objectContaining({
          packetKind: 'effect',
          disposition: 'pre-materialized-effect-retained',
        }),
      ],
    });
  });

  it('uses source order only when input materialization occurs at the exact switch frame', () => {
    const hitAtBoundary = createPackage({
      hits: [
        {
          hitIdentity: 'hit',
          trigger: { startFrame: 0, sourceIdentity: 'hit@input-boundary' },
        },
      ],
    });
    expect(
      createPolicy({
        mechanicsPackage: hitAtBoundary,
        actionStartFrame: 20,
      })
    ).toMatchObject({
      status: 'accepted-continuation-has-no-post-switch-packet',
      packetEvidence: [
        expect.objectContaining({
          settlementBoundaryOrder: 'action-input-source-order',
          disposition: 'settled-before-switch',
        }),
      ],
    });
    expect(
      createPolicy({
        mechanicsPackage: hitAtBoundary,
        actionStartFrame: 20,
        actionPath: [2],
        switchPath: [1],
      }).status
    ).toBe(ACTOR_SWITCH_EXIT_TAIL_UNRESOLVED);
    expect(
      createPolicy({
        mechanicsPackage: hitAtBoundary,
        actionStartFrame: 20,
        actionPath: null,
      }).status
    ).toBe(ACTOR_SWITCH_EXIT_TAIL_UNRESOLVED);
  });

  it('fails closed when a delayed actor-bound packet lands on the switch frame without packet-phase evidence', () => {
    const policy = createPolicy({
      mechanicsPackage: createPackage({
        hits: [
          {
            hitIdentity: 'hit',
            trigger: { startFrame: 20, sourceIdentity: 'delayed-hit@boundary' },
          },
        ],
      }),
    });

    expect(policy).toMatchObject({
      status: ACTOR_SWITCH_EXIT_TAIL_UNRESOLVED,
      evidenceClosed: false,
      packetEvidence: [
        expect.objectContaining({
          settlementBoundaryOrder: 'delayed-packet-order-unresolved',
          disposition: 'future-owner-bound-packet-unresolved',
        }),
      ],
    });
  });

  it('uses owner-specific stable blockers and grants authority only to compiler-attached policies', () => {
    const kibo = createPolicy({ ownerKind: 'kibo' });
    expect(kibo.status).toBe(KIBO_SWITCH_EXIT_TAIL_UNRESOLVED);
    expect(isVerifiedSwitchExitTailPolicy(kibo)).toBe(false);

    const actor = {
      id: 'actor-a',
      characterId: 101007,
      loadout: { kiboId: 500001 },
    };
    const attached = attachVerifiedSwitchExitTailPolicies({
      actions: [
        {
          id: 'auto-before-switch',
          type: 'kiboEvent',
          actorId: actor.id,
          actor,
          kiboId: 500001,
          skillId: 504003,
          eventType: 'normal-attack',
          actionKind: 'normal-attack',
          startMs: 0,
          durationMs: 2500,
          sourceSequencePath: [0],
        },
        {
          id: 'switch-a-b',
          type: 'switch',
          actorId: actor.id,
          targetActorId: 'actor-b',
          startMs: 500,
          sourceSequencePath: [1],
        },
      ],
      actors: [actor, { id: 'actor-b', characterId: 101010 }],
      team: {
        slots: [
          { slotId: 'slot-a', actorId: actor.id },
          { slotId: 'slot-b', actorId: 'actor-b' },
        ],
      },
      initialRuntimeState: {
        controlledActor: { actorId: actor.id, characterId: 101007 },
      },
      time: { fps: 60 },
    })[0].switchExitTailPolicy;

    expect(isVerifiedSwitchExitTailPolicy(attached)).toBe(true);
    expect(isVerifiedSwitchExitTailPolicy(structuredClone(attached))).toBe(
      false
    );
    expect(
      isVerifiedSwitchExitTailPolicy({
        ...attached,
        switchBoundaryFrame: attached.switchBoundaryFrame + 1,
      })
    ).toBe(false);
  });
});
