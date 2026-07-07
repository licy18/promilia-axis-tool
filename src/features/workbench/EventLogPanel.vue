<template>
  <section class="panel event-log-panel">
    <div class="panel-title">
      <Tickets class="panel-icon" />
      <h2>事件日志</h2>
    </div>

    <ol class="event-list">
      <li v-for="event in eventLog" :key="`${event.type}-${event.timeMs}-${event.actionId ?? 'scenario'}`">
        <span class="time">{{ event.timeMs }}ms</span>
        <span class="type" :class="event.type.toLowerCase()">{{ event.type }}</span>
        <span class="payload">{{ formatPayload(event) }}</span>
      </li>
    </ol>
  </section>
</template>

<script setup>
import { Tickets } from '@element-plus/icons-vue';

defineProps({
  eventLog: {
    type: Array,
    required: true,
  },
});

function formatPayload(event) {
  if (event.type === 'DAMAGE_PROJECTED') {
    return `${event.payload.skillName} / ${event.payload.segment.label} / ${event.payload.rawDamage}`;
  }
  if (event.type === 'ACTION_START') {
    return `${event.payload.actorName} -> ${event.payload.actionName}`;
  }
  if (event.type === 'TIMING_DATA_MISSING') {
    return event.payload.timingSource;
  }
  if (event.type === 'SCENARIO_START') {
    return event.payload.projectName;
  }
  if (event.type === 'SCENARIO_END') {
    return event.payload.projectId;
  }
  return event.actionId ?? '';
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

.event-list {
  display: grid;
  gap: 8px;
  max-height: 250px;
  margin: 0;
  padding: 14px;
  overflow: auto;
  list-style: none;
}

li {
  display: grid;
  grid-template-columns: 72px minmax(116px, 160px) minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 4px;
  background: #232a31;
  font-size: 12px;
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

.payload {
  overflow: hidden;
  color: #d9dee3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 760px) {
  li {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .payload {
    white-space: normal;
  }
}
</style>
