<template>
  <main class="workbench">
    <nav class="top-nav">
      <RouterLink class="back-link" to="/">
        <ArrowLeft class="nav-icon" />
        <span>首页</span>
      </RouterLink>
      <div class="nav-status">
        <span>真实数据</span>
        <span>Schema v{{ project.schemaVersion }}</span>
        <span>{{ simulationResult.summary.formulaVersion }}</span>
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
      />

      <TimelineGridPreview
        class="timeline-area"
        :actions="scenario.actions"
        :damage-timeline="simulationResult.damageTimeline"
        :duration-ms="scenario.time.durationMs"
        :selected-action-id="selectedActionId"
        @select-action="selectedActionId = $event"
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
import { computed, ref } from 'vue';
import { ArrowLeft } from '@element-plus/icons-vue';
import ActionLibraryPanel from '../features/workbench/ActionLibraryPanel.vue';
import AnalysisPanel from '../features/workbench/AnalysisPanel.vue';
import EventLogPanel from '../features/workbench/EventLogPanel.vue';
import PropertiesPanel from '../features/workbench/PropertiesPanel.vue';
import ScenarioHeader from '../features/workbench/ScenarioHeader.vue';
import TimelineGridPreview from '../features/workbench/TimelineGridPreview.vue';
import {
  DEFAULT_WORKBENCH_SELECTION,
  createWorkbenchProject,
  getSkillsForCharacter,
  getWorkbenchGameData,
  getWorkbenchSeed,
  normalizeWorkbenchSelection,
} from '../domain/workbenchProjectFactory';
import { compileProject } from '../simulation/compiler/compileProject';
import { simulateScenario } from '../simulation/engine/simulateScenario';

const workbenchSeed = getWorkbenchSeed();
const gameData = getWorkbenchGameData();
const selection = ref({ ...DEFAULT_WORKBENCH_SELECTION });
const actionPatch = ref({
  startMs: 0,
  level: 1,
});
const selectedActionId = ref('action-0001');

const availableSkills = computed(() => getSkillsForCharacter(selection.value.characterId));
const project = computed(() => createWorkbenchProject(selection.value, actionPatch.value));
const scenario = computed(() => compileProject(project.value, gameData));
const simulationResult = computed(() => simulateScenario(scenario.value));
const selectedAction = computed(() => {
  return scenario.value.actions.find((action) => action.id === selectedActionId.value) ?? scenario.value.actions[0];
});

function updateSelection(patch) {
  const previousSkillId = selection.value.skillId;
  const nextSelection = normalizeWorkbenchSelection({
    ...selection.value,
    ...patch,
  });
  selection.value = nextSelection;

  if (nextSelection.skillId !== previousSkillId || patch.characterId != null) {
    actionPatch.value = {
      ...actionPatch.value,
      level: 1,
    };
  }
}

function updateAction(patch) {
  actionPatch.value = {
    ...actionPatch.value,
    ...patch,
    startMs: clampNumber(patch.startMs ?? actionPatch.value.startMs, 0, project.value.time.durationMs),
    level: clampNumber(patch.level ?? actionPatch.value.level, 1, selectedAction.value.source.skill.level.values.length),
  };
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return min;
  }
  return Math.min(max, Math.max(min, number));
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
