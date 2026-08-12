import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FORMAL_SEARCH_RANKING_CLAIM,
  aggregateShardResults,
  analyzeFinalCandidateInitialState,
  createCandidateRawIdentity,
  loadRepositoryNormalAttackInputAuthorityDescriptor,
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
const normalAttackInputAuthority =
  await loadRepositoryNormalAttackInputAuthorityDescriptor({
    repositoryRoot: projectRoot,
  });
const runArgument = readArgument('--run-directory');
const objective = readArgument('--objective') ?? 'cycle-dps-no-toughness';
const baseRoundIds = readArguments('--base-round-id');
const replacementRoundIds = readArguments('--replacement-round-id');
if (
  !runArgument ||
  objective !== 'cycle-dps-no-toughness' ||
  baseRoundIds.length !== 3 ||
  replacementRoundIds.length !== 3
) {
  throw new Error(
    'Usage: node write-preset-quarantine-replacement.mjs --run-directory <path> --objective cycle-dps-no-toughness --base-round-id <id> (3x) --replacement-round-id <id> (3x)'
  );
}

const runDirectory = path.resolve(projectRoot, runArgument);
const objectiveDirectory = path.join(runDirectory, 'objectives', objective);
const quarantinePath = path.join(
  runDirectory,
  'final-verification',
  'preset-admission-quarantine.json'
);
const quarantine = await readJson(quarantinePath);
const effectiveCoverage = await readJson(
  path.join(objectiveDirectory, 'effective-coverage-evidence.json')
);
const issues = [];
if (quarantine.valid !== true) issues.push('quarantine-scan-invalid');
if (quarantine.summary?.affectedObjectiveCount !== 1) {
  issues.push('quarantine-objective-scope-not-one');
}
if (
  quarantine.affectedSourceConfigIdentities?.length !== 1 ||
  quarantine.quarantinedOccurrences?.some(row => row.objective !== objective)
) {
  issues.push('quarantine-source-scope-not-single-no-toughness-source');
}
if (
  effectiveCoverage.valid !== true ||
  Number(effectiveCoverage.coverage?.effectiveCompletedSourceConfigCount) !==
    35 ||
  Number(effectiveCoverage.coverage?.failedSourceConfigIdentities?.length) !==
    0 ||
  Number(effectiveCoverage.coverage?.missingSourceConfigIdentities?.length) !==
    0
) {
  issues.push('effective-coverage-not-valid-35-of-35');
}
const affectedSourceConfigIdentity =
  quarantine.affectedSourceConfigIdentities?.[0] ?? null;
const quarantinedRawIdentityHashes = new Set(
  quarantine.affectedRawIdentityHashes ?? []
);
const compositeDirectory = path.join(
  runDirectory,
  'final-verification',
  'repaired-terminal',
  objective
);
const composites = [];

for (let index = 0; index < 3; index += 1) {
  const label = String.fromCharCode('a'.charCodeAt(0) + index);
  const baseRound = await loadRound(objectiveDirectory, baseRoundIds[index]);
  const replacementRound = await loadRound(
    objectiveDirectory,
    replacementRoundIds[index]
  );
  if (baseRound.manifest.objective !== objective) {
    issues.push(`${baseRoundIds[index]}:base-objective-mismatch`);
  }
  if (replacementRound.manifest.objective !== objective) {
    issues.push(`${replacementRoundIds[index]}:replacement-objective-mismatch`);
  }
  const excluded = baseRound.shards.filter(
    shard => shard.sourceConfigIdentity === affectedSourceConfigIdentity
  );
  const retained = baseRound.shards.filter(
    shard => shard.sourceConfigIdentity !== affectedSourceConfigIdentity
  );
  const replacements = replacementRound.shards.filter(
    shard => shard.sourceConfigIdentity === affectedSourceConfigIdentity
  );
  if (
    excluded.length !== 1 ||
    retained.length !== 7 ||
    replacements.length !== 1
  ) {
    issues.push(`composite-${label}:replacement-cardinality-invalid`);
  }
  const excludedRawIdentities = candidateIdentities(excluded, objective);
  if (
    excludedRawIdentities.length === 0 ||
    excludedRawIdentities.some(
      identity => !quarantinedRawIdentityHashes.has(identity.identityHash)
    )
  ) {
    issues.push(`composite-${label}:excluded-shard-not-fully-quarantined`);
  }
  const replacementAdmission = [];
  for (const shard of replacements) {
    for (const result of shard.result.serviceResult?.results ?? []) {
      const admission = analyzeFinalCandidateInitialState(result, objective);
      replacementAdmission.push({
        rawIdentityHash: createCandidateRawIdentity(result, objective)
          .identityHash,
        valid: admission.valid,
        issues: admission.issues,
        actualPresetHash: admission.actualPresetHash,
        expectedPresetHash: admission.expectedPresetHash,
        actualSpecialResources: admission.actualSpecialResources,
      });
      if (!admission.valid) {
        issues.push(`composite-${label}:replacement-preset-invalid`);
      }
    }
  }
  const compositeRoundId = `repaired-terminal-${label}`;
  const aggregate = aggregateShardResults({
    runId: baseRound.manifest.runId,
    roundId: compositeRoundId,
    objective,
    topN: 5,
    baseline: baseRound.manifest.baseline,
    expectedSourceConfigIdentities: baseRound.manifest.sourceConfigIdentities,
    shardArtifacts: [...retained, ...replacements].map(shard => ({
      checkpoint: shard.checkpoint,
      result: shard.result,
    })),
    guidanceHash: sha256Canonical({
      baseGuidanceHash: baseRound.manifest.guidanceHash,
      replacementGuidanceHash: replacementRound.manifest.guidanceHash,
    }),
    presetSpecHash: replacementRound.manifest.presetSpecHash,
    contractTemplateHash: baseRound.manifest.contractTemplateHash,
    orchestrationIdentityHash: sha256Canonical({
      kind: 'azpr-m12c-quarantine-replacement-composite-v1',
      baseRoundId: baseRoundIds[index],
      replacementRoundId: replacementRoundIds[index],
      affectedSourceConfigIdentity,
      quarantineHash: quarantine.quarantineHash,
    }),
    normalAttackInputAuthority,
  });
  if (
    aggregate.coverage.completedSourceConfigIdentities.length !== 8 ||
    aggregate.coverage.failedSourceConfigIdentities.length !== 0 ||
    aggregate.coverage.missingSourceConfigIdentities.length !== 0 ||
    aggregate.summary.topNReady !== true
  ) {
    issues.push(`composite-${label}:aggregate-incomplete`);
  }
  const rankedIdentityHashes = [
    ...(aggregate.candidateIdentities ?? []),
    ...(aggregate.cutoffTieIdentities ?? []),
  ].map(identity => identity.identityHash);
  if (
    rankedIdentityHashes.some(identity =>
      quarantinedRawIdentityHashes.has(identity)
    )
  ) {
    issues.push(`composite-${label}:quarantined-identity-survived`);
  }
  const provenancePayload = {
    schemaVersion: 1,
    kind: 'azpr-m12c-preset-quarantine-replacement-provenance',
    runId: baseRound.manifest.runId,
    objective,
    compositeRoundId,
    rankingClaim: FORMAL_SEARCH_RANKING_CLAIM,
    formalRankingReady: false,
    clientParityReady: false,
    quarantineHash: quarantine.quarantineHash,
    baseRound: {
      roundId: baseRoundIds[index],
      iteration: baseRound.manifest.iteration,
      aggregateHash: baseRound.aggregate.aggregateHash,
      retainedSourceConfigCount: retained.length,
      excludedSourceConfigIdentity: affectedSourceConfigIdentity,
      excludedShardId: excluded[0]?.checkpoint?.shardId ?? null,
      excludedResultCanonicalSha256:
        excluded[0]?.checkpoint?.artifacts?.resultCanonicalSha256 ?? null,
      excludedRawIdentityHashes: excludedRawIdentities.map(
        identity => identity.identityHash
      ),
    },
    replacementRound: {
      roundId: replacementRoundIds[index],
      iteration: replacementRound.manifest.iteration,
      aggregateHash: replacementRound.aggregate.aggregateHash,
      feedbackAggregateHash:
        replacementRound.feedback?.feedbackAggregateHash ?? null,
      guidanceHash: replacementRound.manifest.guidanceHash,
      presetSpecHash: replacementRound.manifest.presetSpecHash,
      sourceConfigIdentity: affectedSourceConfigIdentity,
      shardId: replacements[0]?.checkpoint?.shardId ?? null,
      inputHash: replacements[0]?.checkpoint?.inputHash ?? null,
      resultCanonicalSha256:
        replacements[0]?.checkpoint?.artifacts?.resultCanonicalSha256 ?? null,
      replacementAdmission,
    },
    replacementPolicy: {
      entireAffectedSourceShardReplaced: true,
      quarantinedResultReused: false,
      hashOnlyRewriteApplied: false,
      canonicalPresetRegeneratedByProductionBinder: true,
      gameplayContractChanged: false,
    },
    compositeAggregateHash: aggregate.aggregateHash,
  };
  const provenance = {
    ...provenancePayload,
    replacementProvenanceHash: sha256Canonical(provenancePayload),
  };
  const outputDirectory = path.join(compositeDirectory, compositeRoundId);
  const aggregateArtifact = await writeJsonAtomic(
    path.join(outputDirectory, 'aggregate.json'),
    aggregate
  );
  const provenanceArtifact = await writeJsonAtomic(
    path.join(outputDirectory, 'replacement-provenance.json'),
    provenance
  );
  const checkpointPayload = {
    schemaVersion: 1,
    kind: 'azpr-m12c-preset-repaired-terminal-checkpoint',
    runId: baseRound.manifest.runId,
    objective,
    roundId: compositeRoundId,
    status: 'completed',
    exitStatus: 'completed',
    aggregateHash: aggregate.aggregateHash,
    replacementProvenanceHash: provenance.replacementProvenanceHash,
    coverage: aggregate.coverage,
    summary: aggregate.summary,
    artifacts: {
      aggregatePath: repositoryRelative(aggregateArtifact.path),
      aggregateFileSha256: aggregateArtifact.sha256,
      provenancePath: repositoryRelative(provenanceArtifact.path),
      provenanceFileSha256: provenanceArtifact.sha256,
    },
  };
  const checkpoint = {
    ...checkpointPayload,
    checkpointHash: sha256Canonical(checkpointPayload),
  };
  await writeJsonAtomic(
    path.join(outputDirectory, 'checkpoint.json'),
    checkpoint
  );
  composites.push({ aggregate, provenance, checkpoint });
}

const reference = composites[0]?.aggregate;
for (const [index, composite] of composites.slice(1).entries()) {
  const label = String.fromCharCode('b'.charCodeAt(0) + index);
  compareExact(
    `composite-${label}:top5-identities`,
    identityHashes(reference?.candidateIdentities),
    identityHashes(composite.aggregate.candidateIdentities),
    issues
  );
  compareExact(
    `composite-${label}:top5-scores`,
    scores(reference?.results),
    scores(composite.aggregate.results),
    issues
  );
  compareExact(
    `composite-${label}:family-set`,
    familyIdentities(reference?.results),
    familyIdentities(composite.aggregate.results),
    issues
  );
  compareExact(
    `composite-${label}:cutoff-ties`,
    sorted(identityHashes(reference?.cutoffTieIdentities)),
    sorted(identityHashes(composite.aggregate.cutoffTieIdentities)),
    issues
  );
}

const repairPayload = {
  schemaVersion: 1,
  kind: 'azpr-m12c-terminal-preset-quarantine-replacement-evidence',
  runId: path.basename(runDirectory),
  objective,
  rankingClaim: FORMAL_SEARCH_RANKING_CLAIM,
  formalRankingReady: false,
  clientParityReady: false,
  quarantine: {
    path: repositoryRelative(quarantinePath),
    quarantineHash: quarantine.quarantineHash,
    affectedSourceConfigIdentity,
    affectedRawIdentityHashes: [...quarantinedRawIdentityHashes].sort(
      compareText
    ),
    quarantinedOccurrenceCount:
      quarantine.summary?.quarantinedOccurrenceCount ?? 0,
  },
  replacement: {
    baseRoundIds,
    replacementRoundIds,
    replacementShardCount: replacementRoundIds.length,
    sourceConfigIdentity: affectedSourceConfigIdentity,
    canonicalPresetId: 'm12c-cycle-cold-zero-state-v1',
    canonicalPresetHash:
      composites[0]?.provenance?.replacementRound?.replacementAdmission?.[0]
        ?.expectedPresetHash ?? null,
    quarantinedResultsReused: false,
  },
  compositeTerminalRounds: composites.map(composite => ({
    roundId: composite.aggregate.roundId,
    aggregateHash: composite.aggregate.aggregateHash,
    replacementProvenanceHash: composite.provenance.replacementProvenanceHash,
    checkpointHash: composite.checkpoint.checkpointHash,
    completedShardCount:
      composite.aggregate.coverage.completedSourceConfigIdentities.length,
    failedShardCount:
      composite.aggregate.coverage.failedSourceConfigIdentities.length,
    missingShardCount:
      composite.aggregate.coverage.missingSourceConfigIdentities.length,
    validDistinctCandidateCount:
      composite.aggregate.summary.validDistinctCandidateCount,
    topNReady: composite.aggregate.summary.topNReady,
    cutoffScore: composite.aggregate.summary.cutoffScore,
    cutoffTieCount: composite.aggregate.summary.cutoffTieCount,
    topNFamilyCount: composite.aggregate.summary.topNFamilyCount,
  })),
  stableEvidence: {
    consecutiveCompositeRoundCount: composites.length,
    orderedTop5RawIdentityHashes: identityHashes(
      reference?.candidateIdentities
    ),
    orderedTop5Scores: scores(reference?.results),
    top5SourceFamilyIdentities: familyIdentities(reference?.results),
    cutoffScore: reference?.summary?.cutoffScore ?? null,
    cutoffTieCount: reference?.summary?.cutoffTieCount ?? null,
    cutoffTieRawIdentityHashes: sorted(
      identityHashes(reference?.cutoffTieIdentities)
    ),
  },
  effectiveCoverage: {
    effectiveCoverageHash: effectiveCoverage.effectiveCoverageHash,
    expectedSourceConfigCount:
      effectiveCoverage.coverage?.expectedSourceConfigIdentities?.length ?? 0,
    completedSourceConfigCount:
      effectiveCoverage.coverage?.effectiveCompletedSourceConfigIdentities
        ?.length ?? 0,
    failedSourceConfigCount:
      effectiveCoverage.coverage?.failedSourceConfigIdentities?.length ?? 0,
    missingSourceConfigCount:
      effectiveCoverage.coverage?.missingSourceConfigIdentities?.length ?? 0,
  },
  boundedClaim: {
    terminalCandidateStatus: issues.length === 0,
    globalOptimalityClaimed: false,
    exhaustiveCompletenessClaimed: false,
    clientParityClaimed: false,
    stopRule:
      'three canonical replacement shards independently reproduce the affected source result and three composite terminal aggregates preserve ordered Top-5 raw identities, exact scores, family set, cutoff, and full cutoff ties',
  },
  valid: issues.length === 0,
  issues,
};
const presetRepairHash = sha256Canonical(repairPayload);
const repair = { ...repairPayload, presetRepairHash };
const repairArtifact = await writeJsonAtomic(
  path.join(
    runDirectory,
    'final-verification',
    'preset-quarantine-replacement-evidence.json'
  ),
  repair
);

const terminalPayload = {
  schemaVersion: 1,
  kind: 'azpr-m12c-terminal-bounded-stability-evidence',
  runId: repair.runId,
  objective,
  rankingClaim: FORMAL_SEARCH_RANKING_CLAIM,
  formalRankingReady: false,
  clientParityReady: false,
  strictFinalCandidateValidationApplied: true,
  boundedClaim: repair.boundedClaim,
  coverageRound: null,
  effectiveCoverage: repair.effectiveCoverage,
  terminalRounds: repair.compositeTerminalRounds,
  stableEvidence: repair.stableEvidence,
  quarantineReplacement: {
    evidencePath: repositoryRelative(repairArtifact.path),
    presetRepairHash,
    quarantineHash: quarantine.quarantineHash,
  },
  independentVerificationRequired: true,
  valid: repair.valid,
  issues: repair.issues,
};
const terminal = {
  ...terminalPayload,
  terminalStabilityHash: sha256Canonical(terminalPayload),
};
await writeJsonAtomic(
  path.join(objectiveDirectory, 'terminal-bounded-evidence.json'),
  terminal
);

process.stdout.write(
  `${JSON.stringify({
    valid: repair.valid,
    issues: repair.issues,
    presetRepairHash,
    terminalStabilityHash: terminal.terminalStabilityHash,
    stableEvidence: repair.stableEvidence,
    output: repositoryRelative(repairArtifact.path),
  })}\n`
);
if (!repair.valid) process.exitCode = 1;

async function loadRound(directory, roundId) {
  const roundDirectory = path.join(directory, roundId);
  const manifest = await readJson(
    path.join(roundDirectory, 'round-manifest.json')
  );
  const aggregate = await readJson(path.join(roundDirectory, 'aggregate.json'));
  const feedback = await readJsonIfExists(
    path.join(roundDirectory, 'feedback-aggregate.json')
  );
  const shardNames = (
    await fs.readdir(path.join(roundDirectory, 'shards'), {
      withFileTypes: true,
    })
  )
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort(compareText);
  const shards = [];
  for (const shardName of shardNames) {
    const shardDirectory = path.join(roundDirectory, 'shards', shardName);
    const checkpoint = await readJson(
      path.join(shardDirectory, 'checkpoint.json')
    );
    const result = await readJson(path.join(shardDirectory, 'result.json'));
    if (
      checkpoint.artifacts?.resultCanonicalSha256 !== sha256Canonical(result)
    ) {
      issues.push(`${roundId}:${shardName}:result-canonical-hash-mismatch`);
    }
    shards.push({
      shardName,
      shardDirectory,
      sourceConfigIdentity: checkpoint.coverage?.sourceConfigIdentity ?? null,
      checkpoint,
      result,
    });
  }
  return { manifest, aggregate, feedback, shards };
}

function candidateIdentities(shards, candidateObjective) {
  return shards.flatMap(shard =>
    (shard.result.serviceResult?.results ?? []).map(result =>
      createCandidateRawIdentity(result, candidateObjective)
    )
  );
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

function compareExact(label, left, right, issueList) {
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    issueList.push(`${label}-mismatch`);
  }
}

async function readJsonIfExists(filePath) {
  try {
    return await readJson(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function sorted(values) {
  return [...values].map(String).sort(compareText);
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
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
