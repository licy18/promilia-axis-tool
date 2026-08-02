import soulEssenceEffectCatalog from '../../data/generated/soulessence-effect-mechanics.json';
import {
  EFFECT_OPERATIONS,
  EFFECT_STACK_MODES,
  EFFECT_TARGET_KINDS,
} from '../../domain/projectSchema';
import { resolveActionHitWillHit } from '../../domain/actionHitOverrides';
import { getActionSourceSequencePath } from '../../domain/actionSourceSequence';
import { isActionFrameWithinContextualOccupancy } from './actionEffectiveTimeline';

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
    for (const [actionIndex, action] of (scenario.actions ?? []).entries()) {
      if (String(action.actorId) !== String(binding.actor.id)) continue;
      if (executionByActionId.get(action.id)?.execute === false) continue;
      const resolution = actionResolutionById?.get?.(action.id) ?? null;
      const actionKind =
        resolution?.actionBinding?.actionKind ??
        action.actionKind ??
        action.eventType ??
        null;
      if (
        !binding.definition.trigger?.condition?.actionKinds?.includes(actionKind)
      ) {
        suppressions.push({
          actionId: action.id,
          actorId: binding.actor.id,
          soulEssenceId: binding.soulEssenceId,
          effectSkillId: binding.definition.effectSkillId,
          reason: 'soulessence-effect-action-kind-condition-not-matched',
          expectedActionKinds:
            binding.definition.trigger?.condition?.actionKinds ?? [],
          actualActionKind: actionKind,
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
            ? 'soulessence-effect-no-landed-source-hit'
            : 'soulessence-effect-trigger-operator-unavailable',
        });
        continue;
      }
      effectCommands.push(
        ...occurrences.map(({ hit }) =>
          createSoulEffectCommand({
          binding,
          action,
          actionIndex,
          actionKind,
          resolution,
          hit,
          catalog,
          })
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
  const effectSkill = actor.loadout?.soulessenceCultivation?.effectSkill ?? null;
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
  return {
    actor,
    soulEssenceId,
    definition,
    star: Number.isInteger(star) ? star : null,
    starValue: starValue ?? null,
    cultivationSourceIdentity: effectSkill?.sourceIdentity ?? null,
  };
}

function createSoulEffectCommand({
  binding,
  action,
  actionIndex,
  actionKind,
  resolution,
  hit,
  catalog,
}) {
  const { definition, starValue, actor } = binding;
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
  const actionSourceSequencePath =
    getActionSourceSequencePath(action, actionIndex) ?? [actionIndex];
  const triggerSequencePath =
    hit == null
      ? [...actionSourceSequencePath]
      : [...actionSourceSequencePath, Number(hit.hitIndex)];
  const effectIdentity = `soulessence:${binding.soulEssenceId}:element:${effect.elementId}`;
  return {
    id: `soulessence|${binding.soulEssenceId}|${action.id}|${effect.elementId}|${frameAnchor}${hit == null ? '' : `|hit:${hit.hitIndex}`}`,
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
    targetId: String(actor.id),
    semanticTargetKind: 'self-actor',
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
        valueRaw: starValue.valueRaw,
        value: starValue.valueRaw,
        formulaResult: {
          family: effect.formula.family,
          value: starValue.valueRaw,
          reason: null,
        },
        sourceElementId: effect.elementId,
        sourceElementPathId: effect.pathId,
        propertyTags: [...(effect.propertyTags ?? [])],
        propertyTagMatchMode: effect.propertyTagMatchMode ?? 'unscoped',
        propertyTagSourceIdentity:
          effect.propertyTagSourceIdentity ?? null,
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
      skillTagId: definition.trigger.condition.skillTagId,
      actionKind,
      actionBindingIdentity:
        resolution?.actionBinding?.identity ??
        resolution?.actionBinding?.semanticIdentity ??
        null,
      effectElementId: effect.elementId,
      effectPathId: effect.pathId,
      effectPropertyTags: [...(effect.propertyTags ?? [])],
      effectPropertyTagMatchMode:
        effect.propertyTagMatchMode ?? 'unscoped',
      effectPropertyTagSourceIdentity:
        effect.propertyTagSourceIdentity ?? null,
      star: binding.star,
      starValueSourceIdentity: starValue.sourceIdentity,
      cultivationSourceIdentity: binding.cultivationSourceIdentity,
      provenance: [definition.sourceIdentity],
    },
  };
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
