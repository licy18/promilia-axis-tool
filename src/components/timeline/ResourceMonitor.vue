<template>
  <div class="resource-monitor-container">
    <div class="resource-monitor-header">
      <h4>资源监控</h4>
      <el-select
        v-model="selectedResource"
        size="small"
        style="width: 120px"
      >
        <el-option label="SP" value="sp" />
        <el-option label="HP" value="hp" />
        <el-option label="MP" value="mp" />
      </el-select>
    </div>
    <div class="resource-monitor-content">
      <div
        v-for="character in characters"
        :key="character.id"
        class="character-resource"
      >
        <div class="character-info">
          <div class="character-avatar">
            <img :src="character.avatar" :alt="character.name" />
          </div>
          <span class="character-name">{{ character.name }}</span>
        </div>
        <div class="resource-bar-container">
          <div class="resource-bar">
            <div
              class="resource-fill"
              :style="{
                width: `${getResourcePercentage(character.id)}%`,
                backgroundColor: getResourceColor(character.id)
              }"
            ></div>
          </div>
          <span class="resource-value">{{ getResourceValue(character.id) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  project: {
    type: Object,
    default: null
  },
  characters: {
    type: Array,
    default: () => []
  },
  currentFrame: {
    type: Number,
    default: 0
  }
});

const selectedResource = ref('sp');

// 从项目数据中获取资源数据，根据当前帧计算实时值
const getResourceValue = (characterId) => {
  if (!props.project) return 0;
  
  // 从项目数据中获取角色的初始资源数据
  const character = props.project.characters.find(char => char.id === characterId);
  if (!character) return 0;
  
  // 获取初始值
  let initialValue = 0;
  switch (selectedResource.value) {
    case 'sp':
      initialValue = character.sp || 0;
      break;
    case 'hp':
      initialValue = character.hp || 0;
      break;
    case 'mp':
      initialValue = character.mp || 0;
      break;
    default:
      initialValue = 0;
  }
  
  // 获取资源变化事件
  const resourceEvents = props.project.resourceEvents || [];
  
  // 根据当前帧计算资源值
  let currentValue = initialValue;
  resourceEvents.forEach(event => {
    if (event.characterId === characterId && event.resourceType === selectedResource.value && event.frame <= props.currentFrame) {
      currentValue += event.change;
    }
  });
  
  // 确保值在合理范围内
  const maxValue = getResourceMax(characterId);
  return Math.max(0, Math.min(maxValue, currentValue));
};

const getResourceMax = (characterId) => {
  if (!props.project) return 100;
  
  // 从项目数据中获取角色的资源最大值
  const character = props.project.characters.find(char => char.id === characterId);
  if (!character) return 100;
  
  // 根据选择的资源类型返回对应最大值
  switch (selectedResource.value) {
    case 'sp':
      return character.maxSp || 100;
    case 'hp':
      return character.maxHp || 100;
    case 'mp':
      return character.maxMp || 100;
    default:
      return 100;
  }
};

const getResourcePercentage = (characterId) => {
  const max = getResourceMax(characterId);
  if (max === 0) return 0;
  const value = getResourceValue(characterId);
  return (value / max) * 100;
};

const getResourceColor = (characterId) => {
  const percentage = getResourcePercentage(characterId);
  if (percentage > 70) return '#67C23A'; // 绿色
  if (percentage > 30) return '#E6A23C'; // 黄色
  return '#F56C6C'; // 红色
};
</script>

<style scoped>
.resource-monitor-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.resource-monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-color-light);
}

.resource-monitor-header h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
  margin: 0;
}

.resource-monitor-content {
  flex: 1;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  background-color: var(--bg-color);
}

.character-resource {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background-color: var(--bg-color-light);
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

.character-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  min-width: 100px;
}

.character-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  overflow: hidden;
  background-color: var(--bg-color);
}

.character-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.character-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
}

.resource-bar-container {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.resource-bar {
  flex: 1;
  height: 8px;
  background-color: var(--bg-color);
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.resource-fill {
  height: 100%;
  transition: width 0.3s ease;
  border-radius: 4px;
}

.resource-value {
  font-size: 12px;
  color: var(--text-color);
  font-weight: 500;
  min-width: 30px;
  text-align: right;
}
</style>