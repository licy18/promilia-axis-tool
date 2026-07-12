<template>
  <main
    ref="workbenchRoot"
    class="workbench"
    :data-timeline-cursor-frame-index="timelineCursorFrameIndex"
    :data-timeline-playback-running="timelinePlaybackRunning ? 'true' : 'false'"
    :data-timeline-playback-rate="timelinePlaybackRate"
    :data-timeline-playback-range-mode="timelinePlaybackRange.mode"
    :data-timeline-playback-range-start-frame="timelinePlaybackRange.startFrame"
    :data-timeline-playback-range-end-frame="timelinePlaybackRange.endFrame"
    :data-runtime-diagnostics-status="runtimeDiagnosticsStatus"
    :data-runtime-diagnostics-revision="runtimeDiagnosticsRevision"
    :data-selected-action-count="selectedActionIds.length"
    :data-action-relation-count="actionRelations.length"
    :data-selected-action-relation-id="selectedActionRelationId"
    :data-cycle-boundary-count="cycleBoundaries.length"
    :data-selected-cycle-boundary-id="selectedCycleBoundaryId"
    :data-selected-cycle-section-id="selectedCycleSection?.sectionId || ''"
    :data-workspace-scenario-count="scenarioWorkspace.scenarios.length"
    :data-active-workspace-scenario-id="scenarioWorkspace.activeScenarioId"
    :data-workbench-layout-mode="workbenchLayout.mode"
    :data-workbench-left-panel-width="workbenchLayout.leftPanelWidth"
    :data-workbench-right-panel-width="workbenchLayout.rightPanelWidth"
    :data-workbench-left-panel-collapsed="
      workbenchLayout.leftPanelCollapsed ? 'true' : 'false'
    "
    :data-workbench-right-panel-collapsed="
      workbenchLayout.rightPanelCollapsed ? 'true' : 'false'
    "
    :data-effect-interval-count="effectIntervalProjection.summary.intervalCount"
    :data-selected-effect-interval-id="selectedEffectIntervalId"
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
            data-testid="workbench-open-comparison"
            type="button"
            @click="openScenarioComparison"
          >
            <TrendCharts class="button-icon" />
            <span>方案对比</span>
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

    <WorkbenchScenarioBar
      :workspace="scenarioWorkspace"
      :max-scenarios="MAX_WORKBENCH_SCENARIOS"
      @switch="switchWorkspaceScenario"
      @add="addWorkspaceScenario"
      @duplicate="duplicateWorkspaceScenario"
      @rename="renameWorkspaceScenario"
      @delete="deleteWorkspaceScenario"
    />

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

    <WorkbenchScenarioComparisonDialog
      v-if="comparisonDialogVisible"
      :visible="comparisonDialogVisible"
      :presets="workbenchPresets"
      :workspace-scenarios="scenarioWorkspace.scenarios"
      :active-workspace-scenario-id="scenarioWorkspace.activeScenarioId"
      :baseline-source="comparisonBaselineSource"
      :comparison="scenarioComparison"
      @close="closeScenarioComparison"
      @select-workspace-scenario="selectScenarioComparisonWorkspaceScenario"
      @select-preset="selectScenarioComparisonPreset"
      @capture-current="captureCurrentScenarioComparisonBaseline"
      @import-baseline="importScenarioComparisonBaseline"
      @select-window="selectScenarioComparisonWindow"
      @locate-action="locateScenarioComparisonAction"
      @export-report="exportScenarioComparisonAnalysisReport"
    />

    <WorkbenchAnalysisReportDialog
      v-if="analysisReportDialogVisible"
      :visible="analysisReportDialogVisible"
      :report="importedAnalysisReport"
      :validation="importedAnalysisReportValidation"
      @close="closeAnalysisReport"
      @locate-source="locateImportedAnalysisReportSource"
    />

    <WorkbenchActionContextMenu
      :mode="actionContextMenu.kind"
      :visible="actionContextMenu.visible"
      :x="actionContextMenu.x"
      :y="actionContextMenu.y"
      :selected-count="selectedActionIds.length"
      :clipboard-count="actionClipboard?.actions?.length ?? 0"
      :can-add-cycle-boundary="canAddCycleBoundaryAtContextTime"
      @close="closeActionContextMenu"
      @copy="copySelectedActions"
      @paste="
        pasteSelectedActions({ targetStartMs: actionContextMenu.targetStartMs })
      "
      @nudge-left="shiftSelectedActions({ offsetMs: -frameToMs(1) })"
      @nudge-right="shiftSelectedActions({ offsetMs: frameToMs(1) })"
      @delete="deleteSelectedActions"
      @delete-relation="deleteActionRelation(selectedActionRelationId)"
      @add-cycle-boundary="addCycleBoundary(actionContextMenu.targetStartMs)"
      @delete-cycle-boundary="deleteCycleBoundary(selectedCycleBoundaryId)"
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

    <WorkbenchLayoutBar
      :layout="workbenchLayout"
      @set-mode="setWorkbenchLayoutMode"
      @toggle-panel="toggleWorkbenchLayoutSide"
      @reset="resetWorkbenchLayout"
    />

    <div
      ref="workbenchGrid"
      class="workbench-grid"
      :class="workbenchLayoutClasses"
      :style="workbenchLayoutStyle"
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
        @add-kibo-event-action="addKiboEventAction"
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
        class="workspace-resizer workspace-resizer-left"
        :class="{
          active: activeWorkbenchLayoutResize === 'left',
        }"
        role="separator"
        aria-label="调整动作库宽度"
        aria-orientation="vertical"
        tabindex="0"
        data-testid="workbench-left-resizer"
        @pointerdown="beginWorkbenchLayoutResize('left', $event)"
        @dblclick="resetWorkbenchLayoutPanel('left')"
        @keydown.stop="handleWorkbenchLayoutResizeKey('left', $event)"
      ></div>

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
          :enemy="scenario.enemy"
          :timeline-topology="project.metadata.timelineTopology"
          :kibos="loadoutOptions.kibos"
          :actions="scenario.actions"
          :timeline-entry-catalog="timelineEntryCatalog"
          :timeline-entry-default-actor-id="actionLibraryActor.id"
          :damage-timeline="simulationResult.damageTimeline"
          :candidate-value-chart="simulationResult.candidateValueSeries.chart"
          :three-value-curve-framework="
            simulationResult.threeValueCurveFramework
          "
          :runtime-state-curves="simulationResult.runtimeOutputs.stateCurves"
          :runtime-state-point-contexts="runtimeStatePointContexts"
          :duration-ms="scenario.time.durationMs"
          :cursor-frame-index="timelineCursorFrameIndex"
          :playback-running="timelinePlaybackRunning"
          :playback-rate="timelinePlaybackRate"
          :playback-range-mode="timelinePlaybackRangeMode"
          :playback-range="timelinePlaybackRange"
          :selected-action-id="selectedActionId"
          :selected-action-ids="selectedActionIds"
          :action-relations="actionRelations"
          :selected-action-relation-id="selectedActionRelationId"
          :cycle-boundaries="cycleBoundaries"
          :selected-cycle-boundary-id="selectedCycleBoundaryId"
          :selected-cycle-section="selectedCycleSection"
          :effect-intervals="effectIntervalProjection.intervals"
          :selected-effect-interval-id="selectedEffectIntervalId"
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
          @select-effect-interval="selectEffectInterval"
          @open-action-context-menu="openActionContextMenu"
          @open-action-relation-context-menu="openActionRelationContextMenu"
          @select-cycle-boundary="selectCycleBoundary"
          @update-cycle-boundary="updateCycleBoundary"
          @open-cycle-boundary-context-menu="openCycleBoundaryContextMenu"
          @toggle-box-selection-mode="toggleBoxSelectionMode"
          @create-action-relations="createRelationsForSelectedActions"
          @select-state-curve-point="selectStateCurvePoint"
          @select-timeline-frame="selectTimelineFrame"
          @toggle-timeline-playback="toggleTimelinePlayback"
          @step-timeline-frame="stepTimelinePlaybackFrame"
          @update-playback-rate="updateTimelinePlaybackRate"
          @update-playback-range-mode="updateTimelinePlaybackRangeMode"
          @dispatch-flow-action="dispatchWorkbenchFlowAction"
          @update-state-curve-layer-filter="updateStateCurveLayerFilter"
          @update-state-curve-track-filter="updateStateCurveTrackFilter"
          @update-state-curve-focus-mode="updateStateCurveFocusMode"
          @delete-action="deleteAction"
          @update-action-duration="updateActionDuration"
          @move-selected-actions="moveSelectedActions"
          @update-action-time="updateActionTime"
          @shift-selected-actions="shiftSelectedActions"
          @delete-selected-actions="deleteSelectedActions"
          @insert-timeline-entry="insertTimelineEntry"
        />

        <WorkbenchCycleSectionPanel
          class="cycle-review-area"
          :projection="cycleSectionProjection"
          :selected-window-id="selectedCycleSectionId || 'full-axis'"
          :can-create-inherited-scenario="canCreateInheritedScenario"
          @select-window="selectContributionWindow"
          @locate-action="locateCycleSectionAction"
          @create-inherited-scenario="createInheritedScenarioFromBoundary"
          @export-report="exportContributionAnalysisReport"
        />
      </div>

      <div class="review-workspace" data-testid="workbench-review-workspace">
        <ScenarioHeader
          :project="project"
          :scenario="simulationResult.scenario"
          :summary="simulationResult.summary"
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
            :cursor-frame-index="timelineCursorFrameIndex"
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
              :selected-effect-event-id="selectedEffectEventId"
              :selected-effect-interval="selectedEffectInterval"
              @select-effect-event="selectEffectEvent"
              @edit-source-action="editEffectSourceAction"
            />
          </div>
        </div>
      </div>

      <div
        class="workspace-resizer workspace-resizer-right"
        :class="{
          active: activeWorkbenchLayoutResize === 'right',
        }"
        role="separator"
        aria-label="调整检查区宽度"
        aria-orientation="vertical"
        tabindex="0"
        data-testid="workbench-right-resizer"
        @pointerdown="beginWorkbenchLayoutResize('right', $event)"
        @dblclick="resetWorkbenchLayoutPanel('right')"
        @keydown.stop="handleWorkbenchLayoutResizeKey('right', $event)"
      ></div>

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
          :data-inspector-panel-order="sideInspectorPanelOrders.configuration"
          data-inspector-panel-key="configuration"
          data-testid="workbench-side-inspector-panel"
          :style="{ order: sideInspectorPanelOrders.configuration }"
        >
          <WorkbenchConfigurationLibraryPanel
            :library="configurationLibrary"
            :selection="configurationSelection"
            :actors="scenario.actors"
            :enemy="scenario.enemy"
            :enemy-id="selection.enemyId"
            @command="applyWorkbenchConfigurationCommand"
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

    <WorkbenchProjectDropOverlay @files="receiveDroppedWorkbenchProjectFiles" />

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
        :enemy="scenario.enemy"
        :timeline-topology="project.metadata.timelineTopology"
        :kibos="loadoutOptions.kibos"
        :actions="scenario.actions"
        :damage-timeline="simulationResult.damageTimeline"
        :candidate-value-chart="simulationResult.candidateValueSeries.chart"
        :three-value-curve-framework="simulationResult.threeValueCurveFramework"
        :runtime-state-curves="simulationResult.runtimeOutputs.stateCurves"
        :duration-ms="scenario.time.durationMs"
        :selected-action-id="selectedActionId"
        :selected-action-ids="selectedActionIds"
        :action-relations="actionRelations"
        :cycle-boundaries="cycleBoundaries"
        :effect-intervals="effectIntervalProjection.intervals"
        :timeline-diagnostics="timelineDiagnostics"
        :action-readiness-timeline="simulationResult.actionReadinessTimeline"
      />
    </section>
  </main>
</template>

<script setup>
import {
  computed,
  defineAsyncComponent,
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
import AnalysisPanel from '../features/workbench/AnalysisPanel.vue';
import EventLogPanel from '../features/workbench/EventLogPanel.vue';
import PropertiesPanel from '../features/workbench/PropertiesPanel.vue';
import ResourceMonitorPanel from '../features/workbench/ResourceMonitorPanel.vue';
import RuntimeSelectedDetailPanel from '../features/workbench/RuntimeSelectedDetailPanel.vue';
import ScenarioHeader from '../features/workbench/ScenarioHeader.vue';
import TimelineGridPreview from '../features/workbench/TimelineGridPreview.vue';
import WorkbenchActionContextMenu from '../features/workbench/WorkbenchActionContextMenu.vue';
import WorkbenchFlowPanel from '../features/workbench/WorkbenchFlowPanel.vue';
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
  ENEMY_TIMELINE_LANE_ID,
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
  createWorkbenchTimelineBatchLaneMovePlan,
  createWorkbenchTimelineEntry,
  isWorkbenchTimelineEntryAllowedInLane,
  WORKBENCH_TIMELINE_LANE_KINDS,
} from '../domain/workbenchTimelineEntry';
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
  addWorkbenchCycleBoundary,
  normalizeWorkbenchCycleBoundaries,
  updateWorkbenchCycleBoundary,
} from '../domain/workbenchCycleBoundaries';
import {
  applyWorkbenchConfigurationInstanceCommand,
  reconcileWorkbenchConfigurationState,
  updateSelectedWorkbenchConfigurationInstance,
} from '../domain/workbenchConfigurationLibrary';
import {
  createWorkbenchGameDataCompatibilityReport,
  getWorkbenchGameDataCompatibilityReport,
  normalizeWorkbenchGameDataBinding,
} from '../domain/workbenchGameDataCatalog';
import { normalizeWorkbenchMechanicsProfileSelection } from '../domain/workbenchMechanicsProfileSelection';
import {
  createWorkbenchAnalysisReportFileName,
  createWorkbenchContributionAnalysisReport,
  createWorkbenchScenarioComparisonAnalysisReport,
} from '../domain/workbenchAnalysisReport';
import {
  clearWorkbenchDraft,
  createWorkbenchDraftSnapshot,
  createWorkbenchScenarioDraftSnapshot,
  createWorkbenchProjectFileName,
  createWorkbenchProjectFileSnapshot,
  createWorkbenchProjectShareCode,
  createDefaultWorkbenchDraftState,
  loadWorkbenchDraft,
  normalizeWorkbenchSegmentSplitOptions,
  parseWorkbenchProjectShareCode,
  saveWorkbenchDraft,
  WORKBENCH_PROJECT_SHARE_PARAM,
} from '../domain/workbenchDraftStorage';
import {
  MAX_WORKBENCH_SCENARIOS,
  addWorkbenchScenario,
  addWorkbenchScenarioFromDraft,
  deleteWorkbenchScenario,
  duplicateWorkbenchScenario,
  getActiveWorkbenchScenario,
  renameWorkbenchScenario,
  switchWorkbenchScenario,
  synchronizeActiveWorkbenchScenario,
} from '../domain/workbenchScenarioWorkspace';
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
} from '../domain/workbenchPngProject';
import {
  bindWorkbenchRuntimeSampleCaptures,
  mergeWorkbenchRuntimeSampleCaptures,
  normalizeWorkbenchRuntimeSampleCaptures,
} from '../domain/workbenchRuntimeSampleCapture';
import { formatFrameTime, frameToMs, msToFrame } from '../domain/timebase';
import { compileProject } from '../simulation/compiler/compileProject';
import { simulateScenario } from '../simulation/engine/simulateScenario';
import {
  DEFAULT_THREE_VALUE_MECHANICS_PROFILE_CATALOG,
  createWorkbenchProfileCompatibilityReport,
} from '../simulation/mechanics/threeValueMechanicsProfileCatalog';
import {
  getProjectSimulationSkillDiagnosticsStatus,
  installProjectSimulationSkillDiagnostics,
} from '../simulation/projection/projectSimulationResult';
import { projectEffectRuntimeIntervals } from '../simulation/projection/projectEffectIntervals';
import { projectCycleSections } from '../simulation/projection/projectCycleSections';
import { projectCycleBoundaryInheritance } from '../simulation/projection/projectCycleBoundaryInheritance';
import { projectWorkbenchScenarioComparison } from '../simulation/projection/projectScenarioComparison';

const WorkbenchScenarioComparisonDialog = defineAsyncComponent(
  () => import('../features/workbench/WorkbenchScenarioComparisonDialog.vue')
);
const WorkbenchAnalysisReportDialog = defineAsyncComponent(
  () => import('../features/workbench/WorkbenchAnalysisReportDialog.vue')
);
const WorkbenchPresetLibraryDialog = defineAsyncComponent(
  () => import('../features/workbench/WorkbenchPresetLibraryDialog.vue')
);
const WorkbenchScenarioBar = defineAsyncComponent(
  () => import('../features/workbench/WorkbenchScenarioBar.vue')
);
const WorkbenchCycleSectionPanel = defineAsyncComponent(
  () => import('../features/workbench/WorkbenchCycleSectionPanel.vue')
);
const WorkbenchLayoutBar = defineAsyncComponent(
  () => import('../features/workbench/WorkbenchLayoutBar.vue')
);
const WorkbenchProjectDropOverlay = defineAsyncComponent(
  () => import('../features/workbench/WorkbenchProjectDropOverlay.vue')
);
const WorkbenchConfigurationLibraryPanel = defineAsyncComponent(
  () => import('../features/workbench/WorkbenchConfigurationLibraryPanel.vue')
);
const ActionRuleDiagnosticsPanel = defineAsyncComponent(
  () => import('../features/workbench/ActionRuleDiagnosticsPanel.vue')
);
const EffectTimelinePanel = defineAsyncComponent(
  () => import('../features/workbench/EffectTimelinePanel.vue')
);
const EnemyPanel = defineAsyncComponent(
  () => import('../features/workbench/EnemyPanel.vue')
);
const TeamLoadoutPanel = defineAsyncComponent(
  () => import('../features/workbench/TeamLoadoutPanel.vue')
);

const workbenchSeed = getWorkbenchSeed();
const gameData = getWorkbenchGameData();
const loadoutOptions = getWorkbenchLoadoutOptions();
const NEW_ACTION_INSERT_GAP_MS = frameToMs(60);
const WORKBENCH_HISTORY_LIMIT = 50;
const DEFAULT_WORKBENCH_LEFT_PANEL_WIDTH = 260;
const DEFAULT_WORKBENCH_RIGHT_PANEL_WIDTH = 300;
const WORKBENCH_PRESET_LIBRARY_PARAM = 'presets';
const WORKBENCH_RUNTIME_NAVIGATION_SHORTCUT_SOURCE =
  'workbench-keyboard-runtime-navigation';
const TIMELINE_PLAYBACK_RATES = new Set([0.5, 1, 2]);
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
const gameDataBinding = ref(
  cloneWorkbenchHistoryValue(initialDraft.gameDataBinding)
);
const configurationLibrary = ref(
  cloneWorkbenchHistoryValue(initialDraft.configurationLibrary)
);
const configurationSelection = ref(
  cloneWorkbenchHistoryValue(initialDraft.configurationSelection)
);
const mechanicsProfileSelection = ref(
  cloneWorkbenchHistoryValue(initialDraft.mechanicsProfileSelection)
);
const segmentSplitOptions = ref({ ...initialDraft.segmentSplitOptions });
const segmentSplitPreview = ref(null);
const actionDrafts = ref([...initialDraft.actionDrafts]);
const actionRelations = ref([...initialDraft.actionRelations]);
const cycleBoundaries = ref([...initialDraft.cycleBoundaries]);
const initialRuntimeState = ref(
  cloneWorkbenchHistoryValue(initialDraft.initialRuntimeState)
);
const scenarioWorkspace = ref(
  cloneWorkbenchHistoryValue(initialDraft.scenarioWorkspace)
);
const runtimeSampleCaptures = ref([...initialDraft.runtimeSampleCaptures]);
const selectedActionId = ref(initialDraft.selectedActionId);
const selectedActionIds = ref(
  initialDraft.selectedActionId ? [initialDraft.selectedActionId] : []
);
const actionSelectionAnchorId = ref(initialDraft.selectedActionId);
const selectedActionRelationId = ref('');
const selectedCycleBoundaryId = ref('');
const selectedCycleSectionId = ref('');
const selectedEffectIntervalId = ref('');
const selectedEffectEventId = ref('');
const boxSelectionMode = ref(false);
const actionClipboard = ref(null);
const actionContextMenu = ref(createClosedActionContextMenu());
const selectedStateCurvePointId = ref('');
const timelineCursorFrameIndex = ref(0);
const timelinePlaybackRunning = ref(false);
const timelinePlaybackRate = ref(1);
const timelinePlaybackRangeMode = ref('axis');
let timelinePlaybackAnimationFrameId = null;
let timelinePlaybackLastTimestamp = null;
let timelinePlaybackFrameRemainder = 0;
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
const comparisonDialogVisible = ref(false);
const comparisonBaselineDraft = ref(null);
const comparisonBaselineSource = ref(null);
const comparisonWindowId = ref('full-axis');
const analysisReportDialogVisible = ref(false);
const importedAnalysisReport = ref(null);
const importedAnalysisReportValidation = ref(null);
const undoHistoryStack = ref([]);
const redoHistoryStack = ref([]);
const workbenchRoot = ref(null);
const workbenchGrid = ref(null);
const workbenchLayout = ref(createInitialWorkbenchLayoutState());
const activeWorkbenchLayoutResize = ref('');
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
let workbenchLayoutResizeState = null;
let workbenchLayoutApi = null;
let workbenchLayoutApiPromise = null;
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

const mechanicsProfileCompatibilityReport = computed(() =>
  createWorkbenchProfileCompatibilityReport(getWorkbenchDraftState())
);
const gameDataCompatibilityReport = computed(() =>
  createWorkbenchGameDataCompatibilityReport(getWorkbenchDraftState())
);
const project = computed(() =>
  createWorkbenchProject(selection.value, {
    teamSlots: teamSlots.value,
    actorConfigs: actorConfigs.value,
    enemyConfig: enemyConfig.value,
    configurationLibrary: configurationLibrary.value,
    configurationSelection: configurationSelection.value,
    gameDataBinding: gameDataBinding.value,
    gameDataCompatibilityReport: gameDataCompatibilityReport.value,
    mechanicsProfileSelection: mechanicsProfileSelection.value,
    mechanicsProfileCompatibilityReport:
      mechanicsProfileCompatibilityReport.value,
    actions: actionDrafts.value,
    actionRelations: actionRelations.value,
    cycleBoundaries: cycleBoundaries.value,
    initialRuntimeState: initialRuntimeState.value,
    runtimeSampleCaptures: runtimeSampleCaptures.value,
  })
);
const scenario = computed(() =>
  compileProject(project.value, gameData, {
    threeValueMechanicsProfileCatalog:
      DEFAULT_THREE_VALUE_MECHANICS_PROFILE_CATALOG,
  })
);
const simulationResult = computed(() => {
  void runtimeDiagnosticsRevision.value;
  return simulateScenario(scenario.value);
});
const currentWorkbenchPresetSummary = computed(() => ({
  actionCount: actionDrafts.value.length,
  actorNames: scenario.value.actors.map(actor => actor.name),
  enemyName: scenario.value.enemy.name,
}));
const activeWorkbenchScenario = computed(() =>
  getActiveWorkbenchScenario(scenarioWorkspace.value)
);
const runtimeOutputs = computed(() => simulationResult.value.runtimeOutputs);
const runtimeStatePointContexts = computed(() =>
  createRuntimeStatePointContexts(runtimeOutputs.value)
);
const effectIntervalProjection = computed(() =>
  projectEffectRuntimeIntervals({
    effectTimeline: runtimeOutputs.value.effectTimeline,
    durationMs: scenario.value.time.durationMs,
    frameRate: scenario.value.time.fps,
  })
);
const cycleSectionProjection = computed(() =>
  projectCycleSections({
    scenario: scenario.value,
    runtimeOutputs: runtimeOutputs.value,
    effectIntervals: effectIntervalProjection.value,
    statePointContexts: runtimeStatePointContexts.value,
  })
);
const selectedCycleSection = computed(
  () =>
    cycleSectionProjection.value.sections.find(
      section => section.sectionId === selectedCycleSectionId.value
    ) ??
    cycleSectionProjection.value.sections[0] ??
    null
);
const timelinePlaybackRange = computed(() => {
  const axisEndFrame = Math.max(0, msToFrame(scenario.value.time.durationMs));
  const section = selectedCycleSection.value;
  if (
    timelinePlaybackRangeMode.value === 'section' &&
    cycleBoundaries.value.length &&
    section
  ) {
    const startFrame = clampNumber(msToFrame(section.startMs), 0, axisEndFrame);
    const endFrame = clampNumber(
      msToFrame(section.endMs),
      startFrame + 1,
      Math.max(startFrame + 1, axisEndFrame)
    );
    return {
      mode: 'section',
      startFrame,
      endFrame,
      lastFrame: Math.max(startFrame, endFrame - 1),
      loop: true,
      sectionId: section.sectionId,
    };
  }
  return {
    mode: 'axis',
    startFrame: 0,
    endFrame: axisEndFrame,
    lastFrame: axisEndFrame,
    loop: false,
    sectionId: '',
  };
});
const selectedCycleInheritanceBoundary = computed(() =>
  cycleBoundaries.value.find(
    boundary => boundary.id === selectedCycleSection.value?.startBoundaryId
  )
);
const canCreateInheritedScenario = computed(() => {
  const boundary = selectedCycleInheritanceBoundary.value;
  return Boolean(
    boundary &&
    scenarioWorkspace.value.scenarios.length < MAX_WORKBENCH_SCENARIOS &&
    actionDrafts.value.some(
      action => Number(action.startMs) >= Number(boundary.timeMs)
    )
  );
});
const canAddCycleBoundaryAtContextTime = computed(() => {
  const timeMs = Number(actionContextMenu.value.targetStartMs);
  return (
    actionContextMenu.value.kind === 'actions' &&
    Number.isFinite(timeMs) &&
    timeMs > 0 &&
    timeMs < scenario.value.time.durationMs &&
    !cycleBoundaries.value.some(boundary => boundary.timeMs === timeMs)
  );
});
const comparisonBaselineProject = computed(() =>
  comparisonBaselineDraft.value
    ? createWorkbenchProjectFromDraft(comparisonBaselineDraft.value)
    : null
);
const comparisonBaselineScenario = computed(() =>
  comparisonBaselineProject.value
    ? compileProject(comparisonBaselineProject.value, gameData, {
        threeValueMechanicsProfileCatalog:
          DEFAULT_THREE_VALUE_MECHANICS_PROFILE_CATALOG,
      })
    : null
);
const comparisonBaselineSimulationResult = computed(() => {
  void runtimeDiagnosticsRevision.value;
  return comparisonBaselineScenario.value
    ? simulateScenario(comparisonBaselineScenario.value)
    : null;
});
const comparisonBaselineEffectIntervals = computed(() => {
  if (!comparisonBaselineScenario.value) {
    return null;
  }
  return projectEffectRuntimeIntervals({
    effectTimeline:
      comparisonBaselineSimulationResult.value.runtimeOutputs.effectTimeline,
    durationMs: comparisonBaselineScenario.value.time.durationMs,
    frameRate: comparisonBaselineScenario.value.time.fps,
  });
});
const comparisonBaselineRuntimeStatePointContexts = computed(() =>
  comparisonBaselineSimulationResult.value
    ? createRuntimeStatePointContexts(
        comparisonBaselineSimulationResult.value.runtimeOutputs
      )
    : []
);
const comparisonBaselineContributionProjection = computed(() =>
  comparisonBaselineScenario.value
    ? projectCycleSections({
        scenario: comparisonBaselineScenario.value,
        runtimeOutputs: comparisonBaselineSimulationResult.value.runtimeOutputs,
        effectIntervals: comparisonBaselineEffectIntervals.value,
        statePointContexts: comparisonBaselineRuntimeStatePointContexts.value,
      })
    : null
);
const scenarioComparison = computed(() =>
  projectWorkbenchScenarioComparison({
    windowId: comparisonWindowId.value,
    current: {
      label: activeWorkbenchScenario.value?.name ?? '当前编辑',
      sourceKind: 'current-workbench-project',
      sourceId: scenarioWorkspace.value.activeScenarioId,
      scenario: scenario.value,
      runtimeOutputs: runtimeOutputs.value,
      effectIntervals: effectIntervalProjection.value,
      contributionProjection: cycleSectionProjection.value,
    },
    baseline: comparisonBaselineScenario.value
      ? {
          label: comparisonBaselineSource.value?.label ?? '基准方案',
          sourceKind:
            comparisonBaselineSource.value?.kind ?? 'comparison-baseline',
          sourceId: comparisonBaselineSource.value?.id ?? null,
          scenario: comparisonBaselineScenario.value,
          runtimeOutputs:
            comparisonBaselineSimulationResult.value.runtimeOutputs,
          effectIntervals: comparisonBaselineEffectIntervals.value,
          contributionProjection:
            comparisonBaselineContributionProjection.value,
        }
      : null,
  })
);
const selectedEffectInterval = computed(
  () =>
    effectIntervalProjection.value.intervals.find(
      interval => interval.intervalId === selectedEffectIntervalId.value
    ) ?? null
);
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
    timelineTopology: project.value.metadata.timelineTopology,
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
const timelineEntryCatalog = computed(() => {
  const defaultSkillEntry = getSkillActionCatalog(
    actionLibrarySkills.value,
    1
  )[0];
  return [
    createWorkbenchTimelineEntry({
      ...defaultSkillEntry,
      type: ACTION_TYPES.SKILL,
      label: defaultSkillEntry?.label ?? '角色动作',
    }),
    createWorkbenchTimelineEntry({
      type: ACTION_TYPES.SWITCH,
      label: '切人',
    }),
    createWorkbenchTimelineEntry({
      type: ACTION_TYPES.RESOURCE,
      label: '资源',
    }),
    createWorkbenchTimelineEntry({
      type: ACTION_TYPES.KIBO_EVENT,
      eventType: 'activation',
      label: '奇波事件',
    }),
    createWorkbenchTimelineEntry({
      type: ACTION_TYPES.ENEMY_EVENT,
      eventType: 'phase',
      label: '敌人事件',
    }),
  ].filter(Boolean);
});
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
const workbenchLayoutClasses = computed(() => ({
  'layout-left-collapsed': workbenchLayout.value.leftPanelCollapsed,
  'layout-right-collapsed': workbenchLayout.value.rightPanelCollapsed,
}));
const workbenchLayoutStyle = computed(() => ({
  '--workbench-left-panel-width': `${workbenchLayout.value.leftPanelWidth}px`,
  '--workbench-right-panel-width': `${workbenchLayout.value.rightPanelWidth}px`,
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
  () => effectIntervalProjection.value.intervals,
  intervals => {
    if (!selectedEffectIntervalId.value) {
      if (
        selectedEffectEventId.value &&
        !intervals.some(interval =>
          interval.lifecycleEventIds.includes(selectedEffectEventId.value)
        )
      ) {
        selectedEffectEventId.value = '';
      }
      return;
    }
    const interval = intervals.find(
      item => item.intervalId === selectedEffectIntervalId.value
    );
    if (!interval) {
      selectedEffectIntervalId.value = '';
      selectedEffectEventId.value = '';
      return;
    }
    if (!interval.lifecycleEventIds.includes(selectedEffectEventId.value)) {
      selectedEffectEventId.value = interval.selectionEventId;
    }
  },
  { flush: 'sync' }
);

watch(
  () => runtimeSelectedDetail.value?.statePointId ?? '',
  (statePointId, previousStatePointId) => {
    if (statePointId !== previousStatePointId) {
      selectedEffectIntervalId.value = '';
      selectedEffectEventId.value = '';
    }
  }
);

watch(
  [selectedStateCurvePointId, runtimeStatePointContexts],
  ([statePointId, contexts]) => {
    if (!statePointId) {
      return;
    }
    pauseTimelinePlayback();
    const context = contexts.find(item => item.statePointId === statePointId);
    const frameIndex = Number(
      context?.row?.frameIndex ??
        context?.point?.frameIndex ??
        msToFrame(context?.row?.timeMs ?? context?.point?.timeMs)
    );
    if (Number.isFinite(frameIndex)) {
      timelineCursorFrameIndex.value = clampNumber(
        Math.round(frameIndex),
        0,
        msToFrame(scenario.value.time.durationMs)
      );
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

function createInitialWorkbenchLayoutState() {
  return {
    mode: 'balanced',
    leftPanelWidth: DEFAULT_WORKBENCH_LEFT_PANEL_WIDTH,
    rightPanelWidth: DEFAULT_WORKBENCH_RIGHT_PANEL_WIDTH,
    leftPanelCollapsed: false,
    rightPanelCollapsed: false,
  };
}

function getWorkbenchLayoutApi() {
  if (!workbenchLayoutApiPromise) {
    workbenchLayoutApiPromise = import('../domain/workbenchLayout').then(
      api => {
        workbenchLayoutApi = api;
        return api;
      }
    );
  }
  return workbenchLayoutApiPromise;
}

async function persistWorkbenchLayout() {
  const api = await getWorkbenchLayoutApi();
  api.saveWorkbenchLayoutState(getLocalStorage(), workbenchLayout.value);
}

async function setWorkbenchLayoutMode(mode) {
  const api = await getWorkbenchLayoutApi();
  endWorkbenchLayoutResize();
  workbenchLayout.value = api.applyWorkbenchLayoutMode(
    workbenchLayout.value,
    mode
  );
  await persistWorkbenchLayout();
}

async function toggleWorkbenchLayoutSide(panel) {
  const api = await getWorkbenchLayoutApi();
  endWorkbenchLayoutResize();
  workbenchLayout.value = api.toggleWorkbenchLayoutPanel(
    workbenchLayout.value,
    panel
  );
  await persistWorkbenchLayout();
}

async function resetWorkbenchLayout() {
  const api = await getWorkbenchLayoutApi();
  endWorkbenchLayoutResize();
  workbenchLayout.value = api.createDefaultWorkbenchLayoutState();
  await persistWorkbenchLayout();
}

async function resetWorkbenchLayoutPanel(panel) {
  const api = await getWorkbenchLayoutApi();
  const width =
    panel === 'left'
      ? DEFAULT_WORKBENCH_LEFT_PANEL_WIDTH
      : DEFAULT_WORKBENCH_RIGHT_PANEL_WIDTH;
  workbenchLayout.value = api.resizeWorkbenchLayoutPanel(
    workbenchLayout.value,
    panel,
    width
  );
  await persistWorkbenchLayout();
}

function beginWorkbenchLayoutResize(panel, event) {
  if ((event?.button != null && event.button !== 0) || !workbenchLayoutApi) {
    return;
  }
  event?.preventDefault?.();
  activeWorkbenchLayoutResize.value = panel;
  workbenchLayoutResizeState = {
    panel,
    startX: Number(event?.clientX) || 0,
    startWidth:
      panel === 'left'
        ? workbenchLayout.value.leftPanelWidth
        : workbenchLayout.value.rightPanelWidth,
  };
  if (typeof document !== 'undefined') {
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }
  window?.addEventListener?.('pointermove', applyWorkbenchLayoutResize);
  window?.addEventListener?.('pointerup', endWorkbenchLayoutResize);
}

function applyWorkbenchLayoutResize(event) {
  if (!workbenchLayoutResizeState) {
    return;
  }
  const { panel, startX, startWidth } = workbenchLayoutResizeState;
  const deltaX = (Number(event?.clientX) || 0) - startX;
  workbenchLayout.value =
    workbenchLayoutApi.resizeWorkbenchLayoutPanelFromPointer(
      workbenchLayout.value,
      {
        panel,
        startWidth,
        deltaX,
        containerWidth: workbenchGrid.value?.getBoundingClientRect?.().width,
      }
    );
}

function endWorkbenchLayoutResize() {
  if (!workbenchLayoutResizeState && !activeWorkbenchLayoutResize.value) {
    return;
  }
  workbenchLayoutResizeState = null;
  activeWorkbenchLayoutResize.value = '';
  if (typeof document !== 'undefined') {
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
  window?.removeEventListener?.('pointermove', applyWorkbenchLayoutResize);
  window?.removeEventListener?.('pointerup', endWorkbenchLayoutResize);
  void persistWorkbenchLayout();
}

async function handleWorkbenchLayoutResizeKey(panel, event) {
  if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event?.key)) {
    return;
  }
  event.preventDefault();
  if (event.key === 'Home') {
    await resetWorkbenchLayoutPanel(panel);
    return;
  }
  const api = await getWorkbenchLayoutApi();
  const direction = event.key === 'ArrowRight' ? 1 : -1;
  workbenchLayout.value = api.nudgeWorkbenchLayoutPanel(workbenchLayout.value, {
    panel,
    direction,
    containerWidth: workbenchGrid.value?.getBoundingClientRect?.().width,
  });
  await persistWorkbenchLayout();
}

onMounted(() => {
  void getWorkbenchLayoutApi().then(layoutApi => {
    workbenchLayout.value =
      layoutApi.loadWorkbenchLayoutState(getLocalStorage());
  });
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
  const compatibility = createWorkbenchProfileCompatibilityReport(draft);
  if (!compatibility.importAllowed) {
    draftStatus.value = '本地草稿机制配置不兼容';
    return;
  }
  const gameDataCompatibility = getWorkbenchGameDataCompatibilityReport(draft);
  if (!gameDataCompatibility.importAllowed) {
    draftStatus.value = '本地草稿游戏数据不兼容';
    return;
  }

  applyDraftState(draft);
  draftStatus.value = '已恢复草稿';
  if (draft.runtimeSampleCaptures?.length) {
    void ensureRuntimeDiagnosticsLoaded();
  }
});

onBeforeUnmount(() => {
  pauseTimelinePlayback();
  endWorkbenchLayoutResize();
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
    nextSelection,
    teamSlots.value
  );
  applyWorkbenchConfigurationState(
    reconcileWorkbenchConfigurationState({
      configurationLibrary: configurationLibrary.value,
      configurationSelection: configurationSelection.value,
      selection: nextSelection,
      actorConfigs: actorConfigs.value,
      enemyConfig: enemyConfig.value,
      syncSelectedValues: false,
    })
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
  const nextEnemyConfig = normalizeWorkbenchEnemyConfig({
    ...enemyConfig.value,
    ...patch,
  });
  applyWorkbenchConfigurationState(
    updateSelectedWorkbenchConfigurationInstance(
      {
        configurationLibrary: configurationLibrary.value,
        configurationSelection: configurationSelection.value,
        selection: selection.value,
        actorConfigs: actorConfigs.value,
        enemyConfig: enemyConfig.value,
      },
      {
        kind: 'enemy',
        enemyId: selection.value.enemyId,
        config: nextEnemyConfig,
      }
    )
  );
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
  const nextActorConfigs = normalizeWorkbenchActorConfigs(
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
    selection.value,
    teamSlots.value
  );
  applyWorkbenchConfigurationState(
    updateSelectedWorkbenchConfigurationInstance(
      {
        configurationLibrary: configurationLibrary.value,
        configurationSelection: configurationSelection.value,
        selection: selection.value,
        actorConfigs: actorConfigs.value,
        enemyConfig: enemyConfig.value,
      },
      {
        kind: 'actor',
        characterId: Number(characterId),
        config: nextActorConfigs.find(
          config => Number(config.characterId) === Number(characterId)
        ),
      }
    )
  );
  markDraftDirty();
}

function applyWorkbenchConfigurationCommand(command = {}) {
  const result = applyWorkbenchConfigurationInstanceCommand(
    {
      configurationLibrary: configurationLibrary.value,
      configurationSelection: configurationSelection.value,
      selection: selection.value,
      actorConfigs: actorConfigs.value,
      enemyConfig: enemyConfig.value,
    },
    command
  );
  if (!result.changed) {
    return false;
  }
  clearSegmentSplitPreview();
  recordWorkbenchHistorySnapshot();
  applyWorkbenchConfigurationState(result);
  markDraftDirty();
  return true;
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

function rebindTimelineActionDraftToCharacter(action, targetCharacterId) {
  if (
    !Number.isInteger(targetCharacterId) ||
    Number(action.actorCharacterId) === targetCharacterId
  ) {
    return action;
  }

  const patch = { actorCharacterId: targetCharacterId };
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

  return createWorkbenchActionDraft({
    ...action,
    ...patch,
    ...clearInsertionForManualEdit(action),
  });
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

function addSkillAction(actionEntryOrSkillId, insertOptions = {}) {
  clearSegmentSplitPreview();
  const actorCharacterId = Number(
    insertOptions.actorCharacterId ??
      actionLibraryActor.value?.characterId ??
      selectedDraft.value.actorCharacterId
  );
  const actionEntry = normalizeActionEntryInput(
    actionEntryOrSkillId,
    actorCharacterId
  );
  const skill = resolveContextSkill(actorCharacterId, actionEntry.skillId);
  const level = resolveSkillInsertLevel(actorCharacterId, skill);
  addInsertedAction(
    {
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
    },
    { requestedStartMs: insertOptions.requestedStartMs }
  );
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

function addKiboEventAction() {
  clearSegmentSplitPreview();
  addInsertedAction({
    id: createNextActionId(),
    type: ACTION_TYPES.KIBO_EVENT,
    skillId: selectedDraft.value.skillId,
    actorCharacterId: actionLibraryCharacterId.value,
    durationMs: 600,
    level: selectedDraft.value.level,
    eventType: 'activation',
    note: '奇波事件标记；效果未接入 calculator。',
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

function insertTimelineEntry({ entry, laneId, startMs }) {
  const targetLane = resolveWorkbenchTimelineLaneTarget(laneId);
  if (
    !targetLane ||
    !isWorkbenchTimelineEntryAllowedInLane(entry, targetLane.kind)
  ) {
    return;
  }

  const actorCharacterId = Number(
    targetLane.characterId ?? actionLibraryCharacterId.value
  );
  const requestedStartMs = clampNumber(
    startMs,
    0,
    project.value.time.durationMs
  );
  if (targetLane.characterId != null) {
    actionLibraryCharacterId.value = actorCharacterId;
  }

  if (entry.type === ACTION_TYPES.SKILL) {
    addSkillAction(entry, { actorCharacterId, requestedStartMs });
    return;
  }

  const commonDraft = {
    id: createNextActionId(),
    type: entry.type,
    skillId: selectedDraft.value.skillId,
    actorCharacterId,
    durationMs: entry.durationMs ?? 600,
    level: selectedDraft.value.level,
  };
  if (entry.type === ACTION_TYPES.SWITCH) {
    Object.assign(commonDraft, {
      targetCharacterId: resolveAlternateActorCharacterId(actorCharacterId),
      note: '切换至其他角色',
    });
  } else if (entry.type === ACTION_TYPES.RESOURCE) {
    Object.assign(commonDraft, {
      resource: 'sp',
      change: 50,
      reason: 'manual-axis-resource',
      note: '手动资源变化',
    });
  } else if (entry.type === ACTION_TYPES.KIBO_EVENT) {
    Object.assign(commonDraft, {
      eventType: entry.eventType ?? 'activation',
      note: '奇波事件标记；效果未接入 calculator。',
    });
  } else if (entry.type === ACTION_TYPES.ENEMY_EVENT) {
    Object.assign(commonDraft, {
      eventType: entry.eventType ?? 'phase',
      note: '敌人阶段标记',
    });
  }
  addInsertedAction(commonDraft, { requestedStartMs });
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
  return moveSelectedActions({ actionIds, offsetMs });
}

function moveSelectedActions({
  actionIds = selectedActionIds.value,
  primaryActionId = selectedActionId.value,
  offsetMs = 0,
  targetLaneId = null,
} = {}) {
  clearSegmentSplitPreview();
  const availableActionIds = new Set(
    actionDrafts.value.map(action => action.id)
  );
  const affectedActionIds = [...new Set(actionIds)].filter(actionId =>
    availableActionIds.has(actionId)
  );
  const editedActionId = affectedActionIds.includes(primaryActionId)
    ? primaryActionId
    : affectedActionIds.includes(selectedActionId.value)
      ? selectedActionId.value
      : (affectedActionIds[0] ?? '');
  if (!editedActionId) {
    return false;
  }

  const previousAction = findActionDraftById(editedActionId);
  const editSourceFocus = captureActionEditSourceFocus(editedActionId);
  const shifted = shiftWorkbenchActionDrafts(
    actionDrafts.value,
    affectedActionIds,
    offsetMs,
    project.value.time.durationMs
  );
  let nextActions = shifted.actions;
  const targetLane = targetLaneId
    ? resolveWorkbenchTimelineLaneTarget(targetLaneId)
    : null;
  const laneMovePlan = targetLane
    ? createWorkbenchTimelineBatchLaneMovePlan({
        actions: actionDrafts.value,
        actionIds: affectedActionIds,
        primaryActionId: editedActionId,
        targetLane,
        getActionOwnerId: action => action.actorCharacterId,
        getLaneOwnerId: lane => lane.characterId,
      })
    : null;
  if (laneMovePlan?.changesOwner) {
    nextActions = nextActions.map(action =>
      affectedActionIds.includes(action.id)
        ? rebindTimelineActionDraftToCharacter(
            action,
            Number(targetLane.characterId)
          )
        : action
    );
  }

  const nextActionsById = new Map(
    nextActions.map(action => [action.id, action])
  );
  const changedActionIds = affectedActionIds.filter(actionId => {
    const previous = findActionDraftById(actionId);
    const next = nextActionsById.get(actionId);
    return JSON.stringify(previous) !== JSON.stringify(next);
  });
  if (changedActionIds.length === 0) {
    return false;
  }

  recordWorkbenchHistorySnapshot();
  actionDrafts.value = nextActions;
  setWorkbenchActionSelection(affectedActionIds, editedActionId, {
    anchorActionId: editedActionId,
  });
  const nextAction = findActionDraftById(editedActionId);
  if (previousAction && nextAction) {
    const editPatch = {};
    if (shifted.appliedOffsetMs) {
      editPatch.startMs = nextAction.startMs;
    }
    if (laneMovePlan?.changesOwner) {
      editPatch.laneId = targetLaneId;
      editPatch.actorCharacterId = Number(targetLane.characterId);
    }
    recordActionEditSource(editedActionId, editPatch, {
      previousAction,
      nextAction,
      focus: editSourceFocus,
    });
  }
  if (laneMovePlan?.changesOwner) {
    actionLibraryCharacterId.value = Number(targetLane.characterId);
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

function switchWorkspaceScenario(scenarioId) {
  const result = switchWorkbenchScenario(
    scenarioWorkspace.value,
    scenarioId,
    createWorkbenchScenarioDraftSnapshot(getCurrentWorkbenchScenarioState())
  );
  return applyWorkspaceScenarioMutation(result, '已切换方案');
}

function addWorkspaceScenario() {
  const emptyDraft = createWorkbenchScenarioDraftSnapshot({
    ...createDefaultWorkbenchDraftState(),
    configurationSelection: null,
  });
  const result = addWorkbenchScenario(
    scenarioWorkspace.value,
    createWorkbenchScenarioDraftSnapshot(getCurrentWorkbenchScenarioState()),
    emptyDraft
  );
  if (!result.changed && result.reason === 'scenario-limit-reached') {
    draftStatus.value = `方案数量已达上限（${MAX_WORKBENCH_SCENARIOS}）`;
    return false;
  }
  return applyWorkspaceScenarioMutation(result, '已新建方案');
}

function duplicateWorkspaceScenario(scenarioId) {
  const result = duplicateWorkbenchScenario(
    scenarioWorkspace.value,
    scenarioId,
    createWorkbenchScenarioDraftSnapshot(getCurrentWorkbenchScenarioState())
  );
  if (!result.changed && result.reason === 'scenario-limit-reached') {
    draftStatus.value = `方案数量已达上限（${MAX_WORKBENCH_SCENARIOS}）`;
    return false;
  }
  return applyWorkspaceScenarioMutation(result, '已复制方案');
}

function createInheritedScenarioFromBoundary(boundaryId) {
  const currentDraft = createWorkbenchScenarioDraftSnapshot(
    getCurrentWorkbenchScenarioState()
  );
  const sourceScenario = activeWorkbenchScenario.value;
  const projection = projectCycleBoundaryInheritance({
    draft: currentDraft,
    scenario: scenario.value,
    runtimeOutputs: runtimeOutputs.value,
    boundaryId,
    sourceScenarioId: sourceScenario?.id ?? '',
    sourceScenarioName: sourceScenario?.name ?? '',
  });
  if (
    projection.status === 'cycle-boundary-inheritance-no-downstream-actions'
  ) {
    draftStatus.value = '该边界之后没有可继承动作';
    return false;
  }
  if (!projection.applied || !projection.draft) {
    draftStatus.value = '循环边界继承不可用';
    return false;
  }

  const scenarioName = `${sourceScenario?.name ?? '方案'} 继承 ${formatFrameTime(
    projection.boundary.timeMs
  )}`;
  const result = addWorkbenchScenarioFromDraft(
    scenarioWorkspace.value,
    currentDraft,
    createWorkbenchScenarioDraftSnapshot(projection.draft),
    scenarioName
  );
  if (!result.changed && result.reason === 'scenario-limit-reached') {
    draftStatus.value = `方案数量已达上限（${MAX_WORKBENCH_SCENARIOS}）`;
    return false;
  }
  return applyWorkspaceScenarioMutation(result, '已从循环边界创建继承方案');
}

function renameWorkspaceScenario({ scenarioId, name } = {}) {
  const synchronizedWorkspace = synchronizeActiveWorkbenchScenario(
    scenarioWorkspace.value,
    createWorkbenchScenarioDraftSnapshot(getCurrentWorkbenchScenarioState())
  );
  const result = renameWorkbenchScenario(
    synchronizedWorkspace,
    scenarioId,
    name
  );
  if (!result.changed) {
    return false;
  }
  scenarioWorkspace.value = result.workspace;
  persistWorkspaceScenarioState(`已重命名方案：${result.scenario.name}`);
  return true;
}

function deleteWorkspaceScenario(scenarioId) {
  const scenario = scenarioWorkspace.value.scenarios.find(
    item => item.id === scenarioId
  );
  if (!scenario || scenarioWorkspace.value.scenarios.length <= 1) {
    return false;
  }
  if (
    typeof globalThis.confirm === 'function' &&
    !globalThis.confirm(`确定删除方案“${scenario.name}”吗？`)
  ) {
    return false;
  }
  const result = deleteWorkbenchScenario(
    scenarioWorkspace.value,
    scenarioId,
    createWorkbenchScenarioDraftSnapshot(getCurrentWorkbenchScenarioState())
  );
  return applyWorkspaceScenarioMutation(result, '已删除方案');
}

function applyWorkspaceScenarioMutation(result, statusText) {
  if (!result?.changed || !result.scenario?.draft) {
    return false;
  }
  scenarioWorkspace.value = result.workspace;
  applyWorkbenchScenarioDraftState(result.scenario.draft);
  projectShareUrl.value = '';
  clearWorkbenchProjectTransientState();
  clearSegmentSplitPreview();
  undoHistoryStack.value = [];
  redoHistoryStack.value = [];
  reconcileWorkspaceScenarioComparisonBaseline();
  persistWorkspaceScenarioState(`${statusText}：${result.scenario.name}`);
  if (result.scenario.draft.runtimeSampleCaptures?.length) {
    void ensureRuntimeDiagnosticsLoaded();
  }
  return true;
}

function persistWorkspaceScenarioState(statusText) {
  const snapshot = saveWorkbenchDraft(
    getLocalStorage(),
    getWorkbenchDraftState()
  );
  draftStatus.value = snapshot ? statusText : `${statusText}（未持久化）`;
}

function reconcileWorkspaceScenarioComparisonBaseline() {
  if (comparisonBaselineSource.value?.kind !== 'workspace-scenario') {
    return;
  }
  const baselineScenario = scenarioWorkspace.value.scenarios.find(
    scenario => scenario.id === comparisonBaselineSource.value.id
  );
  if (
    !baselineScenario ||
    baselineScenario.id === scenarioWorkspace.value.activeScenarioId
  ) {
    comparisonBaselineDraft.value = null;
    comparisonBaselineSource.value = null;
  }
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

function openScenarioComparison() {
  refreshWorkbenchPresetLibrary();
  comparisonDialogVisible.value = true;
}

function closeScenarioComparison() {
  comparisonDialogVisible.value = false;
}

function selectScenarioComparisonWindow(windowId) {
  const window = scenarioComparison.value.windows.find(
    item => item.windowId === windowId && item.comparable
  );
  if (!window) {
    return false;
  }
  comparisonWindowId.value = window.windowId;
  return true;
}

function selectScenarioComparisonWorkspaceScenario(scenarioId) {
  const synchronizedWorkspace = synchronizeActiveWorkbenchScenario(
    scenarioWorkspace.value,
    createWorkbenchScenarioDraftSnapshot(getCurrentWorkbenchScenarioState())
  );
  const workspaceScenario = synchronizedWorkspace.scenarios.find(
    scenario =>
      scenario.id === scenarioId &&
      scenario.id !== synchronizedWorkspace.activeScenarioId
  );
  if (!workspaceScenario) {
    draftStatus.value = '工作区对比方案不存在';
    return false;
  }
  return setScenarioComparisonBaseline(workspaceScenario.draft, {
    kind: 'workspace-scenario',
    id: workspaceScenario.id,
    label: workspaceScenario.name,
  });
}

function selectScenarioComparisonPreset(presetId) {
  const preset = workbenchPresets.value.find(item => item.id === presetId);
  const draft = createWorkbenchDraftFromPreset(preset);
  if (!preset || !draft) {
    draftStatus.value = '对比预设版本不兼容';
    return false;
  }
  return setScenarioComparisonBaseline(draft, {
    kind: 'preset',
    id: preset.id,
    label: preset.name,
  });
}

function captureCurrentScenarioComparisonBaseline() {
  return setScenarioComparisonBaseline(
    createWorkbenchDraftSnapshot(getWorkbenchDraftState()),
    {
      kind: 'snapshot',
      id: `snapshot-${Date.now()}`,
      label: `${project.value.name}（当前快照）`,
    }
  );
}

async function importScenarioComparisonBaseline(file) {
  try {
    const receiver = await import('../domain/workbenchProjectFileReceiver');
    const result = await receiver.receiveWorkbenchProjectFile(file, {
      allowRuntimeCapture: false,
    });
    if (result.kind !== 'project') {
      draftStatus.value = '对比基准项目无效';
      return false;
    }
    return setScenarioComparisonBaseline(result.draft, {
      kind: 'import',
      id: file.name,
      label: file.name,
    });
  } catch {
    draftStatus.value = '对比基准导入失败';
    return false;
  }
}

function setScenarioComparisonBaseline(draft, source) {
  if (!draft) {
    return false;
  }
  const compatibility = createWorkbenchProfileCompatibilityReport(draft);
  if (!compatibility.importAllowed) {
    draftStatus.value = '对比项目机制配置不兼容';
    return false;
  }
  const gameDataCompatibility = getWorkbenchGameDataCompatibilityReport(draft);
  if (!gameDataCompatibility.importAllowed) {
    draftStatus.value = '对比项目游戏数据不兼容';
    return false;
  }
  comparisonBaselineDraft.value = createWorkbenchDraftSnapshot(
    draft,
    draft.savedAt ?? null
  );
  comparisonBaselineSource.value = { ...source };
  comparisonWindowId.value = 'full-axis';
  if (draft.runtimeSampleCaptures?.length) {
    void ensureRuntimeDiagnosticsLoaded();
  }
  return true;
}

function locateScenarioComparisonAction(request) {
  const payload =
    request && typeof request === 'object'
      ? request
      : { role: 'current', actionId: request };
  return payload.role === 'baseline'
    ? locateScenarioComparisonBaselineAction(payload)
    : focusScenarioComparisonAction(payload, {
        focusSource: 'scenario-comparison',
        changeSummary: '从方案差异返回当前动作修改',
      });
}

function locateScenarioComparisonBaselineAction(payload) {
  const baselineDraft = comparisonBaselineDraft.value;
  const baselineSource = comparisonBaselineSource.value;
  if (!baselineDraft || !baselineSource) {
    return false;
  }
  closeScenarioComparison();
  let activated = false;
  if (baselineSource.kind === 'workspace-scenario') {
    activated = switchWorkspaceScenario(baselineSource.id);
  } else {
    const result = addWorkbenchScenarioFromDraft(
      scenarioWorkspace.value,
      createWorkbenchScenarioDraftSnapshot(getCurrentWorkbenchScenarioState()),
      createWorkbenchScenarioDraftSnapshot(baselineDraft),
      `基准：${baselineSource.label ?? '方案'}`
    );
    if (!result.changed && result.reason === 'scenario-limit-reached') {
      draftStatus.value = `方案数量已达上限（${MAX_WORKBENCH_SCENARIOS}）`;
      return false;
    }
    activated = applyWorkspaceScenarioMutation(result, '已打开对比基准');
    comparisonBaselineDraft.value = null;
    comparisonBaselineSource.value = null;
  }
  if (!activated) {
    return false;
  }
  return focusScenarioComparisonAction(payload, {
    focusSource: 'scenario-comparison-baseline',
    changeSummary: '已切换到基准方案并定位贡献动作',
  });
}

function focusScenarioComparisonAction(
  { actionId, statePointId = '', frameIndex = null } = {},
  { focusSource, changeSummary, label = '方案对比' }
) {
  if (!findActionDraftById(actionId)) {
    return false;
  }
  closeScenarioComparison();
  selectAction(actionId, { syncRuntimeResult: false });
  if (statePointId) {
    selectStateCurvePoint(statePointId);
  }
  if (
    frameIndex != null &&
    frameIndex !== '' &&
    Number.isFinite(Number(frameIndex))
  ) {
    selectTimelineFrame({
      frameIndex: Number(frameIndex),
      statePointId,
      source: focusSource,
    });
  }
  actionEditFocus.value = {
    ...createEmptyWorkbenchActionEditFocus(actionEditFocus.value.sequence + 1),
    actionId,
    fieldKey: 'startMs',
    label,
    changeSummary,
    editOrigin: focusSource,
    focusSource,
  };
  void nextTick().then(() => {
    scrollActionEditFocusIntoView();
  });
  return true;
}

function createWorkbenchProjectFromDraft(draft) {
  const compatibility = createWorkbenchProfileCompatibilityReport(draft);
  const gameDataCompatibility = getWorkbenchGameDataCompatibilityReport(draft);
  return createWorkbenchProject(draft.selection, {
    teamSlots: draft.teamSlots,
    actorConfigs: draft.actorConfigs,
    enemyConfig: draft.enemyConfig,
    configurationLibrary:
      draft.configurationLibrary ?? configurationLibrary.value,
    configurationSelection: draft.configurationSelection,
    gameDataBinding: draft.gameDataBinding ?? gameDataBinding.value,
    gameDataCompatibilityReport: gameDataCompatibility,
    mechanicsProfileSelection: draft.mechanicsProfileSelection,
    mechanicsProfileCompatibilityReport: compatibility,
    actions: draft.actionDrafts,
    actionRelations: draft.actionRelations,
    cycleBoundaries: draft.cycleBoundaries,
    initialRuntimeState: draft.initialRuntimeState,
    runtimeSampleCaptures: draft.runtimeSampleCaptures,
  });
}

function getWorkbenchDraftState() {
  const activeDraft = createWorkbenchScenarioDraftSnapshot(
    getCurrentWorkbenchScenarioState()
  );
  return {
    ...activeDraft,
    gameDataBinding: gameDataBinding.value,
    configurationLibrary: configurationLibrary.value,
    scenarioWorkspace: synchronizeActiveWorkbenchScenario(
      scenarioWorkspace.value,
      activeDraft
    ),
  };
}

function getCurrentWorkbenchScenarioState() {
  return {
    selection: selection.value,
    teamSlots: teamSlots.value,
    actorConfigs: actorConfigs.value,
    enemyConfig: enemyConfig.value,
    configurationSelection: configurationSelection.value,
    mechanicsProfileSelection: mechanicsProfileSelection.value,
    segmentSplitOptions: segmentSplitOptions.value,
    actionDrafts: actionDrafts.value,
    actionRelations: actionRelations.value,
    cycleBoundaries: cycleBoundaries.value,
    initialRuntimeState: initialRuntimeState.value,
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

function exportContributionAnalysisReport(windowId = 'full-axis') {
  try {
    const report = createWorkbenchContributionAnalysisReport({
      project: project.value,
      source: {
        label: activeWorkbenchScenario.value?.name ?? '当前方案',
        sourceKind: 'workspace-scenario',
        sourceId: scenarioWorkspace.value.activeScenarioId,
        draft: createWorkbenchScenarioDraftSnapshot(
          getCurrentWorkbenchScenarioState()
        ),
      },
      contributionProjection: cycleSectionProjection.value,
      runtimeOutputs: runtimeOutputs.value,
      windowId,
    });
    downloadWorkbenchAnalysisReport(report, '已导出贡献分析报告');
  } catch {
    draftStatus.value = '贡献分析报告导出失败';
  }
}

function exportScenarioComparisonAnalysisReport() {
  try {
    const comparison = scenarioComparison.value;
    const report = createWorkbenchScenarioComparisonAnalysisReport({
      project: project.value,
      comparison,
      currentSource: {
        label: comparison.current.label,
        sourceKind: comparison.current.sourceKind,
        sourceId: comparison.current.sourceId,
        projectId: comparison.current.projectId,
        projectName: comparison.current.projectName,
        draft: createWorkbenchScenarioDraftSnapshot(
          getCurrentWorkbenchScenarioState()
        ),
      },
      baselineSource: {
        label: comparison.baseline?.label,
        sourceKind: comparison.baseline?.sourceKind,
        sourceId: comparison.baseline?.sourceId,
        projectId: comparison.baseline?.projectId,
        projectName: comparison.baseline?.projectName,
        draft: comparisonBaselineDraft.value,
      },
      currentRuntimeOutputs: runtimeOutputs.value,
      baselineRuntimeOutputs:
        comparisonBaselineSimulationResult.value?.runtimeOutputs,
    });
    downloadWorkbenchAnalysisReport(report, '已导出方案对比分析报告');
  } catch {
    draftStatus.value = '方案对比分析报告导出失败';
  }
}

function downloadWorkbenchAnalysisReport(report, statusText) {
  if (typeof document === 'undefined' || typeof Blob === 'undefined') {
    throw new Error('Analysis report export is unavailable');
  }
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: 'application/json',
  });
  downloadWorkbenchBlob(blob, createWorkbenchAnalysisReportFileName(report));
  draftStatus.value = statusText;
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

  if (!applyImportedProjectDraft(draft, '已导入分享项目')) {
    clearWorkbenchProjectShareCodeFromUrl();
    return true;
  }
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
    await receiveWorkbenchProjectFile(file);
  } finally {
    input.value = '';
  }
}

async function receiveWorkbenchProjectFile(file, source = 'picker') {
  const receiver = await import('../domain/workbenchProjectFileReceiver');
  await receiver.processWorkbenchProjectFile(file, {
    source,
    onProject: applyImportedProjectDraft,
    onAnalysisReport: (report, validation, statusText) => {
      importedAnalysisReport.value = report;
      importedAnalysisReportValidation.value = validation;
      analysisReportDialogVisible.value = true;
      draftStatus.value = statusText;
      return true;
    },
    onRuntimeCapture: async captures => {
      await ensureRuntimeDiagnosticsLoaded();
      applyImportedRuntimeSampleCaptures(captures);
    },
    onStatus: statusText => (draftStatus.value = statusText),
  });
}

function closeAnalysisReport() {
  analysisReportDialogVisible.value = false;
}

function locateImportedAnalysisReportSource({
  role = 'current',
  actionId = '',
  statePointId = '',
  frameIndex = null,
} = {}) {
  const source = importedAnalysisReport.value?.sources?.find(
    item => item.role === role
  );
  if (!source?.scenarioDraft) {
    draftStatus.value = '分析报告来源不可用';
    return false;
  }
  const result = addWorkbenchScenarioFromDraft(
    scenarioWorkspace.value,
    createWorkbenchScenarioDraftSnapshot(getCurrentWorkbenchScenarioState()),
    source.scenarioDraft,
    `报告：${source.label}`
  );
  if (!result.changed && result.reason === 'scenario-limit-reached') {
    draftStatus.value = `方案数量已达上限（${MAX_WORKBENCH_SCENARIOS}）`;
    return false;
  }
  if (!applyWorkspaceScenarioMutation(result, '已从分析报告恢复来源')) {
    return false;
  }
  closeAnalysisReport();
  if (!actionId) {
    return true;
  }
  return focusScenarioComparisonAction(
    { actionId, statePointId, frameIndex },
    {
      focusSource: 'analysis-report',
      changeSummary: '已从分析报告恢复来源并定位动作',
      label: '分析报告',
    }
  );
}

function receiveDroppedWorkbenchProjectFiles(files) {
  if (files.length !== 1) {
    draftStatus.value = '一次只能导入一个项目文件';
    return;
  }
  void receiveWorkbenchProjectFile(files[0], 'drop');
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

function applyImportedProjectDraft(draft, statusText) {
  const compatibility = createWorkbenchProfileCompatibilityReport(draft);
  if (!compatibility.importAllowed) {
    draftStatus.value = '项目机制配置不兼容';
    return false;
  }
  const gameDataCompatibility = getWorkbenchGameDataCompatibilityReport(draft);
  if (!gameDataCompatibility.importAllowed) {
    draftStatus.value = '项目游戏数据不兼容';
    return false;
  }
  clearSegmentSplitPreview();
  projectShareUrl.value = '';
  applyDraftState(draft);
  clearWorkbenchProjectTransientState();
  undoHistoryStack.value = [];
  redoHistoryStack.value = [];
  const snapshot = saveWorkbenchDraft(
    getLocalStorage(),
    getWorkbenchDraftState()
  );
  draftStatus.value = snapshot ? statusText : `${statusText}（未持久化）`;
  if (draft.runtimeSampleCaptures?.length) {
    void ensureRuntimeDiagnosticsLoaded();
  }
  return true;
}

function resetDraft() {
  clearWorkbenchDraft(getLocalStorage());
  projectShareUrl.value = '';
  applyDraftState(createDefaultWorkbenchDraftState());
  clearWorkbenchProjectTransientState();
  clearSegmentSplitPreview();
  undoHistoryStack.value = [];
  redoHistoryStack.value = [];
  draftStatus.value = '已重置草稿';
}

function applyDraftState(draft) {
  const normalizedDraft = createWorkbenchDraftSnapshot(
    draft,
    draft?.savedAt ?? null
  );
  gameDataBinding.value = normalizeWorkbenchGameDataBinding(
    normalizedDraft.gameDataBinding
  );
  configurationLibrary.value = cloneWorkbenchHistoryValue(
    normalizedDraft.configurationLibrary
  );
  scenarioWorkspace.value = cloneWorkbenchHistoryValue(
    normalizedDraft.scenarioWorkspace
  );
  applyWorkbenchScenarioDraftState(normalizedDraft);
}

function applyWorkbenchScenarioDraftState(draft) {
  teamSlots.value = normalizeWorkbenchTeamSlots(
    draft.teamSlots,
    draft.selection
  );
  selection.value = normalizeWorkbenchSelection(
    draft.selection,
    teamSlots.value
  );
  applyWorkbenchConfigurationState(
    reconcileWorkbenchConfigurationState({
      configurationLibrary: configurationLibrary.value,
      configurationSelection: draft.configurationSelection,
      selection: selection.value,
      actorConfigs: draft.actorConfigs,
      enemyConfig: draft.enemyConfig,
      syncSelectedValues: false,
    })
  );
  mechanicsProfileSelection.value = normalizeWorkbenchMechanicsProfileSelection(
    draft.mechanicsProfileSelection
  );
  segmentSplitOptions.value = normalizeWorkbenchSegmentSplitOptions(
    draft.segmentSplitOptions
  );
  actionDrafts.value = normalizeWorkbenchActionDrafts(
    draft.actionDrafts,
    selection.value,
    teamSlots.value
  );
  actionRelations.value = normalizeWorkbenchActionRelations(
    draft.actionRelations,
    actionDrafts.value
  );
  cycleBoundaries.value = normalizeWorkbenchCycleBoundaries(
    draft.cycleBoundaries,
    project.value.time.durationMs
  );
  initialRuntimeState.value = cloneWorkbenchHistoryValue(
    draft.initialRuntimeState
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

function applyWorkbenchConfigurationState(state) {
  configurationLibrary.value = cloneWorkbenchHistoryValue(
    state.configurationLibrary
  );
  configurationSelection.value = cloneWorkbenchHistoryValue(
    state.configurationSelection
  );
  actorConfigs.value = normalizeWorkbenchActorConfigs(
    state.actorConfigs,
    selection.value,
    teamSlots.value
  );
  enemyConfig.value = normalizeWorkbenchEnemyConfig(state.enemyConfig);
}

function clearWorkbenchProjectTransientState() {
  pauseTimelinePlayback();
  selectedStateCurvePointId.value = '';
  timelineCursorFrameIndex.value = 0;
  timelinePlaybackRate.value = 1;
  timelinePlaybackRangeMode.value = 'axis';
  stateCurveFocusMode.value = 'all';
  stateCurveLayerFilters.value = { ...DEFAULT_STATE_CURVE_LAYER_FILTERS };
  stateCurveTrackFilters.value = {};
  calculatorDiagnosticScope.value = '';
  calculatorDiagnosticFocus.value = { scope: '', sequence: 0 };
  runtimeLogFocus.value = { source: '', statePointId: '', sequence: 0 };
  workbenchFlowDispatchState.value = createEmptyWorkbenchFlowDispatchState();
  selectedActionRelationId.value = '';
  selectedCycleBoundaryId.value = '';
  selectedCycleSectionId.value = '';
  selectedEffectIntervalId.value = '';
  selectedEffectEventId.value = '';
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
      if (selectedCycleBoundaryId.value) {
        deleteCycleBoundary(selectedCycleBoundaryId.value);
      } else if (selectedActionRelationId.value) {
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
      configurationLibrary: configurationLibrary.value,
      configurationSelection: configurationSelection.value,
      mechanicsProfileSelection: mechanicsProfileSelection.value,
      segmentSplitOptions: segmentSplitOptions.value,
      actionDrafts: actionDrafts.value,
      actionRelations: actionRelations.value,
      cycleBoundaries: cycleBoundaries.value,
      initialRuntimeState: initialRuntimeState.value,
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
    configurationLibrary: draftSnapshot.configurationLibrary,
    configurationSelection: draftSnapshot.configurationSelection,
    mechanicsProfileSelection: draftSnapshot.mechanicsProfileSelection,
    segmentSplitOptions: draftSnapshot.segmentSplitOptions,
    actionDrafts: draftSnapshot.actionDrafts,
    actionRelations: draftSnapshot.actionRelations,
    cycleBoundaries: draftSnapshot.cycleBoundaries,
    initialRuntimeState: draftSnapshot.initialRuntimeState,
    runtimeSampleCaptures: draftSnapshot.runtimeSampleCaptures,
    selectedActionId: draftSnapshot.selectedActionId,
    selectedActionIds: selectedActionIds.value,
    actionSelectionAnchorId: actionSelectionAnchorId.value,
    selectedActionRelationId: selectedActionRelationId.value,
    selectedCycleBoundaryId: selectedCycleBoundaryId.value,
    selectedCycleSectionId: selectedCycleSectionId.value,
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
  applyWorkbenchConfigurationState(
    reconcileWorkbenchConfigurationState({
      configurationLibrary: snapshot.configurationLibrary,
      configurationSelection: snapshot.configurationSelection,
      selection: selection.value,
      actorConfigs: snapshot.actorConfigs,
      enemyConfig: snapshot.enemyConfig,
      syncSelectedValues: false,
    })
  );
  mechanicsProfileSelection.value = normalizeWorkbenchMechanicsProfileSelection(
    snapshot.mechanicsProfileSelection
  );
  segmentSplitOptions.value = normalizeWorkbenchSegmentSplitOptions(
    snapshot.segmentSplitOptions
  );
  actionDrafts.value = normalizeWorkbenchActionDrafts(
    snapshot.actionDrafts,
    selection.value,
    teamSlots.value
  );
  actionRelations.value = normalizeWorkbenchActionRelations(
    snapshot.actionRelations,
    actionDrafts.value
  );
  cycleBoundaries.value = normalizeWorkbenchCycleBoundaries(
    snapshot.cycleBoundaries,
    project.value.time.durationMs
  );
  initialRuntimeState.value = cloneWorkbenchHistoryValue(
    snapshot.initialRuntimeState
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
  selectedCycleBoundaryId.value = cycleBoundaries.value.some(
    boundary => boundary.id === snapshot.selectedCycleBoundaryId
  )
    ? snapshot.selectedCycleBoundaryId
    : '';
  selectedCycleSectionId.value = cycleSectionProjection.value.sections.some(
    section => section.sectionId === snapshot.selectedCycleSectionId
  )
    ? snapshot.selectedCycleSectionId
    : (cycleSectionProjection.value.sections[0]?.sectionId ?? '');
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
  selectedCycleBoundaryId.value = '';
  selectedEffectIntervalId.value = '';
  selectedEffectEventId.value = '';
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
  selectTimelineFrame({
    timeMs: draft?.startMs,
    source: 'action-selection',
  });
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
  selectTimelineFrame({
    timeMs: draft?.startMs,
    source: 'action-group-selection',
  });
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
  selectedCycleBoundaryId.value = '';
  selectedEffectIntervalId.value = '';
  selectedEffectEventId.value = '';
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

function selectEffectInterval({ intervalId = '', eventId = '' } = {}) {
  const interval = effectIntervalProjection.value.intervals.find(
    item => item.intervalId === intervalId
  );
  if (!interval) {
    return false;
  }
  selectedActionRelationId.value = '';
  selectedCycleBoundaryId.value = '';
  boxSelectionMode.value = false;
  selectedEffectIntervalId.value = interval.intervalId;
  selectedEffectEventId.value = interval.lifecycleEventIds.includes(eventId)
    ? eventId
    : interval.selectionEventId;
  return true;
}

function selectEffectEvent(eventId) {
  const interval = effectIntervalProjection.value.intervals.find(item =>
    item.lifecycleEventIds.includes(eventId)
  );
  if (!interval) {
    selectedEffectEventId.value = '';
    return false;
  }
  selectedEffectIntervalId.value = interval.intervalId;
  selectedEffectEventId.value = eventId;
  selectedActionRelationId.value = '';
  selectedCycleBoundaryId.value = '';
  return true;
}

function addCycleBoundary(timeMs) {
  const result = addWorkbenchCycleBoundary(
    cycleBoundaries.value,
    timeMs,
    scenario.value.time.durationMs
  );
  if (!result.createdBoundary) {
    return false;
  }
  recordWorkbenchHistorySnapshot();
  cycleBoundaries.value = result.boundaries;
  selectCycleBoundary(result.createdBoundary.id);
  markDraftDirty();
  return true;
}

function updateCycleBoundary({ boundaryId = '', timeMs = 0 } = {}) {
  const nextBoundaries = updateWorkbenchCycleBoundary(
    cycleBoundaries.value,
    boundaryId,
    timeMs,
    scenario.value.time.durationMs
  );
  if (
    JSON.stringify(nextBoundaries) === JSON.stringify(cycleBoundaries.value)
  ) {
    return false;
  }
  recordWorkbenchHistorySnapshot();
  cycleBoundaries.value = nextBoundaries;
  selectCycleBoundary(boundaryId);
  markDraftDirty();
  return true;
}

function deleteCycleBoundary(boundaryId = selectedCycleBoundaryId.value) {
  if (!cycleBoundaries.value.some(boundary => boundary.id === boundaryId)) {
    return false;
  }
  recordWorkbenchHistorySnapshot();
  cycleBoundaries.value = cycleBoundaries.value.filter(
    boundary => boundary.id !== boundaryId
  );
  if (!cycleBoundaries.value.length) {
    updateTimelinePlaybackRangeMode('axis');
  }
  selectedCycleBoundaryId.value = '';
  selectedCycleSectionId.value =
    cycleSectionProjection.value.sections[0]?.sectionId ?? '';
  markDraftDirty();
  return true;
}

function selectCycleBoundary(boundaryId) {
  if (!cycleBoundaries.value.some(boundary => boundary.id === boundaryId)) {
    return false;
  }
  selectedCycleBoundaryId.value = boundaryId;
  selectedActionRelationId.value = '';
  selectedEffectIntervalId.value = '';
  selectedEffectEventId.value = '';
  boxSelectionMode.value = false;
  selectedCycleSectionId.value =
    cycleSectionProjection.value.sections.find(
      section => section.startBoundaryId === boundaryId
    )?.sectionId ??
    cycleSectionProjection.value.sections.find(
      section => section.endBoundaryId === boundaryId
    )?.sectionId ??
    '';
  return true;
}

function selectCycleSection(sectionId) {
  const section = cycleSectionProjection.value.sections.find(
    item => item.sectionId === sectionId
  );
  if (!section) {
    return false;
  }
  selectedCycleSectionId.value = section.sectionId;
  if (timelinePlaybackRangeMode.value === 'section') {
    pauseTimelinePlayback();
    selectTimelineFrame({
      frameIndex: msToFrame(section.startMs),
      source: 'timeline-playback-range',
    });
  }
  return true;
}

function selectContributionWindow(windowId) {
  if (windowId === 'full-axis') {
    selectedCycleSectionId.value = '';
    return true;
  }
  return selectCycleSection(windowId);
}

function locateCycleSectionAction(request) {
  const actionId =
    typeof request === 'object' ? String(request?.actionId ?? '') : request;
  if (!findActionDraftById(actionId)) {
    return false;
  }
  selectAction(actionId, { syncRuntimeResult: false });
  if (request?.statePointId) {
    selectStateCurvePoint(request.statePointId);
  }
  if (
    request?.frameIndex != null &&
    request.frameIndex !== '' &&
    Number.isFinite(Number(request.frameIndex))
  ) {
    selectTimelineFrame({
      frameIndex: Number(request.frameIndex),
      statePointId: request.statePointId ?? '',
      source: 'contribution-analysis',
    });
  }
  actionEditFocus.value = {
    ...createEmptyWorkbenchActionEditFocus(actionEditFocus.value.sequence + 1),
    actionId,
    fieldKey: 'startMs',
    label: '贡献分析',
    changeSummary: '从时间窗口贡献返回当前动作修改',
    editOrigin: 'contribution-window',
    focusSource: 'contribution-window',
  };
  void nextTick().then(() => scrollActionEditFocusIntoView());
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

function openCycleBoundaryContextMenu({ boundaryId = '', x = 0, y = 0 } = {}) {
  if (!selectCycleBoundary(boundaryId)) {
    return;
  }
  actionContextMenu.value = {
    kind: 'cycle-boundary',
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

function selectTimelineFrame({
  frameIndex = null,
  timeMs = null,
  statePointId = '',
  source = 'timeline-grid',
} = {}) {
  if (source !== 'timeline-playback') {
    pauseTimelinePlayback();
  }
  const hasFrameIndex =
    frameIndex !== null && frameIndex !== undefined && frameIndex !== '';
  const requestedFrame = hasFrameIndex ? Number(frameIndex) : msToFrame(timeMs);
  timelineCursorFrameIndex.value = clampNumber(
    Math.round(requestedFrame),
    0,
    msToFrame(scenario.value.time.durationMs)
  );
  if (!statePointId && ['timeline-grid', 'timeline-cursor'].includes(source)) {
    workbenchFlowRuntime.applyRuntimePointSelection({ statePointId: '' });
  }
}

function toggleTimelinePlayback() {
  return timelinePlaybackRunning.value
    ? pauseTimelinePlayback()
    : startTimelinePlayback();
}

function startTimelinePlayback() {
  if (timelinePlaybackRunning.value) {
    return true;
  }
  const range = timelinePlaybackRange.value;
  const cursorOutsideRange =
    timelineCursorFrameIndex.value < range.startFrame ||
    timelineCursorFrameIndex.value > range.lastFrame;
  const axisFinished =
    !range.loop && timelineCursorFrameIndex.value >= range.endFrame;
  if (cursorOutsideRange || axisFinished) {
    selectTimelineFrame({
      frameIndex: range.startFrame,
      source: 'timeline-playback',
    });
  }
  timelinePlaybackRunning.value = true;
  timelinePlaybackLastTimestamp = null;
  timelinePlaybackFrameRemainder = 0;
  scheduleTimelinePlaybackFrame();
  return true;
}

function pauseTimelinePlayback() {
  const wasRunning = timelinePlaybackRunning.value;
  timelinePlaybackRunning.value = false;
  timelinePlaybackLastTimestamp = null;
  timelinePlaybackFrameRemainder = 0;
  if (
    timelinePlaybackAnimationFrameId !== null &&
    typeof window !== 'undefined'
  ) {
    window.cancelAnimationFrame?.(timelinePlaybackAnimationFrameId);
  }
  timelinePlaybackAnimationFrameId = null;
  return wasRunning;
}

function scheduleTimelinePlaybackFrame() {
  if (
    !timelinePlaybackRunning.value ||
    typeof window === 'undefined' ||
    typeof window.requestAnimationFrame !== 'function'
  ) {
    return;
  }
  timelinePlaybackAnimationFrameId = window.requestAnimationFrame(
    advanceTimelinePlaybackClock
  );
}

function advanceTimelinePlaybackClock(timestamp) {
  timelinePlaybackAnimationFrameId = null;
  if (!timelinePlaybackRunning.value) {
    return;
  }
  if (timelinePlaybackLastTimestamp === null) {
    timelinePlaybackLastTimestamp = timestamp;
    scheduleTimelinePlaybackFrame();
    return;
  }
  const elapsedMs = Math.max(0, timestamp - timelinePlaybackLastTimestamp);
  timelinePlaybackLastTimestamp = timestamp;
  const frameRate = Math.max(1, Number(scenario.value.time.fps) || 60);
  const frameProgress =
    timelinePlaybackFrameRemainder +
    (elapsedMs * frameRate * timelinePlaybackRate.value) / 1000;
  const frameDelta = Math.floor(frameProgress);
  timelinePlaybackFrameRemainder = frameProgress - frameDelta;
  if (frameDelta > 0) {
    advanceTimelinePlaybackFrames(frameDelta);
  }
  scheduleTimelinePlaybackFrame();
}

function advanceTimelinePlaybackFrames(frameDelta) {
  const range = timelinePlaybackRange.value;
  if (range.loop) {
    const span = Math.max(1, range.endFrame - range.startFrame);
    const current =
      timelineCursorFrameIndex.value >= range.startFrame &&
      timelineCursorFrameIndex.value < range.endFrame
        ? timelineCursorFrameIndex.value
        : range.startFrame;
    selectTimelineFrame({
      frameIndex:
        range.startFrame +
        positiveModulo(current - range.startFrame + frameDelta, span),
      source: 'timeline-playback',
    });
    return;
  }
  const nextFrame = Math.min(
    range.endFrame,
    timelineCursorFrameIndex.value + frameDelta
  );
  selectTimelineFrame({
    frameIndex: nextFrame,
    source: 'timeline-playback',
  });
  if (nextFrame >= range.endFrame) {
    pauseTimelinePlayback();
  }
}

function stepTimelinePlaybackFrame(direction) {
  pauseTimelinePlayback();
  const range = timelinePlaybackRange.value;
  const step = Number(direction) < 0 ? -1 : 1;
  if (range.loop) {
    const span = Math.max(1, range.endFrame - range.startFrame);
    const current =
      timelineCursorFrameIndex.value >= range.startFrame &&
      timelineCursorFrameIndex.value < range.endFrame
        ? timelineCursorFrameIndex.value
        : range.startFrame;
    selectTimelineFrame({
      frameIndex:
        range.startFrame +
        positiveModulo(current - range.startFrame + step, span),
      source: 'timeline-playback-step',
    });
    return;
  }
  selectTimelineFrame({
    frameIndex: clampNumber(
      timelineCursorFrameIndex.value + step,
      range.startFrame,
      range.endFrame
    ),
    source: 'timeline-playback-step',
  });
}

function updateTimelinePlaybackRate(value) {
  const rate = Number(value);
  if (!TIMELINE_PLAYBACK_RATES.has(rate)) {
    return false;
  }
  timelinePlaybackRate.value = rate;
  timelinePlaybackLastTimestamp = null;
  timelinePlaybackFrameRemainder = 0;
  return true;
}

function updateTimelinePlaybackRangeMode(mode) {
  const nextMode = mode === 'section' ? 'section' : 'axis';
  if (nextMode === 'section' && !cycleBoundaries.value.length) {
    return false;
  }
  pauseTimelinePlayback();
  timelinePlaybackRangeMode.value = nextMode;
  if (nextMode === 'section') {
    selectTimelineFrame({
      frameIndex: timelinePlaybackRange.value.startFrame,
      source: 'timeline-playback-range',
    });
  }
  return true;
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
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

function resolveWorkbenchTimelineLaneTarget(laneId) {
  const topology = project.value.metadata.timelineTopology;
  for (const group of topology?.actorGroups ?? []) {
    if (group.actionLane?.laneId === laneId) {
      return {
        laneId,
        kind: WORKBENCH_TIMELINE_LANE_KINDS.ACTOR_ACTION,
        actorId: group.actorId,
        characterId: group.characterId,
      };
    }
    if (group.kiboLane?.laneId === laneId) {
      return {
        laneId,
        kind: WORKBENCH_TIMELINE_LANE_KINDS.ACTOR_KIBO,
        actorId: group.actorId,
        characterId: group.characterId,
      };
    }
  }
  if (topology?.enemyGroup?.eventLane?.laneId === laneId) {
    return {
      laneId,
      kind: WORKBENCH_TIMELINE_LANE_KINDS.ENEMY_EVENT,
      actorId: null,
      characterId: null,
    };
  }
  return null;
}

function resolveDraftLaneId(action) {
  if (action?.type === ACTION_TYPES.ENEMY_EVENT) {
    return ENEMY_TIMELINE_LANE_ID;
  }
  if (action?.type === ACTION_TYPES.KIBO_EVENT) {
    return (
      project.value.metadata.timelineTopology?.actorGroups?.find(
        group => Number(group.characterId) === Number(action.actorCharacterId)
      )?.kiboLane?.laneId ?? SYSTEM_TIMELINE_LANE_ID
    );
  }
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
    ACTION_TYPES.KIBO_EVENT,
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
      configuration: 3,
      enemy: 4,
      teamLoadout: 5,
      analysis: 6,
    };
  }

  return {
    properties: 0,
    actionRules: 1,
    configuration: 2,
    enemy: 3,
    runtimeDetail: 4,
    teamLoadout: 5,
    analysis: 6,
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
  grid-template-columns:
    minmax(0, var(--workbench-left-panel-width, 260px))
    14px
    minmax(0, 1fr)
    14px
    minmax(0, var(--workbench-right-panel-width, 300px));
  grid-template-areas:
    'mainflow mainflow mainflow mainflow mainflow'
    'actions left-resizer review right-resizer inspector';
  gap: 14px 0;
  padding: 14px;
}

.action-library {
  grid-area: actions;
  min-width: 0;
  overflow: hidden;
}

.primary-flow {
  display: grid;
  grid-area: mainflow;
  align-content: start;
  gap: 14px;
  min-width: 0;
}

.review-workspace {
  display: grid;
  grid-area: review;
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
.cycle-review-area,
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
  min-width: 0;
}

.workspace-resizer {
  position: relative;
  min-width: 0;
  cursor: ew-resize;
  touch-action: none;
}

.workspace-resizer-left {
  grid-area: left-resizer;
}

.workspace-resizer-right {
  grid-area: right-resizer;
}

.workspace-resizer::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  content: '';
  background: #323d44;
  transform: translateX(-50%);
}

.workspace-resizer::after {
  position: absolute;
  inset: 0 3px;
  content: '';
}

.workspace-resizer:hover::before,
.workspace-resizer:focus-visible::before,
.workspace-resizer.active::before {
  width: 2px;
  background: #79c7b9;
}

.workspace-resizer:focus-visible {
  outline: 1px solid #79c7b9;
  outline-offset: -4px;
}

.workbench-grid.layout-left-collapsed {
  grid-template-columns:
    0
    0
    minmax(0, 1fr)
    14px
    minmax(0, var(--workbench-right-panel-width, 300px));
}

.workbench-grid.layout-right-collapsed {
  grid-template-columns:
    minmax(0, var(--workbench-left-panel-width, 260px))
    14px
    minmax(0, 1fr)
    0
    0;
}

.workbench-grid.layout-left-collapsed.layout-right-collapsed {
  grid-template-columns: 0 0 minmax(0, 1fr) 0 0;
}

.workbench-grid.layout-left-collapsed .action-library,
.workbench-grid.layout-right-collapsed .side-stack {
  visibility: hidden;
  pointer-events: none;
}

.workbench-grid.layout-left-collapsed .workspace-resizer-left,
.workbench-grid.layout-right-collapsed .workspace-resizer-right {
  display: none;
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

@media (max-width: 1180px) {
  .workbench-grid {
    grid-template-columns:
      minmax(220px, var(--workbench-left-panel-width, 260px))
      minmax(0, 1fr);
    grid-template-areas:
      'mainflow mainflow'
      'review review'
      'actions inspector';
    column-gap: 14px;
  }

  .workbench-grid.layout-left-collapsed,
  .workbench-grid.layout-left-collapsed.layout-right-collapsed {
    grid-template-columns: 0 minmax(0, 1fr);
  }

  .workbench-grid.layout-right-collapsed {
    grid-template-areas:
      'mainflow mainflow'
      'review review'
      'actions actions';
  }

  .workspace-resizer {
    display: none;
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

  .workbench-grid,
  .workbench-grid.layout-left-collapsed,
  .workbench-grid.layout-right-collapsed,
  .workbench-grid.layout-left-collapsed.layout-right-collapsed {
    grid-template-columns: 1fr;
    grid-template-areas:
      'mainflow'
      'review'
      'actions'
      'inspector';
    padding: 10px;
  }

  .workbench-grid.layout-left-collapsed .action-library,
  .workbench-grid.layout-right-collapsed .side-stack {
    visibility: visible;
    pointer-events: auto;
  }

  .runtime-review-stack[data-runtime-review-layout='result-check'] {
    grid-template-columns: 1fr;
  }
}
</style>
