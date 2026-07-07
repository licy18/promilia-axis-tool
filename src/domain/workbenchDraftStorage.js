import {
  DEFAULT_WORKBENCH_ACTION_ID,
  DEFAULT_WORKBENCH_ENEMY_CONFIG,
  DEFAULT_WORKBENCH_SELECTION,
  createWorkbenchActionDraft,
  normalizeWorkbenchEnemyConfig,
  normalizeWorkbenchActionDrafts,
  normalizeWorkbenchSelection,
} from './workbenchProjectFactory';

export const WORKBENCH_DRAFT_SCHEMA_VERSION = 1;
export const WORKBENCH_DRAFT_STORAGE_KEY = 'promilia-axis-tool:workbench-draft:v1';

export function createDefaultWorkbenchDraftState() {
  return {
    selection: { ...DEFAULT_WORKBENCH_SELECTION },
    enemyConfig: { ...DEFAULT_WORKBENCH_ENEMY_CONFIG },
    actionDrafts: [createWorkbenchActionDraft()],
    selectedActionId: DEFAULT_WORKBENCH_ACTION_ID,
    savedAt: null,
  };
}

export function createWorkbenchDraftSnapshot(
  { selection, enemyConfig, actionDrafts, selectedActionId },
  savedAt = new Date().toISOString(),
) {
  const normalizedSelection = normalizeWorkbenchSelection(selection);
  const normalizedEnemyConfig = normalizeWorkbenchEnemyConfig(enemyConfig);
  const normalizedActions = ensureActionDrafts(actionDrafts, normalizedSelection);
  const normalizedSelectedActionId = normalizedActions.some((action) => action.id === selectedActionId)
    ? selectedActionId
    : normalizedActions[0].id;

  return {
    schemaVersion: WORKBENCH_DRAFT_SCHEMA_VERSION,
    game: 'azur-promilia',
    type: 'workbench-draft',
    savedAt,
    selection: normalizedSelection,
    enemyConfig: normalizedEnemyConfig,
    actionDrafts: normalizedActions,
    selectedActionId: normalizedSelectedActionId,
  };
}

export function parseWorkbenchDraft(rawDraft) {
  if (!rawDraft) {
    return null;
  }

  try {
    const draft = typeof rawDraft === 'string' ? JSON.parse(rawDraft) : rawDraft;
    if (draft.schemaVersion !== WORKBENCH_DRAFT_SCHEMA_VERSION || draft.type !== 'workbench-draft') {
      return null;
    }

    return createWorkbenchDraftSnapshot(draft, draft.savedAt ?? null);
  } catch {
    return null;
  }
}

export function saveWorkbenchDraft(storage, state) {
  if (!storage) {
    return null;
  }

  const snapshot = createWorkbenchDraftSnapshot(state);
  storage.setItem(WORKBENCH_DRAFT_STORAGE_KEY, JSON.stringify(snapshot));
  return snapshot;
}

export function loadWorkbenchDraft(storage) {
  if (!storage) {
    return null;
  }

  return parseWorkbenchDraft(storage.getItem(WORKBENCH_DRAFT_STORAGE_KEY));
}

export function clearWorkbenchDraft(storage) {
  storage?.removeItem(WORKBENCH_DRAFT_STORAGE_KEY);
}

function ensureActionDrafts(actionDrafts, selection) {
  const normalizedActions = normalizeWorkbenchActionDrafts(actionDrafts, selection);
  if (normalizedActions.length > 0) {
    return normalizedActions;
  }

  const normalizedSelection = normalizeWorkbenchSelection(selection);
  return [
    createWorkbenchActionDraft({
      skillId: normalizedSelection.skillId,
      actorCharacterId: normalizedSelection.characterId,
    }),
  ];
}
