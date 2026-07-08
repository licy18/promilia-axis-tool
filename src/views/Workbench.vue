<template>
  <main class="workbench">
    <nav class="top-nav">
      <RouterLink class="back-link" to="/">
        <ArrowLeft class="nav-icon" />
        <span>首页</span>
      </RouterLink>
      <div class="nav-side">
        <div class="nav-status">
          <span>真实数据</span>
          <span>Schema v{{ project.schemaVersion }}</span>
          <span>{{ simulationResult.summary.formulaVersion }}</span>
        </div>
        <div class="nav-actions">
          <span class="draft-status" data-testid="workbench-draft-status">{{
            draftStatus
          }}</span>
          <button
            class="nav-button"
            data-testid="workbench-save-draft"
            type="button"
            @click="saveDraft"
          >
            <Document class="button-icon" />
            <span>保存草稿</span>
          </button>
          <button
            class="nav-button secondary"
            data-testid="workbench-reset-draft"
            type="button"
            @click="resetDraft"
          >
            <Refresh class="button-icon" />
            <span>重置</span>
          </button>
        </div>
      </div>
    </nav>

    <ScenarioHeader
      :project="project"
      :scenario="simulationResult.scenario"
      :summary="simulationResult.summary"
    />

    <WorkbenchFlowPanel
      :selected-action="selectedAction"
      :generation-bundle="simulationResult.threeValueGenerationBundle"
      :runtime-projection="simulationResult.threeValueRuntimeProjection"
      :runtime-selected-detail="runtimeSelectedDetail"
      :selected-state-curve-point-id="selectedStateCurvePointId"
      :runtime-overview-active="runtimeOverviewActive"
      :action-edit-result-context="actionEditResultContext"
      :flow-model="workbenchFlowModel"
      :main-flow-command-surface="mainFlowCommandSurface"
      @dispatch-flow-action="dispatchWorkbenchFlowAction"
    />

    <div
      class="workbench-grid"
      :data-flow-phase="workbenchFlowModel.phase"
      :data-main-flow-current-region="
        runtimeReviewFlowView.region.currentRegion
      "
      :data-main-flow-next-target-kind="
        runtimeReviewFlowView.region.nextTargetKind
      "
      :data-main-flow-next-region="
        runtimeReviewFlowView.region.nextRegion
      "
      :data-main-flow-pending-runtime-state-point-id="
        runtimeReviewFlowView.region.pendingRuntimeStatePointId
      "
      :data-main-flow-selected-action-id="
        runtimeReviewFlowView.region.selectedActionId
      "
      :data-main-flow-selected-runtime-state-point-id="
        runtimeReviewFlowView.region.selectedRuntimeStatePointId
      "
      :data-main-flow-dispatch-sequence="
        mainFlowStatusView.dispatch.sequence
      "
      :data-main-flow-dispatch-status="
        mainFlowStatusView.dispatch.status
      "
      :data-main-flow-dispatch-handled="
        mainFlowStatusView.dispatch.handledState
      "
      :data-main-flow-dispatch-has-result="
        mainFlowStatusView.dispatch.hasResultState
      "
      :data-main-flow-dispatch-kind="mainFlowStatusView.dispatch.kind"
      :data-main-flow-dispatch-source="
        mainFlowStatusView.dispatch.source
      "
      :data-main-flow-dispatch-handler-key="
        mainFlowStatusView.dispatch.handlerKey
      "
      :data-main-flow-dispatch-reason="
        mainFlowStatusView.dispatch.reason
      "
      :data-main-flow-dispatch-action-id="
        mainFlowStatusView.dispatch.actionId
      "
      :data-main-flow-dispatch-state-point-id="
        mainFlowStatusView.dispatch.statePointId
      "
      :data-main-flow-loop-step="mainFlowStatusView.loop.step"
      :data-main-flow-loop-status="mainFlowStatusView.loop.status"
      :data-main-flow-loop-recovery-needed="
        mainFlowStatusView.loop.recoveryNeededState
      "
      :data-main-flow-loop-next-action-kind="
        mainFlowStatusView.loop.nextActionKind
      "
      :data-main-flow-loop-next-target-kind="
        mainFlowStatusView.loop.nextTargetKind
      "
      :data-main-flow-loop-current-region="
        mainFlowStatusView.loop.currentRegion
      "
      :data-main-flow-loop-next-region="
        mainFlowStatusView.loop.nextRegion
      "
      :data-runtime-review-selection-status="
        runtimeReviewFlowView.selection.status
      "
      :data-runtime-review-selected-action-id="
        runtimeReviewFlowView.selection.selectedActionId
      "
      :data-runtime-review-selected-state-point-id="
        runtimeReviewFlowView.selection.selectedStatePointId
      "
      :data-runtime-review-pending-state-point-id="
        runtimeReviewFlowView.selection.pendingStatePointId
      "
      :data-runtime-review-source="
        runtimeReviewFlowView.selection.source
      "
      :data-runtime-review-source-kind="
        runtimeReviewFlowView.selection.sourceKind
      "
      :data-runtime-review-last-action-kind="
        runtimeReviewFlowView.selection.lastActionKind
      "
      :data-runtime-review-last-action-source="
        runtimeReviewFlowView.selection.lastActionSource
      "
      data-testid="workbench-main-flow-workspace"
    >
      <ActionLibraryPanel
        :actor="actionLibraryActor"
        :actors="scenario.actors"
        :active-actor-character-id="actionLibraryCharacterId"
        :actions="scenario.actions"
        :skills="actionLibrarySkills"
        :selected-action-id="selectedActionId"
        @select-action="selectAction"
        @add-action="addAction"
        @add-skill-action="addSkillAction"
        @add-annotation-action="addAnnotationAction"
        @add-enemy-event-action="addEnemyEventAction"
        @add-resource-action="addResourceAction"
        @add-switch-action="addSwitchAction"
        @add-wait-action="addWaitAction"
        @copy-action="copyAction"
        @delete-action="deleteAction"
        @delete-action-batch="deleteActionBatch"
        @align-action-batch="alignActionBatch"
        @shift-action-batch="shiftActionBatch"
        @update-active-actor="setActionLibraryCharacterId"
      />

      <div
        class="primary-flow"
        :data-flow-phase="workbenchFlowModel.phase"
        :data-main-flow-current-region="
          runtimeReviewFlowView.region.currentRegion
        "
        :data-main-flow-next-target-kind="
          runtimeReviewFlowView.region.nextTargetKind
        "
        :data-main-flow-next-region="
          runtimeReviewFlowView.region.nextRegion
        "
        :data-main-flow-pending-runtime-state-point-id="
          runtimeReviewFlowView.region.pendingRuntimeStatePointId
        "
        :data-main-flow-selected-runtime-state-point-id="
          runtimeReviewFlowView.region.selectedRuntimeStatePointId
        "
        data-testid="workbench-primary-flow"
      >
        <TimelineGridPreview
          class="timeline-area"
          :actors="scenario.actors"
          :actions="scenario.actions"
          :damage-timeline="simulationResult.damageTimeline"
          :candidate-value-chart="simulationResult.candidateValueSeries.chart"
          :three-value-curve-framework="
            simulationResult.threeValueCurveFramework
          "
          :duration-ms="scenario.time.durationMs"
          :selected-action-id="selectedActionId"
          :flow-model="workbenchFlowModel"
          :action-edit-focus="actionEditFocus"
          :selected-state-curve-point-id="selectedStateCurvePointId"
          :state-curve-focus-mode="stateCurveFocusMode"
          :state-curve-layer-filters="stateCurveLayerFilters"
          :state-curve-track-filters="stateCurveTrackFilters"
          :runtime-focus-source="runtimeFocusSource"
          :timeline-diagnostics="timelineDiagnostics"
          @select-action="selectAction"
          @select-state-curve-point="selectStateCurvePoint"
          @dispatch-flow-action="dispatchWorkbenchFlowAction"
          @update-state-curve-layer-filter="updateStateCurveLayerFilter"
          @update-state-curve-track-filter="updateStateCurveTrackFilter"
          @update-state-curve-focus-mode="updateStateCurveFocusMode"
          @delete-action="deleteAction"
          @update-action-duration="updateActionDuration"
          @update-action-lane="updateActionLane"
          @update-action-time="updateActionTime"
        />

        <div
          class="runtime-review-stack"
          :data-main-flow-current-region="
            runtimeReviewFlowView.region.currentRegion
          "
          :data-main-flow-pending-runtime-state-point-id="
            runtimeReviewFlowView.region.pendingRuntimeStatePointId
          "
          :data-main-flow-selected-runtime-state-point-id="
            runtimeReviewFlowView.region.selectedRuntimeStatePointId
          "
          :data-runtime-review-selection-status="
            runtimeReviewFlowView.selection.status
          "
          :data-runtime-review-selected-action-id="
            runtimeReviewFlowView.selection.selectedActionId
          "
          :data-runtime-review-selected-state-point-id="
            runtimeReviewFlowView.selection.selectedStatePointId
          "
          :data-runtime-review-source="
            runtimeReviewFlowView.selection.source
          "
          :data-runtime-review-source-kind="
            runtimeReviewFlowView.selection.sourceKind
          "
          :data-runtime-review-primary-operation-kind="
            runtimeReviewFlowView.operations.primaryOperationKind
          "
          :data-runtime-review-primary-operation-enabled="
            runtimeReviewFlowView.operations.primaryOperationEnabledState
          "
          data-testid="workbench-runtime-review-stack"
        >
          <div
            v-if="runtimeReviewPrimaryOperationView.visible"
            class="runtime-review-primary-bar"
            :data-primary-operation-action-id="
              runtimeReviewPrimaryOperationView.actionId
            "
            :data-primary-operation-kind="
              runtimeReviewPrimaryOperationView.operationKind
            "
            :data-primary-operation-state-point-id="
              runtimeReviewPrimaryOperationView.statePointId
            "
            data-testid="workbench-runtime-review-primary-bar"
          >
            <button
              type="button"
              class="runtime-review-primary-action"
              :data-action-id="runtimeReviewPrimaryOperationView.actionId"
              :data-operation-kind="
                runtimeReviewPrimaryOperationView.operationKind
              "
              :data-state-point-id="
                runtimeReviewPrimaryOperationView.statePointId
              "
              data-testid="workbench-runtime-review-primary-operation"
              :disabled="!runtimeReviewPrimaryOperationView.enabled"
              @click="dispatchRuntimeReviewPrimaryOperation"
            >
              <EditPen
                v-if="runtimeReviewPrimaryOperationView.isFocusAction"
                class="runtime-review-primary-action-icon"
              />
              <Aim v-else class="runtime-review-primary-action-icon" />
              <span>{{ runtimeReviewPrimaryOperationView.label }}</span>
            </button>
          </div>

          <div class="resource-area" data-testid="workbench-resource-area">
            <ResourceMonitorPanel
              :resource-timeline="simulationResult.resourceTimeline"
              :runtime-projection="simulationResult.threeValueRuntimeProjection"
              :selected-state-curve-point-id="selectedStateCurvePointId"
              :runtime-focus-source="runtimeFocusSource"
              :action-edit-result-context="actionEditResultContext"
              :flow-model="workbenchFlowModel"
              :main-flow-command-surface="mainFlowCommandSurface"
              :summary="simulationResult.summary"
              :diagnostics="simulationResult.diagnostics"
              @dispatch-flow-action="dispatchWorkbenchFlowAction"
            />
          </div>

          <EventLogPanel
            class="event-area"
            :event-log="simulationResult.eventLog"
            :runtime-projection="simulationResult.threeValueRuntimeProjection"
            :runtime-selected-detail="runtimeSelectedDetail"
            :selected-state-curve-point-id="selectedStateCurvePointId"
            :calculator-diagnostic-focus="calculatorDiagnosticFocus"
            :runtime-log-focus="runtimeLogFocus"
            :action-edit-focus="actionEditFocus"
            :action-edit-result-context="actionEditResultContext"
            :flow-model="workbenchFlowModel"
            :main-flow-command-surface="mainFlowCommandSurface"
            @dispatch-flow-action="dispatchWorkbenchFlowAction"
          />
        </div>
      </div>

      <div
        class="side-stack"
        :data-flow-phase="workbenchFlowModel.phase"
        :data-main-flow-inspector-mode="
          runtimeReviewFlowView.region.inspectorMode
        "
        data-testid="workbench-side-inspector"
      >
        <PropertiesPanel
          :selection="selection"
          :characters="workbenchSeed.gameData.characters"
          :actors="scenario.actors"
          :skills="workbenchSeed.gameData.skills"
          :enemies="workbenchSeed.gameData.enemies"
          :selected-action="selectedAction"
          :duration-ms="scenario.time.durationMs"
          :action-edit-focus="actionEditFocus"
          :action-edit-result-context="actionEditResultContext"
          :flow-model="workbenchFlowModel"
          :main-flow-command-surface="mainFlowCommandSurface"
          @update-selection="updateSelection"
          @update-action="updateAction"
          @dispatch-flow-action="dispatchWorkbenchFlowAction"
        />

        <EnemyPanel
          :enemy="scenario.enemy"
          :enemy-config="enemyConfig"
          @update-enemy-config="updateEnemyConfig"
        />

        <RuntimeSelectedDetailPanel
          :detail="runtimeSelectedDetail"
          :action-edit-focus="actionEditFocus"
          :action-edit-result-context="actionEditResultContext"
          :flow-model="workbenchFlowModel"
          :main-flow-command-surface="mainFlowCommandSurface"
          @dispatch-flow-action="dispatchWorkbenchFlowAction"
        />

        <AnalysisPanel
          :summary="simulationResult.summary"
          :diagnostics="simulationResult.diagnostics"
          :damage-timeline="simulationResult.damageTimeline"
          :action-result-timeline="simulationResult.actionResultTimeline"
          :runtime-projection="simulationResult.threeValueRuntimeProjection"
          :runtime-selected-detail="runtimeSelectedDetail"
          :candidate-value-series="simulationResult.candidateValueSeries"
          :draft-status="draftStatus"
          :action-edit-source="actionEditSource"
          :action-edit-result-context="actionEditResultContext"
          :flow-model="workbenchFlowModel"
          :three-value-curve-framework="
            simulationResult.threeValueCurveFramework
          "
          :selected-action-id="selectedActionId"
          :selected-state-curve-point-id="selectedStateCurvePointId"
          :state-curve-focus-mode="stateCurveFocusMode"
          :state-curve-layer-filters="stateCurveLayerFilters"
          :state-curve-track-filters="stateCurveTrackFilters"
          :calculator-diagnostic-scope="calculatorDiagnosticScope"
          :insertion-diagnostics="insertionDiagnostics"
          :timeline-diagnostics="timelineDiagnostics"
          @select-state-curve-point="selectStateCurvePoint"
          @update-state-curve-focus-mode="updateStateCurveFocusMode"
          @update-state-curve-layer-filter="updateStateCurveLayerFilter"
          @update-state-curve-track-filter="updateStateCurveTrackFilter"
          @focus-three-value-calculator-scope="focusThreeValueCalculatorScope"
          @dispatch-flow-action="dispatchWorkbenchFlowAction"
        />
      </div>
    </div>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import {
  Aim,
  ArrowLeft,
  Document,
  EditPen,
  Refresh,
} from '@element-plus/icons-vue';
import ActionLibraryPanel from '../features/workbench/ActionLibraryPanel.vue';
import AnalysisPanel from '../features/workbench/AnalysisPanel.vue';
import EnemyPanel from '../features/workbench/EnemyPanel.vue';
import EventLogPanel from '../features/workbench/EventLogPanel.vue';
import PropertiesPanel from '../features/workbench/PropertiesPanel.vue';
import ResourceMonitorPanel from '../features/workbench/ResourceMonitorPanel.vue';
import RuntimeSelectedDetailPanel from '../features/workbench/RuntimeSelectedDetailPanel.vue';
import ScenarioHeader from '../features/workbench/ScenarioHeader.vue';
import TimelineGridPreview from '../features/workbench/TimelineGridPreview.vue';
import WorkbenchFlowPanel from '../features/workbench/WorkbenchFlowPanel.vue';
import { createRuntimeSelectedDetail } from '../features/workbench/runtimeSelectedDetail';
import {
  createWorkbenchFlowController,
  createWorkbenchFlowPlanHandlers,
} from '../features/workbench/workbenchFlowController';
import {
  createWorkbenchFlowPlanController,
} from '../features/workbench/workbenchFlowPlanController';
import { createWorkbenchFlowRuntime } from '../features/workbench/workbenchFlowRuntime';
import { createWorkbenchFlowRuntimePointSelectionState } from '../features/workbench/workbenchFlowRuntimePointSelection';
import { createWorkbenchFlowRuntimeScopeState } from '../features/workbench/workbenchFlowRuntimeScope';
import {
  createWorkbenchMainFlowStatusView,
  createWorkbenchRuntimeReviewFlowView,
  createWorkbenchFlowModel,
} from '../features/workbench/workbenchFlowModel';
import {
  createWorkbenchMainFlowCommandSurface,
} from '../features/workbench/workbenchMainFlowActions';
import {
  createRuntimeStatePointContexts,
  findFirstRuntimeStatePointForAction,
} from '../features/workbench/runtimeProjectionPoints';
import {
  SYSTEM_TIMELINE_LANE_ID,
  createTimelineDiagnostics,
} from '../features/workbench/timelineDiagnostics';
import {
  DEFAULT_WORKBENCH_SELECTION,
  createWorkbenchActionDraft,
  createWorkbenchProject,
  getSkillActionCatalog,
  getSkillActionVariants,
  getSkillsForCharacter,
  getWorkbenchGameData,
  getWorkbenchSeed,
  normalizeWorkbenchActionDrafts,
  normalizeWorkbenchEnemyConfig,
  normalizeWorkbenchSelection,
} from '../domain/workbenchProjectFactory';
import { ACTION_TYPES } from '../domain/projectSchema';
import {
  clearWorkbenchDraft,
  createDefaultWorkbenchDraftState,
  loadWorkbenchDraft,
  normalizeWorkbenchSegmentSplitOptions,
  saveWorkbenchDraft,
} from '../domain/workbenchDraftStorage';
import { formatFrameTime, frameToMs } from '../domain/timebase';
import { compileProject } from '../simulation/compiler/compileProject';
import { simulateScenario } from '../simulation/engine/simulateScenario';

const workbenchSeed = getWorkbenchSeed();
const gameData = getWorkbenchGameData();
const NEW_ACTION_INSERT_GAP_MS = frameToMs(60);
const DEFAULT_STATE_CURVE_LAYER_FILTERS = {
  applied: true,
  candidate: true,
  sampled: false,
  placeholder: false,
};
const ACTION_EDIT_SOURCE_LABELS = {
  startMs: '开始时间变更',
  level: '等级变更',
  actionVariantIndex: '动作形态变更',
  damageSegmentIndex: '动作形态变更',
  durationMs: '时长变更',
  actorCharacterId: '动作归属变更',
  skillId: '技能变更',
  laneId: '轨道变更',
  change: '资源变化变更',
  eventType: '敌人事件变更',
  targetCharacterId: '切换目标变更',
  resource: '资源类型变更',
  reason: '资源原因变更',
  note: '备注变更',
};
const ACTION_EDIT_SOURCE_PRIORITY = [
  'startMs',
  'level',
  'actionVariantIndex',
  'damageSegmentIndex',
  'durationMs',
  'actorCharacterId',
  'skillId',
  'laneId',
  'change',
  'eventType',
  'targetCharacterId',
  'resource',
  'reason',
  'note',
];
const AUTO_DELAY_NOTE_PATTERN =
  /^自动推迟：同轨已有动作占用，已从 \d+(?:\.\d+)?ms 调整到 \d+(?:\.\d+)?ms。$/;
const initialDraft = createDefaultWorkbenchDraftState();
const selection = ref({ ...initialDraft.selection });
const enemyConfig = ref({ ...initialDraft.enemyConfig });
const segmentSplitOptions = ref({ ...initialDraft.segmentSplitOptions });
const segmentSplitPreview = ref(null);
const actionDrafts = ref([...initialDraft.actionDrafts]);
const selectedActionId = ref(initialDraft.selectedActionId);
const selectedStateCurvePointId = ref('');
const stateCurveFocusMode = ref('all');
const stateCurveLayerFilters = ref({ ...DEFAULT_STATE_CURVE_LAYER_FILTERS });
const stateCurveTrackFilters = ref({});
const calculatorDiagnosticScope = ref('');
const calculatorDiagnosticFocus = ref({ scope: '', sequence: 0 });
const runtimeLogFocus = ref({ source: '', statePointId: '', sequence: 0 });
const actionLibraryCharacterId = ref(initialDraft.selection.characterId);
const draftStatus = ref('未保存草稿');
const actionEditSource = ref(createEmptyActionEditSource());
const actionEditFocus = ref(createEmptyActionEditFocus());
const workbenchFlowDispatchState = ref(createEmptyWorkbenchFlowDispatchState());
const workbenchFlowPlanController = createWorkbenchFlowPlanController({
  getRuntimeProjection: () =>
    simulationResult.value.threeValueRuntimeProjection,
  getSelectedActionId: () => selectedActionId.value,
  getActionEditFocusSequence: () => actionEditFocus.value.sequence,
});
const workbenchFlowRuntime = createWorkbenchFlowRuntime({
  actionExists: actionId => Boolean(findActionDraftById(actionId)),
  selectAction: (actionId, options) => selectAction(actionId, options),
  setActionEditFocus: focus => {
    actionEditFocus.value = { ...focus };
  },
  focusCalculatorScope: (scope, options) =>
    focusThreeValueCalculatorScope(scope, options),
  setCalculatorScope: scope => {
    calculatorDiagnosticScope.value = scope;
  },
  selectRuntimeStatePoint: statePointId =>
    selectRuntimeFlowStatePoint(statePointId),
  clearRuntimeSelection: ({ stateCurveFocusMode: mode = 'all' } = {}) => {
    selectedStateCurvePointId.value = '';
    stateCurveFocusMode.value = mode;
  },
  setStateCurveLayerFilters: filters => {
    stateCurveLayerFilters.value = { ...filters };
  },
  setStateCurveTrackFilters: filters => {
    stateCurveTrackFilters.value = { ...filters };
  },
  focusRuntimeLog: ({ source, statePointId }) => {
    runtimeLogFocus.value = {
      source,
      statePointId,
      sequence: runtimeLogFocus.value.sequence + 1,
    };
  },
});
const workbenchFlowController = createWorkbenchFlowController(
  createWorkbenchFlowPlanHandlers({
    flowPlanController: workbenchFlowPlanController,
    applyRuntimeFlowPlan: plan =>
      workbenchFlowRuntime.applyRuntimeFlowPlan(plan),
    applyActionEditFlowPlan: plan =>
      workbenchFlowRuntime.applyActionEditFlowPlan(plan),
  })
);

const project = computed(() =>
  createWorkbenchProject(selection.value, {
    enemyConfig: enemyConfig.value,
    actions: actionDrafts.value,
  })
);
const scenario = computed(() => compileProject(project.value, gameData));
const simulationResult = computed(() => simulateScenario(scenario.value));
const runtimeSelectedDetail = computed(() =>
  createRuntimeSelectedDetail({
    runtimeProjection: simulationResult.value.threeValueRuntimeProjection,
    selectedStateCurvePointId: selectedStateCurvePointId.value,
  })
);
const runtimeFocusSource = computed(() =>
  runtimeLogFocus.value.statePointId &&
  runtimeLogFocus.value.statePointId === selectedStateCurvePointId.value
    ? runtimeLogFocus.value.source
    : ''
);
const runtimeOverviewActive = computed(
  () =>
    calculatorDiagnosticScope.value === 'runtime' &&
    !selectedStateCurvePointId.value
);
const actionEditResultContext = computed(() =>
  createActionEditResultContext({
    source: actionEditSource.value,
    runtimeProjection: simulationResult.value.threeValueRuntimeProjection,
  })
);
const workbenchFlowModel = computed(() =>
  createWorkbenchFlowModel({
    selectedAction: selectedAction.value,
    generationBundle: simulationResult.value.threeValueGenerationBundle,
    runtimeProjection: simulationResult.value.threeValueRuntimeProjection,
    runtimeSelectedDetail: runtimeSelectedDetail.value,
    selectedStateCurvePointId: selectedStateCurvePointId.value,
    runtimeFocusSource: runtimeFocusSource.value,
    runtimeOverviewActive: runtimeOverviewActive.value,
    actionEditFocus: actionEditFocus.value,
    actionEditResultContext: actionEditResultContext.value,
    flowDispatchState: workbenchFlowDispatchState.value,
  })
);
const mainFlowStatusView = computed(() =>
  createWorkbenchMainFlowStatusView({
    flowModel: workbenchFlowModel.value,
  })
);
const runtimeReviewFlowView = computed(() =>
  createWorkbenchRuntimeReviewFlowView({
    flowModel: workbenchFlowModel.value,
  })
);
const mainFlowCommandSurface = computed(() =>
  createWorkbenchMainFlowCommandSurface({
    flowModel: workbenchFlowModel.value,
    source: 'workbench-flow-panel',
    recoverySource: 'workbench-flow-recovery',
    runtimeReviewPrimarySource: 'runtime-review-primary',
  })
);
const runtimeReviewPrimaryOperationCommand = computed(
  () => mainFlowCommandSurface.value.runtimeReviewPrimary
);
const runtimeReviewPrimaryOperationView = computed(() =>
  runtimeReviewPrimaryOperationCommand.value.view
);
const timelineDiagnostics = computed(() =>
  createTimelineDiagnostics({
    actors: scenario.value.actors,
    actions: scenario.value.actions,
  })
);
const insertionDiagnostics = computed(() =>
  createInsertionDiagnostics(scenario.value.actions)
);
const actionLibraryActor = computed(() => {
  return (
    scenario.value.actors.find(
      actor =>
        Number(actor.characterId) === Number(actionLibraryCharacterId.value)
    ) ?? scenario.value.actors[0]
  );
});
const actionLibrarySkills = computed(() =>
  getSkillsForCharacter(actionLibraryActor.value?.characterId)
);
const selectedAction = computed(() => {
  return (
    scenario.value.actions.find(
      action => action.id === selectedActionId.value
    ) ?? scenario.value.actions[0]
  );
});
const selectedDraft = computed(() => {
  return (
    actionDrafts.value.find(action => action.id === selectedActionId.value) ??
    actionDrafts.value[0]
  );
});

onMounted(() => {
  const draft = loadWorkbenchDraft(getLocalStorage());
  if (!draft) {
    return;
  }

  applyDraftState(draft);
  draftStatus.value = '已恢复草稿';
});

function updateSelection(patch) {
  clearSegmentSplitPreview();
  const previousSelection = selection.value;
  const characterChanged =
    patch.characterId != null &&
    Number(patch.characterId) !== Number(selection.value.characterId);
  const secondaryCharacterChanged =
    patch.secondaryCharacterId != null &&
    Number(patch.secondaryCharacterId) !==
      Number(selection.value.secondaryCharacterId);
  const nextSelection = normalizeWorkbenchSelection({
    ...selection.value,
    ...patch,
  });
  selection.value = nextSelection;

  normalizeActionLibraryCharacterId(previousSelection, nextSelection, {
    characterChanged,
    secondaryCharacterChanged,
  });

  if (characterChanged || secondaryCharacterChanged) {
    const nextActionDrafts = actionDrafts.value.map(action => {
      const nextAction = { ...action };
      if (
        characterChanged &&
        Number(nextAction.actorCharacterId) ===
          Number(previousSelection.characterId)
      ) {
        nextAction.actorCharacterId = nextSelection.characterId;
      }
      if (
        secondaryCharacterChanged &&
        Number(nextAction.actorCharacterId) ===
          Number(previousSelection.secondaryCharacterId)
      ) {
        nextAction.actorCharacterId = nextSelection.secondaryCharacterId;
      }
      if (
        secondaryCharacterChanged &&
        nextAction.type === ACTION_TYPES.SWITCH
      ) {
        nextAction.targetCharacterId = nextSelection.secondaryCharacterId;
      }
      return nextAction;
    });
    actionDrafts.value = normalizeWorkbenchActionDrafts(
      nextActionDrafts,
      nextSelection
    );
  }

  if (characterChanged) {
    selectedActionId.value = actionDrafts.value[0].id;
  }

  markDraftDirty();
}

function updateAction(patch) {
  clearSegmentSplitPreview();
  const actionId = selectedActionId.value;
  const previousAction = findActionDraftById(actionId);
  actionDrafts.value = actionDrafts.value.map(action => {
    if (action.id !== actionId) {
      return action;
    }

    const normalizedPatch = applyInsertionLifecyclePatch(
      action,
      normalizeActionPatch(action, patch)
    );
    if (action.type !== ACTION_TYPES.SKILL) {
      return createWorkbenchActionDraft({
        ...action,
        ...normalizedPatch,
        startMs: clampNumber(
          normalizedPatch.startMs ?? action.startMs,
          0,
          project.value.time.durationMs
        ),
        durationMs: clampNumber(
          normalizedPatch.durationMs ?? action.durationMs,
          1,
          project.value.time.durationMs
        ),
      });
    }

    const nextActorCharacterId = Number(
      normalizedPatch.actorCharacterId ??
        action.actorCharacterId ??
        selection.value.characterId
    );
    const skill = resolveSkillForActionPatch(
      action,
      normalizedPatch,
      nextActorCharacterId
    );
    const skillChanged = Number(skill.id) !== Number(action.skillId);
    const nextLevel = skillChanged
      ? 1
      : (normalizedPatch.level ?? action.level);
    const nextActionVariantIndex = skillChanged
      ? 0
      : (normalizedPatch.actionVariantIndex ??
        normalizedPatch.damageSegmentIndex ??
        action.actionVariantIndex ??
        action.damageSegmentIndex);

    return createWorkbenchActionDraft({
      ...action,
      ...normalizedPatch,
      skillId: skill.id,
      actorCharacterId: nextActorCharacterId,
      startMs: clampNumber(
        normalizedPatch.startMs ?? action.startMs,
        0,
        project.value.time.durationMs
      ),
      level: clampNumber(nextLevel, 1, skill.level.values.length),
      actionVariantIndex: nextActionVariantIndex,
      damageSegmentIndex: nextActionVariantIndex,
    });
  });
  if (patch.actorCharacterId != null) {
    setActionLibraryCharacterId(patch.actorCharacterId);
  }
  recordActionEditSource(actionId, patch, {
    previousAction,
    nextAction: findActionDraftById(actionId),
  });
  markDraftDirty();
}

function updateEnemyConfig(patch) {
  clearSegmentSplitPreview();
  enemyConfig.value = normalizeWorkbenchEnemyConfig({
    ...enemyConfig.value,
    ...patch,
  });
  markDraftDirty();
}

function updateSegmentSplitOptions(patch) {
  clearSegmentSplitPreview();
  segmentSplitOptions.value = normalizeWorkbenchSegmentSplitOptions({
    ...segmentSplitOptions.value,
    ...patch,
  });
  markDraftDirty();
}

function updateActionTime({ actionId, startMs }) {
  clearSegmentSplitPreview();
  const previousAction = findActionDraftById(actionId);
  selectedActionId.value = actionId;
  actionDrafts.value = actionDrafts.value.map(action => {
    if (action.id !== actionId) {
      return action;
    }

    return createWorkbenchActionDraft({
      ...action,
      ...clearInsertionForManualEdit(action),
      startMs: clampNumber(startMs, 0, project.value.time.durationMs),
    });
  });
  recordActionEditSource(
    actionId,
    { startMs },
    {
      previousAction,
      nextAction: findActionDraftById(actionId),
    }
  );
  markDraftDirty();
}

function updateActionDuration({ actionId, durationMs }) {
  clearSegmentSplitPreview();
  const previousAction = findActionDraftById(actionId);
  selectedActionId.value = actionId;
  actionDrafts.value = actionDrafts.value.map(action => {
    if (action.id !== actionId) {
      return action;
    }

    return createWorkbenchActionDraft({
      ...action,
      ...clearInsertionForManualEdit(action),
      durationMs: clampNumber(
        durationMs,
        1,
        Math.max(1, project.value.time.durationMs - action.startMs)
      ),
    });
  });
  recordActionEditSource(
    actionId,
    { durationMs },
    {
      previousAction,
      nextAction: findActionDraftById(actionId),
    }
  );
  markDraftDirty();
}

function updateActionLane({ actionId, laneId }) {
  clearSegmentSplitPreview();
  const previousAction = findActionDraftById(actionId);
  const targetActor = scenario.value.actors.find(actor => actor.id === laneId);
  if (!targetActor) {
    return;
  }

  let didUpdate = false;
  selectedActionId.value = actionId;
  actionDrafts.value = actionDrafts.value.map(action => {
    if (action.id !== actionId || !canAssignActionLane(action)) {
      return action;
    }

    const targetCharacterId = Number(targetActor.characterId);
    if (Number(action.actorCharacterId) === targetCharacterId) {
      return action;
    }

    const patch = {
      actorCharacterId: targetCharacterId,
    };

    if (action.type === ACTION_TYPES.SKILL) {
      const currentSkill = findSkillById(action.skillId);
      if (Number(currentSkill?.characterId) !== targetCharacterId) {
        const nextSkill = findFirstSkillForCharacter(targetCharacterId);
        if (nextSkill) {
          patch.skillId = nextSkill.id;
          patch.level = 1;
          patch.actionVariantIndex = 0;
          patch.damageSegmentIndex = 0;
        }
      }
    }

    if (
      action.type === ACTION_TYPES.SWITCH &&
      Number(action.targetCharacterId) === targetCharacterId
    ) {
      patch.targetCharacterId =
        resolveAlternateActorCharacterId(targetCharacterId);
    }

    didUpdate = true;
    actionLibraryCharacterId.value = targetCharacterId;
    return createWorkbenchActionDraft({
      ...action,
      ...patch,
      ...clearInsertionForManualEdit(action),
    });
  });

  if (didUpdate) {
    recordActionEditSource(
      actionId,
      { laneId },
      {
        previousAction,
        nextAction: findActionDraftById(actionId),
      }
    );
    markDraftDirty();
  }
}

function addAction() {
  clearSegmentSplitPreview();
  const fallbackEntry = getSkillActionCatalog(actionLibrarySkills.value, 1)[0];
  if (fallbackEntry) {
    addSkillAction(fallbackEntry);
    return;
  }

  const actorCharacterId = Number(
    actionLibraryActor.value?.characterId ??
      selectedDraft.value.actorCharacterId
  );
  addSkillAction({
    skillId: resolveContextSkill(actorCharacterId, selectedDraft.value.skillId)
      .id,
  });
}

function addSkillAction(actionEntryOrSkillId) {
  clearSegmentSplitPreview();
  const actorCharacterId = Number(
    actionLibraryActor.value?.characterId ??
      selectedDraft.value.actorCharacterId
  );
  const actionEntry = normalizeActionEntryInput(
    actionEntryOrSkillId,
    actorCharacterId
  );
  const skill = resolveContextSkill(actorCharacterId, actionEntry.skillId);
  const level = resolveSkillInsertLevel(actorCharacterId, skill);
  addInsertedAction({
    id: createNextActionId(),
    skillId: skill.id,
    actorCharacterId,
    level,
    actionVariantIndex: actionEntry.actionVariantIndex ?? 0,
    damageSegmentIndex: actionEntry.actionVariantIndex ?? 0,
    durationMs: actionEntry.durationMs,
    note:
      actionEntry.note ??
      `${actionEntry.label ?? '动作'}：${actionEntry.rawValue ?? '倍率待补'}；真实动作帧等待 asset 或运行时捕获补充。`,
  });
}

function previewSkillSegmentActions(skillId) {
  segmentSplitPreview.value = createSkillSegmentSplitPreview(skillId);
}

function confirmSkillSegmentActions() {
  const preview = segmentSplitPreview.value;
  if (!preview?.actions?.length) {
    return;
  }

  const generationBatch = createSegmentGenerationBatch(preview);
  preview.actions.forEach(item => {
    addInsertedAction(
      {
        id: createNextActionId(),
        skillId: preview.skillId,
        actorCharacterId: preview.actorCharacterId,
        level: preview.level,
        actionVariantIndex: item.actionVariantIndex,
        damageSegmentIndex: item.damageSegmentIndex,
        note: `动作形态拆分：${formatActionVariantPreview(item)}；非真实命中帧。`,
        generationBatch,
      },
      {
        requestedStartMs: item.requestedStartMs,
      }
    );
  });
  clearSegmentSplitPreview();
}

function clearSegmentSplitPreview() {
  segmentSplitPreview.value = null;
}

function addWaitAction() {
  clearSegmentSplitPreview();
  addInsertedAction({
    id: createNextActionId(),
    type: ACTION_TYPES.WAIT,
    skillId: selectedDraft.value.skillId,
    actorCharacterId: actionLibraryCharacterId.value,
    durationMs: 1000,
    level: selectedDraft.value.level,
    note: '等待窗口',
  });
}

function addSwitchAction() {
  clearSegmentSplitPreview();
  const actorCharacterId = Number(
    actionLibraryActor.value?.characterId ??
      selectedDraft.value.actorCharacterId
  );
  addInsertedAction({
    id: createNextActionId(),
    type: ACTION_TYPES.SWITCH,
    skillId: selectedDraft.value.skillId,
    actorCharacterId,
    durationMs: 600,
    level: selectedDraft.value.level,
    targetCharacterId: resolveAlternateActorCharacterId(actorCharacterId),
    note: '切换至副角色',
  });
}

function addAnnotationAction() {
  clearSegmentSplitPreview();
  addInsertedAction({
    id: createNextActionId(),
    type: ACTION_TYPES.ANNOTATION,
    skillId: selectedDraft.value.skillId,
    actorCharacterId: actionLibraryCharacterId.value,
    durationMs: 600,
    level: selectedDraft.value.level,
    note: '备注',
  });
}

function addResourceAction() {
  clearSegmentSplitPreview();
  const actorCharacterId = Number(
    actionLibraryActor.value?.characterId ??
      selectedDraft.value.actorCharacterId
  );
  addInsertedAction({
    id: createNextActionId(),
    type: ACTION_TYPES.RESOURCE,
    skillId: selectedDraft.value.skillId,
    actorCharacterId,
    durationMs: 600,
    level: selectedDraft.value.level,
    resource: 'sp',
    change: 50,
    reason: 'manual-axis-resource',
    note: '手动资源变化',
  });
}

function addEnemyEventAction() {
  clearSegmentSplitPreview();
  addInsertedAction({
    id: createNextActionId(),
    type: ACTION_TYPES.ENEMY_EVENT,
    skillId: selectedDraft.value.skillId,
    actorCharacterId: actionLibraryCharacterId.value,
    durationMs: 600,
    level: selectedDraft.value.level,
    eventType: 'phase',
    note: '敌人阶段标记',
  });
}

function copyAction(actionId) {
  clearSegmentSplitPreview();
  const shouldSyncRuntimeAfterCopy = shouldSyncRuntimeResultOnActionSelect();
  const sourceIndex = actionDrafts.value.findIndex(
    action => action.id === actionId
  );
  const sourceAction = actionDrafts.value[sourceIndex];
  if (!sourceAction) {
    return;
  }

  const nextAction = createWorkbenchActionDraft({
    ...sourceAction,
    id: createNextActionId(),
    startMs: clampNumber(
      sourceAction.startMs + 1000,
      0,
      project.value.time.durationMs
    ),
    note: stripAutoDelayNote(sourceAction.note),
    insertion: null,
    generationBatch: null,
  });
  actionDrafts.value = [
    ...actionDrafts.value.slice(0, sourceIndex + 1),
    nextAction,
    ...actionDrafts.value.slice(sourceIndex + 1),
  ];
  selectedActionId.value = nextAction.id;
  syncActionLibraryCharacterIdFromDraft(nextAction);
  if (shouldSyncRuntimeAfterCopy) {
    syncRuntimeResultForSelectedAction(nextAction.id);
  }
  markDraftDirty();
}

function deleteAction(actionId) {
  clearSegmentSplitPreview();
  if (actionDrafts.value.length <= 1) {
    return;
  }

  const index = actionDrafts.value.findIndex(action => action.id === actionId);
  if (index < 0) {
    return;
  }

  const shouldSyncRuntimeAfterDelete = shouldSyncRuntimeResultOnActionSelect();
  const selectedRuntimeActionId = getSelectedRuntimeStatePointActionId();
  const selectedWasRemoved = selectedActionId.value === actionId;
  const selectedRuntimeWasRemoved = selectedRuntimeActionId === actionId;
  actionDrafts.value = actionDrafts.value.filter(
    action => action.id !== actionId
  );

  if (selectedWasRemoved) {
    const nextIndex = Math.min(index, actionDrafts.value.length - 1);
    selectedActionId.value = actionDrafts.value[nextIndex].id;
    syncActionLibraryCharacterIdFromDraft(actionDrafts.value[nextIndex]);
  }
  if (
    shouldSyncRuntimeAfterDelete &&
    (selectedWasRemoved || selectedRuntimeWasRemoved)
  ) {
    syncRuntimeResultForSelectedAction(selectedActionId.value);
  }
  markDraftDirty();
}

function deleteActionBatch(batchId) {
  clearSegmentSplitPreview();
  if (!batchId) {
    return;
  }

  const batchActionIds = new Set(
    actionDrafts.value
      .filter(action => action.generationBatch?.batchId === batchId)
      .map(action => action.id)
  );
  if (
    batchActionIds.size === 0 ||
    batchActionIds.size >= actionDrafts.value.length
  ) {
    return;
  }

  const firstRemovedIndex = actionDrafts.value.findIndex(action =>
    batchActionIds.has(action.id)
  );
  const shouldSyncRuntimeAfterDelete = shouldSyncRuntimeResultOnActionSelect();
  const selectedRuntimeActionId = getSelectedRuntimeStatePointActionId();
  const selectedWasRemoved = batchActionIds.has(selectedActionId.value);
  const selectedRuntimeWasRemoved = batchActionIds.has(selectedRuntimeActionId);
  actionDrafts.value = actionDrafts.value.filter(
    action => !batchActionIds.has(action.id)
  );

  if (selectedWasRemoved) {
    const nextIndex = Math.min(
      Math.max(0, firstRemovedIndex),
      actionDrafts.value.length - 1
    );
    selectedActionId.value = actionDrafts.value[nextIndex].id;
    syncActionLibraryCharacterIdFromDraft(actionDrafts.value[nextIndex]);
  }
  if (
    shouldSyncRuntimeAfterDelete &&
    (selectedWasRemoved || selectedRuntimeWasRemoved)
  ) {
    syncRuntimeResultForSelectedAction(selectedActionId.value);
  }
  markDraftDirty();
}

function alignActionBatch({ batchId, startMs }) {
  const targetStartMs = Number(startMs);
  if (!batchId || !Number.isFinite(targetStartMs)) {
    return;
  }

  const batchActions = actionDrafts.value.filter(
    action => action.generationBatch?.batchId === batchId
  );
  if (batchActions.length === 0) {
    return;
  }

  const minStartMs = Math.min(
    ...batchActions.map(action => Math.max(0, Number(action.startMs) || 0))
  );
  shiftActionBatch({
    batchId,
    offsetMs: targetStartMs - minStartMs,
  });
}

function shiftActionBatch({ batchId, offsetMs }) {
  clearSegmentSplitPreview();
  const offset = Number(offsetMs);
  if (!batchId || !Number.isFinite(offset) || offset === 0) {
    return;
  }

  const batchActions = actionDrafts.value.filter(
    action => action.generationBatch?.batchId === batchId
  );
  if (batchActions.length === 0) {
    return;
  }

  const minStartMs = Math.min(
    ...batchActions.map(action => Math.max(0, Number(action.startMs) || 0))
  );
  const maxStartMs = Math.max(
    ...batchActions.map(action => Math.max(0, Number(action.startMs) || 0))
  );
  const shouldSyncRuntimeAfterBatchShift =
    shouldSyncRuntimeResultOnActionSelect();
  const selectedRuntimeActionId = getSelectedRuntimeStatePointActionId();
  const selectedActionInBatch = batchActions.some(
    action => action.id === selectedActionId.value
  );
  const selectedRuntimeActionInBatch = batchActions.some(
    action => action.id === selectedRuntimeActionId
  );
  const appliedOffsetMs = clampNumber(
    offset,
    -minStartMs,
    project.value.time.durationMs - maxStartMs
  );
  if (appliedOffsetMs === 0) {
    return;
  }

  actionDrafts.value = actionDrafts.value.map(action => {
    if (action.generationBatch?.batchId !== batchId) {
      return action;
    }

    const nextStartMs = clampNumber(
      (Number(action.startMs) || 0) + appliedOffsetMs,
      0,
      project.value.time.durationMs
    );
    return createWorkbenchActionDraft({
      ...action,
      ...clearInsertionForManualEdit(action),
      startMs: nextStartMs,
    });
  });
  if (
    shouldSyncRuntimeAfterBatchShift &&
    (selectedActionInBatch || selectedRuntimeActionInBatch)
  ) {
    syncRuntimeResultForSelectedAction(
      selectedRuntimeActionInBatch
        ? selectedRuntimeActionId
        : selectedActionId.value
    );
  }
  markDraftDirty();
}

function saveDraft() {
  const snapshot = saveWorkbenchDraft(getLocalStorage(), {
    selection: selection.value,
    enemyConfig: enemyConfig.value,
    segmentSplitOptions: segmentSplitOptions.value,
    actionDrafts: actionDrafts.value,
    selectedActionId: selectedActionId.value,
  });
  draftStatus.value = snapshot ? '已保存草稿' : '草稿不可用';
}

function resetDraft() {
  clearWorkbenchDraft(getLocalStorage());
  applyDraftState(createDefaultWorkbenchDraftState());
  clearSegmentSplitPreview();
  draftStatus.value = '已重置草稿';
}

function applyDraftState(draft) {
  selection.value = { ...draft.selection };
  enemyConfig.value = normalizeWorkbenchEnemyConfig(draft.enemyConfig);
  segmentSplitOptions.value = normalizeWorkbenchSegmentSplitOptions(
    draft.segmentSplitOptions
  );
  actionDrafts.value = normalizeWorkbenchActionDrafts(
    draft.actionDrafts,
    selection.value
  );
  selectedActionId.value = draft.selectedActionId;
  syncActionLibraryCharacterIdFromDraft(
    actionDrafts.value.find(action => action.id === draft.selectedActionId)
  );
  clearActionEditSource();
  clearActionEditFocus();
}

function markDraftDirty() {
  draftStatus.value = '有未保存改动';
}

function createEmptyActionEditSource(sequence = 0) {
  return {
    actionId: '',
    fieldKey: '',
    label: '',
    previousValue: '',
    nextValue: '',
    changeSummary: '',
    editOrigin: '',
    focusSource: '',
    originLabel: '',
    originStatePointId: '',
    originTrackKey: '',
    originFrameLabel: '',
    sequence,
  };
}

function createEmptyActionEditFocus(sequence = 0) {
  return {
    actionId: '',
    fieldKey: '',
    label: '',
    previousValue: '',
    nextValue: '',
    changeSummary: '',
    editOrigin: '',
    focusSource: '',
    originStatePointId: '',
    originTrackKey: '',
    originFrameLabel: '',
    sequence,
  };
}

function createEmptyWorkbenchFlowDispatchState(sequence = 0) {
  return {
    sequence,
    handled: false,
    kind: '',
    source: '',
    handlerKey: '',
    reason: '',
    actionId: '',
    statePointId: '',
  };
}

function createWorkbenchFlowDispatchState({ result, previousState } = {}) {
  const action = result?.action ?? {};
  return {
    sequence: (previousState?.sequence ?? 0) + 1,
    handled: Boolean(result?.handled),
    kind: result?.kind ?? action.kind ?? '',
    source: result?.source ?? action.source ?? '',
    handlerKey: result?.handlerKey ?? '',
    reason: result?.reason ?? '',
    actionId: action.actionId ?? '',
    statePointId: action.statePointId ?? '',
  };
}

function clearActionEditSource() {
  actionEditSource.value = createEmptyActionEditSource(
    actionEditSource.value.sequence + 1
  );
}

function clearActionEditFocus() {
  actionEditFocus.value = createEmptyActionEditFocus(
    actionEditFocus.value.sequence + 1
  );
}

function recordActionEditSource(
  actionId,
  patch = {},
  { previousAction = null, nextAction = null } = {}
) {
  const fieldKey = resolveActionEditSourceField(patch);
  if (!actionId || !fieldKey) {
    return;
  }
  const change = createActionEditSourceChange({
    fieldKey,
    previousAction,
    nextAction,
  });

  actionEditSource.value = {
    actionId,
    fieldKey,
    label: ACTION_EDIT_SOURCE_LABELS[fieldKey] ?? `${fieldKey}变更`,
    ...change,
    ...createActionEditOrigin(actionId),
    sequence: actionEditSource.value.sequence + 1,
  };
}

function createActionEditOrigin(actionId) {
  const focus = actionEditFocus.value;
  if (
    !actionId ||
    !focus?.actionId ||
    focus.actionId !== actionId ||
    focus.editOrigin !== 'runtime-focus'
  ) {
    return {
      editOrigin: '',
      focusSource: '',
      originLabel: '',
      originStatePointId: '',
      originTrackKey: '',
      originFrameLabel: '',
    };
  }
  return {
    editOrigin: focus.editOrigin,
    focusSource: focus.focusSource ?? '',
    originLabel: '来自结果定位',
    originStatePointId: focus.originStatePointId ?? '',
    originTrackKey: focus.originTrackKey ?? '',
    originFrameLabel: focus.originFrameLabel ?? '',
  };
}

function createActionEditResultContext({
  source = {},
  runtimeProjection = null,
} = {}) {
  if (!source?.actionId) {
    return null;
  }
  const resultPoint = findFirstRuntimeStatePointForAction(
    runtimeProjection,
    source.actionId,
    {
      preferredTrackKey: source.originTrackKey ?? '',
    }
  );
  if (!resultPoint?.statePointId) {
    return null;
  }
  return {
    status: 'refreshed-edit-result',
    actionId: source.actionId,
    fieldKey: source.fieldKey ?? '',
    label: source.label ?? '',
    changeSummary: source.changeSummary ?? '',
    originStatePointId: source.originStatePointId ?? '',
    focusSource: source.focusSource ?? '',
    originTrackKey: source.originTrackKey ?? '',
    originFrameLabel: source.originFrameLabel ?? '',
    runtimeStatePointId: resultPoint.statePointId,
    runtimeTrackKey:
      resultPoint.row?.trackKey ?? resultPoint.point?.trackKey ?? '',
  };
}

function resolveActionEditSourceField(patch = {}) {
  return ACTION_EDIT_SOURCE_PRIORITY.find(fieldKey =>
    Object.prototype.hasOwnProperty.call(patch, fieldKey)
  );
}

function createActionEditSourceChange({
  fieldKey,
  previousAction = null,
  nextAction = null,
}) {
  const previousValue = formatActionEditSourceValue(
    fieldKey,
    getActionEditSourceRawValue(previousAction, fieldKey)
  );
  const nextValue = formatActionEditSourceValue(
    fieldKey,
    getActionEditSourceRawValue(nextAction, fieldKey)
  );
  return {
    previousValue,
    nextValue,
    changeSummary: formatActionEditSourceChangeSummary(
      previousValue,
      nextValue
    ),
  };
}

function getActionEditSourceRawValue(action, fieldKey) {
  if (!action) {
    return null;
  }
  if (fieldKey === 'laneId') {
    return action.actorCharacterId;
  }
  if (fieldKey === 'damageSegmentIndex') {
    return action.actionVariantIndex ?? action.damageSegmentIndex;
  }
  return action[fieldKey];
}

function formatActionEditSourceValue(fieldKey, value) {
  if (value == null || value === '') {
    return '空';
  }
  if (fieldKey === 'startMs' || fieldKey === 'durationMs') {
    return formatFrameTime(value);
  }
  if (fieldKey === 'skillId') {
    return findSkillById(value)?.name ?? String(value);
  }
  if (
    fieldKey === 'actorCharacterId' ||
    fieldKey === 'laneId' ||
    fieldKey === 'targetCharacterId'
  ) {
    return resolveActionEditCharacterName(value);
  }
  if (fieldKey === 'change') {
    return formatSignedNumber(value);
  }
  return String(value);
}

function formatActionEditSourceChangeSummary(previousValue, nextValue) {
  if (!previousValue && !nextValue) {
    return '';
  }
  if (previousValue === nextValue) {
    return previousValue;
  }
  return `${previousValue || '空'} -> ${nextValue || '空'}`;
}

function formatSignedNumber(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? '+' : ''}${number}`;
}

function resolveActionEditCharacterName(characterId) {
  return (
    scenario.value.actors.find(
      actor => Number(actor.characterId) === Number(characterId)
    )?.name ??
    workbenchSeed.gameData.characters.find(
      character => Number(character.id) === Number(characterId)
    )?.name ??
    String(characterId)
  );
}

function findActionDraftById(actionId) {
  return actionDrafts.value.find(action => action.id === actionId) ?? null;
}

function selectAction(actionId, { syncRuntimeResult = true } = {}) {
  clearSegmentSplitPreview();
  selectedActionId.value = actionId;
  const draft = actionDrafts.value.find(action => action.id === actionId);
  syncActionLibraryCharacterIdFromDraft(draft);
  if (syncRuntimeResult && shouldSyncRuntimeResultOnActionSelect()) {
    syncRuntimeResultForSelectedAction(actionId);
  }
}

function selectStateCurvePoint(pointId) {
  const statePointId = pointId || '';
  if (!statePointId) {
    selectedStateCurvePointId.value = '';
    stateCurveFocusMode.value = 'all';
    return;
  }
  if (isRuntimeStatePointId(statePointId)) {
    focusRuntimeStateCurvePoint(statePointId);
    return;
  }
  selectedStateCurvePointId.value = statePointId;
}

function isRuntimeStatePointId(pointId) {
  return Boolean(
    findRuntimeStatePointContextById(
      simulationResult.value.threeValueRuntimeProjection,
      pointId
    )
  );
}

function focusRuntimeStateCurvePoint(pointId) {
  dispatchWorkbenchFlowAction(
    mainFlowCommandSurface.value.createRuntimeStatePointFlowAction({
      source: 'state-curve-point',
      statePointId: pointId,
      payload: {
        preserveStateCurveFilters: true,
      },
    })
  );
}

function selectRuntimeStatePoint(pointId) {
  applyRuntimePointSelectionState(
    createWorkbenchFlowRuntimePointSelectionState({
      statePointId: pointId,
    })
  );
}

function applyRuntimePointSelectionState(selectionState = {}) {
  selectedStateCurvePointId.value = selectionState.selectedStatePointId ?? '';
  stateCurveFocusMode.value = selectionState.stateCurveFocusMode || 'all';
  if (selectionState.shouldSelectRuntimeAction) {
    selectActionFromRuntimeStatePoint(selectionState.statePointId);
  }
  runtimeLogFocus.value = {
    source: selectionState.runtimeLogFocus?.source ?? '',
    statePointId: selectionState.runtimeLogFocus?.statePointId ?? '',
    sequence: runtimeLogFocus.value.sequence,
  };
}

function selectRuntimeFlowStatePoint(pointId) {
  selectRuntimeStatePoint(pointId);
}

function dispatchWorkbenchFlowAction(action = {}) {
  const result = workbenchFlowController.dispatch(action);
  workbenchFlowDispatchState.value = createWorkbenchFlowDispatchState({
    result,
    previousState: workbenchFlowDispatchState.value,
  });
  return result;
}

function dispatchRuntimeReviewPrimaryOperation() {
  dispatchWorkbenchFlowAction(runtimeReviewPrimaryOperationCommand.value.action);
}

function updateStateCurveFocusMode(mode) {
  if (mode === 'selected' && !selectedStateCurvePointId.value) {
    return;
  }
  stateCurveFocusMode.value = mode === 'selected' ? 'selected' : 'all';
}

function updateStateCurveLayerFilter({ layerKey, visible }) {
  if (!layerKey) {
    return;
  }
  stateCurveLayerFilters.value = {
    ...stateCurveLayerFilters.value,
    [layerKey]: Boolean(visible),
  };
}

function updateStateCurveTrackFilter({ trackKey, visible }) {
  if (!trackKey) {
    return;
  }
  stateCurveTrackFilters.value = {
    ...stateCurveTrackFilters.value,
    [trackKey]: Boolean(visible),
  };
}

function focusThreeValueCalculatorScope(
  scope,
  { selectFirstRuntimePoint = true } = {}
) {
  const firstRuntimeStatePointId = selectFirstRuntimePoint
    ? getFirstRuntimeStatePointId(
        simulationResult.value.threeValueRuntimeProjection
      )
    : '';
  applyCalculatorScopeFlowState(
    createWorkbenchFlowRuntimeScopeState({
      scope,
      firstRuntimeStatePointId,
    })
  );
}

function applyCalculatorScopeFlowState(scopeState = {}) {
  calculatorDiagnosticScope.value = scopeState.calculatorScope ?? 'generation';
  calculatorDiagnosticFocus.value = {
    scope: calculatorDiagnosticScope.value,
    sequence: calculatorDiagnosticFocus.value.sequence + 1,
  };
  runtimeLogFocus.value = {
    source: scopeState.runtimeLogFocus?.source ?? '',
    statePointId: scopeState.runtimeLogFocus?.statePointId ?? '',
    sequence: runtimeLogFocus.value.sequence,
  };
  stateCurveLayerFilters.value = { ...scopeState.stateCurveLayerFilters };
  stateCurveTrackFilters.value = { ...scopeState.stateCurveTrackFilters };

  if (scopeState.selectRuntimeStatePoint) {
    selectRuntimeStatePoint(scopeState.statePointId);
    return;
  }
  if (scopeState.clearRuntimeSelection) {
    selectedStateCurvePointId.value = '';
    stateCurveFocusMode.value = scopeState.stateCurveFocusMode || 'all';
  }
}

function getFirstRuntimeStatePointId(runtimeProjection) {
  return (
    createRuntimeStatePointContexts(runtimeProjection)[0]?.statePointId ?? ''
  );
}

function selectActionFromRuntimeStatePoint(pointId) {
  const context = findRuntimeStatePointContextById(
    simulationResult.value.threeValueRuntimeProjection,
    pointId
  );
  const actionId = context?.row?.actionId;
  if (!actionId || !findActionDraftById(actionId)) {
    return;
  }
  selectAction(actionId, { syncRuntimeResult: false });
}

function shouldSyncRuntimeResultOnActionSelect() {
  if (runtimeOverviewActive.value) {
    return true;
  }
  return Boolean(
    findRuntimeStatePointContextById(
      simulationResult.value.threeValueRuntimeProjection,
      selectedStateCurvePointId.value
    )
  );
}

function getSelectedRuntimeStatePointActionId() {
  return (
    findRuntimeStatePointContextById(
      simulationResult.value.threeValueRuntimeProjection,
      selectedStateCurvePointId.value
    )?.row?.actionId ?? ''
  );
}

function syncRuntimeResultForSelectedAction(actionId) {
  workbenchFlowRuntime.applyRuntimeFlowPlan(
    workbenchFlowPlanController.createRuntimeEntryPlan({
      actionId,
    })
  );
}

function findRuntimeStatePointContextById(runtimeProjection, statePointId) {
  if (!statePointId) {
    return null;
  }
  return (
    createRuntimeStatePointContexts(runtimeProjection).find(
      context => context.statePointId === statePointId
    ) ?? null
  );
}

function findSkillById(skillId) {
  return (
    workbenchSeed.gameData.skills.find(skill => skill.id === Number(skillId)) ??
    null
  );
}

function createSegmentGenerationBatch(preview) {
  return {
    batchId: createNextSegmentBatchId(),
    source: 'skill-action-variant-split',
    skillId: preview.skillId,
    actorCharacterId: preview.actorCharacterId,
    level: preview.level,
    variantCount: preview.generatedCount,
    segmentCount: preview.generatedCount,
    createdAt: new Date().toISOString(),
  };
}

function createNextSegmentBatchId() {
  const maxIndex = actionDrafts.value.reduce((max, action) => {
    const match = String(action.generationBatch?.batchId ?? '').match(
      /^segment-batch-(\d+)$/
    );
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `segment-batch-${String(maxIndex + 1).padStart(4, '0')}`;
}

function createNextActionId() {
  const maxIndex = actionDrafts.value.reduce((max, action) => {
    const match = String(action.id).match(/^action-(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `action-${String(maxIndex + 1).padStart(4, '0')}`;
}

function addInsertedAction(actionPatch, options = {}) {
  const shouldSyncRuntimeAfterInsert = shouldSyncRuntimeResultOnActionSelect();
  const baseInsertIndex = resolveInsertIndex();
  const candidateAction = createWorkbenchActionDraft({
    ...actionPatch,
    startMs: options.requestedStartMs ?? resolveInsertStartMs(baseInsertIndex),
  });
  const placement = resolveInsertPlacement(candidateAction, baseInsertIndex);
  const nextAction = createWorkbenchActionDraft({
    ...candidateAction,
    startMs: placement.startMs,
    note: createInsertionNote(candidateAction.note, placement),
    insertion: createInsertionMetadata(placement),
  });
  actionDrafts.value = [
    ...actionDrafts.value.slice(0, placement.insertIndex),
    nextAction,
    ...actionDrafts.value.slice(placement.insertIndex),
  ];
  selectedActionId.value = nextAction.id;
  if (shouldSyncRuntimeAfterInsert) {
    syncRuntimeResultForSelectedAction(nextAction.id);
  }
  markDraftDirty();
  return {
    action: nextAction,
    placement,
  };
}

function createSkillSegmentSplitPreview(skillId) {
  const actorCharacterId = Number(
    actionLibraryActor.value?.characterId ??
      selectedDraft.value.actorCharacterId
  );
  const actor =
    scenario.value.actors.find(
      item => Number(item.characterId) === actorCharacterId
    ) ?? null;
  const skill = resolveContextSkill(actorCharacterId, skillId);
  const level = resolveSkillInsertLevel(actorCharacterId, skill);
  const options = normalizeWorkbenchSegmentSplitOptions(
    segmentSplitOptions.value
  );
  const allSegments = getSkillActionVariants(skill, level);
  const includedSegments = allSegments.filter(segment => {
    if (!options.skipExistingSegments) {
      return true;
    }
    return !hasExistingSkillSegmentAction({
      actorCharacterId,
      skillId: skill.id,
      level,
      actionVariantIndex: segment.index,
      damageSegmentIndex: segment.index,
    });
  });
  const skippedCount = allSegments.length - includedSegments.length;
  const baseStartMs = resolveSegmentSplitBaseStartMs(options);
  const simulation = simulateSegmentSplitPlacements({
    actorCharacterId,
    skill,
    level,
    segments: includedSegments,
    options,
    baseStartMs,
  });

  return {
    skillId: skill.id,
    skillName: skill.name,
    actorCharacterId,
    actorName: actor?.name ?? '角色',
    level,
    options,
    totalSegmentCount: allSegments.length,
    skippedCount,
    generatedCount: simulation.actions.length,
    autoDelayedCount: simulation.actions.filter(item => item.autoDelayed)
      .length,
    baseStartMs,
    actions: simulation.actions,
  };
}

function simulateSegmentSplitPlacements({
  actorCharacterId,
  skill,
  level,
  segments,
  options,
  baseStartMs,
}) {
  let simulatedDrafts = [...actionDrafts.value];
  let insertIndex = resolveInsertIndex();
  let previousResolvedStartMs = null;
  const actions = [];

  segments.forEach((segment, index) => {
    const requestedStartMs =
      previousResolvedStartMs == null
        ? baseStartMs
        : Math.max(
            baseStartMs + index * options.intervalMs,
            previousResolvedStartMs + options.intervalMs
          );
    const candidateAction = createWorkbenchActionDraft({
      id: `preview-segment-${segment.index}`,
      skillId: skill.id,
      actorCharacterId,
      level,
      actionVariantIndex: segment.index,
      damageSegmentIndex: segment.index,
      startMs: requestedStartMs,
      note: `动作形态拆分：${formatActionVariantPreview(segment)}；非真实命中帧。`,
    });
    const placement = resolveInsertPlacement(
      candidateAction,
      insertIndex,
      simulatedDrafts
    );
    const simulatedAction = createWorkbenchActionDraft({
      ...candidateAction,
      startMs: placement.startMs,
      note: createInsertionNote(candidateAction.note, placement),
      insertion: createInsertionMetadata(placement),
    });

    simulatedDrafts = [
      ...simulatedDrafts.slice(0, placement.insertIndex),
      simulatedAction,
      ...simulatedDrafts.slice(placement.insertIndex),
    ];
    insertIndex = placement.insertIndex + 1;
    previousResolvedStartMs = placement.startMs;
    actions.push({
      actionVariantIndex: segment.index,
      damageSegmentIndex: segment.index,
      label: segment.label,
      displayLabel: segment.displayLabel,
      rawValue: segment.rawValue,
      hitModel: segment.hitModel,
      requestedStartMs: placement.requestedStartMs,
      resolvedStartMs: placement.startMs,
      autoDelayed: placement.autoDelayed,
      delayedByMs: placement.startMs - placement.requestedStartMs,
    });
  });

  return {
    actions,
  };
}

function formatActionVariantPreview(variant) {
  const hitCount = Number(variant.hitModel?.hitCount) || 1;
  const hitSuffix =
    hitCount > 1 ? `；普攻 ${hitCount} 段总倍率，单段倍率待补` : '';
  return `${variant.displayLabel ?? variant.label} / ${variant.rawValue}${hitSuffix}`;
}

function resolveSegmentSplitBaseStartMs(options) {
  if (!options.startAfterSelectedAction) {
    return resolveInsertStartMs(resolveInsertIndex());
  }

  const action = selectedDraft.value;
  const startMs = Math.max(0, Number(action?.startMs) || 0);
  const durationMs = resolveDraftDurationMs(action ?? {});
  return clampNumber(startMs + durationMs, 0, project.value.time.durationMs);
}

function hasExistingSkillSegmentAction({
  actorCharacterId,
  skillId,
  level,
  actionVariantIndex,
  damageSegmentIndex,
}) {
  const selectedIndex = actionVariantIndex ?? damageSegmentIndex;
  return actionDrafts.value.some(
    action =>
      action.type === ACTION_TYPES.SKILL &&
      Number(action.actorCharacterId) === Number(actorCharacterId) &&
      Number(action.skillId) === Number(skillId) &&
      Number(action.level) === Number(level) &&
      Number(action.actionVariantIndex ?? action.damageSegmentIndex) ===
        Number(selectedIndex)
  );
}

function resolveInsertPlacement(
  candidateAction,
  baseInsertIndex,
  draftSource = actionDrafts.value
) {
  const laneId = resolveDraftLaneId(candidateAction);
  const durationMs = resolveDraftDurationMs(candidateAction);
  const maxStartMs = project.value.time.durationMs;
  const requestedStartMs = clampNumber(candidateAction.startMs, 0, maxStartMs);
  let startMs = requestedStartMs;
  let insertIndex = baseInsertIndex;
  const conflictActionIds = new Set();
  const ranges = draftSource
    .map((action, index) => createDraftTimelineRange(action, index))
    .filter(range => range.laneId === laneId)
    .sort(compareDraftTimelineRanges);

  for (let scanIndex = 0; scanIndex < ranges.length; scanIndex += 1) {
    const range = ranges[scanIndex];
    const endMs = startMs + durationMs;

    if (endMs <= range.startMs || startMs >= range.endMs) {
      continue;
    }

    const nextStartMs = clampNumber(
      range.endMs + NEW_ACTION_INSERT_GAP_MS,
      0,
      maxStartMs
    );
    insertIndex = Math.max(insertIndex, range.index + 1);
    conflictActionIds.add(range.actionId);
    if (nextStartMs <= startMs) {
      startMs = nextStartMs;
      break;
    }

    startMs = nextStartMs;
    scanIndex = -1;
  }

  return {
    autoDelayed: startMs > requestedStartMs,
    conflictActionIds: [...conflictActionIds],
    insertIndex,
    laneId,
    requestedStartMs,
    startMs,
  };
}

function resolveInsertStartMs(insertIndex) {
  const anchor =
    actionDrafts.value[Math.max(0, insertIndex - 1)] ??
    actionDrafts.value[actionDrafts.value.length - 1];
  if (!anchor) {
    return 0;
  }
  const anchorStartMs = Number(anchor.startMs) || 0;
  const anchorDurationMs = Math.max(0, Number(anchor.durationMs) || 0);
  return clampNumber(
    anchorStartMs + anchorDurationMs + NEW_ACTION_INSERT_GAP_MS,
    0,
    project.value.time.durationMs
  );
}

function resolveInsertIndex() {
  const selectedIndex = actionDrafts.value.findIndex(
    action => action.id === selectedActionId.value
  );
  return selectedIndex >= 0 ? selectedIndex + 1 : actionDrafts.value.length;
}

function createDraftTimelineRange(action, index) {
  const startMs = Math.max(0, Number(action.startMs) || 0);
  const durationMs = resolveDraftDurationMs(action);
  return {
    actionId: action.id,
    index,
    laneId: resolveDraftLaneId(action),
    startMs,
    endMs: startMs + durationMs,
  };
}

function resolveDraftLaneId(action) {
  if (canAssignActionLane(action)) {
    const actor = scenario.value.actors.find(
      item => Number(item.characterId) === Number(action.actorCharacterId)
    );
    return actor?.id ?? SYSTEM_TIMELINE_LANE_ID;
  }
  return SYSTEM_TIMELINE_LANE_ID;
}

function resolveDraftDurationMs(action) {
  return Math.max(1, Number(action.durationMs) || 1000);
}

function compareDraftTimelineRanges(left, right) {
  return (
    left.startMs - right.startMs ||
    left.endMs - right.endMs ||
    left.index - right.index
  );
}

function createInsertionMetadata(placement) {
  if (!placement.autoDelayed) {
    return null;
  }

  return {
    autoDelayed: true,
    requestedStartMs: placement.requestedStartMs,
    resolvedStartMs: placement.startMs,
    delayedByMs: placement.startMs - placement.requestedStartMs,
    laneId: placement.laneId,
    reason: 'same-lane-conflict',
    conflictActionIds: placement.conflictActionIds,
  };
}

function createInsertionNote(note, placement) {
  if (!placement.autoDelayed) {
    return note;
  }

  const message = `自动推迟：同轨已有动作占用，已从 ${placement.requestedStartMs}ms 调整到 ${placement.startMs}ms。`;
  return note ? `${note}\n${message}` : message;
}

function applyInsertionLifecyclePatch(action, patch) {
  const nextPatch = { ...patch };
  if (typeof nextPatch.note === 'string') {
    nextPatch.note = stripAutoDelayNote(nextPatch.note);
  }

  if (!shouldClearInsertionForPatch(action, nextPatch)) {
    return nextPatch;
  }

  nextPatch.insertion = null;
  if (nextPatch.note == null) {
    nextPatch.note = stripAutoDelayNote(action.note);
  }
  return nextPatch;
}

function shouldClearInsertionForPatch(action, patch) {
  if (!action.insertion?.autoDelayed) {
    return false;
  }
  return (
    patch.startMs != null ||
    patch.durationMs != null ||
    patch.actorCharacterId != null
  );
}

function clearInsertionForManualEdit(action) {
  if (!action.insertion?.autoDelayed) {
    return {};
  }
  return {
    insertion: null,
    note: stripAutoDelayNote(action.note),
  };
}

function stripAutoDelayNote(note) {
  if (!note) {
    return '';
  }

  return String(note)
    .split(/\r?\n/)
    .filter(line => !AUTO_DELAY_NOTE_PATTERN.test(line.trim()))
    .join('\n')
    .trimEnd();
}

function createInsertionDiagnostics(actions) {
  const autoDelayedItems = actions
    .filter(action => action.insertion?.autoDelayed)
    .map(action => ({
      id: action.id,
      actionId: action.id,
      actionName: action.name,
      laneName:
        action.actor?.name ?? (action.actorId ? action.actorId : '系统'),
      requestedStartMs: action.insertion.requestedStartMs,
      resolvedStartMs: action.insertion.resolvedStartMs,
      delayedByMs: action.insertion.delayedByMs,
      conflictActionIds: action.insertion.conflictActionIds ?? [],
    }));

  return {
    autoDelayedCount: autoDelayedItems.length,
    autoDelayedItems,
  };
}

function canAssignActionLane(action) {
  return [
    ACTION_TYPES.SKILL,
    ACTION_TYPES.SWITCH,
    ACTION_TYPES.RESOURCE,
  ].includes(action.type);
}

function setActionLibraryCharacterId(characterId) {
  clearSegmentSplitPreview();
  const actor = scenario.value.actors.find(
    item => Number(item.characterId) === Number(characterId)
  );
  if (!actor) {
    return;
  }
  actionLibraryCharacterId.value = Number(actor.characterId);
}

function normalizeActionLibraryCharacterId(
  previousSelection,
  nextSelection,
  changes
) {
  if (
    changes.characterChanged &&
    Number(actionLibraryCharacterId.value) ===
      Number(previousSelection.characterId)
  ) {
    actionLibraryCharacterId.value = nextSelection.characterId;
  }
  if (
    changes.secondaryCharacterChanged &&
    Number(actionLibraryCharacterId.value) ===
      Number(previousSelection.secondaryCharacterId)
  ) {
    actionLibraryCharacterId.value = nextSelection.secondaryCharacterId;
  }

  if (
    Number(actionLibraryCharacterId.value) !==
      Number(nextSelection.characterId) &&
    Number(actionLibraryCharacterId.value) !==
      Number(nextSelection.secondaryCharacterId)
  ) {
    actionLibraryCharacterId.value = nextSelection.characterId;
  }
}

function syncActionLibraryCharacterIdFromDraft(draft) {
  if (!draft || !canAssignActionLane(draft)) {
    return;
  }
  setActionLibraryCharacterId(draft.actorCharacterId);
}

function resolveContextSkill(actorCharacterId, preferredSkillId) {
  const preferredSkill = findSkillById(preferredSkillId);
  if (Number(preferredSkill?.characterId) === Number(actorCharacterId)) {
    return preferredSkill;
  }
  return (
    findFirstSkillForCharacter(actorCharacterId) ??
    preferredSkill ??
    workbenchSeed.gameData.skills[0]
  );
}

function normalizeActionEntryInput(input, actorCharacterId) {
  if (input && typeof input === 'object') {
    return {
      ...input,
      skillId: input.skillId,
      actionVariantIndex:
        input.actionVariantIndex ?? input.damageSegmentIndex ?? 0,
      durationMs: input.durationMs ?? frameToMs(60),
    };
  }

  const skillId = Number(input);
  const actionEntry = getSkillActionCatalog(
    getSkillsForCharacter(actorCharacterId),
    1
  ).find(entry => Number(entry.skillId) === skillId);

  return (
    actionEntry ?? {
      skillId,
      actionVariantIndex: 0,
      durationMs: frameToMs(60),
      label: '动作',
      rawValue: null,
    }
  );
}

function resolveSkillInsertLevel(actorCharacterId, skill) {
  const shouldInheritLevel =
    Number(selectedDraft.value.actorCharacterId) === actorCharacterId &&
    Number(selectedDraft.value.skillId) === Number(skill.id);
  return shouldInheritLevel ? selectedDraft.value.level : 1;
}

function normalizeActionPatch(action, patch) {
  const normalizedPatch = { ...patch };
  if (
    normalizedPatch.actionVariantIndex != null ||
    normalizedPatch.damageSegmentIndex != null
  ) {
    const actionVariantIndex = Number(
      normalizedPatch.actionVariantIndex ?? normalizedPatch.damageSegmentIndex
    );
    normalizedPatch.actionVariantIndex = actionVariantIndex;
    normalizedPatch.damageSegmentIndex = actionVariantIndex;
  }
  if (normalizedPatch.actorCharacterId != null) {
    normalizedPatch.actorCharacterId = Number(normalizedPatch.actorCharacterId);

    if (
      action.type === ACTION_TYPES.SWITCH &&
      Number(action.targetCharacterId) === normalizedPatch.actorCharacterId
    ) {
      normalizedPatch.targetCharacterId = resolveAlternateActorCharacterId(
        normalizedPatch.actorCharacterId
      );
    }
  }
  return normalizedPatch;
}

function resolveSkillForActionPatch(action, patch, actorCharacterId) {
  const requestedSkill =
    findSkillById(patch.skillId ?? action.skillId) ??
    findSkillById(action.skillId);
  if (
    patch.actorCharacterId != null &&
    Number(requestedSkill?.characterId) !== Number(actorCharacterId)
  ) {
    return findFirstSkillForCharacter(actorCharacterId) ?? requestedSkill;
  }
  return requestedSkill ?? findFirstSkillForCharacter(actorCharacterId);
}

function findFirstSkillForCharacter(characterId) {
  return getSkillsForCharacter(characterId)[0] ?? null;
}

function resolveAlternateActorCharacterId(sourceCharacterId) {
  return (
    scenario.value.actors.find(
      actor => Number(actor.characterId) !== Number(sourceCharacterId)
    )?.characterId ?? selection.value.characterId
  );
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return min;
  }
  return Math.min(max, Math.max(min, number));
}

function getLocalStorage() {
  return typeof window === 'undefined' ? null : window.localStorage;
}
</script>

<style scoped>
.workbench {
  min-height: 100vh;
  background: #11161b;
  color: #ffffff;
}

.top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-height: 48px;
  padding: 0 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: #101419;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #d9dee3;
  font-weight: 700;
}

.back-link:hover {
  color: #79c7b9;
}

.nav-icon {
  width: 16px;
  height: 16px;
}

.nav-status {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.nav-status span {
  padding: 3px 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  color: #b8c0c7;
  font-size: 12px;
}

.nav-side {
  display: grid;
  justify-items: end;
  gap: 8px;
}

.nav-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.draft-status {
  color: #8f9aa3;
  font-size: 12px;
}

.nav-button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 9px;
  border: 1px solid rgba(121, 199, 185, 0.38);
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.12);
  color: #dff6f1;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.nav-button.secondary {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: #d9dee3;
}

.nav-button:hover {
  filter: brightness(1.16);
}

.button-icon {
  width: 14px;
  height: 14px;
}

.workbench-grid {
  display: grid;
  grid-template-columns: minmax(230px, 280px) minmax(0, 1fr) minmax(
      260px,
      340px
    );
  grid-template-areas: 'actions mainflow inspector';
  gap: 14px;
  padding: 14px;
}

.action-library {
  grid-area: actions;
}

.primary-flow {
  display: grid;
  grid-area: mainflow;
  align-content: start;
  gap: 14px;
  min-width: 0;
}

.runtime-review-stack {
  display: grid;
  grid-template-columns: minmax(280px, 0.92fr) minmax(320px, 1.08fr);
  align-items: start;
  gap: 14px;
  min-width: 0;
}

.runtime-review-primary-bar {
  display: flex;
  grid-column: 1 / -1;
  justify-content: flex-end;
  min-width: 0;
}

.runtime-review-primary-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid rgba(121, 199, 185, 0.42);
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.14);
  color: #d7fff8;
  font-size: 13px;
  font-weight: 800;
}

.runtime-review-primary-action:disabled {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: #7f8991;
  cursor: not-allowed;
}

.runtime-review-primary-action-icon {
  width: 15px;
  height: 15px;
}

.timeline-area,
.resource-area,
.event-area {
  min-width: 0;
}

.side-stack {
  grid-area: inspector;
  display: grid;
  align-content: start;
  gap: 14px;
}

@media (max-width: 1320px) {
  .runtime-review-stack {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1100px) {
  .workbench-grid {
    grid-template-columns: minmax(220px, 300px) minmax(0, 1fr);
    grid-template-areas:
      'actions mainflow'
      'actions inspector';
  }
}

@media (max-width: 760px) {
  .top-nav {
    align-items: flex-start;
    flex-direction: column;
    padding: 12px 16px;
  }

  .nav-status {
    justify-content: flex-start;
  }

  .nav-side {
    justify-items: start;
  }

  .nav-actions {
    justify-content: flex-start;
  }

  .workbench-grid {
    grid-template-columns: 1fr;
    grid-template-areas:
      'actions'
      'mainflow'
      'inspector';
    padding: 10px;
  }
}
</style>
