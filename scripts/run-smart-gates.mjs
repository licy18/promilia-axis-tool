import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GATE_DEFINITIONS,
  validateGateDefinitions,
} from './gates/gate-definitions.mjs';
import {
  computeAllGateFingerprints,
  createRepositorySnapshot,
} from './gates/gate-fingerprint.mjs';
import {
  readLedger,
  recoverInterruptedRuns,
  resolveLedgerPaths,
} from './gates/gate-ledger.mjs';
import { planSmartGates } from './gates/gate-planner.mjs';
import { executeSmartGatePlan } from './gates/gate-runner.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultRepositoryRoot = path.resolve(scriptDirectory, '..');

export async function runSmartGates({
  repositoryRoot = defaultRepositoryRoot,
  args = process.argv.slice(2),
  stdout = process.stdout,
  executePlan = executeSmartGatePlan,
} = {}) {
  const options = parseArguments(args);
  if (options.help) {
    stdout.write(`${helpText()}\n`);
    return { status: 'help', exitCode: 0 };
  }
  const integrity = validateGateDefinitions();
  if (!integrity.valid) {
    throw new Error(
      `Gate definition integrity failed: ${integrity.issues.join(', ')}`
    );
  }
  const root = path.resolve(repositoryRoot);
  const ledgerPaths = resolveLedgerPaths(root);
  await recoverInterruptedRuns({ repositoryRoot: root });
  const ledger = await readLedger({ repositoryRoot: root });
  const snapshot = await createRepositorySnapshot({
    repositoryRoot: root,
    base: options.base,
    definitions: GATE_DEFINITIONS,
    simulatedChanges: options.simulatedChanges,
  });
  const fingerprints = computeAllGateFingerprints({
    inventory: snapshot.inventory,
    authority: snapshot.authority,
    simulatedDigests: snapshot.simulatedDigests,
  });
  const plan = planSmartGates({
    changedFiles: snapshot.changedFiles,
    fingerprints,
    ledger,
    authority: snapshot.authority,
    integration: options.integration,
  });
  printPlan({ stdout, snapshot, plan, options });
  if (options.planOnly) {
    const report = createReport({ snapshot, plan, execution: null, options });
    await writeJsonReport(options.jsonPath ?? defaultSmartReport(root), report);
    return { status: 'planned', exitCode: 0, snapshot, plan, report };
  }
  const execution = await executePlan({
    repositoryRoot: root,
    plan,
    fingerprints,
    snapshot,
    tee: true,
    onDecision: decision => {
      if (decision.decision === 'run') {
        stdout.write(`\nGate: ${decision.gate}\nDecision: RUN (executed)\n`);
      } else if (decision.decision === 'reuse') {
        stdout.write(
          `Gate: ${decision.gate}\nDecision: REUSE from ${decision.reusable.recordId}\n`
        );
      }
    },
  });
  printExecutionSummary(stdout, execution, plan);
  const report = createReport({ snapshot, plan, execution, options });
  await writeJsonReport(options.jsonPath ?? defaultSmartReport(root), report);
  return {
    status: execution.status,
    exitCode: execution.exitCode,
    snapshot,
    plan,
    execution,
    report,
    ledgerPath: ledgerPaths.file,
  };
}

export function parseArguments(args) {
  const options = {
    base: null,
    planOnly: false,
    explain: false,
    integration: false,
    simulatedChanges: [],
    jsonPath: null,
    help: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--base')
      options.base = requireValue(args, ++index, argument);
    else if (argument === '--plan') options.planOnly = true;
    else if (argument === '--explain') options.explain = true;
    else if (argument === '--integration') options.integration = true;
    else if (argument === '--simulate-change') {
      options.simulatedChanges.push(requireValue(args, ++index, argument));
      options.planOnly = true;
    } else if (argument === '--json') {
      options.jsonPath = requireValue(args, ++index, argument);
    } else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new Error(`Unknown test:smart argument: ${argument}`);
  }
  return options;
}

function printPlan({ stdout, snapshot, plan, options }) {
  stdout.write('AzPr Smart Gate\n\n');
  stdout.write(`HEAD: ${snapshot.head}\n`);
  stdout.write(`Base: ${snapshot.base}\n`);
  stdout.write(
    `Working tree: tracked ${snapshot.trackedClean ? 'clean' : 'dirty'}; untracked evidence ${snapshot.untrackedEvidencePresent ? 'present' : 'none'}\n`
  );
  stdout.write(
    `Cache authority: ${plan.cacheAuthorityReady ? 'VALID' : 'BOOTSTRAP (reuse disabled until release:verify PASS)'}\n`
  );
  if (snapshot.simulatedChanges.length) {
    stdout.write(`Simulation: ${snapshot.simulatedChanges.join(', ')}\n`);
  }
  stdout.write('\nChanged domains:\n');
  writeList(stdout, plan.classification.domains);
  stdout.write('\nChanged files:\n');
  writeList(stdout, snapshot.changedFiles);
  writeDecisionSection(stdout, 'Required', plan.decisions, 'run', '[RUN]');
  writeDecisionSection(stdout, 'Reused', plan.decisions, 'reuse', '[REUSE]');
  writeDecisionSection(
    stdout,
    'Covered without duplicate command',
    plan.decisions,
    'covered',
    '[COVERED]'
  );
  writeDecisionSection(
    stdout,
    'Invalidated / deferred',
    plan.decisions,
    'invalidated',
    '[INVALIDATED]'
  );
  if (plan.unknownEscalation) {
    stdout.write('\nUNCLASSIFIED CHANGE:\n');
    writeList(stdout, plan.classification.unknownFiles);
    stdout.write(
      'Fail-closed escalation:\n- test:full required\n- release-sensitive state assumed\n'
    );
  }
  if (options.explain) {
    stdout.write('\nExplanation:\n');
    for (const decision of plan.decisions) {
      if (decision.decision === 'unavailable') continue;
      stdout.write(`- ${decision.gate} [${decision.decision}]\n`);
      for (const reason of decision.reasons) stdout.write(`  - ${reason}\n`);
      stdout.write(`  - fingerprint: ${decision.dependencyFingerprint}\n`);
    }
  }
  stdout.write('\nRelease status: NOT EVALUATED\n');
  stdout.write(
    'Formal Search: UNCHANGED (test:smart cannot grant admission)\n'
  );
}

function writeDecisionSection(stdout, title, decisions, type, marker) {
  const entries = decisions.filter(entry => entry.decision === type);
  stdout.write(`\n${title}:\n`);
  if (!entries.length) {
    stdout.write('- none\n');
    return;
  }
  for (const entry of entries) {
    const suffix =
      type === 'reuse'
        ? ` from matching dependency fingerprint (${entry.reusable.recordId})`
        : type === 'covered'
          ? ` by ${entry.coveredBy}`
          : '';
    stdout.write(`${marker} ${entry.gate}${suffix}\n`);
  }
}

function printExecutionSummary(stdout, execution, plan) {
  stdout.write('\nAZPR SMART GATE RESULT\n\n');
  stdout.write(`Result: ${execution.status.toUpperCase()}\n`);
  stdout.write('Executed:\n');
  writeList(
    stdout,
    execution.results
      .filter(result => result.mode?.startsWith('executed'))
      .map(result => `${result.status === 'pass' ? '✓' : '✗'} ${result.gate}`)
  );
  stdout.write('Reused:\n');
  writeList(
    stdout,
    execution.results
      .filter(result => result.mode === 'reused')
      .map(result => `✓ ${result.gate}`)
  );
  stdout.write('Invalidated:\n');
  writeList(
    stdout,
    plan.decisions
      .filter(entry => entry.decision === 'invalidated')
      .map(entry => entry.gate)
  );
  stdout.write(
    `Unknown: ${plan.classification.unknownFiles.length ? plan.classification.unknownFiles.join(', ') : 'none'}\n`
  );
  stdout.write('Release status: NOT EVALUATED\n');
  stdout.write('Formal Search: UNCHANGED / NOT EVALUATED\n');
}

function createReport({ snapshot, plan, execution, options }) {
  return {
    schemaVersion: 1,
    kind: 'azpr-smart-gate-report',
    createdAt: new Date().toISOString(),
    head: snapshot.head,
    parent: snapshot.parent,
    base: snapshot.base,
    workingTreeFingerprint: snapshot.workingTreeFingerprint,
    trackedClean: snapshot.trackedClean,
    trackedDirtyFiles: snapshot.trackedDirtyFiles,
    untrackedEvidencePresent: snapshot.untrackedEvidencePresent,
    untrackedSummaryPaths: snapshot.untrackedSummaryPaths,
    simulatedChanges: snapshot.simulatedChanges,
    options: {
      planOnly: options.planOnly,
      explain: options.explain,
      integration: options.integration,
    },
    cacheAuthorityReady: plan.cacheAuthorityReady,
    cacheAuthority: plan.cacheAuthority,
    classification: plan.classification,
    decisions: plan.decisions.map(decision => ({
      gate: decision.gate,
      gateVersion: decision.definition.version,
      kind: decision.definition.kind,
      decision: decision.decision,
      required: decision.required,
      coveredBy: decision.coveredBy ?? null,
      dependencyFingerprint: decision.dependencyFingerprint,
      dependencyCount: decision.dependencyCount,
      dependencyChanges: decision.dependencyChanges,
      triggerChanges: decision.triggerChanges,
      previousRecordId: decision.previous?.recordId ?? null,
      reusableRecordId: decision.reusable?.recordId ?? null,
      reasons: decision.reasons,
    })),
    planSummary: plan.summary,
    execution: execution
      ? {
          status: execution.status,
          exitCode: execution.exitCode,
          failedGate: execution.failedGate,
          results: execution.results.map(result => ({
            gate: result.gate,
            status: result.status,
            mode: result.mode,
            durationMs: result.durationMs ?? 0,
            recordId: result.record?.recordId ?? null,
          })),
        }
      : null,
    releaseStatus: 'not-evaluated',
    formalSearchStatus: 'unchanged-not-authoritative',
  };
}

async function writeJsonReport(file, report) {
  const target = path.resolve(file);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await rename(temporary, target);
}

function defaultSmartReport(root) {
  return path.join(root, 'work', 'm12-c', 'gates', 'latest-smart-gate.json');
}

function writeList(stdout, values) {
  if (!values.length) stdout.write('- none\n');
  else for (const value of values) stdout.write(`- ${value}\n`);
}

function requireValue(args, index, option) {
  const value = args[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${option}`);
  }
  return value;
}

function helpText() {
  return `AzPr dependency-aware smart gates

Usage:
  npm run test:smart
  npm run test:smart -- --plan
  npm run test:smart -- --base <sha>
  npm run test:smart -- --integration
  npm run test:smart -- --explain
  npm run test:smart -- --simulate-change <repository-path> [--simulate-change <path>]
  npm run test:smart -- --json <report-path>

Rules:
  - Development and integration support only.
  - Unknown changes fail closed and require test:full.
  - Reuse requires a matching dependency fingerprint and a prior executed PASS.
  - Reuse remains disabled until this gate implementation has passed release:verify.
  - This command never evaluates release readiness or grants Formal Search admission.
  - Final release always requires a real, uncached npm run release:verify.`;
}

function isMainModule() {
  return (
    process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  );
}

if (isMainModule()) {
  try {
    const result = await runSmartGates();
    process.exitCode = result.exitCode;
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify(
        {
          status: 'smart-gate-orchestration-failed',
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
