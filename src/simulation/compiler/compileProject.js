import {
  ACTION_TYPES,
  EFFECT_TARGET_KINDS,
  ENEMY_ELEMENT_DEFENSE_DEFINITIONS,
  validateProject,
} from '../../domain/projectSchema';
import { parseDamageSegments } from '../mechanics/damage';
import { createThreeValueMechanismConfiguration } from '../mechanics/threeValueMechanismConfiguration';
import { resolveThreeValueMechanicsProfile } from '../mechanics/threeValueMechanicsProfile';
import {
  DEFAULT_THREE_VALUE_MECHANICS_PROFILE_CATALOG,
  createThreeValueMechanicsProfileCatalog,
  resolveThreeValueMechanicsProfileCatalogSelection,
} from '../mechanics/threeValueMechanicsProfileCatalog';

export class CompileProjectError extends Error {
  constructor(issues) {
    super('Project cannot be compiled for simulation');
    this.name = 'CompileProjectError';
    this.issues = issues;
  }
}

export function compileProject(
  project,
  gameData,
  {
    threeValueMechanicsProfile = null,
    threeValueMechanicsProfiles = [],
    threeValueMechanicsProfileCatalog = DEFAULT_THREE_VALUE_MECHANICS_PROFILE_CATALOG,
  } = {}
) {
  const validation = validateProject(project, gameData);
  if (!validation.valid) {
    throw new CompileProjectError(validation.errors);
  }

  const charactersById = indexById(gameData.characters);
  const skillsById = indexById(gameData.skills);
  const enemiesById = indexById(gameData.enemies);
  const elementsById = indexById(gameData.elements);
  const actorsById = new Map(
    project.actors.map(actor => [actor.id, compileActor(actor, charactersById)])
  );
  const enemy = compileEnemy(project.enemy, enemiesById, elementsById);
  const actors = [...actorsById.values()];
  const baseProfileCatalog =
    threeValueMechanicsProfileCatalog ??
    DEFAULT_THREE_VALUE_MECHANICS_PROFILE_CATALOG;
  const activeProfileCatalog =
    Array.isArray(threeValueMechanicsProfiles) &&
    threeValueMechanicsProfiles.length > 0
      ? createThreeValueMechanicsProfileCatalog({
          catalogId: 'compile-option-profile-catalog',
          profiles: [
            ...baseProfileCatalog.profiles,
            ...threeValueMechanicsProfiles,
          ],
          defaultSelection: baseProfileCatalog.defaultSelection,
        })
      : baseProfileCatalog;
  const catalogResolution = threeValueMechanicsProfile
    ? null
    : resolveThreeValueMechanicsProfileCatalogSelection(
        activeProfileCatalog,
        project?.metadata?.mechanicsProfileSelection
      );
  const mechanicsProfileResolution = threeValueMechanicsProfile
    ? {
        ...resolveThreeValueMechanicsProfile(threeValueMechanicsProfile),
        selection: {
          schemaVersion: 1,
          contractName: 'AzPrWorkbenchMechanicsProfileSelection',
          profileId: threeValueMechanicsProfile?.profileId ?? null,
          profileVersion:
            Number(threeValueMechanicsProfile?.profileVersion) || null,
        },
      }
    : catalogResolution.profileResolution;
  const mechanicsProfile = mechanicsProfileResolution.profile;
  const persistedProfileSelection = mechanicsProfileResolution.selection;
  const compiledMechanicsProfileSelection = {
    schemaVersion: 1,
    contractName: 'AzPrScenarioMechanicsProfileSelection',
    sourceKind: threeValueMechanicsProfile
      ? 'compile-option-mechanics-profile-selection'
      : 'project-persisted-mechanics-profile-selection',
    status: mechanicsProfileResolution.fallback
      ? 'mechanics-profile-selection-ready-with-fallback'
      : 'mechanics-profile-selection-ready',
    requestedProfileId: persistedProfileSelection?.profileId ?? null,
    requestedProfileVersion: persistedProfileSelection?.profileVersion ?? null,
    resolvedProfileId: mechanicsProfile.profileId,
    resolvedProfileVersion: mechanicsProfile.profileVersion,
    fallback: mechanicsProfileResolution.fallback,
    fallbackReason: mechanicsProfileResolution.fallbackReason,
    compatibilityStatus: threeValueMechanicsProfile
      ? mechanicsProfileResolution.fallback
        ? 'invalid'
        : 'exact'
      : catalogResolution.status,
    resolutionStatus: mechanicsProfileResolution.fallback
      ? 'fallback'
      : 'exact',
    catalogId: activeProfileCatalog.catalogId,
    catalogVersion: activeProfileCatalog.catalogVersion,
  };
  const mechanismConfiguration = createThreeValueMechanismConfiguration({
    project,
    actors,
    enemy,
    mechanicsProfile,
    mechanicsProfileSelection: compiledMechanicsProfileSelection,
  });
  const mechanicsProfileCatalog = {
    contractName: activeProfileCatalog.contractName,
    contractVersion: activeProfileCatalog.contractVersion,
    catalogId: activeProfileCatalog.catalogId,
    catalogVersion: activeProfileCatalog.catalogVersion,
    status: activeProfileCatalog.status,
    ready: activeProfileCatalog.ready,
    profileCount: activeProfileCatalog.summary.profileCount,
  };
  const mechanicsProfileCompatibility = threeValueMechanicsProfile
    ? null
    : {
        status: catalogResolution.status,
        resolutionStatus: catalogResolution.resolutionStatus,
        issueKind: catalogResolution.issueKind,
        compatible: catalogResolution.compatible,
      };
  const gameDataReferenceContract =
    project?.metadata?.gameDataReferenceContract ?? null;
  const gameDataCatalog = gameDataReferenceContract
    ? {
        ...gameDataReferenceContract.catalog,
        status: gameDataReferenceContract.ready
          ? 'workbench-game-data-reference-ready'
          : 'workbench-game-data-reference-incomplete',
        referenceIdentity: gameDataReferenceContract.referenceIdentity,
      }
    : null;
  const gameDataCompatibility = project?.metadata?.gameDataCompatibilityReport
    ? {
        status: project.metadata.gameDataCompatibilityReport.status,
        compatible:
          project.metadata.gameDataCompatibilityReport.compatible === true,
        importAllowed:
          project.metadata.gameDataCompatibilityReport.importAllowed === true,
      }
    : null;
  const actionGameDataReferences = new Map(
    (gameDataReferenceContract?.actions ?? []).map(reference => [
      reference.actionId,
      reference,
    ])
  );

  const actions = project.actions
    .map(action =>
      compileAction(
        action,
        actorsById,
        enemy,
        skillsById,
        actionGameDataReferences.get(action.id) ?? null
      )
    )
    .sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));

  return {
    schemaVersion: 1,
    sourceProject: {
      id: project.id,
      name: project.name,
      schemaVersion: project.schemaVersion,
      metadata: project.metadata ?? {},
    },
    runtimeSampleCaptures: collectRuntimeSampleCaptures(project.metadata),
    time: {
      ...project.time,
    },
    team: compileTeam(project.team, actorsById),
    actors,
    enemy,
    mechanismConfiguration,
    mechanicsProfile,
    mechanicsProfileSelection: compiledMechanicsProfileSelection,
    mechanicsProfileCatalog,
    mechanicsProfileCompatibility,
    gameDataCatalog,
    gameDataCompatibility,
    actions,
    cycleBoundaries: (project.cycleBoundaries ?? []).map(boundary => ({
      ...boundary,
    })),
    initialRuntimeState: project.initialRuntimeState
      ? JSON.parse(JSON.stringify(project.initialRuntimeState))
      : null,
    diagnostics: {
      validationWarnings: validation.warnings,
      missingTimingActionIds: actions
        .filter(action => action.timing?.needsTimingData)
        .map(action => action.id),
    },
  };
}

function compileTeam(team, actorsById) {
  const actorsByCharacterId = new Map(
    [...actorsById.values()].map(actor => [Number(actor.characterId), actor])
  );
  return {
    slots: (team?.slots ?? []).map(slot => {
      const actor = actorsByCharacterId.get(Number(slot.characterId));
      return {
        ...slot,
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? null,
      };
    }),
  };
}

function collectRuntimeSampleCaptures(metadata = {}) {
  return [
    ...arrayOrSingle(metadata.runtimeSampleCaptures),
    ...arrayOrSingle(metadata.recoverSpRuntimeSampleCaptures),
    ...arrayOrSingle(metadata.runtimeSamples),
  ].filter(Boolean);
}

function arrayOrSingle(value) {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function compileActor(actor, charactersById) {
  const character = charactersById.get(Number(actor.characterId));

  return {
    ...actor,
    source: {
      character,
    },
    stats: {
      attack: getPanelCoreValue(
        actor.attributePanel,
        'attack',
        getAttributeValue(actor.baseAttributes, 'ATK')
      ),
      maxHp: getPanelCoreValue(
        actor.attributePanel,
        'maxHp',
        getAttributeValue(actor.baseAttributes, 'MAXHP')
      ),
      physicalDefense: getPanelCoreValue(
        actor.attributePanel,
        'physicalDefense',
        getAttributeValue(actor.baseAttributes, 'DEF')
      ),
      magicalDefense: getPanelCoreValue(
        actor.attributePanel,
        'magicalDefense',
        getAttributeValue(actor.baseAttributes, 'MDEF')
      ),
      tuningStrength: getPanelCoreValue(
        actor.attributePanel,
        'tuningStrength',
        0
      ),
      critRate: getPanelCoreValue(
        actor.attributePanel,
        'critRate',
        getAttributeValue(actor.baseAttributes, 'CRI')
      ),
      critDamage: getPanelCoreValue(
        actor.attributePanel,
        'critDamage',
        getAttributeValue(actor.baseAttributes, 'CRI_DMG')
      ),
      damageAmplification: getPanelCoreValue(
        actor.attributePanel,
        'damageAmplification',
        0
      ),
      damageReduction: getPanelCoreValue(
        actor.attributePanel,
        'damageReduction',
        0
      ),
      maxSp: getAttributeValue(actor.baseAttributes, 'MAXSP'),
      source: actor.attributePanel
        ? 'character-attribute-panel-current-rank'
        : 'baseAttributes',
    },
  };
}

function compileEnemy(enemy, enemiesById, elementsById) {
  const sourceEnemy = enemiesById.get(Number(enemy.enemyId));
  const elementDefenses = ENEMY_ELEMENT_DEFENSE_DEFINITIONS.map(definition =>
    compileEnemyElementDefense(enemy, definition, elementsById)
  );
  const toughnessBase = getOptionalAttributeValue(
    enemy.baseAttributes,
    'WEAKNESS_POINT_MAX'
  );
  const toughnessMultiplier = positiveNumberOrDefault(
    enemy.toughnessMultiplier,
    1
  );
  const initialToughnessRatio = clampNumber(
    enemy.initialToughnessRatio,
    0,
    1,
    1
  );
  const maxToughness = Number.isFinite(toughnessBase)
    ? roundRuntimeConfigValue(toughnessBase * toughnessMultiplier)
    : null;
  const initialToughness = Number.isFinite(maxToughness)
    ? roundRuntimeConfigValue(maxToughness * initialToughnessRatio)
    : null;

  return {
    ...enemy,
    source: {
      enemy: sourceEnemy,
    },
    stats: {
      attack: getAttributeValue(enemy.baseAttributes, 'ATK'),
      maxHp: getAttributeValue(enemy.baseAttributes, 'MAXHP'),
      physicalDefense: getAttributeValue(enemy.baseAttributes, 'DEF'),
      magicalDefense: getAttributeValue(enemy.baseAttributes, 'MDEF'),
      maxToughness,
      initialToughness,
    },
    toughness: {
      sourceKind: 'azpr-enemy-WEAKNESS_POINT_MAX',
      sourceStatus: Number.isFinite(toughnessBase)
        ? 'toughness-config-derived-from-enemy-base-attribute'
        : 'toughness-config-pending-missing-WEAKNESS_POINT_MAX',
      sourcePath: 'project.enemy.baseAttributes[WEAKNESS_POINT_MAX]',
      baseMax: toughnessBase,
      maxMultiplier: toughnessMultiplier,
      initialRatio: initialToughnessRatio,
      maxValue: maxToughness,
      initialValue: initialToughness,
      applied: Number.isFinite(initialToughness),
    },
    elementDefenses,
    elementDefenseConfig: {
      sourceKind: 'azpr-enemy-element-defense-base-attributes',
      sourceStatus: elementDefenses.every(row => row.baseValue != null)
        ? 'element-defense-config-derived-from-enemy-base-attributes'
        : 'element-defense-config-partial-missing-base-attributes',
      sourcePath: 'project.enemy.baseAttributes[*_DEFENSE]',
      overrideCount: elementDefenses.filter(row => row.overrideValue != null)
        .length,
      formulaStatus: 'project-config-only',
      appliedToDamage: false,
    },
  };
}

function compileEnemyElementDefense(enemy, definition, elementsById) {
  const attribute = (enemy.baseAttributes ?? []).find(
    item => item.key === definition.attributeKey
  );
  const element = elementsById.get(definition.elementId);
  const baseValue = Number.isFinite(attribute?.value) ? attribute.value : null;
  const configuredOverride =
    enemy.elementDefenseOverrides?.[definition.attributeKey];
  const overrideValue = Number.isFinite(configuredOverride)
    ? configuredOverride
    : null;

  return {
    elementId: definition.elementId,
    elementName: element?.name ?? definition.fallbackName,
    elementAbbrName: element?.abbrName ?? definition.fallbackName,
    color: element?.color ?? null,
    attributeId: attribute?.id ?? null,
    attributeKey: definition.attributeKey,
    attributeName: attribute?.name ?? `${definition.fallbackName}伤害减免`,
    isRatio: attribute?.isRatio ?? true,
    baseValue,
    overrideValue,
    effectiveValue: overrideValue ?? baseValue,
    sourceStatus:
      overrideValue != null
        ? 'user-override'
        : baseValue != null
          ? 'azpr-enemy-base-attribute'
          : 'missing-enemy-base-attribute',
    appliedToDamage: false,
  };
}

function compileAction(
  action,
  actorsById,
  enemy,
  skillsById,
  gameDataReference = null
) {
  const effectCommands = compileActionEffectCommands(action, actorsById, enemy);
  const effectCommandsField = createCompiledEffectCommandsField(effectCommands);
  if (action.type === ACTION_TYPES.SWITCH) {
    return {
      ...action,
      ...effectCommandsField,
      actor: actorsById.get(action.actorId) ?? null,
      targetActor: actorsById.get(action.targetActorId) ?? null,
      target: null,
      source: {},
      gameDataReference,
      damageSegments: [],
      selectedDamageSegment: null,
    };
  }

  if (action.type === ACTION_TYPES.RESOURCE) {
    return {
      ...action,
      ...effectCommandsField,
      actor: action.actorId ? (actorsById.get(action.actorId) ?? null) : null,
      target: null,
      source: {},
      gameDataReference,
      damageSegments: [],
      selectedDamageSegment: null,
    };
  }

  if (action.type === ACTION_TYPES.ENEMY_EVENT) {
    return {
      ...action,
      ...effectCommandsField,
      actor: null,
      target: action.targetId === enemy.id ? enemy : null,
      source: {},
      gameDataReference,
      damageSegments: [],
      selectedDamageSegment: null,
    };
  }

  if (action.type !== ACTION_TYPES.SKILL) {
    return {
      ...action,
      ...effectCommandsField,
      actor: null,
      target: action.targetId === enemy.id ? enemy : null,
      source: {},
      gameDataReference,
      damageSegments: [],
      selectedDamageSegment: null,
    };
  }

  const actor = actorsById.get(action.actorId);
  const skill =
    gameDataReference?.skill?.record ?? skillsById.get(Number(action.skillId));
  const damageSegments = parseDamageSegments(action);
  const actionVariantIndex = Number(
    action.actionVariantIndex ?? action.damageSegmentIndex
  );
  const selectedDamageSegment =
    damageSegments.find(
      segment => Number(segment.index) === actionVariantIndex
    ) ??
    damageSegments[0] ??
    null;

  return {
    ...action,
    ...effectCommandsField,
    actionVariantIndex: selectedDamageSegment?.index ?? actionVariantIndex,
    actionVariants: damageSegments,
    selectedActionVariant: selectedDamageSegment,
    actor,
    target: action.targetId === enemy.id ? enemy : null,
    gameDataReference,
    source: {
      skill,
      gameDataReference,
    },
    damageSegments,
    selectedDamageSegment,
  };
}

function compileActionEffectCommands(action, actorsById, enemy) {
  return (action.effectCommands ?? []).map((command, index) => {
    const sourceActor = actorsById.get(action.actorId) ?? null;
    const targetId = resolveEffectCommandTargetId(command, action, enemy);
    const targetActor = actorsById.get(targetId) ?? null;
    const targetEnemy = targetId === enemy.id ? enemy : null;
    return {
      ...command,
      schemaVersion: 1,
      sourceKind: 'azpr-compiled-action-effect-command',
      status: 'compiled-action-effect-command-ready',
      commandIndex: index,
      sourceActionId: action.id,
      sourceActionName: action.name,
      sourceActorId: action.actorId ?? null,
      sourceActorName: sourceActor?.name ?? null,
      targetId,
      targetName: targetActor?.name ?? targetEnemy?.name ?? null,
      timeMs: roundRuntimeConfigValue(
        (Number(action.startMs) || 0) + (Number(command.offsetMs) || 0)
      ),
      modifiers: (command.modifiers ?? []).map(modifier => ({ ...modifier })),
      appliedToCalculators: false,
    };
  });
}

function resolveEffectCommandTargetId(command, action, enemy) {
  if (command.targetId) {
    return command.targetId;
  }
  if (command.targetKind === EFFECT_TARGET_KINDS.ENEMY) {
    return action.targetId ?? enemy.id;
  }
  return action.actorId ?? null;
}

function createCompiledEffectCommandsField(effectCommands) {
  return effectCommands.length > 0 ? { effectCommands } : {};
}

function indexById(items = []) {
  return new Map(items.map(item => [Number(item.id), item]));
}

function getAttributeValue(baseAttributes, key) {
  const attribute = (baseAttributes ?? []).find(item => item.key === key);
  return Number.isFinite(attribute?.value) ? attribute.value : 0;
}

function getOptionalAttributeValue(baseAttributes, key) {
  const attribute = (baseAttributes ?? []).find(item => item.key === key);
  return Number.isFinite(attribute?.value) ? attribute.value : null;
}

function positiveNumberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

function roundRuntimeConfigValue(value) {
  return Math.round(Number(value) * 1e6) / 1e6;
}

function getPanelCoreValue(attributePanel, key, fallback = 0) {
  const value = attributePanel?.core?.[key]?.effectiveValue;
  return Number.isFinite(value) ? value : fallback;
}
