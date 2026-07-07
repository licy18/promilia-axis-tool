import workbenchSeed from '../data/generated/workbench-seed.json';
import { WORKBENCH_FRAME_MS, snapMsToFrame } from './timebase';
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
import { getSkillActionCatalog } from './skillActionCatalog';
import { getSkillActionVariants, getSkillDamageSegments } from './skillDamageSegments';

export { getSkillActionCatalog } from './skillActionCatalog';
export { getSkillActionVariants, getSkillDamageSegments } from './skillDamageSegments';

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
  note = '',
  insertion = null,
  generationBatch = null,
} = {}) {
  const normalizedActionVariantIndex = Math.max(0, Number(actionVariantIndex ?? damageSegmentIndex) || 0);
  return {
    id,
    type,
    skillId: Number(skillId),
    actorCharacterId: Number(actorCharacterId) || DEFAULT_WORKBENCH_SELECTION.characterId,
    startMs: Math.max(0, snapMsToFrame(Number(startMs) || 0)),
    durationMs: Math.max(WORKBENCH_FRAME_MS, snapMsToFrame(Number(durationMs) || 1000)),
    level: Math.max(1, Number(level) || 1),
    actionVariantIndex: normalizedActionVariantIndex,
    damageSegmentIndex: normalizedActionVariantIndex,
    targetCharacterId: Number(targetCharacterId) || DEFAULT_WORKBENCH_SELECTION.secondaryCharacterId,
    resource,
    change: Number(change) || 0,
    reason,
    eventType,
    note,
    insertion: normalizeWorkbenchInsertion(insertion),
    generationBatch: normalizeWorkbenchGenerationBatch(generationBatch),
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
  const primarySkills = getSkillsForCharacter(selection.characterId);
  const primaryFallbackSkill = primarySkills[0] ?? workbenchSeed.gameData.skills[0];

  return actionDrafts
    .map((draft, index) => {
      const actorCharacterId = normalizeActorCharacterId(draft.actorCharacterId, selection);
      const actorSkills = getSkillsForCharacter(actorCharacterId);
      const fallbackSkill = actorSkills[0] ?? primaryFallbackSkill;

      if (isNonSkillDraftType(draft.type)) {
        return createWorkbenchActionDraft({
          id: draft.id ?? `action-${String(index + 1).padStart(4, '0')}`,
          type: draft.type,
          skillId: draft.skillId ?? fallbackSkill.id,
          actorCharacterId,
          startMs: draft.startMs,
          durationMs: draft.durationMs,
          level: draft.level,
          damageSegmentIndex: draft.damageSegmentIndex,
          actionVariantIndex: draft.actionVariantIndex,
          targetCharacterId: draft.targetCharacterId ?? selection.secondaryCharacterId,
          resource: draft.resource,
          change: draft.change,
          reason: draft.reason,
          eventType: draft.eventType,
          note: draft.note,
          insertion: draft.insertion,
          generationBatch: draft.generationBatch,
        });
      }

      const requestedSkill = findById(actorSkills, draft.skillId);
      const skill = requestedSkill ?? fallbackSkill;
      return createWorkbenchActionDraft({
        id: draft.id ?? `action-${String(index + 1).padStart(4, '0')}`,
        type: ACTION_TYPES.SKILL,
        skillId: skill.id,
        actorCharacterId,
        startMs: draft.startMs,
        durationMs: draft.durationMs,
        level: clampLevel(draft.level, skill),
        actionVariantIndex: clampActionVariantIndex(
          draft.actionVariantIndex ?? draft.damageSegmentIndex,
          skill,
          draft.level,
        ),
        targetCharacterId: draft.targetCharacterId ?? selection.secondaryCharacterId,
        resource: draft.resource,
        change: draft.change,
        reason: draft.reason,
        eventType: draft.eventType,
        note: draft.note,
        insertion: draft.insertion,
        generationBatch: draft.generationBatch,
      });
    })
    .filter((draft) => draft.type !== ACTION_TYPES.SKILL || findById(workbenchSeed.gameData.skills, draft.skillId));
}

function createProjectActionFromDraft(draft, actorsByCharacterId, primaryCharacterId, targetId) {
  const primaryActor = actorsByCharacterId.get(Number(primaryCharacterId)) ?? [...actorsByCharacterId.values()][0];
  const sourceActor = resolveActorFromDraft(draft, actorsByCharacterId, primaryActor);

  if (draft.type === ACTION_TYPES.SWITCH) {
    const targetActor = resolveSwitchTargetActor(draft, actorsByCharacterId, sourceActor);
    return createSwitchAction({
      id: draft.id,
      actorId: sourceActor.id,
      targetActorId: targetActor.id,
      targetCharacterId: targetActor.characterId,
      startMs: draft.startMs,
      durationMs: draft.durationMs,
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
    });
  }

  if (draft.type === ACTION_TYPES.ANNOTATION) {
    return createAnnotationAction({
      id: draft.id,
      startMs: draft.startMs,
      note: draft.note || '备注',
      insertion: draft.insertion,
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
    });
  }

  const skill = findById(workbenchSeed.gameData.skills, draft.skillId);
  const actor = sourceActor ?? actorsByCharacterId.get(Number(skill.characterId)) ?? primaryActor;
  return createSkillAction({
    id: draft.id,
    actorId: actor.id,
    skill,
    targetId,
    startMs: draft.startMs,
    durationMs: draft.durationMs,
    level: draft.level,
    actionVariantIndex: draft.actionVariantIndex ?? draft.damageSegmentIndex,
    damageSegmentIndex: draft.actionVariantIndex ?? draft.damageSegmentIndex,
    note: draft.note || '工作台可编辑动作；精确命中帧等待 asset 或运行时捕获补充。',
    insertion: draft.insertion,
    generationBatch: draft.generationBatch,
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

function normalizeActorCharacterId(actorCharacterId, selection) {
  const id = Number(actorCharacterId);
  if (id === Number(selection.characterId) || id === Number(selection.secondaryCharacterId)) {
    return id;
  }
  return selection.characterId;
}

function resolveActorFromDraft(draft, actorsByCharacterId, fallbackActor) {
  return actorsByCharacterId.get(Number(draft.actorCharacterId)) ?? fallbackActor;
}

function resolveSwitchTargetActor(draft, actorsByCharacterId, sourceActor) {
  const requestedTarget = actorsByCharacterId.get(Number(draft.targetCharacterId));
  if (requestedTarget && requestedTarget.id !== sourceActor.id) {
    return requestedTarget;
  }

  return [...actorsByCharacterId.values()].find((actor) => actor.id !== sourceActor.id) ?? sourceActor;
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
  return Math.min(segmentCount - 1, Math.max(0, Number(actionVariantIndex) || 0));
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
      ? insertion.conflictActionIds.map((id) => String(id))
      : [],
  };
}

function normalizeWorkbenchGenerationBatch(generationBatch) {
  if (!generationBatch || typeof generationBatch !== 'object') {
    return null;
  }

  const batchId = generationBatch.batchId ? String(generationBatch.batchId) : '';
  if (!batchId) {
    return null;
  }

  return {
    batchId,
    source: generationBatch.source ? String(generationBatch.source) : 'skill-action-variant-split',
    skillId: Number(generationBatch.skillId) || null,
    actorCharacterId: Number(generationBatch.actorCharacterId) || null,
    level: Math.max(1, Number(generationBatch.level) || 1),
    variantCount: Math.max(1, Number(generationBatch.variantCount ?? generationBatch.segmentCount) || 1),
    segmentCount: Math.max(1, Number(generationBatch.variantCount ?? generationBatch.segmentCount) || 1),
    createdAt: generationBatch.createdAt ? String(generationBatch.createdAt) : null,
  };
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
