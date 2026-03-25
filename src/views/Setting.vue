<template>
  <div class="setting">
    <div class="setting-header">
      <h1>{{ $t('setting.title') }}</h1>
    </div>

    <div class="setting-content">
      <el-tabs v-model="activeTab" class="setting-tabs">
        <el-tab-pane :label="$t('setting.editor')" name="editor">
          <el-card class="setting-card">
            <h3>{{ $t('setting.editorSettings') }}</h3>
            <el-form :model="editorSettings" label-width="150px">
              <el-form-item :label="$t('setting.snapToGrid')">
                <el-switch v-model="editorSettings.snapToGrid" />
              </el-form-item>
              <el-form-item :label="$t('setting.gridSize')">
                <el-slider
                  v-model="editorSettings.gridSize"
                  :min="50"
                  :max="200"
                  :step="10"
                />
                <span class="slider-value"
                  >{{ editorSettings.gridSize }}ms</span
                >
              </el-form-item>
              <el-form-item :label="$t('setting.showTimelineLabels')">
                <el-switch v-model="editorSettings.showTimelineLabels" />
              </el-form-item>
              <el-form-item :label="$t('setting.autoSave')">
                <el-switch v-model="editorSettings.autoSave" />
              </el-form-item>
              <el-form-item
                :label="$t('setting.autoSaveInterval')"
                v-if="editorSettings.autoSave"
              >
                <el-slider
                  v-model="editorSettings.autoSaveInterval"
                  :min="5000"
                  :max="60000"
                  :step="5000"
                />
                <span class="slider-value"
                  >{{ editorSettings.autoSaveInterval / 1000 }}s</span
                >
              </el-form-item>
            </el-form>
          </el-card>
        </el-tab-pane>

        <el-tab-pane :label="$t('setting.display')" name="display">
          <el-card class="setting-card">
            <h3>{{ $t('setting.displaySettings') }}</h3>
            <el-form :model="displaySettings" label-width="150px">
              <el-form-item :label="$t('setting.theme')">
                <el-radio-group v-model="theme" @change="updateTheme">
                  <el-radio-button label="dark">{{
                    $t('setting.darkTheme')
                  }}</el-radio-button>
                  <el-radio-button label="light">{{
                    $t('setting.lightTheme')
                  }}</el-radio-button>
                </el-radio-group>
              </el-form-item>
              <el-form-item :label="$t('setting.language')">
                <el-select v-model="language" @change="updateLanguage">
                  <el-option label="中文" value="zh-CN" />
                  <el-option label="English" value="en-US" />
                </el-select>
              </el-form-item>
            </el-form>
          </el-card>
        </el-tab-pane>

        <el-tab-pane :label="$t('setting.playback')" name="playback">
          <el-card class="setting-card">
            <h3>{{ $t('setting.playbackSettings') }}</h3>
            <el-form :model="playbackSettings" label-width="150px">
              <el-form-item :label="$t('setting.enableAnimation')">
                <el-switch v-model="playbackSettings.enableAnimation" />
              </el-form-item>
              <el-form-item :label="$t('setting.animationSpeed')">
                <el-slider
                  v-model="playbackSettings.animationSpeed"
                  :min="0.5"
                  :max="3"
                  :step="0.1"
                />
                <span class="slider-value"
                  >{{ playbackSettings.animationSpeed }}x</span
                >
              </el-form-item>
              <el-form-item :label="$t('setting.showDebugInfo')">
                <el-switch v-model="playbackSettings.showDebugInfo" />
              </el-form-item>
            </el-form>
          </el-card>
        </el-tab-pane>

        <el-tab-pane :label="$t('setting.shortcuts')" name="shortcuts">
          <el-card class="setting-card">
            <h3>{{ $t('setting.keyboardShortcuts') }}</h3>
            <el-table :data="shortcuts" style="width: 100%">
              <el-table-column prop="action" :label="$t('setting.action')" />
              <el-table-column prop="key" :label="$t('setting.shortcut')" />
            </el-table>
          </el-card>
        </el-tab-pane>

        <el-tab-pane :label="$t('setting.backup')" name="backup">
          <el-card class="setting-card">
            <h3>{{ $t('setting.dataBackup') }}</h3>
            <div class="backup-actions">
              <el-button type="primary" @click="exportData">
                {{ $t('setting.exportData') }}
              </el-button>
              <el-button type="success" @click="importData">
                {{ $t('setting.importData') }}
              </el-button>
              <el-button type="danger" @click="resetSettings">
                {{ $t('setting.resetSettings') }}
              </el-button>
            </div>
            <input
              ref="fileInput"
              type="file"
              accept=".json"
              style="display: none"
              @change="handleFileImport"
            />
          </el-card>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useSettingStore } from '../store/setting';
import { useProjectStore } from '../store/project';
import { ElMessage } from 'element-plus';

const settingStore = useSettingStore();
const projectStore = useProjectStore();
const fileInput = ref(null);

const activeTab = ref('editor');

const editorSettings = computed({
  get: () => ({ ...settingStore.editor }),
  set: value => settingStore.updateEditorSettings(value),
});

const playbackSettings = computed({
  get: () => ({ ...settingStore.simulation }),
  set: value => settingStore.updateSimulationSettings(value),
});

const displaySettings = ref({});
const theme = computed({
  get: () => settingStore.theme,
  set: value => settingStore.setTheme(value),
});

const language = computed({
  get: () => settingStore.language,
  set: value => settingStore.setLanguage(value),
});

const shortcuts = ref([
  { action: '撤销', key: 'Ctrl+Z' },
  { action: '重做', key: 'Ctrl+Y' },
  { action: '复制', key: 'Ctrl+C' },
  { action: '粘贴', key: 'Ctrl+V' },
  { action: '删除', key: 'Delete' },
  { action: '播放/暂停', key: 'Space' },
  { action: '停止', key: 'Esc' },
  { action: '保存', key: 'Ctrl+S' },
]);

const updateTheme = () => {
  ElMessage.success('主题已更新');
};

const updateLanguage = () => {
  ElMessage.success('语言已更新');
};

const exportData = () => {
  const data = {
    settings: {
      editor: settingStore.editor,
      simulation: settingStore.simulation,
      data: settingStore.data,
      theme: settingStore.theme,
      language: settingStore.language,
    },
    project: projectStore.project,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `promilia-axis-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  ElMessage.success('数据导出成功');
};

const importData = () => {
  fileInput.value.click();
};

const handleFileImport = event => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);

      if (data.settings) {
        settingStore.updateEditorSettings(data.settings.editor || {});
        settingStore.updateSimulationSettings(data.settings.simulation || {});
        settingStore.updateDataSettings(data.settings.data || {});
        if (data.settings.theme) settingStore.setTheme(data.settings.theme);
        if (data.settings.language)
          settingStore.setLanguage(data.settings.language);
      }

      if (data.project) {
        projectStore.loadProject(data.project);
      }

      ElMessage.success('数据导入成功');
    } catch (error) {
      ElMessage.error('数据导入失败，请检查文件格式');
    }
  };
  reader.readAsText(file);

  // 重置文件输入
  event.target.value = '';
};

const resetSettings = () => {
  settingStore.resetSettings();
  ElMessage.success('设置已重置');
};

onMounted(() => {
  settingStore.loadSettings();
});
</script>

<style scoped>
.setting {
  min-height: 100vh;
  padding: 20px;
}

.setting-header {
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-color);
}

.setting-header h1 {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-color);
}

.setting-content {
  max-width: 1000px;
  margin: 0 auto;
}

.setting-tabs {
  background-color: var(--bg-color);
  border-radius: 8px;
  overflow: hidden;
}

.setting-card {
  margin: 20px 0;
  background-color: var(--bg-color-light);
  border: 1px solid var(--border-color);
}

.setting-card h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 20px;
  color: var(--text-color);
}

.slider-value {
  margin-left: 10px;
  color: var(--text-color-secondary);
  font-size: 14px;
}

.backup-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

@media (max-width: 768px) {
  .setting {
    padding: 10px;
  }

  .backup-actions {
    flex-direction: column;
  }
}
</style>
