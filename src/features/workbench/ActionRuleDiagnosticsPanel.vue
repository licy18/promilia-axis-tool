<template>
  <section
    class="panel action-rule-panel"
    :data-executable="diagnostics.executable ? 'true' : 'false'"
    :data-unresolved-count="summary.unresolvedCount"
    :data-violation-count="summary.violationCount"
    data-testid="workbench-action-rule-panel"
  >
    <div class="panel-title">
      <Operation class="panel-icon" />
      <h2>排轴规则</h2>
      <strong>{{ summary.violationCount }} 错误</strong>
    </div>

    <div class="rule-summary" data-testid="workbench-action-rule-summary">
      <span>
        <strong>{{ summary.violationCount }}</strong>
        <small>需修正</small>
      </span>
      <span>
        <strong>{{ summary.unresolvedCount }}</strong>
        <small>待确认</small>
      </span>
      <span>
        <strong>{{ summary.affectedActionCount }}</strong>
        <small>受影响动作</small>
      </span>
    </div>

    <p
      v-if="diagnosticRows.length === 0"
      class="rule-empty"
      data-testid="workbench-action-rule-empty"
    >
      当前检查项通过
    </p>

    <ol v-else class="rule-list">
      <li
        v-for="item in diagnosticRows"
        :key="item.id"
        :class="{ selected: item.actionId === selectedActionId }"
        :data-action-id="item.actionId"
        :data-rule-code="item.code"
        :data-rule-severity="item.severity"
        :data-rule-status="item.status"
        data-testid="workbench-action-rule-row"
      >
        <div class="rule-row-heading">
          <span>{{ formatRuleLabel(item.code) }}</span>
          <strong>{{ item.actionName || item.actionId }}</strong>
        </div>
        <p>{{ item.message }}</p>
        <small>{{ formatRuleSource(item) }}</small>
        <div class="rule-actions">
          <button
            type="button"
            :data-action-id="item.actionId"
            data-testid="workbench-action-rule-locate"
            @click="$emit('locate-action', item)"
          >
            <Aim class="rule-action-icon" />
            <span>定位动作</span>
          </button>
          <button
            v-if="hasSuggestedStart(item)"
            type="button"
            :data-action-id="item.actionId"
            :data-suggested-start-ms="item.suggestedStartMs"
            data-testid="workbench-action-rule-apply-start"
            @click="$emit('apply-suggested-start', item)"
          >
            <Timer class="rule-action-icon" />
            <span>移至 {{ formatSuggestedFrame(item) }}</span>
          </button>
        </div>
      </li>
    </ol>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { Aim, Operation, Timer } from '@element-plus/icons-vue';
import { msToFrame } from '../../domain/timebase';
import { ACTION_RULE_CODES } from '../../simulation/runtime/actionRuleDiagnostics';

const props = defineProps({
  diagnostics: {
    type: Object,
    default: () => ({
      executable: true,
      diagnostics: [],
      summary: {
        violationCount: 0,
        unresolvedCount: 0,
        affectedActionCount: 0,
      },
    }),
  },
  selectedActionId: {
    type: String,
    default: '',
  },
});

defineEmits(['locate-action', 'apply-suggested-start']);

const summary = computed(
  () =>
    props.diagnostics?.summary ?? {
      violationCount: 0,
      unresolvedCount: 0,
      affectedActionCount: 0,
    }
);
const diagnosticRows = computed(() => props.diagnostics?.diagnostics ?? []);

function hasSuggestedStart(item) {
  return (
    item?.suggestedStartMs != null &&
    item.suggestedStartMs !== '' &&
    Number.isFinite(Number(item.suggestedStartMs))
  );
}

function formatSuggestedFrame(item) {
  return `${msToFrame(item.suggestedStartMs)}F`;
}

function formatRuleLabel(code) {
  if (code === ACTION_RULE_CODES.LANE_OVERLAP) {
    return '动作重叠';
  }
  if (code === ACTION_RULE_CODES.SKILL_COOLDOWN_ACTIVE) {
    return '技能冷却';
  }
  if (
    code === ACTION_RULE_CODES.SKILL_SP_PRECONDITION_UNRESOLVED ||
    code === 'verified-resource-cost-unavailable'
  ) {
    return 'SP 条件';
  }
  return code;
}

function formatRuleSource(item) {
  if (item.code === ACTION_RULE_CODES.SKILL_COOLDOWN_ACTIVE) {
    return `可用时间 ${item.readyAtMs}ms · ${item.source?.fieldPath ?? 'skillsub_logic'}`;
  }
  return `${item.actorName ?? item.actorId} · ${item.range?.durationMs ?? 0}ms`;
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
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.panel-title h2 {
  margin: 0;
  font-size: 15px;
}

.panel-title > strong {
  margin-left: auto;
  color: #ffb3b3;
  font-size: 12px;
}

.panel-icon {
  width: 17px;
  height: 17px;
  color: #f2b366;
}

.rule-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.rule-summary > span {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 9px 8px;
  border-right: 1px solid rgba(255, 255, 255, 0.07);
  text-align: center;
}

.rule-summary > span:last-child {
  border-right: 0;
}

.rule-summary strong {
  color: #ffffff;
  font-size: 14px;
}

.rule-summary small {
  overflow: hidden;
  color: #8f9aa3;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rule-empty {
  margin: 0;
  padding: 14px;
  color: #79c7b9;
  font-size: 12px;
}

.rule-list {
  display: grid;
  max-height: 420px;
  margin: 0;
  padding: 0 14px;
  overflow: auto;
  list-style: none;
}

.rule-list li {
  display: grid;
  gap: 6px;
  padding: 11px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.rule-list li.selected {
  margin: 0 -8px;
  padding-right: 8px;
  padding-left: 8px;
  background: rgba(242, 179, 102, 0.08);
}

.rule-row-heading {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
  min-width: 0;
}

.rule-row-heading span {
  color: #f2b366;
  font-size: 11px;
  font-weight: 800;
}

.rule-row-heading strong {
  overflow: hidden;
  color: #f4f7f8;
  font-size: 12px;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rule-list li[data-rule-severity='error'] .rule-row-heading span {
  color: #ff9f9f;
}

.rule-list p {
  margin: 0;
  color: #d1d8dd;
  font-size: 12px;
  line-height: 1.5;
}

.rule-list small {
  overflow-wrap: anywhere;
  color: #7f8991;
  font-size: 10px;
}

.rule-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.rule-actions button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 28px;
  padding: 0 8px;
  border: 1px solid rgba(121, 199, 185, 0.28);
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.09);
  color: #dff9f3;
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
}

.rule-action-icon {
  width: 13px;
  height: 13px;
}
</style>
