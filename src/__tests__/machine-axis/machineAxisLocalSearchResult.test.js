import { describe, expect, it } from 'vitest';
import {
  createMachineAxisLocalSearchAggregate,
  selectTopNWithCutoffTies,
} from '../../machine-axis/machineAxisLocalSearchResult.js';

describe('Machine Axis bounded local-search result', () => {
  it('keeps exact cutoff ties with deterministic candidate ordering', () => {
    const selection = selectTopNWithCutoffTies(
      [row('c', 90), row('a', 100), row('b', 90), row('d', 80)],
      2
    );
    expect(selection.results.map(entry => entry.candidateId)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(selection.cutoffTieCount).toBe(1);
  });

  it('ranks ineligible bounded candidates by progress heuristic', () => {
    const selection = selectTopNWithCutoffTies(
      [
        row('slow', null, { eligible: false, heuristic: 20, minimize: true }),
        row('fast', null, { eligible: false, heuristic: 50, minimize: true }),
      ],
      1
    );
    expect(selection.results[0].candidateId).toBe('fast');
  });

  it('never promotes a bounded or truncated aggregate to formal authority', () => {
    const aggregate = createMachineAxisLocalSearchAggregate({
      plan: {
        planId: 'plan',
        planHash: 'hash',
        objective: 'cycle-dps-no-toughness',
        topN: 1,
        seeds: [{ seedId: 'seed' }],
        budget: { maxCandidatesTotal: 2 },
        parallelism: { workers: 2 },
      },
      candidateSet: {
        candidateCount: 2,
        enumerationTruncated: false,
        seedSummaries: [],
      },
      shardSet: {
        shardCount: 2,
        assignedCandidateCount: 2,
        boundedStopping: { truncated: false },
      },
      shardResults: [
        {
          shardId: 's1',
          status: 'complete',
          resultHash: 'r1',
          summary: {
            evaluatedCandidateCount: 1,
            rejectedCandidateCount: 0,
            simulationCount: 2,
          },
          results: [row('a', 100)],
          issues: [],
        },
        {
          shardId: 's2',
          status: 'timed-out',
          resultHash: null,
          summary: {
            evaluatedCandidateCount: 0,
            rejectedCandidateCount: 0,
            simulationCount: 1,
          },
          results: [],
          issues: [{ code: 'timeout' }],
        },
      ],
      startedAt: '2026-08-13T00:00:00.000Z',
      endedAt: '2026-08-13T00:00:01.000Z',
    });

    expect(aggregate.authority).toMatchObject({
      formalRankingReady: false,
      clientParityReady: false,
      bounded: true,
      truncated: true,
    });
    expect(aggregate.coverage).toMatchObject({
      evaluatedCandidateCount: 1,
      unevaluatedCandidateCount: 1,
      simulationCount: 3,
      shardStatusCounts: { complete: 1, 'timed-out': 1 },
    });
    expect(aggregate.aggregateHash).toMatch(/^[0-9a-f]{16}$/);
  });
});

function row(
  candidateId,
  score,
  { eligible = true, heuristic = score ?? 0, minimize = false } = {}
) {
  return {
    candidateId,
    score,
    heuristicScore: heuristic,
    finalScoreEligible: eligible,
    scoreDirection: minimize ? 'minimize' : 'maximize',
  };
}
