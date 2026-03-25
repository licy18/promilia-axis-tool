<template>
  <div
    class="keyframe"
    :style="{
      left: `${keyframe.frame * scale}px`,
      backgroundColor: keyframe.color || '#E6A23C',
    }"
    @click="$emit('select', keyframe.id)"
  >
    <div class="keyframe-content">
      <span class="keyframe-name">{{ keyframe.name }}</span>
      <div class="keyframe-time">
        {{ formatTime(keyframe.frame) }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  keyframe: {
    type: Object,
    required: true,
  },
  scale: {
    type: Number,
    default: 1,
  },
});

const emit = defineEmits(['select']);

const formatTime = frames => {
  const seconds = Math.floor(frames / 60);
  const remainingFrames = frames % 60;
  return `${seconds}.${remainingFrames.toString().padStart(2, '0')}s`;
};
</script>

<style scoped>
.keyframe {
  position: absolute;
  top: 0;
  width: 2px;
  height: 100%;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 10;
}

.keyframe:hover {
  width: 4px;
  box-shadow: 0 0 8px rgba(230, 162, 60, 0.6);
}

.keyframe-content {
  position: absolute;
  top: -30px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  white-space: nowrap;
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}

.keyframe:hover .keyframe-content {
  opacity: 1;
}

.keyframe-name {
  font-weight: 500;
  display: block;
}

.keyframe-time {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 2px;
}
</style>
