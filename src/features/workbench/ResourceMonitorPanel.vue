<template>
  <section class="panel resource-monitor-panel">
    <div class="panel-title">
      <TrendCharts class="panel-icon" />
      <h2>资源</h2>
    </div>

    <div class="resource-summary">
      <div>
        <span>事件</span>
        <strong data-testid="workbench-resource-event-count">{{
          resourceTimeline.length
        }}</strong>
      </div>
      <div>
        <span>SP 净值</span>
        <strong data-testid="workbench-resource-sp-total">{{
          formatSigned(resourceTotals.sp ?? 0)
        }}</strong>
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

    <div
      v-if="runtimeProjection"
      class="runtime-resource-monitor"
      data-testid="workbench-runtime-resource-monitor"
    >
      <div class="runtime-heading">
        <span>运行投影</span>
        <strong data-testid="workbench-runtime-sim-log-count">
          {{ runtimeSummary.simLogCount ?? 0 }} 日志
        </strong>
      </div>

      <div class="runtime-state-grid">
        <div class="runtime-state-cell">
          <span>敌人 HP 伤害</span>
          <strong data-testid="workbench-runtime-enemy-hp-delta">
            {{ formatNumber(runtimeEnemyState.hpDelta) }}
          </strong>
        </div>
        <div class="runtime-state-cell">
          <span>敌人韧性</span>
          <strong data-testid="workbench-runtime-enemy-toughness-delta">
            {{ formatNumber(runtimeEnemyState.toughnessDelta) }}
          </strong>
        </div>
      </div>

      <div
        v-if="runtimeActorEnergyRows.length"
        class="runtime-energy-list"
        data-testid="workbench-runtime-energy-list"
      >
        <div
          v-for="actor in runtimeActorEnergyRows"
          :key="actor.actorId"
          class="runtime-energy-row"
          data-testid="workbench-runtime-energy-actor-row"
        >
          <span>{{ actor.actorName }}</span>
          <strong
            >{{ actor.resource.toUpperCase() }}
            {{ formatSigned(actor.delta) }}</strong
          >
          <small>{{ actor.pointCount }}点</small>
        </div>
      </div>
    </div>

    <ol v-if="resourceTimeline.length" class="resource-list">
      <li
        v-for="entry in resourceTimeline"
        :key="`${entry.actionId}-${entry.resource}-${entry.timeMs}`"
      >
        <span class="time">{{ entry.timeMs }}ms</span>
        <span class="resource">{{ entry.resource.toUpperCase() }}</span>
        <strong>{{ formatSigned(entry.change) }}</strong>
      </li>
    </ol>
    <p v-else class="empty-state" data-testid="workbench-resource-empty">
      暂无资源事件
    </p>
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
  runtimeProjection: {
    type: Object,
    default: null,
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

const runtimeSummary = computed(() => props.runtimeProjection?.summary ?? {});

const runtimeEnemyState = computed(
  () => props.runtimeProjection?.enemyStateCurve ?? {}
);

const runtimeActorEnergyRows = computed(
  () => props.runtimeProjection?.selfEnergyCurveByActor ?? []
);

function formatSigned(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? '+' : ''}${number}`;
}

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

.runtime-resource-monitor {
  display: grid;
  gap: 10px;
  margin: 0 14px 14px;
  padding: 12px;
  border: 1px solid rgba(121, 199, 185, 0.18);
  border-radius: 6px;
  background: rgba(121, 199, 185, 0.07);
}

.runtime-heading,
.runtime-energy-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.runtime-heading span {
  color: #d9dee3;
  font-size: 13px;
  font-weight: 700;
}

.runtime-heading strong {
  color: #79c7b9;
  font-size: 12px;
}

.runtime-state-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.runtime-state-cell {
  min-width: 0;
  padding: 8px 9px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
}

.runtime-state-cell span {
  display: block;
  margin-bottom: 4px;
  color: #8f9aa3;
  font-size: 11px;
}

.runtime-state-cell strong {
  color: #ffffff;
  font-size: 15px;
}

.runtime-energy-list {
  display: grid;
  gap: 6px;
}

.runtime-energy-row {
  padding: 7px 9px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  font-size: 12px;
}

.runtime-energy-row span {
  min-width: 0;
  color: #d9dee3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.runtime-energy-row strong {
  color: #ffffff;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.runtime-energy-row small {
  color: #8f9aa3;
  white-space: nowrap;
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
