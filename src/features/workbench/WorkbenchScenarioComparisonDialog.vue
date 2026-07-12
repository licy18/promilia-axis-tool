<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="comparison-overlay"
      data-testid="workbench-scenario-comparison"
      @click.self="emit('close')"
    >
      <section
        class="comparison-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workbench-scenario-comparison-title"
      >
        <header class="comparison-header">
          <div>
            <span class="comparison-eyebrow">排轴分析</span>
            <h2 id="workbench-scenario-comparison-title">方案对比</h2>
          </div>
          <button
            class="icon-button"
            type="button"
            title="关闭方案对比"
            data-testid="workbench-comparison-close"
            @click="emit('close')"
          >
            <Close />
          </button>
        </header>

        <div class="baseline-toolbar">
          <label class="baseline-select">
            <span>工作区方案</span>
            <select
              v-model="selectedWorkspaceScenarioId"
              data-testid="workbench-comparison-workspace-scenario"
              :disabled="availableWorkspaceScenarios.length === 0"
              @change="selectWorkspaceScenario"
            >
              <option value="">选择其他工作区方案</option>
              <option
                v-for="scenario in availableWorkspaceScenarios"
                :key="scenario.id"
                :value="scenario.id"
              >
                {{ scenario.name }} ·
                {{ scenario.draft?.actionDrafts?.length ?? 0 }} 动作
              </option>
            </select>
          </label>
          <label class="baseline-select">
            <span>基准预设</span>
            <select
              v-model="selectedPresetId"
              data-testid="workbench-comparison-baseline-preset"
              @change="selectPreset"
            >
              <option value="">选择已保存预设</option>
              <option
                v-for="preset in compatiblePresets"
                :key="preset.id"
                :value="preset.id"
              >
                {{ preset.name }} · {{ preset.summary.actionCount }} 动作
              </option>
            </select>
          </label>
          <button
            class="command-button"
            type="button"
            data-testid="workbench-comparison-capture-current"
            @click="emit('capture-current')"
          >
            <DocumentCopy />
            <span>当前方案作基准</span>
          </button>
          <button
            class="command-button"
            type="button"
            data-testid="workbench-comparison-import-baseline"
            @click="importInput?.click()"
          >
            <UploadFilled />
            <span>导入基准</span>
          </button>
          <input
            ref="importInput"
            class="file-input"
            type="file"
            accept=".json,.promilia-workbench.json,.png,application/json,image/png"
            data-testid="workbench-comparison-import-baseline-file"
            @change="importBaseline"
          />
          <div
            class="baseline-source"
            data-testid="workbench-comparison-baseline-source"
          >
            <span>当前</span>
            <strong>{{ comparison.current.label }}</strong>
            <span>基准</span>
            <strong>{{ baselineSource?.label || '尚未选择' }}</strong>
          </div>
        </div>

        <div
          v-if="comparison.status !== 'scenario-comparison-ready'"
          class="comparison-empty"
          data-testid="workbench-comparison-empty"
        >
          <DataAnalysis />
          <strong>请选择工作区方案、预设、项目文件或当前快照作为基准</strong>
        </div>

        <div v-else class="comparison-content">
          <nav
            class="comparison-windows"
            aria-label="方案对比时间窗口"
            data-testid="workbench-comparison-windows"
          >
            <button
              v-for="window in comparison.windows"
              :key="window.windowId"
              class="window-button"
              :class="{ active: comparison.windowId === window.windowId }"
              type="button"
              :disabled="!window.comparable"
              :data-window-id="window.windowId"
              :data-comparable="window.comparable ? 'true' : 'false'"
              data-testid="workbench-comparison-window"
              @click="emit('select-window', window.windowId)"
            >
              <strong>{{ window.label }}</strong>
              <span>{{ formatWindowRange(window) }}</span>
            </button>
          </nav>

          <section class="comparison-section metric-section">
            <header>
              <h3>核心结果</h3>
            </header>
            <div class="metric-grid">
              <article
                v-for="metric in comparison.metrics"
                :key="metric.key"
                class="metric-row"
                :data-metric-key="metric.key"
                data-testid="workbench-comparison-metric"
              >
                <span>{{ metric.label }}</span>
                <div class="metric-values">
                  <div>
                    <small>当前</small>
                    <strong>{{
                      formatMetric(metric.current, metric.unit)
                    }}</strong>
                  </div>
                  <div>
                    <small>基准</small>
                    <strong>{{
                      formatMetric(metric.baseline, metric.unit)
                    }}</strong>
                  </div>
                  <div>
                    <small>差值</small>
                    <strong :class="deltaClass(metric.delta)">
                      {{ formatDelta(metric.delta, metric.unit) }}
                    </strong>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section class="comparison-section actor-section">
            <header>
              <h3>角色三值贡献</h3>
            </header>
            <div class="compact-table">
              <div class="table-head actor-columns">
                <span>角色</span><span>HP 当前 / 基准</span
                ><span>韧性 当前 / 基准</span><span>能量 当前 / 基准</span>
              </div>
              <div
                v-for="actor in comparison.actors"
                :key="actor.key"
                class="table-row actor-columns"
                :data-current-actor-id="actor.currentActorId || ''"
                :data-baseline-actor-id="actor.baselineActorId || ''"
                :data-hp-delta="actor.metrics.enemyHpDelta.delta"
                :data-toughness-delta="actor.metrics.enemyToughnessDelta.delta"
                :data-energy-delta="actor.metrics.selfEnergyDelta.delta"
                data-testid="workbench-comparison-actor-row"
              >
                <strong>{{ actor.name }}</strong>
                <span class="actor-metric">
                  {{ formatPair(actor.metrics.enemyHpDelta) }}
                  <small :class="deltaClass(actor.metrics.enemyHpDelta.delta)">
                    {{ formatDelta(actor.metrics.enemyHpDelta.delta) }}
                  </small>
                </span>
                <span class="actor-metric">
                  {{ formatPair(actor.metrics.enemyToughnessDelta) }}
                  <small
                    :class="deltaClass(actor.metrics.enemyToughnessDelta.delta)"
                  >
                    {{ formatDelta(actor.metrics.enemyToughnessDelta.delta) }}
                  </small>
                </span>
                <span class="actor-metric">
                  {{ formatPair(actor.metrics.selfEnergyDelta) }}
                  <small
                    :class="deltaClass(actor.metrics.selfEnergyDelta.delta)"
                  >
                    {{ formatDelta(actor.metrics.selfEnergyDelta.delta) }}
                  </small>
                </span>
              </div>
            </div>
          </section>

          <section class="comparison-section action-section">
            <header>
              <h3>动作贡献</h3>
              <span
                >{{ comparison.summary.changedActionCount }} 个动作有差异</span
              >
            </header>
            <div class="table-scroll">
              <div class="action-table">
                <div class="table-head action-columns">
                  <span>动作</span>
                  <span>HP 当前 / 基准</span>
                  <span>韧性 当前 / 基准</span>
                  <span>能量 当前 / 基准</span>
                  <span>起始差</span>
                  <span>效果事件</span>
                  <span></span>
                </div>
                <div
                  v-for="action in comparison.actions"
                  :key="action.key"
                  class="table-row action-columns"
                  :data-current-action-id="action.currentActionId || ''"
                  :data-baseline-action-id="action.baselineActionId || ''"
                  :data-changed="action.changed ? 'true' : 'false'"
                  data-testid="workbench-comparison-action-row"
                >
                  <div class="action-name">
                    <strong>{{
                      action.currentName || '当前方案无此动作'
                    }}</strong>
                    <span
                      v-if="
                        action.baselineName &&
                        action.baselineName !== action.currentName
                      "
                    >
                      基准：{{ action.baselineName }}
                    </span>
                    <span v-else>{{ action.actorName }}</span>
                  </div>
                  <span>{{ formatPair(action.metrics.enemyHpDelta) }}</span>
                  <span>{{
                    formatPair(action.metrics.enemyToughnessDelta)
                  }}</span>
                  <span>{{ formatPair(action.metrics.selfEnergyDelta) }}</span>
                  <span :class="deltaClass(action.metrics.startMs.delta)">
                    {{ formatDelta(action.metrics.startMs.delta, 'ms') }}
                  </span>
                  <span>{{ formatPair(action.metrics.effectEventCount) }}</span>
                  <div class="action-locate-buttons">
                    <button
                      class="locate-button"
                      type="button"
                      title="定位当前方案动作"
                      data-testid="workbench-comparison-locate-action"
                      :data-state-point-id="action.currentStatePointId"
                      :data-frame-index="action.currentFrameIndex"
                      :disabled="!action.currentActionId"
                      @click="
                        emit('locate-action', {
                          role: 'current',
                          actionId: action.currentActionId,
                          statePointId: action.currentStatePointId,
                          frameIndex: action.currentFrameIndex,
                        })
                      "
                    >
                      <EditPen />
                    </button>
                    <button
                      class="locate-button"
                      type="button"
                      title="打开并定位基准方案动作"
                      data-testid="workbench-comparison-locate-baseline-action"
                      :data-state-point-id="action.baselineStatePointId"
                      :data-frame-index="action.baselineFrameIndex"
                      :disabled="!action.baselineActionId"
                      @click="
                        emit('locate-action', {
                          role: 'baseline',
                          actionId: action.baselineActionId,
                          statePointId: action.baselineStatePointId,
                          frameIndex: action.baselineFrameIndex,
                        })
                      "
                    >
                      <DocumentCopy />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="comparison-section effect-section">
            <header>
              <h3>效果覆盖</h3>
            </header>
            <div v-if="comparison.effects.length" class="compact-table">
              <div class="table-head effect-columns">
                <span>效果</span><span>目标</span><span>当前</span
                ><span>基准</span><span>差值</span>
              </div>
              <div
                v-for="effect in comparison.effects"
                :key="effect.key"
                class="table-row effect-columns"
                data-testid="workbench-comparison-effect-row"
              >
                <strong>{{ effect.name }}</strong>
                <span>{{ effect.targetName }}</span>
                <span>{{ formatMetric(effect.duration.current, 'ms') }}</span>
                <span>{{ formatMetric(effect.duration.baseline, 'ms') }}</span>
                <span :class="deltaClass(effect.duration.delta)">
                  {{ formatDelta(effect.duration.delta, 'ms') }}
                </span>
              </div>
            </div>
            <div v-else class="section-empty">两套方案均无效果区间</div>
          </section>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import {
  Close,
  DataAnalysis,
  DocumentCopy,
  EditPen,
  UploadFilled,
} from '@element-plus/icons-vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  presets: { type: Array, default: () => [] },
  workspaceScenarios: { type: Array, default: () => [] },
  activeWorkspaceScenarioId: { type: String, default: '' },
  baselineSource: { type: Object, default: null },
  comparison: {
    type: Object,
    default: () => ({
      status: 'scenario-comparison-awaiting-baseline',
      current: { label: '当前方案' },
      metrics: [],
      actors: [],
      actions: [],
      effects: [],
      windows: [],
      windowId: 'full-axis',
      summary: { changedActionCount: 0 },
    }),
  },
});

const emit = defineEmits([
  'close',
  'select-workspace-scenario',
  'select-preset',
  'capture-current',
  'import-baseline',
  'select-window',
  'locate-action',
]);

const selectedPresetId = ref('');
const selectedWorkspaceScenarioId = ref('');
const importInput = ref(null);
const compatiblePresets = computed(() =>
  props.presets.filter(
    preset => preset.compatibilityStatus !== 'incompatible-project-schema'
  )
);
const availableWorkspaceScenarios = computed(() =>
  props.workspaceScenarios.filter(
    scenario => scenario.id !== props.activeWorkspaceScenarioId
  )
);

watch(
  () => [props.visible, props.baselineSource?.kind, props.baselineSource?.id],
  ([visible]) => {
    if (!visible) {
      return;
    }
    selectedPresetId.value =
      props.baselineSource?.kind === 'preset'
        ? (props.baselineSource.id ?? '')
        : '';
    selectedWorkspaceScenarioId.value =
      props.baselineSource?.kind === 'workspace-scenario'
        ? (props.baselineSource.id ?? '')
        : '';
  },
  { immediate: true }
);

function selectPreset() {
  if (selectedPresetId.value) {
    emit('select-preset', selectedPresetId.value);
  }
}

function selectWorkspaceScenario() {
  if (selectedWorkspaceScenarioId.value) {
    emit('select-workspace-scenario', selectedWorkspaceScenarioId.value);
  }
}

function importBaseline(event) {
  const input = event?.target;
  const file = input?.files?.[0] ?? null;
  if (file) {
    emit('import-baseline', file);
  }
  if (input) {
    input.value = '';
  }
}

function formatPair(metric) {
  return `${formatNumber(metric.current)} / ${formatNumber(metric.baseline)}`;
}

function formatWindowRange(window) {
  const current = formatRange(window.currentRange);
  const baseline = formatRange(window.baselineRange);
  return current === baseline ? current : `${current} / ${baseline}`;
}

function formatRange(range) {
  if (!range) {
    return '不可用';
  }
  return `${formatNumber(range.startMs)}-${formatNumber(range.endMs)} ms`;
}

function formatMetric(value, unit) {
  if (unit === 'ms') {
    return `${formatNumber(value)} ms`;
  }
  return formatNumber(value);
}

function formatDelta(value, unit) {
  const number = Number(value) || 0;
  const prefix = number > 0 ? '+' : '';
  return `${prefix}${formatMetric(number, unit)}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 3,
  }).format(Number(value) || 0);
}

function deltaClass(value) {
  const number = Number(value) || 0;
  return number > 0 ? 'delta-positive' : number < 0 ? 'delta-negative' : '';
}
</script>

<style scoped>
.comparison-overlay {
  position: fixed;
  inset: 0;
  z-index: 3100;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(5, 8, 11, 0.82);
}

.comparison-dialog {
  display: grid;
  grid-template-rows: auto auto minmax(220px, 1fr);
  width: min(1220px, 100%);
  max-height: min(900px, calc(100vh - 40px));
  overflow: hidden;
  border: 1px solid #36414a;
  border-radius: 6px;
  background: #151a1f;
  box-shadow: 0 18px 64px rgba(0, 0, 0, 0.56);
  color: #edf2f4;
}

.comparison-header,
.baseline-toolbar,
.comparison-section {
  border-bottom: 1px solid #2e373e;
}

.comparison-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 20px;
}

.comparison-eyebrow,
.baseline-select > span {
  color: #8c9aa4;
  font-size: 11px;
  font-weight: 800;
}

.comparison-header h2 {
  margin: 3px 0 0;
  font-size: 20px;
  letter-spacing: 0;
}

.icon-button,
.command-button,
.locate-button {
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
.command-button svg,
.locate-button svg,
.comparison-empty svg {
  width: 16px;
  height: 16px;
}

.baseline-toolbar {
  display: grid;
  grid-template-columns:
    minmax(190px, 1fr) minmax(190px, 1fr) auto auto
    minmax(220px, auto);
  align-items: end;
  gap: 10px;
  padding: 14px 20px;
  background: #11161a;
}

.baseline-select {
  display: grid;
  gap: 6px;
}

.baseline-select select {
  min-height: 36px;
  padding: 0 10px;
  border: 1px solid #3a454e;
  border-radius: 4px;
  outline: none;
  background: #0e1317;
  color: #edf2f4;
  font: inherit;
}

.command-button {
  gap: 7px;
  min-height: 36px;
  padding: 0 11px;
  font-size: 12px;
  font-weight: 800;
}

.file-input {
  display: none;
}

.baseline-source {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 3px 8px;
  min-width: 0;
  color: #87949d;
  font-size: 11px;
}

.baseline-source strong {
  overflow: hidden;
  color: #d9e2e6;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.comparison-empty {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 12px;
  min-height: 280px;
  color: #85939c;
}

.comparison-empty svg {
  width: 28px;
  height: 28px;
}

.comparison-content {
  min-height: 0;
  overflow: auto;
}

.comparison-windows {
  display: flex;
  gap: 6px;
  padding: 10px 20px;
  overflow-x: auto;
  border-bottom: 1px solid #2e373e;
  background: #101519;
}

.window-button {
  display: grid;
  flex: 0 0 auto;
  gap: 2px;
  min-width: 128px;
  padding: 7px 10px;
  border: 1px solid #37424a;
  border-radius: 4px;
  background: #1b2227;
  color: #d5dee2;
  text-align: left;
  cursor: pointer;
}

.window-button.active {
  border-color: #79c7b9;
  background: #21423d;
  color: #f1fffc;
}

.window-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.window-button span {
  color: #8d9aa2;
  font-size: 10px;
}

.comparison-section {
  padding: 15px 20px 18px;
}

.comparison-section:last-child {
  border-bottom: 0;
}

.comparison-section > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
}

.comparison-section h3 {
  margin: 0;
  font-size: 14px;
  letter-spacing: 0;
}

.comparison-section > header span {
  color: #819098;
  font-size: 11px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(130px, 1fr));
  border: 1px solid #313b43;
  border-radius: 4px;
  overflow: hidden;
}

.metric-row {
  display: grid;
  gap: 5px;
  padding: 10px 12px;
  border-right: 1px solid #313b43;
  background: #11171b;
}

.metric-row:last-child {
  border-right: 0;
}

.metric-row > span {
  color: #8b989f;
  font-size: 11px;
}

.metric-row strong {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.metric-values {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.metric-values div {
  display: grid;
  gap: 2px;
}

.metric-values small {
  color: #68767f;
  font-size: 9px;
  font-weight: 700;
}

.compact-table,
.action-table {
  border: 1px solid #313b43;
  border-radius: 4px;
  overflow: hidden;
}

.table-scroll {
  overflow-x: auto;
}

.action-table {
  min-width: 970px;
}

.table-head,
.table-row {
  display: grid;
  align-items: center;
  gap: 12px;
  min-height: 38px;
  padding: 0 11px;
}

.table-head {
  background: #101519;
  color: #7f8d95;
  font-size: 10px;
  font-weight: 800;
}

.table-row {
  border-top: 1px solid #2d363d;
  color: #c7d0d5;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.table-row[data-changed='true'] {
  background: rgba(121, 199, 185, 0.05);
}

.actor-columns {
  grid-template-columns: minmax(150px, 1fr) repeat(3, minmax(90px, 0.5fr));
}

.actor-metric {
  display: grid;
  gap: 2px;
}

.actor-metric small {
  font-size: 9px;
}

.action-columns {
  grid-template-columns:
    minmax(180px, 1.3fr) repeat(3, minmax(120px, 1fr))
    90px 90px 70px;
}

.effect-columns {
  grid-template-columns: minmax(150px, 1fr) minmax(120px, 0.8fr) repeat(
      3,
      minmax(90px, 0.6fr)
    );
}

.action-name {
  display: grid;
  min-width: 0;
}

.action-name strong,
.action-name span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-name span {
  color: #7f8c94;
  font-size: 10px;
}

.locate-button {
  width: 30px;
  height: 30px;
}

.action-locate-buttons {
  display: flex;
  gap: 4px;
}

.locate-button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.delta-positive {
  color: #89d8c9;
}

.delta-negative {
  color: #ff9c9c;
}

.section-empty {
  padding: 20px;
  border: 1px dashed #344049;
  border-radius: 4px;
  color: #7f8d95;
  text-align: center;
}

@media (max-width: 820px) {
  .comparison-overlay {
    padding: 8px;
  }

  .comparison-dialog {
    max-height: calc(100vh - 16px);
  }

  .baseline-toolbar {
    grid-template-columns: 1fr 1fr;
  }

  .baseline-select,
  .baseline-source {
    grid-column: 1 / -1;
  }

  .metric-grid {
    grid-template-columns: 1fr 1fr;
  }

  .metric-row {
    border-bottom: 1px solid #313b43;
  }

  .metric-row:last-child {
    grid-column: 1 / -1;
  }

  .actor-columns {
    grid-template-columns: minmax(80px, 1fr) repeat(3, minmax(54px, 0.55fr));
    gap: 6px;
  }

  .effect-columns {
    min-width: 620px;
  }

  .compact-table {
    overflow-x: auto;
  }
}

@media (max-width: 480px) {
  .comparison-windows {
    padding-right: 8px;
    padding-left: 8px;
  }

  .window-button {
    min-width: 105px;
    padding-right: 7px;
    padding-left: 7px;
  }

  .metric-grid {
    grid-template-columns: 1fr;
  }

  .metric-row,
  .metric-row:last-child {
    grid-column: auto;
    border-right: 0;
  }
}
</style>
