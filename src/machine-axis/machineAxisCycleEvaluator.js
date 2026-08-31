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
import {
  createSearchNormalAttackInputProof,
  createSearchStateSnapshot,
} from './machineAxisSearchState';
import {
  normalizeEffectModifiers,
  projectActiveEffectStates,
} from './machineAxisEffectState';
import { createMachineAxisHealingStatistics } from './machineAxisHealingStatistics';
import { createMachineAxisActionLegalityProof } from './machineAxisActionLegality';
import {
  aggregateMachineAxisOptimizationDiagnostics,
  createMachineAxisOptimizationDiagnostics,
  normalizeMachineAxisOptimizationDiagnosticsPerCycle,
} from './machineAxisOptimizationDiagnostics';
import {
  MACHINE_AXIS_EVENTUAL_PERIOD_POLICY,
  findEventualPeriodicSequenceCandidates,
} from './machineAxisCyclePeriod';
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
const DEFAULT_MAX_REPLAY_CYCLES = 12;
const DEFAULT_MAX_PERIOD_CYCLES = 4;
const DEFAULT_MINIMUM_PERIOD_REPEATS = 3;
const MIN_REPLAY_CYCLES = 4;
const MAX_REPLAY_CYCLES = 32;
const CYCLE_LOCAL_SYNTHETIC_DAMAGE_HIT_KINDS = new Set([
  'verified-held-damage',
  'verified-held-true-damage',
  'verified-overlimit-damage',
  'verified-overlimit-dot-damage',
  'verified-overlimit-true-damage',
]);

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
      maxReplayCycles:
        positiveIntegerOrNull(options.maxReplayCycles) ??
        DEFAULT_MAX_REPLAY_CYCLES,
      maxPeriodCycles:
        positiveIntegerOrNull(options.maxPeriodCycles) ??
        DEFAULT_MAX_PERIOD_CYCLES,
      minimumPeriodRepeats:
        positiveIntegerOrNull(options.minimumPeriodRepeats) ??
        DEFAULT_MINIMUM_PERIOD_REPEATS,
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
      if (
        ![
          'objective',
          'criticalPolicy',
          'seeds',
          'maxReplayCycles',
          'maxPeriodCycles',
          'minimumPeriodRepeats',
        ].includes(key)
      ) {
        issues.push(
          cycleIssue(
            'machine-axis-cycle-additional-property',
            `options.${key}`,
            `Additional cycle option is not allowed: ${key}`
          )
        );
      }
    }
    validateCyclePeriodOption({
      issues,
      options: source.options,
      key: 'maxReplayCycles',
      minimum: MIN_REPLAY_CYCLES,
      maximum: MAX_REPLAY_CYCLES,
      fallback: DEFAULT_MAX_REPLAY_CYCLES,
    });
    validateCyclePeriodOption({
      issues,
      options: source.options,
      key: 'maxPeriodCycles',
      minimum: 1,
      maximum: 8,
      fallback: DEFAULT_MAX_PERIOD_CYCLES,
    });
    validateCyclePeriodOption({
      issues,
      options: source.options,
      key: 'minimumPeriodRepeats',
      minimum: 2,
      maximum: 4,
      fallback: DEFAULT_MINIMUM_PERIOD_REPEATS,
    });
    const maxReplayCycles =
      positiveIntegerOrNull(source.options.maxReplayCycles) ??
      DEFAULT_MAX_REPLAY_CYCLES;
    const maxPeriodCycles =
      positiveIntegerOrNull(source.options.maxPeriodCycles) ??
      DEFAULT_MAX_PERIOD_CYCLES;
    const minimumPeriodRepeats =
      positiveIntegerOrNull(source.options.minimumPeriodRepeats) ??
      DEFAULT_MINIMUM_PERIOD_REPEATS;
    if (maxReplayCycles < maxPeriodCycles * minimumPeriodRepeats) {
      issues.push(
        cycleIssue(
          'machine-axis-cycle-period-budget-insufficient',
          'options.maxReplayCycles',
          'maxReplayCycles must cover maxPeriodCycles × minimumPeriodRepeats',
          {
            maxReplayCycles,
            maxPeriodCycles,
            minimumPeriodRepeats,
          }
        )
      );
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
      settlementReadiness:
        normalized.options.objective === 'cycle-dps-with-toughness'
          ? settlementReadiness
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

export function compareCycleBoundaryStates(
  startSnapshot,
  endSnapshot,
  { actionIdentityById = null } = {}
) {
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
  // Normal-attack phases are intentionally not an exact boundary dimension.
  // A terminal reopen phase and idle can both resolve the next loop input to
  // the same opener. The doubled semantic replay below proves every input is
  // legal and resolves to the same executable form; hashing transient phase
  // labels here would reject a stable infinite loop before that proof runs.
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
    if (
      dimension === 'cooldowns' ||
      dimension === 'chargeCooldowns' ||
      dimension === 'soulTriggerIntervals'
    ) {
      // Cooldown closure uses non-increasing remaining time: the loop end
      // must leave every cooldown with no MORE remaining time than at the
      // loop start (a warmup rehearsal may pre-cast the same actions so the
      // boundary starts partially cooled and ends fully cooled). Exact
      // equality is not required; only the ability to replay without a
      // tighter cooldown budget.
      const startRows = normalize(startSnapshot, { actionIdentityById });
      const endRows = normalize(endSnapshot, { actionIdentityById });
      const cooldownIdentity = row =>
        row.bindingKey != null
          ? `soul-trigger:${row.bindingKey}|${row.intervalMs ?? ''}|${row.sourceIdentityHash ?? ''}`
          : `${row.runtimeOwnerIdentity ?? ''}|${row.ownerId ?? ''}|${row.skillId ?? ''}|${row.chargeIndex ?? ''}|${row.cooldownCount ?? ''}|${row.status ?? ''}|${row.cooldownIdentity ?? ''}|${row.lastSettlementIdentity ?? ''}|${(row.missingChargeSourceActionIds ?? []).join('+')}|${row.sharedTimerRunning ?? ''}|${row.chargeMaxCount ?? ''}|${row.fullCooldownMs ?? ''}`;
      const startRemaining = new Map(
        startRows.map(row => [
          cooldownIdentity(row),
          finiteNumberOrNull(row.remainingFrames) ?? 0,
        ])
      );
      const endRemaining = new Map(
        endRows.map(row => [
          cooldownIdentity(row),
          finiteNumberOrNull(row.remainingFrames) ?? 0,
        ])
      );
      const identities = [
        ...new Set([...startRemaining.keys(), ...endRemaining.keys()]),
      ]
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right, 'en'));
      let closed = true;
      const differences = [];
      for (const identity of identities) {
        const startValue = startRemaining.get(identity) ?? 0;
        const endValue = endRemaining.get(identity) ?? 0;
        const startHas = startRemaining.has(identity);
        const endHas = endRemaining.has(identity);
        // A cooldown that appears at loop end but not at loop start is a new
        // or differently-sourced cooldown -> not closed.
        if (endHas && !startHas) {
          closed = false;
          differences.push({
            identity,
            startRemaining: null,
            endRemaining: endValue,
            reason: 'cooldown-appears-at-end',
          });
          continue;
        }
        // A cooldown that expired by loop end (start-only) is fine: remaining
        // dropped to zero. Shared identities must not have MORE remaining time
        // at the end than at the start (+ half-frame tolerance).
        const rowClosed = endValue <= startValue + 0.5;
        if (!rowClosed) {
          closed = false;
          differences.push({
            identity,
            startRemaining: startValue,
            endRemaining: endValue,
            reason: 'remaining-cooldown-grew',
          });
        }
      }
      const equal = closed;
      stateDiffs.push({
        dimension,
        equal,
        start: startRows,
        end: endRows,
        differences,
      });
      if (!equal) {
        issues.push(
          cycleIssue(
            'machine-axis-cycle-state-not-closed',
            `state.${dimension}`,
            `${dimension} leaves a cooldown with more remaining time than at loop start`,
            { dimension, start: startRows, end: endRows, differences }
          )
        );
      }
      continue;
    }
    const startValue = normalize(startSnapshot, { actionIdentityById });
    const endValue = normalize(endSnapshot, { actionIdentityById });
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
  const secondClosureIssues = secondClosure?.issues ?? [];
  // start -> firstEnd is the formal boundary proof because both snapshots
  // have one complete semantic cycle of lookahead in the doubled replay.
  // secondEnd is the terminal replay horizon: pending expiries that a third
  // cycle would consume or refresh are still useful diagnostics, but they are
  // not an asymmetric reason to reject an otherwise closed loop. Other state
  // regressions at secondEnd remain blocking as an extra safety check.
  const terminalHorizonIssues = secondClosureIssues.filter(
    issue => issue?.path === 'state.pendingEvents'
  );
  const secondClosureBlockingIssues = secondClosureIssues.filter(
    issue => issue?.path !== 'state.pendingEvents'
  );
  const issues = [
    ...(firstClosure?.issues ?? []),
    ...secondClosureBlockingIssues,
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
    closurePolicy: 'start-to-first-end-semantic-state-v1',
    secondClosureRequired: false,
    damageStabilityMode,
    randomDamageVariation: {
      independentlySampledCycleDamageMayDiffer:
        damageStabilityMode === 'cycle-local-common-random-numbers',
      stateAndWarmupClosureStillRequired: true,
    },
    damageStable: Math.abs(firstHpDamage - secondHpDamage) <= tolerance,
    firstClosure: firstClosure ?? null,
    secondClosure: secondClosure ?? null,
    secondClosureDiagnostic: {
      diagnosticOnly: true,
      terminalHorizonLimited: true,
      closed: secondClosure?.closed === true,
      ignoredIssueCount: terminalHorizonIssues.length,
      issues: terminalHorizonIssues,
      blockingIssues: secondClosureBlockingIssues,
    },
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

export function createCycleMetricSignature(
  cycle = {},
  { actionIdentityById = null } = {}
) {
  const cycleStartFrame = integerOrNull(cycle.startFrame);
  const contributionRows = key => {
    const byIdentity = new Map();
    for (const row of cycle[key] ?? []) {
      const identity = createCycleMetricContributionIdentity(key, row, {
        actionIdentityById,
        cycleStartFrame,
      });
      const current = byIdentity.get(identity) ?? {
        identity,
        hpDamage: 0,
        combatHitCount: 0,
      };
      current.hpDamage += Number(row.hpDamage) || 0;
      current.combatHitCount += Number(row.combatHitCount) || 0;
      byIdentity.set(identity, current);
    }
    return [...byIdentity.values()]
      .map(row => ({
        ...row,
        hpDamage: roundMetric(row.hpDamage),
      }))
      .sort((left, right) =>
        String(left.identity ?? '').localeCompare(
          String(right.identity ?? ''),
          'en'
        )
      );
  };
  return {
    hpDamage: roundMetric(cycle.hpDamage),
    combatHitCount: Number(cycle.combatHitCount) || 0,
    healing: {
      requestedHealing: roundMetric(cycle.healing?.requestedHealing),
      effectiveHealing: roundMetric(cycle.healing?.effectiveHealing),
      overhealing: roundMetric(cycle.healing?.overhealing),
      settlementCount: Number(cycle.healing?.settlementCount) || 0,
    },
    byActor: contributionRows('byActor'),
    byAction: contributionRows('byAction'),
    byHit: contributionRows('byHit'),
    enemySettlement: (cycle.enemySettlementPackets ?? []).map(packet => ({
      relativeFrame: createCycleLocalMetricFrame(
        packet.absoluteFrame,
        cycleStartFrame
      ),
      actionId: normalizeCycleActionReference(
        packet.actionId,
        actionIdentityById
      ),
      actorId: packet.actorId ?? null,
      hitIdentity: normalizeCycleMetricHitIdentity(packet.hitIdentity, {
        actionIdentityById,
        absoluteFrame: packet.absoluteFrame,
        cycleStartFrame,
      }),
      effectiveHpDamage: roundMetric(packet.effectiveHpDamage),
      toughnessDamage: roundMetric(packet.toughnessDamage),
      inBreakForHpDamage: packet.inBreakForHpDamage === true,
      hpDamageMultiplier: roundMetric(packet.hpDamageMultiplier),
      breakTriggered: packet.breakTriggered === true,
    })),
    enemyStateTransitions: (cycle.enemyStateTransitions ?? []).map(event => ({
      relativeFrame: createCycleLocalMetricFrame(
        event.absoluteFrame,
        cycleStartFrame
      ),
      stateEventKind: event.stateEventKind ?? null,
      toughnessDamage: roundMetric(event.toughnessDamage),
      weaknessResult: event.weaknessResult ?? null,
    })),
  };
}

function createCycleMetricContributionIdentity(
  key,
  row,
  { actionIdentityById = null, cycleStartFrame = null } = {}
) {
  if (key === 'byActor') {
    return row.identity ?? row.actorId ?? null;
  }
  const actionId = normalizeCycleActionReference(
    row.actionId ?? (key === 'byAction' ? row.identity : null),
    actionIdentityById
  );
  if (key === 'byAction') return actionId;
  const hitIdentity = normalizeCycleMetricHitIdentity(
    row.hitIdentity ?? resolveContributionHitIdentity(row),
    {
      actionIdentityById,
      absoluteFrame: row.firstFrame,
      cycleStartFrame,
    }
  );
  return `${String(actionId ?? '')}|${String(hitIdentity ?? '')}`;
}

function resolveContributionHitIdentity(row = {}) {
  const identity = String(row.identity ?? '');
  const actionId = String(row.actionId ?? '');
  return actionId && identity.startsWith(`${actionId}|`)
    ? identity.slice(actionId.length + 1)
    : identity;
}

function normalizeCycleMetricHitIdentity(
  value,
  {
    actionIdentityById = null,
    absoluteFrame = null,
    cycleStartFrame = null,
  } = {}
) {
  if (value == null) return null;
  const tokens = String(value)
    .split('|')
    .map(token => normalizeCycleActionReference(token, actionIdentityById));
  if (
    tokens.length >= 5 &&
    CYCLE_LOCAL_SYNTHETIC_DAMAGE_HIT_KINDS.has(tokens[0])
  ) {
    const relativeFrame = createCycleLocalMetricFrame(
      absoluteFrame,
      cycleStartFrame
    );
    if (relativeFrame != null) {
      tokens[tokens.length - 1] = `cycle-frame:${relativeFrame}`;
    }
  }
  return tokens.join('|');
}

function createCycleLocalMetricFrame(absoluteFrame, cycleStartFrame) {
  const frame = integerOrNull(absoluteFrame);
  const start = integerOrNull(cycleStartFrame);
  return frame == null || start == null ? null : frame - start;
}

export function createCycleBoundarySemanticProjection(
  snapshot,
  { actionIdentityById = null, mode = 'score' } = {}
) {
  if (!isRecord(snapshot)) {
    throw new TypeError('Cycle boundary snapshot is required');
  }
  const stripSourceHash = rows =>
    rows.map(row => {
      const value = { ...row };
      delete value.sourceIdentityHash;
      return value;
    });
  const resources = {
    actors: (snapshot.actors ?? []).map(row => ({
      actorId: row.actorId ?? null,
      max: roundMetric(row.max),
    })),
    kibos: (snapshot.kibos ?? []).map(row => ({
      actorId: row.actorId ?? null,
      kiboId: row.kiboId ?? null,
      max: roundMetric(row.max),
    })),
    specialResources: (snapshot.specialResources ?? []).map(row => ({
      actorId: row.actorId ?? null,
      resourceIdentity: row.resourceIdentity ?? null,
      currentValue: roundMetric(row.currentValue),
      maxValue: roundMetric(row.maxValue),
      activeStates: (row.activeStates ?? []).map(state => ({
        stateElementId: state.stateElementId ?? state.elementId ?? null,
        remainingFrames: integerOrNull(state.remainingFrames),
      })),
    })),
  };
  const execution = {
    activeActorId: snapshot.activeActorId ?? null,
    resources,
    cooldowns: normalizeCooldownState(snapshot),
    chargeCooldowns: normalizeChargeCooldownState(snapshot, {
      actionIdentityById,
    }).map(row => {
      const value = { ...row };
      delete value.lastCooldownReductionTransactionId;
      return value;
    }),
    soulTriggerIntervals: stripSourceHash(
      normalizeSoulTriggerIntervalState(snapshot)
    ),
    soulTriggerCounters: stripSourceHash(
      normalizeSoulTriggerCounterState(snapshot)
    ),
    soulPeriodicRoots: stripSourceHash(
      normalizeSoulPeriodicRootState(snapshot)
    ),
    kiboPassiveRuntime: stripSourceHash(
      normalizeKiboPassiveRuntimeState(snapshot)
    ),
    actorVitals: structuredClone(snapshot.actorVitals ?? []),
    kiboVitals: structuredClone(snapshot.kiboVitals ?? []),
    pendingReadinessEvents: normalizePendingState(snapshot, {
      actionIdentityById,
    }).filter(row =>
      [
        'special-resource',
        'variant-resource',
        'variant-state',
        'cooldown-reduction',
      ].includes(row.kind)
    ),
  };
  if (mode === 'execution') return execution;
  return {
    ...execution,
    tuningMarks: (snapshot.tuningMarks ?? [])
      .map(normalizeTuningMarkLifecycleRow)
      .sort(compareCanonicalRows),
    effects: stripSourceHash(
      normalizeEffectState(snapshot, { actionIdentityById })
    ),
    targetStates: normalizeTargetState(snapshot).map(row => ({
      ...row,
      layers: row.layers.map(layer => {
        const value = { ...layer };
        delete value.sourceIdentityHash;
        return value;
      }),
    })),
    specialStates: stripSourceHash(normalizeSpecialState(snapshot)),
    enemy: normalizeEnemyBoundaryState(snapshot),
    shields: normalizeShieldState(snapshot),
    pendingEvents: normalizePendingState(snapshot, { actionIdentityById }),
  };
}

function createBoundaryResourcePeriodProof({ snapshots, candidate }) {
  const boundaryCycleIndexes = Array.from(
    { length: candidate.minimumRepeats + 1 },
    (_, repeatIndex) =>
      candidate.transientCycleCount + candidate.periodCycles * repeatIndex
  );
  const comparisons = [];
  const issues = [];
  for (let index = 0; index < boundaryCycleIndexes.length - 1; index += 1) {
    const startCycleIndex = boundaryCycleIndexes[index];
    const endCycleIndex = boundaryCycleIndexes[index + 1];
    const start = snapshots.get(startCycleIndex);
    const end = snapshots.get(endCycleIndex);
    const dimensions = [
      {
        dimension: 'actor-sp',
        startRows: start?.actors,
        endRows: end?.actors,
        identity: row => `actor:${stripActorPrefix(row.actorId)}:sp`,
        value: row => row.sp,
      },
      {
        dimension: 'kibo-energy',
        startRows: start?.kibos,
        endRows: end?.kibos,
        identity: row =>
          `kibo:${String(row.actorId ?? '')}:${String(row.kiboId ?? '')}:sp`,
        value: row => row.energy,
      },
      {
        dimension: 'special-resource',
        startRows: start?.specialResources,
        endRows: end?.specialResources,
        identity: row => String(row.resourceIdentity ?? ''),
        value: row => row.currentValue,
      },
    ];
    for (const dimension of dimensions) {
      const startValues = new Map(
        (dimension.startRows ?? []).map(row => [
          dimension.identity(row),
          finiteNumberOrNull(dimension.value(row)) ?? 0,
        ])
      );
      const endValues = new Map(
        (dimension.endRows ?? []).map(row => [
          dimension.identity(row),
          finiteNumberOrNull(dimension.value(row)) ?? 0,
        ])
      );
      for (const resourceIdentity of new Set([
        ...startValues.keys(),
        ...endValues.keys(),
      ])) {
        if (!resourceIdentity) continue;
        const startValue = startValues.get(resourceIdentity) ?? 0;
        const endValue = endValues.get(resourceIdentity) ?? 0;
        const delta = roundMetric(endValue - startValue);
        const sustainable = endValue + VALUE_TOLERANCE >= startValue;
        const row = {
          startCycleIndex,
          endCycleIndex,
          dimension: dimension.dimension,
          resourceIdentity,
          startValue,
          endValue,
          delta,
          sustainable,
        };
        comparisons.push(row);
        if (!sustainable) {
          issues.push(
            cycleIssue(
              'machine-axis-cycle-resource-deficit',
              `state.resources.${resourceIdentity}`,
              `Stable period consumes non-renewed resource ${resourceIdentity}`,
              row
            )
          );
        }
      }
    }
  }
  return {
    policy: 'eventual-periodic-resource-sustainability-v1',
    closed: issues.length === 0,
    boundaryCycleIndexes,
    comparisons,
    issues,
  };
}

function findIndependentOperationPeriod({
  snapshotAt,
  snapshots,
  replayCount,
  maxPeriodCycles,
  minimumRepeats,
  cyclePhaseActions,
}) {
  const rows = Array.from({ length: replayCount + 1 }, (_, cycleIndex) => {
    const projection = createCycleBoundarySemanticProjection(
      snapshotAt(cycleIndex),
      {
        actionIdentityById: cyclePhaseActions.actionIdentityById,
        mode: 'execution',
      }
    );
    return {
      cycleIndex,
      projection,
      hash: hashCanonicalValue(projection),
    };
  });
  const candidates = [];
  for (
    let transientCycleCount = 0;
    transientCycleCount <= replayCount;
    transientCycleCount += 1
  ) {
    for (
      let periodCycles = 1;
      periodCycles <= maxPeriodCycles;
      periodCycles += 1
    ) {
      if (transientCycleCount + periodCycles * minimumRepeats > replayCount) {
        continue;
      }
      const hashes = Array.from(
        { length: minimumRepeats + 1 },
        (_, repeatIndex) =>
          rows[transientCycleCount + periodCycles * repeatIndex].hash
      );
      if (!hashes.every(hash => hash === hashes[0])) continue;
      candidates.push({
        policy: MACHINE_AXIS_EVENTUAL_PERIOD_POLICY,
        transientCycleCount,
        periodCycles,
        minimumRepeats,
      });
    }
  }
  const proofs = candidates
    .sort(
      (left, right) =>
        left.transientCycleCount - right.transientCycleCount ||
        left.periodCycles - right.periodCycles
    )
    .map(candidate => ({
      metricPeriod: null,
      operationPeriod: createBoundaryPeriodProof({
        snapshots,
        candidate,
        cyclePhaseActions,
        mode: 'execution',
      }),
      resourcePeriod: createBoundaryResourcePeriodProof({
        snapshots,
        candidate,
      }),
      scoreStatePeriod: null,
    }));
  const sustainableProof =
    proofs.find(
      proof =>
        proof.operationPeriod.closed === true &&
        proof.resourcePeriod.closed === true
    ) ?? null;
  return {
    proofs: sustainableProof ? [sustainableProof] : proofs.slice(0, 1),
    sustainableProof,
  };
}

function createBoundaryPeriodProof({
  snapshots,
  candidate,
  cyclePhaseActions,
  mode,
}) {
  const indexes = Array.from(
    { length: candidate.minimumRepeats + 1 },
    (_, repeatIndex) =>
      candidate.transientCycleCount + candidate.periodCycles * repeatIndex
  );
  const rows = indexes.map(index => {
    const projection = createCycleBoundarySemanticProjection(
      snapshots.get(index),
      {
        actionIdentityById: cyclePhaseActions.actionIdentityById,
        mode,
      }
    );
    return {
      cycleIndex: index,
      projection,
      hash: hashCanonicalValue(projection),
    };
  });
  const closed = rows.every(row => row.hash === rows[0]?.hash);
  return {
    policy:
      mode === 'execution'
        ? 'eventual-periodic-operation-state-v1'
        : 'eventual-periodic-score-state-v1',
    closed,
    transientCycleCount: candidate.transientCycleCount,
    periodCycles: candidate.periodCycles,
    confirmedPeriods: candidate.minimumRepeats,
    boundaryCycleIndexes: indexes,
    boundaryHashes: rows.map(row => row.hash),
    differences:
      closed || rows.length < 2
        ? []
        : rows.slice(1).map(row => ({
            cycleIndex: row.cycleIndex,
            expectedHash: rows[0].hash,
            actualHash: row.hash,
            dimensions: [
              ...new Set([
                ...Object.keys(rows[0].projection ?? {}),
                ...Object.keys(row.projection ?? {}),
              ]),
            ].filter(
              key =>
                hashCanonicalValue(rows[0].projection?.[key] ?? null) !==
                hashCanonicalValue(row.projection?.[key] ?? null)
            ),
          })),
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
    const issues = normalizeErrorIssues(error);
    const proof =
      error?.actionLegalityProof ??
      createMachineAxisActionLegalityProof(null, {
        objectiveId: objectiveContract?.objectiveId ?? null,
        preflightIssues: issues,
      });
    return rejectedSample(seed, issues, {
      actionLegalityProof: proof.passed === true ? null : proof,
    });
  }
  if (firstPrepared.valid !== true) {
    const preflightActionLegality = createMachineAxisActionLegalityProof(null, {
      objectiveId: objectiveContract?.objectiveId ?? null,
      preflightIssues: firstPrepared.issues ?? [],
    });
    return rejectedSample(seed, firstPrepared.issues ?? [], {
      actionLegalityProof:
        preflightActionLegality.passed === true
          ? null
          : preflightActionLegality,
    });
  }
  const firstNormalAttackInputProof = createSearchNormalAttackInputProof({
    trace: firstPrepared.run?.trace ?? {},
    fps: Number(firstContract.scenario?.fps) || 60,
  });
  const firstActionLegality = createMachineAxisActionLegalityProof(
    firstPrepared.run,
    { objectiveId: objectiveContract?.objectiveId ?? null }
  );
  if (
    firstActionLegality.passed !== true ||
    firstActionLegality.finalScoreEligible !== true
  ) {
    return rejectedSample(
      seed,
      [
        ...(firstActionLegality.issues ?? []),
        ...(firstActionLegality.scoreExclusions ?? []),
      ],
      {
        actionLegalityProof: firstActionLegality,
      }
    );
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
  const replayCounts = createAdaptiveReplayCounts(
    envelope.options.maxReplayCycles
  );
  let lastAttempt = null;
  for (const replayCount of replayCounts) {
    const attempt = evaluateEventualCycleReplay({
      envelope,
      criticalPolicy,
      firstContract,
      firstPrepared,
      firstActionLegality,
      firstNormalAttackInputProof,
      objectiveContract,
      prepareRun,
      simulateBoundary,
      runtimeOptions,
      replayCount,
    });
    lastAttempt = attempt;
    if (attempt.status === 'rejected') {
      return rejectedSample(seed, attempt.issues, attempt.details);
    }
    if (attempt.status === 'closed') {
      return { ...attempt.sample, seed };
    }
  }

  const operationClosed =
    lastAttempt?.candidateProofs?.some(
      proof =>
        proof.operationPeriod?.closed === true &&
        proof.resourcePeriod?.closed === true
    ) === true;
  const resourceIssues = dedupeIssues(
    (lastAttempt?.candidateProofs ?? [])
      .filter(proof => proof.operationPeriod?.closed === true)
      .flatMap(proof => proof.resourcePeriod?.issues ?? [])
  );
  if (!operationClosed && resourceIssues.length > 0) {
    return rejectedSample(seed, resourceIssues, {
      ...(lastAttempt?.details ?? {}),
      replayProof: {
        stable: false,
        issues: resourceIssues,
        closurePolicy: MACHINE_AXIS_EVENTUAL_PERIOD_POLICY,
        operationClosed: false,
        candidateProofs: lastAttempt?.candidateProofs ?? [],
        cycles: lastAttempt?.observedCycles ?? [],
      },
    });
  }
  const issue = cycleIssue(
    operationClosed
      ? 'machine-axis-cycle-metrics-period-unresolved'
      : 'machine-axis-cycle-operation-period-unresolved',
    operationClosed ? 'replayProof.metrics' : 'replayProof.operation',
    operationClosed
      ? 'Repeated inputs remain executable, but no formally recurring score state was found within the bounded replay horizon'
      : 'No recurring execution state was found within the bounded replay horizon',
    {
      maxReplayCycles: envelope.options.maxReplayCycles,
      maxPeriodCycles: envelope.options.maxPeriodCycles,
      minimumPeriodRepeats: envelope.options.minimumPeriodRepeats,
      candidateProofs: lastAttempt?.candidateProofs ?? [],
    }
  );
  return rejectedSample(seed, [issue], {
    ...(lastAttempt?.details ?? {}),
    replayProof: {
      stable: false,
      issues: [issue],
      closurePolicy: MACHINE_AXIS_EVENTUAL_PERIOD_POLICY,
      operationClosed,
      candidateProofs: lastAttempt?.candidateProofs ?? [],
      cycles: lastAttempt?.observedCycles ?? [],
    },
  });
}

function evaluateEventualCycleReplay({
  envelope,
  criticalPolicy,
  firstContract,
  firstPrepared,
  firstActionLegality,
  firstNormalAttackInputProof,
  objectiveContract,
  prepareRun,
  simulateBoundary,
  runtimeOptions,
  replayCount,
}) {
  const loopPlan = createLoopReplayPlan({
    contract: firstContract,
    actionResolutions: firstPrepared.compilation.actionResolutions,
    loop: envelope.loop,
    replayCount,
  });
  if (!loopPlan.valid) {
    return { status: 'rejected', issues: loopPlan.issues, details: {} };
  }
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
    return {
      status: 'rejected',
      issues: commonRandomPlan.issues,
      details: {},
    };
  }
  const replayContract = commonRandomPlan?.contract ?? loopPlan.contract;
  let replayPrepared;
  try {
    replayPrepared = prepareRun(replayContract, runtimeOptions);
  } catch (error) {
    const causes = normalizeErrorIssues(error);
    const replayActionLegality =
      error?.actionLegalityProof ??
      createMachineAxisActionLegalityProof(null, {
        objectiveId: objectiveContract?.objectiveId ?? null,
        preflightIssues: causes,
      });
    return {
      status: 'rejected',
      issues: [
        cycleIssue(
          'machine-axis-cycle-second-replay-not-runnable',
          'replayProof.repeatedCycles',
          `The ${replayCount}-cycle semantic replay failed canonical compilation or simulation`,
          { replayCount, causes }
        ),
      ],
      details: {
        actionLegalityProof: {
          passed: false,
          firstCycle: firstActionLegality,
          replay:
            replayActionLegality.passed === true ? null : replayActionLegality,
        },
      },
    };
  }
  if (replayPrepared.valid !== true) {
    const failedReplayNormalAttackInputProof = replayPrepared.run
      ? createSearchNormalAttackInputProof({
          trace: replayPrepared.run.trace ?? {},
          fps: Number(replayContract.scenario?.fps) || 60,
        })
      : null;
    const failedReplayActionLegality = createMachineAxisActionLegalityProof(
      replayPrepared.run ?? null,
      {
        objectiveId: objectiveContract?.objectiveId ?? null,
        preflightIssues: replayPrepared.issues ?? [],
      }
    );
    return {
      status: 'rejected',
      issues: [
        cycleIssue(
          'machine-axis-cycle-second-replay-not-runnable',
          'replayProof.repeatedCycles',
          `The ${replayCount}-cycle semantic replay contains non-executable actions`,
          { replayCount, causes: replayPrepared.issues ?? [] }
        ),
      ],
      details: {
        actionLegalityProof: {
          passed: false,
          firstCycle: firstActionLegality,
          replay: failedReplayActionLegality,
        },
        normalAttackInputProof: {
          passed: false,
          firstCycle: firstNormalAttackInputProof,
          replay: failedReplayNormalAttackInputProof,
        },
      },
    };
  }

  const replayNormalAttackInputProof = createSearchNormalAttackInputProof({
    trace: replayPrepared.run?.trace ?? {},
    fps: Number(replayContract.scenario?.fps) || 60,
  });
  const replayActionLegality = createMachineAxisActionLegalityProof(
    replayPrepared.run,
    { objectiveId: objectiveContract?.objectiveId ?? null }
  );
  if (
    replayActionLegality.passed !== true ||
    replayActionLegality.finalScoreEligible !== true
  ) {
    return {
      status: 'rejected',
      issues: [
        ...(replayActionLegality.issues ?? []),
        ...(replayActionLegality.scoreExclusions ?? []),
      ],
      details: {
        actionLegalityProof: {
          passed: false,
          firstCycle: firstActionLegality,
          replay: replayActionLegality,
        },
      },
    };
  }
  const normalAttackInputIssues = [
    ...(firstNormalAttackInputProof.issues ?? []),
    ...(replayNormalAttackInputProof.issues ?? []),
  ];
  if (normalAttackInputIssues.length > 0) {
    return {
      status: 'rejected',
      issues: normalAttackInputIssues,
      details: {
        normalAttackInputProof: {
          passed: false,
          firstCycle: firstNormalAttackInputProof,
          replay: replayNormalAttackInputProof,
        },
      },
    };
  }

  const replayRun = attachActionResolutions(
    replayPrepared.run,
    replayPrepared.compilation.actionResolutions
  );
  const cyclePhaseActions = createCyclePhaseActionIdentityMap({
    actionResolutions: replayPrepared.compilation.actionResolutions,
    loop: envelope.loop,
    durationFrames: loopPlan.durationFrames,
  });
  const metricActionIdentityById = new Map([
    ...loopPlan.actionIdToSourceActionId.entries(),
    ...cyclePhaseActions.actionIdentityById.entries(),
  ]);
  const executionProof = createRepeatedCycleExecutionProof({
    trace: replayPrepared.run.trace,
    actionIdsByCycle: loopPlan.actionIdsByCycle,
    actionIdToSourceActionId: loopPlan.actionIdToSourceActionId,
    actionResolutions: replayPrepared.compilation.actionResolutions,
  });
  if (!executionProof.runnable) {
    return {
      status: 'rejected',
      issues: executionProof.issues,
      details: {
        replayProof: {
          stable: false,
          issues: executionProof.issues,
          closurePolicy: MACHINE_AXIS_EVENTUAL_PERIOD_POLICY,
          executionProof,
        },
      },
    };
  }

  const observedCycles = createObservedCycleRows({
    replayRun: replayPrepared.run,
    loop: envelope.loop,
    durationFrames: loopPlan.durationFrames,
    replayCount,
    fps: firstContract.scenario.fps,
    actionIdMap: loopPlan.actionIdToSourceActionId,
  });
  const metricCandidates = findEventualPeriodicSequenceCandidates(
    observedCycles,
    {
      minimumRepeats: envelope.options.minimumPeriodRepeats,
      maxPeriodCycles: envelope.options.maxPeriodCycles,
      signature: cycle =>
        hashCanonicalValue(
          createCycleMetricSignature(cycle, {
            actionIdentityById: metricActionIdentityById,
          })
        ),
    }
  );
  const sharedDetails = {
    hashes:
      criticalPolicy === 'sampled'
        ? firstPrepared.run.hashes
        : replayPrepared.run.hashes,
    proofHashes: replayPrepared.run.hashes,
    actionLegalityProof: {
      passed: true,
      firstCycle: firstActionLegality,
      replay: replayActionLegality,
    },
    normalAttackInputProof: {
      passed: true,
      firstCycle: firstNormalAttackInputProof,
      replay: replayNormalAttackInputProof,
    },
  };
  const snapshots = new Map();
  const snapshotAt = cycleIndex => {
    if (snapshots.has(cycleIndex)) return snapshots.get(cycleIndex);
    const frame =
      Number(envelope.loop.startFrame) +
      loopPlan.durationFrames * Number(cycleIndex);
    const snapshot = createBoundarySnapshot({
      frame,
      prepared: replayPrepared,
      replayRun,
      replayContract,
      simulateBoundary,
      runtimeOptions,
    });
    snapshots.set(cycleIndex, snapshot);
    return snapshot;
  };
  if (metricCandidates.length === 0) {
    if (replayCount >= envelope.options.maxReplayCycles) {
      try {
        const independentOperation = findIndependentOperationPeriod({
          snapshotAt,
          snapshots,
          replayCount,
          maxPeriodCycles: envelope.options.maxPeriodCycles,
          minimumRepeats: envelope.options.minimumPeriodRepeats,
          cyclePhaseActions,
        });
        return {
          status: 'continue',
          observedCycles,
          candidateProofs: independentOperation.proofs,
          details: sharedDetails,
        };
      } catch (error) {
        return {
          status: 'rejected',
          issues: [
            cycleIssue(
              'machine-axis-cycle-boundary-replay-failed',
              'stateClosure',
              'Unable to inspect bounded operation periodicity',
              { causes: normalizeErrorIssues(error) }
            ),
          ],
          details: sharedDetails,
        };
      }
    }
    return {
      status: 'continue',
      observedCycles,
      candidateProofs: [],
      details: sharedDetails,
    };
  }

  const candidateProofs = [];
  for (const candidate of metricCandidates) {
    const boundaryIndexes = Array.from(
      { length: candidate.minimumRepeats + 1 },
      (_, repeatIndex) =>
        candidate.transientCycleCount + candidate.periodCycles * repeatIndex
    );
    try {
      for (const boundaryIndex of boundaryIndexes) snapshotAt(boundaryIndex);
    } catch (error) {
      return {
        status: 'rejected',
        issues: [
          cycleIssue(
            'machine-axis-cycle-boundary-replay-failed',
            'stateClosure',
            'Unable to reconstruct an eventual-periodic cycle boundary state',
            { causes: normalizeErrorIssues(error), boundaryIndexes }
          ),
        ],
        details: sharedDetails,
      };
    }
    const operationPeriod = createBoundaryPeriodProof({
      snapshots,
      candidate,
      cyclePhaseActions,
      mode: 'execution',
    });
    const scoreStatePeriod = createBoundaryPeriodProof({
      snapshots,
      candidate,
      cyclePhaseActions,
      mode: 'score',
    });
    const resourcePeriod = createBoundaryResourcePeriodProof({
      snapshots,
      candidate,
    });
    const metricPeriod = projectMetricPeriodCandidate(candidate);
    const candidateProof = {
      metricPeriod,
      operationPeriod,
      resourcePeriod,
      scoreStatePeriod,
    };
    candidateProofs.push(candidateProof);
    if (
      !operationPeriod.closed ||
      !resourcePeriod.closed ||
      !scoreStatePeriod.closed
    ) {
      continue;
    }

    const stableStartCycle = candidate.transientCycleCount;
    const periodCycles = candidate.periodCycles;
    const stableStartFrame =
      Number(envelope.loop.startFrame) +
      loopPlan.durationFrames * stableStartCycle;
    const stableEndFrame =
      stableStartFrame + loopPlan.durationFrames * periodCycles;
    const periodDamage = attachCycleHealing(
      collectCycleDamageContributions(replayPrepared.run.trace.damage, {
        startFrame: stableStartFrame,
        endFrame: stableEndFrame,
        fps: firstContract.scenario.fps,
        actionIdMap: loopPlan.actionIdToSourceActionId,
      }),
      replayPrepared.run,
      {
        startFrame: stableStartFrame,
        endFrame: stableEndFrame,
        fps: firstContract.scenario.fps,
      }
    );
    const steadyCycle = normalizeCycleDamagePerCycle(
      periodDamage,
      periodCycles
    );
    const periodDiagnostics = createMachineAxisOptimizationDiagnostics(
      replayPrepared.run,
      replayContract,
      {
        scopeKind: 'cycle-stable-period',
        startTimeMs:
          (stableStartFrame * 1000) / Number(firstContract.scenario.fps),
        endTimeMs: (stableEndFrame * 1000) / Number(firstContract.scenario.fps),
        endExclusive: true,
        actionIdMap: loopPlan.actionIdToSourceActionId,
      }
    );
    const optimizationDiagnostics =
      normalizeMachineAxisOptimizationDiagnosticsPerCycle(
        periodDiagnostics,
        periodCycles
      );
    const stableSnapshots = boundaryIndexes.map(index => snapshots.get(index));
    const firstClosure = compareCycleBoundaryStates(
      stableSnapshots[0],
      stableSnapshots[1],
      cyclePhaseActions
    );
    const secondClosure = compareCycleBoundaryStates(
      stableSnapshots[1],
      stableSnapshots[2],
      cyclePhaseActions
    );
    const replayProof = {
      stable: true,
      issues: [],
      closurePolicy: MACHINE_AXIS_EVENTUAL_PERIOD_POLICY,
      damageStabilityMode:
        criticalPolicy === 'sampled'
          ? 'eventual-periodic-cycle-local-common-random-numbers'
          : 'eventual-periodic-deterministic-metrics',
      damageStable: true,
      operationPeriod,
      resourcePeriod,
      metricPeriod,
      scoreStatePeriod,
      executionProof,
      secondExecution: executionProof,
      firstClosureDiagnostic: firstClosure,
      secondClosureDiagnostic: secondClosure,
      cycles: observedCycles.map((cycle, cycleIndex) => ({
        index: cycleIndex + 1,
        hpDamage: cycle.hpDamage,
        combatHitCount: cycle.combatHitCount,
        runnable: executionProof.cycleProofs[cycleIndex]?.runnable === true,
        transient: cycleIndex < stableStartCycle,
        stablePhase:
          cycleIndex < stableStartCycle
            ? null
            : (cycleIndex - stableStartCycle) % periodCycles,
      })),
    };
    return {
      status: 'closed',
      sample: {
        valid: true,
        status: 'closed',
        hashes: sharedDetails.hashes,
        proofHashes: sharedDetails.proofHashes,
        firstCycle: observedCycles[stableStartCycle],
        secondCycle:
          observedCycles[stableStartCycle + 1] ??
          observedCycles[stableStartCycle],
        steadyCycle,
        observedCycles,
        optimizationDiagnostics,
        replayProof,
        actionLegalityProof: sharedDetails.actionLegalityProof,
        normalAttackInputProof: sharedDetails.normalAttackInputProof,
        state: {
          start: stableSnapshots[0],
          firstEnd: stableSnapshots[1],
          secondEnd: stableSnapshots[2],
          boundaries: boundaryIndexes.map((cycleIndex, index) => ({
            cycleIndex,
            snapshot: stableSnapshots[index],
          })),
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
          replayCount,
          replayHorizonFrame: loopPlan.replayHorizonFrame,
          commonRandomRollCount: commonRandomPlan?.rollCount ?? 0,
          cyclePhaseActionIdentity: cyclePhaseActions.proof,
        },
      },
    };
  }
  if (replayCount >= envelope.options.maxReplayCycles) {
    try {
      const independentOperation = findIndependentOperationPeriod({
        snapshotAt,
        snapshots,
        replayCount,
        maxPeriodCycles: envelope.options.maxPeriodCycles,
        minimumRepeats: envelope.options.minimumPeriodRepeats,
        cyclePhaseActions,
      });
      candidateProofs.push(...independentOperation.proofs);
    } catch (error) {
      return {
        status: 'rejected',
        issues: [
          cycleIssue(
            'machine-axis-cycle-boundary-replay-failed',
            'stateClosure',
            'Unable to inspect bounded operation periodicity',
            { causes: normalizeErrorIssues(error) }
          ),
        ],
        details: sharedDetails,
      };
    }
  }
  return {
    status: 'continue',
    observedCycles,
    candidateProofs,
    details: sharedDetails,
  };
}

function createAdaptiveReplayCounts(maxReplayCycles) {
  const maximum = Math.max(
    MIN_REPLAY_CYCLES,
    Math.min(MAX_REPLAY_CYCLES, Number(maxReplayCycles) || 0)
  );
  return [...new Set([4, 8, maximum].filter(value => value <= maximum))].sort(
    (left, right) => left - right
  );
}

function createObservedCycleRows({
  replayRun,
  loop,
  durationFrames,
  replayCount,
  fps,
  actionIdMap,
}) {
  return Array.from({ length: replayCount }, (_, cycleIndex) => {
    const startFrame = Number(loop.startFrame) + durationFrames * cycleIndex;
    const endFrame = startFrame + durationFrames;
    return {
      cycleIndex,
      ...attachCycleHealing(
        collectCycleDamageContributions(replayRun.trace.damage, {
          startFrame,
          endFrame,
          fps,
          actionIdMap,
        }),
        replayRun,
        { startFrame, endFrame, fps }
      ),
    };
  });
}

function projectMetricPeriodCandidate(candidate) {
  return {
    policy: MACHINE_AXIS_EVENTUAL_PERIOD_POLICY,
    stable: true,
    transientCycleCount: candidate.transientCycleCount,
    stableCycleCount: candidate.stableCycleCount,
    periodCycles: candidate.periodCycles,
    repeatedCycleCount: candidate.repeatedCycleCount,
    minimumRepeats: candidate.minimumRepeats,
    periodHpDamage: candidate.periodValues.map(cycle => cycle.hpDamage),
    averageHpDamage: roundMetric(
      mean(candidate.periodValues.map(cycle => cycle.hpDamage))
    ),
  };
}

export function normalizeCycleDamagePerCycle(damage, cycleCount) {
  const divisor = Math.max(1, Number(cycleCount) || 1);
  const scale = value => roundMetric((Number(value) || 0) / divisor);
  const scaleRows = rows =>
    (rows ?? []).map(row => ({
      ...row,
      hpDamage: scale(row.hpDamage),
      combatHitCount: scale(row.combatHitCount),
    }));
  return {
    ...damage,
    periodCycleCount: divisor,
    hpDamage: scale(damage.hpDamage),
    combatHitCount: scale(damage.combatHitCount),
    byActor: scaleRows(damage.byActor),
    byAction: scaleRows(damage.byAction),
    byHit: scaleRows(damage.byHit),
    healing: {
      ...damage.healing,
      requestedHealing: scale(damage.healing?.requestedHealing),
      effectiveHealing: scale(damage.healing?.effectiveHealing),
      overhealing: scale(damage.healing?.overhealing),
      settlementCount: scale(damage.healing?.settlementCount),
    },
  };
}

export function createCyclePhaseActionIdentityMap({
  actionResolutions = [],
  loop = null,
  durationFrames = null,
} = {}) {
  const startFrame = integerOrNull(loop?.startFrame);
  const requestedDuration = integerOrNull(durationFrames);
  const resolvedDuration =
    requestedDuration != null && requestedDuration > 0
      ? requestedDuration
      : startFrame == null || integerOrNull(loop?.endFrame) == null
        ? null
        : integerOrNull(loop.endFrame) - startFrame;
  const actionIdentityById = new Map();
  if (startFrame == null || !(resolvedDuration > 0)) {
    return {
      actionIdentityById,
      proof: {
        policy: 'cycle-phase-semantic-action-bijection-v1',
        mappedActionCount: 0,
        mappedPhaseCount: 0,
        ambiguousPhaseCount: 0,
      },
    };
  }

  const groups = new Map();
  for (const resolution of actionResolutions ?? []) {
    const actionId = textOrNull(resolution?.actionId);
    const actionStartFrame = integerOrNull(resolution?.startFrame);
    if (!actionId || actionStartFrame == null) continue;
    const phaseFrame = positiveModulo(
      actionStartFrame - startFrame,
      resolvedDuration
    );
    const cycleIndex = Math.floor(
      (actionStartFrame - startFrame) / resolvedDuration
    );
    const semanticHash = hashCanonicalValue(
      createCycleActionSemanticSignature(resolution)
    );
    const groupKey = `${phaseFrame}|${semanticHash}`;
    const group = groups.get(groupKey) ?? {
      phaseFrame,
      semanticHash,
      rows: [],
    };
    group.rows.push({ actionId, cycleIndex });
    groups.set(groupKey, group);
  }

  let mappedPhaseCount = 0;
  let ambiguousPhaseCount = 0;
  for (const group of groups.values()) {
    const byCycle = new Map();
    for (const row of group.rows) {
      const bucket = byCycle.get(row.cycleIndex) ?? [];
      bucket.push(row);
      byCycle.set(row.cycleIndex, bucket);
    }
    const ambiguous = [...byCycle.values()].some(bucket => bucket.length !== 1);
    const loopRepresentativeCount = byCycle.get(0)?.length ?? 0;
    if (ambiguous || loopRepresentativeCount !== 1 || group.rows.length < 2) {
      if (ambiguous) ambiguousPhaseCount += 1;
      continue;
    }
    const canonicalIdentity = `cycle-phase:${group.phaseFrame}:${group.semanticHash}`;
    for (const row of group.rows) {
      actionIdentityById.set(row.actionId, canonicalIdentity);
    }
    mappedPhaseCount += 1;
  }

  return {
    actionIdentityById,
    proof: {
      policy: 'cycle-phase-semantic-action-bijection-v1',
      mappedActionCount: actionIdentityById.size,
      mappedPhaseCount,
      ambiguousPhaseCount,
    },
  };
}

function createCycleActionSemanticSignature(resolution) {
  const actualNormalInput = resolution?.normalAttackInputResolution?.actual;
  return {
    intentKind: resolution?.intentKind ?? null,
    ownerKind: resolution?.ownerKind ?? null,
    ownerSlotId: resolution?.ownerSlotId ?? null,
    ownerId: resolution?.ownerId ?? null,
    sourceSlotId: resolution?.sourceSlotId ?? null,
    targetSlotId: resolution?.targetSlotId ?? null,
    targetCharacterId: resolution?.targetCharacterId ?? null,
    kiboId: resolution?.kiboId ?? null,
    publicActionId: resolution?.publicActionId ?? null,
    actionKind: resolution?.actionKind ?? null,
    publicVariantIndex: integerOrNull(resolution?.publicVariantIndex),
    level: integerOrNull(resolution?.level),
    durationFrames: integerOrNull(resolution?.durationFrames),
    mappingIdentity: resolution?.mappingIdentity ?? null,
    sourceEvidenceStatus: resolution?.sourceEvidenceStatus ?? null,
    scenarioRuntimeStatus: resolution?.scenarioRuntimeStatus ?? null,
    resolvedControlSkillId: integerOrNull(resolution?.resolvedControlSkillId),
    resolvedSubSkillIndex: integerOrNull(resolution?.resolvedSubSkillIndex),
    variantResolutionStatus: resolution?.variantResolutionStatus ?? null,
    semanticVariant: resolution?.semanticVariant ?? null,
    availableHitIdentities: [
      ...(resolution?.availableHitIdentities ?? []),
    ].sort(),
    actualNormalInput: actualNormalInput
      ? {
          sequenceIndex: integerOrNull(actualNormalInput.sequenceIndex),
          controlSkillId: integerOrNull(actualNormalInput.controlSkillId),
          subSkillIndex: integerOrNull(actualNormalInput.subSkillIndex),
          chainIdentity: actualNormalInput.chainIdentity ?? null,
          semanticName: actualNormalInput.semanticName ?? null,
          sourceKind: actualNormalInput.sourceKind ?? null,
          sourceIdentity: actualNormalInput.sourceIdentity ?? null,
        }
      : null,
  };
}

function createLoopReplayPlan({
  contract,
  actionResolutions,
  loop,
  replayCount = 2,
}) {
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
  const normalizedReplayCount = Math.max(
    2,
    Math.min(MAX_REPLAY_CYCLES, Number(replayCount) || 2)
  );
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
      continue;
    }
    if (actionStart >= endFrame) continue;
    loopActions.push({ action, actionStart, actionEnd });
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
  const actionIdToSourceActionId = new Map();
  const actionIdsByCycle = [];
  const actionsByCycle = [];
  const sourceActions = loopActions.map(entry => entry.action);
  const sourceActionIds = sourceActions.map(action => String(action.id));
  for (const actionId of sourceActionIds) {
    actionIdToSourceActionId.set(actionId, actionId);
  }
  actionsByCycle.push(sourceActions);
  actionIdsByCycle.push(new Set(sourceActionIds));

  for (
    let cycleIndex = 1;
    cycleIndex < normalizedReplayCount;
    cycleIndex += 1
  ) {
    const sourceToReplayActionId = new Map();
    const cycleActions = loopActions.map(({ action, actionStart }, index) => {
      const replayId = createUniqueCycleActionId(
        action.id,
        existingIds,
        index,
        cycleIndex + 1
      );
      existingIds.add(replayId);
      actionIdToSourceActionId.set(replayId, String(action.id));
      sourceToReplayActionId.set(String(action.id), replayId);
      const clone = structuredClone(action);
      clone.id = replayId;
      clone.schedule = {
        mode: 'absolute',
        frame: actionStart + durationFrames * cycleIndex,
        offsetFrames: 0,
        actionId: null,
      };
      if (
        clone.intent?.actionKind === 'charged-attack' &&
        clone.intent?.physicalInput
      ) {
        // Every replayed charge has a different predecessor and absolute
        // frame. Re-derive release -> repress -> prehold from that cycle's
        // canonical runtime context.
        delete clone.intent.physicalInput;
      }
      if (clone.intent?.attackInput?.groupId) {
        clone.intent.attackInput.groupId = `${clone.intent.attackInput.groupId}:cycle-${cycleIndex + 1}`;
      }
      clone.note = [
        clone.note,
        `cycle ${cycleIndex + 1} replay of ${action.id}`,
      ]
        .filter(Boolean)
        .join(' | ');
      return clone;
    });
    for (const clone of cycleActions) {
      const contextActionId = clone.intent?.attackInput?.contextActionId;
      const replayContextActionId = sourceToReplayActionId.get(
        String(contextActionId ?? '')
      );
      if (replayContextActionId) {
        clone.intent.attackInput.contextActionId = replayContextActionId;
      }
    }
    actionsByCycle.push(cycleActions);
    actionIdsByCycle.push(
      new Set(cycleActions.map(action => String(action.id)))
    );
  }
  const replayContract = structuredClone(contract);
  const replayHorizonFrame = Math.max(
    Number(contract.scenario.durationFrames) || 0,
    endFrame + durationFrames * (normalizedReplayCount - 1)
  );
  replayContract.scenario.durationFrames = replayHorizonFrame;
  replayContract.actions = [...warmupActions, ...actionsByCycle.flat()];
  replayContract.metadata = {
    ...(replayContract.metadata ?? {}),
    cycleReplay: {
      interval: '[start,end)',
      startFrame,
      endFrame,
      replayCount: normalizedReplayCount,
    },
  };
  return {
    valid: true,
    issues: [],
    contract: replayContract,
    durationFrames,
    warmupActionIds: warmupActions.map(action => action.id),
    sourceActionIds,
    replayCount: normalizedReplayCount,
    actionsByCycle,
    actionIdsByCycle,
    actionIdToSourceActionId,
    secondActionIds: actionIdsByCycle[1] ?? new Set(),
    secondToSourceActionId: new Map(
      [...(actionIdsByCycle[1] ?? [])].map(actionId => [
        actionId,
        actionIdToSourceActionId.get(actionId),
      ])
    ),
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
      loopPlan.actionIdToSourceActionId.get(String(action.id)) ??
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

function createRepeatedCycleExecutionProof({
  trace,
  actionIdsByCycle,
  actionIdToSourceActionId,
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
  const cycleProofs = [];
  for (
    let cycleIndex = 0;
    cycleIndex < (actionIdsByCycle?.length ?? 0);
    cycleIndex += 1
  ) {
    const cycleIssues = [];
    const cyclePairs = [];
    for (const actionId of actionIdsByCycle[cycleIndex] ?? []) {
      const entry = byId.get(String(actionId));
      if (!entry || entry.execute === false) {
        cycleIssues.push(
          cycleIssue(
            'machine-axis-cycle-second-action-not-executable',
            `executionPlan.${actionId}`,
            `Cycle ${cycleIndex + 1} action is not executable: ${actionId}`,
            {
              actionId,
              cycleIndex,
              status: entry?.status ?? 'missing',
              skipReason: entry?.skipReason ?? null,
            }
          )
        );
      } else if (entry.status === 'scheduled-with-unresolved-conditions') {
        cycleIssues.push(
          cycleIssue(
            'machine-axis-cycle-second-action-unresolved',
            `executionPlan.${actionId}`,
            `Cycle ${cycleIndex + 1} action still has unresolved conditions: ${actionId}`,
            {
              actionId,
              cycleIndex,
              unresolvedCodes: entry.unresolvedCodes ?? [],
            }
          )
        );
      }
      const sourceActionId =
        actionIdToSourceActionId?.get?.(String(actionId)) ?? String(actionId);
      const sourceVariant = projectResolvedActionForm(
        resolutionById.get(String(sourceActionId))
      );
      const replayVariant = projectResolvedActionForm(
        resolutionById.get(String(actionId))
      );
      const equivalent =
        sourceActionId != null &&
        hashCanonicalValue(sourceVariant) === hashCanonicalValue(replayVariant);
      const pair = {
        cycleIndex,
        sourceActionId: sourceActionId ?? null,
        replayActionId: actionId,
        equivalent,
        sourceVariant,
        replayVariant,
      };
      cyclePairs.push(pair);
      variantPairs.push(pair);
      if (!equivalent) {
        cycleIssues.push(
          cycleIssue(
            'machine-axis-cycle-action-form-not-closed',
            `executionPlan.${actionId}`,
            `Cycle ${cycleIndex + 1} action resolves to a different executable form: ${actionId}`,
            {
              actionId,
              cycleIndex,
              sourceActionId: sourceActionId ?? null,
              sourceVariant,
              replayVariant,
            }
          )
        );
      }
    }
    issues.push(...cycleIssues);
    cycleProofs.push({
      cycleIndex,
      runnable: cycleIssues.length === 0,
      issues: cycleIssues,
      variantPairs: cyclePairs,
    });
  }
  return {
    runnable: issues.length === 0,
    issues,
    variantPairs,
    cycleProofs,
  };
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
  settlementReadiness,
}) {
  const fps = Number(envelope.contract.scenario.fps) || 60;
  const durationFrames = envelope.loop.endFrame - envelope.loop.startFrame;
  const aggregate = aggregateSamples(samples);
  const sampleStatistics = createCycleSampleStatistics({
    samples,
    durationSeconds: durationFrames / fps,
    aggregate,
  });
  const warnings = dedupeIssues([
    ...samples.flatMap(sample => [
      ...(sample.evidence?.firstCycle?.warnings ?? []),
      ...(sample.evidence?.replay?.warnings ?? []),
    ]),
    ...(settlementReadiness?.warnings ?? []).map(entry =>
      cycleWarning(entry.code, entry.path, entry.message, {
        contractId: entry.contractId,
        contractHash: entry.contractHash,
      })
    ),
  ]);
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
    stabilization: {
      policy: MACHINE_AXIS_EVENTUAL_PERIOD_POLICY,
      maxReplayCycles: envelope.options.maxReplayCycles,
      maxPeriodCycles: envelope.options.maxPeriodCycles,
      minimumPeriodRepeats: envelope.options.minimumPeriodRepeats,
      samples: samples.map(sample => ({
        seed: sample.seed ?? null,
        replayCount: sample.loopPlan?.replayCount ?? null,
        operationPeriod: sample.replayProof?.operationPeriod ?? null,
        resourcePeriod: sample.replayProof?.resourcePeriod ?? null,
        metricPeriod: sample.replayProof?.metricPeriod ?? null,
        scoreStatePeriod: sample.replayProof?.scoreStatePeriod ?? null,
      })),
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
      settlementReadiness?.formalReady === false
        ? null
        : roundMetric(
            aggregate.hpDamage / Math.max(VALUE_TOLERANCE, durationFrames / fps)
          ),
    formalStatus:
      settlementReadiness?.formalReady === true
        ? settlementReadiness.formalStatus
        : settlementReadiness?.formalReady === false
          ? 'blocked-runtime-semantics-evidence-open'
          : 'formal-score-ready',
    ...(settlementContract == null
      ? {}
      : { formalScorePolicy: settlementContract.formalScoring }),
    sampleStatistics,
    contributions: aggregate.contributions,
    optimizationDiagnostics: aggregateMachineAxisOptimizationDiagnostics(
      samples.map(sample => sample.optimizationDiagnostics)
    ),
    actionLegalityProof:
      samples.length === 1
        ? samples[0].actionLegalityProof
        : {
            passed: samples.every(
              sample => sample.actionLegalityProof?.passed === true
            ),
            samples: samples.map(sample => ({
              seed: sample.seed ?? null,
              proof: sample.actionLegalityProof ?? null,
            })),
          },
    normalAttackInputProof: createAggregateNormalAttackInputProof(samples),
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
    ...(settlementContract == null
      ? {}
      : { enemySettlementTiming: settlementContract }),
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
    optimizationDiagnostics: value.optimizationDiagnostics,
    actionLegalityProof: value.actionLegalityProof,
    normalAttackInputProof: value.normalAttackInputProof,
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
    formalScore: null,
    formalStatus: 'formal-score-ineligible',
    critical,
    loop: isRecord(envelope?.loop)
      ? {
          interval: '[start,end)',
          startFrame: envelope.loop.startFrame ?? null,
          endFrame: envelope.loop.endFrame ?? null,
        }
      : null,
    samples: samples.map(projectSampleReport),
    actionLegalityProof:
      samples.length === 0
        ? null
        : samples.length === 1
          ? (samples[0].actionLegalityProof ?? null)
          : {
              passed: samples.every(
                sample => sample.actionLegalityProof?.passed === true
              ),
              samples: samples.map(sample => ({
                seed: sample.seed ?? null,
                proof: sample.actionLegalityProof ?? null,
              })),
            },
    normalAttackInputProof: createAggregateNormalAttackInputProof(samples),
    optimizationDiagnostics: aggregateMachineAxisOptimizationDiagnostics(
      samples.map(sample => sample.optimizationDiagnostics)
    ),
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
  const hpDamage = mean(
    samples.map(sample => sampleCycleMetric(sample).hpDamage)
  );
  const combatHitCount = mean(
    samples.map(sample => sampleCycleMetric(sample).combatHitCount)
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
      mean(
        samples.map(
          sample => sampleCycleMetric(sample).healing?.requestedHealing
        )
      )
    ),
    effectiveHealing: roundMetric(
      mean(
        samples.map(
          sample => sampleCycleMetric(sample).healing?.effectiveHealing
        )
      )
    ),
    overhealing: roundMetric(
      mean(
        samples.map(sample => sampleCycleMetric(sample).healing?.overhealing)
      )
    ),
    effectiveHps: roundMetric(
      mean(
        samples.map(sample => sampleCycleMetric(sample).healing?.effectiveHps)
      )
    ),
    settlementCount: roundMetric(
      mean(
        samples.map(
          sample => sampleCycleMetric(sample).healing?.settlementCount
        )
      )
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
    samples.map(sample => Number(sampleCycleMetric(sample)?.hpDamage) || 0)
  );
  const cycleDps = describeCycleSampleValues(
    samples.map(
      sample =>
        (Number(sampleCycleMetric(sample)?.hpDamage) || 0) /
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
        samples.map(
          sample => sampleCycleMetric(sample).healing?.requestedHealing ?? 0
        )
      ),
      effectiveHealing: describeCycleSampleValues(
        samples.map(
          sample => sampleCycleMetric(sample).healing?.effectiveHealing ?? 0
        )
      ),
      overhealing: describeCycleSampleValues(
        samples.map(
          sample => sampleCycleMetric(sample).healing?.overhealing ?? 0
        )
      ),
      effectiveHps: describeCycleSampleValues(
        samples.map(
          sample => sampleCycleMetric(sample).healing?.effectiveHps ?? 0
        )
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
    for (const row of sampleCycleMetric(sample)[key] ?? []) {
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
    for (const row of sampleCycleMetric(sample).healing?.[key] ?? []) {
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

function sampleCycleMetric(sample) {
  return sample?.steadyCycle ?? sample?.firstCycle ?? {};
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
    steadyCycle: sample.steadyCycle ?? null,
    observedCycles: sample.observedCycles ?? [],
    replayProof: sample.replayProof ?? null,
    actionLegalityProof: sample.actionLegalityProof ?? null,
    normalAttackInputProof: sample.normalAttackInputProof ?? null,
    optimizationDiagnostics: sample.optimizationDiagnostics ?? null,
    loopPlan: sample.loopPlan ?? null,
    state: sample.state ?? null,
    evidence: sample.evidence ?? null,
  };
}

function createAggregateNormalAttackInputProof(samples) {
  if (!Array.isArray(samples) || samples.length === 0) return null;
  const authority =
    samples[0]?.normalAttackInputProof?.normalAttackInputAuthority ??
    samples[0]?.normalAttackInputProof?.firstCycle
      ?.normalAttackInputAuthority ??
    null;
  return {
    passed: samples.every(
      sample => sample.normalAttackInputProof?.passed === true
    ),
    normalAttackInputAuthority: authority,
    samples: samples.map(sample => ({
      seed: sample.seed ?? null,
      proof: sample.normalAttackInputProof ?? null,
    })),
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

function normalizeChargeCooldownState(
  snapshot,
  { actionIdentityById = null } = {}
) {
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
        row.lastSettlementIdentity,
        actionIdentityById
      ),
      lastCooldownReductionTransactionId: normalizeCycleLocalCooldownIdentity(
        row.lastCooldownReductionTransactionId,
        actionIdentityById
      ),
      missingChargeSourceActionIds: [
        ...(row.missingChargeSourceActionIds ?? []),
      ].map(value => normalizeCycleActionReference(value, actionIdentityById)),
    }))
    .filter(row => row.sharedTimerRunning === true && row.remainingFrames > 0)
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

function normalizeCycleLocalCooldownIdentity(value, actionIdentityById = null) {
  if (value == null) return null;
  return String(value)
    .split('|')
    .map(token => normalizeCycleActionReference(token, actionIdentityById))
    .join('|');
}

function normalizeCycleActionReference(value, actionIdentityById = null) {
  if (value == null) return null;
  const identity = String(value);
  const mapped = actionIdentityById?.get?.(identity);
  if (mapped) return mapped;
  return identity.replace(/^cycle-\d+:/, '');
}

function normalizeCycleActionScopedIdentity(value, actionIdentityById = null) {
  if (value == null) return null;
  const identity = String(value);
  const sourceMarker = '|source:';
  const sourceIndex = identity.lastIndexOf(sourceMarker);
  if (sourceIndex < 0) {
    return normalizeCycleActionReference(identity, actionIdentityById);
  }
  const sourceActionId = identity.slice(sourceIndex + sourceMarker.length);
  return `${identity.slice(0, sourceIndex + sourceMarker.length)}${normalizeCycleActionReference(sourceActionId, actionIdentityById)}`;
}

function normalizeEffectState(snapshot, { actionIdentityById = null } = {}) {
  const timeMs = Number(snapshot.timeMs) || 0;
  return (snapshot.effects ?? [])
    .map(row => ({
      effectId: normalizeCycleActionScopedIdentity(
        row.effectId,
        actionIdentityById
      ),
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

function normalizePendingState(snapshot, { actionIdentityById = null } = {}) {
  const currentFrame = Number(snapshot.currentFrame) || 0;
  return (snapshot.pendingEvents ?? [])
    .map(row => ({
      kind: row.kind ?? null,
      actionIdentity: normalizeCycleActionReference(
        row.actionId,
        actionIdentityById
      ),
      identity: normalizeCycleActionScopedIdentity(
        row.identity,
        actionIdentityById
      ),
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

function createUniqueCycleActionId(
  sourceId,
  existingIds,
  index,
  cycleNumber = 2
) {
  const base = `cycle-${cycleNumber}:${String(sourceId)}`;
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

function cycleWarning(code, path, message, details = {}) {
  return { severity: 'warning', code, path, message, ...details };
}

function normalizeSeeds(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(seed => (seed == null ? null : String(seed)))
    .filter(seed => seed != null && seed.length > 0);
}

function validateCyclePeriodOption({
  issues,
  options,
  key,
  minimum,
  maximum,
  fallback,
}) {
  if (options?.[key] == null) return;
  const value = positiveIntegerOrNull(options[key]);
  if (value == null || value < minimum || value > maximum) {
    issues.push(
      cycleIssue(
        'machine-axis-cycle-period-option-invalid',
        `options.${key}`,
        `${key} must be an integer in [${minimum}, ${maximum}]`,
        { key, value: options[key], minimum, maximum, fallback }
      )
    );
  }
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

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function positiveModulo(value, divisor) {
  const remainder = Number(value) % Number(divisor);
  return remainder < 0 ? remainder + Number(divisor) : remainder;
}

function textOrNull(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
