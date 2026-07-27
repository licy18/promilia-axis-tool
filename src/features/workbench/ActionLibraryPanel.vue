<template>
  <section
    class="panel action-library"
    :class="{ 'fragment-mode': activeLibraryView === 'fragments' }"
    :data-library-view="activeLibraryView"
  >
    <div class="panel-title">
      <Collection class="panel-icon" />
      <h2>动作库</h2>
    </div>

    <div class="library-mode-switch" role="tablist" aria-label="动作库视图">
      <button
        type="button"
        role="tab"
        data-testid="workbench-action-library-tab"
        :aria-selected="activeLibraryView === 'actions'"
        :class="{ active: activeLibraryView === 'actions' }"
        @click="activeLibraryView = 'actions'"
      >
        动作
      </button>
      <button
        type="button"
        role="tab"
        data-testid="workbench-fragment-library-tab"
        :aria-selected="activeLibraryView === 'fragments'"
        :class="{ active: activeLibraryView === 'fragments' }"
        @click="activeLibraryView = 'fragments'"
      >
        片段
        <span>{{ timelineFragments.length }}</span>
      </button>
    </div>

    <WorkbenchTimelineFragmentLibrary
      v-if="activeLibraryView === 'fragments'"
      class="fragment-library-host"
      :fragments="timelineFragments"
      :selected-action-count="selectedActionIds.length"
      @save-fragment="$emit('save-timeline-fragment', $event)"
      @insert-fragment="$emit('insert-timeline-fragment', $event)"
      @duplicate-fragment="$emit('duplicate-timeline-fragment', $event)"
      @delete-fragment="$emit('delete-timeline-fragment', $event)"
      @export-library="$emit('export-timeline-fragment-library')"
      @import-library="$emit('import-timeline-fragment-library', $event)"
      @begin-fragment-drag="$emit('begin-timeline-fragment-drag', $event)"
    />

    <div class="actor-tabs" role="tablist" aria-label="动作库角色">
      <button
        v-for="teamActor in actors"
        :key="teamActor.id"
        class="actor-tab"
        :class="{
          active:
            Number(teamActor.characterId) === Number(activeActorCharacterId),
        }"
        type="button"
        data-testid="workbench-action-library-actor"
        :data-character-id="teamActor.characterId"
        :data-active="
          Number(teamActor.characterId) === Number(activeActorCharacterId)
            ? 'true'
            : 'false'
        "
        @click="$emit('update-active-actor', teamActor.characterId)"
      >
        <span>{{ teamActor.name }}</span>
        <small>{{ teamActor.role || '角色' }}</small>
      </button>
    </div>

    <div class="toolbox">
      <button
        class="icon-button"
        data-testid="workbench-add-action"
        type="button"
        :disabled="
          !defaultTimelineSkillEntry ||
          defaultTimelineSkillEntry.mechanicsClassification === 'loading'
        "
        :data-drag-enabled="
          Boolean(defaultTimelineSkillEntry) &&
          defaultTimelineSkillEntry.mechanicsClassification !== 'loading'
        "
        data-entry-type="skill"
        @pointerdown="beginDefaultSkillDrag"
        @click="$emit('add-skill-action', defaultTimelineSkillEntry)"
      >
        + 动作
      </button>
      <button
        class="icon-button"
        data-testid="workbench-add-wait-action"
        type="button"
        @click="$emit('add-wait-action')"
      >
        + 等待
      </button>
      <button
        class="icon-button"
        data-testid="workbench-add-switch-action"
        type="button"
        data-drag-enabled="true"
        data-entry-type="switch"
        @pointerdown="beginQuickTimelineEntryDrag($event, ACTION_TYPES.SWITCH)"
        @click="$emit('add-switch-action')"
      >
        + 切人
      </button>
      <button
        class="icon-button"
        data-testid="workbench-add-annotation-action"
        type="button"
        @click="$emit('add-annotation-action')"
      >
        + 注释
      </button>
      <button
        class="icon-button"
        data-testid="workbench-add-resource-action"
        type="button"
        data-drag-enabled="true"
        data-entry-type="resource"
        @pointerdown="
          beginQuickTimelineEntryDrag($event, ACTION_TYPES.RESOURCE)
        "
        @click="$emit('add-resource-action')"
      >
        + 资源
      </button>
      <button
        class="icon-button"
        data-testid="workbench-add-kibo-event-action"
        type="button"
        :data-drag-enabled="Boolean(defaultKiboTimelineEntry)"
        data-entry-type="kiboEvent"
        @pointerdown="
          beginQuickTimelineEntryDrag($event, ACTION_TYPES.KIBO_EVENT)
        "
        @click="$emit('add-kibo-event-action', defaultKiboTimelineEntry)"
      >
        + {{ activeKibo?.name ?? '奇波' }}
      </button>
      <button
        class="icon-button"
        data-testid="workbench-add-enemy-event-action"
        type="button"
        data-drag-enabled="true"
        data-entry-type="enemyEvent"
        @pointerdown="
          beginQuickTimelineEntryDrag($event, ACTION_TYPES.ENEMY_EVENT)
        "
        @click="$emit('add-enemy-event-action')"
      >
        + 敌人
      </button>
    </div>

    <div class="actor-block">
      <span>
        <strong class="actor-name">{{ actor.name }}</strong>
        <small
          class="actor-kibo"
          data-testid="workbench-action-library-kibo"
          :data-kibo-id="activeKibo?.id ?? ''"
          >奇波 · {{ activeKibo?.name ?? '未绑定' }}</small
        >
      </span>
      <span class="actor-role">{{ actor.role || '角色轨' }}</span>
    </div>

    <div v-if="actionEntries.length" class="skill-entry-list">
      <div
        v-for="entry in actionEntries"
        :key="entry.id"
        class="skill-entry-row"
      >
        <button
          class="skill-entry"
          type="button"
          data-testid="workbench-skill-entry"
          :data-skill-id="entry.skillId"
          :data-action-kind="entry.kind"
          :data-action-variant-index="entry.actionVariantIndex"
          :data-cooldown-ms="entry.cooldownMs ?? ''"
          :data-mechanics-classification="entry.mechanicsClassification"
          :data-timing-status="entry.timingStatus"
          :data-scheduling-status="entry.schedulingStatus"
          :data-attack-input-count="entry.attackInputSegments?.length ?? 0"
          :title="entry.mechanicsTooltip"
          :disabled="entry.mechanicsClassification === 'loading'"
          data-entry-type="skill"
          :data-drag-enabled="entry.mechanicsClassification !== 'loading'"
          @pointerdown="beginSkillTimelineEntryDrag($event, entry)"
          @click="$emit('add-skill-action', entry)"
        >
          <img
            v-if="actionEntryIconUrl(entry)"
            class="skill-entry-icon"
            :src="actionEntryIconUrl(entry)"
            alt=""
            aria-hidden="true"
          />
          <span class="skill-entry-copy">
            <span class="skill-entry-name">{{ entry.label }}</span>
            <span class="skill-entry-meta">{{
              formatActionEntryMeta(entry)
            }}</span>
          </span>
        </button>
      </div>
    </div>

    <div
      v-if="kiboTimelineEntries.length"
      class="skill-entry-list kibo-entry-list"
    >
      <div
        v-for="entry in kiboTimelineEntries"
        :key="entry.skillId"
        class="skill-entry-row"
      >
        <button
          class="skill-entry kibo-skill-entry"
          type="button"
          data-testid="workbench-kibo-action-entry"
          :data-kibo-id="activeKibo.id"
          :data-skill-id="entry.skillId"
          :data-action-kind="entry.eventType"
          :data-cooldown-ms="entry.cooldownMs ?? ''"
          :data-mechanics-classification="entry.mechanicsClassification"
          :data-timing-status="entry.timingStatus"
          :data-scheduling-status="entry.schedulingStatus"
          :title="entry.mechanicsTooltip"
          :disabled="entry.mechanicsClassification === 'loading'"
          data-entry-type="kiboEvent"
          :data-drag-enabled="entry.mechanicsClassification !== 'loading'"
          @pointerdown="beginKiboTimelineEntryDrag($event, entry)"
          @click="$emit('add-kibo-event-action', entry)"
        >
          <img
            v-if="actionEntryIconUrl(entry)"
            class="skill-entry-icon"
            :src="actionEntryIconUrl(entry)"
            alt=""
            aria-hidden="true"
          />
          <span class="skill-entry-copy">
            <span class="skill-entry-name">{{ entry.label }}</span>
            <span class="skill-entry-meta">{{
              formatKiboActionMeta(entry)
            }}</span>
          </span>
        </button>
      </div>
    </div>

    <section
      class="batch-summary-panel"
      data-testid="workbench-action-batch-summary-panel"
    >
      <div class="batch-summary-heading">
        <span>批次管理</span>
        <strong data-testid="workbench-action-batch-summary-count">{{
          actionBatches.length
        }}</strong>
      </div>
      <p
        v-if="actionBatches.length === 0"
        class="batch-summary-empty"
        data-testid="workbench-action-batch-summary-empty"
      >
        暂无生成批次
      </p>
      <article
        v-for="batch in actionBatches"
        :key="batch.batchId"
        class="batch-summary-item"
        :class="{ selected: batch.selected }"
        data-testid="workbench-action-batch-summary"
        :data-batch-id="batch.batchId"
        :data-selected="batch.selected ? 'true' : 'false'"
        :data-first-action-id="batch.firstActionId"
        tabindex="0"
        @click="selectBatchFirstAction(batch)"
        @keydown.enter="selectBatchFirstAction(batch)"
      >
        <div class="batch-summary-main">
          <div>
            <span>{{ batch.skillName }}</span>
            <strong>{{ batch.count }} 动作</strong>
          </div>
          <small
            >{{ batch.sourceLabel }} / {{ batch.minStartMs }}-{{
              batch.maxStartMs
            }}ms</small
          >
          <small>{{ batch.batchId }}</small>
        </div>
        <strong
          v-if="batch.selected"
          class="batch-selected-badge"
          data-testid="workbench-action-batch-selected"
        >
          选中
        </strong>
        <div class="batch-summary-actions">
          <button
            v-if="batch.hasRuntimeResult"
            class="tool-button"
            data-testid="workbench-summary-view-action-batch-result"
            type="button"
            :data-action-id="batch.firstResultActionId"
            :data-state-point-id="batch.firstResultStatePointId"
            @click.stop="focusBatchResult(batch)"
          >
            查看结果
          </button>
          <button
            class="tool-button"
            data-testid="workbench-summary-copy-action-batch"
            type="button"
            @click.stop="$emit('copy-action-batch', batch.batchId)"
          >
            复制批次
          </button>
          <button
            class="tool-button danger"
            data-testid="workbench-summary-delete-action-batch"
            type="button"
            @click.stop="$emit('delete-action-batch', batch.batchId)"
          >
            删批次
          </button>
          <button
            class="tool-button"
            data-testid="workbench-summary-shift-action-batch-earlier"
            type="button"
            @click.stop="emitBatchShift(batch.batchId, -batchShiftStepMs)"
          >
            -30f
          </button>
          <button
            class="tool-button"
            data-testid="workbench-summary-shift-action-batch-later"
            type="button"
            @click.stop="emitBatchShift(batch.batchId, batchShiftStepMs)"
          >
            +30f
          </button>
          <label class="batch-shift-control">
            <span>批次偏移 ms</span>
            <input
              type="number"
              step="100"
              data-testid="workbench-summary-batch-shift-offset-input"
              :data-batch-id="batch.batchId"
              :value="getBatchShiftOffset(batch.batchId)"
              @click.stop
              @input.stop="
                setBatchShiftOffset(batch.batchId, $event.target.value)
              "
            />
          </label>
          <button
            class="tool-button"
            data-testid="workbench-summary-apply-action-batch-shift"
            type="button"
            @click.stop="applyBatchShift(batch.batchId)"
          >
            应用偏移
          </button>
          <label class="batch-shift-control">
            <span>批次起点 ms</span>
            <input
              type="number"
              step="100"
              data-testid="workbench-summary-batch-align-start-input"
              :data-batch-id="batch.batchId"
              :value="getBatchAlignStart(batch.batchId)"
              @click.stop
              @input.stop="
                setBatchAlignStart(batch.batchId, $event.target.value)
              "
            />
          </label>
          <button
            class="tool-button"
            data-testid="workbench-summary-apply-action-batch-align"
            type="button"
            @click.stop="applyBatchAlign(batch.batchId)"
          >
            对齐起点
          </button>
        </div>
      </article>
    </section>

    <div class="action-list">
      <article
        v-for="action in actions"
        :key="action.id"
        class="action-item"
        :class="{
          selected: action.id === selectedActionId,
          'multi-selected': selectedActionIdSet.has(action.id),
          'batch-selected': isActionInSelectedBatch(action),
          'readiness-blocked': getActionReadiness(action).status === 'blocked',
          'readiness-unresolved':
            getActionReadiness(action).status ===
            'ready-with-unresolved-conditions',
        }"
        :data-action-id="action.id"
        :data-read-only="isActionReadOnly(action) ? 'true' : 'false'"
        :data-selected="selectedActionIdSet.has(action.id) ? 'true' : 'false'"
        :data-readiness-status="getActionReadiness(action).status"
        :data-readiness-executable="
          getActionReadiness(action).executable ? 'true' : 'false'
        "
        :data-batch-id="action.generationBatch?.batchId || ''"
        :data-batch-highlight="
          isActionInSelectedBatch(action) ? 'true' : 'false'
        "
        tabindex="0"
        @click="selectActionFromEvent($event, action.id)"
        @contextmenu.prevent="openEditableActionContextMenu($event, action)"
        @keydown.enter.prevent="selectActionFromEvent($event, action.id)"
        @keydown.delete.prevent="deleteEditableActionSelection(action)"
        @keydown.backspace.prevent="deleteEditableActionSelection(action)"
      >
        <div class="action-main">
          <span class="action-name">{{ action.name }}</span>
          <span class="action-time">{{ action.startMs }}ms</span>
          <span
            class="action-readiness"
            :data-readiness-status="getActionReadiness(action).status"
            data-testid="workbench-action-readiness"
          >
            {{ formatActionReadiness(action) }}
          </span>
        </div>
        <div v-if="!isActionReadOnly(action)" class="action-tools">
          <button
            v-if="getActionResultEditCommand(action).actionId === action.id"
            class="tool-button action-result-edit-button"
            data-testid="workbench-action-list-edit-result-action"
            type="button"
            :data-action-id="getActionResultEditCommand(action).actionId"
            :data-state-point-id="
              getActionResultEditCommand(action).statePointId
            "
            :disabled="!getActionResultEditCommand(action).enabled"
            @click.stop="focusActionResult(action)"
          >
            <EditPen class="tool-button-icon" />
            <span>编辑结果</span>
          </button>
          <button
            class="tool-button"
            data-testid="workbench-copy-action"
            type="button"
            @click.stop="$emit('copy-action', action.id)"
          >
            复制
          </button>
          <button
            class="tool-button danger"
            data-testid="workbench-delete-action"
            type="button"
            @click.stop="$emit('delete-action', action.id)"
          >
            删除
          </button>
        </div>
        <dl>
          <div>
            <dt>类型</dt>
            <dd>{{ actionTypeLabel(action.type) }}</dd>
          </div>
          <div>
            <dt>{{ actionDetailLabel(action) }}</dt>
            <dd>{{ actionDetailValue(action) }}</dd>
          </div>
          <div>
            <dt>冷却</dt>
            <dd>
              {{ formatActionCooldown(action) }}
            </dd>
          </div>
          <div>
            <dt>SP</dt>
            <dd>{{ getActionSpCost(action) ?? '-' }}</dd>
          </div>
          <div v-if="getActionReadiness(action).cooldown">
            <dt>可用次数</dt>
            <dd>{{ formatActionCooldownAvailability(action) }}</dd>
          </div>
        </dl>
        <p
          v-if="action.insertion?.autoDelayed"
          class="timing-note placement-note"
          data-testid="workbench-action-insert-delay-note"
        >
          {{ formatInsertionNote(action.insertion) }}
        </p>
        <p
          v-if="action.generationBatch?.batchId"
          class="timing-note batch-note"
          data-testid="workbench-action-batch-note"
        >
          {{ formatGenerationBatch(action.generationBatch) }}
        </p>
        <p v-if="action.timing?.needsTimingData" class="timing-note">
          {{ action.timing.source }}
        </p>
        <p v-else-if="action.note" class="timing-note neutral">
          {{ action.note }}
        </p>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { Collection, EditPen } from '@element-plus/icons-vue';
import WorkbenchTimelineFragmentLibrary from './WorkbenchTimelineFragmentLibrary.vue';
import { ACTION_TYPES } from '../../domain/projectSchema';
import { resolveWorkbenchActionScheduling } from '../../domain/workbenchActionScheduling';
import { getSkillActionCatalog } from '../../domain/workbenchProjectFactory';
import { createWorkbenchTimelineEntry } from '../../domain/workbenchTimelineEntry';
import { resolveWorkbenchActionIconUrl } from '../../domain/workbenchActionVisualIdentity';
import { formatFrameTime, frameToMs, msToFrame } from '../../domain/timebase';
import { getVerifiedCombatActionMapping } from '../../data/verifiedCombatMechanicsPackage';
const props = defineProps({
  actor: {
    type: Object,
    required: true,
  },
  actors: {
    type: Array,
    required: true,
  },
  kibos: {
    type: Array,
    default: () => [],
  },
  activeActorCharacterId: {
    type: Number,
    required: true,
  },
  actions: {
    type: Array,
    required: true,
  },
  mainFlowCommandSurface: {
    type: Object,
    default: null,
  },
  runtimeActionResults: {
    type: Object,
    default: () => ({}),
  },
  actionReadinessTimeline: {
    type: Object,
    default: () => ({ actions: [], cooldownWindows: [] }),
  },
  skills: {
    type: Array,
    required: true,
  },
  selectedActionId: {
    type: String,
    required: true,
  },
  selectedActionIds: {
    type: Array,
    default: () => [],
  },
  timelineFragments: {
    type: Array,
    default: () => [],
  },
  mechanicsRevision: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits([
  'select-action',
  'open-action-context-menu',
  'delete-selected-actions',
  'add-skill-action',
  'add-wait-action',
  'add-switch-action',
  'add-annotation-action',
  'add-resource-action',
  'add-kibo-event-action',
  'add-enemy-event-action',
  'copy-action',
  'copy-action-batch',
  'delete-action',
  'delete-action-batch',
  'dispatch-flow-action',
  'align-action-batch',
  'shift-action-batch',
  'update-active-actor',
  'begin-timeline-entry-drag',
  'save-timeline-fragment',
  'insert-timeline-fragment',
  'duplicate-timeline-fragment',
  'delete-timeline-fragment',
  'export-timeline-fragment-library',
  'import-timeline-fragment-library',
  'begin-timeline-fragment-drag',
]);

const activeLibraryView = ref('actions');
const batchAlignStarts = reactive({});
const batchShiftOffsets = reactive({});
const batchShiftStepMs = frameToMs(30);
const readinessByActionId = computed(
  () =>
    new Map(
      (props.actionReadinessTimeline?.actions ?? []).map(action => [
        action.actionId,
        action,
      ])
    )
);
const activeKibo = computed(() =>
  props.kibos.find(
    item => Number(item.id) === Number(props.actor.loadout?.kiboId)
  )
);

const actionEntries = computed(() => {
  void props.mechanicsRevision;
  return getSkillActionCatalog(props.skills, 1).map(entry =>
    annotateMechanicsCoverage(entry, ACTION_TYPES.SKILL)
  );
});
const defaultTimelineSkillEntry = computed(
  () =>
    actionEntries.value.find(
      entry => entry.mechanicsClassification !== 'loading'
    ) ?? null
);
const kiboTimelineEntries = computed(() =>
  (activeKibo.value?.actions ?? []).map(action =>
    annotateMechanicsCoverage(
      createWorkbenchTimelineEntry({
        type: ACTION_TYPES.KIBO_EVENT,
        kiboId: activeKibo.value?.id,
        skillId: action.skillId,
        icon: action.icon,
        eventType: action.kind,
        label: action.name,
        durationMs: null,
        cooldownMs: action.cooldownMs,
        timingSource: null,
        timingStatus: 'unresolved',
        timingReasons: ['verified-action-timing-not-loaded'],
        needsTimingData: true,
        note: '动作占轴等待 verified timing 合同。',
      }),
      ACTION_TYPES.KIBO_EVENT
    )
  )
);
const defaultKiboTimelineEntry = computed(
  () =>
    kiboTimelineEntries.value.find(
      entry => entry.mechanicsClassification !== 'loading'
    ) ?? null
);

function beginDefaultSkillDrag(event) {
  beginSkillTimelineEntryDrag(event, defaultTimelineSkillEntry.value);
}

function beginSkillTimelineEntryDrag(event, actionEntry) {
  beginActionLibraryTimelineEntryDrag(event, {
    ...actionEntry,
    type: ACTION_TYPES.SKILL,
  });
}

function beginKiboTimelineEntryDrag(event, entry) {
  beginActionLibraryTimelineEntryDrag(event, entry);
}

function beginQuickTimelineEntryDrag(event, type) {
  const quickEntryByType = {
    [ACTION_TYPES.SWITCH]: {
      type,
      label: '切人',
    },
    [ACTION_TYPES.RESOURCE]: {
      type,
      label: '资源',
    },
    [ACTION_TYPES.KIBO_EVENT]: defaultKiboTimelineEntry.value,
    [ACTION_TYPES.ENEMY_EVENT]: {
      type,
      eventType: 'phase',
      label: '敌人事件',
    },
  };
  beginActionLibraryTimelineEntryDrag(event, quickEntryByType[type]);
}

function beginActionLibraryTimelineEntryDrag(event, source) {
  if (!source || event.button !== 0) {
    return;
  }
  const entry = createWorkbenchTimelineEntry(source);
  if (!entry) {
    return;
  }
  emit('begin-timeline-entry-drag', {
    entry,
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY,
  });
}

const selectedBatchId = computed(() => {
  const selectedAction = props.actions.find(
    action => action.id === props.selectedActionId
  );
  return selectedAction?.generationBatch?.batchId ?? null;
});
const selectedActionIdSet = computed(
  () => new Set(props.selectedActionIds ?? [])
);

const actionBatches = computed(() => {
  const batches = new Map();

  props.actions.forEach(action => {
    const batch = action.generationBatch;
    if (!batch?.batchId) {
      return;
    }

    const startMs = Math.max(0, Number(action.startMs) || 0);
    const batchId = batch.batchId;
    const runtimeResult = getActionRuntimeResult(action.id);
    const existing = batches.get(batchId);
    if (existing) {
      existing.count += 1;
      if (startMs < existing.minStartMs) {
        existing.firstActionId = action.id;
      }
      if (
        runtimeResult?.statePointId &&
        startMs < existing.firstResultStartMs
      ) {
        existing.firstResultActionId = action.id;
        existing.firstResultStatePointId = runtimeResult.statePointId;
        existing.firstResultStartMs = startMs;
        existing.hasRuntimeResult = true;
      }
      existing.minStartMs = Math.min(existing.minStartMs, startMs);
      existing.maxStartMs = Math.max(existing.maxStartMs, startMs);
      existing.selected =
        existing.selected || action.id === props.selectedActionId;
      return;
    }

    batches.set(batchId, {
      batchId,
      count: 1,
      firstActionId: action.id,
      firstResultActionId: runtimeResult?.statePointId ? action.id : '',
      firstResultStatePointId: runtimeResult?.statePointId ?? '',
      firstResultStartMs: runtimeResult?.statePointId
        ? startMs
        : Number.POSITIVE_INFINITY,
      hasRuntimeResult: Boolean(runtimeResult?.statePointId),
      minStartMs: startMs,
      maxStartMs: startMs,
      selected: action.id === props.selectedActionId,
      skillName: resolveBatchSkillName(batch, action),
      sourceLabel: formatBatchSource(batch.source),
    });
  });

  return [...batches.values()].sort((left, right) => {
    if (left.minStartMs !== right.minStartMs) {
      return left.minStartMs - right.minStartMs;
    }
    return left.batchId.localeCompare(right.batchId);
  });
});

function selectBatchFirstAction(batch) {
  if (batch?.firstActionId) {
    emit('select-action', batch.firstActionId);
  }
}

function selectActionFromEvent(event, actionId) {
  emit('select-action', {
    actionId,
    mode: event.shiftKey
      ? 'range'
      : event.ctrlKey || event.metaKey
        ? 'toggle'
        : 'replace',
  });
}

function openActionContextMenu(event, actionId) {
  emit('open-action-context-menu', {
    actionId,
    x: event.clientX,
    y: event.clientY,
    targetStartMs:
      props.actions.find(action => action.id === actionId)?.startMs ?? 0,
  });
}

function openEditableActionContextMenu(event, action) {
  if (isActionReadOnly(action)) return;
  openActionContextMenu(event, action.id);
}

function deleteActionSelection(actionId) {
  const actionIds = selectedActionIdSet.value.has(actionId)
    ? props.selectedActionIds
    : [actionId];
  if (!selectedActionIdSet.value.has(actionId)) {
    emit('select-action', { actionId, mode: 'replace' });
  }
  emit('delete-selected-actions', { actionIds });
}

function deleteEditableActionSelection(action) {
  if (isActionReadOnly(action)) return;
  deleteActionSelection(action.id);
}

function isActionReadOnly(action) {
  return Boolean(action?.readOnly || action?.derivedAction?.readOnly);
}

function focusBatchResult(batch) {
  const actionId = batch?.firstResultActionId ?? '';
  const statePointId = batch?.firstResultStatePointId ?? '';
  if (!actionId || !statePointId) {
    return;
  }

  const action = props.mainFlowCommandSurface?.createRuntimeResultFlowAction?.({
    source: 'action-batch-summary-result',
    actionId,
    statePointId,
    enabled: true,
  }) ?? {
    kind: 'select-runtime-result',
    source: 'action-batch-summary-result',
    actionId,
    statePointId,
    canRun: true,
  };
  emit('dispatch-flow-action', action);
}

function getActionRuntimeResult(actionId) {
  return props.runtimeActionResults?.[actionId] ?? null;
}

function getActionReadiness(action) {
  return (
    readinessByActionId.value.get(action?.id) ?? {
      status: 'ready',
      executable: true,
      cooldown: null,
    }
  );
}

function formatActionReadiness(action) {
  const readiness = getActionReadiness(action);
  if (readiness.status === 'blocked') {
    return '不可执行';
  }
  if (readiness.status === 'ready-with-unresolved-conditions') {
    return '条件待确认';
  }
  return '可执行';
}

function formatActionCooldownAvailability(action) {
  const cooldown = getActionReadiness(action).cooldown;
  if (!cooldown) {
    return '-';
  }
  const suffix =
    cooldown.nextReadyAtMs == null
      ? ''
      : ` / ${msToFrame(cooldown.nextReadyAtMs)}F恢复`;
  return `${cooldown.availableBefore} -> ${cooldown.availableAfter}${suffix}`;
}

function isActionInSelectedBatch(action) {
  return Boolean(
    selectedBatchId.value &&
    action.generationBatch?.batchId === selectedBatchId.value
  );
}

function getActionResultEditCommand(action) {
  const command = props.mainFlowCommandSurface?.runtimeActionEdit ?? {};
  if (!action?.id || command.actionId !== action.id) {
    return {};
  }
  return command;
}

function focusActionResult(action) {
  const command = getActionResultEditCommand(action);
  if (!command.enabled || !command.action?.canRun) {
    return;
  }
  emit('dispatch-flow-action', command.action);
}

function actionTypeLabel(type) {
  if (type === 'wait') {
    return '等待';
  }
  if (type === 'annotation') {
    return '注释';
  }
  if (type === 'resource') {
    return '资源';
  }
  if (type === 'enemyEvent') {
    return '敌人';
  }
  if (type === 'kiboEvent') {
    return '奇波';
  }
  if (type === 'switch') {
    return '切人';
  }
  return '技能';
}

function actionDetailLabel(action) {
  if (action.type === 'skill') {
    return '动作';
  }
  if (action.type === 'resource') {
    return '变化';
  }
  if (action.type === 'enemyEvent') {
    return '事件';
  }
  if (action.type === 'kiboEvent') {
    return '事件';
  }
  if (action.type === 'switch') {
    return '目标';
  }
  return '时长';
}

function actionDetailValue(action) {
  if (action.type === 'skill') {
    if (!action.selectedDamageSegment) {
      return '待补';
    }
    return `${formatActionVariantPreview(action.selectedDamageSegment)} / ${formatFrameTime(action.durationMs ?? 0)}`;
  }
  if (action.type === 'resource') {
    return `${String(action.resource ?? 'sp').toUpperCase()} ${formatSigned(action.change)}`;
  }
  if (action.type === 'enemyEvent') {
    return action.eventType ?? 'phase';
  }
  if (action.type === 'kiboEvent') {
    const kibo = action.kiboId
      ? (props.kibos.find(item => Number(item.id) === Number(action.kiboId))
          ?.name ?? `奇波 ${action.kiboId}`)
      : '未配置奇波';
    return `${kibo} / ${action.eventType ?? 'activation'}`;
  }
  if (action.type === 'switch') {
    return action.targetActor?.name ?? action.targetCharacterId ?? '-';
  }
  return `${action.durationMs ?? 0}ms`;
}

function getActionCooldownMs(action) {
  const generatedCooldownMs = Number(
    action.statusGeneration?.cooldown?.durationMs
  );
  if (Number.isFinite(generatedCooldownMs) && generatedCooldownMs > 0) {
    return generatedCooldownMs;
  }
  return action.logicModel?.logic?.cooldownMs ?? action.cooldownMs ?? null;
}

function getActionCooldownCount(action) {
  return Math.max(
    1,
    Number(action.statusGeneration?.cooldown?.chargeCount) ||
      Number(action.logicModel?.logic?.cooldownCount) ||
      1
  );
}

function formatActionCooldown(action) {
  const cooldownMs = getActionCooldownMs(action);
  if (!cooldownMs) {
    return '-';
  }
  const chargeCount = getActionCooldownCount(action);
  return `${cooldownMs / 1000}s${chargeCount > 1 ? ` ×${chargeCount}` : ''}`;
}

function getActionSpCost(action) {
  return action.logicModel?.logic?.spCost ?? action.spCost ?? null;
}

function formatSigned(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? '+' : ''}${number}`;
}

function formatActionEntryMeta(entry) {
  const source =
    entry.sourceLabel && entry.sourceLabel !== entry.label
      ? `${entry.sourceLabel} / `
      : '';
  const cooldown =
    entry.cooldownMs || entry.kind === 'ultimate'
      ? ` / CD ${formatCatalogCooldown(entry.cooldownMs)}`
      : '';
  const duration = formatActionTiming(entry);
  return `${source}${entry.rawValue ?? '倍率待补'} / ${duration}${cooldown}${formatMechanicsCoverage(entry)}`;
}

function formatKiboActionMeta(entry) {
  const kindLabels = {
    signature: '特性技',
    active: '主动技',
    break: '合击技',
  };
  return `${kindLabels[entry.eventType] ?? '奇波动作'} / ${formatActionTiming(entry)} / CD ${formatCatalogCooldown(entry.cooldownMs)}${formatMechanicsCoverage(entry)}`;
}

function formatActionTiming(entry) {
  const durationMs = Number(entry.durationMs);
  return entry.timingStatus === 'applied' && durationMs > 0
    ? `${msToFrame(durationMs)}f ${formatFrameTime(durationMs)}`
    : entry.schedulingKind === 'source-animation-planning-duration'
      ? `动画规划 ${entry.planningDurationFrames}f`
      : `通用规划 ${entry.planningDurationFrames ?? 30}f`;
}

function annotateMechanicsCoverage(entry, type) {
  const mapping = getVerifiedCombatActionMapping({
    type,
    skillId: entry.skillId,
    actionVariantIndex: entry.actionVariantIndex ?? 0,
    kiboId: type === ACTION_TYPES.KIBO_EVENT ? activeKibo.value?.id : null,
    actor: {
      characterId: props.actor.characterId,
      loadout: props.actor.loadout,
    },
  });
  const mechanicsClassification = mapping?.classification ?? 'loading';
  const actionTiming = mapping?.actionTiming ?? null;
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
  const variantModelStatus = scheduling.variantModelStatus;
  const coverageMessages = [
    timingStatus !== 'applied'
      ? `可排轴；${formatActionTiming({
          timingStatus,
          durationMs: scheduling.durationMs,
          schedulingKind: scheduling.kind,
          planningDurationFrames: scheduling.planningDurationFrames,
        })}，不回写为 verified 时长`
      : '',
    formatVariantModelStatus(variantModelStatus),
    mechanicsClassification === 'unresolved'
      ? `三值未完整：${(mapping?.reasons ?? []).join('、')}`
      : '',
  ].filter(Boolean);
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
      actionTiming?.occupancy?.sourceIdentity ?? actionTiming?.sourceIdentity,
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
    attackInputSourceSegments:
      mapping?.attackInputSourceSegments ?? mapping?.attackInputSegments ?? [],
    mechanicsClassification,
    mechanicsTooltip: coverageMessages.join('；') || null,
  };
}

function formatVariantModelStatus(status) {
  if (status === 'partially-resolved') return '变体条件已部分解析';
  if (status === 'variant-condition-not-yet-modeled') {
    return '变体条件尚未纳入运行时模型';
  }
  if (status === 'static-evidence-gap') return '仍有静态证据缺口';
  if (status === 'runtime-dependent') return '分支依赖运行时状态';
  if (status === 'unresolved-control-identity') return 'control 身份仍待确认';
  return '';
}

function formatMechanicsCoverage(entry) {
  if (entry.mechanicsClassification === 'unresolved') return ' / 三值未完整';
  if (entry.mechanicsClassification === 'verified-zero') return ' / 三值无变化';
  return '';
}

function formatCatalogCooldown(value) {
  const cooldownMs = Number(value);
  return Number.isFinite(cooldownMs) && cooldownMs > 0
    ? `${cooldownMs / 1000}s`
    : '未提供';
}

function actionEntryIconUrl(entry) {
  return resolveWorkbenchActionIconUrl(entry.icon);
}

function resolveBatchSkillName(batch, action) {
  const skillId = Number(batch.skillId ?? action.skillId);
  const skill = props.skills.find(item => Number(item.id) === skillId);
  return skill?.name || action.name || `技能 ${skillId}`;
}

function formatBatchSource(source) {
  if (source === 'skill-segment-split') {
    return '旧动作形态生成';
  }
  if (source === 'skill-action-variant-split') {
    return '动作形态生成';
  }
  if (source === 'batch-copy') {
    return '批次复制';
  }
  return source || '批次生成';
}

function formatActionVariantPreview(action) {
  const hitCount = Number(action.hitModel?.hitCount) || 1;
  const hitSuffix = hitCount > 1 ? `；${hitCount} 段总倍率` : '';
  return `${action.displayLabel ?? action.label} / ${action.rawValue}${hitSuffix}`;
}

function emitBatchShift(batchId, offsetMs) {
  emit('shift-action-batch', {
    batchId,
    offsetMs,
  });
}

function getBatchShiftOffset(batchId) {
  return batchShiftOffsets[batchId] ?? 0;
}

function setBatchShiftOffset(batchId, value) {
  batchShiftOffsets[batchId] = value;
}

function applyBatchShift(batchId) {
  const offsetMs = Number(batchShiftOffsets[batchId]);
  if (!Number.isFinite(offsetMs) || offsetMs === 0) {
    return;
  }

  emitBatchShift(batchId, offsetMs);
  batchShiftOffsets[batchId] = 0;
}

function getBatchAlignStart(batchId) {
  return batchAlignStarts[batchId] ?? '';
}

function setBatchAlignStart(batchId, value) {
  batchAlignStarts[batchId] = value;
}

function applyBatchAlign(batchId) {
  if (batchAlignStarts[batchId] == null || batchAlignStarts[batchId] === '') {
    return;
  }

  const startMs = Number(batchAlignStarts[batchId]);
  if (!Number.isFinite(startMs)) {
    return;
  }

  emit('align-action-batch', {
    batchId,
    startMs,
  });
}

function formatGenerationBatch(batch) {
  return `动作形态批次 ${batch.batchId} / ${batch.variantCount ?? batch.segmentCount} 个`;
}

function formatInsertionNote(insertion) {
  return `自动推迟 ${insertion.requestedStartMs}ms -> ${insertion.resolvedStartMs}ms`;
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

.library-mode-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  padding: 8px 10px 0;
}

.library-mode-switch button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 28px;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.035);
  color: #9aa5ad;
  cursor: pointer;
  font: inherit;
  font-size: 11px;
}

.library-mode-switch button.active {
  border-color: rgba(121, 199, 185, 0.48);
  background: rgba(121, 199, 185, 0.12);
  color: #e8f8f5;
}

.library-mode-switch span {
  min-width: 17px;
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  font-size: 9px;
}

.action-library.fragment-mode
  > :not(.panel-title):not(.library-mode-switch):not(.fragment-library-host) {
  display: none;
}

h2 {
  margin: 0;
  font-size: 15px;
}

.icon-button,
.tool-button,
.segment-button {
  border: 1px solid rgba(121, 199, 185, 0.32);
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.1);
  color: #dff6f1;
  cursor: pointer;
  font: inherit;
}

.icon-button {
  padding: 4px 8px;
  font-size: 12px;
}

.toolbox {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.batch-summary-panel {
  display: grid;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.025);
}

.batch-summary-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #d9dee3;
  font-size: 12px;
  font-weight: 700;
}

.batch-summary-heading strong {
  min-width: 24px;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(121, 199, 185, 0.14);
  color: #9fe1d7;
  font-size: 11px;
  text-align: center;
}

.batch-summary-empty {
  margin: 0;
  color: #8f9aa3;
  font-size: 11px;
}

.batch-summary-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  min-width: 0;
  padding: 8px;
  border-left: 3px solid rgba(121, 199, 185, 0.38);
  border-radius: 4px;
  background: rgba(17, 22, 27, 0.64);
  cursor: pointer;
}

.batch-summary-item:hover,
.batch-summary-item:focus {
  border-left-color: rgba(121, 199, 185, 0.72);
  outline: none;
}

.batch-summary-item.selected {
  border-left-color: #79c7b9;
  background: rgba(121, 199, 185, 0.1);
}

.batch-summary-main {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.batch-summary-main div {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.batch-summary-main span,
.batch-summary-main strong,
.batch-summary-main small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.batch-summary-main span {
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
}

.batch-summary-main strong {
  flex: none;
  color: #9fe1d7;
  font-size: 11px;
}

.batch-summary-main small {
  color: #8f9aa3;
  font-size: 11px;
}

.batch-selected-badge {
  align-self: start;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(121, 199, 185, 0.18);
  color: #9fe1d7;
  font-size: 10px;
}

.batch-summary-actions {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.actor-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 12px 12px 0;
}

.actor-tab {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 7px 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  color: #d9dee3;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.actor-tab:hover,
.actor-tab.active {
  border-color: rgba(121, 199, 185, 0.58);
  background: rgba(121, 199, 185, 0.12);
  color: #ffffff;
}

.actor-tab span,
.actor-tab small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actor-tab span {
  font-size: 12px;
  font-weight: 700;
}

.actor-tab small {
  color: #8f9aa3;
  font-size: 10px;
}

.action-tools {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}

.batch-shift-control {
  display: grid;
  grid-column: 1 / -1;
  gap: 5px;
  min-width: 0;
}

.batch-shift-control span {
  color: #8f9aa3;
  font-size: 11px;
}

.batch-shift-control input {
  width: 100%;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 4px;
  background: #11161b;
  color: #ffffff;
  font: inherit;
  font-size: 12px;
}

.tool-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
}

.tool-button-icon {
  width: 13px;
  height: 13px;
}

.action-result-edit-button {
  border-color: rgba(121, 199, 185, 0.4);
  background: rgba(121, 199, 185, 0.12);
  color: #dff6f1;
}

.tool-button.danger {
  border-color: rgba(245, 108, 108, 0.34);
  background: rgba(245, 108, 108, 0.1);
  color: #f8b6b6;
}

.icon-button:hover,
.tool-button:hover,
.segment-button:hover {
  filter: brightness(1.18);
}

.segment-button:disabled {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: #6f7880;
  cursor: not-allowed;
  filter: none;
}

.actor-block {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.actor-name {
  font-weight: 700;
}

.actor-role {
  color: #8f9aa3;
  font-size: 12px;
}

.actor-kibo {
  display: block;
  margin-top: 3px;
  color: #70d6b7;
  font-size: 11px;
}

.skill-entry-list {
  display: grid;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.skill-entry-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.skill-entry {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid rgba(121, 199, 185, 0.26);
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.08);
  color: #dff6f1;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.skill-entry-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
  border-radius: 4px;
  background: rgba(4, 10, 14, 0.45);
}

.skill-entry-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.icon-button[data-drag-enabled='true'],
.skill-entry[data-drag-enabled='true'] {
  cursor: grab;
  user-select: none;
}

.icon-button[data-drag-enabled='true']:active,
.skill-entry[data-drag-enabled='true']:active {
  cursor: grabbing;
}

.skill-entry[data-drag-enabled='true'] > * {
  pointer-events: none;
}

.skill-entry:hover,
.segment-button:hover:not(:disabled) {
  border-color: rgba(121, 199, 185, 0.56);
  background: rgba(121, 199, 185, 0.14);
}

.segment-button {
  min-width: 62px;
  padding: 8px 9px;
  font-size: 12px;
  white-space: nowrap;
}

.skill-entry-name {
  overflow: hidden;
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-entry-meta {
  overflow: hidden;
  color: #8f9aa3;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-list {
  display: grid;
  gap: 10px;
  padding: 12px;
}

.action-item {
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  background: #232a31;
  cursor: pointer;
}

.action-item:hover,
.action-item:focus {
  border-color: rgba(121, 199, 185, 0.38);
  outline: none;
}

.action-item.multi-selected {
  border-color: rgba(121, 199, 185, 0.52);
  background: #27363a;
}

.action-item.selected {
  border-color: rgba(121, 199, 185, 0.75);
  box-shadow: 0 0 0 2px rgba(121, 199, 185, 0.12);
}

.action-item.batch-selected {
  border-left: 3px solid rgba(121, 199, 185, 0.76);
  background: #25343a;
}

.action-item.readiness-blocked {
  border-color: rgba(245, 108, 108, 0.56);
}

.action-item.readiness-unresolved {
  border-color: rgba(242, 179, 102, 0.44);
}

.action-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.action-name {
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-time {
  color: #79c7b9;
  font-size: 12px;
}

.action-readiness {
  padding: 2px 5px;
  border: 1px solid rgba(121, 199, 185, 0.24);
  border-radius: 3px;
  color: #9ce0d2;
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
}

.action-readiness[data-readiness-status='blocked'] {
  border-color: rgba(245, 108, 108, 0.36);
  color: #ffb4b4;
}

.action-readiness[data-readiness-status='ready-with-unresolved-conditions'] {
  border-color: rgba(242, 179, 102, 0.32);
  color: #ffd19a;
}

dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

dt {
  color: #8f9aa3;
  font-size: 11px;
}

dd {
  margin: 2px 0 0;
  color: #ffffff;
  font-size: 13px;
}

.timing-note {
  margin: 10px 0 0;
  padding: 7px 8px;
  border-radius: 4px;
  background: rgba(230, 162, 60, 0.12);
  color: #efc574;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.timing-note.neutral {
  background: rgba(255, 255, 255, 0.06);
  color: #b8c0c7;
}

.timing-note.placement-note {
  background: rgba(230, 162, 60, 0.12);
  color: #efc574;
}

.timing-note.batch-note {
  background: rgba(121, 199, 185, 0.1);
  color: #9ad9ce;
}
</style>
