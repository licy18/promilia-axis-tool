import { describe, expect, it } from 'vitest';
import { createRuntimeSelectedDetail } from '../../features/workbench/runtimeSelectedDetail';
import { createRuntimeStatePointContexts } from '../../features/workbench/runtimeProjectionPoints';

describe('runtime selected detail', () => {
  it('uses runtime state point contexts when resolving the selected detail', () => {
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
          frameIndex: 12,
          sequenceIndex: 0,
          stateCurveSequenceIndex: 0,
          trackKey: 'enemyHpDamage',
          layerKey: 'applied',
          hpDelta: 10,
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
      })
    );
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
});
