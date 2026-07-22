import { resolveVerifiedCombatActionMechanics } from '../../data/verifiedCombatMechanicsPackage';
import {
  ACTION_TYPES,
  EFFECT_OPERATIONS,
  EFFECT_STACK_MODES,
  EFFECT_TARGET_KINDS,
} from '../../domain/projectSchema';
import { evaluateVerifiedBattleEffectFormula } from './verifiedBattleEffectFormulaRuntime';

export const VERIFIED_BATTLE_EFFECT_GENERATION_CONTRACT_NAME =
  'AzPrVerifiedBattleEffectGeneration';

export function createVerifiedBattleEffectGeneration({
  scenario = {},
  actionExecutionPlan = null,
  actionResolutionById: suppliedActionResolutionById = null,
} = {}) {
  const executionByActionId = new Map(
    (actionExecutionPlan?.actions ?? []).map(entry => [entry.actionId, entry])
  );
  const actionResolutionById = new Map();
  const effectCommands = [];
  const directSpEvents = [];
  const directHpEvents = [];
  const shieldEvents = [];
  const unresolved = [];

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
    for (const effect of resolution.semanticEffects ??
      resolution.effects ??
      []) {
      if (effect.role && effect.role !== 'gameplay-effect') continue;
      if (effect.tuningMark || effect.tuningOverlimit) continue;
      if (effect.classification !== 'applied') {
        unresolved.push(createUnresolvedEffect(action, effect));
        continue;
      }
      const targets = resolveEffectTargets({ action, effect, scenario });
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
      for (const target of targets) {
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
            })
          );
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
            })
          );
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
            })
          );
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
  return {
    id: `verified-effect|${action.id}|${effectIdentity}|${target.kind}:${target.id}`,
    sourceActionId: action.id,
    sourceActionName: action.name,
    sourceActorId: action.actorId,
    sourceActorName: action.actor?.name ?? null,
    effectId: createRuntimeEffectId(action, effect),
    effectName: effect.name || `属性 ${effect.propertyChange.attributeId}`,
    operation: EFFECT_OPERATIONS.APPLY,
    targetKind: target.kind,
    targetId: String(target.id),
    timeMs,
    durationMs: normalizeDuration(effect.lifecycle?.durationMs),
    stackMode: normalizeStackMode(effect.lifecycle?.stackMode),
    stackDelta: effect.lifecycle?.stackDelta ?? 1,
    maxStacks: effect.lifecycle?.maxStacks ?? 1,
    tags: effect.lifecycle?.tags ?? [],
    sourceStatus: 'verified-battle-effect-generated',
    confidence: effect.confidence ?? 'high',
    trackingStatus: 'applied',
    sourceIdentity: {
      packageId: resolution.packageId,
      packageHash: resolution.packageHash,
      actionBindingIdentity: resolution.actionBinding.identity,
      effectIdentity,
      sourceIdentity: effect.sourceIdentity ?? effect.sourceIdentities ?? null,
    },
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
}) {
  const effectIdentity = resolveEffectIdentity(effect);
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-verified-battle-direct-effect',
    status: 'verified-battle-direct-effect-ready',
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
    sourceIdentity: effect.sourceIdentity ?? effect.sourceIdentities ?? null,
    appliedToCalculators: true,
    applied: true,
  };
}

function resolveEffectTargets({ action, effect, scenario }) {
  if (effect.target?.kind === 'enemy') {
    return scenario.enemy?.id
      ? [{ kind: EFFECT_TARGET_KINDS.ENEMY, id: scenario.enemy.id }]
      : [];
  }
  if (
    ['source-owner', 'owner-actor', 'controlling-actor', 'player'].includes(
      effect.target?.kind
    )
  ) {
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
  return roundValue(Number(action.startMs) + (startFrame * 1000) / frameRate);
}

function resolveEffectValue(action, effect, resolution) {
  const level = clampInteger(
    action.level ?? resolution.actionBinding?.controlVariantSkillLevel,
    1,
    12,
    1
  );
  return evaluateVerifiedBattleEffectFormula({ effect, level });
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
