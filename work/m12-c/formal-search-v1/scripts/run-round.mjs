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
  createFixedCycleReplayAxis,
  createFixedCycleReplayCandidate,
} from './cycle-replay-axis.mjs';
import { materializeFormalInitialState } from './formal-initial-state.mjs';

const execFile = promisify(childProcess.execFile);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = await findProjectRoot(scriptDirectory);
const configArgument = readArgument('--config');

if (!configArgument) {
  throw new Error('--config <repository-relative path> is required');
}

const configPath = resolveRepositoryPath(configArgument);
const config = await readJson(configPath);
validateRoundConfig(config);
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
  const guidance = await readJson(resolveRepositoryPath(config.guidanceFile));
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
  const modules = await loadRepositoryModules(vite);
  modules.packageModule.installVerifiedCombatMechanicsPackage(mechanicsPackage);
  const normalAttackInputAuthority =
    modules.normalAttackInputAuthorityModule.getVerifiedNormalAttackInputAuthorityDescriptor();
  if (
    !validateNormalAttackInputAuthorityDescriptor(normalAttackInputAuthority)
      .valid
  ) {
    throw new Error('Verified normal-attack input authority is invalid');
  }
  const machineAxisService = modules.serviceModule.createMachineAxisService();
  const outerBuildService =
    modules.outerBuildModule.createM12cOuterBuildService();
  const outerSearchService =
    modules.outerSearchModule.createM12cOuterSearchService({
      machineAxisService,
      outerBuildService,
    });
  const normalizedGuidance =
    modules.guidanceModule.normalizeSearchGuidance(guidance);
  if (!normalizedGuidance.valid) {
    throw new Error(
      `Guidance is invalid: ${JSON.stringify(normalizedGuidance.issues)}`
    );
  }
  if (normalizedGuidance.guidance.objective !== config.objective) {
    throw new Error('Guidance objective does not match round objective');
  }
  if (!['inner', 'both'].includes(normalizedGuidance.guidance.layer)) {
    throw new Error('Formal shard guidance must apply to the inner search');
  }
  if (!['outer', 'both'].includes(normalizedGuidance.guidance.layer)) {
    throw new Error('Formal shard guidance must apply to the outer search');
  }

  const cycleReplayTemplate = await loadCycleReplayTemplate(config);

  const pool = outerBuildService.pool();
  const sourceConfigs = selectSourceConfigs(pool, config);
  const sourceConfigIdentities = sourceConfigs.map(
    source => source.sourceConfigIdentity
  );
  if (
    config.expectedSourceConfigCount != null &&
    sourceConfigs.length !== Number(config.expectedSourceConfigCount)
  ) {
    throw new Error(
      `Expected ${config.expectedSourceConfigCount} source configs but resolved ${sourceConfigs.length}`
    );
  }

  const contractTemplateHash = sha256Canonical(contractTemplate);
  const presetSpecHash = sha256Canonical(config.presetSpec);
  const roundConfigHash = sha256Canonical(config);
  const guidanceHash = normalizedGuidance.guidanceHash;
  const orchestrationSourceHashes = {
    runRoundSha256: sha256Text(
      await fs.readFile(fileURLToPath(import.meta.url), 'utf8')
    ),
    artifactLibrarySha256: sha256Text(
      await fs.readFile(
        path.join(scriptDirectory, 'formal-search-artifacts.mjs'),
        'utf8'
      )
    ),
    cycleReplayLibrarySha256:
      cycleReplayTemplate == null
        ? null
        : sha256Text(
            await fs.readFile(
              path.join(scriptDirectory, 'cycle-replay-axis.mjs'),
              'utf8'
            )
          ),
  };
  const orchestrationIdentityHash = sha256Canonical({
    orchestratorId: 'azpr-m12c-formal-shard-orchestrator-v1',
    ...orchestrationSourceHashes,
    normalAttackInputAuthority,
  });
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
    roundConfigHash,
    orchestratorId: 'azpr-m12c-formal-shard-orchestrator-v1',
    orchestrationSourceHashes,
    orchestrationIdentityHash,
    normalAttackInputAuthority,
    contractTemplatePath: config.contractTemplate,
    contractTemplateHash,
    guidancePath: config.guidanceFile,
    guidanceHash,
    guidanceProvenance: normalizedGuidance.guidance.provenance,
    previousFeedbackAggregate: config.previousFeedbackAggregate ?? null,
    presetSpec: config.presetSpec,
    presetSpecHash,
    topN: config.topN,
    sourceConfigCount: sourceConfigs.length,
    sourceConfigIdentities,
    sourceConfigUniverseHash: sha256Canonical(sourceConfigIdentities),
    stopPolicy: config.stopPolicy,
    cycleReplayProvenance: cycleReplayTemplate?.provenance ?? null,
  };
  const existingRoundManifest = await readJsonIfExists(
    path.join(roundDirectory, 'round-manifest.json')
  );
  if (
    existingRoundManifest &&
    existingRoundManifest.normalAttackInputAuthority?.contractHash !==
      normalAttackInputAuthority.contractHash
  ) {
    throw new Error(
      'Existing round predates or mismatches the verified normal-attack combo authority; preserve it in place and start a new run/round ID'
    );
  }
  await writeJsonAtomic(
    path.join(roundDirectory, 'round-manifest.json'),
    roundManifest
  );

  process.stdout.write(
    `${JSON.stringify({
      event: 'round-started',
      runId: config.runId,
      roundId: config.roundId,
      objective: config.objective,
      sourceConfigCount: sourceConfigs.length,
      guidanceHash,
      presetSpecHash,
      baselineHead: config.baseline.head,
    })}\n`
  );

  for (let index = 0; index < sourceConfigs.length; index += 1) {
    const sourceConfig = sourceConfigs[index];
    const shardCoordinates = createShardCoordinates({
      config,
      sourceConfig,
      index,
      guidanceHash,
      presetSpecHash,
      contractTemplateHash,
      orchestrationIdentityHash,
      normalAttackInputAuthority,
    });
    const shardDirectory = path.join(
      roundDirectory,
      'shards',
      shardCoordinates.directoryName
    );
    const checkpointPath = path.join(shardDirectory, 'checkpoint.json');
    const initialState = materializeFormalInitialState(
      config.presetSpec,
      sourceConfig
    );
    const request = {
      schemaVersion: 1,
      contractName: 'AzPrM12COuterSearchRequest',
      kind: 'azpr-m12c-outer-search',
      contract: contractTemplate,
      options: {
        ...(config.options ?? {}),
        objective: config.objective,
        guidance,
      },
      guidance,
      initialState,
      buildConstraints: structuredClone(config.buildConstraints ?? {}),
      outer: {
        ...(config.outer ?? {}),
        sourceConfigIdentities: [sourceConfig.sourceConfigIdentity],
        maxSourceConfigs: 1,
      },
    };
    const inputEnvelope = {
      schemaVersion: FORMAL_SEARCH_ARTIFACT_SCHEMA_VERSION,
      kind: 'azpr-m12c-formal-search-shard-input',
      runId: config.runId,
      roundId: config.roundId,
      objective: config.objective,
      shardId: shardCoordinates.shardId,
      baseline: config.baseline,
      sourceConfig: projectSourceConfig(sourceConfig),
      guidanceHash,
      guidanceProvenance: normalizedGuidance.guidance.provenance,
      presetSpecHash,
      contractTemplateHash,
      orchestrationIdentityHash,
      normalAttackInputAuthority,
      request,
      cycleReplay: cycleReplayTemplate?.provenance ?? null,
    };
    const inputHash = sha256Canonical(inputEnvelope);
    const previousCheckpoint = await readJsonIfExists(checkpointPath);
    if (previousCheckpoint?.status === 'completed') {
      if (
        previousCheckpoint.inputHash !== inputHash ||
        previousCheckpoint.guidanceHash !== guidanceHash ||
        previousCheckpoint.normalAttackInputAuthority?.contractHash !==
          normalAttackInputAuthority.contractHash
      ) {
        throw new Error(
          `Completed shard ${shardCoordinates.shardId} does not match the current input; create a new round instead of overwriting evidence`
        );
      }
      const resultPath = path.join(shardDirectory, 'result.json');
      const result = await readJsonIfExists(resultPath);
      if (!result) {
        throw new Error(
          `Completed shard ${shardCoordinates.shardId} is missing result.json`
        );
      }
      if (
        sha256Canonical(result) !==
        previousCheckpoint.artifacts?.resultCanonicalSha256
      ) {
        throw new Error(
          `Completed shard ${shardCoordinates.shardId} result hash mismatch`
        );
      }
      process.stdout.write(
        `${JSON.stringify({
          event: 'shard-resumed',
          index: index + 1,
          total: sourceConfigs.length,
          shardId: shardCoordinates.shardId,
          sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
          status: previousCheckpoint.status,
        })}\n`
      );
      continue;
    }

    const attempt = Number(previousCheckpoint?.attempt ?? 0) + 1;
    const attemptHistory = [
      ...(previousCheckpoint?.attemptHistory ?? []),
      ...(previousCheckpoint
        ? [
            {
              attempt: previousCheckpoint.attempt ?? null,
              status: previousCheckpoint.status ?? 'unknown',
              exitStatus: previousCheckpoint.exitStatus ?? null,
              startedAt: previousCheckpoint.startedAt ?? null,
              finishedAt: previousCheckpoint.finishedAt ?? null,
              failurePath: previousCheckpoint.failurePath ?? null,
            },
          ]
        : []),
    ];
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
      shardId: shardCoordinates.shardId,
      attempt,
      attemptHistory,
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
      coverage: {
        sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
        sourceConfigOrdinal: index + 1,
        sourceConfigCount: sourceConfigs.length,
        initialFrontPolicy: 'all-team-members',
        expectedInitialFrontCount: cycleReplayTemplate ? 1 : 3,
      },
    });

    process.stdout.write(
      `${JSON.stringify({
        event: 'shard-started',
        index: index + 1,
        total: sourceConfigs.length,
        shardId: shardCoordinates.shardId,
        sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
        attempt,
      })}\n`
    );

    try {
      let serviceResult;
      let feedback;
      if (cycleReplayTemplate) {
        ({ serviceResult, feedback } = await runFixedCycleReplayShard({
          service: machineAxisService,
          outerBuildService,
          outerSearchService,
          pool,
          contractTemplate,
          sourceConfig,
          initialState,
          guidanceHash,
          config,
          template: cycleReplayTemplate,
        }));
      } else {
        serviceResult = await outerSearchService.search(request);
        const guidanceApplication = modules.guidanceModule.applySearchGuidance(
          request.options,
          guidance
        );
        feedback = modules.guidanceModule.createSearchFeedback({
          result: serviceResult,
          guidanceApplication,
        });
      }
      const resultArtifact = {
        schemaVersion: FORMAL_SEARCH_ARTIFACT_SCHEMA_VERSION,
        kind: 'azpr-m12c-formal-search-shard-result',
        runId: config.runId,
        roundId: config.roundId,
        objective: config.objective,
        rankingClaim: FORMAL_SEARCH_RANKING_CLAIM,
        formalRankingReady: false,
        shardId: shardCoordinates.shardId,
        baseline: config.baseline,
        sourceConfig: projectSourceConfig(sourceConfig),
        inputHash,
        guidanceHash,
        presetSpecHash,
        contractTemplateHash,
        orchestrationIdentityHash,
        normalAttackInputAuthority,
        serviceRequestHash: serviceResult.requestHash,
        serviceResult,
      };
      const feedbackArtifact = {
        ...feedback,
        formalShard: {
          runId: config.runId,
          roundId: config.roundId,
          shardId: shardCoordinates.shardId,
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
      const finishedAt = new Date().toISOString();
      const checkpoint = {
        schemaVersion: FORMAL_SEARCH_ARTIFACT_SCHEMA_VERSION,
        kind: 'azpr-m12c-formal-search-shard-checkpoint',
        runId: config.runId,
        roundId: config.roundId,
        objective: config.objective,
        shardId: shardCoordinates.shardId,
        attempt,
        attemptHistory,
        status: 'completed',
        exitStatus:
          serviceResult.results?.length > 0
            ? 'completed-with-results'
            : 'completed-without-results',
        startedAt,
        finishedAt,
        baseline: config.baseline,
        inputHash,
        guidanceHash,
        presetSpecHash,
        contractTemplateHash,
        orchestrationIdentityHash,
        normalAttackInputAuthority,
        serviceRequestHash: serviceResult.requestHash,
        coverage: {
          sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
          sourceConfigOrdinal: index + 1,
          sourceConfigCount: sourceConfigs.length,
          initialFrontPolicy: 'all-team-members',
          expectedInitialFrontCount: cycleReplayTemplate ? 1 : 3,
          processedVariantKeyCount:
            serviceResult.executionLedger?.processedVariantKeyCount ?? 0,
          processedVariantKeyChainHash:
            serviceResult.executionLedger?.processedVariantKeyChainHash ?? null,
          plannedSourceConfigCount:
            serviceResult.summary?.plannedSourceConfigCount ?? 0,
          buildCount: serviceResult.summary?.buildCount ?? 0,
          variantSearchCount: serviceResult.summary?.variantSearchCount ?? 0,
        },
        summary: {
          valid: serviceResult.valid,
          resultCount: serviceResult.results?.length ?? 0,
          failureCount: serviceResult.summary?.failureCount ?? 0,
          wallTimeMs: serviceResult.summary?.wallTimeMs ?? null,
          candidatesEvaluated:
            serviceResult.summary?.candidatesEvaluated ?? null,
          completedCandidates:
            serviceResult.summary?.completedCandidates ?? null,
        },
        artifacts: {
          resultPath: repositoryRelative(resultWrite.path),
          resultFileSha256: resultWrite.sha256,
          resultCanonicalSha256: sha256Canonical(resultArtifact),
          resultBytes: resultWrite.bytes,
          feedbackPath: repositoryRelative(feedbackWrite.path),
          feedbackFileSha256: feedbackWrite.sha256,
          feedbackCanonicalSha256: sha256Canonical(feedbackArtifact),
          feedbackBytes: feedbackWrite.bytes,
        },
      };
      await writeJsonAtomic(checkpointPath, checkpoint);
      process.stdout.write(
        `${JSON.stringify({
          event: 'shard-completed',
          index: index + 1,
          total: sourceConfigs.length,
          shardId: shardCoordinates.shardId,
          sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
          resultCount: serviceResult.results?.length ?? 0,
          candidatesEvaluated:
            serviceResult.summary?.candidatesEvaluated ?? null,
          wallTimeMs: serviceResult.summary?.wallTimeMs ?? null,
          failureCount: serviceResult.summary?.failureCount ?? 0,
        })}\n`
      );
    } catch (error) {
      const finishedAt = new Date().toISOString();
      const failureArtifact = {
        schemaVersion: FORMAL_SEARCH_ARTIFACT_SCHEMA_VERSION,
        kind: 'azpr-m12c-formal-search-shard-failure',
        runId: config.runId,
        roundId: config.roundId,
        objective: config.objective,
        shardId: shardCoordinates.shardId,
        attempt,
        baseline: config.baseline,
        sourceConfig: projectSourceConfig(sourceConfig),
        inputHash,
        guidanceHash,
        presetSpecHash,
        contractTemplateHash,
        orchestrationIdentityHash,
        normalAttackInputAuthority,
        startedAt,
        finishedAt,
        error: normalizeError(error),
      };
      const failurePath = path.join(
        shardDirectory,
        `failure.attempt-${String(attempt).padStart(2, '0')}.json`
      );
      await writeJsonAtomic(failurePath, failureArtifact);
      await writeJsonAtomic(checkpointPath, {
        schemaVersion: FORMAL_SEARCH_ARTIFACT_SCHEMA_VERSION,
        kind: 'azpr-m12c-formal-search-shard-checkpoint',
        runId: config.runId,
        roundId: config.roundId,
        objective: config.objective,
        shardId: shardCoordinates.shardId,
        attempt,
        attemptHistory,
        status: 'failed',
        exitStatus: 'failed-exception',
        startedAt,
        finishedAt,
        baseline: config.baseline,
        inputHash,
        guidanceHash,
        presetSpecHash,
        contractTemplateHash,
        orchestrationIdentityHash,
        normalAttackInputAuthority,
        failurePath: repositoryRelative(failurePath),
        coverage: {
          sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
          sourceConfigOrdinal: index + 1,
          sourceConfigCount: sourceConfigs.length,
          initialFrontPolicy: 'all-team-members',
          expectedInitialFrontCount: cycleReplayTemplate ? 1 : 3,
        },
        error: normalizeError(error),
      });
      process.stdout.write(
        `${JSON.stringify({
          event: 'shard-failed',
          index: index + 1,
          total: sourceConfigs.length,
          shardId: shardCoordinates.shardId,
          sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
          error: normalizeError(error),
        })}\n`
      );
    }

    const aggregate = await rebuildRoundAggregate({
      roundDirectory,
      roundManifest,
      sourceConfigs,
    });
    process.stdout.write(
      `${JSON.stringify({
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
      })}\n`
    );
  }

  const aggregate = await rebuildRoundAggregate({
    roundDirectory,
    roundManifest,
    sourceConfigs,
  });
  const completed = aggregate.coverage.completedSourceConfigIdentities.length;
  const failed = aggregate.coverage.failedSourceConfigIdentities.length;
  const missing = aggregate.coverage.missingSourceConfigIdentities.length;
  const roundStatus =
    completed === sourceConfigs.length && failed === 0 && missing === 0
      ? 'completed'
      : 'partial';
  await writeJsonAtomic(path.join(roundDirectory, 'round-checkpoint.json'), {
    schemaVersion: FORMAL_SEARCH_ARTIFACT_SCHEMA_VERSION,
    kind: 'azpr-m12c-formal-search-round-checkpoint',
    runId: config.runId,
    roundId: config.roundId,
    objective: config.objective,
    status: roundStatus,
    exitStatus: roundStatus === 'completed' ? 'completed' : 'partial',
    aggregateHash: aggregate.aggregateHash,
    guidanceHash,
    presetSpecHash,
    baseline: config.baseline,
    orchestrationIdentityHash,
    normalAttackInputAuthority,
    coverage: aggregate.coverage,
    summary: aggregate.summary,
  });
  process.stdout.write(
    `${JSON.stringify({
      event: 'round-finished',
      status: roundStatus,
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
    })}\n`
  );
  if (roundStatus !== 'completed') process.exitCode = 2;
} finally {
  if (vite) await vite.close();
  await releaseLock();
}

async function loadCycleReplayTemplate(config) {
  if (config.cycleReplay == null) return null;
  if (
    !['cycle-dps-no-toughness', 'cycle-dps-with-toughness'].includes(
      config.objective
    )
  ) {
    throw new Error(
      'Fixed cycle replay is admitted only for closed-cycle objectives'
    );
  }
  const specification = config.cycleReplay;
  if (
    !specification.templateAggregatePath ||
    !specification.templateAggregateHash ||
    !specification.templateRawIdentityHash ||
    !specification.synthesisId
  ) {
    throw new Error('cycleReplay provenance is incomplete');
  }
  const aggregatePath = resolveRepositoryPath(
    specification.templateAggregatePath
  );
  const aggregate = await readJson(aggregatePath);
  if (aggregate.objective !== config.objective) {
    throw new Error('cycleReplay template objective mismatch');
  }
  if (aggregate.aggregateHash !== specification.templateAggregateHash) {
    throw new Error('cycleReplay template aggregate hash mismatch');
  }
  const candidate = (aggregate.results ?? []).find(
    row =>
      row.rawIdentity?.identityHash === specification.templateRawIdentityHash
  );
  if (!candidate?.axis) {
    throw new Error('cycleReplay template candidate was not found');
  }
  if (
    candidate.finalScoreEligible !== true ||
    candidate.objectiveProof?.valid !== true ||
    candidate.objectiveProof?.status !== 'closed' ||
    candidate.legality?.proof?.passed !== true
  ) {
    throw new Error('cycleReplay template candidate is not closed and legal');
  }
  const provenance = {
    synthesisId: String(specification.synthesisId),
    templateAggregatePath: repositoryRelative(aggregatePath),
    templateRoundId: aggregate.roundId,
    templateAggregateHash: aggregate.aggregateHash,
    templateRawIdentityHash: candidate.rawIdentity.identityHash,
    templateScore: Number(candidate.score),
    templateActionHash: sha256Canonical(candidate.axis.actions),
    loop: {
      startFrame: Number(specification.loopStartFrame ?? 0),
      endFrame: Number(
        specification.loopEndFrame ?? candidate.axis.scenario.durationFrames
      ),
    },
    semanticEquivalenceClaimed: false,
    admissibleBoundClaimed: false,
  };
  if (
    provenance.loop.startFrame !== 0 ||
    provenance.loop.endFrame !== Number(candidate.axis.scenario.durationFrames)
  ) {
    throw new Error('cycleReplay must preserve the full closed horizon');
  }
  return { axis: candidate.axis, provenance };
}

async function runFixedCycleReplayShard({
  service,
  outerBuildService,
  outerSearchService,
  pool,
  contractTemplate,
  sourceConfig,
  initialState,
  guidanceHash,
  config,
  template,
}) {
  const startedAt = Date.now();
  if (String(config.refinementInitialFrontOptimizationObjectId) !== '112001') {
    throw new Error('Fixed cycle replay requires initial front 112001');
  }
  const planResult = outerBuildService.plan({
    sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
    constraints: { perActor: config.buildConstraints ?? {} },
  });
  if (!planResult.valid || !planResult.plan) {
    throw new Error(`Build plan failed: ${JSON.stringify(planResult.issues)}`);
  }
  const [build] = [
    ...outerBuildService.iterate(planResult.plan, { maxCandidates: 1 }),
  ];
  if (!build) throw new Error('No build candidate resolved for cycle replay');
  const binding = await outerSearchService.bind({
    contract: contractTemplate,
    build,
    objective: config.objective,
    initialFrontOptimizationObjectId:
      config.refinementInitialFrontOptimizationObjectId,
    initialState,
  });
  const axis = createFixedCycleReplayAxis({
    baseAxis: binding.contract,
    templateAxis: template.axis,
    templateRawIdentityHash: template.provenance.templateRawIdentityHash,
    templateAggregateHash: template.provenance.templateAggregateHash,
    synthesisId: template.provenance.synthesisId,
  });
  const simulation = service.simulate(axis);
  const proof = service.evaluateCycle({
    schemaVersion: 1,
    contractName: 'AzPrMachineAxisCycleDps',
    kind: 'azpr-machine-axis-cycle-dps',
    contract: axis,
    loop: structuredClone(template.provenance.loop),
    options: {
      objective: config.objective,
      criticalPolicy: axis.scenario.critical?.policy ?? 'expected',
    },
  });
  const validation = service.validate(axis);
  const candidate = createFixedCycleReplayCandidate({
    axis,
    simulation,
    proof,
    validation,
    build,
    pool,
    sourceConfig,
    initialFront: binding.initialFront,
  });
  const wallTimeMs = Date.now() - startedAt;
  const requestHash = sha256Canonical({
    objective: config.objective,
    sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
    buildHash: build.buildHash,
    initialFront: binding.initialFront,
    initialState,
    guidanceHash,
    template: template.provenance,
  });
  const processedVariantKeyChainHash = sha256Canonical({
    sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
    buildHash: build.buildHash,
    initialFront: binding.initialFront,
    templateActionHash: template.provenance.templateActionHash,
  });
  const serviceResult = {
    schemaVersion: 1,
    contractName: 'AzPrM12CFixedCycleReplaySearch',
    kind: 'azpr-m12c-formal-fixed-cycle-replay-search',
    valid: true,
    objective: config.objective,
    objectiveContract: axis.scenario.objectiveContract,
    rankingClaim: FORMAL_SEARCH_RANKING_CLAIM,
    formalRankingReady: false,
    requestHash,
    guidance: { guidanceHash },
    cycleReplay: template.provenance,
    pool: {
      poolHash: pool.poolHash,
      authority: pool.authority,
      summary: pool.summary,
      sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
    },
    executionLedger: {
      processedVariantKeyCount: 1,
      processedVariantKeyChainHash,
      processedVariantKeys: [
        `${sourceConfig.sourceConfigIdentity}|${build.buildHash}|112001`,
      ],
      processedVariantKeysTruncated: false,
    },
    summary: {
      steps: axis.actions.length,
      candidatesEvaluated: 1,
      invalidCandidates: 0,
      mergedCandidates: 0,
      prunedCandidates: 0,
      expandedCandidates: 1,
      completedCandidates: 1,
      formalSurfaceRejectedCandidates: 0,
      buildCount: 1,
      variantSearchCount: 1,
      candidateResultCount: 1,
      failureCount: 0,
      wallTimeMs,
      objective: config.objective,
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
      guidanceHash,
      budgetUsage: {
        beamWidth: 1,
        maxDepth: axis.actions.length,
        candidatesEvaluated: 1,
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
      rejectionBreakdown: [],
      recommendations: [
        'Retain raw build identity and aggregate all source-family shards before ranking.',
      ],
      cycleReplay: {
        ...template.provenance,
        reboundSourceConfigIdentity: sourceConfig.sourceConfigIdentity,
        reboundBuildHash: build.buildHash,
        reboundInitialFront: binding.initialFront,
        closedScore: candidate.score,
        legalityProofHash: validation.actionLegalityProof?.proofHash ?? null,
        cycleProofHash: proof.hashes?.cycle ?? null,
      },
    },
  };
}

async function rebuildRoundAggregate({
  roundDirectory,
  roundManifest,
  sourceConfigs,
}) {
  const shardArtifacts = [];
  for (let index = 0; index < sourceConfigs.length; index += 1) {
    const sourceConfig = sourceConfigs[index];
    const directoryName = createShardDirectoryName(sourceConfig, index);
    const shardDirectory = path.join(roundDirectory, 'shards', directoryName);
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

function validateRoundConfig(config) {
  const requiredText = [
    'runId',
    'roundId',
    'objective',
    'contractTemplate',
    'guidanceFile',
    'outputRoot',
  ];
  for (const field of requiredText) {
    if (!config?.[field] || typeof config[field] !== 'string') {
      throw new Error(`Round config requires ${field}`);
    }
  }
  if (Number(config.schemaVersion) !== 1) {
    throw new Error('Round config schemaVersion must be 1');
  }
  if (config.kind !== 'azpr-m12c-formal-search-round-config') {
    throw new Error('Round config kind is invalid');
  }
  if (
    ![
      'cycle-dps-no-toughness',
      'cycle-dps-with-toughness',
      'fastest-kill',
    ].includes(config.objective)
  ) {
    throw new Error('Round config objective is invalid');
  }
  if (Number(config.topN) !== 5) {
    throw new Error('Formal M12-C round topN must be 5');
  }
  if (!config.baseline?.head || !config.baseline?.releaseRecordId) {
    throw new Error('Round config baseline authority is incomplete');
  }
  if (!config.presetSpec?.presetId) {
    throw new Error('Round config presetSpec is required');
  }
  if (!config.stopPolicy) {
    throw new Error('Round config stopPolicy is required');
  }
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
  if (head !== baseline.head) {
    throw new Error(`HEAD ${head} does not match baseline ${baseline.head}`);
  }
  if (originMaster !== baseline.originMaster) {
    throw new Error(
      `origin/master ${originMaster} does not match baseline ${baseline.originMaster}`
    );
  }
  if (trackedStatus !== '') {
    throw new Error('Tracked tree is not clean');
  }
  if (
    baseline.stashTopObjectId &&
    !stashTop.startsWith(`${baseline.stashTopObjectId}|`)
  ) {
    throw new Error('stash@{0} identity changed');
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
    report.releaseRecordId !== baseline.releaseRecordId
  ) {
    throw new Error('Release authority does not match the frozen baseline');
  }
  if (
    admission?.ready !== true ||
    admission?.status !== 'ready' ||
    (admission?.blockers ?? []).length !== 0 ||
    (admission?.checks ?? []).length !== 14 ||
    (admission?.checks ?? []).some(check => check.passed !== true)
  ) {
    throw new Error('Formal Search Admission is not READY 14/14');
  }
  if (
    admission?.clientParity?.ready !== false ||
    admission?.clientParity?.status !== 'pending'
  ) {
    throw new Error('Client parity boundary drifted from pending/false');
  }
}

async function assertNoOtherSearchProcess() {
  if (process.platform !== 'win32') return;
  const command = [
    `$selfPid = ${process.pid}`,
    String.raw`$rows = Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $selfPid -and $_.Name -match '^node(\.exe)?$' -and $_.CommandLine -and $_.CommandLine -match 'run-ai-guided-search|m12c-outer-search|formal-search-v1[\\/]+scripts[\\/]+run-round' } | Select-Object ProcessId, CommandLine`,
    String.raw`if ($rows) { $rows | ConvertTo-Json -Compress } else { '[]' }`,
  ].join('; ');
  const { stdout } = await execFile(
    'pwsh',
    ['-NoProfile', '-Command', command],
    {
      cwd: projectRoot,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    }
  );
  const rows = JSON.parse(stdout.trim() || '[]');
  const normalized = Array.isArray(rows) ? rows : [rows];
  if (normalized.length > 0) {
    throw new Error(
      `Another formal/AI-guided search process is running: ${JSON.stringify(normalized)}`
    );
  }
}

async function acquireProcessLock(lockPath, config) {
  await fs.mkdir(path.dirname(lockPath), { recursive: true });
  try {
    const handle = await fs.open(lockPath, 'wx');
    await handle.writeFile(
      `${JSON.stringify(
        {
          schemaVersion: 1,
          kind: 'azpr-m12c-formal-search-process-lock',
          pid: process.pid,
          startedAt: new Date().toISOString(),
          runId: config.runId,
          roundId: config.roundId,
          objective: config.objective,
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    await handle.close();
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const existing = await readJsonIfExists(lockPath);
    if (existing?.pid && processIsAlive(Number(existing.pid))) {
      throw new Error(`Formal search lock is held by live PID ${existing.pid}`);
    }
    const stalePath = `${lockPath}.stale-${Date.now()}.json`;
    await fs.rename(lockPath, stalePath);
    return acquireProcessLock(lockPath, config);
  }
  return async () => {
    const releasedPath = `${lockPath}.released-${Date.now()}.json`;
    try {
      await fs.rename(lockPath, releasedPath);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  };
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function loadRepositoryModules(server) {
  const [
    packageModule,
    serviceModule,
    guidanceModule,
    outerBuildModule,
    outerSearchModule,
    normalAttackInputAuthorityModule,
  ] = await Promise.all([
    server.ssrLoadModule('/src/data/verifiedCombatMechanicsPackage.js'),
    server.ssrLoadModule('/src/machine-axis/machineAxisService.js'),
    server.ssrLoadModule('/src/machine-axis/machineAxisSearchGuidance.js'),
    server.ssrLoadModule('/src/machine-axis/m12cOuterBuildService.js'),
    server.ssrLoadModule('/src/machine-axis/m12cOuterSearchService.js'),
    server.ssrLoadModule('/src/domain/verifiedNormalAttackInputAuthority.js'),
  ]);
  return {
    packageModule,
    serviceModule,
    guidanceModule,
    outerBuildModule,
    outerSearchModule,
    normalAttackInputAuthorityModule,
  };
}

function selectSourceConfigs(pool, config) {
  const all = [...(pool?.teamCatalog?.sourceConfigs ?? [])].sort(
    (left, right) =>
      String(left.sourceConfigIdentity).localeCompare(
        String(right.sourceConfigIdentity),
        'en'
      )
  );
  if (!Array.isArray(config.sourceConfigIdentities)) return all;
  const byIdentity = new Map(
    all.map(source => [source.sourceConfigIdentity, source])
  );
  return [...new Set(config.sourceConfigIdentities.map(String))]
    .sort((left, right) => left.localeCompare(right, 'en'))
    .map(identity => {
      const source = byIdentity.get(identity);
      if (!source) throw new Error(`Unknown source config ${identity}`);
      return source;
    });
}

function createShardCoordinates({
  config,
  sourceConfig,
  index,
  guidanceHash,
  presetSpecHash,
  contractTemplateHash,
  orchestrationIdentityHash,
  normalAttackInputAuthority,
}) {
  const directoryName = createShardDirectoryName(sourceConfig, index);
  return {
    directoryName,
    shardId: `m12c-shard:${sha256Canonical({
      runId: config.runId,
      roundId: config.roundId,
      objective: config.objective,
      sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
      guidanceHash,
      presetSpecHash,
      contractTemplateHash,
      orchestrationIdentityHash,
      normalAttackInputContractHash: normalAttackInputAuthority.contractHash,
    }).slice(0, 24)}`,
  };
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

async function gitText(arguments_) {
  const { stdout } = await execFile('git', arguments_, {
    cwd: projectRoot,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout.trim();
}

async function findProjectRoot(start) {
  let current = path.resolve(start);
  while (true) {
    try {
      const packageJson = JSON.parse(
        await fs.readFile(path.join(current, 'package.json'), 'utf8')
      );
      if (packageJson?.name === 'promilia-axis-tool') return current;
    } catch {
      // Keep walking upward.
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error('Could not locate promilia-axis-tool project root');
    }
    current = parent;
  }
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : (process.argv[index + 1] ?? null);
}

function resolveRepositoryPath(value) {
  const candidate = path.resolve(projectRoot, String(value));
  const relative = path.relative(projectRoot, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path escapes repository: ${value}`);
  }
  return candidate;
}

function repositoryRelative(value) {
  return path.relative(projectRoot, path.resolve(value)).replaceAll('\\', '/');
}

async function readJsonIfExists(filePath) {
  try {
    return await readJson(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function normalizeError(error) {
  return {
    name: error?.name ?? 'Error',
    message: error?.message ?? String(error),
    issues: Array.isArray(error?.issues) ? error.issues : [],
    stack: error?.stack ?? null,
  };
}
