<template>
  <div class="link-line-container">
    <svg
      class="link-line-svg"
      :width="width"
      :height="height"
      @click="handleClick"
    >
      <path
        :d="path"
        :stroke="lineColor"
        :stroke-width="isHovered ? 3 : 2"
        :stroke-dasharray="isSatisfied ? '0' : '5,5'"
        fill="none"
        stroke-linecap="round"
        @mouseenter="isHovered = true"
        @mouseleave="isHovered = false"
      />
      <circle :cx="startX" :cy="startY" r="4" :fill="lineColor" />
      <circle :cx="endX" :cy="endY" r="4" :fill="lineColor" />
    </svg>
    <!-- 悬浮提示 -->
    <div v-if="isHovered" class="link-tooltip" :style="tooltipStyle">
      <div class="tooltip-content">
        <div class="tooltip-title">技能连携</div>
        <div class="tooltip-item">
          <span>源技能:</span>
          <span>{{ sourceSkillName }}</span>
        </div>
        <div class="tooltip-item">
          <span>目标技能:</span>
          <span>{{ targetSkillName }}</span>
        </div>
        <div class="tooltip-item">
          <span>状态:</span>
          <span :class="isSatisfied ? 'satisfied' : 'unsatisfied'">
            {{ isSatisfied ? '满足' : '不满足' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

// Props
const props = defineProps({
  sourceBlock: {
    type: Object,
    required: true,
  },
  targetBlock: {
    type: Object,
    required: true,
  },
  sourceTrackIndex: {
    type: Number,
    required: true,
  },
  targetTrackIndex: {
    type: Number,
    required: true,
  },
  scale: {
    type: Number,
    default: 2,
  },
  trackHeight: {
    type: Number,
    default: 60,
  },
  isSatisfied: {
    type: Boolean,
    default: true,
  },
});

// Emits
const emit = defineEmits(['select', 'toggle-dependency']);

// 响应式数据
const isHovered = ref(false);

// 计算属性
const width = computed(() => {
  const maxX = Math.max(
    props.sourceBlock.startFrame * props.scale + 100,
    props.targetBlock.startFrame * props.scale + 100
  );
  return maxX + 50;
});

const height = computed(() => {
  const maxY = Math.max(props.sourceTrackIndex, props.targetTrackIndex) + 1;
  return maxY * props.trackHeight + 20;
});

const startX = computed(() => {
  return props.sourceBlock.endFrame * props.scale;
});

const startY = computed(() => {
  return (props.sourceTrackIndex + 0.5) * props.trackHeight + 8;
});

const endX = computed(() => {
  return props.targetBlock.startFrame * props.scale;
});

const endY = computed(() => {
  return (props.targetTrackIndex + 0.5) * props.trackHeight + 8;
});

const path = computed(() => {
  // 计算贝塞尔曲线控制点
  const controlPoint1X = startX.value + 100;
  const controlPoint1Y = startY.value;
  const controlPoint2X = endX.value - 100;
  const controlPoint2Y = endY.value;

  return `M ${startX.value} ${startY.value} C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${endX.value} ${endY.value}`;
});

const lineColor = computed(() => {
  return props.isSatisfied ? '#67C23A' : '#F56C6C';
});

const sourceSkillName = computed(() => {
  return props.sourceBlock.skillName;
});

const targetSkillName = computed(() => {
  return props.targetBlock.skillName;
});

const tooltipStyle = computed(() => {
  const centerX = (startX.value + endX.value) / 2;
  const centerY = (startY.value + endY.value) / 2;
  return {
    left: `${centerX}px`,
    top: `${centerY - 50}px`,
    transform: 'translateX(-50%)',
  };
});

// 方法
const handleClick = event => {
  event.stopPropagation();
  emit('select', {
    sourceBlockId: props.sourceBlock.id,
    targetBlockId: props.targetBlock.id,
  });
};
</script>

<style scoped>
.link-line-container {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: all;
  z-index: 5;
}

.link-line-svg {
  pointer-events: all;
}

.link-tooltip {
  position: absolute;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  z-index: 100;
  pointer-events: none;
  white-space: nowrap;
}

.tooltip-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tooltip-title {
  font-weight: bold;
  margin-bottom: 4px;
}

.tooltip-item {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.tooltip-item span:first-child {
  color: #ccc;
}

.satisfied {
  color: #67c23a;
}

.unsatisfied {
  color: #f56c6c;
}
</style>
