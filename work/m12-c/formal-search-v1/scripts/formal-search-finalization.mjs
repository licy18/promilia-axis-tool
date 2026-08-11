import {
  FORMAL_SEARCH_ARTIFACT_SCHEMA_VERSION,
  FORMAL_SEARCH_RANKING_CLAIM,
  createCandidateRawIdentity,
  sha256Canonical,
  validateFinalCandidate,
} from './formal-search-artifacts.mjs';

export function finalizeObjectiveArtifacts({
  runId,
  objective,
  baseline,
  rounds = [],
  topN = 5,
  rankingRoundIds = null,
} = {}) {
  const issues = [];
  const normalizedRankingRoundIds =
    rankingRoundIds == null
      ? null
      : [...new Set(rankingRoundIds.map(String))].sort(compareText);
  const observedRankingRoundIds = new Set();
  const candidatesByIdentity = new Map();
  const invalidCandidates = [];
  const roundEvidence = [];
  const budgetUsage = {};
  let completedShardCount = 0;
  let failedShardCount = 0;
  let missingShardCount = 0;

  for (const round of [...rounds].sort(compareRound)) {
    const rankingEligible =
      normalizedRankingRoundIds == null ||
      normalizedRankingRoundIds.includes(String(round.roundId));
    if (rankingEligible) observedRankingRoundIds.add(String(round.roundId));
    const aggregate = round?.aggregate ?? {};
    const completedSources =
      aggregate.coverage?.completedSourceConfigIdentities ?? [];
    const failedSources = aggregate.coverage?.failedSourceConfigIdentities ?? [];
    const missingSources = aggregate.coverage?.missingSourceConfigIdentities ?? [];
    failedShardCount += failedSources.length;
    missingShardCount += missingSources.length;
    if (failedSources.length > 0) {
      issues.push(`round-failed-shards:${round.roundId}:${failedSources.length}`);
    }
    if (missingSources.length > 0) {
      issues.push(`round-missing-shards:${round.roundId}:${missingSources.length}`);
    }
    if (aggregate.objective !== objective) {
      issues.push(`round-objective-mismatch:${round.roundId}`);
    }
    if (aggregate.baseline?.head !== baseline?.head) {
      issues.push(`round-baseline-mismatch:${round.roundId}`);
    }

    const roundShardHashes = [];
    for (const shard of [...(round.shards ?? [])].sort(compareShard)) {
      const checkpoint = shard?.checkpoint ?? {};
      if (checkpoint.status !== 'completed') {
        failedShardCount += checkpoint.status === 'failed' ? 1 : 0;
        missingShardCount += checkpoint.status === 'failed' ? 0 : 1;
        issues.push(
          `shard-not-completed:${round.roundId}:${checkpoint.shardId ?? 'unknown'}`
        );
        continue;
      }
      completedShardCount += 1;
      const resultArtifact = shard?.resultArtifact;
      const resultCanonicalSha256 = sha256Canonical(resultArtifact);
      if (
        checkpoint.artifacts?.resultCanonicalSha256 !== resultCanonicalSha256
      ) {
        issues.push(
          `shard-result-hash-mismatch:${round.roundId}:${checkpoint.shardId}`
        );
        continue;
      }
      if (
        resultArtifact?.objective !== objective ||
        resultArtifact?.baseline?.head !== baseline?.head
      ) {
        issues.push(
          `shard-result-authority-mismatch:${round.roundId}:${checkpoint.shardId}`
        );
        continue;
      }
      const serviceResult = resultArtifact.serviceResult ?? {};
      for (const [key, value] of Object.entries(serviceResult.summary ?? {})) {
        if (Number.isFinite(Number(value)) && isBudgetCounter(key)) {
          budgetUsage[key] = Number(budgetUsage[key] ?? 0) + Number(value);
        }
      }
      roundShardHashes.push({
        shardId: checkpoint.shardId,
        sourceConfigIdentity: checkpoint.coverage?.sourceConfigIdentity ?? null,
        inputHash: checkpoint.inputHash ?? null,
        guidanceHash: checkpoint.guidanceHash ?? null,
        resultCanonicalSha256,
      });
      for (const result of serviceResult.results ?? []) {
        const validation = validateFinalCandidate(result, objective);
        const rawIdentity = createCandidateRawIdentity(result, objective);
        if (!validation.valid) {
          invalidCandidates.push({
            roundId: round.roundId,
            shardId: checkpoint.shardId,
            identityHash: rawIdentity.identityHash,
            issues: validation.issues,
          });
          continue;
        }
        if (!rankingEligible) continue;
        const entry = {
          roundId: round.roundId,
          shardId: checkpoint.shardId,
          sourceConfigIdentity:
            result.m12c?.sourceConfigIdentity ??
            checkpoint.coverage?.sourceConfigIdentity ??
            null,
          rawIdentity,
          result,
        };
        const existing = candidatesByIdentity.get(rawIdentity.identityHash);
        if (!existing || compareCandidateEntries(entry, existing, objective) < 0) {
          candidatesByIdentity.set(rawIdentity.identityHash, entry);
        }
      }
    }
    if (round.shards?.length !== completedSources.length) {
      issues.push(
        `round-shard-coverage-mismatch:${round.roundId}:${round.shards?.length ?? 0}:${completedSources.length}`
      );
    }
    roundEvidence.push({
      roundId: round.roundId,
      iteration: round.manifest?.iteration ?? null,
      aggregateHash: aggregate.aggregateHash ?? null,
      feedbackAggregateHash:
        round.feedbackAggregate?.feedbackAggregateHash ?? null,
      guidanceHash: round.manifest?.guidanceHash ?? null,
      sourceConfigCount: round.manifest?.sourceConfigCount ?? null,
      completedSourceConfigCount: completedSources.length,
      failedSourceConfigCount: failedSources.length,
      missingSourceConfigCount: missingSources.length,
      shardEvidence: roundShardHashes.sort(compareShardHash),
    });
  }

  for (const roundId of normalizedRankingRoundIds ?? []) {
    if (!observedRankingRoundIds.has(roundId)) {
      issues.push(`ranking-round-not-found:${roundId}`);
    }
  }

  const rankedCandidates = [...candidatesByIdentity.values()].sort(
    (left, right) => compareCandidateEntries(left, right, objective)
  );
  const selected = rankedCandidates.slice(0, topN);
  const cutoffScore =
    selected.length === topN ? Number(selected[topN - 1].result.score) : null;
  const cutoffTies =
    cutoffScore == null
      ? []
      : rankedCandidates
          .slice(topN)
          .filter(entry => scoresTie(Number(entry.result.score), cutoffScore));
  if (selected.length !== topN) {
    issues.push(`top-n-incomplete:${selected.length}:${topN}`);
  }
  if (new Set(selected.map(entry => entry.rawIdentity.identityHash)).size !== topN) {
    issues.push('top-n-identity-not-distinct');
  }

  const topFamilyIdentities = [
    ...new Set(
      selected.map(entry =>
        String(
          entry.result?.m12c?.teamIdentity ??
            entry.result?.m12c?.sourceConfigIdentity ??
            ''
        )
      )
    ),
  ].filter(Boolean);
  const deterministicPayload = {
    schemaVersion: FORMAL_SEARCH_ARTIFACT_SCHEMA_VERSION,
    contractName: 'AzPrM12CFormalSearchObjectiveFinalization',
    kind: 'azpr-m12c-formal-search-objective-finalization',
    runId,
    objective,
    rankingClaim: FORMAL_SEARCH_RANKING_CLAIM,
    formalRankingReady: false,
    baseline,
    rankingEvidence: {
      mode:
        normalizedRankingRoundIds == null
          ? 'all-completed-rounds'
          : 'declared-terminal-rounds',
      roundIds:
        normalizedRankingRoundIds ??
        roundEvidence.map(entry => entry.roundId).sort(compareText),
      identityPolicy: 'raw-build-source-front-preset-input-trace-v1',
      semanticEquivalenceApplied: false,
      note:
        'All rounds remain coverage/budget/provenance evidence; only declared terminal rounds contribute ranking candidates when a terminal scope is supplied.',
    },
    validity: {
      valid: issues.length === 0,
      issues: [...new Set(issues)].sort(compareText),
    },
    coverage: {
      roundCount: roundEvidence.length,
      completedShardCount,
      failedShardCount,
      missingShardCount,
      roundEvidence,
    },
    budgetUsage: Object.fromEntries(
      Object.entries(budgetUsage).sort(([left], [right]) => compareText(left, right))
    ),
    summary: {
      exploredValidDistinctCandidateCount: rankedCandidates.length,
      invalidCandidateCount: invalidCandidates.length,
      topNRequested: topN,
      topNReady: selected.length === topN,
      topNFamilyCount: topFamilyIdentities.length,
      cutoffScore,
      cutoffTieCount: cutoffTies.length,
    },
    candidateIdentityHashes: selected.map(entry => entry.rawIdentity.identityHash),
    cutoffTieIdentityHashes: cutoffTies.map(
      entry => entry.rawIdentity.identityHash
    ),
  };
  const finalizationHash = sha256Canonical(deterministicPayload);
  return {
    ...deterministicPayload,
    finalizationHash,
    invalidCandidates,
    results: selected.map((entry, index) => ({
      ...entry.result,
      rank: index + 1,
      rawIdentity: entry.rawIdentity,
      roundId: entry.roundId,
      shardId: entry.shardId,
      sourceConfigIdentity: entry.sourceConfigIdentity,
    })),
    cutoffTies: cutoffTies.map(entry => ({
      ...entry.result,
      rawIdentity: entry.rawIdentity,
      roundId: entry.roundId,
      shardId: entry.shardId,
      sourceConfigIdentity: entry.sourceConfigIdentity,
    })),
  };
}

export function compareCandidateEntries(left, right, objective) {
  const leftScore = Number(left?.result?.score);
  const rightScore = Number(right?.result?.score);
  if (objective === 'fastest-kill') {
    if (leftScore !== rightScore) return leftScore - rightScore;
  } else if (leftScore !== rightScore) {
    return rightScore - leftScore;
  }
  const identityOrder = compareText(
    left?.rawIdentity?.identityHash ?? '',
    right?.rawIdentity?.identityHash ?? ''
  );
  if (identityOrder !== 0) return identityOrder;
  return compareText(
    `${left?.roundId ?? ''}|${left?.shardId ?? ''}`,
    `${right?.roundId ?? ''}|${right?.shardId ?? ''}`
  );
}

function compareRound(left, right) {
  return compareText(left?.roundId ?? '', right?.roundId ?? '');
}

function compareShard(left, right) {
  return compareText(
    left?.checkpoint?.shardId ?? '',
    right?.checkpoint?.shardId ?? ''
  );
}

function compareShardHash(left, right) {
  return compareText(left?.shardId ?? '', right?.shardId ?? '');
}

function compareText(left, right) {
  return String(left).localeCompare(String(right), 'en');
}

function scoresTie(left, right) {
  return Object.is(left, right) || Math.abs(left - right) <= 1e-12;
}

function isBudgetCounter(key) {
  return new Set([
    'steps',
    'candidatesEvaluated',
    'invalidCandidates',
    'mergedCandidates',
    'prunedCandidates',
    'expandedCandidates',
    'completedCandidates',
    'formalSurfaceRejectedCandidates',
    'buildCount',
    'variantSearchCount',
    'candidateResultCount',
    'failureCount',
  ]).has(key);
}
