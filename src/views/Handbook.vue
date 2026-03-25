<template>
  <div class="handbook">
    <div class="handbook-header">
      <h1>{{ $t('handbook.title') }}</h1>
      <div class="header-actions">
        <el-input
          v-model="searchQuery"
          placeholder="搜索角色或技能"
          style="width: 300px"
        />
      </div>
    </div>

    <div class="handbook-content">
      <div class="character-list">
        <div class="filter-section">
          <h3>筛选</h3>
          <el-select
            v-model="elementFilter"
            placeholder="元素"
            style="width: 100%; margin-bottom: 10px"
          >
            <el-option label="全部" value="" />
            <el-option
              v-for="element in elements"
              :key="element.id"
              :label="element.name"
              :value="element.id.replace('element_', '')"
            />
          </el-select>
          <el-select
            v-model="positionFilter"
            placeholder="定位"
            style="width: 100%"
          >
            <el-option label="全部" value="" />
            <el-option label="主C" value="主C" />
            <el-option label="副C" value="副C" />
            <el-option label="辅助" value="辅助" />
          </el-select>
        </div>
        <div class="characters">
          <div
            v-for="character in filteredCharacters"
            :key="character.id"
            class="character-item"
            :class="{ active: selectedCharacter?.id === character.id }"
            @click="selectCharacter(character)"
          >
            <div class="character-avatar">
              <img :src="character.avatar" :alt="character.name" />
            </div>
            <div class="character-info">
              <div class="character-name">{{ character.name }}</div>
              <div class="character-element">
                {{ getElementName(character.element) }}
              </div>
              <div class="character-position">{{ character.position }}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="character-detail">
        <div v-if="selectedCharacter" class="detail-content">
          <div class="detail-header">
            <div class="detail-avatar">
              <img
                :src="selectedCharacter.avatar"
                :alt="selectedCharacter.name"
              />
            </div>
            <div class="detail-info">
              <h2>{{ selectedCharacter.name }}</h2>
              <div class="detail-meta">
                <span class="meta-item">{{
                  getElementName(selectedCharacter.element)
                }}</span>
                <span class="meta-item">{{ selectedCharacter.position }}</span>
                <span class="meta-item">{{ selectedCharacter.weapon }}</span>
                <span class="meta-item">{{
                  '★'.repeat(selectedCharacter.rarity)
                }}</span>
              </div>
            </div>
          </div>

          <div class="stats-section">
            <h3>基础属性</h3>
            <div class="stats-grid">
              <div class="stat-item">
                <span class="stat-label">攻击力</span>
                <span class="stat-value">{{
                  selectedCharacter.stats.attack
                }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">防御力</span>
                <span class="stat-value">{{
                  selectedCharacter.stats.defense
                }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">生命值</span>
                <span class="stat-value">{{ selectedCharacter.stats.hp }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">速度</span>
                <span class="stat-value">{{
                  selectedCharacter.stats.speed
                }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">暴击率</span>
                <span class="stat-value"
                  >{{
                    (selectedCharacter.stats.criticalRate * 100).toFixed(1)
                  }}%</span
                >
              </div>
              <div class="stat-item">
                <span class="stat-label">暴击伤害</span>
                <span class="stat-value"
                  >{{
                    (selectedCharacter.stats.criticalDamage * 100).toFixed(1)
                  }}%</span
                >
              </div>
              <div class="stat-item">
                <span class="stat-label">元素精通</span>
                <span class="stat-value">{{
                  selectedCharacter.stats.elementalMastery
                }}</span>
              </div>
            </div>
          </div>

          <div class="skills-section">
            <h3>技能</h3>
            <div class="skills-list">
              <div
                v-for="skill in selectedCharacter.skills"
                :key="skill.id"
                class="skill-item"
              >
                <div class="skill-header">
                  <h4>{{ skill.name }}</h4>
                  <span class="skill-type">{{
                    getSkillTypeName(skill.type)
                  }}</span>
                  <span class="skill-element">{{
                    getElementName(skill.element)
                  }}</span>
                </div>
                <div class="skill-params">
                  <div class="param-item">
                    <span class="param-label">释放帧数</span>
                    <span class="param-value">{{ skill.frames.end }} 帧</span>
                  </div>
                  <div class="param-item">
                    <span class="param-label">前后摇</span>
                    <span class="param-value"
                      >{{ skill.frames.recovery }} 帧</span
                    >
                  </div>
                  <div class="param-item">
                    <span class="param-label">CD</span>
                    <span class="param-value">{{ skill.cooldown }} 秒</span>
                  </div>
                  <div class="param-item">
                    <span class="param-label">能量消耗</span>
                    <span class="param-value">{{ skill.energyCost }} 点</span>
                  </div>
                  <div class="param-item">
                    <span class="param-label">能量获取</span>
                    <span class="param-value">{{ skill.energyGain }} 点</span>
                  </div>
                  <div class="param-item">
                    <span class="param-label">伤害倍率</span>
                    <span class="param-value">
                      {{
                        Array.isArray(skill.damageMultiplier)
                          ? skill.damageMultiplier.join(' / ')
                          : skill.damageMultiplier
                      }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="passives-section">
            <h3>被动天赋</h3>
            <div class="passives-list">
              <div
                v-for="passive in selectedCharacter.passives"
                :key="passive.id"
                class="passive-item"
              >
                <h4>{{ passive.name }}</h4>
                <p>{{ passive.description }}</p>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-detail">
          <el-empty description="请选择一个角色查看详情" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useGamedataStore } from '../store/gamedata';

const gamedataStore = useGamedataStore();
const searchQuery = ref('');
const elementFilter = ref('');
const positionFilter = ref('');
const selectedCharacter = ref(null);

// 计算过滤后的角色列表
const filteredCharacters = computed(() => {
  let characters = gamedataStore.characters;

  // 按元素筛选
  if (elementFilter.value) {
    characters = characters.filter(
      character => character.element === elementFilter.value
    );
  }

  // 按定位筛选
  if (positionFilter.value) {
    characters = characters.filter(
      character => character.position === positionFilter.value
    );
  }

  // 按搜索词筛选
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    characters = characters.filter(character => {
      // 搜索角色名称
      if (character.name.toLowerCase().includes(query)) {
        return true;
      }
      // 搜索技能名称
      return character.skills.some(skill =>
        skill.name.toLowerCase().includes(query)
      );
    });
  }

  return characters;
});

// 元素列表
const elements = computed(() => {
  return gamedataStore.elements;
});

// 选择角色
const selectCharacter = character => {
  selectedCharacter.value = character;
};

// 获取元素名称
const getElementName = element => {
  const elementData = gamedataStore.elements.find(
    e => e.id === `element_${element}`
  );
  return elementData ? elementData.name : element;
};

// 获取技能类型名称
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

// 组件挂载时加载游戏数据
onMounted(() => {
  if (gamedataStore.characters.length === 0) {
    gamedataStore.loadGameData();
  }
  // 默认选择第一个角色
  if (gamedataStore.characters.length > 0) {
    selectedCharacter.value = gamedataStore.characters[0];
  }
});
</script>

<style scoped>
.handbook {
  min-height: 100vh;
  padding: 20px;
}

.handbook-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-color);
}

.handbook-header h1 {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-color);
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.handbook-content {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 20px;
  min-height: 600px;
}

.character-list {
  background-color: var(--bg-color-light);
  border-radius: 8px;
  padding: 20px;
  box-shadow: var(--box-shadow);
  overflow-y: auto;
}

.filter-section {
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-color);
}

.filter-section h3 {
  margin-bottom: 15px;
  font-size: 16px;
  font-weight: 600;
}

.characters {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.character-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  background-color: var(--bg-color-lighter);
}

.character-item:hover {
  background-color: var(--bg-color-hover);
}

.character-item.active {
  background-color: var(--primary-color-light);
  border-left: 4px solid var(--primary-color);
}

.character-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  overflow: hidden;
  background-color: var(--bg-color);
}

.character-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.character-info {
  flex: 1;
}

.character-name {
  font-weight: 600;
  margin-bottom: 2px;
}

.character-element,
.character-position {
  font-size: 12px;
  color: var(--text-color-secondary);
}

.character-detail {
  background-color: var(--bg-color-light);
  border-radius: 8px;
  padding: 20px;
  box-shadow: var(--box-shadow);
  overflow-y: auto;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-color);
}

.detail-avatar {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  overflow: hidden;
  background-color: var(--bg-color);
}

.detail-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.detail-info h2 {
  margin: 0 0 10px 0;
  font-size: 24px;
  font-weight: 600;
}

.detail-meta {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.meta-item {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  background-color: var(--bg-color-lighter);
  color: var(--text-color-secondary);
}

.stats-section,
.skills-section,
.passives-section {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.stats-section h3,
.skills-section h3,
.passives-section h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background-color: var(--bg-color-lighter);
  border-radius: 6px;
}

.stat-label {
  color: var(--text-color-secondary);
}

.stat-value {
  font-weight: 600;
}

.skills-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.skill-item {
  padding: 15px;
  background-color: var(--bg-color-lighter);
  border-radius: 6px;
}

.skill-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.skill-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  flex: 1;
}

.skill-type,
.skill-element {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  background-color: var(--bg-color);
  color: var(--text-color-secondary);
}

.skill-params {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.param-item {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.param-label {
  color: var(--text-color-secondary);
}

.passives-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.passive-item {
  padding: 15px;
  background-color: var(--bg-color-lighter);
  border-radius: 6px;
}

.passive-item h4 {
  margin: 0 0 5px 0;
  font-size: 14px;
  font-weight: 600;
}

.passive-item p {
  margin: 0;
  font-size: 14px;
  color: var(--text-color-secondary);
  line-height: 1.4;
}

.empty-detail {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

@media (max-width: 1024px) {
  .handbook-content {
    grid-template-columns: 1fr;
  }

  .character-list {
    order: 2;
    max-height: 300px;
  }

  .character-detail {
    order: 1;
  }
}

@media (max-width: 768px) {
  .handbook-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions .el-input {
    width: 100%;
  }

  .detail-header {
    flex-direction: column;
    text-align: center;
    gap: 10px;
  }

  .detail-meta {
    justify-content: center;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .skill-params {
    grid-template-columns: 1fr;
  }
}
</style>
