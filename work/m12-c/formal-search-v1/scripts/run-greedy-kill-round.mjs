import childProcess from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { createServer } from 'vite';

import {
  FORMAL_SEARCH_ARTIFACT_SCHEMA_VERSION,
  FORMAL_SEARCH_RANKING_CLAIM,
  aggregateShardResults,
  readJson,
  sha256Canonical,
  sha256Text,
  validateNormalAttackInputAuthorityDescriptor,
  writeJsonAtomic,
} from './formal-search-artifacts.mjs';
import {
  GREEDY_NORMAL_SYNTHESIS_ID,
  assertGreedyNormalSynthesisAvailable,
  classifyGreedyKillProbe,
  deriveGreedyNormalCadence,
  synthesizeGreedyNormalAxis,
} from './greedy-normal-axis.mjs';

const execFile = promisify(childProcess.execFile);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..', '..', '..', '..');
const configArgument = readArgument('--config');
if (!configArgument) throw new Error('--config is required');
const configPath = resolveRepositoryPath(configArgument);
const config = await readJson(configPath);
validateConfig(config);
assertGreedyNormalSynthesisAvailable();
const outputRoot = resolveRepositoryPath(config.outputRoot);
const roundDirectory = path.join(
  outputRoot,
  'objectives',
  config.objective,
  config.roundId
);
const lockPath = path.join(outputRoot, '.formal-search.lock.json');
const releaseLock = await acquireProcessLock(lockPath, config);
let vite = null;

try {
  await assertNoOtherSearchProcess();
  await assertBaseline(config.baseline);
  await assertReleaseAuthority(config.baseline);
  const contractTemplate = await readJson(
    resolveRepositoryPath(config.contractTemplate)
  );
  const guidanceInput = await readJson(
    resolveRepositoryPath(config.guidanceFile)
  );
  const mechanicsPackage = await readJson(
    path.join(
      projectRoot,
      'src',
      'data',
      'generated',
      'verified-combat-mechanics-package.json'
    )
  );
  vite = await createServer({
    root: projectRoot,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  });
  const modules = await loadModules(vite);
  modules.packageModule.installVerifiedCombatMechanicsPackage(mechanicsPackage);
  const normalAttackInputAuthority =
    modules.normalAttackInputAuthorityModule.getVerifiedNormalAttackInputAuthorityDescriptor();
  if (
    !validateNormalAttackInputAuthorityDescriptor(normalAttackInputAuthority)
      .valid
  ) {
    throw new Error('Verified normal-attack input authority is invalid');
  }
  const service = modules.serviceModule.createMachineAxisService();
  const outerBuildService =
    modules.outerBuildModule.createM12cOuterBuildService();
  const outerSearchService =
    modules.outerSearchModule.createM12cOuterSearchService({
      machineAxisService: service,
      outerBuildService,
    });
  const normalizedGuidance =
    modules.guidanceModule.normalizeSearchGuidance(guidanceInput);
  if (!normalizedGuidance.valid) {
    throw new Error(
      `Guidance invalid: ${JSON.stringify(normalizedGuidance.issues)}`
    );
  }
  if (
    normalizedGuidance.guidance.objective !== 'fastest-kill' ||
    !['inner', 'both'].includes(normalizedGuidance.guidance.layer)
  ) {
    throw new Error('Greedy kill guidance must bind fastest-kill inner search');
  }
  const guidanceHash = normalizedGuidance.guidanceHash;
  const contractTemplateHash = sha256Canonical(contractTemplate);
  const presetSpecHash = sha256Canonical(config.presetSpec);
  const orchestrationSourceHashes = {
    runGreedyKillRoundSha256: sha256Text(
      await fs.readFile(fileURLToPath(import.meta.url), 'utf8')
    ),
    greedyNormalAxisSha256: sha256Text(
      await fs.readFile(
        path.join(scriptDirectory, 'greedy-normal-axis.mjs'),
        'utf8'
      )
    ),
    artifactLibrarySha256: sha256Text(
      await fs.readFile(
        path.join(scriptDirectory, 'formal-search-artifacts.mjs'),
        'utf8'
      )
    ),
  };
  const orchestrationIdentityHash = sha256Canonical({
    orchestratorId: 'azpr-m12c-formal-greedy-kill-shard-orchestrator-v1',
    ...orchestrationSourceHashes,
    normalAttackInputAuthority,
  });
  const pool = outerBuildService.pool();
  const sourceConfigs = selectSourceConfigs(pool, config);
  if (sourceConfigs.length !== Number(config.expectedSourceConfigCount)) {
    throw new Error('Greedy kill source-config coverage count mismatch');
  }
  const roundManifest = {
    schemaVersion: FORMAL_SEARCH_ARTIFACT_SCHEMA_VERSION,
    kind: 'azpr-m12c-formal-search-round-manifest',
    runId: config.runId,
    roundId: config.roundId,
    iteration: config.iteration,
    objective: config.objective,
    rankingClaim: FORMAL_SEARCH_RANKING_CLAIM,
    formalRankingReady: false,
    baseline: config.baseline,
    roundConfigPath: repositoryRelative(configPath),
    roundConfigHash: sha256Canonical(config),
    orchestratorId: 'azpr-m12c-formal-greedy-kill-shard-orchestrator-v1',
    orchestrationSourceHashes,
    orchestrationIdentityHash,
    normalAttackInputAuthority,
    synthesisId: GREEDY_NORMAL_SYNTHESIS_ID,
    contractTemplatePath: config.contractTemplate,
    contractTemplateHash,
    guidancePath: config.guidanceFile,
    guidanceHash,
    guidanceProvenance: normalizedGuidance.guidance.provenance,
    previousFeedbackAggregate: config.previousFeedbackAggregate,
    presetSpec: config.presetSpec,
    presetSpecHash,
    topN: config.topN,
    sourceConfigCount: sourceConfigs.length,
    sourceConfigIdentities: sourceConfigs.map(row => row.sourceConfigIdentity),
    sourceConfigUniverseHash: sha256Canonical(
      sourceConfigs.map(row => row.sourceConfigIdentity)
    ),
    refinementInitialFrontOptimizationObjectId:
      config.refinementInitialFrontOptimizationObjectId,
    firstProbeActionCount: config.firstProbeActionCount,
    maxActionCount: config.maxActionCount,
    stopPolicy: config.stopPolicy,
  };
  await writeJsonAtomic(
    path.join(roundDirectory, 'round-manifest.json'),
    roundManifest
  );
  emit({
    event: 'round-started',
    runId: config.runId,
    roundId: config.roundId,
    objective: config.objective,
    sourceConfigCount: sourceConfigs.length,
    guidanceHash,
    presetSpecHash,
    baselineHead: config.baseline.head,
  });

  for (let index = 0; index < sourceConfigs.length; index += 1) {
    const sourceConfig = sourceConfigs[index];
    const shardDirectory = path.join(
      roundDirectory,
      'shards',
      createShardDirectoryName(sourceConfig, index)
    );
    const shardId = `m12c-greedy-kill-shard:${sha256Canonical({
      runId: config.runId,
      roundId: config.roundId,
      objective: config.objective,
      sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
      guidanceHash,
      presetSpecHash,
      contractTemplateHash,
      orchestrationIdentityHash,
      normalAttackInputContractHash: normalAttackInputAuthority.contractHash,
    }).slice(0, 24)}`;
    const inputEnvelope = {
      schemaVersion: FORMAL_SEARCH_ARTIFACT_SCHEMA_VERSION,
      kind: 'azpr-m12c-formal-greedy-kill-shard-input',
      runId: config.runId,
      roundId: config.roundId,
      objective: config.objective,
      shardId,
      baseline: config.baseline,
      sourceConfig: projectSourceConfig(sourceConfig),
      buildConstraints: config.buildConstraints,
      initialState: materializeInitialState(config.presetSpec, sourceConfig),
      refinementInitialFrontOptimizationObjectId:
        config.refinementInitialFrontOptimizationObjectId,
      firstProbeActionCount: config.firstProbeActionCount,
      maxActionCount: config.maxActionCount,
      guidanceHash,
      guidanceProvenance: normalizedGuidance.guidance.provenance,
      presetSpecHash,
      contractTemplateHash,
      orchestrationIdentityHash,
      normalAttackInputAuthority,
    };
    const inputHash = sha256Canonical(inputEnvelope);
    const checkpointPath = path.join(shardDirectory, 'checkpoint.json');
    const previousCheckpoint = await readJsonIfExists(checkpointPath);
    if (previousCheckpoint?.status === 'completed') {
      if (
        previousCheckpoint.inputHash !== inputHash ||
        previousCheckpoint.guidanceHash !== guidanceHash ||
        previousCheckpoint.normalAttackInputAuthority?.contractHash !==
          normalAttackInputAuthority.contractHash
      ) {
        throw new Error(`Completed shard input drift: ${shardId}`);
      }
      const previousResult = await readJson(
        path.join(shardDirectory, 'result.json')
      );
      if (
        sha256Canonical(previousResult) !==
        previousCheckpoint.artifacts?.resultCanonicalSha256
      ) {
        throw new Error(`Completed shard result hash mismatch: ${shardId}`);
      }
      emit({
        event: 'shard-resumed',
        index: index + 1,
        total: sourceConfigs.length,
        shardId,
        sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
      });
      continue;
    }
    const attempt = Number(previousCheckpoint?.attempt ?? 0) + 1;
    const startedAt = new Date().toISOString();
    await writeJsonAtomic(
      path.join(shardDirectory, 'input.json'),
      inputEnvelope
    );
    await writeJsonAtomic(path.join(shardDirectory, 'guidance.json'), {
      ...normalizedGuidance.guidance,
      guidanceHash,
    });
    await writeJsonAtomic(checkpointPath, {
      schemaVersion: FORMAL_SEARCH_ARTIFACT_SCHEMA_VERSION,
      kind: 'azpr-m12c-formal-search-shard-checkpoint',
      runId: config.runId,
      roundId: config.roundId,
      objective: config.objective,
      shardId,
      attempt,
      status: 'running',
      exitStatus: 'running',
      startedAt,
      finishedAt: null,
      baseline: config.baseline,
      inputHash,
      guidanceHash,
      presetSpecHash,
      contractTemplateHash,
      orchestrationIdentityHash,
      normalAttackInputAuthority,
      coverage: createCoverage(sourceConfig, index, sourceConfigs.length),
    });
    emit({
      event: 'shard-started',
      index: index + 1,
      total: sourceConfigs.length,
      shardId,
      sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
      attempt,
    });
    try {
      const shardRun = await runGreedyShard({
        service,
        outerBuildService,
        outerSearchService,
        pool,
        modules,
        contractTemplate,
        sourceConfig,
        shardDirectory,
        inputHash,
        guidanceHash,
        presetSpecHash,
        orchestrationIdentityHash,
        normalAttackInputAuthority,
        config,
      });
      const resultArtifact = {
        schemaVersion: FORMAL_SEARCH_ARTIFACT_SCHEMA_VERSION,
        kind: 'azpr-m12c-formal-search-shard-result',
        runId: config.runId,
        roundId: config.roundId,
        objective: config.objective,
        rankingClaim: FORMAL_SEARCH_RANKING_CLAIM,
        formalRankingReady: false,
        shardId,
        baseline: config.baseline,
        sourceConfig: projectSourceConfig(sourceConfig),
        inputHash,
        guidanceHash,
        presetSpecHash,
        contractTemplateHash,
        orchestrationIdentityHash,
        normalAttackInputAuthority,
        serviceRequestHash: inputHash,
        serviceResult: shardRun.serviceResult,
      };
      const feedbackArtifact = {
        schemaVersion: 1,
        contractName: 'AzPrMachineAxisSearchFeedback',
        kind: 'azpr-machine-axis-search-feedback',
        objective: 'fastest-kill',
        rankingClaim: FORMAL_SEARCH_RANKING_CLAIM,
        formalRankingReady: false,
        guidanceHash,
        budgetUsage: shardRun.feedback.budgetUsage,
        rankingBoundary: shardRun.feedback.rankingBoundary,
        rejectionBreakdown: shardRun.feedback.rejectionBreakdown,
        recommendations: shardRun.feedback.recommendations,
        boundarySearch: shardRun.feedback.boundarySearch,
        formalShard: {
          runId: config.runId,
          roundId: config.roundId,
          shardId,
          sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
          inputHash,
          presetSpecHash,
          baselineHead: config.baseline.head,
        },
      };
      const resultWrite = await writeJsonAtomic(
        path.join(shardDirectory, 'result.json'),
        resultArtifact
      );
      const feedbackWrite = await writeJsonAtomic(
        path.join(shardDirectory, 'feedback.json'),
        feedbackArtifact
      );
      const checkpoint = {
        schemaVersion: FORMAL_SEARCH_ARTIFACT_SCHEMA_VERSION,
        kind: 'azpr-m12c-formal-search-shard-checkpoint',
        runId: config.runId,
        roundId: config.roundId,
        objective: config.objective,
        shardId,
        attempt,
        status: 'completed',
        exitStatus: 'completed-with-results',
        startedAt,
        finishedAt: new Date().toISOString(),
        baseline: config.baseline,
        inputHash,
        guidanceHash,
        presetSpecHash,
        contractTemplateHash,
        orchestrationIdentityHash,
        normalAttackInputAuthority,
        serviceRequestHash: inputHash,
        coverage: {
          ...createCoverage(sourceConfig, index, sourceConfigs.length),
          buildCount: 1,
          variantSearchCount: 1,
          processedVariantKeyCount: 1,
        },
        summary: shardRun.serviceResult.summary,
        artifacts: {
          resultPath: repositoryRelative(resultWrite.path),
          resultFileSha256: resultWrite.sha256,
          resultCanonicalSha256: sha256Canonical(resultArtifact),
          resultBytes: resultWrite.bytes,
          feedbackPath: repositoryRelative(feedbackWrite.path),
          feedbackFileSha256: feedbackWrite.sha256,
          feedbackCanonicalSha256: sha256Canonical(feedbackArtifact),
          feedbackBytes: feedbackWrite.bytes,
          progressPath: repositoryRelative(
            path.join(shardDirectory, 'progress.json')
          ),
        },
      };
      await writeJsonAtomic(checkpointPath, checkpoint);
      emit({
        event: 'shard-completed',
        index: index + 1,
        total: sourceConfigs.length,
        shardId,
        sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
        resultCount: 1,
        candidatesEvaluated: shardRun.serviceResult.summary.candidatesEvaluated,
        wallTimeMs: shardRun.serviceResult.summary.wallTimeMs,
        actionCount: shardRun.feedback.boundarySearch.killedActionCount,
        score: shardRun.serviceResult.results[0].score,
      });
    } catch (error) {
      const failureArtifact = {
        schemaVersion: 1,
        kind: 'azpr-m12c-formal-search-shard-failure',
        runId: config.runId,
        roundId: config.roundId,
        objective: config.objective,
        shardId,
        attempt,
        baseline: config.baseline,
        sourceConfig: projectSourceConfig(sourceConfig),
        inputHash,
        guidanceHash,
        startedAt,
        finishedAt: new Date().toISOString(),
        error: normalizeError(error),
      };
      const failurePath = path.join(
        shardDirectory,
        `failure.attempt-${String(attempt).padStart(2, '0')}.json`
      );
      await writeJsonAtomic(failurePath, failureArtifact);
      await writeJsonAtomic(checkpointPath, {
        schemaVersion: 1,
        kind: 'azpr-m12c-formal-search-shard-checkpoint',
        runId: config.runId,
        roundId: config.roundId,
        objective: config.objective,
        shardId,
        attempt,
        status: 'failed',
        exitStatus: 'failed-exception',
        startedAt,
        finishedAt: new Date().toISOString(),
        baseline: config.baseline,
        inputHash,
        guidanceHash,
        presetSpecHash,
        contractTemplateHash,
        orchestrationIdentityHash,
        normalAttackInputAuthority,
        coverage: createCoverage(sourceConfig, index, sourceConfigs.length),
        failurePath: repositoryRelative(failurePath),
        error: normalizeError(error),
      });
      emit({
        event: 'shard-failed',
        index: index + 1,
        total: sourceConfigs.length,
        shardId,
        sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
        error: normalizeError(error),
      });
    }
    const aggregate = await rebuildAggregate({
      roundDirectory,
      roundManifest,
      sourceConfigs,
    });
    emit({
      event: 'round-checkpoint',
      completedSourceConfigs:
        aggregate.coverage.completedSourceConfigIdentities.length,
      failedSourceConfigs:
        aggregate.coverage.failedSourceConfigIdentities.length,
      missingSourceConfigs:
        aggregate.coverage.missingSourceConfigIdentities.length,
      validDistinctCandidates: aggregate.summary.validDistinctCandidateCount,
      topNReady: aggregate.summary.topNReady,
      cutoffScore: aggregate.summary.cutoffScore,
      aggregateHash: aggregate.aggregateHash,
    });
  }
  const aggregate = await rebuildAggregate({
    roundDirectory,
    roundManifest,
    sourceConfigs,
  });
  const completed = aggregate.coverage.completedSourceConfigIdentities.length;
  const failed = aggregate.coverage.failedSourceConfigIdentities.length;
  const missing = aggregate.coverage.missingSourceConfigIdentities.length;
  const status =
    completed === sourceConfigs.length && failed === 0 && missing === 0
      ? 'completed'
      : 'partial';
  await writeJsonAtomic(path.join(roundDirectory, 'round-checkpoint.json'), {
    schemaVersion: 1,
    kind: 'azpr-m12c-formal-search-round-checkpoint',
    runId: config.runId,
    roundId: config.roundId,
    objective: config.objective,
    status,
    exitStatus: status,
    aggregateHash: aggregate.aggregateHash,
    guidanceHash,
    presetSpecHash,
    baseline: config.baseline,
    orchestrationIdentityHash,
    normalAttackInputAuthority,
    coverage: aggregate.coverage,
    summary: aggregate.summary,
  });
  emit({
    event: 'round-finished',
    status,
    runId: config.runId,
    roundId: config.roundId,
    objective: config.objective,
    aggregateHash: aggregate.aggregateHash,
    completedSourceConfigs: completed,
    failedSourceConfigs: failed,
    missingSourceConfigs: missing,
    topNReady: aggregate.summary.topNReady,
    topResultCount: aggregate.results.length,
    cutoffScore: aggregate.summary.cutoffScore,
    cutoffTieCount: aggregate.summary.cutoffTieCount,
  });
  if (status !== 'completed') process.exitCode = 2;
} finally {
  if (vite) await vite.close();
  await releaseLock();
}

async function runGreedyShard({
  service,
  outerBuildService,
  outerSearchService,
  pool,
  modules,
  contractTemplate,
  sourceConfig,
  shardDirectory,
  inputHash,
  guidanceHash,
  presetSpecHash,
  orchestrationIdentityHash,
  normalAttackInputAuthority,
  config,
}) {
  const started = Date.now();
  const planResult = outerBuildService.plan({
    sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
    constraints: { perActor: config.buildConstraints },
  });
  if (!planResult.valid || !planResult.plan) {
    throw new Error(`Build plan failed: ${JSON.stringify(planResult.issues)}`);
  }
  const [build] = [
    ...outerBuildService.iterate(planResult.plan, { maxCandidates: 1 }),
  ];
  if (!build) throw new Error('No build candidate resolved');
  const binding = await outerSearchService.bind({
    contract: contractTemplate,
    build,
    objective: 'fastest-kill',
    initialFrontOptimizationObjectId:
      config.refinementInitialFrontOptimizationObjectId,
    initialState: materializeInitialState(config.presetSpec, sourceConfig),
  });
  const generator = modules.generatorModule.createMachineAxisSearchGenerator({
    service,
  });
  const firstRun = service.simulate(binding.contract);
  const first = requireSingleNormalCandidate(
    generator,
    binding.contract,
    firstRun,
    modules
  );
  const oneAxis = {
    ...structuredClone(binding.contract),
    actions: [structuredClone(first.action)],
  };
  const secondRun = service.simulate(oneAxis);
  const second = requireSingleNormalCandidate(
    generator,
    oneAxis,
    secondRun,
    modules
  );
  const cadence = deriveGreedyNormalCadence(first.action, second.action);
  const progressPath = path.join(shardDirectory, 'progress.json');
  const previous = await readJsonIfExists(progressPath);
  if (
    previous &&
    (previous.inputHash !== inputHash ||
      previous.guidanceHash !== guidanceHash ||
      previous.cadenceHash !== cadence.cadenceHash)
  ) {
    throw new Error('Greedy shard progress identity drift; use a new round');
  }
  let lower = Number(previous?.validNotKilledLowerBound ?? 0);
  let upper = previous?.firstNonUnkilledUpperBound ?? null;
  upper = upper == null ? null : Number(upper);
  let probeRows = [...(previous?.probes ?? [])];
  const runtimeCache = new Map();

  const runProbe = actionCount => {
    if (runtimeCache.has(actionCount)) return runtimeCache.get(actionCount);
    const axis = synthesizeGreedyNormalAxis({
      baseAxis: binding.contract,
      cadence,
      actionCount,
    });
    const probeStarted = Date.now();
    let row;
    try {
      const simulation = service.simulate(axis);
      const proof = modules.killModule.createFastestKillProof(
        simulation,
        axis,
        { objectiveContract: axis.scenario.objectiveContract }
      );
      const enemy = simulation.trace?.state?.final?.enemy ?? {};
      row = {
        actionCount,
        wallTimeMs: Date.now() - probeStarted,
        classification: classifyGreedyKillProbe({ proof }),
        enemyHp: enemy.hp ?? null,
        enemyMaxHp: enemy.maxHp ?? null,
        legalityPassed: simulation.actionLegalityProof?.passed === true,
        inputHash: simulation.hashes?.input ?? null,
        traceHash: simulation.hashes?.trace ?? null,
        axis,
        simulation,
        proof,
      };
    } catch (error) {
      row = {
        actionCount,
        wallTimeMs: Date.now() - probeStarted,
        classification: classifyGreedyKillProbe({ error }),
        error: normalizeError(error),
      };
    }
    runtimeCache.set(actionCount, row);
    probeRows = [
      ...probeRows.filter(existing => existing.actionCount !== actionCount),
      projectProbe(row),
    ].sort((left, right) => left.actionCount - right.actionCount);
    return row;
  };
  const persistProgress = status =>
    writeJsonAtomic(progressPath, {
      schemaVersion: 1,
      kind: 'azpr-m12c-formal-greedy-kill-shard-progress',
      status,
      inputHash,
      guidanceHash,
      presetSpecHash,
      orchestrationIdentityHash,
      normalAttackInputAuthority,
      sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
      buildHash: build.buildHash,
      initialFront: binding.initialFront,
      synthesisId: GREEDY_NORMAL_SYNTHESIS_ID,
      cadenceHash: cadence.cadenceHash,
      cadenceFrames: cadence.cadenceFrames,
      cadencePublicActionId: cadence.publicActionId,
      validNotKilledLowerBound: lower,
      firstNonUnkilledUpperBound: upper,
      probes: probeRows,
      updatedAt: new Date().toISOString(),
    });

  if (upper == null) {
    let count =
      lower > 0
        ? Math.min(Number(config.maxActionCount), lower * 2)
        : Number(config.firstProbeActionCount);
    while (true) {
      const row = runProbe(count);
      if (row.classification.status === 'valid-not-killed') {
        lower = count;
        await persistProgress('running');
        if (count >= Number(config.maxActionCount)) {
          throw new Error('Greedy kill maxActionCount reached without kill');
        }
        count = Math.min(Number(config.maxActionCount), count * 2);
      } else {
        upper = count;
        await persistProgress('running');
        break;
      }
    }
  }
  while (upper - lower > 1) {
    const middle = Math.floor((lower + upper) / 2);
    const row = runProbe(middle);
    if (row.classification.status === 'valid-not-killed') lower = middle;
    else upper = middle;
    await persistProgress('running');
  }
  const killed = runProbe(upper);
  if (killed.classification.status !== 'killed-valid') {
    await persistProgress('failed-boundary-not-killed');
    throw new Error(
      `First non-unkilled boundary ${upper} is not a valid killed proof: ${JSON.stringify(killed.classification)}`
    );
  }
  const validation = service.validate(killed.axis);
  if (
    validation.valid !== true ||
    validation.actionLegalityProof?.passed !== true
  ) {
    throw new Error('Final greedy kill axis failed independent validation');
  }
  await persistProgress('completed-killed');
  const candidate = createCandidate({
    axis: killed.axis,
    simulation: killed.simulation,
    proof: killed.proof,
    validation,
    build,
    pool,
    sourceConfig,
    initialFront: binding.initialFront,
  });
  const wallTimeMs = Date.now() - started;
  const rejectionCounts = new Map();
  for (const row of probeRows) {
    for (const code of row.classification?.issueCodes ?? []) {
      rejectionCounts.set(code, Number(rejectionCounts.get(code) ?? 0) + 1);
    }
  }
  const serviceResult = {
    schemaVersion: 1,
    contractName: 'AzPrM12CFormalGreedyKillSearch',
    kind: 'azpr-m12c-formal-greedy-kill-search',
    valid: true,
    objective: 'fastest-kill',
    objectiveContract: killed.axis.scenario.objectiveContract,
    rankingClaim: FORMAL_SEARCH_RANKING_CLAIM,
    formalRankingReady: false,
    requestHash: inputHash,
    guidance: { guidanceHash },
    pool: {
      poolHash: pool.poolHash,
      sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
    },
    executionLedger: {
      processedVariantKeyCount: 1,
      processedVariantKeyChainHash: sha256Canonical({
        sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
        buildHash: build.buildHash,
        initialFront: binding.initialFront,
      }),
    },
    summary: {
      steps: probeRows.length,
      candidatesEvaluated: probeRows.length + 2,
      invalidCandidates: probeRows.filter(
        row => row.classification.status === 'invalid-upper-bound'
      ).length,
      mergedCandidates: 0,
      prunedCandidates: 0,
      expandedCandidates: probeRows.length,
      completedCandidates: 1,
      formalSurfaceRejectedCandidates: 0,
      buildCount: 1,
      variantSearchCount: 1,
      candidateResultCount: 1,
      failureCount: 0,
      wallTimeMs,
      objective: 'fastest-kill',
      topN: 5,
      rankingStatus: 'partial-bounded-not-formal-ranking',
      formalRankingReady: false,
      fullPoolSourceConfigCoverage: false,
      fullPoolEnumerationComplete: false,
      enumerationComplete: false,
    },
    issues: [],
    results: [candidate],
  };
  return {
    serviceResult,
    feedback: {
      budgetUsage: {
        beamWidth: 1,
        maxDepth: config.maxActionCount,
        candidatesEvaluated: probeRows.length + 2,
        wallTimeMs,
      },
      rankingBoundary: {
        validDistinctCandidateCount: 1,
        topNReady: false,
        topScore: candidate.score,
        cutoffScore: null,
        cutoffTieCount: 0,
        topNFamilyCount: 1,
      },
      rejectionBreakdown: [...rejectionCounts.entries()]
        .sort(([left], [right]) => left.localeCompare(right, 'en'))
        .map(([code, count]) => ({ code, count })),
      recommendations: [],
      boundarySearch: {
        synthesisId: GREEDY_NORMAL_SYNTHESIS_ID,
        cadenceHash: cadence.cadenceHash,
        cadenceFrames: cadence.cadenceFrames,
        validNotKilledActionCount: lower,
        killedActionCount: upper,
        killedFrame: killed.proof.killProof.firstLethal.frame,
        killedTimeMs: killed.proof.killProof.firstLethal.timeMs,
        probeCount: probeRows.length,
      },
    },
  };
}

function createCandidate({
  axis,
  simulation,
  proof,
  validation,
  build,
  pool,
  sourceConfig,
  initialFront,
}) {
  const legalityProof = validation.actionLegalityProof;
  return {
    score: Number(proof.formalScore),
    scoreDirection: 'minimize',
    finalScoreEligible: true,
    objectiveProof: proof,
    objectiveIssues: [],
    legality: {
      valid: validation.valid === true && legalityProof?.passed === true,
      issues: validation.issues ?? [],
      warnings: validation.warnings ?? [],
      classification: validation.classification ?? null,
      invalidActionCount: 0,
      proof: legalityProof,
    },
    metrics: {
      killTimeMs: proof.killProof.firstLethal.timeMs,
      killFrame: proof.killProof.firstLethal.frame,
      fixedDurationHpDamage: proof.diagnostics?.fixedDurationHpDamage ?? null,
      rawToughnessDamage: proof.diagnostics?.rawToughnessDamage ?? null,
    },
    criticalPolicy: axis.scenario.critical?.policy ?? null,
    boundariesConsumed: {
      objectiveHash: axis.scenario.objectiveContract?.objectiveHash ?? null,
      initialStatePresetHash:
        axis.scenario.initialStatePreset?.presetHash ?? null,
      enemyProfileHash: axis.scenario.enemy?.profile?.profileHash ?? null,
      jointAttackRuntimeBindingHash:
        axis.scenario.jointAttackRuntime?.bindingHash ?? null,
      qualificationCatalogHash:
        axis.scenario.optimizationQualification?.catalogHash ?? null,
    },
    coverageTrust: {
      rankingClaim: FORMAL_SEARCH_RANKING_CLAIM,
      formalRankingReady: false,
      fullPoolEnumerationComplete: false,
    },
    heuristic: {
      strategy: 'generator-derived-greedy-normal-lethal-boundary',
      admissibleBoundClaimed: false,
      semanticEquivalenceClaimed: false,
    },
    causalExplanation:
      'Formal generator-derived Hero normal inputs were extended to the first accepted lethal prefix; the immediately shorter prefix remained nonlethal and longer target-dead prefixes were rejected.',
    sampling: { criticalPolicy: axis.scenario.critical?.policy ?? null },
    hashes: simulation.hashes,
    axis,
    team: {
      teamIdentity: build.teamIdentity,
      sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
      actors: build.actors,
    },
    m12c: {
      buildHash: build.buildHash,
      poolHash: pool.poolHash,
      teamIdentity: build.teamIdentity,
      sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
      initialFront,
      fixedCultivationProfile: pool.fixedCultivationProfile ?? null,
      build,
    },
  };
}

function requireSingleNormalCandidate(generator, axis, run, modules) {
  const candidates = generator.generateNextActions({
    axis,
    run,
    nextStartFrameByActor:
      modules.generatorModule.deriveNextStartFrameByActor(run),
    options: {
      activeActorId: modules.searchStateModule.deriveActiveActorId(run.trace),
      includeKibo: false,
      includeSwitch: false,
      includeNormalAttacks: true,
      maxActionsPerOwner: 6,
      maxKiboActions: 1,
      requireFormalLegality: true,
      actionFilter: {
        character: entry => entry.actionKind === 'normal-attack',
        kibo: () => false,
      },
    },
  });
  if (candidates.length !== 1) {
    throw new Error(
      `Expected one verified Hero normal candidate, got ${candidates.length}`
    );
  }
  return candidates[0];
}

async function rebuildAggregate({
  roundDirectory,
  roundManifest,
  sourceConfigs,
}) {
  const shardArtifacts = [];
  for (let index = 0; index < sourceConfigs.length; index += 1) {
    const shardDirectory = path.join(
      roundDirectory,
      'shards',
      createShardDirectoryName(sourceConfigs[index], index)
    );
    const checkpoint = await readJsonIfExists(
      path.join(shardDirectory, 'checkpoint.json')
    );
    if (!checkpoint) continue;
    const result =
      checkpoint.status === 'completed'
        ? await readJsonIfExists(path.join(shardDirectory, 'result.json'))
        : null;
    shardArtifacts.push({ checkpoint, result });
  }
  const aggregate = aggregateShardResults({
    runId: roundManifest.runId,
    roundId: roundManifest.roundId,
    objective: roundManifest.objective,
    topN: roundManifest.topN,
    baseline: roundManifest.baseline,
    expectedSourceConfigIdentities: roundManifest.sourceConfigIdentities,
    shardArtifacts,
    guidanceHash: roundManifest.guidanceHash,
    presetSpecHash: roundManifest.presetSpecHash,
    contractTemplateHash: roundManifest.contractTemplateHash,
    orchestrationIdentityHash: roundManifest.orchestrationIdentityHash,
    normalAttackInputAuthority: roundManifest.normalAttackInputAuthority,
  });
  await writeJsonAtomic(path.join(roundDirectory, 'aggregate.json'), aggregate);
  return aggregate;
}

function projectProbe(row) {
  return {
    actionCount: row.actionCount,
    wallTimeMs: row.wallTimeMs,
    classification: row.classification,
    enemyHp: row.enemyHp ?? null,
    enemyMaxHp: row.enemyMaxHp ?? null,
    legalityPassed: row.legalityPassed ?? null,
    inputHash: row.inputHash ?? null,
    traceHash: row.traceHash ?? null,
  };
}

function createCoverage(sourceConfig, index, count) {
  return {
    sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
    sourceConfigOrdinal: index + 1,
    sourceConfigCount: count,
    initialFrontPolicy: 'fixed-incumbent-112001-refinement',
    expectedInitialFrontCount: 1,
  };
}

function materializeInitialState(presetSpec, sourceConfig) {
  const objectIds = sourceConfig.actors
    .map(actor => String(actor.optimizationObjectId))
    .sort();
  const sp = specification =>
    specification === 'max'
      ? Object.fromEntries(objectIds.map(objectId => [objectId, 100]))
      : {};
  const specialResources = objectIds.includes('103002')
    ? [
        {
          optimizationObjectId: '103002',
          resourceIdentity: 'actor:103002:element:103002047',
          currentValue: Number(presetSpec.rubyAmmo),
          maxValue: 12,
          inputStep: 1,
          scenarioConfigurable: true,
          activeStates: [],
        },
      ]
    : [];
  return {
    presetId: presetSpec.presetId,
    actorSpByOptimizationObjectId: sp(presetSpec.actorSp),
    kiboSpByOptimizationObjectId: sp(presetSpec.kiboSp),
    tuningMarks: structuredClone(presetSpec.tuningMarks ?? []),
    specialResources,
  };
}

function selectSourceConfigs(pool, roundConfig) {
  const byIdentity = new Map(
    pool.teamCatalog.sourceConfigs.map(row => [row.sourceConfigIdentity, row])
  );
  return [...new Set(roundConfig.sourceConfigIdentities.map(String))]
    .sort((left, right) => left.localeCompare(right, 'en'))
    .map(identity => {
      const row = byIdentity.get(identity);
      if (!row) throw new Error(`Unknown source config ${identity}`);
      return row;
    });
}

function createShardDirectoryName(sourceConfig, index) {
  return `${String(index + 1).padStart(2, '0')}-${sha256Canonical(
    sourceConfig.sourceConfigIdentity
  ).slice(0, 12)}`;
}

function projectSourceConfig(sourceConfig) {
  return {
    sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
    teamIdentity: sourceConfig.teamIdentity,
    optimizationObjectIds: [...sourceConfig.optimizationObjectIds],
    actors: sourceConfig.actors.map(actor => ({
      optimizationObjectId: actor.optimizationObjectId,
      sourceCharacterId: Number(actor.sourceCharacterId),
    })),
  };
}

function validateConfig(roundConfig) {
  if (
    Number(roundConfig.schemaVersion) !== 1 ||
    roundConfig.kind !== 'azpr-m12c-formal-greedy-kill-round-config' ||
    roundConfig.objective !== 'fastest-kill' ||
    Number(roundConfig.topN) !== 5
  ) {
    throw new Error('Greedy kill round config contract is invalid');
  }
  for (const field of [
    'runId',
    'roundId',
    'contractTemplate',
    'guidanceFile',
    'outputRoot',
    'refinementInitialFrontOptimizationObjectId',
  ]) {
    if (!roundConfig[field]) throw new Error(`Config requires ${field}`);
  }
  if (
    Number(roundConfig.firstProbeActionCount) < 1 ||
    Number(roundConfig.maxActionCount) <
      Number(roundConfig.firstProbeActionCount)
  ) {
    throw new Error('Greedy kill action budget is invalid');
  }
  if (
    roundConfig.presetSpec?.presetId !==
      'm12c-kill-full-sp-ruby12-zero-marks-v1' ||
    roundConfig.presetSpec.actorSp !== 'max' ||
    roundConfig.presetSpec.kiboSp !== 'max' ||
    Number(roundConfig.presetSpec.rubyAmmo) !== 12 ||
    (roundConfig.presetSpec.tuningMarks ?? []).length !== 0
  ) {
    throw new Error('Greedy kill initial-state policy drifted');
  }
}

async function loadModules(server) {
  const [
    packageModule,
    serviceModule,
    guidanceModule,
    outerBuildModule,
    outerSearchModule,
    generatorModule,
    searchStateModule,
    killModule,
    normalAttackInputAuthorityModule,
  ] = await Promise.all([
    server.ssrLoadModule('/src/data/verifiedCombatMechanicsPackage.js'),
    server.ssrLoadModule('/src/machine-axis/machineAxisService.js'),
    server.ssrLoadModule('/src/machine-axis/machineAxisSearchGuidance.js'),
    server.ssrLoadModule('/src/machine-axis/m12cOuterBuildService.js'),
    server.ssrLoadModule('/src/machine-axis/m12cOuterSearchService.js'),
    server.ssrLoadModule('/src/machine-axis/machineAxisSearchGenerator.js'),
    server.ssrLoadModule('/src/machine-axis/machineAxisSearchState.js'),
    server.ssrLoadModule('/src/machine-axis/machineAxisKillEvaluator.js'),
    server.ssrLoadModule('/src/domain/verifiedNormalAttackInputAuthority.js'),
  ]);
  return {
    packageModule,
    serviceModule,
    guidanceModule,
    outerBuildModule,
    outerSearchModule,
    generatorModule,
    searchStateModule,
    killModule,
    normalAttackInputAuthorityModule,
  };
}

async function assertBaseline(baseline) {
  const head = await gitText(['rev-parse', 'HEAD']);
  const originMaster = await gitText(['rev-parse', 'origin/master']);
  const trackedStatus = await gitText([
    'status',
    '--porcelain=v1',
    '--untracked-files=no',
  ]);
  const stashTop = await gitText([
    'stash',
    'list',
    '--format=%H|%gd|%s',
    '-n',
    '1',
  ]);
  if (
    head !== baseline.head ||
    originMaster !== baseline.originMaster ||
    trackedStatus !== '' ||
    (baseline.stashTopObjectId &&
      !stashTop.startsWith(`${baseline.stashTopObjectId}|`))
  ) {
    throw new Error('Frozen baseline or stash identity drifted');
  }
}

async function assertReleaseAuthority(baseline) {
  const report = await readJson(
    resolveRepositoryPath(baseline.releaseReportPath)
  );
  const admission = report?.summary?.formalSearchAdmission;
  if (
    report.status !== 'pass' ||
    report.mode !== 'executed' ||
    report.head !== baseline.head ||
    report.releaseRecordId !== baseline.releaseRecordId ||
    admission?.ready !== true ||
    admission?.status !== 'ready' ||
    (admission?.blockers ?? []).length !== 0 ||
    (admission?.checks ?? []).length !== 14 ||
    (admission?.checks ?? []).some(check => check.passed !== true) ||
    admission?.clientParity?.ready !== false ||
    admission?.clientParity?.status !== 'pending'
  ) {
    throw new Error('Release/Formal Search Admission authority drifted');
  }
}

async function assertNoOtherSearchProcess() {
  if (process.platform !== 'win32') return;
  const command = [
    `$selfPid = ${process.pid}`,
    String.raw`$rows = Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $selfPid -and $_.Name -match '^node(\.exe)?$' -and $_.CommandLine -and $_.CommandLine -match 'run-ai-guided-search|m12c-outer-search|formal-search-v1[\\/]+scripts[\\/]+run-(round|greedy-kill-round)' } | Select-Object ProcessId, CommandLine`,
    String.raw`if ($rows) { $rows | ConvertTo-Json -Compress } else { '[]' }`,
  ].join('; ');
  const { stdout } = await execFile(
    'pwsh',
    ['-NoProfile', '-Command', command],
    {
      cwd: projectRoot,
      windowsHide: true,
    }
  );
  const rows = JSON.parse(stdout.trim() || '[]');
  if ((Array.isArray(rows) ? rows : [rows]).length > 0) {
    throw new Error(`Another formal search process is running: ${stdout}`);
  }
}

async function acquireProcessLock(lockFile, roundConfig) {
  await fs.mkdir(path.dirname(lockFile), { recursive: true });
  try {
    const handle = await fs.open(lockFile, 'wx');
    await handle.writeFile(
      `${JSON.stringify(
        {
          schemaVersion: 1,
          kind: 'azpr-m12c-formal-search-process-lock',
          pid: process.pid,
          startedAt: new Date().toISOString(),
          runId: roundConfig.runId,
          roundId: roundConfig.roundId,
          objective: roundConfig.objective,
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    await handle.close();
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const existing = await readJsonIfExists(lockFile);
    if (existing?.pid && processIsAlive(Number(existing.pid))) {
      throw new Error(`Formal search lock held by live PID ${existing.pid}`);
    }
    await fs.rename(lockFile, `${lockFile}.stale-${Date.now()}.json`);
    return acquireProcessLock(lockFile, roundConfig);
  }
  return async () => {
    try {
      await fs.rename(lockFile, `${lockFile}.released-${Date.now()}.json`);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  };
}

function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function readJsonIfExists(filePath) {
  try {
    return await readJson(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function gitText(arguments_) {
  const { stdout } = await execFile('git', arguments_, {
    cwd: projectRoot,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout.trim();
}

function normalizeError(error) {
  return {
    name: error?.name ?? 'Error',
    message: error?.message ?? String(error),
    issues: Array.isArray(error?.issues) ? error.issues : [],
    stack: error?.stack ?? null,
  };
}

function resolveRepositoryPath(relativePath) {
  const resolved = path.resolve(projectRoot, relativePath);
  if (
    resolved !== projectRoot &&
    !resolved.startsWith(`${projectRoot}${path.sep}`)
  ) {
    throw new Error('Path escapes repository root');
  }
  return resolved;
}

function repositoryRelative(filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join('/');
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

function emit(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}
