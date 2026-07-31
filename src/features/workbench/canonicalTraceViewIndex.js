import { projectEffectRuntimeIntervals } from '../../simulation/projection/projectEffectIntervals';
import { resolveVerifiedActionRuntimeResolution } from './verifiedActionMechanicsTrace';

export const CANONICAL_TRACE_VIEW_INDEX_SCHEMA_VERSION = 1;
export const CANONICAL_TRACE_VIEW_INDEX_CONTRACT_NAME =
  'AzPrCanonicalTraceViewIndex';

const MAX_CACHE_ENTRIES = 8;
const indexCache = new Map();

export function createCanonicalTraceViewIndex(run, options = {}) {
  const trace = run?.trace ?? run;
  if (!trace || typeof trace !== 'object' || Array.isArray(trace)) {
    throw new TypeError('createCanonicalTraceViewIndex requires a trace');
  }
  const traceHash = String(
    options.traceHash ??
      run?.traceHash ??
      run?.hashes?.trace ??
      run?.hashes?.traceHash ??
      trace.traceHash ??
      ''
  );
  if (!traceHash) {
    throw new TypeError('createCanonicalTraceViewIndex requires a trace hash');
  }
  const actionResolutions =
    options.actionResolutions ?? run?.actionResolutions ?? [];
  const requestedActions =
    options.requestedActions ?? run?.contract?.actions ?? [];
  const runtime =
    options.verifiedCombatRuntime ??
    run?.simulation?.verifiedCombatRuntime ??
    null;
  const effectTimeline =
    options.effectTimeline ?? run?.simulation?.effectTimeline ?? null;
  const effectIntervals = resolveCanonicalEffectIntervals({
    trace,
    effectTimeline,
  });
  const cacheKey = createCacheKey({
    traceHash,
    actionResolutions,
    requestedActions,
    effectIntervals,
  });
  const cached = indexCache.get(cacheKey);
  if (cached) return cached;

  const index = buildTraceViewIndex({
    trace,
    traceHash,
    actionResolutions,
    requestedActions,
    runtime,
    effectIntervals,
  });
  indexCache.set(cacheKey, index);
  while (indexCache.size > MAX_CACHE_ENTRIES) {
    indexCache.delete(indexCache.keys().next().value);
  }
  return index;
}

export function clearCanonicalTraceViewIndexCache() {
  indexCache.clear();
}

export function classifyCanonicalToughnessFact(event) {
  const signedChange = finiteNumber(event?.toughnessDamage) ?? 0;
  const isStateChange = event?.eventType === 'VERIFIED_TOUGHNESS_STATE_CHANGE';
  if (!isStateChange) {
    return {
      kind: 'toughness-damage',
      amount: Math.max(0, signedChange),
      signedChange,
    };
  }
  if (
    signedChange < 0 ||
    String(event?.stateEventKind ?? '').includes('recovery')
  ) {
    return {
      kind: 'toughness-recovery',
      amount: Math.abs(signedChange),
      signedChange,
    };
  }
  return {
    kind: 'toughness-state-change',
    amount: Math.abs(signedChange),
    signedChange,
  };
}

function buildTraceViewIndex({
  trace,
  traceHash,
  actionResolutions,
  requestedActions,
  runtime,
  effectIntervals,
}) {
  const requestedById = mapById(requestedActions);
  const resolutionById = mapById(actionResolutions, 'actionId');
  const variantsById = mapById(trace.variants?.selections, 'actionId');
  const executionById = mapById(
    trace.executionPlan?.actions ?? trace.executionPlan,
    'actionId'
  );
  const readinessById = mapById(
    trace.readiness?.actions ?? trace.readiness,
    'actionId'
  );
  const diagnosticsByActionId = groupBy(
    trace.diagnostics,
    item => item?.actionId
  );
  const damageByActionId = groupBy(trace.damage, item => item?.actionId);
  const effectEventsByActionId = groupBy(
    trace.effects?.events,
    item => item?.actionId
  );
  const effectIntervalViews = asArray(effectIntervals).map(interval =>
    createEffectIntervalView(interval)
  );
  const effectIntervalsByActionId = groupBy(
    effectIntervalViews,
    item => item?.actionId
  );
  const resourceTransactions = createResourceTransactions(trace.resources);
  const resourcesByActionId = groupBy(
    resourceTransactions,
    item => item.actionId
  );
  const factsByIdentity = new Map();
  const hitsByIdentity = new Map();
  const effectsByIdentity = new Map();
  const resourcesByIdentity = new Map();

  const actionViews = asArray(trace.actions).map(action => {
    const actionId = String(action.id);
    const machineResolution = resolutionById.get(actionId) ?? null;
    const runtimeResolution = resolveVerifiedActionRuntimeResolution(
      runtime,
      actionId
    );
    const variant = variantsById.get(actionId) ?? null;
    const execution = executionById.get(actionId) ?? null;
    const readiness = readinessById.get(actionId) ?? null;
    const damageEvents = damageByActionId.get(actionId) ?? [];
    const actionDiagnostics = [...(diagnosticsByActionId.get(actionId) ?? [])];
    const hitResult = createActionHitViews({
      action,
      machineResolution,
      runtimeResolution,
      damageEvents,
    });
    actionDiagnostics.push(...hitResult.diagnostics);
    const effectEvents = (effectEventsByActionId.get(actionId) ?? []).map(
      createEffectEventView
    );
    const effectIntervals = effectIntervalsByActionId.get(actionId) ?? [];
    const actionResources = resourcesByActionId.get(actionId) ?? [];
    const startMs =
      finiteNumber(execution?.startMs) ?? finiteNumber(action.startMs) ?? 0;
    const durationMs =
      finiteNumber(execution?.durationMs) ??
      finiteNumber(action.durationMs) ??
      0;
    const view = {
      identity: actionId,
      actionId,
      name: String(action.name ?? variant?.semanticName ?? actionId),
      type: action.type ?? null,
      requested: createRequestedActionView(requestedById.get(actionId), action),
      resolved: {
        semanticName:
          variant?.semanticName ?? action.semanticName ?? action.name ?? null,
        controlSkillId:
          variant?.controlSkillId ??
          runtimeResolution?.actionBinding?.executionControlSkillId ??
          runtimeResolution?.actionBinding?.controlSkillId ??
          action.controlSkillId ??
          null,
        subSkillIndex:
          variant?.subSkillIndex ??
          runtimeResolution?.actionBinding?.selectedSubSkillIndex ??
          action.subSkillIndex ??
          null,
        sourceIdentity:
          variant?.sourceIdentity ??
          runtimeResolution?.actionBinding?.identity ??
          machineResolution?.mappingIdentity ??
          null,
        sourceEvidenceStatus:
          machineResolution?.sourceEvidenceStatus ??
          action.sourceEvidenceStatus ??
          null,
        scenarioRuntimeStatus:
          machineResolution?.scenarioRuntimeStatus ??
          action.scenarioRuntimeStatus ??
          null,
      },
      schedule: {
        requested: requestedById.get(actionId)?.schedule ?? null,
        startMs,
        durationMs,
        endMs: startMs + durationMs,
        actualDurationFrames:
          variant?.actualDurationFrames ??
          machineResolution?.durationFrames ??
          null,
      },
      execution,
      readiness,
      diagnostics: actionDiagnostics,
      hits: hitResult.hits,
      damageEvents,
      toughnessFacts: damageEvents.map(classifyCanonicalToughnessFact),
      effectEvents,
      effectIntervals,
      resourceTransactions: actionResources,
      stateBeforeAfter: createStateBeforeAfter({
        effectEvents,
        resourceTransactions: actionResources,
      }),
      sourceAction: action,
    };
    factsByIdentity.set(actionId, { kind: 'action', value: view });
    for (const hit of view.hits) {
      hitsByIdentity.set(`${actionId}|${hit.identity}`, hit);
      factsByIdentity.set(`${actionId}|hit|${hit.identity}`, {
        kind: 'hit',
        value: hit,
        actionId,
      });
    }
    for (const effect of [...effectEvents, ...effectIntervals]) {
      effectsByIdentity.set(effect.identity, effect);
      factsByIdentity.set(effect.identity, {
        kind: 'effect',
        value: effect,
        actionId,
      });
    }
    for (const resource of actionResources) {
      resourcesByIdentity.set(resource.identity, resource);
      factsByIdentity.set(resource.identity, {
        kind: 'resource',
        value: resource,
        actionId,
      });
    }
    return view;
  });

  const actionsById = new Map(
    actionViews.map(action => [action.actionId, action])
  );
  return Object.freeze({
    schemaVersion: CANONICAL_TRACE_VIEW_INDEX_SCHEMA_VERSION,
    contractName: CANONICAL_TRACE_VIEW_INDEX_CONTRACT_NAME,
    traceHash,
    actionViews,
    actionsById,
    hitsByIdentity,
    effectsByIdentity,
    resourcesByIdentity,
    factsByIdentity,
    controlledActors: asArray(trace.controlledActors),
    state: {
      initial: trace.state?.initial ?? null,
      final: trace.state?.final ?? null,
      targetEvents: asArray(trace.state?.targetEvents),
      conditionalHitGroups: asArray(trace.state?.conditionalHitGroups),
    },
    diagnostics: asArray(trace.diagnostics),
    summary: {
      actionCount: actionViews.length,
      hitCount: [...hitsByIdentity.values()].filter(hit => !hit.stale).length,
      effectEventCount: asArray(trace.effects?.events).length,
      effectIntervalCount: effectIntervalViews.length,
      resourceTransactionCount: resourceTransactions.length,
    },
  });
}

function createActionHitViews({
  action,
  machineResolution,
  runtimeResolution,
  damageEvents,
}) {
  const definitions = collectVisibleHitDefinitions(runtimeResolution);
  const definitionByIdentity = new Map(
    definitions.map((definition, index) => [
      String(definition.hitIdentity),
      { ...definition, displayIndex: index + 1 },
    ])
  );
  for (const identity of machineResolution?.availableHitIdentities ?? []) {
    if (!definitionByIdentity.has(String(identity))) {
      definitionByIdentity.set(String(identity), {
        hitIdentity: String(identity),
        displayIndex: definitionByIdentity.size + 1,
      });
    }
  }
  for (const event of damageEvents) {
    if (event.hitIdentity && !definitionByIdentity.has(event.hitIdentity)) {
      definitionByIdentity.set(event.hitIdentity, {
        hitIdentity: event.hitIdentity,
        displayIndex: definitionByIdentity.size + 1,
      });
    }
  }
  const overrides = action.hitOverrides ?? {};
  const availableIdentities = new Set(definitionByIdentity.keys());
  const diagnostics = [];
  for (const identity of Object.keys(overrides)) {
    if (availableIdentities.has(identity)) continue;
    diagnostics.push({
      severity: 'error',
      code: 'machine-axis-hit-override-stale',
      actionId: String(action.id),
      hitIdentity: identity,
      message: `Hit override no longer matches the resolved variant: ${identity}`,
    });
    definitionByIdentity.set(identity, {
      hitIdentity: identity,
      displayIndex: definitionByIdentity.size + 1,
      stale: true,
    });
  }
  const settlementsByIdentity = groupBy(
    damageEvents.filter(event => event.hitIdentity),
    event => event.hitIdentity
  );
  return {
    diagnostics,
    hits: [...definitionByIdentity.values()].map(definition => {
      const identity = String(definition.hitIdentity);
      const factIdentity = [String(action.id), 'hit', identity].join('|');
      const override = overrides[identity] ?? {};
      const settlements = settlementsByIdentity.get(identity) ?? [];
      const branch =
        settlements.find(event => event.formula?.randomBranch)?.formula
          ?.randomBranch ?? null;
      const expectedSettlement = settlements.find(
        event => event.formula?.verifiedResult?.expectedCritical
      );
      const expectedVerifiedResult =
        expectedSettlement?.formula?.verifiedResult ?? null;
      const expected = expectedVerifiedResult?.expectedCritical ?? null;
      const sourceCriticalRateBasisPoints =
        finiteNumber(branch?.sourceCriticalRateBasisPoints) ??
        rateToBasisPoints(branch?.sourceCriticalRate);
      const targetCriticalDefenseBasisPoints =
        finiteNumber(branch?.targetCriticalRateDefenseBasisPoints) ??
        rateToBasisPoints(branch?.targetCriticalRateDefense);
      const effectiveThresholdBasisPoints =
        finiteNumber(branch?.criticalThreshold) ??
        clampBasisPoints(
          (sourceCriticalRateBasisPoints ?? 0) -
            (targetCriticalDefenseBasisPoints ?? 0)
        );
      const expectedResult = expected
        ? {
            probabilityBasisPoints: finiteNumber(
              expected.probabilityBasisPoints
            ),
            nonCriticalRaw:
              expected.nonCriticalRaw == null
                ? null
                : String(expected.nonCriticalRaw),
            nonCriticalValue: finiteNumber(expected.nonCriticalValue),
            criticalRaw:
              expected.criticalRaw == null
                ? null
                : String(expected.criticalRaw),
            criticalValue: finiteNumber(expected.criticalValue),
            weightedRaw:
              expectedVerifiedResult?.raw == null
                ? null
                : String(expectedVerifiedResult.raw),
            weightedValue: finiteNumber(expectedVerifiedResult?.value),
            weightedInteger:
              expectedVerifiedResult?.integer == null
                ? null
                : String(expectedVerifiedResult.integer),
            criticalEventMaterialized:
              typeof expected.criticalEventMaterialized === 'boolean'
                ? expected.criticalEventMaterialized
                : null,
          }
        : null;
      return {
        identity,
        factIdentity,
        label:
          definition.displayLabel ??
          definition.name ??
          settlements[0]?.hitKey ??
          `Hit ${definition.displayIndex}`,
        sourceKind:
          definition.referenceKind === 'bulletElements'
            ? 'projectile'
            : (definition.referenceKind ?? null),
        sourceIdentity:
          definition.sourceIdentity ??
          settlements[0]?.formula?.sourceIdentity ??
          null,
        frame:
          finiteNumber(definition.trigger?.impactFrame) ??
          finiteNumber(definition.trigger?.startFrame) ??
          null,
        timeMs: finiteNumber(settlements[0]?.timeMs),
        landed:
          override.willHit === false
            ? 'miss'
            : override.willHit === true
              ? 'hit'
              : 'inherit',
        criticalMode: override.criticalPolicy ?? 'inherit',
        criticalRoll:
          finiteNumber(override.criticalRoll) ??
          finiteNumber(branch?.criticalRoll),
        stale: definition.stale === true,
        settlements,
        contribution: {
          hpDamage: sumNumbers(settlements, event => event.rawDamage),
          toughnessDamage: sumNumbers(
            settlements.filter(
              event => event.eventType !== 'VERIFIED_TOUGHNESS_STATE_CHANGE'
            ),
            event => event.toughnessDamage
          ),
        },
        critical: branch
          ? {
              policy: branch.policy ?? null,
              mode: branch.mode ?? null,
              sourceCriticalRateBasisPoints,
              targetCriticalDefenseBasisPoints,
              effectiveThresholdBasisPoints,
              sourceCriticalDamageMultiplier: finiteNumber(
                branch.sourceCriticalDamageMultiplier
              ),
              sourceCriticalDamageBasisPoints: finiteNumber(
                branch.sourceCriticalDamageBasisPoints
              ),
              roll: finiteNumber(branch.criticalRoll),
              critical: branch.critical === true,
              expected: branch.expected === true,
              expectedProbabilityBasisPoints:
                finiteNumber(expected?.probabilityBasisPoints) ??
                finiteNumber(branch.expectedCriticalProbabilityBasisPoints),
              expectedResult,
              eventMaterialized:
                branch.expected === true
                  ? (expectedResult?.criticalEventMaterialized ?? null)
                  : branch.critical === true,
              streamIndex: finiteNumber(branch.criticalStreamIndex),
              randomSeed: branch.randomSeed ?? null,
            }
          : null,
      };
    }),
  };
}

function collectVisibleHitDefinitions(resolution) {
  const allHits = asArray(resolution?.allHits ?? resolution?.hits);
  if (
    !Array.isArray(resolution?.conditionalHitGroupResults) ||
    !allHits.some(hit => hit?.conditionalGroupIdentity)
  ) {
    return allHits.filter(hit => hit?.hitIdentity);
  }
  const materialized = new Set(
    asArray(resolution?.hits)
      .map(hit => hit?.hitIdentity)
      .filter(Boolean)
  );
  const appliedGroups = new Set(
    resolution.conditionalHitGroupResults
      .filter(result => result?.applied)
      .map(result => result.groupIdentity)
  );
  return allHits.filter(
    hit =>
      hit?.hitIdentity &&
      (!hit.conditionalGroupIdentity ||
        materialized.has(hit.hitIdentity) ||
        appliedGroups.has(hit.conditionalGroupIdentity))
  );
}

function createRequestedActionView(requested, action) {
  if (requested) {
    return {
      owner: requested.owner ?? null,
      intent: requested.intent ?? null,
      schedule: requested.schedule ?? null,
      hitOverrides: requested.hitOverrides ?? {},
    };
  }
  return {
    owner: {
      kind: action.type === 'kiboEvent' ? 'kibo' : 'actor',
      slotId: null,
    },
    intent: {
      kind: action.type === 'switch' ? 'switch' : 'public-action',
      publicActionId: action.skillId ?? null,
      actionKind: action.actionKind ?? null,
      semanticVariant: null,
    },
    schedule: {
      mode: 'absolute',
      frame: Number.isFinite(Number(action.startFrame))
        ? Number(action.startFrame)
        : null,
    },
    hitOverrides: action.hitOverrides ?? {},
  };
}

function createResourceTransactions(resources = {}) {
  const rows = [
    ...asArray(resources.actors).map(event =>
      createResourceTransaction(event, 'actor-sp')
    ),
    ...asArray(resources.kibos).map(event =>
      createResourceTransaction(event, 'kibo-energy')
    ),
    ...asArray(resources.special).map(event =>
      createResourceTransaction(
        {
          ...event,
          ...(event.payload ?? {}),
        },
        'special-resource'
      )
    ),
    ...asArray(resources.tuningMarks).map(event =>
      createResourceTransaction(
        {
          ...event,
          beforeValue: event.before,
          afterValue: event.after,
          change: event.delta,
          resourceIdentity: `tuning-mark:${event.markId}`,
          reason: event.kind,
        },
        'tuning-mark'
      )
    ),
  ];
  return rows.sort(
    (left, right) =>
      left.timeMs - right.timeMs ||
      left.identity.localeCompare(right.identity, 'en')
  );
}

function createResourceTransaction(event, fallbackKind) {
  const resourceKind = String(
    event.resource ?? event.type ?? fallbackKind
  ).toLowerCase();
  const resourceIdentity = String(
    event.resourceIdentity ??
      (fallbackKind === 'actor-sp'
        ? `actor-sp:${event.actorId}`
        : fallbackKind === 'kibo-energy'
          ? `kibo-energy:${event.slotId}:${event.kiboId}`
          : fallbackKind)
  );
  const timeMs = finiteNumber(event.timeMs) ?? 0;
  const sequence =
    event.runtimeSequenceIndex ?? event.eventIdentity ?? event.hitKey ?? '';
  return {
    identity: [
      'resource',
      resourceIdentity,
      event.actionId ?? '',
      timeMs,
      sequence,
    ].join('|'),
    actionId: event.actionId == null ? null : String(event.actionId),
    actorId: event.actorId ?? null,
    targetId: event.targetId ?? null,
    slotId: event.slotId ?? null,
    kiboId: event.kiboId ?? null,
    resourceKind,
    resourceIdentity,
    operation: event.operation ?? event.kind ?? event.reason ?? null,
    before: finiteNumber(event.beforeValue ?? event.before),
    after: finiteNumber(event.afterValue ?? event.after),
    change: finiteNumber(event.change ?? event.delta),
    maxValue: finiteNumber(event.maxValue ?? event.maximum),
    timeMs,
    sourceIdentity: event.sourceIdentity ?? null,
    reason: event.reason ?? null,
  };
}

function createEffectEventView(event) {
  return {
    identity:
      String(event.eventId ?? '') ||
      [
        'effect-event',
        event.effectId,
        event.actionId,
        event.targetId,
        event.operation,
        event.timeMs,
        serializeIdentity(event.sourceIdentity),
      ].join('|'),
    actionId: event.actionId == null ? null : String(event.actionId),
    effectId: event.effectId ?? null,
    name: event.effectName ?? event.name ?? event.effectId ?? 'effect',
    operation: event.operation ?? null,
    ownerId: event.ownerId ?? null,
    targetKind: event.targetKind ?? null,
    targetId: event.targetId ?? null,
    previousTargetId: event.previousTargetId ?? null,
    nextTargetId: event.nextTargetId ?? null,
    timeMs: finiteNumber(event.timeMs) ?? 0,
    before: event.before ?? null,
    after: event.after ?? null,
    stackChange: finiteNumber(event.stackChange),
    modifiers: asArray(event.modifiers),
    sourceIdentity: event.sourceIdentity ?? null,
  };
}

function createEffectIntervalView(interval) {
  const sourceActionId =
    interval.actionId ??
    interval.sourceActionId ??
    interval.sourceActionIds?.[0] ??
    null;
  return {
    identity:
      String(interval.intervalId ?? '') ||
      [
        'effect-interval',
        interval.effectId,
        interval.actionId,
        interval.targetId,
        interval.startMs,
        interval.endMs,
        serializeIdentity(interval.sourceIdentity),
      ].join('|'),
    actionId: sourceActionId == null ? null : String(sourceActionId),
    effectId: interval.effectId ?? null,
    name: interval.name ?? interval.effectName ?? interval.effectId ?? 'effect',
    ownerId: interval.ownerId ?? interval.sourceActorIds?.[0] ?? null,
    targetKind: interval.targetKind ?? null,
    targetId: interval.targetId ?? null,
    startMs: finiteNumber(interval.startMs) ?? 0,
    endMs: finiteNumber(interval.endMs),
    stacks: finiteNumber(interval.stacks ?? interval.peakStacks),
    status: interval.status ?? null,
    sourceIdentity: interval.sourceIdentity ?? null,
  };
}

function createStateBeforeAfter({ effectEvents, resourceTransactions }) {
  return {
    effects: effectEvents.map(event => ({
      identity: event.identity,
      before: event.before,
      after: event.after,
    })),
    resources: resourceTransactions.map(event => ({
      identity: event.identity,
      before: event.before,
      after: event.after,
    })),
  };
}

function resolveCanonicalEffectIntervals({ trace, effectTimeline }) {
  const canonicalIntervals = asArray(trace.effects?.intervals);
  if (canonicalIntervals.length > 0) {
    const runtimeIntervalsById = mapById(
      effectTimeline?.intervals,
      'intervalId'
    );
    return canonicalIntervals.map(interval => ({
      ...(runtimeIntervalsById.get(String(interval?.intervalId ?? '')) ?? {}),
      ...interval,
    }));
  }
  if (!asArray(effectTimeline?.events).length) return [];
  return projectEffectRuntimeIntervals({
    effectTimeline,
    durationMs: finiteNumber(trace.scenario?.durationMs) ?? 0,
    frameRate: finiteNumber(trace.scenario?.frameRate) ?? 60,
  }).intervals;
}
function createCacheKey({
  traceHash,
  actionResolutions,
  requestedActions,
  effectIntervals,
}) {
  const resolutions = asArray(actionResolutions)
    .map(item =>
      [
        item.actionId,
        item.mappingIdentity,
        asArray(item.availableHitIdentities).join(','),
      ].join(':')
    )
    .join('|');
  const requests = asArray(requestedActions)
    .map(item =>
      [
        item.id,
        item.intent?.publicActionId,
        item.intent?.semanticVariant?.selectorIdentity,
        item.schedule?.mode,
        item.schedule?.frame,
        item.schedule?.offsetFrames,
      ].join(':')
    )
    .join('|');
  const effectLinks = asArray(effectIntervals)
    .map(interval =>
      [
        interval.intervalId,
        interval.sourceActionId,
        ...asArray(interval.sourceActionIds),
      ].join(':')
    )
    .join('|');
  return `${traceHash}|${resolutions}|${requests}|${effectLinks}`;
}

function mapById(values, field = 'id') {
  return new Map(
    asArray(values)
      .filter(item => item?.[field] != null)
      .map(item => [String(item[field]), item])
  );
}

function groupBy(values, selector) {
  const result = new Map();
  for (const value of asArray(values)) {
    const key = selector(value);
    if (key == null) continue;
    const normalized = String(key);
    const rows = result.get(normalized) ?? [];
    rows.push(value);
    result.set(normalized, rows);
  }
  return result;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function rateToBasisPoints(value) {
  const rate = finiteNumber(value);
  return rate == null ? null : clampBasisPoints(Math.round(rate * 10_000));
}

function clampBasisPoints(value) {
  return Math.max(0, Math.min(10_000, Number(value) || 0));
}

function sumNumbers(values, selector) {
  return values.reduce((sum, value) => {
    const number = finiteNumber(selector(value));
    return number == null ? sum : sum + number;
  }, 0);
}

function serializeIdentity(value) {
  if (value == null) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}
