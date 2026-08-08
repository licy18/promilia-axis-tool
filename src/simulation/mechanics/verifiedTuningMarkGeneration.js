import {
  getInstalledVerifiedCombatMechanicsPackage,
  resolveVerifiedCombatActionMechanics,
} from '../../data/verifiedCombatMechanicsPackage';
import {
  ACTION_TYPES,
  EFFECT_OPERATIONS,
  EFFECT_STACK_MODES,
  EFFECT_TARGET_KINDS,
} from '../../domain/projectSchema';
import { resolveActionHitWillHit } from '../../domain/actionHitOverrides';
import {
  compareSourceSequencePaths,
  getActionSourceSequencePath,
} from '../../domain/actionSourceSequence';
import { createVerifiedEffectSourceSequencePath } from '../../domain/verifiedEffectSourceSequence';
import { isActionFrameWithinContextualOccupancy } from './actionEffectiveTimeline';

export const VERIFIED_TUNING_MARK_GENERATION_CONTRACT_NAME =
  'AzPrVerifiedTuningMarkGeneration';

const FRAME_RATE = 60;
const TUNING_EFFECT_SOURCE_STATUS = 'verified-tuning-mark-generated';
export const VERIFIED_BATTLE_PROPERTY_TAG_OVERDRIVE = 307;

export function createVerifiedTuningMarkGeneration({
  scenario = {},
  actionExecutionPlan = null,
  effectGeneration = null,
  actionVariantRuntime = null,
} = {}) {
  const mechanicsPackage = getInstalledVerifiedCombatMechanicsPackage();
  const catalog = mechanicsPackage?.tuningMechanicsCatalog;
  if (!catalog?.applied) {
    return createUnavailableGeneration(
      'verified-tuning-mechanics-catalog-not-installed'
    );
  }

  const durationMs = nonNegativeNumber(scenario?.time?.durationMs);
  const executionByActionId = new Map(
    (actionExecutionPlan?.actions ?? []).map(entry => [entry.actionId, entry])
  );
  const profileByMarkId = new Map(
    catalog.profiles.map(profile => [Number(profile.markId), profile])
  );
  const stateByMarkId = new Map(
    catalog.profiles.map(profile => [
      Number(profile.markId),
      {
        profile,
        layers: [],
        decayDueAtMs: null,
        decayRevision: 0,
        heldReadyAtMs: 0,
        periodicDueAtMs: null,
      },
    ])
  );
  const queue = [];
  const events = [];
  const getElementEvents = [];
  const effectCommands = [];
  const combatEvents = [];
  const acquisitionGateResults = [];
  const conditionalDamageResults = [];
  const unresolved = [];
  let sequence = 0;

  const enqueue = descriptor => {
    queue.push({ ...descriptor, queueSequence: sequence++ });
    queue.sort(compareGenerationDescriptors);
  };

  installInheritedState({
    scenario,
    stateByMarkId,
    enqueue,
    effectCommands,
    mechanicsPackage,
  });

  const thresholdPassiveProfiles = (
    mechanicsPackage.specialResourceCatalog?.passiveEffects ?? []
  ).filter(
    profile =>
      profile.applied === true &&
      profile.runtimeGenerationMode === 'tuning-mark-threshold-property-runtime'
  );
  const emitThresholdPassiveCommands = ({
    profile,
    before,
    after,
    timeMs,
    descriptor = null,
  }) => {
    for (const passive of thresholdPassiveProfiles) {
      if (Number(passive.markId) !== Number(profile.markId)) continue;
      const wasActive = Number(before) >= Number(passive.minimumStacks);
      const isActive = Number(after) >= Number(passive.minimumStacks);
      if (wasActive === isActive) continue;
      const actor = (scenario.actors ?? []).find(
        candidate => Number(candidate.characterId) === Number(passive.ownerId)
      );
      if (!actor) continue;
      effectCommands.push(
        createTuningMarkThresholdPassiveCommand({
          mechanicsPackage,
          passive,
          actor,
          timeMs,
          descriptor,
          operation: isActive
            ? EFFECT_OPERATIONS.APPLY
            : EFFECT_OPERATIONS.REMOVE,
        })
      );
    }
  };
  for (const state of stateByMarkId.values()) {
    emitThresholdPassiveCommands({
      profile: state.profile,
      before: 0,
      after: state.layers.length,
      timeMs: 0,
    });
  }

  const tuningMarkConditionalDamageGroups = (
    mechanicsPackage.actionVariantGraph?.tuningMarkConditionalDamageGroups ?? []
  ).filter(group => group.applied === true);

  for (const transaction of actionVariantRuntime?.tuningMarkTransactions ??
    []) {
    if (
      transaction.applied !== true ||
      transaction.kind !== 'threshold-grant'
    ) {
      continue;
    }
    const profile = profileByMarkId.get(Number(transaction.markId));
    const action =
      transaction.action ??
      (scenario.actions ?? []).find(
        candidate => candidate.id === transaction.actionId
      ) ??
      null;
    if (!profile || !action) continue;
    enqueue({
      kind: 'acquire',
      timeMs: Number(transaction.timeMs),
      action,
      resolution: null,
      effect: {
        effectIdentity: transaction.transactionIdentity,
        sourceIdentity: transaction.sourceIdentity,
        tuningMark: {
          applied: true,
          markId: Number(transaction.markId),
          profileKey: transaction.profileKey,
          stackDelta: Number(transaction.stackDelta),
        },
      },
      profile,
      acquisitionSourceKind: 'verified-threshold-grant',
    });
  }

  for (const action of scenario.actions ?? []) {
    if (executionByActionId.get(action.id)?.execute === false) continue;
    if (![ACTION_TYPES.SKILL, ACTION_TYPES.KIBO_EVENT].includes(action.type)) {
      continue;
    }
    const resolution =
      actionVariantRuntime?.actionResolutionById?.get(action.id) ??
      effectGeneration?.actionResolutionById?.get(action.id) ??
      resolveVerifiedCombatActionMechanics(action, {
        combatScenario: scenario.combatScenario,
      });
    if (!resolution?.ready) continue;
    const tuningEffects = dedupeTuningRuntimeEffects(resolution.effects ?? []);
    const enqueuedConsumeGroups = new Set();
    for (const effect of tuningEffects) {
      if (effect.classification !== 'applied') continue;
      if (
        !isActionFrameWithinContextualOccupancy(
          action,
          effect.trigger?.startFrame,
          resolution.controlBinding?.frameRate ?? FRAME_RATE
        )
      ) {
        continue;
      }
      const timeMs = resolveEffectTimeMs(action, effect, resolution);
      if (timeMs == null) continue;
      if (effect.tuningMark?.applied) {
        enqueue({
          kind: 'acquire',
          timeMs,
          action,
          resolution,
          effect,
          profile: profileByMarkId.get(Number(effect.tuningMark.markId)),
          acquisitionSourceKind: 'verified-action-effect',
        });
      }
      if (effect.tuningOverlimit) {
        const contract = effect.tuningOverlimit;
        if (
          contract.runtimeSelectionMode ===
            'priority-first-sufficient-candidate' &&
          contract.judgmentGroupIdentity
        ) {
          const groupKey = `${contract.judgmentGroupIdentity}|${timeMs}`;
          if (enqueuedConsumeGroups.has(groupKey)) continue;
          enqueuedConsumeGroups.add(groupKey);
          enqueue({
            kind: 'consume',
            timeMs,
            action,
            resolution,
            effect,
            profile: null,
            priorityCandidates: createPriorityConsumeCandidates({
              effects: tuningEffects,
              contract,
              profileByMarkId,
              triggerStartFrame: effect.trigger?.startFrame,
              mapIndex: effect.mapIndex,
            }),
          });
          continue;
        }
        enqueue({
          kind: 'consume',
          timeMs,
          action,
          resolution,
          effect,
          profile: profileByMarkId.get(Number(effect.tuningOverlimit.markId)),
        });
      }
      if (effect.directSpPresence?.applied) {
        enqueue({
          kind: 'direct-sp-presence',
          timeMs,
          action,
          resolution,
          effect,
          profile: profileByMarkId.get(Number(effect.directSpPresence.markId)),
        });
      }
    }
    const controlSkillId = Number(resolution.actionBinding?.controlSkillId);
    const subSkillIndex = Number(
      resolution.actionBinding?.selectedSubSkillIndex ??
        resolution.controlBinding?.selectedSubSkillIndex
    );
    for (const group of tuningMarkConditionalDamageGroups) {
      if (
        Number(group.controlSkillId) !== controlSkillId ||
        Number(group.subSkillIndex) !== subSkillIndex
      ) {
        continue;
      }
      let hitIndex = 0;
      for (const triggerFrame of group.triggerFrames ?? []) {
        if (
          !isActionFrameWithinContextualOccupancy(
            action,
            triggerFrame,
            group.frameRate ?? FRAME_RATE
          )
        ) {
          continue;
        }
        for (const hitDelayMs of group.hitDelaysMs ?? [0]) {
          hitIndex += 1;
          enqueue({
            kind: 'conditional-damage',
            timeMs: roundValue(
              Number(action.startMs) +
                (Number(triggerFrame) * 1000) /
                  (Number(group.frameRate) || FRAME_RATE) +
                Number(hitDelayMs)
            ),
            action,
            resolution,
            group,
            profile: profileByMarkId.get(Number(group.markId)),
            hitIndex,
            triggerFrame,
            hitDelayMs,
            sourceKind: 'owner-action',
          });
        }
      }
    }
    for (const hit of resolution.hits ?? []) {
      const frameRate = positiveNumber(
        resolution.controlBinding?.frameRate,
        FRAME_RATE
      );
      if (
        !isActionFrameWithinContextualOccupancy(
          action,
          hit.trigger?.startFrame,
          frameRate
        )
      ) {
        continue;
      }
      enqueue({
        kind: 'hit',
        timeMs: roundValue(
          Number(action.startMs) +
            (Number(hit.trigger?.startFrame) * 1000) / frameRate
        ),
        action,
        resolution,
        hit,
      });
    }
  }

  for (const transaction of actionVariantRuntime?.companionAttackTransactions ??
    []) {
    if (transaction.applied !== true) continue;
    const action =
      transaction.action ??
      (scenario.actions ?? []).find(
        candidate => candidate.id === transaction.actionId
      );
    const resolution =
      transaction.resolution ??
      actionVariantRuntime?.actionResolutionById?.get(action?.id) ??
      effectGeneration?.actionResolutionById?.get(action?.id) ??
      null;
    const group = transaction.conditionalDamageGroup;
    const profile = profileByMarkId.get(Number(group?.markId));
    if (!action || !resolution?.ready || !group || !profile) continue;
    enqueue({
      kind: 'conditional-damage',
      timeMs: Number(transaction.timeMs),
      action,
      resolution: createCompanionDamageResolution({
        resolution,
        transaction,
      }),
      group,
      profile,
      hitIndex: Number(transaction.hitIndex),
      triggerFrame: Number(transaction.triggerFrame),
      hitDelayMs: Number(transaction.hitDelayMs),
      sourceKind: 'companion',
      companionTransaction: transaction,
    });
  }

  while (queue.length > 0) {
    const descriptor = queue.shift();
    if (descriptor.timeMs > durationMs) continue;
    if (descriptor.kind === 'expire') {
      applyLayerExpiry({
        descriptor,
        stateByMarkId,
        events,
        effectCommands,
        mechanicsPackage,
        scenario,
        enqueue,
        emitThresholdPassiveCommands,
      });
    } else if (descriptor.kind === 'acquire') {
      applyLayerAcquisition({
        descriptor,
        stateByMarkId,
        events,
        getElementEvents,
        effectCommands,
        mechanicsPackage,
        scenario,
        enqueue,
        acquisitionGateResults,
        conditionalDamageGroups: tuningMarkConditionalDamageGroups,
        emitThresholdPassiveCommands,
      });
    } else if (descriptor.kind === 'consume') {
      applyMarkConsumption({
        descriptor,
        stateByMarkId,
        events,
        effectCommands,
        combatEvents,
        unresolved,
        mechanicsPackage,
        scenario,
        enqueue,
        emitThresholdPassiveCommands,
      });
    } else if (descriptor.kind === 'direct-sp-presence') {
      applyDirectSpPresence({
        descriptor,
        stateByMarkId,
        combatEvents,
        scenario,
      });
    } else if (descriptor.kind === 'periodic') {
      applyPeriodicEffect({
        descriptor,
        stateByMarkId,
        combatEvents,
        enqueue,
        durationMs,
      });
    } else if (descriptor.kind === 'hit') {
      applyHeldMarkTriggers({
        descriptor,
        stateByMarkId,
        events,
        combatEvents,
        effectCommands,
        mechanicsPackage,
        scenario,
      });
    } else if (descriptor.kind === 'conditional-damage') {
      applyTuningMarkConditionalDamage({
        descriptor,
        stateByMarkId,
        combatEvents,
        conditionalDamageResults,
        scenario,
      });
    } else if (descriptor.kind === 'combat') {
      combatEvents.push(descriptor.combatEvent);
    }
  }

  for (const [runtimeSequenceIndex, event] of events.entries()) {
    event.runtimeSequenceIndex = runtimeSequenceIndex;
  }
  events.sort(compareGeneratedEvents);
  for (const [runtimeSequenceIndex, event] of getElementEvents.entries()) {
    event.runtimeSequenceIndex = runtimeSequenceIndex;
  }
  combatEvents.sort(compareGeneratedEvents);
  effectCommands.sort(compareGeneratedEvents);
  return {
    schemaVersion: 2,
    contractName: VERIFIED_TUNING_MARK_GENERATION_CONTRACT_NAME,
    sourceKind: 'azpr-verified-tuning-mark-generation',
    status: 'verified-tuning-mark-generation-ready',
    packageId: mechanicsPackage.packageId,
    packageHash: mechanicsPackage.packageHash,
    events,
    getElementEvents,
    effectCommands,
    combatEvents,
    acquisitionGateResults,
    conditionalDamageResults,
    unresolved,
    initialState: createInitialTuningState(scenario, catalog),
    finalState: createPublishedTuningState(stateByMarkId, durationMs),
    summary: {
      profileCount: catalog.profiles.length,
      markEventCount: events.length,
      acquireEventCount: events.filter(event => event.kind === 'acquire')
        .length,
      refreshAtMaximumEventCount: events.filter(
        event => event.kind === 'acquire' && event.delta === 0
      ).length,
      getElementEventCount: getElementEvents.length,
      getElementTransactionCount: new Set(
        getElementEvents.map(event => event.transactionIdentity)
      ).size,
      zeroDeltaGetElementTransactionCount: new Set(
        getElementEvents
          .filter(event => event.eventContext?.delta === 0)
          .map(event => event.transactionIdentity)
      ).size,
      consumeEventCount: events.filter(event => event.kind === 'consume')
        .length,
      expireEventCount: events.filter(event => event.kind === 'expire').length,
      effectCommandCount: effectCommands.length,
      combatEventCount: combatEvents.length,
      acquisitionGateResultCount: acquisitionGateResults.length,
      conditionalDamageResultCount: conditionalDamageResults.length,
      unresolvedCount: unresolved.length,
      finalLayerCount: [...stateByMarkId.values()].reduce(
        (sum, state) => sum + state.layers.length,
        0
      ),
      applied: true,
    },
    applied: true,
  };
}

function dedupeTuningRuntimeEffects(effects) {
  return [
    ...new Map(
      effects.map(effect => {
        const tuning = effect.tuningMark ?? effect.tuningOverlimit;
        const occurrenceIdentity = effect.tuningMark?.occurrenceIdentity ?? null;
        return [
          tuning
            ? [
                effect.tuningMark ? 'acquire' : 'consume',
                tuning.markId,
                tuning.packetElementId ?? tuning.stackElementId ?? '',
                effect.mapIndex,
                effect.trigger?.startFrame ?? '',
                occurrenceIdentity ?? '',
              ].join('|')
            : effect.effectIdentity,
          effect,
        ];
      })
    ).values(),
  ];
}

function createPriorityConsumeCandidates({
  effects,
  contract,
  profileByMarkId,
  triggerStartFrame,
  mapIndex,
}) {
  return (contract.judgmentCandidates ?? []).map(candidate => {
    const effect = effects.find(
      item =>
        item.classification === 'applied' &&
        item.tuningOverlimit?.judgmentGroupIdentity ===
          contract.judgmentGroupIdentity &&
        Number(item.trigger?.startFrame) === Number(triggerStartFrame) &&
        Number(item.mapIndex) === Number(mapIndex) &&
        Number(item.tuningOverlimit?.markId) === Number(candidate.markId) &&
        Number(item.tuningOverlimit?.packetElementId) ===
          Number(candidate.packetElementId)
    );
    return {
      ...candidate,
      effect: effect ?? null,
      profile: profileByMarkId.get(Number(candidate.markId)) ?? null,
      minimumStacks: positiveInteger(
        effect?.tuningOverlimit?.minimumStacks,
        positiveInteger(contract.minimumStacks, 1)
      ),
    };
  });
}

function installInheritedState({
  scenario,
  stateByMarkId,
  enqueue,
  effectCommands,
  mechanicsPackage,
}) {
  for (const inherited of scenario?.initialRuntimeState?.tuningMarks ?? []) {
    const state = stateByMarkId.get(Number(inherited.markId));
    if (!state) continue;
    const decayRemainingMs = resolveInheritedDecayRemainingMs(inherited);
    if (decayRemainingMs == null) continue;
    state.heldReadyAtMs = nonNegativeNumber(inherited.heldReadyRemainingMs);
    for (const [index, source] of resolveInheritedLayerSources(
      inherited
    ).entries()) {
      if (state.layers.length >= state.profile.maxStacks) break;
      const layer = {
        id: `inherited|${state.profile.markId}|${index}`,
        acquiredAtMs: 0,
        acquisitionSequence: index,
        sourceActionId: source.sourceActionId ?? null,
        sourceActorId: source.sourceActorId ?? null,
        sourceIdentity: source.sourceIdentity ?? state.profile.sourceIdentity,
      };
      state.layers.push(layer);
    }
    if (state.layers.length > 0) {
      scheduleSharedDecay(state, decayRemainingMs, enqueue);
      effectCommands.push(
        ...createPersistentModifierCommands({
          profile: state.profile,
          layerCount: state.layers.length,
          timeMs: 0,
          scenario,
          mechanicsPackage,
          source: {
            actionId: state.layers[0]?.sourceActionId,
            actorId: state.layers[0]?.sourceActorId,
            actionName: '继承调谐印记',
            effectIdentity: `inherited-tuning-mark:${state.profile.markId}`,
            actionBindingIdentity: `inherited-tuning-mark:${state.profile.markId}`,
            sourceIdentity: state.profile.sourceIdentity,
          },
        })
      );
      if (state.profile.key === 'wood') {
        schedulePeriodic(state, 5_000, enqueue);
      }
    }
  }
}

function applyLayerAcquisition({
  descriptor,
  stateByMarkId,
  events,
  getElementEvents,
  effectCommands,
  mechanicsPackage,
  scenario,
  enqueue,
  acquisitionGateResults,
  conditionalDamageGroups,
  emitThresholdPassiveCommands,
}) {
  const state = stateByMarkId.get(Number(descriptor.profile?.markId));
  if (!state) return;
  const gateResult = resolveTuningAcquisitionHitGate({
    descriptor,
    conditionalDamageGroups,
    scenario,
  });
  if (descriptor.effect?.hitGate) {
    acquisitionGateResults.push(gateResult);
  }
  if (!gateResult.passed) return;
  const before = state.layers.length;
  const requestedLayerCount = positiveInteger(
    descriptor.effect?.tuningMark?.stackDelta,
    1
  );
  const acquiredLayerCount = Math.min(
    requestedLayerCount,
    Math.max(0, state.profile.maxStacks - before)
  );
  const layers = [];
  for (let index = 0; index < acquiredLayerCount; index += 1) {
    const layer = {
      id: `${descriptor.effect.effectIdentity}|layer|${descriptor.queueSequence}|${index}`,
      acquiredAtMs: descriptor.timeMs,
      acquisitionSequence: descriptor.queueSequence + index / 1000,
      sourceActionId: descriptor.action.id,
      sourceActorId: descriptor.action.actorId,
      sourceIdentity: descriptor.effect.sourceIdentity,
    };
    layers.push(layer);
    state.layers.push(layer);
  }
  sortLayers(state.layers);
  scheduleSharedDecay(
    state,
    descriptor.timeMs + state.profile.layerDurationMs,
    enqueue
  );
  if (state.profile.key === 'wood' && before === 0) {
    schedulePeriodic(state, descriptor.timeMs + 5_000, enqueue);
  }
  const after = state.layers.length;
  const source = createDescriptorSource(descriptor);
  const transactionIdentity = [
    'tuning-get-element',
    state.profile.markId,
    descriptor.timeMs,
    descriptor.queueSequence,
  ].join('|');
  const outcome = after > before ? 'layers-added' : 'refresh-at-cap';
  getElementEvents.push(
    createGetElementEvent({
      phase: 'before-mutation',
      eventId: 9,
      descriptor,
      state,
      before,
      after,
      requestedLayerCount,
      acquiredLayerCount,
      transactionIdentity,
      outcome,
    })
  );
  events.push(
    createMarkEvent({
      kind: 'acquire',
      descriptor,
      state,
      before,
      after,
      delta: after - before,
      layerIds: layers.map(layer => layer.id),
    })
  );
  getElementEvents.push(
    createGetElementEvent({
      phase: 'after-mutation',
      eventId: 10,
      descriptor,
      state,
      before,
      after,
      requestedLayerCount,
      acquiredLayerCount,
      transactionIdentity,
      outcome,
    })
  );
  if (after !== before) {
    effectCommands.push(
      ...createPersistentModifierCommands({
        profile: state.profile,
        layerCount: after,
        timeMs: descriptor.timeMs,
        scenario,
        mechanicsPackage,
        source,
      })
    );
  }
  emitThresholdPassiveCommands({
    profile: state.profile,
    before,
    after,
    timeMs: descriptor.timeMs,
    descriptor,
  });
}

function resolveTuningAcquisitionHitGate({
  descriptor,
  conditionalDamageGroups,
  scenario,
}) {
  const gate = descriptor.effect?.hitGate;
  if (!gate) {
    return {
      actionId: descriptor.action?.id ?? null,
      effectIdentity: descriptor.effect?.effectIdentity ?? null,
      timeMs: descriptor.timeMs,
      gate: null,
      candidateCount: 1,
      landedCount: 1,
      passed: true,
    };
  }
  const defaultWillHit =
    (scenario?.combatScenario?.projectile?.defaultWillHit ??
      scenario?.projectile?.defaultWillHit) !== false;
  let hitIdentities = [];
  if (gate.kind === 'conditional-damage-group-hit') {
    const group = (conditionalDamageGroups ?? []).find(
      candidate => candidate.groupIdentity === gate.groupIdentity
    );
    if (group) {
      hitIdentities = [
        createConditionalDamageHitIdentity({
          group,
          hitIndex: gate.hitIndex,
        }),
      ];
    }
  } else if (gate.kind === 'landed-action-hit') {
    hitIdentities = (descriptor.resolution?.hits ?? [])
      .filter(
        hit =>
          Number(hit.elementId) === Number(gate.elementId) &&
          Number(hit.trigger?.startFrame) === Number(gate.triggerFrame) &&
          (!gate.behaviorPathId ||
            hit.trigger?.behaviorPathId === gate.behaviorPathId)
      )
      .slice(0, Number(gate.maximumMatches) || 1)
      .map(resolveTuningSourceHitIdentityFromHit);
  }
  const landedCount = hitIdentities.filter(identity =>
    resolveActionHitWillHit(descriptor.action, identity, defaultWillHit)
  ).length;
  return {
    actionId: descriptor.action?.id ?? null,
    effectIdentity: descriptor.effect?.effectIdentity ?? null,
    timeMs: descriptor.timeMs,
    gate,
    hitIdentities,
    candidateCount: hitIdentities.length,
    landedCount,
    passed: landedCount > 0,
    sourceIdentity: descriptor.effect?.sourceIdentity ?? null,
  };
}

function applyTuningMarkConditionalDamage({
  descriptor,
  stateByMarkId,
  combatEvents,
  conditionalDamageResults,
  scenario,
}) {
  const state = stateByMarkId.get(Number(descriptor.profile?.markId));
  if (!state) return;
  const group = descriptor.group;
  const markCountAtJudgment = state.layers.length;
  const enhanced = markCountAtJudgment >= Number(group.minimumStacks);
  const template = enhanced ? group.enhancedTemplate : group.baseTemplate;
  const sourceHitIdentity = createConditionalDamageHitIdentity({
    group,
    hitIndex: descriptor.hitIndex,
    companionTransaction: descriptor.companionTransaction,
  });
  const defaultWillHit =
    (scenario?.combatScenario?.projectile?.defaultWillHit ??
      scenario?.projectile?.defaultWillHit) !== false;
  const landed = resolveActionHitWillHit(
    descriptor.action,
    sourceHitIdentity,
    defaultWillHit
  );
  const eventIdentity = [
    'conditional-damage',
    group.groupIdentity,
    descriptor.action?.id,
    descriptor.hitIndex,
    descriptor.timeMs,
    descriptor.companionTransaction?.transactionIdentity ?? '',
  ].join('|');
  const sourceSequencePath = createTuningSourceSequencePath({
    descriptor,
    localKind: 'conditional-damage',
    localIdentity: descriptor.hitIndex,
  });
  const sourceHit = createConditionalDamageRuntimeHit({
    descriptor,
    template,
    sourceHitIdentity,
  });
  const result = {
    groupIdentity: group.groupIdentity,
    actionId: descriptor.action?.id ?? null,
    actorId: descriptor.action?.actorId ?? null,
    timeMs: descriptor.timeMs,
    hitIndex: descriptor.hitIndex,
    sourceKind: descriptor.sourceKind,
    sourceHitIdentity,
    markId: state.profile.markId,
    markCountAtJudgment,
    minimumStacks: group.minimumStacks,
    selectedBranch: enhanced ? 'enhanced' : 'base',
    selectedElementId: template.elementConfigId,
    landed,
    companionUnitId: descriptor.companionTransaction?.companionUnitId ?? null,
    ownership: descriptor.companionTransaction?.ownership ?? null,
    sourceIdentity: group.sourceIdentity,
    status: landed
      ? 'verified-tuning-mark-conditional-damage-landed'
      : 'verified-tuning-mark-conditional-damage-missed',
    applied: landed,
  };
  conditionalDamageResults.push(result);
  combatEvents.push({
    schemaVersion: 1,
    sourceKind: 'azpr-verified-tuning-conditional-damage-event',
    status: 'verified-tuning-conditional-damage-ready',
    kind: 'conditional-damage',
    eventIdentity,
    timeMs: roundValue(descriptor.timeMs),
    absoluteFrame: Math.round((descriptor.timeMs * FRAME_RATE) / 1000),
    action: descriptor.action,
    actionId: descriptor.action?.id ?? null,
    actorId: descriptor.action?.actorId ?? null,
    resolution: descriptor.resolution,
    sourceHit,
    profile: state.profile,
    markCount: 1,
    template,
    eventContext: {
      eventIdentity,
      eventKind: 'conditional-damage',
      timeMs: roundValue(descriptor.timeMs),
      absoluteFrame: Math.round((descriptor.timeMs * FRAME_RATE) / 1000),
      sourceSequencePath,
      elementId: Number(template.elementConfigId),
      elementTypes: [...(template.elementTypes ?? [])],
      targetElementIds: [],
      heldElementIds: [],
      markId: Number(state.profile.markId),
      profileKey: state.profile.key,
      sourceActionId: descriptor.action?.id ?? null,
      sourceActorId: descriptor.action?.actorId ?? null,
      sourceHitIdentity,
      skillTagIds: [],
      landed,
      judgmentGroupIdentity: group.groupIdentity,
      selectedPriorityCandidate: null,
      selectedBranch: result.selectedBranch,
      markCountAtJudgment,
      minimumStacks: group.minimumStacks,
      propertyTags: [...(template.propertyTags ?? [])],
      companionUnitId: result.companionUnitId,
      ownership: result.ownership,
    },
    sourceIdentity: template.sourceIdentity ?? group.sourceIdentity,
    appliedToCalculators: landed,
    applied: true,
  });
}

function createConditionalDamageHitIdentity({
  group,
  hitIndex,
  companionTransaction = null,
}) {
  return companionTransaction
    ? `conditional-damage:${group.groupIdentity}:${companionTransaction.transactionIdentity}`
    : `conditional-damage:${group.groupIdentity}:${Number(hitIndex) || 1}`;
}

function createConditionalDamageRuntimeHit({
  descriptor,
  template,
  sourceHitIdentity,
}) {
  return {
    identity: sourceHitIdentity,
    hitIdentity: sourceHitIdentity,
    hitIndex: Number(descriptor.hitIndex) || 1,
    elementId: Number(template.elementConfigId),
    pathId: template.pathId ?? null,
    name: template.name ?? `条件伤害 ${template.elementConfigId}`,
    displayLabel: template.name ?? `条件伤害 ${template.elementConfigId}`,
    referenceKind: 'conditional-damage',
    trigger: {
      startFrame: Number(descriptor.triggerFrame) || 0,
      frameCount: 1,
      behaviorPathId: sourceHitIdentity,
      targetKind: 'enemy',
    },
    formula: {
      coefficientRaw: Number(template.coefficientRaw),
    },
    damage: { ...template },
    energy: {
      recoverSp: 0,
      petRecoverSp: 0,
      recoverIntervalMs: 0,
    },
    sourceIdentity: template.sourceIdentity,
    applied: true,
  };
}

function createCompanionDamageResolution({ resolution, transaction }) {
  const attackProfile = transaction.attackProfile;
  return {
    ...resolution,
    actionBinding: {
      ...(resolution.actionBinding ?? {}),
      identity: `companion:${transaction.companionIdentity}:${attackProfile.attackIdentity}`,
      controlSkillId: Number(attackProfile.skillId),
      selectedSubSkillIndex: Number(attackProfile.subSkillIndex),
      actionKind: 'companion-attack',
    },
    controlBinding: {
      ...(resolution.controlBinding ?? {}),
      controlSkillId: Number(attackProfile.skillId),
      selectedSubSkillIndex: Number(attackProfile.subSkillIndex),
      frameRate:
        Number(attackProfile.conditionalDamageGroup?.frameRate) || FRAME_RATE,
      logic: {
        ...(resolution.controlBinding?.logic ?? {}),
        skillTag: '0',
        skillTagId: 0,
        sourceIdentity: attackProfile.sourceIdentity,
      },
    },
  };
}

function createTuningMarkThresholdPassiveCommand({
  mechanicsPackage,
  passive,
  actor,
  timeMs,
  descriptor,
  operation,
}) {
  return {
    id: `verified-tuning-threshold-passive|${passive.passiveIdentity}|${timeMs}|${operation}`,
    sourceActionId: descriptor?.action?.id ?? null,
    sourceActionName: descriptor?.action?.name ?? null,
    sourceActorId: actor.id,
    sourceActorName: actor.name,
    effectId: passive.effectId,
    effectName: passive.name,
    operation,
    targetKind: EFFECT_TARGET_KINDS.ACTOR,
    targetId: String(actor.id),
    targetName: actor.name,
    timeMs: Number(timeMs),
    durationMs: null,
    stackMode: EFFECT_STACK_MODES.REFRESH,
    stackDelta: 1,
    maxStacks: 1,
    tags: ['passive', 'tuning-mark-threshold', `passive:${passive.skillId}`],
    sourceStatus: 'verified-tuning-threshold-passive-generated',
    confidence: 'high',
    trackingStatus: 'applied',
    sourceIdentity: {
      packageId: mechanicsPackage.packageId,
      packageHash: mechanicsPackage.packageHash,
      actionBindingIdentity:
        descriptor?.resolution?.actionBinding?.identity ??
        'inherited-tuning-state',
      effectIdentity: passive.passiveIdentity,
      sourceIdentity: passive.sourceIdentity,
    },
    modifiers: (passive.modifiers ?? []).map(modifier => ({
      kind: 'battle-property',
      attributeId: modifier.attributeId,
      bucket: modifier.bucket,
      valueRaw: modifier.valueRaw,
      propertyTags: modifier.propertyTags ?? [],
      sourceIdentity: modifier.sourceIdentity,
    })),
    appliedToCalculators: true,
    generatedVerified: true,
  };
}

function resolveTuningSourceHitIdentityFromHit(hit) {
  return String(
    hit?.identity ??
      hit?.hitIdentity ??
      hit?.sourceIdentity ??
      `${hit?.elementId ?? 'element'}|${hit?.hitIndex ?? 'hit'}`
  );
}

function applyLayerExpiry({
  descriptor,
  stateByMarkId,
  events,
  effectCommands,
  mechanicsPackage,
  scenario,
  enqueue,
  emitThresholdPassiveCommands,
}) {
  const state = stateByMarkId.get(Number(descriptor.profile?.markId));
  if (
    !state ||
    state.layers.length === 0 ||
    descriptor.decayRevision !== state.decayRevision ||
    descriptor.timeMs !== state.decayDueAtMs
  ) {
    return;
  }
  const before = state.layers.length;
  sortLayers(state.layers);
  const [expired] = state.layers.splice(0, 1);
  if (state.layers.length > 0) {
    scheduleSharedDecay(
      state,
      descriptor.timeMs + state.profile.layerDurationMs,
      enqueue
    );
  } else {
    clearSharedDecay(state);
  }
  events.push(
    createMarkEvent({
      kind: 'expire',
      descriptor: { ...descriptor, layer: expired },
      state,
      before,
      after: state.layers.length,
      delta: -1,
      layerIds: [expired.id],
    })
  );
  effectCommands.push(
    ...createPersistentModifierCommands({
      profile: state.profile,
      layerCount: state.layers.length,
      timeMs: descriptor.timeMs,
      scenario,
      mechanicsPackage,
      source: {
        actionId: expired.sourceActionId,
        actorId: expired.sourceActorId,
        actionName: '调谐印记到期',
        effectIdentity: expired.id,
        actionBindingIdentity: expired.id,
        sourceIdentity: expired.sourceIdentity,
      },
    })
  );
  emitThresholdPassiveCommands({
    profile: state.profile,
    before,
    after: state.layers.length,
    timeMs: descriptor.timeMs,
    descriptor: { ...descriptor, layer: expired },
  });
}

function applyMarkConsumption({
  descriptor: originalDescriptor,
  stateByMarkId,
  events,
  effectCommands,
  combatEvents,
  unresolved,
  mechanicsPackage,
  scenario,
  enqueue,
  emitThresholdPassiveCommands,
}) {
  let descriptor = originalDescriptor;
  if (Array.isArray(descriptor.priorityCandidates)) {
    const candidates = descriptor.priorityCandidates.map(candidate => ({
      ...candidate,
      current: stateByMarkId.get(Number(candidate.markId))?.layers.length ?? 0,
    }));
    const selected = candidates.find(
      candidate => candidate.current >= candidate.minimumStacks
    );
    if (!selected) {
      unresolved.push({
        kind: 'tuning-consume-no-sufficient-priority-candidate',
        actionId: descriptor.action.id,
        judgmentGroupIdentity:
          descriptor.effect.tuningOverlimit.judgmentGroupIdentity,
        candidates: candidates.map(candidate => ({
          priorityIndex: candidate.priorityIndex,
          markId: candidate.markId,
          required: candidate.minimumStacks,
          current: candidate.current,
        })),
        timeMs: descriptor.timeMs,
        sourceIdentity:
          descriptor.effect.tuningOverlimit.priorityRuntimeEvidence
            ?.sourceIdentity ?? descriptor.effect.sourceIdentity,
        status: 'verified-tuning-consume-not-executed',
        applied: false,
      });
      return;
    }
    if (!selected.effect || !selected.profile) {
      unresolved.push({
        kind: 'tuning-consume-selected-priority-packet-unavailable',
        actionId: descriptor.action.id,
        judgmentGroupIdentity:
          descriptor.effect.tuningOverlimit.judgmentGroupIdentity,
        priorityIndex: selected.priorityIndex,
        markId: selected.markId,
        packetElementId: selected.packetElementId,
        timeMs: descriptor.timeMs,
        sourceIdentity:
          descriptor.effect.tuningOverlimit.priorityRuntimeEvidence
            ?.sourceIdentity ?? descriptor.effect.sourceIdentity,
        status: 'verified-tuning-consume-not-executed',
        applied: false,
      });
      return;
    }
    descriptor = {
      ...descriptor,
      effect: selected.effect,
      profile: selected.profile,
      selectedPriorityCandidate: {
        priorityIndex: selected.priorityIndex,
        markId: selected.markId,
        packetElementId: selected.packetElementId,
      },
    };
  }
  const state = stateByMarkId.get(Number(descriptor.profile?.markId));
  if (!state) return;
  const contract = descriptor.effect.tuningOverlimit;
  const minimum = positiveInteger(contract.minimumStacks, 1);
  if (state.layers.length < minimum) {
    unresolved.push({
      kind: 'tuning-consume-insufficient-marks',
      actionId: descriptor.action.id,
      markId: state.profile.markId,
      required: minimum,
      current: state.layers.length,
      timeMs: descriptor.timeMs,
      sourceIdentity: descriptor.effect.sourceIdentity,
      status: 'verified-tuning-consume-not-executed',
      applied: false,
    });
    return;
  }
  const maximum = positiveIntegerOrNull(contract.maximumStacks);
  const consumedCount = Math.min(state.layers.length, maximum ?? minimum);
  const before = state.layers.length;
  sortLayers(state.layers);
  const consumedLayers = state.layers.splice(0, consumedCount);
  if (state.layers.length === 0) {
    clearSharedDecay(state);
  }
  const source = createDescriptorSource(descriptor);
  events.push(
    createMarkEvent({
      kind: 'consume',
      descriptor,
      state,
      before,
      after: state.layers.length,
      delta: -consumedCount,
      layerIds: consumedLayers.map(layer => layer.id),
    })
  );
  effectCommands.push(
    ...createPersistentModifierCommands({
      profile: state.profile,
      layerCount: state.layers.length,
      timeMs: descriptor.timeMs,
      scenario,
      mechanicsPackage,
      source,
    }),
    ...createOverlimitEffectCommands({
      profile: state.profile,
      consumedCount,
      timeMs: descriptor.timeMs,
      scenario,
      mechanicsPackage,
      source,
    })
  );
  emitThresholdPassiveCommands({
    profile: state.profile,
    before,
    after: state.layers.length,
    timeMs: descriptor.timeMs,
    descriptor,
  });
  combatEvents.push(
    createCombatEvent({
      kind: 'overlimit-damage',
      descriptor,
      profile: state.profile,
      markCount: consumedCount,
      template: state.profile.overlimitDamage.template,
      scenario,
    })
  );
  createOverlimitExtraCombatEvents({
    descriptor,
    profile: state.profile,
    consumedCount,
    combatEvents,
    unresolved,
    enqueue,
    scenario,
  });
}

function applyHeldMarkTriggers({
  descriptor,
  stateByMarkId,
  events,
  combatEvents,
  effectCommands,
  mechanicsPackage,
  scenario,
}) {
  for (const state of stateByMarkId.values()) {
    if (state.layers.length === 0 || descriptor.timeMs < state.heldReadyAtMs) {
      continue;
    }
    const markCount = state.layers.length;
    for (const template of state.profile.heldDamageTemplates) {
      combatEvents.push(
        createCombatEvent({
          kind:
            Number(template.damageType) === 6
              ? 'held-true-damage'
              : 'held-damage',
          descriptor,
          profile: state.profile,
          markCount,
          template,
          scenario,
        })
      );
    }
    if (state.profile.key === 'water') {
      const source = createDescriptorSource(descriptor);
      effectCommands.push(
        ...createTimedModifierCommands({
          effectId: `tuning-held:${state.profile.markId}:defense-down`,
          effectName: state.profile.heldEffect.name,
          targetKind: EFFECT_TARGET_KINDS.ENEMY,
          targetIds: [scenario.enemy?.id],
          timeMs: descriptor.timeMs + 0.001,
          durationMs: Number(state.profile.heldEffect.durationSeconds) * 1000,
          stackDelta: markCount,
          modifiers: (state.profile.heldEffect.attributeIds ?? []).map(
            attributeId => ({
              kind: 'battle-property',
              attributeId,
              bucket: 'dynamicPercent',
              valueRaw: -84,
              propertyTags: [],
              sourceIdentity: state.profile.sourceIdentity,
            })
          ),
          source,
          mechanicsPackage,
          appliedToCalculators: true,
        })
      );
    }
    state.heldReadyAtMs = roundValue(
      descriptor.timeMs + state.profile.heldReadyMs
    );
    const sourceSequencePath = createTuningSourceSequencePath({
      descriptor,
      localKind: 'held-trigger',
      localIdentity: state.profile.markId,
    });
    events.push({
      schemaVersion: 1,
      sourceKind: 'azpr-verified-tuning-mark-event',
      status: 'verified-tuning-mark-held-trigger',
      eventIdentity: `tuning-held|${state.profile.markId}|${descriptor.timeMs}|${descriptor.hit?.hitIdentity}`,
      kind: 'held-trigger',
      type: 'VERIFIED_TUNING_MARK_HELD_TRIGGER',
      timeMs: descriptor.timeMs,
      frameIndex: Math.round((descriptor.timeMs * FRAME_RATE) / 1000),
      sourceSequencePath,
      actionId: descriptor.action?.id ?? null,
      actorId: descriptor.action?.actorId ?? null,
      markId: state.profile.markId,
      profileKey: state.profile.key,
      elementName: state.profile.element,
      before: markCount,
      delta: 0,
      after: markCount,
      maximum: state.profile.maxStacks,
      layerIds: [],
      heldReadyAtMs: state.heldReadyAtMs,
      decayDueAtMs: state.decayDueAtMs,
      sourceIdentity: state.profile.sourceIdentity,
      appliedToCalculators: true,
      applied: true,
    });
  }
}

function applyDirectSpPresence({
  descriptor,
  stateByMarkId,
  combatEvents,
  scenario,
}) {
  const contract = descriptor.effect?.directSpPresence;
  if (!contract?.applied) return;
  const markId = Number(contract.markId);
  const state = stateByMarkId.get(markId);
  if (!state || state.layers.length < Number(contract.minimumStacks ?? 1)) {
    return;
  }
  combatEvents.push({
    schemaVersion: 1,
    sourceKind: 'azpr-verified-tuning-combat-event',
    status: 'verified-tuning-conditional-direct-sp-ready',
    kind: 'conditional-direct-sp',
    eventIdentity: [
      'conditional-direct-sp',
      descriptor.action?.id,
      markId,
      descriptor.timeMs,
    ].join('|'),
    timeMs: roundValue(descriptor.timeMs),
    action: descriptor.action ?? null,
    actionId: descriptor.action?.id ?? null,
    actorId: descriptor.action?.actorId ?? null,
    resolution: descriptor.resolution ?? null,
    profile: state.profile,
    markCount: state.layers.length,
    template: {
      value: Number(contract.value),
      sourceIdentity: contract.sourceIdentity,
    },
    sourceIdentity: contract.sourceIdentity,
    appliedToCalculators: true,
    applied: true,
  });
}

function applyPeriodicEffect({
  descriptor,
  stateByMarkId,
  combatEvents,
  enqueue,
  durationMs,
}) {
  const state = stateByMarkId.get(Number(descriptor.profile?.markId));
  if (!state || state.periodicDueAtMs !== descriptor.timeMs) return;
  state.periodicDueAtMs = null;
  if (state.layers.length === 0) return;
  combatEvents.push({
    schemaVersion: 1,
    sourceKind: 'azpr-verified-tuning-combat-event',
    status: 'verified-tuning-periodic-heal-ready',
    kind: 'periodic-heal',
    eventIdentity: `tuning-periodic|${state.profile.markId}|${descriptor.timeMs}`,
    timeMs: descriptor.timeMs,
    action: null,
    actionId: state.layers[0]?.sourceActionId ?? null,
    actorId: state.layers[0]?.sourceActorId ?? null,
    resolution: null,
    profile: state.profile,
    markCount: state.layers.length,
    template: null,
    sourceIdentity: state.profile.sourceIdentity,
    appliedToCalculators: true,
    applied: true,
  });
  const nextTimeMs = descriptor.timeMs + 5_000;
  if (nextTimeMs <= durationMs) schedulePeriodic(state, nextTimeMs, enqueue);
}

function createOverlimitExtraCombatEvents({
  descriptor,
  profile,
  consumedCount,
  combatEvents,
  unresolved,
  enqueue,
  scenario,
}) {
  const extra = profile.overlimitExtra;
  if (!extra) return;
  if (extra.kind === 'damage_over_time') {
    for (let tick = 1; tick <= Number(extra.expectedTickCount); tick += 1) {
      enqueue({
        kind: 'combat',
        timeMs: descriptor.timeMs + tick * Number(extra.intervalSeconds) * 1000,
        combatEvent: createCombatEvent({
          kind: 'overlimit-dot-damage',
          descriptor: {
            ...descriptor,
            timeMs:
              descriptor.timeMs + tick * Number(extra.intervalSeconds) * 1000,
          },
          profile,
          markCount: consumedCount,
          template: {
            ...profile.overlimitDamage.template,
            elementConfigId: extra.componentId,
            coefficientRaw: Math.round(
              Number(extra.coefficientPerMark) * 10_000
            ),
          },
          scenario,
        }),
      });
    }
  } else if (extra.kind === 'true_damage') {
    combatEvents.push(
      createCombatEvent({
        kind: 'overlimit-true-damage',
        descriptor,
        profile,
        markCount: consumedCount,
        template: {
          damageType: 6,
          elementalType: 0,
          elementConfigId: extra.componentId,
          coefficientRaw: Math.round(
            Number(extra.coefficientPerConsumedMark) * 10_000
          ),
          weakBreakDamageRateBasisPoints: 0,
          usesTuningStrength: false,
          sourceIdentity: profile.sourceIdentity,
        },
        scenario,
      })
    );
  } else if (extra.kind === 'sp_recovery') {
    combatEvents.push(
      createCombatEvent({
        kind: 'overlimit-direct-sp',
        descriptor,
        profile,
        markCount: consumedCount,
        template: {
          valuePerMark: Number(extra.spPerConsumedMark),
          sourceIdentity: profile.sourceIdentity,
        },
        scenario,
      })
    );
  } else if (extra.kind === 'chain_lightning') {
    unresolved.push({
      kind: 'tuning-overlimit-chain-targeting-unresolved',
      actionId: descriptor.action.id,
      profileKey: profile.key,
      componentId: extra.componentId,
      timeMs: descriptor.timeMs,
      sourceIdentity: profile.sourceIdentity,
      status: 'verified-tuning-extra-unresolved',
      applied: false,
    });
  }
}

function createOverlimitEffectCommands({
  profile,
  consumedCount,
  timeMs,
  scenario,
  mechanicsPackage,
  source,
}) {
  const extra = profile.overlimitExtra;
  if (!extra) return [];
  const common = {
    timeMs: timeMs + 0.001,
    stackDelta: consumedCount,
    source,
    mechanicsPackage,
  };
  if (extra.kind === 'property_debuff') {
    return createTimedModifierCommands({
      ...common,
      effectId: `tuning-overlimit:${profile.markId}:${extra.componentId}`,
      effectName: extra.name,
      targetKind: EFFECT_TARGET_KINDS.ENEMY,
      targetIds: [scenario.enemy?.id],
      durationMs: Number(extra.durationSeconds) * 1000,
      modifiers: [
        createModifier(extra.attributeId, 'dynamicPercent', -216, profile),
      ],
      appliedToCalculators: true,
    });
  }
  if (extra.kind === 'property_buff') {
    return createTimedModifierCommands({
      ...common,
      effectId: `tuning-overlimit:${profile.markId}:${extra.componentId}`,
      effectName: extra.name,
      targetKind: 'team',
      targetIds: [],
      scenario,
      durationMs: Number(extra.durationSeconds) * 1000,
      modifiers: [
        createModifier(
          extra.attributeId,
          'dynamicExtra',
          extra.pointsPerConsumedMark,
          profile
        ),
      ],
      appliedToCalculators: true,
    });
  }
  if (extra.kind === 'weakness_debuff') {
    return createTimedModifierCommands({
      ...common,
      effectId: `tuning-overlimit:${profile.markId}:weakness`,
      effectName: extra.name,
      targetKind: EFFECT_TARGET_KINDS.ENEMY,
      targetIds: [scenario.enemy?.id],
      durationMs: Number(extra.durationSeconds) * 1000,
      modifiers: (extra.attributeIds ?? []).map(attributeId =>
        createModifier(
          attributeId,
          'dynamicExtra',
          extra.rawPerConsumedMark,
          profile
        )
      ),
      appliedToCalculators: true,
    });
  }
  if (extra.kind === 'resistance_debuff') {
    return createTimedModifierCommands({
      ...common,
      effectId: `tuning-overlimit:${profile.markId}:resistance`,
      effectName: extra.name,
      targetKind: EFFECT_TARGET_KINDS.ENEMY,
      targetIds: [scenario.enemy?.id],
      durationMs: Number(extra.durationSeconds) * 1000,
      modifiers: (extra.attributeIds ?? []).map(attributeId =>
        createModifier(
          attributeId,
          'dynamicExtra',
          extra.rawPerConsumedMark,
          profile
        )
      ),
      appliedToCalculators: true,
    });
  }
  if (extra.kind === 'control') {
    return createTimedModifierCommands({
      ...common,
      effectId: `tuning-overlimit:${profile.markId}:control`,
      effectName: extra.name,
      targetKind: EFFECT_TARGET_KINDS.ENEMY,
      targetIds: [scenario.enemy?.id],
      durationMs: Number(extra.durationPerConsumedMarkMs) * consumedCount,
      modifiers: [],
      appliedToCalculators: false,
    });
  }
  return [];
}

function createPersistentModifierCommands({
  profile,
  layerCount,
  timeMs,
  scenario,
  mechanicsPackage,
  source,
}) {
  if ((profile.persistentModifiers ?? []).length === 0) return [];
  return createTimedModifierCommands({
    effectId: `tuning-mark:${profile.markId}:persistent`,
    effectName: `${profile.element}调谐印记`,
    tags: ['verified-tuning-mark', 'tuning-mark-resource-mirror'],
    targetKind: 'team',
    targetIds: [],
    scenario,
    timeMs,
    durationMs: null,
    stackDelta: layerCount,
    modifiers: profile.persistentModifiers.map(modifier => ({
      kind: 'battle-property',
      attributeId: modifier.attributeId,
      bucket: modifier.bucket,
      valueRaw: modifier.valueRaw,
      propertyTags: modifier.propertyTags ?? [],
      sourceIdentity: modifier.sourceIdentity,
    })),
    source,
    mechanicsPackage,
    appliedToCalculators: true,
  });
}

function createTimedModifierCommands({
  effectId,
  effectName,
  tags = ['verified-tuning-mark'],
  targetKind,
  targetIds,
  scenario,
  timeMs,
  durationMs,
  stackDelta,
  modifiers,
  source,
  mechanicsPackage,
  appliedToCalculators,
}) {
  const targets =
    targetKind === 'team'
      ? (scenario?.actors ?? []).flatMap(actor => [
          { kind: EFFECT_TARGET_KINDS.ACTOR, id: actor.id },
          ...(actor.loadout?.kiboId
            ? [{ kind: EFFECT_TARGET_KINDS.KIBO, id: actor.id }]
            : []),
        ])
      : (targetIds ?? []).filter(Boolean).map(id => ({ kind: targetKind, id }));
  return targets.map((target, index) => ({
    id: `${effectId}|${target.kind}|${target.id}|${timeMs}|${index}`,
    sourceActionId: source.actionId ?? null,
    sourceActionName: source.actionName ?? '调谐机制',
    sourceActorId: source.actorId ?? null,
    sourceActorName: source.actorName ?? null,
    effectId,
    effectName,
    operation:
      stackDelta > 0 ? EFFECT_OPERATIONS.APPLY : EFFECT_OPERATIONS.REMOVE,
    targetKind: target.kind,
    targetId: String(target.id),
    timeMs: roundValue(timeMs),
    durationMs,
    stackMode: EFFECT_STACK_MODES.REPLACE,
    stackDelta: Math.max(1, Number(stackDelta) || 0),
    maxStacks: 5,
    tags,
    sourceStatus: TUNING_EFFECT_SOURCE_STATUS,
    confidence: 'verified',
    trackingStatus: appliedToCalculators ? 'applied' : 'tracking-only',
    sourceIdentity: {
      packageId: mechanicsPackage.packageId,
      packageHash: mechanicsPackage.packageHash,
      actionBindingIdentity:
        source.actionBindingIdentity ??
        `tuning-source:${source.actionId ?? 'inherited'}`,
      effectIdentity: source.effectIdentity ?? effectId,
      sourceIdentity: source.sourceIdentity,
    },
    modifiers,
    appliedToCalculators,
    generatedVerified: true,
  }));
}

function createModifier(attributeId, bucket, valueRaw, profile) {
  return {
    kind: 'battle-property',
    attributeId,
    bucket,
    valueRaw,
    propertyTags: [],
    sourceIdentity: profile.sourceIdentity,
  };
}

function createCombatEvent({
  kind,
  descriptor,
  profile,
  markCount,
  template,
  scenario = null,
}) {
  const eventIdentity = [
    kind,
    descriptor.action?.id,
    profile.markId,
    template?.elementConfigId,
    descriptor.timeMs,
  ].join('|');
  const sourceSequencePath = createTuningSourceSequencePath({
    descriptor,
    localKind: kind,
    localIdentity: template?.elementConfigId,
  });
  const damageEvent = [
    'held-damage',
    'held-true-damage',
    'overlimit-damage',
    'overlimit-dot-damage',
    'overlimit-true-damage',
  ].includes(kind);
  const sourceHitIdentity = resolveTuningSourceHitIdentity(descriptor);
  const landed = damageEvent
    ? resolveActionHitWillHit(
        descriptor.action,
        sourceHitIdentity ?? eventIdentity,
        (scenario?.combatScenario?.projectile?.defaultWillHit ??
          scenario?.projectile?.defaultWillHit) !== false
      )
    : null;
  const elementTypes = uniqueIntegers(template?.elementTypes ?? []);
  const targetElementIds = kind.startsWith('overlimit-')
    ? uniqueIntegers([profile.overlimitPacket?.elementId])
    : [];
  const skillTagIds = uniqueIntegers([
    descriptor.resolution?.controlBinding?.logic?.skillTagId,
    ...parseIntegerList(descriptor.resolution?.controlBinding?.logic?.skillTag),
  ]);
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-verified-tuning-combat-event',
    status: `verified-tuning-${kind}-ready`,
    kind,
    eventIdentity,
    timeMs: roundValue(descriptor.timeMs),
    absoluteFrame: Math.round((descriptor.timeMs * FRAME_RATE) / 1000),
    action: descriptor.action ?? null,
    actionId: descriptor.action?.id ?? null,
    actorId: descriptor.action?.actorId ?? null,
    resolution: descriptor.resolution ?? null,
    sourceHit: descriptor.hit ?? null,
    profile,
    markCount,
    template,
    eventContext: {
      eventIdentity,
      eventKind: kind,
      timeMs: roundValue(descriptor.timeMs),
      absoluteFrame: Math.round((descriptor.timeMs * FRAME_RATE) / 1000),
      sourceSequencePath,
      elementId: Number.isInteger(Number(template?.elementConfigId))
        ? Number(template.elementConfigId)
        : null,
      elementTypes,
      targetElementIds,
      heldElementIds: [],
      markId: Number(profile.markId),
      profileKey: profile.key,
      overlimitPacketElementId:
        Number(profile.overlimitPacket?.elementId) || null,
      sourceActionId: descriptor.action?.id ?? null,
      sourceActorId: descriptor.action?.actorId ?? null,
      sourceHitIdentity,
      skillTagIds,
      landed,
      judgmentGroupIdentity:
        descriptor.effect?.tuningOverlimit?.judgmentGroupIdentity ?? null,
      selectedPriorityCandidate: descriptor.selectedPriorityCandidate ?? null,
      propertyTags: kind.startsWith('overlimit-')
        ? [VERIFIED_BATTLE_PROPERTY_TAG_OVERDRIVE]
        : [],
    },
    sourceIdentity: template?.sourceIdentity ?? profile.sourceIdentity,
    appliedToCalculators: true,
    applied: true,
  };
}

function createMarkEvent({
  kind,
  descriptor,
  state,
  before,
  after,
  delta,
  layerIds,
}) {
  const sourceSequencePath = createTuningSourceSequencePath({
    descriptor,
    localKind: kind,
    localIdentity: state.profile.markId,
  });
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-verified-tuning-mark-event',
    status: `verified-tuning-mark-${kind}`,
    eventIdentity: [
      'tuning-mark',
      state.profile.markId,
      kind,
      descriptor.timeMs,
      descriptor.queueSequence,
    ].join('|'),
    kind,
    type: `VERIFIED_TUNING_MARK_${kind.toUpperCase()}`,
    timeMs: roundValue(descriptor.timeMs),
    frameIndex: Math.round((descriptor.timeMs * FRAME_RATE) / 1000),
    absoluteFrame: Math.round((descriptor.timeMs * FRAME_RATE) / 1000),
    sourceSequencePath,
    actionId: descriptor.action?.id ?? descriptor.layer?.sourceActionId ?? null,
    actorId:
      descriptor.action?.actorId ?? descriptor.layer?.sourceActorId ?? null,
    markId: state.profile.markId,
    profileKey: state.profile.key,
    elementName: state.profile.element,
    before,
    delta,
    after,
    maximum: state.profile.maxStacks,
    layerIds,
    heldReadyAtMs: state.heldReadyAtMs,
    decayDueAtMs: state.decayDueAtMs,
    decayRemainingMs:
      state.decayDueAtMs == null
        ? 0
        : Math.max(0, state.decayDueAtMs - descriptor.timeMs),
    judgmentGroupIdentity:
      descriptor.effect?.tuningOverlimit?.judgmentGroupIdentity ?? null,
    selectedPriorityCandidate: descriptor.selectedPriorityCandidate ?? null,
    sourceIdentity:
      descriptor.effect?.sourceIdentity ??
      descriptor.layer?.sourceIdentity ??
      state.profile.sourceIdentity,
    appliedToCalculators: true,
    applied: true,
  };
}

function createGetElementEvent({
  phase,
  eventId,
  descriptor,
  state,
  before,
  after,
  requestedLayerCount,
  acquiredLayerCount,
  transactionIdentity,
  outcome,
}) {
  const transactionSourceSequencePath = createTuningSourceSequencePath({
    descriptor,
    localKind: 'acquire',
    localIdentity: state.profile.markId,
  });
  const phaseSequenceIndex = phase === 'before-mutation' ? 0 : 1;
  const sourceSequencePath = createTuningSourceSequencePath({
    descriptor,
    localKind:
      phase === 'before-mutation' ? 'get-element-before' : 'get-element-after',
    localIdentity: state.profile.markId,
  });
  const sourceHitIdentity = resolveTuningSourceHitIdentity(descriptor);
  const eventIdentity = `${transactionIdentity}|event:${eventId}`;
  const eventContext = {
    eventIdentity,
    transactionIdentity,
    eventKind:
      phase === 'before-mutation'
        ? 'element-before-acquire'
        : 'element-after-acquire',
    eventId,
    phase,
    timeMs: roundValue(descriptor.timeMs),
    absoluteFrame: Math.round((descriptor.timeMs * FRAME_RATE) / 1000),
    sourceSequencePath,
    transactionSourceSequencePath,
    phaseSequenceIndex,
    elementId: Number(state.profile.markId),
    elementTypes: [...(state.profile.markContainer?.elementTypes ?? [])],
    elementTypeSourceIdentity:
      state.profile.markContainer?.elementTypeSourceIdentity ?? null,
    markContainerSourceIdentity:
      state.profile.markContainer?.sourceIdentity ?? null,
    markId: Number(state.profile.markId),
    profileKey: state.profile.key,
    before,
    requested: requestedLayerCount,
    delta: acquiredLayerCount,
    after,
    outcome,
    applied: true,
    success: true,
    initialState: false,
    acquisitionSourceKind:
      descriptor.acquisitionSourceKind ?? 'verified-action-effect',
    sourceActionId: descriptor.action?.id ?? null,
    sourceActorId: descriptor.action?.actorId ?? null,
    sourceHitIdentity,
    sourceEffectIdentity: descriptor.effect?.effectIdentity ?? null,
    sourceIdentity:
      descriptor.effect?.sourceIdentity ?? state.profile.sourceIdentity,
    landed: null,
    targetElementIds: [],
    heldElementIds: [],
  };
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-verified-tuning-get-element-event',
    status: 'verified-tuning-get-element-event-applied',
    eventIdentity,
    transactionIdentity,
    kind: eventContext.eventKind,
    type:
      eventId === 9
        ? 'VERIFIED_TUNING_BEFORE_GET_ELEMENT'
        : 'VERIFIED_TUNING_AFTER_GET_ELEMENT',
    eventId,
    phase,
    timeMs: eventContext.timeMs,
    frameIndex: eventContext.absoluteFrame,
    absoluteFrame: eventContext.absoluteFrame,
    sourceSequencePath,
    transactionSourceSequencePath,
    phaseSequenceIndex,
    actionId: eventContext.sourceActionId,
    actorId: eventContext.sourceActorId,
    markId: eventContext.markId,
    profileKey: eventContext.profileKey,
    before,
    delta: acquiredLayerCount,
    after,
    outcome,
    eventContext,
    sourceIdentity: eventContext.sourceIdentity,
    appliedToCalculators: true,
    applied: true,
  };
}

function createTuningSourceSequencePath({
  descriptor,
  localKind,
  localIdentity,
}) {
  const effectPhase = {
    'get-element-before': 'before',
    acquire: 'settlement',
    'get-element-after': 'after',
  }[localKind];
  if (effectPhase && descriptor.effect) {
    const effectSourceSequencePath = createVerifiedEffectSourceSequencePath({
      action: descriptor.action,
      effect: descriptor.effect,
      phase: effectPhase,
      localSequenceSuffix: [Math.max(0, Number(localIdentity) || 0)],
    });
    if (effectSourceSequencePath) return effectSourceSequencePath;
  }
  const actionPath = getActionSourceSequencePath(descriptor.action);
  const kindOrder = {
    expire: 10,
    'get-element-before': 19,
    acquire: 20,
    'get-element-after': 21,
    consume: 30,
    'conditional-damage': 35,
    'held-trigger': 40,
    'held-damage': 50,
    'held-true-damage': 51,
    'overlimit-damage': 60,
    'overlimit-dot-damage': 61,
    'overlimit-true-damage': 62,
    'overlimit-direct-sp': 63,
    'periodic-heal': 70,
  };
  const suffix = [
    kindOrder[localKind] ?? 90,
    Number(descriptor.queueSequence) || 0,
    Math.max(0, Number(localIdentity) || 0),
  ];
  return actionPath
    ? [...actionPath, ...suffix]
    : [Number.MAX_SAFE_INTEGER, ...suffix];
}

function resolveTuningSourceHitIdentity(descriptor) {
  const hit = descriptor.hit;
  if (!hit) return null;
  return String(
    hit.identity ??
      hit.hitIdentity ??
      hit.sourceIdentity ??
      `${hit.elementId ?? 'element'}|${hit.hitIndex ?? 'hit'}`
  );
}

function parseIntegerList(value) {
  if (Array.isArray(value)) return value.map(Number);
  return String(value ?? '')
    .split(/[^\d-]+/u)
    .filter(Boolean)
    .map(Number);
}

function uniqueIntegers(values) {
  return [...new Set(values.map(Number).filter(Number.isInteger))].sort(
    (left, right) => left - right
  );
}

function createDescriptorSource(descriptor) {
  return {
    actionId: descriptor.action?.id ?? null,
    actionName: descriptor.action?.name ?? '调谐机制',
    actorId: descriptor.action?.actorId ?? null,
    actorName: descriptor.action?.actor?.name ?? null,
    effectIdentity:
      descriptor.effect?.effectIdentity ?? descriptor.hit?.hitIdentity ?? null,
    actionBindingIdentity: descriptor.resolution?.actionBinding?.identity,
    sourceIdentity:
      descriptor.effect?.sourceIdentity ??
      descriptor.hit?.sourceIdentity ??
      descriptor.profile?.sourceIdentity,
  };
}

function schedulePeriodic(state, timeMs, enqueue) {
  if (state.periodicDueAtMs != null && state.periodicDueAtMs <= timeMs) return;
  state.periodicDueAtMs = roundValue(timeMs);
  enqueue({
    kind: 'periodic',
    timeMs: state.periodicDueAtMs,
    profile: state.profile,
  });
}

function scheduleSharedDecay(state, timeMs, enqueue) {
  state.decayRevision += 1;
  state.decayDueAtMs = roundValue(timeMs);
  enqueue({
    kind: 'expire',
    timeMs: state.decayDueAtMs,
    profile: state.profile,
    decayRevision: state.decayRevision,
  });
}

function clearSharedDecay(state) {
  state.decayRevision += 1;
  state.decayDueAtMs = null;
}

function resolveEffectTimeMs(action, effect, resolution) {
  const startFrame = Number(effect.trigger?.startFrame);
  const frameRate = Number(resolution.controlBinding?.frameRate ?? FRAME_RATE);
  if (!Number.isInteger(startFrame) || !(frameRate > 0)) return null;
  if (!isActionFrameWithinContextualOccupancy(action, startFrame, frameRate)) {
    return null;
  }
  return roundValue(Number(action.startMs) + (startFrame * 1000) / frameRate);
}

function createInitialTuningState(scenario, catalog) {
  const inheritedByMarkId = new Map(
    (scenario?.initialRuntimeState?.tuningMarks ?? []).map(state => [
      Number(state.markId),
      state,
    ])
  );
  return catalog.profiles.map(profile => {
    const inherited = inheritedByMarkId.get(Number(profile.markId));
    const layers = resolveInheritedLayerSources(inherited)
      .slice(0, profile.maxStacks)
      .map(layer => ({
        sourceActionId: layer.sourceActionId ?? null,
        sourceActorId: layer.sourceActorId ?? null,
        sourceIdentity: layer.sourceIdentity ?? profile.sourceIdentity,
      }));
    return {
      markId: profile.markId,
      profileKey: profile.key,
      elementName: profile.element,
      currentValue: layers.length,
      maxValue: profile.maxStacks,
      decayRemainingMs:
        layers.length > 0
          ? (resolveInheritedDecayRemainingMs(inherited) ?? 0)
          : 0,
      heldReadyRemainingMs: nonNegativeNumber(inherited?.heldReadyRemainingMs),
      layers,
      valueUnit: 'mark-stacks',
    };
  });
}

function createPublishedTuningState(stateByMarkId, timeMs) {
  return [...stateByMarkId.values()].map(state => {
    const decayRemainingMs =
      state.layers.length > 0 && state.decayDueAtMs != null
        ? Math.max(0, state.decayDueAtMs - timeMs)
        : 0;
    return {
      markId: state.profile.markId,
      profileKey: state.profile.key,
      elementName: state.profile.element,
      currentValue: state.layers.length,
      maxValue: state.profile.maxStacks,
      decayRemainingMs,
      heldReadyRemainingMs: Math.max(0, state.heldReadyAtMs - timeMs),
      layers: state.layers.map(layer => ({
        sourceActionId: layer.sourceActionId,
        sourceActorId: layer.sourceActorId,
        sourceIdentity: layer.sourceIdentity,
      })),
      valueUnit: 'mark-stacks',
    };
  });
}

function sortLayers(layers) {
  layers.sort(
    (left, right) =>
      left.acquiredAtMs - right.acquiredAtMs ||
      left.acquisitionSequence - right.acquisitionSequence ||
      left.id.localeCompare(right.id)
  );
}

function compareGenerationDescriptors(left, right) {
  const priority = {
    expire: 0,
    acquire: 1,
    consume: 2,
    periodic: 3,
    'conditional-damage': 4,
    hit: 4,
    combat: 5,
  };
  return (
    left.timeMs - right.timeMs ||
    (priority[left.kind] ?? 9) - (priority[right.kind] ?? 9) ||
    left.queueSequence - right.queueSequence
  );
}

function compareGeneratedEvents(left, right) {
  return (
    Number(left.timeMs) - Number(right.timeMs) ||
    compareSourceSequencePaths(
      left.sourceSequencePath ?? left.eventContext?.sourceSequencePath,
      right.sourceSequencePath ?? right.eventContext?.sourceSequencePath
    ) ||
    String(left.eventIdentity ?? left.id ?? '').localeCompare(
      String(right.eventIdentity ?? right.id ?? '')
    )
  );
}

function createUnavailableGeneration(reason) {
  return {
    schemaVersion: 2,
    contractName: VERIFIED_TUNING_MARK_GENERATION_CONTRACT_NAME,
    sourceKind: 'azpr-verified-tuning-mark-generation',
    status: reason,
    events: [],
    getElementEvents: [],
    effectCommands: [],
    combatEvents: [],
    acquisitionGateResults: [],
    conditionalDamageResults: [],
    unresolved: [],
    initialState: [],
    finalState: [],
    summary: {
      profileCount: 0,
      markEventCount: 0,
      effectCommandCount: 0,
      combatEventCount: 0,
      acquisitionGateResultCount: 0,
      conditionalDamageResultCount: 0,
      unresolvedCount: 0,
      applied: false,
    },
    applied: false,
  };
}

function nonNegativeNumber(value) {
  return Math.max(0, Number(value) || 0);
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function positiveNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function resolveInheritedDecayRemainingMs(inherited) {
  const sharedRemainingMs = positiveNumberOrNull(inherited?.decayRemainingMs);
  if (sharedRemainingMs != null) return sharedRemainingMs;
  const legacyLayerDurations = (inherited?.layers ?? [])
    .map(layer => positiveNumberOrNull(layer?.remainingDurationMs))
    .filter(value => value != null);
  return legacyLayerDurations.length > 0
    ? Math.max(...legacyLayerDurations)
    : null;
}

function resolveInheritedLayerSources(inherited) {
  const layers = Array.isArray(inherited?.layers) ? inherited.layers : [];
  const hasSharedDecay =
    positiveNumberOrNull(inherited?.decayRemainingMs) != null;
  return layers.filter(
    layer =>
      layer &&
      typeof layer === 'object' &&
      (hasSharedDecay ||
        positiveNumberOrNull(layer.remainingDurationMs) != null)
  );
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function roundValue(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e6) / 1e6;
}
