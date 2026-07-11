<template>
  <section
    class="workspace-layout-bar"
    :data-layout-mode="layout.mode"
    data-testid="workbench-layout-bar"
    aria-label="工作区布局"
  >
    <button
      class="layout-icon-button"
      type="button"
      :title="layout.leftPanelCollapsed ? '展开动作库' : '折叠动作库'"
      :aria-label="layout.leftPanelCollapsed ? '展开动作库' : '折叠动作库'"
      data-testid="workbench-toggle-left-panel"
      @click="emit('toggle-panel', 'left')"
    >
      <ArrowRight v-if="layout.leftPanelCollapsed" />
      <ArrowLeft v-else />
    </button>

    <div class="layout-mode-segments" role="group" aria-label="布局模式">
      <button
        v-for="mode in modeOptions"
        :key="mode.key"
        type="button"
        :class="{ active: layout.mode === mode.key }"
        :data-layout-mode="mode.key"
        data-testid="workbench-layout-mode"
        @click="emit('set-mode', mode.key)"
      >
        <Aim v-if="mode.key === WORKBENCH_LAYOUT_MODES.BALANCED" />
        <EditPen v-else-if="mode.key === WORKBENCH_LAYOUT_MODES.EDIT" />
        <TrendCharts v-else />
        <span>{{ mode.label }}</span>
      </button>
    </div>

    <button
      class="layout-icon-button"
      type="button"
      :title="layout.rightPanelCollapsed ? '展开检查区' : '折叠检查区'"
      :aria-label="layout.rightPanelCollapsed ? '展开检查区' : '折叠检查区'"
      data-testid="workbench-toggle-right-panel"
      @click="emit('toggle-panel', 'right')"
    >
      <ArrowLeft v-if="layout.rightPanelCollapsed" />
      <ArrowRight v-else />
    </button>

    <button
      class="layout-icon-button reset"
      type="button"
      title="重置工作区布局"
      aria-label="重置工作区布局"
      data-testid="workbench-reset-layout"
      @click="emit('reset')"
    >
      <Refresh />
    </button>
  </section>
</template>

<script setup>
import {
  Aim,
  ArrowLeft,
  ArrowRight,
  EditPen,
  Refresh,
  TrendCharts,
} from '@element-plus/icons-vue';
import { WORKBENCH_LAYOUT_MODES } from '../../domain/workbenchLayout';

defineProps({
  layout: { type: Object, required: true },
});
const emit = defineEmits(['set-mode', 'toggle-panel', 'reset']);
const modeOptions = Object.freeze([
  { key: WORKBENCH_LAYOUT_MODES.BALANCED, label: '均衡' },
  { key: WORKBENCH_LAYOUT_MODES.EDIT, label: '编辑' },
  { key: WORKBENCH_LAYOUT_MODES.REVIEW, label: '复盘' },
]);
</script>

<style scoped>
.workspace-layout-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-height: 42px;
  padding: 6px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: #11171b;
}
.layout-icon-button,
.layout-mode-segments button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  min-height: 30px;
  border: 1px solid #354149;
  background: #1a2227;
  color: #b7c2c8;
  cursor: pointer;
  font: inherit;
}
.layout-icon-button {
  padding: 0;
  border-radius: 4px;
}
.layout-icon-button.reset {
  margin-left: 2px;
}
.layout-icon-button svg,
.layout-mode-segments svg {
  width: 14px;
  height: 14px;
}
.layout-icon-button:hover,
.layout-mode-segments button:hover {
  border-color: #608078;
  color: #ecfffb;
}
.layout-mode-segments {
  display: inline-flex;
  align-items: stretch;
  border-radius: 4px;
  overflow: hidden;
}
.layout-mode-segments button {
  gap: 5px;
  min-width: 68px;
  padding: 0 9px;
  border-radius: 0;
  border-right-width: 0;
  font-size: 11px;
  font-weight: 700;
}
.layout-mode-segments button:last-child {
  border-right-width: 1px;
}
.layout-mode-segments button.active {
  border-color: #5f9b8f;
  background: #21423c;
  color: #effffc;
}
@media (max-width: 760px) {
  .workspace-layout-bar {
    display: none;
  }
}
</style>
