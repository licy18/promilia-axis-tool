<template>
  <div class="skill-library">
    <div
      v-for="character in characters"
      :key="character.id"
      class="character-group"
    >
      <div class="character-header" @click="toggleCharacterGroup(character.id)">
        <div class="character-info">
          <div class="character-avatar">
            <img :src="character.avatar" :alt="character.name" />
          </div>
          <span class="character-name">{{ character.name }}</span>
          <span class="character-element">{{
            getElementName(character.element)
          }}</span>
        </div>
        <el-icon
          :class="{ rotated: expandedCharacters.includes(character.id) }"
        >
          <el-icon-arrow-down />
        </el-icon>
      </div>
      <div v-if="expandedCharacters.includes(character.id)" class="skill-list">
        <div
          v-for="skill in character.skills"
          :key="skill.id"
          class="skill-item"
          draggable="true"
          @dragstart="onSkillDragStart($event, skill, character.id)"
        >
          <div
            class="skill-icon"
            :style="{ backgroundColor: getElementColor(skill.element) }"
          ></div>
          <div class="skill-info">
            <div class="skill-name">{{ skill.name }}</div>
            <div class="skill-meta">
              <span class="meta-item">{{ skill.frames.end }} 帧</span>
              <span class="meta-item">{{ skill.cooldown }} 秒</span>
              <span class="meta-item">{{ getSkillTypeName(skill.type) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

// Props
const props = defineProps({
  characters: {
    type: Array,
    default: () => [],
  },
  elements: {
    type: Array,
    default: () => [],
  },
});

// Emits
const emit = defineEmits(['skill-drag-start']);

// 响应式数据
const expandedCharacters = ref([]);

// 方法
const toggleCharacterGroup = characterId => {
  const index = expandedCharacters.value.indexOf(characterId);
  if (index === -1) {
    expandedCharacters.value.push(characterId);
  } else {
    expandedCharacters.value.splice(index, 1);
  }
};

const onSkillDragStart = (event, skill, characterId) => {
  event.dataTransfer.setData(
    'application/json',
    JSON.stringify({
      skill,
      characterId,
    })
  );
  emit('skill-drag-start', { skill, characterId });
};

const getElementName = element => {
  const elementData = props.elements.find(e => e.id === `element_${element}`);
  return elementData ? elementData.name : element;
};

const getElementColor = element => {
  const elementData = props.elements.find(e => e.id === `element_${element}`);
  return elementData ? elementData.color : '#999999';
};

const getSkillTypeName = type => {
  const typeMap = {
    normal: '普攻',
    charge: '重击',
    skill: '星鸣技',
    ultimate: '星决技',
    combo: '星携技',
  };
  return typeMap[type] || type;
};

// 初始化展开所有角色
props.characters.forEach(character => {
  expandedCharacters.value.push(character.id);
});
</script>

<style scoped>
.skill-library {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.character-group {
  background-color: var(--bg-color-lighter);
  border-radius: 6px;
  overflow: hidden;
  box-shadow: var(--box-shadow-light);
}

.character-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  background-color: var(--bg-color);
}

.character-header:hover {
  background-color: var(--bg-color-hover);
}

.character-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.character-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  background-color: var(--bg-color-light);
  display: flex;
  align-items: center;
  justify-content: center;
}

.character-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.character-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
  white-space: nowrap;
}

.character-element {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  background-color: var(--bg-color-light);
  color: var(--text-color-secondary);
  white-space: nowrap;
}

.rotated {
  transform: rotate(180deg);
  transition: transform 0.3s;
}

.skill-list {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background-color: var(--bg-color-lighter);
}

.skill-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background-color: var(--bg-color);
  border-radius: 4px;
  cursor: grab;
  transition: all 0.2s;
  border: 1px solid var(--border-color);
}

.skill-item:hover {
  background-color: var(--bg-color-hover);
  border-color: var(--primary-color);
  transform: translateX(4px);
}

.skill-item:active {
  cursor: grabbing;
  transform: translateX(6px);
}

.skill-icon {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
}

.skill-info {
  flex: 1;
  min-width: 0;
}

.skill-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.skill-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.meta-item {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 8px;
  background-color: var(--bg-color-light);
  color: var(--text-color-secondary);
  white-space: nowrap;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .skill-library {
    padding: 12px;
  }

  .character-info {
    gap: 8px;
  }

  .character-avatar {
    width: 32px;
    height: 32px;
  }

  .character-name {
    font-size: 13px;
  }

  .skill-item {
    padding: 10px;
  }

  .skill-icon {
    width: 32px;
    height: 32px;
  }
}
</style>
