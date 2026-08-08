export const WORKBENCH_CONFIGURATION_SOURCE_CONTRACT_NAME =
  'AzPrWorkbenchConfigurationSource';
export const WORKBENCH_CONFIGURATION_SOURCE_CONTRACT_VERSION = 1;

export function createWorkbenchConfigurationSourceContract({
  configurationLibrary,
  configurationSelection,
  actorConfigs = [],
  enemyConfig,
  enemyId,
} = {}) {
  const actorInstances = Array.isArray(configurationLibrary?.actorInstances)
    ? configurationLibrary.actorInstances
    : [];
  const enemyInstances = Array.isArray(configurationLibrary?.enemyInstances)
    ? configurationLibrary.enemyInstances
    : [];
  const actorSelection = new Map(
    (configurationSelection?.actorInstanceIds ?? []).map(item => [
      Number(item?.characterId),
      textOrNull(item?.instanceId),
    ])
  );
  const actors = (Array.isArray(actorConfigs) ? actorConfigs : []).map(config =>
    createActorSource({ config, actorInstances, actorSelection })
  );
  const enemy = createEnemySource({
    config: enemyConfig,
    enemyId,
    enemyInstances,
    requestedInstanceId: textOrNull(configurationSelection?.enemyInstanceId),
  });
  const sources = [...actors, enemy].filter(Boolean);
  const requestedInstanceCount = sources.filter(
    source => source.requestedInstanceId
  ).length;
  const verifiedInstanceCount = sources.filter(
    source => source.selectionVerified
  ).length;
  const selectionIssueCount = sources.filter(
    source => source.requestedInstanceId && !source.selectionVerified
  ).length;
  const sourceValuesReady =
    sources.length > 0 && sources.every(row => row.ready);
  const selectionIntegrityReady = selectionIssueCount === 0;
  const ready = sourceValuesReady && selectionIntegrityReady;
  const replayIdentity = createReplayIdentity({ actors, enemy });

  return {
    schemaVersion: WORKBENCH_CONFIGURATION_SOURCE_CONTRACT_VERSION,
    contractName: WORKBENCH_CONFIGURATION_SOURCE_CONTRACT_NAME,
    sourceKind:
      requestedInstanceCount === 0
        ? 'project-resolved-configuration-sources'
        : verifiedInstanceCount === sources.length
          ? 'workbench-v13-configuration-instance-sources'
          : 'workbench-v13-configuration-sources-partial',
    status: ready
      ? 'configuration-source-contract-ready'
      : sourceValuesReady
        ? 'configuration-source-selection-invalid'
        : 'configuration-source-values-incomplete',
    ready,
    replayIdentity,
    actors,
    enemy,
    selectionIntegrity: {
      ready: selectionIntegrityReady,
      requestedInstanceCount,
      verifiedInstanceCount,
      issueCount: selectionIssueCount,
    },
    policy: {
      selectedInstanceMustMatchResolvedValues: true,
      replayIdentityUsesResolvedSimulationValues: true,
      displayNamesExcludedFromReplayIdentity: true,
    },
    summary: {
      actorSourceCount: actors.length,
      sourceValuesReadyCount: sources.filter(source => source.ready).length,
      requestedInstanceCount,
      verifiedInstanceCount,
      selectionIssueCount,
    },
  };
}

function createActorSource({ config, actorInstances, actorSelection }) {
  const characterId = positiveIntegerOrNull(config?.characterId);
  const requestedInstanceId = actorSelection.get(characterId) ?? null;
  const instance = actorInstances.find(
    item =>
      item?.id === requestedInstanceId &&
      Number(item?.characterId) === characterId
  );
  return createEntitySource({
    entityKind: 'actor',
    entityId: characterId,
    requestedInstanceId,
    instance,
    instanceConfig: instance?.actorConfig,
    resolvedConfig: config,
  });
}

function createEnemySource({
  config,
  enemyId,
  enemyInstances,
  requestedInstanceId,
}) {
  const normalizedEnemyId = positiveIntegerOrNull(enemyId);
  const instance = enemyInstances.find(
    item =>
      item?.id === requestedInstanceId &&
      Number(item?.enemyId) === normalizedEnemyId
  );
  return createEntitySource({
    entityKind: 'enemy',
    entityId: normalizedEnemyId,
    requestedInstanceId,
    instance,
    instanceConfig: withoutDerivedEnemyProfile(instance?.enemyConfig),
    resolvedConfig: withoutDerivedEnemyProfile(config),
  });
}

function withoutDerivedEnemyProfile(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const result = { ...value };
  delete result.profile;
  return result;
}

function createEntitySource({
  entityKind,
  entityId,
  requestedInstanceId,
  instance,
  instanceConfig,
  resolvedConfig,
}) {
  const resolvedConfigFingerprint =
    createConfigurationFingerprint(resolvedConfig);
  const instanceConfigFingerprint = instance
    ? createConfigurationFingerprint(instanceConfig)
    : null;
  const selectionVerified = Boolean(
    requestedInstanceId &&
    instance &&
    instanceConfigFingerprint === resolvedConfigFingerprint
  );
  const ready = entityId != null && resolvedConfigFingerprint != null;
  const sourceStatus = !requestedInstanceId
    ? 'project-resolved-configuration-source'
    : !instance
      ? 'configuration-instance-missing'
      : selectionVerified
        ? 'configuration-instance-source-verified'
        : 'configuration-instance-values-mismatch';

  return {
    entityKind,
    entityId,
    requestedInstanceId,
    configurationInstanceId: selectionVerified ? requestedInstanceId : null,
    sourceStatus,
    ready,
    selectionVerified,
    resolvedConfig: clone(resolvedConfig),
    resolvedConfigFingerprint,
    instanceConfigFingerprint,
  };
}

function createReplayIdentity({ actors, enemy }) {
  const replayPayload = {
    actors: actors.map(source => ({
      entityId: source.entityId,
      configurationInstanceId: source.configurationInstanceId,
      resolvedConfig: source.resolvedConfig,
    })),
    enemy: enemy
      ? {
          entityId: enemy.entityId,
          configurationInstanceId: enemy.configurationInstanceId,
          resolvedConfig: enemy.resolvedConfig,
        }
      : null,
  };
  return `azpr-config-v1-${stableHash(stableSerialize(replayPayload))}`;
}

function createConfigurationFingerprint(value) {
  if (!value || typeof value !== 'object') return null;
  return `cfg-v1-${stableHash(stableSerialize(value))}`;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
import {
  positiveIntegerOrNull,
  stableHash,
  stableSerialize,
  textOrNull,
} from './contractValues';
