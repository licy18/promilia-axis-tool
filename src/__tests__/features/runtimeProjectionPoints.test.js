import { describe, expect, it } from 'vitest';
import {
  createWorkbenchRuntimeOutputConsumerView,
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
    expect(
      createWorkbenchRuntimeOutputConsumerView(legacyProjection)
        .outputReadSources
    ).toMatchObject({
      root: {
        sourceTier: 'legacy-projection',
        sourcePath: 'runtimeProjection',
        legacyProjectionFallback: true,
      },
      outputs: {
        stateCurves: {
          sourceKey: 'enemyStateCurve',
          sourcePath: 'runtimeProjection.enemyStateCurve',
          sourceTier: 'legacy-projection-field',
          fallback: true,
          legacyProjectionFallback: true,
        },
        resourceCurves: {
          sourceKey: 'selfEnergyCurveByActor',
          sourcePath: 'runtimeProjection.selfEnergyCurveByActor',
          sourceTier: 'legacy-projection-field',
          fallback: true,
          legacyProjectionFallback: true,
        },
      },
      usesLegacyProjectionFallback: true,
    });
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
      sourceKind: 'azpr-three-value-runtime-outputs',
      status: 'runtime-outputs-ready',
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
      outputConsumerContract: {
        sourceKind: 'azpr-three-value-runtime-output-consumer-contract',
        status: 'runtime-output-consumer-contract-ready',
        summary: {
          outputCount: 4,
          simLogCount: 1,
          enemyHpDelta: 320,
        },
      },
      outputs: {
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
        resourceCurves: {
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
        summary: {
          outputCount: 4,
          simLogCount: 1,
          enemyHpDelta: 320,
        },
      },
      summary: {
        simLogCount: 77,
        enemyHpDelta: 770,
      },
      simLog: [
        {
          sourceDeltaId: 'direct-runtime-output-hp-delta',
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
              sourceDeltaId: 'direct-runtime-output-hp-delta',
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
            actorId: 'direct-actor',
            points: [
              {
                sourceDeltaId: 'direct-runtime-output-energy-delta',
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
    const workbenchRuntimeOutputView =
      createWorkbenchRuntimeOutputConsumerView(runtimeProjection);
    expect(workbenchRuntimeOutputView).toMatchObject({
      sourceKind: 'workbench-runtime-output-consumer-view',
      runtimeConsumerSourceKind:
        'azpr-three-value-runtime-output-consumer-view',
      status: 'runtime-output-consumer-view-ready',
      outputSummary: {
        outputCount: 4,
        simLogCount: 1,
        enemyHpDelta: 320,
      },
      simLog: [
        expect.objectContaining({ sourceDeltaId: 'runtime-output-hp-delta' }),
      ],
      enemyStateCurve: {
        points: [
          expect.objectContaining({ sourceDeltaId: 'runtime-output-hp-delta' }),
        ],
      },
      resourceCurveRows: [expect.objectContaining({ actorId: 'actor-001' })],
      outputPanelSummary: {
        simLogCount: 1,
        statePointContextCount: 1,
        projectionPointCount: 2,
      },
      runtimeOutputSourceResolution: {
        sourcePath: 'runtimeProjection.runtimeOutputs',
        sourceTier: 'runtime-outputs-envelope',
        sourceKind: 'azpr-three-value-runtime-outputs',
        status: 'runtime-outputs-ready',
        hasRuntimeOutputsEnvelope: true,
        legacyProjectionFallback: false,
      },
      outputReadSources: {
        root: {
          sourcePath: 'runtimeProjection.runtimeOutputs',
          sourceTier: 'runtime-outputs-envelope',
        },
        outputs: {
          simLog: {
            sourceKey: 'outputs.simLog',
            sourcePath: 'runtimeProjection.runtimeOutputs.outputs.simLog',
            sourceTier: 'standard-output',
            fallback: false,
            standardOutputPresent: true,
          },
          stateCurves: {
            sourceKey: 'outputs.stateCurves',
            sourcePath: 'runtimeProjection.runtimeOutputs.outputs.stateCurves',
            sourceTier: 'standard-output',
            fallback: false,
            standardOutputPresent: true,
          },
          resourceCurves: {
            sourceKey: 'outputs.resourceCurves',
            sourcePath:
              'runtimeProjection.runtimeOutputs.outputs.resourceCurves',
            sourceTier: 'standard-output',
            fallback: false,
            standardOutputPresent: true,
          },
          summary: {
            sourceKey: 'outputConsumerContract.summary',
            sourcePath:
              'runtimeProjection.runtimeOutputs.outputConsumerContract.summary',
            sourceTier: 'runtime-output-consumer-contract-summary',
            fallback: false,
            standardOutputPresent: true,
          },
        },
        standardOutputNames: [
          'simLog',
          'stateCurves',
          'resourceCurves',
          'summary',
        ],
        fallbackOutputNames: [],
        usesLegacyProjectionFallback: false,
      },
    });
    expect([...workbenchRuntimeOutputView.pointByDeltaId.keys()]).toEqual([
      'runtime-output-hp-delta',
      'runtime-output-energy-delta',
    ]);
    expect(workbenchRuntimeOutputView.statePointContexts).toEqual([
      expect.objectContaining({
        row: expect.objectContaining({
          sourceDeltaId: 'runtime-output-hp-delta',
        }),
      }),
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
