import { describe, expect, it } from 'vitest';
import {
  createThreeValueRuntimeHitTransactionByDeltaId,
  createThreeValueRuntimeHitTransactions,
} from '../../simulation/runtime/threeValueRuntimeHitTransactions';
import { createThreeValueRuntimeOutputConsumerView } from '../../simulation/runtime/threeValueRuntimeOutputConsumer';
import { createThreeValueRuntimeProjection } from '../../simulation/runtime/threeValueRuntimeProjection';

describe('three value runtime hit transactions', () => {
  it('groups one Action / Hit into a shared three-value state transaction', () => {
    const runtimeProjection = createThreeValueRuntimeProjection({
      scenario: createScenario(),
      threeValueGenerationLayer: {
        contract: {
          name: 'Action -> Hit -> ThreeValueDelta',
        },
        deltas: [
          createAppliedDelta({
            id: 'action-001|hit-1|enemyHpDamage|applied|60|0',
            trackKey: 'enemyHpDamage',
            value: 100,
          }),
          createAppliedDelta({
            id: 'action-001|hit-1|enemyToughnessDamage|applied|60|1',
            trackKey: 'enemyToughnessDamage',
            value: 10,
          }),
          createAppliedDelta({
            id: 'action-001|hit-1|selfEnergyChange|applied|60|2',
            trackKey: 'selfEnergyChange',
            value: 15,
          }),
          createAppliedDelta({
            id: 'action-002|hit-2|enemyHpDamage|applied|120|0',
            actionId: 'action-002',
            actionName: '重击',
            hitKey: 'hit-2',
            hitIndex: 2,
            frameIndex: 120,
            timeMs: 2000,
            trackKey: 'enemyHpDamage',
            value: 200,
          }),
        ],
      },
    });

    expect(runtimeProjection.hitTransactions).toMatchObject({
      sourceKind: 'azpr-three-value-runtime-hit-transactions',
      contractName: 'AzPrThreeValueRuntimeHitTransaction',
      status: 'runtime-hit-transactions-ready',
      summary: {
        transactionCount: 2,
        multiDeltaTransactionCount: 1,
        appliedDeltaCount: 4,
        stateSnapshotCount: 4,
        baselineReadyTransactionCount: 2,
        pendingBaselineTransactionCount: 0,
        validationIssueTransactionCount: 0,
        enemyHpDelta: 300,
        enemyToughnessDelta: 10,
        selfEnergyDelta: 15,
      },
    });

    const firstTransaction = runtimeProjection.hitTransactions.transactions[0];
    expect(firstTransaction).toMatchObject({
      transactionId: 'action-001|hit-1|60|1000',
      actionId: 'action-001',
      actorId: 'actor-001',
      hitKey: 'hit-1',
      runtimeSequenceStart: 0,
      runtimeSequenceEnd: 2,
      deltaCount: 3,
      trackKeys: ['enemyHpDamage', 'enemyToughnessDamage', 'selfEnergyChange'],
      affectedMetricKeys: ['enemyHp', 'enemyToughness', 'selfEnergy'],
      changedMetricKeys: ['enemyHp', 'enemyToughness', 'selfEnergy'],
      energyOwnerActorId: 'actor-001',
      targetEnemyId: 'enemy-001',
      delta: {
        enemyHp: 100,
        enemyToughness: 10,
        selfEnergy: 15,
      },
      stateChange: {
        enemyHp: -100,
        enemyToughness: -10,
        selfEnergy: 15,
      },
      baselineConfirmed: true,
      validation: {
        sourceDeltaCountMatches: true,
        contiguous: true,
        singleEnergyOwner: true,
        singleTargetEnemy: true,
        valid: true,
      },
    });
    expect(firstTransaction.before).toMatchObject({
      enemyHp: { currentValue: 1000 },
      enemyToughness: { currentValue: 100 },
      selfEnergy: { actorId: 'actor-001', currentValue: 20 },
    });
    expect(firstTransaction.after).toMatchObject({
      enemyHp: { currentValue: 900 },
      enemyToughness: { currentValue: 90 },
      selfEnergy: { actorId: 'actor-001', currentValue: 35 },
    });

    expect(runtimeProjection.runtimeOutputs.hitTransactions).toBe(
      runtimeProjection.hitTransactions
    );
    expect(runtimeProjection.runtimeOutputs.outputs.hitTransactions).toBe(
      runtimeProjection.hitTransactions
    );
    expect(
      runtimeProjection.outputContract.outputs.hitTransactions
    ).toMatchObject({
      contractName: 'AzPrThreeValueRuntimeHitTransaction',
      transactionCount: 2,
      collectionField: 'transactions',
    });
    const runtimeConsumerView =
      createThreeValueRuntimeOutputConsumerView(runtimeProjection);
    expect(runtimeConsumerView.hitTransactions).toBe(
      runtimeProjection.hitTransactions
    );
    expect(runtimeConsumerView.summary.hitTransactionCount).toBe(2);

    const transactionByDeltaId = createThreeValueRuntimeHitTransactionByDeltaId(
      runtimeProjection.hitTransactions
    );
    for (const sourceDeltaId of firstTransaction.sourceDeltaIds) {
      const simLogRow = runtimeProjection.simLog.find(
        row => row.sourceDeltaId === sourceDeltaId
      );
      const curvePoint = [
        ...runtimeProjection.enemyStateCurve.points,
        ...runtimeProjection.selfEnergyCurveByActor.flatMap(
          actor => actor.points
        ),
      ].find(point => point.sourceDeltaId === sourceDeltaId);
      expect(transactionByDeltaId.get(sourceDeltaId)).toBe(firstTransaction);
      expect(simLogRow?.hitTransaction).toBe(firstTransaction);
      expect(curvePoint?.hitTransaction).toBe(firstTransaction);
    }
    expect(
      runtimeProjection.runtimeOutputs.outputConsistency.checks
    ).toMatchObject({
      summaryHitTransactionCount: true,
      outputContractSummaryHitTransactionCount: true,
      hitTransactionSourceDeltasComplete: true,
      simLogHitTransactionsShared: true,
      stateCurveHitTransactionsShared: true,
      hitTransactionStateSnapshotsShared: true,
      hitTransactionDeltaTotalsMatch: true,
    });
    expect(() =>
      JSON.stringify(runtimeProjection.runtimeOutputs)
    ).not.toThrow();
  });

  it('reports non-contiguous hit deltas instead of silently presenting an invalid span', () => {
    const stateSnapshots = [
      createStateSnapshot({ sourceDeltaId: 'a-hp', runtimeSequenceIndex: 0 }),
      createStateSnapshot({ sourceDeltaId: 'b-hp', runtimeSequenceIndex: 1 }),
      createStateSnapshot({
        sourceDeltaId: 'a-energy',
        runtimeSequenceIndex: 2,
        trackKey: 'selfEnergyChange',
        primaryMetricKey: 'selfEnergy',
      }),
    ];
    const hitTransactions = createThreeValueRuntimeHitTransactions({
      appliedDeltas: [
        createAppliedDelta({ id: 'a-hp' }),
        createAppliedDelta({
          id: 'b-hp',
          actionId: 'action-002',
          hitKey: 'hit-2',
        }),
        createAppliedDelta({
          id: 'a-energy',
          trackKey: 'selfEnergyChange',
          value: 5,
        }),
      ].map((delta, runtimeSequenceIndex) => ({
        ...delta,
        runtimeSequenceIndex,
      })),
      stateSnapshots,
    });

    expect(hitTransactions.transactions[0]).toMatchObject({
      transactionId: 'action-001|hit-1|60|1000',
      status: 'runtime-hit-transaction-ready-with-validation-issues',
      deltaCount: 2,
      validation: {
        contiguous: false,
        valid: false,
      },
    });
    expect(hitTransactions.summary.validationIssueTransactionCount).toBe(1);
  });
});

function createScenario() {
  return {
    enemy: {
      id: 'enemy-001',
      stats: {
        maxHp: 1000,
        initialToughness: 100,
        maxToughness: 100,
      },
      hpMultiplier: 1,
    },
    actors: [
      {
        id: 'actor-001',
        name: '末音',
        initialSp: 20,
        stats: {
          maxSp: 100,
        },
      },
    ],
  };
}

function createAppliedDelta({
  id,
  actionId = 'action-001',
  actionName = '普通攻击',
  hitKey = 'hit-1',
  hitIndex = 1,
  frameIndex = 60,
  timeMs = 1000,
  trackKey = 'enemyHpDamage',
  value = 100,
} = {}) {
  const valueFields = {
    enemyHpDamage: 'hpDelta',
    enemyToughnessDamage: 'toughnessDelta',
    selfEnergyChange: 'energyDelta',
  };
  const deltaField = valueFields[trackKey];
  return {
    id,
    actionId,
    actionName,
    actionType: 'skill',
    actorId: 'actor-001',
    actorName: '末音',
    hitKey,
    hitIndex,
    frameIndex,
    frameLabel: `${frameIndex}f`,
    timeMs,
    trackKey,
    layerKey: 'applied',
    valueUnit: trackKey === 'selfEnergyChange' ? 'sp' : 'raw',
    delta: value,
    hpDelta: null,
    toughnessDelta: null,
    energyDelta: null,
    [deltaField]: value,
    applied: true,
  };
}

function createStateSnapshot({
  sourceDeltaId,
  runtimeSequenceIndex,
  trackKey = 'enemyHpDamage',
  primaryMetricKey = 'enemyHp',
}) {
  return {
    sourceDeltaId,
    runtimeSequenceIndex,
    trackKey,
    primaryMetricKey,
    energyOwnerActorId: 'actor-001',
    targetEnemyId: 'enemy-001',
    before: createStateValues(),
    delta: {
      enemyHp: primaryMetricKey === 'enemyHp' ? 100 : 0,
      enemyToughness: 0,
      selfEnergy: primaryMetricKey === 'selfEnergy' ? 5 : 0,
    },
    after: createStateValues(),
    runtimeCalculatorInvocation: {},
  };
}

function createStateValues() {
  return {
    enemyHp: createStateValue(1000),
    enemyToughness: createStateValue(100),
    selfEnergy: createStateValue(20, 'actor-001'),
  };
}

function createStateValue(currentValue, actorId = null) {
  return {
    actorId,
    currentValue,
    baselineConfirmed: true,
  };
}
