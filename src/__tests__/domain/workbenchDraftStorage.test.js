import { describe, expect, it } from 'vitest';
import {
  LEGACY_WORKBENCH_DRAFT_STORAGE_KEYS,
  WORKBENCH_DRAFT_STORAGE_KEY,
  WORKBENCH_DRAFT_SCHEMA_VERSION,
  WORKBENCH_PROJECT_FILE_TYPE,
  clearWorkbenchDraft,
  createWorkbenchProjectFileName,
  createWorkbenchProjectFileSnapshot,
  createWorkbenchProjectShareCode,
  createWorkbenchScenarioDraftSnapshot,
  loadWorkbenchDraft,
  parseWorkbenchProjectFile,
  parseWorkbenchProjectShareCode,
  serializeWorkbenchProjectFile,
} from '../../domain/workbenchDraftStorage';

describe('workbench draft storage project files', () => {
  it('stores 120 seconds by default and preserves explicit project durations', () => {
    const defaultDraft = createWorkbenchScenarioDraftSnapshot({
      actionDrafts: [],
    });
    const customProject = createWorkbenchProjectFileSnapshot({
      durationMs: 180_000,
      actionDrafts: [],
    });
    const explicitThirtySeconds = parseWorkbenchProjectFile({
      ...customProject,
      durationMs: 30_000,
      scenarioWorkspace: {
        ...customProject.scenarioWorkspace,
        scenarios: customProject.scenarioWorkspace.scenarios.map(scenario => ({
          ...scenario,
          draft: { ...scenario.draft, durationMs: 30_000 },
        })),
      },
    });

    expect(defaultDraft.durationMs).toBe(120_000);
    expect(customProject.durationMs).toBe(180_000);
    expect(customProject.scenarioWorkspace.scenarios[0].draft.durationMs).toBe(
      180_000
    );
    expect(explicitThirtySeconds.durationMs).toBe(30_000);
  });

  it('migrates legacy 600ms switches without shifting later absolute start frames', () => {
    const legacy = createWorkbenchProjectFileSnapshot({
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
      actionDrafts: [
        {
          id: 'legacy-switch',
          type: 'switch',
          actorCharacterId: 109001,
          targetCharacterId: 101003,
          startMs: 1000,
          durationMs: 600,
        },
        {
          id: 'later-action',
          type: 'skill',
          skillId: 10900101,
          actorCharacterId: 109001,
          startMs: 2400,
          durationMs: 1000,
          level: 1,
        },
      ],
      selectedActionId: 'legacy-switch',
    });
    const activeScenario = legacy.scenarioWorkspace.scenarios.find(
      scenario => scenario.id === legacy.scenarioWorkspace.activeScenarioId
    );
    for (const actionList of [
      legacy.actionDrafts,
      activeScenario.draft.actionDrafts,
    ]) {
      const switchAction = actionList.find(
        action => action.id === 'legacy-switch'
      );
      switchAction.durationMs = 600;
      delete switchAction.durationFrames;
      delete switchAction.startFrame;
      delete switchAction.endFrame;
    }

    const migrated = parseWorkbenchProjectFile(JSON.stringify(legacy));
    const migratedSwitch = migrated.actionDrafts.find(
      action => action.id === 'legacy-switch'
    );
    const laterAction = migrated.actionDrafts.find(
      action => action.id === 'later-action'
    );

    expect(migratedSwitch).toMatchObject({
      startMs: 1000,
      startFrame: 60,
      endFrame: 60,
      durationMs: 0,
      durationFrames: 0,
    });
    expect(laterAction.startMs).toBe(2400);
  });

  it('preserves an explicit empty action list while retaining legacy fallback', () => {
    const emptyDraft = createWorkbenchScenarioDraftSnapshot({
      actionDrafts: [],
      selectedActionId: 'action-missing',
    });
    const legacyDraft = createWorkbenchScenarioDraftSnapshot();

    expect(emptyDraft.actionDrafts).toEqual([]);
    expect(emptyDraft.selectedActionId).toBe('');
    expect(legacyDraft.actionDrafts).toHaveLength(1);
    expect(legacyDraft.selectedActionId).toBe(legacyDraft.actionDrafts[0].id);
  });

  it('serializes a versioned Workbench project file and imports it as a draft', () => {
    const exported = JSON.parse(
      serializeWorkbenchProjectFile(
        {
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
          actorConfigs: [
            {
              characterId: 109001,
              level: 80,
              initialSp: 0.25,
              loadout: {
                kiboId: 500001,
                equipment: {
                  weapon: 1010111,
                  top: 1020111,
                  bottom: 1030111,
                  earring: 1040111,
                  ring: 1050111,
                },
                soulessenceId: 10001,
              },
            },
          ],
          enemyConfig: {
            level: 80,
            hpMultiplier: 1.5,
            defenseMultiplier: 0.8,
            toughnessMultiplier: 2,
            initialToughnessRatio: 0.5,
            elementDefenseOverrides: {
              FIRE_DEFENSE: 0.25,
              ICE_DEFENSE: -0.1,
            },
          },
          segmentSplitOptions: {
            intervalMs: 1800,
            startAfterSelectedAction: true,
            skipExistingSegments: true,
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
              hitOverrides: {
                'control:10900101|hit:2': { willHit: false },
              },
            },
            {
              id: 'action-0002',
              type: 'skill',
              skillId: 10100301,
              actorCharacterId: 101003,
              startMs: 1200,
              durationMs: 900,
              level: 2,
            },
            {
              id: 'action-0003',
              type: 'kiboEvent',
              skillId: 50000102,
              actorCharacterId: 109001,
              startMs: 2400,
              durationMs: 1416.666667,
              level: 1,
              eventType: 'signature',
              name: '迅风刃',
              icon: 'tex_icon_petskill_500001_02.png',
              timingSource: 'azpr-unity-skill-control-root',
              needsTimingData: false,
            },
          ],
          actionRelations: [
            {
              id: 'relation-0001',
              kind: 'sequence',
              fromActionId: 'action-0001',
              toActionId: 'action-0002',
              sourceAnchor: 'end',
              targetAnchor: 'start',
              gapMs: 200,
            },
          ],
          cycleBoundaries: [
            { id: 'cycle-boundary-0001', timeMs: 1000 },
            { id: 'cycle-boundary-0002', timeMs: 2200 },
          ],
          initialRuntimeState: createInheritedState(),
          combatScenario: {
            projectile: { targetDistance: 0, defaultWillHit: true },
          },
          runtimeSampleCaptures: [
            {
              schemaVersion: 1,
              captureSessionId: 'draft-runtime-capture-1',
              events: [
                {
                  eventType: 'toughness-damage-applied',
                  actionId: 'action-0001',
                  actorId: 'actor-109001',
                  targetId: 'enemy-300032',
                  targetEntityId: 'runtime-enemy-300032',
                  frameIndex: 12,
                  toughnessBefore: 100,
                  toughnessAfter: 90,
                  toughnessDeltaApplied: 10,
                },
              ],
            },
          ],
          selectedActionId: 'action-0002',
        },
        '2026-07-10T04:00:00.000Z'
      )
    );

    expect(exported).toMatchObject({
      schemaVersion: WORKBENCH_DRAFT_SCHEMA_VERSION,
      game: 'azur-promilia',
      type: WORKBENCH_PROJECT_FILE_TYPE,
      exportedAt: '2026-07-10T04:00:00.000Z',
      selectedActionId: 'action-0002',
      teamSlots: [
        { slotId: 'team-slot-1', position: 0, characterId: 109001 },
        { slotId: 'team-slot-2', position: 1, characterId: 101003 },
        { slotId: 'team-slot-3', position: 2, characterId: 101007 },
      ],
      actorConfigs: [
        {
          characterId: 109001,
          initialSp: 0.25,
          loadout: {
            kiboId: 500001,
            equipment: {
              weapon: 1010111,
            },
            soulessenceId: 10001,
          },
        },
        {
          characterId: 101003,
        },
        {
          characterId: 101007,
        },
      ],
      mechanicsProfileSelection: {
        schemaVersion: 1,
        contractName: 'AzPrWorkbenchMechanicsProfileSelection',
        profileId: 'azpr-three-value-preview-v1',
        profileVersion: 1,
      },
      runtimeSampleCaptures: [
        {
          captureSessionId: 'draft-runtime-capture-1',
          events: [
            expect.objectContaining({
              eventType: 'toughness-damage-applied',
              toughnessDeltaApplied: 10,
            }),
          ],
        },
      ],
      actionRelations: [
        {
          id: 'relation-0001',
          kind: 'sequence',
          fromActionId: 'action-0001',
          toActionId: 'action-0002',
          sourceAnchor: 'end',
          targetAnchor: 'start',
          gapMs: 200,
        },
      ],
      cycleBoundaries: [
        { id: 'cycle-boundary-0001', timeMs: 1000 },
        { id: 'cycle-boundary-0002', timeMs: 2200 },
      ],
      initialRuntimeState: {
        contractName: 'AzPrInitialRuntimeState',
        source: {
          sourceScenarioId: 'scenario-source',
          boundaryId: 'cycle-boundary-source',
          boundaryTimeMs: 1000,
        },
        enemy: { hp: { currentValue: 850 } },
        selfEnergyByActor: [{ actorId: 'actor-109001', currentValue: 35 }],
        activeEffects: [{ effectId: 'focus', remainingDurationMs: 750 }],
      },
      combatScenario: {
        projectile: { targetDistance: 0, defaultWillHit: true },
      },
      scenarioWorkspace: {
        schemaVersion: 1,
        activeScenarioId: 'scenario-0001',
        scenarios: [
          {
            id: 'scenario-0001',
            name: '方案 1',
            draft: { selectedActionId: 'action-0002' },
          },
        ],
      },
    });

    const imported = parseWorkbenchProjectFile(exported);
    const shared = parseWorkbenchProjectShareCode(
      createWorkbenchProjectShareCode(exported, '2026-07-10T04:00:00.000Z')
    );

    expect(imported).toMatchObject({
      schemaVersion: WORKBENCH_DRAFT_SCHEMA_VERSION,
      game: 'azur-promilia',
      type: 'workbench-draft',
      savedAt: '2026-07-10T04:00:00.000Z',
      teamSlots: [
        { slotId: 'team-slot-1', position: 0, characterId: 109001 },
        { slotId: 'team-slot-2', position: 1, characterId: 101003 },
        { slotId: 'team-slot-3', position: 2, characterId: 101007 },
      ],
      enemyConfig: {
        level: 80,
        hpMultiplier: 1.5,
        defenseMultiplier: 0.8,
        toughnessMultiplier: 2,
        initialToughnessRatio: 0.5,
        elementDefenseOverrides: {
          FIRE_DEFENSE: 0.25,
          ICE_DEFENSE: -0.1,
        },
      },
      segmentSplitOptions: {
        intervalMs: 1800,
        startAfterSelectedAction: true,
        skipExistingSegments: true,
      },
      selectedActionId: 'action-0002',
      runtimeSampleCaptures: [
        expect.objectContaining({
          captureSessionId: 'draft-runtime-capture-1',
        }),
      ],
      initialRuntimeState: {
        source: { sourceScenarioId: 'scenario-source' },
        enemy: { toughness: { currentValue: 60 } },
        activeEffects: [{ effectId: 'focus' }],
      },
      combatScenario: {
        projectile: { targetDistance: 0, defaultWillHit: true },
      },
      actionRelations: [
        expect.objectContaining({
          id: 'relation-0001',
          fromActionId: 'action-0001',
          toActionId: 'action-0002',
          gapMs: 200,
        }),
      ],
      cycleBoundaries: [
        { id: 'cycle-boundary-0001', timeMs: 1000 },
        { id: 'cycle-boundary-0002', timeMs: 2200 },
      ],
    });
    expect(shared.initialRuntimeState).toEqual(imported.initialRuntimeState);
    expect(imported.actionDrafts).toHaveLength(3);
    expect(imported.actionDrafts[0].hitOverrides).toEqual({
      'control:10900101|hit:2': { willHit: false },
    });
    expect(shared.actionDrafts[0].hitOverrides).toEqual(
      imported.actionDrafts[0].hitOverrides
    );
    expect(imported.actionDrafts[2]).toMatchObject({
      type: 'kiboEvent',
      name: '迅风刃',
      icon: 'tex_icon_petskill_500001_02.png',
    });
    expect(shared.actionDrafts[2]).toMatchObject(imported.actionDrafts[2]);
  });

  it('round-trips every scenario while keeping the active root draft synchronized', () => {
    const activeAction = {
      id: 'action-active',
      type: 'skill',
      skillId: 10900101,
      actorCharacterId: 109001,
      startMs: 600,
      durationMs: 1000,
      level: 1,
    };
    const baselineAction = {
      ...activeAction,
      id: 'action-baseline',
      startMs: 1200,
    };
    const project = createWorkbenchProjectFileSnapshot(
      {
        selection: {
          characterId: 109001,
          secondaryCharacterId: 101003,
          skillId: 10900101,
          enemyId: 300032,
        },
        actionDrafts: [activeAction],
        selectedActionId: activeAction.id,
        scenarioWorkspace: {
          activeScenarioId: 'scenario-active',
          scenarios: [
            {
              id: 'scenario-active',
              name: '当前轴',
              draft: {
                actionDrafts: [{ ...activeAction, startMs: 0 }],
                selectedActionId: activeAction.id,
              },
            },
            {
              id: 'scenario-baseline',
              name: '基准轴',
              draft: {
                selection: {
                  characterId: 109001,
                  secondaryCharacterId: 101003,
                  skillId: 10900101,
                  enemyId: 300032,
                },
                actionDrafts: [baselineAction],
                selectedActionId: baselineAction.id,
              },
            },
          ],
        },
      },
      '2026-07-11T01:00:00.000Z'
    );

    expect(project.schemaVersion).toBe(WORKBENCH_DRAFT_SCHEMA_VERSION);
    expect(project.scenarioWorkspace).toMatchObject({
      activeScenarioId: 'scenario-active',
      scenarios: [
        {
          id: 'scenario-active',
          name: '当前轴',
          draft: {
            selectedActionId: 'action-active',
            actionDrafts: [{ id: 'action-active', startMs: 600 }],
          },
        },
        {
          id: 'scenario-baseline',
          name: '基准轴',
          draft: {
            selectedActionId: 'action-baseline',
            actionDrafts: [{ id: 'action-baseline', startMs: 1200 }],
          },
        },
      ],
    });
    expect(parseWorkbenchProjectFile(project).scenarioWorkspace).toEqual(
      project.scenarioWorkspace
    );
    expect(
      parseWorkbenchProjectShareCode(
        createWorkbenchProjectShareCode(project, '2026-07-11T01:00:00.000Z')
      ).scenarioWorkspace
    ).toEqual(project.scenarioWorkspace);
  });

  it('keeps legacy workbench draft files importable', () => {
    const projectFile = createWorkbenchProjectFileSnapshot(
      {
        selection: {
          characterId: 109001,
          secondaryCharacterId: 101003,
          skillId: 10900101,
          enemyId: 300032,
        },
        enemyConfig: {
          level: 80,
          hpMultiplier: 1,
          defenseMultiplier: 1,
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
          },
        ],
        selectedActionId: 'action-0001',
      },
      '2026-07-10T04:30:00.000Z'
    );
    const legacyDraftFile = {
      ...projectFile,
      schemaVersion: 1,
      type: 'workbench-draft',
      actorConfigs: undefined,
      scenarioWorkspace: undefined,
    };

    expect(parseWorkbenchProjectFile(legacyDraftFile)).toMatchObject({
      schemaVersion: WORKBENCH_DRAFT_SCHEMA_VERSION,
      type: 'workbench-draft',
      selectedActionId: 'action-0001',
      actorConfigs: [
        { characterId: 109001 },
        { characterId: 101003 },
        { characterId: 101007 },
      ],
      teamSlots: [
        { slotId: 'team-slot-1', position: 0, characterId: 109001 },
        { slotId: 'team-slot-2', position: 1, characterId: 101003 },
        { slotId: 'team-slot-3', position: 2, characterId: 101007 },
      ],
      enemyConfig: {
        toughnessMultiplier: 1,
        initialToughnessRatio: 1,
      },
      combatScenario: {
        projectile: { targetDistance: 0, defaultWillHit: true },
      },
      scenarioWorkspace: {
        activeScenarioId: 'scenario-0001',
        scenarios: [
          {
            id: 'scenario-0001',
            name: '方案 1',
            draft: { selectedActionId: 'action-0001' },
          },
        ],
      },
    });
  });

  it('migrates v2 project files through enemy toughness and defense defaults', () => {
    const v2Project = createWorkbenchProjectFileSnapshot({
      selection: {
        characterId: 109001,
        secondaryCharacterId: 101003,
        skillId: 10900101,
        enemyId: 300032,
      },
      enemyConfig: {
        level: 90,
        hpMultiplier: 1,
        defenseMultiplier: 1,
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
        },
      ],
      selectedActionId: 'action-0001',
    });
    v2Project.schemaVersion = 2;
    delete v2Project.enemyConfig.toughnessMultiplier;
    delete v2Project.enemyConfig.initialToughnessRatio;

    expect(parseWorkbenchProjectFile(v2Project)).toMatchObject({
      schemaVersion: WORKBENCH_DRAFT_SCHEMA_VERSION,
      enemyConfig: {
        level: 90,
        toughnessMultiplier: 1,
        initialToughnessRatio: 1,
        elementDefenseOverrides: {},
      },
    });
  });

  it('migrates v3 project files to v4 element defense defaults', () => {
    const v3Project = createWorkbenchProjectFileSnapshot({
      selection: {
        characterId: 109001,
        secondaryCharacterId: 101003,
        skillId: 10900101,
        enemyId: 300032,
      },
      enemyConfig: {
        level: 90,
        hpMultiplier: 1,
        defenseMultiplier: 1,
        toughnessMultiplier: 2,
        initialToughnessRatio: 0.5,
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
        },
      ],
      selectedActionId: 'action-0001',
    });
    v3Project.schemaVersion = 3;
    delete v3Project.enemyConfig.elementDefenseOverrides;

    expect(parseWorkbenchProjectFile(v3Project)).toMatchObject({
      schemaVersion: WORKBENCH_DRAFT_SCHEMA_VERSION,
      enemyConfig: {
        level: 90,
        toughnessMultiplier: 2,
        initialToughnessRatio: 0.5,
        elementDefenseOverrides: {},
      },
    });
  });

  it('migrates v4 project files to v5 project team slots', () => {
    const v4Project = createWorkbenchProjectFileSnapshot({
      selection: {
        characterId: 101007,
        secondaryCharacterId: 101010,
        skillId: 10100701,
        enemyId: 300032,
      },
      enemyConfig: {
        level: 90,
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
          skillId: 10100701,
          actorCharacterId: 101007,
          startMs: 0,
          durationMs: 1000,
          level: 1,
        },
      ],
      selectedActionId: 'action-0001',
    });
    v4Project.schemaVersion = 4;
    delete v4Project.teamSlots;

    expect(parseWorkbenchProjectFile(v4Project)).toMatchObject({
      schemaVersion: WORKBENCH_DRAFT_SCHEMA_VERSION,
      selection: {
        characterId: 101007,
        secondaryCharacterId: 101010,
      },
      teamSlots: [
        { slotId: 'team-slot-1', position: 0, characterId: 101007 },
        { slotId: 'team-slot-2', position: 1, characterId: 101010 },
        { slotId: 'team-slot-3', position: 2, characterId: 101003 },
      ],
      actorConfigs: [
        { characterId: 101007 },
        { characterId: 101010 },
        { characterId: 101003 },
      ],
    });
  });

  it('migrates v5 project files through nullable initial SP configs', () => {
    const v5Project = createWorkbenchProjectFileSnapshot({
      selection: {
        characterId: 109001,
        secondaryCharacterId: 101003,
        skillId: 10900101,
        enemyId: 300032,
      },
      actorConfigs: [
        { characterId: 109001, initialSp: 0.4 },
        { characterId: 101003, initialSp: 0.6 },
      ],
      actionDrafts: [
        {
          id: 'action-0001',
          type: 'skill',
          skillId: 10900101,
          actorCharacterId: 109001,
          startMs: 0,
          durationMs: 1000,
          level: 1,
        },
      ],
      selectedActionId: 'action-0001',
    });
    v5Project.schemaVersion = 5;
    v5Project.actorConfigs.forEach(config => delete config.initialSp);

    expect(parseWorkbenchProjectFile(v5Project)).toMatchObject({
      schemaVersion: WORKBENCH_DRAFT_SCHEMA_VERSION,
      actorConfigs: [
        { characterId: 109001, initialSp: null },
        { characterId: 101003, initialSp: null },
        { characterId: 101007, initialSp: null },
      ],
    });
  });

  it('migrates v13 projects and every scenario to the default profile selection', () => {
    const project = createWorkbenchProjectFileSnapshot({
      selection: {
        characterId: 109001,
        secondaryCharacterId: 101003,
        skillId: 10900101,
        enemyId: 300032,
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
        },
      ],
      selectedActionId: 'action-0001',
    });
    project.schemaVersion = 13;
    delete project.mechanicsProfileSelection;
    project.scenarioWorkspace.scenarios.forEach(scenario => {
      delete scenario.draft.mechanicsProfileSelection;
    });

    const migrated = parseWorkbenchProjectFile(project);
    const expectedSelection = {
      schemaVersion: 1,
      contractName: 'AzPrWorkbenchMechanicsProfileSelection',
      profileId: 'azpr-three-value-preview-v1',
      profileVersion: 1,
    };
    expect(migrated).toMatchObject({
      schemaVersion: 17,
      mechanicsProfileSelection: expectedSelection,
      scenarioWorkspace: {
        scenarios: [
          { draft: { mechanicsProfileSelection: expectedSelection } },
        ],
      },
    });
  });

  it('migrates v16 normalized actor and kibo SP into absolute points', () => {
    const project = createWorkbenchProjectFileSnapshot({
      selection: {
        characterId: 109001,
        secondaryCharacterId: 101003,
        skillId: 10900101,
        enemyId: 300032,
      },
      actorConfigs: [
        { characterId: 109001, initialSp: 0.25 },
        { characterId: 101003, initialSp: 1 },
      ],
      initialRuntimeState: {
        selfEnergyByActor: [
          {
            actorId: 'actor-109001',
            characterId: 109001,
            currentValue: 0.4,
            maxValue: 1,
          },
        ],
        kiboEnergyBySlot: [
          {
            slotId: 'team-slot-1',
            kiboId: 500001,
            currentValue: 0.6,
            maxValue: 1,
          },
        ],
      },
      actionDrafts: [],
      selectedActionId: '',
    });
    project.schemaVersion = 16;

    const migrated = parseWorkbenchProjectFile(project);

    expect(migrated).toMatchObject({
      schemaVersion: 17,
      actorConfigs: [
        { characterId: 109001, initialSp: 25 },
        { characterId: 101003, initialSp: 100 },
        { characterId: 101007, initialSp: null },
      ],
      initialRuntimeState: {
        selfEnergyByActor: [
          {
            actorId: 'actor-109001',
            currentValue: 40,
            maxValue: 100,
            valueUnit: 'sp',
          },
        ],
        kiboEnergyBySlot: [
          {
            slotId: 'team-slot-1',
            kiboId: 500001,
            currentValue: 60,
            maxValue: 100,
            valueUnit: 'sp',
          },
        ],
      },
    });
    expect(migrated.scenarioWorkspace.scenarios[0].draft.actorConfigs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ characterId: 109001, initialSp: 25 }),
        expect.objectContaining({ characterId: 101003, initialSp: 100 }),
      ])
    );
  });

  it('loads legacy v1 local storage and clears all storage generations', () => {
    const storage = new Map();
    const storageAdapter = {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    };
    const legacyStorageKey = LEGACY_WORKBENCH_DRAFT_STORAGE_KEYS.find(key =>
      key.endsWith(':v1')
    );
    storage.set(
      legacyStorageKey,
      JSON.stringify({
        schemaVersion: 1,
        game: 'azur-promilia',
        type: 'workbench-draft',
        selection: {
          characterId: 109001,
          secondaryCharacterId: 101003,
          skillId: 10900101,
          enemyId: 300032,
        },
        enemyConfig: {
          level: 88,
          hpMultiplier: 1,
          defenseMultiplier: 1,
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
          },
        ],
        selectedActionId: 'action-0001',
      })
    );

    expect(loadWorkbenchDraft(storageAdapter)).toMatchObject({
      schemaVersion: WORKBENCH_DRAFT_SCHEMA_VERSION,
      durationMs: 120_000,
      enemyConfig: {
        level: 88,
        toughnessMultiplier: 1,
        initialToughnessRatio: 1,
      },
      actorConfigs: [
        { characterId: 109001 },
        { characterId: 101003 },
        { characterId: 101007 },
      ],
      teamSlots: [
        { slotId: 'team-slot-1', position: 0, characterId: 109001 },
        { slotId: 'team-slot-2', position: 1, characterId: 101003 },
        { slotId: 'team-slot-3', position: 2, characterId: 101007 },
      ],
    });

    storage.set(WORKBENCH_DRAFT_STORAGE_KEY, '{}');
    LEGACY_WORKBENCH_DRAFT_STORAGE_KEYS.forEach(key => storage.set(key, '{}'));
    clearWorkbenchDraft(storageAdapter);
    expect(storage.has(WORKBENCH_DRAFT_STORAGE_KEY)).toBe(false);
    LEGACY_WORKBENCH_DRAFT_STORAGE_KEYS.forEach(key =>
      expect(storage.has(key)).toBe(false)
    );
  });

  it('rejects unrelated project files', () => {
    expect(
      parseWorkbenchProjectFile({
        schemaVersion: 1,
        game: 'other-game',
        type: WORKBENCH_PROJECT_FILE_TYPE,
      })
    ).toBeNull();
  });

  it('round-trips Workbench project share codes through the project file contract', () => {
    const code = createWorkbenchProjectShareCode(
      {
        selection: {
          characterId: 109001,
          secondaryCharacterId: 101003,
          skillId: 10900101,
          enemyId: 300032,
        },
        enemyConfig: {
          level: 92,
          hpMultiplier: 2.5,
          defenseMultiplier: 1,
          toughnessMultiplier: 1.5,
          initialToughnessRatio: 0.75,
          elementDefenseOverrides: {
            WATER_DEFENSE: 0.12,
          },
        },
        actorConfigs: [
          { characterId: 109001, initialSp: 0.2 },
          { characterId: 101003, initialSp: 0.8 },
        ],
        actionDrafts: [
          {
            id: 'action-0001',
            type: 'skill',
            skillId: 10900101,
            actorCharacterId: 109001,
            startMs: 0,
            durationMs: 1000,
            level: 1,
          },
          {
            id: 'action-0002',
            type: 'skill',
            skillId: 10100301,
            actorCharacterId: 101003,
            startMs: 1200,
            durationMs: 900,
            level: 2,
          },
        ],
        runtimeSampleCaptures: [
          {
            schemaVersion: 1,
            captureSessionId: 'share-runtime-capture-1',
            events: [
              {
                eventType: 'recover-sp-applied',
                actionId: 'action-0001',
                spDeltaApplied: 0.25,
              },
            ],
          },
        ],
        selectedActionId: 'action-0002',
      },
      '2026-07-10T05:00:00.000Z'
    );

    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(parseWorkbenchProjectShareCode(code)).toMatchObject({
      type: 'workbench-draft',
      savedAt: '2026-07-10T05:00:00.000Z',
      selectedActionId: 'action-0002',
      teamSlots: [
        { slotId: 'team-slot-1', position: 0, characterId: 109001 },
        { slotId: 'team-slot-2', position: 1, characterId: 101003 },
        { slotId: 'team-slot-3', position: 2, characterId: 101007 },
      ],
      enemyConfig: {
        level: 92,
        hpMultiplier: 2.5,
        toughnessMultiplier: 1.5,
        initialToughnessRatio: 0.75,
        elementDefenseOverrides: {
          WATER_DEFENSE: 0.12,
        },
      },
      actorConfigs: [
        { characterId: 109001, initialSp: 0.2 },
        { characterId: 101003, initialSp: 0.8 },
        { characterId: 101007, initialSp: null },
      ],
      runtimeSampleCaptures: [
        expect.objectContaining({
          captureSessionId: 'share-runtime-capture-1',
        }),
      ],
    });
  });

  it('round-trips tracking-only effect commands through JSON and share projects', () => {
    const state = {
      selection: {
        characterId: 109001,
        secondaryCharacterId: 101003,
        skillId: 10900101,
        enemyId: 300032,
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
          effectCommands: [
            {
              id: 'action-0001-effect-01',
              effectId: 'tracked-effect',
              effectName: '测试增益',
              operation: 'apply',
              targetKind: 'actor',
              targetId: 'actor-109001',
              offsetMs: 500,
              durationMs: 5000,
              stackMode: 'stack',
              stackDelta: 1,
              maxStacks: 3,
            },
          ],
        },
      ],
      selectedActionId: 'action-0001',
    };

    const exported = JSON.parse(
      serializeWorkbenchProjectFile(state, '2026-07-10T09:00:00.000Z')
    );
    const imported = parseWorkbenchProjectFile(exported);
    const shared = parseWorkbenchProjectShareCode(
      createWorkbenchProjectShareCode(state, '2026-07-10T09:00:00.000Z')
    );

    expect(exported.schemaVersion).toBe(WORKBENCH_DRAFT_SCHEMA_VERSION);
    expect(imported.actionDrafts[0].effectCommands).toEqual([
      expect.objectContaining({
        id: 'action-0001-effect-01',
        effectId: 'tracked-effect',
        targetId: 'actor-109001',
        durationMs: 5000,
        maxStacks: 3,
        appliedToCalculators: false,
      }),
    ]);
    expect(shared.actionDrafts[0].effectCommands).toEqual(
      imported.actionDrafts[0].effectCommands
    );
  });

  it('rejects invalid Workbench project share codes', () => {
    expect(parseWorkbenchProjectShareCode('not-a-project')).toBeNull();
    expect(parseWorkbenchProjectShareCode('')).toBeNull();
  });

  it('creates stable project file names', () => {
    expect(
      createWorkbenchProjectFileName({
        exportedAt: '2026-07-10T04:00:00.000Z',
        actionDrafts: [{ id: 'action-0001' }, { id: 'action-0002' }],
      })
    ).toBe('promilia-workbench-2026-07-10-2actions.promilia-workbench.json');
  });
});

function createInheritedState() {
  return {
    source: {
      sourceScenarioId: 'scenario-source',
      sourceScenarioName: '来源方案',
      boundaryId: 'cycle-boundary-source',
      boundaryTimeMs: 1000,
    },
    enemy: {
      enemyId: 'enemy-300032',
      hp: { currentValue: 850, maxValue: 1000 },
      toughness: { currentValue: 60, maxValue: 100 },
    },
    selfEnergyByActor: [
      {
        actorId: 'actor-109001',
        characterId: 109001,
        currentValue: 35,
        maxValue: 100,
      },
    ],
    activeEffects: [
      {
        instanceKey: 'actor|actor-109001|focus',
        effectId: 'focus',
        targetKind: 'actor',
        targetId: 'actor-109001',
        remainingDurationMs: 750,
      },
    ],
  };
}
