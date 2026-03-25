<template>
  <div class="validate-panel">
    <div class="panel-header">
      <h3>循环校验</h3>
      <el-button size="small" @click="runValidation" :loading="isValidating">
        <el-icon><Refresh /></el-icon>
        刷新校验
      </el-button>
    </div>

    <div class="validation-result">
      <div v-if="isValidating" class="loading">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>校验中...</span>
      </div>

      <div
        v-else-if="validationResult && validationResult.valid"
        class="valid-result"
      >
        <el-icon class="success-icon"><Check /></el-icon>
        <span>时间轴校验通过，未发现任何问题</span>
      </div>

      <div
        v-else-if="validationResult && validationResult.errors.length > 0"
        class="error-list"
      >
        <div class="result-summary">
          <el-icon class="error-icon"><Warning /></el-icon>
          <span>发现 {{ validationResult.errors.length }} 个问题</span>
          <el-button size="small" @click="generateReport"> 生成报告 </el-button>
        </div>

        <div class="error-groups">
          <div
            v-for="(errors, type) in groupedErrors"
            :key="type"
            class="error-group"
          >
            <div class="group-header">
              <span class="group-title">{{ getErrorTypeLabel(type) }}</span>
              <span class="group-count">{{ errors.length }}</span>
            </div>

            <div class="error-items">
              <div
                v-for="(error, index) in errors"
                :key="index"
                class="error-item"
                :class="error.severity"
                @click="jumpToError(error)"
              >
                <el-icon :class="getErrorIcon(error.severity)">
                  <component :is="getErrorIconComponent(error.severity)" />
                </el-icon>
                <div class="error-content">
                  <div class="error-message">{{ error.message }}</div>
                  <div v-if="error.startTime" class="error-time">
                    时间：{{ formatTime(error.startTime) }} -
                    {{ formatTime(error.endTime || error.startTime) }}
                  </div>
                </div>
                <el-icon class="jump-icon"><ArrowRight /></el-icon>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="no-result">
        <span>点击 "刷新校验" 按钮开始校验时间轴</span>
      </div>
    </div>

    <!-- 校验报告对话框 -->
    <el-dialog v-model="reportDialogVisible" title="校验报告" width="80%">
      <pre class="report-content">{{ validationReport }}</pre>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="reportDialogVisible = false">关闭</el-button>
          <el-button type="primary" @click="copyReport">复制报告</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { ElMessage, ElIcon } from 'element-plus';
import {
  Refresh,
  Loading,
  Check,
  Warning,
  CircleClose,
  InfoFilled,
  ArrowRight,
} from '@element-plus/icons-vue';
import {
  validateTimeline,
  generateValidationReport,
} from '../../utils/validate';

// Props
const props = defineProps({
  project: {
    type: Object,
    default: null,
  },
  gamedata: {
    type: Object,
    default: () => ({}),
  },
});

// Emits
const emit = defineEmits(['jump-to-frame', 'select-skill-block']);

// 响应式数据
const isValidating = ref(false);
const validationResult = ref(null);
const reportDialogVisible = ref(false);
const validationReport = ref('');

// 计算属性
const groupedErrors = computed(() => {
  if (!validationResult.value || !validationResult.value.errors) {
    return {};
  }

  return validationResult.value.errors.reduce((groups, error) => {
    if (!groups[error.type]) {
      groups[error.type] = [];
    }
    groups[error.type].push(error);
    return groups;
  }, {});
});

// 方法
const runValidation = async () => {
  isValidating.value = true;
  try {
    const result = validateTimeline(props.project, props.gamedata);
    validationResult.value = result;
  } catch (error) {
    console.error('Validation error:', error);
    ElMessage.error('校验过程中发生错误');
  } finally {
    isValidating.value = false;
  }
};

const generateReport = () => {
  if (!validationResult.value) {
    ElMessage.warning('请先运行校验');
    return;
  }

  validationReport.value = generateValidationReport(validationResult.value);
  reportDialogVisible.value = true;
};

const copyReport = () => {
  navigator.clipboard
    .writeText(validationReport.value)
    .then(() => {
      ElMessage.success('报告已复制到剪贴板');
    })
    .catch(() => {
      ElMessage.error('复制失败');
    });
};

const jumpToError = error => {
  // 跳转到错误发生的时间点
  if (error.startTime) {
    emit('jump-to-frame', error.startTime);
  }

  // 选中相关的技能块
  if (error.skillBlock) {
    emit('select-skill-block', error.skillBlock);
  } else if (error.skillBlocks && error.skillBlocks.length > 0) {
    emit('select-skill-block', error.skillBlocks[0]);
  }
};

const getErrorTypeLabel = type => {
  const labels = {
    cd_conflict: 'CD冲突',
    resource_error: '资源错误',
    resource_warning: '资源警告',
    dependency_error: '依赖错误',
    action_error: '动作错误',
  };
  return labels[type] || type;
};

const getErrorIcon = severity => {
  return severity === 'error' ? 'error-icon' : 'warning-icon';
};

const getErrorIconComponent = severity => {
  return severity === 'error' ? CircleClose : Warning;
};

const formatTime = frames => {
  const seconds = Math.floor(frames / 60);
  const remainingFrames = frames % 60;
  return `${seconds}.${remainingFrames.toString().padStart(2, '0')}s`;
};

// 监听项目变化，自动重新校验
watch(
  () => props.project,
  () => {
    if (props.project) {
      runValidation();
    }
  },
  { deep: true }
);

// 初始化时运行校验
if (props.project) {
  runValidation();
}
</script>

<style scoped>
.validate-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.panel-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
  margin: 0;
}

.validation-result {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-color-secondary);
  padding: 20px 0;
}

.valid-result {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #67c23a;
  padding: 20px 0;
}

.success-icon {
  font-size: 20px;
  color: #67c23a;
}

.error-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.result-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background-color: #fef0f0;
  border-radius: 4px;
  border-left: 4px solid #f56c6c;
}

.error-icon {
  color: #f56c6c;
  font-size: 16px;
}

.error-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.error-group {
  background-color: var(--bg-color);
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background-color: var(--bg-color-light);
  border-bottom: 1px solid var(--border-color);
}

.group-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color);
}

.group-count {
  font-size: 12px;
  color: var(--text-color-secondary);
  background-color: var(--bg-color);
  padding: 2px 8px;
  border-radius: 10px;
}

.error-items {
  padding: 8px 0;
}

.error-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid var(--border-color-light);
}

.error-item:hover {
  background-color: var(--bg-color-hover);
}

.error-item:last-child {
  border-bottom: none;
}

.error-item.error {
  border-left: 3px solid #f56c6c;
}

.error-item.warning {
  border-left: 3px solid #e6a23c;
}

.error-item .el-icon {
  font-size: 16px;
  margin-top: 2px;
}

.error-content {
  flex: 1;
  min-width: 0;
}

.error-message {
  font-size: 14px;
  color: var(--text-color);
  margin-bottom: 4px;
  line-height: 1.4;
}

.error-time {
  font-size: 12px;
  color: var(--text-color-secondary);
}

.jump-icon {
  font-size: 14px;
  color: var(--text-color-secondary);
  margin-top: 2px;
}

.no-result {
  color: var(--text-color-secondary);
  padding: 20px 0;
  text-align: center;
}

.report-content {
  white-space: pre-wrap;
  font-family: monospace;
  font-size: 14px;
  line-height: 1.5;
  max-height: 500px;
  overflow-y: auto;
  padding: 16px;
  background-color: var(--bg-color-lighter);
  border-radius: 4px;
}

.dialog-footer {
  width: 100%;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
