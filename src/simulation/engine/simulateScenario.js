import { createRawDamageProjection } from '../mechanics/damage';
import { projectSimulationResult } from '../projection/projectSimulationResult';
import { ACTION_TYPES } from '../../domain/projectSchema';
import { createEffectRuntimeTimeline } from '../runtime/effectRuntimeTimeline';
import { createActionRuleDiagnostics } from '../runtime/actionRuleDiagnostics';
import {
  createActionExecutionPlan,
  createActionExecutionPlanIndex,
} from './actionExecutionPlan';
import { createControlledActorTimeline } from '../runtime/controlledActorTimeline';
import { createActionEffectRelationGraph } from '../runtime/actionEffectRelationGraph';
import {
  createVerifiedCombatRuntime,
  isVerifiedCombatMechanicsScenario,
} from '../mechanics/verifiedCombatRuntime';
import { createVerifiedBattleEffectGeneration } from '../mechanics/verifiedBattleEffectGeneration';
import { createVerifiedTuningMarkGeneration } from '../mechanics/verifiedTuningMarkGeneration';
import { createVerifiedActionVariantRuntime } from '../mechanics/verifiedActionVariantRuntime';
import {
  createVerifiedKiboPassiveGeneration,
  deriveKiboReceiveDamageEventsFromCombatRuntime,
} from '../mechanics/verifiedKiboPassiveGeneration';
import {
  createVerifiedSoulEssenceEffectGeneration,
  deriveSoulEventSnapshotFromCombatRuntime,
} from '../mechanics/verifiedSoulEssenceEffectGeneration';
import { createVerifiedDamageEventGeneration } from '../mechanics/verifiedDamageEventGeneration';
import { createVerifiedNonDamageEventGeneration } from '../mechanics/verifiedNonDamageEventGeneration';
import { createVerifiedPickupEntityGeneration } from '../mechanics/verifiedPickupEntityGeneration';
import { projectScenarioEffectiveActionTimeline } from '../mechanics/actionEffectiveTimeline';
import { validateCombatCriticalScenario } from '../../domain/combatCriticalPolicy';
import { createDeterministicCriticalRandomSource } from '../runtime/criticalRandomSource';
import {
  compareActionSourceSequence,
  getActionSourceSequencePath,
} from '../../domain/actionSourceSequence';
import { msToFrame } from '../../domain/timebase';
import { getInstalledVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';

export function simulateScenario(
  inputScenario,
  {
    threeValueMechanicsAdapterRegistry = null,
    actionCooldownEvaluationAdapter = null,
    criticalRandomSource = null,
  } = {}
) {
  const criticalRuntime = createCriticalRuntime({
    scenario: inputScenario,
    criticalRandomSource,
  });
  const actionVariantPreflight = isVerifiedCombatMechanicsScenario(
    inputScenario
  )
    ? createVerifiedActionVariantRuntime({
        scenario: inputScenario,
        actionExecutionPlan: null,
      })
    : null;
  const effectiveActionTimeline = projectScenarioEffectiveActionTimeline({
    scenario: inputScenario,
    actionResolutionById: actionVariantPreflight?.actionResolutionById,
    actionSelectionById: actionVariantPreflight?.selectionByActionId,
  });
  const scenario = effectiveActionTimeline.scenario;
  const eventLog = [
    {
      type: 'SCENARIO_START',
      timeMs: 0,
      payload: {
        projectId: scenario.sourceProject.id,
        projectName: scenario.sourceProject.name,
      },
    },
  ];

  const admission = createStableVerifiedAdmission({
    scenario,
    cooldownEvaluationAdapter: actionCooldownEvaluationAdapter,
    criticalRuntime,
    actionResolutionById: actionVariantPreflight?.actionResolutionById,
  });
  const {
    actionRuleDiagnostics,
    actionExecutionPlan,
    controlledActorTimeline,
    verifiedExecutionBlocks,
  } = admission;
  let runtimeBundle = createVerifiedRuntimeBundle({
    scenario,
    actionExecutionPlan,
    controlledActorTimeline,
    acceptedSkillStartTransitions:
      actionRuleDiagnostics.acceptedSkillStartTransitions,
    criticalRandomSource: criticalRuntime.createFinalRandomSource(),
    soulEventCriticalRandomSource:
      criticalRuntime.createPreflightRandomSource(),
  });
  const verifiedCombatRuntime = attachVerifiedExecutionBlocks(
    runtimeBundle.verifiedCombatRuntime,
    verifiedExecutionBlocks
  );
  const actionReadinessByActionId = new Map(
    actionRuleDiagnostics.readinessTimeline.actions.map(action => [
      action.actionId,
      action,
    ])
  );
  const executionPlanByActionId =
    createActionExecutionPlanIndex(actionExecutionPlan);
  const controlledTransitionByActionId = new Map(
    controlledActorTimeline.transitions.map(transition => [
      transition.actionId,
      transition,
    ])
  );
  const verifiedCombatSelected = verifiedCombatRuntime.enabled === true;
  const verifiedCombatEnabled = verifiedCombatRuntime.ready === true;
  const damageEvents = verifiedCombatEnabled
    ? [...verifiedCombatRuntime.damageEvents]
    : [];
  const resourceEvents = verifiedCombatEnabled
    ? [...verifiedCombatRuntime.resourceEvents]
    : [];

  for (const action of scenario.actions) {
    const executionEntry = executionPlanByActionId.get(action.id);
    if (executionEntry?.execute === false) {
      eventLog.push(createActionSkippedEvent(action, executionEntry));
      continue;
    }
    eventLog.push(createActionStartEvent(action));
    const cooldownStartEvent = createCooldownStartEvent(
      action,
      actionReadinessByActionId.get(action.id)?.cooldown
    );
    if (cooldownStartEvent) {
      eventLog.push(cooldownStartEvent);
    }

    const resourceActionEvent = createResourceActionEvent(action);
    if (resourceActionEvent) {
      if (!verifiedCombatSelected) {
        resourceEvents.push(resourceActionEvent);
        eventLog.push(resourceActionEvent);
      }
      continue;
    }

    const nonCombatEvent = createNonCombatEvent(
      action,
      controlledTransitionByActionId.get(action.id)
    );
    if (nonCombatEvent) {
      eventLog.push(nonCombatEvent);
      continue;
    }

    if (action.timing?.needsTimingData) {
      eventLog.push({
        type: 'TIMING_DATA_MISSING',
        timeMs: action.startMs,
        actionId: action.id,
        payload: {
          actionName: action.name,
          timingSource: action.timing.source,
        },
      });
    }

    if (verifiedCombatSelected) {
      const resolution = verifiedCombatRuntime.actionResolutionById.get(
        action.id
      );
      if (!resolution?.ready || resolution.complete === false) {
        eventLog.push({
          type: 'DAMAGE_SKIPPED',
          timeMs: action.startMs,
          actionId: action.id,
          payload: {
            reason:
              resolution?.status ?? 'verified-action-mechanics-unresolved',
            reasons: resolution?.reasons ?? [],
            verifiedCombat: true,
            resourceDimensionsApplied: resolution?.ready === true,
            appliedToCalculators: false,
          },
        });
      }
      continue;
    }

    if (Number(action.spCost) > 0) {
      const event = {
        type: 'RESOURCE_CHANGE',
        timeMs: action.startMs,
        actionId: action.id,
        actorId: action.actorId,
        payload: {
          resource: 'sp',
          change: -Number(action.spCost),
          reason: 'skill-cost',
          confidence: 'medium',
        },
      };
      resourceEvents.push(event);
      eventLog.push(event);
    }

    const damageEvent = createDamageEvent(action, scenario.enemy);
    if (damageEvent) {
      damageEvents.push(damageEvent);
      eventLog.push(damageEvent);
    } else {
      eventLog.push({
        type: 'DAMAGE_SKIPPED',
        timeMs: action.startMs,
        actionId: action.id,
        payload: {
          reason: 'no-parseable-skill-multiplier',
        },
      });
    }
  }

  if (verifiedCombatEnabled) {
    eventLog.push(...verifiedCombatRuntime.eventLog);
  }

  const effectTimeline = runtimeBundle.effectTimeline;
  const actionEffectRelationGraph = createActionEffectRelationGraph({
    scenario,
    effectTimeline,
    actionExecutionPlan,
  });
  eventLog.push(...effectTimeline.events);

  eventLog.push({
    type: 'SCENARIO_END',
    timeMs: scenario.time.durationMs,
    payload: {
      projectId: scenario.sourceProject.id,
    },
  });

  eventLog.sort(
    (a, b) =>
      a.timeMs - b.timeMs || eventPriority(a.type, a) - eventPriority(b.type, b)
  );

  return projectSimulationResult({
    scenario,
    eventLog,
    damageEvents,
    resourceEvents,
    effectTimeline,
    actionRuleDiagnostics,
    actionExecutionPlan,
    controlledActorTimeline,
    actionEffectRelationGraph,
    verifiedCombatRuntime,
    verifiedBattleEffectGeneration: runtimeBundle.effectGeneration,
    verifiedKiboPassiveGeneration: runtimeBundle.kiboPassiveGeneration,
    verifiedSoulEssenceEffectGeneration:
      runtimeBundle.soulEssenceEffectGeneration,
    verifiedDamageEventGeneration: runtimeBundle.damageEventGeneration,
    verifiedNonDamageEventGeneration: runtimeBundle.nonDamageEventGeneration,
    verifiedTuningMarkGeneration: runtimeBundle.tuningGeneration,
    verifiedPickupEntityGeneration: runtimeBundle.pickupGeneration,
    verifiedActionVariantRuntime: runtimeBundle.actionVariantRuntime,
    effectiveActionTimeline,
    kiboResourceEvents: verifiedCombatRuntime.kiboResourceEvents,
    threeValueMechanicsAdapterRegistry,
  });
}

function createStableVerifiedAdmission({
  scenario,
  cooldownEvaluationAdapter,
  criticalRuntime,
  actionResolutionById = null,
}) {
  const executionBlockByKey = new Map();
  const actionById = new Map(
    (scenario.actions ?? []).map(action => [String(action.id), action])
  );
  const maximumPassCount = Math.max(2, (scenario.actions?.length ?? 0) + 1);
  let lastPass = null;
  for (let passIndex = 0; passIndex < maximumPassCount; passIndex += 1) {
    const verifiedExecutionBlocks = [...executionBlockByKey.values()].sort(
      compareExecutionBlocks
    );
    let actionRuleDiagnostics = createActionRuleDiagnostics({
      scenario,
      cooldownEvaluationAdapter,
      externallyBlockedActionIds: verifiedExecutionBlocks.map(
        block => block.actionId
      ),
      actionResolutionById,
    });
    if (verifiedExecutionBlocks.length > 0) {
      actionRuleDiagnostics = applyVerifiedResourceExecutionBlocks({
        actionRuleDiagnostics,
        executionBlocks: verifiedExecutionBlocks,
      });
    }
    const actionExecutionPlan = createActionExecutionPlan({
      scenario,
      actionRuleDiagnostics,
    });
    const controlledActorTimeline = createControlledActorTimeline({
      scenario,
      actionExecutionPlan,
    });
    const runtimeBundle = createVerifiedRuntimeBundle({
      scenario,
      actionExecutionPlan,
      controlledActorTimeline,
      acceptedSkillStartTransitions:
        actionRuleDiagnostics.acceptedSkillStartTransitions,
      criticalRandomSource: criticalRuntime.createPreflightRandomSource(),
    });
    const discoveredBlocks =
      runtimeBundle.verifiedCombatRuntime.executionBlocks ?? [];
    let addedBlockCount = 0;
    for (const discoveredBlock of discoveredBlocks) {
      const block = attachExecutionBlockSourceSequence(
        discoveredBlock,
        actionById.get(String(discoveredBlock.actionId)),
        scenario.time?.fps
      );
      const key = `${block.code}|${block.actionId}`;
      if (executionBlockByKey.has(key)) continue;
      executionBlockByKey.set(key, block);
      addedBlockCount += 1;
    }
    lastPass = {
      actionRuleDiagnostics,
      actionExecutionPlan,
      controlledActorTimeline,
      runtimeBundle,
      passCount: passIndex + 1,
    };
    if (addedBlockCount === 0) {
      return {
        ...lastPass,
        actionRuleDiagnostics: {
          ...actionRuleDiagnostics,
          admissionReplay: {
            status: 'verified-admission-replay-stable',
            passCount: passIndex + 1,
            resourceBlockCount: executionBlockByKey.size,
          },
        },
        verifiedExecutionBlocks,
      };
    }
  }
  const verifiedExecutionBlocks = [...executionBlockByKey.values()].sort(
    compareExecutionBlocks
  );
  return {
    ...lastPass,
    actionRuleDiagnostics: {
      ...lastPass.actionRuleDiagnostics,
      admissionReplay: {
        status: 'verified-admission-replay-max-pass-conservative',
        passCount: maximumPassCount,
        resourceBlockCount: verifiedExecutionBlocks.length,
      },
    },
    verifiedExecutionBlocks,
  };
}

function compareExecutionBlocks(left, right) {
  return (
    Number(left.absoluteFrame) - Number(right.absoluteFrame) ||
    compareActionSourceSequence(left, right) ||
    String(left.code).localeCompare(String(right.code))
  );
}

function attachExecutionBlockSourceSequence(block, action, fps = 60) {
  const sourceSequencePath = getActionSourceSequencePath(action);
  return {
    ...block,
    absoluteFrame: Number.isInteger(block.absoluteFrame)
      ? block.absoluteFrame
      : msToFrame(block.timeMs, fps),
    sourceSequenceIndex:
      action?.sourceSequenceIndex ?? sourceSequencePath?.[0] ?? null,
    sourceSequencePath,
    sourceSequenceSource:
      action?.sourceSequenceSource ?? 'scenario-action-array-order',
  };
}

function createVerifiedRuntimeBundle({
  scenario,
  actionExecutionPlan,
  controlledActorTimeline,
  acceptedSkillStartTransitions = null,
  criticalRandomSource,
  soulEventCriticalRandomSource = null,
}) {
  const actionVariantRuntime = isVerifiedCombatMechanicsScenario(scenario)
    ? createVerifiedActionVariantRuntime({
        scenario,
        actionExecutionPlan,
        controlledActorTimeline,
      })
    : null;
  const effectGeneration = isVerifiedCombatMechanicsScenario(scenario)
    ? createVerifiedBattleEffectGeneration({
        scenario,
        actionExecutionPlan,
        actionResolutionById: actionVariantRuntime?.actionResolutionById,
        mechanicsPackage: getInstalledVerifiedCombatMechanicsPackage(),
        controlledActorTimeline,
        generatedDirectSpEvents: actionVariantRuntime?.directSpEvents ?? [],
        runtimeManagedDirectSpEffects:
          actionVariantRuntime?.targetStateRuntime
            ?.runtimeManagedDirectSpEffects ?? [],
      })
    : null;
  const pickupGeneration = isVerifiedCombatMechanicsScenario(scenario)
    ? createVerifiedPickupEntityGeneration({
        scenario,
        actionExecutionPlan,
        actionResolutionById: actionVariantRuntime?.actionResolutionById,
        controlledActorTimeline,
      })
    : null;
  const tuningGeneration = isVerifiedCombatMechanicsScenario(scenario)
    ? createVerifiedTuningMarkGeneration({
        scenario,
        actionExecutionPlan,
        effectGeneration,
        actionVariantRuntime,
      })
    : null;
  const kiboPassiveGeneration = isVerifiedCombatMechanicsScenario(scenario)
    ? createVerifiedKiboPassiveGeneration({
        scenario,
        actionExecutionPlan,
        actionResolutionById: actionVariantRuntime?.actionResolutionById,
        acceptedSkillStartTransitions,
      })
    : null;
  const damageEventGeneration = isVerifiedCombatMechanicsScenario(scenario)
    ? createVerifiedDamageEventGeneration({
        scenario,
        actionExecutionPlan,
        actionResolutionById: actionVariantRuntime?.actionResolutionById,
        tuningGeneration,
      })
    : null;
  const baselineSoulEssenceEffectGeneration = isVerifiedCombatMechanicsScenario(
    scenario
  )
    ? createVerifiedSoulEssenceEffectGeneration({
        scenario,
        actionExecutionPlan,
        actionResolutionById: actionVariantRuntime?.actionResolutionById,
        tuningGeneration,
        damageEventGeneration,
        controlledActorTimeline,
      })
    : null;
  const baselineEffectTimeline = createEffectRuntimeTimeline({
    scenario,
    actionExecutionPlan,
    controlledActorTimeline,
    generatedCommands: [
      ...(actionVariantRuntime?.effectCommands ?? []),
      ...(effectGeneration?.effectCommands ?? []),
      ...(pickupGeneration?.effectCommands ?? []),
      ...(tuningGeneration?.effectCommands ?? []),
      ...(kiboPassiveGeneration?.effectCommands ?? []),
      ...(baselineSoulEssenceEffectGeneration?.effectCommands ?? []),
    ],
  });
  const preliminaryCombatRuntime = isVerifiedCombatMechanicsScenario(scenario)
    ? createVerifiedCombatRuntime({
        scenario,
        actionExecutionPlan,
        controlledActorTimeline,
        effectGeneration: mergeVerifiedDirectEffectGeneration(
          effectGeneration,
          pickupGeneration,
          baselineSoulEssenceEffectGeneration
        ),
        tuningGeneration,
        damageEventGeneration,
        effectTimeline: baselineEffectTimeline,
        actionVariantRuntime,
        kiboPassiveGeneration,
        soulEssenceEffectGeneration: baselineSoulEssenceEffectGeneration,
        criticalRandomSource: null,
        runtimeMode: 'non-damage-event-projection',
      })
    : null;
  const nonDamageEventGeneration = isVerifiedCombatMechanicsScenario(scenario)
    ? createVerifiedNonDamageEventGeneration({
        scenario,
        actionExecutionPlan,
        controlledActorTimeline,
        actionResolutionById: actionVariantRuntime?.actionResolutionById,
        verifiedCombatRuntime: preliminaryCombatRuntime,
      })
    : null;
  const soulEventCombatRuntime = isVerifiedCombatMechanicsScenario(scenario)
    ? createVerifiedCombatRuntime({
        scenario,
        actionExecutionPlan,
        controlledActorTimeline,
        effectGeneration: mergeVerifiedDirectEffectGeneration(
          effectGeneration,
          pickupGeneration,
          baselineSoulEssenceEffectGeneration
        ),
        tuningGeneration,
        damageEventGeneration,
        effectTimeline: baselineEffectTimeline,
        actionVariantRuntime,
        kiboPassiveGeneration,
        soulEssenceEffectGeneration: baselineSoulEssenceEffectGeneration,
        criticalRandomSource: soulEventCriticalRandomSource,
      })
    : null;
  const soulEventSnapshot = soulEventCombatRuntime
    ? deriveSoulEventSnapshotFromCombatRuntime(soulEventCombatRuntime)
    : null;
  const kiboReceiveDamageEvents = soulEventCombatRuntime
    ? deriveKiboReceiveDamageEventsFromCombatRuntime(soulEventCombatRuntime)
    : [];
  const finalKiboPassiveGeneration = isVerifiedCombatMechanicsScenario(scenario)
    ? createVerifiedKiboPassiveGeneration({
        scenario,
        actionExecutionPlan,
        actionResolutionById: actionVariantRuntime?.actionResolutionById,
        acceptedSkillStartTransitions,
        kiboReceiveDamageEvents,
      })
    : null;
  const soulEssenceEffectGeneration = isVerifiedCombatMechanicsScenario(
    scenario
  )
    ? createVerifiedSoulEssenceEffectGeneration({
        scenario,
        actionExecutionPlan,
        actionResolutionById: actionVariantRuntime?.actionResolutionById,
        tuningGeneration,
        damageEventGeneration,
        nonDamageEventGeneration,
        soulEventSnapshot,
        controlledActorTimeline,
      })
    : null;
  const effectTimeline = createEffectRuntimeTimeline({
    scenario,
    actionExecutionPlan,
    controlledActorTimeline,
    generatedCommands: [
      ...(actionVariantRuntime?.effectCommands ?? []),
      ...(effectGeneration?.effectCommands ?? []),
      ...(pickupGeneration?.effectCommands ?? []),
      ...(tuningGeneration?.effectCommands ?? []),
      ...(finalKiboPassiveGeneration?.effectCommands ?? []),
      ...(soulEssenceEffectGeneration?.effectCommands ?? []),
    ],
  });
  const verifiedCombatRuntime = createVerifiedCombatRuntime({
    scenario,
    actionExecutionPlan,
    controlledActorTimeline,
    effectGeneration: mergeVerifiedDirectEffectGeneration(
      effectGeneration,
      pickupGeneration,
      soulEssenceEffectGeneration
    ),
    tuningGeneration,
    pickupGeneration,
    damageEventGeneration,
    effectTimeline,
    actionVariantRuntime,
    kiboPassiveGeneration: finalKiboPassiveGeneration,
    soulEssenceEffectGeneration,
    nonDamageEventGeneration,
    criticalRandomSource,
  });
  return {
    actionVariantRuntime,
    effectGeneration,
    pickupGeneration,
    kiboPassiveGeneration: finalKiboPassiveGeneration,
    soulEssenceEffectGeneration,
    nonDamageEventGeneration,
    damageEventGeneration,
    tuningGeneration,
    effectTimeline,
    verifiedCombatRuntime,
  };
}

function mergeVerifiedDirectEffectGeneration(effectGeneration, ...generations) {
  if (!effectGeneration) return effectGeneration;
  const additions = generations.filter(Boolean);
  const directSpEvents = [
    ...(effectGeneration.directSpEvents ?? []),
    ...additions.flatMap(generation => generation.directSpEvents ?? []),
  ];
  const directHpEvents = [
    ...(effectGeneration.directHpEvents ?? []),
    ...additions.flatMap(generation => generation.directHpEvents ?? []),
  ];
  return {
    ...effectGeneration,
    directSpEvents,
    directHpEvents,
    summary: {
      ...(effectGeneration.summary ?? {}),
      directSpEventCount: directSpEvents.length,
      directHpEventCount: directHpEvents.length,
    },
  };
}

function createCriticalRuntime({ scenario, criticalRandomSource }) {
  const validation = validateCombatCriticalScenario(
    scenario?.combatScenario?.critical,
    { actions: scenario?.actions }
  );
  if (!validation.valid) {
    const error = new TypeError(validation.issues[0].message);
    error.code = validation.issues[0].code;
    error.issues = validation.issues;
    throw error;
  }
  const createSeededRandomSource = () =>
    validation.requiresSampledRandomSource
      ? createDeterministicCriticalRandomSource({
          seed: validation.normalized.seed,
        })
      : null;
  return {
    contract: validation.normalized,
    createPreflightRandomSource: createSeededRandomSource,
    createFinalRandomSource: () =>
      criticalRandomSource ?? createSeededRandomSource(),
  };
}

function applyVerifiedResourceExecutionBlocks({
  actionRuleDiagnostics,
  executionBlocks,
}) {
  const blockedByActionId = new Map(
    executionBlocks.map(block => [block.actionId, block])
  );
  const runtimeDiagnostics = executionBlocks.map(block => ({
    schemaVersion: 1,
    id: `${block.code}|${block.actionId}`,
    code: block.code,
    ruleKey: 'verified-resource-cost-precondition',
    status: 'violated',
    severity: 'error',
    actionId: block.actionId,
    actionIds: [block.actionId],
    actionName: block.actionName,
    actorId: block.actorId,
    timeMs: block.timeMs,
    message:
      block.message ??
      (block.status === 'unresolved'
        ? `${block.actionName} 的已验证资源消耗来源或作用对象不完整`
        : block.resourceName
          ? `${block.actionName} 需要${block.resourceName} ${block.requiredValue}，当前 ${block.currentValue}/${block.maxValue}，动作未执行`
          : `${block.actionName} 需要 SP ${block.requiredValue}，当前 ${block.currentValue}/${block.maxValue}，动作未执行`),
    source: {
      sourceKind: block.sourceKind,
      sourceStatus: block.reason,
      sourceIdentity: block.sourceIdentity,
    },
    runtimeBlock: block,
    appliedToSimulationResults: true,
  }));
  const readinessActions = actionRuleDiagnostics.readinessTimeline.actions.map(
    action => {
      const block = blockedByActionId.get(action.actionId);
      if (!block) return action;
      const diagnosticId = `${block.code}|${block.actionId}`;
      return {
        ...action,
        status: 'blocked',
        executable: false,
        diagnosticIds: [...new Set([...action.diagnosticIds, diagnosticId])],
        violationCodes: [...new Set([...action.violationCodes, block.code])],
        verifiedResourceExecutionBlock: block,
        appliedToSimulationResults: true,
      };
    }
  );
  const blockedActionCount = readinessActions.filter(
    action => !action.executable
  ).length;
  const readinessTimeline = {
    ...actionRuleDiagnostics.readinessTimeline,
    status: 'action-readiness-timeline-ready-with-blocked-actions',
    actions: readinessActions,
    cooldownWindows:
      actionRuleDiagnostics.readinessTimeline.cooldownWindows.filter(
        window => !blockedByActionId.has(window.actionId)
      ),
    summary: {
      ...actionRuleDiagnostics.readinessTimeline.summary,
      readyActionCount: readinessActions.filter(
        action => action.status === 'ready'
      ).length,
      blockedActionCount,
      verifiedResourceBlockedActionCount: executionBlocks.length,
      appliedToSimulationResults: true,
    },
    appliedToSimulationResults: true,
  };
  const diagnostics = [
    ...actionRuleDiagnostics.diagnostics,
    ...runtimeDiagnostics,
  ];
  return {
    ...actionRuleDiagnostics,
    status: 'action-rules-violated',
    executable: false,
    diagnostics,
    readinessTimeline,
    summary: {
      ...actionRuleDiagnostics.summary,
      diagnosticCount: diagnostics.length,
      violationCount:
        actionRuleDiagnostics.summary.violationCount + executionBlocks.length,
      errorCount:
        actionRuleDiagnostics.summary.errorCount + executionBlocks.length,
      verifiedResourceBlockedActionCount: executionBlocks.length,
      appliedToSimulationResults: true,
    },
    appliedToSimulationResults: true,
  };
}

function attachVerifiedExecutionBlocks(runtime, executionBlocks) {
  const blockEvents = executionBlocks.map(block => ({
    type: 'VERIFIED_ACTION_RESOURCE_BLOCKED',
    timeMs: block.timeMs,
    actionId: block.actionId,
    actorId: block.actorId,
    payload: block,
  }));
  return {
    ...runtime,
    executionBlocks,
    eventLog: [...runtime.eventLog, ...blockEvents].sort(
      (left, right) =>
        Number(left.timeMs) - Number(right.timeMs) ||
        Number(left.runtimeSequenceIndex ?? Number.MAX_SAFE_INTEGER) -
          Number(right.runtimeSequenceIndex ?? Number.MAX_SAFE_INTEGER)
    ),
    summary: {
      ...runtime.summary,
      resourceBlockedActionCount: executionBlocks.length,
    },
  };
}

function createCooldownStartEvent(action, cooldown = null) {
  const cooldownMs = Number(
    cooldown?.effectiveCooldownMs ?? cooldown?.cooldownMs
  );
  if (
    cooldown?.status !== 'cooldown-charge-consumed' ||
    !Number.isFinite(cooldownMs) ||
    cooldownMs <= 0
  ) {
    return null;
  }
  return {
    type: 'COOLDOWN_START',
    timeMs: action.startMs,
    actionId: action.id,
    actorId: action.actorId,
    payload: {
      cooldownMs,
      baseCooldownMs: cooldown.baseCooldownMs ?? cooldownMs,
      endsAtMs: action.startMs + cooldownMs,
      cooldownCount: cooldown.cooldownCount,
      ownerKind: cooldown.ownerKind,
      ownerId: cooldown.ownerId,
      runtimeOwnerIdentity: cooldown.runtimeOwnerIdentity ?? null,
      kiboId: cooldown.kiboId,
      skillId: cooldown.skillId,
      sourceKind:
        cooldown.sourceIdentity?.sourceKind ??
        cooldown.source?.sourceKind ??
        'azpr-action-cooldown-evaluation',
      evaluationStatus: cooldown.cooldownEvaluation?.status ?? null,
      modifierCount: cooldown.modifierCount ?? 0,
    },
  };
}

function createNonCombatEvent(action, controlledActorTransition = null) {
  if (action.type === ACTION_TYPES.WAIT) {
    return {
      type: 'WAIT',
      timeMs: action.startMs,
      actionId: action.id,
      payload: {
        actionName: action.name,
        durationMs: action.durationMs,
        note: action.note,
      },
    };
  }

  if (action.type === ACTION_TYPES.SWITCH) {
    return {
      type: 'SWITCH',
      timeMs: action.startMs,
      actionId: action.id,
      actorId: action.actorId,
      payload: {
        actionName: action.name,
        sourceActorId: action.actorId,
        sourceActorName: action.actor?.name,
        fromActorId:
          controlledActorTransition?.beforeActor?.actorId ?? action.actorId,
        fromActorName:
          controlledActorTransition?.beforeActor?.actorName ??
          action.actor?.name,
        targetActorId: action.targetActorId,
        targetActorName: action.targetActor?.name,
        afterActorId:
          controlledActorTransition?.afterActor?.actorId ??
          action.targetActorId,
        afterActorName:
          controlledActorTransition?.afterActor?.actorName ??
          action.targetActor?.name,
        transitionStatus: controlledActorTransition?.status ?? '',
        transitionApplied: controlledActorTransition?.applied === true,
        durationMs: action.durationMs,
        note: action.note,
      },
    };
  }

  if (action.type === ACTION_TYPES.ANNOTATION) {
    return {
      type: 'ANNOTATION',
      timeMs: action.startMs,
      actionId: action.id,
      payload: {
        actionName: action.name,
        note: action.note,
      },
    };
  }

  if (action.type === ACTION_TYPES.ENEMY_EVENT) {
    return {
      type: 'ENEMY_EVENT',
      timeMs: action.startMs,
      actionId: action.id,
      targetId: action.target?.id,
      payload: {
        actionName: action.name,
        enemyName: action.target?.name,
        eventType: action.eventType,
        note: action.note,
      },
    };
  }

  if (action.type === ACTION_TYPES.KIBO_EVENT) {
    return {
      type: 'KIBO_EVENT',
      timeMs: action.startMs,
      actionId: action.id,
      actorId: action.actorId,
      payload: {
        actionName: action.name,
        actorName: action.actor?.name,
        kiboId: action.kiboId ?? action.actor?.loadout?.kiboId ?? null,
        ...(action.skillId ? { skillId: action.skillId } : {}),
        eventType: action.eventType,
        ...(action.timing?.source
          ? { timingSource: action.timing.source }
          : {}),
        note: action.note,
        appliedToCalculators: false,
      },
    };
  }

  return null;
}

function createResourceActionEvent(action) {
  if (action.type !== ACTION_TYPES.RESOURCE) {
    return null;
  }

  return {
    type: 'RESOURCE_CHANGE',
    timeMs: action.startMs,
    actionId: action.id,
    actorId: action.actorId,
    payload: {
      resource: action.resource,
      change: Number(action.change) || 0,
      reason: action.reason || 'manual-axis-resource',
      confidence: 'manual',
      note: action.note,
    },
  };
}

function createActionStartEvent(action) {
  return {
    type: 'ACTION_START',
    timeMs: action.startMs,
    actionId: action.id,
    actorId: action.actorId,
    payload: {
      actionName: action.name,
      actionType: action.type,
      skillId: action.skillId,
      actorName: action.actor?.name,
      targetActorName: action.targetActor?.name,
      targetId: action.target?.id,
      targetName: action.target?.name,
    },
  };
}

function createActionSkippedEvent(action, executionEntry) {
  return {
    type: 'ACTION_SKIPPED',
    timeMs: action.startMs,
    actionId: action.id,
    actorId: action.actorId,
    payload: {
      actionName: action.name,
      actionType: action.type,
      reason: executionEntry.skipReason,
      executionStatus: executionEntry.status,
      readinessStatus: executionEntry.readinessStatus,
      diagnosticIds: executionEntry.diagnosticIds,
      violationCodes: executionEntry.violationCodes,
    },
  };
}

function createDamageEvent(action, enemy) {
  const segment = action.selectedDamageSegment;
  if (!segment || !action.actor || !action.target) {
    return null;
  }

  const projection = createRawDamageProjection({
    actor: action.actor,
    enemy,
    action,
    segment,
  });

  return {
    type: 'DAMAGE_PROJECTED',
    timeMs: action.startMs,
    actionId: action.id,
    actorId: action.actorId,
    targetId: action.targetId,
    payload: {
      ...projection,
      timingAccuracy: action.timing?.needsTimingData
        ? 'placeholder'
        : 'authoritative',
    },
  };
}

function eventPriority(type, event = null) {
  if (
    ['EFFECT_APPLIED', 'EFFECT_REFRESHED', 'EFFECT_INHERITED'].includes(type) &&
    ['current-skill-condition', 'accepted-skill-start'].includes(
      event?.sourceIdentity?.triggerEvent
    )
  ) {
    return 7;
  }
  const priorities = {
    SCENARIO_START: 0,
    EFFECT_EXPIRED: 1,
    ACTION_SKIPPED: 2,
    ACTION_START: 2,
    TIMING_DATA_MISSING: 3,
    RESOURCE_CHANGE: 4,
    VERIFIED_RESOURCE_CHANGE: 4,
    VERIFIED_KIBO_RESOURCE_CHANGE: 4,
    EFFECT_INHERITED: 5,
    EFFECT_APPLIED: 5,
    EFFECT_REFRESHED: 5,
    EFFECT_REMOVED: 5,
    COOLDOWN_START: 6,
    VERIFIED_KIBO_PASSIVE_VITAL_DAMAGE: 8,
    VERIFIED_KIBO_PASSIVE_VITAL_DAMAGE_SUPPRESSED: 8,
    DAMAGE_PROJECTED: 7,
    WAIT: 8,
    SWITCH: 9,
    KIBO_EVENT: 10,
    ENEMY_EVENT: 11,
    ANNOTATION: 12,
    DAMAGE_SKIPPED: 13,
    SCENARIO_END: 99,
  };

  return priorities[type] ?? 50;
}
