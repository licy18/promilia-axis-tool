<template>
  <button
    class="switch-event-marker"
    :class="{
      selected,
      'multi-selected': multiSelected,
      dragging,
      'cursor-active': cursorActive,
      'readiness-blocked': readiness.status === 'blocked',
    }"
    type="button"
    :style="markerStyle"
    :title="markerTitle"
    :aria-label="markerTitle"
    :data-action-id="action.id"
    :data-action-type="action.type"
    :data-start-ms="action.startMs"
    :data-start-frame="frameIndex"
    :data-duration-ms="action.durationMs"
    :data-duration-frames="action.durationFrames ?? 0"
    :data-target-actor-id="action.targetActorId || ''"
    :data-target-character-id="action.targetCharacterId || ''"
    :data-selected="multiSelected ? 'true' : 'false'"
    :data-lane-id="laneId"
    :data-readiness-status="readiness.status"
    :data-readiness-executable="readiness.executable ? 'true' : 'false'"
    data-switch-event="true"
    data-testid="workbench-timeline-action"
  >
    <span class="switch-event-frame-label">{{ frameIndex }}F</span>
    <span class="switch-event-avatar" aria-hidden="true">
      <span>{{ targetInitial }}</span>
      <img
        v-if="targetAvatarUrl"
        :src="targetAvatarUrl"
        alt=""
        @error="$event.currentTarget.classList.add('missing')"
      />
    </span>
    <span class="switch-event-pointer" aria-hidden="true" />
  </button>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  action: {
    type: Object,
    required: true,
  },
  actors: {
    type: Array,
    default: () => [],
  },
  laneId: {
    type: String,
    required: true,
  },
  frameIndex: {
    type: Number,
    required: true,
  },
  timelineDurationMs: {
    type: Number,
    required: true,
  },
  topPx: {
    type: Number,
    required: true,
  },
  previewOffsetMs: {
    type: Number,
    default: 0,
  },
  selected: {
    type: Boolean,
    default: false,
  },
  multiSelected: {
    type: Boolean,
    default: false,
  },
  dragging: {
    type: Boolean,
    default: false,
  },
  cursorActive: {
    type: Boolean,
    default: false,
  },
  readiness: {
    type: Object,
    required: true,
  },
});

const targetActor = computed(
  () =>
    props.action.targetActor ??
    props.actors.find(
      actor =>
        String(actor.id ?? '') === String(props.action.targetActorId ?? '') ||
        Number(actor.characterId) === Number(props.action.targetCharacterId)
    ) ??
    null
);
const targetName = computed(
  () => targetActor.value?.name ?? props.action.targetCharacterId ?? '目标角色'
);
const targetInitial = computed(
  () => Array.from(String(targetName.value))[0] ?? '角'
);
const targetAvatarUrl = computed(() => {
  const characterId = Number(
    targetActor.value?.characterId ?? props.action.targetCharacterId
  );
  return Number.isFinite(characterId)
    ? `/assets/characters/${characterId}.png`
    : '';
});
const markerTitle = computed(() => {
  const status = props.readiness.executable
    ? '切换生效'
    : '同帧冲突，切换被阻止';
  return `切换至 ${targetName.value} · ${props.frameIndex}F · ${status}`;
});
const markerStyle = computed(() => {
  const left = Math.min(
    100,
    Math.max(
      0,
      ((Number(props.action.startMs) + props.previewOffsetMs) /
        props.timelineDurationMs) *
        100
    )
  );
  return {
    left: `${left}%`,
    top: `${props.topPx}px`,
    transform:
      left <= 0
        ? 'translateX(0)'
        : left >= 100
          ? 'translateX(-100%)'
          : 'translateX(-50%)',
    '--switch-pointer-x': left <= 0 ? '0%' : left >= 100 ? '100%' : '50%',
  };
});
</script>

<style scoped>
.switch-event-marker {
  --switch-pointer-x: 50%;
  position: absolute;
  z-index: 7;
  display: grid;
  width: 34px;
  height: 38px;
  grid-template-rows: 9px 24px 5px;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: #eef5f7;
  cursor: grab;
}

.switch-event-frame-label {
  display: block;
  min-width: 24px;
  padding: 0 2px;
  border: 1px solid #4e6069;
  border-radius: 2px;
  background: #171d21;
  font-size: 8px;
  font-weight: 800;
  line-height: 9px;
  white-space: nowrap;
}

.switch-event-avatar {
  position: relative;
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  overflow: hidden;
  border: 2px solid #7fb1d8;
  border-radius: 50%;
  background: #26333c;
  color: #ffffff;
  font-size: 10px;
  font-weight: 800;
}

.switch-event-avatar img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.switch-event-avatar img.missing {
  display: none;
}

.switch-event-pointer {
  position: absolute;
  bottom: 0;
  left: var(--switch-pointer-x);
  width: 0;
  height: 0;
  border-top: 5px solid #7fb1d8;
  border-right: 4px solid transparent;
  border-left: 4px solid transparent;
  transform: translateX(-50%);
}

.switch-event-marker:hover .switch-event-avatar,
.switch-event-marker:focus-visible .switch-event-avatar,
.switch-event-marker.selected .switch-event-avatar,
.switch-event-marker.multi-selected .switch-event-avatar,
.switch-event-marker.cursor-active .switch-event-avatar {
  border-color: #ffffff;
}

.switch-event-marker:focus-visible {
  outline: none;
}

.switch-event-marker.dragging {
  cursor: grabbing;
}

.switch-event-marker.readiness-blocked .switch-event-avatar {
  border-color: #ef767a;
  filter: grayscale(0.45);
}

.switch-event-marker.readiness-blocked .switch-event-pointer {
  border-top-color: #ef767a;
}
</style>
