<template>
  <div class="resource-curve-container" :style="{ width: `${totalWidth}px` }">
    <!-- 曲线控制栏 -->
    <div class="curve-controls">
      <div class="curve-toggle-group">
        <el-checkbox v-model="showStellarEnergy" label="星决能量" />
        <el-checkbox v-model="showCoreImprint" label="核心印记" />
      </div>
      <div class="character-toggle-group">
        <el-select v-model="selectedCharacter" placeholder="选择角色">
          <el-option label="全部角色" value="all" />
          <el-option
            v-for="character in characters"
            :key="character.id"
            :label="character.name"
            :value="character.id"
          />
        </el-select>
      </div>
    </div>

    <!-- 曲线绘制区域 -->
    <div
      class="curve-canvas"
      ref="curveCanvas"
      @mousemove="handleMouseMove"
      @click="handleClick"
    >
      <svg :width="canvasWidth" :height="canvasHeight" class="curve-svg">
        <!-- 网格线 -->
        <defs>
          <pattern
            id="grid"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="#e0e0e0"
              stroke-width="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        <!-- 坐标轴 -->
        <line
          x1="40"
          y1="0"
          x2="40"
          y2="100%"
          stroke="#909399"
          stroke-width="1"
        />
        <line
          x1="40"
          y1="180"
          x2="100%"
          y2="180"
          stroke="#909399"
          stroke-width="1"
        />

        <!-- 星决能量曲线 -->
        <g v-if="showStellarEnergy">
          <path
            :d="stellarEnergyPath"
            stroke="#409EFF"
            stroke-width="2"
            fill="none"
          />
          <!-- 峰值和谷值标记 -->
          <circle
            v-for="point in stellarEnergyPeaks"
            :key="`stellar-peak-${point.frame}`"
            :cx="getXCoordinate(point.frame)"
            :cy="getYCoordinate(point.value)"
            r="3"
            fill="#409EFF"
          />
          <circle
            v-for="point in stellarEnergyValleys"
            :key="`stellar-valley-${point.frame}`"
            :cx="getXCoordinate(point.frame)"
            :cy="getYCoordinate(point.value)"
            r="3"
            fill="#F56C6C"
          />
        </g>

        <!-- 核心印记曲线 -->
        <g v-if="showCoreImprint">
          <path
            :d="coreImprintPath"
            stroke="#67C23A"
            stroke-width="2"
            fill="none"
          />
          <!-- 峰值和谷值标记 -->
          <circle
            v-for="point in coreImprintPeaks"
            :key="`core-peak-${point.frame}`"
            :cx="getXCoordinate(point.frame)"
            :cy="getYCoordinate(point.value)"
            r="3"
            fill="#67C23A"
          />
          <circle
            v-for="point in coreImprintValleys"
            :key="`core-valley-${point.frame}`"
            :cx="getXCoordinate(point.frame)"
            :cy="getYCoordinate(point.value)"
            r="3"
            fill="#F56C6C"
          />
        </g>

        <!-- 角色专属资源曲线 -->
        <g v-if="selectedCharacter !== 'all' && characterResourcePath">
          <path
            :d="characterResourcePath"
            :stroke="characterColor"
            stroke-width="2"
            fill="none"
          />
          <!-- 峰值和谷值标记 -->
          <circle
            v-for="point in characterResourcePeaks"
            :key="`char-peak-${point.frame}`"
            :cx="getXCoordinate(point.frame)"
            :cy="getYCoordinate(point.value)"
            r="3"
            :fill="characterColor"
          />
          <circle
            v-for="point in characterResourceValleys"
            :key="`char-valley-${point.frame}`"
            :cx="getXCoordinate(point.frame)"
            :cy="getYCoordinate(point.value)"
            r="3"
            fill="#F56C6C"
          />
        </g>

        <!-- 鼠标悬停指示器 -->
        <g v-if="hoverData">
          <line
            :x1="hoverData.x"
            y1="0"
            :x2="hoverData.x"
            y2="180"
            stroke="#909399"
            stroke-width="1"
            stroke-dasharray="5,5"
          />
          <rect
            :x="hoverData.x + 10"
            y="10"
            width="150"
            height="80"
            fill="rgba(0,0,0,0.7)"
            rx="4"
          />
          <text :x="hoverData.x + 20" y="30" fill="white" font-size="12">
            时间: {{ formatTime(hoverData.frame) }}
          </text>
          <text :x="hoverData.x + 20" y="50" fill="#409EFF" font-size="12">
            星决能量: {{ hoverData.stellarEnergy }}
          </text>
          <text :x="hoverData.x + 20" y="70" fill="#67C23A" font-size="12">
            核心印记: {{ hoverData.coreImprint }}
          </text>
        </g>
      </svg>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';

const props = defineProps({
  project: {
    type: Object,
    required: true,
  },
  characters: {
    type: Array,
    default: () => [],
  },
  scale: {
    type: Number,
    default: 1,
  },
});

const emit = defineEmits(['jump-to-frame']);

// 响应式数据
const showStellarEnergy = ref(true);
const showCoreImprint = ref(true);
const selectedCharacter = ref('all');
const hoverData = ref(null);
const curveCanvas = ref(null);

// 计算属性
const totalWidth = computed(() => {
  return (props.project?.duration || 1200) * props.scale;
});

const canvasWidth = computed(() => {
  return totalWidth.value + 40; // 40px for y-axis
});

const canvasHeight = ref(200);

// 生成星决能量曲线数据
const stellarEnergyData = computed(() => {
  const data = [];
  const duration = props.project?.duration || 1200;

  // 模拟数据，实际应该从项目数据中计算
  for (let frame = 0; frame <= duration; frame += 10) {
    // 生成随机波动的能量值，范围 0-100
    const value = Math.sin(frame / 60) * 30 + Math.cos(frame / 120) * 20 + 50;
    data.push({ frame, value: Math.max(0, Math.min(100, value)) });
  }

  return data;
});

// 生成核心印记曲线数据
const coreImprintData = computed(() => {
  const data = [];
  const duration = props.project?.duration || 1200;

  // 模拟数据，实际应该从项目数据中计算
  for (let frame = 0; frame <= duration; frame += 10) {
    // 生成随机波动的印记层数，范围 0-5
    const value = Math.floor((Math.sin(frame / 90) + 1) * 2.5);
    data.push({ frame, value: Math.max(0, Math.min(5, value)) });
  }

  return data;
});

// 生成角色专属资源曲线数据
const characterResourceData = computed(() => {
  if (selectedCharacter.value === 'all') return [];

  const data = [];
  const duration = props.project?.duration || 1200;

  // 模拟数据，实际应该从项目数据中计算
  for (let frame = 0; frame <= duration; frame += 10) {
    // 生成随机波动的资源值，范围 0-80
    const value = Math.sin(frame / 75) * 25 + Math.cos(frame / 150) * 15 + 40;
    data.push({ frame, value: Math.max(0, Math.min(80, value)) });
  }

  return data;
});

// 计算曲线路径
const stellarEnergyPath = computed(() => {
  return generatePath(stellarEnergyData.value);
});

const coreImprintPath = computed(() => {
  return generatePath(coreImprintData.value);
});

const characterResourcePath = computed(() => {
  return generatePath(characterResourceData.value);
});

// 计算峰值和谷值
const stellarEnergyPeaks = computed(() => {
  return findPeaks(stellarEnergyData.value);
});

const stellarEnergyValleys = computed(() => {
  return findValleys(stellarEnergyData.value);
});

const coreImprintPeaks = computed(() => {
  return findPeaks(coreImprintData.value);
});

const coreImprintValleys = computed(() => {
  return findValleys(coreImprintData.value);
});

const characterResourcePeaks = computed(() => {
  return findPeaks(characterResourceData.value);
});

const characterResourceValleys = computed(() => {
  return findValleys(characterResourceData.value);
});

// 获取选中角色的元素颜色
const characterColor = computed(() => {
  if (selectedCharacter.value === 'all') return '#909399';

  const character = props.characters.find(
    c => c.id === selectedCharacter.value
  );
  return character?.elementColor || '#409EFF';
});

// 方法
const generatePath = data => {
  if (data.length === 0) return '';

  let path = `M ${getXCoordinate(data[0].frame)} ${getYCoordinate(data[0].value)}`;

  for (let i = 1; i < data.length; i++) {
    path += ` L ${getXCoordinate(data[i].frame)} ${getYCoordinate(data[i].value)}`;
  }

  return path;
};

const getXCoordinate = frame => {
  return 40 + frame * props.scale; // 40px offset for y-axis
};

const getYCoordinate = value => {
  // 映射值到画布高度，范围 0-180
  return 180 - (value / 100) * 180;
};

const findPeaks = data => {
  const peaks = [];

  for (let i = 1; i < data.length - 1; i++) {
    if (
      data[i].value > data[i - 1].value &&
      data[i].value > data[i + 1].value
    ) {
      peaks.push(data[i]);
    }
  }

  return peaks;
};

const findValleys = data => {
  const valleys = [];

  for (let i = 1; i < data.length - 1; i++) {
    if (
      data[i].value < data[i - 1].value &&
      data[i].value < data[i + 1].value
    ) {
      valleys.push(data[i]);
    }
  }

  return valleys;
};

const formatTime = frames => {
  const seconds = Math.floor(frames / 60);
  const remainingFrames = frames % 60;
  return `${seconds}.${remainingFrames.toString().padStart(2, '0')}s`;
};

const handleMouseMove = event => {
  const rect = curveCanvas.value.getBoundingClientRect();
  const x = event.clientX - rect.left;

  // 计算当前鼠标位置对应的帧
  const frame = Math.round((x - 40) / props.scale);

  if (frame >= 0 && frame <= (props.project?.duration || 1200)) {
    // 找到最接近的能量数据点
    const stellarEnergy = findClosestValue(stellarEnergyData.value, frame);
    const coreImprint = findClosestValue(coreImprintData.value, frame);

    hoverData.value = {
      x,
      frame,
      stellarEnergy: Math.round(stellarEnergy),
      coreImprint: Math.round(coreImprint),
    };
  } else {
    hoverData.value = null;
  }
};

const findClosestValue = (data, frame) => {
  let closest = data[0];
  let minDistance = Math.abs(data[0].frame - frame);

  for (let i = 1; i < data.length; i++) {
    const distance = Math.abs(data[i].frame - frame);
    if (distance < minDistance) {
      minDistance = distance;
      closest = data[i];
    }
  }

  return closest.value;
};

const handleClick = event => {
  if (hoverData.value) {
    emit('jump-to-frame', hoverData.value.frame);
  }
};

// 监听项目变化，重新计算数据
watch(
  () => props.project,
  () => {
    // 重新计算曲线数据
  },
  { deep: true }
);

onMounted(() => {
  // 初始化画布
  if (curveCanvas.value) {
    const rect = curveCanvas.value.getBoundingClientRect();
    canvasHeight.value = rect.height;
  }
});
</script>

<style scoped>
.resource-curve-container {
  border-top: 1px solid var(--border-color);
  background-color: var(--bg-color-light);
}

.curve-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-color-lighter);
}

.curve-toggle-group {
  display: flex;
  gap: 16px;
}

.character-toggle-group {
  min-width: 150px;
}

.curve-canvas {
  position: relative;
  height: 200px;
  overflow: hidden;
  background-color: white;
}

.curve-svg {
  display: block;
}
</style>
