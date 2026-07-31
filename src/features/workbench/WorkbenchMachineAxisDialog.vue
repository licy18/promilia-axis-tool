<template>
  <div
    v-if="visible"
    class="machine-axis-overlay"
    data-testid="workbench-machine-axis-dialog"
    @pointerdown.self="$emit('close')"
  >
    <section
      class="machine-axis-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="machine-axis-dialog-title"
      @pointerdown.stop
    >
      <header>
        <div>
          <span>项目互通</span>
          <strong id="machine-axis-dialog-title">Machine Axis v1</strong>
        </div>
        <button
          type="button"
          title="关闭"
          aria-label="关闭 Machine Axis"
          data-testid="workbench-close-machine-axis"
          @click="$emit('close')"
        >
          ×
        </button>
      </header>

      <div class="machine-axis-actions">
        <button
          type="button"
          data-testid="workbench-machine-axis-import"
          @click="$emit('import-file')"
        >
          导入文件
        </button>
        <button
          type="button"
          data-testid="workbench-machine-axis-load-fixture"
          @click="$emit('load-fixture')"
        >
          载入 120 秒验收轴
        </button>
        <button
          type="button"
          data-testid="workbench-machine-axis-export"
          @click="$emit('export')"
        >
          导出当前轴
        </button>
      </div>

      <p class="machine-axis-status" data-testid="machine-axis-status">
        {{ status || '等待导入或导出' }}
      </p>

      <dl v-if="hashRows.length" class="machine-axis-hashes">
        <div v-for="row in hashRows" :key="row.key">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>

      <div
        v-if="summary"
        class="machine-axis-summary"
        data-testid="machine-axis-summary"
      >
        <span>机器输入 {{ summary.requestedActionCount ?? 0 }}</span>
        <span>实际执行 {{ summary.executedActionCount ?? 0 }}</span>
        <span>Trace facts {{ summary.factCount ?? 0 }}</span>
      </div>

      <section
        v-if="diagnostics.length"
        class="machine-axis-diagnostics"
        data-testid="machine-axis-import-diagnostics"
      >
        <h3>导入诊断</h3>
        <div
          v-for="(diagnostic, index) in diagnostics"
          :key="diagnosticKey(diagnostic, index)"
          :data-diagnostic-code="diagnostic.code"
        >
          <strong>{{ diagnostic.code || 'machine-axis-import-invalid' }}</strong>
          <span>{{ diagnostic.path || 'contract' }}</span>
          <p>{{ diagnostic.message || 'Machine Axis 输入无效' }}</p>
        </div>
      </section>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  diagnostics: {
    type: Array,
    default: () => [],
  },
  hashes: {
    type: Object,
    default: null,
  },
  summary: {
    type: Object,
    default: null,
  },
  status: {
    type: String,
    default: '',
  },
});

defineEmits(['close', 'import-file', 'load-fixture', 'export']);

const hashRows = computed(() =>
  [
    ['input', 'Input'],
    ['data', 'Data'],
    ['trace', 'Trace'],
    ['evaluation', 'Evaluation'],
  ]
    .map(([key, label]) => ({
      key,
      label,
      value: props.hashes?.[key] ?? '',
    }))
    .filter(row => row.value)
);

function diagnosticKey(diagnostic, index) {
  return [
    diagnostic.code,
    diagnostic.path,
    diagnostic.actionId,
    diagnostic.hitIdentity,
    index,
  ].join('|');
}
</script>

<style scoped>
.machine-axis-overlay {
  position: fixed;
  z-index: 90;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgb(6 9 12 / 72%);
}

.machine-axis-dialog {
  width: min(620px, calc(100vw - 40px));
  max-height: min(720px, calc(100vh - 40px));
  overflow: auto;
  border: 1px solid #46535e;
  border-radius: 6px;
  background: #12181d;
  box-shadow: 0 14px 40px rgb(0 0 0 / 42%);
  color: #dce5ec;
}

.machine-axis-dialog > header {
  position: sticky;
  z-index: 1;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 15px;
  border-bottom: 1px solid #303a43;
  background: #12181d;
}

.machine-axis-dialog > header div {
  display: grid;
  gap: 2px;
}

.machine-axis-dialog > header span {
  color: #8493a0;
  font-size: 10px;
}

.machine-axis-dialog > header strong {
  font-size: 14px;
}

.machine-axis-dialog > header button {
  width: 30px;
  height: 30px;
  border: 1px solid #46535e;
  border-radius: 4px;
  background: #171e24;
  color: #dce5ec;
  font-size: 18px;
}

.machine-axis-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  padding: 14px 15px 8px;
}

.machine-axis-actions button {
  min-height: 30px;
  border: 1px solid #4c5d69;
  border-radius: 4px;
  background: #1a2228;
  color: #dce5ec;
  font-size: 11px;
}

.machine-axis-status {
  margin: 0;
  padding: 6px 15px 12px;
  color: #9aa8b3;
  font-size: 11px;
}

.machine-axis-hashes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
  margin: 0;
  padding: 12px 15px;
  border-block: 1px solid #303a43;
}

.machine-axis-hashes div {
  min-width: 0;
}

.machine-axis-hashes dt {
  color: #82919e;
  font-size: 9px;
  text-transform: uppercase;
}

.machine-axis-hashes dd {
  margin: 2px 0 0;
  overflow: hidden;
  color: #cdd8df;
  font-family: ui-monospace, monospace;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.machine-axis-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 10px 15px;
  color: #a9b5be;
  font-size: 10px;
}

.machine-axis-diagnostics {
  padding: 12px 15px 16px;
}

.machine-axis-diagnostics h3 {
  margin: 0 0 8px;
  color: #edf2f5;
  font-size: 12px;
}

.machine-axis-diagnostics div {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2px 8px;
  padding: 7px 0;
  border-bottom: 1px solid #2b343c;
}

.machine-axis-diagnostics strong {
  overflow-wrap: anywhere;
  color: #e2a0a0;
  font-size: 10px;
}

.machine-axis-diagnostics span {
  color: #8d9aa5;
  font-family: ui-monospace, monospace;
  font-size: 9px;
}

.machine-axis-diagnostics p {
  grid-column: 1 / -1;
  margin: 0;
  color: #c0cbd3;
  font-size: 10px;
}

button:focus-visible {
  outline: 2px solid #76a9c7;
  outline-offset: 1px;
}
</style>
