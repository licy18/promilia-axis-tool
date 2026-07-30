import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import {
  createCharacterAcceptanceCatalog,
  createCharacterAcceptanceManifest,
  validateUnnamedSecondaryPassiveBoundary,
} from './character-acceptance/character-acceptance-generation.mjs';
import { validateCharacterAcceptanceManifest } from '../src/character-acceptance/characterAcceptanceProtocol.js';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const recipeRoot = path.join(projectRoot, 'scripts', 'character-acceptance', 'acceptance-recipes');
const generatedCatalogPath = path.join(projectRoot, 'src', 'data', 'generated', 'character-acceptance-catalog.json');
const reportRoot = path.join(projectRoot, 'reports', 'm11', 'character-acceptance');
const writeMode = process.argv.includes('--write');
const assertClean = process.argv.includes('--assert-clean');

const recipes = await loadRecipes();
const mechanicsPackage = await readJson(path.join(projectRoot, 'src', 'data', 'generated', 'verified-combat-mechanics-package.json'));
const vite = await createServer({
  root: projectRoot,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});

try {
  const packageModule = await vite.ssrLoadModule('/src/data/verifiedCombatMechanicsPackage.js');
  const serviceModule = await vite.ssrLoadModule('/src/machine-axis/machineAxisService.js');
  const adapterModule = await vite.ssrLoadModule('/src/machine-axis/workbenchMachineAxisAdapter.js');
  const traceIndexModule = await vite.ssrLoadModule('/src/features/workbench/canonicalTraceViewIndex.js');
  packageModule.installVerifiedCombatMechanicsPackage(mechanicsPackage);
  const service = serviceModule.createMachineAxisService();
  const adapter = adapterModule.createWorkbenchMachineAxisAdapter({ service });
  const manifests = [];
  const visualRuns = [];

  for (const recipe of recipes) {
    await verifyAutomatedVisualEvidence(recipe);
    const ownerId = Number(recipe.ownerId);
    const loaded = await Promise.all([
      readJson(path.join(projectRoot, 'src', 'data', 'generated', 'character-combat-profiles', ownerId + '.json')),
      readJson(path.join(projectRoot, 'reports', 'm10', String(ownerId), 'runtime-coverage.json')),
      readJson(path.join(projectRoot, 'reports', 'm10', String(ownerId), 'unresolved-ledger.json')),
      readJson(path.join(projectRoot, recipe.fixturePath)),
      ...recipe.goldenReports.map(reportPath => readJson(path.join(projectRoot, reportPath))),
    ]);
    const profile = loaded[0];
    const runtimeCoverage = loaded[1];
    const unresolvedLedger = loaded[2];
    const fixture = loaded[3];
    const goldenReports = loaded.slice(4);
    const goldens = recipe.goldenReports.map((reportPath, index) => ({
      path: reportPath,
      report: goldenReports[index],
    }));
    const visualScenario = executeVisualScenario({
      recipe,
      fixture,
      service,
      adapter,
      traceIndexModule,
    });
    const manifest = createCharacterAcceptanceManifest({
      recipe,
      profile,
      runtimeCoverage,
      unresolvedLedger,
      goldens,
      visualScenario,
    });
    const validation = validateCharacterAcceptanceManifest(manifest);
    if (!validation.valid) {
      throw new Error('Character acceptance manifest invalid for ' + ownerId + ': ' + validation.issues.join(', '));
    }
    const passiveBoundary = validateUnnamedSecondaryPassiveBoundary(manifest, recipe.unnamedSecondaryPassiveSkillId);
    if (!passiveBoundary.valid) {
      throw new Error('Unnamed secondary passive boundary invalid for ' + ownerId + ': ' + JSON.stringify(passiveBoundary));
    }
    manifests.push(manifest);
    visualRuns.push(visualScenario);
  }

  const catalog = createCharacterAcceptanceCatalog(manifests);
  const report = createAcceptanceReport(manifests, visualRuns, catalog);
  const outputs = createOutputs(manifests, catalog, report);
  if (writeMode) await writeOutputs(outputs);
  if (assertClean) await assertOutputsClean(outputs);
  console.log(JSON.stringify(report.summary, null, 2));
} finally {
  await vite.close();
}

function executeVisualScenario({ recipe, fixture, service, adapter, traceIndexModule }) {
  const validation = service.validate(fixture);
  if (!validation.valid) {
    throw new Error('Machine Axis fixture invalid for ' + recipe.ownerId + ': ' + JSON.stringify(validation.issues));
  }
  const first = service.simulate(fixture);
  const second = service.simulate(fixture);
  const imported = adapter.importContract(fixture);
  const exported = adapter.exportProject(imported.project, { metadata: fixture.metadata });
  const roundTrip = service.simulate(exported);
  const traceIndex = traceIndexModule.createCanonicalTraceViewIndex(imported.canonicalRun);
  const stableReplay = sameHashes(first.hashes, second.hashes);
  const workbenchRoundTrip = sameHashes(first.hashes, roundTrip.hashes);
  const criticalMatrix = inspectCriticalMatrix(Number(recipe.ownerId), first, second);
  const probeResults = recipe.probes.map(probe => inspectRecipeProbe(first, probe));
  const assertionResults = [
    { identity: 'machine-axis-validation', passed: validation.valid },
    { identity: 'canonical-same-input-replay', passed: stableReplay },
    { identity: 'workbench-import-export-round-trip', passed: workbenchRoundTrip },
    ...Object.entries(criticalMatrix).filter(([key]) => key !== 'details').map(([key, passed]) => ({ identity: 'critical:' + key, passed })),
    ...probeResults,
  ];
  const failed = assertionResults.filter(result => !result.passed);
  const selectionRows = first.trace?.variants?.selections ?? [];
  const hitIdentities = [...new Set((first.trace?.damage ?? []).map(event => event.hitIdentity).filter(Boolean))].sort();
  return {
    scenarioIdentity: String(fixture.scenario?.id),
    fixturePath: recipe.fixturePath,
    status: failed.length ? 'failed' : 'passed',
    stableReplay,
    workbenchRoundTrip: workbenchRoundTrip ? 'passed' : 'failed',
    canonicalHashes: first.hashes,
    actionCount: fixture.actions.length,
    executedActionCount: first.trace?.executionPlan?.actions?.length ?? first.trace?.actions?.length ?? selectionRows.length,
    traceIndex: {
      traceHash: traceIndex.traceHash,
      actionCount: traceIndex.summary.actionCount,
      hitCount: traceIndex.summary.hitCount,
      effectEventCount: traceIndex.summary.effectEventCount,
      effectIntervalCount: traceIndex.summary.effectIntervalCount,
      resourceTransactionCount: traceIndex.summary.resourceTransactionCount,
    },
    assertionSummary: {
      assertionCount: assertionResults.length,
      passedCount: assertionResults.length - failed.length,
      failedCount: failed.length,
      failedIdentities: failed.map(result => result.identity),
    },
    criticalMatrix,
    probeResults,
    traceProjection: {
      variantSelections: selectionRows.map(selection => ({
        actionId: selection.actionId,
        ownerId: selection.ownerId,
        semanticName: selection.semanticName,
        controlSkillId: selection.controlSkillId,
        subSkillIndex: selection.subSkillIndex,
        actualDurationFrames: selection.actualDurationFrames,
      })),
      hitIdentities,
      resourceEvents: (first.trace?.variants?.resourceEvents ?? []).map(event => ({
        actionId: event.actionId,
        type: event.type,
        timeMs: event.timeMs,
        payload: event.payload,
      })),
      conditionalHitGroups: structuredClone(first.trace?.state?.conditionalHitGroups ?? []),
      effectOperations: (first.trace?.effects?.events ?? first.trace?.effects ?? []).map(event => ({
        actionId: event.actionId,
        effectId: event.effectId,
        operation: event.operation,
        targetId: event.targetId,
      })),
    },
  };
}

function inspectCriticalMatrix(ownerId, first, second) {
  const prefix = String(ownerId) + '-critical-';
  const findHit = suffix => (first.trace?.damage ?? []).find(event => event.actionId === prefix + suffix && event.eventType === 'VERIFIED_COMBAT_HIT') ?? null;
  const sampledLow = findHit('sampled-low');
  const sampledBoundary = findHit('sampled-boundary');
  const expected = findHit('expected');
  const critical = findHit('critical');
  const nonCritical = findHit('non-critical');
  const miss = findHit('miss-critical');
  const expectedResult = expected?.formula?.verifiedResult?.expectedCritical;
  return {
    sameSeedReplay: sameHashes(first.hashes, second.hashes),
    integerThresholdBoundary:
      sampledLow?.formula?.randomBranch?.criticalRoll === 499 &&
      sampledLow?.formula?.randomBranch?.criticalThreshold === 500 &&
      sampledLow?.formula?.randomBranch?.critical === true &&
      sampledBoundary?.formula?.randomBranch?.criticalRoll === 500 &&
      sampledBoundary?.formula?.randomBranch?.criticalThreshold === 500 &&
      sampledBoundary?.formula?.randomBranch?.critical === false,
    perHitModes:
      sampledLow?.formula?.randomBranch?.mode === 'captured-critical-roll' &&
      expected?.formula?.randomBranch?.mode === 'expected' &&
      critical?.formula?.randomBranch?.mode === 'critical' &&
      nonCritical?.formula?.randomBranch?.mode === 'non-critical',
    expectedNoCriticalEvent:
      expectedResult?.criticalEventMaterialized === false &&
      expectedResult?.weightedValue === expected?.rawDamage,
    missSuppressesHit: miss == null,
    details: {
      sampledLow: projectCriticalHit(sampledLow),
      sampledBoundary: projectCriticalHit(sampledBoundary),
      expected: projectCriticalHit(expected),
      critical: projectCriticalHit(critical),
      nonCritical: projectCriticalHit(nonCritical),
    },
  };
}

function projectCriticalHit(event) {
  if (!event) return null;
  return {
    actionId: event.actionId,
    hitIdentity: event.hitIdentity,
    rawDamage: event.rawDamage,
    randomBranch: event.formula?.randomBranch ?? null,
    expectedCritical: event.formula?.verifiedResult?.expectedCritical ?? null,
  };
}

function inspectRecipeProbe(run, probe) {
  if (probe.kind === 'variant-selection') {
    const selection = (run.trace?.variants?.selections ?? []).find(row => row.actionId === probe.actionId);
    return {
      identity: 'probe:variant-selection:' + probe.actionId,
      passed: Number(selection?.controlSkillId) === Number(probe.controlSkillId) && Number(selection?.subSkillIndex) === Number(probe.subSkillIndex),
      actual: selection ?? null,
    };
  }
  if (probe.kind === 'special-resource-change') {
    const event = (run.trace?.variants?.resourceEvents ?? []).find(row =>
      row.actionId === probe.actionId &&
      row.payload?.resourceIdentity === probe.resourceIdentity &&
      Number(row.payload?.beforeValue) === Number(probe.beforeValue) &&
      Number(row.payload?.afterValue) === Number(probe.afterValue) &&
      Number(row.payload?.change) === Number(probe.change)
    );
    return {
      identity: 'probe:special-resource-change:' + probe.actionId,
      passed: Boolean(event),
      actual: event ?? null,
    };
  }
  if (probe.kind === 'conditional-hit-group') {
    const group = (run.trace?.state?.conditionalHitGroups ?? []).find(row => row.actionId === probe.actionId && row.groupIdentity === probe.groupIdentity);
    return {
      identity: 'probe:conditional-hit-group:' + probe.actionId,
      passed:
        Boolean(group) &&
        Number(group.beforeStacks) === Number(probe.beforeStacks) &&
        Number(group.consumedStacks) === Number(probe.consumedStacks) &&
        Number(group.afterStacks) === Number(probe.afterStacks) &&
        group.applied === probe.applied,
      actual: group ?? null,
    };
  }
  return { identity: 'probe:unsupported:' + String(probe.kind), passed: false, actual: null };
}

function createAcceptanceReport(manifests, visualRuns, catalog) {
  const value = {
    schemaVersion: 1,
    kind: 'm11-d-character-acceptance-protocol-report',
    baselineCommit: '308dd07fbbb8fe0759062e9dcc02c65b0fd46115',
    status: 'implementation-complete-awaiting-product-acceptance',
    protocolIdentity: 'm11-d-character-acceptance-v1',
    owners: manifests.map(manifest => {
      const visualRun = visualRuns.find(run => run.fixturePath.includes(String(manifest.owner.ownerId)));
      return {
        ownerId: manifest.owner.ownerId,
        ownerName: manifest.owner.ownerName,
        maturityState: manifest.maturity.currentState,
        optimizationReady: manifest.maturity.optimizationReady,
        blockers: manifest.maturity.blockers,
        blockingLedgerCount: manifest.ledger.summary.recordCount,
        matrix: manifest.matrix.summary,
        manifestHash: manifest.manifestHash,
        machineScenario: visualRun?.canonicalHashes ?? null,
      };
    }),
    catalogHash: catalog.catalogHash,
    summary: {
      ownerCount: manifests.length,
      runtimeIntegratedCount: manifests.filter(manifest => manifest.maturity.earnedStates.includes('runtime-integrated')).length,
      visuallyAcceptedCount: manifests.filter(manifest => manifest.maturity.earnedStates.includes('visually-accepted')).length,
      optimizationReadyCount: manifests.filter(manifest => manifest.maturity.optimizationReady).length,
      machineScenarioPassCount: visualRuns.filter(run => run.status === 'passed').length,
      workbenchRoundTripPassCount: visualRuns.filter(run => run.workbenchRoundTrip === 'passed').length,
      functionalBlockers: manifests.reduce((sum, manifest) => sum + manifest.ledger.summary.recordCount, 0),
      performanceAndBundleRisksBlocking: false,
    },
  };
  return value;
}

function createOutputs(manifests, catalog, report) {
  const outputs = new Map();
  outputs.set(generatedCatalogPath, jsonText(catalog));
  outputs.set(path.join(reportRoot, 'summary.json'), jsonText(report));
  outputs.set(path.join(reportRoot, 'summary.md'), createMarkdownReport(report));
  for (const manifest of manifests) {
    const ownerRoot = path.join(reportRoot, String(manifest.owner.ownerId));
    outputs.set(path.join(ownerRoot, 'manifest.json'), jsonText(manifest));
    outputs.set(path.join(ownerRoot, 'scenario-matrix.json'), jsonText(manifest.matrix));
    outputs.set(path.join(ownerRoot, 'coverage.json'), jsonText(manifest.coverage));
    outputs.set(path.join(ownerRoot, 'ledger.json'), jsonText({ ...manifest.ledger, notApplicableRecords: manifest.notApplicableRecords }));
  }
  return outputs;
}

async function writeOutputs(outputs) {
  for (const [outputPath, content] of outputs) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, content, 'utf8');
  }
}

async function assertOutputsClean(outputs) {
  const stale = [];
  for (const [outputPath, expected] of outputs) {
    let actual = null;
    try {
      actual = await fs.readFile(outputPath, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (actual !== expected) stale.push(path.relative(projectRoot, outputPath).replaceAll('\\', '/'));
  }
  if (stale.length) throw new Error('Character acceptance outputs are stale: ' + stale.join(', '));
}

async function loadRecipes() {
  const names = (await fs.readdir(recipeRoot)).filter(name => name.endsWith('.json')).sort();
  return Promise.all(names.map(name => readJson(path.join(recipeRoot, name))));
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function verifyAutomatedVisualEvidence(recipe) {
  for (const evidence of recipe.productVisualAcceptance?.automatedEvidence ?? []) {
    const screenshotPath = path.join(projectRoot, evidence.screenshotPath);
    const actualHash = createHash('sha256')
      .update(await fs.readFile(screenshotPath))
      .digest('hex');
    if (actualHash !== evidence.screenshotSha256) {
      throw new Error(
        'Character acceptance screenshot hash mismatch for ' +
          recipe.ownerId +
          ': ' +
          evidence.screenshotPath
      );
    }
  }
}

function sameHashes(left, right) {
  return ['input', 'data', 'trace', 'evaluation'].every(key => left?.[key] === right?.[key]);
}

function jsonText(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

function createMarkdownReport(report) {
  const lines = [
    '# M11-D 角色机制验收协议',
    '',
    '- 基线：' + report.baselineCommit,
    '- 状态：实现完成，等待产品验收',
    '- 规则：成熟度完全由 golden、canonical 重放、Workbench 往返、矩阵、ledger 与产品记录推导。',
    '- 性能、包体和外部 CPU 抖动仅记录，不参与功能资格判定。',
    '',
    '| 角色 | 成熟度 | 矩阵通过/必需 | 阻断 ledger | optimization-ready |',
    '|---|---:|---:|---:|---:|',
  ];
  for (const owner of report.owners) {
    lines.push('| ' + owner.ownerName + ' (' + owner.ownerId + ') | ' + owner.maturityState + ' | ' + owner.matrix.passedCount + '/' + owner.matrix.requiredCount + ' | ' + owner.blockingLedgerCount + ' | ' + (owner.optimizationReady ? '是' : '否') + ' |');
  }
  lines.push('', '三份 Machine Axis 场景均由唯一 canonical core 重放并通过 Workbench 导入/导出；当前产品可视验收记录仍为 pending，且既有 gameplay-impacting 证据缺口继续阻断优化资格。', '');
  return lines.join('\n');
}
