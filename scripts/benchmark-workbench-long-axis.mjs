import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const actionCount = readPositiveIntegerArgument('--actions', 180);
const iterationCount = readPositiveIntegerArgument('--iterations', 5);
const warmupCount = readNonNegativeIntegerArgument('--warmup', 1);
const compileBudgetMs = readPositiveNumberArgument('--compile-budget-ms', 250);
const simulationBudgetMs = readPositiveNumberArgument(
  '--simulation-budget-ms',
  1500
);
const outputPath = path.resolve(
  repositoryRoot,
  readStringArgument('--output', 'reports/long-axis-benchmark.json')
);

const vite = await createServer({
  root: repositoryRoot,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});

try {
  const drafts = await vite.ssrLoadModule(
    '/src/domain/workbenchDraftStorage.js'
  );
  const factory = await vite.ssrLoadModule(
    '/src/domain/workbenchProjectFactory.js'
  );
  const compiler = await vite.ssrLoadModule(
    '/src/simulation/compiler/compileProject.js'
  );
  const engine = await vite.ssrLoadModule(
    '/src/simulation/engine/simulateScenario.js'
  );
  const draft = createLongAxisDraft(drafts, actionCount);
  const samples = [];
  let validation = null;

  for (let index = 0; index < warmupCount + iterationCount; index += 1) {
    globalThis.gc?.();
    const compileStartedAt = performance.now();
    const project = factory.createWorkbenchProject(draft.selection, {
      teamSlots: draft.teamSlots,
      actorConfigs: draft.actorConfigs,
      enemyConfig: draft.enemyConfig,
      actions: draft.actionDrafts,
      runtimeSampleCaptures: draft.runtimeSampleCaptures,
    });
    const scenario = compiler.compileProject(
      project,
      factory.getWorkbenchGameData()
    );
    const simulationStartedAt = performance.now();
    const result = engine.simulateScenario(scenario);
    const completedAt = performance.now();
    validation = validateLongAxisResult({
      actionCount,
      project,
      scenario,
      result,
    });

    if (index >= warmupCount) {
      samples.push({
        iteration: index - warmupCount + 1,
        compileMs: roundMilliseconds(simulationStartedAt - compileStartedAt),
        simulationMs: roundMilliseconds(completedAt - simulationStartedAt),
        totalMs: roundMilliseconds(completedAt - compileStartedAt),
        heapUsedMiB: roundNumber(process.memoryUsage().heapUsed / 1024 / 1024),
      });
    }
  }

  const compileStats = summarizeSamples(
    samples.map(sample => sample.compileMs)
  );
  const simulationStats = summarizeSamples(
    samples.map(sample => sample.simulationMs)
  );
  const totalStats = summarizeSamples(samples.map(sample => sample.totalMs));
  const budgets = {
    compileP95Ms: compileBudgetMs,
    simulationP95Ms: simulationBudgetMs,
  };
  const budgetStatus = {
    compileWithinBudget: compileStats.p95 <= compileBudgetMs,
    simulationWithinBudget: simulationStats.p95 <= simulationBudgetMs,
  };
  const report = {
    schemaVersion: 1,
    kind: 'workbench-long-axis-benchmark',
    scenario: {
      actionCount,
      spacingFrames: 9,
      durationFrames: 6,
      expectedDurationFrames: (actionCount - 1) * 9 + 6,
      actorCount: 2,
    },
    environment: {
      platform: `${process.platform}-${process.arch}`,
      node: process.version,
      cpu: os.cpus()[0]?.model ?? 'unknown',
      logicalCpuCount: os.cpus().length,
      totalMemoryGiB: roundNumber(os.totalmem() / 1024 / 1024 / 1024),
    },
    iterations: {
      warmup: warmupCount,
      measured: iterationCount,
    },
    budgets,
    budgetStatus,
    validation,
    summary: {
      compileMs: compileStats,
      simulationMs: simulationStats,
      totalMs: totalStats,
      peakHeapUsedMiB: Math.max(...samples.map(sample => sample.heapUsedMiB)),
    },
    samples,
    measurementBoundary:
      'Vite SSR module startup is excluded. Compile includes Workbench project creation and Project -> Scenario compilation; simulation includes all runtime and projection outputs.',
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({ output: toRepositoryPath(outputPath), ...report }, null, 2)
  );

  if (
    process.argv.includes('--assert-budget') &&
    (!validation.valid ||
      !budgetStatus.compileWithinBudget ||
      !budgetStatus.simulationWithinBudget)
  ) {
    process.exitCode = 1;
  }
} finally {
  await vite.close();
}

function createLongAxisDraft(drafts, count) {
  const draft = drafts.createDefaultWorkbenchDraftState();
  const baseAction = draft.actionDrafts[0];
  const frameMs = 1000 / 60;
  draft.enemyConfig = { ...draft.enemyConfig, hpMultiplier: 100 };
  draft.actionDrafts = Array.from({ length: count }, (_, index) => ({
    ...baseAction,
    id: `long-axis-action-${String(index + 1).padStart(4, '0')}`,
    startMs: index * 9 * frameMs,
    durationMs: 6 * frameMs,
    note: '',
  }));
  draft.selectedActionId = draft.actionDrafts.at(-1).id;
  return draft;
}

function validateLongAxisResult({
  actionCount: expectedCount,
  project,
  scenario,
  result,
}) {
  const actual = {
    projectActionCount: project.actions.length,
    scenarioActionCount: scenario.actions.length,
    executedActionCount: result.summary.executedActionCount,
    actionResultCount: result.actionResultTimeline.length,
    hitTransactionCount: result.runtimeOutputs.summary.hitTransactionCount,
    stateCurvePointCount: result.runtimeOutputs.summary.stateCurvePointCount,
    simLogCount: result.runtimeOutputs.simLog.length,
  };
  return {
    expectedActionCount: expectedCount,
    ...actual,
    valid: [
      actual.projectActionCount,
      actual.scenarioActionCount,
      actual.executedActionCount,
      actual.actionResultCount,
      actual.hitTransactionCount,
      actual.stateCurvePointCount,
    ].every(value => value === expectedCount),
  };
}

function summarizeSamples(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    min: sorted[0],
    median: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted.at(-1),
  };
}

function percentile(sortedValues, ratio) {
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * ratio) - 1)
  );
  return sortedValues[index];
}

function readPositiveIntegerArgument(name, fallback) {
  return Math.max(1, Math.trunc(readPositiveNumberArgument(name, fallback)));
}

function readNonNegativeIntegerArgument(name, fallback) {
  const value = Number(readStringArgument(name, fallback));
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : fallback;
}

function readPositiveNumberArgument(name, fallback) {
  const value = Number(readStringArgument(name, fallback));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readStringArgument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] != null
    ? process.argv[index + 1]
    : fallback;
}

function roundMilliseconds(value) {
  return Math.round(value * 1000) / 1000;
}

function roundNumber(value) {
  return Math.round(value * 100) / 100;
}

function toRepositoryPath(filePath) {
  return path.relative(repositoryRoot, filePath).split(path.sep).join('/');
}
