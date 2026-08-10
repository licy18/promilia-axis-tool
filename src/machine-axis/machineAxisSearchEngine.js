import {
  createSearchEventBoundaryNodes,
  createSearchResourceThresholdBoundary,
  createSearchStateSnapshot,
  deriveActiveActorId,
  deriveExecutionNodeFrame,
  hashSearchState,
} from './machineAxisSearchState';
import {
  createMachineAxisSearchAction,
  createMachineAxisSearchGenerator,
  deriveNextStartFrameByActor,
} from './machineAxisSearchGenerator';
import {
  applyCriticalOverride,
  collectCriticalStateEffectHitIdentities,
  createContributions,
  createRunMetrics,
  DEFAULT_BURST_WINDOW_MS,
  guardCriticalStateEffectPolicy,
  normalizeSeeds,
} from './machineAxisBatchEvaluator';
import { COMBAT_CRITICAL_POLICIES } from '../domain/combatCriticalPolicy';
import {
  MACHINE_AXIS_DEFAULT_PRIMARY_OBJECTIVE,
  MACHINE_AXIS_LEGACY_DIAGNOSTIC_OBJECTIVE_IDS,
  MACHINE_AXIS_PRIMARY_OBJECTIVE_IDS,
  createMachineAxisObjectiveContract,
} from './machineAxisObjectiveContract';
import { createFastestKillProof } from './machineAxisKillEvaluator';
import {
  MACHINE_AXIS_CYCLE_CONTRACT_NAME,
  MACHINE_AXIS_CYCLE_KIND,
  MACHINE_AXIS_CYCLE_SCHEMA_VERSION,
} from './machineAxisCycleEvaluator';
import { createMachineAxisActionLegalityProof } from './machineAxisActionLegality';

export const MACHINE_AXIS_SEARCH_ENGINE_SCHEMA_VERSION = 1;
export const MACHINE_AXIS_SEARCH_ENGINE_CONTRACT = 'AzPrMachineAxisSearch';

const OBJECTIVES = new Set([
  ...MACHINE_AXIS_PRIMARY_OBJECTIVE_IDS,
  ...MACHINE_AXIS_LEGACY_DIAGNOSTIC_OBJECTIVE_IDS,
]);
const DEFAULT_SEARCH_OPTIONS = Object.freeze({
  beamWidth: 8,
  topN: 5,
  maxDepth: 24,
  maxActionsPerOwner: 6,
  maxKiboActions: 3,
  includeKibo: true,
  includeSwitch: true,
  includeNormalAttacks: true,
  objective: MACHINE_AXIS_DEFAULT_PRIMARY_OBJECTIVE,
  burstWindowMs: DEFAULT_BURST_WINDOW_MS,
  maxDamagePerMsBound: 10,
  jobs: 4,
  includeWait: true,
  maxWaitCandidates: 6,
});

export function createMachineAxisSearchEngine({
  service,
  generator = createMachineAxisSearchGenerator({ service }),
} = {}) {
  if (!service || typeof service.simulate !== 'function') {
    throw new Error('Machine Axis search engine requires a simulate service');
  }

  async function search({ contract, options = {} }) {
    const startedAt = Date.now();
    const settings = normalizeSearchOptions(options);
    const horizonFrames = Number(contract.scenario?.durationFrames) || 1;
    const baseAxis = createEmptyAxis(contract);
    const baseEvaluation = await evaluateCandidateAxis(baseAxis, settings, {
      nodeFrame: 0,
    });
    const baseEntry = createCandidateEntry({
      ...baseEvaluation,
      chain: [],
      parentLabel: 'start',
    });
    let frontier = [baseEntry];
    const completed = [];
    const issues = [];
    const stats = {
      steps: 0,
      candidatesEvaluated: 1,
      invalidCandidates: 0,
      mergedCandidates: 0,
      prunedCandidates: 0,
      expandedCandidates: 0,
      completedCandidates: 0,
      formalSurfaceRejectedCandidates: 0,
      rejectionCounts: {},
      rejectionExamples: [],
    };
    while (frontier.length > 0 && stats.steps < settings.maxDepth) {
      stats.steps += 1;
      const children = [];
      for (const candidate of frontier) {
        const nextFrames = deriveCandidateNextStartFrames(candidate);
        const activeActorId = deriveActiveActorId(candidate.run.trace);
        if (activeActorId) {
          nextFrames[String(activeActorId)] = Math.max(
            Number(nextFrames[String(activeActorId)]) || 0,
            candidate.currentFrame
          );
        }
        const surfaceRejections = [];
        const nextActions = generator.generateNextActions({
          axis: candidate.axis,
          run: candidate.run,
          nextStartFrameByActor: nextFrames,
          options: {
            activeActorId,
            includeKibo: settings.includeKibo,
            includeSwitch: settings.includeSwitch,
            includeNormalAttacks: settings.includeNormalAttacks,
            maxActionsPerOwner: settings.maxActionsPerOwner,
            maxKiboActions: settings.maxKiboActions,
            requireFormalLegality: MACHINE_AXIS_PRIMARY_OBJECTIVE_IDS.includes(
              settings.objective
            ),
            onFormalRejection: issue => surfaceRejections.push(issue),
          },
        });
        if (surfaceRejections.length > 0) {
          stats.formalSurfaceRejectedCandidates += surfaceRejections.length;
          recordSearchRejections(stats, surfaceRejections);
          issues.push(...surfaceRejections);
        }
        const waitActions = settings.includeWait
          ? createBoundaryWaitCandidates(candidate, settings, horizonFrames)
          : [];
        for (const next of [...nextActions, ...waitActions]) {
          children.push({ parent: candidate, next });
        }
      }
      stats.expandedCandidates += frontier.length;
      if (children.length === 0) {
        addCompletedEntries(completed, frontier, stats);
        break;
      }

      let evaluated = [];
      const resourceThresholdChildren = [];
      for (const child of children) {
        const childAxis = appendActions(
          child.parent.axis,
          child.next.actions ?? [child.next.action]
        );
        let evaluation;
        try {
          evaluation = await evaluateCandidateAxis(childAxis, settings);
        } catch (error) {
          stats.invalidCandidates += 1;
          const childIssues = normalizeSearchIssues(error);
          issues.push(...childIssues);
          recordSearchRejections(stats, childIssues);
          if (settings.includeWait) {
            resourceThresholdChildren.push(
              ...createResourceThresholdWaitCandidates({
                candidate: child.parent,
                attemptedAction: child.next,
                issues: childIssues,
                horizonFrames,
              })
            );
          }
          continue;
        }
        stats.candidatesEvaluated += 1;
        const entry = createCandidateEntry({
          ...evaluation,
          chain: [...child.parent.chain, child.next],
          parentLabel: child.parent.axis.scenario?.name,
        });
        issues.push(...(entry.objectiveIssues ?? []));
        evaluated.push(entry);
        addCompletedEntries(completed, [entry], stats);
      }

      const thresholdChildren = dedupeResourceThresholdChildren(
        resourceThresholdChildren
      )
        .sort(
          (left, right) =>
            left.next.boundary.resumeFrame - right.next.boundary.resumeFrame
        )
        .slice(0, settings.maxWaitCandidates);
      if (thresholdChildren.length > 0) {
        const thresholdKeys = new Set(
          thresholdChildren.map(createResourceThresholdSupersessionKey)
        );
        evaluated = evaluated.filter(
          entry => !isSupersededResourceChangeWait(entry, thresholdKeys)
        );
      }
      for (const child of thresholdChildren) {
        const childAxis = appendActions(
          child.parent.axis,
          child.next.actions ?? [child.next.action]
        );
        try {
          const evaluation = await evaluateCandidateAxis(childAxis, settings);
          stats.candidatesEvaluated += 1;
          const entry = createCandidateEntry({
            ...evaluation,
            chain: [...child.parent.chain, child.next],
            parentLabel: child.parent.axis.scenario?.name,
          });
          issues.push(...(entry.objectiveIssues ?? []));
          evaluated.push(entry);
          addCompletedEntries(completed, [entry], stats);
        } catch (error) {
          stats.invalidCandidates += 1;
          const childIssues = normalizeSearchIssues(error);
          issues.push(...childIssues);
          recordSearchRejections(stats, childIssues);
        }
      }

      if (evaluated.length === 0) {
        addCompletedEntries(completed, frontier, stats);
        break;
      }

      const merged = mergeEquivalentCandidates(evaluated, stats);
      const kthBest = computeKthBest(completed, settings.topN);
      const pruned = [];
      for (const entry of merged) {
        if (entry.terminal) continue;
        if (
          MACHINE_AXIS_LEGACY_DIAGNOSTIC_OBJECTIVE_IDS.includes(
            settings.objective
          ) &&
          shouldPrune({
            score: entry.heuristicScore,
            remainingFrames: entry.remainingFrames,
            maxDamagePerFrame:
              settings.maxDamagePerMsBound *
              (1000 / Number(contract.scenario?.fps || 60)),
            kthBest,
          })
        ) {
          stats.prunedCandidates += 1;
          continue;
        }
        pruned.push(entry);
      }
      frontier = pruned
        .sort((left, right) => {
          if (right.heuristicScore !== left.heuristicScore) {
            return right.heuristicScore - left.heuristicScore;
          }
          if (left.currentFrame !== right.currentFrame) {
            return left.currentFrame - right.currentFrame;
          }
          return left.chain.length - right.chain.length;
        })
        .slice(0, settings.beamWidth);
    }
    for (const entry of frontier) {
      addCompletedEntries(completed, [entry], stats);
    }

    const results = selectTopN(
      completed.filter(entry => entry.chain.length > 0),
      settings.topN
    );
    return {
      schemaVersion: MACHINE_AXIS_SEARCH_ENGINE_SCHEMA_VERSION,
      contractName: MACHINE_AXIS_SEARCH_ENGINE_CONTRACT,
      kind: 'azpr-machine-axis-search',
      options: settings,
      summary: {
        ...stats,
        wallTimeMs: Date.now() - startedAt,
        beamWidth: settings.beamWidth,
        topN: settings.topN,
        objective: settings.objective,
        horizonFrames,
      },
      issues: dedupeSearchIssues(issues),
      results,
    };
  }

  async function evaluateCandidateAxis(
    axis,
    settings,
    { nodeFrame = null } = {}
  ) {
    const sampleAxes = createCriticalSampleAxes(axis, settings);
    const runs = [];
    for (const sample of sampleAxes) {
      const run = await service.simulate(sample.axis);
      const policy =
        run.trace?.critical?.policy ?? sample.axis.scenario?.critical?.policy;
      const guardIssues = guardCriticalStateEffectPolicy({
        policy,
        hitIdentities: collectCriticalStateEffectHitIdentities(run.trace),
      });
      if (guardIssues.length > 0) {
        throw new SearchCandidateEvaluationError(guardIssues);
      }
      runs.push({ ...sample, run });
    }
    const resolvedNodeFrame =
      nodeFrame ?? deriveExecutionNodeFrame(runs[0]?.run?.trace ?? {});
    const actionLegalityProofs = runs.map(sample =>
      createMachineAxisActionLegalityProof(sample.run, {
        objectiveId: settings.objective,
      })
    );
    if (
      MACHINE_AXIS_PRIMARY_OBJECTIVE_IDS.includes(settings.objective) &&
      actionLegalityProofs.some(proof => proof.passed !== true)
    ) {
      throw new SearchCandidateEvaluationError(
        actionLegalityProofs.flatMap(proof => proof.issues ?? [])
      );
    }
    const snapshots = [];
    for (const sample of runs) {
      if (resolvedNodeFrame === 0) {
        snapshots.push(
          createSearchStateSnapshot({
            run: sample.run,
            pendingRun: sample.run,
            contract: sample.axis,
            currentFrame: 0,
            stateKind: 'initial',
          })
        );
        continue;
      }
      const prefixAxis = createPrefixAxis(sample.axis, resolvedNodeFrame);
      const prefixRun = await service.simulate(prefixAxis);
      snapshots.push(
        createSearchStateSnapshot({
          run: prefixRun,
          pendingRun: sample.run,
          contract: sample.axis,
          currentFrame: resolvedNodeFrame,
        })
      );
    }
    const sampleMetrics = runs.map(sample =>
      createRunMetrics(sample.run, sample.axis, {
        burstWindowMs: settings.burstWindowMs,
      })
    );
    const sampleContributions = runs.map(sample =>
      createContributions(sample.run)
    );
    const metrics = aggregateSearchMetrics(sampleMetrics);
    const contributions = aggregateSearchContributions(sampleContributions);
    const objectiveEvaluation = await evaluateSearchObjective({
      axis: runs[0].axis,
      run: runs[0].run,
      metrics,
      settings,
      nodeFrame: resolvedNodeFrame,
      service,
    });
    const score = objectiveEvaluation.score;
    const state = {
      ...snapshots[0],
      ...(snapshots.length > 1
        ? { sampleStateHashes: snapshots.map(hashSearchState) }
        : {}),
    };
    return {
      axis: runs[0].axis,
      run: runs[0].run,
      sampleRuns: runs.map(sample => sample.run),
      state,
      metrics,
      contributions,
      score,
      heuristicScore: objectiveEvaluation.heuristicScore,
      scoreDirection: objectiveEvaluation.scoreDirection,
      finalScoreEligible: objectiveEvaluation.finalScoreEligible,
      objectiveProof: objectiveEvaluation.proof,
      objectiveIssues: objectiveEvaluation.issues,
      actionLegalityProof:
        actionLegalityProofs.length === 1
          ? actionLegalityProofs[0]
          : {
              status: actionLegalityProofs.every(proof => proof.passed)
                ? 'axis-action-legality-passed'
                : 'axis-action-legality-rejected',
              passed: actionLegalityProofs.every(proof => proof.passed),
              samples: actionLegalityProofs,
            },
      sampling:
        runs.length > 1 || settings.seeds?.length
          ? {
              mode: 'explicit-seed-set',
              seeds: runs.map(sample => sample.seed),
              sampleCount: runs.length,
              scoreMean: score,
              samples: runs.map((sample, index) => ({
                seed: sample.seed,
                hashes: sample.run.hashes,
                score: MACHINE_AXIS_PRIMARY_OBJECTIVE_IDS.includes(
                  settings.objective
                )
                  ? null
                  : scoreMetrics(sampleMetrics[index], settings.objective),
                scoreClassification:
                  MACHINE_AXIS_PRIMARY_OBJECTIVE_IDS.includes(
                    settings.objective
                  )
                    ? 'proof-required-no-sample-final-score'
                    : 'legacy-diagnostic',
                metrics: sampleMetrics[index],
                contributions: sampleContributions[index],
              })),
            }
          : null,
    };
  }

  return Object.freeze({
    schemaVersion: MACHINE_AXIS_SEARCH_ENGINE_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_SEARCH_ENGINE_CONTRACT,
    search,
  });
}

export function normalizeSearchOptions(options = {}) {
  const beamWidth =
    positiveInteger(options.beamWidth) ?? DEFAULT_SEARCH_OPTIONS.beamWidth;
  const topN = positiveInteger(options.topN) ?? DEFAULT_SEARCH_OPTIONS.topN;
  const maxDepth =
    positiveInteger(options.maxDepth) ?? DEFAULT_SEARCH_OPTIONS.maxDepth;
  const requestedObjective =
    options.objective == null || options.objective === ''
      ? DEFAULT_SEARCH_OPTIONS.objective
      : String(options.objective);
  const objective = OBJECTIVES.has(requestedObjective)
    ? requestedObjective
    : null;
  return {
    beamWidth,
    topN,
    maxDepth,
    maxActionsPerOwner:
      positiveInteger(options.maxActionsPerOwner) ??
      DEFAULT_SEARCH_OPTIONS.maxActionsPerOwner,
    maxKiboActions:
      positiveInteger(options.maxKiboActions) ??
      DEFAULT_SEARCH_OPTIONS.maxKiboActions,
    includeKibo: options.includeKibo !== false,
    includeSwitch: options.includeSwitch !== false,
    includeNormalAttacks: options.includeNormalAttacks !== false,
    includeWait: options.includeWait !== false,
    maxWaitCandidates:
      positiveInteger(options.maxWaitCandidates) ??
      DEFAULT_SEARCH_OPTIONS.maxWaitCandidates,
    objective,
    objectiveContract:
      objective == null ? null : createMachineAxisObjectiveContract(objective),
    allowUnverifiedRuntimeTiming: options.allowUnverifiedRuntimeTiming === true,
    burstWindowMs:
      positiveNumber(options.burstWindowMs) ??
      DEFAULT_SEARCH_OPTIONS.burstWindowMs,
    criticalPolicy: normalizeCriticalPolicy(options.criticalPolicy),
    seeds: normalizeSeeds(options.seeds),
    maxDamagePerMsBound:
      positiveNumber(options.maxDamagePerMsBound) ??
      DEFAULT_SEARCH_OPTIONS.maxDamagePerMsBound,
    jobs: positiveInteger(options.jobs) ?? DEFAULT_SEARCH_OPTIONS.jobs,
  };
}

export function scoreCandidate(
  run,
  objective = MACHINE_AXIS_DEFAULT_PRIMARY_OBJECTIVE,
  burstWindowMs = DEFAULT_BURST_WINDOW_MS
) {
  if (MACHINE_AXIS_PRIMARY_OBJECTIVE_IDS.includes(String(objective))) {
    throw new TypeError(
      `Primary objective ${objective} requires a cycle or kill proof`
    );
  }
  return scoreMetrics(
    createRunMetrics(run, run?.contract ?? {}, { burstWindowMs }),
    objective
  );
}

export function computeUpperBound({
  score = 0,
  remainingFrames = 0,
  maxDamagePerFrame = 0,
} = {}) {
  return (
    numberOrZero(score) +
    Math.max(0, remainingFrames) * Math.max(0, maxDamagePerFrame)
  );
}

export function shouldPrune({
  score = 0,
  remainingFrames = 0,
  maxDamagePerFrame = 0,
  kthBest = Number.NEGATIVE_INFINITY,
} = {}) {
  if (!Number.isFinite(kthBest) || kthBest === Number.NEGATIVE_INFINITY) {
    return false;
  }
  const upperBound = computeUpperBound({
    score,
    remainingFrames,
    maxDamagePerFrame,
  });
  return upperBound < kthBest;
}

export function mergeEquivalentCandidates(entries, stats = null) {
  const byStateHash = new Map();
  for (const entry of entries) {
    const existing = byStateHash.get(entry.stateHash);
    if (!existing) {
      byStateHash.set(entry.stateHash, entry);
      continue;
    }
    const representative = keepBetterRepresentative(existing, entry);
    representative.mergedCount += 1;
    if (stats) stats.mergedCandidates += 1;
    byStateHash.set(entry.stateHash, representative);
  }
  return [...byStateHash.values()];
}

export function selectTopN(entries, topN = 5) {
  return [...entries]
    .sort((left, right) => {
      if (
        left.scoreDirection === 'minimize' ||
        right.scoreDirection === 'minimize'
      ) {
        const leftFeasible = left.finalScoreEligible === true;
        const rightFeasible = right.finalScoreEligible === true;
        if (leftFeasible !== rightFeasible) return leftFeasible ? -1 : 1;
        if (leftFeasible && Number(left.score) !== Number(right.score)) {
          return Number(left.score) - Number(right.score);
        }
      } else if (Number(right.score) !== Number(left.score)) {
        return Number(right.score) - Number(left.score);
      }
      if (left.currentFrame !== right.currentFrame) {
        return left.currentFrame - right.currentFrame;
      }
      const chainOrder = left.chain.length - right.chain.length;
      if (chainOrder !== 0) return chainOrder;
      return String(left.axis.scenario?.name ?? '').localeCompare(
        String(right.axis.scenario?.name ?? ''),
        'en'
      );
    })
    .slice(0, Math.max(1, topN));
}

function createCandidateEntry({
  axis,
  run,
  sampleRuns,
  state,
  metrics,
  contributions,
  score,
  heuristicScore,
  scoreDirection,
  finalScoreEligible,
  objectiveProof,
  objectiveIssues,
  actionLegalityProof,
  sampling,
  chain,
  parentLabel,
}) {
  const horizonFrames = Number(axis.scenario?.durationFrames) || 1;
  const currentFrame = state.currentFrame;
  const remainingFrames = Math.max(0, horizonFrames - currentFrame);
  const lastAction = chain[chain.length - 1];
  const terminal =
    remainingFrames <= 0 ||
    (lastAction != null &&
      Number(lastAction.action.schedule.frame) >= horizonFrames);
  return {
    axis,
    run,
    sampleRuns,
    state,
    stateHash: hashSearchState(state),
    chain,
    parentLabel,
    score,
    heuristicScore,
    scoreDirection,
    finalScoreEligible,
    objectiveProof,
    objectiveIssues,
    actionLegalityProof,
    metrics,
    contributions,
    sampling,
    currentFrame,
    remainingFrames,
    terminal:
      terminal ||
      (scoreDirection === 'minimize' && finalScoreEligible === true),
    mergedCount: 0,
    invalidActionCount: countInvalidActions(run),
    warnings: run?.trace?.diagnostics?.actionRules?.summary?.warningCount ?? 0,
    boundariesConsumed: chain
      .filter(item => item.boundary)
      .map(item => item.boundary),
  };
}

function createBoundaryWaitCandidates(candidate, settings, horizonFrames) {
  const boundaries = dedupeBoundaries(
    (candidate.sampleRuns?.length ? candidate.sampleRuns : [candidate.run])
      .flatMap(run =>
        createSearchEventBoundaryNodes({
          run,
          durationFrames: horizonFrames,
          burstWindowMs: settings.burstWindowMs,
        })
      )
      .filter(
        node =>
          node.resumeFrame > candidate.currentFrame &&
          node.resumeFrame <= horizonFrames
      )
  );
  const firstByKind = new Map();
  for (const boundary of boundaries) {
    const key = `${boundary.kind}|${boundary.source ?? ''}`;
    if (!firstByKind.has(key)) firstByKind.set(key, boundary);
  }
  return [...firstByKind.values()]
    .sort((left, right) => {
      if (left.frame !== right.frame) return left.frame - right.frame;
      return left.kind.localeCompare(right.kind, 'en');
    })
    .slice(0, settings.maxWaitCandidates)
    .map((boundary, index) =>
      createBoundaryWaitCandidate({
        candidate,
        boundary,
        ordinal: index + 1,
      })
    );
}

function createResourceThresholdWaitCandidates({
  candidate,
  attemptedAction,
  issues,
  horizonFrames,
}) {
  const runs = candidate.sampleRuns?.length
    ? candidate.sampleRuns
    : [candidate.run];
  return issues
    .filter(issue => issue.code === 'machine-axis-action-resource-insufficient')
    .map((issue, index) => {
      const boundary = createSearchResourceThresholdBoundary({
        runs,
        resourceIdentity: issue.resourceIdentity,
        currentValue: issue.currentValue,
        requiredValue: issue.requiredValue,
        currentFrame: candidate.currentFrame,
        durationFrames: horizonFrames,
      });
      if (!boundary) return null;
      return {
        parent: candidate,
        next: createBoundaryWaitCandidate({
          candidate,
          boundary: {
            ...boundary,
            blockedActionId: attemptedAction.action.id,
            blockedActionLabel: attemptedAction.label,
          },
          ordinal: index + 1,
          prefix: 'search-resource-threshold',
        }),
      };
    })
    .filter(Boolean);
}

function createBoundaryWaitCandidate({
  candidate,
  boundary,
  ordinal,
  prefix = 'search-wait',
}) {
  const durationFrames = boundary.resumeFrame - candidate.currentFrame;
  const action = createMachineAxisSearchAction({
    id: allocateWaitActionId(candidate.axis, prefix, ordinal),
    ownerKind: 'system',
    actionKind: 'wait',
    startFrame: candidate.currentFrame,
    durationFrames,
  });
  return {
    action,
    parentStateHash: candidate.stateHash,
    ownerId: 'system',
    ownerKind: 'system',
    slotId: null,
    startFrame: candidate.currentFrame,
    label: `wait-${boundary.kind}-${boundary.resumeFrame}`,
    source: 'runtime:event-boundary',
    sourceIdentity:
      boundary.eventIdentity ??
      boundary.windowIdentity ??
      `${boundary.kind}:${boundary.resourceIdentity ?? ''}:${boundary.frame}`,
    boundary,
  };
}

function allocateWaitActionId(axis, prefix, ordinal) {
  const allocatedIds = new Set(
    (axis.actions ?? []).map(action => String(action.id ?? ''))
  );
  let suffix = ordinal;
  let id;
  do {
    id = `${prefix}-${axis.actions.length + 1}-${suffix}`;
    suffix += 1;
  } while (allocatedIds.has(id));
  return id;
}

function dedupeResourceThresholdChildren(children) {
  const byIdentity = new Map();
  for (const child of children) {
    const key = [
      child.parent.stateHash,
      child.next.boundary.resourceIdentity,
      child.next.boundary.requiredValue,
      child.next.boundary.resumeFrame,
    ].join('|');
    if (!byIdentity.has(key)) byIdentity.set(key, child);
  }
  return [...byIdentity.values()];
}

function createResourceThresholdSupersessionKey(child) {
  return child.parent.stateHash;
}

function isSupersededResourceChangeWait(entry, thresholdKeys) {
  const last = entry.chain.at(-1);
  if (last?.boundary?.kind !== 'resource-change') return false;
  return thresholdKeys.has(last.parentStateHash ?? '');
}

function deriveCandidateNextStartFrames(candidate) {
  const result = {};
  for (const run of candidate.sampleRuns?.length
    ? candidate.sampleRuns
    : [candidate.run]) {
    for (const [actorId, frame] of Object.entries(
      deriveNextStartFrameByActor(run)
    )) {
      result[actorId] = Math.max(
        Number(result[actorId]) || 0,
        Number(frame) || 0
      );
    }
  }
  return result;
}

function dedupeBoundaries(boundaries) {
  const byIdentity = new Map();
  for (const boundary of boundaries) {
    const key = `${boundary.kind}|${boundary.frame}|${boundary.actionId ?? ''}|${boundary.eventIdentity ?? ''}|${boundary.resourceIdentity ?? ''}|${boundary.hitIdentity ?? ''}|${boundary.windowIdentity ?? ''}|${boundary.source ?? ''}`;
    if (!byIdentity.has(key)) byIdentity.set(key, boundary);
  }
  return [...byIdentity.values()];
}

function createCriticalSampleAxes(axis, settings) {
  if (settings.seeds?.length) {
    return settings.seeds.map(seed => ({
      seed,
      axis: applyCriticalOverride(axis, {
        policy: COMBAT_CRITICAL_POLICIES.SAMPLED,
        seed,
      }),
    }));
  }
  if (settings.criticalPolicy) {
    return [
      {
        seed: axis.scenario?.critical?.seed ?? null,
        axis: applyCriticalOverride(axis, {
          policy: settings.criticalPolicy,
        }),
      },
    ];
  }
  return [
    {
      seed: axis.scenario?.critical?.seed ?? null,
      axis,
    },
  ];
}

function createPrefixAxis(axis, currentFrame) {
  return {
    ...axis,
    scenario: {
      ...(axis.scenario ?? {}),
      durationFrames: Math.max(1, currentFrame),
    },
  };
}

function aggregateSearchMetrics(rows) {
  if (rows.length <= 1) return rows[0] ?? createEmptyMetrics();
  const representative = rows[0];
  const mean = selector =>
    rows.reduce((sum, row) => sum + numberOrZero(selector(row)), 0) /
    rows.length;
  return {
    ...representative,
    hpDamage: mean(row => row.hpDamage),
    dps: mean(row => row.dps),
    toughnessDamage: mean(row => row.toughnessDamage),
    netToughnessDamage: mean(row => row.netToughnessDamage),
    combatHitCount: mean(row => row.combatHitCount),
    stateEventCount: mean(row => row.stateEventCount),
    executedActionCount: mean(row => row.executedActionCount),
    skippedActionCount: mean(row => row.skippedActionCount),
    selfEnergyDelta: mean(row => row.selfEnergyDelta),
    burst: {
      ...representative.burst,
      hpDamage: mean(row => row.burst?.hpDamage),
      hitCount: mean(row => row.burst?.hitCount),
      byActor: averageNumericRecords(rows.map(row => row.burst?.byActor)),
    },
    healing: {
      requestedHealing: mean(row => row.healing?.requestedHealing),
      effectiveHealing: mean(row => row.healing?.effectiveHealing),
      overhealing: mean(row => row.healing?.overhealing),
      effectiveHps: mean(row => row.healing?.effectiveHps),
      settlementCount: mean(row => row.healing?.settlementCount),
      bySourceActor: averageContributionRows(
        rows.map(row => row.healing?.bySourceActor)
      ),
      bySourceAction: averageContributionRows(
        rows.map(row => row.healing?.bySourceAction)
      ),
    },
    unresolvedActionCount: mean(row => row.unresolvedActionCount),
  };
}

function aggregateSearchContributions(rows) {
  const sampleCount = rows.length;
  if (sampleCount === 0) {
    return {
      strategy: 'mean-by-stable-identity',
      sampleCount: 0,
      byActor: [],
      byAction: [],
      byHit: [],
    };
  }
  return {
    strategy: 'mean-by-stable-identity',
    sampleCount,
    byActor: averageContributionRows(rows.map(row => row.byActor)),
    byAction: averageContributionRows(rows.map(row => row.byAction)),
    byHit: averageContributionRows(rows.map(row => row.byHit)),
    healingBySourceActor: averageContributionRows(
      rows.map(row => row.healingBySourceActor)
    ),
    healingBySourceAction: averageContributionRows(
      rows.map(row => row.healingBySourceAction)
    ),
  };
}

function averageContributionRows(sampleRows) {
  const metadataNumberKeys = new Set(['firstTimeMs', 'lastTimeMs']);
  const rowsByIdentity = sampleRows.map(
    rows => new Map((rows ?? []).map(row => [String(row.identity), row]))
  );
  const identities = new Set(rowsByIdentity.flatMap(rows => [...rows.keys()]));
  return [...identities]
    .sort((left, right) => left.localeCompare(right, 'en'))
    .map(identity => {
      const matchingRows = rowsByIdentity.map(
        rows => rows.get(identity) ?? null
      );
      const representative = matchingRows.find(Boolean) ?? { identity };
      const numericKeys = new Set(
        matchingRows.flatMap(row =>
          Object.entries(row ?? {})
            .filter(
              ([key, value]) =>
                Number.isFinite(value) && !metadataNumberKeys.has(key)
            )
            .map(([key]) => key)
        )
      );
      return {
        ...representative,
        ...Object.fromEntries(
          [...numericKeys]
            .sort((left, right) => left.localeCompare(right, 'en'))
            .map(key => [
              key,
              matchingRows.reduce(
                (sum, row) => sum + numberOrZero(row?.[key]),
                0
              ) / sampleRows.length,
            ])
        ),
      };
    });
}

function averageNumericRecords(records) {
  const keys = new Set(records.flatMap(record => Object.keys(record ?? {})));
  return Object.fromEntries(
    [...keys]
      .sort((left, right) => left.localeCompare(right, 'en'))
      .map(key => [
        key,
        records.reduce((sum, record) => sum + numberOrZero(record?.[key]), 0) /
          records.length,
      ])
  );
}

function createEmptyMetrics() {
  return {
    hpDamage: 0,
    dps: 0,
    toughnessDamage: 0,
    netToughnessDamage: 0,
    combatHitCount: 0,
    stateEventCount: 0,
    executedActionCount: 0,
    skippedActionCount: 0,
    selfEnergyDelta: 0,
    burst: { windowMs: DEFAULT_BURST_WINDOW_MS, hpDamage: 0, hitCount: 0 },
    healing: {
      requestedHealing: 0,
      effectiveHealing: 0,
      overhealing: 0,
      effectiveHps: 0,
      settlementCount: 0,
      bySourceActor: [],
      bySourceAction: [],
    },
    resourceSurplus: null,
    idle: null,
    nonExecutableActions: [],
    unresolvedActionCount: 0,
  };
}

function scoreMetrics(metrics, objective) {
  if (objective === 'burst') return numberOrZero(metrics?.burst?.hpDamage);
  if (objective === 'toughness') {
    return numberOrZero(metrics?.toughnessDamage);
  }
  return numberOrZero(metrics?.hpDamage);
}

async function evaluateSearchObjective({
  axis,
  run,
  metrics,
  settings,
  nodeFrame,
  service,
}) {
  const objectiveId = settings.objective;
  if (MACHINE_AXIS_LEGACY_DIAGNOSTIC_OBJECTIVE_IDS.includes(objectiveId)) {
    const score = scoreMetrics(metrics, objectiveId);
    return {
      score,
      heuristicScore: score,
      scoreDirection: 'maximize',
      finalScoreEligible: true,
      proof: {
        status: 'legacy-diagnostic',
        formalEligible: false,
        objectiveId,
      },
      issues: [],
    };
  }
  if (objectiveId === 'fastest-kill') {
    const proof = createFastestKillProof(run, axis, {
      objectiveContract: settings.objectiveContract,
      allowUnverifiedRuntimeTiming:
        settings.allowUnverifiedRuntimeTiming === true,
    });
    const enemy = run?.trace?.state?.final?.enemy ?? {};
    const progress = Math.max(
      0,
      Number(enemy.maxHp ?? 0) - Number(enemy.hp ?? enemy.maxHp ?? 0)
    );
    return {
      score:
        proof.valid === true && proof.formalScore != null
          ? Number(proof.formalScore)
          : null,
      heuristicScore: progress,
      scoreDirection: 'minimize',
      finalScoreEligible: proof.valid === true && proof.formalScore != null,
      proof,
      issues: proof.issues ?? [],
    };
  }
  const elapsedSeconds = Math.max(
    1 / Number(axis.scenario?.fps ?? 60),
    Number(nodeFrame ?? 0) / Number(axis.scenario?.fps ?? 60)
  );
  const heuristicScore = numberOrZero(metrics?.hpDamage) / elapsedSeconds;
  if (!(Number(nodeFrame) > 0)) {
    return {
      score: null,
      heuristicScore,
      scoreDirection: 'maximize',
      finalScoreEligible: false,
      proof: null,
      issues: [],
    };
  }
  const proof = service.evaluateCycle(
    {
      schemaVersion: MACHINE_AXIS_CYCLE_SCHEMA_VERSION,
      contractName: MACHINE_AXIS_CYCLE_CONTRACT_NAME,
      kind: MACHINE_AXIS_CYCLE_KIND,
      contract: axis,
      loop: { startFrame: 0, endFrame: Number(nodeFrame) },
      options: {
        objective: objectiveId,
        criticalPolicy:
          settings.criticalPolicy ??
          axis.scenario?.critical?.policy ??
          'expected',
        ...(settings.seeds?.length ? { seeds: settings.seeds } : {}),
      },
    },
    {
      objectiveContract: settings.objectiveContract,
      allowUnverifiedRuntimeTiming:
        settings.allowUnverifiedRuntimeTiming === true,
    }
  );
  return {
    score:
      proof.valid === true && proof.formalScore != null
        ? Number(proof.formalScore)
        : null,
    heuristicScore,
    scoreDirection: 'maximize',
    finalScoreEligible: proof.valid === true && proof.formalScore != null,
    proof,
    issues: proof.issues ?? [],
  };
}

function addCompletedEntries(completed, entries, stats) {
  for (const entry of entries) {
    if (
      !entry ||
      entry.chain.length === 0 ||
      !entry.chain.some(item => item.action?.intent?.kind !== 'wait')
    ) {
      continue;
    }
    if (entry.finalScoreEligible !== true) continue;
    const identity = entry.run?.hashes?.input ?? entry.stateHash;
    const existingIndex = completed.findIndex(
      candidate =>
        (candidate.run?.hashes?.input ?? candidate.stateHash) === identity
    );
    if (existingIndex >= 0) {
      completed[existingIndex] = keepBetterRepresentative(
        completed[existingIndex],
        entry
      );
      continue;
    }
    completed.push(entry);
    stats.completedCandidates += 1;
  }
}

function normalizeSearchIssues(error) {
  if (Array.isArray(error?.issues)) return error.issues;
  return [
    {
      path: 'actions',
      code: 'machine-axis-search-candidate-invalid',
      message: error instanceof Error ? error.message : String(error),
    },
  ];
}

function dedupeSearchIssues(issues) {
  const byIdentity = new Map();
  for (const issue of issues) {
    const key = `${issue.code ?? ''}|${issue.path ?? ''}|${issue.message ?? ''}`;
    if (!byIdentity.has(key)) byIdentity.set(key, issue);
  }
  return [...byIdentity.values()];
}

function recordSearchRejections(stats, issues) {
  stats.rejectionCounts ??= {};
  stats.rejectionExamples ??= [];
  for (const issue of issues ?? []) {
    const code = String(issue?.code ?? 'machine-axis-search-candidate-invalid');
    stats.rejectionCounts[code] = (stats.rejectionCounts[code] ?? 0) + 1;
    const example = {
      code,
      path: issue?.path ?? 'actions',
      actionId: issue?.actionId ?? null,
      actorId: issue?.actorId ?? null,
      publicActionId: issue?.publicActionId ?? null,
      predecessorActionId: issue?.predecessorActionId ?? null,
      ruleCodes: [...(issue?.ruleCodes ?? [])].sort(),
      unresolvedCodes: [...(issue?.unresolvedCodes ?? [])].sort(),
    };
    const identity = JSON.stringify(example);
    if (
      stats.rejectionExamples.length < 8 &&
      !stats.rejectionExamples.some(
        existing => JSON.stringify(existing) === identity
      )
    ) {
      stats.rejectionExamples.push(example);
    }
  }
  stats.rejectionCounts = Object.fromEntries(
    Object.entries(stats.rejectionCounts).sort(([left], [right]) =>
      left.localeCompare(right, 'en')
    )
  );
  stats.rejectionExamples.sort(
    (left, right) =>
      left.code.localeCompare(right.code, 'en') ||
      String(left.path).localeCompare(String(right.path), 'en') ||
      String(left.actionId ?? '').localeCompare(
        String(right.actionId ?? ''),
        'en'
      )
  );
}

function normalizeCriticalPolicy(value) {
  if (value == null || value === '') return null;
  const normalized = String(value);
  return Object.values(COMBAT_CRITICAL_POLICIES).includes(normalized)
    ? normalized
    : null;
}

class SearchCandidateEvaluationError extends Error {
  constructor(issues) {
    super('Machine Axis search candidate is invalid');
    this.name = 'SearchCandidateEvaluationError';
    this.issues = issues;
  }
}

function keepBetterRepresentative(existing, candidate) {
  const existingValue = Number(existing.heuristicScore ?? existing.score ?? 0);
  const candidateValue = Number(
    candidate.heuristicScore ?? candidate.score ?? 0
  );
  if (candidateValue > existingValue) return candidate;
  if (candidateValue === existingValue) {
    if (candidate.currentFrame < existing.currentFrame) return candidate;
    if (
      candidate.currentFrame === existing.currentFrame &&
      candidate.chain.length < existing.chain.length
    ) {
      return candidate;
    }
  }
  return existing;
}

function computeKthBest(completed, topN) {
  if (completed.length < topN) return Number.NEGATIVE_INFINITY;
  const scores = completed
    .map(entry => Number(entry.heuristicScore ?? entry.score ?? 0))
    .sort((a, b) => b - a);
  return scores[topN - 1];
}

function countInvalidActions(run) {
  return (run?.trace?.executionPlan?.actions ?? []).filter(
    entry => entry.execute === false
  ).length;
}

function createEmptyAxis(contract) {
  return {
    ...contract,
    scenario: {
      ...(contract.scenario ?? {}),
      id: `${String(contract.scenario?.id ?? 'search')}-empty`,
      name: `${String(contract.scenario?.name ?? 'Search')} (empty)`,
    },
    actions: [],
  };
}

function appendActions(axis, actions) {
  const appended = (actions ?? []).filter(Boolean);
  const label = appended.map(action => action.id).join('+');
  return {
    ...axis,
    scenario: {
      ...(axis.scenario ?? {}),
      name: `${String(axis.scenario?.name ?? 'Search')} + ${label}`,
    },
    actions: [...(axis.actions ?? []), ...appended],
  };
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
