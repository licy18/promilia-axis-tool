import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FORMAL_SEARCH_RANKING_CLAIM,
  analyzeFinalCandidateInitialState,
  createCandidateRawIdentity,
  readJson,
  sha256Canonical,
  validateFinalCandidate,
  writeJsonAtomic,
} from './formal-search-artifacts.mjs';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..'
);
const runArgument = readArgument('--run-directory');
if (!runArgument) {
  throw new Error(
    'Usage: node scan-terminal-preset-admission.mjs --run-directory <path>'
  );
}

const runDirectory = path.resolve(projectRoot, runArgument);
const objectivesDirectory = path.join(runDirectory, 'objectives');
const objectiveIds = [
  'cycle-dps-no-toughness',
  'cycle-dps-with-toughness',
  'fastest-kill',
];
const issues = [];
const roundSummaries = [];
const quarantinedOccurrences = [];
const scannedRawIdentities = new Set();
let scannedCandidateOccurrenceCount = 0;

for (const objective of objectiveIds) {
  const objectiveDirectory = path.join(objectivesDirectory, objective);
  const terminalEvidence = await readJson(
    path.join(objectiveDirectory, 'terminal-bounded-evidence.json')
  );
  if (terminalEvidence.valid !== true) {
    issues.push(`${objective}:terminal-evidence-invalid-before-scan`);
  }
  const terminalRoundIds = terminalEvidence.terminalRounds?.map(
    round => round.roundId
  );
  if (!Array.isArray(terminalRoundIds) || terminalRoundIds.length < 3) {
    issues.push(`${objective}:terminal-round-set-incomplete`);
    continue;
  }
  for (const roundId of terminalRoundIds) {
    const roundDirectory = path.join(objectiveDirectory, roundId);
    const manifest = await readJson(
      path.join(roundDirectory, 'round-manifest.json')
    );
    const shardNames = (await fs.readdir(path.join(roundDirectory, 'shards'), {
      withFileTypes: true,
    }))
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort(compareText);
    const roundQuarantine = [];
    let roundCandidateCount = 0;
    for (const shardName of shardNames) {
      const shardDirectory = path.join(roundDirectory, 'shards', shardName);
      const checkpoint = await readJson(
        path.join(shardDirectory, 'checkpoint.json')
      );
      const resultArtifact = await readJson(
        path.join(shardDirectory, 'result.json')
      );
      if (checkpoint.status !== 'completed') {
        issues.push(`${objective}:${roundId}:${shardName}:shard-not-completed`);
        continue;
      }
      for (const result of resultArtifact.serviceResult?.results ?? []) {
        scannedCandidateOccurrenceCount += 1;
        roundCandidateCount += 1;
        const rawIdentity = createCandidateRawIdentity(result, objective);
        scannedRawIdentities.add(rawIdentity.identityHash);
        const initialStateAdmission = analyzeFinalCandidateInitialState(
          result,
          objective
        );
        const validation = validateFinalCandidate(result, objective);
        if (!initialStateAdmission.valid) {
          const occurrence = {
            objective,
            roundId,
            iteration: manifest.iteration,
            shardId: checkpoint.shardId,
            shardDirectory: repositoryRelative(shardDirectory),
            sourceConfigIdentity:
              result.m12c?.sourceConfigIdentity ??
              checkpoint.coverage?.sourceConfigIdentity ??
              null,
            rawIdentityHash: rawIdentity.identityHash,
            buildHash: result.m12c?.buildHash ?? null,
            inputHash: result.hashes?.input ?? null,
            traceHash: result.hashes?.trace ?? null,
            presetAdmissionIssues: initialStateAdmission.issues,
            allFinalCandidateIssues: validation.issues,
            pollutionFields: describePollutionFields(
              result,
              initialStateAdmission
            ),
            actualPreset: structuredClone(
              result.axis?.scenario?.initialStatePreset ?? null
            ),
            canonicalReplacementPreset: {
              presetId: initialStateAdmission.expectedPresetId,
              presetHash: initialStateAdmission.expectedPresetHash,
              objectiveScope: initialStateAdmission.expectedObjectiveScope,
              actorSp: initialStateAdmission.expectedActorSp,
              kiboSp: initialStateAdmission.expectedKiboSp,
              tuningMarks: [],
              specialResources:
                initialStateAdmission.expectedSpecialResources ?? [],
            },
            quarantineStatus: 'excluded-from-formal-ranking-pending-replacement',
          };
          quarantinedOccurrences.push(occurrence);
          roundQuarantine.push(occurrence.rawIdentityHash);
        }
      }
    }
    roundSummaries.push({
      objective,
      roundId,
      iteration: manifest.iteration,
      shardCount: shardNames.length,
      candidateOccurrenceCount: roundCandidateCount,
      quarantinedOccurrenceCount: roundQuarantine.length,
      quarantinedRawIdentityHashes: [...new Set(roundQuarantine)].sort(
        compareText
      ),
    });
  }
}

const affectedRawIdentityHashes = [
  ...new Set(quarantinedOccurrences.map(row => row.rawIdentityHash)),
].sort(compareText);
const affectedSourceConfigIdentities = [
  ...new Set(
    quarantinedOccurrences.map(row => row.sourceConfigIdentity).filter(Boolean)
  ),
].sort(compareText);
const reportPayload = {
  schemaVersion: 1,
  kind: 'azpr-m12c-terminal-preset-admission-quarantine',
  runId: path.basename(runDirectory),
  rankingClaim: FORMAL_SEARCH_RANKING_CLAIM,
  formalRankingReady: false,
  clientParityReady: false,
  scanScope: {
    objectives: objectiveIds,
    terminalRoundCount: roundSummaries.length,
    candidateOccurrenceCount: scannedCandidateOccurrenceCount,
    distinctRawIdentityCount: scannedRawIdentities.size,
  },
  quarantinePolicy: {
    mode: 'fail-closed-canonical-objective-preset-admission',
    affectedCandidatesRemainExcludedUntilCanonicalShardReplacement: true,
    hashOnlyRewriteForbidden: true,
    gameplayContractChanged: false,
  },
  summary: {
    affectedObjectiveCount: new Set(
      quarantinedOccurrences.map(row => row.objective)
    ).size,
    quarantinedOccurrenceCount: quarantinedOccurrences.length,
    affectedRawIdentityCount: affectedRawIdentityHashes.length,
    affectedSourceConfigCount: affectedSourceConfigIdentities.length,
  },
  affectedRawIdentityHashes,
  affectedSourceConfigIdentities,
  roundSummaries,
  quarantinedOccurrences,
  valid: issues.length === 0,
  issues,
};
const quarantineHash = sha256Canonical(reportPayload);
const report = { ...reportPayload, quarantineHash };
const output = await writeJsonAtomic(
  path.join(runDirectory, 'final-verification', 'preset-admission-quarantine.json'),
  report
);

process.stdout.write(
  `${JSON.stringify({
    valid: report.valid,
    scanScope: report.scanScope,
    summary: report.summary,
    affectedRawIdentityHashes,
    affectedSourceConfigIdentities,
    quarantineHash,
    output: repositoryRelative(output.path),
  })}\n`
);
if (!report.valid) process.exitCode = 1;

function describePollutionFields(result, admission) {
  const state = result.axis?.scenario?.initialRuntimeState ?? {};
  const fields = [];
  if (admission.issues.includes('candidate-cycle-special-resources-not-empty')) {
    for (const [index, resource] of (
      state.specialResourcesByActor ?? []
    ).entries()) {
      fields.push({
        path: `axis.scenario.initialRuntimeState.specialResourcesByActor.${index}`,
        issue: 'kill-only-resource-present-in-cold-cycle-preset',
        value: structuredClone(resource),
      });
    }
  }
  if (
    admission.issues.includes('candidate-initial-state-preset-hash-mismatch')
  ) {
    fields.push({
      path: 'axis.scenario.initialStatePreset.presetHash',
      issue: 'canonical-projection-hash-mismatch',
      value: admission.actualPresetHash,
      expected: admission.expectedPresetHash,
    });
  }
  for (const issue of admission.issues) {
    if (
      issue !== 'candidate-cycle-special-resources-not-empty' &&
      issue !== 'candidate-initial-state-preset-hash-mismatch'
    ) {
      fields.push({ path: null, issue, value: null });
    }
  }
  return fields;
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
