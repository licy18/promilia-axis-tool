import {
  normalizeWorkbenchActorConfig,
  normalizeWorkbenchActorConfigs,
  normalizeWorkbenchEnemyConfig,
} from './workbenchProjectFactory';

export const WORKBENCH_CONFIGURATION_LIBRARY_SCHEMA_VERSION = 1;
export const WORKBENCH_CONFIGURATION_SELECTION_SCHEMA_VERSION = 1;
export const MAX_WORKBENCH_ACTOR_CONFIGURATION_INSTANCES = 48;
export const MAX_WORKBENCH_ENEMY_CONFIGURATION_INSTANCES = 24;

const ACTOR_INSTANCE_ID_PREFIX = 'actor-config-';
const ENEMY_INSTANCE_ID_PREFIX = 'enemy-config-';
const CONFIGURATION_NAME_LIMIT = 48;

export function createEmptyWorkbenchConfigurationLibrary() {
  return {
    schemaVersion: WORKBENCH_CONFIGURATION_LIBRARY_SCHEMA_VERSION,
    actorInstances: [],
    enemyInstances: [],
  };
}

export function normalizeWorkbenchConfigurationLibrary(library = {}) {
  const usedIds = new Set();
  const actorInstances = normalizeConfigurationInstances(
    library?.actorInstances,
    {
      usedIds,
      idPrefix: ACTOR_INSTANCE_ID_PREFIX,
      maxCount: MAX_WORKBENCH_ACTOR_CONFIGURATION_INSTANCES,
      entityKey: 'characterId',
      configKey: 'actorConfig',
      normalizeConfig: (config, characterId) =>
        normalizeWorkbenchActorConfig(config, characterId),
      fallbackName: '角色配置',
    }
  );
  const enemyInstances = normalizeConfigurationInstances(
    library?.enemyInstances,
    {
      usedIds,
      idPrefix: ENEMY_INSTANCE_ID_PREFIX,
      maxCount: MAX_WORKBENCH_ENEMY_CONFIGURATION_INSTANCES,
      entityKey: 'enemyId',
      configKey: 'enemyConfig',
      normalizeConfig: config => normalizeWorkbenchEnemyConfig(config),
      fallbackName: '敌人配置',
    }
  );

  return {
    schemaVersion: WORKBENCH_CONFIGURATION_LIBRARY_SCHEMA_VERSION,
    actorInstances,
    enemyInstances,
  };
}

export function normalizeWorkbenchConfigurationSelection(selection = {}) {
  const usedCharacterIds = new Set();
  const actorInstanceIds = [];
  for (const item of Array.isArray(selection?.actorInstanceIds)
    ? selection.actorInstanceIds
    : []) {
    const characterId = positiveIntegerOrNull(item?.characterId);
    const instanceId = normalizeId(item?.instanceId);
    if (
      characterId == null ||
      !instanceId ||
      usedCharacterIds.has(characterId)
    ) {
      continue;
    }
    usedCharacterIds.add(characterId);
    actorInstanceIds.push({ characterId, instanceId });
  }

  return {
    schemaVersion: WORKBENCH_CONFIGURATION_SELECTION_SCHEMA_VERSION,
    actorInstanceIds,
    enemyInstanceId: normalizeId(selection?.enemyInstanceId),
  };
}

export function reconcileWorkbenchConfigurationState({
  configurationLibrary,
  configurationSelection,
  selection,
  actorConfigs,
  enemyConfig,
  syncSelectedValues = false,
} = {}) {
  const normalizedActorConfigs = normalizeWorkbenchActorConfigs(
    actorConfigs,
    selection
  );
  const normalizedEnemyConfig = normalizeWorkbenchEnemyConfig(enemyConfig);
  const normalizedSelection = normalizeWorkbenchConfigurationSelection(
    configurationSelection
  );
  const library = normalizeWorkbenchConfigurationLibrary(configurationLibrary);
  const actorSelectionByCharacterId = new Map(
    normalizedSelection.actorInstanceIds.map(item => [
      Number(item.characterId),
      item.instanceId,
    ])
  );
  const nextActorInstanceIds = [];
  const nextActorConfigs = [];

  for (const actorConfig of normalizedActorConfigs) {
    const characterId = Number(actorConfig.characterId);
    let instance = library.actorInstances.find(
      item =>
        item.id === actorSelectionByCharacterId.get(characterId) &&
        Number(item.characterId) === characterId
    );
    if (!instance) {
      instance = findMatchingConfigurationInstance(
        library.actorInstances,
        characterId,
        actorConfig,
        'characterId',
        'actorConfig'
      );
    }
    if (!instance) {
      instance = createActorConfigurationInstance(library, {
        characterId,
        actorConfig,
      });
      if (instance) library.actorInstances.push(instance);
    } else if (syncSelectedValues) {
      instance.actorConfig = normalizeWorkbenchActorConfig(
        actorConfig,
        characterId
      );
    }
    if (!instance) continue;
    nextActorInstanceIds.push({ characterId, instanceId: instance.id });
    nextActorConfigs.push(clone(instance.actorConfig));
  }

  const enemyId = positiveIntegerOrNull(selection?.enemyId);
  let enemyInstance = library.enemyInstances.find(
    item =>
      item.id === normalizedSelection.enemyInstanceId &&
      Number(item.enemyId) === enemyId
  );
  if (!enemyInstance) {
    enemyInstance = findMatchingConfigurationInstance(
      library.enemyInstances,
      enemyId,
      normalizedEnemyConfig,
      'enemyId',
      'enemyConfig'
    );
  }
  if (!enemyInstance) {
    enemyInstance = createEnemyConfigurationInstance(library, {
      enemyId,
      enemyConfig: normalizedEnemyConfig,
    });
    if (enemyInstance) library.enemyInstances.push(enemyInstance);
  } else if (syncSelectedValues) {
    enemyInstance.enemyConfig = normalizeWorkbenchEnemyConfig(
      normalizedEnemyConfig
    );
  }

  return {
    configurationLibrary: normalizeWorkbenchConfigurationLibrary(library),
    configurationSelection: {
      schemaVersion: WORKBENCH_CONFIGURATION_SELECTION_SCHEMA_VERSION,
      actorInstanceIds: nextActorInstanceIds,
      enemyInstanceId: enemyInstance?.id ?? '',
    },
    actorConfigs: nextActorConfigs,
    enemyConfig: enemyInstance
      ? clone(enemyInstance.enemyConfig)
      : normalizedEnemyConfig,
  };
}

export function normalizeWorkbenchConfigurationWorkspace({
  configurationLibrary,
  scenarioWorkspace,
  activeDraft,
} = {}) {
  let library = normalizeWorkbenchConfigurationLibrary(configurationLibrary);
  const activeScenarioId = scenarioWorkspace?.activeScenarioId;
  const sourceScenarios = Array.isArray(scenarioWorkspace?.scenarios)
    ? scenarioWorkspace.scenarios
    : [];
  const orderedScenarios = [
    ...sourceScenarios.filter(item => item.id === activeScenarioId),
    ...sourceScenarios.filter(item => item.id !== activeScenarioId),
  ];
  const resolvedDrafts = new Map();

  for (const scenario of orderedScenarios) {
    const sourceDraft =
      scenario.id === activeScenarioId ? activeDraft : scenario.draft;
    const resolved = reconcileWorkbenchConfigurationState({
      configurationLibrary: library,
      configurationSelection: sourceDraft?.configurationSelection,
      selection: sourceDraft?.selection,
      actorConfigs: sourceDraft?.actorConfigs,
      enemyConfig: sourceDraft?.enemyConfig,
      syncSelectedValues: scenario.id === activeScenarioId,
    });
    library = resolved.configurationLibrary;
    resolvedDrafts.set(scenario.id, {
      ...sourceDraft,
      configurationSelection: resolved.configurationSelection,
      actorConfigs: resolved.actorConfigs,
      enemyConfig: resolved.enemyConfig,
    });
  }

  const scenarios = sourceScenarios.map(scenario => ({
    ...scenario,
    draft: resolvedDrafts.get(scenario.id) ?? scenario.draft,
  }));
  const resolvedActiveDraft =
    resolvedDrafts.get(activeScenarioId) ?? activeDraft;

  return {
    configurationLibrary: library,
    activeDraft: resolvedActiveDraft,
    scenarioWorkspace: {
      ...scenarioWorkspace,
      scenarios,
    },
  };
}

export function applyWorkbenchConfigurationInstanceCommand(
  state,
  command = {}
) {
  const current = reconcileWorkbenchConfigurationState({
    ...state,
    syncSelectedValues: true,
  });
  const kind = command.kind === 'enemy' ? 'enemy' : 'actor';
  const action = normalizeText(command.action);
  const entityId =
    kind === 'actor'
      ? positiveIntegerOrNull(command.characterId)
      : positiveIntegerOrNull(command.enemyId ?? state?.selection?.enemyId);
  const listKey = kind === 'actor' ? 'actorInstances' : 'enemyInstances';
  const entityKey = kind === 'actor' ? 'characterId' : 'enemyId';
  const selectionId = getSelectedConfigurationInstanceId(
    current.configurationSelection,
    kind,
    entityId
  );
  const instances = current.configurationLibrary[listKey];
  const activeInstance = instances.find(
    item => item.id === selectionId && Number(item[entityKey]) === entityId
  );
  const matchingInstances = instances.filter(
    item => Number(item[entityKey]) === entityId
  );

  if (
    !activeInstance ||
    !['select', 'duplicate', 'rename', 'delete'].includes(action)
  ) {
    return { ...current, changed: false, reason: 'invalid-command' };
  }

  let nextLibrary = clone(current.configurationLibrary);
  let nextSelection = clone(current.configurationSelection);
  let nextInstance = activeInstance;

  if (action === 'select') {
    const requested = matchingInstances.find(
      item => item.id === normalizeId(command.instanceId)
    );
    if (!requested || requested.id === activeInstance.id) {
      return { ...current, changed: false, reason: 'instance-not-changed' };
    }
    nextInstance = requested;
  } else if (action === 'duplicate') {
    const limit =
      kind === 'actor'
        ? MAX_WORKBENCH_ACTOR_CONFIGURATION_INSTANCES
        : MAX_WORKBENCH_ENEMY_CONFIGURATION_INSTANCES;
    if (nextLibrary[listKey].length >= limit) {
      return { ...current, changed: false, reason: 'instance-limit-reached' };
    }
    nextInstance = {
      ...clone(activeInstance),
      id: createNextConfigurationInstanceId(
        new Set([
          ...nextLibrary.actorInstances.map(item => item.id),
          ...nextLibrary.enemyInstances.map(item => item.id),
        ]),
        kind === 'actor' ? ACTOR_INSTANCE_ID_PREFIX : ENEMY_INSTANCE_ID_PREFIX
      ),
      name: createDuplicateName(activeInstance.name),
    };
    nextLibrary[listKey].push(nextInstance);
  } else if (action === 'rename') {
    const name = normalizeConfigurationName(command.name);
    if (!name || name === activeInstance.name) {
      return { ...current, changed: false, reason: 'name-not-changed' };
    }
    nextLibrary[listKey] = nextLibrary[listKey].map(item =>
      item.id === activeInstance.id ? { ...item, name } : item
    );
    nextInstance = nextLibrary[listKey].find(
      item => item.id === activeInstance.id
    );
  } else if (action === 'delete') {
    if (matchingInstances.length <= 1) {
      return { ...current, changed: false, reason: 'last-entity-instance' };
    }
    nextLibrary[listKey] = nextLibrary[listKey].filter(
      item => item.id !== activeInstance.id
    );
    nextInstance = nextLibrary[listKey].find(
      item => Number(item[entityKey]) === entityId
    );
  }

  nextSelection = setSelectedConfigurationInstanceId(
    nextSelection,
    kind,
    entityId,
    nextInstance.id
  );
  const resolved = reconcileWorkbenchConfigurationState({
    ...state,
    configurationLibrary: nextLibrary,
    configurationSelection: nextSelection,
    syncSelectedValues: false,
  });
  return {
    ...resolved,
    changed: true,
    instance: clone(nextInstance),
    reason: '',
  };
}

export function updateSelectedWorkbenchConfigurationInstance(
  state,
  { kind = 'actor', characterId, enemyId, config } = {}
) {
  const current = reconcileWorkbenchConfigurationState({
    ...state,
    syncSelectedValues: false,
  });
  const entityId =
    kind === 'enemy'
      ? positiveIntegerOrNull(enemyId ?? state?.selection?.enemyId)
      : positiveIntegerOrNull(characterId);
  const listKey = kind === 'enemy' ? 'enemyInstances' : 'actorInstances';
  const entityKey = kind === 'enemy' ? 'enemyId' : 'characterId';
  const configKey = kind === 'enemy' ? 'enemyConfig' : 'actorConfig';
  const selectedId = getSelectedConfigurationInstanceId(
    current.configurationSelection,
    kind,
    entityId
  );
  const nextLibrary = clone(current.configurationLibrary);
  const instance = nextLibrary[listKey].find(
    item => item.id === selectedId && Number(item[entityKey]) === entityId
  );
  if (!instance) return { ...current, changed: false };
  instance[configKey] =
    kind === 'enemy'
      ? normalizeWorkbenchEnemyConfig(config)
      : normalizeWorkbenchActorConfig(config, entityId);
  return {
    ...reconcileWorkbenchConfigurationState({
      ...state,
      configurationLibrary: nextLibrary,
      configurationSelection: current.configurationSelection,
      syncSelectedValues: false,
    }),
    changed: true,
    instance: clone(instance),
  };
}

function normalizeConfigurationInstances(
  input,
  {
    usedIds,
    idPrefix,
    maxCount,
    entityKey,
    configKey,
    normalizeConfig,
    fallbackName,
  }
) {
  return (Array.isArray(input) ? input : [])
    .slice(0, maxCount)
    .map((item, index) => {
      const entityId = positiveIntegerOrNull(item?.[entityKey]);
      if (entityId == null) return null;
      const requestedId = normalizeId(item?.id);
      const id =
        requestedId && !usedIds.has(requestedId)
          ? requestedId
          : createNextConfigurationInstanceId(usedIds, idPrefix);
      usedIds.add(id);
      return {
        id,
        name:
          normalizeConfigurationName(item?.name) ??
          `${fallbackName} ${index + 1}`,
        [entityKey]: entityId,
        [configKey]: normalizeConfig(
          item?.[configKey] ?? item?.config,
          entityId
        ),
      };
    })
    .filter(Boolean);
}

function createActorConfigurationInstance(
  library,
  { characterId, actorConfig }
) {
  if (
    characterId == null ||
    library.actorInstances.length >= MAX_WORKBENCH_ACTOR_CONFIGURATION_INSTANCES
  ) {
    return null;
  }
  return {
    id: createNextLibraryId(library, ACTOR_INSTANCE_ID_PREFIX),
    name: createEntityConfigurationName(
      library.actorInstances,
      characterId,
      'characterId',
      '角色配置'
    ),
    characterId,
    actorConfig: normalizeWorkbenchActorConfig(actorConfig, characterId),
  };
}

function createEnemyConfigurationInstance(library, { enemyId, enemyConfig }) {
  if (
    enemyId == null ||
    library.enemyInstances.length >= MAX_WORKBENCH_ENEMY_CONFIGURATION_INSTANCES
  ) {
    return null;
  }
  return {
    id: createNextLibraryId(library, ENEMY_INSTANCE_ID_PREFIX),
    name: createEntityConfigurationName(
      library.enemyInstances,
      enemyId,
      'enemyId',
      '敌人配置'
    ),
    enemyId,
    enemyConfig: normalizeWorkbenchEnemyConfig(enemyConfig),
  };
}

function findMatchingConfigurationInstance(
  instances,
  entityId,
  config,
  entityKey,
  configKey
) {
  const fingerprint = configurationFingerprint(config);
  return instances.find(
    item =>
      Number(item[entityKey]) === Number(entityId) &&
      configurationFingerprint(item[configKey]) === fingerprint
  );
}

function getSelectedConfigurationInstanceId(selection, kind, entityId) {
  if (kind === 'enemy') return selection.enemyInstanceId;
  return (
    selection.actorInstanceIds.find(
      item => Number(item.characterId) === Number(entityId)
    )?.instanceId ?? ''
  );
}

function setSelectedConfigurationInstanceId(
  selection,
  kind,
  entityId,
  instanceId
) {
  if (kind === 'enemy') {
    return { ...selection, enemyInstanceId: instanceId };
  }
  return {
    ...selection,
    actorInstanceIds: [
      ...selection.actorInstanceIds.filter(
        item => Number(item.characterId) !== Number(entityId)
      ),
      { characterId: Number(entityId), instanceId },
    ],
  };
}

function createNextLibraryId(library, prefix) {
  return createNextConfigurationInstanceId(
    new Set([
      ...library.actorInstances.map(item => item.id),
      ...library.enemyInstances.map(item => item.id),
    ]),
    prefix
  );
}

function createNextConfigurationInstanceId(usedIds, prefix) {
  let index = 1;
  while (usedIds.has(`${prefix}${String(index).padStart(4, '0')}`)) index += 1;
  return `${prefix}${String(index).padStart(4, '0')}`;
}

function createEntityConfigurationName(instances, entityId, entityKey, prefix) {
  const count = instances.filter(
    item => Number(item[entityKey]) === Number(entityId)
  ).length;
  return `${prefix} ${count + 1}`;
}

function createDuplicateName(name) {
  return `${normalizeConfigurationName(name) ?? '配置'} 副本`.slice(
    0,
    CONFIGURATION_NAME_LIMIT
  );
}

function configurationFingerprint(value) {
  return JSON.stringify(value ?? null);
}

function normalizeConfigurationName(value) {
  const text = normalizeText(value);
  return text ? text.slice(0, CONFIGURATION_NAME_LIMIT) : null;
}

function normalizeId(value) {
  return normalizeText(value);
}

function normalizeText(value) {
  const text = String(value ?? '').trim();
  return text || '';
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
