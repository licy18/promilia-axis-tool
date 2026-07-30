import { normalizeInitialRuntimeState } from '../../domain/initialRuntimeState';
import { resolveControlledActorAt } from '../runtime/controlledActorTimeline';

export const CYCLE_BOUNDARY_INHERITANCE_PROJECTION_CONTRACT_NAME =
  'AzPrCycleBoundaryInheritanceProjection';

export function projectCycleBoundaryInheritance({
  draft = null,
  scenario = null,
  runtimeOutputs = null,
  boundaryId = '',
  sourceScenarioId = '',
  sourceScenarioName = '',
} = {}) {
  const boundary = (scenario?.cycleBoundaries ?? []).find(
    item => item.id === boundaryId
  );
  if (!draft || !boundary) {
    return createProjectionResult({
      status: 'cycle-boundary-inheritance-boundary-not-found',
    });
  }

  const boundaryTimeMs = nonNegativeNumber(boundary.timeMs);
  const retainedActions = (draft.actionDrafts ?? []).filter(
    action => nonNegativeNumber(action.startMs) >= boundaryTimeMs
  );
  if (retainedActions.length === 0) {
    return createProjectionResult({
      status: 'cycle-boundary-inheritance-no-downstream-actions',
      boundary,
    });
  }

  const initialRuntimeState = createInitialRuntimeStateAtBoundary({
    scenario,
    runtimeOutputs,
    boundary,
    sourceScenarioId,
    sourceScenarioName,
  });
  const retainedActionIds = new Set(retainedActions.map(action => action.id));
  const actionDrafts = retainedActions.map(action => ({
    ...cloneValue(action),
    startMs: roundValue(nonNegativeNumber(action.startMs) - boundaryTimeMs),
  }));
  const actionRelations = (draft.actionRelations ?? [])
    .filter(
      relation =>
        retainedActionIds.has(relation.fromActionId) &&
        retainedActionIds.has(relation.toActionId)
    )
    .map(cloneValue);
  const cycleBoundaries = (draft.cycleBoundaries ?? [])
    .filter(item => nonNegativeNumber(item.timeMs) > boundaryTimeMs)
    .map(item => ({
      ...cloneValue(item),
      timeMs: roundValue(nonNegativeNumber(item.timeMs) - boundaryTimeMs),
    }));
  const actorConfigs = inheritActorInitialEnergy(
    draft.actorConfigs,
    initialRuntimeState
  );
  const projectedDraft = {
    ...cloneValue(draft),
    actorConfigs,
    actionDrafts,
    actionRelations,
    cycleBoundaries,
    initialRuntimeState,
    runtimeSampleCaptures: [],
    selectedActionId: actionDrafts[0]?.id ?? '',
  };

  return createProjectionResult({
    status: 'cycle-boundary-inheritance-ready',
    boundary,
    initialRuntimeState,
    draft: projectedDraft,
    summary: {
      retainedActionCount: actionDrafts.length,
      retainedRelationCount: actionRelations.length,
      shiftedBoundaryCount: cycleBoundaries.length,
      inheritedEnergyActorCount:
        initialRuntimeState?.selfEnergyByActor?.length ?? 0,
      inheritedKiboEnergyCount:
        initialRuntimeState?.kiboEnergyBySlot?.length ?? 0,
      inheritedActorVitalCount:
        initialRuntimeState?.actorVitalsByActor?.length ?? 0,
      inheritedKiboVitalCount:
        initialRuntimeState?.kiboVitalsBySlot?.length ?? 0,
      inheritedControlledActorId:
        initialRuntimeState?.controlledActor?.actorId ?? null,
      inheritedEffectCount: initialRuntimeState?.activeEffects?.length ?? 0,
      inheritedTuningMarkLayerCount: (
        initialRuntimeState?.tuningMarks ?? []
      ).reduce((sum, mark) => sum + mark.layers.length, 0),
      inheritedSpecialResourceCount:
        initialRuntimeState?.specialResourcesByActor?.length ?? 0,
      clearedRuntimeSampleCaptureCount:
        draft.runtimeSampleCaptures?.length ?? 0,
    },
  });
}

export function createInitialRuntimeStateAtBoundary({
  scenario = null,
  runtimeOutputs = null,
  boundary = null,
  sourceScenarioId = '',
  sourceScenarioName = '',
} = {}) {
  const boundaryTimeMs = nonNegativeNumber(boundary?.timeMs);
  const stateSnapshots = runtimeOutputs?.stateSnapshots ?? {};
  const controlledActor = resolveControlledActorAt(
    runtimeOutputs?.controlledActorTimeline,
    boundaryTimeMs,
    { strictlyBefore: true }
  );
  const enemyBaseline = stateSnapshots.baseline?.enemy ?? {};
  const enemyState = {
    hp: createInitialMetricFromBaseline(enemyBaseline.hp),
    toughness: createInitialMetricFromBaseline(enemyBaseline.toughness),
  };
  const energyStateByActor = new Map(
    (scenario?.actors ?? []).map(actor => {
      const baselineRow = stateSnapshots.baseline?.selfEnergyByActor?.find(
        row => row.actorId === actor.id
      );
      return [
        actor.id,
        {
          actorId: actor.id,
          characterId: actor.characterId ?? null,
          actorName: actor.name ?? null,
          currentValue: finiteNumberOrNull(baselineRow?.baseline?.initialValue),
          maxValue: finiteNumberOrNull(baselineRow?.baseline?.maxValue),
        },
      ];
    })
  );
  const kiboEnergyBySlot = createKiboEnergyStateAtBoundary({
    curves: runtimeOutputs?.resourceCurves?.curvesByKibo,
    boundaryTimeMs,
  });
  const { actorVitalsByActor, kiboVitalsBySlot } =
    createFriendlyVitalStatesAtBoundary({
      scenario,
      verifiedCombatRuntime: runtimeOutputs?.verifiedCombatRuntime,
      boundaryTimeMs,
    });

  for (const snapshot of sortRuntimeSnapshots(stateSnapshots.snapshots)) {
    if (!isBeforeBoundary(snapshot.timeMs, boundaryTimeMs)) {
      continue;
    }
    updateInitialMetric(enemyState.hp, snapshot.after?.enemyHp);
    updateInitialMetric(enemyState.toughness, snapshot.after?.enemyToughness);
    const actorId = snapshot.energyOwnerActorId;
    if (actorId && energyStateByActor.has(actorId)) {
      updateInitialMetric(
        energyStateByActor.get(actorId),
        snapshot.after?.selfEnergy
      );
    }
  }
  const verifiedEnemyState = createVerifiedEnemyStateAtBoundary({
    verifiedCombatRuntime: runtimeOutputs?.verifiedCombatRuntime,
    boundaryTimeMs,
  });
  if (verifiedEnemyState) {
    enemyState.hp = verifiedEnemyState.hp;
    enemyState.toughness = verifiedEnemyState.toughness;
  }

  return normalizeInitialRuntimeState({
    source: {
      sourceScenarioId,
      sourceScenarioName,
      boundaryId: boundary?.id,
      boundaryTimeMs,
    },
    controlledActor,
    enemy: {
      enemyId: scenario?.enemy?.id ?? null,
      hp: enemyState.hp,
      toughness: enemyState.toughness,
      inBreak: verifiedEnemyState?.inBreak === true,
      breakElapsedMs: verifiedEnemyState?.breakElapsedMs ?? null,
      recoveryDelayRemainingMs:
        verifiedEnemyState?.recoveryDelayRemainingMs ?? null,
      valueShields: verifiedEnemyState?.valueShields ?? [],
      hitCountShields: verifiedEnemyState?.hitCountShields ?? [],
      lastToughnessSourceActionId:
        verifiedEnemyState?.lastToughnessSourceActionId ?? null,
      lastToughnessSourceActorId:
        verifiedEnemyState?.lastToughnessSourceActorId ?? null,
      lastToughnessBindingIdentity:
        verifiedEnemyState?.lastToughnessBindingIdentity ?? null,
      profileSourceIdentity: verifiedEnemyState?.profileSourceIdentity ?? null,
    },
    selfEnergyByActor: [...energyStateByActor.values()],
    kiboEnergyBySlot,
    actorVitalsByActor,
    kiboVitalsBySlot,
    activeEffects: createInheritedActiveEffectsAtBoundary(
      runtimeOutputs?.effectTimeline?.events,
      boundaryTimeMs
    ),
    tuningMarks: createInheritedTuningMarksAtBoundary({
      tuningMarkRuntime:
        runtimeOutputs?.verifiedCombatRuntime?.tuningMarkRuntime,
      boundaryTimeMs,
    }),
    specialResourcesByActor: createInheritedSpecialResourcesAtBoundary({
      specialResourceRuntime:
        runtimeOutputs?.verifiedCombatRuntime?.specialResourceRuntime,
      boundaryTimeMs,
    }),
  });
}

function createFriendlyVitalStatesAtBoundary({
  scenario,
  verifiedCombatRuntime,
  boundaryTimeMs,
}) {
  if (!verifiedCombatRuntime?.ready) {
    return { actorVitalsByActor: [], kiboVitalsBySlot: [] };
  }
  const actorById = new Map(
    (scenario?.actors ?? []).map(actor => [String(actor.id), actor])
  );
  const actorVitals = new Map(
    (verifiedCombatRuntime.initialState?.actorVitals ?? []).map(entry => {
      const actor = actorById.get(String(entry.actorId));
      return [
        String(entry.actorId),
        {
          actorId: String(entry.actorId),
          characterId: actor?.characterId ?? null,
          actorName: actor?.name ?? null,
          currentValue: finiteNumberOrNull(entry.currentHp),
          maxValue: finiteNumberOrNull(entry.maximumHp),
          valueShields: cloneValue(entry.valueShields ?? []),
        },
      ];
    })
  );
  const kiboVitals = new Map(
    (verifiedCombatRuntime.initialState?.kiboVitals ?? []).map(entry => [
      String(entry.slotId),
      {
        slotId: String(entry.slotId),
        actorId: entry.actorId == null ? null : String(entry.actorId),
        characterId: actorById.get(String(entry.actorId))?.characterId ?? null,
        kiboId: Number(entry.kiboId),
        kiboName: null,
        currentValue: finiteNumberOrNull(entry.currentHp),
        maxValue: finiteNumberOrNull(entry.maximumHp),
        valueShields: cloneValue(entry.valueShields ?? []),
      },
    ])
  );
  const vitalEvents = [...(verifiedCombatRuntime.vitalEvents ?? [])].sort(
    (left, right) =>
      nonNegativeNumber(left.timeMs) - nonNegativeNumber(right.timeMs) ||
      nonNegativeNumber(left.runtimeSequenceIndex) -
        nonNegativeNumber(right.runtimeSequenceIndex)
  );
  for (const event of vitalEvents) {
    if (!isBeforeBoundary(event.timeMs, boundaryTimeMs)) break;
    const payload = event.payload ?? {};
    const targetKind = payload.targetKind;
    const target =
      targetKind === 'actor'
        ? actorVitals.get(String(event.targetId))
        : targetKind === 'kibo'
          ? kiboVitals.get(String(payload.targetSlotId))
          : null;
    if (!target) continue;
    target.currentValue =
      finiteNumberOrNull(payload.afterValue ?? payload.after) ??
      target.currentValue;
    target.maxValue =
      finiteNumberOrNull(payload.maxValue ?? payload.maximum) ??
      target.maxValue;
    if (Array.isArray(payload.valueShields)) {
      target.valueShields = cloneValue(payload.valueShields);
    }
  }
  return {
    actorVitalsByActor: [...actorVitals.values()],
    kiboVitalsBySlot: [...kiboVitals.values()],
  };
}

function createInheritedSpecialResourcesAtBoundary({
  specialResourceRuntime,
  boundaryTimeMs,
}) {
  if (!specialResourceRuntime?.ready) return [];
  return (specialResourceRuntime.curves ?? []).map(curve => {
    let currentValue = Number(curve.initialValue) || 0;
    for (const point of [...(curve.points ?? [])].sort(
      (left, right) =>
        nonNegativeNumber(left.timeMs) - nonNegativeNumber(right.timeMs)
    )) {
      if (!isBeforeBoundary(point.timeMs, boundaryTimeMs)) break;
      currentValue = finiteNumberOrNull(point.afterValue) ?? currentValue;
    }
    const activeStates = new Map();
    for (const event of [...(specialResourceRuntime.stateEvents ?? [])].sort(
      (left, right) =>
        nonNegativeNumber(left.timeMs) - nonNegativeNumber(right.timeMs) ||
        nonNegativeNumber(left.runtimeSequenceIndex) -
          nonNegativeNumber(right.runtimeSequenceIndex)
    )) {
      if (event.actorId !== curve.actorId) continue;
      if (!isBeforeBoundary(event.timeMs, boundaryTimeMs)) break;
      const elementId = Number(event.payload?.stateElementId);
      if (!Number.isInteger(elementId)) continue;
      if (event.payload.operation === 'transform') {
        const durationMs = finiteNumberOrNull(event.payload.stateDurationMs);
        activeStates.set(elementId, {
          elementId,
          name: event.payload.stateName ?? null,
          expiresAtMs:
            durationMs == null ? null : Number(event.timeMs) + durationMs,
          sourceActionId: event.actionId ?? null,
          sourceIdentity: cloneValue(event.payload.sourceIdentity),
        });
      } else {
        activeStates.delete(elementId);
      }
    }
    return {
      actorId: curve.actorId,
      characterId: curve.characterId,
      actorName: curve.actorName,
      resourceIdentity: curve.resourceIdentity,
      resourceName: curve.resourceName,
      currentValue,
      maxValue: curve.maxValue,
      activeStates: [...activeStates.values()].flatMap(state => {
        const remainingDurationMs =
          state.expiresAtMs == null
            ? null
            : roundValue(state.expiresAtMs - boundaryTimeMs);
        if (remainingDurationMs != null && remainingDurationMs <= 0) return [];
        return [{ ...state, remainingDurationMs, expiresAtMs: undefined }];
      }),
    };
  });
}

function createInheritedTuningMarksAtBoundary({
  tuningMarkRuntime,
  boundaryTimeMs,
}) {
  const initialByMarkId = new Map(
    (tuningMarkRuntime?.initialState ?? []).map(state => {
      const decayRemainingMs = resolveTuningDecayRemainingMs(state);
      return [
        Number(state.markId),
        {
          ...cloneValue(state),
          layers: resolveTuningLayerSources(state).map((layer, index) => ({
            id: `initial|${state.markId}|${index}`,
            sourceActionId: layer.sourceActionId ?? null,
            sourceActorId: layer.sourceActorId ?? null,
            sourceIdentity: cloneValue(layer.sourceIdentity),
          })),
          decayDueAtMs: decayRemainingMs,
          heldReadyAtMs: nonNegativeNumber(state.heldReadyRemainingMs),
        },
      ];
    })
  );
  const sortedEvents = [...(tuningMarkRuntime?.events ?? [])].sort(
    (left, right) =>
      nonNegativeNumber(left.timeMs) - nonNegativeNumber(right.timeMs) ||
      nonNegativeNumber(left.runtimeSequenceIndex) -
        nonNegativeNumber(right.runtimeSequenceIndex)
  );
  for (const event of sortedEvents) {
    const timeMs = nonNegativeNumber(event.timeMs);
    const boundaryDecay = timeMs === boundaryTimeMs && event.kind === 'expire';
    if (
      timeMs > boundaryTimeMs ||
      (timeMs === boundaryTimeMs && !boundaryDecay)
    ) {
      continue;
    }
    const state = initialByMarkId.get(Number(event.markId));
    if (!state) continue;
    if (event.kind === 'held-trigger') {
      state.heldReadyAtMs = Number(event.heldReadyAtMs) || 0;
    } else if (event.kind === 'acquire') {
      for (const [index, layerId] of (event.layerIds ?? []).entries()) {
        state.layers.push({
          id: layerId,
          sourceActionId: event.actionId ?? null,
          sourceActorId: event.actorId ?? null,
          sourceIdentity: cloneValue(event.sourceIdentity),
          order: index,
        });
      }
      state.decayDueAtMs =
        finiteNumberOrNull(event.decayDueAtMs) ?? timeMs + 20_000;
    } else if (event.kind === 'consume' || event.kind === 'expire') {
      const removedIds = new Set(event.layerIds ?? []);
      state.layers = state.layers.filter(layer => !removedIds.has(layer.id));
      state.decayDueAtMs =
        state.layers.length === 0
          ? null
          : (finiteNumberOrNull(event.decayDueAtMs) ??
            (event.kind === 'expire' ? timeMs + 20_000 : state.decayDueAtMs));
    }
  }
  return [...initialByMarkId.values()].flatMap(state => {
    if (state.layers.length === 0 || state.decayDueAtMs == null) return [];
    const decayRemainingMs = roundValue(
      Number(state.decayDueAtMs) - boundaryTimeMs
    );
    if (decayRemainingMs <= 0) return [];
    return [
      {
        markId: state.markId,
        profileKey: state.profileKey,
        elementName: state.elementName,
        decayRemainingMs,
        layers: state.layers.map(layer => ({
          sourceActionId: layer.sourceActionId,
          sourceActorId: layer.sourceActorId,
          sourceIdentity: layer.sourceIdentity,
        })),
        heldReadyRemainingMs: Math.max(
          0,
          Number(state.heldReadyAtMs) - boundaryTimeMs
        ),
      },
    ];
  });
}

function resolveTuningDecayRemainingMs(state) {
  const explicitRemainingMs = finiteNumberOrNull(state?.decayRemainingMs);
  if (explicitRemainingMs != null) {
    return explicitRemainingMs > 0 ? explicitRemainingMs : null;
  }
  const legacyRemainingValues = (state?.layers ?? [])
    .map(layer => finiteNumberOrNull(layer?.remainingDurationMs))
    .filter(value => value != null && value > 0);
  return legacyRemainingValues.length > 0
    ? Math.max(...legacyRemainingValues)
    : null;
}

function resolveTuningLayerSources(state) {
  const layers = Array.isArray(state?.layers) ? state.layers : [];
  const hasSharedDecay = finiteNumberOrNull(state?.decayRemainingMs) > 0;
  return layers.filter(
    layer =>
      layer &&
      typeof layer === 'object' &&
      (hasSharedDecay || nonNegativeNumber(layer.remainingDurationMs) > 0)
  );
}

function createVerifiedEnemyStateAtBoundary({
  verifiedCombatRuntime,
  boundaryTimeMs,
}) {
  const initial = verifiedCombatRuntime?.initialState?.enemy;
  if (!verifiedCombatRuntime?.ready || !initial) return null;

  let state = {
    hp: finiteNumberOrNull(initial.hp),
    maxHp: finiteNumberOrNull(initial.maxHp),
    toughness: finiteNumberOrNull(initial.toughness),
    maxToughness: finiteNumberOrNull(initial.maxToughness),
    inBreak: initial.inBreak === true,
    breakStartedAtMs: initial.inBreak
      ? -nonNegativeNumber(initial.breakElapsedMs)
      : null,
    normalRecoveryEligibleAtMs:
      !initial.inBreak && initial.recoveryDelayRemainingMs != null
        ? nonNegativeNumber(initial.recoveryDelayRemainingMs)
        : null,
    valueShields: cloneValue(initial.valueShields ?? []),
    hitCountShields: cloneValue(initial.hitCountShields ?? []),
    lastToughnessSourceActionId: initial.lastToughnessSourceActionId ?? null,
    lastToughnessSourceActorId: initial.lastToughnessSourceActorId ?? null,
    lastToughnessBindingIdentity: initial.lastToughnessBindingIdentity ?? null,
    profileSourceIdentity: initial.profileSourceIdentity ?? null,
  };
  const events = [...(verifiedCombatRuntime.damageEvents ?? [])].sort(
    (left, right) =>
      nonNegativeNumber(left.timeMs) - nonNegativeNumber(right.timeMs) ||
      String(left.hitKey ?? '').localeCompare(String(right.hitKey ?? ''))
  );
  for (const event of events) {
    if (!isBeforeBoundary(event.timeMs, boundaryTimeMs)) break;
    const after = event.payload?.stateTransaction?.after;
    if (!after) continue;
    state = {
      ...state,
      ...cloneValue(after),
      profileSourceIdentity:
        event.payload?.enemyProfileSourceIdentity ??
        state.profileSourceIdentity,
    };
  }
  if (state.hp == null || state.toughness == null) return null;

  return {
    hp: {
      currentValue: state.hp,
      maxValue: state.maxHp ?? initial.maxHp,
    },
    toughness: {
      currentValue: state.toughness,
      maxValue: state.maxToughness ?? initial.maxToughness,
    },
    inBreak: state.inBreak === true,
    breakElapsedMs:
      state.inBreak && state.breakStartedAtMs != null
        ? roundValue(boundaryTimeMs - state.breakStartedAtMs)
        : 0,
    recoveryDelayRemainingMs:
      !state.inBreak && state.normalRecoveryEligibleAtMs != null
        ? roundValue(
            Math.max(0, state.normalRecoveryEligibleAtMs - boundaryTimeMs)
          )
        : null,
    valueShields: cloneValue(state.valueShields ?? []),
    hitCountShields: cloneValue(state.hitCountShields ?? []),
    lastToughnessSourceActionId: state.lastToughnessSourceActionId ?? null,
    lastToughnessSourceActorId: state.lastToughnessSourceActorId ?? null,
    lastToughnessBindingIdentity: state.lastToughnessBindingIdentity ?? null,
    profileSourceIdentity: state.profileSourceIdentity ?? null,
  };
}

function createKiboEnergyStateAtBoundary({ curves, boundaryTimeMs }) {
  return (curves ?? []).flatMap(curve => {
    if (!curve?.slotId || !curve?.kiboId) return [];
    let currentValue = finiteNumberOrNull(curve.baseline?.initialValue) ?? 0;
    const maxValue =
      finiteNumberOrNull(curve.baseline?.maxValue) ??
      finiteNumberOrNull(curve.stateMetric?.maxValue);
    for (const point of [...(curve.points ?? [])].sort(
      (left, right) =>
        nonNegativeNumber(left.timeMs) - nonNegativeNumber(right.timeMs)
    )) {
      if (!isBeforeBoundary(point.timeMs, boundaryTimeMs)) break;
      const pointValue = finiteNumberOrNull(
        point.stateSnapshot?.after?.kiboEnergy?.currentValue
      );
      if (pointValue != null) currentValue = pointValue;
    }
    return [
      {
        slotId: curve.slotId,
        actorId: curve.actorId ?? null,
        characterId: curve.characterId ?? null,
        kiboId: curve.kiboId,
        kiboName: curve.kiboName ?? null,
        currentValue,
        maxValue,
      },
    ];
  });
}

function createInheritedActiveEffectsAtBoundary(events, boundaryTimeMs) {
  const activeByInstanceKey = new Map();
  const sortedEvents = [...(events ?? [])].sort(
    (left, right) =>
      nonNegativeNumber(left.timeMs) - nonNegativeNumber(right.timeMs) ||
      nonNegativeNumber(left.runtimeSequenceIndex) -
        nonNegativeNumber(right.runtimeSequenceIndex)
  );
  for (const event of sortedEvents) {
    const timeMs = nonNegativeNumber(event.timeMs);
    const boundaryRemoval =
      timeMs === boundaryTimeMs &&
      ['EFFECT_REMOVED', 'EFFECT_EXPIRED'].includes(event.type);
    if (
      timeMs > boundaryTimeMs ||
      (timeMs === boundaryTimeMs && !boundaryRemoval)
    ) {
      continue;
    }
    if (event.after?.active) {
      if (event.type === 'EFFECT_TRANSFERRED') {
        activeByInstanceKey.delete(
          event.previousInstanceKey ?? event.before?.instanceKey
        );
      }
      activeByInstanceKey.set(event.instanceKey, cloneValue(event.after));
    } else {
      activeByInstanceKey.delete(event.instanceKey);
    }
  }

  return [...activeByInstanceKey.values()].flatMap(effect => {
    const expiresAtMs = finiteNumberOrNull(effect.expiresAtMs);
    const remainingDurationMs =
      expiresAtMs == null ? null : roundValue(expiresAtMs - boundaryTimeMs);
    if (remainingDurationMs != null && remainingDurationMs <= 0) {
      return [];
    }
    return [
      {
        ...effect,
        remainingDurationMs,
      },
    ];
  });
}

function inheritActorInitialEnergy(actorConfigs, initialRuntimeState) {
  const energyByCharacterId = new Map(
    (initialRuntimeState?.selfEnergyByActor ?? [])
      .filter(state => state.characterId != null)
      .map(state => [Number(state.characterId), state.currentValue])
  );
  return (actorConfigs ?? []).map(config => {
    const inheritedValue = energyByCharacterId.get(Number(config.characterId));
    return inheritedValue == null
      ? cloneValue(config)
      : { ...cloneValue(config), initialSp: inheritedValue };
  });
}

function createInitialMetricFromBaseline(baseline) {
  return {
    currentValue: finiteNumberOrNull(baseline?.initialValue),
    maxValue:
      finiteNumberOrNull(baseline?.maxValue) ??
      finiteNumberOrNull(baseline?.initialValue),
  };
}

function updateInitialMetric(target, source) {
  const currentValue = finiteNumberOrNull(source?.currentValue);
  if (target && currentValue != null) {
    target.currentValue = currentValue;
  }
  const maxValue = finiteNumberOrNull(source?.maxValue);
  if (target && maxValue != null) {
    target.maxValue = maxValue;
  }
}

function sortRuntimeSnapshots(snapshots) {
  return [...(snapshots ?? [])].sort(
    (left, right) =>
      nonNegativeNumber(left.timeMs) - nonNegativeNumber(right.timeMs) ||
      nonNegativeNumber(left.runtimeSequenceIndex) -
        nonNegativeNumber(right.runtimeSequenceIndex)
  );
}

function isBeforeBoundary(timeMs, boundaryTimeMs) {
  const time = finiteNumberOrNull(timeMs);
  return time != null && time < boundaryTimeMs;
}

function createProjectionResult({
  status,
  boundary = null,
  initialRuntimeState = null,
  draft = null,
  summary = {},
}) {
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-cycle-boundary-inheritance-projection',
    contractName: CYCLE_BOUNDARY_INHERITANCE_PROJECTION_CONTRACT_NAME,
    status,
    boundary: boundary ? cloneValue(boundary) : null,
    initialRuntimeState,
    draft,
    summary: {
      retainedActionCount: 0,
      retainedRelationCount: 0,
      shiftedBoundaryCount: 0,
      inheritedEnergyActorCount: 0,
      inheritedEffectCount: 0,
      inheritedTuningMarkLayerCount: 0,
      inheritedSpecialResourceCount: 0,
      clearedRuntimeSampleCaptureCount: 0,
      ...summary,
    },
    applied: Boolean(draft),
  };
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function finiteNumberOrNull(value) {
  if (value == null || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? roundValue(number) : null;
}

function nonNegativeNumber(value) {
  return Math.max(0, finiteNumberOrNull(value) ?? 0);
}

function roundValue(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}
