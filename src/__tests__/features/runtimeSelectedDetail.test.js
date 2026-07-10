import { describe, expect, it } from 'vitest';
import { createRuntimeSelectedDetail } from '../../features/workbench/runtimeSelectedDetail';
import { createRuntimeStatePointContexts } from '../../features/workbench/runtimeProjectionPoints';

describe('runtime selected detail', () => {
  it('uses runtime state point contexts when resolving the selected detail', () => {
    const stateSnapshot = {
      sourceDeltaId: 'hp-delta',
      primaryMetricKey: 'enemyHp',
      changedMetricKeys: ['enemyHp', 'enemyToughness', 'selfEnergy'],
      energyOwnerActorId: 'actor-001',
      before: {
        enemyHp: createStateValue(100),
        enemyToughness: createStateValue(50),
        selfEnergy: createStateValue(20, { actorId: 'actor-001' }),
      },
      delta: {
        enemyHp: 10,
        enemyToughness: 3,
        selfEnergy: -5,
      },
      after: {
        enemyHp: createStateValue(90),
        enemyToughness: createStateValue(47),
        selfEnergy: createStateValue(15, { actorId: 'actor-001' }),
      },
    };
    const runtimeProjection = {
      simLog: [
        {
          sourceDeltaId: 'energy-delta',
          actionId: 'action-0002',
          actionName: '手动资源变化',
          frameIndex: 60,
          sequenceIndex: 1,
          stateCurveSequenceIndex: 1,
          trackKey: 'selfEnergyChange',
          layerKey: 'applied',
          energyDelta: 50,
        },
        {
          sourceDeltaId: 'hp-delta',
          actionId: 'action-0001',
          actionName: '普通攻击',
          actorId: 'actor-001',
          actorName: '末音',
          frameIndex: 12,
          sequenceIndex: 0,
          stateCurveSequenceIndex: 0,
          trackKey: 'enemyHpDamage',
          layerKey: 'applied',
          hpDelta: 10,
          actionThreeValueDeltaAggregate: {
            sourceKind: 'azpr-action-hit-three-value-delta-aggregate',
            deltaCount: 3,
            layers: {
              applied: {
                hpDelta: 10,
                toughnessDelta: 3,
                energyDelta: -5,
              },
            },
          },
          hitThreeValueDeltaAggregate: {
            sourceKind: 'azpr-action-hit-three-value-delta-aggregate',
            deltaCount: 3,
            layers: {
              applied: {
                hpDelta: 10,
                toughnessDelta: 3,
                energyDelta: -5,
              },
            },
          },
          stateSnapshot,
        },
      ],
      stateCurves: {
        enemy: {
          stateMetrics: {
            hp: {
              initialValue: 100,
              deltaDirection: 'decrease',
              stateLabel: '剩余',
              baselineStatus: 'baseline-derived-from-scenario-enemy-max-hp',
            },
          },
          points: [
            {
              sourceDeltaId: 'hp-delta',
              actionId: 'action-0001',
              actionName: '普通攻击',
              actorId: 'actor-001',
              actorName: '末音',
              frameIndex: 12,
              sequenceIndex: 0,
              stateCurveSequenceIndex: 0,
              trackKey: 'enemyHpDamage',
              layerKey: 'applied',
              delta: 10,
              hpDelta: 10,
              sourceIds: {
                skillIds: [10900101],
              },
              stateSnapshot,
            },
          ],
        },
      },
      resourceCurves: {
        curvesByActor: [
          {
            actorId: 'actor-001',
            actorName: '末音',
            stateMetric: {
              initialValue: 0,
              deltaDirection: 'increase',
              stateLabel: '当前',
            },
            points: [
              {
                sourceDeltaId: 'energy-delta',
                actionId: 'action-0002',
                actionName: '手动资源变化',
                actorId: 'actor-001',
                actorName: '末音',
                frameIndex: 60,
                sequenceIndex: 1,
                stateCurveSequenceIndex: 1,
                trackKey: 'selfEnergyChange',
                layerKey: 'applied',
                delta: 50,
                energyDelta: 50,
              },
            ],
          },
        ],
      },
    };

    const hpStatePointId = createRuntimeStatePointContexts(
      runtimeProjection
    ).find(context => context.row.sourceDeltaId === 'hp-delta')?.statePointId;

    const detail = createRuntimeSelectedDetail({
      runtimeProjection,
      selectedStateCurvePointId: hpStatePointId,
    });

    expect(detail).toEqual(
      expect.objectContaining({
        statePointId: hpStatePointId,
        sourceDeltaId: 'hp-delta',
        actionId: 'action-0001',
        trackKey: 'enemyHpDamage',
        delta: 10,
        cumulative: 10,
        stateValue: 90,
        hitThreeValueDeltaAggregate: expect.objectContaining({
          deltaCount: 3,
        }),
        stateSnapshot,
      })
    );
    expect(detail?.threeValueStateRows).toEqual([
      expect.objectContaining({
        key: 'enemyHp',
        label: '敌人 HP',
        beforeValue: 100,
        rawDelta: 10,
        delta: -10,
        afterValue: 90,
        primary: true,
        changed: true,
      }),
      expect.objectContaining({
        key: 'enemyToughness',
        label: '敌人韧性',
        beforeValue: 50,
        rawDelta: 3,
        delta: -3,
        afterValue: 47,
        primary: false,
        changed: true,
      }),
      expect.objectContaining({
        key: 'selfEnergy',
        label: '自身能量',
        actorId: 'actor-001',
        actorName: '末音',
        beforeValue: 20,
        rawDelta: -5,
        delta: -5,
        afterValue: 15,
        primary: false,
        changed: true,
      }),
    ]);
    expect(detail?.contributionRows).toEqual([
      expect.objectContaining({
        key: 'hp',
        value: 10,
        active: true,
      }),
      expect.objectContaining({
        key: 'toughness',
        value: 3,
        active: false,
      }),
      expect.objectContaining({
        key: 'energy',
        value: -5,
        active: false,
      }),
    ]);
    expect(detail?.simLogRow?.sourceDeltaId).toBe('hp-delta');
    expect(detail?.sourceRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'skillIds',
          values: [10900101],
        }),
      ])
    );
  });

  it('resolves detail from the runtimeOutputs envelope before legacy projection fields', () => {
    const runtimeOutputs = {
      simLog: [
        {
          sourceDeltaId: 'runtime-output-hp-delta',
          actionId: 'action-0001',
          actionName: '普通攻击',
          frameIndex: 18,
          sequenceIndex: 0,
          trackKey: 'enemyHpDamage',
          layerKey: 'applied',
          hpDelta: 320,
        },
      ],
      stateCurves: {
        enemy: {
          stateMetrics: {
            hp: {
              initialValue: 1000,
              deltaDirection: 'decrease',
              stateLabel: '剩余',
              baselineStatus: 'baseline-derived-from-scenario-enemy-max-hp',
            },
          },
          points: [
            {
              sourceDeltaId: 'runtime-output-hp-delta',
              actionId: 'action-0001',
              actionName: '普通攻击',
              frameIndex: 18,
              sequenceIndex: 0,
              trackKey: 'enemyHpDamage',
              layerKey: 'applied',
              delta: 320,
              hpDelta: 320,
            },
          ],
        },
      },
      resourceCurves: {
        curvesByActor: [],
      },
      outputSummary: {
        simLogCount: 1,
        enemyHpDelta: 320,
      },
    };
    const runtimeProjection = {
      runtimeOutputs,
      simLog: [
        {
          sourceDeltaId: 'legacy-hp-delta',
          actionId: 'legacy-action',
          actionName: '旧动作',
          trackKey: 'enemyHpDamage',
          hpDelta: 999,
        },
      ],
      stateCurves: {
        enemy: {
          points: [
            {
              sourceDeltaId: 'legacy-hp-delta',
              actionId: 'legacy-action',
              trackKey: 'enemyHpDamage',
              hpDelta: 999,
            },
          ],
        },
      },
    };

    const hpStatePointId = createRuntimeStatePointContexts(
      runtimeProjection
    ).find(
      context => context.row.sourceDeltaId === 'runtime-output-hp-delta'
    )?.statePointId;
    const detail = createRuntimeSelectedDetail({
      runtimeProjection,
      selectedStateCurvePointId: hpStatePointId,
    });

    expect(detail).toMatchObject({
      statePointId: hpStatePointId,
      sourceDeltaId: 'runtime-output-hp-delta',
      actionId: 'action-0001',
      actionName: '普通攻击',
      trackKey: 'enemyHpDamage',
      delta: 320,
      cumulative: 320,
      stateValue: 680,
    });
  });
});

function createStateValue(currentValue, { actorId = null } = {}) {
  return {
    actorId,
    initialValue: currentValue,
    maxValue: 100,
    currentValue,
    rawCurrentValue: currentValue,
    cumulativeDelta: 0,
    overrunValue: 0,
    baselineConfirmed: true,
    baselineStatus: 'test-baseline',
  };
}
