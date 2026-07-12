import { getAzprWorkbenchSeed } from '../data/azprGenerated';

export const WORKBENCH_GAME_DATA_CATALOG_CONTRACT_NAME =
  'AzPrWorkbenchGameDataCatalog';
export const WORKBENCH_GAME_DATA_CATALOG_CONTRACT_VERSION = 1;
export const WORKBENCH_GAME_DATA_BINDING_CONTRACT_NAME =
  'AzPrWorkbenchGameDataBinding';
export const WORKBENCH_GAME_DATA_BINDING_CONTRACT_VERSION = 1;
export const WORKBENCH_GAME_DATA_COMPATIBILITY_REPORT_CONTRACT_NAME =
  'AzPrWorkbenchGameDataCompatibilityReport';
export const WORKBENCH_GAME_DATA_REFERENCE_CONTRACT_NAME =
  'AzPrWorkbenchGameDataReference';

const TABLE_DEFINITIONS = Object.freeze({
  characters: Object.freeze({ kind: 'character' }),
  enemies: Object.freeze({ kind: 'enemy' }),
  equipment: Object.freeze({ kind: 'equipment' }),
  kibos: Object.freeze({ kind: 'kibo' }),
  soulessences: Object.freeze({ kind: 'soulessence' }),
});
const EQUIPMENT_SLOT_TYPES = Object.freeze({
  weapon: '武器',
  top: '上装',
  bottom: '下装',
  earring: '耳环',
  ring: '戒指',
});
const parsedCompatibilityReports = new WeakMap();

export const DEFAULT_WORKBENCH_GAME_DATA_CATALOG =
  createWorkbenchGameDataCatalog();

export function createWorkbenchGameDataCatalog({
  seed = getAzprWorkbenchSeed(),
  catalogId = 'azpr-workbench-game-data',
  catalogVersion = 1,
} = {}) {
  const issues = [];
  const tables = {};

  for (const [tableName, definition] of Object.entries(TABLE_DEFINITIONS)) {
    const records = Array.isArray(seed?.gameData?.[tableName])
      ? seed.gameData[tableName]
      : [];
    const source = textOrNull(seed?.sources?.[tableName]);
    const seenIds = new Set();
    const entries = [];
    if (!source) issues.push(`source-missing:${tableName}`);
    if (records.length === 0) issues.push(`table-empty:${tableName}`);
    for (const record of records) {
      const id = positiveIntegerOrNull(record?.id);
      if (id == null) {
        issues.push(`record-id-invalid:${tableName}`);
        continue;
      }
      if (seenIds.has(id))
        issues.push(`record-id-duplicate:${tableName}:${id}`);
      seenIds.add(id);
      entries.push({
        id,
        kind: definition.kind,
        source,
        record,
      });
    }
    tables[tableName] = {
      tableName,
      kind: definition.kind,
      source,
      entries,
      count: entries.length,
    };
  }

  const dataVersion = textOrNull(seed?.generatedAt);
  if (!dataVersion) issues.push('data-version-missing');
  const ready = issues.length === 0;
  return {
    schemaVersion: 1,
    contractName: WORKBENCH_GAME_DATA_CATALOG_CONTRACT_NAME,
    contractVersion: WORKBENCH_GAME_DATA_CATALOG_CONTRACT_VERSION,
    catalogId,
    catalogVersion: positiveIntegerOrNull(catalogVersion) ?? 1,
    dataVersion,
    sourceKind: textOrNull(seed?.source),
    status: ready
      ? 'workbench-game-data-catalog-ready'
      : 'workbench-game-data-catalog-invalid',
    ready,
    tables,
    sources: Object.fromEntries(
      Object.entries(tables).map(([tableName, table]) => [
        tableName,
        table.source,
      ])
    ),
    issues,
    summary: {
      tableCount: Object.keys(tables).length,
      recordCount: Object.values(tables).reduce(
        (count, table) => count + table.count,
        0
      ),
      counts: Object.fromEntries(
        Object.entries(tables).map(([tableName, table]) => [
          tableName,
          table.count,
        ])
      ),
      issueCount: issues.length,
    },
  };
}

export function createDefaultWorkbenchGameDataBinding(
  catalog = DEFAULT_WORKBENCH_GAME_DATA_CATALOG
) {
  return {
    schemaVersion: WORKBENCH_GAME_DATA_BINDING_CONTRACT_VERSION,
    contractName: WORKBENCH_GAME_DATA_BINDING_CONTRACT_NAME,
    catalogId: catalog?.catalogId ?? null,
    catalogVersion: catalog?.catalogVersion ?? null,
    dataVersion: catalog?.dataVersion ?? null,
    sourceKind: 'project-persisted-game-data-binding',
  };
}

export function normalizeWorkbenchGameDataBinding(
  binding,
  catalog = DEFAULT_WORKBENCH_GAME_DATA_CATALOG
) {
  if (binding == null) return createDefaultWorkbenchGameDataBinding(catalog);
  return {
    schemaVersion: WORKBENCH_GAME_DATA_BINDING_CONTRACT_VERSION,
    contractName: WORKBENCH_GAME_DATA_BINDING_CONTRACT_NAME,
    catalogId: textOrNull(binding?.catalogId),
    catalogVersion: positiveIntegerOrNull(binding?.catalogVersion),
    dataVersion: textOrNull(binding?.dataVersion),
    sourceKind:
      textOrNull(binding?.sourceKind) ?? 'project-persisted-game-data-binding',
  };
}

export function resolveWorkbenchGameDataBinding(
  binding,
  catalog = DEFAULT_WORKBENCH_GAME_DATA_CATALOG
) {
  if (binding == null) {
    return {
      status: 'legacy',
      compatible: catalog?.ready === true,
      requested: null,
      resolved: createDefaultWorkbenchGameDataBinding(catalog),
      reason: 'legacy-project-without-game-data-binding',
    };
  }
  const requested = normalizeWorkbenchGameDataBinding(binding, catalog);
  const shapeValid = Boolean(
    requested.catalogId &&
    requested.catalogVersion &&
    requested.dataVersion &&
    Number(binding?.schemaVersion) ===
      WORKBENCH_GAME_DATA_BINDING_CONTRACT_VERSION &&
    binding?.contractName === WORKBENCH_GAME_DATA_BINDING_CONTRACT_NAME
  );
  const catalogIdentityMatches = Boolean(
    requested.catalogId === catalog?.catalogId &&
    requested.catalogVersion === catalog?.catalogVersion
  );
  const dataVersionMatches = requested.dataVersion === catalog?.dataVersion;
  const status =
    !catalog?.ready || !shapeValid || !catalogIdentityMatches
      ? 'invalid'
      : dataVersionMatches
        ? 'exact'
        : 'stale';
  return {
    status,
    compatible: status === 'exact',
    requested,
    resolved: createDefaultWorkbenchGameDataBinding(catalog),
    reason:
      status === 'exact'
        ? null
        : status === 'stale'
          ? 'game-data-version-changed'
          : !catalog?.ready
            ? 'game-data-catalog-invalid'
            : !shapeValid
              ? 'game-data-binding-invalid'
              : 'game-data-catalog-identity-changed',
  };
}

export function createWorkbenchGameDataCompatibilityReport(
  draft = {},
  catalog = DEFAULT_WORKBENCH_GAME_DATA_CATALOG
) {
  const binding = resolveWorkbenchGameDataBinding(
    draft?.gameDataBinding,
    catalog
  );
  const scenarios = resolveWorkbenchScenarios(draft).map(scenario => {
    const references = collectScenarioReferenceRequests(scenario.draft).map(
      request =>
        toCompatibilityReference(resolveCatalogReference(catalog, request))
    );
    const missingCount = references.filter(
      row => row.status === 'missing'
    ).length;
    const invalidCount = references.filter(
      row => row.status === 'invalid'
    ).length;
    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      status:
        invalidCount > 0 ? 'invalid' : missingCount > 0 ? 'missing' : 'exact',
      compatible: missingCount === 0 && invalidCount === 0,
      references,
      summary: summarizeReferences(references),
    };
  });
  const libraryReferences = collectConfigurationLibraryReferenceRequests(
    draft?.configurationLibrary
  ).map(request =>
    toCompatibilityReference(resolveCatalogReference(catalog, request))
  );
  const allReferences = [
    ...scenarios.flatMap(scenario => scenario.references),
    ...libraryReferences,
  ];
  const referenceSummary = summarizeReferences(allReferences);
  const importAllowed = Boolean(
    catalog?.ready &&
    binding.compatible &&
    scenarios.length > 0 &&
    scenarios.every(scenario => scenario.compatible) &&
    libraryReferences.every(reference => reference.compatible)
  );
  const status = importAllowed
    ? binding.status === 'legacy'
      ? 'workbench-game-data-compatibility-legacy'
      : 'workbench-game-data-compatibility-exact'
    : binding.status === 'stale'
      ? 'workbench-game-data-compatibility-stale'
      : binding.status === 'invalid' || referenceSummary.invalidCount > 0
        ? 'workbench-game-data-compatibility-invalid'
        : 'workbench-game-data-compatibility-missing';
  return {
    schemaVersion: 1,
    contractName: WORKBENCH_GAME_DATA_COMPATIBILITY_REPORT_CONTRACT_NAME,
    status,
    compatible: importAllowed,
    importAllowed,
    catalog: createCatalogSummary(catalog),
    binding: {
      status: binding.status,
      compatible: binding.compatible,
      reason: binding.reason,
      requested: binding.requested,
      resolved: binding.resolved,
    },
    scenarios,
    configurationLibrary: {
      status: libraryReferences.every(reference => reference.compatible)
        ? 'exact'
        : libraryReferences.some(reference => reference.status === 'invalid')
          ? 'invalid'
          : 'missing',
      compatible: libraryReferences.every(reference => reference.compatible),
      references: libraryReferences,
      summary: summarizeReferences(libraryReferences),
    },
    summary: {
      scenarioCount: scenarios.length,
      ...referenceSummary,
    },
  };
}

export function rememberWorkbenchGameDataCompatibilityReport(target, report) {
  if (target && typeof target === 'object' && report) {
    parsedCompatibilityReports.set(target, {
      report,
      fingerprint: createCompatibilityInputFingerprint(target),
    });
  }
  return target;
}

export function getWorkbenchGameDataCompatibilityReport(
  draft,
  catalog = DEFAULT_WORKBENCH_GAME_DATA_CATALOG
) {
  const cachedEntry =
    draft && typeof draft === 'object'
      ? parsedCompatibilityReports.get(draft)
      : null;
  const cached = cachedEntry?.report ?? null;
  if (
    cachedEntry?.fingerprint === createCompatibilityInputFingerprint(draft) &&
    cached?.catalog?.catalogId === catalog?.catalogId &&
    cached?.catalog?.catalogVersion === catalog?.catalogVersion &&
    cached?.catalog?.dataVersion === catalog?.dataVersion
  ) {
    return cached;
  }
  return createWorkbenchGameDataCompatibilityReport(draft, catalog);
}

export function createWorkbenchGameDataReferenceContract(
  draft = {},
  catalog = DEFAULT_WORKBENCH_GAME_DATA_CATALOG
) {
  const binding = resolveWorkbenchGameDataBinding(
    draft?.gameDataBinding,
    catalog
  );
  const actors = (
    Array.isArray(draft?.actorConfigs) ? draft.actorConfigs : []
  ).map((actorConfig, index) => {
    const character = resolveCatalogReference(catalog, {
      tableName: 'characters',
      id: actorConfig?.characterId,
      path: `actorConfigs[${index}].characterId`,
    });
    return {
      characterId: positiveIntegerOrNull(actorConfig?.characterId),
      ready: character.compatible,
      character,
      loadout: createResolvedLoadoutReferences(
        catalog,
        actorConfig?.loadout,
        `actorConfigs[${index}].loadout`
      ),
    };
  });
  const enemy = resolveCatalogReference(catalog, {
    tableName: 'enemies',
    id: draft?.selection?.enemyId,
    path: 'selection.enemyId',
  });
  const references = [
    ...actors.flatMap(actor => [
      actor.character,
      ...Object.values(actor.loadout.references).filter(Boolean),
    ]),
    enemy,
  ];
  const ready = Boolean(
    catalog?.ready &&
    binding.compatible &&
    references.every(reference => reference.compatible)
  );
  const identitySource = JSON.stringify({
    catalogId: catalog?.catalogId ?? null,
    catalogVersion: catalog?.catalogVersion ?? null,
    dataVersion: catalog?.dataVersion ?? null,
    references: references.map(reference => [
      reference.tableName,
      reference.id,
      reference.expectedType,
    ]),
  });
  return {
    schemaVersion: 1,
    contractName: WORKBENCH_GAME_DATA_REFERENCE_CONTRACT_NAME,
    status: ready
      ? 'workbench-game-data-reference-ready'
      : 'workbench-game-data-reference-incomplete',
    ready,
    referenceIdentity: `azpr-game-data-v1-${stableHash(identitySource)}`,
    catalog: createCatalogSummary(catalog),
    binding: {
      status: binding.status,
      compatible: binding.compatible,
      requested: binding.requested,
      resolved: binding.resolved,
      reason: binding.reason,
    },
    actors,
    enemy,
    summary: summarizeReferences(references),
    policy: {
      resolvedCatalogRecordsOnly: true,
      loadoutEffectsAppliedToCalculators: false,
    },
  };
}

function createResolvedLoadoutReferences(catalog, loadout = {}, path) {
  const references = {
    kibo: optionalCatalogReference(catalog, {
      tableName: 'kibos',
      id: loadout?.kiboId,
      path: `${path}.kiboId`,
    }),
    soulessence: optionalCatalogReference(catalog, {
      tableName: 'soulessences',
      id: loadout?.soulessenceId,
      path: `${path}.soulessenceId`,
    }),
  };
  for (const [slotKey, expectedType] of Object.entries(EQUIPMENT_SLOT_TYPES)) {
    references[slotKey] = optionalCatalogReference(catalog, {
      tableName: 'equipment',
      id: loadout?.equipment?.[slotKey],
      expectedType,
      path: `${path}.equipment.${slotKey}`,
    });
  }
  return {
    ready: Object.values(references)
      .filter(Boolean)
      .every(reference => reference.compatible),
    appliedToCalculators: false,
    references,
  };
}

function collectScenarioReferenceRequests(draft = {}) {
  const requests = [];
  const teamSlots = Array.isArray(draft?.teamSlots) ? draft.teamSlots : [];
  if (teamSlots.length > 0) {
    teamSlots.forEach((slot, index) =>
      requests.push({
        tableName: 'characters',
        id: slot?.characterId,
        path: `teamSlots[${index}].characterId`,
      })
    );
  } else {
    requests.push(
      {
        tableName: 'characters',
        id: draft?.selection?.characterId,
        path: 'selection.characterId',
      },
      {
        tableName: 'characters',
        id: draft?.selection?.secondaryCharacterId,
        path: 'selection.secondaryCharacterId',
      }
    );
  }
  requests.push({
    tableName: 'enemies',
    id: draft?.selection?.enemyId,
    path: 'selection.enemyId',
  });
  (Array.isArray(draft?.actorConfigs) ? draft.actorConfigs : []).forEach(
    (actorConfig, index) => {
      requests.push({
        tableName: 'characters',
        id: actorConfig?.characterId,
        path: `actorConfigs[${index}].characterId`,
      });
      collectLoadoutReferenceRequests(
        actorConfig?.loadout,
        `actorConfigs[${index}].loadout`,
        requests
      );
    }
  );
  (Array.isArray(draft?.actionDrafts) ? draft.actionDrafts : []).forEach(
    (action, index) => {
      if (action?.actorCharacterId != null) {
        requests.push({
          tableName: 'characters',
          id: action.actorCharacterId,
          path: `actionDrafts[${index}].actorCharacterId`,
        });
      }
      if (action?.targetCharacterId != null) {
        requests.push({
          tableName: 'characters',
          id: action.targetCharacterId,
          path: `actionDrafts[${index}].targetCharacterId`,
        });
      }
    }
  );
  return requests.filter(request => request.id != null && request.id !== '');
}

function collectConfigurationLibraryReferenceRequests(library = {}) {
  const requests = [];
  (Array.isArray(library?.actorInstances)
    ? library.actorInstances
    : []
  ).forEach((instance, index) => {
    requests.push({
      tableName: 'characters',
      id: instance?.characterId,
      path: `configurationLibrary.actorInstances[${index}].characterId`,
    });
    collectLoadoutReferenceRequests(
      instance?.actorConfig?.loadout ?? instance?.config?.loadout,
      `configurationLibrary.actorInstances[${index}].actorConfig.loadout`,
      requests
    );
  });
  (Array.isArray(library?.enemyInstances)
    ? library.enemyInstances
    : []
  ).forEach((instance, index) =>
    requests.push({
      tableName: 'enemies',
      id: instance?.enemyId,
      path: `configurationLibrary.enemyInstances[${index}].enemyId`,
    })
  );
  return requests.filter(request => request.id != null && request.id !== '');
}

function collectLoadoutReferenceRequests(loadout = {}, path, requests) {
  if (loadout?.kiboId != null) {
    requests.push({
      tableName: 'kibos',
      id: loadout.kiboId,
      path: `${path}.kiboId`,
    });
  }
  if (loadout?.soulessenceId != null) {
    requests.push({
      tableName: 'soulessences',
      id: loadout.soulessenceId,
      path: `${path}.soulessenceId`,
    });
  }
  for (const [slotKey, expectedType] of Object.entries(EQUIPMENT_SLOT_TYPES)) {
    if (loadout?.equipment?.[slotKey] == null) continue;
    requests.push({
      tableName: 'equipment',
      id: loadout.equipment[slotKey],
      expectedType,
      path: `${path}.equipment.${slotKey}`,
    });
  }
}

function resolveCatalogReference(
  catalog,
  { tableName, id, expectedType = null, path = '' } = {}
) {
  const table = catalog?.tables?.[tableName];
  const normalizedId = positiveIntegerOrNull(id);
  const entry = table?.entries?.find(item => item.id === normalizedId) ?? null;
  const status =
    !table || normalizedId == null
      ? 'invalid'
      : !entry
        ? 'missing'
        : expectedType && entry.record?.type !== expectedType
          ? 'invalid'
          : 'exact';
  return {
    tableName,
    kind: table?.kind ?? TABLE_DEFINITIONS[tableName]?.kind ?? null,
    id: normalizedId,
    requestedId: id ?? null,
    expectedType,
    status,
    compatible: status === 'exact',
    path,
    source: table?.source ?? null,
    catalogId: catalog?.catalogId ?? null,
    catalogVersion: catalog?.catalogVersion ?? null,
    dataVersion: catalog?.dataVersion ?? null,
    record: entry?.record ?? null,
  };
}

function optionalCatalogReference(catalog, request) {
  if (request.id == null || request.id === '') return null;
  return resolveCatalogReference(catalog, request);
}

function toCompatibilityReference(reference) {
  return {
    tableName: reference.tableName,
    kind: reference.kind,
    id: reference.id,
    requestedId: reference.requestedId,
    expectedType: reference.expectedType,
    resolvedType: reference.record?.type ?? null,
    name: textOrNull(reference.record?.name),
    status: reference.status,
    compatible: reference.compatible,
    path: reference.path,
    source: reference.source,
    catalogId: reference.catalogId,
    catalogVersion: reference.catalogVersion,
    dataVersion: reference.dataVersion,
  };
}

function summarizeReferences(references) {
  const rows = Array.isArray(references) ? references : [];
  return {
    referenceCount: rows.length,
    exactCount: rows.filter(row => row.status === 'exact').length,
    missingCount: rows.filter(row => row.status === 'missing').length,
    invalidCount: rows.filter(row => row.status === 'invalid').length,
  };
}

function createCatalogSummary(catalog) {
  return {
    contractName: catalog?.contractName ?? null,
    contractVersion: catalog?.contractVersion ?? null,
    catalogId: catalog?.catalogId ?? null,
    catalogVersion: catalog?.catalogVersion ?? null,
    dataVersion: catalog?.dataVersion ?? null,
    sourceKind: catalog?.sourceKind ?? null,
    ready: catalog?.ready === true,
    sources: catalog?.sources ?? {},
    counts: catalog?.summary?.counts ?? {},
  };
}

function resolveWorkbenchScenarios(draft = {}) {
  const scenarios = draft?.scenarioWorkspace?.scenarios;
  if (Array.isArray(scenarios) && scenarios.length > 0) {
    const activeScenarioId = draft?.scenarioWorkspace?.activeScenarioId;
    return scenarios.map((scenario, index) => ({
      id: scenario?.id ?? `scenario-${index + 1}`,
      name: scenario?.name ?? `方案 ${index + 1}`,
      draft:
        scenario?.id === activeScenarioId ? draft : (scenario?.draft ?? {}),
    }));
  }
  return [{ id: 'scenario-0001', name: '方案 1', draft }];
}

function createCompatibilityInputFingerprint(draft = {}) {
  return stableHash(
    JSON.stringify({
      binding: draft?.gameDataBinding ?? null,
      scenarios: resolveWorkbenchScenarios(draft).map(scenario => ({
        id: scenario.id,
        references: collectScenarioReferenceRequests(scenario.draft).map(
          request => [
            request.tableName,
            request.id,
            request.expectedType ?? null,
            request.path,
          ]
        ),
      })),
      configurationLibrary: collectConfigurationLibraryReferenceRequests(
        draft?.configurationLibrary
      ).map(request => [
        request.tableName,
        request.id,
        request.expectedType ?? null,
        request.path,
      ]),
    })
  );
}

function stableHash(value) {
  let hash = 0x811c9dc5;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function textOrNull(value) {
  const text = String(value ?? '').trim();
  return text || null;
}
