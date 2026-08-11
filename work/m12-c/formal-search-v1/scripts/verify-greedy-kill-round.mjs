import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer } from 'vite';

import {
  assertGreedyNormalSynthesisAvailable,
  createCandidateRawIdentity,
  readJson,
  sha256Canonical,
  writeJsonAtomic,
} from './formal-search-artifacts.mjs';
import {
  classifyGreedyKillProbe,
  deriveGreedyNormalCadence,
  synthesizeGreedyNormalAxis,
} from './greedy-normal-axis.mjs';

assertGreedyNormalSynthesisAvailable();

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..'
);
const roundArgument = readArgument('--round');
if (!roundArgument) throw new Error('--round is required');
const roundDirectory = resolveRepositoryPath(roundArgument);
const manifest = await readJson(
  path.join(roundDirectory, 'round-manifest.json')
);
const checkpoint = await readJson(
  path.join(roundDirectory, 'round-checkpoint.json')
);
const aggregate = await readJson(path.join(roundDirectory, 'aggregate.json'));
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

try {
  const [packageModule, serviceModule, killModule] = await Promise.all([
    vite.ssrLoadModule('/src/data/verifiedCombatMechanicsPackage.js'),
    vite.ssrLoadModule('/src/machine-axis/machineAxisService.js'),
    vite.ssrLoadModule('/src/machine-axis/machineAxisKillEvaluator.js'),
  ]);
  packageModule.installVerifiedCombatMechanicsPackage(mechanicsPackage);
  const service = serviceModule.createMachineAxisService();
  const issues = [];
  const rows = [];
  if (manifest.objective !== 'fastest-kill')
    issues.push('objective-not-fastest-kill');
  if (checkpoint.status !== 'completed') issues.push('round-not-completed');
  if (aggregate.formalRankingReady !== false) {
    issues.push('aggregate-formal-ranking-ready-not-false');
  }
  if (aggregate.rankingClaim !== 'AI-guided heuristic Top-N') {
    issues.push('aggregate-ranking-claim-drift');
  }
  if (
    aggregate.coverage?.completedSourceConfigIdentities?.length !== 8 ||
    aggregate.coverage?.failedSourceConfigIdentities?.length !== 0 ||
    aggregate.coverage?.missingSourceConfigIdentities?.length !== 0
  ) {
    issues.push('aggregate-source-coverage-not-8-of-8');
  }
  const boundaryCandidates = [
    ...(aggregate.results ?? []),
    ...(aggregate.cutoffTies ?? []),
  ];
  const boundaryIdentityHashes = boundaryCandidates.map(
    candidate => candidate.rawIdentity?.identityHash
  );
  if (
    aggregate.results?.length !== 5 ||
    aggregate.cutoffTies?.length !== 3 ||
    new Set(boundaryIdentityHashes).size !== 8
  ) {
    issues.push('aggregate-top5-or-tie-boundary-invalid');
  }
  if (
    !boundaryCandidates.every(
      candidate => Number(candidate.score) === 66133.333333
    )
  ) {
    issues.push('aggregate-kill-score-boundary-drift');
  }
  const aggregateIdentitySet = new Set(boundaryIdentityHashes);
  const shardDirectories = (
    await fs.readdir(path.join(roundDirectory, 'shards'), {
      withFileTypes: true,
    })
  )
    .filter(entry => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name, 'en'));
  if (shardDirectories.length !== 8) issues.push('shard-directory-count-not-8');

  for (const shardEntry of shardDirectories) {
    const shardDirectory = path.join(roundDirectory, 'shards', shardEntry.name);
    const shardCheckpoint = await readJson(
      path.join(shardDirectory, 'checkpoint.json')
    );
    const resultArtifact = await readJson(
      path.join(shardDirectory, 'result.json')
    );
    const localIssues = [];
    if (shardCheckpoint.status !== 'completed') {
      localIssues.push('shard-not-completed');
    }
    if (
      sha256Canonical(resultArtifact) !==
      shardCheckpoint.artifacts?.resultCanonicalSha256
    ) {
      localIssues.push('shard-result-canonical-hash-mismatch');
    }
    const candidates = resultArtifact.serviceResult?.results ?? [];
    if (candidates.length !== 1) localIssues.push('shard-result-count-not-1');
    const candidate = candidates[0];
    if (!candidate) {
      rows.push({ shard: shardEntry.name, valid: false, issues: localIssues });
      issues.push(`${shardEntry.name}:candidate-missing`);
      continue;
    }
    const rawIdentity = createCandidateRawIdentity(candidate, 'fastest-kill');
    if (!aggregateIdentitySet.has(rawIdentity.identityHash)) {
      localIssues.push('raw-identity-not-on-aggregate-boundary');
    }
    if ((candidate.axis?.actions ?? []).length !== 221) {
      localIssues.push('candidate-action-count-not-221');
    }
    for (
      let index = 0;
      index < (candidate.axis?.actions ?? []).length;
      index += 1
    ) {
      const action = candidate.axis.actions[index];
      if (
        action.id !== `search-action-${index + 1}` ||
        action.owner?.kind !== 'actor' ||
        action.owner?.slotId !== 'm12c-slot:112001' ||
        action.intent?.kind !== 'public-action' ||
        action.intent?.actionKind !== 'normal-attack' ||
        Number(action.intent?.publicActionId) !== 11200101 ||
        Number(action.intent?.attackInput?.sequenceIndex) !== 1 ||
        Number(action.schedule?.frame) !== index * 18
      ) {
        localIssues.push(`normal-chain-contract-drift:${index + 1}`);
        break;
      }
    }
    const baseAxis = structuredClone(candidate.axis);
    baseAxis.actions = [];
    baseAxis.scenario.name = String(baseAxis.scenario.name).replace(
      / \[greedy-normal-v1:\d+\]$/,
      ''
    );
    const cadence = deriveGreedyNormalCadence(
      candidate.axis.actions[0],
      candidate.axis.actions[1]
    );
    const probes = {};
    for (const actionCount of [220, 221, 222]) {
      const axis = synthesizeGreedyNormalAxis({
        baseAxis,
        cadence,
        actionCount,
      });
      const simulation = service.simulate(axis);
      const proof = killModule.createFastestKillProof(simulation, axis, {
        objectiveContract: axis.scenario.objectiveContract,
      });
      const classification = classifyGreedyKillProbe({ proof });
      probes[actionCount] = {
        classification,
        enemyHp: simulation.trace?.state?.final?.enemy?.hp ?? null,
        inputHash: simulation.hashes?.input ?? null,
        traceHash: simulation.hashes?.trace ?? null,
        legalityProofPassed: simulation.actionLegalityProof?.passed === true,
        skippedActionCount:
          simulation.actionLegalityProof?.skippedActionCount ?? null,
        unresolvedActionCount:
          simulation.actionLegalityProof?.unresolvedActionCount ?? null,
        proofStatus: proof.status,
        proofFormalScore: proof.formalScore,
        firstLethal: proof.killProof?.firstLethal ?? null,
      };
      if (actionCount === 221) {
        const repeat = service.simulate(axis);
        if (
          repeat.hashes?.input !== simulation.hashes?.input ||
          repeat.hashes?.trace !== simulation.hashes?.trace
        ) {
          localIssues.push('candidate-reproduction-hash-mismatch');
        }
        const validation = service.validate(axis);
        if (
          validation.valid !== true ||
          validation.actionLegalityProof?.passed !== true ||
          validation.actionLegalityProof?.skippedActionCount !== 0 ||
          validation.actionLegalityProof?.unresolvedActionCount !== 0
        ) {
          localIssues.push('candidate-action-legality-proof-failed');
        }
        if (
          simulation.hashes?.input !== candidate.hashes?.input ||
          simulation.hashes?.trace !== candidate.hashes?.trace ||
          proof.hashes?.kill !== candidate.objectiveProof?.hashes?.kill
        ) {
          localIssues.push('candidate-stored-proof-hash-mismatch');
        }
      }
    }
    if (
      probes[220].classification.status !== 'valid-not-killed' ||
      Number(probes[220].enemyHp) !== 2807.551112 ||
      probes[220].proofFormalScore !== null
    ) {
      localIssues.push('220-prefix-boundary-invalid');
    }
    if (
      probes[221].classification.status !== 'killed-valid' ||
      Number(probes[221].proofFormalScore) !== 66133.333333 ||
      Number(probes[221].firstLethal?.frame) !== 3968 ||
      Number(probes[221].firstLethal?.timeMs) !== 66133.333333
    ) {
      localIssues.push('221-prefix-kill-proof-invalid');
    }
    if (
      probes[222].classification.status !== 'invalid-upper-bound' ||
      !probes[222].classification.issueCodes.includes(
        'machine-axis-action-target-dead'
      )
    ) {
      localIssues.push('222-prefix-target-dead-rejection-missing');
    }
    const scenario = candidate.axis.scenario;
    if (
      scenario.jointAttackRuntime?.clientParityReady !== false ||
      scenario.optimizationQualification?.mode !== 'formal' ||
      scenario.initialStatePreset?.presetId !==
        'm12c-kill-full-sp-ruby12-zero-marks-v1' ||
      Number(scenario.enemy?.enemyId) !== 310054 ||
      Number(scenario.enemy?.level) !== 80 ||
      Number(scenario.enemy?.profile?.attributes?.maxHp) !== 1912087.24 ||
      scenario.critical?.policy !== 'expected'
    ) {
      localIssues.push('scenario-authority-boundary-drift');
    }
    if (
      (scenario.initialRuntimeState?.tuningMarks ?? []).length !== 0 ||
      !(scenario.team ?? []).every(slot => Number(slot.initialSp) === 100) ||
      !(scenario.initialRuntimeState?.kiboEnergyBySlot ?? []).every(
        row => Number(row.currentValue) === 100
      )
    ) {
      localIssues.push('kill-initial-state-sp-or-mark-drift');
    }
    const hasRuby = (scenario.team ?? []).some(
      slot => Number(slot.characterId) === 103002
    );
    const special = scenario.initialRuntimeState?.specialResourcesByActor ?? [];
    if (
      (hasRuby &&
        !special.some(
          row =>
            row.resourceIdentity === 'actor:103002:element:103002047' &&
            Number(row.currentValue) === 12
        )) ||
      (!hasRuby && special.length !== 0)
    ) {
      localIssues.push('ruby-ammo-boundary-drift');
    }
    const starbornActors = (candidate.m12c?.build?.actors ?? []).filter(
      actor => actor.optimizationObjectId === 'STARBORN'
    );
    if (starbornActors.length > 1) {
      localIssues.push('starborn-optimization-object-duplicated');
    }
    const sourceCharacters = (candidate.m12c?.build?.actors ?? []).map(actor =>
      Number(actor.sourceCharacterId)
    );
    if (
      sourceCharacters.includes(199001) &&
      sourceCharacters.includes(199002)
    ) {
      localIssues.push('starborn-source-aliases-coexist');
    }
    rows.push({
      shard: shardEntry.name,
      sourceConfigIdentity: candidate.m12c?.sourceConfigIdentity ?? null,
      buildHash: candidate.m12c?.buildHash ?? null,
      rawIdentity,
      score: candidate.score,
      actionCount: candidate.axis.actions.length,
      cadenceHash: cadence.cadenceHash,
      probes,
      valid: localIssues.length === 0,
      issues: localIssues,
    });
    for (const issue of localIssues) issues.push(`${shardEntry.name}:${issue}`);
    process.stdout.write(
      `${JSON.stringify({
        event: 'candidate-verified',
        shard: shardEntry.name,
        sourceConfigIdentity: candidate.m12c?.sourceConfigIdentity ?? null,
        valid: localIssues.length === 0,
        issueCount: localIssues.length,
      })}\n`
    );
  }

  const payload = {
    schemaVersion: 1,
    kind: 'azpr-m12c-formal-greedy-kill-independent-verification',
    runId: manifest.runId,
    roundId: manifest.roundId,
    objective: manifest.objective,
    rankingClaim: aggregate.rankingClaim,
    formalRankingReady: false,
    clientParityReady: false,
    aggregateHash: aggregate.aggregateHash,
    coverage: {
      expectedCandidateCount: 8,
      verifiedCandidateCount: rows.length,
      validCandidateCount: rows.filter(row => row.valid).length,
      invalidCandidateCount: rows.filter(row => !row.valid).length,
      topNCount: aggregate.results?.length ?? 0,
      cutoffTieCount: aggregate.cutoffTies?.length ?? 0,
      rawIdentityCount: new Set(boundaryIdentityHashes).size,
    },
    boundaryContract: {
      shorterActionCount: 220,
      killedActionCount: 221,
      rejectedLongerActionCount: 222,
      killedFrame: 3968,
      killedTimeMs: 66133.333333,
      shorterRemainingHp: 2807.551112,
      longerRejectionCode: 'machine-axis-action-target-dead',
    },
    valid: issues.length === 0,
    issues: [...new Set(issues)].sort((left, right) =>
      left.localeCompare(right, 'en')
    ),
    rows,
  };
  const verificationHash = sha256Canonical(payload);
  const report = { ...payload, verificationHash };
  const output = await writeJsonAtomic(
    path.join(roundDirectory, 'independent-verification.json'),
    report
  );
  process.stdout.write(
    `${JSON.stringify({
      event: 'verification-finished',
      valid: report.valid,
      issueCount: report.issues.length,
      verificationHash,
      output: repositoryRelative(output.path),
    })}\n`
  );
  if (!report.valid) process.exitCode = 1;
} finally {
  await vite.close();
}

function resolveRepositoryPath(relativePath) {
  const resolved = path.resolve(projectRoot, relativePath);
  if (
    resolved !== projectRoot &&
    !resolved.startsWith(`${projectRoot}${path.sep}`)
  ) {
    throw new Error('Path escapes repository root');
  }
  return resolved;
}

function repositoryRelative(filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join('/');
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}
