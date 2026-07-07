<template>
  <main class="workbench">
    <nav class="top-nav">
      <RouterLink class="back-link" to="/">
        <ArrowLeft class="nav-icon" />
        <span>首页</span>
      </RouterLink>
      <div class="nav-side">
        <div class="nav-status">
          <span>真实数据</span>
          <span>Schema v{{ project.schemaVersion }}</span>
          <span>{{ simulationResult.summary.formulaVersion }}</span>
        </div>
        <div class="nav-actions">
          <span class="draft-status" data-testid="workbench-draft-status">{{ draftStatus }}</span>
          <button class="nav-button" data-testid="workbench-save-draft" type="button" @click="saveDraft">
            <Document class="button-icon" />
            <span>保存草稿</span>
          </button>
          <button class="nav-button secondary" data-testid="workbench-reset-draft" type="button" @click="resetDraft">
            <Refresh class="button-icon" />
            <span>重置</span>
          </button>
        </div>
      </div>
    </nav>

    <ScenarioHeader
      :project="project"
      :scenario="simulationResult.scenario"
      :summary="simulationResult.summary"
    />

    <div class="workbench-grid">
      <ActionLibraryPanel
        :actor="actionLibraryActor"
        :actors="scenario.actors"
        :active-actor-character-id="actionLibraryCharacterId"
        :actions="scenario.actions"
        :skills="actionLibrarySkills"
        :selected-action-id="selectedActionId"
        @select-action="selectAction"
        @add-action="addAction"
        @add-skill-action="addSkillAction"
        @add-annotation-action="addAnnotationAction"
        @add-enemy-event-action="addEnemyEventAction"
        @add-resource-action="addResourceAction"
        @add-switch-action="addSwitchAction"
        @add-wait-action="addWaitAction"
        @copy-action="copyAction"
        @delete-action="deleteAction"
        @update-active-actor="setActionLibraryCharacterId"
      />

      <TimelineGridPreview
        class="timeline-area"
        :actors="scenario.actors"
        :actions="scenario.actions"
        :damage-timeline="simulationResult.damageTimeline"
        :duration-ms="scenario.time.durationMs"
        :selected-action-id="selectedActionId"
        :timeline-diagnostics="timelineDiagnostics"
        @select-action="selectAction"
        @delete-action="deleteAction"
        @update-action-duration="updateActionDuration"
        @update-action-lane="updateActionLane"
        @update-action-time="updateActionTime"
      />

      <div class="side-stack">
        <PropertiesPanel
          :selection="selection"
          :characters="workbenchSeed.gameData.characters"
          :actors="scenario.actors"
          :skills="workbenchSeed.gameData.skills"
          :enemies="workbenchSeed.gameData.enemies"
          :selected-action="selectedAction"
          :duration-ms="scenario.time.durationMs"
          @update-selection="updateSelection"
          @update-action="updateAction"
        />

        <EnemyPanel
          :enemy="scenario.enemy"
          :enemy-config="enemyConfig"
          @update-enemy-config="updateEnemyConfig"
        />

        <ResourceMonitorPanel
          :resource-timeline="simulationResult.resourceTimeline"
          :summary="simulationResult.summary"
          :diagnostics="simulationResult.diagnostics"
        />

        <AnalysisPanel
          :summary="simulationResult.summary"
          :diagnostics="simulationResult.diagnostics"
          :damage-timeline="simulationResult.damageTimeline"
          :timeline-diagnostics="timelineDiagnostics"
        />
      </div>

      <EventLogPanel
        class="event-area"
        :event-log="simulationResult.eventLog"
      />
    </div>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { ArrowLeft, Document, Refresh } from '@element-plus/icons-vue';
import ActionLibraryPanel from '../features/workbench/ActionLibraryPanel.vue';
import AnalysisPanel from '../features/workbench/AnalysisPanel.vue';
import EnemyPanel from '../features/workbench/EnemyPanel.vue';
import EventLogPanel from '../features/workbench/EventLogPanel.vue';
import PropertiesPanel from '../features/workbench/PropertiesPanel.vue';
import ResourceMonitorPanel from '../features/workbench/ResourceMonitorPanel.vue';
import ScenarioHeader from '../features/workbench/ScenarioHeader.vue';
import TimelineGridPreview from '../features/workbench/TimelineGridPreview.vue';
import { createTimelineDiagnostics } from '../features/workbench/timelineDiagnostics';
import {
  DEFAULT_WORKBENCH_SELECTION,
  createWorkbenchActionDraft,
  createWorkbenchProject,
  getSkillsForCharacter,
  getWorkbenchGameData,
  getWorkbenchSeed,
  normalizeWorkbenchActionDrafts,
  normalizeWorkbenchEnemyConfig,
  normalizeWorkbenchSelection,
} from '../domain/workbenchProjectFactory';
import { ACTION_TYPES } from '../domain/projectSchema';
import {
  clearWorkbenchDraft,
  createDefaultWorkbenchDraftState,
  loadWorkbenchDraft,
  saveWorkbenchDraft,
} from '../domain/workbenchDraftStorage';
import { compileProject } from '../simulation/compiler/compileProject';
import { simulateScenario } from '../simulation/engine/simulateScenario';

const workbenchSeed = getWorkbenchSeed();
const gameData = getWorkbenchGameData();
const NEW_ACTION_INSERT_GAP_MS = 1000;
const initialDraft = createDefaultWorkbenchDraftState();
const selection = ref({ ...initialDraft.selection });
const enemyConfig = ref({ ...initialDraft.enemyConfig });
const actionDrafts = ref([...initialDraft.actionDrafts]);
const selectedActionId = ref(initialDraft.selectedActionId);
const actionLibraryCharacterId = ref(initialDraft.selection.characterId);
const draftStatus = ref('未保存草稿');

const project = computed(() =>
  createWorkbenchProject(selection.value, {
    enemyConfig: enemyConfig.value,
    actions: actionDrafts.value,
  }),
);
const scenario = computed(() => compileProject(project.value, gameData));
const simulationResult = computed(() => simulateScenario(scenario.value));
const timelineDiagnostics = computed(() =>
  createTimelineDiagnostics({
    actors: scenario.value.actors,
    actions: scenario.value.actions,
  }),
);
const actionLibraryActor = computed(() => {
  return (
    scenario.value.actors.find((actor) => Number(actor.characterId) === Number(actionLibraryCharacterId.value)) ??
    scenario.value.actors[0]
  );
});
const actionLibrarySkills = computed(() => getSkillsForCharacter(actionLibraryActor.value?.characterId));
const selectedAction = computed(() => {
  return scenario.value.actions.find((action) => action.id === selectedActionId.value) ?? scenario.value.actions[0];
});
const selectedDraft = computed(() => {
  return actionDrafts.value.find((action) => action.id === selectedActionId.value) ?? actionDrafts.value[0];
});

onMounted(() => {
  const draft = loadWorkbenchDraft(getLocalStorage());
  if (!draft) {
    return;
  }

  applyDraftState(draft);
  draftStatus.value = '已恢复草稿';
});

function updateSelection(patch) {
  const previousSelection = selection.value;
  const characterChanged =
    patch.characterId != null && Number(patch.characterId) !== Number(selection.value.characterId);
  const secondaryCharacterChanged =
    patch.secondaryCharacterId != null &&
    Number(patch.secondaryCharacterId) !== Number(selection.value.secondaryCharacterId);
  const nextSelection = normalizeWorkbenchSelection({
    ...selection.value,
    ...patch,
  });
  selection.value = nextSelection;

  normalizeActionLibraryCharacterId(previousSelection, nextSelection, {
    characterChanged,
    secondaryCharacterChanged,
  });

  if (characterChanged || secondaryCharacterChanged) {
    const nextActionDrafts = actionDrafts.value.map((action) => {
      const nextAction = { ...action };
      if (characterChanged && Number(nextAction.actorCharacterId) === Number(previousSelection.characterId)) {
        nextAction.actorCharacterId = nextSelection.characterId;
      }
      if (
        secondaryCharacterChanged &&
        Number(nextAction.actorCharacterId) === Number(previousSelection.secondaryCharacterId)
      ) {
        nextAction.actorCharacterId = nextSelection.secondaryCharacterId;
      }
      if (secondaryCharacterChanged && nextAction.type === ACTION_TYPES.SWITCH) {
        nextAction.targetCharacterId = nextSelection.secondaryCharacterId;
      }
      return nextAction;
    });
    actionDrafts.value = normalizeWorkbenchActionDrafts(nextActionDrafts, nextSelection);
  }

  if (characterChanged) {
    selectedActionId.value = actionDrafts.value[0].id;
  }

  markDraftDirty();
}

function updateAction(patch) {
  actionDrafts.value = actionDrafts.value.map((action) => {
    if (action.id !== selectedActionId.value) {
      return action;
    }

    const normalizedPatch = normalizeActionPatch(action, patch);
    if (action.type !== ACTION_TYPES.SKILL) {
      return createWorkbenchActionDraft({
        ...action,
        ...normalizedPatch,
        startMs: clampNumber(normalizedPatch.startMs ?? action.startMs, 0, project.value.time.durationMs),
        durationMs: clampNumber(normalizedPatch.durationMs ?? action.durationMs, 1, project.value.time.durationMs),
      });
    }

    const nextActorCharacterId = Number(
      normalizedPatch.actorCharacterId ?? action.actorCharacterId ?? selection.value.characterId,
    );
    const skill = resolveSkillForActionPatch(action, normalizedPatch, nextActorCharacterId);
    const skillChanged = Number(skill.id) !== Number(action.skillId);
    const nextLevel = skillChanged ? 1 : normalizedPatch.level ?? action.level;

    return createWorkbenchActionDraft({
      ...action,
      ...normalizedPatch,
      skillId: skill.id,
      actorCharacterId: nextActorCharacterId,
      startMs: clampNumber(normalizedPatch.startMs ?? action.startMs, 0, project.value.time.durationMs),
      level: clampNumber(nextLevel, 1, skill.level.values.length),
    });
  });
  if (patch.actorCharacterId != null) {
    setActionLibraryCharacterId(patch.actorCharacterId);
  }
  markDraftDirty();
}

function updateEnemyConfig(patch) {
  enemyConfig.value = normalizeWorkbenchEnemyConfig({
    ...enemyConfig.value,
    ...patch,
  });
  markDraftDirty();
}

function updateActionTime({ actionId, startMs }) {
  selectedActionId.value = actionId;
  actionDrafts.value = actionDrafts.value.map((action) => {
    if (action.id !== actionId) {
      return action;
    }

    return createWorkbenchActionDraft({
      ...action,
      startMs: clampNumber(startMs, 0, project.value.time.durationMs),
    });
  });
  markDraftDirty();
}

function updateActionDuration({ actionId, durationMs }) {
  selectedActionId.value = actionId;
  actionDrafts.value = actionDrafts.value.map((action) => {
    if (action.id !== actionId) {
      return action;
    }

    return createWorkbenchActionDraft({
      ...action,
      durationMs: clampNumber(durationMs, 1, Math.max(1, project.value.time.durationMs - action.startMs)),
    });
  });
  markDraftDirty();
}

function updateActionLane({ actionId, laneId }) {
  const targetActor = scenario.value.actors.find((actor) => actor.id === laneId);
  if (!targetActor) {
    return;
  }

  let didUpdate = false;
  selectedActionId.value = actionId;
  actionDrafts.value = actionDrafts.value.map((action) => {
    if (action.id !== actionId || !canAssignActionLane(action)) {
      return action;
    }

    const targetCharacterId = Number(targetActor.characterId);
    if (Number(action.actorCharacterId) === targetCharacterId) {
      return action;
    }

    const patch = {
      actorCharacterId: targetCharacterId,
    };

    if (action.type === ACTION_TYPES.SKILL) {
      const currentSkill = findSkillById(action.skillId);
      if (Number(currentSkill?.characterId) !== targetCharacterId) {
        const nextSkill = findFirstSkillForCharacter(targetCharacterId);
        if (nextSkill) {
          patch.skillId = nextSkill.id;
          patch.level = 1;
        }
      }
    }

    if (action.type === ACTION_TYPES.SWITCH && Number(action.targetCharacterId) === targetCharacterId) {
      patch.targetCharacterId = resolveAlternateActorCharacterId(targetCharacterId);
    }

    didUpdate = true;
    actionLibraryCharacterId.value = targetCharacterId;
    return createWorkbenchActionDraft({
      ...action,
      ...patch,
    });
  });

  if (didUpdate) {
    markDraftDirty();
  }
}

function addAction() {
  const actorCharacterId = Number(actionLibraryActor.value?.characterId ?? selectedDraft.value.actorCharacterId);
  addSkillAction(resolveContextSkill(actorCharacterId, selectedDraft.value.skillId).id);
}

function addSkillAction(skillId) {
  const actorCharacterId = Number(actionLibraryActor.value?.characterId ?? selectedDraft.value.actorCharacterId);
  const skill = resolveContextSkill(actorCharacterId, skillId);
  const shouldInheritLevel =
    Number(selectedDraft.value.actorCharacterId) === actorCharacterId &&
    Number(selectedDraft.value.skillId) === Number(skill.id);
  addInsertedAction({
    id: createNextActionId(),
    skillId: skill.id,
    actorCharacterId,
    level: shouldInheritLevel ? selectedDraft.value.level : 1,
  });
}

function addWaitAction() {
  addInsertedAction({
    id: createNextActionId(),
    type: ACTION_TYPES.WAIT,
    skillId: selectedDraft.value.skillId,
    actorCharacterId: actionLibraryCharacterId.value,
    durationMs: 1000,
    level: selectedDraft.value.level,
    note: '等待窗口',
  });
}

function addSwitchAction() {
  const actorCharacterId = Number(actionLibraryActor.value?.characterId ?? selectedDraft.value.actorCharacterId);
  addInsertedAction({
    id: createNextActionId(),
    type: ACTION_TYPES.SWITCH,
    skillId: selectedDraft.value.skillId,
    actorCharacterId,
    durationMs: 600,
    level: selectedDraft.value.level,
    targetCharacterId: resolveAlternateActorCharacterId(actorCharacterId),
    note: '切换至副角色',
  });
}

function addAnnotationAction() {
  addInsertedAction({
    id: createNextActionId(),
    type: ACTION_TYPES.ANNOTATION,
    skillId: selectedDraft.value.skillId,
    actorCharacterId: actionLibraryCharacterId.value,
    durationMs: 600,
    level: selectedDraft.value.level,
    note: '备注',
  });
}

function addResourceAction() {
  const actorCharacterId = Number(actionLibraryActor.value?.characterId ?? selectedDraft.value.actorCharacterId);
  addInsertedAction({
    id: createNextActionId(),
    type: ACTION_TYPES.RESOURCE,
    skillId: selectedDraft.value.skillId,
    actorCharacterId,
    durationMs: 600,
    level: selectedDraft.value.level,
    resource: 'sp',
    change: 50,
    reason: 'manual-axis-resource',
    note: '手动资源变化',
  });
}

function addEnemyEventAction() {
  addInsertedAction({
    id: createNextActionId(),
    type: ACTION_TYPES.ENEMY_EVENT,
    skillId: selectedDraft.value.skillId,
    actorCharacterId: actionLibraryCharacterId.value,
    durationMs: 600,
    level: selectedDraft.value.level,
    eventType: 'phase',
    note: '敌人阶段标记',
  });
}

function copyAction(actionId) {
  const sourceIndex = actionDrafts.value.findIndex((action) => action.id === actionId);
  const sourceAction = actionDrafts.value[sourceIndex];
  if (!sourceAction) {
    return;
  }

  const nextAction = createWorkbenchActionDraft({
    ...sourceAction,
    id: createNextActionId(),
    startMs: clampNumber(sourceAction.startMs + 1000, 0, project.value.time.durationMs),
  });
  actionDrafts.value = [
    ...actionDrafts.value.slice(0, sourceIndex + 1),
    nextAction,
    ...actionDrafts.value.slice(sourceIndex + 1),
  ];
  selectedActionId.value = nextAction.id;
  syncActionLibraryCharacterIdFromDraft(nextAction);
  markDraftDirty();
}

function deleteAction(actionId) {
  if (actionDrafts.value.length <= 1) {
    return;
  }

  const index = actionDrafts.value.findIndex((action) => action.id === actionId);
  if (index < 0) {
    return;
  }

  actionDrafts.value = actionDrafts.value.filter((action) => action.id !== actionId);

  if (selectedActionId.value === actionId) {
    const nextIndex = Math.min(index, actionDrafts.value.length - 1);
    selectedActionId.value = actionDrafts.value[nextIndex].id;
    syncActionLibraryCharacterIdFromDraft(actionDrafts.value[nextIndex]);
  }
  markDraftDirty();
}

function saveDraft() {
  const snapshot = saveWorkbenchDraft(getLocalStorage(), {
    selection: selection.value,
    enemyConfig: enemyConfig.value,
    actionDrafts: actionDrafts.value,
    selectedActionId: selectedActionId.value,
  });
  draftStatus.value = snapshot ? '已保存草稿' : '草稿不可用';
}

function resetDraft() {
  clearWorkbenchDraft(getLocalStorage());
  applyDraftState(createDefaultWorkbenchDraftState());
  draftStatus.value = '已重置草稿';
}

function applyDraftState(draft) {
  selection.value = { ...draft.selection };
  enemyConfig.value = normalizeWorkbenchEnemyConfig(draft.enemyConfig);
  actionDrafts.value = normalizeWorkbenchActionDrafts(draft.actionDrafts, selection.value);
  selectedActionId.value = draft.selectedActionId;
  syncActionLibraryCharacterIdFromDraft(actionDrafts.value.find((action) => action.id === draft.selectedActionId));
}

function markDraftDirty() {
  draftStatus.value = '有未保存改动';
}

function selectAction(actionId) {
  selectedActionId.value = actionId;
  const draft = actionDrafts.value.find((action) => action.id === actionId);
  syncActionLibraryCharacterIdFromDraft(draft);
}

function findSkillById(skillId) {
  return workbenchSeed.gameData.skills.find((skill) => skill.id === Number(skillId)) ?? null;
}

function createNextActionId() {
  const maxIndex = actionDrafts.value.reduce((max, action) => {
    const match = String(action.id).match(/^action-(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `action-${String(maxIndex + 1).padStart(4, '0')}`;
}

function addInsertedAction(actionPatch) {
  const insertIndex = resolveInsertIndex();
  const nextAction = createWorkbenchActionDraft({
    ...actionPatch,
    startMs: resolveInsertStartMs(insertIndex),
  });
  actionDrafts.value = [
    ...actionDrafts.value.slice(0, insertIndex),
    nextAction,
    ...actionDrafts.value.slice(insertIndex),
  ];
  selectedActionId.value = nextAction.id;
  markDraftDirty();
}

function resolveInsertStartMs(insertIndex) {
  const anchor =
    actionDrafts.value[Math.max(0, insertIndex - 1)] ?? actionDrafts.value[actionDrafts.value.length - 1];
  if (!anchor) {
    return 0;
  }
  const anchorStartMs = Number(anchor.startMs) || 0;
  const anchorDurationMs = Math.max(0, Number(anchor.durationMs) || 0);
  return clampNumber(anchorStartMs + anchorDurationMs + NEW_ACTION_INSERT_GAP_MS, 0, project.value.time.durationMs);
}

function resolveInsertIndex() {
  const selectedIndex = actionDrafts.value.findIndex((action) => action.id === selectedActionId.value);
  return selectedIndex >= 0 ? selectedIndex + 1 : actionDrafts.value.length;
}

function canAssignActionLane(action) {
  return [ACTION_TYPES.SKILL, ACTION_TYPES.SWITCH, ACTION_TYPES.RESOURCE].includes(action.type);
}

function setActionLibraryCharacterId(characterId) {
  const actor = scenario.value.actors.find((item) => Number(item.characterId) === Number(characterId));
  if (!actor) {
    return;
  }
  actionLibraryCharacterId.value = Number(actor.characterId);
}

function normalizeActionLibraryCharacterId(previousSelection, nextSelection, changes) {
  if (changes.characterChanged && Number(actionLibraryCharacterId.value) === Number(previousSelection.characterId)) {
    actionLibraryCharacterId.value = nextSelection.characterId;
  }
  if (
    changes.secondaryCharacterChanged &&
    Number(actionLibraryCharacterId.value) === Number(previousSelection.secondaryCharacterId)
  ) {
    actionLibraryCharacterId.value = nextSelection.secondaryCharacterId;
  }

  if (
    Number(actionLibraryCharacterId.value) !== Number(nextSelection.characterId) &&
    Number(actionLibraryCharacterId.value) !== Number(nextSelection.secondaryCharacterId)
  ) {
    actionLibraryCharacterId.value = nextSelection.characterId;
  }
}

function syncActionLibraryCharacterIdFromDraft(draft) {
  if (!draft || !canAssignActionLane(draft)) {
    return;
  }
  setActionLibraryCharacterId(draft.actorCharacterId);
}

function resolveContextSkill(actorCharacterId, preferredSkillId) {
  const preferredSkill = findSkillById(preferredSkillId);
  if (Number(preferredSkill?.characterId) === Number(actorCharacterId)) {
    return preferredSkill;
  }
  return findFirstSkillForCharacter(actorCharacterId) ?? preferredSkill ?? workbenchSeed.gameData.skills[0];
}

function normalizeActionPatch(action, patch) {
  const normalizedPatch = { ...patch };
  if (normalizedPatch.actorCharacterId != null) {
    normalizedPatch.actorCharacterId = Number(normalizedPatch.actorCharacterId);

    if (action.type === ACTION_TYPES.SWITCH && Number(action.targetCharacterId) === normalizedPatch.actorCharacterId) {
      normalizedPatch.targetCharacterId = resolveAlternateActorCharacterId(normalizedPatch.actorCharacterId);
    }
  }
  return normalizedPatch;
}

function resolveSkillForActionPatch(action, patch, actorCharacterId) {
  const requestedSkill = findSkillById(patch.skillId ?? action.skillId) ?? findSkillById(action.skillId);
  if (patch.actorCharacterId != null && Number(requestedSkill?.characterId) !== Number(actorCharacterId)) {
    return findFirstSkillForCharacter(actorCharacterId) ?? requestedSkill;
  }
  return requestedSkill ?? findFirstSkillForCharacter(actorCharacterId);
}

function findFirstSkillForCharacter(characterId) {
  return getSkillsForCharacter(characterId)[0] ?? null;
}

function resolveAlternateActorCharacterId(sourceCharacterId) {
  return (
    scenario.value.actors.find((actor) => Number(actor.characterId) !== Number(sourceCharacterId))?.characterId ??
    selection.value.characterId
  );
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return min;
  }
  return Math.min(max, Math.max(min, number));
}

function getLocalStorage() {
  return typeof window === 'undefined' ? null : window.localStorage;
}
</script>

<style scoped>
.workbench {
  min-height: 100vh;
  background: #11161b;
  color: #ffffff;
}

.top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-height: 48px;
  padding: 0 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: #101419;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #d9dee3;
  font-weight: 700;
}

.back-link:hover {
  color: #79c7b9;
}

.nav-icon {
  width: 16px;
  height: 16px;
}

.nav-status {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.nav-status span {
  padding: 3px 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  color: #b8c0c7;
  font-size: 12px;
}

.nav-side {
  display: grid;
  justify-items: end;
  gap: 8px;
}

.nav-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.draft-status {
  color: #8f9aa3;
  font-size: 12px;
}

.nav-button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 9px;
  border: 1px solid rgba(121, 199, 185, 0.38);
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.12);
  color: #dff6f1;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.nav-button.secondary {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: #d9dee3;
}

.nav-button:hover {
  filter: brightness(1.16);
}

.button-icon {
  width: 14px;
  height: 14px;
}

.workbench-grid {
  display: grid;
  grid-template-columns: minmax(230px, 280px) minmax(0, 1fr) minmax(260px, 340px);
  grid-template-areas:
    "actions timeline analysis"
    "actions events analysis";
  gap: 14px;
  padding: 14px;
}

.action-library {
  grid-area: actions;
}

.timeline-area {
  grid-area: timeline;
}

.side-stack {
  grid-area: analysis;
  display: grid;
  align-content: start;
  gap: 14px;
}

.event-area {
  grid-area: events;
}

@media (max-width: 1100px) {
  .workbench-grid {
    grid-template-columns: minmax(220px, 300px) minmax(0, 1fr);
    grid-template-areas:
      "actions timeline"
      "analysis events";
  }
}

@media (max-width: 760px) {
  .top-nav {
    align-items: flex-start;
    flex-direction: column;
    padding: 12px 16px;
  }

  .nav-status {
    justify-content: flex-start;
  }

  .nav-side {
    justify-items: start;
  }

  .nav-actions {
    justify-content: flex-start;
  }

  .workbench-grid {
    grid-template-columns: 1fr;
    grid-template-areas:
      "actions"
      "timeline"
      "analysis"
      "events";
    padding: 10px;
  }
}
</style>
