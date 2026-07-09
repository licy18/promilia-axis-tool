import { describe, expect, it } from 'vitest';
import {
  createRuntimePointByDeltaId,
  createRuntimeStatePointContexts,
  findFirstRuntimeStatePointForAction,
  getRuntimeEnemyStateCurve,
  getRuntimeOutputSummary,
  getRuntimeResourceCurveRows,
  getRuntimeSimLogCount,
  getRuntimeSimLogRows,
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

  it('reads runtime output contract boundaries while preserving runtime rows', () => {
    const runtimeProjection = {
      outputContract: {
        outputs: {
          simLog: {
            rowCount: 2,
          },
          stateCurves: {
            status: 'runtime-state-curves-ready',
          },
          resourceCurves: {
            status: 'runtime-resource-curves-ready',
          },
        },
        summary: {
          simLogCount: 2,
          enemyHpDelta: 24,
          outputCount: 4,
        },
      },
      summary: {
        simLogCount: 99,
        enemyHpDelta: 12,
        legacyOnly: 'kept',
      },
      simLog: [
        {
          sourceDeltaId: 'hp-delta',
        },
      ],
      stateCurves: {
        enemy: {
          points: [
            {
              sourceDeltaId: 'hp-delta',
              trackKey: 'enemyHpDamage',
            },
          ],
        },
      },
      resourceCurves: {
        curvesByActor: [
          {
            actorId: 'actor-001',
            points: [
              {
                sourceDeltaId: 'energy-delta',
                trackKey: 'selfEnergyChange',
              },
            ],
          },
        ],
      },
    };

    expect(getRuntimeSimLogCount(runtimeProjection)).toBe(2);
    expect(getRuntimeOutputSummary(runtimeProjection)).toMatchObject({
      simLogCount: 2,
      enemyHpDelta: 24,
      outputCount: 4,
      legacyOnly: 'kept',
    });
    expect(getRuntimeSimLogRows(runtimeProjection)).toEqual([
      expect.objectContaining({ sourceDeltaId: 'hp-delta' }),
    ]);
    expect(getRuntimeEnemyStateCurve(runtimeProjection).points).toEqual([
      expect.objectContaining({ sourceDeltaId: 'hp-delta' }),
    ]);
    expect(getRuntimeResourceCurveRows(runtimeProjection)).toEqual([
      expect.objectContaining({ actorId: 'actor-001' }),
    ]);
  });

  it('consumes the runtimeOutputs envelope before scattered projection fields', () => {
    const runtimeOutputs = {
      outputContract: {
        outputs: {
          simLog: {
            rowCount: 1,
          },
          stateCurves: {
            status: 'runtime-state-curves-ready',
          },
          resourceCurves: {
            status: 'runtime-resource-curves-ready',
          },
        },
        summary: {
          simLogCount: 1,
          enemyHpDelta: 320,
        },
      },
      outputSummary: {
        outputCount: 4,
        simLogCount: 1,
        enemyHpDelta: 320,
      },
      summary: {
        simLogCount: 1,
        enemyHpDelta: 320,
      },
      simLog: [
        {
          sourceDeltaId: 'runtime-output-hp-delta',
          actionId: 'action-0001',
          frameIndex: 10,
          sequenceIndex: 0,
          trackKey: 'enemyHpDamage',
          layerKey: 'applied',
        },
      ],
      stateCurves: {
        enemy: {
          points: [
            {
              sourceDeltaId: 'runtime-output-hp-delta',
              actionId: 'action-0001',
              frameIndex: 10,
              sequenceIndex: 0,
              trackKey: 'enemyHpDamage',
              layerKey: 'applied',
            },
          ],
        },
      },
      resources: {
        curvesByActor: [
          {
            actorId: 'actor-001',
            points: [
              {
                sourceDeltaId: 'runtime-output-energy-delta',
                trackKey: 'selfEnergyChange',
              },
            ],
          },
        ],
      },
    };
    const runtimeProjection = {
      runtimeOutputs,
      simLog: [{ sourceDeltaId: 'legacy-hp-delta' }],
      stateCurves: {
        enemy: {
          points: [{ sourceDeltaId: 'legacy-hp-delta' }],
        },
      },
      resourceCurves: {
        curvesByActor: [{ actorId: 'legacy-actor', points: [] }],
      },
      summary: {
        simLogCount: 99,
        enemyHpDelta: 999,
      },
    };

    expect(getRuntimeOutputSummary(runtimeProjection)).toMatchObject({
      outputCount: 4,
      simLogCount: 1,
      enemyHpDelta: 320,
    });
    expect(getRuntimeSimLogCount(runtimeProjection)).toBe(1);
    expect(getRuntimeSimLogRows(runtimeProjection)).toEqual([
      expect.objectContaining({ sourceDeltaId: 'runtime-output-hp-delta' }),
    ]);
    expect(getRuntimeEnemyStateCurve(runtimeProjection).points).toEqual([
      expect.objectContaining({ sourceDeltaId: 'runtime-output-hp-delta' }),
    ]);
    expect(getRuntimeResourceCurveRows(runtimeProjection)).toEqual([
      expect.objectContaining({ actorId: 'actor-001' }),
    ]);
    expect(createRuntimeStatePointContexts(runtimeOutputs)).toEqual([
      expect.objectContaining({
        row: expect.objectContaining({
          sourceDeltaId: 'runtime-output-hp-delta',
        }),
      }),
    ]);
  });

  it('creates runtime state point contexts in timeline order', () => {
    const runtimeProjection = {
      simLog: [
        {
          sourceDeltaId: 'energy-delta',
          actionId: 'action-0002',
          frameIndex: 60,
          sequenceIndex: 1,
          stateCurveSequenceIndex: 1,
          trackKey: 'selfEnergyChange',
          layerKey: 'applied',
        },
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
            points: [
              {
                sourceDeltaId: 'energy-delta',
                actionId: 'action-0002',
                frameIndex: 60,
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
      createRuntimeStatePointContexts(runtimeProjection).map(
        context => context.row.sourceDeltaId
      )
    ).toEqual(['hp-delta', 'energy-delta']);
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
      findFirstRuntimeStatePointForAction(runtimeProjection, 'action-0001', {
        preferredTrackKey: 'selfEnergyChange',
      })?.row.sourceDeltaId
    ).toBe('energy-delta');
    expect(
      findFirstRuntimeStatePointForAction(runtimeProjection, 'action-0001', {
        preferredTrackKey: 'enemyToughnessDamage',
      })?.row.sourceDeltaId
    ).toBe('hp-delta');
  });
});
