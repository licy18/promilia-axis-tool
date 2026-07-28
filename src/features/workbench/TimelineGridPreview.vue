<template>
  <section
    class="panel timeline-panel"
    :class="{ 'timeline-export-mode': exportMode }"
    :data-flow-selected-action-id="flowSelectedActionId"
    :data-action-relation-count="actionRelations.length"
    :data-cycle-boundary-count="cycleBoundaries.length"
    :data-selected-cycle-boundary-id="selectedCycleBoundaryId"
    :data-effect-interval-count="effectIntervals.length"
    :data-tuning-mark-track-count="
      tuningMarkCurveProjection.visibleTracks.length
    "
    :data-selected-effect-interval-id="selectedEffectIntervalId"
    :data-box-selection-mode="boxSelectionMode ? 'true' : 'false'"
    :data-flow-selected-state-curve-point-id="flowSelectedStateCurvePointId"
    :data-flow-runtime-focus-source="flowRuntimeFocusSource"
    :data-cursor-frame-index="timelineCursor.frameIndex"
    :data-cursor-time-ms="timelineCursor.timeMs"
    :data-duration-ms="durationMs"
    :data-playback-running="playbackRunning ? 'true' : 'false'"
    :data-playback-rate="playbackRate"
    :data-playback-range-mode="playbackRangeMode"
    :data-controlled-actor-id="controlledActorAtCursor?.actorId ?? ''"
    :data-action-placement-mode="actionPlacementMode"
    :data-action-placement-status="actionPlacementProposal?.status ?? ''"
    :data-action-placement-preview-active="
      actionPlacementPreview?.active ? 'true' : 'false'
    "
    data-testid="workbench-timeline-grid-preview"
  >
    <div class="panel-title">
      <Clock class="panel-icon" />
      <h2>时间轴</h2>
      <div class="timeline-tools">
        <div
          class="timeline-placement-mode"
          role="group"
          aria-label="排轴模式"
          data-testid="workbench-action-placement-mode"
        >
          <button
            v-for="option in actionPlacementModeOptions"
            :key="option.key"
            type="button"
            :class="{ active: actionPlacementMode === option.key }"
            :aria-pressed="actionPlacementMode === option.key"
            :data-mode="option.key"
            data-testid="workbench-action-placement-mode-option"
            :title="option.title"
            @click="$emit('update-action-placement-mode', option.key)"
          >
            {{ option.label }}
          </button>
        </div>
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
          <Aim class="control-icon" />
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
        <output
          class="controlled-actor-readout"
          :data-actor-id="controlledActorAtCursor?.actorId ?? ''"
          :data-character-id="controlledActorAtCursor?.characterId ?? ''"
          data-testid="workbench-controlled-actor-readout"
        >
          前台 · {{ controlledActorAtCursor?.actorName ?? '未配置' }}
        </output>
        <label class="timeline-duration-control">
          <span>轴长</span>
          <select
            :value="durationMs"
            data-testid="workbench-timeline-duration-select"
            aria-label="时间轴总时长"
            title="时间轴总时长"
            @change="handleTimelineDurationChange"
          >
            <option
              v-for="option in WORKBENCH_TIMELINE_DURATION_OPTIONS_MS"
              :key="option"
              :value="option"
            >
              {{ option / 1000 }}s
            </option>
          </select>
        </label>
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
    </div>

    <div class="timeline-scale">
      <span class="scale-spacer">按键</span>
      <div
        ref="scaleViewportRef"
        class="scale-viewport"
        data-testid="workbench-timeline-scale-viewport"
        @scroll="synchronizeTimelineScroll('scale')"
      >
        <TimelineOperationAxis
          class="operation-axis-slot"
          :style="timelineTrackStyle"
          :actions="actions"
          :actors="actors"
          :duration-ms="durationMs"
          :selected-action-id="selectedActionId"
          @select-action="emit('select-action', $event)"
        />
        <div
          class="scale-track"
          :style="timelineTrackStyle"
          data-testid="workbench-timeline-scale-track"
        >
          <span
            v-for="tick in ticks"
            :key="tick.timeMs"
            :style="{ left: `${tick.leftPercent}%` }"
            data-testid="workbench-timeline-scale-tick"
            >{{ tick.label }}</span
          >
          <i
            class="timeline-scale-cursor"
            :style="timelineCursorStyle"
            data-testid="workbench-timeline-scale-cursor"
          />
        </div>
      </div>
    </div>

    <div class="timeline-shell" data-testid="workbench-timeline-shell">
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
            identity: isIdentityLane(lane),
            active: isActiveIdentityLane(lane),
            'controlled-actor': isControlledActorLane(lane),
          }"
          :style="[laneRowStyle(lane), laneIdentityStyle(lane)]"
          :data-lane-id="lane.id"
          :data-lane-kind="lane.kind"
          :data-actor-id="lane.actorId || ''"
          :data-character-id="lane.identity?.characterId || ''"
          :data-team-slot-id="lane.identity?.slotId || ''"
          :data-controlled-actor="
            isControlledActorLane(lane) ? 'true' : 'false'
          "
          :role="isKeyboardIdentityLane(lane) ? 'button' : undefined"
          :tabindex="isKeyboardIdentityLane(lane) ? 0 : undefined"
          :title="
            lane.curve
              ? `${lane.detail} · ${formatTopologyCurveLaneValue(lane)}`
              : ''
          "
          data-testid="workbench-timeline-lane-label"
          @click="handleTimelineLaneLabelClick(lane)"
          @keydown.enter.prevent="handleTimelineLaneLabelClick(lane)"
          @keydown.space.prevent="handleTimelineLaneLabelClick(lane)"
        >
          <template v-if="lane.kind === 'actor-action'">
            <button
              class="lane-avatar lane-avatar-command"
              type="button"
              :title="`更换${lane.name}`"
              :aria-label="`更换${lane.name}`"
              data-testid="workbench-direct-character-picker"
              @click.stop="openLaneLoadoutPicker(lane, 'character')"
            >
              <span>{{ lane.identity.initial }}</span>
              <img
                v-if="lane.identity.avatarUrl"
                :src="lane.identity.avatarUrl"
                :alt="lane.name"
                @error="$event.currentTarget.classList.add('missing')"
              />
            </button>
            <button
              class="lane-identity-copy lane-identity-command"
              type="button"
              title="查看角色详细配置"
              @click.stop="selectTimelineLaneIdentity(lane)"
            >
              <strong>{{ lane.name }}</strong>
              <small>
                {{ lane.identity.role }} · {{ lane.identity.elementName }}
              </small>
            </button>
            <div class="lane-loadout-rack">
              <button
                v-for="slot in lane.identity.loadoutSlots"
                :key="slot.key"
                class="lane-loadout-slot"
                :class="{ equipped: slot.selectedId }"
                type="button"
                :title="slot.title"
                :aria-label="slot.title"
                :data-loadout-slot="slot.key"
                :data-selected-id="slot.selectedId || ''"
                data-testid="workbench-direct-loadout-slot"
                @click.stop="openLaneLoadoutPicker(lane, slot.kind, slot)"
              >
                <span aria-hidden="true">{{ slot.initial }}</span>
                <img
                  v-if="slot.iconUrl"
                  :src="slot.iconUrl"
                  alt=""
                  @error="$event.currentTarget.classList.add('missing')"
                />
              </button>
            </div>
            <i class="lane-slot-index">{{ lane.identity.slotLabel }}</i>
          </template>
          <template v-else-if="lane.kind === 'enemy-event'">
            <button
              class="lane-direct-identity"
              type="button"
              title="选择敌人"
              data-testid="workbench-direct-enemy-picker"
              @click.stop="openLaneLoadoutPicker(lane, 'enemy')"
            >
              <span class="lane-avatar enemy-avatar" aria-hidden="true">
                <span>{{ lane.identity.initial }}</span>
                <img
                  v-if="lane.identity.iconUrl"
                  :src="lane.identity.iconUrl"
                  alt=""
                  @error="$event.currentTarget.classList.add('missing')"
                />
              </span>
              <span class="lane-identity-copy">
                <strong>{{ lane.name }}</strong>
                <small>{{ lane.detail }}</small>
              </span>
            </button>
          </template>
          <template v-else-if="lane.kind === 'actor-kibo'">
            <button
              class="lane-direct-identity lane-kibo-command"
              type="button"
              title="选择奇波"
              :data-selected-id="lane.identity?.kiboId || ''"
              data-testid="workbench-direct-kibo-picker"
              @click.stop="openLaneLoadoutPicker(lane, 'kibo')"
            >
              <span class="lane-kibo-icon" aria-hidden="true">
                <span>奇</span>
                <img
                  v-if="lane.identity.kiboIconUrl"
                  :src="lane.identity.kiboIconUrl"
                  alt=""
                  @error="$event.currentTarget.classList.add('missing')"
                />
              </span>
              <span class="lane-subtrack-copy">
                <strong>奇波</strong>
                <small>{{ lane.detail }}</small>
              </span>
            </button>
          </template>
          <template v-else-if="lane.curve">
            <i class="lane-curve-mark" aria-hidden="true" />
            <span class="lane-subtrack-copy">
              <strong>{{ lane.name }}</strong>
              <TimelineInitialEnergyInput
                v-if="isTimelineInitialEnergyEditable(lane)"
                :label="lane.detail"
                :value="lane.curve.initialValue"
                :max-value="lane.curve.maxValue"
                :owner-kind="
                  lane.kind === 'kibo-energy-curve' ? 'kibo' : 'actor'
                "
                :actor-id="lane.actorId"
                :character-id="lane.identity?.characterId"
                :slot-id="lane.identity?.slotId"
                :kibo-id="lane.identity?.kiboId"
                @commit="commitTimelineInitialEnergy(lane, $event)"
              />
              <small v-else>
                {{ lane.detail }} ·
                {{ formatTopologyCurveLaneValue(lane) }}
              </small>
            </span>
          </template>
          <template v-else-if="lane.kind === 'tuning-mark-empty'">
            <i class="lane-curve-mark" aria-hidden="true" />
            <span class="lane-subtrack-copy">
              <strong>队伍印记</strong>
              <small>暂无已验证印记变化</small>
            </span>
          </template>
          <template v-else>
            <span>{{ lane.name }}</span>
            <small>{{ lane.detail }}</small>
          </template>
        </div>
        <div
          v-if="!exportMode"
          class="timeline-scrollbar-clearance label-clearance"
          aria-hidden="true"
          data-testid="workbench-timeline-label-scrollbar-clearance"
        />
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
            v-if="actionPlacementPreview?.active"
            class="action-placement-guide requested"
            :class="placementPreviewStatusClass"
            :style="
              actionPlacementGuideStyle(
                actionPlacementPreview.proposal?.requestedStartMs
              )
            "
            data-testid="workbench-action-placement-request-guide"
          >
            <span>{{ placementPreviewRequestedFrameLabel }}</span>
          </div>
          <div
            v-if="showSuggestedPlacementGuide"
            class="action-placement-guide suggested"
            :class="placementPreviewStatusClass"
            :style="
              actionPlacementGuideStyle(
                actionPlacementPreview.proposal?.suggestedStartMs
              )
            "
            data-testid="workbench-action-placement-suggested-guide"
          >
            <span>{{ placementPreviewSuggestedFrameLabel }}</span>
          </div>
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
              :class="[
                `kind-${relation.kind}`,
                `status-${relation.status}`,
                { selected: isRelationSelected(relation) },
              ]"
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
                :data-relation-kind="relation.kind"
                data-testid="workbench-action-relation"
                @pointerdown.stop
                @click.stop="selectTimelineRelation(relation)"
                @contextmenu.prevent.stop="
                  openTimelineRelationContextMenu($event, relation)
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
                lane.id === externalDropTargetLaneId ||
                lane.id === externalTimelineEntryDrag?.targetLaneId,
            }"
            :data-lane-id="lane.id"
            :data-lane-kind="lane.kind"
            :data-actor-id="lane.actorId || ''"
            :data-editable="lane.editable ? 'true' : 'false'"
            :data-library-drop-target="
              lane.id === externalTimelineEntryDrag?.targetLaneId
                ? 'true'
                : 'false'
            "
            data-testid="workbench-timeline-row"
            :style="laneRowStyle(lane)"
            :ref="element => setLaneRowRef(element, lane.id)"
            @dragenter="handleTimelineEntryDragOver($event, lane)"
            @dragover="handleTimelineEntryDragOver($event, lane)"
            @dragleave="handleTimelineEntryDragLeave($event, lane)"
            @drop="handleTimelineEntryDrop($event, lane)"
          >
            <div
              v-for="ghost in placementGhostsForLane(lane)"
              :key="ghost.id"
              class="action-placement-ghost"
              :class="placementPreviewStatusClass"
              :style="actionPlacementGhostStyle(ghost, lane)"
              :data-action-id="ghost.id"
              :data-lane-id="lane.id"
              :data-placement-status="
                actionPlacementPreview.proposal?.status ?? ''
              "
              :data-requested-start-ms="
                actionPlacementPreview.proposal?.requestedStartMs ?? ''
              "
              :data-suggested-start-ms="
                actionPlacementPreview.proposal?.suggestedStartMs ?? ''
              "
              data-testid="workbench-action-placement-ghost"
              :title="formatActionPlacementPreviewTitle(ghost)"
            >
              <img
                v-if="resolveWorkbenchActionVisualIdentity(ghost).iconUrl"
                :src="resolveWorkbenchActionVisualIdentity(ghost).iconUrl"
                alt=""
                aria-hidden="true"
              />
              <strong>{{ ghost.label }}</strong>
              <small>{{ msToFrame(ghost.startMs) }}F</small>
            </div>
            <div
              v-for="interval in controlledIntervalsForLane(lane)"
              :key="interval.intervalId"
              class="controlled-actor-interval"
              :style="controlledActorIntervalStyle(interval, lane)"
              :data-interval-id="interval.intervalId"
              :data-actor-id="interval.actorId"
              :data-start-frame-index="interval.startFrameIndex"
              :data-end-frame-index="interval.endFrameIndex"
              data-testid="workbench-controlled-actor-interval"
            />
            <div
              v-if="lane.curve"
              class="timeline-state-curve"
              :class="`curve-${lane.curve.trackKey}`"
              :style="timelineCurveStyle(lane)"
              :data-track-key="lane.curve.trackKey"
              :data-actor-id="lane.curve.actorId || ''"
              :data-initial-value="lane.curve.initialValue"
              :data-current-value="lane.curve.currentValue"
              :data-cursor-value="lane.curve.cursorValue"
              :data-cursor-frame-index="timelineCursor.frameIndex"
              :data-max-value="lane.curve.maxValue ?? ''"
              :data-point-count="lane.curve.pointCount"
              :data-simulation-point-count="lane.curve.simulationPointCount"
              :data-semantic-node-count="lane.curve.semanticNodes.length"
              data-testid="workbench-timeline-state-curve"
            >
              <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline
                  :points="lane.curve.stepPoints"
                  :data-lane-id="lane.id"
                  :data-track-key="lane.curve.trackKey"
                  :data-point-count="lane.curve.displayPointCount"
                  data-testid="workbench-timeline-state-curve-line"
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
              <button
                v-for="point in lane.curve.semanticNodes"
                :key="point.id"
                class="timeline-state-curve-node"
                :class="{
                  selected: isTimelineCurveNodeSelected(lane, point),
                }"
                type="button"
                :style="runtimeCurveNodeStyle(point)"
                :title="formatTimelineCurveNodeTitle(lane, point)"
                :aria-label="formatTimelineCurveNodeTitle(lane, point)"
                :data-action-id="point.actionId"
                :data-hit-key="point.hitKey"
                :data-mark-id="lane.curve.markId || ''"
                :data-event-kinds="point.eventKinds?.join(',') || ''"
                :data-state-point-id="point.statePointId"
                :data-state-point-ids="point.statePointIds.join(',')"
                :data-runtime-focus-source="
                  point.statePointIds.includes(flowSelectedStateCurvePointId)
                    ? flowRuntimeFocusSource
                    : ''
                "
                :data-event-count="point.eventCount"
                :data-time-ms="point.timeMs"
                :data-frame-index="point.frameIndex"
                :data-current-value="point.currentValue"
                data-testid="workbench-timeline-state-curve-node"
                @pointerdown.stop
                @click.stop="selectTimelineCurveNode(lane, point)"
              />
            </div>
            <button
              v-for="window in lane.cooldownWindows"
              :key="window.windowId"
              class="cooldown-window"
              type="button"
              :style="cooldownWindowStyle(window, lane)"
              :title="formatCooldownWindowTitle(window)"
              :aria-label="formatCooldownWindowTitle(window)"
              :data-action-id="window.actionId"
              :data-skill-id="window.skillId || ''"
              :data-charge-index="window.chargeIndex"
              :data-start-ms="window.startMs"
              :data-end-ms="window.endMs"
              :data-base-duration-ms="
                window.baseDurationMs || window.durationMs
              "
              :data-effective-duration-ms="
                window.effectiveDurationMs || window.durationMs
              "
              :data-modifier-count="window.modifierCount || 0"
              :data-cooldown-evaluation-status="
                window.cooldownEvaluation?.status || ''
              "
              :data-start-frame-index="msToFrame(window.startMs)"
              :data-end-frame-index="msToFrame(window.endMs)"
              :data-confidence="window.confidence || ''"
              :data-tracking-status="window.trackingStatus || ''"
              :data-owner-kind="window.ownerKind || 'actor'"
              :data-owner-id="window.ownerId || window.actorId || ''"
              :data-cooldown-slot="window.cooldownSlot ?? 0"
              :data-window-id="window.windowId"
              data-testid="workbench-timeline-cooldown-window"
              @pointerdown.stop
              @click.stop="selectCooldownWindow(window)"
            >
              <span class="cooldown-window-glyph" aria-hidden="true">CD</span>
              <span class="cooldown-window-label">{{ window.actionName }}</span>
              <small>{{ formatCooldownWindowStatus(window) }}</small>
            </button>

            <TimelineSwitchEventMarker
              v-for="action in timelineSwitchEvents(lane)"
              :key="action.id"
              :action="action"
              :actors="actors"
              :lane-id="lane.id"
              :frame-index="msToFrame(action.startMs)"
              :timeline-duration-ms="durationMs"
              :top-px="Math.max(0, getTimelineActionTop(lane, 0) - 38)"
              :preview-offset-ms="
                isDraggingAction(action.id)
                  ? (dragState?.currentOffsetMs ?? 0)
                  : 0
              "
              :selected="action.id === flowSelectedActionId"
              :multi-selected="selectedActionIdSet.has(action.id)"
              :dragging="isDraggingAction(action.id)"
              :cursor-active="isActionActiveAtTimelineCursor(action)"
              :readiness="getActionReadiness(action)"
              @click.stop="handleActionClick($event, action)"
              @contextmenu.prevent.stop="openActionContextMenu($event, action)"
              @keydown.enter.prevent="handleActionSelect($event, action)"
              @keydown.space.prevent="handleActionSelect($event, action)"
              @keydown.left.prevent="nudgeAction($event, action, -1)"
              @keydown.right.prevent="nudgeAction($event, action, 1)"
              @keydown.delete.prevent="deleteActionSelection(action)"
              @keydown.backspace.prevent="deleteActionSelection(action)"
              @pointerdown.stop="beginDrag($event, action)"
            />

            <div
              v-for="action in timelineBlockActions(lane)"
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
                  'derived-readonly': isSwitchTriggeredDerivedAction(action),
                },
                `type-${action.type}`,
              ]"
              :style="actionStyle(action, lane)"
              :data-action-id="action.id"
              :data-action-type="action.type"
              :data-skill-id="action.skillId ?? ''"
              :data-start-ms="action.startMs"
              :data-duration-ms="action.durationMs"
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
              :data-derived-action-kind="action.derivedAction?.kind || ''"
              :data-parent-action-id="action.parentActionId || ''"
              :data-read-only="
                isSwitchTriggeredDerivedAction(action) ? 'true' : 'false'
              "
              :data-status-generation-status="
                action.statusGeneration?.status || ''
              "
              :data-generated-effect-count="
                action.statusGeneration?.summary?.generatedEffectCount ?? 0
              "
              :data-batch-id="action.generationBatch?.batchId || ''"
              :data-attack-group-id="action.attackGroupId || ''"
              :data-attack-sequence-index="action.attackSequenceIndex || ''"
              :data-attack-sequence-total="action.attackSequenceTotal || ''"
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
              @contextmenu.prevent.stop="
                openEditableActionContextMenu($event, action)
              "
              @keydown.enter.prevent="handleActionSelect($event, action)"
              @keydown.left.prevent="nudgeEditableAction($event, action, -1)"
              @keydown.right.prevent="nudgeEditableAction($event, action, 1)"
              @keydown.delete.prevent="deleteEditableActionSelection(action)"
              @keydown.backspace.prevent="deleteEditableActionSelection(action)"
              @pointerdown.stop="beginEditableDrag($event, action)"
            >
              <img
                v-if="resolveWorkbenchActionVisualIdentity(action).iconUrl"
                class="action-kind-icon action-image-icon"
                :src="resolveWorkbenchActionVisualIdentity(action).iconUrl"
                alt=""
                aria-hidden="true"
              />
              <component
                v-else
                :is="actionIconComponent(action)"
                class="action-kind-icon"
                aria-hidden="true"
              />
              <span class="action-block-copy">
                <strong>{{ actionLabel(action) }}</strong>
                <small v-if="actionDetail(action)">{{
                  actionDetail(action)
                }}</small>
              </span>
              <button
                v-if="
                  isTimelineActionResultEditVisible(action) &&
                  !isSwitchTriggeredDerivedAction(action)
                "
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
                v-if="!isSwitchTriggeredDerivedAction(action)"
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
              :key="interval.timelineLayoutKey"
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
              :data-source-element-id="interval.sourceIdentity?.elementId ?? ''"
              :data-target-kind="interval.targetKind"
              :data-target-id="interval.targetId"
              :data-source-action-id="interval.sourceActionId || ''"
              :data-start-ms="interval.startMs"
              :data-end-ms="interval.endMs"
              :data-start-frame-index="interval.startFrame"
              :data-end-frame-index="interval.endFrame"
              :data-icon-name="interval.icon || ''"
              :data-confidence="interval.confidence || ''"
              :data-tracking-status="interval.trackingStatus || ''"
              :data-source-status="interval.sourceStatus || ''"
              :data-effect-slot="interval.timelineSlot ?? 0"
              :data-applied-to-calculators="
                interval.appliedToCalculators ? 'true' : 'false'
              "
              :data-lifecycle-event-count="interval.lifecycleEvents.length"
              :data-initial-stacks="interval.initialStacks"
              :data-final-stacks="interval.finalStacks"
              :data-peak-stacks="interval.peakStacks"
              :data-max-stacks="interval.maxStacks"
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
              <span
                v-if="
                  formatEffectIntervalStatus(interval) || interval.maxStacks > 1
                "
                class="effect-interval-meta"
              >
                <small v-if="formatEffectIntervalStatus(interval)">
                  {{ formatEffectIntervalStatus(interval) }}
                </small>
                <small v-if="interval.maxStacks > 1">
                  {{ interval.peakStacks }}/{{ interval.maxStacks }}
                </small>
              </span>
              <i
                v-for="event in interval.lifecycleEvents.slice(1)"
                :key="event.eventId"
                class="effect-lifecycle-marker"
                :class="[
                  'event-' + String(event.type).toLowerCase(),
                  {
                    gain: Number(event.stackChange) > 0,
                    consume: Number(event.stackChange) < 0,
                  },
                ]"
                :style="effectLifecycleMarkerStyle(event, interval)"
                :title="formatEffectLifecycleMarkerTitle(event, interval)"
                :data-effect-event-id="event.eventId"
                :data-effect-event-type="event.type"
                :data-effect-operation="event.operation || ''"
                :data-before-stacks="
                  Number(event.stackBefore ?? event.before?.stacks ?? 0)
                "
                :data-after-stacks="
                  Number(event.stackAfter ?? event.after?.stacks ?? 0)
                "
                :data-time-ms="event.timeMs"
                data-testid="workbench-effect-lifecycle-marker"
              />
            </button>
          </div>
        </div>
        <div
          v-if="!exportMode"
          class="timeline-scrollbar-clearance track-clearance"
          :style="timelineTrackStyle"
          aria-hidden="true"
          data-testid="workbench-timeline-track-scrollbar-clearance"
        />
      </div>
    </div>

    <div v-if="timelineLanes.length === 0" class="empty-lane">
      暂无时间轴动作
    </div>
  </section>
</template>

<script setup>
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
} from 'vue';
import {
  Aim,
  ArrowLeft,
  ArrowRight,
  Clock,
  Connection,
  EditPen,
  Histogram,
  Lightning,
  Minus,
  Plus,
  StarFilled,
  Switch,
  Timer,
  VideoPause,
  VideoPlay,
  WarningFilled,
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
import { resolveWorkbenchActionVisualIdentity } from '../../domain/workbenchActionVisualIdentity';
import { resolveVerifiedActionRuntimeResolution } from './verifiedActionMechanicsTrace';
import { projectTimelineStateDisplaySeries } from '../../simulation/projection/projectTimelineStateDisplaySeries';
import { isSwitchTriggeredDerivedAction } from '../../simulation/generation/switchTriggeredActionGeneration';
import TimelineInitialEnergyInput from './TimelineInitialEnergyInput.vue';
import {
  WORKBENCH_TIMELINE_BASE_PIXELS_PER_SECOND,
  WORKBENCH_TIMELINE_DURATION_OPTIONS_MS,
  createWorkbenchTimelineTicks,
} from '../../domain/workbenchTimelineDuration';

const TimelineOperationAxis = defineAsyncComponent(
  () => import('./TimelineOperationAxis.vue')
);
const TimelineSwitchEventMarker = defineAsyncComponent(
  () => import('./TimelineSwitchEventMarker.vue')
);

const MIN_ACTION_DURATION_MS = WORKBENCH_FRAME_MS;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
const TIMELINE_LANE_MIN_HEIGHT_PX = 100;
const TIMELINE_ACTOR_LANE_MIN_HEIGHT_PX = 164;
const TIMELINE_EMPTY_KIBO_LANE_HEIGHT_PX = 64;
const TIMELINE_CURVE_LANE_HEIGHT_PX = 44;
const TIMELINE_TUNING_MARK_LANE_HEIGHT_PX = 28;
const TIMELINE_TUNING_MARK_EMPTY_HEIGHT_PX = 36;
const TIMELINE_ACTION_TOP_PX = 29;
const TIMELINE_ACTOR_ACTION_TOP_PX = 61;
const TIMELINE_ACTION_HEIGHT_PX = 42;
const TIMELINE_ACTION_SLOT_GAP_PX = 4;
const TIMELINE_COOLDOWN_GAP_PX = 6;
const TIMELINE_COOLDOWN_HEIGHT_PX = 16;
const TIMELINE_EFFECT_TOP_PX = 8;
const TIMELINE_EFFECT_INTERVAL_HEIGHT_PX = 16;
const TIMELINE_EFFECT_INTERVAL_GAP_PX = 3;
const TIMELINE_EFFECT_SECTION_GAP_PX = 8;
const TIMELINE_LANE_GAP_PX = 3;
const TIMELINE_DATA_GAP_PX = 10;
const ACTION_ICON_COMPONENTS = Object.freeze({
  skill: Lightning,
  kiboEvent: StarFilled,
  enemyEvent: WarningFilled,
  resource: Histogram,
  switch: Switch,
  wait: Timer,
  annotation: EditPen,
});
const playbackRangeModeOptions = [
  { key: 'axis', label: '全轴' },
  { key: 'section', label: '区段' },
];
const LOADOUT_SLOT_DEFINITIONS = Object.freeze([
  { key: 'weapon', label: '武器', kind: 'equipment' },
  { key: 'top', label: '上装', kind: 'equipment' },
  { key: 'bottom', label: '下装', kind: 'equipment' },
  { key: 'earring', label: '耳环', kind: 'equipment' },
  { key: 'ring', label: '戒指', kind: 'equipment' },
  { key: 'soulessenceId', label: '灵子', kind: 'soulessence' },
]);
const actionPlacementModeOptions = Object.freeze([
  { key: 'free', label: '自由', title: '按指定位置自由排轴' },
  {
    key: 'assisted',
    label: '辅助',
    title: '提交时按已知冲突建议合法位置',
  },
]);

const props = defineProps({
  actors: {
    type: Array,
    required: true,
  },
  characters: {
    type: Array,
    default: () => [],
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
  loadoutDetailCatalog: {
    type: Object,
    default: null,
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
  externalTimelineEntryDrag: {
    type: Object,
    default: null,
  },
  actionPlacementMode: {
    type: String,
    default: 'free',
  },
  actionPlacementProposal: {
    type: Object,
    default: null,
  },
  actionPlacementPreview: {
    type: Object,
    default: null,
  },
  activeActorCharacterId: {
    type: [Number, String],
    default: '',
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
      resources: { curvesByActor: [], curvesByKibo: [] },
    }),
  },
  tuningMarkCurveProjection: {
    type: Object,
    default: () => ({
      status: 'verified-tuning-mark-curves-unavailable',
      tracks: [],
      visibleTracks: [],
      summary: { profileCount: 0, visibleTrackCount: 0 },
      applied: false,
    }),
  },
  verifiedCombatRuntime: {
    type: Object,
    default: null,
  },
  controlledActorTimeline: {
    type: Object,
    default: () => ({
      initialActor: null,
      finalActor: null,
      transitions: [],
      intervals: [],
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
  actionEffectRelationGraph: {
    type: Object,
    default: null,
  },
  selectedActionEffectRelationId: {
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
  exportMode: {
    type: Boolean,
    default: false,
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
  initialEnergyEditing: {
    type: Boolean,
    default: false,
  },
  snapMs: {
    type: Number,
    default: WORKBENCH_FRAME_MS,
  },
});

const emit = defineEmits([
  'select-action',
  'select-identity',
  'delete-action',
  'update-action-time',
  'update-action-duration',
  'move-selected-actions',
  'shift-selected-actions',
  'delete-selected-actions',
  'open-action-context-menu',
  'select-action-group',
  'select-action-relation',
  'select-action-effect-relation',
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
  'update-duration',
  'dispatch-flow-action',
  'update-state-curve-layer-filter',
  'update-state-curve-track-filter',
  'update-state-curve-focus-mode',
  'insert-timeline-entry',
  'open-loadout-picker',
  'update-action-placement-mode',
  'preview-action-placement',
  'clear-action-placement-preview',
  'update-initial-energy',
]);
const laneRef = ref(null);
const scaleViewportRef = ref(null);
const timelineViewportRef = ref(null);
const laneRowRefs = new Map();
const dragState = ref(null);
const externalDropTargetLaneId = ref('');
const timelineShelfEntryDrag = ref(null);
const timelineEntryPlacementPreviewKey = ref('');
const resizeState = ref(null);
const boxSelectionState = ref(null);
const cycleBoundaryDragState = ref(null);
const timelineCursorDragState = ref(null);
const suppressClickActionId = ref('');
const timelineZoom = ref(1);
const mainFlowActionSurface = computed(() =>
  createWorkbenchMainFlowActionSurface({
    mainFlowCommandSurface: props.mainFlowCommandSurface,
  })
);
const placementPreviewStatusClass = computed(() =>
  props.actionPlacementPreview?.proposal?.status
    ? 'status-' + props.actionPlacementPreview.proposal.status
    : ''
);
const showSuggestedPlacementGuide = computed(() => {
  const proposal = props.actionPlacementPreview?.proposal;
  return (
    props.actionPlacementMode === 'assisted' &&
    proposal?.committable &&
    Number(proposal.suggestedStartMs) !== Number(proposal.requestedStartMs)
  );
});
const placementPreviewRequestedFrameLabel = computed(() => {
  const timeMs = props.actionPlacementPreview?.proposal?.requestedStartMs;
  return Number.isFinite(Number(timeMs))
    ? String(msToFrame(Number(timeMs))) + 'F'
    : '';
});
const placementPreviewSuggestedFrameLabel = computed(() => {
  const timeMs = props.actionPlacementPreview?.proposal?.suggestedStartMs;
  return Number.isFinite(Number(timeMs))
    ? String(msToFrame(Number(timeMs))) + 'F'
    : '';
});

const ticks = computed(() => {
  return createWorkbenchTimelineTicks({
    durationMs: props.durationMs,
    pixelsPerSecond: WORKBENCH_TIMELINE_BASE_PIXELS_PER_SECOND,
    zoom: timelineZoom.value,
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
const controlledActorAtCursor = computed(() => {
  const timeMs = timelineCursor.value.timeMs;
  const intervals = props.controlledActorTimeline?.intervals ?? [];
  const interval = intervals.find(
    (item, index) =>
      timeMs >= numberOrZero(item.startMs) &&
      (timeMs < numberOrZero(item.endMs) ||
        (index === intervals.length - 1 && timeMs === numberOrZero(item.endMs)))
  );
  return (
    interval?.actor ??
    props.controlledActorTimeline?.initialActor ??
    props.controlledActorTimeline?.finalActor ??
    null
  );
});

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
      const widthPercent = getTimelineActionWidthPercent(action, startPercent);
      layoutByActionId.set(action.id, {
        startX: startPercent,
        endX: clampPercent(startPercent + widthPercent),
        y:
          laneTop +
          getTimelineActionTop(lane, action.timelineSlot) +
          TIMELINE_ACTION_HEIGHT_PX / 2,
      });
    }
    laneTop += getTimelineLaneHeight(lane) + TIMELINE_LANE_GAP_PX;
  }
  return layoutByActionId;
});
const effectRelationLayoutByInstanceKey = computed(() => {
  const layoutByInstanceKey = new Map();
  let laneTop = 0;
  for (const lane of timelineLanes.value) {
    for (const interval of lane.effectIntervals) {
      const layout = {
        interval,
        startX: timeToTimelinePercent(interval.startMs),
        endX: timeToTimelinePercent(interval.endMs),
        y:
          laneTop +
          getTimelineEffectTop(lane) +
          Math.max(0, Number(interval.timelineSlot) || 0) *
            (TIMELINE_EFFECT_INTERVAL_HEIGHT_PX +
              TIMELINE_EFFECT_INTERVAL_GAP_PX) +
          TIMELINE_EFFECT_INTERVAL_HEIGHT_PX / 2,
      };
      const layouts = layoutByInstanceKey.get(interval.instanceKey) ?? [];
      layouts.push(layout);
      layoutByInstanceKey.set(interval.instanceKey, layouts);
    }
    laneTop += getTimelineLaneHeight(lane) + TIMELINE_LANE_GAP_PX;
  }
  return layoutByInstanceKey;
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
const actionRelationGeometry = computed(() => {
  return (props.actionEffectRelationGraph?.edges ?? []).flatMap(relation => {
    const source = resolveRelationEndpointLayout(
      relation.sourceEndpoint,
      relation
    );
    const target = resolveRelationEndpointLayout(
      relation.targetEndpoint,
      relation
    );
    if (!source || !target) return [];
    const sourceX = source.x;
    const sourceY = source.y;
    const targetX = target.x;
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
        id: relation.edgeId ?? relation.id,
        path,
        targetX,
        targetY,
        title: formatTimelineRelationTitle(relation),
      },
    ];
  });
});

function resolveRelationEndpointLayout(endpoint, relation) {
  if (endpoint?.endpointKind === 'action') {
    const layout = actionRelationLayoutByActionId.value.get(endpoint.actionId);
    if (!layout) return null;
    return {
      x: endpoint.anchor === 'end' ? layout.endX : layout.startX,
      y: layout.y,
    };
  }
  if (endpoint?.endpointKind !== 'effect') return null;
  const layouts =
    effectRelationLayoutByInstanceKey.value.get(endpoint.instanceKey) ?? [];
  const runtimeLayout = relation.runtimeEventId
    ? layouts.find(layout =>
        layout.interval.lifecycleEventIds?.includes(relation.runtimeEventId)
      )
    : null;
  const relationTimeMs = Number(relation.targetTimeMs ?? relation.sourceTimeMs);
  const timeLayout = Number.isFinite(relationTimeMs)
    ? layouts.find(
        layout =>
          relationTimeMs >= Number(layout.interval.startMs) &&
          relationTimeMs <= Number(layout.interval.endMs)
      )
    : null;
  const layout = runtimeLayout ?? timeLayout ?? layouts[0];
  if (!layout) return null;
  return {
    x: Number.isFinite(relationTimeMs)
      ? timeToTimelinePercent(relationTimeMs)
      : layout.startX,
    y: layout.y,
  };
}

function timeToTimelinePercent(timeMs) {
  return clampPercent(((Number(timeMs) || 0) / props.durationMs) * 100);
}

function formatTimelineRelationTitle(relation) {
  if (relation.kind === 'sequence') {
    return `后续关系 · ${formatSignedFrameGap(relation.gapMs)}`;
  }
  return `${relation.effectName || relation.effectId} · ${relation.status}`;
}
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
  width: `${
    (props.durationMs / 1000) *
    WORKBENCH_TIMELINE_BASE_PIXELS_PER_SECOND *
    timelineZoom.value
  }px`,
  minWidth: '100%',
}));
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
  const tuningMarkLanes = createTimelineTuningMarkLanes();
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
    ...tuningMarkLanes,
    ...actorGroups.flatMap(group => [
      group.actionLane,
      ...group.specialResourceLanes,
      group.energyCurveLane,
      group.kiboLane,
      group.kiboEnergyCurveLane,
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
    const laneId =
      window.ownerKind === 'kibo'
        ? kiboLaneIdByActorId.value.get(window.actorId)
        : window.actorId;
    const lane = allLanesById.get(laneId);
    const action = lane?.actions.find(item => item.id === window.actionId);
    if (!lane || !action) {
      return;
    }
    lane.cooldownWindows.push({
      ...window,
    });
  });

  allLanes.forEach(lane => {
    const cooldownLayout = createTimelineCooldownLayout(lane.cooldownWindows);
    lane.cooldownWindows = cooldownLayout.windows;
    lane.cooldownSlotCount = cooldownLayout.slotCount;
  });

  const visibleLanes = allLanes.filter(lane => lane !== systemLane);
  return systemLane.actions.length > 0 || systemLane.effectIntervals.length > 0
    ? [...visibleLanes, systemLane]
    : visibleLanes;
});

function createTimelineActorGroups() {
  const topologyGroups = props.timelineTopology?.actorGroups ?? [];
  return props.actors.map((actor, index) => {
    const character = props.characters.find(
      item => Number(item.id) === Number(actor.characterId)
    );
    const identity = createActorLaneIdentity(actor, character, index);
    const topology = topologyGroups.find(group => group.actorId === actor.id) ??
      topologyGroups[index] ?? {
        actionLane: { laneId: actor.id },
        kiboLane: { laneId: `kibo-fallback-${index + 1}`, kiboId: null },
        energyCurve: { laneId: `energy-${actor.id}`, actorId: actor.id },
        kiboEnergyCurve: {
          laneId: `kibo-energy-team-slot-${index + 1}`,
          slotId: `team-slot-${index + 1}`,
          actorId: actor.id,
          kiboId: null,
        },
      };
    const kibo = props.kibos.find(
      item => Number(item.id) === Number(topology.kiboLane?.kiboId)
    );
    const specialResourceCurves = (
      props.runtimeStateCurves?.resources?.curvesBySpecialResource ?? []
    ).filter(curve => curve.actorId === actor.id);
    return {
      actionLane: createEmptyTimelineLane({
        id: topology.actionLane?.laneId ?? actor.id,
        kind: 'actor-action',
        type: 'actor',
        actorId: actor.id,
        name: actor.name,
        detail: '角色动作',
        editable: true,
        identity,
      }),
      specialResourceLanes: specialResourceCurves.map(curve =>
        createEmptyTimelineLane({
          id: `special-resource-${actor.id}-${curve.elementId}`,
          kind: 'actor-special-resource-curve',
          type: 'curve',
          actorId: actor.id,
          name: curve.resourceName,
          detail: actor.name,
          editable: false,
          identity: {
            ...identity,
            kind: 'special-resource',
            resourceIdentity: curve.resourceIdentity,
            accentColor: identity.accentColor,
          },
          curve: createTimelineStateCurve({
            trackKey: curve.trackKey,
            actorId: actor.id,
            curveKind: 'special-resource',
            resourceIdentity: curve.resourceIdentity,
            resourceName: curve.resourceName,
            color: identity.accentColor,
            fallbackInitialValue: curve.initialValue,
            fallbackMaxValue: curve.maxValue,
          }),
        })
      ),
      kiboLane: createEmptyTimelineLane({
        id: topology.kiboLane?.laneId ?? `kibo-fallback-${index + 1}`,
        kind: 'actor-kibo',
        type: 'kibo',
        actorId: actor.id,
        name: '奇波',
        detail: kibo?.name ?? '未配置',
        editable: true,
        identity: {
          ...identity,
          kiboId: kibo?.id ?? null,
          kiboName: kibo?.name ?? '待绑定奇波',
          kiboIconUrl: resolveLoadoutItemIcon('kibo', kibo?.id),
        },
      }),
      energyCurveLane: createEmptyTimelineLane({
        id: topology.energyCurve?.laneId ?? `energy-${actor.id}`,
        kind: 'actor-energy-curve',
        type: 'curve',
        actorId: actor.id,
        name: '角色能量',
        detail: actor.name,
        editable: false,
        identity,
        curve: createTimelineStateCurve({
          trackKey: 'selfEnergyChange',
          actorId: actor.id,
          fallbackInitialValue: actor.initialSp ?? actor.stats?.initialSp ?? 0,
          fallbackMaxValue: actor.stats?.maxSp,
        }),
      }),
      kiboEnergyCurveLane: createEmptyTimelineLane({
        id:
          topology.kiboEnergyCurve?.laneId ??
          `kibo-energy-team-slot-${index + 1}`,
        kind: 'kibo-energy-curve',
        type: 'curve',
        actorId: actor.id,
        name: '奇波能量',
        detail: kibo?.name ?? `槽位 ${index + 1}`,
        editable: false,
        identity: {
          ...identity,
          kind: 'kibo',
          slotId: topology.kiboEnergyCurve?.slotId ?? `team-slot-${index + 1}`,
          kiboId: kibo?.id ?? null,
          kiboName: kibo?.name ?? '待绑定奇波',
          accentColor: '#70d6b7',
        },
        curve: createTimelineStateCurve({
          trackKey: 'kiboEnergyChange',
          actorId: actor.id,
          slotId: topology.kiboEnergyCurve?.slotId ?? `team-slot-${index + 1}`,
          kiboId: kibo?.id ?? null,
          runtimeCurveEnabled: Boolean(kibo),
          fallbackInitialValue: 0,
          fallbackMaxValue: kibo ? null : 1,
        }),
      }),
    };
  });
}

function createActorLaneIdentity(actor, character, index) {
  const label = actor?.name || character?.name || '角色';
  return {
    kind: 'actor',
    actorId: actor?.id ?? '',
    slotId: `team-slot-${index + 1}`,
    characterId: Number(actor?.characterId ?? character?.id),
    label,
    initial: Array.from(label)[0] ?? '角',
    slotLabel: String(index + 1).padStart(2, '0'),
    role: character?.position?.name ?? actor?.role ?? '战斗',
    elementName: character?.element?.name ?? '属性待确认',
    accentColor: character?.element?.color ?? '#79c7b9',
    avatarUrl: resolveCharacterAvatarUrl(actor?.characterId ?? character?.id),
    loadoutSlots: createActorLoadoutSlots(actor),
  };
}

function createActorLoadoutSlots(actor) {
  return LOADOUT_SLOT_DEFINITIONS.map(definition => {
    const selectedId = Number(
      definition.kind === 'equipment'
        ? actor?.loadout?.equipment?.[definition.key]
        : actor?.loadout?.[definition.key]
    );
    const hasSelection = Number.isFinite(selectedId) && selectedId > 0;
    const detail = hasSelection
      ? findLoadoutDetail(definition.kind, selectedId)
      : null;
    return {
      ...definition,
      selectedId: hasSelection ? selectedId : null,
      initial: detail
        ? Array.from(String(detail.name || definition.label))[0]
        : hasSelection
          ? definition.label.slice(0, 1)
          : '+',
      iconUrl: resolveLoadoutDetailIcon(definition.kind, detail),
      title: `${definition.label}：${detail?.name ?? (hasSelection ? '资料载入后显示' : '未装备')}`,
    };
  });
}

function findLoadoutDetail(kind, selectedId) {
  const collection =
    kind === 'kibo'
      ? props.loadoutDetailCatalog?.kibos
      : kind === 'soulessence'
        ? props.loadoutDetailCatalog?.soulessences
        : props.loadoutDetailCatalog?.equipment;
  return (collection ?? []).find(
    item => Number(item.id) === Number(selectedId)
  );
}

function resolveLoadoutItemIcon(kind, selectedId) {
  return resolveLoadoutDetailIcon(kind, findLoadoutDetail(kind, selectedId));
}

function resolveLoadoutDetailIcon(kind, detail) {
  const icon = kind === 'soulessence' ? detail?.icons?.small : detail?.icon;
  return icon ? `/assets/loadout/${icon}` : '';
}

function resolveCharacterAvatarUrl(characterId) {
  const normalizedId = Number(characterId);
  return Number.isFinite(normalizedId)
    ? `/assets/characters/${normalizedId}.png`
    : '';
}

function isIdentityLane(lane) {
  return [
    'actor-action',
    'actor-kibo',
    'actor-energy-curve',
    'kibo-energy-curve',
    'enemy-event',
    'enemy-hp-curve',
    'enemy-toughness-curve',
  ].includes(lane?.kind);
}

function isDirectLoadoutLane(lane) {
  return ['actor-action', 'actor-kibo', 'enemy-event'].includes(lane?.kind);
}

function isKeyboardIdentityLane(lane) {
  return (
    isIdentityLane(lane) &&
    !isDirectLoadoutLane(lane) &&
    !isTimelineInitialEnergyEditable(lane)
  );
}

function isActiveIdentityLane(lane) {
  return (
    lane?.kind === 'actor-action' &&
    Number(lane.identity?.characterId) === Number(props.activeActorCharacterId)
  );
}

function isControlledActorLane(lane) {
  return (
    lane?.kind === 'actor-action' &&
    lane.actorId === controlledActorAtCursor.value?.actorId
  );
}

function controlledIntervalsForLane(lane) {
  if (lane?.kind !== 'actor-action') return [];
  return (props.controlledActorTimeline?.intervals ?? []).filter(
    interval => interval.actorId === lane.actorId
  );
}

function controlledActorIntervalStyle(interval, lane) {
  const startPercent = clampPercent(
    (numberOrZero(interval.startMs) / props.durationMs) * 100
  );
  const endPercent = clampPercent(
    (numberOrZero(interval.endMs) / props.durationMs) * 100
  );
  return {
    left: `${startPercent}%`,
    width: `${Math.max(0, endPercent - startPercent)}%`,
    '--controlled-actor-accent': lane?.identity?.accentColor ?? '#79c7b9',
  };
}

function laneIdentityStyle(lane) {
  return {
    '--lane-accent': lane?.identity?.accentColor ?? '#79c7b9',
  };
}

function handleTimelineLaneLabelClick(lane) {
  if (isDirectLoadoutLane(lane)) return;
  selectTimelineLaneIdentity(lane);
}

function openLaneLoadoutPicker(lane, kind, slot = null) {
  emit('open-loadout-picker', {
    kind,
    slotId: lane.identity?.slotId ?? '',
    slotKey: slot?.key ?? (kind === 'kibo' ? 'kiboId' : ''),
    slotLabel:
      slot?.label ??
      (kind === 'enemy' ? '敌人' : kind === 'character' ? '角色' : '奇波'),
    actorId: lane.identity?.actorId ?? lane.actorId ?? '',
    actorName: lane.identity?.label ?? lane.name ?? '',
    characterId: lane.identity?.characterId ?? null,
    enemyId: lane.identity?.enemyId ?? null,
    selectedId:
      kind === 'character'
        ? lane.identity?.characterId
        : kind === 'enemy'
          ? lane.identity?.enemyId
          : kind === 'kibo'
            ? lane.identity?.kiboId
            : slot?.selectedId,
  });
}

function selectTimelineLaneIdentity(lane) {
  if (!isIdentityLane(lane)) return;
  const isEnemy = lane.kind.startsWith('enemy-');
  const isKibo =
    lane.kind === 'actor-kibo' || lane.kind === 'kibo-energy-curve';
  emit('select-identity', {
    kind: isEnemy ? 'enemy' : 'actor',
    actorId: lane.identity?.actorId ?? lane.actorId ?? '',
    characterId: lane.identity?.characterId ?? '',
    enemyId: lane.identity?.enemyId ?? '',
    kiboId: lane.identity?.kiboId ?? '',
    label: isKibo
      ? (lane.identity?.kiboName ?? lane.detail ?? lane.name)
      : (lane.identity?.label ?? lane.name),
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
      identity: {
        kind: 'enemy',
        enemyId: props.enemy?.enemyId ?? props.enemy?.id ?? '',
        label: props.enemy?.name || '敌人',
        initial: Array.from(String(props.enemy?.name || '敌'))[0] ?? '敌',
        iconUrl: props.enemy?.icon ? `/assets/loadout/${props.enemy.icon}` : '',
        accentColor: '#e1848e',
      },
      effectIntervals,
    }),
    hpCurveLane: createEmptyTimelineLane({
      id: topology.hpCurve?.laneId ?? 'enemy-hp-curve',
      kind: 'enemy-hp-curve',
      type: 'curve',
      name: 'HP',
      detail: props.enemy?.name || '敌人',
      editable: false,
      identity: {
        kind: 'enemy',
        label: props.enemy?.name || '敌人',
        accentColor: '#ef767a',
      },
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
      identity: {
        kind: 'enemy',
        label: props.enemy?.name || '敌人',
        accentColor: '#e8c36a',
      },
      curve: createTimelineStateCurve({
        trackKey: 'enemyToughnessDamage',
        fallbackInitialValue: initialToughness,
        fallbackMaxValue: maxToughness || null,
      }),
    }),
  };
}

function createTimelineTuningMarkLanes() {
  const tracks = props.tuningMarkCurveProjection?.visibleTracks ?? [];
  if (tracks.length === 0) {
    return props.tuningMarkCurveProjection?.applied
      ? [
          createEmptyTimelineLane({
            id: 'tuning-mark-empty',
            kind: 'tuning-mark-empty',
            type: 'tuning-mark',
            name: '队伍印记',
            detail: '暂无已验证印记变化',
            editable: false,
            identity: { accentColor: '#8f9aa3' },
          }),
        ]
      : [];
  }
  return tracks.map((track, index) =>
    createEmptyTimelineLane({
      id: `tuning-mark-${track.markId}`,
      kind: 'tuning-mark-curve',
      type: 'curve',
      name: track.label,
      detail: index === 0 ? '队伍印记' : '队伍共享',
      editable: false,
      identity: {
        kind: 'tuning-mark',
        markId: track.markId,
        profileKey: track.profileKey,
        accentColor: track.color,
      },
      curve: createTimelineTuningMarkCurve(track),
    })
  );
}

function createTimelineTuningMarkCurve(track) {
  const cursorValue = track.valueAtTime(timelineCursor.value.timeMs);
  return {
    trackKey: track.trackKey,
    curveKind: 'tuning-mark',
    markId: track.markId,
    profileKey: track.profileKey,
    elementName: track.elementName,
    color: track.color,
    initialValue: track.initialValue,
    currentValue: track.currentValue,
    cursorValue,
    cursorYPercent: 100 - (cursorValue / track.maxValue) * 100,
    maxValue: track.maxValue,
    pointCount: track.semanticNodeCount,
    displayPointCount: track.displayPointCount,
    simulationPointCount: track.simulationPointCount,
    semanticNodes: track.semanticNodes,
    stepPoints: track.linePoints
      .map(point => `${point.xPercent},${point.yPercent}`)
      .join(' '),
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
  identity = null,
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
    identity,
    curve,
    actions: [],
    cooldownWindows: [],
    cooldownSlotCount: 0,
    effectIntervals: [...effectIntervals],
  };
}

function formatTopologyCurveCursorValue(curve) {
  const current = formatCompactNumber(curve.cursorValue);
  const max = strictNumberOrNull(curve.maxValue);
  return max == null ? current : `${current} / ${formatCompactNumber(max)}`;
}

function formatTopologyCurveInitialValue(curve) {
  const initial = formatCompactNumber(curve.initialValue);
  const max = strictNumberOrNull(curve.maxValue);
  return max == null ? initial : `${initial} / ${formatCompactNumber(max)}`;
}

function formatTopologyCurveLaneValue(lane) {
  return isTimelineInitialEnergyLane(lane)
    ? formatTopologyCurveInitialValue(lane.curve)
    : formatTopologyCurveCursorValue(lane.curve);
}

function isTimelineInitialEnergyLane(lane) {
  return ['actor-energy-curve', 'kibo-energy-curve'].includes(lane?.kind);
}

function isTimelineInitialEnergyEditable(lane) {
  if (!props.initialEnergyEditing || !isTimelineInitialEnergyLane(lane)) {
    return false;
  }
  if (lane.kind === 'kibo-energy-curve' && !Number(lane.identity?.kiboId)) {
    return false;
  }
  return Number(lane.curve?.maxValue) > 0;
}

function commitTimelineInitialEnergy(lane, currentValue) {
  if (!isTimelineInitialEnergyEditable(lane)) return;
  emit('update-initial-energy', {
    ownerKind: lane.kind === 'kibo-energy-curve' ? 'kibo' : 'actor',
    actorId: lane.actorId,
    characterId: lane.identity?.characterId ?? null,
    slotId: lane.identity?.slotId ?? '',
    kiboId: lane.identity?.kiboId ?? null,
    kiboName: lane.identity?.kiboName ?? null,
    currentValue,
    maxValue: lane.curve.maxValue,
  });
}

function createTimelineStateCurve({
  trackKey,
  actorId = '',
  slotId = '',
  kiboId = null,
  curveKind = null,
  resourceIdentity = null,
  resourceName = null,
  color = null,
  runtimeCurveEnabled = true,
  fallbackInitialValue = 0,
  fallbackMaxValue = null,
}) {
  const runtimeCurve = runtimeCurveEnabled
    ? resolveRuntimeStateCurve(trackKey, {
        actorId,
        slotId,
        kiboId,
        curveKind,
        resourceIdentity,
        resourceName,
        color,
      })
    : null;
  const stateMetric = runtimeCurve?.stateMetric ?? null;
  const initialValue = numberOrZero(
    stateMetric?.initialValue ?? fallbackInitialValue
  );
  const maxValue = strictNumberOrNull(
    stateMetric?.maxValue ?? fallbackMaxValue
  );
  const displaySeries = projectTimelineStateDisplaySeries({
    trackKey,
    points: runtimeCurve?.points ?? [],
    initialValue,
    maxValue,
    durationMs: props.durationMs,
    resolveStatePointId: point =>
      runtimeStatePointContextByDeltaId.value.get(point.sourceDeltaId)
        ?.statePointId ?? '',
  });
  const cursorValue = displaySeries.valueAtTime(timelineCursor.value.timeMs);

  return {
    trackKey,
    actorId,
    slotId,
    kiboId,
    curveKind,
    resourceIdentity,
    resourceName,
    color,
    initialValue,
    currentValue: displaySeries.currentValue,
    cursorValue,
    cursorYPercent: 100 - (cursorValue / displaySeries.maxValue) * 100,
    maxValue: displaySeries.maxValue,
    pointCount: displaySeries.semanticNodeCount,
    displayPointCount: displaySeries.displayPointCount,
    simulationPointCount: displaySeries.simulationPointCount,
    semanticNodes: displaySeries.semanticNodes,
    stepPoints: displaySeries.linePoints
      .map(point => `${point.xPercent},${point.yPercent}`)
      .join(' '),
  };
}

function resolveRuntimeStateCurve(trackKey, { actorId, slotId, kiboId }) {
  if (String(trackKey).startsWith('specialResource:')) {
    return (
      props.runtimeStateCurves?.resources?.curvesBySpecialResource?.find(
        curve => curve.trackKey === trackKey && curve.actorId === actorId
      ) ?? null
    );
  }
  if (trackKey === 'selfEnergyChange') {
    return (
      props.runtimeStateCurves?.resources?.curvesByActor?.find(
        curve => curve.actorId === actorId
      ) ?? null
    );
  }
  if (trackKey === 'kiboEnergyChange') {
    return (
      props.runtimeStateCurves?.resources?.curvesByKibo?.find(curve => {
        if (slotId && curve.slotId === slotId) return true;
        return kiboId != null && Number(curve.kiboId) === Number(kiboId);
      }) ?? null
    );
  }
  const metricKey = trackKey === 'enemyHpDamage' ? 'hp' : 'toughness';
  return {
    stateMetric: props.runtimeStateCurves?.enemy?.stateMetrics?.[metricKey],
    points: props.runtimeStateCurves?.enemy?.points ?? [],
  };
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
function isActionInSelectedBatch(action) {
  return Boolean(
    selectedBatchId.value &&
    action.generationBatch?.batchId === selectedBatchId.value
  );
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

function actionStyle(action, lane) {
  const previewOffsetMs = isDraggingAction(action.id)
    ? (dragState.value?.currentOffsetMs ?? 0)
    : 0;
  const left = clampPercent(
    ((action.startMs + previewOffsetMs) / props.durationMs) * 100
  );
  const width = getTimelineActionWidthPercent(action, left);
  return {
    left: `${left}%`,
    top: `${getTimelineActionTop(lane, action.timelineSlot)}px`,
    width: `${width}%`,
  };
}

function placementGhostsForLane(lane) {
  const preview = props.actionPlacementPreview;
  if (!preview?.active) {
    return [];
  }
  const useSuggestedActions =
    props.actionPlacementMode === 'assisted' &&
    preview.proposal?.committable &&
    preview.proposedActions?.length;
  const actions = useSuggestedActions
    ? preview.proposedActions
    : preview.requestedActions;
  return (actions ?? []).filter(action => action.laneId === lane.id);
}

function actionPlacementGhostStyle(action, lane) {
  const left = clampPercent((Number(action.startMs) / props.durationMs) * 100);
  return {
    left: String(left) + '%',
    top: String(getTimelineActionTop(lane, action.timelineSlot)) + 'px',
    width: String(getTimelineActionWidthPercent(action, left)) + '%',
    transform: left >= 100 ? 'translateX(-100%)' : 'none',
  };
}

function actionPlacementGuideStyle(timeMs) {
  return {
    left: String(clampPercent((Number(timeMs) / props.durationMs) * 100)) + '%',
  };
}

function formatActionPlacementPreviewTitle(action) {
  const proposal = props.actionPlacementPreview?.proposal;
  const statusLabel =
    {
      valid: '位置合法',
      adjustable: '已有确定建议位置',
      blocked:
        props.actionPlacementMode === 'free'
          ? '存在冲突，自由模式仍保留请求位置'
          : '当前位置不可提交',
      unresolved: '条件待确认，保持请求位置',
    }[proposal?.status] ?? '位置预览';
  const requestedFrame = msToFrame(proposal?.requestedStartMs ?? 0);
  const suggestedFrame = msToFrame(proposal?.suggestedStartMs ?? 0);
  const frameText =
    requestedFrame === suggestedFrame
      ? String(requestedFrame) + 'F'
      : String(requestedFrame) + 'F -> ' + String(suggestedFrame) + 'F';
  const issue =
    proposal?.conflicts?.[0]?.message ??
    proposal?.adjustments?.[0]?.message ??
    proposal?.unresolved?.[0]?.message ??
    '';
  return [action.label, statusLabel, frameText, issue]
    .filter(Boolean)
    .join(' · ');
}

function getTimelineActionWidthPercent(action, leftPercent = 0) {
  if (action?.type === 'switch') return 0;
  const durationMs = Math.max(
    MIN_ACTION_DURATION_MS,
    resolveTimelineActionDurationMs(action)
  );
  return clampPercent(
    (durationMs / props.durationMs) * 100,
    0,
    Math.max(0, 100 - leftPercent)
  );
}

function resolveTimelineActionDurationMs(action) {
  const resolution = resolveVerifiedActionRuntimeResolution(
    props.verifiedCombatRuntime,
    action.id
  );
  return (
    Number(resolution?.actionBinding?.actualDurationMs) ||
    Number(action.durationMs) ||
    DEFAULT_TIMELINE_ACTION_DURATION_MS
  );
}

function cooldownWindowStyle(window, lane) {
  const startMs = Math.max(0, Number(window.startMs) || 0);
  const endMs = Math.min(
    props.durationMs,
    Math.max(startMs, Number(window.endMs) || startMs)
  );
  return {
    left: `${clampPercent((startMs / props.durationMs) * 100)}%`,
    top: `${getTimelineCooldownTop(lane, window.cooldownSlot)}px`,
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

function formatEffectIntervalStatus(interval) {
  if (interval.appliedToCalculators) return '已应用';
  if (interval.trackingStatus === 'unapplied') return '未应用';
  if (String(interval.trackingStatus ?? '').includes('tracking')) return '追踪';
  return interval.sourceStatus ? '追踪' : '';
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
  const sourceAction = actionsById.value.get(interval.sourceActionId);
  const sourceText = sourceAction
    ? `来源 ${sourceAction.name || sourceAction.id}`
    : '来源动作未绑定';
  const trackingText = formatEffectIntervalStatus(interval) || '状态未标记';
  return (
    [
      interval.effectName || interval.effectId,
      interval.targetName || interval.targetId,
      sourceText,
      String(interval.startFrame) + 'F-' + String(interval.endFrame) + 'F',
      trackingText,
    ].join(' · ') +
    stackText +
    activeText +
    ' · ' +
    lifecycleText
  );
}

function selectCooldownWindow(window) {
  emitTimelineFrame({
    timeMs: window.startMs,
    source: 'timeline-cooldown-window',
  });
  emit('select-action', { actionId: window.actionId, mode: 'replace' });
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

function formatEffectLifecycleMarkerTitle(event, interval) {
  const before = Number(event.stackBefore ?? event.before?.stacks ?? 0);
  const after = Number(event.stackAfter ?? event.after?.stacks ?? 0);
  const frame = Math.round(Number(event.timeMs) / WORKBENCH_FRAME_MS);
  return [
    interval.effectName || interval.effectId,
    formatEffectLifecycleOperation(event.type),
    `${before} -> ${after} 层`,
    `${frame}F`,
  ].join(' · ');
}

function selectEffectInterval(interval) {
  emit('select-effect-interval', {
    intervalId: interval.intervalId,
    eventId: interval.selectionEventId,
    actionId: interval.sourceActionId ?? '',
    timeMs: interval.endMs,
  });
}

function laneRowStyle(lane) {
  const height = getTimelineLaneHeight(lane);
  return {
    height: `${height}px`,
    minHeight: `${height}px`,
  };
}

function getTimelineActionTop(lane, slot) {
  const preferredTop =
    lane?.kind === 'actor-action'
      ? TIMELINE_ACTOR_ACTION_TOP_PX
      : TIMELINE_ACTION_TOP_PX;
  return (
    Math.max(
      preferredTop,
      getTimelineEffectAreaBottom(lane) + TIMELINE_EFFECT_SECTION_GAP_PX
    ) +
    Math.max(0, Number(slot) || 0) *
      (TIMELINE_ACTION_HEIGHT_PX + TIMELINE_ACTION_SLOT_GAP_PX)
  );
}

function getTimelineActionAreaBottom(lane) {
  const slotCount = getTimelineActionSlotCount(lane);
  return (
    getTimelineActionTop(lane, 0) +
    slotCount * TIMELINE_ACTION_HEIGHT_PX +
    Math.max(0, slotCount - 1) * TIMELINE_ACTION_SLOT_GAP_PX
  );
}

function getTimelineEffectTop() {
  return TIMELINE_EFFECT_TOP_PX;
}

function getTimelineEffectAreaBottom(lane) {
  const effectSlotCount = getTimelineEffectSlotCount(lane);
  if (effectSlotCount === 0) return TIMELINE_EFFECT_TOP_PX;
  return (
    getTimelineEffectTop() +
    effectSlotCount * TIMELINE_EFFECT_INTERVAL_HEIGHT_PX +
    Math.max(0, effectSlotCount - 1) * TIMELINE_EFFECT_INTERVAL_GAP_PX
  );
}

function getTimelineDataTop(lane) {
  return getTimelineCooldownAreaBottom(lane) + TIMELINE_DATA_GAP_PX;
}

function getTimelineCooldownTop(lane, slot = 0) {
  return (
    getTimelineActionAreaBottom(lane) +
    (getTimelineCooldownSlotCount(lane) > 0 ? TIMELINE_COOLDOWN_GAP_PX : 0) +
    Math.max(0, Number(slot) || 0) *
      (TIMELINE_COOLDOWN_HEIGHT_PX + TIMELINE_EFFECT_INTERVAL_GAP_PX)
  );
}

function getTimelineCooldownAreaBottom(lane) {
  const slotCount = getTimelineCooldownSlotCount(lane);
  if (slotCount === 0) return getTimelineActionAreaBottom(lane);
  return (
    getTimelineCooldownTop(lane, 0) +
    slotCount * TIMELINE_COOLDOWN_HEIGHT_PX +
    Math.max(0, slotCount - 1) * TIMELINE_EFFECT_INTERVAL_GAP_PX
  );
}

function getTimelineLaneHeight(lane) {
  if (lane.kind === 'tuning-mark-curve') {
    return TIMELINE_TUNING_MARK_LANE_HEIGHT_PX;
  }
  if (lane.kind === 'tuning-mark-empty') {
    return TIMELINE_TUNING_MARK_EMPTY_HEIGHT_PX;
  }
  if (lane.type === 'curve') return TIMELINE_CURVE_LANE_HEIGHT_PX;
  if (lane.type === 'kibo' && lane.actions.length === 0) {
    return TIMELINE_EMPTY_KIBO_LANE_HEIGHT_PX;
  }
  return Math.max(
    lane.kind === 'actor-action'
      ? TIMELINE_ACTOR_LANE_MIN_HEIGHT_PX
      : TIMELINE_LANE_MIN_HEIGHT_PX,
    getTimelineDataTop(lane) + 24
  );
}

function getTimelineActionSlotCount(lane) {
  return Math.max(1, Number(lane?.actionSlotCount) || 1);
}

function getTimelineEffectSlotCount(lane) {
  return Math.max(0, Number(lane?.effectSlotCount) || 0);
}

function getTimelineCooldownSlotCount(lane) {
  return Math.max(0, Number(lane?.cooldownSlotCount) || 0);
}

function createTimelineActionLayout(actions) {
  const slotEndTimes = [];
  const slotByActionId = new Map();
  const sortedActions = timelineBlockActions({ actions }).sort(
    compareTimelineActionStart
  );

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

function timelineBlockActions(lane) {
  return (lane?.actions ?? []).filter(action => action.type !== 'switch');
}

function timelineSwitchEvents(lane) {
  return (lane?.actions ?? []).filter(action => action.type === 'switch');
}

function createTimelineEffectLayout(intervals) {
  const slotEndTimes = [];
  const slotByInterval = new Map();
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
    slotByInterval.set(interval, slotIndex);
  });

  return {
    intervals: intervals.map((interval, index) => ({
      ...interval,
      timelineLayoutKey: `${interval.intervalId || interval.instanceKey || 'effect'}|${index}`,
      timelineSlot: slotByInterval.get(interval) ?? 0,
    })),
    slotCount: slotEndTimes.length,
  };
}

function createTimelineCooldownLayout(windows) {
  const slotEndTimes = [];
  const slotByWindow = new Map();
  const sortedWindows = [...windows].sort(
    (left, right) =>
      (Number(left.startMs) || 0) - (Number(right.startMs) || 0) ||
      (Number(left.endMs) || 0) - (Number(right.endMs) || 0) ||
      String(left.windowId).localeCompare(String(right.windowId))
  );

  sortedWindows.forEach(window => {
    const startMs = Number(window.startMs) || 0;
    const endMs =
      startMs +
      Math.max(
        Number(window.durationMs) || Number(window.endMs) - startMs || 0,
        props.durationMs * 0.005,
        WORKBENCH_FRAME_MS
      );
    const slotIndex = findAvailableTimelineActionSlot(slotEndTimes, startMs);
    slotEndTimes[slotIndex] = endMs;
    slotByWindow.set(window, slotIndex);
  });

  return {
    windows: windows.map(window => ({
      ...window,
      cooldownSlot: slotByWindow.get(window) ?? 0,
    })),
    slotCount: slotEndTimes.length,
  };
}

function getTimelineActionLayoutDurationMs(action) {
  if (action?.type === 'switch') return 0;
  return Math.max(
    MIN_ACTION_DURATION_MS,
    resolveTimelineActionDurationMs(action)
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
  const index = slotEndTimes.findIndex(endMs => startMs >= endMs - 0.001);
  return index >= 0 ? index : slotEndTimes.length;
}

function actionIconComponent(action) {
  return ACTION_ICON_COMPONENTS[action?.type] ?? Lightning;
}

function actionLabel(action) {
  if (action.attackSequenceIndex != null) {
    return action.attackInput?.label ?? `A${action.attackSequenceIndex}`;
  }
  if (action.type === 'switch') {
    return `${action.name} -> ${action.targetActor?.name ?? '目标'}`;
  }
  return (
    resolveTimelineActionRuntimeIdentity(action).name ??
    resolveWorkbenchActionVisualIdentity(action).name
  );
}

function actionDetail(action) {
  if (action.type === 'skill' || action.type === 'kiboEvent') {
    const identity = resolveWorkbenchActionVisualIdentity(action);
    const durationFrames = msToFrame(resolveTimelineActionDurationMs(action));
    const { executionLabel } = resolveTimelineActionRuntimeIdentity(action);
    const triggerLabel = isSwitchTriggeredDerivedAction(action)
      ? action.switchTriggerBinding?.triggerPhase === 'on-enter'
        ? '入场触发'
        : '退场触发'
      : null;
    return [
      triggerLabel,
      action.attackInput?.semanticName ?? identity.typeLabel,
      `${durationFrames}F`,
      executionLabel,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  if (action.type === 'resource') {
    return `${String(action.resource ?? 'sp').toUpperCase()} ${formatSigned(action.change)}`;
  }
  if (action.type === 'enemyEvent') {
    return `${action.eventType ?? '事件'} · ${formatFrameTime(action.durationMs ?? 0)}`;
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
  const { name, executionLabel } = resolveTimelineActionRuntimeIdentity(action);
  const status =
    readiness.status === 'blocked'
      ? '不可执行'
      : readiness.status === 'ready-with-unresolved-conditions'
        ? '条件待确认'
        : '可执行';
  const derived = isSwitchTriggeredDerivedAction(action)
    ? '切人自动派生 · 只读'
    : null;
  return [name ?? action.id, executionLabel, derived, status]
    .filter(Boolean)
    .join(' · ');
}

function resolveTimelineActionRuntimeIdentity(action) {
  const binding = resolveVerifiedActionRuntimeResolution(
    props.verifiedCombatRuntime,
    action.id
  )?.actionBinding;
  const selection =
    props.verifiedCombatRuntime?.specialResourceRuntime?.selectionByActionId?.get?.(
      action.id
    ) ?? null;
  const selectedInputOption = selection?.inputSelector?.options?.find(
    option => option.selectorIdentity === selection?.selectedInputIdentity
  );
  const controlSkillId =
    binding?.executionControlSkillId ?? binding?.controlSkillId;
  return {
    name:
      action.runtimeSemanticName ??
      action.attackInput?.semanticName ??
      selectedInputOption?.label ??
      selection?.semanticName ??
      binding?.semanticName ??
      action.name,
    executionLabel:
      controlSkillId == null
        ? null
        : `control ${controlSkillId}/sub${binding?.selectedSubSkillIndex ?? 0}`,
  };
}

function formatCooldownWindowTitle(window) {
  return `${window.actionName} · CD ${msToFrame(window.startMs)}F-${msToFrame(window.endMs)}F · ${formatCooldownWindowStatus(window)} · 槽位 ${window.chargeIndex + 1}/${window.cooldownCount}`;
}

function formatCooldownWindowStatus(window) {
  if (window.trackingStatus === 'applied-to-readiness') return '就绪生效';
  return window.trackingStatus ? '追踪' : 'CD';
}

function resolveActionLaneId(action) {
  return resolveTimelineActionLaneId(
    action,
    actorLaneIds.value,
    kiboLaneIdByActorId.value
  );
}

function selectTimelineCurveNode(lane, point) {
  if (['tuning-mark', 'special-resource'].includes(lane?.curve?.curveKind)) {
    if (point.actionId) {
      emit('select-action', { actionId: point.actionId, mode: 'replace' });
    }
    emitTimelineFrame({
      frameIndex: point.frameIndex,
      timeMs: point.timeMs,
      source:
        lane.curve.curveKind === 'special-resource'
          ? 'timeline-special-resource-curve'
          : 'timeline-tuning-mark-curve',
    });
    return;
  }
  selectRuntimeCurveBreakpoint(point);
}

function selectRuntimeCurveBreakpoint(point) {
  const timelineFrame = {
    frameIndex: point.frameIndex,
    timeMs: point.timeMs,
    statePointId: point.statePointId,
    source: 'timeline-runtime-curve',
  };
  if (point.statePointId) {
    emit(
      'dispatch-flow-action',
      mainFlowActionSurface.value.createRuntimeSelectionFlowAction({
        source: 'timeline-runtime-curve',
        actionId: point.actionId,
        statePointId: point.statePointId,
        payload: {
          statePointIds: point.statePointIds,
          preserveStateCurveFilters: true,
          timelineFrame,
        },
      })
    );
  }
  emitTimelineFrame(timelineFrame);
}

function isTimelineCurveNodeSelected(lane, point) {
  if (['tuning-mark', 'special-resource'].includes(lane?.curve?.curveKind)) {
    return Boolean(
      point.actionId &&
      point.actionId === flowSelectedActionId.value &&
      Number(point.frameIndex) === Number(timelineCursor.value.frameIndex)
    );
  }
  return point.statePointIds.includes(flowSelectedStateCurvePointId.value);
}

function runtimeCurveNodeStyle(point) {
  return {
    left: `${point.xPercent}%`,
    top: `${point.yPercent}%`,
  };
}

function timelineCurveStyle(lane) {
  return lane?.curve?.color ? { color: lane.curve.color } : {};
}

function formatTimelineCurveNodeTitle(lane, point) {
  if (lane?.curve?.curveKind === 'special-resource') {
    const operationLabels = {
      gain: '获取',
      consume: '消耗',
      'set-to-capacity': '补满',
      clear: '清空',
      transform: '转化',
      'transform-remove': '退出形态',
      expire: '到期',
    };
    const operations = (point.eventKinds ?? [])
      .map(kind => operationLabels[kind] ?? kind)
      .join(' / ');
    return `${point.frameIndex}F · ${lane.curve.resourceName}${operations ? ` ${operations}` : ''} · ${formatCompactNumber(
      point.beforeValue
    )} -> ${formatCompactNumber(point.afterValue)}`;
  }
  if (lane?.curve?.curveKind !== 'tuning-mark') {
    return formatRuntimeCurveNodeTitle(point);
  }
  const kindLabels = {
    acquire: '获取',
    consume: '消耗',
    expire: '到期',
  };
  const eventText = (point.eventKinds ?? [])
    .map(kind => kindLabels[kind] ?? kind)
    .join(' / ');
  return `${point.frameIndex}F · ${lane.curve.elementName}印记${eventText ? ` ${eventText}` : ''} · ${formatCompactNumber(
    point.beforeValue
  )} -> ${formatCompactNumber(point.afterValue)}`;
}

function formatRuntimeCurveNodeTitle(point) {
  const eventText =
    point.eventCount > 1 ? `${point.eventCount} 个变化` : '状态变化';
  return `${point.frameIndex}F · ${eventText} · ${formatCompactNumber(
    point.beforeValue
  )} -> ${formatCompactNumber(point.afterValue)}`;
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
    previewKey: '',
  };

  window.addEventListener('pointermove', handleDragMove);
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
}

function beginEditableDrag(event, action) {
  if (isSwitchTriggeredDerivedAction(action)) return;
  beginDrag(event, action);
}

function beginResize(event, action) {
  if (isSwitchTriggeredDerivedAction(action)) return;
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

function nudgeEditableAction(event, action, direction) {
  if (isSwitchTriggeredDerivedAction(action)) return;
  nudgeAction(event, action, direction);
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

  let targetLaneId = dragState.value.targetLaneId;
  if (dragState.value.canChangeLane) {
    const draggedActions = resolveDraggedActions(dragState.value);
    targetLaneId = resolveLegalBatchLaneAtPoint(
      event.clientY,
      draggedActions,
      actionsById.value.get(dragState.value.actionId)
    );
  }

  const deltaMs =
    ((event.clientX - dragState.value.initialClientX) /
      dragState.value.laneWidth) *
    props.durationMs;
  const currentOffsetMs = clampNumber(
    snapTimeMs(deltaMs),
    dragState.value.minOffsetMs,
    dragState.value.maxOffsetMs
  );
  const targetMoveLaneId =
    targetLaneId && targetLaneId !== dragState.value.initialLaneId
      ? targetLaneId
      : null;
  const previewKey =
    String(currentOffsetMs) + ':' + String(targetMoveLaneId ?? '');
  const shouldEmitPreview = previewKey !== dragState.value.previewKey;
  dragState.value = {
    ...dragState.value,
    targetLaneId,
    currentOffsetMs,
    previewKey,
  };
  if (shouldEmitPreview) {
    emit('preview-action-placement', {
      kind: 'move',
      actionIds: dragState.value.actionIds,
      primaryActionId: dragState.value.actionId,
      offsetMs: currentOffsetMs,
      targetLaneId: targetMoveLaneId,
    });
  }
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
  emit('clear-action-placement-preview');
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
      '.action-block, .switch-event-marker, .action-relation-hit, .cycle-boundary, .cooldown-window, .effect-interval, .timeline-state-curve-node, .timeline-frame-cursor'
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
  if (action?.type === 'switch') {
    return timelineCursor.value.frameIndex === msToFrame(startMs);
  }
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

function deleteEditableActionSelection(action) {
  if (isSwitchTriggeredDerivedAction(action)) return;
  deleteActionSelection(action);
}

function openActionContextMenu(event, action) {
  emit('open-action-context-menu', {
    actionId: action.id,
    x: event.clientX,
    y: event.clientY,
    targetStartMs: action.startMs,
  });
}

function openEditableActionContextMenu(event, action) {
  if (isSwitchTriggeredDerivedAction(action)) return;
  openActionContextMenu(event, action);
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

function isRelationSelected(relation) {
  return relation.kind === 'sequence'
    ? relation.id === props.selectedActionRelationId
    : relation.id === props.selectedActionEffectRelationId;
}

function selectTimelineRelation(relation) {
  if (relation.kind === 'sequence') {
    selectActionRelation(relation.id);
    return;
  }
  emit('select-action-effect-relation', relation.id);
}

function openTimelineRelationContextMenu(event, relation) {
  if (relation.kind === 'sequence') {
    openActionRelationContextMenu(event, relation.id);
  }
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
    event.target?.closest?.(
      '.action-block, .switch-event-marker, .action-relation-hit, .cooldown-window, .effect-interval'
    )
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

function handleTimelineDurationChange(event) {
  const select = event?.target;
  emit('update-duration', Number(select?.value));
  void nextTick().then(() => {
    if (select?.isConnected) {
      select.value = String(props.durationMs);
    }
  });
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
  const startMs = resolveTimelineEntryDropStartMs(event, lane);
  const previewKey =
    lane.id +
    ':' +
    String(startMs) +
    ':' +
    String(entry.skillId ?? entry.eventType ?? entry.type);
  if (previewKey !== timelineEntryPlacementPreviewKey.value) {
    timelineEntryPlacementPreviewKey.value = previewKey;
    emit('preview-action-placement', {
      kind: 'insert',
      entry,
      laneId: lane.id,
      startMs,
    });
  }
}

function handleTimelineEntryDragLeave(event, lane) {
  if (
    externalDropTargetLaneId.value === lane.id &&
    !event.currentTarget?.contains?.(event.relatedTarget)
  ) {
    externalDropTargetLaneId.value = '';
    timelineEntryPlacementPreviewKey.value = '';
    emit('clear-action-placement-preview');
  }
}

function handleTimelineEntryDrop(event, lane) {
  const entry = resolveTimelineEntryDrag(event);
  if (!isWorkbenchTimelineEntryAllowedInLane(entry, lane)) {
    return;
  }
  event.preventDefault();
  const startMs = resolveTimelineEntryDropStartMs(event, lane);
  emit('insert-timeline-entry', {
    entry,
    laneId: lane.id,
    laneKind: lane.kind,
    actorId: lane.actorId ?? null,
    startMs,
  });
  externalDropTargetLaneId.value = '';
  timelineEntryPlacementPreviewKey.value = '';
  emit('clear-action-placement-preview');
}

function resolveTimelineEntryDropStartMs(event, lane) {
  const rect = laneRowRefs.get(lane.id)?.getBoundingClientRect?.();
  return rect?.width
    ? clampNumber(
        snapTimeMs(
          ((event.clientX - rect.left) / rect.width) * props.durationMs
        ),
        0,
        props.durationMs - WORKBENCH_FRAME_MS
      )
    : 0;
}

function resolveTimelineEntryDrag(event) {
  const dataTransfer = event?.dataTransfer;
  return (
    timelineShelfEntryDrag.value ??
    parseWorkbenchTimelineEntry(
      dataTransfer?.getData?.(WORKBENCH_TIMELINE_ENTRY_MIME) ||
        dataTransfer?.getData?.('text/plain')
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
  timelineEntryPlacementPreviewKey.value = '';
  emit('clear-action-placement-preview');
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
  emit('clear-action-placement-preview');
});
</script>

<style scoped>
.panel {
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 4px;
  background: #1c2228;
}

.timeline-panel {
  --timeline-scrollbar-clearance-height: 20px;

  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.panel-title {
  position: relative;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 6px;
  min-height: 42px;
  padding: 6px 10px;
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

.timeline-placement-mode {
  display: inline-grid;
  grid-template-columns: repeat(2, 42px);
  height: 28px;
  padding: 2px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  background: rgba(5, 9, 12, 0.48);
}

.timeline-placement-mode button {
  min-width: 0;
  border: 0;
  border-radius: 2px;
  background: transparent;
  color: #91a0a9;
  font-size: 11px;
  line-height: 22px;
  cursor: pointer;
}

.timeline-placement-mode button:hover,
.timeline-placement-mode button:focus-visible {
  color: #d7e5e8;
}

.timeline-placement-mode button.active {
  background: #2d6d69;
  color: #f4ffff;
}

.timeline-view-options {
  position: relative;
  z-index: 32;
}

.timeline-view-options summary {
  display: inline-flex;
  min-height: 24px;
  align-items: center;
  gap: 4px;
  padding: 0 7px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 4px;
  background: #171d22;
  color: #cbd4d9;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  list-style: none;
}

.timeline-view-options summary::-webkit-details-marker {
  display: none;
}

.timeline-view-options[open] summary {
  border-color: #79c7b9;
  color: #edfffb;
}

.timeline-view-options-menu {
  position: absolute;
  top: calc(100% + 7px);
  right: 0;
  display: grid;
  width: min(560px, calc(100vw - 32px));
  gap: 9px;
  padding: 10px;
  border: 1px solid rgba(121, 199, 185, 0.34);
  border-radius: 4px;
  background: #10161b;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.5);
}

.timeline-cursor-readout {
  min-width: 92px;
  color: #dff6f1;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  text-align: center;
  white-space: nowrap;
}

.controlled-actor-readout {
  min-width: 118px;
  padding: 5px 8px;
  border: 1px solid rgba(121, 199, 185, 0.28);
  border-radius: 4px;
  background: #182521;
  color: #d9f5ef;
  font-size: 11px;
  font-weight: 700;
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

.timeline-duration-control {
  display: inline-flex;
  min-height: 24px;
  align-items: center;
  gap: 4px;
  color: #8f9aa3;
  font-size: 10px;
  white-space: nowrap;
}

.timeline-duration-control select {
  height: 24px;
  padding: 0 18px 0 6px;
  border: 1px solid rgba(121, 199, 185, 0.3);
  border-radius: 3px;
  background: #151d22;
  color: #d7e2e5;
  font: inherit;
  font-size: 11px;
}

.timeline-scale {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: 188px minmax(0, 1fr);
  gap: 0;
  padding: 7px 10px 0;
  overflow-y: scroll;
  scrollbar-color: transparent transparent;
  scrollbar-gutter: stable;
  color: #8f9aa3;
  font-size: 12px;
}

.timeline-scale::-webkit-scrollbar-thumb,
.timeline-scale::-webkit-scrollbar-track {
  background: transparent;
}

.scale-spacer {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 10px 12px 0 0;
  border-bottom: 1px solid #303941;
  color: #aab3ba;
  font-size: 11px;
  font-weight: 600;
}

.scale-viewport,
.timeline-viewport {
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
}

.timeline-viewport {
  overflow-x: scroll;
}

.scale-viewport {
  scrollbar-width: none;
}

.scale-viewport::-webkit-scrollbar {
  display: none;
}

.operation-axis-slot {
  position: relative;
  width: 100%;
  min-width: 100%;
  min-height: 35px;
}

.scale-track {
  position: relative;
  height: 18px;
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
  position: absolute;
  top: 0;
  white-space: nowrap;
  transform: translateX(-50%);
}

.scale-track span:first-child {
  transform: none;
}

.scale-track span:last-of-type {
  transform: translateX(-100%);
}

.timeline-shell {
  display: grid;
  min-height: 0;
  flex: 1 1 auto;
  grid-template-columns: 188px minmax(0, 1fr);
  gap: 0;
  margin: 7px 10px 10px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.lane-labels,
.timeline-lane {
  display: grid;
  align-content: start;
  gap: 3px;
  min-width: 100%;
}

.timeline-lane {
  position: relative;
}

.timeline-scrollbar-clearance {
  height: var(--timeline-scrollbar-clearance-height);
  min-height: var(--timeline-scrollbar-clearance-height);
  box-sizing: border-box;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  background: #11171c;
  pointer-events: none;
}

.timeline-scrollbar-clearance.label-clearance {
  border-right: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0 0 0 4px;
}

.timeline-scrollbar-clearance.track-clearance {
  min-width: 100%;
  margin-top: 3px;
  border-radius: 0 0 4px;
}

.timeline-export-mode .timeline-viewport {
  scrollbar-width: none;
}

.timeline-export-mode .timeline-viewport::-webkit-scrollbar {
  display: none;
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

.action-relation[class*='kind-effect-'] {
  color: #7eb0ff;
}

.action-relation.kind-effect-consume {
  color: #ff8792;
}

.action-relation[class*='kind-effect-'] .action-relation-path {
  stroke: currentColor;
}

.action-relation[class*='kind-effect-'] .action-relation-endpoint {
  fill: currentColor;
}

.action-relation.kind-effect-refresh .action-relation-path,
.action-relation.kind-effect-consume .action-relation-path {
  stroke-dasharray: 4 2;
}

.action-relation.status-unsatisfied .action-relation-path,
.action-relation.status-blocked .action-relation-path,
.action-relation.status-invalid .action-relation-path {
  opacity: 0.55;
  stroke-dasharray: 2 3;
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

.action-placement-guide {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 6;
  width: 0;
  border-left: 1px dashed currentColor;
  color: #70d6b7;
  pointer-events: none;
}

.action-placement-guide.suggested {
  border-left-style: solid;
  border-left-width: 2px;
}

.action-placement-guide.status-adjustable {
  color: #f2c56b;
}

.action-placement-guide.status-blocked {
  color: #ef767a;
}

.action-placement-guide.status-unresolved {
  color: #9aa7b0;
}

.action-placement-guide span {
  position: absolute;
  top: 2px;
  left: 3px;
  padding: 1px 3px;
  border-radius: 2px;
  background: rgba(11, 15, 18, 0.9);
  color: currentColor;
  font-size: 9px;
  line-height: 13px;
  white-space: nowrap;
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
  position: relative;
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 64px;
  padding: 5px 10px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-right-color: rgba(255, 255, 255, 0.14);
  border-radius: 4px 0 0 4px;
  background: #151b20;
}

.lane-label > span:not(.lane-avatar) {
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lane-label small {
  color: #8f9aa3;
  font-size: 11px;
}

.lane-label.identity {
  border-left: 3px solid var(--lane-accent);
}

.lane-label.identity[role='button'] {
  cursor: pointer;
}

.lane-label.identity:hover,
.lane-label.identity:focus-visible,
.lane-label.identity.active {
  border-color: color-mix(in srgb, var(--lane-accent) 72%, white 28%);
  background: color-mix(in srgb, var(--lane-accent) 12%, #151b20 88%);
  outline: none;
}

.lane-label.identity.controlled-actor {
  border-color: color-mix(in srgb, var(--lane-accent) 82%, white 18%);
  box-shadow: inset 3px 0 0 var(--lane-accent);
  background: color-mix(in srgb, var(--lane-accent) 16%, #151b20 84%);
}

.lane-avatar {
  position: relative;
  display: grid;
  width: 46px;
  height: 46px;
  flex: 0 0 46px;
  place-items: center;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--lane-accent) 64%, #ffffff 36%);
  border-radius: 4px;
  background: color-mix(in srgb, var(--lane-accent) 22%, #10151a 78%);
  color: #f4fbff;
  font-size: 16px;
  font-weight: 800;
}

.lane-avatar-command {
  padding: 0;
  font: inherit;
  cursor: pointer;
}

.lane-label[data-lane-kind='actor-action'] {
  align-items: flex-start;
  min-height: 164px;
  padding: 8px 7px 120px;
}

.lane-label[data-lane-kind='actor-action'] .lane-avatar {
  width: 44px;
  height: 44px;
  flex-basis: 44px;
}

.lane-avatar img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lane-avatar img.missing {
  display: none;
}

.enemy-avatar {
  border-radius: 50%;
  color: #ffe5e8;
}

.lane-identity-copy,
.lane-subtrack-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.lane-identity-command,
.lane-direct-identity {
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.lane-identity-command {
  padding: 2px 0;
}

.lane-direct-identity {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 9px;
  padding: 0;
}

.lane-avatar-command:hover,
.lane-avatar-command:focus-visible,
.lane-identity-command:hover,
.lane-identity-command:focus-visible,
.lane-direct-identity:hover,
.lane-direct-identity:focus-visible,
.lane-loadout-slot:hover,
.lane-loadout-slot:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--lane-accent) 74%, white 26%);
  outline-offset: 1px;
}

.lane-loadout-rack {
  position: absolute;
  right: 5px;
  bottom: 3px;
  left: 5px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(0, 1fr));
  gap: 4px;
  height: 110px;
}

.lane-loadout-slot {
  position: relative;
  display: grid;
  min-width: 0;
  padding: 0;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 2px;
  background: #0e1418;
  color: #7f8b91;
  font-size: 10px;
  font-weight: 800;
  cursor: pointer;
}

.lane-loadout-slot.equipped {
  border-color: color-mix(in srgb, var(--lane-accent) 64%, white 36%);
  color: #e8f5f3;
}

.lane-loadout-slot img,
.lane-kibo-icon img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.lane-loadout-slot img.missing,
.lane-kibo-icon img.missing {
  display: none;
}

.lane-identity-copy strong,
.lane-subtrack-copy strong {
  overflow: hidden;
  color: #f3f7f8;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lane-identity-copy small,
.lane-subtrack-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lane-slot-index {
  position: absolute;
  top: 5px;
  right: 7px;
  color: color-mix(in srgb, var(--lane-accent) 62%, #7f8991 38%);
  font-size: 9px;
  font-style: normal;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.lane-kibo-mark,
.lane-curve-mark {
  width: 9px;
  height: 9px;
  flex: 0 0 9px;
  border: 1px solid color-mix(in srgb, var(--lane-accent) 72%, white 28%);
  border-radius: 50%;
  background: color-mix(in srgb, var(--lane-accent) 64%, #142019 36%);
  box-shadow: 0 0 7px color-mix(in srgb, var(--lane-accent) 38%, transparent);
}

.lane-kibo-icon {
  position: relative;
  display: grid;
  width: 21px;
  height: 21px;
  flex: 0 0 21px;
  place-items: center;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--lane-accent) 58%, white 42%);
  border-radius: 3px;
  background: #101817;
  color: #9fd5cb;
  font-size: 9px;
  font-weight: 800;
}

.lane-kibo-command {
  gap: 7px;
}

.lane-curve-mark {
  height: 3px;
  border: 0;
  border-radius: 2px;
  background: currentColor;
  box-shadow: none;
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
  padding: 2px 10px 2px 18px;
}

.lane-label.curve {
  border-color: rgba(118, 149, 177, 0.28);
  background: #161d24;
  color: #a6b7ff;
}

.lane-label[data-lane-kind='tuning-mark-curve'],
.lane-label[data-lane-kind='tuning-mark-empty'] {
  gap: 7px;
  padding: 2px 9px 2px 14px;
  border-color: rgba(184, 171, 132, 0.24);
  background: #191b1c;
  color: var(--lane-accent);
}

.lane-label[data-lane-kind='tuning-mark-curve'] strong,
.lane-label[data-lane-kind='tuning-mark-empty'] strong {
  font-size: 11px;
}

.lane-label[data-lane-kind='tuning-mark-curve'] small,
.lane-label[data-lane-kind='tuning-mark-empty'] small {
  font-size: 9px;
}

.lane-row {
  position: relative;
  min-height: 110px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0 4px 4px 0;
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

.controlled-actor-interval {
  position: absolute;
  inset-block: 0;
  z-index: 0;
  min-width: 1px;
  border-top: 2px solid var(--controlled-actor-accent);
  background: color-mix(
    in srgb,
    var(--controlled-actor-accent) 13%,
    transparent
  );
  pointer-events: none;
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

.lane-row[data-lane-kind='tuning-mark-curve'],
.lane-row[data-lane-kind='tuning-mark-empty'] {
  background:
    repeating-linear-gradient(
      90deg,
      rgba(184, 171, 132, 0.05) 0,
      rgba(184, 171, 132, 0.05) 1px,
      transparent 1px,
      transparent 10%
    ),
    #151819;
}

.timeline-state-curve {
  position: absolute;
  inset: 7px 0;
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
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.timeline-state-curve-node {
  position: absolute;
  z-index: 2;
  width: 8px;
  height: 8px;
  padding: 0;
  border: 2px solid #11171d;
  border-radius: 50%;
  background: currentColor;
  color: inherit;
  transform: translate(-50%, -50%);
  cursor: pointer;
}

.timeline-state-curve-node:hover,
.timeline-state-curve-node:focus-visible,
.timeline-state-curve-node.selected {
  border-color: #ffffff;
  outline: none;
  transform: translate(-50%, -50%) scale(1.375);
}

.timeline-state-curve .timeline-state-curve-cursor {
  fill: #ffffff;
  stroke: currentColor;
  stroke-width: 1.5;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}

.timeline-state-curve.curve-enemyHpDamage {
  color: #ef767a;
}

.timeline-state-curve.curve-enemyToughnessDamage {
  color: #e8c36a;
}

.timeline-state-curve.curve-kiboEnergyChange {
  color: #70d6b7;
}

.lane-row[data-lane-kind='tuning-mark-curve'] .timeline-state-curve {
  inset: 4px 0;
}

.lane-row[data-lane-kind='tuning-mark-curve'] .timeline-state-curve-node {
  width: 7px;
  height: 7px;
  border-width: 1px;
  border-color: #151819;
}

.action-block {
  position: absolute;
  top: 4px;
  display: block;
  box-sizing: border-box;
  container-name: timeline-action;
  container-type: inline-size;
  height: 42px;
  min-width: 1px;
  padding: 0;
  overflow: hidden;
  border: 1px solid rgba(121, 199, 185, 0.5);
  border-radius: 6px;
  background: linear-gradient(180deg, #274840 0%, #20352f 100%);
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28);
  cursor: pointer;
  z-index: 2;
}

.action-placement-ghost {
  position: absolute;
  z-index: 6;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  height: 42px;
  min-width: 36px;
  padding: 4px 6px;
  overflow: hidden;
  border: 1px solid #70d6b7;
  border-radius: 5px;
  background: rgba(34, 84, 74, 0.9);
  color: #f3fffd;
  box-shadow: 0 0 0 1px rgba(112, 214, 183, 0.24);
  pointer-events: none;
}

.action-placement-ghost.status-adjustable {
  border-color: #f2c56b;
  background: rgba(101, 78, 31, 0.92);
  box-shadow: 0 0 0 1px rgba(242, 197, 107, 0.24);
}

.action-placement-ghost.status-blocked {
  border-color: #ef767a;
  background: rgba(105, 39, 44, 0.92);
  box-shadow: 0 0 0 1px rgba(239, 118, 122, 0.24);
}

.action-placement-ghost.status-unresolved {
  border-color: #9aa7b0;
  background: rgba(62, 71, 78, 0.92);
}

.action-placement-ghost img {
  width: 18px;
  height: 18px;
  object-fit: cover;
}

.action-placement-ghost strong {
  min-width: 0;
  overflow: hidden;
  font-size: 10px;
  line-height: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-placement-ghost small {
  color: inherit;
  font-size: 9px;
  opacity: 0.78;
}

.action-block.cursor-active {
  border-color: rgba(255, 255, 255, 0.92);
  box-shadow:
    0 0 0 2px rgba(121, 199, 185, 0.28),
    0 12px 30px rgba(0, 0, 0, 0.28);
}

.cooldown-window {
  position: absolute;
  z-index: 3;
  display: grid;
  box-sizing: border-box;
  min-width: 16px;
  height: 16px;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px;
  padding: 1px 5px 1px 2px;
  overflow: hidden;
  border: 1px solid rgba(242, 179, 102, 0.72);
  border-radius: 3px;
  background: #493b2b;
  color: #fff3dc;
  cursor: pointer;
  font: inherit;
  font-size: 9px;
  letter-spacing: 0;
  text-align: left;
}

.cooldown-window:hover,
.cooldown-window:focus {
  border-color: rgba(255, 255, 255, 0.9);
  outline: none;
}

.cooldown-window-glyph {
  display: inline-grid;
  width: 20px;
  height: 12px;
  place-items: center;
  border-radius: 2px;
  background: rgba(8, 12, 16, 0.38);
  color: #ffd291;
  font-size: 8px;
  font-weight: 900;
  line-height: 1;
}

.cooldown-window-label {
  min-width: 0;
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cooldown-window small {
  color: #ffd9a4;
  font-size: 8px;
  white-space: nowrap;
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

.effect-interval-meta {
  display: inline-flex;
  min-width: 0;
  gap: 3px;
  overflow: hidden;
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
  width: 3px;
  height: 6px;
  background: #79c7b9;
  transform: translateX(-1.5px);
}

.effect-lifecycle-marker.consume,
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

.action-block.derived-readonly {
  border-style: dashed;
  border-color: rgba(242, 179, 102, 0.74);
  background: #3d352b;
  cursor: default;
}

.action-block.derived-readonly.selected {
  box-shadow:
    0 0 0 2px rgba(242, 179, 102, 0.24),
    0 8px 20px rgba(0, 0, 0, 0.24);
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

.action-block.dragging {
  cursor: grabbing;
}

.action-block.resizing {
  cursor: ew-resize;
}

.action-block.has-result-edit {
  padding-right: 0;
}

.action-kind-icon {
  width: 16px;
  height: 16px;
  color: #baf1e6;
}

.action-block > .action-kind-icon {
  position: absolute;
  top: 50%;
  left: 5px;
  transform: translateY(-50%);
}

.action-image-icon {
  width: 26px;
  height: 26px;
  object-fit: contain;
  border-radius: 4px;
  background: rgba(4, 10, 14, 0.46);
}

.action-block-copy {
  position: absolute;
  inset: 4px 4px 4px 37px;
  display: grid;
  min-width: 0;
  gap: 1px;
  align-content: center;
}

.action-block.has-result-edit .action-block-copy {
  right: 46px;
}

.action-block-copy strong,
.action-block small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-block-copy strong {
  font-size: 11px;
}

.action-block small {
  color: #b8d8d2;
  font-size: 9px;
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

.action-block.readiness-blocked {
  border-color: rgba(245, 108, 108, 0.92);
  background: linear-gradient(180deg, #543033 0%, #3f2528 100%);
}

.action-block.readiness-unresolved {
  border-color: rgba(242, 179, 102, 0.76);
  background: linear-gradient(180deg, #4b4231 0%, #393225 100%);
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

@container timeline-action (max-width: 44px) {
  .action-block-copy,
  .timeline-action-result-edit-button,
  .duration-handle,
  .overlap-badge,
  .auto-delay-badge {
    display: none;
  }

  .action-block > .action-kind-icon {
    left: 50%;
    width: 20px;
    height: 20px;
    transform: translate(-50%, -50%);
  }
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
    flex-wrap: nowrap;
    margin-left: 0;
    padding-bottom: 2px;
    overflow-x: auto;
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
    grid-template-columns: 132px minmax(0, 1fr);
  }

  .timeline-shell {
    grid-template-columns: 132px minmax(0, 1fr);
  }

  .lane-label {
    gap: 6px;
    padding: 5px 7px;
  }

  .lane-label[data-lane-kind='actor-action'] {
    min-height: 164px;
    padding-right: 5px;
    padding-bottom: 92px;
    padding-left: 5px;
  }

  .lane-label:not([data-lane-kind='actor-action']) .lane-avatar {
    width: 34px;
    height: 34px;
    flex-basis: 34px;
  }

  .lane-label[data-lane-kind='actor-action'] .lane-avatar {
    width: 32px;
    height: 32px;
    flex-basis: 32px;
  }

  .lane-loadout-rack {
    right: 4px;
    left: 4px;
    gap: 3px;
    height: 82px;
  }

  .lane-identity-copy strong {
    font-size: 11px;
  }

  .lane-identity-copy small,
  .lane-subtrack-copy small {
    font-size: 9px;
  }

  .lane-slot-index {
    display: none;
  }
}
</style>
