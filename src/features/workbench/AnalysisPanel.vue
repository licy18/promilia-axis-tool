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
      <div
        v-if="actionEditFeedback"
        class="action-edit-feedback"
        :data-action-id="actionEditFeedback.actionId"
        :data-edit-source-field="actionEditFeedback.fieldKey"
        :data-edit-source-label="actionEditFeedback.label"
        :data-edit-source-summary="actionEditFeedback.changeSummary"
        :data-edit-origin="actionEditFeedback.editOrigin"
        :data-origin-frame-label="actionEditFeedback.originFrameLabel"
        :data-origin-state-point-id="actionEditFeedback.originStatePointId"
        :data-origin-track-key="actionEditFeedback.originTrackKey"
        :data-runtime-delta-count="actionEditFeedback.runtimeDeltaCount"
        :data-runtime-state-point-id="actionEditFeedback.runtimeStatePointId"
        :data-result-focused="actionEditFeedback.resultFocused"
        :data-result-focus-status="actionEditFeedback.resultFocusStatus"
        data-testid="workbench-action-edit-feedback"
      >
        <span
          class="action-edit-feedback-status"
          data-testid="workbench-action-edit-feedback-result-status"
        >
          {{ actionEditFeedback.resultFocusLabel }}
        </span>
        <div class="action-edit-feedback-main">
          <span>最近编辑</span>
          <strong>{{ actionEditFeedback.actionName }}</strong>
          <small>{{ actionEditFeedback.display }}</small>
          <em
            v-if="actionEditFeedback.originLabel"
            data-testid="workbench-action-edit-feedback-origin"
          >
            {{ actionEditFeedback.originLabel }}
          </em>
          <div
            v-if="actionEditFeedback.hasResultPointMap"
            class="action-edit-feedback-result-map"
            :data-origin-state-point-id="actionEditFeedback.originStatePointId"
            :data-runtime-state-point-id="
              actionEditFeedback.runtimeStatePointId
            "
            data-testid="workbench-action-edit-feedback-result-map"
          >
            <span
              data-result-point-key="origin"
              data-testid="workbench-action-edit-feedback-result-map-row"
            >
              原结果
              <strong>{{ actionEditFeedback.originPointDisplay }}</strong>
            </span>
            <span
              data-result-point-key="runtime"
              data-testid="workbench-action-edit-feedback-result-map-row"
            >
              刷新后
              <strong>{{ actionEditFeedback.runtimePointDisplay }}</strong>
            </span>
          </div>
          <div
            class="action-edit-feedback-location-chain"
            :data-action-synced="
              actionEditFeedback.locationChain.actionSynced ? 'true' : 'false'
            "
            :data-chain-status="actionEditFeedback.locationChain.status"
            :data-chain-synced-count="
              actionEditFeedback.locationChain.syncedCount
            "
            :data-chain-total-count="
              actionEditFeedback.locationChain.totalCount
            "
            :data-detail-synced="
              actionEditFeedback.locationChain.detailSynced ? 'true' : 'false'
            "
            :data-result-synced="
              actionEditFeedback.locationChain.resultSynced ? 'true' : 'false'
            "
            data-testid="workbench-action-edit-feedback-location-chain"
          >
            <span>定位链路</span>
            <strong>{{ actionEditFeedback.locationChain.label }}</strong>
            <small>{{ actionEditFeedback.locationChain.detail }}</small>
          </div>
        </div>
        <div class="action-edit-feedback-actions">
          <button
            type="button"
            class="action-edit-feedback-focus"
            data-testid="workbench-action-edit-feedback-focus"
            @click="focusActionEditFeedback"
          >
            定位来源
          </button>
          <button
            type="button"
            class="action-edit-feedback-focus"
            :data-runtime-state-point-id="
              actionEditFeedback.runtimeStatePointId
            "
            :disabled="
              !actionEditFeedback.runtimeStatePointId ||
              actionEditFeedback.resultFocused
            "
            data-testid="workbench-action-edit-feedback-result-focus"
            @click="selectActionEditFeedbackResult"
          >
            {{ actionEditFeedback.resultFocused ? '结果已定位' : '定位结果' }}
          </button>
        </div>
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
          formatThreeValueGenerationLayerSummary(
            summary.threeValueGenerationLayerSummary
          )
        "
        class="diagnostic-empty formula-pattern-summary"
        data-testid="workbench-three-value-generation-layer-summary"
      >
        {{
          formatThreeValueGenerationLayerSummary(
            summary.threeValueGenerationLayerSummary
          )
        }}
      </p>
      <p
        v-if="
          formatThreeValueRuntimeProjectionSummary(
            summary.threeValueRuntimeProjectionSummary
          )
        "
        class="diagnostic-empty formula-pattern-summary"
        data-testid="workbench-three-value-runtime-projection-summary"
      >
        {{
          formatThreeValueRuntimeProjectionSummary(
            summary.threeValueRuntimeProjectionSummary
          )
        }}
      </p>
      <div
        v-if="threeValueCalculatorDiagnosticRows.length"
        class="calculator-diagnostic-list"
        data-testid="workbench-three-value-calculator-diagnostics"
      >
        <button
          v-for="row in threeValueCalculatorDiagnosticRows"
          :key="row.scope"
          type="button"
          class="calculator-diagnostic-row"
          :class="{ active: row.scope === calculatorDiagnosticScope }"
          :data-active="row.scope === calculatorDiagnosticScope"
          :data-calculator-scope="row.scope"
          data-testid="workbench-three-value-calculator-diagnostic-row"
          @click="focusThreeValueCalculatorScope(row.scope)"
        >
          <span>{{ row.label }}</span>
          <strong>{{ row.summary }}</strong>
          <small>{{ row.detail }}</small>
        </button>
      </div>
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
      <button
        v-for="entry in actionResultTimeline"
        :key="entry.actionId"
        type="button"
        class="action-result-row"
        :class="{
          selected: isActionResultRuntimeSelected(entry),
          'current-action': isActionResultCurrentAction(entry),
        }"
        :data-action-id="entry.actionId"
        :data-current-action="isActionResultCurrentAction(entry)"
        :data-draft-dirty="draftResultStatus.dirty"
        :data-draft-status="draftResultStatus.key"
        :data-edit-source-field="
          getActionResultEditSource(entry)?.fieldKey ?? ''
        "
        :data-edit-source-label="getActionResultEditSource(entry)?.label ?? ''"
        :data-edit-source-summary="
          getActionResultEditSource(entry)?.changeSummary ?? ''
        "
        :data-result-refresh-status="draftResultStatus.refreshKey"
        :data-result-location-status="getActionResultLocationStatus(entry)"
        :data-has-runtime-trace="Boolean(getActionResultRuntimeTrace(entry))"
        :data-runtime-state-point-id="
          getActionResultRuntimeTrace(entry)?.firstStatePointId ?? ''
        "
        :data-selected="isActionResultRuntimeSelected(entry)"
        :data-selected-state-point-id="
          getActionResultSelectedStatePointId(entry)
        "
        :data-source-delta-ids="
          getActionResultRuntimeTrace(entry)?.sourceDeltaIds.join(',') ?? ''
        "
        data-testid="workbench-action-result-source-row"
        :disabled="!getActionResultRuntimeTrace(entry)"
        @click="selectActionResultRuntimePoint(entry)"
      >
        <div class="damage-row-main">
          <span>{{ entry.actionName }}</span>
          <small
            v-if="isActionResultCurrentAction(entry)"
            class="action-result-current-action"
            data-testid="workbench-action-result-current-action"
          >
            正在编辑
          </small>
          <small
            v-if="isActionResultCurrentAction(entry)"
            class="action-result-draft-status"
            data-testid="workbench-action-result-draft-status"
          >
            {{ draftResultStatus.resultLabel }}
          </small>
          <small
            v-if="isActionResultCurrentAction(entry)"
            class="action-result-refresh-status"
            data-testid="workbench-action-result-refresh-status"
          >
            {{ draftResultStatus.refreshLabel }}
          </small>
          <small
            v-if="isActionResultRuntimeSelected(entry)"
            class="action-result-location-status"
            data-testid="workbench-action-result-location-status"
          >
            当前位置已同步
          </small>
          <small
            v-if="shouldShowActionResultEditSource(entry)"
            class="action-result-edit-source"
            role="button"
            tabindex="0"
            :data-edit-source-summary="
              getActionResultEditSource(entry)?.changeSummary ?? ''
            "
            data-testid="workbench-action-result-edit-source"
            @click.stop="focusActionEditSource(entry)"
            @keydown.enter.stop.prevent="focusActionEditSource(entry)"
            @keydown.space.stop.prevent="focusActionEditSource(entry)"
          >
            {{
              formatActionEditSourceDisplay(getActionResultEditSource(entry))
            }}
          </small>
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
          <small
            v-if="getActionResultRuntimeTrace(entry)"
            class="action-result-runtime-trace"
            data-testid="workbench-action-result-runtime-trace"
          >
            {{
              formatActionResultRuntimeTrace(getActionResultRuntimeTrace(entry))
            }}
          </small>
        </div>
        <strong>{{ formatActionResultValues(entry) }}</strong>
      </button>

      <div
        v-if="selectedActionContribution"
        class="action-contribution-panel"
        :data-action-id="selectedActionContribution.actionId"
        data-testid="workbench-action-contribution-panel"
      >
        <div class="action-contribution-heading">
          <span>动作贡献拆分</span>
          <strong>{{ selectedActionContribution.actionName }}</strong>
          <small>
            {{ selectedActionContribution.appliedDeltaCount }}条运行结果
          </small>
        </div>
        <div
          v-if="selectedRuntimeResultDetail"
          class="action-result-detail-panel"
          :data-action-id="selectedRuntimeResultDetail.actionId"
          :data-current-action="
            isRuntimeResultCurrentAction(selectedRuntimeResultDetail)
          "
          :data-draft-dirty="draftResultStatus.dirty"
          :data-draft-status="draftResultStatus.key"
          :data-edit-source-field="
            getRuntimeResultEditSource(selectedRuntimeResultDetail)?.fieldKey ??
            ''
          "
          :data-edit-source-label="
            getRuntimeResultEditSource(selectedRuntimeResultDetail)?.label ?? ''
          "
          :data-edit-source-summary="
            getRuntimeResultEditSource(selectedRuntimeResultDetail)
              ?.changeSummary ?? ''
          "
          :data-result-refresh-status="draftResultStatus.refreshKey"
          data-result-location-status="selected-result"
          :data-selected-state-point-id="
            selectedRuntimeResultDetail.statePointId
          "
          :data-state-point-id="selectedRuntimeResultDetail.statePointId"
          :data-track-key="selectedRuntimeResultDetail.trackKey"
          data-detail-mode="compact"
          data-full-detail-source="workbench-runtime-selected-detail"
          data-testid="workbench-action-result-detail-panel"
        >
          <div class="action-result-detail-heading">
            <span>结果详情</span>
            <strong data-testid="workbench-action-result-detail-action">
              {{
                selectedRuntimeResultDetail.actionName ||
                selectedRuntimeResultDetail.actionId ||
                '动作'
              }}
            </strong>
            <small>{{
              formatRuntimeResultMeta(selectedRuntimeResultDetail)
            }}</small>
            <small
              class="action-result-detail-location-status"
              data-testid="workbench-action-result-detail-location-status"
            >
              当前位置已同步
            </small>
          </div>
          <div class="action-result-detail-grid">
            <div
              v-for="row in createCompactRuntimeResultRows(
                selectedRuntimeResultDetail
              )"
              :key="row.key"
              class="action-result-detail-row"
              :data-detail-key="row.key"
              data-testid="workbench-action-result-detail-row"
            >
              <span>{{ row.label }}</span>
              <strong>{{ row.value }}</strong>
            </div>
          </div>
        </div>
        <div class="action-contribution-list">
          <button
            v-for="row in selectedActionContribution.rows"
            :key="row.trackKey"
            type="button"
            class="action-contribution-row"
            :class="{ active: row.active }"
            :data-active="row.active"
            :data-count="row.count"
            :data-delta="row.value"
            :data-state-point-id="row.firstStatePointId"
            :data-track-key="row.trackKey"
            data-testid="workbench-action-contribution-row"
            :disabled="!row.firstStatePointId"
            @click="selectActionContributionRow(row)"
          >
            <span>{{ row.label }}</span>
            <strong>{{ formatActionContributionValue(row) }}</strong>
            <small>{{ formatActionContributionMeta(row) }}</small>
          </button>
        </div>
        <div
          v-if="selectedActionContribution.detail"
          class="action-contribution-detail"
          :data-state-point-id="selectedActionContribution.detail.statePointId"
          :data-track-key="selectedActionContribution.detail.trackKey"
          data-testid="workbench-action-contribution-detail"
        >
          <div class="action-contribution-detail-heading">
            <span>贡献详情</span>
            <strong>{{ selectedActionContribution.detail.label }}</strong>
          </div>
          <div class="action-contribution-detail-list">
            <div
              v-for="row in selectedActionContribution.detail.rows"
              :key="row.key"
              class="action-contribution-detail-row"
              :data-detail-key="row.key"
              :title="String(row.rawValue ?? row.value ?? '')"
              data-testid="workbench-action-contribution-detail-row"
            >
              <span>{{ row.label }}</span>
              <strong>{{ row.value }}</strong>
            </div>
          </div>
        </div>
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
        <div
          class="state-curve-focus-controls"
          data-testid="workbench-state-curve-focus-controls"
        >
          <button
            class="state-curve-focus-button"
            :class="{ active: effectiveStateCurveFocusMode === 'all' }"
            type="button"
            data-testid="workbench-state-curve-focus-all"
            @click="setStateCurveFocusMode('all')"
          >
            全部
          </button>
          <button
            class="state-curve-focus-button"
            :class="{ active: effectiveStateCurveFocusMode === 'selected' }"
            type="button"
            :disabled="!selectedStateCurvePointId"
            data-testid="workbench-state-curve-focus-selected"
            @click="setStateCurveFocusMode('selected')"
          >
            选中
          </button>
        </div>
        <div
          class="state-curve-navigation-controls"
          data-testid="workbench-state-curve-navigation-controls"
        >
          <button
            class="state-curve-nav-button"
            type="button"
            :disabled="!stateCurveNavigationSummary.canPrevious"
            title="上一个状态点"
            aria-label="上一个状态点"
            data-testid="workbench-state-curve-nav-prev"
            @click="selectAdjacentStateCurvePoint(-1)"
          >
            <ArrowLeft class="state-curve-nav-icon" />
          </button>
          <span data-testid="workbench-state-curve-nav-position">
            {{ formatStateCurveNavigationPosition() }}
          </span>
          <button
            class="state-curve-nav-button"
            type="button"
            :disabled="!stateCurveNavigationSummary.canNext"
            title="下一个状态点"
            aria-label="下一个状态点"
            data-testid="workbench-state-curve-nav-next"
            @click="selectAdjacentStateCurvePoint(1)"
          >
            <ArrowRight class="state-curve-nav-icon" />
          </button>
        </div>
        <div
          v-if="selectedStateCurveFrameGroupRows.length > 1"
          class="state-curve-frame-group-controls"
          data-testid="workbench-state-curve-frame-group-controls"
        >
          <button
            v-for="point in selectedStateCurveFrameGroupRows"
            :key="point.statePointId"
            class="state-curve-frame-group-button"
            :class="{
              active: point.statePointId === selectedStateCurvePointId,
            }"
            type="button"
            :data-state-point-id="point.statePointId"
            :data-track-key="point.trackKey"
            :data-layer-key="point.layerKey"
            :data-frame-group-key="point.frameGroupKey"
            data-testid="workbench-state-curve-frame-group-option"
            @click="selectStateCurveFrameGroupPoint(point)"
          >
            {{ formatStateCurveFrameGroupOption(point) }}
          </button>
        </div>
      </div>
      <div
        class="state-curve-view-summary"
        :data-calculator-scope="stateCurveViewSummary.scope"
        data-testid="workbench-state-curve-view-summary"
      >
        <span>{{ stateCurveViewSummary.label }}</span>
        <strong>{{ stateCurveViewSummary.count }}</strong>
        <small>{{ stateCurveViewSummary.detail }}</small>
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
          <span>
            <strong>{{ layer.label }} {{ layer.pointCount }}</strong>
            <small data-testid="workbench-state-curve-layer-role">
              {{ layer.participationLabel }}
            </small>
          </span>
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
            :data-track-key="point.trackKey"
            :data-layer-key="point.layerKey"
            :data-participation="
              getStateCurveLayerRole(point.layerKey).roleLabel
            "
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
            <em data-testid="workbench-state-curve-point-participation">
              {{
                getStateCurveLayerRole(point.layerKey).pointParticipationLabel
              }}
            </em>
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
import { ArrowLeft, ArrowRight, TrendCharts } from '@element-plus/icons-vue';
import {
  formatThreeValueCalculationKind,
  formatThreeValueCalculationStatus,
  formatThreeValueCalculatorKey,
  formatThreeValueUnresolvedItems,
} from '../../simulation/threeValueCalculatorAdapters';
import {
  createStateCurveFrameGroupKey,
  createStateCurvePointId,
  createRuntimeStateCurvePointId,
} from './stateCurvePointIdentity';

const CANDIDATE_CHART_COLORS = ['#f2b366', '#79c7b9', '#a6b7ff'];
const candidateChartGridLines = [25, 50, 75];
const STATE_CURVE_LAYER_OPTIONS = [
  {
    key: 'applied',
    label: '已用',
    roleLabel: '已应用',
    participationLabel: '进曲线/日志',
    pointParticipationLabel: '参与当前三值曲线和模拟日志',
  },
  {
    key: 'candidate',
    label: '候选',
    roleLabel: '候选诊断',
    participationLabel: '不进结果',
    pointParticipationLabel: '候选诊断，不参与当前结果',
  },
  {
    key: 'sampled',
    label: '采样',
    roleLabel: '采样诊断',
    participationLabel: '不进结果',
    pointParticipationLabel: '采样诊断，不参与当前结果',
  },
  {
    key: 'placeholder',
    label: '占位',
    roleLabel: '缺口占位',
    participationLabel: '不进结果',
    pointParticipationLabel: '缺口占位，不参与当前结果',
  },
];
const ACTION_CONTRIBUTION_TRACKS = [
  {
    trackKey: 'enemyHpDamage',
    label: '敌人 HP',
    valueField: 'hpDelta',
    signed: false,
  },
  {
    trackKey: 'enemyToughnessDamage',
    label: '敌人韧性',
    valueField: 'toughnessDelta',
    signed: false,
  },
  {
    trackKey: 'selfEnergyChange',
    label: '自身能量',
    valueField: 'energyDelta',
    signed: true,
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
  runtimeProjection: {
    type: Object,
    default: null,
  },
  runtimeSelectedDetail: {
    type: Object,
    default: null,
  },
  draftStatus: {
    type: String,
    default: '',
  },
  actionEditSource: {
    type: Object,
    default: null,
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
  selectedActionId: {
    type: String,
    default: '',
  },
  selectedStateCurvePointId: {
    type: String,
    default: '',
  },
  stateCurveFocusMode: {
    type: String,
    default: 'all',
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
  calculatorDiagnosticScope: {
    type: String,
    default: '',
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
  'update-state-curve-focus-mode',
  'focus-three-value-calculator-scope',
  'select-runtime-state-point',
  'select-action-result',
  'select-action-contribution-point',
  'focus-action-edit-source',
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
const stateCurveViewSummary = computed(() => {
  const layerText = activeStateCurveLayerKeys.value
    .map(formatStateCurveLayerLabel)
    .join('/');
  const trackText = formatStateCurveActiveTrackSummary();
  const focusText =
    effectiveStateCurveFocusMode.value === 'selected'
      ? '选中三值点'
      : '全部三值点';
  const scope = props.calculatorDiagnosticScope || 'all';
  const labels = {
    generation: '生成视角',
    runtime: '运行视角',
    all: '全部视角',
  };
  return {
    scope,
    label: labels[scope] ?? '全部视角',
    count: `${stateCurveVisiblePointCount.value}/${stateCurveTotalPointCount.value}点`,
    detail: `${layerText || '无层'} · ${trackText} · ${focusText}`,
  };
});
const threeValueCalculatorDiagnosticRows = computed(() =>
  [
    createThreeValueCalculatorDiagnosticRow({
      scope: 'generation',
      label: '生成适配器',
      summary: props.summary.threeValueGenerationLayerSummary,
    }),
    createThreeValueCalculatorDiagnosticRow({
      scope: 'runtime',
      label: '运行适配器',
      summary: props.summary.threeValueRuntimeProjectionSummary,
    }),
  ].filter(Boolean)
);
const runtimePointByDeltaId = computed(() => {
  const byId = new Map();
  for (const point of props.runtimeProjection?.enemyStateCurve?.points ?? []) {
    if (point?.sourceDeltaId) {
      byId.set(point.sourceDeltaId, point);
    }
  }
  for (const actor of props.runtimeProjection?.selfEnergyCurveByActor ?? []) {
    for (const point of actor.points ?? []) {
      if (point?.sourceDeltaId) {
        byId.set(point.sourceDeltaId, point);
      }
    }
  }
  return byId;
});
const runtimeTraceByActionId = computed(() => {
  const groups = new Map();
  for (const row of props.runtimeProjection?.simLog ?? []) {
    if (!row?.actionId) {
      continue;
    }
    const group = groups.get(row.actionId) ?? [];
    const point = row.sourceDeltaId
      ? runtimePointByDeltaId.value.get(row.sourceDeltaId)
      : null;
    group.push({
      row,
      point,
      statePointId: createRuntimeStateCurvePointId(row, point),
    });
    groups.set(row.actionId, group);
  }
  return new Map(
    [...groups.entries()].map(([actionId, rows]) => [
      actionId,
      createActionResultRuntimeTrace(actionId, rows),
    ])
  );
});
const selectedActionContribution = computed(() => {
  if (!props.selectedStateCurvePointId) {
    return null;
  }
  const trace = [...runtimeTraceByActionId.value.values()].find(item =>
    item.statePointIds.includes(props.selectedStateCurvePointId)
  );
  return trace ? createSelectedActionContribution(trace) : null;
});
const selectedRuntimeResultDetail = computed(
  () => props.runtimeSelectedDetail ?? null
);
const draftResultStatus = computed(() =>
  createDraftResultStatus(props.draftStatus)
);
const actionEditFeedback = computed(() =>
  createActionEditFeedback(props.actionEditSource)
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
const effectiveStateCurveFocusMode = computed(() =>
  props.stateCurveFocusMode === 'selected' && props.selectedStateCurvePointId
    ? 'selected'
    : 'all'
);
const isStateCurveSelectedFocusActive = computed(
  () => effectiveStateCurveFocusMode.value === 'selected'
);
const stateCurveBaseTrackRows = computed(() => {
  const activeLayers = new Set(activeStateCurveLayerKeys.value);
  return (stateCurves.value?.tracks ?? [])
    .map((track, trackIndex) => ({
      track,
      trackIndex,
    }))
    .filter(({ track }) => (track.pointCount ?? 0) > 0)
    .filter(({ track }) => isStateCurveTrackVisible(track.trackKey))
    .map(({ track, trackIndex }) => {
      const layerRows = (track.layers ?? []).filter(
        layer => activeLayers.has(layer.key) && (layer.pointCount ?? 0) > 0
      );
      const visiblePointRows = createStateCurveVisiblePointRows(
        track,
        layerRows,
        trackIndex
      );
      return {
        ...track,
        visibleLayers: layerRows,
        visiblePointRows,
        trackIndex,
      };
    })
    .filter(track => track.visiblePointRows.length > 0);
});
const stateCurveNavigationPointRows = computed(() =>
  stateCurveBaseTrackRows.value
    .flatMap(track => track.visiblePointRows)
    .slice()
    .sort(compareStateCurvePointRows)
);
const selectedStateCurveNavigationIndex = computed(() =>
  stateCurveNavigationPointRows.value.findIndex(
    point => point.statePointId === props.selectedStateCurvePointId
  )
);
const selectedStateCurveNavigationPoint = computed(() =>
  selectedStateCurveNavigationIndex.value >= 0
    ? stateCurveNavigationPointRows.value[
        selectedStateCurveNavigationIndex.value
      ]
    : null
);
const selectedStateCurveFrameGroupRows = computed(() => {
  const selectedPoint = selectedStateCurveNavigationPoint.value;
  if (!selectedPoint) {
    return [];
  }
  return stateCurveNavigationPointRows.value.filter(
    point => point.frameGroupKey === selectedPoint.frameGroupKey
  );
});
const stateCurveNavigationSummary = computed(() => {
  const total = stateCurveNavigationPointRows.value.length;
  const selectedIndex = selectedStateCurveNavigationIndex.value;
  return {
    total,
    position: selectedIndex >= 0 ? selectedIndex + 1 : 0,
    canPrevious: selectedIndex > 0,
    canNext: selectedIndex >= 0 && selectedIndex < total - 1,
  };
});
const stateCurveTrackRows = computed(() =>
  stateCurveBaseTrackRows.value
    .map(track => {
      const visiblePointRows = isStateCurveSelectedFocusActive.value
        ? track.visiblePointRows.filter(point =>
            isStateCurvePointInFocus(point)
          )
        : track.visiblePointRows;
      const visibleLayerKeys = new Set(
        visiblePointRows.map(point => point.layerKey)
      );
      return {
        ...track,
        visibleLayers: track.visibleLayers.filter(layer =>
          visibleLayerKeys.has(layer.key)
        ),
        visiblePointRows,
      };
    })
    .filter(track => track.visiblePointRows.length > 0)
);
const stateCurveVisiblePointCount = computed(() =>
  stateCurveTrackRows.value.reduce(
    (sum, track) => sum + track.visiblePointRows.length,
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

function formatThreeValueGenerationLayerSummary(summary) {
  if (!summary || summary.deltaCount <= 0) {
    return '';
  }
  const sampledText =
    summary.sampledDeltaCount > 0 ? ` · 采样 ${summary.sampledDeltaCount}` : '';
  const placeholderText =
    summary.placeholderDeltaCount > 0
      ? ` · 占位 ${summary.placeholderDeltaCount}`
      : '';
  return `生成合同 ${summary.actionCount}动作/${summary.hitCount}命中 · Delta ${summary.deltaCount} · 候选 ${summary.candidateDeltaCount} · 已用 ${summary.appliedDeltaCount}${sampledText}${placeholderText}`;
}

function formatThreeValueRuntimeProjectionSummary(summary) {
  if (!summary || summary.appliedDeltaCount <= 0) {
    return '';
  }
  return `运行投影 HP ${formatNumber(summary.enemyHpDelta)} · 韧性 ${formatNumber(summary.enemyToughnessDelta)} · 能量 ${formatNumber(summary.selfEnergyDelta)} · 日志 ${summary.simLogCount}`;
}

function createThreeValueCalculatorDiagnosticRow({ scope, label, summary }) {
  const calculatorSummary = summary?.calculatorSummary;
  const outputCount =
    calculatorSummary?.outputCount ??
    summary?.deltaCount ??
    summary?.appliedDeltaCount ??
    0;
  if (!calculatorSummary || outputCount <= 0) {
    return null;
  }

  const calculatorText = formatCalculatorCountList(
    calculatorSummary.calculatorKeyCounts,
    item => formatThreeValueCalculatorKey(item.key, item.trackKeys?.[0])
  );
  const kindText = formatCalculatorCountList(
    calculatorSummary.kindCounts,
    item => formatThreeValueCalculationKind(item.kind)
  );
  const statusText = formatCalculatorCountList(
    calculatorSummary.statusCounts,
    item => formatThreeValueCalculationStatus(item.status)
  );
  const unresolvedText = formatCalculatorCountList(
    calculatorSummary.unresolvedItemCounts,
    item => formatThreeValueUnresolvedItems([item.item])
  );
  const detailParts = [
    calculatorText ? `适配器 ${calculatorText}` : '',
    kindText ? `来源 ${kindText}` : '',
    statusText ? `状态 ${statusText}` : '',
    unresolvedText ? `缺口 ${unresolvedText}` : '',
  ].filter(Boolean);

  return {
    scope,
    label,
    summary: `${calculatorSummary.calculatorCount}类/${outputCount}条 · 可替换 ${calculatorSummary.calculatorReplaceableDeltaCount}`,
    detail: detailParts.join(' · '),
  };
}

function focusThreeValueCalculatorScope(scope) {
  emit('focus-three-value-calculator-scope', scope);
}

function formatCalculatorCountList(items, formatter, limit = 3) {
  const rows = (items ?? []).filter(item => (item.count ?? 0) > 0);
  if (rows.length === 0) {
    return '';
  }
  const visible = rows.slice(0, limit).map(item => {
    const label = formatter(item);
    return `${label} ${item.count}`;
  });
  const hiddenCount = rows.length - visible.length;
  return hiddenCount > 0
    ? `${visible.join(' / ')} / +${hiddenCount}`
    : visible.join(' / ');
}

function formatStateCurveTrackSummary(track) {
  const visiblePointCount =
    track.visiblePointRows?.length ??
    (track.visibleLayers ?? []).reduce(
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
  return getStateCurveLayerRole(key).label;
}

function getStateCurveLayerRole(key) {
  return (
    STATE_CURVE_LAYER_OPTIONS.find(layer => layer.key === key) ?? {
      key,
      label: key ?? '状态',
      roleLabel: '未知层',
      participationLabel: '待确认',
      pointParticipationLabel: '参与范围待确认',
    }
  );
}

function formatStateCurveActiveTrackSummary() {
  const visible = stateCurveTrackOptions.value.filter(track =>
    isStateCurveTrackVisible(track.trackKey)
  );
  if (visible.length === 0) {
    return '无轨道';
  }
  if (visible.length === stateCurveTrackOptions.value.length) {
    return '全部轨道';
  }
  return visible.map(track => track.label).join('/');
}

function createStateCurveVisiblePointRows(track, visibleLayers, trackIndex) {
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
        trackLabel: track.label,
        layerKey: layer.key,
        layerLabel: formatStateCurveLayerLabel(layer.key),
        trackIndex,
        layerIndex,
        pointIndex,
        frameGroupKey: createStateCurveFrameGroupKey(point),
        valueUnit: layer.valueUnit ?? track.valueUnit,
      }))
    )
    .sort(compareStateCurvePointRows);
}

function selectStateCurvePoint(point) {
  emit('select-state-curve-point', point.statePointId);
}

function getActionResultRuntimeTrace(entry) {
  return runtimeTraceByActionId.value.get(entry?.actionId) ?? null;
}

function selectActionResultRuntimePoint(entry) {
  const trace = getActionResultRuntimeTrace(entry);
  if (!trace?.firstStatePointId) {
    return;
  }
  emit('select-action-result', {
    actionId: trace.actionId,
    statePointId: trace.firstStatePointId,
  });
}

function isActionResultRuntimeSelected(entry) {
  const trace = getActionResultRuntimeTrace(entry);
  return (
    Boolean(props.selectedStateCurvePointId) &&
    Boolean(trace?.statePointIds.includes(props.selectedStateCurvePointId))
  );
}

function getActionResultLocationStatus(entry) {
  return isActionResultRuntimeSelected(entry) ? 'selected-result' : 'available';
}

function getActionResultSelectedStatePointId(entry) {
  return isActionResultRuntimeSelected(entry)
    ? props.selectedStateCurvePointId
    : '';
}

function isActionResultCurrentAction(entry) {
  return Boolean(
    props.selectedActionId && entry?.actionId === props.selectedActionId
  );
}

function getActionResultEditSource(entry) {
  return getEditSourceForAction(entry?.actionId);
}

function shouldShowActionResultEditSource(entry) {
  return Boolean(
    getActionResultEditSource(entry) &&
    !isActionEditFeedbackForAction(entry?.actionId)
  );
}

function focusActionEditSource(entry) {
  const source = getActionResultEditSource(entry);
  if (!source) {
    return;
  }
  emit('focus-action-edit-source', source);
}

function focusActionEditFeedback() {
  if (!isValidActionEditSource(props.actionEditSource)) {
    return;
  }
  emit('focus-action-edit-source', props.actionEditSource);
}

function selectActionEditFeedbackResult() {
  const feedback = actionEditFeedback.value;
  if (!feedback?.runtimeStatePointId) {
    return;
  }
  emit('select-action-result', {
    actionId: feedback.actionId,
    statePointId: feedback.runtimeStatePointId,
  });
}

function createActionEditFeedback(source) {
  if (!isValidActionEditSource(source)) {
    return null;
  }
  const action = props.actionResultTimeline.find(
    entry => entry.actionId === source.actionId
  );
  const trace = runtimeTraceByActionId.value.get(source.actionId);
  const runtimeStatePointId = trace?.firstStatePointId ?? '';
  const resultFocused = Boolean(
    runtimeStatePointId &&
    props.selectedStateCurvePointId &&
    props.selectedStateCurvePointId === runtimeStatePointId
  );
  const resultFocusStatus = runtimeStatePointId
    ? resultFocused
      ? 'focused'
      : 'available'
    : 'unavailable';
  const locationChain = createActionEditFeedbackLocationChain({
    actionId: source.actionId,
    resultFocusStatus,
    runtimeStatePointId,
  });
  return {
    actionId: source.actionId,
    actionName: action?.actionName ?? source.actionId,
    fieldKey: source.fieldKey,
    label: source.label,
    changeSummary: source.changeSummary ?? '',
    display: formatActionEditSourceDisplay(source),
    editOrigin: source.editOrigin ?? '',
    originLabel: source.originLabel ?? '',
    originStatePointId: source.originStatePointId ?? '',
    originTrackKey: source.originTrackKey ?? '',
    originFrameLabel: source.originFrameLabel ?? '',
    originPointDisplay: formatActionEditFeedbackOriginPoint(source),
    runtimeStatePointId,
    runtimeDeltaCount: trace?.count ?? 0,
    runtimePointDisplay: formatActionEditFeedbackRuntimePoint({
      runtimeStatePointId,
      runtimeDeltaCount: trace?.count ?? 0,
      resultFocusStatus,
    }),
    hasResultPointMap: Boolean(
      source.originStatePointId || runtimeStatePointId
    ),
    resultFocused,
    resultFocusStatus,
    resultFocusLabel:
      formatActionEditFeedbackResultFocusLabel(resultFocusStatus),
    locationChain,
  };
}

function createActionEditFeedbackLocationChain({
  actionId = '',
  resultFocusStatus = 'unavailable',
  runtimeStatePointId = '',
} = {}) {
  const actionSynced = Boolean(actionId && props.selectedActionId === actionId);
  const resultSynced = resultFocusStatus === 'focused';
  const detailSynced = Boolean(
    runtimeStatePointId &&
    props.runtimeSelectedDetail?.statePointId === runtimeStatePointId
  );
  const items = [
    actionSynced ? '动作已选中' : '动作待选中',
    resultSynced
      ? '结果已定位'
      : resultFocusStatus === 'available'
        ? '结果待定位'
        : '无结果点',
    detailSynced
      ? '详情已同步'
      : runtimeStatePointId
        ? '详情待同步'
        : '详情无结果',
  ];
  const syncedCount = [actionSynced, resultSynced, detailSynced].filter(
    Boolean
  ).length;
  const totalCount = 3;
  const status =
    resultFocusStatus === 'unavailable'
      ? 'unavailable'
      : syncedCount === totalCount
        ? 'synced'
        : 'pending';
  return {
    status,
    actionSynced,
    resultSynced,
    detailSynced,
    syncedCount,
    totalCount,
    label: `${syncedCount}/${totalCount}已同步`,
    detail: items.join(' · '),
  };
}

function formatActionEditFeedbackOriginPoint(source) {
  if (!source?.originStatePointId) {
    return '无原结果点';
  }
  const parts = [
    source.originFrameLabel || '原结果点',
    formatActionEditFeedbackTrack(source.originTrackKey),
  ].filter(Boolean);
  return parts.join(' · ');
}

function formatActionEditFeedbackRuntimePoint({
  runtimeStatePointId,
  runtimeDeltaCount,
  resultFocusStatus,
}) {
  if (!runtimeStatePointId) {
    return '暂无刷新结果点';
  }
  return `${formatActionEditFeedbackResultFocusLabel(resultFocusStatus)} · ${runtimeDeltaCount}条运行结果`;
}

function formatActionEditFeedbackTrack(trackKey) {
  if (trackKey === 'enemyHpDamage') {
    return '敌人 HP';
  }
  if (trackKey === 'enemyToughnessDamage') {
    return '敌人韧性';
  }
  if (trackKey === 'selfEnergyChange') {
    return '自身能量';
  }
  return '';
}

function isValidActionEditSource(source) {
  return Boolean(source?.actionId && source?.fieldKey && source?.label);
}

function isActionEditFeedbackForAction(actionId) {
  return Boolean(
    actionEditFeedback.value?.actionId &&
    actionEditFeedback.value.actionId === actionId
  );
}

function formatActionEditFeedbackResultFocusLabel(status) {
  if (status === 'focused') {
    return '结果已定位';
  }
  if (status === 'available') {
    return '结果未定位';
  }
  return '无结果点';
}

function createActionResultRuntimeTrace(actionId, rows) {
  const sortedRows = [...rows].sort(compareRuntimeTraceRows);
  const sourceDeltaIds = uniqueDisplayValues(
    sortedRows.map(item => item.row.sourceDeltaId)
  );
  const statePointIds = uniqueDisplayValues(
    sortedRows.map(item => item.statePointId)
  );
  return {
    actionId,
    actionName:
      sortedRows.find(item => item.row?.actionName)?.row?.actionName ??
      actionId,
    count: sortedRows.length,
    firstStatePointId: statePointIds[0] ?? '',
    statePointIds,
    sourceDeltaIds,
    rows: sortedRows,
    trackSummary: sortedRows
      .map(item => formatRuntimeTraceTrack(item.row))
      .filter(Boolean)
      .join(' / '),
    shortSourceDeltaIds: sourceDeltaIds.map(formatSourceDeltaShortId),
  };
}

function createSelectedActionContribution(trace) {
  const rows = ACTION_CONTRIBUTION_TRACKS.map(track =>
    createActionContributionRow(trace, track)
  );
  const activeRow =
    rows.find(row => row.active) ?? rows.find(row => row.count > 0);
  return {
    actionId: trace.actionId,
    actionName: trace.actionName ?? trace.actionId ?? '动作',
    appliedDeltaCount: trace.count,
    rows,
    detail: activeRow ? createActionContributionDetail(activeRow) : null,
  };
}

function createActionContributionRow(trace, track) {
  const matchingRows = trace.rows.filter(
    item => item.row?.trackKey === track.trackKey
  );
  const value = matchingRows.reduce(
    (sum, item) => sum + (Number(item.row?.[track.valueField]) || 0),
    0
  );
  const sourceDeltaIds = uniqueDisplayValues(
    matchingRows.map(item => item.row?.sourceDeltaId)
  );
  const active = matchingRows.some(
    item => item.statePointId === props.selectedStateCurvePointId
  );
  return {
    ...track,
    value,
    count: matchingRows.length,
    active,
    firstStatePointId: matchingRows[0]?.statePointId ?? '',
    sourceDeltaIds,
    shortSourceDeltaIds: sourceDeltaIds.map(formatSourceDeltaShortId),
    detailItems: matchingRows,
  };
}

function createActionContributionDetail(row) {
  const item =
    row.detailItems.find(
      detail => detail.statePointId === props.selectedStateCurvePointId
    ) ?? row.detailItems[0];
  if (!item) {
    return null;
  }
  const runtimeRow = item.row ?? {};
  const point = item.point ?? {};
  const sourceIds = point.sourceIds ?? {};
  const calculator = runtimeRow.calculator ?? point.calculator ?? {};
  const calculatorKey =
    runtimeRow.calculatorKey ?? point.calculatorKey ?? calculator.key;
  const calculationKind =
    runtimeRow.calculationKind ?? point.calculationKind ?? calculator.kind;
  const calculationStatus =
    runtimeRow.calculationStatus ??
    point.calculationStatus ??
    calculator.status;
  const unresolvedItems = calculator.unresolved ?? [];
  return {
    trackKey: row.trackKey,
    label: row.label,
    statePointId: item.statePointId,
    rows: [
      {
        key: 'statePoint',
        label: '状态点',
        value: item.statePointId,
      },
      {
        key: 'sourceDelta',
        label: 'Delta',
        value: formatSourceDeltaShortId(runtimeRow.sourceDeltaId),
        rawValue: runtimeRow.sourceDeltaId,
      },
      {
        key: 'sourceIds',
        label: '来源',
        value: formatActionContributionSourceSummary(sourceIds),
      },
      {
        key: 'calculator',
        label: '适配器',
        value: formatThreeValueCalculatorKey(calculatorKey, row.trackKey),
        rawValue: calculatorKey,
      },
      {
        key: 'kind',
        label: '来源类型',
        value: formatThreeValueCalculationKind(calculationKind, row.trackKey),
        rawValue: calculationKind,
      },
      {
        key: 'status',
        label: '公式状态',
        value: formatThreeValueCalculationStatus(calculationStatus),
        rawValue: calculationStatus,
      },
      {
        key: 'unresolved',
        label: '缺口',
        value: formatThreeValueUnresolvedItems(unresolvedItems),
        rawValue: unresolvedItems.join(','),
      },
    ],
  };
}

function formatRuntimeResultMeta(detail) {
  const source = formatSourceDeltaShortId(detail?.sourceDeltaId);
  const sourceText =
    source && source !== '-' ? `Delta ${source}` : 'Delta 待定位';
  const editSource = getRuntimeResultEditSource(detail);
  const editSourceText =
    editSource && !isActionEditFeedbackForAction(detail?.actionId)
      ? ` · ${formatActionEditSourceDisplay(editSource)}`
      : '';
  return isRuntimeResultCurrentAction(detail)
    ? `正在编辑 · ${draftResultStatus.value.resultLabel} · ${draftResultStatus.value.refreshLabel}${editSourceText} · ${sourceText}`
    : sourceText;
}

function formatActionEditSourceDisplay(source) {
  if (!source) {
    return '';
  }
  return [source.label, source.changeSummary].filter(Boolean).join(' ');
}

function getRuntimeResultEditSource(detail) {
  return getEditSourceForAction(detail?.actionId);
}

function getEditSourceForAction(actionId) {
  const source = props.actionEditSource;
  if (!source?.actionId || !actionId || source.actionId !== actionId) {
    return null;
  }
  return isValidActionEditSource(source) ? source : null;
}

function createDraftResultStatus(status) {
  if (status === '有未保存改动') {
    return {
      key: 'dirty',
      dirty: true,
      resultLabel: '草稿已变更',
      refreshKey: 'current-draft',
      refreshLabel: '结果已随当前草稿刷新',
    };
  }
  if (status === '已保存草稿') {
    return {
      key: 'saved',
      dirty: false,
      resultLabel: '草稿已保存',
      refreshKey: 'saved-draft',
      refreshLabel: '结果来自已保存草稿',
    };
  }
  if (status === '已恢复草稿') {
    return {
      key: 'restored',
      dirty: false,
      resultLabel: '草稿已恢复',
      refreshKey: 'restored-draft',
      refreshLabel: '结果来自恢复草稿',
    };
  }
  if (status === '已重置草稿') {
    return {
      key: 'reset',
      dirty: false,
      resultLabel: '草稿已重置',
      refreshKey: 'reset-draft',
      refreshLabel: '结果来自重置草稿',
    };
  }
  if (status === '草稿不可用') {
    return {
      key: 'unavailable',
      dirty: false,
      resultLabel: '草稿不可用',
      refreshKey: 'preview-only',
      refreshLabel: '结果仅当前预览',
    };
  }
  return {
    key: 'unsaved',
    dirty: true,
    resultLabel: '未保存草稿',
    refreshKey: 'unsaved-draft',
    refreshLabel: '结果来自未保存草稿',
  };
}

function isRuntimeResultCurrentAction(detail) {
  return Boolean(
    props.selectedActionId && detail?.actionId === props.selectedActionId
  );
}

function formatRuntimeResultFrame(detail) {
  return detail?.frameLabel || `${detail?.timeMs ?? 0}ms`;
}

function formatRuntimeResultDelta(detail) {
  return detail?.trackKey === 'selfEnergyChange'
    ? formatSignedNumber(detail.delta)
    : formatStateCurveNumber(detail?.delta);
}

function formatRuntimeResultCumulative(detail) {
  return detail?.trackKey === 'selfEnergyChange'
    ? formatSignedNumber(detail.cumulative)
    : formatStateCurveNumber(detail?.cumulative);
}

function hasRuntimeResultState(detail) {
  return Boolean(
    detail?.stateLabel ||
    detail?.stateValue != null ||
    detail?.stateValueStatus ||
    detail?.baselineStatus
  );
}

function formatRuntimeResultStateLabel(detail) {
  return detail?.stateLabel || '状态值';
}

function formatRuntimeResultStateValue(detail) {
  if (detail?.stateValue == null || detail.stateValue === '') {
    return '待确认';
  }
  return formatStateCurveNumber(detail.stateValue);
}

function formatRuntimeResultStatus(detail) {
  return detail?.status ?? '-';
}

function createCompactRuntimeResultRows(detail) {
  if (!detail) {
    return [];
  }
  const rows = [
    {
      key: 'point',
      label: '定位',
      value: `${formatRuntimeResultFrame(detail)} · ${
        detail.trackLabel || detail.trackKey || '-'
      }`,
    },
    {
      key: 'delta',
      label: 'Delta',
      value: formatRuntimeResultDelta(detail),
    },
    {
      key: 'cumulative',
      label: '累计',
      value: formatRuntimeResultCumulative(detail),
    },
  ];
  const status = formatRuntimeResultStatus(detail);
  rows.push(
    hasRuntimeResultState(detail)
      ? {
          key: 'state-status',
          label: `${formatRuntimeResultStateLabel(detail)} / 状态`,
          value: `${formatRuntimeResultStateValue(detail)} · ${status}`,
        }
      : {
          key: 'state-status',
          label: '状态',
          value: status,
        }
  );
  return rows;
}

function selectActionContributionRow(row) {
  if (!row?.firstStatePointId) {
    return;
  }
  emit('select-action-contribution-point', row.firstStatePointId);
}

function compareRuntimeTraceRows(left, right) {
  return (
    compareNullableNumber(left.row?.frameIndex, right.row?.frameIndex) ||
    compareNullableNumber(left.row?.sequenceIndex, right.row?.sequenceIndex) ||
    String(left.row?.sourceDeltaId ?? '').localeCompare(
      String(right.row?.sourceDeltaId ?? '')
    )
  );
}

function formatActionResultRuntimeTrace(trace) {
  const sourceText = trace.shortSourceDeltaIds.length
    ? ` · Delta ${trace.shortSourceDeltaIds.join(' / ')}`
    : '';
  return `定位 ${trace.count}条运行结果 · ${trace.trackSummary}${sourceText}`;
}

function formatRuntimeTraceTrack(row) {
  if (row?.trackKey === 'enemyHpDamage') {
    return `HP ${formatStateCurveNumber(row.hpDelta)}`;
  }
  if (row?.trackKey === 'enemyToughnessDamage') {
    return `韧性 ${formatStateCurveNumber(row.toughnessDelta)}`;
  }
  if (row?.trackKey === 'selfEnergyChange') {
    return `能量 ${formatSignedNumber(row.energyDelta)}`;
  }
  return formatStateCurveNumber(row?.delta);
}

function formatActionContributionValue(row) {
  return row.signed
    ? formatSignedNumber(row.value)
    : formatStateCurveNumber(row.value);
}

function formatActionContributionMeta(row) {
  const activeText = row.active ? '详情已同步 · ' : '';
  const resultText = row.count > 0 ? `已应用 ${row.count}条` : '暂无已应用结果';
  const sourceText = row.shortSourceDeltaIds.length
    ? ` · ${row.shortSourceDeltaIds.join(' / ')}`
    : '';
  return `${activeText}${resultText}${sourceText}`;
}

function formatActionContributionSourceSummary(sourceIds) {
  const parts = [
    formatActionContributionSourceList('Skill', sourceIds.skillIds),
    formatActionContributionSourceList('Element', sourceIds.elementConfigIds),
    formatActionContributionSourceList('采样', sourceIds.captureSessionIds),
    formatActionContributionSourceList('Path', sourceIds.pathIds),
  ].filter(Boolean);
  return parts.join(' / ') || '-';
}

function formatActionContributionSourceList(label, values = []) {
  const uniqueValues = uniqueDisplayValues(values).slice(0, 3);
  if (uniqueValues.length === 0) {
    return '';
  }
  const remaining = uniqueDisplayValues(values).length - uniqueValues.length;
  return `${label} ${uniqueValues.join(', ')}${remaining > 0 ? ` +${remaining}` : ''}`;
}

function formatSourceDeltaShortId(sourceDeltaId) {
  const parts = String(sourceDeltaId ?? '')
    .split('|')
    .filter(Boolean);
  return parts.slice(0, 2).join('|') || '-';
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

function setStateCurveFocusMode(mode) {
  if (mode === 'selected' && !props.selectedStateCurvePointId) {
    return;
  }
  emit(
    'update-state-curve-focus-mode',
    mode === 'selected' ? 'selected' : 'all'
  );
}

function selectAdjacentStateCurvePoint(direction) {
  const offset = Number(direction) < 0 ? -1 : 1;
  const nextPoint =
    stateCurveNavigationPointRows.value[
      selectedStateCurveNavigationIndex.value + offset
    ];
  if (nextPoint) {
    emit('select-state-curve-point', nextPoint.statePointId);
  }
}

function formatStateCurveNavigationPosition() {
  const { position, total } = stateCurveNavigationSummary.value;
  return total > 0 ? `${position}/${total}` : '0/0';
}

function selectStateCurveFrameGroupPoint(point) {
  emit('select-state-curve-point', point.statePointId);
}

function formatStateCurveFrameGroupOption(point) {
  return `${formatStateCurveTrackShortLabel(point.trackKey)} ${point.layerLabel} Δ${formatStateCurveNumber(point.delta)}`;
}

function formatStateCurveTrackShortLabel(trackKey) {
  if (trackKey === 'enemyHpDamage') {
    return 'HP';
  }
  if (trackKey === 'enemyToughnessDamage') {
    return '韧性';
  }
  if (trackKey === 'selfEnergyChange') {
    return '能量';
  }
  return trackKey ?? '状态';
}

function isStateCurvePointInFocus(point) {
  return (
    !isStateCurveSelectedFocusActive.value ||
    point.statePointId === props.selectedStateCurvePointId
  );
}

function compareStateCurvePointRows(left, right) {
  return (
    compareNullableNumber(left.frameIndex, right.frameIndex) ||
    compareNullableNumber(left.timeMs, right.timeMs) ||
    compareNullableNumber(left.trackIndex, right.trackIndex) ||
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
  width: 100%;
  padding: 9px 10px;
  border: 0;
  border-left: 3px solid #79c7b9;
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.1);
  text-align: left;
  cursor: pointer;
}

.action-result-row:hover,
.action-result-row:focus {
  background: rgba(121, 199, 185, 0.16);
}

.action-result-row.selected {
  background: rgba(121, 199, 185, 0.2);
}

.action-result-row.current-action {
  border-left-color: #f2b366;
}

.action-result-row:disabled {
  cursor: default;
  opacity: 0.82;
}

.action-edit-feedback {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border: 1px solid rgba(242, 179, 102, 0.22);
  border-radius: 4px;
  background: rgba(242, 179, 102, 0.08);
}

.action-edit-feedback-status {
  width: max-content;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(242, 179, 102, 0.12);
  color: #ffd8a6;
  font-size: 11px;
  font-weight: 700;
}

.action-edit-feedback-main {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.action-edit-feedback-main span,
.action-edit-feedback-main small {
  color: #b8c0c7;
  font-size: 11px;
}

.action-edit-feedback-main strong {
  min-width: 0;
  color: #ffffff;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.action-edit-feedback-main small {
  color: #f2b366;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.action-edit-feedback-main em {
  width: max-content;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.12);
  color: #9ce0d2;
  font-size: 11px;
  font-style: normal;
  font-weight: 700;
}

.action-edit-feedback-result-map {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
  min-width: 0;
}

.action-edit-feedback-result-map span {
  min-width: 0;
  padding: 5px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.045);
  color: #8f9aa3;
  font-size: 10px;
  font-weight: 700;
}

.action-edit-feedback-result-map strong {
  display: block;
  margin-top: 2px;
  min-width: 0;
  overflow-wrap: anywhere;
  color: #dff9f3;
  font-size: 11px;
  font-weight: 700;
}

.action-edit-feedback-location-chain {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 5px 7px;
  border: 1px solid rgba(121, 199, 185, 0.18);
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.08);
}

.action-edit-feedback-location-chain[data-chain-status='pending'] {
  border-color: rgba(230, 162, 60, 0.22);
  background: rgba(230, 162, 60, 0.08);
}

.action-edit-feedback-location-chain[data-chain-status='unavailable'] {
  border-color: rgba(245, 108, 108, 0.2);
  background: rgba(245, 108, 108, 0.08);
}

.action-edit-feedback-location-chain span,
.action-edit-feedback-location-chain strong,
.action-edit-feedback-location-chain small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-edit-feedback-location-chain span {
  color: #9ce0d2;
  font-size: 11px;
  font-weight: 700;
}

.action-edit-feedback-location-chain[data-chain-status='pending'] span,
.action-edit-feedback-location-chain[data-chain-status='pending'] strong {
  color: #efc574;
}

.action-edit-feedback-location-chain[data-chain-status='unavailable'] span,
.action-edit-feedback-location-chain[data-chain-status='unavailable'] strong {
  color: #ffb3b3;
}

.action-edit-feedback-location-chain strong {
  color: #dff9f3;
  font-size: 11px;
}

.action-edit-feedback-location-chain small {
  color: #aeb8c1;
  font-size: 11px;
}

.action-edit-feedback-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.action-edit-feedback-focus {
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid rgba(242, 179, 102, 0.34);
  border-radius: 4px;
  background: rgba(242, 179, 102, 0.12);
  color: #ffd8a6;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.action-edit-feedback-focus:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.action-edit-feedback-focus:hover,
.action-edit-feedback-focus:focus {
  outline: none;
  background: rgba(242, 179, 102, 0.18);
  box-shadow: 0 0 0 2px rgba(242, 179, 102, 0.16);
}

.calculator-diagnostic-list {
  display: grid;
  gap: 6px;
}

.calculator-diagnostic-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 0.8fr) minmax(0, 1.3fr);
  align-items: center;
  gap: 8px;
  min-width: 0;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-left: 3px solid #a6b7ff;
  border-radius: 4px;
  background: rgba(166, 183, 255, 0.08);
  text-align: left;
  cursor: pointer;
}

.calculator-diagnostic-row:hover,
.calculator-diagnostic-row:focus {
  background: rgba(166, 183, 255, 0.13);
}

.calculator-diagnostic-row.active {
  background: rgba(166, 183, 255, 0.18);
}

.calculator-diagnostic-row span {
  color: #d9e0ff;
  font-size: 11px;
  font-weight: 700;
}

.calculator-diagnostic-row strong,
.calculator-diagnostic-row small {
  min-width: 0;
  overflow-wrap: anywhere;
}

.calculator-diagnostic-row strong {
  color: #ffffff;
  font-size: 12px;
}

.calculator-diagnostic-row small {
  color: #aeb7c2;
  font-size: 11px;
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

.state-curve-view-summary {
  display: grid;
  grid-template-columns: 72px minmax(70px, 0.6fr) minmax(0, 1.4fr);
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 10px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
}

.state-curve-view-summary[data-calculator-scope='generation'] {
  background: rgba(121, 199, 185, 0.1);
}

.state-curve-view-summary[data-calculator-scope='runtime'] {
  background: rgba(166, 183, 255, 0.1);
}

.state-curve-view-summary span {
  color: #d9dee3;
  font-size: 11px;
  font-weight: 700;
}

.state-curve-view-summary strong,
.state-curve-view-summary small {
  min-width: 0;
  overflow-wrap: anywhere;
}

.state-curve-view-summary strong {
  color: #ffffff;
  font-size: 12px;
}

.state-curve-view-summary small {
  color: #aeb7c2;
  font-size: 11px;
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
  display: grid;
  gap: 2px;
  min-width: 0;
  overflow-wrap: anywhere;
}

.state-curve-layer-toggle strong,
.state-curve-layer-toggle small {
  min-width: 0;
  overflow-wrap: anywhere;
}

.state-curve-layer-toggle strong {
  font-size: 11px;
}

.state-curve-layer-toggle small {
  color: #8f9aa3;
  font-size: 10px;
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
  grid-row: span 3;
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

.state-curve-point-row em {
  min-width: 0;
  overflow-wrap: anywhere;
  color: #a6b7ff;
  font-size: 10px;
  font-style: normal;
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

.action-result-row .action-result-runtime-trace {
  color: #a6b7ff;
}

.action-result-current-action {
  width: max-content;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(242, 179, 102, 0.14);
  color: #f2b366;
  font-weight: 700;
}

.action-result-draft-status {
  width: max-content;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(166, 183, 255, 0.12);
  color: #d9e0ff;
  font-weight: 700;
}

.action-result-refresh-status {
  width: max-content;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.12);
  color: #9ce0d2;
  font-weight: 700;
}

.action-result-location-status,
.action-result-detail-location-status {
  width: max-content;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.16);
  color: #dff9f3;
  font-weight: 700;
}

.action-result-edit-source {
  width: max-content;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(242, 179, 102, 0.12);
  color: #f2b366;
  cursor: pointer;
  font-weight: 700;
}

.action-result-edit-source:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(242, 179, 102, 0.2);
}

.action-contribution-panel {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid rgba(166, 183, 255, 0.2);
  border-radius: 4px;
  background: rgba(166, 183, 255, 0.08);
}

.action-contribution-heading {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.2fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.action-contribution-heading span {
  color: #a6b7ff;
  font-size: 11px;
  font-weight: 700;
}

.action-contribution-heading strong,
.action-contribution-heading small {
  min-width: 0;
  overflow-wrap: anywhere;
}

.action-contribution-heading strong {
  color: #ffffff;
  font-size: 12px;
}

.action-contribution-heading small {
  color: #aeb7c2;
  font-size: 11px;
}

.action-contribution-list {
  display: grid;
  gap: 6px;
}

.action-result-detail-panel {
  display: grid;
  gap: 8px;
  padding: 9px;
  border: 1px solid rgba(121, 199, 185, 0.16);
  border-radius: 4px;
  background: rgba(18, 24, 31, 0.42);
}

.action-result-detail-heading {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) minmax(0, 1.1fr);
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.action-result-detail-heading span {
  color: #79c7b9;
  font-size: 11px;
  font-weight: 700;
}

.action-result-detail-heading strong,
.action-result-detail-heading small {
  min-width: 0;
  overflow-wrap: anywhere;
}

.action-result-detail-heading strong {
  color: #ffffff;
  font-size: 12px;
}

.action-result-detail-heading small {
  color: #aeb7c2;
  font-size: 11px;
  text-align: right;
}

.action-result-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.action-result-detail-row {
  min-width: 0;
  padding: 7px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
}

.action-result-detail-row span {
  display: block;
  margin-bottom: 4px;
  color: #8f9aa3;
  font-size: 10px;
}

.action-result-detail-row strong {
  display: block;
  min-width: 0;
  overflow-wrap: anywhere;
  color: #dff9f3;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.action-contribution-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 0.7fr) minmax(0, 1.3fr);
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding: 8px 9px;
  border: 0;
  border-left: 3px solid rgba(166, 183, 255, 0.55);
  border-radius: 4px;
  background: rgba(18, 24, 31, 0.52);
  text-align: left;
}

.action-contribution-row:not(:disabled) {
  cursor: pointer;
}

.action-contribution-row:not(:disabled):hover,
.action-contribution-row:not(:disabled):focus {
  background: rgba(166, 183, 255, 0.14);
}

.action-contribution-row.active {
  border-left-color: #79c7b9;
  background: rgba(121, 199, 185, 0.16);
}

.action-contribution-row:disabled {
  opacity: 0.72;
}

.action-contribution-row span {
  color: #d9e0ff;
  font-size: 11px;
  font-weight: 700;
}

.action-contribution-row strong,
.action-contribution-row small {
  min-width: 0;
  overflow-wrap: anywhere;
}

.action-contribution-row strong {
  color: #ffffff;
  font-size: 12px;
}

.action-contribution-row small {
  color: #aeb7c2;
  font-size: 11px;
}

.action-contribution-detail {
  display: grid;
  gap: 8px;
  padding: 9px;
  border: 1px solid rgba(121, 199, 185, 0.16);
  border-radius: 4px;
  background: rgba(18, 24, 31, 0.42);
}

.action-contribution-detail-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.action-contribution-detail-heading span {
  color: #79c7b9;
  font-size: 11px;
  font-weight: 700;
}

.action-contribution-detail-heading strong {
  min-width: 0;
  overflow-wrap: anywhere;
  color: #ffffff;
  font-size: 12px;
}

.action-contribution-detail-list {
  display: grid;
  gap: 5px;
}

.action-contribution-detail-row {
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 6px 7px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.035);
}

.action-contribution-detail-row span {
  color: #8f9aa3;
  font-size: 10px;
}

.action-contribution-detail-row strong {
  min-width: 0;
  overflow-wrap: anywhere;
  color: #dff9f3;
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

.state-curve-focus-controls {
  display: inline-flex;
  align-items: center;
  margin-left: auto;
  padding: 2px;
  border: 1px solid rgba(121, 199, 185, 0.16);
  border-radius: 4px;
  background: rgba(18, 23, 28, 0.72);
}

.state-curve-focus-button {
  min-height: 22px;
  min-width: 42px;
  padding: 0 8px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: #8f9aa3;
  font-size: 11px;
  cursor: pointer;
}

.state-curve-focus-button.active {
  background: rgba(121, 199, 185, 0.18);
  color: #dff6f1;
}

.state-curve-focus-button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.state-curve-navigation-controls {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #8f9aa3;
  font-size: 11px;
}

.state-curve-nav-button {
  display: inline-grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 1px solid rgba(121, 199, 185, 0.18);
  border-radius: 4px;
  background: rgba(18, 23, 28, 0.72);
  color: #dff6f1;
  cursor: pointer;
}

.state-curve-nav-button:disabled {
  cursor: not-allowed;
  opacity: 0.38;
}

.state-curve-nav-icon {
  width: 13px;
  height: 13px;
}

.state-curve-frame-group-controls {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  max-width: 100%;
}

.state-curve-frame-group-button {
  min-height: 24px;
  padding: 0 7px;
  border: 1px solid rgba(166, 183, 255, 0.18);
  border-radius: 4px;
  background: rgba(18, 23, 28, 0.72);
  color: #b8c0c7;
  font-size: 11px;
  cursor: pointer;
}

.state-curve-frame-group-button.active {
  border-color: rgba(166, 183, 255, 0.46);
  background: rgba(166, 183, 255, 0.16);
  color: #d9e0ff;
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

@media (max-width: 760px) {
  .action-result-detail-heading,
  .action-contribution-heading,
  .action-contribution-row {
    grid-template-columns: 1fr;
  }

  .action-result-detail-heading small {
    text-align: left;
  }

  .action-result-detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
