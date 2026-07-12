export const CYCLE_SECTION_PROJECTION_CONTRACT_NAME =
  'AzPrCycleSectionProjection';
export const CONTRIBUTION_WINDOW_PROJECTION_CONTRACT_NAME =
  'AzPrContributionWindowProjection';

export function projectCycleSections({
  scenario = null,
  runtimeOutputs = null,
  effectIntervals = null,
  statePointContexts = [],
} = {}) {
  const durationMs = Math.max(0, numberOrZero(scenario?.time?.durationMs));
  const statePointContextByDeltaId = new Map(
    (statePointContexts ?? [])
      .filter(context => context?.row?.sourceDeltaId)
      .map(context => [context.row.sourceDeltaId, context])
  );
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
  const analysisInput = {
    scenario,
    runtimeOutputs,
    effectIntervals,
    statePointContextByDeltaId,
  };
  const fullAxis = analyzeCycleSection({
    range: {
      sectionId: 'full-axis',
      kind: 'axis',
      label: '全轴',
      startMs: 0,
      endMs: durationMs,
      startBoundaryId: null,
      endBoundaryId: null,
    },
    index: -1,
    isLast: true,
    ...analysisInput,
  });
  const sections = createSectionRanges(boundaries, durationMs).map(
    (range, index, ranges) =>
      analyzeCycleSection({
        range,
        index,
        isLast: index === ranges.length - 1,
        ...analysisInput,
      })
  );

  return {
    schemaVersion: 2,
    sourceKind: 'azpr-cycle-section-projection',
    contractName: CYCLE_SECTION_PROJECTION_CONTRACT_NAME,
    contributionWindowContractName:
      CONTRIBUTION_WINDOW_PROJECTION_CONTRACT_NAME,
    status: boundaries.length
      ? 'cycle-section-projection-ready'
      : 'cycle-section-projection-ready-no-boundaries',
    durationMs,
    frameRate: numberOrZero(scenario?.time?.fps) || 60,
    boundaries,
    fullAxis,
    sections,
    windows: boundaries.length ? [fullAxis, ...sections] : [fullAxis],
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
    kind: 'section',
    label: `循环 ${index + 1}`,
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
  statePointContextByDeltaId,
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
  effectEvents.forEach(event => {
    if (actionsById.has(event.actionId)) {
      actionIds.add(event.actionId);
    }
  });

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
        statePointContextByDeltaId,
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
    const actorTransactions = transactions.filter(
      transaction => transaction.actorId === actor.id
    );
    const energyTransactions = transactions.filter(transaction =>
      isEnergyTransactionForActor(transaction, actor.id)
    );
    const actorActionCount = actions.filter(
      action => action.actorId === actor.id
    ).length;
    return {
      actorId: actor.id,
      characterId: actor.characterId ?? null,
      name: actor.name,
      enemyHpDelta: sumTransactions(actorTransactions, 'enemyHp'),
      enemyToughnessDelta: sumTransactions(actorTransactions, 'enemyToughness'),
      selfEnergyDelta: sumTransactions(energyTransactions, 'selfEnergy'),
      transactionCount: new Set(
        [...actorTransactions, ...energyTransactions].map(
          transaction => transaction.transactionId
        )
      ).size,
      actionCount: actorActionCount,
    };
  });
  const effects = groupEffectOverlaps(overlappingEffects);

  return {
    schemaVersion: 2,
    sourceKind:
      range.kind === 'axis'
        ? 'azpr-full-axis-contribution-analysis'
        : 'azpr-cycle-section-analysis',
    sectionId: range.sectionId,
    windowId: range.sectionId,
    kind: range.kind,
    index,
    label: range.label,
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
  statePointContextByDeltaId,
}) {
  const anchorTransaction = transactions.find(transaction =>
    (transaction.sourceDeltaIds ?? []).some(sourceDeltaId =>
      statePointContextByDeltaId.has(sourceDeltaId)
    )
  );
  const statePointId = (anchorTransaction?.sourceDeltaIds ?? [])
    .map(sourceDeltaId => statePointContextByDeltaId.get(sourceDeltaId))
    .find(Boolean)?.statePointId;
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
    statePointId: statePointId ?? '',
    frameIndex: anchorTransaction?.frameIndex ?? null,
    timeMs: anchorTransaction?.timeMs ?? null,
  };
}

function isEnergyTransactionForActor(transaction, actorId) {
  return (
    transaction.energyOwnerActorId === actorId ||
    (!transaction.energyOwnerActorId && transaction.actorId === actorId)
  );
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
