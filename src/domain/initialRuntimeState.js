export const INITIAL_RUNTIME_STATE_SCHEMA_VERSION = 7;
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
  const kiboEnergyBySlot = normalizeInitialKiboEnergyStates(
    sourceValue.kiboEnergyBySlot
  );
  const actorVitalsByActor = normalizeInitialActorVitalStates(
    sourceValue.actorVitalsByActor
  );
  const kiboVitalsBySlot = normalizeInitialKiboVitalStates(
    sourceValue.kiboVitalsBySlot
  );
  const activeEffects = normalizeInitialActiveEffects(
    sourceValue.activeEffects
  );
  const tuningMarks = normalizeInitialTuningMarks(sourceValue.tuningMarks);
  const specialResourcesByActor = normalizeInitialSpecialResourceStates(
    sourceValue.specialResourcesByActor
  );
  if (
    !controlledActor &&
    !enemy &&
    selfEnergyByActor.length === 0 &&
    kiboEnergyBySlot.length === 0 &&
    actorVitalsByActor.length === 0 &&
    kiboVitalsBySlot.length === 0 &&
    activeEffects.length === 0 &&
    tuningMarks.length === 0 &&
    specialResourcesByActor.length === 0
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
    kiboEnergyBySlot,
    actorVitalsByActor,
    kiboVitalsBySlot,
    activeEffects,
    tuningMarks,
    specialResourcesByActor,
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
  const valueShields = normalizeInitialValueShields(value.valueShields);
  const hitCountShields = normalizeInitialHitCountShields(
    value.hitCountShields
  );
  const inBreak = value.inBreak === true;
  const breakElapsedMs = nonNegativeNumberOrNull(value.breakElapsedMs);
  const recoveryDelayRemainingMs = nonNegativeNumberOrNull(
    value.recoveryDelayRemainingMs
  );
  if (
    !hp &&
    !toughness &&
    !inBreak &&
    breakElapsedMs == null &&
    recoveryDelayRemainingMs == null &&
    valueShields.length === 0 &&
    hitCountShields.length === 0
  ) {
    return null;
  }
  return {
    enemyId: optionalText(value.enemyId),
    hp,
    toughness,
    inBreak,
    breakElapsedMs: inBreak ? (breakElapsedMs ?? 0) : 0,
    recoveryDelayRemainingMs: inBreak ? 0 : recoveryDelayRemainingMs,
    lastToughnessSourceActionId: optionalText(
      value.lastToughnessSourceActionId
    ),
    lastToughnessSourceActorId: optionalText(value.lastToughnessSourceActorId),
    lastToughnessBindingIdentity: optionalText(
      value.lastToughnessBindingIdentity
    ),
    profileSourceIdentity: optionalText(value.profileSourceIdentity),
    valueShields,
    hitCountShields,
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

function normalizeInitialKiboEnergyStates(values) {
  const usedSlotIds = new Set();
  return (Array.isArray(values) ? values : []).flatMap(value => {
    const slotId = optionalText(value?.slotId);
    const kiboId = positiveIntegerOrNull(value?.kiboId);
    const currentValue = nonNegativeNumberOrNull(value?.currentValue);
    if (!slotId || !kiboId || currentValue == null || usedSlotIds.has(slotId)) {
      return [];
    }
    usedSlotIds.add(slotId);
    return [
      {
        slotId,
        actorId: optionalText(value?.actorId),
        characterId: numberOrNull(value?.characterId),
        kiboId,
        kiboName: optionalText(value?.kiboName),
        currentValue,
        maxValue: nonNegativeNumberOrNull(value?.maxValue),
        valueUnit: 'sp',
        baselineStatus: 'baseline-inherited-from-cycle-boundary',
      },
    ];
  });
}

function normalizeInitialActorVitalStates(values) {
  const usedActorIds = new Set();
  return (Array.isArray(values) ? values : []).flatMap(value => {
    const actorId = optionalText(value?.actorId);
    const currentValue = nonNegativeNumberOrNull(
      value?.currentValue ?? value?.currentHp
    );
    if (!actorId || currentValue == null || usedActorIds.has(actorId)) {
      return [];
    }
    usedActorIds.add(actorId);
    const maxValue = positiveNumberOrNull(value?.maxValue ?? value?.maximumHp);
    return [
      {
        actorId,
        characterId: numberOrNull(value?.characterId),
        actorName: optionalText(value?.actorName),
        currentValue:
          maxValue == null ? currentValue : Math.min(currentValue, maxValue),
        maxValue,
        valueUnit: 'hp',
        valueShields: normalizeInitialValueShields(value?.valueShields),
        baselineStatus:
          optionalText(value?.baselineStatus) ??
          'baseline-inherited-from-cycle-boundary',
      },
    ];
  });
}

function normalizeInitialKiboVitalStates(values) {
  const usedSlotIds = new Set();
  return (Array.isArray(values) ? values : []).flatMap(value => {
    const slotId = optionalText(value?.slotId);
    const kiboId = positiveIntegerOrNull(value?.kiboId);
    const currentValue = nonNegativeNumberOrNull(
      value?.currentValue ?? value?.currentHp
    );
    if (!slotId || !kiboId || currentValue == null || usedSlotIds.has(slotId)) {
      return [];
    }
    usedSlotIds.add(slotId);
    const maxValue = positiveNumberOrNull(value?.maxValue ?? value?.maximumHp);
    return [
      {
        slotId,
        actorId: optionalText(value?.actorId),
        characterId: numberOrNull(value?.characterId),
        kiboId,
        kiboName: optionalText(value?.kiboName),
        currentValue:
          maxValue == null ? currentValue : Math.min(currentValue, maxValue),
        maxValue,
        valueUnit: 'hp',
        valueShields: normalizeInitialValueShields(value?.valueShields),
        baselineStatus:
          optionalText(value?.baselineStatus) ??
          'baseline-inherited-from-cycle-boundary',
      },
    ];
  });
}

function normalizeInitialSpecialResourceStates(values) {
  const usedKeys = new Set();
  return (Array.isArray(values) ? values : []).flatMap(value => {
    const actorId = optionalText(value?.actorId);
    const resourceIdentity = optionalText(value?.resourceIdentity);
    const currentValue = nonNegativeNumberOrNull(value?.currentValue);
    const key = `${actorId}|${resourceIdentity}`;
    if (
      !actorId ||
      !resourceIdentity ||
      currentValue == null ||
      usedKeys.has(key)
    ) {
      return [];
    }
    usedKeys.add(key);
    return [
      {
        actorId,
        characterId: numberOrNull(value?.characterId),
        actorName: optionalText(value?.actorName),
        resourceIdentity,
        resourceName: optionalText(value?.resourceName),
        currentValue,
        maxValue: nonNegativeNumberOrNull(value?.maxValue),
        inputStep: positiveNumberOrNull(value?.inputStep),
        scenarioConfigurable: value?.scenarioConfigurable === true,
        activeStates: (Array.isArray(value?.activeStates)
          ? value.activeStates
          : []
        ).flatMap(state => {
          const elementId = positiveIntegerOrNull(state?.elementId);
          const remainingDurationMs = nonNegativeNumberOrNull(
            state?.remainingDurationMs
          );
          if (!elementId || remainingDurationMs === 0) return [];
          return [
            {
              elementId,
              name: optionalText(state?.name),
              remainingDurationMs,
              sourceActionId: optionalText(state?.sourceActionId),
              sourceIdentity: state?.sourceIdentity ?? null,
            },
          ];
        }),
        baselineStatus:
          optionalText(value?.baselineStatus) ??
          'baseline-inherited-from-cycle-boundary',
      },
    ];
  });
}

function normalizeInitialValueShields(values) {
  return (Array.isArray(values) ? values : []).flatMap(value => {
    const source = value && typeof value === 'object' ? value : { value };
    const shieldValue = nonNegativeNumberOrNull(source.value);
    const raw = optionalIntegerText(source.raw);
    if (shieldValue == null && raw == null) return [];
    return [
      {
        ...(raw == null ? {} : { raw }),
        ...(shieldValue == null ? {} : { value: shieldValue }),
        outputTypes: normalizeNumberList(
          source.outputTypes ?? source.damageTypes
        ),
        elementTypes: normalizeNumberList(
          source.elementTypes ?? source.elements
        ),
      },
    ];
  });
}

function normalizeInitialHitCountShields(values) {
  return (Array.isArray(values) ? values : []).flatMap(value => {
    const source =
      value && typeof value === 'object' ? value : { count: value };
    const count = nonNegativeIntegerOrNull(source.count ?? source.value);
    if (count == null) return [];
    return [
      {
        count,
        outputTypes: normalizeNumberList(
          source.outputTypes ?? source.damageTypes
        ),
        elementTypes: normalizeNumberList(
          source.elementTypes ?? source.elements
        ),
      },
    ];
  });
}

function normalizeNumberList(values) {
  return (Array.isArray(values) ? values : [])
    .map(numberOrNull)
    .filter(value => value != null);
}

function optionalIntegerText(value) {
  const text = String(value ?? '').trim();
  return /^-?\d+$/.test(text) ? text : null;
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
        icon: optionalText(value?.icon),
        confidence: optionalText(value?.confidence),
        trackingStatus: optionalText(value?.trackingStatus),
        sourceIdentity: cloneObject(value?.sourceIdentity),
        semanticTargetKind: optionalText(value?.semanticTargetKind),
        inheritOnControlledActorSwitch:
          value?.inheritOnControlledActorSwitch === true,
        inheritType: normalizeEffectInheritType(value?.inheritType),
        inheritanceContainerElementId: numberOrNull(
          value?.inheritanceContainerElementId
        ),
        inheritanceContainerPathId: optionalText(
          value?.inheritanceContainerPathId
        ),
        inheritanceSourceIdentity: optionalText(
          value?.inheritanceSourceIdentity
        ),
        formulaSourceActorId: optionalText(value?.formulaSourceActorId),
        effectAdderActorId: optionalText(value?.effectAdderActorId),
        effectInstanceId: optionalText(value?.effectInstanceId),
        transferCount: nonNegativeInteger(value?.transferCount),
        originSourceStatus: optionalText(
          value?.originSourceStatus ?? value?.sourceStatus
        ),
        remainingDurationMs,
        stacks: positiveInteger(value?.stacks, 1),
        maxStacks: positiveInteger(value?.maxStacks, 1),
        refreshCount: nonNegativeInteger(value?.refreshCount),
        revision: positiveInteger(value?.revision, 1),
        tags: uniqueTextValues(value?.tags),
        modifiers: cloneObjectRows(value?.modifiers),
        sourceStatus: 'effect-inherited-from-cycle-boundary',
        appliedToCalculators: value?.appliedToCalculators === true,
        active: true,
      },
    ];
  });
}

function normalizeEffectInheritType(value) {
  if (value === 1 || value === '1' || value === 'self') return 'self';
  if (value === 2 || value === '2' || value === 'source') return 'source';
  return null;
}

function normalizeInitialTuningMarks(values) {
  const usedMarkIds = new Set();
  return (Array.isArray(values) ? values : []).flatMap(value => {
    const markId = positiveIntegerOrNull(value?.markId);
    if (!markId || usedMarkIds.has(markId)) return [];
    const explicitDecayRemainingMs = nonNegativeNumberOrNull(
      value?.decayRemainingMs
    );
    const normalizedLayers = (Array.isArray(value?.layers) ? value.layers : [])
      .flatMap(layer => {
        if (!layer || typeof layer !== 'object') return [];
        const legacyRemainingDurationMs = nonNegativeNumberOrNull(
          layer.remainingDurationMs
        );
        if (
          explicitDecayRemainingMs == null &&
          (legacyRemainingDurationMs == null || legacyRemainingDurationMs <= 0)
        ) {
          return [];
        }
        return [
          {
            legacyRemainingDurationMs,
            sourceActionId: optionalText(layer.sourceActionId),
            sourceActorId: optionalText(layer.sourceActorId),
            sourceIdentity: cloneObject(layer.sourceIdentity),
          },
        ];
      })
      .slice(0, 5);
    const legacyDecayCandidates = normalizedLayers
      .map(layer => layer.legacyRemainingDurationMs)
      .filter(remainingMs => remainingMs != null && remainingMs > 0);
    const decayRemainingMs =
      explicitDecayRemainingMs ??
      (legacyDecayCandidates.length > 0
        ? Math.max(...legacyDecayCandidates)
        : null);
    if (
      normalizedLayers.length === 0 ||
      decayRemainingMs == null ||
      decayRemainingMs <= 0
    ) {
      return [];
    }
    usedMarkIds.add(markId);
    return [
      {
        markId,
        profileKey: optionalText(value?.profileKey),
        elementName: optionalText(value?.elementName),
        decayRemainingMs,
        layers: normalizedLayers.map(layer => ({
          sourceActionId: layer.sourceActionId,
          sourceActorId: layer.sourceActorId,
          sourceIdentity: layer.sourceIdentity,
        })),
        heldReadyRemainingMs:
          nonNegativeNumberOrNull(value?.heldReadyRemainingMs) ?? 0,
        valueUnit: 'mark-stacks',
        baselineStatus: 'baseline-inherited-from-cycle-boundary',
      },
    ];
  });
}

function cloneObjectRows(values) {
  return (Array.isArray(values) ? values : [])
    .filter(value => value && typeof value === 'object')
    .map(value => ({ ...value }));
}

function cloneObject(value) {
  return value && typeof value === 'object'
    ? JSON.parse(JSON.stringify(value))
    : null;
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

function positiveNumberOrNull(value) {
  const number = numberOrNull(value);
  return number != null && number > 0 ? roundValue(number) : null;
}

function positiveInteger(value, fallback) {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function nonNegativeInteger(value) {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function nonNegativeIntegerOrNull(value) {
  const number = numberOrNull(value);
  return number == null ? null : Math.max(0, Math.trunc(number));
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function roundValue(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}
