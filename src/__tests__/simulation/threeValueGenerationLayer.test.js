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
      version: 1,
      frameRate: 60,
      deltaFields: ['hpDelta', 'toughnessDelta', 'energyDelta'],
      calculatorContract: {
        name: 'ThreeValueDeltaCalculator',
        outputFields: ['hpDelta', 'toughnessDelta', 'energyDelta'],
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
        applied: true,
      }),
    ]);
  });
});
