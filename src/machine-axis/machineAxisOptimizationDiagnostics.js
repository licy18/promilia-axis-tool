import generatedElements from '../data/generated/elements.json';
import { getInstalledVerifiedCombatMechanicsPackage } from '../data/verifiedCombatMechanicsPackage';
import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization';

export const MACHINE_AXIS_OPTIMIZATION_DIAGNOSTICS_SCHEMA_VERSION = 1;
export const MACHINE_AXIS_OPTIMIZATION_DIAGNOSTICS_KIND =
  'azpr-machine-axis-optimization-diagnostics';

const VALUE_TOLERANCE = 1e-8;
const ELEMENT_BY_ID = new Map(
  (generatedElements.items ?? generatedElements).map(element => [
    Number(element.id),
    {
      elementId: Number(element.id),
      elementName: element.name ?? null,
      elementAbbrName: element.abbrName ?? null,
    },
  ])
);

export function createMachineAxisOptimizationDiagnostics(
  run,
  contract = {},
  options = {}
) {
  const trace = run?.trace ?? {};
  const scope = normalizeDiagnosticScope(trace, options);
  const damage = createDamageDiagnostics(trace, scope);
  const energy = createEnergyDiagnostics(trace, contract, scope);
  const tuningMarks = createTuningMarkDiagnostics(
    trace,
    contract,
    scope,
    damage
  );
  const projection = {
    schemaVersion: MACHINE_AXIS_OPTIMIZATION_DIAGNOSTICS_SCHEMA_VERSION,
    kind: MACHINE_AXIS_OPTIMIZATION_DIAGNOSTICS_KIND,
    scope,
    damage,
    energy,
    tuningMarks,
    recommendations: createOptimizationRecommendations({
      damage,
      energy,
      tuningMarks,
    }),
  };
  return {
    ...projection,
    diagnosticsHash: hashCanonicalValue(projection),
  };
}

export function aggregateMachineAxisOptimizationDiagnostics(samples = []) {
  const diagnostics = samples.filter(Boolean);
  if (diagnostics.length === 0) return null;
  if (diagnostics.length === 1) return diagnostics[0];
  const projection = {
    schemaVersion: MACHINE_AXIS_OPTIMIZATION_DIAGNOSTICS_SCHEMA_VERSION,
    kind: 'azpr-machine-axis-optimization-diagnostics-aggregate',
    sampleCount: diagnostics.length,
    scope: diagnostics[0].scope,
    damage: {
      totalRawDamage: mean(diagnostics.map(row => row.damage.totalRawDamage)),
      totalEffectiveHpDamage: mean(
        diagnostics.map(row => row.damage.totalEffectiveHpDamage)
      ),
      totalToughnessDamage: mean(
        diagnostics.map(row => row.damage.totalToughnessDamage)
      ),
      hitCount: mean(diagnostics.map(row => row.damage.hitCount)),
      byActor: averageRows(diagnostics.map(row => row.damage.byActor)),
      byAction: averageRows(diagnostics.map(row => row.damage.byAction)),
      bySourceKind: averageRows(
        diagnostics.map(row => row.damage.bySourceKind)
      ),
      byElement: averageRows(diagnostics.map(row => row.damage.byElement)),
      tuning: averageNumericRecord(diagnostics.map(row => row.damage.tuning)),
    },
    energy: {
      overall: averageNumericRecord(diagnostics.map(row => row.energy.overall)),
      actors: averageRows(diagnostics.map(row => row.energy.actors)),
      kibos: averageRows(diagnostics.map(row => row.energy.kibos)),
      insufficientActions: uniqueSorted(
        diagnostics.flatMap(row => row.energy.insufficientActions ?? [])
      ),
    },
    tuningMarks: {
      overall: averageNumericRecord(
        diagnostics.map(row => row.tuningMarks.overall)
      ),
      profiles: averageRows(diagnostics.map(row => row.tuningMarks.profiles)),
    },
    sampleDiagnosticsHashes: diagnostics.map(row => row.diagnosticsHash),
  };
  projection.recommendations = createOptimizationRecommendations(projection);
  return {
    ...projection,
    diagnosticsHash: hashCanonicalValue(projection),
  };
}

function createDamageDiagnostics(trace, scope) {
  const actionById = new Map(
    (trace.actions ?? []).map(action => [String(action.id), action])
  );
  const events = (trace.damage ?? []).filter(
    event =>
      event?.stateEventKind == null &&
      isEventInScope(event, scope) &&
      (damageAmount(event) > 0 || Number(event.toughnessDamage) > 0)
  );
  const totalRawDamage = sum(events.map(event => number(event.rawDamage)));
  const totalEffectiveHpDamage = sum(events.map(damageAmount));
  const totalToughnessDamage = sum(
    events.map(event => number(event.toughnessDamage))
  );
  const byActor = createDamageRows({
    events,
    totalEffectiveHpDamage,
    identity: event => String(event.actorId ?? 'unattributed'),
    metadata: event => ({ actorId: event.actorId ?? null }),
  });
  const byAction = createDamageRows({
    events,
    totalEffectiveHpDamage,
    identity: event => String(event.actionId ?? 'unattributed'),
    metadata: event => {
      const action = actionById.get(String(event.actionId));
      return {
        actionId: event.actionId ?? null,
        actorId: event.actorId ?? action?.actorId ?? null,
        actionName: action?.name ?? null,
        actionKind: action?.actionKind ?? null,
        actionType: action?.type ?? null,
      };
    },
  });
  const bySourceKind = createDamageRows({
    events,
    totalEffectiveHpDamage,
    identity: event =>
      classifyDamageSource(event, actionById.get(String(event.actionId))),
    metadata: event => ({
      sourceKind: classifyDamageSource(
        event,
        actionById.get(String(event.actionId))
      ),
    }),
  });
  const byElement = createDamageRows({
    events,
    totalEffectiveHpDamage,
    identity: event => String(event.elementalType ?? 'unresolved'),
    metadata: event => {
      const element = ELEMENT_BY_ID.get(Number(event.elementalType));
      return {
        elementId: event.elementalType ?? null,
        elementName: element?.elementName ?? null,
        elementAbbrName: element?.elementAbbrName ?? null,
      };
    },
  });
  const sourceDamage = new Map(
    bySourceKind.map(row => [row.sourceKind, row.effectiveHpDamage])
  );
  const overlimitDamage = number(sourceDamage.get('tuning-overlimit'));
  const heldTuningDamage = number(sourceDamage.get('tuning-held'));
  const dotDamage =
    number(sourceDamage.get('battle-effect-dot')) +
    number(sourceDamage.get('kibo-passive-dot'));
  return {
    totalRawDamage: roundMetric(totalRawDamage),
    totalEffectiveHpDamage: roundMetric(totalEffectiveHpDamage),
    totalToughnessDamage: roundMetric(totalToughnessDamage),
    hitCount: events.length,
    byActor,
    byAction,
    bySourceKind,
    byElement,
    tuning: {
      overlimitDamage: roundMetric(overlimitDamage),
      overlimitShare: ratio(overlimitDamage, totalEffectiveHpDamage),
      heldTuningDamage: roundMetric(heldTuningDamage),
      heldTuningShare: ratio(heldTuningDamage, totalEffectiveHpDamage),
      totalTuningDamage: roundMetric(overlimitDamage + heldTuningDamage),
      totalTuningShare: ratio(
        overlimitDamage + heldTuningDamage,
        totalEffectiveHpDamage
      ),
      damageOverTime: roundMetric(dotDamage),
      damageOverTimeShare: ratio(dotDamage, totalEffectiveHpDamage),
    },
  };
}

function createDamageRows({
  events,
  totalEffectiveHpDamage,
  identity,
  metadata,
}) {
  const rows = new Map();
  for (const event of events) {
    const key = identity(event);
    const row = rows.get(key) ?? {
      identity: key,
      ...metadata(event),
      hitCount: 0,
      rawDamage: 0,
      effectiveHpDamage: 0,
      toughnessDamage: 0,
    };
    row.hitCount += 1;
    row.rawDamage += number(event.rawDamage);
    row.effectiveHpDamage += damageAmount(event);
    row.toughnessDamage += number(event.toughnessDamage);
    rows.set(key, row);
  }
  return [...rows.values()]
    .map(row => ({
      ...row,
      rawDamage: roundMetric(row.rawDamage),
      effectiveHpDamage: roundMetric(row.effectiveHpDamage),
      toughnessDamage: roundMetric(row.toughnessDamage),
      shareOfEffectiveHpDamage: ratio(
        row.effectiveHpDamage,
        totalEffectiveHpDamage
      ),
    }))
    .sort(
      (left, right) =>
        right.effectiveHpDamage - left.effectiveHpDamage ||
        left.identity.localeCompare(right.identity, 'en')
    );
}

function classifyDamageSource(event, action) {
  const tuningKind = String(event.tuningKind ?? '');
  if (tuningKind.startsWith('overlimit-')) return 'tuning-overlimit';
  if (tuningKind.startsWith('held-')) return 'tuning-held';
  if (event.battleEffectDot === true) return 'battle-effect-dot';
  if (event.kiboPassiveDerivedDot === true) return 'kibo-passive-dot';
  if (event.jointAttackPairIdentity != null) return 'joint-attack';
  if (event.sourceKiboId != null || action?.type === 'kiboEvent') {
    return event.passiveSkillId != null ? 'kibo-passive' : 'kibo-action';
  }
  if (event.passiveSkillId != null) return 'passive-effect';
  return action?.type === 'skill' ? 'actor-action' : 'unattributed';
}

function createEnergyDiagnostics(trace, contract, scope) {
  const initial = trace.state?.initial ?? {};
  const actors = createResourceRows({
    resourceKind: 'actor-sp',
    initialRows: initial.actorEnergy ?? [],
    finalRows: trace.state?.final?.actorEnergy ?? [],
    events: trace.resources?.actors ?? [],
    scope,
    identity: entry => `actor:${entry.actorId ?? 'unresolved'}`,
    metadata: entry => ({ actorId: entry.actorId ?? null }),
    fallbackInitialRows: (contract.scenario?.team ?? []).map(slot => ({
      actorId: slot.slotId ?? `actor-${slot.characterId}`,
      currentValue: number(slot.initialSp),
      maxValue: null,
    })),
  });
  const kibos = createResourceRows({
    resourceKind: 'kibo-energy',
    initialRows: initial.kiboEnergy ?? [],
    finalRows: trace.state?.final?.kiboEnergy ?? [],
    events: trace.resources?.kibos ?? [],
    scope,
    identity: entry =>
      `kibo:${entry.actorId ?? entry.slotId ?? 'unresolved'}:${entry.kiboId ?? 'unresolved'}`,
    metadata: entry => ({
      actorId: entry.actorId ?? null,
      kiboId: entry.kiboId ?? null,
      slotId: entry.slotId ?? null,
    }),
    fallbackInitialRows:
      contract.scenario?.initialRuntimeState?.kiboEnergyBySlot ?? [],
  });
  const all = [...actors, ...kibos];
  const available = sum(all.map(row => row.startValue + row.recoveredAmount));
  const spent = sum(all.map(row => row.spentAmount));
  const durationMs = Math.max(0, scope.endTimeMs - scope.startTimeMs);
  const maxTime = sum(all.map(row => row.capUptimeRatio * durationMs));
  const insufficientActions = (trace.executionPlan?.actions ?? [])
    .filter(
      action =>
        isExecutionEntryInScope(action, scope) &&
        String(action.skipReason ?? '').includes('resource-insufficient')
    )
    .map(action => String(action.actionId));
  return {
    overall: {
      startValue: roundMetric(sum(all.map(row => row.startValue))),
      recoveredAmount: roundMetric(sum(all.map(row => row.recoveredAmount))),
      spentAmount: roundMetric(spent),
      endValue: roundMetric(sum(all.map(row => row.endValue))),
      utilizationRatio: ratio(spent, available),
      averageCapUptimeRatio:
        all.length > 0 && durationMs > 0
          ? roundMetric(maxTime / (all.length * durationMs))
          : 0,
      resourceCount: all.length,
      insufficientActionCount: insufficientActions.length,
    },
    actors,
    kibos,
    insufficientActions: uniqueSorted(insufficientActions),
  };
}

function createResourceRows({
  resourceKind,
  initialRows,
  finalRows,
  events,
  scope,
  identity,
  metadata,
  fallbackInitialRows = [],
}) {
  const records = new Map();
  const upsert = entry => {
    const normalized = normalizeResourceEntry(entry);
    const key = identity(normalized);
    const row = records.get(key) ?? {
      identity: key,
      resourceKind,
      ...metadata(normalized),
      initialValue: null,
      maximum: null,
      finalValue: null,
      events: [],
    };
    if (normalized.currentValue != null && row.initialValue == null) {
      row.initialValue = normalized.currentValue;
    }
    if (normalized.maxValue != null) row.maximum = normalized.maxValue;
    records.set(key, row);
  };
  for (const entry of (initialRows ?? []).length > 0
    ? initialRows
    : fallbackInitialRows) {
    upsert(entry);
  }
  for (const entry of finalRows) {
    const normalized = normalizeResourceEntry(entry);
    const key = identity(normalized);
    upsert(normalized);
    records.get(key).finalValue = normalized.currentValue;
  }
  for (const event of events) {
    const normalized = normalizeResourceEntry({
      ...event,
      ...event.payload,
      actorId: event.actorId ?? event.payload?.actorId,
      timeMs: event.timeMs,
      actionId: event.actionId,
      runtimePhasePriority: event.runtimePhasePriority,
      runtimePriority: event.runtimePriority,
      runtimeSequenceIndex: event.runtimeSequenceIndex,
    });
    const key = identity(normalized);
    upsert(normalized);
    records.get(key).events.push(normalized);
  }
  return [...records.values()]
    .map(record => finalizeResourceRecord(record, scope))
    .sort((left, right) => left.identity.localeCompare(right.identity, 'en'));
}

function finalizeResourceRecord(record, scope) {
  const events = [...record.events].sort(compareRuntimeEvents);
  let current = number(record.initialValue);
  let maximum = numberOrNull(record.maximum);
  for (const event of events) {
    if (number(event.timeMs) >= scope.startTimeMs) break;
    current = numberOrFallback(
      event.afterValue,
      current + number(event.change)
    );
    maximum ??= numberOrNull(event.maxValue);
  }
  const startValue = current;
  const scoped = events.filter(event => isEventInScope(event, scope));
  let recoveredAmount = 0;
  let spentAmount = 0;
  let recoveryEventCount = 0;
  let spendEventCount = 0;
  let capHitCount = 0;
  let capUptimeMs = 0;
  let lastTimeMs = scope.startTimeMs;
  const recoveryByReason = new Map();
  const spendByReason = new Map();
  for (const event of scoped) {
    const timeMs = clamp(number(event.timeMs), lastTimeMs, scope.endTimeMs);
    if (isAtCap(current, maximum)) capUptimeMs += timeMs - lastTimeMs;
    const change = number(event.change);
    if (change > 0) {
      recoveredAmount += change;
      recoveryEventCount += 1;
      addNumeric(recoveryByReason, event.reason ?? 'unattributed', change);
    } else if (change < 0) {
      spentAmount += -change;
      spendEventCount += 1;
      addNumeric(spendByReason, event.reason ?? 'unattributed', -change);
    }
    maximum ??= numberOrNull(event.maxValue);
    current = numberOrFallback(event.afterValue, current + change);
    if (change > 0 && isAtCap(current, maximum)) capHitCount += 1;
    lastTimeMs = timeMs;
  }
  if (isAtCap(current, maximum)) {
    capUptimeMs += Math.max(0, scope.endTimeMs - lastTimeMs);
  }
  const available = startValue + recoveredAmount;
  const durationMs = Math.max(0, scope.endTimeMs - scope.startTimeMs);
  return {
    identity: record.identity,
    resourceKind: record.resourceKind,
    actorId: record.actorId ?? null,
    kiboId: record.kiboId ?? null,
    slotId: record.slotId ?? null,
    startValue: roundMetric(startValue),
    recoveredAmount: roundMetric(recoveredAmount),
    spentAmount: roundMetric(spentAmount),
    endValue: roundMetric(current),
    maximum,
    netChange: roundMetric(current - startValue),
    utilizationRatio: ratio(spentAmount, available),
    endingFillRatio: ratio(current, maximum),
    capUptimeMs: roundMetric(capUptimeMs),
    capUptimeRatio: ratio(capUptimeMs, durationMs),
    capHitCount,
    recoveryEventCount,
    spendEventCount,
    recoveryByReason: numericMapRows(recoveryByReason),
    spendByReason: numericMapRows(spendByReason),
  };
}

function createTuningMarkDiagnostics(trace, contract, scope, damage) {
  const mechanicsPackage = getInstalledVerifiedCombatMechanicsPackage();
  const profileByMarkId = new Map(
    (mechanicsPackage?.tuningMechanicsCatalog?.profiles ?? []).map(profile => [
      Number(profile.markId),
      profile,
    ])
  );
  const inheritedByMarkId = new Map(
    (contract.scenario?.initialRuntimeState?.tuningMarks ?? []).map(row => [
      Number(row.markId),
      row,
    ])
  );
  const eventsByMarkId = new Map();
  for (const event of trace.resources?.tuningMarks ?? []) {
    const markId = Number(event.markId);
    const rows = eventsByMarkId.get(markId) ?? [];
    rows.push(event);
    eventsByMarkId.set(markId, rows);
  }
  const markIds = new Set([
    ...profileByMarkId.keys(),
    ...inheritedByMarkId.keys(),
    ...eventsByMarkId.keys(),
  ]);
  const profiles = [...markIds]
    .map(markId =>
      createTuningMarkProfileDiagnostics({
        markId,
        profile: profileByMarkId.get(markId),
        inherited: inheritedByMarkId.get(markId),
        events: eventsByMarkId.get(markId) ?? [],
        scope,
      })
    )
    .sort((left, right) => left.markId - right.markId);
  const activeIntervals = mergeIntervals(
    profiles.flatMap(profile => profile.activeIntervals)
  );
  const durationMs = Math.max(0, scope.endTimeMs - scope.startTimeMs);
  const activeTimeMs = sum(
    activeIntervals.map(interval => interval.endMs - interval.startMs)
  );
  const availableStacks = sum(profiles.map(profile => profile.availableStacks));
  const consumedStacks = sum(profiles.map(profile => profile.consumedStacks));
  const expiredStacks = sum(profiles.map(profile => profile.expiredStacks));
  const overlimitDamage = number(damage.tuning?.overlimitDamage);
  return {
    overall: {
      profileCount: profiles.length,
      activeProfileCount: profiles.filter(profile => profile.coverageRatio > 0)
        .length,
      availableStacks: roundMetric(availableStacks),
      acquiredStacks: roundMetric(
        sum(profiles.map(profile => profile.acquiredStacks))
      ),
      consumedStacks: roundMetric(consumedStacks),
      expiredStacks: roundMetric(expiredStacks),
      refreshAtCapCount: sum(
        profiles.map(profile => profile.refreshAtCapCount)
      ),
      consumptionRatio: ratio(consumedStacks, availableStacks),
      expiryWasteRatio: ratio(expiredStacks, availableStacks),
      anyMarkCoverageMs: roundMetric(activeTimeMs),
      anyMarkCoverageRatio: ratio(activeTimeMs, durationMs),
      averageTotalStacks: roundMetric(
        sum(profiles.map(profile => profile.stackTime)) /
          Math.max(durationMs, VALUE_TOLERANCE)
      ),
      overlimitDamage: roundMetric(overlimitDamage),
      overlimitDamageShare: number(damage.tuning?.overlimitShare),
      overlimitDamagePerConsumedStack: ratio(
        overlimitDamage,
        consumedStacks,
        null
      ),
    },
    profiles: profiles.map(profile => {
      const row = { ...profile };
      delete row.activeIntervals;
      delete row.stackTime;
      return row;
    }),
  };
}

function createTuningMarkProfileDiagnostics({
  markId,
  profile,
  inherited,
  events,
  scope,
}) {
  const sorted = [...events].sort(compareRuntimeEvents);
  let current = Array.isArray(inherited?.layers)
    ? inherited.layers.length
    : number(inherited?.currentValue);
  for (const event of sorted) {
    if (number(event.timeMs) >= scope.startTimeMs) break;
    current = numberOrFallback(event.after, current + number(event.delta));
  }
  const startStacks = current;
  const maximum =
    numberOrNull(profile?.maxStacks) ??
    firstNumber(sorted.map(event => event.maximum)) ??
    0;
  const scoped = sorted.filter(event => isEventInScope(event, scope));
  let acquiredStacks = 0;
  let consumedStacks = 0;
  let expiredStacks = 0;
  let refreshAtCapCount = 0;
  let acquisitionEventCount = 0;
  let consumeEventCount = 0;
  let expireEventCount = 0;
  let coverageMs = 0;
  let capCoverageMs = 0;
  let stackTime = 0;
  let lastTimeMs = scope.startTimeMs;
  let maxStacksObserved = current;
  const activeIntervals = [];
  let activeIntervalStart = current > 0 ? scope.startTimeMs : null;
  for (const event of scoped) {
    const timeMs = clamp(number(event.timeMs), lastTimeMs, scope.endTimeMs);
    const duration = Math.max(0, timeMs - lastTimeMs);
    if (current > 0) coverageMs += duration;
    if (maximum > 0 && current >= maximum) capCoverageMs += duration;
    stackTime += current * duration;
    const delta = number(event.delta);
    if (event.kind === 'acquire') {
      acquisitionEventCount += 1;
      if (delta > 0) acquiredStacks += delta;
      else if (delta === 0 && maximum > 0 && current >= maximum) {
        refreshAtCapCount += 1;
      }
    } else if (event.kind === 'consume') {
      consumeEventCount += 1;
      consumedStacks += Math.max(0, -delta);
    } else if (event.kind === 'expire') {
      expireEventCount += 1;
      expiredStacks += Math.max(0, -delta);
    }
    const beforeActive = current > 0;
    current = numberOrFallback(event.after, current + delta);
    maxStacksObserved = Math.max(maxStacksObserved, current);
    const afterActive = current > 0;
    if (!beforeActive && afterActive) activeIntervalStart = timeMs;
    if (beforeActive && !afterActive && activeIntervalStart != null) {
      activeIntervals.push({ startMs: activeIntervalStart, endMs: timeMs });
      activeIntervalStart = null;
    }
    lastTimeMs = timeMs;
  }
  const tailDuration = Math.max(0, scope.endTimeMs - lastTimeMs);
  if (current > 0) coverageMs += tailDuration;
  if (maximum > 0 && current >= maximum) capCoverageMs += tailDuration;
  stackTime += current * tailDuration;
  if (activeIntervalStart != null) {
    activeIntervals.push({
      startMs: activeIntervalStart,
      endMs: scope.endTimeMs,
    });
  }
  const durationMs = Math.max(0, scope.endTimeMs - scope.startTimeMs);
  const availableStacks = startStacks + acquiredStacks;
  return {
    identity: `tuning-mark:${profile?.key ?? markId}`,
    profileKey: profile?.key ?? null,
    elementName: profile?.element ?? null,
    markId,
    maximum,
    startStacks: roundMetric(startStacks),
    acquiredStacks: roundMetric(acquiredStacks),
    consumedStacks: roundMetric(consumedStacks),
    expiredStacks: roundMetric(expiredStacks),
    endStacks: roundMetric(current),
    availableStacks: roundMetric(availableStacks),
    consumptionRatio: ratio(consumedStacks, availableStacks),
    expiryWasteRatio: ratio(expiredStacks, availableStacks),
    coverageMs: roundMetric(coverageMs),
    coverageRatio: ratio(coverageMs, durationMs),
    capCoverageMs: roundMetric(capCoverageMs),
    capCoverageRatio: ratio(capCoverageMs, durationMs),
    averageStacks: roundMetric(
      stackTime / Math.max(durationMs, VALUE_TOLERANCE)
    ),
    maxStacksObserved: roundMetric(maxStacksObserved),
    acquisitionEventCount,
    consumeEventCount,
    expireEventCount,
    refreshAtCapCount,
    activeIntervals,
    stackTime,
  };
}

function createOptimizationRecommendations({ damage, energy, tuningMarks }) {
  const recommendations = [];
  for (const resource of [...(energy.actors ?? []), ...(energy.kibos ?? [])]) {
    if (resource.capUptimeRatio >= 0.2) {
      recommendations.push({
        code: 'resource-cap-uptime-high',
        severity: 'info',
        identity: resource.identity,
        message: `${resource.identity} 有 ${formatPercent(resource.capUptimeRatio)} 的统计窗口处于满能状态；考虑提前消费或减少回能投入。`,
      });
    }
    if (resource.utilizationRatio < 0.5 && resource.endValue > 0) {
      recommendations.push({
        code: 'resource-utilization-low',
        severity: 'info',
        identity: resource.identity,
        message: `${resource.identity} 仅利用 ${formatPercent(resource.utilizationRatio)} 的可用资源；可尝试增加有效技能或缩短窗口。`,
      });
    }
  }
  if ((energy.insufficientActions ?? []).length > 0) {
    recommendations.push({
      code: 'resource-insufficient-actions',
      severity: 'warning',
      actionIds: energy.insufficientActions,
      message: `存在 ${energy.insufficientActions.length} 个资源不足动作；先调整施放时点或回能预算。`,
    });
  }
  for (const profile of tuningMarks.profiles ?? []) {
    if (profile.expiryWasteRatio >= 0.25) {
      recommendations.push({
        code: 'tuning-mark-expiry-waste-high',
        severity: 'info',
        identity: profile.identity,
        message: `${profile.elementName ?? profile.markId}印记有 ${formatPercent(profile.expiryWasteRatio)} 的可用层数自然衰减；考虑前移消费或压缩循环。`,
      });
    }
    if (profile.coverageRatio > 0.5 && profile.consumptionRatio === 0) {
      recommendations.push({
        code: 'tuning-mark-held-not-consumed',
        severity: 'info',
        identity: profile.identity,
        message: `${profile.elementName ?? profile.markId}印记覆盖率较高但未消费；若轴依赖持有收益可保留，否则检查超限机会。`,
      });
    }
  }
  if (
    tuningMarks.overall?.consumedStacks > 0 &&
    number(damage.tuning?.overlimitShare) < 0.05
  ) {
    recommendations.push({
      code: 'overlimit-share-low-for-consumed-marks',
      severity: 'info',
      message: `已消费印记但超限伤害仅占 ${formatPercent(damage.tuning.overlimitShare)}；检查消费动作、元素与增伤窗口。`,
    });
  }
  return recommendations.sort((left, right) =>
    `${left.code}|${left.identity ?? ''}`.localeCompare(
      `${right.code}|${right.identity ?? ''}`,
      'en'
    )
  );
}

function normalizeDiagnosticScope(trace, options) {
  const startTimeMs = Math.max(0, number(options.startTimeMs));
  const endTimeMs = Math.max(
    startTimeMs,
    numberOrFallback(options.endTimeMs, trace.scenario?.durationMs)
  );
  const endCursor = options.endCursor
    ? projectRuntimeCursor(options.endCursor)
    : null;
  return {
    kind: options.scopeKind ?? 'full-scenario',
    interval: endCursor
      ? '[start,cursor]'
      : options.endExclusive === true
        ? '[start,end)'
        : '[start,end]',
    startTimeMs,
    endTimeMs,
    endExclusive: options.endExclusive === true,
    endCursor,
  };
}

function isEventInScope(event, scope) {
  const timeMs = number(event?.timeMs);
  if (timeMs < scope.startTimeMs) return false;
  if (scope.endCursor) {
    return compareRuntimeEvents(event, scope.endCursor) <= 0;
  }
  return scope.endExclusive
    ? timeMs < scope.endTimeMs
    : timeMs <= scope.endTimeMs;
}

function isExecutionEntryInScope(entry, scope) {
  const startMs = number(entry?.startMs);
  return (
    startMs >= scope.startTimeMs &&
    (scope.endExclusive
      ? startMs < scope.endTimeMs
      : startMs <= scope.endTimeMs)
  );
}

function normalizeResourceEntry(entry = {}) {
  return {
    actorId: entry.actorId ?? null,
    kiboId: entry.kiboId ?? null,
    slotId: entry.slotId ?? null,
    currentValue: numberOrNull(entry.currentValue),
    maxValue: numberOrNull(entry.maxValue),
    beforeValue: numberOrNull(entry.beforeValue),
    afterValue: numberOrNull(entry.afterValue),
    change: number(entry.change),
    reason: entry.reason ?? null,
    timeMs: number(entry.timeMs),
    actionId: entry.actionId ?? null,
    runtimePhasePriority: numberOrNull(entry.runtimePhasePriority),
    runtimePriority: numberOrNull(entry.runtimePriority),
    runtimeSequenceIndex: numberOrNull(entry.runtimeSequenceIndex),
  };
}

function projectRuntimeCursor(event) {
  return {
    timeMs: number(event?.timeMs),
    runtimePhasePriority: number(event?.runtimePhasePriority),
    runtimePriority: number(event?.runtimePriority),
    runtimeSequenceIndex: number(event?.runtimeSequenceIndex),
  };
}

function compareRuntimeEvents(left, right) {
  return (
    number(left?.timeMs) - number(right?.timeMs) ||
    number(left?.runtimePhasePriority) - number(right?.runtimePhasePriority) ||
    number(left?.runtimePriority) - number(right?.runtimePriority) ||
    number(left?.runtimeSequenceIndex) - number(right?.runtimeSequenceIndex)
  );
}

function mergeIntervals(intervals) {
  const sorted = intervals
    .filter(interval => interval.endMs > interval.startMs)
    .sort(
      (left, right) => left.startMs - right.startMs || left.endMs - right.endMs
    );
  const merged = [];
  for (const interval of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && interval.startMs <= previous.endMs) {
      previous.endMs = Math.max(previous.endMs, interval.endMs);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

function averageRows(sampleRows) {
  const maps = sampleRows.map(
    rows => new Map((rows ?? []).map(row => [String(row.identity), row]))
  );
  const identities = new Set(maps.flatMap(map => [...map.keys()]));
  return [...identities]
    .map(identity => {
      const rows = maps.map(map => map.get(identity) ?? null);
      const representative = rows.find(Boolean) ?? { identity };
      return {
        ...representative,
        ...averageNumericRecord(rows),
      };
    })
    .sort((left, right) => left.identity.localeCompare(right.identity, 'en'));
}

function averageNumericRecord(rows) {
  const records = rows.filter(Boolean);
  if (records.length === 0) return {};
  const numericKeys = new Set(
    records.flatMap(record =>
      Object.entries(record)
        .filter(([, value]) => Number.isFinite(value))
        .map(([key]) => key)
    )
  );
  return Object.fromEntries(
    [...numericKeys].map(key => [
      key,
      roundMetric(
        rows.reduce((sumValue, row) => sumValue + number(row?.[key]), 0) /
          rows.length
      ),
    ])
  );
}

function numericMapRows(map) {
  return [...map.entries()]
    .map(([reason, value]) => ({ reason, value: roundMetric(value) }))
    .sort(
      (left, right) =>
        right.value - left.value ||
        left.reason.localeCompare(right.reason, 'en')
    );
}

function addNumeric(map, key, value) {
  map.set(String(key), number(map.get(String(key))) + number(value));
}

function damageAmount(event) {
  return numberOrFallback(event?.effectiveHpDamage, event?.rawDamage);
}

function isAtCap(value, maximum) {
  return maximum != null && value >= maximum - VALUE_TOLERANCE;
}

function ratio(numerator, denominator, fallback = 0) {
  const den = Number(denominator);
  if (!Number.isFinite(den) || Math.abs(den) <= VALUE_TOLERANCE) {
    return fallback;
  }
  return roundMetric(number(numerator) / den);
}

function mean(values) {
  return values.length > 0
    ? roundMetric(sum(values.map(number)) / values.length)
    : 0;
}

function sum(values) {
  return values.reduce((total, value) => total + number(value), 0);
}

function number(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
}

function numberOrNull(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function numberOrFallback(value, fallback) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : number(fallback);
}

function firstNumber(values) {
  for (const value of values) {
    const normalized = numberOrNull(value);
    if (normalized != null) return normalized;
  }
  return null;
}

function roundMetric(value) {
  return Math.round((number(value) + Number.EPSILON) * 1e6) / 1e6;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) =>
    String(left).localeCompare(String(right), 'en')
  );
}

function formatPercent(value) {
  return `${roundMetric(number(value) * 100)}%`;
}
