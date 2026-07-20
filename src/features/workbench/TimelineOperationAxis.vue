<template>
  <div
    ref="trackRef"
    class="timeline-operation-track"
    :style="axisStyle"
    :data-row-count="layout.rowCount"
    :data-projection-status="projection.status"
    data-testid="workbench-timeline-operation-axis"
  >
    <button
      v-for="marker in layout.markers"
      :key="marker.id"
      class="timeline-operation-marker"
      :class="[
        `command-${markerTone(marker.command)}`,
        {
          hold: marker.mode === 'hold',
          selected: marker.actionId === selectedActionId,
        },
      ]"
      :style="markerStyle(marker)"
      :title="markerTitle(marker)"
      :data-operation-id="marker.id"
      :data-action-id="marker.actionId"
      :data-command="marker.command"
      :data-mode="marker.mode"
      :data-start-ms="marker.startMs"
      :data-end-ms="marker.endMs ?? ''"
      :data-interval-width-px="marker.intervalWidthPx"
      :data-row-index="marker.rowIndex"
      :data-source-status="marker.status"
      data-testid="workbench-timeline-operation-marker"
      type="button"
      @click.stop="selectMarker(marker)"
    >
      <span>{{ marker.displayLabel }}</span>
    </button>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import {
  getVerifiedCombatActionMapping,
  loadVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';
import {
  layoutTimelineOperationMarkers,
  projectTimelineOperationInputs,
} from '../../simulation/projection/projectTimelineOperationInputs';

const ROW_HEIGHT_PX = 27;
const AXIS_PADDING_PX = 4;
const DEFAULT_TRACK_WIDTH_PX = 900;

const props = defineProps({
  actions: {
    type: Array,
    default: () => [],
  },
  actors: {
    type: Array,
    default: () => [],
  },
  durationMs: {
    type: Number,
    required: true,
  },
  selectedActionId: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['select-action']);
const trackRef = ref(null);
const trackWidthPx = ref(DEFAULT_TRACK_WIDTH_PX);
const mechanicsRevision = ref(0);
let resizeObserver = null;

const actorById = computed(
  () => new Map(props.actors.map(actor => [String(actor.id), actor]))
);
const projection = computed(() => {
  mechanicsRevision.value;
  return projectTimelineOperationInputs({
    actions: props.actions,
    actors: props.actors,
    durationMs: props.durationMs,
    resolveActionMapping(action) {
      return getVerifiedCombatActionMapping({
        ...action,
        actor: actorById.value.get(String(action.actorId ?? '')) ?? null,
      });
    },
  });
});
const layout = computed(() =>
  layoutTimelineOperationMarkers(projection.value.markers, {
    durationMs: props.durationMs,
    trackWidthPx: trackWidthPx.value,
  })
);
const axisStyle = computed(() => ({
  height: `${AXIS_PADDING_PX * 2 + layout.value.rowCount * ROW_HEIGHT_PX}px`,
}));

onMounted(async () => {
  await nextTick();
  measureTrack();
  if (typeof ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver(measureTrack);
    resizeObserver.observe(trackRef.value);
  }
  void loadVerifiedCombatMechanicsPackage()
    .then(() => {
      mechanicsRevision.value += 1;
    })
    .catch(() => {
      mechanicsRevision.value += 1;
    });
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});

function measureTrack() {
  const element = trackRef.value;
  const width =
    element?.getBoundingClientRect?.().width ||
    element?.clientWidth ||
    DEFAULT_TRACK_WIDTH_PX;
  trackWidthPx.value = Math.max(1, width);
}

function markerStyle(marker) {
  return {
    left: `${(marker.startMs / Math.max(1, props.durationMs)) * 100}%`,
    top: `${AXIS_PADDING_PX + marker.rowIndex * ROW_HEIGHT_PX}px`,
    width: `${marker.widthPx}px`,
    '--hold-interval-width': `${marker.intervalWidthPx}px`,
  };
}

function markerTitle(marker) {
  const modeLabel = marker.mode === 'hold' ? '长按' : '短按';
  const timeLabel = `${formatMilliseconds(marker.startMs)} ms`;
  const rangeLabel =
    marker.mode === 'hold' && marker.endMs != null
      ? ` - ${formatMilliseconds(marker.endMs)} ms`
      : '';
  return `${marker.actionName}｜${marker.keyLabel}｜${modeLabel}｜${timeLabel}${rangeLabel}`;
}

function selectMarker(marker) {
  if (marker.actionId) emit('select-action', marker.actionId);
}

function markerTone(command) {
  if (command === 'switch') return 'switch';
  if (['skill', 'ultimate', 'kibo-skill'].includes(command)) return 'ability';
  return 'attack';
}

function formatMilliseconds(value) {
  return Number(Number(value).toFixed(3));
}
</script>

<style scoped>
.timeline-operation-track {
  position: relative;
  width: 100%;
  min-width: 100%;
  overflow: hidden;
  border-bottom: 1px solid #303941;
  background: #11171b;
}

.timeline-operation-marker {
  position: absolute;
  z-index: 1;
  height: 22px;
  min-width: 1px;
  overflow: hidden;
  padding: 0 5px;
  border: 1px solid #7c8790;
  border-radius: 3px;
  background: #1a2228;
  color: #eef2f4;
  font:
    600 11px/20px ui-monospace,
    SFMono-Regular,
    Consolas,
    monospace;
  letter-spacing: 0;
  text-align: center;
  text-overflow: clip;
  white-space: nowrap;
  cursor: pointer;
}

.timeline-operation-marker.hold {
  overflow: visible;
}

.timeline-operation-marker.hold::after {
  position: absolute;
  right: auto;
  bottom: 1px;
  left: -1px;
  width: var(--hold-interval-width);
  height: 2px;
  background: currentColor;
  content: '';
}

.timeline-operation-marker.hold span {
  display: block;
  overflow: hidden;
  text-overflow: clip;
}

.timeline-operation-marker.command-ability {
  border-color: #72b9aa;
  color: #bde7de;
}

.timeline-operation-marker.command-switch {
  border-color: #b8a36b;
  color: #eadba9;
}

.timeline-operation-marker.selected,
.timeline-operation-marker:focus-visible {
  z-index: 2;
  border-color: #f2f5f6;
  outline: 1px solid #f2f5f6;
  outline-offset: 1px;
}

.timeline-operation-marker:hover {
  background: #222c33;
}
</style>
