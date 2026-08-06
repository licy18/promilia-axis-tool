import kiboPassiveMechanicsCatalog from '../../data/generated/kibo-passive-mechanics.json';
import {
  ACTION_TYPES,
  EFFECT_OPERATIONS,
  EFFECT_STACK_MODES,
  EFFECT_TARGET_KINDS,
} from '../../domain/projectSchema';
import { compareActionSourceSequence } from '../../domain/actionSourceSequence';
import { isActionFrameWithinContextualOccupancy } from './actionEffectiveTimeline';

export const VERIFIED_KIBO_PASSIVE_GENERATION_CONTRACT_NAME =
  'AzPrVerifiedKiboPassiveGeneration';

const DEFAULT_FRAME_RATE = 60;
const STATIC_ONLY_PROPERTY_MECHANISM_FAMILIES = new Set([
  'equipped-kibo-self-property-effect',
  'equipped-kibo-owner-property-effect',
  'equipped-kibo-and-owner-property-effect',
  'equipped-kibo-player-team-property-effect',
]);
const COMPOSITE_STATIC_AND_DAMAGE_PROPERTY_MECHANISM_FAMILY =
  'equipped-kibo-self-and-on-damage-enemy-property-effect';
const SCENARIO_START_PROPERTY_MECHANISM_FAMILIES = new Set([
  ...STATIC_ONLY_PROPERTY_MECHANISM_FAMILIES,
  COMPOSITE_STATIC_AND_DAMAGE_PROPERTY_MECHANISM_FAMILY,
]);
const DAMAGE_DEALT_PROPERTY_MECHANISM_FAMILIES = new Set([
  'on-kibo-damage-enemy-property-effect',
  'on-kibo-damage-self-property-effect',
  'on-pet-owner-damage-source-property-effect',
  COMPOSITE_STATIC_AND_DAMAGE_PROPERTY_MECHANISM_FAMILY,
]);
const PET_OWNER_DAMAGE_SOURCE_PROPERTY_MECHANISM_FAMILY =
  'on-pet-owner-damage-source-property-effect';
const DERIVED_DAMAGE_MECHANISM_FAMILY = 'on-kibo-damage-derived-damage';
const DERIVED_DOT_SELF_HEAL_MECHANISM_FAMILY =
  'on-kibo-damage-derived-dot-and-self-heal';
const PERIODIC_TEAM_HEAL_MECHANISM_FAMILY =
  'equipped-kibo-player-team-periodic-heal';
const BEFORE_SKILL_COMPOSITE_MECHANISM_FAMILY =
  'equipped-kibo-before-skill-composite-effect';
const AFTER_RECEIVE_DAMAGE_SELF_PROPERTY_MECHANISM_FAMILY =
  'after-kibo-receive-damage-self-property-effect';
const AFTER_RECEIVE_DAMAGE_MECHANISM_FAMILIES = new Set([
  AFTER_RECEIVE_DAMAGE_SELF_PROPERTY_MECHANISM_FAMILY,
]);
const AFTER_RECEIVE_DAMAGE_RETALIATION_DAMAGE_MECHANISM_FAMILY =
  'after-kibo-receive-damage-retaliation-damage-effect';
const AFTER_RECEIVE_DAMAGE_DERIVED_DAMAGE_MECHANISM_FAMILIES = new Set([
  AFTER_RECEIVE_DAMAGE_RETALIATION_DAMAGE_MECHANISM_FAMILY,
]);
const SCENARIO_START_ONLY_MECHANISM_FAMILIES = new Set([
  ...STATIC_ONLY_PROPERTY_MECHANISM_FAMILIES,
  PERIODIC_TEAM_HEAL_MECHANISM_FAMILY,
]);

export function deriveKiboReceiveDamageEventsFromCombatRuntime(combatRuntime) {
  const events = [];
  for (const event of combatRuntime?.vitalEvents ?? []) {
    const payload = event?.payload ?? {};
    if (payload?.status !== 'verified-kibo-passive-vital-damage') continue;
    if (payload?.applied !== true) continue;
    const kiboId = Number(payload?.targetKiboId ?? payload?.sourceKiboId);
    if (!Number.isInteger(kiboId) || kiboId <= 0) continue;
    events.push({
      kiboId,
      actorId: payload?.targetActorId ?? payload?.sourceActorId ?? null,
      timeMs: Number(event.timeMs),
      applied: true,
      sourceEventIdentity:
        payload?.sourceEventIdentity ??
        event?.eventIdentity ??
        `kibo-receive-damage:${kiboId}:${event.timeMs}`,
      damageType: payload?.damageType ?? null,
      eventKind: 'damage-received',
    });
  }
  return events;
}

export function createVerifiedKiboPassiveGeneration({
  scenario = {},
  actionExecutionPlan = null,
  actionResolutionById = null,
  acceptedSkillStartTransitions = null,
  kiboReceiveDamageEvents = null,
  catalog = kiboPassiveMechanicsCatalog,
} = {}) {
  const executionByActionId = new Map(
    (actionExecutionPlan?.actions ?? []).map(entry => [entry.actionId, entry])
  );
  const catalogDefinitions = catalog?.definitions ?? [];
  const definitionsByKiboId = groupCatalogRowsByKiboId(
    catalogDefinitions.filter(
      definition => (definition.runtimeGaps?.length ?? 0) === 0
    )
  );
  const unresolvedByKiboId = groupCatalogRowsByKiboId([
    ...(catalog?.unresolved ?? []),
    ...catalogDefinitions
      .filter(definition => (definition.runtimeGaps?.length ?? 0) > 0)
      .map(definition => ({
        ...definition,
        reasons: definition.runtimeGaps,
        evidence: {
          status: 'evidence-closed-runtime-gap',
          mechanismFamily: definition.mechanismFamily,
        },
      })),
  ]);
  const effectCommands = [];
  const derivedDamageCommands = [];
  const vitalChangeCommands = [];
  const periodicVitalScheduleCandidates = [];
  const unresolved = [];
  const resolvedActionIds = [];
  const lastTriggerAtByPassiveKey = new Map();
  const triggerCountByPassiveKey = new Map();
  const internalCooldownSuppressions = [];
  const triggerLimitSuppressions = [];
  const conditionSuppressions = [];
  const derivedHitMissSuppressions = [];
  const equippedKiboBindings = collectEquippedKiboBindings(scenario);
  const equippedKiboIds = new Set(
    equippedKiboBindings.map(binding => binding.kiboId)
  );
  const acceptedSkillStartTransitionByActionId = new Map(
    (acceptedSkillStartTransitions ?? []).map(transition => [
      transition.actionId,
      transition,
    ])
  );

  for (const binding of equippedKiboBindings) {
    for (const unresolvedSkill of unresolvedByKiboId.get(binding.kiboId) ??
      []) {
      unresolved.push({
        actionId: null,
        sourceActorId: binding.actorId,
        kiboId: binding.kiboId,
        skillId: Number(unresolvedSkill.skillId),
        status: 'kibo-passive-runtime-unresolved',
        reasons: uniqueValues(
          unresolvedSkill.reasons?.length
            ? unresolvedSkill.reasons
            : ['kibo-passive-mechanic-unresolved']
        ),
        ...(unresolvedSkill.evidence
          ? { evidence: unresolvedSkill.evidence }
          : {}),
        provenance: unresolvedSkill.provenance ?? [],
      });
    }
    for (const definition of definitionsByKiboId.get(binding.kiboId) ?? []) {
      if (
        definition.mechanismFamily ===
          BEFORE_SKILL_COMPOSITE_MECHANISM_FAMILY &&
        definition.staticPropertyEffects?.length > 0
      ) {
        effectCommands.push(
          ...createStaticSelfPropertyCommands({
            scenario,
            binding,
            definition,
            catalog,
            unresolved,
            conditionSuppressions,
          })
        );
      }
      if (definition.mechanismFamily === PERIODIC_TEAM_HEAL_MECHANISM_FAMILY) {
        const artifacts = createPlayerTeamPeriodicHealArtifacts({
          scenario,
          binding,
          definition,
          catalog,
          unresolved,
          conditionSuppressions,
        });
        effectCommands.push(...artifacts.effectCommands);
        periodicVitalScheduleCandidates.push(...artifacts.scheduleCandidates);
        continue;
      }
      if (
        !SCENARIO_START_PROPERTY_MECHANISM_FAMILIES.has(
          definition.mechanismFamily
        )
      ) {
        continue;
      }
      effectCommands.push(
        ...createStaticSelfPropertyCommands({
          scenario,
          binding,
          definition,
          catalog,
          unresolved,
          conditionSuppressions,
        })
      );
    }
  }

  const orderedActions = [...(scenario.actions ?? [])].sort(
    (left, right) =>
      Number(left.startMs) - Number(right.startMs) ||
      compareActionSourceSequence(left, right)
  );
  for (const action of orderedActions) {
    if (executionByActionId.get(action.id)?.execute === false) continue;
    if (![ACTION_TYPES.SKILL, ACTION_TYPES.KIBO_EVENT].includes(action.type)) {
      continue;
    }
    const resolution = actionResolutionById?.get(action.id) ?? null;
    if (!resolution?.ready) continue;
    const actionOwnerKind = resolution.actionBinding?.ownerKind;
    let kiboId = null;
    let equippedBinding = null;
    if (actionOwnerKind === 'kibo') {
      kiboId = Number(resolution.actionBinding.ownerId);
      if (!Number.isInteger(kiboId)) continue;
      equippedBinding = equippedKiboBindings.find(
        binding =>
          binding.kiboId === kiboId &&
          String(binding.actorId) === String(action.actorId)
      );
    } else if (actionOwnerKind === 'actor') {
      equippedBinding = equippedKiboBindings.find(
        binding => String(binding.actorId) === String(action.actorId)
      );
      if (!equippedBinding) continue;
      kiboId = equippedBinding.kiboId;
      const ownerMatch = resolveActorActionOwnerMatch({
        scenario,
        action,
        bindingOwnerId: resolution.actionBinding.ownerId,
      });
      if (!ownerMatch.matched) {
        for (const definition of (definitionsByKiboId.get(kiboId) ?? []).filter(
          candidate =>
            isDefinitionPublishedByActionOwner(candidate, actionOwnerKind)
        )) {
          unresolved.push({
            actionId: action.id,
            sourceActorId: action.actorId ?? null,
            kiboId,
            skillId: Number(definition.skillId),
            status: 'kibo-passive-runtime-unresolved',
            reasons: [ownerMatch.reason],
            evidence: {
              actionActorId: action.actorId ?? null,
              bindingOwnerId: resolution.actionBinding.ownerId ?? null,
              actorOwnerCandidates: ownerMatch.candidates,
            },
            provenance: definition.provenance ?? [],
          });
        }
        continue;
      }
    } else {
      continue;
    }

    const actionDefinitions = (definitionsByKiboId.get(kiboId) ?? []).filter(
      definition =>
        isDefinitionPublishedByActionOwner(definition, actionOwnerKind)
    );
    if (actionDefinitions.length === 0) continue;
    resolvedActionIds.push(action.id);

    if (actionOwnerKind === 'kibo' && !equippedKiboIds.has(kiboId)) {
      for (const unresolvedSkill of unresolvedByKiboId.get(kiboId) ?? []) {
        unresolved.push({
          actionId: action.id,
          sourceActorId: action.actorId ?? null,
          kiboId,
          skillId: Number(unresolvedSkill.skillId),
          status: 'kibo-passive-runtime-unresolved',
          reasons: uniqueValues(
            unresolvedSkill.reasons?.length
              ? unresolvedSkill.reasons
              : ['kibo-passive-mechanic-unresolved']
          ),
          ...(unresolvedSkill.evidence
            ? { evidence: unresolvedSkill.evidence }
            : {}),
          provenance: unresolvedSkill.provenance ?? [],
        });
      }
    }

    for (const definition of actionDefinitions) {
      if (
        SCENARIO_START_ONLY_MECHANISM_FAMILIES.has(definition.mechanismFamily)
      ) {
        continue;
      }
      if (
        AFTER_RECEIVE_DAMAGE_MECHANISM_FAMILIES.has(
          definition.mechanismFamily
        )
      ) {
        continue;
      }
      if (
        ![
          ...DAMAGE_DEALT_PROPERTY_MECHANISM_FAMILIES,
          DERIVED_DAMAGE_MECHANISM_FAMILY,
          DERIVED_DOT_SELF_HEAL_MECHANISM_FAMILY,
          'before-kibo-skill-property-effect',
          BEFORE_SKILL_COMPOSITE_MECHANISM_FAMILY,
        ].includes(definition.mechanismFamily)
      ) {
        unresolved.push({
          actionId: action.id,
          kiboId,
          skillId: Number(definition.skillId),
          status: 'kibo-passive-runtime-unresolved',
          reasons: [
            `unsupported-kibo-passive-mechanism-family:${definition.mechanismFamily}`,
          ],
          provenance: definition.provenance ?? [],
        });
        continue;
      }
      const commandContext = {
        scenario,
        action,
        resolution,
        definition,
        kiboId,
        lastTriggerAtByPassiveKey,
        triggerCountByPassiveKey,
        internalCooldownSuppressions,
        triggerLimitSuppressions,
        conditionSuppressions,
        unresolved,
        equippedBinding,
        acceptedSkillStartTransition:
          acceptedSkillStartTransitionByActionId.get(action.id) ?? null,
      };
      if (
        definition.mechanismFamily === BEFORE_SKILL_COMPOSITE_MECHANISM_FAMILY
      ) {
        const artifacts = createBeforeSkillCompositeArtifacts(commandContext);
        effectCommands.push(...artifacts.effectCommands);
        vitalChangeCommands.push(...artifacts.vitalChangeCommands);
        continue;
      }
      if (definition.mechanismFamily === DERIVED_DAMAGE_MECHANISM_FAMILY) {
        derivedDamageCommands.push(
          ...createDerivedDamageCommands({
            ...commandContext,
            derivedHitMissSuppressions,
          })
        );
        continue;
      }
      if (
        definition.mechanismFamily === DERIVED_DOT_SELF_HEAL_MECHANISM_FAMILY
      ) {
        periodicVitalScheduleCandidates.push(
          ...createDerivedDotSelfHealScheduleCandidates(commandContext)
        );
        continue;
      }
      const createCommands =
        definition.mechanismFamily === 'before-kibo-skill-property-effect'
          ? createBeforeSkillPropertyCommands
          : createDamagePropertyStackCommands;
      effectCommands.push(
        ...createCommands({
          ...commandContext,
        })
      );
    }
  }

  for (const event of Array.isArray(kiboReceiveDamageEvents)
    ? kiboReceiveDamageEvents
    : []) {
    const binding = equippedKiboBindings.find(
      candidate => Number(candidate.kiboId) === Number(event.kiboId)
    );
    if (!binding) continue;
    for (const definition of definitionsByKiboId.get(binding.kiboId) ?? []) {
      if (
        AFTER_RECEIVE_DAMAGE_DERIVED_DAMAGE_MECHANISM_FAMILIES.has(
          definition.mechanismFamily
        ) &&
        (definition.runtimeGaps?.length ?? 0) === 0
      ) {
        derivedDamageCommands.push(
          ...createAfterReceiveDamageRetaliationCommands({
            scenario,
            binding,
            definition,
            event,
            catalog,
            unresolved,
            internalCooldownSuppressions,
            triggerLimitSuppressions,
            lastTriggerAtByPassiveKey,
            triggerCountByPassiveKey,
          })
        );
        continue;
      }
      if (
        !AFTER_RECEIVE_DAMAGE_MECHANISM_FAMILIES.has(
          definition.mechanismFamily
        ) ||
        (definition.runtimeGaps?.length ?? 0) > 0
      ) {
        continue;
      }
      effectCommands.push(
        ...createAfterReceiveDamageSelfPropertyCommands({
          scenario,
          binding,
          definition,
          event,
          catalog,
          unresolved,
          internalCooldownSuppressions,
          triggerLimitSuppressions,
          lastTriggerAtByPassiveKey,
          triggerCountByPassiveKey,
        })
      );
    }
  }

  const generatedEffectCommands =
    deduplicatePeriodicRootEffectCommands(effectCommands);
  const periodicVitalSchedules = deduplicatePeriodicVitalSchedules(
    periodicVitalScheduleCandidates
  );
  for (const schedule of periodicVitalSchedules) {
    if (
      schedule.sourceAttributionStatus !==
      'native-cover-survivor-order-unresolved'
    ) {
      continue;
    }
    unresolved.push({
      actionId: null,
      sourceActorId: null,
      kiboId: null,
      skillId: Number(schedule.passiveSkillId),
      targetKind: schedule.targetKind,
      targetId: schedule.targetId,
      status: 'kibo-passive-runtime-unresolved',
      reasons: ['periodic-heal-native-cover-survivor-order-unresolved'],
      evidence: {
        rootEffectId: schedule.rootEffectId,
        sourceSelectionPolicy: schedule.sourceSelectionPolicy,
        contributingSources: schedule.contributingSources,
        numericalImpact:
          'survivor-kibo-max-hp-and-shoot-heal-up-change-heal-output',
      },
      provenance: schedule.sourceIdentity?.provenance ?? [],
    });
  }
  const passiveRuntimeStates = createKiboPassiveRuntimeStates({
    equippedKiboBindings,
    definitionsByKiboId,
    lastTriggerAtByPassiveKey,
    triggerCountByPassiveKey,
  });
  const uniqueUnresolved = deduplicateUnresolved(unresolved);
  return {
    schemaVersion: 1,
    contractName: VERIFIED_KIBO_PASSIVE_GENERATION_CONTRACT_NAME,
    sourceKind: 'azpr-verified-kibo-passive-generation',
    status:
      uniqueUnresolved.length > 0
        ? 'verified-kibo-passive-generation-ready-with-explicit-gaps'
        : generatedEffectCommands.length > 0
          ? 'verified-kibo-passive-generation-ready'
          : 'verified-kibo-passive-generation-ready-no-effects',
    catalog: {
      kind: catalog?.kind ?? null,
      generatedAt: catalog?.generatedAt ?? null,
      definitionCount: catalog?.definitions?.length ?? 0,
      unresolvedDefinitionCount: catalog?.unresolved?.length ?? 0,
    },
    effectCommands: generatedEffectCommands,
    derivedDamageCommands,
    vitalChangeCommands,
    periodicVitalSchedules,
    internalCooldownSuppressions,
    triggerLimitSuppressions,
    conditionSuppressions,
    derivedHitMissSuppressions,
    runtimeStates: passiveRuntimeStates,
    unresolved: uniqueUnresolved,
    summary: {
      resolvedActionCount: new Set(resolvedActionIds).size,
      effectCommandCount: generatedEffectCommands.length,
      derivedDamageCommandCount: derivedDamageCommands.length,
      vitalChangeCommandCount: vitalChangeCommands.length,
      periodicVitalScheduleCount: periodicVitalSchedules.length,
      internalCooldownSuppressedTriggerCount:
        internalCooldownSuppressions.length,
      triggerLimitSuppressedTriggerCount: triggerLimitSuppressions.length,
      statefulPassiveRuntimeStateCount: passiveRuntimeStates.length,
      conditionSuppressedActionCount: conditionSuppressions.filter(
        row => row.actionId != null
      ).length,
      scenarioStartConditionSuppressedTargetCount: conditionSuppressions.filter(
        row => row.triggerEvent === 'scenario-start'
      ).length,
      conditionSuppressedTargetOrActionCount: conditionSuppressions.length,
      derivedHitMissSuppressedCount: derivedHitMissSuppressions.length,
      evidenceClosedDefinitionCount: catalog?.definitions?.length ?? 0,
      scenarioAssumedDefinitionCount: 0,
      unresolvedDefinitionCount: catalog?.unresolved?.length ?? 0,
      unresolvedActionPassiveCount: uniqueUnresolved.length,
      equippedKiboCount: equippedKiboBindings.length,
      staticSelfEffectCommandCount: generatedEffectCommands.filter(
        command => command.sourceIdentity?.triggerEvent === 'scenario-start'
      ).length,
      beforeSkillEffectCommandCount: generatedEffectCommands.filter(
        command =>
          command.sourceIdentity?.triggerEvent === 'skill-before' ||
          command.sourceIdentity?.triggerEvent === 'accepted-skill-start'
      ).length,
      acceptedSkillStartEffectCommandCount: generatedEffectCommands.filter(
        command =>
          command.sourceIdentity?.triggerEvent === 'accepted-skill-start'
      ).length,
      applied: true,
    },
    applied: true,
  };
}

function createPlayerTeamPeriodicHealArtifacts({
  scenario,
  binding,
  definition,
  catalog,
  unresolved,
  conditionSuppressions,
}) {
  const rootEffect = definition.rootEffect;
  const heal = definition.heal;
  if (!rootEffect || !heal) {
    unresolved.push({
      actionId: null,
      sourceActorId: binding.actorId,
      kiboId: binding.kiboId,
      skillId: Number(definition.skillId),
      status: 'kibo-passive-runtime-unresolved',
      reasons: ['periodic-heal-runtime-contract-incomplete'],
      evidence: {
        rootEffect: rootEffect ?? null,
        heal: heal ?? null,
      },
      provenance: definition.provenance ?? [],
    });
    return { effectCommands: [], scheduleCandidates: [] };
  }
  if (scenario?.initialRuntimeState?.source?.boundaryId) {
    unresolved.push({
      actionId: null,
      sourceActorId: binding.actorId,
      kiboId: binding.kiboId,
      skillId: Number(definition.skillId),
      status: 'kibo-passive-runtime-unresolved',
      reasons: ['periodic-heal-cycle-trigger-phase-inheritance-unresolved'],
      evidence: {
        boundaryId: scenario.initialRuntimeState.source.boundaryId,
        boundaryTimeMs:
          scenario.initialRuntimeState.source.boundaryTimeMs ?? null,
        nativePolicy:
          'cover-preserves-root-attacker-source-elapsed-and-trigger-phase',
      },
      provenance: definition.provenance ?? [],
    });
    return { effectCommands: [], scheduleCandidates: [] };
  }
  const bindingIdentity = validatePeriodicSourceBinding({
    scenario,
    binding,
  });
  if (!bindingIdentity.ready) {
    unresolved.push({
      actionId: null,
      sourceActorId: binding.actorId,
      kiboId: binding.kiboId,
      skillId: Number(definition.skillId),
      status: 'kibo-passive-runtime-unresolved',
      reasons: [bindingIdentity.reason],
      evidence: bindingIdentity,
      provenance: definition.provenance ?? [],
    });
    return { effectCommands: [], scheduleCandidates: [] };
  }
  const targets = definition.targets ?? [
    {
      target: 'local-player-all-entities',
      runtimeTargetKinds: [EFFECT_TARGET_KINDS.ACTOR, EFFECT_TARGET_KINDS.KIBO],
      directInjectTargetType: 15,
      directInjectTargetName: 'Player',
    },
  ];
  const projectedTargets = resolveScenarioStartTargets({
    scenario,
    binding,
    definition,
    targets,
    unresolved,
    conditionSuppressions,
  });
  const resolvedTargets = projectedTargets.filter(target => {
    if (target.targetSlotId != null) return true;
    unresolved.push({
      actionId: null,
      sourceActorId: binding.actorId,
      kiboId: binding.kiboId,
      skillId: Number(definition.skillId),
      targetKind: target.targetKind,
      targetId: String(target.targetId),
      status: 'kibo-passive-runtime-unresolved',
      reasons: ['periodic-heal-team-target-slot-identity-unresolved'],
      evidence: {
        projectedTarget: target,
      },
      provenance: definition.provenance ?? [],
    });
    return false;
  });
  const rootEffectId = `kibo-passive:${definition.skillId}:${rootEffect.sourceElementId}`;
  const formulaSource = {
    targetKind: EFFECT_TARGET_KINDS.KIBO,
    targetId: String(binding.actorId),
    targetActorId: String(binding.actorId),
    targetKiboId: binding.kiboId,
    targetSlotId: binding.slotId,
    targetPosition: binding.position,
  };
  const createSourceIdentity = target => ({
    packageId: catalog?.kind ?? 'azpr-kibo-passive-mechanics-catalog',
    catalogKind: catalog?.kind ?? 'azpr-kibo-passive-mechanics-catalog',
    actionBindingIdentity: `equipped-kibo|${binding.actorId}|${binding.kiboId}`,
    effectIdentity: rootEffectId,
    triggerEvent: definition.trigger?.event ?? 'time-loop',
    kiboId: binding.kiboId,
    passiveSkillId: Number(definition.skillId),
    triggerElementId: rootEffect.sourceElementId,
    triggerPathId: rootEffect.sourcePathId,
    effectElementId: heal.sourceElementId,
    effectPathId: heal.sourcePathId,
    directInjectTargetType: target.directInjectTargetType ?? null,
    directInjectTargetName: target.directInjectTargetName ?? null,
    sourceSlotId: binding.slotId,
    sourcePosition: binding.position,
    projectedFromContainer: target.projectedFromContainer ?? false,
    projectionScope: target.projectionScope ?? null,
    teamElementTag: target.teamElementTag ?? null,
    teamElementTagName: target.teamElementTagName ?? null,
    finalTargetKind: target.targetKind,
    finalTargetId: String(target.targetId),
    finalTargetActorId: target.targetActorId ?? String(target.targetId),
    finalTargetKiboId: target.targetKiboId ?? null,
    provenance: definition.provenance ?? [],
  });
  const effectCommands = resolvedTargets.map(target => ({
    id: `kibo-passive|${definition.skillId}|scenario-start|${binding.actorId}|${target.targetKind}|${target.targetId}|${rootEffect.sourceElementId}`,
    sourceActionId: null,
    sourceActionName: null,
    sourceActorId: binding.actorId,
    sourceActorName: binding.actorName,
    sourceKiboId: binding.kiboId,
    sourceSlotId: binding.slotId,
    sourcePosition: binding.position,
    effectId: rootEffectId,
    effectName: `${definition.name}-周期触发根`,
    operation: EFFECT_OPERATIONS.APPLY,
    targetKind: target.targetKind,
    targetId: String(target.targetId),
    targetActorId: target.targetActorId ?? String(target.targetId),
    targetKiboId: target.targetKiboId ?? null,
    targetSlotId: target.targetSlotId ?? null,
    targetPosition: target.targetPosition ?? null,
    semanticTargetKind: target.targetKind,
    timeMs: 0,
    durationMs: rootEffect.durationMs ?? null,
    stackMode: normalizeStackMode(rootEffect.stackMode),
    stackDelta: rootEffect.stackDelta ?? 1,
    maxStacks: rootEffect.maxStacks ?? 1,
    tags: [
      'kibo-passive',
      definition.mechanismFamily,
      'periodic-vital-root',
      `kibo:${binding.kiboId}`,
      `skill:${definition.skillId}`,
    ],
    sourceStatus: 'verified-passive-periodic-root-generated',
    confidence: definition.confidence ?? 'high',
    trackingStatus: 'applied',
    generatedVerified: true,
    appliedToCalculators: false,
    formulaSourceActorId: null,
    effectAdderActorId: null,
    modifiers: [],
    sourceIdentity: createSourceIdentity(target),
    contributingSources: [createPeriodicSourceContributor(binding)],
    formulaSource,
    sourceSelectionPolicy: 'native-inject-to-own-root-attacker',
    sourceAttributionStatus: 'native-first-root-source-verified',
  }));
  const scheduleCandidates = resolvedTargets.map(target => ({
    id: `kibo-passive-periodic-vital|${definition.skillId}|${rootEffect.sourceElementId}|${target.targetKind}|${target.targetId}`,
    passiveSkillId: Number(definition.skillId),
    passiveName: definition.name,
    mechanismFamily: definition.mechanismFamily,
    rootEffectId,
    rootElementId: rootEffect.sourceElementId,
    rootPathId: rootEffect.sourcePathId,
    targetKind: target.targetKind,
    targetId: String(target.targetId),
    targetActorId: target.targetActorId ?? String(target.targetId),
    targetKiboId: target.targetKiboId ?? null,
    targetSlotId: target.targetSlotId ?? null,
    targetPosition: target.targetPosition ?? null,
    sourceActorId: binding.actorId,
    sourceActorName: binding.actorName,
    sourceKiboId: binding.kiboId,
    sourceSlotId: binding.slotId,
    sourcePosition: binding.position,
    trigger: { ...definition.trigger },
    condition: { ...definition.condition },
    heal: {
      ...heal,
      formula: { ...heal.formula },
    },
    sourceIdentity: createSourceIdentity(target),
    contributingSources: [createPeriodicSourceContributor(binding)],
    formulaSource,
    sourceSelectionPolicy: 'native-inject-to-own-root-attacker',
    sourceAttributionStatus: 'native-first-root-source-verified',
    appliedToCalculators: true,
  }));
  return { effectCommands, scheduleCandidates };
}

function createPeriodicSourceContributor(binding) {
  return {
    sourceActorId: binding.actorId,
    sourceActorName: binding.actorName,
    sourceKiboId: binding.kiboId,
    sourceSlotId: binding.slotId,
    sourcePosition: binding.position,
  };
}

function validatePeriodicSourceBinding({ scenario, binding }) {
  if (!binding.slotId) {
    return {
      ready: false,
      reason: 'periodic-heal-source-slot-identity-unresolved',
      actorId: binding.actorId,
      kiboId: binding.kiboId,
      slotId: binding.slotId,
    };
  }
  const topologyGroups =
    scenario?.sourceProject?.metadata?.timelineTopology?.actorGroups;
  if (!Array.isArray(topologyGroups) || topologyGroups.length === 0) {
    return { ready: true, source: 'scenario.team.slots+actor.loadout' };
  }
  const group = topologyGroups.find(
    row => String(row?.actorId) === String(binding.actorId)
  );
  const topologyKiboId = Number(group?.kiboLane?.kiboId);
  if (
    !group ||
    String(group.slotId ?? '') !== String(binding.slotId) ||
    !Number.isInteger(topologyKiboId) ||
    topologyKiboId !== Number(binding.kiboId)
  ) {
    return {
      ready: false,
      reason: 'periodic-heal-source-loadout-topology-mismatch',
      actorId: binding.actorId,
      kiboId: binding.kiboId,
      slotId: binding.slotId,
      topologyGroup: group ?? null,
    };
  }
  return { ready: true, source: 'timeline-topology-verified' };
}

function deduplicatePeriodicVitalSchedules(candidates) {
  const schedulesByIdentity = new Map();
  for (const candidate of candidates) {
    const key = `${candidate.passiveSkillId}|${candidate.rootElementId}|${candidate.targetKind}|${candidate.targetId}`;
    const existing = schedulesByIdentity.get(key);
    if (!existing) {
      schedulesByIdentity.set(key, {
        ...candidate,
        contributingSources: [...candidate.contributingSources],
      });
      continue;
    }
    if (
      candidate.mechanismFamily === DERIVED_DOT_SELF_HEAL_MECHANISM_FAMILY
    ) {
      schedulesByIdentity.set(key, {
        ...candidate,
        contributingSources: [...candidate.contributingSources],
      });
      continue;
    }
    existing.contributingSources.push(...candidate.contributingSources);
  }
  return [...schedulesByIdentity.values()].map(schedule =>
    canonicalizePeriodicSource(schedule)
  );
}

function deduplicatePeriodicRootEffectCommands(commands) {
  const ordinaryCommands = [];
  const periodicByIdentity = new Map();
  for (const command of commands) {
    if (!(command.tags ?? []).includes('periodic-vital-root')) {
      ordinaryCommands.push(command);
      continue;
    }
    const key = `${command.sourceIdentity?.passiveSkillId}|${command.sourceIdentity?.triggerElementId}|${command.targetKind}|${command.targetId}`;
    const existing = periodicByIdentity.get(key);
    if (!existing) {
      periodicByIdentity.set(key, {
        ...command,
        contributingSources: [...command.contributingSources],
      });
      continue;
    }
    existing.contributingSources.push(...command.contributingSources);
  }
  return [
    ...ordinaryCommands,
    ...[...periodicByIdentity.values()].map(command =>
      canonicalizePeriodicSource(command)
    ),
  ];
}

function canonicalizePeriodicSource(value) {
  const contributingSources = [...(value.contributingSources ?? [])]
    .sort(comparePeriodicSourceContributors)
    .filter(
      (source, index, values) =>
        index === 0 ||
        `${source.sourceActorId}|${source.sourceKiboId}|${source.sourceSlotId}` !==
          `${values[index - 1].sourceActorId}|${values[index - 1].sourceKiboId}|${values[index - 1].sourceSlotId}`
    );
  const primary = contributingSources[0] ?? null;
  if (!primary) return { ...value, contributingSources };
  const hasSingleSource = contributingSources.length === 1;
  const formulaSource = hasSingleSource
    ? {
        ...value.formulaSource,
        targetKind: EFFECT_TARGET_KINDS.KIBO,
        targetId: String(primary.sourceActorId),
        targetActorId: String(primary.sourceActorId),
        targetKiboId: primary.sourceKiboId,
        targetSlotId: primary.sourceSlotId,
        targetPosition: primary.sourcePosition,
      }
    : null;
  const sourceAttributionStatus = hasSingleSource
    ? 'native-first-root-source-verified'
    : 'native-cover-survivor-order-unresolved';
  const sourceSelectionPolicy = hasSingleSource
    ? 'native-inject-to-own-root-attacker'
    : 'all-contributors-retained-native-cover-first-survivor-unresolved';
  return {
    ...value,
    sourceActorId: hasSingleSource ? primary.sourceActorId : null,
    sourceActorName: hasSingleSource ? primary.sourceActorName : null,
    sourceKiboId: hasSingleSource ? primary.sourceKiboId : null,
    sourceSlotId: hasSingleSource ? primary.sourceSlotId : null,
    sourcePosition: hasSingleSource ? primary.sourcePosition : null,
    formulaSource,
    formulaSourceActorId: null,
    effectAdderActorId: null,
    contributingSources,
    sourceSelectionPolicy,
    sourceAttributionStatus,
    sourceIdentity: {
      ...value.sourceIdentity,
      actionBindingIdentity: hasSingleSource
        ? `equipped-kibo|${primary.sourceActorId}|${primary.sourceKiboId}`
        : 'equipped-kibo|native-cover-survivor-order-unresolved',
      kiboId: hasSingleSource ? primary.sourceKiboId : null,
      sourceSlotId: hasSingleSource ? primary.sourceSlotId : null,
      sourcePosition: hasSingleSource ? primary.sourcePosition : null,
      sourceSelectionPolicy,
      sourceAttributionStatus,
      contributingSources,
    },
  };
}

function comparePeriodicSourceContributors(left, right) {
  return (
    (left.sourcePosition ?? Number.MAX_SAFE_INTEGER) -
      (right.sourcePosition ?? Number.MAX_SAFE_INTEGER) ||
    String(left.sourceActorId).localeCompare(String(right.sourceActorId)) ||
    Number(left.sourceKiboId) - Number(right.sourceKiboId)
  );
}

function createStaticSelfPropertyCommands({
  scenario,
  binding,
  definition,
  catalog,
  unresolved,
  conditionSuppressions,
}) {
  const effects =
    definition.scenarioStartEffects ??
    definition.staticPropertyEffects ??
    definition.effects ??
    [definition.effect].filter(Boolean);
  const targets = definition.scenarioStartTargets ??
    definition.targets ?? [
      {
        target: 'equipped-kibo',
        runtimeTargetKind: EFFECT_TARGET_KINDS.KIBO,
        directInjectTargetType: 0,
        directInjectTargetName: 'Self',
      },
    ];
  const resolvedTargets = resolveScenarioStartTargets({
    scenario,
    binding,
    definition,
    targets,
    unresolved,
    conditionSuppressions,
  });
  return effects.flatMap(effect =>
    resolvedTargets.map(target => ({
      id: `kibo-passive|${definition.skillId}|scenario-start|${binding.actorId}|${target.targetKind}${
        target.projectedFromContainer ? `|${target.targetId}` : ''
      }|${effect.sourceElementId}`,
      sourceActionId: null,
      sourceActionName: null,
      sourceActorId: binding.actorId,
      sourceActorName: binding.actorName,
      sourceKiboId: binding.kiboId,
      sourceSlotId: binding.slotId,
      sourcePosition: binding.position,
      effectId: `kibo-passive:${definition.skillId}:${effect.sourceElementId}`,
      effectName: definition.name,
      operation: EFFECT_OPERATIONS.APPLY,
      targetKind: target.targetKind,
      targetId: String(target.targetId),
      semanticTargetKind: target.targetKind,
      timeMs: 0,
      durationMs: effect.durationMs ?? null,
      stackMode: normalizeStackMode(effect.stackMode),
      stackDelta: effect.stackDelta ?? 1,
      maxStacks: effect.maxStacks ?? 1,
      tags: [
        'kibo-passive',
        definition.mechanismFamily,
        `kibo:${binding.kiboId}`,
        `skill:${definition.skillId}`,
      ],
      sourceStatus: 'verified-passive-effect-generated',
      confidence: definition.confidence ?? 'high',
      trackingStatus: 'applied',
      generatedVerified: true,
      appliedToCalculators: true,
      formulaSourceActorId: binding.actorId,
      effectAdderActorId: binding.actorId,
      modifiers: (effect.modifiers ?? []).map(modifier => ({
        ...modifier,
      })),
      sourceIdentity: {
        packageId: catalog?.kind ?? 'azpr-kibo-passive-mechanics-catalog',
        catalogKind: catalog?.kind ?? 'azpr-kibo-passive-mechanics-catalog',
        actionBindingIdentity: `equipped-kibo|${binding.actorId}|${binding.kiboId}`,
        effectIdentity: `kibo-passive:${definition.skillId}:${effect.sourceElementId}`,
        triggerEvent: 'scenario-start',
        kiboId: binding.kiboId,
        passiveSkillId: Number(definition.skillId),
        effectElementId: effect.sourceElementId ?? null,
        effectPathId: effect.sourcePathId ?? null,
        directInjectTargetType: target.directInjectTargetType ?? null,
        directInjectTargetName: target.directInjectTargetName ?? null,
        sourceSlotId: binding.slotId,
        sourcePosition: binding.position,
        projectedFromContainer: target.projectedFromContainer ?? false,
        projectionScope: target.projectionScope ?? null,
        teamElementTag: target.teamElementTag ?? null,
        teamElementTagName: target.teamElementTagName ?? null,
        finalTargetKind: target.targetKind,
        finalTargetId: String(target.targetId),
        elementalTypeMask: target.elementalTypeMask ?? null,
        elementalTypeSource: target.elementalTypeSource ?? null,
        condition: target.condition ?? null,
        provenance: definition.provenance ?? [],
      },
    }))
  );
}

function createAfterReceiveDamageSelfPropertyCommands({
  scenario,
  binding,
  definition,
  event,
  catalog,
  unresolved,
  internalCooldownSuppressions,
  triggerLimitSuppressions,
  lastTriggerAtByPassiveKey,
  triggerCountByPassiveKey,
}) {
  const trigger = definition.trigger ?? {};
  const effect = definition.effect ?? null;
  if (!effect || (effect.modifiers?.length ?? 0) === 0) {
    unresolved.push({
      actionId: null,
      sourceActorId: binding.actorId,
      kiboId: binding.kiboId,
      skillId: Number(definition.skillId),
      status: 'kibo-passive-runtime-unresolved',
      reasons: ['kibo-passive-after-receive-damage-effect-unresolved'],
      evidence: {
        trigger,
        event,
      },
      provenance: definition.provenance ?? [],
    });
    return [];
  }
  const passiveKey = `${binding.kiboId}:${definition.skillId}`;
  const internalCooldownMs = Number(trigger.internalCooldownMs) || 0;
  const lastTriggerAt = lastTriggerAtByPassiveKey.get(passiveKey) ?? -Infinity;
  if (Number(event.timeMs) < lastTriggerAt + internalCooldownMs) {
    internalCooldownSuppressions.push({
      actionId: null,
      sourceActorId: binding.actorId,
      kiboId: binding.kiboId,
      skillId: Number(definition.skillId),
      reason: 'kibo-passive-after-receive-damage-internal-cooldown',
      lastTriggerAt,
      internalCooldownMs,
      eventTimeMs: Number(event.timeMs),
    });
    return [];
  }
  const triggerCount = triggerCountByPassiveKey.get(passiveKey) ?? 0;
  const maxTriggerCount =
    trigger.maxTriggerCount == null ? null : Number(trigger.maxTriggerCount);
  if (maxTriggerCount != null && triggerCount >= maxTriggerCount) {
    triggerLimitSuppressions.push({
      actionId: null,
      sourceActorId: binding.actorId,
      kiboId: binding.kiboId,
      skillId: Number(definition.skillId),
      reason: 'kibo-passive-after-receive-damage-trigger-limit',
      triggerCount,
      maxTriggerCount,
    });
    return [];
  }
  lastTriggerAtByPassiveKey.set(passiveKey, Number(event.timeMs));
  triggerCountByPassiveKey.set(passiveKey, triggerCount + 1);
  const targetKind = EFFECT_TARGET_KINDS.KIBO;
  const targetId = binding.actorId;
  return [
    {
      id: `kibo-passive|${definition.skillId}|damage-received|${binding.actorId}|${event.sourceEventIdentity}|${effect.sourceElementId}`,
      sourceActionId: null,
      sourceActionName: null,
      sourceActorId: binding.actorId,
      sourceActorName: binding.actorName,
      sourceKiboId: binding.kiboId,
      sourceSlotId: binding.slotId,
      sourcePosition: binding.position,
      effectId: `kibo-passive:${definition.skillId}:${effect.sourceElementId}`,
      effectName: definition.name,
      operation: EFFECT_OPERATIONS.APPLY,
      targetKind,
      targetId: String(targetId),
      semanticTargetKind: targetKind,
      timeMs: Number(event.timeMs),
      durationMs: effect.durationMs ?? null,
      stackMode: normalizeStackMode(effect.stackMode),
      stackDelta: effect.stackDelta ?? 1,
      maxStacks: effect.maxStacks ?? 1,
      tags: [
        'kibo-passive',
        definition.mechanismFamily,
        `kibo:${binding.kiboId}`,
        `skill:${definition.skillId}`,
      ],
      sourceStatus: 'verified-passive-effect-generated',
      confidence: definition.confidence ?? 'high',
      trackingStatus: 'applied',
      generatedVerified: true,
      appliedToCalculators: true,
      formulaSourceActorId: binding.actorId,
      effectAdderActorId: binding.actorId,
      modifiers: (effect.modifiers ?? []).map(modifier => ({
        ...modifier,
      })),
      sourceIdentity: {
        packageId: catalog?.kind ?? 'azpr-kibo-passive-mechanics-catalog',
        catalogKind: catalog?.kind ?? 'azpr-kibo-passive-mechanics-catalog',
        actionBindingIdentity: `equipped-kibo|${binding.actorId}|${binding.kiboId}`,
        effectIdentity: `kibo-passive:${definition.skillId}:${effect.sourceElementId}`,
        triggerEvent: 'damage-received',
        receiveDamageEventIdentity: event.sourceEventIdentity ?? null,
        kiboId: binding.kiboId,
        passiveSkillId: Number(definition.skillId),
        effectElementId: effect.sourceElementId ?? null,
        effectPathId: effect.sourcePathId ?? null,
        sourceSlotId: binding.slotId,
        sourcePosition: binding.position,
        provenance: definition.provenance ?? [],
      },
    },
  ];
}

function createAfterReceiveDamageRetaliationCommands({
  scenario,
  binding,
  definition,
  event,
  catalog,
  unresolved,
  internalCooldownSuppressions,
  triggerLimitSuppressions,
  lastTriggerAtByPassiveKey,
  triggerCountByPassiveKey,
}) {
  const enemyId = scenario.enemy?.id ?? scenario.enemy?.enemyId ?? null;
  const derivedDamage = definition.derivedDamage ?? null;
  if (enemyId == null || !derivedDamage) {
    unresolved.push({
      actionId: null,
      sourceActorId: binding.actorId,
      kiboId: binding.kiboId,
      skillId: Number(definition.skillId),
      status: 'kibo-passive-runtime-unresolved',
      reasons: ['kibo-passive-retaliation-damage-config-unresolved'],
      evidence: {
        trigger: definition.trigger ?? null,
        event,
      },
      provenance: definition.provenance ?? [],
    });
    return [];
  }
  const passiveKey = `${binding.kiboId}:${definition.skillId}`;
  const internalCooldownMs = Number(definition.trigger?.internalCooldownMs) || 0;
  const lastTriggerAt = lastTriggerAtByPassiveKey.get(passiveKey) ?? -Infinity;
  if (Number(event.timeMs) < lastTriggerAt + internalCooldownMs) {
    internalCooldownSuppressions.push({
      actionId: null,
      sourceActorId: binding.actorId,
      kiboId: binding.kiboId,
      skillId: Number(definition.skillId),
      reason: 'kibo-passive-after-receive-damage-internal-cooldown',
      lastTriggerAt,
      internalCooldownMs,
      eventTimeMs: Number(event.timeMs),
    });
    return [];
  }
  const triggerCount = triggerCountByPassiveKey.get(passiveKey) ?? 0;
  const maxTriggerCount =
    definition.trigger?.maxTriggerCount == null
      ? null
      : Number(definition.trigger.maxTriggerCount);
  if (maxTriggerCount != null && triggerCount >= maxTriggerCount) {
    triggerLimitSuppressions.push({
      actionId: null,
      sourceActorId: binding.actorId,
      kiboId: binding.kiboId,
      skillId: Number(definition.skillId),
      reason: 'kibo-passive-after-receive-damage-trigger-limit',
      triggerCount,
      maxTriggerCount,
    });
    return [];
  }
  lastTriggerAtByPassiveKey.set(passiveKey, Number(event.timeMs));
  triggerCountByPassiveKey.set(passiveKey, triggerCount + 1);
  const timeMs = Number(event.timeMs) + 0.001;
  const retaliationIdentity = `kibo-passive:${definition.skillId}:retaliation:${event.sourceEventIdentity ?? 'event'}`;
  return [
    {
      id: `kibo-passive|${definition.skillId}|retaliation|${binding.actorId}|${event.sourceEventIdentity}`,
      sourceActionId: null,
      sourceActionName: null,
      sourceActorId: binding.actorId,
      sourceActorName: binding.actorName,
      sourceKiboId: binding.kiboId,
      targetKind: EFFECT_TARGET_KINDS.ENEMY,
      targetId: String(enemyId),
      timeMs,
      passiveSkillId: Number(definition.skillId),
      retaliationEventIdentity: event.sourceEventIdentity ?? null,
      ignoreDamageEvent:
        derivedDamage.eventPolicy?.ignoreDamageEvent === true,
      emitsDamageTriggerEvents:
        derivedDamage.eventPolicy?.emitsDamageTriggerEvents === true,
      recursivePassiveTrigger:
        derivedDamage.eventPolicy?.recursivePassiveTrigger === true,
      criticalPolicy:
        derivedDamage.criticalPolicy ??
        'scenario-policy-with-derived-hit-override',
      tags: [
        'kibo-passive',
        definition.mechanismFamily,
        `kibo:${binding.kiboId}`,
        `skill:${definition.skillId}`,
      ],
      sourceStatus: 'verified-passive-retaliation-damage-generated',
      confidence: definition.confidence ?? 'high',
      trackingStatus: 'applied',
      generatedVerified: true,
      appliedToCalculators: true,
      hit: {
        hitIndex: 1,
        hitIdentity: retaliationIdentity,
        elementId: derivedDamage.sourceElementId ?? null,
        pathId: derivedDamage.sourcePathId ?? null,
        name: definition.name,
        displayLabel: `${definition.name} · 受击反击`,
        referenceKind: 'kibo-passive-retaliation-damage',
        sourceIdentity: retaliationIdentity,
        formula: derivedDamage.formula ?? null,
        damage: derivedDamage.damage ?? null,
        energy: {
          recoverSp: derivedDamage.damage?.recoverSp ?? 0,
          petRecoverSp: derivedDamage.damage?.petRecoverSp ?? 0,
          recoverIntervalMs: 0,
        },
      },
      sourceIdentity: {
        packageId: catalog?.kind ?? 'azpr-kibo-passive-mechanics-catalog',
        catalogKind: catalog?.kind ?? 'azpr-kibo-passive-mechanics-catalog',
        actionBindingIdentity: `equipped-kibo|${binding.actorId}|${binding.kiboId}`,
        triggerEvent: 'damage-received',
        receiveDamageEventIdentity: event.sourceEventIdentity ?? null,
        kiboId: binding.kiboId,
        passiveSkillId: Number(definition.skillId),
        triggerElementId: definition.trigger?.sourceElementId ?? null,
        triggerPathId: definition.trigger?.sourcePathId ?? null,
        damageElementId: derivedDamage.sourceElementId ?? null,
        damagePathId: derivedDamage.sourcePathId ?? null,
        retaliationIdentity,
        triggerCondition: definition.trigger?.condition ?? null,
        provenance: definition.provenance ?? [],
      },
    },
  ];
}

function resolveScenarioStartTargets({
  scenario,
  binding,
  definition,
  targets,
  unresolved,
  conditionSuppressions,
}) {
  return targets.flatMap(target => {
    if (Number(target.directInjectTargetType) !== 15) {
      return [
        {
          ...target,
          targetKind: target.runtimeTargetKind,
          targetId: binding.actorId,
          projectedFromContainer: false,
        },
      ];
    }

    const projection = definition.targetProjection ?? {};
    if (
      projection.container !== 'player' ||
      projection.teamElementTag !== 1000 ||
      projection.scope !== 'local-player-all-entities'
    ) {
      unresolved.push({
        actionId: null,
        sourceActorId: binding.actorId,
        kiboId: binding.kiboId,
        skillId: Number(definition.skillId),
        status: 'kibo-passive-runtime-unresolved',
        reasons: ['player-team-target-projection-contract-unsupported'],
        evidence: {
          target,
          targetProjection: projection,
        },
        provenance: definition.provenance ?? [],
      });
      return [];
    }

    return collectLocalPlayerEntityTargets(scenario).flatMap(candidate => {
      const condition = projection.filter ?? null;
      if (!condition) {
        return [
          createProjectedTeamTarget({
            target,
            projection,
            candidate,
            condition,
          }),
        ];
      }
      if (
        condition.kind !== 'entity-elemental-type-mask' ||
        condition.operator !== 'bitwise-overlap-nonzero' ||
        condition.checkType !== 0 ||
        condition.targetType !== 1
      ) {
        unresolved.push({
          actionId: null,
          sourceActorId: binding.actorId,
          kiboId: binding.kiboId,
          skillId: Number(definition.skillId),
          targetKind: candidate.targetKind,
          targetId: candidate.targetId,
          status: 'kibo-passive-runtime-unresolved',
          reasons: ['player-team-target-condition-contract-unsupported'],
          evidence: {
            targetProjection: projection,
            candidate,
          },
          provenance: definition.provenance ?? [],
        });
        return [];
      }

      const elementalType = resolveProjectedTargetElementalType({
        scenario,
        candidate,
      });
      if (!elementalType.ready) {
        unresolved.push({
          actionId: null,
          sourceActorId: binding.actorId,
          kiboId: binding.kiboId,
          skillId: Number(definition.skillId),
          targetKind: candidate.targetKind,
          targetId: candidate.targetId,
          status: 'kibo-passive-runtime-unresolved',
          reasons: ['player-team-target-elemental-type-unresolved'],
          evidence: {
            targetProjection: projection,
            candidate: {
              targetKind: candidate.targetKind,
              targetId: candidate.targetId,
              actorId: candidate.actorId,
              kiboId: candidate.kiboId ?? null,
            },
            elementalTypeResolution: elementalType,
          },
          provenance: definition.provenance ?? [],
        });
        return [];
      }

      const requiredMask = Number(condition.elementalTypeMask);
      if ((elementalType.mask & requiredMask) === 0) {
        conditionSuppressions.push({
          actionId: null,
          triggerEvent: 'scenario-start',
          sourceActorId: binding.actorId,
          kiboId: binding.kiboId,
          skillId: Number(definition.skillId),
          targetKind: candidate.targetKind,
          targetId: candidate.targetId,
          condition,
          actualElementalTypeMask: elementalType.mask,
          elementalTypeSource: elementalType.source,
          reason: 'entity-elemental-type-mask-not-matched',
        });
        return [];
      }

      return [
        createProjectedTeamTarget({
          target,
          projection,
          candidate: {
            ...candidate,
            elementalTypeMask: elementalType.mask,
            elementalTypeSource: elementalType.source,
          },
          condition,
        }),
      ];
    });
  });
}

function createProjectedTeamTarget({
  target,
  projection,
  candidate,
  condition,
}) {
  return {
    ...target,
    targetKind: candidate.targetKind,
    targetId: candidate.targetId,
    projectedFromContainer: true,
    projectionScope: projection.scope,
    teamElementTag: projection.teamElementTag,
    teamElementTagName: projection.teamElementTagName,
    targetSlotId: candidate.targetSlotId ?? null,
    targetPosition: candidate.targetPosition ?? null,
    targetActorId: candidate.actorId ?? String(candidate.targetId),
    targetKiboId: candidate.kiboId ?? null,
    elementalTypeMask: candidate.elementalTypeMask ?? null,
    elementalTypeSource: candidate.elementalTypeSource ?? null,
    condition,
  };
}

function collectLocalPlayerEntityTargets(scenario) {
  return (scenario?.actors ?? [])
    .flatMap(actor => {
      if (actor?.id == null) return [];
      const actorId = String(actor.id);
      const teamSlot = (scenario?.team?.slots ?? []).find(
        slot => String(slot?.actorId) === actorId
      );
      const targetSlotId = teamSlot?.id ?? teamSlot?.slotId ?? null;
      const targetPosition = Number.isInteger(Number(teamSlot?.position))
        ? Number(teamSlot.position)
        : null;
      const candidates = [
        {
          targetKind: EFFECT_TARGET_KINDS.ACTOR,
          targetId: actorId,
          actorId,
          actor,
          targetActorId: actorId,
          targetKiboId: null,
          targetSlotId,
          targetPosition,
        },
      ];
      const kiboId = Number(actor?.loadout?.kiboId);
      if (Number.isInteger(kiboId) && kiboId > 0) {
        candidates.push({
          targetKind: EFFECT_TARGET_KINDS.KIBO,
          targetId: actorId,
          actorId,
          actor,
          kiboId,
          targetActorId: actorId,
          targetKiboId: kiboId,
          targetSlotId,
          targetPosition,
        });
      }
      return candidates;
    })
    .sort(
      (left, right) =>
        (left.targetPosition ?? Number.MAX_SAFE_INTEGER) -
          (right.targetPosition ?? Number.MAX_SAFE_INTEGER) ||
        String(left.targetKind).localeCompare(String(right.targetKind)) ||
        String(left.targetId).localeCompare(String(right.targetId))
    );
}

function resolveProjectedTargetElementalType({ scenario, candidate }) {
  if (candidate.targetKind === EFFECT_TARGET_KINDS.ACTOR) {
    const elementId = Number(candidate.actor?.elementId);
    if (!Number.isInteger(elementId) || elementId < 0 || elementId > 9) {
      return {
        ready: false,
        mask: null,
        source: 'scenario.actors[].elementId',
        reason: 'actor-element-id-missing-or-unsupported',
      };
    }
    return {
      ready: true,
      mask: 1 << elementId,
      source: 'scenario.actors[].elementId',
      elementIds: [elementId],
    };
  }

  const kiboReference = resolveKiboGameDataReference({
    scenario,
    actor: candidate.actor,
    kiboId: candidate.kiboId,
  });
  if (!kiboReference.ready) return kiboReference;
  const tokens = String(kiboReference.record.element ?? '')
    .split(/[、|,，/\s]+/)
    .map(token => token.trim())
    .filter(Boolean);
  const elementIds = tokens.map(token => KIBO_ELEMENT_ID_BY_TOKEN[token]);
  if (
    tokens.length === 0 ||
    elementIds.some(elementId => !Number.isInteger(elementId))
  ) {
    return {
      ready: false,
      mask: null,
      source: kiboReference.source,
      reason: 'kibo-element-token-missing-or-unsupported',
      elementTokens: tokens,
    };
  }
  return {
    ready: true,
    mask: elementIds.reduce((mask, elementId) => mask | (1 << elementId), 0),
    source: `${kiboReference.source}.element`,
    elementIds,
    elementTokens: tokens,
  };
}

function resolveKiboGameDataReference({ scenario, actor, kiboId }) {
  const mechanismActor = (scenario?.mechanismConfiguration?.actors ?? []).find(
    row => String(row?.actorId) === String(actor?.id)
  );
  const candidates = [
    {
      source:
        'scenario.mechanismConfiguration.actors[].loadout.gameDataReferences.kibo.record',
      record: mechanismActor?.loadout?.gameDataReferences?.kibo?.record ?? null,
    },
    {
      source: 'scenario.actors[].loadout.gameDataReferences.kibo.record',
      record: actor?.loadout?.gameDataReferences?.kibo?.record ?? null,
    },
  ];
  for (const candidate of candidates) {
    if (candidate.record && Number(candidate.record.id) === Number(kiboId)) {
      return {
        ready: true,
        source: candidate.source,
        record: candidate.record,
      };
    }
  }
  return {
    ready: false,
    mask: null,
    source: candidates.map(candidate => candidate.source).join('|'),
    reason: 'equipped-kibo-game-data-reference-missing-or-mismatched',
    expectedKiboId: Number(kiboId),
  };
}

const KIBO_ELEMENT_ID_BY_TOKEN = Object.freeze({
  无: 0,
  火: 1,
  风: 2,
  地: 3,
  木: 4,
  冰: 5,
  水: 6,
  雷: 7,
  光: 8,
  暗: 9,
});

function collectEquippedKiboBindings(scenario) {
  const result = [];
  for (const actor of scenario?.actors ?? []) {
    const kiboId = Number(actor?.loadout?.kiboId);
    if (!Number.isInteger(kiboId) || kiboId <= 0 || actor?.id == null) {
      continue;
    }
    const teamSlot = (scenario?.team?.slots ?? []).find(
      slot => String(slot?.actorId) === String(actor.id)
    );
    result.push({
      actorId: String(actor.id),
      actorName: actor.name ?? null,
      kiboId,
      slotId: teamSlot?.id ?? teamSlot?.slotId ?? null,
      position: Number.isInteger(Number(teamSlot?.position))
        ? Number(teamSlot.position)
        : null,
    });
  }
  return result.sort(
    (left, right) =>
      (left.position ?? Number.MAX_SAFE_INTEGER) -
        (right.position ?? Number.MAX_SAFE_INTEGER) ||
      left.actorId.localeCompare(right.actorId) ||
      left.kiboId - right.kiboId
  );
}

function createKiboPassiveRuntimeStates({
  equippedKiboBindings,
  definitionsByKiboId,
  lastTriggerAtByPassiveKey,
  triggerCountByPassiveKey,
}) {
  const states = new Map();
  for (const binding of equippedKiboBindings ?? []) {
    for (const definition of definitionsByKiboId.get(binding.kiboId) ?? []) {
      const passiveKey = createKiboPassiveRuntimeKey({
        actorId: binding.actorId,
        kiboId: binding.kiboId,
        skillId: definition.skillId,
      });
      const state = createKiboPassiveRuntimeState({
        passiveKey,
        actorId: binding.actorId,
        slotId: binding.slotId,
        kiboId: binding.kiboId,
        definition,
        lastTriggerAtByPassiveKey,
        triggerCountByPassiveKey,
      });
      if (state) states.set(passiveKey, state);
    }
  }
  const observedPassiveKeys = new Set([
    ...lastTriggerAtByPassiveKey.keys(),
    ...triggerCountByPassiveKey.keys(),
  ]);
  for (const passiveKey of observedPassiveKeys) {
    if (states.has(passiveKey)) continue;
    const identity = parseKiboPassiveRuntimeKey(passiveKey);
    if (!identity) continue;
    const definition = (definitionsByKiboId.get(identity.kiboId) ?? []).find(
      candidate => Number(candidate.skillId) === identity.skillId
    );
    if (!definition) continue;
    const binding = (equippedKiboBindings ?? []).find(
      candidate =>
        candidate.kiboId === identity.kiboId &&
        String(candidate.actorId) === identity.actorId
    );
    const state = createKiboPassiveRuntimeState({
      passiveKey,
      actorId: identity.actorId,
      slotId: binding?.slotId,
      kiboId: identity.kiboId,
      definition,
      lastTriggerAtByPassiveKey,
      triggerCountByPassiveKey,
    });
    if (state) states.set(passiveKey, state);
  }
  return [...states.values()].sort(
    (left, right) =>
      String(left.actorId).localeCompare(String(right.actorId), 'en') ||
      left.kiboId - right.kiboId ||
      left.skillId - right.skillId
  );
}

function createKiboPassiveRuntimeState({
  passiveKey,
  actorId,
  slotId,
  kiboId,
  definition,
  lastTriggerAtByPassiveKey,
  triggerCountByPassiveKey,
}) {
  const internalCooldownMs = nonNegativeNumber(
    definition.trigger?.internalCooldownMs
  );
  const triggerLifetime = resolveTriggerLifetime(definition.trigger);
  const maxTriggerCount = triggerLifetime.maxTriggerCount;
  const lastTriggerAtMs = numberOrNull(
    lastTriggerAtByPassiveKey.get(passiveKey)
  );
  const triggerCount = Math.max(
    0,
    Number(triggerCountByPassiveKey.get(passiveKey)) || 0
  );
  if (
    !(internalCooldownMs > 0) &&
    triggerLifetime.classification === 'unlimited' &&
    triggerCount === 0
  ) {
    return null;
  }
  return {
    stateIdentity: `kibo-passive-runtime:${passiveKey}`,
    passiveKey,
    actorId,
    slotId: slotId ?? null,
    kiboId,
    skillId: Number(definition.skillId),
    internalCooldownMs,
    lastTriggerAtMs,
    cooldownReadyAtMs:
      lastTriggerAtMs == null || internalCooldownMs <= 0
        ? null
        : lastTriggerAtMs + internalCooldownMs,
    triggerCount,
    configuredTriggerCounter:
      triggerLifetime.configuredTriggerCounter ?? null,
    triggerLifetime: triggerLifetime.classification,
    triggerLifetimeBasis: triggerLifetime.basis,
    maxTriggerCount,
    remainingTriggerCount:
      maxTriggerCount == null
        ? null
        : Math.max(0, maxTriggerCount - triggerCount),
    triggerLimitScope:
      definition.trigger?.triggerLimitScope ?? 'passive-element-lifetime',
    sourceIdentity: {
      passiveSkillId: Number(definition.skillId),
      mechanismFamily: definition.mechanismFamily ?? null,
      triggerSourceElementId: definition.trigger?.sourceElementId ?? null,
    },
  };
}

function createKiboPassiveRuntimeKey({ actorId, kiboId, skillId }) {
  return `${actorId ?? 'actor-unresolved'}|${Number(kiboId)}|${Number(skillId)}`;
}

function parseKiboPassiveRuntimeKey(passiveKey) {
  const parts = String(passiveKey).split('|');
  if (parts.length < 3) return null;
  const skillId = Number(parts.pop());
  const kiboId = Number(parts.pop());
  const actorId = parts.join('|');
  if (!actorId || !Number.isInteger(kiboId) || !Number.isInteger(skillId)) {
    return null;
  }
  return { actorId, kiboId, skillId };
}

function createDamagePropertyStackCommands({
  scenario,
  action,
  resolution,
  definition,
  kiboId,
  equippedBinding,
  lastTriggerAtByPassiveKey,
  triggerCountByPassiveKey,
  internalCooldownSuppressions,
  triggerLimitSuppressions,
  conditionSuppressions,
}) {
  const triggerCondition = definition.trigger?.condition ?? null;
  const hitScopedCondition =
    triggerCondition?.kind === 'damage-type-and-elemental-type';
  const conditionResult = hitScopedCondition
    ? null
    : evaluateTriggerCondition({
        condition: triggerCondition,
        scenario,
        resolution,
      });
  if (conditionResult && !conditionResult.matched) {
    conditionSuppressions.push({
      actionId: action.id,
      kiboId,
      skillId: Number(definition.skillId),
      condition: triggerCondition,
      actualTargetEntityType: conditionResult.actualTargetEntityType,
      entityTypeSource: conditionResult.entityTypeSource,
      actualSkillTags: conditionResult.actualSkillTags,
      skillTagSource: conditionResult.skillTagSource,
      reason: conditionResult.reason,
    });
    return [];
  }
  const frameRate =
    positiveNumber(resolution.controlBinding?.frameRate) ?? DEFAULT_FRAME_RATE;
  const activationDelayMs = nonNegativeNumber(
    definition.trigger?.activationDelayMs
  );
  const internalCooldownMs = nonNegativeNumber(
    definition.trigger?.internalCooldownMs
  );
  const maxTriggerCount = resolveTriggerLifetime(
    definition.trigger
  ).maxTriggerCount;
  const candidates = (resolution.hits ?? [])
    .filter(
      hit =>
        hit.damage &&
        Number.isFinite(Number(hit.trigger?.startFrame)) &&
        isActionFrameWithinContextualOccupancy(
          action,
          hit.trigger.startFrame,
          frameRate
        )
    )
    .map(hit => ({
      hit,
      hitTimeMs:
        Number(action.startMs) +
        (Number(hit.trigger.startFrame) * 1000) / frameRate,
    }))
    .sort(
      (left, right) =>
        left.hitTimeMs - right.hitTimeMs ||
        String(left.hit.hitIdentity).localeCompare(
          String(right.hit.hitIdentity)
        )
    );
  const commands = [];
  for (const candidate of candidates) {
    const { hit, hitTimeMs } = candidate;
    const hitIdentity =
      hit.hitIdentity ??
      `${hit.elementId ?? 'element'}:${hit.hitIndex ?? 'hit'}`;
    if (hitScopedCondition) {
      const hitConditionResult = evaluateDamageOutputCondition({
        condition: triggerCondition,
        hit,
      });
      if (!hitConditionResult.matched) {
        conditionSuppressions.push({
          actionId: action.id,
          kiboId,
          skillId: Number(definition.skillId),
          hitIdentity,
          hitTimeMs,
          conditionScope: 'damage-hit',
          condition: triggerCondition,
          actualDamageType: hitConditionResult.actualDamageType,
          actualElementalType: hitConditionResult.actualElementalType,
          reason: hitConditionResult.reason,
        });
        continue;
      }
    }
    const passiveKey = createKiboPassiveRuntimeKey({
      actorId: action.actorId,
      kiboId,
      skillId: definition.skillId,
    });
    const triggerCount = triggerCountByPassiveKey.get(passiveKey) ?? 0;
    if (maxTriggerCount != null && triggerCount >= maxTriggerCount) {
      triggerLimitSuppressions.push({
        actionId: action.id,
        kiboId,
        skillId: Number(definition.skillId),
        hitIdentity,
        hitTimeMs,
        triggerCount,
        maxTriggerCount,
        triggerLimitScope:
          definition.trigger?.triggerLimitScope ?? 'passive-element-lifetime',
        reason: 'kibo-passive-trigger-count-limit-reached',
      });
      continue;
    }
    const lastTriggerAtMs = lastTriggerAtByPassiveKey.get(passiveKey);
    if (
      lastTriggerAtMs != null &&
      hitTimeMs - lastTriggerAtMs < internalCooldownMs
    ) {
      internalCooldownSuppressions.push({
        actionId: action.id,
        kiboId,
        skillId: Number(definition.skillId),
        hitIdentity,
        hitTimeMs,
        lastTriggerAtMs,
        internalCooldownMs,
        reason: 'kibo-passive-internal-cooldown-active',
      });
      continue;
    }
    lastTriggerAtByPassiveKey.set(passiveKey, hitTimeMs);
    triggerCountByPassiveKey.set(passiveKey, triggerCount + 1);
    const timeMs = hitTimeMs + activationDelayMs;
    const effects = definition.effects ?? [definition.effect].filter(Boolean);
    commands.push(
      ...effects.flatMap(effect => {
        const target = resolveDamageTriggeredPropertyTarget({
          effect,
          scenario,
          action,
        });
        if (!target) return [];
        return [
          {
            id: `kibo-passive|${definition.skillId}|${action.id}|${hitIdentity}${
              effects.length > 1 ? `|${effect.sourceElementId}` : ''
            }`,
            sourceActionId: action.id,
            sourceActionName: action.name,
            sourceActorId: action.actorId,
            sourceActorName: action.actor?.name ?? null,
            sourceKiboId: kiboId,
            sourceSlotId: equippedBinding?.slotId ?? null,
            effectId: `kibo-passive:${definition.skillId}:${effect.sourceElementId}`,
            effectName: definition.name,
            operation: EFFECT_OPERATIONS.APPLY,
            targetKind: target.targetKind,
            targetId: target.targetId,
            semanticTargetKind: target.targetKind,
            timeMs,
            durationMs: effect.durationMs ?? null,
            expiration: effect.expiration ?? null,
            expirationTriggers: [...(effect.expirationTriggers ?? [])],
            clearType: numberOrNull(effect.clearType),
            clearTypeFlags: [...(effect.clearTypeFlags ?? [])],
            clearCarrierActorId: [
              EFFECT_TARGET_KINDS.ACTOR,
              EFFECT_TARGET_KINDS.KIBO,
            ].includes(target.targetKind)
              ? target.targetId
              : null,
            stackMode: normalizeStackMode(effect.stackMode),
            stackDelta: effect.stackDelta ?? 1,
            maxStacks: effect.maxStacks ?? 1,
            tags: [
              'kibo-passive',
              definition.mechanismFamily,
              `kibo:${kiboId}`,
              `skill:${definition.skillId}`,
            ],
            sourceStatus: 'verified-passive-effect-generated',
            confidence: definition.confidence ?? 'high',
            trackingStatus: 'applied',
            generatedVerified: true,
            appliedToCalculators: true,
            formulaSourceActorId: action.actorId,
            effectAdderActorId: action.actorId,
            modifiers: (effect.modifiers ?? []).map(modifier => ({
              ...modifier,
            })),
            sourceIdentity: {
              catalogKind: 'azpr-kibo-passive-mechanics-catalog',
              actionBindingIdentity: resolution.actionBinding?.identity ?? null,
              effectIdentity: `kibo-passive:${definition.skillId}:${effect.sourceElementId}`,
              triggerEvent: 'damage-dealt',
              kiboId,
              passiveSkillId: Number(definition.skillId),
              triggerElementId: definition.trigger?.sourceElementId ?? null,
              triggerPathId: definition.trigger?.sourcePathId ?? null,
              effectElementId: effect.sourceElementId ?? null,
              effectPathId: effect.sourcePathId ?? null,
              triggerEffectTargetType:
                effect.triggerEffectTargetType ??
                target.triggerEffectTargetType,
              triggerEffectTargetName:
                effect.triggerEffectTargetName ??
                target.triggerEffectTargetName,
              hitIdentity,
              triggerDamageType: Number(hit.damage?.damageType),
              triggerElementalType: Number(hit.damage?.elementalType),
              triggerCondition: definition.trigger?.condition ?? null,
              configuredTriggerCounter:
                definition.trigger?.configuredTriggerCounter ?? null,
              triggerLifetime:
                definition.trigger?.triggerLifetime ?? null,
              triggerLifetimeBasis:
                definition.trigger?.triggerLifetimeBasis ?? null,
              maxTriggerCount,
              provenance: definition.provenance ?? [],
            },
          },
        ];
      })
    );
  }
  return commands;
}

function resolveDamageTriggeredPropertyTarget({ effect, scenario, action }) {
  if (
    effect.runtimeTargetKind === EFFECT_TARGET_KINDS.ACTOR ||
    effect.target === 'pet-owner' ||
    effect.target === 'damage-event-source'
  ) {
    if (action.actorId == null) return null;
    return {
      targetKind: EFFECT_TARGET_KINDS.ACTOR,
      targetId: String(action.actorId),
      triggerEffectTargetType: 2,
      triggerEffectTargetName: 'Source',
    };
  }
  if (
    effect.runtimeTargetKind === EFFECT_TARGET_KINDS.KIBO ||
    effect.target === 'equipped-kibo'
  ) {
    if (action.actorId == null) return null;
    return {
      targetKind: EFFECT_TARGET_KINDS.KIBO,
      targetId: String(action.actorId),
      triggerEffectTargetType: 0,
      triggerEffectTargetName: 'Self',
    };
  }
  const enemyId = scenario.enemy?.id ?? scenario.enemy?.enemyId ?? null;
  if (enemyId == null) return null;
  return {
    targetKind: EFFECT_TARGET_KINDS.ENEMY,
    targetId: String(enemyId),
    triggerEffectTargetType: 1,
    triggerEffectTargetName: 'Target',
  };
}

function createDerivedDamageCommands({
  scenario,
  action,
  resolution,
  definition,
  kiboId,
  lastTriggerAtByPassiveKey,
  triggerCountByPassiveKey,
  internalCooldownSuppressions,
  triggerLimitSuppressions,
  conditionSuppressions,
  derivedHitMissSuppressions,
}) {
  const enemyId = scenario.enemy?.id ?? scenario.enemy?.enemyId ?? null;
  if (enemyId == null) return [];
  const conditionResult = evaluateTriggerCondition({
    condition: definition.trigger?.condition,
    scenario,
    resolution,
  });
  if (!conditionResult.matched) {
    conditionSuppressions.push({
      actionId: action.id,
      kiboId,
      skillId: Number(definition.skillId),
      condition: definition.trigger?.condition ?? null,
      actualTargetEntityType: conditionResult.actualTargetEntityType,
      entityTypeSource: conditionResult.entityTypeSource,
      actualSkillTags: conditionResult.actualSkillTags,
      skillTagSource: conditionResult.skillTagSource,
      reason: conditionResult.reason,
    });
    return [];
  }

  const frameRate =
    positiveNumber(resolution.controlBinding?.frameRate) ?? DEFAULT_FRAME_RATE;
  const activationDelayMs = nonNegativeNumber(
    definition.trigger?.activationDelayMs
  );
  const internalCooldownMs = nonNegativeNumber(
    definition.trigger?.internalCooldownMs
  );
  const maxTriggerCount = resolveTriggerLifetime(
    definition.trigger
  ).maxTriggerCount;
  const candidates = (resolution.hits ?? [])
    .filter(
      hit =>
        hit.damage &&
        Number.isFinite(Number(hit.trigger?.startFrame)) &&
        isActionFrameWithinContextualOccupancy(
          action,
          hit.trigger.startFrame,
          frameRate
        )
    )
    .map(hit => ({
      hit,
      hitTimeMs:
        Number(action.startMs) +
        (Number(hit.trigger.startFrame) * 1000) / frameRate,
    }))
    .sort(
      (left, right) =>
        left.hitTimeMs - right.hitTimeMs ||
        String(left.hit.hitIdentity).localeCompare(
          String(right.hit.hitIdentity)
        )
    );
  const commands = [];
  for (const candidate of candidates) {
    const { hit, hitTimeMs } = candidate;
    const hitIdentity =
      hit.hitIdentity ??
      `${hit.elementId ?? 'element'}:${hit.hitIndex ?? 'hit'}`;
    const passiveKey = createKiboPassiveRuntimeKey({
      actorId: action.actorId,
      kiboId,
      skillId: definition.skillId,
    });
    const triggerCount = triggerCountByPassiveKey.get(passiveKey) ?? 0;
    if (maxTriggerCount != null && triggerCount >= maxTriggerCount) {
      triggerLimitSuppressions.push({
        actionId: action.id,
        kiboId,
        skillId: Number(definition.skillId),
        hitIdentity,
        hitTimeMs,
        triggerCount,
        maxTriggerCount,
        triggerLimitScope:
          definition.trigger?.triggerLimitScope ?? 'passive-element-lifetime',
        reason: 'kibo-passive-trigger-count-limit-reached',
      });
      continue;
    }
    const lastTriggerAtMs = lastTriggerAtByPassiveKey.get(passiveKey);
    if (
      lastTriggerAtMs != null &&
      hitTimeMs - lastTriggerAtMs < internalCooldownMs
    ) {
      internalCooldownSuppressions.push({
        actionId: action.id,
        kiboId,
        skillId: Number(definition.skillId),
        hitIdentity,
        hitTimeMs,
        lastTriggerAtMs,
        internalCooldownMs,
        reason: 'kibo-passive-internal-cooldown-active',
      });
      continue;
    }

    lastTriggerAtByPassiveKey.set(passiveKey, hitTimeMs);
    triggerCountByPassiveKey.set(passiveKey, triggerCount + 1);
    const derivedDamage = definition.derivedDamage;
    const derivedHitIdentity = `kibo-passive:${definition.skillId}:derived:${derivedDamage?.sourceElementId}:${hitIdentity}`;
    if (action.hitOverrides?.[derivedHitIdentity]?.willHit === false) {
      derivedHitMissSuppressions.push({
        actionId: action.id,
        kiboId,
        skillId: Number(definition.skillId),
        triggerHitIdentity: hitIdentity,
        derivedHitIdentity,
        hitTimeMs: hitTimeMs + activationDelayMs,
        reason: 'kibo-passive-derived-hit-overridden-to-miss',
      });
      continue;
    }

    commands.push({
      id: `kibo-passive|${definition.skillId}|${action.id}|derived|${hitIdentity}`,
      sourceActionId: action.id,
      sourceActionName: action.name,
      sourceActorId: action.actorId,
      sourceActorName: action.actor?.name ?? null,
      sourceKiboId: kiboId,
      targetKind: EFFECT_TARGET_KINDS.ENEMY,
      targetId: String(enemyId),
      timeMs: hitTimeMs + activationDelayMs,
      passiveSkillId: Number(definition.skillId),
      triggerHitIdentity: hitIdentity,
      derivedHitIdentity,
      ignoreDamageEvent: derivedDamage?.eventPolicy?.ignoreDamageEvent === true,
      emitsDamageTriggerEvents:
        derivedDamage?.eventPolicy?.emitsDamageTriggerEvents === true,
      recursivePassiveTrigger:
        derivedDamage?.eventPolicy?.recursivePassiveTrigger === true,
      criticalPolicy:
        derivedDamage?.criticalPolicy ??
        'scenario-policy-with-derived-hit-override',
      tags: [
        'kibo-passive',
        definition.mechanismFamily,
        `kibo:${kiboId}`,
        `skill:${definition.skillId}`,
      ],
      sourceStatus: 'verified-passive-derived-damage-generated',
      confidence: definition.confidence ?? 'high',
      trackingStatus: 'applied',
      generatedVerified: true,
      appliedToCalculators: true,
      hit: {
        hitIndex: hit.hitIndex ?? 1,
        hitIdentity: derivedHitIdentity,
        elementId: derivedDamage?.sourceElementId ?? null,
        pathId: derivedDamage?.sourcePathId ?? null,
        name: definition.name,
        displayLabel: `${definition.name} · 派生伤害`,
        referenceKind: 'kibo-passive-derived-damage',
        sourceIdentity: derivedHitIdentity,
        formula: derivedDamage?.formula ?? null,
        damage: derivedDamage?.damage ?? null,
        energy: {
          recoverSp: derivedDamage?.damage?.recoverSp ?? 0,
          petRecoverSp: derivedDamage?.damage?.petRecoverSp ?? 0,
          recoverIntervalMs: 0,
        },
      },
      sourceIdentity: {
        catalogKind: 'azpr-kibo-passive-mechanics-catalog',
        actionBindingIdentity: resolution.actionBinding?.identity ?? null,
        triggerEvent: 'damage-dealt',
        kiboId,
        passiveSkillId: Number(definition.skillId),
        triggerElementId: definition.trigger?.sourceElementId ?? null,
        triggerPathId: definition.trigger?.sourcePathId ?? null,
        damageElementId: derivedDamage?.sourceElementId ?? null,
        damagePathId: derivedDamage?.sourcePathId ?? null,
        hitIdentity,
        derivedHitIdentity,
        triggerCondition: definition.trigger?.condition ?? null,
        ignoreDamageEvent:
          derivedDamage?.eventPolicy?.ignoreDamageEvent === true,
        provenance: definition.provenance ?? [],
      },
    });
  }
  return commands;
}

function createDerivedDotSelfHealScheduleCandidates({
  scenario,
  action,
  resolution,
  definition,
  kiboId,
  equippedBinding,
  lastTriggerAtByPassiveKey,
  triggerCountByPassiveKey,
  internalCooldownSuppressions,
  triggerLimitSuppressions,
  conditionSuppressions,
}) {
  const enemyId = scenario.enemy?.id ?? scenario.enemy?.enemyId ?? null;
  if (enemyId == null) return [];
  const conditionResult = evaluateTriggerCondition({
    condition: definition.trigger?.condition,
    scenario,
    resolution,
  });
  if (!conditionResult.matched) {
    conditionSuppressions.push({
      actionId: action.id,
      kiboId,
      skillId: Number(definition.skillId),
      condition: definition.trigger?.condition ?? null,
      actualTargetEntityType: conditionResult.actualTargetEntityType,
      entityTypeSource: conditionResult.entityTypeSource,
      actualSkillTags: conditionResult.actualSkillTags,
      skillTagSource: conditionResult.skillTagSource,
      reason: conditionResult.reason,
    });
    return [];
  }
  const frameRate =
    positiveNumber(resolution.controlBinding?.frameRate) ?? DEFAULT_FRAME_RATE;
  const activationDelayMs = nonNegativeNumber(
    definition.trigger?.activationDelayMs
  );
  const internalCooldownMs = nonNegativeNumber(
    definition.trigger?.internalCooldownMs
  );
  const maxTriggerCount = resolveTriggerLifetime(
    definition.trigger
  ).maxTriggerCount;
  const candidates = (resolution.hits ?? [])
    .filter(
      hit =>
        hit.damage &&
        Number.isFinite(Number(hit.trigger?.startFrame)) &&
        isActionFrameWithinContextualOccupancy(
          action,
          hit.trigger.startFrame,
          frameRate
        )
    )
    .map(hit => ({
      hit,
      hitTimeMs:
        Number(action.startMs) +
        (Number(hit.trigger.startFrame) * 1000) / frameRate,
    }))
    .sort(
      (left, right) =>
        left.hitTimeMs - right.hitTimeMs ||
        String(left.hit.hitIdentity).localeCompare(
          String(right.hit.hitIdentity)
        )
    );
  const schedules = [];
  for (const candidate of candidates) {
    const { hit, hitTimeMs } = candidate;
    const hitIdentity =
      hit.hitIdentity ??
      `${hit.elementId ?? 'element'}:${hit.hitIndex ?? 'hit'}`;
    const passiveKey = createKiboPassiveRuntimeKey({
      actorId: action.actorId,
      kiboId,
      skillId: definition.skillId,
    });
    const triggerCount = triggerCountByPassiveKey.get(passiveKey) ?? 0;
    if (maxTriggerCount != null && triggerCount >= maxTriggerCount) {
      triggerLimitSuppressions.push({
        actionId: action.id,
        kiboId,
        skillId: Number(definition.skillId),
        hitIdentity,
        hitTimeMs,
        triggerCount,
        maxTriggerCount,
        triggerLimitScope:
          definition.trigger?.triggerLimitScope ?? 'passive-element-lifetime',
        reason: 'kibo-passive-trigger-count-limit-reached',
      });
      continue;
    }
    const lastTriggerAtMs = lastTriggerAtByPassiveKey.get(passiveKey);
    if (
      lastTriggerAtMs != null &&
      hitTimeMs - lastTriggerAtMs < internalCooldownMs
    ) {
      internalCooldownSuppressions.push({
        actionId: action.id,
        kiboId,
        skillId: Number(definition.skillId),
        hitIdentity,
        hitTimeMs,
        lastTriggerAtMs,
        internalCooldownMs,
        reason: 'kibo-passive-internal-cooldown-active',
      });
      continue;
    }
    lastTriggerAtByPassiveKey.set(passiveKey, hitTimeMs);
    triggerCountByPassiveKey.set(passiveKey, triggerCount + 1);
    const derivedPeriodic = definition.derivedPeriodic;
    if (
      !derivedPeriodic ||
      !Array.isArray(derivedPeriodic.schedules) ||
      derivedPeriodic.schedules.length === 0
    ) {
      continue;
    }
    const startMs = hitTimeMs + activationDelayMs;
    for (const schedule of derivedPeriodic.schedules) {
      const isDot = schedule.kind === 'derived-dot';
      const targetKind = isDot
        ? EFFECT_TARGET_KINDS.ENEMY
        : EFFECT_TARGET_KINDS.KIBO;
      const targetId = isDot ? String(enemyId) : String(action.actorId);
      schedules.push({
        id: `kibo-passive-periodic-vital|${definition.skillId}|${schedule.sourceElementId}|${schedule.kind}|${targetKind}|${targetId}`,
        passiveSkillId: Number(definition.skillId),
        passiveName: definition.name,
        mechanismFamily: definition.mechanismFamily,
        rootEffectId: schedule.sourceElementId,
        rootElementId: schedule.sourceElementId,
        rootPathId: schedule.sourcePathId,
        targetKind,
        targetId,
        targetActorId: isDot ? null : action.actorId,
        targetKiboId: isDot ? null : kiboId,
        targetSlotId: isDot ? null : equippedBinding?.slotId ?? null,
        targetPosition: isDot ? null : equippedBinding?.position ?? null,
        sourceActorId: action.actorId,
        sourceActorName: action.actor?.name ?? null,
        sourceKiboId: kiboId,
        sourceSlotId: equippedBinding?.slotId ?? null,
        sourcePosition: equippedBinding?.position ?? null,
        sourceKiboActorId: action.actorId,
        trigger: {
          event: 'time-loop',
          eventName: 'AfterDamagePeriodicRelay',
          intervalMs: nonNegativeNumber(derivedPeriodic.intervalMs),
          durationMs: nonNegativeNumber(derivedPeriodic.durationMs),
          timeExeFirstFrame: derivedPeriodic.timeExeFirstFrame === true,
          sourceElementId: definition.trigger?.sourceElementId ?? null,
          sourcePathId: definition.trigger?.sourcePathId ?? null,
        },
        derivedPeriodic: {
          kind: schedule.kind,
          intervalMs: nonNegativeNumber(derivedPeriodic.intervalMs),
          durationMs: nonNegativeNumber(derivedPeriodic.durationMs),
          timeExeFirstFrame: derivedPeriodic.timeExeFirstFrame === true,
          startMs,
          ...(isDot
            ? {
                dot: {
                  sourceAttribute: schedule.sourceAttribute,
                  sourceElementId: schedule.sourceElementId,
                  sourcePathId: schedule.sourcePathId,
                  formula: schedule.formula,
                  damage: schedule.damage,
                  eventPolicy: schedule.eventPolicy,
                  relay: schedule.relay,
                },
              }
            : {}),
          ...(!isDot
            ? {
                heal: {
                  sourceElementId: schedule.sourceElementId,
                  sourcePathId: schedule.sourcePathId,
                  formula: schedule.formula,
                  heal: schedule.heal,
                  relay: schedule.relay,
                },
              }
            : {}),
        },
        sourceIdentity: {
          catalogKind: 'azpr-kibo-passive-mechanics-catalog',
          actionBindingIdentity: resolution.actionBinding?.identity ?? null,
          triggerEvent: 'damage-dealt-periodic-relay',
          kiboId,
          passiveSkillId: Number(definition.skillId),
          triggerElementId: definition.trigger?.sourceElementId ?? null,
          triggerPathId: definition.trigger?.sourcePathId ?? null,
          effectElementId: schedule.sourceElementId,
          effectPathId: schedule.sourcePathId,
          hitIdentity,
          triggerCondition: definition.trigger?.condition ?? null,
          provenance: definition.provenance ?? [],
        },
        contributingSources: equippedBinding
          ? [createPeriodicSourceContributor(equippedBinding)]
          : [],
        formulaSource: 'equipped-kibo',
        sourceSelectionPolicy: 'native-inject-to-own-root-attacker',
        sourceAttributionStatus: 'native-first-root-source-verified',
        appliedToCalculators: true,
        scenarioAssumptions: [
          'derived-dot-and-self-heal-relay-refresh-modeled-as-latest-trigger-window',
        ],
      });
    }
  }
  return schedules;
}

function createBeforeSkillPropertyCommands({
  action,
  resolution,
  definition,
  kiboId,
  lastTriggerAtByPassiveKey,
  triggerCountByPassiveKey,
  internalCooldownSuppressions,
  triggerLimitSuppressions,
  conditionSuppressions,
}) {
  const conditionResult = evaluateTriggerCondition({
    condition: definition.trigger?.condition,
    resolution,
  });
  if (!conditionResult.matched) {
    conditionSuppressions.push({
      actionId: action.id,
      kiboId,
      skillId: Number(definition.skillId),
      condition: definition.trigger?.condition ?? null,
      actualTargetEntityType: conditionResult.actualTargetEntityType,
      entityTypeSource: conditionResult.entityTypeSource,
      actualSkillTags: conditionResult.actualSkillTags,
      skillTagSource: conditionResult.skillTagSource,
      reason: conditionResult.reason,
    });
    return [];
  }

  const triggerTimeMs = Number(action.startMs);
  const passiveKey = createKiboPassiveRuntimeKey({
    actorId: action.actorId,
    kiboId,
    skillId: definition.skillId,
  });
  const triggerIdentity = `${action.id}:before-skill`;
  const triggerCount = triggerCountByPassiveKey.get(passiveKey) ?? 0;
  const maxTriggerCount = resolveTriggerLifetime(
    definition.trigger
  ).maxTriggerCount;
  if (maxTriggerCount != null && triggerCount >= maxTriggerCount) {
    triggerLimitSuppressions.push({
      actionId: action.id,
      kiboId,
      skillId: Number(definition.skillId),
      triggerIdentity,
      triggerTimeMs,
      triggerCount,
      maxTriggerCount,
      triggerLimitScope:
        definition.trigger?.triggerLimitScope ?? 'passive-element-lifetime',
      reason: 'kibo-passive-trigger-count-limit-reached',
    });
    return [];
  }
  const internalCooldownMs = nonNegativeNumber(
    definition.trigger?.internalCooldownMs
  );
  const lastTriggerAtMs = lastTriggerAtByPassiveKey.get(passiveKey);
  if (
    lastTriggerAtMs != null &&
    triggerTimeMs - lastTriggerAtMs < internalCooldownMs
  ) {
    internalCooldownSuppressions.push({
      actionId: action.id,
      kiboId,
      skillId: Number(definition.skillId),
      triggerIdentity,
      triggerTimeMs,
      lastTriggerAtMs,
      internalCooldownMs,
      reason: 'kibo-passive-internal-cooldown-active',
    });
    return [];
  }
  lastTriggerAtByPassiveKey.set(passiveKey, triggerTimeMs);
  triggerCountByPassiveKey.set(passiveKey, triggerCount + 1);

  const timeMs =
    triggerTimeMs + nonNegativeNumber(definition.trigger?.activationDelayMs);
  return (definition.targets ?? []).map(target => ({
    id: `kibo-passive|${definition.skillId}|${action.id}|before-skill|${target.runtimeTargetKind}`,
    sourceActionId: action.id,
    sourceActionName: action.name,
    sourceActorId: action.actorId,
    sourceActorName: action.actor?.name ?? null,
    sourceKiboId: kiboId,
    effectId: `kibo-passive:${definition.skillId}:${definition.effect?.sourceElementId}`,
    effectName: definition.name,
    operation: EFFECT_OPERATIONS.APPLY,
    targetKind: target.runtimeTargetKind,
    targetId: String(action.actorId),
    semanticTargetKind: target.runtimeTargetKind,
    timeMs,
    durationMs: definition.effect?.durationMs ?? null,
    stackMode: normalizeStackMode(definition.effect?.stackMode),
    stackDelta: definition.effect?.stackDelta ?? 1,
    maxStacks: definition.effect?.maxStacks ?? 1,
    tags: [
      'kibo-passive',
      definition.mechanismFamily,
      `kibo:${kiboId}`,
      `skill:${definition.skillId}`,
    ],
    sourceStatus: 'verified-passive-effect-generated',
    confidence: definition.confidence ?? 'high',
    trackingStatus: 'applied',
    generatedVerified: true,
    appliedToCalculators: true,
    formulaSourceActorId: action.actorId,
    effectAdderActorId: action.actorId,
    modifiers: (definition.effect?.modifiers ?? []).map(modifier => ({
      ...modifier,
    })),
    sourceIdentity: {
      catalogKind: 'azpr-kibo-passive-mechanics-catalog',
      actionBindingIdentity: resolution.actionBinding?.identity ?? null,
      effectIdentity: `kibo-passive:${definition.skillId}:${definition.effect?.sourceElementId}`,
      triggerEvent: 'skill-before',
      triggerIdentity,
      kiboId,
      passiveSkillId: Number(definition.skillId),
      triggerElementId: definition.trigger?.sourceElementId ?? null,
      triggerPathId: definition.trigger?.sourcePathId ?? null,
      effectElementId: definition.effect?.sourceElementId ?? null,
      effectPathId: definition.effect?.sourcePathId ?? null,
      triggerCondition: definition.trigger?.condition ?? null,
      configuredTriggerCounter:
        definition.trigger?.configuredTriggerCounter ?? null,
      triggerLifetime: definition.trigger?.triggerLifetime ?? null,
      triggerLifetimeBasis:
        definition.trigger?.triggerLifetimeBasis ?? null,
      maxTriggerCount,
      triggerEffectTargetType: target.triggerEffectTargetType ?? null,
      triggerEffectTargetName: target.triggerEffectTargetName ?? null,
      provenance: definition.provenance ?? [],
    },
  }));
}

function createBeforeSkillCompositeArtifacts({
  action,
  resolution,
  definition,
  kiboId,
  equippedBinding,
  acceptedSkillStartTransition,
  conditionSuppressions,
  unresolved,
}) {
  const artifacts = {
    effectCommands: [],
    vitalChangeCommands: [],
  };
  if (!equippedBinding) {
    unresolved.push({
      actionId: action.id,
      sourceActorId: action.actorId ?? null,
      kiboId,
      skillId: Number(definition.skillId),
      status: 'kibo-passive-runtime-unresolved',
      reasons: ['kibo-passive-equipped-source-binding-mismatch'],
      evidence: {
        actionOwnerKind: resolution.actionBinding?.ownerKind ?? null,
        actionOwnerId: resolution.actionBinding?.ownerId ?? null,
      },
      provenance: definition.provenance ?? [],
    });
    return artifacts;
  }

  for (const propertyEffect of definition.conditionalPropertyEffects ?? []) {
    const condition =
      propertyEffect.condition ??
      propertyEffect.activationCondition ??
      propertyEffect.defaultCondition ??
      null;
    const conditionResult = evaluateTriggerCondition({
      condition,
      resolution,
    });
    if (!conditionResult.matched) {
      conditionSuppressions.push(
        createBeforeSkillConditionSuppression({
          action,
          definition,
          kiboId,
          condition,
          conditionResult,
          sourceElementId:
            propertyEffect.sourceElementId ??
            propertyEffect.effect?.sourceElementId ??
            null,
          effectKind: 'conditional-property-effect',
        })
      );
      continue;
    }
    const durationMs = positiveNumber(action.durationMs);
    const target = propertyEffect.target ?? propertyEffect.targets?.[0] ?? null;
    const targetKind =
      target?.runtimeTargetKind ??
      propertyEffect.runtimeTargetKind ??
      EFFECT_TARGET_KINDS.KIBO;
    const modifiers = (
      propertyEffect.modifiers ??
      propertyEffect.effect?.modifiers ??
      []
    ).map(modifier => ({ ...modifier }));
    if (
      durationMs == null ||
      targetKind !== EFFECT_TARGET_KINDS.KIBO ||
      modifiers.length === 0
    ) {
      unresolved.push({
        actionId: action.id,
        sourceActorId: equippedBinding.actorId,
        kiboId,
        skillId: Number(definition.skillId),
        status: 'kibo-passive-runtime-unresolved',
        reasons: [
          durationMs == null
            ? 'current-skill-condition-window-unresolved'
            : targetKind !== EFFECT_TARGET_KINDS.KIBO
              ? 'before-skill-conditional-property-target-unsupported'
              : 'before-skill-conditional-property-modifiers-missing',
        ],
        evidence: {
          sourceElementId:
            propertyEffect.sourceElementId ??
            propertyEffect.effect?.sourceElementId ??
            null,
          targetKind,
          actionDurationMs: action.durationMs ?? null,
        },
        provenance: definition.provenance ?? [],
      });
      continue;
    }
    const sourceElementId =
      propertyEffect.sourceElementId ??
      propertyEffect.effect?.sourceElementId ??
      null;
    const effectIdentity = `kibo-passive:${definition.skillId}:${sourceElementId}`;
    artifacts.effectCommands.push({
      id: `kibo-passive|${definition.skillId}|${action.id}|current-skill-condition|${sourceElementId}`,
      sourceActionId: action.id,
      sourceActionName: action.name,
      sourceActorId: equippedBinding.actorId,
      sourceActorName: equippedBinding.actorName,
      sourceKiboId: kiboId,
      sourceSlotId: equippedBinding.slotId,
      sourcePosition: equippedBinding.position,
      effectId: effectIdentity,
      effectName: definition.name,
      operation: EFFECT_OPERATIONS.APPLY,
      targetKind,
      targetId: equippedBinding.actorId,
      semanticTargetKind: targetKind,
      timeMs: Number(action.startMs),
      durationMs,
      stackMode: normalizeStackMode(
        propertyEffect.stackMode ?? propertyEffect.effect?.stackMode
      ),
      stackDelta:
        propertyEffect.stackDelta ?? propertyEffect.effect?.stackDelta ?? 1,
      maxStacks:
        propertyEffect.maxStacks ?? propertyEffect.effect?.maxStacks ?? 1,
      tags: [
        'kibo-passive',
        definition.mechanismFamily,
        'current-skill-condition',
        `kibo:${kiboId}`,
        `skill:${definition.skillId}`,
      ],
      sourceStatus: 'verified-passive-effect-generated',
      confidence: definition.confidence ?? 'high',
      trackingStatus: 'applied',
      generatedVerified: true,
      appliedToCalculators: true,
      formulaSourceActorId: equippedBinding.actorId,
      effectAdderActorId: equippedBinding.actorId,
      modifiers,
      sourceIdentity: {
        catalogKind: 'azpr-kibo-passive-mechanics-catalog',
        actionBindingIdentity: resolution.actionBinding?.identity ?? null,
        equippedBindingIdentity: `equipped-kibo|${equippedBinding.actorId}|${kiboId}`,
        effectIdentity,
        triggerEvent: 'current-skill-condition',
        kiboId,
        passiveSkillId: Number(definition.skillId),
        effectElementId: sourceElementId,
        effectPathId:
          propertyEffect.sourcePathId ??
          propertyEffect.effect?.sourcePathId ??
          null,
        triggerCondition: condition,
        configuredMaxChangeCount:
          propertyEffect.maxChangeCount ??
          propertyEffect.effect?.maxChangeCount ??
          null,
        maxChangeCountRuntimeStatus:
          propertyEffect.maxChangeCountRuntimeStatus ??
          'opaque-not-used-for-single-current-skill-window',
        currentSkillWindowSource: 'effective-action-timeline.action.durationMs',
        provenance: definition.provenance ?? [],
      },
    });
  }

  for (const triggerEntry of definition.beforeSkillTriggers ?? []) {
    const trigger = triggerEntry.trigger ?? triggerEntry;
    const condition = trigger.condition ?? triggerEntry.condition ?? null;
    const acceptedPassiveTransition =
      acceptedSkillStartTransition?.passiveTransitions?.find(
        transition =>
          Number(transition.passiveSkillId) === Number(definition.skillId) &&
          Number(transition.sourceElementId) ===
            Number(triggerEntry.cooldownPropertyEffects?.[0]?.sourceElementId)
      ) ?? null;
    const conditionResult = acceptedPassiveTransition
      ? {
          matched: [
            'accepted-skill-start-passive-stack-added',
            'accepted-skill-start-passive-stack-capped',
          ].includes(acceptedPassiveTransition.status),
          actualTargetEntityType: null,
          entityTypeSource: null,
          actualSkillTags: acceptedPassiveTransition.actualSkillTags,
          skillTagSource: acceptedPassiveTransition.skillTagSource,
          reason: acceptedPassiveTransition.reason,
        }
      : evaluateTriggerCondition({
          condition,
          resolution,
        });
    if (!conditionResult.matched) {
      conditionSuppressions.push(
        createBeforeSkillConditionSuppression({
          action,
          definition,
          kiboId,
          condition,
          conditionResult,
          sourceElementId:
            trigger.sourceElementId ?? triggerEntry.sourceElementId ?? null,
          effectKind:
            triggerEntry.cooldownPropertyEffects?.length > 0
              ? 'before-skill-cooldown-property'
              : 'before-skill-vital-change',
        })
      );
      continue;
    }
    for (const cooldownProperty of triggerEntry.cooldownPropertyEffects ?? []) {
      const targetKind =
        cooldownProperty.runtimeTargetKind ?? EFFECT_TARGET_KINDS.KIBO;
      const modifiers = (cooldownProperty.modifiers ?? []).map(modifier => ({
        ...modifier,
      }));
      if (targetKind !== EFFECT_TARGET_KINDS.KIBO || modifiers.length === 0) {
        unresolved.push({
          actionId: action.id,
          sourceActorId: equippedBinding.actorId,
          kiboId,
          skillId: Number(definition.skillId),
          status: 'kibo-passive-runtime-unresolved',
          reasons: [
            targetKind !== EFFECT_TARGET_KINDS.KIBO
              ? 'before-skill-cooldown-property-target-unsupported'
              : 'before-skill-cooldown-property-modifiers-missing',
          ],
          evidence: {
            targetKind,
            sourceElementId: cooldownProperty.sourceElementId ?? null,
          },
          provenance: definition.provenance ?? [],
        });
        continue;
      }
      const sourceElementId = cooldownProperty.sourceElementId ?? null;
      const effectIdentity = `kibo-passive:${definition.skillId}:${sourceElementId}`;
      artifacts.effectCommands.push({
        id: `kibo-passive|${definition.skillId}|${action.id}|accepted-skill-start|${sourceElementId}`,
        sourceActionId: action.id,
        sourceActionName: action.name,
        sourceActorId: equippedBinding.actorId,
        sourceActorName: equippedBinding.actorName,
        sourceKiboId: kiboId,
        sourceSlotId: equippedBinding.slotId,
        sourcePosition: equippedBinding.position,
        effectId: effectIdentity,
        effectName: definition.name,
        operation: EFFECT_OPERATIONS.APPLY,
        targetKind,
        targetId: equippedBinding.actorId,
        semanticTargetKind: targetKind,
        timeMs: Number(action.startMs),
        durationMs: cooldownProperty.durationMs ?? null,
        stackMode: normalizeStackMode(cooldownProperty.stackMode),
        stackDelta: cooldownProperty.stackDelta ?? 1,
        maxStacks: cooldownProperty.maxStacks ?? 1,
        tags: [
          'kibo-passive',
          definition.mechanismFamily,
          'accepted-skill-start',
          `kibo:${kiboId}`,
          `skill:${definition.skillId}`,
        ],
        sourceStatus: 'verified-passive-accepted-skill-effect-generated',
        confidence: definition.confidence ?? 'high',
        trackingStatus: 'applied',
        generatedVerified: true,
        appliedToCalculators: true,
        activationPhase: 'after-action-accepted',
        effectiveAfterActionId: action.id,
        formulaSourceActorId: equippedBinding.actorId,
        effectAdderActorId: equippedBinding.actorId,
        modifiers,
        sourceIdentity: {
          catalogKind: 'azpr-kibo-passive-mechanics-catalog',
          actionBindingIdentity: resolution.actionBinding?.identity ?? null,
          equippedBindingIdentity: `equipped-kibo|${equippedBinding.actorId}|${kiboId}`,
          effectIdentity,
          triggerEvent: 'accepted-skill-start',
          activationPhase: 'after-action-accepted',
          effectiveAfterActionId: action.id,
          acceptedTransitionStatus:
            acceptedPassiveTransition?.status ??
            'accepted-action-execution-plan-fallback',
          actionOrderIndex:
            acceptedSkillStartTransition?.actionOrderIndex ?? null,
          stackBefore: acceptedPassiveTransition?.stackBefore ?? null,
          stackAfter: acceptedPassiveTransition?.stackAfter ?? null,
          kiboId,
          passiveSkillId: Number(definition.skillId),
          triggerElementId:
            trigger.sourceElementId ?? triggerEntry.sourceElementId ?? null,
          triggerPathId:
            trigger.sourcePathId ?? triggerEntry.sourcePathId ?? null,
          effectElementId: sourceElementId,
          effectPathId: cooldownProperty.sourcePathId ?? null,
          triggerCondition: condition,
          provenance: definition.provenance ?? [],
        },
      });
    }
    for (const vitalChange of triggerEntry.vitalChanges ??
      trigger.vitalChanges ??
      []) {
      const target = vitalChange.target ?? null;
      const targetKind =
        target?.runtimeTargetKind ??
        vitalChange.runtimeTargetKind ??
        EFFECT_TARGET_KINDS.KIBO;
      if (targetKind !== EFFECT_TARGET_KINDS.KIBO) {
        unresolved.push({
          actionId: action.id,
          sourceActorId: equippedBinding.actorId,
          kiboId,
          skillId: Number(definition.skillId),
          status: 'kibo-passive-runtime-unresolved',
          reasons: ['before-skill-vital-change-target-unsupported'],
          evidence: {
            targetKind,
            sourceElementId: vitalChange.sourceElementId ?? null,
          },
          provenance: definition.provenance ?? [],
        });
        continue;
      }
      const triggerElementId =
        trigger.sourceElementId ?? triggerEntry.sourceElementId ?? null;
      const vitalElementId =
        vitalChange.sourceElementId ??
        vitalChange.damage?.sourceElementId ??
        null;
      artifacts.vitalChangeCommands.push({
        id: `kibo-passive|${definition.skillId}|${action.id}|before-skill-vital|${vitalElementId}`,
        kind: vitalChange.kind ?? vitalChange.operation ?? 'damage',
        timeMs:
          Number(action.startMs) +
          nonNegativeNumber(
            trigger.activationDelayMs ?? triggerEntry.activationDelayMs
          ),
        sourceActionId: action.id,
        sourceActionName: action.name,
        sourceActorId: equippedBinding.actorId,
        sourceActorName: equippedBinding.actorName,
        sourceKiboId: kiboId,
        sourceSlotId: equippedBinding.slotId,
        sourcePosition: equippedBinding.position,
        targetKind,
        targetId: equippedBinding.actorId,
        targetActorId: equippedBinding.actorId,
        targetKiboId: kiboId,
        targetSlotId: equippedBinding.slotId,
        targetPosition: equippedBinding.position,
        passiveSkillId: Number(definition.skillId),
        passiveName: definition.name,
        trigger: {
          ...trigger,
          sourceElementId: triggerElementId,
          condition,
        },
        vitalChange: {
          ...vitalChange,
          sourceElementId: vitalElementId,
        },
        nativeEvidenceContract: definition.nativeEvidenceContract ?? null,
        runtimeBoundaries: definition.runtimeBoundaries ?? [],
        sourceIdentity: {
          catalogKind: 'azpr-kibo-passive-mechanics-catalog',
          actionBindingIdentity: resolution.actionBinding?.identity ?? null,
          equippedBindingIdentity: `equipped-kibo|${equippedBinding.actorId}|${kiboId}`,
          triggerEvent: 'skill-before',
          kiboId,
          passiveSkillId: Number(definition.skillId),
          triggerElementId,
          triggerPathId:
            trigger.sourcePathId ?? triggerEntry.sourcePathId ?? null,
          vitalElementId,
          vitalPathId:
            vitalChange.sourcePathId ??
            vitalChange.damage?.sourcePathId ??
            null,
          triggerCondition: condition,
          provenance: definition.provenance ?? [],
        },
      });
    }
  }
  return artifacts;
}

function createBeforeSkillConditionSuppression({
  action,
  definition,
  kiboId,
  condition,
  conditionResult,
  sourceElementId,
  effectKind,
}) {
  return {
    actionId: action.id,
    kiboId,
    skillId: Number(definition.skillId),
    effectKind,
    sourceElementId,
    condition,
    actualTargetEntityType: conditionResult.actualTargetEntityType,
    entityTypeSource: conditionResult.entityTypeSource,
    actualSkillTags: conditionResult.actualSkillTags,
    skillTagSource: conditionResult.skillTagSource,
    reason: conditionResult.reason,
  };
}

function evaluateDamageOutputCondition({ condition, hit }) {
  const actualDamageType = numberOrNull(hit?.damage?.damageType);
  const actualElementalType = numberOrNull(hit?.damage?.elementalType);
  if (actualDamageType == null) {
    return {
      matched: false,
      actualDamageType: null,
      actualElementalType,
      reason: 'kibo-passive-hit-damage-type-unresolved',
    };
  }
  if (actualElementalType == null) {
    return {
      matched: false,
      actualDamageType,
      actualElementalType: null,
      reason: 'kibo-passive-hit-elemental-type-unresolved',
    };
  }
  const clauses = condition?.clauses ?? [];
  if (clauses.length === 0) {
    return {
      matched: false,
      actualDamageType,
      actualElementalType,
      reason: 'kibo-passive-hit-damage-condition-runtime-unsupported',
    };
  }
  const matchesClause = clause => {
    const requiredDamageType = Number(clause.damageType);
    const requiredElementalType = Number(clause.elementalType);
    return (
      (requiredDamageType === 9 || requiredDamageType === actualDamageType) &&
      (requiredElementalType === 10 ||
        requiredElementalType === actualElementalType)
    );
  };
  const matched =
    condition.logic === 'and'
      ? clauses.every(matchesClause)
      : clauses.some(matchesClause);
  return {
    matched,
    actualDamageType,
    actualElementalType,
    reason: matched ? null : 'kibo-passive-hit-damage-condition-not-matched',
  };
}

function evaluateTriggerCondition({ condition, scenario, resolution }) {
  if (!condition) {
    return {
      matched: true,
      actualTargetEntityType: null,
      entityTypeSource: null,
      actualSkillTags: null,
      skillTagSource: null,
      reason: null,
    };
  }
  if (condition.kind === 'target-entity-type' && condition.logic === 'or') {
    const entityType = resolveScenarioEnemyEntityType(scenario?.enemy);
    if (entityType.value == null) {
      return {
        matched: false,
        actualTargetEntityType: null,
        entityTypeSource: entityType.source,
        actualSkillTags: null,
        skillTagSource: null,
        reason: 'kibo-passive-target-entity-type-unresolved',
      };
    }
    const matched = (condition.targetEntityTypes ?? []).includes(
      entityType.value
    );
    return {
      matched,
      actualTargetEntityType: entityType.value,
      entityTypeSource: entityType.source,
      actualSkillTags: null,
      skillTagSource: null,
      reason: matched
        ? null
        : 'kibo-passive-target-entity-type-condition-not-matched',
    };
  }
  if (
    condition.kind === 'skill-tag' &&
    ['and', 'or'].includes(condition.logic)
  ) {
    const skillTags = resolveActionSkillTags(resolution);
    if (skillTags.values == null) {
      return {
        matched: false,
        actualTargetEntityType: null,
        entityTypeSource: null,
        actualSkillTags: null,
        skillTagSource: skillTags.source,
        reason: 'kibo-passive-skill-tag-unresolved',
      };
    }
    const matchSkillTag = skillTag => skillTags.values.includes(skillTag);
    const matched =
      condition.logic === 'and'
        ? (condition.requiredSkillTags ?? []).every(matchSkillTag)
        : (condition.requiredSkillTags ?? []).some(matchSkillTag);
    return {
      matched,
      actualTargetEntityType: null,
      entityTypeSource: null,
      actualSkillTags: skillTags.values,
      skillTagSource: skillTags.source,
      reason: matched ? null : 'kibo-passive-skill-tag-condition-not-matched',
    };
  }
  if (
    condition.kind === 'battle-property-default-skill-tag' &&
    Number(condition.checkType) === 1
  ) {
    const skillTags = resolveActionSkillTags(resolution);
    if (skillTags.values == null) {
      return {
        matched: false,
        actualTargetEntityType: null,
        entityTypeSource: null,
        actualSkillTags: null,
        skillTagSource: skillTags.source,
        reason: 'kibo-passive-skill-tag-unresolved',
      };
    }
    const requiredSkillTags = (condition.requiredSkillTags ?? []).map(Number);
    const matched =
      requiredSkillTags.length > 0 &&
      requiredSkillTags.every(skillTag => skillTags.values.includes(skillTag));
    return {
      matched,
      actualTargetEntityType: null,
      entityTypeSource: null,
      actualSkillTags: skillTags.values,
      skillTagSource: skillTags.source,
      reason: matched
        ? null
        : 'kibo-passive-current-skill-tag-condition-not-matched',
    };
  }
  return {
    matched: false,
    actualTargetEntityType: null,
    entityTypeSource: null,
    actualSkillTags: null,
    skillTagSource: null,
    reason: 'kibo-passive-trigger-condition-runtime-unsupported',
  };
}

function resolveActionSkillTags(resolution) {
  const rawSkillTags = resolution?.controlBinding?.logic?.skillTag;
  if (rawSkillTags == null || String(rawSkillTags).trim() === '') {
    return {
      values: null,
      source: 'resolution.controlBinding.logic.skillTag-missing',
    };
  }
  const values = uniqueValues(
    String(rawSkillTags)
      .split('|')
      .map(value => Number(value.trim()))
      .filter(Number.isInteger)
  ).sort((left, right) => left - right);
  if (values.length === 0) {
    return {
      values: null,
      source: 'resolution.controlBinding.logic.skillTag-invalid',
    };
  }
  return {
    values,
    source: 'resolution.controlBinding.logic.skillTag',
  };
}

function resolveScenarioEnemyEntityType(enemy) {
  const explicit = Number(enemy?.entityType);
  if (Number.isInteger(explicit)) {
    return { value: explicit, source: 'scenario.enemy.entityType' };
  }
  if (enemy?.source?.enemy && typeof enemy.source.enemy === 'object') {
    return {
      value: 14,
      source: 'compiled-td-enemy-create-monster-entity-chain',
    };
  }
  return { value: null, source: 'scenario-enemy-entity-type-missing' };
}

function isDefinitionPublishedByActionOwner(definition, actionOwnerKind) {
  if (
    definition.mechanismFamily ===
    PET_OWNER_DAMAGE_SOURCE_PROPERTY_MECHANISM_FAMILY
  ) {
    return actionOwnerKind === 'actor';
  }
  return actionOwnerKind === 'kibo';
}

function resolveActorActionOwnerMatch({ scenario, action, bindingOwnerId }) {
  if (bindingOwnerId == null) {
    return {
      matched: false,
      reason: 'actor-action-owner-binding-id-missing',
      candidates: [],
    };
  }
  if (String(bindingOwnerId) === String(action.actorId)) {
    return {
      matched: true,
      reason: null,
      candidates: [
        {
          source: 'action.actorId',
          value: action.actorId,
          identityKind: 'runtime-entity',
        },
      ],
    };
  }
  const scenarioActor = (scenario?.actors ?? []).find(
    actor => String(actor?.id) === String(action.actorId)
  );
  const candidates = [
    {
      source: 'action.actor.characterId',
      value: action.actor?.characterId,
    },
    {
      source: 'action.actorCharacterId',
      value: action.actorCharacterId,
    },
    {
      source: 'scenario.actors[].characterId',
      value: scenarioActor?.characterId,
    },
  ]
    .map(candidate => ({
      ...candidate,
      value: Number(candidate.value),
      identityKind: 'actor-template',
    }))
    .filter(
      candidate => Number.isInteger(candidate.value) && candidate.value > 0
    );
  const uniqueOwnerIds = uniqueValues(
    candidates.map(candidate => candidate.value)
  );
  if (uniqueOwnerIds.length === 0) {
    return {
      matched: false,
      reason: 'actor-action-owner-template-id-missing',
      candidates,
    };
  }
  if (uniqueOwnerIds.length > 1) {
    return {
      matched: false,
      reason: 'actor-action-owner-template-id-conflict',
      candidates,
    };
  }
  return {
    matched: String(bindingOwnerId) === String(uniqueOwnerIds[0]),
    reason:
      String(bindingOwnerId) === String(uniqueOwnerIds[0])
        ? null
        : 'actor-action-owner-binding-mismatch',
    candidates,
  };
}

function groupCatalogRowsByKiboId(rows) {
  const result = new Map();
  for (const row of rows) {
    for (const rawKiboId of row.kiboIds ?? []) {
      const kiboId = Number(rawKiboId);
      if (!Number.isInteger(kiboId)) continue;
      const definitions = result.get(kiboId) ?? [];
      definitions.push(row);
      result.set(kiboId, definitions);
    }
  }
  return result;
}

function deduplicateUnresolved(rows) {
  const result = new Map();
  for (const row of rows) {
    const key = `${row.actionId}|${row.sourceActorId}|${row.kiboId}|${row.skillId}|${row.targetKind ?? ''}|${row.targetId ?? ''}|${row.reasons.join(
      ','
    )}`;
    result.set(key, row);
  }
  return [...result.values()];
}

function normalizeStackMode(value) {
  if (value === EFFECT_STACK_MODES.STACK) return EFFECT_STACK_MODES.STACK;
  if (value === EFFECT_STACK_MODES.REPLACE) {
    return EFFECT_STACK_MODES.REPLACE;
  }
  return EFFECT_STACK_MODES.REFRESH;
}

function positiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function numberOrNull(value) {
  const parsed = Number(value);
  return value != null && Number.isFinite(parsed) ? parsed : null;
}

function nonNegativeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function resolveTriggerLifetime(trigger = {}) {
  const classification = String(trigger?.triggerLifetime ?? '');
  const configuredTriggerCounter = numberOrNull(
    trigger?.configuredTriggerCounter
  );
  if (classification === 'unlimited') {
    return {
      classification,
      configuredTriggerCounter,
      maxTriggerCount: null,
      basis: trigger?.triggerLifetimeBasis ?? 'generated-unlimited',
    };
  }
  if (classification === 'finite') {
    const maxTriggerCount = positiveInteger(trigger?.maxTriggerCount);
    return {
      classification:
        maxTriggerCount == null ? 'evidence-open' : classification,
      configuredTriggerCounter,
      maxTriggerCount,
      basis:
        trigger?.triggerLifetimeBasis ??
        (maxTriggerCount == null
          ? 'finite-trigger-limit-missing'
          : 'generated-finite'),
    };
  }
  if (classification === 'evidence-open') {
    return {
      classification,
      configuredTriggerCounter,
      maxTriggerCount: null,
      basis: trigger?.triggerLifetimeBasis ?? 'generated-evidence-open',
    };
  }
  const maxTriggerCount = positiveInteger(trigger?.maxTriggerCount);
  if (maxTriggerCount != null) {
    return {
      classification: 'finite',
      configuredTriggerCounter,
      maxTriggerCount,
      basis: 'legacy-positive-max-trigger-count',
    };
  }
  return {
    classification: 'unlimited',
    configuredTriggerCounter,
    maxTriggerCount: null,
    basis: 'legacy-no-positive-trigger-limit',
  };
}

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}
