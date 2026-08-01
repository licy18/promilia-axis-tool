import { msToFrame } from '../domain/timebase';
import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization';
import {
  collectCriticalStateEffectHitIdentities,
  guardCriticalStateEffectPolicy,
} from './machineAxisBatchEvaluator';
import {
  createMachineAxisDiagnostic,
  validateMachineAxisContract,
} from './machineAxisContract';
import { createSearchStateSnapshot } from './machineAxisSearchState';

export const MACHINE_AXIS_CYCLE_SCHEMA_VERSION = 1;
export const MACHINE_AXIS_CYCLE_CONTRACT_NAME = 'AzPrMachineAxisCycleDps';
export const MACHINE_AXIS_CYCLE_KIND = 'azpr-machine-axis-cycle-dps';

const DEFAULT_CYCLE_ASSUMPTIONS = Object.freeze({
  enemyHp: 'infinite',
  toughness: 'disabled',
  break: 'disabled',
  deathTruncation: 'disabled',
});
const SUPPORTED_CRITICAL_POLICIES = new Set([
  'sampled',
  'expected',
  'critical',
  'non-critical',
]);
const VALUE_TOLERANCE = 1e-8;
const TUNING_MARK_FRAME_TOLERANCE = 1;

export function normalizeMachineAxisCycleEnvelope(value = {}) {
  const source = isRecord(value) ? value : {};
  const loop = isRecord(source.loop) ? source.loop : {};
  const options = isRecord(source.options) ? source.options : {};
  return {
    schemaVersion:
      Number(source.schemaVersion) || MACHINE_AXIS_CYCLE_SCHEMA_VERSION,
    contractName:
      textOrNull(source.contractName) ?? MACHINE_AXIS_CYCLE_CONTRACT_NAME,
    kind: textOrNull(source.kind) ?? MACHINE_AXIS_CYCLE_KIND,
    contract: isRecord(source.contract)
      ? structuredClone(source.contract)
      : null,
    loop: {
      startFrame: integerOrNull(loop.startFrame),
      endFrame: integerOrNull(loop.endFrame),
    },
    options: {
      criticalPolicy: textOrNull(options.criticalPolicy) ?? 'expected',
      seeds: normalizeSeeds(options.seeds),
    },
    metadata: isRecord(source.metadata) ? structuredClone(source.metadata) : {},
  };
}

export function validateMachineAxisCycleEnvelope(value = {}) {
  const issues = [];
  const source = isRecord(value) ? value : {};
  if (!isRecord(value)) {
    issues.push(
      cycleIssue(
        'machine-axis-cycle-envelope-invalid',
        '',
        'Cycle DPS input must be an object'
      )
    );
  }
  if (source.schemaVersion !== MACHINE_AXIS_CYCLE_SCHEMA_VERSION) {
    issues.push(
      cycleIssue(
        'machine-axis-cycle-schema-version-unsupported',
        'schemaVersion',
        `Unsupported cycle schema version: ${source.schemaVersion ?? 'missing'}`
      )
    );
  }
  if (source.contractName !== MACHINE_AXIS_CYCLE_CONTRACT_NAME) {
    issues.push(
      cycleIssue(
        'machine-axis-cycle-contract-name-unsupported',
        'contractName',
        `Unsupported cycle contract: ${source.contractName ?? 'missing'}`
      )
    );
  }
  if (source.kind !== MACHINE_AXIS_CYCLE_KIND) {
    issues.push(
      cycleIssue(
        'machine-axis-cycle-kind-unsupported',
        'kind',
        `Unsupported cycle kind: ${source.kind ?? 'missing'}`
      )
    );
  }
  for (const key of Object.keys(source)) {
    if (
      ![
        'schemaVersion',
        'contractName',
        'kind',
        'contract',
        'loop',
        'options',
        'metadata',
      ].includes(key)
    ) {
      issues.push(
        cycleIssue(
          'machine-axis-cycle-additional-property',
          key,
          `Additional cycle property is not allowed: ${key}`
        )
      );
    }
  }
  if (!isRecord(source.contract)) {
    issues.push(
      cycleIssue(
        'machine-axis-cycle-contract-required',
        'contract',
        'Cycle DPS requires a Machine Axis contract'
      )
    );
  } else {
    const contractValidation = validateMachineAxisContract(source.contract);
    issues.push(
      ...contractValidation.issues.map(issue => ({
        ...issue,
        path: issue.path ? `contract.${issue.path}` : 'contract',
      }))
    );
  }
  if (!isRecord(source.loop)) {
    issues.push(
      cycleIssue(
        'machine-axis-cycle-loop-required',
        'loop',
        'Cycle DPS requires an explicit loop interval'
      )
    );
  } else {
    for (const key of Object.keys(source.loop)) {
      if (!['startFrame', 'endFrame'].includes(key)) {
        issues.push(
          cycleIssue(
            'machine-axis-cycle-additional-property',
            `loop.${key}`,
            `Additional loop property is not allowed: ${key}`
          )
        );
      }
    }
    const startFrame = source.loop.startFrame;
    const endFrame = source.loop.endFrame;
    if (!Number.isInteger(startFrame) || startFrame < 0) {
      issues.push(
        cycleIssue(
          'machine-axis-cycle-loop-start-invalid',
          'loop.startFrame',
          'loopStartFrame must be a non-negative integer'
        )
      );
    }
    if (!Number.isInteger(endFrame) || endFrame < 0) {
      issues.push(
        cycleIssue(
          'machine-axis-cycle-loop-end-invalid',
          'loop.endFrame',
          'loopEndFrame must be a non-negative integer'
        )
      );
    }
    if (
      Number.isInteger(startFrame) &&
      Number.isInteger(endFrame) &&
      endFrame <= startFrame
    ) {
      issues.push(
        cycleIssue(
          'machine-axis-cycle-loop-empty',
          'loop',
          'Cycle interval must be non-empty and half-open [start,end)',
          { startFrame, endFrame }
        )
      );
    }
    const horizon = integerOrNull(source.contract?.scenario?.durationFrames);
    if (Number.isInteger(endFrame) && horizon != null && endFrame > horizon) {
      issues.push(
        cycleIssue(
          'machine-axis-cycle-loop-after-horizon',
          'loop.endFrame',
          'Cycle interval exceeds the Machine Axis horizon',
          { endFrame, horizonFrame: horizon }
        )
      );
    }
  }
  if (source.options != null && !isRecord(source.options)) {
    issues.push(
      cycleIssue(
        'machine-axis-cycle-options-invalid',
        'options',
        'Cycle options must be an object'
      )
    );
  }
  if (isRecord(source.options)) {
    for (const key of Object.keys(source.options)) {
      if (!['criticalPolicy', 'seeds'].includes(key)) {
        issues.push(
          cycleIssue(
            'machine-axis-cycle-additional-property',
            `options.${key}`,
            `Additional cycle option is not allowed: ${key}`
          )
        );
      }
    }
    if (
      source.options.seeds != null &&
      (!Array.isArray(source.options.seeds) ||
        source.options.seeds.length === 0 ||
        source.options.seeds.some(
          seed =>
            !['string', 'number'].includes(typeof seed) ||
            (typeof seed === 'string' && seed.trim() === '') ||
            (typeof seed === 'number' && !Number.isInteger(seed))
        ))
    ) {
      issues.push(
        cycleIssue(
          'machine-axis-cycle-seeds-invalid',
          'options.seeds',
        'Cycle seeds must be a non-empty array of integers or non-empty strings'
        )
      );
    }
  }
  if (source.metadata != null && !isRecord(source.metadata)) {
    issues.push(
      cycleIssue(
        'machine-axis-cycle-metadata-invalid',
        'metadata',
        'Cycle metadata must be an object'
      )
    );
  }
  const policy = source.options?.criticalPolicy ?? 'expected';
  if (!SUPPORTED_CRITICAL_POLICIES.has(policy)) {
    issues.push(
      cycleIssue(
        'machine-axis-cycle-critical-policy-invalid',
        'options.criticalPolicy',
        `Unsupported cycle critical policy: ${policy}`
      )
    );
  }
  const seeds = normalizeSeeds(source.options?.seeds);
  if (policy === 'sampled' && seeds.length === 0) {
    const contractSeed = source.contract?.scenario?.critical?.seed;
    if (contractSeed == null || String(contractSeed) === '') {
      issues.push(
        cycleIssue(
          'machine-axis-cycle-sampled-seeds-required',
          'options.seeds',
          'Sampled cycle evaluation requires an explicit non-empty seed set'
        )
      );
    }
  }
  return {
    schemaVersion: MACHINE_AXIS_CYCLE_SCHEMA_VERSION,
    kind: 'azpr-machine-axis-cycle-validation',
    valid: issues.every(issue => issue.severity !== 'error'),
    issues,
    normalized: issues.some(issue => issue.severity === 'error')
      ? null
      : normalizeMachineAxisCycleEnvelope(source),
  };
}

export function createMachineAxisCycleEvaluator({
  prepareRun,
  simulateBoundary,
} = {}) {
  if (typeof prepareRun !== 'function') {
    throw new TypeError('Machine Axis cycle evaluator requires prepareRun');
  }
  if (typeof simulateBoundary !== 'function') {
    throw new TypeError(
      'Machine Axis cycle evaluator requires simulateBoundary'
    );
  }

  function evaluate(envelope, runtimeOptions = {}) {
    const validation = validateMachineAxisCycleEnvelope(envelope);
    if (!validation.valid) {
      return createRejectedReport({
        envelope,
        issues: validation.issues,
      });
    }
    const normalized = validation.normalized;
    const criticalPolicy =
      runtimeOptions.criticalPolicy ?? normalized.options.criticalPolicy;
    const requestedSeeds = normalizeSeeds(
      runtimeOptions.seeds ?? normalized.options.seeds
    );
    const fallbackSeed = normalized.contract.scenario?.critical?.seed;
    const seeds =
      criticalPolicy === 'sampled'
        ? requestedSeeds.length > 0
          ? requestedSeeds
          : fallbackSeed == null
            ? []
            : [String(fallbackSeed)]
        : [null];
    if (criticalPolicy === 'sampled' && seeds.length === 0) {
      return createRejectedReport({
        envelope: normalized,
        issues: [
          cycleIssue(
            'machine-axis-cycle-sampled-seeds-required',
            'options.seeds',
            'Sampled cycle evaluation requires an explicit non-empty seed set'
          ),
        ],
      });
    }
    const samples = seeds.map(seed =>
      evaluateCycleSample({
        envelope: normalized,
        criticalPolicy,
        seed,
        prepareRun,
        simulateBoundary,
        runtimeOptions,
      })
    );
    const rejected = samples.filter(sample => sample.valid !== true);
    if (rejected.length > 0) {
      return createRejectedReport({
        envelope: normalized,
        issues: dedupeIssues(rejected.flatMap(sample => sample.issues ?? [])),
        critical: {
          policy: criticalPolicy,
          seeds: seeds.filter(seed => seed != null),
        },
        samples,
      });
    }
    return createAcceptedReport({
      envelope: normalized,
      criticalPolicy,
      seeds,
      samples,
    });
  }

  return Object.freeze({ evaluate });
}

export function collectCycleDamageContributions(
  damageEvents = [],
  { startFrame, endFrame, fps = 60, actionIdMap = null } = {}
) {
  const normalizedStart = integerOrNull(startFrame);
  const normalizedEnd = integerOrNull(endFrame);
  if (
    normalizedStart == null ||
    normalizedEnd == null ||
    normalizedEnd <= normalizedStart
  ) {
    throw new TypeError('A non-empty half-open damage interval is required');
  }
  const byActor = new Map();
  const byAction = new Map();
  const byHit = new Map();
  let hpDamage = 0;
  let combatHitCount = 0;
  for (const event of damageEvents ?? []) {
    if (event?.stateEventKind) continue;
    const frame = resolveDamageFrame(event, fps);
    const damage = finiteNumberOrNull(event?.rawDamage);
    if (
      frame == null ||
      damage == null ||
      frame < normalizedStart ||
      frame >= normalizedEnd
    ) {
      continue;
    }
    const rawActionId = String(event.actionId ?? 'unattributed');
    const actionId = actionIdMap?.get?.(rawActionId) ?? rawActionId;
    const actorId = String(event.actorId ?? 'unattributed');
    const hitIdentity = String(
      event.hitIdentity ?? event.hitKey ?? `hit-${event.hitIndex ?? '?'}`
    );
    hpDamage += damage;
    combatHitCount += 1;
    addContribution(byActor, actorId, {
      identity: actorId,
      actorId,
      hpDamage: damage,
      combatHitCount: 1,
    });
    addContribution(byAction, actionId, {
      identity: actionId,
      actionId,
      actorId,
      hpDamage: damage,
      combatHitCount: 1,
    });
    const hitKey = `${actionId}|${hitIdentity}`;
    addContribution(byHit, hitKey, {
      identity: hitKey,
      actionId,
      actorId,
      hitIdentity,
      hpDamage: damage,
      combatHitCount: 1,
      firstFrame: frame,
      lastFrame: frame,
    });
  }
  return {
    interval: '[start,end)',
    startFrame: normalizedStart,
    endFrame: normalizedEnd,
    hpDamage: roundMetric(hpDamage),
    combatHitCount,
    byActor: finalizeContributions(byActor),
    byAction: finalizeContributions(byAction),
    byHit: finalizeContributions(byHit),
  };
}

export function compareCycleBoundaryStates(startSnapshot, endSnapshot) {
  if (!isRecord(startSnapshot) || !isRecord(endSnapshot)) {
    throw new TypeError('Cycle boundary snapshots are required');
  }
  const issues = [];
  const resourceDiffs = [];
  compareResourceRows({
    startRows: startSnapshot.actors,
    endRows: endSnapshot.actors,
    identity: row => `actor:${stripActorPrefix(row.actorId)}:sp`,
    value: row => row.sp,
    issues,
    resourceDiffs,
  });
  compareResourceRows({
    startRows: startSnapshot.kibos,
    endRows: endSnapshot.kibos,
    identity: row =>
      `kibo:${String(row.actorId ?? '')}:${String(row.kiboId ?? '')}:sp`,
    value: row => row.energy,
    issues,
    resourceDiffs,
  });
  compareResourceRows({
    startRows: startSnapshot.tuningMarks,
    endRows: endSnapshot.tuningMarks,
    identity: row =>
      `tuning-mark:${String(row.profileKey ?? '')}:${String(row.markId ?? '')}`,
    value: row => row.stacks,
    issues,
    resourceDiffs,
  });
  compareResourceRows({
    startRows: startSnapshot.specialResources,
    endRows: endSnapshot.specialResources,
    identity: row => String(row.resourceIdentity ?? ''),
    value: row => row.currentValue,
    issues,
    resourceDiffs,
  });
  compareResourceRows({
    startRows: startSnapshot.actorVitals,
    endRows: endSnapshot.actorVitals,
    identity: row => `actor:${stripActorPrefix(row.actorId)}:hp`,
    value: row => row.currentHp,
    issues,
    resourceDiffs,
  });
  compareResourceRows({
    startRows: startSnapshot.kiboVitals,
    endRows: endSnapshot.kiboVitals,
    identity: row =>
      `kibo:${String(row.slotId ?? '')}:${String(row.kiboId ?? '')}:hp`,
    value: row => row.currentHp,
    issues,
    resourceDiffs,
  });
  if (
    String(startSnapshot.activeActorId ?? '') !==
    String(endSnapshot.activeActorId ?? '')
  ) {
    issues.push(
      cycleIssue(
        'machine-axis-cycle-active-actor-not-closed',
        'state.activeActorId',
        'Controlled actor differs at the cycle boundary',
        {
          startValue: startSnapshot.activeActorId ?? null,
          endValue: endSnapshot.activeActorId ?? null,
        }
      )
    );
  }
  const tuningMarkComparison = compareTuningMarkLifecycleStates(
    startSnapshot.tuningMarks,
    endSnapshot.tuningMarks
  );
  issues.push(...tuningMarkComparison.issues);
  const stateDimensions = [
    ['cooldowns', normalizeCooldownState],
    ['effects', normalizeEffectState],
    ['targetStates', normalizeTargetState],
    ['specialStates', normalizeSpecialState],
    ['shields', normalizeShieldState],
    ['pendingEvents', normalizePendingState],
  ];
  const stateDiffs = [];
  for (const [dimension, normalize] of stateDimensions) {
    const startValue = normalize(startSnapshot);
    const endValue = normalize(endSnapshot);
    const equal =
      hashCanonicalValue(startValue) === hashCanonicalValue(endValue);
    stateDiffs.push({ dimension, equal, start: startValue, end: endValue });
    if (!equal) {
      issues.push(
        cycleIssue(
          'machine-axis-cycle-state-not-closed',
          `state.${dimension}`,
          `${dimension} does not return to an equivalent relative state`,
          { dimension, start: startValue, end: endValue }
        )
      );
    }
  }
  return {
    closed: issues.length === 0,
    issues,
    resourceDiffs,
    tuningMarkDiffs: tuningMarkComparison.diffs,
    stateDiffs,
  };
}

export function createCycleReplayStabilityProof({
  firstCycle,
  secondCycle,
  firstClosure,
  secondClosure,
  secondExecution,
  tolerance = VALUE_TOLERANCE,
} = {}) {
  const issues = [
    ...(firstClosure?.issues ?? []),
    ...(secondClosure?.issues ?? []),
    ...(secondExecution?.issues ?? []),
  ];
  const firstHpDamage = finiteNumberOrNull(firstCycle?.hpDamage) ?? 0;
  const secondHpDamage = finiteNumberOrNull(secondCycle?.hpDamage) ?? 0;
  if (Math.abs(firstHpDamage - secondHpDamage) > tolerance) {
    issues.push(
      cycleIssue(
        'machine-axis-cycle-damage-not-stable',
        'replayProof.damage',
        'Consecutive cycle damage differs; warmup or one-time state is leaking into the loop',
        { firstHpDamage, secondHpDamage, tolerance }
      )
    );
  }
  if (secondExecution?.runnable !== true) {
    issues.push(
      cycleIssue(
        'machine-axis-cycle-second-replay-not-runnable',
        'replayProof.secondCycle',
        'The second cycle cannot execute the complete semantic loop',
        { executionIssues: secondExecution?.issues ?? [] }
      )
    );
  }
  const deduped = dedupeIssues(issues);
  return {
    stable: deduped.length === 0,
    issues: deduped,
    damageStable: Math.abs(firstHpDamage - secondHpDamage) <= tolerance,
    firstClosure: firstClosure ?? null,
    secondClosure: secondClosure ?? null,
    secondExecution: secondExecution ?? null,
    cycles: [
      {
        index: 1,
        hpDamage: roundMetric(firstHpDamage),
        combatHitCount: Number(firstCycle?.combatHitCount) || 0,
        runnable: true,
      },
      {
        index: 2,
        hpDamage: roundMetric(secondHpDamage),
        combatHitCount: Number(secondCycle?.combatHitCount) || 0,
        runnable: secondExecution?.runnable === true,
      },
    ],
  };
}

function evaluateCycleSample({
  envelope,
  criticalPolicy,
  seed,
  prepareRun,
  simulateBoundary,
  runtimeOptions,
}) {
  const firstContract = createCycleScenarioContract(
    envelope.contract,
    criticalPolicy,
    seed
  );
  let firstPrepared;
  try {
    firstPrepared = prepareRun(firstContract, runtimeOptions);
  } catch (error) {
    return rejectedSample(seed, normalizeErrorIssues(error));
  }
  if (firstPrepared.valid !== true) {
    return rejectedSample(seed, firstPrepared.issues ?? []);
  }
  const stateCriticalIssues = guardCriticalStateEffectPolicy({
    policy: criticalPolicy,
    hitIdentities: collectCriticalStateEffectHitIdentities(
      firstPrepared.run?.trace
    ),
  }).map(issue => ({ ...issue, path: issue.path ?? 'options.criticalPolicy' }));
  if (stateCriticalIssues.length > 0) {
    return rejectedSample(seed, stateCriticalIssues);
  }
  const loopPlan = createLoopReplayPlan({
    contract: firstContract,
    actionResolutions: firstPrepared.compilation.actionResolutions,
    loop: envelope.loop,
  });
  if (!loopPlan.valid) return rejectedSample(seed, loopPlan.issues);

  let replayPrepared;
  try {
    replayPrepared = prepareRun(loopPlan.contract, runtimeOptions);
  } catch (error) {
    return rejectedSample(seed, [
      cycleIssue(
        'machine-axis-cycle-second-replay-not-runnable',
        'replayProof.secondCycle',
        'The doubled semantic loop failed canonical compilation or simulation',
        { causes: normalizeErrorIssues(error) }
      ),
    ]);
  }
  if (replayPrepared.valid !== true) {
    return rejectedSample(seed, [
      cycleIssue(
        'machine-axis-cycle-second-replay-not-runnable',
        'replayProof.secondCycle',
        'The doubled semantic loop contains non-executable actions',
        { causes: replayPrepared.issues ?? [] }
      ),
    ]);
  }

  const replayRun = attachActionResolutions(
    replayPrepared.run,
    replayPrepared.compilation.actionResolutions
  );
  const secondEndFrame = envelope.loop.endFrame + loopPlan.durationFrames;
  let startSnapshot;
  let firstEndSnapshot;
  let secondEndSnapshot;
  try {
    startSnapshot = createBoundarySnapshot({
      frame: envelope.loop.startFrame,
      prepared: replayPrepared,
      replayRun,
      replayContract: loopPlan.contract,
      simulateBoundary,
      runtimeOptions,
    });
    firstEndSnapshot = createBoundarySnapshot({
      frame: envelope.loop.endFrame,
      prepared: replayPrepared,
      replayRun,
      replayContract: loopPlan.contract,
      simulateBoundary,
      runtimeOptions,
    });
    secondEndSnapshot = createBoundarySnapshot({
      frame: secondEndFrame,
      prepared: replayPrepared,
      replayRun,
      replayContract: loopPlan.contract,
      simulateBoundary,
      runtimeOptions,
    });
  } catch (error) {
    return rejectedSample(seed, [
      cycleIssue(
        'machine-axis-cycle-boundary-replay-failed',
        'stateClosure',
        'Unable to reconstruct a canonical cycle boundary state',
        { causes: normalizeErrorIssues(error) }
      ),
    ]);
  }
  const firstCycle = collectCycleDamageContributions(
    replayPrepared.run.trace.damage,
    {
      startFrame: envelope.loop.startFrame,
      endFrame: envelope.loop.endFrame,
      fps: firstContract.scenario.fps,
    }
  );
  const secondCycle = collectCycleDamageContributions(
    replayPrepared.run.trace.damage,
    {
      startFrame: envelope.loop.endFrame,
      endFrame: secondEndFrame,
      fps: firstContract.scenario.fps,
      actionIdMap: loopPlan.secondToSourceActionId,
    }
  );
  const firstClosure = compareCycleBoundaryStates(
    startSnapshot,
    firstEndSnapshot
  );
  const secondClosure = compareCycleBoundaryStates(
    firstEndSnapshot,
    secondEndSnapshot
  );
  const secondExecution = createSecondCycleExecutionProof({
    trace: replayPrepared.run.trace,
    secondActionIds: loopPlan.secondActionIds,
    secondToSourceActionId: loopPlan.secondToSourceActionId,
    actionResolutions: replayPrepared.compilation.actionResolutions,
  });
  const replayProof = createCycleReplayStabilityProof({
    firstCycle,
    secondCycle,
    firstClosure,
    secondClosure,
    secondExecution,
  });
  if (!replayProof.stable)
    return rejectedSample(seed, replayProof.issues, {
      replayProof,
      firstCycle,
      secondCycle,
      hashes: replayPrepared.run.hashes,
    });
  return {
    valid: true,
    status: 'closed',
    seed,
    hashes: replayPrepared.run.hashes,
    firstCycle,
    secondCycle,
    replayProof,
    state: {
      start: startSnapshot,
      firstEnd: firstEndSnapshot,
      secondEnd: secondEndSnapshot,
    },
    evidence: {
      firstCycle: {
        classification: firstPrepared.classification ?? null,
        warnings: firstPrepared.warnings ?? [],
      },
      replay: {
        classification: replayPrepared.classification ?? null,
        warnings: replayPrepared.warnings ?? [],
      },
    },
    loopPlan: {
      sourceActionIds: loopPlan.sourceActionIds,
      secondActionIds: [...loopPlan.secondActionIds],
      warmupActionIds: loopPlan.warmupActionIds,
      replayHorizonFrame: loopPlan.replayHorizonFrame,
    },
  };
}

function createLoopReplayPlan({ contract, actionResolutions, loop }) {
  const issues = [];
  const resolutionById = new Map(
    (actionResolutions ?? []).map(resolution => [
      String(resolution.actionId),
      resolution,
    ])
  );
  const startFrame = Number(loop.startFrame);
  const endFrame = Number(loop.endFrame);
  const durationFrames = endFrame - startFrame;
  const warmupActions = [];
  const loopActions = [];
  for (const action of contract.actions ?? []) {
    const resolution = resolutionById.get(String(action.id));
    const actionStart = integerOrNull(resolution?.startFrame);
    const duration = integerOrNull(resolution?.durationFrames);
    if (actionStart == null || duration == null) {
      issues.push(
        cycleIssue(
          'machine-axis-cycle-action-timing-unresolved',
          `actions.${String(action.id)}`,
          `Cycle action timing is unresolved: ${action.id}`,
          { actionId: action.id }
        )
      );
      continue;
    }
    const actionEnd = actionStart + duration;
    if (actionStart < startFrame) {
      warmupActions.push(action);
      if (actionEnd > startFrame) {
        issues.push(
          cycleIssue(
            'machine-axis-cycle-action-crosses-loop-start',
            `actions.${String(action.id)}`,
            `Warmup action crosses loop start: ${action.id}`,
            { actionId: action.id, actionStart, actionEnd, startFrame }
          )
        );
      }
      continue;
    }
    if (actionStart >= endFrame) continue;
    loopActions.push({ action, actionStart, actionEnd });
    if (actionEnd > endFrame) {
      issues.push(
        cycleIssue(
          'machine-axis-cycle-action-crosses-loop-end',
          `actions.${String(action.id)}`,
          `Cycle action occupancy crosses loop end: ${action.id}`,
          { actionId: action.id, actionStart, actionEnd, endFrame }
        )
      );
    }
  }
  if (loopActions.length === 0) {
    issues.push(
      cycleIssue(
        'machine-axis-cycle-actions-required',
        'contract.actions',
        'Cycle interval contains no semantic action inputs'
      )
    );
  }
  if (issues.length > 0) return { valid: false, issues };
  const existingIds = new Set(
    (contract.actions ?? []).map(action => String(action.id))
  );
  const secondToSourceActionId = new Map();
  const secondActions = loopActions.map(({ action, actionStart }, index) => {
    const secondId = createUniqueCycleActionId(action.id, existingIds, index);
    existingIds.add(secondId);
    secondToSourceActionId.set(secondId, String(action.id));
    const clone = structuredClone(action);
    clone.id = secondId;
    clone.schedule = {
      mode: 'absolute',
      frame: actionStart + durationFrames,
      offsetFrames: 0,
      actionId: null,
    };
    if (clone.intent?.attackInput?.groupId) {
      clone.intent.attackInput.groupId = `${clone.intent.attackInput.groupId}:cycle-2`;
    }
    clone.note = [clone.note, `cycle replay of ${action.id}`]
      .filter(Boolean)
      .join(' | ');
    return clone;
  });
  const firstActions = [
    ...warmupActions,
    ...loopActions.map(entry => entry.action),
  ];
  const replayContract = structuredClone(contract);
  const replayHorizonFrame = Math.max(
    Number(contract.scenario.durationFrames) || 0,
    endFrame + durationFrames
  );
  replayContract.scenario.durationFrames = replayHorizonFrame;
  replayContract.actions = [...firstActions, ...secondActions];
  replayContract.metadata = {
    ...(replayContract.metadata ?? {}),
    cycleReplay: {
      interval: '[start,end)',
      startFrame,
      endFrame,
      replayCount: 2,
    },
  };
  return {
    valid: true,
    issues: [],
    contract: replayContract,
    durationFrames,
    warmupActionIds: warmupActions.map(action => action.id),
    sourceActionIds: loopActions.map(entry => entry.action.id),
    secondActionIds: new Set(secondActions.map(action => action.id)),
    secondToSourceActionId,
    replayHorizonFrame,
  };
}

function createBoundarySnapshot({
  frame,
  prepared,
  replayRun,
  replayContract,
  simulateBoundary,
  runtimeOptions,
}) {
  const boundaryRun = simulateBoundary({
    project: prepared.compilation.project,
    boundaryFrame: frame,
    options: runtimeOptions,
  });
  const snapshot = createSearchStateSnapshot({
    run: attachActionResolutions(
      boundaryRun,
      prepared.compilation.actionResolutions
    ),
    pendingRun: replayRun,
    contract: replayContract,
    currentFrame: frame,
    fps: replayContract.scenario.fps,
    stateKind: 'final',
  });
  projectCanonicalBoundaryState({ snapshot, boundaryRun, frame });
  return finalizeBoundarySnapshot(
    snapshot,
    frame,
    prepared.compilation.actionResolutions
  );
}

function finalizeBoundarySnapshot(snapshot, boundaryFrame, actionResolutions) {
  const startByActionId = new Map(
    (actionResolutions ?? []).map(resolution => [
      String(resolution.actionId),
      integerOrNull(resolution.startFrame),
    ])
  );
  snapshot.pendingEvents = (snapshot.pendingEvents ?? []).filter(event => {
    const startFrame = startByActionId.get(String(event.actionId ?? ''));
    return startFrame != null && startFrame < boundaryFrame;
  });
  return snapshot;
}

function createSecondCycleExecutionProof({
  trace,
  secondActionIds,
  secondToSourceActionId,
  actionResolutions,
}) {
  const byId = new Map(
    (trace?.executionPlan?.actions ?? []).map(entry => [
      String(entry.actionId),
      entry,
    ])
  );
  const resolutionById = new Map(
    (actionResolutions ?? []).map(entry => [String(entry.actionId), entry])
  );
  const issues = [];
  const variantPairs = [];
  for (const actionId of secondActionIds ?? []) {
    const entry = byId.get(String(actionId));
    if (!entry || entry.execute === false) {
      issues.push(
        cycleIssue(
          'machine-axis-cycle-second-action-not-executable',
          `executionPlan.${actionId}`,
          `Second-cycle action is not executable: ${actionId}`,
          {
            actionId,
            status: entry?.status ?? 'missing',
            skipReason: entry?.skipReason ?? null,
          }
        )
      );
    } else if (entry.status === 'scheduled-with-unresolved-conditions') {
      issues.push(
        cycleIssue(
          'machine-axis-cycle-second-action-unresolved',
          `executionPlan.${actionId}`,
          `Second-cycle action still has unresolved conditions: ${actionId}`,
          { actionId, unresolvedCodes: entry.unresolvedCodes ?? [] }
        )
      );
    }
    const sourceActionId = secondToSourceActionId?.get?.(String(actionId));
    const sourceVariant = projectResolvedActionForm(
      resolutionById.get(String(sourceActionId ?? ''))
    );
    const replayVariant = projectResolvedActionForm(
      resolutionById.get(String(actionId))
    );
    const equivalent =
      sourceActionId != null &&
      hashCanonicalValue(sourceVariant) === hashCanonicalValue(replayVariant);
    variantPairs.push({
      sourceActionId: sourceActionId ?? null,
      replayActionId: actionId,
      equivalent,
      sourceVariant,
      replayVariant,
    });
    if (!equivalent) {
      issues.push(
        cycleIssue(
          'machine-axis-cycle-action-form-not-closed',
          `executionPlan.${actionId}`,
          `Second-cycle action resolves to a different executable form: ${actionId}`,
          {
            actionId,
            sourceActionId: sourceActionId ?? null,
            sourceVariant,
            replayVariant,
          }
        )
      );
    }
  }
  return { runnable: issues.length === 0, issues, variantPairs };
}

function projectResolvedActionForm(value) {
  if (!value) return null;
  return {
    publicActionId: value.publicActionId ?? null,
    actionKind: value.actionKind ?? null,
    publicVariantIndex: value.publicVariantIndex ?? null,
    mappingIdentity: value.mappingIdentity ?? null,
    resolvedControlSkillId: value.resolvedControlSkillId ?? null,
    resolvedSubSkillIndex: value.resolvedSubSkillIndex ?? null,
    durationFrames: value.durationFrames ?? null,
    variantResolutionStatus: value.variantResolutionStatus ?? null,
  };
}

function createCycleScenarioContract(contract, criticalPolicy, seed) {
  const value = structuredClone(contract);
  value.scenario.critical = {
    policy: criticalPolicy,
    seed: criticalPolicy === 'sampled' ? seed : null,
  };
  value.scenario.target = {
    hpMode: 'infinite',
    toughnessMode: 'disabled',
    breakMode: 'disabled',
    deathTruncation: 'disabled',
  };
  return value;
}

function createAcceptedReport({ envelope, criticalPolicy, seeds, samples }) {
  const fps = Number(envelope.contract.scenario.fps) || 60;
  const durationFrames = envelope.loop.endFrame - envelope.loop.startFrame;
  const aggregate = aggregateSamples(samples);
  const warnings = dedupeIssues(
    samples.flatMap(sample => [
      ...(sample.evidence?.firstCycle?.warnings ?? []),
      ...(sample.evidence?.replay?.warnings ?? []),
    ])
  );
  const value = {
    schemaVersion: MACHINE_AXIS_CYCLE_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_CYCLE_CONTRACT_NAME,
    kind: 'azpr-machine-axis-cycle-dps-evaluation',
    valid: true,
    status: 'closed',
    issues: [],
    warnings,
    assumptions: DEFAULT_CYCLE_ASSUMPTIONS,
    critical: {
      policy: criticalPolicy,
      seeds: criticalPolicy === 'sampled' ? seeds : [],
    },
    warmup: {
      interval: '[start,end)',
      startFrame: 0,
      endFrame: envelope.loop.startFrame,
      durationFrames: envelope.loop.startFrame,
      actionIds: samples[0]?.loopPlan?.warmupActionIds ?? [],
    },
    loop: {
      interval: '[start,end)',
      startFrame: envelope.loop.startFrame,
      endFrame: envelope.loop.endFrame,
      durationFrames,
      durationSeconds: roundMetric(durationFrames / fps),
      fps,
      actionIds: samples[0]?.loopPlan?.sourceActionIds ?? [],
    },
    metrics: {
      loopHpDamage: aggregate.hpDamage,
      cycleDps: roundMetric(
        aggregate.hpDamage / Math.max(VALUE_TOLERANCE, durationFrames / fps)
      ),
      combatHitCount: aggregate.combatHitCount,
    },
    contributions: aggregate.contributions,
    replayProof:
      samples.length === 1
        ? samples[0].replayProof
        : {
            stable: samples.every(sample => sample.replayProof.stable),
            sampleCount: samples.length,
            samples: samples.map(sample => ({
              seed: sample.seed,
              replayProof: sample.replayProof,
            })),
          },
    stateClosure: samples.map(sample => ({
      seed: sample.seed,
      start: sample.state.start,
      firstEnd: sample.state.firstEnd,
      secondEnd: sample.state.secondEnd,
    })),
    samples: samples.map(projectSampleReport),
    evidence: {
      evidenceClosed: samples.every(sample =>
        [
          sample.evidence?.firstCycle?.classification,
          sample.evidence?.replay?.classification,
        ].every(
          classification =>
            classification?.evidenceStatus == null ||
            classification.evidenceStatus === 'evidence-closed'
        )
      ),
      samples: samples.map(sample => ({
        seed: sample.seed ?? null,
        ...sample.evidence,
      })),
    },
    hashes: createAggregateHashes(samples),
  };
  value.hashes.cycle = hashCanonicalValue({
    assumptions: value.assumptions,
    critical: value.critical,
    loop: value.loop,
    metrics: value.metrics,
    contributions: value.contributions,
    replayProof: value.replayProof,
    evidence: value.evidence,
    warnings: value.warnings,
    sampleHashes: value.samples.map(sample => sample.hashes),
  });
  return value;
}

function createRejectedReport({
  envelope,
  issues,
  critical = null,
  samples = [],
}) {
  return {
    schemaVersion: MACHINE_AXIS_CYCLE_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_CYCLE_CONTRACT_NAME,
    kind: 'azpr-machine-axis-cycle-dps-evaluation',
    valid: false,
    status: 'rejected',
    issues: dedupeIssues(issues ?? []),
    warnings: [],
    assumptions: DEFAULT_CYCLE_ASSUMPTIONS,
    critical,
    loop: isRecord(envelope?.loop)
      ? {
          interval: '[start,end)',
          startFrame: envelope.loop.startFrame ?? null,
          endFrame: envelope.loop.endFrame ?? null,
        }
      : null,
    samples: samples.map(projectSampleReport),
    hashes: {
      input: null,
      data: null,
      trace: null,
      evaluation: null,
      cycle: null,
    },
  };
}

function aggregateSamples(samples) {
  const hpDamage = mean(samples.map(sample => sample.firstCycle.hpDamage));
  const combatHitCount = mean(
    samples.map(sample => sample.firstCycle.combatHitCount)
  );
  const roundedHpDamage = roundMetric(hpDamage);
  const contributions = {
    byActor: aggregateContributionDimension(samples, 'byActor'),
    byAction: aggregateContributionDimension(samples, 'byAction'),
    byHit: aggregateContributionDimension(samples, 'byHit'),
  };
  for (const rows of Object.values(contributions)) {
    reconcileContributionTotal(rows, roundedHpDamage);
  }
  return {
    hpDamage: roundedHpDamage,
    combatHitCount: roundMetric(combatHitCount),
    contributions,
  };
}

function aggregateContributionDimension(samples, key) {
  const byIdentity = new Map();
  for (const sample of samples) {
    for (const row of sample.firstCycle[key] ?? []) {
      const identity = String(row.identity ?? 'unattributed');
      const aggregate = byIdentity.get(identity) ?? {
        ...row,
        hpDamage: 0,
        combatHitCount: 0,
        sampleCount: 0,
      };
      aggregate.hpDamage += Number(row.hpDamage) || 0;
      aggregate.combatHitCount += Number(row.combatHitCount) || 0;
      aggregate.sampleCount += 1;
      byIdentity.set(identity, aggregate);
    }
  }
  return [...byIdentity.values()]
    .map(row => ({
      ...row,
      hpDamage: roundMetric(row.hpDamage / samples.length),
      combatHitCount: roundMetric(row.combatHitCount / samples.length),
      sampleCount: samples.length,
    }))
    .sort((left, right) => left.identity.localeCompare(right.identity, 'en'));
}

function projectSampleReport(sample) {
  return {
    valid: sample.valid,
    status: sample.status,
    seed: sample.seed ?? null,
    issues: sample.issues ?? [],
    hashes: sample.hashes ?? null,
    firstCycle: sample.firstCycle ?? null,
    secondCycle: sample.secondCycle ?? null,
    replayProof: sample.replayProof ?? null,
    loopPlan: sample.loopPlan ?? null,
    evidence: sample.evidence ?? null,
  };
}

function reconcileContributionTotal(rows, expectedTotal) {
  if (!rows.length) return;
  const currentTotal = roundMetric(
    rows.reduce((sum, row) => sum + (Number(row.hpDamage) || 0), 0)
  );
  const residual = roundMetric(expectedTotal - currentTotal);
  if (Math.abs(residual) <= VALUE_TOLERANCE) {
    rows[rows.length - 1].hpDamage = roundMetric(
      Number(rows[rows.length - 1].hpDamage) + residual
    );
  }
}

function createAggregateHashes(samples) {
  const first = samples[0]?.hashes ?? {};
  if (samples.length === 1) {
    return {
      input: first.input ?? null,
      data: first.data ?? null,
      trace: first.trace ?? null,
      evaluation: first.evaluation ?? null,
      cycle: null,
    };
  }
  return {
    input: hashCanonicalValue(
      samples.map(sample => sample.hashes?.input ?? null)
    ),
    data: hashCanonicalValue(
      samples.map(sample => sample.hashes?.data ?? null)
    ),
    trace: hashCanonicalValue(
      samples.map(sample => sample.hashes?.trace ?? null)
    ),
    evaluation: hashCanonicalValue(
      samples.map(sample => sample.hashes?.evaluation ?? null)
    ),
    cycle: null,
  };
}

function rejectedSample(seed, issues, details = {}) {
  return {
    valid: false,
    status: 'rejected',
    seed,
    issues: dedupeIssues(issues ?? []),
    ...details,
  };
}

function compareResourceRows({
  startRows = [],
  endRows = [],
  identity,
  value,
  issues,
  resourceDiffs,
}) {
  const start = new Map(
    (startRows ?? []).map(row => [
      identity(row),
      finiteNumberOrNull(value(row)) ?? 0,
    ])
  );
  const end = new Map(
    (endRows ?? []).map(row => [
      identity(row),
      finiteNumberOrNull(value(row)) ?? 0,
    ])
  );
  const identities = [...new Set([...start.keys(), ...end.keys()])]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, 'en'));
  for (const resourceIdentity of identities) {
    const startValue = start.get(resourceIdentity) ?? 0;
    const endValue = end.get(resourceIdentity) ?? 0;
    const delta = roundMetric(endValue - startValue);
    const closed = endValue + VALUE_TOLERANCE >= startValue;
    resourceDiffs.push({
      resourceIdentity,
      startValue,
      endValue,
      delta,
      closed,
    });
    if (!closed) {
      issues.push(
        cycleIssue(
          'machine-axis-cycle-resource-deficit',
          `state.resources.${resourceIdentity}`,
          `Cycle consumes non-renewed resource ${resourceIdentity}`,
          { resourceIdentity, startValue, endValue, delta }
        )
      );
    }
  }
}

function compareTuningMarkLifecycleStates(startRows = [], endRows = []) {
  const start = createTuningMarkLifecycleMap(startRows);
  const end = createTuningMarkLifecycleMap(endRows);
  const identities = [...new Set([...start.keys(), ...end.keys()])]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, 'en'));
  const issues = [];
  const diffs = [];
  for (const markIdentity of identities) {
    const startRow = start.get(markIdentity) ?? emptyTuningMarkLifecycle();
    const endRow = end.get(markIdentity) ?? emptyTuningMarkLifecycle();
    const stackDelta = endRow.stacks - startRow.stacks;
    const bothEmpty = startRow.stacks <= 0 && endRow.stacks <= 0;
    const decayClosed =
      bothEmpty ||
      endRow.stacks > startRow.stacks ||
      endRow.stacks < startRow.stacks ||
      endRow.decayRemainingFrames + TUNING_MARK_FRAME_TOLERANCE >=
        startRow.decayRemainingFrames;
    const heldReadyClosed =
      bothEmpty ||
      endRow.heldReadyRemainingFrames <=
        startRow.heldReadyRemainingFrames;
    const diff = {
      markIdentity,
      profileKey: endRow.profileKey ?? startRow.profileKey,
      markId: endRow.markId ?? startRow.markId,
      startStacks: startRow.stacks,
      endStacks: endRow.stacks,
      stackDelta,
      startDecayRemainingFrames: bothEmpty
        ? 0
        : startRow.decayRemainingFrames,
      endDecayRemainingFrames: bothEmpty ? 0 : endRow.decayRemainingFrames,
      startHeldReadyRemainingFrames: bothEmpty
        ? 0
        : startRow.heldReadyRemainingFrames,
      endHeldReadyRemainingFrames: bothEmpty
        ? 0
        : endRow.heldReadyRemainingFrames,
      decayFrameTolerance: TUNING_MARK_FRAME_TOLERANCE,
      decayClosed,
      heldReadyClosed,
    };
    diffs.push(diff);
    if (
      startRow.stacks > 0 &&
      endRow.stacks === startRow.stacks &&
      !decayClosed
    ) {
      issues.push(
        cycleIssue(
          'machine-axis-cycle-tuning-mark-decay-regressed',
          `state.tuningMarks.${markIdentity}.decayRemainingFrames`,
          `Tuning mark decay window regresses for ${markIdentity}`,
          diff
        )
      );
    }
    if (!heldReadyClosed) {
      issues.push(
        cycleIssue(
          'machine-axis-cycle-tuning-mark-held-ready-regressed',
          `state.tuningMarks.${markIdentity}.heldReadyRemainingFrames`,
          `Tuning mark held-ready wait regresses for ${markIdentity}`,
          diff
        )
      );
    }
  }
  return { issues, diffs };
}

function createTuningMarkLifecycleMap(rows = []) {
  return new Map(
    (rows ?? [])
      .map(row => {
        const normalized = normalizeTuningMarkLifecycleRow(row);
        return [
          `tuning-mark:${String(normalized.profileKey ?? '')}:${String(normalized.markId ?? '')}`,
          normalized,
        ];
      })
      .filter(([identity, row]) => identity && row.markId != null)
  );
}

function normalizeTuningMarkLifecycleRow(row = {}) {
  return {
    profileKey: row.profileKey ?? null,
    markId: row.markId ?? null,
    stacks: Math.max(0, Number(row.stacks) || 0),
    decayRemainingFrames: Math.max(
      0,
      Number(row.decayRemainingFrames) || 0
    ),
    heldReadyRemainingFrames: Math.max(
      0,
      Number(row.heldReadyRemainingFrames) || 0
    ),
  };
}

function emptyTuningMarkLifecycle() {
  return {
    profileKey: null,
    markId: null,
    stacks: 0,
    decayRemainingFrames: 0,
    heldReadyRemainingFrames: 0,
  };
}

function projectCanonicalBoundaryState({ snapshot, boundaryRun, frame }) {
  const verifiedRuntime = boundaryRun?.simulation?.verifiedCombatRuntime;
  if (!verifiedRuntime?.ready) return snapshot;
  const boundaryTimeMs =
    Number(frame) * (1000 / (Number(snapshot.fps) || 60));
  const prefixTimeMs = Number(boundaryRun.trace?.scenario?.durationMs) || 0;
  const prefixGapMs = Math.max(0, boundaryTimeMs - prefixTimeMs);
  const tuningState = verifiedRuntime.tuningMarkRuntime?.finalState;
  if (Array.isArray(tuningState)) {
    snapshot.tuningMarks = tuningState
      .map(row => ({
        profileKey: row.profileKey ?? null,
        markId: row.markId ?? null,
        stacks: Number(row.currentValue) || 0,
        maximum: Number(row.maxValue) || 0,
        decayRemainingFrames: Math.max(
          0,
          msToFrame(
            Math.max(0, (Number(row.decayRemainingMs) || 0) - prefixGapMs)
          )
        ),
        heldReadyRemainingFrames: Math.max(
          0,
          msToFrame(
            Math.max(
              0,
              (Number(row.heldReadyRemainingMs) || 0) - prefixGapMs
            )
          )
        ),
      }))
      .filter(
        row =>
          row.markId != null &&
          (row.stacks > 0 ||
            row.decayRemainingFrames > 0 ||
            row.heldReadyRemainingFrames > 0)
      )
      .sort(compareCanonicalRows);
  }
  const specialState = verifiedRuntime.specialResourceRuntime?.finalState;
  if (Array.isArray(specialState)) {
    snapshot.specialResources = specialState
      .map(row => ({
        actorId: row.actorId ?? null,
        resourceIdentity: row.resourceIdentity ?? null,
        currentValue: Number(row.currentValue) || 0,
        maxValue: Number(row.maxValue) || 0,
        activeStates: (row.activeStates ?? [])
          .map(state => ({
            stateElementId: state.elementId ?? null,
            stateName: state.name ?? null,
            remainingFrames:
              state.expiresAtMs == null
                ? null
                : Math.max(
                    0,
                    msToFrame(Number(state.expiresAtMs) - boundaryTimeMs)
                  ),
            sourceIdentityHash: hashCanonicalValue(
              state.sourceIdentity ?? null
            ),
          }))
          .filter(
            state =>
              state.stateElementId != null && state.remainingFrames !== 0
          )
          .sort(compareCanonicalRows),
      }))
      .filter(row => row.resourceIdentity)
      .sort(compareCanonicalRows);
  }
  const targetState =
    verifiedRuntime.actionVariantRuntime?.targetStateRuntime?.finalState;
  if (Array.isArray(targetState)) {
    snapshot.targetStates = targetState
      .map(row => {
        const layers = (row.layers ?? [])
          .map(layer => ({
            remainingFrames: Math.max(
              0,
              msToFrame(Number(layer.expiresAtMs) - boundaryTimeMs)
            ),
            sourceIdentityHash: hashCanonicalValue(
              layer.sourceIdentity ?? null
            ),
          }))
          .filter(layer => layer.remainingFrames > 0)
          .sort(compareCanonicalRows);
        return {
          stateIdentity: row.stateIdentity ?? null,
          targetKind: row.targetKind ?? null,
          currentValue: layers.length,
          maxValue: Number(row.maxValue) || 0,
          layers,
        };
      })
      .filter(row => row.stateIdentity && row.layers.length > 0)
      .sort(compareCanonicalRows);
  }
  const finalState = verifiedRuntime.finalState ?? {};
  const cooldownWindows =
    boundaryRun.simulation?.readinessTimeline?.cooldownWindows;
  if (Array.isArray(cooldownWindows)) {
    snapshot.cooldowns = cooldownWindows
      .map(row => ({
        runtimeOwnerIdentity: row.runtimeOwnerIdentity ?? null,
        ownerId: row.ownerId ?? null,
        skillId: row.skillId ?? null,
        chargeIndex: integerOrNull(row.chargeIndex),
        cooldownCount: integerOrNull(row.cooldownCount),
        endMs: Number(row.endMs) || 0,
        status: row.status ?? null,
      }))
      .filter(row => row.endMs > boundaryTimeMs)
      .sort(compareCanonicalRows);
  }
  snapshot.actorVitals = (finalState.actorVitals ?? [])
    .map(projectFriendlyVitalState)
    .sort(compareCanonicalRows);
  snapshot.kiboVitals = (finalState.kiboVitals ?? [])
    .map(projectFriendlyVitalState)
    .sort(compareCanonicalRows);
  snapshot.enemy = {
    ...(snapshot.enemy ?? {}),
    valueShields: structuredClone(finalState.enemy?.valueShields ?? []),
    hitCountShields: structuredClone(finalState.enemy?.hitCountShields ?? []),
  };
  snapshot.effects = (boundaryRun.trace?.effects?.intervals ?? [])
    .filter(
      row =>
        Number(row.startMs) <= boundaryTimeMs &&
        Number(row.endMs) > boundaryTimeMs
    )
    .map(row => ({
      effectId: row.effectId ?? null,
      ownerId: row.ownerId ?? null,
      targetKind: row.targetKind ?? null,
      targetId: row.targetId ?? null,
      stacks: Number(row.stacks) || 0,
      remainingFrames: Math.max(
        0,
        msToFrame(Number(row.endMs) - boundaryTimeMs)
      ),
      sourceIdentityHash: hashCanonicalValue(row.sourceIdentity ?? null),
    }))
    .filter(row => row.effectId && row.remainingFrames > 0)
    .sort(compareCanonicalRows);
  return snapshot;
}

function projectFriendlyVitalState(row) {
  return {
    actorId: row.actorId ?? null,
    slotId: row.slotId ?? null,
    kiboId: row.kiboId ?? null,
    currentHp: Number(row.currentHp) || 0,
    maximumHp: Number(row.maximumHp) || 0,
    valueShields: structuredClone(row.valueShields ?? []),
    hitCountShields: structuredClone(row.hitCountShields ?? []),
  };
}

function normalizeCooldownState(snapshot) {
  const timeMs = Number(snapshot.timeMs) || 0;
  return (snapshot.cooldowns ?? [])
    .map(row => ({
      runtimeOwnerIdentity: row.runtimeOwnerIdentity ?? null,
      ownerId: row.ownerId ?? null,
      skillId: row.skillId ?? null,
      chargeIndex: integerOrNull(row.chargeIndex),
      cooldownCount: integerOrNull(row.cooldownCount),
      remainingFrames: Math.max(0, msToFrame(Number(row.endMs) - timeMs)),
      status: row.status ?? null,
    }))
    .filter(row => row.remainingFrames > 0)
    .sort(compareCanonicalRows);
}

function normalizeEffectState(snapshot) {
  const timeMs = Number(snapshot.timeMs) || 0;
  return (snapshot.effects ?? [])
    .map(row => ({
      effectId: row.effectId ?? null,
      ownerId: row.ownerId ?? null,
      targetKind: row.targetKind ?? null,
      targetId: row.targetId ?? null,
      stacks: Number(row.stacks) || 0,
      remainingFrames:
        integerOrNull(row.remainingFrames) ??
        Math.max(0, msToFrame(Number(row.endMs) - timeMs)),
      sourceIdentityHash: row.sourceIdentityHash ?? null,
    }))
    .filter(row => row.remainingFrames > 0)
    .sort(compareCanonicalRows);
}

function normalizeTargetState(snapshot) {
  return (snapshot.targetStates ?? [])
    .map(row => ({
      stateIdentity: row.stateIdentity ?? null,
      targetKind: row.targetKind ?? null,
      currentValue: Number(row.currentValue) || 0,
      maxValue: Number(row.maxValue) || 0,
      layers: (row.layers ?? [])
        .map(layer => ({
          remainingFrames: Math.max(
            0,
            Number(layer.remainingFrames) || 0
          ),
          sourceIdentityHash: layer.sourceIdentityHash ?? null,
        }))
        .filter(layer => layer.remainingFrames > 0)
        .sort(compareCanonicalRows),
    }))
    .filter(row => row.stateIdentity && row.layers.length > 0)
    .sort(compareCanonicalRows);
}

function normalizeSpecialState(snapshot) {
  return (snapshot.specialResources ?? [])
    .flatMap(resource =>
      (resource.activeStates ?? []).map(state => ({
        resourceIdentity: resource.resourceIdentity ?? null,
        stateElementId: state.stateElementId ?? state.elementId ?? null,
        remainingFrames: integerOrNull(state.remainingFrames),
        sourceIdentityHash: state.sourceIdentityHash ?? null,
      }))
    )
    .filter(row => row.stateElementId != null && row.remainingFrames !== 0)
    .sort(compareCanonicalRows);
}

function normalizeShieldState(snapshot) {
  const rows = [];
  const append = (ownerIdentity, valueShields, hitCountShields) => {
    if (!(valueShields?.length || hitCountShields?.length)) return;
    rows.push({
      ownerIdentity,
      valueShields: valueShields ?? [],
      hitCountShields: hitCountShields ?? [],
    });
  };
  append(
    'enemy',
    snapshot.enemy?.valueShields,
    snapshot.enemy?.hitCountShields
  );
  for (const row of snapshot.actorVitals ?? []) {
    append(
      `actor:${stripActorPrefix(row.actorId)}`,
      row.valueShields,
      row.hitCountShields
    );
  }
  for (const row of snapshot.kiboVitals ?? []) {
    append(
      `kibo:${String(row.slotId ?? '')}:${String(row.kiboId ?? '')}`,
      row.valueShields,
      row.hitCountShields
    );
  }
  return rows.sort(compareCanonicalRows);
}

function normalizePendingState(snapshot) {
  const currentFrame = Number(snapshot.currentFrame) || 0;
  return (snapshot.pendingEvents ?? [])
    .map(row => ({
      kind: row.kind ?? null,
      identity: row.identity ?? null,
      phase: row.phase ?? null,
      relativeFrame: Math.max(0, Number(row.frame) - currentFrame),
    }))
    .sort(compareCanonicalRows);
}

function addContribution(map, identity, input) {
  const current = map.get(identity) ?? {
    ...input,
    hpDamage: 0,
    combatHitCount: 0,
  };
  current.hpDamage += Number(input.hpDamage) || 0;
  current.combatHitCount += Number(input.combatHitCount) || 0;
  if (input.firstFrame != null) {
    current.firstFrame =
      current.firstFrame == null
        ? input.firstFrame
        : Math.min(current.firstFrame, input.firstFrame);
    current.lastFrame =
      current.lastFrame == null
        ? input.lastFrame
        : Math.max(current.lastFrame, input.lastFrame);
  }
  map.set(identity, current);
}

function finalizeContributions(map) {
  return [...map.values()]
    .map(row => ({
      ...row,
      hpDamage: roundMetric(row.hpDamage),
    }))
    .sort((left, right) => left.identity.localeCompare(right.identity, 'en'));
}

function createUniqueCycleActionId(sourceId, existingIds, index) {
  const base = `cycle-2:${String(sourceId)}`;
  if (!existingIds.has(base)) return base;
  let suffix = index + 1;
  while (existingIds.has(`${base}:${suffix}`)) suffix += 1;
  return `${base}:${suffix}`;
}

function attachActionResolutions(run, actionResolutions) {
  return { ...run, actionResolutions: actionResolutions ?? [] };
}

function resolveDamageFrame(event, fps) {
  const absoluteFrame = integerOrNull(event?.absoluteFrame);
  if (absoluteFrame != null) return absoluteFrame;
  const frameIndex = integerOrNull(event?.frameIndex);
  if (frameIndex != null) return frameIndex;
  const timeMs = finiteNumberOrNull(event?.timeMs);
  return timeMs == null ? null : Math.round((timeMs * fps) / 1000);
}

function normalizeErrorIssues(error) {
  if (Array.isArray(error?.issues)) return error.issues;
  return [
    cycleIssue(
      'machine-axis-cycle-runtime-failed',
      '',
      error?.message ?? String(error)
    ),
  ];
}

function dedupeIssues(issues) {
  const byIdentity = new Map();
  for (const issue of issues ?? []) {
    const key = `${issue.code ?? ''}|${issue.path ?? ''}|${issue.actionId ?? ''}|${issue.resourceIdentity ?? ''}|${issue.message ?? ''}`;
    if (!byIdentity.has(key)) byIdentity.set(key, issue);
  }
  return [...byIdentity.values()];
}

function cycleIssue(code, path, message, details = {}) {
  return createMachineAxisDiagnostic(code, path, message, details);
}

function normalizeSeeds(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(seed => (seed == null ? null : String(seed)))
    .filter(seed => seed != null && seed.length > 0);
}

function mean(values) {
  if (!values.length) return 0;
  return (
    values.reduce((sum, value) => sum + (Number(value) || 0), 0) / values.length
  );
}

function compareCanonicalRows(left, right) {
  return JSON.stringify(left).localeCompare(JSON.stringify(right), 'en');
}

function stripActorPrefix(value) {
  return String(value ?? '').replace(/^actor-/, '');
}

function roundMetric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(8)) : 0;
}

function finiteNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function integerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function textOrNull(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
