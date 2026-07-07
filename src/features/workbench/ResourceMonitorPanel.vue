<template>
  <section class="panel resource-monitor-panel">
    <div class="panel-title">
      <TrendCharts class="panel-icon" />
      <h2>资源</h2>
    </div>

    <div class="resource-summary">
      <div>
        <span>事件</span>
        <strong data-testid="workbench-resource-event-count">{{ resourceTimeline.length }}</strong>
      </div>
      <div>
        <span>SP 净值</span>
        <strong data-testid="workbench-resource-sp-total">{{ formatSigned(resourceTotals.sp ?? 0) }}</strong>
      </div>
      <div>
        <span>命中</span>
        <strong>{{ summary.projectedHitCount }}</strong>
      </div>
      <div>
        <span>限制</span>
        <strong>{{ diagnostics.limitations.length }}</strong>
      </div>
    </div>

    <ol v-if="resourceTimeline.length" class="resource-list">
      <li v-for="entry in resourceTimeline" :key="`${entry.actionId}-${entry.resource}-${entry.timeMs}`">
        <span class="time">{{ entry.timeMs }}ms</span>
        <span class="resource">{{ entry.resource.toUpperCase() }}</span>
        <strong>{{ formatSigned(entry.change) }}</strong>
      </li>
    </ol>
    <p v-else class="empty-state" data-testid="workbench-resource-empty">暂无资源事件</p>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { TrendCharts } from '@element-plus/icons-vue';

const props = defineProps({
  resourceTimeline: {
    type: Array,
    required: true,
  },
  summary: {
    type: Object,
    required: true,
  },
  diagnostics: {
    type: Object,
    required: true,
  },
});

const resourceTotals = computed(() => {
  return props.resourceTimeline.reduce((totals, entry) => {
    totals[entry.resource] = (totals[entry.resource] ?? 0) + entry.change;
    return totals;
  }, {});
});

function formatSigned(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? '+' : ''}${number}`;
}
</script>

<style scoped>
.panel {
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 6px;
  background: #1c2228;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.panel-icon {
  width: 17px;
  height: 17px;
  color: #79c7b9;
}

h2 {
  margin: 0;
  font-size: 15px;
}

.resource-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 14px;
}

.resource-summary div {
  min-width: 0;
  padding: 9px 10px;
  border-radius: 4px;
  background: #232a31;
}

.resource-summary span {
  display: block;
  margin-bottom: 4px;
  color: #8f9aa3;
  font-size: 12px;
}

.resource-summary strong {
  display: block;
  color: #ffffff;
  font-size: 15px;
}

.resource-list {
  display: grid;
  gap: 8px;
  max-height: 180px;
  margin: 0;
  padding: 0 14px 14px;
  overflow: auto;
  list-style: none;
}

li {
  display: grid;
  grid-template-columns: 72px minmax(60px, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.1);
  font-size: 12px;
}

.time {
  color: #8f9aa3;
  font-variant-numeric: tabular-nums;
}

.resource {
  color: #79c7b9;
  font-weight: 700;
}

li strong {
  color: #ffffff;
}

.empty-state {
  margin: 0;
  padding: 0 14px 16px;
  color: #8f9aa3;
  font-size: 12px;
}
</style>
