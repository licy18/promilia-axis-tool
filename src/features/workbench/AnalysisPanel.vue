<template>
  <section class="panel analysis-panel">
    <div class="panel-title">
      <TrendCharts class="panel-icon" />
      <h2>分析</h2>
    </div>

    <div class="metric-grid">
      <div class="metric">
        <span>总原始伤害</span>
        <strong>{{ formatNumber(summary.totalRawDamage) }}</strong>
      </div>
      <div class="metric">
        <span>公式</span>
        <strong>{{ summary.formulaVersion }}</strong>
      </div>
      <div class="metric">
        <span>置信度</span>
        <strong>{{ summary.confidence }}</strong>
      </div>
      <div class="metric">
        <span>命中投影</span>
        <strong>{{ summary.projectedHitCount }}</strong>
      </div>
    </div>

    <div class="damage-list">
      <div
        v-for="damage in damageTimeline"
        :key="damage.actionId"
        class="damage-row"
      >
        <div class="damage-row-main">
          <span>{{ damage.segmentLabel }}</span>
          <small>{{ formatDamageFormula(damage) }}</small>
        </div>
        <strong>{{ formatNumber(damage.rawDamage) }}</strong>
      </div>
    </div>

    <div
      class="action-result-list"
      data-testid="workbench-action-result-sources"
    >
      <div class="diagnostic-heading source-heading">
        <span>三值来源</span>
        <strong>{{ actionResultTimeline.length }}</strong>
      </div>
      <p
        v-if="
          formatThreeValueCurveFrameworkSummary(
            summary.threeValueCurveFrameworkSummary
          )
        "
        class="diagnostic-empty formula-pattern-summary"
        data-testid="workbench-three-value-curve-framework-summary"
      >
        {{
          formatThreeValueCurveFrameworkSummary(
            summary.threeValueCurveFrameworkSummary
          )
        }}
      </p>
      <p
        v-if="
          formatFormulaCandidatePatternSummary(
            summary.formulaCandidatePatternSummary
          )
        "
        class="diagnostic-empty formula-pattern-summary"
        data-testid="workbench-formula-pattern-summary"
      >
        {{
          formatFormulaCandidatePatternSummary(
            summary.formulaCandidatePatternSummary
          )
        }}
      </p>
      <p
        v-if="
          formatFormulaExecutionMatrixSummary(
            summary.formulaExecutionMatrixSummary
          )
        "
        class="diagnostic-empty formula-pattern-summary"
        data-testid="workbench-formula-execution-matrix-summary"
      >
        {{
          formatFormulaExecutionMatrixSummary(
            summary.formulaExecutionMatrixSummary
          )
        }}
      </p>
      <div
        v-for="entry in actionResultTimeline"
        :key="entry.actionId"
        class="action-result-row"
        data-testid="workbench-action-result-source-row"
      >
        <div class="damage-row-main">
          <span>{{ entry.actionName }}</span>
          <small>{{ formatActionResultSource(entry) }}</small>
          <small
            v-if="formatFormulaSlotAlignment(entry.hpDamage?.sourceEvidence)"
          >
            {{ formatFormulaSlotAlignment(entry.hpDamage?.sourceEvidence) }}
          </small>
          <small
            v-if="formatFormulaFunctionSummary(entry.hpDamage?.sourceEvidence)"
          >
            {{ formatFormulaFunctionSummary(entry.hpDamage?.sourceEvidence) }}
          </small>
          <small
            v-if="formatFormulaCandidatePreview(entry.hpDamage?.sourceEvidence)"
          >
            {{ formatFormulaCandidatePreview(entry.hpDamage?.sourceEvidence) }}
          </small>
          <small
            v-if="
              formatFormulaCombinationPreview(entry.hpDamage?.sourceEvidence)
            "
          >
            {{
              formatFormulaCombinationPreview(entry.hpDamage?.sourceEvidence)
            }}
          </small>
          <small
            v-if="formatFormulaExecutionMatrix(entry.hpDamage?.sourceEvidence)"
          >
            {{ formatFormulaExecutionMatrix(entry.hpDamage?.sourceEvidence) }}
          </small>
          <small v-if="formatHitCandidateSummary(entry)">
            {{ formatHitCandidateSummary(entry) }}
          </small>
        </div>
        <strong>{{ formatActionResultValues(entry) }}</strong>
      </div>
    </div>

    <div
      v-if="candidateSeriesItems.length"
      class="candidate-series-list"
      data-testid="workbench-candidate-value-series"
    >
      <div class="diagnostic-heading source-heading">
        <span>候选曲线</span>
        <strong>{{ candidateValuePointCount }}</strong>
      </div>
      <div
        v-for="series in candidateSeriesItems"
        :key="series.key"
        class="candidate-series-row"
        data-testid="workbench-candidate-value-series-row"
        :data-series-key="series.key"
      >
        <div class="candidate-series-main">
          <span>{{ series.label }}</span>
          <small>{{ formatCandidateSeries(series) }}</small>
        </div>
        <svg viewBox="0 0 112 32" class="candidate-series-sparkline">
          <polyline
            :points="formatCandidateSeriesPolyline(series)"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle
            v-for="point in getCandidateSeriesSvgPoints(series)"
            :key="point.key"
            :cx="point.x"
            :cy="point.y"
            r="2.4"
            fill="currentColor"
          />
        </svg>
      </div>
    </div>

    <div
      v-if="candidateChartSeriesItems.length"
      class="candidate-chart"
      data-testid="workbench-candidate-value-chart"
    >
      <div class="diagnostic-heading source-heading">
        <span>候选时间曲线</span>
        <strong>{{ candidateChartPointCount }}</strong>
      </div>
      <small class="candidate-chart-meta">
        {{ formatCandidateChartMeta(candidateChart) }}
      </small>
      <div class="candidate-chart-canvas">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <line
            v-for="line in candidateChartGridLines"
            :key="line"
            x1="0"
            x2="100"
            :y1="line"
            :y2="line"
            class="candidate-chart-gridline"
          />
          <polyline
            v-for="series in candidateChartSeriesItems"
            :key="series.key"
            :points="series.polylinePoints"
            fill="none"
            :stroke="series.color"
            stroke-width="2.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
          />
          <g
            v-for="series in candidateChartSeriesItems"
            :key="`${series.key}-points`"
          >
            <circle
              v-for="(point, pointIndex) in series.points"
              :key="createCandidateChartPointKey(series, point, pointIndex)"
              :cx="point.xPercent"
              :cy="point.yPercent"
              r="2.4"
              :fill="series.color"
              vector-effect="non-scaling-stroke"
            >
              <title>{{ formatCandidateChartPointTitle(series, point) }}</title>
            </circle>
          </g>
        </svg>
      </div>
      <div class="candidate-chart-legend">
        <div
          v-for="series in candidateChartSeriesItems"
          :key="`${series.key}-legend`"
          class="candidate-chart-legend-row"
          data-testid="workbench-candidate-value-chart-row"
          :data-series-key="series.key"
        >
          <i :style="{ background: series.color }" />
          <span>{{ series.label }}</span>
          <small>{{ formatCandidateChartSeries(series) }}</small>
        </div>
      </div>
    </div>

    <div
      v-if="stateCurveTotalPointCount > 0"
      class="state-curve-list"
      data-testid="workbench-state-curves"
    >
      <div class="diagnostic-heading source-heading">
        <span>状态曲线</span>
        <strong>{{ stateCurveVisiblePointCount }}</strong>
      </div>
      <div class="state-curve-layer-controls">
        <label
          v-for="layer in stateCurveLayerOptions"
          :key="layer.key"
          class="state-curve-layer-toggle"
          :class="{ 'has-points': layer.pointCount > 0 }"
          :data-point-count="layer.pointCount"
        >
          <input
            :checked="isStateCurveLayerVisible(layer.key)"
            type="checkbox"
            :data-layer-key="layer.key"
            :data-point-count="layer.pointCount"
            :data-track-count="layer.trackCount"
            data-testid="workbench-state-curve-layer-toggle"
            @change="
              setStateCurveLayerVisible(layer.key, $event.target.checked)
            "
          />
          <span>{{ layer.label }} {{ layer.pointCount }}</span>
        </label>
      </div>
      <div class="state-curve-track-controls">
        <label
          v-for="track in stateCurveTrackOptions"
          :key="track.trackKey"
          class="state-curve-track-toggle"
          :class="{ 'has-points': track.pointCount > 0 }"
          :data-track-key="track.trackKey"
          :data-point-count="track.pointCount"
        >
          <input
            :checked="isStateCurveTrackVisible(track.trackKey)"
            type="checkbox"
            :data-track-key="track.trackKey"
            :data-point-count="track.pointCount"
            data-testid="workbench-state-curve-track-toggle"
            @change="
              setStateCurveTrackVisible(track.trackKey, $event.target.checked)
            "
          />
          <span>{{ track.label }} {{ track.pointCount }}</span>
        </label>
      </div>
      <div
        v-for="track in stateCurveTrackRows"
        :key="track.trackKey"
        class="state-curve-row"
        :data-track-key="track.trackKey"
        data-testid="workbench-state-curve-row"
      >
        <div class="state-curve-main">
          <span>{{ track.label }}</span>
          <small>{{ formatStateCurveTrackSummary(track) }}</small>
        </div>
        <div class="state-curve-layers">
          <span
            v-for="layer in track.visibleLayers"
            :key="`${track.trackKey}-${layer.key}`"
            class="state-curve-layer-pill"
            :data-layer-key="layer.key"
            data-testid="workbench-state-curve-layer-pill"
          >
            {{ formatStateCurveLayer(layer) }}
          </span>
        </div>
        <ol
          v-if="track.visiblePointRows.length"
          class="state-curve-points"
          data-testid="workbench-state-curve-points"
        >
          <li
            v-for="point in track.visiblePointRows"
            :key="point.rowKey"
            class="state-curve-point-row"
            :class="{
              selected: point.statePointId === selectedStateCurvePointId,
            }"
            :data-layer-key="point.layerKey"
            :data-action-id="point.actionId"
            :data-frame-label="formatStateCurvePointFrame(point)"
            :data-state-point-id="point.statePointId"
            data-testid="workbench-state-curve-point"
            role="button"
            tabindex="0"
            @click="selectStateCurvePoint(point)"
            @keydown.enter.prevent="selectStateCurvePoint(point)"
            @keydown.space.prevent="selectStateCurvePoint(point)"
          >
            <span class="state-curve-point-time">
              {{ formatStateCurvePointFrame(point) }}
            </span>
            <strong>{{ formatStateCurvePointValue(point) }}</strong>
            <small>{{ formatStateCurvePointSource(point) }}</small>
          </li>
        </ol>
      </div>
    </div>

    <div class="timeline-diagnostics">
      <div class="diagnostic-heading">
        <span>时间轴诊断</span>
        <strong data-testid="workbench-overlap-count">{{
          overlapCount
        }}</strong>
      </div>
      <p
        v-if="overlapItems.length === 0"
        class="diagnostic-empty"
        data-testid="workbench-overlap-empty"
      >
        暂无轨道重叠
      </p>
      <ul v-else class="overlap-list">
        <li
          v-for="item in overlapItems"
          :key="item.id"
          data-testid="workbench-overlap-item"
        >
          <span>{{ item.laneName }}</span>
          <strong>{{ item.actionNames.join(' / ') }}</strong>
          <small>{{ formatOverlapRange(item) }}</small>
        </li>
      </ul>
    </div>

    <div class="insertion-diagnostics">
      <div class="diagnostic-heading neutral">
        <span>插入提示</span>
        <strong data-testid="workbench-insert-delay-count">{{
          autoDelayedCount
        }}</strong>
      </div>
      <p
        v-if="autoDelayedItems.length === 0"
        class="diagnostic-empty"
        data-testid="workbench-insert-delay-empty"
      >
        暂无自动推迟
      </p>
      <ul v-else class="insertion-list">
        <li
          v-for="item in autoDelayedItems"
          :key="item.id"
          data-testid="workbench-insert-delay-item"
        >
          <span>{{ item.laneName }}</span>
          <strong>{{ item.actionName }}</strong>
          <small>{{ formatDelayRange(item) }}</small>
        </li>
      </ul>
    </div>

    <ul class="limitations">
      <li v-for="item in diagnostics.limitations" :key="item">{{ item }}</li>
    </ul>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { TrendCharts } from '@element-plus/icons-vue';
import { createStateCurvePointId } from './stateCurvePointIdentity';

const CANDIDATE_CHART_COLORS = ['#f2b366', '#79c7b9', '#a6b7ff'];
const candidateChartGridLines = [25, 50, 75];
const STATE_CURVE_LAYER_OPTIONS = [
  {
    key: 'applied',
    label: '已用',
  },
  {
    key: 'candidate',
    label: '候选',
  },
  {
    key: 'sampled',
    label: '采样',
  },
  {
    key: 'placeholder',
    label: '占位',
  },
];

const props = defineProps({
  summary: {
    type: Object,
    required: true,
  },
  diagnostics: {
    type: Object,
    required: true,
  },
  damageTimeline: {
    type: Array,
    required: true,
  },
  actionResultTimeline: {
    type: Array,
    default: () => [],
  },
  candidateValueSeries: {
    type: Object,
    default: () => ({
      summary: {
        pointCount: 0,
      },
      series: [],
    }),
  },
  threeValueCurveFramework: {
    type: Object,
    default: () => ({
      stateCurves: {
        summary: {
          pointCount: 0,
        },
        tracks: [],
      },
    }),
  },
  selectedStateCurvePointId: {
    type: String,
    default: '',
  },
  stateCurveLayerFilters: {
    type: Object,
    default: () => ({
      applied: true,
      candidate: true,
      sampled: false,
      placeholder: false,
    }),
  },
  stateCurveTrackFilters: {
    type: Object,
    default: () => ({}),
  },
  insertionDiagnostics: {
    type: Object,
    default: () => ({
      autoDelayedCount: 0,
      autoDelayedItems: [],
    }),
  },
  timelineDiagnostics: {
    type: Object,
    default: () => ({
      overlapCount: 0,
      overlaps: [],
    }),
  },
});

const emit = defineEmits([
  'select-state-curve-point',
  'update-state-curve-layer-filter',
  'update-state-curve-track-filter',
]);

const DEFAULT_STATE_CURVE_LAYER_FILTERS = {
  applied: true,
  candidate: true,
  sampled: false,
  placeholder: false,
};
const overlapItems = computed(() => props.timelineDiagnostics?.overlaps ?? []);
const overlapCount = computed(
  () => props.timelineDiagnostics?.overlapCount ?? overlapItems.value.length
);
const autoDelayedItems = computed(
  () => props.insertionDiagnostics?.autoDelayedItems ?? []
);
const autoDelayedCount = computed(
  () =>
    props.insertionDiagnostics?.autoDelayedCount ??
    autoDelayedItems.value.length
);
const candidateSeriesItems = computed(() =>
  (props.candidateValueSeries?.series ?? []).filter(
    series => series.pointCount > 0
  )
);
const candidateValuePointCount = computed(
  () =>
    props.candidateValueSeries?.summary?.pointCount ??
    candidateSeriesItems.value.reduce(
      (sum, series) => sum + (series.pointCount ?? 0),
      0
    )
);
const candidateChart = computed(
  () =>
    props.candidateValueSeries?.chart ?? {
      summary: {
        pointCount: 0,
        displayFrameAdjustmentCount: 0,
      },
      series: [],
    }
);
const candidateChartSeriesItems = computed(() =>
  (candidateChart.value?.series ?? [])
    .filter(series => series.pointCount > 0)
    .map((series, index) => ({
      ...series,
      color: CANDIDATE_CHART_COLORS[index % CANDIDATE_CHART_COLORS.length],
    }))
);
const candidateChartPointCount = computed(
  () =>
    candidateChart.value?.summary?.pointCount ??
    candidateChartSeriesItems.value.reduce(
      (sum, series) => sum + (series.pointCount ?? 0),
      0
    )
);
const stateCurves = computed(
  () =>
    props.threeValueCurveFramework?.stateCurves ?? {
      summary: {
        pointCount: 0,
      },
      tracks: [],
    }
);
const stateCurveTotalPointCount = computed(
  () =>
    stateCurves.value?.summary?.pointCount ??
    (stateCurves.value?.tracks ?? []).reduce(
      (sum, track) => sum + (track.pointCount ?? 0),
      0
    )
);
const stateCurveLayerOptions = computed(() =>
  STATE_CURVE_LAYER_OPTIONS.map(layer => {
    const matchingLayers = (stateCurves.value?.tracks ?? []).flatMap(track =>
      (track.layers ?? []).filter(item => item.key === layer.key)
    );
    const pointCount = matchingLayers.reduce(
      (sum, item) => sum + (item.pointCount ?? 0),
      0
    );
    const trackCount = matchingLayers.filter(
      item => (item.pointCount ?? 0) > 0
    ).length;
    return {
      ...layer,
      pointCount,
      trackCount,
    };
  })
);
const stateCurveTrackOptions = computed(() =>
  (stateCurves.value?.tracks ?? [])
    .filter(track => (track.pointCount ?? 0) > 0)
    .map(track => ({
      trackKey: track.trackKey,
      label: track.label,
      pointCount: track.pointCount ?? 0,
      valueUnit: track.valueUnit,
    }))
);
const activeStateCurveLayerKeys = computed(() =>
  STATE_CURVE_LAYER_OPTIONS.filter(
    layer => effectiveStateCurveLayerFilters.value[layer.key]
  ).map(layer => layer.key)
);
const effectiveStateCurveLayerFilters = computed(() => ({
  ...DEFAULT_STATE_CURVE_LAYER_FILTERS,
  ...(props.stateCurveLayerFilters ?? {}),
}));
const effectiveStateCurveTrackFilters = computed(
  () => props.stateCurveTrackFilters ?? {}
);
const stateCurveTrackRows = computed(() => {
  const activeLayers = new Set(activeStateCurveLayerKeys.value);
  return (stateCurves.value?.tracks ?? [])
    .filter(track => (track.pointCount ?? 0) > 0)
    .filter(track => isStateCurveTrackVisible(track.trackKey))
    .map(track => {
      const visibleLayers = (track.layers ?? []).filter(
        layer => activeLayers.has(layer.key) && (layer.pointCount ?? 0) > 0
      );
      return {
        ...track,
        visibleLayers,
        visiblePointRows: createStateCurveVisiblePointRows(
          track,
          visibleLayers
        ),
      };
    })
    .filter(track => track.visibleLayers.length > 0);
});
const stateCurveVisiblePointCount = computed(() =>
  stateCurveTrackRows.value.reduce(
    (sum, track) =>
      sum +
      track.visibleLayers.reduce(
        (trackSum, layer) => trackSum + (layer.pointCount ?? 0),
        0
      ),
    0
  )
);

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString('zh-CN');
}

function formatDamageFormula(damage) {
  const layers = damage.formulaBreakdown?.layers;
  if (!layers) {
    return `攻击 ${formatNumber(damage.attack)} × 倍率 ${formatMultiplier(damage.multiplier)}`;
  }

  const attack = formatNumber(layers.baseAttack?.value);
  const multiplier =
    layers.actionMultiplier?.rawValue ??
    formatMultiplier(layers.actionMultiplier?.value);
  const pending = damage.formulaBreakdown.unappliedLayerKeys?.length
    ? ' / 防御、抗性、暴击未应用'
    : '';
  return `攻击 ${attack} × 倍率 ${multiplier}${pending}`;
}

function formatMultiplier(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return '-';
  }
  return `${number.toFixed(2)}x`;
}

function formatActionResultValues(entry) {
  return [
    `伤害 ${formatNumber(entry.hpDamage?.value)}`,
    `韧性 ${formatNumber(entry.toughnessDamage?.value)}`,
    `能量 ${formatSignedNumber(entry.selfEnergyChange?.value)}`,
  ].join(' · ');
}

function formatActionResultSource(entry) {
  const hp = formatChainSource(entry.hpDamage?.sourceEvidence);
  const toughness = formatChainSource(entry.toughnessDamage?.sourceEvidence);
  const energy = formatChainSource(entry.selfEnergyChange?.sourceEvidence);
  return `HP ${hp} / 削韧 ${toughness} / 充能 ${energy}`;
}

function formatChainSource(sourceEvidence) {
  if (!sourceEvidence) {
    return '无候选';
  }
  const runtimeProbe = sourceEvidence.selfEnergyRuntimeFormulaProbe;
  const probeText =
    runtimeProbe?.candidateCount > 0
      ? ` · 充能探针 ${runtimeProbe.gateOpenCount}/${runtimeProbe.candidateCount}`
      : '';
  const sourceToArgsProbe = runtimeProbe?.sourceToArgsProbe;
  const sourceToArgsProbeText =
    sourceToArgsProbe?.candidateCount > 0
      ? ` · 构造探针 ${sourceToArgsProbe.gateOpenCount}/${sourceToArgsProbe.candidateCount}`
      : '';
  const modifierProbe = runtimeProbe?.runtimeModifierProbe;
  const modifierProbeText =
    modifierProbe?.candidateCount > 0
      ? ` · 修正探针 ${modifierProbe.gateOpenCount}/${modifierProbe.candidateCount}`
      : '';
  const ownerShareProbe = runtimeProbe?.ownerShareIntervalProbe;
  const ownerShareProbeText =
    ownerShareProbe?.candidateCount > 0
      ? ` · 归属探针 ${ownerShareProbe.gateOpenCount}/${ownerShareProbe.candidateCount}`
      : '';
  const samplingProbe = runtimeProbe?.runtimeSamplingProbe;
  const samplingProbeText =
    samplingProbe?.candidateCount > 0
      ? ` · 采样契约 ${samplingProbe.gateOpenCount}/${samplingProbe.candidateCount}`
      : '';
  const samplingImport = samplingProbe?.sampleImportSummary;
  const samplingImportText =
    samplingImport?.importedRuntimeSampleCount > 0
      ? ` · 样本验证 ${samplingImport.validatedSampleCount}/${samplingProbe.candidateCount}`
      : '';
  if (sourceEvidence.candidateCount > 0) {
    return `${sourceEvidence.candidateCount} 个候选 ${formatElementIds(sourceEvidence.matchedElementConfigIds)}${probeText}${sourceToArgsProbeText}${modifierProbeText}${ownerShareProbeText}${samplingProbeText}${samplingImportText}`;
  }
  if (sourceEvidence.logicElementIds?.length > 0) {
    return `未桥接 ${formatElementIds(sourceEvidence.logicElementIds)}`;
  }
  return '未映射';
}

function formatFormulaSlotAlignment(sourceEvidence) {
  const summaries = sourceEvidence?.formulaSlotAlignmentSummary ?? [];
  if (summaries.length === 0) {
    return '';
  }

  return `公式候选 ${summaries.map(formatFormulaSlotSummary).join(' / ')}`;
}

function formatFormulaSlotSummary(summary) {
  const variable = summary.variable || `#${summary.id}`;
  if (summary.relationStatus === 'level-scaling-override-candidate') {
    return `${variable} 覆盖候选 ${formatNumber(summary.firstLevelValue)}-${formatNumber(summary.lastLevelValue)}`;
  }
  if (summary.relationStatus === 'constant-direct-slot-match') {
    return `${variable} 常量匹配 ${formatNumber(summary.formulaParamValue)}`;
  }
  return `${variable} ${summary.relationStatus}`;
}

function formatFormulaFunctionSummary(sourceEvidence) {
  const summaries = sourceEvidence?.formulaFunctionSummary ?? [];
  if (summaries.length === 0) {
    return '';
  }

  return `公式函数候选 ${summaries.map(formatFormulaFunctionRef).join(' / ')}`;
}

function formatFormulaFunctionRef(summary) {
  const label =
    summary.field === 'function_1'
      ? 'f1'
      : summary.field === 'function_2'
        ? 'f2'
        : summary.field;
  const output = trimFormulaParentheses(
    summary.functionOutput ?? `#${summary.functionId}`
  );
  return `${label} ${output}`;
}

function trimFormulaParentheses(value) {
  const text = String(value ?? '').trim();
  const parenthesizedNumerator = text.match(/^\(([^()]+)\)(\/.+)$/);
  if (parenthesizedNumerator) {
    return `${parenthesizedNumerator[1]}${parenthesizedNumerator[2]}`;
  }
  if (text.startsWith('(') && text.endsWith(')')) {
    return text.slice(1, -1);
  }
  return text;
}

function formatFormulaCandidatePreview(sourceEvidence) {
  const previews =
    sourceEvidence?.formulaCandidatePreview?.functionPreviews ?? [];
  const comparable = uniqueFormulaCandidatePreviews(
    previews.filter(
      preview => preview.comparison?.status === 'compared-to-raw-projection'
    )
  );
  if (comparable.length === 0) {
    return '';
  }

  return `候选预览 ${comparable.map(formatFormulaCandidatePreviewItem).join(' / ')}`;
}

function uniqueFormulaCandidatePreviews(previews) {
  const byKey = new Map();
  for (const preview of previews) {
    const key = [
      preview.field,
      preview.functionId,
      preview.currentLevelPreview?.roundedValue,
      preview.comparison?.rawProjectionValue,
    ].join(':');
    if (!byKey.has(key)) {
      byKey.set(key, preview);
    }
  }
  return [...byKey.values()];
}

function formatFormulaCandidatePreviewItem(preview) {
  const label =
    preview.field === 'function_1'
      ? 'f1'
      : preview.field === 'function_2'
        ? 'f2'
        : preview.field;
  const candidateValue =
    preview.currentLevelPreview?.roundedValue ??
    preview.formulaParamPreview?.roundedValue ??
    0;
  const rawValue = preview.comparison?.rawProjectionValue ?? 0;
  const ratio = preview.comparison?.ratioToRawProjection;
  const ratioText = Number.isFinite(ratio)
    ? `，约 ${formatPercent(ratio)}`
    : '';
  return `${label} 等级值 ${formatNumber(candidateValue)} vs raw ${formatNumber(rawValue)}${ratioText}`;
}

function formatFormulaCombinationPreview(sourceEvidence) {
  const previews =
    sourceEvidence?.formulaCandidatePreview?.combinationPreviews ?? [];
  const preferred =
    previews.find(
      preview =>
        preview.strategy === 'function_2-current-level-value-param' &&
        preview.comparison?.status === 'compared-to-raw-projection'
    ) ??
    previews.find(
      preview => preview.comparison?.status === 'compared-to-raw-projection'
    );
  if (!preferred) {
    return '';
  }

  const scale = preferred.comparison?.requiredScaleToRaw;
  const perHitScale = preferred.comparison?.requiredPerHitScaleToRaw;
  const perHitText = Number.isFinite(perHitScale)
    ? ` / 每 hit ×${formatFixed(perHitScale)}`
    : '';
  return `组合诊断 ${formatCombinationLabel(preferred)} 需 ×${formatFixed(scale)} 才接近 raw${perHitText}`;
}

function formatFormulaExecutionMatrix(sourceEvidence) {
  const matrix = sourceEvidence?.formulaExecutionEvidenceMatrix;
  if (!matrix || matrix.rowCount <= 0) {
    return '';
  }

  const rows = matrix.rows ?? [];
  const slotOverrideCount = rows.reduce(
    (sum, row) => sum + (row.slotOverrideCandidates?.length ?? 0),
    0
  );
  const preferredRow = rows.find(row => row.preferredFunctionOrderCandidate);
  const scale = preferredRow?.perHitScaleGap?.requiredScaleToRaw;
  const perHitScale = preferredRow?.perHitScaleGap?.requiredPerHitScaleToRaw;
  const scaleText = Number.isFinite(Number(scale))
    ? ` · 缩放 ×${formatFixed(scale)}`
    : '';
  const perHitText = Number.isFinite(Number(perHitScale))
    ? ` / 每 hit ×${formatFixed(perHitScale)}`
    : '';
  const largeDifferenceCount = matrix.diagnostics?.rowsWithLargeDifference ?? 0;
  const differenceText =
    largeDifferenceCount > 0
      ? ` · 差异 ${largeDifferenceCount}/${matrix.rowCount}`
      : '';

  return `执行矩阵 ${matrix.rowCount} element · function未确认 · A覆盖候选 ${slotOverrideCount}${scaleText}${perHitText}${differenceText}`;
}

function formatHitCandidateSummary(entry) {
  const summary = entry.hitCandidateSummary;
  if (!summary || summary.hitCandidateCount <= 0) {
    return '';
  }

  const frames = (summary.primaryFrames ?? [])
    .slice(0, 5)
    .map(frame => `${Math.round(frame)}f`)
    .join('/');
  const frameText = frames ? ` · 帧 ${frames}` : '';
  const absoluteFrames = (summary.absolutePrimaryFrames ?? [])
    .slice(0, 5)
    .map(formatFrameIndex)
    .join('/');
  const absoluteFrameText = absoluteFrames ? ` · 绝对帧 ${absoluteFrames}` : '';
  const transitionText =
    summary.sequenceTimingTransitionCount > 0
      ? ` · 连段桥 ${summary.sequenceTimingResolvedTransitionCount}/${summary.sequenceTimingTransitionCount}`
      : '';
  const summonTargetText =
    summary.summonTargetMappedHitCandidateCount > 0
      ? ` · 召唤目标 ${summary.summonTargetMappedHitCandidateCount}/${summary.hitCandidateCount}段/${summary.summonTargetDamageElementFieldMappingCount}元素 · ${formatSummonTargetTriggerSummary(summary)}`
      : '';
  return `逐hit候选 ${summary.mappedHitCandidateCount}/${summary.hitCandidateCount}段 · 三值字段 ${summary.damageElementFieldMappingCount}${summonTargetText}${frameText}${absoluteFrameText}${transitionText}`;
}

function formatSummonTargetTriggerSummary(summary) {
  const frames = uniqueDisplayValues(
    summary.summonTargetTriggerFrameCandidates ?? []
  )
    .slice(0, 8)
    .map(frame => `${Math.round(Number(frame))}f`)
    .join('/');
  return frames ? `触发候选 ${frames}` : '触发未确认';
}

function formatCandidateSeries(series) {
  const range = formatValueRange(series.valueMin, series.valueMax);
  return `${series.pointCount}点 · ${range} · ${series.unit}`;
}

function formatValueRange(min, max) {
  if (!Number.isFinite(Number(min)) || !Number.isFinite(Number(max))) {
    return '-';
  }
  if (Number(min) === Number(max)) {
    return formatNumber(min);
  }
  return `${formatNumber(min)}-${formatNumber(max)}`;
}

function formatCandidateSeriesPolyline(series) {
  return getCandidateSeriesSvgPoints(series)
    .map(point => `${point.x},${point.y}`)
    .join(' ');
}

function getCandidateSeriesSvgPoints(series) {
  const points = series.points ?? [];
  if (points.length === 0) {
    return [];
  }

  const min = Number.isFinite(Number(series.valueMin))
    ? Number(series.valueMin)
    : 0;
  const max = Number.isFinite(Number(series.valueMax))
    ? Number(series.valueMax)
    : min;
  const range = Math.max(1, max - min);
  const count = Math.max(1, points.length - 1);

  return points.map((point, index) => {
    const x = 8 + (index / count) * 96;
    const value = Number(point.value);
    const y =
      24 - (((Number.isFinite(value) ? value : min) - min) / range) * 18;
    return {
      key: `${point.actionId}-${point.hitIndex}-${index}`,
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
    };
  });
}

function formatCandidateChartMeta(chart) {
  if (!chart) {
    return '';
  }
  const frameText = formatFrameIndex(chart.frameCount);
  const adjustmentCount = chart.summary?.displayFrameAdjustmentCount ?? 0;
  const adjustmentText =
    adjustmentCount > 0 ? ` · 显示帧调整 ${adjustmentCount}` : '';
  return `${chart.frameRate}fps · ${frameText}${adjustmentText}`;
}

function formatCandidateChartSeries(series) {
  const frameRange = formatFrameRange(series.frameMin, series.frameMax);
  const valueRange = formatValueRange(series.valueMin, series.valueMax);
  return `${frameRange} · ${valueRange} · ${series.unit}`;
}

function formatThreeValueCurveFrameworkSummary(summary) {
  if (!summary || summary.trackCount <= 0) {
    return '';
  }
  const deferredText = summary.detailsDeferred ? ' · 细节后补' : '';
  const stateCurveText =
    summary.stateCurvePointCount > 0
      ? ` · 状态 ${summary.stateCurvePointCount}点`
      : '';
  return `三值框架 ${summary.trackCount}轨 · 曲线 ${summary.candidateTrackCount}条/${summary.chartPointCount}点${stateCurveText}${deferredText}`;
}

function formatStateCurveTrackSummary(track) {
  const visiblePointCount = (track.visibleLayers ?? []).reduce(
    (sum, layer) => sum + (layer.pointCount ?? 0),
    0
  );
  const nonEmptyLayerCount = (track.visibleLayers ?? []).filter(
    layer => (layer.pointCount ?? 0) > 0
  ).length;
  return `${track.valueUnit} · ${nonEmptyLayerCount}/${track.visibleLayers.length}层 · ${visiblePointCount}点`;
}

function formatStateCurveLayer(layer) {
  const label = formatStateCurveLayerLabel(layer.key);
  const deltaRange = formatStateCurveValueRange(layer.deltaMin, layer.deltaMax);
  return `${label} ${layer.pointCount ?? 0}点 Δ${deltaRange} Σ${formatStateCurveNumber(layer.finalCumulative)}`;
}

function formatStateCurveLayerLabel(key) {
  const option = STATE_CURVE_LAYER_OPTIONS.find(layer => layer.key === key);
  return option?.label ?? key;
}

function createStateCurveVisiblePointRows(track, visibleLayers) {
  return visibleLayers
    .flatMap((layer, layerIndex) =>
      (layer.points ?? []).map((point, pointIndex) => ({
        ...point,
        statePointId: createStateCurvePointId({
          trackKey: track.trackKey,
          layerKey: layer.key,
          point,
          pointIndex,
        }),
        rowKey: createStateCurvePointId({
          trackKey: track.trackKey,
          layerKey: layer.key,
          point,
          pointIndex,
        }),
        trackKey: track.trackKey,
        layerKey: layer.key,
        layerLabel: formatStateCurveLayerLabel(layer.key),
        layerIndex,
        pointIndex,
        valueUnit: layer.valueUnit ?? track.valueUnit,
      }))
    )
    .sort(compareStateCurvePointRows);
}

function selectStateCurvePoint(point) {
  emit('select-state-curve-point', point.statePointId);
}

function isStateCurveLayerVisible(layerKey) {
  return Boolean(effectiveStateCurveLayerFilters.value[layerKey]);
}

function setStateCurveLayerVisible(layerKey, visible) {
  emit('update-state-curve-layer-filter', {
    layerKey,
    visible: Boolean(visible),
  });
}

function isStateCurveTrackVisible(trackKey) {
  return effectiveStateCurveTrackFilters.value[trackKey] !== false;
}

function setStateCurveTrackVisible(trackKey, visible) {
  emit('update-state-curve-track-filter', {
    trackKey,
    visible: Boolean(visible),
  });
}

function compareStateCurvePointRows(left, right) {
  return (
    compareNullableNumber(left.frameIndex, right.frameIndex) ||
    compareNullableNumber(left.timeMs, right.timeMs) ||
    compareNullableNumber(left.layerIndex, right.layerIndex) ||
    compareNullableNumber(left.sequenceIndex, right.sequenceIndex) ||
    compareNullableNumber(left.eventIndex, right.eventIndex) ||
    compareNullableNumber(left.hitIndex, right.hitIndex) ||
    compareNullableNumber(left.pointIndex, right.pointIndex)
  );
}

function compareNullableNumber(left, right) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  const leftFinite = Number.isFinite(leftNumber);
  const rightFinite = Number.isFinite(rightNumber);
  if (leftFinite && rightFinite && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }
  if (leftFinite !== rightFinite) {
    return leftFinite ? -1 : 1;
  }
  return 0;
}

function formatStateCurvePointFrame(point) {
  if (point.frameLabel) {
    return point.frameLabel;
  }
  if (Number.isFinite(Number(point.frameIndex))) {
    return formatFrameIndex(point.frameIndex);
  }
  if (Number.isFinite(Number(point.timeMs))) {
    return `${formatNumber(point.timeMs)}ms`;
  }
  return '-';
}

function formatStateCurvePointValue(point) {
  return `${point.layerLabel} Δ${formatStateCurveNumber(point.delta)} Σ${formatStateCurveNumber(point.cumulative)}`;
}

function formatStateCurvePointSource(point) {
  const parts = [];
  const actionText = point.actionName ?? point.actionId;
  if (actionText) {
    parts.push(actionText);
  }
  if (Number.isFinite(Number(point.hitIndex))) {
    parts.push(`hit${Number(point.hitIndex)}`);
  }
  const elementText = formatStateCurvePointElements(point);
  if (elementText) {
    parts.push(elementText);
  }
  if (point.eventType) {
    parts.push(point.eventType);
  }
  const spText = formatStateCurvePointSpRange(point);
  if (spText) {
    parts.push(spText);
  }
  if (point.resultStatus) {
    parts.push(point.resultStatus);
  }
  if (point.sourceKind) {
    parts.push(point.sourceKind);
  }
  return parts.join(' · ') || '-';
}

function formatStateCurvePointElements(point) {
  const ids = [
    ...(point.elementConfigIds ?? []),
    point.sourceElementConfigId,
    point.elementConfigId,
  ]
    .map(id => Number(id))
    .filter(Number.isFinite);
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) {
    return '';
  }
  return `element ${uniqueIds.join('/')}`;
}

function formatStateCurvePointSpRange(point) {
  if (
    !Number.isFinite(Number(point.spBefore)) ||
    !Number.isFinite(Number(point.spAfter))
  ) {
    return '';
  }
  return `SP ${formatStateCurveNumber(point.spBefore)}->${formatStateCurveNumber(point.spAfter)}`;
}

function formatStateCurveValueRange(min, max) {
  if (!Number.isFinite(Number(min)) || !Number.isFinite(Number(max))) {
    return '-';
  }
  if (Number(min) === Number(max)) {
    return formatStateCurveNumber(min);
  }
  return `${formatStateCurveNumber(min)}-${formatStateCurveNumber(max)}`;
}

function formatStateCurveNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return '-';
  }
  if (!Number.isInteger(number)) {
    const sign = number < 0 ? '-' : '';
    const normalized = Math.abs(number)
      .toFixed(4)
      .replace(/0+$/, '')
      .replace(/\.$/, '');
    const [integerPart, decimalPart] = normalized.split('.');
    return `${sign}${formatNumber(integerPart)}${decimalPart ? `.${decimalPart}` : ''}`;
  }
  return formatNumber(number);
}

function formatFrameRange(min, max) {
  if (!Number.isFinite(Number(min)) || !Number.isFinite(Number(max))) {
    return '-';
  }
  if (Number(min) === Number(max)) {
    return formatFrameIndex(min);
  }
  return `${formatFrameIndex(min)}-${formatFrameIndex(max)}`;
}

function formatFrameIndex(frameIndex) {
  const frame = Math.max(0, Math.round(Number(frameIndex) || 0));
  const seconds = Math.floor(frame / 60);
  const remainFrames = frame % 60;
  return `${seconds}s${remainFrames}f`;
}

function createCandidateChartPointKey(series, point, index) {
  return `${series.key}-${point.actionId}-${point.hitIndex}-${index}`;
}

function formatCandidateChartPointTitle(series, point) {
  const sourceFrame =
    point.timeAdjustmentStatus === 'sequence-display-frame-adjusted'
      ? ` / 源 ${formatFrameIndex(point.sourceFrameIndex)}`
      : '';
  return `${series.label} ${point.displayFrameLabel}${sourceFrame}: ${formatNumber(point.value)}`;
}

function formatFormulaCandidatePatternSummary(summary) {
  if (!summary || summary.comparableActionCount <= 0) {
    return '';
  }

  const scaleRange = formatScaleRange(
    summary.requiredScaleMin,
    summary.requiredScaleMax
  );
  const perHitRange = formatScaleRange(
    summary.requiredPerHitScaleMin,
    summary.requiredPerHitScaleMax
  );
  const perHitText = perHitRange ? ` / 每 hit ${perHitRange}` : '';
  const hint =
    summary.missingRuntimeScaleStatus ===
    'tracks-description-multiplier-before-runtime-hit-mapping'
      ? '，随描述倍率变化'
      : '';
  const behaviorText = formatBehaviorCorrelationSummary(
    summary.skillControlBehaviorCorrelations
  );

  return `候选模式 ${summary.comparableActionCount} 动作 · ${formatStrategyLabel(summary.preferredStrategy)} 缩放 ${scaleRange}${perHitText}${hint}${behaviorText}`;
}

function formatFormulaExecutionMatrixSummary(summary) {
  if (!summary || summary.matrixActionCount <= 0) {
    return '';
  }

  const scaleRange = formatScaleRange(
    summary.requiredScaleMin,
    summary.requiredScaleMax
  );
  const perHitRange = formatScaleRange(
    summary.requiredPerHitScaleMin,
    summary.requiredPerHitScaleMax
  );
  const perHitText = perHitRange ? ` / 每 hit ${perHitRange}` : '';
  const spreadText =
    summary.scaleSpreadStatus === 'varies-by-action-variant'
      ? '，随动作变化'
      : '';
  const hitBindingText =
    summary.rowCount > 0
      ? ` · hit绑定 ${summary.rowsWithHitBindings}/${summary.rowCount}`
      : '';
  const gap = summary.hitBindingGapSummary;
  const gapText =
    gap?.missingActionCount > 0
      ? ` · 缺口候选 ${gap.actionsWithBindingCandidates}/${gap.missingActionCount}`
      : '';
  const external = gap?.externalElementBindingSummary;
  const externalText =
    external?.gapCount > 0
      ? ` · 伤害元素候选 ${external.gapsWithDamageElementCandidates}/${external.gapCount}`
      : '';
  const relatedLevelText =
    external?.gapsWithRelatedSkillLevelBridges > 0
      ? ` · 关联等级链 ${external.gapsWithRelatedSkillLevelBridges}/${external.gapCount}`
      : '';
  const runtimeParameterText =
    external?.gapsWithRuntimeParameterSourceCandidates > 0
      ? ` · 参数来源候选 ${external.gapsWithRuntimeParameterSourceCandidates}/${external.gapCount}`
      : '';
  const runtimeApplicationText =
    external?.gapsWithRuntimeApplicationTraceEvidence > 0
      ? ` · 应用入口候选 ${external.gapsWithRuntimeApplicationTraceEvidence}/${external.gapCount}`
      : '';
  const nativeMethodText =
    external?.gapsWithRuntimeNativeMethodSymbols > 0
      ? ` · 原生入口 ${external.gapsWithRuntimeNativeMethodSymbols}/${external.gapCount}`
      : '';
  const nativeDisassemblyText =
    external?.gapsWithRuntimeNativeDisassembly > 0
      ? ` · 反汇编片段 ${external.gapsWithRuntimeNativeDisassembly}/${external.gapCount}`
      : '';
  const selfEnergyProbeText =
    external?.gapsWithRuntimeSelfEnergyFormulaProbe > 0
      ? ` · 充能探针 ${external.gapsWithRuntimeSelfEnergyFormulaProbe}/${external.gapCount}`
      : '';
  const sourceToArgsProbeText =
    external?.gapsWithRuntimeSelfEnergySourceToArgsProbe > 0
      ? ` · 构造探针 ${external.gapsWithRuntimeSelfEnergySourceToArgsProbe}/${external.gapCount}`
      : '';
  const modifierProbeText =
    external?.gapsWithRuntimeSelfEnergyModifierProbe > 0
      ? ` · 修正探针 ${external.gapsWithRuntimeSelfEnergyModifierProbe}/${external.gapCount}`
      : '';
  const ownerShareProbeText =
    external?.gapsWithRuntimeSelfEnergyOwnerShareIntervalProbe > 0
      ? ` · 归属探针 ${external.gapsWithRuntimeSelfEnergyOwnerShareIntervalProbe}/${external.gapCount}`
      : '';
  const samplingProbeText =
    external?.gapsWithRuntimeSelfEnergySamplingProbe > 0
      ? ` · 采样契约 ${external.gapsWithRuntimeSelfEnergySamplingProbe}/${external.gapCount}`
      : '';
  const alignment = gap?.elementSourceAlignmentSummary;
  const alignmentText =
    alignment?.gapCount > 0
      ? ` · 来源差异 ${alignment.divergentGapCount}/${alignment.gapCount}`
      : '';
  return `执行矩阵摘要 ${summary.matrixActionCount} 动作 · ${summary.rowCount} 行 · ${summary.elementCount} element · 缩放 ${scaleRange}${perHitText}${spreadText}${hitBindingText}${gapText}${externalText}${relatedLevelText}${runtimeParameterText}${runtimeApplicationText}${nativeMethodText}${nativeDisassemblyText}${selfEnergyProbeText}${sourceToArgsProbeText}${modifierProbeText}${ownerShareProbeText}${samplingProbeText}${alignmentText}`;
}

function formatScaleRange(min, max) {
  if (!Number.isFinite(Number(min)) || !Number.isFinite(Number(max))) {
    return '';
  }
  if (Math.abs(Number(max) - Number(min)) < 0.05) {
    return `×${formatFixed(min)}`;
  }
  return `×${formatFixed(min)}-×${formatFixed(max)}`;
}

function formatBehaviorCorrelationSummary(correlations = []) {
  const correlation = correlations.find(
    item => item.status === 'skill-level-hp-behavior-candidates-found'
  );
  if (!correlation) {
    return '';
  }

  const frames = (correlation.hitFrameStartFrames ?? [])
    .slice(0, 4)
    .map(frame => `${Math.round(frame)}f`)
    .join('/');
  const states = (correlation.resourceBindings?.stateNames ?? [])
    .slice(0, 2)
    .join('/');
  const frameText = frames ? ` · 帧 ${frames}` : '';
  const stateText = states ? ` · ${states}` : '';
  const bindingText = formatActionVariantBindingSummary(
    correlation.actionVariantBindingCandidates
  );
  const stateTimingText = formatStateTimingSummary(
    correlation.stateTimingEvidence
  );
  return ` / 行为节点 ${formatNumber(correlation.hpLaneCandidateCount)} 候选${frameText}${stateText}${bindingText}${stateTimingText}`;
}

function formatActionVariantBindingSummary(bindings = []) {
  const bound = bindings.filter(binding => binding.candidateCount > 0);
  if (bound.length === 0) {
    return '';
  }
  if (bindings.length > 1) {
    return ` · 绑定候选 ${bound.length}/${bindings.length}`;
  }

  const binding = bound[0];
  const candidates = (binding.candidates ?? []).filter(
    candidate => candidate.confidence === binding.confidence
  );
  const frames = uniqueDisplayValues(
    candidates.map(candidate => candidate.sourceStartFrame)
  )
    .slice(0, 3)
    .map(frame => `${Math.round(frame)}f`)
    .join('/');
  const states = uniqueDisplayValues(
    candidates.flatMap(candidate => candidate.stateNames ?? [])
  )
    .slice(0, 2)
    .join('/');
  const stateText = states ? `->${states}` : '';
  const frameText = frames ? ` ${frames}` : '';
  return ` · 绑定候选 ${binding.actionVariantLabel}${stateText}${frameText}`;
}

function formatStateTimingSummary(evidence) {
  const findings = (evidence?.stateFindings ?? [])
    .filter(item => item.stateName)
    .slice(0, 2)
    .map(item => `${item.stateName} ${formatStateTimingFindingStatus(item)}`);
  const findingText =
    findings.length > 0 ? ` · 状态证据 ${findings.join(' / ')}` : '';
  return `${findingText}${formatEventBridgeTargetSummary(
    evidence?.eventBridgeTargetSkillControlEvidence
  )}`;
}

function formatStateTimingFindingStatus(finding) {
  if (finding.animationControlCount > 0) {
    return '动画+命中';
  }
  return '仅资源命中';
}

function formatEventBridgeTargetSummary(evidence) {
  const chain = evidence?.normalAttackChainCandidate;
  if (chain?.chainSkillIds?.length > 0) {
    const chainText = chain.chainSkillIds.slice(0, 2).map(skillId => {
      const target = (evidence.targetSkillControls ?? []).find(
        item => Number(item.skillId) === Number(skillId)
      );
      const states = (target?.animationStateNames ?? []).slice(0, 2).join('/');
      return states ? `${skillId}->${states}` : `${skillId}`;
    });
    const remaining = chain.chainSkillIds.length - chainText.length;
    if (remaining > 0) {
      chainText.push(`+${remaining}`);
    }
    const missingTargets = (evidence.targetSkillControls ?? [])
      .filter(target => target.status !== 'found')
      .map(target => `${target.skillId}缺失`)
      .slice(0, 2);
    const missingText =
      missingTargets.length > 0
        ? ` · 目标缺失 ${missingTargets.join(' / ')}`
        : '';
    const hitChain = evidence.normalAttackHitChainCandidate;
    const hitText = hitChain
      ? ` · 命中候选 ${hitChain.candidateHitGroupCount}/${hitChain.expectedHitCount ?? '?'}段`
      : '';
    const damageElementText =
      hitChain &&
      Number.isFinite(Number(hitChain.damageElementMappedHitGroupCount))
        ? ` · 三值候选 ${hitChain.damageElementMappedHitGroupCount}/${hitChain.candidateHitGroupCount}段`
        : '';
    return ` · 普攻链 ${chainText.join(' / ')}${hitText}${damageElementText}${missingText}`;
  }

  const targets = (evidence?.targetSkillControls ?? [])
    .slice(0, 2)
    .map(target => {
      if (target.status !== 'found') {
        return `${target.skillId}缺失`;
      }
      const states = (target.animationStateNames ?? []).slice(0, 2).join('/');
      return states
        ? `${target.skillId}->${states}`
        : `${target.skillId}无动画`;
    });
  return targets.length > 0 ? ` · 目标技能 ${targets.join(' / ')}` : '';
}

function uniqueDisplayValues(values) {
  return [
    ...new Set(
      values.filter(value => value != null && String(value).trim() !== '')
    ),
  ];
}

function formatCombinationLabel(preview) {
  if (preview.strategy?.startsWith('function_2')) {
    return 'f2';
  }
  if (preview.strategy?.startsWith('function_1-times-function_2')) {
    return 'f1*f2';
  }
  if (preview.strategy?.startsWith('function_1-plus-function_2')) {
    return 'f1+f2';
  }
  return preview.expression ?? preview.strategy ?? '候选';
}

function formatStrategyLabel(strategy) {
  if (String(strategy).startsWith('function_2')) {
    return 'f2';
  }
  if (String(strategy).startsWith('function_1-times-function_2')) {
    return 'f1*f2';
  }
  if (String(strategy).startsWith('function_1-plus-function_2')) {
    return 'f1+f2';
  }
  return strategy ?? '候选';
}

function formatElementIds(ids = []) {
  const values = ids.filter(id => Number.isFinite(Number(id)));
  return values.length > 0 ? `(${values.join(', ')})` : '';
}

function formatSignedNumber(value) {
  const number = Math.round(Number(value) || 0);
  return number > 0
    ? `+${number.toLocaleString('zh-CN')}`
    : number.toLocaleString('zh-CN');
}

function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return '-';
  }
  return `${(number * 100).toFixed(1)}%`;
}

function formatFixed(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return '-';
  }
  return number.toFixed(1);
}

function formatOverlapRange(item) {
  return `${Math.round(item.overlapStartMs)}-${Math.round(item.overlapEndMs)}ms`;
}

function formatDelayRange(item) {
  return `${Math.round(item.requestedStartMs)}ms -> ${Math.round(item.resolvedStartMs)}ms`;
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

.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 14px;
}

.metric {
  min-width: 0;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  background: #232a31;
}

.metric span {
  display: block;
  margin-bottom: 4px;
  color: #8f9aa3;
  font-size: 11px;
}

.metric strong {
  display: block;
  overflow-wrap: anywhere;
  color: #ffffff;
  font-size: 15px;
}

.damage-list {
  display: grid;
  gap: 8px;
  padding: 0 14px 14px;
}

.action-result-list {
  display: grid;
  gap: 8px;
  padding: 0 14px 14px;
}

.candidate-series-list {
  display: grid;
  gap: 8px;
  padding: 0 14px 14px;
}

.damage-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 10px;
  border-radius: 4px;
  background: rgba(230, 162, 60, 0.1);
}

.action-result-row {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 9px 10px;
  border-left: 3px solid #79c7b9;
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.1);
}

.candidate-series-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 112px;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 9px 10px;
  border-left: 3px solid #79c7b9;
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.08);
  color: #9ce0d2;
}

.candidate-series-main {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.candidate-series-main span {
  color: #9ce0d2;
  font-size: 12px;
  font-weight: 700;
}

.candidate-series-main small {
  color: #b8c0c7;
  font-size: 11px;
}

.candidate-series-sparkline {
  width: 112px;
  height: 32px;
  color: #79c7b9;
}

.candidate-chart {
  display: grid;
  gap: 8px;
  padding: 0 14px 14px;
}

.candidate-chart-meta {
  display: block;
  color: #8f9aa3;
  font-size: 11px;
}

.candidate-chart-canvas {
  height: 104px;
  min-width: 0;
  padding: 10px;
  border: 1px solid rgba(121, 199, 185, 0.18);
  border-radius: 4px;
  background: #171d22;
}

.candidate-chart-canvas svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.candidate-chart-gridline {
  stroke: rgba(255, 255, 255, 0.08);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.candidate-chart-legend {
  display: grid;
  gap: 6px;
}

.candidate-chart-legend-row {
  display: grid;
  grid-template-columns: 8px minmax(64px, 0.7fr) minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 7px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
}

.candidate-chart-legend-row i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.candidate-chart-legend-row span {
  min-width: 0;
  overflow-wrap: anywhere;
  color: #d9dee3;
  font-size: 11px;
  font-weight: 700;
}

.candidate-chart-legend-row small {
  min-width: 0;
  overflow-wrap: anywhere;
  color: #8f9aa3;
  font-size: 11px;
}

.state-curve-list {
  display: grid;
  gap: 8px;
  padding: 0 14px 14px;
}

.state-curve-layer-controls {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.state-curve-track-controls {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.state-curve-layer-toggle,
.state-curve-track-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 0;
  padding: 6px 5px;
  border: 1px solid rgba(121, 199, 185, 0.16);
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.06);
  color: #b8c0c7;
  font-size: 11px;
}

.state-curve-layer-toggle.has-points,
.state-curve-track-toggle.has-points {
  border-color: rgba(121, 199, 185, 0.32);
  color: #d9e0ff;
}

.state-curve-layer-toggle input,
.state-curve-track-toggle input {
  width: 12px;
  height: 12px;
  accent-color: #79c7b9;
}

.state-curve-layer-toggle span,
.state-curve-track-toggle span {
  overflow-wrap: anywhere;
}

.state-curve-row {
  display: grid;
  gap: 7px;
  min-width: 0;
  padding: 9px 10px;
  border-left: 3px solid #a6b7ff;
  border-radius: 4px;
  background: rgba(166, 183, 255, 0.07);
}

.state-curve-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}

.state-curve-main span {
  min-width: 0;
  overflow-wrap: anywhere;
  color: #d9e0ff;
  font-size: 12px;
  font-weight: 700;
}

.state-curve-main small {
  flex: 0 0 auto;
  color: #8f9aa3;
  font-size: 11px;
}

.state-curve-layers {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.state-curve-layer-pill {
  padding: 4px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: #b8c0c7;
  font-size: 11px;
}

.state-curve-points {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 2px 0 0;
  list-style: none;
}

.state-curve-point-row {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  gap: 2px 8px;
  min-width: 0;
  padding-top: 5px;
  border-top: 1px solid rgba(166, 183, 255, 0.1);
  cursor: pointer;
}

.state-curve-point-row:focus,
.state-curve-point-row.selected {
  outline: 1px solid rgba(121, 199, 185, 0.52);
  outline-offset: 2px;
}

.state-curve-point-row.selected {
  background: rgba(121, 199, 185, 0.08);
}

.state-curve-point-time {
  grid-row: span 2;
  align-self: center;
  color: #79c7b9;
  font-size: 11px;
  font-weight: 700;
}

.state-curve-point-row strong {
  min-width: 0;
  overflow-wrap: anywhere;
  color: #dff9f3;
  font-size: 11px;
}

.state-curve-point-row small {
  min-width: 0;
  overflow-wrap: anywhere;
  color: #8f9aa3;
  font-size: 10px;
}

.action-result-row strong {
  overflow-wrap: anywhere;
  color: #dff9f3;
  font-size: 12px;
}

.action-result-row span {
  color: #9ce0d2;
}

.action-result-row small {
  color: #b8c0c7;
  font-size: 11px;
}

.damage-row-main {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.damage-row span {
  color: #efc574;
}

.damage-row small {
  color: #b8c0c7;
  font-size: 11px;
}

.timeline-diagnostics {
  display: grid;
  gap: 8px;
  padding: 0 14px 14px;
}

.insertion-diagnostics {
  display: grid;
  gap: 8px;
  padding: 0 14px 14px;
}

.diagnostic-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  background: rgba(245, 108, 108, 0.08);
}

.diagnostic-heading span {
  color: #d9dee3;
  font-size: 12px;
  font-weight: 700;
}

.diagnostic-heading strong {
  color: #ffb9b9;
  font-size: 15px;
}

.diagnostic-heading.neutral {
  background: rgba(230, 162, 60, 0.08);
}

.diagnostic-heading.source-heading {
  background: rgba(121, 199, 185, 0.08);
}

.diagnostic-heading.source-heading strong {
  color: #9ce0d2;
}

.diagnostic-heading.neutral strong {
  color: #efc574;
}

.diagnostic-empty {
  margin: 0;
  padding: 9px 10px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
  color: #8f9aa3;
  font-size: 12px;
}

.overlap-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.overlap-list li,
.insertion-list li {
  display: grid;
  gap: 3px;
  min-width: 0;
  padding: 9px 10px;
  border-left: 3px solid #f56c6c;
  border-radius: 4px;
  background: rgba(245, 108, 108, 0.1);
}

.insertion-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.insertion-list li {
  border-left-color: #e6a23c;
  background: rgba(230, 162, 60, 0.1);
}

.overlap-list span,
.overlap-list small,
.insertion-list span,
.insertion-list small {
  color: #b8c0c7;
  font-size: 11px;
}

.overlap-list strong,
.insertion-list strong {
  overflow-wrap: anywhere;
  color: #ffdede;
  font-size: 12px;
}

.insertion-list strong {
  color: #efc574;
}

.limitations {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 14px 18px 16px 30px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  color: #b8c0c7;
  font-size: 12px;
}
</style>
