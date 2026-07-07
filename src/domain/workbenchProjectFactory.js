import workbenchSeed from '../data/generated/workbench-seed.json';
import {
  ACTION_TYPES,
  createActorFromCharacter,
  createAnnotationAction,
  createEnemyFromData,
  createEnemyEventAction,
  createProject,
  createResourceAction,
  createSkillAction,
  createSwitchAction,
  createWaitAction,
} from './projectSchema';

const DEFAULT_SECONDARY_CHARACTER_ID =
  workbenchSeed.gameData.characters.find((character) => character.id !== workbenchSeed.defaults.characterId)?.id ??
  workbenchSeed.defaults.characterId;

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
  targetCharacterId = DEFAULT_WORKBENCH_SELECTION.secondaryCharacterId,
  resource = 'sp',
  change = 50,
  reason = 'manual-axis-resource',
  eventType = 'phase',
  note = '',
} = {}) {
  return {
    id,
    type,
    skillId: Number(skillId),
    startMs: Number(startMs) || 0,
    durationMs: Math.max(1, Number(durationMs) || 1000),
    level: Math.max(1, Number(level) || 1),
    targetCharacterId: Number(targetCharacterId) || DEFAULT_WORKBENCH_SELECTION.secondaryCharacterId,
    resource,
    change: Number(change) || 0,
    reason,
    eventType,
    note,
  };
}

export function normalizeWorkbenchSelection(selection = {}) {
  const characterId = Number(selection.characterId ?? DEFAULT_WORKBENCH_SELECTION.characterId);
  const character = findById(workbenchSeed.gameData.characters, characterId) ?? workbenchSeed.gameData.characters[0];
  const requestedSecondaryCharacter = findById(workbenchSeed.gameData.characters, selection.secondaryCharacterId);
  const fallbackSecondaryCharacter =
    workbenchSeed.gameData.characters.find((item) => item.id !== character.id) ?? character;
  const secondaryCharacter =
    requestedSecondaryCharacter && requestedSecondaryCharacter.id !== character.id
      ? requestedSecondaryCharacter
      : fallbackSecondaryCharacter;
  const characterSkills = getSkillsForCharacter(character.id);
  const requestedSkill = findById(characterSkills, selection.skillId);
  const skill = requestedSkill ?? characterSkills[0] ?? workbenchSeed.gameData.skills[0];
  const enemy =
    findById(workbenchSeed.gameData.enemies, selection.enemyId) ??
    findById(workbenchSeed.gameData.enemies, DEFAULT_WORKBENCH_SELECTION.enemyId) ??
    workbenchSeed.gameData.enemies[0];

  return {
    characterId: character.id,
    secondaryCharacterId: secondaryCharacter.id,
    skillId: skill.id,
    enemyId: enemy.id,
  };
}

export function createWorkbenchProject(selection = {}, actionPatch = {}) {
  const normalized = normalizeWorkbenchSelection(selection);
  const enemyConfig = normalizeWorkbenchEnemyConfig(actionPatch.enemyConfig ?? actionPatch);
  const character = findById(workbenchSeed.gameData.characters, normalized.characterId);
  const secondaryCharacter = findById(workbenchSeed.gameData.characters, normalized.secondaryCharacterId);
  const enemy = findById(workbenchSeed.gameData.enemies, normalized.enemyId);
  const actionDrafts = normalizeWorkbenchActionDrafts(actionPatch.actions ?? [actionPatch], normalized);

  if (!character || !secondaryCharacter || !enemy || actionDrafts.length === 0) {
    throw new Error('Workbench seed cannot resolve selected character, skill, or enemy');
  }

  const skillDrafts = actionDrafts.filter((draft) => draft.type === ACTION_TYPES.SKILL);
  const teamCharacters = uniqueById([character, secondaryCharacter]);
  const actors = teamCharacters.map((item) =>
    createActorFromCharacter(item, {
      actorId: `actor-${item.id}`,
      level: actionPatch.actorLevel ?? 80,
      skillLevels: createSkillLevelsForCharacter(skillDrafts, item.id),
    }),
  );
  const actorsByCharacterId = new Map(actors.map((actor) => [Number(actor.characterId), actor]));
  const enemyInstance = createEnemyFromData(enemy, {
    enemyInstanceId: `enemy-${enemy.id}`,
    level: enemyConfig.level,
    hpMultiplier: enemyConfig.hpMultiplier,
    defenseMultiplier: enemyConfig.defenseMultiplier,
  });
  const titleAction = actionDrafts[0];
  const firstSkill = findById(workbenchSeed.gameData.skills, titleAction.skillId);
  const titleActionName = titleAction.type === ACTION_TYPES.SKILL ? firstSkill.name : actionTypeLabel(titleAction.type);

  return createProject({
    id: 'workbench-editable-slice',
    name: `工作台：${character.name} / ${titleActionName} / ${enemy.name}`,
    durationMs: actionPatch.durationMs ?? 30000,
    actors,
    enemy: enemyInstance,
    actions: actionDrafts.map((draft) =>
      createProjectActionFromDraft(draft, actorsByCharacterId, character.id, enemyInstance.id),
    ),
    metadata: {
      fixture: false,
      fixturePurpose: 'stage-4-editable-workbench',
      sourceCharacterId: character.id,
      secondaryCharacterId: secondaryCharacter.id,
      sourceSkillIds: skillDrafts.map((draft) => draft.skillId),
      sourceEnemyId: enemy.id,
      enemyConfig,
    },
  });
}

export function normalizeWorkbenchEnemyConfig(config = {}) {
  const source = config ?? {};
  return {
    level: clampNumber(source.level ?? source.enemyLevel, 1, 200, DEFAULT_WORKBENCH_ENEMY_CONFIG.level),
    hpMultiplier: clampNumber(
      source.hpMultiplier ?? DEFAULT_WORKBENCH_ENEMY_CONFIG.hpMultiplier,
      0.1,
      100,
      DEFAULT_WORKBENCH_ENEMY_CONFIG.hpMultiplier,
    ),
    defenseMultiplier: clampNumber(
      source.defenseMultiplier ?? DEFAULT_WORKBENCH_ENEMY_CONFIG.defenseMultiplier,
      0.1,
      100,
      DEFAULT_WORKBENCH_ENEMY_CONFIG.defenseMultiplier,
    ),
  };
}

export function normalizeWorkbenchActionDrafts(
  actionDrafts = [],
  selectionOrCharacterId = DEFAULT_WORKBENCH_SELECTION.characterId,
) {
  const selection =
    typeof selectionOrCharacterId === 'object'
      ? normalizeWorkbenchSelection(selectionOrCharacterId)
      : normalizeWorkbenchSelection({ characterId: selectionOrCharacterId });
  const skills = getSkillsForCharacter(selection.characterId);
  const fallbackSkill = skills[0] ?? workbenchSeed.gameData.skills[0];

  return actionDrafts
    .map((draft, index) => {
      if (isNonSkillDraftType(draft.type)) {
        return createWorkbenchActionDraft({
          id: draft.id ?? `action-${String(index + 1).padStart(4, '0')}`,
          type: draft.type,
          skillId: draft.skillId ?? fallbackSkill.id,
          startMs: draft.startMs,
          durationMs: draft.durationMs,
          level: draft.level,
          targetCharacterId: draft.targetCharacterId ?? selection.secondaryCharacterId,
          resource: draft.resource,
          change: draft.change,
          reason: draft.reason,
          eventType: draft.eventType,
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
        targetCharacterId: draft.targetCharacterId ?? selection.secondaryCharacterId,
        resource: draft.resource,
        change: draft.change,
        reason: draft.reason,
        eventType: draft.eventType,
        note: draft.note,
      });
    })
    .filter((draft) => draft.type !== ACTION_TYPES.SKILL || findById(workbenchSeed.gameData.skills, draft.skillId));
}

function createProjectActionFromDraft(draft, actorsByCharacterId, primaryCharacterId, targetId) {
  const primaryActor = actorsByCharacterId.get(Number(primaryCharacterId)) ?? [...actorsByCharacterId.values()][0];

  if (draft.type === ACTION_TYPES.SWITCH) {
    const targetActor = actorsByCharacterId.get(Number(draft.targetCharacterId)) ?? primaryActor;
    return createSwitchAction({
      id: draft.id,
      actorId: primaryActor.id,
      targetActorId: targetActor.id,
      targetCharacterId: targetActor.characterId,
      startMs: draft.startMs,
      durationMs: draft.durationMs,
      note: draft.note || `切换至 ${targetActor.name}`,
    });
  }

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

  if (draft.type === ACTION_TYPES.RESOURCE) {
    return createResourceAction({
      id: draft.id,
      actorId: primaryActor.id,
      startMs: draft.startMs,
      resource: draft.resource || 'sp',
      change: draft.change,
      reason: draft.reason || 'manual-axis-resource',
      note: draft.note,
    });
  }

  if (draft.type === ACTION_TYPES.ENEMY_EVENT) {
    return createEnemyEventAction({
      id: draft.id,
      targetId,
      startMs: draft.startMs,
      eventType: draft.eventType || 'phase',
      note: draft.note || '敌人阶段标记',
    });
  }

  const skill = findById(workbenchSeed.gameData.skills, draft.skillId);
  const actor = actorsByCharacterId.get(Number(skill.characterId)) ?? primaryActor;
  return createSkillAction({
    id: draft.id,
    actorId: actor.id,
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
  if (type === ACTION_TYPES.RESOURCE) {
    return '资源事件';
  }
  if (type === ACTION_TYPES.ENEMY_EVENT) {
    return '敌人事件';
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
    ACTION_TYPES.ENEMY_EVENT,
  ].includes(type);
}

function clampLevel(level, skill) {
  const maxLevel = Math.max(1, skill?.level?.values?.length ?? 1);
  return Math.min(maxLevel, Math.max(1, Number(level) || 1));
}

function createSkillLevelsForCharacter(skillDrafts, characterId) {
  return Object.fromEntries(
    skillDrafts
      .map((draft) => [findById(workbenchSeed.gameData.skills, draft.skillId), draft.level])
      .filter(([skill]) => skill?.characterId === Number(characterId))
      .map(([skill, level]) => [skill.id, level]),
  );
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

function findById(items, id) {
  return items.find((item) => item.id === Number(id)) ?? null;
}
