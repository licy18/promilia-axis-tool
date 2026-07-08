import { describe, expect, it } from 'vitest';
import {
  createRuntimePointByDeltaId,
  findFirstRuntimeStatePointForAction,
  getRuntimeEnemyStateCurve,
  getRuntimeResourceCurveRows,
} from '../../features/workbench/runtimeProjectionPoints';

describe('runtime projection points', () => {
  it('prefers runtime state/resource curves and keeps legacy fields as fallback', () => {
    const runtimeProjection = {
      stateCurves: {
        enemy: {
          sourceKind: 'azpr-runtime-state-curves-from-standard-deltas',
          points: [
            {
              sourceDeltaId: 'state-curve-delta',
              trackKey: 'enemyHpDamage',
            },
          ],
        },
      },
      resourceCurves: {
        curvesByActor: [
          {
            actorId: 'actor-001',
            actorName: '末音',
            resource: 'sp',
            points: [
              {
                sourceDeltaId: 'resource-curve-delta',
                trackKey: 'selfEnergyChange',
              },
            ],
          },
        ],
      },
      enemyStateCurve: {
        points: [
          {
            sourceDeltaId: 'legacy-enemy-delta',
            trackKey: 'enemyHpDamage',
          },
        ],
      },
      selfEnergyCurveByActor: [
        {
          actorId: 'actor-legacy',
          actorName: '旧角色',
          points: [
            {
              sourceDeltaId: 'legacy-resource-delta',
              trackKey: 'selfEnergyChange',
            },
          ],
        },
      ],
    };

    expect(getRuntimeEnemyStateCurve(runtimeProjection).points).toEqual([
      expect.objectContaining({ sourceDeltaId: 'state-curve-delta' }),
    ]);
    expect(getRuntimeResourceCurveRows(runtimeProjection)).toEqual([
      expect.objectContaining({
        actorId: 'actor-001',
        points: [
          expect.objectContaining({ sourceDeltaId: 'resource-curve-delta' }),
        ],
      }),
    ]);
    expect([...createRuntimePointByDeltaId(runtimeProjection).keys()]).toEqual([
      'state-curve-delta',
      'resource-curve-delta',
    ]);

    const legacyProjection = {
      enemyStateCurve: runtimeProjection.enemyStateCurve,
      selfEnergyCurveByActor: runtimeProjection.selfEnergyCurveByActor,
    };

    expect([...createRuntimePointByDeltaId(legacyProjection).keys()]).toEqual([
      'legacy-enemy-delta',
      'legacy-resource-delta',
    ]);
  });

  it('can prefer the runtime point track when locating a result for an action', () => {
    const runtimeProjection = {
      simLog: [
        {
          sourceDeltaId: 'hp-delta',
          actionId: 'action-0001',
          frameIndex: 12,
          sequenceIndex: 0,
          stateCurveSequenceIndex: 0,
          trackKey: 'enemyHpDamage',
          layerKey: 'applied',
        },
        {
          sourceDeltaId: 'energy-delta',
          actionId: 'action-0001',
          frameIndex: 18,
          sequenceIndex: 1,
          stateCurveSequenceIndex: 1,
          trackKey: 'selfEnergyChange',
          layerKey: 'applied',
        },
      ],
      stateCurves: {
        enemy: {
          points: [
            {
              sourceDeltaId: 'hp-delta',
              actionId: 'action-0001',
              frameIndex: 12,
              sequenceIndex: 0,
              stateCurveSequenceIndex: 0,
              trackKey: 'enemyHpDamage',
              layerKey: 'applied',
            },
          ],
        },
      },
      resourceCurves: {
        curvesByActor: [
          {
            actorId: 'actor-001',
            actorName: '末音',
            resource: 'sp',
            points: [
              {
                sourceDeltaId: 'energy-delta',
                actionId: 'action-0001',
                frameIndex: 18,
                sequenceIndex: 1,
                stateCurveSequenceIndex: 1,
                trackKey: 'selfEnergyChange',
                layerKey: 'applied',
              },
            ],
          },
        ],
      },
    };

    expect(
      findFirstRuntimeStatePointForAction(runtimeProjection, 'action-0001')?.row
        .sourceDeltaId
    ).toBe('hp-delta');
    expect(
      findFirstRuntimeStatePointForAction(
        runtimeProjection,
        'action-0001',
        {
          preferredTrackKey: 'selfEnergyChange',
        }
      )?.row.sourceDeltaId
    ).toBe('energy-delta');
    expect(
      findFirstRuntimeStatePointForAction(
        runtimeProjection,
        'action-0001',
        {
          preferredTrackKey: 'enemyToughnessDamage',
        }
      )?.row.sourceDeltaId
    ).toBe('hp-delta');
  });
});
