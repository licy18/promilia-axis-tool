<template>
  <section class="panel action-library">
    <div class="panel-title">
      <Collection class="panel-icon" />
      <h2>动作库</h2>
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
        tabindex="0"
        @click="$emit('select-action', action.id)"
        @keydown.enter="$emit('select-action', action.id)"
      >
        <div class="action-main">
          <span class="action-name">{{ action.name }}</span>
          <span class="action-time">{{ action.startMs }}ms</span>
        </div>
        <dl>
          <div>
            <dt>技能</dt>
            <dd>{{ action.skillId }}</dd>
          </div>
          <div>
            <dt>倍率</dt>
            <dd>{{ action.selectedDamageSegment?.rawValue ?? '待补' }}</dd>
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
        <p v-if="action.timing.needsTimingData" class="timing-note">
          {{ action.timing.source }}
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

defineEmits(['select-action']);
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
</style>
