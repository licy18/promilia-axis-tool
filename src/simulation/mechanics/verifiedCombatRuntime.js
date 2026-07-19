import {
  getInstalledVerifiedCombatMechanicsPackage,
  resolveVerifiedCombatActionMechanics,
} from '../../data/verifiedCombatMechanicsPackage';
import { ACTION_TYPES } from '../../domain/projectSchema';
import { resolveControlledActorAt } from '../runtime/controlledActorTimeline';
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
  qMul,
  qToNumber,
} from './verifiedCombatFormulaRuntime';

export const VERIFIED_COMBAT_MECHANICS_PROFILE_ID =
  'azpr-three-value-verified-tc-20260718';
export const VERIFIED_COMBAT_RUNTIME_CONTRACT_NAME =
  'AzPrVerifiedCombatRuntime';

const FIXED_STEP_MS = 100;
const FRAME_RATE = 60;

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
  const actionResolutionById = new Map();
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
    const resolution = resolveVerifiedCombatActionMechanics(action);
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
      descriptors.push({
        kind: 'hit',
        timeMs:
          Number(action.startMs) +
          (Number(hit.trigger.startFrame) * 1000) / frameRate,
        action,
        resolution,
        hit,
      });
    }
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
  descriptors.sort(compareDescriptors);

  const state = createRuntimeState({ scenario, mechanicsPackage });
  const initialState = createFinalState(state, 0);
  const damageEvents = [];
  const resourceEvents = [];
  const kiboResourceEvents = [];
  const eventLog = [];
  const hitRecoveryAtByIdentity = new Map();
  const blockedActionIds = new Set();
  const executionBlocks = [];

  for (const descriptor of descriptors) {
    if (descriptor.timeMs > durationMs) continue;
    if (
      descriptor.action?.id &&
      blockedActionIds.has(descriptor.action.id) &&
      descriptor.kind !== 'action-cost'
    ) {
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
    if (descriptor.kind === 'hit') {
      const hitResult = applyHitDescriptor({
        descriptor,
        scenario,
        state,
      });
      if (!hitResult.ready) {
        eventLog.push({
          type: 'VERIFIED_COMBAT_HIT_UNRESOLVED',
          timeMs: descriptor.timeMs,
          actionId: descriptor.action.id,
          actorId: descriptor.action.actorId,
          payload: hitResult,
        });
        continue;
      }
      appendRuntimeEvent(damageEvents, hitResult.damageEvent, state);
      eventLog.push(hitResult.damageEvent);
      applyHitRecovery({
        descriptor,
        hitResult,
        state,
        hitRecoveryAtByIdentity,
        resourceEvents,
        kiboResourceEvents,
      });
    }
  }

  resourceEvents.sort(compareEvents);
  kiboResourceEvents.sort(compareEvents);
  damageEvents.sort(compareEvents);
  eventLog.push(...resourceEvents, ...kiboResourceEvents);
  eventLog.sort(compareEvents);
  const resolutions = [...actionResolutionById.values()];
  return {
    schemaVersion: 1,
    contractName: VERIFIED_COMBAT_RUNTIME_CONTRACT_NAME,
    sourceKind: 'azpr-verified-combat-runtime-from-generation-bindings',
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
    eventLog,
    executionBlocks,
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
      breakTriggerCount: damageEvents.filter(
        event => event.payload.breakState?.triggered
      ).length,
      shieldedHitCount: damageEvents.filter(
        event => event.payload.shieldState?.absorbed > 0
      ).length,
      resourceBlockedActionCount: executionBlocks.length,
      applied: true,
    },
    applied: true,
  };
}

function createRuntimeState({ scenario, mechanicsPackage }) {
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
      const profile = actorProfileById.get(Number(actor.characterId)) ?? null;
      const max = positiveNumber(
        profile?.effectiveMaxSp ?? profile?.maxSp ?? actor.stats?.maxSp,
        100
      );
      return [
        actor.id,
        {
          actor,
          profile,
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
    const profile = kiboProfileById.get(kiboId) ?? null;
    const slotId = group.slotId ?? `team-slot-${index + 1}`;
    const inherited = scenario?.initialRuntimeState?.kiboEnergyBySlot?.find(
      entry => entry.slotId === slotId && Number(entry.kiboId) === kiboId
    );
    const max = positiveNumber(
      profile?.effectiveMaxSp ?? profile?.maxSp,
      100
    );
    kiboEnergy.set(slotId, {
      slotId,
      actorId: actor?.id ?? group.actorId ?? null,
      kiboId,
      profile,
      current: clampNumber(
        inherited?.currentValue ?? 0,
        0,
        max
      ),
      max,
    });
  }
  const inheritedEnemy = scenario?.initialRuntimeState?.enemy ?? null;
  const enemyId = Number(scenario?.enemy?.enemyId ?? scenario?.enemy?.id);
  const enemyProfile = (mechanicsPackage.ownerProfiles?.enemy ?? []).find(
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
      scenario?.enemy?.stats?.initialToughness ??
        enemyProfile?.maxWeakness ??
        0
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
  const enemyToughness = clampNumber(
    inheritedEnemy?.toughness?.currentValue ?? configuredEnemyToughness,
    0,
    enemyMaxToughness
  );
  const inBreak = inheritedEnemy?.inBreak === true;
  const breakElapsedMs = nonNegativeNumber(inheritedEnemy?.breakElapsedMs);
  const recoveryDelayRemainingMs = numberOrNull(
    inheritedEnemy?.recoveryDelayRemainingMs
  );
  return {
    actorEnergy,
    kiboEnergy,
    kiboProfileById,
    slotIdByActorId,
    nextRuntimeSequenceIndex: 0,
    enemy: {
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
}

function applyWeaknessStateDescriptor({ descriptor, scenario, state }) {
  const enemy = state.enemy;
  const profile = enemy.profile;
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
    recovered = roundValue(
      Math.max(0, targetToughness - enemy.toughness)
    );
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
  const hitKey = `verified-${stateEventKind}-${timeToFrame(
    descriptor.timeMs
  )}`;
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
    const source = createActorSpSource(actorState.actor, actorState.profile);
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
    const source = createKiboSpSource(kiboState.profile);
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

function applyHitDescriptor({ descriptor, scenario, state }) {
  const { action, resolution, hit } = descriptor;
  const source = resolveHitSource({ action, resolution, state });
  const ratioBasisPoints = resolveHitRatio(hit, action);
  const enemy = state.enemy;
  const enemyProfile = enemy.profile;
  const targetDefense = numberOrNull(scenario?.enemy?.stats?.physicalDefense);
  const targetMagicDefense = numberOrNull(
    scenario?.enemy?.stats?.magicalDefense
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

  const randomBranch = resolveCriticalBranch(action, hit, source);
  const stateBefore = createEnemyStateSnapshot(enemy);
  const damageInput = {
    attack: source.attack,
    ratioBasisPoints,
    targetLevel: positiveNumber(scenario?.enemy?.level, 1),
    targetDefense:
      targetDefense * positiveNumber(scenario?.enemy?.defenseMultiplier, 1),
    targetMagicDefense:
      targetMagicDefense *
      positiveNumber(scenario?.enemy?.defenseMultiplier, 1),
    physicalPenetrationBasisPoints: normalizePenetration(
      hit.damage.physicalPenetrationBasisPoints
    ),
    magicPenetrationBasisPoints: normalizePenetration(
      hit.damage.magicPenetrationBasisPoints
    ),
    elementCalculationFactor: basisPoints(
      hit.damage.elementCalculationFactorBasisPoints,
      1
    ),
    attackerElementUp: source.elementDamageUp,
    targetElementDefense: resolveEnemyElementDefense(
      scenario.enemy,
      hit.damage.elementalType
    ),
    physicalRatio: basisPoints(hit.damage.physicalRatioBasisPoints),
    magicRatio: basisPoints(hit.damage.magicRatioBasisPoints),
    attackerPhysicalUp: 0,
    attackerMagicUp: 0,
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
    inWeakState: enemy.inBreak,
    breakDamageUp: basisPoints(
      enemyProfile.breakDamageUpBasisPoints
    ),
    outputType: hit.damage.damageType,
    outputElement: hit.damage.elementalType,
    currentHp: enemy.hp,
    minimumRemainingHp: 0,
    valueShields: enemy.valueShields,
    hitCountShields: enemy.hitCountShields,
  };
  const damageType = Number(hit.damage.damageType);
  const damageResult =
    damageType === 6
      ? calculateRealDamage(damageInput)
      : damageType === 10
        ? calculateStackOverLimitDamage(damageInput)
        : damageType === 8
          ? { mode: 'pure-weakness', value: 0, raw: '0', trace: [] }
          : calculateNormalDamage(damageInput);
  updateShieldState(enemy, damageResult, damageInput);
  const hpDamage = Math.min(enemy.hp, Math.max(0, Number(damageResult.value)));
  const toughnessBefore = enemy.toughness;
  const preShieldHpDamageRaw =
    damageResult.preShieldRaw ?? damageResult.raw;
  const weaknessTypeMultiplier = resolveWeaknessTypeMultiplier(
    enemyProfile,
    hit
  );
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
    inWeakState: enemy.inBreak,
    worldEventConflictPer: 1,
    typeMultiplier: weaknessTypeMultiplier,
    elementMultiplier: weaknessElementMultiplier,
    weaknessSkillDamageUp: 1,
    weakBreakDamageRateBasisPoints: hit.damage.weakBreakDamageRateBasisPoints,
    maximum: weaknessMaximum,
    minimum: weaknessMinimum,
  });
  const toughnessDamage = Math.min(
    enemy.toughness,
    Math.max(0, Number(weaknessResult.deducted ?? 0))
  );
  enemy.hp = roundValue(enemy.hp - hpDamage);
  enemy.toughness = roundValue(enemy.toughness - toughnessDamage);
  const breakTriggered =
    !enemy.inBreak && toughnessBefore > 0 && enemy.toughness <= 0;
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
  const hitKey = `verified-hit-${hit.hitIndex}-${hit.elementId}`;
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
        packageId: resolution.packageId,
        packageHash: resolution.packageHash,
        bindingIdentity: resolution.actionBinding.identity,
        enemyProfileSourceIdentity: enemyProfile.sourceIdentity,
        controlSkillId: resolution.actionBinding.controlSkillId,
        elementId: hit.elementId,
        pathId: hit.pathId,
        attack: source.attack,
        attackSource: source.sourceIdentity,
        rawDamage: hpDamage,
        toughnessDamage,
        hpLossPercent: ratioOrZero(hpDamage, enemy.maxHp),
        toughnessLossPercent: ratioOrZero(
          toughnessDamage,
          enemy.maxToughness
        ),
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
            weaknessSkillDamageUp: 1,
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
          label: hit.name || `命中 ${hit.hitIndex}`,
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
            enemyHp: roundValue(-hpDamage),
            enemyToughness: roundValue(-toughnessDamage),
          },
          after: stateAfter,
        },
        appliedToCalculators: true,
      },
    },
  };
}

function applyHitRecovery({
  descriptor,
  hitResult,
  state,
  hitRecoveryAtByIdentity,
  resourceEvents,
  kiboResourceEvents,
}) {
  const { action, hit, resolution } = descriptor;
  const recoverSp = Number(hit.energy.recoverSp) || 0;
  const petRecoverSp = Number(hit.energy.petRecoverSp) || 0;
  if (recoverSp <= 0 && petRecoverSp <= 0) return;
  const intervalMs = Math.max(0, Number(hit.energy.recoverIntervalMs) || 0);
  const intervalIdentity = `damage-element:${
    hit.pathId ?? hit.elementId ?? 'unresolved'
  }`;
  const lastTimeMs = hitRecoveryAtByIdentity.get(intervalIdentity);
  if (lastTimeMs != null && descriptor.timeMs - lastTimeMs < intervalMs) return;
  hitRecoveryAtByIdentity.set(intervalIdentity, descriptor.timeMs);

  const sourceActorId = action.actorId;
  if (recoverSp > 0) {
    const actorRecipients = [...state.actorEnergy.values()].sort(
      (left, right) =>
        Number(right.actor.id === sourceActorId) -
        Number(left.actor.id === sourceActorId)
    );
    for (const actorState of actorRecipients) {
      const source = createActorSpSource(actorState.actor, actorState.profile);
      const formula = calculateHitSp({
        recoverSp,
        pet: false,
        spGetUp: source.spGetUp,
        spGetUpAttack: source.spGetUpAttack,
        maximumSp: Number.MAX_SAFE_INTEGER,
        recoverInterval: intervalMs,
      });
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
            sourceIdentity: source.sourceIdentity,
            recoverIntervalIdentity: intervalIdentity,
            share,
          },
        }),
        state
      );
    }
  }

  if (petRecoverSp <= 0) return;
  for (const kiboState of state.kiboEnergy.values()) {
    const source = createKiboSpSource(kiboState.profile);
    if (!source.applied) continue;
    const formula = calculateHitSp({
      petRecoverSp,
      pet: true,
      spGetUp: source.spGetUp,
      spGetUpAttack: source.spGetUpAttack,
      maximumSp: Number.MAX_SAFE_INTEGER,
      recoverInterval: intervalMs,
    });
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
        },
      }),
      state
    );
  }
}

function resolveHitSource({ action, resolution, state }) {
  if (resolution.actionBinding.ownerKind === 'kibo') {
    const kiboState = findKiboStateByAction(state, action);
    const profile = kiboState?.profile;
    const attack = numberOrNull(profile?.attack);
    return {
      ready: attack != null,
      status:
        attack == null
          ? 'verified-kibo-base-attack-missing'
          : 'verified-kibo-base-profile-ready',
      attack,
      criticalRate: basisPoints(profile?.criticalRateBasisPoints),
      criticalDamage: basisPoints(profile?.criticalDamageBasisPoints, 1),
      damageUp: basisPoints(profile?.damageUpBasisPoints),
      elementDamageUp: 0,
      sourceIdentity: profile?.sourceIdentity ?? null,
    };
  }
  const actor = action.actor;
  const attack = numberOrNull(actor?.stats?.attack);
  return {
    ready: attack != null,
    status:
      attack == null
        ? 'verified-actor-panel-attack-missing'
        : 'verified-actor-panel-profile-ready',
    attack,
    criticalRate: numberOrNull(actor?.stats?.critRate) ?? 0,
    criticalDamage: numberOrNull(actor?.stats?.critDamage) ?? 1,
    damageUp: numberOrNull(actor?.stats?.damageAmplification) ?? 0,
    elementDamageUp: resolveActorElementDamageUp(
      actor,
      resolution.hits?.[0]?.damage?.elementalType
    ),
    sourceIdentity: actor?.stats?.source ?? 'compiled-actor-stats',
  };
}

function resolveCriticalBranch(action, hit, source) {
  const persisted =
    action.mechanicsRandomBranches?.[String(hit.elementId)] ??
    action.mechanicsRandomBranch ??
    null;
  const randomRoll = numberOrNull(persisted?.criticalRoll);
  const critical =
    randomRoll == null
      ? false
      : isCriticalHit({
          randomRoll,
          criticalRate: source.criticalRate,
          targetCriticalRateDefense: 0,
        });
  return {
    policy:
      randomRoll == null
        ? 'deterministic-non-critical-baseline'
        : 'persisted-critical-roll',
    branchIdentity:
      persisted?.identity ??
      `non-critical|${action.id}|${hit.hitIndex}|${hit.elementId}`,
    criticalRoll: randomRoll,
    critical,
    replayable: true,
  };
}

function createActorSpSource(actor, profile) {
  return {
    sprSec: basisPoints(
      profile?.sprSecBasisPoints ?? getAttribute(actor, 'SPR_SEC')
    ),
    sprSecBack: basisPoints(
      profile?.sprSecBackBasisPoints ?? getAttribute(actor, 'SPR_SEC_BACK')
    ),
    spGetUp: basisPoints(
      profile?.spGetUpBasisPoints ?? getAttribute(actor, 'SPGETUP')
    ),
    spRetAuto: basisPoints(
      profile?.spRetAutoBasisPoints ??
        getAttribute(actor, 'SPRET_AUTO') ??
        getAttribute(actor, 'SPGETUP_AUTO')
    ),
    spGetUpAttack: basisPoints(
      profile?.spGetUpAttackBasisPoints ?? getAttribute(actor, 'SPGETUP_ATK')
    ),
    sourceIdentity: profile?.sourceIdentity ?? null,
  };
}

function createKiboSpSource(profile) {
  return {
    applied: profile?.applied === true,
    sprSec: basisPoints(profile?.sprSecBasisPoints),
    sprSecBack: basisPoints(profile?.sprSecBackBasisPoints),
    spGetUp: basisPoints(profile?.spGetUpBasisPoints),
    spRetAuto: basisPoints(
      profile?.spRetAutoBasisPoints ?? profile?.spGetUpAutoBasisPoints
    ),
    spGetUpAttack: basisPoints(profile?.spGetUpAttackBasisPoints),
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

function resolveEnemyElementDefense(enemy, elementalType) {
  const row = (enemy?.elementDefenses ?? []).find(
    item => Number(item.elementId) === Number(elementalType)
  );
  return basisPoints(row?.effectiveValue);
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

function resolveWeaknessTypeMultiplier(enemyProfile, hit) {
  const physical = Number(hit.damage.physicalRatioBasisPoints) > 0;
  return basisPoints(
    physical
      ? enemyProfile?.typeMultipliersBasisPoints?.physical
      : enemyProfile?.typeMultipliersBasisPoints?.magic,
    1
  );
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
  return numberOrNull(hit.formula?.ratiosByLevel?.[level]);
}

function findKiboStateByAction(state, action) {
  const slotId = state.slotIdByActorId.get(String(action.actorId));
  const entry = slotId ? state.kiboEnergy.get(slotId) : null;
  const expectedKiboId = Number(
    action.kiboId ?? action.actor?.loadout?.kiboId
  );
  if (!entry || Number(entry.kiboId) !== expectedKiboId) return null;
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
    actorId: descriptor.action.actorId ?? null,
    ownerKind: resolution.actionBinding.ownerKind,
    slotId: resourceState?.slotId ?? null,
    kiboId: resourceState?.kiboId ?? null,
    timeMs: roundValue(descriptor.timeMs),
    requiredValue:
      requiredValue == null ? null : roundValue(requiredValue),
    currentValue:
      resourceState?.current == null
        ? null
        : roundValue(resourceState.current),
    maxValue:
      resourceState?.max == null ? null : roundValue(resourceState.max),
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
  event.runtimeSequenceIndex = runtimeSequenceIndex;
  if (event.payload) {
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
    hp: roundValue(enemy.hp),
    toughness: roundValue(enemy.toughness),
    inBreak: enemy.inBreak === true,
    breakPhase:
      enemy.breakPhase ?? (enemy.inBreak ? 'linear_recovery' : 'normal'),
    breakStartedAtMs: numberOrNull(enemy.breakStartedAtMs),
    normalRecoveryEligibleAtMs: numberOrNull(
      enemy.normalRecoveryEligibleAtMs
    ),
    lastToughnessSourceActionId:
      enemy.lastToughnessSourceActionId ?? null,
    lastToughnessSourceActorId: enemy.lastToughnessSourceActorId ?? null,
    lastToughnessBindingIdentity:
      enemy.lastToughnessBindingIdentity ?? null,
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
  return {
    enemy: {
      enemyId: state.enemy.enemyId,
      hp: roundValue(state.enemy.hp),
      maxHp: roundValue(state.enemy.maxHp),
      toughness: roundValue(state.enemy.toughness),
      maxToughness: roundValue(state.enemy.maxToughness),
      inBreak: state.enemy.inBreak,
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
      toughnessStateEventCount: 0,
      normalRecoveryEventCount: 0,
      breakRecoveryEventCount: 0,
      breakExitCount: 0,
      resourceEventCount: 0,
      kiboResourceEventCount: 0,
      breakTriggerCount: 0,
      shieldedHitCount: 0,
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

function compareDescriptors(left, right) {
  const priority = {
    'action-cost': 0,
    'weakness-state-tick': 1,
    hit: 2,
    'manual-resource': 3,
    'auto-sp-tick': 4,
  };
  return (
    left.timeMs - right.timeMs ||
    (priority[left.kind] ?? 9) - (priority[right.kind] ?? 9) ||
    String(left.action?.id ?? '').localeCompare(
      String(right.action?.id ?? '')
    ) ||
    Number(left.hit?.hitIndex ?? 0) - Number(right.hit?.hitIndex ?? 0)
  );
}

function compareEvents(left, right) {
  return (
    Number(left.timeMs) - Number(right.timeMs) ||
    Number(left.runtimeSequenceIndex ?? Number.MAX_SAFE_INTEGER) -
      Number(right.runtimeSequenceIndex ?? Number.MAX_SAFE_INTEGER) ||
    String(left.actionId ?? '').localeCompare(String(right.actionId ?? '')) ||
    String(left.hitKey ?? '').localeCompare(String(right.hitKey ?? ''))
  );
}

function timeToFrame(timeMs) {
  return Math.max(0, Math.round((Number(timeMs) * FRAME_RATE) / 1000));
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
