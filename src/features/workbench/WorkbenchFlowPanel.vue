<template>
  <section
    class="workbench-flow-panel"
    :data-action-id="selectedAction?.id ?? ''"
    :data-edit-result-state-point-id="
      actionEditResultContext?.runtimeStatePointId ?? ''
    "
    :data-runtime-detail-action-id="runtimeSelectedDetail?.actionId ?? ''"
    :data-runtime-detail-state-point-id="
      runtimeSelectedDetail?.statePointId ?? ''
    "
    :data-runtime-sim-log-count="runtimeSummary.simLogCount ?? 0"
    data-testid="workbench-flow-panel"
  >
    <div class="flow-main">
      <div class="flow-heading">
        <TrendCharts class="flow-icon" />
        <div>
          <span>主流程</span>
          <strong data-testid="workbench-flow-selected-action">
            {{ selectedAction?.name ?? '未选动作' }}
          </strong>
        </div>
      </div>

      <div class="flow-context">
        <div>
          <span>运行</span>
          <strong data-testid="workbench-flow-runtime-count">
            {{ runtimeSummary.simLogCount ?? 0 }} 日志
          </strong>
        </div>
        <div>
          <span>当前结果</span>
          <strong data-testid="workbench-flow-runtime-detail">
            {{ runtimeDetailLabel }}
          </strong>
        </div>
        <div>
          <span>刷新结果</span>
          <strong data-testid="workbench-flow-edit-result">
            {{ editResultLabel }}
          </strong>
        </div>
      </div>
    </div>

    <div class="flow-actions">
      <button
        type="button"
        class="flow-button"
        data-testid="workbench-flow-open-runtime"
        :disabled="!hasRuntimeResults"
        @click="$emit('open-runtime-results')"
      >
        <TrendCharts class="flow-button-icon" />
        <span>查看运行结果</span>
      </button>
      <button
        type="button"
        class="flow-button"
        :data-action-id="runtimeSelectedDetail?.actionId ?? ''"
        :data-state-point-id="runtimeSelectedDetail?.statePointId ?? ''"
        data-testid="workbench-flow-edit-runtime-action"
        :disabled="!runtimeSelectedDetail?.actionId"
        @click="focusRuntimeAction"
      >
        <EditPen class="flow-button-icon" />
        <span>编辑结果动作</span>
      </button>
      <button
        type="button"
        class="flow-button secondary"
        :data-action-id="actionEditResultContext?.actionId ?? ''"
        :data-state-point-id="
          actionEditResultContext?.runtimeStatePointId ?? ''
        "
        data-testid="workbench-flow-return-edit-result"
        :disabled="!actionEditResultContext?.runtimeStatePointId"
        @click="returnRuntimeResult"
      >
        <ArrowRight class="flow-button-icon" />
        <span>回到刷新结果</span>
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { ArrowRight, EditPen, TrendCharts } from '@element-plus/icons-vue';

const props = defineProps({
  selectedAction: {
    type: Object,
    default: null,
  },
  runtimeProjection: {
    type: Object,
    default: null,
  },
  runtimeSelectedDetail: {
    type: Object,
    default: null,
  },
  actionEditResultContext: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits([
  'open-runtime-results',
  'focus-runtime-action',
  'return-runtime-result',
]);

const runtimeSummary = computed(() => props.runtimeProjection?.summary ?? {});
const hasRuntimeResults = computed(
  () => (runtimeSummary.value.simLogCount ?? 0) > 0
);
const runtimeDetailLabel = computed(() => {
  const detail = props.runtimeSelectedDetail;
  if (!detail) {
    return '未选中';
  }
  return [detail.frameLabel, detail.trackLabel || detail.trackKey]
    .filter(Boolean)
    .join(' · ');
});
const editResultLabel = computed(() => {
  const context = props.actionEditResultContext;
  if (!context?.runtimeStatePointId) {
    return '无刷新结果';
  }
  return [context.label, context.changeSummary].filter(Boolean).join(' ');
});

function focusRuntimeAction() {
  const detail = props.runtimeSelectedDetail;
  if (!detail?.actionId) {
    return;
  }
  emit('focus-runtime-action', {
    actionId: detail.actionId,
    fieldKey: 'startMs',
    frameLabel: detail.frameLabel ?? `${detail.timeMs ?? 0}ms`,
    statePointId: detail.statePointId ?? '',
    trackKey: detail.trackKey ?? '',
  });
}

function returnRuntimeResult() {
  const context = props.actionEditResultContext;
  if (!context?.runtimeStatePointId) {
    return;
  }
  emit('return-runtime-result', {
    actionId: context.actionId,
    statePointId: context.runtimeStatePointId,
  });
}
</script>

<style scoped>
.workbench-flow-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: #14191f;
}

.flow-main {
  display: flex;
  align-items: center;
  gap: 18px;
  min-width: 0;
}

.flow-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 180px;
}

.flow-icon {
  width: 18px;
  height: 18px;
  color: #79c7b9;
}

.flow-heading div,
.flow-context div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.flow-heading span,
.flow-context span {
  color: #8f9aa3;
  font-size: 11px;
}

.flow-heading strong,
.flow-context strong {
  min-width: 0;
  overflow: hidden;
  color: #eef4f2;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flow-context {
  display: grid;
  grid-template-columns: repeat(3, minmax(120px, 1fr));
  gap: 12px;
  min-width: 0;
}

.flow-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.flow-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid rgba(121, 199, 185, 0.32);
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.1);
  color: #dff6f1;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.flow-button.secondary {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: #d9dee3;
}

.flow-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.flow-button:not(:disabled):hover,
.flow-button:not(:disabled):focus {
  filter: brightness(1.15);
}

.flow-button-icon {
  width: 14px;
  height: 14px;
}

@media (max-width: 1040px) {
  .workbench-flow-panel {
    grid-template-columns: 1fr;
  }

  .flow-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 720px) {
  .workbench-flow-panel {
    padding: 10px 16px;
  }

  .flow-main {
    align-items: stretch;
    flex-direction: column;
    gap: 10px;
  }

  .flow-context {
    grid-template-columns: 1fr;
  }
}
</style>
