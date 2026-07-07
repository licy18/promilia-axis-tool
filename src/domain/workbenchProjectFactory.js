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

export const DEFAULT_WORKBENCH_ACTION_ID = 'action-0001';

export function getWorkbenchSeed() {
  return workbenchSeed;
}

export function getWorkbenchGameData() {
  return workbenchSeed.gameData;
}

export function getSkillsForCharacter(characterId) {
  return workbenchSeed.gameData.skills.filter((skill) => skill.characterId === Number(characterId));
}

export function createWorkbenchActionDraft({
  id = DEFAULT_WORKBENCH_ACTION_ID,
  skillId = DEFAULT_WORKBENCH_SELECTION.skillId,
  startMs = 0,
  level = 1,
} = {}) {
  return {
    id,
    skillId: Number(skillId),
    startMs: Number(startMs) || 0,
    level: Math.max(1, Number(level) || 1),
  };
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
  const enemy = findById(workbenchSeed.gameData.enemies, normalized.enemyId);
  const actionDrafts = normalizeWorkbenchActionDrafts(actionPatch.actions ?? [actionPatch], normalized.characterId);

  if (!character || !enemy || actionDrafts.length === 0) {
    throw new Error('Workbench seed cannot resolve selected character, skill, or enemy');
  }

  const skillLevels = Object.fromEntries(actionDrafts.map((draft) => [draft.skillId, draft.level]));
  const actor = createActorFromCharacter(character, {
    actorId: `actor-${character.id}`,
    level: actionPatch.actorLevel ?? 80,
    skillLevels,
  });
  const enemyInstance = createEnemyFromData(enemy, {
    enemyInstanceId: `enemy-${enemy.id}`,
    level: actionPatch.enemyLevel ?? 80,
  });
  const firstSkill = findById(workbenchSeed.gameData.skills, actionDrafts[0].skillId);

  return createProject({
    id: 'workbench-editable-slice',
    name: `工作台：${character.name} / ${firstSkill.name} / ${enemy.name}`,
    durationMs: actionPatch.durationMs ?? 30000,
    actors: [actor],
    enemy: enemyInstance,
    actions: actionDrafts.map((draft) => {
      const skill = findById(workbenchSeed.gameData.skills, draft.skillId);
      return createSkillAction({
        id: draft.id,
        actorId: actor.id,
        skill,
        targetId: enemyInstance.id,
        startMs: draft.startMs,
        level: draft.level,
        note: '工作台可编辑动作；精确命中帧等待 asset 或运行时捕获补充。',
      });
    }),
    metadata: {
      fixture: false,
      fixturePurpose: 'stage-4-editable-workbench',
      sourceCharacterId: character.id,
      sourceSkillIds: actionDrafts.map((draft) => draft.skillId),
      sourceEnemyId: enemy.id,
    },
  });
}

export function normalizeWorkbenchActionDrafts(actionDrafts = [], characterId = DEFAULT_WORKBENCH_SELECTION.characterId) {
  const skills = getSkillsForCharacter(characterId);
  const fallbackSkill = skills[0] ?? workbenchSeed.gameData.skills[0];

  return actionDrafts
    .map((draft, index) => {
      const requestedSkill = findById(skills, draft.skillId);
      const skill = requestedSkill ?? fallbackSkill;
      return createWorkbenchActionDraft({
        id: draft.id ?? `action-${String(index + 1).padStart(4, '0')}`,
        skillId: skill.id,
        startMs: draft.startMs,
        level: clampLevel(draft.level, skill),
      });
    })
    .filter((draft) => findById(workbenchSeed.gameData.skills, draft.skillId));
}

function clampLevel(level, skill) {
  const maxLevel = Math.max(1, skill?.level?.values?.length ?? 1);
  return Math.min(maxLevel, Math.max(1, Number(level) || 1));
}

function findById(items, id) {
  return items.find((item) => item.id === Number(id)) ?? null;
}
