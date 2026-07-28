import { getAzprWorkbenchSeed } from '../data/azprGenerated';
import { WORKBENCH_FRAME_MS, msToFrame, snapMsToFrame } from './timebase';
import {
  ACTION_TYPES,
  EFFECT_OPERATIONS,
  EFFECT_STACK_MODES,
  EFFECT_TARGET_KINDS,
  ENEMY_ELEMENT_DEFENSE_DEFINITIONS,
  createActorFromCharacter,
  createAnnotationAction,
  createEnemyFromData,
  createEnemyEventAction,
  createKiboEventAction,
  createEffectCommand,
  createProject,
  createResourceAction,
  createSkillAction,
  createSwitchAction,
  createWaitAction,
} from './projectSchema';
import { getSkillActionCatalog } from './skillActionCatalog';
import { normalizeWorkbenchRuntimeSampleCaptures } from './workbenchRuntimeSampleCapture';
import { normalizeWorkbenchActionRelations } from './workbenchActionRelations';
import {
  DEFAULT_WORKBENCH_DURATION_MS,
  normalizeWorkbenchCycleBoundaries,
} from './workbenchCycleBoundaries';
import {
  getSkillActionVariants,
  getSkillDamageSegments,
} from './skillDamageSegments';
import { createWorkbenchConfigurationSourceContract } from './workbenchConfigurationSourceContract';
import {
  createWorkbenchGameDataReferenceContract,
  normalizeWorkbenchGameDataBinding,
} from './workbenchGameDataCatalog';
import { normalizeWorkbenchMechanicsProfileSelection } from './workbenchMechanicsProfileSelection';
import {
  WORKBENCH_TEAM_SLOT_COUNT,
  createWorkbenchTimelineTopology,
} from './workbenchTimelineTopology';
import { normalizeInitialRuntimeState } from './initialRuntimeState';
import {
  createKiboActionStatusGeneration,
  createSkillActionStatusGeneration,
  mergeGeneratedActionStatusEffectCommands,
  stripGeneratedActionStatusEffectCommands,
} from './actionStatusGeneration';
import { resolveActorEffectiveMaxSp } from './spUnitContract';
import { normalizeAttackInputActionFields } from './workbenchAttackInputChain';
import { normalizeActionHitOverrides } from './actionHitOverrides';
import { normalizeActionVariantInputSelection } from './actionVariantInputSelection';
import { normalizeCombatScenario } from './combatScenario';
import { normalizeWorkbenchActionSchedulingContract } from './workbenchActionScheduling';

export { getSkillActionCatalog } from './skillActionCatalog';
export {
  getSkillActionVariants,
  getSkillDamageSegments,
} from './skillDamageSegments';

const workbenchSeed = getAzprWorkbenchSeed();

const DEFAULT_SECONDARY_CHARACTER_ID =
  workbenchSeed.gameData.characters.find(
    character => character.id !== workbenchSeed.defaults.characterId
  )?.id ?? workbenchSeed.defaults.characterId;

const DEFAULT_TERTIARY_CHARACTER_ID =
  workbenchSeed.gameData.characters.find(
    character =>
      character.id !== workbenchSeed.defaults.characterId &&
      character.id !== DEFAULT_SECONDARY_CHARACTER_ID
  )?.id ?? workbenchSeed.defaults.characterId;

export const DEFAULT_WORKBENCH_TEAM_SLOTS = Object.freeze([
  Object.freeze({
    slotId: 'team-slot-1',
    position: 0,
    characterId: workbenchSeed.defaults.characterId,
  }),
  Object.freeze({
    slotId: 'team-slot-2',
    position: 1,
    characterId: DEFAULT_SECONDARY_CHARACTER_ID,
  }),
  Object.freeze({
    slotId: 'team-slot-3',
    position: 2,
    characterId: DEFAULT_TERTIARY_CHARACTER_ID,
  }),
]);

const WORKBENCH_EQUIPMENT = workbenchSeed.gameData.equipment;
const WORKBENCH_ENEMIES = workbenchSeed.gameData.enemies;
const WORKBENCH_KIBOS = workbenchSeed.gameData.kibos;
const WORKBENCH_SOULESSENCES = workbenchSeed.gameData.soulessences;
const WORKBENCH_GAME_DATA = Object.freeze(workbenchSeed.gameData);
const WORKBENCH_EQUIPMENT_SLOT_TYPES = Object.freeze({
  weapon: '武器',
  top: '上装',
  bottom: '下装',
  earring: '耳环',
  ring: '戒指',
});
const WORKBENCH_ENEMY_ELEMENT_DEFENSE_KEYS = new Set(
  ENEMY_ELEMENT_DEFENSE_DEFINITIONS.map(item => item.attributeKey)
);

export const DEFAULT_WORKBENCH_SELECTION = Object.freeze({
  characterId: workbenchSeed.defaults.characterId,
  secondaryCharacterId: DEFAULT_SECONDARY_CHARACTER_ID,
  skillId: workbenchSeed.defaults.skillId,
  enemyId: workbenchSeed.defaults.enemyId,
});

export const DEFAULT_WORKBENCH_ENEMY_CONFIG = Object.freeze({
  level: 80,
  hpMultiplier: 1,
  defenseMultiplier: 1,
  toughnessMultiplier: 1,
  initialToughnessRatio: 1,
  elementDefenseOverrides: Object.freeze({}),
});

export const DEFAULT_WORKBENCH_ACTOR_LEVEL = 80;
export const DEFAULT_WORKBENCH_KIBO_CONFIG = Object.freeze({
  level: 80,
  hobbyId: 1,
  intimacyLevel: 1,
  comprehensionByAttribute: Object.freeze({
    1: 100,
    3: 100,
    4: 100,
    5: 100,
  }),
});
export const DEFAULT_WORKBENCH_CULTIVATION = Object.freeze({
  starGiftRank: 0,
  favorabilityLevel: 0,
});

export const DEFAULT_WORKBENCH_ACTION_ID = 'action-0001';

export function getWorkbenchSeed() {
  return workbenchSeed;
}

export function getWorkbenchGameData() {
  return WORKBENCH_GAME_DATA;
}

export function getWorkbenchLoadoutOptions() {
  return {
    kibos: WORKBENCH_KIBOS,
    soulessences: WORKBENCH_SOULESSENCES,
    equipment: Object.fromEntries(
      Object.entries(WORKBENCH_EQUIPMENT_SLOT_TYPES).map(([slotKey, type]) => [
        slotKey,
        WORKBENCH_EQUIPMENT.filter(item => item.type === type),
      ])
    ),
  };
}

export function getSkillsForCharacter(characterId) {
  return workbenchSeed.gameData.skills.filter(
    skill => skill.characterId === Number(characterId)
  );
}

export function createWorkbenchActionDraft({
  id = DEFAULT_WORKBENCH_ACTION_ID,
  type = ACTION_TYPES.SKILL,
  skillId = null,
  actorCharacterId = DEFAULT_WORKBENCH_SELECTION.characterId,
  startMs = 0,
  durationMs = 1000,
  level = 1,
  damageSegmentIndex = 0,
  actionVariantIndex = damageSegmentIndex,
  targetCharacterId = DEFAULT_WORKBENCH_SELECTION.secondaryCharacterId,
  resource = 'sp',
  change = 50,
  reason = 'manual-axis-resource',
  eventType = 'phase',
  kiboId = null,
  name = '',
  icon = null,
  durationFrames = null,
  timingSource = null,
  timingStatus = null,
  timingReasons = [],
  timingSourceIdentity = null,
  needsTimingData = null,
  controlSubSkillIndex = null,
  variantInputSelection = null,
  actionScheduling = null,
  sourceEvidenceStatus = null,
  scenarioRuntimeStatus = null,
  hitOverrides = null,
  note = '',
  insertion = null,
  generationBatch = null,
  effectCommands = [],
  ...attackInputFields
} = {}) {
  const actionId = String(id ?? '').trim() || DEFAULT_WORKBENCH_ACTION_ID;
  const isSwitchAction = type === ACTION_TYPES.SWITCH;
  const normalizedStartMs = Math.max(0, snapMsToFrame(Number(startMs) || 0));
  const normalizedActionVariantIndex = Math.max(
    0,
    Number(actionVariantIndex ?? damageSegmentIndex) || 0
  );
  const normalizedSkillId =
    type === ACTION_TYPES.KIBO_EVENT
      ? positiveIntegerOrNull(skillId)
      : Number(skillId ?? DEFAULT_WORKBENCH_SELECTION.skillId);
  const skill = findById(workbenchSeed.gameData.skills, normalizedSkillId);
  const statusGeneration =
    type === ACTION_TYPES.SKILL && skill
      ? createSkillActionStatusGeneration({
          actionId,
          skill,
          level,
          actionVariantIndex: normalizedActionVariantIndex,
        })
      : null;
  const resolvedEffectCommands = isSwitchAction
    ? []
    : type === ACTION_TYPES.SKILL
      ? mergeGeneratedActionStatusEffectCommands(
          effectCommands,
          statusGeneration?.effectCommands
        )
      : stripGeneratedActionStatusEffectCommands(effectCommands);
  const kiboStatusGeneration =
    type === ACTION_TYPES.KIBO_EVENT
      ? createKiboActionStatusGeneration({
          actionId,
          kiboId,
          skillId: normalizedSkillId,
          timingSource,
        })
      : null;
  const normalizedTimingReasons = normalizeTextArray(timingReasons);
  const hasTimingContract = Boolean(
    positiveIntegerOrNull(durationFrames) ||
    textOrNull(timingSource) ||
    textOrNull(timingStatus) ||
    normalizedTimingReasons.length ||
    textOrNull(timingSourceIdentity) ||
    needsTimingData != null
  );
  return {
    id: actionId,
    type,
    skillId: normalizedSkillId,
    actorCharacterId:
      Number(actorCharacterId) || DEFAULT_WORKBENCH_SELECTION.characterId,
    startMs: normalizedStartMs,
    durationMs: isSwitchAction
      ? 0
      : Math.max(WORKBENCH_FRAME_MS, snapMsToFrame(Number(durationMs) || 1000)),
    level: Math.max(1, Number(level) || 1),
    actionVariantIndex: normalizedActionVariantIndex,
    damageSegmentIndex: normalizedActionVariantIndex,
    targetCharacterId:
      Number(targetCharacterId) ||
      DEFAULT_WORKBENCH_SELECTION.secondaryCharacterId,
    resource,
    change: Number(change) || 0,
    reason,
    eventType,
    controlSubSkillIndex: nonNegativeIntegerOrNull(controlSubSkillIndex),
    variantInputSelection: normalizeActionVariantInputSelection(
      variantInputSelection
    ),
    actionScheduling:
      normalizeWorkbenchActionSchedulingContract(actionScheduling),
    sourceEvidenceStatus: textOrNull(sourceEvidenceStatus),
    scenarioRuntimeStatus: textOrNull(scenarioRuntimeStatus),
    hitOverrides: normalizeActionHitOverrides(hitOverrides),
    ...(isSwitchAction
      ? {
          startFrame: msToFrame(normalizedStartMs),
          endFrame: msToFrame(normalizedStartMs),
          durationFrames: 0,
        }
      : hasTimingContract
        ? {
            durationFrames: positiveIntegerOrNull(durationFrames),
            timingSource: textOrNull(timingSource),
            timingStatus: textOrNull(timingStatus),
            timingReasons: normalizedTimingReasons,
            timingSourceIdentity: textOrNull(timingSourceIdentity),
            needsTimingData: Boolean(needsTimingData),
          }
        : {}),
    ...(type === ACTION_TYPES.KIBO_EVENT
      ? {
          kiboId: positiveIntegerOrNull(kiboId),
          name: String(name ?? '').trim(),
          icon: String(icon ?? '').trim() || null,
          timingSource: textOrNull(timingSource),
          needsTimingData:
            needsTimingData == null ? true : Boolean(needsTimingData),
        }
      : {}),
    note,
    insertion: normalizeWorkbenchInsertion(insertion),
    generationBatch: normalizeWorkbenchGenerationBatch(generationBatch),
    ...normalizeAttackInputActionFields({ id: actionId, ...attackInputFields }),
    ...(statusGeneration
      ? { statusGeneration: statusGeneration.descriptor }
      : kiboStatusGeneration
        ? { statusGeneration: kiboStatusGeneration }
        : {}),
    effectCommands: normalizeWorkbenchEffectCommands(
      resolvedEffectCommands,
      actionId
    ),
  };
}

export function normalizeWorkbenchEffectCommands(
  effectCommands = [],
  actionId = DEFAULT_WORKBENCH_ACTION_ID
) {
  const commandIds = new Set();
  return (Array.isArray(effectCommands) ? effectCommands : []).map(
    (command, index) => {
      const fallbackId = `${actionId}-effect-${String(index + 1).padStart(2, '0')}`;
      const requestedId = String(command?.id ?? '').trim();
      const id =
        requestedId && !commandIds.has(requestedId) ? requestedId : fallbackId;
      commandIds.add(id);
      return createEffectCommand({
        ...command,
        id,
        effectId:
          String(command?.effectId ?? '').trim() ||
          `${actionId}-effect-${index + 1}`,
        effectName:
          String(command?.effectName ?? '').trim() || `状态效果 ${index + 1}`,
        operation: Object.values(EFFECT_OPERATIONS).includes(command?.operation)
          ? command.operation
          : EFFECT_OPERATIONS.APPLY,
        targetKind: Object.values(EFFECT_TARGET_KINDS).includes(
          command?.targetKind
        )
          ? command.targetKind
          : EFFECT_TARGET_KINDS.ACTOR,
        stackMode: Object.values(EFFECT_STACK_MODES).includes(
          command?.stackMode
        )
          ? command.stackMode
          : EFFECT_STACK_MODES.REFRESH,
      });
    }
  );
}

export function normalizeWorkbenchSelection(selection = {}, teamSlots = null) {
  const normalizedTeamSlots = normalizeWorkbenchTeamSlots(teamSlots, selection);
  const characterId = normalizedTeamSlots[0].characterId;
  const character =
    findById(workbenchSeed.gameData.characters, characterId) ??
    workbenchSeed.gameData.characters[0];
  const secondaryCharacter =
    findById(
      workbenchSeed.gameData.characters,
      normalizedTeamSlots[1].characterId
    ) ?? workbenchSeed.gameData.characters[1];
  const characterSkills = getSkillsForCharacter(character.id);
  const requestedSkill = findById(characterSkills, selection.skillId);
  const skill =
    requestedSkill ?? characterSkills[0] ?? workbenchSeed.gameData.skills[0];
  const enemy =
    findById(WORKBENCH_ENEMIES, selection.enemyId) ??
    findById(WORKBENCH_ENEMIES, DEFAULT_WORKBENCH_SELECTION.enemyId) ??
    WORKBENCH_ENEMIES[0];

  return {
    characterId: character.id,
    secondaryCharacterId: secondaryCharacter.id,
    skillId: skill.id,
    enemyId: enemy.id,
  };
}

export function createDefaultWorkbenchTeamSlots(selection = {}) {
  return normalizeWorkbenchTeamSlots([], {
    ...DEFAULT_WORKBENCH_SELECTION,
    ...selection,
  });
}

export function normalizeWorkbenchTeamSlots(teamSlots = [], selection = {}) {
  const sourceSlots = Array.isArray(teamSlots) ? teamSlots : [];
  const legacyCharacterIds = [
    selection?.characterId ?? DEFAULT_WORKBENCH_SELECTION.characterId,
    selection?.secondaryCharacterId ??
      DEFAULT_WORKBENCH_SELECTION.secondaryCharacterId,
    DEFAULT_TERTIARY_CHARACTER_ID,
  ];
  const usedCharacterIds = new Set();

  return DEFAULT_WORKBENCH_TEAM_SLOTS.map((defaultSlot, index) => {
    const sourceSlot =
      sourceSlots.find(slot => slot?.slotId === defaultSlot.slotId) ??
      sourceSlots[index];
    const requestedCharacterId = Number(
      sourceSlot?.characterId ?? legacyCharacterIds[index]
    );
    const requestedCharacter = findById(
      workbenchSeed.gameData.characters,
      requestedCharacterId
    );
    const fallbackCharacter = workbenchSeed.gameData.characters.find(
      character => !usedCharacterIds.has(Number(character.id))
    );
    const character =
      requestedCharacter && !usedCharacterIds.has(Number(requestedCharacter.id))
        ? requestedCharacter
        : fallbackCharacter;

    usedCharacterIds.add(Number(character.id));
    return {
      slotId: defaultSlot.slotId,
      position: index,
      characterId: Number(character.id),
    };
  });
}

export function createDefaultWorkbenchActorConfigs(selection = {}) {
  return normalizeWorkbenchActorConfigs([], selection);
}

export function normalizeWorkbenchActorConfigs(
  actorConfigs = [],
  selection = DEFAULT_WORKBENCH_SELECTION,
  teamSlots = null
) {
  const sourceConfigs = Array.isArray(actorConfigs)
    ? actorConfigs
    : Object.values(actorConfigs ?? {});
  const inferredTeamSlots = sourceConfigs
    .slice(0, WORKBENCH_TEAM_SLOT_COUNT)
    .map((config, index) => ({
      slotId: DEFAULT_WORKBENCH_TEAM_SLOTS[index]?.slotId,
      position: index,
      characterId: config?.characterId,
    }));
  const normalizedTeamSlots = normalizeWorkbenchTeamSlots(
    teamSlots ?? inferredTeamSlots,
    selection
  );

  return normalizedTeamSlots.map(({ characterId }) => {
    const source = sourceConfigs.find(
      item => Number(item?.characterId) === Number(characterId)
    );
    return normalizeWorkbenchActorConfig(source, characterId);
  });
}

export function normalizeWorkbenchActorConfig(
  actorConfig = {},
  characterId = actorConfig?.characterId
) {
  const normalizedCharacterId = Number(characterId);
  const character = findById(
    workbenchSeed.gameData.characters,
    normalizedCharacterId
  );
  const attributeLevel = Number(character?.attributePanel?.level);

  return {
    characterId: normalizedCharacterId,
    level: clampNumber(
      actorConfig?.level ?? attributeLevel,
      1,
      100,
      DEFAULT_WORKBENCH_ACTOR_LEVEL
    ),
    initialSp: normalizeWorkbenchInitialSp(actorConfig?.initialSp, character),
    loadout: normalizeWorkbenchLoadout(actorConfig?.loadout),
    cultivation: normalizeWorkbenchCultivation(actorConfig?.cultivation),
  };
}

export function normalizeWorkbenchLoadout(loadout = {}) {
  const source = loadout ?? {};
  const equipment = source.equipment ?? {};

  return {
    kiboId: normalizeCatalogId(source.kiboId, WORKBENCH_KIBOS),
    equipment: Object.fromEntries(
      Object.keys(WORKBENCH_EQUIPMENT_SLOT_TYPES).map(slotKey => [
        slotKey,
        normalizeEquipmentId(equipment[slotKey], slotKey),
      ])
    ),
    soulessenceId: normalizeCatalogId(
      source.soulessenceId,
      WORKBENCH_SOULESSENCES
    ),
    soulessenceLevel: optionalClampedInteger(source.soulessenceLevel, 1, 100),
    soulessenceRank: optionalClampedInteger(source.soulessenceRank, 1, 6),
    equipmentLevels: Object.fromEntries(
      Object.keys(WORKBENCH_EQUIPMENT_SLOT_TYPES).map(slotKey => [
        slotKey,
        optionalClampedInteger(source.equipmentLevels?.[slotKey], 0, 9),
      ])
    ),
    kiboConfig: normalizeWorkbenchKiboConfig(source.kiboConfig),
  };
}

export function normalizeWorkbenchCultivation(cultivation = {}) {
  return {
    starGiftRank: clampNumber(cultivation?.starGiftRank, 0, 7, 0),
    favorabilityLevel: clampNumber(cultivation?.favorabilityLevel, 0, 10, 0),
  };
}

export function normalizeWorkbenchKiboConfig(config = {}) {
  const source = config ?? {};
  return {
    level: clampNumber(
      source.level,
      1,
      100,
      DEFAULT_WORKBENCH_KIBO_CONFIG.level
    ),
    hobbyId: clampNumber(
      source.hobbyId,
      1,
      Number.MAX_SAFE_INTEGER,
      DEFAULT_WORKBENCH_KIBO_CONFIG.hobbyId
    ),
    intimacyLevel: clampNumber(
      source.intimacyLevel,
      1,
      10,
      DEFAULT_WORKBENCH_KIBO_CONFIG.intimacyLevel
    ),
    comprehensionByAttribute: Object.fromEntries(
      Object.keys(DEFAULT_WORKBENCH_KIBO_CONFIG.comprehensionByAttribute).map(
        attributeId => [
          attributeId,
          clampNumber(
            source.comprehensionByAttribute?.[attributeId],
            75,
            170,
            DEFAULT_WORKBENCH_KIBO_CONFIG.comprehensionByAttribute[attributeId]
          ),
        ]
      )
    ),
  };
}

export function createWorkbenchProject(selection = {}, actionPatch = {}) {
  const teamSlots = normalizeWorkbenchTeamSlots(
    actionPatch.teamSlots,
    selection
  );
  const normalized = normalizeWorkbenchSelection(selection, teamSlots);
  const enemyConfig = normalizeWorkbenchEnemyConfig(
    actionPatch.enemyConfig ?? actionPatch
  );
  const actorConfigs = normalizeWorkbenchActorConfigs(
    actionPatch.actorConfigs,
    normalized,
    teamSlots
  );
  const actorConfigsByCharacterId = new Map(
    actorConfigs.map(config => [Number(config.characterId), config])
  );
  const character = findById(
    workbenchSeed.gameData.characters,
    normalized.characterId
  );
  const secondaryCharacter = findById(
    workbenchSeed.gameData.characters,
    normalized.secondaryCharacterId
  );
  const enemy = findById(WORKBENCH_ENEMIES, normalized.enemyId);
  const actionDrafts = normalizeWorkbenchActionDrafts(
    actionPatch.actions ?? [actionPatch],
    normalized,
    teamSlots
  );
  const actionRelations = normalizeWorkbenchActionRelations(
    actionPatch.actionRelations,
    actionDrafts
  );
  const durationMs = actionPatch.durationMs ?? DEFAULT_WORKBENCH_DURATION_MS;
  const cycleBoundaries = normalizeWorkbenchCycleBoundaries(
    actionPatch.cycleBoundaries,
    durationMs
  );
  const configurationSelection = createProjectConfigurationSelection(
    actionPatch.configurationSelection,
    actorConfigs,
    normalized.enemyId
  );
  const configurationSourceContract =
    createWorkbenchConfigurationSourceContract({
      configurationLibrary: normalizeProjectConfigurationLibraryForSource(
        actionPatch.configurationLibrary
      ),
      configurationSelection,
      actorConfigs,
      enemyConfig,
      enemyId: normalized.enemyId,
    });
  const gameDataBinding = normalizeWorkbenchGameDataBinding(
    actionPatch.gameDataBinding
  );
  const gameDataReferenceContract = createWorkbenchGameDataReferenceContract({
    gameDataBinding,
    selection: normalized,
    teamSlots,
    actorConfigs,
    enemyConfig,
    actionDrafts,
    configurationLibrary: actionPatch.configurationLibrary,
  });
  const timelineTopology = createWorkbenchTimelineTopology({
    teamSlots,
    actorConfigs,
    kibos: WORKBENCH_KIBOS,
    enemyId: normalized.enemyId,
  });

  if (!character || !secondaryCharacter || !enemy) {
    throw new Error(
      'Workbench seed cannot resolve selected character, skill, or enemy'
    );
  }

  const skillDrafts = actionDrafts.filter(
    draft => draft.type === ACTION_TYPES.SKILL
  );
  const teamCharacters = teamSlots.map(slot =>
    findById(workbenchSeed.gameData.characters, slot.characterId)
  );
  const actors = teamCharacters.map(item => {
    const actorConfig = actorConfigsByCharacterId.get(Number(item.id));
    return createActorFromCharacter(item, {
      actorId: `actor-${item.id}`,
      level: actorConfig?.level ?? DEFAULT_WORKBENCH_ACTOR_LEVEL,
      initialSp: actorConfig?.initialSp ?? null,
      skillLevels: createSkillLevelsForCharacter(skillDrafts, item.id),
      loadout: actorConfig?.loadout,
      cultivation: actorConfig?.cultivation,
    });
  });
  const actorsByCharacterId = new Map(
    actors.map(actor => [Number(actor.characterId), actor])
  );
  const enemyInstance = createEnemyFromData(enemy, {
    enemyInstanceId: `enemy-${enemy.id}`,
    level: enemyConfig.level,
    hpMultiplier: enemyConfig.hpMultiplier,
    defenseMultiplier: enemyConfig.defenseMultiplier,
    toughnessMultiplier: enemyConfig.toughnessMultiplier,
    initialToughnessRatio: enemyConfig.initialToughnessRatio,
    elementDefenseOverrides: enemyConfig.elementDefenseOverrides,
  });
  const titleAction = actionDrafts[0];
  const firstSkill = titleAction
    ? findById(workbenchSeed.gameData.skills, titleAction.skillId)
    : null;
  const titleActionName = !titleAction
    ? '空方案'
    : titleAction.type === ACTION_TYPES.SKILL
      ? firstSkill.name
      : actionTypeLabel(titleAction.type);

  return createProject({
    id: 'workbench-editable-slice',
    name: `工作台：${character.name} / ${titleActionName} / ${enemy.name}`,
    durationMs,
    actors,
    teamSlots,
    enemy: enemyInstance,
    actions: actionDrafts.map(draft =>
      createProjectActionFromDraft(
        draft,
        actorsByCharacterId,
        character.id,
        enemyInstance.id
      )
    ),
    actionRelations,
    cycleBoundaries,
    initialRuntimeState: normalizeInitialRuntimeState(
      actionPatch.initialRuntimeState,
      {
        controlledActor: {
          actorId: actors[0].id,
          characterId: actors[0].characterId,
          actorName: actors[0].name,
        },
      }
    ),
    combatScenario: normalizeCombatScenario(actionPatch.combatScenario),
    metadata: {
      fixture: false,
      fixturePurpose: 'stage-4-editable-workbench',
      sourceCharacterId: character.id,
      secondaryCharacterId: secondaryCharacter.id,
      sourceSkillIds: skillDrafts.map(draft => draft.skillId),
      sourceEnemyId: enemy.id,
      teamSlots,
      timelineTopology,
      enemyConfig,
      actorConfigs,
      configurationSelection,
      configurationSourceContract,
      gameDataBinding,
      gameDataReferenceContract,
      gameDataCompatibilityReport:
        actionPatch.gameDataCompatibilityReport ?? null,
      mechanicsProfileSelection: normalizeWorkbenchMechanicsProfileSelection(
        actionPatch.mechanicsProfileSelection
      ),
      mechanicsProfileCompatibilityReport:
        actionPatch.mechanicsProfileCompatibilityReport ?? null,
      runtimeSampleCaptures: normalizeWorkbenchRuntimeSampleCaptures(
        actionPatch.runtimeSampleCaptures
      ),
      loadoutCalculationStatus:
        'verified-static-properties-applied-dynamic-effects-unapplied',
    },
  });
}

function normalizeProjectConfigurationLibraryForSource(library = {}) {
  return {
    actorInstances: (library?.actorInstances ?? []).map(instance => ({
      ...instance,
      actorConfig: normalizeWorkbenchActorConfig(
        instance?.actorConfig ?? instance?.config,
        instance?.characterId
      ),
    })),
    enemyInstances: (library?.enemyInstances ?? []).map(instance => ({
      ...instance,
      enemyConfig: normalizeWorkbenchEnemyConfig(
        instance?.enemyConfig ?? instance?.config
      ),
    })),
  };
}

function createProjectConfigurationSelection(selection, actorConfigs, enemyId) {
  const actorSelections = new Map(
    (selection?.actorInstanceIds ?? []).map(item => [
      Number(item.characterId),
      String(item.instanceId ?? '').trim(),
    ])
  );
  return {
    schemaVersion: 1,
    actorInstanceIds: actorConfigs
      .map(config => ({
        characterId: Number(config.characterId),
        instanceId: actorSelections.get(Number(config.characterId)) ?? '',
      }))
      .filter(item => item.instanceId),
    enemyId: Number(enemyId),
    enemyInstanceId: String(selection?.enemyInstanceId ?? '').trim() || null,
  };
}

export function normalizeWorkbenchEnemyConfig(config = {}) {
  const source = config ?? {};
  return {
    level: clampNumber(
      source.level ?? source.enemyLevel,
      1,
      200,
      DEFAULT_WORKBENCH_ENEMY_CONFIG.level
    ),
    hpMultiplier: clampNumber(
      source.hpMultiplier ?? DEFAULT_WORKBENCH_ENEMY_CONFIG.hpMultiplier,
      0.1,
      100,
      DEFAULT_WORKBENCH_ENEMY_CONFIG.hpMultiplier
    ),
    defenseMultiplier: clampNumber(
      source.defenseMultiplier ??
        DEFAULT_WORKBENCH_ENEMY_CONFIG.defenseMultiplier,
      0.1,
      100,
      DEFAULT_WORKBENCH_ENEMY_CONFIG.defenseMultiplier
    ),
    toughnessMultiplier: clampNumber(
      source.toughnessMultiplier ??
        DEFAULT_WORKBENCH_ENEMY_CONFIG.toughnessMultiplier,
      0.1,
      100,
      DEFAULT_WORKBENCH_ENEMY_CONFIG.toughnessMultiplier
    ),
    initialToughnessRatio: clampNumber(
      source.initialToughnessRatio ??
        DEFAULT_WORKBENCH_ENEMY_CONFIG.initialToughnessRatio,
      0,
      1,
      DEFAULT_WORKBENCH_ENEMY_CONFIG.initialToughnessRatio
    ),
    elementDefenseOverrides: normalizeElementDefenseOverrides(
      source.elementDefenseOverrides
    ),
  };
}

function normalizeElementDefenseOverrides(overrides) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(overrides)
      .filter(
        ([key, value]) =>
          WORKBENCH_ENEMY_ELEMENT_DEFENSE_KEYS.has(key) &&
          Number.isFinite(value)
      )
      .map(([key, value]) => [key, Number(value)])
  );
}

export function normalizeWorkbenchActionDrafts(
  actionDrafts = [],
  selectionOrCharacterId = DEFAULT_WORKBENCH_SELECTION.characterId,
  teamSlots = null
) {
  const selection =
    typeof selectionOrCharacterId === 'object'
      ? normalizeWorkbenchSelection(selectionOrCharacterId)
      : normalizeWorkbenchSelection({ characterId: selectionOrCharacterId });
  const primarySkills = getSkillsForCharacter(selection.characterId);
  const primaryFallbackSkill =
    primarySkills[0] ?? workbenchSeed.gameData.skills[0];

  return actionDrafts
    .map((draft, index) => {
      const actorCharacterId = normalizeActorCharacterId(
        draft.actorCharacterId,
        selection,
        teamSlots
      );
      const actorSkills = getSkillsForCharacter(actorCharacterId);
      const fallbackSkill = actorSkills[0] ?? primaryFallbackSkill;

      if (isNonSkillDraftType(draft.type)) {
        return createWorkbenchActionDraft({
          id: draft.id ?? `action-${String(index + 1).padStart(4, '0')}`,
          type: draft.type,
          skillId:
            draft.type === ACTION_TYPES.KIBO_EVENT
              ? (draft.skillId ?? null)
              : (draft.skillId ?? fallbackSkill.id),
          actorCharacterId,
          startMs: draft.startMs,
          durationMs: draft.durationMs,
          level: draft.level,
          damageSegmentIndex: draft.damageSegmentIndex,
          actionVariantIndex: draft.actionVariantIndex,
          targetCharacterId:
            draft.targetCharacterId ?? selection.secondaryCharacterId,
          resource: draft.resource,
          change: draft.change,
          reason: draft.reason,
          eventType: draft.eventType,
          kiboId: draft.kiboId,
          name: draft.name,
          icon: draft.icon,
          durationFrames: draft.durationFrames,
          timingSource: draft.timingSource,
          timingStatus: draft.timingStatus,
          timingReasons: draft.timingReasons,
          timingSourceIdentity: draft.timingSourceIdentity,
          needsTimingData: draft.needsTimingData,
          controlSubSkillIndex: draft.controlSubSkillIndex,
          variantInputSelection: draft.variantInputSelection,
          actionScheduling: draft.actionScheduling,
          sourceEvidenceStatus: draft.sourceEvidenceStatus,
          scenarioRuntimeStatus: draft.scenarioRuntimeStatus,
          hitOverrides: draft.hitOverrides,
          note: draft.note,
          insertion: draft.insertion,
          generationBatch: draft.generationBatch,
          effectCommands: draft.effectCommands,
          ...normalizeAttackInputActionFields(draft),
        });
      }

      const requestedSkill = findById(actorSkills, draft.skillId);
      const compatibleEntry = requestedSkill
        ? null
        : resolveCompatibleSkillActionEntry(draft, actorSkills);
      const skill =
        requestedSkill ??
        findById(actorSkills, compatibleEntry?.skillId) ??
        fallbackSkill;
      const actionVariantIndex = requestedSkill
        ? (draft.actionVariantIndex ?? draft.damageSegmentIndex)
        : (compatibleEntry?.actionVariantIndex ??
          draft.actionVariantIndex ??
          draft.damageSegmentIndex);
      return createWorkbenchActionDraft({
        id: draft.id ?? `action-${String(index + 1).padStart(4, '0')}`,
        type: ACTION_TYPES.SKILL,
        skillId: skill.id,
        actorCharacterId,
        startMs: draft.startMs,
        durationMs: draft.durationMs,
        level: clampLevel(draft.level, skill),
        actionVariantIndex: clampActionVariantIndex(
          actionVariantIndex,
          skill,
          draft.level
        ),
        targetCharacterId:
          draft.targetCharacterId ?? selection.secondaryCharacterId,
        resource: draft.resource,
        change: draft.change,
        reason: draft.reason,
        eventType: draft.eventType,
        durationFrames: draft.durationFrames,
        timingSource: draft.timingSource,
        timingStatus: draft.timingStatus,
        timingReasons: draft.timingReasons,
        timingSourceIdentity: draft.timingSourceIdentity,
        needsTimingData: draft.needsTimingData,
        controlSubSkillIndex: draft.controlSubSkillIndex,
        variantInputSelection: draft.variantInputSelection,
        actionScheduling: draft.actionScheduling,
        sourceEvidenceStatus: draft.sourceEvidenceStatus,
        scenarioRuntimeStatus: draft.scenarioRuntimeStatus,
        hitOverrides: draft.hitOverrides,
        note: draft.note,
        insertion: draft.insertion,
        generationBatch: draft.generationBatch,
        effectCommands: draft.effectCommands,
        ...normalizeAttackInputActionFields(draft),
      });
    })
    .filter(
      draft =>
        draft.type !== ACTION_TYPES.SKILL ||
        findById(workbenchSeed.gameData.skills, draft.skillId)
    );
}

function resolveCompatibleSkillActionEntry(draft, actorSkills) {
  const sourceSkill = findById(workbenchSeed.gameData.skills, draft.skillId);
  if (!sourceSkill) return null;
  const sourceVariantIndex = Math.max(
    0,
    Number(draft.actionVariantIndex ?? draft.damageSegmentIndex) || 0
  );
  const sourceEntry = getSkillActionCatalog(
    [sourceSkill],
    Math.max(1, Number(draft.level) || 1)
  ).find(entry => entry.actionVariantIndex === sourceVariantIndex);
  if (!sourceEntry?.kind) return null;
  return (
    getSkillActionCatalog(actorSkills, 1).find(
      entry => entry.kind === sourceEntry.kind
    ) ?? null
  );
}

function createProjectActionFromDraft(
  draft,
  actorsByCharacterId,
  primaryCharacterId,
  targetId
) {
  const primaryActor =
    actorsByCharacterId.get(Number(primaryCharacterId)) ??
    [...actorsByCharacterId.values()][0];
  const sourceActor = resolveActorFromDraft(
    draft,
    actorsByCharacterId,
    primaryActor
  );
  const effectCommands = resolveWorkbenchEffectCommandsForProject({
    effectCommands: draft.effectCommands,
    actorsByCharacterId,
    sourceActor,
    enemyId: targetId,
  });

  if (draft.type === ACTION_TYPES.SWITCH) {
    const targetActor = resolveSwitchTargetActor(
      draft,
      actorsByCharacterId,
      sourceActor
    );
    return createSwitchAction({
      id: draft.id,
      actorId: sourceActor.id,
      targetActorId: targetActor.id,
      targetCharacterId: targetActor.characterId,
      startMs: draft.startMs,
      hitOverrides: draft.hitOverrides,
      note: draft.note || `切换至 ${targetActor.name}`,
      insertion: draft.insertion,
    });
  }

  if (draft.type === ACTION_TYPES.WAIT) {
    return createWaitAction({
      id: draft.id,
      startMs: draft.startMs,
      durationMs: draft.durationMs,
      note: draft.note || '等待窗口',
      insertion: draft.insertion,
      effectCommands,
    });
  }

  if (draft.type === ACTION_TYPES.ANNOTATION) {
    return createAnnotationAction({
      id: draft.id,
      startMs: draft.startMs,
      note: draft.note || '备注',
      insertion: draft.insertion,
      effectCommands,
    });
  }

  if (draft.type === ACTION_TYPES.RESOURCE) {
    return createResourceAction({
      id: draft.id,
      actorId: sourceActor.id,
      startMs: draft.startMs,
      resource: draft.resource || 'sp',
      change: draft.change,
      reason: draft.reason || 'manual-axis-resource',
      note: draft.note,
      insertion: draft.insertion,
      effectCommands,
    });
  }

  if (draft.type === ACTION_TYPES.ENEMY_EVENT) {
    return createEnemyEventAction({
      id: draft.id,
      targetId,
      startMs: draft.startMs,
      eventType: draft.eventType || 'phase',
      note: draft.note || '敌人阶段标记',
      insertion: draft.insertion,
      effectCommands,
    });
  }

  if (draft.type === ACTION_TYPES.KIBO_EVENT) {
    const kiboId = positiveIntegerOrNull(sourceActor?.loadout?.kiboId);
    const kibo = findById(WORKBENCH_KIBOS, kiboId);
    return createKiboEventAction({
      id: draft.id,
      actorId: sourceActor.id,
      kiboId,
      skillId: draft.skillId,
      icon: draft.icon,
      name: draft.name || `${kibo?.name ?? '奇波'}事件`,
      startMs: draft.startMs,
      durationMs: draft.durationMs,
      eventType: draft.eventType ?? 'activation',
      durationFrames: draft.durationFrames,
      timingSource: draft.timingSource,
      timingStatus: draft.timingStatus,
      timingReasons: draft.timingReasons,
      timingSourceIdentity: draft.timingSourceIdentity,
      needsTimingData: draft.needsTimingData,
      controlSubSkillIndex: draft.controlSubSkillIndex,
      variantInputSelection: draft.variantInputSelection,
      actionScheduling: draft.actionScheduling,
      sourceEvidenceStatus: draft.sourceEvidenceStatus,
      scenarioRuntimeStatus: draft.scenarioRuntimeStatus,
      hitOverrides: draft.hitOverrides,
      note: draft.note || '奇波事件标记',
      insertion: draft.insertion,
      effectCommands,
    });
  }

  const skill = findById(workbenchSeed.gameData.skills, draft.skillId);
  const actor =
    sourceActor ??
    actorsByCharacterId.get(Number(skill.characterId)) ??
    primaryActor;
  return createSkillAction({
    id: draft.id,
    actorId: actor.id,
    skill,
    targetId,
    startMs: draft.startMs,
    durationMs: draft.durationMs,
    durationFrames: draft.durationFrames,
    timingSource: draft.timingSource,
    timingStatus: draft.timingStatus,
    timingReasons: draft.timingReasons,
    timingSourceIdentity: draft.timingSourceIdentity,
    needsTimingData: draft.needsTimingData,
    controlSubSkillIndex: draft.controlSubSkillIndex,
    variantInputSelection: draft.variantInputSelection,
    actionScheduling: draft.actionScheduling,
    sourceEvidenceStatus: draft.sourceEvidenceStatus,
    scenarioRuntimeStatus: draft.scenarioRuntimeStatus,
    hitOverrides: draft.hitOverrides,
    level: draft.level,
    actionVariantIndex: draft.actionVariantIndex ?? draft.damageSegmentIndex,
    damageSegmentIndex: draft.actionVariantIndex ?? draft.damageSegmentIndex,
    note:
      draft.note || '工作台可编辑动作；精确命中帧等待 asset 或运行时捕获补充。',
    insertion: draft.insertion,
    generationBatch: draft.generationBatch,
    attackInputFields: draft,
    effectCommands,
  });
}

function resolveWorkbenchEffectCommandsForProject({
  effectCommands,
  actorsByCharacterId,
  sourceActor,
  enemyId,
}) {
  const actorIds = new Set(
    [...actorsByCharacterId.values()].map(actor => String(actor.id))
  );
  return normalizeWorkbenchEffectCommands(effectCommands).map(command => ({
    ...command,
    targetId:
      command.targetKind === EFFECT_TARGET_KINDS.ENEMY
        ? String(enemyId)
        : actorIds.has(String(command.targetId ?? ''))
          ? String(command.targetId)
          : (sourceActor?.id ?? null),
    appliedToCalculators: false,
  }));
}

function actionTypeLabel(type) {
  if (type === ACTION_TYPES.WAIT) {
    return '等待';
  }
  if (type === ACTION_TYPES.ANNOTATION) {
    return '注释';
  }
  if (type === ACTION_TYPES.RESOURCE) {
    return '资源事件';
  }
  if (type === ACTION_TYPES.ENEMY_EVENT) {
    return '敌人事件';
  }
  if (type === ACTION_TYPES.KIBO_EVENT) {
    return '奇波事件';
  }
  if (type === ACTION_TYPES.SWITCH) {
    return '切人';
  }
  return '动作';
}

function isNonSkillDraftType(type) {
  return [
    ACTION_TYPES.WAIT,
    ACTION_TYPES.SWITCH,
    ACTION_TYPES.ANNOTATION,
    ACTION_TYPES.RESOURCE,
    ACTION_TYPES.KIBO_EVENT,
    ACTION_TYPES.ENEMY_EVENT,
  ].includes(type);
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function textOrNull(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalizeTextArray(values) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map(value => textOrNull(value))
        .filter(Boolean)
    ),
  ];
}

function normalizeActorCharacterId(actorCharacterId, selection, teamSlots) {
  const id = Number(actorCharacterId);
  const teamCharacterIds = new Set(
    normalizeWorkbenchTeamSlots(teamSlots, selection).map(slot =>
      Number(slot.characterId)
    )
  );
  if (teamCharacterIds.has(id)) {
    return id;
  }
  return selection.characterId;
}

function resolveActorFromDraft(draft, actorsByCharacterId, fallbackActor) {
  return (
    actorsByCharacterId.get(Number(draft.actorCharacterId)) ?? fallbackActor
  );
}

function resolveSwitchTargetActor(draft, actorsByCharacterId, sourceActor) {
  const requestedTarget = actorsByCharacterId.get(
    Number(draft.targetCharacterId)
  );
  if (requestedTarget && requestedTarget.id !== sourceActor.id) {
    return requestedTarget;
  }

  return (
    [...actorsByCharacterId.values()].find(
      actor => actor.id !== sourceActor.id
    ) ?? sourceActor
  );
}

function clampLevel(level, skill) {
  const maxLevel = Math.max(1, skill?.level?.values?.length ?? 1);
  return Math.min(maxLevel, Math.max(1, Number(level) || 1));
}

function clampDamageSegmentIndex(damageSegmentIndex, skill, level) {
  return clampActionVariantIndex(damageSegmentIndex, skill, level);
}

function clampActionVariantIndex(actionVariantIndex, skill, level) {
  const segmentCount = Math.max(1, getSkillActionVariants(skill, level).length);
  return Math.min(
    segmentCount - 1,
    Math.max(0, Number(actionVariantIndex) || 0)
  );
}

function normalizeWorkbenchInsertion(insertion) {
  if (!insertion || typeof insertion !== 'object') {
    return null;
  }

  return {
    autoDelayed: Boolean(insertion.autoDelayed),
    requestedStartMs: Math.max(0, Number(insertion.requestedStartMs) || 0),
    resolvedStartMs: Math.max(0, Number(insertion.resolvedStartMs) || 0),
    delayedByMs: Math.max(0, Number(insertion.delayedByMs) || 0),
    laneId: insertion.laneId ? String(insertion.laneId) : '',
    reason: insertion.reason ? String(insertion.reason) : '',
    conflictActionIds: Array.isArray(insertion.conflictActionIds)
      ? insertion.conflictActionIds.map(id => String(id))
      : [],
  };
}

function normalizeWorkbenchGenerationBatch(generationBatch) {
  if (!generationBatch || typeof generationBatch !== 'object') {
    return null;
  }

  const batchId = generationBatch.batchId
    ? String(generationBatch.batchId)
    : '';
  if (!batchId) {
    return null;
  }

  return {
    batchId,
    source: generationBatch.source
      ? String(generationBatch.source)
      : 'skill-action-variant-split',
    skillId: Number(generationBatch.skillId) || null,
    actorCharacterId: Number(generationBatch.actorCharacterId) || null,
    level: Math.max(1, Number(generationBatch.level) || 1),
    variantCount: Math.max(
      1,
      Number(generationBatch.variantCount ?? generationBatch.segmentCount) || 1
    ),
    segmentCount: Math.max(
      1,
      Number(generationBatch.variantCount ?? generationBatch.segmentCount) || 1
    ),
    createdAt: generationBatch.createdAt
      ? String(generationBatch.createdAt)
      : null,
  };
}

function createSkillLevelsForCharacter(skillDrafts, characterId) {
  return Object.fromEntries(
    skillDrafts
      .map(draft => [
        findById(workbenchSeed.gameData.skills, draft.skillId),
        draft.level,
      ])
      .filter(([skill]) => skill?.characterId === Number(characterId))
      .map(([skill, level]) => [skill.id, level])
  );
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

function optionalClampedInteger(value, min, max) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) ? Math.min(max, Math.max(min, number)) : null;
}

function nonNegativeIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function normalizeCatalogId(value, catalog) {
  const id = Number(value);
  if (!Number.isFinite(id)) {
    return null;
  }
  return catalog.some(item => Number(item.id) === id) ? id : null;
}

function normalizeWorkbenchInitialSp(value, character) {
  if (value == null || value === '') {
    return null;
  }
  const initialSp = Number(value);
  if (!Number.isFinite(initialSp)) {
    return null;
  }
  const maxSp = resolveActorEffectiveMaxSp(character);
  const normalized = Number.isFinite(maxSp)
    ? Math.min(maxSp, Math.max(0, initialSp))
    : Math.max(0, initialSp);
  return Number(normalized.toFixed(6));
}

function normalizeEquipmentId(value, slotKey) {
  const expectedType = WORKBENCH_EQUIPMENT_SLOT_TYPES[slotKey];
  const id = Number(value);
  if (!Number.isFinite(id) || !expectedType) {
    return null;
  }
  return WORKBENCH_EQUIPMENT.some(
    item => Number(item.id) === id && item.type === expectedType
  )
    ? id
    : null;
}

function findById(items, id) {
  return items.find(item => item.id === Number(id)) ?? null;
}
