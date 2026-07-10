<template>
  <header class="scenario-header">
    <div class="title-block">
      <div class="eyebrow">
        <DataAnalysis class="eyebrow-icon" />
        <span>Stage 4 Workbench</span>
      </div>
      <h1>{{ project.name }}</h1>
      <div class="meta-row">
        <span>{{ scenario.durationMs / 1000 }}s</span>
        <span>{{ scenario.actorCount }} actor</span>
        <span
          :data-executed-action-count="scenario.executedActionCount"
          :data-skipped-action-count="scenario.skippedActionCount"
          data-testid="scenario-action-count"
        >
          <template v-if="scenario.skippedActionCount > 0">
            {{ scenario.executedActionCount }}/{{ scenario.actionCount }} action
          </template>
          <template v-else>{{ scenario.actionCount }} action</template>
        </span>
        <span>{{ scenario.enemyName }}</span>
      </div>
    </div>

    <div class="summary-strip">
      <div class="summary-item">
        <span class="label">Raw Damage</span>
        <strong>{{ formatNumber(summary.totalRawDamage) }}</strong>
      </div>
      <div class="summary-item">
        <span class="label">Hits</span>
        <strong data-testid="scenario-hit-count">{{
          summary.projectedHitCount
        }}</strong>
      </div>
      <div class="summary-item warning">
        <span class="label">Timing Gaps</span>
        <strong>{{ summary.timingMissingActionCount }}</strong>
      </div>
    </div>
  </header>
</template>

<script setup>
import { DataAnalysis } from '@element-plus/icons-vue';

defineProps({
  project: {
    type: Object,
    required: true,
  },
  scenario: {
    type: Object,
    required: true,
  },
  summary: {
    type: Object,
    required: true,
  },
});

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString('zh-CN');
}
</script>

<style scoped>
.scenario-header {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 20px;
  padding: 18px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: #171b20;
}

.title-block {
  min-width: 0;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 8px;
  color: #79c7b9;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

.eyebrow-icon {
  width: 16px;
  height: 16px;
}

h1 {
  margin: 0;
  font-size: 22px;
  line-height: 1.25;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.meta-row span {
  padding: 3px 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  color: #b8c0c7;
  font-size: 12px;
}

.summary-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(104px, 1fr));
  gap: 10px;
  min-width: 380px;
}

.summary-item {
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: #20262c;
}

.summary-item.warning {
  border-color: rgba(230, 162, 60, 0.32);
}

.label {
  display: block;
  margin-bottom: 4px;
  color: #8f9aa3;
  font-size: 12px;
}

strong {
  color: #ffffff;
  font-size: 19px;
}

@media (max-width: 820px) {
  .scenario-header {
    flex-direction: column;
  }

  .summary-strip {
    min-width: 0;
  }
}
</style>
