<template>
  <section
    v-if="detail"
    class="panel runtime-selected-detail-panel"
    data-testid="workbench-runtime-selected-detail"
  >
    <div class="panel-title">
      <DataAnalysis class="panel-icon" />
      <h2>三值详情</h2>
      <button
        type="button"
        class="runtime-detail-action-focus"
        :data-action-id="detail.actionId || ''"
        data-focus-field="startMs"
        :data-state-point-id="detail.statePointId || ''"
        data-testid="workbench-runtime-selected-detail-action-focus"
        :disabled="!detail.actionId"
        @click="focusRuntimeAction"
      >
        <EditPen class="runtime-detail-action-focus-icon" />
        <span>定位动作</span>
      </button>
    </div>

    <div class="runtime-detail-summary">
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
        <span>轨道</span>
        <strong data-testid="workbench-runtime-selected-detail-track">
          {{ detail.trackLabel || detail.trackKey }}
        </strong>
      </div>
      <div>
        <span>状态</span>
        <strong data-testid="workbench-runtime-selected-detail-status">
          {{ detail.status }}
        </strong>
      </div>
    </div>

    <div class="runtime-detail-values">
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

    <div class="runtime-detail-contributions">
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

    <div class="runtime-detail-calculators">
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

    <div class="runtime-detail-meta">
      <div>
        <span>来源</span>
        <strong data-testid="workbench-runtime-selected-detail-source-delta">
          {{ detail.sourceDeltaId || '无' }}
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

    <div class="runtime-detail-sources">
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
import { DataAnalysis, EditPen } from '@element-plus/icons-vue';

const props = defineProps({
  detail: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['focus-runtime-action']);

function focusRuntimeAction() {
  const detail = props.detail;
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
  if (
    status === 'baseline-pending-azpr-enemy-toughness-state' ||
    status === 'baseline-pending-azpr-initial-self-energy'
  ) {
    return '待确认';
  }
  if (status === 'baseline-pending-missing-scenario-enemy-max-hp') {
    return 'HP缺失';
  }
  return status ?? '无';
}

function formatContribution(row) {
  return row.signed ? formatSigned(row.value) : formatNumber(row.value);
}

function formatSigned(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? '+' : ''}${formatNumber(number)}`;
}

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString('zh-CN');
}

function formatSourceValues(values) {
  return values?.length ? values.join(', ') : '无';
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

.runtime-detail-action-focus:disabled {
  color: #6d7780;
  cursor: not-allowed;
  opacity: 0.5;
}

.runtime-detail-action-focus-icon {
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

.runtime-detail-summary {
  padding-top: 14px;
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
}
</style>
