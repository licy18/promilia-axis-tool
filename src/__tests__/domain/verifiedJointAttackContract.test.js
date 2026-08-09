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
      formalEligible: false,
      actorActionId: 'actor-joint',
      kiboActionId: 'kibo-joint',
      leavesOpen: [
        'petCsEntity.data.existPetBreakTarget-authoritative-generation-chain',
      ],
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
