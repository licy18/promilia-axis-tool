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
const originalArgument = readArgument('--original-round');
const correctionArgument = readArgument('--correction-round');
if (!originalArgument || !correctionArgument) {
  throw new Error(
    'Usage: node verify-cold-cycle-coverage-correction.mjs --original-round <path> --correction-round <path>'
  );
}

const originalDirectory = path.resolve(projectRoot, originalArgument);
const correctionDirectory = path.resolve(projectRoot, correctionArgument);
const original = await loadRound(originalDirectory);
const correction = await loadRound(correctionDirectory);
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

let verification;
try {
  const [packageModule, serviceModule] = await Promise.all([
    vite.ssrLoadModule('/src/data/verifiedCombatMechanicsPackage.js'),
    vite.ssrLoadModule('/src/machine-axis/machineAxisService.js'),
  ]);
  packageModule.installVerifiedCombatMechanicsPackage(mechanicsPackage);
  verification = await verifyCorrection({
    service: serviceModule.createMachineAxisService(),
  });
} finally {
  await vite.close();
}

const verificationHash = sha256Canonical(verification);
const verificationOutput = { ...verification, verificationHash };
const verificationWrite = await writeJsonAtomic(
  path.join(correctionDirectory, 'independent-verification.json'),
  verificationOutput
);
const coveragePayload = createEffectiveCoverageEvidence(verificationOutput);
const effectiveCoverageHash = sha256Canonical(coveragePayload);
const coverageOutput = { ...coveragePayload, effectiveCoverageHash };
const coverageWrite = await writeJsonAtomic(
  path.join(path.dirname(originalDirectory), 'effective-coverage-evidence.json'),
  coverageOutput
);

process.stdout.write(
  `${JSON.stringify({
    objective: correction.manifest.objective,
    valid: coverageOutput.valid,
    issues: coverageOutput.issues,
    correctedCandidateCount:
      verificationOutput.coverage.verifiedCandidateCount,
    verificationHash,
    effectiveCoverageHash,
    verificationOutput: repositoryRelative(verificationWrite.path),
    coverageOutput: repositoryRelative(coverageWrite.path),
  })}\n`
);
if (!coverageOutput.valid) process.exitCode = 1;

async function verifyCorrection({ service }) {
  const issues = [];
  validateRoundPair(issues);
  const rows = [];
  for (const shard of correction.shards) {
    const localIssues = [];
    if (shard.checkpoint.status !== 'completed') {
      localIssues.push('shard-not-completed');
    }
    if (
      sha256Canonical(shard.resultArtifact) !==
      shard.checkpoint.artifacts?.resultCanonicalSha256
    ) {
      localIssues.push('shard-result-canonical-hash-mismatch');
    }
    const sourceConfigIdentity =
      shard.checkpoint.coverage?.sourceConfigIdentity ?? null;
    if (!String(sourceConfigIdentity).includes('103002=')) {
      localIssues.push('correction-source-not-103002');
    }
    const candidateRows = [];
    for (const candidate of shard.resultArtifact.serviceResult?.results ?? []) {
      const candidateIssues = verifyCandidateStatic(candidate);
      let proof;
      let validation;
      try {
        proof = evaluateCycle(service, candidate);
        validation = service.validate(candidate.axis);
      } catch (error) {
        candidateIssues.push(
          `runtime-exception:${error?.message ?? String(error)}`
        );
      }
      if (proof && validation) {
        if (
          proof.valid !== true ||
          proof.status !== 'closed' ||
          proof.actionLegalityProof?.passed !== true
        ) {
          candidateIssues.push('independent-cycle-proof-invalid');
        }
        if (!scoresEqual(Number(proof.formalScore), Number(candidate.score))) {
          candidateIssues.push('independent-score-mismatch');
        }
        if (
          proof.hashes?.cycle !== candidate.objectiveProof?.hashes?.cycle
        ) {
          candidateIssues.push('independent-cycle-hash-mismatch');
        }
        if (
          validation.valid !== true ||
          validation.actionLegalityProof?.passed !== true ||
          validation.actionLegalityProof?.proofHash !==
            candidate.legality?.proof?.proofHash
        ) {
          candidateIssues.push('independent-validation-mismatch');
        }
      }
      const rawIdentity = createCandidateRawIdentity(
        candidate,
        correction.manifest.objective
      );
      candidateRows.push({
        rawIdentityHash: rawIdentity.identityHash,
        score: candidate.score,
        actionCount: candidate.axis?.actions?.length ?? 0,
        cycleProofHash: proof?.hashes?.cycle ?? null,
        legalityProofHash:
          validation?.actionLegalityProof?.proofHash ?? null,
        valid: candidateIssues.length === 0,
        issues: candidateIssues,
      });
      for (const issue of candidateIssues) {
        localIssues.push(`${rawIdentity.identityHash}:${issue}`);
      }
    }
    if (candidateRows.length === 0) {
      localIssues.push('shard-has-no-candidate');
    }
    const row = {
      shard: shard.name,
      sourceConfigIdentity,
      candidateCount: candidateRows.length,
      validCandidateCount: candidateRows.filter(row => row.valid).length,
      candidates: candidateRows,
      valid: localIssues.length === 0,
      issues: localIssues,
    };
    rows.push(row);
    for (const issue of localIssues) issues.push(`${shard.name}:${issue}`);
  }
  return {
    schemaVersion: 1,
    kind: 'azpr-m12c-cold-cycle-coverage-correction-verification',
    runId: correction.manifest.runId,
    objective: correction.manifest.objective,
    originalRoundId: original.manifest.roundId,
    correctionRoundId: correction.manifest.roundId,
    rankingClaim: 'AI-guided heuristic Top-N',
    formalRankingReady: false,
    clientParityReady: false,
    originalAggregateHash: original.aggregate.aggregateHash,
    correctionAggregateHash: correction.aggregate.aggregateHash,
    coverage: {
      expectedShardCount:
        correction.aggregate.coverage.expectedSourceConfigIdentities.length,
      verifiedShardCount: rows.length,
      validShardCount: rows.filter(row => row.valid).length,
      verifiedCandidateCount: rows.reduce(
        (sum, row) => sum + row.candidateCount,
        0
      ),
      validCandidateCount: rows.reduce(
        (sum, row) => sum + row.validCandidateCount,
        0
      ),
    },
    coldStateContract: {
      presetId: 'm12c-cycle-cold-zero-state-v1',
      actorSp: 0,
      kiboSp: 0,
      tuningMarks: 0,
      specialResources: 0,
      rubyAmmoAbsent: true,
    },
    valid: issues.length === 0,
    issues,
    rows,
  };
}

function createEffectiveCoverageEvidence(correctionVerification) {
  const issues = [];
  const originalExpected = sorted(
    original.aggregate.coverage.expectedSourceConfigIdentities
  );
  const correctedSources = sorted(
    correction.aggregate.coverage.expectedSourceConfigIdentities
  );
  const correctedSet = new Set(correctedSources);
  const retainedSources = originalExpected.filter(
    source => !correctedSet.has(source)
  );
  const effectiveSources = sorted([...retainedSources, ...correctedSources]);
  if (originalExpected.length !== 35) {
    issues.push('original-coverage-not-35');
  }
  if (
    original.checkpoint.status !== 'completed' ||
    correction.checkpoint.status !== 'completed'
  ) {
    issues.push('coverage-round-not-completed');
  }
  if (
    correctedSources.length !== 8 ||
    correctedSources.some(source => !source.includes('103002='))
  ) {
    issues.push('corrected-source-set-not-eight-103002-configs');
  }
  if (retainedSources.length !== 27) {
    issues.push('retained-source-count-not-27');
  }
  if (JSON.stringify(effectiveSources) !== JSON.stringify(originalExpected)) {
    issues.push('effective-source-universe-mismatch');
  }
  for (const round of [original, correction]) {
    for (const key of [
      'failedSourceConfigIdentities',
      'inProgressSourceConfigIdentities',
      'missingSourceConfigIdentities',
    ]) {
      if ((round.aggregate.coverage[key] ?? []).length !== 0) {
        issues.push(`${round.manifest.roundId}:${key}-not-empty`);
      }
    }
  }
  if (correctionVerification.valid !== true) {
    issues.push('correction-independent-verification-invalid');
  }
  return {
    schemaVersion: 1,
    kind: 'azpr-m12c-effective-coverage-evidence',
    runId: original.manifest.runId,
    objective: original.manifest.objective,
    rankingClaim: 'AI-guided heuristic Top-N',
    formalRankingReady: false,
    clientParityReady: false,
    coverage: {
      expectedSourceConfigIdentities: originalExpected,
      retainedOriginalSourceConfigIdentities: retainedSources,
      correctedSourceConfigIdentities: correctedSources,
      effectiveCompletedSourceConfigIdentities: effectiveSources,
      failedSourceConfigIdentities: [],
      missingSourceConfigIdentities: [],
      expectedSourceConfigCount: originalExpected.length,
      retainedOriginalSourceConfigCount: retainedSources.length,
      correctedSourceConfigCount: correctedSources.length,
      effectiveCompletedSourceConfigCount: effectiveSources.length,
    },
    provenance: {
      originalRoundId: original.manifest.roundId,
      originalAggregateHash: original.aggregate.aggregateHash,
      correctionRoundId: correction.manifest.roundId,
      correctionAggregateHash: correction.aggregate.aggregateHash,
      correctionVerificationHash:
        correctionVerification.verificationHash,
      excludedOriginalSourcePolicy:
        'all original source configs containing 103002 were replaced because rubyAmmo:null had been coerced to an explicit zero-value resource',
    },
    valid: issues.length === 0,
    issues,
  };
}

function validateRoundPair(issues) {
  if (
    original.manifest.runId !== correction.manifest.runId ||
    original.manifest.objective !== correction.manifest.objective
  ) {
    issues.push('round-pair-identity-mismatch');
  }
  if (
    original.manifest.rankingClaim !== 'AI-guided heuristic Top-N' ||
    correction.manifest.rankingClaim !== 'AI-guided heuristic Top-N' ||
    original.manifest.formalRankingReady !== false ||
    correction.manifest.formalRankingReady !== false
  ) {
    issues.push('round-pair-ranking-boundary-drift');
  }
  if (
    sha256Canonical(original.manifest.baseline) !==
    sha256Canonical(correction.manifest.baseline)
  ) {
    issues.push('round-pair-baseline-mismatch');
  }
}

function verifyCandidateStatic(candidate) {
  const issues = [];
  const scenario = candidate.axis?.scenario;
  const initial = scenario?.initialRuntimeState ?? {};
  const objective = correction.manifest.objective;
  if (
    candidate.finalScoreEligible !== true ||
    candidate.objectiveProof?.valid !== true ||
    candidate.objectiveProof?.status !== 'closed' ||
    candidate.legality?.proof?.passed !== true
  ) {
    issues.push('candidate-proof-or-legality-invalid');
  }
  if (
    Number(candidate.legality?.proof?.skippedActionCount ?? 0) !== 0 ||
    Number(candidate.legality?.proof?.unresolvedActionCount ?? 0) !== 0
  ) {
    issues.push('candidate-skipped-or-unresolved-actions');
  }
  if (
    scenario?.initialStatePreset?.presetId !==
      'm12c-cycle-cold-zero-state-v1' ||
    scenario?.initialStatePreset?.objectiveId !== objective ||
    (scenario?.team ?? []).some(slot => Number(slot.initialSp ?? 0) !== 0) ||
    (initial.kiboEnergyBySlot ?? []).some(
      row => Number(row.currentValue ?? 0) !== 0
    ) ||
    (initial.tuningMarks ?? []).length !== 0 ||
    (initial.specialResourcesByActor ?? []).length !== 0
  ) {
    issues.push('candidate-cold-zero-state-invalid');
  }
  const expectedTarget =
    objective === 'cycle-dps-with-toughness'
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
    issues.push('candidate-target-policy-invalid');
  }
  if (
    Number(scenario?.enemy?.enemyId) !== 310054 ||
    Number(scenario?.enemy?.level) !== 80 ||
    scenario?.enemy?.profile?.profileHash !== 'cb1edcc277fcda5b'
  ) {
    issues.push('candidate-enemy-profile-invalid');
  }
  if (
    scenario?.critical?.policy !== 'expected' ||
    scenario?.critical?.seed != null ||
    scenario?.optimizationQualification?.mode !== 'formal' ||
    scenario?.jointAttackRuntime?.clientParityReady !== false
  ) {
    issues.push('candidate-critical-qualification-or-parity-invalid');
  }
  const buildActors = candidate.m12c?.build?.actors ?? [];
  const sourceIds = buildActors.map(actor => Number(actor.sourceCharacterId));
  if (
    buildActors.length !== 3 ||
    !buildActors.some(
      actor => String(actor.optimizationObjectId) === '109001'
    ) ||
    (sourceIds.includes(199001) && sourceIds.includes(199002))
  ) {
    issues.push('candidate-roster-or-starborn-alias-invalid');
  }
  if (
    (candidate.axis?.actions ?? []).some(
      action =>
        action.owner?.kind === 'kibo' &&
        ['normal-attack', 'active-skill'].includes(action.intent?.actionKind)
    )
  ) {
    issues.push('candidate-autonomous-kibo-surface-present');
  }
  return issues;
}

function evaluateCycle(service, candidate) {
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
      objective: correction.manifest.objective,
      criticalPolicy: candidate.axis.scenario.critical?.policy ?? 'expected',
    },
  });
}

async function loadRound(directory) {
  const manifest = await readJson(path.join(directory, 'round-manifest.json'));
  const checkpoint = await readJson(
    path.join(directory, 'round-checkpoint.json')
  );
  const aggregate = await readJson(path.join(directory, 'aggregate.json'));
  const shardRoot = path.join(directory, 'shards');
  const shardEntries = (await fs.readdir(shardRoot, { withFileTypes: true }))
    .filter(entry => entry.isDirectory())
    .sort((left, right) => compareText(left.name, right.name));
  const shards = [];
  for (const entry of shardEntries) {
    const shardDirectory = path.join(shardRoot, entry.name);
    shards.push({
      name: entry.name,
      checkpoint: await readJson(path.join(shardDirectory, 'checkpoint.json')),
      resultArtifact: await readJson(path.join(shardDirectory, 'result.json')),
    });
  }
  return { directory, manifest, checkpoint, aggregate, shards };
}

function scoresEqual(left, right) {
  return Object.is(left, right) || Math.abs(left - right) <= 1e-10;
}

function sorted(values) {
  return [...values].map(String).sort(compareText);
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
