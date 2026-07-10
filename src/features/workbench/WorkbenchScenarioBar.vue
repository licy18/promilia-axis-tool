<template>
  <section
    class="scenario-bar"
    :data-active-scenario-id="workspace.activeScenarioId"
    :data-scenario-count="workspace.scenarios.length"
    data-testid="workbench-scenario-bar"
  >
    <div class="scenario-current">
      <span class="scenario-eyebrow">方案工作区</span>
      <div class="scenario-title-row">
        <input
          v-if="renaming"
          ref="renameInput"
          v-model="renameValue"
          class="scenario-name-input"
          data-testid="workbench-scenario-rename-input"
          maxlength="48"
          aria-label="方案名称"
          @blur="commitRename"
          @keydown.enter.prevent="commitRename"
          @keydown.esc.prevent="cancelRename"
        />
        <strong
          v-else
          class="scenario-name"
          data-testid="workbench-scenario-name"
          @dblclick="startRename"
        >
          {{ activeScenario?.name || '方案' }}
        </strong>
        <div class="scenario-commands">
          <button
            type="button"
            title="重命名当前方案"
            data-testid="workbench-scenario-rename"
            @click="startRename"
          >
            <EditPen />
          </button>
          <button
            type="button"
            title="复制当前方案"
            data-testid="workbench-scenario-duplicate"
            :disabled="workspace.scenarios.length >= maxScenarios"
            @click="emit('duplicate', workspace.activeScenarioId)"
          >
            <CopyDocument />
          </button>
          <button
            type="button"
            title="删除当前方案"
            data-testid="workbench-scenario-delete"
            :disabled="workspace.scenarios.length <= 1"
            @click="emit('delete', workspace.activeScenarioId)"
          >
            <Delete />
          </button>
        </div>
      </div>
    </div>

    <div class="scenario-tabs" role="tablist" aria-label="排轴方案">
      <button
        v-for="(scenario, index) in workspace.scenarios"
        :key="scenario.id"
        class="scenario-tab"
        :class="{ active: scenario.id === workspace.activeScenarioId }"
        type="button"
        role="tab"
        :aria-selected="scenario.id === workspace.activeScenarioId"
        :data-scenario-id="scenario.id"
        data-testid="workbench-scenario-tab"
        @click="emit('switch', scenario.id)"
      >
        <span>{{ String(index + 1).padStart(2, '0') }}</span>
        <strong>{{ scenario.name }}</strong>
      </button>
      <button
        class="scenario-add"
        type="button"
        title="新建方案"
        data-testid="workbench-scenario-add"
        :disabled="workspace.scenarios.length >= maxScenarios"
        @click="emit('add')"
      >
        <Plus />
      </button>
    </div>

    <div class="scenario-count">
      <strong>{{ workspace.scenarios.length }}</strong>
      <span>/ {{ maxScenarios }}</span>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { CopyDocument, Delete, EditPen, Plus } from '@element-plus/icons-vue';

const props = defineProps({
  workspace: {
    type: Object,
    required: true,
  },
  maxScenarios: {
    type: Number,
    default: 14,
  },
});
const emit = defineEmits(['switch', 'add', 'duplicate', 'rename', 'delete']);

const renaming = ref(false);
const renameValue = ref('');
const renameInput = ref(null);
const activeScenario = computed(
  () =>
    props.workspace.scenarios.find(
      scenario => scenario.id === props.workspace.activeScenarioId
    ) ?? props.workspace.scenarios[0]
);

watch(
  () => props.workspace.activeScenarioId,
  () => {
    renaming.value = false;
    renameValue.value = activeScenario.value?.name ?? '';
  },
  { immediate: true }
);

function startRename() {
  if (!activeScenario.value) {
    return;
  }
  renameValue.value = activeScenario.value.name;
  renaming.value = true;
  void nextTick().then(() => {
    renameInput.value?.focus?.();
    renameInput.value?.select?.();
  });
}

function commitRename() {
  if (!renaming.value) {
    return;
  }
  const nextName = renameValue.value.trim();
  renaming.value = false;
  if (nextName && nextName !== activeScenario.value?.name) {
    emit('rename', {
      scenarioId: props.workspace.activeScenarioId,
      name: nextName,
    });
  }
}

function cancelRename() {
  renameValue.value = activeScenario.value?.name ?? '';
  renaming.value = false;
}
</script>

<style scoped>
.scenario-bar {
  display: grid;
  grid-template-columns: minmax(190px, 260px) minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  min-height: 54px;
  padding: 8px 14px;
  border-bottom: 1px solid #2c353c;
  background: #151b20;
  color: #e8eef1;
}
.scenario-current {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.scenario-eyebrow {
  color: #75838c;
  font-size: 9px;
  font-weight: 800;
}
.scenario-title-row {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.scenario-name,
.scenario-name-input {
  min-width: 0;
  width: 100%;
  height: 28px;
  font-size: 14px;
  letter-spacing: 0;
}
.scenario-name {
  overflow: hidden;
  line-height: 28px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.scenario-name-input {
  padding: 0 7px;
  border: 1px solid #64aa9e;
  border-radius: 3px;
  outline: none;
  background: #0d1216;
  color: #f2f7f8;
  font: inherit;
}
.scenario-commands {
  display: flex;
  gap: 4px;
  flex: 0 0 auto;
}
.scenario-commands button,
.scenario-add {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid #39454d;
  border-radius: 3px;
  background: #20282e;
  color: #d4dde1;
  cursor: pointer;
}
.scenario-commands button:hover,
.scenario-add:hover {
  border-color: #6cb6a9;
  color: #edfffb;
}
.scenario-commands button:disabled,
.scenario-add:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}
.scenario-commands svg,
.scenario-add svg {
  width: 14px;
  height: 14px;
}
.scenario-tabs {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: thin;
}
.scenario-tab {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  width: clamp(112px, 14vw, 176px);
  height: 34px;
  padding: 0 9px;
  border: 1px solid #354049;
  border-radius: 3px;
  background: #11171b;
  color: #9aa7ae;
  cursor: pointer;
  text-align: left;
}
.scenario-tab span {
  color: #697780;
  font-size: 9px;
  font-variant-numeric: tabular-nums;
}
.scenario-tab strong {
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.scenario-tab.active {
  border-color: #6fc1b2;
  background: #1e3c38;
  color: #f1fffc;
}
.scenario-count {
  display: flex;
  align-items: baseline;
  gap: 3px;
  color: #77858d;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}
.scenario-count strong {
  color: #b5c2c8;
  font-size: 13px;
}
@media (max-width: 760px) {
  .scenario-bar {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    padding: 8px;
  }
  .scenario-tabs {
    grid-column: 1 / -1;
    grid-row: 2;
  }
  .scenario-count {
    grid-column: 2;
    grid-row: 1;
  }
  .scenario-tab {
    width: 126px;
  }
}
</style>
