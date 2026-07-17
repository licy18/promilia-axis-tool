import { describe, expect, it } from 'vitest';
import { ACTION_TYPES } from '../../domain/projectSchema';
import {
  createWorkbenchTimelineFragment,
  WORKBENCH_TIMELINE_FRAGMENT_SCHEMA_VERSION,
} from '../../domain/workbenchTimelineFragment';
import {
  WORKBENCH_TIMELINE_FRAGMENT_STORAGE_KEY,
  addWorkbenchTimelineFragment,
  deleteWorkbenchTimelineFragment,
  duplicateWorkbenchTimelineFragment,
  filterWorkbenchTimelineFragments,
  importWorkbenchTimelineFragmentLibrary,
  loadWorkbenchTimelineFragmentLibrary,
  parseWorkbenchTimelineFragmentLibrary,
  serializeWorkbenchTimelineFragmentLibrary,
} from '../../domain/workbenchTimelineFragmentStorage';
import {
  createDefaultWorkbenchTeamSlots,
  createWorkbenchActionDraft,
  getSkillsForCharacter,
} from '../../domain/workbenchProjectFactory';

describe('workbench timeline fragment storage', () => {
  it('keeps fragments in a separate versioned local library with CRUD operations', () => {
    const storage = createMemoryStorage();
    const fragment = createFragment('fragment-a', '末音起手', ['起手']);

    const added = addWorkbenchTimelineFragment(
      storage,
      fragment,
      '2026-07-17T08:00:00.000Z'
    );
    expect(storage.has(WORKBENCH_TIMELINE_FRAGMENT_STORAGE_KEY)).toBe(true);
    expect(added).toMatchObject({
      fragmentSchemaVersion: WORKBENCH_TIMELINE_FRAGMENT_SCHEMA_VERSION,
      summary: { fragmentCount: 1, actionCount: 1, tags: ['起手'] },
    });

    const duplicated = duplicateWorkbenchTimelineFragment(
      storage,
      'fragment-a',
      { id: 'fragment-b' },
      '2026-07-17T08:05:00.000Z'
    );
    expect(duplicated.fragments).toEqual([
      expect.objectContaining({ id: 'fragment-b', name: '末音起手 副本' }),
      expect.objectContaining({ id: 'fragment-a', name: '末音起手' }),
    ]);
    expect(
      filterWorkbenchTimelineFragments(duplicated.fragments, {
        query: '起手',
        tag: '起手',
      })
    ).toHaveLength(2);

    const deleted = deleteWorkbenchTimelineFragment(
      storage,
      'fragment-a',
      '2026-07-17T08:10:00.000Z'
    );
    expect(deleted.fragments.map(item => item.id)).toEqual(['fragment-b']);
    expect(
      loadWorkbenchTimelineFragmentLibrary(storage).fragments
    ).toHaveLength(1);
  });

  it('exports and merges one JSON library contract without accepting foreign files', () => {
    const fragmentA = createFragment('fragment-a', '片段 A', ['A']);
    const fragmentB = createFragment('fragment-b', '片段 B', ['B']);
    const storage = createMemoryStorage();
    addWorkbenchTimelineFragment(
      storage,
      fragmentA,
      '2026-07-17T08:00:00.000Z'
    );
    const exported = serializeWorkbenchTimelineFragmentLibrary(
      [fragmentB],
      '2026-07-17T08:10:00.000Z'
    );

    const imported = importWorkbenchTimelineFragmentLibrary(
      storage,
      exported,
      '2026-07-17T08:20:00.000Z'
    );
    expect(imported.fragments.map(item => item.id).sort()).toEqual([
      'fragment-a',
      'fragment-b',
    ]);
    expect(parseWorkbenchTimelineFragmentLibrary(exported)).toMatchObject({
      type: 'workbench-timeline-fragment-library',
      summary: { fragmentCount: 1, actionCount: 1 },
    });
    expect(importWorkbenchTimelineFragmentLibrary(storage, '{}')).toBeNull();
  });
});

function createFragment(id, name, tags) {
  const teamSlots = createDefaultWorkbenchTeamSlots();
  const skill = getSkillsForCharacter(teamSlots[0].characterId)[0];
  return createWorkbenchTimelineFragment({
    teamSlots,
    actions: [
      createWorkbenchActionDraft({
        id: 'action-0001',
        type: ACTION_TYPES.SKILL,
        actorCharacterId: teamSlots[0].characterId,
        skillId: skill.id,
        startMs: 500,
        durationMs: 1000,
      }),
    ],
    selectedActionIds: ['action-0001'],
    metadata: { id, name, tags },
    now: '2026-07-17T08:00:00.000Z',
  });
}

function createMemoryStorage() {
  const storage = new Map();
  storage.getItem = key => storage.get(key) ?? null;
  storage.setItem = (key, value) => storage.set(key, value);
  storage.removeItem = key => storage.delete(key);
  return storage;
}
