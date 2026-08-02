import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
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
  const soulEssenceCatalog = JSON.parse(
    await readFile(
      path.join(
        repositoryRoot,
        'src',
        'data',
        'generated',
        'soulessence-effect-mechanics.json'
      ),
      'utf8'
    )
  );
  const loadoutPropertyTagAudit = await createLoadoutPropertyTagAudit(
    soulEssenceCatalog
  );
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
    missingTracks.length === 0 &&
    loadoutPropertyTagAudit.summary.driftCount === 0;
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
      loadoutPropertyTagSourceCount:
        loadoutPropertyTagAudit.summary.sourceCount,
      loadoutPropertyTagDriftCount: loadoutPropertyTagAudit.summary.driftCount,
    },
    requiredTracks,
    missingTracks,
    deltas,
    loadoutPropertyTags: loadoutPropertyTagAudit,
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
    loadoutPropertyTags: reportBody.loadoutPropertyTags,
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

async function createLoadoutPropertyTagAudit(catalog) {
  const sourcePath = catalog?.sourceSnapshot?.battleElements?.path;
  const expectedSourceSha256 =
    catalog?.sourceSnapshot?.battleElements?.sha256 ?? null;
  const sourceBytes = await readFile(sourcePath);
  const actualSourceSha256 = createHash('sha256')
    .update(sourceBytes)
    .digest('hex');
  const definitions = (catalog?.definitions ?? []).filter(
    definition => definition.runtimeStatus === 'runtime-applied'
  );
  const requestedElementIds = new Set(
    definitions.map(definition => Number(definition.effect?.elementId))
  );
  const sourceRowsByElementId = new Map();
  for (const line of sourceBytes.toString('utf8').split(/\r?\n/u)) {
    if (!line) continue;
    const match = line.match(/"elementConfigId"\s*:\s*(\d+)/u);
    const elementId = Number(match?.[1]);
    if (!requestedElementIds.has(elementId)) continue;
    const row = JSON.parse(line);
    if (Number(row?.typetree?.elementConfigId) === elementId) {
      sourceRowsByElementId.set(elementId, row);
    }
  }
  const supportedPropertyTags = new Set(
    (catalog?.propertyTagContract?.bindings ?? [])
      .filter(binding => binding.status === 'applied')
      .map(binding => Number(binding.propertyTag))
  );
  const records = definitions.map(definition => {
    const elementId = Number(definition.effect?.elementId);
    const sourceRow = sourceRowsByElementId.get(elementId);
    const sourcePropertyTags = normalizeIntegerTags(
      sourceRow?.typetree?.defaultPropertyTags
    );
    const generatedPropertyTags = normalizeIntegerTags(
      definition.effect?.propertyTags
    );
    const expectedMatchMode =
      sourcePropertyTags.length === 0
        ? 'unscoped'
        : sourcePropertyTags.length === 1 &&
            supportedPropertyTags.has(sourcePropertyTags[0])
          ? 'single-exact'
          : null;
    const issueCodes = [
      ...(sourceRow ? [] : ['loadout-property-tag-source-row-missing']),
      ...(actualSourceSha256 === expectedSourceSha256
        ? []
        : ['loadout-property-tag-source-hash-drift']),
      ...(JSON.stringify(sourcePropertyTags) ===
      JSON.stringify(generatedPropertyTags)
        ? []
        : ['loadout-property-tag-generated-value-drift']),
      ...(expectedMatchMode === definition.effect?.propertyTagMatchMode
        ? []
        : ['loadout-property-tag-match-mode-drift']),
      ...(String(definition.effect?.propertyTagSourceIdentity ?? '').includes(
        `elementId=${elementId}.defaultPropertyTags`
      )
        ? []
        : ['loadout-property-tag-source-identity-missing']),
    ];
    return {
      soulEssenceId: Number(definition.soulEssenceId),
      effectElementId: elementId,
      sourcePropertyTags,
      generatedPropertyTags,
      propertyTagMatchMode: definition.effect?.propertyTagMatchMode ?? null,
      propertyTagSourceIdentity:
        definition.effect?.propertyTagSourceIdentity ?? null,
      sourceIdentity: definition.effect?.sourceIdentity ?? null,
      status:
        issueCodes.length === 0
          ? 'applied-source-property-tags-ready'
          : 'applied-source-property-tags-drift',
      issueCodes,
    };
  });
  return {
    source: {
      path: sourcePath,
      expectedSha256: expectedSourceSha256,
      actualSha256: actualSourceSha256,
      propertyTagContractHash:
        catalog?.propertyTagContract?.contractHash ?? null,
    },
    summary: {
      sourceCount: records.length,
      driftCount: records.filter(record => record.issueCodes.length > 0)
        .length,
    },
    records,
  };
}

function normalizeIntegerTags(values) {
  return [...new Set((values ?? []).map(Number))]
    .filter(Number.isInteger)
    .sort((left, right) => left - right);
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
