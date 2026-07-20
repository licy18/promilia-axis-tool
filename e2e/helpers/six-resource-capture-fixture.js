import { createBasicWorkbenchDraftFixture } from './basic-workbench-draft';

export function createSixResourceCaptureBatchFixture({
  captureSessionPrefix = 'six-resource',
} = {}) {
  const actorCharacterIds = [109001, 101003, 101007];
  const actorIds = actorCharacterIds.map(characterId => `actor-${characterId}`);
  const skillIds = [10900112, 10100312, 10100712];
  const kiboIds = [500001, 500002, 500003];
  const draft = createBasicWorkbenchDraftFixture();

  draft.actorConfigs = actorCharacterIds.map((characterId, index) => ({
    characterId,
    level: 80,
    initialSp: 0,
    loadout: {
      kiboId: kiboIds[index],
      soulessenceId: null,
      equipment: {},
    },
  }));
  draft.actionDrafts = actorCharacterIds.flatMap((characterId, index) => [
    {
      id: `role-action-${index + 1}`,
      type: 'skill',
      skillId: skillIds[index],
      actorCharacterId: characterId,
      startMs: index * 2000,
      durationMs: 1000,
      level: 1,
      actionVariantIndex: 0,
      damageSegmentIndex: 0,
      targetCharacterId: actorCharacterIds[(index + 1) % 3],
    },
    {
      id: `kibo-action-${index + 1}`,
      type: 'kiboEvent',
      actorCharacterId: characterId,
      startMs: 8000 + index * 2000,
      durationMs: 600,
      eventType: 'activation',
      name: `奇波观测 ${index + 1}`,
    },
  ]);
  draft.selectedActionId = 'role-action-1';

  const captures = [
    ...actorIds.map((actorId, index) => ({
      captureSessionId: `${captureSessionPrefix}-role-${index + 1}`,
      events: [
        {
          eventType: 'recover-sp-applied',
          actionId: `source-role-action-${index + 1}`,
          actorId,
          roleEntityId: `${captureSessionPrefix}-role-entity-${index + 1}`,
          frameIndex: 30 + index * 60,
          timeMs: 500 + index * 1000,
          sourceElementConfigId: 900001 + index,
          spBefore: 10,
          spAfter: 11,
          spDeltaApplied: 1,
          args: { skillId: skillIds[index], delta: 1 },
        },
      ],
    })),
    ...actorIds.map((actorId, index) => ({
      captureSessionId: `${captureSessionPrefix}-kibo-${index + 1}`,
      events: [
        {
          eventType: 'pet-ultimate-cooldown-observed',
          actionId: `source-kibo-action-${index + 1}`,
          actorId,
          slotId: `team-slot-${index + 1}`,
          kiboId: kiboIds[index],
          petEntityId: 71001 + index,
          petEntityPointer: `0x${(0x22345678 + index).toString(16)}`,
          api: 'PetUltimateCdTime',
          frameIndex: index * 60,
          timeMs: index * 1000,
          cdTime: 20 - index * 10,
          totalTime: 20,
          ready: index === 2,
        },
      ],
    })),
  ];

  return {
    actorCharacterIds,
    actorIds,
    skillIds,
    kiboIds,
    draft,
    captures,
    envelope: {
      schemaVersion: 1,
      game: 'azur-promilia',
      type: 'runtime-sample-captures',
      captures,
    },
  };
}
