<template>
  <div class="equipment-library">
    <!-- 当前已选择的装备 -->
    <div v-if="selectedCharacter && getCharacterEquipment(selectedCharacter.id, 'armor')" class="selected-equipment-info">
      <h4>当前装备</h4>
      <div class="equipment-item selected">
        <div class="equipment-icon">
          <img :src="getCharacterEquipment(selectedCharacter.id, 'armor').icon" :alt="getCharacterEquipment(selectedCharacter.id, 'armor').name" />
        </div>
        <div class="equipment-info">
          <div class="equipment-name">{{ getCharacterEquipment(selectedCharacter.id, 'armor').name }}</div>
          <div class="equipment-meta">
            <span class="meta-item">{{ getCharacterEquipment(selectedCharacter.id, 'armor').category }}</span>
          </div>
          <div class="equipment-effect">{{ getCharacterEquipment(selectedCharacter.id, 'armor').effect }}</div>
        </div>
      </div>
    </div>
    
    <div class="library-controls">
      <el-input
        v-model="searchQuery"
        placeholder="搜索装备"
        prefix-icon="el-icon-search"
        size="small"
      />
      <el-select
        v-model="selectedCategory"
        placeholder="选择分类"
        size="small"
        style="margin-left: 8px; width: 120px"
      >
        <el-option label="全部" value="all" />
        <el-option
          v-for="category in equipmentCategories"
          :key="category"
          :label="category"
          :value="category"
        />
      </el-select>
    </div>
    
    <div class="equipment-list">
      <div
        v-for="equipment in filteredEquipment"
        :key="equipment.id"
        class="equipment-item"
        :class="{ 'is-selected': isEquipmentSelected(equipment.id) }"
        @click="selectEquipmentForCharacter(equipment)"
      >
        <div class="equipment-icon">
          <img :src="equipment.icon" :alt="equipment.name" />
        </div>
        <div class="equipment-info">
          <div class="equipment-name">{{ equipment.name }}</div>
          <div class="equipment-meta">
            <span class="meta-item">{{ equipment.category }}</span>
            <span class="meta-item">Lv.{{ equipment.level }}</span>
          </div>
          <div class="equipment-effect">{{ equipment.effect }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useProjectStore } from '../../store/project';
import { ElMessage } from 'element-plus';

const props = defineProps({
  characters: {
    type: Array,
    default: () => []
  },
  equipmentCategories: {
    type: Array,
    default: () => []
  },
  selectedCharacter: {
    type: Object,
    default: null
  },
  project: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['equipment-select']);
const projectStore = useProjectStore();

const searchQuery = ref('');
const selectedCategory = ref('all');

// 模拟装备数据
const equipmentData = ref([
  {
    id: 'eq1',
    name: '勇士之剑',
    category: '武器',
    level: 70,
    icon: '/icons/equipment/sword.png',
    effect: '物理伤害+10%, 攻击速度+5%'
  },
  {
    id: 'eq2',
    name: '法师长袍',
    category: '防具',
    level: 70,
    icon: '/icons/equipment/robe.png',
    effect: '法术伤害+15%, 最大MP+10%'
  },
  {
    id: 'eq3',
    name: '敏捷之靴',
    category: '饰品',
    level: 60,
    icon: '/icons/equipment/boots.png',
    effect: '移动速度+15%, 闪避率+5%'
  },
  {
    id: 'eq4',
    name: '力量护腕',
    category: '饰品',
    level: 50,
    icon: '/icons/equipment/bracer.png',
    effect: '力量+10, 物理伤害+5%'
  },
  {
    id: 'eq5',
    name: '智力戒指',
    category: '饰品',
    level: 50,
    icon: '/icons/equipment/ring.png',
    effect: '智力+10, 法术伤害+5%'
  },
  {
    id: 'eq6',
    name: '生命项链',
    category: '饰品',
    level: 40,
    icon: '/icons/equipment/necklace.png',
    effect: '最大HP+10%, 生命回复+5%'
  }
]);

const filteredEquipment = computed(() => {
  let result = equipmentData.value;
  
  // 按分类筛选
  if (selectedCategory.value !== 'all') {
    result = result.filter(item => item.category === selectedCategory.value);
  }
  
  // 按搜索关键词筛选
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(item => 
      item.name.toLowerCase().includes(query) ||
      item.effect.toLowerCase().includes(query)
    );
  }
  
  return result;
});

const selectEquipment = (equipment) => {
  emit('equipment-select', equipment);
};

// 获取角色的装备数据
const getCharacterEquipment = (characterId, slotKey) => {
  if (!props.project) return null;
  const characterData = projectStore.getCharacterData(props.project.id, characterId);
  if (characterData && characterData.equipment && characterData.equipment[slotKey]) {
    return equipmentData.value.find(eq => eq.id === characterData.equipment[slotKey]);
  }
  return null;
};

// 检查装备是否已选择
const isEquipmentSelected = (equipmentId) => {
  if (!props.selectedCharacter || !props.project) return false;
  const characterData = projectStore.getCharacterData(props.project.id, props.selectedCharacter.id);
  return characterData && characterData.equipment && characterData.equipment['armor'] === equipmentId;
};

// 为当前选中角色选择装备
const selectEquipmentForCharacter = (equipment) => {
  if (props.selectedCharacter && props.project) {
    projectStore.updateCharacterEquipment(props.project.id, props.selectedCharacter.id, 'armor', equipment.id);
    ElMessage.success(`已为 ${props.selectedCharacter.name} 选择装备: ${equipment.name}`);
  }
  emit('equipment-select', equipment);
};
</script>

<style scoped>
.equipment-library {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.library-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.equipment-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  max-height: calc(100vh - 200px);
}

.equipment-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background-color: var(--bg-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid var(--border-color);
}

.equipment-item:hover {
  background-color: var(--bg-color-hover);
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.equipment-item.is-selected {
  background-color: rgba(82, 196, 26, 0.15);
  border-color: #52c41a;
  box-shadow: 0 0 12px rgba(82, 196, 26, 0.2);
}

.equipment-item.selected {
  background-color: rgba(82, 196, 26, 0.1);
  border-color: #52c41a;
  margin-bottom: 16px;
}

.selected-equipment-info {
  margin-bottom: 16px;
}

.selected-equipment-info h4 {
  margin: 0 0 8px 0;
  color: #52c41a;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.equipment-icon {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  overflow: hidden;
  background-color: var(--bg-color-light);
  flex-shrink: 0;
}

.equipment-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.equipment-info {
  flex: 1;
  min-width: 0;
}

.equipment-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.equipment-meta {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
}

.meta-item {
  font-size: 12px;
  padding: 2px 6px;
  background-color: var(--bg-color-light);
  border-radius: 8px;
  color: var(--text-color-secondary);
}

.equipment-effect {
  font-size: 12px;
  color: var(--text-color-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>