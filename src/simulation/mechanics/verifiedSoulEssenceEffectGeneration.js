import soulEssenceEffectCatalog from '../../data/generated/soulessence-effect-mechanics.json';
import {
  EFFECT_OPERATIONS,
  EFFECT_STACK_MODES,
  EFFECT_TARGET_KINDS,
} from '../../domain/projectSchema';
import {
  compareSourceSequencePaths,
  getActionSourceSequencePath,
} from '../../domain/actionSourceSequence';
import { evaluateVerifiedBattleEffectFormula } from './verifiedBattleEffectFormulaRuntime';
import { resolveControlledActorAt } from '../runtime/controlledActorTimeline';

export const VERIFIED_SOULESSENCE_EFFECT_GENERATION_CONTRACT_NAME =
  'AzPrVerifiedSoulEssenceEffectGeneration';

const SOULESSENCE_TRIGGER_OPERATOR_REGISTRY = Object.freeze({
  'action-start': resolveActionTriggerOccurrence,
  'action-end': resolveActionTriggerOccurrence,
  'hit-before-damage': resolveDamageTriggerOccurrences,
  'hit-after-damage': resolveDamageTriggerOccurrences,
  'element-before-acquire': resolveGetElementTriggerOccurrences,
  'element-after-acquire': resolveGetElementTriggerOccurrences,
  'switch-enter': resolveNonDamageTriggerOccurrences,
  'shield-after-acquire': resolveNonDamageTriggerOccurrences,
  'heal-after-settlement': resolveNonDamageTriggerOccurrences,
});

export function createVerifiedSoulEssenceEffectGeneration({
  scenario = {},
  actionExecutionPlan = null,
  actionResolutionById = null,
  tuningGeneration = null,
  damageEventGeneration = null,
  nonDamageEventGeneration = null,
  controlledActorTimeline = null,
  catalog = soulEssenceEffectCatalog,
} = {}) {
  const executionByActionId = new Map(
    (actionExecutionPlan?.actions ?? []).map(entry => [entry.actionId, entry])
  );
  const definitionBySoulId = new Map(
    (catalog?.definitions ?? [])
      .filter(
        definition =>
          definition.runtimeStatus === 'runtime-applied' &&
          ((definition.trigger != null &&
            (definition.effect != null ||
              definition.immediateEffects?.length > 0)) ||
            (definition.persistentRoot?.activationMode ===
              'periodic-conditional-finite-leaf' &&
              definition.persistentRoot?.effects?.length > 0))
      )
      .map(definition => [Number(definition.soulEssenceId), definition])
  );
  const definitionBySetKey = new Map(
    (catalog?.setSkillDefinitions ?? [])
      .filter(
        definition =>
          definition.runtimeStatus === 'runtime-applied' &&
          definition.trigger != null &&
          (definition.effect != null || definition.immediateEffects?.length > 0)
      )
      .map(definition => [
        `${Number(definition.setId)}:${Number(definition.pieces)}`,
        definition,
      ])
  );
  const bindings = (scenario.actors ?? [])
    .flatMap((actor, actorIndex) => [
      createEquippedSoulBinding(actor, actorIndex, definitionBySoulId),
      ...createEquippedSetSkillBindings(actor, actorIndex, definitionBySetKey),
    ])
    .filter(Boolean);
  const effectCommands = [];
  const directSpEvents = [];
  const directHpEvents = [];
  const suppressions = [];
  const unresolved = [];
  const periodicRootStates = [];

  for (const binding of bindings) {
    const periodicBinding = isPeriodicPersistentPropertyBinding(binding);
    const hasPropertyEffect =
      binding.definition.effect != null || periodicBinding;
    const propertyFormulaResults = binding.propertyFormulaResults ?? [];
    if (
      hasPropertyEffect &&
      (propertyFormulaResults.length === 0 ||
        propertyFormulaResults.some(entry => !entry.starValue))
    ) {
      unresolved.push({
        actorId: binding.actor.id,
        ...createBindingDiagnosticIdentity(binding),
        status: 'soulessence-effect-runtime-unresolved',
        reasons: ['soulessence-effect-star-value-unresolved'],
        sourceIdentity: binding.definition.sourceIdentity,
      });
      continue;
    }
    const unresolvedFormula = propertyFormulaResults.find(
      entry => entry.formulaResult?.applied !== true
    );
    if (hasPropertyEffect && unresolvedFormula) {
      unresolved.push({
        actorId: binding.actor.id,
        ...createBindingDiagnosticIdentity(binding),
        status: 'soulessence-effect-runtime-unresolved',
        reasons: [
          unresolvedFormula.formulaResult?.reason ??
            'soulessence-effect-formula-evaluation-unresolved',
        ],
        sourceIdentity: binding.definition.sourceIdentity,
      });
      continue;
    }
    if (periodicBinding) {
      const periodic = createPeriodicPersistentPropertyArtifacts({
        binding,
        scenario,
        tuningGeneration,
        catalog,
      });
      effectCommands.push(...periodic.effectCommands);
      suppressions.push(...periodic.suppressions);
      unresolved.push(...periodic.unresolved);
      periodicRootStates.push(periodic.state);
      continue;
    }
    const frameAnchor = binding.definition.trigger.frameAnchor;
    const nonDamageTrigger = isNonDamageTriggerAnchor(frameAnchor);
    const occurrenceSources = [
      ...(scenario.actions ?? []).map((action, actionIndex) => ({
        action,
        actionIndex,
        actionless: false,
      })),
      ...(nonDamageTrigger
        ? [{ action: null, actionIndex: null, actionless: true }]
        : []),
    ];
    for (const { action, actionIndex, actionless } of occurrenceSources) {
      if (
        !actionless &&
        !nonDamageTrigger &&
        String(action.actorId) !== String(binding.actor.id)
      ) {
        continue;
      }
      if (!actionless && executionByActionId.get(action.id)?.execute !== true) {
        continue;
      }
      const resolution = actionless
        ? null
        : (actionResolutionById?.get?.(action.id) ?? null);
      const triggerOperator =
        SOULESSENCE_TRIGGER_OPERATOR_REGISTRY[frameAnchor];
      const rawOccurrences = actionless
        ? resolveActionlessNonDamageTriggerOccurrences({
            nonDamageEventGeneration,
            frameAnchor,
            controlledActorTimeline,
          })
        : triggerOperator?.({
            action,
            actionIndex,
            resolution,
            scenario,
            tuningGeneration,
            damageEventGeneration,
            nonDamageEventGeneration,
            controlledActorTimeline,
            frameAnchor,
          });
      const occurrences = (rawOccurrences ?? []).filter(
        occurrence =>
          !nonDamageTrigger ||
          matchesNonDamageTriggerObserver(binding, occurrence.eventContext)
      );
      if (occurrences.length === 0) {
        suppressions.push({
          actionId: action?.id ?? null,
          actorId: binding.actor.id,
          ...createBindingDiagnosticIdentity(binding),
          reason: triggerOperator
            ? resolveEmptyTriggerOccurrenceReason(
                frameAnchor,
                rawOccurrences?.length > 0
              )
            : 'soulessence-effect-trigger-operator-unavailable',
          triggerFrameAnchor: frameAnchor,
        });
        continue;
      }
      const matchedOccurrences = occurrences
        .map(occurrence => {
          const actionContext = resolveSoulTriggerActionContext({
            action,
            resolution,
            eventContext: occurrence.eventContext,
          });
          return {
            ...occurrence,
            actionContext,
            conditionMatch: matchesSoulTriggerCondition(
              binding.definition.trigger?.condition,
              actionContext,
              occurrence.eventContext
            ),
          };
        })
        .filter(occurrence => occurrence.conditionMatch.matched);
      if (matchedOccurrences.length === 0) {
        const actionContext = resolveSoulTriggerActionContext({
          action,
          resolution,
          eventContext: occurrences[0]?.eventContext,
        });
        suppressions.push({
          actionId: action?.id ?? null,
          actorId: binding.actor.id,
          ...createBindingDiagnosticIdentity(binding),
          reason: 'soulessence-effect-action-kind-condition-not-matched',
          expectedActionKinds:
            binding.definition.trigger?.condition?.actionKinds ?? [],
          actualActionKind: actionContext.actionKind,
          expectedCondition: binding.definition.trigger?.condition ?? null,
          actualSkillSlotIds: actionContext.skillSlotIds,
          actualSkillTagIds: actionContext.skillTagIds,
          conditionReasons: occurrences.map(occurrence => {
            const occurrenceActionContext = resolveSoulTriggerActionContext({
              action,
              resolution,
              eventContext: occurrence.eventContext,
            });
            return {
              eventIdentity: occurrence.eventContext?.eventIdentity ?? null,
              reasons: matchesSoulTriggerCondition(
                binding.definition.trigger?.condition,
                occurrenceActionContext,
                occurrence.eventContext
              ).reasons,
            };
          }),
        });
        continue;
      }
      if (binding.definition.effect != null) {
        effectCommands.push(
          ...matchedOccurrences.flatMap(occurrence =>
            resolveSoulEffectTargets({
              binding,
              scenario,
              occurrence,
            }).map((target, targetIndex) =>
              createSoulEffectCommand({
                binding,
                action,
                actionIndex,
                actionKind: occurrence.actionContext.actionKind,
                actionContext: occurrence.actionContext,
                conditionMatch: occurrence.conditionMatch,
                resolution,
                occurrence,
                target,
                targetIndex,
                catalog,
              })
            )
          )
        );
      }
      for (const occurrence of matchedOccurrences) {
        const immediate = createSoulImmediateEvents({
          binding,
          action,
          actionIndex,
          resolution,
          occurrence,
          scenario,
          catalog,
        });
        directSpEvents.push(...immediate.directSpEvents);
        directHpEvents.push(...immediate.directHpEvents);
      }
    }
  }

  const gated = applySoulTriggerIntervalGates({
    effectCommands,
    directSpEvents,
    directHpEvents,
    suppressions,
  });

  return {
    schemaVersion: 1,
    contractName: VERIFIED_SOULESSENCE_EFFECT_GENERATION_CONTRACT_NAME,
    kind: 'azpr-verified-soulessence-effect-generation',
    status: unresolved.length
      ? 'verified-soulessence-effect-generation-partial'
      : 'verified-soulessence-effect-generation-ready',
    catalogHash: catalog?.catalogHash ?? null,
    effectCommands: gated.effectCommands,
    directSpEvents: gated.directSpEvents,
    directHpEvents: gated.directHpEvents,
    triggerIntervalStates: gated.triggerIntervalStates,
    triggerCounterStates: gated.triggerCounterStates,
    periodicRootStates,
    acceptedTriggerOccurrences: gated.acceptedTriggerOccurrences,
    suppressions,
    unresolved,
    summary: {
      equippedBindingCount: bindings.length,
      effectCommandCount: gated.effectCommands.length,
      directSpEventCount: gated.directSpEvents.length,
      directHpEventCount: gated.directHpEvents.length,
      triggerCounterStateCount: gated.triggerCounterStates.length,
      periodicRootStateCount: periodicRootStates.length,
      suppressionCount: suppressions.length,
      unresolvedCount: unresolved.length,
    },
  };
}

function resolveActionTriggerOccurrence({
  action,
  actionIndex,
  tuningGeneration,
  frameAnchor,
  controlledActorTimeline,
}) {
  const actionSourceSequencePath = action
    ? (getActionSourceSequencePath(action, actionIndex) ?? [actionIndex])
    : null;
  const timeMs = roundRuntimeTime(
    Number(action.startMs) +
      (frameAnchor === 'action-end' ? Number(action.durationMs) : 0)
  );
  const triggerSequencePath = [
    ...actionSourceSequencePath,
    frameAnchor === 'action-start' ? 0 : Number.MAX_SAFE_INTEGER - 1,
  ];
  return [
    {
      hit: null,
      tuningEvent: null,
      timeMs,
      triggerSequencePath,
      eventContext: {
        eventIdentity: `${frameAnchor}|${action.id}|${timeMs}`,
        eventKind: frameAnchor,
        timeMs,
        absoluteFrame: Math.round((timeMs * 60) / 1000),
        sourceSequencePath: triggerSequencePath,
        heldElementIds: resolveHeldTuningElementIdsAt({
          tuningGeneration,
          timeMs,
          frameAnchor,
        }),
        elementId: null,
        elementTypes: [],
        targetElementIds: [],
        landed: null,
        controlledActorId:
          resolveControlledActorAt(controlledActorTimeline, timeMs, {
            sourceSequencePath: actionSourceSequencePath,
          })?.actorId ?? null,
      },
    },
  ];
}

function resolveEmptyTriggerOccurrenceReason(frameAnchor, subjectMismatch) {
  if (isNonDamageTriggerAnchor(frameAnchor)) {
    return subjectMismatch
      ? 'soulessence-effect-non-damage-event-subject-not-matched'
      : 'soulessence-effect-no-source-non-damage-transaction';
  }
  if (String(frameAnchor).startsWith('hit-')) {
    return 'soulessence-effect-no-landed-source-hit';
  }
  if (String(frameAnchor).startsWith('element-')) {
    return 'soulessence-effect-no-source-get-element-transaction';
  }
  return 'soulessence-effect-action-occurrence-unavailable';
}

function resolveNonDamageTriggerOccurrences({
  action,
  nonDamageEventGeneration,
  frameAnchor,
}) {
  return (nonDamageEventGeneration?.events ?? [])
    .filter(event => String(event.actionId) === String(action.id))
    .filter(event => event.kind === frameAnchor)
    .filter(
      event =>
        event.applied === true &&
        event.eventContext?.applied === true &&
        event.eventContext?.success === true &&
        event.eventContext?.initialState !== true
    )
    .map(projectNonDamageTriggerOccurrence);
}

function resolveActionlessNonDamageTriggerOccurrences({
  nonDamageEventGeneration,
  frameAnchor,
}) {
  return (nonDamageEventGeneration?.events ?? [])
    .filter(event => event.actionId === null)
    .filter(event => event.kind === frameAnchor)
    .filter(isVerifiedActionlessNonDamageEvent)
    .map(projectNonDamageTriggerOccurrence);
}

function isVerifiedActionlessNonDamageEvent(event) {
  const context = event?.eventContext;
  return (
    event?.applied === true &&
    context?.applied === true &&
    context?.success === true &&
    context?.initialState !== true &&
    context?.actionProvenanceAvailable === false &&
    context?.sourceActionId === null &&
    typeof event.eventIdentity === 'string' &&
    event.eventIdentity.length > 0 &&
    context.eventIdentity === event.eventIdentity &&
    Array.isArray(event.sourceSequencePath) &&
    event.sourceSequencePath.length > 0 &&
    event.sourceSequencePath.every(Number.isSafeInteger) &&
    Array.isArray(context.sourceSequencePath) &&
    compareSourceSequencePaths(
      event.sourceSequencePath,
      context.sourceSequencePath
    ) === 0 &&
    String(event.actorId ?? '') === String(context.sourceActorId ?? '') &&
    String(event.targetId ?? '') === String(context.eventTargetActorId ?? '')
  );
}

function projectNonDamageTriggerOccurrence(event) {
  return {
    hit: null,
    tuningEvent: null,
    nonDamageEvent: event,
    timeMs: Number(event.timeMs),
    triggerSequencePath: event.sourceSequencePath,
    eventContext: event.eventContext,
  };
}

function resolveGetElementTriggerOccurrences({
  action,
  tuningGeneration,
  frameAnchor,
}) {
  return (tuningGeneration?.getElementEvents ?? [])
    .filter(event => String(event.actionId) === String(action.id))
    .filter(event => String(event.actorId) === String(action.actorId))
    .filter(event => event.kind === frameAnchor)
    .filter(
      event =>
        event.applied === true &&
        event.eventContext?.applied === true &&
        event.eventContext?.success === true &&
        event.eventContext?.initialState !== true
    )
    .map(event => ({
      hit: null,
      tuningEvent: event,
      timeMs: Number(event.timeMs),
      triggerSequencePath: event.eventContext.sourceSequencePath,
      eventContext: event.eventContext,
    }));
}

function resolveDamageTriggerOccurrences({
  action,
  damageEventGeneration,
  frameAnchor,
}) {
  return (damageEventGeneration?.events ?? [])
    .filter(event => String(event.actionId) === String(action.id))
    .filter(event => String(event.actorId) === String(action.actorId))
    .filter(event => event.kind === frameAnchor)
    .filter(event => event.eventContext?.landed === true)
    .map(event => ({
      hit: event.hit ?? null,
      tuningEvent: event.tuningEvent ?? null,
      timeMs: Number(event.timeMs),
      triggerSequencePath: event.sourceSequencePath,
      eventContext: event.eventContext,
    }));
}

function createEquippedSoulBinding(actor, actorIndex, definitionBySoulId) {
  const soulEssenceId = Number(actor?.loadout?.soulessenceId);
  if (!Number.isInteger(soulEssenceId) || soulEssenceId <= 0) return null;
  const definition = definitionBySoulId.get(soulEssenceId);
  if (!definition) return null;
  const effectSkill =
    actor.loadout?.soulessenceCultivation?.effectSkill ?? null;
  if (
    effectSkill?.runtimeStatus !== 'runtime-applied' ||
    Number(effectSkill.skillId) !== Number(definition.effectSkillId)
  ) {
    return null;
  }
  const star = Number(effectSkill.star);
  const propertyEffects =
    definition.persistentRoot?.activationMode ===
    'periodic-conditional-finite-leaf'
      ? (definition.persistentRoot.effects ?? [])
      : [definition.effect].filter(Boolean);
  const propertyFormulaResults = propertyEffects.map(effect => {
    const starValue = effect.valuesByStar?.find(
      row => Number(row.star) === star
    );
    return {
      effect,
      starValue: starValue ?? null,
      formulaResult: starValue
        ? evaluateSoulEffectFormula({
            definition,
            effect,
            starValue,
            star,
            actor,
          })
        : null,
    };
  });
  const primary = propertyFormulaResults[0] ?? {};
  return {
    actor,
    actorIndex,
    ownerKind: 'soul-essence',
    ownerIdentity: `soulessence:${soulEssenceId}`,
    soulEssenceId,
    definition,
    star: Number.isInteger(star) ? star : null,
    starValue: primary.starValue ?? null,
    formulaResult: primary.formulaResult ?? null,
    propertyFormulaResults,
    cultivationSourceIdentity: effectSkill?.sourceIdentity ?? null,
  };
}

function createEquippedSetSkillBindings(
  actor,
  actorIndex,
  definitionBySetKey
) {
  return (actor?.verifiedStaticProperties?.setSkillActivations ?? [])
    .filter(
      activation =>
        activation?.thresholdMet === true &&
        activation?.appliedToRuntimeEffect === true
    )
    .map(activation => {
      const key = `${Number(activation.setId)}:${Number(activation.pieces)}`;
      const definition = definitionBySetKey.get(key);
      if (!definition) return null;
      const propertyEffects =
        definition.effect?.propertyEffects?.length > 0
          ? definition.effect.propertyEffects
          : [definition.effect];
      const propertyFormulaResults = propertyEffects.map(effect => {
        const starValue = effect?.valuesByStar?.find(
          row => Number(row.star) === 1
        ) ?? {
          star: 1,
          valueRaw: Number(effect?.sourceRawA),
          sourceIdentity: `${effect?.sourceIdentity}.formulaParams.formulaParamValues[0]`,
        };
        return {
          effect,
          starValue,
          formulaResult: Number.isFinite(Number(starValue.valueRaw))
            ? evaluateSoulEffectFormula({
                definition,
                effect,
                starValue,
                star: 1,
                actor,
              })
            : null,
        };
      });
      const primary = propertyFormulaResults[0] ?? {};
      return {
        actor,
        actorIndex,
        ownerKind: 'set-skill',
        ownerIdentity: `set-skill:${activation.setId}:${activation.pieces}`,
        setId: Number(activation.setId),
        pieces: Number(activation.pieces),
        setSkillId: Number(activation.skillId),
        definition,
        star: 1,
        starValue: primary.starValue ?? null,
        formulaResult: primary.formulaResult ?? null,
        propertyFormulaResults,
        cultivationSourceIdentity: activation.sourceIdentity ?? null,
      };
    })
    .filter(Boolean);
}

function isPeriodicPersistentPropertyBinding(binding) {
  return (
    binding?.ownerKind === 'soul-essence' &&
    binding.definition?.persistentRoot?.activationMode ===
      'periodic-conditional-finite-leaf'
  );
}

function createPeriodicPersistentPropertyArtifacts({
  binding,
  scenario,
  tuningGeneration,
  catalog,
}) {
  const root = binding.definition.persistentRoot;
  const activation = root.periodicActivation;
  const frameRate = positiveNumber(scenario?.time?.fps, 60);
  const durationMs = Math.max(0, Number(scenario?.time?.durationMs) || 0);
  const intervalMs = Number(activation?.intervalMs);
  const rootElementId = Number(root.installation?.rootElementId);
  const effectCommands = [];
  const suppressions = [];
  const unresolved = [];
  const tickFrames = [];

  if (
    Number(activation?.triggerType) !== 0 ||
    Number(activation?.timeTriggerType) !== 1 ||
    activation?.timeExecuteFirstFrame !== true ||
    !(intervalMs > 0) ||
    activation?.conditionLogic !== 'and' ||
    !['self-actor', 'self-kibo'].includes(activation?.target?.kind)
  ) {
    unresolved.push({
      actorId: binding.actor.id,
      ...createBindingDiagnosticIdentity(binding),
      status: 'soulessence-effect-runtime-unresolved',
      reasons: ['soulessence-periodic-root-contract-invalid'],
      sourceIdentity: root.sourceIdentity,
    });
    return {
      effectCommands,
      suppressions,
      unresolved,
      state: createPeriodicRootState({
        binding,
        activation,
        rootElementId,
        tickFrames,
        frameRate,
      }),
    };
  }

  const target = resolvePeriodicPersistentPropertyTarget(binding, activation);
  const horizonFrame = Math.floor((durationMs * frameRate) / 1000);
  for (let tickOrdinal = 0; ; tickOrdinal += 1) {
    const thresholdMs = tickOrdinal * intervalMs;
    const absoluteFrame =
      Math.floor((thresholdMs * frameRate) / 1000) + 1;
    if (absoluteFrame > horizonFrame) break;
    const timeMs = roundRuntimeTime((absoluteFrame * 1000) / frameRate);
    tickFrames.push(absoluteFrame);
    const sourceSequencePath = createPeriodicPersistentPropertySourceSequencePath({
      binding,
      root,
      tickOrdinal,
    });
    const condition = evaluatePeriodicPersistentPropertyConditions({
      conditions: activation.conditions,
      tuningGeneration,
      timeMs,
    });
    if (!condition.matched) {
      suppressions.push({
        actionId: null,
        actorId: binding.actor.id,
        ...createBindingDiagnosticIdentity(binding),
        reason: 'soulessence-periodic-root-condition-not-matched',
        timeMs,
        absoluteFrame,
        tickOrdinal,
        conditionResults: condition.results,
        sourceSequencePath,
      });
      continue;
    }
    if (!target) {
      suppressions.push({
        actionId: null,
        actorId: binding.actor.id,
        ...createBindingDiagnosticIdentity(binding),
        reason: 'soulessence-periodic-root-target-unavailable',
        timeMs,
        absoluteFrame,
        tickOrdinal,
        sourceSequencePath,
      });
      continue;
    }
    for (const [effectIndex, entry] of (
      binding.propertyFormulaResults ?? []
    ).entries()) {
      effectCommands.push(
        createPeriodicPersistentPropertyEffectCommand({
          binding,
          root,
          activation,
          entry,
          target,
          timeMs,
          absoluteFrame,
          tickOrdinal,
          effectIndex,
          sourceSequencePath: [...sourceSequencePath, effectIndex],
          condition,
          catalog,
        })
      );
    }
  }

  return {
    effectCommands,
    suppressions,
    unresolved,
    state: createPeriodicRootState({
      binding,
      activation,
      rootElementId,
      tickFrames,
      frameRate,
    }),
  };
}

function createPeriodicRootState({
  binding,
  activation,
  rootElementId,
  tickFrames,
  frameRate,
}) {
  return {
    bindingKey: `${binding.actor.id}|${binding.ownerIdentity}|root:${rootElementId}`,
    actorId: String(binding.actor.id),
    ownerIdentity: binding.ownerIdentity,
    rootElementId,
    intervalMs: Number(activation?.intervalMs),
    intervalFrames: Math.round(
      (Number(activation?.intervalMs) * frameRate) / 1000
    ),
    timeExecuteFirstFrame: activation?.timeExecuteFirstFrame === true,
    tickFrames,
    lastTickFrame: tickFrames.at(-1) ?? null,
    nextTickFrame:
      tickFrames.length === 0
        ? 1
        : tickFrames.at(-1) +
          Math.round((Number(activation?.intervalMs) * frameRate) / 1000),
    sourceIdentity: activation?.sourceIdentity ?? null,
  };
}

function resolvePeriodicPersistentPropertyTarget(binding, activation) {
  if (activation.target.kind === 'self-actor') {
    return {
      kind: EFFECT_TARGET_KINDS.ACTOR,
      id: binding.actor.id,
      name: binding.actor.name ?? null,
      kiboId: null,
    };
  }
  const kiboId = Number(binding.actor?.loadout?.kiboId);
  if (activation.target.kind !== 'self-kibo' || !(kiboId > 0)) return null;
  return {
    kind: EFFECT_TARGET_KINDS.KIBO,
    id: binding.actor.id,
    name: `Kibo ${kiboId}`,
    kiboId,
  };
}

function createPeriodicPersistentPropertySourceSequencePath({
  binding,
  root,
  tickOrdinal,
}) {
  return [
    Number.MAX_SAFE_INTEGER - 64,
    Number(binding.actorIndex),
    1,
    Number(root.installation.rootElementId),
    Number(tickOrdinal),
  ];
}

function evaluatePeriodicPersistentPropertyConditions({
  conditions,
  tuningGeneration,
  timeMs,
}) {
  const results = (conditions ?? []).map(condition => {
    const markCount = resolveTuningMarkCountAt({
      tuningGeneration,
      markId: Number(condition.markElementId),
      timeMs,
    });
    if (condition.kind === 'self-has-element-id') {
      return { condition, markCount, matched: markCount > 0 };
    }
    if (condition.kind === 'self-element-layer-formula') {
      return {
        condition,
        markCount,
        matched: markCount > Number(condition.strictThreshold),
      };
    }
    return { condition, markCount, matched: false };
  });
  return {
    matched: results.every(result => result.matched),
    results,
  };
}

function resolveTuningMarkCountAt({ tuningGeneration, markId, timeMs }) {
  let count = Number(
    (tuningGeneration?.initialState ?? []).find(
      row => Number(row.markId) === Number(markId)
    )?.currentValue
  ) || 0;
  for (const event of tuningGeneration?.events ?? []) {
    if (
      Number(event.markId) === Number(markId) &&
      Number(event.timeMs) <= Number(timeMs)
    ) {
      count = Number(event.after) || 0;
    }
  }
  return count;
}

function createPeriodicPersistentPropertyEffectCommand({
  binding,
  root,
  activation,
  entry,
  target,
  timeMs,
  absoluteFrame,
  tickOrdinal,
  effectIndex,
  sourceSequencePath,
  condition,
  catalog,
}) {
  const effect = entry.effect;
  const formulaResult = entry.formulaResult;
  const effectIdentity = `soulessence:${binding.soulEssenceId}:element:${effect.elementId}`;
  const occurrenceIdentity = `${binding.ownerIdentity}|root:${root.installation.rootElementId}|tick:${tickOrdinal}`;
  return {
    id: `${occurrenceIdentity}|effect:${effect.elementId}|target:${target.kind}:${target.id}`,
    sourceActionId: null,
    sourceActionName: null,
    sourceActorId: binding.actor.id,
    sourceActorName: binding.actor.name ?? null,
    sourceSoulEssenceId: binding.soulEssenceId,
    sourceKiboId: null,
    targetKiboId: target.kiboId,
    effectId: effectIdentity,
    effectName: `${binding.definition.name}-${effect.name ?? effect.elementId}`,
    operation: EFFECT_OPERATIONS.APPLY,
    targetKind: target.kind,
    targetId: String(target.id),
    targetName: target.name,
    semanticTargetKind: activation.target.kind,
    timeMs,
    absoluteFrame,
    durationMs: effect.durationMs,
    stackMode: EFFECT_STACK_MODES.REFRESH,
    stackDelta: 1,
    maxStacks: 1,
    tags: [
      'soulessence-effect',
      'periodic-persistent-property-root',
      binding.ownerIdentity,
      `skill:${binding.definition.effectSkillId}`,
    ],
    sourceStatus: 'verified-loadout-effect-generated',
    confidence: 'high',
    trackingStatus: 'applied',
    generatedVerified: true,
    appliedToCalculators: true,
    formulaSourceActorId: binding.actor.id,
    effectAdderActorId: binding.actor.id,
    triggerSourceSequencePath: sourceSequencePath,
    modifiers: [
      {
        kind: 'battle-property',
        attributeId: effect.attributeId,
        bucket: effect.bucket,
        valueRaw: formulaResult.value,
        value: formulaResult.value,
        sourceRawA: formulaResult.sourceRawA,
        evaluatedValue: formulaResult.evaluatedValue,
        formulaIdentity: formulaResult.formulaIdentity,
        formulaResult,
        sourceElementId: effect.elementId,
        sourceElementPathId: effect.pathId,
        propertyTags: [...(effect.propertyTags ?? [])],
        propertyTagMatchMode: effect.propertyTagMatchMode ?? 'unscoped',
        propertyTagSourceIdentity: effect.propertyTagSourceIdentity ?? null,
        sourceIdentity: effect.sourceIdentity,
      },
    ],
    sourceIdentity: {
      packageId: catalog?.kind ?? soulEssenceEffectCatalog.kind,
      catalogKind: catalog?.kind ?? soulEssenceEffectCatalog.kind,
      catalogHash: catalog?.catalogHash ?? soulEssenceEffectCatalog.catalogHash,
      effectIdentity,
      soulEssenceId: binding.soulEssenceId,
      effectSkillId: binding.definition.effectSkillId,
      actionBindingIdentity: root.installation.sourceIdentity,
      triggerElementId: root.installation.rootElementId,
      triggerPathId: root.installation.rootPathId,
      triggerEvent: 'PeriodicPropertyTick',
      frameAnchor: 'periodic-root-update',
      triggerSequencePath: sourceSequencePath,
      sameFrameVisibility: 'strict-source-sequence',
      triggerOccurrenceIdentity: occurrenceIdentity,
      tickOrdinal,
      absoluteFrame,
      triggerCondition: activation.conditions,
      conditionResults: condition.results,
      effectElementId: effect.elementId,
      effectPathId: effect.pathId,
      propertyFormulaResults: [
        {
          effectElementId: effect.elementId,
          effectPathId: effect.pathId,
          attributeId: effect.attributeId,
          starValueSourceIdentity: entry.starValue.sourceIdentity,
          formulaIdentity: formulaResult.formulaIdentity,
          formulaSourceIdentity: effect.formula.sourceIdentity ?? null,
          sourceRawA: formulaResult.sourceRawA,
          evaluatedValue: formulaResult.evaluatedValue,
          sourceIdentity: effect.sourceIdentity,
        },
      ],
      lifecycle: root.lifecycle,
      periodicActivation: activation,
      star: binding.star,
      starValueSourceIdentity: entry.starValue.sourceIdentity,
      formulaIdentity: formulaResult.formulaIdentity,
      sourceRawA: formulaResult.sourceRawA,
      evaluatedValue: formulaResult.evaluatedValue,
      targetIdentity: {
        targetKind: activation.target.kind,
        targetId: String(target.id),
        targetKiboId: target.kiboId,
        sourceIdentity: activation.target.sourceIdentity,
      },
      cultivationSourceIdentity: binding.cultivationSourceIdentity,
      provenance: [binding.definition.sourceIdentity],
    },
  };
}

function createBindingDiagnosticIdentity(binding) {
  return binding.ownerKind === 'set-skill'
    ? {
        setId: binding.setId,
        setPieces: binding.pieces,
        setSkillId: binding.setSkillId,
      }
    : {
        soulEssenceId: binding.soulEssenceId,
        effectSkillId: binding.definition.effectSkillId,
      };
}

function createSoulEffectCommand({
  binding,
  action,
  actionIndex,
  actionKind,
  actionContext,
  conditionMatch,
  resolution,
  occurrence,
  target,
  targetIndex,
  catalog,
}) {
  const { definition, actor } = binding;
  const propertyFormulaResults = binding.propertyFormulaResults ?? [];
  const primaryPropertyFormula = propertyFormulaResults[0] ?? {};
  const starValue = primaryPropertyFormula.starValue ?? binding.starValue;
  const formulaResult =
    primaryPropertyFormula.formulaResult ?? binding.formulaResult;
  const effect = definition.effect;
  const frameAnchor = definition.trigger.frameAnchor;
  const hit = occurrence?.hit ?? null;
  const tuningEvent = occurrence?.tuningEvent ?? null;
  const eventContext = occurrence?.eventContext ?? null;
  const frameRate = positiveNumber(resolution?.controlBinding?.frameRate, 60);
  const hitFrame = hit == null ? null : Number(hit.trigger?.startFrame);
  const timeMs = Number.isFinite(Number(occurrence?.timeMs))
    ? roundRuntimeTime(occurrence.timeMs)
    : roundRuntimeTime(
        Number(action.startMs) +
          (frameAnchor === 'action-end'
            ? Number(action.durationMs)
            : frameAnchor === 'hit-before-damage' ||
                frameAnchor === 'hit-after-damage'
              ? (hitFrame * 1000) / frameRate
              : 0)
      );
  const actionSourceSequencePath = getActionSourceSequencePath(
    action,
    actionIndex
  ) ?? [actionIndex];
  const occurrenceSequencePath = Array.isArray(occurrence?.triggerSequencePath)
    ? occurrence.triggerSequencePath
    : hit == null
      ? (actionSourceSequencePath ?? [])
      : [...actionSourceSequencePath, Number(hit.hitIndex)];
  const triggerSequencePath = [...occurrenceSequencePath, targetIndex];
  const isSetSkill = binding.ownerKind === 'set-skill';
  const effectIdentity = isSetSkill
    ? `set-skill:${binding.setId}:${binding.pieces}:element:${effect.elementId}`
    : `soulessence:${binding.soulEssenceId}:element:${effect.elementId}`;
  const sourceNonDamageEventIdentity =
    occurrence?.nonDamageEvent?.eventIdentity ?? null;
  const sourceActionId = action?.id ?? null;
  const commandSourceIdentity =
    sourceActionId ?? sourceNonDamageEventIdentity ?? 'actionless-unresolved';
  return {
    id: `${isSetSkill ? `set-skill|${binding.setId}|${binding.pieces}` : `soulessence|${binding.soulEssenceId}`}|${commandSourceIdentity}|${effect.elementId}|${frameAnchor}|target:${target.id}${hit == null ? '' : `|hit:${hit.hitIndex}`}${tuningEvent == null ? '' : `|tuning:${tuningEvent.eventIdentity}`}${sourceNonDamageEventIdentity == null ? '' : `|event:${sourceNonDamageEventIdentity}`}`,
    sourceActionId,
    sourceActionName: action?.name ?? null,
    sourceActorId: actor.id,
    sourceActorName: actor.name,
    ...(isSetSkill
      ? {
          sourceSetId: binding.setId,
          sourceSetPieces: binding.pieces,
          sourceSetSkillId: binding.setSkillId,
        }
      : { sourceSoulEssenceId: binding.soulEssenceId }),
    sourceHitIdentity:
      eventContext?.sourceHitIdentity ?? hit?.sourceIdentity ?? null,
    sourceHitIndex: eventContext?.sourceHitIndex ?? hit?.hitIndex ?? null,
    sourceHitElementId: eventContext?.damageElementId ?? hit?.elementId ?? null,
    sourceTuningEventIdentity: tuningEvent?.eventIdentity ?? null,
    sourceNonDamageEventIdentity,
    effectId: effectIdentity,
    effectName: `${definition.name ?? `set-${binding.setId}-${binding.pieces}-piece`}-${effect.name ?? effect.elementId}`,
    operation: EFFECT_OPERATIONS.APPLY,
    targetKind: target.kind,
    targetId: String(target.id),
    targetName: target.name ?? null,
    semanticTargetKind: definition.trigger.target?.kind ?? 'self-actor',
    triggerType: definition.trigger.triggerType ?? null,
    triggerCounter: definition.trigger.triggerCounter ?? null,
    timeMs,
    durationMs: effect.durationMs,
    stackMode: normalizeStackMode(effect.stackMode),
    stackDelta: effect.stackDelta,
    maxStacks: effect.maxStacks,
    tags: [
      isSetSkill ? 'set-skill-effect' : 'soulessence-effect',
      definition.mechanismFamily,
      binding.ownerIdentity,
      `skill:${isSetSkill ? binding.setSkillId : definition.effectSkillId}`,
      actionKind == null ? 'actionless-event' : `action-kind:${actionKind}`,
    ],
    sourceStatus: 'verified-loadout-effect-generated',
    confidence: 'high',
    trackingStatus: 'applied',
    generatedVerified: true,
    appliedToCalculators: true,
    formulaSourceActorId: actor.id,
    effectAdderActorId: actor.id,
    modifiers: propertyFormulaResults.map(
      ({ effect: propertyEffect, formulaResult: propertyFormulaResult }) => ({
        kind: 'battle-property',
        attributeId: propertyEffect.attributeId,
        bucket: propertyEffect.bucket,
        valueRaw: propertyFormulaResult.value,
        value: propertyFormulaResult.value,
        sourceRawA: propertyFormulaResult.sourceRawA,
        evaluatedValue: propertyFormulaResult.evaluatedValue,
        formulaIdentity: propertyFormulaResult.formulaIdentity,
        formulaResult: propertyFormulaResult,
        sourceElementId: propertyEffect.elementId,
        sourceElementPathId: propertyEffect.pathId,
        propertyTags: [...(propertyEffect.propertyTags ?? [])],
        propertyTagMatchMode: propertyEffect.propertyTagMatchMode ?? 'unscoped',
        propertyTagSourceIdentity:
          propertyEffect.propertyTagSourceIdentity ?? null,
        sourceIdentity: propertyEffect.sourceIdentity,
      })
    ),
    sourceIdentity: {
      packageId: catalog?.kind ?? soulEssenceEffectCatalog.kind,
      catalogKind: catalog?.kind ?? soulEssenceEffectCatalog.kind,
      catalogHash: catalog?.catalogHash ?? soulEssenceEffectCatalog.catalogHash,
      effectIdentity,
      ...(isSetSkill
        ? {
            setId: binding.setId,
            setPieces: binding.pieces,
            setSkillId: binding.setSkillId,
          }
        : {
            soulEssenceId: binding.soulEssenceId,
            effectSkillId: definition.effectSkillId,
          }),
      triggerElementId: definition.trigger.elementId,
      triggerPathId: definition.trigger.pathId,
      triggerEvent: definition.trigger.event,
      frameAnchor,
      triggerSequencePath,
      sourceHitIdentity:
        eventContext?.sourceHitIdentity ?? hit?.sourceIdentity ?? null,
      sourceHitIndex: eventContext?.sourceHitIndex ?? hit?.hitIndex ?? null,
      sourceHitElementId:
        eventContext?.damageElementId ?? hit?.elementId ?? null,
      sourceTuningEventIdentity: tuningEvent?.eventIdentity ?? null,
      sourceNonDamageEventIdentity,
      triggerEventContext: eventContext,
      triggerType: definition.trigger.triggerType ?? null,
      triggerCounter: definition.trigger.triggerCounter ?? null,
      triggerIntervalMs: definition.trigger.intervalMs ?? null,
      triggerIntervalSourceIdentity:
        definition.trigger.intervalSourceIdentity ?? null,
      triggerCondition: definition.trigger.condition,
      matchedConditionIdentities: conditionMatch.matchedConditionIdentities,
      actionSkillSlotIds: actionContext.skillSlotIds,
      actionSkillTagIds: actionContext.skillTagIds,
      actionKind,
      actionBindingIdentity:
        resolution?.actionBinding?.identity ??
        resolution?.actionBinding?.semanticIdentity ??
        null,
      effectElementId: effect.elementId,
      effectPathId: effect.pathId,
      effectPropertyTags: [...(effect.propertyTags ?? [])],
      effectPropertyTagMatchMode: effect.propertyTagMatchMode ?? 'unscoped',
      effectPropertyTagSourceIdentity: effect.propertyTagSourceIdentity ?? null,
      propertyFormulaResults: propertyFormulaResults.map(entry => ({
        effectElementId: entry.effect.elementId,
        effectPathId: entry.effect.pathId,
        attributeId: entry.effect.attributeId,
        starValueSourceIdentity: entry.starValue.sourceIdentity,
        formulaIdentity: entry.formulaResult.formulaIdentity,
        formulaSourceIdentity: entry.effect.formula.sourceIdentity ?? null,
        sourceRawA: entry.formulaResult.sourceRawA,
        evaluatedValue: entry.formulaResult.evaluatedValue,
        sourceIdentity: entry.effect.sourceIdentity,
      })),
      switchTrigger: actionContext.switchTrigger,
      lifecycle: effect.lifecycle ?? {
        sourceKind: 'property-leaf-duration',
        durationMs: effect.durationMs,
        leafDurationMs: effect.durationMs,
      },
      star: binding.star,
      starValueSourceIdentity: starValue.sourceIdentity,
      formulaIdentity: formulaResult.formulaIdentity,
      formulaSourceIdentity:
        primaryPropertyFormula.effect?.formula?.sourceIdentity ?? null,
      sourceRawA: formulaResult.sourceRawA,
      evaluatedValue: formulaResult.evaluatedValue,
      targetIdentity: {
        targetKind: definition.trigger.target?.kind ?? 'self-actor',
        targetId: String(target.id),
        targetIndex,
        sourceIdentity: definition.trigger.target?.sourceIdentity ?? null,
      },
      cultivationSourceIdentity: binding.cultivationSourceIdentity,
      provenance: [definition.sourceIdentity],
    },
  };
}

function createSoulImmediateEvents({
  binding,
  action,
  actionIndex,
  resolution,
  occurrence,
  scenario,
  catalog,
}) {
  const directSpEvents = [];
  const directHpEvents = [];
  const immediateEffects = binding.definition.immediateEffects ?? [];
  if (!action || immediateEffects.length === 0) {
    return { directSpEvents, directHpEvents };
  }
  const timeMs = roundRuntimeTime(occurrence.timeMs);
  const triggerSequencePath = Array.isArray(occurrence.triggerSequencePath)
    ? occurrence.triggerSequencePath
    : (getActionSourceSequencePath(action, actionIndex) ?? [actionIndex]);
  const triggerOccurrenceIdentity =
    occurrence.eventContext?.eventIdentity ??
    `${binding.ownerIdentity}|${action.id}|${timeMs}`;
  const transactionRootIdentity = [
    binding.ownerIdentity,
    `trigger:${binding.definition.trigger.elementId}`,
    `event:${triggerOccurrenceIdentity}`,
  ].join('|');
  const actors = (scenario.actors ?? [])
    .filter(actor => actor?.id != null)
    .slice()
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));

  for (const immediateEffect of immediateEffects) {
    const targets =
      immediateEffect.targetKind === 'team-actors' ? actors : [binding.actor];
    for (const [targetIndex, targetActor] of targets.entries()) {
      const target = {
        kind: EFFECT_TARGET_KINDS.ACTOR,
        id: String(targetActor.id),
      };
      const sourceSequencePath = [
        ...triggerSequencePath,
        Number(immediateEffect.effectIndex),
        targetIndex,
      ];
      const effectIdentity = `${binding.ownerIdentity}:element:${immediateEffect.elementId}`;
      const directEvent = {
        schemaVersion: 1,
        sourceKind: 'azpr-verified-soul-immediate-effect',
        status: 'verified-soul-immediate-effect-ready',
        eventIdentity: `${immediateEffect.kind}|${transactionRootIdentity}|target:${target.id}`,
        transactionRootIdentity,
        triggerOccurrenceIdentity,
        triggerElementId: binding.definition.trigger.elementId,
        triggerType: binding.definition.trigger.triggerType ?? null,
        triggerCounter: binding.definition.trigger.triggerCounter ?? null,
        triggerIntervalMs: binding.definition.trigger.intervalMs ?? null,
        triggerSourceSequencePath: [...triggerSequencePath],
        ownerIdentity: binding.ownerIdentity,
        kind: immediateEffect.kind,
        timeMs,
        action,
        actionId: action.id,
        actorId: String(binding.actor.id),
        target,
        value: Number(immediateEffect.sourceRawValue),
        formulaResult: {
          applied: true,
          status: 'applied',
          formulaIdentity:
            immediateEffect.formula?.formulaIdentity ??
            `${effectIdentity}:formula`,
          sourceRawA: Number(
            immediateEffect.formula?.sourceRawA ??
              immediateEffect.sourceRawValue
          ),
          value: Number(immediateEffect.sourceRawValue),
          sourceIdentity: immediateEffect.formula?.sourceIdentity ?? null,
        },
        effect: {
          elementId: Number(immediateEffect.elementId),
          pathId: Number(immediateEffect.pathId),
          sourceIdentity: immediateEffect.sourceIdentity,
          sourceOrder: {
            sourceSequencePath,
            sourceIdentity: immediateEffect.sourceIdentity,
          },
          ...(immediateEffect.kind === 'direct-sp'
            ? {
                directSp: {
                  recoverType: Number(immediateEffect.recoverType),
                  shareType: Number(immediateEffect.shareType),
                  petShareType: Number(immediateEffect.petShareType),
                  mainPetShareType: Number(immediateEffect.mainPetShareType),
                  enhanceable: false,
                },
              }
            : {
                heal: {
                  damageType: Number(immediateEffect.damageType),
                  formula: structuredClone(immediateEffect.formula),
                },
              }),
        },
        resolution: resolution ?? {
          packageId: catalog?.kind ?? soulEssenceEffectCatalog.kind,
        },
        sourceSequencePath,
        sourceSequenceStatus: 'verified-direct-effect-source-sequence-ready',
        sourceSequenceContract: {
          contractName: 'AzPrSoulImmediateEffectSourceSequence',
          phase: 'before-skill-trigger-effect-list',
          effectIndex: Number(immediateEffect.effectIndex),
          targetSequenceIndex: targetIndex,
          sourceIdentity: immediateEffect.sourceIdentity,
        },
        sourceIdentity: immediateEffect.sourceIdentity,
        sourceActorId: String(binding.actor.id),
        sourceSetId: binding.setId ?? null,
        sourceSetPieces: binding.pieces ?? null,
        sourceSetSkillId: binding.setSkillId ?? null,
        appliedToCalculators: true,
        applied: true,
      };
      if (immediateEffect.kind === 'direct-sp') {
        directSpEvents.push(directEvent);
      } else if (immediateEffect.kind === 'direct-heal') {
        directHpEvents.push(directEvent);
      }
    }
  }
  return { directSpEvents, directHpEvents };
}

function evaluateSoulEffectFormula({
  definition,
  effect = definition.effect,
  starValue,
  star,
  actor,
}) {
  if (
    !Number.isInteger(Number(effect.formula?.commonFunctionId)) ||
    !Number.isInteger(Number(effect.formula?.baseFunctionId))
  ) {
    return {
      family: effect.formula?.family ?? 'legacy-literal-a',
      status: 'applied',
      evaluator: 'legacy-synthetic-literal-a',
      applied: true,
      value: Number(starValue.valueRaw),
      raw: null,
      sourceRawA: Number(starValue.valueRaw),
      evaluatedValue: Number(starValue.valueRaw),
      evaluatedRaw: null,
      formulaIdentity: 'synthetic-legacy-formula',
      trace: [],
      q16Trace: [],
      reason: null,
    };
  }
  const params = Array.from({ length: 26 }, () => 0);
  params[0] = Number(starValue.valueRaw);
  params[6] = Number(effect.formula.commonRatioRaw);
  return evaluateVerifiedBattleEffectFormula({
    effect: {
      ...effect,
      property: { bucket: effect.bucket },
      formula: {
        ...effect.formula,
        paramsByLevel: { [star]: params },
      },
    },
    level: star,
    sourceActor: actor,
  });
}

function resolveSoulEffectTargets({ binding, scenario, occurrence }) {
  if (binding.definition.trigger?.target?.kind === 'team-actors') {
    return (scenario.actors ?? []).map(actor => ({
      kind: EFFECT_TARGET_KINDS.ACTOR,
      id: actor.id,
      name: actor.name ?? null,
    }));
  }
  if (binding.definition.trigger?.target?.kind === 'event-target-actor') {
    const targetId = String(occurrence?.eventContext?.eventTargetActorId ?? '');
    const actor = (scenario.actors ?? []).find(
      candidate => String(candidate.id) === targetId
    );
    return actor
      ? [
          {
            kind: EFFECT_TARGET_KINDS.ACTOR,
            id: actor.id,
            name: actor.name ?? null,
          },
        ]
      : [];
  }
  if (binding.definition.trigger?.target?.kind === 'event-target-entity') {
    const targetKind = occurrence?.eventContext?.eventTargetKind;
    const targetId = String(occurrence?.eventContext?.eventTargetId ?? '');
    if (
      targetKind === EFFECT_TARGET_KINDS.ENEMY &&
      String(scenario.enemy?.id) === targetId
    ) {
      return [
        {
          kind: EFFECT_TARGET_KINDS.ENEMY,
          id: scenario.enemy.id,
          name: scenario.enemy.name ?? null,
        },
      ];
    }
    if (targetKind === EFFECT_TARGET_KINDS.ACTOR) {
      const actor = (scenario.actors ?? []).find(
        candidate => String(candidate.id) === targetId
      );
      return actor
        ? [
            {
              kind: EFFECT_TARGET_KINDS.ACTOR,
              id: actor.id,
              name: actor.name ?? null,
            },
          ]
        : [];
    }
    return [];
  }
  return [
    {
      kind: EFFECT_TARGET_KINDS.ACTOR,
      id: binding.actor.id,
      name: binding.actor.name ?? null,
    },
  ];
}

function resolveSoulTriggerActionContext({ action, resolution, eventContext }) {
  const actionProvenanceAvailable =
    eventContext?.actionProvenanceAvailable !== false;
  const actionBinding = actionProvenanceAvailable
    ? (resolution?.actionBinding ?? {})
    : {};
  const controlBinding = actionProvenanceAvailable
    ? (resolution?.controlBinding ?? {})
    : {};
  return {
    sourceActorId: action?.actorId ?? eventContext?.sourceActorId ?? null,
    controlledActorId: eventContext?.controlledActorId ?? null,
    actionKind:
      eventContext?.actionKind ??
      actionBinding.actionKind ??
      (actionProvenanceAvailable
        ? (action?.actionKind ?? action?.eventType ?? null)
        : null),
    skillSlotIds: uniqueFiniteIntegers([
      ...(eventContext?.skillSlotIds ?? []),
      ...(actionProvenanceAvailable
        ? [
            actionBinding.skillSlotId,
            actionBinding.skillSlotType,
            action?.skillSlotId,
            ...extractSkillSlotIds(actionBinding.bindingSourceIdentity),
          ]
        : []),
    ]),
    skillTagIds: uniqueFiniteIntegers([
      ...(eventContext?.skillTagIds ?? []),
      ...(actionProvenanceAvailable
        ? [
            controlBinding.logic?.skillTagId,
            ...parseDelimitedNumbers(controlBinding.logic?.skillTag),
          ]
        : []),
    ]),
    switchTrigger: {
      kind: action?.derivedAction?.kind ?? null,
      parentActionId:
        action?.derivedAction?.parentActionId ?? action?.parentActionId ?? null,
      triggerPhase: action?.switchTriggerBinding?.triggerPhase ?? null,
      resolutionStatus: action?.switchTriggerBinding?.resolutionStatus ?? null,
      applied: action?.switchTriggerBinding?.applied === true,
      sourceIdentity: action?.switchTriggerBinding?.sourceIdentity ?? null,
    },
  };
}

function matchesSoulTriggerCondition(condition, actionContext, eventContext) {
  if (condition?.kind === 'always' && condition?.status === 'applied') {
    return {
      matched: true,
      matchedConditionIdentities: [condition.sourceIdentity].filter(Boolean),
      reasons: [],
    };
  }
  const legacyConditionShape = !Array.isArray(condition?.conditions);
  const conditions = Array.isArray(condition?.conditions)
    ? condition.conditions
    : condition
      ? [condition]
      : [];
  if (conditions.length === 0) {
    return {
      matched: false,
      matchedConditionIdentities: [],
      reasons: ['soulessence-effect-trigger-condition-missing'],
    };
  }
  const results = conditions.map(entry => {
    if (entry.kind === 'skill-slot') {
      return (
        (actionContext.skillSlotIds.includes(Number(entry.skillSlotId)) ||
          (legacyConditionShape &&
            (entry.actionKinds ?? []).includes(actionContext.actionKind))) &&
        matchesSoulTriggerProvenance(entry, actionContext)
      );
    }
    if (entry.kind === 'skill-tag') {
      return (
        (actionContext.skillTagIds.includes(Number(entry.skillTagId)) ||
          (legacyConditionShape &&
            (entry.actionKinds ?? []).includes(actionContext.actionKind))) &&
        matchesSoulTriggerProvenance(entry, actionContext)
      );
    }
    if (entry.kind === 'held-element-id') {
      return (eventContext?.heldElementIds ?? []).includes(
        Number(entry.conditionValue)
      );
    }
    if (entry.kind === 'event-element-type') {
      return (eventContext?.elementTypes ?? []).includes(
        Number(entry.conditionValue)
      );
    }
    if (entry.kind === 'event-element-id') {
      return Number(eventContext?.elementId) === Number(entry.conditionValue);
    }
    if (entry.kind === 'target-element-id') {
      return (eventContext?.targetElementIds ?? []).includes(
        Number(entry.conditionValue)
      );
    }
    if (entry.kind === 'self-stay-type') {
      return (
        Number(entry.stayType) === 0 &&
        String(actionContext.sourceActorId) ===
          String(actionContext.controlledActorId)
      );
    }
    return (
      (entry.actionKinds ?? []).includes(actionContext.actionKind) &&
      matchesSoulTriggerProvenance(entry, actionContext)
    );
  });
  const logic = condition?.logic ?? 'and';
  const matched =
    logic === 'or' ? results.some(Boolean) : results.every(Boolean);
  return {
    matched,
    matchedConditionIdentities: conditions
      .filter((_entry, index) => results[index])
      .map(entry => entry.sourceIdentity)
      .filter(Boolean),
    reasons: matched
      ? []
      : conditions.map((entry, index) => ({
          condition: entry,
          matched: results[index],
        })),
  };
}

function resolveHeldTuningElementIdsAt({
  tuningGeneration,
  timeMs,
  frameAnchor,
}) {
  const countByMarkId = new Map(
    (tuningGeneration?.initialState ?? []).map(state => [
      Number(state.markId),
      Number(state.currentValue) || 0,
    ])
  );
  for (const event of tuningGeneration?.events ?? []) {
    const eventTimeMs = Number(event.timeMs);
    if (eventTimeMs > timeMs) continue;
    if (
      eventTimeMs === timeMs &&
      frameAnchor === 'action-start' &&
      event.kind !== 'expire'
    ) {
      continue;
    }
    countByMarkId.set(Number(event.markId), Number(event.after) || 0);
  }
  return [...countByMarkId.entries()]
    .filter(([_markId, count]) => count > 0)
    .map(([markId]) => markId)
    .sort((left, right) => left - right);
}

function matchesSoulTriggerProvenance(condition, actionContext) {
  if (!condition?.provenanceRequirement) return true;
  if (condition.provenanceRequirement === 'switch-triggered-on-enter') {
    return (
      actionContext.switchTrigger?.kind === 'switch-triggered-star-carry' &&
      actionContext.switchTrigger?.triggerPhase === 'on-enter' &&
      actionContext.switchTrigger?.applied === true
    );
  }
  return false;
}

function isNonDamageTriggerAnchor(frameAnchor) {
  return [
    'switch-enter',
    'shield-after-acquire',
    'heal-after-settlement',
  ].includes(frameAnchor);
}

function matchesNonDamageTriggerObserver(binding, eventContext) {
  const sourceKind = binding.definition.trigger?.triggerTarget?.kind;
  if (
    sourceKind === 'equipped-actor-source-events' ||
    sourceKind === 'native-event-subject-matches-equipped-actor'
  ) {
    return (
      String(eventContext?.triggerSubjectActorId) === String(binding.actor.id)
    );
  }
  if (sourceKind === 'event-source-actor-events') {
    return String(eventContext?.sourceActorId) === String(binding.actor.id);
  }
  return false;
}

function applySoulTriggerIntervalGates({
  effectCommands,
  directSpEvents,
  directHpEvents,
  suppressions,
}) {
  const triggerGroups = new Map();
  const artifacts = [
    ...effectCommands.map((value, index) => ({
      kind: 'effect-command',
      index,
      value,
    })),
    ...directSpEvents.map((value, index) => ({
      kind: 'direct-sp',
      index,
      value,
    })),
    ...directHpEvents.map((value, index) => ({
      kind: 'direct-heal',
      index,
      value,
    })),
  ];
  for (const artifact of artifacts) {
    const command = artifact.value;
    const intervalMs = Number(
      command.triggerIntervalMs ?? command.sourceIdentity?.triggerIntervalMs
    );
    const triggerType = Number(
      command.triggerType ?? command.sourceIdentity?.triggerType
    );
    const configuredTriggerCounter = Number(
      command.triggerCounter ?? command.sourceIdentity?.triggerCounter
    );
    const triggerCounterLimit = resolveEventTriggerCounterLimit({
      triggerType,
      configuredTriggerCounter,
    });
    if (!(intervalMs > 0) && triggerCounterLimit == null) continue;
    const ownerIdentity =
      command.ownerIdentity ??
      (command.sourceSetId != null
        ? `set-skill:${command.sourceSetId}:${command.sourceSetPieces}`
        : `soulessence:${command.sourceSoulEssenceId}`);
    const bindingKey = [
      command.sourceActorId ?? command.actorId,
      ownerIdentity,
      command.triggerElementId ?? command.sourceIdentity?.triggerElementId,
    ].join('|');
    if (!triggerGroups.has(bindingKey)) {
      triggerGroups.set(bindingKey, {
        intervalMs,
        triggerType: Number.isInteger(triggerType) ? triggerType : null,
        configuredTriggerCounter: Number.isInteger(configuredTriggerCounter)
          ? configuredTriggerCounter
          : null,
        triggerCounterLimit,
        occurrences: new Map(),
      });
    }
    const group = triggerGroups.get(bindingKey);
    const occurrenceIdentity =
      command.triggerOccurrenceIdentity ??
      command.sourceNonDamageEventIdentity ??
      command.sourceIdentity?.triggerEventContext?.eventIdentity ??
      command.id;
    if (!group.occurrences.has(occurrenceIdentity)) {
      group.occurrences.set(occurrenceIdentity, {
        occurrenceIdentity,
        timeMs: Number(command.timeMs),
        sourceSequencePath:
          command.triggerSourceSequencePath ??
          command.sourceIdentity?.triggerEventContext?.sourceSequencePath ??
          command.sourceIdentity?.triggerSequencePath ??
          [],
        artifacts: [],
        command,
      });
    }
    group.occurrences.get(occurrenceIdentity).artifacts.push(artifact);
  }

  const suppressed = {
    'effect-command': new Set(),
    'direct-sp': new Set(),
    'direct-heal': new Set(),
  };
  const acceptedTriggerOccurrences = [];
  const triggerIntervalStates = [];
  const triggerCounterStates = [];
  for (const [bindingKey, group] of triggerGroups) {
    let lastAcceptedAtMs = null;
    let acceptedCount = 0;
    const occurrences = [...group.occurrences.values()].sort(
      (left, right) =>
        left.timeMs - right.timeMs ||
        compareSourceSequencePaths(
          left.sourceSequencePath,
          right.sourceSequencePath
        ) ||
        left.occurrenceIdentity.localeCompare(right.occurrenceIdentity)
    );
    for (const occurrence of occurrences) {
      if (
        group.triggerCounterLimit != null &&
        acceptedCount >= group.triggerCounterLimit
      ) {
        for (const artifact of occurrence.artifacts) {
          suppressed[artifact.kind].add(artifact.index);
        }
        suppressions.push({
          actionId:
            occurrence.command.sourceActionId ?? occurrence.command.actionId,
          actorId:
            occurrence.command.sourceActorId ?? occurrence.command.actorId,
          soulEssenceId: occurrence.command.sourceSoulEssenceId,
          setId: occurrence.command.sourceSetId ?? null,
          setPieces: occurrence.command.sourceSetPieces ?? null,
          effectSkillId:
            occurrence.command.sourceIdentity?.effectSkillId ?? null,
          eventIdentity: occurrence.occurrenceIdentity,
          triggerType: group.triggerType,
          configuredTriggerCounter: group.configuredTriggerCounter,
          triggerCounterLimit: group.triggerCounterLimit,
          acceptedCount,
          timeMs: occurrence.timeMs,
          reason: 'soulessence-effect-trigger-counter-exhausted',
        });
        continue;
      }
      if (
        lastAcceptedAtMs != null &&
        occurrence.timeMs - lastAcceptedAtMs < group.intervalMs
      ) {
        for (const artifact of occurrence.artifacts) {
          suppressed[artifact.kind].add(artifact.index);
        }
        suppressions.push({
          actionId:
            occurrence.command.sourceActionId ?? occurrence.command.actionId,
          actorId:
            occurrence.command.sourceActorId ?? occurrence.command.actorId,
          soulEssenceId: occurrence.command.sourceSoulEssenceId,
          setId: occurrence.command.sourceSetId ?? null,
          setPieces: occurrence.command.sourceSetPieces ?? null,
          effectSkillId:
            occurrence.command.sourceIdentity?.effectSkillId ?? null,
          eventIdentity: occurrence.occurrenceIdentity,
          intervalMs: group.intervalMs,
          lastAcceptedAtMs,
          timeMs: occurrence.timeMs,
          reason: 'soulessence-effect-trigger-interval-active',
        });
        continue;
      }
      lastAcceptedAtMs = occurrence.timeMs;
      acceptedCount += 1;
      acceptedTriggerOccurrences.push({
        bindingKey,
        eventIdentity: occurrence.occurrenceIdentity,
        timeMs: occurrence.timeMs,
        intervalMs: group.intervalMs,
        triggerType: group.triggerType,
        configuredTriggerCounter: group.configuredTriggerCounter,
        triggerCounterLimit: group.triggerCounterLimit,
        triggerCountAfter: acceptedCount,
        remainingTriggerCount:
          group.triggerCounterLimit == null
            ? null
            : Math.max(0, group.triggerCounterLimit - acceptedCount),
        sourceSequencePath: occurrence.sourceSequencePath,
        actionId:
          occurrence.command.sourceActionId ?? occurrence.command.actionId,
        actorId: occurrence.command.sourceActorId ?? occurrence.command.actorId,
      });
    }
    if (group.intervalMs > 0) {
      triggerIntervalStates.push({
        bindingKey,
        intervalMs: group.intervalMs,
        lastAcceptedAtMs,
        readyAtMs:
          lastAcceptedAtMs == null ? null : lastAcceptedAtMs + group.intervalMs,
      });
    }
    if (group.triggerCounterLimit != null) {
      triggerCounterStates.push({
        bindingKey,
        triggerType: group.triggerType,
        configuredTriggerCounter: group.configuredTriggerCounter,
        triggerCounterLimit: group.triggerCounterLimit,
        acceptedCount,
        remainingTriggerCount: Math.max(
          0,
          group.triggerCounterLimit - acceptedCount
        ),
        exhausted: acceptedCount >= group.triggerCounterLimit,
      });
    }
  }
  return {
    effectCommands: effectCommands.filter(
      (_command, index) => !suppressed['effect-command'].has(index)
    ),
    directSpEvents: directSpEvents.filter(
      (_event, index) => !suppressed['direct-sp'].has(index)
    ),
    directHpEvents: directHpEvents.filter(
      (_event, index) => !suppressed['direct-heal'].has(index)
    ),
    acceptedTriggerOccurrences,
    triggerIntervalStates,
    triggerCounterStates,
  };
}

function resolveEventTriggerCounterLimit({
  triggerType,
  configuredTriggerCounter,
}) {
  if (
    Number(triggerType) !== 1 ||
    !Number.isInteger(configuredTriggerCounter) ||
    configuredTriggerCounter < 0
  ) {
    return null;
  }
  return configuredTriggerCounter === 0 ? 1 : configuredTriggerCounter;
}

function extractSkillSlotIds(sourceIdentity) {
  return [
    ...String(sourceIdentity ?? '').matchAll(
      /skillSlots\[[^\]]*slot=(\d+)\]/gu
    ),
  ].map(match => Number(match[1]));
}

function parseDelimitedNumbers(value) {
  if (Array.isArray(value)) return value.map(Number);
  return String(value ?? '')
    .split(/[^\d-]+/u)
    .filter(Boolean)
    .map(Number);
}

function uniqueFiniteIntegers(values) {
  return [...new Set(values.map(Number).filter(Number.isInteger))];
}

function normalizeStackMode(value) {
  if (value === EFFECT_STACK_MODES.STACK) return EFFECT_STACK_MODES.STACK;
  if (value === EFFECT_STACK_MODES.REPLACE) return EFFECT_STACK_MODES.REPLACE;
  if (value === EFFECT_STACK_MODES.BLOCK) return EFFECT_STACK_MODES.BLOCK;
  return EFFECT_STACK_MODES.REFRESH;
}

function roundRuntimeTime(value) {
  return Math.round(Number(value) * 1_000_000) / 1_000_000;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
