import { normalizeInitialRuntimeState } from '../../domain/initialRuntimeState';

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
    selectedActionId: actionDrafts[0].id,
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
      inheritedEffectCount: initialRuntimeState?.activeEffects?.length ?? 0,
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

  return normalizeInitialRuntimeState({
    source: {
      sourceScenarioId,
      sourceScenarioName,
      boundaryId: boundary?.id,
      boundaryTimeMs,
    },
    enemy: {
      enemyId: scenario?.enemy?.id ?? null,
      hp: enemyState.hp,
      toughness: enemyState.toughness,
    },
    selfEnergyByActor: [...energyStateByActor.values()],
    activeEffects: createInheritedActiveEffectsAtBoundary(
      runtimeOutputs?.effectTimeline?.events,
      boundaryTimeMs
    ),
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
