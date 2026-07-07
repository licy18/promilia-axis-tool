import workbenchSeed from '../data/generated/workbench-seed.json';
import {
  ACTION_TYPES,
  createActorFromCharacter,
  createAnnotationAction,
  createEnemyFromData,
  createProject,
  createSkillAction,
  createWaitAction,
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
  type = ACTION_TYPES.SKILL,
  skillId = DEFAULT_WORKBENCH_SELECTION.skillId,
  startMs = 0,
  durationMs = 1000,
  level = 1,
  note = '',
} = {}) {
  return {
    id,
    type,
    skillId: Number(skillId),
    startMs: Number(startMs) || 0,
    durationMs: Math.max(1, Number(durationMs) || 1000),
    level: Math.max(1, Number(level) || 1),
    note,
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

  const skillDrafts = actionDrafts.filter((draft) => draft.type === ACTION_TYPES.SKILL);
  const skillLevels = Object.fromEntries(skillDrafts.map((draft) => [draft.skillId, draft.level]));
  const actor = createActorFromCharacter(character, {
    actorId: `actor-${character.id}`,
    level: actionPatch.actorLevel ?? 80,
    skillLevels,
  });
  const enemyInstance = createEnemyFromData(enemy, {
    enemyInstanceId: `enemy-${enemy.id}`,
    level: actionPatch.enemyLevel ?? 80,
  });
  const titleAction = actionDrafts[0];
  const firstSkill = findById(workbenchSeed.gameData.skills, titleAction.skillId);
  const titleActionName = titleAction.type === ACTION_TYPES.SKILL ? firstSkill.name : actionTypeLabel(titleAction.type);

  return createProject({
    id: 'workbench-editable-slice',
    name: `工作台：${character.name} / ${titleActionName} / ${enemy.name}`,
    durationMs: actionPatch.durationMs ?? 30000,
    actors: [actor],
    enemy: enemyInstance,
    actions: actionDrafts.map((draft) => createProjectActionFromDraft(draft, actor.id, enemyInstance.id)),
    metadata: {
      fixture: false,
      fixturePurpose: 'stage-4-editable-workbench',
      sourceCharacterId: character.id,
      sourceSkillIds: skillDrafts.map((draft) => draft.skillId),
      sourceEnemyId: enemy.id,
    },
  });
}

export function normalizeWorkbenchActionDrafts(actionDrafts = [], characterId = DEFAULT_WORKBENCH_SELECTION.characterId) {
  const skills = getSkillsForCharacter(characterId);
  const fallbackSkill = skills[0] ?? workbenchSeed.gameData.skills[0];

  return actionDrafts
    .map((draft, index) => {
      if (draft.type === ACTION_TYPES.WAIT || draft.type === ACTION_TYPES.ANNOTATION) {
        return createWorkbenchActionDraft({
          id: draft.id ?? `action-${String(index + 1).padStart(4, '0')}`,
          type: draft.type,
          skillId: draft.skillId ?? fallbackSkill.id,
          startMs: draft.startMs,
          durationMs: draft.durationMs,
          level: draft.level,
          note: draft.note,
        });
      }

      const requestedSkill = findById(skills, draft.skillId);
      const skill = requestedSkill ?? fallbackSkill;
      return createWorkbenchActionDraft({
        id: draft.id ?? `action-${String(index + 1).padStart(4, '0')}`,
        type: ACTION_TYPES.SKILL,
        skillId: skill.id,
        startMs: draft.startMs,
        durationMs: draft.durationMs,
        level: clampLevel(draft.level, skill),
        note: draft.note,
      });
    })
    .filter((draft) => draft.type !== ACTION_TYPES.SKILL || findById(workbenchSeed.gameData.skills, draft.skillId));
}

function createProjectActionFromDraft(draft, actorId, targetId) {
  if (draft.type === ACTION_TYPES.WAIT) {
    return createWaitAction({
      id: draft.id,
      startMs: draft.startMs,
      durationMs: draft.durationMs,
      note: draft.note || '等待窗口',
    });
  }

  if (draft.type === ACTION_TYPES.ANNOTATION) {
    return createAnnotationAction({
      id: draft.id,
      startMs: draft.startMs,
      note: draft.note || '备注',
    });
  }

  const skill = findById(workbenchSeed.gameData.skills, draft.skillId);
  return createSkillAction({
    id: draft.id,
    actorId,
    skill,
    targetId,
    startMs: draft.startMs,
    durationMs: draft.durationMs,
    level: draft.level,
    note: draft.note || '工作台可编辑动作；精确命中帧等待 asset 或运行时捕获补充。',
  });
}

function actionTypeLabel(type) {
  if (type === ACTION_TYPES.WAIT) {
    return '等待';
  }
  if (type === ACTION_TYPES.ANNOTATION) {
    return '注释';
  }
  return '动作';
}

function clampLevel(level, skill) {
  const maxLevel = Math.max(1, skill?.level?.values?.length ?? 1);
  return Math.min(maxLevel, Math.max(1, Number(level) || 1));
}

function findById(items, id) {
  return items.find((item) => item.id === Number(id)) ?? null;
}
