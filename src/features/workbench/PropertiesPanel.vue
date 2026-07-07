<template>
  <section class="panel properties-panel">
    <div class="panel-title">
      <Operation class="panel-icon" />
      <h2>属性</h2>
    </div>

    <div class="control-grid">
      <label>
        <span>角色</span>
        <select
          data-testid="workbench-character-select"
          :value="selection.characterId"
          @change="emitSelection('characterId', $event.target.value)"
        >
          <option v-for="character in characters" :key="character.id" :value="character.id">
            {{ character.name }}
          </option>
        </select>
      </label>

      <label>
        <span>技能</span>
        <select
          data-testid="workbench-skill-select"
          :value="selection.skillId"
          @change="emitSelection('skillId', $event.target.value)"
        >
          <option v-for="skill in skills" :key="skill.id" :value="skill.id">
            {{ skill.name }}
          </option>
        </select>
      </label>

      <label>
        <span>敌人</span>
        <select
          data-testid="workbench-enemy-select"
          :value="selection.enemyId"
          @change="emitSelection('enemyId', $event.target.value)"
        >
          <option v-for="enemy in enemies" :key="enemy.id" :value="enemy.id">
            {{ enemy.name }}
          </option>
        </select>
      </label>
    </div>

    <div class="action-controls">
      <label>
        <span>开始时间 ms</span>
        <input
          type="number"
          data-testid="workbench-start-input"
          min="0"
          :max="durationMs"
          step="100"
          :value="selectedAction.startMs"
          @input="emitActionPatch('startMs', $event.target.value)"
        />
      </label>

      <label>
        <span>技能等级</span>
        <input
          type="number"
          data-testid="workbench-level-input"
          min="1"
          :max="maxSkillLevel"
          step="1"
          :value="selectedAction.level"
          @input="emitActionPatch('level', $event.target.value)"
        />
      </label>
    </div>

    <p class="selection-note">
      当前动作：{{ selectedAction.name }} / {{ selectedAction.damageModel.values[0] ?? '倍率待补' }}
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { Operation } from '@element-plus/icons-vue';

const props = defineProps({
  selection: {
    type: Object,
    required: true,
  },
  characters: {
    type: Array,
    required: true,
  },
  skills: {
    type: Array,
    required: true,
  },
  enemies: {
    type: Array,
    required: true,
  },
  selectedAction: {
    type: Object,
    required: true,
  },
  durationMs: {
    type: Number,
    required: true,
  },
});

const emit = defineEmits(['update-selection', 'update-action']);

const maxSkillLevel = computed(() =>
  Math.max(1, props.selectedAction.source?.skill?.level?.values?.length ?? props.selectedAction.level ?? 1),
);

function emitSelection(key, value) {
  emit('update-selection', {
    [key]: Number(value),
  });
}

function emitActionPatch(key, value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return;
  }
  emit('update-action', {
    [key]: number,
  });
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

.control-grid,
.action-controls {
  display: grid;
  gap: 12px;
  padding: 14px;
}

.action-controls {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding-top: 0;
}

label {
  display: grid;
  gap: 6px;
  min-width: 0;
}

label span {
  color: #8f9aa3;
  font-size: 12px;
}

select,
input {
  width: 100%;
  min-width: 0;
  padding: 8px 9px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 4px;
  background: #11161b;
  color: #ffffff;
  font: inherit;
}

select:focus,
input:focus {
  outline: none;
  border-color: #79c7b9;
  box-shadow: 0 0 0 2px rgba(121, 199, 185, 0.14);
}

.selection-note {
  margin: 0;
  padding: 0 14px 14px;
  color: #b8c0c7;
  font-size: 12px;
}

@media (max-width: 760px) {
  .action-controls {
    grid-template-columns: 1fr;
  }
}
</style>
