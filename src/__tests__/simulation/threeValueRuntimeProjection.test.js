import { describe, expect, it } from 'vitest';
import {
  createSelfEnergyDeltaSummaryByActor,
  createThreeValueRuntimeProjection,
} from '../../simulation/runtime/threeValueRuntimeProjection';

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
            outputFields: ['enemy', 'resources', 'summary'],
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
    });
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
});
