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
      sourceKind: 'azpr-workbench-scenario-comparison',
      contractName: 'AzPrWorkbenchScenarioComparison',
      status: 'scenario-comparison-ready',
      appliedToCalculators: false,
      summary: {
        metricCount: 5,
        actorCount: 2,
        actionCount: 2,
        changedActionCount: 2,
        effectCount: 1,
        changedEffectCount: 1,
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
        currentValue: 10,
        baselineValue: 0,
        delta: 10,
      }),
      expect.objectContaining({
        currentActorId: 'actor-2',
        name: '寒悠悠',
        currentValue: 5,
        baselineValue: 5,
        delta: 0,
      }),
    ]);
    expect(comparison.actions[1]).toMatchObject({
      currentActionId: 'action-2',
      baselineActionId: 'action-2',
      currentName: '星鸣技',
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
} = {}) {
  return {
    label,
    sourceKind: 'test-candidate',
    scenario: {
      sourceProject: { id: 'project-1', name: label },
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
            actionId: 'action-1',
            delta: {
              enemyHp: hp - secondHp,
              enemyToughness: toughness,
              selfEnergy: energy - 5,
            },
          },
          {
            actionId: 'action-2',
            delta: {
              enemyHp: secondHp,
              enemyToughness: 0,
              selfEnergy: 5,
            },
          },
        ],
      },
      effectTimeline: {
        events: [{ actionId: 'action-2' }],
      },
    },
    effectIntervals: {
      intervals: [
        {
          effectId: 'effect-starflow',
          effectName: '星流',
          targetKind: 'enemy',
          targetId: 'enemy-1',
          targetName: '迅狼',
          durationMs: effectDurationMs,
        },
      ],
    },
  };
}
