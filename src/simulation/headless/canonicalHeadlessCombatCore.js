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
    if (isCompilation(input)) return input;
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
    const dataIdentity = createDataIdentity({ scenario, gameData });
    const inputProjection = canonicalizeValue({
      schemaVersion: normalizedInput.schemaVersion,
      project: createCanonicalProjectInput(normalizedInput.project),
      critical: scenario.combatScenario?.critical ?? null,
      dataIdentity,
    });
    return {
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
      actorIds: (effectiveScenario.actors ?? []).map(actor => actor.id),
    },
    critical: effectiveScenario.combatScenario?.critical ?? null,
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
    },
    state: {
      initial: verifiedRuntime.initialState ?? null,
      final: verifiedRuntime.finalState ?? null,
      targetEvents: (targetStateRuntime.events ?? []).map(projectRuntimeEvent),
      conditionalHitGroups: (targetStateRuntime.groupResults ?? []).map(
        projectConditionalHitGroup
      ),
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
      stateEvents: (
        simulation.verifiedActionVariantRuntime?.stateEvents ?? []
      ).map(projectRuntimeEvent),
      resourceEvents: (
        simulation.verifiedActionVariantRuntime?.resourceEvents ?? []
      ).map(projectRuntimeEvent),
    },
    summary: simulation.summary,
    diagnostics: projectDiagnostics(simulation),
  };
  return canonicalizeValue(trace);
}

function projectTraceAction(action) {
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
    hitOverrides: action.hitOverrides ?? {},
  };
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
    })),
    cooldownWindows: (timeline.cooldownWindows ?? []).map(cooldownWindow => ({
      actionId: cooldownWindow.actionId,
      ownerId: cooldownWindow.ownerId ?? null,
      skillId: cooldownWindow.skillId ?? null,
      startMs: cooldownWindow.startMs,
      endMs: cooldownWindow.endMs,
      status: cooldownWindow.status ?? null,
    })),
    summary: timeline.summary ?? null,
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
    hitIdentity: formula.randomBranch?.hitIdentity ?? null,
    hitKey: event.hitKey ?? null,
    hitIndex: event.hitIndex ?? null,
    hitSkillId: event.hitSkillId ?? null,
    elementId: event.elementId ?? null,
    rawDamage: event.rawDamage ?? 0,
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
    sourceIdentity: projectSourceIdentity(event.sourceIdentity),
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
    sourceKind: selection?.sourceKind ?? null,
    sourceIdentity: projectSourceIdentity(selection?.sourceIdentity),
  }));
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
      diagnostics: (rules.diagnostics ?? []).map(diagnostic => ({
        id: diagnostic.id ?? null,
        code: diagnostic.code ?? null,
        status: diagnostic.status ?? null,
        severity: diagnostic.severity ?? null,
        actionId: diagnostic.actionId ?? null,
        actionIds: diagnostic.actionIds ?? [],
        timeMs: diagnostic.timeMs ?? null,
        message: diagnostic.message ?? null,
      })),
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
  return canonicalizeValue({
    verifiedMechanicsPackageId: mechanicsPackage?.packageId ?? null,
    verifiedMechanicsPackageHash: mechanicsPackage?.packageHash ?? null,
    mechanicsProfileId: scenario.mechanicsProfile?.profileId ?? null,
    mechanicsProfileVersion: scenario.mechanicsProfile?.profileVersion ?? null,
    mechanicsCatalogId: scenario.mechanicsProfileCatalog?.catalogId ?? null,
    mechanicsCatalogVersion:
      scenario.mechanicsProfileCatalog?.catalogVersion ?? null,
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

function accumulateContribution(target, identity, event) {
  const current = target.get(identity) ?? createEmptyCombatContribution(identity);
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
    current.recoveredToughness += Math.max(0, -toughnessDamage);
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
