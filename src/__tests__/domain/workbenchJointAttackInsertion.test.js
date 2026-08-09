import { describe, expect, it } from 'vitest';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import { createWorkbenchJointAttackInsertion } from '../../domain/workbenchJointAttackInsertion';

const actorEntry = {
  kind: 'star-combo',
  skillId: 10100712,
  actionVariantIndex: 2,
  durationMs: 1400,
  timingStatus: 'applied',
  label: '星结合击',
  rawValue: '37%',
};
const kiboEntry = {
  kind: 'break',
  skillId: 50000112,
  durationFrames: 90,
  durationMs: 1500,
  timingStatus: 'applied',
  name: '迅狼-合击',
  icon: 'kibo-combo.png',
};

describe('workbench joint attack insertion', () => {
  beforeAll(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
  });

  it('adds the equipped kibo counterpart when the actor combo is dragged', () => {
    const result = createWorkbenchJointAttackInsertion({
      entry: {
        type: 'skill',
        skillId: actorEntry.skillId,
        actionVariantIndex: actorEntry.actionVariantIndex,
      },
      actorCharacterId: 101007,
      actorActionEntries: [actorEntry],
      kiboActionEntries: [kiboEntry],
      equippedKiboId: 500001,
      baseDraftPatches: [
        {
          id: 'actor-combo',
          type: 'skill',
          actorCharacterId: 101007,
          skillId: actorEntry.skillId,
          actionVariantIndex: actorEntry.actionVariantIndex,
          startMs: 2000,
        },
      ],
      startMs: 2000,
      companionActionId: 'kibo-combo',
      relationId: 'joint-relation',
    });

    expect(result.status).toBe('paired');
    expect(result).toMatchObject({
      formalEligible: false,
      triggerEvidence: {
        code: 'joint-attack-trigger-unresolved',
        status: 'exist-pet-break-target-authority-unresolved',
        skillTag: 15,
        mechanicsPackageHash: mechanicsPackage.packageHash,
      },
    });
    expect(result.draftPatches).toEqual([
      expect.objectContaining({ id: 'actor-combo', startMs: 2000 }),
      expect.objectContaining({
        id: 'kibo-combo',
        type: 'kiboEvent',
        kiboId: 500001,
        skillId: 50000112,
        eventType: 'break',
        startMs: 2000,
      }),
    ]);
    expect(result.actionRelations).toEqual([
      expect.objectContaining({
        id: 'joint-relation',
        kind: 'simultaneous',
        fromActionId: 'actor-combo',
        toActionId: 'kibo-combo',
        gapMs: 0,
      }),
    ]);
  });

  it('adds the actor counterpart when the equipped kibo combo is dragged', () => {
    const result = createWorkbenchJointAttackInsertion({
      entry: {
        type: 'kiboEvent',
        kiboId: 500001,
        skillId: 50000112,
        eventType: 'break',
        durationMs: 1500,
        timingStatus: 'applied',
      },
      actorCharacterId: 101007,
      actorActionEntries: [actorEntry],
      kiboActionEntries: [kiboEntry],
      equippedKiboId: 500001,
      baseDraftPatches: [
        {
          id: 'kibo-combo',
          type: 'kiboEvent',
          actorCharacterId: 101007,
          kiboId: 500001,
          skillId: 50000112,
          eventType: 'break',
          startMs: 3000,
        },
      ],
      startMs: 3000,
      companionActionId: 'actor-combo',
      relationId: 'joint-relation',
    });

    expect(result.draftPatches).toEqual([
      expect.objectContaining({
        id: 'actor-combo',
        type: 'skill',
        skillId: 10100712,
        actionVariantIndex: 2,
        startMs: 3000,
      }),
      expect.objectContaining({ id: 'kibo-combo', startMs: 3000 }),
    ]);
  });

  it('blocks a joint attack when the actor has no equipped kibo', () => {
    expect(
      createWorkbenchJointAttackInsertion({
        entry: {
          type: 'skill',
          skillId: actorEntry.skillId,
          actionVariantIndex: actorEntry.actionVariantIndex,
        },
        actorActionEntries: [actorEntry],
        equippedKiboId: null,
        baseDraftPatches: [{ id: 'actor-combo' }],
      })
    ).toMatchObject({
      status: 'blocked',
      message: '该角色未装备奇波，不能加入星结合击',
      draftPatches: [],
    });
  });

  it('does not pair a generic break action without the verified PetJointStrikeSkill binding', () => {
    const result = createWorkbenchJointAttackInsertion({
      entry: {
        type: 'kiboEvent',
        kiboId: 500001,
        skillId: 50000102,
        eventType: 'break',
      },
      actorCharacterId: 101007,
      actorActionEntries: [actorEntry],
      kiboActionEntries: [kiboEntry],
      equippedKiboId: 500001,
      baseDraftPatches: [{ id: 'ordinary-break' }],
    });

    expect(result).toEqual({
      status: 'not-joint-attack',
      draftPatches: [{ id: 'ordinary-break' }],
    });
  });
});
