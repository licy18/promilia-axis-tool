export const THREE_VALUE_RUNTIME_HIT_TRANSACTION_CONTRACT_NAME =
  'AzPrThreeValueRuntimeHitTransaction';

const RUNTIME_METRIC_BY_TRACK_KEY = {
  enemyHpDamage: 'enemyHp',
  enemyToughnessDamage: 'enemyToughness',
  selfEnergyChange: 'selfEnergy',
};

const RUNTIME_METRIC_KEYS = ['enemyHp', 'enemyToughness', 'selfEnergy'];

export function createThreeValueRuntimeHitTransactions({
  appliedDeltas = [],
  stateSnapshots = null,
} = {}) {
  const snapshots = Array.isArray(stateSnapshots)
    ? stateSnapshots
    : (stateSnapshots?.snapshots ?? []);
  const snapshotByDeltaId = new Map(
    snapshots.map(snapshot => [snapshot.sourceDeltaId, snapshot])
  );
  const groups = new Map();

  for (const delta of appliedDeltas ?? []) {
    const sourceDeltaId = delta?.id ?? delta?.sourceDeltaId ?? null;
    if (!sourceDeltaId) {
      continue;
    }
    const transactionId = createThreeValueRuntimeHitTransactionId(delta);
    if (!groups.has(transactionId)) {
      groups.set(transactionId, {
        transactionId,
        entries: [],
      });
    }
    groups.get(transactionId).entries.push({
      delta,
      sourceDeltaId,
      stateSnapshot: snapshotByDeltaId.get(sourceDeltaId) ?? null,
    });
  }

  const transactions = [...groups.values()]
    .map(group => createRuntimeHitTransaction(group))
    .sort(compareRuntimeHitTransactions);
  const actionIds = uniqueValues(
    transactions.map(transaction => transaction.actionId)
  );
  const actorIds = uniqueValues(
    transactions.map(transaction => transaction.actorId)
  );
  const targetEnemyIds = uniqueValues(
    transactions.map(transaction => transaction.targetEnemyId)
  );

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-three-value-runtime-hit-transactions',
    contractName: THREE_VALUE_RUNTIME_HIT_TRANSACTION_CONTRACT_NAME,
    status:
      transactions.length > 0
        ? 'runtime-hit-transactions-ready'
        : 'runtime-hit-transactions-ready-no-applied-deltas',
    transactions,
    summary: {
      transactionCount: transactions.length,
      multiDeltaTransactionCount: transactions.filter(
        transaction => transaction.deltaCount > 1
      ).length,
      appliedDeltaCount: transactions.reduce(
        (sum, transaction) => sum + transaction.deltaCount,
        0
      ),
      stateSnapshotCount: transactions.reduce(
        (sum, transaction) => sum + transaction.stateSnapshots.length,
        0
      ),
      actionCount: actionIds.length,
      actorCount: actorIds.length,
      targetEnemyCount: targetEnemyIds.length,
      baselineReadyTransactionCount: transactions.filter(
        transaction => transaction.baselineConfirmed
      ).length,
      pendingBaselineTransactionCount: transactions.filter(
        transaction => !transaction.baselineConfirmed
      ).length,
      validationIssueTransactionCount: transactions.filter(
        transaction => !transaction.validation.valid
      ).length,
      enemyHpDelta: sumTransactionMetric(transactions, 'enemyHp'),
      enemyToughnessDelta: sumTransactionMetric(transactions, 'enemyToughness'),
      selfEnergyDelta: sumTransactionMetric(transactions, 'selfEnergy'),
      actionIds,
      actorIds,
      targetEnemyIds,
      applied: true,
    },
    applied: true,
  };
}

export function createThreeValueRuntimeHitTransactionByDeltaId(
  hitTransactions = null
) {
  const transactions = Array.isArray(hitTransactions)
    ? hitTransactions
    : (hitTransactions?.transactions ?? []);
  return new Map(
    transactions.flatMap(transaction =>
      transaction.sourceDeltaIds.map(sourceDeltaId => [
        sourceDeltaId,
        transaction,
      ])
    )
  );
}

export function createThreeValueRuntimeHitTransactionId(delta = {}) {
  return [
    delta.actionId ?? 'system',
    delta.hitKey ?? 'hit-none',
    delta.frameIndex ?? 'frame-none',
    delta.timeMs ?? 'time-none',
  ]
    .map(createRuntimeTransactionIdPart)
    .join('|');
}

function createRuntimeHitTransaction({ transactionId, entries }) {
  const orderedEntries = [...entries].sort(compareRuntimeTransactionEntries);
  const firstEntry = orderedEntries[0];
  const lastEntry = orderedEntries.at(-1);
  const firstDelta = firstEntry.delta;
  const stateSnapshots = orderedEntries
    .map(entry => entry.stateSnapshot)
    .filter(Boolean);
  const before = stateSnapshots[0]?.before ?? null;
  const after = stateSnapshots.at(-1)?.after ?? null;
  const rawDelta = createRuntimeTransactionDelta(orderedEntries);
  const affectedMetricKeys = uniqueValues(
    orderedEntries.map(
      entry => RUNTIME_METRIC_BY_TRACK_KEY[entry.delta.trackKey]
    )
  );
  const changedMetricKeys = affectedMetricKeys.filter(
    metricKey => rawDelta[metricKey] !== 0
  );
  const baselineConfirmedByMetric = Object.fromEntries(
    RUNTIME_METRIC_KEYS.map(metricKey => [
      metricKey,
      before?.[metricKey]?.baselineConfirmed === true &&
        after?.[metricKey]?.baselineConfirmed === true,
    ])
  );
  const baselineConfirmed = affectedMetricKeys.every(
    metricKey => baselineConfirmedByMetric[metricKey]
  );
  const energyOwnerActorIds = uniqueValues(
    stateSnapshots.map(snapshot => snapshot.energyOwnerActorId)
  );
  const targetEnemyIds = uniqueValues(
    stateSnapshots.map(snapshot => snapshot.targetEnemyId)
  );
  const runtimeSequenceIndexes = orderedEntries.map((entry, index) =>
    runtimeSequenceIndex(entry, index)
  );
  const contiguous = runtimeSequenceIndexes.every(
    (sequenceIndex, index) =>
      index === 0 || sequenceIndex === runtimeSequenceIndexes[index - 1] + 1
  );
  const validation = {
    sourceDeltaCountMatches: orderedEntries.length === stateSnapshots.length,
    contiguous,
    singleEnergyOwner: energyOwnerActorIds.length <= 1,
    singleTargetEnemy: targetEnemyIds.length <= 1,
  };
  validation.valid = Object.values(validation).every(Boolean);

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-three-value-runtime-hit-transaction',
    contractName: THREE_VALUE_RUNTIME_HIT_TRANSACTION_CONTRACT_NAME,
    status: !validation.valid
      ? 'runtime-hit-transaction-ready-with-validation-issues'
      : baselineConfirmed
        ? 'runtime-hit-transaction-ready'
        : 'runtime-hit-transaction-pending-baseline',
    transactionId,
    actionId: firstDelta.actionId ?? null,
    actionName: firstDelta.actionName ?? null,
    actionType: firstDelta.actionType ?? null,
    actorId: firstDelta.actorId ?? null,
    actorName: firstDelta.actorName ?? null,
    hitKey: firstDelta.hitKey ?? null,
    hitIndex: firstDelta.hitIndex ?? null,
    frameIndex: strictRuntimeNumberOrNull(firstDelta.frameIndex),
    frameLabel: firstDelta.frameLabel ?? null,
    timeMs: strictRuntimeNumberOrNull(firstDelta.timeMs),
    runtimeSequenceStart: runtimeSequenceIndexes[0] ?? null,
    runtimeSequenceEnd: runtimeSequenceIndexes.at(-1) ?? null,
    deltaCount: orderedEntries.length,
    sourceDeltaIds: orderedEntries.map(entry => entry.sourceDeltaId),
    trackKeys: uniqueValues(orderedEntries.map(entry => entry.delta.trackKey)),
    affectedMetricKeys,
    changedMetricKeys,
    energyOwnerActorId: energyOwnerActorIds[0] ?? null,
    energyOwnerActorIds,
    targetEnemyId: targetEnemyIds[0] ?? null,
    targetEnemyIds,
    before,
    delta: rawDelta,
    stateChange: createRuntimeTransactionStateChange({
      before,
      after,
      rawDelta,
    }),
    after,
    baselineConfirmed,
    baselineConfirmedByMetric,
    stateSnapshots,
    runtimeCalculatorInvocations: stateSnapshots
      .map(snapshot => snapshot.runtimeCalculatorInvocation)
      .filter(Boolean),
    actionThreeValueDeltaAggregate:
      firstDelta.actionThreeValueDeltaAggregate ?? null,
    hitThreeValueDeltaAggregate: firstDelta.hitThreeValueDeltaAggregate ?? null,
    validation,
    applied: true,
  };
}

function createRuntimeTransactionDelta(entries) {
  return {
    enemyHp: sumEntryMetric(entries, 'enemyHp', 'hpDelta'),
    enemyToughness: sumEntryMetric(entries, 'enemyToughness', 'toughnessDelta'),
    selfEnergy: sumEntryMetric(entries, 'selfEnergy', 'energyDelta'),
  };
}

function createRuntimeTransactionStateChange({ before, after, rawDelta }) {
  return {
    enemyHp: resolveRuntimeStateChange(
      before?.enemyHp?.currentValue,
      after?.enemyHp?.currentValue,
      -rawDelta.enemyHp
    ),
    enemyToughness: resolveRuntimeStateChange(
      before?.enemyToughness?.currentValue,
      after?.enemyToughness?.currentValue,
      -rawDelta.enemyToughness
    ),
    selfEnergy: resolveRuntimeStateChange(
      before?.selfEnergy?.currentValue,
      after?.selfEnergy?.currentValue,
      rawDelta.selfEnergy
    ),
  };
}

function resolveRuntimeStateChange(beforeValue, afterValue, fallbackDelta) {
  const beforeNumber = strictRuntimeNumberOrNull(beforeValue);
  const afterNumber = strictRuntimeNumberOrNull(afterValue);
  if (beforeNumber != null && afterNumber != null) {
    return roundRuntimeTransactionValue(afterNumber - beforeNumber);
  }
  return roundRuntimeTransactionValue(fallbackDelta);
}

function sumEntryMetric(entries, metricKey, deltaField) {
  return roundRuntimeTransactionValue(
    entries.reduce((sum, entry) => {
      const snapshotValue = strictRuntimeNumberOrNull(
        entry.stateSnapshot?.delta?.[metricKey]
      );
      const deltaValue = strictRuntimeNumberOrNull(entry.delta?.[deltaField]);
      return sum + (snapshotValue ?? deltaValue ?? 0);
    }, 0)
  );
}

function sumTransactionMetric(transactions, metricKey) {
  return roundRuntimeTransactionValue(
    transactions.reduce(
      (sum, transaction) => sum + transaction.delta[metricKey],
      0
    )
  );
}

function compareRuntimeTransactionEntries(left, right) {
  return runtimeSequenceIndex(left, 0) - runtimeSequenceIndex(right, 0);
}

function compareRuntimeHitTransactions(left, right) {
  return (
    (left.runtimeSequenceStart ?? 0) - (right.runtimeSequenceStart ?? 0) ||
    left.transactionId.localeCompare(right.transactionId)
  );
}

function runtimeSequenceIndex(entry, fallbackIndex) {
  return (
    strictRuntimeNumberOrNull(
      entry.stateSnapshot?.runtimeSequenceIndex ??
        entry.delta?.runtimeSequenceIndex
    ) ?? fallbackIndex
  );
}

function uniqueValues(values) {
  return [
    ...new Set((values ?? []).filter(value => value != null && value !== '')),
  ];
}

function createRuntimeTransactionIdPart(value) {
  return String(value).replace(/\|/g, '/');
}

function strictRuntimeNumberOrNull(value) {
  if (value == null || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundRuntimeTransactionValue(value) {
  return Math.round((Number(value) || 0) * 1000000) / 1000000;
}
