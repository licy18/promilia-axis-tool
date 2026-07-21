<template>
  <section class="panel properties-panel">
    <div class="panel-title">
      <Operation class="panel-icon" />
      <h2>属性</h2>
    </div>

    <div class="action-identity" data-testid="workbench-action-identity">
      <img
        v-if="selectedActionIdentity.iconUrl"
        class="action-identity-icon"
        :src="selectedActionIdentity.iconUrl"
        alt=""
        aria-hidden="true"
      />
      <Operation
        v-else
        class="action-identity-icon fallback"
        aria-hidden="true"
      />
      <span class="action-identity-copy">
        <strong>{{ selectedActionIdentity.name }}</strong>
        <small
          >{{ selectedActionIdentity.typeLabel }} ·
          {{ selectedActionIdentity.durationFrames }}F</small
        >
      </span>
    </div>

    <div
      v-if="verifiedMechanicsTrace"
      class="verified-mechanics-trace"
      :class="`status-${verifiedMechanicsTrace.status}`"
      :data-trace-status="verifiedMechanicsTrace.status"
      :data-binding-identity="verifiedMechanicsTrace.bindingIdentity"
      :data-runtime-hit-count="verifiedMechanicsTrace.runtimeHitCount"
      :data-runtime-effect-count="
        verifiedMechanicsTrace.runtimeEffectEventCount
      "
      :data-runtime-tuning-count="
        verifiedMechanicsTrace.runtimeTuningEventCount
      "
      data-testid="workbench-verified-mechanics-trace"
    >
      <div class="verified-mechanics-trace-title">
        <span>动作数值溯源</span>
        <strong>{{ verifiedMechanicsTrace.statusLabel }}</strong>
      </div>
      <ol class="verified-mechanics-trace-chain">
        <li
          v-for="step in verifiedMechanicsTrace.steps"
          :key="step.key"
          :class="{ applied: step.applied }"
          :data-trace-step="step.key"
          data-testid="workbench-verified-mechanics-trace-step"
        >
          <span>{{ step.label }}</span>
          <strong>{{ step.value }}</strong>
          <small>{{ step.detail }}</small>
        </li>
      </ol>
      <p
        v-if="verifiedMechanicsTrace.unresolved.length"
        class="verified-mechanics-trace-unresolved"
        data-testid="workbench-verified-mechanics-trace-unresolved"
      >
        {{ verifiedMechanicsTrace.unresolved.join(' · ') }}
      </p>
      <details
        v-if="verifiedMechanicsTrace.sourceRows.length"
        class="verified-mechanics-trace-sources"
      >
        <summary>
          来源 {{ verifiedMechanicsTrace.sourceRows.length }} 项 · 包
          {{ formatSourceHash(verifiedMechanicsTrace.packageHash) }}
        </summary>
        <div
          v-for="(source, sourceIndex) in verifiedMechanicsTrace.sourceRows"
          :key="`${source.label}-${sourceIndex}`"
          data-testid="workbench-verified-mechanics-source-row"
        >
          <span>{{ source.label }}</span>
          <code>{{ source.identity }}</code>
        </div>
      </details>
    </div>

    <div
      v-if="selectedAction.attackInput"
      class="logic-source"
      data-testid="workbench-attack-input-segment-source"
    >
      <div class="logic-source-title">
        <span>普攻输入段</span>
        <strong
          >A{{ selectedAction.attackSequenceIndex }} / A{{
            selectedAction.attackSequenceTotal
          }}</strong
        >
      </div>
      <div class="logic-source-grid">
        <div class="logic-source-item">
          <span>输入来源</span>
          <strong
            >control {{ selectedAction.attackInput.controlSkillId }}</strong
          >
          <small
            >resourceMap
            {{ selectedAction.attackInput.resourceMapIndex }}</small
          >
        </div>
        <div class="logic-source-item">
          <span>命中绑定</span>
          <strong
            >{{
              selectedAction.attackInput.selectedHitIdentities?.length ?? 0
            }}
            项</strong
          >
          <small>{{ selectedAction.attackInput.classification }}</small>
        </div>
        <div class="logic-source-item">
          <span>有效占轴</span>
          <strong
            >{{
              selectedAction.attackInput.effectiveDurationFrames ??
              selectedAction.attackInput.durationFrames
            }}F</strong
          >
          <small>{{
            formatAttackInputWindow(selectedAction.attackInput)
          }}</small>
        </div>
        <div class="logic-source-item">
          <span>动画与命中</span>
          <strong
            >动画
            {{
              selectedAction.attackInput.animationDurationFrames ?? '待确认'
            }}F</strong
          >
          <small
            >最后命中
            {{ selectedAction.attackInput.hitEndFrame ?? '待确认' }}F</small
          >
        </div>
      </div>
    </div>

    <div class="control-grid">
      <label
        data-testid="workbench-action-edit-control"
        data-edit-field="skillId"
        :data-edit-focused="isEditFocusField('skillId')"
        :data-edit-focus-label="getEditFocusLabel('skillId')"
        :data-edit-focus-origin="getEditFocusOrigin('skillId')"
        :data-edit-focus-source="getEditFocusSource('skillId')"
        :data-edit-focus-summary="getEditFocusSummary('skillId')"
        :class="{ 'edit-focused': isEditFocusField('skillId') }"
      >
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
      <div
        v-if="runtimeResultReturnDisplayContext"
        class="action-result-return"
        :data-action-id="runtimeResultReturnDisplayContext.actionId"
        :data-origin-state-point-id="
          runtimeResultReturnDisplayContext.originStatePointId
        "
        :data-return-status="runtimeResultReturnDisplayContext.status"
        :data-state-point-id="runtimeResultReturnDisplayContext.statePointId"
        data-testid="workbench-action-edit-result-return"
      >
        <div>
          <span>结果回看</span>
          <strong>{{ runtimeResultReturnDisplayContext.label }}</strong>
          <small>{{ runtimeResultReturnDisplayContext.summary }}</small>
        </div>
        <button
          type="button"
          :data-state-point-id="runtimeResultReturnButtonTarget.statePointId"
          data-testid="workbench-action-edit-result-return-button"
          :disabled="!runtimeResultReturnCommand.enabled"
          @click="returnRuntimeResult"
        >
          <Aim class="action-result-return-icon" />
          <span>回到结果点</span>
        </button>
      </div>

      <div
        class="frame-edit-controls"
        :data-frame-rate="workbenchFrameRate"
        data-testid="workbench-action-frame-controls"
      >
        <label
          class="frame-edit-control"
          :data-edit-focused="isEditFocusField('startMs')"
          :data-edit-focus-origin="getEditFocusOrigin('startMs')"
          :class="{ 'edit-focused': isEditFocusField('startMs') }"
          data-edit-field="startMs"
          data-testid="workbench-action-frame-control"
        >
          <span>开始帧</span>
          <div class="frame-stepper">
            <button
              type="button"
              class="frame-stepper-button"
              data-step-direction="decrease"
              data-testid="workbench-start-frame-step"
              :disabled="selectedActionStartFrame <= 0"
              title="开始帧前移 1 帧"
              aria-label="开始帧前移 1 帧"
              @click="nudgeFrameActionPatch('startMs', -1)"
            >
              <Minus class="frame-stepper-icon" />
            </button>
            <input
              type="number"
              data-testid="workbench-start-frame-input"
              min="0"
              :max="maxStartFrame"
              step="1"
              :value="selectedActionStartFrame"
              @input="emitFrameActionPatch('startMs', $event.target.value)"
            />
            <button
              type="button"
              class="frame-stepper-button"
              data-step-direction="increase"
              data-testid="workbench-start-frame-step"
              :disabled="selectedActionStartFrame >= maxStartFrame"
              title="开始帧后移 1 帧"
              aria-label="开始帧后移 1 帧"
              @click="nudgeFrameActionPatch('startMs', 1)"
            >
              <Plus class="frame-stepper-icon" />
            </button>
          </div>
        </label>

        <label
          class="frame-edit-control"
          :data-edit-focused="isEditFocusField('durationMs')"
          :data-edit-focus-origin="getEditFocusOrigin('durationMs')"
          :class="{ 'edit-focused': isEditFocusField('durationMs') }"
          data-edit-field="durationMs"
          data-testid="workbench-action-frame-control"
        >
          <span>持续帧</span>
          <div class="frame-stepper">
            <button
              type="button"
              class="frame-stepper-button"
              data-step-direction="decrease"
              data-testid="workbench-duration-frame-step"
              :disabled="selectedActionDurationFrame <= 1"
              title="持续帧减少 1 帧"
              aria-label="持续帧减少 1 帧"
              @click="nudgeFrameActionPatch('durationMs', -1)"
            >
              <Minus class="frame-stepper-icon" />
            </button>
            <input
              type="number"
              data-testid="workbench-duration-frame-input"
              min="1"
              :max="maxDurationFrame"
              step="1"
              :value="selectedActionDurationFrame"
              @input="emitFrameActionPatch('durationMs', $event.target.value)"
            />
            <button
              type="button"
              class="frame-stepper-button"
              data-step-direction="increase"
              data-testid="workbench-duration-frame-step"
              :disabled="selectedActionDurationFrame >= maxDurationFrame"
              title="持续帧增加 1 帧"
              aria-label="持续帧增加 1 帧"
              @click="nudgeFrameActionPatch('durationMs', 1)"
            >
              <Plus class="frame-stepper-icon" />
            </button>
          </div>
        </label>
      </div>

      <label
        data-testid="workbench-action-edit-control"
        data-edit-field="startMs"
        :data-edit-focused="isEditFocusField('startMs')"
        :data-edit-focus-label="getEditFocusLabel('startMs')"
        :data-edit-focus-origin="getEditFocusOrigin('startMs')"
        :data-edit-focus-source="getEditFocusSource('startMs')"
        :data-edit-focus-summary="getEditFocusSummary('startMs')"
        :class="{ 'edit-focused': isEditFocusField('startMs') }"
      >
        <span>开始时间 ms</span>
        <input
          type="number"
          data-testid="workbench-start-input"
          min="0"
          :max="durationMs"
          :step="frameStepMs"
          :value="selectedAction.startMs"
          @input="emitActionPatch('startMs', $event.target.value)"
        />
      </label>

      <label
        data-testid="workbench-action-edit-control"
        :data-edit-field="secondaryEditFieldKey"
        :data-edit-focused="isEditFocusField(secondaryEditFieldKey)"
        :data-edit-focus-label="getEditFocusLabel(secondaryEditFieldKey)"
        :data-edit-focus-origin="getEditFocusOrigin(secondaryEditFieldKey)"
        :data-edit-focus-source="getEditFocusSource(secondaryEditFieldKey)"
        :data-edit-focus-summary="getEditFocusSummary(secondaryEditFieldKey)"
        :class="{ 'edit-focused': isEditFocusField(secondaryEditFieldKey) }"
      >
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
          :step="frameStepMs"
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
          v-else-if="isEnemyEventAction || isKiboEventAction"
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

      <label
        data-testid="workbench-action-edit-control"
        data-edit-field="actorCharacterId"
        :data-edit-focused="isEditFocusField('actorCharacterId')"
        :data-edit-focus-label="getEditFocusLabel('actorCharacterId')"
        :data-edit-focus-origin="getEditFocusOrigin('actorCharacterId')"
        :data-edit-focus-source="getEditFocusSource('actorCharacterId')"
        :data-edit-focus-summary="getEditFocusSummary('actorCharacterId')"
        :class="{ 'edit-focused': isEditFocusField('actorCharacterId') }"
      >
        <span>轨道归属</span>
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

      <label
        v-if="isSkillAction"
        data-testid="workbench-action-edit-control"
        data-edit-field="actionVariantIndex"
        :data-edit-focused="isEditFocusField('actionVariantIndex')"
        :data-edit-focus-label="getEditFocusLabel('actionVariantIndex')"
        :data-edit-focus-origin="getEditFocusOrigin('actionVariantIndex')"
        :data-edit-focus-source="getEditFocusSource('actionVariantIndex')"
        :data-edit-focus-summary="getEditFocusSummary('actionVariantIndex')"
        :class="{ 'edit-focused': isEditFocusField('actionVariantIndex') }"
      >
        <span>动作形态</span>
        <select
          data-testid="workbench-damage-segment-select"
          :value="selectedDamageSegmentIndex"
          @change="emitActionPatch('actionVariantIndex', $event.target.value)"
        >
          <option
            v-for="segment in damageSegmentOptions"
            :key="segment.index"
            :value="segment.index"
          >
            {{ formatActionVariantOption(segment) }}
          </option>
        </select>
      </label>
    </div>

    <div
      class="effect-editor"
      :data-effect-command-count="effectCommands.length"
      data-testid="workbench-effect-editor"
    >
      <div class="effect-editor-heading">
        <span>状态效果</span>
        <button
          type="button"
          title="添加状态效果"
          aria-label="添加状态效果"
          data-testid="workbench-effect-add"
          @click="addEffectCommand"
        >
          <Plus class="effect-editor-icon" />
        </button>
      </div>

      <div
        v-for="(command, commandIndex) in effectCommands"
        :key="command.id"
        class="effect-command-row"
        :class="{ generated: isGeneratedEffectCommand(command) }"
        :data-effect-command-id="command.id"
        :data-source-status="command.sourceStatus || ''"
        :data-tracking-status="command.trackingStatus || ''"
        data-testid="workbench-effect-command-row"
      >
        <div class="effect-command-heading">
          <strong>{{ command.effectName || command.effectId }}</strong>
          <small v-if="isGeneratedEffectCommand(command)">
            自动 · {{ formatEffectTrackingStatus(command) }}
          </small>
          <button
            v-else
            type="button"
            title="删除状态效果"
            aria-label="删除状态效果"
            :data-effect-command-id="command.id"
            data-testid="workbench-effect-delete"
            @click="deleteEffectCommand(command.id)"
          >
            <Delete class="effect-editor-icon" />
          </button>
        </div>

        <div
          v-if="isGeneratedEffectCommand(command)"
          class="effect-command-generated-summary"
          data-testid="workbench-generated-effect-summary"
        >
          <strong>{{ formatGeneratedEffectTiming(command) }}</strong>
          <span>{{ formatGeneratedEffectSource(command) }}</span>
          <small>仅用于状态追踪，不进入 HP、韧性或资源计算</small>
        </div>

        <div v-else class="effect-command-fields">
          <label class="effect-field-wide">
            <span>效果键</span>
            <input
              type="text"
              :value="command.effectId"
              data-testid="workbench-effect-id-input"
              @change="
                updateEffectText(
                  command.id,
                  'effectId',
                  $event.target.value,
                  `effect-${commandIndex + 1}`
                )
              "
            />
          </label>
          <label class="effect-field-wide">
            <span>显示名称</span>
            <input
              type="text"
              :value="command.effectName"
              data-testid="workbench-effect-name-input"
              @change="
                updateEffectText(
                  command.id,
                  'effectName',
                  $event.target.value,
                  `状态效果 ${commandIndex + 1}`
                )
              "
            />
          </label>
          <label>
            <span>操作</span>
            <select
              :value="command.operation"
              data-testid="workbench-effect-operation-select"
              @change="
                updateEffectCommand(command.id, {
                  operation: $event.target.value,
                })
              "
            >
              <option value="apply">施加</option>
              <option value="refresh">刷新</option>
              <option value="remove">移除</option>
            </select>
          </label>
          <label>
            <span>目标</span>
            <select
              :value="getEffectTargetValue(command)"
              data-testid="workbench-effect-target-select"
              @change="updateEffectTarget(command.id, $event.target.value)"
            >
              <option
                v-for="option in effectTargetOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
          <label>
            <span>触发帧偏移</span>
            <input
              type="number"
              min="0"
              step="1"
              :value="msToFrame(command.offsetMs ?? 0)"
              data-testid="workbench-effect-offset-frame-input"
              @change="
                updateEffectFrame(command.id, 'offsetMs', $event.target.value)
              "
            />
          </label>
          <label>
            <span>持续帧</span>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="永久"
              :value="
                command.durationMs == null ? '' : msToFrame(command.durationMs)
              "
              data-testid="workbench-effect-duration-frame-input"
              @change="updateEffectDuration(command.id, $event.target.value)"
            />
          </label>
          <label>
            <span>叠层方式</span>
            <select
              :value="command.stackMode"
              data-testid="workbench-effect-stack-mode-select"
              @change="
                updateEffectCommand(command.id, {
                  stackMode: $event.target.value,
                })
              "
            >
              <option value="refresh">刷新时长</option>
              <option value="stack">增加层数</option>
              <option value="replace">替换层数</option>
            </select>
          </label>
          <label>
            <span>单次层数</span>
            <input
              type="number"
              min="1"
              step="1"
              :value="command.stackDelta"
              data-testid="workbench-effect-stack-delta-input"
              @change="
                updateEffectInteger(
                  command.id,
                  'stackDelta',
                  $event.target.value
                )
              "
            />
          </label>
          <label>
            <span>层数上限</span>
            <input
              type="number"
              min="1"
              step="1"
              :value="command.maxStacks"
              data-testid="workbench-effect-max-stacks-input"
              @change="
                updateEffectInteger(
                  command.id,
                  'maxStacks',
                  $event.target.value
                )
              "
            />
          </label>
        </div>
      </div>
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
        动作形态倍率 {{ selectedDamageParameterLink.label }} /
        {{ selectedDamageParameterLink.rawValue }}：
        {{ valueParamLinkLabel }}
      </p>
    </div>

    <div v-if="isResourceAction" class="action-controls contextual-controls">
      <label
        data-testid="workbench-action-edit-control"
        data-edit-field="resource"
        :data-edit-focused="isEditFocusField('resource')"
        :data-edit-focus-label="getEditFocusLabel('resource')"
        :data-edit-focus-origin="getEditFocusOrigin('resource')"
        :data-edit-focus-source="getEditFocusSource('resource')"
        :data-edit-focus-summary="getEditFocusSummary('resource')"
        :class="{ 'edit-focused': isEditFocusField('resource') }"
      >
        <span>资源</span>
        <input
          type="text"
          data-testid="workbench-resource-type-input"
          :value="selectedAction.resource"
          @input="emitTextPatch('resource', $event.target.value)"
        />
      </label>

      <label
        data-testid="workbench-action-edit-control"
        data-edit-field="reason"
        :data-edit-focused="isEditFocusField('reason')"
        :data-edit-focus-label="getEditFocusLabel('reason')"
        :data-edit-focus-origin="getEditFocusOrigin('reason')"
        :data-edit-focus-source="getEditFocusSource('reason')"
        :data-edit-focus-summary="getEditFocusSummary('reason')"
        :class="{ 'edit-focused': isEditFocusField('reason') }"
      >
        <span>原因</span>
        <input
          type="text"
          data-testid="workbench-resource-reason-input"
          :value="selectedAction.reason"
          @input="emitTextPatch('reason', $event.target.value)"
        />
      </label>
    </div>

    <label
      class="note-control"
      data-testid="workbench-action-edit-control"
      data-edit-field="note"
      :data-edit-focused="isEditFocusField('note')"
      :data-edit-focus-label="getEditFocusLabel('note')"
      :data-edit-focus-origin="getEditFocusOrigin('note')"
      :data-edit-focus-source="getEditFocusSource('note')"
      :data-edit-focus-summary="getEditFocusSummary('note')"
      :class="{ 'edit-focused': isEditFocusField('note') }"
    >
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
import { Aim, Delete, Minus, Operation, Plus } from '@element-plus/icons-vue';
import {
  EFFECT_OPERATIONS,
  EFFECT_STACK_MODES,
  EFFECT_TARGET_KINDS,
  createEffectCommand,
} from '../../domain/projectSchema';
import {
  WORKBENCH_FPS,
  WORKBENCH_FRAME_MS,
  formatFrameTime,
  frameToMs,
  msToFrame,
} from '../../domain/timebase';
import { createRuntimeResultReturnContext } from './runtimeResultReturnContext';
import { resolveWorkbenchMainFlowResultReturnTarget } from './workbenchFlowModel';
import { createWorkbenchRuntimeReviewPanelCommandViewFromSurface } from './workbenchMainFlowActions';
import { resolveWorkbenchActionVisualIdentity } from '../../domain/workbenchActionVisualIdentity';
import { createVerifiedActionMechanicsTrace } from './verifiedActionMechanicsTrace';

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
  verifiedCombatRuntime: {
    type: Object,
    default: null,
  },
  durationMs: {
    type: Number,
    required: true,
  },
  actionEditFocus: {
    type: Object,
    default: null,
  },
  actionEditResultContext: {
    type: Object,
    default: null,
  },
  flowModel: {
    type: Object,
    default: null,
  },
  mainFlowCommandSurface: {
    type: Object,
    default: null,
  },
});

const selectedActionIdentity = computed(() =>
  resolveWorkbenchActionVisualIdentity(props.selectedAction)
);

const emit = defineEmits([
  'update-selection',
  'update-action',
  'dispatch-flow-action',
]);

const frameStepMs = WORKBENCH_FRAME_MS;
const workbenchFrameRate = WORKBENCH_FPS;
const verifiedMechanicsTrace = computed(() =>
  createVerifiedActionMechanicsTrace({
    action: props.selectedAction,
    scenario: { actors: props.actors },
    verifiedCombatRuntime: props.verifiedCombatRuntime,
  })
);

function formatSourceHash(value) {
  const text = String(value ?? '');
  return text ? text.slice(0, 10) : '未提供';
}

const effectCommands = computed(
  () => props.selectedAction.effectCommands ?? []
);

function isGeneratedEffectCommand(command) {
  return command?.sourceStatus === 'generated-from-azpr-action-status-catalog';
}

function formatEffectTrackingStatus(command) {
  return command?.appliedToCalculators
    ? '已应用'
    : command?.trackingStatus === 'unapplied'
      ? '未应用'
      : '追踪';
}

function formatGeneratedEffectTiming(command) {
  const startFrame = msToFrame(command?.offsetMs ?? 0);
  const duration = command?.durationMs;
  const durationText = duration == null ? '持续' : `${msToFrame(duration)}F`;
  return `${startFrame}F 触发 · ${durationText}`;
}

function formatAttackInputWindow(attackInput) {
  const window = attackInput?.linkWindow;
  if (
    attackInput?.linkTimingStatus !== 'applied' ||
    window?.startFrame == null ||
    window?.endFrame == null
  ) {
    return '输入窗口待确认';
  }
  const mode =
    window.continuousAttackType === 1
      ? '立即衔接'
      : window.continuousAttackType === 0
        ? '等待衔接'
        : '输入衔接';
  return `${window.startFrame}-${window.endFrame}F · ${mode}`;
}

function formatGeneratedEffectSource(command) {
  const source = command?.sourceIdentity ?? {};
  const target =
    command?.targetKind === EFFECT_TARGET_KINDS.ENEMY ? '敌人' : '角色';
  const confidence = command?.confidence === 'high' ? '高置信' : '中置信';
  const stacking = source.stackingStatus ? '叠层未确认' : '叠层已确认';
  return `${target} · ${confidence} · ${stacking} · ${source.behaviorClassName || '结构化动作目录'}`;
}
const effectTargetOptions = computed(() => {
  const actorOptions = props.actors.map(actor => ({
    value: `${EFFECT_TARGET_KINDS.ACTOR}|${actor.id}`,
    label: `角色 · ${actor.name}`,
  }));
  const enemy = props.enemies.find(
    item => Number(item.id) === Number(props.selection.enemyId)
  );
  return [
    ...actorOptions,
    {
      value: `${EFFECT_TARGET_KINDS.ENEMY}|enemy-${props.selection.enemyId}`,
      label: `敌人 · ${enemy?.name ?? props.selection.enemyId}`,
    },
  ];
});

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
const isKiboEventAction = computed(
  () => props.selectedAction.type === 'kiboEvent'
);
const isSwitchAction = computed(() => props.selectedAction.type === 'switch');
const canAssignActor = computed(() =>
  ['skill', 'switch', 'resource', 'kiboEvent'].includes(
    props.selectedAction.type
  )
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
    props.selectedAction.actionVariantIndex ??
    props.selectedAction.damageSegmentIndex ??
    0
  );
});
const selectedActionStartFrame = computed(() =>
  msToFrame(props.selectedAction.startMs ?? 0)
);
const selectedActionDurationFrame = computed(() =>
  Math.max(1, msToFrame(props.selectedAction.durationMs ?? frameStepMs))
);
const maxStartFrame = computed(() => Math.max(0, msToFrame(props.durationMs)));
const maxDurationFrame = computed(() => {
  const remainingMs =
    Number(props.durationMs) - (Number(props.selectedAction.startMs) || 0);
  return Math.max(1, msToFrame(Math.max(frameStepMs, remainingMs)));
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
const fallbackRuntimeResultReturnContext = computed(() =>
  createRuntimeResultReturnContext({
    actionId: props.selectedAction?.id,
    focus: props.actionEditFocus,
    resultContext: props.actionEditResultContext,
    allowOriginResult: true,
  })
);
const runtimeResultReturnContext = computed(() =>
  resolveWorkbenchMainFlowResultReturnTarget({
    flowModel: props.flowModel,
    fallbackTarget: fallbackRuntimeResultReturnContext.value,
  })
);
const runtimeResultReturnCommandView = computed(() =>
  createWorkbenchRuntimeReviewPanelCommandViewFromSurface({
    mainFlowCommandSurface: props.mainFlowCommandSurface,
    flowModel: props.flowModel,
    source: 'properties-panel',
    returnContext: runtimeResultReturnContext.value,
  })
);
const runtimeResultReturnCommand = computed(
  () => runtimeResultReturnCommandView.value.returnResult
);
const runtimeResultReturnButtonTarget = computed(
  () => runtimeResultReturnCommand.value.context
);
const runtimeResultReturnDisplayContext = computed(() =>
  createRuntimeResultReturnDisplayContext({
    context: runtimeResultReturnContext.value,
    target: runtimeResultReturnButtonTarget.value,
  })
);
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
  if (props.selectedAction.type === 'kiboEvent') {
    return '奇波事件';
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
  if (isEnemyEventAction.value || isKiboEventAction.value) {
    return '事件类型';
  }
  if (isSwitchAction.value) {
    return '目标角色';
  }
  return '持续时间 ms';
});
const secondaryEditFieldKey = computed(() => {
  if (isSkillAction.value) {
    return 'level';
  }
  if (isResourceAction.value) {
    return 'change';
  }
  if (isEnemyEventAction.value || isKiboEventAction.value) {
    return 'eventType';
  }
  if (isSwitchAction.value) {
    return 'targetCharacterId';
  }
  if (isWaitAction.value || isAnnotationAction.value) {
    return 'durationMs';
  }
  return '';
});
const selectedActionSummary = computed(() => {
  if (isSkillAction.value) {
    return (
      formatActionVariantOption(props.selectedAction.selectedDamageSegment) ||
      '倍率待补'
    );
  }
  if (isWaitAction.value) {
    return formatFrameTime(props.selectedAction.durationMs ?? 0);
  }
  if (isResourceAction.value) {
    return `${String(props.selectedAction.resource ?? 'sp').toUpperCase()} ${formatSigned(props.selectedAction.change)}`;
  }
  if (isEnemyEventAction.value) {
    return props.selectedAction.eventType || 'phase';
  }
  if (isKiboEventAction.value) {
    return props.selectedAction.eventType || 'activation';
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
    patch.actionVariantIndex = 0;
    patch.damageSegmentIndex = 0;
  }
  emit('update-action', patch);
}

function emitFrameActionPatch(key, value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return;
  }
  const frame = Math.round(number);
  const normalizedFrame = clampFrameValue(key, frame);
  emit('update-action', {
    [key]: frameToMs(normalizedFrame),
  });
}

function nudgeFrameActionPatch(key, deltaFrame) {
  const currentFrame =
    key === 'durationMs'
      ? selectedActionDurationFrame.value
      : selectedActionStartFrame.value;
  const nextFrame = clampFrameValue(key, currentFrame + deltaFrame);
  if (nextFrame === currentFrame) {
    return;
  }
  emit('update-action', {
    [key]: frameToMs(nextFrame),
  });
}

function clampFrameValue(key, frame) {
  const minimumFrame = key === 'durationMs' ? 1 : 0;
  const maximumFrame =
    key === 'durationMs' ? maxDurationFrame.value : maxStartFrame.value;
  return Math.min(maximumFrame, Math.max(minimumFrame, Math.round(frame)));
}

function emitTextPatch(key, value) {
  emit('update-action', {
    [key]: value,
  });
}

function addEffectCommand() {
  const sequence = effectCommands.value.length + 1;
  const targetId =
    currentActor.value?.id ??
    props.actors[0]?.id ??
    `actor-${props.selection.characterId}`;
  const command = createEffectCommand({
    id: `${props.selectedAction.id}-effect-${Date.now().toString(36)}`,
    effectId: `${props.selectedAction.id}-effect-${sequence}`,
    effectName: `状态效果 ${sequence}`,
    operation: EFFECT_OPERATIONS.APPLY,
    targetKind: EFFECT_TARGET_KINDS.ACTOR,
    targetId,
    durationMs: frameToMs(300),
    stackMode: EFFECT_STACK_MODES.REFRESH,
    stackDelta: 1,
    maxStacks: 1,
  });
  emitEffectCommands([...effectCommands.value, command]);
}

function deleteEffectCommand(commandId) {
  emitEffectCommands(
    effectCommands.value.filter(command => command.id !== commandId)
  );
}

function updateEffectText(commandId, key, value, fallback) {
  updateEffectCommand(commandId, {
    [key]: String(value ?? '').trim() || fallback,
  });
}

function updateEffectTarget(commandId, value) {
  const [targetKind, ...targetIdParts] = String(value).split('|');
  const targetId = targetIdParts.join('|');
  if (!targetId || !Object.values(EFFECT_TARGET_KINDS).includes(targetKind)) {
    return;
  }
  updateEffectCommand(commandId, { targetKind, targetId });
}

function updateEffectFrame(commandId, key, value) {
  const frame = Math.max(0, Math.round(Number(value) || 0));
  updateEffectCommand(commandId, { [key]: frameToMs(frame) });
}

function updateEffectDuration(commandId, value) {
  const text = String(value ?? '').trim();
  updateEffectCommand(commandId, {
    durationMs:
      text === ''
        ? null
        : frameToMs(Math.max(0, Math.round(Number(text) || 0))),
  });
}

function updateEffectInteger(commandId, key, value) {
  updateEffectCommand(commandId, {
    [key]: Math.max(1, Math.round(Number(value) || 1)),
  });
}

function updateEffectCommand(commandId, patch) {
  emitEffectCommands(
    effectCommands.value.map(command =>
      command.id === commandId
        ? createEffectCommand({ ...command, ...patch, id: command.id })
        : command
    )
  );
}

function emitEffectCommands(commands) {
  emit('update-action', { effectCommands: commands });
}

function getEffectTargetValue(command) {
  const value = `${command.targetKind}|${command.targetId}`;
  return effectTargetOptions.value.some(option => option.value === value)
    ? value
    : effectTargetOptions.value[0]?.value;
}

function returnRuntimeResult() {
  const action = runtimeResultReturnCommand.value.action;
  if (!action.canRun) {
    return;
  }
  emit('dispatch-flow-action', action);
}

function createRuntimeResultReturnDisplayContext({ context, target } = {}) {
  if (!context && !target?.statePointId) {
    return null;
  }
  if (!target?.statePointId) {
    return context;
  }
  return {
    ...(context ?? {}),
    ...target,
    label: target.label ?? context?.label ?? '回到结果点',
    summary: target.summary ?? context?.summary ?? '',
  };
}

function isEditFocusField(fieldKey) {
  const focus = props.actionEditFocus;
  if (!fieldKey || !focus?.actionId || !props.selectedAction?.id) {
    return false;
  }
  return (
    focus.actionId === props.selectedAction.id &&
    normalizeEditFocusField(focus.fieldKey) ===
      normalizeEditFocusField(fieldKey)
  );
}

function getEditFocusSummary(fieldKey) {
  return isEditFocusField(fieldKey)
    ? (props.actionEditFocus?.changeSummary ?? '')
    : '';
}

function getEditFocusLabel(fieldKey) {
  return isEditFocusField(fieldKey) ? (props.actionEditFocus?.label ?? '') : '';
}

function getEditFocusOrigin(fieldKey) {
  return isEditFocusField(fieldKey)
    ? (props.actionEditFocus?.editOrigin ?? '')
    : '';
}

function getEditFocusSource(fieldKey) {
  return isEditFocusField(fieldKey)
    ? (props.actionEditFocus?.focusSource ?? '')
    : '';
}

function normalizeEditFocusField(fieldKey) {
  if (fieldKey === 'damageSegmentIndex') {
    return 'actionVariantIndex';
  }
  if (fieldKey === 'laneId') {
    return 'actorCharacterId';
  }
  return fieldKey || '';
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

function formatActionVariantOption(segment) {
  if (!segment) {
    return '';
  }
  const hitCount = Number(segment.hitModel?.hitCount) || 1;
  const hitSuffix = hitCount > 1 ? ` / 普攻${hitCount}段总值` : '';
  return `${segment.displayLabel ?? segment.label} / ${segment.rawValue}${hitSuffix}`;
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

.action-identity {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 10px 14px 0;
}

.action-identity-icon {
  width: 38px;
  height: 38px;
  object-fit: contain;
  border-radius: 4px;
  background: rgba(4, 10, 14, 0.48);
}

.action-identity-icon.fallback {
  box-sizing: border-box;
  padding: 9px;
  color: #79c7b9;
}

.action-identity-copy {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.action-identity-copy strong,
.action-identity-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-identity-copy strong {
  color: #f4f7f8;
  font-size: 13px;
}

.action-identity-copy small {
  color: #9aa6ae;
  font-size: 11px;
}

.verified-mechanics-trace {
  display: grid;
  gap: 8px;
  margin: 10px 14px 0;
  padding-block: 10px;
  border-block: 1px solid rgba(255, 255, 255, 0.09);
}

.verified-mechanics-trace-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: #aeb8be;
  font-size: 12px;
}

.verified-mechanics-trace-title strong {
  color: #79c7b9;
}

.verified-mechanics-trace.status-partial
  .verified-mechanics-trace-title
  strong {
  color: #e0bc72;
}

.verified-mechanics-trace.status-unresolved
  .verified-mechanics-trace-title
  strong {
  color: #dc858b;
}

.verified-mechanics-trace-chain {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.verified-mechanics-trace-chain li {
  display: grid;
  grid-template-columns: 52px minmax(0, 0.7fr) minmax(0, 1fr);
  gap: 8px;
  align-items: baseline;
  min-width: 0;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.055);
}

.verified-mechanics-trace-chain li:last-child {
  border-bottom: 0;
}

.verified-mechanics-trace-chain span,
.verified-mechanics-trace-chain small {
  color: #849098;
  font-size: 10px;
}

.verified-mechanics-trace-chain strong {
  overflow: hidden;
  color: #d7dfe2;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.verified-mechanics-trace-chain li.applied strong {
  color: #e8f5f1;
}

.verified-mechanics-trace-unresolved {
  margin: 0;
  padding-left: 8px;
  border-left: 2px solid #c96f78;
  color: #d8a2a6;
  font-size: 10px;
  overflow-wrap: anywhere;
}

.verified-mechanics-trace-sources summary {
  color: #9ba6ad;
  font-size: 10px;
  cursor: pointer;
}

.verified-mechanics-trace-sources > div {
  display: grid;
  gap: 3px;
  padding: 6px 0;
}

.verified-mechanics-trace-sources span {
  color: #7f8b92;
  font-size: 9px;
}

.verified-mechanics-trace-sources code {
  color: #b9c5c8;
  font-size: 9px;
  overflow-wrap: anywhere;
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

.effect-editor {
  display: grid;
  gap: 0;
  margin: 0 14px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.effect-editor-heading,
.effect-command-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.effect-command-heading > small {
  margin-left: auto;
  color: #f2b366;
  font-size: 10px;
  font-weight: 800;
}

.effect-editor-heading {
  min-height: 42px;
  color: #d8dee3;
  font-size: 13px;
  font-weight: 800;
}

.effect-editor-heading button,
.effect-command-heading button {
  display: inline-grid;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgba(121, 199, 185, 0.28);
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.1);
  color: #dff9f3;
  cursor: pointer;
}

.effect-command-heading button {
  border-color: rgba(239, 137, 137, 0.25);
  background: rgba(239, 137, 137, 0.08);
  color: #ffc7c7;
}

.effect-editor-icon {
  width: 14px;
  height: 14px;
}

.effect-command-row {
  display: grid;
  gap: 10px;
  padding: 12px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}

.effect-command-row.generated {
  border-color: rgba(242, 179, 102, 0.34);
}

.effect-command-generated-summary {
  display: grid;
  gap: 4px;
  color: #c8d1d8;
  font-size: 11px;
}

.effect-command-generated-summary strong {
  color: #f4f7f8;
  font-size: 12px;
}

.effect-command-generated-summary small {
  color: #8f9aa3;
  font-size: 10px;
}

.effect-command-heading strong {
  min-width: 0;
  overflow: hidden;
  color: #f4f7f8;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.effect-command-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}

.effect-field-wide {
  grid-column: 1 / -1;
}

.action-result-return {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 9px;
  border: 1px solid rgba(121, 199, 185, 0.26);
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.09);
}

.action-result-return div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.action-result-return span,
.action-result-return small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-result-return span {
  color: #9ce0d2;
  font-size: 11px;
  font-weight: 700;
}

.action-result-return strong {
  min-width: 0;
  overflow: hidden;
  color: #ffffff;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-result-return small {
  color: #aeb8c1;
  font-size: 11px;
}

.action-result-return button {
  display: inline-grid;
  grid-template-columns: 13px auto;
  align-items: center;
  gap: 4px;
  min-width: 0;
  min-height: 28px;
  padding: 0 9px;
  border: 1px solid rgba(121, 199, 185, 0.3);
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.14);
  color: #dff9f3;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.action-result-return-icon {
  width: 13px;
  height: 13px;
}

.frame-edit-controls {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  min-width: 0;
}

.frame-edit-control {
  min-width: 0;
}

.frame-stepper {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) 30px;
  gap: 6px;
  min-width: 0;
}

.frame-stepper input {
  text-align: center;
}

.frame-stepper-button {
  display: inline-grid;
  width: 30px;
  height: 34px;
  place-items: center;
  border: 1px solid rgba(121, 199, 185, 0.24);
  border-radius: 4px;
  background: rgba(121, 199, 185, 0.1);
  color: #dff9f3;
  cursor: pointer;
}

.frame-stepper-button:disabled {
  cursor: not-allowed;
  opacity: 0.38;
}

.frame-stepper-button:not(:disabled):hover,
.frame-stepper-button:not(:disabled):focus {
  filter: brightness(1.15);
}

.frame-stepper-icon {
  width: 13px;
  height: 13px;
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

label.edit-focused {
  margin: -6px;
  padding: 6px;
  border-radius: 4px;
  background: rgba(242, 179, 102, 0.08);
}

label span {
  color: #8f9aa3;
  font-size: 12px;
}

label.edit-focused span {
  color: #f2b366;
  font-weight: 700;
}

label.edit-focused::after {
  min-width: 0;
  padding: 5px 7px;
  border-radius: 4px;
  background: rgba(242, 179, 102, 0.12);
  color: #ffd8a6;
  content: attr(data-edit-focus-label) ' · ' attr(data-edit-focus-summary);
  font-size: 11px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

label.edit-focused[data-edit-focus-origin='runtime-focus']::after {
  background: rgba(121, 199, 185, 0.12);
  color: #9ce0d2;
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
