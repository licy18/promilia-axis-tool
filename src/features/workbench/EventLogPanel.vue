<template>
  <section class="panel event-log-panel">
    <div class="panel-title">
      <Tickets class="panel-icon" />
      <h2>事件日志</h2>
    </div>

    <ol class="event-list">
      <li
        v-for="event in eventLog"
        :key="`${event.type}-${event.timeMs}-${event.actionId ?? 'scenario'}`"
      >
        <span class="time">{{ event.timeMs }}ms</span>
        <span class="type" :class="event.type.toLowerCase()">{{
          event.type
        }}</span>
        <span class="payload">{{ formatPayload(event) }}</span>
      </li>
    </ol>

    <div
      v-if="runtimeSimLogRows.length"
      class="runtime-sim-log"
      data-testid="workbench-runtime-sim-log"
    >
      <div class="runtime-log-heading">
        <span>模拟日志</span>
        <strong>{{ runtimeSimLogRows.length }}</strong>
      </div>
      <ol class="runtime-log-list">
        <li
          v-for="(row, index) in runtimeSimLogRows"
          :key="row.sourceDeltaId ?? `${row.eventType}-${index}`"
          class="runtime-log-row"
          :data-selected="selectedRuntimeLogIndex === index"
          data-testid="workbench-runtime-sim-log-row"
          role="button"
          tabindex="0"
          @click="selectRuntimeLog(index)"
          @keydown.enter.prevent="selectRuntimeLog(index)"
          @keydown.space.prevent="selectRuntimeLog(index)"
        >
          <span class="time">{{ formatRuntimeTime(row) }}</span>
          <span class="runtime-track">{{ formatRuntimeTrack(row) }}</span>
          <span class="payload">{{ formatRuntimePayload(row) }}</span>
        </li>
      </ol>

      <div
        v-if="selectedRuntimeLog"
        class="runtime-log-detail"
        data-testid="workbench-runtime-sim-log-detail"
      >
        <div>
          <span>动作</span>
          <strong>{{
            selectedRuntimeLog.actionName ?? selectedRuntimeLog.actionId
          }}</strong>
        </div>
        <div>
          <span>命中</span>
          <strong>{{ selectedRuntimeLog.hitKey ?? 'hit' }}</strong>
        </div>
        <div>
          <span>三值</span>
          <strong>{{ formatRuntimeDelta(selectedRuntimeLog) }}</strong>
        </div>
        <div>
          <span>来源</span>
          <strong>{{ selectedRuntimeLog.sourceDeltaId }}</strong>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { Tickets } from '@element-plus/icons-vue';

const props = defineProps({
  eventLog: {
    type: Array,
    required: true,
  },
  runtimeProjection: {
    type: Object,
    default: null,
  },
});

const selectedRuntimeLogIndex = ref(0);
const runtimeSimLogRows = computed(() => props.runtimeProjection?.simLog ?? []);
const selectedRuntimeLog = computed(
  () => runtimeSimLogRows.value[selectedRuntimeLogIndex.value] ?? null
);

watch(runtimeSimLogRows, rows => {
  if (selectedRuntimeLogIndex.value >= rows.length) {
    selectedRuntimeLogIndex.value = 0;
  }
});

function formatPayload(event) {
  if (event.type === 'DAMAGE_PROJECTED') {
    return `${event.payload.skillName} / ${event.payload.segment.label} / ${event.payload.rawDamage}`;
  }
  if (event.type === 'ACTION_START') {
    return event.payload.actorName
      ? `${event.payload.actorName} -> ${event.payload.actionName}`
      : event.payload.actionName;
  }
  if (event.type === 'TIMING_DATA_MISSING') {
    return event.payload.timingSource;
  }
  if (event.type === 'RESOURCE_CHANGE') {
    return `${event.payload.resource.toUpperCase()} ${formatSigned(event.payload.change)} / ${event.payload.reason}`;
  }
  if (event.type === 'WAIT') {
    return `${event.payload.durationMs}ms / ${event.payload.note}`;
  }
  if (event.type === 'SWITCH') {
    return `${event.payload.fromActorName ?? '前台'} -> ${event.payload.targetActorName ?? event.payload.targetActorId}`;
  }
  if (event.type === 'ANNOTATION') {
    return event.payload.note;
  }
  if (event.type === 'ENEMY_EVENT') {
    return `${event.payload.eventType} / ${event.payload.note}`;
  }
  if (event.type === 'SCENARIO_START') {
    return event.payload.projectName;
  }
  if (event.type === 'SCENARIO_END') {
    return event.payload.projectId;
  }
  return event.actionId ?? '';
}

function formatSigned(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? '+' : ''}${number}`;
}

function selectRuntimeLog(index) {
  selectedRuntimeLogIndex.value = index;
}

function formatRuntimeTime(row) {
  return row.frameLabel ?? `${row.timeMs ?? 0}ms`;
}

function formatRuntimeTrack(row) {
  const labels = {
    enemyHpDamage: 'HP',
    enemyToughnessDamage: '韧性',
    selfEnergyChange: '能量',
  };
  return labels[row.trackKey] ?? row.trackKey ?? '三值';
}

function formatRuntimePayload(row) {
  const action = row.actionName ?? row.actionId ?? '动作';
  return `${action} · ${formatRuntimeDelta(row)}`;
}

function formatRuntimeDelta(row) {
  if (row.trackKey === 'enemyHpDamage') {
    return `HP ${formatNumber(row.hpDelta)}`;
  }
  if (row.trackKey === 'enemyToughnessDamage') {
    return `韧性 ${formatNumber(row.toughnessDelta)}`;
  }
  if (row.trackKey === 'selfEnergyChange') {
    return `SP ${formatSigned(row.energyDelta)}`;
  }
  return formatSigned(row.delta);
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

.event-list,
.runtime-log-list {
  display: grid;
  gap: 8px;
  margin: 0;
  overflow: auto;
  list-style: none;
}

.event-list {
  max-height: 250px;
  padding: 14px;
}

.event-list > li,
.runtime-log-row {
  display: grid;
  grid-template-columns: 72px minmax(116px, 160px) minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 4px;
  background: #232a31;
  font-size: 12px;
}

.runtime-sim-log {
  display: grid;
  gap: 10px;
  margin: 0 14px 14px;
  padding: 12px;
  border: 1px solid rgba(121, 199, 185, 0.18);
  border-radius: 6px;
  background: rgba(121, 199, 185, 0.07);
}

.runtime-log-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.runtime-log-heading span {
  color: #d9dee3;
  font-size: 13px;
  font-weight: 700;
}

.runtime-log-heading strong {
  color: #79c7b9;
  font-size: 12px;
}

.runtime-log-list {
  max-height: 170px;
  padding: 0;
}

.runtime-log-row {
  width: 100%;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.05);
  color: inherit;
  cursor: pointer;
}

.runtime-log-row[data-selected='true'] {
  border-color: rgba(121, 199, 185, 0.45);
  background: rgba(121, 199, 185, 0.14);
}

.runtime-track {
  overflow: hidden;
  color: #79c7b9;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.runtime-log-detail {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.runtime-log-detail div {
  min-width: 0;
  padding: 8px 9px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
}

.runtime-log-detail span {
  display: block;
  margin-bottom: 4px;
  color: #8f9aa3;
  font-size: 11px;
}

.runtime-log-detail strong {
  display: block;
  overflow: hidden;
  color: #ffffff;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time {
  color: #8f9aa3;
  font-variant-numeric: tabular-nums;
}

.type {
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.12);
  color: #79c7b9;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.type.timing_data_missing {
  background: rgba(230, 162, 60, 0.12);
  color: #efc574;
}

.type.damage_projected {
  background: rgba(103, 194, 58, 0.12);
  color: #9bd982;
}

.type.resource_change {
  background: rgba(121, 199, 185, 0.12);
  color: #79c7b9;
}

.type.enemy_event {
  background: rgba(245, 108, 108, 0.12);
  color: #f8b6b6;
}

.type.switch {
  background: rgba(103, 194, 58, 0.12);
  color: #9bd982;
}

.type.wait,
.type.annotation {
  background: rgba(144, 147, 153, 0.14);
  color: #c8cdd3;
}

.payload {
  overflow: hidden;
  color: #d9dee3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 760px) {
  .event-list > li,
  .runtime-log-row,
  .runtime-log-detail {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .payload {
    white-space: normal;
  }
}
</style>
