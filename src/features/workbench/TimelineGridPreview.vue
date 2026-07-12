<template>
  <section
    class="panel timeline-panel"
    :data-flow-selected-action-id="flowSelectedActionId"
    :data-action-relation-count="actionRelations.length"
    :data-cycle-boundary-count="cycleBoundaries.length"
    :data-selected-cycle-boundary-id="selectedCycleBoundaryId"
    :data-effect-interval-count="effectIntervals.length"
    :data-selected-effect-interval-id="selectedEffectIntervalId"
    :data-box-selection-mode="boxSelectionMode ? 'true' : 'false'"
    :data-flow-selected-state-curve-point-id="flowSelectedStateCurvePointId"
    :data-flow-runtime-focus-source="flowRuntimeFocusSource"
    :data-cursor-frame-index="timelineCursor.frameIndex"
    :data-cursor-time-ms="timelineCursor.timeMs"
    :data-playback-running="playbackRunning ? 'true' : 'false'"
    :data-playback-rate="playbackRate"
    :data-playback-range-mode="playbackRangeMode"
    data-testid="workbench-timeline-grid-preview"
  >
    <div class="panel-title">
      <Clock class="panel-icon" />
      <h2>时间轴</h2>
      <div class="timeline-tools">
        <details class="timeline-entry-palette">
          <summary
            data-testid="workbench-timeline-entry-palette-toggle"
            title="编排素材"
          >
            <Plus class="control-icon" />
            <span>编排</span>
          </summary>
          <div
            class="timeline-entry-palette-menu"
            data-testid="workbench-timeline-entry-palette"
          >
            <button
              v-for="entry in timelineEntryCatalog"
              :key="`${entry.type}-${entry.skillId ?? entry.eventType ?? 'entry'}`"
              type="button"
              draggable="true"
              :data-entry-type="entry.type"
              data-testid="workbench-timeline-entry-source"
              @dragstart="beginTimelineShelfEntryDrag($event, entry)"
              @dragend="endTimelineShelfEntryDrag"
              @click="insertTimelineShelfEntry(entry)"
            >
              <i :class="`type-${entry.type}`" />
              <span>{{ entry.label }}</span>
            </button>
          </div>
        </details>
        <button
          class="icon-control"
          :class="{ active: boxSelectionMode }"
          type="button"
          data-testid="workbench-timeline-box-select-toggle"
          aria-label="框选动作"
          aria-keyshortcuts="Control+B Meta+B"
          title="框选动作"
          @click="$emit('toggle-box-selection-mode')"
        >
          <Crop class="control-icon" />
        </button>
        <button
          class="icon-control"
          type="button"
          data-testid="workbench-timeline-create-relations"
          aria-label="连接所选动作"
          title="按时间顺序连接所选动作"
          :disabled="selectedActionIds.length < 2"
          @click="$emit('create-action-relations')"
        >
          <Connection class="control-icon" />
        </button>
        <div
          class="timeline-playback-controls"
          :data-running="playbackRunning ? 'true' : 'false'"
          :data-range-mode="playbackRangeMode"
          :data-range-start-frame="playbackRange.startFrame"
          :data-range-end-frame="playbackRange.endFrame"
          data-testid="workbench-timeline-playback-controls"
        >
          <button
            class="icon-control"
            type="button"
            data-testid="workbench-timeline-step-backward"
            aria-label="后退一帧"
            title="后退一帧"
            @click="$emit('step-timeline-frame', -1)"
          >
            <ArrowLeft class="control-icon" />
          </button>
          <button
            class="icon-control playback-toggle"
            :class="{ active: playbackRunning }"
            type="button"
            :aria-label="playbackRunning ? '暂停' : '播放'"
            :title="playbackRunning ? '暂停' : '播放'"
            :data-running="playbackRunning ? 'true' : 'false'"
            data-testid="workbench-timeline-playback-toggle"
            @click="$emit('toggle-timeline-playback')"
          >
            <VideoPause v-if="playbackRunning" class="control-icon" />
            <VideoPlay v-else class="control-icon" />
          </button>
          <button
            class="icon-control"
            type="button"
            data-testid="workbench-timeline-step-forward"
            aria-label="前进一帧"
            title="前进一帧"
            @click="$emit('step-timeline-frame', 1)"
          >
            <ArrowRight class="control-icon" />
          </button>
          <select
            class="playback-rate-select"
            :value="playbackRate"
            data-testid="workbench-timeline-playback-rate"
            aria-label="播放速度"
            title="播放速度"
            @change="$emit('update-playback-rate', $event.target.value)"
          >
            <option :value="0.5">0.5x</option>
            <option :value="1">1x</option>
            <option :value="2">2x</option>
          </select>
          <div
            v-if="cycleBoundaries.length"
            class="playback-range-mode"
            role="group"
            aria-label="播放范围"
          >
            <button
              v-for="option in playbackRangeModeOptions"
              :key="option.key"
              type="button"
              :class="{ active: playbackRangeMode === option.key }"
              :aria-pressed="playbackRangeMode === option.key"
              :data-range-mode="option.key"
              data-testid="workbench-timeline-playback-range-mode"
              @click="$emit('update-playback-range-mode', option.key)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
        <output
          class="timeline-cursor-readout"
          :data-frame-index="timelineCursor.frameIndex"
          :data-time-ms="timelineCursor.timeMs"
          data-testid="workbench-timeline-cursor-readout"
        >
          {{ timelineCursor.frameIndex }}F ·
          {{ formatFrameTime(timelineCursor.timeMs) }}
        </output>
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
      <div
        v-if="stateCurveTimelineLayerOptions.length"
        class="state-layer-toggle-group"
        data-testid="workbench-timeline-state-layer-toggle-group"
      >
        <label
          v-for="layer in stateCurveTimelineLayerOptions"
          :key="layer.key"
          class="state-layer-toggle"
          :class="{ 'has-points': layer.pointCount > 0 }"
          :data-layer-key="layer.key"
        >
          <input
            type="checkbox"
            :checked="isStateCurveTimelineLayerVisible(layer.key)"
            :data-layer-key="layer.key"
            :data-point-count="layer.pointCount"
            data-testid="workbench-timeline-state-layer-toggle"
            @change="
              setStateCurveLayerVisible(layer.key, $event.target.checked)
            "
          />
          <span>{{ layer.label }} {{ layer.pointCount }}</span>
        </label>
      </div>
      <div
        v-if="stateCurveTimelineTrackOptions.length"
        class="state-track-toggle-group"
        data-testid="workbench-timeline-state-track-toggle-group"
      >
        <label
          v-for="track in stateCurveTimelineTrackOptions"
          :key="track.trackKey"
          class="state-track-toggle"
          :class="{ 'has-points': track.pointCount > 0 }"
          :data-track-key="track.trackKey"
        >
          <input
            type="checkbox"
            :checked="isStateCurveTrackVisible(track.trackKey)"
            :data-track-key="track.trackKey"
            :data-point-count="track.pointCount"
            data-testid="workbench-timeline-state-track-toggle"
            @change="
              setStateCurveTrackVisible(track.trackKey, $event.target.checked)
            "
          />
          <span>{{ track.label }} {{ track.pointCount }}</span>
        </label>
      </div>
    </div>

    <div class="timeline-scale">
      <span class="scale-spacer" />
      <div
        ref="scaleViewportRef"
        class="scale-viewport"
        data-testid="workbench-timeline-scale-viewport"
        @scroll="synchronizeTimelineScroll('scale')"
      >
        <div
          class="scale-track"
          :style="timelineTrackStyle"
          data-testid="workbench-timeline-scale-track"
        >
          <span v-for="tick in ticks" :key="tick.timeMs">{{ tick.label }}</span>
          <i
            class="timeline-scale-cursor"
            :style="timelineCursorStyle"
            data-testid="workbench-timeline-scale-cursor"
          />
        </div>
      </div>
    </div>

    <div class="timeline-shell">
      <div class="lane-labels">
        <div
          v-for="lane in timelineLanes"
          :key="lane.id"
          class="lane-label"
          :class="{
            system: lane.type === 'system',
            enemy: lane.type === 'enemy',
            kibo: lane.type === 'kibo',
            curve: lane.type === 'curve',
          }"
          :style="laneRowStyle(lane)"
          :data-lane-id="lane.id"
          :data-lane-kind="lane.kind"
          :data-actor-id="lane.actorId || ''"
          :title="
            lane.curve
              ? `${lane.detail} · ${formatTopologyCurveCursorValue(lane.curve)}`
              : ''
          "
          data-testid="workbench-timeline-lane-label"
        >
          <span>{{ lane.name }}</span>
          <small>{{
            lane.curve
              ? formatTopologyCurveCursorValue(lane.curve)
              : lane.detail
          }}</small>
        </div>
      </div>

      <div
        ref="timelineViewportRef"
        class="timeline-viewport"
        data-testid="workbench-timeline-viewport"
        @scroll="synchronizeTimelineScroll('timeline')"
      >
        <div
          ref="laneRef"
          class="timeline-lane"
          :style="timelineTrackStyle"
          :class="{ 'box-selection-active': boxSelectionMode }"
          data-testid="workbench-timeline-lane"
          @pointerdown="beginBoxSelection"
          @click="selectTimelineFrameFromPointer"
          @contextmenu.prevent="openTimelineContextMenu"
        >
          <div
            v-if="selectedCycleSection"
            class="cycle-section-highlight"
            :style="cycleSectionHighlightStyle"
            :data-section-id="selectedCycleSection.sectionId"
            data-testid="workbench-cycle-section-highlight"
          />
          <button
            v-for="boundary in cycleBoundaries"
            :key="boundary.id"
            class="cycle-boundary"
            :class="{ selected: boundary.id === selectedCycleBoundaryId }"
            :style="cycleBoundaryStyle(boundary)"
            type="button"
            :data-boundary-id="boundary.id"
            :data-time-ms="cycleBoundaryTimeMs(boundary)"
            data-testid="workbench-cycle-boundary"
            :title="`循环边界 ${formatFrameTime(cycleBoundaryTimeMs(boundary))}`"
            @pointerdown.stop="beginCycleBoundaryDrag($event, boundary)"
            @contextmenu.prevent.stop="
              openCycleBoundaryContextMenu($event, boundary)
            "
          >
            <span>{{ formatFrameTime(cycleBoundaryTimeMs(boundary)) }}</span>
          </button>
          <svg
            v-if="actionRelationGeometry.length"
            class="action-relation-layer"
            :viewBox="actionRelationViewBox"
            preserveAspectRatio="none"
            data-testid="workbench-action-relation-layer"
          >
            <g
              v-for="relation in actionRelationGeometry"
              :key="relation.id"
              class="action-relation"
              :class="{ selected: relation.id === selectedActionRelationId }"
            >
              <path
                class="action-relation-path"
                :d="relation.path"
                vector-effect="non-scaling-stroke"
              />
              <circle
                class="action-relation-endpoint"
                :cx="relation.targetX"
                :cy="relation.targetY"
                r="0.7"
                vector-effect="non-scaling-stroke"
              />
              <path
                class="action-relation-hit"
                :d="relation.path"
                vector-effect="non-scaling-stroke"
                :data-relation-id="relation.id"
                data-testid="workbench-action-relation"
                @pointerdown.stop
                @click.stop="selectActionRelation(relation.id)"
                @contextmenu.prevent.stop="
                  openActionRelationContextMenu($event, relation.id)
                "
              >
                <title>{{ relation.title }}</title>
              </path>
            </g>
          </svg>
          <div
            v-if="boxSelectionState"
            class="box-selection-overlay"
            :style="boxSelectionStyle"
            data-testid="workbench-timeline-box-selection"
          ></div>
          <div
            class="timeline-frame-cursor"
            :style="timelineCursorStyle"
            :data-frame-index="timelineCursor.frameIndex"
            :data-time-ms="timelineCursor.timeMs"
            data-testid="workbench-timeline-frame-cursor"
          >
            <div
              class="timeline-frame-cursor-handle"
              data-testid="workbench-timeline-frame-cursor-handle"
              role="slider"
              tabindex="0"
              :aria-valuemin="0"
              :aria-valuemax="timelineCursor.maxFrameIndex"
              :aria-valuenow="timelineCursor.frameIndex"
              aria-label="时间轴帧游标"
              @pointerdown.stop="beginTimelineCursorDrag"
              @click.stop
              @keydown.left.prevent="nudgeTimelineCursor($event, -1)"
              @keydown.right.prevent="nudgeTimelineCursor($event, 1)"
            />
          </div>
          <div
            v-for="lane in timelineLanes"
            :key="lane.id"
            class="lane-row"
            :class="{
              'drop-target':
                (lane.id === dragTargetLaneId &&
                  lane.id !== dragInitialLaneId) ||
                lane.id === externalDropTargetLaneId,
            }"
            :data-lane-id="lane.id"
            :data-lane-kind="lane.kind"
            :data-actor-id="lane.actorId || ''"
            :data-editable="lane.editable ? 'true' : 'false'"
            data-testid="workbench-timeline-row"
            :style="laneRowStyle(lane)"
            :ref="element => setLaneRowRef(element, lane.id)"
            @dragenter="handleTimelineEntryDragOver($event, lane)"
            @dragover="handleTimelineEntryDragOver($event, lane)"
            @dragleave="handleTimelineEntryDragLeave($event, lane)"
            @drop="handleTimelineEntryDrop($event, lane)"
          >
            <div
              v-if="lane.curve"
              class="timeline-state-curve"
              :class="`curve-${lane.curve.trackKey}`"
              :data-track-key="lane.curve.trackKey"
              :data-actor-id="lane.curve.actorId || ''"
              :data-initial-value="lane.curve.initialValue"
              :data-current-value="lane.curve.currentValue"
              :data-cursor-value="lane.curve.cursorValue"
              :data-cursor-frame-index="timelineCursor.frameIndex"
              :data-max-value="lane.curve.maxValue ?? ''"
              :data-point-count="lane.curve.pointCount"
              data-testid="workbench-timeline-state-curve"
            >
              <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline
                  :points="lane.curve.stepPoints"
                  :data-lane-id="lane.id"
                  :data-track-key="lane.curve.trackKey"
                  :data-point-count="lane.curve.pointCount"
                  data-testid="workbench-timeline-state-curve-line"
                />
                <circle
                  v-for="point in lane.curve.breakpoints"
                  :key="point.id"
                  :cx="point.xPercent"
                  :cy="point.yPercent"
                  r="1.8"
                  :data-action-id="point.actionId"
                  :data-state-point-id="point.statePointId"
                  :data-time-ms="point.timeMs"
                  :data-frame-index="point.frameIndex"
                  :data-current-value="point.currentValue"
                  data-testid="workbench-timeline-state-curve-breakpoint"
                  role="button"
                  tabindex="0"
                  @click.stop="selectRuntimeCurveBreakpoint(point)"
                  @keydown.enter.prevent="selectRuntimeCurveBreakpoint(point)"
                  @keydown.space.prevent="selectRuntimeCurveBreakpoint(point)"
                />
                <circle
                  class="timeline-state-curve-cursor"
                  :cx="timelineCursor.xPercent"
                  :cy="lane.curve.cursorYPercent"
                  r="2.2"
                  :data-current-value="lane.curve.cursorValue"
                  :data-frame-index="timelineCursor.frameIndex"
                  data-testid="workbench-timeline-state-curve-cursor"
                />
              </svg>
            </div>
            <div
              v-for="window in lane.cooldownWindows"
              :key="window.windowId"
              class="cooldown-window"
              :style="cooldownWindowStyle(window)"
              :title="formatCooldownWindowTitle(window)"
              :data-action-id="window.actionId"
              :data-charge-index="window.chargeIndex"
              :data-end-ms="window.endMs"
              :data-window-id="window.windowId"
              data-testid="workbench-timeline-cooldown-window"
            />

            <div
              v-for="action in lane.actions"
              :key="action.id"
              class="action-block"
              :class="[
                {
                  selected: action.id === flowSelectedActionId,
                  'multi-selected': selectedActionIdSet.has(action.id),
                  dragging: isDraggingAction(action.id),
                  overlap: overlapActionIds.has(action.id),
                  resizing: action.id === resizingActionId,
                  'auto-delayed': action.insertion?.autoDelayed,
                  'batch-selected': isActionInSelectedBatch(action),
                  'edit-focused': isActionEditFocused(action),
                  'has-result-edit': isTimelineActionResultEditVisible(action),
                  'cursor-active': isActionActiveAtTimelineCursor(action),
                  'readiness-blocked':
                    getActionReadiness(action).status === 'blocked',
                  'readiness-unresolved':
                    getActionReadiness(action).status ===
                    'ready-with-unresolved-conditions',
                },
                `type-${action.type}`,
              ]"
              :style="actionStyle(action)"
              :data-action-id="action.id"
              :data-action-type="action.type"
              :data-start-ms="action.startMs"
              :data-cursor-active="
                isActionActiveAtTimelineCursor(action) ? 'true' : 'false'
              "
              :data-selected="
                selectedActionIdSet.has(action.id) ? 'true' : 'false'
              "
              :data-lane-id="lane.id"
              :data-readiness-status="getActionReadiness(action).status"
              :data-readiness-executable="
                getActionReadiness(action).executable ? 'true' : 'false'
              "
              :data-batch-id="action.generationBatch?.batchId || ''"
              :data-batch-highlight="
                isActionInSelectedBatch(action) ? 'true' : 'false'
              "
              :data-edit-focused="isActionEditFocused(action)"
              :data-edit-focus-field="getActionEditFocusField(action)"
              :data-edit-focus-label="getActionEditFocusLabel(action)"
              :data-edit-focus-source="getActionEditFocusSource(action)"
              :data-edit-focus-summary="getActionEditFocusSummary(action)"
              data-testid="workbench-timeline-action"
              :title="formatTimelineActionTitle(action)"
              tabindex="0"
              @click.stop="handleActionClick($event, action)"
              @contextmenu.prevent.stop="openActionContextMenu($event, action)"
              @keydown.enter.prevent="handleActionSelect($event, action)"
              @keydown.left.prevent="nudgeAction($event, action, -1)"
              @keydown.right.prevent="nudgeAction($event, action, 1)"
              @keydown.delete.prevent="deleteActionSelection(action)"
              @keydown.backspace.prevent="deleteActionSelection(action)"
              @pointerdown.stop="beginDrag($event, action)"
            >
              <span>{{ actionLabel(action) }}</span>
              <small v-if="actionDetail(action)">{{
                actionDetail(action)
              }}</small>
              <button
                v-if="isTimelineActionResultEditVisible(action)"
                class="timeline-action-result-edit-button"
                type="button"
                title="编辑结果"
                aria-label="编辑结果"
                data-testid="workbench-timeline-edit-result-action"
                :data-action-id="
                  getTimelineActionResultEditCommand(action).actionId
                "
                :data-state-point-id="
                  getTimelineActionResultEditCommand(action).statePointId
                "
                :disabled="!getTimelineActionResultEditCommand(action).enabled"
                @click.stop="focusTimelineActionResult(action)"
                @pointerdown.stop
              >
                <EditPen class="timeline-action-result-edit-icon" />
              </button>
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

            <button
              v-for="interval in lane.effectIntervals"
              :key="interval.intervalId"
              class="effect-interval"
              :class="[
                'target-' + interval.targetKind,
                {
                  selected: interval.intervalId === selectedEffectIntervalId,
                  persistent: interval.persistent,
                  active: interval.activeAtScenarioEnd,
                },
              ]"
              type="button"
              :style="effectIntervalStyle(interval, lane)"
              :title="formatEffectIntervalTitle(interval)"
              :aria-label="formatEffectIntervalTitle(interval)"
              :data-interval-id="interval.intervalId"
              :data-effect-id="interval.effectId"
              :data-target-kind="interval.targetKind"
              :data-target-id="interval.targetId"
              :data-source-action-id="interval.sourceActionId || ''"
              :data-start-ms="interval.startMs"
              :data-end-ms="interval.endMs"
              :data-lifecycle-event-count="interval.lifecycleEvents.length"
              :data-selected="
                interval.intervalId === selectedEffectIntervalId
                  ? 'true'
                  : 'false'
              "
              data-testid="workbench-timeline-effect-interval"
              @click.stop="selectEffectInterval(interval)"
              @keydown.enter.prevent="selectEffectInterval(interval)"
              @keydown.space.prevent="selectEffectInterval(interval)"
              @pointerdown.stop
            >
              <span class="effect-interval-glyph">
                {{ effectIntervalGlyph(interval) }}
              </span>
              <span class="effect-interval-label">
                {{ interval.effectName || interval.effectId }}
              </span>
              <small v-if="interval.maxStacks > 1">
                {{ interval.peakStacks }}/{{ interval.maxStacks }}
              </small>
              <i
                v-for="event in interval.lifecycleEvents.slice(1)"
                :key="event.eventId"
                class="effect-lifecycle-marker"
                :class="'event-' + String(event.type).toLowerCase()"
                :style="effectLifecycleMarkerStyle(event, interval)"
              />
            </button>

            <div
              v-for="damage in lane.damageMarkers"
              :key="`${damage.actionId}-${damage.timeMs}`"
              class="damage-marker"
              :class="{ 'batch-selected': isDamageInSelectedBatch(damage) }"
              :style="markerStyle(damage, lane)"
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
              :style="timelineDataLayerStyle(lane)"
              data-testid="workbench-timeline-candidate-value-curve-track"
              :data-lane-id="lane.id"
            >
              <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline
                  v-for="curve in lane.candidateValueCurves"
                  :key="curve.seriesKey"
                  class="candidate-value-curve-line"
                  :class="[
                    `candidate-${curve.seriesKey}`,
                    {
                      'track-focused': isCandidateSeriesInStateTrackFocus(
                        curve.seriesKey
                      ),
                    },
                  ]"
                  :points="curve.polylinePoints"
                  vector-effect="non-scaling-stroke"
                  data-testid="workbench-timeline-candidate-value-curve"
                  :data-series-key="curve.seriesKey"
                  :data-point-count="curve.pointCount"
                  :data-track-focused="
                    isCandidateSeriesInStateTrackFocus(curve.seriesKey)
                      ? 'true'
                      : 'false'
                  "
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
              :style="candidateValueFrameHotspotStyle(group, lane)"
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
                  'track-focused': isCandidateMarkerInStateTrackFocus(marker),
                },
              ]"
              :style="candidateValueMarkerStyle(marker, lane)"
              :title="formatCandidateValueMarkerTitle(marker)"
              :aria-label="formatCandidateValueMarkerTitle(marker)"
              :data-action-id="marker.actionId"
              :data-lane-id="lane.id"
              :data-series-key="marker.seriesKey"
              :data-hit-index="marker.hitIndex"
              :data-frame-label="marker.frameLabel"
              :data-value="marker.value"
              :data-state-track-key="getCandidateSeriesStateTrackKey(marker)"
              :data-track-focused="
                isCandidateMarkerInStateTrackFocus(marker) ? 'true' : 'false'
              "
              :data-marker-title="formatCandidateValueMarkerTitle(marker)"
              data-testid="workbench-timeline-candidate-value-marker"
              role="button"
              tabindex="0"
              @click="selectCandidateFrameGroupByMarker(marker)"
              @keydown.enter.prevent="selectCandidateFrameGroupByMarker(marker)"
              @keydown.space.prevent="selectCandidateFrameGroupByMarker(marker)"
            />

            <div
              v-for="marker in lane.stateCurveMarkers"
              :key="marker.id"
              class="state-curve-marker"
              :class="[
                `state-layer-${marker.layerKey}`,
                `state-track-${marker.trackKey}`,
                {
                  selected:
                    marker.statePointId === flowSelectedStateCurvePointId,
                },
              ]"
              :style="stateCurveMarkerStyle(marker, lane)"
              :title="formatStateCurveMarkerTitle(marker)"
              :aria-label="formatStateCurveMarkerTitle(marker)"
              :data-action-id="marker.actionId"
              :data-lane-id="lane.id"
              :data-track-key="marker.trackKey"
              :data-layer-key="marker.layerKey"
              :data-frame-index="marker.frameIndex"
              :data-frame-label="marker.frameLabel"
              :data-delta="marker.delta"
              :data-cumulative="marker.cumulative"
              :data-state-point-id="marker.statePointId"
              :data-runtime-focus-source="
                marker.statePointId === flowSelectedStateCurvePointId
                  ? flowRuntimeFocusSource
                  : ''
              "
              :data-marker-title="formatStateCurveMarkerTitle(marker)"
              data-testid="workbench-timeline-state-curve-marker"
              role="button"
              tabindex="0"
              @click="selectStateCurveMarker(marker)"
              @keydown.enter.prevent="selectStateCurveMarker(marker)"
              @keydown.space.prevent="selectStateCurveMarker(marker)"
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
          :class="{
            'track-focused': isCandidateFrameValueInStateTrackFocus(value),
          }"
          :data-series-key="value.seriesKey"
          :data-state-track-key="getCandidateSeriesStateTrackKey(value)"
          :data-track-focused="
            isCandidateFrameValueInStateTrackFocus(value) ? 'true' : 'false'
          "
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
      <div
        v-if="selectedCandidateElementComparisonRows.length"
        class="candidate-element-comparison"
        data-testid="workbench-candidate-element-comparison"
      >
        <div class="candidate-element-comparison-head">
          <span>element</span>
          <span>HP参数</span>
          <span>函数</span>
          <span>槽位</span>
          <span>削韧</span>
          <span>能量</span>
          <span>状态</span>
        </div>
        <div
          v-for="row in selectedCandidateElementComparisonRows"
          :key="row.id"
          class="candidate-element-comparison-row"
          :data-element-config-id="row.elementConfigId"
          :data-path-id="row.pathId"
          :data-status="row.statusText"
          :title="row.tooltip"
          data-testid="workbench-candidate-element-comparison-row"
        >
          <b>{{ row.elementConfigId }}</b>
          <span>{{ row.hpText }}</span>
          <span>{{ row.functionText }}</span>
          <span>{{ row.slotText }}</span>
          <span>{{ row.toughnessText }}</span>
          <span>{{ row.energyText }}</span>
          <small>{{ row.statusText }}</small>
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
      <span><i class="legend-state" /> 状态点</span>
      <span><i class="legend-effect" /> 状态效果</span>
      <span><i class="legend-system" /> 系统轨</span>
      <span><i class="legend-overlap" /> 重叠</span>
      <span><i class="legend-cooldown" /> 冷却窗口</span>
      <span><i class="legend-blocked" /> 不可执行</span>
      <span><i class="legend-delay" /> 自动推迟</span>
      <span class="warning">时序为占位数据</span>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Connection,
  Crop,
  EditPen,
  Minus,
  Plus,
  VideoPause,
  VideoPlay,
} from '@element-plus/icons-vue';
import {
  DEFAULT_TIMELINE_ACTION_DURATION_MS,
  resolveTimelineActionLaneId,
} from './timelineDiagnostics';
import {
  WORKBENCH_FRAME_MS,
  frameToMs,
  formatFrameTime,
  msToFrame,
  snapMsToFrame,
} from '../../domain/timebase';
import {
  createStateCurveFrameGroupKey,
  createStateCurvePointId,
} from './stateCurvePointIdentity';
import { createWorkbenchMainFlowActionSurface } from './workbenchMainFlowActions';
import { createWorkbenchRuntimeReviewContextView } from './workbenchFlowModel';
import {
  WORKBENCH_TIMELINE_ENTRY_MIME,
  createWorkbenchTimelineBatchLaneMovePlan,
  createWorkbenchTimelineEntry,
  isWorkbenchTimelineEntryAllowedInLane,
  parseWorkbenchTimelineEntry,
  resolveWorkbenchTimelineLaneKind,
  serializeWorkbenchTimelineEntry,
} from '../../domain/workbenchTimelineEntry';

const MIN_ACTION_DURATION_MS = WORKBENCH_FRAME_MS;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
const TIMELINE_LANE_MIN_HEIGHT_PX = 64;
const TIMELINE_ACTION_TOP_PX = 5;
const TIMELINE_ACTION_HEIGHT_PX = 36;
const TIMELINE_ACTION_SLOT_GAP_PX = 4;
const TIMELINE_EFFECT_INTERVAL_HEIGHT_PX = 16;
const TIMELINE_EFFECT_INTERVAL_GAP_PX = 3;
const TIMELINE_EFFECT_SECTION_GAP_PX = 3;
const TIMELINE_LANE_GAP_PX = 4;
const TIMELINE_DATA_GAP_PX = 2;
const CANDIDATE_VALUE_CURVE_TOP = 52;
const CANDIDATE_VALUE_CURVE_HEIGHT = 26;
const STATE_CURVE_TIMELINE_LAYER_KEYS = new Set([
  'applied',
  'sampled',
  'placeholder',
]);
const STATE_CURVE_TIMELINE_LAYER_OPTIONS = [
  {
    key: 'applied',
    label: '已用',
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
const DEFAULT_STATE_CURVE_LAYER_FILTERS = {
  applied: true,
  candidate: true,
  sampled: false,
  placeholder: false,
};
const playbackRangeModeOptions = [
  { key: 'axis', label: '全轴' },
  { key: 'section', label: '区段' },
];
const STATE_CURVE_TRACK_MARKER_TOP = {
  enemyHpDamage: 92,
  enemyToughnessDamage: 99,
  selfEnergyChange: 106,
};
const STATE_TRACK_TO_CANDIDATE_SERIES_KEY = {
  enemyHpDamage: 'hpDamageFormulaParamCandidate',
  enemyToughnessDamage: 'toughnessDamageCandidate',
  selfEnergyChange: 'selfEnergyCandidate',
};
const CANDIDATE_SERIES_TO_STATE_TRACK_KEY = {
  hpDamageFormulaParamCandidate: 'enemyHpDamage',
  toughnessDamageCandidate: 'enemyToughnessDamage',
  selfEnergyCandidate: 'selfEnergyChange',
};
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
  enemy: {
    type: Object,
    default: null,
  },
  timelineTopology: {
    type: Object,
    default: null,
  },
  kibos: {
    type: Array,
    default: () => [],
  },
  actions: {
    type: Array,
    required: true,
  },
  timelineEntryCatalog: {
    type: Array,
    default: () => [],
  },
  timelineEntryDefaultActorId: {
    type: String,
    default: '',
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
  threeValueCurveFramework: {
    type: Object,
    default: () => ({
      stateCurves: {
        tracks: [],
      },
    }),
  },
  runtimeStateCurves: {
    type: Object,
    default: () => ({
      enemy: { points: [] },
      resources: { curvesByActor: [] },
    }),
  },
  runtimeStatePointContexts: {
    type: Array,
    default: () => [],
  },
  durationMs: {
    type: Number,
    required: true,
  },
  cursorFrameIndex: {
    type: Number,
    default: 0,
  },
  playbackRunning: {
    type: Boolean,
    default: false,
  },
  playbackRate: {
    type: Number,
    default: 1,
  },
  playbackRangeMode: {
    type: String,
    default: 'axis',
  },
  playbackRange: {
    type: Object,
    default: () => ({ startFrame: 0, endFrame: 0 }),
  },
  selectedActionId: {
    type: String,
    required: true,
  },
  selectedActionIds: {
    type: Array,
    default: () => [],
  },
  actionRelations: {
    type: Array,
    default: () => [],
  },
  cycleBoundaries: {
    type: Array,
    default: () => [],
  },
  selectedCycleBoundaryId: {
    type: String,
    default: '',
  },
  selectedCycleSection: {
    type: Object,
    default: null,
  },
  selectedActionRelationId: {
    type: String,
    default: '',
  },
  effectIntervals: {
    type: Array,
    default: () => [],
  },
  selectedEffectIntervalId: {
    type: String,
    default: '',
  },
  boxSelectionMode: {
    type: Boolean,
    default: false,
  },
  flowModel: {
    type: Object,
    default: null,
  },
  mainFlowCommandSurface: {
    type: Object,
    default: null,
  },
  actionEditFocus: {
    type: Object,
    default: null,
  },
  selectedStateCurvePointId: {
    type: String,
    default: '',
  },
  runtimeFocusSource: {
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
  timelineDiagnostics: {
    type: Object,
    default: () => ({
      overlapActionIds: [],
      overlaps: [],
      overlapCount: 0,
    }),
  },
  actionReadinessTimeline: {
    type: Object,
    default: () => ({ actions: [], cooldownWindows: [] }),
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
  'move-selected-actions',
  'shift-selected-actions',
  'delete-selected-actions',
  'open-action-context-menu',
  'select-action-group',
  'select-action-relation',
  'select-effect-interval',
  'open-action-relation-context-menu',
  'select-cycle-boundary',
  'update-cycle-boundary',
  'open-cycle-boundary-context-menu',
  'toggle-box-selection-mode',
  'create-action-relations',
  'select-state-curve-point',
  'select-timeline-frame',
  'toggle-timeline-playback',
  'step-timeline-frame',
  'update-playback-rate',
  'update-playback-range-mode',
  'dispatch-flow-action',
  'update-state-curve-layer-filter',
  'update-state-curve-track-filter',
  'update-state-curve-focus-mode',
  'insert-timeline-entry',
]);
const laneRef = ref(null);
const scaleViewportRef = ref(null);
const timelineViewportRef = ref(null);
const laneRowRefs = new Map();
const dragState = ref(null);
const externalDropTargetLaneId = ref('');
const timelineShelfEntryDrag = ref(null);
const resizeState = ref(null);
const boxSelectionState = ref(null);
const cycleBoundaryDragState = ref(null);
const timelineCursorDragState = ref(null);
const suppressClickActionId = ref('');
const timelineZoom = ref(1);
const candidateSeriesVisibility = ref({});
const selectedCandidateFrameGroupId = ref(null);
const candidateDisplayScope = ref('all');
const candidateActorFilter = ref('all');
const candidateActionFilter = ref('all');
const mainFlowActionSurface = computed(() =>
  createWorkbenchMainFlowActionSurface({
    mainFlowCommandSurface: props.mainFlowCommandSurface,
  })
);

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
const timelineCursor = computed(() => {
  const maxFrameIndex = Math.max(0, msToFrame(props.durationMs));
  const frameIndex = clampNumber(
    Math.round(Number(props.cursorFrameIndex) || 0),
    0,
    maxFrameIndex
  );
  const timeMs = frameToMs(frameIndex);
  return {
    frameIndex,
    maxFrameIndex,
    timeMs,
    xPercent: clampPercent((timeMs / props.durationMs) * 100),
  };
});
const timelineCursorStyle = computed(() => ({
  left: `${timelineCursor.value.xPercent}%`,
}));

const dragInitialLaneId = computed(
  () => dragState.value?.initialLaneId ?? null
);
const dragTargetLaneId = computed(() => dragState.value?.targetLaneId ?? null);
const resizingActionId = computed(() => resizeState.value?.actionId ?? null);
const selectedActionIdSet = computed(
  () => new Set(props.selectedActionIds ?? [])
);
const actionRelationLayoutByActionId = computed(() => {
  const layoutByActionId = new Map();
  let laneTop = 0;
  for (const lane of timelineLanes.value) {
    for (const action of lane.actions) {
      const previewOffsetMs = isDraggingAction(action.id)
        ? (dragState.value?.currentOffsetMs ?? 0)
        : 0;
      const startPercent = clampPercent(
        ((action.startMs + previewOffsetMs) / props.durationMs) * 100
      );
      const widthPercent = clampPercent(
        ((action.durationMs ?? DEFAULT_TIMELINE_ACTION_DURATION_MS) /
          props.durationMs) *
          100,
        8,
        100
      );
      layoutByActionId.set(action.id, {
        startX: startPercent,
        endX: clampPercent(startPercent + widthPercent),
        y:
          laneTop +
          getTimelineActionTop(action.timelineSlot) +
          TIMELINE_ACTION_HEIGHT_PX / 2,
      });
    }
    laneTop += getTimelineLaneHeight(lane) + TIMELINE_LANE_GAP_PX;
  }
  return layoutByActionId;
});
const actionRelationLayerHeight = computed(() =>
  Math.max(
    1,
    timelineLanes.value.reduce(
      (height, lane, index) =>
        height +
        getTimelineLaneHeight(lane) +
        (index > 0 ? TIMELINE_LANE_GAP_PX : 0),
      0
    )
  )
);
const actionRelationViewBox = computed(
  () => `0 0 100 ${actionRelationLayerHeight.value}`
);
const actionRelationGeometry = computed(() =>
  props.actionRelations.flatMap(relation => {
    const source = actionRelationLayoutByActionId.value.get(
      relation.fromActionId
    );
    const target = actionRelationLayoutByActionId.value.get(
      relation.toActionId
    );
    if (!source || !target) {
      return [];
    }
    const sourceX = source.endX;
    const sourceY = source.y;
    const targetX = target.startX;
    const targetY = target.y;
    const horizontalDistance = Math.abs(targetX - sourceX);
    const controlDistance = Math.max(4, horizontalDistance * 0.45);
    const direction = targetX >= sourceX ? 1 : -1;
    const path = [
      `M ${sourceX} ${sourceY}`,
      `C ${sourceX + controlDistance * direction} ${sourceY}`,
      `${targetX - controlDistance * direction} ${targetY}`,
      `${targetX} ${targetY}`,
    ].join(' ');
    return [
      {
        ...relation,
        path,
        targetX,
        targetY,
        title: `后续关系 · ${formatSignedFrameGap(relation.gapMs)}`,
      },
    ];
  })
);
const boxSelectionStyle = computed(() => {
  const state = boxSelectionState.value;
  return state
    ? {
        left: `${state.left}px`,
        top: `${state.top}px`,
        width: `${state.width}px`,
        height: `${state.height}px`,
      }
    : {};
});
const cycleSectionHighlightStyle = computed(() => {
  const section = props.selectedCycleSection;
  if (!section || props.durationMs <= 0) {
    return {};
  }
  const left = clampPercent((section.startMs / props.durationMs) * 100);
  const right = clampPercent((section.endMs / props.durationMs) * 100);
  return {
    left: `${left}%`,
    width: `${Math.max(0, right - left)}%`,
  };
});
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
const runtimeStatePointContextByDeltaId = computed(
  () =>
    new Map(
      props.runtimeStatePointContexts
        .filter(context => context?.row?.sourceDeltaId)
        .map(context => [context.row.sourceDeltaId, context])
    )
);
const readinessByActionId = computed(
  () =>
    new Map(
      (props.actionReadinessTimeline?.actions ?? []).map(action => [
        action.actionId,
        action,
      ])
    )
);
const actorLaneIds = computed(
  () => new Set(props.actors.map(actor => actor.id))
);
const kiboLaneIdByActorId = computed(
  () =>
    new Map(
      (props.timelineTopology?.actorGroups ?? []).map(group => [
        group.actorId,
        group.kiboLane?.laneId,
      ])
    )
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
const flowSelection = computed(
  () => props.flowModel?.mainFlowSelection ?? null
);
const runtimeReviewContextView = computed(
  () =>
    props.flowModel?.runtimeReviewContextView ??
    createWorkbenchRuntimeReviewContextView({
      flowModel: props.flowModel,
      selectedStateCurvePointId: props.selectedStateCurvePointId,
    })
);
const flowSelectedActionId = computed(
  () => flowSelection.value?.selectedActionId ?? props.selectedActionId
);
const flowSelectedStateCurvePointId = computed(
  () => runtimeReviewContextView.value.selectedStatePointId
);
const flowRuntimeFocusSource = computed(
  () => runtimeReviewContextView.value.source || props.runtimeFocusSource
);
const stateCurveTimelineLayerOptions = computed(() =>
  STATE_CURVE_TIMELINE_LAYER_OPTIONS.map(layer => {
    const matchingLayers = (
      props.threeValueCurveFramework?.stateCurves?.tracks ?? []
    ).flatMap(track =>
      (track.layers ?? []).filter(item => item.key === layer.key)
    );
    const pointCount = matchingLayers.reduce(
      (sum, item) => sum + (item.pointCount ?? 0),
      0
    );
    return {
      ...layer,
      pointCount,
    };
  }).filter(layer => layer.pointCount > 0)
);
const stateCurveTimelineTrackOptions = computed(() =>
  (props.threeValueCurveFramework?.stateCurves?.tracks ?? [])
    .map(track => ({
      trackKey: track.trackKey,
      label: track.label,
      pointCount: getStateCurveTimelineTrackPointCount(track),
    }))
    .filter(track => track.pointCount > 0)
);
const effectiveStateCurveLayerFilters = computed(() => ({
  ...DEFAULT_STATE_CURVE_LAYER_FILTERS,
  ...(props.stateCurveLayerFilters ?? {}),
}));
const effectiveStateCurveTrackFilters = computed(
  () => props.stateCurveTrackFilters ?? {}
);
const isStateCurveSelectedFocusActive = computed(
  () =>
    props.stateCurveFocusMode === 'selected' &&
    flowSelectedStateCurvePointId.value
);
const overlapActionIds = computed(
  () => new Set(props.timelineDiagnostics?.overlapActionIds ?? [])
);
const selectedBatchId = computed(() => {
  const selectedAction = actionsById.value.get(flowSelectedActionId.value);
  return selectedAction?.generationBatch?.batchId ?? null;
});
const timelineLanes = computed(() => {
  const actorGroups = createTimelineActorGroups();
  const actorLanes = actorGroups.map(group => group.actionLane);
  const lanesById = new Map(actorLanes.map(lane => [lane.id, lane]));
  const enemyEffectIntervals = props.effectIntervals.filter(
    interval => interval.targetKind === 'enemy'
  );
  const enemyGroup = createTimelineEnemyGroup(enemyEffectIntervals);
  const enemyLane = enemyGroup.eventLane;
  const systemLane = createEmptyTimelineLane({
    id: 'system',
    kind: 'system-event',
    type: 'system',
    name: '系统',
    detail: '系统事件',
    editable: false,
  });
  const allLanes = [
    ...actorGroups.flatMap(group => [
      group.actionLane,
      group.kiboLane,
      group.energyCurveLane,
    ]),
    enemyGroup.eventLane,
    enemyGroup.hpCurveLane,
    enemyGroup.toughnessCurveLane,
    systemLane,
  ];
  const allLanesById = new Map(allLanes.map(lane => [lane.id, lane]));

  props.actions.forEach(action => {
    const lane =
      action.type === 'enemyEvent'
        ? enemyLane
        : (allLanesById.get(resolveActionLaneId(action)) ?? systemLane);
    lane.actions.push(action);
  });

  props.effectIntervals
    .filter(interval => interval.targetKind !== 'enemy')
    .forEach(interval => {
      const lane =
        interval.targetKind === 'actor'
          ? lanesById.get(interval.targetId)
          : null;
      (lane ?? systemLane).effectIntervals.push(interval);
    });

  allLanes.forEach(lane => {
    const layout = createTimelineActionLayout(lane.actions);
    lane.actions = layout.actions;
    lane.actionSlotCount = layout.slotCount;
    const effectLayout = createTimelineEffectLayout(lane.effectIntervals);
    lane.effectIntervals = effectLayout.intervals;
    lane.effectSlotCount = effectLayout.slotCount;
  });

  (props.actionReadinessTimeline?.cooldownWindows ?? []).forEach(window => {
    const lane = lanesById.get(window.actorId);
    const action = lane?.actions.find(item => item.id === window.actionId);
    if (!lane || !action) {
      return;
    }
    lane.cooldownWindows.push({
      ...window,
      timelineSlot: action.timelineSlot ?? 0,
    });
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

  createStateCurveTimelineMarkers().forEach(marker => {
    const lane =
      allLanesById.get(resolveStateCurveLaneId(marker, actorGroups)) ??
      systemLane;
    lane.stateCurveMarkers.push(marker);
  });

  allLanes.forEach(lane => {
    lane.candidateValueCurves = createCandidateValueTimelineCurves(
      lane.candidateValueMarkers
    );
    lane.candidateValueFrameGroups = createCandidateValueFrameGroups(
      lane.candidateValueMarkers
    );
  });

  const visibleLanes = allLanes.filter(lane => lane !== systemLane);
  return systemLane.actions.length > 0 ||
    systemLane.damageMarkers.length > 0 ||
    systemLane.candidateValueMarkers.length > 0 ||
    systemLane.stateCurveMarkers.length > 0 ||
    systemLane.effectIntervals.length > 0
    ? [...visibleLanes, systemLane]
    : visibleLanes;
});

function createTimelineActorGroups() {
  const topologyGroups = props.timelineTopology?.actorGroups ?? [];
  return props.actors.map((actor, index) => {
    const topology = topologyGroups.find(group => group.actorId === actor.id) ??
      topologyGroups[index] ?? {
        actionLane: { laneId: actor.id },
        kiboLane: { laneId: `kibo-fallback-${index + 1}`, kiboId: null },
        energyCurve: { laneId: `energy-${actor.id}`, actorId: actor.id },
      };
    const kibo = props.kibos.find(
      item => Number(item.id) === Number(topology.kiboLane?.kiboId)
    );
    return {
      actionLane: createEmptyTimelineLane({
        id: topology.actionLane?.laneId ?? actor.id,
        kind: 'actor-action',
        type: 'actor',
        actorId: actor.id,
        name: actor.name,
        detail: '角色动作',
        editable: true,
      }),
      kiboLane: createEmptyTimelineLane({
        id: topology.kiboLane?.laneId ?? `kibo-fallback-${index + 1}`,
        kind: 'actor-kibo',
        type: 'kibo',
        actorId: actor.id,
        name: '奇波',
        detail: kibo?.name ?? '未配置',
        editable: true,
      }),
      energyCurveLane: createEmptyTimelineLane({
        id: topology.energyCurve?.laneId ?? `energy-${actor.id}`,
        kind: 'actor-energy-curve',
        type: 'curve',
        actorId: actor.id,
        name: '能量',
        detail: actor.name,
        editable: false,
        curve: createTimelineStateCurve({
          trackKey: 'selfEnergyChange',
          actorId: actor.id,
          fallbackInitialValue: actor.initialSp ?? actor.stats?.initialSp ?? 0,
          fallbackMaxValue: actor.stats?.maxSp,
        }),
      }),
    };
  });
}

function createTimelineEnemyGroup(effectIntervals) {
  const topology = props.timelineTopology?.enemyGroup ?? {};
  const maxHp = numberOrZero(props.enemy?.stats?.maxHp);
  const maxToughness = numberOrZero(
    props.enemy?.toughness?.maxValue ?? props.enemy?.stats?.maxToughness
  );
  const initialToughness = numberOrZero(
    props.enemy?.toughness?.initialValue ??
      props.enemy?.stats?.initialToughness ??
      maxToughness
  );
  return {
    eventLane: createEmptyTimelineLane({
      id: topology.eventLane?.laneId ?? 'enemy-events',
      kind: 'enemy-event',
      type: 'enemy',
      name: props.enemy?.name || '敌人',
      detail: '事件 / 状态',
      editable: true,
      effectIntervals,
    }),
    hpCurveLane: createEmptyTimelineLane({
      id: topology.hpCurve?.laneId ?? 'enemy-hp-curve',
      kind: 'enemy-hp-curve',
      type: 'curve',
      name: 'HP',
      detail: props.enemy?.name || '敌人',
      editable: false,
      curve: createTimelineStateCurve({
        trackKey: 'enemyHpDamage',
        fallbackInitialValue: maxHp,
        fallbackMaxValue: maxHp || null,
      }),
    }),
    toughnessCurveLane: createEmptyTimelineLane({
      id: topology.toughnessCurve?.laneId ?? 'enemy-toughness-curve',
      kind: 'enemy-toughness-curve',
      type: 'curve',
      name: '韧性',
      detail: props.enemy?.name || '敌人',
      editable: false,
      curve: createTimelineStateCurve({
        trackKey: 'enemyToughnessDamage',
        fallbackInitialValue: initialToughness,
        fallbackMaxValue: maxToughness || null,
      }),
    }),
  };
}

function createEmptyTimelineLane({
  id,
  kind,
  type,
  actorId = '',
  name,
  detail,
  editable,
  curve = null,
  effectIntervals = [],
}) {
  return {
    id,
    kind,
    type,
    actorId,
    name,
    detail,
    editable,
    curve,
    actions: [],
    damageMarkers: [],
    candidateValueMarkers: [],
    candidateValueCurves: [],
    candidateValueFrameGroups: [],
    stateCurveMarkers: [],
    cooldownWindows: [],
    effectIntervals: [...effectIntervals],
  };
}

function formatTopologyCurveCursorValue(curve) {
  const current = formatCompactNumber(curve.cursorValue);
  const max = strictNumberOrNull(curve.maxValue);
  return max == null ? current : `${current} / ${formatCompactNumber(max)}`;
}

function createTimelineStateCurve({
  trackKey,
  actorId = '',
  fallbackInitialValue = 0,
  fallbackMaxValue = null,
}) {
  const runtimeCurve = resolveRuntimeStateCurve(trackKey, actorId);
  const stateMetric = runtimeCurve?.stateMetric ?? null;
  const initialValue = numberOrZero(
    stateMetric?.initialValue ?? fallbackInitialValue
  );
  const maxValue = strictNumberOrNull(
    stateMetric?.maxValue ?? fallbackMaxValue
  );
  const direction = trackKey === 'selfEnergyChange' ? 'increase' : 'decrease';
  let currentValue = initialValue;
  const values = [initialValue];
  const breakpoints = [...(runtimeCurve?.points ?? [])]
    .filter(point => point.trackKey === trackKey)
    .sort(compareRuntimeCurvePoints)
    .map((point, index) => {
      const metricKey = getRuntimeCurveMetricKey(trackKey);
      const snapshotValue = strictNumberOrNull(
        point.stateSnapshot?.after?.[metricKey]?.currentValue
      );
      const delta = numberOrZero(getRuntimeCurvePointDelta(point, trackKey));
      currentValue =
        snapshotValue ??
        (direction === 'decrease'
          ? Math.max(0, currentValue - delta)
          : currentValue + delta);
      values.push(currentValue);
      return {
        id: point.sourceDeltaId ?? `${trackKey}-${actorId}-${index}`,
        sourceDeltaId: point.sourceDeltaId ?? '',
        statePointId:
          runtimeStatePointContextByDeltaId.value.get(point.sourceDeltaId)
            ?.statePointId ?? '',
        actionId: point.actionId ?? '',
        timeMs: numberOrZero(point.timeMs),
        frameIndex: numberOrZero(point.frameIndex),
        currentValue,
      };
    });
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(1, maxValue ?? 0, ...values);
  const range = maximum - minimum || 1;
  let cursorValue = initialValue;
  for (const point of breakpoints) {
    if (point.frameIndex > timelineCursor.value.frameIndex) {
      break;
    }
    cursorValue = point.currentValue;
  }
  let previousY = curveValueToY(initialValue, minimum, range);
  const stepCoordinates = [`0,${previousY}`];

  breakpoints.forEach(point => {
    point.xPercent = clampPercent((point.timeMs / props.durationMs) * 100);
    point.yPercent = curveValueToY(point.currentValue, minimum, range);
    stepCoordinates.push(
      `${point.xPercent},${previousY}`,
      `${point.xPercent},${point.yPercent}`
    );
    previousY = point.yPercent;
  });
  stepCoordinates.push(`100,${previousY}`);

  return {
    trackKey,
    actorId,
    initialValue,
    currentValue,
    cursorValue,
    cursorYPercent: curveValueToY(cursorValue, minimum, range),
    maxValue,
    pointCount: breakpoints.length,
    breakpoints,
    stepPoints: stepCoordinates.join(' '),
  };
}

function resolveRuntimeStateCurve(trackKey, actorId) {
  if (trackKey === 'selfEnergyChange') {
    return (
      props.runtimeStateCurves?.resources?.curvesByActor?.find(
        curve => curve.actorId === actorId
      ) ?? null
    );
  }
  const metricKey = trackKey === 'enemyHpDamage' ? 'hp' : 'toughness';
  return {
    stateMetric: props.runtimeStateCurves?.enemy?.stateMetrics?.[metricKey],
    points: props.runtimeStateCurves?.enemy?.points ?? [],
  };
}

function getRuntimeCurveMetricKey(trackKey) {
  if (trackKey === 'enemyHpDamage') return 'enemyHp';
  if (trackKey === 'enemyToughnessDamage') return 'enemyToughness';
  return 'selfEnergy';
}

function getRuntimeCurvePointDelta(point, trackKey) {
  if (trackKey === 'enemyHpDamage') return point.hpDelta;
  if (trackKey === 'enemyToughnessDamage') return point.toughnessDelta;
  return point.energyDelta;
}

function compareRuntimeCurvePoints(left, right) {
  return (
    numberOrZero(left.timeMs) - numberOrZero(right.timeMs) ||
    numberOrZero(left.runtimeSequenceIndex) -
      numberOrZero(right.runtimeSequenceIndex)
  );
}

function curveValueToY(value, minimum, range) {
  return Number((100 - ((value - minimum) / range) * 100).toFixed(4));
}

function formatCompactNumber(value) {
  return Number(numberOrZero(value).toFixed(2)).toLocaleString('zh-CN');
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function strictNumberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
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
const selectedCandidateElementComparisonRows = computed(() =>
  selectedCandidateFrameGroup.value
    ? createCandidateElementComparisonRows(selectedCandidateFrameGroup.value)
    : []
);
const selectedStateCurvePoint = computed(() =>
  findStateCurvePointById(flowSelectedStateCurvePointId.value)
);
const selectedCandidateFocusSeriesKey = computed(() =>
  selectedStateCurvePoint.value?.layerKey === 'candidate'
    ? (STATE_TRACK_TO_CANDIDATE_SERIES_KEY[
        selectedStateCurvePoint.value.trackKey
      ] ?? '')
    : ''
);

watch(
  [
    () => props.stateCurveFocusMode,
    () => flowSelectedStateCurvePointId.value,
    () => props.threeValueCurveFramework,
    () => props.stateCurveLayerFilters,
    () => props.stateCurveTrackFilters,
    () => candidateSeriesVisibility.value,
    () => candidateActorFilter.value,
    () => candidateActionFilter.value,
  ],
  syncCandidateDisplayScopeFromStateFocus,
  { deep: true }
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

function isActionEditFocused(action) {
  return Boolean(getActionEditFocusField(action));
}

function isTimelineActionResultEditVisible(action) {
  return getTimelineActionResultEditCommand(action).actionId === action.id;
}

function getTimelineActionResultEditCommand(action) {
  const command = props.mainFlowCommandSurface?.runtimeActionEdit ?? {};
  if (!action?.id || command.actionId !== action.id) {
    return {};
  }
  return command;
}

function focusTimelineActionResult(action) {
  const command = getTimelineActionResultEditCommand(action);
  if (!command.enabled || !command.action?.canRun) {
    return;
  }
  emit('dispatch-flow-action', command.action);
}

function getActionEditFocusField(action) {
  const focus = props.actionEditFocus;
  if (!action?.id || !focus?.actionId || action.id !== focus.actionId) {
    return '';
  }
  return normalizeActionEditFocusField(focus.fieldKey);
}

function getActionEditFocusLabel(action) {
  return isActionEditFocused(action)
    ? (props.actionEditFocus?.label ?? '')
    : '';
}

function getActionEditFocusSummary(action) {
  return isActionEditFocused(action)
    ? (props.actionEditFocus?.changeSummary ?? '')
    : '';
}

function getActionEditFocusSource(action) {
  return isActionEditFocused(action)
    ? (props.actionEditFocus?.focusSource ?? '')
    : '';
}

function normalizeActionEditFocusField(fieldKey) {
  if (fieldKey === 'damageSegmentIndex') {
    return 'actionVariantIndex';
  }
  if (fieldKey === 'laneId') {
    return 'actorCharacterId';
  }
  return fieldKey || '';
}

function actionStyle(action) {
  const previewOffsetMs = isDraggingAction(action.id)
    ? (dragState.value?.currentOffsetMs ?? 0)
    : 0;
  const left = clampPercent(
    ((action.startMs + previewOffsetMs) / props.durationMs) * 100
  );
  const width = clampPercent(
    ((action.durationMs ?? DEFAULT_TIMELINE_ACTION_DURATION_MS) /
      props.durationMs) *
      100,
    8,
    100
  );
  return {
    left: `${left}%`,
    top: `${getTimelineActionTop(action.timelineSlot)}px`,
    width: `${width}%`,
  };
}

function cooldownWindowStyle(window) {
  const startMs = Math.max(0, Number(window.startMs) || 0);
  const endMs = Math.min(
    props.durationMs,
    Math.max(startMs, Number(window.endMs) || startMs)
  );
  return {
    left: `${clampPercent((startMs / props.durationMs) * 100)}%`,
    top: `${getTimelineActionTop(window.timelineSlot) + TIMELINE_ACTION_HEIGHT_PX - 4}px`,
    width: `${clampPercent(((endMs - startMs) / props.durationMs) * 100, 0.5, 100)}%`,
  };
}

function effectIntervalStyle(interval, lane) {
  const startMs = Math.max(0, Number(interval.startMs) || 0);
  const endMs = Math.min(
    props.durationMs,
    Math.max(startMs, Number(interval.endMs) || startMs)
  );
  const top =
    getTimelineEffectTop(lane) +
    Math.max(0, Number(interval.timelineSlot) || 0) *
      (TIMELINE_EFFECT_INTERVAL_HEIGHT_PX + TIMELINE_EFFECT_INTERVAL_GAP_PX);
  return {
    left: String(clampPercent((startMs / props.durationMs) * 100)) + '%',
    top: String(top) + 'px',
    width:
      String(
        clampPercent(((endMs - startMs) / props.durationMs) * 100, 1.5, 100)
      ) + '%',
  };
}

function effectLifecycleMarkerStyle(event, interval) {
  const durationMs = Math.max(
    WORKBENCH_FRAME_MS,
    Number(interval.endMs) - Number(interval.startMs)
  );
  const offsetMs = Math.max(
    0,
    Math.min(durationMs, Number(event.timeMs) - Number(interval.startMs))
  );
  return {
    left: String(clampPercent((offsetMs / durationMs) * 100)) + '%',
  };
}

function effectIntervalGlyph(interval) {
  return String(interval.effectName || interval.effectId || '+')
    .trim()
    .slice(0, 1)
    .toUpperCase();
}

function formatEffectIntervalTitle(interval) {
  const lifecycleText = interval.lifecycleEvents
    .map(event => formatEffectLifecycleOperation(event.type))
    .join(' -> ');
  const stackText =
    interval.maxStacks > 1
      ? ' · 峰值 ' +
        String(interval.peakStacks) +
        '/' +
        String(interval.maxStacks) +
        ' 层'
      : '';
  const activeText = interval.activeAtScenarioEnd ? ' · 场景结束时仍生效' : '';
  return (
    [
      interval.effectName || interval.effectId,
      interval.targetName || interval.targetId,
      String(interval.startFrame) + 'F-' + String(interval.endFrame) + 'F',
    ].join(' · ') +
    stackText +
    activeText +
    ' · ' +
    lifecycleText
  );
}

function formatEffectLifecycleOperation(type) {
  if (type === 'EFFECT_INHERITED') {
    return '继承';
  }
  if (type === 'EFFECT_APPLIED') {
    return '施加';
  }
  if (type === 'EFFECT_REFRESHED') {
    return '刷新';
  }
  if (type === 'EFFECT_REMOVED') {
    return '移除';
  }
  if (type === 'EFFECT_EXPIRED') {
    return '到期';
  }
  return type;
}

function selectEffectInterval(interval) {
  emit('select-effect-interval', {
    intervalId: interval.intervalId,
    eventId: interval.selectionEventId,
    actionId: interval.sourceActionId ?? '',
    timeMs: interval.endMs,
  });
}

function markerStyle(damage, lane) {
  const left = clampPercent((damage.timeMs / props.durationMs) * 100);
  return {
    left: `${left}%`,
    top: `${getTimelineDataTop(lane)}px`,
  };
}

function timelineDataLayerStyle(lane) {
  return {
    top: `${getTimelineCandidateCurveTop(lane)}px`,
  };
}

function laneRowStyle(lane) {
  const height = getTimelineLaneHeight(lane);
  return {
    height: `${height}px`,
    minHeight: `${height}px`,
  };
}

function candidateValueMarkerStyle(marker, lane) {
  const left = clampPercent((marker.timeMs / props.durationMs) * 100);
  const top =
    getTimelineCandidateCurveTop(lane) +
    (clampPercent(marker.yPercent) / 100) * CANDIDATE_VALUE_CURVE_HEIGHT;
  return {
    left: `${left}%`,
    top: `${top}px`,
  };
}

function stateCurveMarkerStyle(marker, lane) {
  const left = clampPercent((marker.timeMs / props.durationMs) * 100);
  return {
    left: `${left}%`,
    top: `${getTimelineStateCurveMarkerTop(marker, lane)}px`,
  };
}

function candidateValueFrameHotspotStyle(group, lane) {
  const left = clampPercent((group.timeMs / props.durationMs) * 100);
  return {
    left: `${left}%`,
    top: `${getTimelineCandidateCurveTop(lane)}px`,
  };
}

function getTimelineActionTop(slot) {
  return (
    TIMELINE_ACTION_TOP_PX +
    Math.max(0, Number(slot) || 0) *
      (TIMELINE_ACTION_HEIGHT_PX + TIMELINE_ACTION_SLOT_GAP_PX)
  );
}

function getTimelineActionAreaBottom(lane) {
  const slotCount = getTimelineActionSlotCount(lane);
  return (
    TIMELINE_ACTION_TOP_PX +
    slotCount * TIMELINE_ACTION_HEIGHT_PX +
    Math.max(0, slotCount - 1) * TIMELINE_ACTION_SLOT_GAP_PX
  );
}

function getTimelineEffectTop(lane) {
  return getTimelineActionAreaBottom(lane) + TIMELINE_EFFECT_SECTION_GAP_PX;
}

function getTimelineDataTop(lane) {
  const effectSlotCount = getTimelineEffectSlotCount(lane);
  if (effectSlotCount === 0) {
    return getTimelineActionAreaBottom(lane) + TIMELINE_DATA_GAP_PX;
  }
  return (
    getTimelineEffectTop(lane) +
    effectSlotCount * TIMELINE_EFFECT_INTERVAL_HEIGHT_PX +
    Math.max(0, effectSlotCount - 1) * TIMELINE_EFFECT_INTERVAL_GAP_PX +
    TIMELINE_DATA_GAP_PX
  );
}

function getTimelineCandidateCurveTop(lane) {
  return getTimelineDataTop(lane) + (CANDIDATE_VALUE_CURVE_TOP - 54);
}

function getTimelineStateCurveMarkerTop(marker, lane) {
  if (lane.type === 'curve') return 22;
  return getTimelineDataTop(lane) + (marker.top - 54);
}

function getTimelineLaneHeight(lane) {
  if (lane.type === 'curve') return 40;
  if (lane.type === 'kibo' && lane.actions.length === 0) return 36;
  const hasCandidateData =
    lane.candidateValueMarkers.length > 0 ||
    lane.candidateValueCurves.length > 0 ||
    lane.candidateValueFrameGroups.length > 0;
  return Math.max(
    TIMELINE_LANE_MIN_HEIGHT_PX,
    getTimelineDataTop(lane) + (hasCandidateData ? 48 : 18)
  );
}

function getTimelineActionSlotCount(lane) {
  return Math.max(1, Number(lane?.actionSlotCount) || 1);
}

function getTimelineEffectSlotCount(lane) {
  return Math.max(0, Number(lane?.effectSlotCount) || 0);
}

function createTimelineActionLayout(actions) {
  const slotEndTimes = [];
  const slotByActionId = new Map();
  const sortedActions = [...actions].sort(compareTimelineActionStart);

  sortedActions.forEach(action => {
    const startMs = Number(action.startMs) || 0;
    const endMs = startMs + getTimelineActionLayoutDurationMs(action);
    const slotIndex = findAvailableTimelineActionSlot(slotEndTimes, startMs);
    slotEndTimes[slotIndex] = endMs;
    slotByActionId.set(action.id, slotIndex);
  });

  return {
    actions: actions.map(action => ({
      ...action,
      timelineSlot: slotByActionId.get(action.id) ?? 0,
    })),
    slotCount: Math.max(1, slotEndTimes.length),
  };
}

function createTimelineEffectLayout(intervals) {
  const slotEndTimes = [];
  const slotByIntervalId = new Map();
  const sortedIntervals = [...intervals].sort(
    (left, right) =>
      (Number(left.startMs) || 0) - (Number(right.startMs) || 0) ||
      (Number(left.endMs) || 0) - (Number(right.endMs) || 0) ||
      String(left.intervalId).localeCompare(String(right.intervalId))
  );

  sortedIntervals.forEach(interval => {
    const startMs = Number(interval.startMs) || 0;
    const endMs =
      startMs +
      Math.max(
        Number(interval.durationMs) || 0,
        props.durationMs * 0.015,
        WORKBENCH_FRAME_MS
      );
    const slotIndex = findAvailableTimelineActionSlot(slotEndTimes, startMs);
    slotEndTimes[slotIndex] = endMs;
    slotByIntervalId.set(interval.intervalId, slotIndex);
  });

  return {
    intervals: intervals.map(interval => ({
      ...interval,
      timelineSlot: slotByIntervalId.get(interval.intervalId) ?? 0,
    })),
    slotCount: slotEndTimes.length,
  };
}

function getTimelineActionLayoutDurationMs(action) {
  const displayMinDurationMs = props.durationMs * 0.08;
  return Math.max(
    MIN_ACTION_DURATION_MS,
    displayMinDurationMs,
    Number(action.durationMs) || DEFAULT_TIMELINE_ACTION_DURATION_MS
  );
}

function compareTimelineActionStart(left, right) {
  return (
    (Number(left.startMs) || 0) - (Number(right.startMs) || 0) ||
    (Number(left.durationMs) || 0) - (Number(right.durationMs) || 0) ||
    String(left.id).localeCompare(String(right.id))
  );
}

function findAvailableTimelineActionSlot(slotEndTimes, startMs) {
  const index = slotEndTimes.findIndex(endMs => startMs >= endMs);
  return index >= 0 ? index : slotEndTimes.length;
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
  if (action.type === 'kiboEvent') {
    return `${action.eventType ?? 'activation'} / ${action.kiboId ?? '未配置'}`;
  }
  if (action.type === 'switch') {
    return formatFrameTime(action.durationMs ?? 0);
  }
  return action.note ?? '';
}

function getActionReadiness(action) {
  return (
    readinessByActionId.value.get(action?.id) ?? {
      status: 'ready',
      executable: true,
    }
  );
}

function formatTimelineActionTitle(action) {
  const readiness = getActionReadiness(action);
  const status =
    readiness.status === 'blocked'
      ? '不可执行'
      : readiness.status === 'ready-with-unresolved-conditions'
        ? '条件待确认'
        : '可执行';
  return `${action.name ?? action.id} · ${status}`;
}

function formatCooldownWindowTitle(window) {
  return `${window.actionName} · CD ${formatFrameTime(window.startMs)}-${formatFrameTime(window.endMs)} · 槽位 ${window.chargeIndex + 1}/${window.cooldownCount}`;
}

function resolveActionLaneId(action) {
  return resolveTimelineActionLaneId(
    action,
    actorLaneIds.value,
    kiboLaneIdByActorId.value
  );
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

function resolveStateCurveLaneId(marker, actorGroups = []) {
  if (marker.trackKey === 'enemyHpDamage') return 'enemy-hp-curve';
  if (marker.trackKey === 'enemyToughnessDamage') {
    return 'enemy-toughness-curve';
  }
  const action = actionsById.value.get(marker.actionId);
  const actorId = marker.actorId ?? (action ? resolveActionLaneId(action) : '');
  if (marker.trackKey === 'selfEnergyChange' && actorId) {
    return actorGroups.find(group => group.actionLane.id === actorId)
      ?.energyCurveLane.id;
  }
  return 'system';
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
            summonTargetEvidenceSummary:
              point.summonTargetEvidenceSummary ?? null,
            triggerTimingStatus: point.triggerTimingStatus ?? null,
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

function createStateCurveTimelineMarkers() {
  return (props.threeValueCurveFramework?.stateCurves?.tracks ?? []).flatMap(
    track =>
      isStateCurveTrackVisible(track.trackKey)
        ? (track.layers ?? [])
            .filter(
              layer =>
                STATE_CURVE_TIMELINE_LAYER_KEYS.has(layer.key) &&
                isStateCurveTimelineLayerVisible(layer.key) &&
                (layer.pointCount ?? 0) > 0
            )
            .flatMap((layer, layerIndex) =>
              (layer.points ?? []).map((point, pointIndex) =>
                createStateCurveTimelineMarker({
                  track,
                  layer,
                  point,
                  layerIndex,
                  pointIndex,
                })
              )
            )
            .filter(marker => isStateCurveMarkerInFocus(marker))
        : []
  );
}

function createStateCurveTimelineMarker({
  track,
  layer,
  point,
  layerIndex,
  pointIndex,
}) {
  const frameIndex = Number(point.frameIndex);
  const timeMs = Number.isFinite(Number(point.timeMs))
    ? Number(point.timeMs)
    : Number.isFinite(frameIndex)
      ? frameIndex * WORKBENCH_FRAME_MS
      : 0;
  const frameLabel =
    point.frameLabel ??
    (Number.isFinite(frameIndex)
      ? formatFrameTime(frameIndex * WORKBENCH_FRAME_MS)
      : formatFrameTime(timeMs));

  return {
    id: createStateCurvePointId({
      trackKey: track.trackKey,
      layerKey: layer.key,
      point,
      pointIndex,
    }),
    statePointId: createStateCurvePointId({
      trackKey: track.trackKey,
      layerKey: layer.key,
      point,
      pointIndex,
    }),
    trackKey: track.trackKey,
    trackLabel: track.label,
    layerKey: layer.key,
    layerLabel: formatStateCurveLayerLabel(layer.key),
    valueUnit: layer.valueUnit ?? track.valueUnit,
    actionId: point.actionId ?? '',
    actionName: point.actionName ?? '',
    actorId: point.actorId ?? '',
    frameIndex,
    frameLabel,
    timeMs,
    top: STATE_CURVE_TRACK_MARKER_TOP[track.trackKey] ?? 99,
    delta: point.delta,
    cumulative: point.cumulative,
    hitIndex: point.hitIndex,
    eventType: point.eventType ?? '',
    resultStatus: point.resultStatus ?? '',
    sourceKind: point.sourceKind ?? '',
    elementConfigIds: point.elementConfigIds ?? [],
    sourceElementConfigId: point.sourceElementConfigId,
    elementConfigId: point.elementConfigId,
    spBefore: point.spBefore,
    spAfter: point.spAfter,
  };
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
        displayFrameIndex: marker.displayFrameIndex,
        sourceFrameIndex: marker.sourceFrameIndex,
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

function formatStateCurveMarkerTitle(marker) {
  const sourceParts = [];
  const actionText = marker.actionName || marker.actionId;
  if (actionText) {
    sourceParts.push(actionText);
  }
  if (Number.isFinite(Number(marker.hitIndex))) {
    sourceParts.push(`hit${Number(marker.hitIndex)}`);
  }
  const elementText = formatStateCurveMarkerElements(marker);
  if (elementText) {
    sourceParts.push(elementText);
  }
  if (marker.eventType) {
    sourceParts.push(marker.eventType);
  }
  const spText = formatStateCurveMarkerSpRange(marker);
  if (spText) {
    sourceParts.push(spText);
  }
  if (marker.resultStatus) {
    sourceParts.push(marker.resultStatus);
  }
  if (marker.sourceKind) {
    sourceParts.push(marker.sourceKind);
  }
  const sourceText = sourceParts.length ? ` · ${sourceParts.join(' · ')}` : '';
  return `状态点 ${marker.trackLabel} ${marker.layerLabel} ${marker.frameLabel}: Δ${formatStateCurveTimelineNumber(marker.delta)} Σ${formatStateCurveTimelineNumber(marker.cumulative)}${sourceText}`;
}

function formatStateCurveLayerLabel(key) {
  if (key === 'applied') {
    return '已用';
  }
  if (key === 'sampled') {
    return '采样';
  }
  if (key === 'placeholder') {
    return '占位';
  }
  return key;
}

function formatStateCurveMarkerElements(marker) {
  const ids = [
    ...(marker.elementConfigIds ?? []),
    marker.sourceElementConfigId,
    marker.elementConfigId,
  ]
    .map(id => Number(id))
    .filter(Number.isFinite);
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) {
    return '';
  }
  return `element ${uniqueIds.join('/')}`;
}

function formatStateCurveMarkerSpRange(marker) {
  if (
    !Number.isFinite(Number(marker.spBefore)) ||
    !Number.isFinite(Number(marker.spAfter))
  ) {
    return '';
  }
  return `SP ${formatStateCurveTimelineNumber(marker.spBefore)}->${formatStateCurveTimelineNumber(marker.spAfter)}`;
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

function getCandidateSeriesStateTrackKey(item) {
  return CANDIDATE_SERIES_TO_STATE_TRACK_KEY[item?.seriesKey] ?? '';
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
  if (scope === 'selected-frame') {
    const selected = selectStateCurvePointForCandidateFrame(
      selectedCandidateFrameGroup.value
    );
    if (selected) {
      emit('update-state-curve-focus-mode', 'selected');
    }
    return;
  }
  emit('update-state-curve-focus-mode', 'all');
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

function isCandidateSeriesInStateTrackFocus(seriesKey) {
  return (
    Boolean(selectedCandidateFocusSeriesKey.value) &&
    seriesKey === selectedCandidateFocusSeriesKey.value
  );
}

function isCandidateMarkerInStateTrackFocus(marker) {
  return (
    marker.frameGroupId === selectedCandidateFrameGroup.value?.id &&
    isCandidateSeriesInStateTrackFocus(marker.seriesKey)
  );
}

function isCandidateFrameValueInStateTrackFocus(value) {
  return isCandidateSeriesInStateTrackFocus(value.seriesKey);
}

function selectCandidateFrameGroup(group) {
  selectedCandidateFrameGroupId.value = group.id;
  if (isStateCurveSelectedFocusActive.value) {
    candidateDisplayScope.value = 'selected-frame';
  }
  emitTimelineFrame({
    frameIndex: group.displayFrameIndex ?? group.sourceFrameIndex,
    timeMs: group.timeMs,
    source: 'timeline-candidate-frame',
  });
  selectStateCurvePointForCandidateFrame(group);
}

function selectCandidateFrameGroupByMarker(marker) {
  selectedCandidateFrameGroupId.value = marker.frameGroupId;
  if (isStateCurveSelectedFocusActive.value) {
    candidateDisplayScope.value = 'selected-frame';
  }
  emitTimelineFrame({
    frameIndex: marker.displayFrameIndex ?? marker.sourceFrameIndex,
    timeMs: marker.timeMs,
    source: 'timeline-candidate-frame',
  });
  selectStateCurvePointForCandidateFrame(marker);
}

function selectStateCurveMarker(marker) {
  emitTimelineFrame({
    frameIndex: marker.frameIndex,
    timeMs: marker.timeMs,
    statePointId: marker.statePointId,
    source: 'timeline-state-point',
  });
  if (isRuntimeStateCurveMarker(marker)) {
    emit(
      'dispatch-flow-action',
      mainFlowActionSurface.value.createRuntimeSelectionFlowAction({
        source: 'state-curve-point',
        actionId: marker.actionId,
        statePointId: marker.statePointId,
        payload: {
          preserveStateCurveFilters: true,
        },
      })
    );
    return;
  }
  emit('select-state-curve-point', marker.statePointId);
}

function selectRuntimeCurveBreakpoint(point) {
  emitTimelineFrame({
    frameIndex: point.frameIndex,
    timeMs: point.timeMs,
    statePointId: point.statePointId,
    source: 'timeline-runtime-curve',
  });
  if (!point.statePointId) {
    return;
  }
  emit(
    'dispatch-flow-action',
    mainFlowActionSurface.value.createRuntimeSelectionFlowAction({
      source: 'timeline-runtime-curve',
      actionId: point.actionId,
      statePointId: point.statePointId,
      payload: {
        preserveStateCurveFilters: true,
      },
    })
  );
}

function isRuntimeStateCurveMarker(marker) {
  return marker?.layerKey === 'applied';
}

function selectStateCurvePointForCandidateFrame(frame) {
  const point = findCandidateStateCurvePointForFrame(frame);
  if (point) {
    emit('select-state-curve-point', point.statePointId);
    return true;
  }
  return false;
}

function findCandidateStateCurvePointForFrame(frame) {
  const frameGroupKey = createStateCurveFrameGroupKey({
    actionId: frame.actionId,
    frameIndex: frame.displayFrameIndex ?? frame.sourceFrameIndex,
    timeMs: frame.timeMs,
    frameLabel: frame.frameLabel,
    hitIndex: frame.hitIndex,
  });

  for (const track of props.threeValueCurveFramework?.stateCurves?.tracks ??
    []) {
    if (!isStateCurveTrackVisible(track.trackKey)) {
      continue;
    }
    const candidateLayer = (track.layers ?? []).find(
      layer =>
        layer.key === 'candidate' &&
        isStateCurveTimelineLayerVisible(layer.key) &&
        (layer.pointCount ?? 0) > 0
    );
    if (!candidateLayer) {
      continue;
    }
    const pointIndex = (candidateLayer.points ?? []).findIndex(
      point => createStateCurveFrameGroupKey(point) === frameGroupKey
    );
    if (pointIndex >= 0) {
      return {
        statePointId: createStateCurvePointId({
          trackKey: track.trackKey,
          layerKey: candidateLayer.key,
          point: candidateLayer.points[pointIndex],
          pointIndex,
        }),
      };
    }
  }

  return null;
}

function syncCandidateDisplayScopeFromStateFocus() {
  if (!isStateCurveSelectedFocusActive.value) {
    if (candidateDisplayScope.value === 'selected-frame') {
      candidateDisplayScope.value = 'all';
    }
    return;
  }

  const selectedPoint = findStateCurvePointById(
    flowSelectedStateCurvePointId.value
  );
  if (!selectedPoint || selectedPoint.layerKey !== 'candidate') {
    if (candidateDisplayScope.value === 'selected-frame') {
      candidateDisplayScope.value = 'all';
    }
    return;
  }

  const frameGroupId =
    findCandidateFrameGroupIdForStateCurvePoint(selectedPoint);
  if (!frameGroupId) {
    if (candidateDisplayScope.value === 'selected-frame') {
      candidateDisplayScope.value = 'all';
    }
    return;
  }

  selectedCandidateFrameGroupId.value = frameGroupId;
  candidateDisplayScope.value = 'selected-frame';
}

function findStateCurvePointById(pointId) {
  if (!pointId) {
    return null;
  }

  for (const track of props.threeValueCurveFramework?.stateCurves?.tracks ??
    []) {
    if (!isStateCurveTrackVisible(track.trackKey)) {
      continue;
    }
    for (const layer of track.layers ?? []) {
      const points = layer.points ?? [];
      if (!isStateCurveTimelineLayerVisible(layer.key) || points.length <= 0) {
        continue;
      }
      for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
        const point = points[pointIndex];
        const statePointId = createStateCurvePointId({
          trackKey: track.trackKey,
          layerKey: layer.key,
          point,
          pointIndex,
        });
        if (statePointId !== pointId) {
          continue;
        }
        return {
          ...point,
          trackKey: track.trackKey,
          layerKey: layer.key,
          pointIndex,
        };
      }
    }
  }

  return null;
}

function findCandidateFrameGroupIdForStateCurvePoint(point) {
  const targetFrameGroupKey = createStateCurveFrameGroupKey(point);

  for (const series of props.candidateValueChart?.series ?? []) {
    if (!isCandidateSeriesVisible(series.key)) {
      continue;
    }
    for (const candidatePoint of series.points ?? []) {
      if (
        !isCandidateMarkerInActorFilter(candidatePoint) ||
        !isCandidateMarkerInActionFilter(candidatePoint)
      ) {
        continue;
      }

      const timeMs =
        candidatePoint.displayTimeMs ?? candidatePoint.sourceTimeMs ?? 0;
      const frameLabel =
        candidatePoint.displayFrameLabel ?? formatFrameTime(timeMs);
      const frameGroupKey = createStateCurveFrameGroupKey({
        actionId: candidatePoint.actionId,
        frameIndex:
          candidatePoint.displayFrameIndex ?? candidatePoint.sourceFrameIndex,
        timeMs,
        frameLabel,
        hitIndex: candidatePoint.hitIndex,
      });
      if (frameGroupKey === targetFrameGroupKey) {
        return `${candidatePoint.actionId}-${candidatePoint.hitIndex}-${frameLabel}`;
      }
    }
  }

  return null;
}

function isStateCurveTimelineLayerVisible(layerKey) {
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

function getStateCurveTimelineTrackPointCount(track) {
  return (track.layers ?? [])
    .filter(layer => STATE_CURVE_TIMELINE_LAYER_KEYS.has(layer.key))
    .reduce((sum, layer) => sum + (layer.pointCount ?? 0), 0);
}

function isStateCurveMarkerInFocus(marker) {
  return (
    !isStateCurveSelectedFocusActive.value ||
    marker.statePointId === flowSelectedStateCurvePointId.value
  );
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
  const summonTargetText = formatCandidateFrameGroupSummonTarget(group);
  return `${group.actionId} · ${hitSkillText} · ${elementText} · ${sourceText} · ${timingText}${summonTargetText} · 未应用候选`;
}

function formatCandidateFrameGroupSummonTarget(group) {
  const summaries = (group.values ?? [])
    .map(value => value.summonTargetEvidenceSummary)
    .filter(Boolean);
  if (summaries.length === 0) {
    return '';
  }

  const unitText = formatCompactList(
    summaries.flatMap(summary => summary.summonUnitIds ?? []),
    '召唤目标'
  );
  const skillText = formatCompactList(
    summaries.flatMap(summary => summary.targetSkillIds ?? []),
    '目标skill'
  );
  return ` · 召唤目标 ${unitText}->${skillText} · ${formatSummonTargetTriggerText(summaries)}`;
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
    formatCandidateElementSourceDetail(element),
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

function formatCandidateElementSourceDetail(element) {
  const target = element.summonTarget;
  if (!target) {
    return null;
  }

  const unit = target.summonUnitId ?? '未知召唤';
  const skill = target.targetSkillId ?? '目标skill';
  const triggerText = formatSummonTargetTriggerText([target]);
  return `召唤目标${unit}->${skill} ${triggerText}`;
}

function formatCandidateElementHpDetail(hpDamage) {
  const values = formatCandidateElementHpValues(hpDamage);
  return values ? `HP${values}` : null;
}

function formatCandidateElementHpValues(hpDamage) {
  if (!hpDamage) {
    return null;
  }
  return formatCompactList(
    hpDamage.rawFormulaParamValues?.map(value => formatTimelineNumber(value)) ??
      [],
    null
  );
}

function formatCandidateElementFormulaFunctionDetail(hpDamage) {
  const refs = formatCandidateFormulaFunctionRefs(hpDamage);
  return refs ? `函数${refs}` : null;
}

function formatCandidateFormulaFunctionRefs(hpDamage) {
  const refs = hpDamage?.formulaFunctionRefs ?? [];
  return refs.length
    ? refs.map(formatCandidateFormulaFunctionRef).join('/')
    : null;
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
  const summaries = formatCandidateElementSlotSummaries(alignment);
  return summaries ? `槽${summaries}` : null;
}

function formatCandidateElementSlotSummaries(alignment) {
  const summaries = alignment?.parameterSummaries ?? [];
  return summaries.length
    ? summaries.map(formatCandidateElementSlotSummary).join('/')
    : null;
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
  const value = formatCandidateElementToughnessValue(toughnessDamage);
  return value ? `韧性${value}` : null;
}

function formatCandidateElementToughnessValue(toughnessDamage) {
  const value = toughnessDamage?.weakBreakDamageRate;
  return Number.isFinite(Number(value)) ? formatTimelineNumber(value) : null;
}

function formatCandidateElementEnergyDetail(selfEnergyChange) {
  return formatCandidateElementEnergyParts(selfEnergyChange);
}

function formatCandidateElementEnergyParts(selfEnergyChange) {
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

function createCandidateElementComparisonRows(group) {
  const rowsByElement = new Map();
  for (const value of group.values ?? []) {
    for (const element of value.elementDetails ?? []) {
      const elementId = element.elementConfigId ?? '未知';
      const key = `${elementId}:${element.pathId ?? ''}`;
      if (!rowsByElement.has(key)) {
        rowsByElement.set(key, {
          id: key,
          elementConfigId: elementId,
          pathId: element.pathId ?? null,
          elementName: element.elementName ?? null,
          hpDamage: null,
          toughnessDamage: null,
          selfEnergyChange: null,
          skillLevelBridge: null,
          sourceKinds: [],
          summonTargets: [],
          summonTriggerFrameCandidates: [],
        });
      }

      const row = rowsByElement.get(key);
      row.sourceKinds = uniqueDisplayValues([
        ...row.sourceKinds,
        element.sourceKind,
      ]);
      row.summonTargets = uniqueDisplayValues([
        ...row.summonTargets,
        formatElementSummonTargetKey(element.summonTarget),
      ]);
      row.summonTriggerFrameCandidates = uniqueDisplayValues([
        ...row.summonTriggerFrameCandidates,
        ...(element.summonTarget?.triggerFrameCandidates ?? []),
        ...(element.summonTarget?.triggerFrameCandidateSummary
          ?.candidateStartFrames ??
          [] ??
          []),
      ]);
      row.hpDamage = mergeElementCandidateObject(
        row.hpDamage,
        element.hpDamage
      );
      row.toughnessDamage = mergeElementCandidateObject(
        row.toughnessDamage,
        element.toughnessDamage
      );
      row.selfEnergyChange = mergeElementCandidateObject(
        row.selfEnergyChange,
        element.selfEnergyChange
      );
      row.skillLevelBridge = mergeElementCandidateObject(
        row.skillLevelBridge,
        element.skillLevelBridge
      );
    }
  }

  return [...rowsByElement.values()]
    .map(row => {
      const displayRow = {
        ...row,
        hpText: formatCandidateElementHpValues(row.hpDamage) ?? '未展开',
        functionText:
          formatCandidateFormulaFunctionRefs(row.hpDamage) ?? '未确认',
        slotText:
          formatCandidateElementSlotSummaries(
            row.skillLevelBridge?.formulaSlotAlignment
          ) ?? '未桥接',
        toughnessText:
          formatCandidateElementToughnessValue(row.toughnessDamage) ?? '未展开',
        energyText:
          formatCandidateElementEnergyParts(row.selfEnergyChange) ?? '未展开',
      };
      displayRow.statusText =
        formatCandidateElementComparisonStatus(displayRow);
      displayRow.tooltip = formatCandidateElementComparisonTooltip(displayRow);
      return displayRow;
    })
    .sort(
      (left, right) =>
        Number(left.elementConfigId) - Number(right.elementConfigId) ||
        String(left.pathId ?? '').localeCompare(String(right.pathId ?? ''))
    );
}

function mergeElementCandidateObject(current, incoming) {
  if (!incoming) {
    return current;
  }
  if (!current) {
    return incoming;
  }
  return {
    ...current,
    ...incoming,
  };
}

function formatCandidateElementComparisonStatus(row) {
  const parts = ['未应用'];
  if (row.sourceKinds.includes('azpr-summon-target-damage-element-candidate')) {
    parts.push(
      row.summonTriggerFrameCandidates?.length
        ? '召唤触发候选待确认'
        : '召唤触发待确认'
    );
  }
  if (row.functionText !== '未确认') {
    parts.push('function组合待验证');
  }
  const overrideIds =
    row.skillLevelBridge?.formulaSlotAlignment?.overrideCandidateParamIds ?? [];
  if (overrideIds.length > 0) {
    parts.push(`等级覆盖待验证:${overrideIds.join('/')}`);
  }
  if (row.hpText !== '未展开') {
    parts.push('每hit倍率待分配');
  }
  return parts.join(' · ');
}

function formatCandidateElementComparisonTooltip(row) {
  return [
    `element ${row.elementConfigId}`,
    `HP ${row.hpText}`,
    `函数 ${row.functionText}`,
    `槽位 ${row.slotText}`,
    `削韧 ${row.toughnessText}`,
    `能量 ${row.energyText}`,
    row.summonTargets.length ? `召唤目标 ${row.summonTargets.join(',')}` : '',
    row.summonTriggerFrameCandidates?.length
      ? `召唤候选帧 ${row.summonTriggerFrameCandidates.join('/')}`
      : '',
    row.statusText,
  ]
    .filter(Boolean)
    .join(' / ');
}

function formatElementSummonTargetKey(target) {
  if (!target) {
    return null;
  }
  const unit = target.summonUnitId ?? '?';
  const skill = target.targetSkillId ?? '?';
  return `${unit}->${skill}`;
}

function formatSummonTargetTriggerText(summaries) {
  const frames = uniqueDisplayValues(
    (summaries ?? []).flatMap(summary => [
      ...(summary.triggerFrameCandidates ?? []),
      ...((summary.triggerFrameCandidateSummaries ?? []).flatMap(
        item => item.candidateStartFrames ?? []
      ) ?? []),
      ...(summary.triggerFrameCandidateSummary?.candidateStartFrames ??
        [] ??
        []),
    ])
  );
  return frames.length ? `触发候选帧 ${frames.join('/')}` : '触发帧未确认';
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

function uniqueDisplayValues(values) {
  return [
    ...new Set(
      values
        .map(value => String(value ?? '').trim())
        .filter(value => value.length > 0)
    ),
  ];
}

function formatTimelineNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString('zh-CN');
}

function formatStateCurveTimelineNumber(value) {
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
    return `${sign}${formatTimelineNumber(integerPart)}${decimalPart ? `.${decimalPart}` : ''}`;
  }
  return formatTimelineNumber(number);
}

function formatSigned(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? '+' : ''}${number}`;
}

function clampPercent(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function beginDrag(event, action) {
  if (
    (event.button ?? 0) !== 0 ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  ) {
    return;
  }

  const rect = laneRef.value?.getBoundingClientRect();
  if (!rect || rect.width <= 0) {
    emit('select-action', { actionId: action.id, mode: 'replace' });
    return;
  }

  event.preventDefault();
  event.currentTarget?.setPointerCapture?.(event.pointerId);
  const actionIds = selectedActionIdSet.value.has(action.id)
    ? props.actions
        .filter(item => selectedActionIdSet.value.has(item.id))
        .map(item => item.id)
    : [action.id];
  if (!selectedActionIdSet.value.has(action.id)) {
    emit('select-action', { actionId: action.id, mode: 'replace' });
  }
  const draggedActions = props.actions.filter(item =>
    actionIds.includes(item.id)
  );
  const minStartMs = Math.min(...draggedActions.map(item => item.startMs));
  const maxEndMs = Math.max(
    ...draggedActions.map(
      item =>
        item.startMs + (item.durationMs ?? DEFAULT_TIMELINE_ACTION_DURATION_MS)
    )
  );
  dragState.value = {
    actionId: action.id,
    actionIds,
    canChangeLane: canChangeActionBatchLane(draggedActions, action),
    initialLaneId: resolveActionLaneId(action),
    targetLaneId: null,
    laneWidth: rect.width,
    initialClientX: event.clientX,
    minOffsetMs: -minStartMs,
    maxOffsetMs: Math.max(-minStartMs, props.durationMs - maxEndMs),
    currentOffsetMs: 0,
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
  const actionIds = selectedActionIdSet.value.has(action.id)
    ? props.selectedActionIds
    : [action.id];
  if (!selectedActionIdSet.value.has(action.id)) {
    emit('select-action', { actionId: action.id, mode: 'replace' });
  }
  emit('shift-selected-actions', {
    actionIds,
    offsetMs: direction * stepMs,
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
    const draggedActions = resolveDraggedActions(dragState.value);
    dragState.value = {
      ...dragState.value,
      targetLaneId: resolveLegalBatchLaneAtPoint(
        event.clientY,
        draggedActions,
        actionsById.value.get(dragState.value.actionId)
      ),
    };
  }

  const deltaMs =
    ((event.clientX - dragState.value.initialClientX) /
      dragState.value.laneWidth) *
    props.durationMs;
  dragState.value = {
    ...dragState.value,
    currentOffsetMs: clampNumber(
      snapTimeMs(deltaMs),
      dragState.value.minOffsetMs,
      dragState.value.maxOffsetMs
    ),
  };
}

function endDrag(event) {
  const completedDrag = dragState.value;
  if (!completedDrag) {
    return;
  }
  let completedMove = false;
  if (event?.type === 'pointerup') {
    const draggedActions = resolveDraggedActions(completedDrag);
    const targetLaneId = completedDrag.canChangeLane
      ? resolveLegalBatchLaneAtPoint(
          event.clientY,
          draggedActions,
          actionsById.value.get(completedDrag.actionId)
        )
      : null;
    const laneChanged = Boolean(
      targetLaneId && targetLaneId !== completedDrag.initialLaneId
    );
    completedMove = Boolean(completedDrag.currentOffsetMs || laneChanged);
    if (completedMove) {
      emit('move-selected-actions', {
        actionIds: completedDrag.actionIds,
        primaryActionId: completedDrag.actionId,
        offsetMs: completedDrag.currentOffsetMs,
        targetLaneId: laneChanged ? targetLaneId : null,
      });
    }
  }
  if (completedMove) {
    suppressClickActionId.value = completedDrag.actionId;
    window.setTimeout(() => {
      if (suppressClickActionId.value === completedDrag.actionId) {
        suppressClickActionId.value = '';
      }
    }, 0);
  }

  dragState.value = null;
  window.removeEventListener('pointermove', handleDragMove);
  window.removeEventListener('pointerup', endDrag);
  window.removeEventListener('pointercancel', endDrag);
}

function isDraggingAction(actionId) {
  return dragState.value?.actionIds?.includes(actionId) ?? false;
}

function handleActionClick(event, action) {
  if (suppressClickActionId.value === action.id) {
    suppressClickActionId.value = '';
    return;
  }
  handleActionSelect(event, action);
}

function handleActionSelect(event, action) {
  emitTimelineFrame({
    timeMs: action.startMs,
    source: 'timeline-action',
  });
  emit('select-action', {
    actionId: action.id,
    mode: event.shiftKey
      ? 'range'
      : event.ctrlKey || event.metaKey
        ? 'toggle'
        : 'replace',
  });
}

function selectTimelineFrameFromPointer(event) {
  if (
    props.boxSelectionMode ||
    event.target?.closest?.(
      '.action-block, .action-relation-hit, .cycle-boundary, .effect-interval, .candidate-value-marker, .candidate-value-frame-hotspot, .state-curve-marker, .timeline-frame-cursor, [data-testid="workbench-timeline-state-curve-breakpoint"]'
    )
  ) {
    return;
  }
  emitTimelineFrameFromClientX(event.clientX, 'timeline-grid');
}

function beginTimelineCursorDrag(event) {
  if ((event.button ?? 0) !== 0) {
    return;
  }
  event.preventDefault();
  try {
    event.currentTarget?.setPointerCapture?.(event.pointerId);
  } catch {
    // Synthetic and assistive pointers may not have an active capture target.
  }
  timelineCursorDragState.value = { pointerId: event.pointerId };
  emitTimelineFrameFromClientX(event.clientX, 'timeline-cursor');
  window.addEventListener('pointermove', handleTimelineCursorDragMove);
  window.addEventListener('pointerup', endTimelineCursorDrag);
  window.addEventListener('pointercancel', endTimelineCursorDrag);
}

function handleTimelineCursorDragMove(event) {
  if (!timelineCursorDragState.value) {
    return;
  }
  emitTimelineFrameFromClientX(event.clientX, 'timeline-cursor');
}

function endTimelineCursorDrag(event) {
  if (timelineCursorDragState.value && event?.type === 'pointerup') {
    emitTimelineFrameFromClientX(event.clientX, 'timeline-cursor');
  }
  timelineCursorDragState.value = null;
  window.removeEventListener('pointermove', handleTimelineCursorDragMove);
  window.removeEventListener('pointerup', endTimelineCursorDrag);
  window.removeEventListener('pointercancel', endTimelineCursorDrag);
}

function nudgeTimelineCursor(event, direction) {
  emitTimelineFrame({
    frameIndex:
      timelineCursor.value.frameIndex + direction * (event.shiftKey ? 4 : 1),
    source: 'timeline-cursor',
  });
}

function emitTimelineFrameFromClientX(clientX, source) {
  const rect = laneRef.value?.getBoundingClientRect();
  if (!rect || rect.width <= 0 || !Number.isFinite(clientX)) {
    return;
  }
  const ratio = clampNumber((clientX - rect.left) / rect.width, 0, 1);
  emitTimelineFrame({
    frameIndex: Math.round(ratio * timelineCursor.value.maxFrameIndex),
    source,
  });
}

function emitTimelineFrame({
  frameIndex = null,
  timeMs = null,
  statePointId = '',
  source = 'timeline-grid',
} = {}) {
  const hasFrameIndex =
    frameIndex !== null && frameIndex !== undefined && frameIndex !== '';
  const normalizedFrameIndex = clampNumber(
    Math.round(hasFrameIndex ? Number(frameIndex) : msToFrame(timeMs)),
    0,
    timelineCursor.value.maxFrameIndex
  );
  emit('select-timeline-frame', {
    frameIndex: normalizedFrameIndex,
    timeMs: frameToMs(normalizedFrameIndex),
    statePointId,
    source,
  });
}

function isActionActiveAtTimelineCursor(action) {
  const startMs = numberOrZero(action?.startMs);
  const durationMs = Math.max(
    WORKBENCH_FRAME_MS,
    numberOrZero(action?.durationMs)
  );
  return (
    timelineCursor.value.timeMs >= startMs &&
    timelineCursor.value.timeMs < startMs + durationMs
  );
}

function deleteActionSelection(action) {
  const actionIds = selectedActionIdSet.value.has(action.id)
    ? props.selectedActionIds
    : [action.id];
  if (!selectedActionIdSet.value.has(action.id)) {
    emit('select-action', { actionId: action.id, mode: 'replace' });
  }
  emit('delete-selected-actions', { actionIds });
}

function openActionContextMenu(event, action) {
  emit('open-action-context-menu', {
    actionId: action.id,
    x: event.clientX,
    y: event.clientY,
    targetStartMs: action.startMs,
  });
}

function openTimelineContextMenu(event) {
  const rect = laneRef.value?.getBoundingClientRect();
  const targetStartMs = rect?.width
    ? snapTimeMs(
        clampNumber(
          ((event.clientX - rect.left) / rect.width) * props.durationMs,
          0,
          props.durationMs
        )
      )
    : undefined;
  emit('open-action-context-menu', {
    actionId: '',
    x: event.clientX,
    y: event.clientY,
    targetStartMs,
  });
}

function openCycleBoundaryContextMenu(event, boundary) {
  emit('open-cycle-boundary-context-menu', {
    boundaryId: boundary.id,
    x: event.clientX,
    y: event.clientY,
  });
}

function beginCycleBoundaryDrag(event, boundary) {
  if ((event.button ?? 0) !== 0) {
    return;
  }
  const rect = laneRef.value?.getBoundingClientRect();
  emit('select-cycle-boundary', boundary.id);
  if (!rect || rect.width <= 0) {
    return;
  }
  event.preventDefault();
  event.currentTarget?.setPointerCapture?.(event.pointerId);
  cycleBoundaryDragState.value = {
    boundaryId: boundary.id,
    initialClientX: event.clientX,
    laneWidth: rect.width,
    initialTimeMs: boundary.timeMs,
    currentTimeMs: boundary.timeMs,
  };
  window.addEventListener('pointermove', handleCycleBoundaryDragMove);
  window.addEventListener('pointerup', endCycleBoundaryDrag);
  window.addEventListener('pointercancel', endCycleBoundaryDrag);
}

function handleCycleBoundaryDragMove(event) {
  const state = cycleBoundaryDragState.value;
  if (!state) {
    return;
  }
  const deltaMs =
    ((event.clientX - state.initialClientX) / state.laneWidth) *
    props.durationMs;
  cycleBoundaryDragState.value = {
    ...state,
    currentTimeMs: clampNumber(
      snapTimeMs(state.initialTimeMs + deltaMs),
      WORKBENCH_FRAME_MS,
      props.durationMs - WORKBENCH_FRAME_MS
    ),
  };
}

function endCycleBoundaryDrag(event) {
  const state = cycleBoundaryDragState.value;
  if (
    state &&
    event?.type === 'pointerup' &&
    state.currentTimeMs !== state.initialTimeMs
  ) {
    emit('update-cycle-boundary', {
      boundaryId: state.boundaryId,
      timeMs: state.currentTimeMs,
    });
  }
  cycleBoundaryDragState.value = null;
  window.removeEventListener('pointermove', handleCycleBoundaryDragMove);
  window.removeEventListener('pointerup', endCycleBoundaryDrag);
  window.removeEventListener('pointercancel', endCycleBoundaryDrag);
}

function cycleBoundaryTimeMs(boundary) {
  return cycleBoundaryDragState.value?.boundaryId === boundary.id
    ? cycleBoundaryDragState.value.currentTimeMs
    : boundary.timeMs;
}

function cycleBoundaryStyle(boundary) {
  return {
    left: `${clampPercent(
      (cycleBoundaryTimeMs(boundary) / props.durationMs) * 100
    )}%`,
  };
}

function selectActionRelation(relationId) {
  emit('select-action-relation', { relationId });
}

function openActionRelationContextMenu(event, relationId) {
  emit('open-action-relation-context-menu', {
    relationId,
    x: event.clientX,
    y: event.clientY,
  });
}

function beginBoxSelection(event) {
  if (
    !props.boxSelectionMode ||
    (event.button ?? 0) !== 0 ||
    event.target?.closest?.('.action-block, .action-relation-hit')
  ) {
    return;
  }
  const rect = laneRef.value?.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return;
  }

  event.preventDefault();
  const startX = clampNumber(event.clientX - rect.left, 0, rect.width);
  const startY = clampNumber(event.clientY - rect.top, 0, rect.height);
  boxSelectionState.value = {
    startX,
    startY,
    left: startX,
    top: startY,
    width: 0,
    height: 0,
    append: Boolean(event.ctrlKey || event.metaKey),
  };
  window.addEventListener('pointermove', handleBoxSelectionMove);
  window.addEventListener('pointerup', endBoxSelection);
  window.addEventListener('pointercancel', cancelBoxSelection);
}

function handleBoxSelectionMove(event) {
  const state = boxSelectionState.value;
  const rect = laneRef.value?.getBoundingClientRect();
  if (!state || !rect) {
    return;
  }
  const currentX = clampNumber(event.clientX - rect.left, 0, rect.width);
  const currentY = clampNumber(event.clientY - rect.top, 0, rect.height);
  boxSelectionState.value = {
    ...state,
    left: Math.min(state.startX, currentX),
    top: Math.min(state.startY, currentY),
    width: Math.abs(currentX - state.startX),
    height: Math.abs(currentY - state.startY),
  };
}

function endBoxSelection() {
  const state = boxSelectionState.value;
  const lane = laneRef.value;
  const laneRect = lane?.getBoundingClientRect();
  if (state && laneRect && state.width >= 3 && state.height >= 3) {
    const selectionRect = {
      left: laneRect.left + state.left,
      top: laneRect.top + state.top,
      right: laneRect.left + state.left + state.width,
      bottom: laneRect.top + state.top + state.height,
    };
    const foundActionIds = new Set(
      [...lane.querySelectorAll('[data-testid="workbench-timeline-action"]')]
        .filter(element =>
          rectanglesIntersect(selectionRect, element.getBoundingClientRect())
        )
        .map(element => element.dataset.actionId)
        .filter(Boolean)
    );
    const actionIds = props.actions
      .map(action => action.id)
      .filter(actionId => foundActionIds.has(actionId));
    if (actionIds.length > 0) {
      emit('select-action-group', {
        actionIds,
        primaryActionId: actionIds[actionIds.length - 1],
        mode: state.append ? 'append' : 'replace',
      });
    }
  }
  clearBoxSelectionListeners();
  boxSelectionState.value = null;
}

function cancelBoxSelection() {
  clearBoxSelectionListeners();
  boxSelectionState.value = null;
}

function clearBoxSelectionListeners() {
  window.removeEventListener('pointermove', handleBoxSelectionMove);
  window.removeEventListener('pointerup', endBoxSelection);
  window.removeEventListener('pointercancel', cancelBoxSelection);
}

function rectanglesIntersect(left, right) {
  return (
    left.left < right.right &&
    left.right > right.left &&
    left.top < right.bottom &&
    left.bottom > right.top
  );
}

function formatSignedFrameGap(gapMs) {
  const frameCount = Math.round((Number(gapMs) || 0) / WORKBENCH_FRAME_MS);
  return `${frameCount > 0 ? '+' : ''}${frameCount}f`;
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

function synchronizeTimelineScroll(source) {
  const sourceElement =
    source === 'scale' ? scaleViewportRef.value : timelineViewportRef.value;
  const targetElement =
    source === 'scale' ? timelineViewportRef.value : scaleViewportRef.value;
  if (
    sourceElement &&
    targetElement &&
    targetElement.scrollLeft !== sourceElement.scrollLeft
  ) {
    targetElement.scrollLeft = sourceElement.scrollLeft;
  }
}

async function ensureTimelineCursorVisible() {
  await nextTick();
  const viewport = timelineViewportRef.value;
  const track = laneRef.value;
  if (!viewport || !track || viewport.clientWidth <= 0) {
    return;
  }
  const cursorX =
    (timelineCursor.value.xPercent / 100) * track.getBoundingClientRect().width;
  const margin = Math.min(48, viewport.clientWidth * 0.12);
  const visibleLeft = viewport.scrollLeft + margin;
  const visibleRight = viewport.scrollLeft + viewport.clientWidth - margin;
  if (cursorX < visibleLeft) {
    viewport.scrollLeft = Math.max(0, cursorX - margin);
  } else if (cursorX > visibleRight) {
    viewport.scrollLeft = Math.max(0, cursorX - viewport.clientWidth + margin);
  } else {
    return;
  }
  synchronizeTimelineScroll('timeline');
}

watch(
  () => props.boxSelectionMode,
  enabled => {
    if (!enabled) {
      cancelBoxSelection();
    }
  }
);

watch([() => props.cursorFrameIndex, timelineZoom], () => {
  void ensureTimelineCursorVisible();
});

function setLaneRowRef(element, laneId) {
  if (element) {
    laneRowRefs.set(laneId, element);
  } else {
    laneRowRefs.delete(laneId);
  }
}

function resolveDraggedActions(state = dragState.value) {
  const actionIdSet = new Set(state?.actionIds ?? []);
  return props.actions.filter(action => actionIdSet.has(action.id));
}

function canChangeActionBatchLane(actions, primaryAction) {
  return timelineLanes.value.some(lane => {
    const plan = createWorkbenchTimelineBatchLaneMovePlan({
      actions,
      actionIds: actions.map(action => action.id),
      primaryActionId: primaryAction?.id,
      targetLane: lane,
    });
    return plan?.changesOwner;
  });
}

function resolveLegalBatchLaneAtPoint(clientY, actions, primaryAction) {
  if (!Number.isFinite(clientY)) {
    return null;
  }

  for (const lane of timelineLanes.value) {
    if (!lane.editable) {
      continue;
    }
    const plan = createWorkbenchTimelineBatchLaneMovePlan({
      actions,
      actionIds: actions.map(action => action.id),
      primaryActionId: primaryAction?.id,
      targetLane: lane,
    });
    if (!plan) {
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

function handleTimelineEntryDragOver(event, lane) {
  const entry = resolveTimelineEntryDrag(event);
  if (!isWorkbenchTimelineEntryAllowedInLane(entry, lane)) {
    return;
  }
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy';
  }
  externalDropTargetLaneId.value = lane.id;
}

function handleTimelineEntryDragLeave(event, lane) {
  if (
    externalDropTargetLaneId.value === lane.id &&
    !event.currentTarget?.contains?.(event.relatedTarget)
  ) {
    externalDropTargetLaneId.value = '';
  }
}

function handleTimelineEntryDrop(event, lane) {
  const entry = resolveTimelineEntryDrag(event);
  if (!isWorkbenchTimelineEntryAllowedInLane(entry, lane)) {
    return;
  }
  event.preventDefault();
  const rect = laneRowRefs.get(lane.id)?.getBoundingClientRect?.();
  const startMs = rect?.width
    ? clampNumber(
        snapTimeMs(
          ((event.clientX - rect.left) / rect.width) * props.durationMs
        ),
        0,
        props.durationMs - WORKBENCH_FRAME_MS
      )
    : 0;
  emit('insert-timeline-entry', {
    entry,
    laneId: lane.id,
    laneKind: lane.kind,
    actorId: lane.actorId ?? null,
    startMs,
  });
  externalDropTargetLaneId.value = '';
}

function resolveTimelineEntryDrag(event) {
  return (
    timelineShelfEntryDrag.value ??
    parseWorkbenchTimelineEntry(
      event?.dataTransfer?.getData?.(WORKBENCH_TIMELINE_ENTRY_MIME)
    )
  );
}

function beginTimelineShelfEntryDrag(event, source) {
  const entry = createWorkbenchTimelineEntry(source);
  if (!entry) {
    event.preventDefault();
    return;
  }
  timelineShelfEntryDrag.value = entry;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(
      WORKBENCH_TIMELINE_ENTRY_MIME,
      serializeWorkbenchTimelineEntry(entry)
    );
    event.dataTransfer.setData('text/plain', entry.label ?? entry.type);
  }
}

function endTimelineShelfEntryDrag() {
  timelineShelfEntryDrag.value = null;
  externalDropTargetLaneId.value = '';
}

function insertTimelineShelfEntry(entry) {
  const laneKind = resolveWorkbenchTimelineLaneKind(entry);
  const lane = timelineLanes.value.find(
    item =>
      item.editable &&
      item.kind === laneKind &&
      (laneKind === 'enemy-event' ||
        item.actorId === props.timelineEntryDefaultActorId)
  );
  if (!lane) {
    return;
  }
  emit('insert-timeline-entry', {
    entry,
    laneId: lane.id,
    laneKind: lane.kind,
    actorId: lane.actorId ?? null,
    startMs: 0,
  });
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
  cancelBoxSelection();
  endCycleBoundaryDrag();
  endTimelineCursorDrag();
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
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.panel-icon {
  width: 17px;
  height: 17px;
  color: #79c7b9;
}

h2 {
  margin: 0;
  font-size: 14px;
}

.timeline-tools {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.timeline-cursor-readout {
  min-width: 92px;
  color: #dff6f1;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  text-align: center;
  white-space: nowrap;
}

.timeline-playback-controls,
.playback-range-mode {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.playback-rate-select {
  min-height: 26px;
  padding: 0 5px;
  border: 1px solid #3a454e;
  border-radius: 3px;
  color: #dfe5ea;
  background: #171d22;
  font-size: 11px;
}

.playback-range-mode {
  padding: 2px;
  border: 1px solid #344048;
  border-radius: 4px;
  background: #171d22;
}

.playback-range-mode button {
  min-height: 20px;
  padding: 0 6px;
  border: 0;
  border-radius: 2px;
  color: #8f9aa3;
  background: transparent;
  font-size: 11px;
  cursor: pointer;
}

.playback-range-mode button.active {
  color: #e8f8f4;
  background: #275047;
}

.timeline-entry-palette {
  position: relative;
  z-index: 30;
}

.timeline-entry-palette summary {
  display: inline-flex;
  min-height: 24px;
  align-items: center;
  gap: 4px;
  padding: 0 7px;
  border: 1px solid rgba(121, 199, 185, 0.34);
  border-radius: 4px;
  background: #18221f;
  color: #dff6f1;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  list-style: none;
}

.timeline-entry-palette summary::-webkit-details-marker {
  display: none;
}

.timeline-entry-palette[open] summary {
  border-color: #79c7b9;
  background: #20352f;
}

.timeline-entry-palette-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  display: grid;
  width: 190px;
  gap: 4px;
  padding: 6px;
  border: 1px solid rgba(121, 199, 185, 0.34);
  border-radius: 4px;
  background: #11171b;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.42);
}

.timeline-entry-palette-menu button {
  display: grid;
  min-height: 28px;
  grid-template-columns: 9px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  padding: 0 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  background: #182026;
  color: #e5edf2;
  font: inherit;
  font-size: 11px;
  text-align: left;
  cursor: grab;
}

.timeline-entry-palette-menu button:hover,
.timeline-entry-palette-menu button:focus-visible {
  border-color: rgba(121, 199, 185, 0.58);
  background: #21302d;
}

.timeline-entry-palette-menu i {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: #79c7b9;
}

.timeline-entry-palette-menu i.type-resource {
  background: #9bc478;
}

.timeline-entry-palette-menu i.type-kiboEvent {
  background: #82b688;
}

.timeline-entry-palette-menu i.type-enemyEvent {
  background: #e1848e;
}

.timeline-entry-palette-menu i.type-switch {
  background: #a6b7ff;
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

.state-layer-toggle-group,
.state-track-toggle-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.state-layer-toggle,
.state-track-toggle {
  display: inline-flex;
  min-height: 22px;
  align-items: center;
  gap: 5px;
  padding: 0 6px;
  border: 1px solid rgba(223, 249, 243, 0.18);
  border-radius: 4px;
  background: #151b20;
  color: #b8c0c7;
  font-size: 11px;
  cursor: pointer;
}

.state-layer-toggle.has-points,
.state-track-toggle.has-points {
  color: #dff6f1;
}

.state-layer-toggle input,
.state-track-toggle input {
  width: 13px;
  height: 13px;
  margin: 0;
  accent-color: #dff9f3;
}

.state-layer-toggle span,
.state-track-toggle span {
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
  width: 24px;
  height: 24px;
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

.icon-control.active {
  border-color: rgba(121, 199, 185, 0.86);
  background: rgba(121, 199, 185, 0.24);
  box-shadow: inset 0 0 0 1px rgba(121, 199, 185, 0.2);
}

.icon-control:disabled {
  opacity: 0.38;
  cursor: default;
  filter: none;
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
  grid-template-columns: 104px minmax(0, 1fr);
  gap: 8px;
  padding: 8px 12px 0;
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
  position: relative;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  min-width: 100%;
}

.timeline-scale-cursor {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #79c7b9;
  box-shadow: 0 0 5px rgba(121, 199, 185, 0.72);
  pointer-events: none;
  transform: translateX(-0.5px);
}

.scale-track span {
  text-align: center;
}

.scale-track span:last-child {
  text-align: right;
}

.timeline-shell {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr);
  gap: 8px;
  margin: 8px 12px;
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

.candidate-frame-detail-row.track-focused {
  border-color: rgba(121, 199, 185, 0.62);
  background: rgba(121, 199, 185, 0.12);
  box-shadow: inset 3px 0 0 rgba(121, 199, 185, 0.82);
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

.candidate-element-comparison {
  display: grid;
  gap: 4px;
  grid-column: 1 / -1;
  margin-top: 4px;
}

.candidate-element-comparison-head,
.candidate-element-comparison-row {
  display: grid;
  grid-template-columns:
    minmax(82px, 0.8fr) minmax(110px, 1fr) minmax(148px, 1.25fr)
    minmax(128px, 1.1fr) minmax(70px, 0.7fr) minmax(112px, 1fr)
    minmax(168px, 1.4fr);
  gap: 6px;
  align-items: center;
}

.candidate-element-comparison-head {
  color: #6f7b84;
  font-size: 10px;
  text-transform: uppercase;
}

.candidate-element-comparison-row {
  min-height: 30px;
  padding: 6px 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.03);
  color: #cfd8df;
  font-size: 11px;
}

.candidate-element-comparison-row b {
  color: #e5f4f1;
  font-weight: 700;
}

.candidate-element-comparison-row span,
.candidate-element-comparison-row small {
  min-width: 0;
  overflow-wrap: anywhere;
}

.candidate-element-comparison-row small {
  color: #8f9aa3;
}

.lane-labels,
.timeline-lane {
  display: grid;
  gap: 4px;
  min-width: 100%;
}

.timeline-lane {
  position: relative;
}

.timeline-lane.box-selection-active {
  cursor: crosshair;
  user-select: none;
}

.action-relation-layer {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.cycle-section-highlight {
  position: absolute;
  inset-block: 0;
  z-index: 0;
  border-inline: 1px solid rgba(121, 199, 185, 0.24);
  background: rgba(121, 199, 185, 0.07);
  pointer-events: none;
}

.cycle-boundary {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 6;
  width: 1px;
  padding: 0;
  border: 0;
  border-left: 1px dashed rgba(242, 179, 102, 0.78);
  background: transparent;
  color: #f2c781;
  cursor: ew-resize;
}

.cycle-boundary::after {
  position: absolute;
  inset: 0 -7px;
  content: '';
}

.cycle-boundary span {
  position: absolute;
  top: 4px;
  left: 5px;
  padding: 2px 5px;
  border: 1px solid rgba(242, 179, 102, 0.44);
  border-radius: 3px;
  background: #2a241b;
  color: #f5d39d;
  font-size: 9px;
  font-weight: 800;
  white-space: nowrap;
}

.cycle-boundary.selected {
  border-left-style: solid;
  border-left-color: #79c7b9;
  filter: drop-shadow(0 0 3px rgba(121, 199, 185, 0.5));
}

.cycle-boundary.selected span {
  border-color: #79c7b9;
  background: #21423d;
  color: #e8fffa;
}

.action-relation-path {
  fill: none;
  stroke: rgba(121, 199, 185, 0.64);
  stroke-width: 1.5;
}

.action-relation-endpoint {
  fill: #79c7b9;
  stroke: #14191e;
  stroke-width: 1;
}

.action-relation-hit {
  fill: none;
  stroke: transparent;
  stroke-width: 10;
  pointer-events: stroke;
  cursor: pointer;
}

.action-relation.selected .action-relation-path {
  stroke: #f2b366;
  stroke-width: 2.5;
  filter: drop-shadow(0 0 3px rgba(242, 179, 102, 0.55));
}

.action-relation.selected .action-relation-endpoint {
  fill: #f2b366;
}

.box-selection-overlay {
  position: absolute;
  z-index: 5;
  border: 1px solid rgba(121, 199, 185, 0.9);
  background: rgba(121, 199, 185, 0.13);
  box-shadow: inset 0 0 0 1px rgba(121, 199, 185, 0.12);
  pointer-events: none;
}

.timeline-frame-cursor {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 7;
  width: 1px;
  background: #79c7b9;
  box-shadow: 0 0 7px rgba(121, 199, 185, 0.48);
  pointer-events: none;
  transform: translateX(-0.5px);
}

.timeline-frame-cursor-handle {
  position: absolute;
  top: 0;
  left: 50%;
  width: 12px;
  height: 14px;
  border: 1px solid rgba(121, 199, 185, 0.8);
  border-radius: 3px;
  background: #21423d;
  cursor: ew-resize;
  outline: none;
  pointer-events: auto;
  transform: translateX(-50%);
}

.timeline-frame-cursor-handle:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.88);
  outline-offset: 2px;
}

.lane-label {
  display: grid;
  align-content: center;
  min-height: 64px;
  padding: 5px 8px;
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

.lane-label.enemy {
  border-color: rgba(225, 132, 142, 0.34);
  background: #21191b;
}

.lane-label.kibo {
  border-color: rgba(130, 182, 136, 0.28);
  background: #17201b;
}

.lane-label.kibo,
.lane-label.curve {
  padding-block: 2px;
  overflow: hidden;
}

.lane-label.kibo small,
.lane-label.curve small {
  margin-top: 1px;
}

.lane-label.curve {
  border-color: rgba(118, 149, 177, 0.28);
  background: #161d24;
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

.lane-row[data-lane-kind='actor-kibo'] {
  background:
    repeating-linear-gradient(
      90deg,
      rgba(130, 182, 136, 0.05) 0,
      rgba(130, 182, 136, 0.05) 1px,
      transparent 1px,
      transparent 10%
    ),
    #111916;
}

.lane-row[data-lane-kind$='curve'] {
  background:
    repeating-linear-gradient(
      90deg,
      rgba(118, 149, 177, 0.06) 0,
      rgba(118, 149, 177, 0.06) 1px,
      transparent 1px,
      transparent 10%
    ),
    #11171d;
}

.timeline-state-curve {
  position: absolute;
  inset: 8px 0;
  color: #a6b7ff;
}

.timeline-state-curve svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.timeline-state-curve polyline {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  vector-effect: non-scaling-stroke;
}

.timeline-state-curve circle {
  fill: currentColor;
  vector-effect: non-scaling-stroke;
}

.timeline-state-curve
  [data-testid='workbench-timeline-state-curve-breakpoint'] {
  cursor: pointer;
  pointer-events: auto;
}

.timeline-state-curve
  [data-testid='workbench-timeline-state-curve-breakpoint']:focus {
  outline: none;
  stroke: #ffffff;
  stroke-width: 1.5;
}

.timeline-state-curve .timeline-state-curve-cursor {
  fill: #ffffff;
  stroke: currentColor;
  stroke-width: 1.5;
  pointer-events: none;
}

.timeline-state-curve.curve-enemyHpDamage {
  color: #ef767a;
}

.timeline-state-curve.curve-enemyToughnessDamage {
  color: #e8c36a;
}

.action-block {
  position: absolute;
  top: 5px;
  box-sizing: border-box;
  height: 36px;
  min-width: 0;
  padding: 4px clamp(24px, 18%, 54px) 4px 7px;
  border: 1px solid rgba(121, 199, 185, 0.5);
  border-radius: 6px;
  background: linear-gradient(180deg, #274840 0%, #20352f 100%);
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28);
  cursor: pointer;
  z-index: 2;
}

.action-block.cursor-active {
  border-color: rgba(255, 255, 255, 0.92);
  box-shadow:
    0 0 0 2px rgba(121, 199, 185, 0.28),
    0 12px 30px rgba(0, 0, 0, 0.28);
}

.cooldown-window {
  position: absolute;
  box-sizing: border-box;
  height: 5px;
  min-width: 2px;
  border: 1px solid rgba(242, 179, 102, 0.72);
  border-radius: 2px;
  background: rgba(242, 179, 102, 0.32);
  pointer-events: none;
  z-index: 3;
}

.effect-interval {
  position: absolute;
  z-index: 4;
  display: grid;
  box-sizing: border-box;
  min-width: 14px;
  height: 16px;
  grid-template-columns: 15px minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px;
  padding: 1px 5px 1px 2px;
  overflow: hidden;
  border: 1px solid rgba(126, 176, 255, 0.58);
  border-radius: 3px;
  background: #263848;
  color: #edf5ff;
  cursor: pointer;
  font: inherit;
  font-size: 10px;
  letter-spacing: 0;
  text-align: left;
}

.effect-interval.target-enemy {
  border-color: rgba(225, 132, 142, 0.62);
  background: #493037;
  color: #fff0f2;
}

.effect-interval.active {
  border-style: dashed;
}

.effect-interval.persistent {
  border-right-width: 3px;
}

.effect-interval:hover,
.effect-interval:focus {
  border-color: rgba(255, 255, 255, 0.9);
  outline: none;
}

.effect-interval.selected {
  border-color: #f2b366;
  box-shadow:
    0 0 0 2px rgba(242, 179, 102, 0.24),
    0 4px 12px rgba(0, 0, 0, 0.28);
}

.effect-interval-glyph {
  display: inline-grid;
  width: 14px;
  height: 14px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: 2px;
  background: rgba(8, 12, 16, 0.42);
  font-size: 9px;
  font-weight: 800;
  line-height: 1;
}

.effect-interval-label {
  min-width: 0;
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.effect-interval small {
  color: #ffe1a8;
  font-size: 9px;
  font-weight: 800;
  white-space: nowrap;
}

.effect-lifecycle-marker {
  position: absolute;
  bottom: 0;
  width: 2px;
  height: 5px;
  background: #79c7b9;
  transform: translateX(-1px);
}

.effect-lifecycle-marker.event-effect_removed,
.effect-lifecycle-marker.event-effect_expired {
  background: #ff8792;
}

.action-block:hover,
.action-block:focus {
  border-color: rgba(255, 255, 255, 0.8);
  outline: none;
}

.action-block.multi-selected {
  border-color: rgba(121, 199, 185, 0.72);
  background: linear-gradient(180deg, #2b5148 0%, #223d37 100%);
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

.action-block.edit-focused {
  border-color: rgba(242, 179, 102, 0.9);
  box-shadow:
    0 0 0 3px rgba(242, 179, 102, 0.22),
    0 12px 30px rgba(0, 0, 0, 0.28);
}

.action-block.readiness-blocked {
  border-color: rgba(245, 108, 108, 0.92);
  background: linear-gradient(180deg, #543033 0%, #3f2528 100%);
}

.action-block.readiness-unresolved {
  border-color: rgba(242, 179, 102, 0.76);
  background: linear-gradient(180deg, #4b4231 0%, #393225 100%);
}

.action-block.dragging {
  cursor: grabbing;
}

.action-block.resizing {
  cursor: ew-resize;
}

.action-block.has-result-edit {
  padding-right: clamp(46px, 24%, 76px);
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

.timeline-action-result-edit-button {
  position: absolute;
  top: 50%;
  right: 22px;
  display: inline-flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(121, 199, 185, 0.56);
  border-radius: 4px;
  background: rgba(10, 18, 22, 0.68);
  color: #dff6f1;
  transform: translateY(-50%);
}

.timeline-action-result-edit-button:hover,
.timeline-action-result-edit-button:focus {
  border-color: rgba(255, 255, 255, 0.82);
  background: rgba(121, 199, 185, 0.24);
  outline: none;
}

.timeline-action-result-edit-button:disabled {
  cursor: not-allowed;
  opacity: 0.46;
}

.timeline-action-result-edit-icon {
  width: 13px;
  height: 13px;
}

.action-block.has-result-edit .overlap-badge,
.action-block.has-result-edit .auto-delay-badge {
  right: 46px;
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

.action-block.type-kiboEvent {
  border-color: rgba(130, 182, 136, 0.62);
  background: linear-gradient(180deg, #294535 0%, #20362b 100%);
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

.candidate-value-curve-line.track-focused {
  stroke-width: 3.4;
  opacity: 1;
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

.candidate-value-marker.track-focused {
  width: 12px;
  height: 12px;
  border-color: rgba(255, 255, 255, 0.94);
  box-shadow:
    0 0 0 3px rgba(121, 199, 185, 0.2),
    0 0 18px rgba(121, 199, 185, 0.64);
}

.state-curve-marker {
  position: absolute;
  z-index: 3;
  width: 7px;
  height: 7px;
  border: 1px solid rgba(255, 255, 255, 0.74);
  border-radius: 2px;
  background: #dff9f3;
  box-shadow: 0 0 10px rgba(223, 249, 243, 0.38);
  transform: translateX(-50%) rotate(45deg);
}

.state-curve-marker:focus,
.state-curve-marker.selected {
  outline: 2px solid rgba(255, 255, 255, 0.86);
  outline-offset: 3px;
}

.state-curve-marker.selected {
  box-shadow:
    0 0 0 3px rgba(121, 199, 185, 0.22),
    0 0 16px rgba(223, 249, 243, 0.52);
}

.state-curve-marker.state-layer-sampled {
  background: #79c7b9;
  box-shadow: 0 0 12px rgba(121, 199, 185, 0.52);
}

.state-curve-marker.state-layer-placeholder {
  border-color: rgba(239, 197, 116, 0.82);
  background: rgba(20, 25, 30, 0.96);
  box-shadow: 0 0 10px rgba(239, 197, 116, 0.36);
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

.legend-state {
  border: 1px solid rgba(255, 255, 255, 0.62);
  background: #dff9f3;
  transform: rotate(45deg) scale(0.82);
}

.legend-effect {
  border: 1px solid #7eb0ff;
  background: #263848;
}

.legend-system {
  background: #b9a479;
}

.legend-overlap {
  background: #f56c6c;
}

.legend-cooldown {
  height: 5px !important;
  background: #f2b366;
}

.legend-blocked {
  border: 1px solid #f56c6c;
  background: #543033;
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
    flex-wrap: wrap;
    margin-left: 0;
  }

  .timeline-entry-palette-menu {
    right: auto;
    left: 0;
    width: min(190px, calc(100vw - 44px));
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

  .candidate-element-comparison-head {
    display: none;
  }

  .candidate-element-comparison-row {
    grid-template-columns: 1fr;
  }

  .lane-label {
    padding: 8px;
  }
}
</style>
