export const BASIC_WORKBENCH_DRAFT_STORAGE_KEY =
  'promilia-axis-tool:workbench-draft:v17';

export function createBasicWorkbenchDraftFixture() {
  const selection = {
    characterId: 109001,
    secondaryCharacterId: 101003,
    skillId: 10900112,
    enemyId: 300032,
  };
  const teamSlots = [
    { slotId: 'team-slot-1', position: 0, characterId: 109001 },
    { slotId: 'team-slot-2', position: 1, characterId: 101003 },
    { slotId: 'team-slot-3', position: 2, characterId: 101007 },
  ];
  const enemyConfig = {
    level: 80,
    hpMultiplier: 1,
    defenseMultiplier: 1,
    toughnessMultiplier: 1,
    initialToughnessRatio: 1,
    elementDefenseOverrides: {},
  };
  const actionDrafts = [
    {
      id: 'action-0001',
      type: 'skill',
      skillId: 10900112,
      actorCharacterId: 109001,
      startMs: 0,
      durationMs: 1000,
      level: 1,
      actionVariantIndex: 0,
      damageSegmentIndex: 0,
      targetCharacterId: 101003,
    },
  ];
  const scenarioDraft = {
    selection,
    teamSlots,
    enemyConfig,
    actionDrafts,
    actionRelations: [],
    cycleBoundaries: [],
    initialRuntimeState: null,
    runtimeSampleCaptures: [],
    selectedActionId: 'action-0001',
  };
  return {
    schemaVersion: 17,
    game: 'azur-promilia',
    type: 'workbench-draft',
    savedAt: null,
    ...scenarioDraft,
    scenarioWorkspace: {
      schemaVersion: 1,
      activeScenarioId: 'scenario-0001',
      scenarios: [
        { id: 'scenario-0001', name: '基础方案', draft: scenarioDraft },
      ],
    },
  };
}
