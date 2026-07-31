import {
  createSearchStateSnapshot,
  deriveActiveActorId,
  hashSearchState,
} from './machineAxisSearchState';
import {
  createMachineAxisSearchGenerator,
  deriveNextStartFrameByActor,
} from './machineAxisSearchGenerator';
import {
  DEFAULT_BURST_WINDOW_MS,
  computeBurstWindow,
} from './machineAxisBatchEvaluator';

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
  maxDamagePerMsBound: 10,
  jobs: 4,
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
    const baseRun = await simulateCandidate(baseAxis);
    const baseState = createSearchStateSnapshot({
      run: baseRun,
      contract: baseAxis,
    });
    const baseEntry = createCandidateEntry({
      axis: baseAxis,
      run: baseRun,
      state: baseState,
      chain: [],
      parentLabel: 'start',
      settings,
    });
    let frontier = [baseEntry];
    const completed = [];
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
        const nextFrames = deriveNextStartFrameByActor(candidate.run);
        const activeActorId = deriveActiveActorId(candidate.run.trace);
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
        for (const next of nextActions) {
          children.push({ parent: candidate, next });
        }
      }
      stats.expandedCandidates += frontier.length;
      if (children.length === 0) break;

      const evaluated = [];
      for (const child of children) {
        const childAxis = appendAction(child.parent.axis, child.next.action);
        let childRun;
        try {
          childRun = await simulateCandidate(childAxis);
        } catch {
          stats.invalidCandidates += 1;
          continue;
        }
        stats.candidatesEvaluated += 1;
        const state = createSearchStateSnapshot({
          run: childRun,
          contract: childAxis,
        });
        const entry = createCandidateEntry({
          axis: childAxis,
          run: childRun,
          state,
          chain: [...child.parent.chain, child.next],
          parentLabel: child.parent.axis.scenario?.name,
          settings,
        });
        evaluated.push(entry);
        if (entry.terminal) {
          completed.push(entry);
          stats.completedCandidates += 1;
        }
      }

      const merged = mergeEquivalentCandidates(evaluated, stats);
      const kthBest = computeKthBest(completed, settings.topN);
      const pruned = [];
      for (const entry of merged) {
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
      if (!completed.includes(entry)) {
        completed.push(entry);
      }
    }

    const results = selectTopN(completed, settings.topN);
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
      results,
    };
  }

  async function simulateCandidate(axis) {
    return service.simulate(axis);
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
    objective,
    maxDamagePerMsBound:
      positiveNumber(options.maxDamagePerMsBound) ??
      DEFAULT_SEARCH_OPTIONS.maxDamagePerMsBound,
    jobs: positiveInteger(options.jobs) ?? DEFAULT_SEARCH_OPTIONS.jobs,
  };
}

export function scoreCandidate(run, objective = 'damage') {
  const totals = run?.evaluation?.totals ?? {};
  if (objective === 'burst') {
    return computeBurstWindow(run?.trace?.damage ?? [], DEFAULT_BURST_WINDOW_MS)
      .hpDamage;
  }
  if (objective === 'toughness') {
    return numberOrZero(totals.toughnessDamage);
  }
  return numberOrZero(totals.hpDamage);
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
  state,
  chain,
  parentLabel,
  settings,
}) {
  const score = scoreCandidate(run, settings.objective);
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
    state,
    stateHash: hashSearchState(state),
    chain,
    parentLabel,
    score,
    currentFrame,
    remainingFrames,
    terminal,
    mergedCount: 0,
    invalidActionCount: countInvalidActions(run),
    warnings: run?.trace?.diagnostics?.actionRules?.summary?.warningCount ?? 0,
  };
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
