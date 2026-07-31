import { COMBAT_CRITICAL_POLICIES } from '../domain/combatCriticalPolicy';
import { getInstalledVerifiedCombatMechanicsPackage } from '../data/verifiedCombatMechanicsPackage';

export const MACHINE_AXIS_BATCH_SCHEMA_VERSION = 1;
export const MACHINE_AXIS_BATCH_CONTRACT_NAME = 'AzPrMachineAxisBatch';
export const MACHINE_AXIS_BATCH_KIND = 'azpr-machine-axis-batch-evaluation';
export const DEFAULT_BATCH_JOBS = 4;
export const DEFAULT_BURST_WINDOW_MS = 10_000;
export const BATCH_QUANTILES = [0.05, 0.25, 0.5, 0.75, 0.95];

const SAMPLE_METRIC_KEYS = [
  'hpDamage',
  'dps',
  'toughnessDamage',
  'netToughnessDamage',
  'combatHitCount',
  'burstHpDamage',
  'idleMs',
];

const CRITICAL_POLICIES = new Set(Object.values(COMBAT_CRITICAL_POLICIES));

export function createMachineAxisBatchEvaluator({
  service,
  jobs = DEFAULT_BATCH_JOBS,
} = {}) {
  if (!service || typeof service.simulate !== 'function') {
    throw new Error('Machine Axis batch evaluator requires a simulate service');
  }
  async function evaluate(envelope, options = {}) {
    const startedAt = Date.now();
    const normalization = normalizeBatchEnvelope(envelope);
    if (!normalization.valid) {
      return {
        schemaVersion: MACHINE_AXIS_BATCH_SCHEMA_VERSION,
        contractName: MACHINE_AXIS_BATCH_CONTRACT_NAME,
        kind: MACHINE_AXIS_BATCH_KIND,
        valid: false,
        status: 'invalid',
        issues: normalization.issues,
        summary: {
          runCount: 0,
          okCount: 0,
          failedCount: 0,
          validationFailedCount: 0,
          runtimeFailedCount: 0,
          wallTimeMs: Date.now() - startedAt,
          jobs: normalizeJobs(options.jobs ?? jobs),
          perRunExecutionMs: null,
          aggregate: null,
        },
        runs: [],
      };
    }
    const concurrency = normalizeJobs(
      options.jobs ?? normalization.normalized.options.jobs ?? jobs
    );
    const overrideOptions = pickDefined(options, [
      'criticalPolicy',
      'seeds',
      'burstWindowMs',
    ]);
    const runs = await runWithConcurrency(
      normalization.normalized.runs,
      concurrency,
      (run, index) => executeRun(run, index, overrideOptions, service.simulate)
    );
    const summary = buildBatchSummary(
      runs,
      Date.now() - startedAt,
      concurrency
    );
    const failedCount = runs.filter(run => run.status !== 'ok').length;
    return {
      schemaVersion: MACHINE_AXIS_BATCH_SCHEMA_VERSION,
      contractName: MACHINE_AXIS_BATCH_CONTRACT_NAME,
      kind: MACHINE_AXIS_BATCH_KIND,
      valid: true,
      status:
        failedCount === 0
          ? 'ok'
          : runs.some(run => run.status === 'ok')
            ? 'partial'
            : 'failed',
      issues: [],
      summary,
      runs,
    };
  }
  return Object.freeze({
    schemaVersion: MACHINE_AXIS_BATCH_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_BATCH_CONTRACT_NAME,
    kind: MACHINE_AXIS_BATCH_KIND,
    evaluate,
  });
}

export function normalizeBatchEnvelope(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return invalidBatchEnvelope([
      createBatchIssue(
        '',
        'batch-envelope-object-required',
        'batch envelope must be an object'
      ),
    ]);
  }
  if (value.kind != null && value.kind !== 'azpr-machine-axis-batch') {
    return invalidBatchEnvelope([
      createBatchIssue(
        'kind',
        'batch-kind-unsupported',
        `unsupported batch kind: ${value.kind}`
      ),
    ]);
  }
  if (!Array.isArray(value.runs) || value.runs.length === 0) {
    return invalidBatchEnvelope([
      createBatchIssue(
        'runs',
        'batch-runs-required',
        'batch envelope requires a non-empty runs array'
      ),
    ]);
  }
  const issues = [];
  const runs = [];
  const envelopeOptions = normalizeBatchOptions(
    value.options ?? {},
    '',
    issues
  );
  value.runs.forEach((entry, index) => {
    const path = `runs.${index}`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      issues.push(
        createBatchIssue(
          path,
          'batch-run-contract-required',
          `Run ${index} must contain a machine axis contract`
        )
      );
      return;
    }
    const hasAxis = entry.axis != null;
    const contract = hasAxis ? entry.axis : entry;
    if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
      issues.push(
        createBatchIssue(
          hasAxis ? `${path}.axis` : path,
          'batch-run-contract-required',
          `Run ${index} must contain a machine axis contract`
        )
      );
      return;
    }
    const runOptions = hasAxis
      ? normalizeBatchOptions(
          {
            ...(entry.options ?? {}),
            ...pickDefined(entry, ['criticalPolicy', 'seeds', 'burstWindowMs']),
          },
          `${path}.options`,
          issues
        )
      : {};
    const label =
      hasAxis && typeof entry.label === 'string' && entry.label.trim()
        ? entry.label.trim()
        : `run-${index}`;
    runs.push({ index, label, contract, options: runOptions });
  });
  return {
    valid: issues.length === 0,
    issues,
    normalized: { options: envelopeOptions, runs },
  };
}

function normalizeBatchOptions(value, path, issues) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    issues.push(
      createBatchIssue(
        path,
        'batch-options-object-required',
        'batch options must be an object'
      )
    );
    return {};
  }
  const options = {};
  if (value.criticalPolicy != null) {
    const policy = String(value.criticalPolicy);
    if (!CRITICAL_POLICIES.has(policy)) {
      issues.push(
        createBatchIssue(
          `${path}.criticalPolicy`,
          'batch-critical-policy-unsupported',
          `unsupported critical policy: ${policy}`
        )
      );
    } else {
      options.criticalPolicy = policy;
    }
  }
  if (value.seeds != null) {
    const seeds = normalizeSeeds(value.seeds);
    if (seeds == null) {
      issues.push(
        createBatchIssue(
          `${path}.seeds`,
          'batch-seeds-invalid',
          'seeds must be a non-empty array of strings or numbers'
        )
      );
    } else {
      options.seeds = seeds;
    }
  }
  if (value.burstWindowMs != null) {
    const windowMs = positiveNumber(value.burstWindowMs);
    if (windowMs == null) {
      issues.push(
        createBatchIssue(
          `${path}.burstWindowMs`,
          'batch-burst-window-invalid',
          'burstWindowMs must be a positive finite number'
        )
      );
    } else {
      options.burstWindowMs = windowMs;
    }
  }
  return options;
}

function invalidBatchEnvelope(issues) {
  return {
    valid: false,
    issues,
    normalized: { options: {}, runs: [] },
  };
}

function createBatchIssue(path, code, message) {
  return { path, code, message };
}

function normalizeSeeds(value) {
  if (!Array.isArray(value) || value.length === 0) return null;
  const seeds = [];
  for (const entry of value) {
    if (
      (typeof entry !== 'string' && typeof entry !== 'number') ||
      (typeof entry === 'string' && String(entry).trim() === '')
    ) {
      return null;
    }
    seeds.push(String(entry));
  }
  return seeds;
}

async function executeRun(run, index, overrideOptions, simulate) {
  const startedAt = Date.now();
  const effective = {
    ...run.options,
    ...pickDefined(overrideOptions, [
      'criticalPolicy',
      'seeds',
      'burstWindowMs',
    ]),
  };
  const label = run.label;
  if (
    effective.criticalPolicy === COMBAT_CRITICAL_POLICIES.SAMPLED &&
    !effective.seeds?.length
  ) {
    return {
      index,
      label,
      mode: 'single',
      status: 'validation-failed',
      scenario: null,
      critical: { policy: COMBAT_CRITICAL_POLICIES.SAMPLED, seed: null },
      hashes: null,
      metrics: null,
      contributions: null,
      executionMs: Date.now() - startedAt,
      errors: [
        createBatchIssue(
          `runs.${index}.seeds`,
          'batch-sampled-seeds-required',
          'sampled critical policy requires an explicit seeds set'
        ),
      ],
    };
  }
  const seeds = effective.seeds ?? [];
  if (seeds.length > 0) {
    const samples = [];
    for (const seed of seeds) {
      const contract = applyCriticalOverride(run.contract, {
        policy: COMBAT_CRITICAL_POLICIES.SAMPLED,
        seed,
      });
      samples.push(
        await executeSingleSample(contract, effective, { seed }, simulate)
      );
    }
    const okSamples = samples.filter(sample => sample.status === 'ok');
    const validationFailed = samples.some(
      sample => sample.status === 'validation-failed'
    );
    return {
      index,
      label,
      mode: 'sampled',
      status:
        okSamples.length === samples.length
          ? 'ok'
          : validationFailed
            ? 'validation-failed'
            : 'runtime-failed',
      scenario: okSamples.find(sample => sample.scenario)?.scenario ?? null,
      seeds,
      samples: samples.map(sample => ({
        seed: sample.seed,
        status: sample.status,
        critical: sample.critical,
        hashes: sample.hashes,
        metrics: sample.metrics,
        errors: sample.errors,
      })),
      sampling: buildSamplingAggregates(okSamples),
      executionMs: Date.now() - startedAt,
      errors: samples.flatMap(sample => sample.errors ?? []),
    };
  }
  const contract = effective.criticalPolicy
    ? applyCriticalOverride(run.contract, { policy: effective.criticalPolicy })
    : run.contract;
  const sample = await executeSingleSample(
    contract,
    effective,
    { seed: null },
    simulate
  );
  return {
    index,
    label,
    mode: 'single',
    status: sample.status,
    scenario: sample.scenario,
    critical: sample.critical,
    hashes: sample.hashes,
    metrics: sample.metrics,
    contributions: sample.contributions,
    executionMs: Date.now() - startedAt,
    errors: sample.errors,
  };
}

async function executeSingleSample(contract, effective, { seed }, simulate) {
  try {
    const run = await simulate(contract);
    const policy = String(
      run.trace?.critical?.policy ??
        contract.scenario?.critical?.policy ??
        COMBAT_CRITICAL_POLICIES.EXPECTED
    );
    const stateEffectHits = collectCriticalStateEffectHitIdentities(run.trace);
    if (
      stateEffectHits.length > 0 &&
      policy !== COMBAT_CRITICAL_POLICIES.SAMPLED
    ) {
      return {
        seed,
        status: 'validation-failed',
        critical: run.trace?.critical ?? null,
        scenario: null,
        hashes: null,
        metrics: null,
        contributions: null,
        errors: [
          createBatchIssue(
            'scenario.critical',
            'machine-axis-batch-critical-state-effect-policy',
            `Policy ${policy} is not allowed for hits with critical state effects (${stateEffectHits.join(', ')}); use expected only after exact weighted-branch proof, or run sampled with explicit seeds`
          ),
        ],
      };
    }
    const metrics = createRunMetrics(run, contract, effective);
    return {
      seed,
      status: 'ok',
      critical: run.trace?.critical ?? null,
      scenario: projectBatchScenario(run),
      hashes: run.hashes ?? null,
      metrics,
      contributions: createContributions(run),
      errors: [],
    };
  } catch (error) {
    const issues = Array.isArray(error?.issues)
      ? error.issues
      : [
          createBatchIssue(
            '',
            'machine-axis-batch-runtime-failed',
            error?.message ?? String(error)
          ),
        ];
    return {
      seed,
      status: Array.isArray(error?.issues)
        ? 'validation-failed'
        : 'runtime-failed',
      critical: null,
      scenario: null,
      hashes: null,
      metrics: null,
      contributions: null,
      errors: issues,
    };
  }
}

function projectBatchScenario(run) {
  return {
    projectId: run.trace?.scenario?.projectId ?? null,
    projectName: run.trace?.scenario?.projectName ?? null,
    durationMs: run.trace?.scenario?.durationMs ?? 0,
    frameRate: run.trace?.scenario?.frameRate ?? 60,
    enemyId: run.trace?.scenario?.enemyId ?? null,
    actorIds: run.trace?.scenario?.actorIds ?? [],
  };
}

export function createRunMetrics(run, contract = {}, options = {}) {
  const burstWindowMs =
    positiveNumber(options.burstWindowMs) ?? DEFAULT_BURST_WINDOW_MS;
  const durationMs = numberOrZero(run.trace?.scenario?.durationMs);
  const totals = run.evaluation?.totals ?? {};
  const hpDamage = numberOrZero(totals.hpDamage);
  const burst = computeBurstWindow(run.trace?.damage ?? [], burstWindowMs);
  const idle = computeIdle(run, durationMs);
  const nonExecutableActions = collectNonExecutableActions(run);
  return {
    hpDamage,
    dps: durationMs > 0 ? hpDamage / (durationMs / 1000) : 0,
    toughnessDamage: numberOrZero(totals.toughnessDamage),
    netToughnessDamage: numberOrZero(totals.netToughnessDamage),
    combatHitCount: numberOrZero(totals.combatHitCount),
    stateEventCount: numberOrZero(totals.stateEventCount),
    executedActionCount: numberOrZero(totals.executedActionCount),
    skippedActionCount: numberOrZero(totals.skippedActionCount),
    selfEnergyDelta: numberOrZero(totals.selfEnergyDelta),
    burst,
    resourceSurplus: computeResourceSurplus(run, contract),
    idle,
    nonExecutableActions,
    unresolvedActionCount: countUnresolvedActions(run),
  };
}

export function computeBurstWindow(
  damageEvents = [],
  windowMs = DEFAULT_BURST_WINDOW_MS
) {
  const window = positiveNumber(windowMs) ?? DEFAULT_BURST_WINDOW_MS;
  const events = (damageEvents ?? []).filter(
    event =>
      !event.stateEventKind &&
      Number.isFinite(Number(event.timeMs)) &&
      Number.isFinite(Number(event.rawDamage))
  );
  if (events.length === 0) {
    return {
      windowMs: window,
      hpDamage: 0,
      hitCount: 0,
      startMs: 0,
      endMs: 0,
      byActor: {},
    };
  }
  events.sort((left, right) => Number(left.timeMs) - Number(right.timeMs));
  let best = {
    windowMs: window,
    hpDamage: Number.NEGATIVE_INFINITY,
    hitCount: 0,
    startMs: 0,
    endMs: 0,
    byActor: {},
  };
  let left = 0;
  let sum = 0;
  let hitCount = 0;
  const actorSum = {};
  for (let right = 0; right < events.length; right += 1) {
    const event = events[right];
    const time = Number(event.timeMs);
    const damage = Number(event.rawDamage) || 0;
    const actorId = String(event.actorId ?? 'unattributed');
    sum += damage;
    hitCount += 1;
    actorSum[actorId] = (actorSum[actorId] ?? 0) + damage;
    while (left <= right && Number(events[left].timeMs) <= time - window) {
      const evicted = events[left];
      const evictedActor = String(evicted.actorId ?? 'unattributed');
      sum -= Number(evicted.rawDamage) || 0;
      hitCount -= 1;
      actorSum[evictedActor] -= Number(evicted.rawDamage) || 0;
      if (actorSum[evictedActor] <= 0) delete actorSum[evictedActor];
      left += 1;
    }
    if (
      sum > best.hpDamage ||
      (sum === best.hpDamage && hitCount > best.hitCount)
    ) {
      best = {
        windowMs: window,
        hpDamage: sum,
        hitCount,
        startMs: Number(events[left].timeMs),
        endMs: time,
        byActor: { ...actorSum },
      };
    }
  }
  return best;
}

export function computeIdle(run, durationMs = 0) {
  const duration = numberOrZero(durationMs);
  if (!(duration > 0)) {
    return { durationMs: 0, busyMs: 0, idleMs: 0, idleRatio: 0, byActor: [] };
  }
  const actorByActionId = new Map(
    (run.trace?.actions ?? []).map(action => [
      String(action.id),
      action.actorId ?? null,
    ])
  );
  const intervalsByActor = new Map();
  const teamIntervals = [];
  for (const entry of run.trace?.executionPlan?.actions ?? []) {
    if (entry.execute === false) continue;
    const start = Number(entry.startMs);
    const span = Number(entry.durationMs);
    if (!Number.isFinite(start) || !Number.isFinite(span) || span <= 0) {
      continue;
    }
    const actorId =
      actorByActionId.get(String(entry.actionId)) ?? 'unattributed';
    const interval = { start, end: start + span };
    teamIntervals.push(interval);
    const actorIntervals = intervalsByActor.get(actorId) ?? [];
    actorIntervals.push(interval);
    intervalsByActor.set(actorId, actorIntervals);
  }
  const byActor = [...intervalsByActor.entries()]
    .map(([actorId, intervals]) => {
      const merged = mergeIntervals(intervals);
      const busyMs = merged.reduce(
        (sum, interval) => sum + (interval.end - interval.start),
        0
      );
      const idleMs = Math.max(0, duration - busyMs);
      return {
        actorId,
        busyMs: roundMetric(busyMs),
        idleMs: roundMetric(idleMs),
        idleRatio: duration > 0 ? idleMs / duration : 0,
        executedActionCount: intervals.length,
      };
    })
    .sort((left, right) => left.actorId.localeCompare(right.actorId, 'en'));
  const teamBusyMs = mergeIntervals(teamIntervals).reduce(
    (sum, interval) => sum + (interval.end - interval.start),
    0
  );
  const teamIdleMs = Math.max(0, duration - teamBusyMs);
  return {
    durationMs: duration,
    busyMs: roundMetric(teamBusyMs),
    idleMs: roundMetric(teamIdleMs),
    idleRatio: duration > 0 ? teamIdleMs / duration : 0,
    byActor,
  };
}

function mergeIntervals(intervals) {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((left, right) => left.start - right.start);
  const merged = [];
  for (const interval of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && interval.start <= previous.end) {
      previous.end = Math.max(previous.end, interval.end);
    } else {
      merged.push({ start: interval.start, end: interval.end });
    }
  }
  return merged;
}

export function computeResourceSurplus(run, contract = {}) {
  const final = run.trace?.state?.final ?? {};
  const initialSpByCharacter = new Map(
    (contract.scenario?.team ?? []).map(slot => [
      Number(slot.characterId),
      finiteOrZero(slot.initialSp),
    ])
  );
  const actors = (final.actorEnergy ?? []).map(entry => {
    const characterId = Number(
      String(entry.actorId ?? '').replace(/^actor-/, '')
    );
    const initial = initialSpByCharacter.has(characterId)
      ? initialSpByCharacter.get(characterId)
      : null;
    const finalValue = finiteOrZero(entry.currentValue);
    return {
      actorId: entry.actorId ?? null,
      resource: 'sp',
      valueUnit: entry.valueUnit ?? 'absolute-sp-points',
      initial,
      final: finalValue,
      max: finiteOrZero(entry.maxValue),
      delta: initial == null ? null : roundMetric(finalValue - initial),
    };
  });
  const initialKiboByKey = new Map(
    (contract.scenario?.initialRuntimeState?.kiboEnergyBySlot ?? []).map(
      kibo => [
        `${kibo.actorId}:${Number(kibo.kiboId)}`,
        finiteOrZero(kibo.currentValue),
      ]
    )
  );
  const kibos = (final.kiboEnergy ?? []).map(entry => {
    const key = `${entry.actorId}:${Number(entry.kiboId)}`;
    const initial = initialKiboByKey.has(key)
      ? initialKiboByKey.get(key)
      : null;
    const finalValue = finiteOrZero(entry.currentValue);
    return {
      actorId: entry.actorId ?? null,
      kiboId: entry.kiboId ?? null,
      resource: 'kibo-energy',
      valueUnit: entry.valueUnit ?? 'absolute-sp-points',
      initial,
      final: finalValue,
      max: finiteOrZero(entry.maxValue),
      delta: initial == null ? null : roundMetric(finalValue - initial),
    };
  });
  return {
    actors,
    kibos,
    selfEnergyDelta: numberOrZero(run.evaluation?.totals?.selfEnergyDelta),
  };
}

function collectNonExecutableActions(run) {
  return (run.trace?.executionPlan?.actions ?? [])
    .filter(entry => entry.execute === false)
    .map(entry => ({
      actionId: entry.actionId ?? null,
      status: entry.status ?? null,
      skipReason: entry.skipReason ?? null,
      startMs: entry.startMs ?? null,
      durationMs: entry.durationMs ?? null,
      violationCodes: entry.violationCodes ?? [],
      unresolvedCodes: entry.unresolvedCodes ?? [],
    }));
}

function countUnresolvedActions(run) {
  return (run.trace?.executionPlan?.actions ?? []).filter(
    entry => entry.status === 'scheduled-with-unresolved-conditions'
  ).length;
}

export function createContributions(run) {
  const byHit = new Map();
  for (const event of run.trace?.damage ?? []) {
    const actionId = String(event.actionId ?? 'unattributed');
    const hitIdentity = String(
      event.hitIdentity ?? event.hitKey ?? `hit-${event.hitIndex ?? '?'}`
    );
    const identity = `${actionId}|${hitIdentity}`;
    const row = byHit.get(identity) ?? {
      identity,
      actionId,
      actorId: event.actorId ?? null,
      hitIdentity,
      hitCount: 0,
      hpDamage: 0,
      toughnessDamage: 0,
      stateEventCount: 0,
      firstTimeMs: null,
      lastTimeMs: null,
    };
    row.hitCount += 1;
    row.hpDamage += Number(event.rawDamage) || 0;
    row.toughnessDamage += Number(event.toughnessDamage) || 0;
    if (event.stateEventKind) row.stateEventCount += 1;
    const timeMs = finiteNumberOrNull(event.timeMs);
    if (timeMs != null) {
      row.firstTimeMs =
        row.firstTimeMs == null ? timeMs : Math.min(row.firstTimeMs, timeMs);
      row.lastTimeMs =
        row.lastTimeMs == null ? timeMs : Math.max(row.lastTimeMs, timeMs);
    }
    byHit.set(identity, row);
  }
  return {
    byActor: run.evaluation?.byActor ?? [],
    byAction: run.evaluation?.byAction ?? [],
    byHit: [...byHit.values()].sort((left, right) =>
      left.identity.localeCompare(right.identity, 'en')
    ),
  };
}

export function collectCriticalStateEffectHitIdentities(trace) {
  const mechanicsPackage = getInstalledVerifiedCombatMechanicsPackage();
  const bindings = [
    ...(mechanicsPackage?.controlBindings ?? []),
    ...(mechanicsPackage?.actionVariantControlBindings ?? []),
  ];
  const hitByIdentity = new Map(
    bindings.flatMap(binding =>
      (binding.hits ?? []).map(hit => [hit.hitIdentity, hit])
    )
  );
  const identities = new Set();
  for (const event of trace?.damage ?? []) {
    if (!event.hitIdentity) continue;
    const hit = hitByIdentity.get(event.hitIdentity);
    const effectIdentities = [
      ...(hit?.criticalStateEffectIdentities ?? []),
      ...(hit?.damage?.criticalStateEffectIdentities ?? []),
    ];
    if (effectIdentities.length > 0) identities.add(event.hitIdentity);
  }
  return [...identities].sort((left, right) => left.localeCompare(right, 'en'));
}

export function guardCriticalStateEffectPolicy({ policy, hitIdentities }) {
  const normalizedPolicy = String(policy ?? '');
  if (!hitIdentities?.length) return [];
  if (normalizedPolicy === COMBAT_CRITICAL_POLICIES.SAMPLED) return [];
  return hitIdentities.map(hitIdentity =>
    createBatchIssue(
      'scenario.critical',
      'machine-axis-batch-critical-state-effect-policy',
      `Policy ${normalizedPolicy} is not allowed for hit ${hitIdentity} with critical state effects; use exact weighted branch or sampled with explicit seeds`
    )
  );
}

function buildSamplingAggregates(okSamples) {
  if (!okSamples.length) return null;
  const metrics = {};
  for (const key of SAMPLE_METRIC_KEYS) {
    const values = okSamples.map(sample => {
      if (key === 'burstHpDamage') {
        return numberOrZero(sample.metrics?.burst?.hpDamage);
      }
      return numberOrZero(sample.metrics?.[key]);
    });
    metrics[key] = describeSamples(values);
  }
  return { count: okSamples.length, metrics };
}

function describeSamples(values) {
  if (values.length === 0) {
    return {
      count: 0,
      mean: 0,
      variance: 0,
      stdDev: 0,
      min: 0,
      max: 0,
      quantiles: Object.fromEntries(
        BATCH_QUANTILES.map(quantile => [`p${Math.round(quantile * 100)}`, 0])
      ),
    };
  }
  const sorted = [...values].sort((left, right) => left - right);
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const variance =
    sorted.length > 1
      ? sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
        (sorted.length - 1)
      : 0;
  const quantiles = {};
  for (const quantile of BATCH_QUANTILES) {
    quantiles[`p${Math.round(quantile * 100)}`] = quantileValue(
      sorted,
      quantile
    );
  }
  return {
    count: sorted.length,
    mean,
    variance,
    stdDev: Math.sqrt(variance),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    quantiles,
  };
}

function quantileValue(sorted, quantile) {
  if (sorted.length === 1) return sorted[0];
  const position = quantile * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function buildBatchSummary(runs, wallTimeMs, jobs) {
  const okRuns = runs.filter(run => run.status === 'ok');
  const executionMs = runs
    .map(run => run.executionMs)
    .filter(value => Number.isFinite(value));
  const representativeValues = okRuns
    .map(run => {
      if (run.mode === 'single') {
        return {
          hpDamage: numberOrZero(run.metrics?.hpDamage),
          dps: numberOrZero(run.metrics?.dps),
        };
      }
      if (run.sampling?.metrics) {
        return {
          hpDamage: numberOrZero(run.sampling.metrics.hpDamage.mean),
          dps: numberOrZero(run.sampling.metrics.dps.mean),
        };
      }
      return null;
    })
    .filter(Boolean);
  return {
    runCount: runs.length,
    okCount: okRuns.length,
    failedCount: runs.length - okRuns.length,
    validationFailedCount: runs.filter(
      run => run.status === 'validation-failed'
    ).length,
    runtimeFailedCount: runs.filter(run => run.status === 'runtime-failed')
      .length,
    wallTimeMs: wallTimeMs,
    jobs,
    perRunExecutionMs:
      executionMs.length > 0
        ? {
            min: Math.min(...executionMs),
            mean:
              executionMs.reduce((sum, value) => sum + value, 0) /
              executionMs.length,
            p50: quantileValue(executionMs, 0.5),
            p95: quantileValue(executionMs, 0.95),
            max: Math.max(...executionMs),
          }
        : null,
    aggregate:
      representativeValues.length > 0
        ? {
            hpDamageSum: representativeValues.reduce(
              (sum, value) => sum + value.hpDamage,
              0
            ),
            hpDamageMean:
              representativeValues.reduce(
                (sum, value) => sum + value.hpDamage,
                0
              ) / representativeValues.length,
            dpsSum: representativeValues.reduce(
              (sum, value) => sum + value.dps,
              0
            ),
            dpsMean:
              representativeValues.reduce((sum, value) => sum + value.dps, 0) /
              representativeValues.length,
            okRunCount: representativeValues.length,
          }
        : null,
  };
}

async function runWithConcurrency(items, jobs, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(jobs, items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await worker(items[index], index);
      }
    })
  );
  return results;
}

function applyCriticalOverride(contract, critical) {
  return {
    ...contract,
    scenario: {
      ...(contract.scenario ?? {}),
      critical: {
        ...(contract.scenario?.critical ?? {}),
        ...critical,
      },
    },
  };
}

function pickDefined(source, keys) {
  const result = {};
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null) result[key] = value;
  }
  return result;
}

function normalizeJobs(value) {
  return Number.isInteger(Number(value)) && Number(value) >= 1
    ? Number(value)
    : DEFAULT_BATCH_JOBS;
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function finiteOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function numberOrZero(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function finiteNumberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundMetric(value) {
  return Math.round(Number(value) * 1000) / 1000;
}
