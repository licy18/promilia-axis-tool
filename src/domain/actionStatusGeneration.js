import {
  getWorkbenchActionStatusEffectCandidates,
  getWorkbenchKiboActionStatusCooldown,
} from '../data/workbenchActionStatusCatalog';
import { frameToMs } from './timebase';
import { inferCatalogActionKind } from './skillActionCatalog';
import { getSkillActionVariants } from './skillDamageSegments';
import {
  createSkillLogicModel,
  resolveSkillCooldownSource,
} from './skillLogicModel';

export const ACTION_STATUS_GENERATION_CONTRACT_NAME =
  'AzPrActionStatusGeneration';
export const GENERATED_ACTION_STATUS_SOURCE =
  'generated-from-azpr-action-status-catalog';

export function createSkillActionStatusGeneration({
  actionId,
  skill,
  level = 1,
  actionVariantIndex = 0,
  logicModel = null,
} = {}) {
  const normalizedActionId = String(actionId ?? '').trim() || 'action';
  const normalizedVariantIndex = Math.max(0, Number(actionVariantIndex) || 0);
  const resolvedLogicModel = logicModel ?? createSkillLogicModel(skill, level);
  const variants = getSkillActionVariants(skill, level);
  const selectedVariant =
    variants.find(
      variant => Number(variant.index) === normalizedVariantIndex
    ) ??
    variants[0] ??
    null;
  const actionKind = inferCatalogActionKind(selectedVariant, skill);
  const effectCandidates = getWorkbenchActionStatusEffectCandidates(
    skill?.id
  ).map(candidate =>
    createEffectGenerationStatus({
      candidate,
      actionKind,
      actionVariantIndex: normalizedVariantIndex,
    })
  );
  const generatedEffects = effectCandidates.filter(
    effect => effect.status === 'generated-lifecycle'
  );
  const cooldown = createCooldownGenerationStatus(resolvedLogicModel);
  const generatedEffectCommands = generatedEffects.map((effect, index) =>
    createGeneratedEffectCommand({
      actionId: normalizedActionId,
      effect,
      index,
    })
  );
  const trackingOnlyEffectCount = effectCandidates.filter(
    effect => effect.status !== 'generated-lifecycle'
  ).length;

  return {
    descriptor: {
      schemaVersion: 1,
      contractName: ACTION_STATUS_GENERATION_CONTRACT_NAME,
      sourceKind: 'azpr-action-status-generation',
      status: resolveGenerationStatus({
        cooldown,
        generatedEffectCommands,
        trackingOnlyEffectCount,
      }),
      actionId: normalizedActionId,
      skillId: Number(skill?.id) || null,
      actionVariantIndex: normalizedVariantIndex,
      actionKind,
      cooldown,
      effects: effectCandidates,
      summary: {
        confirmedCooldownCount:
          cooldown.status === 'confirmed-cooldown' ? 1 : 0,
        effectCandidateCount: effectCandidates.length,
        generatedEffectCount: generatedEffectCommands.length,
        trackingOnlyEffectCount,
        calculatorAppliedEffectCount: 0,
      },
      appliedToCalculators: false,
    },
    effectCommands: generatedEffectCommands,
  };
}

export function createKiboActionStatusGeneration({
  actionId,
  kiboId = null,
  skillId = null,
  timingSource = null,
} = {}) {
  const normalizedKiboId = positiveIntegerOrNull(kiboId);
  const normalizedSkillId = positiveIntegerOrNull(skillId);
  const catalogCooldown = getWorkbenchKiboActionStatusCooldown(
    normalizedKiboId,
    normalizedSkillId
  );
  const resolvedKiboId =
    normalizedKiboId ?? positiveIntegerOrNull(catalogCooldown?.kiboId);
  const cooldown = createKiboCooldownGenerationStatus({
    kiboId: resolvedKiboId,
    skillId: normalizedSkillId,
    catalogCooldown,
  });
  return {
    schemaVersion: 1,
    contractName: ACTION_STATUS_GENERATION_CONTRACT_NAME,
    sourceKind: 'azpr-kibo-action-status-generation',
    status:
      cooldown.status === 'confirmed-cooldown'
        ? 'action-status-generation-ready-with-cooldown'
        : 'tracking-only-no-confirmed-status-source',
    actionId: String(actionId ?? '').trim() || 'action',
    kiboId: resolvedKiboId,
    skillId: normalizedSkillId,
    timingSource: String(timingSource ?? '').trim() || null,
    cooldown,
    effects: [],
    summary: {
      confirmedCooldownCount: cooldown.status === 'confirmed-cooldown' ? 1 : 0,
      effectCandidateCount: 0,
      generatedEffectCount: 0,
      trackingOnlyEffectCount: 0,
      calculatorAppliedEffectCount: 0,
    },
    appliedToCalculators: false,
  };
}

export function mergeGeneratedActionStatusEffectCommands(
  configuredCommands = [],
  generatedCommands = []
) {
  return [
    ...stripGeneratedActionStatusEffectCommands(configuredCommands),
    ...(Array.isArray(generatedCommands) ? generatedCommands : []),
  ];
}

export function stripGeneratedActionStatusEffectCommands(commands = []) {
  return (Array.isArray(commands) ? commands : []).filter(
    command => command?.sourceStatus !== GENERATED_ACTION_STATUS_SOURCE
  );
}

function createCooldownGenerationStatus(logicModel) {
  const source = resolveSkillCooldownSource(logicModel);
  if (!source) {
    return {
      status: 'no-confirmed-cooldown',
      durationMs: null,
      chargeCount: null,
      sourceIdentity: null,
      applied: false,
    };
  }
  return {
    status: 'confirmed-cooldown',
    durationMs: source.durationMs,
    chargeCount: source.chargeCount,
    sourceIdentity: {
      sourceKind: source.sourceKind,
      sourceStatus: source.sourceStatus,
      subSkillId: source.subSkillId,
      durationFieldPath: source.durationFieldPath,
      chargeCountFieldPath: source.chargeCountFieldPath,
    },
    applied: true,
  };
}

function createKiboCooldownGenerationStatus({
  kiboId,
  skillId,
  catalogCooldown,
}) {
  const durationMs = Number(catalogCooldown?.cooldownMs);
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return {
      status: 'no-confirmed-cooldown',
      durationMs: null,
      chargeCount: null,
      sourceIdentity: null,
      applied: false,
    };
  }
  return {
    status: 'confirmed-cooldown',
    durationMs,
    chargeCount: Math.max(
      1,
      Math.trunc(Number(catalogCooldown.cooldownCount) || 1)
    ),
    sourceIdentity: {
      sourceKind: 'azpr-newtable-kibo-standard-battle-cooldown',
      sourceStatus: 'confirmed-structured-data',
      kiboId,
      subSkillId: skillId,
      cooldownMode: 'standard-battle',
      durationFieldPath: `skillsub_logic.rows[skillId=${skillId}].coolDown`,
      chargeCountFieldPath: `skillsub_logic.rows[skillId=${skillId}].coolDownCount`,
      cooldownDefaultMs: catalogCooldown.cooldownDefaultMs ?? null,
      kiboVersusCooldownMs: catalogCooldown.kiboVersusCooldownMs ?? null,
      kiboVersusCooldownDefaultMs:
        catalogCooldown.kiboVersusCooldownDefaultMs ?? null,
    },
    applied: true,
  };
}

function createEffectGenerationStatus({
  candidate,
  actionKind,
  actionVariantIndex,
}) {
  const variantMatches =
    candidate.requiredActionVariantIndex === actionVariantIndex &&
    candidate.requiredActionKind === actionKind;
  const lifecycleBound = candidate.status === 'lifecycle-bound';
  return {
    effectId: candidate.effectId,
    effectName: candidate.effectName,
    icon: candidate.icon || null,
    status:
      lifecycleBound && variantMatches
        ? 'generated-lifecycle'
        : variantMatches
          ? candidate.status
          : 'tracking-only-action-variant-not-bound',
    catalogStatus: candidate.status,
    targetKind: lifecycleBound && variantMatches ? candidate.targetKind : null,
    triggerFrame:
      lifecycleBound && variantMatches ? candidate.triggerFrame : null,
    triggerFrames: [...(candidate.triggerFrames ?? [])],
    durationMs: candidate.durationMs,
    operation: lifecycleBound && variantMatches ? candidate.operation : null,
    stackMode: lifecycleBound && variantMatches ? candidate.stackMode : null,
    confidence: candidate.confidence,
    trackingStatus: candidate.trackingStatus,
    requiredActionKind: candidate.requiredActionKind,
    requiredActionVariantIndex: candidate.requiredActionVariantIndex,
    sourceIdentity: cloneObject(candidate.sourceIdentity),
    appliedToCalculators: false,
  };
}

function createGeneratedEffectCommand({ actionId, effect, index }) {
  return {
    id: [
      actionId,
      'generated-status',
      effect.effectId,
      effect.triggerFrame,
      index,
    ].join('-'),
    effectId: effect.effectId,
    effectName: effect.effectName,
    icon: effect.icon,
    operation: effect.operation,
    targetKind: effect.targetKind,
    targetId: null,
    offsetMs: frameToMs(effect.triggerFrame),
    durationMs: effect.durationMs,
    stackMode: effect.stackMode ?? 'replace',
    stackDelta: 1,
    maxStacks: 1,
    tags: [
      'catalog-generated',
      'tracking-only',
      'unapplied',
      'stacking-unconfirmed',
    ],
    sourceStatus: GENERATED_ACTION_STATUS_SOURCE,
    confidence: effect.confidence,
    trackingStatus: effect.trackingStatus,
    sourceIdentity: cloneObject(effect.sourceIdentity),
    modifiers: [],
    appliedToCalculators: false,
  };
}

function resolveGenerationStatus({
  cooldown,
  generatedEffectCommands,
  trackingOnlyEffectCount,
}) {
  if (generatedEffectCommands.length > 0) {
    return 'action-status-generation-ready-with-lifecycle';
  }
  if (cooldown.status === 'confirmed-cooldown') {
    return 'action-status-generation-ready-with-cooldown';
  }
  if (trackingOnlyEffectCount > 0) {
    return 'action-status-generation-tracking-only';
  }
  return 'action-status-generation-ready-no-confirmed-status';
}

function cloneObject(value) {
  return value && typeof value === 'object'
    ? JSON.parse(JSON.stringify(value))
    : null;
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
