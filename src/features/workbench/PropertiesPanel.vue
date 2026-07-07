<template>
  <section class="panel properties-panel">
    <div class="panel-title">
      <Operation class="panel-icon" />
      <h2>属性</h2>
    </div>

    <div class="control-grid">
      <label>
        <span>主角色</span>
        <select
          data-testid="workbench-character-select"
          :value="selection.characterId"
          @change="emitSelection('characterId', $event.target.value)"
        >
          <option
            v-for="character in characters"
            :key="character.id"
            :value="character.id"
          >
            {{ character.name }}
          </option>
        </select>
      </label>

      <label>
        <span>副角色</span>
        <select
          data-testid="workbench-secondary-character-select"
          :value="selection.secondaryCharacterId"
          @change="emitSelection('secondaryCharacterId', $event.target.value)"
        >
          <option
            v-for="character in secondaryCharacterOptions"
            :key="character.id"
            :value="character.id"
          >
            {{ character.name }}
          </option>
        </select>
      </label>

      <label>
        <span>技能</span>
        <select
          v-if="isSkillAction"
          data-testid="workbench-skill-select"
          :value="selectedAction.skillId"
          @change="emitActionPatch('skillId', $event.target.value)"
        >
          <option
            v-for="skill in skillOptions"
            :key="skill.id"
            :value="skill.id"
          >
            {{ skill.name }}
          </option>
        </select>
        <input
          v-else
          data-testid="workbench-action-type"
          :value="actionTypeLabel"
          disabled
        />
      </label>

      <label>
        <span>敌人</span>
        <select
          data-testid="workbench-enemy-select"
          :value="selection.enemyId"
          @change="emitSelection('enemyId', $event.target.value)"
        >
          <option v-for="enemy in enemies" :key="enemy.id" :value="enemy.id">
            {{ enemy.name }}
          </option>
        </select>
      </label>
    </div>

    <div class="action-controls">
      <label>
        <span>开始时间 ms</span>
        <input
          type="number"
          data-testid="workbench-start-input"
          min="0"
          :max="durationMs"
          step="100"
          :value="selectedAction.startMs"
          @input="emitActionPatch('startMs', $event.target.value)"
        />
      </label>

      <label>
        <span>{{ secondaryControlLabel }}</span>
        <input
          v-if="isSkillAction"
          type="number"
          data-testid="workbench-level-input"
          min="1"
          :max="maxSkillLevel"
          step="1"
          :value="selectedAction.level"
          @input="emitActionPatch('level', $event.target.value)"
        />
        <input
          v-else-if="isWaitAction || isAnnotationAction"
          type="number"
          data-testid="workbench-duration-input"
          min="1"
          :value="selectedAction.durationMs"
          @input="emitActionPatch('durationMs', $event.target.value)"
        />
        <input
          v-else-if="isResourceAction"
          type="number"
          data-testid="workbench-resource-change-input"
          :value="selectedAction.change"
          @input="emitActionPatch('change', $event.target.value)"
        />
        <input
          v-else-if="isEnemyEventAction"
          type="text"
          data-testid="workbench-enemy-event-type-input"
          :value="selectedAction.eventType"
          @input="emitTextPatch('eventType', $event.target.value)"
        />
        <select
          v-else-if="isSwitchAction"
          data-testid="workbench-switch-target-select"
          :value="selectedAction.targetCharacterId"
          @change="emitActionPatch('targetCharacterId', $event.target.value)"
        >
          <option
            v-for="character in switchTargetOptions"
            :key="character.id"
            :value="character.id"
          >
            {{ character.name }}
          </option>
        </select>
      </label>

      <label>
        <span>动作归属</span>
        <select
          v-if="canAssignActor"
          data-testid="workbench-action-actor-select"
          :value="currentActorCharacterId"
          @change="emitActionPatch('actorCharacterId', $event.target.value)"
        >
          <option
            v-for="actor in actors"
            :key="actor.id"
            :value="actor.characterId"
          >
            {{ actor.name }}
          </option>
        </select>
        <input
          v-else
          data-testid="workbench-action-actor-readonly"
          :value="currentActorName"
          disabled
        />
      </label>

      <label v-if="isSkillAction">
        <span>伤害段</span>
        <select
          data-testid="workbench-damage-segment-select"
          :value="selectedDamageSegmentIndex"
          @change="emitActionPatch('damageSegmentIndex', $event.target.value)"
        >
          <option
            v-for="segment in damageSegmentOptions"
            :key="segment.index"
            :value="segment.index"
          >
            {{ segment.label }} / {{ segment.rawValue }}
          </option>
        </select>
      </label>
    </div>

    <div
      v-if="currentActorAttributePanel"
      class="attribute-panel"
      data-testid="workbench-character-attribute-panel"
      :data-character-id="currentActorAttributePanel.characterId"
    >
      <div class="attribute-panel-title">
        <span>角色数值面板</span>
        <strong data-testid="workbench-character-attribute-policy">{{
          attributePanelPolicyLabel
        }}</strong>
      </div>

      <div class="attribute-core-grid">
        <div
          v-for="row in attributePanelRows"
          :key="row.key"
          class="attribute-core-item"
          data-testid="workbench-character-attribute-row"
          :data-attribute-key="row.key"
        >
          <span>{{ row.label }}</span>
          <strong>{{ row.value }}</strong>
          <small v-if="row.detail">{{ row.detail }}</small>
        </div>
      </div>

      <p
        class="attribute-source"
        data-testid="workbench-character-attribute-source"
      >
        来源：{{ attributePanelSourceLabel }}
      </p>
    </div>

    <div
      v-if="isSkillAction && skillLogicModel"
      class="logic-source"
      data-testid="workbench-skill-logic-source"
      :data-logic-status="skillLogicModel.status"
    >
      <div class="logic-source-title">
        <span>技能逻辑来源</span>
        <strong data-testid="workbench-skill-logic-status">{{
          logicStatusLabel
        }}</strong>
      </div>

      <div class="logic-source-grid">
        <div
          class="logic-source-item"
          data-testid="workbench-skill-display-timing"
        >
          <span>skill_level 显示</span>
          <strong
            >CD {{ formatMs(displayTiming.cooldownMs) }} / SP
            {{ displayTiming.spCost }}</strong
          >
          <small>#{{ skillLogicModel.skillLevelRowId }}</small>
        </div>
        <div
          class="logic-source-item"
          data-testid="workbench-skill-logic-timing"
        >
          <span>skillsub_logic 逻辑</span>
          <strong>
            CD {{ formatMs(logicTiming.cooldownMs) }} / SP
            {{ logicTiming.spCost }}
          </strong>
          <small>
            selfCD {{ formatMs(logicTiming.selfCooldownMs) }} / GCD
            {{ formatMs(logicTiming.gcdMs) }}
          </small>
        </div>
      </div>

      <p
        v-if="hasDisplayLogicMismatch"
        class="logic-warning"
        data-testid="workbench-skill-logic-mismatch"
      >
        显示层与逻辑层不同：显示 CD {{ formatMs(displayTiming.cooldownMs) }} /
        SP {{ displayTiming.spCost }}，逻辑 CD
        {{ formatMs(logicTiming.cooldownMs) }} / SP {{ logicTiming.spCost }}
      </p>

      <div
        v-if="skillLogicModel.elementValues?.length"
        class="logic-param-list"
        data-testid="workbench-skill-element-values"
      >
        <span>skillsub_ele_value</span>
        <code
          v-for="row in displayedElementValues"
          :key="row.rowId"
          data-testid="workbench-skill-element-value-row"
        >
          #{{ row.rowId }} · {{ row.elementId }} · {{ row.valueParam }}
        </code>
        <span
          v-if="valueParamSemanticLabel"
          class="logic-param-semantics"
          data-testid="workbench-skill-value-param-semantics"
        >
          {{ valueParamSemanticLabel }}
        </span>
      </div>

      <p
        v-if="selectedDamageParameterLink"
        class="logic-param-link"
        data-testid="workbench-skill-value-param-link"
        :data-link-status="selectedDamageParameterLink.status"
      >
        倍率段 {{ selectedDamageParameterLink.label }} /
        {{ selectedDamageParameterLink.rawValue }}：
        {{ valueParamLinkLabel }}
      </p>
    </div>

    <div v-if="isResourceAction" class="action-controls contextual-controls">
      <label>
        <span>资源</span>
        <input
          type="text"
          data-testid="workbench-resource-type-input"
          :value="selectedAction.resource"
          @input="emitTextPatch('resource', $event.target.value)"
        />
      </label>

      <label>
        <span>原因</span>
        <input
          type="text"
          data-testid="workbench-resource-reason-input"
          :value="selectedAction.reason"
          @input="emitTextPatch('reason', $event.target.value)"
        />
      </label>
    </div>

    <label class="note-control">
      <span>备注</span>
      <textarea
        data-testid="workbench-note-input"
        :value="selectedAction.note"
        @input="emitTextPatch('note', $event.target.value)"
      />
    </label>

    <p class="selection-note">
      当前动作：{{ selectedAction.name }} / {{ selectedActionSummary }}
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { Operation } from '@element-plus/icons-vue';

const props = defineProps({
  selection: {
    type: Object,
    required: true,
  },
  characters: {
    type: Array,
    required: true,
  },
  actors: {
    type: Array,
    required: true,
  },
  skills: {
    type: Array,
    required: true,
  },
  enemies: {
    type: Array,
    required: true,
  },
  selectedAction: {
    type: Object,
    required: true,
  },
  durationMs: {
    type: Number,
    required: true,
  },
});

const emit = defineEmits(['update-selection', 'update-action']);

const maxSkillLevel = computed(() =>
  Math.max(
    1,
    props.selectedAction.source?.skill?.level?.values?.length ??
      props.selectedAction.level ??
      1
  )
);
const isSkillAction = computed(() => props.selectedAction.type === 'skill');
const isWaitAction = computed(() => props.selectedAction.type === 'wait');
const isAnnotationAction = computed(
  () => props.selectedAction.type === 'annotation'
);
const isResourceAction = computed(
  () => props.selectedAction.type === 'resource'
);
const isEnemyEventAction = computed(
  () => props.selectedAction.type === 'enemyEvent'
);
const isSwitchAction = computed(() => props.selectedAction.type === 'switch');
const canAssignActor = computed(() =>
  ['skill', 'switch', 'resource'].includes(props.selectedAction.type)
);
const currentActor = computed(() => {
  if (props.selectedAction.actor) {
    return props.selectedAction.actor;
  }
  return (
    props.actors.find(
      actor =>
        Number(actor.characterId) === Number(currentActorCharacterId.value)
    ) ?? null
  );
});
const secondaryCharacterOptions = computed(() =>
  props.characters.filter(
    character => Number(character.id) !== Number(props.selection.characterId)
  )
);
const currentActorCharacterId = computed(() => {
  return (
    props.selectedAction.actor?.characterId ??
    props.selectedAction.actorCharacterId ??
    props.selection.characterId
  );
});
const currentActorName = computed(() => {
  if (!canAssignActor.value) {
    return '系统 / 事件轨';
  }
  return (
    props.actors.find(
      actor =>
        Number(actor.characterId) === Number(currentActorCharacterId.value)
    )?.name ?? resolveCharacterName(currentActorCharacterId.value)
  );
});
const skillOptions = computed(() => {
  const actorSkills = props.skills.filter(
    skill => Number(skill.characterId) === Number(currentActorCharacterId.value)
  );
  return actorSkills.length > 0 ? actorSkills : props.skills;
});
const switchTargetOptions = computed(() => {
  const actorCharacterIds = new Set(
    props.actors.map(actor => Number(actor.characterId))
  );
  return props.characters.filter(
    character =>
      actorCharacterIds.has(Number(character.id)) &&
      Number(character.id) !== Number(currentActorCharacterId.value)
  );
});
const damageSegmentOptions = computed(() =>
  props.selectedAction.damageSegments?.length
    ? props.selectedAction.damageSegments
    : props.selectedAction.selectedDamageSegment
      ? [props.selectedAction.selectedDamageSegment]
      : []
);
const selectedDamageSegmentIndex = computed(() => {
  return (
    props.selectedAction.selectedDamageSegment?.index ??
    props.selectedAction.damageSegmentIndex ??
    0
  );
});
const skillLogicModel = computed(() => props.selectedAction.logicModel ?? null);
const displayTiming = computed(
  () => skillLogicModel.value?.display ?? { cooldownMs: 0, spCost: 0 }
);
const logicTiming = computed(
  () =>
    skillLogicModel.value?.logic ?? {
      cooldownMs: 0,
      spCost: 0,
      selfCooldownMs: 0,
      gcdMs: 0,
    }
);
const hasDisplayLogicMismatch = computed(() =>
  (skillLogicModel.value?.diagnostics ?? []).some(
    diagnostic => diagnostic.code === 'skill-display-logic-timing-mismatch'
  )
);
const logicStatusLabel = computed(() => {
  if (skillLogicModel.value?.status === 'mismatch') {
    return '来源差异';
  }
  if (skillLogicModel.value?.status === 'missing') {
    return '来源缺失';
  }
  return '已映射';
});
const displayedElementValues = computed(() =>
  (skillLogicModel.value?.elementValues ?? []).slice(0, 3)
);
const currentActorAttributePanel = computed(
  () => currentActor.value?.attributePanel ?? null
);
const attributePanelPolicyLabel = computed(() => {
  const panel = currentActorAttributePanel.value;
  if (!panel) {
    return '';
  }
  return `${panel.level}级 / 临阶 ${panel.currentRank}`;
});
const attributePanelSourceLabel = computed(() => {
  const panel = currentActorAttributePanel.value;
  if (!panel) {
    return '';
  }
  const runeLabel =
    panel.currentRankRunes === 'all-selected'
      ? '当前阶星赐全选'
      : panel.currentRankRunes;
  return `${panel.sourceKind}；${runeLabel}；突破计入至 ${panel.rankBonusIncludedThrough} 阶`;
});
const attributePanelRows = computed(() => {
  const core = currentActorAttributePanel.value?.core ?? {};
  return [
    ['attack', '攻击'],
    ['maxHp', '生命'],
    ['physicalDefense', '物防'],
    ['magicalDefense', '魔防'],
    ['tuningStrength', '调谐'],
    ['critRate', '暴击率'],
    ['critDamage', '暴击伤害'],
    ['damageAmplification', '伤害增幅'],
  ]
    .map(([key, label]) => {
      const attribute = core[key];
      if (!attribute) {
        return null;
      }
      return {
        key,
        label,
        value:
          attribute.displayText ??
          formatAttributeValue(attribute.effectiveValue, attribute.isRatio),
        detail: formatAttributeDetail(attribute),
      };
    })
    .filter(Boolean);
});
const valueParamSemanticLabel = computed(() => {
  const params = displayedElementValues.value.flatMap(row => row.params ?? []);
  const uniqueParams = [];
  const seen = new Set();
  for (const param of params) {
    if (seen.has(param.id)) {
      continue;
    }
    seen.add(param.id);
    uniqueParams.push(param);
  }
  return uniqueParams.map(formatValueParamSemantic).join('；');
});
const selectedDamageParameterLink = computed(() =>
  (skillLogicModel.value?.damageParameterLinks ?? []).find(
    link =>
      Number(link.segmentIndex) === Number(selectedDamageSegmentIndex.value)
  )
);
const valueParamLinkLabel = computed(() => {
  if (!selectedDamageParameterLink.value) {
    return '未检查';
  }
  if (selectedDamageParameterLink.value.status === 'matched') {
    return `直接匹配 ${selectedDamageParameterLink.value.matches.length} 个 valueParam`;
  }
  if (selectedDamageParameterLink.value.status === 'unparseable') {
    return '倍率无法解析，未建立 valueParam 关联';
  }
  const ids =
    selectedDamageParameterLink.value.unmatchedParamIds?.join(', ') || '无';
  return `未发现直接 valueParam 匹配；未解释参数 ${ids}`;
});
function formatValueParamSemantic(param) {
  const descriptor = param.descriptor ?? {};
  const label = descriptor.label ?? `参数 ${param.id}`;
  if (descriptor.semanticStatus === 'confirmed') {
    return `${label}：已解释`;
  }
  if (descriptor.category === 'constant-formula-slot') {
    return `${label}：恒定公式槽位，语义未确认`;
  }
  if (descriptor.semanticStatus === 'unknown') {
    return `${label}：未知参数`;
  }
  return `${label}：公式槽位，语义未确认`;
}
const actionTypeLabel = computed(() => {
  if (props.selectedAction.type === 'wait') {
    return '等待动作';
  }
  if (props.selectedAction.type === 'annotation') {
    return '注释动作';
  }
  if (props.selectedAction.type === 'resource') {
    return '资源动作';
  }
  if (props.selectedAction.type === 'enemyEvent') {
    return '敌人事件';
  }
  if (props.selectedAction.type === 'switch') {
    return '切人动作';
  }
  return '技能动作';
});
const secondaryControlLabel = computed(() => {
  if (isSkillAction.value) {
    return '技能等级';
  }
  if (isResourceAction.value) {
    return '资源变化';
  }
  if (isEnemyEventAction.value) {
    return '事件类型';
  }
  if (isSwitchAction.value) {
    return '目标角色';
  }
  return '持续时间 ms';
});
const selectedActionSummary = computed(() => {
  if (isSkillAction.value) {
    return props.selectedAction.selectedDamageSegment?.rawValue ?? '倍率待补';
  }
  if (isWaitAction.value) {
    return `${props.selectedAction.durationMs ?? 0}ms`;
  }
  if (isResourceAction.value) {
    return `${String(props.selectedAction.resource ?? 'sp').toUpperCase()} ${formatSigned(props.selectedAction.change)}`;
  }
  if (isEnemyEventAction.value) {
    return props.selectedAction.eventType || 'phase';
  }
  if (isSwitchAction.value) {
    return (
      props.selectedAction.targetActor?.name ??
      resolveCharacterName(props.selectedAction.targetCharacterId)
    );
  }
  return props.selectedAction.note || '备注';
});

function emitSelection(key, value) {
  emit('update-selection', {
    [key]: Number(value),
  });
}

function emitActionPatch(key, value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return;
  }
  const patch = { [key]: number };
  if (key === 'skillId') {
    patch.level = 1;
    patch.damageSegmentIndex = 0;
  }
  emit('update-action', patch);
}

function emitTextPatch(key, value) {
  emit('update-action', {
    [key]: value,
  });
}

function formatSigned(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? '+' : ''}${number}`;
}

function formatMs(value) {
  return `${Number(value) || 0}ms`;
}

function formatAttributeValue(value, isRatio = false) {
  if (!Number.isFinite(value)) {
    return '0';
  }
  if (isRatio) {
    return `${(value * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
  }
  return String(Math.round(value));
}

function formatAttributeDetail(attribute) {
  if (!attribute || attribute.isRatio) {
    return '';
  }
  if (
    attribute.percentBonusValue == null ||
    attribute.percentBonusValue === 0
  ) {
    return '';
  }
  return `黑字 ${attribute.fixedPanelValue} / 绿字 +${attribute.percentBonusValue}`;
}

function resolveCharacterName(characterId) {
  return (
    props.characters.find(
      character => Number(character.id) === Number(characterId)
    )?.name ?? '目标待选'
  );
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

.control-grid,
.action-controls {
  display: grid;
  gap: 12px;
  padding: 14px;
}

.action-controls {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding-top: 0;
}

.contextual-controls {
  padding-bottom: 0;
}

.note-control {
  padding: 0 14px 14px;
}

label {
  display: grid;
  gap: 6px;
  min-width: 0;
}

label span {
  color: #8f9aa3;
  font-size: 12px;
}

select,
input,
textarea {
  width: 100%;
  min-width: 0;
  padding: 8px 9px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 4px;
  background: #11161b;
  color: #ffffff;
  font: inherit;
}

select:focus,
input:focus,
textarea:focus {
  outline: none;
  border-color: #79c7b9;
  box-shadow: 0 0 0 2px rgba(121, 199, 185, 0.14);
}

textarea {
  min-height: 72px;
  resize: vertical;
}

.selection-note {
  margin: 0;
  padding: 0 14px 14px;
  color: #b8c0c7;
  font-size: 12px;
}

.logic-source {
  display: grid;
  gap: 10px;
  margin: 0 14px 14px;
  padding: 12px 0 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.attribute-panel {
  display: grid;
  gap: 10px;
  margin: 0 14px 14px;
  padding: 12px 0 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.attribute-panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.attribute-panel-title span,
.attribute-source {
  color: #8f9aa3;
  font-size: 12px;
}

.attribute-panel-title strong {
  color: #79c7b9;
  font-size: 12px;
}

.attribute-core-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.attribute-core-item {
  display: grid;
  gap: 3px;
  min-width: 0;
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  background: rgba(17, 22, 27, 0.62);
}

.attribute-core-item span,
.attribute-core-item small {
  color: #8f9aa3;
  font-size: 11px;
}

.attribute-core-item strong {
  overflow-wrap: anywhere;
  color: #eef5f2;
  font-size: 13px;
}

.attribute-source {
  margin: 0;
  line-height: 1.45;
}

.logic-source-title,
.logic-param-list {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.logic-source-title span,
.logic-param-list > span {
  color: #8f9aa3;
  font-size: 12px;
}

.logic-source-title strong {
  color: #79c7b9;
  font-size: 12px;
}

.logic-source[data-logic-status='mismatch'] .logic-source-title strong {
  color: #f0c36a;
}

.logic-source-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.logic-source-item {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 9px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  background: rgba(17, 22, 27, 0.62);
}

.logic-source-item span,
.logic-source-item small {
  color: #8f9aa3;
  font-size: 11px;
}

.logic-source-item strong {
  overflow-wrap: anywhere;
  color: #eef5f2;
  font-size: 12px;
}

.logic-warning {
  margin: 0;
  padding: 8px 9px;
  border-left: 3px solid #f0c36a;
  background: rgba(240, 195, 106, 0.1);
  color: #ead7a5;
  font-size: 12px;
  line-height: 1.45;
}

.logic-param-link {
  margin: 0;
  padding: 8px 9px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  background: rgba(17, 22, 27, 0.62);
  color: #b8c0c7;
  font-size: 12px;
  line-height: 1.45;
}

.logic-param-link[data-link-status='unmatched'] {
  border-color: rgba(240, 195, 106, 0.32);
  color: #ead7a5;
}

.logic-param-list {
  flex-wrap: wrap;
  justify-content: flex-start;
}

.logic-param-list code {
  min-width: 0;
  padding: 4px 6px;
  border-radius: 3px;
  background: #11161b;
  color: #b8c0c7;
  font-size: 11px;
  overflow-wrap: anywhere;
}

.logic-param-semantics {
  width: 100%;
  color: #9fb8b3;
  line-height: 1.45;
}

@media (max-width: 760px) {
  .action-controls {
    grid-template-columns: 1fr;
  }

  .logic-source-grid {
    grid-template-columns: 1fr;
  }

  .attribute-core-grid {
    grid-template-columns: 1fr;
  }
}
</style>
