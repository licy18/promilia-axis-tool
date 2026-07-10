export const CYCLE_SECTION_PROJECTION_CONTRACT_NAME =
  'AzPrCycleSectionProjection';

export function projectCycleSections({
  scenario = null,
  runtimeOutputs = null,
  effectIntervals = null,
} = {}) {
  const durationMs = Math.max(0, numberOrZero(scenario?.time?.durationMs));
  const boundaries = [...(scenario?.cycleBoundaries ?? [])]
    .filter(
      boundary =>
        Number(boundary?.timeMs) > 0 && Number(boundary?.timeMs) < durationMs
    )
    .sort(
      (left, right) =>
        Number(left.timeMs) - Number(right.timeMs) ||
        String(left.id).localeCompare(String(right.id))
    );
  const sections = createSectionRanges(boundaries, durationMs).map(
    (range, index, ranges) =>
      analyzeCycleSection({
        range,
        index,
        isLast: index === ranges.length - 1,
        scenario,
        runtimeOutputs,
        effectIntervals,
      })
  );

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-cycle-section-projection',
    contractName: CYCLE_SECTION_PROJECTION_CONTRACT_NAME,
    status: boundaries.length
      ? 'cycle-section-projection-ready'
      : 'cycle-section-projection-ready-no-boundaries',
    durationMs,
    frameRate: numberOrZero(scenario?.time?.fps) || 60,
    boundaries,
    sections,
    summary: {
      boundaryCount: boundaries.length,
      sectionCount: sections.length,
      actionCount: new Set(
        sections.flatMap(section =>
          section.actions.map(action => action.actionId)
        )
      ).size,
      hitTransactionCount: sections.reduce(
        (sum, section) => sum + section.summary.hitTransactionCount,
        0
      ),
      enemyHpDelta: roundValue(
        sections.reduce((sum, section) => sum + section.metrics.enemyHpDelta, 0)
      ),
      enemyToughnessDelta: roundValue(
        sections.reduce(
          (sum, section) => sum + section.metrics.enemyToughnessDelta,
          0
        )
      ),
      selfEnergyDelta: roundValue(
        sections.reduce(
          (sum, section) => sum + section.metrics.selfEnergyDelta,
          0
        )
      ),
      effectCoverageMs: roundValue(
        sections.reduce(
          (sum, section) => sum + section.metrics.effectCoverageMs,
          0
        )
      ),
      readsRuntimeOutputsOnly: true,
      appliedToCalculators: false,
    },
    appliedToCalculators: false,
  };
}

function createSectionRanges(boundaries, durationMs) {
  const points = [
    { timeMs: 0, boundaryId: null },
    ...boundaries.map(boundary => ({
      timeMs: Number(boundary.timeMs),
      boundaryId: boundary.id,
    })),
    { timeMs: durationMs, boundaryId: null },
  ];
  return points.slice(0, -1).map((point, index) => ({
    sectionId: `cycle-section-${String(index + 1).padStart(2, '0')}`,
    startMs: point.timeMs,
    endMs: points[index + 1].timeMs,
    startBoundaryId: point.boundaryId,
    endBoundaryId: points[index + 1].boundaryId,
  }));
}

function analyzeCycleSection({
  range,
  index,
  isLast,
  scenario,
  runtimeOutputs,
  effectIntervals,
}) {
  const actionsById = new Map(
    (scenario?.actions ?? []).map(action => [action.id, action])
  );
  const transactions = (
    runtimeOutputs?.hitTransactions?.transactions ?? []
  ).filter(transaction =>
    isTimeInsideSection(transaction.timeMs, range, isLast)
  );
  const effectEvents = (runtimeOutputs?.effectTimeline?.events ?? []).filter(
    event => isTimeInsideSection(event.timeMs, range, isLast)
  );
  const overlappingEffects = (effectIntervals?.intervals ?? [])
    .map(interval => createEffectOverlap(interval, range))
    .filter(Boolean);
  const actionIds = new Set(
    (scenario?.actions ?? [])
      .filter(action => isTimeInsideSection(action.startMs, range, isLast))
      .map(action => action.id)
  );
  transactions.forEach(transaction => actionIds.add(transaction.actionId));
  effectEvents.forEach(event => actionIds.add(event.actionId));

  const actionOrder = new Map(
    (scenario?.actions ?? []).map((action, actionIndex) => [
      action.id,
      actionIndex,
    ])
  );
  const actions = [...actionIds]
    .filter(Boolean)
    .map(actionId =>
      createSectionActionAnalysis({
        action: actionsById.get(actionId),
        actionId,
        transactions: transactions.filter(
          transaction => transaction.actionId === actionId
        ),
        effectEvents: effectEvents.filter(event => event.actionId === actionId),
      })
    )
    .sort(
      (left, right) =>
        left.startMs - right.startMs ||
        (actionOrder.get(left.actionId) ?? Number.MAX_SAFE_INTEGER) -
          (actionOrder.get(right.actionId) ?? Number.MAX_SAFE_INTEGER) ||
        left.actionId.localeCompare(right.actionId)
    );
  const actors = (scenario?.actors ?? []).map(actor => {
    const energyDelta = roundValue(
      transactions.reduce(
        (sum, transaction) =>
          transaction.energyOwnerActorId === actor.id ||
          (!transaction.energyOwnerActorId && transaction.actorId === actor.id)
            ? sum + numberOrZero(transaction.delta?.selfEnergy)
            : sum,
        0
      )
    );
    return {
      actorId: actor.id,
      characterId: actor.characterId ?? null,
      name: actor.name,
      selfEnergyDelta: energyDelta,
      transactionCount: transactions.filter(
        transaction =>
          transaction.energyOwnerActorId === actor.id ||
          (!transaction.energyOwnerActorId && transaction.actorId === actor.id)
      ).length,
    };
  });
  const effects = groupEffectOverlaps(overlappingEffects);

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-cycle-section-analysis',
    sectionId: range.sectionId,
    index,
    label: `循环 ${index + 1}`,
    startMs: range.startMs,
    endMs: range.endMs,
    durationMs: roundValue(range.endMs - range.startMs),
    startBoundaryId: range.startBoundaryId,
    endBoundaryId: range.endBoundaryId,
    metrics: {
      enemyHpDelta: sumTransactions(transactions, 'enemyHp'),
      enemyToughnessDelta: sumTransactions(transactions, 'enemyToughness'),
      selfEnergyDelta: sumTransactions(transactions, 'selfEnergy'),
      effectCoverageMs: roundValue(
        overlappingEffects.reduce(
          (sum, effect) => sum + effect.overlapDurationMs,
          0
        )
      ),
    },
    actors,
    actions,
    effects,
    summary: {
      actionCount: actions.length,
      actorCount: actors.length,
      activeActorCount: actors.filter(actor => actor.selfEnergyDelta !== 0)
        .length,
      hitTransactionCount: transactions.length,
      effectEventCount: effectEvents.length,
      effectCount: effects.length,
      effectIntervalOverlapCount: overlappingEffects.length,
    },
    appliedToCalculators: false,
  };
}

function createSectionActionAnalysis({
  action,
  actionId,
  transactions,
  effectEvents,
}) {
  return {
    actionId,
    name: action?.name ?? actionId,
    actorId: action?.actorId ?? action?.actor?.id ?? null,
    actorName: action?.actor?.name ?? null,
    startMs: numberOrZero(action?.startMs),
    durationMs: numberOrZero(action?.durationMs),
    enemyHpDelta: sumTransactions(transactions, 'enemyHp'),
    enemyToughnessDelta: sumTransactions(transactions, 'enemyToughness'),
    selfEnergyDelta: sumTransactions(transactions, 'selfEnergy'),
    hitCount: transactions.length,
    effectEventCount: effectEvents.length,
  };
}

function createEffectOverlap(interval, range) {
  const startMs = Math.max(numberOrZero(interval?.startMs), range.startMs);
  const endMs = Math.min(numberOrZero(interval?.endMs), range.endMs);
  if (endMs <= startMs) {
    return null;
  }
  return {
    effectId: interval.effectId ?? null,
    effectName: interval.effectName ?? interval.effectId ?? '效果',
    targetKind: interval.targetKind ?? null,
    targetId: interval.targetId ?? null,
    targetName: interval.targetName ?? interval.targetId ?? '',
    intervalId: interval.intervalId ?? null,
    overlapStartMs: startMs,
    overlapEndMs: endMs,
    overlapDurationMs: roundValue(endMs - startMs),
  };
}

function groupEffectOverlaps(overlaps) {
  const groups = new Map();
  for (const overlap of overlaps) {
    const key = [
      overlap.targetKind ?? 'target',
      overlap.targetId ?? 'unknown',
      overlap.effectId ?? overlap.effectName,
    ].join('|');
    const current = groups.get(key) ?? {
      key,
      effectId: overlap.effectId,
      name: overlap.effectName,
      targetKind: overlap.targetKind,
      targetId: overlap.targetId,
      targetName: overlap.targetName,
      coverageMs: 0,
      intervalCount: 0,
      intervalIds: [],
    };
    current.coverageMs += overlap.overlapDurationMs;
    current.intervalCount += 1;
    if (overlap.intervalId) {
      current.intervalIds.push(overlap.intervalId);
    }
    groups.set(key, current);
  }
  return [...groups.values()].map(group => ({
    ...group,
    coverageMs: roundValue(group.coverageMs),
  }));
}

function isTimeInsideSection(timeMs, range, isLast) {
  const time = Number(timeMs);
  return (
    Number.isFinite(time) &&
    time >= range.startMs &&
    (time < range.endMs || (isLast && time <= range.endMs))
  );
}

function sumTransactions(transactions, metricKey) {
  return roundValue(
    transactions.reduce(
      (sum, transaction) => sum + numberOrZero(transaction.delta?.[metricKey]),
      0
    )
  );
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function roundValue(value) {
  return Math.round((numberOrZero(value) + Number.EPSILON) * 1000) / 1000;
}
