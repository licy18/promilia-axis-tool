<template>
  <div class="editor">
    <!-- 顶部导航栏 -->
    <div class="editor-header">
      <div class="header-left">
        <el-button @click="navigateTo('/')">
          <el-icon><ArrowLeft /></el-icon>
          返回首页
        </el-button>
        <h1>{{ project?.name || '排轴编辑器' }}</h1>
      </div>
      <div class="header-center">
        <el-button @click="undo" :disabled="!historyStore.canUndo">
          <el-icon><RefreshLeft /></el-icon>
          撤销
        </el-button>
        <el-button @click="redo" :disabled="!historyStore.canRedo">
          <el-icon><RefreshRight /></el-icon>
          重做
        </el-button>
        <el-button @click="toggleLoop">
          <el-icon><RefreshRight /></el-icon>
          {{ loopSettings.enabled ? '关闭循环' : '开启循环' }}
        </el-button>
        <el-button @click="openShortcutsDialog">
          <el-icon><Setting /></el-icon>
          快捷键
        </el-button>
      </div>
      <div class="header-right">
        <el-button @click="saveProject">
          <el-icon><Download /></el-icon>
          保存
        </el-button>
        <el-dropdown @command="handleExportCommand">
          <el-button>
            <el-icon><Download /></el-icon>
            导出
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="promilia"
                >.promilia 项目文件</el-dropdown-item
              >
              <el-dropdown-item command="json">JSON 源文件</el-dropdown-item>
              <el-dropdown-item command="image">高清图片</el-dropdown-item>
              <el-dropdown-item command="markdown"
                >Markdown 报告</el-dropdown-item
              >
              <el-dropdown-item command="share">生成分享链接</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button @click="toggleTheme">
          <el-icon><Moon /></el-icon>
          {{ isDark ? '浅色模式' : '深色模式' }}
        </el-button>
        <el-button @click="startGuideTour">
          <el-icon><Help /></el-icon>
          新手引导
        </el-button>
      </div>
    </div>

    <!-- 主编辑区域 -->
    <div class="editor-content">
      <!-- 左侧技能库 -->
      <div class="left-panel">
        <div class="panel-header">
          <h3>技能库</h3>
        </div>
        <SkillLibrary
          :characters="teamCharacters"
          :elements="gamedataStore.elements"
          @skill-drag-start="onSkillDragStart"
        />
      </div>

      <!-- 中间时间轴 -->
      <div class="main-panel">
        <!-- 播放控制条 -->
        <div class="timeline-controls">
          <div class="control-buttons">
            <el-button @click="goToStart">
              <el-icon><ArrowLeft /></el-icon>
            </el-button>
            <el-button @click="stepBackward">
              <el-icon><ArrowLeft /></el-icon>
            </el-button>
            <el-button @click="togglePlay">
              <el-icon>
                <component :is="isPlaying ? VideoPause : VideoCamera" />
              </el-icon>
              {{ isPlaying ? '暂停' : '播放' }}
            </el-button>
            <el-button @click="stepForward">
              <el-icon><ArrowRight /></el-icon>
            </el-button>
            <el-button @click="goToEnd">
              <el-icon><ArrowRight /></el-icon>
            </el-button>
            <el-select
              v-model="playbackSpeed"
              size="small"
              style="width: 80px; margin-left: 10px"
            >
              <el-option label="0.5x" value="0.5" />
              <el-option label="1x" value="1" />
              <el-option label="1.5x" value="1.5" />
              <el-option label="2x" value="2" />
            </el-select>
          </div>
          <div class="time-info">
            <span
              >{{ formatTime(currentFrame) }} /
              {{ formatTime(project?.duration || 1200) }}</span
            >
            <el-slider
              v-model="currentFrame"
              :min="0"
              :max="project?.duration || 1200"
              :step="1"
              style="width: 300px; margin: 0 20px"
            />
            <div class="time-unit-control">
              <span>{{ currentFrame }} 帧</span>
              <el-button
                size="small"
                @click="toggleTimeUnit"
                style="margin-left: 10px"
              >
                {{ timeUnit === 'frame' ? '切换到秒' : '切换到帧' }}
              </el-button>
            </div>
          </div>
        </div>

        <!-- 时间轴编辑区 -->
        <div class="timeline-container" ref="timelineContainer">
          <!-- 时间刻度 -->
          <div
            class="timeline-header"
            :style="{ width: `${totalWidth}px` }"
            @click="addKeyframeAtPosition"
          >
            <div class="time-scale">
              <div
                v-for="tick in timeTicks"
                :key="tick.frame"
                class="time-tick"
                :style="{ left: `${tick.position}px` }"
              >
                <div class="tick-mark"></div>
                <div class="tick-label">{{ tick.label }}</div>
              </div>
            </div>
            <!-- 关键时间点 -->
            <div class="keyframes">
              <Keyframe
                v-for="keyframe in project?.keyframes"
                :key="keyframe.id"
                :keyframe="keyframe"
                :scale="scale"
                @select="selectKeyframe"
              />
            </div>
          </div>

          <!-- 轨道区域 -->
          <div class="timeline-tracks" :style="{ width: `${totalWidth}px` }">
            <!-- 技能依赖连接线 -->
            <LinkLine
              v-for="dependency in getSkillDependencies()"
              :key="dependency.id"
              :source-block="getSkillBlockById(dependency.sourceBlockId)"
              :target-block="getSkillBlockById(dependency.targetBlockId)"
              :source-track-index="
                getTrackIndexByCharacterId(
                  getSkillBlockById(dependency.sourceBlockId)?.characterId
                )
              "
              :target-track-index="
                getTrackIndexByCharacterId(
                  getSkillBlockById(dependency.targetBlockId)?.characterId
                )
              "
              :scale="scale"
              :is-satisfied="
                isSkillDependencySatisfied(
                  getSkillBlockById(dependency.sourceBlockId),
                  getSkillBlockById(dependency.targetBlockId)
                )
              "
              @select="handleLinkLineClick"
            />

            <div
              v-for="(character, index) in teamCharacters"
              :key="character.id"
              class="track"
            >
              <div class="track-header">
                <div class="track-info">
                  <div class="character-avatar">
                    <img :src="character.avatar" :alt="character.name" />
                  </div>
                  <span class="character-name">{{ character.name }}</span>
                </div>
                <div class="track-controls">
                  <el-button
                    size="small"
                    @click="toggleTrackVisibility(character.id)"
                  >
                    {{ visibleTracks.includes(character.id) ? '隐藏' : '显示' }}
                  </el-button>
                </div>
              </div>

              <!-- 子轨道容器 -->
              <div
                class="sub-tracks"
                :class="{ hidden: !visibleTracks.includes(character.id) }"
              >
                <!-- 技能释放轨道 -->
                <div
                  class="sub-track skill-track"
                  @dragover.prevent
                  @drop="onSkillDrop($event, character.id)"
                >
                  <div class="sub-track-header">技能释放</div>
                  <div class="sub-track-content">
                    <!-- 技能块 -->
                    <SkillBlock
                      v-for="skillBlock in getCharacterSkillBlocks(
                        character.id
                      )"
                      :key="skillBlock.id"
                      :skill-block="skillBlock"
                      :scale="scale"
                      :is-selected="selectedSkillBlock?.id === skillBlock.id"
                      :element-color="getElementColor(character.element)"
                      @select="selectSkillBlock"
                      @edit="openSkillEditPanel"
                      @drag-start="onSkillBlockDragStart"
                      @drag-move="onSkillBlockDragMove"
                      @drag-end="onSkillBlockDragEnd"
                      @resize-start="onSkillBlockResizeStart"
                      @resize-move="onSkillBlockResizeMove"
                      @resize-end="onSkillBlockResizeEnd"
                    />
                  </div>
                </div>

                <!-- Buff生效轨道 -->
                <div class="sub-track buff-track">
                  <div class="sub-track-header">Buff生效</div>
                  <div class="sub-track-content">
                    <!-- Buff块 -->
                    <BuffBlock
                      v-for="buffBlock in getCharacterBuffBlocks(character.id)"
                      :key="buffBlock.id"
                      :buff-block="buffBlock"
                      :scale="scale"
                      @select="selectBuffBlock"
                    />
                  </div>
                </div>

                <!-- 资源变化轨道 -->
                <div class="sub-track resource-track">
                  <div class="sub-track-header">资源变化</div>
                  <div class="sub-track-content">
                    <!-- 资源变化块 -->
                    <ResourceBlock
                      v-for="resourceBlock in getCharacterResourceBlocks(
                        character.id
                      )"
                      :key="resourceBlock.id"
                      :resource-block="resourceBlock"
                      :scale="scale"
                      @select="selectResourceBlock"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 资源曲线 -->
          <ResourceCurve
            :project="project"
            :characters="teamCharacters"
            :scale="scale"
            @jump-to-frame="jumpToFrame"
          />

          <!-- 缩放控制 -->
          <div class="timeline-footer">
            <div class="zoom-controls">
              <el-button @click="zoomOut" icon="el-icon-zoom-out"></el-button>
              <el-slider
                v-model="scale"
                :min="0.5"
                :max="5"
                :step="0.1"
                style="width: 200px; margin: 0 10px"
              />
              <el-button @click="zoomIn" icon="el-icon-zoom-in"></el-button>
              <span style="margin-left: 10px"
                >{{ Math.round(scale * 100) }}%</span
              >
            </div>
            <div class="snap-control">
              <el-checkbox v-model="snapToGrid">吸附到网格</el-checkbox>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧属性面板 -->
      <div class="right-panel">
        <!-- 项目信息 -->
        <div class="panel-section">
          <h3>项目信息</h3>
          <div class="project-info">
            <div class="info-item">
              <span class="info-label">项目名称:</span>
              <span class="info-value">{{ project?.name || '未命名' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">上场角色:</span>
              <span class="info-value">{{ teamCharacters.length }} 名</span>
            </div>
            <div class="info-item">
              <span class="info-label">目标敌人:</span>
              <span class="info-value">{{ enemy?.name || '未选择' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">总时长:</span>
              <span class="info-value">{{
                formatTime(project?.duration || 1200)
              }}</span>
            </div>
          </div>
        </div>

        <!-- 伤害统计 -->
        <div class="panel-section">
          <h3>伤害统计</h3>
          <div class="damage-stats">
            <div class="stat-item">
              <span class="stat-label">总伤害:</span>
              <span class="stat-value">{{
                damageStats.totalDamage.toLocaleString()
              }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">平均DPS:</span>
              <span class="stat-value">{{
                damageStats.dps.toLocaleString()
              }}</span>
            </div>
          </div>
        </div>

        <!-- 角色伤害占比 -->
        <div class="panel-section">
          <h3>角色伤害占比</h3>
          <div class="chart-container" style="height: 200px">
            <div
              ref="characterChartRef"
              style="width: 100%; height: 100%"
            ></div>
          </div>
        </div>

        <!-- 技能类型占比 -->
        <div class="panel-section">
          <h3>技能类型占比</h3>
          <div class="chart-container" style="height: 200px">
            <div
              ref="skillTypeChartRef"
              style="width: 100%; height: 100%"
            ></div>
          </div>
        </div>

        <!-- 选中技能块详情 -->
        <div v-if="selectedSkillBlock" class="panel-section">
          <h3>技能详情</h3>
          <div class="skill-details">
            <div class="detail-item">
              <span class="detail-label">技能名称:</span>
              <span class="detail-value">{{
                selectedSkillBlock.skillName
              }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">释放时间:</span>
              <span class="detail-value"
                >{{ selectedSkillBlock.startFrame }} 帧</span
              >
            </div>
            <div class="detail-item">
              <span class="detail-label">结束时间:</span>
              <span class="detail-value"
                >{{ selectedSkillBlock.endFrame }} 帧</span
              >
            </div>
            <div class="detail-item">
              <span class="detail-label">持续时间:</span>
              <span class="detail-value"
                >{{
                  selectedSkillBlock.endFrame - selectedSkillBlock.startFrame
                }}
                帧</span
              >
            </div>
            <el-button
              type="primary"
              size="small"
              style="width: 100%; margin-top: 10px"
              @click="openSkillEditPanel(selectedSkillBlock.id)"
            >
              编辑技能
            </el-button>
          </div>
        </div>

        <!-- 技能依赖管理 -->
        <div v-if="selectedSkillBlocks.length > 0" class="panel-section">
          <h3>技能依赖管理</h3>
          <div class="dependency-controls">
            <el-button
              v-if="selectedSkillBlocks.length === 2"
              type="success"
              size="small"
              style="width: 100%; margin-bottom: 8px"
              @click="addSkillDependency"
            >
              添加依赖关系
            </el-button>
            <el-button
              v-else-if="selectedSkillBlocks.length === 2"
              type="danger"
              size="small"
              style="width: 100%"
              @click="
                removeSkillDependency(
                  selectedSkillBlocks[0].id,
                  selectedSkillBlocks[1].id
                )
              "
            >
              删除依赖关系
            </el-button>
            <div v-else class="dependency-info">
              <p>选择两个技能块以添加依赖关系</p>
            </div>
          </div>
        </div>

        <!-- 循环校验面板 -->
        <div class="panel-section validate-panel-container">
          <ValidatePanel
            :project="project"
            :gamedata="{ characters: gamedataStore.characters }"
            @jump-to-frame="jumpToFrame"
            @select-skill-block="selectSkillBlock"
          />
        </div>
      </div>
    </div>

    <!-- 技能编辑面板 -->
    <SkillEditPanel
      v-model:visible="skillEditPanelVisible"
      :skill-block="selectedSkillBlock"
      :original-skill="getOriginalSkill(selectedSkillBlock?.skillId)"
      :character="getCharacter(selectedSkillBlock?.characterId)"
      :max-duration="project?.duration || 1200"
      :elements="gamedataStore.elements"
      @save="saveSkillBlockChanges"
    />

    <!-- 关键帧编辑对话框 -->
    <ElDialog
      v-model="keyframeEditPanelVisible"
      title="编辑关键帧"
      width="400px"
    >
      <ElForm :model="keyframeEditForm" label-width="80px">
        <ElFormItem label="名称">
          <ElInput v-model="keyframeEditForm.name" />
        </ElFormItem>
        <ElFormItem label="时间点">
          <ElInput v-model.number="keyframeEditForm.frame" type="number" />
        </ElFormItem>
        <ElFormItem label="颜色">
          <ElColorPicker v-model="keyframeEditForm.color" />
        </ElFormItem>
        <ElFormItem label="备注">
          <ElTextarea v-model="keyframeEditForm.description" rows="3" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <span class="dialog-footer">
          <ElButton @click="keyframeEditPanelVisible = false">取消</ElButton>
          <ElButton type="primary" @click="saveKeyframeChanges">保存</ElButton>
        </span>
      </template>
    </ElDialog>

    <!-- 循环播放设置对话框 -->
    <ElDialog v-model="loopSettings.enabled" title="循环播放设置" width="400px">
      <ElForm :model="loopSettings" label-width="100px">
        <ElFormItem label="循环区间">
          <div style="display: flex; gap: 10px">
            <ElInput
              v-model.number="loopSettings.startFrame"
              type="number"
              style="width: 120px"
            />
            <span>至</span>
            <ElInput
              v-model.number="loopSettings.endFrame"
              type="number"
              style="width: 120px"
            />
          </div>
        </ElFormItem>
        <ElFormItem label="循环次数">
          <ElInput v-model.number="loopSettings.loopCount" type="number" />
          <div style="font-size: 12px; color: #999; margin-top: 5px">
            -1 表示无限循环
          </div>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <span class="dialog-footer">
          <ElButton @click="loopSettings.enabled = false">关闭</ElButton>
          <ElButton type="primary" @click="applyLoopSettings">应用</ElButton>
        </span>
      </template>
    </ElDialog>

    <!-- 快捷键设置对话框 -->
    <ElDialog v-model="shortcutsDialogVisible" title="快捷键设置" width="500px">
      <ElForm :model="shortcutSettings" label-width="120px">
        <ElFormItem label="撤销">
          <ElInput v-model="shortcutSettings.undo" />
        </ElFormItem>
        <ElFormItem label="重做">
          <ElInput v-model="shortcutSettings.redo" />
        </ElFormItem>
        <ElFormItem label="播放/暂停">
          <ElInput v-model="shortcutSettings.playPause" />
        </ElFormItem>
        <ElFormItem label="保存">
          <ElInput v-model="shortcutSettings.save" />
        </ElFormItem>
        <ElFormItem label="复制">
          <ElInput v-model="shortcutSettings.copy" />
        </ElFormItem>
        <ElFormItem label="粘贴">
          <ElInput v-model="shortcutSettings.paste" />
        </ElFormItem>
        <ElFormItem label="删除">
          <ElInput v-model="shortcutSettings.delete" />
        </ElFormItem>
        <ElFormItem label="全选">
          <ElInput v-model="shortcutSettings.selectAll" />
        </ElFormItem>
        <ElFormItem label="放大">
          <ElInput v-model="shortcutSettings.zoomIn" />
        </ElFormItem>
        <ElFormItem label="缩小">
          <ElInput v-model="shortcutSettings.zoomOut" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <span class="dialog-footer">
          <ElButton @click="shortcutsDialogVisible = false">取消</ElButton>
          <ElButton type="primary" @click="saveShortcutSettings">保存</ElButton>
        </span>
      </template>
    </ElDialog>

    <!-- 新手引导 -->
    <GuideTour ref="guideTour" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useProjectStore } from '../store/project';
import { useGamedataStore } from '../store/gamedata';
import { useSettingStore } from '../store/setting';
import { useHistoryStore } from '../store/history';
import {
  ElMessage,
  ElIcon,
  ElLoading,
  ElDialog,
  ElInput,
  ElColorPicker,
  ElSelect,
  ElOption,
  ElButton,
  ElCheckbox,
  ElForm,
  ElFormItem,
  ElSlider,
} from 'element-plus';
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Moon,
  VideoCamera,
  VideoPause,
  ArrowDown,
  RefreshLeft,
  RefreshRight,
  Plus,
  Minus,
  CopyDocument,
  Link,
  Setting,
  Help,
} from '@element-plus/icons-vue';
import * as echarts from 'echarts';
import SkillLibrary from '../components/editor/SkillLibrary.vue';
import SkillBlock from '../components/timeline/SkillBlock.vue';
import BuffBlock from '../components/timeline/BuffBlock.vue';
import ResourceBlock from '../components/timeline/ResourceBlock.vue';
import Keyframe from '../components/timeline/Keyframe.vue';
import LinkLine from '../components/timeline/LinkLine.vue';
import ResourceCurve from '../components/timeline/ResourceCurve.vue';
import SkillEditPanel from '../components/editor/SkillEditPanel.vue';
import ValidatePanel from '../components/editor/ValidatePanel.vue';
import GuideTour from '../components/editor/GuideTour.vue';
import {
  calculateTimelineDamage,
  calculateSkillDamage,
} from '../utils/damageCalc';

const router = useRouter();
const route = useRoute();
const projectStore = useProjectStore();
const gamedataStore = useGamedataStore();
const settingStore = useSettingStore();
const historyStore = useHistoryStore();

// 响应式数据
const project = ref(null);
const currentFrame = ref(0);
const isPlaying = ref(false);
const playbackSpeed = ref('1');
const scale = ref(2);
const snapToGrid = ref(true);
const expandedCharacters = ref([]);
const visibleTracks = ref([]);
const selectedSkillBlock = ref(null);
const selectedSkillBlocks = ref([]);
const selectedBuffBlock = ref(null);
const selectedResourceBlock = ref(null);
const selectedKeyframe = ref(null);
const skillEditPanelVisible = ref(false);
const keyframeEditPanelVisible = ref(false);
const keyframeEditForm = ref({
  name: '',
  frame: 0,
  color: '#E6A23C',
  description: '',
});
const loopSettings = ref({
  enabled: false,
  startFrame: 0,
  endFrame: 600,
  loopCount: -1, // -1 表示无限循环
});
const shortcutSettings = ref({
  undo: 'Ctrl+Z',
  redo: 'Ctrl+Y',
  playPause: 'Space',
  save: 'Ctrl+S',
  copy: 'Ctrl+C',
  paste: 'Ctrl+V',
  delete: 'Delete',
  selectAll: 'Ctrl+A',
  zoomIn: 'Ctrl++',
  zoomOut: 'Ctrl+-',
});
const shortcutsDialogVisible = ref(false);
const timelineContainer = ref(null);
const timeUnit = ref('frame'); // 'frame' 或 'second'
const damageStats = ref({
  totalDamage: 0,
  dps: 0,
  damageByCharacter: {},
  damageBySkillType: {},
});
const characterChartRef = ref(null);
const skillTypeChartRef = ref(null);
const characterChart = ref(null);
const skillTypeChart = ref(null);
const loopIntervalId = ref(null);
const guideTour = ref(null);
const draggingSkillBlock = ref(null); // 正在拖拽的技能块
const resizingSkillBlock = ref(null); // 正在调整大小的技能块

// 计算属性
const isDark = computed(() => settingStore.theme === 'dark');
const teamCharacters = computed(() => {
  if (!project.value) return [];
  return project.value.characters
    .map(charId => {
      return gamedataStore.characters.find(c => c.id === charId);
    })
    .filter(Boolean);
});
const enemy = computed(() => {
  if (!project.value) return null;
  return gamedataStore.enemies.find(e => e.id === project.value.enemy);
});
const totalWidth = computed(() => {
  return (project?.value?.duration || 1200) * scale.value;
});
const timeTicks = computed(() => {
  const ticks = [];
  const duration = project?.value?.duration || 1200;
  const step = Math.max(1, Math.floor(duration / 20));

  for (let i = 0; i <= duration; i += step) {
    ticks.push({
      frame: i,
      position: i * scale.value,
      label: formatTime(i),
    });
  }
  return ticks;
});

// 方法
const navigateTo = path => {
  router.push(path);
};

const toggleTheme = () => {
  settingStore.toggleTheme();
};

// 保存项目
const saveProject = () => {
  if (project.value) {
    projectStore.saveProject(project.value.id);
    ElMessage.success('项目保存成功');
  }
};

// 复制技能块
const copySkillBlock = () => {
  if (selectedSkillBlock.value) {
    localStorage.setItem(
      'promilia_copied_skill_block',
      JSON.stringify(selectedSkillBlock.value)
    );
    ElMessage.success('技能块已复制');
  }
};

// 粘贴技能块
const pasteSkillBlock = () => {
  if (!project.value) return;

  const copiedBlock = localStorage.getItem('promilia_copied_skill_block');
  if (copiedBlock) {
    try {
      const blockData = JSON.parse(copiedBlock);
      // 创建新技能块，调整位置
      const newBlock = {
        ...blockData,
        startFrame: blockData.startFrame + 60, // 偏移60帧
        endFrame: blockData.endFrame + 60,
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      };
      projectStore.addSkillBlock(project.value.id, newBlock);
      calculateDamageStats();
      ElMessage.success('技能块已粘贴');
    } catch (error) {
      console.error('Failed to paste skill block:', error);
      ElMessage.error('粘贴失败');
    }
  }
};

// 删除技能块
const deleteSkillBlock = () => {
  if (selectedSkillBlock.value && project.value) {
    historyStore.recordSkillBlockAction(
      'delete',
      selectedSkillBlock.value,
      selectedSkillBlock.value
    );
    projectStore.removeSkillBlock(
      project.value.id,
      selectedSkillBlock.value.id
    );
    selectedSkillBlock.value = null;
    calculateDamageStats();
    ElMessage.success('技能块已删除');
  }
};

// 键盘事件处理
const handleKeydown = event => {
  // 避免在输入框中触发
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
    return;
  }

  // 复制: Ctrl+C
  if (event.ctrlKey && event.key === 'c') {
    event.preventDefault();
    copySkillBlock();
  }

  // 粘贴: Ctrl+V
  if (event.ctrlKey && event.key === 'v') {
    event.preventDefault();
    pasteSkillBlock();
  }

  // 删除: Delete
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    deleteSkillBlock();
  }

  // 保存: Ctrl+S
  if (event.ctrlKey && event.key === 's') {
    event.preventDefault();
    saveProject();
  }

  // 播放/暂停: Space
  if (
    event.key === ' ' &&
    !event.target.classList.contains('el-input__inner')
  ) {
    event.preventDefault();
    togglePlay();
  }

  // 撤销: Ctrl+Z
  if (event.ctrlKey && event.key === 'z') {
    event.preventDefault();
    undo();
  }

  // 重做: Ctrl+Y
  if (event.ctrlKey && event.key === 'y') {
    event.preventDefault();
    redo();
  }

  // 全选: Ctrl+A
  if (event.ctrlKey && event.key === 'a') {
    event.preventDefault();
    selectAllSkillBlocks();
  }

  // 放大: Ctrl++
  if (event.ctrlKey && event.key === '+') {
    event.preventDefault();
    zoomIn();
  }

  // 缩小: Ctrl+-
  if (event.ctrlKey && event.key === '-') {
    event.preventDefault();
    zoomOut();
  }
};

const selectAllSkillBlocks = () => {
  if (!project.value) return;
  selectedSkillBlocks.value = [...project.value.skillBlocks];
};

const toggleCharacterGroup = characterId => {
  const index = expandedCharacters.value.indexOf(characterId);
  if (index === -1) {
    expandedCharacters.value.push(characterId);
  } else {
    expandedCharacters.value.splice(index, 1);
  }
};

const toggleTrackVisibility = characterId => {
  const index = visibleTracks.value.indexOf(characterId);
  if (index === -1) {
    visibleTracks.value.push(characterId);
  } else {
    visibleTracks.value.splice(index, 1);
  }
};

const onSkillDragStart = data => {
  // 由 SkillLibrary 组件触发
  console.log('技能拖拽开始', data);
};

const onSkillDrop = (event, characterId) => {
  const data = JSON.parse(event.dataTransfer.getData('application/json'));
  if (data.characterId === characterId) {
    // 计算技能块的起始位置（基于鼠标位置和时间轴缩放）
    const timelineRect = timelineContainer.value.getBoundingClientRect();
    const dropX = event.clientX - timelineRect.left;
    let startFrame = Math.round(dropX / scale.value);

    // 吸附到网格
    if (snapToGrid.value) {
      startFrame = Math.round(startFrame / 10) * 10;
    }

    // 计算技能块的结束位置
    const endFrame = startFrame + data.skill.frames.end;

    // 创建技能块
    const newSkillBlock = projectStore.addSkillBlock(project.value.id, {
      characterId,
      skillId: data.skill.id,
      skillName: data.skill.name,
      startFrame,
      endFrame,
    });
    if (newSkillBlock) {
      historyStore.recordSkillBlockAction('add', newSkillBlock);
    }
  }
};

const getCharacterSkillBlocks = characterId => {
  if (!project.value) return [];
  return project.value.skillBlocks.filter(
    block => block.characterId === characterId
  );
};

const getCharacterBuffBlocks = characterId => {
  // 模拟数据，实际应该从项目数据中获取
  return [];
};

const getCharacterResourceBlocks = characterId => {
  // 模拟数据，实际应该从项目数据中获取
  return [];
};

const selectSkillBlock = skillBlockId => {
  selectedSkillBlock.value = project.value.skillBlocks.find(
    block => block.id === skillBlockId
  );
  selectedSkillBlocks.value = [selectedSkillBlock.value];
  selectedBuffBlock.value = null;
  selectedResourceBlock.value = null;
  selectedKeyframe.value = null;
};

const selectSkillBlocks = blocks => {
  selectedSkillBlocks.value = blocks;
  selectedSkillBlock.value = blocks.length === 1 ? blocks[0] : null;
  selectedBuffBlock.value = null;
  selectedResourceBlock.value = null;
  selectedKeyframe.value = null;
};

const selectBuffBlock = buffBlockId => {
  // 实际应该从项目数据中获取
  selectedBuffBlock.value = { id: buffBlockId };
  selectedSkillBlock.value = null;
  selectedSkillBlocks.value = [];
  selectedResourceBlock.value = null;
  selectedKeyframe.value = null;
};

const selectResourceBlock = resourceBlockId => {
  // 实际应该从项目数据中获取
  selectedResourceBlock.value = { id: resourceBlockId };
  selectedSkillBlock.value = null;
  selectedSkillBlocks.value = [];
  selectedBuffBlock.value = null;
  selectedKeyframe.value = null;
};

const selectKeyframe = keyframeId => {
  selectedKeyframe.value = project.value.keyframes.find(
    keyframe => keyframe.id === keyframeId
  );
  if (selectedKeyframe.value) {
    keyframeEditForm.value = {
      ...selectedKeyframe.value,
    };
    keyframeEditPanelVisible.value = true;
  }
  selectedSkillBlock.value = null;
  selectedSkillBlocks.value = [];
  selectedBuffBlock.value = null;
  selectedResourceBlock.value = null;
};

const saveKeyframeChanges = () => {
  if (selectedKeyframe.value) {
    projectStore.updateKeyframe(project.value.id, {
      ...selectedKeyframe.value,
      ...keyframeEditForm.value,
    });
    keyframeEditPanelVisible.value = false;
    ElMessage.success('关键帧已更新');
  }
};

const openSkillEditPanel = skillBlockId => {
  selectedSkillBlock.value = project.value.skillBlocks.find(
    block => block.id === skillBlockId
  );
  skillEditPanelVisible.value = true;
};

const saveSkillBlockChanges = updatedSkillBlock => {
  const oldBlock = project.value.skillBlocks.find(
    block => block.id === updatedSkillBlock.id
  );
  if (oldBlock) {
    historyStore.recordSkillBlockAction('update', updatedSkillBlock, oldBlock);
  }
  projectStore.updateSkillBlock(project.value.id, updatedSkillBlock);
  selectedSkillBlock.value = updatedSkillBlock;
  // 重新计算伤害统计
  calculateDamageStats();
};

const onSkillBlockDragStart = skillBlockId => {
  const skillBlock = project.value.skillBlocks.find(
    block => block.id === skillBlockId
  );
  if (skillBlock) {
    draggingSkillBlock.value = { ...skillBlock }; // 保存拖拽前的状态
  }
};

const onSkillBlockDragMove = (skillBlockId, newStartFrame) => {
  // 吸附到网格
  if (snapToGrid.value) {
    newStartFrame = Math.round(newStartFrame / 10) * 10;
  }

  // 更新技能块位置
  const skillBlock = project.value.skillBlocks.find(
    block => block.id === skillBlockId
  );
  if (skillBlock) {
    const duration = skillBlock.endFrame - skillBlock.startFrame;
    const updatedBlock = {
      ...skillBlock,
      startFrame: newStartFrame,
      endFrame: newStartFrame + duration,
    };
    projectStore.updateSkillBlock(project.value.id, updatedBlock);
    // 重新计算伤害统计
    calculateDamageStats();
  }
};

const onSkillBlockDragEnd = skillBlockId => {
  const skillBlock = project.value.skillBlocks.find(
    block => block.id === skillBlockId
  );
  if (skillBlock && draggingSkillBlock.value) {
    historyStore.recordSkillBlockAction(
      'update',
      skillBlock,
      draggingSkillBlock.value
    );
    draggingSkillBlock.value = null;
  }
};

const onSkillBlockResizeStart = skillBlockId => {
  const skillBlock = project.value.skillBlocks.find(
    block => block.id === skillBlockId
  );
  if (skillBlock) {
    resizingSkillBlock.value = { ...skillBlock }; // 保存调整前的状态
  }
};

const onSkillBlockResizeMove = (skillBlockId, newEndFrame) => {
  // 吸附到网格
  if (snapToGrid.value) {
    newEndFrame = Math.round(newEndFrame / 10) * 10;
  }

  // 更新技能块结束时间
  const skillBlock = project.value.skillBlocks.find(
    block => block.id === skillBlockId
  );
  if (skillBlock) {
    const updatedBlock = {
      ...skillBlock,
      endFrame: newEndFrame,
    };
    projectStore.updateSkillBlock(project.value.id, updatedBlock);
    // 重新计算伤害统计
    calculateDamageStats();
  }
};

const onSkillBlockResizeEnd = skillBlockId => {
  const skillBlock = project.value.skillBlocks.find(
    block => block.id === skillBlockId
  );
  if (skillBlock && resizingSkillBlock.value) {
    historyStore.recordSkillBlockAction(
      'update',
      skillBlock,
      resizingSkillBlock.value
    );
    resizingSkillBlock.value = null;
  }
};

const getElementColor = element => {
  const elementData = gamedataStore.elements.find(
    e => e.id === `element_${element}`
  );
  return elementData ? elementData.color : '#409EFF';
};

const getOriginalSkill = skillId => {
  if (!skillId) return null;
  for (const character of gamedataStore.characters) {
    const skill = character.skills.find(s => s.id === skillId);
    if (skill) return skill;
  }
  return null;
};

const getCharacter = characterId => {
  if (!characterId) return null;
  return gamedataStore.characters.find(c => c.id === characterId);
};

// 计算伤害统计
const calculateDamageStats = () => {
  if (project.value && gamedataStore.characters.length > 0) {
    const stats = calculateTimelineDamage(project.value, {
      characters: gamedataStore.characters,
      enemies: gamedataStore.enemies,
    });
    damageStats.value = stats;
    updateCharts();
  }
};

// 初始化图表
const initCharts = () => {
  if (characterChartRef.value) {
    characterChart.value = echarts.init(characterChartRef.value);
  }
  if (skillTypeChartRef.value) {
    skillTypeChart.value = echarts.init(skillTypeChartRef.value);
  }
  updateCharts();
};

// 更新图表
const updateCharts = () => {
  updateCharacterChart();
  updateSkillTypeChart();
};

// 更新角色伤害占比图表
const updateCharacterChart = () => {
  if (!characterChart.value) return;

  const data = Object.entries(damageStats.value.damageByCharacter).map(
    ([name, damage]) => ({
      name,
      value: damage,
    })
  );

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      data: Object.keys(damageStats.value.damageByCharacter),
    },
    series: [
      {
        name: '伤害占比',
        type: 'pie',
        radius: '60%',
        data: data,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      },
    ],
  };

  characterChart.value.setOption(option);
};

// 更新技能类型伤害占比图表
const updateSkillTypeChart = () => {
  if (!skillTypeChart.value) return;

  const data = Object.entries(damageStats.value.damageBySkillType).map(
    ([type, damage]) => ({
      name: type,
      value: damage,
    })
  );

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      data: Object.keys(damageStats.value.damageBySkillType),
    },
    series: [
      {
        name: '技能类型占比',
        type: 'pie',
        radius: '60%',
        data: data,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      },
    ],
  };

  skillTypeChart.value.setOption(option);
};

// 处理窗口大小变化
const handleResize = () => {
  characterChart.value?.resize();
  skillTypeChart.value?.resize();
};

const togglePlay = () => {
  isPlaying.value = !isPlaying.value;
  if (isPlaying.value) {
    startPlayback();
  }
};

const startPlayback = () => {
  const interval = setInterval(() => {
    if (!isPlaying.value) {
      clearInterval(interval);
      return;
    }

    currentFrame.value += parseFloat(playbackSpeed.value);
    if (currentFrame.value >= (project?.value?.duration || 1200)) {
      currentFrame.value = 0;
    }
  }, 16.67); // 60fps
};

const stepForward = () => {
  currentFrame.value = Math.min(
    currentFrame.value + 1,
    project?.value?.duration || 1200
  );
};

const stepBackward = () => {
  currentFrame.value = Math.max(currentFrame.value - 1, 0);
};

const goToStart = () => {
  currentFrame.value = 0;
};

const goToEnd = () => {
  currentFrame.value = project?.value?.duration || 1200;
};

const jumpToFrame = frame => {
  currentFrame.value = frame;
};

const zoomIn = () => {
  scale.value = Math.min(scale.value + 0.5, 5);
};

const zoomOut = () => {
  scale.value = Math.max(scale.value - 0.5, 0.5);
};

const toggleTimeUnit = () => {
  timeUnit.value = timeUnit.value === 'frame' ? 'second' : 'frame';
};

const formatTime = frames => {
  if (timeUnit.value === 'second') {
    const seconds = Math.floor(frames / 60);
    const remainingFrames = frames % 60;
    return `${seconds}.${remainingFrames.toString().padStart(2, '0')}s`;
  } else {
    return `${frames}f`;
  }
};

// 解析分享链接
const parseShareLink = () => {
  const shareData = route.query.share;
  if (shareData) {
    try {
      // 解码 Base64
      const jsonString = decodeURIComponent(escape(atob(shareData)));
      const data = JSON.parse(jsonString);

      if (data.project) {
        // 导入项目
        const importedProject = projectStore.importProject(data);
        if (importedProject) {
          project.value = importedProject;
          // 初始化展开所有角色
          importedProject.characters.forEach(charId => {
            expandedCharacters.value.push(charId);
            visibleTracks.value.push(charId);
          });
          ElMessage.success('成功加载分享的项目');
          return true;
        }
      }
    } catch (error) {
      console.error('解析分享链接失败:', error);
      ElMessage.error('解析分享链接失败');
    }
  }
  return false;
};

// 撤销操作
const undo = () => {
  const action = historyStore.undo();
  if (action) {
    handleUndoAction(action, 'undo');
  }
};

// 重做操作
const redo = () => {
  const action = historyStore.redo();
  if (action) {
    handleUndoAction(action, 'redo');
  }
};

// 处理撤销/重做操作
const handleUndoAction = (action, mode) => {
  if (action.type.startsWith('skillBlock_')) {
    handleSkillBlockAction(action, mode);
  } else if (action.type.startsWith('keyframe_')) {
    handleKeyframeAction(action, mode);
  }
};

// 处理技能块操作
const handleSkillBlockAction = (action, mode) => {
  const actionType = action.type.replace('skillBlock_', '');
  switch (actionType) {
    case 'add':
      if (mode === 'undo') {
        projectStore.removeSkillBlock(
          project.value.id,
          action.data.skillBlock.id
        );
      } else if (mode === 'redo') {
        projectStore.addSkillBlock(project.value.id, action.data.skillBlock);
      }
      break;
    case 'delete':
      if (mode === 'undo') {
        projectStore.addSkillBlock(project.value.id, action.data.skillBlock);
      } else if (mode === 'redo') {
        projectStore.removeSkillBlock(
          project.value.id,
          action.data.skillBlock.id
        );
      }
      break;
    case 'update':
      if (mode === 'undo') {
        projectStore.updateSkillBlock(project.value.id, action.data.oldData);
      } else if (mode === 'redo') {
        projectStore.updateSkillBlock(project.value.id, action.data.skillBlock);
      }
      break;
    default:
      break;
  }
  calculateDamageStats();
};

// 处理关键帧操作
const handleKeyframeAction = (action, mode) => {
  const actionType = action.type.replace('keyframe_', '');
  switch (actionType) {
    case 'add':
      if (mode === 'undo') {
        projectStore.removeKeyframe(project.value.id, action.data.keyframe.id);
      } else if (mode === 'redo') {
        projectStore.addKeyframe(project.value.id, action.data.keyframe);
      }
      break;
    case 'delete':
      if (mode === 'undo') {
        projectStore.addKeyframe(project.value.id, action.data.keyframe);
      } else if (mode === 'redo') {
        projectStore.removeKeyframe(project.value.id, action.data.keyframe.id);
      }
      break;
    case 'update':
      if (mode === 'undo') {
        projectStore.updateKeyframe(project.value.id, action.data.oldData);
      } else if (mode === 'redo') {
        projectStore.updateKeyframe(project.value.id, action.data.keyframe);
      }
      break;
    default:
      break;
  }
};

// 切换循环播放
const toggleLoop = () => {
  loopSettings.value.enabled = !loopSettings.value.enabled;
  if (loopSettings.value.enabled) {
    applyLoopSettings();
  } else {
    stopLoopPlayback();
  }
};

// 应用循环播放设置
const applyLoopSettings = () => {
  stopLoopPlayback();
  if (loopSettings.value.enabled) {
    startLoopPlayback();
  }
};

// 开始循环播放
const startLoopPlayback = () => {
  let loopCount = 0;
  const maxLoopCount = loopSettings.value.loopCount;

  loopIntervalId.value = setInterval(() => {
    if (!isPlaying.value) {
      clearInterval(loopIntervalId.value);
      loopIntervalId.value = null;
      return;
    }

    currentFrame.value += parseFloat(playbackSpeed.value);

    if (currentFrame.value >= loopSettings.value.endFrame) {
      loopCount++;
      if (maxLoopCount !== -1 && loopCount >= maxLoopCount) {
        clearInterval(loopIntervalId.value);
        loopIntervalId.value = null;
        isPlaying.value = false;
        currentFrame.value = loopSettings.value.startFrame;
        return;
      }
      currentFrame.value = loopSettings.value.startFrame;
    }
  }, 16.67); // 60fps
};

// 停止循环播放
const stopLoopPlayback = () => {
  if (loopIntervalId.value) {
    clearInterval(loopIntervalId.value);
    loopIntervalId.value = null;
  }
};

// 打开快捷键设置对话框
const openShortcutsDialog = () => {
  loadShortcutSettings();
  shortcutsDialogVisible.value = true;
};

// 加载快捷键设置
const loadShortcutSettings = () => {
  const savedSettings = localStorage.getItem('promilia_shortcuts');
  if (savedSettings) {
    try {
      shortcutSettings.value = JSON.parse(savedSettings);
    } catch (error) {
      console.error('加载快捷键设置失败:', error);
    }
  }
};

// 保存快捷键设置
const saveShortcutSettings = () => {
  localStorage.setItem(
    'promilia_shortcuts',
    JSON.stringify(shortcutSettings.value)
  );
  shortcutsDialogVisible.value = false;
  ElMessage.success('快捷键设置已保存');
};

// 处理导出命令
const handleExportCommand = command => {
  if (!project.value) return;

  switch (command) {
    case 'promilia':
      exportProject();
      break;
    case 'json':
      exportJson();
      break;
    case 'image':
      exportImage();
      break;
    case 'markdown':
      exportMarkdown();
      break;
    case 'share':
      generateShareLink();
      break;
    default:
      break;
  }
};

// 导出项目
const exportProject = () => {
  if (project.value) {
    const exportData = projectStore.exportProject(project.value.id);
    if (exportData) {
      // 创建下载链接
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.value.name}_${new Date().toISOString().slice(0, 10)}.promilia`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      ElMessage.success('项目导出成功');
    }
  }
};

// 导出JSON
const exportJson = () => {
  if (project.value) {
    const exportData = JSON.stringify(project.value, null, 2);
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.value.name}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    ElMessage.success('JSON导出成功');
  }
};

// 导出图片
const exportImage = () => {
  ElMessage.info('图片导出功能开发中');
};

// 导出Markdown
const exportMarkdown = () => {
  ElMessage.info('Markdown导出功能开发中');
};

// 生成分享链接
const generateShareLink = () => {
  if (project.value) {
    try {
      const shareData = {
        project: project.value,
      };
      const jsonString = JSON.stringify(shareData);
      const base64String = btoa(unescape(encodeURIComponent(jsonString)));
      const shareUrl = `${window.location.origin}${window.location.pathname}?share=${base64String}`;

      // 复制到剪贴板
      navigator.clipboard
        .writeText(shareUrl)
        .then(() => {
          ElMessage.success('分享链接已复制到剪贴板');
        })
        .catch(() => {
          ElMessage.error('复制失败，请手动复制链接');
          console.log('分享链接:', shareUrl);
        });
    } catch (error) {
      console.error('生成分享链接失败:', error);
      ElMessage.error('生成分享链接失败');
    }
  }
};

// 开始新手引导
const startGuideTour = () => {
  guideTour.value?.startTour();
};

// 添加关键时间点
const addKeyframeAtPosition = event => {
  if (!project.value) return;

  const timelineRect = timelineContainer.value.getBoundingClientRect();
  const clickX = event.clientX - timelineRect.left;
  let frame = Math.round(clickX / scale.value);

  // 吸附到网格
  if (snapToGrid.value) {
    const snapStep = scale.value < 1 ? 60 : scale.value < 2 ? 30 : 10;
    frame = Math.round(frame / snapStep) * snapStep;
  }

  // 创建关键时间点
  const keyframe = {
    frame,
    name: `关键时间点 ${project.value.keyframes?.length + 1 || 1}`,
    color: '#E6A23C',
  };
  const newKeyframe = projectStore.addKeyframe(project.value.id, keyframe);
  if (newKeyframe) {
    historyStore.recordKeyframeAction('add', newKeyframe);
  }
};

const getSkillDependencies = () => {
  if (!project.value) return [];
  return project.value.skillDependencies;
};

const getSkillBlockById = blockId => {
  if (!project.value) return null;
  return project.value.skillBlocks.find(block => block.id === blockId);
};

const getTrackIndexByCharacterId = characterId => {
  return teamCharacters.value.findIndex(char => char.id === characterId);
};

const isSkillDependencySatisfied = (sourceBlock, targetBlock) => {
  // 简单的满足条件：源技能结束时间 <= 目标技能开始时间
  return sourceBlock.endFrame <= targetBlock.startFrame;
};

const addSkillDependency = () => {
  if (selectedSkillBlocks.value.length === 2) {
    const [block1, block2] = selectedSkillBlocks.value;
    // 确保源技能在目标技能之前
    const sourceBlock = block1.endFrame < block2.startFrame ? block1 : block2;
    const targetBlock = block1.endFrame < block2.startFrame ? block2 : block1;

    projectStore.addSkillDependency(
      project.value.id,
      sourceBlock.id,
      targetBlock.id
    );
    ElMessage.success('技能依赖关系已添加');
  }
};

const removeSkillDependency = (sourceBlockId, targetBlockId) => {
  projectStore.removeSkillDependencyByBlocks(
    project.value.id,
    sourceBlockId,
    targetBlockId
  );
  ElMessage.success('技能依赖关系已删除');
};

const handleLinkLineClick = data => {
  const sourceBlock = getSkillBlockById(data.sourceBlockId);
  const targetBlock = getSkillBlockById(data.targetBlockId);
  if (sourceBlock && targetBlock) {
    selectSkillBlocks([sourceBlock, targetBlock]);
  }
};

// 生命周期
onMounted(() => {
  // 加载游戏数据
  if (gamedataStore.characters.length === 0) {
    gamedataStore.loadGameData();
  }

  // 加载快捷键设置
  loadShortcutSettings();

  // 尝试解析分享链接
  const isShareLink = parseShareLink();

  if (!isShareLink) {
    // 获取项目ID
    const projectId = route.query.id;
    if (projectId) {
      // 加载项目
      project.value = projectStore.getProjectById(projectId);
      if (project.value) {
        // 初始化展开所有角色
        project.value.characters.forEach(charId => {
          expandedCharacters.value.push(charId);
          visibleTracks.value.push(charId);
        });
      }
    } else {
      // 创建新项目
      project.value = projectStore.createProject({
        name: '未命名项目',
        characters: [],
        enemy: '',
        fps: 60,
        duration: 1200,
      });
    }
  }

  // 计算伤害统计
  calculateDamageStats();

  // 初始化图表
  initCharts();

  // 添加窗口大小变化监听
  window.addEventListener('resize', handleResize);

  // 添加键盘事件监听
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  // 停止播放
  isPlaying.value = false;
  // 清理循环播放定时器
  if (loopIntervalId.value) {
    clearInterval(loopIntervalId.value);
    loopIntervalId.value = null;
  }
  // 保存项目
  if (project.value) {
    projectStore.saveProject(project.value.id);
  }

  // 清理事件监听器
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', handleKeydown);

  // 销毁图表
  characterChart.value?.dispose();
  skillTypeChart.value?.dispose();
});
</script>

<style scoped>
.editor {
  min-height: 100vh;
  padding: 0;
  display: flex;
  flex-direction: column;
}

/* 顶部导航栏 */
.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background-color: var(--bg-color-light);
  border-bottom: 1px solid var(--border-color);
  box-shadow: var(--box-shadow);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-left h1 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-color);
  margin: 0;
}

.header-center {
  display: flex;
  gap: 8px;
  align-items: center;
}

.header-right {
  display: flex;
  gap: 8px;
}

/* 主编辑区域 */
.editor-content {
  display: grid;
  grid-template-columns: 250px 1fr 280px;
  flex: 1;
  overflow: hidden;
}

/* 左侧技能库 */
.left-panel {
  background-color: var(--bg-color-light);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.panel-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.panel-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
  margin: 0;
}

.skill-library {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.character-group {
  background-color: var(--bg-color-lighter);
  border-radius: 6px;
  overflow: hidden;
}

.character-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.character-header:hover {
  background-color: var(--bg-color-hover);
}

.character-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.character-avatar {
  width: 32px;
  height: 32px;
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
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color);
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
}

.skill-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background-color: var(--bg-color);
  border-radius: 4px;
  cursor: grab;
  transition: background-color 0.2s;
}

.skill-item:hover {
  background-color: var(--bg-color-hover);
}

.skill-item:active {
  cursor: grabbing;
}

.skill-icon {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  background-color: var(--primary-color-light);
}

.skill-info {
  flex: 1;
}

.skill-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color);
  margin-bottom: 2px;
}

.skill-meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--text-color-secondary);
}

.meta-item {
  padding: 2px 6px;
  background-color: var(--bg-color-light);
  border-radius: 8px;
}

/* 中间时间轴 */
.main-panel {
  background-color: var(--bg-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 播放控制条 */
.timeline-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: var(--bg-color-light);
  border-bottom: 1px solid var(--border-color);
}

.control-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
}

.time-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.time-unit-control {
  display: flex;
  align-items: center;
}

/* 时间轴容器 */
.timeline-container {
  flex: 1;
  overflow: auto;
  position: relative;
}

/* 时间刻度 */
.timeline-header {
  height: 40px;
  border-bottom: 1px solid var(--border-color);
  position: relative;
  background-color: var(--bg-color-light);
  cursor: pointer;
}

.time-scale {
  position: relative;
  height: 100%;
}

.time-tick {
  position: absolute;
  top: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.tick-mark {
  width: 1px;
  flex: 1;
  background-color: var(--border-color);
}

.tick-label {
  font-size: 12px;
  color: var(--text-color-secondary);
  margin-top: 4px;
}

.keyframes {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

/* 轨道区域 */
.timeline-tracks {
  position: relative;
}

.track {
  border-bottom: 1px solid var(--border-color);
}

.track-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: var(--bg-color-light);
  border-bottom: 1px solid var(--border-color);
}

.track-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.track-controls {
  display: flex;
  gap: 8px;
}

.sub-tracks {
  background-color: var(--bg-color);
}

.sub-tracks.hidden {
  display: none;
}

.sub-track {
  border-bottom: 1px solid var(--border-color-light);
}

.sub-track-header {
  padding: 4px 16px;
  font-size: 12px;
  color: var(--text-color-secondary);
  background-color: var(--bg-color-lighter);
  border-bottom: 1px solid var(--border-color-light);
}

.sub-track-content {
  position: relative;
  height: 40px;
  padding: 4px 0;
  border-left: 1px solid var(--border-color);
}

/* 技能块 */
.skill-block {
  position: absolute;
  top: 4px;
  height: 32px;
  background-color: var(--primary-color-light);
  border: 1px solid var(--primary-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
}

.skill-block:hover {
  background-color: var(--primary-color);
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.skill-block.selected {
  border: 2px solid var(--primary-color);
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

.skill-block-content {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px;
  height: 100%;
}

.skill-block-icon {
  width: 20px;
  height: 20px;
  border-radius: 3px;
  background-color: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
}
</style>
