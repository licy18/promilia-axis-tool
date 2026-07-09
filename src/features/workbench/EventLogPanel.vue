<template>
  <section
    class="panel event-log-panel"
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
      <Tickets class="panel-icon" />
      <h2>事件日志</h2>
    </div>

    <ol class="event-list">
      <li
        v-for="event in eventLog"
        :key="`${event.type}-${event.timeMs}-${event.actionId ?? 'scenario'}`"
      >
        <span class="time">{{ event.timeMs }}ms</span>
        <span class="type" :class="event.type.toLowerCase()">{{
          event.type
        }}</span>
        <span class="payload">{{ formatPayload(event) }}</span>
      </li>
    </ol>

    <div
      v-if="runtimeSimLogRows.length"
      class="runtime-sim-log"
      data-testid="workbench-runtime-sim-log"
    >
      <div class="runtime-log-heading">
        <span>模拟日志</span>
        <strong data-testid="workbench-runtime-sim-log-filter-count">
          {{ filteredRuntimeSimLogRows.length }}/{{ runtimeSimLogRows.length }}
        </strong>
      </div>
      <div
        class="runtime-log-filter-summary"
        :data-calculator-scope="runtimeLogFilterSummary.scope"
        data-testid="workbench-runtime-sim-log-filter-summary"
      >
        <span>{{ runtimeLogFilterSummary.label }}</span>
        <strong>{{ runtimeLogFilterSummary.count }}</strong>
        <small>{{ runtimeLogFilterSummary.detail }}</small>
      </div>
      <div
        v-if="runtimeLogNavigationStatus.status !== 'none'"
        class="runtime-log-navigation"
        :data-navigation-count="runtimeLogNavigationStatus.navigationCount"
        :data-navigation-index="runtimeLogNavigationStatus.navigationIndex"
        :data-navigation-status="runtimeLogNavigationStatus.status"
        :data-source-count="runtimeLogNavigationStatus.sourceCount"
        :data-source-index="runtimeLogNavigationStatus.sourceIndex"
        :data-state-point-id="runtimeLogNavigationStatus.statePointId"
        data-testid="workbench-runtime-sim-log-navigation"
      >
        <span>日志导航</span>
        <strong>{{ runtimeLogNavigationStatus.label }}</strong>
        <small>{{ runtimeLogNavigationStatus.detail }}</small>
      </div>

      <div
        class="runtime-log-filters"
        data-testid="workbench-runtime-sim-log-filters"
      >
        <div class="runtime-track-filters" aria-label="三值筛选">
          <button
            v-for="option in runtimeTrackFilterOptions"
            :key="option.key"
            type="button"
            class="runtime-filter-button"
            :data-active="runtimeTrackFilter === option.key"
            :data-track-filter="option.key"
            data-testid="workbench-runtime-sim-log-track-filter"
            @click="runtimeTrackFilter = option.key"
          >
            <span>{{ option.label }}</span>
            <strong>{{ option.count }}</strong>
          </button>
        </div>

        <div class="runtime-select-filters">
          <label>
            <span>角色</span>
            <select
              v-model="runtimeActorFilter"
              data-testid="workbench-runtime-sim-log-actor-filter"
            >
              <option
                v-for="option in runtimeActorFilterOptions"
                :key="option.key"
                :value="option.key"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
          <label>
            <span>动作</span>
            <select
              v-model="runtimeActionFilter"
              data-testid="workbench-runtime-sim-log-action-filter"
            >
              <option
                v-for="option in runtimeActionFilterOptions"
                :key="option.key"
                :value="option.key"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
        </div>
      </div>

      <ol class="runtime-log-list">
        <li
          v-for="(row, index) in filteredRuntimeSimLogRows"
          :key="row.sourceDeltaId ?? `${row.eventType}-${index}`"
          class="runtime-log-row"
          :data-selected="isRuntimeLogRowSelected(row, index)"
          :data-state-point-id="getRuntimeStatePointIdByRow(row)"
          data-testid="workbench-runtime-sim-log-row"
          role="button"
          tabindex="0"
          @click="selectRuntimeLog(index)"
          @keydown.enter.prevent="selectRuntimeLog(index)"
          @keydown.space.prevent="selectRuntimeLog(index)"
        >
          <span class="time">{{ formatRuntimeTime(row) }}</span>
          <span class="runtime-track">{{ formatRuntimeTrack(row) }}</span>
          <span class="payload">{{ formatRuntimePayload(row) }}</span>
        </li>
      </ol>

      <p
        v-if="filteredRuntimeSimLogRows.length === 0"
        class="runtime-log-empty"
        data-testid="workbench-runtime-sim-log-empty"
      >
        当前筛选无模拟日志
      </p>

      <div
        v-if="selectedRuntimeLogFilteredOut"
        class="runtime-log-selection-note"
        data-testid="workbench-runtime-sim-log-selection-filtered"
      >
        <span>选中三值点不在当前日志筛选内</span>
        <button
          type="button"
          data-testid="workbench-runtime-sim-log-show-selected"
          @click="showSelectedRuntimeLog"
        >
          显示日志
        </button>
      </div>

      <div
        v-if="selectedRuntimeLog"
        class="runtime-log-detail"
        :data-detail-source="runtimeLogDetailSource"
        data-testid="workbench-runtime-sim-log-detail"
      >
        <div>
          <span>动作</span>
          <strong>{{ runtimeLogDetailAction }}</strong>
        </div>
        <div>
          <span>命中</span>
          <strong>{{ runtimeLogDetailHit }}</strong>
        </div>
        <div>
          <span>三值</span>
          <strong>{{ runtimeLogDetailDelta }}</strong>
        </div>
        <div>
          <span>轨道</span>
          <strong>{{ runtimeLogDetailTrack }}</strong>
        </div>
        <div>
          <span>角色</span>
          <strong>{{ runtimeLogDetailActor }}</strong>
        </div>
        <div>
          <span>状态</span>
          <strong>{{ runtimeLogDetailStatus }}</strong>
        </div>
        <div>
          <span>来源</span>
          <strong>{{ runtimeLogDetailSourceDeltaId }}</strong>
        </div>
        <div>
          <span>状态点</span>
          <strong data-testid="workbench-runtime-sim-log-state-point">
            {{ runtimeLogDetailStatePointId }}
          </strong>
        </div>
        <button
          type="button"
          class="runtime-log-action-focus"
          :data-action-id="runtimeLogActionFocusCommandTarget.actionId"
          :data-focus-field="runtimeLogActionFocusCommandTarget.fieldKey"
          :data-state-point-id="runtimeLogActionFocusCommandTarget.statePointId"
          data-testid="workbench-runtime-sim-log-action-focus"
          :disabled="!runtimeLogActionFocusCommand.enabled"
          @click="focusRuntimeLogAction"
        >
          <EditPen class="runtime-log-action-focus-icon" />
          <span>定位动作</span>
        </button>
        <button
          v-if="runtimeLogResultReturnButtonVisible"
          type="button"
          class="runtime-log-result-return"
          :data-action-id="runtimeLogResultReturnCommandContext.actionId"
          :data-origin-state-point-id="
            runtimeLogResultReturnCommandContext.originStatePointId
          "
          :data-return-status="runtimeLogResultReturnCommandContext.status"
          :data-state-point-id="runtimeLogResultReturnCommandContext.statePointId"
          data-testid="workbench-runtime-sim-log-return-result"
          :disabled="!runtimeLogResultReturnCommand.enabled"
          @click="returnRuntimeLogResult"
        >
          <Aim class="runtime-log-result-return-icon" />
          <span>回到结果点</span>
        </button>
        <div
          v-if="runtimeLogEditContext"
          class="runtime-log-edit-context"
          :data-action-id="runtimeLogEditContext.actionId"
          :data-edit-context-status="runtimeLogEditContext.status"
          :data-edit-focus-field="runtimeLogEditContext.fieldKey"
          :data-edit-focus-label="runtimeLogEditContext.label"
          :data-state-point-id="runtimeLogEditContext.statePointId"
          data-testid="workbench-runtime-sim-log-edit-context"
        >
          <span>编辑焦点已同步</span>
          <strong>{{ runtimeLogEditContext.label }}</strong>
          <small>{{ runtimeLogEditContext.summary }}</small>
        </div>
        <div
          v-if="runtimeLogDetailHandoff"
          class="runtime-log-detail-handoff"
          :data-detail-source="runtimeLogDetailHandoff.source"
          :data-state-point-id="runtimeLogDetailHandoff.statePointId"
          data-testid="workbench-runtime-sim-log-detail-handoff"
        >
          <span>完整详情</span>
          <strong>{{ runtimeLogDetailHandoff.label }}</strong>
          <small>{{ runtimeLogDetailHandoff.detail }}</small>
        </div>
      </div>

      <div
        v-if="selectedRuntimeLog && !runtimeLogDetailHandoff"
        class="runtime-contribution-detail"
        data-testid="workbench-runtime-sim-log-contribution"
      >
        <div class="runtime-detail-heading">三值贡献</div>
        <div
          v-for="item in selectedRuntimeContributionRows"
          :key="item.key"
          class="runtime-contribution-row"
          data-testid="workbench-runtime-sim-log-contribution-row"
        >
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>

      <div
        v-if="selectedRuntimeLogPoint && !runtimeLogDetailHandoff"
        class="runtime-source-detail"
        data-testid="workbench-runtime-sim-log-source"
      >
        <div class="runtime-detail-heading">来源标注</div>
        <div
          v-for="item in selectedRuntimeSourceRows"
          :key="item.key"
          class="runtime-source-row"
          data-testid="workbench-runtime-sim-log-source-row"
        >
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>

      <div
        v-if="selectedRuntimeCalculatorRows.length && !runtimeLogDetailHandoff"
        class="runtime-calculator-detail"
        data-testid="workbench-runtime-sim-log-calculator"
      >
        <div class="runtime-detail-heading">公式适配器</div>
        <div
          v-for="item in selectedRuntimeCalculatorRows"
          :key="item.key"
          class="runtime-calculator-row"
          :data-calculator-key="item.key"
          :title="String(item.rawValue ?? item.value ?? '')"
          data-testid="workbench-runtime-sim-log-calculator-row"
        >
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { Aim, EditPen, Tickets } from '@element-plus/icons-vue';
import { createRuntimeDetailCalculatorRows } from './runtimeSelectedDetail';
import { createRuntimeResultReturnContext } from './runtimeResultReturnContext';
import { createRuntimeStatePointContexts } from './runtimeProjectionPoints';
import {
  createWorkbenchFlowRuntimeActionEditTarget,
  createWorkbenchRuntimeReviewPanelView,
  resolveWorkbenchMainFlowActionEditTarget,
} from './workbenchFlowModel';
import {
  WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS,
  createWorkbenchRuntimeReviewOperationCommand,
  createWorkbenchRuntimeReviewPanelCommandView,
  createWorkbenchRuntimeSelectionFlowActionFromSurface,
} from './workbenchMainFlowActions';
import {
  createRuntimeFocusSourceView,
  isRuntimeLogFocusSource,
} from './runtimeFocusSource';

const props = defineProps({
  eventLog: {
    type: Array,
    required: true,
  },
  runtimeProjection: {
    type: Object,
    default: null,
  },
  selectedStateCurvePointId: {
    type: String,
    default: '',
  },
  runtimeSelectedDetail: {
    type: Object,
    default: null,
  },
  calculatorDiagnosticFocus: {
    type: Object,
    default: null,
  },
  runtimeLogFocus: {
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

const selectedRuntimeLogIndex = ref(0);
const runtimeTrackFilter = ref('all');
const runtimeActorFilter = ref('all');
const runtimeActionFilter = ref('all');
const runtimeStatePointContexts = computed(() =>
  createRuntimeStatePointContexts(props.runtimeProjection)
);
const runtimeContextByRow = computed(
  () =>
    new Map(
      runtimeStatePointContexts.value.map(context => [context.row, context])
    )
);
const runtimeSimLogRows = computed(() =>
  runtimeStatePointContexts.value.map(context => context.row)
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
const flowSelectedStatePointId = computed(
  () => runtimeReviewContextView.value.selectedStatePointId
);
const flowRuntimeFocusSource = computed(
  () => runtimeReviewContextView.value.source
);
const flowRuntimeFocusSourceView = computed(() =>
  runtimeReviewPanelView.value.sourceView ??
  createRuntimeFocusSourceView(flowRuntimeFocusSource.value)
);
const flowEditResult = computed(
  () => props.flowModel?.editResult ?? props.actionEditResultContext
);
const runtimeTrackFilterOptions = computed(() => {
  const counts = countRuntimeOptions(runtimeSimLogRows.value, 'trackKey');
  return [
    { key: 'all', label: '全部', count: runtimeSimLogRows.value.length },
    {
      key: 'enemyHpDamage',
      label: 'HP',
      count: counts.get('enemyHpDamage') ?? 0,
    },
    {
      key: 'enemyToughnessDamage',
      label: '韧性',
      count: counts.get('enemyToughnessDamage') ?? 0,
    },
    {
      key: 'selfEnergyChange',
      label: '能量',
      count: counts.get('selfEnergyChange') ?? 0,
    },
  ];
});
const runtimeActorFilterOptions = computed(() =>
  createRuntimeSelectOptions({
    rows: runtimeSimLogRows.value,
    keyField: 'actorId',
    labelField: 'actorName',
    allLabel: '全部角色',
    fallbackLabel: '系统',
  })
);
const runtimeActionFilterOptions = computed(() =>
  createRuntimeSelectOptions({
    rows: runtimeSimLogRows.value,
    keyField: 'actionId',
    labelField: 'actionName',
    allLabel: '全部动作',
    fallbackLabel: '系统',
  })
);
const filteredRuntimeSimLogRows = computed(() =>
  runtimeSimLogRows.value.filter(row => {
    if (
      runtimeTrackFilter.value !== 'all' &&
      row.trackKey !== runtimeTrackFilter.value
    ) {
      return false;
    }
    if (
      runtimeActorFilter.value !== 'all' &&
      String(row.actorId ?? 'system') !== runtimeActorFilter.value
    ) {
      return false;
    }
    if (
      runtimeActionFilter.value !== 'all' &&
      String(row.actionId ?? 'system') !== runtimeActionFilter.value
    ) {
      return false;
    }
    return true;
  })
);
const runtimeLogFilterSummary = computed(() => {
  const focusSourceView = flowRuntimeFocusSourceView.value;
  const scope = focusSourceView.isRuntimeLogFocusSource
    ? focusSourceView.runtimeLogScope
    : props.calculatorDiagnosticFocus?.scope === 'runtime'
      ? 'runtime'
      : 'manual';
  const scopeView = createRuntimeFocusSourceView(scope);
  return {
    scope,
    label: scopeView.runtimeLogLabel,
    count: `${filteredRuntimeSimLogRows.value.length}/${runtimeSimLogRows.value.length}条`,
    detail: [
      getRuntimeTrackFilterLabel(runtimeTrackFilter.value),
      getRuntimeSelectFilterLabel(
        runtimeActorFilter.value,
        runtimeActorFilterOptions.value
      ),
      getRuntimeSelectFilterLabel(
        runtimeActionFilter.value,
        runtimeActionFilterOptions.value
      ),
    ].join(' · '),
  };
});
const runtimeLogNavigationStatus = computed(() =>
  createRuntimeLogNavigationStatus({
    selectedStatePointId: flowSelectedStatePointId.value,
    rows: runtimeSimLogRows.value,
    filteredRows: filteredRuntimeSimLogRows.value,
  })
);
const selectedRuntimeHiddenLogRow = computed(() => {
  if (!flowSelectedStatePointId.value) {
    return null;
  }
  const row = runtimeSimLogRows.value.find(
    row => getRuntimeStatePointIdByRow(row) === flowSelectedStatePointId.value
  );
  if (!row) {
    return null;
  }
  const visible = filteredRuntimeSimLogRows.value.some(
    row => getRuntimeStatePointIdByRow(row) === flowSelectedStatePointId.value
  );
  return visible ? null : row;
});
const selectedRuntimeLogFilteredOut = computed(() =>
  Boolean(selectedRuntimeHiddenLogRow.value)
);
const selectedRuntimeLog = computed(
  () => filteredRuntimeSimLogRows.value[selectedRuntimeLogIndex.value] ?? null
);
const selectedRuntimeLogPoint = computed(() =>
  getRuntimePointByRow(selectedRuntimeLog.value)
);
const selectedRuntimeStatePointId = computed(() =>
  getRuntimeStatePointIdByRow(selectedRuntimeLog.value)
);
const matchedRuntimeSelectedDetail = computed(() => {
  const selectedDetail =
    runtimeReviewPanelView.value.selectedDetail ?? props.runtimeSelectedDetail;
  if (
    !selectedDetail?.statePointId ||
    selectedDetail.statePointId !== selectedRuntimeStatePointId.value
  ) {
    return null;
  }
  return selectedDetail;
});
const runtimeLogDetailSource = computed(() =>
  matchedRuntimeSelectedDetail.value
    ? 'runtime-selected-detail'
    : 'runtime-log-fallback'
);
const runtimeLogDetailHandoff = computed(() =>
  matchedRuntimeSelectedDetail.value
    ? {
        source: 'runtime-selected-detail',
        statePointId: matchedRuntimeSelectedDetail.value.statePointId,
        label: '三值详情面板',
        detail: [
          matchedRuntimeSelectedDetail.value.trackLabel ??
            formatRuntimeTrack(selectedRuntimeLog.value),
          matchedRuntimeSelectedDetail.value.frameLabel ??
            formatRuntimeTime(selectedRuntimeLog.value),
        ]
          .filter(Boolean)
          .join(' · '),
      }
    : null
);
const runtimeLogDetailAction = computed(
  () =>
    matchedRuntimeSelectedDetail.value?.actionName ||
    matchedRuntimeSelectedDetail.value?.actionId ||
    selectedRuntimeLog.value?.actionName ||
    selectedRuntimeLog.value?.actionId ||
    '动作'
);
const runtimeLogDetailHit = computed(
  () =>
    matchedRuntimeSelectedDetail.value?.hitKey ??
    selectedRuntimeLog.value?.hitKey ??
    'hit'
);
const runtimeLogDetailDelta = computed(() =>
  matchedRuntimeSelectedDetail.value
    ? formatRuntimeDetailDelta(matchedRuntimeSelectedDetail.value)
    : formatRuntimeDelta(selectedRuntimeLog.value)
);
const runtimeLogDetailTrack = computed(
  () =>
    matchedRuntimeSelectedDetail.value?.trackLabel ??
    formatRuntimeTrack(selectedRuntimeLog.value)
);
const runtimeLogDetailActor = computed(
  () =>
    matchedRuntimeSelectedDetail.value?.actorName ??
    matchedRuntimeSelectedDetail.value?.actorId ??
    selectedRuntimeLog.value?.actorName ??
    selectedRuntimeLog.value?.actorId ??
    '系统'
);
const runtimeLogDetailStatus = computed(
  () =>
    matchedRuntimeSelectedDetail.value?.status ??
    formatRuntimeStatus(selectedRuntimeLog.value)
);
const runtimeLogDetailSourceDeltaId = computed(
  () =>
    matchedRuntimeSelectedDetail.value?.sourceDeltaId ??
    selectedRuntimeLog.value?.sourceDeltaId ??
    ''
);
const runtimeLogDetailStatePointId = computed(
  () =>
    matchedRuntimeSelectedDetail.value?.statePointId ??
    selectedRuntimeStatePointId.value
);
const runtimeLogActionFocus = computed(() =>
  getRuntimeLogActionEditTarget({
    flowModel: props.flowModel,
    detail: matchedRuntimeSelectedDetail.value,
    row: selectedRuntimeLog.value,
    statePointId: runtimeLogDetailStatePointId.value,
  })
);
const runtimeLogActionFocusSeedCommand = computed(() =>
  createRuntimeReviewOperationCommandFromSurface({
    operationKind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.FOCUS_ACTION,
    source: 'event-log-runtime-detail',
    target: runtimeLogActionFocus.value,
  })
);
const runtimeLogCommandView = computed(() =>
  createRuntimeReviewPanelCommandViewFromSurface({
    source: 'event-log-runtime-detail',
    focusCommand: runtimeLogActionFocusSeedCommand.value,
    returnContext: runtimeLogResultReturnContext.value,
  })
);
const runtimeLogActionFocusCommand = computed(
  () => runtimeLogCommandView.value.focus
);
const runtimeLogActionFocusCommandTarget = computed(
  () => runtimeLogActionFocusCommand.value.target
);
const runtimeLogActionFocusSeedTarget = computed(
  () => runtimeLogActionFocusSeedCommand.value.target
);
const runtimeLogEditContext = computed(() =>
  createRuntimeLogEditContext({
    actionId: runtimeLogActionFocusCommandTarget.value.actionId,
    statePointId: runtimeLogDetailStatePointId.value,
    focus: props.actionEditFocus,
  })
);
const runtimeLogResultReturnActionId = computed(
  () =>
    (props.actionEditFocus?.editOrigin === 'runtime-focus'
      ? flowEditResult.value?.actionId
      : '') ||
    runtimeLogActionFocusSeedTarget.value.actionId ||
    ''
);
const runtimeLogResultReturnContext = computed(() =>
  runtimeReviewPanelView.value.resultReturnContext ??
  createRuntimeResultReturnContext({
    actionId: runtimeLogResultReturnActionId.value,
    focus: props.actionEditFocus,
    resultContext: flowEditResult.value,
  })
);
const runtimeLogResultReturnCommand = computed(
  () => runtimeLogCommandView.value.returnResult
);
const runtimeLogResultReturnCommandContext = computed(
  () => runtimeLogResultReturnCommand.value.context
);
const runtimeLogResultReturnButtonVisible = computed(() =>
  Boolean(
    runtimeLogResultReturnCommandContext.value?.statePointId ||
      runtimeLogResultReturnContext.value
  )
);
const selectedRuntimeContributionRows = computed(() =>
  matchedRuntimeSelectedDetail.value
    ? createRuntimeContributionRowsFromDetail(
        matchedRuntimeSelectedDetail.value
      )
    : createRuntimeContributionRows(selectedRuntimeLog.value)
);
const selectedRuntimeSourceRows = computed(() =>
  matchedRuntimeSelectedDetail.value
    ? createRuntimeSourceRowsFromDetail(matchedRuntimeSelectedDetail.value)
    : createRuntimeSourceRows(selectedRuntimeLogPoint.value)
);
const selectedRuntimeCalculatorRows = computed(() =>
  matchedRuntimeSelectedDetail.value
    ? (matchedRuntimeSelectedDetail.value.calculatorRows ?? [])
    : createRuntimeDetailCalculatorRows(
        selectedRuntimeLogPoint.value,
        selectedRuntimeLog.value
      )
);

watch(filteredRuntimeSimLogRows, rows => {
  syncSelectedRuntimeLogIndexFromStatePoint(rows);
  if (selectedRuntimeLogIndex.value >= rows.length) {
    selectedRuntimeLogIndex.value = 0;
  }
});

watch(
  () => flowSelectedStatePointId.value,
  () => {
    syncSelectedRuntimeLogIndexFromStatePoint(filteredRuntimeSimLogRows.value);
  }
);

watch(runtimeSimLogRows, () => {
  syncRuntimeFilterValue(runtimeActorFilter, runtimeActorFilterOptions.value);
  syncRuntimeFilterValue(runtimeActionFilter, runtimeActionFilterOptions.value);
});

watch(
  () => props.calculatorDiagnosticFocus?.sequence,
  () => {
    if (props.calculatorDiagnosticFocus?.scope !== 'runtime') {
      return;
    }
    runtimeTrackFilter.value = 'all';
    runtimeActorFilter.value = 'all';
    runtimeActionFilter.value = 'all';
    selectedRuntimeLogIndex.value = 0;
  }
);

watch(
  () => props.runtimeLogFocus?.sequence,
  () => {
    if (!isRuntimeLogFocusSource(props.runtimeLogFocus?.source)) {
      return;
    }
    focusRuntimeLogByStatePoint(props.runtimeLogFocus.statePointId);
  }
);

function formatPayload(event) {
  if (event.type === 'DAMAGE_PROJECTED') {
    return `${event.payload.skillName} / ${event.payload.segment.label} / ${event.payload.rawDamage}`;
  }
  if (event.type === 'ACTION_START') {
    return event.payload.actorName
      ? `${event.payload.actorName} -> ${event.payload.actionName}`
      : event.payload.actionName;
  }
  if (event.type === 'TIMING_DATA_MISSING') {
    return event.payload.timingSource;
  }
  if (event.type === 'RESOURCE_CHANGE') {
    return `${event.payload.resource.toUpperCase()} ${formatSigned(event.payload.change)} / ${event.payload.reason}`;
  }
  if (event.type === 'WAIT') {
    return `${event.payload.durationMs}ms / ${event.payload.note}`;
  }
  if (event.type === 'SWITCH') {
    return `${event.payload.fromActorName ?? '前台'} -> ${event.payload.targetActorName ?? event.payload.targetActorId}`;
  }
  if (event.type === 'ANNOTATION') {
    return event.payload.note;
  }
  if (event.type === 'ENEMY_EVENT') {
    return `${event.payload.eventType} / ${event.payload.note}`;
  }
  if (event.type === 'SCENARIO_START') {
    return event.payload.projectName;
  }
  if (event.type === 'SCENARIO_END') {
    return event.payload.projectId;
  }
  return event.actionId ?? '';
}

function formatSigned(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? '+' : ''}${number}`;
}

function selectRuntimeLog(index) {
  selectedRuntimeLogIndex.value = index;
  const row = filteredRuntimeSimLogRows.value[index];
  dispatchRuntimeLogFlowAction(getRuntimeLogRowFlowAction(row));
}

function showSelectedRuntimeLog() {
  const row = selectedRuntimeHiddenLogRow.value;
  if (!row) {
    return;
  }
  if (
    runtimeTrackFilter.value !== 'all' &&
    runtimeTrackFilter.value !== row.trackKey
  ) {
    runtimeTrackFilter.value = row.trackKey;
  }

  const actorKey = createRuntimeActorFilterKey(row);
  if (
    runtimeActorFilter.value !== 'all' &&
    runtimeActorFilter.value !== actorKey
  ) {
    runtimeActorFilter.value = actorKey;
  }

  const actionKey = createRuntimeActionFilterKey(row);
  if (
    runtimeActionFilter.value !== 'all' &&
    runtimeActionFilter.value !== actionKey
  ) {
    runtimeActionFilter.value = actionKey;
  }
}

function focusRuntimeLogAction() {
  dispatchRuntimeLogFlowAction(runtimeLogActionFocusCommand.value.action);
}

function returnRuntimeLogResult() {
  dispatchRuntimeLogFlowAction(runtimeLogResultReturnCommand.value.action);
}

function dispatchRuntimeLogFlowAction(action) {
  if (!action?.canRun) {
    return;
  }
  emit('dispatch-flow-action', action);
}

function createRuntimeReviewOperationCommandFromSurface(options = {}) {
  return (
    props.mainFlowCommandSurface?.createRuntimeReviewOperationCommand?.(
      options
    ) ??
    createWorkbenchRuntimeReviewOperationCommand({
      flowModel: props.flowModel,
      ...options,
    })
  );
}

function createRuntimeReviewPanelCommandViewFromSurface(options = {}) {
  return (
    props.mainFlowCommandSurface?.createRuntimeReviewPanelCommandView?.(
      options
    ) ??
    createWorkbenchRuntimeReviewPanelCommandView({
      flowModel: props.flowModel,
      ...options,
    })
  );
}

function getRuntimeLogRowFlowAction(row) {
  const statePointId = getRuntimeStatePointIdByRow(row);
  return createWorkbenchRuntimeSelectionFlowActionFromSurface({
    mainFlowCommandSurface: props.mainFlowCommandSurface,
    source: 'event-log-runtime-row',
    detail: row,
    statePointId,
    enabled: Boolean(statePointId),
  });
}

function focusRuntimeLogByStatePoint(statePointId) {
  if (!statePointId) {
    return;
  }
  runtimeTrackFilter.value = 'all';
  runtimeActorFilter.value = 'all';
  runtimeActionFilter.value = 'all';
  const index = runtimeSimLogRows.value.findIndex(
    row => getRuntimeStatePointIdByRow(row) === statePointId
  );
  if (index >= 0) {
    selectedRuntimeLogIndex.value = index;
  }
}

function getRuntimeLogActionEditTarget({
  flowModel,
  detail = null,
  row = null,
  statePointId = '',
} = {}) {
  return resolveWorkbenchMainFlowActionEditTarget({
    flowModel,
    fallbackTarget: createWorkbenchFlowRuntimeActionEditTarget({
      actionId: detail?.actionId ?? row?.actionId ?? '',
      frameLabel:
        detail?.frameLabel ?? row?.frameLabel ?? `${row?.timeMs ?? 0}ms`,
      statePointId: statePointId ?? '',
      trackKey: detail?.trackKey ?? row?.trackKey ?? '',
      trackLabel: detail?.trackLabel ?? '',
    }),
    statePointId,
  });
}

function createRuntimeLogNavigationStatus({
  selectedStatePointId = '',
  rows = [],
  filteredRows = [],
} = {}) {
  const base = {
    statePointId: selectedStatePointId ?? '',
    navigationCount: filteredRows.length,
    navigationIndex: -1,
    sourceCount: rows.length,
    sourceIndex: -1,
  };
  if (!selectedStatePointId) {
    return {
      ...base,
      status: 'none',
      label: '',
      detail: '',
    };
  }

  const sourceIndex = findRuntimeLogRowIndexByStatePoint(
    rows,
    selectedStatePointId
  );
  if (sourceIndex < 0) {
    return {
      ...base,
      status: 'missing',
      label: '日志未命中',
      detail: '当前三值点不在模拟日志内',
    };
  }

  const navigationIndex = findRuntimeLogRowIndexByStatePoint(
    filteredRows,
    selectedStatePointId
  );
  if (navigationIndex < 0) {
    return {
      ...base,
      sourceIndex,
      status: 'filtered-out',
      label: '筛选外',
      detail: `全部 ${sourceIndex + 1}/${rows.length}`,
    };
  }

  return {
    ...base,
    navigationIndex,
    sourceIndex,
    status: 'synced',
    label: '日志已同步',
    detail: `当前筛选 ${navigationIndex + 1}/${filteredRows.length} · 全部 ${sourceIndex + 1}/${rows.length}`,
  };
}

function findRuntimeLogRowIndexByStatePoint(rows, statePointId) {
  if (!statePointId) {
    return -1;
  }
  return rows.findIndex(
    row => getRuntimeStatePointIdByRow(row) === statePointId
  );
}

function createRuntimeLogEditContext({
  actionId = '',
  statePointId = '',
  focus = null,
} = {}) {
  if (
    !actionId ||
    !statePointId ||
    !focus?.actionId ||
    focus.editOrigin !== 'runtime-focus' ||
    focus.actionId !== actionId ||
    focus.originStatePointId !== statePointId
  ) {
    return null;
  }
  return {
    status: 'edit-focus-synced',
    actionId: focus.actionId,
    fieldKey: focus.fieldKey ?? '',
    label: focus.label ?? '结果定位',
    statePointId,
    summary: focus.changeSummary ?? '',
  };
}

function syncSelectedRuntimeLogIndexFromStatePoint(rows) {
  if (!flowSelectedStatePointId.value) {
    return;
  }
  const index = rows.findIndex(
    row => getRuntimeStatePointIdByRow(row) === flowSelectedStatePointId.value
  );
  if (index >= 0) {
    selectedRuntimeLogIndex.value = index;
  }
}

function getRuntimeTrackFilterLabel(trackKey) {
  const option = runtimeTrackFilterOptions.value.find(
    item => item.key === trackKey
  );
  return option?.label ?? trackKey ?? '全部';
}

function getRuntimeSelectFilterLabel(value, options) {
  const option = options.find(item => item.key === value);
  return option?.label ?? value ?? '全部';
}

function createRuntimeActorFilterKey(row) {
  return String(row?.actorId ?? 'system');
}

function createRuntimeActionFilterKey(row) {
  return String(row?.actionId ?? 'system');
}

function isRuntimeLogRowSelected(row, index) {
  if (flowSelectedStatePointId.value) {
    return getRuntimeStatePointIdByRow(row) === flowSelectedStatePointId.value;
  }
  return selectedRuntimeLogIndex.value === index;
}

function getRuntimeStatePointIdByRow(row) {
  return runtimeContextByRow.value.get(row)?.statePointId ?? '';
}

function formatRuntimeTime(row) {
  return row.frameLabel ?? `${row.timeMs ?? 0}ms`;
}

function formatRuntimeTrack(row) {
  const labels = {
    enemyHpDamage: 'HP',
    enemyToughnessDamage: '韧性',
    selfEnergyChange: '能量',
  };
  return labels[row.trackKey] ?? row.trackKey ?? '三值';
}

function formatRuntimePayload(row) {
  const action = row.actionName ?? row.actionId ?? '动作';
  return `${action} · ${formatRuntimeDelta(row)}`;
}

function formatRuntimeDelta(row) {
  if (!row) {
    return '0';
  }
  if (row.trackKey === 'enemyHpDamage') {
    return `HP ${formatNumber(row.hpDelta)}`;
  }
  if (row.trackKey === 'enemyToughnessDamage') {
    return `韧性 ${formatNumber(row.toughnessDelta)}`;
  }
  if (row.trackKey === 'selfEnergyChange') {
    return `SP ${formatSigned(row.energyDelta)}`;
  }
  return formatSigned(row.delta);
}

function formatRuntimeDetailDelta(detail) {
  if (detail.trackKey === 'enemyHpDamage') {
    return `HP ${formatNumber(detail.delta)}`;
  }
  if (detail.trackKey === 'enemyToughnessDamage') {
    return `韧性 ${formatNumber(detail.delta)}`;
  }
  if (detail.trackKey === 'selfEnergyChange') {
    return `SP ${formatSigned(detail.delta)}`;
  }
  return formatSigned(detail.delta);
}

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString('zh-CN');
}

function formatRuntimeStatus(row) {
  const point = getRuntimePointByRow(row);
  return (
    point?.resultStatus ?? point?.sourceStatus ?? row?.confidence ?? 'applied'
  );
}

function getRuntimePointByRow(row) {
  return runtimeContextByRow.value.get(row)?.point ?? null;
}

function countRuntimeOptions(rows, field) {
  const counts = new Map();
  for (const row of rows ?? []) {
    const key = row?.[field];
    if (!key) {
      continue;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function createRuntimeSelectOptions({
  rows,
  keyField,
  labelField,
  allLabel,
  fallbackLabel,
}) {
  const options = new Map();
  for (const row of rows ?? []) {
    const key = String(row?.[keyField] ?? 'system');
    if (options.has(key)) {
      continue;
    }
    options.set(key, {
      key,
      label: row?.[labelField] ?? fallbackLabel,
    });
  }
  return [{ key: 'all', label: allLabel }, ...options.values()];
}

function syncRuntimeFilterValue(filterRef, options) {
  if (!options.some(option => option.key === filterRef.value)) {
    filterRef.value = 'all';
  }
}

function createRuntimeContributionRows(row) {
  if (!row) {
    return [];
  }
  return [
    {
      key: 'hp',
      label: '敌人 HP',
      value:
        row.hpDelta == null || row.trackKey !== 'enemyHpDamage'
          ? '0'
          : formatNumber(row.hpDelta),
    },
    {
      key: 'toughness',
      label: '敌人韧性',
      value:
        row.toughnessDelta == null || row.trackKey !== 'enemyToughnessDamage'
          ? '0'
          : formatNumber(row.toughnessDelta),
    },
    {
      key: 'energy',
      label: '自身能量',
      value:
        row.energyDelta == null || row.trackKey !== 'selfEnergyChange'
          ? '0'
          : formatSigned(row.energyDelta),
    },
  ];
}

function createRuntimeContributionRowsFromDetail(detail) {
  return (detail.contributionRows ?? []).map(row => ({
    key: row.key,
    label: row.label,
    value: row.signed ? formatSigned(row.value) : formatNumber(row.value),
  }));
}

function createRuntimeSourceRows(point) {
  const sourceIds = point?.sourceIds ?? {};
  return [
    {
      key: 'skillIds',
      label: 'Skill',
      value: formatRuntimeSourceList(sourceIds.skillIds),
    },
    {
      key: 'elementConfigIds',
      label: 'Element',
      value: formatRuntimeSourceList(sourceIds.elementConfigIds),
    },
    {
      key: 'captureSessionIds',
      label: '采样',
      value: formatRuntimeSourceList(sourceIds.captureSessionIds),
    },
    {
      key: 'pathIds',
      label: 'Path',
      value: formatRuntimeSourceList(sourceIds.pathIds),
    },
  ];
}

function createRuntimeSourceRowsFromDetail(detail) {
  return (detail.sourceRows ?? []).map(row => ({
    key: row.key,
    label: row.label,
    value: formatRuntimeSourceList(row.values),
  }));
}

function formatRuntimeSourceList(values) {
  const list = Array.isArray(values)
    ? values.filter(value => value != null)
    : [];
  return list.length > 0 ? list.join(', ') : '无';
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

.event-list,
.runtime-log-list {
  display: grid;
  gap: 8px;
  margin: 0;
  overflow: auto;
  list-style: none;
}

.event-list {
  max-height: 250px;
  padding: 14px;
}

.event-list > li,
.runtime-log-row {
  display: grid;
  grid-template-columns: 72px minmax(116px, 160px) minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 4px;
  background: #232a31;
  font-size: 12px;
}

.runtime-sim-log {
  display: grid;
  gap: 10px;
  margin: 0 14px 14px;
  padding: 12px;
  border: 1px solid rgba(121, 199, 185, 0.18);
  border-radius: 6px;
  background: rgba(121, 199, 185, 0.07);
}

.runtime-log-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.runtime-log-heading span {
  color: #d9dee3;
  font-size: 13px;
  font-weight: 700;
}

.runtime-log-heading strong {
  color: #79c7b9;
  font-size: 12px;
}

.runtime-log-filter-summary {
  display: grid;
  grid-template-columns: 72px minmax(64px, 0.55fr) minmax(0, 1.45fr);
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 9px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
}

.runtime-log-filter-summary[data-calculator-scope='runtime'] {
  background: rgba(166, 183, 255, 0.1);
}

.runtime-log-filter-summary span {
  color: #d9dee3;
  font-size: 11px;
  font-weight: 700;
}

.runtime-log-filter-summary strong,
.runtime-log-filter-summary small {
  min-width: 0;
  overflow-wrap: anywhere;
}

.runtime-log-filter-summary strong {
  color: #ffffff;
  font-size: 12px;
}

.runtime-log-filter-summary small {
  color: #aeb7c2;
  font-size: 11px;
}

.runtime-log-navigation {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 7px 9px;
  border: 1px solid rgba(121, 199, 185, 0.22);
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.08);
  font-size: 11px;
}

.runtime-log-navigation[data-navigation-status='filtered-out'] {
  border-color: rgba(230, 162, 60, 0.28);
  background: rgba(230, 162, 60, 0.08);
}

.runtime-log-navigation[data-navigation-status='missing'] {
  border-color: rgba(245, 108, 108, 0.24);
  background: rgba(245, 108, 108, 0.08);
}

.runtime-log-navigation span {
  color: #9ce0d2;
  font-weight: 700;
  white-space: nowrap;
}

.runtime-log-navigation[data-navigation-status='filtered-out'] span,
.runtime-log-navigation[data-navigation-status='filtered-out'] strong {
  color: #efc574;
}

.runtime-log-navigation[data-navigation-status='missing'] span,
.runtime-log-navigation[data-navigation-status='missing'] strong {
  color: #ffb3b3;
}

.runtime-log-navigation strong {
  color: #dff9f3;
  white-space: nowrap;
}

.runtime-log-navigation small {
  min-width: 0;
  overflow: hidden;
  color: #aeb8c1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.runtime-log-list {
  max-height: 170px;
  padding: 0;
}

.runtime-log-filters {
  display: grid;
  gap: 8px;
}

.runtime-track-filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.runtime-filter-button {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 5px;
  padding: 7px 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  color: #c8cdd3;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.runtime-filter-button[data-active='true'] {
  border-color: rgba(121, 199, 185, 0.46);
  background: rgba(121, 199, 185, 0.16);
  color: #ffffff;
}

.runtime-filter-button span,
.runtime-filter-button strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.runtime-filter-button strong {
  color: #79c7b9;
  font-size: 11px;
}

.runtime-select-filters {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.runtime-select-filters label {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.runtime-select-filters label span {
  color: #8f9aa3;
  font-size: 11px;
}

.runtime-select-filters select {
  width: 100%;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  background: #20262c;
  color: #ffffff;
  font-size: 12px;
}

.runtime-log-row {
  width: 100%;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.05);
  color: inherit;
  cursor: pointer;
}

.runtime-log-row[data-selected='true'] {
  border-color: rgba(121, 199, 185, 0.45);
  background: rgba(121, 199, 185, 0.14);
}

.runtime-track {
  overflow: hidden;
  color: #79c7b9;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.runtime-log-empty {
  margin: 0;
  color: #8f9aa3;
  font-size: 12px;
}

.runtime-log-selection-note {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0;
  padding: 8px 9px;
  border: 1px solid rgba(230, 162, 60, 0.3);
  border-radius: 4px;
  background: rgba(230, 162, 60, 0.1);
  color: #efc574;
  font-size: 12px;
}

.runtime-log-selection-note button {
  flex: 0 0 auto;
  padding: 4px 7px;
  border: 1px solid rgba(230, 162, 60, 0.46);
  border-radius: 4px;
  background: rgba(230, 162, 60, 0.12);
  color: #ffe0a3;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.runtime-log-detail {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.runtime-log-detail div,
.runtime-contribution-row,
.runtime-calculator-row,
.runtime-source-row {
  min-width: 0;
  padding: 8px 9px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
}

.runtime-log-detail span,
.runtime-contribution-row span,
.runtime-calculator-row span,
.runtime-source-row span {
  display: block;
  margin-bottom: 4px;
  color: #8f9aa3;
  font-size: 11px;
}

.runtime-log-detail strong,
.runtime-contribution-row strong,
.runtime-calculator-row strong,
.runtime-source-row strong {
  display: block;
  overflow: hidden;
  color: #ffffff;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.runtime-log-detail .runtime-log-edit-context {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(121, 199, 185, 0.28);
  background: rgba(121, 199, 185, 0.1);
  color: #dff9f3;
  font-size: 11px;
}

.runtime-log-detail .runtime-log-detail-handoff {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(166, 183, 255, 0.26);
  background: rgba(166, 183, 255, 0.09);
  color: #e4e9ff;
  font-size: 11px;
}

.runtime-log-edit-context span {
  margin: 0;
  color: #9ce0d2;
  font-weight: 700;
  white-space: nowrap;
}

.runtime-log-edit-context strong {
  color: #ffffff;
  white-space: nowrap;
}

.runtime-log-edit-context small {
  min-width: 0;
  overflow: hidden;
  color: #aeb8c1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.runtime-log-detail-handoff span {
  margin: 0;
  color: #c7d2ff;
  font-weight: 700;
  white-space: nowrap;
}

.runtime-log-detail-handoff strong {
  color: #ffffff;
  white-space: nowrap;
}

.runtime-log-detail-handoff small {
  min-width: 0;
  overflow: hidden;
  color: #aeb8c1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.runtime-log-action-focus {
  display: inline-grid;
  grid-template-columns: 13px auto;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  min-height: 36px;
  border: 1px solid rgba(121, 199, 185, 0.28);
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.12);
  color: #dff9f3;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
}

.runtime-log-result-return {
  display: inline-grid;
  grid-template-columns: 13px auto;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  min-height: 36px;
  border: 1px solid rgba(166, 183, 255, 0.28);
  border-radius: 4px;
  background: rgba(166, 183, 255, 0.12);
  color: #e4e9ff;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
}

.runtime-log-action-focus:disabled {
  color: #6d7780;
  cursor: not-allowed;
  opacity: 0.5;
}

.runtime-log-result-return:hover,
.runtime-log-result-return:focus,
.runtime-log-action-focus:not(:disabled):hover,
.runtime-log-action-focus:not(:disabled):focus {
  filter: brightness(1.14);
}

.runtime-log-action-focus-icon {
  width: 13px;
  height: 13px;
}

.runtime-log-result-return-icon {
  width: 13px;
  height: 13px;
}

.runtime-contribution-detail,
.runtime-calculator-detail,
.runtime-source-detail {
  display: grid;
  gap: 6px;
}

.runtime-detail-heading {
  color: #d9dee3;
  font-size: 12px;
  font-weight: 700;
}

.runtime-contribution-row,
.runtime-calculator-row,
.runtime-source-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.runtime-contribution-row span,
.runtime-calculator-row span,
.runtime-source-row span {
  margin-bottom: 0;
  white-space: nowrap;
}

.runtime-contribution-row strong,
.runtime-calculator-row strong,
.runtime-source-row strong {
  text-align: right;
}

.time {
  color: #8f9aa3;
  font-variant-numeric: tabular-nums;
}

.type {
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.12);
  color: #79c7b9;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.type.timing_data_missing {
  background: rgba(230, 162, 60, 0.12);
  color: #efc574;
}

.type.damage_projected {
  background: rgba(103, 194, 58, 0.12);
  color: #9bd982;
}

.type.resource_change {
  background: rgba(121, 199, 185, 0.12);
  color: #79c7b9;
}

.type.enemy_event {
  background: rgba(245, 108, 108, 0.12);
  color: #f8b6b6;
}

.type.switch {
  background: rgba(103, 194, 58, 0.12);
  color: #9bd982;
}

.type.wait,
.type.annotation {
  background: rgba(144, 147, 153, 0.14);
  color: #c8cdd3;
}

.payload {
  overflow: hidden;
  color: #d9dee3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 760px) {
  .event-list > li,
  .runtime-log-row,
  .runtime-log-detail,
  .runtime-select-filters {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .payload {
    white-space: normal;
  }
}
</style>
