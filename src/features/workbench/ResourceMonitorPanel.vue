<template>
  <section class="panel resource-monitor-panel">
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
              v-if="series.chartPoints.length > 1"
              class="runtime-curve-line"
              :points="formatRuntimeCurvePolyline(series.chartPoints)"
              :style="{ stroke: series.color }"
              :data-series-key="series.key"
              :data-track-key="series.trackKey"
              :data-curve-mode="runtimeCurveMode"
              data-testid="workbench-runtime-resource-chart-line"
            />
            <circle
              v-for="point in series.chartPoints"
              :key="point.statePointId"
              class="runtime-curve-point"
              :class="{
                selected: point.statePointId === selectedStateCurvePointId,
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
              :data-selected="
                point.statePointId === selectedStateCurvePointId
                  ? 'true'
                  : 'false'
              "
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

    <ol v-if="resourceTimeline.length" class="resource-list">
      <li
        v-for="entry in resourceTimeline"
        :key="`${entry.actionId}-${entry.resource}-${entry.timeMs}`"
      >
        <span class="time">{{ entry.timeMs }}ms</span>
        <span class="resource">{{ entry.resource.toUpperCase() }}</span>
        <strong>{{ formatSigned(entry.change) }}</strong>
      </li>
    </ol>
    <p v-else class="empty-state" data-testid="workbench-resource-empty">
      暂无资源事件
    </p>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { TrendCharts } from '@element-plus/icons-vue';
import { createRuntimeStateCurvePointId } from './stateCurvePointIdentity';

const RUNTIME_CURVE_CHART_WIDTH = 320;
const RUNTIME_CURVE_CHART_HEIGHT = 132;
const RUNTIME_CURVE_CHART_PADDING_X = 18;
const RUNTIME_CURVE_CHART_PADDING_Y = 14;
const RUNTIME_CURVE_COLORS = {
  enemyHpDamage: '#ef767a',
  enemyToughnessDamage: '#e8c36a',
  selfEnergyChange: '#79c7b9',
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
});
const emit = defineEmits(['select-runtime-state-point']);
const runtimeCurveMode = ref('delta');

const resourceTotals = computed(() => {
  return props.resourceTimeline.reduce((totals, entry) => {
    totals[entry.resource] = (totals[entry.resource] ?? 0) + entry.change;
    return totals;
  }, {});
});

const runtimeSummary = computed(() => props.runtimeProjection?.summary ?? {});

const runtimeEnemyState = computed(
  () => props.runtimeProjection?.enemyStateCurve ?? {}
);

const runtimeEnemyHpMetric = computed(
  () => runtimeEnemyState.value.stateMetrics?.hp ?? null
);

const runtimeEnemyToughnessMetric = computed(
  () => runtimeEnemyState.value.stateMetrics?.toughness ?? null
);

const runtimeActorEnergyRows = computed(
  () => props.runtimeProjection?.selfEnergyCurveByActor ?? []
);

const runtimeCurveSourceSeries = computed(() =>
  createRuntimeCurveSourceSeries(props.runtimeProjection)
);

const runtimeCurveDomain = computed(() =>
  createRuntimeCurveDomain(runtimeCurveSourceSeries.value, runtimeCurveMode.value)
);

const runtimeCurveSeries = computed(() =>
  runtimeCurveSourceSeries.value.map(series =>
    layoutRuntimeCurveSeries(
      series,
      runtimeCurveDomain.value,
      runtimeCurveMode.value
    )
  )
);

const runtimeCurveZeroY = computed(() =>
  scaleRuntimeCurveValue(0, runtimeCurveDomain.value)
);

function formatSigned(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? '+' : ''}${number}`;
}

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString('zh-CN');
}

function formatRuntimeStateMetric(metric) {
  const stateLabel = metric?.stateLabel ?? '当前';
  const value = strictNumberOrNull(metric?.currentValue);
  if (Number.isFinite(value)) {
    return `${stateLabel} ${formatNumber(value)}`;
  }
  return `${stateLabel}待确认`;
}

function formatRuntimeActorEnergyState(actor) {
  return `${formatRuntimeStateMetric(actor.stateMetric)} · ${actor.pointCount}点`;
}

function createRuntimeCurveSourceSeries(runtimeProjection) {
  if (!runtimeProjection) {
    return [];
  }

  return [
    createRuntimeEnemyCurveSeries({
      key: 'enemy-hp',
      trackKey: 'enemyHpDamage',
      label: '敌人 HP',
      color: RUNTIME_CURVE_COLORS.enemyHpDamage,
      valueField: 'hpDelta',
      points: runtimeProjection.enemyStateCurve?.points ?? [],
      stateMetric: runtimeProjection.enemyStateCurve?.stateMetrics?.hp,
    }),
    createRuntimeEnemyCurveSeries({
      key: 'enemy-toughness',
      trackKey: 'enemyToughnessDamage',
      label: '敌人韧性',
      color: RUNTIME_CURVE_COLORS.enemyToughnessDamage,
      valueField: 'toughnessDelta',
      points: runtimeProjection.enemyStateCurve?.points ?? [],
      stateMetric:
        runtimeProjection.enemyStateCurve?.stateMetrics?.toughness,
    }),
    ...(runtimeProjection.selfEnergyCurveByActor ?? []).map((actor, index) =>
      createRuntimeEnergyCurveSeries(actor, index)
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
}) {
  return createRuntimeCurveSeries({
    key,
    trackKey,
    label,
    color,
    points: points.filter(point => point.trackKey === trackKey),
    valueField,
    stateMetric,
  });
}

function createRuntimeEnergyCurveSeries(actor, index) {
  return createRuntimeCurveSeries({
    key: `self-energy-${actor.actorId ?? index}`,
    trackKey: 'selfEnergyChange',
    actorId: actor.actorId,
    label: `${actor.actorName ?? actor.actorId ?? '角色'} SP`,
    color: index === 0 ? RUNTIME_CURVE_COLORS.selfEnergyChange : '#8db2ff',
    points: actor.points ?? [],
    valueField: 'energyDelta',
    stateMetric: actor.stateMetric,
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
}) {
  let cumulative = 0;
  const curvePoints = [...(points ?? [])]
    .sort(compareRuntimeCurvePoints)
    .map((point, index) => {
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
        statePointId: createRuntimeStateCurvePointId(point, point),
        frameIndex: numberOrNull(point.frameIndex) ?? 0,
        frameLabel: point.frameLabel ?? `${numberOrNull(point.timeMs) ?? 0}ms`,
        sequenceIndex: point.sequenceIndex ?? index,
      };
    });
  const finalPoint = curvePoints[curvePoints.length - 1] ?? null;

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
    sourcePointCount: curvePoints.length,
    pointCount: curvePoints.length,
    finalValue: cumulative,
    finalStateValue: finalPoint?.stateValue ?? stateMetric?.currentValue ?? null,
  };
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
    getRuntimeCurvePlottablePoints(series, curveMode)
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

function layoutRuntimeCurveSeries(series, domain, curveMode) {
  const plottablePoints = getRuntimeCurvePlottablePoints(series, curveMode);
  return {
    ...series,
    pointCount: plottablePoints.length,
    chartPoints: plottablePoints.map(point => ({
      ...point,
      x: scaleRuntimeCurveFrame(point.frameIndex, domain),
      y: scaleRuntimeCurveValue(point.plotValue, domain),
    })),
  };
}

function getRuntimeCurvePlottablePoints(series, curveMode) {
  return (series.points ?? [])
    .map(point => ({
      ...point,
      plotValue:
        curveMode === 'state'
          ? strictNumberOrNull(point.stateValue)
          : numberOrZero(point.cumulative),
    }))
    .filter(point => Number.isFinite(point.plotValue));
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
    const overrunText =
      overrun > 0 ? ` / 溢出 ${formatNumber(overrun)}` : '';
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

function formatBaselineStatus(status) {
  if (status === 'baseline-derived-from-scenario-enemy-max-hp') {
    return '基线:敌人面板';
  }
  if (status === 'baseline-derived-from-scenario-actor-self-energy') {
    return '基线:角色状态';
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
  return status ?? '';
}

function selectRuntimeCurvePoint(point) {
  if (!point?.statePointId) {
    return;
  }
  emit('select-runtime-state-point', point.statePointId);
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

.runtime-resource-monitor {
  display: grid;
  gap: 10px;
  margin: 0 14px 14px;
  padding: 12px;
  border: 1px solid rgba(121, 199, 185, 0.18);
  border-radius: 6px;
  background: rgba(121, 199, 185, 0.07);
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
  display: grid;
  gap: 8px;
  max-height: 180px;
  margin: 0;
  padding: 0 14px 14px;
  overflow: auto;
  list-style: none;
}

li {
  display: grid;
  grid-template-columns: 72px minmax(60px, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
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

li strong {
  color: #ffffff;
}

.empty-state {
  margin: 0;
  padding: 0 14px 16px;
  color: #8f9aa3;
  font-size: 12px;
}
</style>
