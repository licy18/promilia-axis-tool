import { describe, expect, it } from 'vitest';
import { createThreeValueGenerationLayer } from '../../simulation/generation/threeValueGenerationLayer';

describe('three value generation layer', () => {
  it('uses action results and candidate hit values as the unified generation input', () => {
    const layer = createThreeValueGenerationLayer({
      scenario: {
        actions: [
          {
            id: 'action-001',
            type: 'skill',
            name: '普通攻击',
            actorId: 'actor-001',
            actor: { name: '末音' },
            startMs: 1000,
          },
          {
            id: 'action-002',
            type: 'wait',
            name: '等待',
            actorId: 'actor-001',
            actor: { name: '末音' },
            startMs: 1500,
          },
        ],
      },
      actionResultTimeline: [
        {
          actionId: 'action-001',
          actionName: '普通攻击',
          actionType: 'skill',
          actorId: 'actor-001',
          actorName: '末音',
          skillId: 10900101,
          timeMs: 1000,
          hpDamage: {
            value: 1200,
            applied: true,
            status: 'raw-hp-projection',
            confidence: 'unit-test',
            sourceEvidence: {
              status: 'candidate-fields-found',
              matchedElementConfigIds: [109001081],
            },
          },
          toughnessDamage: {
            value: 0,
            applied: false,
            status: 'placeholder',
          },
          selfEnergyChange: {
            value: 0,
            applied: false,
            status: 'placeholder',
          },
        },
        {
          actionId: 'action-002',
          actionName: '等待',
          actionType: 'wait',
          actorId: 'actor-001',
          actorName: '末音',
          timeMs: 1500,
          hpDamage: {
            value: 0,
            applied: false,
            status: 'non-damage-action',
          },
          toughnessDamage: {
            value: 0,
            applied: false,
            status: 'non-damage-action',
          },
          selfEnergyChange: {
            value: 0,
            applied: false,
            status: 'non-damage-action',
          },
        },
      ],
      candidateValueSeries: {
        chart: {
          series: [
            {
              key: 'selfEnergyCandidate',
              unit: 'raw-field',
              points: [
                {
                  actionId: 'action-001',
                  actionName: '普通攻击',
                  actorId: 'actor-001',
                  actorName: '末音',
                  skillId: 10900101,
                  hitSkillId: 10900101,
                  hitIndex: 1,
                  sequenceIndex: 0,
                  sourceTimeMs: 1000,
                  displayFrameIndex: 60,
                  displayTimeMs: 1000,
                  value: 2700,
                  elementConfigIds: [109001081],
                  sourceStatus:
                    'per-hit-candidate-fields-found-formula-unapplied',
                },
              ],
            },
          ],
        },
      },
    });

    expect(layer.generationInput).toMatchObject({
      sourceKind: 'azpr-action-hit-three-value-delta-generation-input',
      status: 'three-value-delta-generation-input-ready',
      summary: {
        trackCount: 3,
        pointCount: 6,
        appliedPointCount: 1,
        candidatePointCount: 1,
        placeholderPointCount: 4,
      },
    });
    expect(layer.inputSources).toEqual([
      'actionResultTimeline.hpDamage',
      'actionResultTimeline.toughnessDamage',
      'actionResultTimeline.selfEnergyChange',
      'candidateValueSeries.chart.series',
      'runtimeSampleContext.events',
      'actionResultTimeline.placeholders',
    ]);
    expect(layer.summary).toMatchObject({
      actionCount: 2,
      actionWithDeltaCount: 2,
      deltaCount: 6,
      appliedDeltaCount: 1,
      candidateDeltaCount: 1,
      placeholderDeltaCount: 4,
      calculatorCount: 3,
    });
    expect(layer.deltas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'action-001',
          hitKey: 'applied-frame-60-point-0',
          trackKey: 'enemyHpDamage',
          layerKey: 'applied',
          delta: 1200,
          hpDelta: 1200,
          sourceKind: 'action-result-applied-value',
          sourceIds: expect.objectContaining({
            skillIds: [10900101],
            elementConfigIds: [109001081],
          }),
          applied: true,
        }),
        expect.objectContaining({
          actionId: 'action-001',
          hitKey: 'hit-1',
          trackKey: 'selfEnergyChange',
          layerKey: 'candidate',
          delta: 2700,
          energyDelta: 2700,
          sourceKind: 'candidate-chart-point',
          applied: false,
        }),
        expect.objectContaining({
          actionId: 'action-002',
          trackKey: 'enemyHpDamage',
          layerKey: 'placeholder',
          delta: 0,
          hpDelta: 0,
          sourceKind: 'action-result-placeholder',
          applied: false,
        }),
      ])
    );
  });

  it('turns state curve points into the standard Action -> Hit -> ThreeValueDelta contract', () => {
    const layer = createThreeValueGenerationLayer({
      scenario: {
        actions: [
          {
            id: 'action-001',
            type: 'skill',
            name: '普通攻击',
            actorId: 'actor-001',
            actor: { name: '末音' },
            startMs: 1000,
          },
        ],
      },
      stateCurves: {
        tracks: [
          {
            trackKey: 'enemyHpDamage',
            label: '敌人HP伤害',
            valueUnit: 'raw-damage',
            layers: [
              {
                key: 'applied',
                label: '已应用',
                sourceKind: 'unit-test-state-curve',
                valueUnit: 'raw-damage',
                applied: true,
                points: [
                  {
                    actionId: 'action-001',
                    actionName: '普通攻击',
                    actorId: 'actor-001',
                    actorName: '末音',
                    skillId: 10900101,
                    hitIndex: 1,
                    hitSkillId: 10900101,
                    frameIndex: 60,
                    frameLabel: '1s0f',
                    timeMs: 1000,
                    delta: 1200,
                    sourceKind: 'unit-test-applied-point',
                    sourceElementConfigId: 109001081,
                    confidence: 'unit-test',
                    resultStatus: 'raw-hp-projection',
                    applied: true,
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    expect(layer.sourceKind).toBe('azpr-standard-three-value-generation-layer');
    expect(layer.contract).toMatchObject({
      name: 'Action -> Hit -> ThreeValueDelta',
      version: 7,
      frameRate: 60,
      deltaFields: ['hpDelta', 'toughnessDelta', 'energyDelta'],
      calculatorContract: {
        name: 'ThreeValueDeltaCalculator',
        version: 3,
        requiredInputs: ['trackKey', 'delta', 'mechanismContext'],
        outputFields: ['hpDelta', 'toughnessDelta', 'energyDelta'],
      },
      mechanismContextContract: {
        name: 'AzPrThreeValueMechanismContext',
        version: 3,
      },
      mechanicsAdapterContract: {
        name: 'AzPrThreeValueMechanicsAdapter',
        version: 4,
        requiredInputs: [
          'action',
          'hit',
          'mechanismConfiguration',
          'mechanicsProfile',
          'mechanicsLayerInputs',
          'sourceValue',
          'stateBefore',
        ],
        runtimeBoundInputs: ['stateBefore'],
        sourceOperandsContract: {
          name: 'AzPrThreeValueMechanicsOperands',
          version: 1,
        },
      },
    });
    expect(layer.summary).toMatchObject({
      actionCount: 1,
      actionWithDeltaCount: 1,
      hitCount: 1,
      deltaCount: 1,
      appliedDeltaCount: 1,
      calculatorCount: 1,
      calculatorKeys: ['azpr-hp-delta-calculator'],
      mechanismContextReadyDeltaCount: 0,
      mechanismContextMissingDeltaCount: 1,
      mechanismConfigurationReadyDeltaCount: 0,
      mechanismConfigurationMissingDeltaCount: 1,
      mechanicsAdapterRequestCount: 1,
      appliedMechanicsAdapterRequestCount: 1,
      mechanicsOperandsReadyDeltaCount: 1,
      appliedMechanicsOperandsReadyDeltaCount: 1,
      mechanicsOperandsKinds: ['source-value-identity'],
    });
    expect(layer.standardContract).toMatchObject({
      sourceKind: 'azpr-action-hit-three-value-delta-standard-contract',
      status: 'action-hit-three-value-delta-contract-ready',
      name: 'Action -> Hit -> ThreeValueDelta',
      topology: ['Action', 'Hit', 'ThreeValueDelta'],
      keyFields: {
        action: ['actionId'],
        hit: ['actionId', 'hitKey', 'frameIndex', 'timeMs'],
        delta: ['id'],
      },
      deltaFields: ['hpDelta', 'toughnessDelta', 'energyDelta'],
      aggregateFields: ['hpDelta', 'toughnessDelta', 'energyDelta'],
      aggregateLayerKeys: ['applied', 'candidate', 'sampled', 'placeholder'],
      runtimeDeltaPolicy: 'runtime consumes only deltas with applied=true',
      summary: {
        actionCount: 1,
        hitCount: 1,
        deltaCount: 1,
        appliedDeltaCount: 1,
      },
    });
    expect(layer.actions).toEqual([
      expect.objectContaining({
        actionId: 'action-001',
        actionName: '普通攻击',
        actorId: 'actor-001',
        actorName: '末音',
        hitCount: 1,
        deltaCount: 1,
        hits: [
          expect.objectContaining({
            hitKey: 'hit-1',
            hitIndex: 1,
            frameIndex: 60,
            timeMs: 1000,
            trackKeys: ['enemyHpDamage'],
            layerKeys: ['applied'],
            deltaCount: 1,
          }),
        ],
      }),
    ]);
    expect(layer.hits).toEqual([
      expect.objectContaining({
        actionId: 'action-001',
        hitKey: 'hit-1',
        hitIndex: 1,
        frameIndex: 60,
        timeMs: 1000,
        trackKeys: ['enemyHpDamage'],
        layerKeys: ['applied'],
        deltaCount: 1,
        threeValueDeltaAggregate: expect.objectContaining({
          sourceKind: 'azpr-action-hit-three-value-delta-aggregate',
          deltaFields: ['hpDelta', 'toughnessDelta', 'energyDelta'],
          deltaCount: 1,
          layerKeys: ['applied'],
          trackKeys: ['enemyHpDamage'],
          layers: {
            applied: {
              layerKey: 'applied',
              runtimeApplied: true,
              deltaCount: 1,
              trackKeys: ['enemyHpDamage'],
              hpDelta: 1200,
              toughnessDelta: 0,
              energyDelta: 0,
            },
          },
        }),
        deltaIds: ['action-001|hit-1|enemyHpDamage|applied|60|0'],
      }),
    ]);
    expect(layer.standardContract.actions).toBe(layer.actions);
    expect(layer.standardContract.hits).toBe(layer.hits);
    expect(layer.standardContract.deltas).toBe(layer.deltas);
    expect(layer.deltas).toEqual([
      expect.objectContaining({
        id: 'action-001|hit-1|enemyHpDamage|applied|60|0',
        actionId: 'action-001',
        hitKey: 'hit-1',
        hitIndex: 1,
        trackKey: 'enemyHpDamage',
        layerKey: 'applied',
        delta: 1200,
        hpDelta: 1200,
        toughnessDelta: null,
        energyDelta: null,
        sourceKind: 'unit-test-applied-point',
        sourceIds: {
          skillIds: [10900101],
          elementConfigIds: [109001081],
          captureSessionIds: [],
          pathIds: [],
        },
        confidence: 'unit-test',
        calculatorKey: 'azpr-hp-delta-calculator',
        calculationKind: 'raw-result-preview',
        calculationStatus: 'raw-hp-projection',
        calculationReplaceable: true,
        mechanismContextStatus: 'mechanism-context-missing-target-enemy',
        mechanismContextReady: false,
        mechanismContext: expect.objectContaining({
          contractName: 'AzPrThreeValueMechanismContext',
          status: 'mechanism-context-missing-target-enemy',
          ready: false,
          formulaStatus: 'context-missing-formula-not-invocable',
          timing: expect.objectContaining({
            accuracy: 'authoritative',
          }),
        }),
        mechanicsAdapterRequest: expect.objectContaining({
          contractName: 'AzPrThreeValueMechanicsAdapter',
          contractVersion: 4,
          trackKey: 'enemyHpDamage',
          outputField: 'hpDelta',
          sourceValue: expect.objectContaining({
            value: 1200,
            hpDelta: 1200,
            toughnessDelta: null,
            energyDelta: null,
            operands: expect.objectContaining({
              contractName: 'AzPrThreeValueMechanicsOperands',
              contractVersion: 1,
              kind: 'source-value-identity',
              operation: 'identity',
              expectedDelta: 1200,
              ready: true,
            }),
          }),
          stateBefore: null,
          bindingStatus: 'generation-inputs-bound-runtime-state-pending',
        }),
        calculator: expect.objectContaining({
          version: 3,
          mechanismContextStatus: 'mechanism-context-missing-target-enemy',
          mechanismContextReady: false,
        }),
        applied: true,
      }),
    ]);
  });

  it('summarizes action and hit deltas by layer without mixing candidates into applied totals', () => {
    const layer = createThreeValueGenerationLayer({
      scenario: {
        actions: [
          {
            id: 'action-001',
            type: 'skill',
            name: '普通攻击',
            actorId: 'actor-001',
            actor: { name: '末音' },
            startMs: 1000,
          },
        ],
      },
      stateCurves: {
        tracks: [
          {
            trackKey: 'enemyHpDamage',
            label: '敌人HP伤害',
            layers: [
              {
                key: 'applied',
                label: '已应用',
                applied: true,
                points: [
                  {
                    actionId: 'action-001',
                    actionName: '普通攻击',
                    hitIndex: 1,
                    frameIndex: 60,
                    timeMs: 1000,
                    delta: 1200,
                    applied: true,
                  },
                ],
              },
              {
                key: 'candidate',
                label: '候选',
                applied: false,
                points: [
                  {
                    actionId: 'action-001',
                    actionName: '普通攻击',
                    hitIndex: 1,
                    frameIndex: 60,
                    timeMs: 1000,
                    delta: 300,
                    applied: false,
                  },
                ],
              },
            ],
          },
          {
            trackKey: 'enemyToughnessDamage',
            label: '敌人韧性伤害',
            layers: [
              {
                key: 'candidate',
                label: '候选',
                applied: false,
                points: [
                  {
                    actionId: 'action-001',
                    actionName: '普通攻击',
                    hitIndex: 1,
                    frameIndex: 60,
                    timeMs: 1000,
                    delta: 90,
                    applied: false,
                  },
                ],
              },
            ],
          },
          {
            trackKey: 'selfEnergyChange',
            label: '自身能量变化',
            layers: [
              {
                key: 'candidate',
                label: '候选',
                applied: false,
                points: [
                  {
                    actionId: 'action-001',
                    actionName: '普通攻击',
                    hitIndex: 1,
                    frameIndex: 60,
                    timeMs: 1000,
                    delta: 27,
                    applied: false,
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    expect(layer.summary).toMatchObject({
      actionCount: 1,
      hitCount: 1,
      deltaCount: 4,
      appliedDeltaCount: 1,
      candidateDeltaCount: 3,
    });
    expect(layer.actions[0].threeValueDeltaAggregate).toMatchObject({
      sourceKind: 'azpr-action-hit-three-value-delta-aggregate',
      deltaCount: 4,
      layerKeys: ['applied', 'candidate'],
      trackKeys: ['enemyHpDamage', 'enemyToughnessDamage', 'selfEnergyChange'],
      layers: {
        applied: {
          runtimeApplied: true,
          deltaCount: 1,
          hpDelta: 1200,
          toughnessDelta: 0,
          energyDelta: 0,
        },
        candidate: {
          runtimeApplied: false,
          deltaCount: 3,
          hpDelta: 300,
          toughnessDelta: 90,
          energyDelta: 27,
        },
      },
    });
    expect(layer.hits).toEqual([
      expect.objectContaining({
        actionId: 'action-001',
        hitKey: 'hit-1',
        deltaCount: 4,
        trackKeys: [
          'enemyHpDamage',
          'enemyToughnessDamage',
          'selfEnergyChange',
        ],
        layerKeys: ['applied', 'candidate'],
        threeValueDeltaAggregate: expect.objectContaining({
          deltaCount: 4,
          layers: {
            applied: expect.objectContaining({
              hpDelta: 1200,
              toughnessDelta: 0,
              energyDelta: 0,
            }),
            candidate: expect.objectContaining({
              hpDelta: 300,
              toughnessDelta: 90,
              energyDelta: 27,
            }),
          },
        }),
      }),
    ]);
    expect(layer.standardContract.actions[0].threeValueDeltaAggregate).toBe(
      layer.actions[0].threeValueDeltaAggregate
    );
    expect(layer.standardContract.hits[0].threeValueDeltaAggregate).toBe(
      layer.hits[0].threeValueDeltaAggregate
    );
  });
});
