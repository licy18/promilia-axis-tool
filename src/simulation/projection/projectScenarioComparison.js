export const WORKBENCH_SCENARIO_COMPARISON_CONTRACT_NAME =
  'AzPrWorkbenchScenarioComparison';

const METRIC_DEFINITIONS = [
  { key: 'enemyHpDelta', label: '敌人 HP 伤害', unit: 'hp' },
  { key: 'enemyToughnessDelta', label: '敌人韧性削减', unit: 'toughness' },
  { key: 'selfEnergyDelta', label: '全队自身能量变化', unit: 'sp' },
  { key: 'durationMs', label: '排轴时长', unit: 'ms' },
  { key: 'effectCoverageMs', label: '效果覆盖', unit: 'ms' },
];

export function projectWorkbenchScenarioComparison({
  current = null,
  baseline = null,
} = {}) {
  const currentAnalysis = analyzeScenarioCandidate(current, 'current');
  const baselineAnalysis = baseline
    ? analyzeScenarioCandidate(baseline, 'baseline')
    : null;

  if (!baselineAnalysis) {
    return {
      schemaVersion: 1,
      sourceKind: 'azpr-workbench-scenario-comparison',
      contractName: WORKBENCH_SCENARIO_COMPARISON_CONTRACT_NAME,
      status: 'scenario-comparison-awaiting-baseline',
      current: currentAnalysis,
      baseline: null,
      metrics: [],
      actors: [],
      actions: [],
      effects: [],
      summary: {
        metricCount: 0,
        actorCount: 0,
        actionCount: 0,
        changedActionCount: 0,
        effectCount: 0,
        changedEffectCount: 0,
        readsRuntimeOutputsOnly: true,
        appliedToCalculators: false,
      },
      appliedToCalculators: false,
    };
  }

  const metrics = METRIC_DEFINITIONS.map(definition =>
    createComparisonMetric(
      definition,
      currentAnalysis.metrics[definition.key],
      baselineAnalysis.metrics[definition.key]
    )
  );
  const actors = compareActors(currentAnalysis.actors, baselineAnalysis.actors);
  const actions = compareActions(
    currentAnalysis.actions,
    baselineAnalysis.actions
  );
  const effects = compareEffects(
    currentAnalysis.effects,
    baselineAnalysis.effects
  );

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-workbench-scenario-comparison',
    contractName: WORKBENCH_SCENARIO_COMPARISON_CONTRACT_NAME,
    status: 'scenario-comparison-ready',
    current: currentAnalysis,
    baseline: baselineAnalysis,
    metrics,
    actors,
    actions,
    effects,
    summary: {
      metricCount: metrics.length,
      actorCount: actors.length,
      actionCount: actions.length,
      changedActionCount: actions.filter(action => action.changed).length,
      effectCount: effects.length,
      changedEffectCount: effects.filter(effect => effect.changed).length,
      readsRuntimeOutputsOnly: true,
      appliedToCalculators: false,
    },
    appliedToCalculators: false,
  };
}

function analyzeScenarioCandidate(candidate, role) {
  const scenario = candidate?.scenario ?? {};
  const runtimeOutputs = candidate?.runtimeOutputs ?? {};
  const effectIntervals = candidate?.effectIntervals?.intervals ?? [];
  const summary = runtimeOutputs.summary ?? {};
  const actions = createActionAnalyses(scenario, runtimeOutputs);
  const effects = createEffectAnalyses(effectIntervals);

  return {
    role,
    label:
      normalizeText(candidate?.label) ??
      (role === 'current' ? '当前方案' : '基准方案'),
    sourceKind: normalizeText(candidate?.sourceKind) ?? role,
    projectId: scenario?.sourceProject?.id ?? null,
    projectName: scenario?.sourceProject?.name ?? null,
    metrics: {
      enemyHpDelta: numberOrZero(summary.enemyHpDelta),
      enemyToughnessDelta: numberOrZero(summary.enemyToughnessDelta),
      selfEnergyDelta: numberOrZero(summary.selfEnergyDelta),
      durationMs: createScenarioDurationMs(scenario.actions),
      effectCoverageMs: roundValue(
        effects.reduce((total, effect) => total + effect.durationMs, 0)
      ),
    },
    actors: createActorAnalyses(scenario, runtimeOutputs),
    actions,
    effects,
    summary: {
      actorCount: scenario?.actors?.length ?? 0,
      actionCount: actions.length,
      hitTransactionCount:
        runtimeOutputs?.hitTransactions?.transactions?.length ?? 0,
      effectIntervalCount: effectIntervals.length,
    },
  };
}

function createActorAnalyses(scenario, runtimeOutputs) {
  const resourceCurveByActor = new Map(
    (runtimeOutputs?.resourceCurves?.curvesByActor ?? []).map(curve => [
      curve.actorId,
      curve,
    ])
  );
  return (scenario?.actors ?? []).map((actor, index) => {
    const resourceCurve = resourceCurveByActor.get(actor.id);
    return {
      key: actor.id ?? `actor-${index}`,
      actorId: actor.id ?? null,
      characterId: actor.characterId ?? null,
      name: actor.name ?? `角色 ${index + 1}`,
      order: index,
      selfEnergyDelta: numberOrZero(resourceCurve?.delta),
      pointCount: resourceCurve?.pointCount ?? 0,
    };
  });
}

function createActionAnalyses(scenario, runtimeOutputs) {
  const transactionTotals = new Map();
  for (const transaction of runtimeOutputs?.hitTransactions?.transactions ??
    []) {
    const actionId = transaction.actionId;
    if (!actionId) {
      continue;
    }
    const totals = transactionTotals.get(actionId) ?? createEmptyDeltaTotals();
    totals.enemyHpDelta += numberOrZero(transaction.delta?.enemyHp);
    totals.enemyToughnessDelta += numberOrZero(
      transaction.delta?.enemyToughness
    );
    totals.selfEnergyDelta += numberOrZero(transaction.delta?.selfEnergy);
    totals.hitCount += 1;
    transactionTotals.set(actionId, totals);
  }

  const effectEventCountByAction = new Map();
  for (const event of runtimeOutputs?.effectTimeline?.events ?? []) {
    if (!event.actionId) {
      continue;
    }
    effectEventCountByAction.set(
      event.actionId,
      (effectEventCountByAction.get(event.actionId) ?? 0) + 1
    );
  }

  return (scenario?.actions ?? []).map((action, index) => {
    const totals = transactionTotals.get(action.id) ?? createEmptyDeltaTotals();
    return {
      key: action.id ?? `action-${index}`,
      actionId: action.id ?? null,
      name: action.name ?? `动作 ${index + 1}`,
      actorId: action.actorId ?? action.actor?.id ?? null,
      actorName: action.actor?.name ?? null,
      order: index,
      startMs: numberOrZero(action.startMs),
      durationMs: numberOrZero(action.durationMs),
      enemyHpDelta: roundValue(totals.enemyHpDelta),
      enemyToughnessDelta: roundValue(totals.enemyToughnessDelta),
      selfEnergyDelta: roundValue(totals.selfEnergyDelta),
      hitCount: totals.hitCount,
      effectEventCount: effectEventCountByAction.get(action.id) ?? 0,
    };
  });
}

function createEffectAnalyses(effectIntervals) {
  const grouped = new Map();
  for (const interval of effectIntervals ?? []) {
    const key = [
      interval.targetKind ?? 'target',
      interval.targetId ?? 'unknown',
      interval.effectId ??
        interval.effectKey ??
        interval.effectName ??
        'effect',
    ].join('|');
    const current = grouped.get(key) ?? {
      key,
      effectId: interval.effectId ?? interval.effectKey ?? null,
      name: interval.effectName ?? interval.effectId ?? '效果',
      targetKind: interval.targetKind ?? null,
      targetId: interval.targetId ?? null,
      targetName: interval.targetName ?? interval.targetId ?? null,
      durationMs: 0,
      intervalCount: 0,
    };
    current.durationMs += numberOrZero(interval.durationMs);
    current.intervalCount += 1;
    grouped.set(key, current);
  }
  return [...grouped.values()].map(effect => ({
    ...effect,
    durationMs: roundValue(effect.durationMs),
  }));
}

function compareActors(currentActors, baselineActors) {
  const rows = alignRows(currentActors, baselineActors, createActorMatchKey);
  return rows.map(({ current, baseline, key }, index) => {
    const currentValue = numberOrZero(current?.selfEnergyDelta);
    const baselineValue = numberOrZero(baseline?.selfEnergyDelta);
    return {
      key,
      order: index,
      currentActorId: current?.actorId ?? null,
      baselineActorId: baseline?.actorId ?? null,
      name: current?.name ?? baseline?.name ?? `角色 ${index + 1}`,
      currentValue,
      baselineValue,
      delta: roundValue(currentValue - baselineValue),
      changed: currentValue !== baselineValue,
    };
  });
}

function compareActions(currentActions, baselineActions) {
  const rows = alignRows(
    currentActions,
    baselineActions,
    action => action.actionId
  );
  return rows.map(({ current, baseline, key }, index) => {
    const metrics = Object.fromEntries(
      [
        'enemyHpDelta',
        'enemyToughnessDelta',
        'selfEnergyDelta',
        'startMs',
        'durationMs',
        'hitCount',
        'effectEventCount',
      ].map(metricKey => [
        metricKey,
        createValueComparison(current?.[metricKey], baseline?.[metricKey]),
      ])
    );
    return {
      key,
      order: index,
      currentActionId: current?.actionId ?? null,
      baselineActionId: baseline?.actionId ?? null,
      currentName: current?.name ?? null,
      baselineName: baseline?.name ?? null,
      actorName: current?.actorName ?? baseline?.actorName ?? null,
      metrics,
      changed:
        !current ||
        !baseline ||
        current.name !== baseline.name ||
        Object.values(metrics).some(metric => metric.changed),
    };
  });
}

function compareEffects(currentEffects, baselineEffects) {
  return alignRows(currentEffects, baselineEffects, effect => effect.key).map(
    ({ current, baseline, key }, index) => {
      const duration = createValueComparison(
        current?.durationMs,
        baseline?.durationMs
      );
      const intervals = createValueComparison(
        current?.intervalCount,
        baseline?.intervalCount
      );
      return {
        key,
        order: index,
        name: current?.name ?? baseline?.name ?? '效果',
        targetName: current?.targetName ?? baseline?.targetName ?? '',
        duration,
        intervals,
        changed: !current || !baseline || duration.changed || intervals.changed,
      };
    }
  );
}

function alignRows(currentRows, baselineRows, getKey) {
  const baselineByKey = new Map(
    baselineRows.map((row, index) => [getKey(row) ?? `baseline-${index}`, row])
  );
  const usedBaselineKeys = new Set();
  const rows = currentRows.map((current, index) => {
    const key = getKey(current) ?? `current-${index}`;
    const baseline = baselineByKey.get(key) ?? null;
    if (baseline) {
      usedBaselineKeys.add(key);
    }
    return { key, current, baseline };
  });
  for (const [key, baseline] of baselineByKey) {
    if (!usedBaselineKeys.has(key)) {
      rows.push({ key, current: null, baseline });
    }
  }
  return rows;
}

function createActorMatchKey(actor) {
  return (
    actor.actorId ??
    (actor.characterId != null ? `character-${actor.characterId}` : actor.key)
  );
}

function createComparisonMetric(definition, currentValue, baselineValue) {
  return {
    ...definition,
    ...createValueComparison(currentValue, baselineValue),
  };
}

function createValueComparison(currentValue, baselineValue) {
  const current = numberOrZero(currentValue);
  const baseline = numberOrZero(baselineValue);
  return {
    current,
    baseline,
    delta: roundValue(current - baseline),
    changed: current !== baseline,
  };
}

function createScenarioDurationMs(actions = []) {
  return roundValue(
    actions.reduce(
      (endMs, action) =>
        Math.max(
          endMs,
          numberOrZero(action.startMs) + numberOrZero(action.durationMs)
        ),
      0
    )
  );
}

function createEmptyDeltaTotals() {
  return {
    enemyHpDelta: 0,
    enemyToughnessDelta: 0,
    selfEnergyDelta: 0,
    hitCount: 0,
  };
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function roundValue(value) {
  return Math.round((numberOrZero(value) + Number.EPSILON) * 1000) / 1000;
}

function normalizeText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}
