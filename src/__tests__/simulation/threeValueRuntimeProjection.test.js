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
      appliedOnly: true,
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
        enemyHpDelta: 1200,
        enemyToughnessDelta: 0,
        selfEnergyDelta: -30,
        enemyStatePointCount: 1,
        selfEnergyPointCount: 1,
        simLogCount: 2,
        calculatorCount: 2,
        calculatorKeys: [
          'azpr-hp-delta-calculator',
          'azpr-self-energy-delta-calculator',
        ],
        source: 'threeValueGenerationLayer.applied-deltas',
        appliedOnly: true,
        applied: true,
      },
      applied: true,
    });
    expect(runtimeProjection.simLog).toHaveLength(2);
    expect(runtimeProjection.simLog.map(row => row.sourceDeltaId)).toEqual([
      'action-001|hit-1|enemyHpDamage|applied|60|0',
      'action-002|event-RESOURCE_CHANGE-0|selfEnergyChange|applied|90|0',
    ]);
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
});
