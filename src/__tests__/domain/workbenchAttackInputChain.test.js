import { describe, expect, it } from 'vitest';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
  resolveVerifiedCombatActionMechanics,
} from '../../data/verifiedCombatMechanicsPackage';
import {
  ATTACK_INPUT_LEGACY_UNRESOLVED,
  createWorkbenchAttackInputChainDrafts,
  migrateLegacyAttackInputActionDrafts,
  reconcileWorkbenchAttackInputIntentGroups,
} from '../../domain/workbenchAttackInputChain';
import { resolveVerifiedAttackInputChainEntry } from '../../domain/verifiedActionContextScheduling';
import { frameToMs, msToFrame } from '../../domain/timebase';

describe('workbench normal attack input chain', () => {
  it('publishes Ruby normal attack as three default inputs instead of leaking candidate A4/A5', () => {
    const mapping = findNormalAttack(103002);
    const drafts = createChain(mapping, 103002);

    expect(mapping.attackInputChainIdentity).toBe(
      'ruby-normal-default-three-inputs'
    );
    expect(mapping.attackInputSourceSegments).toHaveLength(5);
    expect(drafts).toHaveLength(3);
    expect(drafts.map(draft => draft.attackInput.semanticName)).toEqual([
      '普通攻击 A1',
      '普通攻击 A2',
      '普通攻击 A3',
    ]);
    expect(
      drafts.map(draft => [
        draft.attackInput.controlSkillId,
        draft.attackInput.selectedSubSkillIndex,
      ])
    ).toEqual([
      [10300201, 0],
      [10300202, 0],
      [10300203, 0],
    ]);
  });

  it('projects all twelve Ruby enhanced inputs as unique action drafts after quick entry', () => {
    const mapping = findNormalAttack(103002);
    const resolved = resolveVerifiedAttackInputChainEntry({
      entry: {
        ...mapping,
        skillId: mapping.sourceSkillId,
      },
      graph: mechanicsPackage.actionVariantGraph,
      ownerId: 103002,
      actorId: 'actor-ruby',
      timeMs: frameToMs(120),
      variantRuntime: {
        initialState: [
          {
            actorId: 'actor-ruby',
            characterId: 103002,
            resourceIdentity: 'actor:103002:element:103002047',
            currentValue: 12,
            maxValue: 12,
          },
        ],
        resourceEvents: [],
        activeSwitchWindows: [
          {
            actorId: 'actor-ruby',
            ownerId: 103002,
            targetControlSkillId: 10300201,
            targetSubSkillIndex: 1,
            startsAtMs: frameToMs(40),
            endsAtMs: frameToMs(280),
          },
        ],
      },
    });

    expect(resolved.status).toBe('selected');
    expect(resolved.entry.attackInputSegments).toHaveLength(12);
    expect(
      new Set(
        resolved.entry.attackInputSegments.map(segment => segment.identity)
      ).size
    ).toBe(12);

    const drafts = createChain(resolved.entry, 103002);
    expect(drafts).toHaveLength(12);
    expect(drafts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attackInputIntent: expect.objectContaining({
            kind: 'public-normal-attack',
            selectionMode: 'runtime-context',
            sourceSkillId: 10300201,
          }),
          attackInputChainSelectionSource: 'runtime-projected',
        }),
      ])
    );
    expect(drafts.map(draft => draft.attackInput.semanticName)).toEqual(
      Array.from({ length: 12 }, (_, index) => `强化普攻 E${index + 1}`)
    );
    for (let index = 1; index < drafts.length; index += 1) {
      expect(msToFrame(drafts[index].startMs)).toBe(
        msToFrame(drafts[index - 1].startMs) +
          drafts[index - 1].attackInput.effectiveDurationFrames
      );
    }
    expect(drafts.slice(6, 9).map(draft => msToFrame(draft.startMs))).toEqual([
      220, 238, 256,
    ]);

    const legacyDrafts = drafts.map(
      ({
        attackInputIntent: _attackInputIntent,
        attackInputChainSelectionSource: _selectionSource,
        ...draft
      }) => draft
    );
    const refreshed = migrateLegacyAttackInputActionDrafts(legacyDrafts, {
      resolveMapping: () => mapping,
    });
    expect(refreshed.changed).toBe(true);
    expect(refreshed.actions).toHaveLength(12);
    expect(refreshed.actions[0]).toMatchObject({
      attackInputIntent: {
        kind: 'public-normal-attack',
        selectionMode: 'runtime-context',
      },
      attackInputChainSelectionSource: 'runtime-projected',
      attackInput: {
        attackInputChainIdentity: 'ruby-enhanced-twelve-inputs',
        label: 'E1',
        semanticName: '强化普攻 E1',
        selectedSubSkillIndex: 1,
      },
    });
  });

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

  it('re-materializes a public Ruby input group from replay state instead of persisting the computed phase', () => {
    const mapping = findNormalAttack(103002);
    const normalDrafts = createChain(mapping, 103002, frameToMs(34));
    const sourceA3 = {
      id: 'ruby-source-a3',
      type: 'skill',
      skillId: 10300201,
      actorCharacterId: 103002,
      startMs: 0,
      durationMs: frameToMs(79),
      attackInput: {
        controlSkillId: 10300203,
        selectedSubSkillIndex: 0,
      },
    };
    const variantRuntime = {
      ready: true,
      initialState: [
        {
          actorId: 'actor-ruby',
          characterId: 103002,
          resourceIdentity: 'actor:103002:element:103002047',
          currentValue: 6,
          maxValue: 12,
        },
      ],
      resourceEvents: [],
      activeSwitchWindows: [],
      selections: [
        {
          actionId: sourceA3.id,
          executionControlSkillId: 10300203,
          selectedSubSkillIndex: 0,
        },
      ],
    };
    const enhanced = reconcileWorkbenchAttackInputIntentGroups({
      actions: [sourceA3, ...normalDrafts],
      graph: mechanicsPackage.actionVariantGraph,
      variantRuntime,
      resolveMapping: () => mapping,
      resolveActorId: () => 'actor-ruby',
    });

    expect(enhanced.changed).toBe(true);
    expect(enhanced.actions.slice(1)).toHaveLength(6);
    expect(enhanced.actions[1]).toMatchObject({
      attackInputChainIdentity: 'ruby-enhanced-twelve-inputs',
      attackInputChainSelectionSource: 'runtime-projected',
      attackInput: {
        semanticName: '强化普攻 E1',
        selectedSubSkillIndex: 1,
      },
    });

    const shifted = enhanced.actions.map(action =>
      action.attackGroupId
        ? {
            ...action,
            startMs: frameToMs(msToFrame(action.startMs) + 45),
          }
        : action
    );
    const normal = reconcileWorkbenchAttackInputIntentGroups({
      actions: shifted,
      graph: mechanicsPackage.actionVariantGraph,
      variantRuntime,
      resolveMapping: () => mapping,
      resolveActorId: () => 'actor-ruby',
    });
    expect(normal.changed).toBe(true);
    expect(normal.actions.slice(1)).toHaveLength(3);
    expect(normal.actions[1]).toMatchObject({
      attackInputChainIdentity: 'ruby-normal-default-three-inputs',
      attackInput: { semanticName: '普通攻击 A1' },
    });
  });

  it('keeps ambiguous input chains schedulable without promoting unknown timing', () => {
    const unresolved = findNormalAttack(101007);
    expect(unresolved.attackInputSegments).toHaveLength(4);
    expect(
      unresolved.attackInputSegments.map(segment => segment.durationFrames)
    ).toEqual([null, 31, 31, 65]);
    const planningChain = createChain(unresolved, 101007);
    expect(planningChain).toHaveLength(4);
    expect(planningChain.map(draft => msToFrame(draft.durationMs))).toEqual([
      199, 31, 31, 65,
    ]);
    expect(planningChain.map(draft => draft.timingStatus)).toEqual([
      'unresolved',
      'applied',
      'applied',
      'applied',
    ]);
    expect(planningChain.map(draft => draft.needsTimingData)).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(planningChain[0]).toMatchObject({
      durationFrames: null,
      timingSource: 'source-animation-planning-duration',
      actionScheduling: {
        planningDurationFrames: 199,
        sourceStatus: 'verified-animation-duration',
      },
      attackInput: {
        sequenceIndex: 1,
        durationFrames: null,
        durationStatus: 'unresolved',
      },
    });
    expect(createChain(findNormalAttack(108003), 108003)).toHaveLength(3);
  });

  it('keeps generic planning free of fabricated hits while source-timed projectiles remain runnable', () => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
    const [sourceTimedProjectile] = createChain(
      findNormalAttack(101007),
      101007
    );
    const projectileResolution = resolveVerifiedCombatActionMechanics({
      ...sourceTimedProjectile,
      actor: { id: 'actor-101007', characterId: 101007 },
    });
    expect(projectileResolution).toMatchObject({
      status: 'verified-combat-action-mechanics-ready',
      ready: true,
      applied: true,
    });
    expect(projectileResolution.hits.length).toBeGreaterThan(0);
    expect(projectileResolution.hits[0]).toMatchObject({
      sourceEvidenceStatus: 'runtime-dependent',
      scenarioRuntimeStatus: 'scenario-assumed-zero-distance',
    });

    const misaA5 = createChain(findNormalAttack(107002), 107002)[4];
    expect(misaA5.actionScheduling).toMatchObject({
      kind: 'generic-planning-duration',
      planningDurationFrames: 30,
    });
    const unresolvedResolution = resolveVerifiedCombatActionMechanics({
      ...misaA5,
      actor: { id: 'actor-107002', characterId: 107002 },
    });
    expect(unresolvedResolution).toMatchObject({
      ready: false,
      applied: false,
    });
    expect(unresolvedResolution.hits ?? []).toEqual([]);
    clearInstalledVerifiedCombatMechanicsPackage();
  });

  it('migrates an untouched legacy 30F placeholder to its source animation duration', () => {
    const mapping = findNormalAttack(101007);
    const [currentA1] = createChain(mapping, 101007);
    const legacyA1 = {
      ...currentA1,
      durationMs: frameToMs(30),
      actionScheduling: null,
      attackInput: {
        ...currentA1.attackInput,
        actionScheduling: null,
      },
    };
    const refreshed = migrateLegacyAttackInputActionDrafts([legacyA1], {
      resolveMapping: () => mapping,
    });

    expect(refreshed.actions[0]).toMatchObject({
      durationMs: frameToMs(199),
      durationFrames: null,
      timingSource: 'source-animation-planning-duration',
      needsTimingData: true,
      actionScheduling: {
        kind: 'source-animation-planning-duration',
        planningDurationFrames: 199,
      },
    });

    const edited = migrateLegacyAttackInputActionDrafts(
      [{ ...legacyA1, durationMs: frameToMs(45) }],
      { resolveMapping: () => mapping }
    );
    expect(msToFrame(edited.actions[0].durationMs)).toBe(45);
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

  it('migrates a uniquely identified legacy chain while preserving unresolved segment timing', () => {
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

    expect(migration.changed).toBe(true);
    expect(migration.unresolvedActionIds).toEqual([]);
    expect(migration.actions).toHaveLength(4);
    expect(migration.actions.map(action => action.attackSequenceIndex)).toEqual(
      [1, 2, 3, 4]
    );
    expect(migration.actions.map(action => action.timingStatus)).toEqual([
      'unresolved',
      'applied',
      'applied',
      'applied',
    ]);
    expect(
      migration.actions.some(action => action.attackInputLegacyStatus)
    ).toBe(false);
  });
});

function findNormalAttack(ownerId) {
  return mechanicsPackage.actionMappings.find(
    mapping =>
      mapping.ownerId === ownerId && mapping.actionKind === 'normal-attack'
  );
}

function createChain(mapping, actorCharacterId, startMs = 1000) {
  let index = 0;
  return createWorkbenchAttackInputChainDrafts({
    entry: mapping,
    actorCharacterId,
    skillId: mapping.sourceSkillId,
    level: 1,
    startMs,
    createActionId: () => `action-${++index}`,
  });
}
