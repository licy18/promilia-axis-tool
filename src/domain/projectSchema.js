import { createSkillDamageModel } from './skillDamageSegments';
import { createSkillLogicModel } from './skillLogicModel';

export const PROJECT_SCHEMA_VERSION = 1;
export const PROJECT_TIME_UNIT = 'ms';

export const ACTION_TYPES = Object.freeze({
  SKILL: 'skill',
  SWITCH: 'switch',
  WAIT: 'wait',
  ENEMY_EVENT: 'enemyEvent',
  RESOURCE: 'resource',
  ANNOTATION: 'annotation',
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
  enemy = null,
  actions = [],
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
    enemy,
    actions,
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

export function createActorFromCharacter(character, options = {}) {
  if (!character) {
    throw new Error('createActorFromCharacter requires a character');
  }

  const actorId = options.actorId ?? `actor-${character.id}`;

  return {
    id: actorId,
    characterId: character.id,
    name: character.name,
    level: options.level ?? 80,
    elementId: character.element?.id ?? null,
    role: character.position?.name ?? null,
    propertyId: character.property?.id ?? null,
    baseAttributes: character.property?.baseAttributes ?? [],
    attributePanel: character.attributePanel ?? null,
    skillLevels: options.skillLevels ?? {},
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
  note = '',
  insertion = null,
  generationBatch = null,
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

  return {
    id: id ?? createStableId('action'),
    type: ACTION_TYPES.SKILL,
    actorId,
    skillId: skill.id,
    name:
      selectedActionVariant?.displayLabel ??
      selectedActionVariant?.label ??
      skill.displayName ??
      skill.name ??
      `Skill ${skill.id}`,
    startMs,
    durationMs,
    targetId,
    level,
    actionVariantIndex: Math.max(0, Number(actionVariantIndex) || 0),
    damageSegmentIndex: Math.max(
      0,
      Number(actionVariantIndex ?? damageSegmentIndex) || 0
    ),
    cooldownMs: skill.cooldownMs,
    spCost: skill.spCost,
    elementId: skill.elementId,
    damageModel,
    logicModel: createSkillLogicModel(skill, level, { damageModel }),
    timing: {
      needsTimingData: Boolean(skill.needsTimingData),
      source: skill.timingSource ?? 'unknown',
      animationTimeMs: durationMs,
      damageTicks: [],
      cancelWindows: [],
    },
    note,
    insertion,
    generationBatch,
  };
}

export function createSwitchAction({
  id,
  actorId,
  targetActorId,
  targetCharacterId = null,
  startMs = 0,
  durationMs = 600,
  note = '',
  insertion = null,
} = {}) {
  return {
    id: id ?? createStableId('action'),
    type: ACTION_TYPES.SWITCH,
    actorId,
    targetActorId,
    targetCharacterId,
    name: '切人',
    startMs,
    durationMs,
    note,
    insertion,
  };
}

export function createWaitAction({
  id,
  startMs = 0,
  durationMs = 1000,
  note = '等待',
  insertion = null,
} = {}) {
  return {
    id: id ?? createStableId('action'),
    type: ACTION_TYPES.WAIT,
    name: '等待',
    startMs,
    durationMs,
    note,
    insertion,
  };
}

export function createAnnotationAction({
  id,
  startMs = 0,
  note = '备注',
  insertion = null,
} = {}) {
  return {
    id: id ?? createStableId('action'),
    type: ACTION_TYPES.ANNOTATION,
    name: '注释',
    startMs,
    durationMs: 600,
    note,
    insertion,
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
  };
}

export function createEnemyEventAction({
  id,
  targetId = null,
  startMs = 0,
  eventType = 'phase',
  note = '敌人阶段标记',
  insertion = null,
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
  validateEnemy(project.enemy, gameData, errors, warnings);
  validateActions(project.actions, project, gameData, errors, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
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
    validateActorLoadout(actor, path, gameData, errors, warnings);
  });
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
      if (!Number.isFinite(action.durationMs) || action.durationMs <= 0) {
        errors.push(
          issue(
            'action.durationMs.invalid',
            'Switch action durationMs must be positive',
            `${path}.durationMs`
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

function createStableId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
