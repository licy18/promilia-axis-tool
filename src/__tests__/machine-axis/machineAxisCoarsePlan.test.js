import { describe, expect, it } from 'vitest';
import {
  MachineAxisCoarsePlanError,
  createMachineAxisLocalCandidates,
  createMachineAxisLocalSearchShards,
  normalizeMachineAxisCoarsePlan,
} from '../../machine-axis/machineAxisCoarsePlan.js';

describe('Machine Axis AI coarse plan', () => {
  it('generates one deterministic, explicitly bounded local neighborhood', () => {
    const plan = normalizeMachineAxisCoarsePlan(createPlan());
    const first = createMachineAxisLocalCandidates(plan);
    const second = createMachineAxisLocalCandidates(plan);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      candidateCount: 14,
      enumerationTruncated: false,
      formalRankingReady: false,
      seedSummaries: [
        {
          seedId: 'ai-seed-a',
          plannedSearchSpaceSize: '14',
          generatedCandidateCount: 14,
        },
      ],
    });

    const suffixShift = first.candidates.find(
      candidate =>
        candidate.assignments.length === 1 &&
        candidate.assignments.some(
          assignment =>
            assignment.variableId === 'shift-a' && assignment.value === 2
        )
    );
    expect(suffixShift.axis.actions).toMatchObject([
      {
        id: 'a',
        schedule: { frame: 12 },
        intent: {
          physicalInput: {
            releaseFrame: 2,
            pressFrame: 3,
            executionFrame: 12,
          },
        },
      },
      { id: 'b', schedule: { frame: 22 } },
    ]);

    const release = first.candidates.find(
      candidate =>
        candidate.assignments.length === 1 &&
        candidate.assignments.some(
          assignment =>
            assignment.variableId === 'release-a' && assignment.value === 60
        )
    );
    expect(release.axis.actions[0].intent.semanticVariant).toMatchObject({
      mode: 'release',
      inputFrame: 60,
    });
  });

  it('splits candidates into small stable shards', () => {
    const input = createPlan();
    input.budget.perShard.maxCandidates = 3;
    input.budget.perShard.maxEvaluations = 3;
    const plan = normalizeMachineAxisCoarsePlan(input);
    const candidates = createMachineAxisLocalCandidates(plan);
    const first = createMachineAxisLocalSearchShards(plan, candidates);
    const second = createMachineAxisLocalSearchShards(plan, candidates);

    expect(first).toEqual(second);
    expect(first.shardCount).toBe(5);
    expect(first.shards.map(shard => shard.candidates.length)).toEqual([
      3, 3, 3, 3, 2,
    ]);
    expect(
      first.shards.every(
        shard =>
          shard.budget.maxCandidates === 3 &&
          shard.budget.maxSimulations === 20 &&
          shard.budget.maxWallTimeMs === 30_000
      )
    ).toBe(true);
  });

  it('rejects excessive process, shard, and formal-authority requests', () => {
    const input = createPlan();
    input.parallelism.workers = 99;
    input.budget.perShard.maxCandidates = 99;
    input.authority = { formalRankingReady: true };

    expect(() => normalizeMachineAxisCoarsePlan(input)).toThrow(
      MachineAxisCoarsePlanError
    );
    try {
      normalizeMachineAxisCoarsePlan(input);
    } catch (error) {
      expect(error.issues.map(row => row.code)).toEqual(
        expect.arrayContaining([
          'coarse-plan-bounded-integer-invalid',
          'coarse-plan-formal-authority-forbidden',
        ])
      );
    }
  });

  it('binds a supplied planHash to the complete canonical plan', () => {
    const plan = normalizeMachineAxisCoarsePlan(createPlan());
    const replay = normalizeMachineAxisCoarsePlan({
      ...createPlan(),
      planHash: plan.planHash,
    });
    expect(replay.planHash).toBe(plan.planHash);

    expect(() =>
      normalizeMachineAxisCoarsePlan({
        ...createPlan(),
        planHash: 'stale',
      })
    ).toThrow(MachineAxisCoarsePlanError);
  });
});

function createPlan() {
  return {
    schemaVersion: 1,
    contractName: 'AzPrMachineAxisCoarsePlan',
    kind: 'azpr-machine-axis-coarse-plan',
    planId: 'unit-ai-local-v1',
    objective: 'damage',
    topN: 5,
    provenance: {
      authority: 'ai-authored-coarse-axis',
      model: 'test-model',
      promptHash: 'unit-prompt',
    },
    contractTemplate: {
      schemaVersion: 1,
      contractName: 'AzPrMachineAxis',
      kind: 'azpr-machine-axis',
      dataIdentity: {},
      scenario: {
        id: 'unit-local',
        name: 'Unit local axis',
        fps: 60,
        durationFrames: 120,
      },
      actions: [],
    },
    seeds: [
      {
        seedId: 'ai-seed-a',
        rationale: 'AI macro order',
        maxChangedVariables: 2,
        maxCandidates: 20,
        actions: [
          {
            id: 'a',
            owner: { kind: 'actor', slotId: 'slot-1' },
            intent: {
              kind: 'public-action',
              publicActionId: 1,
              actionKind: 'charged-attack',
              semanticVariant: { mode: 'release', inputFrame: 59 },
              physicalInput: {
                mode: 'hold',
                releaseFrame: 0,
                pressFrame: 1,
                executionFrame: 10,
              },
            },
            schedule: { mode: 'absolute', frame: 10 },
          },
          {
            id: 'b',
            owner: { kind: 'actor', slotId: 'slot-1' },
            intent: {
              kind: 'public-action',
              publicActionId: 2,
              actionKind: 'star-skill',
            },
            schedule: { mode: 'absolute', frame: 20 },
          },
        ],
        variables: [
          {
            variableId: 'shift-a',
            kind: 'schedule-frame-offset',
            actionId: 'a',
            values: [-2, 0, 2],
            cascade: 'suffix',
          },
          {
            variableId: 'release-a',
            kind: 'charging-release-frame',
            actionId: 'a',
            values: [58, 59, 60],
          },
          {
            variableId: 'swap-a-b',
            kind: 'adjacent-frame-swap',
            leftActionId: 'a',
            rightActionId: 'b',
          },
        ],
      },
    ],
    budget: {
      maxCandidatesTotal: 50,
      maxShards: 20,
      maxWallTimeMs: 120_000,
      perShard: {
        maxCandidates: 8,
        maxEvaluations: 8,
        maxSimulations: 20,
        maxWallTimeMs: 30_000,
      },
    },
    parallelism: { workers: 2, memoryMbPerWorker: 1024 },
  };
}
