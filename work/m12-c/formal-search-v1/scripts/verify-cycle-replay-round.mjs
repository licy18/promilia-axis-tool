import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer } from 'vite';

import {
  createCandidateRawIdentity,
  readJson,
  sha256Canonical,
  writeJsonAtomic,
} from './formal-search-artifacts.mjs';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..'
);
const roundArgument = readArgument('--round');
if (!roundArgument) {
  throw new Error(
    'Usage: node verify-cycle-replay-round.mjs --round <round-directory>'
  );
}

const roundDirectory = path.resolve(projectRoot, roundArgument);
const manifest = await readJson(path.join(roundDirectory, 'round-manifest.json'));
const checkpoint = await readJson(
  path.join(roundDirectory, 'round-checkpoint.json')
);
const aggregate = await readJson(path.join(roundDirectory, 'aggregate.json'));
if (
  ![
    'cycle-dps-no-toughness',
    'cycle-dps-with-toughness',
  ].includes(manifest.objective)
) {
  throw new Error('Cycle replay verifier requires a closed-cycle objective');
}
if (!manifest.cycleReplayProvenance) {
  throw new Error('Round does not declare fixed cycle replay provenance');
}

const mechanicsPackage = await readJson(
  path.join(
    projectRoot,
    'src',
    'data',
    'generated',
    'verified-combat-mechanics-package.json'
  )
);
const vite = await createServer({
  root: projectRoot,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});

let report;
try {
  const [packageModule, serviceModule] = await Promise.all([
    vite.ssrLoadModule('/src/data/verifiedCombatMechanicsPackage.js'),
    vite.ssrLoadModule('/src/machine-axis/machineAxisService.js'),
  ]);
  packageModule.installVerifiedCombatMechanicsPackage(mechanicsPackage);
  const service = serviceModule.createMachineAxisService();
  report = await verifyRound({ service });
} finally {
  await vite.close();
}

const verificationHash = sha256Canonical(report);
const output = { ...report, verificationHash };
const write = await writeJsonAtomic(
  path.join(roundDirectory, 'independent-verification.json'),
  output
);
process.stdout.write(
  `${JSON.stringify({
    valid: output.valid,
    issueCount: output.issues.length,
    verifiedCandidateCount: output.coverage.verifiedCandidateCount,
    verificationHash,
    output: repositoryRelative(write.path),
  })}\n`
);
if (!output.valid) process.exitCode = 1;

async function verifyRound({ service }) {
  const issues = [];
  const rows = [];
  validateRoundEnvelope(issues);
  const aggregateBySource = new Map(
    [...(aggregate.results ?? []), ...(aggregate.cutoffTies ?? [])].map(row => [
      row.sourceConfigIdentity,
      row,
    ])
  );
  const shardRoot = path.join(roundDirectory, 'shards');
  const shardNames = (await fs.readdir(shardRoot, { withFileTypes: true }))
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort(compareText);
  for (const shardName of shardNames) {
    const shardDirectory = path.join(shardRoot, shardName);
    const shardCheckpoint = await readJson(
      path.join(shardDirectory, 'checkpoint.json')
    );
    if (shardCheckpoint.status !== 'completed') {
      issues.push(`${shardName}:checkpoint-not-completed`);
      continue;
    }
    const artifact = await readJson(path.join(shardDirectory, 'result.json'));
    if (
      sha256Canonical(artifact) !==
      shardCheckpoint.artifacts?.resultCanonicalSha256
    ) {
      issues.push(`${shardName}:result-canonical-hash-mismatch`);
      continue;
    }
    const candidates = artifact.serviceResult?.results ?? [];
    if (candidates.length !== 1) {
      issues.push(`${shardName}:expected-one-replay-candidate`);
      continue;
    }
    const candidate = candidates[0];
    const rowIssues = verifyCandidateStatic(candidate);
    let simulation;
    let replayProof;
    let repeatedProof;
    let validation;
    try {
      simulation = service.simulate(candidate.axis);
      replayProof = evaluate(service, candidate);
      repeatedProof = evaluate(service, candidate);
      validation = service.validate(candidate.axis);
    } catch (error) {
      rowIssues.push(`runtime-exception:${error?.message ?? String(error)}`);
    }
    if (simulation && replayProof && repeatedProof && validation) {
      compareRuntimeEvidence({
        candidate,
        simulation,
        replayProof,
        repeatedProof,
        validation,
        issues: rowIssues,
      });
    }
    const rawIdentity = createCandidateRawIdentity(
      candidate,
      manifest.objective
    );
    const aggregateCandidate = aggregateBySource.get(
      candidate.m12c?.sourceConfigIdentity
    );
    if (
      aggregateCandidate?.rawIdentity?.identityHash !== rawIdentity.identityHash
    ) {
      rowIssues.push('aggregate-raw-identity-mismatch');
    }
    const row = {
      shard: shardName,
      sourceConfigIdentity: candidate.m12c?.sourceConfigIdentity ?? null,
      buildHash: candidate.m12c?.buildHash ?? null,
      rawIdentity,
      score: candidate.score,
      actionCount: candidate.axis?.actions?.length ?? 0,
      actionHash: sha256Canonical(candidate.axis?.actions ?? []),
      inputHash: simulation?.hashes?.input ?? null,
      traceHash: simulation?.hashes?.trace ?? null,
      cycleProofHash: replayProof?.hashes?.cycle ?? null,
      legalityProofHash:
        validation?.actionLegalityProof?.proofHash ?? null,
      repeatedCycleProofHash: repeatedProof?.hashes?.cycle ?? null,
      valid: rowIssues.length === 0,
      issues: rowIssues,
    };
    rows.push(row);
    for (const issue of rowIssues) issues.push(`${shardName}:${issue}`);
  }
  const expectedCount =
    aggregate.coverage?.expectedSourceConfigIdentities?.length ?? 0;
  const validCount = rows.filter(row => row.valid).length;
  if (rows.length !== expectedCount) {
    issues.push('verified-candidate-count-does-not-match-coverage');
  }
  return {
    schemaVersion: 1,
    kind: 'azpr-m12c-formal-cycle-replay-independent-verification',
    runId: manifest.runId,
    roundId: manifest.roundId,
    objective: manifest.objective,
    rankingClaim: 'AI-guided heuristic Top-N',
    formalRankingReady: false,
    clientParityReady: false,
    aggregateHash: aggregate.aggregateHash,
    cycleReplayProvenance: manifest.cycleReplayProvenance,
    coverage: {
      expectedCandidateCount: expectedCount,
      verifiedCandidateCount: rows.length,
      validCandidateCount: validCount,
      invalidCandidateCount: rows.length - validCount,
      topNCount: aggregate.results?.length ?? 0,
      cutoffTieCount: aggregate.cutoffTies?.length ?? 0,
      rawIdentityCount: new Set(
        rows.map(row => row.rawIdentity.identityHash)
      ).size,
    },
    contractBoundary: {
      objectiveId: manifest.objective,
      loopInterval: `[${manifest.cycleReplayProvenance.loop.startFrame},${manifest.cycleReplayProvenance.loop.endFrame})`,
      enemyProfileId: 'enemy:310054:level:80:6e449b5502e76e59',
      enemyProfileHash: 'cb1edcc277fcda5b',
      initialStatePresetId: 'm12c-cycle-cold-zero-state-v1',
      criticalPolicy: 'expected',
      allowedActionSurface: [
        'hero:112001:star-skill',
        'hero:112001:normal-attack',
        'system:wait',
      ],
      autonomousKiboActionsAdmitted: false,
      semanticEquivalenceClaimed: false,
      admissibleBoundClaimed: false,
    },
    valid: issues.length === 0,
    issues,
    rows,
  };
}

function validateRoundEnvelope(issues) {
  if (checkpoint.status !== 'completed') {
    issues.push('round-checkpoint-not-completed');
  }
  if (checkpoint.aggregateHash !== aggregate.aggregateHash) {
    issues.push('round-checkpoint-aggregate-hash-mismatch');
  }
  if (manifest.formalRankingReady !== false) {
    issues.push('manifest-formal-ranking-ready-not-false');
  }
  if (aggregate.formalRankingReady !== false) {
    issues.push('aggregate-formal-ranking-ready-not-false');
  }
  if (manifest.rankingClaim !== 'AI-guided heuristic Top-N') {
    issues.push('manifest-ranking-claim-mismatch');
  }
  for (const key of [
    'failedSourceConfigIdentities',
    'inProgressSourceConfigIdentities',
    'missingSourceConfigIdentities',
  ]) {
    if ((aggregate.coverage?.[key] ?? []).length !== 0) {
      issues.push(`aggregate-${key}-not-empty`);
    }
  }
  if (
    aggregate.coverage?.completedSourceConfigIdentities?.length !==
    aggregate.coverage?.expectedSourceConfigIdentities?.length
  ) {
    issues.push('aggregate-coverage-incomplete');
  }
  if (aggregate.summary?.topNReady !== true) {
    issues.push('aggregate-top-n-not-ready');
  }
}

function verifyCandidateStatic(candidate) {
  const issues = [];
  const axis = candidate?.axis;
  const scenario = axis?.scenario;
  if (candidate.finalScoreEligible !== true) {
    issues.push('candidate-final-score-ineligible');
  }
  if (candidate.objectiveProof?.valid !== true) {
    issues.push('candidate-objective-proof-invalid');
  }
  if (candidate.objectiveProof?.status !== 'closed') {
    issues.push('candidate-cycle-not-closed');
  }
  if (candidate.legality?.proof?.passed !== true) {
    issues.push('candidate-legality-proof-failed');
  }
  if (scenario?.objectiveContract?.objectiveId !== manifest.objective) {
    issues.push('candidate-objective-contract-mismatch');
  }
  const expectedTarget =
    manifest.objective === 'cycle-dps-with-toughness'
      ? {
          hpMode: 'infinite',
          toughnessMode: 'enabled',
          breakMode: 'enabled',
          deathTruncation: 'disabled',
        }
      : {
          hpMode: 'infinite',
          toughnessMode: 'disabled',
          breakMode: 'disabled',
          deathTruncation: 'disabled',
        };
  if (sha256Canonical(scenario?.target) !== sha256Canonical(expectedTarget)) {
    issues.push('candidate-target-policy-mismatch');
  }
  if (
    Number(scenario?.enemy?.enemyId) !== 310054 ||
    Number(scenario?.enemy?.level) !== 80 ||
    scenario?.enemy?.profile?.profileHash !== 'cb1edcc277fcda5b'
  ) {
    issues.push('candidate-enemy-profile-mismatch');
  }
  if (
    scenario?.critical?.policy !== 'expected' ||
    scenario?.critical?.seed != null
  ) {
    issues.push('candidate-critical-policy-mismatch');
  }
  if (
    scenario?.initialStatePreset?.presetId !==
      'm12c-cycle-cold-zero-state-v1' ||
    scenario?.initialStatePreset?.objectiveId !== manifest.objective
  ) {
    issues.push('candidate-initial-state-preset-mismatch');
  }
  const initial = scenario?.initialRuntimeState ?? {};
  if (initial.controlledActor?.actorId !== 'actor-112001') {
    issues.push('candidate-initial-front-not-112001');
  }
  if (
    (scenario?.team ?? []).some(slot => Number(slot.initialSp ?? 0) !== 0) ||
    (initial.kiboEnergyBySlot ?? []).some(
      entry => Number(entry.currentValue ?? 0) !== 0
    ) ||
    (initial.tuningMarks ?? []).length !== 0 ||
    (initial.specialResourcesByActor ?? []).length !== 0
  ) {
    issues.push('candidate-initial-state-not-cold-zero');
  }
  if (
    scenario?.optimizationQualification?.mode !== 'formal' ||
    !scenario?.optimizationQualification?.catalogHash
  ) {
    issues.push('candidate-qualification-binding-invalid');
  }
  if (scenario?.jointAttackRuntime?.clientParityReady !== false) {
    issues.push('candidate-client-parity-boundary-drift');
  }
  const actions = axis?.actions ?? [];
  if (
    actions.length === 0 ||
    sha256Canonical(actions) !==
      manifest.cycleReplayProvenance.templateActionHash
  ) {
    issues.push('candidate-action-template-mismatch');
  }
  const surface = actions.map(action => {
    if (action.intent?.kind === 'wait' && action.owner?.kind === 'system') {
      return 'wait';
    }
    if (
      action.intent?.kind === 'public-action' &&
      action.owner?.kind === 'actor' &&
      action.owner?.slotId === 'm12c-slot:112001' &&
      ['star-skill', 'normal-attack'].includes(action.intent?.actionKind)
    ) {
      return action.intent.actionKind;
    }
    return 'invalid';
  });
  const expectedSurface =
    manifest.objective === 'cycle-dps-with-toughness'
      ? { star: 1, normal: 6, wait: 1 }
      : { star: 0, normal: 1, wait: 0 };
  if (
    surface.filter(kind => kind === 'star-skill').length !==
      expectedSurface.star ||
    surface.filter(kind => kind === 'normal-attack').length !==
      expectedSurface.normal ||
    surface.filter(kind => kind === 'wait').length !== expectedSurface.wait ||
    surface.includes('invalid')
  ) {
    issues.push('candidate-frozen-action-surface-violation');
  }
  const buildActors = candidate.m12c?.build?.actors ?? [];
  const objectIds = buildActors.map(actor => String(actor.optimizationObjectId));
  const sourceIds = buildActors.map(actor => Number(actor.sourceCharacterId));
  if (
    buildActors.length !== 3 ||
    !objectIds.includes('109001') ||
    !objectIds.includes('112001') ||
    sourceIds.includes(199001) && sourceIds.includes(199002)
  ) {
    issues.push('candidate-roster-or-starborn-alias-invalid');
  }
  const moyin = buildActors.find(
    actor => String(actor.optimizationObjectId) === '112001'
  );
  const ring = moyin?.equipment?.find(item => item.slot === 'ring');
  if (Number(ring?.equipmentId) !== 1350211) {
    issues.push('candidate-moyin-ring-constraint-mismatch');
  }
  return issues;
}

function evaluate(service, candidate) {
  const loop = candidate.objectiveProof.loop;
  return service.evaluateCycle({
    schemaVersion: 1,
    contractName: 'AzPrMachineAxisCycleDps',
    kind: 'azpr-machine-axis-cycle-dps',
    contract: candidate.axis,
    loop: {
      startFrame: Number(loop.startFrame),
      endFrame: Number(loop.endFrame),
    },
    options: {
      objective: manifest.objective,
      criticalPolicy: candidate.axis.scenario.critical?.policy ?? 'expected',
    },
  });
}

function compareRuntimeEvidence({
  candidate,
  simulation,
  replayProof,
  repeatedProof,
  validation,
  issues,
}) {
  if (
    replayProof.valid !== true ||
    replayProof.status !== 'closed' ||
    replayProof.actionLegalityProof?.passed !== true
  ) {
    issues.push('independent-cycle-proof-invalid');
  }
  if (
    !scoresEqual(Number(replayProof.formalScore), Number(candidate.score)) ||
    !scoresEqual(
      Number(repeatedProof.formalScore),
      Number(candidate.score)
    )
  ) {
    issues.push('independent-score-mismatch');
  }
  if (
    replayProof.hashes?.cycle !== candidate.objectiveProof?.hashes?.cycle ||
    repeatedProof.hashes?.cycle !== replayProof.hashes?.cycle
  ) {
    issues.push('independent-cycle-hash-mismatch');
  }
  if (
    simulation.hashes?.input !== candidate.hashes?.input ||
    simulation.hashes?.trace !== candidate.hashes?.trace
  ) {
    issues.push('independent-simulation-hash-mismatch');
  }
  if (
    validation.valid !== true ||
    validation.actionLegalityProof?.passed !== true ||
    validation.actionLegalityProof?.proofHash !==
      candidate.legality?.proof?.proofHash
  ) {
    issues.push('independent-validation-mismatch');
  }
}

function scoresEqual(left, right) {
  return Object.is(left, right) || Math.abs(left - right) <= 1e-10;
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function repositoryRelative(filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join('/');
}

function compareText(left, right) {
  return String(left).localeCompare(String(right), 'en');
}
