<template>
  <div
    class="resource-block"
    :style="{
      left: `${resourceBlock.frame * scale}px`,
      width: `${Math.max(20, 10 * scale)}px`,
      backgroundColor: getResourceColor(resourceBlock.type),
    }"
    @click="$emit('select', resourceBlock.id)"
  >
    <div class="resource-block-content">
      <span class="resource-name">{{ resourceBlock.name }}</span>
      <span
        class="resource-value"
        :class="{
          positive: resourceBlock.value > 0,
          negative: resourceBlock.value < 0,
        }"
      >
        {{ resourceBlock.value > 0 ? '+' : '' }}{{ resourceBlock.value }}
      </span>
      <div class="resource-time">
        {{ formatTime(resourceBlock.frame) }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  resourceBlock: {
    type: Object,
    required: true,
  },
  scale: {
    type: Number,
    default: 1,
  },
});

const emit = defineEmits(['select']);

const getResourceColor = type => {
  const colors = {
    energy: '#409EFF', // 蓝色 - 能量
    health: '#67C23A', // 绿色 - 生命值
    mana: '#909399', // 灰色 -  mana
    special: '#E6A23C', // 黄色 - 特殊资源
  };
  return colors[type] || colors.special;
};

const formatTime = frames => {
  const seconds = Math.floor(frames / 60);
  const remainingFrames = frames % 60;
  return `${seconds}.${remainingFrames.toString().padStart(2, '0')}s`;
};
</script>

<style scoped>
.resource-block {
  position: absolute;
  top: 4px;
  height: 32px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.resource-block:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  opacity: 0.9;
}

.resource-block-content {
  display: flex;
  flex-direction: column;
  padding: 4px 6px;
  height: 100%;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
}

.resource-name {
  font-size: 11px;
  font-weight: 500;
  color: white;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.resource-value {
  font-size: 12px;
  font-weight: bold;
  color: white;
  margin: 2px 0;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.resource-value.positive {
  color: #67c23a;
}

.resource-value.negative {
  color: #f56c6c;
}

.resource-time {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.8);
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
</style>
