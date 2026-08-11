import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GATE_DEFINITIONS,
  RELEASE_EXTRA_GATE_NAMES,
  TRIAL_RELEASE_COMPONENTS,
  getGateDefinition,
  validateGateDefinitions,
} from './gates/gate-definitions.mjs';
import {
  computeAllGateFingerprints,
  createRepositorySnapshot,
  readGitState,
} from './gates/gate-fingerprint.mjs';
import {
  appendLedgerRecord,
  beginGateRun,
  completeGateRun,
  recoverInterruptedRuns,
} from './gates/gate-ledger.mjs';
import { runGate } from './gates/gate-runner.mjs';
import {
  evaluateFormalSearchAdmission,
  loadFormalSearchAdmissionEvidence,
} from './gates/formal-search-admission.mjs';
import {
  PRODUCTION_PREVIEW_REPORT_PATH,
  restoreReleaseRunnerOutputs,
  snapshotReleaseRunnerOutputs,
} from './gates/release-runner-output.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultRepositoryRoot = path.resolve(scriptDirectory, '..');

const TRIAL_SCRIPT_REQUIRED_FRAGMENTS = Object.freeze([
  'npm run test -- --run',
  'npm run audit:production-imports:check',
  'npm run audit:workbench-data:check',
  'npm run audit:action-status:check',
  'npm run audit:verified-combat',
  'npm run audit:optimization-scenario-policy',
  'npm run audit:character-acceptance',
  'npm run audit:optimization-qualification',
  'npm run audit:bundle:check',
  'npm run test:e2e:production-preview',
  'git diff --check',
]);
const TRIAL_OBSERVED_SCRIPTS = Object.freeze([
  'test:trial-release',
  'test',
  'audit:production-imports:check',
  'audit:workbench-data:check',
  'audit:action-status:check',
  'audit:verified-combat',
  'audit:optimization-scenario-policy',
  'audit:character-acceptance',
  'audit:optimization-qualification',
  'audit:bundle:check',
  'test:e2e:production-preview',
  'audit:applied-source-bindings:check',
  'build',
]);

export async function runReleaseVerification({
  repositoryRoot = defaultRepositoryRoot,
  args = process.argv.slice(2),
  stdout = process.stdout,
  gateRunner = runGate,
  evidenceLoader = loadFormalSearchAdmissionEvidence,
} = {}) {
  const options = parseReleaseArguments(args);
  if (options.help) {
    stdout.write(`${releaseHelpText()}\n`);
    return { status: 'help', exitCode: 0 };
  }
  const root = path.resolve(repositoryRoot);
  const definitionIntegrity = validateGateDefinitions();
  if (!definitionIntegrity.valid) {
    throw new Error(
      `Gate definition integrity failed: ${definitionIntegrity.issues.join(', ')}`
    );
  }
  const packageJson = JSON.parse(
    await readFile(path.join(root, 'package.json'), 'utf8')
  );
  const scriptIntegrity = validateReleaseScriptIntegrity(
    packageJson.scripts ?? {}
  );
  if (!scriptIntegrity.valid) {
    throw new Error(
      `Release script integrity failed: ${scriptIntegrity.issues.join(', ')}`
    );
  }
  const preflight = await readGitState({ repositoryRoot: root });
  printPreflight(stdout, preflight);
  if (!preflight.trackedClean) {
    const report = createPreflightFailureReport(preflight, scriptIntegrity);
    await writeJsonReport(
      options.jsonPath ?? defaultReleaseReport(root),
      report
    );
    stdout.write('\nRelease verify: BLOCKED (tracked working tree is dirty)\n');
    return { status: 'fail', exitCode: 1, failureStage: 'preflight', report };
  }
  await recoverInterruptedRuns({ repositoryRoot: root });
  const snapshot = await createRepositorySnapshot({
    repositoryRoot: root,
    definitions: GATE_DEFINITIONS,
  });
  const fingerprints = computeAllGateFingerprints({
    inventory: snapshot.inventory,
    authority: snapshot.authority,
  });
  const releaseDefinition = getGateDefinition('release-verify');
  const releasePending = await beginGateRun({
    repositoryRoot: root,
    gate: 'release-verify',
    head: snapshot.head,
    workingTreeFingerprint: snapshot.workingTreeFingerprint,
    dependencyFingerprint:
      fingerprints.get('release-verify').dependencyFingerprint,
    gateDefinitionVersion: releaseDefinition.version,
    command: 'npm run release:verify',
    context: 'final-release-authority-uncached',
  });
  let stages;
  try {
    stages = await executeMandatoryReleaseStages({
      extraGateNames: RELEASE_EXTRA_GATE_NAMES,
      runExtraGate: async gateName => {
        const definition = getGateDefinition(gateName);
        stdout.write(`\nRelease stage: ${gateName}\n`);
        return gateRunner({
          repositoryRoot: root,
          definition,
          fingerprint: fingerprints.get(gateName),
          snapshot,
          context: 'release-extra-formal-gate',
          tee: true,
          logDirectory: path.join(root, 'work', 'm12-c', 'gates', 'logs'),
        });
      },
      runTrialRelease: async () => {
        stdout.write(
          '\nRelease stage: test:trial-release (real execution; cache ignored)\n'
        );
        const runnerOutputSnapshot = await snapshotReleaseRunnerOutputs({
          repositoryRoot: root,
        });
        let trialResult;
        let restoration;
        try {
          trialResult = await gateRunner({
            repositoryRoot: root,
            definition: getGateDefinition('trial-release'),
            fingerprint: fingerprints.get('trial-release'),
            snapshot,
            context: 'release-trial-release-uncached',
            tee: true,
            logDirectory: path.join(root, 'work', 'm12-c', 'gates', 'logs'),
          });
        } finally {
          restoration = await restoreReleaseRunnerOutputs({
            repositoryRoot: root,
            snapshot: runnerOutputSnapshot,
          });
        }
        const capturedText =
          restoration.capturedTextByPath[PRODUCTION_PREVIEW_REPORT_PATH] ??
          null;
        const observedProductionPreview = capturedText
          ? parseCapturedRunnerJson(
              capturedText,
              PRODUCTION_PREVIEW_REPORT_PATH
            )
          : null;
        const restorationSummary = { ...restoration };
        delete restorationSummary.capturedTextByPath;
        return {
          ...trialResult,
          runnerOutputRestoration: restorationSummary,
          observedRunnerReports: {
            productionPreview: observedProductionPreview,
          },
        };
      },
      validateTrialRelease: trialResult =>
        validateTrialReleaseExecution({
          packageScript: packageJson.scripts['test:trial-release'],
          trialResult,
        }),
      readPostflight: () => readGitState({ repositoryRoot: root }),
      validatePostflight: postflight =>
        validateReleasePostflight({ preflight, postflight }),
      loadAdmission: async trialResult => {
        const deterministicDefinition = getGateDefinition('determinism');
        const releaseProof = {
          gate: 'release-verify',
          status: 'pass',
          mode: 'executed',
          exitCode: 0,
          head: snapshot.head,
        };
        const deterministicProof = {
          gate: 'determinism',
          status: 'pass',
          mode: 'executed',
          executionContext: 'test:trial-release/test-full',
          coverage: deterministicDefinition.formalCoverage,
          summary: trialResult.summary?.testFull ?? null,
        };
        const evidence = await evidenceLoader({
          repositoryRoot: root,
          releaseProof,
          deterministicProof,
        });
        return evaluateFormalSearchAdmission(evidence);
      },
    });
    if (stages.status !== 'pass') {
      const failureStatus = normalizeRecordFailureStatus(stages.result?.status);
      const record = await completeGateRun({
        repositoryRoot: root,
        pending: releasePending,
        status: failureStatus,
        exitCode: stages.result?.exitCode ?? 1,
        summary: {
          failureStage: stages.failureStage,
          completedStages: stages.completedStages,
        },
        stdoutComplete: stages.result?.stdoutComplete ?? true,
        reportParseStatus: 'invalid',
        details: {
          failure: stages.failure ?? null,
          runnerOutputRestoration:
            stages.trialResult?.runnerOutputRestoration ?? null,
        },
      });
      const report = createReleaseFailureReport({
        snapshot,
        preflight,
        stages,
        releaseRecord: record,
        scriptIntegrity,
      });
      await writeJsonReport(
        options.jsonPath ?? defaultReleaseReport(root),
        report
      );
      printReleaseFailure(stdout, report);
      return {
        status: 'fail',
        exitCode: stages.result?.exitCode ?? 1,
        failureStage: stages.failureStage,
        report,
      };
    }

    const runtimeReports = await loadReleaseRuntimeReports(
      root,
      stages.trialResult.observedRunnerReports
    );
    await recordTrialReleaseComponents({
      repositoryRoot: root,
      snapshot,
      fingerprints,
      trialResult: stages.trialResult,
      runtimeReports,
    });
    const admissionRecord = await appendLedgerRecord({
      repositoryRoot: root,
      record: {
        gate: 'formal-search-admission',
        status: stages.admission.ready ? 'pass' : 'fail',
        mode: 'executed',
        head: snapshot.head,
        workingTreeFingerprint: snapshot.workingTreeFingerprint,
        dependencyFingerprint: fingerprints.get('formal-search-admission')
          .dependencyFingerprint,
        gateDefinitionVersion: getGateDefinition('formal-search-admission')
          .version,
        command:
          'formal-search-admission (derived from executed release contracts)',
        context: 'release-formal-search-admission',
        startedAt: stages.trialResult.record.finishedAt,
        finishedAt: new Date().toISOString(),
        durationMs: 0,
        exitCode: stages.admission.ready ? 0 : 1,
        stdoutComplete: true,
        reportParseStatus: 'complete',
        summary: stages.admission,
      },
    });
    const summary = buildReleaseSummary({
      snapshot,
      stages,
      runtimeReports,
      admissionRecord,
    });
    const releaseRecord = await completeGateRun({
      repositoryRoot: root,
      pending: releasePending,
      status: 'pass',
      exitCode: 0,
      summary,
      stdoutComplete: true,
      reportParseStatus: 'complete',
      details: {
        uncachedTrialRelease: true,
        extraFormalGates: RELEASE_EXTRA_GATE_NAMES,
        runnerOutputRestoration:
          stages.trialResult.runnerOutputRestoration ?? null,
      },
    });
    const report = {
      schemaVersion: 1,
      kind: 'azpr-release-verify-report',
      createdAt: new Date().toISOString(),
      status: 'pass',
      mode: 'executed',
      head: snapshot.head,
      parent: snapshot.parent,
      dependencyFingerprint:
        fingerprints.get('release-verify').dependencyFingerprint,
      preflight,
      postflight: stages.postflight,
      scriptIntegrity,
      completedStages: stages.completedStages,
      releaseRecordId: releaseRecord.recordId,
      summary,
    };
    await writeJsonReport(
      options.jsonPath ?? defaultReleaseReport(root),
      report
    );
    printReleaseSuccess(stdout, report);
    return { status: 'pass', exitCode: 0, report, releaseRecord };
  } catch (error) {
    const record = await completeGateRun({
      repositoryRoot: root,
      pending: releasePending,
      status: 'interrupted',
      exitCode: null,
      summary: { failureStage: stages?.failureStage ?? 'orchestration' },
      stdoutComplete: false,
      reportParseStatus: 'invalid',
      details: {
        error: {
          name: error?.name ?? 'Error',
          message: error?.message ?? String(error),
          code: error?.code ?? null,
        },
      },
    });
    const report = {
      schemaVersion: 1,
      kind: 'azpr-release-verify-report',
      createdAt: new Date().toISOString(),
      status: 'interrupted',
      mode: 'executed',
      head: snapshot.head,
      parent: snapshot.parent,
      failureStage: stages?.failureStage ?? 'orchestration',
      releaseRecordId: record.recordId,
      error: {
        name: error?.name ?? 'Error',
        message: error?.message ?? String(error),
        code: error?.code ?? null,
      },
    };
    await writeJsonReport(
      options.jsonPath ?? defaultReleaseReport(root),
      report
    );
    return { status: 'fail', exitCode: 1, report, error };
  }
}

export async function executeMandatoryReleaseStages({
  extraGateNames,
  runExtraGate,
  runTrialRelease,
  validateTrialRelease,
  readPostflight,
  validatePostflight,
  loadAdmission,
}) {
  const completedStages = [];
  const extraResults = [];
  for (const gateName of extraGateNames) {
    const result = await runExtraGate(gateName);
    extraResults.push(result);
    if (result.status !== 'pass') {
      return {
        status: 'fail',
        failureStage: gateName,
        result,
        completedStages,
        extraResults,
      };
    }
    completedStages.push(gateName);
  }
  const trialResult = await runTrialRelease();
  if (trialResult.record?.mode !== 'executed') {
    return {
      status: 'fail',
      failureStage: 'trial-release-cache-rejected',
      result: { ...trialResult, status: 'fail', exitCode: 1 },
      failure: { valid: false, issues: ['trial-release-must-be-executed'] },
      completedStages,
      extraResults,
      trialResult,
    };
  }
  if (trialResult.status !== 'pass') {
    return {
      status: 'fail',
      failureStage:
        trialResult.summary?.stageTimeline?.at(-1)?.script ??
        'test:trial-release',
      result: trialResult,
      completedStages,
      extraResults,
      trialResult,
    };
  }
  const trialValidation = validateTrialRelease(trialResult);
  if (!trialValidation.valid) {
    return {
      status: 'fail',
      failureStage: 'trial-release-output-integrity',
      result: { ...trialResult, status: 'fail', exitCode: 1 },
      failure: trialValidation,
      completedStages,
      extraResults,
      trialResult,
    };
  }
  completedStages.push('test:trial-release');
  const postflight = await readPostflight();
  const postflightValidation = validatePostflight(postflight);
  if (!postflightValidation.valid) {
    return {
      status: 'fail',
      failureStage: 'postflight',
      result: { status: 'fail', exitCode: 1, stdoutComplete: true },
      failure: postflightValidation,
      completedStages,
      extraResults,
      trialResult,
      postflight,
    };
  }
  completedStages.push('postflight');
  const admission = await loadAdmission(trialResult);
  completedStages.push('formal-search-admission');
  return {
    status: 'pass',
    completedStages,
    extraResults,
    trialResult,
    trialValidation,
    postflight,
    postflightValidation,
    admission,
  };
}

export function validateReleaseScriptIntegrity(scripts) {
  const issues = [];
  if (scripts['test:full'] !== 'vitest run') {
    issues.push('test:full-original-command-changed');
  }
  const trial = scripts['test:trial-release'];
  if (typeof trial !== 'string') issues.push('test:trial-release-missing');
  else {
    for (const fragment of TRIAL_SCRIPT_REQUIRED_FRAGMENTS) {
      if (!trial.includes(fragment))
        issues.push(`trial-release-fragment-missing:${fragment}`);
    }
  }
  return { valid: issues.length === 0, issues };
}

export function validateTrialReleaseExecution({ packageScript, trialResult }) {
  const issues = [];
  for (const fragment of TRIAL_SCRIPT_REQUIRED_FRAGMENTS) {
    if (!packageScript.includes(fragment)) {
      issues.push(`package-script-fragment-missing:${fragment}`);
    }
  }
  const observed = trialResult.summary?.observedScripts ?? [];
  for (const script of TRIAL_OBSERVED_SCRIPTS) {
    if (!observed.includes(script))
      issues.push(`stdout-stage-missing:${script}`);
  }
  if (trialResult.status !== 'pass' || trialResult.exitCode !== 0) {
    issues.push('trial-release-nonzero');
  }
  if (trialResult.stdoutComplete !== true)
    issues.push('trial-release-stdout-incomplete');
  return { valid: issues.length === 0, issues, observedScripts: observed };
}

export function validateReleasePostflight({ preflight, postflight }) {
  const issues = [];
  if (postflight.head !== preflight.head)
    issues.push('head-changed-during-release');
  if (!postflight.trackedClean) {
    issues.push(`tracked-drift:${postflight.trackedDirtyFiles.join(',')}`);
  }
  if (postflight.stashTop !== preflight.stashTop)
    issues.push('stash-top-changed');
  return { valid: issues.length === 0, issues };
}

async function recordTrialReleaseComponents({
  repositoryRoot,
  snapshot,
  fingerprints,
  trialResult,
  runtimeReports,
}) {
  for (const component of TRIAL_RELEASE_COMPONENTS) {
    const definition = getGateDefinition(component.gate);
    const summary = componentSummary(
      component.gate,
      trialResult,
      runtimeReports
    );
    await appendLedgerRecord({
      repositoryRoot,
      record: {
        gate: component.gate,
        status: 'pass',
        mode: 'executed',
        head: snapshot.head,
        workingTreeFingerprint: snapshot.workingTreeFingerprint,
        dependencyFingerprint: fingerprints.get(component.gate)
          .dependencyFingerprint,
        gateDefinitionVersion: definition.version,
        command: component.command,
        context: 'executed-within-test:trial-release',
        startedAt: trialResult.record.startedAt,
        finishedAt: trialResult.record.finishedAt,
        durationMs: trialResult.durationMs,
        exitCode: 0,
        stdoutComplete: true,
        reportParseStatus: summary == null ? 'unavailable' : 'complete',
        summary:
          component.gate === 'determinism'
            ? {
                testFull: trialResult.summary?.testFull ?? null,
                coverage: definition.formalCoverage,
                executionContext: 'test:trial-release/test-full',
              }
            : summary,
        details: {
          parentGate: 'trial-release',
          parentRecordId: trialResult.record.recordId,
        },
      },
    });
  }
}

function componentSummary(gate, trialResult, reports) {
  if (gate === 'test-full') return trialResult.summary?.testFull ?? null;
  if (gate === 'production-preview') {
    return (
      trialResult.summary?.productionPreview ??
      reports.productionPreview?.summary ??
      null
    );
  }
  if (gate === 'production-build') {
    return trialResult.summary?.productionBuild ?? null;
  }
  if (gate === 'production-imports')
    return reports.productionImports?.summary ?? null;
  if (gate === 'workbench-data') return reports.workbenchData?.summary ?? null;
  if (gate === 'bundle') {
    return reports.bundle
      ? {
          budgetStatus: reports.bundle.budgetStatus,
          projectionGuard: reports.bundle.projectionGuard,
          summary: reports.bundle.summary,
        }
      : null;
  }
  if (gate === 'qualification') return reports.qualification ?? null;
  if (gate === 'determinism') return trialResult.summary?.testFull ?? null;
  return null;
}

function buildReleaseSummary({
  snapshot,
  stages,
  runtimeReports,
  admissionRecord,
}) {
  return {
    smartCacheAuthority: snapshot.authority,
    uncachedTrialRelease: true,
    testFull: stages.trialResult.summary?.testFull ?? null,
    productionPreview:
      stages.trialResult.summary?.productionPreview ??
      runtimeReports.productionPreview?.summary ??
      null,
    productionBuild: stages.trialResult.summary?.productionBuild ?? null,
    productionImports: runtimeReports.productionImports?.summary ?? null,
    bundle: runtimeReports.bundle
      ? {
          budgetStatus: runtimeReports.bundle.budgetStatus,
          projectionGuard: runtimeReports.bundle.projectionGuard,
          summary: runtimeReports.bundle.summary,
        }
      : null,
    qualification: runtimeReports.qualification,
    binding: runtimeReports.binding?.summary ?? null,
    deterministicFormal: {
      status: 'pass',
      mode: 'executed',
      executionContext: 'test:trial-release/test-full',
      coverage: getGateDefinition('determinism').formalCoverage,
    },
    formalSearchAdmission: stages.admission,
    formalSearchAdmissionRecordId: admissionRecord.recordId,
    clientParity: stages.admission.clientParity,
    extraFormalGates: stages.extraResults.map(result => ({
      gate: result.gate,
      status: result.status,
      mode: 'executed',
      durationMs: result.durationMs,
      summary: result.summary,
    })),
    trialReleaseDurationMs: stages.trialResult.durationMs,
    trialStageTimeline: stages.trialResult.summary?.stageTimeline ?? [],
    runnerOutputRestoration: stages.trialResult.runnerOutputRestoration ?? null,
  };
}

async function loadReleaseRuntimeReports(root, observedRunnerReports = {}) {
  const [
    productionImports,
    workbenchData,
    bundle,
    productionPreview,
    qualification,
    binding,
  ] = await Promise.all([
    readJsonOptional(root, 'reports/production-import-audit.json'),
    readJsonOptional(root, 'reports/workbench-production-data-audit.json'),
    readJsonOptional(root, 'reports/bundle-composition.json'),
    observedRunnerReports.productionPreview ??
      readJsonOptional(root, 'reports/production-preview-acceptance.json'),
    readJsonOptional(
      root,
      'reports/m12/m12-b3-optimization-qualification-summary.json'
    ),
    readJsonOptional(root, 'reports/m12/m12-b3-binding-matrix.json'),
  ]);
  return {
    productionImports,
    workbenchData,
    bundle,
    productionPreview,
    qualification,
    binding,
  };
}

async function readJsonOptional(root, relativePath) {
  try {
    return JSON.parse(
      await readFile(path.join(root, ...relativePath.split('/')), 'utf8')
    );
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function printPreflight(stdout, preflight) {
  stdout.write('AZPR RELEASE VERIFY PREFLIGHT\n\n');
  stdout.write(`HEAD: ${preflight.head}\n`);
  stdout.write(`Tracked tree: ${preflight.trackedClean ? 'clean' : 'dirty'}\n`);
  stdout.write(
    `Untracked evidence: ${preflight.untrackedEvidencePresent ? 'present (preserved)' : 'none'}\n`
  );
  stdout.write(`Stash top: ${preflight.stashTop ?? 'none'}\n`);
  if (!preflight.trackedClean) {
    for (const file of preflight.trackedDirtyFiles) stdout.write(`- ${file}\n`);
  }
}

function printReleaseSuccess(stdout, report) {
  const summary = report.summary;
  stdout.write('\nAZPR RELEASE VERIFY\n\n');
  stdout.write(`FINAL HEAD: ${report.head}\n`);
  stdout.write('release:verify: PASS (executed)\n');
  stdout.write(
    'M12-C deterministic/formal: PASS (executed inside test:trial-release)\n'
  );
  stdout.write('test:trial-release: PASS (executed; cache ignored)\n');
  if (summary.runnerOutputRestoration) {
    stdout.write(
      `Runner outputs restored: ${summary.runnerOutputRestoration.restoredCount} (static allowlist; pre-trial bytes)\n`
    );
  }
  if (summary.testFull) {
    stdout.write(
      `Full: ${summary.testFull.filesPassed ?? '?'} / ${summary.testFull.filesTotal ?? '?'} files; ${summary.testFull.testsPassed ?? '?'} / ${summary.testFull.testsTotal ?? '?'} tests\n`
    );
  }
  if (summary.productionPreview) {
    stdout.write(
      `Production preview: ${summary.productionPreview.testsPassed ?? '?'} / ${summary.productionPreview.testsTotal ?? '?'}\n`
    );
  }
  if (summary.productionImports) {
    stdout.write(
      `Production imports: ${summary.productionImports.unexpectedTestOnlyCount ?? '?'} unexpected; ${summary.productionImports.unreferencedCount ?? '?'} unreferenced\n`
    );
  }
  if (summary.binding) {
    stdout.write(
      `Binding: ${summary.binding.passedCount ?? '?'} / ${summary.binding.checkCount ?? '?'}\n`
    );
  }
  stdout.write(
    `Qualification: ${summary.qualification?.m12cLocked === false ? 'PASS' : 'BLOCKED'}\n`
  );
  stdout.write(
    `Formal Search Admission: ${summary.formalSearchAdmission.status.toUpperCase()}\n`
  );
  for (const blocker of summary.formalSearchAdmission.blockers) {
    stdout.write(`- ${blocker}\n`);
  }
  stdout.write(
    `Client Parity: ${summary.clientParity.ready ? 'READY' : 'PENDING (reported separately; not conflated with qualification)'}\n`
  );
}

function printReleaseFailure(stdout, report) {
  stdout.write('\nAZPR RELEASE VERIFY\n\n');
  stdout.write(`FINAL HEAD: ${report.head}\n`);
  stdout.write('release:verify: FAIL (executed)\n');
  stdout.write(`Failure stage: ${report.failureStage}\n`);
  if (report.runnerOutputRestoration) {
    stdout.write(
      `Runner outputs restored: ${report.runnerOutputRestoration.restoredCount} (static allowlist; pre-trial bytes)\n`
    );
  }
}

function createPreflightFailureReport(preflight, scriptIntegrity) {
  return {
    schemaVersion: 1,
    kind: 'azpr-release-verify-report',
    createdAt: new Date().toISOString(),
    status: 'fail',
    mode: 'executed',
    head: preflight.head,
    parent: preflight.parent,
    failureStage: 'preflight',
    preflight,
    scriptIntegrity,
  };
}

function createReleaseFailureReport({
  snapshot,
  preflight,
  stages,
  releaseRecord,
  scriptIntegrity,
}) {
  return {
    schemaVersion: 1,
    kind: 'azpr-release-verify-report',
    createdAt: new Date().toISOString(),
    status: 'fail',
    mode: 'executed',
    head: snapshot.head,
    parent: snapshot.parent,
    failureStage: stages.failureStage,
    completedStages: stages.completedStages,
    preflight,
    postflight: stages.postflight ?? null,
    scriptIntegrity,
    releaseRecordId: releaseRecord.recordId,
    failure: stages.failure ?? null,
    runnerOutputRestoration:
      stages.trialResult?.runnerOutputRestoration ?? null,
  };
}

function parseCapturedRunnerJson(text, relativePath) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(
      `Captured runner output is not valid JSON: ${relativePath}: ${error.message}`
    );
  }
}

function normalizeRecordFailureStatus(status) {
  return ['fail', 'timeout', 'oom', 'interrupted', 'cancelled'].includes(status)
    ? status
    : 'fail';
}

function parseReleaseArguments(args) {
  const options = { jsonPath: null, help: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--json') {
      const value = args[++index];
      if (!value || value.startsWith('--'))
        throw new Error('Missing value for --json');
      options.jsonPath = value;
    } else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new Error(`Unknown release:verify argument: ${argument}`);
  }
  return options;
}

async function writeJsonReport(file, report) {
  const target = path.resolve(file);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await rename(temporary, target);
}

function defaultReleaseReport(root) {
  return path.join(
    root,
    'work',
    'm12-c',
    'gates',
    'latest-release-verify.json'
  );
}

function releaseHelpText() {
  return `AzPr uncached final release verification

Usage:
  npm run release:verify
  npm run release:verify -- --json <report-path>

Safety and authority:
  - Requires a clean tracked working tree.
  - Preserves untracked evidence and stash state.
  - Executes M12-C formal audits not already in test:trial-release.
  - Always invokes the real npm run test:trial-release exactly once.
  - Never accepts cached trial-release evidence.
  - Restores only tracked direct reports/*.png and the production preview report to their pre-trial bytes.
  - Preserves the observed production preview report in the release result before restoration.
  - Reports Formal Search Admission separately from clientParityReady.
  - Provides no --trust, --force-valid or --mark-pass option.`;
}

function isMainModule() {
  return (
    process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  );
}

if (isMainModule()) {
  try {
    const result = await runReleaseVerification();
    process.exitCode = result.exitCode;
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify(
        {
          status: 'release-verify-orchestration-failed',
          message: error?.message ?? String(error),
          code: error?.code ?? null,
        },
        null,
        2
      )}\n`
    );
    process.exitCode = 1;
  }
}
