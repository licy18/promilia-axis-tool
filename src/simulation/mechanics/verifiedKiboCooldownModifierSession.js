import kiboPassiveMechanicsCatalog from '../../data/generated/kibo-passive-mechanics.json';
import { getVerifiedCombatActionInputMapping } from '../../data/verifiedCombatMechanicsPackage';
import { VERIFIED_WORKBENCH_MECHANICS_PROFILE_ID } from '../../domain/workbenchMechanicsProfileSelection';

export const VERIFIED_KIBO_COOLDOWN_MODIFIER_SESSION_CONTRACT_NAME =
  'AzPrVerifiedKiboCooldownModifierSession';

const DEFAULT_PERCENT_DENOMINATOR = 10000;
const DEFAULT_MINIMUM_COOLDOWN_BASIS_POINTS = 2500;

export function createVerifiedKiboCooldownModifierSession({
  scenario = {},
  catalog = kiboPassiveMechanicsCatalog,
} = {}) {
  const enabled =
    scenario?.mechanicsProfile?.profileId ===
    VERIFIED_WORKBENCH_MECHANICS_PROFILE_ID;
  const bindings = collectEquippedKiboBindings(scenario);
  const entries = enabled ? compileCooldownModifierEntries(catalog) : [];
  const stackCountByKey = new Map();
  const acceptedTransitions = [];
  const unresolvedTransitions = [];

  function getApplicableEntries({ action, ownerKind, ownerId }) {
    if (ownerKind !== 'kibo') return [];
    const normalizedKiboId = positiveInteger(ownerId ?? action?.kiboId);
    if (normalizedKiboId == null) return [];
    const binding = bindings.find(
      candidate =>
        candidate.kiboId === normalizedKiboId &&
        String(candidate.actorId) === String(action?.actorId)
    );
    if (!binding) return [];
    return entries
      .filter(entry => entry.kiboIds.includes(normalizedKiboId))
      .map(entry => ({ ...entry, binding }));
  }

  function evaluate({
    action,
    ownerKind,
    ownerId,
    baseCooldown,
    currentEffectiveCooldown = null,
  } = {}) {
    const applicableEntries = getApplicableEntries({
      action,
      ownerKind,
      ownerId,
    });
    const baseDurationMs = positiveNumber(
      baseCooldown?.durationMs ?? baseCooldown?.cooldownMs
    );
    const currentDurationMs = positiveNumber(
      currentEffectiveCooldown?.durationMs ?? currentEffectiveCooldown
    );
    if (applicableEntries.length === 0 || baseDurationMs == null) {
      return {
        status: 'verified-kibo-cooldown-modifier-not-applicable',
        effectiveDurationMs: currentDurationMs ?? baseDurationMs,
        modifiers: [],
        passiveStates: [],
      };
    }

    const passiveStates = applicableEntries.map(entry => {
      const stackKey = createStackKey(entry);
      const stackCount = stackCountByKey.get(stackKey) ?? 0;
      const totalValueRaw = entry.valueRawPerStack * stackCount;
      return {
        stackKey,
        passiveSkillId: entry.passiveSkillId,
        passiveName: entry.passiveName,
        sourceKiboId: entry.binding.kiboId,
        sourceActorId: entry.binding.actorId,
        sourceElementId: entry.sourceElementId,
        sourcePathId: entry.sourcePathId,
        attributeId: entry.attributeId,
        attributeName: entry.attributeName,
        bucket: entry.bucket,
        stackCount,
        maxStacks: entry.maxStacks,
        valueRawPerStack: entry.valueRawPerStack,
        totalValueRaw,
        minimumCooldownBasisPoints: entry.minimumCooldownBasisPoints,
      };
    });
    const totalPercentRaw = passiveStates.reduce(
      (sum, state) => sum + state.totalValueRaw,
      0
    );
    const minimumCooldownBasisPoints = Math.max(
      ...passiveStates.map(state => state.minimumCooldownBasisPoints),
      DEFAULT_MINIMUM_COOLDOWN_BASIS_POINTS
    );
    const inputDurationMs = currentDurationMs ?? baseDurationMs;
    const nativeDeltaMs =
      (baseDurationMs * totalPercentRaw) / DEFAULT_PERCENT_DENOMINATOR;
    const unclampedDurationMs = inputDurationMs + nativeDeltaMs;
    const minimumDurationMs =
      (baseDurationMs * minimumCooldownBasisPoints) /
      DEFAULT_PERCENT_DENOMINATOR;
    const effectiveDurationMs = roundDuration(
      Math.max(unclampedDurationMs, minimumDurationMs)
    );
    const modifiers = passiveStates
      .filter(state => state.stackCount > 0)
      .map(state => ({
        sourceKind: 'verified-kibo-passive-cooldown-property',
        sourceId: `kibo-passive:${state.passiveSkillId}:${state.sourceElementId}`,
        passiveSkillId: state.passiveSkillId,
        passiveName: state.passiveName,
        sourceKiboId: state.sourceKiboId,
        sourceActorId: state.sourceActorId,
        sourceElementId: state.sourceElementId,
        sourcePathId: state.sourcePathId,
        attributeId: state.attributeId,
        attributeName: state.attributeName,
        bucket: state.bucket,
        stackCountUsed: state.stackCount,
        maxStacks: state.maxStacks,
        valueRawPerStack: state.valueRawPerStack,
        totalValueRaw: state.totalValueRaw,
        percentDenominator: DEFAULT_PERCENT_DENOMINATOR,
        nativeDeltaMs: roundDuration(
          (baseDurationMs * state.totalValueRaw) / DEFAULT_PERCENT_DENOMINATOR
        ),
        minimumCooldownBasisPoints: state.minimumCooldownBasisPoints,
        triggerContract: 'accepted-skill-start',
      }));

    return {
      status:
        modifiers.length > 0
          ? 'verified-kibo-cooldown-modifier-applied'
          : 'verified-kibo-cooldown-modifier-ready-zero-stack',
      effectiveDurationMs,
      modifiers,
      passiveStates,
      formula: {
        baseDurationMs,
        inputDurationMs,
        totalPercentRaw,
        nativeDeltaMs: roundDuration(nativeDeltaMs),
        unclampedDurationMs: roundDuration(unclampedDurationMs),
        minimumCooldownBasisPoints,
        minimumDurationMs: roundDuration(minimumDurationMs),
        clamped: unclampedDurationMs < minimumDurationMs,
        effectiveDurationMs,
      },
    };
  }

  function onActionAccepted({
    action,
    ownerKind,
    ownerId,
    actionOrderIndex = null,
    cooldownPolicy = null,
  } = {}) {
    const applicableEntries = getApplicableEntries({
      action,
      ownerKind,
      ownerId,
    });
    if (applicableEntries.length === 0) return [];
    const skillTags = resolveActionSkillTags(action);
    const transitions = applicableEntries.map(entry => {
      const conditionResult = evaluateSkillTagCondition(
        entry.condition,
        skillTags
      );
      const stackKey = createStackKey(entry);
      const stackBefore = stackCountByKey.get(stackKey) ?? 0;
      const stackDelta = conditionResult.matched ? entry.stackDelta : 0;
      const stackAfter = Math.min(entry.maxStacks, stackBefore + stackDelta);
      if (conditionResult.matched) {
        stackCountByKey.set(stackKey, stackAfter);
      }
      const transition = {
        schemaVersion: 1,
        contractName: VERIFIED_KIBO_COOLDOWN_MODIFIER_SESSION_CONTRACT_NAME,
        status: conditionResult.unresolved
          ? 'accepted-skill-start-passive-condition-unresolved'
          : conditionResult.matched
            ? stackAfter > stackBefore
              ? 'accepted-skill-start-passive-stack-added'
              : 'accepted-skill-start-passive-stack-capped'
            : 'accepted-skill-start-passive-condition-not-matched',
        actionId: action?.id ?? null,
        actionName: action?.name ?? action?.id ?? null,
        actionOrderIndex,
        timeMs: nonNegativeNumber(action?.startMs) ?? 0,
        ownerKind,
        ownerId,
        actorId: action?.actorId ?? null,
        kiboId: entry.binding.kiboId,
        passiveSkillId: entry.passiveSkillId,
        passiveName: entry.passiveName,
        sourceElementId: entry.sourceElementId,
        sourcePathId: entry.sourcePathId,
        attributeId: entry.attributeId,
        attributeName: entry.attributeName,
        bucket: entry.bucket,
        stackBefore,
        stackDelta,
        stackAfter,
        maxStacks: entry.maxStacks,
        valueRawPerStack: entry.valueRawPerStack,
        totalValueRawAfter: stackAfter * entry.valueRawPerStack,
        actualSkillTags: skillTags.values,
        skillTagSource: skillTags.source,
        condition: entry.condition,
        reason: conditionResult.reason,
        cooldownPolicy,
        effectiveAfterActionId: action?.id ?? null,
        provenance: entry.provenance,
      };
      if (conditionResult.unresolved) unresolvedTransitions.push(transition);
      return transition;
    });
    acceptedTransitions.push(...transitions);
    return transitions;
  }

  function snapshot() {
    return {
      schemaVersion: 1,
      contractName: VERIFIED_KIBO_COOLDOWN_MODIFIER_SESSION_CONTRACT_NAME,
      status: !enabled
        ? 'verified-kibo-cooldown-session-disabled'
        : unresolvedTransitions.length > 0
          ? 'verified-kibo-cooldown-session-ready-with-unresolved-transitions'
          : 'verified-kibo-cooldown-session-ready',
      acceptedTransitions: acceptedTransitions.map(cloneTransition),
      unresolvedTransitions: unresolvedTransitions.map(cloneTransition),
      stacks: [...stackCountByKey.entries()]
        .map(([stackKey, stackCount]) => ({ stackKey, stackCount }))
        .sort((left, right) => left.stackKey.localeCompare(right.stackKey)),
      summary: {
        compiledDefinitionCount: new Set(
          entries.map(entry => entry.passiveSkillId)
        ).size,
        compiledEffectCount: entries.length,
        acceptedTransitionCount: acceptedTransitions.length,
        appliedTransitionCount: acceptedTransitions.filter(transition =>
          [
            'accepted-skill-start-passive-stack-added',
            'accepted-skill-start-passive-stack-capped',
          ].includes(transition.status)
        ).length,
        unresolvedTransitionCount: unresolvedTransitions.length,
      },
    };
  }

  return {
    contractName: VERIFIED_KIBO_COOLDOWN_MODIFIER_SESSION_CONTRACT_NAME,
    evaluate,
    onActionAccepted,
    snapshot,
  };
}

function compileCooldownModifierEntries(catalog) {
  return (catalog?.definitions ?? []).flatMap(definition =>
    (definition.beforeSkillTriggers ?? []).flatMap(triggerEntry =>
      (triggerEntry.cooldownPropertyEffects ?? []).flatMap(effect => {
        const modifiers = (effect.modifiers ?? []).filter(
          modifier =>
            modifier?.kind === 'battle-property' &&
            Number(modifier.attributeId) === 115 &&
            modifier.bucket === 'dynamicPercent' &&
            Number.isFinite(Number(modifier.valueRaw))
        );
        if (
          triggerEntry.trigger?.acceptanceGate !== 'accepted-skill-start' ||
          effect.runtimeTargetKind !== 'kibo' ||
          modifiers.length === 0
        ) {
          return [];
        }
        return modifiers.map(modifier => ({
          passiveSkillId: Number(definition.skillId),
          passiveName: definition.name ?? null,
          kiboIds: (definition.kiboIds ?? [])
            .map(Number)
            .filter(Number.isInteger),
          condition: triggerEntry.trigger?.condition ?? null,
          sourceElementId:
            Number(effect.sourceElementId ?? modifier.sourceElementId) || null,
          sourcePathId: effect.sourcePathId ?? modifier.sourcePathId ?? null,
          attributeId: Number(modifier.attributeId),
          attributeName: modifier.attributeName ?? 'CD_SKILL',
          bucket: modifier.bucket,
          valueRawPerStack: Number(modifier.valueRaw),
          stackDelta: positiveInteger(effect.stackDelta) ?? 1,
          maxStacks: positiveInteger(effect.maxStacks) ?? 1,
          minimumCooldownBasisPoints:
            positiveInteger(
              definition.nativeEvidenceContract?.minimumCooldown
                ?.kiboMinimumBasisPoints
            ) ?? DEFAULT_MINIMUM_COOLDOWN_BASIS_POINTS,
          provenance: definition.provenance ?? [],
        }));
      })
    )
  );
}

function collectEquippedKiboBindings(scenario) {
  return (scenario?.actors ?? []).flatMap(actor => {
    const kiboId = positiveInteger(actor?.loadout?.kiboId);
    if (kiboId == null || actor?.id == null) return [];
    return [{ actorId: String(actor.id), kiboId }];
  });
}

function resolveActionSkillTags(action) {
  const mapping = getVerifiedCombatActionInputMapping(action);
  const rawSkillTags = mapping?.controlLogic?.skillTag;
  if (rawSkillTags == null || String(rawSkillTags).trim() === '') {
    return {
      values: null,
      source: mapping
        ? 'verified-action-input-mapping.controlLogic.skillTag-missing'
        : 'verified-action-input-mapping-missing',
    };
  }
  const values = uniqueValues(
    String(rawSkillTags)
      .split('|')
      .map(value => Number(value.trim()))
      .filter(Number.isInteger)
  ).sort((left, right) => left - right);
  return values.length > 0
    ? {
        values,
        source: 'verified-action-input-mapping.controlLogic.skillTag',
      }
    : {
        values: null,
        source: 'verified-action-input-mapping.controlLogic.skillTag-invalid',
      };
}

function evaluateSkillTagCondition(condition, skillTags) {
  if (condition?.kind !== 'skill-tag') {
    return {
      matched: false,
      unresolved: true,
      reason: 'kibo-passive-cooldown-trigger-condition-unsupported',
    };
  }
  if (skillTags.values == null) {
    return {
      matched: false,
      unresolved: true,
      reason: 'kibo-passive-cooldown-skill-tag-unresolved',
    };
  }
  const required = (condition.requiredSkillTags ?? [])
    .map(Number)
    .filter(Number.isInteger);
  const matches = value => skillTags.values.includes(value);
  const matched =
    condition.logic === 'and'
      ? required.length > 0 && required.every(matches)
      : condition.logic === 'or'
        ? required.some(matches)
        : false;
  return {
    matched,
    unresolved: !['and', 'or'].includes(condition.logic),
    reason: matched
      ? null
      : ['and', 'or'].includes(condition.logic)
        ? 'kibo-passive-cooldown-skill-tag-condition-not-matched'
        : 'kibo-passive-cooldown-skill-tag-logic-unsupported',
  };
}

function createStackKey(entry) {
  return [
    entry.binding.actorId,
    entry.binding.kiboId,
    entry.passiveSkillId,
    entry.sourceElementId,
  ].join('|');
}

function cloneTransition(transition) {
  return {
    ...transition,
    actualSkillTags: transition.actualSkillTags
      ? [...transition.actualSkillTags]
      : null,
    condition: transition.condition ? { ...transition.condition } : null,
    cooldownPolicy: transition.cooldownPolicy
      ? { ...transition.cooldownPolicy }
      : null,
    provenance: [...(transition.provenance ?? [])],
  };
}

function roundDuration(value) {
  return Number(Number(value).toFixed(6));
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function nonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function uniqueValues(values) {
  return [...new Set(values)];
}
