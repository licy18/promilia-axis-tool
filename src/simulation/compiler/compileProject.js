import { ACTION_TYPES, validateProject } from '../../domain/projectSchema';
import { parseDamageSegments } from '../mechanics/damage';

export class CompileProjectError extends Error {
  constructor(issues) {
    super('Project cannot be compiled for simulation');
    this.name = 'CompileProjectError';
    this.issues = issues;
  }
}

export function compileProject(project, gameData) {
  const validation = validateProject(project, gameData);
  if (!validation.valid) {
    throw new CompileProjectError(validation.errors);
  }

  const charactersById = indexById(gameData.characters);
  const skillsById = indexById(gameData.skills);
  const enemiesById = indexById(gameData.enemies);
  const actorsById = new Map(
    project.actors.map(actor => [actor.id, compileActor(actor, charactersById)])
  );
  const enemy = compileEnemy(project.enemy, enemiesById);

  const actions = project.actions
    .map(action => compileAction(action, actorsById, enemy, skillsById))
    .sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));

  return {
    schemaVersion: 1,
    sourceProject: {
      id: project.id,
      name: project.name,
      schemaVersion: project.schemaVersion,
    },
    time: {
      ...project.time,
    },
    actors: [...actorsById.values()],
    enemy,
    actions,
    diagnostics: {
      validationWarnings: validation.warnings,
      missingTimingActionIds: actions
        .filter(action => action.timing?.needsTimingData)
        .map(action => action.id),
    },
  };
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
      maxSp: getAttributeValue(actor.baseAttributes, 'MAXSP'),
      source: actor.attributePanel
        ? 'character-attribute-panel-current-rank'
        : 'baseAttributes',
    },
  };
}

function compileEnemy(enemy, enemiesById) {
  const sourceEnemy = enemiesById.get(Number(enemy.enemyId));

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
    },
  };
}

function compileAction(action, actorsById, enemy, skillsById) {
  if (action.type === ACTION_TYPES.SWITCH) {
    return {
      ...action,
      actor: actorsById.get(action.actorId) ?? null,
      targetActor: actorsById.get(action.targetActorId) ?? null,
      target: null,
      source: {},
      damageSegments: [],
      selectedDamageSegment: null,
    };
  }

  if (action.type === ACTION_TYPES.RESOURCE) {
    return {
      ...action,
      actor: action.actorId ? (actorsById.get(action.actorId) ?? null) : null,
      target: null,
      source: {},
      damageSegments: [],
      selectedDamageSegment: null,
    };
  }

  if (action.type === ACTION_TYPES.ENEMY_EVENT) {
    return {
      ...action,
      actor: null,
      target: action.targetId === enemy.id ? enemy : null,
      source: {},
      damageSegments: [],
      selectedDamageSegment: null,
    };
  }

  if (action.type !== ACTION_TYPES.SKILL) {
    return {
      ...action,
      actor: null,
      target: action.targetId === enemy.id ? enemy : null,
      source: {},
      damageSegments: [],
      selectedDamageSegment: null,
    };
  }

  const actor = actorsById.get(action.actorId);
  const skill = skillsById.get(Number(action.skillId));
  const damageSegments = parseDamageSegments(action);
  const selectedDamageSegment =
    damageSegments.find(
      segment => Number(segment.index) === Number(action.damageSegmentIndex)
    ) ??
    damageSegments[0] ??
    null;

  return {
    ...action,
    actor,
    target: action.targetId === enemy.id ? enemy : null,
    source: {
      skill,
    },
    damageSegments,
    selectedDamageSegment,
  };
}

function indexById(items = []) {
  return new Map(items.map(item => [Number(item.id), item]));
}

function getAttributeValue(baseAttributes, key) {
  const attribute = (baseAttributes ?? []).find(item => item.key === key);
  return Number.isFinite(attribute?.value) ? attribute.value : 0;
}

function getPanelCoreValue(attributePanel, key, fallback = 0) {
  const value = attributePanel?.core?.[key]?.effectiveValue;
  return Number.isFinite(value) ? value : fallback;
}
