import { describe, expect, it } from 'vitest';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  ATTACK_INPUT_LEGACY_UNRESOLVED,
  createWorkbenchAttackInputChainDrafts,
  migrateLegacyAttackInputActionDrafts,
} from '../../domain/workbenchAttackInputChain';
import { frameToMs, msToFrame } from '../../domain/timebase';

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
      19, 32, 40, 42, 56,
    ]);
    expect(drafts.map(draft => msToFrame(draft.startMs))).toEqual([
      60, 79, 111, 151, 193,
    ]);
    expect(drafts[2]).toMatchObject({
      attackSequenceIndex: 3,
      attackSequenceTotal: 5,
      attackInput: {
        controlSkillId: 10200103,
        resourceMapIndex: 0,
        effectiveDurationFrames: 40,
        animationDurationFrames: 282,
        hitEndFrame: 30,
        linkWindow: { startFrame: 40, endFrame: 96 },
      },
    });
    expect(drafts[2].attackInput.selectedHitIdentities).toHaveLength(6);
    expect(new Set(drafts.map(draft => draft.attackGroupId)).size).toBe(1);
  });

  it('blocks ambiguous input chains while keeping confirmed chains editable', () => {
    const unresolved = findNormalAttack(101007);
    expect(unresolved.attackInputSegments).toHaveLength(4);
    expect(
      unresolved.attackInputSegments.map(segment => segment.durationFrames)
    ).toEqual([null, 31, 31, null]);
    expect(createChain(unresolved, 101007)).toEqual([]);
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

  it('compacts a pristine M7-R1 animation-length chain without moving edited groups', () => {
    const mapping = findNormalAttack(102001);
    const oldDurations = mapping.attackInputSegments.map(
      segment => segment.animationDurationFrames
    );
    let startFrame = 60;
    const legacyChain = mapping.attackInputSegments.map((segment, index) => {
      const action = {
        id: `legacy-segment-${index + 1}`,
        type: 'skill',
        skillId: mapping.sourceSkillId,
        actorCharacterId: 102001,
        level: 1,
        startMs: frameToMs(startFrame),
        durationMs: frameToMs(oldDurations[index]),
        attackGroupId: 'legacy-m7-r1-group',
        attackSequenceIndex: index + 1,
        attackSequenceTotal: mapping.attackInputSegments.length,
        attackInput: {
          ...segment,
          effectiveDurationFrames: null,
          durationFrames: oldDurations[index],
          animationDurationFrames: null,
          linkWindows: undefined,
        },
      };
      startFrame += oldDurations[index];
      return action;
    });

    const compacted = migrateLegacyAttackInputActionDrafts(legacyChain, {
      resolveMapping: () => mapping,
    });
    expect(compacted.changed).toBe(true);
    expect(compacted.actions.map(action => msToFrame(action.startMs))).toEqual([
      60, 79, 111, 151, 193,
    ]);
    expect(
      compacted.actions.map(action => msToFrame(action.durationMs))
    ).toEqual([19, 32, 40, 42, 56]);

    const movedChain = legacyChain.map(action =>
      action.attackSequenceIndex === 2
        ? { ...action, startMs: frameToMs(700) }
        : action
    );
    const preserved = migrateLegacyAttackInputActionDrafts(movedChain, {
      resolveMapping: () => mapping,
    });
    expect(msToFrame(preserved.actions[1].startMs)).toBe(700);
    expect(msToFrame(preserved.actions[2].startMs)).toBe(436);
    expect(msToFrame(preserved.actions[1].durationMs)).toBe(32);
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

  it('keeps a legacy aggregate block when its input chain has unresolved timing', () => {
    const mapping = findNormalAttack(101007);
    const migration = migrateLegacyAttackInputActionDrafts(
      [
        {
          id: 'legacy-ambiguous-chain',
          type: 'skill',
          skillId: mapping.sourceSkillId,
          actorCharacterId: 101007,
          startMs: 0,
          durationMs: frameToMs(1),
        },
      ],
      { resolveMapping: () => mapping }
    );

    expect(migration).toMatchObject({
      changed: true,
      unresolvedActionIds: ['legacy-ambiguous-chain'],
      actions: [
        {
          id: 'legacy-ambiguous-chain',
          durationMs: frameToMs(1),
          attackInputLegacyStatus: ATTACK_INPUT_LEGACY_UNRESOLVED,
        },
      ],
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
