import {
  CompileProjectError,
  compileProject,
} from '../compiler/compileProject';
import { simulateScenario } from '../engine/simulateScenario';
import {
  CANONICAL_HASH_ALGORITHM,
  canonicalizeValue,
  hashCanonicalValue,
} from './canonicalSerialization';
import {
  normalizeCombatCriticalScenario,
  validateCombatCriticalScenario,
} from '../../domain/combatCriticalPolicy';
import { getInstalledVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import {
  assertCharacterIsOptimizationReady,
  getCharacterAcceptanceCatalog,
  getCharacterAcceptanceEntry,
} from '../../character-acceptance/characterAcceptanceCatalog';
import {
  isAuthoritativeKiboAutoCastDerivationRegistry,
  projectKiboAutoCastDerivationRegistry,
} from '../../domain/verifiedBackgroundActionDerivation';
import { projectVerifiedSwitchExitTailPolicy } from '../generation/verifiedSwitchExitTailPolicy';
import { isAuthoritativeSwitchTriggerGeneration } from '../generation/switchTriggeredActionGeneration';
import { getVerifiedNormalAttackInputAuthorityDescriptor } from '../../domain/verifiedNormalAttackInputAuthority';

export const CANONICAL_HEADLESS_COMBAT_CORE_SCHEMA_VERSION = 1;
export const CANONICAL_HEADLESS_COMBAT_CORE_CONTRACT =
  'AzPrCanonicalHeadlessCombatCore';
export const CANONICAL_HEADLESS_COMBAT_INPUT_KIND =
  'azpr-canonical-headless-combat-input';
export const CANONICAL_HEADLESS_COMBAT_COMPILATION_KIND =
  'azpr-canonical-headless-combat-compilation';
export const CANONICAL_HEADLESS_COMBAT_RUN_KIND =
  'azpr-canonical-headless-combat-run';

export function createCanonicalHeadlessCombatCore({
  gameData,
  compileOptions = {},
  simulationOptions = {},
  compileProjectImpl = compileProject,
  simulateScenarioImpl = simulateScenario,
} = {}) {
  assertGameData(gameData);
  const authoritativeCompilations = new WeakSet();

  function catalog() {
    const value = createCatalogProjection(gameData);
    return {
      schemaVersion: CANONICAL_HEADLESS_COMBAT_CORE_SCHEMA_VERSION,
      contractName: CANONICAL_HEADLESS_COMBAT_CORE_CONTRACT,
      kind: 'azpr-canonical-combat-catalog',
      hashAlgorithm: CANONICAL_HASH_ALGORITHM,
      catalogHash: hashCanonicalValue(value),
      ...value,
    };
  }

  function compile(input, options = {}) {
    if (isCompilation(input)) {
      if (!authoritativeCompilations.has(input)) {
        throw new CanonicalHeadlessCombatValidationError([
          {
            code: 'canonical-compilation-not-authoritative',
            path: 'input.kind',
            message:
              'Compilation objects must be minted and remain unchanged inside this canonical core instance',
          },
        ]);
      }
      assertScenarioDerivationAuthority(input.scenario);
      return input;
    }
    const projectInput = input?.project ?? input;
    const criticalValidation = validateCombatCriticalScenario(
      resolveCoreCriticalInput(input),
      { actions: projectInput?.actions }
    );
    if (!criticalValidation.valid) {
      throw new CanonicalHeadlessCombatValidationError(
        criticalValidation.issues
      );
    }
    const normalizedInput = normalizeCoreInput(input);
    const resolvedCompileOptions = {
      ...compileOptions,
      ...(options.compileOptions ?? {}),
    };
    const scenario = compileProjectImpl(
      normalizedInput.project,
      gameData,
      resolvedCompileOptions
    );
    assertScenarioDerivationAuthority(scenario);
    const dataIdentity = createDataIdentity({ scenario, gameData });
    const kiboAutoCastDerivationAuthority =
      projectKiboAutoCastDerivationRegistry(
        scenario.kiboAutoCastDerivationRegistry
      );
    const switchTriggerGenerationAuthority =
      projectSwitchTriggerGenerationAuthority(scenario.switchTriggerGeneration);
    const inputProjection = canonicalizeValue({
      schemaVersion: normalizedInput.schemaVersion,
      project: createCanonicalProjectInput(normalizedInput.project),
      critical: scenario.combatScenario?.critical ?? null,
      dataIdentity,
      kiboAutoCastDerivationAuthority,
      switchTriggerGenerationAuthority,
    });
    const compilation = {
      schemaVersion: CANONICAL_HEADLESS_COMBAT_CORE_SCHEMA_VERSION,
      contractName: CANONICAL_HEADLESS_COMBAT_CORE_CONTRACT,
      kind: CANONICAL_HEADLESS_COMBAT_COMPILATION_KIND,
      input: normalizedInput,
      project: normalizedInput.project,
      scenario,
      diagnostics: canonicalizeValue(scenario.diagnostics ?? {}),
      hashes: {
        algorithm: CANONICAL_HASH_ALGORITHM,
        input: hashCanonicalValue(inputProjection),
        data: hashCanonicalValue(dataIdentity),
      },
      dataIdentity,
    };
    authoritativeCompilations.add(compilation);
    return compilation;
  }

  function validate(input, options = {}) {
    try {
      const compilation = compile(input, options);
      return {
        schemaVersion: CANONICAL_HEADLESS_COMBAT_CORE_SCHEMA_VERSION,
        kind: 'azpr-canonical-headless-combat-validation',
        valid: true,
        issues: [],
        warnings: compilation.scenario.diagnostics?.validationWarnings ?? [],
        inputHash: compilation.hashes.input,
        dataHash: compilation.hashes.data,
      };
    } catch (error) {
      const issues = normalizeValidationIssues(error);
      return {
        schemaVersion: CANONICAL_HEADLESS_COMBAT_CORE_SCHEMA_VERSION,
        kind: 'azpr-canonical-headless-combat-validation',
        valid: false,
        issues,
        warnings: [],
        inputHash: null,
        dataHash: null,
      };
    }
  }

  function simulate(input, options = {}) {
    const compilation = compile(input, options);
    const simulation = simulateScenarioImpl(compilation.scenario, {
      ...simulationOptions,
      ...(options.simulationOptions ?? {}),
    });
    const trace = createCanonicalCombatTrace({ compilation, simulation });
    const evaluation = createCanonicalCombatEvaluation(simulation);
    const traceHash = hashCanonicalValue(trace);
    const buildHash = hashCanonicalValue({
      objectiveContract:
        compilation.scenario.combatScenario?.objectiveContract ?? null,
      optimizationScenarioPolicy:
        compilation.scenario.combatScenario?.optimizationScenarioPolicy ?? null,
      jointAttackRuntime:
        compilation.scenario.combatScenario?.jointAttackRuntime ?? null,
      enemyProfile: compilation.scenario.enemy?.profile ?? null,
      kiboAutoCastDerivationAuthority:
        compilation.dataIdentity?.kiboAutoCastDerivationAuthority ?? null,
      switchTriggerGenerationAuthority:
        compilation.dataIdentity?.switchTriggerGenerationAuthority ?? null,
      headlessAssumptionContracts:
        compilation.dataIdentity.headlessAssumptionContracts ?? [],
      inputHash: compilation.hashes.input,
      dataHash: compilation.hashes.data,
      traceHash,
    });
    return {
      schemaVersion: CANONICAL_HEADLESS_COMBAT_CORE_SCHEMA_VERSION,
      contractName: CANONICAL_HEADLESS_COMBAT_CORE_CONTRACT,
      kind: CANONICAL_HEADLESS_COMBAT_RUN_KIND,
      compilation,
      simulation,
      trace,
      evaluation,
      hashes: {
        ...compilation.hashes,
        trace: traceHash,
        evaluation: hashCanonicalValue(evaluation),
        build: buildHash,
      },
      traceHash,
      inputHash: compilation.hashes.input,
      dataHash: compilation.hashes.data,
    };
  }

  function evaluate(input, options = {}) {
    return isRun(input)
      ? input.evaluation
      : createCanonicalCombatEvaluation(
          isSimulationResult(input)
            ? input
            : simulate(input, options).simulation
        );
  }

  function explain(input, selector = {}, options = {}) {
    const run = isRun(input) ? input : simulate(input, options);
    return createCanonicalCombatExplanation(run, selector);
  }

  function acceptanceCatalog() {
    return getCharacterAcceptanceCatalog();
  }

  function acceptanceFor(ownerId) {
    return getCharacterAcceptanceEntry(ownerId);
  }

  function assertOptimizationReady(ownerId) {
    return assertCharacterIsOptimizationReady(ownerId);
  }

  return Object.freeze({
    schemaVersion: CANONICAL_HEADLESS_COMBAT_CORE_SCHEMA_VERSION,
    contractName: CANONICAL_HEADLESS_COMBAT_CORE_CONTRACT,
    catalog,
    compile,
    validate,
    simulate,
    evaluate,
    explain,
    acceptanceCatalog,
    acceptanceFor,
    assertOptimizationReady,
  });
}

export class CanonicalHeadlessCombatValidationError extends Error {
  constructor(issues) {
    super('Canonical headless combat input is invalid');
    this.name = 'CanonicalHeadlessCombatValidationError';
    this.issues = issues;
  }
}

export function createCanonicalCombatTrace({ compilation, simulation }) {
  const effectiveScenario =
    simulation.effectiveActionTimeline?.scenario ?? compilation.scenario;
  const verifiedRuntime = simulation.verifiedCombatRuntime ?? {};
  const specialRuntime = verifiedRuntime.specialResourceRuntime ?? {};
  const targetStateRuntime =
    specialRuntime.targetStateRuntime ??
    verifiedRuntime.targetStateRuntime ??
    {};
  const effectTimeline = simulation.effectTimeline ?? {};
  const kiboPassiveRuntimeStates =
    simulation.verifiedKiboPassiveGeneration?.runtimeStates ?? [];
  const attackChainContinuityWindows = projectAttackChainContinuityWindows(
    simulation.verifiedActionVariantRuntime?.activeSwitchWindows
  );
  const normalAttackSpecialContinuationCandidates =
    projectNormalAttackSpecialContinuationCandidates(
      simulation.verifiedActionVariantRuntime
        ?.normalAttackSpecialContinuationCandidates
    );
  const trace = {
    schemaVersion: CANONICAL_HEADLESS_COMBAT_CORE_SCHEMA_VERSION,
    kind: 'azpr-canonical-combat-trace',
    dataIdentity: compilation.dataIdentity,
    scenario: {
      projectId: simulation.scenario?.projectId ?? null,
      projectName: simulation.scenario?.projectName ?? null,
      durationMs: simulation.scenario?.durationMs ?? 0,
      frameRate: Number(effectiveScenario.time?.fps) || 60,
      enemyId: simulation.scenario?.enemyId ?? null,
      enemyProfile: projectEnemyProfileIdentity(
        effectiveScenario.enemy?.profile
      ),
      actorIds: (effectiveScenario.actors ?? []).map(actor => actor.id),
      ...(effectiveScenario.combatScenario?.target == null
        ? {}
        : { targetPolicy: effectiveScenario.combatScenario.target }),
      ...(effectiveScenario.combatScenario?.optimizationScenarioPolicy == null
        ? {}
        : {
            optimizationScenarioPolicy:
              effectiveScenario.combatScenario.optimizationScenarioPolicy,
          }),
      ...(effectiveScenario.combatScenario?.objectiveContract == null
        ? {}
        : {
            objectiveContract:
              effectiveScenario.combatScenario.objectiveContract,
          }),
      ...(effectiveScenario.combatScenario?.jointAttackRuntime == null
        ? {}
        : {
            jointAttackRuntime:
              effectiveScenario.combatScenario.jointAttackRuntime,
          }),
      ...(effectiveScenario.kiboAutoCastDerivationRegistry == null
        ? {}
        : {
            kiboAutoCastDerivationAuthority:
              projectKiboAutoCastDerivationRegistry(
                effectiveScenario.kiboAutoCastDerivationRegistry
              ),
          }),
      switchTriggerGenerationAuthority: projectSwitchTriggerGenerationAuthority(
        effectiveScenario.switchTriggerGeneration
      ),
    },
    critical: effectiveScenario.combatScenario?.critical ?? null,
    headlessAssumptionContracts:
      compilation.dataIdentity.headlessAssumptionContracts ?? [],
    actions: (effectiveScenario.actions ?? []).map(projectTraceAction),
    executionPlan: projectExecutionPlan(simulation.actionExecutionPlan),
    readiness: projectReadinessTimeline(simulation.actionReadinessTimeline),
    events: (simulation.eventLog ?? []).map(projectRuntimeEvent),
    damage: (simulation.damageTimeline ?? []).map(projectDamageEvent),
    resources: {
      actors: simulation.resourceTimeline ?? [],
      kibos: simulation.kiboResourceTimeline ?? [],
      special: [
        ...(specialRuntime.resourceEvents ?? []).map(projectRuntimeEvent),
        ...(specialRuntime.stateEvents ?? []).map(projectRuntimeEvent),
      ],
      tuningMarks: (
        simulation.verifiedTuningMarkGeneration?.events ??
        verifiedRuntime.tuningMarkRuntime?.events ??
        []
      ).map(projectTuningMarkEvent),
      tuningAcquisitionGates: (
        simulation.verifiedTuningMarkGeneration?.acquisitionGateResults ??
        verifiedRuntime.tuningMarkRuntime?.acquisitionGateResults ??
        []
      ).map(projectTuningAcquisitionGate),
    },
    state: {
      initial: verifiedRuntime.initialState ?? null,
      final: verifiedRuntime.finalState ?? null,
      targetEvents: (targetStateRuntime.events ?? []).map(projectRuntimeEvent),
      conditionalHitGroups: (targetStateRuntime.groupResults ?? []).map(
        projectConditionalHitGroup
      ),
      tuningConditionalHitGroups: (
        simulation.verifiedTuningMarkGeneration?.conditionalDamageResults ??
        verifiedRuntime.tuningMarkRuntime?.conditionalDamageResults ??
        []
      ).map(projectTuningConditionalHitGroup),
      tuningConsumeJudgments: (
        simulation.verifiedTuningMarkGeneration?.consumeJudgmentResults ??
        verifiedRuntime.tuningMarkRuntime?.consumeJudgmentResults ??
        []
      ).map(projectTuningConsumeJudgment),
      ...(kiboPassiveRuntimeStates.length > 0
        ? {
            kiboPassives: kiboPassiveRuntimeStates.map(
              projectKiboPassiveRuntimeState
            ),
          }
        : {}),
    },
    effects: {
      events: (effectTimeline.events ?? []).map(projectEffectEvent),
      intervals: (effectTimeline.intervals ?? []).map(projectEffectInterval),
      summary: effectTimeline.summary ?? null,
    },
    controlledActors: projectControlledActorTimeline(
      simulation.controlledActorTimeline
    ),
    variants: {
      selections: projectVariantSelections(
        simulation.verifiedActionVariantRuntime?.selectionByActionId
      ),
      ...(attackChainContinuityWindows.length > 0
        ? { attackChainContinuityWindows }
        : {}),
      ...(normalAttackSpecialContinuationCandidates.length > 0
        ? { normalAttackSpecialContinuationCandidates }
        : {}),
      stateEvents: (
        simulation.verifiedActionVariantRuntime?.stateEvents ?? []
      ).map(projectRuntimeEvent),
      resourceEvents: (
        simulation.verifiedActionVariantRuntime?.resourceEvents ?? []
      ).map(projectRuntimeEvent),
      companionEvents: (
        simulation.verifiedActionVariantRuntime?.companionEvents ?? []
      ).map(projectRuntimeEvent),
      companionAttacks: (
        simulation.verifiedActionVariantRuntime?.companionAttackTransactions ??
        []
      ).map(projectCompanionAttack),
    },
    summary: simulation.summary,
    diagnostics: projectDiagnostics(simulation),
  };
  return canonicalizeValue(trace);
}

function projectTraceAction(action) {
  const derivation = projectActionDerivation(action);
  return {
    id: action.id,
    type: action.type,
    name: action.name,
    actionKind: action.actionKind ?? null,
    actorId: action.actorId ?? null,
    targetId: action.targetId ?? null,
    skillId: action.skillId ?? null,
    startMs: action.startMs,
    durationMs: action.durationMs,
    sourceSequenceIndex: action.sourceSequenceIndex ?? null,
    sourceSequencePath: action.sourceSequencePath ?? null,
    sourceSequenceSource: action.sourceSequenceSource ?? null,
    controlSkillId:
      action.selectedActionForm?.controlSkillId ??
      action.actionVariantResolution?.controlSkillId ??
      action.attackInput?.controlSkillId ??
      null,
    subSkillIndex:
      action.selectedActionForm?.subSkillIndex ??
      action.attackInput?.selectedSubSkillIndex ??
      action.controlSubSkillIndex ??
      null,
    semanticName:
      action.actionVariantResolution?.semanticName ??
      action.selectedActionForm?.semanticName ??
      null,
    sourceEvidenceStatus: action.sourceEvidenceStatus ?? null,
    scenarioRuntimeStatus: action.scenarioRuntimeStatus ?? null,
    ...(derivation == null ? {} : { derivation }),
    ...(action.switchExitTailPolicy == null
      ? {}
      : {
          switchExitTailPolicy: projectVerifiedSwitchExitTailPolicy(
            action.switchExitTailPolicy
          ),
        }),
    ...(action.attackGroupId == null
      ? {}
      : {
          attackGroupId: action.attackGroupId,
          attackSequenceIndex: action.attackSequenceIndex ?? null,
          attackSequenceTotal: action.attackSequenceTotal ?? null,
          attackInputChainIdentity: action.attackInputChainIdentity ?? null,
          attackInputIdentity: action.attackInput?.identity ?? null,
          attackInputAnimationDurationFrames:
            action.attackInput?.animationDurationFrames ?? null,
          attackInputDurationBasis: action.attackInput?.durationBasis ?? null,
          attackInputSourceIdentity: action.attackInput?.sourceIdentity ?? null,
          attackInputLinkTimingStatus:
            action.attackInput?.linkTimingStatus ?? null,
          attackInputLinkWindow: action.attackInput?.linkWindow
            ? {
                kind: action.attackInput.linkWindow.kind ?? null,
                startFrame: action.attackInput.linkWindow.startFrame ?? null,
                endFrame: action.attackInput.linkWindow.endFrame ?? null,
                targetControlSkillId:
                  action.attackInput.linkWindow.targetControlSkillId ?? null,
                targetSubSkillIndex:
                  action.attackInput.linkWindow.targetSubSkillIndex ?? null,
                allowAttack: action.attackInput.linkWindow.allowAttack ?? null,
                sourceIdentity:
                  action.attackInput.linkWindow.sourceIdentity ?? null,
              }
            : null,
        }),
    hitOverrides: action.hitOverrides ?? {},
  };
}

function projectActionDerivation(action) {
  if (action?.autoCastRule != null) {
    const rule = action.autoCastRule;
    return {
      schemaVersion: rule.schemaVersion ?? null,
      contractName: rule.contractName ?? null,
      kind: rule.kind ?? null,
      source: rule.source ?? null,
      sourceIdentity: rule.sourceIdentity ?? null,
      derivationHash: rule.derivationHash ?? null,
      actionId: rule.actionId ?? null,
      ownerSlotId: rule.ownerSlotId ?? null,
      canonicalOwnerSlotId: rule.canonicalOwnerSlotId ?? null,
      ownerActorId: rule.ownerActorId ?? null,
      ownerCharacterId: rule.ownerCharacterId ?? null,
      kiboId: rule.kiboId ?? null,
      publicActionId: rule.publicActionId ?? null,
      actionKind: rule.actionKind ?? null,
      scheduledFrame: rule.scheduledFrame ?? null,
      sequenceIndex: rule.sequenceIndex ?? null,
      sourceSequencePath: rule.sourceSequencePath ?? null,
      sourceSequenceSource: rule.sourceSequenceSource ?? null,
      controlledIntervalIdentity: rule.controlledIntervalIdentity ?? null,
      controlledIntervalStartFrame: rule.controlledIntervalStartFrame ?? null,
      controlledIntervalEndFrame: rule.controlledIntervalEndFrame ?? null,
      switchExitTailStatus: rule.switchExitTailStatus ?? null,
      switchBoundaryFrame: rule.switchBoundaryFrame ?? null,
      switchTransitionId: rule.switchTransitionId ?? null,
      switchBoundarySourceSequencePath:
        rule.switchBoundarySourceSequencePath ?? null,
      switchExitTailPolicyHash: rule.switchExitTailPolicyHash ?? null,
      mappingIdentity: rule.mappingIdentity ?? null,
      mechanicsPackageId: rule.mechanicsPackageId ?? null,
      mechanicsPackageHash: rule.mechanicsPackageHash ?? null,
      catalogHash: rule.catalogHash ?? null,
      trigger: rule.trigger ?? null,
      triggerTag: rule.triggerTag ?? null,
      arbitrationPolicy: rule.arbitrationPolicy ?? null,
      evidenceStatus: rule.evidenceStatus ?? null,
    };
  }
  if (action?.derivedAction != null || action?.switchTriggerBinding != null) {
    const declaration = action.derivedAction ?? {};
    const binding = action.switchTriggerBinding ?? {};
    return {
      schemaVersion: declaration.schemaVersion ?? null,
      contractName: binding.contractName ?? null,
      kind: declaration.kind ?? null,
      parentActionId:
        declaration.parentActionId ?? action.parentActionId ?? null,
      bindingId: declaration.bindingId ?? binding.bindingId ?? null,
      triggerPhase: binding.triggerPhase ?? null,
      ownerActorId: binding.starCarryOwnerId ?? action.actorId ?? null,
      ownerCharacterId: binding.starCarryOwnerCharacterId ?? null,
      sourceIdentity: binding.sourceIdentity ?? null,
      sourceIdentities: [...(binding.sourceIdentities ?? [])],
      readOnly: declaration.readOnly === true && action.readOnly === true,
    };
  }
  return null;
}

function projectExecutionPlan(plan = {}) {
  return {
    status: plan.status ?? null,
    actions: (plan.actions ?? []).map(entry => ({
      actionId: entry.actionId,
      status: entry.status,
      execute: entry.execute,
      executionIndex: entry.executionIndex,
      sourceSequenceIndex: entry.sourceSequenceIndex ?? null,
      sourceSequencePath: entry.sourceSequencePath ?? null,
      sourceSequenceSource: entry.sourceSequenceSource ?? null,
      startMs: entry.startMs,
      durationMs: entry.durationMs,
      readinessStatus: entry.readinessStatus,
      diagnosticIds: entry.diagnosticIds ?? [],
      violationCodes: entry.violationCodes ?? [],
      unresolvedCodes: entry.unresolvedCodes ?? [],
      skipReason: entry.skipReason ?? null,
    })),
    summary: plan.summary ?? null,
  };
}

function projectReadinessTimeline(timeline = {}) {
  return {
    status: timeline.status ?? null,
    actions: (timeline.actions ?? []).map(entry => ({
      actionId: entry.actionId,
      status: entry.status,
      executable: entry.executable,
      diagnosticIds: entry.diagnosticIds ?? [],
      violationCodes: entry.violationCodes ?? [],
      unresolvedCodes: entry.unresolvedCodes ?? [],
      cooldown: projectCooldownReadiness(entry.cooldown),
    })),
    cooldownWindows: (timeline.cooldownWindows ?? []).map(cooldownWindow => ({
      actionId: cooldownWindow.actionId,
      runtimeOwnerIdentity: cooldownWindow.runtimeOwnerIdentity ?? null,
      ownerId: cooldownWindow.ownerId ?? null,
      skillId: cooldownWindow.skillId ?? null,
      chargeIndex: cooldownWindow.chargeIndex ?? null,
      cooldownCount: cooldownWindow.cooldownCount ?? null,
      startMs: cooldownWindow.startMs,
      endMs: cooldownWindow.endMs,
      status: cooldownWindow.status ?? null,
      cooldownReductionTransactionIds:
        cooldownWindow.cooldownReductionTransactionIds ?? [],
    })),
    cooldownReductionTransactions: (
      timeline.cooldownReductionTransactions ?? []
    ).map(transaction => ({
      eventIdentity: transaction.eventIdentity ?? null,
      status: transaction.status ?? null,
      timeMs: transaction.timeMs ?? null,
      sourceActionId: transaction.sourceActionId ?? null,
      sourceElementId: transaction.sourceElementId ?? null,
      sourceSequencePath: transaction.sourceSequencePath ?? null,
      slot: transaction.slot ?? null,
      cdRecoveryType: transaction.cdRecoveryType ?? null,
      targetSkillId: transaction.targetSkillId ?? null,
      targetChargeIndex: transaction.targetChargeIndex ?? null,
      cooldownType: transaction.cooldownType ?? null,
      beforeChargeCount: transaction.beforeChargeCount ?? null,
      afterChargeCount: transaction.afterChargeCount ?? null,
      beforeCoolTimeMs: transaction.beforeCoolTimeMs ?? null,
      afterCoolTimeMs: transaction.afterCoolTimeMs ?? null,
      beforeSharedTimerRunning: transaction.beforeSharedTimerRunning ?? null,
      afterSharedTimerRunning: transaction.afterSharedTimerRunning ?? null,
      beforeReadyAtMs: transaction.beforeReadyAtMs ?? null,
      afterReadyAtMs: transaction.afterReadyAtMs ?? null,
      nextReadyAtMs: transaction.nextReadyAtMs ?? null,
      appliedReductionMs: transaction.appliedReductionMs ?? null,
      discardedReductionMs: transaction.discardedReductionMs ?? null,
      restoredChargeCount: transaction.restoredChargeCount ?? 0,
      consumed: transaction.consumed === true,
      appliedToSimulationResults:
        transaction.appliedToSimulationResults === true,
    })),
    cooldownState: (timeline.cooldownState ?? []).map(state => ({
      runtimeOwnerIdentity: state.runtimeOwnerIdentity ?? null,
      ownerId: state.ownerId ?? null,
      skillId: state.skillId ?? null,
      cooldownIdentity: state.cooldownIdentity ?? null,
      cooldownType: state.cooldownType ?? null,
      fullCooldownMs: state.fullCooldownMs ?? null,
      chargeMaxCount: state.chargeMaxCount ?? null,
      currentChargeCount: state.currentChargeCount ?? null,
      coolTimeMs: state.coolTimeMs ?? null,
      sharedTimerRunning: state.sharedTimerRunning === true,
      nextReadyAtMs: state.nextReadyAtMs ?? null,
      lastSettlementTimeMs: state.lastSettlementTimeMs ?? null,
      lastSettlementIdentity: state.lastSettlementIdentity ?? null,
      lastCooldownReductionTransactionId:
        state.lastCooldownReductionTransactionId ?? null,
      missingChargeSourceActionIds: state.missingChargeSourceActionIds ?? [],
      charges: (state.charges ?? []).map(charge => ({
        chargeIndex: charge.chargeIndex ?? null,
        readyAtMs: charge.readyAtMs ?? null,
        sourceActionId: charge.sourceActionId ?? null,
        cooldownReductionTransactionIds:
          charge.cooldownReductionTransactionIds ?? [],
      })),
    })),
    summary: timeline.summary ?? null,
  };
}

function projectCooldownReadiness(cooldown) {
  if (!cooldown) return null;
  const projectChargeState = state =>
    state
      ? {
          cooldownType: state.cooldownType ?? null,
          fullCooldownMs: state.fullCooldownMs ?? null,
          chargeMaxCount: state.chargeMaxCount ?? null,
          currentChargeCount: state.currentChargeCount ?? null,
          availableCount: state.availableCount ?? null,
          coolTimeMs: state.coolTimeMs ?? null,
          sharedTimerRunning: state.sharedTimerRunning === true,
          nextReadyAtMs: state.nextReadyAtMs ?? null,
          lastSettlementTimeMs: state.lastSettlementTimeMs ?? null,
          lastSettlementIdentity: state.lastSettlementIdentity ?? null,
          lastCooldownReductionTransactionId:
            state.lastCooldownReductionTransactionId ?? null,
          missingChargeSourceActionIds:
            state.missingChargeSourceActionIds ?? [],
          cooldownReductionTransactionIds:
            state.cooldownReductionTransactionIds ?? [],
        }
      : null;
  return {
    status: cooldown.status ?? null,
    cooldownMs: cooldown.cooldownMs ?? null,
    cooldownCount: cooldown.cooldownCount ?? null,
    cooldownType: cooldown.cooldownType ?? null,
    availableBefore: cooldown.availableBefore ?? null,
    availableAfter: cooldown.availableAfter ?? null,
    consumedChargeIndex: cooldown.consumedChargeIndex ?? null,
    nextReadyAtMs: cooldown.nextReadyAtMs ?? null,
    windowId: cooldown.windowId ?? null,
    chargeStateBefore: projectChargeState(cooldown.chargeStateBefore),
    chargeStateAfter: projectChargeState(cooldown.chargeStateAfter),
    cooldownReductionTransactionIds: (
      cooldown.cooldownReductionTransactions ?? []
    ).map(transaction => transaction.eventIdentity ?? null),
  };
}

function projectRuntimeEvent(event = {}) {
  return {
    id: event.id ?? event.eventId ?? null,
    type: event.type ?? event.kind ?? null,
    timeMs: event.timeMs ?? null,
    absoluteFrame: event.absoluteFrame ?? event.frameIndex ?? null,
    runtimePhase: event.runtimePhase ?? null,
    runtimePhasePriority: event.runtimePhasePriority ?? null,
    runtimePriority: event.runtimePriority ?? null,
    runtimeSequenceIndex: event.runtimeSequenceIndex ?? null,
    sourceSequencePath: event.sourceSequencePath ?? null,
    actionId: event.actionId ?? null,
    actorId: event.actorId ?? null,
    targetId: event.targetId ?? null,
    payload: projectRuntimePayload(event.payload),
  };
}

function projectRuntimePayload(payload = null) {
  if (!payload || typeof payload !== 'object') return payload;
  const result = {};
  const scalarKeys = [
    'actionName',
    'actionType',
    'skillId',
    'ownerKind',
    'ownerId',
    'runtimeOwnerIdentity',
    'kiboId',
    'sourceActorId',
    'sourceKiboId',
    'sourceSlotId',
    'sourcePosition',
    'companionIdentity',
    'companionUnitId',
    'companionRevision',
    'attackIdentity',
    'attackCount',
    'startsAtMs',
    'targetActorId',
    'targetKind',
    'targetKiboId',
    'targetSlotId',
    'targetPosition',
    'fromActorId',
    'afterActorId',
    'resource',
    'resourceIdentity',
    'stateIdentity',
    'stateElementId',
    'stateName',
    'effectId',
    'effectIdentity',
    'rootEffectId',
    'rootElementId',
    'healElementId',
    'passiveSkillId',
    'passiveName',
    'elementId',
    'hitIdentity',
    'hitKey',
    'hitIndex',
    'hitSkillId',
    'operation',
    'reason',
    'status',
    'confidence',
    'change',
    'requestedChange',
    'requestedHeal',
    'appliedHeal',
    'overheal',
    'beforeValue',
    'afterValue',
    'currentValue',
    'maxValue',
    'maximum',
    'frameIndex',
    'tickIndex',
    'thresholdMs',
    'intervalMs',
    'conditionMatched',
    'coefficientRaw',
    'baseFormulaValue',
    'baseNominalHeal',
    'sourceMaxHp',
    'sourceShootHealUpRaw',
    'targetSufferHealUpRaw',
    'healUpFactor',
    'globalMultiplier',
    'roundingPolicy',
    'configuredPostFunctionRuntimeStatus',
    'sourceAttributionStatus',
    'sourceSelectionPolicy',
    'durationMs',
    'cooldownMs',
    'baseCooldownMs',
    'endsAtMs',
    'cooldownCount',
    'stateDurationMs',
    'expiresAtMs',
    'layers',
    'stacks',
    'appliedToCalculators',
    'applied',
    'watcherIdentity',
    'armHitIdentity',
    'armedAtMs',
    'triggerTimeMs',
    'remainingTriggerCount',
    'triggerEvent',
    'armOrder',
    'boundary',
    'effectBoundary',
    'effectDurationMs',
    'appliedAssumptionIdentity',
    'appliedAssumptionVersion',
    'appliedAssumptionHash',
    'pairIdentity',
    'actorActionId',
    'kiboActionId',
    'mappingIdentity',
    'kiboResolutionIdentity',
    'anchorHitIdentity',
    'anchorRelativeFrame',
    'anchorAbsoluteFrame',
    'threshold',
    'currentToughness',
    'forceBreak',
    'runtimeContractId',
    'runtimeContractHash',
    'runtimeBindingHash',
    'jointAttackCalculatedToughnessDamage',
    'jointAttackPairIdentity',
    'jointAttackAnchorFrame',
    'jointAttackKiboAnchorHit',
  ];
  for (const key of scalarKeys) {
    if (payload[key] !== undefined) result[key] = payload[key];
  }
  for (const key of [
    'diagnosticIds',
    'violationCodes',
    'unresolvedCodes',
    'unresolvedReasons',
  ]) {
    if (Array.isArray(payload[key])) result[key] = payload[key];
  }
  for (const key of [
    'appliedTargetIds',
    'appliedEffectIdentities',
    'candidateWindowIdentities',
    'anchorHitIdentities',
    'fallbackApplications',
    'settlementOrder',
    'costActionIds',
  ]) {
    if (Array.isArray(payload[key])) result[key] = payload[key];
  }
  if (payload.sourceIdentity != null) {
    result.sourceIdentity = projectSourceIdentity(payload.sourceIdentity);
  }
  if (Array.isArray(payload.contributingSources)) {
    result.contributingSources = payload.contributingSources.map(source => ({
      sourceActorId: source.sourceActorId ?? null,
      sourceActorName: source.sourceActorName ?? null,
      sourceKiboId: source.sourceKiboId ?? null,
      sourceSlotId: source.sourceSlotId ?? null,
      sourcePosition: source.sourcePosition ?? null,
    }));
  }
  if (payload.formulaSource != null) {
    result.formulaSource = payload.formulaSource;
  }
  if (Array.isArray(payload.valueShields)) {
    result.valueShields = payload.valueShields;
  }
  if (payload.formulaAttributeTrace != null) {
    result.formulaAttributeTrace = payload.formulaAttributeTrace;
  }
  if (payload.targetMaximumHpResolution != null) {
    result.targetMaximumHpResolution = payload.targetMaximumHpResolution;
  }
  if (payload.formulaAttributeResolution != null) {
    result.formulaAttributeResolution = payload.formulaAttributeResolution;
  }
  if (payload.sameTimeVitalOrderConflict != null) {
    result.sameTimeVitalOrderConflict = payload.sameTimeVitalOrderConflict;
  }
  if (payload.stateTransaction != null) {
    result.stateTransaction = payload.stateTransaction;
  }
  if (payload.admissionCursor != null) {
    result.admissionCursor = payload.admissionCursor;
  }
  if (payload.eligibilityCursor != null) {
    result.eligibilityCursor = payload.eligibilityCursor;
  }
  if (payload.before != null)
    result.before = projectEffectState(payload.before);
  if (payload.after != null) result.after = projectEffectState(payload.after);
  return result;
}

function projectDamageEvent(event = {}) {
  const formula = event.formulaBreakdown ?? {};
  const verifiedResult = formula.verifiedResult ?? {};
  return {
    eventType: event.eventType ?? null,
    stateEventKind: event.stateEventKind ?? null,
    timeMs: event.timeMs,
    absoluteFrame: event.absoluteFrame ?? null,
    runtimePhase: event.runtimePhase ?? null,
    runtimePhasePriority: event.runtimePhasePriority ?? null,
    runtimePriority: event.runtimePriority ?? null,
    runtimeSequenceIndex: event.runtimeSequenceIndex ?? null,
    actionId: event.actionId,
    actorId: event.actorId,
    targetId: event.targetId,
    hitIdentity:
      event.hitIdentity ??
      event.anchorHitIdentity ??
      formula.randomBranch?.hitIdentity ??
      null,
    hitKey: event.hitKey ?? null,
    hitIndex: event.hitIndex ?? null,
    hitSkillId: event.hitSkillId ?? null,
    elementId: event.elementId ?? null,
    elementalType: event.elementalType ?? null,
    sourceSequencePath: Array.isArray(event.sourceSequencePath)
      ? [...event.sourceSequencePath]
      : null,
    rawDamage: event.rawDamage ?? 0,
    requestedHpDamage: event.requestedHpDamage ?? null,
    effectiveHpDamage: event.effectiveHpDamage ?? event.rawDamage ?? 0,
    overkill: event.overkill ?? 0,
    inBreakForHpDamage: event.inBreakForHpDamage ?? null,
    hpDamageMultiplier: event.hpDamageMultiplier ?? null,
    toughnessBefore: event.toughnessBefore ?? null,
    toughnessAfter: event.toughnessAfter ?? null,
    breakTriggered: event.breakTriggered === true,
    deathTriggered: event.deathTriggered === true,
    deathState: event.deathState ?? null,
    pairIdentity: event.pairIdentity ?? event.jointAttackPairIdentity ?? null,
    jointAttackPairIdentity: event.jointAttackPairIdentity ?? null,
    jointAttackCalculatedToughnessDamage:
      event.jointAttackCalculatedToughnessDamage ?? null,
    jointAttackAnchorFrame: event.jointAttackAnchorFrame === true,
    jointAttackKiboAnchorHit: event.jointAttackKiboAnchorHit === true,
    mappingIdentity: event.mappingIdentity ?? null,
    kiboResolutionIdentity: event.kiboResolutionIdentity ?? null,
    sourceKiboId: event.sourceKiboId ?? null,
    passiveSkillId: event.passiveSkillId ?? null,
    battleEffectDot: event.battleEffectDot === true,
    kiboPassiveDerivedDot: event.kiboPassiveDerivedDot === true,
    tuningKind: event.tuningKind ?? null,
    tuningProfileKey: event.profileKey ?? null,
    tuningMarkId: event.markId ?? null,
    tuningMarkCount: event.markCount ?? null,
    anchorHitIdentity: event.anchorHitIdentity ?? null,
    ...(Array.isArray(event.anchorHitIdentities)
      ? { anchorHitIdentities: [...event.anchorHitIdentities] }
      : {}),
    anchorRelativeFrame: event.anchorRelativeFrame ?? null,
    anchorAbsoluteFrame: event.anchorAbsoluteFrame ?? null,
    runtimeContractId: event.runtimeContractId ?? null,
    runtimeContractHash: event.runtimeContractHash ?? null,
    runtimeBindingHash: event.runtimeBindingHash ?? null,
    stateTransaction: event.stateTransaction ?? null,
    ...(Array.isArray(event.settlementOrder)
      ? { settlementOrder: [...event.settlementOrder] }
      : {}),
    settlementCursor: event.settlementCursor ?? null,
    toughnessDamage: event.toughnessDamage ?? 0,
    formula: {
      version: event.formulaVersion ?? null,
      status: formula.status ?? null,
      expression: formula.expression ?? null,
      result: formula.result ?? null,
      randomBranch: formula.randomBranch ?? null,
      verifiedResult: {
        mode: verifiedResult.mode ?? null,
        value: verifiedResult.value ?? null,
        preDefenseValue:
          verifiedResult.trace?.find(
            step => step?.name === 'world_event_conflict'
          )?.value ?? null,
        raw: verifiedResult.raw ?? null,
        preShieldRaw: verifiedResult.preShieldRaw ?? null,
        integer: verifiedResult.integer ?? null,
        expectedCritical: verifiedResult.expectedCritical ?? null,
      },
      weaknessResult: projectNumericRecord(formula.weaknessResult),
      sourceIdentity: projectSourceIdentity(formula.sourceIdentity),
    },
  };
}

function projectEffectEvent(event = {}) {
  return {
    eventId: event.eventId ?? event.id ?? null,
    actionId: event.actionId ?? null,
    timeMs: event.timeMs ?? null,
    absoluteFrame: event.absoluteFrame ?? event.frameIndex ?? null,
    runtimePhase: event.runtimePhase ?? null,
    runtimePriority: event.runtimePriority ?? null,
    runtimeSequenceIndex: event.runtimeSequenceIndex ?? null,
    sourceSequencePath: Array.isArray(event.sourceSequencePath)
      ? [...event.sourceSequencePath]
      : null,
    sameFrameVisibility: event.sameFrameVisibility ?? null,
    effectId: event.effectId ?? null,
    effectName: event.effectName ?? null,
    operation: event.operation ?? event.kind ?? null,
    ownerId: event.ownerId ?? null,
    targetKind: event.targetKind ?? null,
    targetId: event.targetId ?? null,
    previousTargetId: event.previousTargetId ?? event.before?.targetId ?? null,
    nextTargetId: event.nextTargetId ?? event.after?.targetId ?? null,
    controlledActorTransitionId: event.controlledActorTransitionId ?? null,
    stackChange: event.stackChange ?? null,
    appliedAssumptionIdentity: event.appliedAssumptionIdentity ?? null,
    appliedAssumptionVersion: event.appliedAssumptionVersion ?? null,
    appliedAssumptionHash: event.appliedAssumptionHash ?? null,
    before: projectEffectState(event.before),
    after: projectEffectState(event.after),
    modifiers: (event.modifiers ?? []).map(projectEffectModifier),
    sourceIdentity: projectSourceIdentity(event.sourceIdentity),
  };
}

function projectEffectInterval(interval = {}) {
  return {
    intervalId: interval.intervalId ?? interval.id ?? null,
    actionId: interval.actionId ?? null,
    effectId: interval.effectId ?? null,
    effectName: interval.effectName ?? null,
    ownerId: interval.ownerId ?? null,
    targetKind: interval.targetKind ?? null,
    targetId: interval.targetId ?? null,
    startMs: interval.startMs ?? null,
    endMs: interval.endMs ?? null,
    stacks: interval.stacks ?? interval.stackCount ?? null,
    status: interval.status ?? null,
    sourceIdentity: projectSourceIdentity(interval.sourceIdentity),
  };
}

function projectEffectState(state = null) {
  if (!state || typeof state !== 'object') return state;
  return {
    targetId: state.targetId ?? null,
    stacks: state.stacks ?? null,
    expiresAtMs: state.expiresAtMs ?? null,
    inheritType: state.inheritType ?? null,
    formulaSourceActorId: state.formulaSourceActorId ?? null,
    effectAdderActorId: state.effectAdderActorId ?? null,
    effectInstanceId: state.effectInstanceId ?? null,
    appliedAssumptionIdentity: state.appliedAssumptionIdentity ?? null,
    appliedAssumptionVersion: state.appliedAssumptionVersion ?? null,
    appliedAssumptionHash: state.appliedAssumptionHash ?? null,
  };
}

function projectEffectModifier(modifier = {}) {
  return {
    kind: modifier.kind ?? null,
    attributeId: modifier.attributeId ?? null,
    bucket: modifier.bucket ?? null,
    valueRaw: modifier.valueRaw ?? null,
    formulaFamily: modifier.formulaResult?.family ?? null,
    formulaValue: modifier.formulaResult?.value ?? null,
  };
}

function projectTuningMarkEvent(event = {}) {
  return {
    eventIdentity: event.eventIdentity ?? event.id ?? null,
    actionId: event.actionId ?? null,
    timeMs: event.timeMs ?? null,
    frameIndex: event.frameIndex ?? null,
    kind: event.kind ?? null,
    profileKey: event.profileKey ?? null,
    markId: event.markId ?? null,
    before: event.before ?? null,
    delta: event.delta ?? null,
    after: event.after ?? null,
    maximum: event.maximum ?? null,
    sourceSequencePath: event.sourceSequencePath ?? null,
    sourceIdentity: projectSourceIdentity(event.sourceIdentity),
  };
}

function projectTuningAcquisitionGate(result = {}) {
  return {
    actionId: result.actionId ?? null,
    effectIdentity: result.effectIdentity ?? null,
    timeMs: result.timeMs ?? null,
    gateKind: result.gate?.kind ?? null,
    groupIdentity: result.gate?.groupIdentity ?? null,
    hitIndex: result.gate?.hitIndex ?? null,
    hitIdentities: [...(result.hitIdentities ?? [])],
    candidateCount: result.candidateCount ?? null,
    landedCount: result.landedCount ?? null,
    passed: result.passed === true,
    sourceIdentity: projectSourceIdentity(result.sourceIdentity),
  };
}

function projectTuningConditionalHitGroup(result = {}) {
  return {
    actionId: result.actionId ?? null,
    actorId: result.actorId ?? null,
    groupIdentity: result.groupIdentity ?? null,
    timeMs: result.timeMs ?? null,
    hitIndex: result.hitIndex ?? null,
    sourceKind: result.sourceKind ?? null,
    sourceHitIdentity: result.sourceHitIdentity ?? null,
    markId: result.markId ?? null,
    markCountAtJudgment: result.markCountAtJudgment ?? null,
    minimumStacks: result.minimumStacks ?? null,
    selectedBranch: result.selectedBranch ?? null,
    selectedElementId: result.selectedElementId ?? null,
    landed: result.landed === true,
    applied: result.applied === true,
    companionUnitId: result.companionUnitId ?? null,
    ownership: result.ownership ?? null,
    status: result.status ?? null,
    sourceIdentity: projectSourceIdentity(result.sourceIdentity),
  };
}

function projectTuningConsumeJudgment(result = {}) {
  return {
    eventIdentity: result.eventIdentity ?? null,
    actionId: result.actionId ?? null,
    actorId: result.actorId ?? null,
    timeMs: result.timeMs ?? null,
    absoluteFrame: result.absoluteFrame ?? null,
    controlSkillId: result.controlSkillId ?? null,
    subSkillIndex: result.subSkillIndex ?? null,
    effectIdentity: result.effectIdentity ?? null,
    judgmentGroupIdentity: result.judgmentGroupIdentity ?? null,
    judgmentElementId: result.judgmentElementId ?? null,
    judgmentPathId: result.judgmentPathId ?? null,
    triggerFrame: result.triggerFrame ?? null,
    behaviorPathId: result.behaviorPathId ?? null,
    markId: result.markId ?? null,
    markCountAtJudgment: result.markCountAtJudgment ?? null,
    minimumStacks: result.minimumStacks ?? null,
    maximumStacks: result.maximumStacks ?? null,
    consumedCount: result.consumedCount ?? 0,
    selectedPriorityCandidate: result.selectedPriorityCandidate ?? null,
    candidateStates: structuredClone(result.candidateStates ?? []),
    executed: result.executed === true,
    applied: result.applied === true,
    status: result.status ?? null,
    sourceIdentity: projectSourceIdentity(result.sourceIdentity),
  };
}

function projectCompanionAttack(transaction = {}) {
  return {
    transactionIdentity: transaction.transactionIdentity ?? null,
    actionId: transaction.actionId ?? null,
    actorId: transaction.actorId ?? null,
    ownerId: transaction.ownerId ?? null,
    timeMs: transaction.timeMs ?? null,
    attackKind: transaction.attackKind ?? null,
    attackIdentity: transaction.attackProfile?.attackIdentity ?? null,
    companionIdentity: transaction.companionIdentity ?? null,
    companionUnitId: transaction.companionUnitId ?? null,
    companionRevision: transaction.companionRevision ?? null,
    hitIndex: transaction.hitIndex ?? null,
    targetKind: transaction.targetKind ?? null,
    ownership: transaction.ownership ?? null,
    status: transaction.status ?? null,
    applied: transaction.applied === true,
    sourceIdentity: projectSourceIdentity(transaction.sourceIdentity),
  };
}

function projectKiboPassiveRuntimeState(state = {}) {
  return {
    stateIdentity: state.stateIdentity ?? null,
    passiveKey: state.passiveKey ?? null,
    actorId: state.actorId ?? null,
    slotId: state.slotId ?? null,
    kiboId: state.kiboId ?? null,
    skillId: state.skillId ?? null,
    internalCooldownMs: state.internalCooldownMs ?? 0,
    lastTriggerAtMs: state.lastTriggerAtMs ?? null,
    cooldownReadyAtMs: state.cooldownReadyAtMs ?? null,
    triggerCount: state.triggerCount ?? 0,
    configuredTriggerCounter: state.configuredTriggerCounter ?? null,
    triggerLifetime: state.triggerLifetime ?? null,
    triggerLifetimeBasis: state.triggerLifetimeBasis ?? null,
    maxTriggerCount: state.maxTriggerCount ?? null,
    remainingTriggerCount: state.remainingTriggerCount ?? null,
    triggerLimitScope: state.triggerLimitScope ?? null,
    sourceIdentity: projectSourceIdentity(state.sourceIdentity),
  };
}

function projectConditionalHitGroup(result = {}) {
  return {
    actionId: result.actionId ?? null,
    groupIdentity: result.groupIdentity ?? null,
    timeMs: result.timeMs ?? null,
    stateIdentity: result.stateIdentity ?? null,
    beforeStacks: result.beforeStacks ?? null,
    consumedStacks: result.consumedStacks ?? null,
    afterStacks: result.afterStacks ?? null,
    status: result.status ?? null,
    applied: result.applied === true,
  };
}

function projectControlledActorTimeline(timeline = {}) {
  return {
    status: timeline.status ?? null,
    initialActorId: timeline.initialActor?.actorId ?? null,
    transitions: (timeline.transitions ?? []).map(transition => ({
      id: transition.id ?? transition.transitionId ?? null,
      actionId: transition.actionId ?? null,
      timeMs: transition.timeMs ?? null,
      beforeActorId: transition.beforeActor?.actorId ?? null,
      afterActorId: transition.afterActor?.actorId ?? null,
      status: transition.status ?? null,
      applied: transition.applied === true,
    })),
    segments: (timeline.segments ?? []).map(segment => ({
      actorId: segment.actorId ?? null,
      startMs: segment.startMs ?? null,
      endMs: segment.endMs ?? null,
    })),
    summary: timeline.summary ?? null,
  };
}

function projectVariantSelections(value) {
  const entries = value instanceof Map ? [...value.entries()] : [];
  return entries.map(([actionId, selection]) => ({
    actionId,
    ownerId: selection?.ownerId ?? null,
    semanticName: selection?.semanticName ?? null,
    controlSkillId:
      selection?.executionControlSkillId ?? selection?.controlSkillId ?? null,
    subSkillIndex: selection?.selectedSubSkillIndex ?? null,
    actualDurationFrames: selection?.actualDurationFrames ?? null,
    edgeIdentity: selection?.edgeIdentity ?? null,
    contextActionId: selection?.contextActionId ?? null,
    ...(selection?.attackGroupId == null
      ? {}
      : {
          attackGroupId: selection.attackGroupId,
          attackInputChainIdentity: selection.attackInputChainIdentity ?? null,
          attackSequenceIndex:
            selection.attackChainSequenceIndex ??
            selection.attackSequenceIndex ??
            null,
          attackSequenceTotal: selection.attackSequenceTotal ?? null,
          attackInputIdentity: selection.attackInputIdentity ?? null,
          attackInputAnimationDurationFrames:
            selection.attackInputAnimationDurationFrames ??
            selection.animationDurationFrames ??
            null,
          attackInputDurationBasis: selection.attackInputDurationBasis ?? null,
          attackInputLinkTimingStatus:
            selection.attackInputLinkTimingStatus ?? null,
          attackInputLinkWindow: selection.attackInputLinkWindow
            ? {
                kind: selection.attackInputLinkWindow.kind ?? null,
                startFrame: selection.attackInputLinkWindow.startFrame ?? null,
                endFrame: selection.attackInputLinkWindow.endFrame ?? null,
                targetControlSkillId:
                  selection.attackInputLinkWindow.targetControlSkillId ?? null,
                targetSubSkillIndex:
                  selection.attackInputLinkWindow.targetSubSkillIndex ?? null,
                allowAttack:
                  selection.attackInputLinkWindow.allowAttack ?? null,
                sourceIdentity:
                  selection.attackInputLinkWindow.sourceIdentity ?? null,
              }
            : null,
        }),
    contextualInputScheduling: selection?.contextualInputScheduling
      ? {
          status: selection.contextualInputScheduling.status ?? null,
          applied: selection.contextualInputScheduling.applied === true,
          resolutionKind:
            selection.contextualInputScheduling.resolutionKind ?? null,
          inputSemantics:
            selection.contextualInputScheduling.inputSemantics ?? null,
          inputFrame: selection.contextualInputScheduling.inputFrame ?? null,
          inputOffsetFrame:
            selection.contextualInputScheduling.inputOffsetFrame ?? null,
          executionStartFrame:
            selection.contextualInputScheduling.executionStartFrame ?? null,
          predecessorEffectiveEndFrame:
            selection.contextualInputScheduling.predecessorEffectiveEndFrame ??
            null,
          inputWindow: selection.contextualInputScheduling.inputWindow
            ? {
                startFrame:
                  selection.contextualInputScheduling.inputWindow.startFrame ??
                  null,
                endFrame:
                  selection.contextualInputScheduling.inputWindow.endFrame ??
                  null,
                interval:
                  selection.contextualInputScheduling.inputWindow.interval ??
                  null,
              }
            : null,
        }
      : null,
    chargingRelease: selection?.chargingRelease ?? null,
    appliedAssumptionIdentity: selection?.appliedAssumptionIdentity ?? null,
    appliedAssumptionVersion: selection?.appliedAssumptionVersion ?? null,
    appliedAssumptionHash: selection?.appliedAssumptionHash ?? null,
    sourceKind: selection?.sourceKind ?? null,
    sourceIdentity: projectSourceIdentity(selection?.sourceIdentity),
  }));
}

function projectAttackChainContinuityWindows(value) {
  return (value ?? [])
    .filter(
      window =>
        window?.relationType === 'attack-chain-continuity-window' &&
        window.applied === true
    )
    .map(window => ({
      edgeIdentity: window.edgeIdentity ?? null,
      actorId: window.actorId ?? null,
      ownerId: window.ownerId ?? null,
      sourceActionId: window.sourceActionId ?? null,
      sourceControlSkillId: window.sourceControlSkillId ?? null,
      sourceSubSkillIndex: window.sourceSubSkillIndex ?? null,
      targetControlSkillId: window.targetControlSkillId ?? null,
      targetSubSkillIndex: window.targetSubSkillIndex ?? null,
      targetChainIdentity: window.targetChainIdentity ?? null,
      targetSequenceIndex: window.targetSequenceIndex ?? null,
      startsAtMs: window.startsAtMs ?? null,
      endsAtMs: window.endsAtMs ?? null,
      inputWindow: window.inputWindow
        ? {
            startFrame: window.inputWindow.startFrame ?? null,
            endFrame: window.inputWindow.endFrame ?? null,
            durationFrames: window.inputWindow.durationFrames ?? null,
          }
        : null,
      inputCommand: window.inputCommand ?? null,
      sourceIdentity: window.sourceIdentity ?? null,
      status: window.status ?? null,
      applied: true,
    }))
    .sort(
      (left, right) =>
        Number(left.startsAtMs ?? 0) - Number(right.startsAtMs ?? 0) ||
        String(left.edgeIdentity).localeCompare(
          String(right.edgeIdentity),
          'en'
        )
    );
}

function projectNormalAttackSpecialContinuationCandidates(value) {
  return (value ?? [])
    .filter(candidate => candidate?.applied === true)
    .map(candidate => ({
      actorId: candidate.actorId ?? null,
      sourceKind: candidate.sourceKind ?? null,
      sourceActionId: candidate.sourceActionId ?? null,
      targetActionId: candidate.targetActionId ?? null,
      sourceIdentity: candidate.sourceIdentity ?? null,
      chainIdentity: candidate.chainIdentity ?? null,
      sequenceIndex: candidate.sequenceIndex ?? null,
      controlSkillId: candidate.controlSkillId ?? null,
      subSkillIndex: candidate.subSkillIndex ?? null,
      groupId: candidate.groupId ?? null,
      startsAtMs: candidate.startsAtMs ?? null,
      endsAtMs: candidate.endsAtMs ?? null,
      applied: true,
    }))
    .sort(
      (left, right) =>
        Number(left.startsAtMs ?? 0) - Number(right.startsAtMs ?? 0) ||
        String(left.sourceActionId).localeCompare(
          String(right.sourceActionId),
          'en'
        ) ||
        String(left.targetActionId).localeCompare(
          String(right.targetActionId),
          'en'
        )
    );
}

function projectDiagnostics(simulation) {
  const rules = simulation.actionRuleDiagnostics ?? {};
  return {
    validationWarnings: (simulation.diagnostics?.validationWarnings ?? []).map(
      warning => ({
        code: warning.code ?? null,
        message: warning.message ?? null,
        actionId: warning.actionId ?? null,
      })
    ),
    actionRules: {
      status: rules.status ?? null,
      diagnostics: (rules.diagnostics ?? []).map(diagnostic => {
        const runtimeBlock = diagnostic.runtimeBlock ?? {};
        return {
          id: diagnostic.id ?? null,
          code: diagnostic.code ?? null,
          status: diagnostic.status ?? null,
          severity: diagnostic.severity ?? null,
          actionId: diagnostic.actionId ?? null,
          actionIds: diagnostic.actionIds ?? [],
          actorId: diagnostic.actorId ?? null,
          controlledActorId: diagnostic.controlledActorId ?? null,
          blockingActionId: diagnostic.blockingActionId ?? null,
          pairedActionId: diagnostic.pairedActionId ?? null,
          targetId: diagnostic.targetId ?? null,
          pairIdentity: diagnostic.pairIdentity ?? null,
          mappingIdentity: diagnostic.mappingIdentity ?? null,
          runtimeBindingHash: diagnostic.runtimeBindingHash ?? null,
          sourceKind:
            diagnostic.sourceKind ??
            diagnostic.source?.sourceKind ??
            runtimeBlock.sourceKind ??
            null,
          sourceIdentity:
            diagnostic.sourceIdentity ??
            diagnostic.source?.sourceIdentity ??
            runtimeBlock.sourceIdentity ??
            null,
          sourceSequencePath:
            diagnostic.sourceSequencePath ??
            runtimeBlock.sourceSequencePath ??
            null,
          reason:
            diagnostic.reason ??
            runtimeBlock.reason ??
            diagnostic.source?.sourceStatus ??
            null,
          reasons: diagnostic.reasons ?? runtimeBlock.reasons ?? [],
          formIdentity:
            diagnostic.formIdentity ?? runtimeBlock.formIdentity ?? null,
          attackInputChainIdentity:
            diagnostic.attackInputChainIdentity ??
            runtimeBlock.attackInputChainIdentity ??
            null,
          expectedAttackInput:
            diagnostic.expectedAttackInput ??
            runtimeBlock.expectedAttackInput ??
            null,
          actualAttackInput:
            diagnostic.actualAttackInput ??
            runtimeBlock.actualAttackInput ??
            null,
          timeMs: diagnostic.timeMs ?? null,
          message: diagnostic.message ?? null,
        };
      }),
      summary: rules.summary ?? null,
    },
  };
}

function projectSourceIdentity(value) {
  if (value == null || typeof value !== 'object') return value ?? null;
  const result = {
    identity: value.identity ?? value.sourceIdentity ?? null,
    sourceKind: value.sourceKind ?? null,
    sourcePath: value.sourcePath ?? value.path ?? null,
    elementId: value.elementId ?? null,
    pathId: value.pathId ?? null,
    packageId: value.packageId ?? null,
    packageHash: value.packageHash ?? null,
  };
  for (const key of [
    'catalogKind',
    'actionBindingIdentity',
    'effectIdentity',
    'triggerEvent',
    'kiboId',
    'passiveSkillId',
    'triggerElementId',
    'triggerPathId',
    'effectElementId',
    'effectPathId',
    'directInjectTargetType',
    'directInjectTargetName',
    'sourceSlotId',
    'sourcePosition',
    'projectedFromContainer',
    'projectionScope',
    'teamElementTag',
    'teamElementTagName',
    'finalTargetKind',
    'finalTargetId',
    'finalTargetActorId',
    'finalTargetKiboId',
    'sourceSelectionPolicy',
    'sourceAttributionStatus',
  ]) {
    if (value[key] !== undefined) result[key] = value[key];
  }
  if (Array.isArray(value.provenance)) {
    result.provenance = [...value.provenance];
  }
  if (Array.isArray(value.contributingSources)) {
    result.contributingSources = value.contributingSources.map(source => ({
      ...source,
    }));
  }
  return result;
}

function projectNumericRecord(value) {
  if (!value || typeof value !== 'object') return value ?? null;
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, entry]) =>
        entry == null ||
        typeof entry === 'number' ||
        typeof entry === 'string' ||
        typeof entry === 'boolean'
    )
  );
}

export function createCanonicalCombatEvaluation(simulation) {
  const byAction = new Map();
  const byActor = new Map();
  const totals = createEmptyCombatContribution('totals');
  for (const event of simulation.damageTimeline ?? []) {
    const actionId = String(event.actionId ?? 'unattributed');
    const actorId = String(event.actorId ?? 'unattributed');
    accumulateContribution(byAction, actionId, event);
    accumulateContribution(byActor, actorId, event);
    accumulateContributionValue(totals, event);
  }
  return canonicalizeValue({
    schemaVersion: CANONICAL_HEADLESS_COMBAT_CORE_SCHEMA_VERSION,
    kind: 'azpr-canonical-combat-evaluation',
    durationMs: simulation.scenario?.durationMs ?? 0,
    totals: {
      hpDamage: totals.hpDamage,
      toughnessDamage: totals.inflictedToughnessDamage,
      combatHitCount: totals.combatHitCount,
      stateEventCount: totals.stateEventCount,
      inflictedToughnessDamage: totals.inflictedToughnessDamage,
      recoveredToughness: totals.recoveredToughness,
      netToughnessDamage:
        totals.inflictedToughnessDamage - totals.recoveredToughness,
      selfEnergyDelta: simulation.summary?.totalSelfEnergyDelta ?? 0,
      projectedHitCount: totals.combatHitCount,
      executedActionCount: simulation.summary?.executedActionCount ?? 0,
      skippedActionCount: simulation.summary?.skippedActionCount ?? 0,
    },
    byAction: [...byAction.values()],
    byActor: [...byActor.values()],
  });
}

export function createCanonicalCombatExplanation(run, selector = {}) {
  const actionId = normalizeText(selector.actionId);
  const hitIdentity = normalizeText(selector.hitIdentity);
  const effectId = normalizeText(selector.effectId);
  const frame = finiteNumberOrNull(selector.frame);
  const frameRate = Number(run.compilation.scenario.time?.fps) || 60;
  const frameTimeMs = frame == null ? null : (frame * 1000) / frameRate;
  const matches = value => {
    if (actionId && String(value?.actionId ?? value?.id ?? '') !== actionId) {
      return false;
    }
    if (
      hitIdentity &&
      ![
        value?.hitIdentity,
        value?.hitKey,
        value?.payload?.hitIdentity,
        value?.payload?.hitKey,
        value?.formula?.randomBranch?.hitIdentity,
      ]
        .map(normalizeText)
        .includes(hitIdentity)
    ) {
      return false;
    }
    if (
      effectId &&
      ![value?.effectId, value?.payload?.effectId, value?.stateIdentity]
        .map(normalizeText)
        .includes(effectId)
    ) {
      return false;
    }
    if (
      frameTimeMs != null &&
      Math.abs(Number(value?.timeMs ?? value?.startMs ?? -1) - frameTimeMs) >
        0.001
    ) {
      return false;
    }
    return true;
  };
  const effects = run.trace.effects?.intervals ?? [];
  return canonicalizeValue({
    schemaVersion: CANONICAL_HEADLESS_COMBAT_CORE_SCHEMA_VERSION,
    kind: 'azpr-canonical-combat-explanation',
    selector: { actionId, hitIdentity, effectId, frame },
    inputHash: run.inputHash,
    traceHash: run.traceHash,
    actions: run.trace.actions.filter(
      action => !actionId || String(action.id ?? '') === actionId
    ),
    events: run.trace.events.filter(event => matches(event)),
    damage: run.trace.damage.filter(event => matches(event)),
    actorResources: run.trace.resources.actors.filter(event => matches(event)),
    kiboResources: run.trace.resources.kibos.filter(event => matches(event)),
    effects: effects.filter(effect => matches(effect)),
    summary: run.trace.summary,
  });
}

function normalizeCoreInput(input) {
  const project = input?.project ?? input;
  if (!project || typeof project !== 'object' || Array.isArray(project)) {
    throw new CanonicalHeadlessCombatValidationError([
      {
        code: 'headless-project-required',
        field: 'project',
        message: 'A project is required',
      },
    ]);
  }
  const critical = normalizeCombatCriticalScenario(
    resolveCoreCriticalInput(input)
  );
  return {
    schemaVersion:
      Number(input?.schemaVersion) ||
      CANONICAL_HEADLESS_COMBAT_CORE_SCHEMA_VERSION,
    kind: CANONICAL_HEADLESS_COMBAT_INPUT_KIND,
    project: {
      ...project,
      combatScenario: {
        ...(project.combatScenario ?? {}),
        critical,
      },
    },
  };
}

function createCanonicalProjectInput(project) {
  const metadata = { ...(project?.metadata ?? {}) };
  delete metadata.createdAt;
  delete metadata.updatedAt;
  delete metadata.transport;
  return {
    ...project,
    actions: (project?.actions ?? []).map(createCanonicalActionInput),
    metadata,
  };
}

function createCanonicalActionInput(action) {
  const value = { ...action };
  delete value.startFrame;
  delete value.endFrame;
  delete value.durationFrames;
  if (value.timing && typeof value.timing === 'object') {
    value.timing = { ...value.timing };
    delete value.timing.animationTimeMs;
  }
  return value;
}

function resolveCoreCriticalInput(input) {
  const project = input?.project ?? input;
  const override = input?.critical ?? input?.criticalPolicy;
  if (typeof override === 'string') return { policy: override };
  return override ?? project?.combatScenario?.critical ?? null;
}

function createCatalogProjection(gameData) {
  return canonicalizeValue({
    characters: (gameData.characters ?? []).map(character => ({
      id: character.id,
      name: character.name ?? character.displayName ?? null,
      elementId: character.elementId ?? null,
    })),
    skills: (gameData.skills ?? []).map(skill => ({
      id: skill.id,
      characterId: skill.characterId ?? null,
      name: skill.displayName ?? skill.name ?? null,
      actionKind: skill.actionKind ?? null,
      cooldownMs: skill.cooldownMs ?? null,
      spCost: skill.spCost ?? null,
    })),
    enemies: (gameData.enemies ?? []).map(enemy => ({
      id: enemy.id,
      name: enemy.name ?? enemy.displayName ?? null,
      level: enemy.level ?? null,
    })),
    elements: (gameData.elements ?? []).map(element => ({
      id: element.id,
      name: element.name ?? element.displayName ?? null,
    })),
    summary: {
      characterCount: gameData.characters?.length ?? 0,
      skillCount: gameData.skills?.length ?? 0,
      enemyCount: gameData.enemies?.length ?? 0,
      elementCount: gameData.elements?.length ?? 0,
    },
  });
}

function createDataIdentity({ scenario, gameData }) {
  const mechanicsPackage = getInstalledVerifiedCombatMechanicsPackage();
  const scenarioOwnerIds = new Set(
    (scenario.actors ?? []).map(actor => Number(actor.characterId))
  );
  const headlessAssumptionContracts = (
    mechanicsPackage?.actionVariantGraph?.headlessAssumptionContracts ?? []
  )
    .filter(contract => scenarioOwnerIds.has(Number(contract.ownerId)))
    .map(projectHeadlessAssumptionContractIdentity);
  return canonicalizeValue({
    verifiedMechanicsPackageId: mechanicsPackage?.packageId ?? null,
    verifiedMechanicsPackageHash: mechanicsPackage?.packageHash ?? null,
    mechanicsProfileId: scenario.mechanicsProfile?.profileId ?? null,
    mechanicsProfileVersion: scenario.mechanicsProfile?.profileVersion ?? null,
    mechanicsCatalogId: scenario.mechanicsProfileCatalog?.catalogId ?? null,
    mechanicsCatalogVersion:
      scenario.mechanicsProfileCatalog?.catalogVersion ?? null,
    optimizationScenarioPolicy:
      scenario.combatScenario?.optimizationScenarioPolicy ?? null,
    objectiveContract: scenario.combatScenario?.objectiveContract ?? null,
    normalAttackInputAuthority:
      getVerifiedNormalAttackInputAuthorityDescriptor(),
    jointAttackRuntime: scenario.combatScenario?.jointAttackRuntime ?? null,
    kiboAutoCastDerivationAuthority: projectKiboAutoCastDerivationRegistry(
      scenario.kiboAutoCastDerivationRegistry
    ),
    switchTriggerGenerationAuthority: projectSwitchTriggerGenerationAuthority(
      scenario.switchTriggerGeneration
    ),
    switchExitTailPolicies: (scenario.actions ?? [])
      .filter(action => action.switchExitTailPolicy != null)
      .map(action =>
        projectVerifiedSwitchExitTailPolicy(action.switchExitTailPolicy)
      ),
    headlessAssumptionContracts,
    enemyProfile: projectEnemyProfileIdentity(scenario.enemy?.profile),
    gameDataReferenceIdentity:
      scenario.gameDataCatalog?.referenceIdentity ?? null,
    gameDataSummary: {
      characterCount: gameData.characters?.length ?? 0,
      skillCount: gameData.skills?.length ?? 0,
      enemyCount: gameData.enemies?.length ?? 0,
      elementCount: gameData.elements?.length ?? 0,
    },
  });
}

function projectSwitchTriggerGenerationAuthority(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    schemaVersion: value.schemaVersion ?? null,
    contractName: value.contractName ?? null,
    sourceKind: value.sourceKind ?? null,
    status: value.status ?? null,
    generationHash: value.generationHash ?? null,
    mechanicsPackage: value.mechanicsPackage ?? null,
    summary: value.summary ?? null,
  };
}

function projectHeadlessAssumptionContractIdentity(contract) {
  return {
    ownerId: Number(contract.ownerId),
    contractIdentity: contract.contractIdentity,
    policyAuthority: contract.policyAuthority,
    clientParityReady: contract.clientParityReady === true,
    assumptionVersion: contract.assumptionVersion,
    assumptionHash: contract.assumptionHash,
    assumptionIdentities: (contract.assumptions ?? []).map(
      assumption => assumption.identity
    ),
    settlementContract: contract.settlementContract ?? null,
    futureClientEvidencePolicy: contract.futureClientEvidencePolicy,
    status: contract.status,
  };
}

function projectEnemyProfileIdentity(profile) {
  if (!profile || typeof profile !== 'object') return null;
  return {
    schemaVersion: profile.schemaVersion ?? null,
    contractName: profile.contractName ?? null,
    profileId: profile.profileId ?? null,
    profileHash: profile.profileHash ?? null,
    enemyId: profile.enemyId ?? null,
    level: profile.level ?? null,
    sourceStatus: profile.source?.status ?? null,
    sourceIdentity: profile.source?.identity ?? null,
    sourceHash: profile.source?.hash ?? null,
  };
}

function accumulateContribution(target, identity, event) {
  const current =
    target.get(identity) ?? createEmptyCombatContribution(identity);
  accumulateContributionValue(current, event);
  target.set(identity, current);
}

function createEmptyCombatContribution(identity) {
  return {
    identity,
    hpDamage: 0,
    toughnessDamage: 0,
    hitCount: 0,
    combatHitCount: 0,
    stateEventCount: 0,
    inflictedToughnessDamage: 0,
    recoveredToughness: 0,
    netToughnessDamage: 0,
  };
}

function accumulateContributionValue(current, event) {
  const toughnessDamage = Number(event.toughnessDamage) || 0;
  if (event.stateEventKind) {
    current.stateEventCount += 1;
    if (event.stateEventKind === 'joint-attack-attached-toughness-clear') {
      current.inflictedToughnessDamage += Math.max(0, toughnessDamage);
    } else {
      current.recoveredToughness += Math.max(0, -toughnessDamage);
    }
  } else {
    current.hpDamage += Number(event.rawDamage) || 0;
    current.combatHitCount += 1;
    current.hitCount += 1;
    current.inflictedToughnessDamage += Math.max(0, toughnessDamage);
  }
  current.toughnessDamage = current.inflictedToughnessDamage;
  current.netToughnessDamage =
    current.inflictedToughnessDamage - current.recoveredToughness;
}

function normalizeValidationIssues(error) {
  if (
    error instanceof CompileProjectError ||
    error instanceof CanonicalHeadlessCombatValidationError
  ) {
    return canonicalizeValue(error.issues ?? []);
  }
  return [
    {
      code: 'headless-combat-unexpected-error',
      message: String(error?.message ?? error),
    },
  ];
}

function assertScenarioDerivationAuthority(scenario) {
  const issues = [];
  if (
    scenario?.kiboAutoCastDerivationRegistry != null &&
    !isAuthoritativeKiboAutoCastDerivationRegistry(
      scenario.kiboAutoCastDerivationRegistry
    )
  ) {
    issues.push({
      code: 'canonical-kibo-auto-cast-registry-not-authoritative',
      path: 'scenario.kiboAutoCastDerivationRegistry',
      message:
        'Kibo background authority must be materialized by this compilation scheduler',
    });
  }
  if (
    scenario?.switchTriggerGeneration != null &&
    !isAuthoritativeSwitchTriggerGeneration(scenario.switchTriggerGeneration)
  ) {
    issues.push({
      code: 'canonical-switch-trigger-generation-not-authoritative',
      path: 'scenario.switchTriggerGeneration',
      message:
        'Switch-derived authority must be materialized by the canonical compiler',
    });
  }
  if (issues.length > 0) {
    throw new CanonicalHeadlessCombatValidationError(issues);
  }
}

function isCompilation(value) {
  return value?.kind === CANONICAL_HEADLESS_COMBAT_COMPILATION_KIND;
}

function isRun(value) {
  return value?.kind === CANONICAL_HEADLESS_COMBAT_RUN_KIND;
}

function isSimulationResult(value) {
  return value?.runtimeOutputs != null && value?.actionExecutionPlan != null;
}

function assertGameData(gameData) {
  if (!gameData || typeof gameData !== 'object') {
    throw new TypeError('Canonical headless combat core requires gameData');
  }
}

function normalizeText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function finiteNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
