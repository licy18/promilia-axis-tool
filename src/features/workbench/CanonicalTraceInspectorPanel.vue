<template>
  <section
    class="canonical-trace-inspector"
    :data-trace-hash="traceIndex?.traceHash ?? ''"
    data-testid="workbench-canonical-trace-inspector"
  >
    <div v-if="!action" class="trace-empty">请选择动作或运行事实</div>

    <template v-else>
      <header class="trace-action-header">
        <div>
          <span>Canonical trace</span>
          <strong>{{ action.name }}</strong>
        </div>
        <button
          type="button"
          data-testid="canonical-trace-locate-action"
          @click="locate(action.schedule.startMs, action.identity)"
        >
          {{ formatFrame(action.schedule.startMs) }}F
        </button>
      </header>

      <dl class="trace-contract-grid">
        <div>
          <dt>请求</dt>
          <dd>{{ requestedLabel }}</dd>
        </div>
        <div>
          <dt>实际形态</dt>
          <dd>{{ action.resolved.semanticName || action.name }}</dd>
        </div>
        <div>
          <dt>执行</dt>
          <dd>
            control {{ action.resolved.controlSkillId ?? 'N/A' }} / sub
            {{ action.resolved.subSkillIndex ?? 'N/A' }}
          </dd>
        </div>
        <div>
          <dt>占轴</dt>
          <dd>
            {{ formatFrame(action.schedule.startMs) }}F -
            {{ formatFrame(action.schedule.endMs) }}F
          </dd>
        </div>
        <div>
          <dt>就绪</dt>
          <dd>{{ action.readiness?.status ?? '未提供' }}</dd>
        </div>
        <div>
          <dt>来源状态</dt>
          <dd>
            {{ action.resolved.sourceEvidenceStatus ?? '未提供' }} /
            {{ action.resolved.scenarioRuntimeStatus ?? '未提供' }}
          </dd>
        </div>
      </dl>

      <section v-if="action.diagnostics.length" class="trace-section">
        <h3>条件与诊断</h3>
        <button
          v-for="diagnostic in action.diagnostics"
          :key="diagnosticKey(diagnostic)"
          type="button"
          class="trace-diagnostic"
          :data-diagnostic-code="diagnostic.code"
          @click="locateDiagnostic(diagnostic)"
        >
          <strong>{{ diagnostic.code }}</strong>
          <span>{{ diagnostic.message }}</span>
        </button>
      </section>

      <section class="trace-section">
        <h3>
          命中 <span>{{ action.hits.length }}</span>
        </h3>
        <div
          v-for="hit in action.hits"
          :key="hit.identity"
          class="trace-hit-row"
          :class="{ stale: hit.stale }"
          :data-hit-identity="hit.identity"
          :data-hit-stale="hit.stale ? 'true' : 'false'"
          data-testid="canonical-trace-hit-row"
        >
          <button
            type="button"
            class="trace-hit-locate"
            :title="hit.identity"
            @click="locateHit(hit)"
          >
            <strong>{{ hit.label }}</strong>
            <span>
              {{ hit.frame == null ? '未结算' : `${hit.frame}F` }}
              · HP -{{ formatNumber(hit.contribution.hpDamage) }} · 韧性 -{{
                formatNumber(hit.contribution.toughnessDamage)
              }}
            </span>
          </button>
          <label>
            <span>命中</span>
            <select
              :value="hit.landed"
              :disabled="hit.stale"
              :data-hit-identity="hit.identity"
              data-testid="canonical-trace-hit-landed"
              @change="updateLanded(hit, $event)"
            >
              <option value="inherit">继承</option>
              <option value="hit">命中</option>
              <option value="miss">未命中</option>
            </select>
          </label>
          <label>
            <span>暴击</span>
            <select
              :value="hit.criticalMode"
              :disabled="hit.stale"
              :data-hit-identity="hit.identity"
              data-testid="canonical-trace-hit-critical-mode"
              @change="updateCriticalMode(hit, $event)"
            >
              <option value="inherit">继承</option>
              <option value="sampled">采样</option>
              <option value="expected">期望</option>
              <option value="critical">暴击</option>
              <option value="non-critical">不暴击</option>
            </select>
          </label>
          <div v-if="hit.stale" class="trace-hit-stale">
            旧命中 identity 已失效，未重新绑定
          </div>
          <dl v-else-if="hit.critical" class="trace-critical-grid">
            <div>
              <dt>来源暴击率</dt>
              <dd data-testid="canonical-trace-critical-source-rate">
                {{
                  formatBasisPoints(hit.critical.sourceCriticalRateBasisPoints)
                }}
              </dd>
            </div>
            <div>
              <dt>目标抗暴</dt>
              <dd data-testid="canonical-trace-critical-target-defense">
                {{
                  formatBasisPoints(
                    hit.critical.targetCriticalDefenseBasisPoints
                  )
                }}
              </dd>
            </div>
            <div>
              <dt>有效暴击率</dt>
              <dd data-testid="canonical-trace-critical-effective-rate">
                {{
                  formatBasisPoints(hit.critical.effectiveThresholdBasisPoints)
                }}
              </dd>
            </div>
            <div>
              <dt>暴伤</dt>
              <dd data-testid="canonical-trace-critical-damage">
                {{
                  formatBasisPoints(
                    hit.critical.sourceCriticalDamageBasisPoints
                  )
                }}
              </dd>
            </div>
            <div v-if="hit.critical.roll != null">
              <dt>采样 Roll</dt>
              <dd data-testid="canonical-trace-critical-roll">
                {{ hit.critical.roll }} ·
                <span data-testid="canonical-trace-sampled-result">
                  {{ hit.critical.critical ? '暴击' : '未暴击' }}
                </span>
              </dd>
            </div>
            <template v-if="hit.critical.expectedResult">
              <div>
                <dt>期望加权伤害</dt>
                <dd data-testid="canonical-trace-expected-weighted-damage">
                  {{ formatNumber(hit.critical.expectedResult.weightedValue) }}
                </dd>
              </div>
              <div>
                <dt>暴击概率</dt>
                <dd data-testid="canonical-trace-expected-probability">
                  {{
                    formatBasisPoints(
                      hit.critical.expectedResult.probabilityBasisPoints
                    )
                  }}
                </dd>
              </div>
              <div>
                <dt>非暴击分支</dt>
                <dd data-testid="canonical-trace-expected-non-critical">
                  {{
                    formatNumber(hit.critical.expectedResult.nonCriticalValue)
                  }}
                </dd>
              </div>
              <div>
                <dt>暴击分支</dt>
                <dd data-testid="canonical-trace-expected-critical">
                  {{ formatNumber(hit.critical.expectedResult.criticalValue) }}
                </dd>
              </div>
              <div>
                <dt>暴击事件</dt>
                <dd data-testid="canonical-trace-critical-event-materialized">
                  {{
                    criticalEventMaterializedLabel(
                      hit.critical.expectedResult.criticalEventMaterialized
                    )
                  }}
                </dd>
              </div>
            </template>
          </dl>
        </div>
      </section>

      <section v-if="action.effectEvents.length" class="trace-section">
        <h3>
          效果事务 <span>{{ action.effectEvents.length }}</span>
        </h3>
        <button
          v-for="effect in action.effectEvents"
          :key="effect.identity"
          type="button"
          class="trace-fact-row"
          :data-effect-identity="effect.identity"
          data-testid="canonical-trace-effect-event"
          :title="formatSourceIdentity(effect.sourceIdentity)"
          @click="locate(effect.timeMs, effect.identity)"
        >
          <strong>{{ effect.name }}</strong>
          <span>
            {{ operationLabel(effect.operation) }} ·
            {{ formatOwnerTarget(effect) }} · {{ formatFrame(effect.timeMs) }}F
          </span>
          <small>
            {{ formatBeforeAfter(effect.before, effect.after) }}
            <template v-if="effect.modifiers.length">
              · {{ formatModifiers(effect.modifiers) }}
            </template>
            · {{ compactIdentity(effect.sourceIdentity) }}
          </small>
        </button>
      </section>

      <section v-if="action.effectIntervals.length" class="trace-section">
        <h3>
          效果区间 <span>{{ action.effectIntervals.length }}</span>
        </h3>
        <button
          v-for="interval in action.effectIntervals"
          :key="interval.identity"
          type="button"
          class="trace-fact-row"
          :data-effect-identity="interval.identity"
          data-testid="canonical-trace-effect-interval"
          :title="formatSourceIdentity(interval.sourceIdentity)"
          @click="locate(interval.startMs, interval.identity)"
        >
          <strong>{{ interval.name }}</strong>
          <span>
            {{ formatOwnerTarget(interval) }} ·
            {{ formatFrame(interval.startMs) }}F -
            {{
              interval.endMs == null
                ? '持续'
                : `${formatFrame(interval.endMs)}F`
            }}
            · {{ interval.stacks ?? 1 }} 层
          </span>
          <small>{{ compactIdentity(interval.sourceIdentity) }}</small>
        </button>
      </section>

      <section v-if="action.resourceTransactions.length" class="trace-section">
        <h3>
          资源事务 <span>{{ action.resourceTransactions.length }}</span>
        </h3>
        <button
          v-for="resource in action.resourceTransactions"
          :key="resource.identity"
          type="button"
          class="trace-fact-row"
          :data-resource-identity="resource.resourceIdentity"
          data-testid="canonical-trace-resource-event"
          :title="formatSourceIdentity(resource.sourceIdentity)"
          @click="locate(resource.timeMs, resource.identity)"
        >
          <strong>{{ resource.resourceIdentity }}</strong>
          <span>
            {{ resource.operation || resource.reason || 'change' }} ·
            {{ formatNumber(resource.before) }} →
            {{ formatNumber(resource.after) }}
            <template v-if="resource.maxValue != null">
              / {{ formatNumber(resource.maxValue) }}
            </template>
            · {{ formatFrame(resource.timeMs) }}F
          </span>
          <small>{{ compactIdentity(resource.sourceIdentity) }}</small>
        </button>
      </section>

      <section v-if="action.toughnessFacts.length" class="trace-section">
        <h3>韧性事实</h3>
        <div
          v-for="(fact, index) in action.toughnessFacts"
          :key="`${fact.kind}-${index}`"
          class="trace-toughness-row"
          :data-toughness-kind="fact.kind"
          data-testid="canonical-trace-toughness-fact"
        >
          <strong>{{ toughnessLabel(fact.kind) }}</strong>
          <span>{{ formatNumber(fact.amount) }}</span>
        </div>
      </section>

      <footer class="trace-source">
        <span>Trace</span>
        <code>{{ traceIndex.traceHash }}</code>
        <code :title="formatSourceIdentity(action.resolved.sourceIdentity)">
          {{ compactIdentity(action.resolved.sourceIdentity) }}
        </code>
      </footer>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  traceIndex: {
    type: Object,
    required: true,
  },
  selectedActionId: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['locate-fact', 'update-hit-override']);

const action = computed(
  () => props.traceIndex?.actionsById?.get(props.selectedActionId) ?? null
);
const requestedLabel = computed(() => {
  const intent = action.value?.requested?.intent;
  if (!intent) return 'Workbench 动作意图';
  const variant =
    intent.semanticVariant?.selectorIdentity ??
    intent.semanticVariant?.chargeTier ??
    '';
  return [intent.actionKind ?? intent.kind, intent.publicActionId, variant]
    .filter(value => value != null && value !== '')
    .join(' · ');
});

function updateLanded(hit, event) {
  emit('update-hit-override', {
    actionId: action.value.actionId,
    hitIdentity: hit.identity,
    landed: event.target.value,
    criticalMode: hit.criticalMode,
  });
}

function updateCriticalMode(hit, event) {
  emit('update-hit-override', {
    actionId: action.value.actionId,
    hitIdentity: hit.identity,
    landed: hit.landed,
    criticalMode: event.target.value,
  });
}

function locateHit(hit) {
  locate(
    hit.timeMs ??
      (hit.frame == null
        ? action.value.schedule.startMs
        : hit.frame * (1000 / 60)),
    hit.factIdentity
  );
}

function locate(timeMs, identity) {
  emit('locate-fact', {
    actionId: action.value?.actionId ?? '',
    identity,
    timeMs: Number(timeMs) || 0,
  });
}

function locateDiagnostic(diagnostic) {
  locate(diagnostic.timeMs ?? action.value.schedule.startMs, diagnostic.code);
}

function formatFrame(timeMs) {
  return Math.round((Number(timeMs) || 0) * 0.06);
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'N/A';
  return Number(number.toFixed(4)).toLocaleString('zh-CN', {
    maximumFractionDigits: 4,
  });
}

function formatBasisPoints(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? `${Number((number / 100).toFixed(2))}%`
    : 'N/A';
}

function criticalEventMaterializedLabel(value) {
  if (value === true) return '生成暴击事件';
  if (value === false) return '不生成暴击事件';
  return '未提供';
}

function operationLabel(value) {
  return (
    {
      apply: '施加',
      refresh: '刷新',
      stack: '叠层',
      consume: '消耗',
      remove: '移除',
      expire: '到期',
      transfer: '转移',
    }[value] ??
    value ??
    '变化'
  );
}

function toughnessLabel(kind) {
  if (kind === 'toughness-recovery') return '韧性恢复';
  if (kind === 'toughness-state-change') return '韧性状态变化';
  return '命中削韧';
}

function formatOwnerTarget(value) {
  const owner = value?.ownerId ?? null;
  const target = value?.targetId ?? value?.targetKind ?? '未指定目标';
  return owner && owner !== target ? [owner, target].join(' → ') : target;
}

function formatBeforeAfter(before, after) {
  const beforeValue =
    before?.stacks ?? before?.value ?? before?.currentValue ?? null;
  const afterValue =
    after?.stacks ?? after?.value ?? after?.currentValue ?? null;
  return beforeValue == null && afterValue == null
    ? '状态已记录'
    : `${formatNumber(beforeValue)} → ${formatNumber(afterValue)}`;
}

function formatModifiers(modifiers) {
  return modifiers
    .map(modifier => {
      const attribute = modifier.attributeId ?? modifier.kind ?? '属性';
      const value =
        modifier.valueRaw ?? modifier.formulaValue ?? modifier.value ?? 0;
      return `${attribute} ${formatNumber(value)}`;
    })
    .join(' · ');
}

function compactIdentity(value) {
  const text = formatSourceIdentity(value);
  if (!text) return '无来源';
  return text.length > 48 ? `${text.slice(0, 45)}...` : text;
}

function formatSourceIdentity(value) {
  if (value == null) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function diagnosticKey(diagnostic) {
  return [
    diagnostic.code,
    diagnostic.hitIdentity,
    diagnostic.timeMs,
    diagnostic.message,
  ].join('|');
}
</script>

<style scoped>
.canonical-trace-inspector {
  min-width: 0;
  color: #d9e2eb;
}

.trace-empty {
  padding: 20px 14px;
  color: #8795a4;
  font-size: 12px;
}

.trace-action-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid #2d3842;
}

.trace-action-header div {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.trace-action-header span,
.trace-contract-grid dt,
.trace-critical-grid dt,
.trace-source span {
  color: #82909e;
  font-size: 10px;
  text-transform: uppercase;
}

.trace-action-header strong {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trace-action-header button {
  min-width: 44px;
  height: 28px;
  border: 1px solid #536270;
  border-radius: 4px;
  background: #171d22;
  color: #dce7ef;
  font-size: 11px;
}

.trace-contract-grid,
.trace-critical-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
  margin: 0;
  padding: 12px 14px;
  border-bottom: 1px solid #2d3842;
}

.trace-contract-grid div,
.trace-critical-grid div {
  min-width: 0;
}

.trace-contract-grid dd,
.trace-critical-grid dd {
  margin: 2px 0 0;
  overflow-wrap: anywhere;
  color: #dce7ef;
  font-size: 11px;
}

.trace-section {
  display: grid;
  gap: 6px;
  padding: 11px 14px;
  border-bottom: 1px solid #2d3842;
}

.trace-section h3 {
  display: flex;
  justify-content: space-between;
  margin: 0 0 2px;
  color: #f1f5f8;
  font-size: 12px;
}

.trace-section h3 span {
  color: #8fa0ad;
  font-variant-numeric: tabular-nums;
}

.trace-diagnostic,
.trace-fact-row,
.trace-hit-locate {
  min-width: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
}

.trace-diagnostic,
.trace-fact-row {
  display: grid;
  gap: 2px;
  padding: 6px 0;
  border-bottom: 1px solid #242d35;
}

.trace-diagnostic:last-child,
.trace-fact-row:last-child {
  border-bottom: 0;
}

.trace-diagnostic strong,
.trace-fact-row strong,
.trace-hit-locate strong {
  color: #dce7ef;
  font-size: 11px;
}

.trace-diagnostic span,
.trace-fact-row span,
.trace-hit-locate span,
.trace-fact-row small {
  overflow-wrap: anywhere;
  color: #91a0ad;
  font-size: 10px;
}

.trace-hit-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 76px 92px;
  gap: 6px;
  align-items: end;
  padding: 7px 0;
  border-bottom: 1px solid #242d35;
}

.trace-hit-row:last-child {
  border-bottom: 0;
}

.trace-hit-row.stale {
  border-left: 2px solid #c77474;
  padding-left: 7px;
}

.trace-hit-locate {
  display: grid;
  gap: 2px;
  padding: 0;
}

.trace-hit-row label {
  display: grid;
  gap: 3px;
  min-width: 0;
  color: #83919f;
  font-size: 9px;
}

.trace-hit-row select {
  width: 100%;
  height: 27px;
  border: 1px solid #485664;
  border-radius: 3px;
  background: #141a1f;
  color: #dce7ef;
  font-size: 10px;
}

.trace-critical-grid,
.trace-hit-stale {
  grid-column: 1 / -1;
  padding: 7px 0 0;
  border: 0;
}

.trace-critical-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.trace-hit-stale {
  color: #d99a9a;
  font-size: 10px;
}

.trace-toughness-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: #91a0ad;
  font-size: 11px;
}

.trace-toughness-row strong {
  color: #dce7ef;
}

.trace-source {
  display: grid;
  gap: 4px;
  padding: 10px 14px;
}

.trace-source code {
  overflow: hidden;
  color: #91a0ad;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

button:focus-visible,
select:focus-visible {
  outline: 2px solid #76a9c7;
  outline-offset: 1px;
}
</style>
