<template>
  <section
    class="workbench-flow-panel"
    :data-action-id="workbenchFlow.selectedActionId"
    :data-edit-result-state-point-id="workbenchFlow.editResult.statePointId"
    :data-flow-phase="workbenchFlow.phase"
    :data-flow-primary-action-id="workbenchFlow.primaryAction.actionId"
    :data-flow-primary-kind="workbenchFlow.primaryAction.kind"
    :data-flow-primary-state-point-id="
      workbenchFlow.primaryAction.statePointId
    "
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
    :data-contract-name="workbenchFlow.contractContext.contractName"
    :data-generation-entry-status="
      workbenchFlow.contractContext.generationEntry.status
    "
    :data-runtime-input-source="
      workbenchFlow.contractContext.runtimeInput.appliedDeltaSource
    "
    :data-runtime-output-status="
      workbenchFlow.contractContext.runtimeOutput.status
    "
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
        :class="[
          'flow-button',
          {
            primary: isPrimaryFlowAction(
              WORKBENCH_FLOW_ACTION_KINDS.OPEN_RUNTIME_RESULTS
            ),
          },
        ]"
        :data-primary-action="
          isPrimaryFlowAction(WORKBENCH_FLOW_ACTION_KINDS.OPEN_RUNTIME_RESULTS)
            ? 'true'
            : 'false'
        "
        data-testid="workbench-flow-open-runtime"
        :disabled="!workbenchFlow.controls.canOpenRuntimeResults"
        @click="openRuntimeResults"
      >
        <TrendCharts class="flow-button-icon" />
        <span>查看运行结果</span>
      </button>
      <button
        type="button"
        :class="[
          'flow-button',
          {
            primary: isPrimaryFlowAction(
              WORKBENCH_FLOW_ACTION_KINDS.FOCUS_RUNTIME_ACTION
            ),
          },
        ]"
        :data-action-id="workbenchFlow.runtimeActionEditTarget.actionId"
        :data-primary-action="
          isPrimaryFlowAction(WORKBENCH_FLOW_ACTION_KINDS.FOCUS_RUNTIME_ACTION)
            ? 'true'
            : 'false'
        "
        :data-state-point-id="workbenchFlow.runtimeActionEditTarget.statePointId"
        data-testid="workbench-flow-edit-runtime-action"
        :disabled="!workbenchFlow.controls.canFocusRuntimeAction"
        @click="focusRuntimeAction"
      >
        <EditPen class="flow-button-icon" />
        <span>编辑结果动作</span>
      </button>
      <button
        type="button"
        :class="[
          'flow-button',
          {
            primary: isPrimaryFlowAction(
              WORKBENCH_FLOW_ACTION_KINDS.RETURN_RUNTIME_RESULT
            ),
            secondary: !isPrimaryFlowAction(
              WORKBENCH_FLOW_ACTION_KINDS.RETURN_RUNTIME_RESULT
            ),
          },
        ]"
        :data-action-id="workbenchFlow.editResult.actionId"
        :data-primary-action="
          isPrimaryFlowAction(WORKBENCH_FLOW_ACTION_KINDS.RETURN_RUNTIME_RESULT)
            ? 'true'
            : 'false'
        "
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
import {
  WORKBENCH_FLOW_ACTION_KINDS,
  createWorkbenchFlowAction,
  createWorkbenchFlowModel,
} from './workbenchFlowModel';
import { createRuntimeActionFocusFlowAction } from './runtimeActionFocusFlowAction';
import { createRuntimeStatePointFocusFlowAction } from './runtimeResultFocusFlowAction';

const props = defineProps({
  selectedAction: {
    type: Object,
    default: null,
  },
  generationBundle: {
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

const emit = defineEmits(['dispatch-flow-action']);

const workbenchFlow = computed(
  () =>
    props.flowModel ??
    createWorkbenchFlowModel({
      selectedAction: props.selectedAction,
      generationBundle: props.generationBundle,
      runtimeProjection: props.runtimeProjection,
      runtimeSelectedDetail: props.runtimeSelectedDetail,
      selectedStateCurvePointId: props.selectedStateCurvePointId,
      runtimeOverviewActive: props.runtimeOverviewActive,
      actionEditResultContext: props.actionEditResultContext,
    })
);

function focusRuntimeAction() {
  const detail = workbenchFlow.value.runtimeActionEditTarget;
  dispatchFlowAction(getRuntimeActionFocusFlowAction(detail));
}

function returnRuntimeResult() {
  const context = workbenchFlow.value.editResult;
  dispatchFlowAction(getRuntimeReturnFlowAction(context));
}

function openRuntimeResults() {
  dispatchFlowAction(getOpenRuntimeResultsFlowAction(workbenchFlow.value));
}

function selectRuntimeNavigationPoint(point) {
  dispatchFlowAction(getRuntimeNavigationFlowAction(point));
}

function dispatchFlowAction(action) {
  if (!action?.canRun) {
    return;
  }
  emit('dispatch-flow-action', action);
}

function isPrimaryFlowAction(kind) {
  return workbenchFlow.value.primaryAction.kind === kind;
}

function getOpenRuntimeResultsFlowAction(flow) {
  return createWorkbenchFlowAction({
    kind: WORKBENCH_FLOW_ACTION_KINDS.OPEN_RUNTIME_RESULTS,
    source: 'workbench-flow-panel',
    actionId: flow?.selectedActionId ?? '',
    payload: {
      runtimeSimLogCount: flow?.runtimeSimLogCount ?? 0,
      fallbackToFirstRuntimePoint: true,
    },
    enabled: Boolean(flow?.controls?.canOpenRuntimeResults),
    disabledReason: 'missing-runtime-results',
  });
}

function getRuntimeNavigationFlowAction(point) {
  return createRuntimeStatePointFocusFlowAction({
    source: 'workbench-flow-navigation',
    detail: point,
    enabled: Boolean(point?.statePointId),
  });
}

function getRuntimeActionFocusFlowAction(detail) {
  return createRuntimeActionFocusFlowAction({
    source: 'workbench-flow-panel',
    detail,
    enabled: Boolean(detail?.canFocusAction),
  });
}

function getRuntimeReturnFlowAction(context) {
  return createWorkbenchFlowAction({
    kind: WORKBENCH_FLOW_ACTION_KINDS.RETURN_RUNTIME_RESULT,
    source: 'workbench-flow-panel',
    actionId: context?.actionId ?? '',
    statePointId: context?.statePointId ?? '',
    payload: context ?? null,
    enabled: Boolean(context?.canReturn),
    disabledReason: 'missing-runtime-result',
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

.flow-button.primary {
  border-color: rgba(121, 199, 185, 0.68);
  background: rgba(121, 199, 185, 0.18);
  box-shadow: inset 0 0 0 1px rgba(121, 199, 185, 0.18);
  color: #f2fffb;
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
