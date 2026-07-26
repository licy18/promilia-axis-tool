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
import { isActionFrameWithinContextualOccupancy } from './actionEffectiveTimeline';

export const VERIFIED_TUNING_MARK_GENERATION_CONTRACT_NAME =
  'AzPrVerifiedTuningMarkGeneration';

const FRAME_RATE = 60;
const TUNING_EFFECT_SOURCE_STATUS = 'verified-tuning-mark-generated';

export function createVerifiedTuningMarkGeneration({
  scenario = {},
  actionExecutionPlan = null,
  effectGeneration = null,
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
        heldReadyAtMs: 0,
        periodicDueAtMs: null,
      },
    ])
  );
  const queue = [];
  const events = [];
  const effectCommands = [];
  const combatEvents = [];
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

  for (const action of scenario.actions ?? []) {
    if (executionByActionId.get(action.id)?.execute === false) continue;
    if (![ACTION_TYPES.SKILL, ACTION_TYPES.KIBO_EVENT].includes(action.type)) {
      continue;
    }
    const resolution =
      effectGeneration?.actionResolutionById?.get(action.id) ??
      resolveVerifiedCombatActionMechanics(action, {
        combatScenario: scenario.combatScenario,
      });
    if (!resolution?.ready) continue;
    for (const effect of dedupeTuningRuntimeEffects(
      resolution.effects ?? []
    )) {
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
        });
      }
      if (effect.tuningOverlimit) {
        enqueue({
          kind: 'consume',
          timeMs,
          action,
          resolution,
          effect,
          profile: profileByMarkId.get(Number(effect.tuningOverlimit.markId)),
        });
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
      });
    } else if (descriptor.kind === 'acquire') {
      applyLayerAcquisition({
        descriptor,
        stateByMarkId,
        events,
        effectCommands,
        mechanicsPackage,
        scenario,
        enqueue,
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
    } else if (descriptor.kind === 'combat') {
      combatEvents.push(descriptor.combatEvent);
    }
  }

  events.sort(compareGeneratedEvents);
  combatEvents.sort(compareGeneratedEvents);
  effectCommands.sort(compareGeneratedEvents);
  return {
    schemaVersion: 1,
    contractName: VERIFIED_TUNING_MARK_GENERATION_CONTRACT_NAME,
    sourceKind: 'azpr-verified-tuning-mark-generation',
    status: 'verified-tuning-mark-generation-ready',
    packageId: mechanicsPackage.packageId,
    packageHash: mechanicsPackage.packageHash,
    events,
    effectCommands,
    combatEvents,
    unresolved,
    initialState: createInitialTuningState(scenario, catalog),
    finalState: createPublishedTuningState(stateByMarkId, durationMs),
    summary: {
      profileCount: catalog.profiles.length,
      markEventCount: events.length,
      acquireEventCount: events.filter(event => event.kind === 'acquire')
        .length,
      consumeEventCount: events.filter(event => event.kind === 'consume')
        .length,
      expireEventCount: events.filter(event => event.kind === 'expire').length,
      effectCommandCount: effectCommands.length,
      combatEventCount: combatEvents.length,
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
        return [
          tuning
            ? [
                effect.tuningMark ? 'acquire' : 'consume',
                tuning.markId,
                tuning.packetElementId ?? tuning.stackElementId ?? '',
                effect.mapIndex,
                effect.trigger?.startFrame ?? '',
              ].join('|')
            : effect.effectIdentity,
          effect,
        ];
      })
    ).values(),
  ];
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
    state.heldReadyAtMs = nonNegativeNumber(inherited.heldReadyRemainingMs);
    for (const [index, source] of (inherited.layers ?? []).entries()) {
      if (state.layers.length >= state.profile.maxStacks) break;
      const remainingDurationMs = positiveNumberOrNull(
        source.remainingDurationMs
      );
      if (remainingDurationMs == null) continue;
      const layer = {
        id: `inherited|${state.profile.markId}|${index}`,
        acquiredAtMs: 0,
        expiresAtMs: remainingDurationMs,
        sourceActionId: source.sourceActionId ?? null,
        sourceActorId: source.sourceActorId ?? null,
        sourceIdentity: source.sourceIdentity ?? state.profile.sourceIdentity,
      };
      state.layers.push(layer);
      enqueue({
        kind: 'expire',
        timeMs: layer.expiresAtMs,
        profile: state.profile,
        layerId: layer.id,
        layer,
      });
    }
    if (state.layers.length > 0) {
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
  effectCommands,
  mechanicsPackage,
  scenario,
  enqueue,
}) {
  const state = stateByMarkId.get(Number(descriptor.profile?.markId));
  if (!state || state.layers.length >= state.profile.maxStacks) return;
  const before = state.layers.length;
  const layer = {
    id: `${descriptor.effect.effectIdentity}|layer`,
    acquiredAtMs: descriptor.timeMs,
    expiresAtMs: roundValue(descriptor.timeMs + state.profile.layerDurationMs),
    sourceActionId: descriptor.action.id,
    sourceActorId: descriptor.action.actorId,
    sourceIdentity: descriptor.effect.sourceIdentity,
  };
  state.layers.push(layer);
  sortLayers(state.layers);
  enqueue({
    kind: 'expire',
    timeMs: layer.expiresAtMs,
    profile: state.profile,
    layerId: layer.id,
    layer,
  });
  if (state.profile.key === 'wood' && before === 0) {
    schedulePeriodic(state, descriptor.timeMs + 5_000, enqueue);
  }
  const source = createDescriptorSource(descriptor);
  events.push(
    createMarkEvent({
      kind: 'acquire',
      descriptor,
      state,
      before,
      after: state.layers.length,
      delta: 1,
      layerIds: [layer.id],
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
    })
  );
}

function applyLayerExpiry({
  descriptor,
  stateByMarkId,
  events,
  effectCommands,
  mechanicsPackage,
  scenario,
}) {
  const state = stateByMarkId.get(Number(descriptor.profile?.markId));
  if (!state) return;
  const index = state.layers.findIndex(
    layer => layer.id === descriptor.layerId
  );
  if (index < 0) return;
  const before = state.layers.length;
  const [expired] = state.layers.splice(index, 1);
  events.push(
    createMarkEvent({
      kind: 'expire',
      descriptor,
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
}

function applyMarkConsumption({
  descriptor,
  stateByMarkId,
  events,
  effectCommands,
  combatEvents,
  unresolved,
  mechanicsPackage,
  scenario,
  enqueue,
}) {
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
  const consumedCount = Math.min(
    state.layers.length,
    maximum ?? state.layers.length
  );
  const before = state.layers.length;
  sortLayers(state.layers);
  const consumedLayers = state.layers.splice(0, consumedCount);
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
  combatEvents.push(
    createCombatEvent({
      kind: 'overlimit-damage',
      descriptor,
      profile: state.profile,
      markCount: consumedCount,
      template: state.profile.overlimitDamage.template,
    })
  );
  createOverlimitExtraCombatEvents({
    descriptor,
    profile: state.profile,
    consumedCount,
    combatEvents,
    unresolved,
    enqueue,
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
    events.push({
      schemaVersion: 1,
      sourceKind: 'azpr-verified-tuning-mark-event',
      status: 'verified-tuning-mark-held-trigger',
      eventIdentity: `tuning-held|${state.profile.markId}|${descriptor.timeMs}|${descriptor.hit?.hitIdentity}`,
      kind: 'held-trigger',
      type: 'VERIFIED_TUNING_MARK_HELD_TRIGGER',
      timeMs: descriptor.timeMs,
      frameIndex: Math.round((descriptor.timeMs * FRAME_RATE) / 1000),
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
      sourceIdentity: state.profile.sourceIdentity,
      appliedToCalculators: true,
      applied: true,
    });
  }
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

function createCombatEvent({ kind, descriptor, profile, markCount, template }) {
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-verified-tuning-combat-event',
    status: `verified-tuning-${kind}-ready`,
    kind,
    eventIdentity: [
      kind,
      descriptor.action?.id,
      profile.markId,
      template?.elementConfigId,
      descriptor.timeMs,
    ].join('|'),
    timeMs: roundValue(descriptor.timeMs),
    action: descriptor.action ?? null,
    actionId: descriptor.action?.id ?? null,
    actorId: descriptor.action?.actorId ?? null,
    resolution: descriptor.resolution ?? null,
    sourceHit: descriptor.hit ?? null,
    profile,
    markCount,
    template,
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
    sourceIdentity:
      descriptor.effect?.sourceIdentity ??
      descriptor.layer?.sourceIdentity ??
      state.profile.sourceIdentity,
    appliedToCalculators: true,
    applied: true,
  };
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

function resolveEffectTimeMs(action, effect, resolution) {
  const startFrame = Number(effect.trigger?.startFrame);
  const frameRate = Number(resolution.controlBinding?.frameRate ?? FRAME_RATE);
  if (!Number.isInteger(startFrame) || !(frameRate > 0)) return null;
  if (
    !isActionFrameWithinContextualOccupancy(action, startFrame, frameRate)
  ) {
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
    return {
      markId: profile.markId,
      profileKey: profile.key,
      elementName: profile.element,
      currentValue: (inherited?.layers ?? []).length,
      maxValue: profile.maxStacks,
      heldReadyRemainingMs: nonNegativeNumber(inherited?.heldReadyRemainingMs),
      layers: (inherited?.layers ?? []).map(layer => ({ ...layer })),
      valueUnit: 'mark-stacks',
    };
  });
}

function createPublishedTuningState(stateByMarkId, timeMs) {
  return [...stateByMarkId.values()].map(state => ({
    markId: state.profile.markId,
    profileKey: state.profile.key,
    elementName: state.profile.element,
    currentValue: state.layers.length,
    maxValue: state.profile.maxStacks,
    heldReadyRemainingMs: Math.max(0, state.heldReadyAtMs - timeMs),
    layers: state.layers.map(layer => ({
      remainingDurationMs: Math.max(0, layer.expiresAtMs - timeMs),
      sourceActionId: layer.sourceActionId,
      sourceActorId: layer.sourceActorId,
      sourceIdentity: layer.sourceIdentity,
    })),
    valueUnit: 'mark-stacks',
  }));
}

function sortLayers(layers) {
  layers.sort(
    (left, right) =>
      left.expiresAtMs - right.expiresAtMs || left.id.localeCompare(right.id)
  );
}

function compareGenerationDescriptors(left, right) {
  const priority = {
    expire: 0,
    acquire: 1,
    consume: 2,
    periodic: 3,
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
    String(left.eventIdentity ?? left.id ?? '').localeCompare(
      String(right.eventIdentity ?? right.id ?? '')
    )
  );
}

function createUnavailableGeneration(reason) {
  return {
    schemaVersion: 1,
    contractName: VERIFIED_TUNING_MARK_GENERATION_CONTRACT_NAME,
    sourceKind: 'azpr-verified-tuning-mark-generation',
    status: reason,
    events: [],
    effectCommands: [],
    combatEvents: [],
    unresolved: [],
    initialState: [],
    finalState: [],
    summary: {
      profileCount: 0,
      markEventCount: 0,
      effectCommandCount: 0,
      combatEventCount: 0,
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
