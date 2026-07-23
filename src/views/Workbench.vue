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
    :data-energy-curve-count="
      project.metadata.timelineTopology?.summary?.energyCurveCount ?? 0
    "
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
    :data-library-entry-drag-active="
      actionLibraryTimelineEntryDrag?.active ? 'true' : 'false'
    "
    :data-library-entry-drag-target-lane-id="
      actionLibraryTimelineEntryDrag?.targetLaneId ?? ''
    "
    :data-action-placement-mode="actionPlacementMode"
    :data-action-placement-status="
      actionPlacementPreview?.proposal?.status ??
      lastActionPlacementProposal?.status ??
      ''
    "
    :data-action-placement-preview-active="
      actionPlacementPreview?.active ? 'true' : 'false'
    "
    :data-timeline-fragment-count="workbenchTimelineFragments.length"
  >
    <nav class="top-nav">
      <div class="workbench-brand" aria-label="蓝色星原排轴工作台">
        <Aim class="nav-icon" />
        <span>蓝色星原排轴</span>
      </div>
      <div class="nav-side">
        <span class="draft-status" data-testid="workbench-draft-status">{{
          draftStatus
        }}</span>
        <div class="nav-actions">
          <button
            class="nav-button icon-only secondary"
            :data-history-count="workbenchHistoryView.undoCount"
            data-testid="workbench-undo-edit"
            type="button"
            aria-keyshortcuts="Control+Z Meta+Z"
            :disabled="!workbenchHistoryView.canUndo"
            title="撤销上一步编辑"
            @click="undoWorkbenchEdit"
          >
            <ArrowLeft class="button-icon" />
          </button>
          <button
            class="nav-button icon-only secondary"
            :data-history-count="workbenchHistoryView.redoCount"
            data-testid="workbench-redo-edit"
            type="button"
            aria-keyshortcuts="Control+Y Meta+Y Control+Shift+Z Meta+Shift+Z"
            :disabled="!workbenchHistoryView.canRedo"
            title="重做上一步编辑"
            @click="redoWorkbenchEdit"
          >
            <ArrowRight class="button-icon" />
          </button>
          <button
            class="nav-button"
            data-testid="workbench-save-draft"
            type="button"
            @click="saveDraft"
          >
            <Document class="button-icon" />
            <span>保存</span>
          </button>
          <button
            class="nav-button run-command"
            data-testid="workbench-open-runtime"
            type="button"
            :disabled="!mainFlowCommandSurface.openRuntimeResults.view.enabled"
            @click="
              dispatchWorkbenchFlowAction(
                mainFlowCommandSurface.openRuntimeResults.action
              )
            "
          >
            <TrendCharts class="button-icon" />
            <span>运行</span>
          </button>
          <button
            class="nav-button icon-only secondary"
            :class="{ active: timelinePlaybackRunning }"
            data-testid="workbench-top-playback-toggle"
            type="button"
            :title="timelinePlaybackRunning ? '暂停时间轴' : '播放时间轴'"
            :aria-label="timelinePlaybackRunning ? '暂停时间轴' : '播放时间轴'"
            @click="toggleTimelinePlayback"
          >
            <VideoPause v-if="timelinePlaybackRunning" class="button-icon" />
            <VideoPlay v-else class="button-icon" />
          </button>
          <details class="project-menu" data-testid="workbench-project-menu">
            <summary title="项目与高级功能">
              <FolderOpened class="button-icon" />
              <span>项目</span>
              <ArrowDown class="menu-chevron" />
            </summary>
            <div class="project-menu-panel">
              <button
                data-testid="workbench-open-presets"
                type="button"
                @click="openWorkbenchPresetLibrary"
              >
                <FolderOpened class="button-icon" />
                <span>预设库</span>
              </button>
              <button
                data-testid="workbench-open-comparison"
                type="button"
                @click="openScenarioComparison"
              >
                <TrendCharts class="button-icon" />
                <span>方案对比</span>
              </button>
              <button
                data-testid="workbench-export-project"
                type="button"
                @click="exportProjectFile"
              >
                <Download class="button-icon" />
                <span>导出 JSON</span>
              </button>
              <button
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
                data-testid="workbench-import-project"
                type="button"
                @click="openProjectImport"
              >
                <Upload class="button-icon" />
                <span>导入项目</span>
              </button>
              <button
                :data-share-url="projectShareUrl"
                data-testid="workbench-share-project"
                type="button"
                @click="copyProjectShareLink"
              >
                <LinkIcon class="button-icon" />
                <span>分享链接</span>
              </button>
              <button
                data-testid="workbench-reset-draft"
                type="button"
                @click="resetDraft"
              >
                <Refresh class="button-icon" />
                <span>重置方案</span>
              </button>
              <div class="project-menu-status">
                <span>真实数据</span>
                <span>Schema v{{ project.schemaVersion }}</span>
                <span>{{ simulationResult.summary.formulaVersion }}</span>
              </div>
            </div>
          </details>
          <input
            ref="projectImportInput"
            class="project-import-input"
            data-testid="workbench-import-project-file"
            type="file"
            accept=".json,.jsonl,.ndjson,.promilia-workbench.json,.png,application/json,application/x-ndjson,image/png"
            @change="importProjectFile"
          />
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

    <WorkbenchLoadoutPicker
      v-if="loadoutPickerRequest"
      :request="loadoutPickerRequest"
      :characters="workbenchSeed.gameData.characters"
      :enemies="gameData.enemies"
      :team-slots="teamSlots"
      @catalog-loaded="installLoadoutDetailCatalog"
      @select="applyLoadoutPickerSelection"
      @close="closeLoadoutPicker"
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
      ref="analysisReportDialog"
      :visible="analysisReportDialogVisible"
      :report="importedAnalysisReport"
      :validation="importedAnalysisReportValidation"
      :reproducibility-audit="analysisReportReproducibilityAudit"
      :exporting-png="analysisReportPngExporting"
      @close="closeAnalysisReport"
      @locate-source="locateImportedAnalysisReportSource"
      @export-json="exportImportedAnalysisReportJson"
      @export-png="exportImportedAnalysisReportPng"
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
        :kibos="actionLibraryKibos"
        :active-actor-character-id="actionLibraryCharacterId"
        :actions="scenario.actions"
        :main-flow-command-surface="mainFlowCommandSurface"
        :runtime-action-results="runtimeActionResults"
        :action-readiness-timeline="simulationResult.actionReadinessTimeline"
        :skills="actionLibrarySkills"
        :selected-action-id="selectedActionId"
        :selected-action-ids="selectedActionIds"
        :timeline-fragments="workbenchTimelineFragmentViews"
        :mechanics-revision="runtimeDiagnosticsRevision"
        @select-action="selectAction"
        @open-action-context-menu="openActionContextMenu"
        @delete-selected-actions="deleteSelectedActions"
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
        @begin-timeline-entry-drag="beginActionLibraryEntryPointerDrag"
        @save-timeline-fragment="saveSelectedActionsAsTimelineFragment"
        @insert-timeline-fragment="insertTimelineFragment"
        @duplicate-timeline-fragment="duplicateTimelineFragment"
        @delete-timeline-fragment="deleteTimelineFragment"
        @export-timeline-fragment-library="exportTimelineFragmentLibrary"
        @import-timeline-fragment-library="importTimelineFragmentLibrary"
        @begin-timeline-fragment-drag="beginTimelineFragmentPointerDrag"
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
          :characters="workbenchSeed.gameData.characters"
          :enemy="scenario.enemy"
          :timeline-topology="project.metadata.timelineTopology"
          :kibos="loadoutOptions.kibos"
          :loadout-detail-catalog="loadoutDetailCatalog"
          :actions="scenario.actions"
          :timeline-entry-catalog="timelineEntryCatalog"
          :timeline-entry-default-actor-id="actionLibraryActor.id"
          :active-actor-character-id="actionLibraryCharacterId"
          :three-value-curve-framework="
            simulationResult.threeValueCurveFramework
          "
          :runtime-state-curves="simulationResult.runtimeOutputs.stateCurves"
          :tuning-mark-curve-projection="
            simulationResult.tuningMarkCurveProjection
          "
          :verified-combat-runtime="simulationResult.verifiedCombatRuntime"
          :controlled-actor-timeline="
            simulationResult.runtimeOutputs.controlledActorTimeline
          "
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
          :action-effect-relation-graph="
            runtimeOutputs.actionEffectRelationGraph
          "
          :selected-action-effect-relation-id="selectedActionEffectRelationId"
          :cycle-boundaries="cycleBoundaries"
          :selected-cycle-boundary-id="selectedCycleBoundaryId"
          :selected-cycle-section="selectedCycleSection"
          :effect-intervals="effectIntervalProjection.timelineIntervals"
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
          :external-timeline-entry-drag="actionLibraryTimelineEntryDrag"
          :action-placement-mode="actionPlacementMode"
          :action-placement-proposal="lastActionPlacementProposal"
          :action-placement-preview="actionPlacementPreview"
          :initial-energy-editing="true"
          @select-action="selectAction"
          @select-identity="selectTimelineIdentity"
          @open-loadout-picker="openLoadoutPicker"
          @select-action-group="selectActionGroup"
          @select-action-relation="selectActionRelation"
          @select-action-effect-relation="selectActionEffectRelation"
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
          @update-duration="updateTimelineDuration"
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
          @preview-action-placement="previewActionPlacement"
          @clear-action-placement-preview="clearActionPlacementPreview"
          @update-action-placement-mode="setActionPlacementMode"
          @update-initial-energy="updateTimelineInitialEnergy"
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

        <div class="secondary-workspace-tools">
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
            @insert-next-action="addDefaultSkillAction"
          />

          <WorkbenchLayoutBar
            :layout="workbenchLayout"
            @set-mode="setWorkbenchLayoutMode"
            @toggle-panel="toggleWorkbenchLayoutSide"
            @reset="resetWorkbenchLayout"
          />
        </div>

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
              :action-effect-relation-graph="
                runtimeOutputs.actionEffectRelationGraph
              "
              :selected-effect-relation="selectedActionEffectRelation"
              @select-effect-event="selectEffectEvent"
              @select-effect-relation="selectActionEffectRelation"
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
        v-show="sideInspectorVisible"
        :data-flow-phase="mainFlowWorkspaceView.phase"
        :data-main-flow-inspector-mode="mainFlowWorkspaceView.inspector.mode"
        :data-inspector-selection-key="sideInspectorSelectionKey"
        data-testid="workbench-side-inspector"
        @pointerdown.stop
        @click.stop
      >
        <header class="side-stack-header">
          <div>
            <span>检查器</span>
            <strong>{{ sideInspectorTitle }}</strong>
          </div>
          <button
            type="button"
            title="收起检查器"
            aria-label="收起检查器"
            data-testid="workbench-close-side-inspector"
            @click.stop="dismissSideInspector"
          >
            <CloseBold />
          </button>
        </header>
        <div
          class="side-stack-scroll"
          data-testid="workbench-side-inspector-scroll"
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
            v-if="selectedAction"
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
              :verified-combat-runtime="simulationResult.verifiedCombatRuntime"
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
              :enemies="gameData.enemies"
              :enemy-id="selection.enemyId"
              @select-enemy="updateSelection({ enemyId: $event })"
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
              :team-slots="teamSlots"
              :focused-character-id="
                selectedTimelineIdentity?.kind === 'actor'
                  ? selectedTimelineIdentity.characterId
                  : null
              "
              :controlled-actor-character-id="controlledActorCharacterId"
              :loadout-detail-catalog="loadoutDetailCatalog"
              @update-actor-config="updateActorConfig"
              @update-initial-controlled-actor="updateInitialControlledActor"
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
              @focus-three-value-calculator-scope="
                focusThreeValueCalculatorScope
              "
              @dispatch-flow-action="dispatchWorkbenchFlowAction"
            />
          </div>
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
        export-mode
        :actors="scenario.actors"
        :characters="workbenchSeed.gameData.characters"
        :enemy="scenario.enemy"
        :timeline-topology="project.metadata.timelineTopology"
        :kibos="loadoutOptions.kibos"
        :actions="scenario.actions"
        :three-value-curve-framework="simulationResult.threeValueCurveFramework"
        :runtime-state-curves="simulationResult.runtimeOutputs.stateCurves"
        :tuning-mark-curve-projection="
          simulationResult.tuningMarkCurveProjection
        "
        :verified-combat-runtime="simulationResult.verifiedCombatRuntime"
        :controlled-actor-timeline="
          simulationResult.runtimeOutputs.controlledActorTimeline
        "
        :duration-ms="scenario.time.durationMs"
        :selected-action-id="selectedActionId"
        :selected-action-ids="selectedActionIds"
        :action-relations="actionRelations"
        :action-effect-relation-graph="runtimeOutputs.actionEffectRelationGraph"
        :cycle-boundaries="cycleBoundaries"
        :effect-intervals="effectIntervalProjection.timelineIntervals"
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
  getVerifiedActionVariantGraph,
  getVerifiedCombatActionMapping,
  getVerifiedDerivedControlContract,
  loadVerifiedCombatMechanicsPackage,
} from '../data/verifiedCombatMechanicsPackage';
import { getWorkbenchLoadoutDetailCatalogSnapshot } from '../data/workbenchLoadoutDetailCatalog';
import {
  Aim,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  CloseBold,
  Document,
  Download,
  EditPen,
  FolderOpened,
  Link as LinkIcon,
  Picture,
  Refresh,
  TrendCharts,
  Upload,
  VideoPause,
  VideoPlay,
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
import { auditWorkbenchAnalysisReportReproducibility } from '../features/workbench/workbenchAnalysisReportReproducibility';
import { applyWorkbenchRuntimeViewPatch } from '../features/workbench/workbenchRuntimeViewState';
import {
  ENEMY_TIMELINE_LANE_ID,
  SYSTEM_TIMELINE_LANE_ID,
  createTimelineDiagnostics,
} from '../features/workbench/timelineDiagnostics';
import {
  DEFAULT_WORKBENCH_KIBO_CONFIG,
  DEFAULT_WORKBENCH_SELECTION,
  createWorkbenchActionDraft,
  createWorkbenchProject,
  getSkillActionCatalog,
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
import { ACTION_RELATION_KINDS, ACTION_TYPES } from '../domain/projectSchema';
import {
  createWorkbenchAttackInputChainDrafts,
  migrateLegacyAttackInputActionDrafts,
} from '../domain/workbenchAttackInputChain';
import {
  resolveVerifiedAttackInputChainEntry,
  resolveVerifiedContextActionStartMs,
} from '../domain/verifiedActionContextScheduling';
import { resolveWorkbenchActionScheduling } from '../domain/workbenchActionScheduling';
import { normalizeInitialRuntimeState } from '../domain/initialRuntimeState';
import { normalizeCombatScenario } from '../domain/combatScenario';
import { createActionVariantInputSelection } from '../domain/actionVariantInputSelection';
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
  createWorkbenchActionPlacementProposal,
  expandWorkbenchPlacementActionIds,
  WORKBENCH_ACTION_PLACEMENT_MODES,
  WORKBENCH_ACTION_PLACEMENT_STATUSES,
} from '../domain/workbenchActionPlacement';
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
  createWorkbenchTimelineDurationChange,
  normalizeWorkbenchTimelineDuration,
} from '../domain/workbenchTimelineDuration';
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
import {
  createVerifiedWorkbenchMechanicsProfileSelection,
  normalizeWorkbenchMechanicsProfileSelection,
} from '../domain/workbenchMechanicsProfileSelection';
import {
  createWorkbenchAnalysisReportFileName,
  createWorkbenchContributionAnalysisReport,
  createWorkbenchScenarioComparisonAnalysisReport,
  validateWorkbenchAnalysisReport,
} from '../domain/workbenchAnalysisReport';
import {
  createWorkbenchAnalysisReportPngFileName,
  createWorkbenchAnalysisReportPngMetadata,
  embedWorkbenchAnalysisReportInPng,
} from '../domain/workbenchAnalysisReportPng';
import {
  clearWorkbenchDraft,
  createWorkbenchDraftSnapshot,
  createWorkbenchScenarioDraftSnapshot,
  createWorkbenchProjectFileName,
  createWorkbenchProjectFileSnapshot,
  createWorkbenchProjectShareCode,
  createDefaultWorkbenchDemoDraftState,
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
  createWorkbenchTimelineFragment,
  evaluateWorkbenchTimelineFragmentCompatibility,
  instantiateWorkbenchTimelineFragment,
} from '../domain/workbenchTimelineFragment';
import {
  addWorkbenchTimelineFragment,
  deleteWorkbenchTimelineFragment,
  duplicateWorkbenchTimelineFragment,
  importWorkbenchTimelineFragmentLibrary,
  loadWorkbenchTimelineFragmentLibrary,
  serializeWorkbenchTimelineFragmentLibrary,
} from '../domain/workbenchTimelineFragmentStorage';
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
import {
  formatFrameTime,
  frameToMs,
  msToFrame,
  snapMsToFrame,
} from '../domain/timebase';
import { compileProject } from '../simulation/compiler/compileProject';
import { isSwitchTriggeredDerivedAction } from '../simulation/generation/switchTriggeredActionGeneration';
import { createActionExecutionPlan } from '../simulation/engine/actionExecutionPlan';
import { simulateScenario } from '../simulation/engine/simulateScenario';
import {
  ACTION_RULE_STATUSES,
  createActionRuleDiagnostics,
} from '../simulation/runtime/actionRuleDiagnostics';
import {
  createControlledActorTimeline,
  resolveControlledActorAt,
} from '../simulation/runtime/controlledActorTimeline';
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
const WorkbenchLoadoutPicker = defineAsyncComponent(
  () => import('../features/workbench/WorkbenchLoadoutPicker.vue')
);

const workbenchSeed = getWorkbenchSeed();
const gameData = getWorkbenchGameData();
const loadoutOptions = getWorkbenchLoadoutOptions();
const kiboActionsById = ref(new Map());
const kiboActionCatalogLoaded = ref(false);
const actionLibraryKibos = computed(() =>
  loadoutOptions.kibos.map(kibo => ({
    ...kibo,
    actions: kiboActionsById.value.get(Number(kibo.id)) ?? [],
  }))
);
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
  /^(?:自动推迟：同轨已有动作占用，已从|约束辅助：已从) \d+(?:\.\d+)?ms 调整到 \d+(?:\.\d+)?ms。$/;
const initialDraft = createWorkbenchDraftSnapshot(
  {
    ...createDefaultWorkbenchDemoDraftState(),
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  },
  null
);
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
const actionDrafts = ref([...initialDraft.actionDrafts]);
const actionRelations = ref([...initialDraft.actionRelations]);
const timelineDurationMs = ref(
  normalizeWorkbenchTimelineDuration(initialDraft.durationMs)
);
const cycleBoundaries = ref([...initialDraft.cycleBoundaries]);
const initialRuntimeState = ref(
  cloneWorkbenchHistoryValue(initialDraft.initialRuntimeState)
);
const combatScenario = ref(
  normalizeCombatScenario(initialDraft.combatScenario)
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
const selectedActionEffectRelationId = ref('');
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
const selectedTimelineIdentity = ref(null);
const loadoutPickerRequest = ref(null);
const loadoutDetailCatalog = ref(getWorkbenchLoadoutDetailCatalogSnapshot());
const dismissedSideInspectorKey = ref(
  initialDraft.selectedActionId ? `action:${initialDraft.selectedActionId}` : ''
);
const draftStatus = ref('未保存草稿');
const projectShareUrl = ref('');
const presetDialogVisible = ref(false);
const workbenchPresets = ref([]);
const workbenchTimelineFragments = ref([]);
const workbenchTimelineFragmentViews = computed(() =>
  workbenchTimelineFragments.value.map(fragment => ({
    ...fragment,
    compatibility: evaluateWorkbenchTimelineFragmentCompatibility(fragment, {
      teamSlots: teamSlots.value,
      actorConfigs: actorConfigs.value,
      kiboActionsById: kiboActionCatalogLoaded.value
        ? kiboActionsById.value
        : null,
    }),
  }))
);
const comparisonDialogVisible = ref(false);
const comparisonBaselineDraft = ref(null);
const comparisonBaselineSource = ref(null);
const comparisonWindowId = ref('full-axis');
const analysisReportDialogVisible = ref(false);
const importedAnalysisReport = ref(null);
const importedAnalysisReportValidation = ref(null);
const analysisReportReproducibilityAudit = ref(null);
const analysisReportDialog = ref(null);
const analysisReportPngExporting = ref(false);
const undoHistoryStack = ref([]);
const redoHistoryStack = ref([]);
const workbenchRoot = ref(null);
const workbenchGrid = ref(null);
const workbenchLayout = ref(createInitialWorkbenchLayoutState());
const activeWorkbenchLayoutResize = ref('');
const actionLibraryTimelineEntryDrag = ref(null);
const lastActionPlacementProposal = ref(null);
const actionPlacementPreview = ref(null);
const actionPlacementMode = ref(WORKBENCH_ACTION_PLACEMENT_MODES.FREE);
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
let actionLibraryEntryPointerState = null;
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
  createCurrentWorkbenchProjectForActions(
    actionDrafts.value,
    actionRelations.value
  )
);
const scenario = computed(() => {
  void runtimeDiagnosticsRevision.value;
  return compileProject(project.value, gameData, {
    threeValueMechanicsProfileCatalog:
      DEFAULT_THREE_VALUE_MECHANICS_PROFILE_CATALOG,
  });
});
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
const controlledActorCharacterId = computed(
  () =>
    initialRuntimeState.value?.controlledActor?.characterId ??
    teamSlots.value[0]?.characterId ??
    ''
);
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
const selectedActionEffectRelation = computed(
  () =>
    runtimeOutputs.value.actionEffectRelationGraph.edges.find(
      edge => edge.edgeId === selectedActionEffectRelationId.value
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
  createSideInspectorPanelOrders(
    mainFlowWorkspaceView.value.inspector.mode,
    selectedTimelineIdentity.value?.kind
  )
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
  void runtimeDiagnosticsRevision.value;
  const actorCharacterId = actionLibraryActor.value?.characterId;
  const skillEntries = getSkillActionCatalog(actionLibrarySkills.value, 1).map(
    entry => normalizeActionEntryInput(entry, actorCharacterId)
  );
  const defaultSkillEntry =
    skillEntries.find(
      entry => entry.kind !== 'normal-attack' && isActionEntrySchedulable(entry)
    ) ?? skillEntries.find(isActionEntrySchedulable);
  const kiboId = Number(actionLibraryActor.value?.loadout?.kiboId) || null;
  const defaultKiboEntry = (kiboActionsById.value.get(kiboId) ?? [])
    .map(entry =>
      normalizeKiboActionEntryInput(entry, kiboId, actorCharacterId)
    )
    .find(isActionEntrySchedulable);
  return [
    defaultSkillEntry
      ? createWorkbenchTimelineEntry({
          ...defaultSkillEntry,
          type: ACTION_TYPES.SKILL,
          label: defaultSkillEntry.label ?? '角色动作',
        })
      : null,
    createWorkbenchTimelineEntry({
      type: ACTION_TYPES.SWITCH,
      label: '切人',
    }),
    createWorkbenchTimelineEntry({
      type: ACTION_TYPES.RESOURCE,
      label: '资源',
    }),
    defaultKiboEntry
      ? createWorkbenchTimelineEntry({
          ...defaultKiboEntry,
          type: ACTION_TYPES.KIBO_EVENT,
        })
      : null,
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
    actionDrafts.value[0] ?? {
      actorCharacterId: actionLibraryCharacterId.value,
      skillId: selection.value.skillId,
      level: 1,
    }
  );
});
const sideInspectorSelectionKey = computed(() => {
  if (selectedStateCurvePointId.value) {
    return `runtime:${selectedStateCurvePointId.value}`;
  }
  if (selectedActionId.value) return `action:${selectedActionId.value}`;
  return selectedTimelineIdentity.value?.key ?? '';
});
const sideInspectorTitle = computed(() => {
  if (selectedStateCurvePointId.value) return '运行结果';
  if (selectedActionId.value) {
    return selectedAction.value?.name ?? '动作详情';
  }
  return selectedTimelineIdentity.value?.label ?? '队伍配置';
});
const sideInspectorVisible = computed(
  () =>
    Boolean(sideInspectorSelectionKey.value) &&
    dismissedSideInspectorKey.value !== sideInspectorSelectionKey.value
);
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
    if (actionId) selectedTimelineIdentity.value = null;
    if (actionId && !selectedActionIds.value.includes(actionId)) {
      selectedActionIds.value = [actionId];
      actionSelectionAnchorId.value = actionId;
    }
  },
  { flush: 'sync' }
);

watch(sideInspectorSelectionKey, (nextKey, previousKey) => {
  if (nextKey !== previousKey) dismissedSideInspectorKey.value = '';
});

watch(
  () => scenarioWorkspace.value.activeScenarioId,
  () => closeLoadoutPicker()
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
  () => runtimeOutputs.value.actionEffectRelationGraph.edges,
  edges => {
    if (!selectedActionEffectRelationId.value) {
      return;
    }
    const relation = edges.find(
      edge => edge.edgeId === selectedActionEffectRelationId.value
    );
    if (!relation) {
      selectedActionEffectRelationId.value = '';
      return;
    }
    const interval = effectIntervalProjection.value.intervals.find(item =>
      item.lifecycleEventIds.includes(relation.runtimeEventId)
    );
    selectedEffectIntervalId.value = interval?.intervalId ?? '';
    selectedEffectEventId.value = relation.runtimeEventId ?? '';
    selectTimelineFrame({
      timeMs: relation.targetTimeMs,
      source: 'action-effect-relation-refresh',
    });
  },
  { flush: 'sync' }
);

watch(
  () => runtimeSelectedDetail.value?.statePointId ?? '',
  (statePointId, previousStatePointId) => {
    if (statePointId !== previousStatePointId) {
      selectedEffectIntervalId.value = '';
      selectedEffectEventId.value = '';
      selectedActionEffectRelationId.value = '';
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
  if (mode === 'review') dismissedSideInspectorKey.value = '';
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

function beginActionLibraryEntryPointerDrag(payload = {}) {
  const entry = createWorkbenchTimelineEntry(payload.entry);
  if (!entry) {
    return;
  }
  cancelActionLibraryEntryPointerDrag();
  actionLibraryEntryPointerState = {
    kind: 'entry',
    entry,
    pointerId: Number(payload.pointerId),
    startX: Number(payload.clientX) || 0,
    startY: Number(payload.clientY) || 0,
    active: false,
    targetLaneId: '',
    previewKey: '',
  };
  actionLibraryTimelineEntryDrag.value = {
    entry,
    active: false,
    targetLaneId: '',
  };
  window?.addEventListener?.(
    'pointermove',
    handleActionLibraryEntryPointerMove,
    { passive: false }
  );
  window?.addEventListener?.(
    'pointerup',
    completeActionLibraryEntryPointerDrag
  );
  window?.addEventListener?.(
    'pointercancel',
    cancelActionLibraryEntryPointerDrag
  );
}

function beginTimelineFragmentPointerDrag(payload = {}) {
  const fragment = workbenchTimelineFragments.value.find(
    item => item.id === payload.fragmentId
  );
  const compatibility = evaluateWorkbenchTimelineFragmentCompatibility(
    fragment,
    {
      teamSlots: teamSlots.value,
      actorConfigs: actorConfigs.value,
      kiboActionsById: kiboActionCatalogLoaded.value
        ? kiboActionsById.value
        : null,
    }
  );
  if (!fragment || compatibility.status !== 'valid') {
    draftStatus.value =
      compatibility.issues[0]?.message ?? '片段身份或来源不兼容';
    return;
  }
  cancelActionLibraryEntryPointerDrag();
  actionLibraryEntryPointerState = {
    kind: 'fragment',
    fragment,
    pointerId: Number(payload.pointerId),
    startX: Number(payload.clientX) || 0,
    startY: Number(payload.clientY) || 0,
    active: false,
    targetLaneId: '',
    previewKey: '',
  };
  actionLibraryTimelineEntryDrag.value = {
    fragmentId: fragment.id,
    label: fragment.name,
    active: false,
    targetLaneId: '',
  };
  window?.addEventListener?.(
    'pointermove',
    handleActionLibraryEntryPointerMove,
    { passive: false }
  );
  window?.addEventListener?.(
    'pointerup',
    completeActionLibraryEntryPointerDrag
  );
  window?.addEventListener?.(
    'pointercancel',
    cancelActionLibraryEntryPointerDrag
  );
}

function handleActionLibraryEntryPointerMove(event) {
  const state = actionLibraryEntryPointerState;
  if (!state || Number(event.pointerId) !== state.pointerId) {
    return;
  }
  if (!state.active) {
    const distance = Math.hypot(
      Number(event.clientX) - state.startX,
      Number(event.clientY) - state.startY
    );
    if (distance < 6) {
      return;
    }
    state.active = true;
  }
  event.preventDefault();
  state.targetLaneId =
    state.kind === 'fragment'
      ? resolveTimelineFragmentDropLaneId(
          event.clientX,
          event.clientY,
          state.fragment
        )
      : resolveActionLibraryEntryDropLaneId(
          event.clientX,
          event.clientY,
          state.entry
        );
  const startMs = state.targetLaneId
    ? resolveActionLibraryEntryDropTime(state.targetLaneId, event.clientX)
    : 0;
  const previewKey = state.targetLaneId + ':' + String(startMs);
  if (state.targetLaneId && previewKey !== state.previewKey) {
    state.previewKey = previewKey;
    previewActionPlacement(
      state.kind === 'fragment'
        ? {
            kind: 'fragment',
            fragment: state.fragment,
            laneId: state.targetLaneId,
            startMs,
          }
        : {
            kind: 'insert',
            entry: state.entry,
            laneId: state.targetLaneId,
            startMs,
          }
    );
  } else if (!state.targetLaneId) {
    state.previewKey = '';
    clearActionPlacementPreview();
  }
  actionLibraryTimelineEntryDrag.value = {
    entry: state.entry ?? null,
    fragmentId: state.fragment?.id ?? null,
    label: state.fragment?.name ?? state.entry?.label ?? '',
    active: true,
    targetLaneId: state.targetLaneId,
    startMs,
    placementStatus: actionPlacementPreview.value?.proposal?.status ?? '',
  };
}

function completeActionLibraryEntryPointerDrag(event) {
  const state = actionLibraryEntryPointerState;
  if (!state || Number(event.pointerId) !== state.pointerId) {
    return;
  }
  const targetLaneId = state.active
    ? (state.kind === 'fragment'
        ? resolveTimelineFragmentDropLaneId(
            event.clientX,
            event.clientY,
            state.fragment
          )
        : resolveActionLibraryEntryDropLaneId(
            event.clientX,
            event.clientY,
            state.entry
          )) || state.targetLaneId
    : '';
  const entry = state.entry;
  const fragment = state.fragment;
  const startMs = targetLaneId
    ? resolveActionLibraryEntryDropTime(targetLaneId, event.clientX)
    : 0;
  if (state.active) {
    event.preventDefault();
  }
  cancelActionLibraryEntryPointerDrag();
  if (targetLaneId) {
    if (state.kind === 'fragment') {
      insertTimelineFragment(fragment.id, { targetStartMs: startMs });
    } else {
      insertTimelineEntry({ entry, laneId: targetLaneId, startMs });
    }
  }
}

function cancelActionLibraryEntryPointerDrag() {
  actionLibraryEntryPointerState = null;
  actionLibraryTimelineEntryDrag.value = null;
  clearActionPlacementPreview();
  window?.removeEventListener?.(
    'pointermove',
    handleActionLibraryEntryPointerMove
  );
  window?.removeEventListener?.(
    'pointerup',
    completeActionLibraryEntryPointerDrag
  );
  window?.removeEventListener?.(
    'pointercancel',
    cancelActionLibraryEntryPointerDrag
  );
}

function resolveActionLibraryEntryDropLaneId(clientX, clientY, entry) {
  if (typeof document === 'undefined') {
    return '';
  }
  const laneElement = document
    .elementFromPoint(Number(clientX) || 0, Number(clientY) || 0)
    ?.closest?.('[data-testid="workbench-timeline-row"]');
  const laneId = laneElement?.getAttribute?.('data-lane-id') ?? '';
  const lane = resolveWorkbenchTimelineLaneTarget(laneId);
  return lane && isWorkbenchTimelineEntryAllowedInLane(entry, lane.kind)
    ? laneId
    : '';
}

function resolveTimelineFragmentDropLaneId(clientX, clientY, fragment) {
  if (typeof document === 'undefined') {
    return '';
  }
  const laneElement = document
    .elementFromPoint(Number(clientX) || 0, Number(clientY) || 0)
    ?.closest?.('[data-testid="workbench-timeline-row"]');
  const laneId = laneElement?.getAttribute?.('data-lane-id') ?? '';
  const lane = resolveWorkbenchTimelineLaneTarget(laneId);
  if (!lane) {
    return '';
  }
  const acceptsFragment = fragment.actions.some(action => {
    if (action.lane.kind !== lane.kind) {
      return false;
    }
    return lane.characterId == null
      ? action.lane.kind === WORKBENCH_TIMELINE_LANE_KINDS.ENEMY_EVENT
      : Number(action.source.actorCharacterId) === Number(lane.characterId);
  });
  return acceptsFragment ? laneId : '';
}

function resolveActionLibraryEntryDropTime(laneId, clientX) {
  const laneElement = workbenchRoot.value?.querySelector?.(
    `[data-testid="workbench-timeline-row"][data-lane-id="${laneId}"]`
  );
  const rect = laneElement?.getBoundingClientRect?.();
  if (!rect?.width) {
    return 0;
  }
  const ratio = clampNumber((Number(clientX) - rect.left) / rect.width, 0, 1);
  const durationMs = Number(project.value.time.durationMs) || 0;
  return clampNumber(
    snapMsToFrame(ratio * durationMs),
    0,
    Math.max(0, durationMs - frameToMs(1))
  );
}

async function ensureWorkbenchKiboActionCatalog() {
  if (!kiboActionCatalogLoaded.value) {
    const { loadWorkbenchKiboActionCatalog } =
      await import('../data/workbenchKiboActionCatalog');
    const catalog = await loadWorkbenchKiboActionCatalog();
    kiboActionsById.value = new Map(
      catalog.items.map(item => [Number(item.kiboId), item.actions ?? []])
    );
    kiboActionCatalogLoaded.value = true;
  }
}

onMounted(() => {
  void loadVerifiedCombatMechanicsPackage()
    .then(() => {
      migrateLegacyNormalAttackDrafts();
      runtimeDiagnosticsRevision.value += 1;
    })
    .catch(() => {
      runtimeDiagnosticsRevision.value += 1;
    });
  void ensureWorkbenchKiboActionCatalog().catch(() => {});
  void getWorkbenchLayoutApi().then(layoutApi => {
    workbenchLayout.value =
      layoutApi.loadWorkbenchLayoutState(getLocalStorage());
  });
  window?.addEventListener?.('keydown', handleWorkbenchKeyboardShortcut);
  window?.addEventListener?.('hashchange', handleWorkbenchHashChange);
  refreshWorkbenchPresetLibrary();
  refreshWorkbenchTimelineFragmentLibrary();
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
  cancelActionLibraryEntryPointerDrag();
  window?.removeEventListener?.('keydown', handleWorkbenchKeyboardShortcut);
  window?.removeEventListener?.('hashchange', handleWorkbenchHashChange);
});

function handleWorkbenchHashChange() {
  if (!applySharedProjectFromUrl()) {
    openWorkbenchPresetLibraryFromUrl();
  }
}

function openLoadoutPicker(request = {}) {
  loadoutPickerRequest.value = {
    ...request,
    selectedId: Number(request.selectedId) || null,
  };
}

function closeLoadoutPicker() {
  loadoutPickerRequest.value = null;
}

function installLoadoutDetailCatalog(catalog) {
  loadoutDetailCatalog.value = catalog;
}

function applyLoadoutPickerSelection(selectedId) {
  const request = loadoutPickerRequest.value;
  if (!request) return;
  const normalizedId = Number(selectedId) || null;
  closeLoadoutPicker();

  if (request.kind === 'character') {
    updateTeamSlot({
      slotId: request.slotId,
      characterId: normalizedId,
    });
    return;
  }
  if (request.kind === 'enemy') {
    updateSelection({ enemyId: normalizedId });
    return;
  }
  if (request.kind === 'kibo') {
    updateActorConfig({
      characterId: request.characterId,
      loadout: {
        kiboId: normalizedId,
        kiboConfig: structuredClone(DEFAULT_WORKBENCH_KIBO_CONFIG),
      },
    });
    return;
  }
  if (request.kind === 'soulessence') {
    updateActorConfig({
      characterId: request.characterId,
      loadout: {
        soulessenceId: normalizedId,
        soulessenceLevel: null,
        soulessenceRank: null,
      },
    });
    return;
  }
  if (request.kind === 'equipment') {
    updateActorConfig({
      characterId: request.characterId,
      loadout: {
        equipment: {
          [request.slotKey]: normalizedId,
        },
        equipmentLevels: {
          [request.slotKey]: null,
        },
      },
    });
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
  recordWorkbenchHistorySnapshot();
  const previousSelection = selection.value;
  const previousTeamSlots = normalizeWorkbenchTeamSlots(
    teamSlots.value,
    previousSelection
  );
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
  const teamSlotCharacterRemap = createTeamSlotCharacterRemap(
    previousTeamSlots,
    teamSlots.value
  );
  remapInitialControlledActor(teamSlotCharacterRemap);
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

  normalizeActionLibraryCharacterId(teamSlots.value, teamSlotCharacterRemap);

  if (teamSlotCharacterRemap.size > 0) {
    const nextActionDrafts = actionDrafts.value.map(action => {
      const nextAction = { ...action };
      const nextActorCharacterId = teamSlotCharacterRemap.get(
        Number(action.actorCharacterId)
      );
      if (nextActorCharacterId != null) {
        nextAction.actorCharacterId = nextActorCharacterId;
      }
      if (nextAction.type === ACTION_TYPES.SWITCH) {
        const nextTargetCharacterId = teamSlotCharacterRemap.get(
          Number(action.targetCharacterId)
        );
        if (nextTargetCharacterId != null) {
          nextAction.targetCharacterId = nextTargetCharacterId;
        }
      }
      return nextAction;
    });
    actionDrafts.value = normalizeWorkbenchActionDrafts(
      nextActionDrafts,
      nextSelection,
      teamSlots.value
    );
  }

  if (characterChanged) {
    selectedActionId.value = actionDrafts.value[0]?.id ?? '';
  }

  markDraftDirty();
}

function updateInitialControlledActor(characterId) {
  const actor = scenario.value.actors.find(
    item => Number(item.characterId) === Number(characterId)
  );
  if (
    !actor ||
    actor.id === initialRuntimeState.value?.controlledActor?.actorId
  ) {
    return;
  }
  recordWorkbenchHistorySnapshot();
  initialRuntimeState.value = normalizeInitialRuntimeState({
    ...(initialRuntimeState.value ?? {}),
    controlledActor: {
      actorId: actor.id,
      characterId: actor.characterId,
      actorName: actor.name,
    },
  });
  actionLibraryCharacterId.value = Number(actor.characterId);
  markDraftDirty();
}

function remapInitialControlledActor(characterRemap) {
  const controlledActor = initialRuntimeState.value?.controlledActor;
  const nextCharacterId = characterRemap.get(
    Number(controlledActor?.characterId)
  );
  if (nextCharacterId == null) return;
  const character = workbenchSeed.gameData.characters.find(
    item => Number(item.id) === Number(nextCharacterId)
  );
  initialRuntimeState.value = normalizeInitialRuntimeState({
    ...initialRuntimeState.value,
    controlledActor: {
      actorId: `actor-${nextCharacterId}`,
      characterId: nextCharacterId,
      actorName: character?.name ?? null,
    },
  });
}

function updateAction(patch) {
  const actionId = selectedActionId.value;
  if (
    Object.prototype.hasOwnProperty.call(patch, 'startMs') &&
    Object.keys(patch).length === 1 &&
    expandSimultaneousActionIds([actionId]).length > 1
  ) {
    return updateActionTime({ actionId, startMs: patch.startMs });
  }
  recordWorkbenchHistorySnapshot();
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
        durationMs:
          action.type === ACTION_TYPES.SWITCH
            ? 0
            : clampNumber(
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
  recordWorkbenchHistorySnapshot();
  const hasInitialSp = Object.prototype.hasOwnProperty.call(patch, 'initialSp');
  const hasLevel = Object.prototype.hasOwnProperty.call(patch, 'level');
  const nextActorConfigs = normalizeWorkbenchActorConfigs(
    actorConfigs.value.map(config => {
      if (Number(config.characterId) !== Number(characterId)) {
        return config;
      }
      return {
        ...config,
        ...(hasInitialSp ? { initialSp: patch.initialSp } : {}),
        ...(hasLevel ? { level: patch.level } : {}),
        cultivation: {
          ...config.cultivation,
          ...patch.cultivation,
        },
        loadout: {
          ...config.loadout,
          ...loadout,
          equipment: {
            ...config.loadout?.equipment,
            ...loadout.equipment,
          },
          equipmentLevels: {
            ...config.loadout?.equipmentLevels,
            ...loadout.equipmentLevels,
          },
          kiboConfig: {
            ...config.loadout?.kiboConfig,
            ...loadout.kiboConfig,
            comprehensionByAttribute: {
              ...config.loadout?.kiboConfig?.comprehensionByAttribute,
              ...loadout.kiboConfig?.comprehensionByAttribute,
            },
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

function updateTimelineInitialEnergy(request = {}) {
  if (request.ownerKind === 'actor') {
    const actor = scenario.value.actors.find(
      item =>
        item.id === request.actorId ||
        Number(item.characterId) === Number(request.characterId)
    );
    if (!actor) return false;
    const curve =
      simulationResult.value.runtimeOutputs.stateCurves.resources.curvesByActor?.find(
        item => item.actorId === actor.id
      );
    const maxValue = resolveInitialEnergyMax(
      curve?.stateMetric?.maxValue,
      request.maxValue
    );
    const currentValue = normalizeInitialEnergyInput(
      request.currentValue,
      maxValue
    );
    const activeConfig = actorConfigs.value.find(
      config => Number(config.characterId) === Number(actor.characterId)
    );
    if (
      currentValue == null ||
      Number(activeConfig?.initialSp ?? 0) === currentValue
    ) {
      return false;
    }
    updateActorConfig({
      characterId: actor.characterId,
      initialSp: currentValue,
    });
    return true;
  }
  if (request.ownerKind !== 'kibo') return false;
  return updateInitialKiboEnergy(request);
}

function updateInitialKiboEnergy(request = {}) {
  const slotId = String(request.slotId ?? '').trim();
  const kiboId = Number(request.kiboId);
  if (!slotId || !Number.isInteger(kiboId) || kiboId <= 0) return false;
  const runtimeCurve =
    simulationResult.value.runtimeOutputs.stateCurves.resources.curvesByKibo?.find(
      curve =>
        curve.slotId === slotId && Number(curve.kiboId) === Number(kiboId)
    );
  if (!runtimeCurve) return false;
  const topologyGroup =
    project.value.metadata.timelineTopology.actorGroups.find(
      group => group.kiboEnergyCurve?.slotId === slotId
    );
  const configuredKiboId = Number(
    topologyGroup?.kiboLane?.kiboId ?? topologyGroup?.kiboEnergyCurve?.kiboId
  );
  if (configuredKiboId !== kiboId) return false;
  const actor = scenario.value.actors.find(
    item => item.id === (runtimeCurve.actorId ?? topologyGroup?.actorId)
  );
  const maxValue = resolveInitialEnergyMax(
    runtimeCurve.stateMetric?.maxValue,
    request.maxValue
  );
  const currentValue = normalizeInitialEnergyInput(
    request.currentValue,
    maxValue
  );
  if (currentValue == null) return false;
  const currentRows = initialRuntimeState.value?.kiboEnergyBySlot ?? [];
  const currentRow = currentRows.find(
    row => row.slotId === slotId && Number(row.kiboId) === kiboId
  );
  if (
    Number(currentRow?.currentValue ?? 0) === currentValue &&
    Number(currentRow?.maxValue ?? maxValue) === maxValue
  ) {
    return false;
  }
  const kibo = loadoutOptions.kibos.find(item => Number(item.id) === kiboId);
  recordWorkbenchHistorySnapshot();
  initialRuntimeState.value = normalizeInitialRuntimeState({
    ...(initialRuntimeState.value ?? {}),
    kiboEnergyBySlot: [
      ...currentRows.filter(row => row.slotId !== slotId),
      {
        slotId,
        actorId: actor?.id ?? runtimeCurve.actorId ?? null,
        characterId: actor?.characterId ?? request.characterId ?? null,
        kiboId,
        kiboName: kibo?.name ?? request.kiboName ?? null,
        currentValue,
        maxValue,
      },
    ],
  });
  markDraftDirty();
  return true;
}

function resolveInitialEnergyMax(runtimeMaxValue, projectedMaxValue) {
  const runtimeMax = Number(runtimeMaxValue);
  if (Number.isFinite(runtimeMax) && runtimeMax > 0) return runtimeMax;
  const projectedMax = Number(projectedMaxValue);
  return Number.isFinite(projectedMax) && projectedMax > 0
    ? projectedMax
    : null;
}

function normalizeInitialEnergyInput(value, maxValue) {
  const number = Number(value);
  if (!Number.isFinite(number) || !Number.isFinite(maxValue)) return null;
  return (
    Math.round((clampNumber(number, 0, maxValue) + Number.EPSILON) * 100) / 100
  );
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
  recordWorkbenchHistorySnapshot();
  applyWorkbenchConfigurationState(result);
  markDraftDirty();
  return true;
}

function updateActionTime({ actionId, startMs }) {
  const previousAction = findActionDraftById(actionId);
  if (!previousAction) {
    return false;
  }
  const simultaneousActionIds = expandSimultaneousActionIds([actionId]);
  if (isConstraintAssistedPlacement() || simultaneousActionIds.length > 1) {
    return moveSelectedActions({
      actionIds: simultaneousActionIds,
      primaryActionId: actionId,
      offsetMs: Number(startMs) - Number(previousAction.startMs),
    });
  }
  const editSourceFocus = captureActionEditSourceFocus(actionId);
  selectedActionId.value = actionId;
  const nextActions = actionDrafts.value.map(action => {
    if (action.id !== actionId) {
      return action;
    }

    return createWorkbenchActionDraft({
      ...action,
      ...clearInsertionForManualEdit(action),
      startMs: clampNumber(startMs, 0, project.value.time.durationMs),
    });
  });
  lastActionPlacementProposal.value = createActionPlacementProposal({
    requestedActions: nextActions.filter(action => action.id === actionId),
    requestedLaneId: resolveDraftLaneId(
      nextActions.find(action => action.id === actionId)
    ),
  });
  recordWorkbenchHistorySnapshot();
  actionDrafts.value = nextActions;
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
  return true;
}

function updateActionDuration({ actionId, durationMs }) {
  const previousAction = findActionDraftById(actionId);
  if (!previousAction || previousAction.type === ACTION_TYPES.SWITCH) {
    return false;
  }
  recordWorkbenchHistorySnapshot();
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

async function addSkillAction(actionEntryOrSkillId, insertOptions = {}) {
  const actorCharacterId = Number(
    insertOptions.actorCharacterId ??
      actionLibraryActor.value?.characterId ??
      selectedDraft.value.actorCharacterId
  );
  let actionEntry = normalizeActionEntryInput(
    actionEntryOrSkillId,
    actorCharacterId
  );
  if (!isActionEntrySchedulable(actionEntry)) {
    draftStatus.value = formatUnschedulableActionMessage(actionEntry);
    return false;
  }
  const scheduling = resolveWorkbenchActionScheduling(actionEntry);
  const skill = resolveContextSkill(actorCharacterId, actionEntry.skillId);
  const level = resolveSkillInsertLevel(actorCharacterId, skill);
  const fallbackStartMs =
    insertOptions.requestedStartMs ??
    resolveInsertStartMs(resolveInsertIndex());
  const requestedStartMs = resolveVerifiedAssistedInsertStartMs({
    entry: actionEntry,
    actorCharacterId,
    fallbackStartMs,
  });
  actionEntry = resolveVerifiedStateSelectedActionEntry({
    entry: actionEntry,
    actorCharacterId,
    timeMs: requestedStartMs,
  });
  if (actionEntry.kind === 'star-combo') {
    return insertTimelineEntry({
      entry: createWorkbenchTimelineEntry({
        ...actionEntry,
        type: ACTION_TYPES.SKILL,
      }),
      laneId: resolveDraftLaneId({
        type: ACTION_TYPES.SKILL,
        actorCharacterId,
      }),
      startMs: requestedStartMs,
    });
  }
  const attackInputDrafts = createAttackInputChainDraftPatches({
    entry: actionEntry,
    actorCharacterId,
    skill,
    level,
    startMs: requestedStartMs,
    firstActionId: createNextActionId(),
  });
  if (attackInputDrafts.length) {
    addInsertedActionGroup(attackInputDrafts);
    return;
  }
  addInsertedAction(
    {
      id: createNextActionId(),
      skillId: skill.id,
      actorCharacterId,
      level,
      actionVariantIndex: actionEntry.actionVariantIndex ?? 0,
      damageSegmentIndex: actionEntry.actionVariantIndex ?? 0,
      durationMs: scheduling.durationMs,
      ...createActionTimingDraftFields(
        actionEntry,
        scheduling,
        actorCharacterId
      ),
      note:
        actionEntry.note ??
        `${actionEntry.label ?? '动作'}：${actionEntry.rawValue ?? '倍率待补'}；真实动作帧等待 asset 或运行时捕获补充。`,
    },
    { requestedStartMs }
  );
}

function addDefaultSkillAction() {
  const actorCharacterId = Number(
    actionLibraryActor.value?.characterId ??
      selectedDraft.value.actorCharacterId
  );
  const entry = getSkillActionCatalog(
    getSkillsForCharacter(actorCharacterId),
    1
  )[0];
  if (entry) {
    addSkillAction(entry, { actorCharacterId });
  }
}

function createAttackInputChainDraftPatches({
  entry,
  actorCharacterId,
  skill,
  level,
  startMs,
  firstActionId,
} = {}) {
  if (!entry?.attackInputSegments?.length) return [];
  const usedActionIds = new Set(actionDrafts.value.map(action => action.id));
  if (firstActionId) usedActionIds.add(firstActionId);
  return createWorkbenchAttackInputChainDrafts({
    entry,
    actorCharacterId,
    skillId: skill?.id ?? entry.skillId,
    level,
    startMs,
    createActionId: (_, index) => {
      if (index === 0 && firstActionId) return firstActionId;
      if (String(firstActionId).includes('preview')) {
        return `${firstActionId}-a${String(index + 1).padStart(2, '0')}`;
      }
      return createNextActionIdFromUsedIds(usedActionIds);
    },
    createdAt: new Date().toISOString(),
  });
}

function resolveVerifiedStateSelectedActionEntry({
  entry,
  actorCharacterId,
  timeMs,
} = {}) {
  const graph = getVerifiedActionVariantGraph();
  const actorId = resolveScenarioActorId(actorCharacterId);
  return resolveVerifiedAttackInputChainEntry({
    entry,
    graph,
    ownerId: actorCharacterId,
    actorId,
    timeMs,
    effectIntervals: effectIntervalProjection.value.intervals,
  }).entry;
}

function resolveVerifiedAssistedInsertStartMs({
  entry,
  actorCharacterId,
  fallbackStartMs,
} = {}) {
  if (!isConstraintAssistedPlacement()) {
    return fallbackStartMs;
  }
  const mapping = getVerifiedCombatActionMapping({
    type: ACTION_TYPES.SKILL,
    skillId: entry?.skillId,
    actionVariantIndex:
      entry?.actionVariantIndex ?? entry?.damageSegmentIndex ?? 0,
    actor: { characterId: actorCharacterId },
  });
  const context = resolveVerifiedContextActionStartMs({
    actions: actionDrafts.value,
    selections:
      simulationResult.value.verifiedActionVariantRuntime?.selections ?? [],
    graph: getVerifiedActionVariantGraph(),
    ownerId: actorCharacterId,
    actorId: resolveScenarioActorId(actorCharacterId),
    targetControlSkillId: mapping?.controlSkillId,
    effectIntervals: effectIntervalProjection.value.intervals,
    timelineDurationMs: project.value.time.durationMs,
  });
  return context?.startMs ?? fallbackStartMs;
}

function resolveScenarioActorId(actorCharacterId) {
  return (
    scenario.value.actors.find(
      actor => Number(actor.characterId) === Number(actorCharacterId)
    )?.id ?? null
  );
}

function setActionPlacementMode(mode) {
  const nextMode = Object.values(WORKBENCH_ACTION_PLACEMENT_MODES).includes(
    mode
  )
    ? mode
    : WORKBENCH_ACTION_PLACEMENT_MODES.FREE;
  if (actionPlacementMode.value === nextMode) {
    return;
  }
  actionPlacementMode.value = nextMode;
  lastActionPlacementProposal.value = null;
  clearActionPlacementPreview();
}

function isConstraintAssistedPlacement() {
  return (
    actionPlacementMode.value === WORKBENCH_ACTION_PLACEMENT_MODES.ASSISTED
  );
}

function applyConstraintAssistedProposal(proposal, requestedActions) {
  if (!isConstraintAssistedPlacement()) {
    return requestedActions;
  }
  if (!proposal?.committable) {
    draftStatus.value =
      '约束辅助：' + (proposal?.conflicts?.[0]?.message ?? '当前位置无法提交');
    return null;
  }
  const proposedById = new Map(
    (proposal.proposedActions ?? []).map(action => [action.id, action])
  );
  return requestedActions.map(action => ({
    ...action,
    ...(proposedById.get(action.id) ?? {}),
  }));
}

function resolveCommittedInsertPlacement(placement) {
  if (!isConstraintAssistedPlacement()) {
    return placement;
  }
  const proposedActions = applyConstraintAssistedProposal(
    placement?.proposal,
    placement?.proposal?.proposedActions ?? []
  );
  const proposedAction = proposedActions?.[0];
  if (!proposedAction) {
    return null;
  }
  const adjustment = placement.proposal.adjustments?.[0];
  return {
    ...placement,
    assisted: true,
    autoDelayed: proposedAction.startMs > placement.requestedStartMs,
    conflictActionIds: [
      ...new Set(
        (placement.proposal.adjustments ?? [])
          .flatMap(issue => [
            issue?.actionId,
            issue?.blockingActionId,
            ...(issue?.actionIds ?? []),
          ])
          .filter(
            actionId =>
              actionId && actionId !== placement.proposal.requestedActionIds[0]
          )
      ),
    ],
    startMs: proposedAction.startMs,
    reason: adjustment?.code ?? 'constraint-assisted',
  };
}

function replacePlacementActions(actions, proposedActions) {
  const proposedById = new Map(
    (proposedActions ?? []).map(action => [action.id, action])
  );
  return actions.map(action =>
    proposedById.has(action.id)
      ? createWorkbenchActionDraft({
          ...action,
          ...proposedById.get(action.id),
          ...clearInsertionForManualEdit(action),
        })
      : action
  );
}

function createPlacementPreflightIssue(code, message) {
  return {
    schemaVersion: 1,
    code,
    status: WORKBENCH_ACTION_PLACEMENT_STATUSES.BLOCKED,
    message,
    source: {
      sourceKind: 'workbench-timeline-lane-contract',
    },
  };
}

function previewActionPlacement(payload = {}) {
  if (payload.kind === 'move') {
    const request = createMoveActionPlacementRequest(payload);
    if (!request) {
      clearActionPlacementPreview();
      return;
    }
    lastActionPlacementProposal.value = request.proposal;
    actionPlacementPreview.value = createActionPlacementPreviewState({
      kind: 'move',
      proposal: request.proposal,
      requestedActions: request.requestedActions,
    });
    return;
  }
  if (payload.kind === 'insert') {
    previewTimelineEntryPlacement(payload);
    return;
  }
  if (payload.kind === 'fragment') {
    previewTimelineFragmentPlacement(payload);
  }
}

function createActionPlacementPreviewState({
  kind,
  proposal,
  requestedActions,
  label = '',
  icon = null,
} = {}) {
  return {
    active: true,
    kind,
    label,
    icon,
    proposal,
    requestedActions: decorateActionPlacementPreviewActions(
      requestedActions,
      label,
      icon
    ),
    proposedActions: decorateActionPlacementPreviewActions(
      proposal?.proposedActions,
      label,
      icon
    ),
  };
}

function decorateActionPlacementPreviewActions(
  actions = [],
  fallbackLabel = '',
  fallbackIcon = null
) {
  const scenarioActionById = new Map(
    (scenario.value.actions ?? []).map(action => [action.id, action])
  );
  return (actions ?? []).map(action => {
    const scenarioAction = scenarioActionById.get(action.id);
    return {
      ...action,
      laneId: resolveDraftLaneId(action),
      label:
        scenarioAction?.name ?? action.name ?? (fallbackLabel || action.id),
      icon: scenarioAction?.icon ?? action.icon ?? fallbackIcon,
      timelineSlot: scenarioAction?.timelineSlot ?? 0,
    };
  });
}

function clearActionPlacementPreview() {
  actionPlacementPreview.value = null;
}

function addWaitAction() {
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
  const actorCharacterId = Number(
    actionLibraryActor.value?.characterId ??
      selectedDraft.value.actorCharacterId
  );
  addInsertedAction({
    id: createNextActionId(),
    type: ACTION_TYPES.SWITCH,
    skillId: selectedDraft.value.skillId,
    actorCharacterId,
    durationMs: 0,
    level: selectedDraft.value.level,
    targetCharacterId: resolveAlternateActorCharacterId(actorCharacterId),
    note: '切换至副角色',
  });
}

function addAnnotationAction() {
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

async function addKiboEventAction(entry = null) {
  if (!isActionEntrySchedulable(entry)) {
    draftStatus.value = formatUnschedulableActionMessage(entry);
    return false;
  }
  if (entry?.eventType === 'break') {
    return insertTimelineEntry({
      entry,
      laneId: resolveDraftLaneId({
        type: ACTION_TYPES.KIBO_EVENT,
        actorCharacterId: actionLibraryCharacterId.value,
      }),
      startMs: resolveInsertStartMs(resolveInsertIndex()),
    });
  }
  const scheduling = resolveWorkbenchActionScheduling(entry);
  addInsertedAction({
    id: createNextActionId(),
    type: ACTION_TYPES.KIBO_EVENT,
    kiboId: entry?.kiboId ?? actionLibraryActor.value?.loadout?.kiboId,
    skillId: entry?.skillId ?? selectedDraft.value.skillId,
    actorCharacterId: actionLibraryCharacterId.value,
    durationMs: scheduling.durationMs,
    level: selectedDraft.value.level,
    eventType: entry?.eventType ?? 'activation',
    name: entry?.label ?? '',
    icon: entry?.icon ?? null,
    ...createActionTimingDraftFields(
      entry,
      scheduling,
      actionLibraryCharacterId.value
    ),
    note: entry?.note ?? '奇波事件标记；效果未接入 calculator。',
  });
}

function addEnemyEventAction() {
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

async function insertTimelineEntry({ entry, laneId, startMs }) {
  clearActionPlacementPreview();
  const request = await createTimelineEntryInsertionRequest({
    entry,
    laneId,
    startMs,
    actionId: createNextActionId(),
  });
  if (!request) {
    return false;
  }
  if (request.blockedMessage) {
    draftStatus.value = request.blockedMessage;
    return false;
  }
  if (request.targetLane.characterId != null) {
    actionLibraryCharacterId.value = request.actorCharacterId;
  }
  if (request.draftPatches.length > 1) {
    return Boolean(
      addInsertedActionGroup(request.draftPatches, {
        actionRelations: request.actionRelations,
      })?.committed
    );
  }
  return Boolean(
    addInsertedAction(request.draftPatch, {
      requestedStartMs: request.requestedStartMs,
    })?.committed
  );
}

async function createTimelineEntryInsertionRequest(options = {}) {
  const request = createTimelineEntryDraftRequest(options);
  if (!request || request.blockedMessage) {
    return request;
  }
  const actorActionEntries = getSkillActionCatalog(
    getSkillsForCharacter(request.actorCharacterId),
    1
  ).map(entry => normalizeActionEntryInput(entry, request.actorCharacterId));
  const jointAttackInsertion =
    await import('../domain/workbenchJointAttackInsertion');
  if (
    !jointAttackInsertion.isWorkbenchJointAttackTimelineEntry(
      options.entry,
      actorActionEntries
    )
  ) {
    return request;
  }
  try {
    await ensureWorkbenchKiboActionCatalog();
  } catch {
    return { ...request, blockedMessage: '奇波动作目录加载失败，无法加入合击' };
  }

  const usedActionIds = new Set(actionDrafts.value.map(action => action.id));
  usedActionIds.add(options.actionId);
  const companionActionId = String(options.actionId).includes('preview')
    ? `${options.actionId}-joint`
    : createNextActionIdFromUsedIds(usedActionIds);
  const usedRelationIds = new Set(
    actionRelations.value.map(relation => relation.id)
  );
  const relationId = String(options.actionId).includes('preview')
    ? 'relation-placement-preview-joint'
    : createNextWorkbenchActionRelationIdFromUsedIds(usedRelationIds);
  const actorConfig = actorConfigs.value.find(
    config => Number(config.characterId) === Number(request.actorCharacterId)
  );
  const equippedKiboId = Number(actorConfig?.loadout?.kiboId) || null;
  const expansion = jointAttackInsertion.createWorkbenchJointAttackInsertion({
    entry: options.entry,
    actorCharacterId: request.actorCharacterId,
    actorActionEntries,
    kiboActionEntries: (kiboActionsById.value.get(equippedKiboId) ?? []).map(
      entry =>
        normalizeKiboActionEntryInput(
          entry,
          equippedKiboId,
          request.actorCharacterId
        )
    ),
    equippedKiboId,
    baseDraftPatches: request.draftPatches,
    startMs: request.requestedStartMs,
    companionActionId,
    relationId,
  });
  return expansion.status === 'blocked'
    ? { ...request, blockedMessage: expansion.message }
    : {
        ...request,
        draftPatch: expansion.draftPatches[0] ?? request.draftPatch,
        draftPatches: expansion.draftPatches,
        actionRelations: expansion.actionRelations ?? [],
      };
}

function createTimelineEntryDraftRequest({
  entry,
  laneId,
  startMs,
  actionId,
} = {}) {
  const targetLane = resolveWorkbenchTimelineLaneTarget(laneId);
  if (
    !targetLane ||
    !isWorkbenchTimelineEntryAllowedInLane(entry, targetLane.kind)
  ) {
    return null;
  }
  const actorCharacterId = Number(
    targetLane.characterId ?? actionLibraryCharacterId.value
  );
  let requestedStartMs = clampNumber(startMs, 0, project.value.time.durationMs);
  let draftPatch;
  let attackInputDrafts = [];
  if (entry.type === ACTION_TYPES.SKILL) {
    let actionEntry = normalizeActionEntryInput(entry, actorCharacterId);
    if (!isActionEntrySchedulable(actionEntry)) {
      return {
        blockedMessage: formatUnschedulableActionMessage(actionEntry),
        targetLane,
        actorCharacterId,
        requestedStartMs,
        draftPatches: [],
      };
    }
    requestedStartMs = resolveVerifiedAssistedInsertStartMs({
      entry: actionEntry,
      actorCharacterId,
      fallbackStartMs: requestedStartMs,
    });
    actionEntry = resolveVerifiedStateSelectedActionEntry({
      entry: actionEntry,
      actorCharacterId,
      timeMs: requestedStartMs,
    });
    const skill = resolveContextSkill(actorCharacterId, actionEntry.skillId);
    const level = resolveSkillInsertLevel(actorCharacterId, skill);
    const scheduling = resolveWorkbenchActionScheduling(actionEntry);
    draftPatch = {
      id: actionId,
      skillId: skill.id,
      actorCharacterId,
      level,
      actionVariantIndex: actionEntry.actionVariantIndex ?? 0,
      damageSegmentIndex: actionEntry.actionVariantIndex ?? 0,
      durationMs: scheduling.durationMs,
      ...createActionTimingDraftFields(
        actionEntry,
        scheduling,
        actorCharacterId
      ),
      note:
        actionEntry.note ??
        (actionEntry.label ?? '动作') +
          '：' +
          (actionEntry.rawValue ?? '倍率待补') +
          '；真实动作帧等待 asset 或运行时捕获补充。',
    };
    attackInputDrafts = createAttackInputChainDraftPatches({
      entry: actionEntry,
      actorCharacterId,
      skill,
      level,
      startMs: requestedStartMs,
      firstActionId: actionId,
    });
  } else {
    if (
      entry.type === ACTION_TYPES.KIBO_EVENT &&
      !isActionEntrySchedulable(entry)
    ) {
      return {
        blockedMessage: formatUnschedulableActionMessage(entry),
        targetLane,
        actorCharacterId,
        requestedStartMs,
        draftPatches: [],
      };
    }
    const scheduling = resolveWorkbenchActionScheduling(entry);
    draftPatch = {
      id: actionId,
      type: entry.type,
      skillId: entry.skillId ?? selectedDraft.value.skillId,
      actorCharacterId,
      durationMs:
        entry.type === ACTION_TYPES.SWITCH
          ? 0
          : entry.type === ACTION_TYPES.KIBO_EVENT
            ? scheduling.durationMs
            : (entry.durationMs ?? 600),
      level: selectedDraft.value.level,
    };
  }
  if (entry.type === ACTION_TYPES.SWITCH) {
    Object.assign(draftPatch, {
      targetCharacterId: resolveAlternateActorCharacterId(actorCharacterId),
      note: '切换至其他角色',
    });
  } else if (entry.type === ACTION_TYPES.RESOURCE) {
    Object.assign(draftPatch, {
      resource: 'sp',
      change: 50,
      reason: 'manual-axis-resource',
      note: '手动资源变化',
    });
  } else if (entry.type === ACTION_TYPES.KIBO_EVENT) {
    Object.assign(draftPatch, {
      kiboId: entry.kiboId,
      eventType: entry.eventType ?? 'activation',
      name: entry.label ?? '',
      icon: entry.icon ?? null,
      ...createActionTimingDraftFields(entry, undefined, actorCharacterId),
      note: entry.note ?? '奇波事件标记；效果未接入 calculator。',
    });
  } else if (entry.type === ACTION_TYPES.ENEMY_EVENT) {
    Object.assign(draftPatch, {
      eventType: entry.eventType ?? 'phase',
      note: '敌人阶段标记',
    });
  }
  return {
    actorCharacterId,
    draftPatch: attackInputDrafts[0] ?? {
      ...draftPatch,
      startMs: requestedStartMs,
    },
    draftPatches:
      attackInputDrafts.length > 0
        ? attackInputDrafts
        : [
            {
              ...draftPatch,
              startMs: requestedStartMs,
            },
          ],
    requestedStartMs,
    targetLane,
  };
}

function createActionTimingDraftFields(
  entry,
  scheduling = resolveWorkbenchActionScheduling(entry),
  actorCharacterId = null
) {
  const planning = scheduling.status === 'planning';
  const variantInputSelection = resolveInitialVariantInputSelection(
    entry,
    actorCharacterId
  );
  return {
    durationFrames: planning ? null : (entry?.durationFrames ?? null),
    timingSource: planning ? scheduling.kind : (entry?.timingSource ?? null),
    timingStatus: planning ? 'unresolved' : (entry?.timingStatus ?? null),
    timingReasons: [
      ...(entry?.timingReasons ?? []),
      ...(planning ? ['planning-duration-not-authoritative'] : []),
    ],
    timingSourceIdentity: entry?.timingSourceIdentity ?? null,
    needsTimingData: planning || (entry?.needsTimingData ?? true),
    controlSubSkillIndex:
      scheduling.selectedSubSkillIndex ?? entry?.controlSubSkillIndex ?? null,
    variantInputSelection,
    actionScheduling: entry?.actionScheduling ?? null,
    sourceEvidenceStatus: entry?.sourceEvidenceStatus ?? null,
    scenarioRuntimeStatus: entry?.scenarioRuntimeStatus ?? null,
    hitOverrides: entry?.hitOverrides ?? null,
  };
}

function resolveInitialVariantInputSelection(entry, actorCharacterId) {
  const characterId = Number(
    actorCharacterId ??
      entry?.actorCharacterId ??
      actionLibraryCharacterId.value
  );
  const mapping = getVerifiedCombatActionMapping({
    type: entry?.type ?? ACTION_TYPES.SKILL,
    actor: { characterId },
    skillId: entry?.skillId,
    actionVariantIndex:
      entry?.actionVariantIndex ?? entry?.damageSegmentIndex ?? 0,
    damageSegmentIndex:
      entry?.actionVariantIndex ?? entry?.damageSegmentIndex ?? 0,
    attackInput: entry?.attackInput ?? null,
    attackSequenceIndex: entry?.attackSequenceIndex ?? null,
  });
  if (!mapping) return null;
  const controlSkillId =
    mapping.actionKind === 'normal-attack'
      ? Number(entry?.attackInput?.controlSkillId)
      : Number(mapping.controlSkillId);
  const contract = getVerifiedDerivedControlContract({
    ownerKind: mapping.ownerKind ?? 'actor',
    ownerId: mapping.ownerId,
    controlSkillId,
  });
  if (contract?.inputSelector?.resolutionStatus !== 'applied') return null;
  const publicVariantIndex = Number(
    entry?.actionVariantIndex ?? entry?.damageSegmentIndex
  );
  const option = contract.inputSelector.options?.find(
    candidate =>
      Number(candidate.publicVariantIndex) === publicVariantIndex &&
      candidate.resolutionStatus === 'applied'
  );
  return option
    ? createActionVariantInputSelection({
        selector: contract.inputSelector,
        option,
      })
    : null;
}

async function previewTimelineEntryPlacement({ entry, laneId, startMs } = {}) {
  const request = await createTimelineEntryInsertionRequest({
    entry,
    laneId,
    startMs,
    actionId: 'action-placement-preview',
  });
  if (!request || request.blockedMessage) {
    clearActionPlacementPreview();
    return;
  }
  const requestedActions = request.draftPatches.map(patch =>
    createWorkbenchActionDraft(patch)
  );
  const previewRelations = normalizeWorkbenchActionRelations(
    [...actionRelations.value, ...(request.actionRelations ?? [])],
    [...actionDrafts.value, ...requestedActions]
  );
  const proposal = createActionPlacementProposal({
    requestedActions,
    relations: previewRelations,
    requestedLaneId: laneId,
  });
  lastActionPlacementProposal.value = proposal;
  actionPlacementPreview.value = createActionPlacementPreviewState({
    kind: 'insert',
    proposal,
    requestedActions,
    label: entry.label ?? '',
    icon: entry.icon ?? null,
  });
}

function previewTimelineFragmentPlacement({ fragment, laneId, startMs } = {}) {
  const instantiation = instantiateWorkbenchTimelineFragment(fragment, {
    targetStartMs: startMs,
    teamSlots: teamSlots.value,
    actorConfigs: actorConfigs.value,
    kiboActionsById: kiboActionCatalogLoaded.value
      ? kiboActionsById.value
      : null,
    existingActions: actionDrafts.value,
    existingRelations: actionRelations.value,
  });
  if (!instantiation.committable) {
    clearActionPlacementPreview();
    return;
  }
  const nextRelations = normalizeWorkbenchActionRelations(
    [...actionRelations.value, ...instantiation.relations],
    [...actionDrafts.value, ...instantiation.actions]
  );
  const proposal = createActionPlacementProposal({
    requestedActions: instantiation.actions,
    relations: nextRelations,
    requestedLaneId: laneId,
  });
  lastActionPlacementProposal.value = proposal;
  actionPlacementPreview.value = createActionPlacementPreviewState({
    kind: 'fragment',
    proposal,
    requestedActions: instantiation.actions,
    label: fragment.name,
  });
}

function copyAction(actionId) {
  const simultaneousActionIds = expandSimultaneousActionIds([actionId]);
  if (simultaneousActionIds.length > 1) {
    const sourceActions = actionDrafts.value.filter(action =>
      simultaneousActionIds.includes(action.id)
    );
    const sourceEndMs = Math.max(
      ...sourceActions.map(
        action => (Number(action.startMs) || 0) + resolveDraftDurationMs(action)
      )
    );
    actionClipboard.value = createWorkbenchActionClipboard(
      actionDrafts.value,
      simultaneousActionIds,
      actionRelations.value
    );
    return Boolean(
      pasteSelectedActions({
        targetStartMs: sourceEndMs + NEW_ACTION_INSERT_GAP_MS,
      })
    );
  }
  const sourceIndex = actionDrafts.value.findIndex(
    action => action.id === actionId
  );
  const sourceAction = actionDrafts.value[sourceIndex];
  if (!sourceAction) {
    return;
  }

  const requestedAction = createWorkbenchActionDraft({
    ...sourceAction,
    id: createNextActionId(),
    startMs: isConstraintAssistedPlacement()
      ? sourceAction.startMs +
        resolveDraftDurationMs(sourceAction) +
        NEW_ACTION_INSERT_GAP_MS
      : clampNumber(
          sourceAction.startMs +
            resolveDraftDurationMs(sourceAction) +
            NEW_ACTION_INSERT_GAP_MS,
          0,
          project.value.time.durationMs
        ),
    note: stripAutoDelayNote(sourceAction.note),
    insertion: null,
    generationBatch: null,
  });
  const proposal = createActionPlacementProposal({
    requestedActions: [requestedAction],
    requestedLaneId: resolveDraftLaneId(requestedAction),
  });
  lastActionPlacementProposal.value = proposal;
  const nextAction = applyConstraintAssistedProposal(proposal, [
    requestedAction,
  ])?.[0];
  if (!nextAction) {
    return false;
  }

  recordWorkbenchHistorySnapshot();
  const runtimeReviewState = captureActionMutationRuntimeReviewState();
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
  return true;
}

function copySelectedActions({ actionIds = selectedActionIds.value } = {}) {
  const expandedActionIds = expandSimultaneousActionIds(actionIds);
  const clipboard = createWorkbenchActionClipboard(
    actionDrafts.value,
    expandedActionIds,
    actionRelations.value
  );
  if (!clipboard) {
    return null;
  }

  actionClipboard.value = clipboard;
  return clipboard;
}

function pasteSelectedActions({ targetStartMs = undefined } = {}) {
  const pasteResult = pasteWorkbenchActionClipboard(actionClipboard.value, {
    existingActions: actionDrafts.value,
    existingRelations: actionRelations.value,
    timelineDurationMs: project.value.time.durationMs,
    targetStartMs,
    pasteGapMs: NEW_ACTION_INSERT_GAP_MS,
    clampToTimeline: !isConstraintAssistedPlacement(),
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

  let nextRelations = normalizeWorkbenchActionRelations(
    [...actionRelations.value, ...pasteResult.pastedRelations],
    [...actionDrafts.value, ...pasteResult.pastedActions]
  );
  const proposal = createActionPlacementProposal({
    requestedActions: pasteResult.pastedActions,
    relations: nextRelations,
    requestedLaneId: resolveDraftLaneId(pasteResult.pastedActions[0]),
  });
  lastActionPlacementProposal.value = proposal;
  const committedActions = applyConstraintAssistedProposal(
    proposal,
    pasteResult.pastedActions
  );
  if (!committedActions) {
    return null;
  }
  nextRelations = normalizeWorkbenchActionRelations(
    [...actionRelations.value, ...pasteResult.pastedRelations],
    [...actionDrafts.value, ...committedActions]
  );

  recordWorkbenchHistorySnapshot();
  const runtimeReviewState = captureActionMutationRuntimeReviewState();
  actionDrafts.value = [...actionDrafts.value, ...committedActions];
  actionRelations.value = nextRelations;
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
  return {
    ...pasteResult,
    pastedActions: committedActions,
  };
}

function insertTimelineFragment(
  fragmentId,
  { targetStartMs = frameToMs(timelineCursorFrameIndex.value) } = {}
) {
  const fragment = workbenchTimelineFragments.value.find(
    item => item.id === fragmentId
  );
  const instantiation = instantiateWorkbenchTimelineFragment(fragment, {
    targetStartMs,
    teamSlots: teamSlots.value,
    actorConfigs: actorConfigs.value,
    kiboActionsById: kiboActionCatalogLoaded.value
      ? kiboActionsById.value
      : null,
    existingActions: actionDrafts.value,
    existingRelations: actionRelations.value,
    createActionId: usedActionIds =>
      createNextActionIdFromUsedIds(usedActionIds),
    createRelationId: usedRelationIds =>
      createNextWorkbenchActionRelationIdFromUsedIds(usedRelationIds),
  });
  if (!instantiation.committable) {
    draftStatus.value =
      instantiation.issues[0]?.message ?? '片段身份或来源不兼容';
    return null;
  }

  let nextRelations = normalizeWorkbenchActionRelations(
    [...actionRelations.value, ...instantiation.relations],
    [...actionDrafts.value, ...instantiation.actions]
  );
  const proposal = createActionPlacementProposal({
    requestedActions: instantiation.actions,
    relations: nextRelations,
    requestedLaneId: resolveDraftLaneId(instantiation.actions[0]),
  });
  lastActionPlacementProposal.value = proposal;
  if (!proposal.committable) {
    draftStatus.value =
      proposal.conflicts[0]?.message ?? '片段无法完整放入当前位置';
    return null;
  }
  const committedActions = applyConstraintAssistedProposal(
    proposal,
    instantiation.actions
  );
  if (!committedActions) {
    return null;
  }
  nextRelations = normalizeWorkbenchActionRelations(
    [...actionRelations.value, ...instantiation.relations],
    [...actionDrafts.value, ...committedActions]
  );
  const insertedRelationIds = new Set(
    instantiation.relations.map(relation => relation.id)
  );
  if (
    nextRelations.filter(relation => insertedRelationIds.has(relation.id))
      .length !== instantiation.relations.length
  ) {
    draftStatus.value = '片段关系无法完整落盘';
    return null;
  }

  recordWorkbenchHistorySnapshot();
  const runtimeReviewState = captureActionMutationRuntimeReviewState();
  actionDrafts.value = [...actionDrafts.value, ...committedActions];
  actionRelations.value = nextRelations;
  setWorkbenchActionSelection(
    instantiation.selectedActionIds,
    instantiation.primaryActionId,
    { anchorActionId: instantiation.primaryActionId }
  );
  selectedActionRelationId.value = '';
  syncActionLibraryCharacterIdFromDraft(
    findActionDraftById(instantiation.primaryActionId)
  );
  applyActionMutationRuntimeSyncRequest({
    actionId: instantiation.primaryActionId,
    runtimeReviewState,
    selectedActionChanged: true,
    affectedActionIds: instantiation.selectedActionIds,
  });
  markDraftDirty();
  draftStatus.value = `已插入片段：${fragment.name}`;
  return {
    ...instantiation,
    proposal,
    actions: committedActions,
    relations: instantiation.relations,
  };
}

function deleteSelectedActions({ actionIds = selectedActionIds.value } = {}) {
  const requestedActionIds = new Set(expandSimultaneousActionIds(actionIds));
  const affectedActionIds = actionDrafts.value
    .filter(action => requestedActionIds.has(action.id))
    .map(action => action.id);
  if (affectedActionIds.length === 0) {
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

function expandSimultaneousActionIds(actionIds = []) {
  return expandWorkbenchPlacementActionIds({
    actions: actionDrafts.value,
    actionIds,
    actionRelations: actionRelations.value,
    relationKinds: [ACTION_RELATION_KINDS.SIMULTANEOUS],
  });
}

function moveSelectedActions({
  actionIds = selectedActionIds.value,
  primaryActionId = selectedActionId.value,
  offsetMs = 0,
  targetLaneId = null,
} = {}) {
  const request = createMoveActionPlacementRequest({
    actionIds,
    primaryActionId,
    offsetMs,
    targetLaneId,
  });
  if (!request) {
    return false;
  }
  const {
    affectedActionIds,
    editedActionId,
    laneMovePlan,
    nextActions: requestedNextActions,
    proposal,
    requestedActions,
    targetLane,
  } = request;
  const previousAction = findActionDraftById(editedActionId);
  const editSourceFocus = captureActionEditSourceFocus(editedActionId);
  lastActionPlacementProposal.value = proposal;
  const committedActions = applyConstraintAssistedProposal(
    proposal,
    requestedActions
  );
  if (!committedActions) {
    return false;
  }
  const nextActions = isConstraintAssistedPlacement()
    ? replacePlacementActions(actionDrafts.value, committedActions)
    : requestedNextActions;
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
    if (Number(previousAction.startMs) !== Number(nextAction.startMs)) {
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

function createMoveActionPlacementRequest({
  actionIds = selectedActionIds.value,
  primaryActionId = selectedActionId.value,
  offsetMs = 0,
  targetLaneId = null,
} = {}) {
  const availableActionIds = new Set(
    actionDrafts.value.map(action => action.id)
  );
  const requestedActionIds = [...new Set(actionIds)].filter(actionId =>
    availableActionIds.has(actionId)
  );
  const simultaneousActionIds = expandSimultaneousActionIds(requestedActionIds);
  const affectedActionIds = isConstraintAssistedPlacement()
    ? expandWorkbenchPlacementActionIds({
        actions: actionDrafts.value,
        actionIds: simultaneousActionIds,
        actionRelations: actionRelations.value,
      })
    : simultaneousActionIds;
  const editedActionId = affectedActionIds.includes(primaryActionId)
    ? primaryActionId
    : affectedActionIds.includes(selectedActionId.value)
      ? selectedActionId.value
      : (affectedActionIds[0] ?? '');
  if (!editedActionId) {
    return null;
  }

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
  if (
    laneMovePlan?.changesOwner &&
    actionRelations.value.some(
      relation =>
        relation.kind === ACTION_RELATION_KINDS.SIMULTANEOUS &&
        simultaneousActionIds.includes(relation.fromActionId)
    )
  ) {
    draftStatus.value = '合击配对不能跨角色槽移动';
    return null;
  }
  const preflightIssues =
    targetLaneId && !laneMovePlan
      ? [
          createPlacementPreflightIssue(
            'placement-lane-move-incompatible',
            '所选动作组不能整体移动到目标轨道'
          ),
        ]
      : [];
  const shifted = isConstraintAssistedPlacement()
    ? null
    : shiftWorkbenchActionDrafts(
        actionDrafts.value,
        affectedActionIds,
        offsetMs,
        project.value.time.durationMs
      );
  let nextActions = shifted?.actions ?? actionDrafts.value;
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

  const requestedOffsetMs = snapMsToFrame(Number(offsetMs) || 0);
  const requestedActions = nextActions
    .filter(action => affectedActionIds.includes(action.id))
    .map(action =>
      isConstraintAssistedPlacement()
        ? {
            ...action,
            startMs: snapMsToFrame(Number(action.startMs) + requestedOffsetMs),
          }
        : action
    );
  const proposal = createActionPlacementProposal({
    requestedActions,
    requestedLaneId: targetLaneId || resolveDraftLaneId(requestedActions[0]),
    preflightIssues,
  });
  return {
    affectedActionIds,
    editedActionId,
    laneMovePlan,
    nextActions,
    proposal,
    requestedActions,
    targetLane,
  };
}

function copyActionBatch(batchId) {
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
  const requestedOffsetMs =
    sourceMaxEndMs + NEW_ACTION_INSERT_GAP_MS - sourceMinStartMs;
  const offsetMs = isConstraintAssistedPlacement()
    ? requestedOffsetMs
    : clampNumber(
        requestedOffsetMs,
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
      startMs: isConstraintAssistedPlacement()
        ? (Number(action.startMs) || 0) + offsetMs
        : clampNumber(
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
  let nextRelations = normalizeWorkbenchActionRelations(
    [...actionRelations.value, ...copiedRelations],
    [...actionDrafts.value, ...copiedActions]
  );
  const proposal = createActionPlacementProposal({
    requestedActions: copiedActions,
    relations: nextRelations,
    requestedLaneId: resolveDraftLaneId(copiedActions[0]),
  });
  lastActionPlacementProposal.value = proposal;
  const committedActions = applyConstraintAssistedProposal(
    proposal,
    copiedActions
  );
  if (!committedActions) {
    return false;
  }
  nextRelations = normalizeWorkbenchActionRelations(
    [...actionRelations.value, ...copiedRelations],
    [...actionDrafts.value, ...committedActions]
  );

  recordWorkbenchHistorySnapshot();
  const runtimeReviewState = captureActionMutationRuntimeReviewState();
  const insertIndex = Math.max(...sourceEntries.map(entry => entry.index)) + 1;
  actionDrafts.value = [
    ...actionDrafts.value.slice(0, insertIndex),
    ...committedActions,
    ...actionDrafts.value.slice(insertIndex),
  ];
  actionRelations.value = nextRelations;
  selectedActionId.value = committedActions[0].id;
  syncActionLibraryCharacterIdFromDraft(committedActions[0]);
  applyActionMutationRuntimeSyncRequest({
    actionId: committedActions[0].id,
    runtimeReviewState,
    selectedActionChanged: true,
    affectedActionIds: committedActions.map(action => action.id),
  });
  markDraftDirty();
  return true;
}

function deleteAction(actionId) {
  return deleteSelectedActions({ actionIds: [actionId] });
}

function deleteActionBatch(batchId) {
  if (!batchId) {
    return;
  }

  const batchActionIds = new Set(
    actionDrafts.value
      .filter(action => action.generationBatch?.batchId === batchId)
      .map(action => action.id)
  );
  if (batchActionIds.size === 0) {
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
    const nextAction = actionDrafts.value[nextIndex];
    selectedActionId.value = nextAction?.id ?? '';
    syncActionLibraryCharacterIdFromDraft(nextAction);
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
  const appliedOffsetMs = isConstraintAssistedPlacement()
    ? snapMsToFrame(offset)
    : clampNumber(
        offset,
        -minStartMs,
        project.value.time.durationMs - maxStartMs
      );
  if (appliedOffsetMs === 0) {
    return;
  }

  let nextActions = actionDrafts.value.map(action => {
    if (action.generationBatch?.batchId !== batchId) {
      return action;
    }

    const nextStartMs = isConstraintAssistedPlacement()
      ? snapMsToFrame((Number(action.startMs) || 0) + appliedOffsetMs)
      : clampNumber(
          (Number(action.startMs) || 0) + appliedOffsetMs,
          0,
          project.value.time.durationMs
        );
    const nextAction = createWorkbenchActionDraft({
      ...action,
      ...clearInsertionForManualEdit(action),
      startMs: Math.max(0, nextStartMs),
    });
    return isConstraintAssistedPlacement()
      ? { ...nextAction, startMs: nextStartMs }
      : nextAction;
  });
  const requestedActions = nextActions.filter(action =>
    affectedActionIds.includes(action.id)
  );
  const proposal = createActionPlacementProposal({
    requestedActions,
    requestedLaneId: resolveDraftLaneId(batchActions[0]),
  });
  lastActionPlacementProposal.value = proposal;
  const committedActions = applyConstraintAssistedProposal(
    proposal,
    requestedActions
  );
  if (!committedActions) {
    return false;
  }
  if (isConstraintAssistedPlacement()) {
    nextActions = replacePlacementActions(actionDrafts.value, committedActions);
  }
  if (
    affectedActionIds.every(actionId => {
      const previous = findActionDraftById(actionId);
      const next = nextActions.find(action => action.id === actionId);
      return JSON.stringify(previous) === JSON.stringify(next);
    })
  ) {
    return false;
  }
  recordWorkbenchHistorySnapshot();
  actionDrafts.value = nextActions;
  applyActionMutationRuntimeSyncRequest({
    fallbackActionId: selectedActionId.value,
    runtimeReviewState,
    selectedActionChanged: selectedActionInBatch,
    affectedActionIds,
  });
  markDraftDirty();
  return true;
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
    mechanicsProfileSelection: mechanicsProfileSelection.value,
    actionDrafts: [],
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

function refreshWorkbenchTimelineFragmentLibrary() {
  const library = loadWorkbenchTimelineFragmentLibrary(getLocalStorage());
  workbenchTimelineFragments.value = library.fragments;
  return library;
}

function saveSelectedActionsAsTimelineFragment(metadata = {}) {
  const fragment = createWorkbenchTimelineFragment({
    actions: actionDrafts.value,
    selectedActionIds: selectedActionIds.value,
    actionRelations: actionRelations.value,
    teamSlots: teamSlots.value,
    actorConfigs: actorConfigs.value,
    metadata,
  });
  if (!fragment) {
    draftStatus.value = '请先选择可编排动作';
    return null;
  }
  const library = addWorkbenchTimelineFragment(getLocalStorage(), fragment);
  if (!library) {
    draftStatus.value = '片段存储不可用';
    return null;
  }
  workbenchTimelineFragments.value = library.fragments;
  draftStatus.value = `已保存片段：${fragment.name}`;
  return fragment;
}

function duplicateTimelineFragment(fragmentId) {
  const library = duplicateWorkbenchTimelineFragment(
    getLocalStorage(),
    fragmentId
  );
  if (!library) {
    draftStatus.value = '片段复制失败';
    return false;
  }
  workbenchTimelineFragments.value = library.fragments;
  draftStatus.value = '已复制片段';
  return true;
}

function deleteTimelineFragment(fragmentId) {
  const library = deleteWorkbenchTimelineFragment(
    getLocalStorage(),
    fragmentId
  );
  workbenchTimelineFragments.value = library.fragments;
  draftStatus.value = '已删除片段';
  return true;
}

function exportTimelineFragmentLibrary() {
  if (typeof Blob === 'undefined' || !workbenchTimelineFragments.value.length) {
    draftStatus.value = '没有可导出的片段';
    return false;
  }
  const exportedAt = new Date().toISOString();
  const blob = new Blob(
    [
      serializeWorkbenchTimelineFragmentLibrary(
        workbenchTimelineFragments.value,
        exportedAt
      ),
    ],
    { type: 'application/json' }
  );
  downloadWorkbenchBlob(
    blob,
    `promilia-timeline-fragments-${exportedAt.slice(0, 10)}.json`
  );
  draftStatus.value = '已导出片段库';
  return true;
}

async function importTimelineFragmentLibrary(file) {
  try {
    const rawLibrary = typeof file === 'string' ? file : await file?.text?.();
    const library = importWorkbenchTimelineFragmentLibrary(
      getLocalStorage(),
      rawLibrary
    );
    if (!library) {
      draftStatus.value = '片段库文件无效';
      return false;
    }
    workbenchTimelineFragments.value = library.fragments;
    draftStatus.value = `已导入 ${library.summary.fragmentCount} 个片段`;
    return true;
  } catch {
    draftStatus.value = '片段库导入失败';
    return false;
  }
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
    durationMs: draft.durationMs,
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
    combatScenario: draft.combatScenario,
    runtimeSampleCaptures: draft.runtimeSampleCaptures,
  });
}

function createCurrentWorkbenchProjectForActions(
  actions,
  relations = actionRelations.value
) {
  return createWorkbenchProject(selection.value, {
    durationMs: timelineDurationMs.value,
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
    actions,
    actionRelations: relations,
    cycleBoundaries: cycleBoundaries.value,
    initialRuntimeState: initialRuntimeState.value,
    combatScenario: combatScenario.value,
    runtimeSampleCaptures: runtimeSampleCaptures.value,
  });
}

function createActionPlacementProposal({
  requestedActions,
  currentActions = actionDrafts.value,
  relations = actionRelations.value,
  requestedLaneId = '',
  preflightIssues = [],
} = {}) {
  return createWorkbenchActionPlacementProposal({
    currentActions,
    requestedActions,
    actionRelations: relations,
    timelineDurationMs: project.value.time.durationMs,
    requestedLaneId,
    preflightIssues,
    evaluateCandidate: (candidateActions, context) =>
      evaluateActionPlacementCandidate(candidateActions, relations, context),
  });
}

function evaluateActionPlacementCandidate(
  candidateActions,
  relations,
  { requestedActionIds = [] } = {}
) {
  const candidateProject = createCurrentWorkbenchProjectForActions(
    candidateActions,
    relations
  );
  const candidateScenario = compileProject(candidateProject, gameData, {
    threeValueMechanicsProfileCatalog:
      DEFAULT_THREE_VALUE_MECHANICS_PROFILE_CATALOG,
  });
  const actionRuleDiagnostics = createActionRuleDiagnostics({
    scenario: candidateScenario,
  });
  const actionExecutionPlan = createActionExecutionPlan({
    scenario: candidateScenario,
    actionRuleDiagnostics,
  });
  const controlledActorTimeline = createControlledActorTimeline({
    scenario: candidateScenario,
    actionExecutionPlan,
  });
  return {
    sourceKind: 'workbench-compiled-action-placement-evaluation',
    actionRuleDiagnostics,
    controlledActorTimeline,
    unresolved: createControlledActorPlacementAdvisories({
      scenario: candidateScenario,
      controlledActorTimeline,
      requestedActionIds,
    }),
    ruleSources: [
      actionRuleDiagnostics.sourceKind,
      controlledActorTimeline.sourceKind,
    ],
  };
}

function createControlledActorPlacementAdvisories({
  scenario,
  controlledActorTimeline,
  requestedActionIds,
}) {
  const requestedActionIdSet = new Set(requestedActionIds);
  return (scenario.actions ?? [])
    .filter(
      action =>
        requestedActionIdSet.has(action.id) &&
        action.type === ACTION_TYPES.SKILL &&
        action.actorId
    )
    .map(action => {
      const controlledActor = resolveControlledActorAt(
        controlledActorTimeline,
        action.startMs
      );
      if (!controlledActor || controlledActor.actorId === action.actorId) {
        return null;
      }
      return {
        schemaVersion: 1,
        id: 'controlled-actor-placement-unresolved|' + action.id,
        code: 'controlled-actor-placement-unresolved',
        status: ACTION_RULE_STATUSES.UNRESOLVED,
        severity: 'warning',
        actionId: action.id,
        actionIds: [action.id],
        actorId: action.actorId,
        timeMs: action.startMs,
        message:
          action.name +
          ' 位于其他角色的前台区间；离场可用规则尚未确认，因此仅提示',
        source: {
          sourceKind: controlledActorTimeline.sourceKind,
          sourceStatus: 'tracking-only',
        },
        appliedToSimulationResults: false,
      };
    })
    .filter(Boolean);
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
    durationMs: timelineDurationMs.value,
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
    combatScenario: combatScenario.value,
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
    openWorkbenchAnalysisReport(report, '已生成贡献分析报告');
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
    closeScenarioComparison();
    openWorkbenchAnalysisReport(report, '已生成方案对比分析报告');
  } catch {
    draftStatus.value = '方案对比分析报告导出失败';
  }
}

function openWorkbenchAnalysisReport(report, statusText) {
  const validated = validateWorkbenchAnalysisReport(report);
  if (!validated) {
    throw new Error('Analysis report validation failed');
  }
  importedAnalysisReport.value = validated.report;
  importedAnalysisReportValidation.value = validated.validation;
  analysisReportReproducibilityAudit.value =
    auditWorkbenchAnalysisReportReproducibility(validated.report);
  analysisReportDialogVisible.value = true;
  draftStatus.value = statusText;
}

function exportImportedAnalysisReportJson() {
  const report = importedAnalysisReport.value;
  if (!report) {
    draftStatus.value = '分析报告不可用';
    return false;
  }
  if (typeof document === 'undefined' || typeof Blob === 'undefined') {
    draftStatus.value = '分析报告导出不可用';
    return false;
  }
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: 'application/json',
  });
  downloadWorkbenchBlob(blob, createWorkbenchAnalysisReportFileName(report));
  draftStatus.value = '已导出分析报告 JSON';
  return true;
}

async function exportImportedAnalysisReportPng() {
  if (
    analysisReportPngExporting.value ||
    !importedAnalysisReport.value ||
    typeof document === 'undefined' ||
    typeof Blob === 'undefined'
  ) {
    if (!analysisReportPngExporting.value) {
      draftStatus.value = '分析报告 PNG 导出不可用';
    }
    return false;
  }
  analysisReportPngExporting.value = true;
  draftStatus.value = '正在生成分析报告 PNG';
  try {
    await nextTick();
    await document.fonts?.ready;
    const surface = analysisReportDialog.value?.getExportSurface?.();
    if (!surface) {
      throw new Error('Analysis report export surface is unavailable');
    }
    const { snapdom } = await import('@zumer/snapdom');
    const capture = await snapdom(surface, { scale: 1 });
    const captureBlob = await capture.toBlob({ type: 'png', dpr: 1 });
    const metadata = createWorkbenchAnalysisReportPngMetadata(
      importedAnalysisReport.value
    );
    const pngBlob = await embedWorkbenchAnalysisReportInPng(
      captureBlob,
      metadata
    );
    downloadWorkbenchBlob(
      pngBlob,
      createWorkbenchAnalysisReportPngFileName(metadata)
    );
    draftStatus.value = '已导出分析报告 PNG';
    return true;
  } catch {
    draftStatus.value = '分析报告 PNG 导出失败';
    return false;
  } finally {
    analysisReportPngExporting.value = false;
  }
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
      openWorkbenchAnalysisReport(report, statusText);
      importedAnalysisReportValidation.value = validation;
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
  if (analysisReportPngExporting.value) {
    return false;
  }
  analysisReportDialogVisible.value = false;
  analysisReportReproducibilityAudit.value = null;
  return true;
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
  applyDraftState({
    ...createDefaultWorkbenchDraftState(),
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  clearWorkbenchProjectTransientState();
  undoHistoryStack.value = [];
  redoHistoryStack.value = [];
  draftStatus.value = '已重置草稿';
}

function applyDraftState(draft) {
  closeLoadoutPicker();
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
  migrateLegacyNormalAttackDrafts();
}

function migrateLegacyNormalAttackDrafts() {
  const migration = migrateLegacyAttackInputActionDrafts(actionDrafts.value, {
    resolveMapping: action =>
      getVerifiedCombatActionMapping({
        type: action.type,
        skillId: action.skillId,
        actionVariantIndex:
          action.actionVariantIndex ?? action.damageSegmentIndex ?? 0,
        actor: { characterId: action.actorCharacterId },
      }),
    createActionId: createNextActionIdFromUsedIds,
  });
  if (!migration.changed) return migration;
  actionDrafts.value = normalizeWorkbenchActionDrafts(
    migration.actions,
    selection.value,
    teamSlots.value
  );
  actionRelations.value = normalizeWorkbenchActionRelations(
    actionRelations.value,
    actionDrafts.value
  );
  if (migration.unresolvedActionIds.length) {
    draftStatus.value = `旧普攻有 ${migration.unresolvedActionIds.length} 项无法唯一拆分`;
  }
  return migration;
}

function applyWorkbenchScenarioDraftState(draft) {
  timelineDurationMs.value = normalizeWorkbenchTimelineDuration(
    draft.durationMs
  );
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
    timelineDurationMs.value
  );
  initialRuntimeState.value = cloneWorkbenchHistoryValue(
    draft.initialRuntimeState
  );
  combatScenario.value = normalizeCombatScenario(draft.combatScenario);
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
  lastActionPlacementProposal.value = null;
  clearActionPlacementPreview();
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
  selectedActionEffectRelationId.value = '';
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

  if (String(event.key ?? '').toLowerCase() === 'escape') {
    if (sideInspectorVisible.value) {
      event.preventDefault();
      dismissSideInspector();
    }
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
      } else if (selectedActionEffectRelationId.value) {
        return;
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
      durationMs: timelineDurationMs.value,
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
      combatScenario: combatScenario.value,
      runtimeSampleCaptures: runtimeSampleCaptures.value,
      selectedActionId: selectedActionId.value,
    },
    null
  );
  return cloneWorkbenchHistoryValue({
    durationMs: draftSnapshot.durationMs,
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
    combatScenario: draftSnapshot.combatScenario,
    runtimeSampleCaptures: draftSnapshot.runtimeSampleCaptures,
    selectedActionId: draftSnapshot.selectedActionId,
    selectedActionIds: selectedActionIds.value,
    actionSelectionAnchorId: actionSelectionAnchorId.value,
    selectedActionRelationId: selectedActionRelationId.value,
    selectedActionEffectRelationId: selectedActionEffectRelationId.value,
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
  timelineDurationMs.value = normalizeWorkbenchTimelineDuration(
    snapshot.durationMs
  );
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
    timelineDurationMs.value
  );
  initialRuntimeState.value = cloneWorkbenchHistoryValue(
    snapshot.initialRuntimeState
  );
  combatScenario.value = normalizeCombatScenario(snapshot.combatScenario);
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
  selectedActionEffectRelationId.value =
    runtimeOutputs.value.actionEffectRelationGraph.edges.some(
      edge => edge.edgeId === snapshot.selectedActionEffectRelationId
    )
      ? snapshot.selectedActionEffectRelationId
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

function findScenarioActionById(actionId) {
  return scenario.value.actions.find(action => action.id === actionId) ?? null;
}

function selectAction(actionRequest, { syncRuntimeResult = true } = {}) {
  dismissedSideInspectorKey.value = '';
  selectedActionRelationId.value = '';
  selectedActionEffectRelationId.value = '';
  selectedCycleBoundaryId.value = '';
  selectedEffectIntervalId.value = '';
  selectedEffectEventId.value = '';
  const request =
    actionRequest && typeof actionRequest === 'object'
      ? actionRequest
      : { actionId: actionRequest, mode: 'replace' };
  const actionId = String(request.actionId ?? '');
  const draftAction = findActionDraftById(actionId);
  const scenarioAction = findScenarioActionById(actionId);
  if (!draftAction && !isSwitchTriggeredDerivedAction(scenarioAction)) {
    return;
  }
  if (!draftAction) {
    selectedActionIds.value = [actionId];
    selectedActionId.value = actionId;
    actionSelectionAnchorId.value = actionId;
    selectTimelineFrame({
      timeMs: scenarioAction.startMs,
      source: 'derived-action-selection',
    });
    if (scenarioAction.actor?.characterId) {
      setActionLibraryCharacterId(scenarioAction.actor.characterId);
    }
    if (syncRuntimeResult && shouldSyncRuntimeResultOnActionSelect()) {
      syncRuntimeResultForSelectedAction(actionId);
    }
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
  selectedActionEffectRelationId.value = '';
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
  selectedActionEffectRelationId.value = '';
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

function selectActionEffectRelation(relationRequest) {
  const relationId =
    typeof relationRequest === 'object'
      ? relationRequest?.relationId
      : relationRequest;
  const relation = runtimeOutputs.value.actionEffectRelationGraph.edges.find(
    edge => edge.edgeId === relationId
  );
  if (!relation || relation.kind === 'sequence') {
    return false;
  }

  selectedActionRelationId.value = '';
  selectedCycleBoundaryId.value = '';
  boxSelectionMode.value = false;

  const interval = effectIntervalProjection.value.intervals.find(item =>
    item.lifecycleEventIds.includes(relation.runtimeEventId)
  );

  const actionId = relation.commandActionId;
  if (actionId && findActionDraftById(actionId)) {
    setWorkbenchActionSelection([actionId], actionId, {
      anchorActionId: actionId,
    });
    syncActionLibraryCharacterIdFromDraft(findActionDraftById(actionId));
  }
  selectTimelineFrame({
    timeMs: relation.targetTimeMs,
    source: 'action-effect-relation',
  });
  selectedEffectIntervalId.value = interval?.intervalId ?? '';
  selectedEffectEventId.value = relation.runtimeEventId ?? '';
  selectedActionEffectRelationId.value = relation.edgeId;
  return true;
}

function selectEffectInterval({
  intervalId = '',
  eventId = '',
  actionId = '',
  timeMs = null,
} = {}) {
  const interval = effectIntervalProjection.value.intervals.find(
    item => item.intervalId === intervalId
  );
  if (!interval) {
    return false;
  }
  selectedActionRelationId.value = '';
  selectedActionEffectRelationId.value = '';
  selectedCycleBoundaryId.value = '';
  boxSelectionMode.value = false;
  dismissedSideInspectorKey.value = '';
  const sourceActionId = actionId || interval.sourceActionId || '';
  if (sourceActionId) {
    selectAction(sourceActionId, { syncRuntimeResult: false });
  }
  selectTimelineFrame({
    timeMs: timeMs ?? interval.endMs,
    source: 'effect-interval',
  });
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
  const event = interval.lifecycleEvents.find(item => item.eventId === eventId);
  const sourceActionId = event?.actionId || interval.sourceActionId || '';
  if (sourceActionId) {
    selectAction(sourceActionId, { syncRuntimeResult: false });
  }
  selectedEffectIntervalId.value = interval.intervalId;
  selectedEffectEventId.value = eventId;
  selectedActionRelationId.value = '';
  selectedActionEffectRelationId.value = '';
  selectedCycleBoundaryId.value = '';
  dismissedSideInspectorKey.value = '';
  selectTimelineFrame({
    timeMs: event?.timeMs ?? interval.endMs,
    source: 'effect-lifecycle-event',
  });
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

function updateTimelineDuration(value) {
  const durationChange = createWorkbenchTimelineDurationChange({
    currentDurationMs: timelineDurationMs.value,
    requestedDurationMs: value,
    actions: scenario.value.actions,
    cycleBoundaries: cycleBoundaries.value,
    effectIntervals: effectIntervalProjection.value.timelineIntervals,
    runtimeEvents: collectTimelineDurationRuntimeEvents(),
  });
  if (!durationChange.allowed) {
    draftStatus.value = durationChange.message;
    return false;
  }
  if (durationChange.durationMs === timelineDurationMs.value) {
    return true;
  }
  pauseTimelinePlayback();
  recordWorkbenchHistorySnapshot();
  timelineDurationMs.value = durationChange.durationMs;
  timelineCursorFrameIndex.value = Math.min(
    timelineCursorFrameIndex.value,
    msToFrame(durationChange.durationMs)
  );
  markDraftDirty();
  draftStatus.value = `时间轴已调整为 ${durationChange.durationMs / 1000}s（未保存）`;
  return true;
}

function collectTimelineDurationRuntimeEvents() {
  const verifiedRuntime = simulationResult.value.verifiedCombatRuntime ?? {};
  return [
    ...(verifiedRuntime.damageEvents ?? []),
    ...(verifiedRuntime.resourceEvents ?? []),
    ...(verifiedRuntime.kiboResourceEvents ?? []),
    ...(verifiedRuntime.effectTimeline?.events ?? []),
    ...(verifiedRuntime.tuningMarkRuntime?.events ?? []),
  ];
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
        finalizeWorkbenchFlowAction(
          action,
          dispatchWorkbenchFlowActionNow(action)
        )
      );
    }
  }

  return finalizeWorkbenchFlowAction(
    action,
    dispatchWorkbenchFlowActionNow(action)
  );
}

function finalizeWorkbenchFlowAction(action, result) {
  const timelineFrame = action?.payload?.timelineFrame;
  if (result?.handled && timelineFrame) {
    selectTimelineFrame(timelineFrame);
  }
  return result;
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
      .then(({ getWorkbenchSkillDiagnostics }) =>
        getWorkbenchSkillDiagnostics()
      )
      .then(diagnostics => {
        installProjectSimulationSkillDiagnostics(diagnostics);
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
  const sideInspectorScroll = document.querySelector(
    '[data-testid="workbench-side-inspector-scroll"]'
  );
  if (sideInspectorScroll) {
    sideInspectorScroll.scrollTop = 0;
  }
}

function scrollActionEditFocusIntoView() {
  if (typeof document === 'undefined') {
    return;
  }
  const target = getActionEditFocusScrollTarget(actionEditFocus.value);
  scrollWorkbenchPanelTargetIntoView(target, {
    block: 'center',
    inline: 'nearest',
  });
}

function scrollWorkbenchPanelTargetIntoView(target, options = {}) {
  if (!target?.scrollIntoView || typeof window === 'undefined') {
    return;
  }
  const pageScrollLeft = window.scrollX;
  const pageScrollTop = window.scrollY;
  target.scrollIntoView(options);
  if (window.scrollX !== pageScrollLeft || window.scrollY !== pageScrollTop) {
    window.scrollTo(pageScrollLeft, pageScrollTop);
  }
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
  const scenarioAction = findScenarioActionById(actionId);
  if (
    !actionId ||
    (!findActionDraftById(actionId) &&
      !isSwitchTriggeredDerivedAction(scenarioAction))
  ) {
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

function addInsertedActionGroup(
  actionPatches = [],
  { actionRelations: insertedRelations = [] } = {}
) {
  const requestedActions = actionPatches.map(patch =>
    createWorkbenchActionDraft(patch)
  );
  if (!requestedActions.length) {
    return { actions: [], proposal: null, committed: false };
  }
  let nextRelations = normalizeWorkbenchActionRelations(
    [...actionRelations.value, ...insertedRelations],
    [...actionDrafts.value, ...requestedActions]
  );
  const proposal = createActionPlacementProposal({
    requestedActions,
    relations: nextRelations,
    requestedLaneId: resolveDraftLaneId(requestedActions[0]),
  });
  lastActionPlacementProposal.value = proposal;
  const committedActions = applyConstraintAssistedProposal(
    proposal,
    requestedActions
  )?.map(action => createWorkbenchActionDraft(action));
  if (!committedActions?.length) {
    return { actions: [], proposal, committed: false };
  }
  const runtimeReviewState = captureActionMutationRuntimeReviewState();
  const insertIndex = resolveInsertIndex();
  recordWorkbenchHistorySnapshot();
  actionDrafts.value = [
    ...actionDrafts.value.slice(0, insertIndex),
    ...committedActions,
    ...actionDrafts.value.slice(insertIndex),
  ];
  nextRelations = normalizeWorkbenchActionRelations(
    nextRelations,
    actionDrafts.value
  );
  actionRelations.value = nextRelations;
  setWorkbenchActionSelection(
    committedActions.map(action => action.id),
    committedActions[0].id,
    { anchorActionId: committedActions[0].id }
  );
  applyActionMutationRuntimeSyncRequest({
    actionId: committedActions[0].id,
    runtimeReviewState,
    selectedActionChanged: true,
    affectedActionIds: committedActions.map(action => action.id),
  });
  markDraftDirty();
  return {
    actions: committedActions,
    relations: insertedRelations,
    proposal,
    committed: true,
  };
}

function addInsertedAction(actionPatch, options = {}) {
  const runtimeReviewState = captureActionMutationRuntimeReviewState();
  const baseInsertIndex = resolveInsertIndex();
  const candidateAction = createWorkbenchActionDraft({
    ...actionPatch,
    startMs: options.requestedStartMs ?? resolveInsertStartMs(baseInsertIndex),
  });
  const placement = resolveInsertPlacement(candidateAction, baseInsertIndex);
  const committedPlacement = resolveCommittedInsertPlacement(placement);
  if (!committedPlacement) {
    return {
      action: null,
      placement,
      committed: false,
    };
  }
  const nextAction = createWorkbenchActionDraft({
    ...candidateAction,
    startMs: committedPlacement.startMs,
    note: createInsertionNote(candidateAction.note, committedPlacement),
    insertion: createInsertionMetadata(committedPlacement),
  });
  recordWorkbenchHistorySnapshot();
  actionDrafts.value = [
    ...actionDrafts.value.slice(0, committedPlacement.insertIndex),
    nextAction,
    ...actionDrafts.value.slice(committedPlacement.insertIndex),
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
    placement: committedPlacement,
    committed: true,
  };
}

function resolveInsertPlacement(
  candidateAction,
  baseInsertIndex,
  draftSource = actionDrafts.value
) {
  const laneId = resolveDraftLaneId(candidateAction);
  const requestedStartMs = clampNumber(
    candidateAction.startMs,
    0,
    project.value.time.durationMs
  );
  const requestedAction = createWorkbenchActionDraft({
    ...candidateAction,
    startMs: requestedStartMs,
  });
  const proposal = createActionPlacementProposal({
    currentActions: draftSource,
    requestedActions: [requestedAction],
    requestedLaneId: laneId,
  });
  lastActionPlacementProposal.value = proposal;
  return {
    ...resolveLegacyInsertPlacement(
      requestedAction,
      baseInsertIndex,
      draftSource
    ),
    proposal,
  };
}

function resolveLegacyInsertPlacement(
  candidateAction,
  baseInsertIndex,
  draftSource
) {
  const laneId = resolveDraftLaneId(candidateAction);
  const maxStartMs = project.value.time.durationMs;
  const requestedStartMs = clampNumber(candidateAction.startMs, 0, maxStartMs);
  if (candidateAction.type === ACTION_TYPES.SWITCH) {
    return {
      autoDelayed: false,
      conflictActionIds: [],
      insertIndex: baseInsertIndex,
      laneId,
      requestedStartMs,
      startMs: requestedStartMs,
    };
  }
  const durationMs = resolveDraftDurationMs(candidateAction);
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
  return action?.type === ACTION_TYPES.SWITCH
    ? 0
    : Math.max(1, Number(action.durationMs) || 1000);
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
    reason: placement.reason ?? 'same-lane-conflict',
    conflictActionIds: placement.conflictActionIds,
  };
}

function createInsertionNote(note, placement) {
  if (!placement.autoDelayed) {
    return note;
  }

  const message = placement.assisted
    ? `约束辅助：已从 ${placement.requestedStartMs}ms 调整到 ${placement.startMs}ms。`
    : `自动推迟：同轨已有动作占用，已从 ${placement.requestedStartMs}ms 调整到 ${placement.startMs}ms。`;
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

function selectTimelineIdentity(identity = {}) {
  const kind = identity.kind === 'enemy' ? 'enemy' : 'actor';
  selectedActionId.value = '';
  selectedActionIds.value = [];
  actionSelectionAnchorId.value = '';
  selectedStateCurvePointId.value = '';
  selectedTimelineIdentity.value = {
    kind,
    key:
      kind === 'enemy'
        ? `enemy:${scenario.value.enemy.id}`
        : `actor:${Number(identity.characterId)}`,
    label:
      identity.label ??
      (kind === 'enemy'
        ? scenario.value.enemy.name
        : resolveActionEditCharacterName(identity.characterId)),
    characterId: kind === 'actor' ? Number(identity.characterId) : null,
    enemyId: kind === 'enemy' ? Number(identity.enemyId) : null,
    kiboId: kind === 'actor' ? Number(identity.kiboId) || null : null,
  };
  if (kind === 'actor') {
    setActionLibraryCharacterId(identity.characterId);
  }
}

function dismissSideInspector() {
  dismissedSideInspectorKey.value = sideInspectorSelectionKey.value;
}

function setActionLibraryCharacterId(characterId) {
  const actor = scenario.value.actors.find(
    item => Number(item.characterId) === Number(characterId)
  );
  if (!actor) {
    return;
  }
  actionLibraryCharacterId.value = Number(actor.characterId);
}

function normalizeActionLibraryCharacterId(nextTeamSlots, characterRemap) {
  actionLibraryCharacterId.value =
    characterRemap.get(Number(actionLibraryCharacterId.value)) ??
    actionLibraryCharacterId.value;
  if (
    !nextTeamSlots.some(
      slot =>
        Number(slot.characterId) === Number(actionLibraryCharacterId.value)
    )
  ) {
    actionLibraryCharacterId.value = nextTeamSlots[0].characterId;
  }
}

function createTeamSlotCharacterRemap(previousTeamSlots, nextTeamSlots) {
  const remap = new Map();
  previousTeamSlots.forEach((slot, index) => {
    const previousCharacterId = Number(slot.characterId);
    const nextCharacterId = Number(nextTeamSlots[index]?.characterId);
    if (previousCharacterId !== nextCharacterId) {
      remap.set(previousCharacterId, nextCharacterId);
    }
  });
  return remap;
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
  const entry =
    input && typeof input === 'object'
      ? {
          ...input,
          skillId: input.skillId,
          actionVariantIndex:
            input.actionVariantIndex ?? input.damageSegmentIndex ?? 0,
        }
      : (getSkillActionCatalog(getSkillsForCharacter(actorCharacterId), 1).find(
          entry => Number(entry.skillId) === Number(input)
        ) ?? {
          skillId: Number(input),
          actionVariantIndex: 0,
          durationFrames: null,
          durationMs: null,
          timingStatus: 'unresolved',
          timingReasons: ['public-action-entry-missing'],
          label: '动作',
          rawValue: null,
        });
  const mapping = getVerifiedCombatActionMapping({
    type: ACTION_TYPES.SKILL,
    skillId: entry.skillId,
    actionVariantIndex: entry.actionVariantIndex,
    actor: { characterId: actorCharacterId },
  });
  return applyVerifiedActionTiming(entry, mapping);
}

function normalizeKiboActionEntryInput(input, kiboId, actorCharacterId) {
  const entry = {
    ...input,
    type: ACTION_TYPES.KIBO_EVENT,
    kiboId: Number(kiboId) || null,
    skillId: Number(input?.skillId) || null,
    eventType: input?.eventType ?? input?.kind ?? 'activation',
    label: input?.label ?? input?.name ?? '奇波动作',
    actionVariantIndex: Number(input?.actionVariantIndex) || 0,
  };
  const mapping = getVerifiedCombatActionMapping({
    type: ACTION_TYPES.KIBO_EVENT,
    skillId: entry.skillId,
    actionVariantIndex: entry.actionVariantIndex,
    kiboId: entry.kiboId,
    actor: {
      characterId: actorCharacterId,
      loadout: { kiboId: entry.kiboId },
    },
  });
  return applyVerifiedActionTiming(entry, mapping);
}

function applyVerifiedActionTiming(entry, mapping) {
  const actionTiming = mapping?.actionTiming ?? null;
  if (
    !actionTiming &&
    entry?.timingStatus === 'applied' &&
    Number.isFinite(Number(entry.durationMs)) &&
    Number(entry.durationMs) > 0
  ) {
    return {
      ...entry,
      needsTimingData: false,
      attackInputSegments: entry.attackInputSegments ?? [],
      mechanicsClassification: entry.mechanicsClassification ?? 'unresolved',
    };
  }
  const timingStatus = actionTiming?.status ?? 'unresolved';
  const durationFrames =
    timingStatus === 'applied'
      ? Number(actionTiming?.occupancy?.durationFrames) || null
      : null;
  const scheduling = resolveWorkbenchActionScheduling({
    timingStatus,
    durationFrames,
    actionScheduling: mapping?.actionScheduling,
  });
  return {
    ...entry,
    durationFrames,
    durationMs: durationFrames ? frameToMs(durationFrames) : null,
    timingStatus,
    timingReasons: actionTiming?.reasons ?? [
      'verified-action-timing-mapping-missing',
    ],
    timingSource: actionTiming?.occupancy?.sourceKind ?? null,
    timingSourceIdentity:
      actionTiming?.occupancy?.sourceIdentity ??
      actionTiming?.sourceIdentity ??
      null,
    needsTimingData: timingStatus !== 'applied',
    schedulingStatus: scheduling.status,
    schedulingKind: scheduling.kind,
    planningDurationFrames: scheduling.planningDurationFrames ?? null,
    actionScheduling: mapping?.actionScheduling ?? null,
    controlSubSkillIndex: scheduling.selectedSubSkillIndex,
    sourceEvidenceStatus:
      mapping?.sourceEvidenceStatus ?? mapping?.classification ?? 'unresolved',
    scenarioRuntimeStatus:
      mapping?.scenarioRuntimeStatus ?? mapping?.classification ?? 'unresolved',
    attackInputSegments: mapping?.attackInputSegments ?? [],
    mechanicsClassification: mapping?.classification ?? 'unresolved',
  };
}

function isActionEntrySchedulable(entry) {
  return (
    entry?.mechanicsClassification !== 'loading' &&
    Number.isInteger(Number(entry?.skillId)) &&
    Number(entry.skillId) > 0
  );
}

function formatUnschedulableActionMessage(entry) {
  return `${entry?.label ?? entry?.name ?? '动作'}的公开目录映射尚未加载，暂时不能加入时间轴`;
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

function createSideInspectorPanelOrders(inspectorMode, identityKind = '') {
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

  if (identityKind === 'actor') {
    return {
      teamLoadout: 0,
      properties: 1,
      configuration: 2,
      actionRules: 3,
      runtimeDetail: 4,
      enemy: 5,
      analysis: 6,
    };
  }

  if (identityKind === 'enemy') {
    return {
      enemy: 0,
      properties: 1,
      configuration: 2,
      actionRules: 3,
      runtimeDetail: 4,
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
  gap: 14px;
  min-height: 46px;
  padding: 0 14px;
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

.nav-side {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.nav-actions {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  justify-content: flex-end;
  gap: 5px;
}

.draft-status {
  color: #8f9aa3;
  font-size: 12px;
}

.nav-button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 28px;
  padding: 4px 8px;
  border: 1px solid rgba(121, 199, 185, 0.38);
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.12);
  color: #dff6f1;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.nav-button.icon-only {
  width: 28px;
  padding: 0;
  justify-content: center;
}

.nav-button.active,
.nav-button.run-command {
  border-color: rgba(121, 199, 185, 0.72);
  background: rgba(121, 199, 185, 0.2);
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

.project-menu {
  position: relative;
  z-index: 90;
}

.project-menu summary {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  gap: 5px;
  padding: 0 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: #d9dee3;
  font-size: 12px;
  cursor: pointer;
  list-style: none;
}

.project-menu summary::-webkit-details-marker {
  display: none;
}

.project-menu[open] summary {
  border-color: rgba(121, 199, 185, 0.68);
  background: rgba(121, 199, 185, 0.14);
}

.menu-chevron {
  width: 11px;
  height: 11px;
  transition: transform 140ms ease;
}

.project-menu[open] .menu-chevron {
  transform: rotate(180deg);
}

.project-menu-panel {
  position: absolute;
  top: calc(100% + 7px);
  right: 0;
  display: grid;
  width: 210px;
  gap: 4px;
  padding: 7px;
  border: 1px solid rgba(121, 199, 185, 0.34);
  border-radius: 4px;
  background: #10161b;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.52);
}

.project-menu-panel button {
  display: grid;
  min-height: 31px;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: #dbe3e7;
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.project-menu-panel button:hover,
.project-menu-panel button:focus-visible {
  border-color: rgba(121, 199, 185, 0.34);
  background: #1d2a28;
  outline: none;
}

.project-menu-panel button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.project-menu-status {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
  padding: 7px 5px 2px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.project-menu-status span {
  color: #73818a;
  font-size: 9px;
}

.project-import-input {
  display: none;
}

.workbench-grid {
  display: grid;
  grid-template-columns:
    minmax(0, var(--workbench-left-panel-width, 260px))
    10px
    minmax(0, 1fr);
  grid-template-areas:
    'actions left-resizer mainflow'
    'actions left-resizer review';
  gap: 12px 0;
  padding: 10px;
}

.action-library {
  position: sticky;
  top: 58px;
  grid-area: actions;
  min-width: 0;
  max-height: calc(100vh - 70px);
  overflow-x: hidden;
  overflow-y: auto;
}

.primary-flow {
  display: grid;
  grid-area: mainflow;
  align-content: start;
  gap: 14px;
  min-width: 0;
}

.timeline-area {
  height: calc(100dvh - 120px);
  min-height: 660px;
}

.review-workspace {
  display: grid;
  grid-area: review;
  align-content: start;
  gap: 14px;
  min-width: 0;
}

.secondary-workspace-tools {
  display: grid;
  gap: 8px;
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
  position: fixed;
  top: 108px;
  right: 10px;
  bottom: 10px;
  z-index: 70;
  display: grid;
  box-sizing: border-box;
  width: min(var(--workbench-right-panel-width, 340px), calc(100vw - 24px));
  min-width: 280px;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid rgba(121, 199, 185, 0.28);
  border-radius: 4px;
  background: rgba(15, 21, 26, 0.98);
  box-shadow: -18px 20px 50px rgba(0, 0, 0, 0.46);
}

.side-stack-header {
  position: relative;
  z-index: 3;
  display: grid;
  box-sizing: border-box;
  min-height: 48px;
  grid-template-columns: minmax(0, 1fr) 32px;
  align-items: center;
  gap: 10px;
  padding: 7px 8px 7px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
  background: #0f151a;
}

.side-stack-header > div {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.side-stack-header span {
  color: #6f7e87;
  font-size: 9px;
  font-weight: 800;
}

.side-stack-header strong {
  overflow: hidden;
  color: #eef7f5;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.side-stack-header button {
  display: grid;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  place-items: center;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 3px;
  background: #1b2329;
  color: #cbd5da;
  cursor: pointer;
  touch-action: manipulation;
}

.side-stack-header svg {
  width: 13px;
  height: 13px;
}

.side-stack-scroll {
  display: grid;
  min-width: 0;
  min-height: 0;
  align-content: start;
  gap: 10px;
  padding: 0 8px 10px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
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
  display: none;
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
    minmax(0, 1fr);
}

.workbench-grid.layout-left-collapsed.layout-right-collapsed {
  grid-template-columns: 0 0 minmax(0, 1fr);
}

.workbench-grid.layout-left-collapsed .action-library {
  visibility: hidden;
  pointer-events: none;
}

.workbench-grid.layout-left-collapsed .workspace-resizer-left {
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
      'actions review';
    column-gap: 10px;
  }

  .workbench-grid.layout-left-collapsed,
  .workbench-grid.layout-left-collapsed.layout-right-collapsed {
    grid-template-columns: 0 minmax(0, 1fr);
  }

  .workbench-grid.layout-right-collapsed {
    grid-template-areas:
      'mainflow mainflow'
      'actions review';
  }

  .workspace-resizer {
    display: none;
  }
}

@media (max-width: 760px) {
  .top-nav {
    align-items: center;
    flex-direction: row;
    padding: 7px 8px;
    overflow: hidden;
  }

  .nav-side {
    flex: 1;
    justify-content: flex-end;
    overflow-x: auto;
  }

  .nav-actions {
    justify-content: flex-end;
  }

  .workbench-brand span,
  .draft-status {
    display: none;
  }

  .project-menu-panel {
    position: fixed;
    top: 48px;
    right: 8px;
  }

  .workbench-grid,
  .workbench-grid.layout-left-collapsed,
  .workbench-grid.layout-right-collapsed,
  .workbench-grid.layout-left-collapsed.layout-right-collapsed {
    grid-template-columns: 1fr;
    grid-template-areas:
      'mainflow'
      'review'
      'actions';
    padding: 6px;
  }

  .workbench-grid:has(> .action-library.fragment-mode) {
    grid-template-areas:
      'actions'
      'mainflow'
      'review';
  }

  .timeline-area {
    height: calc(100dvh - 112px);
    min-height: 660px;
  }

  .workbench-grid.layout-left-collapsed .action-library {
    visibility: visible;
    pointer-events: auto;
  }

  .action-library {
    position: static;
    max-height: none;
    overflow: visible;
  }

  .side-stack {
    top: auto;
    right: 6px;
    bottom: 6px;
    left: 6px;
    width: auto;
    min-width: 0;
    max-height: 72vh;
  }

  .runtime-review-stack[data-runtime-review-layout='result-check'] {
    grid-template-columns: 1fr;
  }
}
</style>
