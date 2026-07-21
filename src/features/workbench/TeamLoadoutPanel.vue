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
        <strong>角色 / 奇波静态面板与三值输入</strong>
      </div>
      <div data-config-status="project-config-only">
        <span>动态待接</span>
        <strong>灵子技能 / 装备套装效果</strong>
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
          <span>角色等级</span>
          <input
            type="number"
            min="1"
            max="100"
            step="1"
            :value="actor.level"
            data-testid="workbench-actor-level-input"
            @change="emitActorLevelPatch(actor, $event.target.value)"
          />
        </label>
        <label class="energy-control">
          <span>星赐阶位</span>
          <input
            type="number"
            min="0"
            max="7"
            step="1"
            :value="actor.cultivation?.starGiftRank ?? 0"
            data-testid="workbench-actor-star-gift-rank-input"
            @change="emitCultivationPatch(actor, 'starGiftRank', $event.target.value)"
          />
        </label>
        <label class="energy-control">
          <span>好感等级</span>
          <input
            type="number"
            min="0"
            max="10"
            step="1"
            :value="actor.cultivation?.favorabilityLevel ?? 0"
            data-testid="workbench-actor-favorability-input"
            @change="emitCultivationPatch(actor, 'favorabilityLevel', $event.target.value)"
          />
        </label>
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
        v-if="actor.loadout?.kiboId"
        class="cultivation-controls"
        data-testid="workbench-kibo-panel-config"
      >
        <label>
          <span>奇波等级</span>
          <input
            type="number"
            min="1"
            max="100"
            step="1"
            :value="actor.loadout.kiboConfig?.level ?? 80"
            data-testid="workbench-kibo-level-input"
            @change="emitKiboConfigPatch(actor, { level: numberValue($event.target.value) })"
          />
        </label>
        <label>
          <span>爱好 ID</span>
          <input
            type="number"
            min="1"
            step="1"
            :value="actor.loadout.kiboConfig?.hobbyId ?? 1"
            data-testid="workbench-kibo-hobby-input"
            @change="emitKiboConfigPatch(actor, { hobbyId: numberValue($event.target.value) })"
          />
        </label>
        <label>
          <span>四维悟性</span>
          <input
            type="number"
            min="75"
            max="170"
            step="1"
            :value="kiboComprehension(actor)"
            data-testid="workbench-kibo-comprehension-input"
            @change="emitKiboComprehensionPatch(actor, $event.target.value)"
          />
        </label>
        <label>
          <span>亲密等级</span>
          <input
            type="number"
            min="1"
            max="10"
            step="1"
            :value="actor.loadout.kiboConfig?.intimacyLevel ?? 1"
            data-testid="workbench-kibo-intimacy-input"
            @change="emitKiboConfigPatch(actor, { intimacyLevel: numberValue($event.target.value) })"
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
            <label class="source-level-control">
              <span>强化</span>
              <input
                type="number"
                min="0"
                max="9"
                step="1"
                :value="actor.loadout?.equipmentLevels?.[entry.slotKey] ?? ''"
                :data-equipment-slot="entry.slotKey"
                data-testid="workbench-equipment-level-input"
                placeholder="最高"
                @change="emitEquipmentLevelPatch(actor, entry.slotKey, $event.target.value)"
              />
            </label>
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
            <div class="source-level-pair">
              <label class="source-level-control">
                <span>等级</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  :value="actor.loadout?.soulessenceLevel ?? ''"
                  data-testid="workbench-soulessence-level-input"
                  placeholder="最高"
                  @change="emitSoulessencePatch(actor, 'soulessenceLevel', $event.target.value)"
                />
              </label>
              <label class="source-level-control">
                <span>临阶</span>
                <input
                  type="number"
                  min="1"
                  max="6"
                  step="1"
                  :value="actor.loadout?.soulessenceRank ?? ''"
                  data-testid="workbench-soulessence-rank-input"
                  placeholder="最高"
                  @change="emitSoulessencePatch(actor, 'soulessenceRank', $event.target.value)"
                />
              </label>
            </div>
          </div>
        </template>
      </div>

      <div
        class="verified-property-panel"
        :data-property-status="actor.verifiedStaticProperties?.status"
        data-testid="workbench-verified-static-property-panel"
      >
        <div class="loadout-detail-heading">
          <strong>实算角色面板</strong>
          <small>{{ staticPropertyStatus(actor) }}</small>
        </div>
        <div
          v-if="actor.verifiedStaticProperties?.ready"
          class="property-value-grid"
        >
          <div v-for="entry in actorCoreProperties(actor)" :key="entry.key">
            <span>{{ entry.label }}</span>
            <strong>{{ entry.value }}</strong>
          </div>
          <div v-for="entry in actorAdvancedProperties(actor)" :key="entry.key">
            <span>{{ entry.label }}</span>
            <strong>{{ entry.value }}</strong>
          </div>
        </div>
        <div
          v-if="actor.verifiedStaticKiboProperties?.ready"
          class="kibo-property-block"
          data-testid="workbench-verified-kibo-property-panel"
        >
          <div class="loadout-detail-heading">
            <strong>实算奇波面板</strong>
            <small>含亲密继承</small>
          </div>
          <div class="property-value-grid">
            <div v-for="entry in kiboCoreProperties(actor)" :key="entry.key">
              <span>{{ entry.label }}</span>
              <strong>{{ entry.value }}</strong>
            </div>
          </div>
          <small class="inheritance-summary">
            {{ kiboInheritanceSummary(actor) }}
          </small>
        </div>
        <ul
          v-if="actor.verifiedStaticProperties?.unresolved?.length"
          class="property-diagnostics"
        >
          <li
            v-for="(issue, issueIndex) in actor.verifiedStaticProperties.unresolved"
            :key="`${issue.kind}-${issueIndex}`"
          >
            {{ issue.reason }}
          </li>
        </ul>
        <details
          v-if="actor.verifiedStaticProperties?.sources?.length"
          class="property-source-details"
        >
          <summary>来源明细</summary>
          <div
            v-for="source in actor.verifiedStaticProperties.sources"
            :key="`${source.kind}-${source.sourceId}`"
            class="property-source-entry"
          >
            <strong>{{ sourceKindLabel(source.kind) }}</strong>
            <span>{{ sourceAttributeSummary(actor, source) }}</span>
            <small>{{ source.sourceIdentity }}</small>
          </div>
          <div
            v-for="source in actor.verifiedStaticProperties.unapplied"
            :key="`unapplied-${source.kind}-${source.sourceId}`"
            class="property-source-entry is-unapplied"
          >
            <strong>{{ sourceKindLabel(source.kind) }}</strong>
            <span>动态层未应用</span>
            <small>{{ source.sourceIdentity }}</small>
          </div>
        </details>
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

function emitActorLevelPatch(actor, value) {
  emit('update-actor-config', {
    characterId: Number(actor.characterId),
    level: numberValue(value),
  });
}

function emitCultivationPatch(actor, key, value) {
  emit('update-actor-config', {
    characterId: Number(actor.characterId),
    cultivation: { [key]: numberValue(value) },
  });
}

function emitKiboConfigPatch(actor, patch) {
  emit('update-actor-config', {
    characterId: Number(actor.characterId),
    loadout: { kiboConfig: patch },
  });
}

function emitKiboComprehensionPatch(actor, value) {
  const amount = numberValue(value);
  emitKiboConfigPatch(actor, {
    comprehensionByAttribute: Object.fromEntries(
      [1, 3, 4, 5].map(attributeId => [attributeId, amount])
    ),
  });
}

function emitEquipmentLevelPatch(actor, slotKey, value) {
  emit('update-actor-config', {
    characterId: Number(actor.characterId),
    loadout: {
      equipmentLevels: {
        [slotKey]: optionalNumberValue(value),
      },
    },
  });
}

function emitSoulessencePatch(actor, key, value) {
  emit('update-actor-config', {
    characterId: Number(actor.characterId),
    loadout: { [key]: optionalNumberValue(value) },
  });
}

function energyStep(actor) {
  return Number(actor.stats?.maxSp) <= 1 ? 0.01 : 1;
}

function formatSpValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : '';
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function optionalNumberValue(value) {
  return String(value ?? '').trim() === '' ? null : numberValue(value);
}

function kiboComprehension(actor) {
  return actor.loadout?.kiboConfig?.comprehensionByAttribute?.[1] ?? 100;
}

function staticPropertyStatus(actor) {
  const properties = actor.verifiedStaticProperties;
  if (properties?.ready) return `Lv.${properties.level} · 已应用`;
  return properties?.status ?? '等待机制包';
}

function actorCoreProperties(actor) {
  const core = actor.verifiedStaticProperties?.core ?? {};
  return [
    propertyEntry('ATK', '攻击', core.ATK?.displayValue),
    propertyEntry('MAXHP', '生命', core.MAXHP?.displayValue),
    propertyEntry('DEF', '物防', core.DEF?.displayValue),
    propertyEntry('MDEF', '魔防', core.MDEF?.displayValue),
  ].filter(entry => entry.value !== '未解析');
}

function actorAdvancedProperties(actor) {
  return [
    formattedAttributeEntry(actor, 7, '暴击'),
    formattedAttributeEntry(actor, 8, '暴伤'),
    formattedAttributeEntry(actor, 21, '增伤'),
    formattedAttributeEntry(actor, 229, '调谐'),
  ].filter(Boolean);
}

function kiboCoreProperties(actor) {
  const core = actor.verifiedStaticKiboProperties?.core ?? {};
  return [
    propertyEntry('ATK', '攻击', core.ATK?.displayValue),
    propertyEntry('MAXHP', '生命', core.MAXHP?.displayValue),
    propertyEntry('DEF', '物防', core.DEF?.displayValue),
    propertyEntry('MDEF', '魔防', core.MDEF?.displayValue),
  ].filter(entry => entry.value !== '未解析');
}

function kiboInheritanceSummary(actor) {
  const inheritance = actor.verifiedStaticKiboProperties?.inheritance;
  const attack = inheritance?.core?.ATK;
  if (!attack) return '角色继承未解析';
  return `亲密 ${formatPercent(inheritance.rate)} · 攻击继承 ${attack.inheritedBase} + ${attack.inheritedAdd}`;
}

function propertyEntry(key, label, value) {
  return {
    key,
    label,
    value: Number.isFinite(Number(value)) ? formatNumber(value) : '未解析',
  };
}

function formattedAttributeEntry(actor, attributeId, label) {
  const attribute = actor.verifiedStaticProperties?.attributes?.find(
    entry => Number(entry.id) === Number(attributeId)
  );
  if (!attribute) return null;
  return {
    key: attribute.key,
    label,
    value:
      attribute.rawScale === 10000
        ? formatPercent(attribute.runtimeValue)
        : formatNumber(attribute.displayValue ?? attribute.rawValue),
  };
}

function sourceKindLabel(kind) {
  return (
    {
      'actor-level-template': '等级模板',
      'star-gift-rank': '星赐',
      favorability: '好感度',
      'soulessence-level': '灵子等级',
      'soulessence-rank': '灵子临阶',
      'equipment-main': '装备主词条',
      'equipment-sub': '装备副词条',
      'soulessence-effect-skill': '灵子效果',
      'accessory-set-skill': '套装效果',
    }[kind] ?? kind
  );
}

function sourceAttributeSummary(actor, source) {
  const definitions = new Map(
    (actor.verifiedStaticProperties?.attributes ?? []).map(attribute => [
      Number(attribute.id),
      attribute,
    ])
  );
  return (source.attributes ?? [])
    .map(attribute => {
      const definition = definitions.get(Number(attribute.id));
      const value =
        definition?.rawScale === 10000
          ? `${formatNumber(Number(attribute.value) / 100)}%`
          : formatNumber(attribute.value);
      return `${definition?.key ?? attribute.id} ${value}`;
    })
    .join(' · ');
}

function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 4,
  }).format(Number(value));
}

function formatPercent(value) {
  return `${formatNumber(Number(value) * 100)}%`;
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

.cultivation-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 0 14px 14px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
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

.source-level-control,
.source-level-pair {
  grid-column: 3;
}

.source-level-pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.source-level-control {
  grid-template-columns: 42px minmax(0, 1fr);
  align-items: center;
}

.source-level-control input {
  padding-block: 4px;
}

.verified-property-panel {
  display: grid;
  gap: 10px;
  margin: 0 14px 14px;
  padding-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.verified-property-panel > .loadout-detail-heading,
.kibo-property-block .loadout-detail-heading {
  border-bottom: 0;
}

.verified-property-panel .loadout-detail-heading small {
  color: #8dd8c9;
  font-size: 10px;
}

.property-value-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
}

.property-value-grid > div {
  display: grid;
  gap: 3px;
  min-width: 0;
  padding: 7px;
  background: #171d22;
}

.property-value-grid span,
.property-value-grid strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.property-value-grid span {
  color: #8f9aa3;
  font-size: 9px;
}

.property-value-grid strong {
  color: #e8efed;
  font-size: 11px;
}

.kibo-property-block {
  display: grid;
  gap: 6px;
}

.inheritance-summary {
  color: #8f9aa3;
  font-size: 10px;
}

.property-diagnostics {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 8px 8px 8px 24px;
  border: 1px solid rgba(218, 145, 112, 0.28);
  border-radius: 4px;
  color: #e1aa91;
  font-size: 10px;
}

.property-source-details > summary {
  color: #aeb8bc;
  cursor: pointer;
  font-size: 11px;
}

.property-source-entry {
  display: grid;
  gap: 2px;
  padding: 7px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.property-source-entry strong,
.property-source-entry span,
.property-source-entry small {
  overflow-wrap: anywhere;
}

.property-source-entry strong {
  color: #dce7e4;
  font-size: 10px;
}

.property-source-entry span,
.property-source-entry small {
  color: #78858c;
  font-size: 9px;
}

.property-source-entry.is-unapplied strong {
  color: #c6aa77;
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
  .loadout-controls,
  .cultivation-controls {
    grid-template-columns: 1fr;
  }

  .property-value-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
