export function createRuntimeHitReviewRows({
  hitTransactions = null,
  statePointContexts = [],
} = {}) {
  const contextByDeltaId = new Map(
    (statePointContexts ?? [])
      .filter(context => context.row?.sourceDeltaId)
      .map(context => [context.row.sourceDeltaId, context])
  );

  return (hitTransactions?.transactions ?? [])
    .map(transaction =>
      createRuntimeHitReviewRow(transaction, contextByDeltaId)
    )
    .filter(Boolean)
    .sort(compareRuntimeHitReviewRows);
}

function createRuntimeHitReviewRow(transaction, contextByDeltaId) {
  const contexts = (transaction?.sourceDeltaIds ?? [])
    .map(sourceDeltaId => contextByDeltaId.get(sourceDeltaId))
    .filter(Boolean);
  const anchorContext = contexts[0] ?? null;
  if (!anchorContext?.statePointId) {
    return null;
  }

  const anchorRow = anchorContext.row ?? {};
  const anchorPoint = anchorContext.point ?? null;
  return {
    eventType: 'THREE_VALUE_HIT_TRANSACTION_APPLIED',
    reviewUnit: 'hit-transaction',
    transactionId: transaction.transactionId,
    sourceDeltaId:
      anchorRow.sourceDeltaId ?? transaction.sourceDeltaIds?.[0] ?? '',
    sourceDeltaIds: transaction.sourceDeltaIds ?? [],
    statePointId: anchorContext.statePointId,
    statePointIds: contexts.map(context => context.statePointId),
    sequenceIndex:
      transaction.runtimeSequenceStart ?? anchorRow.sequenceIndex ?? 0,
    runtimeSequenceIndex:
      transaction.runtimeSequenceStart ??
      anchorRow.runtimeSequenceIndex ??
      anchorRow.sequenceIndex ??
      0,
    actionId: transaction.actionId ?? anchorRow.actionId ?? '',
    actionName: transaction.actionName ?? anchorRow.actionName ?? '',
    actionType: transaction.actionType ?? anchorRow.actionType ?? '',
    actorId: transaction.actorId ?? anchorRow.actorId ?? '',
    actorName: transaction.actorName ?? anchorRow.actorName ?? '',
    energyOwnerActorId: transaction.energyOwnerActorId ?? '',
    targetEnemyId: transaction.targetEnemyId ?? '',
    hitKey: transaction.hitKey ?? anchorRow.hitKey ?? '',
    hitIndex: transaction.hitIndex ?? anchorRow.hitIndex ?? null,
    frameIndex: transaction.frameIndex ?? anchorRow.frameIndex ?? null,
    frameLabel: transaction.frameLabel ?? anchorRow.frameLabel ?? '',
    timeMs: transaction.timeMs ?? anchorRow.timeMs ?? null,
    trackKey: 'hitTransaction',
    trackKeys: transaction.trackKeys ?? [],
    trackLabel: '命中',
    layerKey: 'applied',
    deltaCount: transaction.deltaCount ?? contexts.length,
    delta: transaction.delta ?? {},
    stateChange: transaction.stateChange ?? {},
    hpDelta: transaction.delta?.enemyHp ?? 0,
    toughnessDelta: transaction.delta?.enemyToughness ?? 0,
    energyDelta: transaction.delta?.selfEnergy ?? 0,
    status: transaction.status ?? 'runtime-hit-transaction-ready',
    resultStatus: transaction.status ?? 'runtime-hit-transaction-ready',
    hitTransaction: transaction,
    stateSnapshot: anchorRow.stateSnapshot ?? transaction.before ?? null,
    actionThreeValueDeltaAggregate:
      transaction.actionThreeValueDeltaAggregate ??
      anchorRow.actionThreeValueDeltaAggregate ??
      null,
    hitThreeValueDeltaAggregate:
      transaction.hitThreeValueDeltaAggregate ??
      anchorRow.hitThreeValueDeltaAggregate ??
      null,
    anchorRow,
    anchorPoint,
    applied: true,
  };
}

function compareRuntimeHitReviewRows(left, right) {
  return (
    numberOrZero(left.runtimeSequenceIndex) -
      numberOrZero(right.runtimeSequenceIndex) ||
    String(left.transactionId ?? '').localeCompare(
      String(right.transactionId ?? '')
    )
  );
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
