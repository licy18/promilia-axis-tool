import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readJson, writeJsonAtomic } from './formal-search-artifacts.mjs';
import { finalizeObjectiveArtifactsAgainstRepository } from './formal-search-finalization.mjs';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..'
);
const objectiveArgument = readArgument('--objective-directory');
if (!objectiveArgument) {
  throw new Error(
    'Usage: node finalize-objective.mjs --objective-directory <objective-directory> [--ranking-round-id <round-id>]'
  );
}
const rankingRoundIds = readArguments('--ranking-round-id');

const objectiveDirectory = path.resolve(projectRoot, objectiveArgument);
const directoryEntries = await fs.readdir(objectiveDirectory, {
  withFileTypes: true,
});
const roundDirectories = [];
for (const entry of directoryEntries) {
  if (!entry.isDirectory()) continue;
  const directory = path.join(objectiveDirectory, entry.name);
  if (await fileExists(path.join(directory, 'round-manifest.json'))) {
    roundDirectories.push(directory);
  }
}
roundDirectories.sort(compareText);
if (roundDirectories.length === 0) {
  throw new Error(
    `No completed round directories found in ${objectiveDirectory}`
  );
}

const rounds = [];
for (const roundDirectory of roundDirectories) {
  const manifest = await readJson(
    path.join(roundDirectory, 'round-manifest.json')
  );
  const aggregate = await readJson(path.join(roundDirectory, 'aggregate.json'));
  const feedbackAggregatePath = path.join(
    roundDirectory,
    'feedback-aggregate.json'
  );
  const feedbackAggregate = (await fileExists(feedbackAggregatePath))
    ? await readJson(feedbackAggregatePath)
    : null;
  const shardRoot = path.join(roundDirectory, 'shards');
  const shardEntries = await fs.readdir(shardRoot, { withFileTypes: true });
  const shards = [];
  for (const shardEntry of shardEntries
    .filter(entry => entry.isDirectory())
    .sort((left, right) => compareText(left.name, right.name))) {
    const shardDirectory = path.join(shardRoot, shardEntry.name);
    const checkpoint = await readJson(
      path.join(shardDirectory, 'checkpoint.json')
    );
    const resultArtifact = await readJson(
      path.join(shardDirectory, 'result.json')
    );
    shards.push({ checkpoint, resultArtifact });
  }
  rounds.push({
    roundId: manifest.roundId,
    manifest,
    aggregate,
    feedbackAggregate,
    shards,
  });
}

const first = rounds[0];
const finalization = await finalizeObjectiveArtifactsAgainstRepository({
  repositoryRoot: projectRoot,
  runId: first.manifest.runId,
  objective: first.manifest.objective,
  baseline: first.manifest.baseline,
  rounds,
  topN: 5,
  rankingRoundIds: rankingRoundIds.length > 0 ? rankingRoundIds : null,
});
if (finalization.validity?.valid !== true) {
  throw new Error(
    `Objective finalization rejected before writing artifacts: ${JSON.stringify(finalization.validity?.issues ?? [])}`
  );
}
const finalizationDirectory = path.join(
  objectiveDirectory,
  'finalizations',
  finalization.finalizationHash
);
const top5Directory = path.join(finalizationDirectory, 'top5');
const resultWrite = await writeJsonAtomic(
  path.join(finalizationDirectory, 'objective-finalization.json'),
  finalization
);
const top5Rows = [];
for (const result of finalization.results) {
  const identityPrefix = result.rawIdentity.identityHash.slice(0, 12);
  const baseName = `rank-${String(result.rank).padStart(2, '0')}.${identityPrefix}`;
  const axisPath = path.join(top5Directory, `${baseName}.machine-axis.json`);
  const candidatePath = path.join(top5Directory, `${baseName}.candidate.json`);
  const axisWrite = await writeJsonAtomic(axisPath, result.axis);
  const candidateWrite = await writeJsonAtomic(candidatePath, result);
  top5Rows.push({
    rank: result.rank,
    score: result.score,
    rawIdentity: result.rawIdentity,
    teamIdentity: result.m12c?.teamIdentity ?? null,
    sourceConfigIdentity: result.m12c?.sourceConfigIdentity ?? null,
    initialFront: result.m12c?.initialFront ?? null,
    buildHash: result.m12c?.buildHash ?? null,
    objectiveProofStatus: result.objectiveProof?.status ?? null,
    objectiveProofHash:
      result.objectiveProof?.proofHash ??
      result.objectiveProof?.hashes?.cycle ??
      result.objectiveProof?.hashes?.kill ??
      null,
    legalityProofHash: result.legality?.proof?.proofHash ?? null,
    axisPath: repositoryRelative(axisPath),
    axisFileSha256: axisWrite.sha256,
    candidatePath: repositoryRelative(candidatePath),
    candidateFileSha256: candidateWrite.sha256,
  });
}
const top5Index = {
  schemaVersion: 1,
  kind: 'azpr-m12c-formal-search-top5-index',
  runId: finalization.runId,
  objective: finalization.objective,
  rankingClaim: finalization.rankingClaim,
  formalRankingReady: false,
  finalizationHash: finalization.finalizationHash,
  normalAttackInputAuthority: finalization.normalAttackInputAuthority,
  cutoffScore: finalization.summary.cutoffScore,
  cutoffTieCount: finalization.summary.cutoffTieCount,
  rows: top5Rows,
};
const indexWrite = await writeJsonAtomic(
  path.join(top5Directory, 'index.json'),
  top5Index
);
await writeJsonAtomic(
  path.join(objectiveDirectory, 'latest-finalization.json'),
  {
    schemaVersion: 1,
    kind: 'azpr-m12c-formal-search-finalization-pointer',
    runId: finalization.runId,
    objective: finalization.objective,
    finalizationHash: finalization.finalizationHash,
    normalAttackInputAuthority: finalization.normalAttackInputAuthority,
    valid: finalization.validity.valid,
    objectiveFinalizationPath: repositoryRelative(resultWrite.path),
    objectiveFinalizationFileSha256: resultWrite.sha256,
    top5IndexPath: repositoryRelative(indexWrite.path),
    top5IndexFileSha256: indexWrite.sha256,
  }
);

process.stdout.write(
  `${JSON.stringify({
    objective: finalization.objective,
    valid: finalization.validity.valid,
    issues: finalization.validity.issues,
    finalizationHash: finalization.finalizationHash,
    topNReady: finalization.summary.topNReady,
    rankingRoundIds: finalization.rankingEvidence.roundIds,
    cutoffScore: finalization.summary.cutoffScore,
    cutoffTieCount: finalization.summary.cutoffTieCount,
    output: repositoryRelative(resultWrite.path),
  })}\n`
);
if (!finalization.validity.valid) process.exitCode = 1;

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

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function repositoryRelative(filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join('/');
}

function compareText(left, right) {
  return String(left).localeCompare(String(right), 'en');
}
