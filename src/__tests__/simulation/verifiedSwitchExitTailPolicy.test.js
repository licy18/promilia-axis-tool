import { beforeEach, describe, expect, it } from 'vitest';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import { createActionRuleDiagnostics } from '../../simulation/runtime/actionRuleDiagnostics';
import {
  ACTOR_SWITCH_EXIT_TAIL_UNRESOLVED,
  KIBO_SWITCH_EXIT_TAIL_UNRESOLVED,
  applyVerifiedSwitchExitTailSettlement,
  attachVerifiedSwitchExitTailPolicies,
  createVerifiedRuntimeSwitchExitTailAssessment,
  createVerifiedSwitchExitTailPolicy,
  isVerifiedSwitchExitTailPolicy,
} from '../../simulation/generation/verifiedSwitchExitTailPolicy';

function createMapping({
  hits = ['hit'],
  effects = [],
  actionKind = null,
} = {}) {
  return {
    identity: 'fixture-mapping',
    controlSkillId: 100,
    complete: true,
    selectedHitIdentities: hits,
    selectedEffectIdentities: effects,
    ...(actionKind ? { actionKind } : {}),
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

  it('deterministically cancels a known future actor-bound hit after the owner switches out', () => {
    const policy = createPolicy();
    expect(policy).toMatchObject({
      ownerKind: 'actor',
      status: 'owner-bound-tail-cancelled-at-switch-boundary',
      evidenceClosed: true,
      rejectionCode: null,
      packetEvidence: [
        expect.objectContaining({
          packetIdentity: 'hit',
          settlementFrame: 30,
          disposition: 'future-owner-bound-packet-cancelled',
        }),
      ],
      sourceEvidence: expect.objectContaining({
        clientBinarySha256:
          'c60d13795629f0851b1399338f375eb378aef2098515d41841f30ccc3463c22b',
        heroSkillStop: expect.stringContaining(
          'AliveSkillSystem.OnTransmit(case 17) -> InterruptSkill@0x1813ECF90'
        ),
      }),
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

  it.each(['signature', 'break'])(
    'retains a future %s packet because switch-exit is queued behind the current fluent behavior',
    actionKind => {
      const policy = createPolicy({
        ownerKind: 'kibo',
        mapping: createMapping({ actionKind }),
      });

      expect(policy).toMatchObject({
        ownerKind: 'kibo',
        status: 'queued-kibo-fluent-continuation-closed',
        evidenceClosed: true,
        rejectionCode: null,
        packetEvidence: [
          expect.objectContaining({
            packetIdentity: 'hit',
            settlementFrame: 30,
            disposition: 'queued-kibo-fluent-packet-retained',
          }),
        ],
        sourceEvidence: expect.objectContaining({
          kiboQueuedSwitchExit: expect.stringContaining(
            'PetFluentBehaviorSystem.OnSwitchExit@0x1813DBA80'
          ),
          kiboFluentCompletion: expect.stringContaining(
            'Interrupt@0x1813C4000'
          ),
        }),
      });
    }
  );

  it('retains a delayed in-scope kibo packet on the switch frame without requiring packet phase order', () => {
    const policy = createPolicy({
      ownerKind: 'kibo',
      mapping: createMapping({ actionKind: 'signature' }),
      mechanicsPackage: createPackage({
        hits: [
          {
            hitIdentity: 'hit',
            trigger: {
              startFrame: 20,
              sourceIdentity: 'queued-kibo-hit@switch-boundary',
            },
          },
        ],
      }),
    });

    expect(policy).toMatchObject({
      status: 'queued-kibo-fluent-continuation-closed',
      evidenceClosed: true,
      packetEvidence: [
        expect.objectContaining({
          settlementBoundaryOrder: 'delayed-packet-order-unresolved',
          disposition: 'queued-kibo-fluent-packet-retained',
        }),
      ],
    });
  });

  it('keeps an in-scope kibo packet after fluent completion fail-closed', () => {
    const policy = createPolicy({
      ownerKind: 'kibo',
      mapping: createMapping({ actionKind: 'signature' }),
      mechanicsPackage: createPackage({
        hits: [
          {
            hitIdentity: 'hit',
            trigger: {
              startFrame: 70,
              sourceIdentity: 'post-fluent-completion-hit@70',
            },
          },
        ],
      }),
    });

    expect(policy).toMatchObject({
      status: KIBO_SWITCH_EXIT_TAIL_UNRESOLVED,
      evidenceClosed: false,
      packetEvidence: [
        expect.objectContaining({
          actionCompletionFrame: 60,
          disposition: 'future-owner-bound-packet-unresolved',
        }),
      ],
    });
  });

  it('closes every current in-scope kibo mapping inside its fluent occupancy', () => {
    const mappings = mechanicsPackage.actionMappings.filter(
      mapping =>
        mapping.ownerKind === 'kibo' &&
        ['signature', 'break'].includes(mapping.actionKind)
    );

    expect(mappings.length).toBeGreaterThan(0);
    for (const mapping of mappings) {
      const durationFrames = mapping.actionTiming.occupancy.durationFrames;
      const policy = createVerifiedSwitchExitTailPolicy({
        ownerKind: 'kibo',
        actionId: `action-${mapping.identity}`,
        ownerActorId: 'actor-a',
        actionStartFrame: 0,
        actionDurationFrames: durationFrames,
        actionSourceSequencePath: [0],
        mapping,
        mechanicsPackage,
        switchActionId: 'switch-a-b',
        switchBoundaryFrame: 1,
        switchBoundarySourceSequencePath: [1],
        switchToActorId: 'actor-b',
      });

      expect(policy.evidenceClosed, mapping.identity).toBe(true);
      expect(policy.rejectionCode, mapping.identity).toBeNull();
      for (const packet of policy.packetEvidence) {
        expect(packet.actionCompletionFrame, packet.packetIdentity).toBe(
          durationFrames
        );
        const activationFrame = String(packet.triggerKind).includes(
          'projectile'
        )
          ? packet.materializationFrame
          : packet.settlementFrame;
        expect(activationFrame, packet.packetIdentity).toBeLessThan(
          durationFrames
        );
      }
    }
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
    ).toBe('owner-bound-tail-cancelled-at-switch-boundary');
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

  it('does not promote a triggerless unresolved ResourceMap catalog node into an immortal exit tail', () => {
    const policy = createPolicy({
      mapping: {
        ...createMapping({ hits: [], effects: ['catalog-only'] }),
        complete: false,
      },
      mechanicsPackage: createPackage({
        effects: [
          {
            effectIdentity: 'catalog-only',
            trigger: null,
            classification: 'unresolved',
          },
        ],
      }),
      boundaryFrame: 120,
    });

    expect(policy).toMatchObject({
      status: 'settled-before-switch-boundary',
      evidenceClosed: true,
      packetEvidence: [],
    });
  });

  it('still fails closed for an applied effect whose execution frame is missing', () => {
    const policy = createPolicy({
      mapping: createMapping({ hits: [], effects: ['applied-gap'] }),
      mechanicsPackage: createPackage({
        effects: [
          {
            effectIdentity: 'applied-gap',
            trigger: null,
            classification: 'applied',
          },
        ],
      }),
      boundaryFrame: 120,
    });

    expect(policy).toMatchObject({
      status: ACTOR_SWITCH_EXIT_TAIL_UNRESOLVED,
      evidenceClosed: false,
      packetEvidence: [
        expect.objectContaining({
          packetIdentity: 'applied-gap',
          disposition: 'future-owner-bound-packet-unresolved',
        }),
      ],
    });
  });

  it('closes every current actor star-carry after its concrete runtime packets settle', () => {
    const mappings = mechanicsPackage.actionMappings.filter(
      mapping =>
        mapping.ownerKind === 'actor' && mapping.actionKind === 'star-carry'
    );
    const unresolved = mappings
      .map(mapping => ({
        mapping,
        policy: createVerifiedSwitchExitTailPolicy({
          ownerKind: 'actor',
          actionId: `star-carry-${mapping.ownerId}`,
          ownerActorId: `actor-${mapping.ownerId}`,
          actionStartFrame: 0,
          actionDurationFrames:
            mapping.actionTiming?.occupancy?.durationFrames ?? 0,
          actionSourceSequencePath: [0],
          mapping,
          mechanicsPackage,
          switchActionId: `switch-${mapping.ownerId}`,
          switchBoundaryFrame: 1000,
          switchBoundarySourceSequencePath: [1],
          switchToActorId: 'actor-other',
        }),
      }))
      .filter(({ policy }) => !policy.evidenceClosed)
      .map(({ mapping, policy }) => [mapping.identity, policy.status]);

    expect(mappings).toHaveLength(20);
    expect(unresolved).toEqual([]);
  });

  it('has no immortal tail across the current schedulable runtime-ready actor catalog', () => {
    const mappings = mechanicsPackage.actionMappings.filter(
      mapping =>
        mapping.ownerKind === 'actor' &&
        mapping.schedulable === true &&
        mapping.runtimeReady === true
    );
    const unresolved = mappings
      .map(mapping => ({
        mapping,
        policy: createVerifiedSwitchExitTailPolicy({
          ownerKind: 'actor',
          actionId: mapping.identity,
          ownerActorId: `actor-${mapping.ownerId}`,
          actionStartFrame: 0,
          actionDurationFrames:
            mapping.actionTiming?.occupancy?.durationFrames ?? 0,
          actionSourceSequencePath: [0],
          mapping,
          mechanicsPackage,
          switchActionId: `switch-${mapping.ownerId}`,
          switchBoundaryFrame: 10_000,
          switchBoundarySourceSequencePath: [1],
          switchToActorId: 'actor-other',
        }),
      }))
      .filter(({ policy }) => !policy.evidenceClosed)
      .map(({ mapping, policy }) => [mapping.identity, policy.status]);

    expect(mappings).toHaveLength(188);
    expect(unresolved).toEqual([]);
  });

  it('uses the runtime-selected action form instead of the aggregate public-action mapping', () => {
    const actor = {
      id: 'actor-a',
      characterId: 101010,
      loadout: { kiboId: 500001 },
    };
    const attached = attachVerifiedSwitchExitTailPolicies({
      actions: [
        {
          id: 'star-carry',
          type: 'skill',
          actorId: actor.id,
          actor,
          skillId: 10101021,
          actionKind: 'star-carry',
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
      actors: [actor, { id: 'actor-b', characterId: 101007 }],
      team: {
        slots: [
          { slotId: 'slot-a', actorId: actor.id },
          { slotId: 'slot-b', actorId: 'actor-b' },
        ],
      },
      initialRuntimeState: {
        controlledActor: { actorId: actor.id, characterId: 101010 },
      },
      time: { fps: 60 },
    })[0].switchExitTailPolicy;
    const hit = {
      hitIdentity: 'runtime-hit',
      trigger: { startFrame: 5, sourceIdentity: 'runtime-form@5' },
    };
    const assessment = createVerifiedRuntimeSwitchExitTailAssessment({
      policy: attached,
      mechanicsPackage,
      resolution: {
        status: 'verified-combat-action-mechanics-ready',
        ready: true,
        applied: true,
        packageHash: mechanicsPackage.packageHash,
        effectCoverageComplete: false,
        actionBinding: {
          identity: 'runtime-selected-form',
          controlSkillId: 10101021,
          actualDurationFrames: 10,
        },
        controlBinding: {
          controlSkillId: 10101021,
          applied: true,
        },
        hits: [hit],
        effects: [
          {
            effectIdentity: 'aggregate-catalog-gap',
            trigger: null,
            classification: 'unresolved',
          },
        ],
      },
    });

    expect(assessment).toMatchObject({
      status: 'settled-before-switch-boundary',
      evidenceClosed: true,
      runtimeActionBindingIdentity: 'runtime-selected-form',
      runtimeSelectedHitCount: 1,
      runtimeSelectedEffectCount: 0,
      packetEvidence: [
        expect.objectContaining({
          packetIdentity: 'runtime-hit',
          disposition: 'settled-before-switch',
        }),
      ],
    });

    const scenario = {
      formalActionLegality: true,
      time: { fps: 60 },
      actors: [actor, { id: 'actor-b', characterId: 101007 }],
      team: {
        slots: [
          { slotId: 'slot-a', actorId: actor.id },
          { slotId: 'slot-b', actorId: 'actor-b' },
        ],
      },
      actions: attachVerifiedSwitchExitTailPolicies({
        actions: [
          {
            id: 'star-carry',
            type: 'skill',
            actorId: actor.id,
            actor,
            skillId: 10101021,
            actionKind: 'star-carry',
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
        actors: [actor, { id: 'actor-b', characterId: 101007 }],
        team: {
          slots: [
            { slotId: 'slot-a', actorId: actor.id },
            { slotId: 'slot-b', actorId: 'actor-b' },
          ],
        },
        initialRuntimeState: {
          controlledActor: { actorId: actor.id, characterId: 101010 },
        },
        time: { fps: 60 },
      }),
    };
    const compileOnly = createActionRuleDiagnostics({ scenario });
    const runtimeRefined = createActionRuleDiagnostics({
      scenario,
      actionResolutionById: new Map([
        [
          'star-carry',
          {
            status: 'verified-combat-action-mechanics-ready',
            ready: true,
            applied: true,
            packageHash: mechanicsPackage.packageHash,
            effectCoverageComplete: false,
            actionBinding: {
              identity: 'runtime-selected-form',
              controlSkillId: 10101021,
              actualDurationFrames: 10,
            },
            controlBinding: {
              controlSkillId: 10101021,
              applied: true,
            },
            hits: [hit],
            effects: [],
          },
        ],
      ]),
    });
    expect(compileOnly.diagnostics.map(item => item.code)).toContain(
      ACTOR_SWITCH_EXIT_TAIL_UNRESOLVED
    );
    expect(runtimeRefined.diagnostics.map(item => item.code)).not.toContain(
      ACTOR_SWITCH_EXIT_TAIL_UNRESOLVED
    );
  });

  it('removes cancelled owner-bound packets while retaining detached projectiles', () => {
    const actor = {
      id: 'actor-a',
      characterId: 101010,
      loadout: { kiboId: 500001 },
    };
    const policy = attachVerifiedSwitchExitTailPolicies({
      actions: [
        {
          id: 'skill-before-switch',
          type: 'skill',
          actorId: actor.id,
          actor,
          skillId: 10101021,
          actionKind: 'star-carry',
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
      actors: [actor, { id: 'actor-b', characterId: 101007 }],
      team: {
        slots: [
          { slotId: 'slot-a', actorId: actor.id },
          { slotId: 'slot-b', actorId: 'actor-b' },
        ],
      },
      initialRuntimeState: {
        controlledActor: { actorId: actor.id, characterId: 101010 },
      },
      time: { fps: 60 },
    })[0].switchExitTailPolicy;
    const beforeHit = {
      hitIdentity: 'before-hit',
      trigger: { startFrame: 10, sourceIdentity: 'direct@10' },
    };
    const cancelledHit = {
      hitIdentity: 'cancelled-hit',
      trigger: { startFrame: 40, sourceIdentity: 'direct@40' },
    };
    const detachedProjectile = {
      hitIdentity: 'detached-projectile',
      trigger: {
        kind: 'projectile-impact',
        launchFrame: 15,
        impactFrame: 60,
        sourceIdentity: 'projectile@15->60',
      },
    };
    const cancelledEffect = {
      effectIdentity: 'cancelled-effect',
      trigger: { startFrame: 45, sourceIdentity: 'effect@45' },
      classification: 'applied',
    };
    const retainedEffect = {
      effectIdentity: 'retained-effect',
      trigger: { startFrame: 12, sourceIdentity: 'effect@12' },
      classification: 'applied',
    };
    const resolution = {
      status: 'verified-combat-action-mechanics-ready',
      ready: true,
      applied: true,
      packageHash: mechanicsPackage.packageHash,
      effectCoverageComplete: false,
      actionBinding: {
        identity: 'runtime-selected-form',
        controlSkillId: 10101021,
        actualDurationFrames: 50,
        selectedHitIdentities: [
          beforeHit.hitIdentity,
          cancelledHit.hitIdentity,
          detachedProjectile.hitIdentity,
        ],
        selectedEffectIdentities: [
          retainedEffect.effectIdentity,
          cancelledEffect.effectIdentity,
        ],
      },
      controlBinding: {
        controlSkillId: 10101021,
        applied: true,
      },
      hits: [beforeHit, cancelledHit, detachedProjectile],
      allHits: [beforeHit, cancelledHit, detachedProjectile],
      effects: [retainedEffect, cancelledEffect],
      semanticEffects: [
        {
          semanticIdentity: 'retained-semantic-effect',
          rawEffectIdentities: [retainedEffect.effectIdentity],
        },
        {
          semanticIdentity: 'cancelled-semantic-effect',
          rawEffectIdentities: [cancelledEffect.effectIdentity],
        },
      ],
    };

    const settled = applyVerifiedSwitchExitTailSettlement({
      policy,
      resolution,
      mechanicsPackage,
    });

    expect(settled.hits.map(hit => hit.hitIdentity)).toEqual([
      'before-hit',
      'detached-projectile',
    ]);
    expect(settled.effects).toEqual([retainedEffect]);
    expect(settled.semanticEffects).toEqual([
      expect.objectContaining({
        semanticIdentity: 'retained-semantic-effect',
      }),
    ]);
    expect(settled.switchExitTailSettlement).toMatchObject({
      status: 'owner-bound-tail-cancelled-at-switch-boundary',
      cancelledHitIdentities: ['cancelled-hit'],
      cancelledEffectIdentities: ['cancelled-effect'],
      retainedHitCount: 2,
      retainedEffectCount: 1,
    });
  });

  it('uses owner-specific stable blockers and grants authority only to compiler-attached policies', () => {
    const kibo = createPolicy({
      ownerKind: 'kibo',
      mapping: createMapping({ actionKind: 'normal-attack' }),
    });
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
