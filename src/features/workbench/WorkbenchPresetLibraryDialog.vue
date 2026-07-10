<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="preset-library-overlay"
      data-testid="workbench-preset-library"
      @click.self="emit('close')"
    >
      <section
        class="preset-library-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workbench-preset-library-title"
      >
        <header class="preset-library-header">
          <div>
            <span class="preset-library-eyebrow">项目预设</span>
            <h2 id="workbench-preset-library-title">预设轴库</h2>
          </div>
          <button
            class="icon-button"
            type="button"
            title="关闭预设轴库"
            data-testid="workbench-preset-close"
            @click="emit('close')"
          >
            <Close />
          </button>
        </header>

        <form class="preset-save-form" @submit.prevent="savePreset">
          <label>
            <span>预设名称</span>
            <input
              v-model="form.name"
              data-testid="workbench-preset-name-input"
              maxlength="80"
              type="text"
            />
          </label>
          <label>
            <span>标签</span>
            <input
              v-model="form.tags"
              data-testid="workbench-preset-tags-input"
              maxlength="200"
              type="text"
              placeholder="输出, 双人, 训练"
            />
          </label>
          <label class="preset-description-field">
            <span>备注</span>
            <textarea
              v-model="form.description"
              data-testid="workbench-preset-description-input"
              maxlength="240"
              rows="2"
            />
          </label>
          <div class="preset-save-summary">
            <span>{{ currentSummary.actionCount }} 个动作</span>
            <span>{{ currentSummary.actorNames.join(' / ') }}</span>
            <span>{{ currentSummary.enemyName }}</span>
          </div>
          <button
            class="command-button primary"
            data-testid="workbench-preset-save"
            type="submit"
            :disabled="!form.name.trim()"
          >
            <FolderAdd />
            <span>保存当前项目</span>
          </button>
        </form>

        <div class="preset-library-toolbar">
          <label class="preset-search-field">
            <Search />
            <input
              v-model="searchQuery"
              data-testid="workbench-preset-search-input"
              type="search"
              placeholder="搜索名称、角色、敌人或标签"
            />
          </label>
          <label class="preset-tag-filter">
            <span>标签</span>
            <select
              v-model="selectedTag"
              data-testid="workbench-preset-tag-filter"
            >
              <option value="">全部</option>
              <option v-for="tag in availableTags" :key="tag" :value="tag">
                {{ tag }}
              </option>
            </select>
          </label>
          <span
            class="preset-result-count"
            data-testid="workbench-preset-count"
          >
            {{ filteredPresets.length }} / {{ presets.length }}
          </span>
        </div>

        <div v-if="filteredPresets.length" class="preset-list">
          <article
            v-for="preset in filteredPresets"
            :key="preset.id"
            class="preset-row"
            :data-compatibility="preset.compatibilityStatus"
            :data-preset-id="preset.id"
            data-testid="workbench-preset-row"
          >
            <div class="preset-row-main">
              <div class="preset-row-title">
                <strong>{{ preset.name }}</strong>
                <span
                  class="compatibility-label"
                  :class="{
                    incompatible:
                      preset.compatibilityStatus ===
                      'incompatible-project-schema',
                  }"
                >
                  {{ compatibilityLabel(preset.compatibilityStatus) }}
                </span>
              </div>
              <p v-if="preset.description">{{ preset.description }}</p>
              <div class="preset-summary-line">
                <span>{{ preset.summary.actionCount }} 动作</span>
                <span>{{ formatActorNames(preset) }}</span>
                <span>{{ preset.summary.enemyName || '未记录敌人' }}</span>
                <span>{{ formatDate(preset.updatedAt) }}</span>
              </div>
              <div v-if="preset.tags.length" class="preset-tags">
                <button
                  v-for="tag in preset.tags"
                  :key="tag"
                  type="button"
                  @click="selectedTag = tag"
                >
                  {{ tag }}
                </button>
              </div>
            </div>
            <div class="preset-row-actions">
              <button
                class="icon-command primary"
                type="button"
                title="加载为当前项目副本"
                data-testid="workbench-preset-load"
                :disabled="
                  preset.compatibilityStatus === 'incompatible-project-schema'
                "
                @click="emit('load-preset', preset.id)"
              >
                <FolderOpened />
                <span>加载副本</span>
              </button>
              <button
                class="icon-command"
                type="button"
                title="复制预设"
                data-testid="workbench-preset-duplicate"
                :disabled="
                  preset.compatibilityStatus === 'incompatible-project-schema'
                "
                @click="emit('duplicate-preset', preset.id)"
              >
                <CopyDocument />
              </button>
              <button
                class="icon-command danger"
                type="button"
                title="删除预设"
                data-testid="workbench-preset-delete"
                @click="emit('delete-preset', preset.id)"
              >
                <Delete />
              </button>
            </div>
          </article>
        </div>
        <div v-else class="preset-empty" data-testid="workbench-preset-empty">
          <Files />
          <strong>{{
            presets.length ? '没有匹配的预设' : '预设轴库为空'
          }}</strong>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import {
  Close,
  CopyDocument,
  Delete,
  Files,
  FolderAdd,
  FolderOpened,
  Search,
} from '@element-plus/icons-vue';
import {
  filterWorkbenchPresets,
  getWorkbenchPresetCompatibilityLabel,
} from '../../domain/workbenchPresetStorage';

const props = defineProps({
  visible: { type: Boolean, default: false },
  presets: { type: Array, default: () => [] },
  defaultName: { type: String, default: '' },
  currentSummary: {
    type: Object,
    default: () => ({ actionCount: 0, actorNames: [], enemyName: '' }),
  },
});

const emit = defineEmits([
  'close',
  'save-preset',
  'load-preset',
  'duplicate-preset',
  'delete-preset',
]);

const searchQuery = ref('');
const selectedTag = ref('');
const form = reactive({ name: '', tags: '', description: '' });

const availableTags = computed(() =>
  [...new Set(props.presets.flatMap(preset => preset.tags ?? []))].sort(
    (a, b) => String(a).localeCompare(String(b), 'zh-CN')
  )
);
const filteredPresets = computed(() =>
  filterWorkbenchPresets(props.presets, {
    query: searchQuery.value,
    tag: selectedTag.value,
  })
);

watch(
  () => props.visible,
  visible => {
    if (!visible) {
      return;
    }
    form.name = props.defaultName;
    form.tags = '';
    form.description = '';
    searchQuery.value = '';
    selectedTag.value = '';
  }
);

function savePreset() {
  const name = form.name.trim();
  if (!name) {
    return;
  }
  emit('save-preset', {
    name,
    description: form.description.trim(),
    tags: form.tags,
  });
  form.name = props.defaultName;
  form.tags = '';
  form.description = '';
}

function compatibilityLabel(status) {
  return getWorkbenchPresetCompatibilityLabel(status);
}

function formatActorNames(preset) {
  if (preset.summary.actorNames?.length) {
    return preset.summary.actorNames.join(' / ');
  }
  if (preset.summary.characterIds?.length) {
    return preset.summary.characterIds.join(' / ');
  }
  return '未记录角色';
}

function formatDate(value) {
  return Number.isFinite(Date.parse(value)) ? String(value).slice(0, 10) : '';
}
</script>

<style scoped>
.preset-library-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(5, 8, 11, 0.78);
}

.preset-library-dialog {
  display: grid;
  grid-template-rows: auto auto auto minmax(180px, 1fr);
  width: min(1040px, 100%);
  max-height: min(820px, calc(100vh - 48px));
  overflow: hidden;
  border: 1px solid #36414a;
  border-radius: 6px;
  background: #151a1f;
  box-shadow: 0 18px 64px rgba(0, 0, 0, 0.52);
  color: #edf2f4;
}

.preset-library-header,
.preset-library-toolbar,
.preset-row,
.preset-save-form {
  border-bottom: 1px solid #2e373e;
}

.preset-library-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 18px 20px;
}

.preset-library-eyebrow,
.preset-save-form label > span,
.preset-tag-filter > span {
  color: #8c9aa4;
  font-size: 11px;
  font-weight: 800;
}

.preset-library-header h2 {
  margin: 3px 0 0;
  font-size: 20px;
  letter-spacing: 0;
}

.icon-button,
.icon-command,
.command-button,
.preset-tags button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #3b464e;
  border-radius: 4px;
  background: #20272d;
  color: #dbe3e7;
  cursor: pointer;
}

.icon-button {
  width: 34px;
  height: 34px;
}

.icon-button svg,
.icon-command svg,
.command-button svg,
.preset-search-field svg,
.preset-empty svg {
  width: 16px;
  height: 16px;
}

.preset-save-form {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(180px, 0.8fr) auto;
  gap: 12px;
  padding: 16px 20px;
  background: #11161a;
}

.preset-save-form label {
  display: grid;
  gap: 6px;
}

.preset-save-form input,
.preset-save-form textarea,
.preset-search-field,
.preset-tag-filter select {
  border: 1px solid #3a454e;
  border-radius: 4px;
  outline: none;
  background: #0e1317;
  color: #edf2f4;
  font: inherit;
}

.preset-save-form input,
.preset-tag-filter select {
  min-height: 34px;
  padding: 0 10px;
}

.preset-save-form textarea {
  min-height: 54px;
  padding: 8px 10px;
  resize: vertical;
}

.preset-description-field {
  grid-column: 1 / 3;
}

.preset-save-summary {
  display: flex;
  grid-column: 1 / 3;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 14px;
  color: #aab5bc;
  font-size: 12px;
}

.command-button {
  grid-column: 3;
  grid-row: 1 / 4;
  align-self: stretch;
  gap: 7px;
  min-width: 142px;
  padding: 0 14px;
  font-weight: 800;
}

.primary {
  border-color: #4c9e91;
  background: #27665e;
  color: #f4fffd;
}

.command-button:disabled,
.icon-command:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

.preset-library-toolbar {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto auto;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
}

.preset-search-field {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 10px;
}

.preset-search-field input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: inherit;
}

.preset-tag-filter {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preset-result-count {
  color: #8c9aa4;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.preset-list {
  min-height: 0;
  overflow: auto;
}

.preset-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 18px;
  padding: 15px 20px;
}

.preset-row:last-child {
  border-bottom: 0;
}

.preset-row:hover {
  background: #1b2228;
}

.preset-row-main {
  min-width: 0;
}

.preset-row-title,
.preset-summary-line,
.preset-tags,
.preset-row-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.preset-row-title {
  gap: 9px;
}

.preset-row-title strong {
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compatibility-label {
  padding: 2px 6px;
  border-radius: 3px;
  background: #294f4a;
  color: #bff4ea;
  font-size: 10px;
  font-weight: 800;
}

.compatibility-label.incompatible {
  background: #60363a;
  color: #ffd6d9;
}

.preset-row p {
  margin: 6px 0 0;
  color: #aeb9c0;
  font-size: 12px;
}

.preset-summary-line {
  gap: 6px 14px;
  margin-top: 8px;
  color: #86949d;
  font-size: 11px;
}

.preset-tags {
  gap: 6px;
  margin-top: 9px;
}

.preset-tags button {
  min-height: 22px;
  padding: 0 7px;
  border-color: #3b4d56;
  background: #19252b;
  color: #b8d8d2;
  font-size: 10px;
}

.preset-row-actions {
  justify-content: flex-end;
  gap: 7px;
}

.icon-command {
  min-width: 34px;
  min-height: 34px;
  gap: 6px;
  padding: 0 9px;
  font-size: 12px;
  font-weight: 800;
}

.icon-command.danger {
  border-color: #704249;
  color: #ffb8bf;
}

.preset-empty {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 10px;
  min-height: 220px;
  color: #7f8c95;
}

.preset-empty svg {
  width: 24px;
  height: 24px;
}

@media (max-width: 760px) {
  .preset-library-overlay {
    padding: 10px;
  }

  .preset-library-dialog {
    max-height: calc(100vh - 20px);
  }

  .preset-save-form,
  .preset-library-toolbar,
  .preset-row {
    grid-template-columns: 1fr;
  }

  .preset-description-field,
  .preset-save-summary,
  .command-button {
    grid-column: 1;
    grid-row: auto;
  }

  .command-button {
    min-height: 40px;
  }

  .preset-row-actions {
    justify-content: flex-start;
  }
}
</style>
