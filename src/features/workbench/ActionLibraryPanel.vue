<template>
  <section class="panel action-library">
    <div class="panel-title">
      <Collection class="panel-icon" />
      <h2>动作库</h2>
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

    <div class="actor-block">
      <span class="actor-name">{{ actor.name }}</span>
      <span class="actor-role">{{ actor.role }}</span>
    </div>

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
import { Collection } from '@element-plus/icons-vue';

defineProps({
  actor: {
    type: Object,
    required: true,
  },
  actions: {
    type: Array,
    required: true,
  },
  selectedActionId: {
    type: String,
    required: true,
  },
});

defineEmits([
  'select-action',
  'add-action',
  'add-wait-action',
  'add-switch-action',
  'add-annotation-action',
  'add-resource-action',
  'add-enemy-event-action',
  'copy-action',
  'delete-action',
]);

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
    return action.selectedDamageSegment?.rawValue ?? '待补';
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
.tool-button {
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

.action-tools {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 10px;
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
.tool-button:hover {
  filter: brightness(1.18);
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
</style>
