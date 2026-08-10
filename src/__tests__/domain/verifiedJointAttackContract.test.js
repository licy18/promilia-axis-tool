import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import {
  createJointAttackTriggerUnresolvedEvidence,
  resolveVerifiedKiboJointAttackBinding,
} from '../../domain/verifiedJointAttackContract';

describe('verified joint attack contract', () => {
  beforeEach(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
  });

  it('requires breakSkillList and skillTag=15 instead of a generic break label', () => {
    const action = {
      id: 'kibo-joint',
      type: 'kiboEvent',
      skillId: 50000112,
      eventType: 'break',
      actionKind: 'break',
      actorId: 'actor-101007',
      kiboId: 500001,
    };
    const binding = resolveVerifiedKiboJointAttackBinding(action);
    expect(binding).toMatchObject({
      status: 'verified-kibo-joint-attack-binding',
      ownerId: 500001,
      sourceSkillId: 50000112,
      skillTag: 15,
      breakSkillListSourceIdentity:
        'NewTable/pet.rows[id=500001].breakSkillList',
      mechanicsPackageId: mechanicsPackage.packageId,
      mechanicsPackageHash: mechanicsPackage.packageHash,
      triggerResolved: false,
    });
    expect(
      resolveVerifiedKiboJointAttackBinding({
        ...action,
        skillId: 50000102,
        name: '名称含合击的普通 break',
      })
    ).toBeNull();
  });

  it('fail-closes a forged tag or breakSkillList source and hashes unresolved evidence', () => {
    const action = {
      id: 'kibo-joint',
      type: 'kiboEvent',
      skillId: 50000112,
      eventType: 'break',
      actionKind: 'break',
      actorId: 'actor-101007',
      kiboId: 500001,
    };
    const baseMapping = {
      identity: 'kibo|500001|50000112|0|50000112|break',
      ownerKind: 'kibo',
      ownerId: 500001,
      sourceSkillId: 50000112,
      actionKind: 'break',
      controlVariantSourceIdentity:
        'NewTable/pet.rows[id=500001].breakSkillList',
      controlLogic: {
        skillTag: 15,
        sourceIdentity: 'control-binding:50000112:PetJointStrikeSkill',
      },
    };
    expect(
      resolveVerifiedKiboJointAttackBinding(action, {
        ...baseMapping,
        controlLogic: { ...baseMapping.controlLogic, skillTag: 14 },
      })
    ).toBeNull();
    expect(
      resolveVerifiedKiboJointAttackBinding(action, {
        ...baseMapping,
        controlVariantSourceIdentity: 'forged/breakSkillList',
      })
    ).toBeNull();

    const binding = resolveVerifiedKiboJointAttackBinding(action, baseMapping);
    const evidence = createJointAttackTriggerUnresolvedEvidence({
      actorAction: {
        id: 'actor-joint',
        actorId: 'actor-101007',
        targetId: 'enemy-300032',
      },
      kiboAction: action,
      binding,
    });
    expect(evidence).toMatchObject({
      code: 'joint-attack-trigger-unresolved',
      status:
        'preweakbreak-known-predicates-closed-product-runtime-binding-required',
      formalEligible: false,
      actorActionId: 'actor-joint',
      kiboActionId: 'kibo-joint',
      sourceLedger: expect.arrayContaining([
        expect.objectContaining({
          sourceIdentity: 'PreWeakBreakSystem.OnUpdateDeltaTime@0x13FB720',
        }),
        expect.objectContaining({
          sourceIdentity:
            'PreWeakBreakSystem.UpdatePreBreakThreshold@0x13FCB20',
        }),
      ]),
      eligibilityEvidence: {
        status: 'client-known-predicate-chain-closed-unknown-gates-open',
        sourceMethod: 'PreWeakBreakSystem.OnUpdateDeltaTime@0x13FB720',
        thresholdMethod: 'UpdatePreBreakThreshold@0x13FCB20',
        closedPredicates: expect.arrayContaining([
          'enemy-alive-and-breakable',
          'enemy-not-broken-or-rage',
          'weakness-point-below-prebreak-threshold-or-force-break',
          'trigger-distance-height-hysteresis-and-connectivity',
          'controlled-hero-and-kibo-alive-state-ready',
          'player-slot-208-and-kibo-slot-601-ready',
        ]),
        leavesOpen: expect.arrayContaining([
          'controlled-entity-offset-0x40-field-identity',
          'service-cannot-be-joint-strike-set-runtime-input',
        ]),
      },
      postCastEvidence: {
        status: 'server-effect-and-weakness-cleanup-open',
        leavesOpen: expect.arrayContaining([
          'joint-strike-post-cast-effect-chain',
          'server-authoritative-weakness-point-clear',
        ]),
      },
      productAssumptionResolution: {
        contractId: 'm12-joint-attack-runtime-v1',
        status: 'resolved-when-strict-runtime-binding-is-present',
        clientParityReady: false,
      },
    });
    expect(evidence.pairIdentity).toMatch(/^joint-pair:[0-9a-f]{16}$/);
    expect(evidence.evidenceHash).toMatch(/^[0-9a-f]{16}$/);
    expect(
      createJointAttackTriggerUnresolvedEvidence({
        actorAction: {
          id: 'actor-joint',
          actorId: 'actor-101007',
          targetId: 'enemy-other',
        },
        kiboAction: action,
        binding,
      }).evidenceHash
    ).not.toBe(evidence.evidenceHash);
  });
});
