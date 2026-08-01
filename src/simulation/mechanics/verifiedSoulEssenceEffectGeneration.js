import soulEssenceEffectCatalog from '../../data/generated/soulessence-effect-mechanics.json';
import {
  EFFECT_OPERATIONS,
  EFFECT_STACK_MODES,
  EFFECT_TARGET_KINDS,
} from '../../domain/projectSchema';

export const VERIFIED_SOULESSENCE_EFFECT_GENERATION_CONTRACT_NAME =
  'AzPrVerifiedSoulEssenceEffectGeneration';

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
    for (const action of scenario.actions ?? []) {
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
      effectCommands.push(
        createSoulEffectCommand({
          binding,
          action,
          actionKind,
          resolution,
          catalog,
        })
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
  actionKind,
  resolution,
  catalog,
}) {
  const { definition, starValue, actor } = binding;
  const effect = definition.effect;
  const frameAnchor = definition.trigger.frameAnchor;
  const timeMs = roundRuntimeTime(
    Number(action.startMs) +
      (frameAnchor === 'action-end' ? Number(action.durationMs) : 0)
  );
  const effectIdentity = `soulessence:${binding.soulEssenceId}:element:${effect.elementId}`;
  return {
    id: `soulessence|${binding.soulEssenceId}|${action.id}|${effect.elementId}|${frameAnchor}`,
    sourceActionId: action.id,
    sourceActionName: action.name,
    sourceActorId: actor.id,
    sourceActorName: actor.name,
    sourceSoulEssenceId: binding.soulEssenceId,
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
      skillTagId: definition.trigger.condition.skillTagId,
      actionKind,
      actionBindingIdentity:
        resolution?.actionBinding?.identity ??
        resolution?.actionBinding?.semanticIdentity ??
        null,
      effectElementId: effect.elementId,
      effectPathId: effect.pathId,
      star: binding.star,
      starValueSourceIdentity: starValue.sourceIdentity,
      cultivationSourceIdentity: binding.cultivationSourceIdentity,
      provenance: [definition.sourceIdentity],
    },
  };
}

function normalizeStackMode(value) {
  if (value === EFFECT_STACK_MODES.STACK) return EFFECT_STACK_MODES.STACK;
  if (value === EFFECT_STACK_MODES.REPLACE) return EFFECT_STACK_MODES.REPLACE;
  return EFFECT_STACK_MODES.REFRESH;
}

function roundRuntimeTime(value) {
  return Math.round(Number(value) * 1_000_000) / 1_000_000;
}
