<template>
  <section
    class="panel resource-monitor-panel"
    :data-flow-phase="flowModel?.phase ?? ''"
    :data-flow-state-point-id="flowSelectedStatePointId"
    :data-runtime-review-selection-status="runtimeReviewContextView.status"
    :data-runtime-review-selected-action-id="
      runtimeReviewContextView.selectedActionId
    "
    :data-runtime-review-selected-state-point-id="
      runtimeReviewContextView.selectedStatePointId
    "
    :data-runtime-review-source="runtimeReviewContextView.source"
    :data-runtime-review-source-kind="runtimeReviewContextView.sourceKind"
  >
    <div class="panel-title">
      <TrendCharts class="panel-icon" />
      <h2>资源</h2>
    </div>

    <div class="resource-summary">
      <div>
        <span>事件</span>
        <strong data-testid="workbench-resource-event-count">{{
          resourceTimeline.length
        }}</strong>
      </div>
      <div>
        <span>SP 净值</span>
        <strong data-testid="workbench-resource-sp-total">{{
          formatSigned(resourceTotals.sp ?? 0)
        }}</strong>
      </div>
      <div>
        <span>命中</span>
        <strong>{{ summary.projectedHitCount }}</strong>
      </div>
      <div>
        <span>限制</span>
        <strong>{{ diagnostics.limitations.length }}</strong>
      </div>
    </div>

    <div
      v-if="runtimeProjection"
      class="runtime-resource-monitor"
      data-testid="workbench-runtime-resource-monitor"
    >
      <div class="runtime-heading">
        <span>运行投影</span>
        <strong data-testid="workbench-runtime-sim-log-count">
          {{ runtimeSummary.simLogCount ?? 0 }} 日志
        </strong>
      </div>

      <div class="runtime-state-grid">
        <div class="runtime-state-cell">
          <span>敌人 HP 伤害</span>
          <strong data-testid="workbench-runtime-enemy-hp-delta">
            {{ formatNumber(runtimeEnemyState.hpDelta) }}
          </strong>
          <small
            data-testid="workbench-runtime-enemy-hp-state"
            :title="runtimeEnemyHpMetric.baselineStatus ?? ''"
          >
            {{ formatRuntimeStateMetric(runtimeEnemyHpMetric) }}
          </small>
        </div>
        <div class="runtime-state-cell">
          <span>敌人韧性</span>
          <strong data-testid="workbench-runtime-enemy-toughness-delta">
            {{ formatNumber(runtimeEnemyState.toughnessDelta) }}
          </strong>
          <small
            data-testid="workbench-runtime-enemy-toughness-state"
            :title="runtimeEnemyToughnessMetric.baselineStatus ?? ''"
          >
            {{ formatRuntimeStateMetric(runtimeEnemyToughnessMetric) }}
          </small>
        </div>
      </div>

      <div
        v-if="runtimeActorEnergyRows.length"
        class="runtime-energy-list"
        data-testid="workbench-runtime-energy-list"
      >
        <div
          v-for="actor in runtimeActorEnergyRows"
          :key="actor.actorId"
          class="runtime-energy-row"
          data-testid="workbench-runtime-energy-actor-row"
        >
          <span>{{ actor.actorName }}</span>
          <strong
            >{{ actor.resource.toUpperCase() }}
            {{ formatSigned(actor.delta) }}</strong
          >
          <small
            data-testid="workbench-runtime-energy-actor-state"
            :title="actor.stateMetric?.baselineStatus ?? ''"
          >
            {{ formatRuntimeActorEnergyState(actor) }}
          </small>
        </div>
      </div>

      <div
        v-if="runtimeCurveSeries.length"
        class="runtime-curve-panel"
        data-testid="workbench-runtime-resource-chart"
      >
        <div class="runtime-curve-toolbar">
          <div class="runtime-curve-mode" role="group" aria-label="曲线模式">
            <button
              v-for="mode in RUNTIME_CURVE_MODES"
              :key="mode.key"
              type="button"
              :data-mode="mode.key"
              :data-active="runtimeCurveMode === mode.key ? 'true' : 'false'"
              data-testid="workbench-runtime-resource-chart-mode"
              @click="runtimeCurveMode = mode.key"
            >
              {{ mode.label }}
            </button>
          </div>
        </div>
        <svg
          class="runtime-curve-chart"
          :viewBox="`0 0 ${RUNTIME_CURVE_CHART_WIDTH} ${RUNTIME_CURVE_CHART_HEIGHT}`"
          role="img"
          aria-label="运行时 HP、韧性、自身能量曲线"
        >
          <line
            class="runtime-curve-axis"
            :x1="RUNTIME_CURVE_CHART_PADDING_X"
            :x2="RUNTIME_CURVE_CHART_WIDTH - RUNTIME_CURVE_CHART_PADDING_X"
            :y1="runtimeCurveZeroY"
            :y2="runtimeCurveZeroY"
          />
          <g
            v-for="series in runtimeCurveSeries"
            :key="series.key"
            class="runtime-curve-series"
          >
            <polyline
              v-if="series.chartLinePoints.length > 1"
              class="runtime-curve-line"
              :points="formatRuntimeCurvePolyline(series.chartLinePoints)"
              :style="{ stroke: series.color }"
              :data-series-key="series.key"
              :data-track-key="series.trackKey"
              :data-curve-mode="runtimeCurveMode"
              :data-source-point-count="series.sourcePointCount"
              :data-display-point-count="series.displayPointCount"
              data-testid="workbench-runtime-resource-chart-line"
            />
            <circle
              v-for="point in series.chartNodePoints"
              :key="point.nodeId ?? point.statePointId"
              class="runtime-curve-point"
              :class="{
                selected: runtimeCurvePointIsSelected(point),
              }"
              :cx="point.x"
              :cy="point.y"
              r="4"
              :fill="series.color"
              :data-series-key="series.key"
              :data-track-key="series.trackKey"
              :data-actor-id="series.actorId"
              :data-frame-label="point.frameLabel"
              :data-value="point.plotValue"
              :data-delta="point.delta"
              :data-cumulative="point.cumulative"
              :data-state-value="point.stateValue"
              :data-baseline-status="point.baselineStatus"
              :data-overrun="point.overrunValue"
              :data-curve-mode="runtimeCurveMode"
              :data-state-point-id="point.statePointId"
              :data-state-point-ids="point.statePointIds?.join(',') ?? ''"
              :data-runtime-focus-source="
                runtimeCurvePointIsSelected(point) ? flowRuntimeFocusSource : ''
              "
              :data-selected="runtimeCurvePointIsSelected(point)"
              data-testid="workbench-runtime-resource-chart-point"
              role="button"
              tabindex="0"
              @click="selectRuntimeCurvePoint(point)"
              @keydown.enter.prevent="selectRuntimeCurvePoint(point)"
              @keydown.space.prevent="selectRuntimeCurvePoint(point)"
            >
              <title>{{ formatRuntimeCurvePointTitle(series, point) }}</title>
            </circle>
          </g>
        </svg>

        <div
          v-if="selectedRuntimeCurvePoint"
          class="runtime-curve-selection"
          :data-curve-mode="runtimeCurveMode"
          :data-navigation-count="runtimeCurveNavigationPoints.length"
          :data-navigation-index="selectedRuntimeCurvePointIndex"
          :data-next-state-point-id="
            selectedRuntimeCurveNextPoint?.statePointId ?? ''
          "
          :data-previous-state-point-id="
            selectedRuntimeCurvePreviousPoint?.statePointId ?? ''
          "
          :data-result-context-action-id="
            selectedRuntimeCurveResultContext?.actionId ?? ''
          "
          :data-result-context-origin-state-point-id="
            selectedRuntimeCurveResultContext?.originStatePointId ?? ''
          "
          :data-result-context-status="
            selectedRuntimeCurveResultContext?.status ?? ''
          "
          :data-runtime-focus-source="flowRuntimeFocusSource || 'manual'"
          :data-series-key="selectedRuntimeCurvePoint.seriesKey"
          :data-state-point-id="selectedRuntimeCurvePoint.statePointId"
          :data-track-key="selectedRuntimeCurvePoint.trackKey"
          data-testid="workbench-runtime-resource-chart-selection"
        >
          <div class="runtime-curve-selection-heading">
            <span>选中点</span>
            <strong>{{ selectedRuntimeCurvePoint.seriesLabel }}</strong>
            <small
              :data-result-context-active="
                selectedRuntimeCurveResultContext ? 'true' : 'false'
              "
              data-testid="workbench-runtime-resource-chart-selection-source"
            >
              {{
                formatRuntimeCurveSelectionSource(
                  flowRuntimeFocusSourceView,
                  selectedRuntimeCurveResultContext
                )
              }}
            </small>
            <button
              type="button"
              class="runtime-curve-action-focus"
              :data-action-id="selectedRuntimeCurveActionEditTarget.actionId"
              :data-focus-field="selectedRuntimeCurveActionEditTarget.fieldKey"
              :data-state-point-id="
                selectedRuntimeCurveActionEditTarget.statePointId
              "
              data-testid="workbench-runtime-resource-chart-selection-action-focus"
              :disabled="!selectedRuntimeCurveActionEditCommand.enabled"
              @click="focusRuntimeCurveAction"
            >
              <EditPen class="runtime-curve-action-focus-icon" />
              <span>{{ selectedRuntimeCurveActionEditButtonLabel }}</span>
            </button>
            <button
              v-if="selectedRuntimeCurveResultReturnButtonVisible"
              type="button"
              class="runtime-curve-result-return"
              :data-action-id="
                selectedRuntimeCurveResultReturnCommandContext.actionId
              "
              :data-origin-state-point-id="
                selectedRuntimeCurveResultReturnCommandContext.originStatePointId
              "
              :data-return-status="
                selectedRuntimeCurveResultReturnCommandContext.status
              "
              :data-state-point-id="
                selectedRuntimeCurveResultReturnCommandContext.statePointId
              "
              data-testid="workbench-runtime-resource-chart-selection-return-result"
              :disabled="!selectedRuntimeCurveResultReturnCommand.enabled"
              @click="returnRuntimeCurveResult"
            >
              <Aim class="runtime-curve-result-return-icon" />
              <span>{{ selectedRuntimeCurveResultReturnButtonLabel }}</span>
            </button>
            <div class="runtime-curve-selection-nav">
              <button
                type="button"
                :data-state-point-id="
                  selectedRuntimeCurvePreviousPoint?.statePointId ?? ''
                "
                data-testid="workbench-runtime-resource-chart-selection-prev"
                :disabled="!selectedRuntimeCurvePreviousPoint"
                title="上一个三值点"
                aria-label="上一个三值点"
                @click="
                  selectRuntimeCurveAdjacentPoint(
                    selectedRuntimeCurvePreviousPoint
                  )
                "
              >
                <ArrowLeft class="runtime-curve-nav-icon" />
              </button>
              <span
                data-testid="workbench-runtime-resource-chart-selection-index"
              >
                {{ formatRuntimeCurveSelectionIndex() }}
              </span>
              <button
                type="button"
                :data-state-point-id="
                  selectedRuntimeCurveNextPoint?.statePointId ?? ''
                "
                data-testid="workbench-runtime-resource-chart-selection-next"
                :disabled="!selectedRuntimeCurveNextPoint"
                title="下一个三值点"
                aria-label="下一个三值点"
                @click="
                  selectRuntimeCurveAdjacentPoint(selectedRuntimeCurveNextPoint)
                "
              >
                <ArrowRight class="runtime-curve-nav-icon" />
              </button>
            </div>
          </div>
          <div
            v-if="selectedRuntimeCurvePointSummary"
            class="runtime-curve-selection-primary"
            :data-track-key="selectedRuntimeCurvePointSummary.trackKey"
            :data-state-point-id="selectedRuntimeCurvePointSummary.statePointId"
            data-testid="workbench-runtime-resource-chart-selection-primary"
          >
            <span>{{ selectedRuntimeCurvePointSummary.trackLabel }}</span>
            <strong
              data-testid="workbench-runtime-resource-chart-selection-primary-delta"
            >
              {{ selectedRuntimeCurvePointSummary.delta }}
            </strong>
            <small
              data-testid="workbench-runtime-resource-chart-selection-primary-state"
            >
              {{ selectedRuntimeCurvePointSummary.state }}
            </small>
          </div>
          <div class="runtime-curve-selection-grid">
            <div
              v-for="row in selectedRuntimeCurvePointRows"
              :key="row.key"
              class="runtime-curve-selection-row"
              :data-detail-key="row.key"
              data-testid="workbench-runtime-resource-chart-selection-row"
            >
              <span>{{ row.label }}</span>
              <strong>{{ row.value }}</strong>
            </div>
          </div>
        </div>

        <div class="runtime-curve-legend">
          <div
            v-for="series in runtimeCurveSeries"
            :key="`${series.key}-legend`"
            class="runtime-curve-legend-row"
            :data-series-key="series.key"
            :data-track-key="series.trackKey"
            :data-point-count="series.pointCount"
            :data-source-point-count="series.sourcePointCount"
            :data-baseline-status="series.baselineStatus"
            :data-curve-mode="runtimeCurveMode"
            data-testid="workbench-runtime-resource-chart-series"
          >
            <i :style="{ background: series.color }" />
            <span>{{ series.label }}</span>
            <strong>{{ formatRuntimeCurveSeries(series) }}</strong>
          </div>
        </div>
      </div>
    </div>

    <WindowedList
      v-if="resourceTimeline.length"
      class="resource-list"
      data-testid="workbench-resource-timeline-window"
      :items="resourceTimeline"
      :item-height="42"
      :max-height="180"
      :overscan="3"
      :item-key="createResourceTimelineEntryKey"
    >
      <template #default="{ item: entry }">
        <div class="resource-row">
          <span class="time">{{ entry.timeMs }}ms</span>
          <span class="resource">{{ entry.resource.toUpperCase() }}</span>
          <strong>{{ formatSigned(entry.change) }}</strong>
        </div>
      </template>
    </WindowedList>
    <p v-else class="empty-state" data-testid="workbench-resource-empty">
      暂无资源事件
    </p>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import {
  Aim,
  ArrowLeft,
  ArrowRight,
  EditPen,
  TrendCharts,
} from '@element-plus/icons-vue';
import {
  getCachedWorkbenchRuntimeDerivedView,
  getCachedWorkbenchRuntimeOutputConsumerView,
} from './workbenchRuntimeOutputViewCache';
import {
  createWorkbenchFlowRuntimeActionEditTarget,
  createWorkbenchRuntimeReviewPanelView,
  resolveWorkbenchMainFlowActionEditTarget,
} from './workbenchFlowModel';
import {
  createWorkbenchRuntimeReviewPanelCommandViewFromSurface,
  createWorkbenchRuntimeSelectionFlowActionFromSurface,
} from './workbenchMainFlowActions';
import { createRuntimeFocusSourceView } from './runtimeFocusSource';
import { projectTimelineStateDisplaySeries } from '../../simulation/projection/projectTimelineStateDisplaySeries';
import { msToFrame } from '../../domain/timebase';
import WindowedList from './WindowedList.vue';

const RUNTIME_CURVE_CHART_WIDTH = 320;
const RUNTIME_CURVE_CHART_HEIGHT = 132;
const RUNTIME_CURVE_CHART_PADDING_X = 18;
const RUNTIME_CURVE_CHART_PADDING_Y = 14;
const RUNTIME_CURVE_COLORS = {
  enemyHpDamage: '#ef767a',
  enemyToughnessDamage: '#e8c36a',
  selfEnergyChange: '#79c7b9',
};
const RUNTIME_CURVE_TRACK_ORDER = {
  enemyHpDamage: 0,
  enemyToughnessDamage: 1,
  selfEnergyChange: 2,
};
const RUNTIME_CURVE_MODES = [
  { key: 'delta', label: '累计变化' },
  { key: 'state', label: '状态值' },
];

const props = defineProps({
  resourceTimeline: {
    type: Array,
    required: true,
  },
  runtimeProjection: {
    type: Object,
    default: null,
  },
  summary: {
    type: Object,
    required: true,
  },
  diagnostics: {
    type: Object,
    required: true,
  },
  selectedStateCurvePointId: {
    type: String,
    default: '',
  },
  runtimeFocusSource: {
    type: String,
    default: '',
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
  durationMs: {
    type: Number,
    default: 0,
  },
});
const emit = defineEmits(['dispatch-flow-action']);
const runtimeCurveMode = ref('delta');
const runtimeOutputView = computed(() =>
  getCachedWorkbenchRuntimeOutputConsumerView(props.runtimeProjection)
);

const resourceTotals = computed(() => {
  return props.resourceTimeline.reduce((totals, entry) => {
    totals[entry.resource] = (totals[entry.resource] ?? 0) + entry.change;
    return totals;
  }, {});
});

const runtimeSummary = computed(() => runtimeOutputView.value.outputSummary);

const runtimeEnemyState = computed(
  () => runtimeOutputView.value.enemyStateCurve
);

const runtimeEnemyHpMetric = computed(
  () => runtimeEnemyState.value.stateMetrics?.hp ?? null
);

const runtimeEnemyToughnessMetric = computed(
  () => runtimeEnemyState.value.stateMetrics?.toughness ?? null
);

const runtimeActorEnergyRows = computed(
  () => runtimeOutputView.value.resourceCurveRows
);

const runtimeReviewPanelView = computed(
  () =>
    props.flowModel?.runtimeReviewPanelView ??
    createWorkbenchRuntimeReviewPanelView({
      flowModel: props.flowModel,
      selectedStateCurvePointId: props.selectedStateCurvePointId,
    })
);
const runtimeReviewContextView = computed(
  () => runtimeReviewPanelView.value.context
);
const flowSelectedStatePointId = computed(() =>
  resolveRuntimeCurveSelectedStatePointId({
    context: runtimeReviewContextView.value,
    resultContext: runtimeReviewPanelView.value.resultReturnContext,
    editResult: flowEditResult.value,
  })
);

const flowRuntimeFocusSource = computed(
  () => runtimeReviewContextView.value.source || props.runtimeFocusSource
);
const flowRuntimeFocusSourceView = computed(
  () =>
    runtimeReviewPanelView.value.sourceView ??
    createRuntimeFocusSourceView(flowRuntimeFocusSource.value)
);

const flowEditResult = computed(
  () => props.flowModel?.editResult ?? props.actionEditResultContext
);

const runtimeStatePointContexts = computed(
  () => runtimeOutputView.value.statePointContexts
);

const runtimeStatePointContextByDeltaId = computed(
  () => runtimeOutputView.value.statePointContextByDeltaId
);

const runtimeStatePointOrderById = computed(
  () => runtimeOutputView.value.statePointOrderById
);

const runtimeCurveSourceSeries = computed(() =>
  getCachedWorkbenchRuntimeDerivedView(
    props.runtimeProjection,
    `resource-curve-source-series:${Number(props.durationMs) || 0}`,
    runtimeView =>
      createRuntimeCurveSourceSeries(
        runtimeView,
        runtimeView.statePointContextByDeltaId,
        props.durationMs
      )
  )
);

const runtimeCurveDomain = computed(() =>
  createRuntimeCurveDomain(
    runtimeCurveSourceSeries.value,
    runtimeCurveMode.value
  )
);

const runtimeCurveSeries = computed(() =>
  runtimeCurveSourceSeries.value.map(series =>
    layoutRuntimeCurveSeries(
      series,
      runtimeCurveDomain.value,
      runtimeCurveMode.value,
      flowSelectedStatePointId.value
    )
  )
);

const runtimeCurveZeroY = computed(() =>
  scaleRuntimeCurveValue(0, runtimeCurveDomain.value)
);

const runtimeCurveNavigationPoints = computed(() =>
  runtimeCurveSourceSeries.value
    .flatMap((series, seriesIndex) =>
      getRuntimeCurveNavigationPoints(
        series,
        flowSelectedStatePointId.value
      ).map((point, pointIndex) => ({
        ...point,
        seriesKey: series.key,
        seriesLabel: series.label,
        seriesColor: series.color,
        seriesIndex,
        pointIndex,
        trackKey: series.trackKey,
        actorId: series.actorId,
      }))
    )
    .sort((left, right) =>
      compareRuntimeCurveNavigationPoints(
        left,
        right,
        runtimeStatePointOrderById.value
      )
    )
);

const selectedRuntimeCurvePointIndex = computed(() => {
  if (!flowSelectedStatePointId.value) {
    return -1;
  }
  return runtimeCurveNavigationPoints.value.findIndex(
    item => item.statePointId === flowSelectedStatePointId.value
  );
});

const selectedRuntimeCurvePoint = computed(() => {
  if (selectedRuntimeCurvePointIndex.value < 0) {
    return null;
  }
  return (
    runtimeCurveNavigationPoints.value[selectedRuntimeCurvePointIndex.value] ??
    null
  );
});

const selectedRuntimeCurveResultContext = computed(() =>
  getSelectedRuntimeCurveResultContext(
    runtimeReviewPanelView.value,
    flowEditResult.value,
    selectedRuntimeCurvePoint.value
  )
);
const selectedRuntimeCurveActionEditTarget = computed(
  () => selectedRuntimeCurveActionEditCommand.value.target
);
const selectedRuntimeCurveActionEditButtonLabel = computed(
  () => selectedRuntimeCurveActionEditCommand.value.label || '编辑结果动作'
);
const selectedRuntimeCurveActionEditCommand = computed(
  () => selectedRuntimeCurveCommandView.value.focus
);
const selectedRuntimeCurveResultReturnCommand = computed(
  () => selectedRuntimeCurveCommandView.value.returnResult
);
const selectedRuntimeCurveResultReturnCommandContext = computed(
  () =>
    selectedRuntimeCurveResultReturnCommand.value.context ??
    selectedRuntimeCurveResultContext.value ??
    {}
);
const selectedRuntimeCurveResultReturnButtonLabel = computed(() =>
  formatRuntimeCurveResultReturnButtonLabel(
    selectedRuntimeCurveResultReturnCommandContext.value
  )
);
const selectedRuntimeCurveResultReturnButtonVisible = computed(() =>
  Boolean(
    selectedRuntimeCurveResultReturnCommandContext.value?.statePointId ||
    selectedRuntimeCurveResultContext.value
  )
);
const selectedRuntimeCurveCommandView = computed(() =>
  createWorkbenchRuntimeReviewPanelCommandViewFromSurface({
    mainFlowCommandSurface: props.mainFlowCommandSurface,
    flowModel: props.flowModel,
    source: 'resource-runtime-curve',
    focusTarget: getRuntimeCurveActionEditTarget(
      runtimeReviewPanelView.value,
      props.flowModel,
      selectedRuntimeCurvePoint.value
    ),
    returnContext: selectedRuntimeCurveResultContext.value,
  })
);

const selectedRuntimeCurvePointRows = computed(() =>
  createSelectedRuntimeCurvePointRows(selectedRuntimeCurvePoint.value)
);
const selectedRuntimeCurvePointSummary = computed(() =>
  createSelectedRuntimeCurvePointSummary(selectedRuntimeCurvePoint.value)
);

const selectedRuntimeCurvePreviousPoint = computed(() =>
  selectedRuntimeCurvePointIndex.value > 0
    ? runtimeCurveNavigationPoints.value[
        selectedRuntimeCurvePointIndex.value - 1
      ]
    : null
);

const selectedRuntimeCurveNextPoint = computed(() =>
  selectedRuntimeCurvePointIndex.value >= 0 &&
  selectedRuntimeCurvePointIndex.value <
    runtimeCurveNavigationPoints.value.length - 1
    ? runtimeCurveNavigationPoints.value[
        selectedRuntimeCurvePointIndex.value + 1
      ]
    : null
);

function formatSigned(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? '+' : ''}${number}`;
}

function createResourceTimelineEntryKey(entry, index) {
  return [
    entry?.actionId ?? '',
    entry?.resource ?? '',
    entry?.timeMs ?? 0,
    entry?.sourceDeltaId ?? '',
    index,
  ].join('|');
}

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString('zh-CN');
}

function formatRuntimeStateMetric(metric) {
  const stateLabel = metric?.stateLabel ?? '当前';
  const value = strictNumberOrNull(metric?.currentValue);
  if (Number.isFinite(value)) {
    const maxValue = strictNumberOrNull(metric?.maxValue);
    return Number.isFinite(maxValue)
      ? `${stateLabel} ${formatNumber(value)} / ${formatNumber(maxValue)}`
      : `${stateLabel} ${formatNumber(value)}`;
  }
  return `${stateLabel}待确认`;
}

function formatRuntimeActorEnergyState(actor) {
  return `${formatRuntimeStateMetric(actor.stateMetric)} · ${actor.pointCount}点`;
}

function createRuntimeCurveSourceSeries(
  runtimeOutputView,
  runtimeContextByDeltaId,
  durationMs
) {
  if (!runtimeOutputView?.ready) {
    return [];
  }
  const enemyStateCurve = runtimeOutputView.enemyStateCurve;
  const resourceCurveRows = runtimeOutputView.resourceCurveRows;

  return [
    createRuntimeEnemyCurveSeries({
      key: 'enemy-hp',
      trackKey: 'enemyHpDamage',
      label: '敌人 HP',
      color: RUNTIME_CURVE_COLORS.enemyHpDamage,
      valueField: 'hpDelta',
      points: enemyStateCurve.points ?? [],
      stateMetric: enemyStateCurve.stateMetrics?.hp,
      runtimeContextByDeltaId,
      durationMs,
    }),
    createRuntimeEnemyCurveSeries({
      key: 'enemy-toughness',
      trackKey: 'enemyToughnessDamage',
      label: '敌人韧性',
      color: RUNTIME_CURVE_COLORS.enemyToughnessDamage,
      valueField: 'toughnessDelta',
      points: enemyStateCurve.points ?? [],
      stateMetric: enemyStateCurve.stateMetrics?.toughness,
      runtimeContextByDeltaId,
      durationMs,
    }),
    ...resourceCurveRows.map((actor, index) =>
      createRuntimeEnergyCurveSeries(
        actor,
        index,
        runtimeContextByDeltaId,
        durationMs
      )
    ),
  ];
}

function createRuntimeEnemyCurveSeries({
  key,
  trackKey,
  label,
  color,
  valueField,
  points,
  stateMetric,
  runtimeContextByDeltaId,
  durationMs,
}) {
  return createRuntimeCurveSeries({
    key,
    trackKey,
    label,
    color,
    points: points.filter(point => point.trackKey === trackKey),
    valueField,
    stateMetric,
    runtimeContextByDeltaId,
    durationMs,
  });
}

function createRuntimeEnergyCurveSeries(
  actor,
  index,
  runtimeContextByDeltaId,
  durationMs
) {
  return createRuntimeCurveSeries({
    key: `self-energy-${actor.actorId ?? index}`,
    trackKey: 'selfEnergyChange',
    actorId: actor.actorId,
    label: `${actor.actorName ?? actor.actorId ?? '角色'} SP`,
    color: index === 0 ? RUNTIME_CURVE_COLORS.selfEnergyChange : '#8db2ff',
    points: actor.points ?? [],
    valueField: 'energyDelta',
    stateMetric: actor.stateMetric,
    runtimeContextByDeltaId,
    durationMs,
  });
}

function createRuntimeCurveSeries({
  key,
  trackKey,
  actorId = '',
  label,
  color,
  points,
  valueField,
  stateMetric = null,
  runtimeContextByDeltaId,
  durationMs,
}) {
  let cumulative = 0;
  const curvePoints = [...(points ?? [])]
    .sort(compareRuntimeCurvePoints)
    .map((point, index) => {
      const statePointId = getRuntimeCurvePointStatePointId(
        point,
        runtimeContextByDeltaId
      );
      if (!statePointId) {
        return null;
      }
      const delta = numberOrZero(point[valueField] ?? point.delta);
      cumulative = roundCurveValue(cumulative + delta);
      const statePoint = createRuntimeCurvePointState(stateMetric, cumulative);
      return {
        ...point,
        delta,
        cumulative,
        stateLabel: statePoint.stateLabel,
        stateValue: statePoint.stateValue,
        rawStateValue: statePoint.rawStateValue,
        overrunValue: statePoint.overrunValue,
        baselineStatus: statePoint.baselineStatus,
        baselineConfirmed: statePoint.baselineConfirmed,
        statePointId,
        frameIndex: numberOrNull(point.frameIndex) ?? 0,
        frameLabel: point.frameLabel ?? `${numberOrNull(point.timeMs) ?? 0}ms`,
        sequenceIndex: point.sequenceIndex ?? index,
      };
    })
    .filter(Boolean);
  const finalPoint = curvePoints[curvePoints.length - 1] ?? null;
  const displaySeries = projectTimelineStateDisplaySeries({
    trackKey,
    points: curvePoints.map(point => ({
      ...point,
      trackKey,
      afterValue: point.stateValue,
    })),
    initialValue: strictNumberOrNull(stateMetric?.initialValue) ?? 0,
    maxValue: strictNumberOrNull(stateMetric?.maxValue),
    durationMs: Math.max(
      Number(durationMs) || 0,
      curvePoints.at(-1)?.timeMs ?? 0
    ),
    resolveStatePointId: point => point.statePointId ?? '',
  });
  const pointByStatePointId = new Map(
    curvePoints.map(point => [point.statePointId, point])
  );
  const semanticPoints = displaySeries.semanticNodes.map((node, index) => {
    const sourcePoint =
      [...(node.statePointIds ?? [])]
        .reverse()
        .map(statePointId => pointByStatePointId.get(statePointId))
        .find(Boolean) ?? null;
    return {
      ...sourcePoint,
      ...node,
      delta: sourcePoint?.delta ?? node.delta,
      nodeId: `${key}|semantic|${node.id ?? index}`,
      frameLabel: sourcePoint?.frameLabel ?? `${msToFrame(node.timeMs)}f`,
      stateValue: node.currentValue,
      rawStateValue: node.currentValue,
      plotValue: node.currentValue,
    };
  });
  const displayLinePoints = displaySeries.linePoints.map((point, index) => ({
    ...point,
    nodeId: `${key}|line|${index}`,
    frameIndex: msToFrame(point.timeMs),
    frameLabel: `${msToFrame(point.timeMs)}f`,
    stateValue: point.value,
    rawStateValue: point.value,
    plotValue: point.value,
  }));

  return {
    key,
    trackKey,
    actorId,
    label,
    color,
    stateMetric,
    baselineStatus: stateMetric?.baselineStatus ?? null,
    baselineConfirmed: Boolean(stateMetric?.baselineConfirmed),
    stateLabel: stateMetric?.stateLabel ?? null,
    baselineInitialValue: stateMetric?.initialValue ?? null,
    overrunValue: stateMetric?.overrunValue ?? finalPoint?.overrunValue ?? 0,
    points: curvePoints,
    semanticPoints,
    displayLinePoints,
    sourcePointCount: curvePoints.length,
    displayPointCount: displayLinePoints.length,
    semanticPointCount: semanticPoints.length,
    pointCount: semanticPoints.length,
    finalValue: cumulative,
    finalStateValue:
      finalPoint?.stateValue ?? stateMetric?.currentValue ?? null,
  };
}

function getRuntimeCurvePointStatePointId(point, runtimeContextByDeltaId) {
  return runtimeContextByDeltaId?.get(point?.sourceDeltaId)?.statePointId ?? '';
}

function createRuntimeCurvePointState(stateMetric, cumulative) {
  const initialValue = strictNumberOrNull(stateMetric?.initialValue);
  const baselineConfirmed = Number.isFinite(initialValue);
  const rawStateValue = baselineConfirmed
    ? roundCurveValue(
        stateMetric?.deltaDirection === 'decrease'
          ? initialValue - numberOrZero(cumulative)
          : initialValue + numberOrZero(cumulative)
      )
    : null;
  const stateValue =
    rawStateValue != null && stateMetric?.deltaDirection === 'decrease'
      ? Math.max(0, rawStateValue)
      : rawStateValue;

  return {
    stateLabel: stateMetric?.stateLabel ?? null,
    stateValue,
    rawStateValue,
    overrunValue:
      rawStateValue != null && stateMetric?.deltaDirection === 'decrease'
        ? Math.max(0, roundCurveValue(-rawStateValue))
        : 0,
    baselineStatus: stateMetric?.baselineStatus ?? null,
    baselineConfirmed,
  };
}

function createRuntimeCurveDomain(seriesRows, curveMode) {
  const points = seriesRows.flatMap(series =>
    getRuntimeCurveLinePoints(series, curveMode)
  );
  const frames = points.map(point => numberOrNull(point.frameIndex) ?? 0);
  const values = [
    0,
    ...seriesRows
      .map(series =>
        curveMode === 'state'
          ? strictNumberOrNull(series.baselineInitialValue)
          : null
      )
      .filter(Number.isFinite),
    ...points.map(point => numberOrZero(point.plotValue)),
  ];
  const frameMin = Math.min(0, ...frames);
  const frameMax = Math.max(1, ...frames);
  let valueMin = Math.min(...values);
  let valueMax = Math.max(...values);

  if (valueMin === valueMax) {
    valueMin -= 1;
    valueMax += 1;
  }

  return {
    frameMin,
    frameMax,
    valueMin,
    valueMax,
  };
}

function layoutRuntimeCurveSeries(
  series,
  domain,
  curveMode,
  selectedStatePointId
) {
  const linePoints = getRuntimeCurveLinePoints(series, curveMode);
  const nodePoints = getRuntimeCurveNavigationPoints(
    series,
    selectedStatePointId
  ).map(point => ({
    ...point,
    plotValue:
      curveMode === 'state'
        ? strictNumberOrNull(point.stateValue)
        : numberOrZero(point.cumulative),
  }));
  return {
    ...series,
    pointCount: nodePoints.length,
    chartLinePoints: linePoints.map(point => ({
      ...point,
      x: scaleRuntimeCurveFrame(point.frameIndex, domain),
      y: scaleRuntimeCurveValue(point.plotValue, domain),
    })),
    chartNodePoints: nodePoints
      .filter(point => Number.isFinite(point.plotValue))
      .map(point => ({
        ...point,
        x: scaleRuntimeCurveFrame(point.frameIndex, domain),
        y: scaleRuntimeCurveValue(point.plotValue, domain),
      })),
  };
}

function getRuntimeCurveLinePoints(series, curveMode) {
  const points =
    curveMode === 'state'
      ? (series.displayLinePoints ?? [])
      : (series.semanticPoints ?? []);
  return points
    .map(point => ({
      ...point,
      plotValue:
        curveMode === 'state'
          ? strictNumberOrNull(point.stateValue)
          : numberOrZero(point.cumulative),
    }))
    .filter(point => Number.isFinite(point.plotValue));
}

function getRuntimeCurveNavigationPoints(series, selectedStatePointId = '') {
  const semanticPoints = [...(series.semanticPoints ?? [])];
  if (
    !selectedStatePointId ||
    semanticPoints.some(point =>
      runtimeCurvePointContainsStatePoint(point, selectedStatePointId)
    )
  ) {
    return semanticPoints;
  }
  const selectedPoint = (series.points ?? []).find(
    point => point.statePointId === selectedStatePointId
  );
  return selectedPoint
    ? [
        ...semanticPoints,
        {
          ...selectedPoint,
          nodeId: `${series.key}|selected|${selectedStatePointId}`,
          statePointIds: [selectedStatePointId],
        },
      ].sort(compareRuntimeCurvePoints)
    : semanticPoints;
}

function runtimeCurvePointContainsStatePoint(point, statePointId) {
  return Boolean(
    statePointId &&
    (point?.statePointId === statePointId ||
      point?.statePointIds?.includes(statePointId))
  );
}

function runtimeCurvePointIsSelected(point) {
  return runtimeCurvePointContainsStatePoint(
    point,
    flowSelectedStatePointId.value
  );
}

function scaleRuntimeCurveFrame(frameIndex, domain) {
  const span = Math.max(1, domain.frameMax - domain.frameMin);
  const chartWidth =
    RUNTIME_CURVE_CHART_WIDTH - RUNTIME_CURVE_CHART_PADDING_X * 2;
  const frame = numberOrNull(frameIndex) ?? domain.frameMin;
  if (span <= 1 && domain.frameMax <= 1) {
    return RUNTIME_CURVE_CHART_PADDING_X + chartWidth / 2;
  }
  return (
    RUNTIME_CURVE_CHART_PADDING_X +
    ((frame - domain.frameMin) / span) * chartWidth
  );
}

function scaleRuntimeCurveValue(value, domain) {
  const span = Math.max(1, domain.valueMax - domain.valueMin);
  const chartHeight =
    RUNTIME_CURVE_CHART_HEIGHT - RUNTIME_CURVE_CHART_PADDING_Y * 2;
  const normalized = (numberOrZero(value) - domain.valueMin) / span;
  return (
    RUNTIME_CURVE_CHART_HEIGHT -
    RUNTIME_CURVE_CHART_PADDING_Y -
    normalized * chartHeight
  );
}

function formatRuntimeCurvePolyline(points) {
  return points
    .map(point => `${formatChartNumber(point.x)},${formatChartNumber(point.y)}`)
    .join(' ');
}

function formatRuntimeCurveSeries(series) {
  if (runtimeCurveMode.value === 'state') {
    const stateLabel = series.stateLabel ?? '状态';
    const stateValue = strictNumberOrNull(series.finalStateValue);
    if (!Number.isFinite(stateValue)) {
      return `${stateLabel}待确认 / ${series.sourcePointCount}点`;
    }
    const overrun = numberOrZero(series.overrunValue);
    if (overrun > 0) {
      return `${stateLabel} ${formatNumber(stateValue)} / 溢出 ${formatNumber(overrun)}`;
    }
    return `${stateLabel} ${formatNumber(stateValue)} / ${series.pointCount}点`;
  }
  if (series.pointCount === 0) {
    return '0点';
  }
  return `${formatSigned(series.finalValue)} / ${series.pointCount}点`;
}

function formatRuntimeCurvePointTitle(series, point) {
  if (runtimeCurveMode.value === 'state') {
    const stateLabel = point.stateLabel ?? series.stateLabel ?? '状态';
    const overrun = numberOrZero(point.overrunValue);
    const overrunText = overrun > 0 ? ` / 溢出 ${formatNumber(overrun)}` : '';
    const baselineText = point.baselineStatus
      ? ` / ${formatBaselineStatus(point.baselineStatus)}`
      : '';
    return `${series.label} ${point.frameLabel}: ${stateLabel} ${formatNumber(point.plotValue)}${overrunText} (Δ ${formatSigned(point.delta)}, Σ ${formatSigned(point.cumulative)})${baselineText}`;
  }
  const stateValue = strictNumberOrNull(point.stateValue);
  const stateText = Number.isFinite(stateValue)
    ? ` / ${point.stateLabel ?? '状态'} ${formatNumber(stateValue)}`
    : point.baselineStatus
      ? ` / ${formatBaselineStatus(point.baselineStatus)}`
      : '';
  return `${series.label} ${point.frameLabel}: ${formatSigned(point.delta)} -> ${formatSigned(point.cumulative)}${stateText}`;
}

function resolveRuntimeCurveSelectedStatePointId({
  context = null,
  resultContext = null,
  editResult = null,
} = {}) {
  const selectedStatePointId = context?.selectedStatePointId ?? '';
  const pendingStatePointId =
    context?.pendingStatePointId ||
    resultContext?.statePointId ||
    editResult?.runtimeStatePointId ||
    editResult?.statePointId ||
    '';
  const originStatePointId =
    resultContext?.originStatePointId ?? editResult?.originStatePointId ?? '';

  if (
    pendingStatePointId &&
    (!selectedStatePointId || selectedStatePointId === originStatePointId)
  ) {
    return pendingStatePointId;
  }

  return selectedStatePointId || pendingStatePointId;
}

function createSelectedRuntimeCurvePointRows(point) {
  if (!point) {
    return [];
  }
  return [
    {
      key: 'point',
      label: '定位',
      value: `${point.frameLabel ?? `${point.timeMs ?? 0}ms`} · ${
        point.seriesLabel || formatRuntimeTrackLabel(point.trackKey)
      }`,
    },
    {
      key: 'action',
      label: '动作',
      value: point.actionName ?? point.actionId ?? '动作',
    },
  ];
}

function createSelectedRuntimeCurvePointSummary(point) {
  if (!point) {
    return null;
  }
  return {
    statePointId: point.statePointId ?? '',
    trackKey: point.trackKey ?? '',
    trackLabel: point.seriesLabel || formatRuntimeTrackLabel(point.trackKey),
    delta: formatRuntimeCurvePointDelta(point),
    state: `累计 ${formatRuntimeCurvePointCumulative(point)} · ${
      point.stateLabel ?? '状态'
    } ${formatRuntimeCurvePointState(point)}`,
  };
}

function formatRuntimeCurvePointDelta(point) {
  return point.trackKey === 'selfEnergyChange'
    ? formatSigned(point.delta)
    : formatNumber(point.delta);
}

function formatRuntimeCurvePointCumulative(point) {
  return point.trackKey === 'selfEnergyChange'
    ? formatSigned(point.cumulative)
    : formatNumber(point.cumulative);
}

function formatRuntimeCurvePointState(point) {
  const value = strictNumberOrNull(point.stateValue);
  const stateText = Number.isFinite(value)
    ? formatNumber(value)
    : point.baselineStatus
      ? formatBaselineStatus(point.baselineStatus)
      : '待确认';
  const overrun = numberOrZero(point.overrunValue);
  return overrun > 0
    ? `${stateText} · 溢出 ${formatNumber(overrun)}`
    : stateText;
}

function createSelectedRuntimeCurveResultContext(context, point) {
  const statePointId = context?.runtimeStatePointId ?? context?.statePointId;
  if (!statePointId || !point?.statePointId) {
    return null;
  }
  if (statePointId !== point.statePointId) {
    return null;
  }
  return {
    status: context.status ?? 'refreshed-edit-result',
    actionId: context.actionId ?? '',
    originStatePointId: context.originStatePointId ?? '',
    statePointId,
  };
}

function getSelectedRuntimeCurveResultContext(panelView, context, point) {
  const commandContext = panelView?.commandView?.returnResult?.context ?? null;
  if (isRuntimeResultReturnContextForPoint(commandContext, point)) {
    return commandContext;
  }
  if (
    isRuntimeResultReturnContextForPoint(panelView?.resultReturnContext, point)
  ) {
    return panelView.resultReturnContext;
  }
  return createSelectedRuntimeCurveResultContext(context, point);
}

function isRuntimeResultReturnContextForPoint(context, point) {
  const statePointId = context?.statePointId ?? '';
  return Boolean(statePointId && point?.statePointId === statePointId);
}

function formatRuntimeCurveSelectionSource(
  sourceViewOrSource,
  resultContext = null
) {
  if (resultContext?.status === 'refreshed-edit-result') {
    return '刷新后结果';
  }
  const sourceView =
    typeof sourceViewOrSource === 'string'
      ? createRuntimeFocusSourceView(sourceViewOrSource)
      : sourceViewOrSource;
  return sourceView?.curveSelectionLabel ?? '手动选择';
}

function formatRuntimeCurveSelectionIndex() {
  const total = runtimeCurveNavigationPoints.value.length;
  if (selectedRuntimeCurvePointIndex.value < 0 || total <= 0) {
    return `0/${total}`;
  }
  return `${selectedRuntimeCurvePointIndex.value + 1}/${total}`;
}

function getRuntimeCurveActionEditTarget(panelView, flowModel, point) {
  const panelTarget = getRuntimeReviewPanelFocusTargetForStatePoint(
    panelView,
    point?.statePointId ?? ''
  );
  if (panelTarget) {
    return panelTarget;
  }
  return resolveWorkbenchMainFlowActionEditTarget({
    flowModel,
    fallbackTarget: createWorkbenchFlowRuntimeActionEditTarget(point),
    statePointId: point?.statePointId ?? '',
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

function formatRuntimeTrackLabel(trackKey) {
  if (trackKey === 'enemyHpDamage') {
    return '敌人 HP';
  }
  if (trackKey === 'enemyToughnessDamage') {
    return '敌人韧性';
  }
  if (trackKey === 'selfEnergyChange') {
    return '自身能量';
  }
  return trackKey ?? '三值';
}

function formatBaselineStatus(status) {
  if (status === 'baseline-derived-from-scenario-enemy-max-hp') {
    return '基线:敌人面板';
  }
  if (status === 'baseline-derived-from-scenario-actor-self-energy') {
    return '基线:角色状态';
  }
  if (status === 'baseline-derived-from-scenario-enemy-WEAKNESS_POINT_MAX') {
    return '基线:敌人弱点值';
  }
  if (
    status === 'baseline-pending-azpr-enemy-toughness-state' ||
    status === 'baseline-pending-azpr-initial-self-energy'
  ) {
    return '基线待确认';
  }
  if (status === 'baseline-pending-missing-scenario-enemy-max-hp') {
    return 'HP基线缺失';
  }
  if (status === 'baseline-pending-missing-WEAKNESS_POINT_MAX') {
    return '韧性基线缺失';
  }
  return status ?? '';
}

function selectRuntimeCurvePoint(point) {
  dispatchRuntimeCurveFlowAction(getRuntimeCurvePointFlowAction(point));
}

function selectRuntimeCurveAdjacentPoint(point) {
  dispatchRuntimeCurveFlowAction(getRuntimeCurvePointFlowAction(point));
}

function focusRuntimeCurveAction() {
  dispatchRuntimeCurveFlowAction(
    selectedRuntimeCurveActionEditCommand.value.action
  );
}

function returnRuntimeCurveResult() {
  dispatchRuntimeCurveFlowAction(
    selectedRuntimeCurveResultReturnCommand.value.action
  );
}

function dispatchRuntimeCurveFlowAction(action) {
  if (!action?.canRun) {
    return;
  }
  emit('dispatch-flow-action', action);
}

function getRuntimeCurvePointFlowAction(point) {
  return createWorkbenchRuntimeSelectionFlowActionFromSurface({
    mainFlowCommandSurface: props.mainFlowCommandSurface,
    source: 'resource-runtime-curve',
    detail: point,
    enabled: Boolean(point?.statePointId),
  });
}

function formatRuntimeCurveResultReturnButtonLabel(context = null) {
  if (context?.status === 'refreshed-edit-result') {
    return '查看刷新结果';
  }
  if (context?.status === 'origin-result') {
    return '回到来源结果';
  }
  return '回到结果点';
}

function compareRuntimeCurveNavigationPoints(left, right, runtimeOrderById) {
  const runtimeOrder = compareRuntimeCurveRuntimeOrder(
    left,
    right,
    runtimeOrderById
  );
  if (runtimeOrder !== 0) {
    return runtimeOrder;
  }
  return (
    compareRuntimeCurvePoints(left, right) ||
    getRuntimeCurveTrackOrder(left.trackKey) -
      getRuntimeCurveTrackOrder(right.trackKey) ||
    (numberOrNull(left.seriesIndex) ?? 0) -
      (numberOrNull(right.seriesIndex) ?? 0) ||
    (numberOrNull(left.pointIndex) ?? 0) - (numberOrNull(right.pointIndex) ?? 0)
  );
}

function compareRuntimeCurveRuntimeOrder(left, right, runtimeOrderById) {
  const leftOrder = runtimeOrderById?.get(left.statePointId);
  const rightOrder = runtimeOrderById?.get(right.statePointId);
  const hasLeft = Number.isFinite(leftOrder);
  const hasRight = Number.isFinite(rightOrder);
  if (hasLeft && hasRight) {
    return leftOrder - rightOrder;
  }
  if (hasLeft) {
    return -1;
  }
  if (hasRight) {
    return 1;
  }
  return 0;
}

function getRuntimeCurveTrackOrder(trackKey) {
  return RUNTIME_CURVE_TRACK_ORDER[trackKey] ?? 99;
}

function compareRuntimeCurvePoints(left, right) {
  return (
    (numberOrNull(left.frameIndex) ?? 0) -
      (numberOrNull(right.frameIndex) ?? 0) ||
    (numberOrNull(left.sequenceIndex) ?? 0) -
      (numberOrNull(right.sequenceIndex) ?? 0)
  );
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberOrZero(value) {
  return numberOrNull(value) ?? 0;
}

function strictNumberOrNull(value) {
  if (value == null || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundCurveValue(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

function formatChartNumber(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
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

.resource-monitor-panel:is(
    [data-flow-phase='runtime-result'],
    [data-flow-phase='edit-result-review']
  )
  .panel-title {
  padding: 10px 12px;
}

.resource-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 14px;
}

.resource-summary div {
  min-width: 0;
  padding: 9px 10px;
  border-radius: 4px;
  background: #232a31;
}

.resource-summary span {
  display: block;
  margin-bottom: 4px;
  color: #8f9aa3;
  font-size: 12px;
}

.resource-summary strong {
  display: block;
  color: #ffffff;
  font-size: 15px;
}

.resource-monitor-panel:is(
    [data-flow-phase='runtime-result'],
    [data-flow-phase='edit-result-review']
  )
  .resource-summary {
  gap: 6px;
  padding: 10px 12px;
}

.resource-monitor-panel:is(
    [data-flow-phase='runtime-result'],
    [data-flow-phase='edit-result-review']
  )
  .resource-summary
  div {
  padding: 6px 7px;
}

.resource-monitor-panel:is(
    [data-flow-phase='runtime-result'],
    [data-flow-phase='edit-result-review']
  )
  .resource-summary
  span {
  margin-bottom: 2px;
  font-size: 11px;
}

.resource-monitor-panel:is(
    [data-flow-phase='runtime-result'],
    [data-flow-phase='edit-result-review']
  )
  .resource-summary
  strong {
  font-size: 13px;
}

.runtime-resource-monitor {
  display: grid;
  gap: 10px;
  margin: 0 14px 14px;
  padding: 12px;
  border: 1px solid rgba(121, 199, 185, 0.18);
  border-radius: 6px;
  background: rgba(121, 199, 185, 0.07);
}

.resource-monitor-panel:is(
    [data-flow-phase='runtime-result'],
    [data-flow-phase='edit-result-review']
  )
  .runtime-resource-monitor {
  gap: 8px;
  margin: 0 12px 12px;
  padding: 10px;
}

.runtime-heading,
.runtime-energy-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.runtime-heading span {
  color: #d9dee3;
  font-size: 13px;
  font-weight: 700;
}

.runtime-heading strong {
  color: #79c7b9;
  font-size: 12px;
}

.runtime-state-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.runtime-state-cell {
  min-width: 0;
  padding: 8px 9px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
}

.runtime-state-cell span {
  display: block;
  margin-bottom: 4px;
  color: #8f9aa3;
  font-size: 11px;
}

.runtime-state-cell strong {
  display: block;
  color: #ffffff;
  font-size: 15px;
}

.runtime-state-cell small {
  display: block;
  margin-top: 3px;
  color: #aeb8c1;
  font-size: 11px;
  white-space: nowrap;
}

.runtime-energy-list {
  display: grid;
  gap: 6px;
}

.runtime-energy-row {
  padding: 7px 9px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  font-size: 12px;
}

.runtime-energy-row span {
  min-width: 0;
  color: #d9dee3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.runtime-energy-row strong {
  color: #ffffff;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.runtime-energy-row small {
  color: #8f9aa3;
  white-space: nowrap;
}

.runtime-curve-panel {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 9px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
}

.resource-monitor-panel:is(
    [data-flow-phase='runtime-result'],
    [data-flow-phase='edit-result-review']
  )
  .runtime-curve-panel {
  gap: 6px;
  padding: 7px;
}

.runtime-curve-toolbar {
  display: flex;
  justify-content: flex-end;
  min-width: 0;
}

.runtime-curve-mode {
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  min-width: 142px;
  padding: 2px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  background: rgba(15, 19, 24, 0.72);
}

.runtime-curve-mode button {
  min-width: 0;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: #aeb8c1;
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  line-height: 1;
  padding: 6px 7px;
  white-space: nowrap;
}

.runtime-curve-mode button[data-active='true'] {
  background: rgba(121, 199, 185, 0.2);
  color: #ffffff;
}

.runtime-curve-chart {
  width: 100%;
  height: auto;
  min-height: 118px;
  border-radius: 4px;
  background: #171c22;
}

.resource-monitor-panel:is(
    [data-flow-phase='runtime-result'],
    [data-flow-phase='edit-result-review']
  )
  .runtime-curve-chart {
  min-height: 96px;
}

.runtime-curve-axis {
  stroke: rgba(255, 255, 255, 0.16);
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

.runtime-curve-line {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
  opacity: 0.88;
}

.runtime-curve-point {
  stroke: #11161b;
  stroke-width: 1.5;
  cursor: pointer;
}

.runtime-curve-point:focus,
.runtime-curve-point.selected {
  outline: none;
  stroke: #ffffff;
  stroke-width: 2.5;
}

.runtime-curve-selection {
  display: grid;
  gap: 7px;
  min-width: 0;
  padding: 8px;
  border: 1px solid rgba(121, 199, 185, 0.2);
  border-radius: 4px;
  background: rgba(15, 20, 25, 0.64);
}

.resource-monitor-panel:is(
    [data-flow-phase='runtime-result'],
    [data-flow-phase='edit-result-review']
  )
  .runtime-curve-selection {
  gap: 6px;
  padding: 7px;
}

.runtime-curve-selection-heading {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto auto auto;
  align-items: center;
  gap: 7px;
  min-width: 0;
  font-size: 12px;
}

.runtime-curve-selection-heading span {
  color: #8f9aa3;
}

.runtime-curve-selection-heading strong {
  min-width: 0;
  overflow: hidden;
  color: #ffffff;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.runtime-curve-selection-heading small {
  color: #79c7b9;
  white-space: nowrap;
}

.runtime-curve-action-focus,
.runtime-curve-result-return {
  display: inline-grid;
  grid-template-columns: 13px auto;
  align-items: center;
  gap: 4px;
  min-width: 0;
  height: 24px;
  border: 1px solid rgba(121, 199, 185, 0.28);
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.12);
  color: #dff9f3;
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  white-space: nowrap;
}

.runtime-curve-action-focus:disabled,
.runtime-curve-result-return:disabled {
  color: #6d7780;
  cursor: not-allowed;
  opacity: 0.5;
}

.runtime-curve-action-focus-icon,
.runtime-curve-result-return-icon {
  width: 13px;
  height: 13px;
}

.runtime-curve-selection-nav {
  display: grid;
  grid-template-columns: 24px auto 24px;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.runtime-curve-selection-nav button {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: #dff9f3;
  cursor: pointer;
}

.runtime-curve-selection-nav button:disabled {
  color: #6d7780;
  cursor: not-allowed;
  opacity: 0.48;
}

.runtime-curve-selection-nav span {
  color: #aeb8c1;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.runtime-curve-nav-icon {
  width: 13px;
  height: 13px;
}

.runtime-curve-selection-primary {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 0.9fr) minmax(0, 1.6fr);
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid rgba(121, 199, 185, 0.22);
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.09);
}

.resource-monitor-panel:is(
    [data-flow-phase='runtime-result'],
    [data-flow-phase='edit-result-review']
  )
  .runtime-curve-selection-primary {
  padding: 7px 8px;
}

.runtime-curve-selection-primary span,
.runtime-curve-selection-primary strong,
.runtime-curve-selection-primary small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.runtime-curve-selection-primary span {
  color: #9ce0d2;
  font-size: 11px;
  font-weight: 700;
}

.runtime-curve-selection-primary strong {
  color: #ffffff;
  font-size: 16px;
  font-variant-numeric: tabular-nums;
}

.runtime-curve-selection-primary small {
  color: #d2dae1;
  font-size: 12px;
  font-weight: 700;
}

.runtime-curve-selection-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.runtime-curve-selection-row {
  min-width: 0;
  padding: 6px 7px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.045);
}

.resource-monitor-panel:is(
    [data-flow-phase='runtime-result'],
    [data-flow-phase='edit-result-review']
  )
  .runtime-curve-selection-row {
  padding: 5px 6px;
}

.runtime-curve-selection-row span {
  display: block;
  margin-bottom: 3px;
  color: #8f9aa3;
  font-size: 10px;
}

.runtime-curve-selection-row strong {
  display: block;
  min-width: 0;
  overflow-wrap: anywhere;
  color: #dff9f3;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.runtime-curve-legend {
  display: grid;
  gap: 5px;
}

.runtime-curve-legend-row {
  display: grid;
  grid-template-columns: 9px minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  min-width: 0;
  color: #c8cdd3;
  font-size: 12px;
}

.runtime-curve-legend-row i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.runtime-curve-legend-row span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.runtime-curve-legend-row strong {
  color: #ffffff;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.resource-list {
  margin: 0 14px 14px;
}

.resource-row {
  display: grid;
  grid-template-columns: 72px minmax(60px, 1fr) auto;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  height: 36px;
  margin: 3px 0;
  padding: 7px 10px;
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.1);
  font-size: 12px;
}

.time {
  color: #8f9aa3;
  font-variant-numeric: tabular-nums;
}

.resource {
  color: #79c7b9;
  font-weight: 700;
}

.resource-row strong {
  color: #ffffff;
}

.empty-state {
  margin: 0;
  padding: 0 14px 16px;
  color: #8f9aa3;
  font-size: 12px;
}

@media (max-width: 760px) {
  .runtime-state-grid,
  .runtime-curve-selection-primary,
  .runtime-curve-selection-grid {
    grid-template-columns: 1fr;
  }

  .runtime-energy-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 3px;
  }

  .runtime-curve-selection-heading {
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
  }

  .runtime-curve-selection-heading strong,
  .runtime-curve-selection-heading small {
    white-space: normal;
  }

  .runtime-curve-action-focus {
    width: 100%;
  }

  .runtime-curve-selection-nav {
    grid-template-columns: 28px minmax(0, 1fr) 28px;
  }

  .runtime-curve-selection-nav span {
    text-align: center;
    white-space: normal;
  }

  .runtime-curve-legend-row {
    grid-template-columns: 9px minmax(0, 1fr);
  }

  .runtime-curve-legend-row strong {
    grid-column: 2;
    white-space: normal;
  }
}
</style>
