import {
  WORKBENCH_DRAFT_SCHEMA_VERSION,
  createWorkbenchProjectFileSnapshot,
  parseWorkbenchProjectFile,
} from './workbenchDraftStorage';
import { getWorkbenchGameDataCompatibilityReport } from './workbenchGameDataCatalog';

export const WORKBENCH_PRESET_LIBRARY_SCHEMA_VERSION = 1;
export const WORKBENCH_PRESET_LIBRARY_TYPE = 'workbench-preset-library';
export const WORKBENCH_PRESET_STORAGE_KEY =
  'promilia-axis-tool:workbench-presets:v1';
export const LEGACY_WORKBENCH_PRESET_STORAGE_KEYS = ['promilia_presets'];

const PRESET_COMPATIBILITY_READY = 'ready';
const PRESET_COMPATIBILITY_MIGRATED = 'migrated-project-schema';
const PRESET_COMPATIBILITY_INCOMPATIBLE = 'incompatible-project-schema';

export function createWorkbenchPresetSnapshot(
  draftState,
  metadata = {},
  now = new Date().toISOString()
) {
  const projectFile = createWorkbenchProjectFileSnapshot(draftState, now);
  const id =
    normalizeText(metadata.id) ??
    createWorkbenchPresetId(now, metadata.randomSuffix);
  const name =
    normalizeText(metadata.name) ??
    normalizeText(metadata.projectName) ??
    `排轴预设 ${String(now).slice(0, 10)}`;

  return {
    schemaVersion: WORKBENCH_PRESET_LIBRARY_SCHEMA_VERSION,
    id,
    name,
    description: normalizeText(metadata.description) ?? '',
    tags: normalizeWorkbenchPresetTags(metadata.tags),
    createdAt: normalizeIsoDate(metadata.createdAt) ?? now,
    updatedAt: now,
    sourceProjectSchemaVersion: projectFile.schemaVersion,
    compatibilityStatus: PRESET_COMPATIBILITY_READY,
    summary: createWorkbenchPresetSummary(projectFile, metadata.summary),
    projectFile,
  };
}

export function parseWorkbenchPresetLibrary(rawLibrary) {
  const payload = parseJsonValue(rawLibrary);
  const isLegacyArray = Array.isArray(payload);
  if (!payload || (!isLegacyArray && typeof payload !== 'object')) {
    return createEmptyWorkbenchPresetLibrary();
  }
  if (
    !isLegacyArray &&
    ((payload.game && payload.game !== 'azur-promilia') ||
      (payload.type && payload.type !== WORKBENCH_PRESET_LIBRARY_TYPE))
  ) {
    return createEmptyWorkbenchPresetLibrary();
  }

  const presetInputs = isLegacyArray
    ? payload
    : Array.isArray(payload.presets)
      ? payload.presets
      : [];
  const presets = presetInputs
    .map((preset, index) => normalizeWorkbenchPreset(preset, index))
    .filter(Boolean)
    .sort(compareWorkbenchPresets);

  return {
    schemaVersion: WORKBENCH_PRESET_LIBRARY_SCHEMA_VERSION,
    game: 'azur-promilia',
    type: WORKBENCH_PRESET_LIBRARY_TYPE,
    updatedAt:
      normalizeIsoDate(isLegacyArray ? null : payload.updatedAt) ?? null,
    presets,
    summary: summarizeWorkbenchPresetLibrary(presets),
  };
}

export function loadWorkbenchPresetLibrary(storage = globalThis.localStorage) {
  if (!storage?.getItem) {
    return createEmptyWorkbenchPresetLibrary();
  }

  for (const key of [
    WORKBENCH_PRESET_STORAGE_KEY,
    ...LEGACY_WORKBENCH_PRESET_STORAGE_KEYS,
  ]) {
    const rawLibrary = storage.getItem(key);
    if (!rawLibrary) {
      continue;
    }
    const library = parseWorkbenchPresetLibrary(rawLibrary);
    return {
      ...library,
      sourceStorageKey: key,
      migratedFromLegacyStorage: key !== WORKBENCH_PRESET_STORAGE_KEY,
    };
  }

  return createEmptyWorkbenchPresetLibrary();
}

export function saveWorkbenchPresetLibrary(
  storage,
  presets,
  now = new Date().toISOString()
) {
  if (!storage?.setItem) {
    return null;
  }
  const normalizedPresets = arrayOrEmpty(presets)
    .map((preset, index) => normalizeWorkbenchPreset(preset, index))
    .filter(Boolean)
    .sort(compareWorkbenchPresets);
  const library = {
    schemaVersion: WORKBENCH_PRESET_LIBRARY_SCHEMA_VERSION,
    game: 'azur-promilia',
    type: WORKBENCH_PRESET_LIBRARY_TYPE,
    updatedAt: now,
    presets: normalizedPresets,
    summary: summarizeWorkbenchPresetLibrary(normalizedPresets),
  };

  storage.setItem(WORKBENCH_PRESET_STORAGE_KEY, JSON.stringify(library));
  return library;
}

export function addWorkbenchPreset(
  storage,
  preset,
  now = new Date().toISOString()
) {
  const normalizedPreset = normalizeWorkbenchPreset(preset, 0);
  if (!normalizedPreset) {
    return null;
  }
  const current = loadWorkbenchPresetLibrary(storage);
  const nextPresets = [
    normalizedPreset,
    ...current.presets.filter(item => item.id !== normalizedPreset.id),
  ];
  return saveWorkbenchPresetLibrary(storage, nextPresets, now);
}

export function duplicateWorkbenchPreset(
  storage,
  presetId,
  metadata = {},
  now = new Date().toISOString()
) {
  const current = loadWorkbenchPresetLibrary(storage);
  const source = current.presets.find(preset => preset.id === presetId);
  const draft = createWorkbenchDraftFromPreset(source);
  if (!source || !draft) {
    return null;
  }
  const duplicate = createWorkbenchPresetSnapshot(
    draft,
    {
      id: metadata.id,
      name: metadata.name ?? `${source.name} 副本`,
      description: source.description,
      tags: source.tags,
      summary: source.summary,
      randomSuffix: metadata.randomSuffix,
    },
    now
  );
  return addWorkbenchPreset(storage, duplicate, now);
}

export function deleteWorkbenchPreset(
  storage,
  presetId,
  now = new Date().toISOString()
) {
  const current = loadWorkbenchPresetLibrary(storage);
  if (!current.presets.some(preset => preset.id === presetId)) {
    return current;
  }
  return saveWorkbenchPresetLibrary(
    storage,
    current.presets.filter(preset => preset.id !== presetId),
    now
  );
}

export function createWorkbenchDraftFromPreset(preset) {
  if (
    !preset ||
    preset.compatibilityStatus === PRESET_COMPATIBILITY_INCOMPATIBLE
  ) {
    return null;
  }
  return parseWorkbenchProjectFile(preset.projectFile);
}

export function filterWorkbenchPresets(presets, { query = '', tag = '' } = {}) {
  const normalizedQuery = String(query).trim().toLocaleLowerCase();
  const normalizedTag = String(tag).trim().toLocaleLowerCase();
  return arrayOrEmpty(presets).filter(preset => {
    if (
      normalizedTag &&
      !preset.tags.some(item => item.toLocaleLowerCase() === normalizedTag)
    ) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    return [
      preset.name,
      preset.description,
      preset.summary?.enemyName,
      ...(preset.tags ?? []),
      ...(preset.summary?.actorNames ?? []),
    ]
      .filter(Boolean)
      .some(value =>
        String(value).toLocaleLowerCase().includes(normalizedQuery)
      );
  });
}

export function getWorkbenchPresetCompatibilityLabel(status) {
  if (status === PRESET_COMPATIBILITY_READY) {
    return '当前版本';
  }
  if (status === PRESET_COMPATIBILITY_MIGRATED) {
    return '已迁移';
  }
  return '版本不兼容';
}

function normalizeWorkbenchPreset(preset, index) {
  if (!preset || typeof preset !== 'object') {
    return null;
  }
  const projectPayload = preset.projectFile ?? preset.projectData ?? null;
  const sourceProjectSchemaVersion = positiveIntegerOrNull(
    projectPayload?.schemaVersion ?? preset.sourceProjectSchemaVersion
  );
  const parsedDraft = parseWorkbenchProjectFile(projectPayload);
  const gameDataCompatibility = parsedDraft
    ? getWorkbenchGameDataCompatibilityReport(parsedDraft)
    : null;
  const createdAt =
    normalizeIsoDate(preset.createdAt) ??
    normalizeIsoDate(preset.updatedAt) ??
    new Date(0).toISOString();
  const updatedAt = normalizeIsoDate(preset.updatedAt) ?? createdAt;
  const compatibilityStatus =
    parsedDraft && gameDataCompatibility?.importAllowed
      ? sourceProjectSchemaVersion === WORKBENCH_DRAFT_SCHEMA_VERSION
        ? PRESET_COMPATIBILITY_READY
        : PRESET_COMPATIBILITY_MIGRATED
      : PRESET_COMPATIBILITY_INCOMPATIBLE;
  const normalizedProjectFile =
    parsedDraft && gameDataCompatibility?.importAllowed
      ? createWorkbenchProjectFileSnapshot(parsedDraft, updatedAt)
      : projectPayload;

  return {
    schemaVersion: WORKBENCH_PRESET_LIBRARY_SCHEMA_VERSION,
    id:
      normalizeText(preset.id) ??
      `legacy-preset-${String(index + 1).padStart(4, '0')}`,
    name:
      normalizeText(preset.name) ??
      normalizeText(preset.title) ??
      `未命名预设 ${index + 1}`,
    description: normalizeText(preset.description) ?? '',
    tags: normalizeWorkbenchPresetTags(preset.tags),
    createdAt,
    updatedAt,
    sourceProjectSchemaVersion,
    compatibilityStatus,
    summary: parsedDraft
      ? createWorkbenchPresetSummary(normalizedProjectFile, {
          ...preset.summary,
          actorNames: preset.summary?.actorNames ?? preset.characterNames ?? [],
          enemyName: preset.summary?.enemyName ?? preset.boss,
        })
      : normalizeWorkbenchPresetSummary(preset.summary, preset),
    projectFile: normalizedProjectFile,
  };
}

function createWorkbenchPresetSummary(projectFile, summary = {}) {
  const actions = arrayOrEmpty(projectFile?.actionDrafts);
  const characterIds = uniqueValues(
    arrayOrEmpty(projectFile?.teamSlots).map(slot => Number(slot.characterId))
  );
  const durationMs = actions.reduce(
    (maximum, action) =>
      Math.max(
        maximum,
        (Number(action.startMs) || 0) + (Number(action.durationMs) || 0)
      ),
    0
  );
  return {
    actionCount: actions.length,
    characterIds,
    actorNames: normalizeStringList(summary.actorNames),
    enemyId: Number(projectFile?.selection?.enemyId) || null,
    enemyName: normalizeText(summary.enemyName),
    durationMs,
    effectCommandCount: actions.reduce(
      (count, action) => count + arrayOrEmpty(action.effectCommands).length,
      0
    ),
    runtimeSampleCaptureCount: arrayOrEmpty(projectFile?.runtimeSampleCaptures)
      .length,
  };
}

function normalizeWorkbenchPresetSummary(summary = {}, preset = {}) {
  return {
    actionCount: nonNegativeInteger(summary.actionCount),
    characterIds: uniqueValues(
      arrayOrEmpty(summary.characterIds ?? preset.characters).map(Number)
    ),
    actorNames: normalizeStringList(
      summary.actorNames ?? preset.characterNames
    ),
    enemyId: Number(summary.enemyId) || null,
    enemyName: normalizeText(summary.enemyName ?? preset.boss),
    durationMs: nonNegativeNumber(summary.durationMs ?? preset.duration),
    effectCommandCount: nonNegativeInteger(summary.effectCommandCount),
    runtimeSampleCaptureCount: nonNegativeInteger(
      summary.runtimeSampleCaptureCount
    ),
  };
}

function summarizeWorkbenchPresetLibrary(presets) {
  return {
    presetCount: presets.length,
    readyCount: presets.filter(
      preset => preset.compatibilityStatus === PRESET_COMPATIBILITY_READY
    ).length,
    migratedCount: presets.filter(
      preset => preset.compatibilityStatus === PRESET_COMPATIBILITY_MIGRATED
    ).length,
    incompatibleCount: presets.filter(
      preset => preset.compatibilityStatus === PRESET_COMPATIBILITY_INCOMPATIBLE
    ).length,
    tags: uniqueValues(presets.flatMap(preset => preset.tags)).sort((a, b) =>
      String(a).localeCompare(String(b), 'zh-CN')
    ),
  };
}

function createEmptyWorkbenchPresetLibrary() {
  return {
    schemaVersion: WORKBENCH_PRESET_LIBRARY_SCHEMA_VERSION,
    game: 'azur-promilia',
    type: WORKBENCH_PRESET_LIBRARY_TYPE,
    updatedAt: null,
    presets: [],
    summary: summarizeWorkbenchPresetLibrary([]),
  };
}

function normalizeWorkbenchPresetTags(tags) {
  const values = Array.isArray(tags)
    ? tags
    : typeof tags === 'string'
      ? tags.split(/[,，]/u)
      : [];
  return uniqueValues(values.map(value => String(value).trim()).filter(Boolean))
    .slice(0, 8)
    .map(value => value.slice(0, 24));
}

function createWorkbenchPresetId(now, randomSuffix) {
  const timestamp = Number.isFinite(Date.parse(now))
    ? Date.parse(now).toString(36)
    : Date.now().toString(36);
  const suffix =
    normalizeText(randomSuffix) ??
    globalThis.crypto?.randomUUID?.().slice(0, 8) ??
    Math.random().toString(36).slice(2, 10);
  return `preset-${timestamp}-${suffix}`;
}

function compareWorkbenchPresets(left, right) {
  return String(right.updatedAt).localeCompare(String(left.updatedAt));
}

function normalizeIsoDate(value) {
  if (!value || !Number.isFinite(Date.parse(value))) {
    return null;
  }
  return new Date(value).toISOString();
}

function normalizeText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalizeStringList(value) {
  return uniqueValues(arrayOrEmpty(value).map(normalizeText).filter(Boolean));
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

function nonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function parseJsonValue(value) {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function uniqueValues(values) {
  return [...new Set(values.filter(value => value != null))];
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}
