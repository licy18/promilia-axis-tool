<template>
  <section class="panel properties-panel">
    <div class="panel-title">
      <Operation class="panel-icon" />
      <h2>属性</h2>
    </div>

    <div class="control-grid">
      <label>
        <span>主角色</span>
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
        <span>副角色</span>
        <select
          data-testid="workbench-secondary-character-select"
          :value="selection.secondaryCharacterId"
          @change="emitSelection('secondaryCharacterId', $event.target.value)"
        >
          <option
            v-for="character in secondaryCharacterOptions"
            :key="character.id"
            :value="character.id"
          >
            {{ character.name }}
          </option>
        </select>
      </label>

      <label>
        <span>技能</span>
        <select
          v-if="isSkillAction"
          data-testid="workbench-skill-select"
          :value="selectedAction.skillId"
          @change="emitActionPatch('skillId', $event.target.value)"
        >
          <option v-for="skill in skillOptions" :key="skill.id" :value="skill.id">
            {{ skill.name }}
          </option>
        </select>
        <input v-else data-testid="workbench-action-type" :value="actionTypeLabel" disabled />
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
        <span>{{ secondaryControlLabel }}</span>
        <input
          v-if="isSkillAction"
          type="number"
          data-testid="workbench-level-input"
          min="1"
          :max="maxSkillLevel"
          step="1"
          :value="selectedAction.level"
          @input="emitActionPatch('level', $event.target.value)"
        />
        <input
          v-else-if="isWaitAction || isAnnotationAction"
          type="number"
          data-testid="workbench-duration-input"
          min="1"
          :value="selectedAction.durationMs"
          @input="emitActionPatch('durationMs', $event.target.value)"
        />
        <input
          v-else-if="isResourceAction"
          type="number"
          data-testid="workbench-resource-change-input"
          :value="selectedAction.change"
          @input="emitActionPatch('change', $event.target.value)"
        />
        <input
          v-else-if="isEnemyEventAction"
          type="text"
          data-testid="workbench-enemy-event-type-input"
          :value="selectedAction.eventType"
          @input="emitTextPatch('eventType', $event.target.value)"
        />
        <select
          v-else-if="isSwitchAction"
          data-testid="workbench-switch-target-select"
          :value="selectedAction.targetCharacterId"
          @change="emitActionPatch('targetCharacterId', $event.target.value)"
        >
          <option
            v-for="character in switchTargetOptions"
            :key="character.id"
            :value="character.id"
          >
            {{ character.name }}
          </option>
        </select>
      </label>

      <label>
        <span>动作归属</span>
        <select
          v-if="canAssignActor"
          data-testid="workbench-action-actor-select"
          :value="currentActorCharacterId"
          @change="emitActionPatch('actorCharacterId', $event.target.value)"
        >
          <option v-for="actor in actors" :key="actor.id" :value="actor.characterId">
            {{ actor.name }}
          </option>
        </select>
        <input
          v-else
          data-testid="workbench-action-actor-readonly"
          :value="currentActorName"
          disabled
        />
      </label>
    </div>

    <div v-if="isResourceAction" class="action-controls contextual-controls">
      <label>
        <span>资源</span>
        <input
          type="text"
          data-testid="workbench-resource-type-input"
          :value="selectedAction.resource"
          @input="emitTextPatch('resource', $event.target.value)"
        />
      </label>

      <label>
        <span>原因</span>
        <input
          type="text"
          data-testid="workbench-resource-reason-input"
          :value="selectedAction.reason"
          @input="emitTextPatch('reason', $event.target.value)"
        />
      </label>
    </div>

    <label class="note-control">
      <span>备注</span>
      <textarea
        data-testid="workbench-note-input"
        :value="selectedAction.note"
        @input="emitTextPatch('note', $event.target.value)"
      />
    </label>

    <p class="selection-note">
      当前动作：{{ selectedAction.name }} / {{ selectedActionSummary }}
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
  actors: {
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
const isSkillAction = computed(() => props.selectedAction.type === 'skill');
const isWaitAction = computed(() => props.selectedAction.type === 'wait');
const isAnnotationAction = computed(() => props.selectedAction.type === 'annotation');
const isResourceAction = computed(() => props.selectedAction.type === 'resource');
const isEnemyEventAction = computed(() => props.selectedAction.type === 'enemyEvent');
const isSwitchAction = computed(() => props.selectedAction.type === 'switch');
const canAssignActor = computed(() => ['skill', 'switch', 'resource'].includes(props.selectedAction.type));
const secondaryCharacterOptions = computed(() =>
  props.characters.filter((character) => Number(character.id) !== Number(props.selection.characterId)),
);
const currentActorCharacterId = computed(() => {
  return props.selectedAction.actor?.characterId ?? props.selectedAction.actorCharacterId ?? props.selection.characterId;
});
const currentActorName = computed(() => {
  if (!canAssignActor.value) {
    return '系统 / 事件轨';
  }
  return props.actors.find((actor) => Number(actor.characterId) === Number(currentActorCharacterId.value))?.name ??
    resolveCharacterName(currentActorCharacterId.value);
});
const skillOptions = computed(() => {
  const actorSkills = props.skills.filter((skill) => Number(skill.characterId) === Number(currentActorCharacterId.value));
  return actorSkills.length > 0 ? actorSkills : props.skills;
});
const switchTargetOptions = computed(() => {
  const actorCharacterIds = new Set(props.actors.map((actor) => Number(actor.characterId)));
  return props.characters.filter(
    (character) =>
      actorCharacterIds.has(Number(character.id)) && Number(character.id) !== Number(currentActorCharacterId.value),
  );
});
const actionTypeLabel = computed(() => {
  if (props.selectedAction.type === 'wait') {
    return '等待动作';
  }
  if (props.selectedAction.type === 'annotation') {
    return '注释动作';
  }
  if (props.selectedAction.type === 'resource') {
    return '资源动作';
  }
  if (props.selectedAction.type === 'enemyEvent') {
    return '敌人事件';
  }
  if (props.selectedAction.type === 'switch') {
    return '切人动作';
  }
  return '技能动作';
});
const secondaryControlLabel = computed(() => {
  if (isSkillAction.value) {
    return '技能等级';
  }
  if (isResourceAction.value) {
    return '资源变化';
  }
  if (isEnemyEventAction.value) {
    return '事件类型';
  }
  if (isSwitchAction.value) {
    return '目标角色';
  }
  return '持续时间 ms';
});
const selectedActionSummary = computed(() => {
  if (isSkillAction.value) {
    return props.selectedAction.damageModel?.values?.[0] ?? '倍率待补';
  }
  if (isWaitAction.value) {
    return `${props.selectedAction.durationMs ?? 0}ms`;
  }
  if (isResourceAction.value) {
    return `${String(props.selectedAction.resource ?? 'sp').toUpperCase()} ${formatSigned(props.selectedAction.change)}`;
  }
  if (isEnemyEventAction.value) {
    return props.selectedAction.eventType || 'phase';
  }
  if (isSwitchAction.value) {
    return props.selectedAction.targetActor?.name ?? resolveCharacterName(props.selectedAction.targetCharacterId);
  }
  return props.selectedAction.note || '备注';
});

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
  const patch = { [key]: number };
  if (key === 'skillId') {
    patch.level = 1;
  }
  emit('update-action', patch);
}

function emitTextPatch(key, value) {
  emit('update-action', {
    [key]: value,
  });
}

function formatSigned(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? '+' : ''}${number}`;
}

function resolveCharacterName(characterId) {
  return props.characters.find((character) => Number(character.id) === Number(characterId))?.name ?? '目标待选';
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

.contextual-controls {
  padding-bottom: 0;
}

.note-control {
  padding: 0 14px 14px;
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
input,
textarea {
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
input:focus,
textarea:focus {
  outline: none;
  border-color: #79c7b9;
  box-shadow: 0 0 0 2px rgba(121, 199, 185, 0.14);
}

textarea {
  min-height: 72px;
  resize: vertical;
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
