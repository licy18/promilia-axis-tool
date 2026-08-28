import { resolveVerifiedCombatActionMechanics } from '../../data/verifiedCombatMechanicsPackage';
import {
  ACTION_TYPES,
  EFFECT_OPERATIONS,
  EFFECT_STACK_MODES,
  EFFECT_TARGET_KINDS,
} from '../../domain/projectSchema';
import { evaluateVerifiedBattleEffectFormula } from './verifiedBattleEffectFormulaRuntime';
import { isControlledActorEffectTargetKind } from '../../domain/effectTargetSemantics';
import { createBattlePropertyEffectDisplayLabel } from '../../domain/sourceDisplayText';
import { isActionFrameWithinContextualOccupancy } from './actionEffectiveTimeline';
import { resolveControlledActorAt } from '../runtime/controlledActorTimeline';
import {
  VERIFIED_EFFECT_SOURCE_SEQUENCE_CONTRACT_NAME,
  createVerifiedEffectSourceSequencePath,
} from '../../domain/verifiedEffectSourceSequence';
import { resolveActionHitWillHit } from '../../domain/actionHitOverrides';

export const VERIFIED_BATTLE_EFFECT_GENERATION_CONTRACT_NAME =
  'AzPrVerifiedBattleEffectGeneration';

function registerTargetElementTags({
  target,
  effect,
  elementTagLayers,
  elementIdsHeld,
}) {
  const tags = effect.lifecycle?.tags ?? [];
  const elementId = Number(effect.elementId);
  if (tags.length === 0 && !Number.isInteger(elementId)) return;
  const key = `${target.kind}:${target.id}`;
  if (tags.length > 0) {
    const layers = elementTagLayers.get(key) ?? new Map();
    for (const tag of tags) {
      layers.set(Number(tag), (layers.get(Number(tag)) ?? 0) + 1);
    }
    elementTagLayers.set(key, layers);
  }
  if (Number.isInteger(elementId)) {
    const held = elementIdsHeld.get(key) ?? new Set();
    held.add(elementId);
    elementIdsHeld.set(key, held);
  }
}

export function evaluateVerifiedBattleEffectConditions({
  conditions = [],
  action,
  resolution,
  targetKind = null,
  targetId = null,
  targetElementId = null,
  elementTagLayers = null,
  elementIdsHeld = null,
  stackElementLayers = null,
}) {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return { matched: true, reason: null };
  }
  for (const condition of conditions) {
    const conditionType = Number(condition.conditionType);
    if (conditionType === 1) {
      if (targetElementId == null || targetElementId === '') {
        return {
          matched: false,
          reason:
            'verified-effect-property-condition-entity-element-target-unresolved',
        };
      }
      const elementId = Number(targetElementId);
      const allowedElementMask = Number(condition.entityElementalType);
      if (
        targetKind !== EFFECT_TARGET_KINDS.ACTOR ||
        !Number.isInteger(elementId) ||
        elementId < 0 ||
        elementId > 9
      ) {
        return {
          matched: false,
          reason:
            'verified-effect-property-condition-entity-element-target-unresolved',
        };
      }
      if (
        !Number.isInteger(allowedElementMask) ||
        allowedElementMask <= 0 ||
        (allowedElementMask & (1 << elementId)) === 0
      ) {
        return {
          matched: false,
          reason:
            'verified-effect-property-condition-entity-element-not-matched',
        };
      }
      continue;
    }
    if (conditionType === 2) {
      if (Number(action.controlSkillId) !== Number(condition.skillId)) {
        return {
          matched: false,
          reason:
            'verified-effect-property-condition-current-skill-id-not-matched',
        };
      }
      continue;
    }
    if (conditionType === 5) {
      const rawSkillTags = resolution?.controlBinding?.logic?.skillTag;
      if (rawSkillTags == null || String(rawSkillTags).trim() === '') {
        return {
          matched: false,
          reason:
            'verified-effect-property-condition-current-skill-tag-unresolved',
        };
      }
      const values = String(rawSkillTags)
        .split('|')
        .map(value => Number(value.trim()))
        .filter(Number.isInteger);
      if (!values.includes(Number(condition.skillTag))) {
        return {
          matched: false,
          reason:
            'verified-effect-property-condition-current-skill-tag-not-matched',
        };
      }
      continue;
    }
    if (conditionType === 3) {
      if (targetKind == null || targetId == null) {
        return {
          matched: false,
          reason:
            'verified-effect-property-condition-element-tag-target-unresolved',
        };
      }
      const elementTag = Number(condition.elementTag);
      if (!Number.isInteger(elementTag) || elementTag === 0) {
        return {
          matched: false,
          reason: 'verified-effect-property-condition-element-tag-unresolved',
        };
      }
      if (Number(condition.subConditionType) !== 0) {
        return {
          matched: false,
          reason:
            'verified-effect-property-condition-element-count-runtime-evidence-required',
        };
      }
      const key = `${targetKind}:${targetId}`;
      const layers = elementTagLayers?.get(key)?.get(elementTag) ?? 0;
      if (layers < Math.max(1, Number(condition.maxChangeCount) || 1)) {
        return {
          matched: false,
          reason: 'verified-effect-property-condition-element-tag-not-matched',
        };
      }
      continue;
    }
    if (conditionType === 4) {
      if (targetKind == null || targetId == null) {
        return {
          matched: false,
          reason:
            'verified-effect-property-condition-element-id-target-unresolved',
        };
      }
      const elementId = Number(condition.elementId);
      if (!Number.isInteger(elementId) || elementId === 0) {
        return {
          matched: false,
          reason: 'verified-effect-property-condition-element-id-unresolved',
        };
      }
      const key = `${targetKind}:${targetId}`;
      if (!elementIdsHeld?.get(key)?.has(elementId)) {
        return {
          matched: false,
          reason: 'verified-effect-property-condition-element-id-not-matched',
        };
      }
      continue;
    }
    if (conditionType === 6) {
      if (targetKind == null || targetId == null) {
        return {
          matched: false,
          reason:
            'verified-effect-property-condition-element-layer-target-unresolved',
        };
      }
      const layerElementId = Number(condition.layerElementId);
      const minLayerCount = Math.max(1, Number(condition.minLayerCount) || 1);
      if (!Number.isInteger(layerElementId) || layerElementId === 0) {
        return {
          matched: false,
          reason: 'verified-effect-property-condition-element-layer-unresolved',
        };
      }
      const key = `${targetKind}:${targetId}`;
      const layers = stackElementLayers?.get(key)?.get(layerElementId) ?? 0;
      if (layers < minLayerCount) {
        return {
          matched: false,
          reason:
            'verified-effect-property-condition-element-layer-not-matched',
        };
      }
      continue;
    }
    return {
      matched: false,
      reason: 'verified-effect-property-condition-runtime-evidence-required',
    };
  }
  return { matched: true, reason: null };
}

export function createVerifiedBattleEffectGeneration({
  scenario = {},
  actionExecutionPlan = null,
  actionResolutionById: suppliedActionResolutionById = null,
  mechanicsPackage = null,
  controlledActorTimeline = null,
  generatedDirectSpEvents = [],
  runtimeManagedDirectSpEffects = [],
} = {}) {
  const executionByActionId = new Map(
    (actionExecutionPlan?.actions ?? []).map(entry => [entry.actionId, entry])
  );
  const actionResolutionById = new Map();
  const effectCommands = [];
  const directSpEvents = [...generatedDirectSpEvents];
  const directHpEvents = [];
  const shieldEvents = [];
  const cooldownReductionEvents = [];
  const dotCommands = [];
  const knownGaps = [];
  const unresolved = [];
  const elementTagLayers = new Map();
  const elementIdsHeld = new Map();
  const stackElementLayers = new Map();
  const runtimeManagedDirectSpEffectKeys = new Set(
    runtimeManagedDirectSpEffects
      .filter(
        entry =>
          entry?.actionId != null && Number.isInteger(Number(entry?.elementId))
      )
      .map(entry => `${String(entry.actionId)}\u0000${Number(entry.elementId)}`)
  );
  const suppressedWatcherEffectIdentities = new Set(
    (mechanicsPackage?.actionVariantGraph?.breakTriggerWatchers ?? []).flatMap(
      watcher => watcher.suppressedEffectIdentities ?? []
    )
  );
  const defaultWillHit =
    (scenario?.combatScenario?.projectile?.defaultWillHit ??
      scenario?.projectile?.defaultWillHit) !== false;

  for (const action of scenario.actions ?? []) {
    if (executionByActionId.get(action.id)?.execute === false) continue;
    if (![ACTION_TYPES.SKILL, ACTION_TYPES.KIBO_EVENT].includes(action.type)) {
      continue;
    }
    const resolution =
      suppliedActionResolutionById?.get(action.id) ??
      resolveVerifiedCombatActionMechanics(action, {
        combatScenario: scenario.combatScenario,
      });
    actionResolutionById.set(action.id, resolution);
    if (!resolution.ready) continue;
    assertMechanicsPackageBinding({ mechanicsPackage, resolution });
    // 效果入口覆盖所有 advertised applied 效果（不止 semantic/raw-direct）：
    // 此前大量奇波效果被源绑定标 applied 但无 semantic 投影、也非
    // raw-direct-effect，导致静默丢弃（18/43 奇波大招缺口）。
    // 去重：同一 resolution 内按效果身份（effectIdentity/semanticIdentity/
    // sourceIdentity）只处理一次；semantic 已覆盖的原始效果按 pathId 跳过。
    const semanticEffects = resolution.semanticEffects ?? [];
    const semanticPathIds = new Set(
      semanticEffects.map(effect => String(effect.pathId ?? '')).filter(Boolean)
    );
    const mergedEffects = [
      ...semanticEffects,
      ...(resolution.effects ?? []).filter(
        effect =>
          effect.classification === 'applied' &&
          !isConsumedBySemanticEffect(effect, semanticEffects, semanticPathIds)
      ),
    ];
    // 旧包中只有名称提示元素限定、却没有结构化条件的 pack 继续
    // fail-closed。新生成包会把客户端 CheckSelfElementalType 条件投影为
    // conditionType=1，并由子效果继承；这类 pack 不再进入阻断集合。
    const unresolvedElementLimitedPackPathIds = new Set(
      mergedEffects
        .filter(
          effect =>
            effect.kind === 'pack' &&
            /(角色|元素|属性)/.test(effect.name ?? '') &&
            !(effect.activationConditions ?? []).some(
              condition => Number(condition.conditionType) === 1
            )
        )
        .map(effect => String(effect.pathId ?? ''))
        .filter(Boolean)
    );
    const seenEffectIdentities = new Set();
    const runtimeEffects = [];
    for (const effect of mergedEffects) {
      if (
        isSuppressedBreakWatcherEffect(
          effect,
          suppressedWatcherEffectIdentities
        )
      ) {
        continue;
      }
      const identity =
        effect.effectIdentity ??
        effect.semanticIdentity ??
        `${effect.kind}|${effect.sourceIdentity ?? ''}`;
      if (identity && seenEffectIdentities.has(identity)) continue;
      if (identity) seenEffectIdentities.add(identity);
      runtimeEffects.push(effect);
    }
    for (const effect of runtimeEffects) {
      if (effect.role && effect.role !== 'gameplay-effect') continue;
      if (effect.tuningMark || effect.tuningOverlimit) continue;
      if (
        effect.directSp &&
        runtimeManagedDirectSpEffectKeys.has(
          `${String(action.id)}\u0000${Number(effect.elementId)}`
        )
      ) {
        continue;
      }
      // 合法跳过（在 target/value 解析之前）：damage 由 hit 系统结算；
      // inject/pack 是效果图内部组合/注入结构（子效果已单独列出）。
      // 注意：部分奇波恢复节点 kind='damage' 但携带 heal/shield
      // （500357/500358 风绒守护恢复），必须继续走资源 consumer。
      if (effect.kind === 'damage' && !effect.heal && !effect.shield) {
        // 公共校验（与下方非 damage 路径一致）：hit-bound 门、动作占用
        // 区间、classification。DoT 不得绕过这些——否则 SP 不足/未命中/
        // 越界动作也会产生幽灵周期伤害。
        if (
          !isHitBoundEffectEnabled({
            action,
            effect,
            resolution,
            defaultWillHit,
          })
        ) {
          continue;
        }
        if (
          Number.isFinite(Number(effect.trigger?.startFrame)) &&
          !isActionFrameWithinContextualOccupancy(
            action,
            effect.trigger.startFrame,
            resolution.controlBinding?.frameRate ?? 60
          )
        ) {
          continue;
        }
        if (effect.classification !== 'applied') {
          unresolved.push(createUnresolvedEffect(action, effect));
          continue;
        }
        // DoT（周期伤害，damageType=7，如 500360303 流血）：生成周期伤害
        // 命令，由 runtime 按 tick 结算（层数×奇波ATK×等级倍率/10000）。
        // 仅放行已验证的流血契约（root=500360301 && element=500360303）；
        // 其他 damageType=7/baseFunctionId=116 效果无可靠 tick 派生证据，
        // fail-closed 记 known-gap，不得套用流血模型。
        if (isVerifiedDotEffect(effect, mechanicsPackage)) {
          const dotTimeMs = resolveEffectTimeMs(action, effect, resolution);
          const dotTargets = resolveEffectTargets({
            action,
            effect,
            scenario,
            timeMs: dotTimeMs,
            controlledActorTimeline,
          });
          const dotCommand = createVerifiedDotCommand({
            action,
            effect,
            resolution,
            mechanicsPackage,
            timeMs: dotTimeMs,
            target: dotTargets[0],
          });
          if (dotCommand) {
            dotCommands.push(dotCommand);
          } else {
            knownGaps.push({
              actionId: action.id,
              effectIdentity: resolveEffectIdentity(effect),
              name: effect.name ?? null,
              reason: 'periodic-damage-command-unresolved',
              sourceIdentity: effect.sourceIdentity ?? null,
            });
          }
          continue;
        }
        // 普通 damage 由 hit 系统结算；DoT 声明（无 damage 字段 + 生命周期
        // 时长）但未识别为周期伤害时，记录 known-gap（不得静默当作普通 hit）。
        if (!effect.damage && Number(effect.lifecycle?.durationMs) > 0) {
          knownGaps.push({
            actionId: action.id,
            effectIdentity: resolveEffectIdentity(effect),
            name: effect.name ?? null,
            reason: 'periodic-damage-not-implemented',
            sourceIdentity: effect.sourceIdentity ?? null,
          });
        }
        continue;
      }
      if (effect.kind === 'inject' || effect.kind === 'pack') {
        // 只有缺少结构化条件的旧元素限定 pack 才记录 known-gap。
        if (
          effect.kind === 'pack' &&
          unresolvedElementLimitedPackPathIds.has(String(effect.pathId ?? ''))
        ) {
          knownGaps.push({
            actionId: action.id,
            effectIdentity: resolveEffectIdentity(effect),
            name: effect.name ?? null,
            reason: 'pack-element-filter-not-structured',
            sourceIdentity: effect.sourceIdentity ?? null,
          });
        }
        continue;
      }
      // 元素限定 pack 的子效果（relationPath 的 from 指向限定 pack 的
      // pathId）：元素过滤无法结构化，阻止施加，避免非限定角色被污染。
      // 这是 fail-closed——宁可缺失也不得用未验证的元素条件评分。
      if (
        unresolvedElementLimitedPackPathIds.size > 0 &&
        Array.isArray(effect.relationPath) &&
        effect.relationPath.some(edge =>
          unresolvedElementLimitedPackPathIds.has(
            String(edge.from ?? '').replace(/^element:/, '')
          )
        )
      ) {
        knownGaps.push({
          actionId: action.id,
          effectIdentity: resolveEffectIdentity(effect),
          name: effect.name ?? null,
          reason: 'pack-element-limited-child-blocked',
          sourceIdentity: effect.sourceIdentity ?? null,
        });
        continue;
      }
      if (
        !isHitBoundEffectEnabled({
          action,
          effect,
          resolution,
          defaultWillHit,
        })
      ) {
        continue;
      }
      if (
        Number.isFinite(Number(effect.trigger?.startFrame)) &&
        !isActionFrameWithinContextualOccupancy(
          action,
          effect.trigger.startFrame,
          resolution.controlBinding?.frameRate ?? 60
        )
      ) {
        continue;
      }
      if (effect.classification !== 'applied') {
        unresolved.push(createUnresolvedEffect(action, effect));
        continue;
      }
      const timeMs = resolveEffectTimeMs(action, effect, resolution);
      const occurrenceTimes = resolveRepeatedEffectTimes({
        timeMs,
        effect,
        resolution,
      });
      const formulaResult = resolveEffectValue(action, effect, resolution);
      const value = formulaResult.value;
      const initialTargets =
        occurrenceTimes.length > 0
          ? resolveEffectTargets({
              action,
              effect,
              scenario,
              timeMs: occurrenceTimes[0],
              controlledActorTimeline,
            })
          : [];
      if (
        initialTargets.length === 0 ||
        occurrenceTimes.length === 0 ||
        value == null
      ) {
        unresolved.push(
          createUnresolvedEffect(action, effect, [
            initialTargets.length === 0
              ? 'generated-effect-target-unresolved'
              : null,
            occurrenceTimes.length === 0
              ? 'generated-effect-time-unresolved'
              : null,
            value == null ? 'generated-effect-value-unresolved' : null,
            formulaResult.reason,
          ])
        );
        continue;
      }
      const repeating = occurrenceTimes.length > 1;
      for (const [
        triggerOccurrenceIndex,
        occurrenceTimeMs,
      ] of occurrenceTimes.entries()) {
        const targets =
          triggerOccurrenceIndex === 0
            ? initialTargets
            : resolveEffectTargets({
                action,
                effect,
                scenario,
                timeMs: occurrenceTimeMs,
                controlledActorTimeline,
              });
        for (const [targetSequenceIndex, target] of targets.entries()) {
          const conditionResult = evaluateVerifiedBattleEffectConditions({
            conditions: effect.activationConditions,
            action,
            resolution,
            targetKind: target.kind,
            targetId: target.id,
            targetElementId: resolveEffectTargetElementId({
              scenario,
              target,
            }),
            elementTagLayers,
            elementIdsHeld,
            stackElementLayers,
          });
          if (!conditionResult.matched) {
            continue;
          }
          if (effect.propertyChange) {
            effectCommands.push(
              createPropertyEffectCommand({
                action,
                effect,
                target,
                timeMs: occurrenceTimeMs,
                value,
                formulaResult,
                resolution,
                targetSequenceIndex,
                triggerOccurrenceIndex,
                repeating,
              })
            );
            registerTargetElementTags({
              target,
              effect,
              elementTagLayers,
              elementIdsHeld,
            });
            continue;
          }
          if (effect.directSp) {
            directSpEvents.push(
              createDirectEvent({
                kind: 'direct-sp',
                action,
                effect,
                target,
                timeMs: occurrenceTimeMs,
                value,
                formulaResult,
                resolution,
                targetSequenceIndex,
                triggerOccurrenceIndex,
                repeating,
              })
            );
            registerTargetElementTags({
              target,
              effect,
              elementTagLayers,
              elementIdsHeld,
            });
            continue;
          }
          if (effect.heal) {
            directHpEvents.push(
              createDirectEvent({
                kind: 'direct-heal',
                action,
                effect,
                target,
                timeMs: occurrenceTimeMs,
                value,
                formulaResult,
                resolution,
                targetSequenceIndex,
                triggerOccurrenceIndex,
                repeating,
              })
            );
            registerTargetElementTags({
              target,
              effect,
              elementTagLayers,
              elementIdsHeld,
            });
            continue;
          }
          if (effect.shield) {
            shieldEvents.push(
              createDirectEvent({
                kind: 'direct-shield',
                action,
                effect,
                target,
                timeMs: occurrenceTimeMs,
                value,
                formulaResult,
                resolution,
                targetSequenceIndex,
                triggerOccurrenceIndex,
                repeating,
              })
            );
            continue;
          }
          if (effect.cooldownReduction) {
            const cooldownReductionEvent = createDirectEvent({
              kind: 'direct-cooldown-reduction',
              action,
              effect,
              target,
              timeMs: occurrenceTimeMs,
              value,
              formulaResult,
              resolution,
              targetSequenceIndex,
              triggerOccurrenceIndex,
              repeating,
            });
            // evidence-only：实际冷却结算由 actionRuleDiagnostics 按
            // resolution.effects 独立执行（含百分比按剩余时间计算），
            // 这里的事件仅作可见性记录，不声称已被本路径 calculator 消费。
            cooldownReductionEvent.appliedToCalculators = false;
            cooldownReductionEvent.applied = false;
            cooldownReductionEvents.push(cooldownReductionEvent);
            continue;
          }
          unresolved.push(
            createUnresolvedEffect(action, effect, [
              'generated-effect-runtime-kind-unresolved',
            ])
          );
        }
      }
    }
  }

  const generatedCount =
    effectCommands.length +
    directSpEvents.length +
    directHpEvents.length +
    shieldEvents.length +
    cooldownReductionEvents.length +
    dotCommands.length;
  return {
    schemaVersion: 1,
    contractName: VERIFIED_BATTLE_EFFECT_GENERATION_CONTRACT_NAME,
    sourceKind: 'azpr-verified-battle-effect-generation',
    status: generatedCount
      ? 'verified-battle-effect-generation-ready'
      : 'verified-battle-effect-generation-ready-no-applied-effects',
    actionResolutionById,
    effectCommands,
    directSpEvents,
    directHpEvents,
    shieldEvents,
    cooldownReductionEvents,
    dotCommands,
    knownGaps,
    unresolved,
    summary: {
      resolvedActionCount: actionResolutionById.size,
      effectCommandCount: effectCommands.length,
      directSpEventCount: directSpEvents.length,
      directHpEventCount: directHpEvents.length,
      shieldEventCount: shieldEvents.length,
      cooldownReductionEventCount: cooldownReductionEvents.length,
      dotCommandCount: dotCommands.length,
      knownGapCount: knownGaps.length,
      unresolvedEffectCount: unresolved.length,
      generatedCount,
      applied: true,
    },
    applied: true,
  };
}

function resolveEffectTargetElementId({ scenario, target }) {
  if (target?.kind !== EFFECT_TARGET_KINDS.ACTOR) return null;
  return (
    (scenario?.actors ?? []).find(
      actor => String(actor.id) === String(target.id)
    )?.elementId ?? null
  );
}

function isConsumedBySemanticEffect(effect, semanticEffects, semanticPathIds) {
  if (!Array.isArray(semanticEffects) || semanticEffects.length === 0) {
    return false;
  }
  // 精确匹配：semantic 效果声明的 rawEffectIdentities（同效果身份）。
  const identitySet = new Set();
  for (const semantic of semanticEffects) {
    for (const identity of semantic.rawEffectIdentities ?? []) {
      identitySet.add(String(identity));
    }
  }
  if (identitySet.has(String(effect?.effectIdentity ?? ''))) return true;
  // pathId fallback：必须同时匹配触发帧，避免不同目标/时机的效果被
  // 误认为已被 semantic 覆盖（如 500166 的 ally 暴击 frame25 与自身
  // 暴击 frame24 共用 pathId 但语义不同）。
  if (!semanticPathIds || semanticPathIds.size === 0) return false;
  const sourceIdentity = String(effect?.sourceIdentity ?? '');
  // sourceIdentity 形如 battle-effect:<skillId>:<mapIndex>:<pathId>:<behaviorPathId>:<frame>
  const parts = sourceIdentity.split(':');
  if (parts.length >= 4 && parts[0] === 'battle-effect') {
    const pathId = parts[3];
    if (!semanticPathIds.has(pathId)) return false;
    const frame = String(effect?.trigger?.startFrame ?? '');
    return semanticEffects.some(
      semantic =>
        String(semantic.pathId ?? '') === pathId &&
        String(semantic.trigger?.startFrame ?? '') === frame
    );
  }
  return false;
}

function isSuppressedBreakWatcherEffect(effect, suppressedIdentities) {
  if (suppressedIdentities.size === 0) return false;
  if (
    suppressedIdentities.has(effect?.effectIdentity) ||
    suppressedIdentities.has(effect?.semanticIdentity)
  ) {
    return true;
  }
  return (effect?.rawEffectIdentities ?? []).some(identity =>
    suppressedIdentities.has(identity)
  );
}

function isHitBoundEffectEnabled({
  action,
  effect,
  resolution,
  defaultWillHit,
}) {
  const gate = effect.hitGate;
  if (gate?.kind === 'conditional-damage-group-hit') {
    return resolveActionHitWillHit(
      action,
      `conditional-damage:${gate.groupIdentity}:${Number(gate.hitIndex) || 1}`,
      defaultWillHit
    );
  }
  if (gate?.kind === 'landed-action-hit') {
    const hit = (resolution.hits ?? []).find(
      hit =>
        Number(hit.elementId) === Number(gate.elementId) &&
        Number(hit.trigger?.startFrame) === Number(gate.triggerFrame) &&
        (!gate.behaviorPathId ||
          hit.trigger?.behaviorPathId === gate.behaviorPathId)
    );
    return (
      hit != null &&
      resolveActionHitWillHit(
        action,
        hit.hitIdentity ?? hit.semanticIdentity ?? hit.effectIdentity,
        defaultWillHit
      )
    );
  }
  const behaviorPathId = String(effect.trigger?.behaviorPathId ?? '');
  if (!behaviorPathId) return true;
  const hit = (resolution.allHits ?? resolution.hits ?? []).find(
    candidate =>
      String(candidate.trigger?.behaviorPathId ?? '') === behaviorPathId &&
      Number(candidate.trigger?.startFrame) ===
        Number(effect.trigger?.startFrame)
  );
  if (!hit) return true;
  return resolveActionHitWillHit(
    action,
    hit.hitIdentity ?? hit.semanticIdentity ?? hit.effectIdentity,
    (resolution.hits ?? []).includes(hit)
  );
}

function assertMechanicsPackageBinding({ mechanicsPackage, resolution }) {
  const expectedPackageId = String(mechanicsPackage?.packageId ?? '');
  const expectedPackageHash = String(mechanicsPackage?.packageHash ?? '');
  const resolutionPackageId = String(resolution?.packageId ?? '');
  const resolutionPackageHash = String(resolution?.packageHash ?? '');
  if (
    !expectedPackageId ||
    !expectedPackageHash ||
    resolutionPackageId !== expectedPackageId ||
    resolutionPackageHash !== expectedPackageHash
  ) {
    throw new Error(
      'verified-battle-effect-generation-mechanics-package-binding-mismatch'
    );
  }
}

function createPropertyEffectCommand({
  action,
  effect,
  target,
  timeMs,
  value,
  formulaResult,
  resolution,
  triggerOccurrenceIndex = 0,
  repeating = false,
}) {
  const effectIdentity = resolveEffectIdentity(effect);
  const baseTriggerSequencePath = resolveStrictSameFrameEffectSequencePath({
    action,
    effect,
    resolution,
  });
  const triggerSequencePath =
    repeating && Array.isArray(baseTriggerSequencePath)
      ? [...baseTriggerSequencePath, triggerOccurrenceIndex]
      : baseTriggerSequencePath;
  const effectDisplay = createBattlePropertyEffectDisplayLabel({
    sourceText: effect.displayLabel ?? effect.name,
    effectKind: effect.kind,
    sourceIdentity: effect.sourceIdentity ?? effect.sourceIdentities,
    attributeId: effect.propertyChange.attributeId,
    targetKind: effect.target?.kind,
  });
  return {
    id: [
      `verified-effect|${action.id}|${effectIdentity}|${target.kind}:${target.id}`,
      ...(repeating ? [`occurrence:${triggerOccurrenceIndex}`] : []),
    ].join('|'),
    sourceActionId: action.id,
    sourceActionName: action.name,
    sourceActorId: action.actorId,
    sourceActorName: action.actor?.name ?? null,
    effectId: createRuntimeEffectId(action, effect),
    effectName:
      effectDisplay.sourceNameStatus === 'source-name-missing'
        ? `属性 ${effect.propertyChange.attributeId}`
        : effectDisplay.displayLabel,
    rawSourceName: effect.rawSourceName ?? effectDisplay.rawSourceName,
    sourceNameStatus: effect.sourceNameStatus ?? effectDisplay.sourceNameStatus,
    operation: EFFECT_OPERATIONS.APPLY,
    targetKind: target.kind,
    targetId: String(target.id),
    semanticTargetKind: effect.target?.kind ?? null,
    timeMs,
    durationMs: normalizeDuration(effect.lifecycle?.durationMs),
    stackMode: normalizeStackMode(effect.lifecycle?.stackMode),
    stackDelta: effect.lifecycle?.stackDelta ?? 1,
    maxStacks: effect.lifecycle?.maxStacks ?? 1,
    tags: effect.lifecycle?.tags ?? [],
    sourceStatus: 'verified-battle-effect-generated',
    confidence: effect.confidence ?? 'high',
    trackingStatus: 'applied',
    ...(effect.assumptionIdentity
      ? {
          appliedAssumptionIdentity: effect.assumptionIdentity,
          appliedAssumptionVersion: effect.assumptionVersion,
          appliedAssumptionHash: effect.assumptionHash,
        }
      : {}),
    sourceIdentity: {
      packageId: resolution.packageId,
      packageHash: resolution.packageHash,
      actionBindingIdentity: resolution.actionBinding.identity,
      effectIdentity,
      elementId: Number.isFinite(Number(effect.elementId))
        ? Number(effect.elementId)
        : null,
      pathId: effect.pathId ?? null,
      ...(effect.assumptionIdentity
        ? {
            assumptionIdentity: effect.assumptionIdentity,
            assumptionVersion: effect.assumptionVersion,
            assumptionHash: effect.assumptionHash,
          }
        : {}),
      sourceIdentity: effect.sourceIdentity ?? effect.sourceIdentities ?? null,
      ...(triggerSequencePath
        ? {
            sameFrameVisibility: 'strict-source-sequence',
            triggerSequencePath,
          }
        : {}),
    },
    ...(triggerSequencePath ? { sourceSequencePath: triggerSequencePath } : {}),
    inheritOnControlledActorSwitch:
      effect.lifecycle?.inheritance?.inheritOnControlledActorSwitch === true,
    inheritType: effect.lifecycle?.inheritance?.inheritType ?? null,
    inheritanceContainerElementId:
      effect.lifecycle?.inheritance?.containerElementId ?? null,
    inheritanceContainerPathId:
      effect.lifecycle?.inheritance?.containerPathId ?? null,
    inheritanceSourceIdentity:
      effect.lifecycle?.inheritance?.sourceIdentity ?? null,
    formulaSourceActorId: action.actorId,
    effectAdderActorId:
      effect.lifecycle?.inheritance?.inheritType === 'self'
        ? String(target.id)
        : action.actorId,
    modifiers: [
      {
        kind: 'battle-property',
        attributeId: effect.propertyChange.attributeId,
        bucket: effect.propertyChange.bucket,
        valueRaw: value,
        formulaResult,
        propertyTags: effect.propertyChange.defaultPropertyTags ?? [],
        sourceIdentity:
          effect.sourceIdentity ?? effect.sourceIdentities ?? null,
      },
    ],
    appliedToCalculators: true,
    generatedVerified: true,
    ...(repeating
      ? {
          triggerOccurrenceIndex,
          triggerIntervalMs: Number(effect.trigger?.intervalMs),
        }
      : {}),
  };
}

function resolveStrictSameFrameEffectSequencePath({
  action,
  effect,
  resolution,
}) {
  if (effect.hitSettlementOrder !== 'after-hit') return null;
  const effectElementIndex = Number(effect.sourceOrder?.elementIndex);
  if (!Number.isInteger(effectElementIndex)) return null;
  const hasEarlierSamePacketHit =
    effect.hitGate?.kind === 'conditional-damage-group-hit' ||
    (resolution.allHits ?? resolution.hits ?? []).some(
      hit =>
        String(hit.trigger?.behaviorPathId ?? '') ===
          String(effect.trigger?.behaviorPathId ?? '') &&
        Number(hit.trigger?.startFrame) ===
          Number(effect.trigger?.startFrame) &&
        Number.isInteger(Number(hit.elementIndex)) &&
        Number(hit.elementIndex) < effectElementIndex
    );
  if (!hasEarlierSamePacketHit) return null;
  return createVerifiedEffectSourceSequencePath({
    action,
    effect,
    phase: 'after',
  });
}

function createRuntimeEffectId(action, effect) {
  const base = `battle-element:${effect.pathId ?? effect.elementId}`;
  return effect.lifecycle?.instanceScope === 'source-action'
    ? `${base}|source:${action.id}`
    : base;
}

function createDirectEvent({
  kind,
  action,
  effect,
  target,
  timeMs,
  value,
  formulaResult,
  resolution,
  targetSequenceIndex,
  triggerOccurrenceIndex = 0,
  repeating = false,
}) {
  const effectIdentity = resolveEffectIdentity(effect);
  const sourceSequencePath = createVerifiedEffectSourceSequencePath({
    action,
    effect,
    phase: 'settlement',
    localSequenceSuffix: repeating
      ? [triggerOccurrenceIndex, targetSequenceIndex]
      : [targetSequenceIndex],
  });
  const sourceSequenceReady = Array.isArray(sourceSequencePath);
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-verified-battle-direct-effect',
    status: sourceSequenceReady
      ? 'verified-battle-direct-effect-ready'
      : 'verified-battle-direct-effect-source-sequence-unresolved',
    eventIdentity: [
      `${kind}|${action.id}|${effectIdentity}|${target.kind}:${target.id}`,
      ...(repeating ? [`occurrence:${triggerOccurrenceIndex}`] : []),
    ].join('|'),
    kind,
    timeMs,
    action,
    actionId: action.id,
    actorId: action.actorId,
    target,
    value,
    formulaResult,
    effect,
    resolution,
    sourceSequencePath,
    sourceSequenceStatus: sourceSequenceReady
      ? 'verified-direct-effect-source-sequence-ready'
      : 'verified-direct-effect-source-sequence-unresolved',
    sourceSequenceContract: {
      contractName: VERIFIED_EFFECT_SOURCE_SEQUENCE_CONTRACT_NAME,
      phase: 'settlement',
      targetSequenceIndex,
      ...(repeating ? { triggerOccurrenceIndex } : {}),
      effectSourceOrder: effect.sourceOrder ?? null,
      sourceIdentity:
        effect.sourceOrder?.sourceIdentity ?? effect.sourceIdentity ?? null,
    },
    sourceIdentity: effect.sourceIdentity ?? effect.sourceIdentities ?? null,
    unresolvedReasons: sourceSequenceReady
      ? []
      : ['verified-direct-effect-source-sequence-unresolved'],
    appliedToCalculators: sourceSequenceReady,
    applied: sourceSequenceReady,
    ...(repeating
      ? {
          triggerOccurrenceIndex,
          triggerIntervalMs: Number(effect.trigger?.intervalMs),
        }
      : {}),
  };
}

function resolveEffectTargets({
  action,
  effect,
  scenario,
  timeMs,
  controlledActorTimeline,
}) {
  if (effect.target?.kind === 'enemy') {
    return scenario.enemy?.id
      ? [{ kind: EFFECT_TARGET_KINDS.ENEMY, id: scenario.enemy.id }]
      : [];
  }
  if (isControlledActorEffectTargetKind(effect.target?.kind)) {
    const controlled = resolveControlledActorAt(
      controlledActorTimeline,
      timeMs
    );
    return controlled
      ? [{ kind: EFFECT_TARGET_KINDS.ACTOR, id: controlled.actorId }]
      : [];
  }
  if (['source-owner', 'owner-actor', 'player'].includes(effect.target?.kind)) {
    // 奇波大招的 source-owner 效果（500368/500369/500370 的直接回能等）
    // 作用于在场英雄（装备奇波的角色），不是给奇波本体充能。
    return [{ kind: EFFECT_TARGET_KINDS.ACTOR, id: action.actorId }];
  }
  if (effect.target?.kind === 'ally') {
    // ally（友方）：奇波大招的支援增益/治疗目标为全体友方角色。
    return (scenario.actors ?? []).map(actor => ({
      kind: EFFECT_TARGET_KINDS.ACTOR,
      id: actor.id,
    }));
  }
  if (effect.target?.kind === 'team-actors') {
    return (scenario.actors ?? []).map(actor => ({
      kind: EFFECT_TARGET_KINDS.ACTOR,
      id: actor.id,
    }));
  }
  if (effect.target?.kind === 'team-kibos') {
    return (scenario.actors ?? [])
      .filter(actor => Number(actor.loadout?.kiboId) > 0)
      .map(actor => ({
        kind: EFFECT_TARGET_KINDS.KIBO,
        id: actor.id,
      }));
  }
  return [];
}

function resolveEffectTimeMs(action, effect, resolution) {
  const startFrame = Number(effect.trigger?.startFrame);
  const frameRate = Number(resolution.controlBinding?.frameRate ?? 60);
  if (!Number.isInteger(startFrame) || !(frameRate > 0)) return null;
  if (!isActionFrameWithinContextualOccupancy(action, startFrame, frameRate)) {
    return null;
  }
  return roundValue(Number(action.startMs) + (startFrame * 1000) / frameRate);
}

function resolveRepeatedEffectTimes({ timeMs, effect, resolution }) {
  if (timeMs == null) return [];
  const intervalMs = Number(effect.trigger?.intervalMs);
  const frameCount = Number(effect.trigger?.frameCount);
  const frameRate = Number(resolution.controlBinding?.frameRate ?? 60);
  if (
    !Number.isInteger(intervalMs) ||
    intervalMs <= 0 ||
    !Number.isInteger(frameCount) ||
    frameCount < 0 ||
    !(frameRate > 0)
  ) {
    return [timeMs];
  }
  const frameDurationMs = 1000 / frameRate;
  const windowDurationMs = (frameCount * 1000) / frameRate;
  if (intervalMs < frameDurationMs || intervalMs > windowDurationMs) {
    return [timeMs];
  }
  const times = [];
  for (
    let offsetMs = 0;
    offsetMs <= windowDurationMs + 1e-6;
    offsetMs += intervalMs
  ) {
    times.push(roundValue(timeMs + offsetMs));
  }
  return times;
}

function resolveEffectValue(action, effect, resolution) {
  const level = clampInteger(
    action.level ?? resolution.actionBinding?.controlVariantSkillLevel,
    1,
    12,
    1
  );
  return evaluateVerifiedBattleEffectFormula({
    effect,
    level,
    sourceActor: action.actor,
  });
}

function normalizeDuration(value) {
  const duration = Number(value);
  return Number.isFinite(duration) && duration >= 0 ? duration : null;
}

function normalizeStackMode(value) {
  if (value === 'stack') return EFFECT_STACK_MODES.STACK;
  if (value === 'replace') return EFFECT_STACK_MODES.REPLACE;
  return EFFECT_STACK_MODES.REFRESH;
}

function createUnresolvedEffect(action, effect, reasons = []) {
  return {
    actionId: action.id,
    effectIdentity: resolveEffectIdentity(effect),
    kind: effect.kind,
    dimensions: effect.dimensions,
    reasons: [
      ...new Set([...(effect.reasons ?? []), ...reasons.filter(Boolean)]),
    ],
    sourceIdentity: effect.sourceIdentity ?? effect.sourceIdentities ?? null,
    status: 'verified-battle-effect-generation-unresolved',
    applied: false,
  };
}

function resolveEffectIdentity(effect) {
  return effect.semanticIdentity ?? effect.effectIdentity;
}

function clampInteger(value, minimum, maximum, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(number)));
}

function roundValue(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e6) / 1e6;
}

// DoT（周期伤害）识别：仅放行已验证的流血契约
// （rootElementId=500360301 && elementId=500360303，damageType=7，
// baseFunctionId=116）。机制包中还有其他 damageType=7/baseFunctionId=116
// 效果（如 502004 火残响、10700305 残响），但它们没有已验证的
// tick/叠层/首帧证据，不能套用流血模型——fail-closed（返回 false → 走
// known-gap），不得静默转换为周期伤害。
function isVerifiedDotEffect(effect, mechanicsPackage) {
  if (!effect || effect.kind !== 'damage') return false;
  const isVerifiedBleed =
    Number(effect.rootElementId) === 500360301 &&
    Number(effect.elementId) === 500360303;
  if (!isVerifiedBleed) return false;
  if (Number(effect.damage?.damageType) === 7) return true;
  if (Number(effect.formula?.baseFunctionId) === 116) return true;
  const nodes = mechanicsPackage?.battleEffectCatalog?.nodes ?? [];
  const node = nodes.find(
    candidate => String(candidate.elementId) === String(effect.elementId)
  );
  return Boolean(node && Number(node.damage?.damageType) === 7);
}

// DoT 命令：携带施加信息（时长、tick 间隔、层数、等级倍率），由 runtime
// 按 tick 结算。层数上限取 root 叠层（combineType=4 stack）的 maxStacks。
function createVerifiedDotCommand({
  action,
  effect,
  resolution,
  mechanicsPackage,
  timeMs,
  target,
}) {
  const nodes = mechanicsPackage?.battleEffectCatalog?.nodes ?? [];
  const node = nodes.find(
    candidate => String(candidate.elementId) === String(effect.elementId)
  );
  const level = clampInteger(
    action.level ?? resolution.actionBinding?.controlVariantSkillLevel,
    1,
    12,
    1
  );
  const durationMs =
    positiveNumberOrNull(effect.lifecycle?.durationMs) ??
    positiveNumberOrNull(node?.lifecycle?.durationMs) ??
    20_000;
  const valueByLevel = node?.formula?.valueByLevel ?? {};
  const ratioAtLevel = Number(valueByLevel[level]);
  if (!Number.isFinite(ratioAtLevel) || ratioAtLevel <= 0) {
    return null;
  }
  // 层数上限：root 叠层优先（500360301 combineType=4 stack → maxStacks=3），
  // 子节点自身的 maxStacks（303 replace → 1）不反映叠层语义。
  const rootNode = nodes.find(
    candidate => String(candidate.elementId) === String(effect.rootElementId)
  );
  const maxStacks =
    positiveIntegerOrNull(
      rootNode?.lifecycle?.combineNumber ??
        rootNode?.lifecycle?.maxStacks ??
        effect.lifecycle?.maxStacks
    ) ?? 3;
  const elementalType = Number(
    effect.damage?.elementalType ??
      node?.damage?.elementalType ??
      node?.damage?.elementId ??
      9
  );
  return {
    schemaVersion: 1,
    kind: 'verified-battle-effect-dot',
    status: 'verified-battle-effect-dot-command-ready',
    sourceKind: 'azpr-verified-battle-effect-dot',
    actionId: action.id,
    actionName: action.name ?? action.id,
    sourceActorId: action.actorId ?? null,
    sourceKiboId: action.kiboId ?? null,
    elementId: Number(effect.elementId),
    rootElementId: Number(effect.rootElementId) || Number(effect.elementId),
    pathId: effect.pathId ?? null,
    name: effect.name ?? effect.displayLabel ?? null,
    sourceIdentity: effect.sourceIdentity ?? null,
    damageType: 7,
    elementalType,
    ignoreDamageEvent:
      Number(node?.damage?.ignoreDamageEvent) === 1 ||
      Number(effect.damage?.ignoreDamageEvent) === 1 ||
      // damageType=7（DoT）在客户端默认 ignoreDamageEvent=1（不进入普通
      // 伤害事件），用户规格确认：流血 DoT 的 ignoreDamageEvent=1。
      Number(node?.damage?.damageType) === 7 ||
      Number(effect.damage?.damageType) === 7,
    durationMs,
    tickIntervalMs: 1000,
    timeExeFirstFrame: true,
    maxStacks,
    stackDelta: 1,
    level,
    ratioAtLevel,
    valueByLevel,
    formula: {
      baseFunctionId: Number(
        effect.formula?.baseFunctionId ?? node?.formula?.baseFunctionId
      ),
      baseExpression:
        effect.formula?.baseExpression ?? node?.formula?.baseExpression ?? null,
    },
    target: {
      kind: target.kind,
      id: target.id,
    },
    timeMs: roundValue(timeMs),
    trigger: {
      startFrame: Number(effect.trigger?.startFrame),
      behaviorPathId: effect.trigger?.behaviorPathId ?? null,
    },
    // canonical source sequence：同帧多次施加时，owner（等级系数/源奇波）
    // 必须由来源顺序决定，而不是可任意命名的 actionId。
    sourceSequencePath: createVerifiedEffectSourceSequencePath({
      action,
      effect,
      phase: 'settlement',
      localSequenceSuffix: [0],
    }),
    applied: true,
  };
}

function positiveNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
