import { getActionSourceSequencePath } from '../../domain/actionSourceSequence';
import { EFFECT_TARGET_KINDS } from '../../domain/projectSchema';

export const VERIFIED_NON_DAMAGE_EVENT_GENERATION_CONTRACT_NAME =
  'AzPrVerifiedNonDamageEventGeneration';

const EVENT_BINDINGS = Object.freeze({
  SWITCH_ENTER: Object.freeze({
    eventId: 34,
    kind: 'switch-enter',
    phaseSequenceIndex: 34,
  }),
  AFTER_HEAL: Object.freeze({
    eventId: 44,
    kind: 'heal-after-settlement',
    phaseSequenceIndex: 44,
  }),
  ON_GOT_SHIELD: Object.freeze({
    eventId: 40,
    kind: 'shield-after-acquire',
    phaseSequenceIndex: 40,
  }),
});

export function createVerifiedNonDamageEventGeneration({
  scenario = {},
  actionExecutionPlan = null,
  controlledActorTimeline = null,
  actionResolutionById = null,
  verifiedCombatRuntime = null,
} = {}) {
  const actionById = new Map(
    (scenario.actions ?? []).map(action => [String(action.id), action])
  );
  const actorById = new Map(
    (scenario.actors ?? []).map(actor => [String(actor.id), actor])
  );
  const executionByActionId = new Map(
    (actionExecutionPlan?.actions ?? []).map(entry => [
      String(entry.actionId),
      entry,
    ])
  );
  const events = [];
  const suppressions = [];
  const seenTransactionIdentities = new Set();

  for (const transition of controlledActorTimeline?.transitions ?? []) {
    if (transition.applied !== true) continue;
    const action = actionById.get(String(transition.actionId));
    if (!action || executionByActionId.get(String(action.id))?.execute === false) {
      continue;
    }
    const enteredActorId = String(
      transition.afterActor?.actorId ?? transition.targetActor?.actorId ?? ''
    );
    if (!actorById.has(enteredActorId)) continue;
    appendCanonicalEvent({
      events,
      suppressions,
      seenTransactionIdentities,
      event: createSwitchEnterEvent({ action, transition, enteredActorId }),
    });
  }

  for (const vitalEvent of verifiedCombatRuntime?.vitalEvents ?? []) {
    const projection = createVitalEventProjection({
      vitalEvent,
      actionById,
      actorById,
      executionByActionId,
      actionResolutionById,
    });
    if (projection.event) {
      appendCanonicalEvent({
        events,
        suppressions,
        seenTransactionIdentities,
        event: projection.event,
      });
    } else if (projection.suppression) {
      suppressions.push(projection.suppression);
    }
  }

  events.sort(compareNonDamageEvents);
  return {
    schemaVersion: 1,
    contractName: VERIFIED_NON_DAMAGE_EVENT_GENERATION_CONTRACT_NAME,
    sourceKind: 'azpr-verified-non-damage-event-generation',
    status: 'verified-non-damage-event-generation-ready',
    events,
    suppressions,
    summary: {
      eventCount: events.length,
      switchEnterEventCount: countKind(events, EVENT_BINDINGS.SWITCH_ENTER.kind),
      afterHealEventCount: countKind(events, EVENT_BINDINGS.AFTER_HEAL.kind),
      onGotShieldEventCount: countKind(
        events,
        EVENT_BINDINGS.ON_GOT_SHIELD.kind
      ),
      rejectedEventCount: suppressions.length,
      applied: true,
    },
    applied: true,
  };
}

function createSwitchEnterEvent({ action, transition, enteredActorId }) {
  const binding = EVENT_BINDINGS.SWITCH_ENTER;
  const timeMs = Number(transition.timeMs ?? action.startMs);
  const absoluteFrame = Number.isInteger(transition.frameIndex)
    ? transition.frameIndex
    : toFrame(timeMs);
  const sourceSequencePath = createEventSourceSequencePath(
    action,
    binding.phaseSequenceIndex,
    0
  );
  const transactionIdentity = `non-damage|switch-enter|${transition.transitionId ?? action.id}`;
  return createEvent({
    binding,
    transactionIdentity,
    timeMs,
    absoluteFrame,
    sourceSequencePath,
    sourceActionId: action.id,
    sourceActorId: enteredActorId,
    triggerSubjectActorId: enteredActorId,
    eventTargetActorId: null,
    sourceResolution: null,
    actionProvenanceAvailable: false,
    sourceDescriptorIdentity: transition.transitionId ?? null,
    settlement: {
      before: transition.beforeActor?.actorId ?? null,
      requestedChange: enteredActorId,
      actualChange: enteredActorId,
      after: enteredActorId,
      outcome: 'controlled-actor-switch-applied',
    },
  });
}

function createVitalEventProjection({
  vitalEvent,
  actionById,
  actorById,
  executionByActionId,
  actionResolutionById,
}) {
  const binding = resolveVitalEventBinding(vitalEvent);
  if (!binding) return { event: null, suppression: null };
  const payload = vitalEvent.payload ?? {};
  const action = actionById.get(String(vitalEvent.actionId));
  const actionProvenanceAvailable =
    payload.actionProvenanceAvailable !== false;
  if (
    actionProvenanceAvailable &&
    (!action || executionByActionId.get(String(action.id))?.execute !== true)
  ) {
    return {
      event: null,
      suppression: createSuppression(
        vitalEvent,
        'non-damage-event-source-action-not-executed'
      ),
    };
  }
  if (payload.initialState === true) {
    return {
      event: null,
      suppression: createSuppression(
        vitalEvent,
        'non-damage-event-initial-state-not-dispatched'
      ),
    };
  }
  const zeroEffectiveHealDispatch =
    binding.eventId === EVENT_BINDINGS.AFTER_HEAL.eventId &&
    payload.afterHealDispatchEligible === true;
  if (
    payload.appliedToCalculators !== true ||
    (payload.applied === false && !zeroEffectiveHealDispatch) ||
    payload.reason?.includes?.('rejected')
  ) {
    return {
      event: null,
      suppression: createSuppression(
        vitalEvent,
        'non-damage-event-settlement-not-applied'
      ),
    };
  }
  const targetActorId = String(vitalEvent.targetId ?? '');
  if (
    payload.targetKind !== EFFECT_TARGET_KINDS.ACTOR ||
    !actorById.has(targetActorId)
  ) {
    return {
      event: null,
      suppression: createSuppression(
        vitalEvent,
        'non-damage-event-target-not-friendly-actor'
      ),
    };
  }
  const actualChange = Number(payload.change);
  if (
    binding.eventId === EVENT_BINDINGS.ON_GOT_SHIELD.eventId &&
    !(actualChange > 0)
  ) {
    return {
      event: null,
      suppression: createSuppression(
        vitalEvent,
        'non-damage-event-zero-shield-not-dispatched'
      ),
    };
  }
  const sourceActorId = String(
    payload.sourceActorId ?? vitalEvent.actorId ?? action?.actorId ?? ''
  );
  const triggerSubjectActorId =
    binding.eventId === EVENT_BINDINGS.ON_GOT_SHIELD.eventId
      ? targetActorId
      : sourceActorId;
  if (!actorById.has(triggerSubjectActorId)) {
    return {
      event: null,
      suppression: createSuppression(
        vitalEvent,
        'non-damage-event-subject-not-friendly-actor'
      ),
    };
  }
  const sourceResolution = action && actionProvenanceAvailable
    ? (actionResolutionById?.get?.(action.id) ?? null)
    : null;
  const sourceEventIdentity =
    payload.sourceEventIdentity ??
    `${vitalEvent.type}|${vitalEvent.actionId ?? 'no-action'}|${targetActorId}|${vitalEvent.timeMs}|${vitalEvent.runtimeSequenceIndex ?? 0}`;
  const transactionIdentity = `non-damage|${sourceEventIdentity}`;
  const sourceSequencePath = createEventSourceSequencePath(
    action,
    binding.phaseSequenceIndex,
    Number(vitalEvent.runtimeSequenceIndex) || 0
  );
  return {
    event: createEvent({
      binding,
      transactionIdentity,
      timeMs: Number(vitalEvent.timeMs),
      absoluteFrame: Number.isInteger(vitalEvent.absoluteFrame)
        ? vitalEvent.absoluteFrame
        : toFrame(vitalEvent.timeMs),
      sourceSequencePath,
      sourceActionId: action?.id ?? vitalEvent.actionId ?? null,
      sourceActorId,
      triggerSubjectActorId,
      eventTargetActorId: targetActorId,
      sourceResolution,
      actionProvenanceAvailable,
      sourceDescriptorIdentity: sourceEventIdentity,
      settlement: {
        before: payload.before ?? payload.beforeValue ?? null,
        requestedChange: payload.requestedChange ?? null,
        actualChange: payload.change ?? null,
        after: payload.after ?? payload.afterValue ?? null,
        maximum: payload.maximum ?? payload.maxValue ?? null,
        outcome:
          binding.eventId === EVENT_BINDINGS.AFTER_HEAL.eventId
            ? actualChange > 0
              ? 'heal-applied'
              : 'heal-executed-zero-effective-change'
            : 'shield-acquired',
      },
    }),
    suppression: null,
  };
}

function createEvent({
  binding,
  transactionIdentity,
  timeMs,
  absoluteFrame,
  sourceSequencePath,
  sourceActionId,
  sourceActorId,
  triggerSubjectActorId,
  eventTargetActorId,
  sourceResolution,
  actionProvenanceAvailable,
  sourceDescriptorIdentity,
  settlement,
}) {
  const actionContext = projectActionContext(sourceResolution);
  const eventIdentity = `${transactionIdentity}:event:${binding.eventId}`;
  const eventContext = {
    eventIdentity,
    transactionIdentity,
    eventId: binding.eventId,
    eventKind: binding.kind,
    phase: binding.kind,
    timeMs,
    absoluteFrame,
    sourceSequencePath,
    sourceActionId,
    sourceActorId,
    triggerSubjectActorId,
    eventTargetActorId,
    sourceControlSkillId: actionContext.controlSkillId,
    sourceSubSkillIndex: actionContext.subSkillIndex,
    actionBindingIdentity: actionContext.actionBindingIdentity,
    actionProvenanceAvailable,
    actionKind: actionContext.actionKind,
    skillSlotIds: actionContext.skillSlotIds,
    skillTagIds: actionContext.skillTagIds,
    sourceDescriptorIdentity,
    before: settlement.before,
    requestedChange: settlement.requestedChange,
    actualChange: settlement.actualChange,
    after: settlement.after,
    maximum: settlement.maximum ?? null,
    outcome: settlement.outcome,
    applied: true,
    success: true,
    initialState: false,
  };
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-verified-non-damage-event',
    status: 'verified-non-damage-event-applied',
    eventIdentity,
    transactionIdentity,
    eventId: binding.eventId,
    kind: binding.kind,
    timeMs,
    absoluteFrame,
    sourceSequencePath,
    actionId: sourceActionId,
    actorId: sourceActorId,
    targetId: eventTargetActorId,
    eventContext,
    appliedToCalculators: true,
    applied: true,
  };
}

function resolveVitalEventBinding(vitalEvent) {
  if (
    vitalEvent?.type === 'VERIFIED_DIRECT_HEAL' ||
    vitalEvent?.type === 'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL' ||
    vitalEvent?.type === 'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL_SUPPRESSED' ||
    vitalEvent?.type === 'VERIFIED_TUNING_PERIODIC_HEAL'
  ) {
    return EVENT_BINDINGS.AFTER_HEAL;
  }
  if (vitalEvent?.type === 'VERIFIED_DIRECT_SHIELD') {
    return EVENT_BINDINGS.ON_GOT_SHIELD;
  }
  return null;
}

function projectActionContext(resolution) {
  const actionBinding = resolution?.actionBinding ?? {};
  const controlBinding = resolution?.controlBinding ?? {};
  return {
    actionBindingIdentity:
      actionBinding.identity ?? actionBinding.semanticIdentity ?? null,
    actionKind: actionBinding.actionKind ?? null,
    controlSkillId:
      numberOrNull(controlBinding.controlSkillId) ??
      numberOrNull(actionBinding.controlSkillId),
    subSkillIndex:
      numberOrNull(resolution?.selection?.subSkillIndex) ??
      numberOrNull(actionBinding.selectedSubSkillIndex),
    skillSlotIds: uniqueNumbers([
      actionBinding.skillSlotId,
      actionBinding.skillSlotType,
    ]),
    skillTagIds: uniqueNumbers([
      controlBinding.logic?.skillTagId,
      ...parseDelimitedNumbers(controlBinding.logic?.skillTag),
    ]),
  };
}

function appendCanonicalEvent({
  events,
  suppressions,
  seenTransactionIdentities,
  event,
}) {
  if (seenTransactionIdentities.has(event.transactionIdentity)) {
    suppressions.push({
      transactionIdentity: event.transactionIdentity,
      actionId: event.actionId,
      reason: 'non-damage-event-duplicate',
    });
    return;
  }
  seenTransactionIdentities.add(event.transactionIdentity);
  events.push(event);
}

function createSuppression(vitalEvent, reason) {
  return {
    actionId: vitalEvent.actionId ?? null,
    actorId: vitalEvent.actorId ?? null,
    targetId: vitalEvent.targetId ?? null,
    sourceEventIdentity: vitalEvent.payload?.sourceEventIdentity ?? null,
    reason,
  };
}

function createEventSourceSequencePath(action, phaseSequenceIndex, localIndex) {
  const sourcePath = getActionSourceSequencePath(action) ?? [
    Number.MAX_SAFE_INTEGER,
  ];
  return [...sourcePath, phaseSequenceIndex, localIndex];
}

function compareNonDamageEvents(left, right) {
  return (
    Number(left.absoluteFrame) - Number(right.absoluteFrame) ||
    compareNumberArrays(left.sourceSequencePath, right.sourceSequencePath) ||
    String(left.eventIdentity).localeCompare(String(right.eventIdentity))
  );
}

function compareNumberArrays(left, right) {
  const length = Math.max(left?.length ?? 0, right?.length ?? 0);
  for (let index = 0; index < length; index += 1) {
    const delta = Number(left?.[index] ?? -1) - Number(right?.[index] ?? -1);
    if (delta !== 0) return delta;
  }
  return 0;
}

function parseDelimitedNumbers(value) {
  return String(value ?? '')
    .split(/[|,;\s]+/u)
    .filter(token => token.length > 0)
    .map(Number)
    .filter(Number.isFinite);
}

function uniqueNumbers(values) {
  return [...new Set(values.map(Number).filter(Number.isFinite))].sort(
    (left, right) => left - right
  );
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toFrame(timeMs) {
  return Math.round((Number(timeMs) * 60) / 1000);
}

function countKind(events, kind) {
  return events.filter(event => event.kind === kind).length;
}
