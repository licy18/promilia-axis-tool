<template>
  <section class="panel timeline-panel">
    <div class="panel-title">
      <Clock class="panel-icon" />
      <h2>时间轴</h2>
    </div>

    <div class="timeline-scale">
      <span class="scale-spacer" />
      <span v-for="tick in ticks" :key="tick.timeMs">{{ tick.label }}</span>
    </div>

    <div class="timeline-shell">
      <div class="lane-labels">
        <div
          v-for="lane in timelineLanes"
          :key="lane.id"
          class="lane-label"
          :class="{ system: lane.type === 'system' }"
          :data-lane-id="lane.id"
          data-testid="workbench-timeline-lane-label"
        >
          <span>{{ lane.name }}</span>
          <small>{{ lane.detail }}</small>
        </div>
      </div>

      <div ref="laneRef" class="timeline-lane" data-testid="workbench-timeline-lane">
        <div
          v-for="lane in timelineLanes"
          :key="lane.id"
          class="lane-row"
          :data-lane-id="lane.id"
          data-testid="workbench-timeline-row"
        >
          <div
            v-for="action in lane.actions"
            :key="action.id"
            class="action-block"
            :class="[
              { selected: action.id === selectedActionId, dragging: action.id === draggingActionId },
              `type-${action.type}`,
            ]"
            :style="actionStyle(action)"
            :data-action-id="action.id"
            :data-lane-id="lane.id"
            data-testid="workbench-timeline-action"
            tabindex="0"
            @click="$emit('select-action', action.id)"
            @keydown.enter="$emit('select-action', action.id)"
            @keydown.left.prevent="nudgeAction($event, action, -1)"
            @keydown.right.prevent="nudgeAction($event, action, 1)"
            @keydown.delete.prevent="$emit('delete-action', action.id)"
            @keydown.backspace.prevent="$emit('delete-action', action.id)"
            @pointerdown="beginDrag($event, action)"
          >
            <span>{{ actionLabel(action) }}</span>
            <small v-if="actionDetail(action)">{{ actionDetail(action) }}</small>
          </div>

          <div
            v-for="damage in lane.damageMarkers"
            :key="`${damage.actionId}-${damage.timeMs}`"
            class="damage-marker"
            :style="markerStyle(damage)"
            :title="`${damage.segmentLabel}: ${damage.rawDamage}`"
            :data-action-id="damage.actionId"
            :data-lane-id="lane.id"
            data-testid="workbench-timeline-damage-marker"
          />
        </div>
      </div>
    </div>

    <div v-if="timelineLanes.length === 0" class="empty-lane">
      暂无时间轴动作
    </div>

    <div class="legend">
      <span><i class="legend-action" /> 动作</span>
      <span><i class="legend-damage" /> 伤害投影</span>
      <span><i class="legend-system" /> 系统轨</span>
      <span class="warning">时序为占位数据</span>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import { Clock } from '@element-plus/icons-vue';

const DEFAULT_ACTION_DURATION_MS = 1800;

const props = defineProps({
  actors: {
    type: Array,
    required: true,
  },
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
  snapMs: {
    type: Number,
    default: 500,
  },
});

const emit = defineEmits(['select-action', 'delete-action', 'update-action-time']);
const laneRef = ref(null);
const dragState = ref(null);

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

const draggingActionId = computed(() => dragState.value?.actionId ?? null);
const actionsById = computed(() => new Map(props.actions.map((action) => [action.id, action])));
const actorLaneIds = computed(() => new Set(props.actors.map((actor) => actor.id)));
const timelineLanes = computed(() => {
  const actorLanes = props.actors.map((actor) => ({
    id: actor.id,
    type: 'actor',
    name: actor.name,
    detail: actor.role || '角色轨',
    actions: [],
    damageMarkers: [],
  }));
  const lanesById = new Map(actorLanes.map((lane) => [lane.id, lane]));
  const systemLane = {
    id: 'system',
    type: 'system',
    name: '系统',
    detail: '事件轨',
    actions: [],
    damageMarkers: [],
  };

  props.actions.forEach((action) => {
    const lane = lanesById.get(resolveActionLaneId(action)) ?? systemLane;
    lane.actions.push(action);
  });

  props.damageTimeline.forEach((damage) => {
    const lane = lanesById.get(resolveDamageLaneId(damage)) ?? systemLane;
    lane.damageMarkers.push(damage);
  });

  return systemLane.actions.length > 0 || systemLane.damageMarkers.length > 0
    ? [...actorLanes, systemLane]
    : actorLanes;
});

function actionStyle(action) {
  const left = clampPercent((action.startMs / props.durationMs) * 100);
  const width = clampPercent(((action.durationMs ?? DEFAULT_ACTION_DURATION_MS) / props.durationMs) * 100, 8, 42);
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

function actionLabel(action) {
  if (action.type === 'switch') {
    return `${action.name} -> ${action.targetActor?.name ?? '目标'}`;
  }
  return action.name;
}

function actionDetail(action) {
  if (action.type === 'skill') {
    return action.actor?.name ?? '';
  }
  if (action.type === 'resource') {
    return `${String(action.resource ?? 'sp').toUpperCase()} ${formatSigned(action.change)}`;
  }
  if (action.type === 'enemyEvent') {
    return action.eventType ?? '';
  }
  if (action.type === 'switch') {
    return `${action.durationMs ?? 0}ms`;
  }
  return action.note ?? '';
}

function resolveActionLaneId(action) {
  if (action.actor?.id && actorLaneIds.value.has(action.actor.id)) {
    return action.actor.id;
  }
  if (action.actorId && actorLaneIds.value.has(action.actorId)) {
    return action.actorId;
  }
  return 'system';
}

function resolveDamageLaneId(damage) {
  if (damage.actorId && actorLaneIds.value.has(damage.actorId)) {
    return damage.actorId;
  }

  const action = actionsById.value.get(damage.actionId);
  return action ? resolveActionLaneId(action) : 'system';
}

function formatSigned(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? '+' : ''}${number}`;
}

function clampPercent(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function beginDrag(event, action) {
  if ((event.button ?? 0) !== 0) {
    return;
  }

  const rect = laneRef.value?.getBoundingClientRect();
  if (!rect || rect.width <= 0) {
    emit('select-action', action.id);
    return;
  }

  event.preventDefault();
  event.currentTarget?.setPointerCapture?.(event.pointerId);
  emit('select-action', action.id);
  dragState.value = {
    actionId: action.id,
    laneWidth: rect.width,
    initialClientX: event.clientX,
    initialStartMs: action.startMs,
    maxStartMs: Math.max(0, props.durationMs - (action.durationMs ?? DEFAULT_ACTION_DURATION_MS)),
  };

  window.addEventListener('pointermove', handleDragMove);
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
}

function nudgeAction(event, action, direction) {
  const stepMs = event.shiftKey ? props.snapMs * 4 : props.snapMs;
  const maxStartMs = Math.max(0, props.durationMs - (action.durationMs ?? DEFAULT_ACTION_DURATION_MS));
  emit('select-action', action.id);
  emit('update-action-time', {
    actionId: action.id,
    startMs: clampNumber(action.startMs + direction * stepMs, 0, maxStartMs),
  });
}

function handleDragMove(event) {
  if (!dragState.value) {
    return;
  }

  const deltaMs = ((event.clientX - dragState.value.initialClientX) / dragState.value.laneWidth) * props.durationMs;
  const nextStartMs = snapTimeMs(dragState.value.initialStartMs + deltaMs);
  emit('update-action-time', {
    actionId: dragState.value.actionId,
    startMs: clampNumber(nextStartMs, 0, dragState.value.maxStartMs),
  });
}

function endDrag() {
  dragState.value = null;
  window.removeEventListener('pointermove', handleDragMove);
  window.removeEventListener('pointerup', endDrag);
  window.removeEventListener('pointercancel', endDrag);
}

function snapTimeMs(value) {
  const snap = Math.max(1, Number(props.snapMs) || 1);
  return Math.round(value / snap) * snap;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

onBeforeUnmount(() => {
  endDrag();
});
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
  grid-template-columns: 112px repeat(5, minmax(0, 1fr));
  gap: 10px;
  padding: 12px 18px 0;
  color: #8f9aa3;
  font-size: 12px;
}

.timeline-scale span:not(.scale-spacer) {
  text-align: center;
}

.timeline-scale span:last-child {
  text-align: right;
}

.timeline-shell {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  gap: 10px;
  margin: 12px 18px;
}

.lane-labels,
.timeline-lane {
  display: grid;
  gap: 8px;
}

.lane-label {
  display: grid;
  align-content: center;
  min-height: 72px;
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  background: #151b20;
}

.lane-label span {
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lane-label small {
  margin-top: 4px;
  color: #8f9aa3;
  font-size: 11px;
}

.lane-label.system {
  border-color: rgba(185, 164, 121, 0.28);
  background: #1d1b16;
}

.lane-row {
  position: relative;
  min-height: 72px;
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
  top: 10px;
  height: 42px;
  min-width: 96px;
  padding: 7px 10px;
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

.action-block.dragging {
  cursor: grabbing;
}

.action-block span,
.action-block small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-block small {
  margin-top: 3px;
  color: #b8d8d2;
  font-size: 10px;
  font-weight: 500;
}

.action-block.type-switch {
  border-color: rgba(126, 176, 255, 0.5);
  background: linear-gradient(180deg, #29436b 0%, #223455 100%);
}

.action-block.type-resource {
  border-color: rgba(155, 196, 120, 0.5);
  background: linear-gradient(180deg, #354d2e 0%, #273923 100%);
}

.action-block.type-enemyEvent,
.action-block.type-annotation,
.action-block.type-wait {
  border-color: rgba(185, 164, 121, 0.45);
  background: linear-gradient(180deg, #4a4029 0%, #352f21 100%);
}

.damage-marker {
  position: absolute;
  top: 54px;
  width: 10px;
  height: 14px;
  border-radius: 5px;
  background: #e6a23c;
  box-shadow: 0 0 18px rgba(230, 162, 60, 0.42);
  transform: translateX(-50%);
}

.empty-lane {
  margin: 12px 18px;
  padding: 24px;
  border: 1px dashed rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  color: #8f9aa3;
  text-align: center;
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

.legend-system {
  background: #b9a479;
}

.warning {
  color: #efc574;
}

@media (max-width: 760px) {
  .timeline-scale {
    grid-template-columns: 84px repeat(5, minmax(0, 1fr));
  }

  .timeline-shell {
    grid-template-columns: 84px minmax(0, 1fr);
  }

  .lane-label {
    padding: 8px;
  }
}
</style>
