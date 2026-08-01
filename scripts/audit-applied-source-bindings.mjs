import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const outputPath = path.resolve(
  repositoryRoot,
  readArgument('--output') ?? 'reports/applied-source-binding-audit.json'
);
const assertClean = process.argv.includes('--assert-clean');
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
  const fixtures = await vite.ssrLoadModule(
    '/src/simulation/fixtures/toughnessRuntimeSampleFixture.js'
  );
  const draft = createAuditDraft(drafts, fixtures);
  const project = factory.createWorkbenchProject(draft.selection, {
    teamSlots: draft.teamSlots,
    actorConfigs: draft.actorConfigs,
    enemyConfig: draft.enemyConfig,
    configurationLibrary: draft.configurationLibrary,
    configurationSelection: draft.configurationSelection,
    gameDataBinding: draft.gameDataBinding,
    actions: draft.actionDrafts,
    actionRelations: draft.actionRelations,
    cycleBoundaries: draft.cycleBoundaries,
    initialRuntimeState: draft.initialRuntimeState,
    runtimeSampleCaptures: draft.runtimeSampleCaptures,
  });
  const scenario = compiler.compileProject(
    project,
    factory.getWorkbenchGameData()
  );
  const result = engine.simulateScenario(scenario);
  const deltas = result.threeValueGenerationLayer.deltas
    .filter(delta => delta.layerKey === 'applied')
    .map(delta => ({
      deltaId: delta.deltaId,
      actionId: delta.actionId,
      trackKey: delta.trackKey,
      state: delta.appliedSourceBindingState,
      kind: delta.appliedSourceBindingKind,
      identity: delta.appliedSourceBindingIdentity,
      status: delta.appliedSourceBindingStatus,
      issueCodes:
        delta.mechanicsAdapterRequest?.sourceValue?.operands
          ?.sourceBindingValidation?.issueCodes ?? [],
    }));
  const boundDrift = deltas.filter(delta => delta.state === 'bound-drift');
  const compatibleUnbound = deltas.filter(
    delta => delta.state === 'compatible-unbound'
  );
  const unexplainedCompatibleUnbound = compatibleUnbound.filter(
    delta =>
      delta.status !== 'applied-source-binding-compatible-unbound' ||
      (!delta.kind && delta.issueCodes.length === 0)
  );
  const requiredTracks = [
    'enemyHpDamage',
    'enemyToughnessDamage',
    'selfEnergyChange',
  ];
  const missingTracks = requiredTracks.filter(
    trackKey => !deltas.some(delta => delta.trackKey === trackKey)
  );
  const passed =
    deltas.length > 0 &&
    boundDrift.length === 0 &&
    unexplainedCompatibleUnbound.length === 0 &&
    missingTracks.length === 0;
  const reportBody = {
    schemaVersion: 1,
    kind: 'applied-source-binding-audit',
    decision: {
      status: passed ? 'passed' : 'blocked',
      passed,
      reason: passed
        ? 'all-applied-deltas-have-a-valid-or-explained-source-binding'
        : 'applied-source-binding-drift-unexplained-compatibility-or-track-gap',
    },
    summary: {
      appliedDeltaCount: deltas.length,
      boundReadyCount: deltas.filter(delta => delta.state === 'bound-ready')
        .length,
      boundDriftCount: boundDrift.length,
      compatibleUnboundCount: compatibleUnbound.length,
      unexplainedCompatibleUnboundCount: unexplainedCompatibleUnbound.length,
      missingTrackCount: missingTracks.length,
    },
    requiredTracks,
    missingTracks,
    deltas,
  };
  const previousReport = await readJsonIfExists(outputPath);
  const semanticUnchanged = reportsHaveSameSemanticContent(
    previousReport,
    reportBody
  );
  const report = {
    schemaVersion: reportBody.schemaVersion,
    kind: reportBody.kind,
    generatedAt:
      semanticUnchanged && previousReport?.generatedAt
        ? previousReport.generatedAt
        : new Date().toISOString(),
    decision: reportBody.decision,
    summary: reportBody.summary,
    requiredTracks: reportBody.requiredTracks,
    missingTracks: reportBody.missingTracks,
    deltas: reportBody.deltas,
  };
  const serializedReport = `${JSON.stringify(report, null, 2)}\n`;

  if (!assertClean) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    if ((await readTextIfExists(outputPath)) !== serializedReport) {
      await writeFile(outputPath, serializedReport, 'utf8');
    }
  }
  process.stdout.write(
    `${report.decision.status}: ${deltas.length} applied deltas, ${boundDrift.length} drift, ${compatibleUnbound.length} compatible unbound\n`
  );
  if (assertClean && (!passed || !semanticUnchanged)) {
    if (!semanticUnchanged) {
      process.stderr.write(
        `stale: ${path.relative(repositoryRoot, outputPath)} differs from the deterministic audit result\n`
      );
    }
    process.exitCode = 1;
  }
} finally {
  await vite.close();
}

function createAuditDraft(drafts, fixtures) {
  const draft = drafts.createDefaultWorkbenchDraftState();
  draft.actionDrafts.push({
    id: 'audit-resource-action',
    type: 'resource',
    actorCharacterId: draft.selection.characterId,
    startMs: 1200,
    durationMs: 1,
    resource: 'sp',
    change: 0.25,
    reason: 'production-source-binding-audit',
  });
  draft.runtimeSampleCaptures = [
    fixtures.createToughnessRuntimeSampleFixture({
      actionId: draft.actionDrafts[0].id,
      toughnessDeltaApplied: 70,
    }),
  ];
  return draft;
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function readJsonIfExists(filePath) {
  const text = await readTextIfExists(filePath);
  if (text == null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function readTextIfExists(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function reportsHaveSameSemanticContent(previousReport, nextReportBody) {
  if (!previousReport || typeof previousReport !== 'object') return false;
  const { generatedAt: _generatedAt, ...previousBody } = previousReport;
  return JSON.stringify(previousBody) === JSON.stringify(nextReportBody);
}
