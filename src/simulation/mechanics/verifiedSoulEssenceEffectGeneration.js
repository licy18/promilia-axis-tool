import soulEssenceEffectCatalog from '../../data/generated/soulessence-effect-mechanics.json';
import {
  EFFECT_OPERATIONS,
  EFFECT_STACK_MODES,
  EFFECT_TARGET_KINDS,
} from '../../domain/projectSchema';
import { resolveActionHitWillHit } from '../../domain/actionHitOverrides';
import { getActionSourceSequencePath } from '../../domain/actionSourceSequence';
import { isActionFrameWithinContextualOccupancy } from './actionEffectiveTimeline';
import { evaluateVerifiedBattleEffectFormula } from './verifiedBattleEffectFormulaRuntime';

export const VERIFIED_SOULESSENCE_EFFECT_GENERATION_CONTRACT_NAME =
  'AzPrVerifiedSoulEssenceEffectGeneration';

const SOULESSENCE_TRIGGER_OPERATOR_REGISTRY = Object.freeze({
  'action-start': resolveActionTriggerOccurrence,
  'action-end': resolveActionTriggerOccurrence,
  'hit-after-damage': resolveLandedHitTriggerOccurrences,
});

export function createVerifiedSoulEssenceEffectGeneration({
  scenario = {},
  actionExecutionPlan = null,
  actionResolutionById = null,
  catalog = soulEssenceEffectCatalog,
} = {}) {
  const executionByActionId = new Map(
    (actionExecutionPlan?.actions ?? []).map(entry => [entry.actionId, entry])
  );
  const definitionBySoulId = new Map(
    (catalog?.definitions ?? [])
      .filter(definition => definition.runtimeStatus === 'runtime-applied')
      .map(definition => [Number(definition.soulEssenceId), definition])
  );
  const bindings = (scenario.actors ?? [])
    .map(actor => createEquippedSoulBinding(actor, definitionBySoulId))
    .filter(Boolean);
  const effectCommands = [];
  const suppressions = [];
  const unresolved = [];

  for (const binding of bindings) {
    if (!binding.starValue) {
      unresolved.push({
        actorId: binding.actor.id,
        soulEssenceId: binding.soulEssenceId,
        effectSkillId: binding.definition.effectSkillId,
        status: 'soulessence-effect-runtime-unresolved',
        reasons: ['soulessence-effect-star-value-unresolved'],
        sourceIdentity: binding.definition.sourceIdentity,
      });
      continue;
    }
    if (binding.formulaResult?.applied !== true) {
      unresolved.push({
        actorId: binding.actor.id,
        soulEssenceId: binding.soulEssenceId,
        effectSkillId: binding.definition.effectSkillId,
        status: 'soulessence-effect-runtime-unresolved',
        reasons: [
          binding.formulaResult?.reason ??
            'soulessence-effect-formula-evaluation-unresolved',
        ],
        sourceIdentity: binding.definition.sourceIdentity,
      });
      continue;
    }
    for (const [actionIndex, action] of (scenario.actions ?? []).entries()) {
      if (String(action.actorId) !== String(binding.actor.id)) continue;
      if (executionByActionId.get(action.id)?.execute !== true) continue;
      const resolution = actionResolutionById?.get?.(action.id) ?? null;
      const actionContext = resolveSoulTriggerActionContext({
        action,
        resolution,
      });
      const actionKind = actionContext.actionKind;
      const conditionMatch = matchesSoulTriggerCondition(
        binding.definition.trigger?.condition,
        actionContext
      );
      if (!conditionMatch.matched) {
        suppressions.push({
          actionId: action.id,
          actorId: binding.actor.id,
          soulEssenceId: binding.soulEssenceId,
          effectSkillId: binding.definition.effectSkillId,
          reason: 'soulessence-effect-action-kind-condition-not-matched',
          expectedActionKinds:
            binding.definition.trigger?.condition?.actionKinds ?? [],
          actualActionKind: actionKind,
          expectedCondition: binding.definition.trigger?.condition ?? null,
          actualSkillSlotIds: actionContext.skillSlotIds,
          actualSkillTagIds: actionContext.skillTagIds,
          conditionReasons: conditionMatch.reasons,
        });
        continue;
      }
      const triggerOperator =
        SOULESSENCE_TRIGGER_OPERATOR_REGISTRY[
          binding.definition.trigger.frameAnchor
        ];
      const occurrences = triggerOperator?.({
        action,
        resolution,
        scenario,
      });
      if (!Array.isArray(occurrences) || occurrences.length === 0) {
        suppressions.push({
          actionId: action.id,
          actorId: binding.actor.id,
          soulEssenceId: binding.soulEssenceId,
          effectSkillId: binding.definition.effectSkillId,
          reason: triggerOperator
            ? resolveEmptyTriggerOccurrenceReason(
                binding.definition.trigger.frameAnchor
              )
            : 'soulessence-effect-trigger-operator-unavailable',
          triggerFrameAnchor: binding.definition.trigger.frameAnchor,
        });
        continue;
      }
      const targets = resolveSoulEffectTargets({
        binding,
        scenario,
      });
      effectCommands.push(
        ...occurrences.flatMap(({ hit }) =>
          targets.map((target, targetIndex) =>
            createSoulEffectCommand({
              binding,
              action,
              actionIndex,
              actionKind,
              actionContext,
              conditionMatch,
              resolution,
              hit,
              target,
              targetIndex,
              catalog,
            })
          )
        )
      );
    }
  }

  return {
    schemaVersion: 1,
    contractName: VERIFIED_SOULESSENCE_EFFECT_GENERATION_CONTRACT_NAME,
    kind: 'azpr-verified-soulessence-effect-generation',
    status: unresolved.length
      ? 'verified-soulessence-effect-generation-partial'
      : 'verified-soulessence-effect-generation-ready',
    catalogHash: catalog?.catalogHash ?? null,
    effectCommands,
    suppressions,
    unresolved,
    summary: {
      equippedBindingCount: bindings.length,
      effectCommandCount: effectCommands.length,
      suppressionCount: suppressions.length,
      unresolvedCount: unresolved.length,
    },
  };
}

function resolveActionTriggerOccurrence() {
  return [{ hit: null }];
}

function resolveEmptyTriggerOccurrenceReason(frameAnchor) {
  if (String(frameAnchor).startsWith('hit-')) {
    return 'soulessence-effect-no-landed-source-hit';
  }
  return 'soulessence-effect-action-occurrence-unavailable';
}

function resolveLandedHitTriggerOccurrences({ action, resolution, scenario }) {
  const defaultWillHit = scenario?.projectile?.defaultWillHit !== false;
  return (resolution?.hits ?? [])
    .filter(hit => isSoulTriggerHitWithinAction(action, resolution, hit))
    .filter(hit =>
      resolveActionHitWillHit(
        action,
        resolveSoulTriggerHitIdentity(hit),
        defaultWillHit
      )
    )
    .map(hit => ({ hit }));
}

function resolveSoulTriggerHitIdentity(hit) {
  return String(
    hit?.identity ??
      hit?.hitIdentity ??
      hit?.sourceIdentity ??
      `${hit?.elementId ?? 'element'}|${hit?.hitIndex ?? 'hit'}`
  );
}

function createEquippedSoulBinding(actor, definitionBySoulId) {
  const soulEssenceId = Number(actor?.loadout?.soulessenceId);
  if (!Number.isInteger(soulEssenceId) || soulEssenceId <= 0) return null;
  const definition = definitionBySoulId.get(soulEssenceId);
  if (!definition) return null;
  const effectSkill =
    actor.loadout?.soulessenceCultivation?.effectSkill ?? null;
  if (
    effectSkill?.runtimeStatus !== 'runtime-applied' ||
    Number(effectSkill.skillId) !== Number(definition.effectSkillId)
  ) {
    return null;
  }
  const star = Number(effectSkill.star);
  const starValue = definition.effect?.valuesByStar?.find(
    row => Number(row.star) === star
  );
  const formulaResult = starValue
    ? evaluateSoulEffectFormula({
        definition,
        starValue,
        star,
        actor,
      })
    : null;
  return {
    actor,
    soulEssenceId,
    definition,
    star: Number.isInteger(star) ? star : null,
    starValue: starValue ?? null,
    formulaResult,
    cultivationSourceIdentity: effectSkill?.sourceIdentity ?? null,
  };
}

function createSoulEffectCommand({
  binding,
  action,
  actionIndex,
  actionKind,
  actionContext,
  conditionMatch,
  resolution,
  hit,
  target,
  targetIndex,
  catalog,
}) {
  const { definition, starValue, formulaResult, actor } = binding;
  const effect = definition.effect;
  const frameAnchor = definition.trigger.frameAnchor;
  const frameRate = positiveNumber(resolution?.controlBinding?.frameRate, 60);
  const hitFrame = hit == null ? null : Number(hit.trigger?.startFrame);
  const timeMs = roundRuntimeTime(
    Number(action.startMs) +
      (frameAnchor === 'action-end'
        ? Number(action.durationMs)
        : frameAnchor === 'hit-after-damage'
          ? (hitFrame * 1000) / frameRate
          : 0)
  );
  const actionSourceSequencePath = getActionSourceSequencePath(
    action,
    actionIndex
  ) ?? [actionIndex];
  const triggerSequencePath =
    hit == null
      ? [...actionSourceSequencePath, targetIndex]
      : [...actionSourceSequencePath, Number(hit.hitIndex), targetIndex];
  const effectIdentity = `soulessence:${binding.soulEssenceId}:element:${effect.elementId}`;
  return {
    id: `soulessence|${binding.soulEssenceId}|${action.id}|${effect.elementId}|${frameAnchor}|target:${target.id}${hit == null ? '' : `|hit:${hit.hitIndex}`}`,
    sourceActionId: action.id,
    sourceActionName: action.name,
    sourceActorId: actor.id,
    sourceActorName: actor.name,
    sourceSoulEssenceId: binding.soulEssenceId,
    sourceHitIdentity: hit?.sourceIdentity ?? null,
    sourceHitIndex: hit?.hitIndex ?? null,
    sourceHitElementId: hit?.elementId ?? null,
    effectId: effectIdentity,
    effectName: `${definition.name}-${effect.name ?? effect.elementId}`,
    operation: EFFECT_OPERATIONS.APPLY,
    targetKind: EFFECT_TARGET_KINDS.ACTOR,
    targetId: String(target.id),
    targetName: target.name ?? null,
    semanticTargetKind: definition.trigger.target?.kind ?? 'self-actor',
    timeMs,
    durationMs: effect.durationMs,
    stackMode: normalizeStackMode(effect.stackMode),
    stackDelta: effect.stackDelta,
    maxStacks: effect.maxStacks,
    tags: [
      'soulessence-effect',
      definition.mechanismFamily,
      `soulessence:${binding.soulEssenceId}`,
      `skill:${definition.effectSkillId}`,
      `action-kind:${actionKind}`,
    ],
    sourceStatus: 'verified-loadout-effect-generated',
    confidence: 'high',
    trackingStatus: 'applied',
    generatedVerified: true,
    appliedToCalculators: true,
    formulaSourceActorId: actor.id,
    effectAdderActorId: actor.id,
    modifiers: [
      {
        kind: 'battle-property',
        attributeId: effect.attributeId,
        bucket: effect.bucket,
        valueRaw: formulaResult.value,
        value: formulaResult.value,
        sourceRawA: formulaResult.sourceRawA,
        evaluatedValue: formulaResult.evaluatedValue,
        formulaIdentity: formulaResult.formulaIdentity,
        formulaResult,
        sourceElementId: effect.elementId,
        sourceElementPathId: effect.pathId,
        propertyTags: [...(effect.propertyTags ?? [])],
        propertyTagMatchMode: effect.propertyTagMatchMode ?? 'unscoped',
        propertyTagSourceIdentity: effect.propertyTagSourceIdentity ?? null,
        sourceIdentity: effect.sourceIdentity,
      },
    ],
    sourceIdentity: {
      packageId: catalog?.kind ?? soulEssenceEffectCatalog.kind,
      catalogKind: catalog?.kind ?? soulEssenceEffectCatalog.kind,
      catalogHash: catalog?.catalogHash ?? soulEssenceEffectCatalog.catalogHash,
      effectIdentity,
      soulEssenceId: binding.soulEssenceId,
      effectSkillId: definition.effectSkillId,
      triggerElementId: definition.trigger.elementId,
      triggerPathId: definition.trigger.pathId,
      triggerEvent: definition.trigger.event,
      frameAnchor,
      triggerSequencePath,
      sourceHitIdentity: hit?.sourceIdentity ?? null,
      sourceHitIndex: hit?.hitIndex ?? null,
      sourceHitElementId: hit?.elementId ?? null,
      triggerCondition: definition.trigger.condition,
      matchedConditionIdentities: conditionMatch.matchedConditionIdentities,
      actionSkillSlotIds: actionContext.skillSlotIds,
      actionSkillTagIds: actionContext.skillTagIds,
      actionKind,
      actionBindingIdentity:
        resolution?.actionBinding?.identity ??
        resolution?.actionBinding?.semanticIdentity ??
        null,
      effectElementId: effect.elementId,
      effectPathId: effect.pathId,
      effectPropertyTags: [...(effect.propertyTags ?? [])],
      effectPropertyTagMatchMode: effect.propertyTagMatchMode ?? 'unscoped',
      effectPropertyTagSourceIdentity: effect.propertyTagSourceIdentity ?? null,
      switchTrigger: actionContext.switchTrigger,
      lifecycle: effect.lifecycle ?? {
        sourceKind: 'property-leaf-duration',
        durationMs: effect.durationMs,
        leafDurationMs: effect.durationMs,
      },
      star: binding.star,
      starValueSourceIdentity: starValue.sourceIdentity,
      formulaIdentity: formulaResult.formulaIdentity,
      formulaSourceIdentity: effect.formula.sourceIdentity ?? null,
      sourceRawA: formulaResult.sourceRawA,
      evaluatedValue: formulaResult.evaluatedValue,
      targetIdentity: {
        targetKind: definition.trigger.target?.kind ?? 'self-actor',
        targetId: String(target.id),
        targetIndex,
        sourceIdentity: definition.trigger.target?.sourceIdentity ?? null,
      },
      cultivationSourceIdentity: binding.cultivationSourceIdentity,
      provenance: [definition.sourceIdentity],
    },
  };
}

function evaluateSoulEffectFormula({ definition, starValue, star, actor }) {
  if (
    !Number.isInteger(Number(definition.effect.formula?.commonFunctionId)) ||
    !Number.isInteger(Number(definition.effect.formula?.baseFunctionId))
  ) {
    return {
      family: definition.effect.formula?.family ?? 'legacy-literal-a',
      status: 'applied',
      evaluator: 'legacy-synthetic-literal-a',
      applied: true,
      value: Number(starValue.valueRaw),
      raw: null,
      sourceRawA: Number(starValue.valueRaw),
      evaluatedValue: Number(starValue.valueRaw),
      evaluatedRaw: null,
      formulaIdentity: 'synthetic-legacy-formula',
      trace: [],
      q16Trace: [],
      reason: null,
    };
  }
  const params = Array.from({ length: 26 }, () => 0);
  params[0] = Number(starValue.valueRaw);
  params[6] = Number(definition.effect.formula.commonRatioRaw);
  return evaluateVerifiedBattleEffectFormula({
    effect: {
      ...definition.effect,
      property: { bucket: definition.effect.bucket },
      formula: {
        ...definition.effect.formula,
        paramsByLevel: { [star]: params },
      },
    },
    level: star,
    sourceActor: actor,
  });
}

function resolveSoulEffectTargets({ binding, scenario }) {
  if (binding.definition.trigger?.target?.kind === 'team-actors') {
    return (scenario.actors ?? []).map(actor => ({
      id: actor.id,
      name: actor.name ?? null,
    }));
  }
  return [{ id: binding.actor.id, name: binding.actor.name ?? null }];
}

function resolveSoulTriggerActionContext({ action, resolution }) {
  const actionBinding = resolution?.actionBinding ?? {};
  const controlBinding = resolution?.controlBinding ?? {};
  return {
    actionKind:
      actionBinding.actionKind ?? action.actionKind ?? action.eventType ?? null,
    skillSlotIds: uniqueFiniteIntegers([
      actionBinding.skillSlotId,
      actionBinding.skillSlotType,
      action.skillSlotId,
      ...extractSkillSlotIds(actionBinding.bindingSourceIdentity),
    ]),
    skillTagIds: uniqueFiniteIntegers([
      controlBinding.logic?.skillTagId,
      ...parseDelimitedNumbers(controlBinding.logic?.skillTag),
    ]),
    switchTrigger: {
      kind: action.derivedAction?.kind ?? null,
      parentActionId:
        action.derivedAction?.parentActionId ?? action.parentActionId ?? null,
      triggerPhase: action.switchTriggerBinding?.triggerPhase ?? null,
      resolutionStatus: action.switchTriggerBinding?.resolutionStatus ?? null,
      applied: action.switchTriggerBinding?.applied === true,
      sourceIdentity: action.switchTriggerBinding?.sourceIdentity ?? null,
    },
  };
}

function matchesSoulTriggerCondition(condition, actionContext) {
  const legacyConditionShape = !Array.isArray(condition?.conditions);
  const conditions = Array.isArray(condition?.conditions)
    ? condition.conditions
    : condition
      ? [condition]
      : [];
  if (conditions.length === 0) {
    return {
      matched: false,
      matchedConditionIdentities: [],
      reasons: ['soulessence-effect-trigger-condition-missing'],
    };
  }
  const results = conditions.map(entry => {
    if (entry.kind === 'skill-slot') {
      return (
        (actionContext.skillSlotIds.includes(Number(entry.skillSlotId)) ||
          (legacyConditionShape &&
            (entry.actionKinds ?? []).includes(actionContext.actionKind))) &&
        matchesSoulTriggerProvenance(entry, actionContext)
      );
    }
    if (entry.kind === 'skill-tag') {
      return (
        (actionContext.skillTagIds.includes(Number(entry.skillTagId)) ||
          (legacyConditionShape &&
            (entry.actionKinds ?? []).includes(actionContext.actionKind))) &&
        matchesSoulTriggerProvenance(entry, actionContext)
      );
    }
    return (
      (entry.actionKinds ?? []).includes(actionContext.actionKind) &&
      matchesSoulTriggerProvenance(entry, actionContext)
    );
  });
  const logic = condition?.logic ?? 'and';
  const matched =
    logic === 'or' ? results.some(Boolean) : results.every(Boolean);
  return {
    matched,
    matchedConditionIdentities: conditions
      .filter((_entry, index) => results[index])
      .map(entry => entry.sourceIdentity)
      .filter(Boolean),
    reasons: matched
      ? []
      : conditions.map((entry, index) => ({
          condition: entry,
          matched: results[index],
        })),
  };
}

function matchesSoulTriggerProvenance(condition, actionContext) {
  if (!condition?.provenanceRequirement) return true;
  if (condition.provenanceRequirement === 'switch-triggered-on-enter') {
    return (
      actionContext.switchTrigger?.kind === 'switch-triggered-star-carry' &&
      actionContext.switchTrigger?.triggerPhase === 'on-enter' &&
      actionContext.switchTrigger?.applied === true
    );
  }
  return false;
}

function extractSkillSlotIds(sourceIdentity) {
  return [
    ...String(sourceIdentity ?? '').matchAll(
      /skillSlots\[[^\]]*slot=(\d+)\]/gu
    ),
  ].map(match => Number(match[1]));
}

function parseDelimitedNumbers(value) {
  if (Array.isArray(value)) return value.map(Number);
  return String(value ?? '')
    .split(/[^\d-]+/u)
    .filter(Boolean)
    .map(Number);
}

function uniqueFiniteIntegers(values) {
  return [...new Set(values.map(Number).filter(Number.isInteger))];
}

function isSoulTriggerHitWithinAction(action, resolution, hit) {
  const frameRate = positiveNumber(resolution?.controlBinding?.frameRate, 60);
  const hitFrame = Number(hit?.trigger?.startFrame);
  return (
    Number.isFinite(hitFrame) &&
    isActionFrameWithinContextualOccupancy(action, hitFrame, frameRate)
  );
}

function normalizeStackMode(value) {
  if (value === EFFECT_STACK_MODES.STACK) return EFFECT_STACK_MODES.STACK;
  if (value === EFFECT_STACK_MODES.REPLACE) return EFFECT_STACK_MODES.REPLACE;
  return EFFECT_STACK_MODES.REFRESH;
}

function roundRuntimeTime(value) {
  return Math.round(Number(value) * 1_000_000) / 1_000_000;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
