import { execFile } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import {
  GATE_DEFINITIONS,
  SEARCH_CORE_GATE_NAMES,
  getGateDefinition,
  validateGateDefinitions,
} from './gates/gate-definitions.mjs';
import {
  canonicalStringify,
  computeAllGateFingerprints,
  createRepositorySnapshot,
  readGitState,
  sha256,
} from './gates/gate-fingerprint.mjs';
import {
  beginGateRun,
  completeGateRun,
  recoverInterruptedRuns,
} from './gates/gate-ledger.mjs';
import { runGate } from './gates/gate-runner.mjs';
import {
  evaluateFormalSearchAdmission,
  loadFormalSearchAdmissionEvidence,
  validateFormalSearchAdmissionRecord,
} from './gates/formal-search-admission.mjs';
import { getVerifiedChargedInputAuthorityDescriptor } from '../src/domain/verifiedChargedInputAuthority.js';

const execFileAsync = promisify(execFile);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultRepositoryRoot = path.resolve(scriptDirectory, '..');
const DEFAULT_REPORT = path.join(
  'work',
  'm12-c',
  'gates',
  'latest-search-core-authority.json'
);

export async function runSearchCoreAuthorityVerification({
  repositoryRoot = defaultRepositoryRoot,
  args = process.argv.slice(2),
  stdout = process.stdout,
  gateRunner = runGate,
  evidenceLoader = loadFormalSearchAdmissionEvidence,
} = {}) {
  const options = parseArguments(args);
  if (options.help) {
    stdout.write(`${helpText()}\n`);
    return { status: 'help', exitCode: 0 };
  }
  const root = path.resolve(repositoryRoot);
  const reportPath = path.resolve(root, options.jsonPath ?? DEFAULT_REPORT);
  const definitionIntegrity = validateGateDefinitions();
  if (!definitionIntegrity.valid) {
    throw new Error(
      `Gate definition integrity failed: ${definitionIntegrity.issues.join(', ')}`
    );
  }

  const preflight = await inspectRepositoryAuthority(root);
  if (!preflight.valid) {
    const report = createFailureReport({
      stage: 'preflight',
      preflight,
      issues: preflight.issues,
    });
    await writeJsonAtomic(reportPath, report);
    printFailure(stdout, report);
    return { status: 'fail', exitCode: 1, report };
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
  const authorityDefinition = getGateDefinition('search-core-authority');
  const authorityPending = await beginGateRun({
    repositoryRoot: root,
    gate: authorityDefinition.name,
    head: snapshot.head,
    workingTreeFingerprint: snapshot.workingTreeFingerprint,
    dependencyFingerprint: fingerprints.get(authorityDefinition.name)
      .dependencyFingerprint,
    gateDefinitionVersion: authorityDefinition.version,
    command: 'npm run search:authority:verify',
    context: 'search-core-authority-uncached',
  });

  const stageResults = [];
  const previousNodeOptions = process.env.NODE_OPTIONS;
  process.env.NODE_OPTIONS = withSearchCoreHeap(previousNodeOptions);
  try {
    for (const gateName of SEARCH_CORE_GATE_NAMES) {
      const definition = getGateDefinition(gateName);
      stdout.write(`\nSearch authority stage: ${gateName}\n`);
      const result = await gateRunner({
        repositoryRoot: root,
        definition,
        fingerprint: fingerprints.get(gateName),
        snapshot,
        context: 'search-core-authority-stage',
        tee: true,
        logDirectory: path.join(root, 'work', 'm12-c', 'gates', 'logs'),
      });
      stageResults.push({ ...result, mode: 'executed' });
      if (result.status !== 'pass' || result.exitCode !== 0) {
        return completeFailure({
          root,
          reportPath,
          stdout,
          authorityPending,
          snapshot,
          preflight,
          stageResults,
          stage: gateName,
          issues: [`search-core-stage-failed:${gateName}`],
        });
      }
    }
  } finally {
    if (previousNodeOptions == null) delete process.env.NODE_OPTIONS;
    else process.env.NODE_OPTIONS = previousNodeOptions;
  }

  const proof = createSearchCoreProof({ snapshot, stageResults });
  const deterministicProof = {
    gate: 'determinism',
    status: 'pass',
    mode: 'executed',
    exitCode: 0,
    coverage: getGateDefinition('determinism').formalCoverage,
    recordId: stageResults.find(result => result.gate === 'determinism')?.record
      ?.recordId,
  };
  let evidence;
  let admission;
  try {
    evidence = await evidenceLoader({
      repositoryRoot: root,
      searchCoreProof: proof,
      deterministicProof,
    });
    admission = await evaluateFormalSearchAdmission(evidence);
  } catch (error) {
    return completeFailure({
      root,
      reportPath,
      stdout,
      authorityPending,
      snapshot,
      preflight,
      stageResults,
      stage: 'formal-search-admission',
      issues: [
        `formal-search-admission-load-failed:${normalizeErrorIdentity(error)}`,
      ],
    });
  }
  const admissionValidation = validateFormalSearchAdmissionRecord(admission);
  let runtimeAuthority;
  try {
    const layerHashes = JSON.parse(
      await readFile(
        path.join(
          root,
          'src',
          'data',
          'generated',
          'verified-combat-mechanics-layer-hashes.json'
        ),
        'utf8'
      )
    );
    const runtimeAuthorityResult = createSearchRuntimeAuthorityIdentity({
      normalAttackInputAuthority: evidence.normalAttackInputAuthority,
      chargedInputAuthority: getVerifiedChargedInputAuthorityDescriptor(),
      layerHashes,
    });
    if (!runtimeAuthorityResult.valid) {
      return completeFailure({
        root,
        reportPath,
        stdout,
        authorityPending,
        snapshot,
        preflight,
        stageResults,
        admission,
        stage: 'runtime-authority',
        issues: runtimeAuthorityResult.issues,
      });
    }
    runtimeAuthority = runtimeAuthorityResult.value;
  } catch (error) {
    return completeFailure({
      root,
      reportPath,
      stdout,
      authorityPending,
      snapshot,
      preflight,
      stageResults,
      admission,
      stage: 'runtime-authority',
      issues: [
        `runtime-authority-load-failed:${normalizeErrorIdentity(error)}`,
      ],
    });
  }
  const postflight = await inspectRepositoryAuthority(root);
  const postflightStable =
    postflight.valid &&
    postflight.head === snapshot.head &&
    postflight.originHead === snapshot.head;
  if (!admissionValidation.valid || !postflightStable) {
    return completeFailure({
      root,
      reportPath,
      stdout,
      authorityPending,
      snapshot,
      preflight,
      postflight,
      stageResults,
      admission,
      stage: !admissionValidation.valid
        ? 'formal-search-admission'
        : 'postflight',
      issues: [
        ...admissionValidation.issues,
        ...(postflightStable ? [] : ['search-core-postflight-drifted']),
      ],
    });
  }

  const record = await completeGateRun({
    repositoryRoot: root,
    pending: authorityPending,
    status: 'pass',
    exitCode: 0,
    stdoutComplete: true,
    reportParseStatus: 'complete',
    summary: {
      requiredGates: [...SEARCH_CORE_GATE_NAMES],
      formalSearchAdmission: admission,
      productRelease: admission.productRelease,
      runtimeAuthority,
      smartCacheAuthority: snapshot.authority,
    },
    details: {
      context: 'search-core-authority-uncached',
      stageRecordIds: stageResults.map(result => result.record?.recordId),
    },
  });
  const report = finalizeReport({
    schemaVersion: 2,
    kind: 'azpr-search-core-authority',
    gate: 'search-core-authority',
    status: 'pass',
    mode: 'executed',
    exitCode: 0,
    generatedAt: new Date().toISOString(),
    head: snapshot.head,
    originHead: postflight.originHead,
    trackedClean: true,
    workingTreeFingerprint: snapshot.workingTreeFingerprint,
    dependencyFingerprint: fingerprints.get(authorityDefinition.name)
      .dependencyFingerprint,
    gateDefinitionVersion: authorityDefinition.version,
    recordId: record.recordId,
    gates: proof.gates,
    databaseContentHash: evidence.databaseContentHash,
    runtimeAuthority,
    headlessCharacterScope: evidence.headlessCharacterScope,
    kiboAxisActionScope: evidence.kiboAxisActionScope,
    formalSearchAdmission: admission,
    productRelease: admission.productRelease,
  });
  await writeJsonAtomic(reportPath, report);
  stdout.write(
    `\nSearch core authority: PASS (executed)\nDescriptor: ${reportPath}\nDescriptor SHA-256: ${report.descriptorSha256}\n`
  );
  return { status: 'pass', exitCode: 0, report, reportPath };
}

export function createSearchRuntimeAuthorityIdentity({
  normalAttackInputAuthority = null,
  chargedInputAuthority = null,
  layerHashes = null,
} = {}) {
  const value = {
    schemaVersion: 1,
    contractName: 'AzPrSearchRuntimeAuthorityIdentity',
    normalAttackInputAuthorityHash:
      normalAttackInputAuthority?.contractHash ?? null,
    chargedInputAuthorityHash: chargedInputAuthority?.authorityHash ?? null,
    packageId: layerHashes?.packageId ?? null,
    packageVersion: layerHashes?.packageVersion ?? null,
    packageHash: layerHashes?.packageHash ?? null,
    mechanismHash: layerHashes?.mechanismHash ?? null,
    dataVersionHash: layerHashes?.dataVersionHash ?? null,
  };
  const issues = [];
  if (!/^[a-f0-9]{16}$/u.test(value.normalAttackInputAuthorityHash ?? '')) {
    issues.push('runtime-authority-normal-input-hash-invalid');
  }
  if (!/^[a-f0-9]{64}$/u.test(value.chargedInputAuthorityHash ?? '')) {
    issues.push('runtime-authority-charged-input-hash-invalid');
  }
  if (!value.packageId || !Number.isInteger(value.packageVersion)) {
    issues.push('runtime-authority-package-identity-invalid');
  }
  for (const [key, issue] of [
    ['packageHash', 'runtime-authority-package-hash-invalid'],
    ['mechanismHash', 'runtime-authority-mechanism-hash-invalid'],
    ['dataVersionHash', 'runtime-authority-data-version-hash-invalid'],
  ]) {
    if (!/^[a-f0-9]{64}$/u.test(value[key] ?? '')) issues.push(issue);
  }
  return {
    valid: issues.length === 0,
    issues,
    value,
  };
}

function createSearchCoreProof({ snapshot, stageResults }) {
  return {
    schemaVersion: 1,
    kind: 'azpr-search-core-authority',
    gate: 'search-core-authority',
    status: 'pass',
    mode: 'executed',
    exitCode: 0,
    head: snapshot.head,
    workingTreeFingerprint: snapshot.workingTreeFingerprint,
    gates: stageResults.map(result => ({
      gate: result.gate,
      status: result.status,
      mode: 'executed',
      exitCode: result.exitCode,
      recordId: result.record?.recordId ?? null,
      dependencyFingerprint: result.record?.dependencyFingerprint ?? null,
      gateDefinitionVersion: result.record?.gateDefinitionVersion ?? null,
    })),
  };
}

async function completeFailure({
  root,
  reportPath,
  stdout,
  authorityPending,
  snapshot,
  preflight,
  postflight = null,
  stageResults,
  admission = null,
  stage,
  issues,
}) {
  const record = await completeGateRun({
    repositoryRoot: root,
    pending: authorityPending,
    status: 'fail',
    exitCode: 1,
    stdoutComplete: true,
    reportParseStatus: 'complete',
    summary: { failureStage: stage, issues, formalSearchAdmission: admission },
    details: {
      context: 'search-core-authority-uncached',
      stageRecordIds: stageResults.map(result => result.record?.recordId),
    },
  });
  const report = createFailureReport({
    stage,
    preflight,
    postflight,
    snapshot,
    stageResults,
    admission,
    issues,
    recordId: record.recordId,
  });
  await writeJsonAtomic(reportPath, report);
  printFailure(stdout, report);
  return { status: 'fail', exitCode: 1, report };
}

async function inspectRepositoryAuthority(repositoryRoot) {
  const gitState = await readGitState({ repositoryRoot });
  let originHead = null;
  try {
    originHead = (
      await execFileAsync('git', ['rev-parse', 'origin/master'], {
        cwd: repositoryRoot,
        encoding: 'utf8',
      })
    ).stdout.trim();
  } catch {
    originHead = null;
  }
  const issues = [];
  if (!gitState.trackedClean) issues.push('tracked-worktree-dirty');
  if (!originHead) issues.push('origin-master-unavailable');
  if (originHead && gitState.head !== originHead) {
    issues.push('head-origin-master-mismatch');
  }
  return {
    ...gitState,
    originHead,
    valid: issues.length === 0,
    issues,
  };
}

function createFailureReport({
  stage,
  preflight,
  postflight = null,
  snapshot = null,
  stageResults = [],
  admission = null,
  issues = [],
  recordId = null,
}) {
  return finalizeReport({
    schemaVersion: 2,
    kind: 'azpr-search-core-authority',
    gate: 'search-core-authority',
    status: 'fail',
    mode: 'executed',
    exitCode: 1,
    generatedAt: new Date().toISOString(),
    failureStage: stage,
    issues: [...new Set(issues)],
    head: snapshot?.head ?? preflight?.head ?? null,
    originHead: postflight?.originHead ?? preflight?.originHead ?? null,
    trackedClean: postflight?.trackedClean ?? preflight?.trackedClean ?? false,
    workingTreeFingerprint: snapshot?.workingTreeFingerprint ?? null,
    recordId,
    gates: stageResults.map(result => ({
      gate: result.gate,
      status: result.status,
      mode: 'executed',
      exitCode: result.exitCode,
      recordId: result.record?.recordId ?? null,
    })),
    formalSearchAdmission: admission,
  });
}

function finalizeReport(value) {
  return {
    ...value,
    descriptorSha256: sha256(canonicalStringify(value)),
  };
}

async function writeJsonAtomic(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, file);
}

function parseArguments(args) {
  const options = { help: false, jsonPath: null };
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === '--help' || token === '-h') options.help = true;
    else if (token === '--json') options.jsonPath = args[++index];
    else throw new Error(`Unknown search authority argument: ${token}`);
  }
  return options;
}

function helpText() {
  return [
    'Usage: npm run search:authority:verify -- [--json <path>]',
    '',
    'Runs only the executed headless-search authority gates.',
    'It does not run visual acceptance, binding, full Vitest, build, or preview.',
  ].join('\n');
}

function withSearchCoreHeap(nodeOptions) {
  const retained = String(nodeOptions ?? '')
    .split(/\s+/u)
    .filter(Boolean)
    .filter(
      token =>
        !token.startsWith('--max-old-space-size=') &&
        !token.startsWith('--max_old_space_size=')
    );
  return [...retained, '--max-old-space-size=8192'].join(' ');
}

function normalizeErrorIdentity(error) {
  return String(error?.code ?? error?.name ?? 'unknown')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gu, '-');
}

function printFailure(stdout, report) {
  stdout.write(
    `\nSearch core authority: BLOCKED (${report.failureStage})\nIssues: ${report.issues.join(', ') || 'unknown'}\n`
  );
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  runSearchCoreAuthorityVerification()
    .then(result => {
      process.exitCode = result.exitCode;
    })
    .catch(error => {
      process.stderr.write(`${error.stack ?? error.message}\n`);
      process.exitCode = 1;
    });
}
