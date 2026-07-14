<template>
  <Teleport to="body">
    <div
      class="loadout-picker-overlay"
      data-testid="workbench-loadout-picker"
      @click.self="emit('close')"
      @wheel.stop
    >
      <section
        ref="dialogRef"
        class="loadout-picker-dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="pickerTitleId"
        :data-picker-kind="request.kind"
        :data-slot-key="request.slotKey ?? ''"
        tabindex="-1"
      >
        <header>
          <div>
            <span>{{ request.actorName || '队伍配置' }}</span>
            <h2 :id="pickerTitleId">{{ pickerTitle }}</h2>
          </div>
          <div class="header-actions">
            <button
              v-if="canUnequip"
              class="icon-command"
              type="button"
              title="卸下当前装备"
              data-testid="workbench-loadout-unequip"
              @click="emit('select', null)"
            >
              <Delete />
              <span>卸下</span>
            </button>
            <button
              class="icon-command close-command"
              type="button"
              title="关闭选择器"
              data-testid="workbench-loadout-close"
              @click="emit('close')"
            >
              <Close />
            </button>
          </div>
        </header>

        <label class="picker-search">
          <Search aria-hidden="true" />
          <span class="sr-only">按名称搜索</span>
          <input
            v-model.trim="searchQuery"
            type="search"
            placeholder="按名称搜索"
            data-testid="workbench-loadout-search"
          />
        </label>

        <div v-if="options.length" class="loadout-option-viewport">
          <div
            ref="optionGridRef"
            class="loadout-option-grid"
            :data-option-count="options.length"
            @scroll="syncOptionGridScroll"
          >
            <button
              v-for="option in options"
              :key="option.id"
              class="loadout-option"
              :class="{ selected: option.id === selectedId }"
              type="button"
              :data-option-id="option.id"
              :aria-pressed="option.id === selectedId"
              data-testid="workbench-loadout-option"
              @click="emit('select', option.id)"
            >
              <span class="option-icon" aria-hidden="true">
                <span>{{ option.initial }}</span>
                <img
                  v-if="option.iconUrl"
                  :src="option.iconUrl"
                  alt=""
                  @error="hideBrokenImage"
                />
              </span>
              <span class="option-copy">
                <strong>{{ option.name }}</strong>
                <small>{{ option.summary }}</small>
                <span v-if="option.markers?.length" class="option-markers">
                  <em v-for="marker in option.markers" :key="marker">
                    {{ marker }}
                  </em>
                </span>
              </span>
            </button>
          </div>
          <div
            v-if="optionGridScrollable"
            class="picker-scrollbar"
            aria-hidden="true"
            data-testid="workbench-loadout-scrollbar"
            @pointerdown.stop.prevent="beginOptionGridScrollbarDrag"
            @pointermove.stop.prevent="moveOptionGridScrollbarDrag"
            @pointerup.stop.prevent="endOptionGridScrollbarDrag"
            @pointercancel.stop.prevent="endOptionGridScrollbarDrag"
          >
            <span
              class="picker-scrollbar-thumb"
              :style="optionGridThumbStyle"
              data-testid="workbench-loadout-scrollbar-thumb"
            />
          </div>
        </div>
        <div v-else-if="loadError" class="picker-state error-state">
          <strong>资料载入失败</strong>
          <span>{{ loadError }}</span>
          <button type="button" @click="loadCatalog({ force: true })">
            <RefreshRight />
            重试
          </button>
        </div>
        <p v-else class="picker-state">
          {{ loading ? '正在载入资料' : '没有匹配的资料' }}
        </p>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import { Close, Delete, RefreshRight, Search } from '@element-plus/icons-vue';
import {
  getWorkbenchLoadoutDetailCatalogSnapshot,
  loadWorkbenchLoadoutDetailCatalog,
} from '../../data/workbenchLoadoutDetailCatalog.js';

const EQUIPMENT_TYPE_BY_SLOT = Object.freeze({
  weapon: '武器',
  top: '上装',
  bottom: '下装',
  earring: '耳环',
  ring: '戒指',
});

const props = defineProps({
  request: {
    type: Object,
    required: true,
  },
  characters: {
    type: Array,
    default: () => [],
  },
  enemies: {
    type: Array,
    default: () => [],
  },
  teamSlots: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['catalog-loaded', 'close', 'select']);
const dialogRef = ref(null);
const optionGridRef = ref(null);
const optionGridMetrics = ref({
  clientHeight: 0,
  scrollHeight: 0,
  scrollTop: 0,
});
const catalog = ref(getWorkbenchLoadoutDetailCatalogSnapshot());
const loading = ref(!catalog.value);
const loadError = ref('');
const searchQuery = ref('');
let previousBodyOverflow;
let optionGridScrollbarPointerId = null;
const pickerTitleId = `workbench-loadout-picker-title-${String(
  props.request.kind
)}`;

void loadCatalog();

const selectedId = computed(() => Number(props.request.selectedId) || null);
const canUnequip = computed(() =>
  ['kibo', 'equipment', 'soulessence'].includes(props.request.kind)
);
const pickerTitle = computed(() => {
  if (props.request.kind === 'character') return '更换角色';
  if (props.request.kind === 'enemy') return '选择敌人';
  if (props.request.kind === 'kibo') return '选择奇波';
  if (props.request.kind === 'soulessence') return '选择灵子';
  return `选择${props.request.slotLabel || '装备'}`;
});
const rawOptions = computed(() => {
  if (props.request.kind === 'character') {
    return props.characters.map(character => {
      const characterId = Number(character.id);
      const teamSlotIndex = props.teamSlots.findIndex(
        slot => Number(slot.characterId) === characterId
      );
      return {
        id: characterId,
        name: character.name,
        initial: initialOf(character.name),
        iconUrl: `/assets/characters/${characterId}.png`,
        summary: [character.position?.name, character.element?.name]
          .filter(Boolean)
          .join(' · '),
        markers: [
          teamSlotIndex >= 0 ? `队伍槽位 ${teamSlotIndex + 1}` : '',
          characterId === selectedId.value ? '当前槽位' : '',
        ].filter(Boolean),
      };
    });
  }
  if (props.request.kind === 'enemy') {
    return props.enemies.map(enemy => ({
      id: Number(enemy.id),
      name: enemy.name,
      initial: initialOf(enemy.name),
      iconUrl: loadoutIconUrl(enemy.icon),
      summary: enemySummary(enemy),
    }));
  }
  if (props.request.kind === 'kibo') {
    return (catalog.value?.kibos ?? []).map(item => detailOption(item));
  }
  if (props.request.kind === 'soulessence') {
    return (catalog.value?.soulessences ?? []).map(item =>
      detailOption(item, item.icons?.small)
    );
  }
  const expectedType = EQUIPMENT_TYPE_BY_SLOT[props.request.slotKey];
  return (catalog.value?.equipment ?? [])
    .filter(item => item.type === expectedType)
    .map(item => detailOption(item));
});
const options = computed(() => {
  const query = searchQuery.value.toLocaleLowerCase('zh-CN');
  if (!query) return rawOptions.value;
  return rawOptions.value.filter(option =>
    String(option.name).toLocaleLowerCase('zh-CN').includes(query)
  );
});
const optionGridScrollable = computed(
  () =>
    optionGridMetrics.value.scrollHeight >
    optionGridMetrics.value.clientHeight + 1
);
const optionGridThumbStyle = computed(() => {
  const { clientHeight, scrollHeight, scrollTop } = optionGridMetrics.value;
  if (!clientHeight || !scrollHeight) {
    return { height: '100%', top: '0%' };
  }
  const height = Math.max(8, (clientHeight / scrollHeight) * 100);
  const progress = scrollTop / Math.max(1, scrollHeight - clientHeight);
  return {
    height: `${height}%`,
    top: `${Math.min(100 - height, Math.max(0, progress * (100 - height)))}%`,
  };
});

watch(
  () => [props.request.kind, props.request.slotKey, options.value.length],
  async () => {
    await nextTick();
    syncOptionGridScroll();
  },
  { immediate: true }
);

onMounted(() => {
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  window.addEventListener('keydown', closeOnEscape);
  void nextTick(() => dialogRef.value?.focus());
});

onBeforeUnmount(() => {
  if (previousBodyOverflow !== undefined) {
    document.body.style.overflow = previousBodyOverflow;
  }
  window.removeEventListener('keydown', closeOnEscape);
});

function detailOption(item, icon = item.icon) {
  return {
    id: Number(item.id),
    name: item.name,
    initial: initialOf(item.name),
    iconUrl: loadoutIconUrl(icon),
    summary:
      item.summary || [item.rarity, item.type].filter(Boolean).join(' · '),
  };
}

function loadoutIconUrl(icon) {
  return icon ? `/assets/loadout/${icon}` : '';
}

function enemySummary(enemy) {
  const attributes = enemy.property?.baseAttributes ?? [];
  return ['MAXHP', 'DEF', 'WEAKNESS_POINT_MAX']
    .map(key => attributes.find(attribute => attribute.key === key))
    .filter(Boolean)
    .map(attribute => `${attribute.name} ${formatNumber(attribute.value)}`)
    .join(' · ');
}

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString('zh-CN');
}

function initialOf(name) {
  return Array.from(String(name || '?'))[0] ?? '?';
}

function closeOnEscape(event) {
  if (event.key === 'Escape') {
    emit('close');
  }
}

function hideBrokenImage(event) {
  event.currentTarget.style.display = 'none';
  event.currentTarget.dataset.missing = 'true';
}

function syncOptionGridScroll(event) {
  const element = event?.currentTarget ?? optionGridRef.value;
  if (!element) return;
  optionGridMetrics.value = {
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
  };
}

function beginOptionGridScrollbarDrag(event) {
  optionGridScrollbarPointerId = event.pointerId;
  event.currentTarget.setPointerCapture?.(event.pointerId);
  scrollOptionGridFromRail(event);
}

function moveOptionGridScrollbarDrag(event) {
  if (event.pointerId !== optionGridScrollbarPointerId) return;
  scrollOptionGridFromRail(event);
}

function endOptionGridScrollbarDrag(event) {
  if (event.pointerId !== optionGridScrollbarPointerId) return;
  event.currentTarget.releasePointerCapture?.(event.pointerId);
  optionGridScrollbarPointerId = null;
}

function scrollOptionGridFromRail(event) {
  const optionGrid = optionGridRef.value;
  if (!optionGrid) return;
  const rail = event.currentTarget.getBoundingClientRect();
  const thumbHeight = Math.max(
    32,
    rail.height * (optionGrid.clientHeight / optionGrid.scrollHeight)
  );
  const travel = Math.max(1, rail.height - thumbHeight);
  const thumbTop = Math.min(
    travel,
    Math.max(0, event.clientY - rail.top - thumbHeight / 2)
  );
  optionGrid.scrollTop =
    (thumbTop / travel) * (optionGrid.scrollHeight - optionGrid.clientHeight);
  syncOptionGridScroll();
}

async function loadCatalog(options = {}) {
  loading.value = true;
  loadError.value = '';
  try {
    catalog.value = await loadWorkbenchLoadoutDetailCatalog(options);
    emit('catalog-loaded', catalog.value);
  } catch (error) {
    loadError.value = error?.message || '请检查本地资源后重试。';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.loadout-picker-overlay {
  position: fixed;
  z-index: 1400;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 28px;
  background: rgba(5, 8, 10, 0.72);
  overscroll-behavior: contain;
}

.loadout-picker-dialog {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  width: min(920px, 100%);
  height: min(720px, calc(100vh - 56px));
  height: min(720px, calc(100dvh - 56px));
  min-height: 0;
  overflow: hidden;
  border: 1px solid rgba(121, 199, 185, 0.42);
  border-radius: 6px;
  background: #12181d;
  box-shadow: 0 22px 60px rgba(0, 0, 0, 0.48);
  outline: none;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
  background: #182027;
}

header > div:first-child {
  min-width: 0;
}

header span {
  color: #8f9aa3;
  font-size: 11px;
}

.picker-search {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  margin: 12px 12px 0;
  padding: 0 10px;
  border: 1px solid rgba(255, 255, 255, 0.13);
  border-radius: 4px;
  background: #0f1519;
  color: #8f9aa3;
}

.picker-search svg {
  width: 16px;
  height: 16px;
}

.picker-search input {
  min-width: 0;
  height: 36px;
  border: 0;
  outline: 0;
  background: transparent;
  color: #edf4f4;
  font: inherit;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

h2 {
  margin: 2px 0 0;
  color: #f5f8f8;
  font-size: 17px;
}

.header-actions {
  display: flex;
  gap: 7px;
}

.icon-command {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 32px;
  padding: 6px 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 4px;
  background: #202930;
  color: #dfe7e8;
  cursor: pointer;
}

.icon-command svg {
  width: 15px;
  height: 15px;
}

.close-command {
  width: 32px;
  padding: 0;
}

.loadout-option-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  align-content: start;
  gap: 8px;
  min-height: 0;
  padding: 12px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
}

.loadout-option-viewport {
  position: relative;
  min-height: 0;
  overflow: hidden;
}

.loadout-option-grid {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding-right: 24px;
}

.picker-scrollbar {
  position: absolute;
  top: 12px;
  right: 7px;
  bottom: 12px;
  width: 8px;
  border-radius: 4px;
  background: #26323a;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
  cursor: ns-resize;
  touch-action: none;
}

.picker-scrollbar-thumb {
  position: absolute;
  right: 1px;
  left: 1px;
  min-height: 32px;
  border-radius: 3px;
  background: #79c7b9;
  box-shadow: 0 0 0 1px rgba(5, 8, 10, 0.45);
}

.loadout-option-grid::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.loadout-option {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-height: 68px;
  padding: 9px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 5px;
  background: #1a2228;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.loadout-option:hover,
.loadout-option:focus-visible,
.loadout-option.selected {
  border-color: #79c7b9;
  background: #1d302f;
  outline: none;
}

.option-icon {
  position: relative;
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 4px;
  background: #11171c;
  color: #8f9aa3;
  font-weight: 800;
}

.option-icon img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.option-copy {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.option-copy strong {
  overflow: hidden;
  color: #f2f6f6;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.option-copy small {
  display: -webkit-box;
  overflow: hidden;
  color: #9aa6ac;
  font-size: 10px;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.option-markers {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.option-markers em {
  padding: 2px 4px;
  border-radius: 3px;
  background: rgba(121, 199, 185, 0.14);
  color: #9fd5cb;
  font-size: 9px;
  font-style: normal;
}

.picker-state {
  margin: 0;
  padding: 42px 18px;
  color: #9aa6ac;
  text-align: center;
}

.error-state {
  display: grid;
  justify-items: center;
  gap: 8px;
}

.error-state strong {
  color: #f4b7ad;
}

.error-state span {
  font-size: 11px;
}

.error-state button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border: 1px solid rgba(121, 199, 185, 0.5);
  border-radius: 4px;
  background: #1d302f;
  color: #dff4f0;
  cursor: pointer;
}

.error-state svg {
  width: 14px;
  height: 14px;
}

@media (max-width: 600px) {
  .loadout-picker-overlay {
    align-items: end;
    padding: 0;
  }

  .loadout-picker-dialog {
    width: 100%;
    height: 86vh;
    height: 86dvh;
    border-right: 0;
    border-bottom: 0;
    border-left: 0;
    border-radius: 6px 6px 0 0;
  }

  .loadout-option-grid {
    grid-template-columns: 1fr;
  }
}
</style>
