import workbenchSeed from '../data/generated/workbench-seed.json';
import {
  createActorFromCharacter,
  createEnemyFromData,
  createProject,
  createSkillAction,
} from './projectSchema';

export const DEFAULT_WORKBENCH_SELECTION = Object.freeze({
  characterId: workbenchSeed.defaults.characterId,
  skillId: workbenchSeed.defaults.skillId,
  enemyId: workbenchSeed.defaults.enemyId,
});

export function getWorkbenchSeed() {
  return workbenchSeed;
}

export function getWorkbenchGameData() {
  return workbenchSeed.gameData;
}

export function getSkillsForCharacter(characterId) {
  return workbenchSeed.gameData.skills.filter((skill) => skill.characterId === Number(characterId));
}

export function normalizeWorkbenchSelection(selection = {}) {
  const characterId = Number(selection.characterId ?? DEFAULT_WORKBENCH_SELECTION.characterId);
  const character = findById(workbenchSeed.gameData.characters, characterId) ?? workbenchSeed.gameData.characters[0];
  const characterSkills = getSkillsForCharacter(character.id);
  const requestedSkill = findById(characterSkills, selection.skillId);
  const skill = requestedSkill ?? characterSkills[0] ?? workbenchSeed.gameData.skills[0];
  const enemy =
    findById(workbenchSeed.gameData.enemies, selection.enemyId) ??
    findById(workbenchSeed.gameData.enemies, DEFAULT_WORKBENCH_SELECTION.enemyId) ??
    workbenchSeed.gameData.enemies[0];

  return {
    characterId: character.id,
    skillId: skill.id,
    enemyId: enemy.id,
  };
}

export function createWorkbenchProject(selection = {}, actionPatch = {}) {
  const normalized = normalizeWorkbenchSelection(selection);
  const character = findById(workbenchSeed.gameData.characters, normalized.characterId);
  const skill = findById(workbenchSeed.gameData.skills, normalized.skillId);
  const enemy = findById(workbenchSeed.gameData.enemies, normalized.enemyId);

  if (!character || !skill || !enemy) {
    throw new Error('Workbench seed cannot resolve selected character, skill, or enemy');
  }

  const actor = createActorFromCharacter(character, {
    actorId: `actor-${character.id}`,
    level: actionPatch.actorLevel ?? 80,
    skillLevels: {
      [skill.id]: actionPatch.level ?? 1,
    },
  });
  const enemyInstance = createEnemyFromData(enemy, {
    enemyInstanceId: `enemy-${enemy.id}`,
    level: actionPatch.enemyLevel ?? 80,
  });

  return createProject({
    id: 'workbench-editable-slice',
    name: `工作台：${character.name} / ${skill.name} / ${enemy.name}`,
    durationMs: actionPatch.durationMs ?? 30000,
    actors: [actor],
    enemy: enemyInstance,
    actions: [
      createSkillAction({
        id: 'action-0001',
        actorId: actor.id,
        skill,
        targetId: enemyInstance.id,
        startMs: actionPatch.startMs ?? 0,
        level: actionPatch.level ?? 1,
        note: '工作台可编辑动作；精确命中帧等待 asset 或运行时捕获补充。',
      }),
    ],
    metadata: {
      fixture: false,
      fixturePurpose: 'stage-4-editable-workbench',
      sourceCharacterId: character.id,
      sourceSkillId: skill.id,
      sourceEnemyId: enemy.id,
    },
  });
}

function findById(items, id) {
  return items.find((item) => item.id === Number(id)) ?? null;
}
