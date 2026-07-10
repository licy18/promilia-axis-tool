import { describe, expect, it } from 'vitest';
import {
  WORKBENCH_PROJECT_FILE_TYPE,
  createWorkbenchProjectFileName,
  createWorkbenchProjectFileSnapshot,
  parseWorkbenchProjectFile,
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
          enemyConfig: {
            level: 80,
            hpMultiplier: 1.5,
            defenseMultiplier: 0.8,
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
          selectedActionId: 'action-0002',
        },
        '2026-07-10T04:00:00.000Z'
      )
    );

    expect(exported).toMatchObject({
      schemaVersion: 1,
      game: 'azur-promilia',
      type: WORKBENCH_PROJECT_FILE_TYPE,
      exportedAt: '2026-07-10T04:00:00.000Z',
      selectedActionId: 'action-0002',
    });

    const imported = parseWorkbenchProjectFile(exported);

    expect(imported).toMatchObject({
      schemaVersion: 1,
      game: 'azur-promilia',
      type: 'workbench-draft',
      savedAt: '2026-07-10T04:00:00.000Z',
      enemyConfig: {
        level: 80,
        hpMultiplier: 1.5,
        defenseMultiplier: 0.8,
      },
      segmentSplitOptions: {
        intervalMs: 1800,
        startAfterSelectedAction: true,
        skipExistingSegments: true,
      },
      selectedActionId: 'action-0002',
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
      type: 'workbench-draft',
    };

    expect(parseWorkbenchProjectFile(legacyDraftFile)).toMatchObject({
      type: 'workbench-draft',
      selectedActionId: 'action-0001',
    });
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

  it('creates stable project file names', () => {
    expect(
      createWorkbenchProjectFileName({
        exportedAt: '2026-07-10T04:00:00.000Z',
        actionDrafts: [{ id: 'action-0001' }, { id: 'action-0002' }],
      })
    ).toBe('promilia-workbench-2026-07-10-2actions.promilia-workbench.json');
  });
});
