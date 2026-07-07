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
      <div v-for="damage in damageTimeline" :key="damage.actionId" class="damage-row">
        <div class="damage-row-main">
          <span>{{ damage.segmentLabel }}</span>
          <small>{{ formatDamageFormula(damage) }}</small>
        </div>
        <strong>{{ formatNumber(damage.rawDamage) }}</strong>
      </div>
    </div>

    <div class="action-result-list" data-testid="workbench-action-result-sources">
      <div class="diagnostic-heading source-heading">
        <span>三值来源</span>
        <strong>{{ actionResultTimeline.length }}</strong>
      </div>
      <div
        v-for="entry in actionResultTimeline"
        :key="entry.actionId"
        class="action-result-row"
        data-testid="workbench-action-result-source-row"
      >
        <div class="damage-row-main">
          <span>{{ entry.actionName }}</span>
          <small>{{ formatActionResultSource(entry) }}</small>
          <small v-if="formatFormulaSlotAlignment(entry.hpDamage?.sourceEvidence)">
            {{ formatFormulaSlotAlignment(entry.hpDamage?.sourceEvidence) }}
          </small>
          <small v-if="formatFormulaFunctionSummary(entry.hpDamage?.sourceEvidence)">
            {{ formatFormulaFunctionSummary(entry.hpDamage?.sourceEvidence) }}
          </small>
          <small v-if="formatFormulaCandidatePreview(entry.hpDamage?.sourceEvidence)">
            {{ formatFormulaCandidatePreview(entry.hpDamage?.sourceEvidence) }}
          </small>
          <small v-if="formatFormulaCombinationPreview(entry.hpDamage?.sourceEvidence)">
            {{ formatFormulaCombinationPreview(entry.hpDamage?.sourceEvidence) }}
          </small>
        </div>
        <strong>{{ formatActionResultValues(entry) }}</strong>
      </div>
    </div>

    <div class="timeline-diagnostics">
      <div class="diagnostic-heading">
        <span>时间轴诊断</span>
        <strong data-testid="workbench-overlap-count">{{ overlapCount }}</strong>
      </div>
      <p v-if="overlapItems.length === 0" class="diagnostic-empty" data-testid="workbench-overlap-empty">
        暂无轨道重叠
      </p>
      <ul v-else class="overlap-list">
        <li v-for="item in overlapItems" :key="item.id" data-testid="workbench-overlap-item">
          <span>{{ item.laneName }}</span>
          <strong>{{ item.actionNames.join(' / ') }}</strong>
          <small>{{ formatOverlapRange(item) }}</small>
        </li>
      </ul>
    </div>

    <div class="insertion-diagnostics">
      <div class="diagnostic-heading neutral">
        <span>插入提示</span>
        <strong data-testid="workbench-insert-delay-count">{{ autoDelayedCount }}</strong>
      </div>
      <p v-if="autoDelayedItems.length === 0" class="diagnostic-empty" data-testid="workbench-insert-delay-empty">
        暂无自动推迟
      </p>
      <ul v-else class="insertion-list">
        <li v-for="item in autoDelayedItems" :key="item.id" data-testid="workbench-insert-delay-item">
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

const overlapItems = computed(() => props.timelineDiagnostics?.overlaps ?? []);
const overlapCount = computed(() => props.timelineDiagnostics?.overlapCount ?? overlapItems.value.length);
const autoDelayedItems = computed(() => props.insertionDiagnostics?.autoDelayedItems ?? []);
const autoDelayedCount = computed(
  () => props.insertionDiagnostics?.autoDelayedCount ?? autoDelayedItems.value.length,
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
  const multiplier = layers.actionMultiplier?.rawValue ?? formatMultiplier(layers.actionMultiplier?.value);
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
  if (sourceEvidence.candidateCount > 0) {
    return `${sourceEvidence.candidateCount} 个候选 ${formatElementIds(sourceEvidence.matchedElementConfigIds)}`;
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
  const previews = sourceEvidence?.formulaCandidatePreview?.functionPreviews ?? [];
  const comparable = uniqueFormulaCandidatePreviews(
    previews.filter((preview) => preview.comparison?.status === 'compared-to-raw-projection')
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
  const previews = sourceEvidence?.formulaCandidatePreview?.combinationPreviews ?? [];
  const preferred =
    previews.find(
      (preview) =>
        preview.strategy === 'function_2-current-level-value-param' &&
        preview.comparison?.status === 'compared-to-raw-projection'
    ) ??
    previews.find(
      (preview) => preview.comparison?.status === 'compared-to-raw-projection'
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

function formatElementIds(ids = []) {
  const values = ids.filter((id) => Number.isFinite(Number(id)));
  return values.length > 0 ? `(${values.join(', ')})` : '';
}

function formatSignedNumber(value) {
  const number = Math.round(Number(value) || 0);
  return number > 0 ? `+${number.toLocaleString('zh-CN')}` : number.toLocaleString('zh-CN');
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
