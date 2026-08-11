import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FORMAL_SEARCH_RANKING_CLAIM,
  aggregateShardResults,
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
const objectiveArgument = readArgument('--objective-directory');
const coverageRoundId = readArgument('--coverage-round-id');
const coverageEvidenceArgument = readArgument('--coverage-evidence');
const terminalRoundIds = readArguments('--terminal-round-id');
const strictRanking = process.argv.includes('--strict-ranking');
const requireIndependentVerification = process.argv.includes(
  '--require-independent-verification'
);

if (
  !objectiveArgument ||
  (!coverageRoundId && !coverageEvidenceArgument) ||
  (coverageRoundId && coverageEvidenceArgument) ||
  terminalRoundIds.length < 3
) {
  throw new Error(
    'Usage: node write-terminal-stability-report.mjs --objective-directory <path> (--coverage-round-id <round-id> | --coverage-evidence <path>) --terminal-round-id <round-id> (repeat at least 3 times) [--strict-ranking] [--require-independent-verification]'
  );
}

const objectiveDirectory = path.resolve(projectRoot, objectiveArgument);
const coverageRound = coverageRoundId
  ? await loadRound(objectiveDirectory, coverageRoundId, false, strictRanking)
  : null;
const coverageEvidence = coverageEvidenceArgument
  ? await readJson(path.resolve(projectRoot, coverageEvidenceArgument))
  : null;
const terminalRounds = [];
for (const roundId of terminalRoundIds) {
  terminalRounds.push(
    await loadRound(
      objectiveDirectory,
      roundId,
      requireIndependentVerification,
      strictRanking
    )
  );
}

const issues = [];
const authorityRound = coverageRound ?? terminalRounds[0];
const objective = authorityRound.manifest.objective;
const runId = authorityRound.manifest.runId;
const baseline = authorityRound.manifest.baseline;
if (coverageRound) {
  validateRoundCommon(coverageRound, issues, { objective, runId, baseline });
  validateCoverage(coverageRound.aggregate.coverage, issues, {
    prefix: 'coverage-round',
    expectedMinimum: 35,
  });
}
if (coverageEvidence) {
  validateEffectiveCoverage(coverageEvidence, issues, { objective, runId });
}

for (const round of terminalRounds) {
  validateRoundCommon(round, issues, { objective, runId, baseline });
  validateCoverage(round.aggregate.coverage, issues, {
    prefix: round.manifest.roundId,
    expectedMinimum: 5,
  });
  if (round.aggregate.summary?.topNReady !== true) {
    issues.push(`${round.manifest.roundId}:top-n-not-ready`);
  }
  if (Number(round.aggregate.summary?.topNRequested) !== 5) {
    issues.push(`${round.manifest.roundId}:top-n-request-not-five`);
  }
  if (requireIndependentVerification) {
    if (round.verification?.valid !== true) {
      issues.push(`${round.manifest.roundId}:independent-verification-invalid`);
    }
    if (round.verification?.clientParityReady !== false) {
      issues.push(
        `${round.manifest.roundId}:client-parity-boundary-not-pending`
      );
    }
    if (round.verification?.formalRankingReady !== false) {
      issues.push(
        `${round.manifest.roundId}:verification-formal-ranking-ready-not-false`
      );
    }
    if (Number(round.verification?.issues?.length ?? 0) !== 0) {
      issues.push(`${round.manifest.roundId}:verification-issues-present`);
    }
  }
}

for (let index = 1; index < terminalRounds.length; index += 1) {
  const previous = terminalRounds[index - 1];
  const current = terminalRounds[index];
  if (Number(current.manifest.iteration) <= Number(previous.manifest.iteration)) {
    issues.push(`${current.manifest.roundId}:iteration-not-increasing`);
  }
  if (
    current.manifest.previousFeedbackAggregate?.feedbackAggregateHash !==
    previous.feedbackAggregate.feedbackAggregateHash
  ) {
    issues.push(`${current.manifest.roundId}:previous-feedback-chain-mismatch`);
  }
}

const reference = terminalRounds[0];
for (const round of terminalRounds.slice(1)) {
  compareExact(
    `${round.manifest.roundId}:top5-raw-identity-order`,
    identityHashes(reference.aggregate.candidateIdentities),
    identityHashes(round.aggregate.candidateIdentities),
    issues
  );
  compareExact(
    `${round.manifest.roundId}:top5-scores`,
    scores(reference.aggregate.results),
    scores(round.aggregate.results),
    issues
  );
  compareExact(
    `${round.manifest.roundId}:top5-family-set`,
    familyIdentities(reference.aggregate.results),
    familyIdentities(round.aggregate.results),
    issues
  );
  compareExact(
    `${round.manifest.roundId}:cutoff-tie-identity-set`,
    sorted(identityHashes(reference.aggregate.cutoffTieIdentities)),
    sorted(identityHashes(round.aggregate.cutoffTieIdentities)),
    issues
  );
  if (
    !scoresEqual(
      Number(reference.aggregate.summary?.cutoffScore),
      Number(round.aggregate.summary?.cutoffScore)
    )
  ) {
    issues.push(`${round.manifest.roundId}:cutoff-score-mismatch`);
  }
  if (
    Number(round.aggregate.summary?.topNFamilyCount) !==
    Number(reference.aggregate.summary?.topNFamilyCount)
  ) {
    issues.push(`${round.manifest.roundId}:family-count-mismatch`);
  }
  if (
    Number(round.aggregate.summary?.cutoffTieCount) !==
    Number(reference.aggregate.summary?.cutoffTieCount)
  ) {
    issues.push(`${round.manifest.roundId}:cutoff-tie-count-mismatch`);
  }
}

const reportPayload = {
  schemaVersion: 1,
  kind: 'azpr-m12c-terminal-bounded-stability-evidence',
  runId,
  objective,
  rankingClaim: FORMAL_SEARCH_RANKING_CLAIM,
  formalRankingReady: false,
  clientParityReady: false,
  boundedClaim: {
    terminalCandidateStatus: issues.length === 0,
    globalOptimalityClaimed: false,
    exhaustiveCompletenessClaimed: false,
    clientParityClaimed: false,
    stopRule:
      'three consecutive terminal rounds preserve ordered Top-5 raw identities, exact scores, source-family set, cutoff score, and full cutoff-tie identity set',
  },
  strictFinalCandidateValidationApplied: strictRanking,
  coverageRound: coverageRound ? summarizeRound(coverageRound) : null,
  effectiveCoverage: coverageEvidence
    ? summarizeEffectiveCoverage(coverageEvidence)
    : null,
  terminalRounds: terminalRounds.map(summarizeRound),
  stableEvidence: {
    consecutiveRoundCount: terminalRounds.length,
    orderedTop5RawIdentityHashes: identityHashes(
      reference.aggregate.candidateIdentities
    ),
    orderedTop5Scores: scores(reference.aggregate.results),
    top5SourceFamilyIdentities: familyIdentities(reference.aggregate.results),
    cutoffScore: reference.aggregate.summary?.cutoffScore ?? null,
    cutoffTieCount: reference.aggregate.summary?.cutoffTieCount ?? null,
    cutoffTieRawIdentityHashes: sorted(
      identityHashes(reference.aggregate.cutoffTieIdentities)
    ),
  },
  independentVerificationRequired: requireIndependentVerification,
  valid: issues.length === 0,
  issues,
};
const terminalStabilityHash = sha256Canonical(reportPayload);
const report = { ...reportPayload, terminalStabilityHash };
const output = await writeJsonAtomic(
  path.join(objectiveDirectory, 'terminal-bounded-evidence.json'),
  report
);

process.stdout.write(
  `${JSON.stringify({
    objective,
    valid: report.valid,
    issues: report.issues,
    terminalStabilityHash,
    output: repositoryRelative(output.path),
  })}\n`
);
if (!report.valid) process.exitCode = 1;

async function loadRound(
  directory,
  roundId,
  verificationRequired,
  rebuildStrictRanking
) {
  const roundDirectory = path.join(directory, roundId);
  const historicalAggregate = await readJson(
    path.join(roundDirectory, 'aggregate.json')
  );
  const round = {
    manifest: await readJson(path.join(roundDirectory, 'round-manifest.json')),
    checkpoint: await readJson(
      path.join(roundDirectory, 'round-checkpoint.json')
    ),
    aggregate: historicalAggregate,
    historicalAggregate,
    feedbackAggregate: await readJson(
      path.join(roundDirectory, 'feedback-aggregate.json')
    ),
    verification: null,
  };
  if (verificationRequired) {
    round.verification = await readJson(
      path.join(roundDirectory, 'independent-verification.json')
    );
  }
  if (rebuildStrictRanking) {
    const shardDirectory = path.join(roundDirectory, 'shards');
    const shardNames = (await fs.readdir(shardDirectory, { withFileTypes: true }))
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort(compareText);
    const shardArtifacts = [];
    for (const shardName of shardNames) {
      const directoryPath = path.join(shardDirectory, shardName);
      shardArtifacts.push({
        checkpoint: await readJson(path.join(directoryPath, 'checkpoint.json')),
        result: await readJson(path.join(directoryPath, 'result.json')),
      });
    }
    round.aggregate = aggregateShardResults({
      runId: round.manifest.runId,
      roundId: round.manifest.roundId,
      objective: round.manifest.objective,
      topN: round.manifest.topN,
      baseline: round.manifest.baseline,
      expectedSourceConfigIdentities: round.manifest.sourceConfigIdentities,
      shardArtifacts,
      guidanceHash: round.manifest.guidanceHash,
      presetSpecHash: round.manifest.presetSpecHash,
      contractTemplateHash: round.manifest.contractTemplateHash,
      orchestrationIdentityHash: round.manifest.orchestrationIdentityHash,
    });
  }
  return round;
}

function validateRoundCommon(round, issues, expected) {
  const roundId = round.manifest.roundId;
  if (round.checkpoint.status !== 'completed') {
    issues.push(`${roundId}:checkpoint-not-completed`);
  }
  if (round.manifest.objective !== expected.objective) {
    issues.push(`${roundId}:objective-mismatch`);
  }
  if (round.manifest.runId !== expected.runId) {
    issues.push(`${roundId}:run-id-mismatch`);
  }
  if (sha256Canonical(round.manifest.baseline) !== sha256Canonical(expected.baseline)) {
    issues.push(`${roundId}:baseline-mismatch`);
  }
  for (const artifact of [round.manifest, round.aggregate]) {
    if (artifact.rankingClaim !== FORMAL_SEARCH_RANKING_CLAIM) {
      issues.push(`${roundId}:ranking-claim-mismatch`);
    }
    if (artifact.formalRankingReady !== false) {
      issues.push(`${roundId}:formal-ranking-ready-not-false`);
    }
  }
  if (
    round.feedbackAggregate.roundAggregateHash !==
    round.historicalAggregate.aggregateHash
  ) {
    issues.push(`${roundId}:feedback-round-hash-mismatch`);
  }
}

function validateEffectiveCoverage(evidence, issues, expected) {
  if (evidence?.valid !== true) {
    issues.push('effective-coverage-invalid');
  }
  if (evidence?.objective !== expected.objective) {
    issues.push('effective-coverage-objective-mismatch');
  }
  if (evidence?.runId !== expected.runId) {
    issues.push('effective-coverage-run-id-mismatch');
  }
  if (evidence?.rankingClaim !== FORMAL_SEARCH_RANKING_CLAIM) {
    issues.push('effective-coverage-ranking-claim-mismatch');
  }
  if (evidence?.formalRankingReady !== false) {
    issues.push('effective-coverage-formal-ranking-ready-not-false');
  }
  if (evidence?.clientParityReady !== false) {
    issues.push('effective-coverage-client-parity-boundary-not-pending');
  }
  if (Number(evidence?.issues?.length ?? 0) !== 0) {
    issues.push('effective-coverage-issues-present');
  }
  const coverage = evidence?.coverage ?? {};
  const expectedSources = sorted(coverage.expectedSourceConfigIdentities ?? []);
  const completedSources = sorted(
    coverage.effectiveCompletedSourceConfigIdentities ?? []
  );
  if (expectedSources.length !== 35) {
    issues.push('effective-coverage-source-count-not-35');
  }
  compareExact(
    'effective-coverage-completion',
    expectedSources,
    completedSources,
    issues
  );
  for (const key of [
    'failedSourceConfigIdentities',
    'missingSourceConfigIdentities',
  ]) {
    if (Number(coverage?.[key]?.length ?? 0) !== 0) {
      issues.push(`effective-coverage:${key}-not-empty`);
    }
  }
}

function validateCoverage(coverage, issues, { prefix, expectedMinimum }) {
  const expected = sorted(coverage?.expectedSourceConfigIdentities ?? []);
  const completed = sorted(coverage?.completedSourceConfigIdentities ?? []);
  if (expected.length < expectedMinimum) {
    issues.push(`${prefix}:coverage-below-minimum`);
  }
  compareExact(`${prefix}:coverage-completion`, expected, completed, issues);
  for (const key of [
    'failedSourceConfigIdentities',
    'inProgressSourceConfigIdentities',
    'missingSourceConfigIdentities',
  ]) {
    if (Number(coverage?.[key]?.length ?? 0) !== 0) {
      issues.push(`${prefix}:${key}-not-empty`);
    }
  }
}

function summarizeRound(round) {
  return {
    roundId: round.manifest.roundId,
    iteration: round.manifest.iteration,
    aggregateHash: round.aggregate.aggregateHash,
    historicalAggregateHash: round.historicalAggregate.aggregateHash,
    strictAggregateRebuilt:
      round.aggregate.aggregateHash !== round.historicalAggregate.aggregateHash,
    feedbackAggregateHash: round.feedbackAggregate.feedbackAggregateHash,
    guidanceHash: round.manifest.guidanceHash,
    expectedShardCount:
      round.aggregate.coverage.expectedSourceConfigIdentities.length,
    completedShardCount:
      round.aggregate.coverage.completedSourceConfigIdentities.length,
    failedShardCount:
      round.aggregate.coverage.failedSourceConfigIdentities.length,
    missingShardCount:
      round.aggregate.coverage.missingSourceConfigIdentities.length,
    validDistinctCandidateCount:
      round.aggregate.summary.validDistinctCandidateCount,
    topNReady: round.aggregate.summary.topNReady,
    cutoffScore: round.aggregate.summary.cutoffScore,
    cutoffTieCount: round.aggregate.summary.cutoffTieCount,
    topNFamilyCount: round.aggregate.summary.topNFamilyCount,
    independentVerificationHash:
      round.verification?.verificationHash ?? null,
  };
}

function summarizeEffectiveCoverage(evidence) {
  return {
    effectiveCoverageHash: evidence.effectiveCoverageHash,
    expectedSourceConfigCount:
      evidence.coverage?.expectedSourceConfigIdentities?.length ?? 0,
    effectiveCompletedSourceConfigCount:
      evidence.coverage?.effectiveCompletedSourceConfigIdentities?.length ?? 0,
    failedSourceConfigCount:
      evidence.coverage?.failedSourceConfigIdentities?.length ?? 0,
    missingSourceConfigCount:
      evidence.coverage?.missingSourceConfigIdentities?.length ?? 0,
    originalRoundId: evidence.provenance?.originalRoundId ?? null,
    correctionRoundId: evidence.provenance?.correctionRoundId ?? null,
  };
}

function identityHashes(identities) {
  return (identities ?? []).map(identity => identity.identityHash);
}

function scores(results) {
  return (results ?? []).map(result => Number(result.score));
}

function familyIdentities(results) {
  return sorted(
    new Set(
      (results ?? []).map(
        result =>
          result.m12c?.teamIdentity ?? result.m12c?.sourceConfigIdentity ?? ''
      )
    )
  ).filter(Boolean);
}

function compareExact(label, left, right, issues) {
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    issues.push(`${label}-mismatch`);
  }
}

function scoresEqual(left, right) {
  return Object.is(left, right) || Math.abs(left - right) <= 1e-12;
}

function sorted(values) {
  return [...values].map(String).sort(compareText);
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function readArguments(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1] != null) {
      values.push(process.argv[index + 1]);
    }
  }
  return values;
}

function repositoryRelative(filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join('/');
}

function compareText(left, right) {
  return String(left).localeCompare(String(right), 'en');
}
