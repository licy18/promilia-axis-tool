import {
  createRuntimeAppliedDeltaFromInvocation,
  createThreeValueRuntimeCalculatorInvocation,
  summarizeThreeValueRuntimeCalculatorInvocations,
} from './threeValueRuntimeCalculatorInvocation';

export const THREE_VALUE_RUNTIME_STATE_SNAPSHOT_CONTRACT_NAME =
  'AzPrThreeValueRuntimeStateSnapshot';

const RUNTIME_STATE_METRIC_BY_TRACK_KEY = {
  enemyHpDamage: 'enemyHp',
  enemyToughnessDamage: 'enemyToughness',
  selfEnergyChange: 'selfEnergy',
};

export function createThreeValueRuntimeStateSnapshots({
  scenario = {},
  appliedDeltas = [],
  runtimeCalculatorAdapters = {},
} = {}) {
  const enemyBaseline = createThreeValueRuntimeEnemyBaseline(scenario);
  const actorRecords = new Map(
    (scenario?.actors ?? []).map((actor, index) => [
      actor.id,
      { actor, order: index },
    ])
  );
  const enemyHpState = createRuntimeStateAccumulator({
    baseline: enemyBaseline.hp,
    deltaDirection: 'decrease',
  });
  const enemyToughnessState = createRuntimeStateAccumulator({
    baseline: enemyBaseline.toughness,
    deltaDirection: 'decrease',
  });
  const selfEnergyStateByActor = new Map();

  for (const { actor, order } of actorRecords.values()) {
    selfEnergyStateByActor.set(
      actor.id,
      createRuntimeSelfEnergyActorState({ actor, order, scenario })
    );
  }

  const runtimeDeltas = [];
  const calculatorInvocations = [];
  const snapshots = appliedDeltas.map((delta, index) => {
    const energyOwnerActorId = resolveRuntimeEnergyOwnerActorId(delta);
    const energyActorState = ensureRuntimeSelfEnergyActorState({
      delta,
      energyOwnerActorId,
      actorRecords,
      selfEnergyStateByActor,
      scenario,
    });
    const primaryMetricKey =
      RUNTIME_STATE_METRIC_BY_TRACK_KEY[delta.trackKey] ?? 'unknown';
    const before = createRuntimeStateSnapshotValues({
      enemyHpState,
      enemyToughnessState,
      energyActorState,
    });
    const runtimeCalculatorInvocation =
      createThreeValueRuntimeCalculatorInvocation({
        delta,
        stateBefore: before,
        runtimeCalculatorAdapters,
      });
    const runtimeDelta = createRuntimeAppliedDeltaFromInvocation(
      delta,
      runtimeCalculatorInvocation
    );
    runtimeDeltas.push(runtimeDelta);
    calculatorInvocations.push(runtimeCalculatorInvocation);
    const deltaValues = createRuntimeStateSnapshotDeltaValues(runtimeDelta);

    applyRuntimeStateDelta(enemyHpState, deltaValues.enemyHp);
    applyRuntimeStateDelta(enemyToughnessState, deltaValues.enemyToughness);
    if (energyActorState) {
      applyRuntimeStateDelta(energyActorState.state, deltaValues.selfEnergy);
    }

    const after = createRuntimeStateSnapshotValues({
      enemyHpState,
      enemyToughnessState,
      energyActorState,
    });
    const primaryState = before[primaryMetricKey] ?? null;
    const baselineConfirmed = primaryState?.baselineConfirmed === true;

    return {
      schemaVersion: 1,
      sourceKind: 'azpr-three-value-runtime-state-snapshot',
      contractName: THREE_VALUE_RUNTIME_STATE_SNAPSHOT_CONTRACT_NAME,
      status: baselineConfirmed
        ? 'runtime-state-snapshot-ready'
        : 'runtime-state-snapshot-pending-baseline',
      sourceDeltaId: delta.id ?? delta.sourceDeltaId ?? null,
      runtimeSequenceIndex: delta.runtimeSequenceIndex ?? index,
      actionId: delta.actionId ?? null,
      hitKey: delta.hitKey ?? null,
      frameIndex: strictRuntimeNumberOrNull(delta.frameIndex),
      timeMs: strictRuntimeNumberOrNull(delta.timeMs),
      trackKey: delta.trackKey ?? null,
      primaryMetricKey,
      changedMetricKeys: [primaryMetricKey].filter(
        metricKey => metricKey !== 'unknown'
      ),
      energyOwnerActorId,
      targetEnemyId:
        delta.mechanismContext?.ownership?.targetEnemyId ??
        scenario?.enemy?.id ??
        null,
      mechanismContextStatus:
        delta.mechanismContextStatus ?? delta.mechanismContext?.status ?? null,
      runtimeCalculatorInvocation,
      runtimeCalculatorAdapterKey: runtimeCalculatorInvocation.adapter.key,
      runtimeCalculationChanged: runtimeCalculatorInvocation.changed,
      baselineConfirmed,
      before,
      delta: deltaValues,
      after,
      applied: true,
    };
  });

  const selfEnergyByActor = [...selfEnergyStateByActor.values()]
    .sort((left, right) => left.order - right.order)
    .map(actorState => ({
      actorId: actorState.actorId,
      actorName: actorState.actorName,
      resource: 'sp',
      baseline: actorState.baseline,
      finalState: createRuntimeStateSnapshotValue(actorState.state, {
        actorId: actorState.actorId,
      }),
    }));
  const finalEnemyHp = createRuntimeStateSnapshotValue(enemyHpState);
  const finalEnemyToughness =
    createRuntimeStateSnapshotValue(enemyToughnessState);
  const readySnapshotCount = snapshots.filter(
    snapshot => snapshot.baselineConfirmed
  ).length;
  const calculatorInvocationSummary =
    summarizeThreeValueRuntimeCalculatorInvocations(calculatorInvocations);

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-three-value-runtime-state-snapshots',
    contractName: THREE_VALUE_RUNTIME_STATE_SNAPSHOT_CONTRACT_NAME,
    status:
      snapshots.length > 0
        ? 'runtime-state-snapshots-ready'
        : 'runtime-state-snapshots-ready-no-applied-deltas',
    baseline: {
      enemy: enemyBaseline,
      selfEnergyByActor,
    },
    snapshots,
    runtimeDeltas,
    calculatorInvocations,
    calculatorInvocationSummary,
    summary: {
      snapshotCount: snapshots.length,
      readySnapshotCount,
      pendingBaselineSnapshotCount: snapshots.length - readySnapshotCount,
      enemyHpInitial: finalEnemyHp.initialValue,
      enemyHpFinal: finalEnemyHp.currentValue,
      enemyToughnessInitial: finalEnemyToughness.initialValue,
      enemyToughnessFinal: finalEnemyToughness.currentValue,
      selfEnergyActorCount: selfEnergyByActor.length,
      selfEnergyBaselineReadyActorCount: selfEnergyByActor.filter(
        actor => actor.finalState.baselineConfirmed
      ).length,
      selfEnergyFinalByActor: selfEnergyByActor.map(actor => ({
        actorId: actor.actorId,
        actorName: actor.actorName,
        initialValue: actor.finalState.initialValue,
        delta: actor.finalState.cumulativeDelta,
        currentValue: actor.finalState.currentValue,
        baselineStatus: actor.finalState.baselineStatus,
      })),
      runtimeCalculatorInvocationCount:
        calculatorInvocationSummary.invocationCount,
      runtimeCalculatorPassthroughInvocationCount:
        calculatorInvocationSummary.passthroughInvocationCount,
      runtimeCalculatorReplacedInvocationCount:
        calculatorInvocationSummary.replacedInvocationCount,
      runtimeCalculatorFallbackInvocationCount:
        calculatorInvocationSummary.fallbackInvocationCount,
      runtimeCalculatorCustomAdapterInvocationCount:
        calculatorInvocationSummary.customAdapterInvocationCount,
      runtimeCalculatorAdapterKeys: calculatorInvocationSummary.adapterKeys,
      runtimeCalculatorInvocationStatuses: calculatorInvocationSummary.statuses,
      runtimeMechanismConfigurationReadyInvocationCount:
        calculatorInvocationSummary.mechanismConfigurationReadyInvocationCount,
      runtimeMechanismConfigurationMissingInvocationCount:
        calculatorInvocationSummary.mechanismConfigurationMissingInvocationCount,
      runtimeMechanismConfigurationStatuses:
        calculatorInvocationSummary.mechanismConfigurationStatuses,
      runtimeConfigurationInstanceIds:
        calculatorInvocationSummary.configurationInstanceIds,
      applied: true,
    },
    applied: true,
  };
}

export function createThreeValueRuntimeEnemyBaseline(scenario) {
  const enemy = scenario?.enemy ?? {};
  const inheritedEnemyCandidate = scenario?.initialRuntimeState?.enemy ?? null;
  const inheritedEnemy =
    !inheritedEnemyCandidate?.enemyId ||
    inheritedEnemyCandidate.enemyId === enemy.id
      ? inheritedEnemyCandidate
      : null;
  const inheritedHp = strictRuntimeNumberOrNull(
    inheritedEnemy?.hp?.currentValue
  );
  const inheritedToughness = strictRuntimeNumberOrNull(
    inheritedEnemy?.toughness?.currentValue
  );
  const baseHp = firstRuntimeNumber(
    enemy.stats?.maxHp,
    enemy.maxHp,
    enemy.baseHp,
    enemy.source?.enemy?.stats?.maxHp,
    enemy.source?.enemy?.maxHp
  );
  const hpMultiplier = firstRuntimeNumber(enemy.hpMultiplier, 1) ?? 1;
  const defaultHpInitial = Number.isFinite(baseHp)
    ? roundRuntimeStateValue(baseHp * hpMultiplier)
    : null;
  const hpInitial = inheritedHp ?? defaultHpInitial;
  const defaultToughnessInitial = firstRuntimeNumber(
    enemy.stats?.initialToughness,
    enemy.toughness?.initialValue,
    enemy.initialToughness
  );
  const toughnessInitial = inheritedToughness ?? defaultToughnessInitial;
  const toughnessMax = firstRuntimeNumber(
    enemy.stats?.maxToughness,
    enemy.toughness?.maxValue,
    enemy.maxToughness
  );
  const toughnessBase = firstRuntimeNumber(
    enemy.toughness?.baseMax,
    enemy.baseAttributes?.find(item => item.key === 'WEAKNESS_POINT_MAX')?.value
  );
  const toughnessMultiplier = firstRuntimeNumber(
    enemy.toughness?.maxMultiplier,
    enemy.toughnessMultiplier,
    1
  );

  return {
    hp: {
      sourceKind:
        inheritedHp == null
          ? 'scenario-enemy-hp-baseline'
          : 'inherited-runtime-enemy-hp-baseline',
      sourceStatus:
        inheritedHp != null
          ? 'baseline-inherited-from-cycle-boundary'
          : hpInitial == null
            ? 'baseline-pending-missing-scenario-enemy-max-hp'
            : 'baseline-derived-from-scenario-enemy-max-hp',
      sourcePath:
        inheritedHp == null
          ? 'scenario.enemy.stats.maxHp * scenario.enemy.hpMultiplier'
          : 'scenario.initialRuntimeState.enemy.hp.currentValue',
      initialValue: hpInitial,
      maxValue:
        inheritedHp == null
          ? null
          : (strictRuntimeNumberOrNull(inheritedEnemy?.hp?.maxValue) ??
            defaultHpInitial),
      baseValue: Number.isFinite(baseHp) ? baseHp : null,
      multiplier: Number.isFinite(hpMultiplier) ? hpMultiplier : null,
      valueUnit: 'hp',
      applied: hpInitial != null,
    },
    toughness: {
      sourceKind:
        inheritedToughness == null
          ? 'scenario-enemy-toughness-baseline'
          : 'inherited-runtime-enemy-toughness-baseline',
      sourceStatus:
        inheritedToughness != null
          ? 'baseline-inherited-from-cycle-boundary'
          : toughnessInitial == null
            ? 'baseline-pending-missing-WEAKNESS_POINT_MAX'
            : 'baseline-derived-from-scenario-enemy-WEAKNESS_POINT_MAX',
      sourcePath:
        inheritedToughness != null
          ? 'scenario.initialRuntimeState.enemy.toughness.currentValue'
          : toughnessInitial == null
            ? 'scenario.enemy.baseAttributes[WEAKNESS_POINT_MAX] missing'
            : 'scenario.enemy.stats.initialToughness',
      initialValue:
        toughnessInitial == null
          ? null
          : roundRuntimeStateValue(toughnessInitial),
      maxValue:
        strictRuntimeNumberOrNull(inheritedEnemy?.toughness?.maxValue) ??
        (toughnessMax == null ? null : roundRuntimeStateValue(toughnessMax)),
      baseValue:
        toughnessBase == null ? null : roundRuntimeStateValue(toughnessBase),
      multiplier:
        toughnessMultiplier == null
          ? null
          : roundRuntimeStateValue(toughnessMultiplier),
      initialRatio: enemy.toughness?.initialRatio ?? null,
      valueUnit: 'toughness',
      applied: toughnessInitial != null,
    },
  };
}

export function createThreeValueRuntimeSelfEnergyBaseline(actor, scenario) {
  const inheritedEnergy = findInheritedSelfEnergyState(actor, scenario);
  const defaultInitialValue = firstRuntimeNumber(
    actor?.initialSp,
    actor?.initialEnergy,
    actor?.resourceState?.sp,
    actor?.resources?.sp,
    actor?.stats?.sp
  );
  const initialValue =
    strictRuntimeNumberOrNull(inheritedEnergy?.currentValue) ??
    defaultInitialValue;
  const defaultMaxValue = firstRuntimeNumber(
    actor?.stats?.maxSp,
    actor?.maxSp,
    actor?.baseAttributes?.find(item => item.key === 'MAXSP')?.value
  );
  const maxValue =
    strictRuntimeNumberOrNull(inheritedEnergy?.maxValue) ?? defaultMaxValue;

  return {
    sourceKind: inheritedEnergy
      ? 'inherited-runtime-actor-self-energy-baseline'
      : 'scenario-actor-self-energy-baseline',
    sourceStatus: inheritedEnergy
      ? 'baseline-inherited-from-cycle-boundary'
      : initialValue == null
        ? 'baseline-pending-azpr-initial-self-energy'
        : 'baseline-derived-from-scenario-actor-self-energy',
    sourcePath: inheritedEnergy
      ? 'scenario.initialRuntimeState.selfEnergyByActor.currentValue'
      : initialValue == null
        ? 'pending battle start/current SP evidence'
        : 'scenario.actor.initialSp|initialEnergy|resourceState.sp',
    initialValue:
      initialValue == null ? null : roundRuntimeStateValue(initialValue),
    maxValue: maxValue == null ? null : roundRuntimeStateValue(maxValue),
    maxValueSourceStatus:
      maxValue == null ? 'max-sp-missing' : 'max-sp-derived-from-actor-stats',
    valueUnit: 'sp',
    applied: initialValue != null,
  };
}

export function createThreeValueRuntimeStateMetric({
  key,
  label,
  valueUnit,
  baseline,
  delta,
  deltaDirection,
  stateLabel,
}) {
  const initialValue = strictRuntimeNumberOrNull(baseline?.initialValue);
  const normalizedDelta = normalizeRuntimeStateNumber(delta) ?? 0;
  const baselineConfirmed = Number.isFinite(initialValue);
  const rawCurrentValue = baselineConfirmed
    ? roundRuntimeStateValue(
        deltaDirection === 'decrease'
          ? initialValue - normalizedDelta
          : initialValue + normalizedDelta
      )
    : null;
  const currentValue =
    rawCurrentValue != null && deltaDirection === 'decrease'
      ? Math.max(0, rawCurrentValue)
      : rawCurrentValue;

  return {
    key,
    label,
    stateLabel,
    valueUnit: baseline?.valueUnit ?? valueUnit,
    initialValue: baselineConfirmed ? initialValue : null,
    maxValue: baseline?.maxValue ?? null,
    delta: normalizedDelta,
    rawCurrentValue,
    currentValue,
    overrunValue:
      rawCurrentValue != null && deltaDirection === 'decrease'
        ? Math.max(0, roundRuntimeStateValue(-rawCurrentValue))
        : 0,
    remainingValue: deltaDirection === 'decrease' ? currentValue : null,
    deltaDirection,
    baselineConfirmed,
    baselineStatus:
      baseline?.sourceStatus ??
      (baselineConfirmed ? 'baseline-confirmed' : 'baseline-pending'),
    stateStatus: baselineConfirmed
      ? 'state-derived-from-baseline-and-applied-delta'
      : 'state-baseline-pending',
    sourceKind: baseline?.sourceKind ?? null,
    sourcePath: baseline?.sourcePath ?? null,
    baseValue: baseline?.baseValue ?? null,
    multiplier: baseline?.multiplier ?? null,
    applied: baselineConfirmed,
  };
}

function createRuntimeSelfEnergyActorState({ actor, order, scenario }) {
  const baseline = createThreeValueRuntimeSelfEnergyBaseline(actor, scenario);
  return {
    actorId: actor?.id ?? null,
    actorName: actor?.name ?? '未知角色',
    order,
    baseline,
    state: createRuntimeStateAccumulator({
      baseline,
      deltaDirection: 'increase',
    }),
  };
}

function ensureRuntimeSelfEnergyActorState({
  delta,
  energyOwnerActorId,
  actorRecords,
  selfEnergyStateByActor,
  scenario,
}) {
  if (!energyOwnerActorId) {
    return null;
  }
  if (selfEnergyStateByActor.has(energyOwnerActorId)) {
    return selfEnergyStateByActor.get(energyOwnerActorId);
  }

  const actor =
    actorRecords.get(energyOwnerActorId)?.actor ??
    createRuntimeActorFromMechanismContext(delta, energyOwnerActorId);
  const actorState = createRuntimeSelfEnergyActorState({
    actor,
    order: selfEnergyStateByActor.size,
    scenario,
  });
  selfEnergyStateByActor.set(energyOwnerActorId, actorState);
  return actorState;
}

function findInheritedSelfEnergyState(actor, scenario) {
  const actorId = String(actor?.id ?? '').trim();
  const characterId = Number(actor?.characterId);
  return (
    scenario?.initialRuntimeState?.selfEnergyByActor?.find(state => {
      if (actorId && state.actorId === actorId) {
        return true;
      }
      return (
        Number.isFinite(characterId) &&
        Number(state.characterId) === characterId
      );
    }) ?? null
  );
}

function createRuntimeActorFromMechanismContext(delta, actorId) {
  const sourceActor = delta.mechanismContext?.sourceActor ?? {};
  return {
    id: actorId,
    name: delta.actorName ?? '未知角色',
    initialSp: sourceActor.energy?.initialValue,
    stats: {
      maxSp: sourceActor.energy?.maxValue ?? sourceActor.stats?.maxSp,
    },
  };
}

function resolveRuntimeEnergyOwnerActorId(delta) {
  return (
    delta.mechanismContext?.ownership?.energyOwnerActorId ??
    delta.actorId ??
    null
  );
}

function createRuntimeStateAccumulator({ baseline, deltaDirection }) {
  const initialValue = strictRuntimeNumberOrNull(baseline?.initialValue);
  return {
    initialValue,
    maxValue: strictRuntimeNumberOrNull(baseline?.maxValue),
    rawCurrentValue: initialValue,
    currentValue: initialValue,
    cumulativeDelta: 0,
    overrunValue: 0,
    deltaDirection,
    baselineConfirmed: Number.isFinite(initialValue),
    baselineStatus: baseline?.sourceStatus ?? 'baseline-pending',
  };
}

function createRuntimeStateSnapshotValues({
  enemyHpState,
  enemyToughnessState,
  energyActorState,
}) {
  return {
    enemyHp: createRuntimeStateSnapshotValue(enemyHpState),
    enemyToughness: createRuntimeStateSnapshotValue(enemyToughnessState),
    selfEnergy: energyActorState
      ? createRuntimeStateSnapshotValue(energyActorState.state, {
          actorId: energyActorState.actorId,
        })
      : createMissingRuntimeSelfEnergySnapshotValue(),
  };
}

function createRuntimeStateSnapshotValue(state, { actorId = null } = {}) {
  return {
    actorId,
    initialValue: state.initialValue,
    maxValue: state.maxValue,
    currentValue: state.currentValue,
    rawCurrentValue: state.rawCurrentValue,
    cumulativeDelta: state.cumulativeDelta,
    overrunValue: state.overrunValue,
    baselineConfirmed: state.baselineConfirmed,
    baselineStatus: state.baselineStatus,
  };
}

function createMissingRuntimeSelfEnergySnapshotValue() {
  return {
    actorId: null,
    initialValue: null,
    maxValue: null,
    currentValue: null,
    rawCurrentValue: null,
    cumulativeDelta: 0,
    overrunValue: 0,
    baselineConfirmed: false,
    baselineStatus: 'baseline-pending-missing-energy-owner',
  };
}

function createRuntimeStateSnapshotDeltaValues(delta) {
  return {
    enemyHp: normalizeRuntimeStateNumber(delta.hpDelta) ?? 0,
    enemyToughness: normalizeRuntimeStateNumber(delta.toughnessDelta) ?? 0,
    selfEnergy: normalizeRuntimeStateNumber(delta.energyDelta) ?? 0,
  };
}

function applyRuntimeStateDelta(state, delta) {
  const normalizedDelta = normalizeRuntimeStateNumber(delta) ?? 0;
  state.cumulativeDelta = roundRuntimeStateValue(
    state.cumulativeDelta + normalizedDelta
  );
  if (!state.baselineConfirmed) {
    return;
  }
  const rawCurrentValue = roundRuntimeStateValue(
    state.deltaDirection === 'decrease'
      ? state.currentValue - normalizedDelta
      : state.currentValue + normalizedDelta
  );
  state.rawCurrentValue = rawCurrentValue;
  state.currentValue =
    state.deltaDirection === 'decrease'
      ? Math.max(0, rawCurrentValue)
      : rawCurrentValue;
  state.overrunValue =
    state.deltaDirection === 'decrease'
      ? Math.max(0, roundRuntimeStateValue(-rawCurrentValue))
      : 0;
}

function firstRuntimeNumber(...values) {
  for (const value of values) {
    const number = strictRuntimeNumberOrNull(value);
    if (Number.isFinite(number)) {
      return number;
    }
  }
  return null;
}

function strictRuntimeNumberOrNull(value) {
  if (value == null || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeRuntimeStateNumber(value) {
  const number = strictRuntimeNumberOrNull(value);
  return Number.isFinite(number) ? roundRuntimeStateValue(number) : null;
}

function roundRuntimeStateValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(6)) : 0;
}
