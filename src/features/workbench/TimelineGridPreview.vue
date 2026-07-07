<template>
  <section class="panel timeline-panel">
    <div class="panel-title">
      <Clock class="panel-icon" />
      <h2>时间轴</h2>
      <div class="timeline-tools">
        <button
          class="icon-control"
          type="button"
          data-testid="workbench-timeline-zoom-out"
          aria-label="缩小时间轴"
          @click="setTimelineZoom(timelineZoom - ZOOM_STEP)"
        >
          <Minus class="control-icon" />
        </button>
        <input
          class="zoom-slider"
          data-testid="workbench-timeline-zoom-input"
          type="range"
          :min="MIN_ZOOM"
          :max="MAX_ZOOM"
          :step="ZOOM_STEP"
          :value="timelineZoom"
          aria-label="时间轴缩放"
          @input="setTimelineZoom($event.target.value)"
        />
        <button
          class="icon-control"
          type="button"
          data-testid="workbench-timeline-zoom-in"
          aria-label="放大时间轴"
          @click="setTimelineZoom(timelineZoom + ZOOM_STEP)"
        >
          <Plus class="control-icon" />
        </button>
        <span class="zoom-value" data-testid="workbench-timeline-zoom-value">{{
          formatZoom(timelineZoom)
        }}</span>
      </div>
      <div
        v-if="candidateSeriesToggles.length"
        class="candidate-toggle-group"
        data-testid="workbench-candidate-value-toggle-group"
      >
        <label
          v-for="toggle in candidateSeriesToggles"
          :key="toggle.key"
          class="candidate-toggle"
          :data-series-key="toggle.key"
        >
          <input
            type="checkbox"
            :checked="isCandidateSeriesVisible(toggle.key)"
            :data-series-key="toggle.key"
            data-testid="workbench-candidate-value-toggle"
            @change="
              setCandidateSeriesVisible(toggle.key, $event.target.checked)
            "
          />
          <i :style="{ background: toggle.color }" />
          <span>{{ toggle.shortLabel }}</span>
        </label>
      </div>
      <div
        v-if="candidateSeriesToggles.length"
        class="candidate-scope-group"
        data-testid="workbench-candidate-value-scope-group"
      >
        <button
          v-for="scope in CANDIDATE_DISPLAY_SCOPE_OPTIONS"
          :key="scope.key"
          class="candidate-scope"
          :class="{ active: candidateDisplayScope === scope.key }"
          type="button"
          :disabled="
            scope.key === 'selected-frame' && !selectedCandidateFrameGroupId
          "
          :data-scope-key="scope.key"
          data-testid="workbench-candidate-value-scope-option"
          @click="setCandidateDisplayScope(scope.key)"
        >
          {{ scope.label }}
        </button>
      </div>
      <div
        v-if="candidateSeriesToggles.length"
        class="candidate-filter-group"
        data-testid="workbench-candidate-value-filter-group"
      >
        <label class="candidate-filter">
          <span>角色</span>
          <select
            :value="candidateActorFilter"
            data-testid="workbench-candidate-value-actor-filter"
            @change="setCandidateActorFilter($event.target.value)"
          >
            <option value="all">全部</option>
            <option
              v-for="actor in candidateActorOptions"
              :key="actor.id"
              :value="actor.id"
            >
              {{ actor.label }}
            </option>
          </select>
        </label>
        <label class="candidate-filter">
          <span>动作</span>
          <select
            :value="candidateActionFilter"
            data-testid="workbench-candidate-value-action-filter"
            @change="setCandidateActionFilter($event.target.value)"
          >
            <option value="all">全部</option>
            <option
              v-for="action in candidateActionOptions"
              :key="action.id"
              :value="action.id"
            >
              {{ action.label }}
            </option>
          </select>
        </label>
      </div>
    </div>

    <div class="timeline-scale">
      <span class="scale-spacer" />
      <div class="scale-viewport">
        <div
          class="scale-track"
          :style="timelineTrackStyle"
          data-testid="workbench-timeline-scale-track"
        >
          <span v-for="tick in ticks" :key="tick.timeMs">{{ tick.label }}</span>
        </div>
      </div>
    </div>

    <div class="timeline-shell">
      <div class="lane-labels">
        <div
          v-for="lane in timelineLanes"
          :key="lane.id"
          class="lane-label"
          :class="{ system: lane.type === 'system' }"
          :data-lane-id="lane.id"
          data-testid="workbench-timeline-lane-label"
        >
          <span>{{ lane.name }}</span>
          <small>{{ lane.detail }}</small>
        </div>
      </div>

      <div class="timeline-viewport" data-testid="workbench-timeline-viewport">
        <div
          ref="laneRef"
          class="timeline-lane"
          :style="timelineTrackStyle"
          data-testid="workbench-timeline-lane"
        >
          <div
            v-for="lane in timelineLanes"
            :key="lane.id"
            class="lane-row"
            :class="{
              'drop-target':
                lane.id === dragTargetLaneId && lane.id !== dragInitialLaneId,
            }"
            :data-lane-id="lane.id"
            data-testid="workbench-timeline-row"
            :ref="element => setLaneRowRef(element, lane.id)"
          >
            <div
              v-for="action in lane.actions"
              :key="action.id"
              class="action-block"
              :class="[
                {
                  selected: action.id === selectedActionId,
                  dragging: action.id === draggingActionId,
                  overlap: overlapActionIds.has(action.id),
                  resizing: action.id === resizingActionId,
                  'auto-delayed': action.insertion?.autoDelayed,
                  'batch-selected': isActionInSelectedBatch(action),
                },
                `type-${action.type}`,
              ]"
              :style="actionStyle(action)"
              :data-action-id="action.id"
              :data-lane-id="lane.id"
              :data-batch-id="action.generationBatch?.batchId || ''"
              :data-batch-highlight="
                isActionInSelectedBatch(action) ? 'true' : 'false'
              "
              data-testid="workbench-timeline-action"
              tabindex="0"
              @click="$emit('select-action', action.id)"
              @keydown.enter="$emit('select-action', action.id)"
              @keydown.left.prevent="nudgeAction($event, action, -1)"
              @keydown.right.prevent="nudgeAction($event, action, 1)"
              @keydown.delete.prevent="$emit('delete-action', action.id)"
              @keydown.backspace.prevent="$emit('delete-action', action.id)"
              @pointerdown="beginDrag($event, action)"
            >
              <span>{{ actionLabel(action) }}</span>
              <small v-if="actionDetail(action)">{{
                actionDetail(action)
              }}</small>
              <span
                v-if="overlapActionIds.has(action.id)"
                class="overlap-badge"
                data-testid="workbench-action-overlap-warning"
              >
                重叠
              </span>
              <span
                v-if="action.insertion?.autoDelayed"
                class="auto-delay-badge"
                data-testid="workbench-action-insert-delay-badge"
              >
                推迟
              </span>
              <button
                class="duration-handle"
                type="button"
                data-testid="workbench-action-duration-handle"
                :data-action-id="action.id"
                aria-label="调整动作持续时间"
                @click.stop
                @pointerdown.stop="beginResize($event, action)"
              />
            </div>

            <div
              v-for="damage in lane.damageMarkers"
              :key="`${damage.actionId}-${damage.timeMs}`"
              class="damage-marker"
              :class="{ 'batch-selected': isDamageInSelectedBatch(damage) }"
              :style="markerStyle(damage)"
              :title="`${damage.segmentLabel}: ${damage.rawDamage}`"
              :data-action-id="damage.actionId"
              :data-lane-id="lane.id"
              :data-batch-highlight="
                isDamageInSelectedBatch(damage) ? 'true' : 'false'
              "
              data-testid="workbench-timeline-damage-marker"
            />

            <div
              v-if="lane.candidateValueCurves.length"
              class="candidate-value-curve-track"
              data-testid="workbench-timeline-candidate-value-curve-track"
              :data-lane-id="lane.id"
            >
              <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline
                  v-for="curve in lane.candidateValueCurves"
                  :key="curve.seriesKey"
                  class="candidate-value-curve-line"
                  :class="`candidate-${curve.seriesKey}`"
                  :points="curve.polylinePoints"
                  vector-effect="non-scaling-stroke"
                  data-testid="workbench-timeline-candidate-value-curve"
                  :data-series-key="curve.seriesKey"
                  :data-point-count="curve.pointCount"
                />
              </svg>
            </div>

            <div
              v-for="group in lane.candidateValueFrameGroups"
              :key="group.id"
              class="candidate-value-frame-hotspot"
              :class="{
                selected: group.id === selectedCandidateFrameGroup?.id,
              }"
              :style="candidateValueFrameHotspotStyle(group)"
              :title="group.title"
              :aria-label="group.title"
              :data-action-id="group.actionId"
              :data-lane-id="lane.id"
              :data-hit-index="group.hitIndex"
              :data-frame-label="group.frameLabel"
              :data-marker-title="group.title"
              data-testid="workbench-timeline-candidate-value-frame-hotspot"
              role="button"
              tabindex="0"
              @click="selectCandidateFrameGroup(group)"
              @keydown.enter.prevent="selectCandidateFrameGroup(group)"
              @keydown.space.prevent="selectCandidateFrameGroup(group)"
            />

            <div
              v-for="marker in lane.candidateValueMarkers"
              :key="marker.id"
              class="candidate-value-marker"
              :class="[
                `candidate-${marker.seriesKey}`,
                {
                  selected:
                    marker.frameGroupId === selectedCandidateFrameGroup?.id,
                },
              ]"
              :style="candidateValueMarkerStyle(marker)"
              :title="formatCandidateValueMarkerTitle(marker)"
              :aria-label="formatCandidateValueMarkerTitle(marker)"
              :data-action-id="marker.actionId"
              :data-lane-id="lane.id"
              :data-series-key="marker.seriesKey"
              :data-hit-index="marker.hitIndex"
              :data-frame-label="marker.frameLabel"
              :data-value="marker.value"
              :data-marker-title="formatCandidateValueMarkerTitle(marker)"
              data-testid="workbench-timeline-candidate-value-marker"
              role="button"
              tabindex="0"
              @click="selectCandidateFrameGroupByMarker(marker)"
              @keydown.enter.prevent="selectCandidateFrameGroupByMarker(marker)"
              @keydown.space.prevent="selectCandidateFrameGroupByMarker(marker)"
            />
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="selectedCandidateFrameGroup"
      class="candidate-frame-summary"
      data-testid="workbench-candidate-value-frame-summary"
      :data-hit-index="selectedCandidateFrameGroup.hitIndex"
      :data-frame-label="selectedCandidateFrameGroup.frameLabel"
    >
      <span>
        {{ selectedCandidateFrameGroup.frameLabel }} · hit{{
          selectedCandidateFrameGroup.hitIndex
        }}
      </span>
      <strong data-testid="workbench-candidate-value-frame-summary-values">
        {{ formatCandidateFrameGroupValues(selectedCandidateFrameGroup) }}
      </strong>
      <small data-testid="workbench-candidate-value-frame-summary-source">
        {{ formatCandidateFrameGroupSource(selectedCandidateFrameGroup) }}
      </small>
      <div
        class="candidate-frame-details"
        data-testid="workbench-candidate-value-frame-details"
      >
        <div
          v-for="value in selectedCandidateFrameGroup.values"
          :key="`${value.seriesKey}-${value.hitIndex}`"
          class="candidate-frame-detail-row"
          :data-series-key="value.seriesKey"
          :data-candidate-count="value.candidateCount"
          :data-source-frame-index="value.sourceFrameIndex"
          :data-element-detail-count="value.elementDetails?.length ?? 0"
          data-testid="workbench-candidate-value-frame-detail-row"
        >
          <b>{{ value.seriesLabel }}</b>
          <span>{{ formatCandidateFrameDetailValue(value) }}</span>
          <small>{{ formatCandidateFrameDetailSamples(value) }}</small>
          <small>{{ formatCandidateFrameDetailFrames(value) }}</small>
          <small>{{ formatCandidateFrameDetailElements(value) }}</small>
        </div>
      </div>
    </div>

    <div v-if="timelineLanes.length === 0" class="empty-lane">
      暂无时间轴动作
    </div>

    <div class="legend">
      <span><i class="legend-action" /> 动作</span>
      <span><i class="legend-damage" /> 伤害投影</span>
      <span><i class="legend-candidate" /> 候选三值</span>
      <span><i class="legend-system" /> 系统轨</span>
      <span><i class="legend-overlap" /> 重叠</span>
      <span><i class="legend-delay" /> 自动推迟</span>
      <span class="warning">时序为占位数据</span>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import { Clock, Minus, Plus } from '@element-plus/icons-vue';
import {
  DEFAULT_TIMELINE_ACTION_DURATION_MS,
  resolveTimelineActionLaneId,
} from './timelineDiagnostics';
import {
  WORKBENCH_FRAME_MS,
  formatFrameTime,
  snapMsToFrame,
} from '../../domain/timebase';

const MIN_ACTION_DURATION_MS = WORKBENCH_FRAME_MS;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
const CANDIDATE_VALUE_CURVE_TOP = 68;
const CANDIDATE_VALUE_CURVE_HEIGHT = 34;
const CANDIDATE_VALUE_SERIES_META = {
  hpDamageFormulaParamCandidate: {
    order: 0,
    shortLabel: 'HP',
    color: '#f2b366',
  },
  toughnessDamageCandidate: {
    order: 1,
    shortLabel: '韧性',
    color: '#79c7b9',
  },
  selfEnergyCandidate: {
    order: 2,
    shortLabel: '能量',
    color: '#a6b7ff',
  },
};
const CANDIDATE_DISPLAY_SCOPE_OPTIONS = [
  {
    key: 'all',
    label: '全部',
  },
  {
    key: 'selected-frame',
    label: '选中帧',
  },
];

const props = defineProps({
  actors: {
    type: Array,
    required: true,
  },
  actions: {
    type: Array,
    required: true,
  },
  damageTimeline: {
    type: Array,
    required: true,
  },
  candidateValueChart: {
    type: Object,
    default: () => ({
      series: [],
      summary: {
        pointCount: 0,
      },
    }),
  },
  durationMs: {
    type: Number,
    required: true,
  },
  selectedActionId: {
    type: String,
    required: true,
  },
  timelineDiagnostics: {
    type: Object,
    default: () => ({
      overlapActionIds: [],
      overlaps: [],
      overlapCount: 0,
    }),
  },
  snapMs: {
    type: Number,
    default: WORKBENCH_FRAME_MS,
  },
});

const emit = defineEmits([
  'select-action',
  'delete-action',
  'update-action-time',
  'update-action-duration',
  'update-action-lane',
]);
const laneRef = ref(null);
const laneRowRefs = new Map();
const dragState = ref(null);
const resizeState = ref(null);
const timelineZoom = ref(1);
const candidateSeriesVisibility = ref({});
const selectedCandidateFrameGroupId = ref(null);
const candidateDisplayScope = ref('all');
const candidateActorFilter = ref('all');
const candidateActionFilter = ref('all');

const ticks = computed(() => {
  const durationSeconds = props.durationMs / 1000;
  return [0, 0.25, 0.5, 0.75, 1].map(ratio => {
    const seconds = Math.round(durationSeconds * ratio);
    return {
      timeMs: seconds * 1000,
      label: `${seconds}s`,
    };
  });
});

const draggingActionId = computed(() => dragState.value?.actionId ?? null);
const dragInitialLaneId = computed(
  () => dragState.value?.initialLaneId ?? null
);
const dragTargetLaneId = computed(() => dragState.value?.targetLaneId ?? null);
const resizingActionId = computed(() => resizeState.value?.actionId ?? null);
const timelineTrackStyle = computed(() => ({
  width: `${timelineZoom.value * 100}%`,
}));
const candidateSeriesToggles = computed(() =>
  (props.candidateValueChart?.series ?? [])
    .filter(series => series.pointCount > 0)
    .map(series => {
      const meta = getCandidateSeriesMeta(series.key);
      return {
        key: series.key,
        label: series.label,
        order: meta.order,
        shortLabel: meta.shortLabel,
        color: meta.color,
      };
    })
    .sort(
      (left, right) =>
        left.order - right.order ||
        String(left.label).localeCompare(String(right.label))
    )
);
const actionsById = computed(
  () => new Map(props.actions.map(action => [action.id, action]))
);
const actorLaneIds = computed(
  () => new Set(props.actors.map(actor => actor.id))
);
const candidateActionIds = computed(
  () =>
    new Set(
      (props.candidateValueChart?.series ?? [])
        .flatMap(series => (series.points ?? []).map(point => point.actionId))
        .filter(Boolean)
    )
);
const candidateActorOptions = computed(() => {
  const actorIds = new Set(
    [...candidateActionIds.value]
      .map(actionId => actionsById.value.get(actionId))
      .filter(Boolean)
      .map(action => resolveActionLaneId(action))
      .filter(actorId => actorLaneIds.value.has(actorId))
  );
  return props.actors
    .filter(actor => actorIds.has(actor.id))
    .map(actor => ({
      id: actor.id,
      label: actor.name,
    }));
});
const candidateActionOptions = computed(() =>
  [...candidateActionIds.value]
    .filter(actionId => actionsById.value.has(actionId))
    .map(actionId => {
      const action = actionsById.value.get(actionId);
      return {
        id: actionId,
        label: action?.name ?? actionId,
      };
    })
);
const overlapActionIds = computed(
  () => new Set(props.timelineDiagnostics?.overlapActionIds ?? [])
);
const selectedBatchId = computed(() => {
  const selectedAction = actionsById.value.get(props.selectedActionId);
  return selectedAction?.generationBatch?.batchId ?? null;
});
const timelineLanes = computed(() => {
  const actorLanes = props.actors.map(actor => ({
    id: actor.id,
    type: 'actor',
    name: actor.name,
    detail: actor.role || '角色轨',
    actions: [],
    damageMarkers: [],
    candidateValueMarkers: [],
    candidateValueCurves: [],
    candidateValueFrameGroups: [],
  }));
  const lanesById = new Map(actorLanes.map(lane => [lane.id, lane]));
  const systemLane = {
    id: 'system',
    type: 'system',
    name: '系统',
    detail: '事件轨',
    actions: [],
    damageMarkers: [],
    candidateValueMarkers: [],
    candidateValueCurves: [],
    candidateValueFrameGroups: [],
  };

  props.actions.forEach(action => {
    const lane = lanesById.get(resolveActionLaneId(action)) ?? systemLane;
    lane.actions.push(action);
  });

  props.damageTimeline.forEach(damage => {
    const lane = lanesById.get(resolveDamageLaneId(damage)) ?? systemLane;
    lane.damageMarkers.push(damage);
  });

  createCandidateValueTimelineMarkers().forEach(marker => {
    const lane =
      lanesById.get(resolveCandidateValueLaneId(marker)) ?? systemLane;
    lane.candidateValueMarkers.push(marker);
  });

  [...actorLanes, systemLane].forEach(lane => {
    lane.candidateValueCurves = createCandidateValueTimelineCurves(
      lane.candidateValueMarkers
    );
    lane.candidateValueFrameGroups = createCandidateValueFrameGroups(
      lane.candidateValueMarkers
    );
  });

  return systemLane.actions.length > 0 ||
    systemLane.damageMarkers.length > 0 ||
    systemLane.candidateValueMarkers.length > 0
    ? [...actorLanes, systemLane]
    : actorLanes;
});
const allCandidateFrameGroups = computed(() =>
  timelineLanes.value.flatMap(lane =>
    lane.candidateValueFrameGroups.map(group => ({
      ...group,
      laneId: lane.id,
    }))
  )
);
const selectedCandidateFrameGroup = computed(
  () =>
    allCandidateFrameGroups.value.find(
      group => group.id === selectedCandidateFrameGroupId.value
    ) ?? null
);

function isActionInSelectedBatch(action) {
  return Boolean(
    selectedBatchId.value &&
    action.generationBatch?.batchId === selectedBatchId.value
  );
}

function isDamageInSelectedBatch(damage) {
  const action = actionsById.value.get(damage.actionId);
  return Boolean(action && isActionInSelectedBatch(action));
}

function actionStyle(action) {
  const left = clampPercent((action.startMs / props.durationMs) * 100);
  const width = clampPercent(
    ((action.durationMs ?? DEFAULT_TIMELINE_ACTION_DURATION_MS) /
      props.durationMs) *
      100,
    8,
    100
  );
  return {
    left: `${left}%`,
    width: `${width}%`,
  };
}

function markerStyle(damage) {
  const left = clampPercent((damage.timeMs / props.durationMs) * 100);
  return {
    left: `${left}%`,
  };
}

function candidateValueMarkerStyle(marker) {
  const left = clampPercent((marker.timeMs / props.durationMs) * 100);
  const top =
    CANDIDATE_VALUE_CURVE_TOP +
    (clampPercent(marker.yPercent) / 100) * CANDIDATE_VALUE_CURVE_HEIGHT;
  return {
    left: `${left}%`,
    top: `${top}px`,
  };
}

function candidateValueFrameHotspotStyle(group) {
  const left = clampPercent((group.timeMs / props.durationMs) * 100);
  return {
    left: `${left}%`,
  };
}

function actionLabel(action) {
  if (action.type === 'switch') {
    return `${action.name} -> ${action.targetActor?.name ?? '目标'}`;
  }
  return action.name;
}

function actionDetail(action) {
  if (action.type === 'skill') {
    return `${action.actor?.name ?? ''} / ${formatFrameTime(action.durationMs ?? DEFAULT_TIMELINE_ACTION_DURATION_MS)}`;
  }
  if (action.type === 'resource') {
    return `${String(action.resource ?? 'sp').toUpperCase()} ${formatSigned(action.change)}`;
  }
  if (action.type === 'enemyEvent') {
    return action.eventType ?? '';
  }
  if (action.type === 'switch') {
    return formatFrameTime(action.durationMs ?? 0);
  }
  return action.note ?? '';
}

function resolveActionLaneId(action) {
  return resolveTimelineActionLaneId(action, actorLaneIds.value);
}

function resolveDamageLaneId(damage) {
  if (damage.actorId && actorLaneIds.value.has(damage.actorId)) {
    return damage.actorId;
  }

  const action = actionsById.value.get(damage.actionId);
  return action ? resolveActionLaneId(action) : 'system';
}

function resolveCandidateValueLaneId(marker) {
  const action = actionsById.value.get(marker.actionId);
  return action ? resolveActionLaneId(action) : 'system';
}

function createCandidateValueTimelineMarkers() {
  return (props.candidateValueChart?.series ?? [])
    .filter(series => isCandidateSeriesVisible(series.key))
    .flatMap(series => {
      const meta = getCandidateSeriesMeta(series.key);
      return (series.points ?? [])
        .map((point, index) => {
          const timeMs = point.displayTimeMs ?? point.sourceTimeMs ?? 0;
          const frameLabel = point.displayFrameLabel ?? formatFrameTime(timeMs);
          const frameGroupId = `${point.actionId}-${point.hitIndex}-${frameLabel}`;
          return {
            id: `${series.key}-${point.actionId}-${point.hitIndex}-${index}`,
            frameGroupId,
            seriesKey: series.key,
            seriesLabel: series.label,
            shortLabel: meta.shortLabel,
            color: meta.color,
            valueKind: series.valueKind,
            unit: series.unit,
            actionId: point.actionId,
            actionName: point.actionName,
            skillId: point.skillId,
            hitSkillId: point.hitSkillId,
            hitIndex: point.hitIndex,
            timeMs,
            frameLabel,
            value: point.value,
            valueMin: point.valueMin,
            valueMax: point.valueMax,
            valueSamples: point.valueSamples ?? [],
            candidateCount: point.candidateCount,
            xPercent: point.xPercent,
            yPercent: point.yPercent,
            sourceFrameIndex: point.sourceFrameIndex,
            displayFrameIndex: point.displayFrameIndex,
            localFrameIndex: point.localFrameIndex,
            chainStartFrame: point.chainStartFrame,
            absoluteFrameIndex: point.absoluteFrameIndex,
            sourceTimeMs: point.sourceTimeMs,
            displayTimeMs: point.displayTimeMs,
            elementConfigIds: point.elementConfigIds ?? [],
            elementDetails: point.elementDetails ?? [],
            sourceStatus: point.sourceStatus,
            timeAdjustmentStatus: point.timeAdjustmentStatus,
            seriesOrder: meta.order,
          };
        })
        .filter(
          marker =>
            isCandidateMarkerInActorFilter(marker) &&
            isCandidateMarkerInActionFilter(marker) &&
            isCandidateMarkerInDisplayScope(marker)
        );
    });
}

function createCandidateValueTimelineCurves(markers) {
  const bySeries = new Map();
  for (const marker of markers) {
    if (!bySeries.has(marker.seriesKey)) {
      bySeries.set(marker.seriesKey, {
        seriesKey: marker.seriesKey,
        seriesLabel: marker.seriesLabel,
        seriesOrder: marker.seriesOrder,
        points: [],
      });
    }
    bySeries.get(marker.seriesKey).points.push(marker);
  }

  return [...bySeries.values()]
    .map(curve => {
      const points = curve.points
        .slice()
        .sort(
          (left, right) =>
            left.timeMs - right.timeMs ||
            left.hitIndex - right.hitIndex ||
            left.seriesOrder - right.seriesOrder
        );
      return {
        ...curve,
        pointCount: points.length,
        polylinePoints: points
          .map(
            point =>
              `${clampPercent(point.xPercent)},${clampPercent(point.yPercent)}`
          )
          .join(' '),
        points,
      };
    })
    .sort(
      (left, right) =>
        left.seriesOrder - right.seriesOrder ||
        String(left.seriesLabel).localeCompare(String(right.seriesLabel))
    );
}

function createCandidateValueFrameGroups(markers) {
  const byFrame = new Map();
  for (const marker of markers) {
    const key = marker.frameGroupId;
    if (!byFrame.has(key)) {
      byFrame.set(key, {
        id: key,
        actionId: marker.actionId,
        hitIndex: marker.hitIndex,
        frameLabel: marker.frameLabel,
        timeMs: marker.timeMs,
        values: [],
      });
    }
    byFrame.get(key).values.push(marker);
  }

  return [...byFrame.values()]
    .map(group => {
      const values = group.values
        .slice()
        .sort(
          (left, right) =>
            left.seriesOrder - right.seriesOrder ||
            String(left.seriesLabel).localeCompare(String(right.seriesLabel))
        );
      return {
        ...group,
        values,
        title: `${group.frameLabel} hit${group.hitIndex}: ${values
          .map(
            value =>
              `${value.seriesLabel} ${formatTimelineNumber(value.value)} ${value.unit}`
          )
          .join(' / ')}`,
      };
    })
    .sort(
      (left, right) =>
        left.timeMs - right.timeMs ||
        Number(left.hitIndex) - Number(right.hitIndex)
    );
}

function formatCandidateValueMarkerTitle(marker) {
  return `${marker.seriesLabel} ${marker.frameLabel} hit${marker.hitIndex}: ${formatTimelineNumber(marker.value)} ${marker.unit}`;
}

function getCandidateSeriesMeta(seriesKey) {
  return (
    CANDIDATE_VALUE_SERIES_META[seriesKey] ?? {
      order: 99,
      shortLabel: '候选',
      color: '#b8c0c7',
    }
  );
}

function isCandidateSeriesVisible(seriesKey) {
  return candidateSeriesVisibility.value[seriesKey] !== false;
}

function setCandidateSeriesVisible(seriesKey, visible) {
  candidateSeriesVisibility.value = {
    ...candidateSeriesVisibility.value,
    [seriesKey]: Boolean(visible),
  };
}

function setCandidateDisplayScope(scope) {
  if (scope === 'selected-frame' && !selectedCandidateFrameGroup.value) {
    return;
  }
  candidateDisplayScope.value = scope;
}

function setCandidateActorFilter(actorId) {
  candidateActorFilter.value = actorId || 'all';
}

function setCandidateActionFilter(actionId) {
  candidateActionFilter.value = actionId || 'all';
}

function isCandidateMarkerInActorFilter(marker) {
  return (
    candidateActorFilter.value === 'all' ||
    resolveCandidateValueLaneId(marker) === candidateActorFilter.value
  );
}

function isCandidateMarkerInActionFilter(marker) {
  return (
    candidateActionFilter.value === 'all' ||
    marker.actionId === candidateActionFilter.value
  );
}

function isCandidateMarkerInDisplayScope(marker) {
  if (candidateDisplayScope.value === 'selected-frame') {
    return (
      !selectedCandidateFrameGroupId.value ||
      marker.frameGroupId === selectedCandidateFrameGroupId.value
    );
  }
  return true;
}

function selectCandidateFrameGroup(group) {
  selectedCandidateFrameGroupId.value = group.id;
}

function selectCandidateFrameGroupByMarker(marker) {
  selectedCandidateFrameGroupId.value = marker.frameGroupId;
}

function formatCandidateFrameGroupValues(group) {
  return group.values
    .map(
      value =>
        `${value.shortLabel} ${formatTimelineNumber(value.value)} ${value.unit}`
    )
    .join(' / ');
}

function formatCandidateFrameGroupSource(group) {
  const firstValue = group.values[0] ?? {};
  const hitSkillText = firstValue.hitSkillId
    ? `hitSkill ${firstValue.hitSkillId}`
    : 'hitSkill 未知';
  const elementText = formatCompactList(
    group.values.flatMap(value => value.elementConfigIds ?? []),
    'element 未展开'
  );
  const sourceText = formatCompactList(
    group.values.map(value => value.sourceStatus),
    '来源候选字段'
  );
  const timingText = formatCompactList(
    group.values.map(value => value.timeAdjustmentStatus),
    '时序候选'
  );
  return `${group.actionId} · ${hitSkillText} · ${elementText} · ${sourceText} · ${timingText} · 未应用候选`;
}

function formatCandidateFrameDetailValue(value) {
  return `${formatTimelineNumber(value.value)} ${value.unit}`;
}

function formatCandidateFrameDetailSamples(value) {
  const sampleText = formatCompactList(
    value.valueSamples?.map(sample => formatTimelineNumber(sample)) ?? [],
    formatTimelineNumber(value.value)
  );
  const candidateCount = Number(value.candidateCount) || 0;
  return `样本 ${sampleText} · 候选 ${candidateCount}`;
}

function formatCandidateFrameDetailFrames(value) {
  const frameParts = [
    createFramePart('src', value.sourceFrameIndex),
    createFramePart('disp', value.displayFrameIndex),
    createFramePart('local', value.localFrameIndex),
    createFramePart('chain', value.chainStartFrame),
    createFramePart('abs', value.absoluteFrameIndex),
  ].filter(Boolean);
  return `帧 ${frameParts.join(' / ')}`;
}

function formatCandidateFrameDetailElements(value) {
  const elementDetails = (value.elementDetails ?? [])
    .map(formatCandidateElementDetail)
    .filter(Boolean);
  const elementText = elementDetails.length
    ? elementDetails.join(' ; ')
    : formatCompactList(value.elementConfigIds ?? [], 'element 未展开');
  return `element ${elementText}`;
}

function formatCandidateElementDetail(element) {
  const elementId = element.elementConfigId ?? '未知';
  const parts = [
    formatCandidateElementHpDetail(element.hpDamage),
    formatCandidateElementFormulaFunctionDetail(element.hpDamage),
    formatCandidateElementSlotAlignmentDetail(
      element.skillLevelBridge?.formulaSlotAlignment
    ),
    formatCandidateElementToughnessDetail(element.toughnessDamage),
    formatCandidateElementEnergyDetail(element.selfEnergyChange),
  ].filter(Boolean);
  return parts.length ? `${elementId} ${parts.join(' ')}` : `${elementId}`;
}

function formatCandidateElementHpDetail(hpDamage) {
  if (!hpDamage) {
    return null;
  }
  const values = formatCompactList(
    hpDamage.rawFormulaParamValues?.map(value => formatTimelineNumber(value)) ??
      [],
    null
  );
  return values ? `HP${values}` : null;
}

function formatCandidateElementFormulaFunctionDetail(hpDamage) {
  const refs = hpDamage?.formulaFunctionRefs ?? [];
  if (refs.length === 0) {
    return null;
  }
  return `函数${refs.map(formatCandidateFormulaFunctionRef).join('/')}`;
}

function formatCandidateFormulaFunctionRef(ref) {
  const label =
    ref.field === 'function_1'
      ? 'f1'
      : ref.field === 'function_2'
        ? 'f2'
        : (ref.field ?? `f${ref.functionId ?? '?'}`);
  return `${label}:${trimFormulaParentheses(
    ref.functionOutput ?? `#${ref.functionId ?? '?'}`
  )}`;
}

function formatCandidateElementSlotAlignmentDetail(alignment) {
  const summaries = alignment?.parameterSummaries ?? [];
  if (summaries.length === 0) {
    return null;
  }
  return `槽${summaries.map(formatCandidateElementSlotSummary).join('/')}`;
}

function formatCandidateElementSlotSummary(summary) {
  const variable = summary.variable || `#${summary.id}`;
  if (summary.relationStatus === 'level-scaling-override-candidate') {
    return `${variable}覆盖${formatTimelineNumber(
      summary.firstLevelValue
    )}-${formatTimelineNumber(summary.lastLevelValue)}`;
  }
  if (summary.relationStatus === 'constant-direct-slot-match') {
    return `${variable}直连${formatTimelineNumber(summary.formulaParamValue)}`;
  }
  return `${variable}${summary.relationStatus ?? '未确认'}`;
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

function formatCandidateElementToughnessDetail(toughnessDamage) {
  if (!toughnessDamage) {
    return null;
  }
  const value = toughnessDamage.weakBreakDamageRate;
  return Number.isFinite(Number(value))
    ? `韧性${formatTimelineNumber(value)}`
    : null;
}

function formatCandidateElementEnergyDetail(selfEnergyChange) {
  if (!selfEnergyChange) {
    return null;
  }
  const parts = [
    createElementNumberPart('能量', selfEnergyChange.recoverSP),
    createElementNumberPart('宠物', selfEnergyChange.petRecoverSP),
    createElementNumberPart('间隔', selfEnergyChange.recoverInterval),
  ].filter(Boolean);
  return parts.length ? parts.join('/') : null;
}

function createElementNumberPart(label, value) {
  return Number.isFinite(Number(value))
    ? `${label}${formatTimelineNumber(value)}`
    : null;
}

function createFramePart(label, value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? `${label}${number}` : null;
}

function formatCompactList(values, fallback) {
  const uniqueValues = [
    ...new Set(
      values
        .map(value => String(value ?? '').trim())
        .filter(value => value.length > 0)
    ),
  ];
  return uniqueValues.length ? uniqueValues.join('/') : fallback;
}

function formatTimelineNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString('zh-CN');
}

function formatSigned(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? '+' : ''}${number}`;
}

function clampPercent(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function beginDrag(event, action) {
  if ((event.button ?? 0) !== 0) {
    return;
  }

  const rect = laneRef.value?.getBoundingClientRect();
  if (!rect || rect.width <= 0) {
    emit('select-action', action.id);
    return;
  }

  event.preventDefault();
  event.currentTarget?.setPointerCapture?.(event.pointerId);
  emit('select-action', action.id);
  dragState.value = {
    actionId: action.id,
    canChangeLane: canChangeActionLane(action),
    initialLaneId: resolveActionLaneId(action),
    targetLaneId: null,
    laneWidth: rect.width,
    initialClientX: event.clientX,
    initialStartMs: action.startMs,
    maxStartMs: Math.max(
      0,
      props.durationMs -
        (action.durationMs ?? DEFAULT_TIMELINE_ACTION_DURATION_MS)
    ),
  };

  window.addEventListener('pointermove', handleDragMove);
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
}

function beginResize(event, action) {
  if ((event.button ?? 0) !== 0) {
    return;
  }

  const rect = laneRef.value?.getBoundingClientRect();
  if (!rect || rect.width <= 0) {
    emit('select-action', action.id);
    return;
  }

  event.preventDefault();
  event.currentTarget?.setPointerCapture?.(event.pointerId);
  emit('select-action', action.id);
  resizeState.value = {
    actionId: action.id,
    laneWidth: rect.width,
    initialClientX: event.clientX,
    initialDurationMs: action.durationMs ?? DEFAULT_TIMELINE_ACTION_DURATION_MS,
    maxDurationMs: Math.max(
      MIN_ACTION_DURATION_MS,
      props.durationMs - action.startMs
    ),
  };

  window.addEventListener('pointermove', handleResizeMove);
  window.addEventListener('pointerup', endResize);
  window.addEventListener('pointercancel', endResize);
}

function nudgeAction(event, action, direction) {
  const stepMs = event.shiftKey ? props.snapMs * 4 : props.snapMs;
  const maxStartMs = Math.max(
    0,
    props.durationMs -
      (action.durationMs ?? DEFAULT_TIMELINE_ACTION_DURATION_MS)
  );
  emit('select-action', action.id);
  emit('update-action-time', {
    actionId: action.id,
    startMs: clampNumber(action.startMs + direction * stepMs, 0, maxStartMs),
  });
}

function handleResizeMove(event) {
  if (!resizeState.value) {
    return;
  }

  const deltaMs =
    ((event.clientX - resizeState.value.initialClientX) /
      resizeState.value.laneWidth) *
    props.durationMs;
  const nextDurationMs = snapTimeMs(
    resizeState.value.initialDurationMs + deltaMs
  );
  emit('update-action-duration', {
    actionId: resizeState.value.actionId,
    durationMs: clampNumber(
      nextDurationMs,
      MIN_ACTION_DURATION_MS,
      resizeState.value.maxDurationMs
    ),
  });
}

function handleDragMove(event) {
  if (!dragState.value) {
    return;
  }

  if (dragState.value.canChangeLane) {
    dragState.value = {
      ...dragState.value,
      targetLaneId: resolveActorLaneAtPoint(event.clientY),
    };
  }

  const deltaMs =
    ((event.clientX - dragState.value.initialClientX) /
      dragState.value.laneWidth) *
    props.durationMs;
  const nextStartMs = snapTimeMs(dragState.value.initialStartMs + deltaMs);
  emit('update-action-time', {
    actionId: dragState.value.actionId,
    startMs: clampNumber(nextStartMs, 0, dragState.value.maxStartMs),
  });
}

function endDrag(event) {
  if (dragState.value?.canChangeLane && event?.type === 'pointerup') {
    const targetLaneId = resolveActorLaneAtPoint(event.clientY);
    if (targetLaneId && targetLaneId !== dragState.value.initialLaneId) {
      emit('update-action-lane', {
        actionId: dragState.value.actionId,
        laneId: targetLaneId,
      });
    }
  }

  dragState.value = null;
  window.removeEventListener('pointermove', handleDragMove);
  window.removeEventListener('pointerup', endDrag);
  window.removeEventListener('pointercancel', endDrag);
}

function endResize() {
  resizeState.value = null;
  window.removeEventListener('pointermove', handleResizeMove);
  window.removeEventListener('pointerup', endResize);
  window.removeEventListener('pointercancel', endResize);
}

function setTimelineZoom(value) {
  timelineZoom.value = clampNumber(Number(value), MIN_ZOOM, MAX_ZOOM);
}

function setLaneRowRef(element, laneId) {
  if (element) {
    laneRowRefs.set(laneId, element);
  } else {
    laneRowRefs.delete(laneId);
  }
}

function canChangeActionLane(action) {
  return resolveActionLaneId(action) !== 'system';
}

function resolveActorLaneAtPoint(clientY) {
  if (!Number.isFinite(clientY)) {
    return null;
  }

  for (const lane of timelineLanes.value) {
    if (lane.type !== 'actor') {
      continue;
    }
    const element = laneRowRefs.get(lane.id);
    const rect = element?.getBoundingClientRect?.();
    if (!rect || rect.height <= 0) {
      continue;
    }
    if (clientY >= rect.top && clientY <= rect.bottom) {
      return lane.id;
    }
  }

  return null;
}

function formatZoom(value) {
  return `${Number(value)
    .toFixed(2)
    .replace(/\.?0+$/, '')}x`;
}

function snapTimeMs(value) {
  const snap = Math.max(
    WORKBENCH_FRAME_MS,
    Number(props.snapMs) || WORKBENCH_FRAME_MS
  );
  return snap === WORKBENCH_FRAME_MS
    ? snapMsToFrame(value)
    : Math.round(value / snap) * snap;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

onBeforeUnmount(() => {
  endDrag();
  endResize();
});
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
  flex-wrap: wrap;
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

.timeline-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.candidate-toggle-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.candidate-toggle {
  display: inline-flex;
  min-height: 26px;
  align-items: center;
  gap: 5px;
  padding: 0 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  background: #151b20;
  color: #b8c0c7;
  font-size: 11px;
  cursor: pointer;
}

.candidate-toggle input {
  width: 13px;
  height: 13px;
  margin: 0;
  accent-color: #79c7b9;
}

.candidate-toggle i {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
}

.candidate-toggle span {
  white-space: nowrap;
}

.candidate-scope-group {
  display: inline-flex;
  align-items: center;
  padding: 2px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  background: #151b20;
}

.candidate-scope {
  display: inline-flex;
  min-width: 52px;
  min-height: 22px;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: #8f9aa3;
  font-size: 11px;
  cursor: pointer;
}

.candidate-scope.active {
  background: rgba(121, 199, 185, 0.18);
  color: #dff6f1;
}

.candidate-scope:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.candidate-filter-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.candidate-filter {
  display: inline-flex;
  min-height: 26px;
  align-items: center;
  gap: 6px;
  padding: 0 6px 0 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  background: #151b20;
  color: #8f9aa3;
  font-size: 11px;
}

.candidate-filter select {
  min-width: 78px;
  border: 0;
  background: transparent;
  color: #dff6f1;
  font-size: 11px;
  outline: none;
}

.icon-control {
  display: inline-grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border: 1px solid rgba(121, 199, 185, 0.32);
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.1);
  color: #dff6f1;
  cursor: pointer;
}

.icon-control:hover {
  filter: brightness(1.16);
}

.control-icon {
  width: 14px;
  height: 14px;
}

.zoom-slider {
  width: 118px;
  accent-color: #79c7b9;
}

.zoom-value {
  min-width: 28px;
  color: #b8c0c7;
  font-size: 12px;
  text-align: right;
}

.timeline-scale {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  gap: 10px;
  padding: 12px 18px 0;
  color: #8f9aa3;
  font-size: 12px;
}

.scale-viewport,
.timeline-viewport {
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
}

.scale-viewport {
  scrollbar-width: none;
}

.scale-viewport::-webkit-scrollbar {
  display: none;
}

.scale-track {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  min-width: 100%;
}

.scale-track span {
  text-align: center;
}

.scale-track span:last-child {
  text-align: right;
}

.timeline-shell {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  gap: 10px;
  margin: 12px 18px;
}

.candidate-frame-summary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 6px 12px;
  margin: 0 18px 12px 140px;
  padding: 8px 10px;
  border: 1px solid rgba(121, 199, 185, 0.2);
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.07);
}

.candidate-frame-summary span {
  color: #9ce0d2;
  font-size: 12px;
  font-weight: 700;
}

.candidate-frame-summary strong {
  min-width: 0;
  color: #ffffff;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.candidate-frame-summary small {
  grid-column: 1 / -1;
  color: #8f9aa3;
  font-size: 11px;
  overflow-wrap: anywhere;
}

.candidate-frame-details {
  display: grid;
  grid-column: 1 / -1;
  gap: 6px;
}

.candidate-frame-detail-row {
  display: grid;
  grid-template-columns: 92px minmax(86px, 0.7fr) repeat(3, minmax(0, 1fr));
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  background: rgba(10, 13, 16, 0.22);
}

.candidate-frame-detail-row b {
  color: #dff6f1;
  font-size: 11px;
  overflow-wrap: anywhere;
}

.candidate-frame-detail-row span {
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.candidate-frame-detail-row small {
  grid-column: auto;
  color: #8f9aa3;
  font-size: 10px;
  overflow-wrap: anywhere;
}

.lane-labels,
.timeline-lane {
  display: grid;
  gap: 8px;
  min-width: 100%;
}

.lane-label {
  display: grid;
  align-content: center;
  min-height: 110px;
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  background: #151b20;
}

.lane-label span {
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lane-label small {
  margin-top: 4px;
  color: #8f9aa3;
  font-size: 11px;
}

.lane-label.system {
  border-color: rgba(185, 164, 121, 0.28);
  background: #1d1b16;
}

.lane-row {
  position: relative;
  min-height: 110px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  background:
    repeating-linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.05) 0,
      rgba(255, 255, 255, 0.05) 1px,
      transparent 1px,
      transparent 10%
    ),
    #14191e;
  overflow: hidden;
}

.lane-row.drop-target {
  border-color: rgba(121, 199, 185, 0.78);
  box-shadow: inset 0 0 0 1px rgba(121, 199, 185, 0.28);
}

.action-block {
  position: absolute;
  top: 10px;
  height: 42px;
  min-width: 96px;
  padding: 7px 54px 7px 10px;
  border: 1px solid rgba(121, 199, 185, 0.5);
  border-radius: 6px;
  background: linear-gradient(180deg, #274840 0%, #20352f 100%);
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28);
  cursor: pointer;
}

.action-block:hover,
.action-block:focus {
  border-color: rgba(255, 255, 255, 0.8);
  outline: none;
}

.action-block.selected {
  box-shadow:
    0 0 0 2px rgba(121, 199, 185, 0.3),
    0 12px 30px rgba(0, 0, 0, 0.28);
}

.action-block.batch-selected {
  border-color: rgba(121, 199, 185, 0.92);
  box-shadow:
    0 0 0 2px rgba(121, 199, 185, 0.2),
    0 12px 30px rgba(0, 0, 0, 0.28);
}

.action-block.dragging {
  cursor: grabbing;
}

.action-block.resizing {
  cursor: ew-resize;
}

.action-block span,
.action-block small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-block small {
  margin-top: 3px;
  color: #b8d8d2;
  font-size: 10px;
  font-weight: 500;
}

.action-block .overlap-badge {
  position: absolute;
  top: 4px;
  right: 22px;
  display: inline-flex;
  width: auto;
  max-width: 30px;
  height: 16px;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  border: 1px solid rgba(255, 214, 214, 0.5);
  border-radius: 3px;
  background: rgba(245, 108, 108, 0.28);
  color: #ffdede;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.action-block .auto-delay-badge {
  position: absolute;
  right: 22px;
  bottom: 4px;
  display: inline-flex;
  width: auto;
  max-width: 30px;
  height: 16px;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  border: 1px solid rgba(255, 230, 190, 0.52);
  border-radius: 3px;
  background: rgba(230, 162, 60, 0.3);
  color: #ffe0ad;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.action-block.type-switch {
  border-color: rgba(126, 176, 255, 0.5);
  background: linear-gradient(180deg, #29436b 0%, #223455 100%);
}

.action-block.type-resource {
  border-color: rgba(155, 196, 120, 0.5);
  background: linear-gradient(180deg, #354d2e 0%, #273923 100%);
}

.action-block.type-enemyEvent,
.action-block.type-annotation,
.action-block.type-wait {
  border-color: rgba(185, 164, 121, 0.45);
  background: linear-gradient(180deg, #4a4029 0%, #352f21 100%);
}

.action-block.overlap {
  border-color: rgba(245, 108, 108, 0.82);
  background: linear-gradient(180deg, #5a3334 0%, #3b272b 100%);
  box-shadow:
    0 0 0 2px rgba(245, 108, 108, 0.18),
    0 12px 30px rgba(0, 0, 0, 0.28);
}

.action-block.auto-delayed {
  border-color: rgba(230, 162, 60, 0.78);
}

.duration-handle {
  position: absolute;
  top: 7px;
  right: 5px;
  width: 12px;
  height: calc(100% - 14px);
  border: 0;
  border-left: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 3px;
  background: linear-gradient(
    90deg,
    transparent 0 3px,
    rgba(255, 255, 255, 0.48) 3px 4px,
    transparent 4px 7px
  );
  cursor: ew-resize;
}

.duration-handle:focus {
  outline: 1px solid rgba(255, 255, 255, 0.8);
  outline-offset: 1px;
}

.damage-marker {
  position: absolute;
  top: 54px;
  width: 10px;
  height: 14px;
  border-radius: 5px;
  background: #e6a23c;
  box-shadow: 0 0 18px rgba(230, 162, 60, 0.42);
  transform: translateX(-50%);
}

.damage-marker.batch-selected {
  background: #79c7b9;
  box-shadow: 0 0 18px rgba(121, 199, 185, 0.62);
}

.candidate-value-curve-track {
  position: absolute;
  top: 68px;
  right: 0;
  left: 0;
  height: 34px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent),
    repeating-linear-gradient(
      0deg,
      transparent 0,
      transparent 15px,
      rgba(255, 255, 255, 0.05) 15px,
      rgba(255, 255, 255, 0.05) 16px
    );
  pointer-events: none;
}

.candidate-value-curve-track svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.candidate-value-curve-line {
  fill: none;
  stroke: #f2b366;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.82;
}

.candidate-value-curve-line.candidate-toughnessDamageCandidate {
  stroke: #79c7b9;
}

.candidate-value-curve-line.candidate-selfEnergyCandidate {
  stroke: #a6b7ff;
}

.candidate-value-frame-hotspot {
  position: absolute;
  z-index: 1;
  top: 68px;
  width: 18px;
  height: 34px;
  border: 0;
  background: transparent;
  cursor: help;
  transform: translateX(-50%);
}

.candidate-value-frame-hotspot:focus,
.candidate-value-frame-hotspot.selected {
  outline: 1px solid rgba(121, 199, 185, 0.72);
  outline-offset: -1px;
}

.candidate-value-marker {
  position: absolute;
  z-index: 2;
  width: 9px;
  height: 9px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 50%;
  background: #f2b366;
  box-shadow: 0 0 14px rgba(242, 179, 102, 0.48);
  transform: translateX(-50%);
}

.candidate-value-marker:focus,
.candidate-value-marker.selected {
  outline: 2px solid rgba(255, 255, 255, 0.86);
  outline-offset: 2px;
}

.candidate-value-marker.candidate-toughnessDamageCandidate {
  border-radius: 2px;
  background: #79c7b9;
  box-shadow: 0 0 14px rgba(121, 199, 185, 0.48);
}

.candidate-value-marker.candidate-selfEnergyCandidate {
  background: #a6b7ff;
  box-shadow: 0 0 14px rgba(166, 183, 255, 0.48);
  transform: translateX(-50%) rotate(45deg);
}

.candidate-value-marker.candidate-selfEnergyCandidate:focus,
.candidate-value-marker.candidate-selfEnergyCandidate.selected {
  outline-offset: 3px;
}

.empty-lane {
  margin: 12px 18px;
  padding: 24px;
  border: 1px dashed rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  color: #8f9aa3;
  text-align: center;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  padding: 0 18px 16px;
  color: #b8c0c7;
  font-size: 12px;
}

.legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend i {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}

.legend-action {
  background: #79c7b9;
}

.legend-damage {
  background: #e6a23c;
}

.legend-candidate {
  background: linear-gradient(
    90deg,
    #f2b366 0 33%,
    #79c7b9 33% 66%,
    #a6b7ff 66% 100%
  );
}

.legend-system {
  background: #b9a479;
}

.legend-overlap {
  background: #f56c6c;
}

.legend-delay {
  background: #e6a23c;
}

.warning {
  color: #efc574;
}

@media (max-width: 760px) {
  .panel-title {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .timeline-tools {
    width: 100%;
    margin-left: 0;
  }

  .zoom-slider {
    flex: 1;
    min-width: 120px;
  }

  .timeline-scale {
    grid-template-columns: 84px minmax(0, 1fr);
  }

  .timeline-shell {
    grid-template-columns: 84px minmax(0, 1fr);
  }

  .candidate-frame-summary {
    grid-template-columns: 1fr;
    margin: 0 18px 12px;
  }

  .candidate-scope-group {
    width: 100%;
  }

  .candidate-scope {
    flex: 1;
  }

  .candidate-filter-group {
    width: 100%;
  }

  .candidate-filter {
    flex: 1;
  }

  .candidate-filter select {
    flex: 1;
    min-width: 0;
  }

  .candidate-frame-detail-row {
    grid-template-columns: 1fr;
  }

  .lane-label {
    padding: 8px;
  }
}
</style>
