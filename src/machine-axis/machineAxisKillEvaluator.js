import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization';
import {
  createEnemyProfileIdentity,
  validateMachineAxisEnemyProfile,
} from './machineAxisEnemyProfileContract';
import { createMachineAxisHealingStatistics } from './machineAxisHealingStatistics';
import {
  getMachineAxisEnemySettlementContract,
  getMachineAxisEnemySettlementFormalReadiness,
} from './machineAxisEnemySettlementContract';
import { validateMachineAxisObjectiveContract } from './machineAxisObjectiveContract';

export const MACHINE_AXIS_KILL_SCHEMA_VERSION = 1;
export const MACHINE_AXIS_KILL_CONTRACT_NAME = 'AzPrMachineAxisFastestKill';
export const MACHINE_AXIS_KILL_KIND = 'azpr-machine-axis-fastest-kill';
export const FASTEST_KILL_TARGET_POLICY = Object.freeze({
  hpMode: 'finite',
  toughnessMode: 'enabled',
  breakMode: 'enabled',
  deathTruncation: 'enabled',
});

export function createMachineAxisKillEvaluator({ service } = {}) {
  if (!service || typeof service.simulate !== 'function') {
    throw new TypeError(
      'Machine Axis kill evaluator requires a simulate service'
    );
  }
  function evaluate(envelope, options = {}) {
    const source = normalizeKillEnvelope(envelope);
    const objectiveContract =
      options.objectiveContract ?? source.objectiveContract;
    const issues = validateKillEnvelope(envelope, source, objectiveContract);
    if (issues.length > 0) return createRejectedKillReport(source, issues);
    const contract = createFastestKillScenarioContract(source.contract, {
      ...options,
      objectiveContract,
    });
    let run;
    try {
      run = service.simulate(contract);
    } catch (error) {
      return createRejectedKillReport(source, normalizeErrorIssues(error));
    }
    return createFastestKillProof(run, contract, {
      objectiveContract,
      allowUnverifiedRuntimeTiming:
        options.allowUnverifiedRuntimeTiming === true,
    });
  }
  return Object.freeze({ evaluate });
}

export function createFastestKillScenarioContract(contract, options = {}) {
  const value = structuredClone(contract);
  value.scenario.target = { ...FASTEST_KILL_TARGET_POLICY };
  if (options.criticalPolicy) {
    value.scenario.critical = {
      policy: options.criticalPolicy,
      seed: options.seed ?? value.scenario.critical?.seed ?? null,
    };
  }
  if (options.objectiveContract) {
    value.scenario.objectiveContract = structuredClone(
      options.objectiveContract
    );
  }
  return value;
}

export function createFastestKillProof(
  run,
  contract,
  { objectiveContract = null, allowUnverifiedRuntimeTiming = false } = {}
) {
  objectiveContract ??= contract?.scenario?.objectiveContract ?? null;
  const settlementContract = getMachineAxisEnemySettlementContract();
  const settlementReadiness = getMachineAxisEnemySettlementFormalReadiness();
  const objectiveValidation = validateMachineAxisObjectiveContract(
    objectiveContract,
    { formal: true }
  );
  const profileValidation = validateMachineAxisEnemyProfile(
    contract?.scenario?.enemy?.profile,
    { scenarioEnemy: contract?.scenario?.enemy }
  );
  const issues = [
    ...objectiveValidation.issues.map(entry =>
      killIssue(
        entry.code,
        `objectiveContract${entry.field ? `.${entry.field}` : ''}`,
        entry.message
      )
    ),
    ...profileValidation.issues,
  ];
  if (
    objectiveValidation.valid === true &&
    objectiveValidation.contract.objectiveId !== 'fastest-kill'
  ) {
    issues.push(
      killIssue(
        'machine-axis-fastest-kill-objective-mismatch',
        'objectiveContract.objectiveId',
        'Fastest-kill proof requires the fastest-kill objective contract'
      )
    );
  }
  if (
    profileValidation.valid &&
    profileValidation.normalized.source.status !== 'authoritative-resolved'
  ) {
    issues.push(
      killIssue(
        'machine-axis-fastest-kill-enemy-profile-not-authoritative',
        'contract.scenario.enemy.profile.source.status',
        'Fastest-kill requires an authoritative resolved enemy profile',
        { actual: profileValidation.normalized.source.status }
      )
    );
  }
  if (issues.length > 0) {
    return createRejectedKillReport(
      { contract, objectiveContract, settlementContract },
      issues,
      run?.hashes
    );
  }
  if (
    settlementReadiness.formalReady !== true &&
    allowUnverifiedRuntimeTiming !== true
  ) {
    return createRejectedKillReport(
      { contract, objectiveContract, settlementContract },
      settlementReadiness.issues,
      run?.hashes
    );
  }
  const orderedDamage = [...(run?.trace?.damage ?? [])]
    .filter(event => !event?.stateEventKind)
    .sort(compareRuntimeEvents);
  const lethalEvents = orderedDamage.filter(
    event => event.deathTriggered === true
  );
  if (lethalEvents.length === 0) {
    return createUnkilledReport({
      run,
      contract,
      objectiveContract,
      profile: profileValidation.normalized,
    });
  }
  const lethal = lethalEvents[0];
  if (!hasCompleteRuntimeCursor(lethal)) {
    return createRejectedKillReport(
      { contract, objectiveContract },
      [
        killIssue(
          'machine-axis-fastest-kill-lethal-cursor-incomplete',
          'trace.damage',
          'Lethal settlement is missing its canonical runtime cursor'
        ),
      ],
      run?.hashes
    );
  }
  const postLethalSettlements = orderedDamage.filter(
    event =>
      compareRuntimeEvents(event, lethal) > 0 &&
      (Number(event.effectiveHpDamage ?? event.rawDamage) > 0 ||
        Number(event.toughnessDamage) > 0)
  );
  const warnings = [
    ...(settlementReadiness.warnings ?? []),
    ...(postLethalSettlements.length > 0
      ? [
          killWarning(
            'machine-axis-fastest-kill-post-death-settlement-ignored',
            'trace.damage',
            'Enemy HP or toughness settlements after the first lethal cursor are diagnostic only and do not affect fastest-kill scoring',
            {
              eventCount: postLethalSettlements.length,
              eventCursors: postLethalSettlements.map(projectRuntimeCursor),
            }
          ),
        ]
      : []),
  ];
  const fps = Number(contract.scenario?.fps) || 60;
  const timeMs = Number(lethal.timeMs);
  const frame = Number(lethal.absoluteFrame);
  const requestedHpDamage = Number(lethal.requestedHpDamage);
  const effectiveHpDamage = Number(
    lethal.effectiveHpDamage ?? lethal.rawDamage
  );
  if (
    !Number.isFinite(requestedHpDamage) ||
    !Number.isFinite(effectiveHpDamage)
  ) {
    return createRejectedKillReport(
      { contract, objectiveContract },
      [
        killIssue(
          'machine-axis-fastest-kill-lethal-damage-proof-missing',
          'trace.damage',
          'Lethal packet is missing requested/effective HP damage evidence'
        ),
      ],
      run?.hashes
    );
  }
  const healing = createMachineAxisHealingStatistics(run.trace?.events ?? [], {
    durationMs: timeMs,
    fps,
    killCursor: lethal,
  });
  const diagnostics = createKillDiagnostics(run, { endEvent: lethal });
  const proof = {
    feasible: true,
    firstLethal: {
      frame,
      timeMs,
      cursor: projectRuntimeCursor(lethal),
      actionId: lethal.actionId ?? null,
      actorId: lethal.actorId ?? null,
      hitIdentity: lethal.hitIdentity ?? null,
      hitKey: lethal.hitKey ?? null,
      hitIndex: lethal.hitIndex ?? null,
      requestedHpDamage,
      effectiveHpDamage,
      overkill: Number(lethal.overkill) || 0,
      toughnessDamage: Number(lethal.toughnessDamage) || 0,
      breakTriggered: lethal.breakTriggered === true,
      deathTriggered: true,
      settlementOrder: Array.isArray(lethal.settlementOrder)
        ? [...lethal.settlementOrder]
        : null,
    },
    stopAfterDeath: {
      verified: postLethalSettlements.length === 0,
      postLethalSettlementCount: postLethalSettlements.length,
      scoreImpact: 'none-after-first-lethal-cursor',
    },
  };
  const report = {
    schemaVersion: MACHINE_AXIS_KILL_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_KILL_CONTRACT_NAME,
    kind: 'azpr-machine-axis-fastest-kill-evaluation',
    valid: true,
    status: 'killed',
    issues: [],
    warnings,
    objectiveContract,
    enemySettlementTiming: settlementContract,
    enemyProfile: createEnemyProfileIdentity(profileValidation.normalized),
    targetPolicy: FASTEST_KILL_TARGET_POLICY,
    score: {
      direction: 'minimize',
      killFeasible: true,
      timeMs,
      frame,
    },
    formalScore: settlementReadiness.formalReady === true ? timeMs : null,
    formalStatus:
      settlementReadiness.formalReady === true
        ? settlementReadiness.formalStatus
        : 'blocked-runtime-semantics-evidence-open',
    formalScorePolicy: settlementContract.formalScoring,
    killProof: proof,
    diagnostics,
    healing,
    hashes: {
      ...(run.hashes ?? {}),
      kill: null,
    },
  };
  report.hashes.kill = hashCanonicalValue({
    objectiveContract,
    enemySettlementTiming: report.enemySettlementTiming,
    enemyProfile: report.enemyProfile,
    targetPolicy: report.targetPolicy,
    score: report.score,
    formalScore: report.formalScore,
    formalStatus: report.formalStatus,
    formalScorePolicy: report.formalScorePolicy,
    warnings: report.warnings,
    killProof: report.killProof,
    diagnostics: report.diagnostics,
    healing: report.healing,
    runHashes: run.hashes ?? null,
  });
  return report;
}

export function compareFastestKillCandidates(left, right) {
  const leftFeasible = left?.killProof?.feasible === true;
  const rightFeasible = right?.killProof?.feasible === true;
  if (leftFeasible !== rightFeasible) return leftFeasible ? -1 : 1;
  if (leftFeasible) {
    const frameOrder =
      Number(left.killProof.firstLethal.frame) -
      Number(right.killProof.firstLethal.frame);
    if (frameOrder !== 0) return frameOrder;
    const timeOrder =
      Number(left.killProof.firstLethal.timeMs) -
      Number(right.killProof.firstLethal.timeMs);
    if (timeOrder !== 0) return timeOrder;
    const cursorOrder = compareRuntimeEvents(
      left.killProof.firstLethal.cursor,
      right.killProof.firstLethal.cursor
    );
    if (cursorOrder !== 0) return cursorOrder;
  }
  return String(left?.hashes?.input ?? '').localeCompare(
    String(right?.hashes?.input ?? ''),
    'en'
  );
}

function normalizeKillEnvelope(value) {
  const source = isRecord(value) ? value : {};
  return {
    schemaVersion: source.schemaVersion ?? MACHINE_AXIS_KILL_SCHEMA_VERSION,
    contractName: source.contractName ?? MACHINE_AXIS_KILL_CONTRACT_NAME,
    kind: source.kind ?? MACHINE_AXIS_KILL_KIND,
    contract: isRecord(source.contract)
      ? structuredClone(source.contract)
      : null,
    objectiveContract: isRecord(source.objectiveContract)
      ? structuredClone(source.objectiveContract)
      : null,
  };
}

function validateKillEnvelope(raw, normalized, objectiveContract) {
  const issues = [];
  if (!isRecord(raw)) {
    issues.push(
      killIssue(
        'machine-axis-fastest-kill-envelope-invalid',
        '',
        'Fastest-kill input must be an object'
      )
    );
  }
  if (normalized.schemaVersion !== MACHINE_AXIS_KILL_SCHEMA_VERSION) {
    issues.push(
      killIssue(
        'machine-axis-fastest-kill-schema-version-unsupported',
        'schemaVersion',
        `Unsupported fastest-kill schema version: ${normalized.schemaVersion}`
      )
    );
  }
  if (normalized.contractName !== MACHINE_AXIS_KILL_CONTRACT_NAME) {
    issues.push(
      killIssue(
        'machine-axis-fastest-kill-contract-name-unsupported',
        'contractName',
        `Unsupported fastest-kill contract: ${normalized.contractName}`
      )
    );
  }
  if (normalized.kind !== MACHINE_AXIS_KILL_KIND) {
    issues.push(
      killIssue(
        'machine-axis-fastest-kill-kind-unsupported',
        'kind',
        `Unsupported fastest-kill kind: ${normalized.kind}`
      )
    );
  }
  if (!normalized.contract) {
    issues.push(
      killIssue(
        'machine-axis-fastest-kill-contract-required',
        'contract',
        'Fastest-kill requires a Machine Axis contract'
      )
    );
  }
  if (normalized.contract) {
    issues.push(
      ...validateMachineAxisEnemyProfile(
        normalized.contract.scenario?.enemy?.profile,
        { scenarioEnemy: normalized.contract.scenario?.enemy }
      ).issues
    );
  }
  const objectiveValidation = validateMachineAxisObjectiveContract(
    objectiveContract,
    { formal: true }
  );
  issues.push(
    ...objectiveValidation.issues.map(entry =>
      killIssue(
        entry.code,
        `objectiveContract${entry.field ? `.${entry.field}` : ''}`,
        entry.message
      )
    )
  );
  if (
    objectiveValidation.valid === true &&
    objectiveValidation.contract.objectiveId !== 'fastest-kill'
  ) {
    issues.push(
      killIssue(
        'machine-axis-fastest-kill-objective-mismatch',
        'objectiveContract.objectiveId',
        'Fastest-kill evaluator requires the fastest-kill objective contract'
      )
    );
  }
  return issues;
}

function createUnkilledReport({ run, contract, objectiveContract, profile }) {
  const settlementContract = getMachineAxisEnemySettlementContract();
  const settlementReadiness = getMachineAxisEnemySettlementFormalReadiness();
  const diagnostics = createKillDiagnostics(run);
  const healing = createMachineAxisHealingStatistics(run.trace?.events ?? [], {
    durationMs: run.trace?.scenario?.durationMs ?? 0,
    fps: run.trace?.scenario?.frameRate ?? contract.scenario?.fps ?? 60,
  });
  const report = {
    schemaVersion: MACHINE_AXIS_KILL_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_KILL_CONTRACT_NAME,
    kind: 'azpr-machine-axis-fastest-kill-evaluation',
    valid: true,
    status: 'not-killed',
    issues: [],
    warnings: settlementReadiness.warnings,
    objectiveContract,
    enemySettlementTiming: settlementContract,
    enemyProfile: createEnemyProfileIdentity(profile),
    targetPolicy: FASTEST_KILL_TARGET_POLICY,
    score: {
      direction: 'minimize',
      killFeasible: false,
      timeMs: null,
      frame: null,
    },
    formalScore: null,
    formalStatus: 'not-killed',
    formalScorePolicy: settlementContract.formalScoring,
    killProof: {
      feasible: false,
      reason: 'enemy-not-killed-within-axis-horizon',
      firstLethal: null,
    },
    diagnostics,
    healing,
    hashes: { ...(run.hashes ?? {}), kill: null },
  };
  report.hashes.kill = hashCanonicalValue({
    objectiveContract,
    enemySettlementTiming: report.enemySettlementTiming,
    enemyProfile: report.enemyProfile,
    targetPolicy: report.targetPolicy,
    score: report.score,
    formalScore: report.formalScore,
    formalStatus: report.formalStatus,
    formalScorePolicy: report.formalScorePolicy,
    warnings: report.warnings,
    killProof: report.killProof,
    diagnostics,
    healing,
    runHashes: run.hashes ?? null,
  });
  return report;
}

function createRejectedKillReport(source, issues, hashes = null) {
  return {
    schemaVersion: MACHINE_AXIS_KILL_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_KILL_CONTRACT_NAME,
    kind: 'azpr-machine-axis-fastest-kill-evaluation',
    valid: false,
    status: 'rejected',
    issues,
    warnings: [],
    objectiveContract: source?.objectiveContract ?? null,
    enemySettlementTiming:
      source?.settlementContract ?? getMachineAxisEnemySettlementContract(),
    enemyProfile: source?.contract?.scenario?.enemy?.profile
      ? createEnemyProfileIdentity(source.contract.scenario.enemy.profile)
      : null,
    targetPolicy: FASTEST_KILL_TARGET_POLICY,
    score: null,
    formalScore: null,
    formalStatus: 'rejected',
    formalScorePolicy:
      source?.settlementContract?.formalScoring ??
      getMachineAxisEnemySettlementContract().formalScoring,
    killProof: null,
    diagnostics: null,
    healing: null,
    hashes: { ...(hashes ?? {}), kill: null },
  };
}

function createKillDiagnostics(run, { endEvent = null } = {}) {
  const damage = (run?.trace?.damage ?? []).filter(event => {
    if (event?.stateEventKind) return false;
    return endEvent == null || compareRuntimeEvents(event, endEvent) <= 0;
  });
  return {
    fixedDurationHpDamage: roundMetric(
      damage.reduce(
        (sum, event) =>
          sum + Number(event.effectiveHpDamage ?? event.rawDamage ?? 0),
        0
      )
    ),
    rawToughnessDamage: roundMetric(
      damage.reduce((sum, event) => sum + Number(event.toughnessDamage ?? 0), 0)
    ),
    netToughnessDamage:
      Number(run?.evaluation?.totals?.netToughnessDamage) || 0,
    hitCount: damage.length,
  };
}

function hasCompleteRuntimeCursor(event) {
  return [
    event?.absoluteFrame,
    event?.runtimePhasePriority,
    event?.runtimePriority,
    event?.runtimeSequenceIndex,
  ].every(Number.isFinite);
}

function projectRuntimeCursor(event) {
  return {
    absoluteFrame: Number(event?.absoluteFrame),
    timeMs: Number(event?.timeMs),
    runtimePhasePriority: Number(event?.runtimePhasePriority),
    runtimePriority: Number(event?.runtimePriority),
    runtimeSequenceIndex: Number(event?.runtimeSequenceIndex),
  };
}

function compareRuntimeEvents(left, right) {
  return (
    Number(left?.absoluteFrame) - Number(right?.absoluteFrame) ||
    Number(left?.runtimePhasePriority) - Number(right?.runtimePhasePriority) ||
    Number(left?.runtimePriority) - Number(right?.runtimePriority) ||
    Number(left?.runtimeSequenceIndex) - Number(right?.runtimeSequenceIndex)
  );
}

function normalizeErrorIssues(error) {
  if (Array.isArray(error?.issues)) return error.issues;
  return [
    killIssue(
      'machine-axis-fastest-kill-runtime-failed',
      'contract',
      error instanceof Error ? error.message : String(error)
    ),
  ];
}

function killIssue(code, path, message, details = {}) {
  return { severity: 'error', code, path, message, ...details };
}

function killWarning(code, path, message, details = {}) {
  return { severity: 'warning', code, path, message, ...details };
}

function isRecord(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function roundMetric(value) {
  return Number(Number(value ?? 0).toFixed(8));
}
