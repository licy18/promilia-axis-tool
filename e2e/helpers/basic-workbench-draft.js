export const BASIC_WORKBENCH_DRAFT_STORAGE_KEY =
  'promilia-axis-tool:workbench-draft:v17';

export function createBasicWorkbenchDraftFixture() {
  return {
    schemaVersion: 17,
    game: 'azur-promilia',
    type: 'workbench-draft',
    savedAt: null,
    selection: {
      characterId: 109001,
      secondaryCharacterId: 101003,
      skillId: 10900101,
      enemyId: 300032,
    },
    teamSlots: [
      { slotId: 'team-slot-1', position: 0, characterId: 109001 },
      { slotId: 'team-slot-2', position: 1, characterId: 101003 },
      { slotId: 'team-slot-3', position: 2, characterId: 101007 },
    ],
    enemyConfig: {
      level: 80,
      hpMultiplier: 1,
      defenseMultiplier: 1,
      toughnessMultiplier: 1,
      initialToughnessRatio: 1,
      elementDefenseOverrides: {},
    },
    actionDrafts: [
      {
        id: 'action-0001',
        type: 'skill',
        skillId: 10900101,
        actorCharacterId: 109001,
        startMs: 0,
        durationMs: 1000,
        level: 1,
        actionVariantIndex: 0,
        damageSegmentIndex: 0,
        targetCharacterId: 101003,
      },
    ],
    actionRelations: [],
    cycleBoundaries: [],
    initialRuntimeState: null,
    runtimeSampleCaptures: [],
    selectedActionId: 'action-0001',
  };
}
