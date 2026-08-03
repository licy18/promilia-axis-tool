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
          definition.trigger != null &&
          definition.effect != null
      )
      .map(definition => [Number(definition.soulEssenceId), definition])
  );
  const definitionBySetKey = new Map(
    (catalog?.setSkillDefinitions ?? [])
      .filter(
        definition =>
          definition.runtimeStatus === 'runtime-applied' &&
          definition.trigger != null &&
          definition.effect != null
      )
      .map(definition => [
        `${Number(definition.setId)}:${Number(definition.pieces)}`,
        definition,
      ])
  );
  const bindings = (scenario.actors ?? []).flatMap(actor => [
    createEquippedSoulBinding(actor, definitionBySoulId),
    ...createEquippedSetSkillBindings(actor, definitionBySetKey),
  ]).filter(Boolean);
  const effectCommands = [];
  const suppressions = [];
  const unresolved = [];

  for (const binding of bindings) {
    if (!binding.starValue) {
      unresolved.push({
        actorId: binding.actor.id,
        ...createBindingDiagnosticIdentity(binding),
        status: 'soulessence-effect-runtime-unresolved',
        reasons: ['soulessence-effect-star-value-unresolved'],
        sourceIdentity: binding.definition.sourceIdentity,
      });
      continue;
    }
    if (binding.formulaResult?.applied !== true) {
      unresolved.push({
        actorId: binding.actor.id,
        ...createBindingDiagnosticIdentity(binding),
        status: 'soulessence-effect-runtime-unresolved',
        reasons: [
          binding.formulaResult?.reason ??
            'soulessence-effect-formula-evaluation-unresolved',
        ],
        sourceIdentity: binding.definition.sourceIdentity,
      });
      continue;
    }
    for (const [actionIndex, action] of (scenario.actions ?? []).entries()) {
      const frameAnchor = binding.definition.trigger.frameAnchor;
      const nonDamageTrigger = isNonDamageTriggerAnchor(frameAnchor);
      if (
        !nonDamageTrigger &&
        String(action.actorId) !== String(binding.actor.id)
      ) {
        continue;
      }
      if (executionByActionId.get(action.id)?.execute !== true) continue;
      const resolution = actionResolutionById?.get?.(action.id) ?? null;
      const triggerOperator =
        SOULESSENCE_TRIGGER_OPERATOR_REGISTRY[frameAnchor];
      const rawOccurrences = triggerOperator?.({
        action,
        actionIndex,
        resolution,
        scenario,
        tuningGeneration,
        damageEventGeneration,
        nonDamageEventGeneration,
        frameAnchor,
      });
      const occurrences = (rawOccurrences ?? []).filter(
        occurrence =>
          !nonDamageTrigger ||
          matchesNonDamageTriggerObserver(binding, occurrence.eventContext)
      );
      if (occurrences.length === 0) {
        suppressions.push({
          actionId: action.id,
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
          actionId: action.id,
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
  }

  const gatedEffectCommands = applySoulTriggerIntervalGates({
    effectCommands,
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
    effectCommands: gatedEffectCommands,
    suppressions,
    unresolved,
    summary: {
      equippedBindingCount: bindings.length,
      effectCommandCount: gatedEffectCommands.length,
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
}) {
  const actionSourceSequencePath = getActionSourceSequencePath(
    action,
    actionIndex
  ) ?? [actionIndex];
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
    .map(event => ({
      hit: null,
      tuningEvent: null,
      nonDamageEvent: event,
      timeMs: Number(event.timeMs),
      triggerSequencePath: event.sourceSequencePath,
      eventContext: event.eventContext,
    }));
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

function createEquippedSoulBinding(actor, definitionBySoulId) {
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
  const starValue = definition.effect?.valuesByStar?.find(
    row => Number(row.star) === star
  );
  const formulaResult = starValue
    ? evaluateSoulEffectFormula({
        definition,
        starValue,
        star,
        actor,
      })
    : null;
  return {
    actor,
    ownerKind: 'soul-essence',
    ownerIdentity: `soulessence:${soulEssenceId}`,
    soulEssenceId,
    definition,
    star: Number.isInteger(star) ? star : null,
    starValue: starValue ?? null,
    formulaResult,
    cultivationSourceIdentity: effectSkill?.sourceIdentity ?? null,
  };
}

function createEquippedSetSkillBindings(actor, definitionBySetKey) {
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
      const starValue = definition.effect?.valuesByStar?.find(
        row => Number(row.star) === 1
      ) ?? {
        star: 1,
        valueRaw: Number(definition.effect?.sourceRawA),
        sourceIdentity: `${definition.effect?.sourceIdentity}.formulaParams.formulaParamValues[0]`,
      };
      const formulaResult = Number.isFinite(Number(starValue.valueRaw))
        ? evaluateSoulEffectFormula({
            definition,
            starValue,
            star: 1,
            actor,
          })
        : null;
      return {
        actor,
        ownerKind: 'set-skill',
        ownerIdentity: `set-skill:${activation.setId}:${activation.pieces}`,
        setId: Number(activation.setId),
        pieces: Number(activation.pieces),
        setSkillId: Number(activation.skillId),
        definition,
        star: 1,
        starValue,
        formulaResult,
        cultivationSourceIdentity: activation.sourceIdentity ?? null,
      };
    })
    .filter(Boolean);
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
  const { definition, starValue, formulaResult, actor } = binding;
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
      ? actionSourceSequencePath
      : [...actionSourceSequencePath, Number(hit.hitIndex)];
  const triggerSequencePath = [...occurrenceSequencePath, targetIndex];
  const isSetSkill = binding.ownerKind === 'set-skill';
  const effectIdentity = isSetSkill
    ? `set-skill:${binding.setId}:${binding.pieces}:element:${effect.elementId}`
    : `soulessence:${binding.soulEssenceId}:element:${effect.elementId}`;
  const sourceNonDamageEventIdentity =
    occurrence?.nonDamageEvent?.eventIdentity ?? null;
  return {
    id: `${isSetSkill ? `set-skill|${binding.setId}|${binding.pieces}` : `soulessence|${binding.soulEssenceId}`}|${action.id}|${effect.elementId}|${frameAnchor}|target:${target.id}${hit == null ? '' : `|hit:${hit.hitIndex}`}${tuningEvent == null ? '' : `|tuning:${tuningEvent.eventIdentity}`}${sourceNonDamageEventIdentity == null ? '' : `|event:${sourceNonDamageEventIdentity}`}`,
    sourceActionId: action.id,
    sourceActionName: action.name,
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
    targetKind: EFFECT_TARGET_KINDS.ACTOR,
    targetId: String(target.id),
    targetName: target.name ?? null,
    semanticTargetKind: definition.trigger.target?.kind ?? 'self-actor',
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
      `action-kind:${actionKind}`,
    ],
    sourceStatus: 'verified-loadout-effect-generated',
    confidence: 'high',
    trackingStatus: 'applied',
    generatedVerified: true,
    appliedToCalculators: true,
    formulaSourceActorId: actor.id,
    effectAdderActorId: actor.id,
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
      switchTrigger: actionContext.switchTrigger,
      lifecycle: effect.lifecycle ?? {
        sourceKind: 'property-leaf-duration',
        durationMs: effect.durationMs,
        leafDurationMs: effect.durationMs,
      },
      star: binding.star,
      starValueSourceIdentity: starValue.sourceIdentity,
      formulaIdentity: formulaResult.formulaIdentity,
      formulaSourceIdentity: effect.formula.sourceIdentity ?? null,
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

function evaluateSoulEffectFormula({ definition, starValue, star, actor }) {
  if (
    !Number.isInteger(Number(definition.effect.formula?.commonFunctionId)) ||
    !Number.isInteger(Number(definition.effect.formula?.baseFunctionId))
  ) {
    return {
      family: definition.effect.formula?.family ?? 'legacy-literal-a',
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
  params[6] = Number(definition.effect.formula.commonRatioRaw);
  return evaluateVerifiedBattleEffectFormula({
    effect: {
      ...definition.effect,
      property: { bucket: definition.effect.bucket },
      formula: {
        ...definition.effect.formula,
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
      id: actor.id,
      name: actor.name ?? null,
    }));
  }
  if (binding.definition.trigger?.target?.kind === 'event-target-actor') {
    const targetId = String(
      occurrence?.eventContext?.eventTargetActorId ?? ''
    );
    const actor = (scenario.actors ?? []).find(
      candidate => String(candidate.id) === targetId
    );
    return actor ? [{ id: actor.id, name: actor.name ?? null }] : [];
  }
  return [{ id: binding.actor.id, name: binding.actor.name ?? null }];
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
    actionKind:
      eventContext?.actionKind ??
      actionBinding.actionKind ??
      (actionProvenanceAvailable
        ? (action.actionKind ?? action.eventType ?? null)
        : null),
    skillSlotIds: uniqueFiniteIntegers([
      ...(eventContext?.skillSlotIds ?? []),
      ...(actionProvenanceAvailable
        ? [
            actionBinding.skillSlotId,
            actionBinding.skillSlotType,
            action.skillSlotId,
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
      kind: action.derivedAction?.kind ?? null,
      parentActionId:
        action.derivedAction?.parentActionId ?? action.parentActionId ?? null,
      triggerPhase: action.switchTriggerBinding?.triggerPhase ?? null,
      resolutionStatus: action.switchTriggerBinding?.resolutionStatus ?? null,
      applied: action.switchTriggerBinding?.applied === true,
      sourceIdentity: action.switchTriggerBinding?.sourceIdentity ?? null,
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

function applySoulTriggerIntervalGates({ effectCommands, suppressions }) {
  const intervalGroups = new Map();
  for (const [commandIndex, command] of effectCommands.entries()) {
    const intervalMs = Number(command.sourceIdentity?.triggerIntervalMs);
    if (!(intervalMs > 0)) continue;
    const bindingKey = [
      command.sourceActorId,
      command.sourceSoulEssenceId,
      command.sourceIdentity?.triggerElementId,
    ].join('|');
    if (!intervalGroups.has(bindingKey)) {
      intervalGroups.set(bindingKey, {
        intervalMs,
        occurrences: new Map(),
      });
    }
    const group = intervalGroups.get(bindingKey);
    const occurrenceIdentity =
      command.sourceNonDamageEventIdentity ??
      command.sourceIdentity?.triggerEventContext?.eventIdentity ??
      command.id;
    if (!group.occurrences.has(occurrenceIdentity)) {
      group.occurrences.set(occurrenceIdentity, {
        occurrenceIdentity,
        timeMs: Number(command.timeMs),
        sourceSequencePath:
          command.sourceIdentity?.triggerEventContext?.sourceSequencePath ??
          command.sourceIdentity?.triggerSequencePath ??
          [],
        commandIndexes: [],
        command,
      });
    }
    group.occurrences.get(occurrenceIdentity).commandIndexes.push(commandIndex);
  }

  const suppressedCommandIndexes = new Set();
  for (const group of intervalGroups.values()) {
    let lastAcceptedAtMs = null;
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
        lastAcceptedAtMs != null &&
        occurrence.timeMs - lastAcceptedAtMs < group.intervalMs
      ) {
        for (const commandIndex of occurrence.commandIndexes) {
          suppressedCommandIndexes.add(commandIndex);
        }
        suppressions.push({
          actionId: occurrence.command.sourceActionId,
          actorId: occurrence.command.sourceActorId,
          soulEssenceId: occurrence.command.sourceSoulEssenceId,
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
    }
  }
  return effectCommands.filter(
    (_command, commandIndex) => !suppressedCommandIndexes.has(commandIndex)
  );
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
