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
        :actor="scenario.actors[0]"
        :actions="scenario.actions"
        :selected-action-id="selectedActionId"
        @select-action="selectedActionId = $event"
        @add-action="addAction"
        @delete-action="deleteAction"
      />

      <TimelineGridPreview
        class="timeline-area"
        :actions="scenario.actions"
        :damage-timeline="simulationResult.damageTimeline"
        :duration-ms="scenario.time.durationMs"
        :selected-action-id="selectedActionId"
        @select-action="selectedActionId = $event"
        @update-action-time="updateActionTime"
      />

      <div class="side-stack">
        <PropertiesPanel
          :selection="selection"
          :characters="workbenchSeed.gameData.characters"
          :skills="availableSkills"
          :enemies="workbenchSeed.gameData.enemies"
          :selected-action="selectedAction"
          :duration-ms="scenario.time.durationMs"
          @update-selection="updateSelection"
          @update-action="updateAction"
        />

        <AnalysisPanel
          :summary="simulationResult.summary"
          :diagnostics="simulationResult.diagnostics"
          :damage-timeline="simulationResult.damageTimeline"
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
import EventLogPanel from '../features/workbench/EventLogPanel.vue';
import PropertiesPanel from '../features/workbench/PropertiesPanel.vue';
import ScenarioHeader from '../features/workbench/ScenarioHeader.vue';
import TimelineGridPreview from '../features/workbench/TimelineGridPreview.vue';
import {
  DEFAULT_WORKBENCH_SELECTION,
  createWorkbenchActionDraft,
  createWorkbenchProject,
  getSkillsForCharacter,
  getWorkbenchGameData,
  getWorkbenchSeed,
  normalizeWorkbenchActionDrafts,
  normalizeWorkbenchSelection,
} from '../domain/workbenchProjectFactory';
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
const initialDraft = createDefaultWorkbenchDraftState();
const selection = ref({ ...initialDraft.selection });
const actionDrafts = ref([...initialDraft.actionDrafts]);
const selectedActionId = ref(initialDraft.selectedActionId);
const draftStatus = ref('未保存草稿');

const availableSkills = computed(() => getSkillsForCharacter(selection.value.characterId));
const project = computed(() =>
  createWorkbenchProject(selection.value, {
    actions: actionDrafts.value,
  }),
);
const scenario = computed(() => compileProject(project.value, gameData));
const simulationResult = computed(() => simulateScenario(scenario.value));
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
  const characterChanged = patch.characterId != null && Number(patch.characterId) !== selection.value.characterId;
  const nextSelection = normalizeWorkbenchSelection({
    ...selection.value,
    ...patch,
  });
  selection.value = nextSelection;

  if (characterChanged) {
    actionDrafts.value = normalizeWorkbenchActionDrafts(actionDrafts.value, nextSelection.characterId);
    selectedActionId.value = actionDrafts.value[0].id;
  }
}

function updateAction(patch) {
  actionDrafts.value = actionDrafts.value.map((action) => {
    if (action.id !== selectedActionId.value) {
      return action;
    }

    const nextSkillId = patch.skillId ?? action.skillId;
    const skill = findSkillById(nextSkillId) ?? findSkillById(action.skillId);
    const nextLevel = patch.skillId != null ? 1 : patch.level ?? action.level;

    return createWorkbenchActionDraft({
      ...action,
      ...patch,
      skillId: skill.id,
      startMs: clampNumber(patch.startMs ?? action.startMs, 0, project.value.time.durationMs),
      level: clampNumber(nextLevel, 1, skill.level.values.length),
    });
  });
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
}

function addAction() {
  const lastAction = actionDrafts.value[actionDrafts.value.length - 1];
  const nextAction = createWorkbenchActionDraft({
    id: createNextActionId(),
    skillId: selectedDraft.value.skillId,
    startMs: clampNumber((lastAction?.startMs ?? 0) + 2000, 0, project.value.time.durationMs),
    level: selectedDraft.value.level,
  });

  actionDrafts.value = [...actionDrafts.value, nextAction];
  selectedActionId.value = nextAction.id;
}

function deleteAction(actionId) {
  if (actionDrafts.value.length <= 1) {
    return;
  }

  const index = actionDrafts.value.findIndex((action) => action.id === actionId);
  actionDrafts.value = actionDrafts.value.filter((action) => action.id !== actionId);

  if (selectedActionId.value === actionId) {
    const nextIndex = Math.min(index, actionDrafts.value.length - 1);
    selectedActionId.value = actionDrafts.value[nextIndex].id;
  }
}

function saveDraft() {
  const snapshot = saveWorkbenchDraft(getLocalStorage(), {
    selection: selection.value,
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
  actionDrafts.value = draft.actionDrafts.map((action) => createWorkbenchActionDraft(action));
  selectedActionId.value = draft.selectedActionId;
}

function findSkillById(skillId) {
  return availableSkills.value.find((skill) => skill.id === Number(skillId)) ?? null;
}

function createNextActionId() {
  const maxIndex = actionDrafts.value.reduce((max, action) => {
    const match = String(action.id).match(/^action-(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `action-${String(maxIndex + 1).padStart(4, '0')}`;
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
