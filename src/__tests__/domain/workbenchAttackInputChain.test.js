import { describe, expect, it } from 'vitest';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  ATTACK_INPUT_LEGACY_UNRESOLVED,
  createWorkbenchAttackInputChainDrafts,
  migrateLegacyAttackInputActionDrafts,
} from '../../domain/workbenchAttackInputChain';
import { msToFrame } from '../../domain/timebase';

describe('workbench normal attack input chain', () => {
  it('creates one independent action per real input and keeps multi-hit inside its owner segment', () => {
    const mapping = findNormalAttack(102001);
    const drafts = createChain(mapping, 102001);

    expect(drafts).toHaveLength(5);
    expect(drafts.map(draft => draft.attackSequenceIndex)).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(drafts.map(draft => draft.id)).toEqual([
      'action-1',
      'action-2',
      'action-3',
      'action-4',
      'action-5',
    ]);
    expect(drafts.map(draft => msToFrame(draft.durationMs))).toEqual([
      155, 221, 282, 192, 293,
    ]);
    expect(drafts.map(draft => msToFrame(draft.startMs))).toEqual([
      60, 215, 436, 718, 910,
    ]);
    expect(drafts[2]).toMatchObject({
      attackSequenceIndex: 3,
      attackSequenceTotal: 5,
      attackInput: {
        controlSkillId: 10200103,
        resourceMapIndex: 0,
      },
    });
    expect(drafts[2].attackInput.selectedHitIdentities).toHaveLength(6);
    expect(new Set(drafts.map(draft => draft.attackGroupId)).size).toBe(1);
  });

  it('derives four- and three-input chains from current client controls', () => {
    expect(createChain(findNormalAttack(101007), 101007)).toHaveLength(4);
    expect(createChain(findNormalAttack(108003), 108003)).toHaveLength(3);
  });

  it('migrates one legacy aggregate block to editable siblings without reusing its hits', () => {
    const mapping = findNormalAttack(102001);
    const migration = migrateLegacyAttackInputActionDrafts(
      [
        {
          id: 'legacy-attack',
          type: 'skill',
          skillId: mapping.sourceSkillId,
          actorCharacterId: 102001,
          level: 1,
          startMs: 1000,
          durationMs: 10000,
        },
      ],
      {
        resolveMapping: () => mapping,
        createActionId: usedIds => {
          const id = `action-${usedIds.size + 1}`;
          usedIds.add(id);
          return id;
        },
      }
    );

    expect(migration).toMatchObject({
      changed: true,
      unresolvedActionIds: [],
    });
    expect(migration.actions).toHaveLength(5);
    expect(migration.actions[0].id).toBe('legacy-attack');
    expect(migration.actions.every(action => action.durationMs < 10000)).toBe(
      true
    );
    const hitIdentities = migration.actions.flatMap(
      action => action.attackInput.selectedHitIdentities
    );
    expect(new Set(hitIdentities).size).toBe(hitIdentities.length);
  });

  it('keeps an unresolvable legacy aggregate block explicitly unapplied', () => {
    const migration = migrateLegacyAttackInputActionDrafts(
      [
        {
          id: 'legacy-unknown',
          type: 'skill',
          skillId: 1,
          actorCharacterId: 1,
          startMs: 0,
          durationMs: 1000,
        },
      ],
      {
        resolveMapping: () => ({
          actionKind: 'normal-attack',
          attackInputSegments: [],
        }),
      }
    );

    expect(migration.actions[0]).toMatchObject({
      id: 'legacy-unknown',
      attackInputLegacyStatus: ATTACK_INPUT_LEGACY_UNRESOLVED,
    });
  });
});

function findNormalAttack(ownerId) {
  return mechanicsPackage.actionMappings.find(
    mapping =>
      mapping.ownerId === ownerId && mapping.actionKind === 'normal-attack'
  );
}

function createChain(mapping, actorCharacterId) {
  let index = 0;
  return createWorkbenchAttackInputChainDrafts({
    entry: mapping,
    actorCharacterId,
    skillId: mapping.sourceSkillId,
    level: 1,
    startMs: 1000,
    createActionId: () => `action-${++index}`,
  });
}
