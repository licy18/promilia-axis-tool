<template>
  <section class="panel action-library">
    <div class="panel-title">
      <Collection class="panel-icon" />
      <h2>动作库</h2>
    </div>

    <div class="actor-tabs" role="tablist" aria-label="动作库角色">
      <button
        v-for="teamActor in actors"
        :key="teamActor.id"
        class="actor-tab"
        :class="{ active: Number(teamActor.characterId) === Number(activeActorCharacterId) }"
        type="button"
        data-testid="workbench-action-library-actor"
        :data-character-id="teamActor.characterId"
        :data-active="Number(teamActor.characterId) === Number(activeActorCharacterId) ? 'true' : 'false'"
        @click="$emit('update-active-actor', teamActor.characterId)"
      >
        <span>{{ teamActor.name }}</span>
        <small>{{ teamActor.role || '角色' }}</small>
      </button>
    </div>

    <div class="toolbox">
      <button class="icon-button" data-testid="workbench-add-action" type="button" @click="$emit('add-action')">
        + 技能
      </button>
      <button class="icon-button" data-testid="workbench-add-wait-action" type="button" @click="$emit('add-wait-action')">
        + 等待
      </button>
      <button class="icon-button" data-testid="workbench-add-switch-action" type="button" @click="$emit('add-switch-action')">
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
        @click="$emit('add-resource-action')"
      >
        + 资源
      </button>
      <button
        class="icon-button"
        data-testid="workbench-add-enemy-event-action"
        type="button"
        @click="$emit('add-enemy-event-action')"
      >
        + 敌人
      </button>
    </div>

    <div class="segment-options">
      <label>
        <span>拆段间隔 ms</span>
        <input
          type="number"
          min="100"
          max="10000"
          step="100"
          data-testid="workbench-segment-split-interval-input"
          :value="segmentSplitOptions.intervalMs"
          @input="emitSegmentSplitOption('intervalMs', $event.target.value)"
        />
      </label>
      <label class="checkbox-control">
        <input
          type="checkbox"
          data-testid="workbench-segment-split-start-after-checkbox"
          :checked="segmentSplitOptions.startAfterSelectedAction"
          @change="emitSegmentSplitOption('startAfterSelectedAction', $event.target.checked)"
        />
        <span>从选中结束</span>
      </label>
      <label class="checkbox-control">
        <input
          type="checkbox"
          data-testid="workbench-segment-split-skip-existing-checkbox"
          :checked="segmentSplitOptions.skipExistingSegments"
          @change="emitSegmentSplitOption('skipExistingSegments', $event.target.checked)"
        />
        <span>跳过已有段</span>
      </label>
    </div>

    <div class="actor-block">
      <span class="actor-name">{{ actor.name }}</span>
      <span class="actor-role">{{ actor.role || '角色轨' }}</span>
    </div>

    <div v-if="skills.length" class="skill-entry-list">
      <div v-for="skill in skills" :key="skill.id" class="skill-entry-row">
        <button
          class="skill-entry"
          type="button"
          data-testid="workbench-skill-entry"
          :data-skill-id="skill.id"
          @click="$emit('add-skill-action', skill.id)"
        >
          <span class="skill-entry-name">{{ formatSkillName(skill) }}</span>
          <span class="skill-entry-meta">{{ formatSkillMeta(skill) }}</span>
        </button>
        <button
          class="segment-button"
          type="button"
          data-testid="workbench-skill-segment-split"
          :data-skill-id="skill.id"
          :disabled="getSkillSegmentCount(skill) <= 1"
          :title="formatSkillSplitTitle(skill)"
          @click="$emit('preview-skill-segment-actions', skill.id)"
        >
          拆段 {{ getSkillSegmentCount(skill) }}
        </button>
      </div>
    </div>

    <div
      v-if="segmentSplitPreview"
      class="segment-preview"
      data-testid="workbench-segment-split-preview"
    >
      <div class="segment-preview-heading">
        <span>{{ segmentSplitPreview.skillName }}</span>
        <strong>{{ segmentSplitPreview.actorName }} Lv.{{ segmentSplitPreview.level }}</strong>
      </div>
      <dl class="segment-preview-metrics">
        <div>
          <dt>生成</dt>
          <dd data-testid="workbench-segment-preview-generated-count">
            {{ segmentSplitPreview.generatedCount }}
          </dd>
        </div>
        <div>
          <dt>跳过</dt>
          <dd data-testid="workbench-segment-preview-skipped-count">
            {{ segmentSplitPreview.skippedCount }}
          </dd>
        </div>
        <div>
          <dt>推迟</dt>
          <dd data-testid="workbench-segment-preview-delay-count">
            {{ segmentSplitPreview.autoDelayedCount }}
          </dd>
        </div>
      </dl>
      <p class="segment-preview-base" data-testid="workbench-segment-preview-base">
        起点 {{ segmentSplitPreview.baseStartMs }}ms / 间隔 {{ segmentSplitPreview.options.intervalMs }}ms
      </p>
      <ul v-if="segmentSplitPreview.actions.length" class="segment-preview-list">
        <li
          v-for="action in segmentSplitPreview.actions"
          :key="action.damageSegmentIndex"
          data-testid="workbench-segment-preview-item"
          :data-segment-index="action.damageSegmentIndex"
        >
          <span>{{ action.label }} / {{ action.rawValue }}</span>
          <small>{{ formatPreviewRange(action) }}</small>
        </li>
      </ul>
      <p v-else class="segment-preview-empty" data-testid="workbench-segment-preview-empty">
        没有可生成段
      </p>
      <div class="segment-preview-actions">
        <button
          class="tool-button"
          type="button"
          data-testid="workbench-segment-preview-confirm"
          :disabled="segmentSplitPreview.generatedCount === 0"
          @click="$emit('confirm-skill-segment-actions')"
        >
          确认
        </button>
        <button
          class="tool-button"
          type="button"
          data-testid="workbench-segment-preview-cancel"
          @click="$emit('cancel-skill-segment-actions')"
        >
          取消
        </button>
      </div>
    </div>

    <section class="batch-summary-panel" data-testid="workbench-action-batch-summary-panel">
      <div class="batch-summary-heading">
        <span>批次管理</span>
        <strong data-testid="workbench-action-batch-summary-count">{{ actionBatches.length }}</strong>
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
      >
        <div class="batch-summary-main">
          <div>
            <span>{{ batch.skillName }}</span>
            <strong>{{ batch.count }} 动作</strong>
          </div>
          <small>{{ batch.sourceLabel }} / {{ batch.minStartMs }}-{{ batch.maxStartMs }}ms</small>
          <small>{{ batch.batchId }}</small>
        </div>
        <strong v-if="batch.selected" class="batch-selected-badge" data-testid="workbench-action-batch-selected">
          选中
        </strong>
        <div class="batch-summary-actions">
          <button
            class="tool-button danger"
            data-testid="workbench-summary-delete-action-batch"
            type="button"
            @click="$emit('delete-action-batch', batch.batchId)"
          >
            删批次
          </button>
          <button
            class="tool-button"
            data-testid="workbench-summary-shift-action-batch-earlier"
            type="button"
            @click="emitBatchShift(batch.batchId, -500)"
          >
            -500ms
          </button>
          <button
            class="tool-button"
            data-testid="workbench-summary-shift-action-batch-later"
            type="button"
            @click="emitBatchShift(batch.batchId, 500)"
          >
            +500ms
          </button>
          <label class="batch-shift-control">
            <span>批次偏移 ms</span>
            <input
              type="number"
              step="100"
              data-testid="workbench-summary-batch-shift-offset-input"
              :data-batch-id="batch.batchId"
              :value="getBatchShiftOffset(batch.batchId)"
              @input="setBatchShiftOffset(batch.batchId, $event.target.value)"
            />
          </label>
          <button
            class="tool-button"
            data-testid="workbench-summary-apply-action-batch-shift"
            type="button"
            @click="applyBatchShift(batch.batchId)"
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
              @input="setBatchAlignStart(batch.batchId, $event.target.value)"
            />
          </label>
          <button
            class="tool-button"
            data-testid="workbench-summary-apply-action-batch-align"
            type="button"
            @click="applyBatchAlign(batch.batchId)"
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
        :class="{ selected: action.id === selectedActionId }"
        :data-action-id="action.id"
        tabindex="0"
        @click="$emit('select-action', action.id)"
        @keydown.enter="$emit('select-action', action.id)"
        @keydown.delete.prevent="$emit('delete-action', action.id)"
        @keydown.backspace.prevent="$emit('delete-action', action.id)"
      >
        <div class="action-main">
          <span class="action-name">{{ action.name }}</span>
          <span class="action-time">{{ action.startMs }}ms</span>
        </div>
        <div class="action-tools">
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
            <dd>{{ action.cooldownMs ? `${action.cooldownMs / 1000}s` : '-' }}</dd>
          </div>
          <div>
            <dt>SP</dt>
            <dd>{{ action.spCost ?? '-' }}</dd>
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
import { computed, reactive } from 'vue';
import { Collection } from '@element-plus/icons-vue';
import { getSkillDamageSegments } from '../../domain/workbenchProjectFactory';

const props = defineProps({
  actor: {
    type: Object,
    required: true,
  },
  actors: {
    type: Array,
    required: true,
  },
  activeActorCharacterId: {
    type: Number,
    required: true,
  },
  actions: {
    type: Array,
    required: true,
  },
  skills: {
    type: Array,
    required: true,
  },
  selectedActionId: {
    type: String,
    required: true,
  },
  segmentSplitOptions: {
    type: Object,
    default: () => ({
      intervalMs: 2000,
      startAfterSelectedAction: false,
      skipExistingSegments: false,
    }),
  },
  segmentSplitPreview: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits([
  'select-action',
  'add-action',
  'add-skill-action',
  'preview-skill-segment-actions',
  'confirm-skill-segment-actions',
  'cancel-skill-segment-actions',
  'add-wait-action',
  'add-switch-action',
  'add-annotation-action',
  'add-resource-action',
  'add-enemy-event-action',
  'copy-action',
  'delete-action',
  'delete-action-batch',
  'align-action-batch',
  'shift-action-batch',
  'update-active-actor',
  'update-segment-split-options',
]);

const batchAlignStarts = reactive({});
const batchShiftOffsets = reactive({});

const actionBatches = computed(() => {
  const batches = new Map();

  props.actions.forEach((action) => {
    const batch = action.generationBatch;
    if (!batch?.batchId) {
      return;
    }

    const startMs = Math.max(0, Number(action.startMs) || 0);
    const batchId = batch.batchId;
    const existing = batches.get(batchId);
    if (existing) {
      existing.count += 1;
      existing.minStartMs = Math.min(existing.minStartMs, startMs);
      existing.maxStartMs = Math.max(existing.maxStartMs, startMs);
      existing.selected = existing.selected || action.id === props.selectedActionId;
      return;
    }

    batches.set(batchId, {
      batchId,
      count: 1,
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
  if (type === 'switch') {
    return '切人';
  }
  return '技能';
}

function actionDetailLabel(action) {
  if (action.type === 'skill') {
    return '倍率';
  }
  if (action.type === 'resource') {
    return '变化';
  }
  if (action.type === 'enemyEvent') {
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
    return `${action.selectedDamageSegment.label} / ${action.selectedDamageSegment.rawValue}`;
  }
  if (action.type === 'resource') {
    return `${String(action.resource ?? 'sp').toUpperCase()} ${formatSigned(action.change)}`;
  }
  if (action.type === 'enemyEvent') {
    return action.eventType ?? 'phase';
  }
  if (action.type === 'switch') {
    return action.targetActor?.name ?? action.targetCharacterId ?? '-';
  }
  return `${action.durationMs ?? 0}ms`;
}

function formatSigned(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? '+' : ''}${number}`;
}

function formatSkillMeta(skill) {
  const cooldownMs = Number(skill.cooldownMs);
  const cooldown = cooldownMs > 0 ? `${cooldownMs / 1000}s` : 'CD -';
  const spCost = Number(skill.spCost) || 0;
  return `${cooldown} / SP ${spCost}`;
}

function formatSkillName(skill) {
  return skill.name || `技能 ${skill.id}`;
}

function resolveBatchSkillName(batch, action) {
  const skillId = Number(batch.skillId ?? action.skillId);
  const skill = props.skills.find((item) => Number(item.id) === skillId);
  return skill?.name || action.name || `技能 ${skillId}`;
}

function formatBatchSource(source) {
  if (source === 'skill-segment-split') {
    return '拆段生成';
  }
  return source || '批次生成';
}

function getSkillSegmentCount(skill) {
  return getSkillDamageSegments(skill, 1).length;
}

function formatSkillSplitTitle(skill) {
  const count = getSkillSegmentCount(skill);
  return count > 1 ? `按 ${count} 个倍率段生成动作` : '该技能只有一个可解析倍率段';
}

function emitSegmentSplitOption(key, value) {
  emit('update-segment-split-options', {
    [key]: key === 'intervalMs' ? Number(value) : Boolean(value),
  });
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

function formatPreviewRange(action) {
  if (action.autoDelayed) {
    return `${action.requestedStartMs}ms -> ${action.resolvedStartMs}ms`;
  }
  return `${action.resolvedStartMs}ms`;
}

function formatGenerationBatch(batch) {
  return `拆段批次 ${batch.batchId} / ${batch.segmentCount} 段`;
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

.segment-options {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.segment-options label {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.segment-options label span {
  color: #8f9aa3;
  font-size: 11px;
}

.segment-options input[type="number"] {
  width: 100%;
  min-width: 0;
  padding: 7px 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 4px;
  background: #11161b;
  color: #ffffff;
  font: inherit;
  font-size: 12px;
}

.segment-options .checkbox-control {
  display: flex;
  align-items: center;
  gap: 7px;
}

.segment-options input[type="checkbox"] {
  width: 14px;
  height: 14px;
  accent-color: #79c7b9;
}

.segment-preview {
  display: grid;
  gap: 9px;
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(230, 162, 60, 0.07);
}

.segment-preview-heading {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.segment-preview-heading span,
.segment-preview-heading strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.segment-preview-heading span {
  color: #efc574;
  font-size: 12px;
  font-weight: 700;
}

.segment-preview-heading strong {
  color: #d9dee3;
  font-size: 11px;
}

.segment-preview-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin: 0;
}

.segment-preview-metrics div {
  min-width: 0;
  padding: 6px 7px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
}

.segment-preview-base,
.segment-preview-empty {
  margin: 0;
  color: #b8c0c7;
  font-size: 11px;
}

.segment-preview-list {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.segment-preview-list li {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 6px 7px;
  border-left: 3px solid #e6a23c;
  border-radius: 4px;
  background: rgba(17, 22, 27, 0.72);
}

.segment-preview-list span,
.segment-preview-list small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.segment-preview-list span {
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
}

.segment-preview-list small {
  color: #efc574;
  font-size: 11px;
}

.segment-preview-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.segment-preview-actions .tool-button:disabled {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: #6f7880;
  cursor: not-allowed;
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
  padding: 5px 8px;
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
  grid-template-columns: minmax(0, 1fr) auto;
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
  color: #8f9aa3;
  font-size: 11px;
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

.action-item.selected {
  border-color: rgba(121, 199, 185, 0.75);
  box-shadow: 0 0 0 2px rgba(121, 199, 185, 0.12);
}

.action-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
