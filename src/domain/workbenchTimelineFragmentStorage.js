import {
  normalizeWorkbenchTimelineFragment,
  WORKBENCH_TIMELINE_FRAGMENT_SCHEMA_VERSION,
} from './workbenchTimelineFragment';

export const WORKBENCH_TIMELINE_FRAGMENT_LIBRARY_SCHEMA_VERSION = 1;
export const WORKBENCH_TIMELINE_FRAGMENT_LIBRARY_TYPE =
  'workbench-timeline-fragment-library';
export const WORKBENCH_TIMELINE_FRAGMENT_STORAGE_KEY =
  'promilia-axis-tool:timeline-fragments:v1';

export function createEmptyWorkbenchTimelineFragmentLibrary() {
  return {
    schemaVersion: WORKBENCH_TIMELINE_FRAGMENT_LIBRARY_SCHEMA_VERSION,
    game: 'azur-promilia',
    type: WORKBENCH_TIMELINE_FRAGMENT_LIBRARY_TYPE,
    fragmentSchemaVersion: WORKBENCH_TIMELINE_FRAGMENT_SCHEMA_VERSION,
    updatedAt: null,
    fragments: [],
    summary: summarizeFragments([]),
  };
}

export function parseWorkbenchTimelineFragmentLibrary(rawLibrary) {
  const payload = parseJsonValue(rawLibrary);
  if (
    !payload ||
    typeof payload !== 'object' ||
    payload.schemaVersion !==
      WORKBENCH_TIMELINE_FRAGMENT_LIBRARY_SCHEMA_VERSION ||
    payload.game !== 'azur-promilia' ||
    payload.type !== WORKBENCH_TIMELINE_FRAGMENT_LIBRARY_TYPE
  ) {
    return createEmptyWorkbenchTimelineFragmentLibrary();
  }
  const fragments = normalizeFragments(payload.fragments);
  return {
    schemaVersion: WORKBENCH_TIMELINE_FRAGMENT_LIBRARY_SCHEMA_VERSION,
    game: 'azur-promilia',
    type: WORKBENCH_TIMELINE_FRAGMENT_LIBRARY_TYPE,
    fragmentSchemaVersion: WORKBENCH_TIMELINE_FRAGMENT_SCHEMA_VERSION,
    updatedAt: normalizeIsoDate(payload.updatedAt),
    fragments,
    summary: summarizeFragments(fragments),
  };
}

export function serializeWorkbenchTimelineFragmentLibrary(
  fragments,
  now = new Date().toISOString()
) {
  return JSON.stringify(createLibrary(fragments, now), null, 2);
}

export function loadWorkbenchTimelineFragmentLibrary(
  storage = globalThis.localStorage
) {
  if (!storage?.getItem) {
    return createEmptyWorkbenchTimelineFragmentLibrary();
  }
  return parseWorkbenchTimelineFragmentLibrary(
    storage.getItem(WORKBENCH_TIMELINE_FRAGMENT_STORAGE_KEY)
  );
}

export function saveWorkbenchTimelineFragmentLibrary(
  storage,
  fragments,
  now = new Date().toISOString()
) {
  const library = createLibrary(fragments, now);
  storage?.setItem?.(
    WORKBENCH_TIMELINE_FRAGMENT_STORAGE_KEY,
    JSON.stringify(library)
  );
  return library;
}

export function addWorkbenchTimelineFragment(
  storage,
  fragment,
  now = new Date().toISOString()
) {
  const normalized = normalizeWorkbenchTimelineFragment(fragment);
  if (!normalized) return null;
  const current = loadWorkbenchTimelineFragmentLibrary(storage);
  return saveWorkbenchTimelineFragmentLibrary(
    storage,
    [
      { ...normalized, updatedAt: now },
      ...current.fragments.filter(item => item.id !== normalized.id),
    ],
    now
  );
}

export function duplicateWorkbenchTimelineFragment(
  storage,
  fragmentId,
  metadata = {},
  now = new Date().toISOString()
) {
  const current = loadWorkbenchTimelineFragmentLibrary(storage);
  const source = current.fragments.find(fragment => fragment.id === fragmentId);
  if (!source) return null;
  const duplicate = normalizeWorkbenchTimelineFragment({
    ...cloneValue(source),
    id:
      normalizeText(metadata.id) ??
      createDuplicateFragmentId(source.id, now, metadata.randomSuffix),
    name: normalizeText(metadata.name) ?? `${source.name} 副本`,
    createdAt: now,
    updatedAt: now,
  });
  return addWorkbenchTimelineFragment(storage, duplicate, now);
}

export function deleteWorkbenchTimelineFragment(
  storage,
  fragmentId,
  now = new Date().toISOString()
) {
  const current = loadWorkbenchTimelineFragmentLibrary(storage);
  if (!current.fragments.some(fragment => fragment.id === fragmentId)) {
    return current;
  }
  return saveWorkbenchTimelineFragmentLibrary(
    storage,
    current.fragments.filter(fragment => fragment.id !== fragmentId),
    now
  );
}

export function importWorkbenchTimelineFragmentLibrary(
  storage,
  rawLibrary,
  now = new Date().toISOString()
) {
  const imported = parseWorkbenchTimelineFragmentLibrary(rawLibrary);
  if (!imported.fragments.length) return null;
  const current = loadWorkbenchTimelineFragmentLibrary(storage);
  const importedIds = new Set(imported.fragments.map(fragment => fragment.id));
  return saveWorkbenchTimelineFragmentLibrary(
    storage,
    [
      ...imported.fragments,
      ...current.fragments.filter(fragment => !importedIds.has(fragment.id)),
    ],
    now
  );
}

export function filterWorkbenchTimelineFragments(
  fragments,
  { query = '', tag = '' } = {}
) {
  const normalizedQuery = String(query).trim().toLocaleLowerCase();
  const normalizedTag = String(tag).trim().toLocaleLowerCase();
  return (Array.isArray(fragments) ? fragments : []).filter(fragment => {
    if (
      normalizedTag &&
      !fragment.tags.some(item => item.toLocaleLowerCase() === normalizedTag)
    ) {
      return false;
    }
    if (!normalizedQuery) return true;
    return [
      fragment.name,
      fragment.description,
      ...fragment.tags,
      ...fragment.summary.laneKinds,
    ].some(value =>
      String(value).toLocaleLowerCase().includes(normalizedQuery)
    );
  });
}

function createLibrary(fragments, now) {
  const normalizedFragments = normalizeFragments(fragments);
  return {
    schemaVersion: WORKBENCH_TIMELINE_FRAGMENT_LIBRARY_SCHEMA_VERSION,
    game: 'azur-promilia',
    type: WORKBENCH_TIMELINE_FRAGMENT_LIBRARY_TYPE,
    fragmentSchemaVersion: WORKBENCH_TIMELINE_FRAGMENT_SCHEMA_VERSION,
    updatedAt: now,
    fragments: normalizedFragments,
    summary: summarizeFragments(normalizedFragments),
  };
}

function normalizeFragments(fragments) {
  const usedIds = new Set();
  return (Array.isArray(fragments) ? fragments : [])
    .map(normalizeWorkbenchTimelineFragment)
    .filter(fragment => {
      if (!fragment || usedIds.has(fragment.id)) return false;
      usedIds.add(fragment.id);
      return true;
    })
    .sort(
      (left, right) =>
        Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
        left.name.localeCompare(right.name, 'zh-CN')
    );
}

function summarizeFragments(fragments) {
  return {
    fragmentCount: fragments.length,
    actionCount: fragments.reduce(
      (count, fragment) => count + fragment.summary.actionCount,
      0
    ),
    tags: [...new Set(fragments.flatMap(fragment => fragment.tags))].sort(
      (left, right) => left.localeCompare(right, 'zh-CN')
    ),
  };
}

function createDuplicateFragmentId(sourceId, now, randomSuffix = '') {
  const timestamp = String(now)
    .replace(/[^0-9]/g, '')
    .slice(0, 14);
  const suffix =
    normalizeText(randomSuffix)?.replace(/[^a-zA-Z0-9_-]/g, '') ||
    Math.random().toString(36).slice(2, 8);
  return `${sourceId}-copy-${timestamp || 'local'}-${suffix}`;
}

function normalizeText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalizeIsoDate(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function parseJsonValue(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}
