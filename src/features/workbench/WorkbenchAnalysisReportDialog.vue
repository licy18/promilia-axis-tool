<template>
  <Teleport to="body">
    <div
      v-if="visible && report"
      class="report-overlay"
      data-testid="workbench-analysis-report"
      :data-report-kind="report.analysisKind"
      :data-reproducibility-status="reproducibilityAudit?.status || ''"
      @click.self="emit('close')"
    >
      <section
        ref="reportSurface"
        class="report-dialog"
        :class="{ exporting: exportingPng }"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workbench-analysis-report-title"
      >
        <header class="report-header">
          <div>
            <span>{{ kindLabel }}</span>
            <h2 id="workbench-analysis-report-title">{{ report.title }}</h2>
          </div>
          <div class="report-header-actions">
            <button
              class="command-button"
              type="button"
              data-testid="workbench-analysis-report-export-json"
              :disabled="exportingPng"
              @click="emit('export-json')"
            >
              <Download />
              <span>JSON</span>
            </button>
            <button
              class="command-button"
              type="button"
              data-testid="workbench-analysis-report-export-png"
              :disabled="exportingPng"
              @click="emit('export-png')"
            >
              <Picture />
              <span>{{ exportingPng ? '生成中' : 'PNG' }}</span>
            </button>
            <button
              class="icon-button"
              type="button"
              title="关闭分析报告"
              data-testid="workbench-analysis-report-close"
              :disabled="exportingPng"
              @click="emit('close')"
            >
              <Close />
            </button>
          </div>
        </header>

        <div
          class="validation-strip"
          data-testid="workbench-analysis-report-validation"
          :data-validation-status="validation?.status || ''"
        >
          <CircleCheck />
          <strong>合同已验证</strong>
          <span>{{ report.summary.sourceCount }} 个来源</span>
          <span>{{ report.summary.actionReferenceCount }} 个动作引用</span>
          <span
            >{{ report.summary.appliedTransactionCount }} 条 applied
            transaction</span
          >
          <span
            >{{ report.summary.appliedSourceDeltaCount }} 个 source delta</span
          >
        </div>

        <div
          v-if="reproducibilityAudit"
          class="reproducibility-strip"
          :class="`status-${reproducibilityAudit.status}`"
          :data-reproducibility-status="reproducibilityAudit.status"
          data-testid="workbench-analysis-report-reproducibility"
        >
          <CircleCheck v-if="reproducibilityAudit.status === 'exact'" />
          <Warning v-else-if="reproducibilityAudit.status === 'drift'" />
          <CircleClose v-else />
          <strong>{{ reproducibilityLabel }}</strong>
          <span>{{ reproducibilityAudit.reason }}</span>
          <span v-if="reproducibilityAudit.status !== 'incompatible'">
            {{ reproducibilityAudit.summary.sourceCount }} 个来源 ·
            {{ reproducibilityAudit.summary.replayedAppliedTransactionCount }}
            条重放 transaction
          </span>
        </div>

        <div class="report-content">
          <section
            v-if="reproducibilityAudit?.differences?.length"
            class="report-section reproducibility-section"
          >
            <header>
              <h3>复现差异</h3>
              <span>
                显示
                {{ reproducibilityAudit.summary.reportedDifferenceCount }} /
                {{ reproducibilityAudit.summary.differenceCount }}
              </span>
            </header>
            <div class="difference-list">
              <div
                v-for="difference in reproducibilityAudit.differences"
                :key="`${difference.path}:${difference.kind}`"
                class="difference-row"
                :data-difference-path="difference.path"
                data-testid="workbench-analysis-report-difference"
              >
                <code>{{ difference.path }}</code>
                <span>{{ formatDiffValue(difference.expected) }}</span>
                <strong>→</strong>
                <span>{{ formatDiffValue(difference.actual) }}</span>
              </div>
            </div>
          </section>

          <section class="report-section source-section">
            <header>
              <h3>来源方案</h3>
              <span>{{ formatExportedAt(report.exportedAt) }}</span>
            </header>
            <div class="source-list">
              <div
                v-for="source in report.sources"
                :key="source.role"
                class="source-row"
                :data-source-role="source.role"
                data-testid="workbench-analysis-report-source"
              >
                <div>
                  <strong>{{ source.label }}</strong>
                  <span
                    >{{ sourceRoleLabel(source.role) }} ·
                    {{ source.windowId }}</span
                  >
                </div>
                <button
                  class="source-button"
                  type="button"
                  :data-source-role="source.role"
                  data-testid="workbench-analysis-report-open-source"
                  @click="emit('locate-source', { role: source.role })"
                >
                  <FolderOpened />
                  <span>打开来源</span>
                </button>
              </div>
            </div>
          </section>

          <section class="report-section metric-section">
            <header><h3>窗口指标</h3></header>
            <div class="metric-grid">
              <div
                v-for="metric in metrics"
                :key="metric.key"
                class="metric-cell"
                :data-metric-key="metric.key"
                data-testid="workbench-analysis-report-metric"
              >
                <span>{{ metric.label }}</span>
                <template v-if="isComparison">
                  <strong>{{
                    formatMetric(metric.current, metric.unit)
                  }}</strong>
                  <small>
                    基准 {{ formatMetric(metric.baseline, metric.unit) }} ·
                    <b :class="deltaClass(metric.delta)">{{
                      formatDelta(metric.delta, metric.unit)
                    }}</b>
                  </small>
                </template>
                <template v-else>
                  <strong>{{ formatMetric(metric.value, metric.unit) }}</strong>
                </template>
              </div>
            </div>
          </section>

          <section class="report-section action-section">
            <header>
              <h3>动作来源</h3>
              <span>{{ actions.length }} 行</span>
            </header>
            <div v-if="actions.length" class="action-table-scroll">
              <div class="action-table">
                <div class="action-head">
                  <span>动作</span><span>角色</span><span>HP</span
                  ><span>韧性</span><span>能量</span><span>来源</span>
                </div>
                <div
                  v-for="action in actions"
                  :key="action.key"
                  class="action-row"
                  :data-current-action-id="action.currentActionId || ''"
                  :data-baseline-action-id="action.baselineActionId || ''"
                  data-testid="workbench-analysis-report-action"
                >
                  <div>
                    <strong>{{ action.name }}</strong>
                    <small
                      v-if="isComparison && action.baselineName !== action.name"
                    >
                      基准：{{ action.baselineName || '无' }}
                    </small>
                  </div>
                  <span>{{ action.actorName || '-' }}</span>
                  <span>{{ formatActionMetric(action, 'enemyHpDelta') }}</span>
                  <span>{{
                    formatActionMetric(action, 'enemyToughnessDelta')
                  }}</span>
                  <span>{{
                    formatActionMetric(action, 'selfEnergyDelta', true)
                  }}</span>
                  <div class="locate-actions">
                    <button
                      class="icon-button"
                      type="button"
                      title="打开当前来源并定位动作"
                      :disabled="!action.currentActionId"
                      :data-state-point-id="action.currentStatePointId || ''"
                      :data-frame-index="action.currentFrameIndex ?? ''"
                      data-testid="workbench-analysis-report-locate-current"
                      @click="emitLocate(action, 'current')"
                    >
                      <EditPen />
                    </button>
                    <button
                      v-if="isComparison"
                      class="icon-button"
                      type="button"
                      title="打开基准来源并定位动作"
                      :disabled="!action.baselineActionId"
                      :data-state-point-id="action.baselineStatePointId || ''"
                      :data-frame-index="action.baselineFrameIndex ?? ''"
                      data-testid="workbench-analysis-report-locate-baseline"
                      @click="emitLocate(action, 'baseline')"
                    >
                      <DocumentCopy />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="empty-row">报告窗口内没有动作</div>
          </section>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref } from 'vue';
import {
  CircleCheck,
  CircleClose,
  Close,
  DocumentCopy,
  Download,
  EditPen,
  FolderOpened,
  Picture,
  Warning,
} from '@element-plus/icons-vue';
import { WORKBENCH_ANALYSIS_KINDS } from '../../domain/workbenchAnalysisReport';
import { msToFrame } from '../../domain/timebase';

const props = defineProps({
  visible: { type: Boolean, default: false },
  report: { type: Object, default: null },
  validation: { type: Object, default: null },
  reproducibilityAudit: { type: Object, default: null },
  exportingPng: { type: Boolean, default: false },
});
const emit = defineEmits([
  'close',
  'locate-source',
  'export-json',
  'export-png',
]);
const reportSurface = ref(null);
defineExpose({ getExportSurface: () => reportSurface.value });
const isComparison = computed(
  () =>
    props.report?.analysisKind === WORKBENCH_ANALYSIS_KINDS.SCENARIO_COMPARISON
);
const kindLabel = computed(() =>
  isComparison.value ? '方案对比分析报告' : '时间窗口贡献报告'
);
const reproducibilityLabel = computed(() => {
  const status = props.reproducibilityAudit?.status;
  return status === 'exact'
    ? '当前版本可精确复现'
    : status === 'drift'
      ? '当前版本存在输出漂移'
      : '当前版本无法兼容重放';
});
const comparison = computed(() => props.report?.analysis?.comparison ?? null);
const contributionWindow = computed(
  () => props.report?.analysis?.window ?? null
);
const metrics = computed(() => {
  if (isComparison.value) return comparison.value?.metrics ?? [];
  const window = contributionWindow.value;
  return [
    {
      key: 'durationMs',
      label: '窗口时长',
      unit: 'ms',
      value: window?.durationMs,
    },
    {
      key: 'enemyHpDelta',
      label: '敌人 HP 伤害',
      unit: 'hp',
      value: window?.metrics?.enemyHpDelta,
    },
    {
      key: 'enemyToughnessDelta',
      label: '敌人韧性削减',
      unit: 'toughness',
      value: window?.metrics?.enemyToughnessDelta,
    },
    {
      key: 'selfEnergyDelta',
      label: '自身能量变化',
      unit: 'sp',
      value: window?.metrics?.selfEnergyDelta,
    },
    {
      key: 'effectCoverageMs',
      label: '效果覆盖',
      unit: 'ms',
      value: window?.metrics?.effectCoverageMs,
    },
  ];
});
const actions = computed(() => {
  if (isComparison.value) {
    return (comparison.value?.actions ?? []).map(action => ({
      ...action,
      name: action.currentName || action.baselineName || action.key,
      actorName: action.actorName,
      baselineName: action.baselineName,
    }));
  }
  return (contributionWindow.value?.actions ?? []).map(action => ({
    ...action,
    key: action.actionId,
    currentActionId: action.actionId,
    currentStatePointId: action.statePointId,
    currentFrameIndex: action.frameIndex,
    actorName: action.actorName,
  }));
});

function emitLocate(action, role) {
  emit('locate-source', {
    role,
    actionId:
      role === 'baseline' ? action.baselineActionId : action.currentActionId,
    statePointId:
      role === 'baseline'
        ? action.baselineStatePointId
        : action.currentStatePointId,
    frameIndex:
      role === 'baseline'
        ? action.baselineFrameIndex
        : action.currentFrameIndex,
  });
}

function formatActionMetric(action, key, signed = false) {
  const value = isComparison.value
    ? action.metrics?.[key]?.current
    : action[key];
  const number = Number(value) || 0;
  return `${signed && number > 0 ? '+' : ''}${formatNumber(number)}`;
}

function formatMetric(value, unit) {
  return unit === 'ms'
    ? `${formatNumber(msToFrame(Number(value) || 0))}F`
    : formatNumber(value);
}

function formatDelta(value, unit) {
  const number = Number(value) || 0;
  return `${number > 0 ? '+' : ''}${formatMetric(number, unit)}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 3 }).format(
    Number(value) || 0
  );
}

function deltaClass(value) {
  const number = Number(value) || 0;
  return number > 0 ? 'delta-positive' : number < 0 ? 'delta-negative' : '';
}

function sourceRoleLabel(role) {
  return role === 'baseline' ? '基准' : '当前';
}

function formatExportedAt(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
}

function formatDiffValue(value) {
  if (value && typeof value === 'object') {
    if (value.kind === 'absent') return '不存在';
    if (value.kind === 'array') return `数组(${value.length})`;
    if (value.kind === 'object') return `对象(${value.keys.length})`;
  }
  return JSON.stringify(value);
}
</script>

<style scoped>
.report-overlay {
  position: fixed;
  z-index: 1300;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgb(5 8 10 / 78%);
}
.report-dialog {
  display: grid;
  grid-template-rows: auto auto auto minmax(0, 1fr);
  width: min(1120px, 100%);
  max-height: min(880px, calc(100vh - 48px));
  overflow: hidden;
  border: 1px solid #3c4850;
  border-radius: 6px;
  background: #151a1f;
  color: #edf2f4;
  box-shadow: 0 22px 60px rgb(0 0 0 / 48%);
}
.report-header,
.report-section > header,
.source-row,
.validation-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.report-header {
  padding: 14px 16px;
  border-bottom: 1px solid #303940;
  background: #11161a;
}
.report-header span,
.report-section > header span,
.source-row span,
.metric-cell span,
.metric-cell small {
  color: #87949c;
  font-size: 10px;
}
.report-header h2 {
  margin: 2px 0 0;
  font-size: 17px;
  letter-spacing: 0;
}
.report-header-actions,
.command-button {
  display: flex;
  align-items: center;
}
.report-header-actions {
  gap: 7px;
}
.command-button {
  justify-content: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 9px;
  border: 1px solid #3a474f;
  border-radius: 4px;
  background: #20272c;
  color: #dce5e8;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}
.command-button svg {
  width: 14px;
  height: 14px;
}
.command-button:hover:not(:disabled) {
  border-color: #79c7b9;
  color: #a9e6db;
}
.command-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.validation-strip {
  justify-content: flex-start;
  min-height: 38px;
  padding: 0 16px;
  overflow-x: auto;
  border-bottom: 1px solid #30413d;
  background: #172824;
  color: #b8d9d2;
  font-size: 10px;
  white-space: nowrap;
}
.validation-strip svg {
  width: 15px;
  color: #79c7b9;
}
.reproducibility-strip {
  display: flex;
  align-items: center;
  min-height: 38px;
  gap: 10px;
  padding: 0 16px;
  overflow-x: auto;
  border-bottom: 1px solid #30413d;
  background: #18221f;
  color: #c7d3d0;
  font-size: 10px;
  white-space: nowrap;
}
.reproducibility-strip svg {
  width: 15px;
  flex: 0 0 auto;
}
.reproducibility-strip span {
  color: #8f9d99;
}
.reproducibility-strip.status-exact svg {
  color: #79c7b9;
}
.reproducibility-strip.status-drift {
  border-bottom-color: #65542e;
  background: #292316;
}
.reproducibility-strip.status-drift svg {
  color: #e0ba61;
}
.reproducibility-strip.status-incompatible {
  border-bottom-color: #6a3936;
  background: #2a1b1b;
}
.reproducibility-strip.status-incompatible svg {
  color: #ee9a91;
}
.report-content {
  min-height: 0;
  overflow: auto;
}
.difference-list {
  display: grid;
}
.difference-row {
  display: grid;
  grid-template-columns: minmax(260px, 1.4fr) minmax(120px, 0.8fr) 18px minmax(
      120px,
      0.8fr
    );
  align-items: center;
  gap: 10px;
  min-width: 720px;
  min-height: 34px;
  padding: 0 16px;
  border-top: 1px solid #293239;
  color: #b9c3c7;
  font-size: 10px;
}
.difference-row code {
  overflow: hidden;
  color: #e0ba61;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.difference-row strong {
  color: #67747a;
  text-align: center;
}
.report-section {
  border-bottom: 1px solid #303940;
}
.report-section:last-child {
  border-bottom: 0;
}
.report-section > header {
  min-height: 40px;
  padding: 0 16px;
  background: #12171b;
}
.report-section h3 {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0;
}
.source-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}
.source-row {
  min-width: 0;
  padding: 10px 16px;
  border-right: 1px solid #303940;
}
.source-row > div {
  display: grid;
  min-width: 0;
}
.source-row strong {
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.source-button {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid #4b8178;
  border-radius: 4px;
  background: #1f3c37;
  color: #e9fffb;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}
.source-button svg,
.icon-button svg {
  width: 14px;
  height: 14px;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(120px, 1fr));
  overflow-x: auto;
}
.metric-cell {
  display: grid;
  gap: 3px;
  min-width: 120px;
  padding: 12px 14px;
  border-right: 1px solid #303940;
}
.metric-cell strong {
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}
.metric-cell small b {
  color: #aeb9be;
}
.metric-cell small b.delta-positive {
  color: #7fd6c6;
}
.metric-cell small b.delta-negative {
  color: #ee9a91;
}
.action-table-scroll {
  overflow-x: auto;
}
.action-table {
  min-width: 850px;
}
.action-head,
.action-row {
  display: grid;
  grid-template-columns:
    minmax(170px, 1.5fr) minmax(100px, 0.8fr) repeat(3, minmax(72px, 0.6fr))
    76px;
  align-items: center;
  gap: 10px;
  min-height: 38px;
  padding: 0 16px;
}
.action-head {
  background: #101519;
  color: #7e8c94;
  font-size: 9px;
  font-weight: 800;
}
.action-row {
  border-top: 1px solid #293239;
  color: #c7d0d5;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.action-row > div:first-child {
  display: grid;
  min-width: 0;
}
.action-row strong,
.action-row small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.action-row small {
  color: #7f8c94;
  font-size: 9px;
}
.locate-actions {
  display: flex;
  gap: 5px;
}
.icon-button {
  display: inline-grid;
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  place-items: center;
  padding: 0;
  border: 1px solid #3a474f;
  border-radius: 4px;
  background: #20272c;
  color: #dce5e8;
  cursor: pointer;
}
.icon-button:hover:not(:disabled) {
  border-color: #79c7b9;
  color: #a9e6db;
}
.icon-button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.empty-row {
  padding: 22px 16px;
  color: #7f8c94;
  font-size: 11px;
}
.report-dialog.exporting {
  width: 1120px;
  max-height: none;
  overflow: visible;
  box-shadow: none;
}
.report-dialog.exporting .report-content {
  overflow: visible;
}
.report-dialog.exporting .report-header-actions {
  display: none;
}
.report-dialog.exporting .source-button,
.report-dialog.exporting .locate-actions,
.report-dialog.exporting .action-head > span:last-child {
  display: none;
}
.report-dialog.exporting .action-head,
.report-dialog.exporting .action-row {
  grid-template-columns:
    minmax(170px, 1.5fr) minmax(100px, 0.8fr)
    repeat(3, minmax(72px, 0.6fr));
}
@media (max-width: 720px) {
  .report-overlay {
    align-items: stretch;
    padding: 0;
  }
  .report-dialog {
    width: 100%;
    max-height: 100vh;
    border: 0;
    border-radius: 0;
  }
  .report-header h2 {
    font-size: 14px;
  }
  .report-header-actions {
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .source-list {
    grid-template-columns: 1fr;
  }
  .source-row {
    border-right: 0;
    border-bottom: 1px solid #303940;
  }
}
</style>
