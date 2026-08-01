import { createSkillDamageModel } from './skillDamageSegments';
import { createSkillLogicModel } from './skillLogicModel';
import { normalizeInitialRuntimeState } from './initialRuntimeState';
import {
  inferCatalogActionKind,
  resolveVerifiedCatalogActionDeclaration,
} from './skillActionCatalog';
import {
  createKiboActionStatusGeneration,
  createSkillActionStatusGeneration,
  mergeGeneratedActionStatusEffectCommands,
} from './actionStatusGeneration';
import {
  applyActorSpResourceProfile,
  createActorSpResourceProfile,
} from './spUnitContract';
import { normalizeAttackInputActionFields } from './workbenchAttackInputChain';
import { normalizeActionHitOverrides } from './actionHitOverrides';
import { normalizeActionVariantInputSelection } from './actionVariantInputSelection';
import { normalizeCombatScenario } from './combatScenario';
import { normalizeWorkbenchActionSchedulingContract } from './workbenchActionScheduling';
import { msToFrame, snapMsToFrame } from './timebase';

export const PROJECT_SCHEMA_VERSION = 1;
export const PROJECT_TIME_UNIT = 'ms';

export const ACTION_TYPES = Object.freeze({
  SKILL: 'skill',
  SWITCH: 'switch',
  WAIT: 'wait',
  KIBO_EVENT: 'kiboEvent',
  ENEMY_EVENT: 'enemyEvent',
  RESOURCE: 'resource',
  ANNOTATION: 'annotation',
});

export const ACTION_RELATION_KINDS = Object.freeze({
  SEQUENCE: 'sequence',
  SIMULTANEOUS: 'simultaneous',
});

export const ACTION_RELATION_ANCHORS = Object.freeze({
  SOURCE_START: 'start',
  SOURCE_END: 'end',
  TARGET_START: 'start',
});

export const EFFECT_OPERATIONS = Object.freeze({
  APPLY: 'apply',
  REFRESH: 'refresh',
  REMOVE: 'remove',
});

export const EFFECT_TARGET_KINDS = Object.freeze({
  ACTOR: 'actor',
  KIBO: 'kibo',
  ENEMY: 'enemy',
});

export const EFFECT_STACK_MODES = Object.freeze({
  REFRESH: 'refresh',
  STACK: 'stack',
  REPLACE: 'replace',
});

export const ENEMY_ELEMENT_DEFENSE_DEFINITIONS = Object.freeze([
  { elementId: 0, attributeKey: 'NORMAL_DEFENSE', fallbackName: '无属性' },
  { elementId: 1, attributeKey: 'FIRE_DEFENSE', fallbackName: '火属性' },
  { elementId: 2, attributeKey: 'WIND_DEFENSE', fallbackName: '风属性' },
  { elementId: 3, attributeKey: 'EARTH_DEFENSE', fallbackName: '地属性' },
  { elementId: 4, attributeKey: 'WOOD_DEFENSE', fallbackName: '木属性' },
  { elementId: 5, attributeKey: 'ICE_DEFENSE', fallbackName: '冰属性' },
  { elementId: 6, attributeKey: 'WATER_DEFENSE', fallbackName: '水属性' },
  { elementId: 7, attributeKey: 'ELEC_DEFENSE', fallbackName: '雷属性' },
  { elementId: 8, attributeKey: 'LIGHT_DEFENSE', fallbackName: '光属性' },
  { elementId: 9, attributeKey: 'DARK_DEFENSE', fallbackName: '暗属性' },
]);
const ENEMY_ELEMENT_DEFENSE_KEYS = new Set(
  ENEMY_ELEMENT_DEFENSE_DEFINITIONS.map(item => item.attributeKey)
);

export const DEFAULT_PROJECT_DURATION_MS = 120000;
export const DEFAULT_PROJECT_FPS = 60;
const LOADOUT_EQUIPMENT_SLOT_TYPES = Object.freeze({
  weapon: '武器',
  top: '上装',
  bottom: '下装',
  earring: '耳环',
  ring: '戒指',
});

export function createProject({
  id,
  name = '未命名蓝色星原排轴',
  durationMs = DEFAULT_PROJECT_DURATION_MS,
  fps = DEFAULT_PROJECT_FPS,
  actors = [],
  teamSlots = [],
  enemy = null,
  actions = [],
  actionRelations = [],
  cycleBoundaries = [],
  initialRuntimeState = null,
  combatScenario = null,
  metadata = {},
} = {}) {
  const now = new Date().toISOString();

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    game: 'azur-promilia',
    id: id ?? createStableId('project'),
    name,
    time: {
      unit: PROJECT_TIME_UNIT,
      durationMs,
      fps,
    },
    actors,
    team: {
      slots: teamSlots.map(slot => ({ ...slot })),
    },
    enemy,
    actions,
    actionRelations: actionRelations.map(relation =>
      createActionRelation(relation)
    ),
    cycleBoundaries: cycleBoundaries.map(boundary =>
      createCycleBoundary(boundary)
    ),
    initialRuntimeState: normalizeInitialRuntimeState(initialRuntimeState),
    combatScenario: normalizeCombatScenario(combatScenario),
    resources: [],
    buffs: [],
    loadouts: actors.map(actor => actor.loadout).filter(Boolean),
    metadata: {
      createdAt: now,
      updatedAt: now,
      source: 'promilia-axis-tool-domain',
      ...metadata,
    },
  };
}

export function createCycleBoundary({ id, timeMs = 0 } = {}) {
  return {
    id: id ?? createStableId('cycle-boundary'),
    timeMs: Number(timeMs) || 0,
  };
}

export function createActionRelation({
  id,
  kind = ACTION_RELATION_KINDS.SEQUENCE,
  fromActionId,
  toActionId,
  sourceAnchor = ACTION_RELATION_ANCHORS.SOURCE_END,
  targetAnchor = ACTION_RELATION_ANCHORS.TARGET_START,
  gapMs = 0,
} = {}) {
  return {
    id: id ?? createStableId('action-relation'),
    kind,
    fromActionId: String(fromActionId ?? '').trim(),
    toActionId: String(toActionId ?? '').trim(),
    sourceAnchor,
    targetAnchor,
    gapMs: Number(gapMs) || 0,
  };
}

export function createActorFromCharacter(character, options = {}) {
  if (!character) {
    throw new Error('createActorFromCharacter requires a character');
  }

  const actorId = options.actorId ?? `actor-${character.id}`;
  const spResourceProfile = createActorSpResourceProfile(
    character.property?.baseAttributes
  );

  return {
    id: actorId,
    characterId: character.id,
    name: character.name,
    level: options.level ?? 80,
    elementId: character.element?.id ?? null,
    role: character.position?.name ?? null,
    propertyId: character.property?.id ?? null,
    baseAttributes: applyActorSpResourceProfile(
      character.property?.baseAttributes,
      spResourceProfile
    ),
    spResourceProfile,
    attributePanel: character.attributePanel ?? null,
    initialSp:
      options.initialSp == null || options.initialSp === ''
        ? null
        : Number(options.initialSp),
    skillLevels: options.skillLevels ?? {},
    cultivation: {
      ...(options.cultivation ?? {}),
    },
    loadout: createLoadout({
      actorId,
      characterId: character.id,
      ...options.loadout,
    }),
  };
}

export function createEnemyFromData(enemy, options = {}) {
  if (!enemy) {
    throw new Error('createEnemyFromData requires an enemy');
  }

  return {
    id: options.enemyInstanceId ?? `enemy-${enemy.id}`,
    enemyId: enemy.id,
    name: enemy.name,
    icon: enemy.icon ?? null,
    level: options.level ?? 80,
    elementIds: enemy.elementIds ?? [],
    propertyId: enemy.property?.id ?? null,
    baseAttributes: enemy.property?.baseAttributes ?? [],
    hpMultiplier: options.hpMultiplier ?? 1,
    defenseMultiplier: options.defenseMultiplier ?? 1,
    toughnessMultiplier: options.toughnessMultiplier ?? 1,
    initialToughnessRatio: options.initialToughnessRatio ?? 1,
    elementDefenseOverrides: { ...(options.elementDefenseOverrides ?? {}) },
  };
}

export function createLoadout({
  actorId,
  characterId,
  kiboId = null,
  equipment = {},
  soulessenceId = null,
  soulessenceLevel = null,
  soulessenceRank = null,
  soulessenceStar = null,
  soulessenceCultivation = null,
  equipmentLevels = {},
  equipmentCultivation = {},
  kiboConfig = {},
} = {}) {
  return {
    actorId,
    characterId,
    kiboId,
    equipment: {
      weapon: equipment.weapon ?? null,
      top: equipment.top ?? null,
      bottom: equipment.bottom ?? null,
      earring: equipment.earring ?? null,
      ring: equipment.ring ?? null,
    },
    soulessenceId,
    soulessenceLevel,
    soulessenceRank,
    ...(soulessenceStar == null ? {} : { soulessenceStar }),
    ...(soulessenceCultivation == null
      ? {}
      : {
          soulessenceCultivation: structuredClone(
            soulessenceCultivation
          ),
        }),
    equipmentLevels: {
      weapon: equipmentLevels.weapon ?? null,
      top: equipmentLevels.top ?? null,
      bottom: equipmentLevels.bottom ?? null,
      earring: equipmentLevels.earring ?? null,
      ring: equipmentLevels.ring ?? null,
    },
    ...(Object.values(equipmentCultivation ?? {}).some(value => value != null)
      ? {
          equipmentCultivation: Object.fromEntries(
            ['weapon', 'top', 'bottom', 'earring', 'ring'].map(slot => [
              slot,
              equipmentCultivation[slot] == null
                ? null
                : structuredClone(equipmentCultivation[slot]),
            ])
          ),
        }
      : {}),
    kiboConfig: {
      ...kiboConfig,
      comprehensionByAttribute: {
        ...(kiboConfig.comprehensionByAttribute ?? {}),
      },
    },
  };
}

export function createSkillAction({
  id,
  actorId,
  skill,
  startMs = 0,
  targetId = null,
  level = 1,
  damageSegmentIndex = 0,
  actionVariantIndex = damageSegmentIndex,
  durationMs = null,
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
  attackInputFields = null,
  effectCommands = [],
}) {
  if (!skill) {
    throw new Error('createSkillAction requires a skill');
  }
  const damageModel = createSkillDamageModel(skill, level);
  const selectedActionVariant =
    damageModel.variants?.find(
      variant =>
        Number(variant.index) === Math.max(0, Number(actionVariantIndex) || 0)
    ) ??
    damageModel.variants?.find(
      variant =>
        Number(variant.index) === Math.max(0, Number(damageSegmentIndex) || 0)
    ) ??
    damageModel.variants?.[0] ??
    null;
  const actionId = id ?? createStableId('action');
  const logicModel = createSkillLogicModel(skill, level, { damageModel });
  const statusGeneration = createSkillActionStatusGeneration({
    actionId,
    skill,
    level,
    actionVariantIndex: selectedActionVariant?.index ?? actionVariantIndex,
    logicModel,
  });
  const resolvedEffectCommands = mergeGeneratedActionStatusEffectCommands(
    effectCommands,
    statusGeneration.effectCommands
  );
  const normalizedAttackInputFields = normalizeAttackInputActionFields({
    id: actionId,
    ...(attackInputFields ?? {}),
  });
  const verifiedCatalogDeclaration =
    resolveVerifiedCatalogActionDeclaration(selectedActionVariant, skill);

  return {
    id: actionId,
    type: ACTION_TYPES.SKILL,
    actorId,
    skillId: skill.id,
    icon: skill.icon ?? null,
    actionKind:
      verifiedCatalogDeclaration?.actionKind ??
      inferCatalogActionKind(selectedActionVariant, skill),
    name:
      normalizedAttackInputFields.attackSequenceIndex != null
        ? (normalizedAttackInputFields.attackInput?.semanticName ??
          normalizedAttackInputFields.attackInput?.label ??
          `A${normalizedAttackInputFields.attackSequenceIndex}`)
        : (verifiedCatalogDeclaration?.label ??
          selectedActionVariant?.displayLabel ??
          selectedActionVariant?.label ??
          skill.displayName ??
          skill.name ??
          `Skill ${skill.id}`),
    startMs,
    durationMs,
    targetId,
    level,
    actionVariantIndex: Math.max(0, Number(actionVariantIndex) || 0),
    damageSegmentIndex: Math.max(
      0,
      Number(actionVariantIndex ?? damageSegmentIndex) || 0
    ),
    controlSubSkillIndex: nonNegativeIntegerOrNull(controlSubSkillIndex),
    variantInputSelection: normalizeActionVariantInputSelection(
      variantInputSelection
    ),
    actionScheduling:
      normalizeWorkbenchActionSchedulingContract(actionScheduling),
    sourceEvidenceStatus: textOrNull(sourceEvidenceStatus),
    scenarioRuntimeStatus: textOrNull(scenarioRuntimeStatus),
    hitOverrides: normalizeActionHitOverrides(hitOverrides),
    cooldownMs: skill.cooldownMs,
    spCost: skill.spCost,
    elementId: skill.elementId,
    damageModel,
    logicModel,
    statusGeneration: statusGeneration.descriptor,
    timing: {
      needsTimingData:
        needsTimingData == null
          ? Boolean(skill.needsTimingData)
          : Boolean(needsTimingData),
      source: timingSource ?? skill.timingSource ?? 'unknown',
      status: timingStatus,
      reasons: normalizeTextArray(timingReasons),
      sourceIdentity: textOrNull(timingSourceIdentity),
      durationFrames: positiveIntegerOrNull(durationFrames),
      animationTimeMs: durationMs,
      damageTicks: [],
      cancelWindows: [],
    },
    note,
    insertion,
    generationBatch,
    ...normalizedAttackInputFields,
    ...createActionEffectCommandsField(resolvedEffectCommands),
  };
}

export function createSwitchAction({
  id,
  actorId,
  targetActorId,
  targetCharacterId = null,
  startMs = 0,
  hitOverrides = null,
  note = '',
  insertion = null,
} = {}) {
  const eventStartMs = snapMsToFrame(Math.max(0, Number(startMs) || 0));
  const eventFrame = msToFrame(eventStartMs);
  return {
    id: id ?? createStableId('action'),
    type: ACTION_TYPES.SWITCH,
    actorId,
    targetActorId,
    targetCharacterId,
    name: '切人',
    startMs: eventStartMs,
    startFrame: eventFrame,
    endFrame: eventFrame,
    durationMs: 0,
    durationFrames: 0,
    hitOverrides: normalizeActionHitOverrides(hitOverrides),
    note,
    insertion,
    ...createActionEffectCommandsField([]),
  };
}

export function createWaitAction({
  id,
  startMs = 0,
  durationMs = 1000,
  note = '等待',
  insertion = null,
  effectCommands = [],
} = {}) {
  return {
    id: id ?? createStableId('action'),
    type: ACTION_TYPES.WAIT,
    name: '等待',
    startMs,
    durationMs,
    note,
    insertion,
    ...createActionEffectCommandsField(effectCommands),
  };
}

export function createAnnotationAction({
  id,
  startMs = 0,
  note = '备注',
  insertion = null,
  effectCommands = [],
} = {}) {
  return {
    id: id ?? createStableId('action'),
    type: ACTION_TYPES.ANNOTATION,
    name: '注释',
    startMs,
    durationMs: 600,
    note,
    insertion,
    ...createActionEffectCommandsField(effectCommands),
  };
}

export function createResourceAction({
  id,
  actorId = null,
  startMs = 0,
  resource = 'sp',
  change = 50,
  reason = 'manual-axis-resource',
  note = '',
  insertion = null,
  effectCommands = [],
} = {}) {
  return {
    id: id ?? createStableId('action'),
    type: ACTION_TYPES.RESOURCE,
    actorId,
    name: '资源事件',
    startMs,
    durationMs: 600,
    resource,
    change: Number(change) || 0,
    reason,
    note,
    insertion,
    ...createActionEffectCommandsField(effectCommands),
  };
}

export function createEnemyEventAction({
  id,
  targetId = null,
  startMs = 0,
  eventType = 'phase',
  note = '敌人阶段标记',
  insertion = null,
  effectCommands = [],
} = {}) {
  return {
    id: id ?? createStableId('action'),
    type: ACTION_TYPES.ENEMY_EVENT,
    targetId,
    name: '敌人事件',
    startMs,
    durationMs: 600,
    eventType,
    note,
    insertion,
    ...createActionEffectCommandsField(effectCommands),
  };
}

export function createKiboEventAction({
  id,
  actorId = null,
  kiboId = null,
  skillId = null,
  icon = null,
  name = '奇波事件',
  startMs = 0,
  durationMs = 600,
  eventType = 'activation',
  durationFrames = null,
  timingSource = null,
  timingStatus = null,
  timingReasons = [],
  timingSourceIdentity = null,
  needsTimingData = true,
  controlSubSkillIndex = null,
  variantInputSelection = null,
  actionScheduling = null,
  sourceEvidenceStatus = null,
  scenarioRuntimeStatus = null,
  hitOverrides = null,
  note = '奇波事件标记',
  insertion = null,
  effectCommands = [],
} = {}) {
  const actionId = id ?? createStableId('action');
  return {
    id: actionId,
    type: ACTION_TYPES.KIBO_EVENT,
    actorId,
    kiboId,
    skillId:
      Number.isInteger(Number(skillId)) && Number(skillId) > 0
        ? Number(skillId)
        : null,
    icon: String(icon ?? '').trim() || null,
    name: String(name ?? '').trim() || '奇波事件',
    startMs,
    durationMs,
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
    ...(timingSource
      ? {
          timing: {
            needsTimingData: Boolean(needsTimingData),
            source: String(timingSource).trim(),
            status: textOrNull(timingStatus),
            reasons: normalizeTextArray(timingReasons),
            sourceIdentity: textOrNull(timingSourceIdentity),
            durationFrames: positiveIntegerOrNull(durationFrames),
            animationTimeMs: durationMs,
            damageTicks: [],
            cancelWindows: [],
          },
        }
      : {}),
    note,
    insertion,
    statusGeneration: createKiboActionStatusGeneration({
      actionId,
      kiboId,
      skillId,
      timingSource,
    }),
    appliedToCalculators: false,
    ...createActionEffectCommandsField(effectCommands),
  };
}

export function createEffectCommand({
  id,
  effectId,
  effectName = '',
  operation = EFFECT_OPERATIONS.APPLY,
  targetKind = EFFECT_TARGET_KINDS.ACTOR,
  targetId = null,
  offsetMs = 0,
  durationMs = null,
  stackMode = EFFECT_STACK_MODES.REFRESH,
  stackDelta = 1,
  maxStacks = 1,
  tags = [],
  sourceStatus = 'project-configured-effect-command',
  icon = null,
  confidence = null,
  trackingStatus = null,
  sourceIdentity = null,
  modifiers = [],
} = {}) {
  return {
    id: id ?? createStableId('effect-command'),
    effectId: String(effectId ?? '').trim(),
    effectName: String(effectName ?? '').trim(),
    operation,
    targetKind,
    targetId: targetId == null || targetId === '' ? null : String(targetId),
    offsetMs: Math.max(0, Number(offsetMs) || 0),
    durationMs:
      durationMs == null || durationMs === ''
        ? null
        : Math.max(0, Number(durationMs) || 0),
    stackMode,
    stackDelta: Math.max(1, Math.trunc(Number(stackDelta) || 1)),
    maxStacks: Math.max(1, Math.trunc(Number(maxStacks) || 1)),
    tags: Array.isArray(tags)
      ? [...new Set(tags.map(tag => String(tag).trim()).filter(Boolean))]
      : [],
    sourceStatus,
    ...(String(icon ?? '').trim() ? { icon: String(icon).trim() } : {}),
    ...(String(confidence ?? '').trim()
      ? { confidence: String(confidence).trim() }
      : {}),
    ...(String(trackingStatus ?? '').trim()
      ? { trackingStatus: String(trackingStatus).trim() }
      : {}),
    ...(sourceIdentity && typeof sourceIdentity === 'object'
      ? { sourceIdentity: cloneJsonObject(sourceIdentity) }
      : {}),
    modifiers: Array.isArray(modifiers)
      ? modifiers.map(item => ({ ...item }))
      : [],
    appliedToCalculators: false,
  };
}

function cloneJsonObject(value) {
  return JSON.parse(JSON.stringify(value));
}

function createActionEffectCommandsField(effectCommands) {
  if (!Array.isArray(effectCommands) || effectCommands.length === 0) {
    return {};
  }
  return {
    effectCommands: effectCommands.map(command => createEffectCommand(command)),
  };
}

export function validateProject(project, gameData = {}) {
  const errors = [];
  const warnings = [];

  if (!isObject(project)) {
    return {
      valid: false,
      errors: [issue('project.invalid', 'Project must be an object', '$')],
      warnings,
    };
  }

  if (project.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    errors.push(
      issue(
        'project.schemaVersion.unsupported',
        `Project schemaVersion must be ${PROJECT_SCHEMA_VERSION}`,
        '$.schemaVersion'
      )
    );
  }

  if (project.game !== 'azur-promilia') {
    errors.push(
      issue(
        'project.game.invalid',
        'Project game must be azur-promilia',
        '$.game'
      )
    );
  }

  validateTime(project.time, errors);
  validateUniqueIds(project.actors, '$.actors', errors);
  validateActors(project.actors, gameData, errors, warnings);
  validateTeam(project.team, project.actors, errors);
  validateEnemy(project.enemy, gameData, errors, warnings);
  validateActions(project.actions, project, gameData, errors, warnings);
  validateActionRelations(project.actionRelations, project.actions, errors);
  validateCycleBoundaries(project.cycleBoundaries, project.time, errors);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateCycleBoundaries(cycleBoundaries, time, errors) {
  if (cycleBoundaries == null) {
    return;
  }
  if (!Array.isArray(cycleBoundaries)) {
    errors.push(
      issue(
        'cycleBoundaries.invalid',
        'Project cycleBoundaries must be an array',
        '$.cycleBoundaries'
      )
    );
    return;
  }

  const ids = new Set();
  const times = new Set();
  cycleBoundaries.forEach((boundary, index) => {
    const path = `$.cycleBoundaries[${index}]`;
    if (!isObject(boundary)) {
      errors.push(
        issue('cycleBoundary.invalid', 'Cycle boundary must be an object', path)
      );
      return;
    }
    if (!boundary.id || ids.has(boundary.id)) {
      errors.push(
        issue(
          'cycleBoundary.id.invalid',
          'Each cycle boundary must have a unique id',
          `${path}.id`
        )
      );
    } else {
      ids.add(boundary.id);
    }
    const timeMs = Number(boundary.timeMs);
    if (
      !Number.isFinite(timeMs) ||
      timeMs <= 0 ||
      timeMs >= Number(time?.durationMs)
    ) {
      errors.push(
        issue(
          'cycleBoundary.timeMs.invalid',
          'Cycle boundary timeMs must be inside the project duration',
          `${path}.timeMs`
        )
      );
    } else if (times.has(timeMs)) {
      errors.push(
        issue(
          'cycleBoundary.timeMs.duplicate',
          'Cycle boundaries cannot share the same timeMs',
          `${path}.timeMs`
        )
      );
    } else {
      times.add(timeMs);
    }
  });
}

function validateActionRelations(actionRelations, actions, errors) {
  if (actionRelations == null) {
    return;
  }
  if (!Array.isArray(actionRelations)) {
    errors.push(
      issue(
        'actionRelations.invalid',
        'Project actionRelations must be an array',
        '$.actionRelations'
      )
    );
    return;
  }

  const actionIds = new Set((actions ?? []).map(action => action.id));
  const relationIds = new Set();
  const relationEdges = new Set();
  const graph = new Map();

  actionRelations.forEach((relation, index) => {
    const path = `$.actionRelations[${index}]`;
    if (!isObject(relation)) {
      errors.push(
        issue(
          'actionRelation.invalid',
          'Action relation must be an object',
          path
        )
      );
      return;
    }

    if (!relation.id || relationIds.has(relation.id)) {
      errors.push(
        issue(
          'actionRelation.id.invalid',
          'Each action relation must have a unique id',
          `${path}.id`
        )
      );
    } else {
      relationIds.add(relation.id);
    }
    if (!Object.values(ACTION_RELATION_KINDS).includes(relation.kind)) {
      errors.push(
        issue(
          'actionRelation.kind.invalid',
          `Unsupported action relation kind ${relation.kind}`,
          `${path}.kind`
        )
      );
    }

    const fromActionId = String(relation.fromActionId ?? '');
    const toActionId = String(relation.toActionId ?? '');
    if (!actionIds.has(fromActionId)) {
      errors.push(
        issue(
          'actionRelation.fromActionId.unknown',
          `Action relation source ${fromActionId} does not exist`,
          `${path}.fromActionId`
        )
      );
    }
    if (!actionIds.has(toActionId)) {
      errors.push(
        issue(
          'actionRelation.toActionId.unknown',
          `Action relation target ${toActionId} does not exist`,
          `${path}.toActionId`
        )
      );
    }
    if (fromActionId && fromActionId === toActionId) {
      errors.push(
        issue(
          'actionRelation.self.invalid',
          'Action relation cannot connect an action to itself',
          path
        )
      );
    }
    const simultaneous = relation.kind === ACTION_RELATION_KINDS.SIMULTANEOUS;
    const expectedSourceAnchor = simultaneous
      ? ACTION_RELATION_ANCHORS.SOURCE_START
      : ACTION_RELATION_ANCHORS.SOURCE_END;
    if (relation.sourceAnchor !== expectedSourceAnchor) {
      errors.push(
        issue(
          'actionRelation.sourceAnchor.invalid',
          simultaneous
            ? 'Simultaneous relation sourceAnchor must be start'
            : 'Sequence relation sourceAnchor must be end',
          `${path}.sourceAnchor`
        )
      );
    }
    if (relation.targetAnchor !== ACTION_RELATION_ANCHORS.TARGET_START) {
      errors.push(
        issue(
          'actionRelation.targetAnchor.invalid',
          'Sequence relation targetAnchor must be start',
          `${path}.targetAnchor`
        )
      );
    }
    if (!Number.isFinite(Number(relation.gapMs))) {
      errors.push(
        issue(
          'actionRelation.gapMs.invalid',
          'Action relation gapMs must be finite',
          `${path}.gapMs`
        )
      );
    } else if (simultaneous && Number(relation.gapMs) !== 0) {
      errors.push(
        issue(
          'actionRelation.gapMs.invalid',
          'Simultaneous relation gapMs must be zero',
          `${path}.gapMs`
        )
      );
    }

    const edgeKey = `${fromActionId}->${toActionId}`;
    if (relationEdges.has(edgeKey)) {
      errors.push(
        issue(
          'actionRelation.duplicate',
          `Duplicate action relation ${edgeKey}`,
          path
        )
      );
    } else if (
      actionIds.has(fromActionId) &&
      actionIds.has(toActionId) &&
      fromActionId !== toActionId
    ) {
      relationEdges.add(edgeKey);
      if (!graph.has(fromActionId)) {
        graph.set(fromActionId, new Set());
      }
      graph.get(fromActionId).add(toActionId);
    }
  });

  if (hasDirectedCycle(graph)) {
    errors.push(
      issue(
        'actionRelations.cycle.invalid',
        'Action relations must not contain a directed cycle',
        '$.actionRelations'
      )
    );
  }
}

function hasDirectedCycle(graph) {
  const visiting = new Set();
  const visited = new Set();

  function visit(nodeId) {
    if (visiting.has(nodeId)) {
      return true;
    }
    if (visited.has(nodeId)) {
      return false;
    }
    visiting.add(nodeId);
    for (const targetId of graph.get(nodeId) ?? []) {
      if (visit(targetId)) {
        return true;
      }
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  }

  return [...graph.keys()].some(visit);
}

function validateTeam(team, actors, errors) {
  const slots = team?.slots;
  if (slots == null || (Array.isArray(slots) && slots.length === 0)) {
    return;
  }
  if (!Array.isArray(slots)) {
    errors.push(
      issue(
        'team.slots.invalid',
        'Project team slots must be an array',
        '$.team.slots'
      )
    );
    return;
  }

  const slotIds = new Set();
  const characterIds = new Set();
  const actorCharacterIds = new Set(
    (actors ?? []).map(actor => Number(actor.characterId))
  );
  slots.forEach((slot, index) => {
    const path = `$.team.slots[${index}]`;
    if (Number(slot?.position) !== index) {
      errors.push(
        issue(
          'team.position.invalid',
          'Team slot position must match its array index',
          `${path}.position`
        )
      );
    }
    if (!slot?.slotId || slotIds.has(slot.slotId)) {
      errors.push(
        issue(
          'team.slotId.invalid',
          'Each team slot must have a unique slotId',
          `${path}.slotId`
        )
      );
    } else {
      slotIds.add(slot.slotId);
    }

    const characterId = Number(slot?.characterId);
    if (!Number.isFinite(characterId) || characterIds.has(characterId)) {
      errors.push(
        issue(
          'team.characterId.invalid',
          'Each team slot must reference a unique characterId',
          `${path}.characterId`
        )
      );
    } else if (!actorCharacterIds.has(characterId)) {
      errors.push(
        issue(
          'team.characterId.actorMissing',
          `Team slot characterId ${characterId} has no project actor`,
          `${path}.characterId`
        )
      );
    } else {
      characterIds.add(characterId);
    }
  });

  if (slots.length !== (actors ?? []).length) {
    errors.push(
      issue(
        'team.actorCount.mismatch',
        'Project team slot count must match actor count',
        '$.team.slots'
      )
    );
  }
}

function validateTime(time, errors) {
  if (!isObject(time)) {
    errors.push(
      issue('project.time.missing', 'Project time block is required', '$.time')
    );
    return;
  }

  if (time.unit !== PROJECT_TIME_UNIT) {
    errors.push(
      issue(
        'project.time.unit.invalid',
        'Project time.unit must be ms',
        '$.time.unit'
      )
    );
  }

  if (!isPositiveNumber(time.durationMs)) {
    errors.push(
      issue(
        'project.time.duration.invalid',
        'Project durationMs must be a positive number',
        '$.time.durationMs'
      )
    );
  }

  if (!isPositiveNumber(time.fps)) {
    errors.push(
      issue(
        'project.time.fps.invalid',
        'Project fps must be a positive number',
        '$.time.fps'
      )
    );
  }
}

function validateActors(actors, gameData, errors, warnings) {
  if (!Array.isArray(actors) || actors.length === 0) {
    errors.push(
      issue(
        'actors.missing',
        'Project must include at least one actor',
        '$.actors'
      )
    );
    return;
  }

  const characters = gameData.characters ?? [];
  const characterIds = new Set(
    characters.map(character => Number(character.id))
  );

  actors.forEach((actor, index) => {
    const path = `$.actors[${index}]`;
    if (!actor.id) {
      errors.push(
        issue('actor.id.missing', 'Actor id is required', `${path}.id`)
      );
    }
    if (!actor.characterId) {
      errors.push(
        issue(
          'actor.characterId.missing',
          'Actor characterId is required',
          `${path}.characterId`
        )
      );
    } else if (
      characters.length > 0 &&
      !characterIds.has(Number(actor.characterId))
    ) {
      errors.push(
        issue(
          'actor.characterId.unknown',
          `Unknown characterId ${actor.characterId}`,
          `${path}.characterId`
        )
      );
    }
    if (
      !Array.isArray(actor.baseAttributes) ||
      actor.baseAttributes.length === 0
    ) {
      warnings.push(
        issue(
          'actor.attributes.empty',
          'Actor has no base attributes',
          `${path}.baseAttributes`
        )
      );
    }
    validateActorInitialSp(actor, path, errors);
    validateActorLoadout(actor, path, gameData, errors, warnings);
  });
}

function validateActorInitialSp(actor, path, errors) {
  if (actor.initialSp == null || actor.initialSp === '') {
    return;
  }
  if (!Number.isFinite(actor.initialSp) || actor.initialSp < 0) {
    errors.push(
      issue(
        'actor.initialSp.invalid',
        'Actor initialSp must be a non-negative finite number or null',
        `${path}.initialSp`
      )
    );
    return;
  }
  const maxSp = Number(
    actor.baseAttributes?.find(attribute => attribute.key === 'MAXSP')?.value
  );
  if (Number.isFinite(maxSp) && actor.initialSp > maxSp) {
    errors.push(
      issue(
        'actor.initialSp.outOfRange',
        `Actor initialSp ${actor.initialSp} exceeds MAXSP ${maxSp}`,
        `${path}.initialSp`
      )
    );
  }
}

function validateActorLoadout(actor, path, gameData, errors, warnings) {
  const loadout = actor.loadout;
  if (!isObject(loadout)) {
    warnings.push(
      issue(
        'actor.loadout.missing',
        'Actor has no loadout configuration',
        `${path}.loadout`
      )
    );
    return;
  }

  if (loadout.actorId !== actor.id) {
    errors.push(
      issue(
        'actor.loadout.actorId.mismatch',
        'Loadout actorId must match its actor',
        `${path}.loadout.actorId`
      )
    );
  }
  if (Number(loadout.characterId) !== Number(actor.characterId)) {
    errors.push(
      issue(
        'actor.loadout.characterId.mismatch',
        'Loadout characterId must match its actor',
        `${path}.loadout.characterId`
      )
    );
  }

  validateOptionalCatalogId({
    value: loadout.kiboId,
    catalog: gameData.kibos,
    code: 'actor.loadout.kiboId.unknown',
    label: 'kiboId',
    path: `${path}.loadout.kiboId`,
    errors,
  });
  validateOptionalCatalogId({
    value: loadout.soulessenceId,
    catalog: gameData.soulessences,
    code: 'actor.loadout.soulessenceId.unknown',
    label: 'soulessenceId',
    path: `${path}.loadout.soulessenceId`,
    errors,
  });

  if (!isObject(loadout.equipment)) {
    errors.push(
      issue(
        'actor.loadout.equipment.invalid',
        'Loadout equipment must be an object',
        `${path}.loadout.equipment`
      )
    );
    return;
  }

  const equipmentCatalog = Array.isArray(gameData.equipment)
    ? gameData.equipment
    : [];
  Object.entries(LOADOUT_EQUIPMENT_SLOT_TYPES).forEach(
    ([slotKey, expectedType]) => {
      const equipmentId = loadout.equipment[slotKey];
      if (equipmentId == null || equipmentId === '') {
        return;
      }
      const equipment = equipmentCatalog.find(
        item => Number(item.id) === Number(equipmentId)
      );
      if (equipmentCatalog.length > 0 && !equipment) {
        errors.push(
          issue(
            'actor.loadout.equipmentId.unknown',
            `Unknown equipment id ${equipmentId}`,
            `${path}.loadout.equipment.${slotKey}`
          )
        );
      } else if (equipment && equipment.type !== expectedType) {
        errors.push(
          issue(
            'actor.loadout.equipmentType.mismatch',
            `Equipment ${equipmentId} must be ${expectedType}`,
            `${path}.loadout.equipment.${slotKey}`
          )
        );
      }
    }
  );
}

function validateOptionalCatalogId({
  value,
  catalog,
  code,
  label,
  path,
  errors,
}) {
  if (value == null || value === '' || !Array.isArray(catalog)) {
    return;
  }
  if (
    catalog.length > 0 &&
    !catalog.some(item => Number(item.id) === Number(value))
  ) {
    errors.push(issue(code, `Unknown ${label} ${value}`, path));
  }
}

function validateEnemy(enemy, gameData, errors, warnings) {
  if (!isObject(enemy)) {
    errors.push(issue('enemy.missing', 'Project enemy is required', '$.enemy'));
    return;
  }

  const enemies = gameData.enemies ?? [];
  const enemyIds = new Set(enemies.map(item => Number(item.id)));

  if (!enemy.id) {
    errors.push(
      issue('enemy.id.missing', 'Enemy instance id is required', '$.enemy.id')
    );
  }
  if (!enemy.enemyId) {
    errors.push(
      issue(
        'enemy.enemyId.missing',
        'Enemy enemyId is required',
        '$.enemy.enemyId'
      )
    );
  } else if (enemies.length > 0 && !enemyIds.has(Number(enemy.enemyId))) {
    errors.push(
      issue(
        'enemy.enemyId.unknown',
        `Unknown enemyId ${enemy.enemyId}`,
        '$.enemy.enemyId'
      )
    );
  }
  if (
    !Array.isArray(enemy.baseAttributes) ||
    enemy.baseAttributes.length === 0
  ) {
    warnings.push(
      issue(
        'enemy.attributes.empty',
        'Enemy has no base attributes',
        '$.enemy.baseAttributes'
      )
    );
  }
  if (
    enemy.toughnessMultiplier != null &&
    !isPositiveNumber(enemy.toughnessMultiplier)
  ) {
    errors.push(
      issue(
        'enemy.toughnessMultiplier.invalid',
        'Enemy toughnessMultiplier must be a positive number',
        '$.enemy.toughnessMultiplier'
      )
    );
  }
  if (
    enemy.initialToughnessRatio != null &&
    (!Number.isFinite(enemy.initialToughnessRatio) ||
      enemy.initialToughnessRatio < 0 ||
      enemy.initialToughnessRatio > 1)
  ) {
    errors.push(
      issue(
        'enemy.initialToughnessRatio.invalid',
        'Enemy initialToughnessRatio must be between 0 and 1',
        '$.enemy.initialToughnessRatio'
      )
    );
  }
  if (
    enemy.elementDefenseOverrides != null &&
    !isObject(enemy.elementDefenseOverrides)
  ) {
    errors.push(
      issue(
        'enemy.elementDefenseOverrides.invalid',
        'Enemy elementDefenseOverrides must be an object',
        '$.enemy.elementDefenseOverrides'
      )
    );
  } else if (isObject(enemy.elementDefenseOverrides)) {
    Object.entries(enemy.elementDefenseOverrides).forEach(([key, value]) => {
      if (!ENEMY_ELEMENT_DEFENSE_KEYS.has(key)) {
        errors.push(
          issue(
            'enemy.elementDefenseOverrides.key.invalid',
            `Enemy element defense override key ${key} is not supported`,
            `$.enemy.elementDefenseOverrides.${key}`
          )
        );
      } else if (!Number.isFinite(value)) {
        errors.push(
          issue(
            'enemy.elementDefenseOverrides.value.invalid',
            `Enemy element defense override ${key} must be a finite number`,
            `$.enemy.elementDefenseOverrides.${key}`
          )
        );
      }
    });
  }
  if (
    Array.isArray(enemy.baseAttributes) &&
    !enemy.baseAttributes.some(
      attribute =>
        attribute.key === 'WEAKNESS_POINT_MAX' &&
        Number.isFinite(attribute.value)
    )
  ) {
    warnings.push(
      issue(
        'enemy.toughnessBase.missing',
        'Enemy has no WEAKNESS_POINT_MAX base attribute',
        '$.enemy.baseAttributes'
      )
    );
  }
}

function validateActions(actions, project, gameData, errors, warnings) {
  if (!Array.isArray(actions)) {
    errors.push(
      issue('actions.invalid', 'Project actions must be an array', '$.actions')
    );
    return;
  }

  validateUniqueIds(actions, '$.actions', errors);

  const actorIds = new Set((project.actors ?? []).map(actor => actor.id));
  const enemyIds = new Set(project.enemy?.id ? [project.enemy.id] : []);
  const skills = gameData.skills ?? [];
  const skillIds = new Set(skills.map(skill => Number(skill.id)));

  actions.forEach((action, index) => {
    const path = `$.actions[${index}]`;
    if (!Object.values(ACTION_TYPES).includes(action.type)) {
      errors.push(
        issue(
          'action.type.invalid',
          `Unsupported action type ${action.type}`,
          `${path}.type`
        )
      );
    }
    if (!Number.isFinite(action.startMs) || action.startMs < 0) {
      errors.push(
        issue(
          'action.startMs.invalid',
          'Action startMs must be a non-negative number',
          `${path}.startMs`
        )
      );
    }
    if (
      project.time?.durationMs != null &&
      action.startMs > project.time.durationMs
    ) {
      errors.push(
        issue(
          'action.startMs.outOfRange',
          'Action starts after project duration',
          `${path}.startMs`
        )
      );
    }
    validateActionEffectCommands(action, path, actorIds, enemyIds, errors);

    if (action.type === ACTION_TYPES.SKILL) {
      if (!actorIds.has(action.actorId)) {
        errors.push(
          issue(
            'action.actorId.unknown',
            `Unknown actorId ${action.actorId}`,
            `${path}.actorId`
          )
        );
      }
      if (action.targetId && !enemyIds.has(action.targetId)) {
        errors.push(
          issue(
            'action.targetId.unknown',
            `Unknown targetId ${action.targetId}`,
            `${path}.targetId`
          )
        );
      }
      if (!action.skillId) {
        errors.push(
          issue(
            'action.skillId.missing',
            'Skill action requires skillId',
            `${path}.skillId`
          )
        );
      } else if (skills.length > 0 && !skillIds.has(Number(action.skillId))) {
        errors.push(
          issue(
            'action.skillId.unknown',
            `Unknown skillId ${action.skillId}`,
            `${path}.skillId`
          )
        );
      }
      if (action.timing?.needsTimingData) {
        warnings.push(
          issue(
            'action.timing.missing',
            'Skill action still needs authoritative timing data',
            `${path}.timing`
          )
        );
      }
    } else if (action.type === ACTION_TYPES.SWITCH) {
      if (!actorIds.has(action.actorId)) {
        errors.push(
          issue(
            'action.actorId.unknown',
            `Unknown actorId ${action.actorId}`,
            `${path}.actorId`
          )
        );
      }
      if (!actorIds.has(action.targetActorId)) {
        errors.push(
          issue(
            'action.targetActorId.unknown',
            `Unknown targetActorId ${action.targetActorId}`,
            `${path}.targetActorId`
          )
        );
      }
      if (action.durationMs !== 0 || action.durationFrames !== 0) {
        errors.push(
          issue(
            'action.durationMs.invalid',
            'Switch action must be a zero-duration exact-frame event',
            `${path}.durationMs`
          )
        );
      }
      const expectedFrame = msToFrame(action.startMs);
      if (
        action.startFrame !== expectedFrame ||
        action.endFrame !== expectedFrame
      ) {
        errors.push(
          issue(
            'action.frame.invalid',
            'Switch action startFrame and endFrame must equal its start frame',
            `${path}.startFrame`
          )
        );
      }
    } else if (action.type === ACTION_TYPES.WAIT) {
      if (!Number.isFinite(action.durationMs) || action.durationMs <= 0) {
        errors.push(
          issue(
            'action.durationMs.invalid',
            'Wait action durationMs must be positive',
            `${path}.durationMs`
          )
        );
      }
    } else if (
      action.type === ACTION_TYPES.ANNOTATION &&
      typeof action.note !== 'string'
    ) {
      errors.push(
        issue(
          'action.note.invalid',
          'Annotation action note must be a string',
          `${path}.note`
        )
      );
    } else if (action.type === ACTION_TYPES.RESOURCE) {
      if (action.actorId && !actorIds.has(action.actorId)) {
        errors.push(
          issue(
            'action.actorId.unknown',
            `Unknown actorId ${action.actorId}`,
            `${path}.actorId`
          )
        );
      }
      if (
        typeof action.resource !== 'string' ||
        action.resource.trim() === ''
      ) {
        errors.push(
          issue(
            'action.resource.invalid',
            'Resource action resource must be a non-empty string',
            `${path}.resource`
          )
        );
      }
      if (!Number.isFinite(action.change)) {
        errors.push(
          issue(
            'action.change.invalid',
            'Resource action change must be a finite number',
            `${path}.change`
          )
        );
      }
      if (typeof action.reason !== 'string') {
        errors.push(
          issue(
            'action.reason.invalid',
            'Resource action reason must be a string',
            `${path}.reason`
          )
        );
      }
    } else if (action.type === ACTION_TYPES.KIBO_EVENT) {
      if (!action.actorId || !actorIds.has(action.actorId)) {
        errors.push(
          issue(
            'action.actorId.unknown',
            `Unknown actorId ${action.actorId}`,
            `${path}.actorId`
          )
        );
      }
      if (
        typeof action.eventType !== 'string' ||
        action.eventType.trim() === ''
      ) {
        errors.push(
          issue(
            'action.eventType.invalid',
            'Kibo event action eventType must be a non-empty string',
            `${path}.eventType`
          )
        );
      }
      if (typeof action.note !== 'string') {
        errors.push(
          issue(
            'action.note.invalid',
            'Kibo event action note must be a string',
            `${path}.note`
          )
        );
      }
    } else if (action.type === ACTION_TYPES.ENEMY_EVENT) {
      if (
        typeof action.eventType !== 'string' ||
        action.eventType.trim() === ''
      ) {
        errors.push(
          issue(
            'action.eventType.invalid',
            'Enemy event action eventType must be a non-empty string',
            `${path}.eventType`
          )
        );
      }
      if (typeof action.note !== 'string') {
        errors.push(
          issue(
            'action.note.invalid',
            'Enemy event action note must be a string',
            `${path}.note`
          )
        );
      }
    }
  });
}

function validateActionEffectCommands(
  action,
  actionPath,
  actorIds,
  enemyIds,
  errors
) {
  if (action.effectCommands == null) {
    return;
  }
  if (!Array.isArray(action.effectCommands)) {
    errors.push(
      issue(
        'action.effectCommands.invalid',
        'Action effectCommands must be an array',
        `${actionPath}.effectCommands`
      )
    );
    return;
  }

  const commandIds = new Set();
  action.effectCommands.forEach((command, index) => {
    const path = `${actionPath}.effectCommands[${index}]`;
    if (!command?.id || commandIds.has(command.id)) {
      errors.push(
        issue(
          'action.effectCommand.id.invalid',
          'Each effect command must have a unique id',
          `${path}.id`
        )
      );
    } else {
      commandIds.add(command.id);
    }
    if (typeof command?.effectId !== 'string' || !command.effectId.trim()) {
      errors.push(
        issue(
          'action.effectCommand.effectId.invalid',
          'Effect command effectId must be a non-empty string',
          `${path}.effectId`
        )
      );
    }
    if (!Object.values(EFFECT_OPERATIONS).includes(command?.operation)) {
      errors.push(
        issue(
          'action.effectCommand.operation.invalid',
          `Unsupported effect operation ${command?.operation}`,
          `${path}.operation`
        )
      );
    }
    if (!Object.values(EFFECT_TARGET_KINDS).includes(command?.targetKind)) {
      errors.push(
        issue(
          'action.effectCommand.targetKind.invalid',
          `Unsupported effect target kind ${command?.targetKind}`,
          `${path}.targetKind`
        )
      );
    }
    if (command?.targetId) {
      const targetIds =
        command.targetKind === EFFECT_TARGET_KINDS.ENEMY ? enemyIds : actorIds;
      if (!targetIds.has(command.targetId)) {
        errors.push(
          issue(
            'action.effectCommand.targetId.unknown',
            `Unknown effect targetId ${command.targetId}`,
            `${path}.targetId`
          )
        );
      }
    }
    if (!Number.isFinite(command?.offsetMs) || command.offsetMs < 0) {
      errors.push(
        issue(
          'action.effectCommand.offsetMs.invalid',
          'Effect command offsetMs must be a non-negative finite number',
          `${path}.offsetMs`
        )
      );
    }
    if (
      command?.durationMs != null &&
      (!Number.isFinite(command.durationMs) || command.durationMs < 0)
    ) {
      errors.push(
        issue(
          'action.effectCommand.durationMs.invalid',
          'Effect command durationMs must be null or a non-negative finite number',
          `${path}.durationMs`
        )
      );
    }
    if (!Object.values(EFFECT_STACK_MODES).includes(command?.stackMode)) {
      errors.push(
        issue(
          'action.effectCommand.stackMode.invalid',
          `Unsupported effect stack mode ${command?.stackMode}`,
          `${path}.stackMode`
        )
      );
    }
    if (!Number.isInteger(command?.stackDelta) || command.stackDelta < 1) {
      errors.push(
        issue(
          'action.effectCommand.stackDelta.invalid',
          'Effect command stackDelta must be a positive integer',
          `${path}.stackDelta`
        )
      );
    }
    if (!Number.isInteger(command?.maxStacks) || command.maxStacks < 1) {
      errors.push(
        issue(
          'action.effectCommand.maxStacks.invalid',
          'Effect command maxStacks must be a positive integer',
          `${path}.maxStacks`
        )
      );
    }
    if (!Array.isArray(command?.modifiers)) {
      errors.push(
        issue(
          'action.effectCommand.modifiers.invalid',
          'Effect command modifiers must be an array',
          `${path}.modifiers`
        )
      );
    }
    if (command?.appliedToCalculators === true) {
      errors.push(
        issue(
          'action.effectCommand.calculatorApplication.unsupported',
          'Effect commands cannot modify calculators before an effect adapter is configured',
          `${path}.appliedToCalculators`
        )
      );
    }
  });
}

function validateUniqueIds(items, path, errors) {
  if (!Array.isArray(items)) {
    return;
  }

  const seen = new Set();
  items.forEach((item, index) => {
    if (!item?.id) {
      return;
    }
    if (seen.has(item.id)) {
      errors.push(
        issue('id.duplicate', `Duplicate id ${item.id}`, `${path}[${index}].id`)
      );
    }
    seen.add(item.id);
  });
}

function issue(code, message, path) {
  return {
    code,
    message,
    path,
  };
}

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isPositiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function nonNegativeIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
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

function createStableId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
