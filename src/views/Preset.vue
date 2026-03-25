<template>
  <div class="preset">
    <div class="preset-header">
      <h1>{{ $t('preset.title') }}</h1>
      <div class="header-actions">
        <el-button type="primary" @click="openSubmitDialog">
          提交预设
        </el-button>
      </div>
    </div>

    <div class="filter-section">
      <el-input
        v-model="searchQuery"
        placeholder="搜索预设"
        style="width: 300px; margin-right: 10px"
      />
      <el-select
        v-model="filterCharacter"
        placeholder="按角色筛选"
        style="width: 150px; margin-right: 10px"
      >
        <el-option label="全部角色" value="" />
        <el-option
          v-for="character in characters"
          :key="character.id"
          :label="character.name"
          :value="character.id"
        />
      </el-select>
      <el-select
        v-model="filterTeamType"
        placeholder="按配队类型筛选"
        style="width: 150px; margin-right: 10px"
      >
        <el-option label="全部类型" value="" />
        <el-option label="输出队" value="dps" />
        <el-option label="控制队" value="control" />
        <el-option label="辅助队" value="support" />
        <el-option label="混合队" value="hybrid" />
      </el-select>
      <el-select
        v-model="filterBoss"
        placeholder="按Boss筛选"
        style="width: 150px; margin-right: 10px"
      >
        <el-option label="全部Boss" value="" />
        <el-option label="Boss 1" value="boss1" />
        <el-option label="Boss 2" value="boss2" />
        <el-option label="Boss 3" value="boss3" />
      </el-select>
      <el-select
        v-model="filterDifficulty"
        placeholder="按难度筛选"
        style="width: 150px; margin-right: 10px"
      >
        <el-option label="全部难度" value="" />
        <el-option label="简单" value="easy" />
        <el-option label="普通" value="normal" />
        <el-option label="困难" value="hard" />
        <el-option label="专家" value="expert" />
      </el-select>
      <el-select v-model="sortBy" placeholder="排序方式" style="width: 150px">
        <el-option label="按时间" value="date" />
        <el-option label="按热度" value="popularity" />
      </el-select>
    </div>

    <div class="preset-tabs">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="热门配队" name="popular">
          <div class="preset-list">
            <div v-if="filteredPresets.length === 0" class="empty-state">
              <el-empty description="暂无预设" />
            </div>
            <div v-else class="preset-grid">
              <el-card
                v-for="preset in filteredPresets"
                :key="preset.id"
                class="preset-card"
                @click="loadPreset(preset)"
              >
                <template #header>
                  <div class="card-header">
                    <span class="preset-title">{{ preset.name }}</span>
                    <span class="preset-popularity"
                      >🔥 {{ preset.popularity }}</span
                    >
                  </div>
                </template>
                <div class="preset-info">
                  <div class="info-item">
                    <span class="label">角色:</span>
                    <span class="value">{{
                      preset.characters
                        .map(id => getCharacterName(id))
                        .join(', ')
                    }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">配队类型:</span>
                    <span class="value">{{
                      getTeamTypeName(preset.teamType)
                    }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">目标Boss:</span>
                    <span class="value">{{ preset.boss || '通用' }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">难度:</span>
                    <span class="value">{{
                      getDifficultyName(preset.difficulty)
                    }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">时长:</span>
                    <span class="value">{{ formatTime(preset.duration) }}</span>
                  </div>
                </div>
                <div class="card-footer">
                  <el-button
                    size="small"
                    type="primary"
                    @click.stop="loadPreset(preset)"
                  >
                    加载
                  </el-button>
                  <el-button size="small" @click.stop="copyPreset(preset)">
                    复制
                  </el-button>
                </div>
              </el-card>
            </div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="我的预设" name="my">
          <div class="preset-list">
            <div v-if="myPresets.length === 0" class="empty-state">
              <el-empty description="我的预设为空" />
            </div>
            <div v-else class="preset-grid">
              <el-card
                v-for="preset in myPresets"
                :key="preset.id"
                class="preset-card"
                @click="loadPreset(preset)"
              >
                <template #header>
                  <div class="card-header">
                    <span class="preset-title">{{ preset.name }}</span>
                  </div>
                </template>
                <div class="preset-info">
                  <div class="info-item">
                    <span class="label">角色:</span>
                    <span class="value">{{
                      preset.characters
                        .map(id => getCharacterName(id))
                        .join(', ')
                    }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">时长:</span>
                    <span class="value">{{ formatTime(preset.duration) }}</span>
                  </div>
                </div>
                <div class="card-footer">
                  <el-button
                    size="small"
                    type="primary"
                    @click.stop="loadPreset(preset)"
                  >
                    加载
                  </el-button>
                  <el-button
                    size="small"
                    type="danger"
                    @click.stop="deletePreset(preset.id)"
                  >
                    删除
                  </el-button>
                </div>
              </el-card>
            </div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="社区预设" name="community">
          <div class="preset-list">
            <div v-if="communityPresets.length === 0" class="empty-state">
              <el-empty description="社区预设为空" />
            </div>
            <div v-else class="preset-grid">
              <el-card
                v-for="preset in communityPresets"
                :key="preset.id"
                class="preset-card"
                @click="loadPreset(preset)"
              >
                <template #header>
                  <div class="card-header">
                    <span class="preset-title">{{ preset.name }}</span>
                    <span class="preset-author">作者: {{ preset.author }}</span>
                  </div>
                </template>
                <div class="preset-info">
                  <div class="info-item">
                    <span class="label">角色:</span>
                    <span class="value">{{
                      preset.characters
                        .map(id => getCharacterName(id))
                        .join(', ')
                    }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">配队类型:</span>
                    <span class="value">{{
                      getTeamTypeName(preset.teamType)
                    }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">目标Boss:</span>
                    <span class="value">{{ preset.boss || '通用' }}</span>
                  </div>
                </div>
                <div class="card-footer">
                  <el-button
                    size="small"
                    type="primary"
                    @click.stop="loadPreset(preset)"
                  >
                    加载
                  </el-button>
                </div>
              </el-card>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 提交预设对话框 -->
    <el-dialog v-model="submitDialogVisible" title="提交预设" width="500px">
      <el-form :model="submitForm" label-width="80px">
        <el-form-item label="预设名称">
          <el-input v-model="submitForm.name" placeholder="请输入预设名称" />
        </el-form-item>
        <el-form-item label="配队类型">
          <el-select v-model="submitForm.teamType" placeholder="请选择配队类型">
            <el-option label="输出队" value="dps" />
            <el-option label="控制队" value="control" />
            <el-option label="辅助队" value="support" />
            <el-option label="混合队" value="hybrid" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标Boss">
          <el-input v-model="submitForm.boss" placeholder="请输入目标Boss" />
        </el-form-item>
        <el-form-item label="难度">
          <el-select v-model="submitForm.difficulty" placeholder="请选择难度">
            <el-option label="简单" value="easy" />
            <el-option label="普通" value="normal" />
            <el-option label="困难" value="hard" />
            <el-option label="专家" value="expert" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            type="textarea"
            v-model="submitForm.description"
            placeholder="请输入预设描述"
            rows="3"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="submitDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitPreset">提交</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useProjectStore } from '../store/project';
import { useGamedataStore } from '../store/gamedata';
import { ElMessage } from 'element-plus';

const router = useRouter();
const projectStore = useProjectStore();
const gamedataStore = useGamedataStore();

// 响应式数据
const activeTab = ref('popular');
const searchQuery = ref('');
const filterCharacter = ref('');
const filterTeamType = ref('');
const filterBoss = ref('');
const filterDifficulty = ref('');
const sortBy = ref('date');
const submitDialogVisible = ref(false);

// 提交预设表单
const submitForm = ref({
  name: '',
  teamType: 'dps',
  boss: '',
  difficulty: 'normal',
  description: '',
});

// 预设数据
const presetData = ref([]);

// 计算属性
const characters = computed(() => {
  return gamedataStore.characters;
});

// 过滤后的预设
const filteredPresets = computed(() => {
  let filtered = [...presetData.value];

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(
      preset =>
        preset.name.toLowerCase().includes(query) ||
        preset.characters.some(id =>
          getCharacterName(id).toLowerCase().includes(query)
        )
    );
  }

  // 角色过滤
  if (filterCharacter.value) {
    filtered = filtered.filter(preset =>
      preset.characters.includes(filterCharacter.value)
    );
  }

  // 配队类型过滤
  if (filterTeamType.value) {
    filtered = filtered.filter(
      preset => preset.teamType === filterTeamType.value
    );
  }

  // Boss过滤
  if (filterBoss.value) {
    filtered = filtered.filter(preset => preset.boss === filterBoss.value);
  }

  // 难度过滤
  if (filterDifficulty.value) {
    filtered = filtered.filter(
      preset => preset.difficulty === filterDifficulty.value
    );
  }

  // 排序
  if (sortBy.value === 'date') {
    // 按时间排序（模拟）
    filtered.sort((a, b) => b.popularity - a.popularity);
  } else if (sortBy.value === 'popularity') {
    // 按热度排序
    filtered.sort((a, b) => b.popularity - a.popularity);
  }

  return filtered;
});

// 我的预设
const myPresets = computed(() => {
  return projectStore.projects.map(project => ({
    id: project.id,
    name: project.name,
    characters: project.characters,
    duration: project.duration,
  }));
});

// 社区预设
const communityPresets = computed(() => {
  return presetData.value.map(preset => ({
    ...preset,
    isCommunity: true,
  }));
});

// 方法
const getCharacterName = characterId => {
  const character = gamedataStore.characters.find(c => c.id === characterId);
  return character ? character.name : '未知角色';
};

const getTeamTypeName = teamType => {
  const types = {
    dps: '输出队',
    control: '控制队',
    support: '辅助队',
    hybrid: '混合队',
  };
  return types[teamType] || '未知类型';
};

const getDifficultyName = difficulty => {
  const levels = {
    easy: '简单',
    normal: '普通',
    hard: '困难',
    expert: '专家',
  };
  return levels[difficulty] || '未知难度';
};

const formatTime = frames => {
  const seconds = Math.floor(frames / 60);
  const remainingFrames = frames % 60;
  return `${seconds}.${remainingFrames.toString().padStart(2, '0')}s`;
};

const loadPreset = preset => {
  // 这里应该实现加载预设的逻辑
  ElMessage.success(`加载预设: ${preset.name}`);
  // 跳转到编辑器页面
  router.push('/editor');
};

const copyPreset = preset => {
  // 这里应该实现复制预设的逻辑
  ElMessage.success(`复制预设: ${preset.name}`);
};

const deletePreset = presetId => {
  // 这里应该实现删除预设的逻辑
  ElMessage.success('预设已删除');
};

const openSubmitDialog = () => {
  submitDialogVisible.value = true;
};

const submitPreset = () => {
  // 获取当前项目
  const currentProject = projectStore.currentProject;
  if (!currentProject) {
    ElMessage.error('请先创建或加载一个项目');
    return;
  }

  // 创建预设数据
  const newPreset = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    name: submitForm.value.name || currentProject.name,
    characters: currentProject.characters,
    teamType: submitForm.value.teamType,
    boss: submitForm.value.boss,
    difficulty: submitForm.value.difficulty,
    duration: currentProject.duration,
    popularity: 0,
    author: '当前用户',
    description: submitForm.value.description,
    projectData: currentProject,
    createdAt: new Date().toISOString(),
  };

  // 保存到本地存储
  try {
    const presets = JSON.parse(
      localStorage.getItem('promilia_presets') || '[]'
    );
    presets.push(newPreset);
    localStorage.setItem('promilia_presets', JSON.stringify(presets));

    // 更新预设数据
    presetData.value.push(newPreset);

    ElMessage.success('预设提交成功');
    submitDialogVisible.value = false;

    // 重置表单
    submitForm.value = {
      name: '',
      teamType: 'dps',
      boss: '',
      difficulty: 'normal',
      description: '',
    };
  } catch (error) {
    console.error('提交预设失败:', error);
    ElMessage.error('提交预设失败');
  }
};

// 生命周期
onMounted(() => {
  // 加载游戏数据
  if (gamedataStore.characters.length === 0) {
    gamedataStore.loadGameData();
  }

  // 加载预设数据
  loadPresets();
});

// 加载预设数据
const loadPresets = () => {
  try {
    const storedPresets = localStorage.getItem('promilia_presets');
    if (storedPresets) {
      presetData.value = JSON.parse(storedPresets);
    } else {
      // 添加默认预设数据
      const defaultPresets = [
        {
          id: '1',
          name: '极限输出队',
          characters: ['character1', 'character2', 'character3'],
          teamType: 'dps',
          boss: 'Boss 1',
          difficulty: 'hard',
          duration: 1200,
          popularity: 128,
          author: '玩家1',
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          name: '控制流配队',
          characters: ['character4', 'character5', 'character6'],
          teamType: 'control',
          boss: 'Boss 2',
          difficulty: 'normal',
          duration: 1500,
          popularity: 95,
          author: '玩家2',
          createdAt: new Date().toISOString(),
        },
        {
          id: '3',
          name: '辅助增幅队',
          characters: ['character7', 'character8', 'character9'],
          teamType: 'support',
          boss: 'Boss 3',
          difficulty: 'expert',
          duration: 1800,
          popularity: 156,
          author: '玩家3',
          createdAt: new Date().toISOString(),
        },
      ];
      presetData.value = defaultPresets;
      localStorage.setItem('promilia_presets', JSON.stringify(defaultPresets));
    }
  } catch (error) {
    console.error('加载预设数据失败:', error);
    // 使用默认数据
    presetData.value = [];
  }
};
</script>

<style scoped>
.preset {
  min-height: 100vh;
  padding: 20px;
}

.preset-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-color);
}

.preset-header h1 {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-color);
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.filter-section {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 20px;
  padding: 15px;
  background-color: var(--bg-color-light);
  border-radius: 8px;
  box-shadow: var(--box-shadow);
}

.preset-tabs {
  background-color: var(--bg-color-light);
  border-radius: 8px;
  padding: 20px;
  box-shadow: var(--box-shadow);
}

.preset-list {
  min-height: 400px;
  padding: 20px;
  background-color: var(--bg-color-lighter);
  border-radius: 4px;
  margin-top: 20px;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.preset-card {
  cursor: pointer;
  transition: all 0.3s;
}

.preset-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preset-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
}

.preset-popularity {
  font-size: 14px;
  color: #f56c6c;
}

.preset-author {
  font-size: 12px;
  color: var(--text-color-secondary);
}

.preset-info {
  margin: 15px 0;
}

.info-item {
  display: flex;
  margin-bottom: 8px;
  font-size: 14px;
}

.info-item .label {
  width: 80px;
  color: var(--text-color-secondary);
}

.info-item .value {
  flex: 1;
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 15px;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

@media (max-width: 768px) {
  .preset-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .header-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .filter-section {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-section .el-input,
  .filter-section .el-select {
    width: 100% !important;
    margin-right: 0 !important;
  }

  .preset-grid {
    grid-template-columns: 1fr;
  }
}
</style>
