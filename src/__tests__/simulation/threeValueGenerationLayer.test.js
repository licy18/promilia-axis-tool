import { describe, expect, it } from 'vitest';
import { createThreeValueGenerationLayer } from '../../simulation/generation/threeValueGenerationLayer';

describe('three value generation layer', () => {
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
