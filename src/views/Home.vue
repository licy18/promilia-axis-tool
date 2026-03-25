<template>
  <div class="home">
    <div class="hero">
      <div class="container">
        <h1>{{ $t('home.title') }}</h1>
        <p class="subtitle">{{ $t('home.subtitle') }}</p>
        <div class="buttons">
          <el-button
            type="primary"
            size="large"
            @click="openNewProjectDialog"
            >{{ $t('home.startEditing') }}</el-button
          >
          <el-button size="large" @click="navigateTo('/preset')">{{
            $t('home.browsePresets')
          }}</el-button>
          <el-button size="large" @click="navigateTo('/handbook')">{{
            $t('home.viewHandbook')
          }}</el-button>
        </div>
      </div>
    </div>

    <div class="content">
      <div class="container">
        <!-- 热门预设区域 -->
        <div class="section">
          <h2>热门预设</h2>
          <div class="preset-grid">
            <div class="preset-card">
              <div class="preset-header">
                <h3>雷水冰火队</h3>
                <span class="preset-tag">推荐</span>
              </div>
              <div class="preset-characters">
                <div class="preset-character" v-for="i in 3" :key="i">
                  <div class="character-avatar"></div>
                </div>
              </div>
              <div class="preset-footer">
                <el-button size="small" @click="navigateTo('/editor')"
                  >使用预设</el-button
                >
              </div>
            </div>
            <div class="preset-card">
              <div class="preset-header">
                <h3>纯水队</h3>
                <span class="preset-tag">辅助</span>
              </div>
              <div class="preset-characters">
                <div class="preset-character" v-for="i in 3" :key="i">
                  <div class="character-avatar"></div>
                </div>
              </div>
              <div class="preset-footer">
                <el-button size="small" @click="navigateTo('/editor')"
                  >使用预设</el-button
                >
              </div>
            </div>
            <div class="preset-card">
              <div class="preset-header">
                <h3>雷火输出队</h3>
                <span class="preset-tag">输出</span>
              </div>
              <div class="preset-characters">
                <div class="preset-character" v-for="i in 3" :key="i">
                  <div class="character-avatar"></div>
                </div>
              </div>
              <div class="preset-footer">
                <el-button size="small" @click="navigateTo('/editor')"
                  >使用预设</el-button
                >
              </div>
            </div>
          </div>
        </div>

        <!-- 我的项目列表 -->
        <div class="section">
          <div class="section-header">
            <h2>我的项目</h2>
            <div class="header-buttons">
              <el-button
                type="primary"
                size="small"
                @click="openNewProjectDialog"
                >新建项目</el-button
              >
              <el-button size="small" @click="triggerImport"
                >导入项目</el-button
              >
              <input
                ref="fileInput"
                type="file"
                accept=".promilia,.json"
                style="display: none"
                @change="handleFileImport"
              />
            </div>
          </div>
          <div v-if="projects.length > 0" class="project-list">
            <div
              v-for="project in projects"
              :key="project.id"
              class="project-item"
            >
              <div class="project-info">
                <h3>{{ project.name }}</h3>
                <p class="project-meta">
                  {{ project.characters.length }} 角色 |
                  {{ project.duration }} 帧 |
                  {{ formatDate(project.createdTime) }}
                </p>
              </div>
              <div class="project-actions">
                <el-button size="small" @click="openProject(project.id)"
                  >打开</el-button
                >
                <el-button
                  size="small"
                  type="danger"
                  @click="deleteProject(project.id)"
                  >删除</el-button
                >
              </div>
            </div>
          </div>
          <div v-else class="empty-projects">
            <el-empty description="暂无保存的项目" />
          </div>
        </div>
      </div>
    </div>

    <div class="footer">
      <div class="container">
        <p>© 2026 蓝色星原战斗排轴编辑器 | Promilia Battle Axis Editor</p>
        <p>非盈利粉丝向开源工具，无任何商业用途</p>
      </div>
    </div>

    <!-- 新建项目弹窗 -->
    <el-dialog
      v-model="newProjectDialogVisible"
      title="新建排轴项目"
      width="600px"
    >
      <el-form
        :model="newProjectForm"
        :rules="newProjectRules"
        ref="newProjectFormRef"
      >
        <el-form-item label="项目名称" prop="name">
          <el-input
            v-model="newProjectForm.name"
            placeholder="请输入项目名称"
          />
        </el-form-item>

        <el-form-item label="上场角色" prop="characters">
          <div class="character-selection">
            <div class="available-characters">
              <h4>可选角色</h4>
              <div class="character-grid">
                <div
                  v-for="character in availableCharacters"
                  :key="character.id"
                  class="character-card"
                  :class="{
                    selected: newProjectForm.characters.includes(character.id),
                  }"
                  @click="toggleCharacter(character.id)"
                >
                  <div class="character-avatar">
                    <img :src="character.avatar" :alt="character.name" />
                  </div>
                  <div class="character-name">{{ character.name }}</div>
                </div>
              </div>
              <p class="character-hint">最多选择3名角色</p>
            </div>

            <div class="selected-characters">
              <h4>已选角色（拖拽排序）</h4>
              <draggable
                v-model="selectedCharacterObjects"
                item-key="id"
                class="draggable-list"
              >
                <template #item="{ element }">
                  <div class="selected-character-item">
                    <div class="character-avatar">
                      <img :src="element.avatar" :alt="element.name" />
                    </div>
                    <div class="character-name">{{ element.name }}</div>
                    <el-button
                      size="small"
                      type="danger"
                      @click="removeCharacter(element.id)"
                    >
                      移除
                    </el-button>
                  </div>
                </template>
              </draggable>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="目标敌人" prop="enemy">
          <el-select
            v-model="newProjectForm.enemy"
            placeholder="请选择目标敌人"
          >
            <el-option
              v-for="enemy in enemies"
              :key="enemy.id"
              :label="enemy.name"
              :value="enemy.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="基础帧率" prop="fps">
          <el-select v-model="newProjectForm.fps" placeholder="请选择帧率">
            <el-option label="30帧" value="30" />
            <el-option label="60帧" value="60" />
            <el-option label="120帧" value="120" />
          </el-select>
        </el-form-item>

        <el-form-item label="项目总时长" prop="duration">
          <el-input-number
            v-model="newProjectForm.duration"
            :min="300"
            :max="3600"
            :step="60"
            suffix="帧"
          />
          <p class="duration-hint">
            {{ Math.round((newProjectForm.duration / 60) * 10) / 10 }} 秒
          </p>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="newProjectDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="createProject">创建项目</el-button>
      </template>
    </el-dialog>

    <!-- 项目删除确认弹窗 -->
    <el-dialog
      v-model="deleteProjectDialogVisible"
      title="删除项目"
      width="400px"
    >
      <p>确定要删除此项目吗？此操作不可恢复。</p>
      <template #footer>
        <el-button @click="deleteProjectDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="confirmDeleteProject">删除</el-button>
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
import draggable from 'vuedraggable';

const router = useRouter();
const projectStore = useProjectStore();
const gamedataStore = useGamedataStore();

// 新建项目弹窗
const newProjectDialogVisible = ref(false);
const newProjectFormRef = ref(null);
const newProjectForm = ref({
  name: '',
  characters: [],
  enemy: '',
  fps: '60',
  duration: 1200,
});
const newProjectRules = ref({
  name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
  characters: [
    { required: true, message: '请至少选择1名角色', trigger: 'change' },
  ],
  enemy: [{ required: true, message: '请选择目标敌人', trigger: 'change' }],
});

// 删除项目弹窗
const deleteProjectDialogVisible = ref(false);
const projectToDelete = ref(null);

// 响应式数据
const fileInput = ref(null);

// 计算属性
const projects = computed(() => projectStore.projectList);
const availableCharacters = computed(() => gamedataStore.characters);
const enemies = computed(() => gamedataStore.enemies);

// 已选角色对象列表（用于拖拽）
const selectedCharacterObjects = computed({
  get: () => {
    return newProjectForm.value.characters
      .map(id => {
        return gamedataStore.characters.find(c => c.id === id);
      })
      .filter(Boolean);
  },
  set: value => {
    newProjectForm.value.characters = value.map(c => c.id);
  },
});

// 方法
const navigateTo = path => {
  router.push(path);
};

const openNewProjectDialog = () => {
  // 重置表单
  newProjectForm.value = {
    name: '',
    characters: [],
    enemy: '',
    fps: '60',
    duration: 1200,
  };
  newProjectDialogVisible.value = true;
};

const toggleCharacter = characterId => {
  const index = newProjectForm.value.characters.indexOf(characterId);
  if (index === -1) {
    // 添加角色，最多3个
    if (newProjectForm.value.characters.length < 3) {
      newProjectForm.value.characters.push(characterId);
    }
  } else {
    // 移除角色
    newProjectForm.value.characters.splice(index, 1);
  }
};

const removeCharacter = characterId => {
  const index = newProjectForm.value.characters.indexOf(characterId);
  if (index !== -1) {
    newProjectForm.value.characters.splice(index, 1);
  }
};

const createProject = () => {
  newProjectFormRef.value.validate(valid => {
    if (valid) {
      const project = projectStore.createProject({
        name: newProjectForm.value.name,
        characters: newProjectForm.value.characters,
        enemy: newProjectForm.value.enemy,
        fps: parseInt(newProjectForm.value.fps),
        duration: newProjectForm.value.duration,
      });
      newProjectDialogVisible.value = false;
      // 导航到编辑器
      router.push(`/editor?id=${project.id}`);
    }
  });
};

const openProject = projectId => {
  router.push(`/editor?id=${projectId}`);
};

const deleteProject = projectId => {
  projectToDelete.value = projectId;
  deleteProjectDialogVisible.value = true;
};

const confirmDeleteProject = () => {
  if (projectToDelete.value) {
    projectStore.deleteProject(projectToDelete.value);
    deleteProjectDialogVisible.value = false;
  }
};

const formatDate = timestamp => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

// 导入项目
const triggerImport = () => {
  fileInput.value.click();
};

const handleFileImport = event => {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const content = e.target.result;
        const importedProject = projectStore.importProject(content);
        ElMessage.success('项目导入成功');
        // 导航到编辑器
        router.push(`/editor?id=${importedProject.id}`);
      } catch (error) {
        ElMessage.error('项目导入失败: ' + error.message);
      }
    };
    reader.onerror = () => {
      ElMessage.error('文件读取失败');
    };
    reader.readAsText(file);
  }
  // 重置文件输入
  event.target.value = '';
};

// 组件挂载时加载数据
onMounted(() => {
  if (gamedataStore.characters.length === 0) {
    gamedataStore.loadGameData();
  }
  // 设置默认敌人
  if (gamedataStore.enemies.length > 0) {
    newProjectForm.value.enemy = gamedataStore.enemies[0].id;
  }
});
</script>

<style scoped>
.home {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.hero {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  padding: 100px 0;
  text-align: center;
  flex: 1;
}

.hero h1 {
  font-size: 36px;
  font-weight: 700;
  margin-bottom: 20px;
  color: #ffffff;
}

.subtitle {
  font-size: 18px;
  color: #a0a0a0;
  margin-bottom: 40px;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
}

.buttons {
  display: flex;
  justify-content: center;
  gap: 20px;
  flex-wrap: wrap;
}

.content {
  padding: 60px 0;
  background-color: var(--bg-color-light);
  flex: 1;
}

.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.section {
  margin-bottom: 60px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section h2 {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 20px;
}

/* 预设区域 */
.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.preset-card {
  background-color: var(--bg-color-lighter);
  border-radius: 8px;
  padding: 20px;
  box-shadow: var(--box-shadow);
  transition: transform 0.3s ease;
}

.preset-card:hover {
  transform: translateY(-5px);
}

.preset-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.preset-header h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.preset-tag {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  background-color: var(--primary-color-light);
  color: var(--primary-color);
}

.preset-characters {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.preset-character {
  flex: 1;
}

.character-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  overflow: hidden;
  background-color: var(--bg-color);
  display: flex;
  align-items: center;
  justify-content: center;
}

.character-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preset-footer {
  text-align: right;
}

/* 项目列表 */
.project-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.project-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background-color: var(--bg-color-lighter);
  border-radius: 8px;
  box-shadow: var(--box-shadow);
  transition: all 0.2s;
}

.project-item:hover {
  background-color: var(--bg-color-hover);
}

.project-info h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 5px 0;
}

.project-meta {
  font-size: 14px;
  color: var(--text-color-secondary);
  margin: 0;
}

.project-actions {
  display: flex;
  gap: 10px;
}

.empty-projects {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-color-lighter);
  border-radius: 8px;
  padding: 40px;
}

/* 新建项目弹窗 */
.character-selection {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.available-characters h4,
.selected-characters h4 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
}

.character-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  max-height: 200px;
  overflow-y: auto;
  padding: 10px;
  background-color: var(--bg-color);
  border-radius: 4px;
}

.character-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  background-color: var(--bg-color-lighter);
}

.character-card:hover {
  background-color: var(--bg-color-hover);
}

.character-card.selected {
  background-color: var(--primary-color-light);
  border: 2px solid var(--primary-color);
}

.character-name {
  font-size: 12px;
  margin-top: 5px;
  text-align: center;
}

.character-hint {
  font-size: 12px;
  color: var(--text-color-secondary);
  margin-top: 10px;
  text-align: center;
}

.draggable-list {
  max-height: 200px;
  overflow-y: auto;
  padding: 10px;
  background-color: var(--bg-color);
  border-radius: 4px;
}

.selected-character-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  margin-bottom: 5px;
  background-color: var(--bg-color-lighter);
  border-radius: 6px;
}

.selected-character-item .character-avatar {
  width: 40px;
  height: 40px;
}

.selected-character-item .character-name {
  flex: 1;
  margin-top: 0;
  text-align: left;
}

.duration-hint {
  font-size: 12px;
  color: var(--text-color-secondary);
  margin-top: 5px;
  margin-bottom: 0;
}

.footer {
  background-color: var(--bg-color);
  padding: 40px 0;
  text-align: center;
  border-top: 1px solid var(--border-color);
}

.footer p {
  color: var(--text-color-secondary);
  margin-bottom: 10px;
  font-size: 14px;
}

@media (max-width: 768px) {
  .hero {
    padding: 60px 0;
  }

  .hero h1 {
    font-size: 28px;
  }

  .buttons {
    flex-direction: column;
    align-items: center;
  }

  .buttons .el-button {
    width: 200px;
  }

  .preset-grid {
    grid-template-columns: 1fr;
  }

  .character-selection {
    grid-template-columns: 1fr;
  }

  .character-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .project-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .project-actions {
    align-self: flex-end;
  }
}
</style>
