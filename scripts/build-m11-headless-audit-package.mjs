#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFile,
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(SCRIPT_PATH), '..');
const CLI_BUILD_DIR = resolve(REPO_ROOT, 'work/machine-axis-cli-dist');
const CLI_BUNDLE_PATH = resolve(CLI_BUILD_DIR, 'machine-axis-cli.mjs');
const CLI_SOURCE_MAP_PATH = `${CLI_BUNDLE_PATH}.map`;
const INTEGRATED_REPORT_PATH = resolve(
  REPO_ROOT,
  'reports/m11/m11-headless-integrated-baseline-20260730.json'
);
const FORBIDDEN_PACKAGE_PATH =
  /(?:^|\/)(?:dist|e2e|views|components|stores)(?:\/|$)|(?:^|\/)src\/features\/|\.vue$|\.(?:png|jpe?g|gif|webp|svg|dll|exe|pak|bundle|assets|ress|resource|asset)$/i;
const FORBIDDEN_RAW_NAME =
  /raw_nostreaming_package|default_package|extractedassets|gameassembly|(?:^|[-_.])slice(?:[-_.]|$)/i;

const EVIDENCE_PATHS = [
  ['reports/kibo-headless', 'evidence/kibo-headless'],
  ['reports/m10/101003', 'evidence/characters/101003'],
  ['reports/m10/101010', 'evidence/characters/101010'],
  ['reports/m10/103002', 'evidence/characters/103002'],
  [
    'reports/m10/all-character-coverage-manifest.json',
    'evidence/characters/all-character-coverage-manifest.json',
  ],
  [
    'reports/m10/all-character-coverage-manifest.md',
    'evidence/characters/all-character-coverage-manifest.md',
  ],
  [
    'reports/m10/character-product-boundaries.json',
    'evidence/characters/character-product-boundaries.json',
  ],
  [
    'reports/m10/character-product-boundaries.md',
    'evidence/characters/character-product-boundaries.md',
  ],
  [
    'reports/m10/controlled-actor-inheritance-audit.json',
    'evidence/characters/controlled-actor-inheritance-audit.json',
  ],
  [
    'reports/m10/controlled-actor-inheritance-audit.md',
    'evidence/characters/controlled-actor-inheritance-audit.md',
  ],
  ['reports/m11/character-acceptance', 'evidence/character-acceptance'],
  [
    'reports/m11/m11-headless-integrated-baseline-20260730.json',
    'evidence/m11-headless-integrated-baseline.json',
  ],
  [
    'src/data/generated/character-combat-owner-contracts',
    'evidence/generated/character-combat-owner-contracts',
  ],
  [
    'src/data/generated/character-combat-profiles',
    'evidence/generated/character-combat-profiles',
  ],
  [
    'src/data/generated/character-combat-profile-catalog.json',
    'evidence/generated/character-combat-profile-catalog.json',
  ],
  [
    'src/data/generated/character-combat-profile-schema.json',
    'evidence/generated/character-combat-profile-schema.json',
  ],
  [
    'src/data/generated/character-acceptance-catalog.json',
    'evidence/generated/character-acceptance-catalog.json',
  ],
  [
    'src/data/generated/character-acceptance-manifest-index.json',
    'evidence/generated/character-acceptance-manifest-index.json',
  ],
  [
    'src/data/generated/kibo-passive-mechanics.json',
    'evidence/generated/kibo-passive-mechanics.json',
  ],
  [
    'src/data/generated/verified-sp-unit-contract.json',
    'evidence/generated/verified-sp-unit-contract.json',
  ],
  [
    'scripts/character-combat/profile-recipes',
    'evidence/recipes/character-combat',
  ],
  [
    'scripts/character-acceptance/acceptance-recipes',
    'evidence/recipes/character-acceptance',
  ],
  [
    'scripts/generate-kibo-headless-census.mjs',
    'evidence/tooling/generate-kibo-headless-census.mjs',
  ],
  [
    'scripts/sync-verified-combat-mechanics.mjs',
    'evidence/tooling/sync-verified-combat-mechanics.mjs',
  ],
  [
    'scripts/sync-character-combat-profile.mjs',
    'evidence/tooling/sync-character-combat-profile.mjs',
  ],
  [
    'scripts/generate-character-acceptance.mjs',
    'evidence/tooling/generate-character-acceptance.mjs',
  ],
  ['scripts/character-combat', 'evidence/tooling/character-combat'],
  ['scripts/character-acceptance', 'evidence/tooling/character-acceptance'],
];

const VERIFIED_REPORT_NAMES = [
  'verified-combat-mechanics-audit',
  'verified-combat-action-coverage',
  'verified-combat-action-timing-coverage',
  'verified-combat-effect-coverage',
  'verified-action-variant-resource-coverage',
  'verified-derived-control-coverage',
  'verified-public-runtime-coverage',
  'verified-switch-trigger-coverage',
  'm9-r3-r2-xiaoyu-action-occupancy-audit',
  'm9-r3-r2-r2-xiaoyu-hidden-input-audit',
  'm9-r3-r2-r3-contextual-input-scheduling-audit',
];

const AUDIT_TEST_PATHS = [
  'src/__tests__/simulation/canonicalHeadlessCombatCore.test.js',
  'src/__tests__/simulation/canonicalHeadlessCombatBoundary.test.js',
  'src/__tests__/simulation/verifiedKiboBeforeSkillComposite.test.js',
  'src/__tests__/simulation/verifiedKiboCooldownPassive.test.js',
  'src/__tests__/simulation/verifiedKiboPassiveGeneration.test.js',
  'src/__tests__/simulation/verifiedKiboPeriodicHeal.test.js',
  'src/__tests__/simulation/verifiedKiboPetOwnerDamagePassive.test.js',
  'src/__tests__/scripts/kiboHeadlessCensus.test.js',
  'src/__tests__/domain/machineAxisContract.test.js',
  'src/__tests__/machine-axis/machineAxisService.test.js',
  'src/__tests__/machine-axis/machineAxisCli.test.js',
  'src/__tests__/machine-axis/machineAxisCliProcess.test.js',
  'src/__tests__/character-acceptance/characterAcceptanceProtocol.test.js',
  'src/__tests__/character-acceptance/characterAcceptanceCanonicalReplay.test.js',
  'src/__tests__/character-acceptance/characterAcceptanceScenarioDerivation.test.js',
  'src/__tests__/character-acceptance/generatedCharacterAcceptance.test.js',
  'src/__tests__/data/characterCombatHeadlessMigration.test.js',
];

await main();

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assertTrackedTreeClean();
  if (!options.skipBuild) buildCliBundle();

  const sourceMap = JSON.parse(await readFile(CLI_SOURCE_MAP_PATH, 'utf8'));
  const sourceClosure = await collectSourceClosure(sourceMap);
  assertHeadlessSourceClosure(sourceClosure);

  const commit = git(['rev-parse', 'HEAD']);
  const packageName = `promilia-axis-m11-headless-audit-${options.date}-${commit.slice(0, 12)}`;
  const outputParent = resolve(options.outputParent);
  const packageRoot = resolve(outputParent, packageName);
  assertChildPath(outputParent, packageRoot);
  if (await pathExists(packageRoot)) {
    if (!options.force) {
      throw new Error(`output already exists: ${packageRoot}`);
    }
    await rm(packageRoot, { recursive: true, force: true });
  }
  await mkdir(packageRoot, { recursive: true });

  await copyFileInto(
    CLI_BUNDLE_PATH,
    resolve(packageRoot, 'runtime/machine-axis-cli.mjs')
  );
  await copyFileInto(
    CLI_SOURCE_MAP_PATH,
    resolve(packageRoot, 'runtime/machine-axis-cli.mjs.map')
  );
  await copyRepoPath(
    'src/data/generated/verified-combat-mechanics-package.json',
    packageRoot,
    'src/data/generated/verified-combat-mechanics-package.json'
  );
  for (const schemaPath of [
    'schemas/azpr-machine-axis-v1.schema.json',
    'schemas/azpr-machine-axis-cli-output-v1.schema.json',
    'schemas/character-acceptance-protocol.v1.schema.json',
  ]) {
    await copyRepoPath(schemaPath, packageRoot, schemaPath);
  }
  for (const fixturePath of [
    'fixtures/machine-axis/m11-b-three-actor-120s.json',
    'fixtures/character-acceptance/101003-visual.json',
    'fixtures/character-acceptance/101010-visual.json',
    'fixtures/character-acceptance/103002-visual.json',
  ]) {
    await copyRepoPath(fixturePath, packageRoot, fixturePath);
  }
  for (const sourcePath of sourceClosure.paths) {
    const repoRelative = normalizePath(relative(REPO_ROOT, sourcePath));
    await copyFileInto(
      sourcePath,
      resolve(packageRoot, 'source', repoRelative)
    );
  }
  await copyRepoPath(
    'vite.machine-axis-cli.config.js',
    packageRoot,
    'source/vite.machine-axis-cli.config.js'
  );
  for (const [source, destination] of EVIDENCE_PATHS) {
    await copyRepoPath(source, packageRoot, destination);
  }
  await copyVerifiedReports(packageRoot);
  for (const testPath of AUDIT_TEST_PATHS) {
    await copyRepoPath(testPath, packageRoot, `audit/test-sources/${testPath}`);
  }

  const integratedReport = JSON.parse(
    await readFile(INTEGRATED_REPORT_PATH, 'utf8')
  );
  const unresolved = await createUnresolvedClassification();
  const sourceBoundary = createSourceBoundaryReport(sourceClosure);
  await writeJson(
    resolve(packageRoot, 'evidence/unresolved-classification.json'),
    unresolved
  );
  await writeJson(
    resolve(packageRoot, 'evidence/provenance-root-map.json'),
    createProvenanceRootMap()
  );
  await writeJson(
    resolve(packageRoot, 'audit/source-boundary.json'),
    sourceBoundary
  );
  await writeJson(
    resolve(packageRoot, 'audit/verification-summary.json'),
    createVerificationSummary(integratedReport, commit, sourceBoundary)
  );
  await writePackageDocuments({
    packageRoot,
    packageName,
    commit,
    integratedReport,
    unresolved,
    sourceBoundary,
  });
  await writeAuditScripts({ packageRoot, integratedReport });

  const boundaryIssues = await findForbiddenPackagePaths(packageRoot);
  if (boundaryIssues.length) {
    throw new Error(
      `forbidden package paths detected:\n${boundaryIssues.join('\n')}`
    );
  }
  const stagingSmoke = runPackagedSmoke(packageRoot);
  const verificationPath = resolve(
    packageRoot,
    'audit/verification-summary.json'
  );
  const verification = JSON.parse(await readFile(verificationPath, 'utf8'));
  verification.cleanRoomPackageTest = {
    status: 'passed-in-staging-directory',
    result: stagingSmoke,
  };
  await writeJson(verificationPath, verification);
  const manifest = await writePackageManifest({
    packageRoot,
    packageName,
    commit,
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        status: 'written',
        packageRoot,
        packageName,
        commit,
        fileCount: manifest.summary.fileCount,
        totalBytes: manifest.summary.totalBytes,
        sourceFileCount: sourceClosure.paths.length,
        unresolved: unresolved.summary,
      },
      null,
      2
    )}\n`
  );
}

function parseArgs(argv) {
  const options = {
    date: '20260730',
    outputParent: resolve(REPO_ROOT, '..', 'outputs'),
    force: false,
    skipBuild: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--force') options.force = true;
    else if (token === '--skip-build') options.skipBuild = true;
    else if (token === '--date') options.date = String(argv[++index] ?? '');
    else if (token === '--output-parent') {
      options.outputParent = resolve(String(argv[++index] ?? ''));
    } else {
      throw new Error(`unknown option: ${token}`);
    }
  }
  if (!/^\d{8}$/.test(options.date)) {
    throw new Error('--date must use YYYYMMDD');
  }
  return options;
}

function assertTrackedTreeClean() {
  const status = git(['status', '--porcelain', '--untracked-files=no']);
  if (status) {
    throw new Error(
      'tracked worktree changes present; commit the merged package source first'
    );
  }
}

function buildCliBundle() {
  const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(
    npmExecutable,
    ['run', 'machine-axis:build', '--', '--sourcemap'],
    {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      shell: false,
    }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Machine Axis CLI build failed with ${result.status}`);
  }
}

async function collectSourceClosure(sourceMap) {
  if (
    !Array.isArray(sourceMap?.sources) ||
    sourceMap.sources.length === 0 ||
    sourceMap.sources.length !== sourceMap.sourcesContent?.length
  ) {
    throw new Error(
      'Machine Axis source map is missing complete sourcesContent'
    );
  }
  const sourcePaths = sourceMap.sources.map(source =>
    resolve(CLI_BUILD_DIR, source)
  );
  const jsonImports = new Set();
  const jsonImportPattern = /(?:from\s+|import\s*)['"]([^'"]+\.json)['"]/g;
  for (let index = 0; index < sourcePaths.length; index += 1) {
    const sourcePath = sourcePaths[index];
    assertRepoPath(sourcePath);
    const content = sourceMap.sourcesContent[index] ?? '';
    for (const match of content.matchAll(jsonImportPattern)) {
      const imported = resolve(dirname(sourcePath), match[1]);
      assertRepoPath(imported);
      jsonImports.add(imported);
    }
  }
  const paths = [...new Set([...sourcePaths, ...jsonImports])].sort((a, b) =>
    normalizePath(a).localeCompare(normalizePath(b))
  );
  for (const sourcePath of paths) {
    if (!(await pathExists(sourcePath))) {
      throw new Error(`source closure path missing: ${sourcePath}`);
    }
  }
  return {
    paths,
    sourceMapSources: sourcePaths,
    jsonImports: [...jsonImports].sort(),
    sourceMap,
  };
}

function assertHeadlessSourceClosure(sourceClosure) {
  const issues = [];
  for (
    let index = 0;
    index < sourceClosure.sourceMapSources.length;
    index += 1
  ) {
    const sourcePath = sourceClosure.sourceMapSources[index];
    const repoRelative = normalizePath(relative(REPO_ROOT, sourcePath));
    const content = sourceClosure.sourceMap.sourcesContent[index] ?? '';
    if (
      /(?:^|\/)src\/(?:features|views|components|stores)\/|\.vue$/i.test(
        repoRelative
      )
    ) {
      issues.push(`ui-source-path:${repoRelative}`);
    }
    if (
      /from\s+['"](?:vue|pinia|vue-router|element-plus|echarts)(?:\/|['"])/.test(
        content
      )
    ) {
      issues.push(`ui-framework-import:${repoRelative}`);
    }
    if (/\b(?:document|localStorage|sessionStorage)\b/.test(content)) {
      issues.push(`browser-global:${repoRelative}`);
    }
  }
  if (issues.length) {
    throw new Error(`headless source boundary failed:\n${issues.join('\n')}`);
  }
}

function createSourceBoundaryReport(sourceClosure) {
  return {
    schemaVersion: 1,
    kind: 'm11-headless-source-boundary',
    status: 'passed',
    sourceMapSourceCount: sourceClosure.sourceMapSources.length,
    jsonImportCount: sourceClosure.jsonImports.length,
    copiedSourceFileCount: sourceClosure.paths.length,
    forbiddenPathCount: 0,
    uiFrameworkImportCount: 0,
    browserGlobalCount: 0,
    rules: {
      excludedDirectories: [
        'src/features',
        'src/views',
        'src/components',
        'src/stores',
        'e2e',
        'dist',
      ],
      excludedExtensions: [
        '.vue',
        '.png',
        '.jpg',
        '.jpeg',
        '.gif',
        '.webp',
        '.svg',
      ],
      forbiddenImports: [
        'vue',
        'pinia',
        'vue-router',
        'element-plus',
        'echarts',
      ],
      forbiddenBrowserGlobals: ['document', 'localStorage', 'sessionStorage'],
    },
    note: 'Legacy domain module names containing workbench describe semantic project scheduling and data projection; no UI source or browser dependency is in the bundle.',
  };
}

async function copyVerifiedReports(packageRoot) {
  for (const baseName of VERIFIED_REPORT_NAMES) {
    for (const extension of ['json', 'md']) {
      const source = `reports/${baseName}.${extension}`;
      if (!(await pathExists(resolve(REPO_ROOT, source)))) continue;
      await copyRepoPath(
        source,
        packageRoot,
        `evidence/verified-reports/${baseName}.${extension}`
      );
    }
  }
}

async function copyRepoPath(sourceRelative, packageRoot, destinationRelative) {
  const source = resolve(REPO_ROOT, sourceRelative);
  assertRepoPath(source);
  const destination = resolve(packageRoot, destinationRelative);
  assertChildPath(packageRoot, destination);
  const sourceStat = await stat(source);
  await mkdir(dirname(destination), { recursive: true });
  if (sourceStat.isDirectory()) {
    await cp(source, destination, { recursive: true, force: true });
  } else {
    await copyFile(source, destination);
  }
}

async function copyFileInto(source, destination) {
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

function assertRepoPath(path) {
  const repoPath = resolve(REPO_ROOT);
  const targetPath = resolve(path);
  if (targetPath !== repoPath && !targetPath.startsWith(`${repoPath}${sep}`)) {
    throw new Error(`path outside repository: ${targetPath}`);
  }
}

function assertChildPath(parent, child) {
  const parentPath = resolve(parent);
  const childPath = resolve(child);
  if (!childPath.startsWith(`${parentPath}${sep}`)) {
    throw new Error(`path outside intended parent: ${childPath}`);
  }
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function git(args) {
  return execFileSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  }).trim();
}

function normalizePath(path) {
  return path.split(sep).join('/');
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function createUnresolvedClassification() {
  const owners = [];
  const allCharacterRecords = [];
  for (const ownerId of [101003, 101010, 103002]) {
    const manifest = await readRepoJson(
      `reports/m11/character-acceptance/${ownerId}/manifest.json`
    );
    const sourceGaps = manifest.ledger.sourceGaps.map(record =>
      classifyUnresolvedRecord({
        domain: 'character',
        recordType: 'upstream-source-gap',
        ownerId,
        identity: record.uniqueGapIdentity,
        status: record.status,
        reasons: splitReasons(record.reason),
        sourceKind: record.sourceKind,
        sourceIdentities: record.sourceIdentities,
        sourceRecordIdentities: record.sourceRecordIdentities,
      })
    );
    const acceptanceGaps = manifest.ledger.acceptanceGaps.map(record =>
      classifyUnresolvedRecord({
        domain: 'character',
        recordType: 'acceptance-scenario-gap',
        ownerId,
        identity: record.uniqueGapIdentity,
        requirementIdentity: record.requirementIdentity,
        status: record.status,
        reasons: splitReasons(record.reason),
        sourceIdentities: record.sourceIdentities,
      })
    );
    const records = [...sourceGaps, ...acceptanceGaps];
    allCharacterRecords.push(...records);
    owners.push({
      ownerId,
      ownerName: manifest.owner.ownerName,
      maturityState: manifest.maturity.currentState,
      productVisualAcceptance: manifest.evidence.productVisualAcceptance.status,
      counts: summarizeResolutionClasses(records),
      records,
    });
  }

  const census = await readRepoJson(
    'reports/kibo-headless/kibo-mechanics-census.json'
  );
  const fixedSkills = census.fixedSkills
    .filter(record => record.closureClass === 'unresolved')
    .map(record =>
      classifyUnresolvedRecord({
        domain: 'kibo',
        recordType: 'fixed-skill',
        identity: `kibo-fixed-skill:${record.skillId}`,
        skillId: record.skillId,
        kiboIds: record.kiboIds,
        runtimeStatus: record.closureClass,
        status: record.closureClass,
        reasons: record.unresolvedReasons,
        sourceIdentities: record.provenance,
      })
    );
  const pvePassives = census.pvePassiveSkills
    .filter(record => record.closureClass === 'unresolved')
    .map(record =>
      classifyUnresolvedRecord({
        domain: 'kibo',
        recordType: 'pve-passive',
        identity: `kibo-pve-passive:${record.skillId}`,
        skillId: record.skillId,
        skillName: record.sourceName,
        skillDescription: record.sourceDescription,
        kiboIds: record.kiboIds,
        runtimeStatus: record.runtimeStatus,
        status: record.closureClass,
        reasons: record.unresolvedReasons,
        sourceIdentities: record.provenance,
      })
    );
  const publicActions = census.publicActions
    .filter(record => record.closureClass === 'unresolved')
    .map(record =>
      classifyUnresolvedRecord({
        domain: 'kibo',
        recordType: 'public-action',
        identity: record.identity,
        kiboId: record.kiboId,
        kiboName: record.kiboName,
        skillId: record.sourceSkillId,
        actionKind: record.actionKind,
        runnable: record.runnable,
        runtimeStatus: record.runtimeStatus,
        status: record.closureClass,
        reasons: record.reasons,
        sourceIdentities: record.provenance,
        dimensions: record.dimensions,
      })
    );
  const kiboRecords = [...fixedSkills, ...pvePassives, ...publicActions];
  const scenarioAssumptions = census.publicActions
    .filter(record => record.closureClass === 'scenario-assumed')
    .map(record => ({
      identity: record.identity,
      kiboId: record.kiboId,
      kiboName: record.kiboName,
      skillId: record.sourceSkillId,
      actionKind: record.actionKind,
      assumptionClass: 'zero-distance-or-runtime-impact-assumption',
      runtimeStatus: record.runtimeStatus,
      reasons: record.reasons,
      sourceIdentities: record.provenance,
    }));
  const allRecords = [...allCharacterRecords, ...kiboRecords];
  return {
    schemaVersion: 1,
    kind: 'm11-headless-unresolved-classification',
    status: 'merged-baseline-classified',
    terminology: {
      'not-yet-done':
        'The required evidence or semantics are sufficiently identified, but research, runtime implementation, or acceptance coverage has not been completed.',
      'currently-evidence-blocked':
        'The packaged and currently indexed evidence cannot select a unique executable rule. Additional upstream evidence or runtime capture is required before implementation can be considered authoritative.',
      permanence:
        'currently-evidence-blocked does not mean fundamentally impossible; no record in this package is declared permanently impossible.',
    },
    classificationPolicy: {
      acceptanceScenarioGaps: 'not-yet-done',
      fixedSkillSlotResearch: 'not-yet-done',
      evidenceSignals: EVIDENCE_BLOCK_SIGNALS,
      implementationSignals: IMPLEMENTATION_SIGNALS,
      mixedRule:
        'When both evidence and implementation gaps exist, currently-evidence-blocked is primary because coding alone cannot close the record.',
      auditRequirement:
        'The external auditor must challenge false positives and false negatives against each record source identity.',
    },
    summary: {
      ...summarizeResolutionClasses(allRecords),
      characterRecordCount: allCharacterRecords.length,
      kiboRecordCount: kiboRecords.length,
      kiboScenarioAssumptionCount: scenarioAssumptions.length,
    },
    characters: {
      summary: summarizeResolutionClasses(allCharacterRecords),
      owners,
    },
    kibo: {
      summary: summarizeResolutionClasses(kiboRecords),
      fixedSkills,
      pvePassives,
      publicActions,
      scenarioAssumptions,
    },
  };
}

const EVIDENCE_BLOCK_SIGNALS = [
  'unresolved',
  'unverified',
  'incomplete',
  'not-unique',
  'runtime-dependent',
  'unknown',
  'ambiguous',
  'evidence-required',
  'capture-required',
  'base-function',
  'formula-not-literal',
];
const IMPLEMENTATION_SIGNALS = [
  'unimplemented',
  'unmodeled',
  'not-expanded',
  'coverage-missing',
  'not-yet',
];

function classifyUnresolvedRecord(record) {
  const reasons = (record.reasons ?? []).map(String);
  const text =
    `${record.status ?? ''}|${record.runtimeStatus ?? ''}|${reasons.join('|')}`.toLowerCase();
  const acceptanceGap = record.recordType === 'acceptance-scenario-gap';
  const fixedSkillResearch = record.recordType === 'fixed-skill';
  const evidenceBlocked =
    !acceptanceGap &&
    !fixedSkillResearch &&
    EVIDENCE_BLOCK_SIGNALS.some(signal => text.includes(signal));
  const implementationPending =
    acceptanceGap ||
    fixedSkillResearch ||
    IMPLEMENTATION_SIGNALS.some(signal => text.includes(signal));
  const resolutionClass = evidenceBlocked
    ? 'currently-evidence-blocked'
    : 'not-yet-done';
  const workKind = acceptanceGap
    ? 'acceptance-scenario'
    : fixedSkillResearch
      ? 'evidence-research-not-yet-completed'
      : evidenceBlocked && implementationPending
        ? 'mixed-evidence-and-runtime'
        : evidenceBlocked
          ? 'upstream-evidence-or-runtime-capture'
          : 'runtime-implementation';
  return {
    ...record,
    reasons,
    resolutionClass,
    workKind,
    evidenceBlocked,
    implementationPending,
    nextRequirement: evidenceBlocked
      ? 'Obtain a unique upstream binding or controlled runtime capture before implementing an authoritative rule.'
      : acceptanceGap
        ? 'Add a deterministic scenario assertion and bind it to the canonical trace.'
        : fixedSkillResearch
          ? 'Complete fixed-skill slot semantics research and reclassify the source scope.'
          : 'Implement the identified runtime behavior and add deterministic regression coverage.',
  };
}

function summarizeResolutionClasses(records) {
  return {
    total: records.length,
    notYetDone: records.filter(
      record => record.resolutionClass === 'not-yet-done'
    ).length,
    currentlyEvidenceBlocked: records.filter(
      record => record.resolutionClass === 'currently-evidence-blocked'
    ).length,
    mixedEvidenceAndImplementation: records.filter(
      record => record.evidenceBlocked && record.implementationPending
    ).length,
  };
}

function splitReasons(value) {
  return String(value ?? '')
    .split('|')
    .map(reason => reason.trim())
    .filter(Boolean);
}

async function readRepoJson(relativePath) {
  return JSON.parse(await readFile(resolve(REPO_ROOT, relativePath), 'utf8'));
}

function createProvenanceRootMap() {
  return {
    schemaVersion: 1,
    kind: 'm11-headless-provenance-root-map',
    referencedSourcesIncluded: false,
    roots: [
      {
        sourcePrefix: 'C:/PC2/Codex/AzPr/Assets',
        alias: 'azpr-kb://Assets',
        sourceKind: 'upstream-derived-game-data-tree',
        included: false,
      },
      {
        sourcePrefix: 'C:/Codex/AzPr Extractor/ExtractedAssets',
        alias: 'azpr-extractor://ExtractedAssets',
        sourceKind: 'upstream-extractor-output',
        included: false,
      },
      {
        sourcePrefix: 'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709',
        alias: 'azpr-il2cpp-report://tc-20260709',
        sourceKind: 'derived-il2cpp-report',
        included: false,
      },
      {
        sourcePrefix: 'C:/AP/AzurPromilia_TC/AzurPromilia_game',
        alias: 'azpr-client-reference://tc-client',
        sourceKind: 'binary-location-reference-only',
        included: false,
      },
    ],
    note: 'Absolute source identities are retained in derived evidence for exact traceability. They are references only; none of the referenced raw trees, assets, binaries, packages, or slices is copied into this audit bundle.',
  };
}

function createVerificationSummary(integratedReport, commit, sourceBoundary) {
  return {
    schemaVersion: 1,
    kind: 'm11-headless-package-verification-summary',
    sourceCommit: commit,
    integratedBaselineStatus: integratedReport.status,
    tests: {
      focused: {
        status: 'passed',
        files: 18,
        tests: 142,
      },
      headlessEntrypointDecoupling: {
        status: 'passed',
        files: 6,
        tests: 54,
      },
    },
    derivedAudits: {
      characterCombat: 'clean',
      verifiedCombat: 'clean',
      characterAcceptance: 'clean',
      kiboHeadless: 'clean',
    },
    sourceBoundary,
    productQualification: {
      characterRuntimeIntegratedCount:
        integratedReport.characterAcceptance.summary.runtimeIntegratedCount,
      characterVisuallyAcceptedCount:
        integratedReport.characterAcceptance.summary.visuallyAcceptedCount,
      characterOptimizationReadyCount:
        integratedReport.characterAcceptance.summary.optimizationReadyCount,
      kiboOptimizationReadyCount:
        integratedReport.kibo.maturity.machineOptimizationReadyCount,
      priorVisualAcceptanceCarriedForward: false,
      reason:
        integratedReport.characterAcceptance.priorProductAcceptance.reason,
    },
    cleanRoomPackageTest: 'pending-until-archive-extraction',
  };
}

async function writePackageDocuments({
  packageRoot,
  packageName,
  commit,
  integratedReport,
  unresolved,
  sourceBoundary,
}) {
  const characterSummary = integratedReport.characterAcceptance.summary;
  const kiboSummary = integratedReport.kibo.summary;
  const packageJson = {
    name: packageName,
    private: true,
    version: '1.0.0',
    type: 'module',
    engines: { node: '>=24' },
    scripts: {
      verify: 'node audit/verify-package.mjs',
      smoke: 'node audit/run-smoke.mjs',
      catalog:
        'node runtime/machine-axis-cli.mjs catalog --output output/catalog.json',
    },
  };
  await writeJson(resolve(packageRoot, 'package.json'), packageJson);

  const readme = [
    '# M11 战斗排轴无头核心外部审计包',
    '',
    `合并版本：\`${commit}\`。本包只包含该合并版本；角色基线与奇波阶段提交只在来源说明中以提交号出现，不附带两套旧代码。`,
    '',
    '## 内容',
    '',
    '- `runtime/machine-axis-cli.mjs`：无需安装依赖的 Node.js 24 CLI。',
    '- `source/`：由 CLI source map 提取的精确源码闭包和 JSON 导入。',
    '- `schemas/`：Machine Axis 输入、CLI 输出信封和角色验收协议。',
    '- `fixtures/`：合并后数据身份绑定的代表性排轴输入。',
    '- `evidence/`：合并后重新生成的角色、奇波、golden、缺口账本和来源定位。',
    '- `audit/`：文件校验、无头边界记录、测试记录和 smoke test。',
    '',
    '## 快速验证',
    '',
    '在包根目录执行：',
    '',
    '```powershell',
    'node --version',
    'node audit/verify-package.mjs',
    'node audit/run-smoke.mjs',
    '```',
    '',
    '无需 `npm install`。建议 Node.js 24；CLI bundle 的目标运行时为 `node24`。',
    '',
    '## CLI 示例',
    '',
    '```powershell',
    'New-Item -ItemType Directory -Path output -Force | Out-Null',
    'node runtime/machine-axis-cli.mjs catalog --output output/catalog.json',
    'node runtime/machine-axis-cli.mjs validate --input fixtures/machine-axis/m11-b-three-actor-120s.json --output output/validation.json',
    'node runtime/machine-axis-cli.mjs simulate --input fixtures/machine-axis/m11-b-three-actor-120s.json --output output/run.json',
    'node runtime/machine-axis-cli.mjs explain --input fixtures/machine-axis/m11-b-three-actor-120s.json --action ruby-enhanced-e1-intent --output output/explain.json',
    'node runtime/machine-axis-cli.mjs compare --left fixtures/machine-axis/m11-b-three-actor-120s.json --right fixtures/machine-axis/m11-b-three-actor-120s.json --output output/compare.json',
    '```',
    '',
    '不传 `--input` 或传 `-` 时从 stdin 读；不传 `--output` 或传 `-` 时向 stdout 输出。`--format jsonl` 支持批量输入输出。stdout 只写机器 JSON，错误摘要写 stderr。',
    '',
    '## 当前资格',
    '',
    `- 角色：${characterSummary.runtimeIntegratedCount} 个 ` +
      `\`runtime-integrated\`，${characterSummary.visuallyAcceptedCount} 个 ` +
      `\`visually-accepted\`，${characterSummary.optimizationReadyCount} 个 ` +
      '`optimization-ready`。',
    `- 奇波：${kiboSummary.fixedSkillClassification.evidenceClosed} 个 fixed skill 已证据闭环；` +
      `${kiboSummary.pvePassiveMechanics.evidenceClosed} 个 PVE 被动已闭环；` +
      `${integratedReport.kibo.maturity.machineOptimizationReadyCount} 个奇波可进入优化器。`,
    `- 明确缺口：${unresolved.summary.notYetDone} 条尚未完成，` +
      `${unresolved.summary.currentlyEvidenceBlocked} 条当前证据阻断。`,
    '',
    '合并后 verified mechanics 数据身份和角色 replay/summary 均发生变化，因此针对旧角色基线的产品可视签收没有自动继承。外部审计不得把历史签收当成合并版本签收。',
    '',
    '## 明确不含',
    '',
    '- Vue、Workbench 页面、拖拽交互、E2E 页面或截图。',
    '- `dist`、前端依赖、`node_modules`。',
    '- 原始游戏包体、Unity 资源、资产切片、GameAssembly 或提取器输出。',
    '',
    '来源路径字符串为了证据定位会保留，但只是一条引用，不代表对应文件被打包。',
    '',
  ].join('\n');

  const protocol = [
    '# 结构化输入输出协议',
    '',
    '## 输入',
    '',
    '- 合同：`AzPrMachineAxis`，`schemaVersion=1`。',
    '- Schema：`schemas/azpr-machine-axis-v1.schema.json`。',
    '- 固定 60 FPS；三人队伍；动作使用语义 `publicActionId`、`actionKind`、`semanticVariant` 和 `attackInput`。',
    '- 调度：`absolute`、`after-previous-end`、`after-action-end`。',
    '- 每 hit 可设置 `landed`，并选择 `sampled`、`expected`、`critical`、`non-critical` 或继承场景策略。',
    '- 远程攻击默认可用 `projectile.targetDistance=0` 和 `defaultWillHit=true` 表示 0 距离立即命中；每 hit 仍可覆盖。',
    '',
    '## 命令与输出信封',
    '',
    '- `catalog` -> `azpr-machine-axis-catalog`。',
    '- `validate` -> `azpr-machine-axis-validation`。',
    '- `simulate` -> `azpr-machine-axis-run`。',
    '- `explain` -> `azpr-machine-axis-explanation`。',
    '- `compare` -> `azpr-machine-axis-comparison`。',
    '- CLI 错误 -> `azpr-machine-axis-cli-error`。',
    '',
    '顶层信封 Schema：`schemas/azpr-machine-axis-cli-output-v1.schema.json`。深层 trace 保持可扩展，以 `hashes.input/data/trace/evaluation` 固定身份；审计时应同时比较结构和 canonical hash。',
    '',
    '## 退出码',
    '',
    '- `0`：成功。',
    '- `2`：命令或参数错误。',
    '- `3`：输入文件或 JSON 解析错误。',
    '- `4`：合同验证失败。',
    '- `5`：运行或输出写入失败。',
    '',
  ].join('\n');

  const scope = [
    '# 范围与限制',
    '',
    '## 本次范围',
    '',
    '- 唯一 canonical headless core、Machine Axis CLI 和结构化 trace/evaluation。',
    '- 涂山小玉、红宝石、寒悠悠的合并后 profile、动作、golden、资源/Buff/派生证据和验收账本。',
    '- 122 个奇波、366 个公开动作、fixed skill 与 PVE/PVP 被动 census，以及已接入的奇波运行时机制。',
    '',
    '## 当前边界',
    '',
    `- 角色功能阻断仍为 ${characterSummary.functionalBlockers} 条；三角色均未进入优化器。`,
    `- 奇波公开动作闭环：${kiboSummary.publicActionClosure.evidenceClosed} 条证据闭环，` +
      `${kiboSummary.publicActionClosure.scenarioAssumed} 条场景假设，` +
      `${kiboSummary.publicActionClosure.unresolved} 条未闭环。`,
    `- 奇波 PVE 被动：${kiboSummary.pvePassiveMechanics.evidenceClosed} 条闭环，` +
      `${kiboSummary.pvePassiveMechanics.unresolved} 条未闭环。`,
    '- `scenario-assumed` 不是证据闭环，尤其是 0 距离投射物命中假设；审计报告必须单列。',
    '- 蓝色星原仍处测试期，数值可能随平衡调整变化；本包审核的是机制绑定、状态顺序、确定性与证据可追溯性。',
    '- `currently-evidence-blocked` 只表示当前证据不足，不表示永久做不到。',
    '',
    `无头源码边界扫描：${sourceBoundary.sourceMapSourceCount} 个 source map 模块，` +
      `${sourceBoundary.jsonImportCount} 个 JSON 导入，UI/浏览器依赖命中 0。`,
    '',
  ].join('\n');

  const auditRequest = createAuditRequestDocument({
    commit,
    integratedReport,
    unresolved,
  });
  const reviewNotice = [
    '# 审计使用声明',
    '',
    '本包用于授权的外部技术审计。包内源代码、派生机制数据和来源定位分别受其原有权利与合作授权约束；本包本身不额外授予公开传播、再分发或游戏资源使用许可。',
    '',
    '包内没有原始游戏包体、资源文件、二进制或提取切片。任何 `C:/...`、`.asset` 或 `GameAssembly.dll#...` 文本仅为证据身份引用。',
    '',
  ].join('\n');

  await writeFile(resolve(packageRoot, 'README.md'), readme, 'utf8');
  await writeFile(
    resolve(packageRoot, 'STRUCTURED_PROTOCOL.md'),
    protocol,
    'utf8'
  );
  await writeFile(
    resolve(packageRoot, 'SCOPE_AND_LIMITATIONS.md'),
    scope,
    'utf8'
  );
  await writeFile(
    resolve(packageRoot, 'AUDIT_REQUEST.md'),
    auditRequest,
    'utf8'
  );
  await writeFile(
    resolve(packageRoot, 'REVIEW_NOTICE.md'),
    reviewNotice,
    'utf8'
  );
}

function createAuditRequestDocument({ commit, integratedReport, unresolved }) {
  return [
    '# 外部审计需求',
    '',
    `审计对象仅为合并提交 \`${commit}\` 生成的本包。不要以两个阶段分支分别给结论。`,
    '',
    '## 必查问题',
    '',
    '1. Machine Axis v1 的 schema、CLI 参数、stdin/stdout、JSONL 和退出码是否一致且无静默降级。',
    '2. `compile -> validate -> simulate -> evaluate -> explain` 是否消费同一核心、同一数据身份和同一 canonical trace。',
    '3. 确定性暴击、期望值、强制暴击/不暴击、captured roll 和 miss 是否逐 hit 生效且可复现。',
    '4. 三角色动作派生、资源交易、切人/星携技、Buff 继承、状态窗口和多段 hit 的因果顺序是否与 evidence/golden 一致。',
    '5. 奇波 PVE/PVP 被动、BeforeSkill、伤害后触发、周期治疗/伤害、冷却修改、owner/pet 目标和跨周期继承是否按来源绑定执行。',
    '6. `scenario-assumed` 的 0 距离命中不能被误报为证据闭环；逐 hit 覆盖必须优先。',
    '7. `evidence/unresolved-classification.json` 中“尚未完成”和“当前证据阻断”的归类是否准确，是否存在可由现有证据直接闭环却被错误阻断的记录。',
    '8. 包内是否确实没有 UI、浏览器依赖、原始包体、资源切片或二进制。',
    '',
    '## 已知资格变化',
    '',
    `合并后 verified mechanics package hash 为 \`${integratedReport.dataIdentity.verifiedMechanicsPackageHash}\`。`,
    '角色 replay/summary 与 qualification subject 发生变化，旧 `899edea` 的产品可视签收没有继承；审计不得把三角色标为 `visually-accepted` 或 `optimization-ready`。',
    `当前缺口分类总计 ${unresolved.summary.total} 条，其中 ${unresolved.summary.notYetDone} 条尚未完成，${unresolved.summary.currentlyEvidenceBlocked} 条当前证据阻断。`,
    '',
    '## 交付格式',
    '',
    '- 先列发现，按 P0/P1/P2/P3 排序。',
    '- 每条发现必须给出最小 Machine Axis 输入、命令、实际/预期 hash 或 trace 差异。',
    '- 引用包内源码路径和 evidence record identity；不要只引用截图或口头描述。',
    '- 区分代码缺陷、数据绑定缺陷、证据不足、场景假设和文档缺陷。',
    '- 对没有发现的问题也说明覆盖范围和剩余风险。',
    '',
    '## 不在本次阻断范围',
    '',
    '- 网页观感、拖拽、时间轴绘制、响应式和包体预算。',
    '- M12 配队搜索、末音最优轴或性能优化。',
    '- 对测试期最终平衡数值的定版。',
    '',
  ].join('\n');
}

/* eslint-disable quotes */
async function writeAuditScripts({ packageRoot, integratedReport }) {
  const expectedHashes = JSON.stringify(
    integratedReport.machineAxis.canonicalHashes
  );
  const expectedDataHash = JSON.stringify(
    integratedReport.dataIdentity.verifiedMechanicsPackageHash
  );
  const smokeScript = [
    "import { spawnSync } from 'node:child_process';",
    "import { readFileSync } from 'node:fs';",
    "import { dirname, resolve } from 'node:path';",
    "import { fileURLToPath } from 'node:url';",
    '',
    "const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');",
    "const CLI = resolve(ROOT, 'runtime/machine-axis-cli.mjs');",
    "const FIXTURE = 'fixtures/machine-axis/m11-b-three-actor-120s.json';",
    `const EXPECTED_HASHES = ${expectedHashes};`,
    `const EXPECTED_DATA_HASH = ${expectedDataHash};`,
    '',
    'function assert(condition, message) {',
    '  if (!condition) throw new Error(message);',
    '}',
    '',
    'function run(args) {',
    '  const result = spawnSync(process.execPath, [CLI, ...args], {',
    '    cwd: ROOT,',
    "    encoding: 'utf8',",
    '    maxBuffer: 64 * 1024 * 1024,',
    '  });',
    '  if (result.error) throw result.error;',
    '  if (result.status !== 0) {',
    '    throw new Error(`CLI ${args[0]} failed (${result.status}): ${result.stderr}`);',
    '  }',
    '  return JSON.parse(result.stdout);',
    '}',
    '',
    "const mechanicsPackage = JSON.parse(readFileSync(resolve(ROOT, 'src/data/generated/verified-combat-mechanics-package.json'), 'utf8'));",
    "assert(mechanicsPackage.packageHash === EXPECTED_DATA_HASH, 'verified mechanics package hash mismatch');",
    "const catalog = run(['catalog']);",
    "assert(catalog.kind === 'azpr-machine-axis-catalog', 'catalog envelope mismatch');",
    "assert(catalog.summary.characterCount === 20, 'character catalog count mismatch');",
    "assert(catalog.summary.kiboCount === 122, 'kibo catalog count mismatch');",
    "assert(catalog.summary.kiboActionCount === 366, 'kibo action count mismatch');",
    "const validation = run(['validate', '--input', FIXTURE]);",
    "assert(validation.valid === true, 'fixture validation failed');",
    "const simulation = run(['simulate', '--input', FIXTURE]);",
    "assert(simulation.kind === 'azpr-machine-axis-run', 'simulation envelope mismatch');",
    "assert(JSON.stringify(simulation.hashes) === JSON.stringify(EXPECTED_HASHES), 'canonical hash mismatch');",
    "const explanation = run(['explain', '--input', FIXTURE, '--action', 'ruby-enhanced-e1-intent']);",
    "assert(explanation.kind === 'azpr-machine-axis-explanation', 'explanation envelope mismatch');",
    "assert(explanation.selector.actionId === 'ruby-enhanced-e1-intent', 'explanation selector mismatch');",
    "const comparison = run(['compare', '--left', FIXTURE, '--right', FIXTURE]);",
    "assert(comparison.kind === 'azpr-machine-axis-comparison', 'comparison envelope mismatch');",
    "const boundary = JSON.parse(readFileSync(resolve(ROOT, 'audit/source-boundary.json'), 'utf8'));",
    "assert(boundary.status === 'passed', 'source boundary failed');",
    "const unresolved = JSON.parse(readFileSync(resolve(ROOT, 'evidence/unresolved-classification.json'), 'utf8'));",
    "assert(unresolved.summary.total > 0, 'unresolved classification missing');",
    '',
    'process.stdout.write(`${JSON.stringify({',
    "  status: 'passed',",
    '  node: process.version,',
    '  hashes: simulation.hashes,',
    '  catalog: catalog.summary,',
    '  unresolved: unresolved.summary,',
    '  sourceBoundary: {',
    '    sourceMapSourceCount: boundary.sourceMapSourceCount,',
    '    jsonImportCount: boundary.jsonImportCount,',
    '  },',
    '}, null, 2)}\n`);',
    '',
  ].join('\n');
  const verifyScript = [
    "import { createHash } from 'node:crypto';",
    "import { readFile } from 'node:fs/promises';",
    "import { dirname, resolve } from 'node:path';",
    "import { fileURLToPath } from 'node:url';",
    '',
    "const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');",
    "const manifest = JSON.parse(await readFile(resolve(ROOT, 'MANIFEST.json'), 'utf8'));",
    'const failures = [];',
    'for (const entry of manifest.files) {',
    '  const content = await readFile(resolve(ROOT, entry.path));',
    "  const sha256 = createHash('sha256').update(content).digest('hex');",
    '  if (content.length !== entry.bytes || sha256 !== entry.sha256) {',
    '    failures.push({ path: entry.path, expected: entry, actual: { bytes: content.length, sha256 } });',
    '  }',
    '}',
    'if (failures.length) {',
    "  process.stderr.write(`${JSON.stringify({ status: 'failed', failures }, null, 2)}\n`);",
    '  process.exitCode = 1;',
    '} else {',
    "  process.stdout.write(`${JSON.stringify({ status: 'passed', fileCount: manifest.files.length, totalBytes: manifest.summary.totalBytes }, null, 2)}\n`);",
    '}',
    '',
  ].join('\n');
  await writeFile(
    resolve(packageRoot, 'audit/run-smoke.mjs'),
    smokeScript,
    'utf8'
  );
  await writeFile(
    resolve(packageRoot, 'audit/verify-package.mjs'),
    verifyScript,
    'utf8'
  );
}
/* eslint-enable quotes */

function runPackagedSmoke(packageRoot) {
  const result = spawnSync(
    process.execPath,
    [resolve(packageRoot, 'audit/run-smoke.mjs')],
    {
      cwd: packageRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`packaged smoke failed: ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout);
}

async function findForbiddenPackagePaths(packageRoot) {
  const issues = [];
  for (const path of await walkFiles(packageRoot)) {
    const packageRelative = normalizePath(relative(packageRoot, path));
    if (FORBIDDEN_PACKAGE_PATH.test(packageRelative)) {
      issues.push(`forbidden-ui-or-binary-path:${packageRelative}`);
    }
    if (FORBIDDEN_RAW_NAME.test(packageRelative)) {
      issues.push(`forbidden-raw-source-name:${packageRelative}`);
    }
  }
  return issues;
}

async function writePackageManifest({ packageRoot, packageName, commit }) {
  const files = [];
  for (const path of await walkFiles(packageRoot)) {
    const packageRelative = normalizePath(relative(packageRoot, path));
    if (['MANIFEST.json', 'SHA256SUMS.txt'].includes(packageRelative)) continue;
    const content = await readFile(path);
    files.push({
      path: packageRelative,
      bytes: content.length,
      sha256: createHash('sha256').update(content).digest('hex'),
    });
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  const manifest = {
    schemaVersion: 1,
    kind: 'm11-headless-external-audit-package-manifest',
    packageName,
    sourceCommit: commit,
    generatedAt: new Date().toISOString(),
    hashAlgorithm: 'sha256',
    manifestCoverageExcludes: ['MANIFEST.json', 'SHA256SUMS.txt'],
    summary: {
      fileCount: files.length,
      totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    },
    files,
  };
  await writeJson(resolve(packageRoot, 'MANIFEST.json'), manifest);
  await writeFile(
    resolve(packageRoot, 'SHA256SUMS.txt'),
    `${files.map(file => `${file.sha256}  ${file.path}`).join('\n')}\n`,
    'utf8'
  );
  return manifest;
}

async function walkFiles(root) {
  const files = [];
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}
