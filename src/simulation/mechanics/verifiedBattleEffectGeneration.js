import {
  resolveVerifiedCombatActionMechanics,
} from '../../data/verifiedCombatMechanicsPackage';
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
  elementTagLayers = null,
  elementIdsHeld = null,
  stackElementLayers = null,
}) {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return { matched: true, reason: null };
  }
  for (const condition of conditions) {
    const conditionType = Number(condition.conditionType);
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
          reason:
            'verified-effect-property-condition-element-tag-unresolved',
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
          reason:
            'verified-effect-property-condition-element-tag-not-matched',
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
          reason:
            'verified-effect-property-condition-element-id-unresolved',
        };
      }
      const key = `${targetKind}:${targetId}`;
      if (!elementIdsHeld?.get(key)?.has(elementId)) {
        return {
          matched: false,
          reason:
            'verified-effect-property-condition-element-id-not-matched',
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
          reason:
            'verified-effect-property-condition-element-layer-unresolved',
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
} = {}) {
  const executionByActionId = new Map(
    (actionExecutionPlan?.actions ?? []).map(entry => [entry.actionId, entry])
  );
  const actionResolutionById = new Map();
  const effectCommands = [];
  const directSpEvents = [...generatedDirectSpEvents];
  const directHpEvents = [];
  const shieldEvents = [];
  const unresolved = [];
  const elementTagLayers = new Map();
  const elementIdsHeld = new Map();
  const stackElementLayers = new Map();
  const suppressedWatcherEffectIdentities = new Set(
    (
      mechanicsPackage?.actionVariantGraph?.breakTriggerWatchers ?? []
    ).flatMap(watcher => watcher.suppressedEffectIdentities ?? [])
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
    const runtimeEffects = [
      ...(resolution.semanticEffects ?? []),
      ...(resolution.effects ?? []).filter(
        effect => effect.runtimeGenerationMode === 'raw-direct-effect'
      ),
    ].filter(
      effect =>
        !isSuppressedBreakWatcherEffect(
          effect,
          suppressedWatcherEffectIdentities
        )
    );
    for (const effect of runtimeEffects) {
      if (effect.role && effect.role !== 'gameplay-effect') continue;
      if (effect.tuningMark || effect.tuningOverlimit) continue;
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
      const targets = resolveEffectTargets({
        action,
        effect,
        scenario,
        timeMs: resolveEffectTimeMs(action, effect, resolution),
        controlledActorTimeline,
      });
      const timeMs = resolveEffectTimeMs(action, effect, resolution);
      const formulaResult = resolveEffectValue(action, effect, resolution);
      const value = formulaResult.value;
      if (targets.length === 0 || timeMs == null || value == null) {
        unresolved.push(
          createUnresolvedEffect(action, effect, [
            targets.length === 0 ? 'generated-effect-target-unresolved' : null,
            timeMs == null ? 'generated-effect-time-unresolved' : null,
            value == null ? 'generated-effect-value-unresolved' : null,
            formulaResult.reason,
          ])
        );
        continue;
      }
      for (const [targetSequenceIndex, target] of targets.entries()) {
        const conditionResult = evaluateVerifiedBattleEffectConditions({
          conditions: effect.activationConditions,
          action,
          resolution,
          targetKind: target.kind,
          targetId: target.id,
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
              timeMs,
              value,
              formulaResult,
              resolution,
              targetSequenceIndex,
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
              timeMs,
              value,
              formulaResult,
              resolution,
              targetSequenceIndex,
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
              timeMs,
              value,
              formulaResult,
              resolution,
              targetSequenceIndex,
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
              timeMs,
              value,
              formulaResult,
              resolution,
              targetSequenceIndex,
            })
          );
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

  const generatedCount =
    effectCommands.length +
    directSpEvents.length +
    directHpEvents.length +
    shieldEvents.length;
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
    unresolved,
    summary: {
      resolvedActionCount: actionResolutionById.size,
      effectCommandCount: effectCommands.length,
      directSpEventCount: directSpEvents.length,
      directHpEventCount: directHpEvents.length,
      shieldEventCount: shieldEvents.length,
      unresolvedEffectCount: unresolved.length,
      generatedCount,
      applied: true,
    },
    applied: true,
  };
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
}) {
  const effectIdentity = resolveEffectIdentity(effect);
  const triggerSequencePath =
    resolveStrictSameFrameEffectSequencePath({
      action,
      effect,
      resolution,
    });
  const effectDisplay = createBattlePropertyEffectDisplayLabel({
    sourceText: effect.displayLabel ?? effect.name,
    effectKind: effect.kind,
    sourceIdentity: effect.sourceIdentity ?? effect.sourceIdentities,
    attributeId: effect.propertyChange.attributeId,
    targetKind: effect.target?.kind,
  });
  return {
    id: `verified-effect|${action.id}|${effectIdentity}|${target.kind}:${target.id}`,
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
}) {
  const effectIdentity = resolveEffectIdentity(effect);
  const sourceSequencePath = createVerifiedEffectSourceSequencePath({
    action,
    effect,
    phase: 'settlement',
    localSequenceSuffix: [targetSequenceIndex],
  });
  const sourceSequenceReady = Array.isArray(sourceSequencePath);
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-verified-battle-direct-effect',
    status: sourceSequenceReady
      ? 'verified-battle-direct-effect-ready'
      : 'verified-battle-direct-effect-source-sequence-unresolved',
    eventIdentity: `${kind}|${action.id}|${effectIdentity}|${target.kind}:${target.id}`,
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
    return [
      action.type === ACTION_TYPES.KIBO_EVENT &&
      effect.target?.kind === 'source-owner'
        ? { kind: EFFECT_TARGET_KINDS.KIBO, id: action.actorId }
        : { kind: EFFECT_TARGET_KINDS.ACTOR, id: action.actorId },
    ];
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
