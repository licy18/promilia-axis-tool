import {
  DEFAULT_WORKBENCH_ACTION_ID,
  DEFAULT_WORKBENCH_ENEMY_CONFIG,
  DEFAULT_WORKBENCH_SELECTION,
  createDefaultWorkbenchActorConfigs,
  createDefaultWorkbenchTeamSlots,
  createWorkbenchActionDraft,
  normalizeWorkbenchActorConfigs,
  normalizeWorkbenchEnemyConfig,
  normalizeWorkbenchActionDrafts,
  normalizeWorkbenchSelection,
  normalizeWorkbenchTeamSlots,
} from './workbenchProjectFactory';
import { normalizeWorkbenchRuntimeSampleCaptures } from './workbenchRuntimeSampleCapture';
import { normalizeWorkbenchActionRelations } from './workbenchActionRelations';
import { normalizeWorkbenchCycleBoundaries } from './workbenchCycleBoundaries';
import { normalizeWorkbenchScenarioWorkspace } from './workbenchScenarioWorkspace';
import { normalizeInitialRuntimeState } from './initialRuntimeState';
import {
  normalizeWorkbenchConfigurationSelection,
  normalizeWorkbenchConfigurationWorkspace,
} from './workbenchConfigurationLibrary';
import { normalizeWorkbenchMechanicsProfileSelection } from './workbenchMechanicsProfileSelection';
import {
  createWorkbenchGameDataCompatibilityReport,
  normalizeWorkbenchGameDataBinding,
  rememberWorkbenchGameDataCompatibilityReport,
} from './workbenchGameDataCatalog';

export const WORKBENCH_DRAFT_SCHEMA_VERSION = 16;
export const WORKBENCH_DRAFT_STORAGE_KEY =
  'promilia-axis-tool:workbench-draft:v16';
export const LEGACY_WORKBENCH_DRAFT_STORAGE_KEYS = Object.freeze([
  'promilia-axis-tool:workbench-draft:v15',
  'promilia-axis-tool:workbench-draft:v14',
  'promilia-axis-tool:workbench-draft:v13',
  'promilia-axis-tool:workbench-draft:v12',
  'promilia-axis-tool:workbench-draft:v11',
  'promilia-axis-tool:workbench-draft:v10',
  'promilia-axis-tool:workbench-draft:v9',
  'promilia-axis-tool:workbench-draft:v8',
  'promilia-axis-tool:workbench-draft:v7',
  'promilia-axis-tool:workbench-draft:v6',
  'promilia-axis-tool:workbench-draft:v5',
  'promilia-axis-tool:workbench-draft:v4',
  'promilia-axis-tool:workbench-draft:v3',
  'promilia-axis-tool:workbench-draft:v2',
  'promilia-axis-tool:workbench-draft:v1',
]);
export const WORKBENCH_DRAFT_FILE_TYPE = 'workbench-draft';
export const WORKBENCH_PROJECT_FILE_TYPE = 'workbench-project';
export const WORKBENCH_PROJECT_FILE_EXTENSION = 'promilia-workbench.json';
export const WORKBENCH_PROJECT_SHARE_PARAM = 'workbenchProject';
export const DEFAULT_WORKBENCH_SEGMENT_SPLIT_OPTIONS = Object.freeze({
  intervalMs: 2000,
  startAfterSelectedAction: false,
  skipExistingSegments: false,
});

export function createDefaultWorkbenchDraftState() {
  const teamSlots = createDefaultWorkbenchTeamSlots();
  const selection = normalizeWorkbenchSelection(
    DEFAULT_WORKBENCH_SELECTION,
    teamSlots
  );
  return createWorkbenchDraftSnapshot(
    {
      selection,
      teamSlots,
      actorConfigs: createDefaultWorkbenchActorConfigs(selection),
      enemyConfig: { ...DEFAULT_WORKBENCH_ENEMY_CONFIG },
      gameDataBinding: normalizeWorkbenchGameDataBinding(),
      mechanicsProfileSelection: normalizeWorkbenchMechanicsProfileSelection(),
      segmentSplitOptions: { ...DEFAULT_WORKBENCH_SEGMENT_SPLIT_OPTIONS },
      actionDrafts: [createWorkbenchActionDraft()],
      actionRelations: [],
      cycleBoundaries: [],
      initialRuntimeState: null,
      runtimeSampleCaptures: [],
      selectedActionId: DEFAULT_WORKBENCH_ACTION_ID,
    },
    null
  );
}

export function createWorkbenchDraftSnapshot(
  state,
  savedAt = new Date().toISOString()
) {
  const gameDataCompatibilityReport =
    createWorkbenchGameDataCompatibilityReport(state);
  const activeDraft = createWorkbenchScenarioDraftSnapshot(state);
  const scenarioWorkspace = normalizeWorkbenchScenarioWorkspace(
    state?.scenarioWorkspace,
    activeDraft,
    createWorkbenchScenarioDraftSnapshot
  );
  const configurationWorkspace = normalizeWorkbenchConfigurationWorkspace({
    configurationLibrary: state?.configurationLibrary,
    scenarioWorkspace,
    activeDraft,
  });

  const snapshot = {
    schemaVersion: WORKBENCH_DRAFT_SCHEMA_VERSION,
    game: 'azur-promilia',
    type: WORKBENCH_DRAFT_FILE_TYPE,
    savedAt,
    gameDataBinding: normalizeWorkbenchGameDataBinding(state?.gameDataBinding),
    ...configurationWorkspace.activeDraft,
    configurationLibrary: configurationWorkspace.configurationLibrary,
    scenarioWorkspace: configurationWorkspace.scenarioWorkspace,
  };
  return rememberWorkbenchGameDataCompatibilityReport(
    snapshot,
    gameDataCompatibilityReport
  );
}

export function createWorkbenchScenarioDraftSnapshot({
  selection,
  teamSlots,
  actorConfigs,
  enemyConfig,
  configurationSelection,
  mechanicsProfileSelection,
  segmentSplitOptions,
  actionDrafts,
  actionRelations,
  cycleBoundaries,
  initialRuntimeState,
  runtimeSampleCaptures,
  selectedActionId,
} = {}) {
  const normalizedTeamSlots = normalizeWorkbenchTeamSlots(teamSlots, selection);
  const normalizedSelection = normalizeWorkbenchSelection(
    selection,
    normalizedTeamSlots
  );
  const normalizedActorConfigs = normalizeWorkbenchActorConfigs(
    actorConfigs,
    normalizedSelection,
    normalizedTeamSlots
  );
  const normalizedEnemyConfig = normalizeWorkbenchEnemyConfig(enemyConfig);
  const normalizedSegmentSplitOptions =
    normalizeWorkbenchSegmentSplitOptions(segmentSplitOptions);
  const normalizedActions = ensureActionDrafts(
    actionDrafts,
    normalizedSelection,
    normalizedTeamSlots
  );
  const normalizedSelectedActionId = normalizedActions.some(
    action => action.id === selectedActionId
  )
    ? selectedActionId
    : normalizedActions[0].id;

  return {
    selection: normalizedSelection,
    teamSlots: normalizedTeamSlots,
    actorConfigs: normalizedActorConfigs,
    enemyConfig: normalizedEnemyConfig,
    configurationSelection: normalizeWorkbenchConfigurationSelection(
      configurationSelection
    ),
    mechanicsProfileSelection: normalizeWorkbenchMechanicsProfileSelection(
      mechanicsProfileSelection
    ),
    segmentSplitOptions: normalizedSegmentSplitOptions,
    actionDrafts: normalizedActions,
    actionRelations: normalizeWorkbenchActionRelations(
      actionRelations,
      normalizedActions
    ),
    cycleBoundaries: normalizeWorkbenchCycleBoundaries(cycleBoundaries),
    initialRuntimeState: normalizeInitialRuntimeState(initialRuntimeState),
    runtimeSampleCaptures: normalizeWorkbenchRuntimeSampleCaptures(
      runtimeSampleCaptures
    ),
    selectedActionId: normalizedSelectedActionId,
  };
}

export function createWorkbenchProjectFileSnapshot(
  state,
  exportedAt = new Date().toISOString()
) {
  const snapshot = createWorkbenchDraftSnapshot(state, exportedAt);
  return {
    ...snapshot,
    type: WORKBENCH_PROJECT_FILE_TYPE,
    exportedAt,
  };
}

export function serializeWorkbenchProjectFile(state, exportedAt) {
  return JSON.stringify(
    createWorkbenchProjectFileSnapshot(state, exportedAt),
    null,
    2
  );
}

export function createWorkbenchProjectShareCode(state, exportedAt) {
  return encodeBase64Url(serializeWorkbenchProjectFile(state, exportedAt));
}

export function parseWorkbenchProjectShareCode(rawCode) {
  const code = typeof rawCode === 'string' ? rawCode.trim() : '';
  if (!code) {
    return null;
  }

  try {
    return parseWorkbenchProjectFile(decodeBase64Url(code));
  } catch {
    return null;
  }
}

export function parseWorkbenchProjectFile(rawProject) {
  const project = parseWorkbenchDraftPayload(rawProject);
  if (!project || !isSupportedWorkbenchProjectPayload(project)) {
    return null;
  }
  return createWorkbenchDraftSnapshot(
    project,
    project.savedAt ?? project.exportedAt ?? null
  );
}

export function createWorkbenchProjectFileName(snapshot, now = new Date()) {
  const savedAt =
    snapshot?.exportedAt ?? snapshot?.savedAt ?? now.toISOString();
  const dateText =
    String(savedAt).slice(0, 10) || now.toISOString().slice(0, 10);
  const actionCount = Array.isArray(snapshot?.actionDrafts)
    ? snapshot.actionDrafts.length
    : 0;
  return `promilia-workbench-${dateText}-${actionCount}actions.${WORKBENCH_PROJECT_FILE_EXTENSION}`;
}

export function normalizeWorkbenchSegmentSplitOptions(options = {}) {
  const source = options ?? {};

  return {
    intervalMs: clampNumber(
      source.intervalMs,
      100,
      10000,
      DEFAULT_WORKBENCH_SEGMENT_SPLIT_OPTIONS.intervalMs
    ),
    startAfterSelectedAction:
      source.startAfterSelectedAction == null
        ? DEFAULT_WORKBENCH_SEGMENT_SPLIT_OPTIONS.startAfterSelectedAction
        : Boolean(source.startAfterSelectedAction),
    skipExistingSegments:
      source.skipExistingSegments == null
        ? DEFAULT_WORKBENCH_SEGMENT_SPLIT_OPTIONS.skipExistingSegments
        : Boolean(source.skipExistingSegments),
  };
}

export function parseWorkbenchDraft(rawDraft) {
  const draft = parseWorkbenchDraftPayload(rawDraft);
  if (!draft || !isWorkbenchDraftPayload(draft)) {
    return null;
  }

  return createWorkbenchDraftSnapshot(draft, draft.savedAt ?? null);
}

function parseWorkbenchDraftPayload(rawDraft) {
  if (!rawDraft) {
    return null;
  }

  try {
    return typeof rawDraft === 'string' ? JSON.parse(rawDraft) : rawDraft;
  } catch {
    return null;
  }
}

function isWorkbenchDraftPayload(payload) {
  return (
    isSupportedWorkbenchDraftSchema(payload?.schemaVersion) &&
    payload?.game === 'azur-promilia' &&
    payload?.type === WORKBENCH_DRAFT_FILE_TYPE
  );
}

function isSupportedWorkbenchProjectPayload(payload) {
  return (
    isSupportedWorkbenchDraftSchema(payload?.schemaVersion) &&
    payload?.game === 'azur-promilia' &&
    [WORKBENCH_DRAFT_FILE_TYPE, WORKBENCH_PROJECT_FILE_TYPE].includes(
      payload?.type
    )
  );
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

  for (const storageKey of [
    WORKBENCH_DRAFT_STORAGE_KEY,
    ...LEGACY_WORKBENCH_DRAFT_STORAGE_KEYS,
  ]) {
    const draft = parseWorkbenchDraft(storage.getItem(storageKey));
    if (draft) {
      return draft;
    }
  }
  return null;
}

export function clearWorkbenchDraft(storage) {
  storage?.removeItem(WORKBENCH_DRAFT_STORAGE_KEY);
  LEGACY_WORKBENCH_DRAFT_STORAGE_KEYS.forEach(storageKey =>
    storage?.removeItem(storageKey)
  );
}

function isSupportedWorkbenchDraftSchema(schemaVersion) {
  const version = Number(schemaVersion);
  return (
    Number.isInteger(version) &&
    version >= 1 &&
    version <= WORKBENCH_DRAFT_SCHEMA_VERSION
  );
}

function ensureActionDrafts(actionDrafts, selection, teamSlots) {
  const normalizedActions = normalizeWorkbenchActionDrafts(
    actionDrafts,
    selection,
    teamSlots
  );
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

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

function encodeBase64Url(text) {
  return encodeBase64(text)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '');
}

function decodeBase64Url(code) {
  const base64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const paddingLength = (4 - (base64.length % 4)) % 4;
  return decodeBase64(base64.padEnd(base64.length + paddingLength, '='));
}

function encodeBase64(text) {
  const buffer = globalThis.Buffer;
  if (typeof buffer?.from === 'function') {
    return buffer.from(text, 'utf8').toString('base64');
  }

  if (typeof TextEncoder !== 'undefined' && typeof btoa === 'function') {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(
        ...bytes.subarray(index, index + chunkSize)
      );
    }
    return btoa(binary);
  }

  throw new Error('Base64 encoding is not available.');
}

function decodeBase64(base64) {
  const buffer = globalThis.Buffer;
  if (typeof buffer?.from === 'function') {
    return buffer.from(base64, 'base64').toString('utf8');
  }

  if (typeof TextDecoder !== 'undefined' && typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new TextDecoder().decode(bytes);
  }

  throw new Error('Base64 decoding is not available.');
}
