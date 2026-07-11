<template>
  <section
    class="panel configuration-library-panel"
    data-testid="workbench-configuration-library-panel"
  >
    <div class="panel-title">
      <Collection class="panel-icon" />
      <h2>模拟配置实例</h2>
    </div>

    <div class="configuration-list">
      <div
        v-for="actor in actors"
        :key="`actor-${actor.characterId}`"
        class="configuration-row"
        data-configuration-kind="actor"
        :data-character-id="actor.characterId"
        data-testid="workbench-actor-configuration-instance"
      >
        <div class="configuration-heading">
          <strong>{{ actor.name }}</strong>
          <small>角色配置</small>
        </div>
        <select
          :aria-label="`${actor.name}配置实例`"
          :data-character-id="actor.characterId"
          data-testid="workbench-actor-configuration-select"
          :value="actorInstanceId(actor.characterId)"
          @change="
            emitCommand('actor', 'select', actor.characterId, {
              instanceId: $event.target.value,
            })
          "
        >
          <option
            v-for="instance in actorInstances(actor.characterId)"
            :key="instance.id"
            :value="instance.id"
          >
            {{ instance.name }}
          </option>
        </select>
        <div class="configuration-edit-row">
          <input
            type="text"
            maxlength="48"
            :aria-label="`${actor.name}配置名称`"
            :data-character-id="actor.characterId"
            data-testid="workbench-actor-configuration-name"
            :value="activeActorInstance(actor.characterId)?.name ?? ''"
            @change="
              emitCommand('actor', 'rename', actor.characterId, {
                name: $event.target.value,
              })
            "
          />
          <button
            type="button"
            title="复制角色配置"
            aria-label="复制角色配置"
            :data-character-id="actor.characterId"
            data-testid="workbench-actor-configuration-duplicate"
            @click="emitCommand('actor', 'duplicate', actor.characterId)"
          >
            <CopyDocument />
          </button>
          <button
            type="button"
            title="删除角色配置"
            aria-label="删除角色配置"
            :disabled="actorInstances(actor.characterId).length <= 1"
            :data-character-id="actor.characterId"
            data-testid="workbench-actor-configuration-delete"
            @click="emitCommand('actor', 'delete', actor.characterId)"
          >
            <DeleteIcon />
          </button>
        </div>
      </div>

      <div
        class="configuration-row"
        data-configuration-kind="enemy"
        :data-enemy-id="enemyId"
        data-testid="workbench-enemy-configuration-instance"
      >
        <div class="configuration-heading">
          <strong>{{ enemy.name }}</strong>
          <small>敌人配置</small>
        </div>
        <select
          :aria-label="`${enemy.name}配置实例`"
          data-testid="workbench-enemy-configuration-select"
          :value="selection.enemyInstanceId"
          @change="
            emitCommand('enemy', 'select', enemyId, {
              instanceId: $event.target.value,
            })
          "
        >
          <option
            v-for="instance in enemyInstances"
            :key="instance.id"
            :value="instance.id"
          >
            {{ instance.name }}
          </option>
        </select>
        <div class="configuration-edit-row">
          <input
            type="text"
            maxlength="48"
            :aria-label="`${enemy.name}配置名称`"
            data-testid="workbench-enemy-configuration-name"
            :value="activeEnemyInstance?.name ?? ''"
            @change="
              emitCommand('enemy', 'rename', enemyId, {
                name: $event.target.value,
              })
            "
          />
          <button
            type="button"
            title="复制敌人配置"
            aria-label="复制敌人配置"
            data-testid="workbench-enemy-configuration-duplicate"
            @click="emitCommand('enemy', 'duplicate', enemyId)"
          >
            <CopyDocument />
          </button>
          <button
            type="button"
            title="删除敌人配置"
            aria-label="删除敌人配置"
            :disabled="enemyInstances.length <= 1"
            data-testid="workbench-enemy-configuration-delete"
            @click="emitCommand('enemy', 'delete', enemyId)"
          >
            <DeleteIcon />
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import {
  Collection,
  CopyDocument,
  Delete as DeleteIcon,
} from '@element-plus/icons-vue';

const props = defineProps({
  library: { type: Object, required: true },
  selection: { type: Object, required: true },
  actors: { type: Array, required: true },
  enemy: { type: Object, required: true },
  enemyId: { type: Number, required: true },
});
const emit = defineEmits(['command']);

const enemyInstances = computed(() =>
  props.library.enemyInstances.filter(
    instance => Number(instance.enemyId) === Number(props.enemyId)
  )
);
const activeEnemyInstance = computed(() =>
  enemyInstances.value.find(
    instance => instance.id === props.selection.enemyInstanceId
  )
);

function actorInstances(characterId) {
  return props.library.actorInstances.filter(
    instance => Number(instance.characterId) === Number(characterId)
  );
}

function actorInstanceId(characterId) {
  return (
    props.selection.actorInstanceIds.find(
      item => Number(item.characterId) === Number(characterId)
    )?.instanceId ?? ''
  );
}

function activeActorInstance(characterId) {
  const instanceId = actorInstanceId(characterId);
  return actorInstances(characterId).find(
    instance => instance.id === instanceId
  );
}

function emitCommand(kind, action, entityId, patch = {}) {
  emit('command', {
    kind,
    action,
    ...(kind === 'actor'
      ? { characterId: Number(entityId) }
      : { enemyId: Number(entityId) }),
    ...patch,
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

.panel-title h2 {
  margin: 0;
  font-size: 14px;
  letter-spacing: 0;
}

.panel-icon {
  width: 17px;
  height: 17px;
  color: #79c7b9;
}

.configuration-list {
  display: grid;
  padding: 0 14px;
}

.configuration-row {
  display: grid;
  gap: 8px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.configuration-row:last-child {
  border-bottom: 0;
}

.configuration-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.configuration-heading strong {
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.configuration-heading small {
  color: #7f919a;
  font-size: 10px;
}

select,
input {
  width: 100%;
  min-width: 0;
  height: 30px;
  border: 1px solid #354149;
  border-radius: 4px;
  background: #151b1f;
  color: #dce6ea;
  font: inherit;
  font-size: 11px;
}

input {
  padding: 0 8px;
}

.configuration-edit-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 30px 30px;
  gap: 6px;
}

button {
  display: grid;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid #354149;
  border-radius: 4px;
  place-items: center;
  background: #1a2227;
  color: #aebbc1;
  cursor: pointer;
}

button:hover:not(:disabled) {
  border-color: #608078;
  color: #effffc;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}

button svg {
  width: 14px;
  height: 14px;
}
</style>
