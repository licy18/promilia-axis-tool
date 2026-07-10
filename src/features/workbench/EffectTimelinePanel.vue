<template>
  <section
    class="panel effect-timeline-panel"
    data-testid="workbench-effect-timeline-panel"
    :data-active-effect-count="effectReview.summary.activeEffectCount"
    :data-effect-event-count="effectReview.summary.eventCount"
    :data-review-time-ms="effectReview.reviewTimeMs"
    :data-selected-effect-event-id="effectReview.selectedEventId"
    :data-selected-effect-interval-id="selectedEffectInterval?.intervalId || ''"
  >
    <div class="panel-title">
      <Timer class="panel-icon" />
      <h2>状态效果</h2>
      <strong>{{ effectReview.summary.eventCount }} 事件</strong>
    </div>

    <div
      v-if="selectedEffectInterval"
      class="effect-interval-review"
      :data-interval-id="selectedEffectInterval.intervalId"
      data-testid="workbench-effect-selected-interval"
    >
      <div class="effect-interval-review-heading">
        <span>
          <strong>{{
            selectedEffectInterval.effectName || selectedEffectInterval.effectId
          }}</strong>
          <small>{{
            selectedEffectInterval.targetName || selectedEffectInterval.targetId
          }}</small>
        </span>
        <span>
          <strong>{{ formatIntervalFrames(selectedEffectInterval) }}</strong>
          <small>{{ formatIntervalStacks(selectedEffectInterval) }}</small>
        </span>
      </div>
      <ol class="effect-interval-lifecycle">
        <li
          v-for="event in selectedEffectInterval.lifecycleEvents"
          :key="event.eventId"
        >
          <button
            type="button"
            :class="{
              selected: effectReview.selectedEventId === event.eventId,
            }"
            :data-effect-event-id="event.eventId"
            :data-effect-event-type="event.type"
            data-testid="workbench-effect-interval-lifecycle-event"
            @click="selectEffectEvent(event.eventId)"
          >
            <span>{{ formatEventTime(event) }}</span>
            <strong>{{ formatEventOperation(event.type) }}</strong>
            <small>{{ formatLifecycleStack(event) }}</small>
          </button>
        </li>
      </ol>
    </div>

    <p
      v-if="effectReview.events.length === 0"
      class="effect-empty"
      data-testid="workbench-effect-timeline-empty"
    >
      当前排轴没有状态效果事件
    </p>

    <div v-else class="effect-review-body">
      <div class="effect-events">
        <div class="effect-section-heading">
          <span>事件时间线</span>
          <strong>{{ formatReviewTime(effectReview.reviewTimeMs) }}</strong>
        </div>
        <ol class="effect-event-list">
          <li v-for="event in effectReview.events" :key="event.eventId">
            <button
              type="button"
              :aria-pressed="effectReview.selectedEventId === event.eventId"
              :data-effect-event-id="event.eventId"
              :data-effect-event-type="event.type"
              :data-selected="effectReview.selectedEventId === event.eventId"
              data-testid="workbench-effect-event-row"
              @click="selectEffectEvent(event.eventId)"
            >
              <span class="effect-event-time">{{
                formatEventTime(event)
              }}</span>
              <span class="effect-event-main">
                <strong>{{ formatEventTitle(event) }}</strong>
                <small>{{ formatEventDetail(event) }}</small>
              </span>
            </button>
          </li>
        </ol>
      </div>

      <div class="effect-active-review">
        <div class="effect-section-heading">
          <span>当前生效</span>
          <strong data-testid="workbench-effect-active-count">
            {{ effectReview.activeEffects.length }}
          </strong>
        </div>
        <ul v-if="effectReview.activeEffects.length" class="effect-active-list">
          <li
            v-for="effect in effectReview.activeEffects"
            :key="effect.instanceKey"
            :data-effect-id="effect.effectId"
            :data-target-id="effect.targetId"
            data-testid="workbench-effect-active-row"
          >
            <span>
              <strong>{{ effect.effectName || effect.effectId }}</strong>
              <small>{{ effect.targetName || effect.targetId }}</small>
            </span>
            <span>
              <strong>{{ effect.stacks }}/{{ effect.maxStacks }} 层</strong>
              <small>{{ formatEffectExpiry(effect) }}</small>
            </span>
          </li>
        </ul>
        <p
          v-else
          class="effect-active-empty"
          data-testid="workbench-effect-active-empty"
        >
          此时点无生效效果
        </p>

        <button
          v-if="selectedEffectSourceActionId"
          type="button"
          class="effect-source-action"
          :data-action-id="selectedEffectSourceActionId"
          data-testid="workbench-effect-edit-source-action"
          @click="editSelectedSourceAction"
        >
          <EditPen class="effect-source-action-icon" />
          <span>编辑来源动作</span>
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { EditPen, Timer } from '@element-plus/icons-vue';
import { createRuntimeEffectReview } from './runtimeEffectReview';

const props = defineProps({
  effectTimeline: {
    type: Object,
    default: null,
  },
  runtimeSelectedDetail: {
    type: Object,
    default: null,
  },
  selectedEffectEventId: {
    type: String,
    default: null,
  },
  selectedEffectInterval: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['edit-source-action', 'select-effect-event']);
const internalSelectedEffectEventId = ref('');
const effectiveSelectedEffectEventId = computed(() =>
  props.selectedEffectEventId == null
    ? internalSelectedEffectEventId.value
    : props.selectedEffectEventId
);
const selectedRuntimeTimeMs = computed(() => {
  if (props.runtimeSelectedDetail?.timeMs == null) {
    return null;
  }
  const timeMs = Number(props.runtimeSelectedDetail?.timeMs);
  return Number.isFinite(timeMs) ? timeMs : null;
});
const effectReview = computed(() =>
  createRuntimeEffectReview({
    effectTimeline: props.effectTimeline,
    selectedTimeMs: effectiveSelectedEffectEventId.value
      ? null
      : selectedRuntimeTimeMs.value,
    selectedEventId: effectiveSelectedEffectEventId.value,
  })
);
const selectedEffectSourceActionId = computed(
  () =>
    effectReview.value.selectedEvent?.actionId ||
    props.selectedEffectInterval?.sourceActionId ||
    ''
);

watch(
  () => props.runtimeSelectedDetail?.statePointId,
  () => {
    internalSelectedEffectEventId.value = '';
  }
);

watch(
  () => props.effectTimeline,
  timeline => {
    if (
      internalSelectedEffectEventId.value &&
      !(timeline?.events ?? []).some(
        event => event.eventId === internalSelectedEffectEventId.value
      )
    ) {
      internalSelectedEffectEventId.value = '';
    }
  }
);

function selectEffectEvent(eventId) {
  internalSelectedEffectEventId.value = eventId;
  emit('select-effect-event', eventId);
}

function editSelectedSourceAction() {
  const actionId = selectedEffectSourceActionId.value;
  if (actionId) {
    emit('edit-source-action', actionId);
  }
}

function formatReviewTime(timeMs) {
  return `${Number(timeMs) || 0}ms`;
}

function formatEventTime(event) {
  return `${event.frameIndex ?? 0}F`;
}

function formatEventTitle(event) {
  return `${formatEventOperation(event.type)} · ${event.effectName || event.effectId}`;
}

function formatEventDetail(event) {
  const stackText =
    event.stackAfter > 0
      ? `${event.stackAfter} 层`
      : event.stackBefore > 0
        ? `移除 ${event.stackBefore} 层`
        : '无实例';
  return `${event.targetName || event.targetId} · ${stackText}`;
}

function formatEventOperation(type) {
  if (type === 'EFFECT_APPLIED') {
    return '施加';
  }
  if (type === 'EFFECT_REFRESHED') {
    return '刷新';
  }
  if (type === 'EFFECT_REMOVED') {
    return '移除';
  }
  if (type === 'EFFECT_EXPIRED') {
    return '到期';
  }
  return type;
}

function formatEffectExpiry(effect) {
  return effect.expiresAtMs == null
    ? '持续生效'
    : `${effect.expiresAtMs}ms 到期`;
}

function formatIntervalFrames(interval) {
  return String(interval.startFrame) + 'F-' + String(interval.endFrame) + 'F';
}

function formatIntervalStacks(interval) {
  if (interval.maxStacks > 1) {
    return (
      '峰值 ' +
      String(interval.peakStacks) +
      '/' +
      String(interval.maxStacks) +
      ' 层'
    );
  }
  return interval.activeAtScenarioEnd ? '场景结束时仍生效' : '已结束';
}

function formatLifecycleStack(event) {
  if (event.stackAfter > 0) {
    return String(event.stackAfter) + ' 层';
  }
  if (event.stackBefore > 0) {
    return '结束 ' + String(event.stackBefore) + ' 层';
  }
  return '无实例';
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
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.panel-title h2 {
  margin: 0;
  font-size: 15px;
}

.panel-title > strong {
  margin-left: auto;
  color: #aeb8c1;
  font-size: 12px;
}

.panel-icon {
  width: 17px;
  height: 17px;
  color: #f2b366;
}

.effect-empty,
.effect-active-empty {
  margin: 0;
  padding: 14px;
  color: #8f9aa3;
  font-size: 12px;
}

.effect-interval-review {
  display: grid;
  gap: 9px;
  padding: 11px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: #202a31;
}

.effect-interval-review-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.effect-interval-review-heading > span {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.effect-interval-review-heading > span:last-child {
  justify-items: end;
}

.effect-interval-review-heading strong {
  overflow: hidden;
  color: #f4f7f8;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.effect-interval-review-heading small {
  color: #9da9b2;
  font-size: 11px;
}

.effect-interval-lifecycle {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.effect-interval-lifecycle button {
  display: grid;
  min-width: 74px;
  grid-template-columns: auto auto;
  gap: 1px 6px;
  padding: 5px 7px;
  border: 1px solid rgba(126, 176, 255, 0.32);
  border-radius: 3px;
  background: #172028;
  color: #dcecff;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.effect-interval-lifecycle button.selected {
  border-color: #f2b366;
  background: #352d22;
  color: #ffe2ba;
}

.effect-interval-lifecycle button span,
.effect-interval-lifecycle button strong {
  font-size: 10px;
}

.effect-interval-lifecycle button small {
  grid-column: 1 / -1;
  color: #9da9b2;
  font-size: 9px;
}

.effect-review-body {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(220px, 0.75fr);
  min-width: 0;
}

.effect-events,
.effect-active-review {
  min-width: 0;
  padding: 12px 14px;
}

.effect-active-review {
  border-left: 1px solid rgba(255, 255, 255, 0.08);
}

.effect-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  color: #aeb8c1;
  font-size: 12px;
}

.effect-section-heading strong {
  color: #ffffff;
}

.effect-event-list,
.effect-active-list {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.effect-event-list {
  max-height: 260px;
  overflow: auto;
}

.effect-event-list button {
  display: grid;
  width: 100%;
  grid-template-columns: 54px minmax(0, 1fr);
  gap: 8px;
  padding: 8px 6px;
  border: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.effect-event-list button[data-selected='true'] {
  background: rgba(242, 179, 102, 0.1);
}

.effect-event-time {
  color: #f2b366;
  font-size: 12px;
  font-weight: 800;
}

.effect-event-main,
.effect-active-list li > span {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.effect-event-main strong,
.effect-event-main small,
.effect-active-list strong,
.effect-active-list small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.effect-event-main strong,
.effect-active-list strong {
  color: #f4f7f8;
  font-size: 12px;
}

.effect-event-main small,
.effect-active-list small {
  color: #8f9aa3;
  font-size: 11px;
}

.effect-active-list li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.effect-active-list li > span:last-child {
  justify-items: end;
}

.effect-source-action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 30px;
  margin-top: 12px;
  padding: 0 9px;
  border: 1px solid rgba(242, 179, 102, 0.34);
  border-radius: 4px;
  background: rgba(242, 179, 102, 0.1);
  color: #ffe0b8;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
}

.effect-source-action-icon {
  width: 14px;
  height: 14px;
}

@media (max-width: 760px) {
  .effect-review-body {
    grid-template-columns: 1fr;
  }

  .effect-active-review {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    border-left: 0;
  }
}
</style>
