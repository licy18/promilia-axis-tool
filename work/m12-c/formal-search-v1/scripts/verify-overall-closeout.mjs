import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FORMAL_SEARCH_RANKING_CLAIM,
  analyzeFinalCandidateInitialState,
  loadRepositoryNormalAttackInputAuthorityDescriptor,
  matchesNormalAttackInputAuthorityDescriptor,
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
const normalAttackInputAuthority =
  await loadRepositoryNormalAttackInputAuthorityDescriptor({
    repositoryRoot: projectRoot,
  });
const runArgument = readArgument('--run-directory');
if (!runArgument) {
  throw new Error(
    'Usage: node verify-overall-closeout.mjs --run-directory <path>'
  );
}
const runDirectory = resolveRepositoryPath(runArgument);
const objectiveIds = [
  'cycle-dps-no-toughness',
  'cycle-dps-with-toughness',
  'fastest-kill',
];
const issues = [];

const [independent, visualReview, quarantine, replacement] = await Promise.all([
  readRunJson('final-verification/independent-top15-verification.json'),
  readRunJson('product-review/workbench-top15-visual-signoff.json'),
  readRunJson('final-verification/preset-admission-quarantine.json'),
  readRunJson('final-verification/preset-quarantine-replacement-evidence.json'),
]);

validateBoundary(independent, 'independent-verification');
validateBoundary(visualReview, 'visual-review', { nestedSummary: true });
validateBoundary(quarantine, 'preset-quarantine');
validateBoundary(replacement, 'preset-replacement');
expect(independent.valid === true, 'independent-verification-invalid');
expect(independent.issues?.length === 0, 'independent-verification-has-issues');
expect(
  independent.coverage?.expectedCandidateCount === 15 &&
    independent.coverage?.validCandidateCount === 15 &&
    independent.coverage?.distinctRawIdentityCount === 15,
  'independent-verification-coverage-mismatch'
);
expect(visualReview.summary?.valid === true, 'visual-review-invalid');
for (const [field, expected] of Object.entries({
  candidateCount: 15,
  importActiveCount: 15,
  traceIdentityMatchCount: 15,
  individualScreenshotCount: 15,
  objectiveImportEvidenceCount: 3,
  manualAcceptedCount: 15,
})) {
  expect(
    visualReview.summary?.[field] === expected,
    `visual-review-${field}-mismatch`
  );
}
expect(quarantine.valid === true, 'preset-quarantine-invalid');
expect(replacement.valid === true, 'preset-replacement-invalid');

const screenshotChecks = [];
for (const candidate of visualReview.candidates ?? []) {
  screenshotChecks.push(
    await verifyScreenshot(
      candidate.screenshotPath,
      candidate.screenshotSha256,
      `${candidate.objective}:rank-${candidate.rank}`
    )
  );
}
for (const [objective, evidence] of Object.entries(
  visualReview.objectiveImportEvidence ?? {}
)) {
  screenshotChecks.push(
    await verifyScreenshot(
      evidence.path,
      evidence.sha256,
      `${objective}:dialog`
    )
  );
}

const objectiveReports = [];
const presetRows = [];
let formallyQualifiedCandidateCount = 0;

for (const objective of objectiveIds) {
  const latest = await readRunJson(
    `objectives/${objective}/latest-finalization.json`
  );
  const finalization = await readJson(
    resolveRepositoryPath(latest.objectiveFinalizationPath)
  );
  const terminal = await readRunJson(
    `objectives/${objective}/terminal-bounded-evidence.json`
  );
  const coveragePath = path.join(
    runDirectory,
    'objectives',
    objective,
    'effective-coverage-evidence.json'
  );
  const effectiveCoverage = await readOptionalJson(coveragePath);
  validateBoundary(finalization, `${objective}:finalization`, {
    clientParityRequired: false,
  });
  validateBoundary(terminal, `${objective}:terminal`);
  if (effectiveCoverage) {
    validateBoundary(effectiveCoverage, `${objective}:effective-coverage`);
  }
  expect(latest.valid === true, `${objective}:latest-pointer-invalid`);
  expect(
    matchesNormalAttackInputAuthorityDescriptor(
      latest.normalAttackInputAuthority,
      normalAttackInputAuthority
    ),
    `${objective}:latest-pointer-normal-attack-input-authority-mismatch`
  );
  expect(
    matchesNormalAttackInputAuthorityDescriptor(
      finalization.normalAttackInputAuthority,
      normalAttackInputAuthority
    ),
    `${objective}:finalization-normal-attack-input-authority-mismatch`
  );
  expect(
    finalization.validity?.valid === true,
    `${objective}:finalization-invalid`
  );
  expect(
    finalization.summary?.topNReady === true,
    `${objective}:top5-not-ready`
  );
  expect(terminal.valid === true, `${objective}:terminal-invalid`);
  expect(terminal.issues?.length === 0, `${objective}:terminal-has-issues`);
  if (effectiveCoverage) {
    expect(
      effectiveCoverage.valid === true,
      `${objective}:effective-coverage-invalid`
    );
  }

  const results = finalization.results ?? [];
  const independentRows = (independent.rows ?? []).filter(
    row => row.objective === objective
  );
  expect(results.length === 5, `${objective}:top5-count-mismatch`);
  expect(
    independentRows.length === 5,
    `${objective}:independent-row-count-mismatch`
  );
  const identities = results.map(result => result.rawIdentity?.identityHash);
  expect(
    identities.every(Boolean) && new Set(identities).size === 5,
    `${objective}:raw-identity-distinctness-mismatch`
  );

  const compactResults = [];
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    const rank = index + 1;
    const validation = validateFinalCandidate(
      result,
      objective,
      normalAttackInputAuthority
    );
    const initialState = analyzeFinalCandidateInitialState(result, objective);
    const independentRow = independentRows.find(row => row.rank === rank);
    expect(
      validation.valid === true,
      `${objective}:rank-${rank}:strict-invalid`
    );
    for (const issue of validation.issues) {
      issues.push(`${objective}:rank-${rank}:${issue}`);
    }
    expect(
      independentRow?.valid === true &&
        independentRow?.rawIdentity?.identityHash ===
          result.rawIdentity?.identityHash,
      `${objective}:rank-${rank}:independent-binding-mismatch`
    );
    if (validation.valid) formallyQualifiedCandidateCount += 1;
    presetRows.push({
      objective,
      rank,
      rawIdentity: result.rawIdentity?.identityHash ?? null,
      valid: initialState.valid,
      expectedPresetId: initialState.expectedPresetId,
      expectedPresetHash: initialState.expectedPresetHash,
      actualPresetHash: initialState.actualPresetHash,
      objectiveScope: initialState.expectedObjectiveScope,
      actorSp: initialState.expectedActorSp,
      kiboSp: initialState.expectedKiboSp,
      tuningMarkCount:
        result.axis?.scenario?.initialRuntimeState?.tuningMarks?.length ?? null,
      specialResources: initialState.actualSpecialResources,
      issues: initialState.issues,
    });
    compactResults.push({
      rank,
      score: result.score,
      rawIdentity: result.rawIdentity?.identityHash ?? null,
      buildHash: result.rawIdentity?.buildHash ?? null,
      sourceConfigIdentity: result.sourceConfigIdentity ?? null,
      initialFront: result.rawIdentity?.initialFront ?? null,
    });
  }

  objectiveReports.push({
    objective,
    metric: objective === 'fastest-kill' ? 'first-lethal-time-ms' : 'hp-dps',
    direction: objective === 'fastest-kill' ? 'minimize' : 'maximize',
    finalizationHash: latest.finalizationHash,
    terminalStabilityHash: terminal.terminalStabilityHash,
    effectiveCoverageHash:
      effectiveCoverage?.effectiveCoverageHash ??
      terminal.effectiveCoverage?.effectiveCoverageHash ??
      null,
    top5Ready: finalization.summary?.topNReady === true,
    exploredValidDistinctCandidateCount:
      finalization.summary?.exploredValidDistinctCandidateCount ?? 0,
    invalidCandidateCount: finalization.summary?.invalidCandidateCount ?? 0,
    top5FamilyCount: finalization.summary?.topNFamilyCount ?? 0,
    cutoffScore: finalization.summary?.cutoffScore ?? null,
    cutoffTieCount: finalization.summary?.cutoffTieCount ?? 0,
    coverage: {
      roundCount: finalization.coverage?.roundCount ?? 0,
      completedShardCount: finalization.coverage?.completedShardCount ?? 0,
      failedShardCount: finalization.coverage?.failedShardCount ?? 0,
      missingShardCount: finalization.coverage?.missingShardCount ?? 0,
      effectiveSourceConfigCount:
        effectiveCoverage?.coverage?.effectiveCompletedSourceConfigCount ??
        terminal.effectiveCoverage?.effectiveSourceConfigCount ??
        terminal.coverageRound?.completedShardCount ??
        null,
      expectedSourceConfigCount:
        effectiveCoverage?.coverage?.expectedSourceConfigCount ??
        terminal.effectiveCoverage?.expectedSourceConfigCount ??
        terminal.coverageRound?.expectedShardCount ??
        null,
    },
    budgetUsage: finalization.budgetUsage,
    terminalRounds: terminal.terminalRounds,
    results: compactResults,
  });
}

const cyclePresetHashes = uniqueSorted(
  presetRows
    .filter(row => row.objective !== 'fastest-kill')
    .map(row => row.actualPresetHash)
);
const killPresetHashes = uniqueSorted(
  presetRows
    .filter(row => row.objective === 'fastest-kill')
    .map(row => row.actualPresetHash)
);
expect(
  presetRows.length === 15 && presetRows.every(row => row.valid),
  'preset-admission-top15-invalid'
);
expect(
  presetRows
    .filter(row => row.objective !== 'fastest-kill')
    .every(row => row.actualPresetHash === row.expectedPresetHash),
  'cycle-preset-hash-not-canonical'
);
expect(
  presetRows
    .filter(row => row.objective === 'fastest-kill')
    .every(row => row.actualPresetHash === row.expectedPresetHash),
  'kill-preset-hash-not-canonical'
);

const report = {
  schemaVersion: 1,
  kind: 'azpr-m12c-formal-search-overall-closeout',
  runId: independent.runId,
  valid: issues.length === 0,
  rankingClaim: FORMAL_SEARCH_RANKING_CLAIM,
  formalRankingReady: false,
  normalAttackInputAuthority,
  clientParityReady: false,
  optimizationFormalScoreReady: formallyQualifiedCandidateCount === 15,
  boundaries: {
    globalOptimalityClaimed: false,
    exhaustiveEnumerationClaimed: false,
    clientParityClaimed: false,
    boundedStopIsOptimalityProof: false,
    runtimeBaselineFormalScoringOnly: true,
  },
  verification: {
    finalCandidateCount: presetRows.length,
    formallyQualifiedCandidateCount,
    independentVerificationHash: independent.verificationHash,
    independentValidCandidateCount:
      independent.coverage?.validCandidateCount ?? 0,
    visualImportActiveCount: visualReview.summary?.importActiveCount ?? 0,
    visualTraceIdentityMatchCount:
      visualReview.summary?.traceIdentityMatchCount ?? 0,
    visualManualAcceptedCount: visualReview.summary?.manualAcceptedCount ?? 0,
    visualObjectiveEvidenceCount:
      visualReview.summary?.objectiveImportEvidenceCount ?? 0,
    screenshotHashCheckCount: screenshotChecks.length,
    screenshotHashValidCount: screenshotChecks.filter(check => check.valid)
      .length,
  },
  presetAdmission: {
    validCandidateCount: presetRows.filter(row => row.valid).length,
    coldCycleCandidateCount: presetRows.filter(
      row => row.objective !== 'fastest-kill'
    ).length,
    fastestKillCandidateCount: presetRows.filter(
      row => row.objective === 'fastest-kill'
    ).length,
    coldCycleCanonicalPresetHashes: cyclePresetHashes,
    fastestKillCanonicalPresetHashes: killPresetHashes,
    fastestKillWhitelist: {
      actorSp: 100,
      kiboSp: 100,
      tuningMarks: [],
      onlyConditionalSpecialResource:
        'actor:103002:element:103002047@current=12,max=12',
      otherPersistentCombatResourcesAllowed: false,
    },
    rows: presetRows,
  },
  quarantine: {
    valid: quarantine.valid,
    quarantineHash: quarantine.quarantineHash,
    affectedRawIdentityCount: quarantine.summary?.affectedRawIdentityCount ?? 0,
    quarantinedOccurrenceCount:
      quarantine.summary?.quarantinedOccurrenceCount ?? 0,
    replacementValid: replacement.valid,
    presetRepairHash: replacement.presetRepairHash,
  },
  objectives: objectiveReports,
  visualEvidence: visualReview.objectiveImportEvidence,
  issues,
};
const closeoutHash = sha256Canonical(report);
const output = { ...report, closeoutHash };
const outputPath = path.join(
  runDirectory,
  'final-verification',
  'overall-closeout.json'
);
await writeJsonAtomic(outputPath, output);
await writeTextAtomic(
  path.join(runDirectory, 'final-verification', 'OVERALL_CLOSEOUT.md'),
  renderMarkdown(output)
);

process.stdout.write(
  `${JSON.stringify({
    valid: output.valid,
    issueCount: output.issues.length,
    closeoutHash,
    finalCandidateCount: output.verification.finalCandidateCount,
    screenshotHashValidCount: output.verification.screenshotHashValidCount,
    output: repositoryRelative(outputPath),
  })}\n`
);
if (!output.valid) process.exitCode = 1;

function validateBoundary(
  value,
  label,
  { nestedSummary = false, clientParityRequired = true } = {}
) {
  expect(value?.rankingClaim === FORMAL_SEARCH_RANKING_CLAIM, `${label}:claim`);
  expect(
    value?.formalRankingReady === false,
    `${label}:formal-ranking-boundary`
  );
  if (clientParityRequired || value?.clientParityReady != null) {
    expect(
      value?.clientParityReady === false,
      `${label}:client-parity-boundary`
    );
  }
  if (nestedSummary) {
    expect(value?.summary?.issues?.length === 0, `${label}:summary-issues`);
  }
}

async function verifyScreenshot(relativePath, expectedHash, label) {
  const absolutePath = path.resolve(runDirectory, relativePath ?? '');
  let actualHash = null;
  try {
    actualHash = crypto
      .createHash('sha256')
      .update(await fs.readFile(absolutePath))
      .digest('hex');
  } catch {
    issues.push(`${label}:screenshot-missing`);
  }
  const valid = Boolean(expectedHash) && actualHash === expectedHash;
  if (!valid && actualHash) issues.push(`${label}:screenshot-hash-mismatch`);
  return {
    label,
    path: repositoryRelative(absolutePath),
    expectedHash: expectedHash ?? null,
    actualHash,
    valid,
  };
}

function renderMarkdown(value) {
  const sections = [
    '# M12-C 末音 AI Top-5 Overall Closeout',
    '',
    `- 状态：${value.valid ? 'VALID' : 'INVALID'}`,
    `- 排名声明：${value.rankingClaim}`,
    `- optimization formal-score：${value.optimizationFormalScoreReady}`,
    `- formalRankingReady：${value.formalRankingReady}`,
    `- clientParityReady：${value.clientParityReady}`,
    `- closeoutHash：\`${value.closeoutHash}\``,
    '',
    '本报告只确认 runtime-baseline 下的 bounded heuristic Top-5 与正式评分资格；不宣称全局最优、穷举完整或客户端一致。',
  ];
  for (const objective of value.objectives) {
    sections.push(
      '',
      `## ${objective.objective}`,
      '',
      '| Rank | Score | Raw identity | Build | Source family |',
      '| ---: | ---: | --- | --- | --- |'
    );
    for (const result of objective.results) {
      sections.push(
        `| ${result.rank} | ${result.score} | \`${result.rawIdentity}\` | \`${result.buildHash}\` | \`${result.sourceConfigIdentity}\` |`
      );
    }
  }
  sections.push(
    '',
    '## 验证摘要',
    '',
    `- 独立候选复验：${value.verification.independentValidCandidateCount}/15`,
    `- Workbench 实际导入 / trace 匹配 / 人工签收：${value.verification.visualImportActiveCount}/15 / ${value.verification.visualTraceIdentityMatchCount}/15 / ${value.verification.visualManualAcceptedCount}/15`,
    `- 截图 hash：${value.verification.screenshotHashValidCount}/${value.verification.screenshotHashCheckCount}`,
    `- 冷启动 cycle canonical preset hash：\`${value.presetAdmission.coldCycleCanonicalPresetHashes.join(', ')}\``,
    `- fastest-kill canonical preset hash：\`${value.presetAdmission.fastestKillCanonicalPresetHashes.join(', ')}\``,
    ''
  );
  return `${sections.join('\n').trimEnd()}\n`;
}

function expect(condition, issue) {
  if (!condition) issues.push(issue);
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort(compareText);
}

function compareText(left, right) {
  return String(left).localeCompare(String(right), 'en');
}

async function readRunJson(relativePath) {
  return readJson(path.join(runDirectory, relativePath));
}

async function readOptionalJson(filePath) {
  try {
    return await readJson(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeTextAtomic(filePath, text) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  await fs.writeFile(temporaryPath, text, 'utf8');
  await fs.rename(temporaryPath, filePath);
}

function resolveRepositoryPath(value) {
  return path.isAbsolute(value) ? value : path.resolve(projectRoot, value);
}

function repositoryRelative(value) {
  return path.relative(projectRoot, value).split(path.sep).join('/');
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}
