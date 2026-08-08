import {
  getInstalledVerifiedCombatMechanicsPackage,
  resolveVerifiedCombatActionMechanics,
} from '../../data/verifiedCombatMechanicsPackage';
import { ACTION_TYPES } from '../../domain/projectSchema';
import { resolveControlledActorAt } from '../runtime/controlledActorTimeline';
import { resolveActiveEffectsAt } from '../runtime/effectRuntimeTimeline';
import { EFFECT_TARGET_KINDS } from '../../domain/projectSchema';
import { createCombatSourceDisplayLabel } from '../../domain/sourceDisplayText';
import {
  calculateAutoSp,
  calculateHitSp,
  calculateBreakWeakness,
  calculateNormalDamage,
  calculateNormalWeaknessRecovery,
  calculateRealDamage,
  calculateStackOverLimitDamage,
  calculateWeaknessDamage,
  isCriticalHit,
  qFromFloat,
  qFromInt,
  qMul,
  qToNumber,
  runtimeIntegerize,
  tuningMarkBaseRaw,
} from './verifiedCombatFormulaRuntime';
import { isActionFrameWithinContextualOccupancy } from './actionEffectiveTimeline';
import {
  ACTION_HIT_CRITICAL_POLICIES,
  COMBAT_CRITICAL_POLICIES,
  calculateEffectiveCriticalThresholdBasisPoints,
  resolveActionHitCriticalPolicy,
} from '../../domain/combatCriticalPolicy';
import { createCriticalSampleKey } from '../runtime/criticalRandomSource';
import {
  compareSourceSequencePaths,
  getActionSourceSequencePath,
} from '../../domain/actionSourceSequence';
import {
  matchesVerifiedBattlePropertyTags,
  resolveVerifiedBattlePropertyTagsForHit,
} from './verifiedBattlePropertyTags';

export const VERIFIED_COMBAT_MECHANICS_PROFILE_ID =
  'azpr-three-value-verified-tc-20260718';
export const VERIFIED_COMBAT_RUNTIME_CONTRACT_NAME =
  'AzPrVerifiedCombatRuntime';

const DERIVED_DOT_SELF_HEAL_MECHANISM_FAMILY =
  'on-kibo-damage-derived-dot-and-self-heal';

const FIXED_STEP_MS = 100;
const FRAME_RATE = 60;
const ELEMENT_DAMAGE_ATTRIBUTE_ID_BY_TYPE = Object.freeze({
  0: 51,
  1: 52,
  2: 53,
  3: 54,
  4: 55,
  5: 56,
  6: 57,
  7: 58,
  8: 59,
  9: 60,
});
const WEAKNESS_SKILL_ATTRIBUTE_KEY_BY_ACTION_KIND = Object.freeze({
  'charged-attack': 'WDM_TAG_HEAVYATTACK',
});

export function isVerifiedCombatMechanicsScenario(scenario) {
  return (
    scenario?.mechanicsProfile?.profileId ===
    VERIFIED_COMBAT_MECHANICS_PROFILE_ID
  );
}

export function createVerifiedCombatRuntime({
  scenario,
  actionExecutionPlan,
  controlledActorTimeline,
  effectGeneration = null,
  tuningGeneration = null,
  effectTimeline = null,
  actionVariantRuntime = null,
  kiboPassiveGeneration = null,
  damageEventGeneration = null,
  criticalRandomSource = null,
  runtimeMode = 'full',
} = {}) {
  const enabled = isVerifiedCombatMechanicsScenario(scenario);
  const mechanicsPackage = getInstalledVerifiedCombatMechanicsPackage();
  if (!enabled || !mechanicsPackage) {
    return createUnavailableRuntime({
      enabled,
      reason: enabled
        ? 'verified-combat-mechanics-package-not-installed'
        : 'verified-combat-profile-not-selected',
    });
  }

  const executionByActionId = new Map(
    (actionExecutionPlan?.actions ?? []).map(entry => [entry.actionId, entry])
  );
  const nonDamageProjectionOnly = runtimeMode === 'non-damage-event-projection';
  const actionResolutionById = new Map();
  const ordinaryDamageTransactionByKey = new Map(
    (damageEventGeneration?.transactions ?? [])
      .filter(transaction => transaction.sourceKind === 'ordinary-hit')
      .map(transaction => [
        `${transaction.sourceActionId}|${transaction.sourceHitIdentity}`,
        transaction,
      ])
  );
  const tuningDamageTransactionByIdentity = new Map(
    (damageEventGeneration?.transactions ?? [])
      .filter(transaction => transaction.sourceKind === 'tuning-damage')
      .map(transaction => [
        String(transaction.sourceTuningEventIdentity),
        transaction,
      ])
  );
  const conditionalDamageTransactionByIdentity = new Map(
    (damageEventGeneration?.transactions ?? [])
      .filter(transaction => transaction.sourceKind === 'conditional-hit')
      .map(transaction => [
        String(transaction.sourceTuningEventIdentity),
        transaction,
      ])
  );
  const descriptors = [];
  for (const action of scenario?.actions ?? []) {
    if (executionByActionId.get(action.id)?.execute === false) continue;
    if (action.type === ACTION_TYPES.RESOURCE) {
      descriptors.push({
        kind: 'manual-resource',
        timeMs: action.startMs,
        action,
      });
      continue;
    }
    if (![ACTION_TYPES.SKILL, ACTION_TYPES.KIBO_EVENT].includes(action.type)) {
      continue;
    }
    const resolution =
      actionVariantRuntime?.actionResolutionById?.get(action.id) ??
      effectGeneration?.actionResolutionById?.get(action.id) ??
      resolveVerifiedCombatActionMechanics(action, {
        combatScenario: scenario.combatScenario,
      });
    actionResolutionById.set(action.id, resolution);
    if (!resolution.ready) continue;
    const spCost = numberOrNull(
      resolution.controlBinding?.logic?.spCost ??
        resolution.controlBinding?.logic?.spCostRaw ??
        resolution.controlBinding?.logic?.spCostPercent
    );
    if (spCost == null || spCost > 0) {
      descriptors.push({
        kind: 'action-cost',
        timeMs: action.startMs,
        action,
        resolution,
        spCost,
      });
    }
    for (const hit of resolution.hits) {
      const frameRate = positiveNumber(
        resolution.controlBinding.frameRate,
        FRAME_RATE
      );
      if (
        !isActionFrameWithinContextualOccupancy(
          action,
          hit.trigger.startFrame,
          frameRate
        )
      ) {
        continue;
      }
      descriptors.push({
        kind: 'hit',
        timeMs:
          Number(action.startMs) +
          (Number(hit.trigger.startFrame) * 1000) / frameRate,
        action,
        resolution,
        hit,
        damageEventTransaction: ordinaryDamageTransactionByKey.get(
          `${action.id}|${resolveCriticalHitIdentity(hit)}`
        ),
      });
    }
  }

  for (const directSpEvent of effectGeneration?.directSpEvents ?? []) {
    descriptors.push({
      kind: 'direct-sp',
      timeMs: directSpEvent.timeMs,
      action: directSpEvent.action,
      directEvent: directSpEvent,
    });
  }
  for (const directHpEvent of effectGeneration?.directHpEvents ?? []) {
    descriptors.push({
      kind: 'direct-heal',
      timeMs: directHpEvent.timeMs,
      action: directHpEvent.action,
      directEvent: directHpEvent,
    });
  }
  for (const shieldEvent of effectGeneration?.shieldEvents ?? []) {
    descriptors.push({
      kind: 'direct-shield',
      timeMs: shieldEvent.timeMs,
      action: shieldEvent.action,
      directEvent: shieldEvent,
    });
  }
  for (const tuningEvent of tuningGeneration?.combatEvents ?? []) {
    if (tuningEvent.kind === 'conditional-damage') {
      descriptors.push({
        kind: 'hit',
        timeMs: tuningEvent.timeMs,
        action: tuningEvent.action,
        resolution: tuningEvent.resolution,
        hit: tuningEvent.sourceHit,
        conditionalDamageEvent: tuningEvent,
        damageEventTransaction: conditionalDamageTransactionByIdentity.get(
          String(tuningEvent.eventIdentity)
        ),
      });
      continue;
    }
    descriptors.push({
      kind: 'tuning-combat',
      timeMs: tuningEvent.timeMs,
      action: tuningEvent.action,
      tuningEvent,
      damageEventTransaction: tuningDamageTransactionByIdentity.get(
        String(tuningEvent.eventIdentity)
      ),
    });
  }
  for (const command of kiboPassiveGeneration?.derivedDamageCommands ?? []) {
    if (command.retaliationEventIdentity != null) {
      descriptors.push({
        kind: 'passive-retaliation-hit',
        timeMs: command.timeMs,
        action: null,
        resolution: null,
        hit: command.hit,
        passiveRetaliationCommand: command,
      });
      continue;
    }
    const action = (scenario?.actions ?? []).find(
      item => item.id === command.sourceActionId
    );
    const resolution = actionResolutionById.get(command.sourceActionId);
    if (!action || !resolution?.ready) continue;
    descriptors.push({
      kind: 'passive-derived-hit',
      timeMs: command.timeMs,
      action,
      resolution,
      hit: command.hit,
      passiveDerivedDamageCommand: command,
    });
  }
  for (const command of kiboPassiveGeneration?.vitalChangeCommands ?? []) {
    const action = (scenario?.actions ?? []).find(
      item => item.id === command.sourceActionId
    );
    const resolution = actionResolutionById.get(command.sourceActionId);
    if (!action || !resolution?.ready) continue;
    descriptors.push({
      kind: 'passive-vital-change',
      timeMs: command.timeMs,
      action,
      resolution,
      passiveVitalChangeCommand: command,
    });
  }
  for (const schedule of kiboPassiveGeneration?.periodicVitalSchedules ?? []) {
    descriptors.push(
      ...createPeriodicVitalDescriptors({
        schedule,
        durationMs: nonNegativeNumber(scenario?.time?.durationMs),
        frameRate: positiveNumber(
          scenario?.time?.fps ?? scenario?.time?.frameRate,
          FRAME_RATE
        ),
      })
    );
  }

  const durationMs = nonNegativeNumber(scenario?.time?.durationMs);
  for (
    let timeMs = FIXED_STEP_MS;
    timeMs <= durationMs;
    timeMs += FIXED_STEP_MS
  ) {
    descriptors.push({ kind: 'weakness-state-tick', timeMs });
    descriptors.push({ kind: 'auto-sp-tick', timeMs });
  }
  annotatePeriodicVitalOrderConflicts({
    descriptors,
    controlledActorTimeline,
  });
  annotateRuntimeDescriptorOrder(
    descriptors,
    positiveNumber(scenario?.time?.fps ?? scenario?.time?.frameRate, FRAME_RATE)
  );
  descriptors.sort(compareDescriptors);

  const state = createRuntimeState({
    scenario,
    mechanicsPackage,
    effectTimeline,
  });
  const initialState = createFinalState(state, 0);
  const damageEvents = [];
  const resourceEvents = [];
  const kiboResourceEvents = [];
  const vitalEvents = [];
  const eventLog = [];
  const hitRecoveryAtByIdentity = new Map();
  const executionBlocks = [...(actionVariantRuntime?.executionBlocks ?? [])];
  const blockedActionIds = new Set(
    executionBlocks.map(block => block.actionId)
  );
  eventLog.push(...(actionVariantRuntime?.eventLog ?? []));

  for (const descriptor of descriptors) {
    if (descriptor.timeMs > durationMs) continue;
    if (
      descriptor.action?.id &&
      blockedActionIds.has(descriptor.action.id) &&
      descriptor.kind !== 'action-cost'
    ) {
      continue;
    }
    if (
      isDirectEffectDescriptor(descriptor) &&
      (!Array.isArray(descriptor.sourceSequencePath) ||
        descriptor.directEvent?.applied !== true)
    ) {
      eventLog.push(
        createDirectEffectSourceSequenceUnresolvedEvent(descriptor)
      );
      continue;
    }
    if (
      nonDamageProjectionOnly &&
      !isNonDamageProjectionDescriptor(descriptor)
    ) {
      continue;
    }
    if (shouldTruncateEnemySettlement({ descriptor, state })) {
      appendRuntimeEvent(
        eventLog,
        createEnemySettlementTruncatedEvent({ descriptor, state }),
        state
      );
      continue;
    }
    if (descriptor.kind === 'manual-resource') {
      applyManualResourceDescriptor({ descriptor, state, resourceEvents });
      continue;
    }
    if (descriptor.kind === 'action-cost') {
      const executionBlock = applyActionCostDescriptor({
        descriptor,
        state,
        resourceEvents,
        kiboResourceEvents,
      });
      if (executionBlock) {
        blockedActionIds.add(descriptor.action.id);
        executionBlocks.push(executionBlock);
        eventLog.push(createResourceExecutionBlockedEvent(executionBlock));
      }
      continue;
    }
    if (descriptor.kind === 'weakness-state-tick') {
      const stateEvent = applyWeaknessStateDescriptor({
        descriptor,
        scenario,
        state,
      });
      if (stateEvent) {
        appendRuntimeEvent(damageEvents, stateEvent, state);
        eventLog.push(stateEvent);
      }
      continue;
    }
    if (descriptor.kind === 'auto-sp-tick') {
      applyAutoSpDescriptor({
        descriptor,
        controlledActorTimeline,
        state,
        resourceEvents,
        kiboResourceEvents,
      });
      continue;
    }
    if (descriptor.kind === 'direct-sp') {
      applyDirectSpDescriptor({
        descriptor,
        state,
        resourceEvents,
        kiboResourceEvents,
      });
      continue;
    }
    if (descriptor.kind === 'direct-heal') {
      const event = applyDirectHealDescriptor({ descriptor, state });
      if (event) {
        appendRuntimeEvent(vitalEvents, event, state);
        eventLog.push(event);
      }
      continue;
    }
    if (descriptor.kind === 'passive-vital-change') {
      const event = applyKiboPassiveVitalChangeDescriptor({
        descriptor,
        state,
      });
      appendRuntimeEvent(vitalEvents, event, state);
      eventLog.push(event);
      continue;
    }
    if (descriptor.kind === 'direct-shield') {
      const event = applyDirectShieldDescriptor({ descriptor, state });
      if (event) {
        appendRuntimeEvent(vitalEvents, event, state);
        eventLog.push(event);
      }
      continue;
    }
    if (descriptor.kind === 'passive-periodic-heal') {
      const event = applyKiboPassivePeriodicHealDescriptor({
        descriptor,
        scenario,
        state,
      });
      if (event) {
        appendRuntimeEvent(vitalEvents, event, state);
        eventLog.push(event);
      }
      continue;
    }
    if (descriptor.kind === 'passive-periodic-heal-contract-unresolved') {
      const event = createKiboPassivePeriodicHealEvent({
        descriptor,
        schedule: descriptor.schedule,
        applied: false,
        reason: 'periodic-heal-schedule-contract-unresolved',
        payload: {
          ...createKiboPassivePeriodicHealPayload({
            descriptor,
            schedule: descriptor.schedule,
          }),
          unresolvedReasons: descriptor.unresolvedReasons,
          appliedToCalculators: false,
        },
      });
      appendRuntimeEvent(vitalEvents, event, state);
      eventLog.push(event);
      continue;
    }
    if (descriptor.kind === 'passive-derived-dot') {
      const event = applyKiboPassiveDerivedDotDescriptor({
        descriptor,
        state,
      });
      appendRuntimeEvent(damageEvents, event, state);
      eventLog.push(event);
      continue;
    }
    if (descriptor.kind === 'passive-retaliation-hit') {
      const hitResult = applyKiboPassiveRetaliationHitDescriptor({
        descriptor,
        scenario,
        state,
      });
      if (!hitResult.ready) {
        eventLog.push({
          type: 'VERIFIED_COMBAT_HIT_UNRESOLVED',
          timeMs: descriptor.timeMs,
          actionId: null,
          actorId: descriptor.passiveRetaliationCommand?.sourceActorId ?? null,
          payload: hitResult,
        });
        continue;
      }
      appendRuntimeEvent(damageEvents, hitResult.damageEvent, state);
      eventLog.push(hitResult.damageEvent);
      continue;
    }
    if (descriptor.kind === 'passive-derived-self-heal') {
      const event = applyKiboPassiveDerivedSelfHealDescriptor({
        descriptor,
        state,
      });
      appendRuntimeEvent(vitalEvents, event, state);
      eventLog.push(event);
      continue;
    }
    if (descriptor.kind === 'passive-derived-periodic-contract-unresolved') {
      const event = createKiboPassiveDerivedPeriodicUnresolvedEvent(descriptor);
      appendRuntimeEvent(vitalEvents, event, state);
      eventLog.push(event);
      continue;
    }
    if (['hit', 'passive-derived-hit'].includes(descriptor.kind)) {
      const hitRecoveryEligibility =
        descriptor.kind === 'hit'
          ? resolveVerifiedHitRecoveryEligibility(descriptor)
          : null;
      if (nonDamageProjectionOnly && descriptor.kind === 'hit') {
        if (hitRecoveryEligibility.eligible) {
          applyHitRecovery({
            descriptor,
            hitResult: {
              hitKey: createVerifiedCombatHitKey(descriptor),
            },
            hitRecoveryEligibility,
            damageSettlement: {
              status: 'not-evaluated-in-non-damage-projection',
              reason: null,
            },
            state,
            hitRecoveryAtByIdentity,
            resourceEvents,
            kiboResourceEvents,
          });
        }
        continue;
      }
      const hitResult = applyHitDescriptor({
        descriptor,
        scenario,
        state,
        criticalRandomSource,
      });
      if (!hitResult.ready) {
        eventLog.push({
          type: 'VERIFIED_COMBAT_HIT_UNRESOLVED',
          timeMs: descriptor.timeMs,
          actionId: descriptor.action.id,
          actorId: descriptor.action.actorId,
          payload: hitResult,
        });
        if (descriptor.kind === 'hit' && hitRecoveryEligibility.eligible) {
          applyHitRecovery({
            descriptor,
            hitResult: {
              hitKey: createVerifiedCombatHitKey(descriptor),
            },
            hitRecoveryEligibility,
            damageSettlement: {
              status: 'unresolved',
              reason: hitResult.reason ?? hitResult.status ?? null,
            },
            state,
            hitRecoveryAtByIdentity,
            resourceEvents,
            kiboResourceEvents,
          });
        }
        continue;
      }
      appendRuntimeEvent(damageEvents, hitResult.damageEvent, state);
      eventLog.push(hitResult.damageEvent);
      if (descriptor.kind === 'hit') {
        applyHitRecovery({
          descriptor,
          hitResult,
          hitRecoveryEligibility,
          state,
          hitRecoveryAtByIdentity,
          resourceEvents,
          kiboResourceEvents,
        });
      }
      continue;
    }
    if (descriptor.kind === 'tuning-combat') {
      const tuningResult = applyTuningCombatDescriptor({
        descriptor,
        scenario,
        state,
        controlledActorTimeline,
        resourceEvents,
      });
      if (tuningResult?.damageEvent) {
        appendRuntimeEvent(damageEvents, tuningResult.damageEvent, state);
        eventLog.push(tuningResult.damageEvent);
      }
      if (tuningResult?.event) {
        if (tuningResult.event.type === 'VERIFIED_TUNING_PERIODIC_HEAL') {
          appendRuntimeEvent(vitalEvents, tuningResult.event, state);
        }
        eventLog.push(tuningResult.event);
      }
    }
  }

  resourceEvents.sort(compareEvents);
  kiboResourceEvents.sort(compareEvents);
  vitalEvents.sort(compareEvents);
  damageEvents.sort(compareEvents);
  eventLog.push(...resourceEvents, ...kiboResourceEvents);
  eventLog.sort(compareEvents);
  const resolutions = [...actionResolutionById.values()];
  return {
    schemaVersion: 1,
    contractName: VERIFIED_COMBAT_RUNTIME_CONTRACT_NAME,
    sourceKind: 'azpr-verified-combat-runtime-from-generation-bindings',
    runtimeMode,
    status: 'verified-combat-runtime-ready',
    packageId: mechanicsPackage.packageId,
    packageHash: mechanicsPackage.packageHash,
    enabled: true,
    ready: true,
    actionResolutionById,
    actionResolutions: resolutions,
    damageEvents,
    resourceEvents,
    kiboResourceEvents,
    vitalEvents,
    eventLog,
    executionBlocks,
    effectGeneration,
    tuningGeneration,
    kiboPassiveGeneration,
    tuningMarkRuntime: tuningGeneration
      ? {
          events: tuningGeneration.events,
          initialState: tuningGeneration.initialState,
          finalState: tuningGeneration.finalState,
          unresolved: tuningGeneration.unresolved,
          summary: tuningGeneration.summary,
        }
      : null,
    actionVariantRuntime,
    specialResourceRuntime: actionVariantRuntime,
    effectTimeline,
    initialState,
    finalState: createFinalState(state, durationMs),
    summary: {
      actionResolutionCount: resolutions.length,
      readyActionResolutionCount: resolutions.filter(item => item.ready).length,
      unresolvedActionResolutionCount: resolutions.filter(item => !item.ready)
        .length,
      damageEventCount: damageEvents.length,
      hitEventCount: damageEvents.filter(
        event => event.type === 'VERIFIED_COMBAT_HIT'
      ).length,
      kiboPassiveDerivedDamageEventCount: damageEvents.filter(
        event => event.payload.kiboPassiveDerivedDamage === true
      ).length,
      toughnessStateEventCount: damageEvents.filter(
        event => event.type === 'VERIFIED_TOUGHNESS_STATE_CHANGE'
      ).length,
      normalRecoveryEventCount: damageEvents.filter(
        event => event.payload.stateEventKind === 'normal-toughness-recovery'
      ).length,
      breakRecoveryEventCount: damageEvents.filter(event =>
        ['break-linear-recovery', 'break-end-wait'].includes(
          event.payload.stateEventKind
        )
      ).length,
      breakExitCount: damageEvents.filter(
        event => event.payload.stateEventKind === 'break-exit'
      ).length,
      resourceEventCount: resourceEvents.length,
      kiboResourceEventCount: kiboResourceEvents.length,
      vitalEventCount: vitalEvents.length,
      kiboPassivePeriodicHealEventCount: vitalEvents.filter(
        event => event.type === 'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL'
      ).length,
      kiboPassivePeriodicHealSuppressedEventCount: vitalEvents.filter(
        event => event.type === 'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL_SUPPRESSED'
      ).length,
      kiboPassiveVitalDamageEventCount: vitalEvents.filter(
        event => event.type === 'VERIFIED_KIBO_PASSIVE_VITAL_DAMAGE'
      ).length,
      kiboPassiveVitalDamageSuppressedEventCount: vitalEvents.filter(
        event => event.type === 'VERIFIED_KIBO_PASSIVE_VITAL_DAMAGE_SUPPRESSED'
      ).length,
      breakTriggerCount: damageEvents.filter(
        event => event.payload.breakState?.triggered
      ).length,
      shieldedHitCount: damageEvents.filter(
        event => event.payload.shieldState?.absorbed > 0
      ).length,
      enemySettlementTruncatedCount: eventLog.filter(
        event => event.type === 'VERIFIED_ENEMY_SETTLEMENT_TRUNCATED'
      ).length,
      resourceBlockedActionCount: executionBlocks.length,
      specialResourceEventCount:
        actionVariantRuntime?.summary?.resourceEventCount ?? 0,
      changedVariantCount:
        actionVariantRuntime?.summary?.changedVariantCount ?? 0,
      generatedEffectCommandCount:
        effectGeneration?.summary?.effectCommandCount ?? 0,
      directSpEventCount: effectGeneration?.summary?.directSpEventCount ?? 0,
      tuningMarkEventCount: tuningGeneration?.summary?.markEventCount ?? 0,
      tuningCombatEventCount: tuningGeneration?.summary?.combatEventCount ?? 0,
      applied: true,
    },
    applied: true,
  };
}

function applyKiboPassiveVitalChangeDescriptor({ descriptor, state }) {
  const command = descriptor.passiveVitalChangeCommand;
  const contract = resolveKiboPassiveVitalDamageContract(command);
  const basePayload = createKiboPassiveVitalDamagePayload({
    command,
    contract,
  });
  if (!contract.ready) {
    return createKiboPassiveVitalDamageEvent({
      descriptor,
      command,
      applied: false,
      reason: 'kibo-passive-vital-damage-contract-unresolved',
      payload: {
        ...basePayload,
        beforeValue: null,
        requestedDamage: null,
        appliedDamage: 0,
        change: 0,
        afterValue: null,
        maxValue: null,
        lethal: false,
        unresolvedReasons: contract.unresolvedReasons,
        appliedToCalculators: false,
      },
    });
  }
  const target = {
    kind: command.targetKind,
    id: command.targetId,
  };
  const vital = resolveFriendlyVitalState(state, target);
  if (!vital) {
    return createKiboPassiveVitalDamageEvent({
      descriptor,
      command,
      applied: false,
      reason: 'kibo-passive-vital-target-state-missing',
      payload: {
        ...basePayload,
        beforeValue: null,
        requestedDamage: null,
        appliedDamage: 0,
        change: 0,
        afterValue: null,
        maxValue: null,
        lethal: false,
        unresolvedReasons: ['kibo-passive-vital-target-state-missing'],
        appliedToCalculators: false,
      },
    });
  }
  const maximum = refreshFriendlyVitalMaximumAt({
    state,
    target,
    timeMs: descriptor.timeMs,
  });
  if (!maximum.ready) {
    return createKiboPassiveVitalDamageEvent({
      descriptor,
      command,
      applied: false,
      reason: 'kibo-passive-vital-maximum-hp-unresolved',
      payload: {
        ...basePayload,
        beforeValue: roundValue(vital.currentHp),
        requestedDamage: null,
        appliedDamage: 0,
        change: 0,
        afterValue: roundValue(vital.currentHp),
        maxValue: roundValue(vital.maximumHp),
        lethal: false,
        unresolvedReasons: ['kibo-passive-vital-maximum-hp-unresolved'],
        maximumResolution: maximum,
        appliedToCalculators: false,
      },
    });
  }
  const before = Number(vital.currentHp);
  const valueShieldsBefore = vital.valueShields.map(shield => ({ ...shield }));
  if (!(before > 0)) {
    return createKiboPassiveVitalDamageEvent({
      descriptor,
      command,
      applied: false,
      reason: 'kibo-passive-vital-target-already-dead',
      payload: {
        ...basePayload,
        beforeValue: roundValue(before),
        requestedDamage: 0,
        appliedDamage: 0,
        change: 0,
        afterValue: roundValue(before),
        maxValue: roundValue(vital.maximumHp),
        lethal: false,
        valueShieldsBefore,
        valueShieldsAfter: vital.valueShields.map(shield => ({ ...shield })),
        unresolvedReasons: [],
        appliedToCalculators: true,
      },
    });
  }

  const formulaRaw = qDivNearestPositive(
    qMul(qFromFloat(before), qFromInt(contract.coefficientRaw)),
    qFromInt(10_000)
  );
  const damageResult = calculateRealDamage({
    baseRaw: formulaRaw,
    worldEventConflictPer: 1,
    hitLocationRatio: 1,
    blockMiscellaneous: true,
    miscellaneous: 1,
    inWeakState: false,
    breakDamageUp: 0,
    currentHp: before,
    minimumRemainingHp: contract.minimumRemainingHp,
  });
  const requestedDamage = Math.max(0, Number(damageResult.value));
  const appliedDamage = Math.min(before, requestedDamage);
  vital.currentHp = clampNumber(before - appliedDamage, 0, vital.maximumHp);
  const lethal = before > 0 && vital.currentHp <= 0;
  const unresolvedReasons = lethal
    ? ['kibo-passive-self-kill-future-hit-death-scheduler-unresolved']
    : [];
  return createKiboPassiveVitalDamageEvent({
    descriptor,
    command,
    applied: appliedDamage > 0,
    reason:
      appliedDamage > 0
        ? 'kibo-passive-vital-damage-applied'
        : 'kibo-passive-vital-damage-no-effective-change',
    payload: {
      ...basePayload,
      beforeValue: roundValue(before),
      currentHpSnapshot: roundValue(before),
      coefficientRaw: contract.coefficientRaw,
      coefficientBasisPoints: contract.coefficientRaw,
      baseFormulaRaw: formulaRaw.toString(),
      baseFormulaValue: roundValue(qToNumber(formulaRaw)),
      requestedDamage: roundValue(requestedDamage),
      appliedDamage: roundValue(appliedDamage),
      change: roundValue(-appliedDamage),
      afterValue: roundValue(vital.currentHp),
      maxValue: roundValue(vital.maximumHp),
      lethal,
      minimumNominalDamage: 1,
      minimumRemainingHp: contract.minimumRemainingHp,
      roundingPolicy: 'q16-nearest-then-midpoint-to-even',
      formulaResult: damageResult,
      shieldsBypassed: true,
      valueShieldsBefore,
      valueShieldsAfter: vital.valueShields.map(shield => ({ ...shield })),
      synchronousSkillStartPolicy: lethal
        ? 'continues-after-before-skill-self-kill'
        : 'not-applicable-target-survived',
      unresolvedReasons,
      appliedToCalculators: true,
    },
  });
}

function resolveKiboPassiveVitalDamageContract(command) {
  const vitalChange = command?.vitalChange ?? {};
  const formula = vitalChange.formula ?? {};
  const damage = vitalChange.damage ?? {};
  const minimumHpPolicy = vitalChange.minimumHpPolicy ?? {};
  const eventPolicy = vitalChange.eventPolicy ?? {};
  const nativeFormula = command?.nativeEvidenceContract?.formula103 ?? {};
  const unresolvedReasons = [];
  if (command?.kind !== 'damage' || vitalChange.kind !== 'damage') {
    unresolvedReasons.push('kibo-passive-vital-operation-unsupported');
  }
  if (
    command?.targetKind !== EFFECT_TARGET_KINDS.KIBO ||
    vitalChange.runtimeTargetKind !== EFFECT_TARGET_KINDS.KIBO ||
    String(command?.sourceActorId) !== String(command?.targetId) ||
    Number(command?.sourceKiboId) !== Number(command?.targetKiboId)
  ) {
    unresolvedReasons.push('kibo-passive-vital-owner-target-contract-invalid');
  }
  if (
    Number(formula.commonFunctionId) !== 1 ||
    formula.commonExpression !== 'G/10000' ||
    Number(formula.baseFunctionId) !== 103 ||
    formula.baseExpression !== '(self.CURRENT_HEALTH*A)/10000' ||
    vitalChange.sourceAttribute?.valueKind !== 'current-vital' ||
    vitalChange.sourceAttribute?.entityRole !== 'element-owner-equipped-kibo'
  ) {
    unresolvedReasons.push(
      'kibo-passive-current-health-formula-contract-invalid'
    );
  }
  const coefficientRaw = Number(formula.coefficientRaw);
  if (!Number.isInteger(coefficientRaw) || coefficientRaw < 0) {
    unresolvedReasons.push('kibo-passive-vital-coefficient-invalid');
  }
  if (
    Number(damage.damageType) !== 6 ||
    damage.damageTypeName !== 'Real' ||
    Number(damage.physicalRatioBasisPoints) !== 0 ||
    Number(damage.magicRatioBasisPoints) !== 0 ||
    vitalChange.shieldPolicy !== 'bypass' ||
    vitalChange.restraintPolicy !== 'bypass'
  ) {
    unresolvedReasons.push('kibo-passive-real-damage-route-contract-invalid');
  }
  if (
    Number(minimumHpPolicy.damageMinimumValueType) !== 0 ||
    Number(minimumHpPolicy.minimumHpValue) !== 0 ||
    Number(minimumHpPolicy.nominalDamageMinimum) !== 1 ||
    minimumHpPolicy.minimumRemainingHp !== null ||
    minimumHpPolicy.canReduceTargetToZero !== true
  ) {
    unresolvedReasons.push('kibo-passive-minimum-hp-policy-contract-invalid');
  }
  if (
    vitalChange.integerization?.mode !== 'q16-round-to-nearest-ties-to-even' ||
    eventPolicy.ignoreDamageEvent !== true ||
    eventPolicy.attackerSideBeforeAfterAttackEvents !== 'suppressed' ||
    eventPolicy.receiveSideEvents !==
      'dispatch-depends-on-main-control-status-unresolved'
  ) {
    unresolvedReasons.push('kibo-passive-vital-event-policy-contract-invalid');
  }
  if (
    vitalChange.auxiliaryFormula?.runtimeRead !== false ||
    vitalChange.auxiliaryFormula?.policy !==
      'ignored-by-damage-element-real-output-path'
  ) {
    unresolvedReasons.push('kibo-passive-auxiliary-formula-contract-invalid');
  }
  if (
    nativeFormula.formulaIdIsBlocked !== true ||
    !(nativeFormula.blockedFormulaIds ?? []).includes(103) ||
    nativeFormula.blockedConsequence !==
      'skip-battle-config-miscellaneous-damage-multiplier'
  ) {
    unresolvedReasons.push('kibo-passive-formula-block-policy-unresolved');
  }
  if (
    command?.trigger?.event !== 'skill-before' ||
    command?.trigger?.activationOrder !==
      'after-resource-and-cooldown-before-skill-start'
  ) {
    unresolvedReasons.push('kibo-passive-before-skill-order-contract-invalid');
  }
  return {
    ready: unresolvedReasons.length === 0,
    unresolvedReasons,
    coefficientRaw: Number.isInteger(coefficientRaw) ? coefficientRaw : null,
    minimumRemainingHp: null,
  };
}

function createKiboPassiveVitalDamagePayload({ command, contract }) {
  const vitalChange = command?.vitalChange ?? {};
  return {
    status: 'verified-kibo-passive-vital-damage',
    passiveSkillId: command?.passiveSkillId ?? null,
    passiveName: command?.passiveName ?? null,
    sourceActorId: command?.sourceActorId ?? null,
    sourceKiboId: command?.sourceKiboId ?? null,
    sourceSlotId: command?.sourceSlotId ?? null,
    sourcePosition: command?.sourcePosition ?? null,
    targetKind: command?.targetKind ?? null,
    targetActorId: command?.targetActorId ?? command?.targetId ?? null,
    targetKiboId: command?.targetKiboId ?? null,
    targetSlotId: command?.targetSlotId ?? null,
    targetPosition: command?.targetPosition ?? null,
    triggerElementId: command?.trigger?.sourceElementId ?? null,
    vitalElementId: vitalChange.sourceElementId ?? null,
    damageType: vitalChange.damage?.damageType ?? null,
    damageTypeName: vitalChange.damage?.damageTypeName ?? null,
    formulaId: vitalChange.formula?.baseFunctionId ?? null,
    shieldPolicy: vitalChange.shieldPolicy ?? null,
    restraintPolicy: vitalChange.restraintPolicy ?? null,
    ignoreDamageEvent: vitalChange.eventPolicy?.ignoreDamageEvent === true,
    attackerSideBeforeAfterAttackEvents:
      vitalChange.eventPolicy?.attackerSideBeforeAfterAttackEvents ?? null,
    receiveSideEvents: vitalChange.eventPolicy?.receiveSideEvents ?? null,
    auxiliaryFormula: vitalChange.auxiliaryFormula ?? null,
    activationOrder: command?.trigger?.activationOrder ?? null,
    sourceIdentity: command?.sourceIdentity ?? null,
    nativeEvidenceContract: command?.nativeEvidenceContract ?? null,
    contractReady: contract.ready,
  };
}

function createKiboPassiveVitalDamageEvent({
  descriptor,
  command,
  applied,
  reason,
  payload,
}) {
  return {
    type: applied
      ? 'VERIFIED_KIBO_PASSIVE_VITAL_DAMAGE'
      : 'VERIFIED_KIBO_PASSIVE_VITAL_DAMAGE_SUPPRESSED',
    timeMs: descriptor.timeMs,
    actionId: command?.sourceActionId ?? descriptor.action?.id ?? null,
    actorId: command?.sourceActorId ?? descriptor.action?.actorId ?? null,
    targetId: command?.targetId ?? null,
    payload: {
      ...payload,
      applied,
      reason,
    },
  };
}

function qDivNearestPositive(left, right) {
  if (left < 0n || right <= 0n) {
    throw new RangeError(
      'qDivNearestPositive requires left >= 0 and right > 0'
    );
  }
  const numerator = left << 16n;
  const quotient = numerator / right;
  const remainder = numerator % right;
  return quotient + (remainder * 2n >= right ? 1n : 0n);
}

function createPeriodicVitalDescriptors({ schedule, durationMs, frameRate }) {
  if (schedule?.mechanismFamily === DERIVED_DOT_SELF_HEAL_MECHANISM_FAMILY) {
    return createDerivedDotSelfHealDescriptors({
      schedule,
      durationMs,
      frameRate,
    });
  }
  const intervalMs = positiveNumber(schedule?.trigger?.intervalMs, null);
  const normalizedFrameRate = positiveNumber(frameRate, FRAME_RATE);
  const unresolvedReasons = [];
  if (intervalMs == null) {
    unresolvedReasons.push('periodic-heal-trigger-interval-invalid');
  }
  if (schedule?.trigger?.firstTriggerPolicy !== 'first-positive-delta-update') {
    unresolvedReasons.push('periodic-heal-first-trigger-policy-unsupported');
  }
  if (
    schedule?.trigger?.laterTriggerThreshold !==
    'strict-elapsed-greater-than-ordinal-interval'
  ) {
    unresolvedReasons.push('periodic-heal-later-trigger-threshold-unsupported');
  }
  if (
    schedule?.trigger?.event !== 'time-loop' ||
    schedule?.trigger?.timeExeFirstFrame !== true ||
    schedule?.trigger?.exactThresholdTriggers !== false ||
    schedule?.trigger?.sparseUpdateCatchUp !==
      'at-most-one-trigger-per-update' ||
    schedule?.trigger?.conditionFailureConsumesPeriod !== true ||
    schedule?.trigger?.frequencyPolicy !== 'unlimited'
  ) {
    unresolvedReasons.push('periodic-heal-trigger-contract-invalid');
  }
  if (
    ![EFFECT_TARGET_KINDS.ACTOR, EFFECT_TARGET_KINDS.KIBO].includes(
      schedule?.targetKind
    ) ||
    schedule?.targetId == null ||
    schedule?.rootEffectId == null
  ) {
    unresolvedReasons.push('periodic-heal-target-or-root-identity-invalid');
  }
  if (
    schedule?.condition?.kind !== 'target-current-hp-ratio' ||
    Number(schedule?.condition?.formulaId) !== 211 ||
    schedule?.condition?.evaluationEntity !== 'team-copy-executor-self' ||
    Number(schedule?.condition?.maxHpAttributeId) !== 5 ||
    Number(schedule?.condition?.thresholdBasisPoints) !== 10000 ||
    schedule?.condition?.operator !== 'strict-less-than'
  ) {
    unresolvedReasons.push('periodic-heal-condition-contract-invalid');
  }
  if (
    schedule?.heal?.kind !== 'heal' ||
    schedule?.heal?.target !== 'team-copy-holder-self' ||
    Number(schedule?.heal?.damageType) !== 5 ||
    Number(schedule?.heal?.formula?.commonFunctionId) !== 1 ||
    Number(schedule?.heal?.formula?.executionGateScaleRaw) !== 10000 ||
    Number(schedule?.heal?.formula?.baseFunctionId) !== 104 ||
    positiveNumber(schedule?.heal?.formula?.coefficientRaw, null) == null ||
    Number(schedule?.heal?.formula?.minimumNominalHeal) !== 1 ||
    Number(schedule?.heal?.formula?.maxHpAttributeId) !== 5 ||
    schedule?.heal?.formula?.configuredPostRuntimeStatus !==
      'configured-but-unread-by-damage-element-parse-and-get-output-heal'
  ) {
    unresolvedReasons.push('periodic-heal-formula-contract-invalid');
  }
  if (
    schedule?.heal?.outputClamp !== 'min-nominal-and-max-hp-minus-current-hp' ||
    schedule?.heal?.fullHealthPolicy !== 'no-hp-change-and-no-heal-record' ||
    schedule?.heal?.deadTargetPolicy !==
      'before-execute-hp-less-than-or-equal-zero-rejects' ||
    Number(schedule?.heal?.healModifierAttributes?.sourceAttributeId) !== 23 ||
    Number(schedule?.heal?.healModifierAttributes?.targetAttributeId) !== 24
  ) {
    unresolvedReasons.push(
      'periodic-heal-lifecycle-or-modifier-contract-invalid'
    );
  }
  if (unresolvedReasons.length > 0) {
    return [
      {
        kind: 'passive-periodic-heal-contract-unresolved',
        timeMs: 0,
        frameIndex: null,
        tickIndex: null,
        thresholdMs: null,
        schedule,
        unresolvedReasons,
      },
    ];
  }
  const descriptors = [];
  const maximumOrdinal = Math.floor(Number(durationMs) / intervalMs) + 1;
  for (let tickIndex = 0; tickIndex <= maximumOrdinal; tickIndex += 1) {
    const thresholdMs = tickIndex * intervalMs;
    const frameIndex =
      Math.floor((thresholdMs * normalizedFrameRate) / 1000) + 1;
    const timeMs = roundValue((frameIndex * 1000) / normalizedFrameRate);
    if (timeMs > durationMs) break;
    descriptors.push({
      kind: 'passive-periodic-heal',
      timeMs,
      frameIndex,
      tickIndex,
      thresholdMs,
      schedule,
      sourceSequencePath: createPeriodicVitalSourceSequencePath({
        schedule,
        tickIndex,
      }),
    });
  }
  return descriptors;
}

function createDerivedDotSelfHealDescriptors({
  schedule,
  durationMs,
  frameRate,
}) {
  const derivedPeriodic = schedule?.derivedPeriodic ?? {};
  const intervalMs = positiveNumber(derivedPeriodic.intervalMs, null);
  const relayDurationMs = positiveNumber(derivedPeriodic.durationMs, null);
  const startMs = nonNegativeNumber(derivedPeriodic.startMs);
  const timeExeFirstFrame = derivedPeriodic.timeExeFirstFrame === true;
  const kind = derivedPeriodic.kind;
  const unresolvedReasons = [];
  if (intervalMs == null) {
    unresolvedReasons.push('derived-periodic-interval-invalid');
  }
  if (relayDurationMs == null) {
    unresolvedReasons.push('derived-periodic-duration-invalid');
  }
  if (!timeExeFirstFrame) {
    unresolvedReasons.push('derived-periodic-first-trigger-policy-unsupported');
  }
  if (!['derived-dot', 'self-heal'].includes(kind)) {
    unresolvedReasons.push('derived-periodic-kind-invalid');
  }
  if (
    schedule?.targetKind == null ||
    schedule?.targetId == null ||
    schedule?.rootEffectId == null
  ) {
    unresolvedReasons.push('derived-periodic-target-or-root-identity-invalid');
  }
  if (unresolvedReasons.length > 0) {
    return [
      {
        kind: 'passive-derived-periodic-contract-unresolved',
        timeMs: 0,
        frameIndex: null,
        tickIndex: null,
        thresholdMs: null,
        schedule,
        unresolvedReasons,
      },
    ];
  }
  const normalizedFrameRate = positiveNumber(frameRate, FRAME_RATE);
  const descriptors = [];
  const maximumTick = Math.floor(relayDurationMs / intervalMs) - 1;
  for (let tickIndex = 0; tickIndex <= maximumTick; tickIndex += 1) {
    const thresholdMs = tickIndex * intervalMs;
    const frameIndex =
      Math.floor(((startMs + thresholdMs) * normalizedFrameRate) / 1000) + 1;
    const timeMs = roundValue((frameIndex * 1000) / normalizedFrameRate);
    if (timeMs > durationMs) break;
    descriptors.push({
      kind:
        kind === 'derived-dot'
          ? 'passive-derived-dot'
          : 'passive-derived-self-heal',
      timeMs,
      frameIndex,
      tickIndex,
      thresholdMs,
      schedule,
      sourceSequencePath: createDerivedPeriodicSourceSequencePath({
        schedule,
        tickIndex,
      }),
    });
  }
  return descriptors;
}

function createDerivedPeriodicSourceSequencePath({ schedule, tickIndex }) {
  const sourceIdentity = [
    schedule?.id,
    schedule?.passiveSkillId,
    schedule?.rootElementId,
    schedule?.sourceActorId,
    schedule?.sourceKiboId,
    schedule?.sourceSlotId,
    schedule?.targetKind,
    schedule?.targetId,
  ].join('|');
  return [
    Number.MAX_SAFE_INTEGER,
    45,
    stableSourceSequenceComponent(sourceIdentity),
    nonNegativeInteger(tickIndex),
  ];
}

function createPeriodicVitalSourceSequencePath({ schedule, tickIndex }) {
  const sourceIdentity = [
    schedule?.id,
    schedule?.passiveSkillId,
    schedule?.rootElementId,
    schedule?.sourceActorId,
    schedule?.sourceKiboId,
    schedule?.sourceSlotId,
    schedule?.targetKind,
    schedule?.targetId,
  ].join('|');
  return [
    Number.MAX_SAFE_INTEGER,
    44,
    stableSourceSequenceComponent(sourceIdentity),
    nonNegativeInteger(tickIndex),
  ];
}

function stableSourceSequenceComponent(value) {
  let hash = 2166136261;
  for (const character of String(value ?? '')) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function annotatePeriodicVitalOrderConflicts({
  descriptors,
  controlledActorTimeline,
}) {
  const descriptorsByTargetAndTime = new Map();
  for (const descriptor of descriptors) {
    const target = resolveVitalMutationDescriptorTarget({
      descriptor,
      controlledActorTimeline,
    });
    if (!target) continue;
    const key = `${roundValue(descriptor.timeMs)}|${target.kind}|${String(
      target.id
    )}`;
    const rows = descriptorsByTargetAndTime.get(key) ?? [];
    rows.push(descriptor);
    descriptorsByTargetAndTime.set(key, rows);
  }
  for (const rows of descriptorsByTargetAndTime.values()) {
    const periodicRows = rows.filter(
      descriptor =>
        descriptor.kind === 'passive-periodic-heal' ||
        descriptor.kind === 'passive-derived-self-heal'
    );
    if (periodicRows.length === 0 || rows.length === 1) continue;
    const conflict = {
      reason: 'same-time-friendly-hp-mutation-native-order-unresolved',
      descriptorCount: rows.length,
      descriptorKinds: [...new Set(rows.map(row => row.kind))].sort(),
    };
    for (const descriptor of periodicRows) {
      descriptor.vitalOrderConflict = conflict;
    }
  }
}

function resolveVitalMutationDescriptorTarget({
  descriptor,
  controlledActorTimeline,
}) {
  if (descriptor.kind === 'passive-periodic-heal') {
    return {
      kind: descriptor.schedule?.targetKind,
      id: descriptor.schedule?.targetId,
    };
  }
  if (descriptor.kind === 'passive-derived-self-heal') {
    return {
      kind: descriptor.schedule?.targetKind,
      id: descriptor.schedule?.targetId,
    };
  }
  if (descriptor.kind === 'direct-heal') {
    const target = descriptor.directEvent?.target;
    return [EFFECT_TARGET_KINDS.ACTOR, EFFECT_TARGET_KINDS.KIBO].includes(
      target?.kind
    )
      ? target
      : null;
  }
  if (
    descriptor.kind === 'tuning-combat' &&
    descriptor.tuningEvent?.kind === 'periodic-heal'
  ) {
    const controlledActor = resolveControlledActorAt(
      controlledActorTimeline,
      descriptor.timeMs
    );
    return controlledActor?.actorId == null
      ? null
      : {
          kind: EFFECT_TARGET_KINDS.ACTOR,
          id: controlledActor.actorId,
        };
  }
  return null;
}

function createExplicitEnemyRuntimeProfile(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const rules = profile.breakRules ?? {};
  const attributes = profile.attributes ?? {};
  return {
    applied: true,
    enemyId: Number(profile.enemyId),
    maxWeakness: Number(attributes.maxToughness),
    recoveryDelayMs: Number(rules.recoveryDelayMs),
    recoveryRateBasisPoints: Number(rules.recoveryRateBasisPoints),
    breakTimeMs: Number(rules.breakTimeMs),
    breakEndTimeMs: Number(rules.breakEndTimeMs),
    breakDamageUpBasisPoints: Number(rules.breakDamageUpBasisPoints),
    weaknessDamageMaximum:
      rules.weaknessDamageMaximum == null
        ? null
        : Number(rules.weaknessDamageMaximum),
    weaknessDamageMinimum:
      rules.weaknessDamageMinimum == null
        ? null
        : Number(rules.weaknessDamageMinimum),
    typeMultipliersBasisPoints: structuredClone(
      rules.typeMultipliersBasisPoints ?? {}
    ),
    elementMultipliersBasisPoints: structuredClone(
      rules.elementMultipliersBasisPoints ?? {}
    ),
    sourceIdentity: {
      contractName: profile.contractName ?? null,
      profileId: profile.profileId ?? null,
      profileHash: profile.profileHash ?? null,
      sourceIdentity: profile.source?.identity ?? null,
      sourceHash: profile.source?.hash ?? null,
    },
  };
}

function createRuntimeState({ scenario, mechanicsPackage, effectTimeline }) {
  const attributeDefinitionById = new Map(
    (mechanicsPackage.staticPropertyCatalog?.attributeDefinitions ?? []).map(
      definition => [Number(definition.id), definition]
    )
  );
  const attributeIdByKey = new Map(
    [...attributeDefinitionById.values()].flatMap(definition =>
      [definition.key, definition.tableKey]
        .filter(Boolean)
        .map(key => [String(key), Number(definition.id)])
    )
  );
  const actorProfileById = new Map(
    (mechanicsPackage.ownerProfiles?.actor ?? []).map(profile => [
      Number(profile.characterId),
      profile,
    ])
  );
  const actorEnergy = new Map(
    (scenario?.actors ?? []).map(actor => {
      const inherited = scenario?.initialRuntimeState?.selfEnergyByActor?.find(
        entry =>
          entry.actorId === actor.id ||
          Number(entry.characterId) === Number(actor.characterId)
      );
      const generatedProfile =
        actorProfileById.get(Number(actor.characterId)) ?? null;
      const staticProperties = actor.verifiedStaticProperties ?? null;
      const profile = staticProperties?.ready
        ? staticProperties.resourceProfile
        : staticProperties?.status ===
            'verified-static-property-catalog-not-installed'
          ? generatedProfile
          : null;
      const max = positiveNumber(
        profile?.effectiveMaxSp ?? profile?.maxSp ?? actor.stats?.maxSp,
        100
      );
      return [
        actor.id,
        {
          actor,
          profile,
          attributesById: createActorRuntimeAttributeMap(
            actor,
            attributeDefinitionById
          ),
          current: clampNumber(
            inherited?.currentValue ?? actor.initialSp ?? 0,
            0,
            max
          ),
          max,
        },
      ];
    })
  );
  const kiboProfileById = new Map(
    (mechanicsPackage.ownerProfiles?.kibo ?? []).map(profile => [
      Number(profile.kiboId),
      profile,
    ])
  );
  const topologyGroups =
    scenario?.sourceProject?.metadata?.timelineTopology?.actorGroups ?? [];
  const actorById = new Map(
    (scenario?.actors ?? []).map(actor => [String(actor.id), actor])
  );
  const groups = topologyGroups.length
    ? topologyGroups
    : (scenario?.actors ?? []).map((actor, index) => ({
        slotId: `team-slot-${index + 1}`,
        actorId: actor.id,
        kiboLane: { kiboId: actor.loadout?.kiboId ?? null },
      }));
  const slotIdByActorId = new Map(
    groups.map((group, index) => [
      String(group.actorId),
      group.slotId ?? `team-slot-${index + 1}`,
    ])
  );
  const kiboEnergy = new Map();
  for (const [index, group] of groups.entries()) {
    const actor = actorById.get(String(group.actorId));
    const kiboId = positiveIntegerOrNull(
      group.kiboLane?.kiboId ?? actor?.loadout?.kiboId
    );
    if (!kiboId) continue;
    const generatedProfile = kiboProfileById.get(kiboId) ?? null;
    const staticKibo = actor?.verifiedStaticKiboProperties ?? null;
    const profile = staticKibo?.ready
      ? createStaticKiboRuntimeProfile(staticKibo)
      : staticKibo == null
        ? generatedProfile
        : null;
    const slotId = group.slotId ?? `team-slot-${index + 1}`;
    const inherited = scenario?.initialRuntimeState?.kiboEnergyBySlot?.find(
      entry => entry.slotId === slotId && Number(entry.kiboId) === kiboId
    );
    const max = positiveNumber(profile?.effectiveMaxSp ?? profile?.maxSp, 100);
    kiboEnergy.set(slotId, {
      slotId,
      actorId: actor?.id ?? group.actorId ?? null,
      kiboId,
      profile,
      attributesById: new Map(profile?.attributesById ?? []),
      current: clampNumber(inherited?.currentValue ?? 0, 0, max),
      max,
    });
  }
  const inheritedEnemy = scenario?.initialRuntimeState?.enemy ?? null;
  const targetPolicy = resolveCombatTargetPolicy(scenario);
  const enemyId = Number(scenario?.enemy?.enemyId ?? scenario?.enemy?.id);
  const enemyProfile =
    createExplicitEnemyRuntimeProfile(scenario?.enemy?.profile) ??
    (mechanicsPackage.ownerProfiles?.enemy ?? []).find(
      profile => Number(profile.enemyId) === enemyId
    );
  const configuredEnemyMaxHp = Math.max(
    0,
    Number(scenario?.enemy?.stats?.maxHp ?? 0) *
      positiveNumber(scenario?.enemy?.hpMultiplier, 1)
  );
  const enemyMaxHp = Math.max(
    0,
    numberOrNull(inheritedEnemy?.hp?.maxValue) ?? configuredEnemyMaxHp
  );
  const enemyHp = clampNumber(
    inheritedEnemy?.hp?.currentValue ?? enemyMaxHp,
    0,
    enemyMaxHp
  );
  const configuredEnemyToughness = Math.max(
    0,
    Number(
      scenario?.enemy?.stats?.initialToughness ?? enemyProfile?.maxWeakness ?? 0
    )
  );
  const enemyMaxToughness = Math.max(
    configuredEnemyToughness,
    numberOrNull(inheritedEnemy?.toughness?.maxValue) ??
      Number(
        scenario?.enemy?.stats?.maxToughness ??
          enemyProfile?.maxWeakness ??
          configuredEnemyToughness
      )
  );
  const enemyToughness =
    targetPolicy.toughnessMode === 'disabled'
      ? enemyMaxToughness
      : clampNumber(
          inheritedEnemy?.toughness?.currentValue ?? configuredEnemyToughness,
          0,
          enemyMaxToughness
        );
  const inBreak =
    targetPolicy.breakMode === 'enabled' &&
    targetPolicy.toughnessMode === 'enabled' &&
    inheritedEnemy?.inBreak === true;
  const breakElapsedMs = nonNegativeNumber(inheritedEnemy?.breakElapsedMs);
  const recoveryDelayRemainingMs = numberOrNull(
    inheritedEnemy?.recoveryDelayRemainingMs
  );
  const actorVitals = new Map(
    [...actorEnergy.values()].map(entry => {
      const inherited = scenario?.initialRuntimeState?.actorVitalsByActor?.find(
        value =>
          value.actorId === entry.actor.id ||
          Number(value.characterId) === Number(entry.actor.characterId)
      );
      const baseMaximumHp = positiveNumber(
        entry.attributesById.get(5) ?? entry.actor.stats?.maxHp,
        null
      );
      return [
        String(entry.actor.id),
        {
          actorId: entry.actor.id,
          currentHp: numberOrNull(inherited?.currentValue),
          maximumHp: null,
          baseMaximumHp,
          inheritedMaximumHpSnapshot: numberOrNull(inherited?.maxValue),
          hasInheritedCurrentHp: numberOrNull(inherited?.currentValue) != null,
          valueShields: normalizeValueShields(inherited?.valueShields),
        },
      ];
    })
  );
  const kiboVitals = new Map(
    [...kiboEnergy.values()].map(entry => {
      const inherited = scenario?.initialRuntimeState?.kiboVitalsBySlot?.find(
        value =>
          value.slotId === entry.slotId &&
          Number(value.kiboId) === Number(entry.kiboId)
      );
      const baseMaximumHp = positiveNumber(entry.attributesById.get(5), null);
      return [
        String(entry.actorId),
        {
          slotId: entry.slotId,
          actorId: entry.actorId,
          kiboId: entry.kiboId,
          currentHp: numberOrNull(inherited?.currentValue),
          maximumHp: null,
          baseMaximumHp,
          inheritedMaximumHpSnapshot: numberOrNull(inherited?.maxValue),
          hasInheritedCurrentHp: numberOrNull(inherited?.currentValue) != null,
          valueShields: normalizeValueShields(inherited?.valueShields),
        },
      ];
    })
  );
  const state = {
    actorEnergy,
    actorVitals,
    kiboEnergy,
    kiboVitals,
    kiboProfileById,
    slotIdByActorId,
    attributeDefinitionById,
    attributeIdByKey,
    effectTimeline,
    vitalDiagnostics: [],
    nextRuntimeSequenceIndex: 0,
    enemy: {
      targetPolicy,
      deathTruncationArmed:
        targetPolicy.deathTruncation === 'enabled' &&
        scenario?.enemy?.profile != null,
      enemyId: Number.isInteger(enemyId) ? enemyId : null,
      profile: enemyProfile ?? null,
      hp: enemyHp,
      maxHp: enemyMaxHp,
      toughness: enemyToughness,
      maxToughness: enemyMaxToughness,
      inBreak,
      breakStartedAtMs: inBreak ? -breakElapsedMs : null,
      breakPhase: inBreak ? 'linear_recovery' : 'normal',
      normalRecoveryEligibleAtMs:
        !inBreak && enemyToughness < enemyMaxToughness
          ? Math.max(
              0,
              recoveryDelayRemainingMs ??
                nonNegativeNumber(enemyProfile?.recoveryDelayMs)
            )
          : null,
      lastToughnessSourceActionId:
        inheritedEnemy?.lastToughnessSourceActionId ?? null,
      lastToughnessSourceActorId:
        inheritedEnemy?.lastToughnessSourceActorId ?? null,
      lastToughnessBindingIdentity:
        inheritedEnemy?.lastToughnessBindingIdentity ?? null,
      valueShields: normalizeValueShields(
        inheritedEnemy?.valueShields ?? inheritedEnemy?.shields
      ),
      hitCountShields: normalizeHitCountShields(
        inheritedEnemy?.hitCountShields
      ),
    },
  };
  initializeFriendlyVitalsAt(state, 0);
  return state;
}

function createStaticKiboRuntimeProfile(staticKibo) {
  const attributes = new Map(
    (staticKibo.attributes ?? []).map(attribute => [
      Number(attribute.id),
      attribute,
    ])
  );
  return {
    ...staticKibo.resourceProfile,
    kiboId: staticKibo.kiboId,
    attack: staticKibo.stats?.attack ?? null,
    attributesById: [...attributes.entries()].map(([id, attribute]) => [
      id,
      attribute.rawValue,
    ]),
    criticalRateBasisPoints: attributes.get(7)?.rawValue ?? null,
    criticalDamageBasisPoints: attributes.get(8)?.rawValue ?? null,
    damageUpBasisPoints: attributes.get(21)?.rawValue ?? null,
    physicalDamageUpBasisPoints: attributes.get(25)?.rawValue ?? null,
    magicDamageUpBasisPoints: attributes.get(27)?.rawValue ?? null,
    elementDamageUpBasisPointsByType: Object.fromEntries(
      Object.entries(ELEMENT_DAMAGE_ATTRIBUTE_ID_BY_TYPE).map(
        ([elementType, attributeId]) => [
          elementType,
          attributes.get(attributeId)?.rawValue ?? 0,
        ]
      )
    ),
    sourceIdentity: staticKibo.sourceIdentity,
    status: staticKibo.status,
    applied: staticKibo.ready === true,
  };
}

function createActorRuntimeAttributeMap(actor, attributeDefinitionById) {
  const compiled = actor?.verifiedStaticProperties?.attributes ?? [];
  if (compiled.length > 0) {
    return new Map(
      compiled.map(attribute => [
        Number(attribute.id),
        Number(attribute.rawValue),
      ])
    );
  }
  const idByKey = new Map(
    [...attributeDefinitionById.values()].flatMap(definition =>
      [definition.key, definition.tableKey]
        .filter(Boolean)
        .map(key => [String(key), Number(definition.id)])
    )
  );
  return new Map(
    (actor?.baseAttributes ?? [])
      .map(attribute => [
        idByKey.get(String(attribute.key)),
        Number(attribute.value),
      ])
      .filter(([id, value]) => Number.isInteger(id) && Number.isFinite(value))
  );
}

function resolveRuntimeAttribute({
  state,
  targetKind,
  targetId,
  timeMs,
  attributeId,
  baseRaw,
  propertyTags = [],
  settlingActionId = null,
  settlingSourceSequencePath = null,
}) {
  const normalizedAttributeId = Number(attributeId);
  if (!Number.isInteger(normalizedAttributeId)) {
    return {
      attributeId: normalizedAttributeId,
      value: null,
      baseRaw: null,
      dynamicBaseRaw: 0,
      dynamicPercentRaw: 0,
      dynamicExtraRaw: 0,
      dynamicForceRaw: null,
      appliedEffects: [],
      ready: false,
    };
  }
  const activeEffects = resolveActiveEffectsAt(state.effectTimeline, timeMs, {
    targetKind,
    targetId,
    calculatorOnly: true,
    settlingActionId,
    settlingSourceSequencePath,
  });
  const modifiers = activeEffects.flatMap(effect =>
    (effect.modifiers ?? [])
      .filter(
        modifier =>
          modifier.kind === 'battle-property' &&
          Number(modifier.attributeId) === normalizedAttributeId &&
          matchesVerifiedBattlePropertyTags(modifier.propertyTags, propertyTags)
      )
      .map(modifier => ({
        ...modifier,
        effectId: effect.effectId,
        effectName: effect.effectName,
        stacks: effect.stacks,
        valueRaw:
          modifier.bucket === 'dynamicForce'
            ? Number(modifier.valueRaw)
            : Number(modifier.valueRaw) * Number(effect.stacks ?? 1),
      }))
  );
  const definition = state.attributeDefinitionById.get(normalizedAttributeId);
  const explicitBaseRaw = numberOrNull(baseRaw);
  const definitionDefaultRaw = numberOrNull(definition?.defaultRaw);
  const materializedFromDefinitionDefault =
    explicitBaseRaw == null &&
    modifiers.length > 0 &&
    definitionDefaultRaw != null;
  const normalizedBase = materializedFromDefinitionDefault
    ? definitionDefaultRaw
    : explicitBaseRaw;
  if (normalizedBase == null) {
    return {
      attributeId: normalizedAttributeId,
      value: null,
      baseRaw: null,
      baseValueSource: null,
      dynamicBaseRaw: 0,
      dynamicPercentRaw: 0,
      dynamicExtraRaw: 0,
      dynamicForceRaw: null,
      appliedEffects: modifiers,
      status:
        modifiers.length > 0
          ? 'verified-dynamic-property-default-missing'
          : 'verified-static-property-base-missing',
      ready: false,
    };
  }
  const dynamicForceModifiers = modifiers.filter(
    modifier => modifier.bucket === 'dynamicForce'
  );
  if (dynamicForceModifiers.length > 1) {
    return {
      attributeId: normalizedAttributeId,
      value: null,
      baseRaw: normalizedBase,
      dynamicBaseRaw: 0,
      dynamicPercentRaw: 0,
      dynamicExtraRaw: 0,
      dynamicForceRaw: null,
      appliedEffects: modifiers,
      formula: 'force override conflict',
      status: 'verified-dynamic-force-conflict-unresolved',
      sourceIdentity: modifiers.map(modifier => modifier.sourceIdentity),
      ready: false,
    };
  }
  const dynamicForceRaw = dynamicForceModifiers[0]?.valueRaw ?? null;
  const dynamicPercentRaw = sumNumbers(
    modifiers
      .filter(modifier => modifier.bucket === 'dynamicPercent')
      .map(modifier => modifier.valueRaw)
  );
  const dynamicExtraRaw = sumNumbers(
    modifiers
      .filter(modifier => modifier.bucket === 'dynamicExtra')
      .map(modifier => modifier.valueRaw)
  );
  const multipliedRaw = qMul(
    qFromFloat(normalizedBase),
    qFromFloat(1 + dynamicPercentRaw / 10000)
  );
  let value =
    dynamicForceRaw == null
      ? qToNumber(multipliedRaw + qFromFloat(dynamicExtraRaw))
      : dynamicForceRaw;
  if (numberOrNull(definition?.minimum) != null) {
    value = Math.max(value, Number(definition.minimum));
  }
  if (numberOrNull(definition?.maximum) != null) {
    value = Math.min(value, Number(definition.maximum));
  }
  return {
    attributeId: normalizedAttributeId,
    value: roundValue(value),
    baseRaw: normalizedBase,
    baseValueSource: materializedFromDefinitionDefault
      ? 'battle_info.attrDefault-on-dynamic-property-materialization'
      : 'static-runtime-attribute',
    dynamicBaseRaw: 0,
    dynamicPercentRaw,
    dynamicExtraRaw,
    dynamicForceRaw,
    appliedEffects: modifiers,
    formula:
      dynamicForceRaw == null ? '((S+DB)*(1+DP)+DE)*ratio' : 'forceValue',
    sourceIdentity: modifiers.map(modifier => modifier.sourceIdentity),
    ready: true,
  };
}

function resolveActorRuntimeAttribute({
  state,
  actorState,
  timeMs,
  attributeId,
  fallbackRaw = null,
  propertyTags = [],
  settlingActionId = null,
  settlingSourceSequencePath = null,
}) {
  return resolveRuntimeAttribute({
    state,
    targetKind: EFFECT_TARGET_KINDS.ACTOR,
    targetId: actorState?.actor?.id,
    timeMs,
    attributeId,
    baseRaw:
      actorState?.attributesById?.get(Number(attributeId)) ?? fallbackRaw,
    propertyTags,
    settlingActionId,
    settlingSourceSequencePath,
  });
}

function resolveActorRuntimeRatio(options) {
  return basisPoints(resolveActorRuntimeAttribute(options).value);
}

function resolveKiboRuntimeRatio({
  state,
  kiboState,
  timeMs,
  attributeId,
  fallbackRaw = null,
  propertyTags = [],
  settlingActionId = null,
  settlingSourceSequencePath = null,
}) {
  return basisPoints(
    resolveRuntimeAttribute({
      state,
      targetKind: EFFECT_TARGET_KINDS.KIBO,
      targetId: kiboState?.actorId,
      timeMs,
      attributeId,
      baseRaw:
        kiboState?.attributesById?.get(Number(attributeId)) ?? fallbackRaw,
      propertyTags,
      settlingActionId,
      settlingSourceSequencePath,
    }).value
  );
}

function resolveKiboRatioAttribute({
  state,
  kiboState,
  action,
  timeMs,
  attributeId,
  fallbackBasisPoints = null,
  propertyTags = [],
  settlingSourceSequencePath = null,
}) {
  if (!Number.isInteger(Number(attributeId))) {
    return {
      attributeId: Number(attributeId),
      value: 0,
      appliedEffects: [],
      ready: false,
    };
  }
  return resolveRuntimeAttribute({
    state,
    targetKind: EFFECT_TARGET_KINDS.KIBO,
    targetId: action.actorId,
    timeMs,
    attributeId,
    baseRaw:
      kiboState?.attributesById?.get(Number(attributeId)) ??
      fallbackBasisPoints,
    propertyTags,
    settlingActionId: action.id,
    settlingSourceSequencePath,
  });
}

function collectDynamicPropertyTrace(results) {
  return (results ?? [])
    .filter(result => result && typeof result === 'object')
    .filter(result => (result.appliedEffects ?? []).length > 0)
    .map(result => ({
      attributeId: result.attributeId,
      baseRaw: result.baseRaw,
      baseValueSource: result.baseValueSource ?? null,
      dynamicBaseRaw: result.dynamicBaseRaw,
      dynamicPercentRaw: result.dynamicPercentRaw,
      dynamicExtraRaw: result.dynamicExtraRaw,
      dynamicForceRaw: result.dynamicForceRaw,
      value: result.value,
      effects: result.appliedEffects,
      formula: result.formula,
    }));
}

function sumNumbers(values) {
  return (values ?? []).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function applyWeaknessStateDescriptor({ descriptor, scenario, state }) {
  const enemy = state.enemy;
  const profile = enemy.profile;
  if (
    enemy.targetPolicy?.toughnessMode === 'disabled' ||
    enemy.targetPolicy?.breakMode === 'disabled'
  ) {
    return null;
  }
  if (!profile?.applied || enemy.maxToughness <= 0) return null;

  const before = createEnemyStateSnapshot(enemy);
  let formula = null;
  let stateEventKind = null;
  let recovered = 0;

  if (enemy.inBreak) {
    const elapsedMs = Math.max(
      0,
      descriptor.timeMs -
        (numberOrNull(enemy.breakStartedAtMs) ?? descriptor.timeMs)
    );
    formula = calculateBreakWeakness({
      maximumWeakness: enemy.maxToughness,
      breakTime: profile.breakTimeMs,
      breakEndTime: profile.breakEndTimeMs,
      elapsed: elapsedMs,
    });
    const phase = formula.phase;
    const targetToughness =
      phase === 'normal'
        ? enemy.maxToughness
        : clampNumber(formula.value, 0, enemy.maxToughness);
    recovered = roundValue(Math.max(0, targetToughness - enemy.toughness));
    enemy.toughness = roundValue(enemy.toughness + recovered);
    stateEventKind =
      phase === 'normal'
        ? 'break-exit'
        : phase === 'break_end_wait'
          ? 'break-end-wait'
          : 'break-linear-recovery';
    const phaseChanged = enemy.breakPhase !== phase;
    enemy.breakPhase = phase;
    if (phase === 'normal') {
      enemy.inBreak = false;
      enemy.breakStartedAtMs = null;
      enemy.normalRecoveryEligibleAtMs = null;
    }
    if (recovered <= 0 && !phaseChanged) return null;
  } else {
    if (
      enemy.toughness >= enemy.maxToughness ||
      enemy.normalRecoveryEligibleAtMs == null ||
      descriptor.timeMs < enemy.normalRecoveryEligibleAtMs
    ) {
      return null;
    }
    formula = calculateNormalWeaknessRecovery({
      recoveryRate: basisPoints(profile.recoveryRateBasisPoints),
      maximumWeakness: enemy.maxToughness,
      deltaTime: FIXED_STEP_MS / 1000,
      recoveryDelay: profile.recoveryDelayMs,
    });
    recovered = roundValue(
      Math.min(
        enemy.maxToughness - enemy.toughness,
        Math.max(0, Number(formula.value))
      )
    );
    if (recovered <= 0) return null;
    enemy.toughness = roundValue(enemy.toughness + recovered);
    if (enemy.toughness >= enemy.maxToughness) {
      enemy.normalRecoveryEligibleAtMs = null;
    }
    stateEventKind = 'normal-toughness-recovery';
  }

  return createWeaknessStateEvent({
    descriptor,
    scenario,
    enemy,
    before,
    recovered,
    formula,
    stateEventKind,
  });
}

function createWeaknessStateEvent({
  descriptor,
  scenario,
  enemy,
  before,
  recovered,
  formula,
  stateEventKind,
}) {
  const after = createEnemyStateSnapshot(enemy);
  const hitKey = `verified-${stateEventKind}-${timeToFrame(descriptor.timeMs)}`;
  const sourceIdentity = [
    enemy.profile.sourceIdentity,
    enemy.lastToughnessBindingIdentity,
  ]
    .filter(Boolean)
    .join('|');
  const sourceActionId = enemy.lastToughnessSourceActionId ?? null;
  const actionId = (scenario?.actions ?? []).some(
    action => action.id === sourceActionId
  )
    ? sourceActionId
    : null;
  return {
    type: 'VERIFIED_TOUGHNESS_STATE_CHANGE',
    timeMs: roundValue(descriptor.timeMs),
    actionId,
    actorId: enemy.lastToughnessSourceActorId,
    targetId: scenario?.enemy?.enemyId ?? scenario?.enemy?.id ?? null,
    hitKey,
    hitIndex: null,
    hitSkillId: null,
    payload: {
      verifiedCombat: true,
      stateEventKind,
      packageId: getInstalledVerifiedCombatMechanicsPackage()?.packageId,
      bindingIdentity: sourceIdentity,
      enemyProfileSourceIdentity: enemy.profile.sourceIdentity,
      sourceActionId,
      elementId: null,
      rawDamage: 0,
      toughnessDamage: roundValue(-recovered),
      formulaVersion: 'azpr-verified-q16.16-20260718',
      formulaBreakdown: {
        version: 'azpr-verified-weakness-state-v1',
        status: 'verified-combat-formula-applied',
        expression: formula.mode,
        result: roundValue(-recovered),
        verifiedResult: formula,
        sourceIdentity,
        appliedLayerKeys: ['verifiedWeaknessState'],
        unappliedLayerKeys: ['useOneBreak', 'unverifiedCallbacks'],
        layers: {
          verifiedWeaknessState: {
            value: roundValue(-recovered),
            applied: true,
            source: sourceIdentity,
          },
        },
      },
      segment: {
        index: 0,
        label: weaknessStateEventLabel(stateEventKind),
        multiplier: 0,
        elementId: null,
      },
      confidence: 'verified',
      precision: 'q16.16-runtime-integerized',
      timingAccuracy: 'verified-fixed-step-100ms',
      breakState: {
        before: before.toughness,
        after: after.toughness,
        maximum: enemy.maxToughness,
        triggered: false,
        inBreak: after.inBreak,
        phase: enemy.breakPhase,
      },
      stateTransaction: {
        before,
        delta: {
          enemyHp: 0,
          enemyToughness: roundValue(recovered),
        },
        after,
      },
      appliedToCalculators: true,
    },
  };
}

function applyManualResourceDescriptor({ descriptor, state, resourceEvents }) {
  const action = descriptor.action;
  const actorState = state.actorEnergy.get(action.actorId);
  if (!actorState) return;
  const actual = applyClampedResourceChange(
    actorState,
    Number(action.change) || 0
  );
  if (actual === 0) return;
  appendRuntimeEvent(
    resourceEvents,
    createActorResourceEvent({
      timeMs: descriptor.timeMs,
      action,
      actorId: action.actorId,
      resourceState: actorState,
      change: actual,
      reason: action.reason || 'manual-axis-resource',
      confidence: 'manual',
      hitKey: null,
    }),
    state
  );
}

function applyActionCostDescriptor({
  descriptor,
  state,
  resourceEvents,
  kiboResourceEvents,
}) {
  const { action, spCost, resolution } = descriptor;
  if (spCost == null) {
    return createResourceExecutionBlock({
      descriptor,
      status: 'unresolved',
      reason: 'verified-skill-cost-source-missing',
    });
  }
  if (resolution.actionBinding.ownerKind === 'kibo') {
    const kiboState = findKiboStateByAction(state, action);
    if (!kiboState) {
      return createResourceExecutionBlock({
        descriptor,
        status: 'unresolved',
        reason: 'verified-kibo-resource-owner-unresolved',
      });
    }
    const cost = spCost;
    if (kiboState.current + Number.EPSILON < cost) {
      return createResourceExecutionBlock({
        descriptor,
        status: 'violated',
        reason: 'verified-kibo-resource-insufficient',
        resourceState: kiboState,
        requiredValue: cost,
      });
    }
    const change = applyClampedResourceChange(kiboState, -cost);
    if (change !== 0) {
      appendRuntimeEvent(
        kiboResourceEvents,
        createKiboResourceEvent({
          timeMs: descriptor.timeMs,
          action,
          kiboState,
          change,
          reason: 'verified-skill-cost',
          hitKey: 'action-cost',
          source: resolution,
        }),
        state
      );
    }
    return null;
  }
  const actorState = state.actorEnergy.get(action.actorId);
  if (!actorState) {
    return createResourceExecutionBlock({
      descriptor,
      status: 'unresolved',
      reason: 'verified-actor-resource-owner-unresolved',
    });
  }
  const cost = spCost;
  if (actorState.current + Number.EPSILON < cost) {
    return createResourceExecutionBlock({
      descriptor,
      status: 'violated',
      reason: 'verified-actor-resource-insufficient',
      resourceState: actorState,
      requiredValue: cost,
    });
  }
  const change = applyClampedResourceChange(actorState, -cost);
  if (change !== 0) {
    appendRuntimeEvent(
      resourceEvents,
      createActorResourceEvent({
        timeMs: descriptor.timeMs,
        action,
        actorId: action.actorId,
        resourceState: actorState,
        change,
        reason: 'verified-skill-cost',
        confidence: 'verified',
        hitKey: 'action-cost',
        source: resolution,
      }),
      state
    );
  }
  return null;
}

function applyAutoSpDescriptor({
  descriptor,
  controlledActorTimeline,
  state,
  resourceEvents,
  kiboResourceEvents,
}) {
  const controlled = resolveControlledActorAt(
    controlledActorTimeline,
    descriptor.timeMs
  );
  for (const actorState of state.actorEnergy.values()) {
    const background = controlled?.actorId !== actorState.actor.id;
    const source = createActorSpSource(actorState, state, descriptor.timeMs);
    const remaining = Math.max(0, actorState.max - actorState.current);
    if (remaining <= 0) continue;
    const result = calculateAutoSp({
      background,
      sprSec: source.sprSec,
      sprSecBack: source.sprSecBack,
      spGetUp: source.spGetUp,
      spRetAuto: source.spRetAuto,
      tickSeconds: FIXED_STEP_MS / 1000,
      maximumSp: actorState.max,
    });
    const change = applyClampedResourceChange(actorState, result.value);
    if (change === 0) continue;
    appendRuntimeEvent(
      resourceEvents,
      createActorResourceEvent({
        timeMs: descriptor.timeMs,
        action: null,
        actorId: actorState.actor.id,
        actorName: actorState.actor.name,
        resourceState: actorState,
        change,
        reason: background
          ? 'verified-auto-sp-background'
          : 'verified-auto-sp-foreground',
        confidence: 'verified',
        hitKey: `auto-sp-${actorState.actor.id}-${timeToFrame(
          descriptor.timeMs
        )}`,
        source: {
          packageId: getInstalledVerifiedCombatMechanicsPackage()?.packageId,
          formula: result,
          sourceIdentity: source.sourceIdentity,
        },
      }),
      state
    );
  }

  for (const kiboState of state.kiboEnergy.values()) {
    const background = controlled?.actorId !== kiboState.actorId;
    const source = createKiboSpSource(kiboState, state, descriptor.timeMs);
    if (!source.applied) continue;
    const remaining = Math.max(0, kiboState.max - kiboState.current);
    if (remaining <= 0) continue;
    const result = calculateAutoSp({
      background,
      sprSec: source.sprSec,
      sprSecBack: source.sprSecBack,
      spGetUp: source.spGetUp,
      spRetAuto: source.spRetAuto,
      tickSeconds: FIXED_STEP_MS / 1000,
      maximumSp: kiboState.max,
    });
    const change = applyClampedResourceChange(kiboState, result.value);
    if (change === 0) continue;
    appendRuntimeEvent(
      kiboResourceEvents,
      createKiboResourceEvent({
        timeMs: descriptor.timeMs,
        action: null,
        kiboState,
        change,
        reason: background
          ? 'verified-auto-sp-background'
          : 'verified-auto-sp-foreground',
        hitKey: `auto-sp-${kiboState.slotId}-${timeToFrame(descriptor.timeMs)}`,
        source: {
          packageId: getInstalledVerifiedCombatMechanicsPackage()?.packageId,
          formula: result,
          sourceIdentity: source.sourceIdentity,
        },
      }),
      state
    );
  }
}

function applyDirectSpDescriptor({
  descriptor,
  state,
  resourceEvents,
  kiboResourceEvents,
}) {
  const directEvent = descriptor.directEvent;
  const directSp = directEvent.effect.directSp;
  if (directEvent.target.kind === EFFECT_TARGET_KINDS.ACTOR) {
    const sourceState = state.actorEnergy.get(directEvent.target.id);
    if (!sourceState) return;
    const source = createActorSpSource(sourceState, state, descriptor.timeMs);
    const baseValue = applyDirectSpEnhancement(
      directEvent.value,
      directSp.enhanceable,
      source.spGetUp
    );
    const actorShare = directSpShareRatio(directSp.shareType);
    for (const recipient of state.actorEnergy.values()) {
      const share = recipient === sourceState ? 1 : actorShare;
      if (share <= 0) continue;
      const change = applyClampedResourceChange(
        recipient,
        multiplyQ16(baseValue, share)
      );
      if (change === 0) continue;
      appendRuntimeEvent(
        resourceEvents,
        createActorResourceEvent({
          timeMs: descriptor.timeMs,
          action: directEvent.action,
          actorId: recipient.actor.id,
          actorName: recipient.actor.name,
          resourceState: recipient,
          change,
          reason:
            recipient === sourceState
              ? 'verified-direct-sp'
              : 'verified-direct-sp-shared',
          confidence: 'verified',
          hitKey: `${directEvent.eventIdentity}|actor|${recipient.actor.id}`,
          elementId: directEvent.effect.elementId,
          source: createDirectSpSource({
            directEvent,
            source,
            baseValue,
            share,
          }),
        }),
        state
      );
    }
    applyDirectSpToKibos({
      descriptor,
      state,
      directEvent,
      source,
      baseValue,
      kiboResourceEvents,
      directTargetKiboState: null,
    });
    return;
  }

  if (directEvent.target.kind !== EFFECT_TARGET_KINDS.KIBO) return;
  const directTargetKiboState = [...state.kiboEnergy.values()].find(
    entry => entry.actorId === directEvent.target.id
  );
  if (!directTargetKiboState) return;
  const source = createKiboSpSource(
    directTargetKiboState,
    state,
    descriptor.timeMs
  );
  const baseValue = applyDirectSpEnhancement(
    directEvent.value,
    directSp.enhanceable,
    source.spGetUp
  );
  applyDirectSpToKibos({
    descriptor,
    state,
    directEvent,
    source,
    baseValue,
    kiboResourceEvents,
    directTargetKiboState,
  });
}

function applyDirectSpToKibos({
  descriptor,
  state,
  directEvent,
  source,
  baseValue,
  kiboResourceEvents,
  directTargetKiboState,
}) {
  const directSp = directEvent.effect.directSp;
  for (const recipient of state.kiboEnergy.values()) {
    const share =
      recipient === directTargetKiboState
        ? 1
        : recipient.actorId === directEvent.actorId
          ? directSpShareRatio(directSp.mainPetShareType)
          : directSpShareRatio(directSp.petShareType);
    if (share <= 0) continue;
    const change = applyClampedResourceChange(
      recipient,
      multiplyQ16(baseValue, share)
    );
    if (change === 0) continue;
    appendRuntimeEvent(
      kiboResourceEvents,
      createKiboResourceEvent({
        timeMs: descriptor.timeMs,
        action: directEvent.action,
        kiboState: recipient,
        change,
        reason:
          recipient === directTargetKiboState
            ? 'verified-direct-sp'
            : 'verified-direct-sp-shared',
        hitKey: `${directEvent.eventIdentity}|kibo|${recipient.slotId}`,
        elementId: directEvent.effect.elementId,
        source: createDirectSpSource({
          directEvent,
          source,
          baseValue,
          share,
        }),
      }),
      state
    );
  }
}

function applyDirectSpEnhancement(value, enhanceable, spGetUp) {
  return enhanceable
    ? multiplyQ16(value, 1 + Number(spGetUp || 0))
    : roundValue(value);
}

function applyKiboPassivePeriodicHealDescriptor({
  descriptor,
  scenario,
  state,
}) {
  const schedule = descriptor.schedule;
  const target = {
    kind: schedule.targetKind,
    id: schedule.targetId,
  };
  const basePayload = createKiboPassivePeriodicHealPayload({
    descriptor,
    schedule,
  });
  if (descriptor.vitalOrderConflict) {
    return createKiboPassivePeriodicHealEvent({
      descriptor,
      schedule,
      applied: false,
      reason: 'periodic-heal-same-time-vital-order-unresolved',
      payload: {
        ...basePayload,
        sameTimeVitalOrderConflict: descriptor.vitalOrderConflict,
        appliedToCalculators: false,
      },
    });
  }
  const activeRoot = resolveActiveEffectsAt(
    state.effectTimeline,
    descriptor.timeMs,
    {
      targetKind: target.kind,
      targetId: target.id,
    }
  ).find(effect => effect.effectId === schedule.rootEffectId);
  if (!activeRoot) {
    return createKiboPassivePeriodicHealEvent({
      descriptor,
      schedule,
      applied: false,
      reason: 'periodic-heal-root-effect-inactive',
      payload: basePayload,
    });
  }
  const targetMaximum = refreshFriendlyVitalMaximumAt({
    state,
    target,
    timeMs: descriptor.timeMs,
  });
  const targetVital = resolveFriendlyVitalState(state, target);
  if (!targetVital || !targetMaximum.ready) {
    return createKiboPassivePeriodicHealEvent({
      descriptor,
      schedule,
      applied: false,
      reason: targetMaximum.reason ?? 'periodic-heal-target-vital-unresolved',
      payload: {
        ...basePayload,
        appliedToCalculators: false,
        targetMaximumHpResolution: targetMaximum,
      },
    });
  }
  const before = Number(targetVital.currentHp);
  const targetMaxHp = Number(targetVital.maximumHp);
  if (!(targetMaxHp > 0) || before >= targetMaxHp) {
    return createKiboPassivePeriodicHealEvent({
      descriptor,
      schedule,
      applied: false,
      reason: 'periodic-heal-target-current-hp-ratio-not-below-one',
      payload: {
        ...basePayload,
        beforeValue: roundValue(before),
        requestedChange: null,
        change: 0,
        afterValue: roundValue(before),
        maxValue: roundValue(targetMaxHp),
        overheal: 0,
        conditionMatched: false,
        valueShields: targetVital.valueShields.map(shield => ({ ...shield })),
      },
    });
  }
  if (before <= 0) {
    return createKiboPassivePeriodicHealEvent({
      descriptor,
      schedule,
      applied: false,
      reason: 'periodic-heal-dead-target-before-execute-rejected',
      payload: {
        ...basePayload,
        appliedToCalculators: false,
        beforeValue: roundValue(before),
        requestedChange: null,
        change: 0,
        afterValue: roundValue(before),
        maxValue: roundValue(targetMaxHp),
        overheal: 0,
        conditionMatched: true,
        valueShields: targetVital.valueShields.map(shield => ({ ...shield })),
      },
    });
  }
  if (
    schedule.sourceAttributionStatus !== 'native-first-root-source-verified' ||
    !schedule.formulaSource
  ) {
    return createKiboPassivePeriodicHealEvent({
      descriptor,
      schedule,
      applied: false,
      reason:
        schedule.sourceAttributionStatus ===
        'native-cover-survivor-order-unresolved'
          ? 'periodic-heal-native-cover-survivor-order-unresolved'
          : 'periodic-heal-root-attacker-unresolved',
      payload: {
        ...basePayload,
        appliedToCalculators: false,
        beforeValue: roundValue(before),
        requestedChange: null,
        change: 0,
        afterValue: roundValue(before),
        maxValue: roundValue(targetMaxHp),
        overheal: 0,
        conditionMatched: true,
        valueShields: targetVital.valueShields.map(shield => ({ ...shield })),
      },
    });
  }
  const formulaSource = {
    kind: schedule.formulaSource.targetKind,
    id: schedule.formulaSource.targetId,
  };
  const sourceMaximum = resolveFriendlyMaximumHpAt({
    state,
    target: formulaSource,
    timeMs: descriptor.timeMs,
  });
  const sourceHealUp = resolveFriendlyRuntimeAttribute({
    state,
    target: formulaSource,
    timeMs: descriptor.timeMs,
    attributeId: schedule.heal?.healModifierAttributes?.sourceAttributeId,
    fallbackRaw: 0,
  });
  const targetHealUp = resolveFriendlyRuntimeAttribute({
    state,
    target,
    timeMs: descriptor.timeMs,
    attributeId: schedule.heal?.healModifierAttributes?.targetAttributeId,
    fallbackRaw: 0,
  });
  if (!sourceMaximum.ready || !sourceHealUp.ready || !targetHealUp.ready) {
    return createKiboPassivePeriodicHealEvent({
      descriptor,
      schedule,
      applied: false,
      reason: 'periodic-heal-formula-attribute-unresolved',
      payload: {
        ...basePayload,
        appliedToCalculators: false,
        beforeValue: roundValue(before),
        requestedChange: null,
        change: 0,
        afterValue: roundValue(before),
        maxValue: roundValue(targetMaxHp),
        overheal: 0,
        conditionMatched: true,
        formulaAttributeResolution: {
          sourceMaximum,
          sourceHealUp,
          targetHealUp,
        },
        valueShields: targetVital.valueShields.map(shield => ({ ...shield })),
      },
    });
  }
  const coefficientRaw = Number(schedule.heal?.formula?.coefficientRaw);
  const baseFormulaValue = qToNumber(
    qMul(qFromFloat(sourceMaximum.value), qFromFloat(coefficientRaw / 10000))
  );
  const minimumNominalHeal = positiveNumber(
    schedule.heal?.formula?.minimumNominalHeal,
    1
  );
  const baseNominalHeal = Math.max(baseFormulaValue, minimumNominalHeal);
  const healUpFactor =
    1 + (Number(sourceHealUp.value) + Number(targetHealUp.value)) / 10000;
  const globalMultiplier = positiveNumber(
    scenario?.combatScenario?.healing?.globalMultiplier,
    1
  );
  const modifiedNominalHealRaw = qMul(
    qMul(qFromFloat(baseNominalHeal), qFromFloat(healUpFactor)),
    qFromFloat(globalMultiplier)
  );
  const requestedChange = Number(runtimeIntegerize(modifiedNominalHealRaw));
  targetVital.currentHp = clampNumber(before + requestedChange, 0, targetMaxHp);
  const change = targetVital.currentHp - before;
  return createKiboPassivePeriodicHealEvent({
    descriptor,
    schedule,
    applied: change > 0,
    reason:
      change > 0
        ? 'periodic-heal-applied'
        : 'periodic-heal-no-positive-effective-change',
    payload: {
      ...basePayload,
      beforeValue: roundValue(before),
      requestedChange: roundValue(requestedChange),
      change: roundValue(change),
      afterValue: roundValue(targetVital.currentHp),
      maxValue: roundValue(targetMaxHp),
      overheal: roundValue(Math.max(0, requestedChange - change)),
      conditionMatched: true,
      coefficientRaw,
      baseFormulaValue: roundValue(baseFormulaValue),
      baseNominalHeal: roundValue(baseNominalHeal),
      sourceMaxHp: roundValue(sourceMaximum.value),
      sourceShootHealUpRaw: roundValue(sourceHealUp.value),
      targetSufferHealUpRaw: roundValue(targetHealUp.value),
      healUpFactor: roundValue(healUpFactor),
      globalMultiplier: roundValue(globalMultiplier),
      roundingPolicy: 'nearest-ties-to-even',
      configuredPostFunctionRuntimeStatus:
        schedule.heal?.formula?.configuredPostRuntimeStatus ?? null,
      formulaSource: { ...schedule.formulaSource },
      valueShields: targetVital.valueShields.map(shield => ({ ...shield })),
      formulaAttributeTrace: {
        sourceMaximum,
        sourceHealUp,
        targetHealUp,
      },
    },
  });
}

function resolveFriendlyRuntimeAttribute({
  state,
  target,
  timeMs,
  attributeId,
  fallbackRaw = null,
  settlingActionId = null,
  settlingSourceSequencePath = null,
}) {
  const normalizedAttributeId = Number(attributeId);
  if (!Number.isInteger(normalizedAttributeId)) {
    return {
      ready: false,
      reason: 'friendly-runtime-attribute-id-invalid',
      value: null,
    };
  }
  const stateEntry =
    target.kind === EFFECT_TARGET_KINDS.ACTOR
      ? state.actorEnergy.get(String(target.id))
      : target.kind === EFFECT_TARGET_KINDS.KIBO
        ? [...state.kiboEnergy.values()].find(
            entry => String(entry.actorId) === String(target.id)
          )
        : null;
  if (!stateEntry) {
    return {
      ready: false,
      reason: 'friendly-runtime-attribute-owner-missing',
      value: null,
    };
  }
  return resolveRuntimeAttribute({
    state,
    targetKind: target.kind,
    targetId: target.id,
    timeMs,
    attributeId: normalizedAttributeId,
    baseRaw:
      stateEntry.attributesById?.get(normalizedAttributeId) ?? fallbackRaw,
    settlingActionId,
    settlingSourceSequencePath,
  });
}

function createKiboPassivePeriodicHealPayload({ descriptor, schedule }) {
  return {
    status: 'verified-kibo-passive-periodic-heal',
    passiveSkillId: schedule.passiveSkillId,
    passiveName: schedule.passiveName,
    rootEffectId: schedule.rootEffectId,
    rootElementId: schedule.rootElementId,
    healElementId: schedule.heal?.sourceElementId ?? null,
    targetKind: schedule.targetKind,
    targetActorId: schedule.targetActorId ?? schedule.targetId,
    targetKiboId: schedule.targetKiboId ?? null,
    targetSlotId: schedule.targetSlotId ?? null,
    targetPosition: schedule.targetPosition ?? null,
    frameIndex: descriptor.frameIndex,
    tickIndex: descriptor.tickIndex,
    thresholdMs: descriptor.thresholdMs,
    intervalMs: schedule.trigger?.intervalMs ?? null,
    sourceAttributionStatus: schedule.sourceAttributionStatus,
    sourceSelectionPolicy: schedule.sourceSelectionPolicy,
    contributingSources: (schedule.contributingSources ?? []).map(source => ({
      ...source,
    })),
    sourceIdentity: schedule.sourceIdentity,
    appliedToCalculators: true,
  };
}

function createKiboPassivePeriodicHealEvent({
  descriptor,
  schedule,
  applied,
  reason,
  payload,
}) {
  const singleSource =
    schedule.contributingSources?.length === 1
      ? schedule.contributingSources[0]
      : null;
  const sourceEventIdentity = [
    'kibo-periodic-heal',
    schedule.id,
    `tick:${descriptor.tickIndex}`,
    `frame:${descriptor.frameIndex}`,
    `source:${singleSource?.sourceActorId ?? 'unresolved'}`,
    `target:${schedule.targetKind}:${schedule.targetId}`,
  ].join('|');
  const sourceSequencePath = Array.isArray(descriptor.sourceSequencePath)
    ? [...descriptor.sourceSequencePath]
    : null;
  return {
    type: applied
      ? 'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL'
      : 'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL_SUPPRESSED',
    timeMs: descriptor.timeMs,
    actionId: null,
    actorId: singleSource?.sourceActorId ?? null,
    targetId: schedule.targetId,
    sourceSequencePath,
    payload: {
      ...payload,
      applied,
      reason,
      afterHealDispatchEligible:
        reason === 'periodic-heal-applied' ||
        reason === 'periodic-heal-no-positive-effective-change',
      actionProvenanceAvailable: false,
      sourceEventIdentity,
      sourceSequencePath,
      sourceActorId: singleSource?.sourceActorId ?? null,
      sourceKiboId: singleSource?.sourceKiboId ?? null,
      sourceSlotId: singleSource?.sourceSlotId ?? null,
      sourcePosition: singleSource?.sourcePosition ?? null,
    },
  };
}

function directSpShareRatio(shareType) {
  if (Number(shareType) === 1) return 0.5;
  if (Number(shareType) === 2) return 1;
  return 0;
}

function createDirectSpSource({ directEvent, source, baseValue, share }) {
  return {
    packageId: directEvent.resolution.packageId,
    sourceIdentity: directEvent.sourceIdentity,
    share,
    formula: {
      route: 'direct-SpElement',
      rawValue: directEvent.value,
      enhanceable: directEvent.effect.directSp.enhanceable,
      sourceSpGetUp: source.spGetUp,
      valueAfterSourceEnhancement: baseValue,
      share,
      appliedToCalculators: true,
    },
  };
}

function applyDirectHealDescriptor({ descriptor, state }) {
  const directEvent = descriptor.directEvent;
  if (directEvent.target.kind === EFFECT_TARGET_KINDS.ENEMY) {
    const before = state.enemy.hp;
    state.enemy.hp = clampNumber(
      state.enemy.hp + directEvent.value,
      0,
      state.enemy.maxHp
    );
    return createDirectVitalEvent({
      type: 'VERIFIED_DIRECT_HEAL',
      descriptor,
      before,
      after: state.enemy.hp,
      maximum: state.enemy.maxHp,
    });
  }
  const vital = resolveFriendlyVitalState(state, directEvent.target);
  if (!vital) return null;
  refreshFriendlyVitalMaximumAt({
    state,
    target: directEvent.target,
    timeMs: descriptor.timeMs,
  });
  const before = vital.currentHp;
  if (!(Number(before) > 0)) {
    return createDirectVitalEvent({
      type: 'VERIFIED_DIRECT_HEAL',
      descriptor,
      before,
      after: before,
      maximum: vital.maximumHp,
      vital,
      applied: false,
      reason: 'direct-heal-dead-target-rejected',
      requestedChange: 0,
    });
  }
  const formula = resolveDirectHealFormula({ descriptor, state });
  vital.currentHp = clampNumber(
    vital.currentHp + formula.requestedChange,
    0,
    vital.maximumHp
  );
  return createDirectVitalEvent({
    type: 'VERIFIED_DIRECT_HEAL',
    descriptor,
    before,
    after: vital.currentHp,
    maximum: vital.maximumHp,
    vital,
    requestedChange: formula.requestedChange,
    formulaPayload: formula.payload,
  });
}

function resolveDirectHealFormula({ descriptor, state }) {
  const directEvent = descriptor.directEvent;
  const sourceTarget = resolveDirectHealSourceTarget(directEvent);
  const targetVital = resolveFriendlyVitalState(state, directEvent.target);
  const sourceAttributeId = state.attributeIdByKey.get('SHOOT_HEALUP') ?? 23;
  const targetAttributeId = state.attributeIdByKey.get('SUFFER_HEALUP') ?? 24;
  const resolutionOptions = {
    state,
    timeMs: descriptor.timeMs,
    fallbackRaw: 0,
    settlingActionId: directEvent.actionId,
    settlingSourceSequencePath: descriptor.sourceSequencePath,
  };
  const sourceHealUp = resolveFriendlyRuntimeAttribute({
    ...resolutionOptions,
    target: sourceTarget,
    attributeId: sourceAttributeId,
  });
  const targetHealUp = resolveFriendlyRuntimeAttribute({
    ...resolutionOptions,
    target: directEvent.target,
    attributeId: targetAttributeId,
  });
  const formulaContract = directEvent.effect?.heal?.formula ?? null;
  const baseFunctionId = Number(formulaContract?.baseFunctionId);
  const commonFunctionId = Number(formulaContract?.commonFunctionId);
  const sourceRawA = Number(
    formulaContract?.sourceRawA ?? directEvent.formulaResult?.sourceRawA
  );
  const targetMaximumHp = Number(targetVital?.maximumHp);
  const usesMaximumHpRatioFormula = baseFunctionId === 108;
  const baseFormulaReady = usesMaximumHpRatioFormula
    ? commonFunctionId === 1 &&
      Number.isFinite(sourceRawA) &&
      Number.isFinite(targetMaximumHp)
    : Number.isFinite(Number(directEvent.value));
  const baseRaw = usesMaximumHpRatioFormula
    ? baseFormulaReady
      ? qMul(qFromFloat(targetMaximumHp), qFromFloat(sourceRawA / 10000))
      : qFromInt(0)
    : qFromFloat(Number(directEvent.value));
  const baseRequestedChange = qToNumber(baseRaw);
  const formulaReady =
    baseFormulaReady && sourceHealUp.ready && targetHealUp.ready;
  const sourceShootHealUpRaw = formulaReady ? Number(sourceHealUp.value) : 0;
  const targetSufferHealUpRaw = formulaReady ? Number(targetHealUp.value) : 0;
  const healUpFactor =
    1 + (sourceShootHealUpRaw + targetSufferHealUpRaw) / 10000;
  const factorRaw = qFromFloat(healUpFactor);
  const resultRaw = qMul(baseRaw, factorRaw);
  const requestedChange = Number(runtimeIntegerize(resultRaw));
  return {
    requestedChange,
    payload: {
      formulaStatus: formulaReady
        ? 'verified-direct-heal-modifier-applied'
        : baseFormulaReady
          ? 'verified-direct-heal-modifier-attribute-unresolved'
          : 'verified-direct-heal-base-formula-unresolved',
      formulaIdentity:
        formulaContract?.formulaIdentity ??
        directEvent.formulaResult?.formulaIdentity ??
        null,
      commonFunctionId: Number.isInteger(commonFunctionId)
        ? commonFunctionId
        : null,
      baseFunctionId: Number.isInteger(baseFunctionId) ? baseFunctionId : null,
      sourceRawA: Number.isFinite(sourceRawA) ? sourceRawA : null,
      targetMaximumHp: Number.isFinite(targetMaximumHp)
        ? roundValue(targetMaximumHp)
        : null,
      baseExpression: formulaContract?.baseExpression ?? null,
      baseRequestedChange: roundValue(baseRequestedChange),
      sourceShootHealUpRaw: roundValue(sourceShootHealUpRaw),
      targetSufferHealUpRaw: roundValue(targetSufferHealUpRaw),
      healUpFactor: roundValue(healUpFactor),
      roundingPolicy: 'nearest-ties-to-even',
      formulaAttributeTrace: {
        sourceHealUp,
        targetHealUp,
      },
      formulaQ16Trace: {
        targetMaximumRaw: Number.isFinite(targetMaximumHp)
          ? qFromFloat(targetMaximumHp).toString()
          : null,
        sourceRatioRaw: Number.isFinite(sourceRawA)
          ? qFromFloat(sourceRawA / 10000).toString()
          : null,
        baseRaw: baseRaw.toString(),
        factorRaw: factorRaw.toString(),
        resultRaw: resultRaw.toString(),
      },
    },
  };
}

function resolveDirectHealSourceTarget(directEvent) {
  const sourceKind =
    directEvent.resolution?.actionBinding?.ownerKind === 'kibo' ||
    directEvent.action?.type === ACTION_TYPES.KIBO_EVENT
      ? EFFECT_TARGET_KINDS.KIBO
      : EFFECT_TARGET_KINDS.ACTOR;
  return {
    kind: sourceKind,
    id: directEvent.actorId,
  };
}

function applyDirectShieldDescriptor({ descriptor, state }) {
  const directEvent = descriptor.directEvent;
  if (!(Number(directEvent.value) > 0)) {
    return createDirectVitalEvent({
      type: 'VERIFIED_DIRECT_SHIELD',
      descriptor,
      before: 0,
      after: 0,
      maximum: null,
      applied: false,
      reason: 'direct-shield-non-positive-value-rejected',
    });
  }
  if (directEvent.target.kind === EFFECT_TARGET_KINDS.ENEMY) {
    state.enemy.valueShields.push({
      raw: String(qFromFloat(directEvent.value)),
      sourceIdentity: directEvent.sourceIdentity,
    });
    return createDirectVitalEvent({
      type: 'VERIFIED_DIRECT_SHIELD',
      descriptor,
      before: 0,
      after: directEvent.value,
      maximum: null,
    });
  }
  const vital = resolveFriendlyVitalState(state, directEvent.target);
  if (!vital) return null;
  vital.valueShields.push({
    value: directEvent.value,
    sourceIdentity: directEvent.sourceIdentity,
  });
  return createDirectVitalEvent({
    type: 'VERIFIED_DIRECT_SHIELD',
    descriptor,
    before: 0,
    after: directEvent.value,
    maximum: null,
    vital,
  });
}

function createDirectVitalEvent({
  type,
  descriptor,
  before,
  after,
  maximum,
  vital = null,
  applied = true,
  reason = null,
  requestedChange: suppliedRequestedChange = null,
  formulaPayload = null,
}) {
  const directEvent = descriptor.directEvent;
  const requestedChange =
    type === 'VERIFIED_DIRECT_HEAL' && suppliedRequestedChange != null
      ? Number(suppliedRequestedChange)
      : type === 'VERIFIED_DIRECT_HEAL'
        ? Number(directEvent.value)
        : Number(after) - Number(before);
  const change = Number(after) - Number(before);
  return {
    type,
    timeMs: descriptor.timeMs,
    actionId: directEvent.actionId,
    actorId: directEvent.actorId,
    targetId: directEvent.target.id,
    sourceSequencePath: descriptor.sourceSequencePath ?? null,
    payload: {
      before: roundValue(before),
      change: roundValue(change),
      after: roundValue(after),
      maximum: maximum == null ? null : roundValue(maximum),
      beforeValue: roundValue(before),
      requestedChange: roundValue(requestedChange),
      afterValue: roundValue(after),
      maxValue: maximum == null ? null : roundValue(maximum),
      overheal:
        type === 'VERIFIED_DIRECT_HEAL'
          ? roundValue(Math.max(0, requestedChange - change))
          : 0,
      targetKind: directEvent.target.kind,
      sourceActorId: directEvent.actorId,
      sourceEventIdentity: directEvent.eventIdentity,
      sourceActionId: directEvent.actionId,
      sourceSequencePath: descriptor.sourceSequencePath ?? null,
      afterHealDispatchEligible:
        type === 'VERIFIED_DIRECT_HEAL' && applied === true,
      actionProvenanceAvailable: true,
      targetSlotId: vital?.slotId ?? null,
      targetKiboId: vital?.kiboId ?? null,
      valueShields: vital
        ? vital.valueShields.map(shield => ({ ...shield }))
        : [],
      effectIdentity: directEvent.effect.effectIdentity,
      sourceIdentity: directEvent.sourceIdentity,
      applied,
      reason,
      appliedToCalculators: applied,
      ...(formulaPayload ?? {}),
    },
  };
}

function createDirectEffectSourceSequenceUnresolvedEvent(descriptor) {
  const directEvent = descriptor.directEvent ?? {};
  return {
    type: 'VERIFIED_DIRECT_EFFECT_SOURCE_SEQUENCE_UNRESOLVED',
    timeMs: descriptor.timeMs,
    absoluteFrame: descriptor.absoluteFrame,
    actionId: directEvent.actionId ?? descriptor.action?.id ?? null,
    actorId: directEvent.actorId ?? descriptor.action?.actorId ?? null,
    targetId: directEvent.target?.id ?? null,
    sourceSequencePath: null,
    payload: {
      reason: 'verified-direct-effect-source-sequence-unresolved',
      directEffectKind: descriptor.kind,
      sourceEventIdentity: directEvent.eventIdentity ?? null,
      sourceIdentity: directEvent.sourceIdentity ?? null,
      sourceSequenceStatus:
        directEvent.sourceSequenceStatus ??
        'verified-direct-effect-source-sequence-unresolved',
      appliedToCalculators: false,
    },
    appliedToCalculators: false,
  };
}

function applyKiboPassiveRetaliationHitDescriptor({
  descriptor,
  scenario,
  state,
}) {
  const command = descriptor.passiveRetaliationCommand ?? {};
  const hit = descriptor.hit ?? {};
  const kiboState = findKiboStateByActorId(
    state,
    command.sourceActorId,
    command.sourceKiboId
  );
  const propertyTags = [];
  const settlingSourceSequencePath = descriptor.sourceSequencePath ?? null;
  const sourceAttribute = resolveRuntimeAttribute({
    state,
    targetKind: EFFECT_TARGET_KINDS.KIBO,
    targetId: String(command.sourceActorId),
    timeMs: descriptor.timeMs,
    attributeId: 1,
    baseRaw:
      kiboState?.attributesById?.get(1) ??
      numberOrNull(kiboState?.profile?.attack),
    propertyTags,
    settlingSourceSequencePath,
  });
  const targetDefenseResult = resolveRuntimeAttribute({
    state,
    targetKind: EFFECT_TARGET_KINDS.ENEMY,
    targetId: scenario?.enemy?.id,
    timeMs: descriptor.timeMs,
    attributeId: 3,
    baseRaw: scenario?.enemy?.stats?.physicalDefense,
    propertyTags,
    settlingSourceSequencePath,
  });
  const targetMagicDefenseResult = resolveRuntimeAttribute({
    state,
    targetKind: EFFECT_TARGET_KINDS.ENEMY,
    targetId: scenario?.enemy?.id,
    timeMs: descriptor.timeMs,
    attributeId: 4,
    baseRaw: scenario?.enemy?.stats?.magicalDefense,
    propertyTags,
    settlingSourceSequencePath,
  });
  const targetDefense = numberOrNull(targetDefenseResult.value);
  const targetMagicDefense = numberOrNull(targetMagicDefenseResult.value);
  const ratioBasisPoints = numberOrNull(hit.formula?.coefficientRaw);
  const enemy = state.enemy;
  const enemyProfile = enemy.profile;
  let inputIssue = null;
  if (!sourceAttribute.ready || sourceAttribute.value == null) {
    inputIssue =
      sourceAttribute.status ?? 'verified-retaliation-source-missing';
  } else if (!enemyProfile?.applied) {
    inputIssue = 'verified-enemy-break-profile-missing';
  } else if (ratioBasisPoints == null) {
    inputIssue = 'verified-retaliation-ratio-missing';
  } else if (targetDefense == null || targetMagicDefense == null) {
    inputIssue = 'verified-enemy-defense-inputs-missing';
  }
  if (inputIssue) {
    return {
      status: 'verified-retaliation-hit-inputs-incomplete',
      reason: inputIssue,
      source: sourceAttribute,
      ready: false,
      applied: false,
    };
  }
  const damageInput = {
    attack: Number(sourceAttribute.value),
    ratioBasisPoints,
    targetLevel: positiveNumber(scenario?.enemy?.level, 1),
    targetDefense:
      targetDefense * positiveNumber(scenario?.enemy?.defenseMultiplier, 1),
    targetMagicDefense:
      targetMagicDefense *
      positiveNumber(scenario?.enemy?.defenseMultiplier, 1),
    physicalPenetrationBasisPoints: combinePenetrationBasisPoints(
      hit.damage?.physicalPenetrationBasisPoints,
      null
    ),
    magicPenetrationBasisPoints: combinePenetrationBasisPoints(
      hit.damage?.magicPenetrationBasisPoints,
      null
    ),
    elementCalculationFactor: basisPoints(
      hit.damage?.elementCalculationFactorBasisPoints,
      1
    ),
    attackerElementUp: 0,
    targetElementDefense: resolveEnemyElementDefense(
      scenario.enemy,
      hit.damage?.elementalType,
      state,
      descriptor.timeMs,
      propertyTags
    ),
    physicalRatio: basisPoints(hit.damage?.physicalRatioBasisPoints),
    magicRatio: basisPoints(hit.damage?.magicRatioBasisPoints),
    attackerPhysicalUp: 0,
    attackerMagicUp: 0,
    targetPhysicalDown: 0,
    targetMagicDown: 0,
    attackerDamageUp: 0,
    targetDamageDown: 0,
    skillTags: [],
    hitLocationRatio: 1,
    critical: false,
    criticalDamage: 0,
    levelPressure: 1,
    restraintDelta: 0,
    miscellaneous: 1,
    inWeakState: enemy.inBreak,
    breakDamageUp: basisPoints(enemyProfile.breakDamageUpBasisPoints),
    outputType: hit.damage?.damageType,
    outputElement: hit.damage?.elementalType,
    ...createEnemyDamageHpProtectionInput(enemy),
    valueShields: enemy.valueShields,
    hitCountShields: enemy.hitCountShields,
  };
  const damageResult = calculateNormalDamage(damageInput);
  const stateBefore = createEnemyStateSnapshot(enemy);
  enemy.hp = clampNumber(
    Number(enemy.hp) - Number(damageResult.raw ?? 0),
    0,
    positiveNumber(enemy.maxHp, enemy.hp)
  );
  enemy.hitCountShields = damageResult.remainingHitCountShields ?? [];
  enemy.valueShields = (damageResult.remainingShields ?? []).map(raw => ({
    raw: String(raw),
  }));
  const toughnessBefore = enemy.toughness;
  const preShieldHpDamageRaw = damageResult.preShieldRaw ?? damageResult.raw;
  const weaknessResult = calculateWeaknessDamage({
    pure: false,
    attack: Number(sourceAttribute.value),
    ratioBasisPoints,
    outputDamageRaw: preShieldHpDamageRaw,
    outputType: hit.damage?.damageType,
    inWeakState: enemy.inBreak,
    worldEventConflictPer: 1,
    typeMultiplier: 1,
    elementMultiplier: 1,
    weaknessSkillDamageUp: 1,
    weakBreakDamageRateBasisPoints: hit.damage?.weakBreakDamageRateBasisPoints,
    maximum: positiveNumberOrNull(enemyProfile.weaknessDamageMaximum),
    minimum: positiveNumberOrNull(enemyProfile.weaknessDamageMinimum),
  });
  const toughnessDamage = Math.min(
    enemy.toughness,
    Math.max(0, Number(weaknessResult.deducted ?? 0))
  );
  enemy.toughness = roundValue(enemy.toughness - toughnessDamage);
  const breakTriggered =
    enemy.targetPolicy?.breakMode === 'enabled' &&
    enemy.targetPolicy?.toughnessMode === 'enabled' &&
    !enemy.inBreak &&
    toughnessBefore > 0 &&
    enemy.toughness <= 0;
  if (breakTriggered) {
    enemy.inBreak = true;
    enemy.breakStartedAtMs = descriptor.timeMs;
    enemy.breakPhase = 'linear_recovery';
    enemy.normalRecoveryEligibleAtMs = null;
  } else if (!enemy.inBreak && toughnessDamage > 0) {
    enemy.normalRecoveryEligibleAtMs =
      descriptor.timeMs + nonNegativeNumber(enemyProfile.recoveryDelayMs);
  }
  const hpDamage = Math.max(0, Number(damageResult.raw ?? 0));
  const hitKey = `kibo-passive-retaliation|${command.passiveSkillId ?? 'skill'}|${
    command.retaliationEventIdentity ?? 'event'
  }|${roundValue(descriptor.timeMs)}`;
  const damageEvent = {
    type: 'VERIFIED_COMBAT_HIT',
    timeMs: roundValue(descriptor.timeMs),
    actionId: null,
    actorId: command.sourceActorId ?? null,
    targetId: scenario.enemy.id,
    hitKey,
    hitIndex: 1,
    hitSkillId: null,
    payload: {
      verifiedCombat: true,
      kiboPassiveRetaliationDamage: true,
      passiveSkillId: command.passiveSkillId ?? null,
      sourceKiboId: command.sourceKiboId ?? null,
      receiveDamageEventIdentity: command.retaliationEventIdentity ?? null,
      ignoreDamageEvent: command.ignoreDamageEvent === true,
      emitsDamageTriggerEvents: command.emitsDamageTriggerEvents === true,
      recursivePassiveTrigger: command.recursivePassiveTrigger === true,
      elementId: hit.elementId ?? null,
      pathId: hit.pathId ?? null,
      damageType: hit.damage?.damageType ?? null,
      elementalType: hit.damage?.elementalType ?? null,
      attack: Number(sourceAttribute.value),
      attackSource: sourceAttribute.sourceIdentity ?? null,
      dynamicPropertyTrace: {
        source: collectDynamicPropertyTrace([sourceAttribute]),
        target: collectDynamicPropertyTrace([
          targetDefenseResult,
          targetMagicDefenseResult,
        ]),
      },
      rawDamage: roundValue(hpDamage),
      toughnessDamage: roundValue(toughnessDamage),
      hpLossPercent: ratioOrZero(hpDamage, enemy.maxHp),
      toughnessLossPercent: ratioOrZero(toughnessDamage, enemy.maxToughness),
      formulaVersion: 'azpr-verified-q16.16-20260718',
      formulaBreakdown: {
        version: 'azpr-verified-retaliation-hit-v1',
        status: 'verified-retaliation-formula-applied',
        expression: damageResult.mode ?? 'normal',
        result: hpDamage,
        verifiedResult: damageResult,
        weaknessResult,
        sourceIdentity: command.sourceIdentity?.catalogKind ?? null,
        appliedLayerKeys: ['verifiedRetaliationHit'],
        unappliedLayerKeys: ['cultivationEffects', 'unverifiedCallbacks'],
        layers: {
          verifiedRetaliationHit: {
            value: hpDamage,
            applied: true,
            source: command.sourceIdentity?.actionBindingIdentity ?? null,
          },
        },
      },
      stateBefore,
      appliedToCalculators: true,
    },
  };
  return {
    ready: true,
    status: 'verified-retaliation-hit-applied',
    hitKey,
    hpDamage,
    toughnessDamage,
    damageEvent,
  };
}

function applyKiboPassiveDerivedDotDescriptor({ descriptor, state }) {
  const schedule = descriptor.schedule ?? {};
  const dot = schedule.derivedPeriodic?.dot ?? null;
  const basePayload = {
    passiveSkillId: schedule.passiveSkillId ?? null,
    sourceKiboId: schedule.sourceKiboId ?? null,
    sourceActorId: schedule.sourceActorId ?? null,
    elementId: dot?.sourceElementId ?? null,
    pathId: dot?.sourcePathId ?? null,
    damageType: dot?.damage?.damageType ?? null,
    tickIndex: descriptor.tickIndex,
    thresholdMs: descriptor.thresholdMs,
  };
  const createEvent = payload =>
    createKiboPassiveDerivedDotEvent({ descriptor, schedule, payload });
  if (!dot) {
    return createEvent({
      ...basePayload,
      beforeValue: null,
      requestedDamage: null,
      appliedDamage: 0,
      change: 0,
      afterValue: null,
      lethal: false,
      applied: false,
      reason: 'kibo-passive-derived-dot-config-missing',
      appliedToCalculators: false,
    });
  }
  const timeMs = descriptor.timeMs;
  const kiboState = findKiboStateByActorId(
    state,
    schedule.sourceKiboActorId,
    schedule.sourceKiboId
  );
  const sourceAttribute = resolveRuntimeAttribute({
    state,
    targetKind: EFFECT_TARGET_KINDS.KIBO,
    targetId: String(schedule.sourceKiboActorId),
    timeMs,
    attributeId: 1,
    baseRaw:
      kiboState?.attributesById?.get(1) ??
      numberOrNull(kiboState?.profile?.attack),
    propertyTags: [],
    settlingSourceSequencePath: descriptor.sourceSequencePath,
  });
  if (!sourceAttribute.ready || sourceAttribute.value == null) {
    return createEvent({
      ...basePayload,
      beforeValue: roundValue(state.enemy.hp),
      requestedDamage: null,
      appliedDamage: 0,
      change: 0,
      afterValue: roundValue(state.enemy.hp),
      lethal: false,
      applied: false,
      reason: 'kibo-passive-derived-dot-source-attribute-unresolved',
      sourceAttribute,
      appliedToCalculators: false,
    });
  }
  const coefficientRaw = Number(dot.formula?.coefficientRaw);
  const formulaRaw = qDivNearestPositive(
    qMul(qFromFloat(Number(sourceAttribute.value)), qFromInt(coefficientRaw)),
    qFromInt(10_000)
  );
  const before = Number(state.enemy.hp);
  const damageResult = calculateRealDamage({
    baseRaw: formulaRaw,
    worldEventConflictPer: 1,
    hitLocationRatio: 1,
    blockMiscellaneous: true,
    miscellaneous: 1,
    inWeakState: false,
    breakDamageUp: 0,
    currentHp: before,
    minimumRemainingHp: 0,
  });
  const requestedDamage = Math.max(0, Number(damageResult.value));
  const appliedDamage = Math.min(before, requestedDamage);
  state.enemy.hp = clampNumber(
    before - appliedDamage,
    0,
    positiveNumber(state.enemy.maxHp, before)
  );
  const lethal = before > 0 && state.enemy.hp <= 0;
  const applied = appliedDamage > 0;
  return createEvent({
    ...basePayload,
    attack: Number(sourceAttribute.value),
    sourceAttribute,
    coefficientRaw,
    coefficientBasisPoints: coefficientRaw,
    formulaRaw: formulaRaw.toString(),
    formulaResult: damageResult,
    beforeValue: roundValue(before),
    requestedDamage: roundValue(requestedDamage),
    appliedDamage: roundValue(appliedDamage),
    rawDamage: roundValue(appliedDamage),
    change: roundValue(-appliedDamage),
    afterValue: roundValue(state.enemy.hp),
    hpLossPercent: ratioOrZero(appliedDamage, state.enemy.maxHp),
    lethal,
    applied,
    reason: applied
      ? 'kibo-passive-derived-dot-applied'
      : 'kibo-passive-derived-dot-no-effective-change',
    appliedToCalculators: true,
  });
}

function createKiboPassiveDerivedDotEvent({ descriptor, schedule, payload }) {
  return {
    type: 'VERIFIED_COMBAT_HIT',
    timeMs: roundValue(descriptor.timeMs),
    actionId: null,
    actorId: schedule.sourceActorId ?? null,
    targetId: schedule.targetId ?? null,
    hitKey: `kibo-passive-derived-dot|${schedule.passiveSkillId ?? 'skill'}|${
      payload.elementId ?? 'element'
    }|${descriptor.tickIndex ?? 'tick'}|${roundValue(descriptor.timeMs)}`,
    hitIndex: (descriptor.tickIndex ?? 0) + 1,
    hitSkillId: null,
    payload: {
      verifiedCombat: true,
      kiboPassiveDerivedDot: true,
      toughnessDamage: 0,
      sourceSequencePath: descriptor.sourceSequencePath ?? null,
      ...payload,
    },
  };
}

function applyKiboPassiveDerivedSelfHealDescriptor({ descriptor, state }) {
  const schedule = descriptor.schedule ?? {};
  const heal = schedule.derivedPeriodic?.heal ?? null;
  const basePayload = {
    passiveSkillId: schedule.passiveSkillId ?? null,
    sourceKiboId: schedule.sourceKiboId ?? null,
    sourceActorId: schedule.sourceActorId ?? null,
    targetKiboId: schedule.targetKiboId ?? null,
    targetSlotId: schedule.targetSlotId ?? null,
    elementId: heal?.sourceElementId ?? null,
    pathId: heal?.sourcePathId ?? null,
    damageType: heal?.heal?.damageType ?? null,
    tickIndex: descriptor.tickIndex,
    thresholdMs: descriptor.thresholdMs,
  };
  const createEvent = payload =>
    createKiboPassiveDerivedSelfHealEvent({ descriptor, schedule, payload });
  if (!heal) {
    return createEvent({
      ...basePayload,
      beforeValue: null,
      requestedHeal: null,
      appliedHeal: 0,
      change: 0,
      afterValue: null,
      maxValue: null,
      applied: false,
      reason: 'kibo-passive-derived-self-heal-config-missing',
      appliedToCalculators: false,
    });
  }
  const timeMs = descriptor.timeMs;
  const target = {
    kind: schedule.targetKind,
    id: String(schedule.targetId),
  };
  const kiboState = findKiboStateByActorId(
    state,
    schedule.sourceKiboActorId,
    schedule.sourceKiboId
  );
  const vital = resolveFriendlyVitalState(state, target);
  if (!vital) {
    return createEvent({
      ...basePayload,
      beforeValue: null,
      requestedHeal: null,
      appliedHeal: 0,
      change: 0,
      afterValue: null,
      maxValue: null,
      applied: false,
      reason: 'kibo-passive-derived-self-heal-target-state-missing',
      appliedToCalculators: false,
    });
  }
  const maximum = refreshFriendlyVitalMaximumAt({
    state,
    target,
    timeMs,
  });
  if (!maximum.ready) {
    return createEvent({
      ...basePayload,
      beforeValue: roundValue(vital.currentHp),
      requestedHeal: null,
      appliedHeal: 0,
      change: 0,
      afterValue: roundValue(vital.currentHp),
      maxValue: roundValue(vital.maximumHp),
      applied: false,
      reason: 'kibo-passive-derived-self-heal-maximum-hp-unresolved',
      maximumResolution: maximum,
      appliedToCalculators: false,
    });
  }
  const sourceAttribute = resolveRuntimeAttribute({
    state,
    targetKind: EFFECT_TARGET_KINDS.KIBO,
    targetId: String(schedule.sourceKiboActorId),
    timeMs,
    attributeId: 1,
    baseRaw:
      kiboState?.attributesById?.get(1) ??
      numberOrNull(kiboState?.profile?.attack),
    propertyTags: [],
    settlingSourceSequencePath: descriptor.sourceSequencePath,
  });
  if (!sourceAttribute.ready || sourceAttribute.value == null) {
    return createEvent({
      ...basePayload,
      beforeValue: roundValue(vital.currentHp),
      requestedHeal: null,
      appliedHeal: 0,
      change: 0,
      afterValue: roundValue(vital.currentHp),
      maxValue: roundValue(vital.maximumHp),
      applied: false,
      reason: 'kibo-passive-derived-self-heal-source-attribute-unresolved',
      sourceAttribute,
      appliedToCalculators: false,
    });
  }
  const coefficientRaw = Number(heal.formula?.coefficientRaw);
  const formulaRaw = qDivNearestPositive(
    qMul(qFromFloat(Number(sourceAttribute.value)), qFromInt(coefficientRaw)),
    qFromInt(10_000)
  );
  const before = Number(vital.currentHp);
  const maximumHp = Number(vital.maximumHp);
  const requestedHeal = Math.max(0, qToNumber(formulaRaw));
  const appliedHeal = Math.min(requestedHeal, Math.max(0, maximumHp - before));
  vital.currentHp = clampNumber(before + appliedHeal, 0, maximumHp);
  const applied = appliedHeal > 0;
  return createEvent({
    ...basePayload,
    sourceAttribute,
    coefficientRaw,
    coefficientBasisPoints: coefficientRaw,
    formulaRaw: formulaRaw.toString(),
    beforeValue: roundValue(before),
    requestedHeal: roundValue(requestedHeal),
    appliedHeal: roundValue(appliedHeal),
    change: roundValue(appliedHeal),
    afterValue: roundValue(vital.currentHp),
    maxValue: roundValue(maximumHp),
    overheal: roundValue(Math.max(0, requestedHeal - appliedHeal)),
    applied,
    reason: applied
      ? 'kibo-passive-derived-self-heal-applied'
      : 'kibo-passive-derived-self-heal-no-positive-effective-change',
    appliedToCalculators: true,
  });
}

function createKiboPassiveDerivedSelfHealEvent({
  descriptor,
  schedule,
  payload,
}) {
  return {
    type: 'VERIFIED_KIBO_PASSIVE_DERIVED_SELF_HEAL',
    timeMs: roundValue(descriptor.timeMs),
    actionId: null,
    actorId: schedule.sourceActorId ?? null,
    targetId: schedule.targetId ?? null,
    sourceSequencePath: descriptor.sourceSequencePath ?? null,
    payload: {
      verifiedKiboPassiveDerivedSelfHeal: true,
      targetKind: schedule.targetKind ?? null,
      ...payload,
    },
  };
}

function createKiboPassiveDerivedPeriodicUnresolvedEvent(descriptor) {
  return {
    type: 'VERIFIED_KIBO_PASSIVE_DERIVED_PERIODIC_UNRESOLVED',
    timeMs: 0,
    actionId: null,
    actorId: descriptor.schedule?.sourceActorId ?? null,
    sourceSequencePath: null,
    payload: {
      unresolvedReasons: descriptor.unresolvedReasons ?? [],
      schedule: descriptor.schedule ?? null,
      appliedToCalculators: false,
    },
  };
}

function isNonDamageProjectionDescriptor(descriptor) {
  if (
    descriptor?.kind === 'tuning-combat' &&
    ['periodic-heal', 'overlimit-direct-sp', 'conditional-direct-sp'].includes(
      descriptor.tuningEvent?.kind
    )
  ) {
    return true;
  }
  return [
    'manual-resource',
    'action-cost',
    'auto-sp-tick',
    'direct-sp',
    'direct-heal',
    'direct-shield',
    'hit',
    'passive-vital-change',
    'passive-periodic-heal',
    'passive-periodic-heal-contract-unresolved',
    'passive-derived-self-heal',
    'passive-derived-periodic-contract-unresolved',
  ].includes(descriptor?.kind);
}

function shouldTruncateEnemySettlement({ descriptor, state }) {
  if (
    state?.enemy?.deathTruncationArmed !== true ||
    state?.enemy?.targetPolicy?.hpMode === 'infinite' ||
    state?.enemy?.targetPolicy?.deathTruncation === 'disabled' ||
    Number(state?.enemy?.hp) > 0
  ) {
    return false;
  }
  if (
    descriptor?.kind === 'tuning-combat' &&
    ['periodic-heal', 'overlimit-direct-sp', 'conditional-direct-sp'].includes(
      descriptor.tuningEvent?.kind
    )
  ) {
    return false;
  }
  if (descriptor?.kind === 'direct-heal') {
    return descriptor.directEvent?.target?.kind === EFFECT_TARGET_KINDS.ENEMY;
  }
  return [
    'weakness-state-tick',
    'hit',
    'passive-derived-hit',
    'passive-derived-dot',
    'passive-retaliation-hit',
    'tuning-combat',
  ].includes(descriptor?.kind);
}

function createEnemySettlementTruncatedEvent({ descriptor, state }) {
  return {
    type: 'VERIFIED_ENEMY_SETTLEMENT_TRUNCATED',
    timeMs: roundValue(descriptor.timeMs),
    absoluteFrame: descriptor.absoluteFrame,
    runtimePhase: descriptor.runtimePhase,
    runtimePhasePriority: descriptor.runtimePhasePriority,
    runtimePriority: descriptor.runtimePriority,
    actionId: descriptor.action?.id ?? descriptor.tuningEvent?.actionId ?? null,
    actorId:
      descriptor.action?.actorId ?? descriptor.tuningEvent?.actorId ?? null,
    targetId: state.enemy.enemyId,
    sourceSequencePath: descriptor.sourceSequencePath ?? null,
    payload: {
      reason: 'finite-enemy-already-defeated',
      descriptorKind: descriptor.kind,
      enemyHp: roundValue(state.enemy.hp),
      enemyToughness: roundValue(state.enemy.toughness),
      targetPolicy: projectCombatTargetPolicy(state.enemy.targetPolicy),
      settlementCursor: createEnemySettlementCursor(descriptor),
      appliedToCalculators: false,
    },
  };
}

function resolveFriendlyVitalState(state, target) {
  if (target?.kind === EFFECT_TARGET_KINDS.ACTOR) {
    return state.actorVitals.get(String(target.id));
  }
  if (target?.kind === EFFECT_TARGET_KINDS.KIBO) {
    return state.kiboVitals.get(String(target.id));
  }
  return null;
}

function initializeFriendlyVitalsAt(state, timeMs) {
  for (const vital of state.actorVitals.values()) {
    initializeFriendlyVitalAt({
      state,
      target: { kind: EFFECT_TARGET_KINDS.ACTOR, id: vital.actorId },
      vital,
      timeMs,
    });
  }
  for (const vital of state.kiboVitals.values()) {
    initializeFriendlyVitalAt({
      state,
      target: { kind: EFFECT_TARGET_KINDS.KIBO, id: vital.actorId },
      vital,
      timeMs,
    });
  }
}

function initializeFriendlyVitalAt({ state, target, vital, timeMs }) {
  const maximum = resolveFriendlyMaximumHpAt({
    state,
    target,
    timeMs,
  });
  const fallbackMaximum = positiveNumber(
    vital.baseMaximumHp ?? vital.inheritedMaximumHpSnapshot,
    1
  );
  const maximumHp = maximum.ready
    ? positiveNumber(maximum.value, fallbackMaximum)
    : fallbackMaximum;
  if (!maximum.ready) {
    state.vitalDiagnostics.push({
      status: 'friendly-max-hp-runtime-unresolved',
      targetKind: target.kind,
      targetId: String(target.id),
      timeMs,
      reason: maximum.reason,
      inheritedMaximumHpSnapshot: vital.inheritedMaximumHpSnapshot,
    });
  }
  vital.maximumHp = maximumHp;
  vital.currentHp = clampNumber(
    vital.hasInheritedCurrentHp ? vital.currentHp : maximumHp,
    0,
    maximumHp
  );
}

function resolveFriendlyMaximumHpAt({ state, target, timeMs }) {
  const vital = resolveFriendlyVitalState(state, target);
  if (!vital) {
    return {
      ready: false,
      reason: 'friendly-vital-state-missing',
      value: null,
    };
  }
  let baseMaximumHp = positiveNumber(vital.baseMaximumHp, null);
  if (baseMaximumHp == null) {
    const activeMaxHpModifiers = resolveActiveEffectsAt(
      state.effectTimeline,
      timeMs,
      {
        targetKind: target.kind,
        targetId: target.id,
        calculatorOnly: true,
      }
    ).flatMap(effect =>
      (effect.modifiers ?? []).filter(
        modifier =>
          modifier.kind === 'battle-property' &&
          Number(modifier.attributeId) === 5
      )
    );
    if (
      activeMaxHpModifiers.length > 0 ||
      positiveNumber(vital.inheritedMaximumHpSnapshot, null) == null
    ) {
      return {
        ready: false,
        reason:
          activeMaxHpModifiers.length > 0
            ? 'friendly-max-hp-base-missing-with-active-modifier'
            : 'friendly-max-hp-base-missing',
        value: null,
        activeMaxHpModifiers,
      };
    }
    baseMaximumHp = vital.inheritedMaximumHpSnapshot;
  }
  return resolveRuntimeAttribute({
    state,
    targetKind: target.kind,
    targetId: target.id,
    timeMs,
    attributeId: 5,
    baseRaw: baseMaximumHp,
  });
}

function refreshFriendlyVitalMaximumAt({ state, target, timeMs }) {
  const vital = resolveFriendlyVitalState(state, target);
  if (!vital) return { ready: false, reason: 'friendly-vital-state-missing' };
  const maximum = resolveFriendlyMaximumHpAt({ state, target, timeMs });
  if (!maximum.ready || positiveNumber(maximum.value, null) == null) {
    return maximum;
  }
  vital.maximumHp = Number(maximum.value);
  vital.currentHp = clampNumber(vital.currentHp, 0, vital.maximumHp);
  return { ...maximum, vital };
}

function applyTuningCombatDescriptor({
  descriptor,
  scenario,
  state,
  controlledActorTimeline,
  resourceEvents,
}) {
  const tuningEvent = descriptor.tuningEvent;
  if (tuningEvent.eventContext?.landed === false) return null;
  if (tuningEvent.kind === 'periodic-heal') {
    return {
      event: applyTuningPeriodicHeal({
        tuningEvent,
        state,
        controlledActorTimeline,
      }),
    };
  }
  if (tuningEvent.kind === 'overlimit-direct-sp') {
    const actorState = state.actorEnergy.get(tuningEvent.actorId);
    if (!actorState) return null;
    const requestedChange =
      Number(tuningEvent.template?.valuePerMark) *
      Number(tuningEvent.markCount);
    const change = applyClampedResourceChange(actorState, requestedChange);
    if (change !== 0) {
      appendRuntimeEvent(
        resourceEvents,
        createActorResourceEvent({
          timeMs: tuningEvent.timeMs,
          action: tuningEvent.action,
          actorId: tuningEvent.actorId,
          actorName: actorState.actor?.name,
          resourceState: actorState,
          change,
          reason: 'tuning-overlimit-direct-sp',
          confidence: 'verified',
          hitKey: tuningEvent.eventIdentity,
          source: {
            sourceIdentity: tuningEvent.sourceIdentity,
            formula: {
              expression: 'consumedMarks * spPerConsumedMark',
              consumedMarks: tuningEvent.markCount,
              spPerConsumedMark: tuningEvent.template?.valuePerMark,
              noShare: true,
              noEnhancement: true,
            },
          },
        }),
        state
      );
    }
    return null;
  }
  if (tuningEvent.kind === 'conditional-direct-sp') {
    const actorState = state.actorEnergy.get(tuningEvent.actorId);
    if (!actorState) return null;
    const requestedChange = Number(tuningEvent.template?.value);
    const change = applyClampedResourceChange(actorState, requestedChange);
    if (change !== 0) {
      appendRuntimeEvent(
        resourceEvents,
        createActorResourceEvent({
          timeMs: tuningEvent.timeMs,
          action: tuningEvent.action,
          actorId: tuningEvent.actorId,
          actorName: actorState.actor?.name,
          resourceState: actorState,
          change,
          reason: 'tuning-conditional-direct-sp',
          confidence: 'verified',
          hitKey: tuningEvent.eventIdentity,
          source: {
            sourceIdentity: tuningEvent.sourceIdentity,
            formula: {
              expression: 'presenceMark * spValue',
              presenceMarks: tuningEvent.markCount,
              spValue: Number(tuningEvent.template?.value),
              noShare: true,
              noEnhancement: true,
            },
          },
        }),
        state
      );
    }
    return null;
  }

  const action = tuningEvent.action;
  const resolution = tuningEvent.resolution;
  const template = tuningEvent.template;
  if (!action || !resolution || !template) return null;
  const damageEventContext =
    descriptor.damageEventTransaction?.beforeEvent?.eventContext ?? null;
  const settlingSourceSequencePath = Array.isArray(
    descriptor.damageEventTransaction?.settlementSourceSequencePath
  )
    ? [...descriptor.damageEventTransaction.settlementSourceSequencePath]
    : descriptor.sourceSequencePath;
  const propertyTags = Array.isArray(damageEventContext?.propertyTags)
    ? [...damageEventContext.propertyTags]
    : resolveVerifiedBattlePropertyTagsForHit({
        action,
        resolution,
      }).propertyTags;
  const source = resolveHitSource({
    action,
    resolution,
    hit: { damage: template },
    state,
    timeMs: tuningEvent.timeMs,
    propertyTags,
    settlingSourceSequencePath,
  });
  if (!source.ready || !state.enemy.profile?.applied) {
    return {
      event: {
        type: 'VERIFIED_TUNING_COMBAT_UNRESOLVED',
        timeMs: tuningEvent.timeMs,
        actionId: action.id,
        actorId: action.actorId,
        payload: {
          reason: source.status,
          eventIdentity: tuningEvent.eventIdentity,
          sourceIdentity: tuningEvent.sourceIdentity,
          appliedToCalculators: false,
        },
      },
    };
  }

  const enemy = state.enemy;
  const enemyProfile = enemy.profile;
  const stateBefore = createEnemyStateSnapshot(enemy);
  const inBreakForHpDamage = enemy.inBreak === true;
  const realDamage = ['held-true-damage', 'overlimit-true-damage'].includes(
    tuningEvent.kind
  );
  const markMode = tuningEvent.kind.startsWith('held-') ? 'held' : 'consumed';
  const commonInput = {
    attack: source.attack,
    overlimitCoefficientRaw: template.coefficientRaw,
    markCoefficientRaw: template.coefficientRaw,
    ...(markMode === 'held'
      ? { heldMarks: tuningEvent.markCount }
      : { consumedMarks: tuningEvent.markCount }),
    attackerDamageUp: source.damageUp,
    targetDamageDown: 0,
    elementCalculationFactor: basisPoints(
      template.elementCalculationFactorBasisPoints,
      1
    ),
    attackerElementUp: resolveBeforeDamageElementExtraRatio({
      state,
      action,
      resolution,
      timeMs: tuningEvent.timeMs,
      elementalType: template.elementalType,
      propertyTags,
      settlingSourceSequencePath,
    }),
    targetElementDefense: 0,
    skillTags: [],
    hitLocationRatio: 1,
    mastery: source.mastery,
    attackerLevel: positiveNumber(action.level, 1),
    masteryConstant: [
      0,
      0,
      Number(
        getInstalledVerifiedCombatMechanicsPackage()?.tuningMechanicsCatalog
          ?.mastery?.configuredConstant ?? 0.002
      ),
    ],
    levelPressure: 1,
    restraintDelta: 0,
    miscellaneous: 1,
    inWeakState: inBreakForHpDamage,
    breakDamageUp: basisPoints(enemyProfile.breakDamageUpBasisPoints),
    outputType: template.damageType,
    outputElement: template.elementalType,
    ...createEnemyDamageHpProtectionInput(enemy),
    valueShields: enemy.valueShields,
    hitCountShields: enemy.hitCountShields,
  };
  const damageResult = realDamage
    ? calculateRealDamage({
        ...commonInput,
        baseRaw: tuningMarkBaseRaw(
          source.attack,
          tuningEvent.markCount,
          template.coefficientRaw
        ),
      })
    : calculateStackOverLimitDamage(commonInput);
  updateShieldState(enemy, damageResult, commonInput);
  const requestedHpDamage = resolveRequestedHpDamage(damageResult);
  const infiniteHp = enemy.targetPolicy?.hpMode === 'infinite';
  const toughnessDisabled = enemy.targetPolicy?.toughnessMode === 'disabled';
  const hpDamage = infiniteHp
    ? Math.max(0, Number(damageResult.value))
    : Math.min(enemy.hp, Math.max(0, Number(damageResult.value)));
  const effectiveHpDamage = hpDamage;
  const overkill = Math.max(0, requestedHpDamage - effectiveHpDamage);
  const hpDamageMultiplier = resolveHpDamageMultiplier({
    inBreakForHpDamage,
    enemyProfile,
  });
  const toughnessBefore = enemy.toughness;
  const weaknessResult = calculateWeaknessDamage({
    pure: false,
    attack: source.attack,
    ratioBasisPoints: template.coefficientRaw,
    outputDamageRaw: damageResult.preShieldRaw ?? damageResult.raw,
    outputType: template.damageType,
    inWeakState: inBreakForHpDamage,
    worldEventConflictPer: 1,
    typeMultiplier: resolveRuntimeWeaknessTypeMultiplier({
      enemyProfile,
      damage: template,
      state,
      scenario,
      timeMs: tuningEvent.timeMs,
      propertyTags,
      settlingSourceSequencePath,
    }),
    elementMultiplier: resolveWeaknessElementMultiplier(enemyProfile, {
      damage: template,
    }),
    weaknessSkillDamageUp: 1,
    weakBreakDamageRateBasisPoints:
      template.weakBreakDamageRateBasisPoints ?? 0,
    maximum: positiveNumberOrNull(enemyProfile.weaknessDamageMaximum),
    minimum: positiveNumberOrNull(enemyProfile.weaknessDamageMinimum),
  });
  const toughnessDamage = toughnessDisabled
    ? 0
    : Math.min(
        enemy.toughness,
        Math.max(0, Number(weaknessResult.deducted ?? 0))
      );
  if (!infiniteHp) enemy.hp = roundValue(enemy.hp - hpDamage);
  if (!toughnessDisabled) {
    enemy.toughness = roundValue(enemy.toughness - toughnessDamage);
  }
  const breakTriggered =
    !toughnessDisabled &&
    enemy.targetPolicy?.breakMode === 'enabled' &&
    !enemy.inBreak &&
    toughnessBefore > 0 &&
    enemy.toughness <= 0;
  if (toughnessDamage > 0) {
    enemy.lastToughnessSourceActionId = action.id;
    enemy.lastToughnessSourceActorId = action.actorId;
    enemy.lastToughnessBindingIdentity = resolution.actionBinding.identity;
  }
  if (breakTriggered) {
    enemy.inBreak = true;
    enemy.breakStartedAtMs = tuningEvent.timeMs;
    enemy.breakPhase = 'linear_recovery';
    enemy.normalRecoveryEligibleAtMs = null;
  } else if (!enemy.inBreak && toughnessDamage > 0) {
    enemy.normalRecoveryEligibleAtMs =
      tuningEvent.timeMs + nonNegativeNumber(enemyProfile.recoveryDelayMs);
  }
  const stateAfter = createEnemyStateSnapshot(enemy);
  const deathTriggered =
    !infiniteHp && Number(stateBefore.hp) > 0 && Number(stateAfter.hp) <= 0;
  const hitKey = `verified-${tuningEvent.eventIdentity}`;
  return {
    damageEvent: {
      type: 'VERIFIED_TUNING_DAMAGE',
      timeMs: roundValue(tuningEvent.timeMs),
      actionId: action.id,
      actorId: action.actorId,
      targetId: scenario.enemy.id,
      hitKey,
      hitIndex: null,
      hitSkillId: resolution.actionBinding.controlSkillId,
      sourceSequencePath: Array.isArray(
        tuningEvent.eventContext?.sourceSequencePath
      )
        ? [...tuningEvent.eventContext.sourceSequencePath]
        : null,
      payload: {
        verifiedCombat: true,
        tuningMechanics: true,
        damageEventContext,
        tuningKind: tuningEvent.kind,
        profileKey: tuningEvent.profile.key,
        markId: tuningEvent.profile.markId,
        markCount: tuningEvent.markCount,
        elementId: template.elementConfigId,
        attack: source.attack,
        mastery: source.mastery,
        dynamicPropertyTrace: {
          source: source.dynamicPropertyTrace ?? [],
          target: [],
        },
        rawDamage: hpDamage,
        requestedHpDamage,
        effectiveHpDamage,
        overkill,
        inBreakForHpDamage,
        hpDamageMultiplier,
        toughnessDamage,
        toughnessBefore,
        toughnessAfter: enemy.toughness,
        breakTriggered,
        deathTriggered,
        settlementCursor: createEnemySettlementCursor(descriptor),
        hpLossPercent: ratioOrZero(hpDamage, enemy.maxHp),
        toughnessLossPercent: ratioOrZero(toughnessDamage, enemy.maxToughness),
        formulaVersion: 'azpr-verified-q16.16-20260718',
        formulaBreakdown: {
          version: 'azpr-verified-tuning-damage-v1',
          status: 'verified-tuning-formula-applied',
          expression: damageResult.mode,
          result: hpDamage,
          verifiedResult: damageResult,
          weaknessResult,
          sourceIdentity: tuningEvent.sourceIdentity,
          appliedLayerKeys: ['verifiedTuningMechanics'],
          unappliedLayerKeys: ['unverifiedCallbacks'],
        },
        segment: {
          index: 0,
          label: `${tuningEvent.profile.element}调谐`,
          multiplier:
            (Number(template.coefficientRaw) * tuningEvent.markCount) / 10_000,
          elementId: template.elementConfigId,
        },
        hitKey,
        confidence: 'verified',
        precision: 'q16.16-runtime-integerized',
        timingAccuracy: 'authoritative-battle-effect-frame',
        breakState: {
          before: toughnessBefore,
          after: enemy.toughness,
          maximum: enemy.maxToughness,
          triggered: breakTriggered,
          inBreak: enemy.inBreak,
          inBreakForHpDamage,
          hpDamageMultiplier,
        },
        deathState: {
          before: stateBefore.hp,
          after: stateAfter.hp,
          triggered: deathTriggered,
        },
        stateTransaction: {
          before: stateBefore,
          delta: {
            enemyHp: infiniteHp ? 0 : roundValue(-hpDamage),
            enemyToughness: roundValue(-toughnessDamage),
          },
          after: stateAfter,
        },
        ...(enemy.targetPolicy.explicit
          ? { targetPolicy: projectCombatTargetPolicy(enemy.targetPolicy) }
          : {}),
        sourceIdentity: tuningEvent.sourceIdentity,
        appliedToCalculators: true,
      },
    },
  };
}

function applyTuningPeriodicHeal({
  tuningEvent,
  state,
  controlledActorTimeline,
}) {
  const controlledActor = resolveControlledActorAt(
    controlledActorTimeline,
    tuningEvent.timeMs
  );
  const vital = state.actorVitals.get(controlledActor?.actorId);
  if (!vital) return null;
  const ratioPerMark = Number(tuningEvent.profile.heldEffect?.perMark);
  const requested = vital.maximumHp * ratioPerMark * tuningEvent.markCount;
  const before = vital.currentHp;
  vital.currentHp = clampNumber(
    vital.currentHp + requested,
    0,
    vital.maximumHp
  );
  const change = roundValue(vital.currentHp - before);
  return {
    type: 'VERIFIED_TUNING_PERIODIC_HEAL',
    timeMs: tuningEvent.timeMs,
    actionId: tuningEvent.actionId,
    actorId: tuningEvent.actorId ?? null,
    targetId: controlledActor.actorId,
    payload: {
      profileKey: tuningEvent.profile.key,
      markId: tuningEvent.profile.markId,
      markCount: tuningEvent.markCount,
      beforeValue: before,
      requestedChange: roundValue(requested),
      change,
      afterValue: vital.currentHp,
      maxValue: vital.maximumHp,
      targetKind: EFFECT_TARGET_KINDS.ACTOR,
      sourceActorId: tuningEvent.actorId ?? null,
      sourceEventIdentity: tuningEvent.eventIdentity,
      sourceActionId: tuningEvent.actionId ?? null,
      afterHealDispatchEligible: true,
      actionProvenanceAvailable: false,
      applied: true,
      sourceIdentity: tuningEvent.sourceIdentity,
      appliedToCalculators: true,
    },
  };
}

function applyHitDescriptor({
  descriptor,
  scenario,
  state,
  criticalRandomSource,
}) {
  const { action, resolution, hit } = descriptor;
  const actionSourceSequencePath = getActionSourceSequencePath(action);
  const settlingSourceSequencePath = Array.isArray(
    descriptor.damageEventTransaction?.settlementSourceSequencePath
  )
    ? [...descriptor.damageEventTransaction.settlementSourceSequencePath]
    : actionSourceSequencePath
      ? [...actionSourceSequencePath, Number(hit.hitIndex)]
      : null;
  const propertyTagResolution = resolveVerifiedBattlePropertyTagsForHit({
    action,
    resolution,
  });
  const propertyTags = propertyTagResolution.propertyTags;
  const source = resolveHitSource({
    action,
    resolution,
    hit,
    state,
    timeMs: descriptor.timeMs,
    propertyTags,
    settlingSourceSequencePath,
  });
  const weaknessSkillDamageUp = resolveWeaknessSkillDamageUp({
    action,
    resolution,
    state,
    timeMs: descriptor.timeMs,
    propertyTags,
    settlingSourceSequencePath,
  });
  const ratioBasisPoints = resolveHitRatio(hit, action);
  const enemy = state.enemy;
  const enemyProfile = enemy.profile;
  const targetDefenseResult = resolveRuntimeAttribute({
    state,
    targetKind: EFFECT_TARGET_KINDS.ENEMY,
    targetId: scenario?.enemy?.id,
    timeMs: descriptor.timeMs,
    attributeId: 3,
    baseRaw: scenario?.enemy?.stats?.physicalDefense,
    propertyTags,
    settlingSourceSequencePath,
  });
  const targetMagicDefenseResult = resolveRuntimeAttribute({
    state,
    targetKind: EFFECT_TARGET_KINDS.ENEMY,
    targetId: scenario?.enemy?.id,
    timeMs: descriptor.timeMs,
    attributeId: 4,
    baseRaw: scenario?.enemy?.stats?.magicalDefense,
    propertyTags,
    settlingSourceSequencePath,
  });
  const targetCriticalRateDefenseResult = resolveRuntimeAttribute({
    state,
    targetKind: EFFECT_TARGET_KINDS.ENEMY,
    targetId: scenario?.enemy?.id,
    timeMs: descriptor.timeMs,
    attributeId: 102,
    baseRaw: getAttribute(scenario?.enemy, 'CRI_DEFENSE') ?? 0,
    propertyTags,
    settlingSourceSequencePath,
  });
  const targetDefense = numberOrNull(targetDefenseResult.value);
  const targetMagicDefense = numberOrNull(targetMagicDefenseResult.value);
  const targetCriticalRateDefense = basisPoints(
    targetCriticalRateDefenseResult.value
  );
  let inputIssue = null;
  if (!source.ready) inputIssue = source.status;
  else if (!enemyProfile?.applied) {
    inputIssue = 'verified-enemy-break-profile-missing';
  } else if (ratioBasisPoints == null) {
    inputIssue = 'verified-hit-ratio-missing';
  } else if (targetDefense == null || targetMagicDefense == null) {
    inputIssue = 'verified-enemy-defense-inputs-missing';
  }
  if (inputIssue) {
    return {
      status: 'verified-combat-hit-inputs-incomplete',
      reason: inputIssue,
      source,
      ready: false,
      applied: false,
    };
  }

  const randomBranch = resolveCriticalBranch(action, hit, source, {
    scenario,
    descriptor,
    criticalRandomSource,
    targetCriticalRateDefense,
  });
  if (!randomBranch.ready) {
    return {
      status: randomBranch.status,
      reason: randomBranch.reason,
      source,
      randomBranch,
      ready: false,
      applied: false,
    };
  }
  const stateBefore = createEnemyStateSnapshot(enemy);
  const inBreakForHpDamage = enemy.inBreak === true;
  const damageInput = {
    attack: source.attack,
    ratioBasisPoints,
    targetLevel: positiveNumber(scenario?.enemy?.level, 1),
    targetDefense:
      targetDefense * positiveNumber(scenario?.enemy?.defenseMultiplier, 1),
    targetMagicDefense:
      targetMagicDefense *
      positiveNumber(scenario?.enemy?.defenseMultiplier, 1),
    physicalPenetrationBasisPoints: combinePenetrationBasisPoints(
      hit.damage.physicalPenetrationBasisPoints,
      source.physicalPenetrationBasisPoints
    ),
    magicPenetrationBasisPoints: combinePenetrationBasisPoints(
      hit.damage.magicPenetrationBasisPoints,
      source.magicPenetrationBasisPoints
    ),
    elementCalculationFactor: basisPoints(
      hit.damage.elementCalculationFactorBasisPoints,
      1
    ),
    attackerElementUp: source.elementDamageUp,
    targetElementDefense: resolveEnemyElementDefense(
      scenario.enemy,
      hit.damage.elementalType,
      state,
      descriptor.timeMs,
      propertyTags
    ),
    physicalRatio: basisPoints(hit.damage.physicalRatioBasisPoints),
    magicRatio: basisPoints(hit.damage.magicRatioBasisPoints),
    attackerPhysicalUp: source.physicalDamageUp,
    attackerMagicUp: source.magicDamageUp,
    targetPhysicalDown: 0,
    targetMagicDown: 0,
    attackerDamageUp: source.damageUp,
    targetDamageDown: 0,
    skillTags: [],
    hitLocationRatio: 1,
    critical: randomBranch.critical,
    criticalDamage: source.criticalDamage,
    levelPressure: 1,
    restraintDelta: 0,
    miscellaneous: 1,
    inWeakState: inBreakForHpDamage,
    breakDamageUp: basisPoints(enemyProfile.breakDamageUpBasisPoints),
    outputType: hit.damage.damageType,
    outputElement: hit.damage.elementalType,
    ...createEnemyDamageHpProtectionInput(enemy),
    valueShields: enemy.valueShields,
    hitCountShields: enemy.hitCountShields,
  };
  const damageType = Number(hit.damage.damageType);
  const damageResolution = calculateCriticalAwareDamage({
    damageType,
    damageInput,
    randomBranch,
  });
  if (!damageResolution.ready) {
    return {
      status: damageResolution.status,
      reason: damageResolution.reason,
      source,
      randomBranch,
      ready: false,
      applied: false,
    };
  }
  const damageResult = damageResolution.result;
  updateShieldState(enemy, damageResult, damageInput);
  const requestedHpDamage = resolveRequestedHpDamage(damageResult);
  const infiniteHp = enemy.targetPolicy?.hpMode === 'infinite';
  const toughnessDisabled = enemy.targetPolicy?.toughnessMode === 'disabled';
  const hpDamage = infiniteHp
    ? Math.max(0, Number(damageResult.value))
    : Math.min(enemy.hp, Math.max(0, Number(damageResult.value)));
  const effectiveHpDamage = hpDamage;
  const overkill = Math.max(0, requestedHpDamage - effectiveHpDamage);
  const hpDamageMultiplier = resolveHpDamageMultiplier({
    inBreakForHpDamage,
    enemyProfile,
  });
  const toughnessBefore = enemy.toughness;
  const preShieldHpDamageRaw = damageResult.preShieldRaw ?? damageResult.raw;
  const weaknessTypeMultiplier = resolveRuntimeWeaknessTypeMultiplier({
    enemyProfile,
    damage: hit.damage,
    state,
    scenario,
    timeMs: descriptor.timeMs,
    propertyTags,
    settlingSourceSequencePath,
  });
  const weaknessElementMultiplier = resolveWeaknessElementMultiplier(
    enemyProfile,
    hit
  );
  const weaknessMaximum = positiveNumberOrNull(
    enemyProfile.weaknessDamageMaximum
  );
  const weaknessMinimum = positiveNumberOrNull(
    enemyProfile.weaknessDamageMinimum
  );
  const weaknessResult = calculateWeaknessDamage({
    pure: damageType === 8,
    attack: source.attack,
    ratioBasisPoints,
    outputDamageRaw: preShieldHpDamageRaw,
    outputType: damageType,
    inWeakState: inBreakForHpDamage,
    worldEventConflictPer: 1,
    typeMultiplier: weaknessTypeMultiplier,
    elementMultiplier: weaknessElementMultiplier,
    weaknessSkillDamageUp: weaknessSkillDamageUp.factor,
    weakBreakDamageRateBasisPoints: hit.damage.weakBreakDamageRateBasisPoints,
    maximum: weaknessMaximum,
    minimum: weaknessMinimum,
  });
  const toughnessDamage = toughnessDisabled
    ? 0
    : Math.min(
        enemy.toughness,
        Math.max(0, Number(weaknessResult.deducted ?? 0))
      );
  if (!infiniteHp) enemy.hp = roundValue(enemy.hp - hpDamage);
  if (!toughnessDisabled) {
    enemy.toughness = roundValue(enemy.toughness - toughnessDamage);
  }
  const breakTriggered =
    !toughnessDisabled &&
    enemy.targetPolicy?.breakMode === 'enabled' &&
    !enemy.inBreak &&
    toughnessBefore > 0 &&
    enemy.toughness <= 0;
  if (toughnessDamage > 0) {
    enemy.lastToughnessSourceActionId = action.id;
    enemy.lastToughnessSourceActorId = action.actorId;
    enemy.lastToughnessBindingIdentity = resolution.actionBinding.identity;
  }
  if (breakTriggered) {
    enemy.inBreak = true;
    enemy.breakStartedAtMs = descriptor.timeMs;
    enemy.breakPhase = 'linear_recovery';
    enemy.normalRecoveryEligibleAtMs = null;
  } else if (!enemy.inBreak && toughnessDamage > 0) {
    enemy.normalRecoveryEligibleAtMs =
      descriptor.timeMs + nonNegativeNumber(enemyProfile.recoveryDelayMs);
  }
  const stateAfter = createEnemyStateSnapshot(enemy);
  const deathTriggered =
    !infiniteHp && Number(stateBefore.hp) > 0 && Number(stateAfter.hp) <= 0;
  const passiveDerivedDamageCommand =
    descriptor.passiveDerivedDamageCommand ?? null;
  const hitKey = createVerifiedCombatHitKey(descriptor);
  const shieldAbsorbed = Math.max(
    0,
    qToNumber(
      BigInt(damageResult.preShieldRaw ?? damageResult.raw ?? '0') -
        BigInt(damageResult.raw ?? '0')
    )
  );
  return {
    ready: true,
    status: 'verified-combat-hit-applied',
    hitKey,
    hpDamage,
    toughnessDamage,
    damageEvent: {
      type: 'VERIFIED_COMBAT_HIT',
      timeMs: roundValue(descriptor.timeMs),
      actionId: action.id,
      actorId: action.actorId,
      targetId: scenario.enemy.id,
      hitKey,
      hitIndex: hit.hitIndex,
      hitSkillId: resolution.actionBinding.controlSkillId,
      payload: {
        verifiedCombat: true,
        tuningConditionalDamage: descriptor.conditionalDamageEvent != null,
        tuningConditionalDamageEventIdentity:
          descriptor.conditionalDamageEvent?.eventIdentity ?? null,
        tuningConditionalDamageBranch:
          descriptor.conditionalDamageEvent?.eventContext?.selectedBranch ??
          null,
        tuningConditionalDamageMarkCount:
          descriptor.conditionalDamageEvent?.eventContext
            ?.markCountAtJudgment ?? null,
        kiboPassiveDerivedDamage: passiveDerivedDamageCommand != null,
        passiveSkillId: passiveDerivedDamageCommand?.passiveSkillId ?? null,
        sourceKiboId: passiveDerivedDamageCommand?.sourceKiboId ?? null,
        triggerHitIdentity:
          passiveDerivedDamageCommand?.triggerHitIdentity ?? null,
        derivedHitIdentity:
          passiveDerivedDamageCommand?.derivedHitIdentity ?? null,
        ignoreDamageEvent:
          passiveDerivedDamageCommand?.ignoreDamageEvent === true,
        emitsDamageTriggerEvents:
          passiveDerivedDamageCommand?.emitsDamageTriggerEvents === true,
        recursivePassiveTrigger:
          passiveDerivedDamageCommand?.recursivePassiveTrigger === true,
        packageId: resolution.packageId,
        packageHash: resolution.packageHash,
        bindingIdentity: resolution.actionBinding.identity,
        hitIdentity: resolveCriticalHitIdentity(hit),
        enemyProfileSourceIdentity: enemyProfile.sourceIdentity,
        controlSkillId: resolution.actionBinding.controlSkillId,
        elementId: hit.elementId,
        pathId: hit.pathId,
        attack: source.attack,
        attackSource: source.sourceIdentity,
        dynamicPropertyTrace: {
          source: [
            ...(source.dynamicPropertyTrace ?? []),
            ...collectDynamicPropertyTrace([
              weaknessSkillDamageUp.attributeResult,
            ]),
          ],
          target: collectDynamicPropertyTrace([
            targetDefenseResult,
            targetMagicDefenseResult,
            targetCriticalRateDefenseResult,
          ]),
        },
        propertyTagResolution,
        damageEventContext:
          descriptor.damageEventTransaction?.beforeEvent?.eventContext ?? null,
        rawDamage: hpDamage,
        requestedHpDamage,
        effectiveHpDamage,
        overkill,
        inBreakForHpDamage,
        hpDamageMultiplier,
        toughnessDamage,
        toughnessBefore,
        toughnessAfter: enemy.toughness,
        breakTriggered,
        deathTriggered,
        settlementCursor: createEnemySettlementCursor(descriptor),
        hpLossPercent: ratioOrZero(hpDamage, enemy.maxHp),
        toughnessLossPercent: ratioOrZero(toughnessDamage, enemy.maxToughness),
        formulaVersion: 'azpr-verified-q16.16-20260718',
        formulaBreakdown: {
          version: 'azpr-verified-combat-hit-v1',
          status: 'verified-combat-formula-applied',
          expression: damageResult.mode,
          result: hpDamage,
          verifiedResult: damageResult,
          weaknessResult,
          weaknessInput: {
            preShieldHpDamageRaw: String(preShieldHpDamageRaw ?? '0'),
            typeMultiplier: weaknessTypeMultiplier,
            elementMultiplier: weaknessElementMultiplier,
            weaknessSkillDamageUp: weaknessSkillDamageUp.factor,
            ...(weaknessSkillDamageUp.traceApplied
              ? {
                  weaknessSkillAttributeId: weaknessSkillDamageUp.attributeId,
                  weaknessSkillAttributeKey: weaknessSkillDamageUp.attributeKey,
                  weaknessSkillActionKind: weaknessSkillDamageUp.actionKind,
                  weaknessSkillSourceStatus: weaknessSkillDamageUp.status,
                }
              : {}),
            weakBreakDamageRateBasisPoints:
              hit.damage.weakBreakDamageRateBasisPoints,
            maximum: weaknessMaximum,
            minimum: weaknessMinimum,
            maximumWeakness: enemy.maxToughness,
            sourceIdentity: enemyProfile.sourceIdentity,
          },
          randomBranch,
          sourceIdentity: resolution.actionBinding.identity,
          appliedLayerKeys: ['verifiedCombatHit'],
          unappliedLayerKeys: ['cultivationEffects', 'unverifiedCallbacks'],
          layers: {
            verifiedCombatHit: {
              value: hpDamage,
              applied: true,
              source: resolution.actionBinding.identity,
            },
          },
        },
        segment: {
          index: hit.hitIndex - 1,
          label: createCombatSourceDisplayLabel({
            sourceText: hit.displayLabel ?? hit.name,
            referenceKind: hit.referenceKind,
            sequence: hit.hitIndex,
            sourceIdentity: hit.sourceIdentity,
          }).displayLabel,
          multiplier: ratioBasisPoints / 10000,
          elementId: hit.elementId,
        },
        hitIndex: hit.hitIndex,
        hitKey,
        confidence: 'verified',
        precision: 'q16.16-runtime-integerized',
        timingAccuracy: 'authoritative-skill-control-frame',
        breakState: {
          before: toughnessBefore,
          after: enemy.toughness,
          maximum: enemy.maxToughness,
          triggered: breakTriggered,
          inBreak: enemy.inBreak,
          inBreakForHpDamage,
          hpDamageMultiplier,
        },
        deathState: {
          before: stateBefore.hp,
          after: stateAfter.hp,
          triggered: deathTriggered,
        },
        shieldState: {
          absorbed: roundValue(shieldAbsorbed),
          hitCountBlocked: damageResult.hitCountBlocked === true,
          remainingValueShieldCount: enemy.valueShields.length,
          remainingHitCountShieldCount: enemy.hitCountShields.filter(
            shield => shield.count > 0
          ).length,
        },
        stateTransaction: {
          before: stateBefore,
          delta: {
            enemyHp: infiniteHp ? 0 : roundValue(-hpDamage),
            enemyToughness: roundValue(-toughnessDamage),
          },
          after: stateAfter,
        },
        ...(enemy.targetPolicy.explicit
          ? { targetPolicy: projectCombatTargetPolicy(enemy.targetPolicy) }
          : {}),
        appliedToCalculators: true,
      },
    },
  };
}

function createVerifiedCombatHitKey(descriptor) {
  if (descriptor?.conditionalDamageEvent?.eventIdentity) {
    return `verified-${descriptor.conditionalDamageEvent.eventIdentity}`;
  }
  const passiveDerivedDamageCommand =
    descriptor?.passiveDerivedDamageCommand ?? null;
  if (passiveDerivedDamageCommand) {
    return `verified-${passiveDerivedDamageCommand.id}`;
  }
  return `verified-hit-${descriptor?.hit?.hitIndex}-${descriptor?.hit?.elementId}`;
}

function resolveVerifiedHitRecoveryEligibility(descriptor) {
  const { action, hit, resolution } = descriptor ?? {};
  const recoverSp = numberOrNull(hit?.energy?.recoverSp);
  const petRecoverSp = numberOrNull(hit?.energy?.petRecoverSp);
  const recoverIntervalMs = numberOrNull(hit?.energy?.recoverIntervalMs);
  const hasRecovery = (recoverSp ?? 0) > 0 || (petRecoverSp ?? 0) > 0;
  if (!hasRecovery) {
    return {
      eligible: false,
      status: 'verified-hit-recovery-not-applicable',
    };
  }
  if (
    recoverSp == null ||
    petRecoverSp == null ||
    recoverSp < 0 ||
    petRecoverSp < 0 ||
    recoverIntervalMs == null ||
    recoverIntervalMs < 0
  ) {
    return {
      eligible: false,
      status: 'verified-hit-recovery-source-fields-unresolved',
    };
  }

  const frameRate = positiveNumber(
    resolution?.controlBinding?.frameRate,
    FRAME_RATE
  );
  const hitFrame = numberOrNull(hit?.trigger?.startFrame);
  if (
    hitFrame == null ||
    !isActionFrameWithinContextualOccupancy(action, hitFrame, frameRate)
  ) {
    return {
      eligible: false,
      status: 'verified-hit-recovery-outside-effective-occupancy',
    };
  }

  const transaction = descriptor?.damageEventTransaction ?? null;
  if (!transaction) {
    return {
      eligible: false,
      status: 'verified-hit-recovery-landed-transaction-missing',
    };
  }
  const hitIdentity = resolveCriticalHitIdentity(hit);
  const transactionIdentity = `damage|hit|${action?.id}|${hitIdentity}`;
  const beforeContext = transaction.beforeEvent?.eventContext ?? null;
  const afterContext = transaction.afterEvent?.eventContext ?? null;
  const transactionTimeMs = numberOrNull(transaction.timeMs);
  const descriptorTimeMs = numberOrNull(descriptor.timeMs);
  const identityMatches =
    transaction.sourceKind === 'ordinary-hit' &&
    String(transaction.sourceActionId ?? '') === String(action?.id ?? '') &&
    String(transaction.sourceHitIdentity ?? '') === hitIdentity &&
    String(transaction.transactionIdentity ?? '') === transactionIdentity &&
    String(beforeContext?.transactionIdentity ?? '') === transactionIdentity &&
    String(afterContext?.transactionIdentity ?? '') === transactionIdentity &&
    beforeContext?.landed === true &&
    afterContext?.landed === true &&
    transactionTimeMs != null &&
    descriptorTimeMs != null &&
    Math.abs(transactionTimeMs - descriptorTimeMs) <= 0.000001;
  if (!identityMatches) {
    return {
      eligible: false,
      status: 'verified-hit-recovery-landed-transaction-identity-mismatch',
      hitIdentity,
      transactionIdentity: transaction.transactionIdentity ?? null,
    };
  }

  return {
    eligible: true,
    status: 'verified-hit-recovery-eligible',
    hitIdentity,
    transactionIdentity,
    recoverSp,
    petRecoverSp,
    recoverIntervalMs,
  };
}

function applyHitRecovery({
  descriptor,
  hitResult,
  hitRecoveryEligibility,
  damageSettlement = null,
  state,
  hitRecoveryAtByIdentity,
  resourceEvents,
  kiboResourceEvents,
}) {
  const { action, hit, resolution } = descriptor;
  if (hitRecoveryEligibility?.eligible !== true) return;
  const recoverSp = hitRecoveryEligibility.recoverSp;
  const petRecoverSp = hitRecoveryEligibility.petRecoverSp;
  if (recoverSp <= 0 && petRecoverSp <= 0) return;
  const intervalMs = hitRecoveryEligibility.recoverIntervalMs;
  const intervalIdentity = `damage-element:${
    hit.pathId ?? hit.elementId ?? 'unresolved'
  }`;
  const lastTimeMs = hitRecoveryAtByIdentity.get(intervalIdentity);
  if (lastTimeMs != null && descriptor.timeMs - lastTimeMs < intervalMs) return;
  hitRecoveryAtByIdentity.set(intervalIdentity, descriptor.timeMs);

  const sourceActorId = action.actorId;
  const sourceActorState = state.actorEnergy.get(sourceActorId);
  const sourceActor = sourceActorState
    ? createActorSpSource(sourceActorState, state, descriptor.timeMs)
    : null;
  if (recoverSp > 0) {
    if (!sourceActorState || !sourceActor) return;
    const formula = calculateHitSp({
      recoverSp,
      pet: false,
      spGetUp: sourceActor.spGetUp,
      spGetUpAttack: sourceActor.spGetUpAttack,
      maximumSp: Number.MAX_SAFE_INTEGER,
      recoverInterval: intervalMs,
    });
    const actorRecipients = [...state.actorEnergy.values()].sort(
      (left, right) =>
        Number(right.actor.id === sourceActorId) -
        Number(left.actor.id === sourceActorId)
    );
    for (const actorState of actorRecipients) {
      const share = actorState.actor.id === sourceActorId ? 1 : 0.5;
      const desired = multiplyQ16(formula.value, share);
      const change = applyClampedResourceChange(actorState, desired);
      if (change === 0) continue;
      appendRuntimeEvent(
        resourceEvents,
        createActorResourceEvent({
          timeMs: descriptor.timeMs,
          action,
          actorId: actorState.actor.id,
          actorName: actorState.actor.name,
          resourceState: actorState,
          change,
          reason:
            share === 1
              ? 'verified-hit-sp-recovery'
              : 'verified-hit-sp-shared-recovery',
          confidence: 'verified',
          hitKey:
            share === 1
              ? hitResult.hitKey
              : `${hitResult.hitKey}-share-${actorState.actor.id}`,
          hitIndex: hit.hitIndex,
          hitSkillId: resolution.actionBinding.controlSkillId,
          elementId: hit.elementId,
          source: {
            ...resolution,
            formula,
            sourceIdentity: sourceActor.sourceIdentity,
            recoverIntervalIdentity: intervalIdentity,
            share,
            ...(damageSettlement
              ? {
                  hitRecoveryTransactionIdentity:
                    hitRecoveryEligibility.transactionIdentity,
                  damageSettlement,
                }
              : {}),
          },
        }),
        state
      );
    }
  }

  if (petRecoverSp <= 0) return;
  const sourceKiboState =
    findKiboStateByAction(state, action) ??
    [...state.kiboEnergy.values()].find(
      entry => entry.actorId === sourceActorId
    );
  const source =
    resolution.actionBinding.ownerKind === 'kibo'
      ? createKiboSpSource(sourceKiboState, state, descriptor.timeMs)
      : sourceActor;
  if (!source.applied) return;
  const formula = calculateHitSp({
    petRecoverSp,
    pet: true,
    spGetUp: source.spGetUp,
    spGetUpAttack: source.spGetUpAttack,
    maximumSp: Number.MAX_SAFE_INTEGER,
    recoverInterval: intervalMs,
  });
  for (const kiboState of state.kiboEnergy.values()) {
    const share = 1;
    const change = applyClampedResourceChange(
      kiboState,
      multiplyQ16(formula.value, share)
    );
    if (change === 0) continue;
    appendRuntimeEvent(
      kiboResourceEvents,
      createKiboResourceEvent({
        timeMs: descriptor.timeMs,
        action,
        kiboState,
        change,
        reason: 'verified-hit-pet-sp-shared-recovery',
        hitKey: `${hitResult.hitKey}-kibo-${kiboState.slotId}`,
        hitIndex: hit.hitIndex,
        hitSkillId: resolution.actionBinding.controlSkillId,
        elementId: hit.elementId,
        source: {
          ...resolution,
          formula,
          sourceIdentity: source.sourceIdentity,
          recoverIntervalIdentity: intervalIdentity,
          share,
          ...(damageSettlement
            ? {
                hitRecoveryTransactionIdentity:
                  hitRecoveryEligibility.transactionIdentity,
                damageSettlement,
              }
            : {}),
        },
      }),
      state
    );
  }
}

function resolveWeaknessSkillDamageUp({
  action,
  resolution,
  state,
  timeMs,
  propertyTags = [],
  settlingSourceSequencePath = null,
}) {
  const actionKind = String(
    resolution?.actionBinding?.actionKind ??
      action?.actionKind ??
      action?.eventType ??
      ''
  );
  const attributeKey =
    WEAKNESS_SKILL_ATTRIBUTE_KEY_BY_ACTION_KIND[actionKind] ?? null;
  if (!attributeKey) {
    return {
      factor: 1,
      actionKind,
      attributeId: null,
      attributeKey: null,
      attributeResult: null,
      status: 'weakness-skill-attribute-not-applicable',
      traceApplied: false,
    };
  }

  const attributeId = state.attributeIdByKey.get(attributeKey);
  if (!Number.isInteger(attributeId)) {
    return {
      factor: 1,
      actionKind,
      attributeId: null,
      attributeKey,
      attributeResult: null,
      status: 'weakness-skill-attribute-definition-missing',
      traceApplied: false,
    };
  }

  const ownerKind = resolution?.actionBinding?.ownerKind;
  const actorState = state.actorEnergy.get(action?.actorId);
  const kiboState = findKiboStateByAction(state, action);
  const attributeResult =
    ownerKind === 'kibo'
      ? resolveRuntimeAttribute({
          state,
          targetKind: EFFECT_TARGET_KINDS.KIBO,
          targetId: action?.actorId,
          timeMs,
          attributeId,
          baseRaw: kiboState?.attributesById?.get(attributeId) ?? 0,
          propertyTags,
          settlingActionId: action?.id,
          settlingSourceSequencePath,
        })
      : resolveActorRuntimeAttribute({
          state,
          actorState,
          timeMs,
          attributeId,
          fallbackRaw: getAttribute(action?.actor, attributeKey) ?? 0,
          propertyTags,
          settlingActionId: action?.id,
          settlingSourceSequencePath,
        });
  if (!attributeResult.ready) {
    return {
      factor: 1,
      actionKind,
      attributeId,
      attributeKey,
      attributeResult,
      status:
        attributeResult.status ?? 'weakness-skill-attribute-runtime-unresolved',
      traceApplied: false,
    };
  }

  return {
    factor: basisPoints(attributeResult.value, 1),
    actionKind,
    attributeId,
    attributeKey,
    attributeResult,
    status: 'verified-runtime-weakness-skill-attribute-applied',
    traceApplied:
      Number(attributeResult.value) !== 10_000 ||
      (attributeResult.appliedEffects ?? []).length > 0,
  };
}

function resolveHitSource({
  action,
  resolution,
  hit,
  state,
  timeMs,
  propertyTags = [],
  settlingSourceSequencePath = null,
}) {
  if (resolution.actionBinding.ownerKind === 'kibo') {
    const kiboState = findKiboStateByAction(state, action);
    const profile = kiboState?.profile;
    const attackResult = resolveRuntimeAttribute({
      state,
      targetKind: EFFECT_TARGET_KINDS.KIBO,
      targetId: action.actorId,
      timeMs,
      attributeId: 1,
      baseRaw:
        kiboState?.attributesById?.get(1) ?? numberOrNull(profile?.attack),
      propertyTags,
      settlingActionId: action.id,
      settlingSourceSequencePath,
    });
    const attack = numberOrNull(attackResult.value);
    const criticalRateResult = resolveKiboRatioAttribute({
      state,
      kiboState,
      action,
      timeMs,
      attributeId: 7,
      fallbackBasisPoints: profile?.criticalRateBasisPoints,
      propertyTags,
      settlingSourceSequencePath,
    });
    const criticalDamageResult = resolveKiboRatioAttribute({
      state,
      kiboState,
      action,
      timeMs,
      attributeId: 8,
      fallbackBasisPoints: profile?.criticalDamageBasisPoints,
      propertyTags,
      settlingSourceSequencePath,
    });
    const damageUpResult = resolveKiboRatioAttribute({
      state,
      kiboState,
      action,
      timeMs,
      attributeId: 21,
      fallbackBasisPoints: profile?.damageUpBasisPoints,
      propertyTags,
      settlingSourceSequencePath,
    });
    const physicalDamageUpResult = resolveKiboRatioAttribute({
      state,
      kiboState,
      action,
      timeMs,
      attributeId: 25,
      fallbackBasisPoints: profile?.physicalDamageUpBasisPoints,
      propertyTags,
      settlingSourceSequencePath,
    });
    const magicDamageUpResult = resolveKiboRatioAttribute({
      state,
      kiboState,
      action,
      timeMs,
      attributeId: 27,
      fallbackBasisPoints: profile?.magicDamageUpBasisPoints,
      propertyTags,
      settlingSourceSequencePath,
    });
    const elementAttributeId =
      ELEMENT_DAMAGE_ATTRIBUTE_ID_BY_TYPE[Number(hit?.damage?.elementalType)];
    const elementDamageUpResult = resolveKiboRatioAttribute({
      state,
      kiboState,
      action,
      timeMs,
      attributeId: elementAttributeId,
      fallbackBasisPoints:
        profile?.elementDamageUpBasisPointsByType?.[
          Number(hit?.damage?.elementalType)
        ],
      propertyTags,
      settlingSourceSequencePath,
    });
    const physicalPenetrationResult = resolveKiboRatioAttribute({
      state,
      kiboState,
      action,
      timeMs,
      attributeId: 29,
      fallbackBasisPoints: 0,
      propertyTags,
      settlingSourceSequencePath,
    });
    const magicPenetrationResult = resolveKiboRatioAttribute({
      state,
      kiboState,
      action,
      timeMs,
      attributeId: 30,
      fallbackBasisPoints: 0,
      propertyTags,
      settlingSourceSequencePath,
    });
    const masteryResult = resolveRuntimeAttribute({
      state,
      targetKind: EFFECT_TARGET_KINDS.KIBO,
      targetId: action.actorId,
      timeMs,
      attributeId: 229,
      baseRaw: kiboState?.attributesById?.get(229) ?? 0,
      propertyTags,
      settlingActionId: action.id,
      settlingSourceSequencePath,
    });
    return {
      ready: attack != null,
      status:
        attack == null
          ? 'verified-kibo-base-attack-missing'
          : 'verified-kibo-base-profile-ready',
      attack,
      criticalRate: basisPoints(criticalRateResult.value),
      criticalDamage: basisPoints(criticalDamageResult.value, 1),
      damageUp: basisPoints(damageUpResult.value),
      physicalDamageUp: basisPoints(physicalDamageUpResult.value),
      magicDamageUp: basisPoints(magicDamageUpResult.value),
      elementDamageUp: basisPoints(elementDamageUpResult.value),
      physicalPenetrationBasisPoints:
        numberOrNull(physicalPenetrationResult.value) ?? 0,
      magicPenetrationBasisPoints:
        numberOrNull(magicPenetrationResult.value) ?? 0,
      mastery: numberOrNull(masteryResult.value) ?? 0,
      dynamicPropertyTrace: collectDynamicPropertyTrace([
        attackResult,
        criticalRateResult,
        criticalDamageResult,
        damageUpResult,
        physicalDamageUpResult,
        magicDamageUpResult,
        elementDamageUpResult,
        physicalPenetrationResult,
        magicPenetrationResult,
        masteryResult,
      ]),
      sourceIdentity: profile?.sourceIdentity ?? null,
    };
  }
  const actor = action.actor;
  const actorState = state.actorEnergy.get(action.actorId);
  const attackResult = resolveActorRuntimeAttribute({
    state,
    actorState,
    timeMs,
    attributeId: 1,
    fallbackRaw: actor?.stats?.attack,
    propertyTags,
    settlingActionId: action.id,
    settlingSourceSequencePath,
  });
  const criticalRateResult = resolveActorRuntimeAttribute({
    state,
    actorState,
    timeMs,
    attributeId: 7,
    fallbackRaw: ratioToRaw(actor?.stats?.critRate, 0),
    propertyTags,
    settlingActionId: action.id,
    settlingSourceSequencePath,
  });
  const criticalDamageResult = resolveActorRuntimeAttribute({
    state,
    actorState,
    timeMs,
    attributeId: 8,
    fallbackRaw: ratioToRaw(actor?.stats?.critDamage, 10000),
    propertyTags,
    settlingActionId: action.id,
    settlingSourceSequencePath,
  });
  const damageUpResult = resolveActorRuntimeAttribute({
    state,
    actorState,
    timeMs,
    attributeId: 21,
    fallbackRaw: ratioToRaw(actor?.stats?.damageAmplification, 0),
    propertyTags,
    settlingActionId: action.id,
    settlingSourceSequencePath,
  });
  const physicalDamageUpResult = resolveActorRuntimeAttribute({
    state,
    actorState,
    timeMs,
    attributeId: 25,
    fallbackRaw: getAttribute(actor, 'PHYSICAL_SHOOTDMGUP'),
    propertyTags,
    settlingActionId: action.id,
    settlingSourceSequencePath,
  });
  const magicDamageUpResult = resolveActorRuntimeAttribute({
    state,
    actorState,
    timeMs,
    attributeId: 27,
    fallbackRaw: getAttribute(actor, 'MAGIC_SHOOTDMGDUP'),
    propertyTags,
    settlingActionId: action.id,
    settlingSourceSequencePath,
  });
  const elementDamageUpResult = resolveActorRuntimeAttribute({
    state,
    actorState,
    timeMs,
    attributeId:
      ELEMENT_DAMAGE_ATTRIBUTE_ID_BY_TYPE[Number(hit?.damage?.elementalType)],
    fallbackRaw:
      resolveActorElementDamageUp(actor, hit?.damage?.elementalType) * 10000,
    propertyTags,
    settlingActionId: action.id,
    settlingSourceSequencePath,
  });
  const physicalPenetrationResult = resolveActorRuntimeAttribute({
    state,
    actorState,
    timeMs,
    attributeId: 29,
    fallbackRaw: getAttribute(actor, 'PERPIERCING') ?? 0,
    propertyTags,
    settlingActionId: action.id,
    settlingSourceSequencePath,
  });
  const magicPenetrationResult = resolveActorRuntimeAttribute({
    state,
    actorState,
    timeMs,
    attributeId: 30,
    fallbackRaw: getAttribute(actor, 'PERMPIERCING') ?? 0,
    propertyTags,
    settlingActionId: action.id,
    settlingSourceSequencePath,
  });
  const masteryResult = resolveActorRuntimeAttribute({
    state,
    actorState,
    timeMs,
    attributeId: 229,
    fallbackRaw: getAttribute(actor, 'MASTERY') ?? 0,
    propertyTags,
    settlingActionId: action.id,
    settlingSourceSequencePath,
  });
  const attack = numberOrNull(attackResult.value);
  return {
    ready: attack != null,
    status:
      attack == null
        ? 'verified-actor-panel-attack-missing'
        : 'verified-actor-panel-profile-ready',
    attack,
    criticalRate: basisPoints(criticalRateResult.value),
    criticalDamage: basisPoints(criticalDamageResult.value, 1),
    damageUp: basisPoints(damageUpResult.value),
    physicalDamageUp: basisPoints(physicalDamageUpResult.value),
    magicDamageUp: basisPoints(magicDamageUpResult.value),
    elementDamageUp: basisPoints(elementDamageUpResult.value),
    physicalPenetrationBasisPoints:
      numberOrNull(physicalPenetrationResult.value) ?? 0,
    magicPenetrationBasisPoints:
      numberOrNull(magicPenetrationResult.value) ?? 0,
    mastery: numberOrNull(masteryResult.value) ?? 0,
    dynamicPropertyTrace: collectDynamicPropertyTrace([
      attackResult,
      criticalRateResult,
      criticalDamageResult,
      damageUpResult,
      physicalDamageUpResult,
      magicDamageUpResult,
      elementDamageUpResult,
      physicalPenetrationResult,
      magicPenetrationResult,
      masteryResult,
    ]),
    sourceIdentity: actor?.stats?.source ?? 'compiled-actor-stats',
  };
}

function resolveCriticalBranch(
  action,
  hit,
  source,
  {
    scenario,
    descriptor,
    criticalRandomSource,
    targetCriticalRateDefense = 0,
  } = {}
) {
  const hitIdentity = resolveCriticalHitIdentity(hit);
  const hitOverride = action.hitOverrides?.[hitIdentity] ?? null;
  const capturedRoll = numberOrNull(hitOverride?.criticalRoll);
  const persisted =
    action.mechanicsRandomBranches?.[hitIdentity] ??
    action.mechanicsRandomBranches?.[String(hit.elementId)] ??
    action.mechanicsRandomBranch ??
    null;
  const persistedRoll = capturedRoll ?? numberOrNull(persisted?.criticalRoll);
  const explicitOverride = hitOverride?.criticalPolicy ?? null;
  const scenarioCritical = scenario?.combatScenario?.critical ?? {};
  const policy =
    capturedRoll != null
      ? 'captured-critical-roll'
      : explicitOverride == null && persistedRoll != null
        ? 'legacy-persisted-roll'
        : resolveActionHitCriticalPolicy(
            action,
            hitIdentity,
            scenarioCritical.policy
          );
  const sourceCriticalRate = Number(source.criticalRate) || 0;
  const normalizedTargetCriticalRateDefense =
    Number(targetCriticalRateDefense) || 0;
  const sourceCriticalDamageMultiplier =
    numberOrNull(source.criticalDamage) ?? 1;
  const criticalThreshold = calculateEffectiveCriticalThresholdBasisPoints({
    sourceCriticalRate,
    targetCriticalRateDefense: normalizedTargetCriticalRateDefense,
  });
  const sampleKey = createCriticalSampleKey({
    actionId: action.id,
    hitIdentity,
    hitIndex: hit.hitIndex,
    elementId: hit.elementId,
    timeMs: descriptor?.timeMs,
  });
  const base = {
    mode: policy,
    status: 'critical-branch-ready',
    ready: true,
    hitIdentity,
    sampleKey,
    criticalThreshold,
    criticalRate: sourceCriticalRate,
    sourceCriticalRate,
    sourceCriticalRateBasisPoints: Math.round(sourceCriticalRate * 10_000),
    targetCriticalRateDefense: normalizedTargetCriticalRateDefense,
    targetCriticalRateDefenseBasisPoints: Math.round(
      normalizedTargetCriticalRateDefense * 10_000
    ),
    sourceCriticalDamageMultiplier,
    sourceCriticalDamageBasisPoints: Math.round(
      sourceCriticalDamageMultiplier * 10_000
    ),
    replayable: true,
  };

  if (
    policy === 'captured-critical-roll' ||
    policy === 'legacy-persisted-roll'
  ) {
    const criticalRollUnit =
      policy === 'captured-critical-roll'
        ? 'basis-points'
        : 'normalized-unit-interval';
    const normalizedRoll =
      criticalRollUnit === 'basis-points'
        ? persistedRoll / 10_000
        : persistedRoll;
    return {
      ...base,
      policy,
      branchIdentity:
        policy === 'captured-critical-roll'
          ? `captured|${sampleKey}`
          : (persisted?.identity ?? `persisted|${sampleKey}`),
      criticalRoll: persistedRoll,
      criticalRollUnit,
      normalizedCriticalRoll: normalizedRoll,
      critical: isCriticalHit({
        randomRoll: normalizedRoll,
        criticalRate: sourceCriticalRate,
        targetCriticalRateDefense: normalizedTargetCriticalRateDefense,
      }),
    };
  }
  if (policy === COMBAT_CRITICAL_POLICIES.SAMPLED) {
    if (!criticalRandomSource?.nextInt) {
      return {
        ...base,
        status: 'critical-sampled-random-source-missing',
        reason: 'critical-sampled-random-source-missing',
        ready: false,
        branchIdentity: `sampled-unresolved|${sampleKey}`,
        criticalRoll: null,
        critical: false,
      };
    }
    const sampleContext = {
      actionId: action.id,
      hitIdentity,
      hitIndex: hit.hitIndex,
      elementId: hit.elementId,
      timeMs: descriptor?.timeMs,
    };
    const sample = criticalRandomSource.nextSample
      ? criticalRandomSource.nextSample(10_000, sampleContext)
      : {
          value: criticalRandomSource.nextInt(10_000, sampleContext),
          streamIndex: null,
          sampleKey,
        };
    const criticalRoll = sample.value;
    return {
      ...base,
      policy: 'seeded-sampled',
      randomAlgorithm: criticalRandomSource.algorithm ?? null,
      randomSeed: criticalRandomSource.seed ?? scenarioCritical.seed ?? null,
      criticalStreamIndex: sample.streamIndex,
      sampleKey: sample.sampleKey ?? sampleKey,
      branchIdentity: `sampled|${sample.streamIndex ?? 'external'}|${sampleKey}`,
      criticalRoll,
      critical: criticalRoll < criticalThreshold,
    };
  }
  if (policy === COMBAT_CRITICAL_POLICIES.EXPECTED) {
    const sideEffectIdentities = collectCriticalStateSideEffectIdentities(hit);
    if (sideEffectIdentities.length > 0) {
      return {
        ...base,
        policy: 'expected',
        status: 'critical-expected-state-branch-unsupported',
        reason: 'critical-expected-state-branch-unsupported',
        ready: false,
        branchIdentity: `expected-unresolved|${sampleKey}`,
        criticalRoll: null,
        critical: false,
        sideEffectIdentities,
      };
    }
    return {
      ...base,
      policy: 'expected',
      branchIdentity: `expected|${sampleKey}`,
      criticalRoll: null,
      critical: false,
      expected: true,
      expectedCriticalProbabilityBasisPoints: criticalThreshold,
    };
  }
  if (policy === COMBAT_CRITICAL_POLICIES.CRITICAL) {
    return {
      ...base,
      policy: 'forced-critical',
      branchIdentity: `critical|${sampleKey}`,
      criticalRoll: null,
      critical: true,
    };
  }
  return {
    ...base,
    mode: ACTION_HIT_CRITICAL_POLICIES.NON_CRITICAL,
    policy: 'deterministic-non-critical-baseline',
    branchIdentity: `non-critical|${action.id}|${hit.hitIndex}|${hit.elementId}`,
    criticalRoll: null,
    critical: false,
  };
}

function calculateCriticalAwareDamage({
  damageType,
  damageInput,
  randomBranch,
}) {
  if (damageType === 6) {
    return { ready: true, result: calculateRealDamage(damageInput) };
  }
  if (damageType === 10) {
    return {
      ready: true,
      result: calculateStackOverLimitDamage(damageInput),
    };
  }
  if (damageType === 8) {
    return {
      ready: true,
      result: { mode: 'pure-weakness', value: 0, raw: '0', trace: [] },
    };
  }
  if (!randomBranch.expected) {
    return { ready: true, result: calculateNormalDamage(damageInput) };
  }
  if (
    (damageInput.valueShields?.length ?? 0) > 0 ||
    (damageInput.hitCountShields?.length ?? 0) > 0
  ) {
    return {
      ready: false,
      status: 'critical-expected-state-branch-unsupported',
      reason: 'critical-expected-shield-branch-unsupported',
    };
  }
  const nonCritical = calculateNormalDamage({
    ...damageInput,
    critical: false,
  });
  const critical = calculateNormalDamage({
    ...damageInput,
    critical: true,
  });
  const probabilityBasisPoints = BigInt(
    randomBranch.expectedCriticalProbabilityBasisPoints
  );
  const denominator = 10_000n;
  const raw = blendRaw(
    BigInt(nonCritical.raw),
    BigInt(critical.raw),
    probabilityBasisPoints,
    denominator
  );
  const preShieldRaw = blendRaw(
    BigInt(nonCritical.preShieldRaw ?? nonCritical.raw),
    BigInt(critical.preShieldRaw ?? critical.raw),
    probabilityBasisPoints,
    denominator
  );
  const weightedRaw = raw.toString();
  const weightedValue = qToNumber(raw);
  const weightedInteger = runtimeIntegerize(raw).toString();
  const nonCriticalValue = qToNumber(BigInt(nonCritical.raw));
  const criticalValue = qToNumber(BigInt(critical.raw));
  return {
    ready: true,
    result: {
      ...nonCritical,
      mode: 'normal-expected-critical',
      raw: weightedRaw,
      preShieldRaw: preShieldRaw.toString(),
      value: weightedValue,
      integer: weightedInteger,
      trace: [
        ...nonCritical.trace,
        {
          name: 'critical_expected_value',
          raw: raw.toString(),
          value: qToNumber(raw),
          probabilityBasisPoints: Number(probabilityBasisPoints),
          nonCriticalRaw: nonCritical.raw,
          criticalRaw: critical.raw,
          criticalEventMaterialized: false,
        },
      ],
      expectedCritical: {
        probabilityBasisPoints: Number(probabilityBasisPoints),
        nonCriticalRaw: nonCritical.raw,
        nonCriticalValue,
        criticalRaw: critical.raw,
        criticalValue,
        weightedRaw,
        weightedValue,
        weightedInteger,
        criticalEventMaterialized: false,
      },
    },
  };
}

function blendRaw(nonCriticalRaw, criticalRaw, numerator, denominator) {
  return (
    (nonCriticalRaw * (denominator - numerator) + criticalRaw * numerator) /
    denominator
  );
}

function resolveCriticalHitIdentity(hit) {
  return String(
    hit.identity ??
      hit.hitIdentity ??
      hit.sourceIdentity ??
      `${hit.elementId}|${hit.hitIndex}`
  );
}

function collectCriticalStateSideEffectIdentities(hit) {
  return [
    ...(hit.criticalStateEffectIdentities ?? []),
    ...(hit.damage?.criticalStateEffectIdentities ?? []),
  ]
    .map(value => String(value ?? '').trim())
    .filter(Boolean);
}

function clampInteger(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Math.trunc(Number(value) || 0)));
}

function createActorSpSource(actorState, state, timeMs) {
  const actor = actorState.actor;
  const profile = actorState.profile;
  return {
    applied: actorState != null,
    sprSec: resolveActorRuntimeRatio({
      state,
      actorState,
      timeMs,
      attributeId: 110,
      fallbackRaw: profile?.sprSecBasisPoints ?? getAttribute(actor, 'SPR_SEC'),
    }),
    sprSecBack: resolveActorRuntimeRatio({
      state,
      actorState,
      timeMs,
      attributeId: 226,
      fallbackRaw:
        profile?.sprSecBackBasisPoints ?? getAttribute(actor, 'SPR_SEC_BACK'),
    }),
    spGetUp: resolveActorRuntimeRatio({
      state,
      actorState,
      timeMs,
      attributeId: 105,
      fallbackRaw:
        profile?.spGetUpBasisPoints ?? getAttribute(actor, 'SPGETUP'),
    }),
    spRetAuto: resolveActorRuntimeRatio({
      state,
      actorState,
      timeMs,
      attributeId: 227,
      fallbackRaw:
        profile?.spRetAutoBasisPoints ??
        getAttribute(actor, 'SPRET_AUTO') ??
        getAttribute(actor, 'SPGETUP_AUTO'),
    }),
    spGetUpAttack: resolveActorRuntimeRatio({
      state,
      actorState,
      timeMs,
      attributeId: 228,
      fallbackRaw:
        profile?.spGetUpAttackBasisPoints ?? getAttribute(actor, 'SPGETUP_ATK'),
    }),
    sourceIdentity: profile?.sourceIdentity ?? null,
  };
}

function createKiboSpSource(kiboState, state, timeMs) {
  const profile = kiboState?.profile;
  return {
    applied: profile?.applied === true,
    sprSec: resolveKiboRuntimeRatio({
      state,
      kiboState,
      timeMs,
      attributeId: 110,
      fallbackRaw: profile?.sprSecBasisPoints,
    }),
    sprSecBack: resolveKiboRuntimeRatio({
      state,
      kiboState,
      timeMs,
      attributeId: 226,
      fallbackRaw: profile?.sprSecBackBasisPoints,
    }),
    spGetUp: resolveKiboRuntimeRatio({
      state,
      kiboState,
      timeMs,
      attributeId: 105,
      fallbackRaw: profile?.spGetUpBasisPoints,
    }),
    spRetAuto: resolveKiboRuntimeRatio({
      state,
      kiboState,
      timeMs,
      attributeId: 227,
      fallbackRaw:
        profile?.spRetAutoBasisPoints ?? profile?.spGetUpAutoBasisPoints,
    }),
    spGetUpAttack: resolveKiboRuntimeRatio({
      state,
      kiboState,
      timeMs,
      attributeId: 228,
      fallbackRaw: profile?.spGetUpAttackBasisPoints,
    }),
    sourceIdentity: profile?.sourceIdentity ?? null,
  };
}

function createActorResourceEvent({
  timeMs,
  action,
  actorId,
  actorName,
  resourceState,
  change,
  reason,
  confidence,
  hitKey,
  hitIndex = null,
  hitSkillId = null,
  elementId = null,
  source = null,
}) {
  const afterValue = roundValue(resourceState?.current);
  const beforeValue = roundValue(afterValue - change);
  return {
    type: 'VERIFIED_RESOURCE_CHANGE',
    timeMs: roundValue(timeMs),
    actionId: action?.id ?? null,
    actorId,
    hitKey,
    hitIndex,
    hitSkillId,
    payload: {
      verifiedCombat: true,
      actorName: actorName ?? action?.actor?.name ?? null,
      resource: 'sp',
      valueUnit: 'absolute-sp-points',
      beforeValue,
      change: roundValue(change),
      afterValue,
      currentValue: afterValue,
      maxValue: roundValue(resourceState?.max),
      reason,
      confidence,
      elementId,
      packageId:
        source?.packageId ??
        getInstalledVerifiedCombatMechanicsPackage()?.packageId,
      sourceIdentity:
        source?.actionBinding?.identity ?? source?.sourceIdentity ?? null,
      resourceOwnerSourceIdentity: source?.sourceIdentity ?? null,
      recoverIntervalIdentity: source?.recoverIntervalIdentity ?? null,
      share: source?.share ?? null,
      formula: source?.formula ?? null,
      ...(source?.damageSettlement
        ? {
            resourceSettlement: {
              status: 'applied',
              basis: 'verified-landed-hit-recovery-transaction',
              transactionIdentity:
                source.hitRecoveryTransactionIdentity ?? null,
            },
            damageSettlement: source.damageSettlement,
          }
        : {}),
      appliedToCalculators: true,
    },
  };
}

function createKiboResourceEvent({
  timeMs,
  action,
  kiboState,
  change,
  reason,
  hitKey,
  hitIndex = null,
  hitSkillId = null,
  elementId = null,
  source = null,
}) {
  const afterValue = roundValue(kiboState.current);
  const beforeValue = roundValue(afterValue - change);
  return {
    type: 'VERIFIED_KIBO_RESOURCE_CHANGE',
    timeMs: roundValue(timeMs),
    actionId: action?.id ?? null,
    actorId: kiboState.actorId,
    hitKey,
    hitIndex,
    hitSkillId,
    payload: {
      verifiedCombat: true,
      resource: 'kibo-energy',
      valueUnit: 'absolute-sp-points',
      slotId: kiboState.slotId,
      kiboId: kiboState.kiboId,
      beforeValue,
      change: roundValue(change),
      afterValue,
      currentValue: afterValue,
      maxValue: kiboState.max,
      reason,
      confidence: 'verified',
      elementId,
      packageId:
        source?.packageId ??
        getInstalledVerifiedCombatMechanicsPackage()?.packageId,
      sourceIdentity:
        source?.actionBinding?.identity ?? source?.sourceIdentity ?? null,
      resourceOwnerSourceIdentity: source?.sourceIdentity ?? null,
      recoverIntervalIdentity: source?.recoverIntervalIdentity ?? null,
      share: source?.share ?? null,
      formula: source?.formula ?? null,
      ...(source?.damageSettlement
        ? {
            resourceSettlement: {
              status: 'applied',
              basis: 'verified-landed-hit-recovery-transaction',
              transactionIdentity:
                source.hitRecoveryTransactionIdentity ?? null,
            },
            damageSettlement: source.damageSettlement,
          }
        : {}),
      appliedToCalculators: true,
    },
  };
}

function updateShieldState(enemy, damageResult, input) {
  if (Array.isArray(damageResult.remainingShields)) {
    enemy.valueShields = damageResult.remainingShields.map((raw, index) => ({
      ...(input.valueShields[index] ?? {}),
      raw,
    }));
  }
  if (Array.isArray(damageResult.remainingHitCountShields)) {
    enemy.hitCountShields = damageResult.remainingHitCountShields;
  }
}

function resolveEnemyElementDefense(
  enemy,
  elementalType,
  state,
  timeMs,
  propertyTags = [],
  settlingSourceSequencePath = null
) {
  const row = (enemy?.elementDefenses ?? []).find(
    item => Number(item.elementId) === Number(elementalType)
  );
  const keyByElement = {
    0: 'NORMAL_DEFENSE',
    1: 'FIRE_DEFENSE',
    2: 'WIND_DEFENSE',
    3: 'EARTH_DEFENSE',
    4: 'WOOD_DEFENSE',
    5: 'ICE_DEFENSE',
    6: 'WATER_DEFENSE',
    7: 'ELEC_DEFENSE',
    8: 'LIGHT_DEFENSE',
    9: 'DARK_DEFENSE',
  };
  const attributeId = state.attributeIdByKey.get(keyByElement[elementalType]);
  const result = resolveRuntimeAttribute({
    state,
    targetKind: EFFECT_TARGET_KINDS.ENEMY,
    targetId: enemy?.id,
    timeMs,
    attributeId,
    baseRaw: row?.effectiveValue,
    propertyTags,
    settlingSourceSequencePath,
  });
  return basisPoints(result.value);
}

function resolveBeforeDamageElementExtraRatio({
  state,
  action,
  resolution,
  timeMs,
  elementalType,
  propertyTags,
  settlingSourceSequencePath,
}) {
  const attributeId =
    ELEMENT_DAMAGE_ATTRIBUTE_ID_BY_TYPE[Number(elementalType)];
  if (!Number.isInteger(attributeId)) return 0;
  const targetKind =
    resolution?.actionBinding?.ownerKind === 'kibo'
      ? EFFECT_TARGET_KINDS.KIBO
      : EFFECT_TARGET_KINDS.ACTOR;
  const activeEffects = resolveActiveEffectsAt(state.effectTimeline, timeMs, {
    targetKind,
    targetId: action.actorId,
    calculatorOnly: true,
    settlingActionId: action.id,
    settlingSourceSequencePath,
  });
  const dynamicExtraRaw = activeEffects.reduce((total, effect) => {
    if (effect.sourceIdentity?.triggerEvent !== 'BeforeDamage') return total;
    const stacks = Number(effect.stacks ?? 1);
    const effectExtraRaw = (effect.modifiers ?? [])
      .filter(
        modifier =>
          modifier.kind === 'battle-property' &&
          modifier.bucket === 'dynamicExtra' &&
          Number(modifier.attributeId) === attributeId &&
          matchesVerifiedBattlePropertyTags(modifier.propertyTags, propertyTags)
      )
      .reduce(
        (sum, modifier) => sum + Number(modifier.valueRaw ?? 0) * stacks,
        0
      );
    return total + effectExtraRaw;
  }, 0);
  return basisPoints(dynamicExtraRaw);
}

function resolveActorElementDamageUp(actor, elementalType) {
  const keyByElement = {
    0: 'NORMAL_SHOOTDMGUP',
    1: 'FIRE_SHOOTDMGUP',
    2: 'WIND_SHOOTDMGUP',
    3: 'EARTH_SHOOTDMGUP',
    4: 'WOOD_SHOOTDMGUP',
    5: 'ICE_SHOOTDMGUP',
    6: 'WATER_SHOOTDMGUP',
    7: 'ELEC_SHOOTDMGUP',
    8: 'LIGHT_SHOOTDMGUP',
    9: 'DARK_SHOOTDMGUP',
  };
  return basisPoints(getAttribute(actor, keyByElement[elementalType]));
}

function resolveRuntimeWeaknessTypeMultiplier({
  enemyProfile,
  damage,
  state,
  scenario,
  timeMs,
  propertyTags = [],
  settlingSourceSequencePath = null,
}) {
  const physical = Number(damage?.physicalRatioBasisPoints) > 0;
  const attributeId = physical ? 202 : 203;
  const baseRaw = physical
    ? enemyProfile?.typeMultipliersBasisPoints?.physical
    : enemyProfile?.typeMultipliersBasisPoints?.magic;
  const result = resolveRuntimeAttribute({
    state,
    targetKind: EFFECT_TARGET_KINDS.ENEMY,
    targetId: scenario?.enemy?.id,
    timeMs,
    attributeId,
    baseRaw,
    propertyTags,
    settlingSourceSequencePath,
  });
  return basisPoints(result.value, 1);
}

function resolveWeaknessElementMultiplier(enemyProfile, hit) {
  return basisPoints(
    enemyProfile?.elementMultipliersBasisPoints?.[
      Number(hit.damage.elementalType)
    ],
    1
  );
}

function getAttribute(entity, key) {
  return entity?.baseAttributes?.find(attribute => attribute.key === key)
    ?.value;
}

function resolveHitRatio(hit, action) {
  const level = clampNumber(
    action.type === ACTION_TYPES.KIBO_EVENT ? 1 : (action.level ?? 1),
    1,
    12
  );
  return numberOrNull(
    hit.formula?.ratiosByLevel?.[level] ??
      hit.formula?.coefficientRaw ??
      hit.damage?.coefficientRaw
  );
}

function findKiboStateByAction(state, action) {
  const slotId = state.slotIdByActorId.get(String(action.actorId));
  const entry = slotId ? state.kiboEnergy.get(slotId) : null;
  const expectedKiboId = Number(action.kiboId ?? action.actor?.loadout?.kiboId);
  if (!entry || Number(entry.kiboId) !== expectedKiboId) return null;
  return entry;
}

function findKiboStateByActorId(state, actorId, expectedKiboId) {
  const slotId = state.slotIdByActorId.get(String(actorId));
  const entry = slotId ? state.kiboEnergy.get(slotId) : null;
  if (!entry || Number(entry.kiboId) !== Number(expectedKiboId)) return null;
  return entry;
}

function createResourceExecutionBlock({
  descriptor,
  status,
  reason,
  resourceState = null,
  requiredValue = null,
}) {
  const resolution = descriptor.resolution;
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-verified-resource-execution-block',
    code: 'verified-resource-cost-unavailable',
    status,
    executable: false,
    actionId: descriptor.action.id,
    actionName: descriptor.action.name ?? descriptor.action.id,
    sourceSequenceIndex: descriptor.sourceSequenceIndex ?? null,
    sourceSequencePath: descriptor.sourceSequencePath ?? null,
    sourceSequenceSource:
      descriptor.action.sourceSequenceSource ?? 'scenario-action-array-order',
    actorId: descriptor.action.actorId ?? null,
    ownerKind: resolution.actionBinding.ownerKind,
    slotId: resourceState?.slotId ?? null,
    kiboId: resourceState?.kiboId ?? null,
    timeMs: roundValue(descriptor.timeMs),
    requiredValue: requiredValue == null ? null : roundValue(requiredValue),
    currentValue:
      resourceState?.current == null ? null : roundValue(resourceState.current),
    maxValue: resourceState?.max == null ? null : roundValue(resourceState.max),
    valueUnit: 'absolute-sp-points',
    reason,
    sourceIdentity: resolution.controlBinding?.logic?.sourceIdentity ?? null,
    appliedToCalculators: true,
  };
}

function createResourceExecutionBlockedEvent(block) {
  return {
    type: 'VERIFIED_ACTION_RESOURCE_BLOCKED',
    timeMs: block.timeMs,
    actionId: block.actionId,
    actorId: block.actorId,
    payload: block,
  };
}

function appendRuntimeEvent(target, event, state) {
  const runtimeSequenceIndex = state.nextRuntimeSequenceIndex;
  state.nextRuntimeSequenceIndex += 1;
  event.absoluteFrame = Number.isInteger(event.absoluteFrame)
    ? event.absoluteFrame
    : timeToFrame(event.timeMs);
  event.runtimePhase = event.runtimePhase ?? 'settlement';
  event.runtimePhasePriority = Number(event.runtimePhasePriority) || 0;
  event.runtimePriority = Number(event.runtimePriority) || 0;
  event.runtimeSequenceIndex = runtimeSequenceIndex;
  if (event.payload) {
    event.payload.absoluteFrame = event.absoluteFrame;
    event.payload.runtimePhase = event.runtimePhase;
    event.payload.runtimePhasePriority = event.runtimePhasePriority;
    event.payload.runtimePriority = event.runtimePriority;
    event.payload.runtimeSequenceIndex = runtimeSequenceIndex;
  }
  target.push(event);
  return event;
}

function applyClampedResourceChange(state, requestedChange) {
  const before = state.current;
  state.current = clampNumber(before + Number(requestedChange), 0, state.max);
  return roundValue(state.current - before);
}

function createEnemyStateSnapshot(enemy) {
  return {
    ...(enemy.targetPolicy?.explicit
      ? { targetPolicy: projectCombatTargetPolicy(enemy.targetPolicy) }
      : {}),
    hp: roundValue(enemy.hp),
    toughness: roundValue(enemy.toughness),
    inBreak: enemy.inBreak === true,
    breakPhase:
      enemy.breakPhase ?? (enemy.inBreak ? 'linear_recovery' : 'normal'),
    breakStartedAtMs: numberOrNull(enemy.breakStartedAtMs),
    normalRecoveryEligibleAtMs: numberOrNull(enemy.normalRecoveryEligibleAtMs),
    lastToughnessSourceActionId: enemy.lastToughnessSourceActionId ?? null,
    lastToughnessSourceActorId: enemy.lastToughnessSourceActorId ?? null,
    lastToughnessBindingIdentity: enemy.lastToughnessBindingIdentity ?? null,
    valueShields: normalizeValueShields(enemy.valueShields),
    hitCountShields: normalizeHitCountShields(enemy.hitCountShields),
  };
}

function weaknessStateEventLabel(kind) {
  if (kind === 'normal-toughness-recovery') return '韧性自然恢复';
  if (kind === 'break-linear-recovery') return 'Break 韧性恢复';
  if (kind === 'break-end-wait') return 'Break 结束等待';
  if (kind === 'break-exit') return 'Break 结束';
  return '韧性状态变化';
}

function createFinalState(state, timeMs = 0) {
  for (const vital of state.actorVitals.values()) {
    refreshFriendlyVitalMaximumAt({
      state,
      target: { kind: EFFECT_TARGET_KINDS.ACTOR, id: vital.actorId },
      timeMs,
    });
  }
  for (const vital of state.kiboVitals.values()) {
    refreshFriendlyVitalMaximumAt({
      state,
      target: { kind: EFFECT_TARGET_KINDS.KIBO, id: vital.actorId },
      timeMs,
    });
  }
  return {
    enemy: {
      ...(state.enemy.targetPolicy?.explicit
        ? {
            targetPolicy: projectCombatTargetPolicy(state.enemy.targetPolicy),
          }
        : {}),
      enemyId: state.enemy.enemyId,
      hp: roundValue(state.enemy.hp),
      maxHp: roundValue(state.enemy.maxHp),
      toughness: roundValue(state.enemy.toughness),
      maxToughness: roundValue(state.enemy.maxToughness),
      inBreak: state.enemy.inBreak,
      breakPhase:
        state.enemy.breakPhase ??
        (state.enemy.inBreak ? 'linear_recovery' : 'normal'),
      breakElapsedMs:
        state.enemy.inBreak && state.enemy.breakStartedAtMs != null
          ? roundValue(
              Math.max(0, Number(timeMs) - state.enemy.breakStartedAtMs)
            )
          : 0,
      recoveryDelayRemainingMs:
        !state.enemy.inBreak &&
        state.enemy.normalRecoveryEligibleAtMs != null &&
        state.enemy.toughness < state.enemy.maxToughness
          ? roundValue(
              Math.max(
                0,
                state.enemy.normalRecoveryEligibleAtMs - Number(timeMs)
              )
            )
          : 0,
      lastToughnessSourceActionId:
        state.enemy.lastToughnessSourceActionId ?? null,
      lastToughnessSourceActorId:
        state.enemy.lastToughnessSourceActorId ?? null,
      lastToughnessBindingIdentity:
        state.enemy.lastToughnessBindingIdentity ?? null,
      profileSourceIdentity: state.enemy.profile?.sourceIdentity ?? null,
      valueShields: normalizeValueShields(state.enemy.valueShields),
      hitCountShields: normalizeHitCountShields(state.enemy.hitCountShields),
    },
    actorEnergy: [...state.actorEnergy.values()].map(entry => ({
      actorId: entry.actor.id,
      currentValue: roundValue(entry.current),
      maxValue: entry.max,
      valueUnit: 'absolute-sp-points',
    })),
    actorVitals: [...state.actorVitals.values()].map(entry => ({
      actorId: entry.actorId,
      currentHp: roundValue(entry.currentHp),
      maximumHp: roundValue(entry.maximumHp),
      baseMaximumHp: numberOrNull(entry.baseMaximumHp),
      inheritedMaximumHpSnapshot: numberOrNull(
        entry.inheritedMaximumHpSnapshot
      ),
      hasInheritedCurrentHp: entry.hasInheritedCurrentHp === true,
      valueShields: entry.valueShields.map(shield => ({ ...shield })),
    })),
    kiboVitals: [...state.kiboVitals.values()].map(entry => ({
      slotId: entry.slotId,
      actorId: entry.actorId,
      kiboId: entry.kiboId,
      currentHp: roundValue(entry.currentHp),
      maximumHp: roundValue(entry.maximumHp),
      baseMaximumHp: numberOrNull(entry.baseMaximumHp),
      inheritedMaximumHpSnapshot: numberOrNull(
        entry.inheritedMaximumHpSnapshot
      ),
      hasInheritedCurrentHp: entry.hasInheritedCurrentHp === true,
      valueShields: entry.valueShields.map(shield => ({ ...shield })),
    })),
    vitalDiagnostics: state.vitalDiagnostics.map(entry => ({ ...entry })),
    kiboEnergy: [...state.kiboEnergy.values()].map(entry => ({
      slotId: entry.slotId,
      actorId: entry.actorId,
      kiboId: entry.kiboId,
      currentValue: roundValue(entry.current),
      maxValue: entry.max,
      valueUnit: 'absolute-sp-points',
    })),
  };
}

function createUnavailableRuntime({ enabled, reason }) {
  return {
    schemaVersion: 1,
    contractName: VERIFIED_COMBAT_RUNTIME_CONTRACT_NAME,
    sourceKind: 'azpr-verified-combat-runtime',
    status: reason,
    enabled,
    ready: false,
    actionResolutionById: new Map(),
    actionResolutions: [],
    damageEvents: [],
    resourceEvents: [],
    kiboResourceEvents: [],
    vitalEvents: [],
    eventLog: [],
    executionBlocks: [],
    initialState: null,
    finalState: null,
    summary: {
      actionResolutionCount: 0,
      readyActionResolutionCount: 0,
      unresolvedActionResolutionCount: 0,
      damageEventCount: 0,
      hitEventCount: 0,
      kiboPassiveDerivedDamageEventCount: 0,
      toughnessStateEventCount: 0,
      normalRecoveryEventCount: 0,
      breakRecoveryEventCount: 0,
      breakExitCount: 0,
      resourceEventCount: 0,
      kiboResourceEventCount: 0,
      vitalEventCount: 0,
      kiboPassivePeriodicHealEventCount: 0,
      kiboPassivePeriodicHealSuppressedEventCount: 0,
      kiboPassiveVitalDamageEventCount: 0,
      kiboPassiveVitalDamageSuppressedEventCount: 0,
      breakTriggerCount: 0,
      shieldedHitCount: 0,
      enemySettlementTruncatedCount: 0,
      resourceBlockedActionCount: 0,
      applied: false,
    },
    applied: false,
  };
}

function normalizePenetration(value) {
  const number = numberOrNull(value);
  return number == null || number < 0 ? 0 : number;
}

function combinePenetrationBasisPoints(...values) {
  return clampNumber(
    values.reduce((sum, value) => sum + normalizePenetration(value), 0),
    0,
    10_000
  );
}

function normalizeValueShields(values) {
  return (Array.isArray(values) ? values : []).map(value => {
    const normalized =
      typeof value === 'object' && value !== null ? { ...value } : { value };
    if (typeof normalized.raw === 'bigint') {
      normalized.raw = normalized.raw.toString();
    }
    return normalized;
  });
}

function normalizeHitCountShields(values) {
  return (Array.isArray(values) ? values : []).map(value =>
    typeof value === 'object' && value !== null
      ? { ...value, count: Math.max(0, Number(value.count) || 0) }
      : { count: Math.max(0, Number(value) || 0) }
  );
}

function multiplyQ16(value, factor) {
  return qToNumber(qMul(qFromFloat(value), qFromFloat(factor)));
}

function basisPoints(value, fallback = 0) {
  const number = numberOrNull(value);
  return number == null ? fallback : number / 10000;
}

function ratioToRaw(value, fallbackRaw = 0) {
  const number = numberOrNull(value);
  return number == null ? fallbackRaw : number * 10000;
}

function annotateRuntimeDescriptorOrder(descriptors, frameRate) {
  descriptors.forEach((descriptor, sourceSequence) => {
    const order = resolveDescriptorOrder(descriptor.kind);
    const actionSourceSequencePath = getActionSourceSequencePath(
      descriptor.action
    );
    descriptor.absoluteFrame = Number.isInteger(descriptor.absoluteFrame)
      ? descriptor.absoluteFrame
      : timeToFrame(descriptor.timeMs, frameRate);
    descriptor.runtimePhase = order.phase;
    descriptor.runtimePhasePriority = order.phasePriority;
    descriptor.runtimePriority = order.priority;
    descriptor.sourceSequence = sourceSequence;
    descriptor.sourceSequenceIndex = actionSourceSequencePath?.[0] ?? null;
    const damageSettlementSequencePath =
      descriptor.damageEventTransaction?.settlementSourceSequencePath;
    const tuningSourceSequencePath =
      descriptor.tuningEvent?.eventContext?.sourceSequencePath;
    const directEffectSequencePath = descriptor.directEvent?.sourceSequencePath;
    const existingSourceSequencePath = descriptor.sourceSequencePath;
    const directEffectDescriptor = isDirectEffectDescriptor(descriptor);
    descriptor.sourceSequencePath = Array.isArray(damageSettlementSequencePath)
      ? [...damageSettlementSequencePath]
      : Array.isArray(tuningSourceSequencePath)
        ? [...tuningSourceSequencePath]
        : Array.isArray(directEffectSequencePath)
          ? [...directEffectSequencePath]
          : Array.isArray(existingSourceSequencePath)
            ? [...existingSourceSequencePath]
            : directEffectDescriptor
              ? null
              : actionSourceSequencePath
                ? [...actionSourceSequencePath, sourceSequence]
                : [Number.MAX_SAFE_INTEGER, sourceSequence];
    descriptor.sourceSequenceStatus = directEffectDescriptor
      ? Array.isArray(descriptor.sourceSequencePath)
        ? 'verified-direct-effect-source-sequence-ready'
        : 'verified-direct-effect-source-sequence-unresolved'
      : 'runtime-descriptor-source-sequence-ready';
  });
}

function isDirectEffectDescriptor(descriptor) {
  return ['direct-sp', 'direct-heal', 'direct-shield'].includes(
    descriptor?.kind
  );
}

function resolveDescriptorOrder(kind) {
  const priority = {
    'action-cost': 0,
    'passive-vital-change': 1,
    'weakness-state-tick': 1,
    'direct-sp': 2,
    'direct-heal': 2,
    'direct-shield': 2,
    'passive-periodic-heal': 2,
    'passive-periodic-heal-contract-unresolved': 2,
    'passive-derived-self-heal': 2,
    'passive-derived-periodic-contract-unresolved': 2,
    hit: 3,
    'passive-derived-hit': 3,
    'passive-derived-dot': 3,
    'passive-retaliation-hit': 3,
    'tuning-combat': 4,
    'manual-resource': 4,
    'auto-sp-tick': 5,
  };
  const phaseByKind = {
    'action-cost': ['pre-action', 0],
    'passive-vital-change': ['state-transition', 1],
    'weakness-state-tick': ['state-transition', 1],
    'direct-sp': ['direct-effect', 2],
    'direct-heal': ['direct-effect', 2],
    'direct-shield': ['direct-effect', 2],
    'passive-periodic-heal': ['direct-effect', 2],
    'passive-periodic-heal-contract-unresolved': ['direct-effect', 2],
    'passive-derived-self-heal': ['direct-effect', 2],
    'passive-derived-periodic-contract-unresolved': ['direct-effect', 2],
    hit: ['combat-hit', 3],
    'passive-derived-hit': ['combat-hit', 3],
    'passive-derived-dot': ['combat-hit', 3],
    'passive-retaliation-hit': ['combat-hit', 3],
    'tuning-combat': ['post-hit-resource', 4],
    'manual-resource': ['post-hit-resource', 4],
    'auto-sp-tick': ['automatic-recovery', 5],
  };
  const [phase, phasePriority] = phaseByKind[kind] ?? ['unresolved', 9];
  return { phase, phasePriority, priority: priority[kind] ?? 9 };
}

function compareDescriptors(left, right) {
  return (
    left.absoluteFrame - right.absoluteFrame ||
    left.runtimePhasePriority - right.runtimePhasePriority ||
    left.runtimePriority - right.runtimePriority ||
    compareSourceSequencePaths(
      left.sourceSequencePath,
      right.sourceSequencePath
    ) ||
    left.sourceSequence - right.sourceSequence
  );
}

function compareEvents(left, right) {
  return (
    resolveEventAbsoluteFrame(left) - resolveEventAbsoluteFrame(right) ||
    Number(left.runtimePhasePriority ?? 0) -
      Number(right.runtimePhasePriority ?? 0) ||
    Number(left.runtimePriority ?? 0) - Number(right.runtimePriority ?? 0) ||
    Number(left.runtimeSequenceIndex ?? Number.MAX_SAFE_INTEGER) -
      Number(right.runtimeSequenceIndex ?? Number.MAX_SAFE_INTEGER)
  );
}

function resolveEventAbsoluteFrame(event) {
  return Number.isInteger(event.absoluteFrame)
    ? event.absoluteFrame
    : timeToFrame(event.timeMs);
}

function createEnemySettlementCursor(descriptor) {
  const sourceSequencePath = Array.isArray(descriptor?.sourceSequencePath)
    ? [...descriptor.sourceSequencePath]
    : null;
  const absoluteFrame = Number.isInteger(descriptor?.absoluteFrame)
    ? descriptor.absoluteFrame
    : timeToFrame(descriptor?.timeMs);
  const runtimePhasePriority = Number(descriptor?.runtimePhasePriority ?? 0);
  const runtimePriority = Number(descriptor?.runtimePriority ?? 0);
  const sourceSequence = Number.isInteger(descriptor?.sourceSequence)
    ? descriptor.sourceSequence
    : null;
  return {
    absoluteFrame,
    timeMs: roundValue(descriptor?.timeMs),
    runtimePhase: descriptor?.runtimePhase ?? null,
    runtimePhasePriority,
    runtimePriority,
    sourceSequencePath,
    sourceSequence,
    descriptorKind: descriptor?.kind ?? null,
    cursorIdentity: [
      absoluteFrame,
      runtimePhasePriority,
      runtimePriority,
      sourceSequencePath?.join('.') ?? 'unresolved',
      sourceSequence ?? 'unresolved',
    ].join('|'),
  };
}

function resolveRequestedHpDamage(damageResult) {
  const trace = Array.isArray(damageResult?.trace) ? damageResult.trace : [];
  const protectionIndex = trace.findIndex(
    step => step?.name === 'minimum_hp_protection'
  );
  if (protectionIndex > 0) {
    const beforeProtectionRaw = trace[protectionIndex - 1]?.raw;
    if (beforeProtectionRaw != null) {
      return Math.max(
        0,
        Number(runtimeIntegerize(BigInt(beforeProtectionRaw)))
      );
    }
  }
  return Math.max(0, Number(damageResult?.value) || 0);
}

function resolveHpDamageMultiplier({ inBreakForHpDamage, enemyProfile }) {
  return inBreakForHpDamage
    ? roundValue(1 + basisPoints(enemyProfile?.breakDamageUpBasisPoints))
    : 1;
}

function timeToFrame(timeMs, frameRate = FRAME_RATE) {
  return Math.round((Number(timeMs) * Number(frameRate)) / 1000);
}

function resolveCombatTargetPolicy(scenario) {
  const source = scenario?.combatScenario?.target ?? {};
  return {
    explicit: scenario?.combatScenario?.target != null,
    hpMode: source.hpMode === 'infinite' ? 'infinite' : 'finite',
    toughnessMode: source.toughnessMode === 'disabled' ? 'disabled' : 'enabled',
    breakMode: source.breakMode === 'disabled' ? 'disabled' : 'enabled',
    deathTruncation:
      source.deathTruncation === 'disabled' ? 'disabled' : 'enabled',
  };
}

function createEnemyDamageHpProtectionInput(enemy) {
  if (enemy?.targetPolicy?.hpMode === 'infinite') {
    return {
      currentHp: null,
      minimumRemainingHp: null,
    };
  }
  return {
    currentHp: enemy?.hp ?? null,
    minimumRemainingHp: 0,
  };
}

function projectCombatTargetPolicy(value) {
  return {
    hpMode: value.hpMode,
    toughnessMode: value.toughnessMode,
    breakMode: value.breakMode,
    deathTruncation: value.deathTruncation,
  };
}

function roundValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(6)) : 0;
}

function ratioOrZero(value, maximum) {
  return maximum > 0 ? roundValue(Number(value) / Number(maximum)) : 0;
}

function clampNumber(value, minimum, maximum) {
  const number = Number(value);
  const fallback = Number.isFinite(number) ? number : minimum;
  return Math.min(maximum, Math.max(minimum, fallback));
}

function numberOrNull(value) {
  const number = Number(value);
  return value != null && value !== '' && Number.isFinite(number)
    ? number
    : null;
}

function positiveNumber(value, fallback) {
  const number = numberOrNull(value);
  return number != null && number > 0 ? number : fallback;
}

function positiveNumberOrNull(value) {
  const number = numberOrNull(value);
  return number != null && number > 0 ? number : null;
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function nonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}
