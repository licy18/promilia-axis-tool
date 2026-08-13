import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization.js';

export const MACHINE_AXIS_LOCAL_SEARCH_RESULT_SCHEMA_VERSION = 1;
export const MACHINE_AXIS_LOCAL_SEARCH_RESULT_CONTRACT_NAME =
  'AzPrMachineAxisBoundedLocalSearchResult';

export function projectMachineAxisLocalEvaluation(candidate, entry) {
  const projected = {
    candidateId: candidate.candidateId,
    seedId: candidate.seedId,
    axisHash: candidate.axisHash,
    assignments: structuredClone(candidate.assignments ?? []),
    mutationDepth: Number(candidate.mutationDepth) || 0,
    score: entry.score ?? null,
    heuristicScore: entry.heuristicScore ?? null,
    scoreDirection: entry.scoreDirection ?? 'maximize',
    finalScoreEligible: entry.finalScoreEligible === true,
    stateHash: entry.stateHash ?? null,
    runHashes: structuredClone(entry.run?.hashes ?? null),
    metrics: structuredClone(entry.metrics ?? null),
    contributions: structuredClone(entry.contributions ?? null),
    actionLegalityProof: structuredClone(entry.actionLegalityProof ?? null),
    normalAttackInputProof: structuredClone(
      entry.normalAttackInputProof ?? null
    ),
    objectiveProof: structuredClone(entry.objectiveProof ?? null),
    objectiveIssues: structuredClone(entry.objectiveIssues ?? []),
    invalidActionCount: Number(entry.invalidActionCount) || 0,
    warnings: Number(entry.warnings) || 0,
    axis: structuredClone(entry.axis),
  };
  return {
    ...projected,
    resultIdentity: hashCanonicalValue(projected),
  };
}

export function createMachineAxisLocalSearchAggregate({
  plan,
  candidateSet,
  shardSet,
  shardResults,
  startedAt,
  endedAt,
} = {}) {
  const rows = (shardResults ?? []).flatMap(shard => shard.results ?? []);
  const sorted = [...rows].sort(compareLocalSearchRows);
  const selected = selectTopNWithCutoffTies(sorted, plan.topN);
  const shardStatusCounts = (shardResults ?? []).reduce((counts, shard) => {
    const status = String(shard.status ?? 'unknown');
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
  const evaluatedCandidateCount = (shardResults ?? []).reduce(
    (sum, shard) => sum + Number(shard.summary?.evaluatedCandidateCount ?? 0),
    0
  );
  const simulationCount = (shardResults ?? []).reduce(
    (sum, shard) => sum + Number(shard.summary?.simulationCount ?? 0),
    0
  );
  const rejectedCandidateCount = (shardResults ?? []).reduce(
    (sum, shard) => sum + Number(shard.summary?.rejectedCandidateCount ?? 0),
    0
  );
  const truncated =
    candidateSet.enumerationTruncated === true ||
    shardSet.boundedStopping?.truncated === true ||
    (shardResults ?? []).some(shard => shard.status !== 'complete');
  const aggregate = {
    schemaVersion: MACHINE_AXIS_LOCAL_SEARCH_RESULT_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_LOCAL_SEARCH_RESULT_CONTRACT_NAME,
    kind: 'azpr-machine-axis-bounded-local-search-result',
    planId: plan.planId,
    planHash: plan.planHash,
    objective: plan.objective,
    topN: plan.topN,
    authority: {
      classification: 'bounded-ai-guided-heuristic',
      formalRankingReady: false,
      clientParityReady: false,
      bounded: true,
      truncated,
      reasons: [
        'ai-authored-coarse-axis-seeds',
        'explicit-local-neighborhood-only',
        'hard-per-shard-and-run-budgets',
        ...(truncated ? ['bounded-stopping-triggered'] : []),
      ],
    },
    timing: {
      startedAt: startedAt ?? null,
      endedAt: endedAt ?? null,
      wallTimeMs:
        Date.parse(endedAt ?? '') - Date.parse(startedAt ?? '') || null,
    },
    coverage: {
      seedCount: plan.seeds.length,
      plannedCandidateCount: candidateSet.candidateCount,
      assignedCandidateCount: shardSet.assignedCandidateCount,
      evaluatedCandidateCount,
      rejectedCandidateCount,
      unevaluatedCandidateCount: Math.max(
        0,
        candidateSet.candidateCount -
          evaluatedCandidateCount -
          rejectedCandidateCount
      ),
      shardCount: shardSet.shardCount,
      shardStatusCounts,
      simulationCount,
      enumerationTruncated: candidateSet.enumerationTruncated === true,
      shardAssignmentTruncated: shardSet.boundedStopping?.truncated === true,
      cutoffTieCount: selected.cutoffTieCount,
    },
    budgets: structuredClone(plan.budget),
    parallelism: structuredClone(plan.parallelism),
    seedSummaries: structuredClone(candidateSet.seedSummaries ?? []),
    shardSummaries: (shardResults ?? []).map(shard => ({
      shardId: shard.shardId,
      status: shard.status,
      summary: structuredClone(shard.summary ?? null),
      resultHash: shard.resultHash ?? null,
    })),
    issues: (shardResults ?? []).flatMap(shard => shard.issues ?? []),
    results: selected.results,
  };
  return {
    ...aggregate,
    aggregateHash: hashCanonicalValue({ ...aggregate, timing: null }),
  };
}

export function selectTopNWithCutoffTies(rows, topN = 5) {
  const sorted = [...(rows ?? [])].sort(compareLocalSearchRows);
  const limit = Math.max(1, Number(topN) || 1);
  if (sorted.length <= limit) {
    return { results: sorted, cutoffTieCount: 0 };
  }
  const cutoff = sorted[limit - 1];
  const results = sorted.slice(0, limit);
  for (const row of sorted.slice(limit)) {
    if (!sameRankValue(row, cutoff)) break;
    results.push(row);
  }
  return {
    results,
    cutoffTieCount: Math.max(0, results.length - limit),
  };
}

export function compareLocalSearchRows(left, right) {
  const leftEligible = left.finalScoreEligible === true;
  const rightEligible = right.finalScoreEligible === true;
  if (leftEligible !== rightEligible) return leftEligible ? -1 : 1;
  const direction =
    leftEligible &&
    rightEligible &&
    (left.scoreDirection === 'minimize' || right.scoreDirection === 'minimize')
      ? 'minimize'
      : 'maximize';
  const leftRankValue = rankValue(left);
  const rightRankValue = rankValue(right);
  if (leftRankValue !== rightRankValue) {
    return direction === 'minimize'
      ? leftRankValue - rightRankValue
      : rightRankValue - leftRankValue;
  }
  if (Number(left.heuristicScore) !== Number(right.heuristicScore)) {
    return Number(right.heuristicScore ?? 0) - Number(left.heuristicScore ?? 0);
  }
  return String(left.candidateId).localeCompare(
    String(right.candidateId),
    'en'
  );
}

function sameRankValue(left, right) {
  return (
    left.finalScoreEligible === right.finalScoreEligible &&
    left.scoreDirection === right.scoreDirection &&
    rankValue(left) === rankValue(right) &&
    Number(left.heuristicScore ?? 0) === Number(right.heuristicScore ?? 0)
  );
}

function rankValue(row) {
  const score = Number(row.score);
  if (row.finalScoreEligible === true && Number.isFinite(score)) return score;
  const heuristic = Number(row.heuristicScore);
  return Number.isFinite(heuristic) ? heuristic : Number.NEGATIVE_INFINITY;
}
