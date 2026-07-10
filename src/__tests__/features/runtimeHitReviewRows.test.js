import { describe, expect, it } from 'vitest';
import { createRuntimeHitReviewRows } from '../../features/workbench/runtimeHitReviewRows';

describe('runtime hit review rows', () => {
  it('maps one hit transaction to one selectable row with every delta state point', () => {
    const transaction = createHitTransaction();
    const contexts = transaction.sourceDeltaIds.map((sourceDeltaId, index) =>
      createStatePointContext({ sourceDeltaId, index })
    );

    const rows = createRuntimeHitReviewRows({
      hitTransactions: {
        transactions: [transaction],
      },
      statePointContexts: contexts,
    });

    expect(rows).toEqual([
      expect.objectContaining({
        eventType: 'THREE_VALUE_HIT_TRANSACTION_APPLIED',
        reviewUnit: 'hit-transaction',
        transactionId: 'action-001|hit-1|60|1000',
        sourceDeltaId: 'delta-hp',
        sourceDeltaIds: ['delta-hp', 'delta-toughness', 'delta-energy'],
        statePointId: 'state-hp',
        statePointIds: ['state-hp', 'state-toughness', 'state-energy'],
        actionId: 'action-001',
        actorId: 'actor-001',
        hitKey: 'hit-1',
        trackKey: 'hitTransaction',
        trackKeys: [
          'enemyHpDamage',
          'enemyToughnessDamage',
          'selfEnergyChange',
        ],
        deltaCount: 3,
        hpDelta: 100,
        toughnessDelta: 20,
        energyDelta: 15,
        hitTransaction: transaction,
      }),
    ]);
    expect(rows[0].anchorRow).toBe(contexts[0].row);
    expect(rows[0].anchorPoint).toBe(contexts[0].point);
  });
});

function createHitTransaction() {
  return {
    transactionId: 'action-001|hit-1|60|1000',
    actionId: 'action-001',
    actionName: '普通攻击',
    actionType: 'skill',
    actorId: 'actor-001',
    actorName: '末音',
    energyOwnerActorId: 'actor-001',
    targetEnemyId: 'enemy-001',
    hitKey: 'hit-1',
    hitIndex: 1,
    frameIndex: 60,
    frameLabel: '1s0f',
    timeMs: 1000,
    runtimeSequenceStart: 0,
    runtimeSequenceEnd: 2,
    deltaCount: 3,
    sourceDeltaIds: ['delta-hp', 'delta-toughness', 'delta-energy'],
    trackKeys: ['enemyHpDamage', 'enemyToughnessDamage', 'selfEnergyChange'],
    delta: {
      enemyHp: 100,
      enemyToughness: 20,
      selfEnergy: 15,
    },
    stateChange: {
      enemyHp: -100,
      enemyToughness: -20,
      selfEnergy: 15,
    },
    status: 'runtime-hit-transaction-ready',
  };
}

function createStatePointContext({ sourceDeltaId, index }) {
  const trackKeys = [
    'enemyHpDamage',
    'enemyToughnessDamage',
    'selfEnergyChange',
  ];
  const metricKeys = ['hp', 'toughness', 'energy'];
  const row = {
    sourceDeltaId,
    sequenceIndex: index,
    runtimeSequenceIndex: index,
    actionId: 'action-001',
    actorId: 'actor-001',
    trackKey: trackKeys[index],
  };
  const point = {
    ...row,
  };
  return {
    statePointId: `state-${metricKeys[index]}`,
    row,
    point,
  };
}
