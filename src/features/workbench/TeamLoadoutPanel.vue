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
        <strong>奇波 / 装备 / 灵子（待接公式）</strong>
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
        <img
          class="actor-avatar"
          :src="characterIconUrl(actor.characterId)"
          alt=""
        />
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
      </div>

      <div
        v-if="hasSelectedLoadout(actor)"
        class="loadout-detail"
        data-testid="workbench-actor-loadout-detail"
      >
        <div class="loadout-detail-heading">
          <strong>已选培养资料</strong>
        </div>
        <template v-if="loadoutDetailCatalog">
          <div
            v-if="selectedKibo(actor)"
            class="loadout-source-row"
            data-loadout-detail-kind="kibo"
          >
            <img
              class="loadout-icon"
              :src="loadoutIconUrl(selectedKibo(actor).icon)"
              alt=""
              @error="handleKiboIconError($event, selectedKibo(actor))"
            />
            <span>奇波</span>
            <strong>{{ selectedKibo(actor).name }}</strong>
            <small>{{ selectedKibo(actor).summary }}</small>
          </div>

          <div
            v-for="entry in selectedEquipment(actor)"
            :key="entry.slotKey"
            class="loadout-source-row"
            data-loadout-detail-kind="equipment"
          >
            <img
              class="loadout-icon"
              :src="loadoutIconUrl(entry.item.icon)"
              alt=""
            />
            <span>{{ entry.slotLabel }}</span>
            <strong>{{ entry.item.name }}</strong>
            <small>{{ entry.item.summary }}</small>
          </div>

          <div
            v-if="selectedSoulessence(actor)"
            class="loadout-source-row"
            data-loadout-detail-kind="soulessence"
          >
            <img
              class="loadout-icon"
              :src="loadoutIconUrl(selectedSoulessence(actor).icons?.small)"
              alt=""
            />
            <span>灵子</span>
            <strong>{{ selectedSoulessence(actor).name }}</strong>
            <small>{{ selectedSoulessence(actor).summary }}</small>
          </div>
        </template>
      </div>
    </details>
  </section>
</template>

<script setup>
import { User } from '@element-plus/icons-vue';
import { computed } from 'vue';

const props = defineProps({
  actors: {
    type: Array,
    required: true,
  },
  teamSlots: {
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
  loadoutDetailCatalog: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits([
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
const loadoutDetailCatalog = computed(() => props.loadoutDetailCatalog);

function isActorFocused(actor, index) {
  if (props.focusedCharacterId == null) return index === 0;
  return Number(actor.characterId) === Number(props.focusedCharacterId);
}

function emitInitialControlledActor(value) {
  emit('update-initial-controlled-actor', Number(value));
}

function emitInitialSpPatch(actor, value) {
  const normalizedValue = String(value ?? '').trim();
  emit('update-actor-config', {
    characterId: Number(actor.characterId),
    initialSp: normalizedValue === '' ? null : Number(normalizedValue),
  });
}

function energyStep(actor) {
  return Number(actor.stats?.maxSp) <= 1 ? 0.01 : 1;
}

function formatSpValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : '';
}

function hasSelectedLoadout(actor) {
  const loadout = actor.loadout ?? {};
  return Boolean(
    loadout.kiboId ||
    loadout.soulessenceId ||
    Object.values(loadout.equipment ?? {}).some(Boolean)
  );
}

function selectedKibo(actor) {
  return loadoutDetailCatalog.value?.kibos?.find(
    item => Number(item.id) === Number(actor.loadout?.kiboId)
  );
}

function selectedEquipment(actor) {
  return equipmentSlots.flatMap(slot => {
    const item = loadoutDetailCatalog.value?.equipment?.find(
      candidate =>
        Number(candidate.id) === Number(actor.loadout?.equipment?.[slot.key])
    );
    return item ? [{ slotKey: slot.key, slotLabel: slot.label, item }] : [];
  });
}

function selectedSoulessence(actor) {
  return loadoutDetailCatalog.value?.soulessences?.find(
    item => Number(item.id) === Number(actor.loadout?.soulessenceId)
  );
}

function characterIconUrl(characterId) {
  return `/assets/characters/${Number(characterId)}.png`;
}

function loadoutIconUrl(icon) {
  return icon ? `/assets/loadout/${icon}` : '';
}

function handleKiboIconError(event, kibo) {
  const fallbackIcon = kibo?.fallbackIcon;
  if (!fallbackIcon || event.currentTarget.dataset.fallbackApplied === 'true') {
    event.currentTarget.hidden = true;
    return;
  }
  event.currentTarget.dataset.fallbackApplied = 'true';
  event.currentTarget.src = `/assets/actions/${fallbackIcon}`;
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

.actor-loadout > summary {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  cursor: pointer;
  list-style-position: inside;
}

.actor-loadout > summary span {
  min-width: 0;
  overflow: hidden;
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actor-loadout > summary small {
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

.loadout-detail {
  display: grid;
  gap: 0;
  margin: 0 14px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.loadout-detail-heading,
.loadout-source-row {
  display: grid;
  grid-template-columns: 30px 48px minmax(0, 1fr);
  gap: 3px 8px;
  padding: 9px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.loadout-detail-heading {
  grid-template-columns: minmax(0, 1fr) auto;
}

.loadout-detail-heading strong,
.loadout-source-row strong {
  min-width: 0;
  color: #e8efed;
  font-size: 12px;
}

.loadout-source-row small,
.loadout-source-row > span {
  color: #8f9aa3;
  font-size: 10px;
}

.loadout-source-row > small {
  grid-column: 3;
  overflow-wrap: anywhere;
}

.actor-avatar,
.loadout-icon {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.actor-avatar {
  border-radius: 4px;
  background: #11161b;
}

.loadout-icon {
  grid-row: 1 / span 2;
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
