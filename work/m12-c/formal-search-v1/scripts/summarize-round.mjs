import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  readJson,
  sha256Canonical,
  sha256Text,
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
  throw new Error('Usage: node summarize-round.mjs --round <round-directory>');
}

const roundDirectory = path.resolve(projectRoot, roundArgument);
const aggregate = await readJson(path.join(roundDirectory, 'aggregate.json'));
const shardDirectory = path.join(roundDirectory, 'shards');
const shardNames = (await fs.readdir(shardDirectory, { withFileTypes: true }))
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort(compareText);

const feedbackRows = [];
for (const shardName of shardNames) {
  const feedbackPath = path.join(shardDirectory, shardName, 'feedback.json');
  try {
    const text = await fs.readFile(feedbackPath, 'utf8');
    feedbackRows.push({
      shardName,
      feedbackPath,
      feedbackFileSha256: sha256Text(text),
      feedback: JSON.parse(text),
    });
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

const budgetTotals = {};
const rejectionCounts = new Map();
const recommendationCounts = new Map();
const guidanceHashes = new Set();
const sourceConfigIdentities = new Set();

for (const row of feedbackRows) {
  const feedback = row.feedback;
  if (feedback.guidanceHash) guidanceHashes.add(String(feedback.guidanceHash));
  const sourceConfigIdentity = feedback.formalShard?.sourceConfigIdentity;
  if (sourceConfigIdentity) sourceConfigIdentities.add(String(sourceConfigIdentity));
  for (const [key, value] of Object.entries(feedback.budgetUsage ?? {})) {
    if (Number.isFinite(Number(value))) {
      budgetTotals[key] = Number(budgetTotals[key] ?? 0) + Number(value);
    }
  }
  for (const rejection of feedback.rejectionBreakdown ?? []) {
    const code = String(rejection?.code ?? 'unknown');
    rejectionCounts.set(
      code,
      Number(rejectionCounts.get(code) ?? 0) + Number(rejection?.count ?? 0)
    );
  }
  for (const recommendation of feedback.recommendations ?? []) {
    const text = String(recommendation);
    recommendationCounts.set(text, Number(recommendationCounts.get(text) ?? 0) + 1);
  }
}

const deterministicPayload = {
  schemaVersion: 1,
  contractName: 'AzPrM12CFormalSearchRoundFeedbackAggregate',
  kind: 'azpr-m12c-formal-search-round-feedback-aggregate',
  runId: aggregate.runId,
  roundId: aggregate.roundId,
  objective: aggregate.objective,
  rankingClaim: aggregate.rankingClaim,
  formalRankingReady: false,
  roundAggregateHash: aggregate.aggregateHash,
  guidanceHashes: [...guidanceHashes].sort(compareText),
  coverage: {
    expectedSourceConfigCount:
      aggregate.coverage?.expectedSourceConfigIdentities?.length ?? 0,
    completedSourceConfigCount:
      aggregate.coverage?.completedSourceConfigIdentities?.length ?? 0,
    failedSourceConfigCount:
      aggregate.coverage?.failedSourceConfigIdentities?.length ?? 0,
    missingSourceConfigCount:
      aggregate.coverage?.missingSourceConfigIdentities?.length ?? 0,
    feedbackFileCount: feedbackRows.length,
    feedbackSourceConfigCount: sourceConfigIdentities.size,
  },
  budgetUsage: Object.fromEntries(
    Object.entries(budgetTotals).sort(([left], [right]) => compareText(left, right))
  ),
  rejectionBreakdown: [...rejectionCounts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((left, right) => right.count - left.count || compareText(left.code, right.code)),
  recommendations: [...recommendationCounts.entries()]
    .map(([text, count]) => ({ text, count }))
    .sort((left, right) => right.count - left.count || compareText(left.text, right.text)),
  rankingBoundary: {
    validDistinctCandidateCount: aggregate.summary?.validDistinctCandidateCount ?? 0,
    topNReady: aggregate.summary?.topNReady === true,
    topScore: aggregate.results?.[0]?.score ?? null,
    cutoffScore: aggregate.summary?.cutoffScore ?? null,
    cutoffTieCount: aggregate.summary?.cutoffTieCount ?? 0,
    topNFamilyCount: aggregate.summary?.topNFamilyCount ?? 0,
    topIdentityHashes: (aggregate.results ?? []).map(
      result => result.rawIdentity?.identityHash ?? null
    ),
    cutoffTieIdentityHashes: (aggregate.cutoffTies ?? []).map(
      result => result.rawIdentity?.identityHash ?? null
    ),
  },
  feedbackFiles: feedbackRows.map(row => ({
    shardName: row.shardName,
    sourceConfigIdentity: row.feedback.formalShard?.sourceConfigIdentity ?? null,
    feedbackFileSha256: row.feedbackFileSha256,
  })),
};

const feedbackAggregateHash = sha256Canonical(deterministicPayload);
const output = {
  ...deterministicPayload,
  feedbackAggregateHash,
};
const artifact = await writeJsonAtomic(
  path.join(roundDirectory, 'feedback-aggregate.json'),
  output
);
process.stdout.write(
  `${JSON.stringify({
    output: artifact.path,
    feedbackAggregateHash,
    coverage: output.coverage,
    rankingBoundary: output.rankingBoundary,
  })}\n`
);

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function compareText(left, right) {
  return String(left).localeCompare(String(right), 'en');
}
