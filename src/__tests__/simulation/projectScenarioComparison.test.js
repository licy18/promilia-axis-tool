import { describe, expect, it } from 'vitest';
import { projectWorkbenchScenarioComparison } from '../../simulation/projection/projectScenarioComparison';

describe('projectWorkbenchScenarioComparison', () => {
  it('compares two standard runtime outputs without calculating new values', () => {
    const current = createCandidate({
      label: '当前方案',
      hp: 180,
      toughness: 42,
      energy: 15,
      secondStartMs: 1200,
      secondHp: 80,
      effectDurationMs: 1800,
    });
    const baseline = createCandidate({
      label: '基准预设',
      hp: 140,
      toughness: 32,
      energy: 5,
      secondStartMs: 1000,
      secondHp: 40,
      effectDurationMs: 1200,
    });

    const comparison = projectWorkbenchScenarioComparison({
      current,
      baseline,
    });

    expect(comparison).toMatchObject({
      schemaVersion: 2,
      sourceKind: 'azpr-workbench-scenario-comparison',
      contractName: 'AzPrWorkbenchScenarioComparison',
      status: 'scenario-comparison-ready',
      windowId: 'full-axis',
      appliedToCalculators: false,
      summary: {
        metricCount: 5,
        actorCount: 2,
        actionCount: 2,
        changedActionCount: 2,
        effectCount: 1,
        changedEffectCount: 1,
        comparableWindowCount: 1,
        readsRuntimeOutputsOnly: true,
        appliedToCalculators: false,
      },
    });
    expect(comparison.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'enemyHpDelta',
          current: 180,
          baseline: 140,
          delta: 40,
        }),
        expect.objectContaining({
          key: 'durationMs',
          current: 1800,
          baseline: 1600,
          delta: 200,
        }),
        expect.objectContaining({
          key: 'effectCoverageMs',
          current: 1800,
          baseline: 1200,
          delta: 600,
        }),
      ])
    );
    expect(comparison.actors).toEqual([
      expect.objectContaining({
        currentActorId: 'actor-1',
        name: '末音',
        metrics: expect.objectContaining({
          enemyHpDelta: expect.objectContaining({
            current: 100,
            baseline: 100,
            delta: 0,
          }),
          enemyToughnessDelta: expect.objectContaining({
            current: 42,
            baseline: 32,
            delta: 10,
          }),
          selfEnergyDelta: expect.objectContaining({
            current: 10,
            baseline: 0,
            delta: 10,
          }),
        }),
      }),
      expect.objectContaining({
        currentActorId: 'actor-2',
        name: '寒悠悠',
        metrics: expect.objectContaining({
          enemyHpDelta: expect.objectContaining({
            current: 80,
            baseline: 40,
            delta: 40,
          }),
          enemyToughnessDelta: expect.objectContaining({
            current: 0,
            baseline: 0,
            delta: 0,
          }),
          selfEnergyDelta: expect.objectContaining({
            current: 5,
            baseline: 5,
            delta: 0,
          }),
        }),
      }),
    ]);
    expect(comparison.actions[1]).toMatchObject({
      currentActionId: 'action-2',
      baselineActionId: 'action-2',
      currentName: '星鸣技',
      currentStatePointId: 'point-action-2',
      baselineStatePointId: 'point-action-2',
      changed: true,
      metrics: {
        enemyHpDelta: { current: 80, baseline: 40, delta: 40 },
        startMs: { current: 1200, baseline: 1000, delta: 200 },
        effectEventCount: { current: 1, baseline: 1, delta: 0 },
      },
    });
    expect(comparison.effects[0]).toMatchObject({
      name: '星流',
      targetName: '迅狼',
      duration: { current: 1800, baseline: 1200, delta: 600 },
      changed: true,
    });
  });

  it('compares the same cycle window from both applied runtime outputs', () => {
    const current = createCandidate({
      hp: 180,
      secondHp: 80,
      secondStartMs: 1200,
      cycleBoundaryMs: 1000,
    });
    const baseline = createCandidate({
      hp: 140,
      secondHp: 40,
      secondStartMs: 1000,
      cycleBoundaryMs: 1000,
    });

    const comparison = projectWorkbenchScenarioComparison({
      current,
      baseline,
      windowId: 'cycle-section-02',
    });

    expect(comparison).toMatchObject({
      windowId: 'cycle-section-02',
      summary: { comparableWindowCount: 3 },
      current: { window: { startMs: 1000, endMs: 3000 } },
      baseline: { window: { startMs: 1000, endMs: 3000 } },
    });
    expect(comparison.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'enemyHpDelta',
          current: 80,
          baseline: 40,
          delta: 40,
        }),
      ])
    );
    expect(comparison.actions).toEqual([
      expect.objectContaining({
        currentActionId: 'action-2',
        baselineActionId: 'action-2',
      }),
    ]);
  });

  it('keeps unmatched actions visible and locatable by current action id', () => {
    const current = createCandidate({ hp: 180, secondHp: 80 });
    const baseline = createCandidate({ hp: 100, secondHp: 0 });
    baseline.scenario.actions = baseline.scenario.actions.slice(0, 1);
    baseline.runtimeOutputs.hitTransactions.transactions =
      baseline.runtimeOutputs.hitTransactions.transactions.slice(0, 1);

    const comparison = projectWorkbenchScenarioComparison({
      current,
      baseline,
    });

    expect(comparison.actions).toHaveLength(2);
    expect(comparison.actions[1]).toMatchObject({
      currentActionId: 'action-2',
      baselineActionId: null,
      changed: true,
    });
  });

  it('returns an awaiting state until a baseline is selected', () => {
    const current = createCandidate({ hp: 100 });
    const original = structuredClone(current);

    const comparison = projectWorkbenchScenarioComparison({ current });

    expect(comparison).toMatchObject({
      status: 'scenario-comparison-awaiting-baseline',
      baseline: null,
      metrics: [],
      actions: [],
      appliedToCalculators: false,
    });
    expect(current).toEqual(original);
  });
});

function createCandidate({
  label = '方案',
  hp = 100,
  toughness = 20,
  energy = 5,
  secondStartMs = 1000,
  secondHp = 0,
  effectDurationMs = 1200,
  cycleBoundaryMs = null,
} = {}) {
  return {
    label,
    sourceKind: 'test-candidate',
    scenario: {
      sourceProject: { id: 'project-1', name: label },
      time: { durationMs: 3000, fps: 60 },
      cycleBoundaries:
        cycleBoundaryMs == null
          ? []
          : [{ id: 'cycle-boundary-0001', timeMs: cycleBoundaryMs }],
      actors: [
        { id: 'actor-1', characterId: 1001, name: '末音' },
        { id: 'actor-2', characterId: 1002, name: '寒悠悠' },
      ],
      actions: [
        {
          id: 'action-1',
          name: '普通攻击',
          actorId: 'actor-1',
          actor: { id: 'actor-1', name: '末音' },
          startMs: 0,
          durationMs: 600,
        },
        {
          id: 'action-2',
          name: '星鸣技',
          actorId: 'actor-2',
          actor: { id: 'actor-2', name: '寒悠悠' },
          startMs: secondStartMs,
          durationMs: 600,
        },
      ],
    },
    runtimeOutputs: {
      summary: {
        enemyHpDelta: hp,
        enemyToughnessDelta: toughness,
        selfEnergyDelta: energy,
      },
      resourceCurves: {
        curvesByActor: [
          { actorId: 'actor-1', delta: energy - 5, pointCount: 1 },
          { actorId: 'actor-2', delta: 5, pointCount: 1 },
        ],
      },
      hitTransactions: {
        transactions: [
          {
            transactionId: 'transaction-action-1',
            sourceDeltaIds: ['delta-action-1'],
            actionId: 'action-1',
            actorId: 'actor-1',
            energyOwnerActorId: 'actor-1',
            timeMs: 300,
            frameIndex: 18,
            delta: {
              enemyHp: hp - secondHp,
              enemyToughness: toughness,
              selfEnergy: energy - 5,
            },
          },
          {
            transactionId: 'transaction-action-2',
            sourceDeltaIds: ['delta-action-2'],
            actionId: 'action-2',
            actorId: 'actor-2',
            energyOwnerActorId: 'actor-2',
            timeMs: secondStartMs + 100,
            frameIndex: Math.round(((secondStartMs + 100) / 1000) * 60),
            delta: {
              enemyHp: secondHp,
              enemyToughness: 0,
              selfEnergy: 5,
            },
          },
        ],
      },
      effectTimeline: {
        events: [{ actionId: 'action-2', timeMs: secondStartMs }],
      },
    },
    statePointContexts: [
      {
        statePointId: 'point-action-1',
        row: { sourceDeltaId: 'delta-action-1' },
      },
      {
        statePointId: 'point-action-2',
        row: { sourceDeltaId: 'delta-action-2' },
      },
    ],
    effectIntervals: {
      intervals: [
        {
          effectId: 'effect-starflow',
          effectName: '星流',
          targetKind: 'enemy',
          targetId: 'enemy-1',
          targetName: '迅狼',
          durationMs: effectDurationMs,
          startMs: 0,
          endMs: effectDurationMs,
        },
      ],
    },
  };
}
