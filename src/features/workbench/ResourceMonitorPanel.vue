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
        </div>
        <div class="runtime-state-cell">
          <span>敌人韧性</span>
          <strong data-testid="workbench-runtime-enemy-toughness-delta">
            {{ formatNumber(runtimeEnemyState.toughnessDelta) }}
          </strong>
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
          <small>{{ actor.pointCount }}点</small>
        </div>
      </div>

      <div
        v-if="runtimeCurveSeries.length"
        class="runtime-curve-panel"
        data-testid="workbench-runtime-resource-chart"
      >
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
              :data-value="point.cumulative"
              :data-delta="point.delta"
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
import { computed } from 'vue';
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

const runtimeActorEnergyRows = computed(
  () => props.runtimeProjection?.selfEnergyCurveByActor ?? []
);

const runtimeCurveSourceSeries = computed(() =>
  createRuntimeCurveSourceSeries(props.runtimeProjection)
);

const runtimeCurveDomain = computed(() =>
  createRuntimeCurveDomain(runtimeCurveSourceSeries.value)
);

const runtimeCurveSeries = computed(() =>
  runtimeCurveSourceSeries.value.map(series =>
    layoutRuntimeCurveSeries(series, runtimeCurveDomain.value)
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
    }),
    createRuntimeEnemyCurveSeries({
      key: 'enemy-toughness',
      trackKey: 'enemyToughnessDamage',
      label: '敌人韧性',
      color: RUNTIME_CURVE_COLORS.enemyToughnessDamage,
      valueField: 'toughnessDelta',
      points: runtimeProjection.enemyStateCurve?.points ?? [],
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
}) {
  return createRuntimeCurveSeries({
    key,
    trackKey,
    label,
    color,
    points: points.filter(point => point.trackKey === trackKey),
    valueField,
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
}) {
  let cumulative = 0;
  const curvePoints = [...(points ?? [])]
    .sort(compareRuntimeCurvePoints)
    .map((point, index) => {
      const delta = numberOrZero(point[valueField] ?? point.delta);
      cumulative = roundCurveValue(cumulative + delta);
      return {
        ...point,
        delta,
        cumulative,
        statePointId: createRuntimeStateCurvePointId(point, point),
        frameIndex: numberOrNull(point.frameIndex) ?? 0,
        frameLabel: point.frameLabel ?? `${numberOrNull(point.timeMs) ?? 0}ms`,
        sequenceIndex: point.sequenceIndex ?? index,
      };
    });

  return {
    key,
    trackKey,
    actorId,
    label,
    color,
    points: curvePoints,
    pointCount: curvePoints.length,
    finalValue: cumulative,
  };
}

function createRuntimeCurveDomain(seriesRows) {
  const points = seriesRows.flatMap(series => series.points ?? []);
  const frames = points.map(point => numberOrNull(point.frameIndex) ?? 0);
  const values = [0, ...points.map(point => numberOrZero(point.cumulative))];
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

function layoutRuntimeCurveSeries(series, domain) {
  return {
    ...series,
    chartPoints: series.points.map(point => ({
      ...point,
      x: scaleRuntimeCurveFrame(point.frameIndex, domain),
      y: scaleRuntimeCurveValue(point.cumulative, domain),
    })),
  };
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
  if (series.pointCount === 0) {
    return '0点';
  }
  return `${formatSigned(series.finalValue)} / ${series.pointCount}点`;
}

function formatRuntimeCurvePointTitle(series, point) {
  return `${series.label} ${point.frameLabel}: ${formatSigned(point.delta)} -> ${formatSigned(point.cumulative)}`;
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
  color: #ffffff;
  font-size: 15px;
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
