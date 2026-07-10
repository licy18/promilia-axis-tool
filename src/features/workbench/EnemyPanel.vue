<template>
  <section class="panel enemy-panel">
    <div class="panel-title">
      <Operation class="panel-icon" />
      <h2>敌人</h2>
    </div>

    <div class="enemy-summary">
      <div>
        <span>目标</span>
        <strong data-testid="workbench-enemy-name">{{ enemy.name }}</strong>
      </div>
      <div>
        <span>等级</span>
        <strong data-testid="workbench-enemy-level"
          >Lv.{{ enemy.level }}</strong
        >
      </div>
    </div>

    <div class="stat-grid">
      <div>
        <span>生命</span>
        <strong>{{ formatNumber(enemy.stats?.maxHp) }}</strong>
      </div>
      <div>
        <span>物防</span>
        <strong>{{ formatNumber(enemy.stats?.physicalDefense) }}</strong>
      </div>
      <div>
        <span>魔防</span>
        <strong>{{ formatNumber(enemy.stats?.magicalDefense) }}</strong>
      </div>
      <div
        :data-toughness-source-status="enemy.toughness?.sourceStatus"
        data-testid="workbench-enemy-toughness-stat"
      >
        <span>韧性 初始 / 上限</span>
        <strong>{{ formatToughnessState(enemy.stats) }}</strong>
      </div>
      <div>
        <span>倍率</span>
        <strong
          >{{ enemy.hpMultiplier }}x / {{ enemy.defenseMultiplier }}x</strong
        >
      </div>
    </div>

    <div class="control-grid">
      <label>
        <span>等级</span>
        <input
          type="number"
          data-testid="workbench-enemy-level-input"
          min="1"
          max="200"
          :value="enemyConfig.level"
          @input="emitNumberPatch('level', $event.target.value)"
        />
      </label>
      <label>
        <span>生命倍率</span>
        <input
          type="number"
          data-testid="workbench-enemy-hp-multiplier-input"
          min="0.1"
          max="100"
          step="0.1"
          :value="enemyConfig.hpMultiplier"
          @input="emitNumberPatch('hpMultiplier', $event.target.value)"
        />
      </label>
      <label>
        <span>防御倍率</span>
        <input
          type="number"
          data-testid="workbench-enemy-defense-multiplier-input"
          min="0.1"
          max="100"
          step="0.1"
          :value="enemyConfig.defenseMultiplier"
          @input="emitNumberPatch('defenseMultiplier', $event.target.value)"
        />
      </label>
      <label>
        <span>韧性倍率</span>
        <input
          type="number"
          data-testid="workbench-enemy-toughness-multiplier-input"
          min="0.1"
          max="100"
          step="0.1"
          :value="enemyConfig.toughnessMultiplier"
          @input="emitNumberPatch('toughnessMultiplier', $event.target.value)"
        />
      </label>
      <label>
        <span>初始韧性 %</span>
        <input
          type="number"
          data-testid="workbench-enemy-initial-toughness-input"
          min="0"
          max="100"
          step="1"
          :value="Math.round(enemyConfig.initialToughnessRatio * 100)"
          @input="
            emitPercentPatch('initialToughnessRatio', $event.target.value)
          "
        />
      </label>
    </div>

    <div
      class="element-defense-editor"
      :data-formula-status="enemy.elementDefenseConfig?.formulaStatus"
      data-testid="workbench-enemy-element-defense-editor"
    >
      <div class="element-defense-header">
        <strong>元素伤害减免</strong>
        <span>表值</span>
        <span>项目值</span>
      </div>
      <div class="element-defense-grid">
        <label
          v-for="row in enemy.elementDefenses"
          :key="row.attributeKey"
          class="element-defense-row"
          :data-source-status="row.sourceStatus"
          :data-testid="`workbench-enemy-element-defense-${row.attributeKey}`"
          :title="row.attributeName"
        >
          <span class="element-defense-name">
            <i :style="{ backgroundColor: row.color || '#8f9aa3' }"></i>
            {{ row.elementAbbrName }}
          </span>
          <span class="element-defense-base">{{
            formatRatio(row.baseValue)
          }}</span>
          <input
            type="number"
            :data-testid="`workbench-enemy-element-defense-input-${row.attributeKey}`"
            step="1"
            :placeholder="formatRatioInput(row.baseValue)"
            :value="formatRatioInput(row.overrideValue)"
            @input="
              emitElementDefensePatch(row.attributeKey, $event.target.value)
            "
          />
        </label>
      </div>
    </div>
  </section>
</template>

<script setup>
import { Operation } from '@element-plus/icons-vue';

const props = defineProps({
  enemy: {
    type: Object,
    required: true,
  },
  enemyConfig: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['update-enemy-config']);

function emitNumberPatch(key, value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return;
  }
  emit('update-enemy-config', {
    [key]: number,
  });
}

function emitPercentPatch(key, value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return;
  }
  emit('update-enemy-config', {
    [key]: number / 100,
  });
}

function emitElementDefensePatch(attributeKey, value) {
  const overrides = { ...props.enemyConfig.elementDefenseOverrides };
  if (String(value).trim() === '') {
    delete overrides[attributeKey];
  } else {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return;
    }
    overrides[attributeKey] = number / 100;
  }
  emit('update-enemy-config', {
    elementDefenseOverrides: overrides,
  });
}

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString('zh-CN');
}

function formatToughnessState(stats = {}) {
  if (stats.initialToughness == null || stats.maxToughness == null) {
    return '暂无表值';
  }
  const initial = Number(stats.initialToughness);
  const maximum = Number(stats.maxToughness);
  if (!Number.isFinite(initial) || !Number.isFinite(maximum)) {
    return '暂无表值';
  }
  return `${formatNumber(initial)} / ${formatNumber(maximum)}`;
}

function formatRatio(value) {
  if (!Number.isFinite(value)) {
    return '暂无';
  }
  return `${formatRatioInput(value)}%`;
}

function formatRatioInput(value) {
  if (!Number.isFinite(value)) {
    return '';
  }
  return String(Math.round(value * 1000000) / 10000);
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

.enemy-summary,
.stat-grid,
.control-grid,
.element-defense-editor {
  display: grid;
  gap: 10px;
  padding: 14px;
}

.enemy-summary {
  grid-template-columns: minmax(0, 1fr) auto;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.stat-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.stat-grid div {
  min-width: 0;
  padding: 9px 10px;
  border-radius: 4px;
  background: #232a31;
}

.control-grid {
  padding-top: 0;
}

.element-defense-editor {
  gap: 8px;
  padding-top: 0;
}

.element-defense-header,
.element-defense-row {
  display: grid;
  grid-template-columns: minmax(72px, 1fr) 64px minmax(82px, 1fr);
  align-items: center;
  gap: 8px;
}

.element-defense-header {
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.element-defense-header strong {
  font-size: 13px;
}

.element-defense-header span {
  text-align: right;
}

.element-defense-grid {
  display: grid;
  gap: 6px;
}

.element-defense-name {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #dce4e9;
}

.element-defense-name i {
  width: 8px;
  height: 8px;
  flex: 0 0 8px;
  border-radius: 50%;
}

.element-defense-base {
  color: #b8c2c9;
  text-align: right;
}

.element-defense-row input {
  padding-block: 6px;
  text-align: right;
}

label {
  display: grid;
  gap: 6px;
}

span {
  display: block;
  color: #8f9aa3;
  font-size: 12px;
}

strong {
  display: block;
  overflow-wrap: anywhere;
  color: #ffffff;
  font-size: 14px;
}

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

input:focus {
  outline: none;
  border-color: #79c7b9;
  box-shadow: 0 0 0 2px rgba(121, 199, 185, 0.14);
}
</style>
