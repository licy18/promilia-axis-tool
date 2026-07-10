import { describe, expect, it } from 'vitest';
import {
  createSelfEnergyDeltaSummaryByActor,
  createThreeValueRuntimeProjection,
} from '../../simulation/runtime/threeValueRuntimeProjection';
import { createThreeValueRuntimeOutputConsumerView } from '../../simulation/runtime/threeValueRuntimeOutputConsumer';

describe('three value runtime projection', () => {
  it('consumes only applied generation deltas and outputs curves, sim log, and summary', () => {
    const runtimeProjection = createThreeValueRuntimeProjection({
      scenario: {
        enemy: {
          stats: {
            maxHp: 10000,
          },
          hpMultiplier: 1.5,
        },
        actors: [
          {
            id: 'actor-001',
            name: '末音',
            stats: {
              maxSp: 100,
            },
          },
        ],
      },
      threeValueGenerationLayer: {
        contract: {
          name: 'Action -> Hit -> ThreeValueDelta',
        },
        deltas: [
          {
            id: 'action-001|hit-1|enemyHpDamage|applied|60|0',
            actionId: 'action-001',
            actionName: '普通攻击',
            actionType: 'skill',
            actorId: 'actor-001',
            actorName: '末音',
            hitKey: 'hit-1',
            hitIndex: 1,
            frameIndex: 60,
            frameLabel: '1s0f',
            timeMs: 1000,
            trackKey: 'enemyHpDamage',
            trackLabel: '敌人HP伤害',
            layerKey: 'applied',
            valueUnit: 'raw-damage',
            delta: 1200,
            hpDelta: 1200,
            toughnessDelta: null,
            energyDelta: null,
            sourceIds: {
              skillIds: [10900101],
              elementConfigIds: [109001081],
              captureSessionIds: [],
              pathIds: [],
            },
            confidence: 'unit-test',
            calculatorKey: 'azpr-hp-delta-calculator',
            calculatorVersion: 1,
            calculationKind: 'raw-result-preview',
            calculationStatus: 'raw-hp-projection',
            calculationReplaceable: true,
            calculator: {
              key: 'azpr-hp-delta-calculator',
              version: 1,
              trackKey: 'enemyHpDamage',
              outputField: 'hpDelta',
              kind: 'raw-result-preview',
              status: 'raw-hp-projection',
              delta: 1200,
              deltaFieldValue: 1200,
              valueUnit: 'raw-damage',
              sourceIds: {
                skillIds: [10900101],
                elementConfigIds: [109001081],
                captureSessionIds: [],
                pathIds: [],
              },
              confidence: 'unit-test',
              replaceable: true,
              appliedToRuntime: true,
            },
            applied: true,
          },
          {
            id: 'action-001|hit-1|enemyHpDamage|candidate|60|0',
            actionId: 'action-001',
            actionName: '普通攻击',
            actorId: 'actor-001',
            actorName: '末音',
            hitKey: 'hit-1',
            hitIndex: 1,
            frameIndex: 60,
            frameLabel: '1s0f',
            timeMs: 1000,
            trackKey: 'enemyHpDamage',
            trackLabel: '敌人HP伤害',
            layerKey: 'candidate',
            valueUnit: 'raw-damage',
            delta: 9999,
            hpDelta: 9999,
            toughnessDelta: null,
            energyDelta: null,
            confidence: 'candidate',
            applied: false,
          },
          {
            id: 'action-002|event-RESOURCE_CHANGE-0|selfEnergyChange|applied|90|0',
            actionId: 'action-002',
            actionName: '星鸣技',
            actionType: 'skill',
            actorId: 'actor-001',
            actorName: '末音',
            hitKey: 'event-RESOURCE_CHANGE-0',
            hitIndex: null,
            frameIndex: 90,
            frameLabel: '1s30f',
            timeMs: 1500,
            trackKey: 'selfEnergyChange',
            trackLabel: '自身能量变化',
            layerKey: 'applied',
            valueUnit: 'sp',
            delta: -30,
            hpDelta: null,
            toughnessDelta: null,
            energyDelta: -30,
            sourceIds: {
              skillIds: [10900102],
              elementConfigIds: [],
              captureSessionIds: [],
              pathIds: [],
            },
            confidence: 'manual',
            calculatorKey: 'azpr-self-energy-delta-calculator',
            calculatorVersion: 1,
            calculationKind: 'explicit-resource-event-or-cost-preview',
            calculationStatus: 'explicit-cost-applied-charge-formula-unmapped',
            calculationReplaceable: true,
            calculator: {
              key: 'azpr-self-energy-delta-calculator',
              version: 1,
              trackKey: 'selfEnergyChange',
              outputField: 'energyDelta',
              kind: 'explicit-resource-event-or-cost-preview',
              status: 'explicit-cost-applied-charge-formula-unmapped',
              delta: -30,
              deltaFieldValue: -30,
              valueUnit: 'sp',
              sourceIds: {
                skillIds: [10900102],
                elementConfigIds: [],
                captureSessionIds: [],
                pathIds: [],
              },
              confidence: 'manual',
              replaceable: true,
              appliedToRuntime: true,
            },
            applied: true,
          },
        ],
      },
    });

    expect(runtimeProjection).toMatchObject({
      sourceKind: 'azpr-runtime-projection-from-three-value-generation-layer',
      inputContractName: 'Action -> Hit -> ThreeValueDelta',
      runtimeInput: {
        sourceKind: 'azpr-runtime-input-from-three-value-generation-layer',
        status: 'runtime-input-ready-with-applied-deltas',
        contractName: 'Action -> Hit -> ThreeValueDelta',
        appliedOnly: true,
        ignoredDeltaCount: 1,
        summary: {
          inputDeltaCount: 3,
          appliedDeltaCount: 2,
          ignoredDeltaCount: 1,
          appliedTrackKeys: ['enemyHpDamage', 'selfEnergyChange'],
          appliedLayerKeys: ['applied'],
          ignoredLayerCounts: [{ key: 'candidate', count: 1 }],
          appliedOnly: true,
          applied: true,
        },
        applied: true,
      },
      appliedOnly: true,
      outputContract: {
        sourceKind: 'azpr-three-value-runtime-output-contract',
        status: 'runtime-output-contract-ready',
        inputContractName: 'Action -> Hit -> ThreeValueDelta',
        inputSourceKind: 'azpr-runtime-input-from-three-value-generation-layer',
        outputNames: ['simLog', 'stateCurves', 'resourceCurves', 'summary'],
        outputs: {
          simLog: {
            sourceKind: 'azpr-runtime-sim-log-output',
            status: 'runtime-sim-log-ready',
            rowCount: 2,
            keyFields: ['sourceDeltaId', 'runtimeSequenceIndex'],
            eventType: 'THREE_VALUE_DELTA_APPLIED',
            valueFields: ['delta', 'hpDelta', 'toughnessDelta', 'energyDelta'],
          },
          stateCurves: {
            sourceKind: 'azpr-runtime-state-curves-from-standard-deltas',
            status: 'runtime-state-curves-ready-from-standard-deltas',
            outputFields: ['enemy', 'resources', 'snapshots', 'summary'],
            enemy: {
              pointCount: 1,
              valueFields: ['hpDelta', 'toughnessDelta'],
              stateMetricKeys: ['hp', 'toughness'],
            },
            resources: {
              actorCount: 1,
              pointCount: 1,
              resourceKind: 'selfEnergy',
              valueFields: ['energyDelta'],
            },
          },
          resourceCurves: {
            sourceKind: 'azpr-runtime-resource-curves-from-standard-deltas',
            status: 'resource-curves-ready-from-standard-deltas',
            curveCollectionField: 'curvesByActor',
            actorCount: 1,
            pointCount: 1,
            valueFields: ['delta', 'energyDelta'],
          },
          summary: {
            sourceKind: 'azpr-runtime-summary-output',
            status: 'runtime-summary-ready',
            source: 'threeValueRuntimeInput.appliedDeltas',
            appliedOnly: true,
          },
        },
        summary: {
          outputCount: 4,
          appliedDeltaCount: 2,
          simLogCount: 2,
          enemyStatePointCount: 1,
          stateCurvePointCount: 2,
          resourceCurveActorCount: 1,
          resourceCurvePointCount: 1,
          enemyHpDelta: 1200,
          enemyToughnessDelta: 0,
          selfEnergyDelta: -30,
          applied: true,
        },
        applied: true,
      },
      runtimeOutputs: {
        sourceKind: 'azpr-three-value-runtime-outputs',
        status: 'runtime-outputs-ready',
        inputContractName: 'Action -> Hit -> ThreeValueDelta',
        inputSourceKind: 'azpr-runtime-input-from-three-value-generation-layer',
        outputNames: ['simLog', 'stateCurves', 'resourceCurves', 'summary'],
        outputAliases: {
          resources: 'resourceCurves',
        },
        outputContract: {
          sourceKind: 'azpr-three-value-runtime-output-contract',
          status: 'runtime-output-contract-ready',
        },
        outputConsumerContract: {
          sourceKind: 'azpr-three-value-runtime-output-consumer-contract',
          status: 'runtime-output-consumer-contract-ready',
          contractSourceKind: 'azpr-three-value-runtime-output-contract',
          canonicalOutputNames: [
            'simLog',
            'stateCurves',
            'resourceCurves',
            'summary',
          ],
          aliases: {
            resources: 'resourceCurves',
          },
          outputs: {
            simLog: {
              outputName: 'simLog',
              dataPath: 'runtimeOutputs.simLog',
              rowCount: 2,
              valueFields: [
                'delta',
                'hpDelta',
                'toughnessDelta',
                'energyDelta',
              ],
            },
            stateCurves: {
              outputName: 'stateCurves',
              dataPath: 'runtimeOutputs.stateCurves',
              enemyPointCount: 1,
              stateCurvePointCount: 2,
            },
            resourceCurves: {
              outputName: 'resourceCurves',
              dataPath: 'runtimeOutputs.resourceCurves',
              aliasPath: 'runtimeOutputs.resources',
              actorCount: 1,
              pointCount: 1,
            },
          },
          summary: {
            outputCount: 4,
            appliedDeltaCount: 2,
            simLogCount: 2,
            enemyStatePointCount: 1,
            stateCurvePointCount: 2,
            resourceCurveActorCount: 1,
            resourceCurvePointCount: 1,
            enemyHpDelta: 1200,
            enemyToughnessDelta: 0,
            selfEnergyDelta: -30,
            outputConsistencyStatus: 'runtime-output-consistent',
            outputConsistent: true,
            applied: true,
          },
        },
        simLog: [
          expect.objectContaining({
            sourceDeltaId: 'action-001|hit-1|enemyHpDamage|applied|60|0',
            trackKey: 'enemyHpDamage',
            hpDelta: 1200,
          }),
          expect.objectContaining({
            sourceDeltaId:
              'action-002|event-RESOURCE_CHANGE-0|selfEnergyChange|applied|90|0',
            trackKey: 'selfEnergyChange',
            energyDelta: -30,
          }),
        ],
        stateCurves: {
          sourceKind: 'azpr-runtime-state-curves-from-standard-deltas',
          summary: {
            enemyPointCount: 1,
            stateCurvePointCount: 2,
            resourcePointCount: 1,
            selfEnergyDelta: -30,
          },
        },
        resources: {
          sourceKind: 'azpr-runtime-resource-curves-from-standard-deltas',
          summary: {
            actorCount: 1,
            activeActorCount: 1,
            pointCount: 1,
          },
        },
        summary: {
          enemyHpDelta: 1200,
          enemyToughnessDelta: 0,
          selfEnergyDelta: -30,
          stateCurvePointCount: 2,
          simLogCount: 2,
        },
        outputConsistency: {
          sourceKind: 'azpr-runtime-output-consistency',
          status: 'runtime-output-consistent',
          simLogCount: 2,
          enemyStatePointCount: 1,
          resourceCurvePointCount: 1,
          stateCurvePointCount: 2,
          resourceActorPointCount: 1,
          checks: {
            summarySimLogCount: true,
            summaryEnemyStatePointCount: true,
            summaryResourceCurvePointCount: true,
            summaryStateCurvePointCount: true,
            stateCurvesSummaryPointCount: true,
            resourceCurvesSummaryPointCount: true,
            outputContractSummarySimLogCount: true,
            outputContractSummaryStateCurvePointCount: true,
          },
          consistent: true,
          applied: true,
        },
        outputSummary: {
          outputCount: 4,
          appliedDeltaCount: 2,
          simLogCount: 2,
          enemyStatePointCount: 1,
          stateCurvePointCount: 2,
          resourceCurveActorCount: 1,
          resourceCurvePointCount: 1,
          enemyHpDelta: 1200,
          enemyToughnessDelta: 0,
          selfEnergyDelta: -30,
          outputConsumerContractSourceKind:
            'azpr-three-value-runtime-output-consumer-contract',
          outputConsumerContractStatus:
            'runtime-output-consumer-contract-ready',
          outputConsistencyStatus: 'runtime-output-consistent',
          outputConsistent: true,
          applied: true,
        },
        applied: true,
      },
      stateCurves: {
        sourceKind: 'azpr-runtime-state-curves-from-standard-deltas',
        enemy: expect.objectContaining({
          hpDelta: 1200,
          toughnessDelta: 0,
        }),
        resources: expect.objectContaining({
          sourceKind: 'azpr-runtime-resource-curves-from-standard-deltas',
        }),
        summary: {
          enemyPointCount: 1,
          enemyHpDelta: 1200,
          enemyToughnessDelta: 0,
          stateCurvePointCount: 2,
          resourceActorCount: 1,
          activeResourceActorCount: 1,
          resourcePointCount: 1,
          selfEnergyDelta: -30,
          applied: true,
        },
        applied: true,
      },
      resourceCurves: {
        sourceKind: 'azpr-runtime-resource-curves-from-standard-deltas',
        status: 'resource-curves-ready-from-standard-deltas',
        resourceKind: 'selfEnergy',
        summary: {
          actorCount: 1,
          activeActorCount: 1,
          pointCount: 1,
          selfEnergyDelta: -30,
          applied: true,
        },
        applied: true,
      },
      enemyStateCurve: {
        pointCount: 1,
        hpDelta: 1200,
        toughnessDelta: 0,
        hpInitial: 15000,
        hpRemaining: 13800,
        applied: true,
      },
      summary: {
        inputDeltaCount: 3,
        appliedDeltaCount: 2,
        runtimeInputStatus: 'runtime-input-ready-with-applied-deltas',
        runtimeInputSourceKind:
          'azpr-runtime-input-from-three-value-generation-layer',
        runtimeInputIgnoredDeltaCount: 1,
        enemyHpDelta: 1200,
        enemyToughnessDelta: 0,
        selfEnergyDelta: -30,
        enemyStatePointCount: 1,
        selfEnergyPointCount: 1,
        resourceCurveActorCount: 1,
        activeResourceCurveActorCount: 1,
        resourceCurvePointCount: 1,
        stateCurvePointCount: 2,
        simLogCount: 2,
        calculatorCount: 2,
        calculatorKeys: [
          'azpr-hp-delta-calculator',
          'azpr-self-energy-delta-calculator',
        ],
        source: 'threeValueRuntimeInput.appliedDeltas',
        runtimeInputSource: 'threeValueRuntimeInput.appliedDeltas',
        runtimeOutputContractSourceKind:
          'azpr-three-value-runtime-output-contract',
        runtimeOutputContractStatus: 'runtime-output-contract-ready',
        runtimeOutputContractOutputCount: 4,
        appliedOnly: true,
        applied: true,
      },
      applied: true,
    });
    expect(runtimeProjection.simLog).toHaveLength(2);
    expect(runtimeProjection.runtimeOutputs.simLog).toBe(
      runtimeProjection.simLog
    );
    expect(runtimeProjection.runtimeOutputs.stateCurves).toBe(
      runtimeProjection.stateCurves
    );
    expect(runtimeProjection.runtimeOutputs.resourceCurves).toBe(
      runtimeProjection.resourceCurves
    );
    expect(runtimeProjection.runtimeOutputs.resources).toBe(
      runtimeProjection.resourceCurves
    );
    expect(runtimeProjection.runtimeOutputs.outputs.resources).toBe(
      runtimeProjection.resourceCurves
    );
    expect(runtimeProjection.runtimeOutputs.summary).toBe(
      runtimeProjection.summary
    );
    expect(runtimeProjection.runtimeOutputs.outputContract).toBe(
      runtimeProjection.outputContract
    );
    expect(runtimeProjection.runtimeOutputs.outputConsistency.checks).toEqual({
      summarySimLogCount: true,
      summaryEnemyStatePointCount: true,
      summaryResourceCurvePointCount: true,
      summaryStateCurvePointCount: true,
      stateCurvesSummaryPointCount: true,
      resourceCurvesSummaryPointCount: true,
      outputContractSummarySimLogCount: true,
      outputContractSummaryStateCurvePointCount: true,
      summaryStateSnapshotCount: true,
      simLogStateSnapshotsShared: true,
      stateCurveSnapshotsShared: true,
      summaryRuntimeCalculatorInvocationCount: true,
      simLogCalculatorInvocationsShared: true,
      stateCurveCalculatorInvocationsShared: true,
    });
    expect(runtimeProjection.runtimeStateSnapshots).toMatchObject({
      sourceKind: 'azpr-three-value-runtime-state-snapshots',
      contractName: 'AzPrThreeValueRuntimeStateSnapshot',
      summary: {
        snapshotCount: 2,
        readySnapshotCount: 1,
        pendingBaselineSnapshotCount: 1,
        enemyHpInitial: 15000,
        enemyHpFinal: 13800,
        selfEnergyActorCount: 1,
        selfEnergyBaselineReadyActorCount: 0,
        runtimeCalculatorInvocationCount: 2,
        runtimeCalculatorPassthroughInvocationCount: 2,
        runtimeCalculatorReplacedInvocationCount: 0,
        runtimeCalculatorFallbackInvocationCount: 0,
      },
    });
    expect(runtimeProjection.stateCurves.snapshots).toBe(
      runtimeProjection.runtimeStateSnapshots
    );
    expect(runtimeProjection.runtimeOutputs.stateSnapshots).toBe(
      runtimeProjection.runtimeStateSnapshots
    );
    const runtimeConsumerView =
      createThreeValueRuntimeOutputConsumerView(runtimeProjection);
    expect(runtimeConsumerView.stateSnapshots).toBe(
      runtimeProjection.runtimeStateSnapshots
    );
    expect(runtimeConsumerView.summary.stateSnapshotCount).toBe(2);
    expect(runtimeProjection.simLog[0].stateSnapshot).toBe(
      runtimeProjection.runtimeStateSnapshots.snapshots[0]
    );
    expect(runtimeProjection.runtimeAppliedDeltas).toEqual([
      expect.objectContaining({
        sourceDeltaId: 'action-001|hit-1|enemyHpDamage|applied|60|0',
        delta: 1200,
        hpDelta: 1200,
        runtimeCalculationChanged: false,
      }),
      expect.objectContaining({
        sourceDeltaId:
          'action-002|event-RESOURCE_CHANGE-0|selfEnergyChange|applied|90|0',
        delta: -30,
        energyDelta: -30,
        runtimeCalculationChanged: false,
      }),
    ]);
    expect(
      runtimeProjection.runtimeAppliedDeltas[0].runtimeCalculatorInvocation
    ).toBe(
      runtimeProjection.runtimeStateSnapshots.snapshots[0]
        .runtimeCalculatorInvocation
    );
    expect(
      runtimeProjection.runtimeStateSnapshots.snapshots[0]
        .runtimeCalculatorInvocation.input.stateBefore
    ).toBe(runtimeProjection.runtimeStateSnapshots.snapshots[0].before);
    expect(runtimeProjection.simLog[0].runtimeCalculatorInvocation).toBe(
      runtimeProjection.runtimeStateSnapshots.snapshots[0]
        .runtimeCalculatorInvocation
    );
    expect(runtimeProjection.enemyStateCurve.points[0].stateSnapshot).toBe(
      runtimeProjection.runtimeStateSnapshots.snapshots[0]
    );
    expect(
      runtimeProjection.selfEnergyCurveByActor[0].points[0].stateSnapshot
    ).toBe(runtimeProjection.runtimeStateSnapshots.snapshots[1]);
    expect(runtimeProjection.runtimeStateSnapshots.snapshots).toEqual([
      expect.objectContaining({
        sourceDeltaId: 'action-001|hit-1|enemyHpDamage|applied|60|0',
        primaryMetricKey: 'enemyHp',
        baselineConfirmed: true,
        before: expect.objectContaining({
          enemyHp: expect.objectContaining({ currentValue: 15000 }),
        }),
        delta: {
          enemyHp: 1200,
          enemyToughness: 0,
          selfEnergy: 0,
        },
        after: expect.objectContaining({
          enemyHp: expect.objectContaining({ currentValue: 13800 }),
        }),
      }),
      expect.objectContaining({
        sourceDeltaId:
          'action-002|event-RESOURCE_CHANGE-0|selfEnergyChange|applied|90|0',
        primaryMetricKey: 'selfEnergy',
        status: 'runtime-state-snapshot-pending-baseline',
        baselineConfirmed: false,
        energyOwnerActorId: 'actor-001',
        before: expect.objectContaining({
          selfEnergy: expect.objectContaining({
            actorId: 'actor-001',
            currentValue: null,
            cumulativeDelta: 0,
          }),
        }),
        delta: {
          enemyHp: 0,
          enemyToughness: 0,
          selfEnergy: -30,
        },
        after: expect.objectContaining({
          selfEnergy: expect.objectContaining({
            actorId: 'actor-001',
            currentValue: null,
            cumulativeDelta: -30,
          }),
        }),
      }),
    ]);
    expect(runtimeProjection.simLog.map(row => row.sourceDeltaId)).toEqual([
      'action-001|hit-1|enemyHpDamage|applied|60|0',
      'action-002|event-RESOURCE_CHANGE-0|selfEnergyChange|applied|90|0',
    ]);
    expect(
      runtimeProjection.simLog.map(row => row.runtimeSequenceIndex)
    ).toEqual([0, 1]);
    expect(
      runtimeProjection.simLog.some(row =>
        row.sourceDeltaId.includes('candidate')
      )
    ).toBe(false);
    expect(runtimeProjection.selfEnergyCurveByActor).toEqual([
      expect.objectContaining({
        actorId: 'actor-001',
        actorName: '末音',
        delta: -30,
        pointCount: 1,
        stateMetric: expect.objectContaining({
          initialValue: null,
          currentValue: null,
          delta: -30,
          baselineStatus: 'baseline-pending-azpr-initial-self-energy',
          baselineConfirmed: false,
        }),
      }),
    ]);
    expect(runtimeProjection.resourceCurves.curvesByActor).toEqual(
      runtimeProjection.selfEnergyCurveByActor
    );
    expect(
      createSelfEnergyDeltaSummaryByActor(
        runtimeProjection.selfEnergyCurveByActor
      )
    ).toEqual([
      {
        actorId: 'actor-001',
        actorName: '末音',
        resource: 'sp',
        delta: -30,
        currentValue: null,
        baselineStatus: 'baseline-pending-azpr-initial-self-energy',
      },
    ]);
  });

  it('uses the standard Action -> Hit -> ThreeValueDelta contract as runtime input', () => {
    const runtimeProjection = createThreeValueRuntimeProjection({
      scenario: {
        enemy: {
          stats: {
            maxHp: 10000,
          },
          hpMultiplier: 1,
        },
        actors: [
          {
            id: 'actor-001',
            name: '末音',
          },
        ],
      },
      threeValueGenerationLayer: {
        sourceKind: 'azpr-standard-three-value-generation-layer',
        status: 'standard-three-value-generation-layer-ready',
        deltas: [],
        standardContract: {
          sourceKind: 'azpr-action-hit-three-value-delta-standard-contract',
          status: 'action-hit-three-value-delta-contract-ready',
          name: 'Action -> Hit -> ThreeValueDelta',
          summary: {
            actionCount: 1,
            hitCount: 1,
            deltaCount: 1,
          },
          deltas: [
            {
              id: 'action-001|hit-1|enemyHpDamage|applied|60|0',
              actionId: 'action-001',
              actionName: '普通攻击',
              actionType: 'skill',
              actorId: 'actor-001',
              actorName: '末音',
              hitKey: 'hit-1',
              hitIndex: 1,
              frameIndex: 60,
              frameLabel: '1s0f',
              timeMs: 1000,
              trackKey: 'enemyHpDamage',
              trackLabel: '敌人HP伤害',
              layerKey: 'applied',
              valueUnit: 'raw-damage',
              delta: 800,
              hpDelta: 800,
              toughnessDelta: null,
              energyDelta: null,
              calculatorKey: 'azpr-hp-delta-calculator',
              calculator: {
                key: 'azpr-hp-delta-calculator',
                outputField: 'hpDelta',
                delta: 800,
                replaceable: true,
                appliedToRuntime: true,
              },
              applied: true,
            },
          ],
        },
      },
    });

    expect(runtimeProjection.runtimeInput).toMatchObject({
      inputSourceKind: 'azpr-action-hit-three-value-delta-standard-contract',
      inputStatus: 'action-hit-three-value-delta-contract-ready',
      generationLayerSourceKind: 'azpr-standard-three-value-generation-layer',
      generationLayerStatus: 'standard-three-value-generation-layer-ready',
      summary: {
        standardContractSourceKind:
          'azpr-action-hit-three-value-delta-standard-contract',
        standardContractStatus: 'action-hit-three-value-delta-contract-ready',
        standardContractActionCount: 1,
        standardContractHitCount: 1,
        inputDeltaCount: 1,
        appliedDeltaCount: 1,
      },
    });
    expect(runtimeProjection.simLog).toHaveLength(1);
    expect(runtimeProjection.summary).toMatchObject({
      inputDeltaCount: 1,
      appliedDeltaCount: 1,
      enemyHpDelta: 800,
      simLogCount: 1,
    });
  });

  it('consumes the generation builder runtime input source directly', () => {
    const runtimeProjection = createThreeValueRuntimeProjection({
      scenario: {
        enemy: {
          stats: {
            maxHp: 10000,
          },
          hpMultiplier: 1,
        },
        actors: [
          {
            id: 'actor-001',
            name: '末音',
          },
        ],
      },
      runtimeInputSource: {
        sourceKind: 'azpr-runtime-input-source-from-generation-builder',
        status: 'runtime-input-source-ready',
        contractName: 'Action -> Hit -> ThreeValueDelta',
        generationLayerSourceKind: 'azpr-standard-three-value-generation-layer',
        generationLayerStatus: 'standard-three-value-generation-layer-ready',
        standardContract: {
          sourceKind: 'azpr-action-hit-three-value-delta-standard-contract',
          status: 'action-hit-three-value-delta-contract-ready',
          name: 'Action -> Hit -> ThreeValueDelta',
          summary: {
            actionCount: 1,
            hitCount: 1,
            deltaCount: 1,
          },
          deltas: [
            {
              id: 'action-001|hit-1|enemyHpDamage|applied|60|0',
              actionId: 'action-001',
              actionName: '普通攻击',
              actionType: 'skill',
              actorId: 'actor-001',
              actorName: '末音',
              hitKey: 'hit-1',
              hitIndex: 1,
              frameIndex: 60,
              frameLabel: '1s0f',
              timeMs: 1000,
              trackKey: 'enemyHpDamage',
              trackLabel: '敌人HP伤害',
              layerKey: 'applied',
              valueUnit: 'raw-damage',
              delta: 800,
              hpDelta: 800,
              toughnessDelta: null,
              energyDelta: null,
              calculatorKey: 'azpr-hp-delta-calculator',
              calculator: {
                key: 'azpr-hp-delta-calculator',
                outputField: 'hpDelta',
                delta: 800,
                replaceable: true,
                appliedToRuntime: true,
              },
              applied: true,
            },
          ],
        },
        deltas: [
          {
            id: 'action-001|hit-1|enemyHpDamage|applied|60|0',
            actionId: 'action-001',
            actionName: '普通攻击',
            actionType: 'skill',
            actorId: 'actor-001',
            actorName: '末音',
            hitKey: 'hit-1',
            hitIndex: 1,
            frameIndex: 60,
            frameLabel: '1s0f',
            timeMs: 1000,
            trackKey: 'enemyHpDamage',
            trackLabel: '敌人HP伤害',
            layerKey: 'applied',
            valueUnit: 'raw-damage',
            delta: 800,
            hpDelta: 800,
            toughnessDelta: null,
            energyDelta: null,
            calculatorKey: 'azpr-hp-delta-calculator',
            applied: true,
          },
        ],
      },
      threeValueGenerationLayer: {
        sourceKind: 'azpr-standard-three-value-generation-layer',
        status: 'standard-three-value-generation-layer-ready',
        deltas: [],
      },
    });

    expect(runtimeProjection).toMatchObject({
      sourceKind: 'azpr-runtime-projection-from-runtime-input-source',
      status: 'runtime-projection-ready-from-runtime-input-source',
      runtimeInput: {
        sourceKind: 'azpr-runtime-input-from-generation-builder-source',
        runtimeInputSourceKind:
          'azpr-runtime-input-source-from-generation-builder',
        runtimeInputSourceStatus: 'runtime-input-source-ready',
        generationLayerSourceKind: 'azpr-standard-three-value-generation-layer',
        generationLayerStatus: 'standard-three-value-generation-layer-ready',
        summary: {
          runtimeInputSourceKind:
            'azpr-runtime-input-source-from-generation-builder',
          standardContractSourceKind:
            'azpr-action-hit-three-value-delta-standard-contract',
          inputDeltaCount: 1,
          appliedDeltaCount: 1,
        },
      },
      summary: {
        runtimeInputSourceKind:
          'azpr-runtime-input-from-generation-builder-source',
        runtimeInputSourceInputKind:
          'azpr-runtime-input-source-from-generation-builder',
        inputDeltaCount: 1,
        appliedDeltaCount: 1,
        enemyHpDelta: 800,
        runtimeOutputContractSourceKind:
          'azpr-three-value-runtime-output-contract',
        runtimeOutputContractStatus: 'runtime-output-contract-ready',
        runtimeOutputContractOutputCount: 4,
        source: 'threeValueRuntimeInput.appliedDeltas',
        simLogCount: 1,
      },
    });
    expect(runtimeProjection.outputContract).toMatchObject({
      sourceKind: 'azpr-three-value-runtime-output-contract',
      status: 'runtime-output-contract-ready',
      inputSourceKind: 'azpr-runtime-input-from-generation-builder-source',
      runtimeInputSourceKind:
        'azpr-runtime-input-source-from-generation-builder',
      outputs: {
        simLog: {
          rowCount: 1,
          keyFields: ['sourceDeltaId', 'runtimeSequenceIndex'],
        },
        stateCurves: {
          enemy: {
            pointCount: 1,
          },
          resources: {
            actorCount: 1,
            pointCount: 0,
          },
        },
        summary: {
          source: 'threeValueRuntimeInput.appliedDeltas',
        },
      },
      summary: {
        outputCount: 4,
        appliedDeltaCount: 1,
        simLogCount: 1,
        enemyHpDelta: 800,
      },
    });
  });

  it('consumes generation outputs as the production runtime input entry', () => {
    const runtimeProjection = createThreeValueRuntimeProjection({
      scenario: {
        enemy: {
          stats: {
            maxHp: 10000,
          },
          hpMultiplier: 1,
        },
        actors: [
          {
            id: 'actor-001',
            name: '末音',
          },
        ],
      },
      generationOutputs: {
        sourceKind: 'azpr-three-value-generation-outputs',
        status: 'generation-outputs-ready',
        runtimeInputSource: {
          sourceKind: 'azpr-runtime-input-source-from-generation-builder',
          status: 'runtime-input-source-ready',
          contractName: 'Action -> Hit -> ThreeValueDelta',
          generationEntrySourceKind:
            'azpr-action-hit-three-value-delta-generation-entry',
          generationEntryStatus:
            'action-hit-three-value-delta-generation-ready',
          generationLayerSourceKind:
            'azpr-standard-three-value-generation-layer',
          generationLayerStatus: 'standard-three-value-generation-layer-ready',
          standardContract: {
            sourceKind: 'azpr-action-hit-three-value-delta-standard-contract',
            status: 'action-hit-three-value-delta-contract-ready',
            name: 'Action -> Hit -> ThreeValueDelta',
            summary: {
              actionCount: 1,
              hitCount: 1,
              deltaCount: 1,
            },
            actions: [
              {
                actionId: 'action-001',
                actionName: '普通攻击',
                threeValueDeltaAggregate: {
                  sourceKind: 'azpr-action-hit-three-value-delta-aggregate',
                  deltaCount: 1,
                  layerKeys: ['applied'],
                  trackKeys: ['enemyHpDamage'],
                  layers: {
                    applied: {
                      layerKey: 'applied',
                      runtimeApplied: true,
                      deltaCount: 1,
                      trackKeys: ['enemyHpDamage'],
                      hpDelta: 800,
                      toughnessDelta: 0,
                      energyDelta: 0,
                    },
                  },
                },
              },
            ],
            hits: [
              {
                actionId: 'action-001',
                actionName: '普通攻击',
                hitKey: 'hit-1',
                hitIndex: 1,
                frameIndex: 60,
                timeMs: 1000,
                threeValueDeltaAggregate: {
                  sourceKind: 'azpr-action-hit-three-value-delta-aggregate',
                  deltaCount: 1,
                  layerKeys: ['applied'],
                  trackKeys: ['enemyHpDamage'],
                  layers: {
                    applied: {
                      layerKey: 'applied',
                      runtimeApplied: true,
                      deltaCount: 1,
                      trackKeys: ['enemyHpDamage'],
                      hpDelta: 800,
                      toughnessDelta: 0,
                      energyDelta: 0,
                    },
                  },
                },
              },
            ],
            deltas: [
              {
                id: 'action-001|hit-1|enemyHpDamage|applied|60|0',
                actionId: 'action-001',
                actionName: '普通攻击',
                actionType: 'skill',
                actorId: 'actor-001',
                actorName: '末音',
                hitKey: 'hit-1',
                hitIndex: 1,
                frameIndex: 60,
                frameLabel: '1s0f',
                timeMs: 1000,
                trackKey: 'enemyHpDamage',
                trackLabel: '敌人HP伤害',
                layerKey: 'applied',
                valueUnit: 'raw-damage',
                delta: 800,
                hpDelta: 800,
                toughnessDelta: null,
                energyDelta: null,
                calculatorKey: 'azpr-hp-delta-calculator',
                applied: true,
              },
            ],
          },
          deltas: [
            {
              id: 'action-001|hit-1|enemyHpDamage|applied|60|0',
              actionId: 'action-001',
              actionName: '普通攻击',
              actionType: 'skill',
              actorId: 'actor-001',
              actorName: '末音',
              hitKey: 'hit-1',
              hitIndex: 1,
              frameIndex: 60,
              frameLabel: '1s0f',
              timeMs: 1000,
              trackKey: 'enemyHpDamage',
              trackLabel: '敌人HP伤害',
              layerKey: 'applied',
              valueUnit: 'raw-damage',
              delta: 800,
              hpDelta: 800,
              toughnessDelta: null,
              energyDelta: null,
              calculatorKey: 'azpr-hp-delta-calculator',
              applied: true,
            },
          ],
        },
      },
    });

    expect(runtimeProjection.runtimeInput).toMatchObject({
      sourceKind: 'azpr-runtime-input-from-generation-builder-source',
      runtimeInputSourceKind:
        'azpr-runtime-input-source-from-generation-builder',
      runtimeInputSourceStatus: 'runtime-input-source-ready',
      generationOutputsSourceKind: 'azpr-three-value-generation-outputs',
      generationOutputsStatus: 'generation-outputs-ready',
      generationEntrySourceKind:
        'azpr-action-hit-three-value-delta-generation-entry',
      generationEntryStatus: 'action-hit-three-value-delta-generation-ready',
      generationLayerSourceKind: 'azpr-standard-three-value-generation-layer',
      generationLayerStatus: 'standard-three-value-generation-layer-ready',
      summary: {
        generationOutputsSourceKind: 'azpr-three-value-generation-outputs',
        generationOutputsStatus: 'generation-outputs-ready',
        inputDeltaCount: 1,
        appliedDeltaCount: 1,
      },
    });
    expect(runtimeProjection.summary).toMatchObject({
      inputDeltaCount: 1,
      appliedDeltaCount: 1,
      enemyHpDelta: 800,
      simLogCount: 1,
    });
    expect(runtimeProjection.outputContract.outputs.simLog).toMatchObject({
      aggregateFields: [
        'actionThreeValueDeltaAggregate',
        'hitThreeValueDeltaAggregate',
      ],
    });
    expect(runtimeProjection.runtimeInput.appliedDeltas[0]).toMatchObject({
      actionThreeValueDeltaAggregate: expect.objectContaining({
        deltaCount: 1,
      }),
      hitThreeValueDeltaAggregate: expect.objectContaining({
        layers: {
          applied: expect.objectContaining({
            hpDelta: 800,
            toughnessDelta: 0,
            energyDelta: 0,
          }),
        },
      }),
    });
    expect(runtimeProjection.simLog[0]).toMatchObject({
      actionThreeValueDeltaAggregate: expect.objectContaining({
        deltaCount: 1,
      }),
      hitThreeValueDeltaAggregate: expect.objectContaining({
        layers: {
          applied: expect.objectContaining({
            hpDelta: 800,
          }),
        },
      }),
    });
    expect(runtimeProjection.enemyStateCurve.points[0]).toMatchObject({
      hitThreeValueDeltaAggregate: expect.objectContaining({
        layers: {
          applied: expect.objectContaining({
            hpDelta: 800,
          }),
        },
      }),
    });
    expect(runtimeProjection.runtimeOutputs.outputSummary).toMatchObject({
      outputCount: 4,
      appliedDeltaCount: 1,
      simLogCount: 1,
      stateCurvePointCount: 1,
      enemyHpDelta: 800,
      outputConsistencyStatus: 'runtime-output-consistent',
      outputConsistent: true,
    });
  });

  it('propagates standard generation output read sources into projection summaries', () => {
    const standardDelta = createRuntimeProjectionDelta({
      sourceDeltaId: 'standard-output-delta',
      actionId: 'action-standard',
      delta: 420,
    });
    const directDelta = createRuntimeProjectionDelta({
      sourceDeltaId: 'direct-generation-output-delta',
      actionId: 'action-direct',
      delta: 900,
    });
    const runtimeSourceDelta = createRuntimeProjectionDelta({
      sourceDeltaId: 'runtime-input-source-delta',
      actionId: 'action-runtime-source',
      delta: 777,
    });
    const standardContract = createRuntimeProjectionContract({
      sourceKind: 'standard-contract-from-outputs',
      delta: standardDelta,
    });
    const directContract = createRuntimeProjectionContract({
      sourceKind: 'direct-generation-output-contract',
      delta: directDelta,
    });
    const runtimeSourceContract = createRuntimeProjectionContract({
      sourceKind: 'runtime-input-source-contract',
      delta: runtimeSourceDelta,
    });

    const runtimeProjection = createThreeValueRuntimeProjection({
      scenario: {
        enemy: {
          stats: {
            maxHp: 10000,
          },
          hpMultiplier: 1,
        },
        actors: [
          {
            id: 'actor-standard',
            name: '标准角色',
          },
        ],
      },
      generationOutputs: {
        sourceKind: 'azpr-three-value-generation-outputs',
        status: 'generation-outputs-ready',
        outputs: {
          generationEntry: {
            sourceKind:
              'azpr-action-hit-three-value-delta-standard-generation-entry',
            status:
              'action-hit-three-value-delta-standard-generation-entry-ready',
            contractValidation: {
              sourceKind:
                'azpr-action-hit-three-value-delta-generation-entry-contract-validation',
              status: 'generation-entry-contract-valid',
              issueCount: 0,
              aggregateValidation: {
                sourceKind:
                  'azpr-action-hit-three-value-delta-generation-entry-aggregate-validation',
                status: 'generation-entry-aggregate-valid',
                issueCount: 0,
                valid: true,
              },
              valid: true,
            },
            runtimeInputSource: {
              sourceKind: 'azpr-runtime-input-source-from-generation-builder',
              status: 'runtime-input-source-ready',
              generationEntrySourceKind:
                'azpr-action-hit-three-value-delta-generation-entry',
              generationEntryStatus:
                'action-hit-three-value-delta-generation-ready',
              generationLayerSourceKind:
                'azpr-standard-three-value-generation-layer',
              generationLayerStatus:
                'standard-three-value-generation-layer-ready',
              standardContract: runtimeSourceContract,
              deltas: [runtimeSourceDelta],
            },
            standardContract,
            deltas: [standardDelta],
          },
          runtimeInputSource: {
            sourceKind: 'azpr-runtime-input-source-from-generation-builder',
            status: 'runtime-input-source-ready',
            generationEntrySourceKind:
              'azpr-action-hit-three-value-delta-generation-entry',
            generationEntryStatus:
              'action-hit-three-value-delta-generation-ready',
            generationLayerSourceKind:
              'azpr-standard-three-value-generation-layer',
            generationLayerStatus:
              'standard-three-value-generation-layer-ready',
            standardContract: runtimeSourceContract,
            deltas: [runtimeSourceDelta],
          },
          standardContract,
          deltas: [standardDelta],
        },
        runtimeInputSource: {
          sourceKind: 'legacy-runtime-input-source',
          status: 'legacy-runtime-input-source-ready',
          standardContract: runtimeSourceContract,
          deltas: [runtimeSourceDelta],
        },
        standardContract: directContract,
        deltas: [directDelta],
      },
    });

    expect(runtimeProjection.runtimeInput.appliedDeltas).toEqual([
      expect.objectContaining({
        sourceDeltaId: 'standard-output-delta',
        actionId: 'action-standard',
        delta: 420,
        hpDelta: 420,
      }),
    ]);
    expect(runtimeProjection.summary).toMatchObject({
      enemyHpDelta: 420,
      runtimeInputGenerationReadSourcesStatus:
        'runtime-input-generation-read-sources-ready',
      runtimeInputGenerationReadStandardOutputCount: 5,
      runtimeInputGenerationReadFallbackInputCount: 0,
      runtimeInputGenerationReadUsesLegacyFallback: false,
      runtimeInputGenerationStandardBoundaryReady: true,
      runtimeInputGenerationEntryContractValidationStatus:
        'generation-entry-contract-valid',
      runtimeInputGenerationEntryContractValidationIssueCount: 0,
      runtimeInputGenerationEntryContractValidationValid: true,
      runtimeInputGenerationEntryAggregateValidationStatus:
        'generation-entry-aggregate-valid',
      runtimeInputGenerationEntryAggregateValidationIssueCount: 0,
      runtimeInputGenerationEntryAggregateValidationValid: true,
      runtimeInputGenerationAggregateBoundaryReady: true,
      runtimeInputGenerationEntryPath:
        'generationOutputs.outputs.generationEntry',
      runtimeInputGenerationRuntimeInputSourcePath:
        'generationOutputs.outputs.generationEntry.runtimeInputSource',
      runtimeInputGenerationStandardContractPath:
        'generationOutputs.outputs.generationEntry.standardContract',
      runtimeInputGenerationDeltasPath:
        'generationOutputs.outputs.generationEntry.deltas',
      runtimeInputGenerationContractValidationPath:
        'generationOutputs.outputs.generationEntry.contractValidation',
      runtimeInputGenerationAggregateValidationPath:
        'generationOutputs.outputs.generationEntry.contractValidation.aggregateValidation',
    });
    expect(runtimeProjection.outputContract.summary).toMatchObject({
      enemyHpDelta: 420,
      runtimeInputGenerationReadSourcesStatus:
        'runtime-input-generation-read-sources-ready',
      runtimeInputGenerationReadStandardOutputCount: 5,
      runtimeInputGenerationReadFallbackInputCount: 0,
      runtimeInputGenerationReadUsesLegacyFallback: false,
      runtimeInputGenerationStandardBoundaryReady: true,
      runtimeInputGenerationEntryContractValidationStatus:
        'generation-entry-contract-valid',
      runtimeInputGenerationEntryContractValidationValid: true,
      runtimeInputGenerationEntryAggregateValidationStatus:
        'generation-entry-aggregate-valid',
      runtimeInputGenerationEntryAggregateValidationValid: true,
      runtimeInputGenerationAggregateBoundaryReady: true,
    });
    expect(runtimeProjection.runtimeOutputs.outputSummary).toMatchObject({
      enemyHpDelta: 420,
      runtimeInputGenerationReadSourcesStatus:
        'runtime-input-generation-read-sources-ready',
      runtimeInputGenerationReadStandardOutputCount: 5,
      runtimeInputGenerationReadFallbackInputCount: 0,
      runtimeInputGenerationReadUsesLegacyFallback: false,
      runtimeInputGenerationStandardBoundaryReady: true,
      runtimeInputGenerationEntryContractValidationStatus:
        'generation-entry-contract-valid',
      runtimeInputGenerationEntryContractValidationValid: true,
      runtimeInputGenerationEntryAggregateValidationStatus:
        'generation-entry-aggregate-valid',
      runtimeInputGenerationEntryAggregateValidationValid: true,
      runtimeInputGenerationAggregateBoundaryReady: true,
      runtimeInputGenerationEntryPath:
        'generationOutputs.outputs.generationEntry',
      runtimeInputGenerationRuntimeInputSourcePath:
        'generationOutputs.outputs.generationEntry.runtimeInputSource',
      runtimeInputGenerationStandardContractPath:
        'generationOutputs.outputs.generationEntry.standardContract',
      runtimeInputGenerationDeltasPath:
        'generationOutputs.outputs.generationEntry.deltas',
      runtimeInputGenerationContractValidationPath:
        'generationOutputs.outputs.generationEntry.contractValidation',
      runtimeInputGenerationAggregateValidationPath:
        'generationOutputs.outputs.generationEntry.contractValidation.aggregateValidation',
    });
  });

  it('advances enemy and per-actor energy state snapshots independently', () => {
    const runtimeProjection = createThreeValueRuntimeProjection({
      scenario: {
        enemy: {
          id: 'enemy-001',
          stats: {
            maxHp: 1000,
            maxToughness: 100,
            initialToughness: 100,
          },
          hpMultiplier: 1,
          toughness: {
            baseMax: 100,
            maxValue: 100,
            initialValue: 100,
          },
        },
        actors: [
          {
            id: 'actor-001',
            name: '末音',
            initialSp: 10,
            stats: { maxSp: 100 },
          },
          {
            id: 'actor-002',
            name: '寒悠悠',
            initialSp: 40,
            stats: { maxSp: 100 },
          },
        ],
      },
      threeValueGenerationLayer: {
        contract: { name: 'Action -> Hit -> ThreeValueDelta' },
        deltas: [
          createRuntimeStateDelta({
            id: 'hp-a',
            actorId: 'actor-001',
            actorName: '末音',
            trackKey: 'enemyHpDamage',
            value: 100,
            frameIndex: 10,
          }),
          createRuntimeStateDelta({
            id: 'energy-a',
            actorId: 'actor-001',
            actorName: '末音',
            trackKey: 'selfEnergyChange',
            value: 5,
            frameIndex: 11,
          }),
          createRuntimeStateDelta({
            id: 'toughness-b',
            actorId: 'actor-002',
            actorName: '寒悠悠',
            trackKey: 'enemyToughnessDamage',
            value: 20,
            frameIndex: 20,
          }),
          createRuntimeStateDelta({
            id: 'energy-b',
            actorId: 'actor-002',
            actorName: '寒悠悠',
            trackKey: 'selfEnergyChange',
            value: -10,
            frameIndex: 21,
          }),
        ],
      },
    });

    const snapshots = runtimeProjection.runtimeStateSnapshots.snapshots;
    expect(snapshots).toHaveLength(4);
    expect(snapshots[0]).toMatchObject({
      sourceDeltaId: 'hp-a',
      energyOwnerActorId: 'actor-001',
      before: {
        enemyHp: expect.objectContaining({ currentValue: 1000 }),
        enemyToughness: expect.objectContaining({ currentValue: 100 }),
        selfEnergy: expect.objectContaining({
          actorId: 'actor-001',
          currentValue: 10,
        }),
      },
      after: {
        enemyHp: expect.objectContaining({ currentValue: 900 }),
        enemyToughness: expect.objectContaining({ currentValue: 100 }),
        selfEnergy: expect.objectContaining({
          actorId: 'actor-001',
          currentValue: 10,
        }),
      },
    });
    expect(snapshots[1]).toMatchObject({
      sourceDeltaId: 'energy-a',
      energyOwnerActorId: 'actor-001',
      before: {
        selfEnergy: expect.objectContaining({ currentValue: 10 }),
      },
      delta: { selfEnergy: 5 },
      after: {
        selfEnergy: expect.objectContaining({
          currentValue: 15,
          cumulativeDelta: 5,
        }),
      },
    });
    expect(snapshots[2]).toMatchObject({
      sourceDeltaId: 'toughness-b',
      energyOwnerActorId: 'actor-002',
      before: {
        enemyToughness: expect.objectContaining({ currentValue: 100 }),
        selfEnergy: expect.objectContaining({ currentValue: 40 }),
      },
      after: {
        enemyToughness: expect.objectContaining({ currentValue: 80 }),
        selfEnergy: expect.objectContaining({ currentValue: 40 }),
      },
    });
    expect(snapshots[3]).toMatchObject({
      sourceDeltaId: 'energy-b',
      energyOwnerActorId: 'actor-002',
      before: {
        selfEnergy: expect.objectContaining({ currentValue: 40 }),
      },
      delta: { selfEnergy: -10 },
      after: {
        selfEnergy: expect.objectContaining({
          currentValue: 30,
          cumulativeDelta: -10,
        }),
      },
    });
    expect(runtimeProjection.runtimeStateSnapshots.summary).toMatchObject({
      snapshotCount: 4,
      readySnapshotCount: 4,
      pendingBaselineSnapshotCount: 0,
      enemyHpInitial: 1000,
      enemyHpFinal: 900,
      enemyToughnessInitial: 100,
      enemyToughnessFinal: 80,
      selfEnergyActorCount: 2,
      selfEnergyBaselineReadyActorCount: 2,
      selfEnergyFinalByActor: [
        expect.objectContaining({
          actorId: 'actor-001',
          initialValue: 10,
          delta: 5,
          currentValue: 15,
        }),
        expect.objectContaining({
          actorId: 'actor-002',
          initialValue: 40,
          delta: -10,
          currentValue: 30,
        }),
      ],
    });
    expect(runtimeProjection.simLog.map(row => row.stateSnapshot)).toEqual(
      snapshots
    );
    expect(
      runtimeProjection.enemyStateCurve.points.map(point => point.stateSnapshot)
    ).toEqual([snapshots[0], snapshots[2]]);
    expect(
      runtimeProjection.selfEnergyCurveByActor.flatMap(actor =>
        actor.points.map(point => point.stateSnapshot)
      )
    ).toEqual([snapshots[1], snapshots[3]]);
  });

  it('replaces only runtime delta output through a state-aware calculator adapter', () => {
    const generationDelta = createRuntimeStateDelta({
      id: 'hp-replace',
      actorId: 'actor-001',
      actorName: '末音',
      trackKey: 'enemyHpDamage',
      value: 100,
      frameIndex: 10,
    });
    const runtimeProjection = createThreeValueRuntimeProjection({
      scenario: {
        enemy: {
          id: 'enemy-001',
          stats: { maxHp: 1000 },
          hpMultiplier: 1,
        },
        actors: [
          {
            id: 'actor-001',
            name: '末音',
            initialSp: 0,
            stats: { maxSp: 100 },
          },
        ],
      },
      threeValueGenerationLayer: {
        contract: { name: 'Action -> Hit -> ThreeValueDelta' },
        deltas: [generationDelta],
      },
      runtimeCalculatorAdapters: {
        enemyHpDamage: {
          key: 'unit-test-state-aware-hp-adapter',
          version: 7,
          calculate(input) {
            return {
              delta:
                input.stateBefore.enemyHp.currentValue === 1000
                  ? input.generatedDelta.delta * 2
                  : input.generatedDelta.delta,
              status: 'unit-test-runtime-hp-replaced',
            };
          },
        },
      },
    });

    expect(runtimeProjection.runtimeInput.appliedDeltas[0]).toMatchObject({
      delta: 100,
      hpDelta: 100,
    });
    expect(runtimeProjection.runtimeAppliedDeltas[0]).toMatchObject({
      delta: 200,
      hpDelta: 200,
      runtimeCalculatorAdapterKey: 'unit-test-state-aware-hp-adapter',
      runtimeCalculatorInvocationStatus:
        'runtime-calculator-invocation-ready-replaced',
      runtimeCalculationChanged: true,
    });
    const snapshot = runtimeProjection.runtimeStateSnapshots.snapshots[0];
    expect(snapshot).toMatchObject({
      before: {
        enemyHp: expect.objectContaining({ currentValue: 1000 }),
      },
      delta: { enemyHp: 200 },
      after: {
        enemyHp: expect.objectContaining({ currentValue: 800 }),
      },
      runtimeCalculatorAdapterKey: 'unit-test-state-aware-hp-adapter',
      runtimeCalculationChanged: true,
    });
    expect(snapshot.runtimeCalculatorInvocation).toMatchObject({
      contractName: 'ThreeValueRuntimeCalculatorInvocation',
      status: 'runtime-calculator-invocation-ready-replaced',
      adapter: {
        key: 'unit-test-state-aware-hp-adapter',
        version: 7,
        custom: true,
        replaceable: true,
      },
      output: {
        delta: 200,
        hpDelta: 200,
        status: 'unit-test-runtime-hp-replaced',
      },
      changed: true,
      preservesGeneratedDelta: false,
    });
    expect(snapshot.runtimeCalculatorInvocation.input.stateBefore).toBe(
      snapshot.before
    );
    expect(snapshot.runtimeCalculatorInvocation.input.sourceDelta).toBe(
      runtimeProjection.runtimeInput.appliedDeltas[0]
    );
    expect(generationDelta).toMatchObject({ delta: 100, hpDelta: 100 });
    expect(runtimeProjection.summary).toMatchObject({
      enemyHpDelta: 200,
      enemyHpRemaining: 800,
      runtimeCalculatorInvocationCount: 1,
      runtimeCalculatorPassthroughInvocationCount: 0,
      runtimeCalculatorReplacedInvocationCount: 1,
      runtimeCalculatorFallbackInvocationCount: 0,
      runtimeCalculatorCustomAdapterInvocationCount: 1,
    });
  });

  it('derives remaining enemy toughness from the configured scenario baseline', () => {
    const runtimeProjection = createThreeValueRuntimeProjection({
      scenario: {
        enemy: {
          stats: {
            maxHp: 10000,
            maxToughness: 13334,
            initialToughness: 3333.5,
          },
          toughness: {
            baseMax: 6667,
            maxMultiplier: 2,
            initialRatio: 0.25,
            maxValue: 13334,
            initialValue: 3333.5,
          },
        },
        actors: [],
      },
      threeValueGenerationLayer: {
        contract: {
          name: 'Action -> Hit -> ThreeValueDelta',
        },
        deltas: [
          {
            id: 'action-001|hit-1|enemyToughnessDamage|applied|60|0',
            actionId: 'action-001',
            actionName: '重击',
            actionType: 'skill',
            actorId: 'actor-001',
            actorName: '末音',
            hitKey: 'hit-1',
            hitIndex: 1,
            frameIndex: 60,
            frameLabel: '1s0f',
            timeMs: 1000,
            trackKey: 'enemyToughnessDamage',
            trackLabel: '敌人韧性削减',
            layerKey: 'applied',
            valueUnit: 'raw-field',
            delta: 500,
            hpDelta: null,
            toughnessDelta: 500,
            energyDelta: null,
            applied: true,
          },
        ],
      },
    });

    expect(runtimeProjection.enemyStateCurve).toMatchObject({
      toughnessDelta: 500,
      toughnessInitial: 3333.5,
      toughnessRemaining: 2833.5,
      toughnessBaselineStatus:
        'baseline-derived-from-scenario-enemy-WEAKNESS_POINT_MAX',
      baseline: {
        toughness: {
          initialValue: 3333.5,
          maxValue: 13334,
          baseValue: 6667,
          multiplier: 2,
          initialRatio: 0.25,
          applied: true,
        },
      },
      stateMetrics: {
        toughness: {
          initialValue: 3333.5,
          maxValue: 13334,
          delta: 500,
          currentValue: 2833.5,
          baselineConfirmed: true,
          applied: true,
        },
      },
    });
  });

  it('keeps no-applied-delta status in the output consumer contract', () => {
    const runtimeProjection = createThreeValueRuntimeProjection({
      scenario: {
        enemy: {},
        actors: [],
      },
      threeValueGenerationLayer: {
        contract: {
          name: 'Action -> Hit -> ThreeValueDelta',
        },
        deltas: [
          {
            id: 'candidate-only-delta',
            actionId: 'action-001',
            trackKey: 'enemyHpDamage',
            layerKey: 'candidate',
            delta: 1200,
            hpDelta: 1200,
            applied: false,
          },
        ],
      },
    });

    expect(runtimeProjection.outputContract).toMatchObject({
      status: 'runtime-output-contract-ready-no-applied-deltas',
      summary: {
        appliedDeltaCount: 0,
        simLogCount: 0,
        stateCurvePointCount: 0,
      },
    });
    expect(runtimeProjection.runtimeOutputs).toMatchObject({
      status: 'runtime-outputs-ready-no-applied-deltas',
      outputConsumerContract: {
        status: 'runtime-output-consumer-contract-ready-no-applied-deltas',
        summary: {
          appliedDeltaCount: 0,
          simLogCount: 0,
          stateCurvePointCount: 0,
        },
      },
      outputSummary: {
        outputConsumerContractStatus:
          'runtime-output-consumer-contract-ready-no-applied-deltas',
        outputConsistent: true,
      },
    });
  });
});

function createRuntimeProjectionDelta({ sourceDeltaId, actionId, delta }) {
  return {
    id: sourceDeltaId,
    sourceDeltaId,
    actionId,
    actionName: actionId,
    actionType: 'skill',
    actorId: 'actor-standard',
    actorName: '标准角色',
    hitKey: `${actionId}|hit-1`,
    hitIndex: 0,
    frameIndex: 12,
    frameLabel: '0s12f',
    timeMs: 200,
    sequenceIndex: 0,
    trackKey: 'enemyHpDamage',
    layerKey: 'applied',
    delta,
    hpDelta: delta,
    toughnessDelta: 0,
    energyDelta: 0,
    applied: true,
  };
}

function createRuntimeStateDelta({
  id,
  actorId,
  actorName,
  trackKey,
  value,
  frameIndex,
}) {
  return {
    id,
    actionId: `action-${id}`,
    actionName: id,
    actionType: 'skill',
    actorId,
    actorName,
    hitKey: `hit-${id}`,
    hitIndex: 0,
    frameIndex,
    frameLabel: `0s${frameIndex}f`,
    timeMs: frameIndex * (1000 / 60),
    sequenceIndex: 0,
    trackKey,
    layerKey: 'applied',
    valueUnit: trackKey === 'selfEnergyChange' ? 'sp' : 'raw-field',
    delta: value,
    hpDelta: trackKey === 'enemyHpDamage' ? value : null,
    toughnessDelta: trackKey === 'enemyToughnessDamage' ? value : null,
    energyDelta: trackKey === 'selfEnergyChange' ? value : null,
    mechanismContext: {
      ownership: {
        energyOwnerActorId: actorId,
        targetEnemyId: 'enemy-001',
      },
    },
    applied: true,
  };
}

function createRuntimeProjectionContract({ sourceKind, delta }) {
  return {
    schemaVersion: 1,
    sourceKind,
    status: 'action-hit-three-value-delta-contract-ready',
    name: 'Action -> Hit -> ThreeValueDelta',
    actions: [],
    hits: [],
    deltas: [delta],
    summary: {
      actionCount: 1,
      hitCount: 1,
      deltaCount: 1,
      appliedDeltaCount: 1,
      candidateDeltaCount: 0,
      sampledDeltaCount: 0,
      placeholderDeltaCount: 0,
    },
  };
}
