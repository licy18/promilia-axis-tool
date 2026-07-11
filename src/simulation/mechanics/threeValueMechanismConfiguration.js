export const THREE_VALUE_MECHANISM_CONFIGURATION_CONTRACT_NAME =
  'AzPrThreeValueMechanismConfiguration';

const LOADOUT_KEYS = ['kiboId', 'soulessenceId'];
const EQUIPMENT_KEYS = ['weapon', 'top', 'bottom', 'earring', 'ring'];

export function createThreeValueMechanismConfiguration({
  project,
  actors = [],
  enemy,
} = {}) {
  const metadata = project?.metadata ?? {};
  const selection = metadata.configurationSelection ?? {};
  const actorConfigs = new Map(
    (metadata.actorConfigs ?? []).map(config => [
      Number(config.characterId),
      config,
    ])
  );
  const actorSelections = new Map(
    (selection.actorInstanceIds ?? []).map(item => [
      Number(item.characterId),
      item.instanceId,
    ])
  );
  const actorSources = actors.map(actor =>
    createActorConfigurationSource({
      actor,
      actorConfig: actorConfigs.get(Number(actor.characterId)),
      instanceId: actorSelections.get(Number(actor.characterId)),
    })
  );
  const enemySource = createEnemyConfigurationSource({
    enemy,
    enemyConfig: metadata.enemyConfig,
    instanceId: selection.enemyInstanceId,
  });
  const instanceBacked = Boolean(
    actorSources.some(source => source.configurationInstanceId) ||
    enemySource?.configurationInstanceId
  );
  const ready =
    actorSources.length > 0 &&
    actorSources.every(source => source.ready) &&
    enemySource?.ready === true;

  return {
    schemaVersion: 1,
    sourceKind: instanceBacked
      ? 'workbench-v13-configuration-instances'
      : 'project-resolved-mechanism-configuration',
    contractName: THREE_VALUE_MECHANISM_CONFIGURATION_CONTRACT_NAME,
    status: ready
      ? 'mechanism-configuration-ready'
      : 'mechanism-configuration-incomplete',
    ready,
    actors: actorSources,
    enemy: enemySource,
    policy: {
      resolvedProjectValuesOnly: true,
      unconfirmedCultivationEffectsApplied: false,
      calculatorReadsConfigurationLibrary: false,
    },
    summary: {
      actorConfigurationCount: actorSources.length,
      actorInstanceBackedCount: actorSources.filter(
        source => source.configurationInstanceId
      ).length,
      enemyInstanceBacked: Boolean(enemySource?.configurationInstanceId),
      unappliedLoadoutSelectionCount: actorSources.reduce(
        (total, source) => total + source.loadout.selectedItemCount,
        0
      ),
      elementDefenseOverrideCount:
        enemySource?.elementDefense.overrideCount ?? 0,
    },
  };
}

export function createThreeValueMechanismConfigurationContext({
  scenario,
  sourceActor,
  targetEnemy,
  valueTargetKind,
} = {}) {
  const contract = scenario?.mechanismConfiguration ?? null;
  const actorSource = contract?.actors?.find(
    source => source.actorId === sourceActor?.id
  );
  const enemySource =
    contract?.enemy && targetEnemy && contract.enemy.targetId === targetEnemy.id
      ? contract.enemy
      : null;
  const targetReady =
    valueTargetKind === 'source-actor'
      ? actorSource?.ready === true
      : enemySource?.ready === true;
  const ready = Boolean(contract?.ready && actorSource?.ready && targetReady);

  return {
    schemaVersion: contract?.schemaVersion ?? 1,
    sourceKind:
      contract?.sourceKind ?? 'mechanism-configuration-contract-missing',
    contractName: THREE_VALUE_MECHANISM_CONFIGURATION_CONTRACT_NAME,
    status: ready
      ? 'mechanism-configuration-context-ready'
      : 'mechanism-configuration-context-incomplete',
    ready,
    sourceActor: actorSource ?? null,
    targetEnemy: enemySource,
    policy: contract?.policy ?? null,
  };
}

function createActorConfigurationSource({ actor, actorConfig, instanceId }) {
  const resolvedConfig = actorConfig ?? actor ?? {};
  const initialSp = numberOrNull(actor?.initialSp ?? resolvedConfig.initialSp);
  const loadout = createLoadoutSource(actor?.loadout ?? resolvedConfig.loadout);
  const ready = Boolean(
    actor?.id && Number.isFinite(Number(actor?.characterId))
  );
  return {
    actorId: actor?.id ?? null,
    characterId: numberOrNull(actor?.characterId),
    configurationInstanceId: textOrNull(instanceId),
    sourceStatus: instanceId
      ? 'workbench-actor-configuration-instance-resolved'
      : 'project-actor-configuration-resolved',
    sourcePaths: {
      instance: instanceId
        ? 'project.metadata.configurationSelection.actorInstanceIds'
        : null,
      resolvedConfig: 'project.metadata.actorConfigs',
      runtimeActor: 'scenario.actors',
    },
    ready,
    level: numberOrNull(actor?.level ?? resolvedConfig.level),
    initialSp,
    loadout,
    application: {
      stats: {
        status: 'compiled-actor-stats-applied',
        appliedToCalculators: true,
      },
      initialEnergy: {
        status: Number.isFinite(initialSp)
          ? 'project-initial-sp-applied-to-runtime-baseline'
          : 'initial-sp-baseline-pending',
        appliedToRuntime: Number.isFinite(initialSp),
      },
      loadout: {
        status: 'project-loadout-effects-unconfirmed-unapplied',
        appliedToCalculators: false,
      },
    },
  };
}

function createEnemyConfigurationSource({ enemy, enemyConfig, instanceId }) {
  if (!enemy) return null;
  const resolvedConfig = enemyConfig ?? enemy;
  const elementDefenseOverrides =
    resolvedConfig.elementDefenseOverrides ??
    enemy.elementDefenseOverrides ??
    {};
  return {
    targetId: enemy.id ?? null,
    enemyId: numberOrNull(enemy.enemyId),
    configurationInstanceId: textOrNull(instanceId),
    sourceStatus: instanceId
      ? 'workbench-enemy-configuration-instance-resolved'
      : 'project-enemy-configuration-resolved',
    sourcePaths: {
      instance: instanceId
        ? 'project.metadata.configurationSelection.enemyInstanceId'
        : null,
      resolvedConfig: 'project.metadata.enemyConfig',
      runtimeEnemy: 'scenario.enemy',
    },
    ready: Boolean(enemy.id && Number.isFinite(Number(enemy.enemyId))),
    level: numberOrNull(enemy.level ?? resolvedConfig.level),
    hpMultiplier: numberOrNull(
      enemy.hpMultiplier ?? resolvedConfig.hpMultiplier
    ),
    defenseMultiplier: numberOrNull(
      enemy.defenseMultiplier ?? resolvedConfig.defenseMultiplier
    ),
    toughnessMultiplier: numberOrNull(
      enemy.toughnessMultiplier ?? resolvedConfig.toughnessMultiplier
    ),
    initialToughnessRatio: numberOrNull(
      enemy.initialToughnessRatio ?? resolvedConfig.initialToughnessRatio
    ),
    elementDefense: {
      overrideCount: Object.values(elementDefenseOverrides).filter(
        Number.isFinite
      ).length,
      overrides: Object.fromEntries(
        Object.entries(elementDefenseOverrides).filter(([, value]) =>
          Number.isFinite(value)
        )
      ),
    },
    application: {
      hpBaseline: {
        status: 'enemy-hp-multiplier-applied-to-runtime-baseline',
        appliedToRuntime: true,
      },
      defensePreview: {
        status: 'enemy-defense-multiplier-applied-to-hp-preview',
        appliedToCalculators: true,
      },
      toughnessBaseline: {
        status: 'enemy-toughness-config-applied-to-runtime-baseline',
        appliedToRuntime: true,
      },
      level: {
        status: 'enemy-level-formula-unconfirmed-unapplied',
        appliedToCalculators: false,
      },
      elementDefense: {
        status: 'enemy-element-defense-formula-unconfirmed-unapplied',
        appliedToCalculators: false,
      },
    },
  };
}

function createLoadoutSource(loadout = {}) {
  const equipment = Object.fromEntries(
    EQUIPMENT_KEYS.map(key => [key, numberOrNull(loadout?.equipment?.[key])])
  );
  const source = {
    kiboId: numberOrNull(loadout?.kiboId),
    equipment,
    soulessenceId: numberOrNull(loadout?.soulessenceId),
  };
  return {
    ...source,
    selectedItemCount:
      LOADOUT_KEYS.filter(key => source[key] != null).length +
      EQUIPMENT_KEYS.filter(key => equipment[key] != null).length,
    appliedToCalculators: false,
  };
}

function numberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function textOrNull(value) {
  const text = String(value ?? '').trim();
  return text || null;
}
