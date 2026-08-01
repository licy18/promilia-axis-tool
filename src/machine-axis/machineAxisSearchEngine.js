import {
  createSearchEventBoundaryNodes,
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
  createRunMetrics,
  DEFAULT_BURST_WINDOW_MS,
  guardCriticalStateEffectPolicy,
  normalizeSeeds,
} from './machineAxisBatchEvaluator';
import { COMBAT_CRITICAL_POLICIES } from '../domain/combatCriticalPolicy';

export const MACHINE_AXIS_SEARCH_ENGINE_SCHEMA_VERSION = 1;
export const MACHINE_AXIS_SEARCH_ENGINE_CONTRACT = 'AzPrMachineAxisSearch';

const OBJECTIVES = new Set(['damage', 'burst', 'toughness']);
const DEFAULT_SEARCH_OPTIONS = Object.freeze({
  beamWidth: 8,
  topN: 5,
  maxDepth: 24,
  maxActionsPerOwner: 6,
  maxKiboActions: 3,
  includeKibo: true,
  includeSwitch: true,
  includeNormalAttacks: true,
  objective: 'damage',
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
          },
        });
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

      const evaluated = [];
      for (const child of children) {
        const childAxis = appendAction(child.parent.axis, child.next.action);
        let evaluation;
        try {
          evaluation = await evaluateCandidateAxis(childAxis, settings);
        } catch (error) {
          stats.invalidCandidates += 1;
          issues.push(...normalizeSearchIssues(error));
          continue;
        }
        stats.candidatesEvaluated += 1;
        const entry = createCandidateEntry({
          ...evaluation,
          chain: [...child.parent.chain, child.next],
          parentLabel: child.parent.axis.scenario?.name,
        });
        evaluated.push(entry);
        addCompletedEntries(completed, [entry], stats);
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
          shouldPrune({
            score: entry.score,
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
          if (right.score !== left.score) return right.score - left.score;
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
    const metrics = aggregateSearchMetrics(sampleMetrics);
    const score = scoreMetrics(metrics, settings.objective);
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
      score,
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
                score: scoreMetrics(sampleMetrics[index], settings.objective),
                metrics: sampleMetrics[index],
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
  const objective = OBJECTIVES.has(String(options.objective))
    ? String(options.objective)
    : DEFAULT_SEARCH_OPTIONS.objective;
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
  objective = 'damage',
  burstWindowMs = DEFAULT_BURST_WINDOW_MS
) {
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
      if (right.score !== left.score) return right.score - left.score;
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
  score,
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
    metrics,
    sampling,
    currentFrame,
    remainingFrames,
    terminal,
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
  const allocatedIds = new Set(
    (candidate.axis.actions ?? []).map(action => String(action.id ?? ''))
  );
  let waitOrdinal = 1;
  const nextWaitId = () => {
    let id;
    do {
      id = `search-wait-${candidate.axis.actions.length + 1}-${waitOrdinal}`;
      waitOrdinal += 1;
    } while (allocatedIds.has(id));
    allocatedIds.add(id);
    return id;
  };
  return [...firstByKind.values()]
    .sort((left, right) => {
      if (left.frame !== right.frame) return left.frame - right.frame;
      return left.kind.localeCompare(right.kind, 'en');
    })
    .slice(0, settings.maxWaitCandidates)
    .map(boundary => {
      const durationFrames = boundary.resumeFrame - candidate.currentFrame;
      const action = createMachineAxisSearchAction({
        id: nextWaitId(),
        ownerKind: 'system',
        actionKind: 'wait',
        startFrame: candidate.currentFrame,
        durationFrames,
      });
      return {
        action,
        ownerId: 'system',
        ownerKind: 'system',
        slotId: null,
        startFrame: candidate.currentFrame,
        label: `wait-${boundary.kind}-${boundary.resumeFrame}`,
        source: 'runtime:event-boundary',
        sourceIdentity:
          boundary.eventIdentity ??
          boundary.windowIdentity ??
          `${boundary.kind}:${boundary.frame}`,
        boundary,
      };
    });
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
    unresolvedActionCount: mean(row => row.unresolvedActionCount),
  };
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

function addCompletedEntries(completed, entries, stats) {
  for (const entry of entries) {
    if (
      !entry ||
      entry.chain.length === 0 ||
      !entry.chain.some(item => item.action?.intent?.kind !== 'wait')
    ) {
      continue;
    }
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
  if (candidate.score > existing.score) return candidate;
  if (candidate.score === existing.score) {
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
  const scores = completed.map(entry => entry.score).sort((a, b) => b - a);
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

function appendAction(axis, action) {
  return {
    ...axis,
    scenario: {
      ...(axis.scenario ?? {}),
      name: `${String(axis.scenario?.name ?? 'Search')} + ${action.id}`,
    },
    actions: [...(axis.actions ?? []), action],
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
