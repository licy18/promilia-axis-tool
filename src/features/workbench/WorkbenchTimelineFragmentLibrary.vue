<template>
  <section
    class="fragment-library"
    data-testid="workbench-timeline-fragment-library"
  >
    <form class="fragment-save-form" @submit.prevent="saveSelection">
      <div class="fragment-form-heading">
        <strong>保存当前选择</strong>
        <span>{{ selectedActionCount }} 个动作</span>
      </div>
      <input
        v-model.trim="fragmentName"
        data-testid="workbench-fragment-name-input"
        type="text"
        maxlength="48"
        placeholder="片段名称"
      />
      <input
        v-model.trim="fragmentTags"
        data-testid="workbench-fragment-tags-input"
        type="text"
        maxlength="80"
        placeholder="标签，用逗号分隔"
      />
      <button
        class="primary-command"
        data-testid="workbench-save-timeline-fragment"
        type="submit"
        :disabled="selectedActionCount === 0"
      >
        <Plus class="command-icon" />
        <span>保存为片段</span>
      </button>
    </form>

    <div class="fragment-library-tools">
      <label class="fragment-search">
        <Search class="search-icon" aria-hidden="true" />
        <input
          v-model.trim="query"
          data-testid="workbench-fragment-search"
          type="search"
          placeholder="搜索名称或标签"
        />
      </label>
      <div class="fragment-file-actions">
        <button
          type="button"
          title="导入片段库 JSON"
          aria-label="导入片段库 JSON"
          data-testid="workbench-import-fragment-library"
          @click="openImport"
        >
          <Upload class="command-icon" />
        </button>
        <button
          type="button"
          title="导出片段库 JSON"
          aria-label="导出片段库 JSON"
          data-testid="workbench-export-fragment-library"
          :disabled="fragments.length === 0"
          @click="$emit('export-library')"
        >
          <Download class="command-icon" />
        </button>
        <input
          ref="importInput"
          class="file-input"
          type="file"
          accept=".json,application/json"
          data-testid="workbench-import-fragment-library-file"
          @change="importLibrary"
        />
      </div>
    </div>

    <p
      v-if="filteredFragments.length === 0"
      class="fragment-empty"
      data-testid="workbench-fragment-empty"
    >
      {{ fragments.length ? '没有匹配的片段' : '还没有保存片段' }}
    </p>

    <div v-else class="fragment-list">
      <article
        v-for="fragment in filteredFragments"
        :key="fragment.id"
        class="fragment-item"
        :class="'status-' + fragment.compatibility.status"
        data-testid="workbench-timeline-fragment"
        :data-fragment-id="fragment.id"
        :data-compatibility-status="fragment.compatibility.status"
      >
        <button
          class="fragment-insert"
          type="button"
          data-testid="workbench-insert-timeline-fragment"
          :data-fragment-id="fragment.id"
          :data-drag-enabled="
            fragment.compatibility.status === 'valid' ? 'true' : 'false'
          "
          :disabled="fragment.compatibility.status !== 'valid'"
          :title="fragmentCompatibilityTitle(fragment)"
          @pointerdown="beginFragmentDrag($event, fragment)"
          @click="$emit('insert-fragment', fragment.id)"
        >
          <span class="fragment-item-heading">
            <strong>{{ fragment.name }}</strong>
            <small>{{ compatibilityLabel(fragment.compatibility) }}</small>
          </span>
          <span class="fragment-summary">
            {{ fragment.summary.actionCount }} 动作
            <i aria-hidden="true"></i>
            {{ formatDuration(fragment.durationMs) }}
          </span>
          <span class="fragment-lanes">
            {{ formatLaneKinds(fragment.summary.laneKinds) }}
          </span>
          <span v-if="fragment.tags.length" class="fragment-tags">
            <span v-for="tag in fragment.tags.slice(0, 3)" :key="tag">{{
              tag
            }}</span>
          </span>
        </button>
        <div class="fragment-item-actions">
          <button
            type="button"
            title="复制片段"
            aria-label="复制片段"
            data-testid="workbench-duplicate-timeline-fragment"
            :data-fragment-id="fragment.id"
            @click="$emit('duplicate-fragment', fragment.id)"
          >
            <CopyDocument class="command-icon" />
          </button>
          <button
            class="danger"
            type="button"
            title="删除片段"
            aria-label="删除片段"
            data-testid="workbench-delete-timeline-fragment"
            :data-fragment-id="fragment.id"
            @click="$emit('delete-fragment', fragment.id)"
          >
            <Delete class="command-icon" />
          </button>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import {
  CopyDocument,
  Delete,
  Download,
  Plus,
  Search,
  Upload,
} from '@element-plus/icons-vue';
import { msToFrame } from '../../domain/timebase';

const props = defineProps({
  fragments: {
    type: Array,
    default: () => [],
  },
  selectedActionCount: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits([
  'save-fragment',
  'insert-fragment',
  'duplicate-fragment',
  'delete-fragment',
  'export-library',
  'import-library',
  'begin-fragment-drag',
]);

const fragmentName = ref('');
const fragmentTags = ref('');
const query = ref('');
const importInput = ref(null);

const filteredFragments = computed(() => {
  const normalizedQuery = query.value.toLocaleLowerCase();
  if (!normalizedQuery) return props.fragments;
  return props.fragments.filter(fragment =>
    [fragment.name, fragment.description, ...fragment.tags].some(value =>
      String(value).toLocaleLowerCase().includes(normalizedQuery)
    )
  );
});

function saveSelection() {
  if (!props.selectedActionCount) return;
  emit('save-fragment', {
    name: fragmentName.value,
    tags: fragmentTags.value,
  });
  fragmentName.value = '';
  fragmentTags.value = '';
}

function beginFragmentDrag(event, fragment) {
  if (event.button !== 0 || fragment.compatibility.status !== 'valid') {
    return;
  }
  emit('begin-fragment-drag', {
    fragmentId: fragment.id,
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY,
  });
}

function openImport() {
  importInput.value?.click();
}

function importLibrary(event) {
  const file = event.target?.files?.[0] ?? null;
  if (file) emit('import-library', file);
  if (event.target) event.target.value = '';
}

function compatibilityLabel(compatibility) {
  return (
    {
      valid: '可用',
      unresolved: '待确认',
      blocked: '不兼容',
    }[compatibility?.status] ?? '不可用'
  );
}

function fragmentCompatibilityTitle(fragment) {
  return fragment.compatibility.issues[0]?.message ?? `插入 ${fragment.name}`;
}

function formatDuration(durationMs) {
  return `${msToFrame(durationMs)}F`;
}

function formatLaneKinds(laneKinds) {
  const labels = {
    'actor-action': '角色',
    'actor-kibo': '奇波',
    'enemy-event': '敌人',
    system: '系统',
  };
  return [...new Set(laneKinds.map(kind => labels[kind] ?? kind))].join(' / ');
}
</script>

<style scoped>
.fragment-library {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 10px;
}

.fragment-save-form,
.fragment-library-tools {
  display: grid;
  gap: 8px;
}

.fragment-save-form {
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.fragment-form-heading,
.fragment-item-heading,
.fragment-library-tools {
  align-items: center;
}

.fragment-form-heading,
.fragment-item-heading {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.fragment-form-heading strong {
  color: #f2f5f7;
  font-size: 12px;
}

.fragment-form-heading span,
.fragment-item-heading small {
  color: #8f9aa3;
  font-size: 10px;
}

input,
button {
  font: inherit;
}

.fragment-save-form input,
.fragment-search {
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 4px;
  background: #11161b;
}

.fragment-save-form input {
  width: 100%;
  padding: 7px 8px;
  color: #f2f5f7;
  font-size: 11px;
}

.primary-command,
.fragment-file-actions button,
.fragment-item-actions button {
  border: 1px solid rgba(121, 199, 185, 0.32);
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.1);
  color: #dff6f1;
  cursor: pointer;
}

.primary-command {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 30px;
}

button:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

.fragment-library-tools {
  grid-template-columns: minmax(0, 1fr) auto;
}

.fragment-search {
  display: grid;
  grid-template-columns: 15px minmax(0, 1fr);
  align-items: center;
  gap: 5px;
  padding: 0 7px;
}

.fragment-search input {
  min-width: 0;
  padding: 7px 0;
  border: 0;
  outline: none;
  background: transparent;
  color: #f2f5f7;
  font-size: 11px;
}

.search-icon,
.command-icon {
  width: 14px;
  height: 14px;
}

.fragment-file-actions,
.fragment-item-actions {
  display: flex;
  gap: 5px;
}

.fragment-file-actions button,
.fragment-item-actions button {
  display: inline-grid;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
}

.file-input {
  display: none;
}

.fragment-empty {
  margin: 16px 0;
  color: #8f9aa3;
  font-size: 11px;
  text-align: center;
}

.fragment-list {
  display: grid;
  gap: 8px;
}

.fragment-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px;
  min-width: 0;
  padding: 7px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-left: 3px solid #79c7b9;
  border-radius: 6px;
  background: rgba(12, 17, 21, 0.72);
}

.fragment-item.status-unresolved {
  border-left-color: #d6ad61;
}

.fragment-item.status-blocked {
  border-left-color: #d97878;
}

.fragment-insert {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: grab;
  text-align: left;
}

.fragment-insert:disabled {
  cursor: not-allowed;
}

.fragment-insert[data-drag-enabled='true']:active {
  cursor: grabbing;
}

.fragment-item-heading strong,
.fragment-summary,
.fragment-lanes {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fragment-item-heading strong {
  color: #f2f5f7;
  font-size: 12px;
}

.fragment-summary,
.fragment-lanes {
  color: #aeb7be;
  font-size: 10px;
}

.fragment-summary {
  display: flex;
  align-items: center;
  gap: 5px;
}

.fragment-summary i {
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: #66737d;
}

.fragment-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.fragment-tags span {
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(121, 199, 185, 0.1);
  color: #8fd4c8;
  font-size: 9px;
}

.fragment-item-actions {
  flex-direction: column;
}

.fragment-item-actions button.danger {
  border-color: rgba(217, 120, 120, 0.35);
  color: #f0a7a7;
}

@media (max-width: 620px) {
  .fragment-library {
    padding: 10px 8px;
  }

  .fragment-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 430px) {
  .fragment-list {
    grid-template-columns: 1fr;
  }
}
</style>
