<template>
  <section class="panel timeline-panel">
    <div class="panel-title">
      <Clock class="panel-icon" />
      <h2>时间轴</h2>
    </div>

    <div class="timeline-scale">
      <span v-for="tick in ticks" :key="tick.timeMs">{{ tick.label }}</span>
    </div>

    <div class="timeline-lane">
      <div
        v-for="action in actions"
        :key="action.id"
        class="action-block"
        :class="{ selected: action.id === selectedActionId }"
        :style="actionStyle(action)"
        tabindex="0"
        @click="$emit('select-action', action.id)"
        @keydown.enter="$emit('select-action', action.id)"
      >
        <span>{{ action.name }}</span>
      </div>

      <div
        v-for="damage in damageTimeline"
        :key="`${damage.actionId}-${damage.timeMs}`"
        class="damage-marker"
        :style="markerStyle(damage)"
        :title="`${damage.segmentLabel}: ${damage.rawDamage}`"
      />
    </div>

    <div class="legend">
      <span><i class="legend-action" /> 动作</span>
      <span><i class="legend-damage" /> 伤害投影</span>
      <span class="warning">时序为占位数据</span>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { Clock } from '@element-plus/icons-vue';

const props = defineProps({
  actions: {
    type: Array,
    required: true,
  },
  damageTimeline: {
    type: Array,
    required: true,
  },
  durationMs: {
    type: Number,
    required: true,
  },
  selectedActionId: {
    type: String,
    required: true,
  },
});

defineEmits(['select-action']);

const ticks = computed(() => {
  const durationSeconds = props.durationMs / 1000;
  return [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const seconds = Math.round(durationSeconds * ratio);
    return {
      timeMs: seconds * 1000,
      label: `${seconds}s`,
    };
  });
});

function actionStyle(action) {
  const left = clampPercent((action.startMs / props.durationMs) * 100);
  const width = clampPercent(((action.durationMs ?? 1800) / props.durationMs) * 100, 8, 42);
  return {
    left: `${left}%`,
    width: `${width}%`,
  };
}

function markerStyle(damage) {
  const left = clampPercent((damage.timeMs / props.durationMs) * 100);
  return {
    left: `${left}%`,
  };
}

function clampPercent(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Number(value) || 0));
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

.timeline-scale {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  padding: 12px 18px 0;
  color: #8f9aa3;
  font-size: 12px;
}

.timeline-scale span:not(:first-child) {
  text-align: center;
}

.timeline-scale span:last-child {
  text-align: right;
}

.timeline-lane {
  position: relative;
  height: 210px;
  margin: 12px 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  background:
    repeating-linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.05) 0,
      rgba(255, 255, 255, 0.05) 1px,
      transparent 1px,
      transparent 10%
    ),
    #14191e;
  overflow: hidden;
}

.action-block {
  position: absolute;
  top: 58px;
  height: 56px;
  min-width: 96px;
  padding: 10px 12px;
  border: 1px solid rgba(121, 199, 185, 0.5);
  border-radius: 6px;
  background: linear-gradient(180deg, #274840 0%, #20352f 100%);
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28);
  cursor: pointer;
}

.action-block:hover,
.action-block:focus {
  border-color: rgba(255, 255, 255, 0.8);
  outline: none;
}

.action-block.selected {
  box-shadow: 0 0 0 2px rgba(121, 199, 185, 0.3), 0 12px 30px rgba(0, 0, 0, 0.28);
}

.action-block span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.damage-marker {
  position: absolute;
  top: 126px;
  width: 10px;
  height: 44px;
  border-radius: 5px;
  background: #e6a23c;
  box-shadow: 0 0 18px rgba(230, 162, 60, 0.42);
  transform: translateX(-50%);
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  padding: 0 18px 16px;
  color: #b8c0c7;
  font-size: 12px;
}

.legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend i {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}

.legend-action {
  background: #79c7b9;
}

.legend-damage {
  background: #e6a23c;
}

.warning {
  color: #efc574;
}
</style>
