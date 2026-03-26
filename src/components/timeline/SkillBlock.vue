<template>
  <div
    :id="`action-${skillBlock.instanceId}`"
    class="skill-block-wrapper"
    :class="{
      'is-selected': isSelected,
      'is-disabled': skillBlock.isDisabled,
      'is-locked': skillBlock.isLocked
    }"
    :style="skillStyle"
    @click.stop="selectSkillBlock"
    @dblclick="openEditPanel"
    @mousedown="onMouseDown"
    @contextmenu="onContextMenu"
  >
    <!-- 冷却条 -->
    <div v-if="effectiveCooldown > 0" class="cd-bar-container bottom-bar" :style="cdStyle">
      <div class="cd-line" :style="{ backgroundColor: themeColor }"></div>
      <span class="cd-text" :style="{ color: themeColor }">{{ formatTime(effectiveCooldown) }}</span>
      <div class="cd-end-mark" :style="{ backgroundColor: themeColor }"></div>
    </div>

    <!-- 强化时间条 -->
    <div v-if="skillBlock.type === 'ultimate' && (skillBlock.enhancementTime || 0) > 0" 
         class="cd-bar-container bottom-bar" 
         :style="enhancementStyle">
      <div class="cd-line" style="background-color: #b37feb;"></div>
      <span class="cd-text" style="color: #b37feb;">
        {{ formatTime(skillBlock.enhancementTime) }}
        <span v-if="enhancementExtension > 0" class="extension-label">(+{{ formatTime(enhancementExtension) }})</span>
      </span>
      <div class="cd-end-mark" style="background-color: #b37feb;"></div>
    </div>

    <!-- 伤害判定点 -->
    <div class="damage-ticks-layer">
      <div 
        v-for="(tick, idx) in renderableTicks" 
        :key="idx"
        class="damage-tick-wrapper"
        :style="tick.style"
        :title="getDamageTickTitle(tick)"
      >
        <div class="tick-marker"></div>
      </div>
    </div>

    <!-- 触发窗口 -->
    <div v-if="skillBlock.triggerWindow && skillBlock.triggerWindow !== 0" class="trigger-window-bar bottom-bar" :style="triggerWindowStyle">
      <div class="tw-dot"></div>
      <div class="tw-separator"></div>
    </div>

    <!-- 状态图标 -->
    <div v-if="skillBlock.isLocked" class="status-icon lock-icon" title="技能已锁定">
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
    </div>

    <div v-if="skillBlock.isDisabled" class="status-icon mute-icon" title="技能已禁用">
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
      </svg>
    </div>

    <!-- 技能内容 -->
    <div class="skill-block-content">
      <div class="skill-icon" :style="{ backgroundColor: themeColor }"></div>
      <div class="skill-info">
        <div class="skill-name">{{ displayLabel }}</div>
        <div class="skill-time">{{ formatTimeRange }}</div>
      </div>
    </div>

    <!-- 异常状态（BUFF）条 -->
    <div class="anomalies-overlay">
      <div 
        v-for="(item, index) in renderableAnomalies" 
        :key="`${item.rowIndex}-${item.colIndex}`"
        class="anomaly-wrapper" 
        :style="item.style"
        :data-id="item.effectId"
      >
        <div 
          :id="item.effectId"
          class="anomaly-icon-box"
          @click.stop="selectAnomaly(item)"
        >
          <img :src="getIconPath(item.data.type)" class="anomaly-icon" />
          <div v-if="item.data.stacks > 1" class="anomaly-stacks">{{ item.data.stacks }}</div>
        </div>

        <div class="anomaly-duration-bar"
             v-if="!item.data.hideDuration"
             :style="{
               width: `${item.barWidth}px`,
               backgroundColor: getEffectColor(item.data.type),
               display: (item.displayDuration > 0 || item.data.duration > 0 || item.isConsumed) ? 'flex' : 'none'
             }"
             :class="{ 'is-consumed-bar': item.isConsumed }"
        >
          <div class="striped-bg"></div>
          <span class="duration-text">
            {{ formatTime(item.isConsumed ? item.displayDuration : item.data.duration) }}
            <span v-if="!item.isConsumed && item.extensionAmount > 0" class="extension-label">(+{{ formatTime(item.extensionAmount) }})</span>
          </span>
        </div>
      </div>
    </div>

    <!-- 调整大小手柄 -->
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
  'context-menu'
]);

// 响应式数据
const isDragging = ref(false);
const isResizing = ref(false);
const startX = ref(0);
const dragStartFrame = ref(0);
const startWidth = ref(0);

// 计算属性
const startFrame = computed(() => props.skillBlock.startTime);
const duration = computed(() => props.skillBlock.duration);
const endFrame = computed(() => props.skillBlock.startTime + props.skillBlock.duration);
const skillName = computed(() => props.skillBlock.name || props.skillBlock.skillName);

// 主题色
const themeColor = computed(() => {
  if (props.skillBlock.customColor) return props.skillBlock.customColor;
  if (props.skillBlock.type === 'link') return '#fdd900';
  if (props.skillBlock.type === 'execution') return '#a61d24';
  if (props.skillBlock.type === 'attack') return '#aaaaaa';
  if (props.skillBlock.type === 'dodge') return '#69c0ff';
  if (props.skillBlock.element) return getElementColor(props.skillBlock.element);
  return props.elementColor;
});

// 显示标签
const displayLabel = computed(() => {
  const name = skillName.value || '';
  const type = props.skillBlock.type;
  const width = props.scale * duration.value;

  const TYPE_SHORTHAND = {
    'attack': 'A', 'dodge': 'D', 'execution': 'X', 'skill': 'C', 'link': 'E', 'ultimate': 'U'
  };

  if (width >= 60) return name;
  return TYPE_SHORTHAND[type] || '?';
});

// 时间范围显示
const formatTimeRange = computed(() => {
  return `${formatTime(startFrame.value)} - ${formatTime(endFrame.value)}`;
});

// 冷却时间
const effectiveCooldown = computed(() => {
  const baseCd = props.skillBlock.cooldown || 0;
  if (props.skillBlock.type !== 'link') return baseCd;
  // 这里可以添加连携冷却 reduction 逻辑
  return baseCd;
});

// 技能样式
const skillStyle = computed(() => {
    const left = startFrame.value * props.scale;
    const width = duration.value * props.scale;
    const color = themeColor.value;

    const style = {
      position: 'absolute',
      top: '4px',
      left: `${left}px`,
      width: `${width}px`,
      height: '32px',
      boxSizing: 'border-box',
      zIndex: 100,
    };

  if (props.skillBlock.isDisabled) {
    return {
      ...style,
      border: '2px dashed #555',
      backgroundColor: 'rgba(40,40,40, 0.3)',
      color: '#777',
      opacity: 0.6,
      backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.5) 5px, rgba(0,0,0,0.5) 10px)'
    };
  }

  if (props.skillBlock.type === 'ultimate') {
    return {
      ...style,
      border: `1.5px solid ${color}`,
      background: `radial-gradient(circle at center,
      ${hexToRgba(color, 0.5)} 0%,
      ${hexToRgba(color, 0.2)} 70%,
      ${hexToRgba(color, 0.1)} 100%)`,
      boxShadow: `0 0 15px ${hexToRgba(color, 0.5)}`,
      borderRadius: '2px',
      padding: '0 6px',
    };
  }

  if (props.skillBlock.type === 'link') {
    return {
      ...style,
      border: `1.5px solid ${color}`,
      borderRadius: '2px',
      backgroundColor: hexToRgba(color, 0.15),
      boxShadow: props.isSelected ? `0 0 8px ${color}` : 'none',
      backdropFilter: 'blur(4px)',
      color: props.isSelected ? '#ffffff' : color,
    };
  }

  return {
    ...style,
    border: props.isSelected ? `2px dashed #ffffff` : `1.5px solid ${hexToRgba(color, 0.4)}`,
    backgroundColor: hexToRgba(color, 0.15),
    backdropFilter: 'blur(4px)',
    color: props.isSelected ? '#ffffff' : color,
    boxShadow: props.isSelected ? `0 0 10px ${color}` : 'none'
  };
});

// 冷却条样式
const cdStyle = computed(() => {
  const start = Number(props.skillBlock.startTime) || 0;
  const cdVal = effectiveCooldown.value;

  if (cdVal <= 0) return { display: 'none' };

  const width = cdVal * props.scale;
  return {
    width: `${width}px`,
    transform: `translate(0, 32px)`,
    opacity: 0.6
  };
});

// 强化时间样式
const enhancementStyle = computed(() => {
  const start = Number(props.skillBlock.startTime) || 0;
  const end = start + (props.skillBlock.duration || 0);
  const time = Number(props.skillBlock.enhancementTime) || 0;

  if (time <= 0) return { display: 'none' };

  const width = time * props.scale;
  return {
    width: `${width}px`,
    transform: `translate(${duration.value * props.scale}px, 32px)`,
    opacity: 0.8
  };
});

// 强化时间延长量
const enhancementExtension = computed(() => {
  // 这里可以添加强化时间延长的计算逻辑
  return 0;
});

// 触发窗口样式
const triggerWindowStyle = computed(() => {
  const windowDuration = Math.abs(props.skillBlock.triggerWindow || 0);
  if (windowDuration <= 0) return { display: 'none' };

  const width = windowDuration * props.scale;
  return {
    width: `${width}px`,
    transform: `translate(0, 32px)`,
    '--tw-color': themeColor.value
  };
});

// 伤害判定点
const renderableTicks = computed(() => {
  const ticks = props.skillBlock.damageTicks || [];
  return ticks.map(tick => {
    const originalOffset = tick.offset || 0;
    const left = (originalOffset / duration.value) * 100;
    return {
      style: { left: `${left}%` },
      data: tick
    };
  });
});

// 异常状态（BUFF）
const renderableAnomalies = computed(() => {
  const raw = props.skillBlock.physicalAnomaly || props.skillBlock.buffs || [];
  if (raw.length === 0) return [];
  const rows = Array.isArray(raw[0]) ? raw : [raw];
  const resultRows = [];

  let globalFlatIndex = 0;

  rows.forEach((row, rowIndex) => {
    row.forEach((effect, colIndex) => {
      const myEffectIndex = globalFlatIndex++;
      const effectId = effect._id || `effect_${myEffectIndex}`;
      
      const offset = effect.offset || 0;
      const duration = effect.duration || 0;
      const left = (offset / props.skillBlock.duration) * 100;
      const barWidth = (duration / props.skillBlock.duration) * 100;

      resultRows.push({
        data: effect, 
        rowIndex, 
        colIndex, 
        flatIndex: myEffectIndex,
        style: {
          left: `${left}%`,
          top: `${rowIndex * 24}px`,
          zIndex: 15 + rowIndex,
        },
        barWidth: barWidth * props.scale,
        isConsumed: effect.isConsumed || false,
        displayDuration: duration,
        extensionAmount: effect.extensionAmount || 0,
        effectId: effectId
      });
    });
  });
  return resultRows;
});

// 方法
const selectSkillBlock = () => {
  emit('select', props.skillBlock.id);
};

const openEditPanel = () => {
  emit('edit', props.skillBlock.id);
};

const selectAnomaly = (item) => {
  // 选择异常状态的逻辑
  console.log('Select anomaly:', item);
};

const onMouseDown = event => {
  // 防止事件冒泡
  event.stopPropagation();

  // 检查是否点击了调整手柄
  if (event.target.classList.contains('resize-handle')) {
    return;
  }

  // 如果技能被锁定，不允许拖拽
  if (props.skillBlock.isLocked) {
    return;
  }

  // 开始拖拽
  isDragging.value = true;
  startX.value = event.clientX;
  dragStartFrame.value = props.skillBlock.startTime;

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
  startWidth.value = props.skillBlock.duration;

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
  const newEndFrame = props.skillBlock.startTime + newWidth;

  emit('resize-move', props.skillBlock.id, newEndFrame);
};

const onResizeEnd = () => {
  isResizing.value = false;
  emit('resize-end', props.skillBlock.id);

  // 移除全局事件监听器
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
};

const onContextMenu = (event) => {
  event.preventDefault();
  event.stopPropagation();
  emit('context-menu', props.skillBlock.id, {
    x: event.clientX,
    y: event.clientY
  });
};

// 辅助函数
const formatTime = (frame) => {
  const seconds = Math.floor(frame / 60);
  const frames = frame % 60;
  return `${seconds}.${frames.toString().padStart(2, '0')}s`;
};

const getDamageTickTitle = (tick) => {
  if (!tick.data) return '';
  return `伤害判定点\n时间: ${formatTime(tick.data.offset || 0)}\n倍率: ${tick.data.multiplier || 1}x\n元素: ${tick.data.element || '物理'}`;
};

const getElementColor = (element) => {
  const ELEMENT_COLORS = {
    'blaze': '#ff4d4f', 'cold': '#00e5ff', 'emag': '#ffbf00', 'nature': '#52c41a', 'physical': '#e0e0e0',
    'link': '#fdd900', 'execution': '#a61d24', 'dodge': '#69c0ff', 'skill': '#ffffff', 'ultimate': '#00e5ff', 'attack': '#aaaaaa', 'default': '#8c8c8c',
  };
  return ELEMENT_COLORS[element] || ELEMENT_COLORS.default;
};

const getEffectColor = (type) => {
  return getElementColor(type);
};

const getIconPath = (type) => {
  // 这里可以根据类型返回对应的图标路径
  return `/icons/effects/${type || 'default'}.png`;
};

const hexToRgba = (hex, alpha) => {
  if (!hex) return `rgba(255,255,255,${alpha})`;
  let c = hex.substring(1).split('');
  if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
  c = '0x' + c.join('');
  return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
};
</script>

<style scoped>
/* 基础容器 */
.skill-block-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  cursor: grab;
  user-select: none;
  position: relative;
  overflow: visible;
  transition: background-color 0.2s, box-shadow 0.2s, filter 0.2s;
  font-weight: bold;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

.skill-block-wrapper:hover {
  filter: brightness(1.2);
}

.skill-block-wrapper.is-selected {
  z-index: 1000 !important;
}

.skill-block-wrapper.is-disabled {
  cursor: not-allowed;
}

/* 技能内容 */
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
  color: var(--text-color, #ffffff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.skill-time {
  font-size: 10px;
  color: var(--text-color-secondary, #cccccc);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 调整大小手柄 */
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

/* 冷却条 */
.bottom-bar {
  position: absolute;
  left: 0;
}

.cd-bar-container {
  position: absolute;
  height: 2px;
  display: flex;
  align-items: center;
  pointer-events: none;
}

.cd-line {
  flex-grow: 1;
  height: 2px;
}

.cd-text {
  position: absolute;
  left: 0;
  top: 4px;
  font-size: 10px;
  font-weight: bold;
  line-height: 1;
}

.cd-end-mark {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 1px;
  height: 8px;
}

/* 伤害判定点 */
.damage-ticks-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 12;
}

.damage-tick-wrapper {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 12px;
  margin-left: -6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  pointer-events: auto;
  z-index: 20;
}

.tick-marker {
  width: 6px;
  height: 6px;
  background-color: #ff4d4f;
  border: 1px solid #333;
  transform: translateY(50%) rotate(45deg);
  box-shadow: 0 1px 2px rgba(0,0,0,0.5);
  transition: all 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.damage-tick-wrapper:hover .tick-marker {
  background-color: #ffd700;
  border-color: #fff;
  transform: translateY(50%) rotate(45deg) scale(2.0);
  box-shadow: 0 0 8px rgba(255, 215, 0, 1);
  z-index: 30;
}

/* 触发窗口 */
.trigger-window-bar {
  position: absolute;
  --tw-width: 0px;
  --tw-color: transparent;
  width: var(--tw-width);
  height: 2px;
  display: flex;
  align-items: center;
  pointer-events: auto;
  cursor: pointer;
  z-index: 5;
}

.trigger-window-bar::after {
  content: '';
  position: absolute;
  top: -4px;
  bottom: -4px;
  left: 0;
  right: 0;
  background: transparent;
}

.trigger-window-bar::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  height: 2px;
  background-color: var(--tw-color);
  opacity: 1;
  border-radius: 2px 0 0 2px;
}

.tw-separator {
  position: absolute;
  right: 0;
  top: -2px;
  width: 1px;
  height: 8px;
  background-color: var(--tw-color);
  transform: translateX(50%);
}

.tw-dot {
  position: absolute;
  left: 0;
  top: 50%;
  width: 1px;
  height: 8px;
  background-color: var(--tw-color);
  border-radius: 0;
  z-index: 6;
  transform: translate(-50%, -50%);
}

/* 状态图标 */
.status-icon {
  position: absolute;
  top: 2px;
  font-size: 10px;
  z-index: 25;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.8));
  pointer-events: none;
}

.lock-icon {
  left: 2px;
}

.mute-icon {
  right: 2px;
}

/* 异常状态（BUFF） */
.anomalies-overlay {
  position: absolute;
  top: 0;
  left: -1px;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}

.anomaly-wrapper {
  position: absolute;
  display: flex;
  align-items: center;
  pointer-events: none;
  white-space: nowrap;
  bottom: 100%;
}

.anomaly-icon-box {
  width: 20px;
  height: 20px;
  background-color: #333;
  border: 1px solid #999;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 10;
  flex-shrink: 0;
  pointer-events: auto;
  cursor: pointer;
  transition: transform 0.1s, border-color 0.1s, box-shadow 0.2s;
}

.anomaly-icon-box:hover {
  border-color: #ffd700;
  transform: scale(1.2);
  z-index: 20;
}

.anomaly-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.anomaly-stacks {
  position: absolute;
  bottom: -2px;
  right: -2px;
  background: rgba(0, 0, 0, 0.8);
  color: #ffd700;
  font-size: 8px;
  padding: 0 2px;
  line-height: 1;
  border-radius: 2px;
}

/* 异常状态持续时间条 */
.anomaly-duration-bar {
  height: 16px;
  border: none;
  border-radius: 2px;
  position: relative;
  display: flex;
  align-items: center;
  overflow: visible;
  box-sizing: border-box;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  z-index: 1;
  margin-left: 2px;
}

.is-consumed-bar {
  opacity: 0.95;
  border-right: none;
}

.striped-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  background: repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.2) 2px, transparent 2px, transparent 6px);
}

.duration-text {
  position: absolute;
  left: 4px;
  font-size: 11px;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  z-index: 2;
  font-weight: bold;
  line-height: 1;
  font-family: sans-serif;
}

.extension-label {
  font-size: 9px;
  opacity: 0.8;
  margin-left: 2px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .skill-block-wrapper {
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