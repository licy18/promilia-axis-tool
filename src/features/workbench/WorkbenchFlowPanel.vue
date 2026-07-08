<template>
  <section
    class="workbench-flow-panel"
    :data-action-id="workbenchFlow.selectedActionId"
    :data-edit-result-state-point-id="workbenchFlow.editResult.statePointId"
    :data-flow-phase="workbenchFlow.phase"
    :data-flow-primary-action-id="
      workbenchFlow.mainFlowState.primaryAction.actionId
    "
    :data-flow-primary-kind="workbenchFlow.mainFlowState.primaryAction.kind"
    :data-flow-primary-state-point-id="
      workbenchFlow.mainFlowState.primaryAction.statePointId
    "
    :data-main-flow-action-edit-state-point-id="
      workbenchFlow.mainFlowState.actionEditStatePointId
    "
    :data-main-flow-next-target-kind="
      workbenchFlow.mainFlowState.nextTargetKind
    "
    :data-main-flow-return-state-point-id="
      workbenchFlow.mainFlowState.returnStatePointId
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
    :data-main-flow-dispatch-sequence="
      mainFlowStatusView.dispatch.sequence
    "
    :data-main-flow-dispatch-status="
      mainFlowStatusView.dispatch.status
    "
    :data-main-flow-dispatch-handled="
      mainFlowStatusView.dispatch.handledState
    "
    :data-main-flow-dispatch-kind="mainFlowStatusView.dispatch.kind"
    :data-main-flow-dispatch-source="mainFlowStatusView.dispatch.source"
    :data-main-flow-dispatch-handler-key="
      mainFlowStatusView.dispatch.handlerKey
    "
    :data-main-flow-dispatch-reason="
      mainFlowStatusView.dispatch.reason
    "
    :data-main-flow-loop-step="mainFlowStatusView.loop.step"
    :data-main-flow-loop-status="mainFlowStatusView.loop.status"
    :data-main-flow-loop-recovery-needed="
      mainFlowStatusView.loop.recoveryNeededState
    "
    :data-main-flow-loop-next-action-kind="
      mainFlowStatusView.loop.nextActionKind
    "
    :data-main-flow-loop-next-target-kind="
      mainFlowStatusView.loop.nextTargetKind
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
            primary: openRuntimeButtonView.isPrimary,
          },
        ]"
        :data-primary-action="
          openRuntimeButtonView.isPrimary ? 'true' : 'false'
        "
        data-testid="workbench-flow-open-runtime"
        :disabled="!openRuntimeButtonView.enabled"
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
            primary: runtimeActionEditButtonView.isPrimary,
          },
        ]"
        :data-action-id="runtimeActionEditButtonView.actionId"
        :data-primary-action="
          runtimeActionEditButtonView.isPrimary ? 'true' : 'false'
        "
        :data-state-point-id="runtimeActionEditButtonView.statePointId"
        data-testid="workbench-flow-edit-runtime-action"
        :disabled="!runtimeActionEditButtonView.enabled"
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
            primary: runtimeResultReturnButtonView.isPrimary,
            secondary: !runtimeResultReturnButtonView.isPrimary,
          },
        ]"
        :data-action-id="runtimeResultReturnButtonView.actionId"
        :data-primary-action="
          runtimeResultReturnButtonView.isPrimary ? 'true' : 'false'
        "
        :data-state-point-id="runtimeResultReturnButtonView.statePointId"
        data-testid="workbench-flow-return-edit-result"
        :disabled="!runtimeResultReturnButtonView.enabled"
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
  createWorkbenchMainFlowStatusView,
  createWorkbenchFlowModel,
} from './workbenchFlowModel';
import {
  createWorkbenchMainFlowButtonView,
  createWorkbenchMainFlowLoopAction,
  createWorkbenchOpenRuntimeResultsFlowAction,
  createWorkbenchRuntimeActionEditFlowAction,
  createWorkbenchRuntimeResultReturnFlowAction,
  createWorkbenchRuntimeStatePointFlowAction,
} from './workbenchMainFlowActions';

const MAIN_FLOW_PANEL_SOURCE = 'workbench-flow-panel';
const MAIN_FLOW_RECOVERY_SOURCE = 'workbench-flow-recovery';

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
const mainFlowStatusView = computed(() =>
  createWorkbenchMainFlowStatusView({
    flowModel: workbenchFlow.value,
  })
);
const openRuntimeButtonView = computed(() =>
  createWorkbenchMainFlowButtonView({
    kind: WORKBENCH_FLOW_ACTION_KINDS.OPEN_RUNTIME_RESULTS,
    flowModel: workbenchFlow.value,
    fallbackTarget: workbenchFlow.value.mainFlowState.primaryAction,
    fallbackEnabled: workbenchFlow.value.controls.canOpenRuntimeResults,
    source: MAIN_FLOW_PANEL_SOURCE,
  })
);
const runtimeActionEditButtonView = computed(() =>
  createWorkbenchMainFlowButtonView({
    kind: WORKBENCH_FLOW_ACTION_KINDS.FOCUS_RUNTIME_ACTION,
    flowModel: workbenchFlow.value,
    fallbackTarget: workbenchFlow.value.mainFlowState.runtimeActionEditTarget,
    fallbackEnabled: workbenchFlow.value.mainFlowState.canFocusRuntimeAction,
    source: MAIN_FLOW_PANEL_SOURCE,
  })
);
const runtimeResultReturnButtonView = computed(() =>
  createWorkbenchMainFlowButtonView({
    kind: WORKBENCH_FLOW_ACTION_KINDS.RETURN_RUNTIME_RESULT,
    flowModel: workbenchFlow.value,
    fallbackTarget: workbenchFlow.value.mainFlowState.resultReturnTarget,
    fallbackEnabled: workbenchFlow.value.mainFlowState.canReturnRuntimeResult,
    source: MAIN_FLOW_PANEL_SOURCE,
  })
);

function focusRuntimeAction() {
  dispatchMainFlowAction(WORKBENCH_FLOW_ACTION_KINDS.FOCUS_RUNTIME_ACTION, () =>
    getRuntimeActionFocusFlowAction(runtimeActionEditButtonView.value.target)
  );
}

function returnRuntimeResult() {
  dispatchMainFlowAction(WORKBENCH_FLOW_ACTION_KINDS.RETURN_RUNTIME_RESULT, () =>
    getRuntimeReturnFlowAction(runtimeResultReturnButtonView.value.target)
  );
}

function openRuntimeResults() {
  dispatchMainFlowAction(WORKBENCH_FLOW_ACTION_KINDS.OPEN_RUNTIME_RESULTS, () =>
    getOpenRuntimeResultsFlowAction(workbenchFlow.value)
  );
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

function dispatchMainFlowAction(kind, createFallbackAction) {
  const isPrimaryAction = isPrimaryFlowAction(kind);
  if (!isPrimaryAction) {
    dispatchFlowAction(createFallbackAction());
    return;
  }
  const action = createWorkbenchMainFlowLoopAction({
    flowModel: workbenchFlow.value,
    source: MAIN_FLOW_PANEL_SOURCE,
    recoverySource: MAIN_FLOW_RECOVERY_SOURCE,
  });
  dispatchFlowAction(action);
}

function isPrimaryFlowAction(kind) {
  return workbenchFlow.value.mainFlowState.primaryAction.kind === kind;
}

function getOpenRuntimeResultsFlowAction(flow) {
  return createWorkbenchOpenRuntimeResultsFlowAction({
    flowModel: flow,
    source: MAIN_FLOW_PANEL_SOURCE,
  });
}

function getRuntimeNavigationFlowAction(point) {
  return createWorkbenchRuntimeStatePointFlowAction({
    source: 'workbench-flow-navigation',
    detail: point,
    enabled: Boolean(point?.statePointId),
  });
}

function getRuntimeActionFocusFlowAction(detail) {
  return createWorkbenchRuntimeActionEditFlowAction({
    source: MAIN_FLOW_PANEL_SOURCE,
    target: detail,
    enabled: Boolean(detail?.canFocusAction),
  });
}

function getRuntimeReturnFlowAction(context) {
  return createWorkbenchRuntimeResultReturnFlowAction({
    source: MAIN_FLOW_PANEL_SOURCE,
    target: context,
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
