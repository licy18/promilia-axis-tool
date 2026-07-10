import { describe, expect, it } from 'vitest';
import {
  WORKBENCH_DRAFT_SCHEMA_VERSION,
  createDefaultWorkbenchDraftState,
  createWorkbenchProjectFileSnapshot,
} from '../../domain/workbenchDraftStorage';
import {
  WORKBENCH_PRESET_STORAGE_KEY,
  addWorkbenchPreset,
  createWorkbenchDraftFromPreset,
  createWorkbenchPresetSnapshot,
  deleteWorkbenchPreset,
  duplicateWorkbenchPreset,
  filterWorkbenchPresets,
  loadWorkbenchPresetLibrary,
  parseWorkbenchPresetLibrary,
} from '../../domain/workbenchPresetStorage';

describe('workbench preset storage', () => {
  it('stores a complete v8 Workbench project snapshot with searchable metadata', () => {
    const draft = createPresetDraft();
    const preset = createWorkbenchPresetSnapshot(
      draft,
      {
        id: 'preset-endgame-1',
        name: '末音双人循环',
        description: '带削韧采样的 20 秒轴',
        tags: '末音, 双人，削韧',
        summary: {
          actorNames: ['末音', '寒悠悠'],
          enemyName: '训练目标',
        },
      },
      '2026-07-10T12:30:00.000Z'
    );

    expect(preset).toMatchObject({
      schemaVersion: 1,
      id: 'preset-endgame-1',
      name: '末音双人循环',
      tags: ['末音', '双人', '削韧'],
      sourceProjectSchemaVersion: WORKBENCH_DRAFT_SCHEMA_VERSION,
      compatibilityStatus: 'ready',
      summary: {
        actionCount: draft.actionDrafts.length,
        actorNames: ['末音', '寒悠悠'],
        enemyName: '训练目标',
        effectCommandCount: 1,
        runtimeSampleCaptureCount: 1,
      },
      projectFile: {
        schemaVersion: WORKBENCH_DRAFT_SCHEMA_VERSION,
        actorConfigs: expect.any(Array),
        enemyConfig: expect.any(Object),
        runtimeSampleCaptures: [
          expect.objectContaining({ captureSessionId: 'preset-capture-1' }),
        ],
      },
    });
    expect(
      filterWorkbenchPresets([preset], { query: '训练目标', tag: '削韧' })
    ).toEqual([preset]);
    expect(
      filterWorkbenchPresets([preset], { query: '寒悠悠', tag: '其他' })
    ).toEqual([]);

    const restored = createWorkbenchDraftFromPreset(preset);
    expect(restored).toMatchObject({
      actionDrafts: [
        expect.objectContaining({
          id: draft.actionDrafts[0].id,
          level: 3,
          effectCommands: [
            expect.objectContaining({ effectId: 'preset-buff' }),
          ],
        }),
      ],
      runtimeSampleCaptures: [
        expect.objectContaining({ captureSessionId: 'preset-capture-1' }),
      ],
    });
  });

  it('adds, duplicates, and deletes presets through one versioned local library', () => {
    const storage = createMemoryStorage();
    const preset = createWorkbenchPresetSnapshot(
      createPresetDraft(),
      { id: 'preset-a', name: '第一套', tags: ['首发'] },
      '2026-07-10T12:00:00.000Z'
    );

    expect(
      addWorkbenchPreset(storage, preset, '2026-07-10T12:00:00.000Z').summary
    ).toMatchObject({ presetCount: 1, readyCount: 1 });
    expect(storage.has(WORKBENCH_PRESET_STORAGE_KEY)).toBe(true);

    const duplicated = duplicateWorkbenchPreset(
      storage,
      'preset-a',
      { id: 'preset-b' },
      '2026-07-10T12:05:00.000Z'
    );
    expect(duplicated).toMatchObject({
      summary: { presetCount: 2, readyCount: 2 },
      presets: [
        expect.objectContaining({ id: 'preset-b', name: '第一套 副本' }),
        expect.objectContaining({ id: 'preset-a', name: '第一套' }),
      ],
    });

    const deleted = deleteWorkbenchPreset(
      storage,
      'preset-a',
      '2026-07-10T12:10:00.000Z'
    );
    expect(deleted).toMatchObject({
      summary: { presetCount: 1 },
      presets: [expect.objectContaining({ id: 'preset-b' })],
    });
    expect(loadWorkbenchPresetLibrary(storage).presets).toHaveLength(1);
  });

  it('migrates compatible legacy project schemas and keeps incompatible items disabled', () => {
    const v7Project = createWorkbenchProjectFileSnapshot(createPresetDraft());
    v7Project.schemaVersion = 7;
    delete v7Project.runtimeSampleCaptures;
    const library = parseWorkbenchPresetLibrary([
      {
        id: 'legacy-ready',
        name: '旧版可迁移轴',
        tags: ['旧版'],
        projectFile: v7Project,
        createdAt: '2026-07-09T12:00:00.000Z',
      },
      {
        id: 'legacy-broken',
        name: '旧版未知结构',
        projectData: { version: 0, actions: 'invalid' },
        createdAt: '2026-07-08T12:00:00.000Z',
      },
    ]);

    expect(library).toMatchObject({
      summary: {
        presetCount: 2,
        migratedCount: 1,
        incompatibleCount: 1,
      },
      presets: [
        expect.objectContaining({
          id: 'legacy-ready',
          compatibilityStatus: 'migrated-project-schema',
          sourceProjectSchemaVersion: 7,
          projectFile: expect.objectContaining({
            schemaVersion: WORKBENCH_DRAFT_SCHEMA_VERSION,
          }),
        }),
        expect.objectContaining({
          id: 'legacy-broken',
          compatibilityStatus: 'incompatible-project-schema',
        }),
      ],
    });
    expect(createWorkbenchDraftFromPreset(library.presets[0])).not.toBeNull();
    expect(createWorkbenchDraftFromPreset(library.presets[1])).toBeNull();
  });
});

function createPresetDraft() {
  const draft = createDefaultWorkbenchDraftState();
  draft.actionDrafts[0] = {
    ...draft.actionDrafts[0],
    level: 3,
    effectCommands: [
      {
        id: 'preset-buff-command',
        effectId: 'preset-buff',
        name: '预设增益',
        operation: 'apply',
        targetKind: 'actor',
        offsetMs: 0,
        durationMs: 3000,
        stackMode: 'refresh',
        stackDelta: 1,
        maxStacks: 1,
      },
    ],
  };
  draft.runtimeSampleCaptures = [
    {
      schemaVersion: 1,
      captureSessionId: 'preset-capture-1',
      events: [
        {
          eventType: 'toughness-damage-applied',
          actionId: draft.actionDrafts[0].id,
          actorId: 'actor-109001',
          targetId: 'enemy-300032',
          targetEntityId: 'runtime-enemy',
          sourceElementConfigId: 109001081,
          frameIndex: 12,
          toughnessBefore: 100,
          toughnessAfter: 90,
          toughnessDeltaApplied: 10,
        },
      ],
    },
  ];
  return draft;
}

function createMemoryStorage() {
  const storage = new Map();
  storage.getItem = key => storage.get(key) ?? null;
  storage.setItem = (key, value) => storage.set(key, value);
  storage.removeItem = key => storage.delete(key);
  return storage;
}
