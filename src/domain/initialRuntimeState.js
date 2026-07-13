export const INITIAL_RUNTIME_STATE_SCHEMA_VERSION = 2;
export const INITIAL_RUNTIME_STATE_CONTRACT_NAME = 'AzPrInitialRuntimeState';

export function normalizeInitialRuntimeState(value, defaults = {}) {
  if ((!value || typeof value !== 'object') && !defaults.controlledActor) {
    return null;
  }

  const sourceValue = value && typeof value === 'object' ? value : {};
  const source = normalizeInitialRuntimeSource(sourceValue.source);
  const controlledActor = normalizeInitialControlledActor(
    sourceValue.controlledActor ?? defaults.controlledActor,
    Boolean(source.boundaryId)
  );
  const enemy = normalizeInitialEnemyState(sourceValue.enemy);
  const selfEnergyByActor = normalizeInitialSelfEnergyStates(
    sourceValue.selfEnergyByActor
  );
  const activeEffects = normalizeInitialActiveEffects(
    sourceValue.activeEffects
  );
  if (
    !controlledActor &&
    !enemy &&
    selfEnergyByActor.length === 0 &&
    activeEffects.length === 0
  ) {
    return null;
  }

  return {
    schemaVersion: INITIAL_RUNTIME_STATE_SCHEMA_VERSION,
    sourceKind: 'azpr-initial-runtime-state',
    contractName: INITIAL_RUNTIME_STATE_CONTRACT_NAME,
    status: source.boundaryId
      ? 'initial-runtime-state-inherited'
      : 'initial-runtime-state-ready',
    source,
    controlledActor,
    enemy,
    selfEnergyByActor,
    activeEffects,
    applied: true,
  };
}

export function createInitialControlledActorState(actor) {
  return normalizeInitialControlledActor(actor, false);
}

function normalizeInitialRuntimeSource(value) {
  return {
    sourceScenarioId: optionalText(value?.sourceScenarioId),
    sourceScenarioName: optionalText(value?.sourceScenarioName),
    boundaryId: optionalText(value?.boundaryId),
    boundaryTimeMs: nonNegativeNumberOrNull(value?.boundaryTimeMs),
  };
}

function normalizeInitialControlledActor(value, inherited) {
  const actorId = optionalText(value?.actorId);
  const characterId = numberOrNull(value?.characterId);
  if (!actorId && characterId == null) {
    return null;
  }
  return {
    actorId: actorId ?? `actor-${characterId}`,
    characterId,
    actorName: optionalText(value?.actorName),
    baselineStatus: inherited
      ? 'baseline-inherited-from-cycle-boundary'
      : 'baseline-project-initial-controlled-actor',
  };
}

function normalizeInitialEnemyState(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const hp = normalizeInitialMetric(value.hp, 'hp');
  const toughness = normalizeInitialMetric(value.toughness, 'toughness');
  if (!hp && !toughness) {
    return null;
  }
  return {
    enemyId: optionalText(value.enemyId),
    hp,
    toughness,
  };
}

function normalizeInitialMetric(value, valueUnit) {
  const currentValue = nonNegativeNumberOrNull(value?.currentValue);
  if (currentValue == null) {
    return null;
  }
  return {
    currentValue,
    maxValue: nonNegativeNumberOrNull(value?.maxValue),
    valueUnit,
    baselineStatus: 'baseline-inherited-from-cycle-boundary',
  };
}

function normalizeInitialSelfEnergyStates(values) {
  const usedActorIds = new Set();
  return (Array.isArray(values) ? values : []).flatMap(value => {
    const actorId = optionalText(value?.actorId);
    const currentValue = nonNegativeNumberOrNull(value?.currentValue);
    if (!actorId || currentValue == null || usedActorIds.has(actorId)) {
      return [];
    }
    usedActorIds.add(actorId);
    return [
      {
        actorId,
        characterId: numberOrNull(value?.characterId),
        actorName: optionalText(value?.actorName),
        currentValue,
        maxValue: nonNegativeNumberOrNull(value?.maxValue),
        valueUnit: 'sp',
        baselineStatus: 'baseline-inherited-from-cycle-boundary',
      },
    ];
  });
}

function normalizeInitialActiveEffects(values) {
  const usedInstanceKeys = new Set();
  return (Array.isArray(values) ? values : []).flatMap(value => {
    const instanceKey = optionalText(value?.instanceKey);
    const effectId = optionalText(value?.effectId);
    const targetId = optionalText(value?.targetId);
    const remainingDurationMs = nonNegativeNumberOrNull(
      value?.remainingDurationMs
    );
    if (
      !instanceKey ||
      !effectId ||
      !targetId ||
      usedInstanceKeys.has(instanceKey) ||
      remainingDurationMs === 0
    ) {
      return [];
    }
    usedInstanceKeys.add(instanceKey);
    return [
      {
        schemaVersion: 1,
        sourceKind: 'azpr-inherited-active-effect',
        instanceKey,
        effectId,
        effectName: optionalText(value?.effectName) ?? effectId,
        sourceActionId: optionalText(value?.sourceActionId),
        sourceActorId: optionalText(value?.sourceActorId),
        sourceActorName: optionalText(value?.sourceActorName),
        targetKind: optionalText(value?.targetKind),
        targetId,
        targetName: optionalText(value?.targetName),
        remainingDurationMs,
        stacks: positiveInteger(value?.stacks, 1),
        maxStacks: positiveInteger(value?.maxStacks, 1),
        refreshCount: nonNegativeInteger(value?.refreshCount),
        revision: positiveInteger(value?.revision, 1),
        tags: uniqueTextValues(value?.tags),
        modifiers: cloneObjectRows(value?.modifiers),
        sourceStatus: 'effect-inherited-from-cycle-boundary',
        appliedToCalculators: false,
        active: true,
      },
    ];
  });
}

function cloneObjectRows(values) {
  return (Array.isArray(values) ? values : [])
    .filter(value => value && typeof value === 'object')
    .map(value => ({ ...value }));
}

function uniqueTextValues(values) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : []).map(optionalText).filter(Boolean)
    ),
  ];
}

function optionalText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function numberOrNull(value) {
  if (value == null || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nonNegativeNumberOrNull(value) {
  const number = numberOrNull(value);
  return number == null ? null : roundValue(Math.max(0, number));
}

function positiveInteger(value, fallback) {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function nonNegativeInteger(value) {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function roundValue(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}
