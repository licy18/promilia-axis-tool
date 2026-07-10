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
  loadWorkbenchDraft,
  parseWorkbenchProjectFile,
  parseWorkbenchProjectShareCode,
  serializeWorkbenchProjectFile,
} from '../../domain/workbenchDraftStorage';

describe('workbench draft storage project files', () => {
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
      ],
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
    });

    const imported = parseWorkbenchProjectFile(exported);

    expect(imported).toMatchObject({
      schemaVersion: WORKBENCH_DRAFT_SCHEMA_VERSION,
      game: 'azur-promilia',
      type: 'workbench-draft',
      savedAt: '2026-07-10T04:00:00.000Z',
      teamSlots: [
        { slotId: 'team-slot-1', position: 0, characterId: 109001 },
        { slotId: 'team-slot-2', position: 1, characterId: 101003 },
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
    expect(imported.actionDrafts).toHaveLength(2);
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
    };

    expect(parseWorkbenchProjectFile(legacyDraftFile)).toMatchObject({
      schemaVersion: WORKBENCH_DRAFT_SCHEMA_VERSION,
      type: 'workbench-draft',
      selectedActionId: 'action-0001',
      actorConfigs: [{ characterId: 109001 }, { characterId: 101003 }],
      teamSlots: [
        { slotId: 'team-slot-1', position: 0, characterId: 109001 },
        { slotId: 'team-slot-2', position: 1, characterId: 101003 },
      ],
      enemyConfig: {
        toughnessMultiplier: 1,
        initialToughnessRatio: 1,
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
      ],
      actorConfigs: [{ characterId: 101007 }, { characterId: 101010 }],
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
      ],
    });
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
      enemyConfig: {
        level: 88,
        toughnessMultiplier: 1,
        initialToughnessRatio: 1,
      },
      actorConfigs: [{ characterId: 109001 }, { characterId: 101003 }],
      teamSlots: [
        { slotId: 'team-slot-1', position: 0, characterId: 109001 },
        { slotId: 'team-slot-2', position: 1, characterId: 101003 },
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
