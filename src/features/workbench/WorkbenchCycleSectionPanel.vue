<template>
  <section
    v-if="projection.summary.boundaryCount > 0"
    class="panel cycle-section-panel"
    :data-selected-section-id="selectedSection?.sectionId || ''"
    data-testid="workbench-cycle-section-panel"
  >
    <header class="panel-header">
      <div>
        <span>循环复盘</span>
        <h2>区段统计</h2>
      </div>
      <small>{{ projection.summary.boundaryCount }} 个边界</small>
    </header>

    <div class="section-tabs" role="tablist" aria-label="循环区段">
      <button
        v-for="section in projection.sections"
        :key="section.sectionId"
        class="section-tab"
        :class="{ active: section.sectionId === selectedSection?.sectionId }"
        type="button"
        role="tab"
        :aria-selected="section.sectionId === selectedSection?.sectionId"
        :data-section-id="section.sectionId"
        data-testid="workbench-cycle-section-tab"
        @click="emit('select-section', section.sectionId)"
      >
        <strong>{{ section.label }}</strong>
        <span>{{ formatRange(section) }}</span>
      </button>
    </div>

    <template v-if="selectedSection">
      <div class="metric-grid">
        <div data-metric-key="durationMs">
          <span>区段时长</span
          ><strong>{{ formatFrames(selectedSection.durationMs) }}</strong>
        </div>
        <div data-metric-key="enemyHpDelta">
          <span>敌人 HP 伤害</span
          ><strong>{{
            formatNumber(selectedSection.metrics.enemyHpDelta)
          }}</strong>
        </div>
        <div data-metric-key="enemyToughnessDelta">
          <span>敌人韧性削减</span
          ><strong>{{
            formatNumber(selectedSection.metrics.enemyToughnessDelta)
          }}</strong>
        </div>
        <div data-metric-key="selfEnergyDelta">
          <span>自身能量变化</span
          ><strong>{{
            formatSigned(selectedSection.metrics.selfEnergyDelta)
          }}</strong>
        </div>
        <div data-metric-key="effectCoverageMs">
          <span>效果覆盖</span
          ><strong>{{
            formatFrames(selectedSection.metrics.effectCoverageMs)
          }}</strong>
        </div>
      </div>

      <div class="analysis-grid">
        <section class="analysis-block">
          <h3>角色能量</h3>
          <div class="compact-table">
            <div class="table-head actor-columns">
              <span>角色</span><span>变化</span><span>事务</span>
            </div>
            <div
              v-for="actor in selectedSection.actors"
              :key="actor.actorId"
              class="table-row actor-columns"
              data-testid="workbench-cycle-section-actor-row"
            >
              <strong>{{ actor.name }}</strong>
              <span :class="deltaClass(actor.selfEnergyDelta)">{{
                formatSigned(actor.selfEnergyDelta)
              }}</span>
              <span>{{ actor.transactionCount }}</span>
            </div>
          </div>
        </section>

        <section class="analysis-block">
          <h3>效果覆盖</h3>
          <div v-if="selectedSection.effects.length" class="compact-table">
            <div class="table-head effect-columns">
              <span>效果</span><span>目标</span><span>覆盖</span>
            </div>
            <div
              v-for="effect in selectedSection.effects"
              :key="effect.key"
              class="table-row effect-columns"
              data-testid="workbench-cycle-section-effect-row"
            >
              <strong>{{ effect.name }}</strong
              ><span>{{ effect.targetName }}</span
              ><span>{{ formatFrames(effect.coverageMs) }}</span>
            </div>
          </div>
          <div v-else class="empty-row">本区段无效果覆盖</div>
        </section>
      </div>

      <section class="analysis-block">
        <h3>动作贡献</h3>
        <div v-if="selectedSection.actions.length" class="action-table-scroll">
          <div class="compact-table action-table">
            <div class="table-head action-columns">
              <span>动作</span><span>HP</span><span>韧性</span><span>能量</span
              ><span>命中</span><span>效果</span><span></span>
            </div>
            <div
              v-for="action in selectedSection.actions"
              :key="action.actionId"
              class="table-row action-columns"
              :data-action-id="action.actionId"
              data-testid="workbench-cycle-section-action-row"
            >
              <div class="action-name">
                <strong>{{ action.name }}</strong
                ><small>{{ action.actorName }}</small>
              </div>
              <span>{{ formatNumber(action.enemyHpDelta) }}</span>
              <span>{{ formatNumber(action.enemyToughnessDelta) }}</span>
              <span :class="deltaClass(action.selfEnergyDelta)">{{
                formatSigned(action.selfEnergyDelta)
              }}</span>
              <span>{{ action.hitCount }}</span
              ><span>{{ action.effectEventCount }}</span>
              <button
                class="locate-button"
                type="button"
                title="回到动作修改"
                :data-action-id="action.actionId"
                data-testid="workbench-cycle-section-locate-action"
                @click="emit('locate-action', action.actionId)"
              >
                <EditPen />
              </button>
            </div>
          </div>
        </div>
        <div v-else class="empty-row">本区段无动作或运行事件</div>
      </section>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { EditPen } from '@element-plus/icons-vue';
import { formatFrameTime, msToFrame } from '../../domain/timebase';

const props = defineProps({
  projection: { type: Object, required: true },
  selectedSectionId: { type: String, default: '' },
});
const emit = defineEmits(['select-section', 'locate-action']);
const selectedSection = computed(
  () =>
    props.projection.sections.find(
      section => section.sectionId === props.selectedSectionId
    ) ??
    props.projection.sections[0] ??
    null
);

function formatRange(section) {
  return `${formatFrameTime(section.startMs)}-${formatFrameTime(section.endMs)}`;
}
function formatFrames(value) {
  return `${formatNumber(msToFrame(value))}F`;
}
function formatSigned(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? '+' : ''}${formatNumber(number)}`;
}
function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 3 }).format(
    Number(value) || 0
  );
}
function deltaClass(value) {
  const number = Number(value) || 0;
  return number > 0 ? 'delta-positive' : number < 0 ? 'delta-negative' : '';
}
</script>

<style scoped>
.panel {
  min-width: 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid #313b43;
  border-radius: 6px;
  background: #151a1f;
  color: #edf2f4;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 13px 15px;
  border-bottom: 1px solid #2e373e;
}
.panel-header span,
.panel-header small {
  color: #839199;
  font-size: 10px;
  font-weight: 800;
}
.panel-header h2 {
  margin: 2px 0 0;
  font-size: 15px;
  letter-spacing: 0;
}
.section-tabs {
  display: flex;
  gap: 6px;
  padding: 10px 15px;
  overflow-x: auto;
  border-bottom: 1px solid #2e373e;
  background: #11161a;
}
.section-tab {
  display: grid;
  flex: 0 0 auto;
  gap: 2px;
  min-width: 112px;
  padding: 7px 10px;
  border: 1px solid #37424a;
  border-radius: 4px;
  background: #1b2227;
  color: #d5dee2;
  text-align: left;
  cursor: pointer;
}
.section-tab.active {
  border-color: #79c7b9;
  background: #21423d;
  color: #f1fffc;
}
.section-tab span {
  color: #8d9aa2;
  font-size: 10px;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(110px, 1fr));
  border-bottom: 1px solid #2e373e;
}
.metric-grid > div {
  display: grid;
  gap: 3px;
  padding: 11px 13px;
  border-right: 1px solid #2e373e;
}
.metric-grid > div:last-child {
  border-right: 0;
}
.metric-grid span {
  color: #85939b;
  font-size: 10px;
}
.metric-grid strong {
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
.analysis-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid #2e373e;
}
.analysis-block {
  min-width: 0;
  padding: 12px 15px 15px;
}
.analysis-grid .analysis-block + .analysis-block {
  border-left: 1px solid #2e373e;
}
.analysis-block h3 {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 0;
}
.compact-table {
  border: 1px solid #303a42;
  border-radius: 4px;
  overflow: hidden;
}
.table-head,
.table-row {
  display: grid;
  align-items: center;
  gap: 9px;
  min-height: 34px;
  padding: 0 10px;
}
.table-head {
  background: #101519;
  color: #7e8c94;
  font-size: 9px;
  font-weight: 800;
}
.table-row {
  border-top: 1px solid #293239;
  color: #c7d0d5;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.actor-columns,
.effect-columns {
  grid-template-columns: minmax(100px, 1fr) repeat(2, minmax(64px, 0.55fr));
}
.action-table-scroll {
  overflow-x: auto;
}
.action-table {
  min-width: 760px;
}
.action-columns {
  grid-template-columns:
    minmax(150px, 1.4fr) repeat(5, minmax(70px, 0.65fr))
    32px;
}
.action-name {
  display: grid;
  min-width: 0;
}
.action-name strong,
.action-name small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.action-name small {
  color: #7f8c94;
  font-size: 9px;
}
.locate-button {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid #3c484f;
  border-radius: 4px;
  background: #20282d;
  color: #dbe5e8;
  cursor: pointer;
}
.locate-button svg {
  width: 14px;
  height: 14px;
}
.empty-row {
  display: grid;
  place-items: center;
  min-height: 62px;
  border: 1px dashed #344049;
  border-radius: 4px;
  color: #78868e;
  font-size: 11px;
}
.delta-positive {
  color: #89d8c9;
}
.delta-negative {
  color: #ff9c9c;
}
@media (max-width: 760px) {
  .metric-grid {
    grid-template-columns: 1fr 1fr;
  }
  .metric-grid > div {
    border-bottom: 1px solid #2e373e;
  }
  .metric-grid > div:last-child {
    grid-column: 1 / -1;
  }
  .analysis-grid {
    grid-template-columns: 1fr;
  }
  .analysis-grid .analysis-block + .analysis-block {
    border-top: 1px solid #2e373e;
    border-left: 0;
  }
}
</style>
