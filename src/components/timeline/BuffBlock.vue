<template>
  <div
    class="buff-block"
    :style="{
      left: `${buffBlock.startFrame * scale}px`,
      width: `${(buffBlock.endFrame - buffBlock.startFrame) * scale}px`,
      backgroundColor: getBuffColor(buffBlock.type),
      opacity: 0.7 + (buffBlock.stacks || 1) * 0.1,
    }"
    @click="$emit('select', buffBlock.id)"
  >
    <div class="buff-block-content">
      <span class="buff-name">{{ buffBlock.name }}</span>
      <span v-if="buffBlock.stacks > 1" class="buff-stacks"
        >x{{ buffBlock.stacks }}</span
      >
      <div class="buff-time">
        {{ formatTime(buffBlock.startFrame) }} -
        {{ formatTime(buffBlock.endFrame) }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  buffBlock: {
    type: Object,
    required: true,
  },
  scale: {
    type: Number,
    default: 1,
  },
});

const emit = defineEmits(['select']);

const getBuffColor = type => {
  const colors = {
    buff: '#67C23A', // 绿色 - 增益
    debuff: '#F56C6C', // 红色 - 减益
    neutral: '#409EFF', // 蓝色 - 中性
  };
  return colors[type] || colors.neutral;
};

const formatTime = frames => {
  const seconds = Math.floor(frames / 60);
  const remainingFrames = frames % 60;
  return `${seconds}.${remainingFrames.toString().padStart(2, '0')}s`;
};
</script>

<style scoped>
.buff-block {
  position: absolute;
  top: 4px;
  height: 32px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.buff-block:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  opacity: 0.9 !important;
}

.buff-block-content {
  display: flex;
  flex-direction: column;
  padding: 4px 8px;
  height: 100%;
  box-sizing: border-box;
}

.buff-name {
  font-size: 12px;
  font-weight: 500;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.buff-stacks {
  font-size: 10px;
  font-weight: bold;
  color: white;
  margin-left: 4px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.buff-time {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
</style>
