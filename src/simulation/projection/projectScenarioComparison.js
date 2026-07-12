import { projectCycleSections } from './projectCycleSections';

export const WORKBENCH_SCENARIO_COMPARISON_CONTRACT_NAME =
  'AzPrWorkbenchScenarioComparison';

const METRIC_DEFINITIONS = [
  { key: 'enemyHpDelta', label: '敌人 HP 伤害', unit: 'hp' },
  { key: 'enemyToughnessDelta', label: '敌人韧性削减', unit: 'toughness' },
  { key: 'selfEnergyDelta', label: '全队自身能量变化', unit: 'sp' },
  { key: 'durationMs', label: '排轴时长', unit: 'ms' },
  { key: 'effectCoverageMs', label: '效果覆盖', unit: 'ms' },
];

const ACTOR_METRIC_KEYS = [
  'enemyHpDelta',
  'enemyToughnessDelta',
  'selfEnergyDelta',
];

export function projectWorkbenchScenarioComparison({
  current = null,
  baseline = null,
  windowId = 'full-axis',
} = {}) {
  const currentProjection = resolveContributionProjection(current);
  const baselineProjection = baseline
    ? resolveContributionProjection(baseline)
    : null;
  const windows = createComparisonWindows(
    currentProjection,
    baselineProjection
  );
  const resolvedWindowId = resolveComparisonWindowId(windows, windowId, {
    requireComparable: Boolean(baselineProjection),
  });
  const currentAnalysis = analyzeScenarioCandidate(
    current,
    currentProjection,
    resolvedWindowId,
    'current'
  );
  const baselineAnalysis = baselineProjection
    ? analyzeScenarioCandidate(
        baseline,
        baselineProjection,
        resolvedWindowId,
        'baseline'
      )
    : null;

  if (!baselineAnalysis) {
    return createComparisonEnvelope({
      status: 'scenario-comparison-awaiting-baseline',
      requestedWindowId: windowId,
      windowId: resolvedWindowId,
      windows,
      current: currentAnalysis,
    });
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

  return createComparisonEnvelope({
    status: 'scenario-comparison-ready',
    requestedWindowId: windowId,
    windowId: resolvedWindowId,
    windows,
    current: currentAnalysis,
    baseline: baselineAnalysis,
    metrics,
    actors,
    actions,
    effects,
  });
}

function createComparisonEnvelope({
  status,
  requestedWindowId,
  windowId,
  windows,
  current,
  baseline = null,
  metrics = [],
  actors = [],
  actions = [],
  effects = [],
}) {
  return {
    schemaVersion: 2,
    sourceKind: 'azpr-workbench-scenario-comparison',
    contractName: WORKBENCH_SCENARIO_COMPARISON_CONTRACT_NAME,
    status,
    requestedWindowId,
    windowId,
    windows,
    current,
    baseline,
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
      comparableWindowCount: windows.filter(window => window.comparable).length,
      readsRuntimeOutputsOnly: true,
      appliedToCalculators: false,
    },
    appliedToCalculators: false,
  };
}

function resolveContributionProjection(candidate) {
  if (Array.isArray(candidate?.contributionProjection?.windows)) {
    return candidate.contributionProjection;
  }
  return projectCycleSections({
    scenario: candidate?.scenario,
    runtimeOutputs: candidate?.runtimeOutputs,
    effectIntervals: candidate?.effectIntervals,
    statePointContexts: candidate?.statePointContexts,
  });
}

function createComparisonWindows(currentProjection, baselineProjection) {
  const currentById = createWindowById(currentProjection);
  const baselineById = createWindowById(baselineProjection);
  const ids = [...currentById.keys()];
  for (const id of baselineById.keys()) {
    if (!currentById.has(id)) {
      ids.push(id);
    }
  }
  return ids.map((id, index) => {
    const current = currentById.get(id) ?? null;
    const baseline = baselineById.get(id) ?? null;
    return {
      windowId: id,
      kind: current?.kind ?? baseline?.kind ?? 'section',
      label: current?.label ?? baseline?.label ?? `窗口 ${index + 1}`,
      currentAvailable: Boolean(current),
      baselineAvailable: Boolean(baseline),
      comparable: Boolean(current && baseline),
      currentRange: createWindowRange(current),
      baselineRange: createWindowRange(baseline),
    };
  });
}

function createWindowById(projection) {
  return new Map(
    (projection?.windows ?? [])
      .map(window => [
        normalizeText(window?.windowId ?? window?.sectionId),
        window,
      ])
      .filter(([id]) => id)
  );
}

function createWindowRange(window) {
  return window
    ? {
        startMs: numberOrZero(window.startMs),
        endMs: numberOrZero(window.endMs),
        durationMs: numberOrZero(window.durationMs),
      }
    : null;
}

function resolveComparisonWindowId(
  windows,
  requestedWindowId,
  { requireComparable = true } = {}
) {
  const isAvailable = window =>
    requireComparable ? window.comparable : window.currentAvailable;
  const requested = windows.find(
    window => window.windowId === requestedWindowId && isAvailable(window)
  );
  return (
    requested?.windowId ??
    windows.find(
      window => window.windowId === 'full-axis' && isAvailable(window)
    )?.windowId ??
    windows.find(isAvailable)?.windowId ??
    'full-axis'
  );
}

function analyzeScenarioCandidate(
  candidate,
  contributionProjection,
  windowId,
  role
) {
  const scenario = candidate?.scenario ?? {};
  const window =
    contributionProjection?.windows?.find(item => item.windowId === windowId) ??
    contributionProjection?.fullAxis ??
    null;
  const actions = window?.actions ?? [];
  const effects = window?.effects ?? [];
  return {
    role,
    label:
      normalizeText(candidate?.label) ??
      (role === 'current' ? '当前方案' : '基准方案'),
    sourceKind: normalizeText(candidate?.sourceKind) ?? role,
    sourceId: normalizeText(candidate?.sourceId),
    projectId: scenario?.sourceProject?.id ?? null,
    projectName: scenario?.sourceProject?.name ?? null,
    window: window
      ? {
          windowId: window.windowId,
          kind: window.kind,
          label: window.label,
          startMs: window.startMs,
          endMs: window.endMs,
          durationMs: window.durationMs,
        }
      : null,
    metrics: {
      enemyHpDelta: numberOrZero(window?.metrics?.enemyHpDelta),
      enemyToughnessDelta: numberOrZero(window?.metrics?.enemyToughnessDelta),
      selfEnergyDelta: numberOrZero(window?.metrics?.selfEnergyDelta),
      durationMs: createWindowActionDurationMs(window),
      effectCoverageMs: numberOrZero(window?.metrics?.effectCoverageMs),
    },
    actors: window?.actors ?? [],
    actions,
    effects,
    summary: {
      actorCount: window?.actors?.length ?? 0,
      actionCount: actions.length,
      hitTransactionCount: window?.summary?.hitTransactionCount ?? 0,
      effectCount: effects.length,
    },
  };
}

function createWindowActionDurationMs(window) {
  const startMs = numberOrZero(window?.startMs);
  const endMs = numberOrZero(window?.endMs);
  return roundValue(
    (window?.actions ?? []).reduce((latestEndMs, action) => {
      const actionEndMs = Math.min(
        endMs,
        numberOrZero(action.startMs) + numberOrZero(action.durationMs)
      );
      return Math.max(latestEndMs, actionEndMs - startMs);
    }, 0)
  );
}

function compareActors(currentActors, baselineActors) {
  return alignRows(currentActors, baselineActors, createActorMatchKey).map(
    ({ current, baseline, key }, index) => {
      const metrics = Object.fromEntries(
        ACTOR_METRIC_KEYS.map(metricKey => [
          metricKey,
          createValueComparison(current?.[metricKey], baseline?.[metricKey]),
        ])
      );
      return {
        key,
        order: index,
        currentActorId: current?.actorId ?? null,
        baselineActorId: baseline?.actorId ?? null,
        name: current?.name ?? baseline?.name ?? `角色 ${index + 1}`,
        metrics,
        changed: Object.values(metrics).some(metric => metric.changed),
      };
    }
  );
}

function compareActions(currentActions, baselineActions) {
  return alignRows(
    currentActions,
    baselineActions,
    action => action.actionId
  ).map(({ current, baseline, key }, index) => {
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
      currentStatePointId: current?.statePointId ?? '',
      baselineStatePointId: baseline?.statePointId ?? '',
      currentFrameIndex: current?.frameIndex ?? null,
      baselineFrameIndex: baseline?.frameIndex ?? null,
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
        current?.coverageMs,
        baseline?.coverageMs
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
