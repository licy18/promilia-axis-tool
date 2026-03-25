<template>
  <div
    class="skill-block"
    :class="{
      active: isSelected,
      dragging: isDragging,
      resizing: isResizing,
    }"
    :style="{
      left: `${startFrame * scale}px`,
      width: `${(endFrame - startFrame) * scale}px`,
      backgroundColor: elementColor,
    }"
    @click="selectSkillBlock"
    @dblclick="openEditPanel"
    @mousedown="onMouseDown"
  >
    <div class="skill-block-content">
      <div class="skill-icon" :style="{ backgroundColor: elementColor }"></div>
      <div class="skill-info">
        <div class="skill-name">{{ skillName }}</div>
        <div class="skill-time">{{ startFrame }}-{{ endFrame }} 帧</div>
      </div>
    </div>
    <!-- 伤害判定点 -->
    <div v-if="judgmentPoints && judgmentPoints.length > 0" class="judgment-points">
      <div
        v-for="(point, index) in judgmentPoints"
        :key="index"
        class="judgment-point"
        :style="{
          left: `${(point.time / (endFrame - startFrame)) * 100}%`,
        }"
        :title="`${point.description || `伤害判定点 ${index + 1}`}\n倍率: ${point.multiplier}x\n元素: ${point.element}`"
      >
        <div class="judgment-point-icon" :style="{ backgroundColor: elementColor }"></div>
      </div>
    </div>
    <!-- 时序系统 -->
    <div v-if="timing" class="timing-system">
      <!-- Buff持续时间条 -->
      <div v-if="timing.buffs && timing.buffs.length > 0" class="buff-bars">
        <div
          v-for="(buff, index) in timing.buffs"
          :key="index"
          class="buff-bar"
          :style="{
            left: `${(buff.startTime / (endFrame - startFrame)) * 100}%`,
            width: `${(buff.duration * 60 / (endFrame - startFrame)) * 100}%`,
          }"
          :title="`${buff.name}\n持续时间: ${buff.duration}秒`"
        >
          <div class="buff-bar-fill"></div>
        </div>
      </div>
    </div>
    <!-- 状态效果系统 -->
    <div v-if="statusEffects && statusEffects.length > 0" class="status-effects">
      <div
        v-for="(effect, index) in statusEffects"
        :key="index"
        class="status-effect"
        :style="{
          left: `${(effect.startTime || 0) / (endFrame - startFrame) * 100}%`,
          width: `${(effect.duration * 60 / (endFrame - startFrame)) * 100}%`,
        }"
        :title="`${effect.type === 'mark' ? '印记' : '状态效果'}\n元素: ${effect.element}\n数量: ${effect.count}\n持续时间: ${effect.duration}秒\n操作: ${effect.operation === 'add' ? '增加' : '消耗'}`"
      >
        <div class="status-effect-icon" :style="{ backgroundColor: elementColor }"></div>
        <div class="status-effect-text">{{ effect.count }}</div>
      </div>
    </div>
    <div class="resize-handle" @mousedown="onResizeStart"></div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

// Props
const props = defineProps({
  skillBlock: {
    type: Object,
    required: true,
  },
  scale: {
    type: Number,
    default: 2,
  },
  isSelected: {
    type: Boolean,
    default: false,
  },
  elementColor: {
    type: String,
    default: '#409EFF',
  },
});

// Emits
const emit = defineEmits([
  'select',
  'edit',
  'drag-start',
  'drag-move',
  'drag-end',
  'resize-start',
  'resize-move',
  'resize-end',
]);

// 响应式数据
const isDragging = ref(false);
const isResizing = ref(false);
const startX = ref(0);
const dragStartFrame = ref(0);
const startWidth = ref(0);

// 计算属性
const startFrame = computed(() => props.skillBlock.startFrame);
const endFrame = computed(() => props.skillBlock.endFrame);
const skillName = computed(() => props.skillBlock.skillName);
const judgmentPoints = computed(() => props.skillBlock.judgmentPoints || []);
const timing = computed(() => props.skillBlock.timing || null);
const statusEffects = computed(() => props.skillBlock.statusEffects || []);

// 方法
const selectSkillBlock = () => {
  emit('select', props.skillBlock.id);
};

const openEditPanel = () => {
  emit('edit', props.skillBlock.id);
};

const onMouseDown = event => {
  // 防止事件冒泡
  event.stopPropagation();

  // 检查是否点击了调整手柄
  if (event.target.classList.contains('resize-handle')) {
    return;
  }

  // 开始拖拽
  isDragging.value = true;
  startX.value = event.clientX;
  dragStartFrame.value = props.skillBlock.startFrame;

  emit('drag-start', props.skillBlock.id);

  // 添加全局事件监听器
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
};

const onDragMove = event => {
  if (!isDragging.value) return;

  const deltaX = event.clientX - startX.value;
  const deltaFrame = Math.round(deltaX / props.scale);
  const newStartFrame = Math.max(0, dragStartFrame.value + deltaFrame);

  emit('drag-move', props.skillBlock.id, newStartFrame);
};

const onDragEnd = () => {
  isDragging.value = false;
  emit('drag-end', props.skillBlock.id);

  // 移除全局事件监听器
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
};

const onResizeStart = event => {
  event.stopPropagation();

  isResizing.value = true;
  startX.value = event.clientX;
  startWidth.value = props.skillBlock.endFrame - props.skillBlock.startFrame;

  emit('resize-start', props.skillBlock.id);

  // 添加全局事件监听器
  document.addEventListener('mousemove', onResizeMove);
  document.addEventListener('mouseup', onResizeEnd);
};

const onResizeMove = event => {
  if (!isResizing.value) return;

  const deltaX = event.clientX - startX.value;
  const deltaFrame = Math.round(deltaX / props.scale);
  const newWidth = Math.max(10, startWidth.value + deltaFrame); // 最小10帧
  const newEndFrame = props.skillBlock.startFrame + newWidth;

  emit('resize-move', props.skillBlock.id, newEndFrame);
};

const onResizeEnd = () => {
  isResizing.value = false;
  emit('resize-end', props.skillBlock.id);

  // 移除全局事件监听器
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
};
</script>

<style scoped>
.skill-block {
  position: absolute;
  top: 8px;
  height: 44px;
  border: 1px solid var(--primary-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
  display: flex;
  align-items: center;
}

.skill-block:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.skill-block.active {
  border-width: 2px;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.3);
  z-index: 10;
}

.skill-block.dragging {
  opacity: 0.8;
  z-index: 20;
}

.skill-block.resizing {
  cursor: ew-resize;
  z-index: 15;
}

.skill-block-content {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  height: 100%;
  flex: 1;
  min-width: 0;
}

.skill-icon {
  width: 24px;
  height: 24px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  flex-shrink: 0;
}

.skill-info {
  flex: 1;
  min-width: 0;
}

.skill-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.skill-time {
  font-size: 10px;
  color: var(--text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.resize-handle {
  position: absolute;
  right: 0;
  top: 0;
  width: 8px;
  height: 100%;
  cursor: ew-resize;
  background-color: rgba(255, 255, 255, 0.3);
  transition: background-color 0.2s;
}

.resize-handle:hover {
  background-color: rgba(255, 255, 255, 0.5);
}

/* 伤害判定点 */
.judgment-points {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 100%;
  pointer-events: none;
}

.judgment-point {
  position: absolute;
  top: 0;
  width: 12px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translateX(-50%);
  pointer-events: auto;
  cursor: pointer;
}

.judgment-point-icon {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
  transition: all 0.2s;
}

.judgment-point:hover .judgment-point-icon {
  transform: scale(1.2);
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.4);
}

/* 时序系统 */
.timing-system {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 100%;
  pointer-events: none;
}

.buff-bars {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
}

.buff-bar {
  position: absolute;
  bottom: 0;
  height: 100%;
  border-radius: 2px 2px 0 0;
  overflow: hidden;
  pointer-events: auto;
  cursor: pointer;
}

.buff-bar-fill {
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.7);
  transition: width 0.3s ease;
}

.buff-bar:hover .buff-bar-fill {
  background-color: rgba(255, 255, 255, 0.9);
}

/* 状态效果系统 */
.status-effects {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 100%;
  pointer-events: none;
}

.status-effect {
  position: absolute;
  top: 0;
  height: 100%;
  display: flex;
  align-items: center;
  padding: 0 4px;
  pointer-events: auto;
  cursor: pointer;
}

.status-effect-icon {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid white;
  margin-right: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-effect-text {
  font-size: 10px;
  color: white;
  font-weight: bold;
  text-shadow: 0 0 2px rgba(0, 0, 0, 0.5);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .skill-block {
    height: 36px;
  }

  .skill-icon {
    width: 20px;
    height: 20px;
  }

  .skill-name {
    font-size: 11px;
  }

  .skill-time {
    font-size: 9px;
  }
}
</style>
