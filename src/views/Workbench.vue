<template>
  <main
    ref="workbenchRoot"
    class="workbench"
    :data-runtime-diagnostics-status="runtimeDiagnosticsStatus"
    :data-runtime-diagnostics-revision="runtimeDiagnosticsRevision"
    :data-selected-action-count="selectedActionIds.length"
    :data-action-relation-count="actionRelations.length"
    :data-selected-action-relation-id="selectedActionRelationId"
  >
    <nav class="top-nav">
      <div class="workbench-brand" aria-label="蓝色星原排轴工作台">
        <Aim class="nav-icon" />
        <span>蓝色星原排轴</span>
      </div>
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
            class="nav-button secondary"
            :data-history-count="workbenchHistoryView.undoCount"
            data-testid="workbench-undo-edit"
            type="button"
            aria-keyshortcuts="Control+Z Meta+Z"
            :disabled="!workbenchHistoryView.canUndo"
            title="撤销上一步编辑"
            @click="undoWorkbenchEdit"
          >
            <ArrowLeft class="button-icon" />
            <span>撤销</span>
          </button>
          <button
            class="nav-button secondary"
            :data-history-count="workbenchHistoryView.redoCount"
            data-testid="workbench-redo-edit"
            type="button"
            aria-keyshortcuts="Control+Y Meta+Y Control+Shift+Z Meta+Shift+Z"
            :disabled="!workbenchHistoryView.canRedo"
            title="重做上一步编辑"
            @click="redoWorkbenchEdit"
          >
            <ArrowRight class="button-icon" />
            <span>重做</span>
          </button>
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
            data-testid="workbench-open-presets"
            type="button"
            @click="openWorkbenchPresetLibrary"
          >
            <FolderOpened class="button-icon" />
            <span>预设库</span>
          </button>
          <button
            class="nav-button secondary"
            data-testid="workbench-export-project"
            type="button"
            @click="exportProjectFile"
          >
            <Download class="button-icon" />
            <span>导出 JSON</span>
          </button>
          <button
            class="nav-button secondary"
            :data-exporting="pngExporting ? 'true' : 'false'"
            data-testid="workbench-export-project-png"
            type="button"
            :disabled="pngExporting"
            @click="exportProjectPng"
          >
            <Picture class="button-icon" />
            <span>{{ pngExporting ? '正在导出' : '导出 PNG' }}</span>
          </button>
          <button
            class="nav-button secondary"
            data-testid="workbench-import-project"
            type="button"
            @click="openProjectImport"
          >
            <Upload class="button-icon" />
            <span>导入项目</span>
          </button>
          <button
            class="nav-button secondary"
            :data-share-url="projectShareUrl"
            data-testid="workbench-share-project"
            type="button"
            @click="copyProjectShareLink"
          >
            <LinkIcon class="button-icon" />
            <span>分享链接</span>
          </button>
          <input
            ref="projectImportInput"
            class="project-import-input"
            data-testid="workbench-import-project-file"
            type="file"
            accept=".json,.jsonl,.ndjson,.promilia-workbench.json,.png,application/json,application/x-ndjson,image/png"
            @change="importProjectFile"
          />
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

    <WorkbenchPresetLibraryDialog
      :visible="presetDialogVisible"
      :presets="workbenchPresets"
      :default-name="project.name"
      :current-summary="currentWorkbenchPresetSummary"
      @close="closeWorkbenchPresetLibrary"
      @save-preset="saveCurrentWorkbenchPreset"
      @load-preset="loadWorkbenchPreset"
      @duplicate-preset="duplicateWorkbenchPresetEntry"
      @delete-preset="deleteWorkbenchPresetEntry"
    />

    <WorkbenchActionContextMenu
      :mode="actionContextMenu.kind"
      :visible="actionContextMenu.visible"
      :x="actionContextMenu.x"
      :y="actionContextMenu.y"
      :selected-count="selectedActionIds.length"
      :clipboard-count="actionClipboard?.actions?.length ?? 0"
      @close="closeActionContextMenu"
      @copy="copySelectedActions"
      @paste="
        pasteSelectedActions({ targetStartMs: actionContextMenu.targetStartMs })
      "
      @nudge-left="shiftSelectedActions({ offsetMs: -frameToMs(1) })"
      @nudge-right="shiftSelectedActions({ offsetMs: frameToMs(1) })"
      @delete="deleteSelectedActions"
      @delete-relation="deleteActionRelation(selectedActionRelationId)"
    />

    <ScenarioHeader
      :project="project"
      :scenario="simulationResult.scenario"
      :summary="simulationResult.summary"
    />

    <WorkbenchFlowPanel
      :selected-action="selectedAction"
      :generation-bundle="simulationResult.threeValueGenerationBundle"
      :runtime-projection="simulationResult.threeValueRuntimeProjection"
      :runtime-outputs="runtimeOutputs"
      :runtime-selected-detail="runtimeSelectedDetail"
      :selected-state-curve-point-id="selectedStateCurvePointId"
      :runtime-overview-active="runtimeOverviewActive"
      :action-edit-result-context="actionEditResultContext"
      :flow-model="workbenchFlowModel"
      :main-flow-command-surface="mainFlowCommandSurface"
      @dispatch-flow-action="dispatchWorkbenchFlowAction"
      @insert-next-action="addAction"
    />

    <div
      class="workbench-grid"
      :data-flow-phase="mainFlowWorkspaceView.phase"
      :data-main-flow-current-region="
        mainFlowWorkspaceView.region.currentRegion
      "
      :data-main-flow-next-target-kind="
        mainFlowWorkspaceView.region.nextTargetKind
      "
      :data-main-flow-next-region="mainFlowWorkspaceView.region.nextRegion"
      :data-main-flow-pending-runtime-state-point-id="
        mainFlowWorkspaceView.region.pendingRuntimeStatePointId
      "
      :data-main-flow-selected-action-id="
        mainFlowWorkspaceView.region.selectedActionId
      "
      :data-main-flow-selected-runtime-state-point-id="
        mainFlowWorkspaceView.region.selectedRuntimeStatePointId
      "
      :data-main-flow-dispatch-sequence="
        mainFlowWorkspaceView.dispatch.sequence
      "
      :data-main-flow-dispatch-status="mainFlowWorkspaceView.dispatch.status"
      :data-main-flow-dispatch-handled="
        mainFlowWorkspaceView.dispatch.handledState
      "
      :data-main-flow-dispatch-has-result="
        mainFlowWorkspaceView.dispatch.hasResultState
      "
      :data-main-flow-dispatch-kind="mainFlowWorkspaceView.dispatch.kind"
      :data-main-flow-dispatch-source="mainFlowWorkspaceView.dispatch.source"
      :data-main-flow-dispatch-handler-key="
        mainFlowWorkspaceView.dispatch.handlerKey
      "
      :data-main-flow-dispatch-reason="mainFlowWorkspaceView.dispatch.reason"
      :data-main-flow-dispatch-action-id="
        mainFlowWorkspaceView.dispatch.actionId
      "
      :data-main-flow-dispatch-state-point-id="
        mainFlowWorkspaceView.dispatch.statePointId
      "
      :data-main-flow-loop-step="mainFlowWorkspaceView.loop.step"
      :data-main-flow-loop-status="mainFlowWorkspaceView.loop.status"
      :data-main-flow-loop-recovery-needed="
        mainFlowWorkspaceView.loop.recoveryNeededState
      "
      :data-main-flow-loop-next-action-kind="
        mainFlowWorkspaceView.loop.nextActionKind
      "
      :data-main-flow-loop-next-target-kind="
        mainFlowWorkspaceView.loop.nextTargetKind
      "
      :data-main-flow-loop-current-region="
        mainFlowWorkspaceView.loop.currentRegion
      "
      :data-main-flow-loop-next-region="mainFlowWorkspaceView.loop.nextRegion"
      :data-runtime-review-selection-status="
        mainFlowWorkspaceView.reviewSelection.status
      "
      :data-runtime-review-selected-action-id="
        mainFlowWorkspaceView.reviewSelection.selectedActionId
      "
      :data-runtime-review-selected-state-point-id="
        mainFlowWorkspaceView.reviewSelection.selectedStatePointId
      "
      :data-runtime-review-pending-state-point-id="
        mainFlowWorkspaceView.reviewSelection.pendingStatePointId
      "
      :data-runtime-review-source="mainFlowWorkspaceView.reviewSelection.source"
      :data-runtime-review-source-kind="
        mainFlowWorkspaceView.reviewSelection.sourceKind
      "
      :data-runtime-review-last-action-kind="
        mainFlowWorkspaceView.reviewSelection.lastActionKind
      "
      :data-runtime-review-last-action-source="
        mainFlowWorkspaceView.reviewSelection.lastActionSource
      "
      data-testid="workbench-main-flow-workspace"
    >
      <ActionLibraryPanel
        :actor="actionLibraryActor"
        :actors="scenario.actors"
        :active-actor-character-id="actionLibraryCharacterId"
        :actions="scenario.actions"
        :main-flow-command-surface="mainFlowCommandSurface"
        :runtime-action-results="runtimeActionResults"
        :action-readiness-timeline="simulationResult.actionReadinessTimeline"
        :skills="actionLibrarySkills"
        :selected-action-id="selectedActionId"
        :selected-action-ids="selectedActionIds"
        @select-action="selectAction"
        @open-action-context-menu="openActionContextMenu"
        @delete-selected-actions="deleteSelectedActions"
        @add-action="addAction"
        @add-skill-action="addSkillAction"
        @add-annotation-action="addAnnotationAction"
        @add-enemy-event-action="addEnemyEventAction"
        @add-resource-action="addResourceAction"
        @add-switch-action="addSwitchAction"
        @add-wait-action="addWaitAction"
        @copy-action="copyAction"
        @copy-action-batch="copyActionBatch"
        @delete-action="deleteAction"
        @delete-action-batch="deleteActionBatch"
        @dispatch-flow-action="dispatchWorkbenchFlowAction"
        @align-action-batch="alignActionBatch"
        @shift-action-batch="shiftActionBatch"
        @update-active-actor="setActionLibraryCharacterId"
      />

      <div
        class="primary-flow"
        :data-flow-phase="mainFlowWorkspaceView.phase"
        :data-main-flow-current-region="
          mainFlowWorkspaceView.region.currentRegion
        "
        :data-main-flow-next-target-kind="
          mainFlowWorkspaceView.region.nextTargetKind
        "
        :data-main-flow-next-region="mainFlowWorkspaceView.region.nextRegion"
        :data-main-flow-pending-runtime-state-point-id="
          mainFlowWorkspaceView.region.pendingRuntimeStatePointId
        "
        :data-main-flow-selected-runtime-state-point-id="
          mainFlowWorkspaceView.region.selectedRuntimeStatePointId
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
          :selected-action-ids="selectedActionIds"
          :action-relations="actionRelations"
          :selected-action-relation-id="selectedActionRelationId"
          :box-selection-mode="boxSelectionMode"
          :flow-model="workbenchFlowModel"
          :action-edit-focus="actionEditFocus"
          :selected-state-curve-point-id="selectedStateCurvePointId"
          :state-curve-focus-mode="stateCurveFocusMode"
          :state-curve-layer-filters="stateCurveLayerFilters"
          :state-curve-track-filters="stateCurveTrackFilters"
          :runtime-focus-source="runtimeFocusSource"
          :timeline-diagnostics="timelineDiagnostics"
          :action-readiness-timeline="simulationResult.actionReadinessTimeline"
          :main-flow-command-surface="mainFlowCommandSurface"
          @select-action="selectAction"
          @select-action-group="selectActionGroup"
          @select-action-relation="selectActionRelation"
          @open-action-context-menu="openActionContextMenu"
          @open-action-relation-context-menu="openActionRelationContextMenu"
          @toggle-box-selection-mode="toggleBoxSelectionMode"
          @create-action-relations="createRelationsForSelectedActions"
          @select-state-curve-point="selectStateCurvePoint"
          @dispatch-flow-action="dispatchWorkbenchFlowAction"
          @update-state-curve-layer-filter="updateStateCurveLayerFilter"
          @update-state-curve-track-filter="updateStateCurveTrackFilter"
          @update-state-curve-focus-mode="updateStateCurveFocusMode"
          @delete-action="deleteAction"
          @update-action-duration="updateActionDuration"
          @update-action-lane="updateActionLane"
          @update-action-time="updateActionTime"
          @shift-selected-actions="shiftSelectedActions"
          @delete-selected-actions="deleteSelectedActions"
        />

        <div
          class="runtime-review-stack"
          :data-main-flow-current-region="
            mainFlowWorkspaceView.region.currentRegion
          "
          :data-main-flow-pending-runtime-state-point-id="
            mainFlowWorkspaceView.region.pendingRuntimeStatePointId
          "
          :data-main-flow-selected-runtime-state-point-id="
            mainFlowWorkspaceView.region.selectedRuntimeStatePointId
          "
          :data-runtime-review-selection-status="
            mainFlowWorkspaceView.reviewSelection.status
          "
          :data-runtime-review-selected-action-id="
            mainFlowWorkspaceView.reviewSelection.selectedActionId
          "
          :data-runtime-review-selected-state-point-id="
            mainFlowWorkspaceView.reviewSelection.selectedStatePointId
          "
          :data-runtime-review-source="
            mainFlowWorkspaceView.reviewSelection.source
          "
          :data-runtime-review-source-kind="
            mainFlowWorkspaceView.reviewSelection.sourceKind
          "
          :data-runtime-review-primary-operation-kind="
            mainFlowWorkspaceView.reviewOperations.primaryOperationKind
          "
          :data-runtime-review-primary-operation-enabled="
            mainFlowWorkspaceView.reviewOperations.primaryOperationEnabledState
          "
          :data-runtime-review-layout="runtimeReviewLayoutMode"
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
              <TrendCharts
                v-else-if="runtimeReviewPrimaryOperationView.isOpenRuntime"
                class="runtime-review-primary-action-icon"
              />
              <Aim v-else class="runtime-review-primary-action-icon" />
              <span>{{ runtimeReviewPrimaryOperationView.label }}</span>
            </button>
          </div>

          <div
            class="resource-area"
            :data-runtime-review-role="runtimeReviewResourceRole"
            data-testid="workbench-resource-area"
          >
            <ResourceMonitorPanel
              :resource-timeline="simulationResult.resourceTimeline"
              :runtime-projection="runtimeOutputs"
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
            :data-runtime-review-role="runtimeReviewEventRole"
            :event-log="simulationResult.eventLog"
            :runtime-projection="runtimeOutputs"
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

          <div class="effect-area" data-testid="workbench-effect-area">
            <EffectTimelinePanel
              :effect-timeline="runtimeOutputs.effectTimeline"
              :runtime-selected-detail="runtimeSelectedDetail"
              @edit-source-action="editEffectSourceAction"
            />
          </div>
        </div>
      </div>

      <div
        class="side-stack"
        :data-flow-phase="mainFlowWorkspaceView.phase"
        :data-main-flow-inspector-mode="mainFlowWorkspaceView.inspector.mode"
        data-testid="workbench-side-inspector"
      >
        <div
          class="side-stack-panel"
          :data-inspector-panel-order="sideInspectorPanelOrders.actionRules"
          data-inspector-panel-key="action-rules"
          data-testid="workbench-side-inspector-panel"
          :style="{ order: sideInspectorPanelOrders.actionRules }"
        >
          <ActionRuleDiagnosticsPanel
            :diagnostics="simulationResult.actionRuleDiagnostics"
            :selected-action-id="selectedActionId"
            @locate-action="locateActionRuleDiagnostic"
            @apply-suggested-start="applyActionRuleSuggestedStart"
          />
        </div>

        <div
          class="side-stack-panel"
          :data-inspector-panel-order="sideInspectorPanelOrders.properties"
          data-inspector-panel-key="properties"
          data-testid="workbench-side-inspector-panel"
          :style="{ order: sideInspectorPanelOrders.properties }"
        >
          <PropertiesPanel
            :selection="selection"
            :characters="workbenchSeed.gameData.characters"
            :actors="scenario.actors"
            :skills="workbenchSeed.gameData.skills"
            :enemies="gameData.enemies"
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
        </div>

        <div
          class="side-stack-panel"
          :data-inspector-panel-order="sideInspectorPanelOrders.enemy"
          data-inspector-panel-key="enemy"
          data-testid="workbench-side-inspector-panel"
          :style="{ order: sideInspectorPanelOrders.enemy }"
        >
          <EnemyPanel
            :enemy="scenario.enemy"
            :enemy-config="enemyConfig"
            @update-enemy-config="updateEnemyConfig"
          />
        </div>

        <div
          class="side-stack-panel"
          :data-inspector-panel-order="sideInspectorPanelOrders.teamLoadout"
          data-inspector-panel-key="team-loadout"
          data-testid="workbench-side-inspector-panel"
          :style="{ order: sideInspectorPanelOrders.teamLoadout }"
        >
          <TeamLoadoutPanel
            :actors="scenario.actors"
            :characters="workbenchSeed.gameData.characters"
            :team-slots="teamSlots"
            :kibos="loadoutOptions.kibos"
            :equipment="loadoutOptions.equipment"
            :soulessences="loadoutOptions.soulessences"
            @update-team-slot="updateTeamSlot"
            @update-actor-config="updateActorConfig"
          />
        </div>

        <div
          class="side-stack-panel"
          :data-inspector-panel-order="sideInspectorPanelOrders.runtimeDetail"
          data-inspector-panel-key="runtime-detail"
          data-testid="workbench-side-inspector-panel"
          :style="{ order: sideInspectorPanelOrders.runtimeDetail }"
        >
          <RuntimeSelectedDetailPanel
            :detail="runtimeSelectedDetail"
            :action-readiness="runtimeSelectedActionReadiness"
            :action-edit-focus="actionEditFocus"
            :action-edit-result-context="actionEditResultContext"
            :flow-model="workbenchFlowModel"
            :main-flow-command-surface="mainFlowCommandSurface"
            @dispatch-flow-action="dispatchWorkbenchFlowAction"
          />
        </div>

        <div
          class="side-stack-panel"
          :data-inspector-panel-order="sideInspectorPanelOrders.analysis"
          data-inspector-panel-key="analysis"
          data-testid="workbench-side-inspector-panel"
          :style="{ order: sideInspectorPanelOrders.analysis }"
        >
          <AnalysisPanel
            :summary="simulationResult.summary"
            :diagnostics="simulationResult.diagnostics"
            :damage-timeline="simulationResult.damageTimeline"
            :action-result-timeline="simulationResult.actionResultTimeline"
            :runtime-projection="runtimeOutputs"
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
            :main-flow-command-surface="mainFlowCommandSurface"
            @select-state-curve-point="selectStateCurvePoint"
            @update-state-curve-focus-mode="updateStateCurveFocusMode"
            @update-state-curve-layer-filter="updateStateCurveLayerFilter"
            @update-state-curve-track-filter="updateStateCurveTrackFilter"
            @focus-three-value-calculator-scope="focusThreeValueCalculatorScope"
            @dispatch-flow-action="dispatchWorkbenchFlowAction"
          />
        </div>
      </div>
    </div>

    <section
      v-if="pngExporting"
      ref="pngExportSurface"
      class="png-export-surface"
      aria-hidden="true"
      data-testid="workbench-png-export-surface"
    >
      <header class="png-export-header">
        <div>
          <span>蓝色星原排轴</span>
          <h2>{{ project.name }}</h2>
        </div>
        <dl>
          <div>
            <dt>时长</dt>
            <dd>{{ scenario.time.durationMs / 1000 }}s</dd>
          </div>
          <div>
            <dt>动作</dt>
            <dd>
              {{ simulationResult.scenario.executedActionCount }}/{{
                simulationResult.scenario.actionCount
              }}
            </dd>
          </div>
          <div>
            <dt>敌人</dt>
            <dd>{{ scenario.enemy.name }}</dd>
          </div>
          <div>
            <dt>导出</dt>
            <dd>{{ pngExportedAt.slice(0, 10) }}</dd>
          </div>
        </dl>
      </header>
      <TimelineGridPreview
        class="png-export-timeline"
        :actors="scenario.actors"
        :actions="scenario.actions"
        :damage-timeline="simulationResult.damageTimeline"
        :candidate-value-chart="simulationResult.candidateValueSeries.chart"
        :three-value-curve-framework="simulationResult.threeValueCurveFramework"
        :duration-ms="scenario.time.durationMs"
        :selected-action-id="selectedActionId"
        :selected-action-ids="selectedActionIds"
        :action-relations="actionRelations"
        :timeline-diagnostics="timelineDiagnostics"
        :action-readiness-timeline="simulationResult.actionReadinessTimeline"
      />
    </section>
  </main>
</template>

<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import {
  Aim,
  ArrowLeft,
  ArrowRight,
  Document,
  Download,
  EditPen,
  FolderOpened,
  Link as LinkIcon,
  Picture,
  Refresh,
  TrendCharts,
  Upload,
} from '@element-plus/icons-vue';
import ActionLibraryPanel from '../features/workbench/ActionLibraryPanel.vue';
import ActionRuleDiagnosticsPanel from '../features/workbench/ActionRuleDiagnosticsPanel.vue';
import AnalysisPanel from '../features/workbench/AnalysisPanel.vue';
import EnemyPanel from '../features/workbench/EnemyPanel.vue';
import EffectTimelinePanel from '../features/workbench/EffectTimelinePanel.vue';
import EventLogPanel from '../features/workbench/EventLogPanel.vue';
import PropertiesPanel from '../features/workbench/PropertiesPanel.vue';
import ResourceMonitorPanel from '../features/workbench/ResourceMonitorPanel.vue';
import RuntimeSelectedDetailPanel from '../features/workbench/RuntimeSelectedDetailPanel.vue';
import ScenarioHeader from '../features/workbench/ScenarioHeader.vue';
import TeamLoadoutPanel from '../features/workbench/TeamLoadoutPanel.vue';
import TimelineGridPreview from '../features/workbench/TimelineGridPreview.vue';
import WorkbenchActionContextMenu from '../features/workbench/WorkbenchActionContextMenu.vue';
import WorkbenchFlowPanel from '../features/workbench/WorkbenchFlowPanel.vue';
import WorkbenchPresetLibraryDialog from '../features/workbench/WorkbenchPresetLibraryDialog.vue';
import { createRuntimeSelectedDetail } from '../features/workbench/runtimeSelectedDetail';
import {
  createWorkbenchFlowController,
  createWorkbenchFlowPlanHandlers,
} from '../features/workbench/workbenchFlowController';
import { createWorkbenchFlowPlanController } from '../features/workbench/workbenchFlowPlanController';
import {
  createWorkbenchActionMutationRuntimeSyncRequest,
  createWorkbenchFlowRuntime,
} from '../features/workbench/workbenchFlowRuntime';
import {
  createEmptyWorkbenchActionEditFocus,
  createEmptyWorkbenchActionEditSource,
  createWorkbenchActionEditResultContext,
  createWorkbenchActionEditSource,
} from '../features/workbench/workbenchActionEditSource';
import {
  createWorkbenchMainFlowWorkspaceView,
  createWorkbenchFlowModel,
  WORKBENCH_FLOW_ACTION_KINDS,
} from '../features/workbench/workbenchFlowModel';
import {
  createWorkbenchMainFlowActionSurface,
  createWorkbenchMainFlowCommandSurface,
} from '../features/workbench/workbenchMainFlowActions';
import { createRuntimeStatePointContexts } from '../features/workbench/runtimeProjectionPoints';
import { applyWorkbenchRuntimeViewPatch } from '../features/workbench/workbenchRuntimeViewState';
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
  getWorkbenchLoadoutOptions,
  getWorkbenchSeed,
  normalizeWorkbenchActorConfigs,
  normalizeWorkbenchActionDrafts,
  normalizeWorkbenchEnemyConfig,
  normalizeWorkbenchSelection,
  normalizeWorkbenchTeamSlots,
} from '../domain/workbenchProjectFactory';
import { ACTION_TYPES } from '../domain/projectSchema';
import {
  createWorkbenchActionClipboard,
  createWorkbenchActionSelectionRange,
  normalizeWorkbenchActionSelection,
  pasteWorkbenchActionClipboard,
  shiftWorkbenchActionDrafts,
} from '../domain/workbenchActionClipboard';
import {
  createNextWorkbenchActionRelationIdFromUsedIds,
  createWorkbenchActionRelationChain,
  normalizeWorkbenchActionRelations,
  removeWorkbenchActionRelationsForActions,
  synchronizeWorkbenchActionRelationGaps,
} from '../domain/workbenchActionRelations';
import {
  clearWorkbenchDraft,
  createWorkbenchDraftSnapshot,
  createWorkbenchProjectFileName,
  createWorkbenchProjectFileSnapshot,
  createWorkbenchProjectShareCode,
  createDefaultWorkbenchDraftState,
  loadWorkbenchDraft,
  normalizeWorkbenchSegmentSplitOptions,
  parseWorkbenchProjectFile,
  parseWorkbenchProjectShareCode,
  saveWorkbenchDraft,
  WORKBENCH_PROJECT_SHARE_PARAM,
} from '../domain/workbenchDraftStorage';
import {
  addWorkbenchPreset,
  createWorkbenchDraftFromPreset,
  createWorkbenchPresetSnapshot,
  deleteWorkbenchPreset,
  duplicateWorkbenchPreset,
  loadWorkbenchPresetLibrary,
} from '../domain/workbenchPresetStorage';
import {
  createWorkbenchProjectPngFileName,
  createWorkbenchProjectPngMetadata,
  embedWorkbenchProjectInPng,
  parseWorkbenchProjectPng,
} from '../domain/workbenchPngProject';
import {
  bindWorkbenchRuntimeSampleCaptures,
  mergeWorkbenchRuntimeSampleCaptures,
  normalizeWorkbenchRuntimeSampleCaptures,
  parseWorkbenchRuntimeSampleCaptureFile,
} from '../domain/workbenchRuntimeSampleCapture';
import { frameToMs } from '../domain/timebase';
import { isPngSource } from '../utils/pngMetadata';
import { compileProject } from '../simulation/compiler/compileProject';
import { simulateScenario } from '../simulation/engine/simulateScenario';
import {
  getProjectSimulationSkillDiagnosticsStatus,
  installProjectSimulationSkillDiagnostics,
} from '../simulation/projection/projectSimulationResult';

const workbenchSeed = getWorkbenchSeed();
const gameData = getWorkbenchGameData();
const loadoutOptions = getWorkbenchLoadoutOptions();
const NEW_ACTION_INSERT_GAP_MS = frameToMs(60);
const WORKBENCH_HISTORY_LIMIT = 50;
const WORKBENCH_PRESET_LIBRARY_PARAM = 'presets';
const WORKBENCH_RUNTIME_NAVIGATION_SHORTCUT_SOURCE =
  'workbench-keyboard-runtime-navigation';
const DEFAULT_STATE_CURVE_LAYER_FILTERS = {
  applied: true,
  candidate: true,
  sampled: false,
  placeholder: false,
};
const AUTO_DELAY_NOTE_PATTERN =
  /^自动推迟：同轨已有动作占用，已从 \d+(?:\.\d+)?ms 调整到 \d+(?:\.\d+)?ms。$/;
const initialDraft = createDefaultWorkbenchDraftState();
const selection = ref({ ...initialDraft.selection });
const teamSlots = ref(initialDraft.teamSlots.map(slot => ({ ...slot })));
const actorConfigs = ref([...initialDraft.actorConfigs]);
const enemyConfig = ref({ ...initialDraft.enemyConfig });
const segmentSplitOptions = ref({ ...initialDraft.segmentSplitOptions });
const segmentSplitPreview = ref(null);
const actionDrafts = ref([...initialDraft.actionDrafts]);
const actionRelations = ref([...initialDraft.actionRelations]);
const runtimeSampleCaptures = ref([...initialDraft.runtimeSampleCaptures]);
const selectedActionId = ref(initialDraft.selectedActionId);
const selectedActionIds = ref(
  initialDraft.selectedActionId ? [initialDraft.selectedActionId] : []
);
const actionSelectionAnchorId = ref(initialDraft.selectedActionId);
const selectedActionRelationId = ref('');
const boxSelectionMode = ref(false);
const actionClipboard = ref(null);
const actionContextMenu = ref(createClosedActionContextMenu());
const selectedStateCurvePointId = ref('');
const stateCurveFocusMode = ref('all');
const stateCurveLayerFilters = ref({ ...DEFAULT_STATE_CURVE_LAYER_FILTERS });
const stateCurveTrackFilters = ref({});
const calculatorDiagnosticScope = ref('');
const calculatorDiagnosticFocus = ref({ scope: '', sequence: 0 });
const runtimeLogFocus = ref({ source: '', statePointId: '', sequence: 0 });
const actionLibraryCharacterId = ref(initialDraft.selection.characterId);
const draftStatus = ref('未保存草稿');
const projectShareUrl = ref('');
const presetDialogVisible = ref(false);
const workbenchPresets = ref([]);
const undoHistoryStack = ref([]);
const redoHistoryStack = ref([]);
const workbenchRoot = ref(null);
const projectImportInput = ref(null);
const pngExportSurface = ref(null);
const pngExporting = ref(false);
const pngExportedAt = ref('');
const actionEditSource = ref(createEmptyWorkbenchActionEditSource());
const actionEditFocus = ref(createEmptyWorkbenchActionEditFocus());
const workbenchFlowDispatchState = ref(createEmptyWorkbenchFlowDispatchState());
const runtimeDiagnosticsStatus = ref('idle');
const runtimeDiagnosticsRevision = ref(0);
let runtimeDiagnosticsLoadPromise = null;
const workbenchFlowPlanController = createWorkbenchFlowPlanController({
  getRuntimeProjection: () =>
    simulationResult.value.threeValueRuntimeProjection,
  getSelectedActionId: () => selectedActionId.value,
  getActionEditFocusSequence: () => actionEditFocus.value.sequence,
});
const workbenchFlowRuntime = createWorkbenchFlowRuntime({
  actionExists: actionId => Boolean(findActionDraftById(actionId)),
  applyActionSelectionState: selectionState =>
    applyActionSelectionState(selectionState),
  applyActionEditState: editState => applyActionEditState(editState),
  applyActionMutationRuntimeSyncState: syncState =>
    applyActionMutationRuntimeSyncState(syncState),
  setCalculatorScope: scope => {
    calculatorDiagnosticScope.value = scope;
  },
  getFirstRuntimeStatePointId: () =>
    getFirstRuntimeStatePointId(runtimeOutputs.value),
  isRuntimeOverviewActive: () => runtimeOverviewActive.value,
  isRuntimeStatePointSelected: () =>
    Boolean(
      findRuntimeStatePointContextById(
        runtimeOutputs.value,
        selectedStateCurvePointId.value
      )
    ),
  getCurrentRuntimeLogFocus: () => runtimeLogFocus.value,
  applyRuntimeViewPatch: patch => applyRuntimeViewPatch(patch),
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
    teamSlots: teamSlots.value,
    actorConfigs: actorConfigs.value,
    enemyConfig: enemyConfig.value,
    actions: actionDrafts.value,
    actionRelations: actionRelations.value,
    runtimeSampleCaptures: runtimeSampleCaptures.value,
  })
);
const scenario = computed(() => compileProject(project.value, gameData));
const simulationResult = computed(() => {
  void runtimeDiagnosticsRevision.value;
  return simulateScenario(scenario.value);
});
const currentWorkbenchPresetSummary = computed(() => ({
  actionCount: actionDrafts.value.length,
  actorNames: scenario.value.actors.map(actor => actor.name),
  enemyName: scenario.value.enemy.name,
}));
const runtimeOutputs = computed(() => simulationResult.value.runtimeOutputs);
const runtimeSelectedDetail = computed(() =>
  createRuntimeSelectedDetail({
    runtimeProjection: runtimeOutputs.value,
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
  createWorkbenchActionEditResultContext({
    source: actionEditSource.value,
    runtimeProjection: runtimeOutputs.value,
  })
);
const runtimeActionResults = computed(() =>
  createRuntimeActionResultMap(runtimeOutputs.value)
);
const runtimeSelectedActionReadiness = computed(() => {
  const actionId = runtimeSelectedDetail.value?.actionId;
  return (
    simulationResult.value.actionReadinessTimeline?.actions?.find(
      action => action.actionId === actionId
    ) ?? null
  );
});
const workbenchFlowModel = computed(() =>
  createWorkbenchFlowModel({
    selectedAction: selectedAction.value,
    generationBundle: simulationResult.value.threeValueGenerationBundle,
    runtimeProjection: simulationResult.value.threeValueRuntimeProjection,
    runtimeOutputs: runtimeOutputs.value,
    runtimeSelectedDetail: runtimeSelectedDetail.value,
    selectedStateCurvePointId: selectedStateCurvePointId.value,
    runtimeFocusSource: runtimeFocusSource.value,
    runtimeOverviewActive: runtimeOverviewActive.value,
    actionEditFocus: actionEditFocus.value,
    actionEditResultContext: actionEditResultContext.value,
    flowDispatchState: workbenchFlowDispatchState.value,
  })
);
const mainFlowWorkspaceView = computed(() =>
  createWorkbenchMainFlowWorkspaceView({
    flowModel: workbenchFlowModel.value,
  })
);
const sideInspectorPanelOrders = computed(() =>
  createSideInspectorPanelOrders(mainFlowWorkspaceView.value.inspector.mode)
);
const mainFlowCommandSurface = computed(() =>
  createWorkbenchMainFlowCommandSurface({
    flowModel: workbenchFlowModel.value,
    source: 'workbench-flow-panel',
    recoverySource: 'workbench-flow-recovery',
    runtimeReviewPrimarySource: 'runtime-review-primary',
  })
);
const mainFlowActionSurface = computed(() =>
  createWorkbenchMainFlowActionSurface({
    mainFlowCommandSurface: mainFlowCommandSurface.value,
  })
);
const runtimeReviewPrimaryOperationCommand = computed(
  () => mainFlowCommandSurface.value.runtimeReviewPrimary
);
const runtimeReviewPrimaryOperationView = computed(
  () => runtimeReviewPrimaryOperationCommand.value.view
);
const runtimeReviewLayoutMode = computed(() =>
  mainFlowWorkspaceView.value.reviewSelection.hasSelection ||
  mainFlowWorkspaceView.value.reviewSelection.hasPendingResult
    ? 'result-check'
    : 'overview'
);
const runtimeReviewResourceRole = computed(() =>
  runtimeReviewLayoutMode.value === 'result-check' ? 'primary' : 'overview'
);
const runtimeReviewEventRole = computed(() =>
  runtimeReviewLayoutMode.value === 'result-check' ? 'secondary' : 'overview'
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
const workbenchHistoryView = computed(() => ({
  canUndo: undoHistoryStack.value.length > 0,
  canRedo: redoHistoryStack.value.length > 0,
  undoCount: undoHistoryStack.value.length,
  redoCount: redoHistoryStack.value.length,
}));

watch(
  selectedActionId,
  actionId => {
    if (actionId && !selectedActionIds.value.includes(actionId)) {
      selectedActionIds.value = [actionId];
      actionSelectionAnchorId.value = actionId;
    }
  },
  { flush: 'sync' }
);

watch(
  actionDrafts,
  actions => {
    const normalized = normalizeWorkbenchActionSelection(
      actions,
      selectedActionIds.value,
      selectedActionId.value
    );
    selectedActionIds.value = normalized.selectedActionIds;
    selectedActionId.value = normalized.primaryActionId;
    if (!normalized.selectedActionIds.includes(actionSelectionAnchorId.value)) {
      actionSelectionAnchorId.value = normalized.primaryActionId;
    }
    const synchronizedRelations = synchronizeWorkbenchActionRelationGaps(
      actionRelations.value,
      actions
    );
    if (
      JSON.stringify(synchronizedRelations) !==
      JSON.stringify(actionRelations.value)
    ) {
      actionRelations.value = synchronizedRelations;
    }
    if (
      selectedActionRelationId.value &&
      !synchronizedRelations.some(
        relation => relation.id === selectedActionRelationId.value
      )
    ) {
      selectedActionRelationId.value = '';
    }
  },
  { flush: 'sync' }
);

onMounted(() => {
  window?.addEventListener?.('keydown', handleWorkbenchKeyboardShortcut);
  window?.addEventListener?.('hashchange', handleWorkbenchHashChange);
  refreshWorkbenchPresetLibrary();
  openWorkbenchPresetLibraryFromUrl();
  if (applySharedProjectFromUrl()) {
    return;
  }

  const draft = loadWorkbenchDraft(getLocalStorage());
  if (!draft) {
    return;
  }

  applyDraftState(draft);
  draftStatus.value = '已恢复草稿';
  if (draft.runtimeSampleCaptures?.length) {
    void ensureRuntimeDiagnosticsLoaded();
  }
});

onBeforeUnmount(() => {
  window?.removeEventListener?.('keydown', handleWorkbenchKeyboardShortcut);
  window?.removeEventListener?.('hashchange', handleWorkbenchHashChange);
});

function handleWorkbenchHashChange() {
  if (!applySharedProjectFromUrl()) {
    openWorkbenchPresetLibraryFromUrl();
  }
}

function updateTeamSlot({ slotId, characterId } = {}) {
  const slotIndex = teamSlots.value.findIndex(slot => slot.slotId === slotId);
  const nextCharacterId = Number(characterId);
  const nextCharacter = workbenchSeed.gameData.characters.find(
    character => Number(character.id) === nextCharacterId
  );
  if (slotIndex < 0 || !nextCharacter) {
    return;
  }

  const previousCharacterId = Number(teamSlots.value[slotIndex]?.characterId);
  if (previousCharacterId === nextCharacterId) {
    return;
  }

  const nextTeamSlots = teamSlots.value.map(slot => ({ ...slot }));
  const occupiedSlotIndex = nextTeamSlots.findIndex(
    (slot, index) =>
      index !== slotIndex && Number(slot.characterId) === nextCharacterId
  );
  nextTeamSlots[slotIndex].characterId = nextCharacterId;
  if (occupiedSlotIndex >= 0) {
    nextTeamSlots[occupiedSlotIndex].characterId = previousCharacterId;
  }
  const normalizedTeamSlots = normalizeWorkbenchTeamSlots(
    nextTeamSlots,
    selection.value
  );

  updateSelection(
    {
      characterId: normalizedTeamSlots[0].characterId,
      secondaryCharacterId: normalizedTeamSlots[1].characterId,
    },
    {
      teamSlots: normalizedTeamSlots,
    }
  );
}

function updateSelection(patch, options = {}) {
  clearSegmentSplitPreview();
  recordWorkbenchHistorySnapshot();
  const previousSelection = selection.value;
  const characterChanged =
    patch.characterId != null &&
    Number(patch.characterId) !== Number(selection.value.characterId);
  const secondaryCharacterChanged =
    patch.secondaryCharacterId != null &&
    Number(patch.secondaryCharacterId) !==
      Number(selection.value.secondaryCharacterId);
  const nextSelection = normalizeWorkbenchSelection(
    {
      ...selection.value,
      ...patch,
    },
    options.teamSlots
  );
  selection.value = nextSelection;
  if (characterChanged || secondaryCharacterChanged || options.teamSlots) {
    teamSlots.value = normalizeWorkbenchTeamSlots(
      options.teamSlots,
      nextSelection
    );
  }
  actorConfigs.value = normalizeWorkbenchActorConfigs(
    actorConfigs.value,
    nextSelection
  );

  normalizeActionLibraryCharacterId(previousSelection, nextSelection, {
    characterChanged,
    secondaryCharacterChanged,
  });

  if (characterChanged || secondaryCharacterChanged) {
    const nextActionDrafts = actionDrafts.value.map(action => {
      const nextAction = { ...action };
      const previousActorCharacterId = Number(action.actorCharacterId);
      if (
        characterChanged &&
        previousActorCharacterId === Number(previousSelection.characterId)
      ) {
        nextAction.actorCharacterId = nextSelection.characterId;
      } else if (
        secondaryCharacterChanged &&
        previousActorCharacterId ===
          Number(previousSelection.secondaryCharacterId)
      ) {
        nextAction.actorCharacterId = nextSelection.secondaryCharacterId;
      }
      if (nextAction.type === ACTION_TYPES.SWITCH) {
        const previousTargetCharacterId = Number(action.targetCharacterId);
        if (
          characterChanged &&
          previousTargetCharacterId === Number(previousSelection.characterId)
        ) {
          nextAction.targetCharacterId = nextSelection.characterId;
        } else if (
          secondaryCharacterChanged &&
          previousTargetCharacterId ===
            Number(previousSelection.secondaryCharacterId)
        ) {
          nextAction.targetCharacterId = nextSelection.secondaryCharacterId;
        }
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
  recordWorkbenchHistorySnapshot();
  const actionId = selectedActionId.value;
  const previousAction = findActionDraftById(actionId);
  const editSourceFocus = captureActionEditSourceFocus(actionId);
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
    focus: editSourceFocus,
  });
  markDraftDirty();
}

function updateEnemyConfig(patch) {
  clearSegmentSplitPreview();
  recordWorkbenchHistorySnapshot();
  enemyConfig.value = normalizeWorkbenchEnemyConfig({
    ...enemyConfig.value,
    ...patch,
  });
  markDraftDirty();
}

function updateActorConfig(patch = {}) {
  const { characterId, loadout = {} } = patch;
  const activeConfig = actorConfigs.value.find(
    config => Number(config.characterId) === Number(characterId)
  );
  if (!activeConfig) {
    return;
  }

  clearSegmentSplitPreview();
  recordWorkbenchHistorySnapshot();
  const hasInitialSp = Object.prototype.hasOwnProperty.call(patch, 'initialSp');
  actorConfigs.value = normalizeWorkbenchActorConfigs(
    actorConfigs.value.map(config => {
      if (Number(config.characterId) !== Number(characterId)) {
        return config;
      }
      return {
        ...config,
        ...(hasInitialSp ? { initialSp: patch.initialSp } : {}),
        loadout: {
          ...config.loadout,
          ...loadout,
          equipment: {
            ...config.loadout?.equipment,
            ...loadout.equipment,
          },
        },
      };
    }),
    selection.value
  );
  markDraftDirty();
}

function updateSegmentSplitOptions(patch) {
  clearSegmentSplitPreview();
  recordWorkbenchHistorySnapshot();
  segmentSplitOptions.value = normalizeWorkbenchSegmentSplitOptions({
    ...segmentSplitOptions.value,
    ...patch,
  });
  markDraftDirty();
}

function updateActionTime({ actionId, startMs }) {
  clearSegmentSplitPreview();
  recordWorkbenchHistorySnapshot();
  const previousAction = findActionDraftById(actionId);
  const editSourceFocus = captureActionEditSourceFocus(actionId);
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
      focus: editSourceFocus,
    }
  );
  markDraftDirty();
}

function updateActionDuration({ actionId, durationMs }) {
  clearSegmentSplitPreview();
  recordWorkbenchHistorySnapshot();
  const previousAction = findActionDraftById(actionId);
  const editSourceFocus = captureActionEditSourceFocus(actionId);
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
      focus: editSourceFocus,
    }
  );
  markDraftDirty();
}

function updateActionLane({ actionId, laneId }) {
  clearSegmentSplitPreview();
  const previousAction = findActionDraftById(actionId);
  const editSourceFocus = captureActionEditSourceFocus(actionId);
  const targetActor = scenario.value.actors.find(actor => actor.id === laneId);
  if (!targetActor) {
    return;
  }

  recordWorkbenchHistorySnapshot();
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
        focus: editSourceFocus,
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
  const sourceIndex = actionDrafts.value.findIndex(
    action => action.id === actionId
  );
  const sourceAction = actionDrafts.value[sourceIndex];
  if (!sourceAction) {
    return;
  }

  recordWorkbenchHistorySnapshot();
  const runtimeReviewState = captureActionMutationRuntimeReviewState();
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
  applyActionMutationRuntimeSyncRequest({
    actionId: nextAction.id,
    runtimeReviewState,
    selectedActionChanged: true,
    affectedActionIds: [nextAction.id],
  });
  markDraftDirty();
}

function copySelectedActions({ actionIds = selectedActionIds.value } = {}) {
  clearSegmentSplitPreview();
  const clipboard = createWorkbenchActionClipboard(
    actionDrafts.value,
    actionIds,
    actionRelations.value
  );
  if (!clipboard) {
    return null;
  }

  actionClipboard.value = clipboard;
  return clipboard;
}

function pasteSelectedActions({ targetStartMs = undefined } = {}) {
  clearSegmentSplitPreview();
  const pasteResult = pasteWorkbenchActionClipboard(actionClipboard.value, {
    existingActions: actionDrafts.value,
    existingRelations: actionRelations.value,
    timelineDurationMs: project.value.time.durationMs,
    targetStartMs,
    pasteGapMs: NEW_ACTION_INSERT_GAP_MS,
    createActionId: usedActionIds =>
      createNextActionIdFromUsedIds(usedActionIds),
    createRelationId: usedRelationIds =>
      createNextWorkbenchActionRelationIdFromUsedIds(usedRelationIds),
    normalizeSourceAction: action => ({
      ...action,
      note: stripAutoDelayNote(action.note),
    }),
  });
  if (!pasteResult?.pastedActions?.length) {
    return null;
  }

  recordWorkbenchHistorySnapshot();
  const runtimeReviewState = captureActionMutationRuntimeReviewState();
  actionDrafts.value = [...actionDrafts.value, ...pasteResult.pastedActions];
  actionRelations.value = normalizeWorkbenchActionRelations(
    [...actionRelations.value, ...pasteResult.pastedRelations],
    actionDrafts.value
  );
  actionClipboard.value = pasteResult.nextClipboard;
  setWorkbenchActionSelection(
    pasteResult.selectedActionIds,
    pasteResult.primaryActionId,
    { anchorActionId: pasteResult.primaryActionId }
  );
  selectedActionRelationId.value = '';
  syncActionLibraryCharacterIdFromDraft(
    findActionDraftById(pasteResult.primaryActionId)
  );
  applyActionMutationRuntimeSyncRequest({
    actionId: pasteResult.primaryActionId,
    runtimeReviewState,
    selectedActionChanged: true,
    affectedActionIds: pasteResult.selectedActionIds,
  });
  markDraftDirty();
  return pasteResult;
}

function deleteSelectedActions({ actionIds = selectedActionIds.value } = {}) {
  clearSegmentSplitPreview();
  const requestedActionIds = new Set(actionIds);
  const affectedActionIds = actionDrafts.value
    .filter(action => requestedActionIds.has(action.id))
    .map(action => action.id);
  if (
    affectedActionIds.length === 0 ||
    affectedActionIds.length >= actionDrafts.value.length
  ) {
    return false;
  }

  recordWorkbenchHistorySnapshot();
  const runtimeReviewState = captureActionMutationRuntimeReviewState();
  const firstRemovedIndex = actionDrafts.value.findIndex(action =>
    requestedActionIds.has(action.id)
  );
  actionRelations.value = removeWorkbenchActionRelationsForActions(
    actionRelations.value,
    affectedActionIds
  );
  selectedActionRelationId.value = '';
  actionDrafts.value = actionDrafts.value.filter(
    action => !requestedActionIds.has(action.id)
  );
  const nextIndex = Math.min(firstRemovedIndex, actionDrafts.value.length - 1);
  const nextActionId = actionDrafts.value[nextIndex]?.id ?? '';
  setWorkbenchActionSelection([nextActionId], nextActionId, {
    anchorActionId: nextActionId,
  });
  syncActionLibraryCharacterIdFromDraft(findActionDraftById(nextActionId));
  applyActionMutationRuntimeSyncRequest({
    actionId: nextActionId,
    runtimeReviewState,
    selectedActionChanged: true,
    affectedActionIds,
  });
  markDraftDirty();
  return true;
}

function shiftSelectedActions({
  actionIds = selectedActionIds.value,
  offsetMs = 0,
} = {}) {
  clearSegmentSplitPreview();
  const editedActionId = actionIds.includes(selectedActionId.value)
    ? selectedActionId.value
    : (actionIds[0] ?? '');
  const previousAction = findActionDraftById(editedActionId);
  const editSourceFocus = captureActionEditSourceFocus(editedActionId);
  const shifted = shiftWorkbenchActionDrafts(
    actionDrafts.value,
    actionIds,
    offsetMs,
    project.value.time.durationMs
  );
  if (!shifted.appliedOffsetMs) {
    return false;
  }

  recordWorkbenchHistorySnapshot();
  actionDrafts.value = shifted.actions;
  const nextAction = findActionDraftById(editedActionId);
  if (previousAction && nextAction) {
    recordActionEditSource(
      editedActionId,
      { startMs: nextAction.startMs },
      {
        previousAction,
        nextAction,
        focus: editSourceFocus,
      }
    );
  }
  markDraftDirty();
  return true;
}

function copyActionBatch(batchId) {
  clearSegmentSplitPreview();
  if (!batchId) {
    return;
  }

  const sourceEntries = actionDrafts.value
    .map((action, index) => ({ action, index }))
    .filter(entry => entry.action.generationBatch?.batchId === batchId);
  if (sourceEntries.length === 0) {
    return;
  }

  const sourceActions = sourceEntries.map(entry => entry.action);
  const sourceMinStartMs = Math.min(
    ...sourceActions.map(action => Math.max(0, Number(action.startMs) || 0))
  );
  const sourceMaxStartMs = Math.max(
    ...sourceActions.map(action => Math.max(0, Number(action.startMs) || 0))
  );
  const sourceMaxEndMs = Math.max(
    ...sourceActions.map(action => {
      const startMs = Math.max(0, Number(action.startMs) || 0);
      return startMs + resolveDraftDurationMs(action);
    })
  );
  const offsetMs = clampNumber(
    sourceMaxEndMs + NEW_ACTION_INSERT_GAP_MS - sourceMinStartMs,
    -sourceMinStartMs,
    project.value.time.durationMs - sourceMaxStartMs
  );
  const copiedGenerationBatch = createCopiedGenerationBatch(
    sourceActions[0].generationBatch,
    sourceActions.length
  );
  const usedActionIds = new Set(actionDrafts.value.map(action => action.id));
  const copiedActions = sourceActions.map(action =>
    createWorkbenchActionDraft({
      ...action,
      id: createNextActionIdFromUsedIds(usedActionIds),
      startMs: clampNumber(
        (Number(action.startMs) || 0) + offsetMs,
        0,
        project.value.time.durationMs
      ),
      note: stripAutoDelayNote(action.note),
      insertion: null,
      generationBatch: copiedGenerationBatch,
    })
  );
  if (copiedActions.length === 0) {
    return;
  }
  const copiedActionIdBySourceId = new Map(
    sourceActions.map((action, index) => [action.id, copiedActions[index].id])
  );
  const sourceActionIdSet = new Set(sourceActions.map(action => action.id));
  const usedRelationIds = new Set(
    actionRelations.value.map(relation => relation.id)
  );
  const copiedRelations = normalizeWorkbenchActionRelations(
    actionRelations.value
      .filter(
        relation =>
          sourceActionIdSet.has(relation.fromActionId) &&
          sourceActionIdSet.has(relation.toActionId)
      )
      .map(relation => ({
        ...relation,
        id: createNextWorkbenchActionRelationIdFromUsedIds(usedRelationIds),
        fromActionId: copiedActionIdBySourceId.get(relation.fromActionId),
        toActionId: copiedActionIdBySourceId.get(relation.toActionId),
      })),
    copiedActions
  );

  recordWorkbenchHistorySnapshot();
  const runtimeReviewState = captureActionMutationRuntimeReviewState();
  const insertIndex = Math.max(...sourceEntries.map(entry => entry.index)) + 1;
  actionDrafts.value = [
    ...actionDrafts.value.slice(0, insertIndex),
    ...copiedActions,
    ...actionDrafts.value.slice(insertIndex),
  ];
  actionRelations.value = normalizeWorkbenchActionRelations(
    [...actionRelations.value, ...copiedRelations],
    actionDrafts.value
  );
  selectedActionId.value = copiedActions[0].id;
  syncActionLibraryCharacterIdFromDraft(copiedActions[0]);
  applyActionMutationRuntimeSyncRequest({
    actionId: copiedActions[0].id,
    runtimeReviewState,
    selectedActionChanged: true,
    affectedActionIds: copiedActions.map(action => action.id),
  });
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

  recordWorkbenchHistorySnapshot();
  const runtimeReviewState = captureActionMutationRuntimeReviewState();
  const selectedWasRemoved = selectedActionId.value === actionId;
  actionDrafts.value = actionDrafts.value.filter(
    action => action.id !== actionId
  );

  if (selectedWasRemoved) {
    const nextIndex = Math.min(index, actionDrafts.value.length - 1);
    selectedActionId.value = actionDrafts.value[nextIndex].id;
    syncActionLibraryCharacterIdFromDraft(actionDrafts.value[nextIndex]);
  }
  applyActionMutationRuntimeSyncRequest({
    actionId: selectedActionId.value,
    runtimeReviewState,
    selectedActionChanged: selectedWasRemoved,
    affectedActionIds: [actionId],
  });
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

  recordWorkbenchHistorySnapshot();
  const firstRemovedIndex = actionDrafts.value.findIndex(action =>
    batchActionIds.has(action.id)
  );
  const runtimeReviewState = captureActionMutationRuntimeReviewState();
  const selectedWasRemoved = batchActionIds.has(selectedActionId.value);
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
  applyActionMutationRuntimeSyncRequest({
    actionId: selectedActionId.value,
    runtimeReviewState,
    selectedActionChanged: selectedWasRemoved,
    affectedActionIds: batchActionIds,
  });
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
  const runtimeReviewState = captureActionMutationRuntimeReviewState();
  const selectedActionInBatch = batchActions.some(
    action => action.id === selectedActionId.value
  );
  const affectedActionIds = batchActions.map(action => action.id);
  const appliedOffsetMs = clampNumber(
    offset,
    -minStartMs,
    project.value.time.durationMs - maxStartMs
  );
  if (appliedOffsetMs === 0) {
    return;
  }

  recordWorkbenchHistorySnapshot();
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
  applyActionMutationRuntimeSyncRequest({
    fallbackActionId: selectedActionId.value,
    runtimeReviewState,
    selectedActionChanged: selectedActionInBatch,
    affectedActionIds,
  });
  markDraftDirty();
}

function saveDraft() {
  const snapshot = saveWorkbenchDraft(
    getLocalStorage(),
    getWorkbenchDraftState()
  );
  draftStatus.value = snapshot ? '已保存草稿' : '草稿不可用';
}

function openWorkbenchPresetLibrary() {
  refreshWorkbenchPresetLibrary();
  presetDialogVisible.value = true;
}

function closeWorkbenchPresetLibrary() {
  presetDialogVisible.value = false;
  clearWorkbenchHashQueryParam(WORKBENCH_PRESET_LIBRARY_PARAM);
}

function openWorkbenchPresetLibraryFromUrl() {
  if (getWorkbenchHashQueryParam(WORKBENCH_PRESET_LIBRARY_PARAM) !== '1') {
    return false;
  }
  openWorkbenchPresetLibrary();
  return true;
}

function refreshWorkbenchPresetLibrary() {
  const library = loadWorkbenchPresetLibrary(getLocalStorage());
  workbenchPresets.value = library.presets;
  return library;
}

function saveCurrentWorkbenchPreset(metadata) {
  const preset = createWorkbenchPresetSnapshot(getWorkbenchDraftState(), {
    ...metadata,
    projectName: project.value.name,
    summary: currentWorkbenchPresetSummary.value,
  });
  const library = addWorkbenchPreset(getLocalStorage(), preset);
  if (!library) {
    draftStatus.value = '预设存储不可用';
    return;
  }
  workbenchPresets.value = library.presets;
  draftStatus.value = `已保存预设：${preset.name}`;
}

function loadWorkbenchPreset(presetId) {
  const preset = workbenchPresets.value.find(item => item.id === presetId);
  const draft = createWorkbenchDraftFromPreset(preset);
  if (!preset || !draft) {
    draftStatus.value = '预设版本不兼容';
    return;
  }
  applyImportedProjectDraft(draft, `已加载预设：${preset.name}`);
  closeWorkbenchPresetLibrary();
}

function duplicateWorkbenchPresetEntry(presetId) {
  const sourcePreset = workbenchPresets.value.find(
    item => item.id === presetId
  );
  const library = duplicateWorkbenchPreset(getLocalStorage(), presetId);
  if (!library) {
    draftStatus.value = '预设复制失败';
    return;
  }
  workbenchPresets.value = library.presets;
  draftStatus.value = sourcePreset
    ? `已复制预设：${sourcePreset.name} 副本`
    : '已复制预设';
}

function deleteWorkbenchPresetEntry(presetId) {
  const preset = workbenchPresets.value.find(item => item.id === presetId);
  const library = deleteWorkbenchPreset(getLocalStorage(), presetId);
  if (!library) {
    draftStatus.value = '预设删除失败';
    return;
  }
  workbenchPresets.value = library.presets;
  draftStatus.value = preset ? `已删除预设：${preset.name}` : '预设不存在';
}

function getWorkbenchDraftState() {
  return {
    selection: selection.value,
    teamSlots: teamSlots.value,
    actorConfigs: actorConfigs.value,
    enemyConfig: enemyConfig.value,
    segmentSplitOptions: segmentSplitOptions.value,
    actionDrafts: actionDrafts.value,
    actionRelations: actionRelations.value,
    runtimeSampleCaptures: runtimeSampleCaptures.value,
    selectedActionId: selectedActionId.value,
  };
}

function exportProjectFile() {
  if (typeof document === 'undefined' || typeof Blob === 'undefined') {
    draftStatus.value = '导出不可用';
    return;
  }

  const snapshot = createWorkbenchProjectFileSnapshot(getWorkbenchDraftState());
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: 'application/json',
  });
  downloadWorkbenchBlob(blob, createWorkbenchProjectFileName(snapshot));
  draftStatus.value = '已导出项目';
}

async function exportProjectPng() {
  if (
    pngExporting.value ||
    typeof document === 'undefined' ||
    typeof Blob === 'undefined'
  ) {
    if (!pngExporting.value) {
      draftStatus.value = '导出不可用';
    }
    return;
  }

  pngExporting.value = true;
  pngExportedAt.value = new Date().toISOString();
  draftStatus.value = '正在导出 PNG';
  try {
    await nextTick();
    await document.fonts?.ready;
    const surface = pngExportSurface.value;
    if (!surface) {
      throw new Error('PNG export surface is unavailable');
    }
    const { snapdom } = await import('@zumer/snapdom');
    const capture = await snapdom(surface, {
      scale: 1,
      width: Math.max(1200, Math.ceil(surface.scrollWidth)),
      height: Math.max(600, Math.ceil(surface.scrollHeight)),
    });
    const captureBlob = await capture.toBlob({ type: 'png', dpr: 1 });
    const metadata = createWorkbenchProjectPngMetadata(
      getWorkbenchDraftState(),
      pngExportedAt.value
    );
    const pngBlob = await embedWorkbenchProjectInPng(captureBlob, metadata);
    downloadWorkbenchBlob(pngBlob, createWorkbenchProjectPngFileName(metadata));
    draftStatus.value = '已导出 PNG 项目';
  } catch {
    draftStatus.value = 'PNG 导出失败';
  } finally {
    pngExporting.value = false;
  }
}

function downloadWorkbenchBlob(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

async function copyProjectShareLink() {
  try {
    const shareCode = createWorkbenchProjectShareCode(getWorkbenchDraftState());
    const shareUrl = createWorkbenchProjectShareLink(shareCode);
    projectShareUrl.value = shareUrl;
    try {
      await globalThis.navigator?.clipboard?.writeText?.(shareUrl);
    } catch {
      // The URL is still available on the button for manual copy and tests.
    }
    draftStatus.value = '已生成分享链接';
  } catch {
    draftStatus.value = '分享链接不可用';
  }
}

function createWorkbenchProjectShareLink(shareCode) {
  if (typeof window === 'undefined') {
    return '';
  }

  const url = new URL(window.location.href);
  const query = new URLSearchParams({
    [WORKBENCH_PROJECT_SHARE_PARAM]: shareCode,
  });
  url.hash = `#/workbench?${query.toString()}`;
  return url.toString();
}

function applySharedProjectFromUrl() {
  const shareCode = getWorkbenchProjectShareCodeFromUrl();
  if (!shareCode) {
    return false;
  }

  const draft = parseWorkbenchProjectShareCode(shareCode);
  if (!draft) {
    draftStatus.value = '分享项目无效';
    return false;
  }

  applyImportedProjectDraft(draft, '已导入分享项目');
  clearWorkbenchProjectShareCodeFromUrl();
  return true;
}

function getWorkbenchProjectShareCodeFromUrl() {
  if (typeof window === 'undefined') {
    return '';
  }

  const hash = window.location.hash ?? '';
  const queryIndex = hash.indexOf('?');
  if (queryIndex === -1) {
    return '';
  }

  return (
    new URLSearchParams(hash.slice(queryIndex + 1)).get(
      WORKBENCH_PROJECT_SHARE_PARAM
    ) ?? ''
  );
}

function getWorkbenchHashQueryParam(name) {
  if (typeof window === 'undefined') {
    return '';
  }
  const hash = window.location.hash ?? '';
  const queryIndex = hash.indexOf('?');
  if (queryIndex === -1) {
    return '';
  }
  return new URLSearchParams(hash.slice(queryIndex + 1)).get(name) ?? '';
}

function clearWorkbenchProjectShareCodeFromUrl() {
  clearWorkbenchHashQueryParam(WORKBENCH_PROJECT_SHARE_PARAM);
}

function clearWorkbenchHashQueryParam(name) {
  if (
    typeof window === 'undefined' ||
    typeof window.history?.replaceState !== 'function'
  ) {
    return;
  }

  const url = new URL(window.location.href);
  const hash = url.hash || '#/workbench';
  const queryIndex = hash.indexOf('?');
  if (queryIndex === -1) {
    return;
  }

  const routePath = hash.slice(0, queryIndex) || '#/workbench';
  const params = new URLSearchParams(hash.slice(queryIndex + 1));
  params.delete(name);
  url.hash = params.toString()
    ? `${routePath}?${params.toString()}`
    : routePath;
  window.history.replaceState(window.history.state, '', url.toString());
}

function openProjectImport() {
  projectImportInput.value?.click?.();
}

async function importProjectFile(event) {
  const input = event?.target;
  const file = input?.files?.[0] ?? null;
  if (!file) {
    return;
  }

  try {
    const isPng =
      file.type === 'image/png' ||
      String(file.name).toLowerCase().endsWith('.png') ||
      (await isPngSource(file));
    if (isPng) {
      const draft = await parseWorkbenchProjectPng(file);
      if (!draft) {
        draftStatus.value = 'PNG 中没有有效项目';
        return;
      }
      applyImportedProjectDraft(draft, '已从 PNG 导入项目');
      return;
    }

    const rawFile = await file.text();
    const draft = parseWorkbenchProjectFile(rawFile);
    if (draft) {
      applyImportedProjectDraft(draft, '已导入项目');
      return;
    }

    const runtimeSampleFile = parseWorkbenchRuntimeSampleCaptureFile(rawFile);
    if (!runtimeSampleFile) {
      draftStatus.value = '导入失败';
      return;
    }
    await ensureRuntimeDiagnosticsLoaded();
    applyImportedRuntimeSampleCaptures(runtimeSampleFile.captures);
  } catch {
    draftStatus.value = '导入失败';
  } finally {
    if (input) {
      input.value = '';
    }
  }
}

function applyImportedRuntimeSampleCaptures(captures) {
  const binding = bindWorkbenchRuntimeSampleCaptures({
    captures,
    project: project.value,
    selectedActionId: selectedActionId.value,
  });
  if (
    binding.summary.boundCaptureCount === 0 ||
    binding.summary.rejectedCaptureCount > 0
  ) {
    draftStatus.value = '实测绑定失败';
    return;
  }

  const runtimeReviewState = captureActionMutationRuntimeReviewState();
  recordWorkbenchHistorySnapshot();
  runtimeSampleCaptures.value = mergeWorkbenchRuntimeSampleCaptures(
    runtimeSampleCaptures.value,
    binding.captures
  );
  projectShareUrl.value = '';
  clearWorkbenchProjectTransientState();
  applyActionMutationRuntimeSyncRequest({
    fallbackActionId: selectedActionId.value,
    runtimeReviewState,
    affectedActionIds: binding.summary.actionIds,
  });

  const snapshot = saveWorkbenchDraft(
    getLocalStorage(),
    getWorkbenchDraftState()
  );
  const statusText = `已导入实测 ${binding.summary.boundCaptureCount} 组`;
  draftStatus.value = snapshot ? statusText : `${statusText}（未持久化）`;
}

function applyImportedProjectDraft(draft, statusText = '已导入项目') {
  clearSegmentSplitPreview();
  projectShareUrl.value = '';
  applyDraftState(draft);
  clearWorkbenchProjectTransientState();
  undoHistoryStack.value = [];
  redoHistoryStack.value = [];
  const snapshot = saveWorkbenchDraft(getLocalStorage(), draft);
  draftStatus.value = snapshot ? statusText : `${statusText}（未持久化）`;
  if (draft.runtimeSampleCaptures?.length) {
    void ensureRuntimeDiagnosticsLoaded();
  }
}

function resetDraft() {
  recordWorkbenchHistorySnapshot();
  clearWorkbenchDraft(getLocalStorage());
  projectShareUrl.value = '';
  applyDraftState(createDefaultWorkbenchDraftState());
  clearWorkbenchProjectTransientState();
  clearSegmentSplitPreview();
  draftStatus.value = '已重置草稿';
}

function applyDraftState(draft) {
  teamSlots.value = normalizeWorkbenchTeamSlots(
    draft.teamSlots,
    draft.selection
  );
  selection.value = normalizeWorkbenchSelection(
    draft.selection,
    teamSlots.value
  );
  actorConfigs.value = normalizeWorkbenchActorConfigs(
    draft.actorConfigs,
    selection.value
  );
  enemyConfig.value = normalizeWorkbenchEnemyConfig(draft.enemyConfig);
  segmentSplitOptions.value = normalizeWorkbenchSegmentSplitOptions(
    draft.segmentSplitOptions
  );
  actionDrafts.value = normalizeWorkbenchActionDrafts(
    draft.actionDrafts,
    selection.value
  );
  actionRelations.value = normalizeWorkbenchActionRelations(
    draft.actionRelations,
    actionDrafts.value
  );
  runtimeSampleCaptures.value = normalizeWorkbenchRuntimeSampleCaptures(
    draft.runtimeSampleCaptures
  );
  setWorkbenchActionSelection(
    [draft.selectedActionId],
    draft.selectedActionId,
    { anchorActionId: draft.selectedActionId }
  );
  syncActionLibraryCharacterIdFromDraft(
    actionDrafts.value.find(action => action.id === draft.selectedActionId)
  );
  clearActionEditSource();
  clearActionEditFocus();
}

function clearWorkbenchProjectTransientState() {
  selectedStateCurvePointId.value = '';
  stateCurveFocusMode.value = 'all';
  stateCurveLayerFilters.value = { ...DEFAULT_STATE_CURVE_LAYER_FILTERS };
  stateCurveTrackFilters.value = {};
  calculatorDiagnosticScope.value = '';
  calculatorDiagnosticFocus.value = { scope: '', sequence: 0 };
  runtimeLogFocus.value = { source: '', statePointId: '', sequence: 0 };
  workbenchFlowDispatchState.value = createEmptyWorkbenchFlowDispatchState();
  selectedActionRelationId.value = '';
  boxSelectionMode.value = false;
  actionClipboard.value = null;
  closeActionContextMenu();
}

function markDraftDirty() {
  projectShareUrl.value = '';
  draftStatus.value = '有未保存改动';
}

function recordWorkbenchHistorySnapshot() {
  const snapshot = createWorkbenchHistorySnapshot();
  const previousSnapshot =
    undoHistoryStack.value[undoHistoryStack.value.length - 1] ?? null;
  if (areWorkbenchHistorySnapshotsEqual(previousSnapshot, snapshot)) {
    return;
  }
  undoHistoryStack.value = [
    ...undoHistoryStack.value.slice(1 - WORKBENCH_HISTORY_LIMIT),
    snapshot,
  ];
  redoHistoryStack.value = [];
}

function undoWorkbenchEdit() {
  if (!undoHistoryStack.value.length) {
    return;
  }
  const currentSnapshot = createWorkbenchHistorySnapshot();
  const previousSnapshot =
    undoHistoryStack.value[undoHistoryStack.value.length - 1];
  undoHistoryStack.value = undoHistoryStack.value.slice(0, -1);
  redoHistoryStack.value = [
    ...redoHistoryStack.value.slice(1 - WORKBENCH_HISTORY_LIMIT),
    currentSnapshot,
  ];
  applyWorkbenchHistorySnapshot(previousSnapshot, '已撤销编辑');
}

function redoWorkbenchEdit() {
  if (!redoHistoryStack.value.length) {
    return;
  }
  const currentSnapshot = createWorkbenchHistorySnapshot();
  const nextSnapshot =
    redoHistoryStack.value[redoHistoryStack.value.length - 1];
  redoHistoryStack.value = redoHistoryStack.value.slice(0, -1);
  undoHistoryStack.value = [
    ...undoHistoryStack.value.slice(1 - WORKBENCH_HISTORY_LIMIT),
    currentSnapshot,
  ];
  applyWorkbenchHistorySnapshot(nextSnapshot, '已重做编辑');
}

function handleWorkbenchKeyboardShortcut(event) {
  if (
    !workbenchRoot.value?.isConnected ||
    event.defaultPrevented ||
    isWorkbenchKeyboardShortcutTargetEditable(event.target)
  ) {
    return;
  }

  if (handleRuntimeNavigationKeyboardShortcut(event)) {
    return;
  }

  const key = String(event.key ?? '').toLowerCase();
  if (!(event.ctrlKey || event.metaKey) && !event.altKey) {
    if (['delete', 'backspace'].includes(key)) {
      event.preventDefault();
      if (selectedActionRelationId.value) {
        deleteActionRelation(selectedActionRelationId.value);
      } else {
        deleteSelectedActions();
      }
      return;
    }
    if (['arrowleft', 'arrowright'].includes(key)) {
      event.preventDefault();
      shiftSelectedActions({
        offsetMs:
          (key === 'arrowleft' ? -1 : 1) * frameToMs(event.shiftKey ? 4 : 1),
      });
      return;
    }
  }

  if (!(event.ctrlKey || event.metaKey) || event.altKey) {
    return;
  }

  if (key === 'z') {
    event.preventDefault();
    if (event.shiftKey) {
      redoWorkbenchEdit();
    } else {
      undoWorkbenchEdit();
    }
    return;
  }

  if (key === 'y') {
    event.preventDefault();
    redoWorkbenchEdit();
    return;
  }

  if (key === 'b' && !event.shiftKey) {
    event.preventDefault();
    toggleBoxSelectionMode();
    return;
  }

  if (key === 'c') {
    event.preventDefault();
    copySelectedActions();
    return;
  }

  if (key === 'v') {
    event.preventDefault();
    pasteSelectedActions();
    return;
  }

  if (key === 'd' && !event.shiftKey) {
    event.preventDefault();
    copySelectedActionFromShortcut();
  }
}

function handleRuntimeNavigationKeyboardShortcut(event) {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return false;
  }

  const key = String(event.key ?? '');
  if (!['ArrowLeft', 'ArrowRight'].includes(key)) {
    return false;
  }

  const runtimeNavigation = workbenchFlowModel.value.runtimeNavigation ?? {};
  if (!runtimeNavigation.count) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation?.();

  const targetPoint =
    key === 'ArrowLeft' ? runtimeNavigation.previous : runtimeNavigation.next;
  if (!targetPoint?.statePointId) {
    return true;
  }

  dispatchWorkbenchFlowAction(
    mainFlowCommandSurface.value.createRuntimeStatePointFlowAction({
      source: WORKBENCH_RUNTIME_NAVIGATION_SHORTCUT_SOURCE,
      detail: targetPoint,
      enabled: true,
    })
  );
  return true;
}

function copySelectedActionFromShortcut() {
  if (!selectedActionId.value) {
    return;
  }
  copyAction(selectedActionId.value);
}

function isWorkbenchKeyboardShortcutTargetEditable(target) {
  const element =
    target?.nodeType === Node.ELEMENT_NODE
      ? target
      : (target?.parentElement ?? null);
  const tagName = String(element?.tagName ?? '').toLowerCase();
  return Boolean(
    ['input', 'textarea', 'select'].includes(tagName) ||
    element?.isContentEditable ||
    element?.closest?.('[contenteditable="true"], [role="textbox"]')
  );
}

function createWorkbenchHistorySnapshot() {
  const draftSnapshot = createWorkbenchDraftSnapshot(
    {
      selection: selection.value,
      teamSlots: teamSlots.value,
      actorConfigs: actorConfigs.value,
      enemyConfig: enemyConfig.value,
      segmentSplitOptions: segmentSplitOptions.value,
      actionDrafts: actionDrafts.value,
      actionRelations: actionRelations.value,
      runtimeSampleCaptures: runtimeSampleCaptures.value,
      selectedActionId: selectedActionId.value,
    },
    null
  );
  return cloneWorkbenchHistoryValue({
    selection: draftSnapshot.selection,
    teamSlots: draftSnapshot.teamSlots,
    actorConfigs: draftSnapshot.actorConfigs,
    enemyConfig: draftSnapshot.enemyConfig,
    segmentSplitOptions: draftSnapshot.segmentSplitOptions,
    actionDrafts: draftSnapshot.actionDrafts,
    actionRelations: draftSnapshot.actionRelations,
    runtimeSampleCaptures: draftSnapshot.runtimeSampleCaptures,
    selectedActionId: draftSnapshot.selectedActionId,
    selectedActionIds: selectedActionIds.value,
    actionSelectionAnchorId: actionSelectionAnchorId.value,
    selectedActionRelationId: selectedActionRelationId.value,
    boxSelectionMode: boxSelectionMode.value,
    selectedStateCurvePointId: selectedStateCurvePointId.value,
    stateCurveFocusMode: stateCurveFocusMode.value,
    stateCurveLayerFilters: stateCurveLayerFilters.value,
    stateCurveTrackFilters: stateCurveTrackFilters.value,
    calculatorDiagnosticScope: calculatorDiagnosticScope.value,
    runtimeLogFocus: runtimeLogFocus.value,
    actionLibraryCharacterId: actionLibraryCharacterId.value,
    actionEditSource: actionEditSource.value,
    actionEditFocus: actionEditFocus.value,
    workbenchFlowDispatchState: workbenchFlowDispatchState.value,
  });
}

function applyWorkbenchHistorySnapshot(snapshot, status) {
  if (!snapshot) {
    return;
  }
  teamSlots.value = normalizeWorkbenchTeamSlots(
    snapshot.teamSlots,
    snapshot.selection
  );
  selection.value = normalizeWorkbenchSelection(
    snapshot.selection,
    teamSlots.value
  );
  actorConfigs.value = normalizeWorkbenchActorConfigs(
    snapshot.actorConfigs,
    selection.value
  );
  enemyConfig.value = normalizeWorkbenchEnemyConfig(snapshot.enemyConfig);
  segmentSplitOptions.value = normalizeWorkbenchSegmentSplitOptions(
    snapshot.segmentSplitOptions
  );
  actionDrafts.value = normalizeWorkbenchActionDrafts(
    snapshot.actionDrafts,
    selection.value
  );
  actionRelations.value = normalizeWorkbenchActionRelations(
    snapshot.actionRelations,
    actionDrafts.value
  );
  runtimeSampleCaptures.value = normalizeWorkbenchRuntimeSampleCaptures(
    snapshot.runtimeSampleCaptures
  );
  const restoredActionSelection = normalizeWorkbenchActionSelection(
    actionDrafts.value,
    snapshot.selectedActionIds ?? [snapshot.selectedActionId],
    snapshot.selectedActionId
  );
  setWorkbenchActionSelection(
    restoredActionSelection.selectedActionIds,
    restoredActionSelection.primaryActionId,
    {
      anchorActionId: restoredActionSelection.selectedActionIds.includes(
        snapshot.actionSelectionAnchorId
      )
        ? snapshot.actionSelectionAnchorId
        : restoredActionSelection.primaryActionId,
    }
  );
  selectedActionRelationId.value = actionRelations.value.some(
    relation => relation.id === snapshot.selectedActionRelationId
  )
    ? snapshot.selectedActionRelationId
    : '';
  boxSelectionMode.value = Boolean(snapshot.boxSelectionMode);
  selectedStateCurvePointId.value = snapshot.selectedStateCurvePointId ?? '';
  stateCurveFocusMode.value = snapshot.stateCurveFocusMode || 'all';
  stateCurveLayerFilters.value = {
    ...DEFAULT_STATE_CURVE_LAYER_FILTERS,
    ...(snapshot.stateCurveLayerFilters ?? {}),
  };
  stateCurveTrackFilters.value = { ...(snapshot.stateCurveTrackFilters ?? {}) };
  calculatorDiagnosticScope.value = snapshot.calculatorDiagnosticScope ?? '';
  runtimeLogFocus.value = {
    source: '',
    statePointId: '',
    sequence: 0,
    ...(snapshot.runtimeLogFocus ?? {}),
  };
  actionEditSource.value =
    cloneWorkbenchHistoryValue(snapshot.actionEditSource) ??
    createEmptyWorkbenchActionEditSource();
  actionEditFocus.value =
    cloneWorkbenchHistoryValue(snapshot.actionEditFocus) ??
    createEmptyWorkbenchActionEditFocus();
  workbenchFlowDispatchState.value =
    cloneWorkbenchHistoryValue(snapshot.workbenchFlowDispatchState) ??
    createEmptyWorkbenchFlowDispatchState();
  actionLibraryCharacterId.value =
    snapshot.actionLibraryCharacterId ?? selection.value.characterId;
  syncActionLibraryCharacterIdFromDraft(
    actionDrafts.value.find(action => action.id === selectedActionId.value)
  );
  clearSegmentSplitPreview();
  projectShareUrl.value = '';
  draftStatus.value = status;
}

function areWorkbenchHistorySnapshotsEqual(left, right) {
  if (!left || !right) {
    return false;
  }
  return JSON.stringify(left) === JSON.stringify(right);
}

function cloneWorkbenchHistoryValue(value) {
  if (value == null) {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
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
  actionEditSource.value = createEmptyWorkbenchActionEditSource(
    actionEditSource.value.sequence + 1
  );
}

function clearActionEditFocus() {
  actionEditFocus.value = createEmptyWorkbenchActionEditFocus(
    actionEditFocus.value.sequence + 1
  );
}

function recordActionEditSource(
  actionId,
  patch = {},
  { previousAction = null, nextAction = null, focus = null } = {}
) {
  const nextSource = createWorkbenchActionEditSource({
    actionId,
    patch,
    previousAction,
    nextAction,
    previousSource: actionEditSource.value,
    focus: focus ?? actionEditFocus.value,
    resolveSkillName: resolveActionEditSkillName,
    resolveCharacterName: resolveActionEditCharacterName,
  });
  if (!nextSource) {
    return;
  }

  actionEditSource.value = nextSource;
}

function captureActionEditSourceFocus(actionId) {
  if (isRuntimeActionEditFocusForAction(actionEditFocus.value, actionId)) {
    return actionEditFocus.value;
  }

  const detail = runtimeSelectedDetail.value;
  if (!actionId || detail?.actionId !== actionId || !detail?.statePointId) {
    return actionEditFocus.value;
  }

  return {
    ...createEmptyWorkbenchActionEditFocus(actionEditFocus.value.sequence),
    actionId,
    fieldKey: 'startMs',
    label: '结果定位',
    changeSummary: [detail.frameLabel, detail.trackLabel || detail.trackKey]
      .filter(Boolean)
      .join(' · '),
    editOrigin: 'runtime-focus',
    focusSource: runtimeFocusSource.value || 'runtime-result',
    originStatePointId: detail.statePointId,
    originTrackKey: detail.trackKey ?? '',
    originTrackLabel: detail.trackLabel ?? '',
    originFrameLabel: detail.frameLabel ?? '',
  };
}

function isRuntimeActionEditFocusForAction(focus, actionId) {
  return Boolean(
    actionId &&
    focus?.actionId === actionId &&
    focus.editOrigin === 'runtime-focus'
  );
}

function resolveActionEditSkillName(skillId) {
  return findSkillById(skillId)?.name ?? String(skillId);
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

function selectAction(actionRequest, { syncRuntimeResult = true } = {}) {
  clearSegmentSplitPreview();
  selectedActionRelationId.value = '';
  const request =
    actionRequest && typeof actionRequest === 'object'
      ? actionRequest
      : { actionId: actionRequest, mode: 'replace' };
  const actionId = String(request.actionId ?? '');
  if (!findActionDraftById(actionId)) {
    return;
  }

  const mode = request.mode ?? 'replace';
  let nextActionIds = [actionId];
  if (mode === 'range') {
    nextActionIds = createWorkbenchActionSelectionRange(
      actionDrafts.value,
      actionSelectionAnchorId.value,
      actionId
    );
  } else if (mode === 'toggle') {
    const selectedActionIdSet = new Set(selectedActionIds.value);
    if (selectedActionIdSet.has(actionId) && selectedActionIdSet.size > 1) {
      selectedActionIdSet.delete(actionId);
    } else {
      selectedActionIdSet.add(actionId);
    }
    nextActionIds = [...selectedActionIdSet];
  }

  const normalized = setWorkbenchActionSelection(nextActionIds, actionId, {
    anchorActionId: mode === 'range' ? actionSelectionAnchorId.value : actionId,
  });
  const draft = findActionDraftById(normalized.primaryActionId);
  syncActionLibraryCharacterIdFromDraft(draft);
  if (syncRuntimeResult && shouldSyncRuntimeResultOnActionSelect()) {
    syncRuntimeResultForSelectedAction(normalized.primaryActionId);
  }
}

function selectActionGroup({
  actionIds = [],
  primaryActionId = actionIds[actionIds.length - 1] ?? '',
  mode = 'replace',
} = {}) {
  const requestedActionIds =
    mode === 'append'
      ? [...new Set([...selectedActionIds.value, ...actionIds])]
      : actionIds;
  const normalized = setWorkbenchActionSelection(
    requestedActionIds,
    primaryActionId,
    { anchorActionId: primaryActionId }
  );
  selectedActionRelationId.value = '';
  const draft = findActionDraftById(normalized.primaryActionId);
  syncActionLibraryCharacterIdFromDraft(draft);
  if (shouldSyncRuntimeResultOnActionSelect()) {
    syncRuntimeResultForSelectedAction(normalized.primaryActionId);
  }
  return normalized;
}

function createRelationsForSelectedActions({
  actionIds = selectedActionIds.value,
} = {}) {
  const result = createWorkbenchActionRelationChain(
    actionRelations.value,
    actionDrafts.value,
    actionIds,
    usedRelationIds =>
      createNextWorkbenchActionRelationIdFromUsedIds(usedRelationIds)
  );
  if (result.createdRelations.length === 0) {
    return false;
  }

  recordWorkbenchHistorySnapshot();
  actionRelations.value = result.relations;
  selectedActionRelationId.value =
    result.createdRelations[result.createdRelations.length - 1].id;
  markDraftDirty();
  return true;
}

function selectActionRelation(relationRequest) {
  const relationId =
    typeof relationRequest === 'object'
      ? relationRequest?.relationId
      : relationRequest;
  const relation = actionRelations.value.find(item => item.id === relationId);
  if (!relation) {
    return false;
  }

  selectedActionRelationId.value = relation.id;
  boxSelectionMode.value = false;
  setWorkbenchActionSelection(
    [relation.fromActionId, relation.toActionId],
    relation.toActionId,
    { anchorActionId: relation.fromActionId }
  );
  syncActionLibraryCharacterIdFromDraft(
    findActionDraftById(relation.toActionId)
  );
  return true;
}

function deleteActionRelation(relationId = selectedActionRelationId.value) {
  if (!actionRelations.value.some(relation => relation.id === relationId)) {
    return false;
  }
  recordWorkbenchHistorySnapshot();
  actionRelations.value = actionRelations.value.filter(
    relation => relation.id !== relationId
  );
  selectedActionRelationId.value = '';
  markDraftDirty();
  return true;
}

function toggleBoxSelectionMode() {
  boxSelectionMode.value = !boxSelectionMode.value;
  if (boxSelectionMode.value) {
    selectedActionRelationId.value = '';
    closeActionContextMenu();
  }
}

function setWorkbenchActionSelection(
  actionIds,
  primaryActionId,
  { anchorActionId = primaryActionId } = {}
) {
  const normalized = normalizeWorkbenchActionSelection(
    actionDrafts.value,
    actionIds,
    primaryActionId
  );
  selectedActionIds.value = normalized.selectedActionIds;
  selectedActionId.value = normalized.primaryActionId;
  actionSelectionAnchorId.value = normalized.selectedActionIds.includes(
    anchorActionId
  )
    ? anchorActionId
    : normalized.primaryActionId;
  return normalized;
}

function openActionContextMenu({
  actionId = '',
  x = 0,
  y = 0,
  targetStartMs = undefined,
} = {}) {
  if (actionId && !selectedActionIds.value.includes(actionId)) {
    selectAction(actionId);
  }
  actionContextMenu.value = {
    kind: 'actions',
    visible: true,
    x: Number(x) || 0,
    y: Number(y) || 0,
    targetStartMs,
  };
}

function openActionRelationContextMenu({ relationId = '', x = 0, y = 0 } = {}) {
  if (!selectActionRelation(relationId)) {
    return;
  }
  actionContextMenu.value = {
    kind: 'relation',
    visible: true,
    x: Number(x) || 0,
    y: Number(y) || 0,
    targetStartMs: undefined,
  };
}

function closeActionContextMenu() {
  actionContextMenu.value = createClosedActionContextMenu();
}

function createClosedActionContextMenu() {
  return {
    kind: 'actions',
    visible: false,
    x: 0,
    y: 0,
    targetStartMs: undefined,
  };
}

function editEffectSourceAction(actionId) {
  if (!findActionDraftById(actionId)) {
    return;
  }
  selectAction(actionId, { syncRuntimeResult: false });
  void nextTick().then(() => {
    workbenchRoot.value
      ?.querySelector?.('[data-inspector-panel-key="properties"]')
      ?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  });
}

function locateActionRuleDiagnostic(diagnostic) {
  const actionId = diagnostic?.actionId;
  if (!findActionDraftById(actionId)) {
    return;
  }
  selectAction(actionId, { syncRuntimeResult: false });
  actionEditFocus.value = {
    ...createEmptyWorkbenchActionEditFocus(actionEditFocus.value.sequence + 1),
    actionId,
    fieldKey: diagnostic.editFieldKey || 'startMs',
    label: '排轴规则',
    changeSummary: diagnostic.message ?? '',
    editOrigin: 'rule-diagnostic',
    focusSource: 'action-rule-diagnostic',
  };
  void nextTick().then(() => {
    scrollActionEditFocusIntoView();
  });
}

function applyActionRuleSuggestedStart(diagnostic) {
  if (!Number.isFinite(Number(diagnostic?.suggestedStartMs))) {
    return;
  }
  locateActionRuleDiagnostic(diagnostic);
  updateAction({ startMs: Number(diagnostic.suggestedStartMs) });
}

function applyActionSelectionState(selectionState = {}) {
  if (!selectionState.shouldSelectAction) {
    return;
  }
  if (selectedActionIds.value.includes(selectionState.actionId)) {
    setWorkbenchActionSelection(
      selectedActionIds.value,
      selectionState.actionId,
      { anchorActionId: actionSelectionAnchorId.value }
    );
    syncActionLibraryCharacterIdFromDraft(
      findActionDraftById(selectionState.actionId)
    );
    if (selectionState.syncRuntimeResult) {
      syncRuntimeResultForSelectedAction(selectionState.actionId);
    }
    return;
  }
  selectAction(selectionState.actionId, {
    syncRuntimeResult: selectionState.syncRuntimeResult ?? false,
  });
}

function applyActionEditState(editState = {}) {
  applyActionSelectionState(editState.actionSelection);
  actionEditFocus.value = { ...(editState.actionEditFocus ?? {}) };
}

function applyActionMutationRuntimeSyncState(syncState = {}) {
  if (!syncState.actionId) {
    return;
  }
  syncRuntimeResultForSelectedAction(syncState.actionId);
}

function applyActionMutationRuntimeSyncRequest(options = {}) {
  workbenchFlowRuntime.applyActionMutationRuntimeSync(
    createWorkbenchActionMutationRuntimeSyncRequest(options)
  );
}

function captureActionMutationRuntimeReviewState() {
  return {
    shouldSyncRuntimeResult: shouldSyncRuntimeResultOnActionSelect(),
    selectedRuntimeActionId: getSelectedRuntimeStatePointActionId(),
  };
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
    findRuntimeStatePointContextById(runtimeOutputs.value, pointId)
  );
}

function focusRuntimeStateCurvePoint(pointId) {
  dispatchWorkbenchFlowAction(
    mainFlowActionSurface.value.createRuntimeSelectionFlowAction({
      source: 'state-curve-point',
      statePointId: pointId,
      payload: {
        preserveStateCurveFilters: true,
      },
    })
  );
}

function selectRuntimeStatePoint(pointId) {
  workbenchFlowRuntime.applyRuntimePointSelection({
    statePointId: pointId,
  });
}

function applyRuntimeViewPatch(patch = {}) {
  applyWorkbenchRuntimeViewPatch(patch, {
    setSelectedStatePointId: statePointId => {
      selectedStateCurvePointId.value = statePointId;
    },
    setStateCurveFocusMode: mode => {
      stateCurveFocusMode.value = mode;
    },
    setStateCurveLayerFilters: filters => {
      stateCurveLayerFilters.value = filters;
    },
    setStateCurveTrackFilters: filters => {
      stateCurveTrackFilters.value = filters;
    },
    setCalculatorScope: scope => {
      calculatorDiagnosticScope.value = scope;
    },
    pulseCalculatorFocus: () => {
      calculatorDiagnosticFocus.value = {
        scope: calculatorDiagnosticScope.value,
        sequence: calculatorDiagnosticFocus.value.sequence + 1,
      };
    },
    setRuntimeLogFocus: focus => {
      runtimeLogFocus.value = focus;
    },
    selectRuntimeActionStatePoint: statePointId => {
      selectActionFromRuntimeStatePoint(statePointId);
    },
    selectRuntimeStatePoint: statePointId => {
      selectRuntimeStatePoint(statePointId);
    },
  });
}

function dispatchWorkbenchFlowAction(action = {}) {
  if (shouldLoadRuntimeDiagnostics(action)) {
    const diagnosticsReady = ensureRuntimeDiagnosticsLoaded();
    if (diagnosticsReady instanceof Promise) {
      return diagnosticsReady.then(() =>
        dispatchWorkbenchFlowActionNow(action)
      );
    }
  }

  return dispatchWorkbenchFlowActionNow(action);
}

function dispatchWorkbenchFlowActionNow(action = {}) {
  const result = workbenchFlowController.dispatch(action);
  workbenchFlowDispatchState.value = createWorkbenchFlowDispatchState({
    result,
    previousState: workbenchFlowDispatchState.value,
  });
  scheduleActionEditFocusScroll(result);
  scheduleRuntimeSelectedDetailScroll(result);
  return result;
}

function shouldLoadRuntimeDiagnostics(action = {}) {
  return [
    WORKBENCH_FLOW_ACTION_KINDS.OPEN_RUNTIME_RESULTS,
    WORKBENCH_FLOW_ACTION_KINDS.SELECT_RUNTIME_RESULT,
    WORKBENCH_FLOW_ACTION_KINDS.SELECT_RUNTIME_STATE_POINT,
    WORKBENCH_FLOW_ACTION_KINDS.SELECT_CONTRIBUTION_POINT,
    WORKBENCH_FLOW_ACTION_KINDS.RETURN_RUNTIME_RESULT,
  ].includes(action.kind);
}

function ensureRuntimeDiagnosticsLoaded() {
  if (runtimeDiagnosticsStatus.value === 'ready') {
    return true;
  }
  if (getProjectSimulationSkillDiagnosticsStatus().loaded) {
    runtimeDiagnosticsStatus.value = 'ready';
    return true;
  }
  if (runtimeDiagnosticsLoadPromise) {
    return runtimeDiagnosticsLoadPromise;
  }

  runtimeDiagnosticsStatus.value = 'loading';
  runtimeDiagnosticsLoadPromise =
    import('../simulation/projection/workbenchSkillDiagnosticsLoader')
      .then(({ getWorkbenchSkillDiagnostics }) => {
        installProjectSimulationSkillDiagnostics(
          getWorkbenchSkillDiagnostics()
        );
        runtimeDiagnosticsStatus.value = 'ready';
        runtimeDiagnosticsRevision.value += 1;
        return true;
      })
      .catch(() => {
        runtimeDiagnosticsStatus.value = 'failed';
        return false;
      })
      .finally(() => {
        runtimeDiagnosticsLoadPromise = null;
      });
  return runtimeDiagnosticsLoadPromise;
}

function scheduleActionEditFocusScroll(result = {}) {
  if (!shouldScrollActionEditFocusIntoView(result)) {
    return;
  }
  void nextTick().then(() => {
    scrollActionEditFocusIntoView();
  });
}

function shouldScrollActionEditFocusIntoView(result = {}) {
  if (!result.handled) {
    return false;
  }
  return [
    WORKBENCH_FLOW_ACTION_KINDS.FOCUS_RUNTIME_ACTION,
    WORKBENCH_FLOW_ACTION_KINDS.FOCUS_EDIT_SOURCE,
  ].includes(result.kind);
}

function scheduleRuntimeSelectedDetailScroll(result = {}) {
  if (!shouldScrollRuntimeSelectedDetailIntoView(result)) {
    return;
  }
  void nextTick().then(() => {
    scrollRuntimeSelectedDetailIntoView();
  });
}

function shouldScrollRuntimeSelectedDetailIntoView(result = {}) {
  if (!result.handled) {
    return false;
  }
  return [
    WORKBENCH_FLOW_ACTION_KINDS.OPEN_RUNTIME_RESULTS,
    WORKBENCH_FLOW_ACTION_KINDS.SELECT_RUNTIME_RESULT,
    WORKBENCH_FLOW_ACTION_KINDS.SELECT_RUNTIME_STATE_POINT,
    WORKBENCH_FLOW_ACTION_KINDS.SELECT_CONTRIBUTION_POINT,
    WORKBENCH_FLOW_ACTION_KINDS.RETURN_RUNTIME_RESULT,
  ].includes(result.kind);
}

function scrollRuntimeSelectedDetailIntoView() {
  if (typeof document === 'undefined') {
    return;
  }
  document
    .querySelector('[data-testid="workbench-runtime-selected-detail"]')
    ?.scrollIntoView?.({
      block: 'nearest',
      inline: 'nearest',
    });
}

function scrollActionEditFocusIntoView() {
  if (typeof document === 'undefined') {
    return;
  }
  const target = getActionEditFocusScrollTarget(actionEditFocus.value);
  target?.scrollIntoView?.({
    block: 'center',
    inline: 'nearest',
  });
}

function getActionEditFocusScrollTarget(focus = {}) {
  const fieldKey = normalizeActionEditScrollField(focus.fieldKey);
  const selectors = [
    '[data-testid="workbench-action-edit-control"][data-edit-focused="true"]',
  ];
  if (fieldKey) {
    selectors.unshift(
      `[data-testid="workbench-action-edit-control"][data-edit-field="${fieldKey}"]`
    );
  }
  if (fieldKey === 'startMs' || fieldKey === 'durationMs') {
    selectors.unshift(
      `[data-testid="workbench-action-frame-control"][data-edit-field="${fieldKey}"]`
    );
  }
  return selectors
    .map(selector => document.querySelector(selector))
    .find(Boolean);
}

function normalizeActionEditScrollField(fieldKey) {
  if (fieldKey === 'damageSegmentIndex') {
    return 'actionVariantIndex';
  }
  if (fieldKey === 'laneId') {
    return 'actorCharacterId';
  }
  return fieldKey || '';
}

function dispatchRuntimeReviewPrimaryOperation() {
  dispatchWorkbenchFlowAction(
    runtimeReviewPrimaryOperationCommand.value.action
  );
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
  workbenchFlowRuntime.applyCalculatorScope({
    scope,
    selectFirstRuntimePoint,
  });
}

function getFirstRuntimeStatePointId(runtimeProjection) {
  return (
    createRuntimeStatePointContexts(runtimeProjection)[0]?.statePointId ?? ''
  );
}

function selectActionFromRuntimeStatePoint(pointId) {
  const context = findRuntimeStatePointContextById(
    runtimeOutputs.value,
    pointId
  );
  const actionId = context?.row?.actionId;
  if (!actionId || !findActionDraftById(actionId)) {
    return;
  }
  if (selectedActionIds.value.includes(actionId)) {
    setWorkbenchActionSelection(selectedActionIds.value, actionId, {
      anchorActionId: actionSelectionAnchorId.value,
    });
    syncActionLibraryCharacterIdFromDraft(findActionDraftById(actionId));
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
      runtimeOutputs.value,
      selectedStateCurvePointId.value
    )
  );
}

function getSelectedRuntimeStatePointActionId() {
  return (
    findRuntimeStatePointContextById(
      runtimeOutputs.value,
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

function createRuntimeActionResultMap(runtimeProjection) {
  return createRuntimeStatePointContexts(runtimeProjection).reduce(
    (resultMap, context) => {
      const actionId = context?.row?.actionId ?? context?.actionId ?? '';
      const statePointId =
        context?.statePointId ?? context?.runtimeStatePointId ?? '';
      if (!actionId || !statePointId || resultMap[actionId]) {
        return resultMap;
      }

      resultMap[actionId] = {
        actionId,
        statePointId,
      };
      return resultMap;
    },
    {}
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

function createCopiedGenerationBatch(sourceBatch, actionCount) {
  const baseBatch =
    sourceBatch && typeof sourceBatch === 'object' ? sourceBatch : {};
  return {
    ...baseBatch,
    batchId: createNextSegmentBatchId(),
    source: 'batch-copy',
    copiedFromBatchId: String(baseBatch.batchId ?? ''),
    variantCount: actionCount,
    segmentCount: actionCount,
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
  return createNextActionIdFromUsedIds(
    new Set(actionDrafts.value.map(action => action.id))
  );
}

function createNextActionIdFromUsedIds(usedActionIds) {
  const maxIndex = [...usedActionIds].reduce((max, actionId) => {
    const match = String(actionId).match(/^action-(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const nextActionId = `action-${String(maxIndex + 1).padStart(4, '0')}`;
  usedActionIds.add(nextActionId);
  return nextActionId;
}

function addInsertedAction(actionPatch, options = {}) {
  const runtimeReviewState = captureActionMutationRuntimeReviewState();
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
  recordWorkbenchHistorySnapshot();
  actionDrafts.value = [
    ...actionDrafts.value.slice(0, placement.insertIndex),
    nextAction,
    ...actionDrafts.value.slice(placement.insertIndex),
  ];
  selectedActionId.value = nextAction.id;
  applyActionMutationRuntimeSyncRequest({
    actionId: nextAction.id,
    runtimeReviewState,
    selectedActionChanged: true,
    affectedActionIds: [nextAction.id],
  });
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
  const previousActionLibraryCharacterId = Number(
    actionLibraryCharacterId.value
  );
  if (
    changes.characterChanged &&
    previousActionLibraryCharacterId === Number(previousSelection.characterId)
  ) {
    actionLibraryCharacterId.value = nextSelection.characterId;
  } else if (
    changes.secondaryCharacterChanged &&
    previousActionLibraryCharacterId ===
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

function createSideInspectorPanelOrders(inspectorMode) {
  if (inspectorMode === 'runtime-detail') {
    return {
      runtimeDetail: 0,
      actionRules: 1,
      properties: 2,
      enemy: 3,
      teamLoadout: 4,
      analysis: 5,
    };
  }

  return {
    properties: 0,
    actionRules: 1,
    enemy: 2,
    runtimeDetail: 3,
    teamLoadout: 4,
    analysis: 5,
  };
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

.workbench-brand {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #d9dee3;
  font-weight: 700;
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

.nav-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
  filter: none;
}

.button-icon {
  width: 14px;
  height: 14px;
}

.project-import-input {
  display: none;
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

.primary-flow:is(
    [data-flow-phase='runtime-result'],
    [data-flow-phase='edit-result-review']
  )
  .runtime-review-stack {
  order: -1;
}

.primary-flow:is(
    [data-flow-phase='runtime-result'],
    [data-flow-phase='edit-result-review']
  )
  .timeline-area {
  order: 1;
}

.runtime-review-stack[data-runtime-review-layout='result-check'] {
  grid-template-columns: minmax(300px, 1.12fr) minmax(220px, 0.88fr);
  align-items: stretch;
  gap: 10px;
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
.event-area,
.effect-area {
  min-width: 0;
}

.effect-area {
  grid-column: 1 / -1;
}

.runtime-review-stack[data-runtime-review-layout='result-check']
  .resource-monitor-panel,
.runtime-review-stack[data-runtime-review-layout='result-check']
  .event-log-panel {
  height: 100%;
}

.runtime-review-stack[data-runtime-review-layout='result-check'] .event-area {
  align-self: stretch;
}

.side-stack {
  grid-area: inspector;
  display: grid;
  align-content: start;
  gap: 14px;
}

.png-export-surface {
  position: fixed;
  top: 0;
  left: -20000px;
  z-index: -1000;
  width: 1600px;
  padding: 24px;
  pointer-events: none;
  color: #ffffff;
  background: #14181d;
}

.png-export-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 32px;
  padding: 0 4px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.png-export-header span,
.png-export-header dt {
  color: #79c7b9;
  font-size: 12px;
  font-weight: 700;
}

.png-export-header h2 {
  margin: 5px 0 0;
  font-size: 24px;
  line-height: 1.25;
}

.png-export-header dl {
  display: grid;
  grid-template-columns: repeat(4, minmax(90px, auto));
  gap: 18px;
  margin: 0;
}

.png-export-header dl div {
  display: grid;
  gap: 4px;
}

.png-export-header dd {
  margin: 0;
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
}

.png-export-timeline {
  margin-top: 20px;
}

.png-export-surface :deep(.timeline-tools),
.png-export-surface :deep(.candidate-toggle-group),
.png-export-surface :deep(.candidate-scope-group),
.png-export-surface :deep(.action-result-edit-button),
.png-export-surface :deep(.timeline-action-result-edit-button),
.png-export-surface :deep(.resize-handle) {
  display: none;
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

  .runtime-review-stack[data-runtime-review-layout='result-check'] {
    grid-template-columns: 1fr;
  }
}
</style>
