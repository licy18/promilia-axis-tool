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
      />

      <TimelineGridPreview
        class="timeline-area"
        :actions="scenario.actions"
        :damage-timeline="simulationResult.damageTimeline"
        :duration-ms="scenario.time.durationMs"
      />

      <AnalysisPanel
        :summary="simulationResult.summary"
        :diagnostics="simulationResult.diagnostics"
        :damage-timeline="simulationResult.damageTimeline"
      />

      <EventLogPanel
        class="event-area"
        :event-log="simulationResult.eventLog"
      />
    </div>
  </main>
</template>

<script setup>
import { computed, shallowRef } from 'vue';
import { ArrowLeft } from '@element-plus/icons-vue';
import ActionLibraryPanel from '../features/workbench/ActionLibraryPanel.vue';
import AnalysisPanel from '../features/workbench/AnalysisPanel.vue';
import EventLogPanel from '../features/workbench/EventLogPanel.vue';
import ScenarioHeader from '../features/workbench/ScenarioHeader.vue';
import TimelineGridPreview from '../features/workbench/TimelineGridPreview.vue';
import {
  createFirstVerticalSliceProject,
  getFirstVerticalSliceGameData,
} from '../domain/fixtures/firstVerticalSlice';
import { compileProject } from '../simulation/compiler/compileProject';
import { simulateScenario } from '../simulation/engine/simulateScenario';

const project = shallowRef(createFirstVerticalSliceProject());
const gameData = getFirstVerticalSliceGameData();
const scenario = computed(() => compileProject(project.value, gameData));
const simulationResult = computed(() => simulateScenario(scenario.value));
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

.analysis-panel {
  grid-area: analysis;
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
