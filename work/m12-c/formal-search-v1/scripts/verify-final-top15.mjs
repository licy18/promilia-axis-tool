import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer } from 'vite';

import {
  FORMAL_SEARCH_RANKING_CLAIM,
  createCandidateRawIdentity,
  matchesNormalAttackInputAuthorityDescriptor,
  readJson,
  sha256Canonical,
  sha256Text,
  validateFinalCandidate,
  writeJsonAtomic,
} from './formal-search-artifacts.mjs';
import {
  classifyGreedyKillProbe,
  deriveGreedyNormalCadence,
  synthesizeGreedyNormalAxis,
} from './greedy-normal-axis.mjs';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..'
);
const runArgument = readArgument('--run-directory');
if (!runArgument) {
  throw new Error('Usage: node verify-final-top15.mjs --run-directory <path>');
}
const runDirectory = resolveRepositoryPath(runArgument);
const objectiveIds = [
  'cycle-dps-no-toughness',
  'cycle-dps-with-toughness',
  'fastest-kill',
];
const mechanicsPackage = await readJson(
  path.join(
    projectRoot,
    'src',
    'data',
    'generated',
    'verified-combat-mechanics-package.json'
  )
);
const quarantine = await readJson(
  path.join(
    runDirectory,
    'final-verification',
    'preset-admission-quarantine.json'
  )
);
const quarantinedRawIdentityHashes = new Set(
  quarantine.affectedRawIdentityHashes ?? []
);
const vite = await createServer({
  root: projectRoot,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});

let report;
try {
  const [packageModule, serviceModule, killModule, authorityModule] =
    await Promise.all([
      vite.ssrLoadModule('/src/data/verifiedCombatMechanicsPackage.js'),
      vite.ssrLoadModule('/src/machine-axis/machineAxisService.js'),
      vite.ssrLoadModule('/src/machine-axis/machineAxisKillEvaluator.js'),
      vite.ssrLoadModule('/src/domain/verifiedNormalAttackInputAuthority.js'),
    ]);
  packageModule.installVerifiedCombatMechanicsPackage(mechanicsPackage);
  const service = serviceModule.createMachineAxisService();
  report = await verifyTop15({
    service,
    killModule,
    normalAttackInputAuthority:
      authorityModule.getVerifiedNormalAttackInputAuthorityDescriptor(),
  });
} finally {
  await vite.close();
}

const verificationHash = sha256Canonical(report);
const output = { ...report, verificationHash };
const write = await writeJsonAtomic(
  path.join(
    runDirectory,
    'final-verification',
    'independent-top15-verification.json'
  ),
  output
);
process.stdout.write(
  `${JSON.stringify({
    valid: output.valid,
    issueCount: output.issues.length,
    coverage: output.coverage,
    verificationHash,
    output: repositoryRelative(write.path),
  })}\n`
);
if (!output.valid) process.exitCode = 1;

async function verifyTop15({
  service,
  killModule,
  normalAttackInputAuthority,
}) {
  const issues = [];
  const objectives = [];
  const rows = [];
  for (const objective of objectiveIds) {
    const objectiveDirectory = path.join(runDirectory, 'objectives', objective);
    const pointerPath = path.join(
      objectiveDirectory,
      'latest-finalization.json'
    );
    const pointerText = await fs.readFile(pointerPath, 'utf8');
    const pointer = JSON.parse(pointerText);
    const finalizationPath = resolveRepositoryPath(
      pointer.objectiveFinalizationPath
    );
    const indexPath = resolveRepositoryPath(pointer.top5IndexPath);
    const finalizationText = await fs.readFile(finalizationPath, 'utf8');
    const indexText = await fs.readFile(indexPath, 'utf8');
    const finalization = JSON.parse(finalizationText);
    const index = JSON.parse(indexText);
    const objectiveIssues = [];
    if (
      pointer.valid !== true ||
      pointer.objective !== objective ||
      finalization.validity?.valid !== true ||
      finalization.objective !== objective ||
      index.objective !== objective
    ) {
      objectiveIssues.push('finalization-envelope-invalid');
    }
    if (
      pointer.finalizationHash !== finalization.finalizationHash ||
      index.finalizationHash !== finalization.finalizationHash
    ) {
      objectiveIssues.push('finalization-hash-pointer-mismatch');
    }
    for (const artifact of [pointer, finalization, index]) {
      if (
        !matchesNormalAttackInputAuthorityDescriptor(
          artifact.normalAttackInputAuthority,
          normalAttackInputAuthority
        )
      ) {
        objectiveIssues.push('normal-attack-input-authority-mismatch');
      }
    }
    if (
      sha256Text(finalizationText) !==
        pointer.objectiveFinalizationFileSha256 ||
      sha256Text(indexText) !== pointer.top5IndexFileSha256
    ) {
      objectiveIssues.push('finalization-file-hash-mismatch');
    }
    for (const artifact of [finalization, index]) {
      if (artifact.rankingClaim !== FORMAL_SEARCH_RANKING_CLAIM) {
        objectiveIssues.push('ranking-claim-mismatch');
      }
      if (artifact.formalRankingReady !== false) {
        objectiveIssues.push('formal-ranking-ready-not-false');
      }
    }
    if (
      finalization.results?.length !== 5 ||
      index.rows?.length !== 5 ||
      finalization.summary?.topNReady !== true ||
      Number(finalization.summary?.topNRequested) !== 5
    ) {
      objectiveIssues.push('top5-count-or-ready-invalid');
    }
    const identityHashes = (index.rows ?? []).map(
      row => row.rawIdentity?.identityHash
    );
    if (new Set(identityHashes).size !== 5) {
      objectiveIssues.push('top5-raw-identities-not-distinct');
    }
    if (
      identityHashes.some(identity =>
        quarantinedRawIdentityHashes.has(identity)
      ) ||
      (finalization.cutoffTies ?? []).some(tie =>
        quarantinedRawIdentityHashes.has(tie.rawIdentity?.identityHash)
      )
    ) {
      objectiveIssues.push('quarantined-raw-identity-survived-finalization');
    }
    if (
      (finalization.cutoffTies ?? []).some(
        tie => Number(tie.score) !== Number(finalization.summary.cutoffScore)
      ) ||
      new Set(
        (finalization.cutoffTies ?? []).map(
          tie => tie.rawIdentity?.identityHash
        )
      ).size !== Number(finalization.summary?.cutoffTieCount)
    ) {
      objectiveIssues.push('cutoff-tie-boundary-invalid');
    }
    for (let indexPosition = 0; indexPosition < 5; indexPosition += 1) {
      const indexRow = index.rows[indexPosition];
      const finalizedCandidate = finalization.results[indexPosition];
      const rowIssues = [];
      if (
        Number(indexRow?.rank) !== indexPosition + 1 ||
        Number(finalizedCandidate?.rank) !== indexPosition + 1 ||
        indexRow?.rawIdentity?.identityHash !==
          finalizedCandidate?.rawIdentity?.identityHash
      ) {
        rowIssues.push('rank-or-index-identity-mismatch');
      }
      const candidatePath = resolveRepositoryPath(indexRow.candidatePath);
      const axisPath = resolveRepositoryPath(indexRow.axisPath);
      const candidateText = await fs.readFile(candidatePath, 'utf8');
      const axisText = await fs.readFile(axisPath, 'utf8');
      const candidate = JSON.parse(candidateText);
      const axis = JSON.parse(axisText);
      if (
        sha256Text(candidateText) !== indexRow.candidateFileSha256 ||
        sha256Text(axisText) !== indexRow.axisFileSha256
      ) {
        rowIssues.push('top5-artifact-file-hash-mismatch');
      }
      if (
        sha256Canonical(candidate) !== sha256Canonical(finalizedCandidate) ||
        sha256Canonical(axis) !== sha256Canonical(candidate.axis)
      ) {
        rowIssues.push('top5-artifact-content-mismatch');
      }
      const recomputedIdentity = createCandidateRawIdentity(
        candidate,
        objective
      );
      if (
        recomputedIdentity.identityHash !== candidate.rawIdentity?.identityHash
      ) {
        rowIssues.push('raw-identity-recomputation-mismatch');
      }
      const finalValidation = validateFinalCandidate(
        candidate,
        objective,
        normalAttackInputAuthority
      );
      if (!finalValidation.valid) {
        rowIssues.push(
          ...finalValidation.issues.map(issue => `strict-final:${issue}`)
        );
      }
      const validation = service.validate(axis);
      const firstSimulation = service.simulate(axis);
      const secondSimulation = service.simulate(axis);
      if (
        validation.valid !== true ||
        validation.actionLegalityProof?.passed !== true ||
        validation.actionLegalityProof?.skippedActionCount !== 0 ||
        validation.actionLegalityProof?.unresolvedActionCount !== 0 ||
        validation.actionLegalityProof?.proofHash !==
          candidate.legality?.proof?.proofHash
      ) {
        rowIssues.push('independent-action-legality-proof-mismatch');
      }
      if (
        firstSimulation.hashes?.input !== candidate.hashes?.input ||
        firstSimulation.hashes?.trace !== candidate.hashes?.trace ||
        secondSimulation.hashes?.input !== firstSimulation.hashes?.input ||
        secondSimulation.hashes?.trace !== firstSimulation.hashes?.trace
      ) {
        rowIssues.push('independent-simulation-reproduction-mismatch');
      }
      const autonomousKiboActions = (axis.actions ?? []).filter(action => {
        const actionKind = String(
          action?.intent?.actionKind ?? ''
        ).toLowerCase();
        return (
          action?.owner?.kind === 'kibo' ||
          actionKind === 'kibo-normal-attack' ||
          actionKind === 'kibo-active' ||
          actionKind === 'kibo-active-skill'
        );
      });
      if (autonomousKiboActions.length !== 0) {
        rowIssues.push('autonomous-kibo-action-surface-present');
      }
      let proofEvidence;
      if (objective === 'fastest-kill') {
        proofEvidence = verifyKillCandidate({
          candidate,
          service,
          killModule,
          rowIssues,
        });
      } else {
        proofEvidence = verifyCycleCandidate({
          candidate,
          service,
          rowIssues,
        });
      }
      const row = {
        objective,
        rank: indexPosition + 1,
        score: Number(candidate.score),
        rawIdentity: recomputedIdentity,
        sourceConfigIdentity: candidate.m12c?.sourceConfigIdentity ?? null,
        teamIdentity: candidate.m12c?.teamIdentity ?? null,
        buildHash: candidate.m12c?.buildHash ?? null,
        initialFront: candidate.m12c?.initialFront ?? null,
        presetId: axis.scenario?.initialStatePreset?.presetId ?? null,
        presetHash: axis.scenario?.initialStatePreset?.presetHash ?? null,
        actionCount: axis.actions?.length ?? 0,
        axisPath: repositoryRelative(axisPath),
        candidatePath: repositoryRelative(candidatePath),
        inputHash: firstSimulation.hashes?.input ?? null,
        traceHash: firstSimulation.hashes?.trace ?? null,
        legalityProofHash: validation.actionLegalityProof?.proofHash ?? null,
        proofEvidence,
        valid: rowIssues.length === 0,
        issues: rowIssues,
      };
      rows.push(row);
      for (const issue of rowIssues) {
        issues.push(`${objective}:rank-${indexPosition + 1}:${issue}`);
      }
      process.stdout.write(
        `${JSON.stringify({
          event: 'final-candidate-verified',
          objective,
          rank: indexPosition + 1,
          rawIdentityHash: recomputedIdentity.identityHash,
          valid: row.valid,
          issueCount: rowIssues.length,
        })}\n`
      );
    }
    for (const issue of objectiveIssues) issues.push(`${objective}:${issue}`);
    objectives.push({
      objective,
      finalizationHash: finalization.finalizationHash,
      finalizationPath: repositoryRelative(finalizationPath),
      top5IndexPath: repositoryRelative(indexPath),
      topNCount: index.rows?.length ?? 0,
      cutoffScore: finalization.summary?.cutoffScore ?? null,
      cutoffTieCount: finalization.summary?.cutoffTieCount ?? 0,
      valid: objectiveIssues.length === 0,
      issues: objectiveIssues,
    });
  }
  const validRows = rows.filter(row => row.valid);
  return {
    schemaVersion: 1,
    kind: 'azpr-m12c-final-top15-independent-verification',
    runId: path.basename(runDirectory),
    rankingClaim: FORMAL_SEARCH_RANKING_CLAIM,
    formalRankingReady: false,
    clientParityReady: false,
    boundaries: {
      enemyId: 310054,
      enemyLevel: 80,
      enemyProfileHash: 'cb1edcc277fcda5b',
      criticalPolicy: 'expected',
      qualificationMode: 'formal',
      autonomousKiboActionsAdmitted: false,
      semanticEquivalenceClaimed: false,
      globalOptimalityClaimed: false,
      exhaustiveCompletenessClaimed: false,
      clientParityClaimed: false,
    },
    quarantine: {
      quarantineHash: quarantine.quarantineHash,
      quarantinedRawIdentityHashes: [...quarantinedRawIdentityHashes].sort(
        compareText
      ),
      quarantinedIdentitySurvivorCount: rows.filter(row =>
        quarantinedRawIdentityHashes.has(row.rawIdentity.identityHash)
      ).length,
    },
    coverage: {
      objectiveCount: objectives.length,
      expectedCandidateCount: 15,
      verifiedCandidateCount: rows.length,
      validCandidateCount: validRows.length,
      invalidCandidateCount: rows.length - validRows.length,
      distinctRawIdentityCount: new Set(
        rows.map(row => `${row.objective}:${row.rawIdentity.identityHash}`)
      ).size,
    },
    objectives,
    valid: issues.length === 0,
    issues: [...new Set(issues)].sort(compareText),
    rows,
  };
}

function verifyCycleCandidate({ candidate, service, rowIssues }) {
  const loop = candidate.objectiveProof?.loop ?? {};
  const request = {
    schemaVersion: 1,
    contractName: 'AzPrMachineAxisCycleDps',
    kind: 'azpr-machine-axis-cycle-dps',
    contract: candidate.axis,
    loop: {
      startFrame: Number(loop.startFrame),
      endFrame: Number(loop.endFrame),
    },
    options: {
      objective: candidate.axis.scenario.objectiveContract.objectiveId,
      criticalPolicy: 'expected',
    },
  };
  const firstProof = service.evaluateCycle(request);
  const secondProof = service.evaluateCycle(request);
  if (
    firstProof.valid !== true ||
    firstProof.status !== 'closed' ||
    firstProof.actionLegalityProof?.passed !== true ||
    !scoresEqual(Number(firstProof.formalScore), Number(candidate.score)) ||
    !scoresEqual(Number(secondProof.formalScore), Number(candidate.score)) ||
    firstProof.hashes?.cycle !== candidate.objectiveProof?.hashes?.cycle ||
    secondProof.hashes?.cycle !== firstProof.hashes?.cycle
  ) {
    rowIssues.push('independent-closed-cycle-proof-mismatch');
  }
  return {
    kind: 'closed-cycle',
    status: firstProof.status,
    formalScore: firstProof.formalScore,
    cycleProofHash: firstProof.hashes?.cycle ?? null,
    repeatedCycleProofHash: secondProof.hashes?.cycle ?? null,
    loop: firstProof.loop ?? null,
  };
}

function verifyKillCandidate({ candidate, service, killModule, rowIssues }) {
  const actions = candidate.axis?.actions ?? [];
  if (actions.length !== 221) rowIssues.push('kill-action-count-not-221');
  const baseAxis = structuredClone(candidate.axis);
  baseAxis.actions = [];
  baseAxis.scenario.name = String(baseAxis.scenario.name).replace(
    / \[greedy-normal-v1:\d+\]$/,
    ''
  );
  const cadence = deriveGreedyNormalCadence(actions[0], actions[1]);
  const probes = {};
  for (const actionCount of [220, 221, 222]) {
    const axis = synthesizeGreedyNormalAxis({ baseAxis, cadence, actionCount });
    const simulation = service.simulate(axis);
    const repeat = service.simulate(axis);
    const proof = killModule.createFastestKillProof(simulation, axis, {
      objectiveContract: axis.scenario.objectiveContract,
    });
    const repeatedProof = killModule.createFastestKillProof(repeat, axis, {
      objectiveContract: axis.scenario.objectiveContract,
    });
    const classification = classifyGreedyKillProbe({ proof });
    if (
      simulation.hashes?.input !== repeat.hashes?.input ||
      simulation.hashes?.trace !== repeat.hashes?.trace ||
      proof.hashes?.kill !== repeatedProof.hashes?.kill
    ) {
      rowIssues.push(`kill-${actionCount}-determinism-mismatch`);
    }
    probes[actionCount] = {
      classification,
      enemyHp: simulation.trace?.state?.final?.enemy?.hp ?? null,
      inputHash: simulation.hashes?.input ?? null,
      traceHash: simulation.hashes?.trace ?? null,
      killProofHash: proof.hashes?.kill ?? null,
      proofStatus: proof.status,
      proofFormalScore: proof.formalScore,
      firstLethal: proof.killProof?.firstLethal ?? null,
    };
  }
  if (
    probes[220].classification.status !== 'valid-not-killed' ||
    Number(probes[220].enemyHp) !== 2807.551112 ||
    probes[220].proofFormalScore !== null
  ) {
    rowIssues.push('kill-220-prefix-boundary-invalid');
  }
  if (
    probes[221].classification.status !== 'killed-valid' ||
    Number(probes[221].proofFormalScore) !== 66133.333333 ||
    Number(probes[221].firstLethal?.frame) !== 3968 ||
    Number(probes[221].firstLethal?.timeMs) !== 66133.333333 ||
    probes[221].killProofHash !== candidate.objectiveProof?.hashes?.kill
  ) {
    rowIssues.push('kill-221-proof-boundary-invalid');
  }
  if (
    probes[222].classification.status !== 'invalid-upper-bound' ||
    !probes[222].classification.issueCodes.includes(
      'machine-axis-action-target-dead'
    )
  ) {
    rowIssues.push('kill-222-target-dead-fail-closed-missing');
  }
  return {
    kind: 'fastest-kill-boundary',
    cadenceHash: cadence.cadenceHash,
    probes,
  };
}

function scoresEqual(left, right) {
  return Object.is(left, right) || Math.abs(left - right) <= 1e-10;
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

function compareText(left, right) {
  return String(left).localeCompare(String(right), 'en');
}
