export const GATE_FINGERPRINT_SCHEMA_VERSION = 2;
export const GATE_DEPENDENCY_MAP_VERSION = 2;
export const GATE_LEDGER_SCHEMA_VERSION = 1;

export const GATE_SYSTEM_FILES = Object.freeze([
  'scripts/gates/formal-search-admission.mjs',
  'scripts/gates/gate-definitions.mjs',
  'scripts/gates/gate-fingerprint.mjs',
  'scripts/gates/gate-ledger.mjs',
  'scripts/gates/gate-planner.mjs',
  'scripts/gates/gate-result-parser.mjs',
  'scripts/gates/gate-runner.mjs',
  'scripts/gates/git-change-classifier.mjs',
  'scripts/gates/node-package-invocation.mjs',
  'scripts/gates/run-repository-hygiene.mjs',
  'scripts/release-verify.mjs',
  'scripts/run-smart-gates.mjs',
]);

export const FORMAL_DETERMINISM_TEST_FILES = Object.freeze([
  'src/__tests__/domain/machineAxisContract.test.js',
  'src/__tests__/integration/workbenchProjectReplayConsistency.test.js',
  'src/__tests__/machine-axis/m12cInitialStatePolicy.test.js',
  'src/__tests__/machine-axis/m12cOuterBuildPool.test.js',
  'src/__tests__/machine-axis/machineAxisCli.test.js',
  'src/__tests__/machine-axis/machineAxisCliProcess.test.js',
  'src/__tests__/machine-axis/machineAxisCycleEvaluator.test.js',
  'src/__tests__/machine-axis/machineAxisKillEvaluator.test.js',
  'src/__tests__/machine-axis/machineAxisObjectiveContract.test.js',
  'src/__tests__/machine-axis/machineAxisSearchAcceptanceBoundary.test.js',
  'src/__tests__/machine-axis/machineAxisSearchEngine.test.js',
  'src/__tests__/machine-axis/machineAxisSearchState.test.js',
  'src/__tests__/machine-axis/machineAxisService.test.js',
  'src/__tests__/machine-axis/workbenchMachineAxisAdapter.test.js',
  'src/__tests__/simulation/canonicalHeadlessCombatBoundary.test.js',
  'src/__tests__/simulation/starbornExistingTuningMarkSemantics.test.js',
]);

const packageAndTestConfig = [
  'package.json',
  'package-lock.json',
  'vite.config.*',
  'vitest.config.*',
  'eslint.config.*',
];
const buildConfig = [
  'package.json',
  'package-lock.json',
  'vite.config.*',
  'vite.machine-axis-cli.config.*',
];
const playwrightConfig = [
  'playwright.config.*',
  'playwright.production.config.*',
  'scripts/production-preview-reporter.mjs',
];
const runtimeSources = [
  'src/simulation/**',
  'src/domain/**',
  'src/runtime/**',
  'src/data/azprGenerated.js',
  'src/data/generated/verified-combat-mechanics-package.json',
  'src/data/generated/character-combat-profiles/**',
  'fixtures/machine-axis/**',
  'fixtures/character-acceptance/**',
];
const machineAxisSources = [
  'src/machine-axis/**',
  'scripts/machine-axis/**',
  'scripts/*machine-axis*.mjs',
  'scripts/run-machine-axis-cli.mjs',
  'scripts/machine-axis-cli-entry.mjs',
  'fixtures/machine-axis/**',
  'vite.machine-axis-cli.config.*',
];
const workbenchSources = [
  'src/views/Workbench.vue',
  'src/features/workbench/**',
  'src/store/**',
  'src/stores/**',
  'src/router/**',
  'src/App.vue',
  'src/main.js',
  'src/assets/**',
  'src/styles/**',
  'src/data/azprGenerated.js',
  'src/data/generated/workbench-*.json',
  'src/machine-axis/workbenchMachineAxisAdapter.js',
  'src/domain/workbench*.js',
];
const acceptanceSources = [
  'acceptance-recipes/**',
  'scripts/character-acceptance/**',
  'scripts/generate-character-acceptance.mjs',
  'scripts/generate-m12-b3-visual-acceptance.mjs',
  'fixtures/character-acceptance/**',
  'reports/m11/character-acceptance/**',
  'reports/m12/visual-acceptance/**',
  'src/character-acceptance/**',
  'src/data/generated/character-acceptance-*.json',
  'src/data/generated/m12-b3-visual-acceptance-catalog.json',
];
const qualificationSources = [
  ...acceptanceSources,
  'scripts/optimization-qualification/**',
  'scripts/generate-optimization-qualification.mjs',
  'scripts/generate-optimization-scenario-policy.mjs',
  'reports/m12/m12-b3-*qualification*.json',
  'reports/m12/m12-b3-*qualification*.md',
  'reports/m12/m12-b3-*evidence*.json',
  'reports/m12/m12-b3-*evidence*.md',
  'src/data/generated/optimization-qualification-catalog.json',
  'src/data/generated/optimization-scenario-policy.json',
  'src/data/generated/characters.json',
  'src/data/generated/kibos.json',
  'src/data/generated/soulessences.json',
  'src/data/generated/equipment.json',
  'src/data/generated/kibo-*.json',
  'src/data/generated/soulessence-*.json',
  'src/data/generated/verified-combat-mechanics-package.json',
];
const bindingSources = [
  ...qualificationSources,
  'scripts/generate-m12-b3-binding-matrix.mjs',
  'reports/m12/m12-b3-binding-matrix.json',
  'reports/m12/m12-b3-binding-matrix.md',
  'fixtures/machine-axis/**',
  'src/machine-axis/m12cInitialStatePolicy.js',
  'src/machine-axis/m12cOuterBuildPool.js',
  'src/machine-axis/machineAxisEnemySettlementContract.js',
];
const productionSourcePatterns = [
  'src/character-acceptance/**',
  'src/components/**',
  'src/data/**',
  'src/domain/**',
  'src/features/**',
  'src/i18n/**',
  'src/machine-axis/**',
  'src/optimization-qualification/**',
  'src/optimization-scenario/**',
  'src/router/**',
  'src/simulation/**',
  'src/store/**',
  'src/styles/**',
  'src/utils/**',
  'src/views/**',
  'src/App.vue',
  'src/main.js',
  'scripts/machine-axis-cli-entry.mjs',
];
const fullTestDependencies = [
  'src/**',
  'scripts/**',
  'schemas/**',
  'fixtures/**',
  'e2e/**',
  'acceptance-recipes/**',
  '.acceptance/**',
  'public/**',
  ...packageAndTestConfig,
  ...playwrightConfig,
  'src/data/generated/**',
  'reports/m11/character-acceptance/**',
  'reports/m12/m12-b3-*.json',
  'reports/m12/visual-acceptance/**',
];

const npmStep = (script, extraArgs = []) => ({
  file: 'npm',
  args: ['run', script, ...extraArgs],
});
const npxVitestStep = files => ({
  file: 'npx',
  args: ['vitest', 'run', ...files],
});

export const GATE_DEFINITIONS = deepFreeze([
  {
    name: 'repository-hygiene',
    version: 1,
    order: 5,
    kind: 'static-check',
    description: 'Changed-file ESLint, Prettier check and git diff --check',
    dependencies: [
      'src/**',
      'scripts/**',
      'fixtures/**',
      'e2e/**',
      'acceptance-recipes/**',
      '.acceptance/**',
      'package.json',
      'package-lock.json',
      '.gitignore',
      '.gitattributes',
      'vite.config.*',
      'vitest.config.*',
      'playwright*.config.*',
      'eslint.config.*',
      'prettier.config.*',
    ],
    smartTriggers: [
      'src/**',
      'scripts/**',
      'fixtures/**',
      'e2e/**',
      'acceptance-recipes/**',
      '.acceptance/**',
      'package.json',
      'package-lock.json',
      '.gitignore',
      '.gitattributes',
      'vite.config.*',
      'vitest.config.*',
      'playwright*.config.*',
      'eslint.config.*',
      'prettier.config.*',
    ],
    environmentKeys: ['NODE_OPTIONS'],
    parser: 'audit',
    command: {
      timeoutMs: 10 * 60_000,
      steps: [
        {
          file: 'node',
          args: ['scripts/gates/run-repository-hygiene.mjs'],
        },
      ],
    },
  },
  {
    name: 'orchestration-targeted',
    version: 1,
    order: 10,
    kind: 'targeted',
    description: 'Gate orchestration unit and contract tests',
    dependencies: [
      'scripts/gates/**',
      'scripts/run-smart-gates.mjs',
      'scripts/release-verify.mjs',
      'src/__tests__/scripts/gates/**',
      ...packageAndTestConfig,
    ],
    smartTriggers: [
      'scripts/gates/**',
      'scripts/run-smart-gates.mjs',
      'scripts/release-verify.mjs',
      'src/__tests__/scripts/gates/**',
    ],
    environmentKeys: ['CI', 'NODE_OPTIONS', 'PROMILIA_VITEST_WORKERS'],
    parser: 'vitest',
    command: {
      timeoutMs: 10 * 60_000,
      steps: [npxVitestStep(['src/__tests__/scripts/gates'])],
    },
  },
  {
    name: 'runtime-targeted',
    version: 2,
    order: 20,
    kind: 'targeted',
    description: 'Simulation runtime, canonical replay and state transitions',
    dependencies: [
      ...runtimeSources,
      'src/__tests__/simulation/**',
      'src/__tests__/domain/initialRuntimeState.test.js',
      'src/__tests__/domain/verified*.test.js',
      ...packageAndTestConfig,
    ],
    smartTriggers: [
      ...runtimeSources,
      'src/__tests__/simulation/**',
      'src/__tests__/domain/initialRuntimeState.test.js',
      'src/__tests__/domain/verified*.test.js',
    ],
    environmentKeys: ['CI', 'NODE_OPTIONS', 'PROMILIA_VITEST_WORKERS'],
    parser: 'vitest',
    command: {
      timeoutMs: 20 * 60_000,
      steps: [
        npxVitestStep([
          'src/__tests__/simulation',
          'src/__tests__/domain/initialRuntimeState.test.js',
          'src/__tests__/domain/verifiedJointAttackContract.test.js',
          'src/__tests__/domain/verifiedJointAttackRuntimeContract.test.js',
        ]),
      ],
    },
  },
  {
    name: 'kibo-targeted',
    version: 2,
    order: 30,
    kind: 'targeted',
    description: 'Kibo state machine, cooldown, energy and auto-cast contracts',
    dependencies: [
      'src/**/*kibo*',
      'src/**/*Kibo*',
      'scripts/**/*kibo*',
      'scripts/**/*Kibo*',
      'fixtures/**/*kibo*',
      'src/data/generated/kibo-*.json',
      'src/data/generated/kibos.json',
      ...packageAndTestConfig,
    ],
    smartTriggers: [
      'src/**/*kibo*',
      'src/**/*Kibo*',
      'scripts/**/*kibo*',
      'scripts/**/*Kibo*',
      'fixtures/**/*kibo*',
      'src/data/generated/kibo-*.json',
      'src/data/generated/kibos.json',
    ],
    environmentKeys: ['CI', 'NODE_OPTIONS', 'PROMILIA_VITEST_WORKERS'],
    parser: 'vitest',
    command: {
      timeoutMs: 15 * 60_000,
      steps: [
        npxVitestStep([
          'src/__tests__/machine-axis/kiboAutoCastScheduler.test.js',
          'src/__tests__/scripts/kiboHeadlessCensus.test.js',
          'src/__tests__/simulation/kiboEnergyRuntimeCurves.test.js',
          'src/__tests__/simulation/verifiedKiboBeforeSkillComposite.test.js',
          'src/__tests__/simulation/verifiedKiboCooldownPassive.test.js',
          'src/__tests__/simulation/verifiedKiboPassiveGeneration.test.js',
          'src/__tests__/simulation/verifiedKiboPeriodicHeal.test.js',
          'src/__tests__/simulation/verifiedKiboPetOwnerDamagePassive.test.js',
        ]),
      ],
    },
  },
  {
    name: 'machine-axis-targeted',
    version: 3,
    order: 40,
    kind: 'targeted',
    description:
      'Machine Axis legality, CLI, search, objective and service tests',
    dependencies: [
      ...machineAxisSources,
      'src/__tests__/machine-axis/**',
      'src/__tests__/domain/machineAxisContract.test.js',
      ...runtimeSources,
      ...packageAndTestConfig,
    ],
    smartTriggers: [
      ...machineAxisSources,
      'src/__tests__/machine-axis/**',
      'src/__tests__/domain/machineAxisContract.test.js',
    ],
    environmentKeys: ['CI', 'NODE_OPTIONS', 'PROMILIA_VITEST_WORKERS'],
    parser: 'vitest',
    command: {
      timeoutMs: 30 * 60_000,
      steps: [
        npxVitestStep([
          'src/__tests__/machine-axis',
          'src/__tests__/domain/machineAxisContract.test.js',
        ]),
      ],
    },
  },
  {
    name: 'workbench-targeted',
    version: 2,
    order: 50,
    kind: 'targeted',
    description: 'Workbench DOM, projection and integration tests',
    dependencies: [
      ...workbenchSources,
      'src/__tests__/components/**',
      'src/__tests__/features/**',
      'src/__tests__/views/**',
      'src/__tests__/domain/workbench*.test.js',
      'src/__tests__/integration/workbench*.test.js',
      ...packageAndTestConfig,
    ],
    smartTriggers: [
      ...workbenchSources,
      'src/__tests__/components/**',
      'src/__tests__/features/**',
      'src/__tests__/views/**',
      'src/__tests__/domain/workbench*.test.js',
      'src/__tests__/integration/workbench*.test.js',
    ],
    environmentKeys: ['CI', 'NODE_OPTIONS', 'PROMILIA_VITEST_WORKERS'],
    parser: 'vitest',
    command: {
      timeoutMs: 30 * 60_000,
      steps: [
        npmStep('test:dom'),
        npxVitestStep(['src/__tests__/domain', 'src/__tests__/integration']),
      ],
    },
  },
  {
    name: 'acceptance-targeted',
    version: 2,
    order: 60,
    kind: 'targeted',
    description:
      'Acceptance, qualification protocol and generated authority tests',
    dependencies: [
      ...acceptanceSources,
      ...qualificationSources,
      'src/__tests__/character-acceptance/**',
      'src/__tests__/optimization-qualification/**',
      'src/__tests__/optimization-scenario/**',
      ...packageAndTestConfig,
    ],
    smartTriggers: [
      ...acceptanceSources,
      'src/__tests__/character-acceptance/**',
      'src/__tests__/optimization-qualification/**',
      'src/__tests__/optimization-scenario/**',
    ],
    environmentKeys: ['CI', 'NODE_OPTIONS', 'PROMILIA_VITEST_WORKERS'],
    parser: 'vitest',
    command: {
      timeoutMs: 30 * 60_000,
      steps: [
        npxVitestStep([
          'src/__tests__/character-acceptance',
          'src/__tests__/optimization-qualification',
          'src/__tests__/optimization-scenario',
        ]),
      ],
    },
  },
  {
    name: 'determinism',
    version: 2,
    order: 70,
    kind: 'formal-targeted',
    description:
      'M12-C build, state, CLI, objective, cycle and replay determinism',
    dependencies: [
      ...machineAxisSources,
      ...runtimeSources,
      ...workbenchSources,
      ...FORMAL_DETERMINISM_TEST_FILES,
      'src/data/generated/optimization-qualification-catalog.json',
      'reports/m12/m12-b3-binding-matrix.json',
      ...packageAndTestConfig,
    ],
    smartTriggers: [
      ...machineAxisSources,
      'src/simulation/**',
      'src/machine-axis/m12c*.js',
      'src/machine-axis/machineAxisSearch*.js',
      'src/machine-axis/machineAxis*Evaluator.js',
      'src/machine-axis/workbenchMachineAxisAdapter.js',
      ...FORMAL_DETERMINISM_TEST_FILES,
      'src/data/generated/optimization-qualification-catalog.json',
      'src/data/generated/verified-combat-mechanics-package.json',
      'src/data/generated/character-combat-profiles/**',
      'reports/m12/m12-b3-binding-matrix.json',
    ],
    environmentKeys: ['CI', 'NODE_OPTIONS', 'PROMILIA_VITEST_WORKERS'],
    parser: 'vitest',
    formalCoverage: {
      outerBuildHash: true,
      canonicalSearchState: true,
      cliReproducibility: true,
      cycleObjectiveDeterminism: true,
      workbenchReplayConsistency: true,
      initialStateAuthority: true,
      preScorePruning: true,
    },
    command: {
      timeoutMs: 30 * 60_000,
      steps: [npxVitestStep(FORMAL_DETERMINISM_TEST_FILES)],
    },
  },
  auditGate({
    name: 'production-imports',
    version: 2,
    order: 100,
    script: 'audit:production-imports:check',
    description: 'Production import graph and unreferenced module audit',
    dependencies: [
      ...productionSourcePatterns,
      'scripts/audit-production-imports.mjs',
      ...buildConfig,
    ],
    smartTriggers: [
      ...productionSourcePatterns,
      'scripts/audit-production-imports.mjs',
      'vite.config.*',
      'package.json',
      'package-lock.json',
    ],
  }),
  auditGate({
    name: 'workbench-data',
    version: 2,
    order: 110,
    script: 'audit:workbench-data:check',
    description: 'Workbench production projection audit',
    dependencies: [
      ...workbenchSources,
      'scripts/audit-workbench-production-data.mjs',
      'src/data/generated/**',
    ],
    smartTriggers: [
      ...workbenchSources,
      'scripts/audit-workbench-production-data.mjs',
      'src/data/generated/workbench-*.json',
    ],
  }),
  auditGate({
    name: 'action-status',
    version: 2,
    order: 120,
    script: 'audit:action-status:check',
    description: 'Generated action status catalog drift audit',
    dependencies: [
      'scripts/generate-action-status-catalog.mjs',
      'src/data/generated/workbench-action-status-catalog.json',
      'src/data/generated/verified-combat-mechanics-package.json',
      ...runtimeSources,
    ],
    smartTriggers: [
      'scripts/generate-action-status-catalog.mjs',
      'src/data/generated/workbench-action-status-catalog.json',
      'src/data/generated/verified-combat-mechanics-package.json',
    ],
  }),
  auditGate({
    name: 'applied-source',
    version: 2,
    order: 130,
    script: 'audit:applied-source-bindings:check',
    description: 'Applied source binding audit',
    dependencies: [
      'scripts/audit-applied-source-bindings.mjs',
      'src/data/generated/**',
      ...runtimeSources,
      ...workbenchSources,
    ],
    smartTriggers: [
      'scripts/audit-applied-source-bindings.mjs',
      'src/data/generated/verified-combat-mechanics-package.json',
      'src/data/generated/character-combat-profiles/**',
      ...workbenchSources,
    ],
  }),
  auditGate({
    name: 'verified-mechanics',
    version: 3,
    order: 140,
    script: 'audit:verified-combat',
    description: 'Verified mechanics package deterministic drift audit',
    dependencies: [
      'scripts/sync-verified-combat-mechanics.mjs',
      'scripts/character-combat/**',
      'src/simulation/mechanics/**',
      'src/data/generated/verified-combat-mechanics-package.json',
      'src/data/generated/character-combat-profiles/**',
      'reports/verified-combat-mechanics-audit.json',
      'fixtures/character-acceptance/**',
    ],
    smartTriggers: [
      'scripts/sync-verified-combat-mechanics.mjs',
      'scripts/character-combat/**',
      'src/simulation/mechanics/**',
      'src/data/generated/verified-combat-mechanics-package.json',
      'src/data/generated/character-combat-profiles/**',
    ],
  }),
  auditGate({
    name: 'character-combat',
    version: 2,
    order: 150,
    script: 'audit:character-combat',
    description: 'All character combat profiles and golden runtime audit',
    dependencies: [
      'scripts/character-combat/**',
      'scripts/sync-character-combat-profile.mjs',
      'src/data/generated/character-combat-profiles/**',
      'src/data/generated/character-combat-owner-contracts/**',
      'reports/m10/**',
      'fixtures/character-acceptance/**',
    ],
    smartTriggers: [
      'scripts/character-combat/**',
      'scripts/sync-character-combat-profile.mjs',
      'src/data/generated/character-combat-profiles/**',
      'src/data/generated/character-combat-owner-contracts/**',
      'fixtures/character-acceptance/**',
    ],
  }),
  auditGate({
    name: 'character-acceptance',
    version: 3,
    order: 160,
    script: 'audit:character-acceptance',
    description: 'Character acceptance manifest and catalog audit',
    dependencies: acceptanceSources,
    smartTriggers: acceptanceSources,
  }),
  auditGate({
    name: 'visual-acceptance',
    version: 2,
    order: 170,
    script: 'audit:visual-acceptance',
    description: 'Read-only validation of recorded product visual acceptance',
    dependencies: [
      'scripts/generate-m12-b3-visual-acceptance.mjs',
      'reports/m12/visual-acceptance/**',
      'src/data/generated/m12-b3-visual-acceptance-catalog.json',
    ],
    smartTriggers: [
      'scripts/generate-m12-b3-visual-acceptance.mjs',
      'reports/m12/visual-acceptance/**',
      'src/data/generated/m12-b3-visual-acceptance-catalog.json',
    ],
  }),
  auditGate({
    name: 'optimization-scenario',
    version: 2,
    order: 180,
    script: 'audit:optimization-scenario-policy',
    description: 'Optimization scenario policy audit',
    dependencies: [
      'scripts/generate-optimization-scenario-policy.mjs',
      'src/optimization-scenario/**',
      'src/data/generated/optimization-scenario-policy.json',
      'src/data/generated/verified-combat-mechanics-package.json',
    ],
    smartTriggers: [
      'scripts/generate-optimization-scenario-policy.mjs',
      'src/optimization-scenario/**',
      'src/data/generated/optimization-scenario-policy.json',
    ],
  }),
  auditGate({
    name: 'qualification',
    version: 3,
    order: 190,
    script: 'audit:optimization-qualification',
    description: 'Optimization qualification and formal lock audit',
    dependencies: qualificationSources,
    smartTriggers: [
      ...acceptanceSources,
      'scripts/optimization-qualification/**',
      'scripts/generate-optimization-qualification.mjs',
      'src/data/generated/optimization-qualification-catalog.json',
      'src/data/generated/verified-combat-mechanics-package.json',
      'src/data/generated/character-combat-profiles/**',
      'src/data/generated/kibo-*.json',
      'src/data/generated/soulessence-*.json',
      'src/data/generated/equipment.json',
    ],
  }),
  auditGate({
    name: 'binding',
    version: 3,
    order: 200,
    script: 'audit:binding-matrix',
    description:
      'E22 qualification, authority and runtime binding matrix audit',
    dependencies: bindingSources,
    smartTriggers: [
      ...acceptanceSources,
      'scripts/generate-m12-b3-binding-matrix.mjs',
      'reports/m12/m12-b3-binding-matrix.json',
      'scripts/optimization-qualification/**',
      'reports/m12/m12-b3-*qualification*.json',
      'src/data/generated/optimization-qualification-catalog.json',
      'src/data/generated/verified-combat-mechanics-package.json',
      'src/machine-axis/m12c*.js',
      'src/machine-axis/machineAxisEnemySettlementContract.js',
    ],
  }),
  auditGate({
    name: 'kibo-headless',
    version: 2,
    order: 210,
    script: 'audit:kibo-headless',
    description: 'Kibo headless census audit',
    dependencies: [
      'scripts/generate-kibo-headless-census.mjs',
      'src/data/generated/kibo-*.json',
      'src/data/generated/kibos.json',
      'src/simulation/**/*kibo*',
      'src/simulation/**/*Kibo*',
      'reports/m11/**kibo**',
    ],
    smartTriggers: [
      'scripts/generate-kibo-headless-census.mjs',
      'src/data/generated/kibo-*.json',
      'src/data/generated/kibos.json',
      'src/simulation/**/*kibo*',
      'src/simulation/**/*Kibo*',
    ],
  }),
  auditGate({
    name: 'machine-axis-settlement',
    version: 2,
    order: 220,
    script: 'audit:machine-axis-enemy-settlement-evidence',
    description:
      'Versioned enemy settlement evidence and formal runtime baseline audit',
    dependencies: [
      'scripts/generate-machine-axis-enemy-settlement-evidence.mjs',
      'scripts/machine-axis/enemy-toughness-settlement-evidence.mjs',
      'scripts/machine-axis/evidence/**',
      'src/machine-axis/machineAxisEnemySettlementContract.js',
      'src/machine-axis/machineAxis*Evaluator.js',
      'src/simulation/mechanics/verifiedCombatRuntime.js',
      'reports/m12/m12-b3-enemy-toughness-settlement-evidence-*.json',
    ],
    smartTriggers: [
      'scripts/generate-machine-axis-enemy-settlement-evidence.mjs',
      'scripts/machine-axis/enemy-toughness-settlement-evidence.mjs',
      'scripts/machine-axis/evidence/**',
      'src/machine-axis/machineAxisEnemySettlementContract.js',
      'src/machine-axis/machineAxis*Evaluator.js',
      'src/simulation/mechanics/verifiedCombatRuntime.js',
    ],
  }),
  {
    name: 'bundle',
    version: 3,
    order: 300,
    kind: 'build-audit',
    description:
      'Production bundle composition, externalization and budget audit',
    dependencies: [
      ...buildConfig,
      ...workbenchSources,
      ...productionSourcePatterns,
      'public/**',
      'scripts/audit-build-bundle.mjs',
    ],
    smartTriggers: [
      ...buildConfig,
      ...workbenchSources,
      'public/**',
      'scripts/audit-build-bundle.mjs',
    ],
    environmentKeys: ['NODE_ENV', 'NODE_OPTIONS'],
    parser: 'bundle',
    command: {
      timeoutMs: 20 * 60_000,
      steps: [npmStep('audit:bundle:check')],
    },
  },
  {
    name: 'production-build',
    version: 2,
    order: 310,
    kind: 'build',
    description: 'Real production Vite build',
    dependencies: [
      ...buildConfig,
      ...productionSourcePatterns,
      'public/**',
      'src/data/generated/**',
    ],
    smartTriggers: [...buildConfig, ...workbenchSources, 'public/**'],
    environmentKeys: ['NODE_ENV', 'NODE_OPTIONS'],
    parser: 'vite-build',
    command: {
      timeoutMs: 20 * 60_000,
      steps: [npmStep('build')],
    },
  },
  {
    name: 'production-preview',
    version: 4,
    order: 320,
    kind: 'browser-acceptance',
    description: '64-case production dist preview acceptance',
    dependencies: [
      ...buildConfig,
      ...playwrightConfig,
      ...workbenchSources,
      ...runtimeSources,
      ...machineAxisSources,
      'e2e/workbench-production-preview.spec.js',
      'e2e/helpers/**',
      'fixtures/**',
      'public/**',
    ],
    smartTriggers: [
      ...buildConfig,
      ...playwrightConfig,
      ...workbenchSources,
      'e2e/workbench-production-preview.spec.js',
      'e2e/helpers/**',
      'public/**',
    ],
    environmentKeys: [
      'CI',
      'NODE_OPTIONS',
      'PLAYWRIGHT_CHANNEL',
      'PROMILIA_PREVIEW_E2E_HOST',
      'PROMILIA_PREVIEW_E2E_PORT',
    ],
    parser: 'playwright',
    covers: ['applied-source', 'production-build'],
    command: {
      timeoutMs: 45 * 60_000,
      steps: [npmStep('test:e2e:production-preview')],
    },
  },
  {
    name: 'test-full',
    version: 3,
    order: 400,
    kind: 'integration-checkpoint',
    description: 'Complete current Vitest definition set',
    dependencies: fullTestDependencies,
    smartTriggers: [],
    integrationGate: true,
    environmentKeys: ['CI', 'NODE_OPTIONS', 'PROMILIA_VITEST_WORKERS'],
    parser: 'vitest',
    command: {
      timeoutMs: 60 * 60_000,
      steps: [npmStep('test:full')],
    },
  },
  {
    name: 'trial-release',
    version: 3,
    order: 500,
    kind: 'release-authority',
    description: 'Existing uncached trial release command at original strength',
    dependencies: [
      ...fullTestDependencies,
      ...buildConfig,
      ...playwrightConfig,
      'reports/production-import-audit.json',
      'reports/workbench-production-data-audit.json',
      'reports/bundle-composition.json',
      'reports/production-preview-acceptance.json',
    ],
    smartTriggers: [],
    environmentKeys: [
      'CI',
      'NODE_OPTIONS',
      'PROMILIA_VITEST_WORKERS',
      'PLAYWRIGHT_CHANNEL',
      'PROMILIA_PREVIEW_E2E_HOST',
      'PROMILIA_PREVIEW_E2E_PORT',
    ],
    parser: 'trial-release',
    command: {
      timeoutMs: 90 * 60_000,
      steps: [npmStep('test:trial-release')],
    },
  },
  {
    name: 'formal-search-admission',
    version: 3,
    order: 510,
    kind: 'derived-formal-decision',
    description:
      'Explicit formal search admission from release and product contracts',
    dependencies: [
      ...bindingSources,
      'reports/m11/character-acceptance/optimization-objects/STARBORN/manifest.json',
      'src/data/generated/character-acceptance-catalog.json',
      'src/data/generated/workbench-kibo-action-catalog.json',
      'src/machine-axis/m12cInitialStatePolicy.js',
      'src/machine-axis/kiboAutoCastScheduler.js',
      'src/machine-axis/machineAxisEnemySettlementContract.js',
      'reports/m12/m12-c-kibo-autonomous-readiness.json',
    ],
    smartTriggers: [],
    environmentKeys: [],
    parser: 'formal-admission',
    command: null,
  },
  {
    name: 'release-verify',
    version: 3,
    order: 520,
    kind: 'release-authority',
    description:
      'Uncached final release orchestration and formal admission report',
    dependencies: [
      ...fullTestDependencies,
      ...bindingSources,
      ...buildConfig,
      ...playwrightConfig,
      'scripts/release-verify.mjs',
    ],
    smartTriggers: [],
    environmentKeys: [
      'CI',
      'NODE_OPTIONS',
      'PROMILIA_VITEST_WORKERS',
      'PLAYWRIGHT_CHANNEL',
      'PROMILIA_PREVIEW_E2E_HOST',
      'PROMILIA_PREVIEW_E2E_PORT',
    ],
    parser: 'release-verify',
    command: null,
  },
]);

export const RELEASE_EXTRA_GATE_NAMES = Object.freeze([
  'character-combat',
  'visual-acceptance',
  'binding',
  'kibo-headless',
  'machine-axis-settlement',
]);

export const TRIAL_RELEASE_COMPONENTS = deepFreeze([
  { gate: 'test-full', script: 'test', command: 'npm run test -- --run' },
  {
    gate: 'production-imports',
    script: 'audit:production-imports:check',
    command: 'npm run audit:production-imports:check',
  },
  {
    gate: 'workbench-data',
    script: 'audit:workbench-data:check',
    command: 'npm run audit:workbench-data:check',
  },
  {
    gate: 'action-status',
    script: 'audit:action-status:check',
    command: 'npm run audit:action-status:check',
  },
  {
    gate: 'verified-mechanics',
    script: 'audit:verified-combat',
    command: 'npm run audit:verified-combat',
  },
  {
    gate: 'optimization-scenario',
    script: 'audit:optimization-scenario-policy',
    command: 'npm run audit:optimization-scenario-policy',
  },
  {
    gate: 'character-acceptance',
    script: 'audit:character-acceptance',
    command: 'npm run audit:character-acceptance',
  },
  {
    gate: 'qualification',
    script: 'audit:optimization-qualification',
    command: 'npm run audit:optimization-qualification',
  },
  {
    gate: 'bundle',
    script: 'audit:bundle:check',
    command: 'npm run audit:bundle:check',
  },
  {
    gate: 'applied-source',
    script: 'audit:applied-source-bindings:check',
    command: 'npm run audit:applied-source-bindings:check',
  },
  { gate: 'production-build', script: 'build', command: 'npm run build' },
  {
    gate: 'production-preview',
    script: 'test:e2e:production-preview',
    command: 'npm run test:e2e:production-preview',
  },
  {
    gate: 'determinism',
    script: 'test',
    command: 'npm run test -- --run (formal suite included)',
  },
]);

export function getGateDefinition(name) {
  return GATE_DEFINITIONS.find(gate => gate.name === name) ?? null;
}

export function validateGateDefinitions(definitions = GATE_DEFINITIONS) {
  const issues = [];
  const names = new Set();
  for (const gate of definitions) {
    if (!gate?.name || typeof gate.name !== 'string') {
      issues.push('gate-name-missing');
      continue;
    }
    if (names.has(gate.name)) issues.push(`duplicate-gate:${gate.name}`);
    names.add(gate.name);
    if (!Number.isInteger(gate.version) || gate.version < 1) {
      issues.push(`invalid-version:${gate.name}`);
    }
    if (!Array.isArray(gate.dependencies) || gate.dependencies.length === 0) {
      issues.push(`dependencies-missing:${gate.name}`);
    }
    if (!Array.isArray(gate.smartTriggers)) {
      issues.push(`smart-triggers-missing:${gate.name}`);
    }
    if (gate.command != null) {
      if (!Array.isArray(gate.command.steps) || !gate.command.steps.length) {
        issues.push(`command-steps-missing:${gate.name}`);
      }
      for (const step of gate.command.steps ?? []) {
        if (!step.file || !Array.isArray(step.args)) {
          issues.push(`invalid-command-step:${gate.name}`);
        }
        if (step.shell === true)
          issues.push(`shell-command-forbidden:${gate.name}`);
      }
    }
  }
  return { valid: issues.length === 0, issues };
}

function auditGate({
  name,
  version,
  order,
  script,
  description,
  dependencies,
  smartTriggers,
}) {
  return {
    name,
    version,
    order,
    kind: 'audit',
    description,
    dependencies,
    smartTriggers,
    environmentKeys: ['NODE_OPTIONS'],
    parser: 'audit',
    command: {
      timeoutMs: 30 * 60_000,
      steps: [npmStep(script)],
    },
  };
}

function deepFreeze(value) {
  if (value == null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const entry of Object.values(value)) deepFreeze(entry);
  return Object.freeze(value);
}
