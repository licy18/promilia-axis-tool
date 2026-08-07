import { resolveActionHitWillHit } from '../../domain/actionHitOverrides';
import { getActionSourceSequencePath } from '../../domain/actionSourceSequence';
import { isActionFrameWithinContextualOccupancy } from './actionEffectiveTimeline';
import { resolveVerifiedBattlePropertyTagsForHit } from './verifiedBattlePropertyTags';

export const VERIFIED_DAMAGE_EVENT_GENERATION_CONTRACT_NAME =
  'AzPrVerifiedDamageEventGeneration';

const FRAME_RATE = 60;
const DAMAGE_TUNING_EVENT_KINDS = new Set([
  'held-damage',
  'held-true-damage',
  'overlimit-damage',
  'overlimit-dot-damage',
  'overlimit-true-damage',
]);

export function createVerifiedDamageEventGeneration({
  scenario = {},
  actionExecutionPlan = null,
  actionResolutionById = null,
  tuningGeneration = null,
} = {}) {
  const executionByActionId = new Map(
    (actionExecutionPlan?.actions ?? []).map(entry => [entry.actionId, entry])
  );
  const transactions = [];
  const defaultWillHit =
    (scenario?.combatScenario?.projectile?.defaultWillHit ??
      scenario?.projectile?.defaultWillHit) !== false;

  for (const [actionIndex, action] of (scenario.actions ?? []).entries()) {
    if (executionByActionId.get(action.id)?.execute !== true) continue;
    const resolution = actionResolutionById?.get?.(action.id) ?? null;
    if (resolution?.ready !== true) continue;
    const frameRate = positiveNumber(
      resolution.controlBinding?.frameRate,
      FRAME_RATE
    );
    const actionSequencePath = getActionSourceSequencePath(
      action,
      actionIndex
    ) ?? [actionIndex];
    for (const hit of resolution.hits ?? []) {
      const hitFrame = Number(hit.trigger?.startFrame);
      if (
        !Number.isFinite(hitFrame) ||
        !isActionFrameWithinContextualOccupancy(action, hitFrame, frameRate) ||
        !resolveActionHitWillHit(
          action,
          resolveHitIdentity(hit),
          defaultWillHit
        )
      ) {
        continue;
      }
      const timeMs = roundRuntimeTime(
        Number(action.startMs) + (hitFrame * 1000) / frameRate
      );
      const propertyTagResolution = resolveVerifiedBattlePropertyTagsForHit({
        action,
        resolution,
      });
      transactions.push(
        createDamageTransaction({
          sourceKind: 'ordinary-hit',
          action,
          resolution,
          hit,
          tuningEvent: null,
          timeMs,
          baseSourceSequencePath: [
            ...actionSequencePath,
            Math.max(0, Number(hit.hitIndex) || 0),
          ],
          elementId: finiteIntegerOrNull(
            hit.damage?.elementConfigId ?? hit.elementId
          ),
          elementTypes: uniqueFiniteIntegers(
            hit.damage?.elementTypes ?? hit.damage?.types ?? []
          ),
          damageType: finiteIntegerOrNull(hit.damage?.damageType),
          propertyTags: propertyTagResolution.propertyTags ?? [],
          skillTagIds: resolveSkillTagIds(resolution),
          targetElementIds: [],
          target: {
            kind: 'enemy',
            id: scenario.enemy?.id ?? null,
            name: scenario.enemy?.name ?? null,
          },
          sourceIdentity: hit.sourceIdentity ?? null,
        })
      );
    }
  }

  for (const tuningEvent of tuningGeneration?.combatEvents ?? []) {
    if (
      !DAMAGE_TUNING_EVENT_KINDS.has(tuningEvent.kind) ||
      tuningEvent.eventContext?.landed !== true ||
      executionByActionId.get(tuningEvent.actionId)?.execute !== true
    ) {
      continue;
    }
    const action = tuningEvent.action;
    const resolution = tuningEvent.resolution;
    if (!action || resolution?.ready !== true) continue;
    const eventContext = tuningEvent.eventContext ?? {};
    const baseSourceSequencePath = Array.isArray(
      eventContext.sourceSequencePath
    )
      ? [...eventContext.sourceSequencePath]
      : [Number.MAX_SAFE_INTEGER, transactions.length];
    const propertyTagResolution = resolveVerifiedBattlePropertyTagsForHit({
      action,
      resolution,
    });
    transactions.push(
      createDamageTransaction({
        sourceKind: 'tuning-damage',
        action,
        resolution,
        hit: tuningEvent.sourceHit ?? null,
        tuningEvent,
        timeMs: Number(tuningEvent.timeMs),
        baseSourceSequencePath,
        elementId: finiteIntegerOrNull(
          tuningEvent.template?.elementConfigId ?? eventContext.elementId
        ),
        elementTypes: uniqueFiniteIntegers(
          tuningEvent.template?.elementTypes ?? eventContext.elementTypes ?? []
        ),
        damageType: finiteIntegerOrNull(tuningEvent.template?.damageType),
        propertyTags: [
          ...new Set([
            ...(Array.isArray(eventContext.propertyTags)
              ? eventContext.propertyTags
              : []),
            ...(propertyTagResolution.propertyTags ?? []),
          ]),
        ],
        skillTagIds: uniqueFiniteIntegers(
          eventContext.skillTagIds ?? resolveSkillTagIds(resolution)
        ),
        targetElementIds: uniqueFiniteIntegers(
          eventContext.targetElementIds ?? []
        ),
        target: {
          kind: 'enemy',
          id: scenario.enemy?.id ?? null,
          name: scenario.enemy?.name ?? null,
        },
        sourceIdentity: tuningEvent.sourceIdentity ?? null,
      })
    );
  }

  transactions.sort(compareTransactions);
  const events = transactions.flatMap(transaction => [
    transaction.beforeEvent,
    transaction.afterEvent,
  ]);
  return {
    schemaVersion: 1,
    contractName: VERIFIED_DAMAGE_EVENT_GENERATION_CONTRACT_NAME,
    kind: 'azpr-verified-damage-event-generation',
    status: 'verified-damage-event-generation-ready',
    transactions,
    events,
    beforeDamageEvents: transactions.map(
      transaction => transaction.beforeEvent
    ),
    afterDamageEvents: transactions.map(transaction => transaction.afterEvent),
    summary: {
      transactionCount: transactions.length,
      ordinaryHitTransactionCount: transactions.filter(
        transaction => transaction.sourceKind === 'ordinary-hit'
      ).length,
      tuningDamageTransactionCount: transactions.filter(
        transaction => transaction.sourceKind === 'tuning-damage'
      ).length,
      beforeDamageEventCount: transactions.length,
      afterDamageEventCount: transactions.length,
    },
  };
}

function createDamageTransaction({
  sourceKind,
  action,
  resolution,
  hit,
  tuningEvent,
  timeMs,
  baseSourceSequencePath,
  elementId,
  elementTypes,
  damageType,
  propertyTags,
  skillTagIds,
  targetElementIds,
  target,
  sourceIdentity,
}) {
  const sourceHitIdentity =
    tuningEvent?.eventContext?.sourceHitIdentity ??
    (hit == null ? null : resolveHitIdentity(hit));
  const transactionIdentity =
    sourceKind === 'tuning-damage'
      ? `damage|tuning|${tuningEvent.eventIdentity}`
      : `damage|hit|${action.id}|${sourceHitIdentity}`;
  const settlementSourceSequencePath = [...baseSourceSequencePath, 1];
  const common = {
    transactionIdentity,
    sourceKind,
    timeMs: roundRuntimeTime(timeMs),
    absoluteFrame: Math.round((Number(timeMs) * FRAME_RATE) / 1000),
    sourceActionId: action.id,
    sourceActorId: action.actorId,
    sourceHitIdentity,
    sourceHitIndex: finiteIntegerOrNull(hit?.hitIndex),
    sourceTuningEventIdentity: tuningEvent?.eventIdentity ?? null,
    controlSkillId: finiteIntegerOrNull(
      resolution.actionBinding?.controlSkillId
    ),
    controlSubSkillIndex: finiteIntegerOrNull(
      resolution.actionBinding?.selectedSubSkillIndex ??
        resolution.controlBinding?.selectedSubSkillIndex
    ),
    actionBindingIdentity:
      resolution.actionBinding?.identity ??
      resolution.actionBinding?.semanticIdentity ??
      null,
    skillTagIds: [...skillTagIds],
    propertyTags: [...propertyTags],
    elementId,
    damageElementId: elementId,
    elementTypes: [...elementTypes],
    damageType,
    targetElementIds: [...targetElementIds],
    eventTargetKind: target?.kind ?? null,
    eventTargetId: target?.id == null ? null : String(target.id),
    eventTargetName: target?.name ?? null,
    markId: finiteIntegerOrNull(tuningEvent?.profile?.markId),
    profileKey: tuningEvent?.profile?.key ?? null,
    overlimitPacketElementId: finiteIntegerOrNull(
      tuningEvent?.profile?.overlimitPacket?.elementId
    ),
    judgmentGroupIdentity:
      tuningEvent?.eventContext?.judgmentGroupIdentity ?? null,
    selectedPriorityCandidate:
      tuningEvent?.eventContext?.selectedPriorityCandidate ?? null,
    templateSourceIdentity: tuningEvent?.template?.sourceIdentity ?? null,
    landed: true,
    sourceIdentity,
    settlementSourceSequencePath,
  };
  const beforeEvent = createPhaseEvent({
    common,
    eventId: 1,
    phase: 'before-damage',
    eventKind: 'hit-before-damage',
    sourceSequencePath: [...baseSourceSequencePath, 0],
    hit,
    tuningEvent,
  });
  const afterEvent = createPhaseEvent({
    common,
    eventId: 2,
    phase: 'after-damage',
    eventKind: 'hit-after-damage',
    sourceSequencePath: [...baseSourceSequencePath, 2],
    hit,
    tuningEvent,
  });
  return {
    schemaVersion: 1,
    transactionIdentity,
    sourceKind,
    timeMs: common.timeMs,
    absoluteFrame: common.absoluteFrame,
    sourceActionId: action.id,
    sourceActorId: action.actorId,
    sourceHitIdentity,
    sourceTuningEventIdentity: common.sourceTuningEventIdentity,
    settlementSourceSequencePath,
    baseSourceSequencePath: [...baseSourceSequencePath],
    beforeEvent,
    afterEvent,
    hit,
    tuningEvent,
  };
}

function createPhaseEvent({
  common,
  eventId,
  phase,
  eventKind,
  sourceSequencePath,
  hit,
  tuningEvent,
}) {
  const eventIdentity = `${common.transactionIdentity}|event:${eventId}`;
  const eventContext = {
    ...common,
    eventIdentity,
    eventId,
    phase,
    eventKind,
    sourceSequencePath,
  };
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-verified-damage-trigger-event',
    status: 'verified-damage-trigger-event-ready',
    eventIdentity,
    transactionIdentity: common.transactionIdentity,
    kind: eventKind,
    eventId,
    phase,
    timeMs: common.timeMs,
    absoluteFrame: common.absoluteFrame,
    sourceSequencePath,
    actionId: common.sourceActionId,
    actorId: common.sourceActorId,
    hit,
    tuningEvent,
    eventContext,
    sourceIdentity: common.sourceIdentity,
    applied: true,
  };
}

function resolveHitIdentity(hit) {
  return String(
    hit?.identity ??
      hit?.hitIdentity ??
      hit?.sourceIdentity ??
      `${hit?.elementId ?? 'element'}|${hit?.hitIndex ?? 'hit'}`
  );
}

function resolveSkillTagIds(resolution) {
  return uniqueFiniteIntegers([
    resolution?.controlBinding?.logic?.skillTagId,
    ...parseIntegerList(resolution?.controlBinding?.logic?.skillTag),
  ]);
}

function parseIntegerList(value) {
  if (Array.isArray(value)) return value.map(Number);
  return String(value ?? '')
    .split(/[^\d-]+/u)
    .filter(Boolean)
    .map(Number);
}

function uniqueFiniteIntegers(values) {
  return [...new Set((values ?? []).map(Number).filter(Number.isInteger))];
}

function finiteIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function roundRuntimeTime(value) {
  return Math.round(Number(value) * 1_000_000) / 1_000_000;
}

function compareTransactions(left, right) {
  return (
    left.absoluteFrame - right.absoluteFrame ||
    compareSourceSequencePaths(
      left.baseSourceSequencePath,
      right.baseSourceSequencePath
    )
  );
}

function compareSourceSequencePaths(left, right) {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return left.length - right.length;
}
