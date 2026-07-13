<template>
  <section
    class="panel team-loadout-panel"
    data-testid="workbench-team-loadout-panel"
  >
    <div class="panel-title">
      <User class="panel-icon" />
      <h2>参战配置</h2>
    </div>

    <div class="team-slot-grid" data-testid="workbench-team-slot-grid">
      <label
        v-for="(slot, index) in teamSlots"
        :key="slot.slotId"
        class="team-slot-control"
        :data-team-slot-id="slot.slotId"
      >
        <span>槽位 {{ index + 1 }}</span>
        <select
          :data-testid="teamSlotTestId(index)"
          data-team-slot-select="true"
          :data-team-slot-id="slot.slotId"
          :value="slot.characterId"
          @change="emitTeamSlotPatch(slot.slotId, $event.target.value)"
        >
          <option
            v-for="character in characters"
            :key="character.id"
            :value="character.id"
          >
            {{ formatCharacterOption(character) }}
          </option>
        </select>
      </label>
      <label class="team-slot-control controlled-actor-control">
        <span>初始前台</span>
        <select
          :value="controlledActorCharacterId"
          data-testid="workbench-initial-controlled-actor-select"
          @change="emitInitialControlledActor($event.target.value)"
        >
          <option
            v-for="actor in actors"
            :key="actor.id"
            :value="actor.characterId"
          >
            {{ actor.name }}
          </option>
        </select>
      </label>
    </div>

    <div class="config-scope" data-testid="workbench-config-scope">
      <div data-config-status="simulation-active">
        <span>模拟生效</span>
        <strong>角色 / 敌人 / 数值面板</strong>
      </div>
      <div data-config-status="project-config-only">
        <span>项目记录</span>
        <strong>奇波 / 装备 / 魂灵（待接公式）</strong>
      </div>
    </div>

    <details
      v-for="(actor, index) in actors"
      :key="actor.id"
      class="actor-loadout"
      :data-character-id="actor.characterId"
      :data-team-slot-id="teamSlots[index]?.slotId"
      :data-focused="isActorFocused(actor, index) ? 'true' : 'false'"
      data-testid="workbench-actor-loadout"
      :open="isActorFocused(actor, index)"
    >
      <summary>
        <span>{{ actor.name }}</span>
        <small>槽位 {{ index + 1 }} · Lv.{{ actor.level }}</small>
      </summary>

      <div class="loadout-controls">
        <label class="energy-control">
          <span>
            初始 SP
            <small v-if="Number.isFinite(actor.stats?.maxSp)">
              / {{ formatSpValue(actor.stats.maxSp) }}
            </small>
          </span>
          <input
            type="number"
            min="0"
            :max="actor.stats?.maxSp ?? undefined"
            :step="energyStep(actor)"
            :data-character-id="actor.characterId"
            data-testid="workbench-actor-initial-sp-input"
            :value="actor.initialSp ?? ''"
            placeholder="未配置"
            @change="emitInitialSpPatch(actor, $event.target.value)"
          />
        </label>

        <label>
          <span>奇波</span>
          <select
            :data-character-id="actor.characterId"
            data-loadout-key="kiboId"
            data-testid="workbench-actor-kibo-select"
            :value="actor.loadout?.kiboId ?? ''"
            @change="emitLoadoutPatch(actor, 'kiboId', $event.target.value)"
          >
            <option value="">未配置</option>
            <option v-for="kibo in kibos" :key="kibo.id" :value="kibo.id">
              {{ formatKiboOption(kibo) }}
            </option>
          </select>
        </label>

        <label
          v-for="slot in equipmentSlots"
          :key="slot.key"
          class="equipment-control"
        >
          <span>{{ slot.label }}</span>
          <select
            :data-character-id="actor.characterId"
            :data-loadout-key="slot.key"
            data-testid="workbench-actor-equipment-select"
            :value="actor.loadout?.equipment?.[slot.key] ?? ''"
            @change="emitEquipmentPatch(actor, slot.key, $event.target.value)"
          >
            <option value="">未配置</option>
            <option
              v-for="item in equipment[slot.key] ?? []"
              :key="item.id"
              :value="item.id"
            >
              {{ formatEquipmentOption(item) }}
            </option>
          </select>
        </label>

        <label>
          <span>魂灵</span>
          <select
            :data-character-id="actor.characterId"
            data-loadout-key="soulessenceId"
            data-testid="workbench-actor-soulessence-select"
            :value="actor.loadout?.soulessenceId ?? ''"
            @change="
              emitLoadoutPatch(actor, 'soulessenceId', $event.target.value)
            "
          >
            <option value="">未配置</option>
            <option
              v-for="soulessence in soulessences"
              :key="soulessence.id"
              :value="soulessence.id"
            >
              {{ formatSoulessenceOption(soulessence) }}
            </option>
          </select>
        </label>
      </div>
    </details>
  </section>
</template>

<script setup>
import { User } from '@element-plus/icons-vue';

const props = defineProps({
  actors: {
    type: Array,
    required: true,
  },
  characters: {
    type: Array,
    required: true,
  },
  teamSlots: {
    type: Array,
    required: true,
  },
  kibos: {
    type: Array,
    required: true,
  },
  equipment: {
    type: Object,
    required: true,
  },
  soulessences: {
    type: Array,
    required: true,
  },
  focusedCharacterId: {
    type: Number,
    default: null,
  },
  controlledActorCharacterId: {
    type: [Number, String],
    default: '',
  },
});

const emit = defineEmits([
  'update-team-slot',
  'update-actor-config',
  'update-initial-controlled-actor',
]);
const equipmentSlots = Object.freeze([
  { key: 'weapon', label: '武器' },
  { key: 'top', label: '上装' },
  { key: 'bottom', label: '下装' },
  { key: 'earring', label: '耳环' },
  { key: 'ring', label: '戒指' },
]);

function isActorFocused(actor, index) {
  if (props.focusedCharacterId == null) return index === 0;
  return Number(actor.characterId) === Number(props.focusedCharacterId);
}

function emitTeamSlotPatch(slotId, value) {
  emit('update-team-slot', {
    slotId,
    characterId: Number(value),
  });
}

function emitInitialControlledActor(value) {
  emit('update-initial-controlled-actor', Number(value));
}

function teamSlotTestId(index) {
  return [
    'workbench-character-select',
    'workbench-secondary-character-select',
    'workbench-tertiary-character-select',
  ][index];
}

function formatCharacterOption(character) {
  return [character.name, character.element?.abbrName, character.position?.name]
    .filter(Boolean)
    .join(' · ');
}

function emitLoadoutPatch(actor, key, value) {
  emit('update-actor-config', {
    characterId: Number(actor.characterId),
    loadout: {
      [key]: normalizeOptionalId(value),
    },
  });
}

function emitInitialSpPatch(actor, value) {
  const normalizedValue = String(value ?? '').trim();
  emit('update-actor-config', {
    characterId: Number(actor.characterId),
    initialSp: normalizedValue === '' ? null : Number(normalizedValue),
  });
}

function emitEquipmentPatch(actor, slotKey, value) {
  emit('update-actor-config', {
    characterId: Number(actor.characterId),
    loadout: {
      equipment: {
        [slotKey]: normalizeOptionalId(value),
      },
    },
  });
}

function normalizeOptionalId(value) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function energyStep(actor) {
  return Number(actor.stats?.maxSp) <= 1 ? 0.01 : 1;
}

function formatSpValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : '';
}

function formatKiboOption(kibo) {
  return [kibo.name, kibo.element, kibo.stage].filter(Boolean).join(' · ');
}

function formatEquipmentOption(item) {
  return [item.rarity, item.name].filter(Boolean).join(' · ');
}

function formatSoulessenceOption(item) {
  return [item.rarity, item.name].filter(Boolean).join(' · ');
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

.config-scope {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.team-slot-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.team-slot-control {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.config-scope div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.config-scope span,
.config-scope strong {
  overflow-wrap: anywhere;
  font-size: 11px;
}

.config-scope span {
  color: #8f9aa3;
}

.config-scope strong {
  color: #dfe8e5;
}

.config-scope [data-config-status='simulation-active'] strong {
  color: #8dd8c9;
}

.actor-loadout + .actor-loadout {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.actor-loadout[data-focused='true'] {
  box-shadow: inset 3px 0 #79c7b9;
}

summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  cursor: pointer;
  list-style-position: inside;
}

summary span {
  min-width: 0;
  overflow: hidden;
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

summary small {
  color: #8dd8c9;
  font-size: 11px;
  white-space: nowrap;
}

.loadout-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 0 14px 14px;
}

label {
  display: grid;
  gap: 5px;
  min-width: 0;
}

label span {
  color: #8f9aa3;
  font-size: 11px;
}

label span small {
  color: #8dd8c9;
  font-size: inherit;
}

select,
input {
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

select:focus,
input:focus {
  outline: none;
  border-color: #79c7b9;
  box-shadow: 0 0 0 2px rgba(121, 199, 185, 0.14);
}

@media (max-width: 760px) {
  .config-scope,
  .team-slot-grid,
  .loadout-controls {
    grid-template-columns: 1fr;
  }
}
</style>
