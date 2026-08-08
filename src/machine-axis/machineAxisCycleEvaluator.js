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
import {
  normalizeEffectModifiers,
  projectActiveEffectStates,
} from './machineAxisEffectState';
import { createMachineAxisHealingStatistics } from './machineAxisHealingStatistics';
import {
  MACHINE_AXIS_DEFAULT_PRIMARY_OBJECTIVE,
  createMachineAxisObjectiveContract,
  validateMachineAxisObjectiveContract,
} from './machineAxisObjectiveContract';
import {
  getMachineAxisEnemySettlementContract,
  getMachineAxisEnemySettlementFormalReadiness,
} from './machineAxisEnemySettlementContract';

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
const CYCLE_SAMPLE_QUANTILES = [0.05, 0.25, 0.5, 0.75, 0.95];

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
      objective:
        textOrNull(options.objective) ?? MACHINE_AXIS_DEFAULT_PRIMARY_OBJECTIVE,
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
      if (!['objective', 'criticalPolicy', 'seeds'].includes(key)) {
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
  const objective =
    source.options?.objective ?? MACHINE_AXIS_DEFAULT_PRIMARY_OBJECTIVE;
  if (
    !['cycle-dps-no-toughness', 'cycle-dps-with-toughness'].includes(objective)
  ) {
    issues.push(
      cycleIssue(
        'machine-axis-cycle-objective-invalid',
        'options.objective',
        `Cycle evaluator does not support objective: ${objective}`
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
    const objectiveContract =
      runtimeOptions.objectiveContract ??
      createMachineAxisObjectiveContract(normalized.options.objective);
    const objectiveValidation =
      validateMachineAxisObjectiveContract(objectiveContract);
    if (
      !objectiveValidation.valid ||
      objectiveValidation.contract.objectiveId !== normalized.options.objective
    ) {
      return createRejectedReport({
        envelope: normalized,
        issues: [
          ...objectiveValidation.issues.map(entry =>
            cycleIssue(
              entry.code,
              `objectiveContract${entry.field ? `.${entry.field}` : ''}`,
              entry.message
            )
          ),
          ...(objectiveValidation.valid &&
          objectiveValidation.contract.objectiveId !==
            normalized.options.objective
            ? [
                cycleIssue(
                  'machine-axis-cycle-objective-contract-mismatch',
                  'objectiveContract.objectiveId',
                  'Cycle objective does not match the supplied objective contract'
                ),
              ]
            : []),
        ],
        objectiveContract,
      });
    }
    const settlementContract = getMachineAxisEnemySettlementContract();
    const settlementReadiness = getMachineAxisEnemySettlementFormalReadiness();
    if (
      normalized.options.objective === 'cycle-dps-with-toughness' &&
      settlementReadiness.formalReady !== true &&
      runtimeOptions.allowUnverifiedRuntimeTiming !== true
    ) {
      return createRejectedReport({
        envelope: normalized,
        issues: settlementReadiness.issues.map(entry =>
          cycleIssue(entry.code, entry.path, entry.message, {
            contractId: entry.contractId,
            contractHash: entry.contractHash,
          })
        ),
        objectiveContract: objectiveValidation.contract,
        settlementContract,
      });
    }
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
        objectiveContract: objectiveValidation.contract,
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
        objectiveContract: objectiveValidation.contract,
        settlementContract:
          normalized.options.objective === 'cycle-dps-with-toughness'
            ? settlementContract
            : null,
      });
    }
    return createAcceptedReport({
      envelope: normalized,
      criticalPolicy,
      seeds,
      samples,
      objectiveContract: objectiveValidation.contract,
      settlementContract:
        normalized.options.objective === 'cycle-dps-with-toughness'
          ? settlementContract
          : null,
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
  const enemySettlementPackets = [];
  const enemyStateTransitions = [];
  let hpDamage = 0;
  let combatHitCount = 0;
  for (const event of damageEvents ?? []) {
    const frame = resolveDamageFrame(event, fps);
    if (
      event?.stateEventKind &&
      frame != null &&
      frame >= normalizedStart &&
      frame < normalizedEnd
    ) {
      enemyStateTransitions.push({
        stateEventKind: event.stateEventKind,
        absoluteFrame: frame,
        timeMs: finiteNumberOrNull(event.timeMs),
        runtimePhasePriority: finiteNumberOrNull(event.runtimePhasePriority),
        runtimePriority: finiteNumberOrNull(event.runtimePriority),
        runtimeSequenceIndex: finiteNumberOrNull(event.runtimeSequenceIndex),
        toughnessDamage: finiteNumberOrNull(event.toughnessDamage) ?? 0,
        weaknessResult: event.formula?.weaknessResult ?? null,
      });
      continue;
    }
    if (event?.stateEventKind) continue;
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
    enemySettlementPackets.push({
      absoluteFrame: frame,
      timeMs: finiteNumberOrNull(event.timeMs),
      runtimePhasePriority: finiteNumberOrNull(event.runtimePhasePriority),
      runtimePriority: finiteNumberOrNull(event.runtimePriority),
      runtimeSequenceIndex: finiteNumberOrNull(event.runtimeSequenceIndex),
      actionId,
      actorId,
      hitIdentity,
      preDefenseHpDamage: finiteNumberOrNull(
        event.formula?.verifiedResult?.preDefenseValue
      ),
      requestedHpDamage: finiteNumberOrNull(event.requestedHpDamage),
      effectiveHpDamage: finiteNumberOrNull(event.effectiveHpDamage) ?? damage,
      overkill: finiteNumberOrNull(event.overkill) ?? 0,
      inBreakForHpDamage: event.inBreakForHpDamage === true,
      hpDamageMultiplier: finiteNumberOrNull(event.hpDamageMultiplier),
      toughnessBefore: finiteNumberOrNull(event.toughnessBefore),
      toughnessAfter: finiteNumberOrNull(event.toughnessAfter),
      toughnessDamage: finiteNumberOrNull(event.toughnessDamage) ?? 0,
      breakTriggered: event.breakTriggered === true,
      deathTriggered: event.deathTriggered === true,
      ...(Array.isArray(event.settlementOrder)
        ? { settlementOrder: [...event.settlementOrder] }
        : {}),
    });
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
    enemySettlementPackets,
    enemyStateTransitions,
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
    ['chargeCooldowns', normalizeChargeCooldownState],
    ['effects', normalizeEffectState],
    ['kiboPassiveRuntime', normalizeKiboPassiveRuntimeState],
    ['targetStates', normalizeTargetState],
    ['specialStates', normalizeSpecialState],
    ['enemy', normalizeEnemyBoundaryState],
    ['shields', normalizeShieldState],
    ['pendingEvents', normalizePendingState],
  ];
  const soulTriggerDimensions = [];
  if (
    (startSnapshot.soulTriggerIntervals?.length ?? 0) > 0 ||
    (endSnapshot.soulTriggerIntervals?.length ?? 0) > 0
  ) {
    soulTriggerDimensions.push([
      'soulTriggerIntervals',
      normalizeSoulTriggerIntervalState,
    ]);
  }
  if (
    (startSnapshot.soulTriggerCounters?.length ?? 0) > 0 ||
    (endSnapshot.soulTriggerCounters?.length ?? 0) > 0
  ) {
    soulTriggerDimensions.push([
      'soulTriggerCounters',
      normalizeSoulTriggerCounterState,
    ]);
  }
  if (
    (startSnapshot.soulPeriodicRoots?.length ?? 0) > 0 ||
    (endSnapshot.soulPeriodicRoots?.length ?? 0) > 0
  ) {
    soulTriggerDimensions.push([
      'soulPeriodicRoots',
      normalizeSoulPeriodicRootState,
    ]);
  }
  stateDimensions.splice(2, 0, ...soulTriggerDimensions);
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
  damageStabilityMode = 'exact-consecutive-cycle-damage',
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
    damageStabilityMode,
    randomDamageVariation: {
      independentlySampledCycleDamageMayDiffer:
        damageStabilityMode === 'cycle-local-common-random-numbers',
      stateAndWarmupClosureStillRequired: true,
    },
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
  objectiveContract,
}) {
  const firstContract = createCycleScenarioContract(
    envelope.contract,
    criticalPolicy,
    seed,
    objectiveContract
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

  const sampledFirstCycle = attachCycleHealing(
    collectCycleDamageContributions(firstPrepared.run.trace.damage, {
      startFrame: envelope.loop.startFrame,
      endFrame: envelope.loop.endFrame,
      fps: firstContract.scenario.fps,
    }),
    firstPrepared.run,
    {
      startFrame: envelope.loop.startFrame,
      endFrame: envelope.loop.endFrame,
      fps: firstContract.scenario.fps,
    }
  );
  const commonRandomPlan =
    criticalPolicy === 'sampled'
      ? createCycleCommonRandomReplayPlan({
          loopPlan,
          sourceTrace: firstPrepared.run.trace,
          loop: envelope.loop,
          fps: firstContract.scenario.fps,
        })
      : null;
  if (commonRandomPlan && !commonRandomPlan.valid) {
    return rejectedSample(seed, commonRandomPlan.issues);
  }
  const replayContract = commonRandomPlan?.contract ?? loopPlan.contract;

  let replayPrepared;
  try {
    replayPrepared = prepareRun(replayContract, runtimeOptions);
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
      replayContract,
      simulateBoundary,
      runtimeOptions,
    });
    firstEndSnapshot = createBoundarySnapshot({
      frame: envelope.loop.endFrame,
      prepared: replayPrepared,
      replayRun,
      replayContract,
      simulateBoundary,
      runtimeOptions,
    });
    secondEndSnapshot = createBoundarySnapshot({
      frame: secondEndFrame,
      prepared: replayPrepared,
      replayRun,
      replayContract,
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
  const proofFirstCycle = attachCycleHealing(
    collectCycleDamageContributions(replayPrepared.run.trace.damage, {
      startFrame: envelope.loop.startFrame,
      endFrame: envelope.loop.endFrame,
      fps: firstContract.scenario.fps,
    }),
    replayPrepared.run,
    {
      startFrame: envelope.loop.startFrame,
      endFrame: envelope.loop.endFrame,
      fps: firstContract.scenario.fps,
    }
  );
  const secondCycle = attachCycleHealing(
    collectCycleDamageContributions(replayPrepared.run.trace.damage, {
      startFrame: envelope.loop.endFrame,
      endFrame: secondEndFrame,
      fps: firstContract.scenario.fps,
      actionIdMap: loopPlan.secondToSourceActionId,
    }),
    replayPrepared.run,
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
    firstCycle: proofFirstCycle,
    secondCycle,
    firstClosure,
    secondClosure,
    secondExecution,
    damageStabilityMode:
      criticalPolicy === 'sampled'
        ? 'cycle-local-common-random-numbers'
        : 'exact-consecutive-cycle-damage',
  });
  if (!replayProof.stable)
    return rejectedSample(seed, replayProof.issues, {
      replayProof,
      firstCycle: sampledFirstCycle,
      secondCycle,
      hashes:
        criticalPolicy === 'sampled'
          ? firstPrepared.run.hashes
          : replayPrepared.run.hashes,
      proofHashes: replayPrepared.run.hashes,
    });
  return {
    valid: true,
    status: 'closed',
    seed,
    hashes:
      criticalPolicy === 'sampled'
        ? firstPrepared.run.hashes
        : replayPrepared.run.hashes,
    proofHashes: replayPrepared.run.hashes,
    firstCycle:
      criticalPolicy === 'sampled' ? sampledFirstCycle : proofFirstCycle,
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
      commonRandomRollCount: commonRandomPlan?.rollCount ?? 0,
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

function createCycleCommonRandomReplayPlan({
  loopPlan,
  sourceTrace,
  loop,
  fps,
}) {
  const rollsByActionId = new Map();
  const issues = [];
  for (const event of sourceTrace?.damage ?? []) {
    if (event?.stateEventKind) continue;
    const frame = resolveDamageFrame(event, fps);
    if (frame == null || frame < loop.startFrame || frame >= loop.endFrame) {
      continue;
    }
    const randomBranch = event.formula?.randomBranch ?? null;
    if (randomBranch?.policy !== 'seeded-sampled') continue;
    const actionId = textOrNull(event.actionId);
    const hitIdentity = textOrNull(randomBranch.hitIdentity);
    const criticalRoll = integerOrNull(randomBranch.criticalRoll);
    if (
      !actionId ||
      !hitIdentity ||
      criticalRoll == null ||
      criticalRoll < 0 ||
      criticalRoll >= 10_000
    ) {
      issues.push(
        cycleIssue(
          'machine-axis-cycle-common-random-roll-unresolved',
          'replayProof.random',
          'A sampled combat hit cannot be paired across cycle-local replay',
          {
            actionId,
            hitIdentity,
            criticalRoll,
            frame,
          }
        )
      );
      continue;
    }
    const byHit = rollsByActionId.get(actionId) ?? new Map();
    if (byHit.has(hitIdentity) && byHit.get(hitIdentity) !== criticalRoll) {
      issues.push(
        cycleIssue(
          'machine-axis-cycle-common-random-hit-identity-ambiguous',
          `actions.${actionId}.hitOverrides.${hitIdentity}`,
          'One stable hit identity consumed multiple sampled rolls in the same cycle',
          {
            actionId,
            hitIdentity,
            firstRoll: byHit.get(hitIdentity),
            conflictingRoll: criticalRoll,
          }
        )
      );
      continue;
    }
    byHit.set(hitIdentity, criticalRoll);
    rollsByActionId.set(actionId, byHit);
  }
  if (issues.length > 0) return { valid: false, issues };

  const contract = structuredClone(loopPlan.contract);
  let rollCount = 0;
  contract.actions = (contract.actions ?? []).map(action => {
    const sourceActionId =
      loopPlan.secondToSourceActionId.get(String(action.id)) ??
      String(action.id);
    const rolls = rollsByActionId.get(sourceActionId);
    if (!rolls?.size) return action;
    const hitOverrides = { ...(action.hitOverrides ?? {}) };
    for (const [hitIdentity, criticalRoll] of rolls) {
      hitOverrides[hitIdentity] = {
        ...(hitOverrides[hitIdentity] ?? {}),
        criticalMode: 'sampled',
        criticalRoll,
      };
      rollCount += 1;
    }
    return { ...action, hitOverrides };
  });
  contract.metadata = {
    ...(contract.metadata ?? {}),
    cycleReplay: {
      ...(contract.metadata?.cycleReplay ?? {}),
      damageStabilityMode: 'cycle-local-common-random-numbers',
      capturedRollCount: rollCount,
    },
  };
  return { valid: true, issues: [], contract, rollCount };
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

function createCycleScenarioContract(
  contract,
  criticalPolicy,
  seed,
  objectiveContract
) {
  const value = structuredClone(contract);
  value.scenario.critical = {
    policy: criticalPolicy,
    seed: criticalPolicy === 'sampled' ? seed : null,
  };
  value.scenario.objectiveContract = structuredClone(objectiveContract);
  value.scenario.target = structuredClone(objectiveContract.targetPolicy);
  return value;
}

function createAcceptedReport({
  envelope,
  criticalPolicy,
  seeds,
  samples,
  objectiveContract,
  settlementContract,
}) {
  const fps = Number(envelope.contract.scenario.fps) || 60;
  const durationFrames = envelope.loop.endFrame - envelope.loop.startFrame;
  const aggregate = aggregateSamples(samples);
  const sampleStatistics = createCycleSampleStatistics({
    samples,
    durationSeconds: durationFrames / fps,
    aggregate,
  });
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
    objectiveContract,
    enemySettlementTiming: settlementContract,
    assumptions: createCycleAssumptions(objectiveContract),
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
      healing: aggregate.healing,
    },
    formalScore:
      settlementContract?.evidence?.formalReady === false
        ? null
        : roundMetric(
            aggregate.hpDamage / Math.max(VALUE_TOLERANCE, durationFrames / fps)
          ),
    formalStatus:
      settlementContract?.evidence?.formalReady === false
        ? 'blocked-runtime-semantics-evidence-open'
        : 'formal-score-ready',
    sampleStatistics,
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
  value.hashes.build = hashCanonicalValue({
    objectiveContract,
    optimizationScenarioPolicy:
      envelope.contract.scenario?.optimizationScenarioPolicy ?? null,
    enemyProfile: envelope.contract.scenario?.enemy?.profile ?? null,
    inputHash: value.hashes.input,
    dataHash: value.hashes.data,
    traceHash: value.hashes.trace,
  });
  value.hashes.cycle = hashCanonicalValue({
    objectiveContract: value.objectiveContract,
    enemySettlementTiming: value.enemySettlementTiming,
    assumptions: value.assumptions,
    critical: value.critical,
    loop: value.loop,
    metrics: value.metrics,
    sampleStatistics: value.sampleStatistics,
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
  objectiveContract = null,
  settlementContract = null,
}) {
  return {
    schemaVersion: MACHINE_AXIS_CYCLE_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_CYCLE_CONTRACT_NAME,
    kind: 'azpr-machine-axis-cycle-dps-evaluation',
    valid: false,
    status: 'rejected',
    issues: dedupeIssues(issues ?? []),
    warnings: [],
    objectiveContract,
    enemySettlementTiming: settlementContract,
    assumptions: createCycleAssumptions(objectiveContract),
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
      build: null,
      cycle: null,
    },
  };
}

function createCycleAssumptions(objectiveContract) {
  const target = objectiveContract?.targetPolicy;
  if (!target) return DEFAULT_CYCLE_ASSUMPTIONS;
  return {
    enemyHp: target.hpMode,
    toughness: target.toughnessMode,
    break: target.breakMode,
    deathTruncation: target.deathTruncation,
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
    healingBySourceActor: aggregateHealingContributionDimension(
      samples,
      'bySourceActor'
    ),
    healingBySourceAction: aggregateHealingContributionDimension(
      samples,
      'bySourceAction'
    ),
  };
  for (const rows of [
    contributions.byActor,
    contributions.byAction,
    contributions.byHit,
  ]) {
    reconcileContributionTotal(rows, roundedHpDamage);
  }
  const healing = {
    requestedHealing: roundMetric(
      mean(samples.map(sample => sample.firstCycle.healing?.requestedHealing))
    ),
    effectiveHealing: roundMetric(
      mean(samples.map(sample => sample.firstCycle.healing?.effectiveHealing))
    ),
    overhealing: roundMetric(
      mean(samples.map(sample => sample.firstCycle.healing?.overhealing))
    ),
    effectiveHps: roundMetric(
      mean(samples.map(sample => sample.firstCycle.healing?.effectiveHps))
    ),
    settlementCount: roundMetric(
      mean(samples.map(sample => sample.firstCycle.healing?.settlementCount))
    ),
  };
  return {
    hpDamage: roundedHpDamage,
    combatHitCount: roundMetric(combatHitCount),
    contributions,
    healing,
  };
}

function createCycleSampleStatistics({ samples, durationSeconds, aggregate }) {
  const loopHpDamage = describeCycleSampleValues(
    samples.map(sample => Number(sample.firstCycle?.hpDamage) || 0)
  );
  const cycleDps = describeCycleSampleValues(
    samples.map(
      sample =>
        (Number(sample.firstCycle?.hpDamage) || 0) /
        Math.max(VALUE_TOLERANCE, durationSeconds)
    )
  );
  const contributionConservation = Object.fromEntries(
    ['byActor', 'byAction', 'byHit'].map(dimension => {
      const rows = aggregate.contributions[dimension] ?? [];
      const contributionMean = roundMetric(
        rows.reduce((sum, row) => sum + (Number(row.hpDamage) || 0), 0)
      );
      const difference = roundMetric(contributionMean - loopHpDamage.mean);
      return [
        dimension,
        {
          sampleMean: loopHpDamage.mean,
          contributionMean,
          difference,
          conserved: Math.abs(difference) <= VALUE_TOLERANCE,
        },
      ];
    })
  );
  const healingContributionConservation = Object.fromEntries(
    ['healingBySourceActor', 'healingBySourceAction'].map(dimension => {
      const rows = aggregate.contributions[dimension] ?? [];
      const contributionMean = roundMetric(
        rows.reduce((sum, row) => sum + (Number(row.effectiveHealing) || 0), 0)
      );
      const sampleMean = aggregate.healing.effectiveHealing;
      const difference = roundMetric(contributionMean - sampleMean);
      return [
        dimension,
        {
          sampleMean,
          contributionMean,
          difference,
          conserved: Math.abs(difference) <= VALUE_TOLERANCE,
        },
      ];
    })
  );
  return {
    sampleCount: samples.length,
    loopHpDamage,
    cycleDps,
    healing: {
      requestedHealing: describeCycleSampleValues(
        samples.map(sample => sample.firstCycle.healing?.requestedHealing ?? 0)
      ),
      effectiveHealing: describeCycleSampleValues(
        samples.map(sample => sample.firstCycle.healing?.effectiveHealing ?? 0)
      ),
      overhealing: describeCycleSampleValues(
        samples.map(sample => sample.firstCycle.healing?.overhealing ?? 0)
      ),
      effectiveHps: describeCycleSampleValues(
        samples.map(sample => sample.firstCycle.healing?.effectiveHps ?? 0)
      ),
    },
    contributionConservation,
    healingContributionConservation,
  };
}

function describeCycleSampleValues(values) {
  if (!values.length) {
    return {
      count: 0,
      mean: 0,
      variance: 0,
      min: 0,
      max: 0,
      quantiles: Object.fromEntries(
        CYCLE_SAMPLE_QUANTILES.map(quantile => [
          `p${Math.round(quantile * 100)}`,
          0,
        ])
      ),
    };
  }
  const sorted = [...values].sort((left, right) => left - right);
  const meanValue = mean(sorted);
  const variance =
    sorted.length > 1
      ? sorted.reduce((sum, value) => sum + (value - meanValue) ** 2, 0) /
        (sorted.length - 1)
      : 0;
  return {
    count: sorted.length,
    mean: roundMetric(meanValue),
    variance: roundMetric(variance),
    min: roundMetric(sorted[0]),
    max: roundMetric(sorted.at(-1)),
    quantiles: Object.fromEntries(
      CYCLE_SAMPLE_QUANTILES.map(quantile => [
        `p${Math.round(quantile * 100)}`,
        roundMetric(calculateCycleQuantile(sorted, quantile)),
      ])
    ),
  };
}

function calculateCycleQuantile(sorted, quantile) {
  if (sorted.length === 1) return sorted[0];
  const position = quantile * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
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

function aggregateHealingContributionDimension(samples, key) {
  const byIdentity = new Map();
  for (const sample of samples) {
    for (const row of sample.firstCycle.healing?.[key] ?? []) {
      const identity = String(row.identity ?? 'unattributed');
      const aggregate = byIdentity.get(identity) ?? {
        ...row,
        requestedHealing: 0,
        effectiveHealing: 0,
        overhealing: 0,
        effectiveHps: 0,
        settlementCount: 0,
      };
      for (const field of [
        'requestedHealing',
        'effectiveHealing',
        'overhealing',
        'effectiveHps',
        'settlementCount',
      ]) {
        aggregate[field] += Number(row[field]) || 0;
      }
      byIdentity.set(identity, aggregate);
    }
  }
  return [...byIdentity.values()]
    .map(row => ({
      ...row,
      requestedHealing: roundMetric(row.requestedHealing / samples.length),
      effectiveHealing: roundMetric(row.effectiveHealing / samples.length),
      overhealing: roundMetric(row.overhealing / samples.length),
      effectiveHps: roundMetric(row.effectiveHps / samples.length),
      settlementCount: roundMetric(row.settlementCount / samples.length),
      sampleCount: samples.length,
    }))
    .sort((left, right) => left.identity.localeCompare(right.identity, 'en'));
}

function attachCycleHealing(damage, run, options) {
  return {
    ...damage,
    healing: createMachineAxisHealingStatistics(
      run?.trace?.events ?? [],
      options
    ),
  };
}

function projectSampleReport(sample) {
  return {
    valid: sample.valid,
    status: sample.status,
    seed: sample.seed ?? null,
    issues: sample.issues ?? [],
    hashes: sample.hashes ?? null,
    proofHashes: sample.proofHashes ?? null,
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
      endRow.heldReadyRemainingFrames <= startRow.heldReadyRemainingFrames;
    const diff = {
      markIdentity,
      profileKey: endRow.profileKey ?? startRow.profileKey,
      markId: endRow.markId ?? startRow.markId,
      startStacks: startRow.stacks,
      endStacks: endRow.stacks,
      stackDelta,
      startDecayRemainingFrames: bothEmpty ? 0 : startRow.decayRemainingFrames,
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
    decayRemainingFrames: Math.max(0, Number(row.decayRemainingFrames) || 0),
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
  const boundaryTimeMs = Number(frame) * (1000 / (Number(snapshot.fps) || 60));
  const prefixTimeMs = Number(boundaryRun.trace?.scenario?.durationMs) || 0;
  const prefixGapMs = Math.max(0, boundaryTimeMs - prefixTimeMs);
  const soulTriggerOccurrences =
    boundaryRun.simulation?.verifiedSoulEssenceEffectGeneration
      ?.acceptedTriggerOccurrences;
  if (Array.isArray(soulTriggerOccurrences)) {
    const latestByBinding = new Map();
    for (const occurrence of soulTriggerOccurrences) {
      if (
        !occurrence?.bindingKey ||
        Number(occurrence.timeMs) > boundaryTimeMs
      ) {
        continue;
      }
      const current = latestByBinding.get(occurrence.bindingKey);
      if (
        !current ||
        Number(occurrence.timeMs) > Number(current.timeMs) ||
        (Number(occurrence.timeMs) === Number(current.timeMs) &&
          compareCanonicalRows(occurrence, current) > 0)
      ) {
        latestByBinding.set(occurrence.bindingKey, occurrence);
      }
    }
    snapshot.soulTriggerIntervals = [...latestByBinding.values()]
      .map(occurrence => ({
        bindingKey: occurrence.bindingKey,
        intervalMs: Number(occurrence.intervalMs) || 0,
        remainingFrames: Math.max(
          0,
          msToFrame(
            Number(occurrence.timeMs) +
              Number(occurrence.intervalMs) -
              boundaryTimeMs
          )
        ),
        sourceIdentityHash: hashCanonicalValue({
          bindingKey: occurrence.bindingKey,
          actorId: occurrence.actorId ?? null,
        }),
      }))
      .filter(row => row.remainingFrames > 0)
      .sort(compareCanonicalRows);
  }
  const soulTriggerCounterStates =
    boundaryRun.simulation?.verifiedSoulEssenceEffectGeneration
      ?.triggerCounterStates;
  if (Array.isArray(soulTriggerCounterStates)) {
    snapshot.soulTriggerCounters = soulTriggerCounterStates
      .map(row => ({
        bindingKey: row.bindingKey ?? null,
        triggerType: integerOrNull(row.triggerType),
        configuredTriggerCounter: integerOrNull(row.configuredTriggerCounter),
        triggerCounterLimit: integerOrNull(row.triggerCounterLimit),
        acceptedCount: Math.max(0, Number(row.acceptedCount) || 0),
        remainingTriggerCount: Math.max(
          0,
          Number(row.remainingTriggerCount) || 0
        ),
        exhausted: row.exhausted === true,
        sourceIdentityHash: hashCanonicalValue({
          bindingKey: row.bindingKey ?? null,
          triggerType: integerOrNull(row.triggerType),
          configuredTriggerCounter: integerOrNull(row.configuredTriggerCounter),
        }),
      }))
      .filter(row => row.bindingKey && row.triggerCounterLimit != null)
      .sort(compareCanonicalRows);
  }
  const soulPeriodicRootStates =
    boundaryRun.simulation?.verifiedSoulEssenceEffectGeneration
      ?.periodicRootStates;
  if (Array.isArray(soulPeriodicRootStates)) {
    snapshot.soulPeriodicRoots = soulPeriodicRootStates
      .map(row => {
        const intervalFrames = Math.max(1, Number(row.intervalFrames) || 0);
        const nextTickFrame = resolveNextPeriodicRootTickFrame({
          boundaryFrame: Number(frame),
          intervalFrames,
          timeExecuteFirstFrame: row.timeExecuteFirstFrame === true,
        });
        return {
          bindingKey: row.bindingKey ?? null,
          actorId: row.actorId ?? null,
          ownerIdentity: row.ownerIdentity ?? null,
          rootElementId: integerOrNull(row.rootElementId),
          intervalFrames,
          remainingFrames: Math.max(0, nextTickFrame - Number(frame)),
          sourceIdentityHash: hashCanonicalValue({
            bindingKey: row.bindingKey ?? null,
            sourceIdentity: row.sourceIdentity ?? null,
          }),
        };
      })
      .filter(row => row.bindingKey && row.remainingFrames > 0)
      .sort(compareCanonicalRows);
  }
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
            Math.max(0, (Number(row.heldReadyRemainingMs) || 0) - prefixGapMs)
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
  const kiboPassiveRuntimeStates =
    boundaryRun.simulation?.verifiedKiboPassiveGeneration?.runtimeStates;
  if (Array.isArray(kiboPassiveRuntimeStates)) {
    const projectedKiboPassiveRuntimeStates = kiboPassiveRuntimeStates
      .map(row => {
        const cooldownReadyAtMs = finiteNumberOrNull(row.cooldownReadyAtMs);
        return {
          stateIdentity: row.stateIdentity ?? null,
          passiveKey: row.passiveKey ?? null,
          actorId: row.actorId ?? null,
          slotId: row.slotId ?? null,
          kiboId: row.kiboId ?? null,
          skillId: row.skillId ?? null,
          internalCooldownRemainingFrames:
            cooldownReadyAtMs == null
              ? 0
              : Math.max(0, msToFrame(cooldownReadyAtMs - boundaryTimeMs)),
          triggerCount: Math.max(0, Number(row.triggerCount) || 0),
          configuredTriggerCounter: integerOrNull(row.configuredTriggerCounter),
          triggerLifetime: row.triggerLifetime ?? null,
          triggerLifetimeBasis: row.triggerLifetimeBasis ?? null,
          maxTriggerCount: integerOrNull(row.maxTriggerCount),
          remainingTriggerCount: integerOrNull(row.remainingTriggerCount),
          triggerLimitScope: row.triggerLimitScope ?? null,
          sourceIdentityHash: hashCanonicalValue(row.sourceIdentity ?? null),
        };
      })
      .filter(
        row =>
          row.stateIdentity &&
          (row.internalCooldownRemainingFrames > 0 ||
            row.remainingTriggerCount != null)
      )
      .sort(compareCanonicalRows);
    if (projectedKiboPassiveRuntimeStates.length > 0) {
      snapshot.kiboPassiveRuntime = projectedKiboPassiveRuntimeStates;
    }
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
            state => state.stateElementId != null && state.remainingFrames !== 0
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
    boundaryRun.simulation?.actionReadinessTimeline?.cooldownWindows;
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
        cooldownReductionTransactionIds: [
          ...(row.cooldownReductionTransactionIds ?? []),
        ].sort(),
      }))
      .filter(row => row.endMs > boundaryTimeMs)
      .sort(compareCanonicalRows);
  }
  const cooldownState =
    boundaryRun.simulation?.actionReadinessTimeline?.cooldownState;
  if (Array.isArray(cooldownState)) {
    snapshot.chargeCooldowns = cooldownState
      .filter(row => row.cooldownType === 'charge')
      .map(row =>
        projectChargeCooldownStateToBoundary({
          row,
          elapsedMs: prefixGapMs,
        })
      )
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
  snapshot.effects = projectActiveEffectStates({
    intervals: boundaryRun.trace?.effects?.intervals ?? [],
    effectEvents: boundaryRun.trace?.effects?.events ?? [],
    timeMs: boundaryTimeMs,
  })
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
      modifiers: row.modifiers,
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

function normalizeChargeCooldownState(snapshot) {
  return (snapshot.chargeCooldowns ?? [])
    .map(row => ({
      runtimeOwnerIdentity: row.runtimeOwnerIdentity ?? null,
      ownerId: row.ownerId ?? null,
      skillId: row.skillId ?? null,
      cooldownIdentity: row.cooldownIdentity ?? null,
      fullCooldownMs: Number(row.fullCooldownMs) || 0,
      chargeMaxCount: integerOrNull(row.chargeMaxCount),
      currentChargeCount: integerOrNull(row.currentChargeCount),
      remainingFrames:
        row.sharedTimerRunning === true
          ? Math.max(0, msToFrame(Number(row.coolTimeMs) || 0))
          : 0,
      sharedTimerRunning: row.sharedTimerRunning === true,
      lastSettlementIdentity: normalizeCycleLocalCooldownIdentity(
        row.lastSettlementIdentity
      ),
      lastCooldownReductionTransactionId: normalizeCycleLocalCooldownIdentity(
        row.lastCooldownReductionTransactionId
      ),
      missingChargeSourceActionIds: [
        ...(row.missingChargeSourceActionIds ?? []),
      ].map(normalizeCycleLocalCooldownIdentity),
    }))
    .sort(compareCanonicalRows);
}

function projectChargeCooldownStateToBoundary({ row, elapsedMs }) {
  const fullCooldownMs = Math.max(0, Number(row.fullCooldownMs) || 0);
  const chargeMaxCount = Math.max(0, integerOrNull(row.chargeMaxCount) ?? 0);
  let currentChargeCount = Math.max(
    0,
    Math.min(
      chargeMaxCount,
      integerOrNull(row.currentChargeCount) ?? chargeMaxCount
    )
  );
  let coolTimeMs = Math.max(0, Number(row.coolTimeMs) || 0);
  let sharedTimerRunning =
    row.sharedTimerRunning === true &&
    currentChargeCount < chargeMaxCount &&
    coolTimeMs > 0;
  let remainingElapsedMs = Math.max(0, Number(elapsedMs) || 0);
  const missingChargeSourceActionIds = [
    ...(row.missingChargeSourceActionIds ?? []),
  ];
  let lastSettlementIdentity = row.lastSettlementIdentity ?? null;

  while (
    sharedTimerRunning &&
    remainingElapsedMs + VALUE_TOLERANCE >= coolTimeMs
  ) {
    remainingElapsedMs = Math.max(0, remainingElapsedMs - coolTimeMs);
    currentChargeCount = Math.min(chargeMaxCount, currentChargeCount + 1);
    missingChargeSourceActionIds.shift();
    coolTimeMs = fullCooldownMs;
    lastSettlementIdentity = `cooldown-natural-recovery|${row.cooldownIdentity}`;
    sharedTimerRunning = currentChargeCount < chargeMaxCount;
  }
  if (sharedTimerRunning) {
    coolTimeMs = Math.max(0, coolTimeMs - remainingElapsedMs);
  }

  return {
    runtimeOwnerIdentity: row.runtimeOwnerIdentity ?? null,
    ownerId: row.ownerId ?? null,
    skillId: row.skillId ?? null,
    cooldownIdentity: row.cooldownIdentity ?? null,
    fullCooldownMs,
    chargeMaxCount,
    currentChargeCount,
    coolTimeMs,
    sharedTimerRunning,
    lastSettlementIdentity,
    lastCooldownReductionTransactionId:
      row.lastCooldownReductionTransactionId ?? null,
    missingChargeSourceActionIds,
  };
}

function normalizeCycleLocalCooldownIdentity(value) {
  return value == null ? null : String(value).replace(/cycle-\d+:/g, '');
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
      modifiers: normalizeEffectModifiers(row.modifiers),
    }))
    .filter(row => row.remainingFrames > 0)
    .sort(compareCanonicalRows);
}

function normalizeEnemyBoundaryState(snapshot) {
  const enemy = snapshot.enemy ?? {};
  return {
    hp: Number(enemy.hp) || 0,
    maxHp: Number(enemy.maxHp) || 0,
    toughness: Number(enemy.toughness) || 0,
    maxToughness: Number(enemy.maxToughness) || 0,
    inBreak: enemy.inBreak === true,
    breakPhase:
      enemy.breakPhase ?? (enemy.inBreak ? 'linear_recovery' : 'normal'),
    breakElapsedMs: Math.max(0, Number(enemy.breakElapsedMs) || 0),
    recoveryDelayRemainingMs: Math.max(
      0,
      Number(enemy.recoveryDelayRemainingMs) || 0
    ),
    defeated: enemy.defeated === true || Number(enemy.hp) <= 0,
    profileSourceIdentity: enemy.profileSourceIdentity ?? null,
  };
}

function normalizeSoulTriggerIntervalState(snapshot) {
  return (snapshot.soulTriggerIntervals ?? [])
    .map(row => ({
      bindingKey: row.bindingKey ?? null,
      intervalMs: Math.max(0, Number(row.intervalMs) || 0),
      remainingFrames: Math.max(0, Number(row.remainingFrames) || 0),
      sourceIdentityHash: row.sourceIdentityHash ?? null,
    }))
    .filter(row => row.bindingKey && row.remainingFrames > 0)
    .sort(compareCanonicalRows);
}

function normalizeSoulTriggerCounterState(snapshot) {
  return (snapshot.soulTriggerCounters ?? [])
    .map(row => ({
      bindingKey: row.bindingKey ?? null,
      triggerType: integerOrNull(row.triggerType),
      configuredTriggerCounter: integerOrNull(row.configuredTriggerCounter),
      triggerCounterLimit: integerOrNull(row.triggerCounterLimit),
      acceptedCount: Math.max(0, Number(row.acceptedCount) || 0),
      remainingTriggerCount: Math.max(
        0,
        Number(row.remainingTriggerCount) || 0
      ),
      exhausted: row.exhausted === true,
      sourceIdentityHash: row.sourceIdentityHash ?? null,
    }))
    .filter(row => row.bindingKey && row.triggerCounterLimit != null)
    .sort(compareCanonicalRows);
}

function normalizeSoulPeriodicRootState(snapshot) {
  return (snapshot.soulPeriodicRoots ?? [])
    .map(row => ({
      bindingKey: row.bindingKey ?? null,
      actorId: row.actorId ?? null,
      ownerIdentity: row.ownerIdentity ?? null,
      rootElementId: integerOrNull(row.rootElementId),
      intervalFrames: Math.max(1, Number(row.intervalFrames) || 0),
      remainingFrames: Math.max(0, Number(row.remainingFrames) || 0),
      sourceIdentityHash: row.sourceIdentityHash ?? null,
    }))
    .filter(row => row.bindingKey && row.remainingFrames > 0)
    .sort(compareCanonicalRows);
}

function resolveNextPeriodicRootTickFrame({
  boundaryFrame,
  intervalFrames,
  timeExecuteFirstFrame,
}) {
  const firstTickFrame = timeExecuteFirstFrame ? 1 : intervalFrames;
  if (boundaryFrame < firstTickFrame) return firstTickFrame;
  const completedIntervals = Math.floor(
    (boundaryFrame - firstTickFrame) / intervalFrames
  );
  return firstTickFrame + (completedIntervals + 1) * intervalFrames;
}

function normalizeKiboPassiveRuntimeState(snapshot) {
  return (snapshot.kiboPassiveRuntime ?? [])
    .map(row => ({
      stateIdentity: row.stateIdentity ?? null,
      passiveKey: row.passiveKey ?? null,
      actorId: row.actorId ?? null,
      slotId: row.slotId ?? null,
      kiboId: row.kiboId ?? null,
      skillId: row.skillId ?? null,
      internalCooldownRemainingFrames: Math.max(
        0,
        Number(row.internalCooldownRemainingFrames) || 0
      ),
      configuredTriggerCounter: integerOrNull(row.configuredTriggerCounter),
      triggerLifetime: row.triggerLifetime ?? null,
      triggerLifetimeBasis: row.triggerLifetimeBasis ?? null,
      maxTriggerCount: integerOrNull(row.maxTriggerCount),
      remainingTriggerCount: integerOrNull(row.remainingTriggerCount),
      triggerLimitScope: row.triggerLimitScope ?? null,
      sourceIdentityHash: row.sourceIdentityHash ?? null,
    }))
    .filter(
      row =>
        row.stateIdentity &&
        (row.internalCooldownRemainingFrames > 0 ||
          row.remainingTriggerCount != null)
    )
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
          remainingFrames: Math.max(0, Number(layer.remainingFrames) || 0),
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
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function integerOrNull(value) {
  if (value == null || value === '') return null;
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
