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

    <ul class="limitations">
      <li v-for="item in diagnostics.limitations" :key="item">{{ item }}</li>
    </ul>
  </section>
</template>

<script setup>
import { TrendCharts } from '@element-plus/icons-vue';

defineProps({
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
});

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString('zh-CN');
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
