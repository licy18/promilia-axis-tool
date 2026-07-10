<template>
  <section
    v-if="panelVisible"
    class="panel runtime-selected-detail-panel"
    :data-flow-phase="flowModel?.phase ?? ''"
    :data-flow-edit-result-state-point-id="flowEditResult?.statePointId ?? ''"
    :data-flow-state-point-id="runtimeReviewSelectedStatePointId"
    :data-runtime-review-selection-status="runtimeReviewContextView.status"
    :data-runtime-review-selected-action-id="
      runtimeReviewContextView.selectedActionId
    "
    :data-runtime-review-selected-state-point-id="
      runtimeReviewContextView.selectedStatePointId
    "
    :data-runtime-review-source="runtimeReviewContextView.source"
    :data-runtime-review-source-kind="runtimeReviewContextView.sourceKind"
    :data-runtime-review-detail-synced="
      runtimeReviewContextView.detailSyncedState
    "
    :data-runtime-review-primary-operation-kind="
      runtimeReviewOperations?.primaryOperationKind ?? ''
    "
    :data-runtime-review-primary-operation-enabled="
      runtimeReviewOperations?.primaryOperationEnabled ? 'true' : 'false'
    "
    :data-runtime-review-focus-action-enabled="
      runtimeReviewOperations?.focusAction?.enabled ? 'true' : 'false'
    "
    :data-runtime-review-return-result-enabled="
      runtimeReviewOperations?.returnResult?.enabled ? 'true' : 'false'
    "
    :data-review-unit="detail?.reviewUnit ?? ''"
    :data-transaction-id="detail?.transactionId ?? ''"
    data-testid="workbench-runtime-selected-detail"
  >
    <div class="panel-title">
      <DataAnalysis class="panel-icon" />
      <h2>三值详情</h2>
      <button
        v-if="detail"
        type="button"
        class="runtime-detail-action-focus"
        :data-action-id="runtimeDetailActionEditButtonTarget.actionId"
        :data-focus-field="runtimeDetailActionEditButtonTarget.fieldKey"
        :data-state-point-id="runtimeDetailActionEditButtonTarget.statePointId"
        data-testid="workbench-runtime-selected-detail-action-focus"
        :disabled="!runtimeReviewFocusActionEnabled"
        @click="focusRuntimeAction"
      >
        <EditPen class="runtime-detail-action-focus-icon" />
        <span>{{ runtimeDetailActionEditButtonLabel }}</span>
      </button>
      <button
        v-if="runtimeDetailResultReturnButtonVisible"
        type="button"
        class="runtime-detail-result-return"
        :data-action-id="runtimeDetailResultReturnButtonTarget.actionId"
        :data-origin-state-point-id="
          runtimeDetailResultReturnButtonTarget.originStatePointId
        "
        :data-return-status="runtimeDetailResultReturnButtonTarget.status"
        :data-state-point-id="
          runtimeDetailResultReturnButtonTarget.statePointId
        "
        data-testid="workbench-runtime-selected-detail-return-result"
        :disabled="!runtimeReviewReturnResultEnabled"
        @click="returnRuntimeResult"
      >
        <Aim class="runtime-detail-result-return-icon" />
        <span>{{ runtimeDetailResultReturnButtonLabel }}</span>
      </button>
    </div>

    <div
      v-if="!detail && runtimeDetailResultReturnContext"
      class="runtime-detail-return-context"
      :data-action-id="runtimeDetailResultReturnContext.actionId"
      :data-origin-state-point-id="
        runtimeDetailResultReturnContext.originStatePointId
      "
      :data-state-point-id="runtimeDetailResultReturnContext.statePointId"
      data-testid="workbench-runtime-selected-detail-return-context"
    >
      <span>刷新结果</span>
      <strong>{{ runtimeDetailResultReturnContext.label }}</strong>
      <small>{{ runtimeDetailResultReturnContext.summary }}</small>
    </div>

    <div v-if="detail" class="runtime-detail-summary">
      <div>
        <span>动作</span>
        <strong data-testid="workbench-runtime-selected-detail-action">
          {{ detail.actionName || detail.actionId || '动作' }}
        </strong>
      </div>
      <div>
        <span>帧</span>
        <strong data-testid="workbench-runtime-selected-detail-frame">
          {{ detail.frameLabel || `${detail.timeMs ?? 0}ms` }}
        </strong>
      </div>
      <div>
        <span>{{
          detail.reviewUnit === 'hit-transaction' ? '命中' : '轨道'
        }}</span>
        <strong data-testid="workbench-runtime-selected-detail-track">
          {{
            detail.reviewUnit === 'hit-transaction'
              ? detail.hitKey || '命中'
              : detail.trackLabel || detail.trackKey
          }}
        </strong>
      </div>
      <div>
        <span>状态</span>
        <strong data-testid="workbench-runtime-selected-detail-status">
          {{ detail.reviewStatus || detail.status }}
        </strong>
      </div>
    </div>

    <div
      v-if="detail && actionReadiness"
      class="runtime-detail-readiness"
      :data-executable="actionReadiness.executable ? 'true' : 'false'"
      :data-readiness-status="actionReadiness.status"
      data-testid="workbench-runtime-selected-detail-readiness"
    >
      <div>
        <span>动作可执行性</span>
        <strong>{{ formatReadinessStatus(actionReadiness) }}</strong>
      </div>
      <div v-if="actionReadiness.cooldown">
        <span>可用次数</span>
        <strong>{{ formatCooldownAvailability(actionReadiness) }}</strong>
      </div>
      <div v-if="actionReadiness.cooldown?.nextReadyAtMs != null">
        <span>下次恢复</span>
        <strong>{{
          formatReadinessTime(actionReadiness.cooldown.nextReadyAtMs)
        }}</strong>
      </div>
    </div>

    <div
      v-if="detail && runtimeDetailNavigation.visible"
      class="runtime-detail-navigation"
      :data-navigation-count="runtimeDetailNavigation.count"
      :data-navigation-index="runtimeDetailNavigation.index"
      :data-previous-state-point-id="
        runtimeDetailNavigation.previousStatePointId
      "
      :data-next-state-point-id="runtimeDetailNavigation.nextStatePointId"
      data-testid="workbench-runtime-selected-detail-navigation"
    >
      <button
        type="button"
        class="runtime-detail-navigation-button"
        :data-state-point-id="runtimeDetailNavigation.previousStatePointId"
        data-testid="workbench-runtime-selected-detail-navigation-prev"
        :disabled="!runtimeDetailNavigation.previous"
        aria-label="上一条运行结果"
        title="上一条运行结果"
        @click="
          selectRuntimeDetailNavigationPoint(runtimeDetailNavigation.previous)
        "
      >
        <ArrowLeft class="runtime-detail-navigation-icon" />
      </button>
      <strong data-testid="workbench-runtime-selected-detail-navigation-index">
        {{ runtimeDetailNavigation.label }}
      </strong>
      <button
        type="button"
        class="runtime-detail-navigation-button"
        :data-state-point-id="runtimeDetailNavigation.nextStatePointId"
        data-testid="workbench-runtime-selected-detail-navigation-next"
        :disabled="!runtimeDetailNavigation.next"
        aria-label="下一条运行结果"
        title="下一条运行结果"
        @click="
          selectRuntimeDetailNavigationPoint(runtimeDetailNavigation.next)
        "
      >
        <ArrowRight class="runtime-detail-navigation-icon" />
      </button>
    </div>

    <div
      v-if="detail?.threeValueStateRows?.length"
      class="runtime-detail-three-value-state"
      :data-state-point-id="detail.statePointId"
      :data-transaction-id="detail.transactionId ?? ''"
      data-testid="workbench-runtime-selected-detail-three-value-state"
    >
      <div class="runtime-detail-three-value-header" aria-hidden="true">
        <span>状态</span>
        <span>变更前</span>
        <span>变化</span>
        <span>变更后</span>
      </div>
      <div
        v-for="row in detail.threeValueStateRows"
        :key="row.key"
        class="runtime-detail-three-value-row"
        :data-actor-id="row.actorId"
        :data-after-value="row.afterValue ?? ''"
        :data-before-value="row.beforeValue ?? ''"
        :data-changed="row.changed ? 'true' : 'false'"
        :data-metric-key="row.key"
        :data-primary="row.primary ? 'true' : 'false'"
        :data-raw-delta="row.rawDelta ?? ''"
        :data-state-delta="row.delta ?? ''"
        :title="row.baselineStatus || ''"
        data-testid="workbench-runtime-selected-detail-three-value-row"
      >
        <div class="runtime-detail-three-value-metric">
          <strong>{{ row.label }}</strong>
          <small v-if="row.actorName">{{ row.actorName }}</small>
        </div>
        <span
          data-testid="workbench-runtime-selected-detail-three-value-before"
        >
          {{ formatRuntimeStateValue(row.beforeValue) }}
        </span>
        <span
          class="runtime-detail-three-value-delta"
          :data-delta-sign="getRuntimeStateDeltaSign(row.delta)"
          data-testid="workbench-runtime-selected-detail-three-value-delta"
        >
          {{ formatRuntimeStateDelta(row.delta) }}
        </span>
        <span data-testid="workbench-runtime-selected-detail-three-value-after">
          {{ formatRuntimeStateValue(row.afterValue) }}
        </span>
      </div>
    </div>

    <div
      v-if="detail && runtimeDetailEditContext"
      class="runtime-detail-edit-context"
      :data-action-id="runtimeDetailEditContext.actionId"
      :data-edit-context-status="runtimeDetailEditContext.status"
      :data-edit-focus-field="runtimeDetailEditContext.fieldKey"
      :data-edit-focus-label="runtimeDetailEditContext.label"
      :data-state-point-id="runtimeDetailEditContext.statePointId"
      data-testid="workbench-runtime-selected-detail-edit-context"
    >
      <span>编辑焦点已同步</span>
      <strong>{{ runtimeDetailEditContext.label }}</strong>
      <small>{{ runtimeDetailEditContext.summary }}</small>
    </div>

    <div v-if="detail" class="runtime-detail-values">
      <div>
        <span>Delta</span>
        <strong data-testid="workbench-runtime-selected-detail-delta">
          {{ formatDetailDelta(detail) }}
        </strong>
      </div>
      <div>
        <span>累计</span>
        <strong data-testid="workbench-runtime-selected-detail-cumulative">
          {{ formatDetailCumulative(detail) }}
        </strong>
      </div>
      <div v-if="detail.stateLabel">
        <span>{{ detail.stateLabel }}</span>
        <strong
          data-testid="workbench-runtime-selected-detail-state-value"
          :title="detail.baselineStatus || detail.stateValueStatus || ''"
        >
          {{ formatDetailStateValue(detail) }}
        </strong>
      </div>
      <div v-if="hasOverrun(detail)">
        <span>溢出</span>
        <strong data-testid="workbench-runtime-selected-detail-overrun">
          {{ formatNumber(detail.overrunValue) }}
        </strong>
      </div>
    </div>

    <div
      v-if="runtimeContributionSummary.visible"
      class="runtime-detail-contribution-summary"
      :data-active-count="runtimeContributionSummary.activeCount"
      :data-total-count="runtimeContributionSummary.totalCount"
      :data-primary-contribution-key="runtimeContributionSummary.primaryKey"
      data-testid="workbench-runtime-selected-detail-contribution-summary"
    >
      <span>{{
        detail.reviewUnit === 'hit-transaction' ? '本次命中' : '本点贡献'
      }}</span>
      <strong
        data-testid="workbench-runtime-selected-detail-contribution-summary-primary"
      >
        {{ runtimeContributionSummary.label }}
      </strong>
    </div>

    <div v-if="detail" class="runtime-detail-contributions">
      <div
        v-for="row in detail.contributionRows"
        :key="row.key"
        class="runtime-detail-contribution-row"
        :data-active="row.active ? 'true' : 'false'"
        :data-contribution-key="row.key"
        data-testid="workbench-runtime-selected-detail-contribution-row"
      >
        <span>{{ row.label }}</span>
        <strong>{{ formatContribution(row) }}</strong>
      </div>
    </div>

    <div v-if="detail" class="runtime-detail-calculators">
      <div
        v-for="row in detail.calculatorRows"
        :key="row.key"
        class="runtime-detail-calculator-row"
        :data-calculator-key="row.key"
        :title="String(row.rawValue ?? row.value ?? '')"
        data-testid="workbench-runtime-selected-detail-calculator-row"
      >
        <span>{{ row.label }}</span>
        <strong>{{ row.value }}</strong>
      </div>
    </div>

    <div v-if="detail" class="runtime-detail-meta">
      <div>
        <span>{{
          detail.reviewUnit === 'hit-transaction' ? '事务' : '来源'
        }}</span>
        <strong data-testid="workbench-runtime-selected-detail-source-delta">
          {{
            detail.reviewUnit === 'hit-transaction'
              ? detail.transactionId || '无'
              : detail.sourceDeltaId || '无'
          }}
        </strong>
      </div>
      <div>
        <span>状态点</span>
        <strong data-testid="workbench-runtime-selected-detail-state-point">
          {{ detail.statePointId }}
        </strong>
      </div>
      <div v-if="detail.baselineStatus">
        <span>基线</span>
        <strong
          data-testid="workbench-runtime-selected-detail-baseline-status"
          :title="detail.baselineStatus"
        >
          {{ formatBaselineStatus(detail.baselineStatus) }}
        </strong>
      </div>
    </div>

    <div v-if="detail" class="runtime-detail-sources">
      <div
        v-for="row in detail.sourceRows"
        :key="row.key"
        class="runtime-detail-source-row"
        :data-source-key="row.key"
        data-testid="workbench-runtime-selected-detail-source-row"
      >
        <span>{{ row.label }}</span>
        <strong>{{ formatSourceValues(row.values) }}</strong>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import {
  Aim,
  ArrowLeft,
  ArrowRight,
  DataAnalysis,
  EditPen,
} from '@element-plus/icons-vue';
import { createRuntimeResultReturnContext } from './runtimeResultReturnContext';
import {
  createWorkbenchFlowRuntimeActionEditTarget,
  createWorkbenchRuntimeReviewPanelView,
  resolveWorkbenchMainFlowActionEditTarget,
} from './workbenchFlowModel';
import {
  createWorkbenchRuntimeReviewPanelCommandViewFromSurface,
  createWorkbenchRuntimeSelectionFlowActionFromSurface,
} from './workbenchMainFlowActions';

const props = defineProps({
  detail: {
    type: Object,
    default: null,
  },
  actionReadiness: {
    type: Object,
    default: null,
  },
  actionEditFocus: {
    type: Object,
    default: null,
  },
  actionEditResultContext: {
    type: Object,
    default: null,
  },
  flowModel: {
    type: Object,
    default: null,
  },
  mainFlowCommandSurface: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['dispatch-flow-action']);

const runtimeDetailEditContext = computed(() =>
  createRuntimeDetailEditContext(props.detail, props.actionEditFocus)
);
const runtimeDetailOriginStatePointId = computed(() =>
  props.detail?.statePointId &&
  props.detail.statePointId === props.actionEditFocus?.originStatePointId
    ? props.detail.statePointId
    : ''
);
const flowEditResult = computed(
  () => props.flowModel?.editResult ?? props.actionEditResultContext
);
const runtimeReviewPanelView = computed(
  () =>
    props.flowModel?.runtimeReviewPanelView ??
    createWorkbenchRuntimeReviewPanelView({
      flowModel: props.flowModel,
      runtimeDetail: props.detail,
    })
);
const runtimeReviewOperations = computed(
  () => runtimeReviewPanelView.value.operations
);
const runtimeReviewContextView = computed(
  () => runtimeReviewPanelView.value.context
);
const runtimeReviewSelectedStatePointId = computed(
  () => runtimeReviewContextView.value.selectedStatePointId
);
const runtimeContributionSummary = computed(() =>
  createRuntimeContributionSummary(props.detail)
);
const runtimeDetailNavigation = computed(() =>
  createRuntimeDetailNavigationView(props.flowModel?.runtimeNavigation)
);
const runtimeDetailActionEditButtonTarget = computed(
  () => runtimeDetailActionEditCommand.value.target
);
const runtimeDetailActionEditButtonLabel = computed(
  () => runtimeDetailActionEditCommand.value.label || '编辑结果动作'
);
const runtimeDetailActionEditCommand = computed(
  () => runtimeDetailCommandView.value.focus
);
const runtimeDetailResultReturnButtonTarget = computed(
  () => runtimeDetailResultReturnCommand.value.context
);
const runtimeDetailResultReturnButtonLabel = computed(() =>
  formatRuntimeDetailResultReturnButtonLabel(
    runtimeDetailResultReturnButtonTarget.value ??
      runtimeDetailResultReturnContext.value
  )
);
const runtimeDetailResultReturnCommand = computed(
  () => runtimeDetailCommandView.value.returnResult
);
const runtimeDetailCommandView = computed(() =>
  createWorkbenchRuntimeReviewPanelCommandViewFromSurface({
    mainFlowCommandSurface: props.mainFlowCommandSurface,
    flowModel: props.flowModel,
    source: 'runtime-detail',
    focusTarget: runtimeDetailActionEditTarget.value,
    returnContext: runtimeDetailResultReturnContext.value,
  })
);
const runtimeReviewFocusActionEnabled = computed(
  () => runtimeDetailActionEditCommand.value.enabled
);
const runtimeReviewReturnResultEnabled = computed(
  () => runtimeDetailResultReturnCommand.value.enabled
);
const runtimeDetailActionEditTarget = computed(() =>
  getRuntimeDetailActionEditTarget(
    props.flowModel,
    props.detail,
    runtimeReviewPanelView.value
  )
);
const runtimeDetailResultReturnContext = computed(
  () =>
    runtimeReviewPanelView.value.commandView?.returnResult?.context ??
    runtimeReviewPanelView.value.resultReturnContext ??
    createRuntimeResultReturnContext({
      actionId: props.detail?.actionId ?? flowEditResult.value?.actionId,
      focus: props.actionEditFocus,
      resultContext: flowEditResult.value,
      originStatePointId: runtimeDetailOriginStatePointId.value,
    })
);
const runtimeDetailResultReturnButtonVisible = computed(() =>
  Boolean(
    runtimeDetailResultReturnButtonTarget.value?.statePointId ||
    runtimeDetailResultReturnContext.value
  )
);
const panelVisible = computed(() =>
  Boolean(
    props.detail ||
    runtimeDetailResultReturnContext.value ||
    runtimeDetailResultReturnButtonTarget.value?.statePointId
  )
);

function focusRuntimeAction() {
  dispatchRuntimeDetailFlowAction(runtimeDetailActionEditCommand.value.action);
}

function returnRuntimeResult() {
  dispatchRuntimeDetailFlowAction(
    runtimeDetailResultReturnCommand.value.action
  );
}

function selectRuntimeDetailNavigationPoint(point) {
  dispatchRuntimeDetailFlowAction(createRuntimeDetailNavigationAction(point));
}

function dispatchRuntimeDetailFlowAction(action) {
  if (!action?.canRun) {
    return;
  }
  emit('dispatch-flow-action', action);
}

function formatRuntimeDetailResultReturnButtonLabel(context = null) {
  if (context?.status === 'refreshed-edit-result') {
    return '查看刷新结果';
  }
  if (context?.status === 'origin-result') {
    return '回到来源结果';
  }
  return '回到结果点';
}

function formatDetailDelta(detail) {
  if (detail.trackKey === 'selfEnergyChange') {
    return formatSigned(detail.delta);
  }
  return formatNumber(detail.delta);
}

function formatDetailCumulative(detail) {
  if (detail.trackKey === 'selfEnergyChange') {
    return formatSigned(detail.cumulative);
  }
  return formatNumber(detail.cumulative);
}

function formatDetailStateValue(detail) {
  if (detail.stateValue == null || detail.stateValue === '') {
    return '待确认';
  }
  const value = Number(detail.stateValue);
  if (!Number.isFinite(value)) {
    return '待确认';
  }
  return formatNumber(value);
}

function formatRuntimeStateValue(value) {
  const number = strictNumberOrNull(value);
  return number == null ? '待确认' : formatRuntimeStateNumber(number);
}

function formatRuntimeStateDelta(value) {
  const number = strictNumberOrNull(value);
  if (number == null) {
    return '待确认';
  }
  return `${number > 0 ? '+' : ''}${formatRuntimeStateNumber(number)}`;
}

function getRuntimeStateDeltaSign(value) {
  const number = strictNumberOrNull(value);
  if (number == null || number === 0) {
    return 'neutral';
  }
  return number > 0 ? 'positive' : 'negative';
}

function formatRuntimeStateNumber(value) {
  return Number(value).toLocaleString('zh-CN', {
    maximumFractionDigits: 3,
  });
}

function hasOverrun(detail) {
  return Number(detail.overrunValue) > 0;
}

function formatBaselineStatus(status) {
  if (status === 'baseline-derived-from-scenario-enemy-max-hp') {
    return '敌人面板';
  }
  if (status === 'baseline-derived-from-scenario-actor-self-energy') {
    return '角色状态';
  }
  if (status === 'baseline-derived-from-scenario-enemy-WEAKNESS_POINT_MAX') {
    return '敌人弱点值';
  }
  if (
    status === 'baseline-pending-azpr-enemy-toughness-state' ||
    status === 'baseline-pending-azpr-initial-self-energy'
  ) {
    return '待确认';
  }
  if (status === 'baseline-pending-missing-scenario-enemy-max-hp') {
    return 'HP缺失';
  }
  if (status === 'baseline-pending-missing-WEAKNESS_POINT_MAX') {
    return '韧性缺失';
  }
  return status ?? '无';
}

function formatContribution(row) {
  return row.signed ? formatSigned(row.value) : formatNumber(row.value);
}

function createRuntimeContributionSummary(detail) {
  const rows = detail?.contributionRows ?? [];
  const activeRows = rows.filter(row => row.active);
  const primaryRow = activeRows[0] ?? null;
  return {
    visible: rows.length > 0,
    activeCount: activeRows.length,
    totalCount: rows.length,
    primaryKey: primaryRow?.key ?? '',
    label: primaryRow
      ? `${primaryRow.label} ${formatContribution(primaryRow)}`
      : '无三值变化',
  };
}

function createRuntimeDetailNavigationView(navigation = null) {
  const count = Number(navigation?.count) || 0;
  const index = Number.isFinite(Number(navigation?.index))
    ? Number(navigation.index)
    : -1;
  return {
    visible: count > 1,
    count,
    index,
    label:
      navigation?.label ??
      (index >= 0 ? `${index + 1}/${count}` : `-/${count}`),
    previous: navigation?.previous ?? null,
    next: navigation?.next ?? null,
    previousStatePointId: navigation?.previous?.statePointId ?? '',
    nextStatePointId: navigation?.next?.statePointId ?? '',
  };
}

function createRuntimeDetailNavigationAction(point) {
  return createWorkbenchRuntimeSelectionFlowActionFromSurface({
    mainFlowCommandSurface: props.mainFlowCommandSurface,
    source: 'runtime-detail-navigation',
    detail: point,
    enabled: Boolean(point?.statePointId),
  });
}

function formatSigned(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? '+' : ''}${formatNumber(number)}`;
}

function formatReadinessStatus(readiness) {
  if (readiness?.status === 'blocked') {
    return '不可执行';
  }
  if (readiness?.status === 'ready-with-unresolved-conditions') {
    return '条件待确认';
  }
  return '可执行';
}

function formatCooldownAvailability(readiness) {
  const cooldown = readiness?.cooldown;
  return cooldown
    ? `${cooldown.availableBefore} -> ${cooldown.availableAfter} / ${cooldown.cooldownCount}`
    : '-';
}

function formatReadinessTime(timeMs) {
  return `${Math.round((Number(timeMs) * 60) / 1000)}F · ${timeMs}ms`;
}

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString('zh-CN');
}

function formatSourceValues(values) {
  return values?.length ? values.join(', ') : '无';
}

function strictNumberOrNull(value) {
  if (value == null || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function createRuntimeDetailEditContext(detail, focus) {
  if (
    !detail?.actionId ||
    !detail?.statePointId ||
    !focus?.actionId ||
    focus.editOrigin !== 'runtime-focus' ||
    focus.actionId !== detail.actionId ||
    focus.originStatePointId !== detail.statePointId
  ) {
    return null;
  }
  return {
    status: 'edit-focus-synced',
    actionId: focus.actionId,
    fieldKey: focus.fieldKey ?? '',
    label: focus.label ?? '结果定位',
    statePointId: detail.statePointId,
    summary: focus.changeSummary ?? '',
  };
}

function getRuntimeDetailActionEditTarget(flowModel, detail, panelView = null) {
  const panelTarget = getRuntimeReviewPanelFocusTargetForStatePoint(
    panelView,
    detail?.statePointId ?? ''
  );
  if (panelTarget) {
    return panelTarget;
  }
  return resolveWorkbenchMainFlowActionEditTarget({
    flowModel,
    fallbackTarget: createWorkbenchFlowRuntimeActionEditTarget(detail),
    statePointId: detail?.statePointId ?? '',
  });
}

function getRuntimeReviewPanelFocusTargetForStatePoint(
  panelView,
  statePointId = ''
) {
  const target = panelView?.commandView?.focus?.target ?? null;
  if (!target?.statePointId) {
    return null;
  }
  if (statePointId && target.statePointId !== statePointId) {
    return null;
  }
  return target;
}
</script>

<style scoped>
.panel {
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 6px;
  background: #1c2228;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.panel-icon {
  width: 17px;
  height: 17px;
  color: #79c7b9;
}

h2 {
  margin: 0;
  font-size: 15px;
}

.runtime-detail-action-focus {
  display: inline-grid;
  grid-template-columns: 13px auto;
  align-items: center;
  gap: 4px;
  min-width: 0;
  min-height: 28px;
  margin-left: auto;
  padding: 0 9px;
  border: 1px solid rgba(121, 199, 185, 0.28);
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.12);
  color: #dff9f3;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.runtime-detail-result-return {
  display: inline-grid;
  grid-template-columns: 13px auto;
  align-items: center;
  gap: 4px;
  min-width: 0;
  min-height: 28px;
  padding: 0 9px;
  border: 1px solid rgba(166, 183, 255, 0.28);
  border-radius: 4px;
  background: rgba(166, 183, 255, 0.12);
  color: #e4e9ff;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.runtime-detail-action-focus:disabled {
  color: #6d7780;
  cursor: not-allowed;
  opacity: 0.5;
}

.runtime-detail-result-return:hover,
.runtime-detail-result-return:focus,
.runtime-detail-action-focus:not(:disabled):hover,
.runtime-detail-action-focus:not(:disabled):focus {
  filter: brightness(1.14);
}

.runtime-detail-action-focus-icon {
  width: 13px;
  height: 13px;
}

.runtime-detail-result-return-icon {
  width: 13px;
  height: 13px;
}

.runtime-selected-detail-panel {
  display: grid;
  gap: 10px;
  padding-bottom: 14px;
}

.runtime-detail-summary,
.runtime-detail-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 0 14px;
}

.runtime-detail-values {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(82px, 1fr));
  gap: 8px;
  padding: 0 14px;
}

.runtime-detail-readiness {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
  gap: 8px;
  margin: 0 14px;
  padding: 9px;
  border: 1px solid rgba(121, 199, 185, 0.22);
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.06);
}

.runtime-detail-readiness[data-readiness-status='blocked'] {
  border-color: rgba(245, 108, 108, 0.34);
  background: rgba(245, 108, 108, 0.06);
}

.runtime-detail-readiness[data-readiness-status='ready-with-unresolved-conditions'] {
  border-color: rgba(242, 179, 102, 0.3);
  background: rgba(242, 179, 102, 0.06);
}

.runtime-detail-readiness div {
  min-width: 0;
}

.runtime-detail-readiness span,
.runtime-detail-readiness strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.runtime-detail-readiness span {
  margin-bottom: 4px;
  color: #8f9aa3;
  font-size: 11px;
}

.runtime-detail-readiness strong {
  color: #ffffff;
  font-size: 12px;
}

.runtime-detail-summary {
  padding-top: 14px;
}

.runtime-detail-navigation {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 6px;
  margin: 0 14px;
  padding: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
}

.runtime-detail-three-value-state {
  display: grid;
  gap: 2px;
  min-width: 0;
  margin: 0 14px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.03);
}

.runtime-detail-three-value-header,
.runtime-detail-three-value-row {
  display: grid;
  grid-template-columns: minmax(84px, 1.2fr) repeat(3, minmax(52px, 0.8fr));
  align-items: center;
  min-width: 0;
}

.runtime-detail-three-value-header {
  color: #8f9aa3;
  background: rgba(255, 255, 255, 0.04);
  font-size: 10px;
  font-weight: 700;
}

.runtime-detail-three-value-header span,
.runtime-detail-three-value-row > span,
.runtime-detail-three-value-metric {
  min-width: 0;
  padding: 7px 8px;
}

.runtime-detail-three-value-header span:not(:first-child),
.runtime-detail-three-value-row > span {
  text-align: right;
}

.runtime-detail-three-value-row {
  background: rgba(255, 255, 255, 0.025);
  color: #e9edf0;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.runtime-detail-three-value-row[data-primary='true'] {
  background: rgba(121, 199, 185, 0.1);
}

.runtime-detail-three-value-row + .runtime-detail-three-value-row {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.runtime-detail-three-value-metric {
  display: grid;
  gap: 2px;
}

.runtime-detail-three-value-metric strong {
  overflow-wrap: anywhere;
  color: #ffffff;
  font-size: 11px;
}

.runtime-detail-three-value-metric small {
  overflow: hidden;
  color: #8f9aa3;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.runtime-detail-three-value-delta[data-delta-sign='negative'] {
  color: #ff9f9f;
}

.runtime-detail-three-value-delta[data-delta-sign='positive'] {
  color: #8de0c6;
}

.runtime-detail-navigation strong {
  min-width: 0;
  overflow: hidden;
  color: #dfe5ea;
  font-size: 12px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.runtime-detail-navigation-button {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 26px;
  border: 1px solid rgba(121, 199, 185, 0.28);
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.1);
  color: #dff9f3;
  cursor: pointer;
}

.runtime-detail-navigation-button:disabled {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: #68737c;
  cursor: not-allowed;
}

.runtime-detail-navigation-icon {
  width: 13px;
  height: 13px;
}

.runtime-detail-edit-context {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin: 0 14px;
  padding: 7px 9px;
  border: 1px solid rgba(121, 199, 185, 0.28);
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.1);
  color: #dff9f3;
  font-size: 11px;
}

.runtime-detail-return-context {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin: 14px 14px 0;
  padding: 7px 9px;
  border: 1px solid rgba(166, 183, 255, 0.28);
  border-radius: 4px;
  background: rgba(166, 183, 255, 0.1);
  color: #e4e9ff;
  font-size: 11px;
}

.runtime-detail-edit-context span {
  color: #9ce0d2;
  font-weight: 700;
  white-space: nowrap;
}

.runtime-detail-edit-context strong {
  color: #ffffff;
  white-space: nowrap;
}

.runtime-detail-edit-context small {
  min-width: 0;
  overflow: hidden;
  color: #aeb8c1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.runtime-detail-return-context span {
  color: #c7d2ff;
  font-weight: 700;
  white-space: nowrap;
}

.runtime-detail-return-context strong {
  color: #ffffff;
  white-space: nowrap;
}

.runtime-detail-return-context small {
  min-width: 0;
  overflow: hidden;
  color: #aeb8c1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.runtime-detail-summary div,
.runtime-detail-values div,
.runtime-detail-meta div,
.runtime-detail-contribution-row,
.runtime-detail-calculator-row,
.runtime-detail-source-row {
  min-width: 0;
  padding: 8px 9px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
}

.runtime-detail-summary span,
.runtime-detail-values span,
.runtime-detail-meta span,
.runtime-detail-contribution-row span,
.runtime-detail-calculator-row span,
.runtime-detail-source-row span {
  display: block;
  margin-bottom: 4px;
  color: #8f9aa3;
  font-size: 11px;
}

.runtime-detail-summary strong,
.runtime-detail-values strong,
.runtime-detail-meta strong,
.runtime-detail-contribution-row strong,
.runtime-detail-calculator-row strong,
.runtime-detail-source-row strong {
  display: block;
  overflow: hidden;
  color: #ffffff;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.runtime-detail-values strong {
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}

.runtime-detail-contributions,
.runtime-detail-calculators,
.runtime-detail-sources {
  display: grid;
  gap: 6px;
  padding: 0 14px;
}

.runtime-detail-contribution-summary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin: 0 14px;
  padding: 8px 9px;
  border: 1px solid rgba(121, 199, 185, 0.3);
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.1);
}

.runtime-detail-contribution-summary span {
  color: #9ce0d2;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.runtime-detail-contribution-summary strong {
  min-width: 0;
  overflow: hidden;
  color: #ffffff;
  font-size: 12px;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.runtime-detail-contribution-row,
.runtime-detail-calculator-row,
.runtime-detail-source-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.runtime-detail-contribution-row[data-active='true'] {
  border: 1px solid rgba(121, 199, 185, 0.36);
  background: rgba(121, 199, 185, 0.12);
}

.runtime-detail-contribution-row span,
.runtime-detail-calculator-row span,
.runtime-detail-source-row span {
  margin-bottom: 0;
  white-space: nowrap;
}

.runtime-detail-contribution-row strong,
.runtime-detail-calculator-row strong,
.runtime-detail-source-row strong {
  text-align: right;
}

@media (max-width: 760px) {
  .runtime-detail-summary,
  .runtime-detail-values,
  .runtime-detail-meta {
    grid-template-columns: 1fr;
  }

  .runtime-detail-summary strong,
  .runtime-detail-values strong,
  .runtime-detail-meta strong {
    overflow-wrap: anywhere;
    text-align: left;
    text-overflow: clip;
    white-space: normal;
  }

  .runtime-detail-edit-context,
  .runtime-detail-return-context,
  .runtime-detail-contribution-summary {
    grid-template-columns: 1fr;
  }

  .runtime-detail-edit-context strong,
  .runtime-detail-edit-context small,
  .runtime-detail-return-context strong,
  .runtime-detail-return-context small,
  .runtime-detail-contribution-summary strong {
    text-align: left;
    white-space: normal;
  }

  .runtime-detail-contribution-row,
  .runtime-detail-calculator-row,
  .runtime-detail-source-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 3px;
  }

  .runtime-detail-contribution-row strong,
  .runtime-detail-calculator-row strong,
  .runtime-detail-source-row strong {
    overflow-wrap: anywhere;
    text-align: left;
    white-space: normal;
  }
}
</style>
