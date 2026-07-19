export const LONG_AXIS_ACTION_COUNT = 120;
export const WORKBENCH_DRAFT_STORAGE_KEY =
  'promilia-axis-tool:workbench-draft:v17';

export function createLongAxisSnapshot({
  level = 1,
  cycleBoundaryMs = null,
} = {}) {
  const frameMs = 1000 / 60;
  const actionDrafts = Array.from(
    { length: LONG_AXIS_ACTION_COUNT },
    (_, index) => ({
      id: `browser-long-axis-action-${String(index + 1).padStart(4, '0')}`,
      type: 'skill',
      skillId: 10900101,
      actorCharacterId: 109001,
      startMs: index * 9 * frameMs,
      durationMs: 6 * frameMs,
      level,
      actionVariantIndex: 0,
      damageSegmentIndex: 0,
      targetCharacterId: 101003,
      resource: 'sp',
      change: 50,
      reason: 'manual-axis-resource',
      eventType: 'phase',
      note: '',
      insertion: null,
      generationBatch: null,
      effectCommands: [],
    })
  );
  return {
    schemaVersion: 17,
    game: 'azur-promilia',
    type: 'workbench-draft',
    savedAt: '2026-07-10T00:00:00.000Z',
    selection: {
      characterId: 109001,
      secondaryCharacterId: 101003,
      skillId: 10900101,
      enemyId: 300032,
    },
    teamSlots: [
      { slotId: 'team-slot-1', position: 0, characterId: 109001 },
      { slotId: 'team-slot-2', position: 1, characterId: 101003 },
    ],
    actorConfigs: [createActorConfig(109001), createActorConfig(101003)],
    enemyConfig: {
      level: 80,
      hpMultiplier: 100,
      defenseMultiplier: 1,
      toughnessMultiplier: 1,
      initialToughnessRatio: 1,
      elementDefenseOverrides: {},
    },
    segmentSplitOptions: {
      intervalMs: 2000,
      startAfterSelectedAction: false,
      skipExistingSegments: false,
    },
    actionDrafts,
    actionRelations: [],
    cycleBoundaries:
      cycleBoundaryMs == null
        ? []
        : [{ id: 'cycle-boundary-0001', timeMs: cycleBoundaryMs }],
    runtimeSampleCaptures: [],
    selectedActionId: actionDrafts.at(-1).id,
  };
}

export function createLongAxisComparisonSnapshot() {
  const baseline = createLongAxisSnapshot({
    level: 1,
    cycleBoundaryMs: 9000,
  });
  const current = createLongAxisSnapshot({
    level: 2,
    cycleBoundaryMs: 9000,
  });
  return {
    ...current,
    scenarioWorkspace: {
      schemaVersion: 1,
      activeScenarioId: 'scenario-0002',
      scenarios: [
        {
          id: 'scenario-0001',
          name: '120 动作基准',
          draft: createScenarioDraft(baseline),
        },
        {
          id: 'scenario-0002',
          name: '120 动作当前',
          draft: createScenarioDraft(current),
        },
      ],
    },
  };
}

function createScenarioDraft(snapshot) {
  return {
    selection: snapshot.selection,
    teamSlots: snapshot.teamSlots,
    actorConfigs: snapshot.actorConfigs,
    enemyConfig: snapshot.enemyConfig,
    segmentSplitOptions: snapshot.segmentSplitOptions,
    actionDrafts: snapshot.actionDrafts,
    actionRelations: snapshot.actionRelations,
    cycleBoundaries: snapshot.cycleBoundaries,
    runtimeSampleCaptures: snapshot.runtimeSampleCaptures,
    selectedActionId: snapshot.selectedActionId,
  };
}

function createActorConfig(characterId) {
  return {
    characterId,
    level: 80,
    initialSp: null,
    loadout: {
      kiboId: null,
      equipment: {
        weapon: null,
        top: null,
        bottom: null,
        earring: null,
        ring: null,
      },
      soulessenceId: null,
    },
  };
}
