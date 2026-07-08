<template>
  <section
    class="workbench-flow-panel"
    :data-action-id="workbenchFlow.selectedActionId"
    :data-edit-result-state-point-id="workbenchFlow.editResult.statePointId"
    :data-flow-phase="workbenchFlow.phase"
    :data-runtime-detail-action-id="workbenchFlow.runtimeDetail.actionId"
    :data-runtime-detail-state-point-id="workbenchFlow.runtimeDetail.statePointId"
    :data-runtime-navigation-count="workbenchFlow.runtimeNavigation.count"
    :data-runtime-navigation-index="workbenchFlow.runtimeNavigation.index"
    :data-runtime-overview-active="
      workbenchFlow.runtimeOverviewActive ? 'true' : 'false'
    "
    :data-runtime-next-state-point-id="
      workbenchFlow.runtimeNavigation.next?.statePointId ?? ''
    "
    :data-runtime-previous-state-point-id="
      workbenchFlow.runtimeNavigation.previous?.statePointId ?? ''
    "
    :data-runtime-sim-log-count="workbenchFlow.runtimeSimLogCount"
    data-testid="workbench-flow-panel"
  >
    <div class="flow-main">
      <div class="flow-heading">
        <TrendCharts class="flow-icon" />
        <div>
          <span>主流程</span>
          <strong data-testid="workbench-flow-selected-action">
            {{ workbenchFlow.selectedActionName }}
          </strong>
        </div>
      </div>

      <div class="flow-context">
        <div>
          <span>运行</span>
          <strong data-testid="workbench-flow-runtime-count">
            {{ workbenchFlow.runtimeSimLogCount }} 日志
          </strong>
        </div>
        <div>
          <span>当前结果</span>
          <strong data-testid="workbench-flow-runtime-detail">
            {{ workbenchFlow.runtimeDetail.label }}
          </strong>
        </div>
        <div>
          <span>刷新结果</span>
          <strong data-testid="workbench-flow-edit-result">
            {{ workbenchFlow.editResult.label }}
          </strong>
        </div>
      </div>
    </div>

    <div class="flow-actions">
      <div
        class="flow-navigation"
        data-testid="workbench-flow-runtime-navigation"
      >
        <button
          type="button"
          class="flow-icon-button"
          :data-state-point-id="
            workbenchFlow.runtimeNavigation.previous?.statePointId ?? ''
          "
          data-testid="workbench-flow-runtime-previous"
          :disabled="!workbenchFlow.runtimeNavigation.previous"
          title="上一个运行结果"
          aria-label="上一个运行结果"
          @click="
            selectRuntimeNavigationPoint(workbenchFlow.runtimeNavigation.previous)
          "
        >
          <ArrowLeft class="flow-button-icon" />
        </button>
        <span data-testid="workbench-flow-runtime-navigation-index">
          {{ workbenchFlow.runtimeNavigation.label }}
        </span>
        <button
          type="button"
          class="flow-icon-button"
          :data-state-point-id="
            workbenchFlow.runtimeNavigation.next?.statePointId ?? ''
          "
          data-testid="workbench-flow-runtime-next"
          :disabled="!workbenchFlow.runtimeNavigation.next"
          title="下一个运行结果"
          aria-label="下一个运行结果"
          @click="
            selectRuntimeNavigationPoint(workbenchFlow.runtimeNavigation.next)
          "
        >
          <ArrowRight class="flow-button-icon" />
        </button>
      </div>
      <button
        type="button"
        class="flow-button"
        data-testid="workbench-flow-open-runtime"
        :disabled="!workbenchFlow.controls.canOpenRuntimeResults"
        @click="$emit('open-runtime-results')"
      >
        <TrendCharts class="flow-button-icon" />
        <span>查看运行结果</span>
      </button>
      <button
        type="button"
        class="flow-button"
        :data-action-id="workbenchFlow.runtimeDetail.actionId"
        :data-state-point-id="workbenchFlow.runtimeDetail.statePointId"
        data-testid="workbench-flow-edit-runtime-action"
        :disabled="!workbenchFlow.controls.canFocusRuntimeAction"
        @click="focusRuntimeAction"
      >
        <EditPen class="flow-button-icon" />
        <span>编辑结果动作</span>
      </button>
      <button
        type="button"
        class="flow-button secondary"
        :data-action-id="workbenchFlow.editResult.actionId"
        :data-state-point-id="workbenchFlow.editResult.statePointId"
        data-testid="workbench-flow-return-edit-result"
        :disabled="!workbenchFlow.controls.canReturnRuntimeResult"
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
import {
  ArrowLeft,
  ArrowRight,
  EditPen,
  TrendCharts,
} from '@element-plus/icons-vue';
import { createWorkbenchFlowModel } from './workbenchFlowModel';

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
  selectedStateCurvePointId: {
    type: String,
    default: '',
  },
  runtimeOverviewActive: {
    type: Boolean,
    default: false,
  },
  actionEditResultContext: {
    type: Object,
    default: null,
  },
  flowModel: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits([
  'open-runtime-results',
  'focus-runtime-action',
  'return-runtime-result',
  'select-runtime-state-point',
]);

const workbenchFlow = computed(
  () =>
    props.flowModel ??
    createWorkbenchFlowModel({
      selectedAction: props.selectedAction,
      runtimeProjection: props.runtimeProjection,
      runtimeSelectedDetail: props.runtimeSelectedDetail,
      selectedStateCurvePointId: props.selectedStateCurvePointId,
      runtimeOverviewActive: props.runtimeOverviewActive,
      actionEditResultContext: props.actionEditResultContext,
    })
);

function focusRuntimeAction() {
  const detail = workbenchFlow.value.runtimeDetail;
  if (!detail?.canFocusAction) {
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
  const context = workbenchFlow.value.editResult;
  if (!context?.canReturn) {
    return;
  }
  emit('return-runtime-result', {
    actionId: context.actionId,
    statePointId: context.statePointId,
  });
}

function selectRuntimeNavigationPoint(point) {
  if (!point?.statePointId) {
    return;
  }
  emit('select-runtime-state-point', point.statePointId);
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

.flow-navigation {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
}

.flow-navigation span {
  min-width: 34px;
  color: #d9dee3;
  font-size: 12px;
  text-align: center;
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

.flow-icon-button {
  display: inline-grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border: 1px solid rgba(121, 199, 185, 0.22);
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.08);
  color: #dff6f1;
  cursor: pointer;
}

.flow-button.secondary {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: #d9dee3;
}

.flow-icon-button:disabled,
.flow-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.flow-icon-button:not(:disabled):hover,
.flow-icon-button:not(:disabled):focus,
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
