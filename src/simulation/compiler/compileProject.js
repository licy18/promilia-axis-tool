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
  const actorsById = new Map(project.actors.map((actor) => [actor.id, compileActor(actor, charactersById)]));
  const enemy = compileEnemy(project.enemy, enemiesById);

  const actions = project.actions
    .map((action) => compileAction(action, actorsById, enemy, skillsById))
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
        .filter((action) => action.timing.needsTimingData)
        .map((action) => action.id),
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
      attack: getAttributeValue(actor.baseAttributes, 'ATK'),
      maxHp: getAttributeValue(actor.baseAttributes, 'MAXHP'),
      critRate: getAttributeValue(actor.baseAttributes, 'CRI'),
      critDamage: getAttributeValue(actor.baseAttributes, 'CRI_DMG'),
      maxSp: getAttributeValue(actor.baseAttributes, 'MAXSP'),
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

  return {
    ...action,
    actor,
    target: action.targetId === enemy.id ? enemy : null,
    source: {
      skill,
    },
    damageSegments,
    selectedDamageSegment: damageSegments[0] ?? null,
  };
}

function indexById(items = []) {
  return new Map(items.map((item) => [Number(item.id), item]));
}

function getAttributeValue(baseAttributes, key) {
  const attribute = (baseAttributes ?? []).find((item) => item.key === key);
  return Number.isFinite(attribute?.value) ? attribute.value : 0;
}
