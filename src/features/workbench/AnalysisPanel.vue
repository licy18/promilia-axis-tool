<template>
  <section class="panel analysis-panel">
    <div class="panel-title">
      <TrendCharts class="panel-icon" />
      <h2>分析</h2>
    </div>

    <div class="metric-grid">
      <div class="metric">
        <span>总原始伤害</span>
        <strong>{{ formatNumber(summary.totalRawDamage) }}</strong>
      </div>
      <div class="metric">
        <span>公式</span>
        <strong>{{ summary.formulaVersion }}</strong>
      </div>
      <div class="metric">
        <span>置信度</span>
        <strong>{{ summary.confidence }}</strong>
      </div>
      <div class="metric">
        <span>命中投影</span>
        <strong>{{ summary.projectedHitCount }}</strong>
      </div>
    </div>

    <div class="damage-list">
      <div v-for="damage in damageTimeline" :key="damage.actionId" class="damage-row">
        <span>{{ damage.segmentLabel }}</span>
        <strong>{{ formatNumber(damage.rawDamage) }}</strong>
      </div>
    </div>

    <div class="timeline-diagnostics">
      <div class="diagnostic-heading">
        <span>时间轴诊断</span>
        <strong data-testid="workbench-overlap-count">{{ overlapCount }}</strong>
      </div>
      <p v-if="overlapItems.length === 0" class="diagnostic-empty" data-testid="workbench-overlap-empty">
        暂无轨道重叠
      </p>
      <ul v-else class="overlap-list">
        <li v-for="item in overlapItems" :key="item.id" data-testid="workbench-overlap-item">
          <span>{{ item.laneName }}</span>
          <strong>{{ item.actionNames.join(' / ') }}</strong>
          <small>{{ formatOverlapRange(item) }}</small>
        </li>
      </ul>
    </div>

    <div class="insertion-diagnostics">
      <div class="diagnostic-heading neutral">
        <span>插入提示</span>
        <strong data-testid="workbench-insert-delay-count">{{ autoDelayedCount }}</strong>
      </div>
      <p v-if="autoDelayedItems.length === 0" class="diagnostic-empty" data-testid="workbench-insert-delay-empty">
        暂无自动推迟
      </p>
      <ul v-else class="insertion-list">
        <li v-for="item in autoDelayedItems" :key="item.id" data-testid="workbench-insert-delay-item">
          <span>{{ item.laneName }}</span>
          <strong>{{ item.actionName }}</strong>
          <small>{{ formatDelayRange(item) }}</small>
        </li>
      </ul>
    </div>

    <ul class="limitations">
      <li v-for="item in diagnostics.limitations" :key="item">{{ item }}</li>
    </ul>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { TrendCharts } from '@element-plus/icons-vue';

const props = defineProps({
  summary: {
    type: Object,
    required: true,
  },
  diagnostics: {
    type: Object,
    required: true,
  },
  damageTimeline: {
    type: Array,
    required: true,
  },
  insertionDiagnostics: {
    type: Object,
    default: () => ({
      autoDelayedCount: 0,
      autoDelayedItems: [],
    }),
  },
  timelineDiagnostics: {
    type: Object,
    default: () => ({
      overlapCount: 0,
      overlaps: [],
    }),
  },
});

const overlapItems = computed(() => props.timelineDiagnostics?.overlaps ?? []);
const overlapCount = computed(() => props.timelineDiagnostics?.overlapCount ?? overlapItems.value.length);
const autoDelayedItems = computed(() => props.insertionDiagnostics?.autoDelayedItems ?? []);
const autoDelayedCount = computed(
  () => props.insertionDiagnostics?.autoDelayedCount ?? autoDelayedItems.value.length,
);

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString('zh-CN');
}

function formatOverlapRange(item) {
  return `${Math.round(item.overlapStartMs)}-${Math.round(item.overlapEndMs)}ms`;
}

function formatDelayRange(item) {
  return `${Math.round(item.requestedStartMs)}ms -> ${Math.round(item.resolvedStartMs)}ms`;
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

.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 14px;
}

.metric {
  min-width: 0;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  background: #232a31;
}

.metric span {
  display: block;
  margin-bottom: 4px;
  color: #8f9aa3;
  font-size: 11px;
}

.metric strong {
  display: block;
  overflow-wrap: anywhere;
  color: #ffffff;
  font-size: 15px;
}

.damage-list {
  display: grid;
  gap: 8px;
  padding: 0 14px 14px;
}

.damage-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 10px;
  border-radius: 4px;
  background: rgba(230, 162, 60, 0.1);
}

.damage-row span {
  color: #efc574;
}

.timeline-diagnostics {
  display: grid;
  gap: 8px;
  padding: 0 14px 14px;
}

.insertion-diagnostics {
  display: grid;
  gap: 8px;
  padding: 0 14px 14px;
}

.diagnostic-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  background: rgba(245, 108, 108, 0.08);
}

.diagnostic-heading span {
  color: #d9dee3;
  font-size: 12px;
  font-weight: 700;
}

.diagnostic-heading strong {
  color: #ffb9b9;
  font-size: 15px;
}

.diagnostic-heading.neutral {
  background: rgba(230, 162, 60, 0.08);
}

.diagnostic-heading.neutral strong {
  color: #efc574;
}

.diagnostic-empty {
  margin: 0;
  padding: 9px 10px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
  color: #8f9aa3;
  font-size: 12px;
}

.overlap-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.overlap-list li,
.insertion-list li {
  display: grid;
  gap: 3px;
  min-width: 0;
  padding: 9px 10px;
  border-left: 3px solid #f56c6c;
  border-radius: 4px;
  background: rgba(245, 108, 108, 0.1);
}

.insertion-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.insertion-list li {
  border-left-color: #e6a23c;
  background: rgba(230, 162, 60, 0.1);
}

.overlap-list span,
.overlap-list small,
.insertion-list span,
.insertion-list small {
  color: #b8c0c7;
  font-size: 11px;
}

.overlap-list strong,
.insertion-list strong {
  overflow-wrap: anywhere;
  color: #ffdede;
  font-size: 12px;
}

.insertion-list strong {
  color: #efc574;
}

.limitations {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 14px 18px 16px 30px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  color: #b8c0c7;
  font-size: 12px;
}
</style>
