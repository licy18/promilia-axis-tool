import {
  ACTION_TYPES,
  applyResolvedEnemyProfileToInstance,
} from '../domain/projectSchema';
import { attachActionSourceSequence } from '../domain/actionSourceSequence';
import {
  DEFAULT_WORKBENCH_TEAM_SLOTS,
  createWorkbenchActionDraft,
  createWorkbenchProject,
  getSkillsForCharacter,
  getWorkbenchGameData,
  getWorkbenchLoadoutOptions,
} from '../domain/workbenchProjectFactory';
import { getSkillActionCatalog } from '../domain/skillActionCatalog';
import { frameToMs, msToFrame } from '../domain/timebase';
import { resolveWorkbenchActionScheduling } from '../domain/workbenchActionScheduling';
import generatedCharacters from '../data/generated/characters.json';
import generatedWorkbenchKiboActionCatalog from '../data/generated/workbench-kibo-action-catalog.json';
import {
  getInstalledVerifiedCombatMechanicsPackage,
  getVerifiedCombatActionMapping,
} from '../data/verifiedCombatMechanicsPackage';
import { projectWorkbenchKiboActionCatalog } from '../data/workbenchKiboActionCatalog';
import {
  createOptimizationQualificationIssuesForContract,
  getOptimizationQualificationCatalog,
  projectResolvedOptimizationCultivationActor,
  resolveOptimizationCultivationProfile,
  resolveStarGiftSkillLevelBonusesBySkillId,
} from '../optimization-qualification/optimizationQualificationProtocol';
import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization';
import {
  classifyOptimizationCandidateCharacter,
  classifyOptimizationScenarioActionKind,
  getOptimizationCandidateRosterPolicy,
  getOptimizationScenarioPolicy,
  isOptimizationScenarioActionKindInScope,
} from '../optimization-scenario/optimizationScenarioPolicy';
import { DEFAULT_HEADLESS_COMBAT_CORE } from '../simulation/headless/defaultHeadlessCombatCore';
import { projectScenarioEffectiveActionTimeline } from '../simulation/mechanics/actionEffectiveTimeline';
import { createVerifiedActionVariantRuntime } from '../simulation/mechanics/verifiedActionVariantRuntime';
import { createMachineAxisBatchEvaluator } from './machineAxisBatchEvaluator';
import { createMachineAxisCycleEvaluator } from './machineAxisCycleEvaluator';
import { createMachineAxisKillEvaluator } from './machineAxisKillEvaluator';
import {
  createMachineAxisSearchEngine,
  normalizeSearchOptions,
  selectTopN,
} from './machineAxisSearchEngine';
import { createMachineAxisSearchReport } from './machineAxisSearchReport';
import { createMachineAxisEnemyProfileFromCompiledEnemy } from './machineAxisEnemyProfileContract';
import {
  createMachineAxisObjectiveContract,
  validateMachineAxisObjectiveContract,
} from './machineAxisObjectiveContract';
import { createMachineAxisActionLegalityProof } from './machineAxisActionLegality';
import { createVerifiedJointAttackRuntimePair } from '../domain/verifiedJointAttackRuntimePair';
import {
  MACHINE_AXIS_TRANSPORT_METADATA_KEY,
  createMachineAxisDiagnostic,
  resolveMachineAxisSchedules,
  validateMachineAxisContract,
} from './machineAxisContract';

export const MACHINE_AXIS_SERVICE_SCHEMA_VERSION = 1;
export const MACHINE_AXIS_SERVICE_CONTRACT_NAME = 'AzPrMachineAxisService';

const DEFAULT_KIBO_ACTION_CATALOG = projectWorkbenchKiboActionCatalog(
  generatedWorkbenchKiboActionCatalog
);

export function createMachineAxisService({
  core = DEFAULT_HEADLESS_COMBAT_CORE,
  gameData = getWorkbenchGameData(),
  kiboActionCatalog = DEFAULT_KIBO_ACTION_CATALOG,
  optimizationQualificationCatalog = getOptimizationQualificationCatalog(),
} = {}) {
  const projectedKiboCatalog =
    kiboActionCatalog === DEFAULT_KIBO_ACTION_CATALOG
      ? kiboActionCatalog
      : projectWorkbenchKiboActionCatalog(kiboActionCatalog);
  const kiboNames = new Map(
    getWorkbenchLoadoutOptions().kibos.map(kibo => [
      Number(kibo.id),
      kibo.name ?? null,
    ])
  );
  const kiboCatalogById = new Map(
    projectedKiboCatalog.items.map(kibo => [Number(kibo.kiboId), kibo])
  );
  function catalog() {
    const mechanicsPackage = requireMechanicsPackage();
    const coreCatalog = core.catalog();
    const publicActions = gameData.characters.flatMap(character =>
      createActorCatalogEntries(character, gameData)
    );
    const kibos = projectedKiboCatalog.items.map(kibo => ({
      id: Number(kibo.kiboId),
      name: kiboNames.get(Number(kibo.kiboId)) ?? null,
      actions: kibo.actions.map(action => ({
        publicActionId: Number(action.skillId),
        actionKind: action.kind,
        name: action.name ?? null,
        durationFrames: action.durationFrames ?? null,
        cooldownMs: action.cooldownMs ?? null,
      })),
    }));
    const kiboActionCountByKind = Object.fromEntries(
      ['signature', 'active', 'break', 'normal-attack'].map(kind => [
        kind,
        kibos.reduce(
          (count, kibo) =>
            count +
            kibo.actions.filter(action => action.actionKind === kind).length,
          0
        ),
      ])
    );
    const value = {
      schemaVersion: MACHINE_AXIS_SERVICE_SCHEMA_VERSION,
      contractName: MACHINE_AXIS_SERVICE_CONTRACT_NAME,
      kind: 'azpr-machine-axis-catalog',
      dataIdentity: {
        verifiedMechanicsPackageId: mechanicsPackage.packageId,
        verifiedMechanicsPackageHash: mechanicsPackage.packageHash,
        mechanicsProfileId: 'azpr-three-value-verified-tc-20260718',
        mechanicsProfileVersion: 1,
        optimizationScenarioPolicyId: getOptimizationScenarioPolicy().policyId,
        optimizationScenarioPolicyHash:
          getOptimizationScenarioPolicy().policyHash,
        optimizationCandidateRosterPolicyId:
          getOptimizationCandidateRosterPolicy().rosterPolicyId,
        optimizationCandidateRosterHash:
          getOptimizationCandidateRosterPolicy().rosterHash,
      },
      characters: coreCatalog.characters,
      publicActions,
      kibos,
      enemies: coreCatalog.enemies,
      optimizationQualification:
        createOptimizationQualificationCatalogProjection(
          optimizationQualificationCatalog
        ),
      optimizationScenarioPolicy: getOptimizationScenarioPolicy(),
      optimizationCandidateRoster: getOptimizationCandidateRosterPolicy(),
      summary: {
        characterCount: coreCatalog.summary.characterCount,
        publicActionCount: publicActions.length,
        kiboCount: kibos.length,
        kiboActionCount: kibos.reduce(
          (count, kibo) => count + kibo.actions.length,
          0
        ),
        kiboActionCountByKind,
        enemyCount: coreCatalog.summary.enemyCount,
      },
    };
    return { ...value, catalogHash: hashCanonicalValue(value) };
  }

  function compile(machineAxis, options = {}) {
    const prepared = prepare(machineAxis);
    if (!prepared.valid) {
      const actionLegalityProof = createMachineAxisActionLegalityProof(null, {
        objectiveId:
          prepared.contract?.scenario?.objectiveContract?.objectiveId ?? null,
        preflightIssues: prepared.issues,
      });
      throw new MachineAxisValidationError(prepared.issues, {
        actionLegalityProof:
          actionLegalityProof.passed === true ? null : actionLegalityProof,
      });
    }
    const canonicalCompilation =
      prepared.canonicalCompilation ??
      core.compile({ schemaVersion: 1, project: prepared.project }, options);
    const identityIssues = validateCompiledDataIdentity(
      prepared.contract,
      canonicalCompilation.dataIdentity
    );
    if (identityIssues.length) {
      throw new MachineAxisValidationError(identityIssues);
    }
    return {
      schemaVersion: MACHINE_AXIS_SERVICE_SCHEMA_VERSION,
      contractName: MACHINE_AXIS_SERVICE_CONTRACT_NAME,
      kind: 'azpr-machine-axis-compilation',
      contract: prepared.contract,
      project: prepared.project,
      actionResolutions: prepared.actionResolutions,
      kiboAutoCastDerivationRegistry:
        canonicalCompilation.scenario?.kiboAutoCastDerivationRegistry ?? null,
      canonicalCompilation,
      diagnostics: prepared.issues,
      hashes: canonicalCompilation.hashes,
      dataIdentity: canonicalCompilation.dataIdentity,
    };
  }

  function validate(machineAxis, options = {}) {
    try {
      const prepared = prepareValidated(machineAxis, options);
      const {
        compilation,
        run,
        issues,
        warnings,
        classification,
        actionLegalityProof,
      } = prepared;
      return {
        schemaVersion: MACHINE_AXIS_SERVICE_SCHEMA_VERSION,
        contractName: MACHINE_AXIS_SERVICE_CONTRACT_NAME,
        kind: 'azpr-machine-axis-validation',
        valid: prepared.valid,
        issues,
        warnings,
        classification,
        actionLegalityProof,
        hashes: {
          input: compilation.hashes.input,
          data: compilation.hashes.data,
          trace: run.hashes.trace,
          build: run.hashes.build,
        },
        actionResolutions: compilation.actionResolutions,
      };
    } catch (error) {
      const issues = normalizeMachineAxisIssues(error);
      return {
        schemaVersion: MACHINE_AXIS_SERVICE_SCHEMA_VERSION,
        contractName: MACHINE_AXIS_SERVICE_CONTRACT_NAME,
        kind: 'azpr-machine-axis-validation',
        valid: false,
        issues,
        warnings: [],
        classification: createFailedMachineAxisValidationClassification(issues),
        actionLegalityProof: error?.actionLegalityProof ?? null,
        hashes: { input: null, data: null, trace: null },
        actionResolutions: [],
      };
    }
  }

  function simulate(machineAxis, options = {}) {
    const { compilation, run, actionLegalityProof, validation } =
      simulateCanonical(machineAxis, options);
    return {
      schemaVersion: MACHINE_AXIS_SERVICE_SCHEMA_VERSION,
      contractName: MACHINE_AXIS_SERVICE_CONTRACT_NAME,
      kind: 'azpr-machine-axis-run',
      contract: compilation.contract,
      actionResolutions: compilation.actionResolutions,
      trace: run.trace,
      evaluation: run.evaluation,
      hashes: run.hashes,
      inputHash: run.inputHash,
      dataHash: run.dataHash,
      traceHash: run.traceHash,
      validation,
      actionLegalityProof,
    };
  }

  function evaluate(machineAxis, options = {}) {
    return simulate(machineAxis, options).evaluation;
  }

  function explain(machineAxis, selector = {}, options = {}) {
    const { run } = simulateCanonical(machineAxis, options);
    return {
      schemaVersion: MACHINE_AXIS_SERVICE_SCHEMA_VERSION,
      contractName: MACHINE_AXIS_SERVICE_CONTRACT_NAME,
      kind: 'azpr-machine-axis-explanation',
      selector,
      hashes: run.hashes,
      explanation: core.explain(run, selector, options),
    };
  }

  function compare(left, right, options = {}) {
    return createMachineAxisComparison(
      simulate(left, options),
      simulate(right, options)
    );
  }

  function evaluateBatch(envelope, options = {}) {
    return createMachineAxisBatchEvaluator({ service: api }).evaluate(
      envelope,
      options
    );
  }

  function evaluateCycle(envelope, options = {}) {
    return createMachineAxisCycleEvaluator({
      prepareRun: (contract, runOptions) =>
        prepareValidated(contract, runOptions),
      simulateBoundary: ({ project, boundaryFrame, options: runOptions }) =>
        simulateProjectBeforeFrame({
          project,
          boundaryFrame,
          options: runOptions,
          core,
        }),
    }).evaluate(envelope, options);
  }

  function evaluateKill(envelope, options = {}) {
    return createMachineAxisKillEvaluator({ service: api }).evaluate(
      envelope,
      options
    );
  }

  async function search(envelope, options = {}) {
    const contract = Object.prototype.hasOwnProperty.call(
      envelope ?? {},
      'contract'
    )
      ? envelope.contract
      : envelope;
    if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
      throw new MachineAxisValidationError([
        createMachineAxisDiagnostic(
          'machine-axis-search-contract-required',
          'contract',
          'Search envelope requires a machine axis contract'
        ),
      ]);
    }
    if (
      envelope?.kind != null &&
      envelope.kind !== 'azpr-machine-axis-search'
    ) {
      throw new MachineAxisValidationError([
        createMachineAxisDiagnostic(
          'machine-axis-search-kind-unsupported',
          'kind',
          `unsupported search kind: ${envelope.kind}`
        ),
      ]);
    }
    const contractValidation = validateMachineAxisContract(contract);
    if (!contractValidation.valid) {
      throw new MachineAxisValidationError(contractValidation.issues);
    }
    const envelopeOptions = envelope?.options ?? {};
    const mergedOptions = {
      ...envelopeOptions,
      ...pickDefined(options, [
        'beamWidth',
        'topN',
        'maxDepth',
        'objective',
        'maxActionsPerOwner',
        'maxKiboActions',
        'burstWindowMs',
        'jobs',
        'includeKibo',
        'includeSwitch',
        'includeNormalAttacks',
        'includeWait',
        'maxWaitCandidates',
        'criticalPolicy',
        'seeds',
        'allowUnverifiedRuntimeTiming',
      ]),
    };
    const normalizedOptions = normalizeSearchOptions(mergedOptions);
    if (normalizedOptions.objective == null) {
      throw new MachineAxisValidationError([
        createMachineAxisDiagnostic(
          'machine-axis-search-objective-invalid',
          'options.objective',
          `Unsupported search objective: ${mergedOptions.objective}`
        ),
      ]);
    }
    const objectiveContract =
      envelope?.objectiveContract ??
      createMachineAxisObjectiveContract(normalizedOptions.objective);
    const objectiveValidation = validateMachineAxisObjectiveContract(
      objectiveContract,
      {
        formal: contract.scenario?.optimizationQualification?.mode === 'formal',
      }
    );
    if (
      objectiveValidation.valid !== true ||
      objectiveValidation.contract.objectiveId !== normalizedOptions.objective
    ) {
      throw new MachineAxisValidationError([
        ...objectiveValidation.issues.map(issue =>
          createMachineAxisDiagnostic(
            issue.code,
            `objectiveContract${issue.field ? `.${issue.field}` : ''}`,
            issue.message
          )
        ),
        ...(objectiveValidation.valid === true &&
        objectiveValidation.contract.objectiveId !== normalizedOptions.objective
          ? [
              createMachineAxisDiagnostic(
                'machine-axis-search-objective-contract-mismatch',
                'objectiveContract.objectiveId',
                'Search objective does not match the supplied objective contract'
              ),
            ]
          : []),
      ]);
    }
    normalizedOptions.objectiveContract = objectiveValidation.contract;
    if (mergedOptions.seeds != null && normalizedOptions.seeds == null) {
      throw new MachineAxisValidationError([
        createMachineAxisDiagnostic(
          'machine-axis-search-seeds-invalid',
          'options.seeds',
          'Search seeds must be a non-empty array of strings or numbers'
        ),
      ]);
    }
    if (
      mergedOptions.criticalPolicy != null &&
      normalizedOptions.criticalPolicy == null
    ) {
      throw new MachineAxisValidationError([
        createMachineAxisDiagnostic(
          'machine-axis-search-critical-policy-invalid',
          'options.criticalPolicy',
          `Unsupported search critical policy: ${mergedOptions.criticalPolicy}`
        ),
      ]);
    }
    const teamCandidates = normalizeSearchTeamCandidates(
      envelope?.teamCandidates,
      contract
    );
    const startedAt = Date.now();
    const teamResults = [];
    const teamFailures = [];
    const summaries = [];
    for (const candidate of teamCandidates) {
      const candidateContract = applySearchObjectiveContract(
        applySearchTeamCandidate(contract, candidate),
        objectiveValidation.contract
      );
      const engine = createMachineAxisSearchEngine({ service: api });
      try {
        const result = await engine.search({
          contract: candidateContract,
          options: normalizedOptions,
        });
        summaries.push(result.summary);
        for (const entry of result.results) {
          teamResults.push({
            ...entry,
            teamCandidateId: candidate.id,
          });
        }
        if (result.results.length === 0) {
          teamFailures.push({
            teamCandidateId: candidate.id,
            issues: result.issues,
          });
        }
      } catch (error) {
        teamFailures.push({
          teamCandidateId: candidate.id,
          issues: normalizeMachineAxisIssues(error),
        });
      }
    }
    const results = selectTopN(teamResults, normalizedOptions.topN);
    if (results.length === 0) {
      const qualificationStageIssues = teamFailures.flatMap(failure =>
        (failure.issues ?? []).filter(
          issue => issue.code === 'optimization-qualification-stage-locked'
        )
      );
      if (qualificationStageIssues.length > 0) {
        throw new MachineAxisValidationError(qualificationStageIssues);
      }
      throw new MachineAxisValidationError([
        createMachineAxisDiagnostic(
          'machine-axis-search-no-solution',
          'actions',
          'Search produced no legal action axis',
          { teamFailures }
        ),
      ]);
    }
    const searchResult = {
      schemaVersion: 1,
      contractName: 'AzPrMachineAxisSearch',
      kind: 'azpr-machine-axis-search',
      options: normalizedOptions,
      summary: aggregateSearchSummaries({
        summaries,
        options: normalizedOptions,
        teamCandidates,
        teamFailures,
        wallTimeMs: Date.now() - startedAt,
        horizonFrames: Number(contract.scenario?.durationFrames) || 1,
      }),
      results,
    };
    return createMachineAxisSearchReport({
      searchResult,
      contract,
      service: api,
    });
  }

  function prepareValidated(machineAxis, options = {}) {
    const compilation = compile(machineAxis, options);
    const canonicalRun = core.simulate(
      compilation.canonicalCompilation,
      options
    );
    const executionIssues = collectExecutionIssues(
      canonicalRun,
      compilation.actionResolutions
    );
    const contextWindowIssues = collectContextWindowConflictIssues({
      contract: compilation.contract,
      project: compilation.project,
    });
    const warnings = collectExecutionWarnings({
      compilation,
      run: canonicalRun,
    });
    const classification = createMachineAxisValidationClassification({
      issues: executionIssues,
      warnings,
    });
    const runWithValidation = {
      ...canonicalRun,
      validation: {
        issues: executionIssues,
        warnings,
        classification,
      },
    };
    const actionLegalityProof = createMachineAxisActionLegalityProof(
      runWithValidation,
      {
        objectiveId:
          compilation.contract.scenario?.objectiveContract?.objectiveId ?? null,
      }
    );
    const requiresFormalProof =
      compilation.contract.scenario?.objectiveContract?.classification ===
      'primary';
    const issues = dedupeMachineAxisIssues([
      ...executionIssues,
      ...contextWindowIssues,
      ...((requiresFormalProof || executionIssues.length > 0) &&
      actionLegalityProof.passed !== true
        ? actionLegalityProof.issues
        : []),
    ]);
    const finalClassification = createMachineAxisValidationClassification({
      issues,
      warnings,
    });
    const run = {
      ...canonicalRun,
      validation: {
        issues,
        warnings,
        classification: finalClassification,
      },
      actionLegalityProof,
    };
    return {
      valid: issues.length === 0,
      issues,
      warnings,
      classification: finalClassification,
      actionLegalityProof,
      compilation,
      run,
    };
  }

  function simulateCanonical(machineAxis, options = {}) {
    const prepared = prepareValidated(machineAxis, options);
    if (!prepared.valid) {
      throw new MachineAxisValidationError(prepared.issues, {
        actionLegalityProof: prepared.actionLegalityProof,
      });
    }
    return {
      compilation: prepared.compilation,
      run: prepared.run,
      validation: {
        issues: prepared.issues,
        warnings: prepared.warnings,
        classification: prepared.classification,
      },
      actionLegalityProof: prepared.actionLegalityProof,
    };
  }
  function prepare(machineAxis) {
    const contractValidation = validateMachineAxisContract(machineAxis);
    const normalizedContract = contractValidation.normalized;
    let contract = normalizedContract;
    const issues = [...contractValidation.issues];
    if (!contractValidation.valid) {
      return {
        valid: false,
        contract,
        project: null,
        actionResolutions: [],
        issues,
      };
    }
    issues.push(...validateSourceDataIdentity(contract));
    issues.push(...validateScenarioCatalogReferences(contract, gameData));
    issues.push(
      ...createOptimizationQualificationIssuesForContract(contract, {
        catalog: optimizationQualificationCatalog,
      })
    );
    const teamBySlot = new Map(
      contract.scenario.team.map((slot, position) => [
        slot.slotId,
        { ...slot, position },
      ])
    );
    const canonicalSlotIdByMachineSlotId = new Map(
      contract.scenario.team.map((slot, position) => [
        slot.slotId,
        DEFAULT_WORKBENCH_TEAM_SLOTS[position].slotId,
      ])
    );
    const templates = contract.actions.map((action, index) =>
      createActionTemplate({
        action,
        index,
        contract,
        teamBySlot,
        gameData,
        kiboCatalogById,
        issues,
      })
    );
    const scheduleResult = resolveMachineAxisSchedules(contract.actions, {
      resolveDurationFrames: action =>
        templates.find(template => template?.actionId === action.id)
          ?.durationFrames ?? null,
    });
    issues.push(...scheduleResult.issues);
    if (issues.length) {
      return {
        valid: false,
        contract,
        project: null,
        actionResolutions: templates
          .filter(Boolean)
          .map(item => item.resolution),
        issues,
      };
    }
    const actionDrafts = templates
      .filter(Boolean)
      .map(template => {
        const schedule = scheduleResult.byActionId[template.actionId];
        return schedule
          ? createWorkbenchActionDraft({
              ...template.draft,
              startMs: frameToMs(schedule.startFrame),
            })
          : null;
      })
      .filter(Boolean);
    const first = contract.scenario.team[0];
    const second = contract.scenario.team[1];
    const cultivationResolution = contract.scenario.cultivationProfile
      ? resolveOptimizationCultivationProfile(
          contract.scenario.cultivationProfile,
          {
            team: contract.scenario.team,
            catalog: optimizationQualificationCatalog,
          }
        )
      : null;
    const cultivationBySlot = new Map(
      (cultivationResolution?.profile?.actors ?? []).map(actor => [
        actor.slotId,
        projectResolvedOptimizationCultivationActor(actor, {
          profileHash: cultivationResolution.profileHash,
          catalog: optimizationQualificationCatalog,
        }),
      ])
    );
    const starGiftSkillLevelBonusBySlot = new Map(
      [...cultivationBySlot.entries()].map(([slotId, projection]) => {
        const slot = contract.scenario.team.find(
          candidate => String(candidate.slotId) === String(slotId)
        );
        const character = (generatedCharacters.items ?? []).find(
          candidate => Number(candidate.id) === Number(slot?.characterId)
        );
        return [
          slotId,
          resolveStarGiftSkillLevelBonusesBySkillId({
            character,
            starGiftNodeSkillLevels:
              projection?.actorConfigPatch?.cultivation
                ?.starGiftNodeSkillLevels,
          }),
        ];
      })
    );
    for (const draft of actionDrafts) {
      if (draft.type !== ACTION_TYPES.SKILL) continue;
      const slot = contract.scenario.team.find(
        candidate =>
          Number(candidate.characterId) === Number(draft.actorCharacterId)
      );
      const bonusesForSlot = starGiftSkillLevelBonusBySlot.get(
        String(slot?.slotId ?? '')
      );
      const bonus = Number(bonusesForSlot?.[draft.skillId] ?? 0);
      if (bonus > 0) {
        draft.level = Math.max(1, draft.level + bonus);
      }
    }
    const actorConfigs = contract.scenario.team.map(slot => {
      const projection = cultivationBySlot.get(slot.slotId);
      return {
        characterId: slot.characterId,
        level: projection?.actorConfigPatch.level ?? slot.level,
        initialSp: slot.initialSp,
        loadout: {
          ...(slot.loadout ?? {}),
          ...(projection?.actorConfigPatch.loadout ?? {}),
          kiboConfig: {
            ...(slot.loadout?.kiboConfig ?? {}),
            ...(projection?.actorConfigPatch.loadout?.kiboConfig ?? {}),
          },
        },
        cultivation: {
          ...(slot.cultivation ?? {}),
          ...(projection?.actorConfigPatch.cultivation ?? {}),
        },
      };
    });
    let project = createWorkbenchProject(
      {
        characterId: first.characterId,
        secondaryCharacterId: second.characterId,
        enemyId: contract.scenario.enemy.enemyId,
      },
      {
        durationMs: frameToMs(contract.scenario.durationFrames),
        teamSlots: contract.scenario.team.map((slot, position) => ({
          slotId: slot.slotId,
          position,
          characterId: slot.characterId,
        })),
        actorConfigs,
        enemyConfig: contract.scenario.enemy,
        actions: actionDrafts,
        initialRuntimeState: remapMachineAxisInitialRuntimeState(
          contract.scenario.initialRuntimeState,
          canonicalSlotIdByMachineSlotId
        ),
        combatScenario: {
          projectile: contract.scenario.projectile,
          critical: contract.scenario.critical,
          ...(contract.scenario.pickups == null
            ? {}
            : { pickups: contract.scenario.pickups }),
          ...(contract.scenario.optimizationScenarioPolicy == null
            ? {}
            : {
                optimizationScenarioPolicy:
                  contract.scenario.optimizationScenarioPolicy,
              }),
          ...(contract.scenario.objectiveContract == null
            ? {}
            : { objectiveContract: contract.scenario.objectiveContract }),
          ...(contract.scenario.jointAttackRuntime == null
            ? {}
            : { jointAttackRuntime: contract.scenario.jointAttackRuntime }),
          ...(contract.scenario.target == null
            ? {}
            : { target: contract.scenario.target }),
        },
        mechanicsProfileSelection: {
          profileId: contract.dataIdentity.mechanicsProfileId,
          profileVersion:
            Number(contract.dataIdentity.mechanicsProfileVersion) || 1,
        },
      }
    );
    if (cultivationResolution?.valid) {
      const applicationByCharacterId = new Map(
        contract.scenario.team.map(slot => [
          Number(slot.characterId),
          cultivationBySlot.get(slot.slotId)?.application ?? null,
        ])
      );
      project = {
        ...project,
        optimizationQualification:
          contract.scenario.optimizationQualification ?? null,
        optimizationCultivationProfileInput: structuredClone(
          contract.scenario.cultivationProfile
        ),
        optimizationCultivationProfile: cultivationResolution.profile,
        actors: (project.actors ?? []).map(actor => ({
          ...actor,
          optimizationCultivationApplication:
            applicationByCharacterId.get(Number(actor.characterId)) ?? null,
        })),
        metadata: {
          ...project.metadata,
          actorConfigs: (project.metadata?.actorConfigs ?? []).map(
            actorConfig => ({
              ...actorConfig,
              optimizationCultivationApplication:
                applicationByCharacterId.get(Number(actorConfig.characterId)) ??
                null,
            })
          ),
        },
      };
    }
    const sourceSequenceByActionId = new Map(
      templates
        .filter(Boolean)
        .map(template => [String(template.actionId), template.index])
    );
    project = {
      ...project,
      actions: (project.actions ?? []).map((action, projectActionIndex) =>
        attachActionSourceSequence(
          action,
          sourceSequenceByActionId.get(String(action.id)) ?? projectActionIndex,
          'machine-axis-input-array-order'
        )
      ),
    };
    project.id = contract.scenario.id;
    project.name = contract.scenario.name;
    let finalScheduleResult = scheduleResult;
    let canonicalCompilation = null;
    let actionVariantPreflight = null;
    let resolvedDurationFramesByActionId = new Map(
      templates
        .filter(Boolean)
        .map(template => [template.actionId, template.durationFrames])
    );
    if (!issues.length) {
      const stabilization = stabilizeMachineAxisScheduling({
        contract,
        project,
        templates: templates.filter(Boolean),
        core,
      });
      issues.push(...stabilization.issues);
      if (stabilization.valid) {
        project = stabilization.project;
        finalScheduleResult = stabilization.scheduleResult;
        canonicalCompilation = stabilization.canonicalCompilation;
        actionVariantPreflight = stabilization.actionVariantPreflight;
        resolvedDurationFramesByActionId =
          stabilization.durationFramesByActionId;
      }
    }
    if (
      !issues.length &&
      canonicalCompilation &&
      contract.scenario.enemy.profile == null
    ) {
      const mechanicsPackage = requireMechanicsPackage();
      const breakProfile = (mechanicsPackage.ownerProfiles?.enemy ?? []).find(
        candidate =>
          Number(candidate.enemyId) ===
          Number(canonicalCompilation.scenario?.enemy?.enemyId)
      );
      const profile = createMachineAxisEnemyProfileFromCompiledEnemy({
        enemy: canonicalCompilation.scenario?.enemy,
        breakProfile,
      });
      if (profile) {
        contract = {
          ...contract,
          scenario: {
            ...contract.scenario,
            enemy: { ...contract.scenario.enemy, profile },
          },
        };
        project = {
          ...project,
          enemy: applyResolvedEnemyProfileToInstance(project.enemy, profile),
          metadata: {
            ...project.metadata,
            enemyConfig: {
              ...(project.metadata?.enemyConfig ?? {}),
              profile,
            },
          },
        };
        const restabilization = stabilizeMachineAxisScheduling({
          contract,
          project,
          templates: templates.filter(Boolean),
          core,
        });
        issues.push(...restabilization.issues);
        if (restabilization.valid) {
          project = restabilization.project;
          finalScheduleResult = restabilization.scheduleResult;
          canonicalCompilation = restabilization.canonicalCompilation;
          actionVariantPreflight = restabilization.actionVariantPreflight;
          resolvedDurationFramesByActionId =
            restabilization.durationFramesByActionId;
        }
      }
    }
    project.metadata.transport = {
      ...(project.metadata.transport ?? {}),
      [MACHINE_AXIS_TRANSPORT_METADATA_KEY]: createMachineAxisTransportMetadata(
        {
          contract,
          project,
          fps: contract.scenario.fps,
          canonicalSlotIdByMachineSlotId,
        }
      ),
    };
    for (const template of templates.filter(Boolean)) {
      issues.push(
        ...validateResolvedHitOverrides({
          machineAction: template.machineAction,
          availableHitIdentities:
            template.resolution.availableHitIdentities ?? [],
          actionIndex: template.index,
        })
      );
    }
    return {
      valid: issues.length === 0,
      contract,
      project,
      actionResolutions: templates.filter(Boolean).map(template => {
        const variantSelection =
          actionVariantPreflight?.selectionByActionId.get(template.actionId);
        return {
          ...template.resolution,
          index: template.index,
          sourceSequenceIndex: template.index,
          sourceSequencePath: [template.index],
          startFrame:
            finalScheduleResult.byActionId[template.actionId]?.startFrame,
          durationFrames:
            resolvedDurationFramesByActionId.get(template.actionId) ??
            template.durationFrames,
          resolvedControlSkillId:
            variantSelection?.executionControlSkillId ??
            variantSelection?.controlSkillId ??
            null,
          resolvedSubSkillIndex:
            variantSelection?.selectedSubSkillIndex ?? null,
          variantResolutionStatus: variantSelection?.status ?? null,
          variantResolutionSourceIdentity:
            variantSelection?.sourceIdentity ?? null,
        };
      }),
      issues,
      canonicalCompilation,
    };
  }

  const api = Object.freeze({
    schemaVersion: MACHINE_AXIS_SERVICE_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_SERVICE_CONTRACT_NAME,
    catalog,
    compile,
    validate,
    simulate,
    evaluate,
    explain,
    compare,
    evaluateBatch,
    evaluateCycle,
    evaluateKill,
    search,
    prepare,
    prepareValidated,
  });
  return api;
}

function simulateProjectBeforeFrame({
  project,
  boundaryFrame,
  options = {},
  core,
}) {
  const frame = Number(boundaryFrame);
  if (!Number.isInteger(frame) || frame < 0) {
    throw new RangeError('Cycle boundary frame must be a non-negative integer');
  }
  const horizonFrame = frame - 1;
  const boundaryMs = frameToMs(frame);
  const horizonMs = frame === 0 ? 0 : frameToMs(horizonFrame);
  const prefixProject = structuredClone(project);
  prefixProject.time = {
    ...(prefixProject.time ?? {}),
    durationMs: Math.max(Number.EPSILON, horizonMs),
  };
  prefixProject.actions = (prefixProject.actions ?? []).filter(
    action => Number(action.startMs) < boundaryMs
  );
  prefixProject.metadata = {
    ...(prefixProject.metadata ?? {}),
    cycleBoundaryProjection: {
      interval: '[0,boundary)',
      boundaryFrame: frame,
      horizonFrame,
    },
  };
  const compilation = core.compile(
    { schemaVersion: 1, project: prefixProject },
    options
  );
  return core.simulate(compilation, options);
}

function stabilizeMachineAxisScheduling({
  contract,
  project,
  templates,
  core,
}) {
  let workingProject = project;
  const maxPasses = Math.max(3, Math.min(12, templates.length + 1));
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const canonicalCompilation = core.compile({
      schemaVersion: 1,
      project: workingProject,
    });
    const actionVariantPreflight = createVerifiedActionVariantRuntime({
      scenario: canonicalCompilation.scenario,
      actionExecutionPlan: null,
    });
    if (
      actionVariantPreflight?.status !== 'verified-action-variant-runtime-ready'
    ) {
      return createSchedulingFailure(
        'machine-axis-schedule-variant-preflight-unavailable',
        'Verified action variant preflight is unavailable',
        {
          reason:
            actionVariantPreflight?.reason ??
            actionVariantPreflight?.status ??
            'unknown',
        }
      );
    }
    const effectiveTimeline = projectScenarioEffectiveActionTimeline({
      scenario: canonicalCompilation.scenario,
      actionResolutionById: actionVariantPreflight.actionResolutionById,
      actionSelectionById: actionVariantPreflight.selectionByActionId,
    });
    const projectActionById = new Map(
      (canonicalCompilation.scenario.actions ?? []).map(action => [
        String(action.id),
        action,
      ])
    );
    const effectiveActionById = new Map(
      (effectiveTimeline.scenario.actions ?? []).map(action => [
        String(action.id),
        action,
      ])
    );
    const durationFramesByActionId = new Map();
    const scheduleSpanFramesByActionId = new Map();
    const durationIssues = [];
    for (const template of templates) {
      const projectAction = projectActionById.get(String(template.actionId));
      const effectiveAction = effectiveActionById.get(
        String(template.actionId)
      );
      const runtimeResolution = actionVariantPreflight.actionResolutionById.get(
        template.actionId
      );
      const durationFrames = resolvePreflightDurationFrames({
        template,
        effectiveAction,
        runtimeResolution,
      });
      if (durationFrames == null) {
        durationIssues.push(
          createMachineAxisDiagnostic(
            'machine-axis-schedule-duration-unresolved',
            `actions.${template.index}.schedule`,
            `Context-resolved duration is unavailable for action ${template.actionId}`,
            {
              actionId: template.actionId,
              reason:
                runtimeResolution?.status ??
                'context-resolved-effective-duration-missing',
              sourceEvidenceStatus:
                runtimeResolution?.sourceEvidenceStatus ??
                template.resolution.sourceEvidenceStatus ??
                null,
            }
          )
        );
        continue;
      }
      durationFramesByActionId.set(template.actionId, durationFrames);
      const requestedStartMs = Number(projectAction?.startMs);
      const effectiveEndMs =
        Number(effectiveAction?.startMs) + Number(effectiveAction?.durationMs);
      const scheduleSpanFrames =
        Number.isFinite(requestedStartMs) && Number.isFinite(effectiveEndMs)
          ? msToFrame(effectiveEndMs - requestedStartMs)
          : durationFrames;
      scheduleSpanFramesByActionId.set(
        template.actionId,
        Math.max(0, scheduleSpanFrames)
      );
    }
    if (durationIssues.length) {
      return {
        valid: false,
        issues: durationIssues,
        project: workingProject,
        scheduleResult: null,
        canonicalCompilation: null,
        actionVariantPreflight,
        durationFramesByActionId,
      };
    }
    const scheduleResult = resolveMachineAxisSchedules(contract.actions, {
      scenarioDurationFrames: contract.scenario.durationFrames,
      resolveDurationFrames: action =>
        scheduleSpanFramesByActionId.get(action.id) ?? null,
    });
    if (!scheduleResult.valid) {
      return {
        valid: false,
        issues: scheduleResult.issues,
        project: workingProject,
        scheduleResult,
        canonicalCompilation: null,
        actionVariantPreflight,
        durationFramesByActionId,
      };
    }
    const nextProject = applyResolvedMachineAxisTimeline({
      project: workingProject,
      scheduleResult,
      durationFramesByActionId,
    });
    if (machineAxisTimelineEqual(workingProject, nextProject, templates)) {
      return {
        valid: true,
        issues: [],
        project: workingProject,
        scheduleResult,
        canonicalCompilation,
        actionVariantPreflight,
        durationFramesByActionId,
        passCount: pass + 1,
      };
    }
    workingProject = nextProject;
  }
  return createSchedulingFailure(
    'machine-axis-schedule-context-not-converged',
    'Context-resolved Machine Axis schedule did not converge',
    { maxPasses }
  );
}

function resolvePreflightDurationFrames({
  template,
  effectiveAction,
  runtimeResolution,
}) {
  if (!effectiveAction) return null;
  const binding = runtimeResolution?.actionBinding ?? null;
  const sourcedDurationFrames =
    nonNegativeIntegerOrNull(binding?.effectiveOccupancyFrames) ??
    nonNegativeIntegerOrNull(binding?.actualDurationFrames) ??
    nonNegativeIntegerOrNull(binding?.actionTiming?.occupancy?.durationFrames);
  if (sourcedDurationFrames != null) return sourcedDurationFrames;
  if (runtimeResolution) return null;
  const projectedDurationFrames = msToFrame(effectiveAction.durationMs);
  if (projectedDurationFrames >= 0) return projectedDurationFrames;
  return nonNegativeIntegerOrNull(template.durationFrames);
}

function applyResolvedMachineAxisTimeline({
  project,
  scheduleResult,
  durationFramesByActionId,
}) {
  return {
    ...project,
    actions: (project.actions ?? []).map(action => {
      const schedule = scheduleResult.byActionId[String(action.id)];
      if (!schedule) return action;
      const durationFrames =
        durationFramesByActionId.get(String(action.id)) ??
        nonNegativeIntegerOrNull(action.durationFrames) ??
        msToFrame(action.durationMs);
      return {
        ...action,
        startFrame: schedule.startFrame,
        startMs: frameToMs(schedule.startFrame),
        durationFrames,
        durationMs: frameToMs(durationFrames),
      };
    }),
  };
}

function machineAxisTimelineEqual(left, right, templates) {
  const leftById = new Map(
    (left.actions ?? []).map(action => [String(action.id), action])
  );
  const rightById = new Map(
    (right.actions ?? []).map(action => [String(action.id), action])
  );
  return templates.every(template => {
    const leftAction = leftById.get(String(template.actionId));
    const rightAction = rightById.get(String(template.actionId));
    return (
      msToFrame(leftAction?.startMs) === msToFrame(rightAction?.startMs) &&
      msToFrame(leftAction?.durationMs) === msToFrame(rightAction?.durationMs)
    );
  });
}

function createSchedulingFailure(code, message, details = {}) {
  return {
    valid: false,
    issues: [createMachineAxisDiagnostic(code, 'actions', message, details)],
    project: null,
    scheduleResult: null,
    canonicalCompilation: null,
    actionVariantPreflight: null,
    durationFramesByActionId: new Map(),
  };
}

function createMachineAxisTransportMetadata({
  contract,
  project,
  fps,
  canonicalSlotIdByMachineSlotId,
}) {
  return {
    schemaVersion: MACHINE_AXIS_SERVICE_SCHEMA_VERSION,
    contractName: contract.contractName,
    slotIdsByCanonicalSlotId: Object.fromEntries(
      [...canonicalSlotIdByMachineSlotId.entries()].map(
        ([machineSlotId, canonicalSlotId]) => [canonicalSlotId, machineSlotId]
      )
    ),
    schedulesByActionId: Object.fromEntries(
      contract.actions.map(action => [
        action.id,
        structuredClone(action.schedule),
      ])
    ),
    actionIntentsByActionId: Object.fromEntries(
      contract.actions.map(action => [
        action.id,
        structuredClone(action.intent),
      ])
    ),
    actionSnapshot: (project.actions ?? []).map(action => ({
      id: String(action.id),
      startFrame:
        nonNegativeIntegerOrNull(action.startFrame) ??
        Math.round((Number(action.startMs) * fps) / 1000),
      durationFrames:
        nonNegativeIntegerOrNull(action.durationFrames) ??
        Math.round((Number(action.durationMs) * fps) / 1000),
    })),
  };
}

function remapMachineAxisInitialRuntimeState(
  initialRuntimeState,
  canonicalSlotIdByMachineSlotId
) {
  const value = structuredClone(initialRuntimeState ?? {});
  if (Array.isArray(value.kiboEnergyBySlot)) {
    value.kiboEnergyBySlot = value.kiboEnergyBySlot.map(entry => ({
      ...entry,
      slotId:
        canonicalSlotIdByMachineSlotId.get(String(entry.slotId)) ??
        entry.slotId,
    }));
  }
  return value;
}

export class MachineAxisValidationError extends Error {
  constructor(issues, { actionLegalityProof = null } = {}) {
    super('Machine Axis input is invalid');
    this.name = 'MachineAxisValidationError';
    this.issues = issues;
    this.actionLegalityProof = actionLegalityProof;
  }
}
function createActionTemplate({
  action,
  index,
  contract,
  teamBySlot,
  gameData,
  kiboCatalogById,
  issues,
}) {
  const ownerSlot = teamBySlot.get(action.owner.slotId);
  if (action.owner.kind !== 'system' && !ownerSlot) {
    issues.push(
      createMachineAxisDiagnostic(
        'machine-axis-owner-slot-missing',
        `actions.${index}.owner.slotId`,
        `Unknown owner slot: ${action.owner.slotId}`,
        { actionId: action.id }
      )
    );
    return null;
  }
  if (action.intent.kind === 'wait') {
    return {
      actionId: action.id,
      index,
      machineAction: action,
      durationFrames: action.intent.durationFrames,
      draft: {
        id: action.id,
        type: ACTION_TYPES.WAIT,
        actorCharacterId:
          ownerSlot?.characterId ?? contract.scenario.team[0].characterId,
        durationMs: frameToMs(action.intent.durationFrames),
        note: action.note,
      },
      resolution: {
        actionId: action.id,
        intentKind: 'wait',
        durationFrames: action.intent.durationFrames,
      },
    };
  }
  if (action.intent.kind === 'switch') {
    const targetSlot = teamBySlot.get(action.intent.targetSlotId);
    if (!targetSlot) {
      issues.push(
        createMachineAxisDiagnostic(
          'machine-axis-switch-target-slot-missing',
          `actions.${index}.intent.targetSlotId`,
          `Unknown switch target slot: ${action.intent.targetSlotId}`,
          { actionId: action.id }
        )
      );
      return null;
    }
    return {
      actionId: action.id,
      index,
      machineAction: action,
      durationFrames: 0,
      draft: {
        id: action.id,
        type: ACTION_TYPES.SWITCH,
        actorCharacterId: ownerSlot.characterId,
        targetCharacterId: targetSlot.characterId,
        durationMs: 0,
        note: action.note,
      },
      resolution: {
        actionId: action.id,
        intentKind: 'switch',
        sourceSlotId: ownerSlot.slotId,
        targetSlotId: targetSlot.slotId,
        targetCharacterId: targetSlot.characterId,
        durationFrames: 0,
      },
    };
  }
  if (action.owner.kind === 'kibo') {
    return createKiboActionTemplate({
      action,
      index,
      ownerSlot,
      kiboCatalogById,
      issues,
    });
  }
  if (action.owner.kind !== 'actor') {
    issues.push(
      createMachineAxisDiagnostic(
        'machine-axis-public-action-owner-unsupported',
        `actions.${index}.owner.kind`,
        `Public action owner is not supported: ${action.owner.kind}`,
        { actionId: action.id }
      )
    );
    return null;
  }
  return createActorActionTemplate({
    action,
    index,
    ownerSlot,
    contract,
    gameData,
    issues,
    formalOptimization:
      contract.scenario.optimizationQualification?.mode === 'formal',
  });
}

function createActorActionTemplate({
  action,
  index,
  ownerSlot,
  contract,
  gameData,
  issues,
  formalOptimization,
}) {
  const skills = getSkillsForCharacter(ownerSlot.characterId);
  const skill = skills.find(
    entry => Number(entry.id) === Number(action.intent.publicActionId)
  );
  if (!skill) {
    issues.push(
      createMachineAxisDiagnostic(
        'machine-axis-public-action-unknown',
        `actions.${index}.intent.publicActionId`,
        `Unknown public action ${action.intent.publicActionId} for character ${ownerSlot.characterId}`,
        { actionId: action.id }
      )
    );
    return null;
  }
  const catalogCandidates = getSkillActionCatalog(skills, 1).filter(
    entry =>
      Number(entry.skillId) === Number(action.intent.publicActionId) &&
      (!action.intent.actionKind || entry.kind === action.intent.actionKind)
  );
  const declaredMapping =
    catalogCandidates.length === 0 && action.intent.actionKind
      ? getVerifiedCombatActionMapping({
          type: ACTION_TYPES.SKILL,
          skillId: action.intent.publicActionId,
          actionKind: action.intent.actionKind,
          actor: { characterId: ownerSlot.characterId },
        })
      : null;
  const declaredEntry =
    declaredMapping?.schedulable === true &&
    declaredMapping.catalogDeclaration &&
    declaredMapping.actionKind === action.intent.actionKind
      ? createDeclaredActorActionEntry(declaredMapping)
      : null;
  if (declaredEntry) catalogCandidates.push(declaredEntry);
  if (catalogCandidates.length !== 1) {
    issues.push(
      createMachineAxisDiagnostic(
        catalogCandidates.length
          ? 'machine-axis-public-action-ambiguous'
          : 'machine-axis-public-action-kind-missing',
        `actions.${index}.intent.actionKind`,
        `Unable to select one public action form for ${action.intent.publicActionId}`,
        { actionId: action.id }
      )
    );
    return null;
  }
  const entry = catalogCandidates[0];
  if (
    formalOptimization === true &&
    !isOptimizationScenarioActionKindInScope(entry.kind)
  ) {
    issues.push(
      createMachineAxisDiagnostic(
        'machine-axis-formal-action-scenario-out-of-scope',
        `actions.${index}.intent.actionKind`,
        `Action ${entry.kind} is excluded from the formal optimization scenario`,
        {
          actionId: action.id,
          actionKind: entry.kind,
          reason: getOptimizationScenarioPolicy().reason,
          policyId: getOptimizationScenarioPolicy().policyId,
          policyHash: getOptimizationScenarioPolicy().policyHash,
        }
      )
    );
    return null;
  }
  const mapping =
    declaredEntry === entry
      ? declaredMapping
      : getVerifiedCombatActionMapping({
          type: ACTION_TYPES.SKILL,
          skillId: entry.skillId,
          actionKind: entry.kind,
          actionVariantIndex: entry.actionVariantIndex,
          actor: { characterId: ownerSlot.characterId },
        });
  if (!mapping) {
    issues.push(
      createMachineAxisDiagnostic(
        'machine-axis-public-action-mapping-missing',
        `actions.${index}.intent`,
        `Verified mapping is missing for ${entry.id}`,
        { actionId: action.id }
      )
    );
    return null;
  }
  const segment =
    mapping.actionKind === 'normal-attack'
      ? resolveAttackInputSegment(action, mapping, contract, index, issues)
      : null;
  if (mapping.actionKind === 'normal-attack' && !segment) return null;
  const semanticVariantResolution = resolveSemanticVariantSelection({
    action,
    entry,
    mapping,
    ownerId: ownerSlot.characterId,
    index,
    issues,
  });
  if (action.intent.semanticVariant && !semanticVariantResolution) return null;
  const semanticVariant = semanticVariantResolution?.selection ?? null;
  const selectedVariant = semanticVariantResolution?.selectedOption ?? null;
  const selectedVariantOccupancy = selectedVariant?.executionTiming?.occupancy;
  const selectedVariantHitIdentities =
    collectSelectedVariantHitIdentities(selectedVariant);
  const durationFrames =
    positiveIntegerOrNull(segment?.effectiveDurationFrames) ??
    positiveIntegerOrNull(segment?.durationFrames) ??
    positiveIntegerOrNull(selectedVariant?.durationFrames) ??
    positiveIntegerOrNull(selectedVariantOccupancy?.durationFrames) ??
    positiveIntegerOrNull(mapping.actionTiming?.occupancy?.durationFrames) ??
    positiveIntegerOrNull(mapping.actionScheduling?.durationFrames);
  if (durationFrames == null) {
    issues.push(
      createMachineAxisDiagnostic(
        'machine-axis-action-duration-unresolved',
        `actions.${index}.intent`,
        `Action duration is unresolved for ${entry.id}`,
        { actionId: action.id }
      )
    );
    return null;
  }
  const selectedVariantScheduling = selectedVariant
    ? {
        status: 'exact',
        kind: 'exact-selected-variant-occupancy',
        durationFrames,
        planningDurationFrames: null,
        selectedSubSkillIndex:
          selectedVariant.executionSubSkillIndex ??
          selectedVariant.subSkillIndex ??
          null,
        sourceIdentity:
          selectedVariantOccupancy?.sourceIdentity ??
          selectedVariant.sourceIdentity ??
          mapping.bindingSourceIdentity,
        sourceStatus: 'verified-input-occupancy',
        variantModelStatus: 'resolved',
        reasons: [],
      }
    : null;
  const scheduling = resolveWorkbenchActionScheduling({
    timingStatus: 'applied',
    durationFrames,
    actionScheduling:
      segment?.actionScheduling ??
      selectedVariantScheduling ??
      mapping.actionScheduling,
  });
  const attackInputFields = segment
    ? createAttackInputFields(action, mapping, segment)
    : {};
  const contextActionId = action.intent.attackInput?.contextActionId;
  return {
    actionId: action.id,
    index,
    machineAction: action,
    durationFrames,
    draft: {
      id: action.id,
      type: ACTION_TYPES.SKILL,
      actorCharacterId: ownerSlot.characterId,
      skillId: entry.skillId,
      actionVariantIndex: entry.actionVariantIndex,
      level: action.intent.level ?? 1,
      durationMs: scheduling.durationMs,
      durationFrames,
      timingSource:
        segment?.durationBasis ??
        selectedVariantOccupancy?.sourceKind ??
        mapping.actionTiming?.occupancy?.sourceKind ??
        'verified-machine-axis',
      timingStatus: 'applied',
      timingReasons: [],
      timingSourceIdentity:
        segment?.durationSourceIdentity ??
        selectedVariantOccupancy?.sourceIdentity ??
        mapping.actionTiming?.occupancy?.sourceIdentity ??
        mapping.bindingSourceIdentity,
      needsTimingData: false,
      controlSubSkillIndex:
        segment?.selectedSubSkillIndex ??
        selectedVariant?.executionSubSkillIndex ??
        selectedVariant?.subSkillIndex ??
        mapping.selectedSubSkillIndex,
      variantInputSelection: semanticVariant,
      actionScheduling:
        segment?.actionScheduling ??
        selectedVariantScheduling ??
        mapping.actionScheduling ??
        null,
      sourceEvidenceStatus: mapping.sourceEvidenceStatus,
      scenarioRuntimeStatus: mapping.scenarioRuntimeStatus,
      verifiedDeclaredPublicActionIntent:
        declaredEntry === entry
          ? {
              schemaVersion: 1,
              contractName: 'AzPrVerifiedDeclaredPublicAction',
              actionId: action.id,
              ownerId: Number(ownerSlot.characterId),
              mappingIdentity: mapping.identity,
            }
          : null,
      hitOverrides: toProjectHitOverrides(action.hitOverrides),
      note: action.note,
      ...(contextActionId ? { contextActionId: String(contextActionId) } : {}),
      ...attackInputFields,
    },
    resolution: {
      actionId: action.id,
      intentKind: 'public-action',
      ownerKind: 'actor',
      ownerSlotId: ownerSlot.slotId,
      ownerId: ownerSlot.characterId,
      publicActionId: entry.skillId,
      actionKind: mapping.actionKind,
      publicVariantIndex: entry.actionVariantIndex,
      level: action.intent.level ?? 1,
      durationFrames,
      mappingIdentity: mapping.identity,
      sourceEvidenceStatus: mapping.sourceEvidenceStatus,
      scenarioRuntimeStatus: mapping.scenarioRuntimeStatus,
      availableHitIdentities: [
        ...new Set([
          ...collectMappingHitIdentities(mapping, segment),
          ...selectedVariantHitIdentities,
        ]),
      ].sort((left, right) => left.localeCompare(right, 'en')),
      semanticVariant,
    },
  };
}

function createDeclaredActorActionEntry(mapping) {
  return {
    id: mapping.identity,
    kind: mapping.actionKind,
    label:
      mapping.catalogDeclaration?.catalogLabel ??
      mapping.catalogDeclaration?.label ??
      mapping.actionVariantLabel ??
      mapping.actionKind,
    skillId: Number(mapping.sourceSkillId),
    actionVariantIndex: Number(mapping.actionVariantIndex) || 0,
  };
}

function createKiboActionTemplate({
  action,
  index,
  ownerSlot,
  kiboCatalogById,
  issues,
}) {
  const kiboId = Number(ownerSlot.loadout?.kiboId);
  const kibo = kiboCatalogById.get(kiboId) ?? null;
  if (!kibo) {
    issues.push(
      createMachineAxisDiagnostic(
        'machine-axis-kibo-unknown',
        `actions.${index}.owner.slotId`,
        `No generated public action catalog exists for ${kiboId || 'unconfigured kibo'}`,
        { actionId: action.id, kiboId: kiboId || null }
      )
    );
    return null;
  }
  const publicAction = kibo.actions.find(
    entry =>
      Number(entry.skillId) === Number(action.intent.publicActionId) &&
      (!action.intent.actionKind || entry.kind === action.intent.actionKind)
  );
  if (!publicAction) {
    issues.push(
      createMachineAxisDiagnostic(
        'machine-axis-kibo-action-unknown',
        `actions.${index}.intent.publicActionId`,
        `Unknown kibo action ${action.intent.publicActionId} for ${kiboId}`,
        {
          actionId: action.id,
          kiboId,
          publicActionId: action.intent.publicActionId,
          actionKind: action.intent.actionKind ?? null,
        }
      )
    );
    return null;
  }
  const mapping = getVerifiedCombatActionMapping({
    type: ACTION_TYPES.KIBO_EVENT,
    skillId: publicAction.skillId,
    actionKind: publicAction.kind,
    actionVariantIndex: 0,
    kiboId,
    actor: {
      characterId: ownerSlot.characterId,
      loadout: { kiboId },
    },
  });
  const durationFrames = positiveIntegerOrNull(
    mapping?.actionTiming?.occupancy?.durationFrames
  );
  if (!mapping || durationFrames == null) {
    issues.push(
      createMachineAxisDiagnostic(
        'machine-axis-kibo-action-mapping-missing',
        `actions.${index}.intent`,
        `Verified kibo action mapping is missing for ${publicAction.skillId}`,
        { actionId: action.id }
      )
    );
    return null;
  }
  return {
    actionId: action.id,
    index,
    machineAction: action,
    durationFrames,
    draft: {
      id: action.id,
      type: ACTION_TYPES.KIBO_EVENT,
      actorCharacterId: ownerSlot.characterId,
      kiboId,
      skillId: publicAction.skillId,
      level: action.intent.level ?? 1,
      name: publicAction.name,
      eventType: publicAction.kind,
      durationMs: frameToMs(durationFrames),
      durationFrames,
      timingSource: mapping.actionTiming.occupancy.sourceKind,
      timingStatus: 'applied',
      timingSourceIdentity:
        mapping.actionTiming.occupancy.sourceIdentity ??
        mapping.bindingSourceIdentity,
      needsTimingData: false,
      controlSubSkillIndex: mapping.selectedSubSkillIndex,
      sourceEvidenceStatus: mapping.sourceEvidenceStatus,
      scenarioRuntimeStatus: mapping.scenarioRuntimeStatus,
      hitOverrides: toProjectHitOverrides(action.hitOverrides),
      autoCast: action.autoCast === true,
      ...(action.autoCastRule ? { autoCastRule: action.autoCastRule } : {}),
      note: action.note,
    },
    resolution: {
      actionId: action.id,
      intentKind: 'public-action',
      ownerKind: 'kibo',
      ownerSlotId: ownerSlot.slotId,
      ownerId: kiboId,
      publicActionId: publicAction.skillId,
      actionKind: publicAction.kind,
      publicVariantIndex: 0,
      level: action.intent.level ?? 1,
      durationFrames,
      mappingIdentity: mapping.identity,
      sourceEvidenceStatus: mapping.sourceEvidenceStatus,
      scenarioRuntimeStatus: mapping.scenarioRuntimeStatus,
      availableHitIdentities: collectMappingHitIdentities(mapping),
      autoCast: action.autoCast === true,
      ...(action.autoCastRule ? { autoCastRule: action.autoCastRule } : {}),
    },
  };
}
function resolveAttackInputSegment(action, mapping, contract, index, issues) {
  const sequenceIndex = action.intent.attackInput?.sequenceIndex;
  if (!sequenceIndex) {
    issues.push(
      createMachineAxisDiagnostic(
        'machine-axis-normal-attack-input-required',
        `actions.${index}.intent.attackInput.sequenceIndex`,
        'Normal attacks require a semantic input sequenceIndex',
        { actionId: action.id }
      )
    );
    return null;
  }
  const defaultSegments =
    mapping.attackInputSegments ?? mapping.attackInputSourceSegments ?? [];
  const profileSegments = mapping.profileAttackInputSegments ?? [];
  const requestedChainIdentity =
    action.intent.attackInput?.chainIdentity ?? null;
  const candidatePool = requestedChainIdentity
    ? profileSegments.filter(
        segment =>
          String(segment.attackInputChainIdentity ?? '') ===
          String(requestedChainIdentity)
      )
    : defaultSegments;
  const candidates = candidatePool.filter(
    segment => Number(segment.sequenceIndex) === sequenceIndex
  );
  if (candidates.length !== 1) {
    issues.push(
      createMachineAxisDiagnostic(
        candidates.length
          ? 'machine-axis-normal-attack-input-ambiguous'
          : 'machine-axis-normal-attack-input-missing',
        `actions.${index}.intent.attackInput.sequenceIndex`,
        `Unable to resolve normal attack input ${sequenceIndex}`,
        { actionId: action.id }
      )
    );
    return null;
  }
  const requestedSegment = candidates[0];
  const contextActionId = action.intent.attackInput?.contextActionId;
  if (!contextActionId) return requestedSegment;
  const contextAction = (contract.actions ?? []).find(
    candidate => String(candidate.id) === String(contextActionId)
  );
  const contextFrame = absoluteScheduleFrame(contextAction);
  const actionFrame = absoluteScheduleFrame(action);
  const contextSequenceIndex =
    contextAction?.intent?.attackInput?.sequenceIndex;
  if (!Number.isFinite(contextFrame) || !Number.isFinite(actionFrame)) {
    return requestedSegment;
  }
  if (!contextSequenceIndex) {
    const contextMapping = getVerifiedCombatActionMapping({
      type: ACTION_TYPES.SKILL,
      skillId: contextAction?.intent?.publicActionId,
      actionKind: contextAction?.intent?.actionKind,
      actor: { characterId: mapping.ownerId },
    });
    if (!contextMapping) return requestedSegment;
    const offsetFrames = actionFrame - contextFrame;
    const matchingBindings = (mapping.profileVariantWindowBindings ?? [])
      .filter(
        binding =>
          Number(binding.sourceControlSkillId) ===
            Number(contextMapping.controlSkillId) &&
          Number(binding.sourceSubSkillIndex ?? 0) ===
            Number(contextMapping.selectedSubSkillIndex ?? 0) &&
          offsetFrames >= Number(binding.inputWindow?.startFrame) &&
          offsetFrames < Number(binding.inputWindow?.endFrame)
      )
      .flatMap(binding =>
        profileSegments.filter(
          segment =>
            Number(segment.sequenceIndex) === Number(sequenceIndex) &&
            Number(segment.controlSkillId) ===
              Number(binding.targetControlSkillId) &&
            Number(segment.subSkillIndex ?? segment.selectedSubSkillIndex) ===
              Number(binding.targetSubSkillIndex ?? 0)
        )
      );
    return selectContextualAttackInputSegment({
      action,
      index,
      issues,
      requestedChainIdentity,
      requestedSegment,
      contextualSegments: matchingBindings,
    });
  }
  const sourceSegment = (
    mapping.attackInputSegments ??
    mapping.attackInputSourceSegments ??
    []
  ).find(
    segment => Number(segment.sequenceIndex) === Number(contextSequenceIndex)
  );
  const offsetFrames = actionFrame - contextFrame;
  const matchingWindows = [
    ...new Map(
      [sourceSegment?.linkWindow, ...(sourceSegment?.linkWindows ?? [])]
        .filter(
          window =>
            window &&
            Number.isFinite(Number(window.startFrame)) &&
            Number.isFinite(Number(window.endFrame)) &&
            offsetFrames >= Number(window.startFrame) &&
            offsetFrames < Number(window.endFrame) &&
            (window.allowAttack === true ||
              (window.allowedInputCommands ?? []).includes('normal-attack')) &&
            Number.isInteger(Number(window.targetControlSkillId))
        )
        .map(window => [
          [
            window.startFrame,
            window.endFrame,
            window.targetControlSkillId,
            window.targetSubSkillIndex ?? 0,
            window.sourceIdentity ?? '',
          ].join('|'),
          window,
        ])
    ).values(),
  ];
  if (matchingWindows.length !== 1) return requestedSegment;
  const window = matchingWindows[0];
  const linked = (
    mapping.attackInputSegments ??
    mapping.attackInputSourceSegments ??
    []
  ).filter(
    segment =>
      Number(segment.controlSkillId) === Number(window.targetControlSkillId) &&
      Number(segment.selectedSubSkillIndex) ===
        Number(window.targetSubSkillIndex ?? 0)
  );
  return selectContextualAttackInputSegment({
    action,
    index,
    issues,
    requestedChainIdentity,
    requestedSegment,
    contextualSegments: linked,
  });
}

function selectContextualAttackInputSegment({
  action,
  index,
  issues,
  requestedChainIdentity,
  requestedSegment,
  contextualSegments,
}) {
  if (contextualSegments.length !== 1) return requestedSegment;
  const contextualSegment = contextualSegments[0];
  if (
    requestedChainIdentity &&
    (String(contextualSegment.attackInputChainIdentity ?? '') !==
      String(requestedChainIdentity) ||
      Number(contextualSegment.controlSkillId) !==
        Number(requestedSegment.controlSkillId) ||
      Number(
        contextualSegment.subSkillIndex ??
          contextualSegment.selectedSubSkillIndex ??
          0
      ) !==
        Number(
          requestedSegment.subSkillIndex ??
            requestedSegment.selectedSubSkillIndex ??
            0
        ))
  ) {
    issues.push(
      createMachineAxisDiagnostic(
        'machine-axis-normal-attack-chain-context-conflict',
        `actions.${index}.intent.attackInput.chainIdentity`,
        'Explicit attack input chain conflicts with the contextual window',
        {
          actionId: action.id,
          requestedChainIdentity: String(requestedChainIdentity),
          contextualChainIdentity:
            contextualSegment.attackInputChainIdentity ?? null,
        }
      )
    );
    return null;
  }
  return contextualSegment;
}

function absoluteScheduleFrame(action) {
  if (action?.schedule?.mode !== 'absolute') return Number.NaN;
  const frame = Number(action.schedule.frame);
  return Number.isFinite(frame) ? frame : Number.NaN;
}

function createAttackInputFields(action, mapping, segment) {
  return {
    ...(action.intent.attackInput?.contextActionId
      ? {
          contextActionId: String(action.intent.attackInput.contextActionId),
        }
      : {}),
    attackGroupId:
      action.intent.attackInput?.groupId ?? `machine-axis-${action.id}`,
    attackSequenceIndex: segment.sequenceIndex,
    attackSequenceTotal: segment.sequenceTotal,
    attackChainSequenceIndex:
      segment.chainSequenceIndex ?? segment.sequenceIndex,
    attackInputChainIdentity:
      action.intent.attackInput?.chainIdentity ??
      segment.attackInputChainIdentity ??
      mapping.attackInputChainIdentity ??
      null,
    attackInputChainSelectionSource: action.intent.attackInput?.chainIdentity
      ? 'user-explicit'
      : 'runtime-projected',
    attackInputIntent: {
      schemaVersion: 1,
      contractName: 'AzPrWorkbenchAttackInputIntent',
      kind: 'public-normal-attack',
      selectionMode: 'runtime-context',
      sourceSkillId: mapping.sourceSkillId,
      actionVariantIndex: mapping.actionVariantIndex,
      sourceIdentity:
        mapping.bindingSourceIdentity ??
        `machine-axis-public-normal-attack:${mapping.sourceSkillId}`,
    },
    attackInput: segment,
  };
}

function validateResolvedHitOverrides({
  machineAction,
  availableHitIdentities,
  actionIndex,
}) {
  const requested = Object.keys(machineAction.hitOverrides);
  if (!requested.length) return [];
  const available = new Set(availableHitIdentities);
  const issues = [];
  for (const hitIdentity of requested) {
    const hit = findInstalledHitByIdentity(hitIdentity);
    if (!available.has(hitIdentity) || !hit) {
      issues.push(
        createMachineAxisDiagnostic(
          'machine-axis-hit-identity-stale',
          `actions.${actionIndex}.hitOverrides.${hitIdentity}`,
          `Hit identity is not valid for the resolved action: ${hitIdentity}`,
          { actionId: machineAction.id, hitIdentity }
        )
      );
      continue;
    }
    const mode = machineAction.hitOverrides[hitIdentity].criticalMode;
    if (
      !['inherit', 'non-critical'].includes(mode) &&
      !isHitCriticalEligible(hit)
    ) {
      issues.push(
        createMachineAxisDiagnostic(
          'machine-axis-hit-critical-override-unsupported',
          `actions.${actionIndex}.hitOverrides.${hitIdentity}.criticalMode`,
          `Hit does not support critical mode ${mode}`,
          { actionId: machineAction.id, hitIdentity }
        )
      );
    }
    if (
      mode === 'expected' &&
      collectCriticalStateEffectIdentities(hit).length
    ) {
      issues.push(
        createMachineAxisDiagnostic(
          'machine-axis-hit-expected-state-branch-unsupported',
          `actions.${actionIndex}.hitOverrides.${hitIdentity}.criticalMode`,
          'Expected critical mode cannot collapse a hit with critical-only state side effects',
          { actionId: machineAction.id, hitIdentity }
        )
      );
    }
  }
  return issues;
}

function toProjectHitOverrides(overrides) {
  return Object.fromEntries(
    Object.entries(overrides ?? {}).map(([hitIdentity, override]) => [
      hitIdentity,
      {
        ...(override.landed === 'hit'
          ? { willHit: true }
          : override.landed === 'miss'
            ? { willHit: false }
            : override.landed === 'blocked'
              ? { willHit: false, landingStatus: 'blocked' }
              : {}),
        ...(override.criticalMode !== 'inherit'
          ? { criticalPolicy: override.criticalMode }
          : {}),
        ...(override.criticalRoll != null
          ? {
              criticalRoll: override.criticalRoll,
              criticalRollUnit: 'basis-points',
            }
          : {}),
      },
    ])
  );
}

function collectMappingHitIdentities(mapping, segment = null) {
  const mechanicsPackage = getInstalledVerifiedCombatMechanicsPackage();
  const controlSkillId = Number(
    segment?.controlSkillId ?? mapping.controlSkillId
  );
  const subSkillIndex = Number(
    segment?.selectedSubSkillIndex ??
      segment?.subSkillIndex ??
      mapping.selectedSubSkillIndex
  );
  const conditionalHitIdentities = (
    mechanicsPackage?.actionVariantGraph?.tuningMarkConditionalDamageGroups ??
    []
  ).flatMap(group => {
    if (
      Number(group.controlSkillId) !== controlSkillId ||
      Number(group.subSkillIndex) !== subSkillIndex
    ) {
      return [];
    }
    const hitCount =
      Math.max(1, group.triggerFrames?.length ?? 0) *
      Math.max(1, group.hitDelaysMs?.length ?? 0);
    return Array.from(
      { length: hitCount },
      (_, index) => `conditional-damage:${group.groupIdentity}:${index + 1}`
    );
  });
  return [
    ...new Set(
      [
        ...(segment?.selectedHitIdentities ?? []),
        ...(segment?.actionTiming?.hits ?? []).map(hit => hit.hitIdentity),
        ...(mapping.selectedHitIdentities ?? []),
        ...(mapping.actionTiming?.hits ?? []).map(hit => hit.hitIdentity),
        ...conditionalHitIdentities,
      ].filter(Boolean)
    ),
  ].sort((left, right) => left.localeCompare(right, 'en'));
}

function collectSelectedVariantHitIdentities(selectedVariant) {
  const controlSkillId = Number(selectedVariant?.executionControlSkillId);
  if (!Number.isInteger(controlSkillId)) return [];
  const mechanicsPackage = requireMechanicsPackage();
  const selectedSubSkillIndex = Number(
    selectedVariant.executionSubSkillIndex ?? selectedVariant.subSkillIndex ?? 0
  );
  return [
    ...new Set(
      [
        ...(mechanicsPackage.controlBindings ?? []),
        ...(mechanicsPackage.actionVariantControlBindings ?? []),
      ]
        .filter(binding => Number(binding.controlSkillId) === controlSkillId)
        .flatMap(binding =>
          (binding.hits ?? [])
            .filter(
              hit =>
                hit.subSkillIndex == null ||
                Number(hit.subSkillIndex) === selectedSubSkillIndex
            )
            .map(hit => hit.hitIdentity)
        )
        .filter(Boolean)
    ),
  ].sort((left, right) => left.localeCompare(right, 'en'));
}

function resolveSemanticVariantSelection({
  action,
  entry,
  mapping,
  ownerId,
  index,
  issues,
}) {
  const requested = action.intent.semanticVariant;
  if (!requested) return null;
  const mechanicsPackage = requireMechanicsPackage();
  if (
    requested.mode === 'release' &&
    Number.isInteger(Number(requested.inputFrame)) &&
    Number(requested.inputFrame) >= 0
  ) {
    const releaseBindings = (
      mechanicsPackage.actionVariantGraph?.chargingReleaseBindings ?? []
    ).filter(
      binding =>
        binding.applied === true &&
        Number(binding.ownerId) === Number(ownerId) &&
        Number(binding.publicControlSkillId) === Number(mapping.controlSkillId) &&
        String(binding.actionKind) === String(mapping.actionKind)
    );
    if (releaseBindings.length === 0) {
      issues.push(
        createMachineAxisDiagnostic(
          'machine-axis-charging-release-binding-missing',
          `actions.${index}.intent.semanticVariant`,
          'Release-frame input has no source-driven charging binding',
          {
            actionId: action.id,
            ownerId,
            controlSkillId: mapping.controlSkillId,
            inputFrame: requested.inputFrame,
          }
        )
      );
      return null;
    }
    return {
      selection: {
        ...requested,
        selectorKind: requested.selectorKind ?? 'charging-release-frame',
        sourceIdentity: releaseBindings.map(binding => binding.sourceIdentity),
        resolutionStatus: 'applied',
      },
      selectedOption: null,
    };
  }
  const contracts = (
    mechanicsPackage.actionVariantGraph?.derivedControlContracts ?? []
  ).filter(
    contract =>
      Number(contract.ownerId) === Number(ownerId) &&
      (contract.publicActions ?? []).some(
        publicAction =>
          Number(publicAction.sourceSkillId) === Number(entry.skillId) &&
          publicAction.actionKind === mapping.actionKind
      )
  );
  const options = contracts.flatMap(contract => [
    ...(contract.inputSelector?.options ?? []),
    ...(contract.chargeTier ?? []),
  ]);
  const selected = options.find(
    option => option.selectorIdentity === requested.selectorIdentity
  );
  if (!selected) {
    issues.push(
      createMachineAxisDiagnostic(
        'machine-axis-semantic-variant-stale',
        `actions.${index}.intent.semanticVariant.selectorIdentity`,
        `Semantic variant is not available for the resolved public action: ${requested.selectorIdentity}`,
        {
          actionId: action.id,
          selectorIdentity: requested.selectorIdentity,
          availableSelectorIdentities: [
            ...new Set(
              options.map(option => option.selectorIdentity).filter(Boolean)
            ),
          ].sort((left, right) => left.localeCompare(right, 'en')),
        }
      )
    );
    return null;
  }
  if (
    requested.publicVariantIndex != null &&
    selected.publicVariantIndex != null &&
    Number(requested.publicVariantIndex) !== Number(selected.publicVariantIndex)
  ) {
    issues.push(
      createMachineAxisDiagnostic(
        'machine-axis-semantic-variant-index-mismatch',
        `actions.${index}.intent.semanticVariant.publicVariantIndex`,
        'Semantic variant index does not match its stable selector identity',
        {
          actionId: action.id,
          selectorIdentity: requested.selectorIdentity,
          expectedPublicVariantIndex: selected.publicVariantIndex,
        }
      )
    );
    return null;
  }
  return {
    selection: {
      ...requested,
      selectorIdentity: selected.selectorIdentity,
      selectorKind:
        requested.selectorKind ??
        contracts.find(contract =>
          (contract.inputSelector?.options ?? []).includes(selected)
        )?.inputSelector?.kind ??
        'input-controlled',
      publicVariantIndex:
        requested.publicVariantIndex ?? selected.publicVariantIndex ?? null,
      chargeTier: requested.chargeTier ?? selected.chargeTier ?? null,
      mode:
        requested.mode ??
        contracts.find(contract =>
          (contract.inputSelector?.options ?? []).includes(selected)
        )?.inputSelector?.mode ??
        null,
      sourceIdentity: selected.sourceIdentity ?? null,
      resolutionStatus: selected.resolutionStatus ?? null,
    },
    selectedOption: selected,
  };
}

function validateScenarioCatalogReferences(contract, gameData) {
  const issues = [];
  const loadoutOptions = getWorkbenchLoadoutOptions();
  const characters = new Set(
    (gameData.characters ?? []).map(character => Number(character.id))
  );
  const enemies = new Set(
    (gameData.enemies ?? []).map(enemy => Number(enemy.id))
  );
  const kibos = new Set(loadoutOptions.kibos.map(kibo => Number(kibo.id)));
  const soulessences = new Set(
    loadoutOptions.soulessences.map(item => Number(item.id))
  );
  for (const [index, slot] of contract.scenario.team.entries()) {
    const path = `scenario.team.${index}`;
    if (!characters.has(Number(slot.characterId))) {
      issues.push(
        createMachineAxisDiagnostic(
          'machine-axis-character-unknown',
          `${path}.characterId`,
          `Unknown character id: ${slot.characterId}`
        )
      );
    }
    const loadout = slot.loadout ?? {};
    if (loadout.kiboId != null && !kibos.has(Number(loadout.kiboId))) {
      issues.push(
        createMachineAxisDiagnostic(
          'machine-axis-loadout-kibo-unknown',
          `${path}.loadout.kiboId`,
          `Unknown kibo id: ${loadout.kiboId}`
        )
      );
    }
    if (
      loadout.soulessenceId != null &&
      !soulessences.has(Number(loadout.soulessenceId))
    ) {
      issues.push(
        createMachineAxisDiagnostic(
          'machine-axis-loadout-soulessence-unknown',
          `${path}.loadout.soulessenceId`,
          `Unknown soulessence id: ${loadout.soulessenceId}`
        )
      );
    }
    for (const [slotKey, equipmentId] of Object.entries(
      loadout.equipment ?? {}
    )) {
      if (equipmentId == null) continue;
      const validIds = new Set(
        (loadoutOptions.equipment[slotKey] ?? []).map(item => Number(item.id))
      );
      if (!validIds.has(Number(equipmentId))) {
        issues.push(
          createMachineAxisDiagnostic(
            'machine-axis-loadout-equipment-invalid',
            `${path}.loadout.equipment.${slotKey}`,
            `Equipment ${equipmentId} is not valid for slot ${slotKey}`
          )
        );
      }
    }
  }
  if (!enemies.has(Number(contract.scenario.enemy.enemyId))) {
    issues.push(
      createMachineAxisDiagnostic(
        'machine-axis-enemy-unknown',
        'scenario.enemy.enemyId',
        `Unknown enemy id: ${contract.scenario.enemy.enemyId}`
      )
    );
  }
  return issues;
}

function createOptimizationQualificationCatalogProjection(catalog) {
  return {
    schemaVersion: catalog.schemaVersion,
    contractName: catalog.contractName,
    catalogHash: catalog.catalogHash,
    sourceSnapshotHash: catalog.sourceSnapshotHash,
    denominators: catalog.denominators,
    admission: catalog.admission,
    cultivation: catalog.cultivation,
    summary: catalog.summary,
  };
}

function collectSemanticVariants(ownerId, entry, mapping) {
  const mechanicsPackage = getInstalledVerifiedCombatMechanicsPackage();
  const contracts = (
    mechanicsPackage?.actionVariantGraph?.derivedControlContracts ?? []
  ).filter(
    contract =>
      Number(contract.ownerId) === Number(ownerId) &&
      (contract.publicActions ?? []).some(
        publicAction =>
          Number(publicAction.sourceSkillId) === Number(entry.skillId) &&
          publicAction.actionKind === mapping?.actionKind
      )
  );
  const values = contracts.flatMap(contract =>
    [
      ...(contract.inputSelector?.options ?? []),
      ...(contract.chargeTier ?? []),
    ].map(option => ({
      selectorIdentity: option.selectorIdentity,
      selectorKind: contract.inputSelector?.kind ?? contract.controlSource,
      label: option.label ?? null,
      publicVariantIndex: option.publicVariantIndex ?? null,
      chargeTier: option.chargeTier ?? null,
      mode: contract.inputSelector?.mode ?? null,
      resolutionStatus: option.resolutionStatus ?? contract.resolutionStatus,
      sourceIdentity: option.sourceIdentity ?? contract.sourceIdentity,
    }))
  );
  return [
    ...new Map(
      values
        .filter(value => value.selectorIdentity)
        .map(value => [value.selectorIdentity, value])
    ).values(),
  ].sort((left, right) =>
    left.selectorIdentity.localeCompare(right.selectorIdentity, 'en')
  );
}
function createActorCatalogEntries(character, gameData) {
  const skills = gameData.skills.filter(
    skill => Number(skill.characterId) === Number(character.id)
  );
  return getSkillActionCatalog(skills, 1).map(entry => {
    const mapping = getVerifiedCombatActionMapping({
      type: ACTION_TYPES.SKILL,
      skillId: entry.skillId,
      actionVariantIndex: entry.actionVariantIndex,
      actor: { characterId: character.id },
    });
    return {
      ownerKind: 'actor',
      ownerId: Number(character.id),
      ownerName: character.name ?? null,
      publicActionId: Number(entry.skillId),
      actionKind: entry.kind,
      name: entry.label,
      publicVariantIndex: entry.actionVariantIndex,
      schedulable: mapping?.schedulable ?? false,
      sourceEvidenceStatus: mapping?.sourceEvidenceStatus ?? 'unresolved',
      scenarioRuntimeStatus: mapping?.scenarioRuntimeStatus ?? 'unresolved',
      durationFrames: mapping?.actionTiming?.occupancy?.durationFrames ?? null,
      attackInputs: (mapping?.attackInputSegments ?? []).map(segment => ({
        sequenceIndex: segment.sequenceIndex,
        sequenceTotal: segment.sequenceTotal,
        label: segment.label,
        chainIdentity:
          segment.attackInputChainIdentity ??
          mapping.attackInputChainIdentity ??
          null,
        durationFrames:
          segment.effectiveDurationFrames ?? segment.durationFrames ?? null,
        linkTimingStatus: segment.linkTimingStatus ?? null,
        linkWindow: segment.linkWindow
          ? {
              startFrame: segment.linkWindow.startFrame ?? null,
              endFrame: segment.linkWindow.endFrame ?? null,
              targetControlSkillId:
                segment.linkWindow.targetControlSkillId ?? null,
              targetSubSkillIndex:
                segment.linkWindow.targetSubSkillIndex ?? null,
              allowAttack: segment.linkWindow.allowAttack ?? null,
              sourceIdentity: segment.linkWindow.sourceIdentity ?? null,
            }
          : null,
        hitIdentities: segment.selectedHitIdentities ?? [],
      })),
      hitIdentities: collectMappingHitIdentities(mapping ?? {}),
      semanticVariants: collectSemanticVariants(character.id, entry, mapping),
      mappingIdentity: mapping?.identity ?? null,
      optimizationScenario: classifyOptimizationScenarioActionKind(entry.kind),
      optimizationRoster: classifyOptimizationCandidateCharacter(character.id),
    };
  });
}

function validateSourceDataIdentity(contract) {
  const mechanicsPackage = getInstalledVerifiedCombatMechanicsPackage();
  if (!mechanicsPackage) {
    return [
      createMachineAxisDiagnostic(
        'machine-axis-mechanics-package-not-installed',
        'dataIdentity',
        'Verified combat mechanics package is not installed'
      ),
    ];
  }
  const issues = [];
  if (
    contract.dataIdentity.verifiedMechanicsPackageId !==
    mechanicsPackage.packageId
  ) {
    issues.push(
      createMachineAxisDiagnostic(
        'machine-axis-data-package-id-mismatch',
        'dataIdentity.verifiedMechanicsPackageId',
        'Machine Axis package identity does not match installed data'
      )
    );
  }
  if (
    contract.dataIdentity.verifiedMechanicsPackageHash !==
    mechanicsPackage.packageHash
  ) {
    issues.push(
      createMachineAxisDiagnostic(
        'machine-axis-data-package-hash-mismatch',
        'dataIdentity.verifiedMechanicsPackageHash',
        'Machine Axis package hash does not match installed data'
      )
    );
  }
  return issues;
}

function validateCompiledDataIdentity(contract, actual) {
  return actual.mechanicsProfileId === contract.dataIdentity.mechanicsProfileId
    ? []
    : [
        createMachineAxisDiagnostic(
          'machine-axis-mechanics-profile-mismatch',
          'dataIdentity.mechanicsProfileId',
          `Resolved profile ${actual.mechanicsProfileId} does not match requested profile ${contract.dataIdentity.mechanicsProfileId}`
        ),
      ];
}

function collectExecutionIssues(run, actionResolutions) {
  const resolutionByActionId = new Map(
    actionResolutions.map(entry => [String(entry.actionId), entry])
  );
  const blocksByActionId = new Map();
  for (const block of run.simulation?.verifiedCombatRuntime?.executionBlocks ??
    []) {
    const actionId = String(block.actionId);
    const blocks = blocksByActionId.get(actionId) ?? [];
    blocks.push(block);
    blocksByActionId.set(actionId, blocks);
  }
  return (run.trace.executionPlan.actions ?? []).flatMap((entry, planIndex) => {
    const actionId = String(entry.actionId);
    const resolution = resolutionByActionId.get(actionId);
    if (!resolution || entry.execute !== false) return [];
    const blocks = blocksByActionId.get(actionId) ?? [];
    if (blocks.length > 0) {
      return blocks.map((block, blockIndex) =>
        createExecutionBlockIssue({
          block,
          blockIndex,
          actionId,
          entry,
          planIndex,
          resolution,
        })
      );
    }
    return [
      createMachineAxisDiagnostic(
        'machine-axis-action-not-executable',
        `executionPlan.actions.${planIndex}`,
        `Action ${actionId} is not executable: ${entry.skipReason ?? entry.status}`,
        {
          actionId,
          reason: entry.skipReason ?? entry.status,
          violationCodes: entry.violationCodes ?? [],
          diagnosticIds: entry.diagnosticIds ?? [],
        }
      ),
    ];
  });
}

function collectContextWindowConflictIssues({ contract, project }) {
  const issues = [];
  const projectActionByContractId = new Map(
    (project?.actions ?? []).map(action => [String(action.id), action])
  );
  const mechanicsPackage = requireMechanicsPackage();
  const actions = contract?.actions ?? [];
  const characterIdBySlotId = new Map(
    (contract?.scenario?.team ?? []).map(slot => [
      String(slot.slotId),
      Number(slot.characterId),
    ])
  );
  for (const action of actions) {
    const attackInput = action.intent?.attackInput ?? {};
    const contextActionId = attackInput.contextActionId;
    if (!contextActionId || action.intent?.actionKind !== 'normal-attack') {
      continue;
    }
    const previousContractAction = actions.find(
      candidate => String(candidate.id) === String(contextActionId)
    );
    const previousProjectAction = projectActionByContractId.get(
      String(contextActionId)
    );
    if (!previousContractAction || !previousProjectAction) continue;
    const chainIdentity =
      previousContractAction.intent?.attackInput?.chainIdentity ??
      previousProjectAction.attackInputChainIdentity ??
      previousProjectAction.attackInput?.attackInputChainIdentity ??
      null;
    if (!String(chainIdentity).startsWith('context-form:')) continue;
    const mapping = getVerifiedCombatActionMapping({
      type: ACTION_TYPES.SKILL,
      skillId: action.intent?.publicActionId,
      actionKind: action.intent?.actionKind,
      actor: {
        characterId: (() => {
          const bySlot = characterIdBySlotId.get(
            String(action.owner?.slotId ?? '')
          );
          if (Number.isInteger(bySlot)) return bySlot;
          const actorCharacterId = Number(action.actorCharacterId);
          return Number.isFinite(actorCharacterId) ? actorCharacterId : null;
        })(),
      },
    });
    const contextSegments = (mapping?.profileAttackInputSegments ?? []).filter(
      segment =>
        String(segment.attackInputChainIdentity ?? '') ===
          String(chainIdentity) &&
        Number(segment.sequenceIndex) ===
          Number(
            previousContractAction.intent?.attackInput?.sequenceIndex ??
              previousProjectAction.attackSequenceIndex
          )
    );
    if (contextSegments.length !== 1) continue;
    const contextSegment = contextSegments[0];
    const sourceControlSkillId = Number(
      contextSegment.executionControlSkillId ?? contextSegment.controlSkillId
    );
    const sourceSubSkillIndex = Number(
      contextSegment.selectedSubSkillIndex ??
        contextSegment.subSkillIndex ??
        0
    );
    const contextFrame = absoluteScheduleFrame(previousContractAction);
    const actionFrame = absoluteScheduleFrame(action);
    if (!Number.isFinite(contextFrame) || !Number.isFinite(actionFrame)) {
      continue;
    }
    const offsetFrames = Number(actionFrame) - Number(contextFrame);
    const edges = (
      mechanicsPackage.actionVariantGraph?.contextEdges ?? []
    ).filter(
      edge =>
        edge.applied === true &&
        Number(edge.sourceControlSkillId) === sourceControlSkillId &&
        Number(edge.sourceSubSkillIndex) === sourceSubSkillIndex &&
        String(edge.inputCommand ?? '') ===
          String(action.intent?.actionKind) &&
        offsetFrames >= Number(edge.inputWindow?.startFrame) &&
        offsetFrames < Number(edge.inputWindow?.endFrame)
    );
    if (edges.length === 0) continue;
    const projectAction = projectActionByContractId.get(String(action.id));
    const requestedControlSkillId = Number(
      projectAction?.attackInput?.controlSkillId ??
        projectAction?.controlSubSkillId ??
        action.intent?.publicActionId
    );
    const requestedSubSkillIndex = Number(
      projectAction?.attackInput?.selectedSubSkillIndex ??
        projectAction?.controlSubSkillIndex ??
        0
    );
    const matched = edges.some(
      edge =>
        Number(edge.targetControlSkillId) === requestedControlSkillId &&
        Number(edge.targetSubSkillIndex) === requestedSubSkillIndex
    );
    if (matched) continue;
    issues.push(
      createMachineAxisDiagnostic(
        'machine-axis-normal-attack-context-window-conflict',
        `actions.${actions.indexOf(action)}.intent.attackInput.sequenceIndex`,
        'Normal attack input falls inside an open derived window but targets a different form',
        {
          actionId: action.id,
          contextActionId,
          sourceControlSkillId,
          sourceSubSkillIndex,
          requestedControlSkillId,
          requestedSubSkillIndex,
          expectedTargetControlSkillIds: [
            ...new Set(edges.map(edge => Number(edge.targetControlSkillId))),
          ],
          expectedTargetSubSkillIndexes: [
            ...new Set(edges.map(edge => Number(edge.targetSubSkillIndex))),
          ],
          inputWindow: edges[0].inputWindow,
          offsetFrames,
        }
      )
    );
  }
  return issues;
}

function createExecutionBlockIssue({
  block,
  blockIndex,
  actionId,
  entry,
  planIndex,
  resolution,
}) {
  const path = `executionPlan.actions.${planIndex}.blocks.${blockIndex}`;
  const blockCode = String(block.code ?? 'machine-axis-action-not-executable');
  const isResourceBlock = [
    'verified-resource-cost-unavailable',
    'VERIFIED_SPECIAL_RESOURCE_INSUFFICIENT',
  ].includes(blockCode);
  if (!isResourceBlock) {
    const unresolved = block.status === 'unresolved';
    return createMachineAxisDiagnostic(
      unresolved
        ? 'machine-axis-action-conditions-unresolved'
        : 'machine-axis-action-not-executable',
      path,
      unresolved
        ? `Action ${actionId} has an unresolved execution condition: ${block.reason ?? blockCode}`
        : `Action ${actionId} is blocked by ${block.reason ?? blockCode}`,
      {
        actionId,
        actorId: block.actorId ?? null,
        reason: block.reason ?? entry.skipReason ?? entry.status,
        sourceIdentity: block.sourceIdentity ?? null,
        sourceSequencePath: block.sourceSequencePath ?? null,
        ...(unresolved
          ? { unresolvedCodes: [blockCode] }
          : { violationCodes: [blockCode] }),
      }
    );
  }

  const ownerKind = block.ownerKind ?? resolution.ownerKind ?? 'actor';
  const ownerId = Number(
    block.ownerId ??
      (ownerKind === 'kibo'
        ? (block.kiboId ?? resolution.ownerId)
        : resolution.ownerId)
  );
  const resourceKind =
    block.resourceKind ??
    (ownerKind === 'kibo'
      ? 'kibo-energy'
      : block.resourceName
        ? 'special-resource'
        : 'actor-sp');
  const resourceIdentity =
    block.resourceIdentity ??
    `${ownerKind}:${Number.isFinite(ownerId) ? ownerId : 'unknown'}:${resourceKind}`;
  const currentValue = Number(block.currentValue);
  const requiredValue = Number(block.requiredValue);
  const insufficient =
    ['blocked', 'violated'].includes(String(block.status)) &&
    Number.isFinite(currentValue) &&
    Number.isFinite(requiredValue) &&
    currentValue < requiredValue;
  return createMachineAxisDiagnostic(
    insufficient
      ? 'machine-axis-action-resource-insufficient'
      : 'machine-axis-action-resource-unresolved',
    path,
    insufficient
      ? `Action ${actionId} requires ${block.requiredValue} ${resourceKind}, current ${block.currentValue}/${block.maxValue}`
      : `Action ${actionId} resource precondition is unresolved: ${block.reason ?? blockCode}`,
    {
      actionId,
      actorId: block.actorId ?? null,
      ownerKind,
      ownerId: Number.isFinite(ownerId) ? ownerId : null,
      resourceOwnerKind: ownerKind,
      resourceOwnerId: Number.isFinite(ownerId) ? ownerId : null,
      resourceIdentity,
      resourceKind,
      currentValue: block.currentValue ?? null,
      requiredValue: block.requiredValue ?? null,
      maxValue: block.maxValue ?? null,
      valueUnit: block.valueUnit ?? 'runtime-resource-points',
      reason: block.reason ?? entry.skipReason ?? entry.status,
      sourceIdentity: block.sourceIdentity ?? null,
      sourceSequencePath: block.sourceSequencePath ?? null,
      canonicalDiagnosticCode: block.code ?? null,
    }
  );
}

function collectExecutionWarnings({ compilation, run }) {
  const warnings = [];
  const seen = new Set();
  const add = warning => {
    const key = [
      warning.code,
      warning.actionId ?? '',
      warning.path ?? '',
      warning.reason ?? '',
    ].join('|');
    if (seen.has(key)) return;
    seen.add(key);
    warnings.push({ ...warning, severity: 'warning' });
  };
  for (const warning of compilation.canonicalCompilation.scenario.diagnostics
    ?.validationWarnings ?? []) {
    if (warning && typeof warning === 'object') {
      add({
        code: warning.code ?? 'machine-axis-canonical-validation-warning',
        path: warning.path ?? 'scenario',
        message: warning.message ?? String(warning.reason ?? warning.code),
        ...warning,
      });
    } else {
      add({
        code: 'machine-axis-canonical-validation-warning',
        path: 'scenario',
        message: String(warning),
      });
    }
  }
  for (const resolution of compilation.actionResolutions ?? []) {
    const sourceEvidenceStatus = String(resolution.sourceEvidenceStatus ?? '');
    const scenarioRuntimeStatus = String(
      resolution.scenarioRuntimeStatus ?? ''
    );
    const variantResolutionStatus = String(
      resolution.variantResolutionStatus ?? ''
    );
    if (isEvidenceOpenStatus(sourceEvidenceStatus)) {
      add({
        code: 'machine-axis-source-evidence-open',
        path: `actions.${resolution.index ?? 0}`,
        actionId: resolution.actionId,
        sourceEvidenceStatus,
        reason: sourceEvidenceStatus,
        message: `Action ${resolution.actionId} has open source evidence: ${sourceEvidenceStatus}`,
      });
    }
    if (isScenarioAssumptionStatus(scenarioRuntimeStatus)) {
      add({
        code: 'machine-axis-scenario-assumption',
        path: `actions.${resolution.index ?? 0}`,
        actionId: resolution.actionId,
        scenarioRuntimeStatus,
        reason: scenarioRuntimeStatus,
        message: `Action ${resolution.actionId} is runnable under scenario assumption: ${scenarioRuntimeStatus}`,
      });
    } else if (isEvidenceOpenStatus(scenarioRuntimeStatus)) {
      add({
        code: 'machine-axis-scenario-runtime-evidence-open',
        path: `actions.${resolution.index ?? 0}`,
        actionId: resolution.actionId,
        scenarioRuntimeStatus,
        reason: scenarioRuntimeStatus,
        message: `Action ${resolution.actionId} has open scenario runtime evidence: ${scenarioRuntimeStatus}`,
      });
    }
    if (isEvidenceOpenStatus(variantResolutionStatus)) {
      add({
        code: 'machine-axis-variant-resolution-open',
        path: `actions.${resolution.index ?? 0}.intent.semanticVariant`,
        actionId: resolution.actionId,
        variantResolutionStatus,
        reason: variantResolutionStatus,
        message: `Action ${resolution.actionId} variant resolution remains open: ${variantResolutionStatus}`,
      });
    }
  }
  for (const [planIndex, entry] of (
    run.trace.executionPlan.actions ?? []
  ).entries()) {
    if (entry.status !== 'scheduled-with-unresolved-conditions') continue;
    add({
      code: 'machine-axis-action-conditions-unresolved',
      path: `executionPlan.actions.${planIndex}`,
      actionId: entry.actionId,
      unresolvedCodes: entry.unresolvedCodes ?? [],
      reason: entry.readinessStatus ?? entry.status,
      message: `Action ${entry.actionId} executes with unresolved conditions`,
    });
  }
  for (const group of groupSimultaneousCrossOwnerActions(
    compilation.actionResolutions,
    compilation.canonicalCompilation.scenario
  )) {
    add({
      code: 'machine-axis-same-frame-order-unresolved',
      path: 'actions',
      absoluteFrame: group.absoluteFrame,
      actionIds: group.actionIds,
      ownerKinds: group.ownerKinds,
      reason: 'same-frame-cross-owner-order-not-specified',
      message: `Same-frame actor/kibo order at frame ${group.absoluteFrame} is not specified`,
    });
  }
  return warnings;
}

function createMachineAxisValidationClassification({ issues, warnings }) {
  if (issues.length > 0) {
    return {
      schemaStatus: 'schema-valid',
      runnabilityStatus: 'not-runnable',
      evidenceStatus: 'not-evaluated',
    };
  }
  const hasAssumptions = warnings.some(warning =>
    [
      'machine-axis-scenario-assumption',
      'machine-axis-action-conditions-unresolved',
      'machine-axis-same-frame-order-unresolved',
    ].includes(warning.code)
  );
  return {
    schemaStatus: 'schema-valid',
    runnabilityStatus:
      warnings.length > 0 || hasAssumptions
        ? 'runnable-with-assumptions'
        : 'runnable',
    evidenceStatus: warnings.length > 0 ? 'evidence-open' : 'evidence-closed',
  };
}

function createFailedMachineAxisValidationClassification(issues) {
  const schemaInvalid = issues.some(issue => isRawSchemaIssueCode(issue.code));
  return {
    schemaStatus: schemaInvalid ? 'schema-invalid' : 'schema-valid',
    runnabilityStatus: 'not-runnable',
    evidenceStatus: 'not-evaluated',
  };
}

function isRawSchemaIssueCode(code) {
  return (
    String(code).startsWith('machine-axis-schema-') ||
    [
      'machine-axis-contract-invalid',
      'machine-axis-contract-name-unsupported',
      'machine-axis-kind-unsupported',
      'machine-axis-fps-unsupported',
    ].includes(code)
  );
}

function groupSimultaneousCrossOwnerActions(
  actionResolutions = [],
  scenario = {}
) {
  const byFrame = new Map();
  const actions = scenario.actions ?? [];
  const actionById = new Map(
    actions.map(action => [String(action.id), action])
  );
  const actionIndexById = new Map(
    actions.map((action, index) => [String(action.id), index])
  );
  const actorById = new Map(
    (scenario.actors ?? []).map(actor => [String(actor.id), actor])
  );
  for (const resolution of actionResolutions) {
    if (!Number.isInteger(resolution.startFrame)) continue;
    if (!['actor', 'kibo'].includes(resolution.ownerKind)) continue;
    const group = byFrame.get(resolution.startFrame) ?? [];
    group.push(resolution);
    byFrame.set(resolution.startFrame, group);
  }
  return [...byFrame.entries()].flatMap(([absoluteFrame, entries]) => {
    const remaining = new Set(entries);
    for (const actorEntry of entries.filter(
      entry => entry.ownerKind === 'actor'
    )) {
      const actorAction = actionById.get(String(actorEntry.actionId));
      if (actorAction?.actionKind !== 'star-combo') continue;
      for (const kiboEntry of entries.filter(
        entry => entry.ownerKind === 'kibo' && remaining.has(entry)
      )) {
        const kiboAction = actionById.get(String(kiboEntry.actionId));
        const pair = createVerifiedJointAttackRuntimePair({
          actorAction,
          kiboAction,
          actor: actorById.get(String(actorAction?.actorId)),
          scenario,
          fps: Number(scenario.time?.fps) || 60,
          actorActionIndex: actionIndexById.get(String(actorEntry.actionId)),
          kiboActionIndex: actionIndexById.get(String(kiboEntry.actionId)),
        });
        if (!pair.ready) continue;
        remaining.delete(actorEntry);
        remaining.delete(kiboEntry);
        break;
      }
    }
    const unresolvedEntries = [...remaining];
    const ownerKinds = [
      ...new Set(unresolvedEntries.map(entry => entry.ownerKind)),
    ];
    if (!(ownerKinds.includes('actor') && ownerKinds.includes('kibo'))) {
      return [];
    }
    return [
      {
        absoluteFrame,
        actionIds: unresolvedEntries.map(entry => entry.actionId),
        ownerKinds: unresolvedEntries.map(entry => entry.ownerKind),
      },
    ];
  });
}

function isScenarioAssumptionStatus(status) {
  return status.startsWith('scenario-assumed-');
}

function isEvidenceOpenStatus(status) {
  if (!status) return false;
  return [
    'unresolved',
    'runtime-dependent',
    'runtime-evidence',
    'static-evidence-gap',
    'not-yet-modeled',
    'partially-resolved',
  ].some(token => status.includes(token));
}

function createMachineAxisComparison(left, right) {
  const leftDamage = indexDamage(left.trace.damage);
  const rightDamage = indexDamage(right.trace.damage);
  const hitKeys = [...new Set([...leftDamage.keys(), ...rightDamage.keys()])];
  return {
    schemaVersion: MACHINE_AXIS_SERVICE_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_SERVICE_CONTRACT_NAME,
    kind: 'azpr-machine-axis-comparison',
    left: { hashes: left.hashes, evaluation: left.evaluation },
    right: { hashes: right.hashes, evaluation: right.evaluation },
    delta: subtractNumericRecords(
      right.evaluation.totals,
      left.evaluation.totals
    ),
    actions: compareIdentityRows(
      left.evaluation.byAction,
      right.evaluation.byAction
    ),
    hits: hitKeys
      .sort((a, b) => a.localeCompare(b, 'en'))
      .map(identity => ({
        identity,
        left: leftDamage.get(identity) ?? null,
        right: rightDamage.get(identity) ?? null,
        delta: subtractNumericRecords(
          rightDamage.get(identity),
          leftDamage.get(identity)
        ),
      })),
  };
}

function indexDamage(events = []) {
  const result = new Map();
  for (const event of events) {
    const identity = `${event.actionId}|${event.hitIdentity ?? event.hitKey ?? event.hitIndex}`;
    const row = result.get(identity) ?? {
      identity,
      actionId: event.actionId,
      hitIdentity: event.hitIdentity ?? null,
      hitCount: 0,
      hpDamage: 0,
      toughnessDamage: 0,
    };
    row.hitCount += 1;
    row.hpDamage += Number(event.rawDamage) || 0;
    row.toughnessDamage += Number(event.toughnessDamage) || 0;
    result.set(identity, row);
  }
  return result;
}

function compareIdentityRows(leftRows = [], rightRows = []) {
  const left = new Map(leftRows.map(row => [row.identity, row]));
  const right = new Map(rightRows.map(row => [row.identity, row]));
  return [...new Set([...left.keys(), ...right.keys()])]
    .sort((a, b) => a.localeCompare(b, 'en'))
    .map(identity => ({
      identity,
      left: left.get(identity) ?? null,
      right: right.get(identity) ?? null,
      delta: subtractNumericRecords(right.get(identity), left.get(identity)),
    }));
}

function subtractNumericRecords(right = null, left = null) {
  const keys = new Set([
    ...Object.keys(right ?? {}),
    ...Object.keys(left ?? {}),
  ]);
  return Object.fromEntries(
    [...keys]
      .filter(
        key =>
          typeof right?.[key] === 'number' || typeof left?.[key] === 'number'
      )
      .map(key => [
        key,
        (Number(right?.[key]) || 0) - (Number(left?.[key]) || 0),
      ])
  );
}

function normalizeSearchTeamCandidates(value, contract) {
  if (value == null) {
    return [
      {
        id: 'fixed-team',
        team: contract.scenario.team,
        initialRuntimeState: contract.scenario.initialRuntimeState,
        fixed: true,
      },
    ];
  }
  if (!Array.isArray(value) || value.length === 0) {
    throw new MachineAxisValidationError([
      createMachineAxisDiagnostic(
        'machine-axis-search-team-candidates-invalid',
        'teamCandidates',
        'teamCandidates must be a non-empty array'
      ),
    ]);
  }
  const seen = new Set();
  return value.map((entry, index) => {
    const id = String(entry?.id ?? '').trim();
    const projected = projectSearchTeamCandidate(entry, contract);
    if (!id || seen.has(id) || projected == null) {
      throw new MachineAxisValidationError([
        createMachineAxisDiagnostic(
          'machine-axis-search-team-candidate-invalid',
          `teamCandidates.${index}`,
          'Each team candidate requires a unique id and either a complete team or a valid slotOrder',
          { teamCandidateId: id || null }
        ),
      ]);
    }
    seen.add(id);
    return {
      id,
      team: projected.team,
      initialRuntimeState:
        entry.initialRuntimeState == null
          ? projected.initialRuntimeState
          : structuredClone(entry.initialRuntimeState),
      metadata: structuredClone(entry.metadata ?? {}),
      fixed: false,
    };
  });
}

function projectSearchTeamCandidate(entry, contract) {
  if (Array.isArray(entry?.team)) {
    return {
      team: structuredClone(entry.team),
      initialRuntimeState: structuredClone(
        contract.scenario.initialRuntimeState
      ),
    };
  }
  if (!Array.isArray(entry?.slotOrder)) return null;
  const baseTeam = contract.scenario.team ?? [];
  if (entry.slotOrder.length !== baseTeam.length) return null;
  const sourceBySlot = new Map(
    baseTeam.map(slot => [String(slot.slotId), slot])
  );
  const unique = new Set(entry.slotOrder.map(String));
  if (unique.size !== baseTeam.length) return null;
  const sourceToTargetSlot = new Map();
  const team = entry.slotOrder.map((sourceSlotId, index) => {
    const source = sourceBySlot.get(String(sourceSlotId));
    if (!source) return null;
    const targetSlotId = baseTeam[index].slotId;
    sourceToTargetSlot.set(String(sourceSlotId), targetSlotId);
    return { ...structuredClone(source), slotId: targetSlotId };
  });
  if (team.some(slot => slot == null)) return null;
  const initialRuntimeState = structuredClone(
    contract.scenario.initialRuntimeState ?? {}
  );
  if (Array.isArray(initialRuntimeState.kiboEnergyBySlot)) {
    initialRuntimeState.kiboEnergyBySlot =
      initialRuntimeState.kiboEnergyBySlot.map(resource => ({
        ...resource,
        slotId:
          sourceToTargetSlot.get(String(resource.slotId)) ?? resource.slotId,
      }));
  }
  return { team, initialRuntimeState };
}

function applySearchTeamCandidate(contract, candidate) {
  if (candidate.fixed) return contract;
  return {
    ...contract,
    scenario: {
      ...(contract.scenario ?? {}),
      id: `${contract.scenario?.id ?? 'search'}--team-${candidate.id}`,
      name: `${contract.scenario?.name ?? 'Search'} [${candidate.id}]`,
      team: candidate.team,
      initialRuntimeState: candidate.initialRuntimeState,
    },
    metadata: {
      ...(contract.metadata ?? {}),
      searchTeamCandidate: {
        id: candidate.id,
        ...candidate.metadata,
      },
    },
  };
}

function applySearchObjectiveContract(contract, objectiveContract) {
  return {
    ...contract,
    scenario: {
      ...(contract.scenario ?? {}),
      objectiveContract: structuredClone(objectiveContract),
      ...(objectiveContract.targetPolicy == null
        ? {}
        : { target: structuredClone(objectiveContract.targetPolicy) }),
    },
  };
}

function aggregateSearchSummaries({
  summaries,
  options,
  teamCandidates,
  teamFailures,
  wallTimeMs,
  horizonFrames,
}) {
  const sum = key =>
    summaries.reduce(
      (total, summary) => total + Number(summary?.[key] ?? 0),
      0
    );
  return {
    steps: summaries.reduce(
      (maximum, summary) => Math.max(maximum, Number(summary?.steps ?? 0)),
      0
    ),
    candidatesEvaluated: sum('candidatesEvaluated'),
    invalidCandidates: sum('invalidCandidates'),
    mergedCandidates: sum('mergedCandidates'),
    prunedCandidates: sum('prunedCandidates'),
    expandedCandidates: sum('expandedCandidates'),
    completedCandidates: sum('completedCandidates'),
    formalSurfaceRejectedCandidates: sum('formalSurfaceRejectedCandidates'),
    rejectionCounts: Object.fromEntries(
      [
        ...new Set(
          summaries.flatMap(summary =>
            Object.keys(summary?.rejectionCounts ?? {})
          )
        ),
      ]
        .sort((left, right) => left.localeCompare(right, 'en'))
        .map(code => [
          code,
          summaries.reduce(
            (total, summary) =>
              total + Number(summary?.rejectionCounts?.[code] ?? 0),
            0
          ),
        ])
    ),
    rejectionExamples: [
      ...new Map(
        summaries
          .flatMap(summary => summary?.rejectionExamples ?? [])
          .map(example => [JSON.stringify(example), example])
      ).values(),
    ]
      .sort(
        (left, right) =>
          String(left.code).localeCompare(String(right.code), 'en') ||
          String(left.path).localeCompare(String(right.path), 'en') ||
          String(left.actionId ?? '').localeCompare(
            String(right.actionId ?? ''),
            'en'
          )
      )
      .slice(0, 8),
    wallTimeMs,
    beamWidth: options.beamWidth,
    topN: options.topN,
    objective: options.objective,
    horizonFrames,
    teamCandidatesEvaluated: teamCandidates.length,
    teamCandidateSuccessCount: Math.max(
      0,
      teamCandidates.length - teamFailures.length
    ),
    teamCandidateFailureCount: teamFailures.length,
    teamCandidateIds: teamCandidates.map(entry => entry.id),
    teamCandidateFailures: teamFailures,
  };
}

function normalizeMachineAxisIssues(error) {
  if (Array.isArray(error?.issues)) return error.issues;
  return [
    createMachineAxisDiagnostic(
      'machine-axis-internal-error',
      '',
      error?.message ?? String(error)
    ),
  ];
}

function dedupeMachineAxisIssues(issues) {
  const uniqueIssues = new Map();
  for (const issue of issues ?? []) {
    const key = JSON.stringify({
      code: issue?.code ?? null,
      path: issue?.path ?? null,
      actionId: issue?.actionId ?? null,
      resourceIdentity: issue?.resourceIdentity ?? null,
      targetId: issue?.targetId ?? null,
    });
    if (!uniqueIssues.has(key)) uniqueIssues.set(key, issue);
  }
  return [...uniqueIssues.values()];
}

function findInstalledHitByIdentity(hitIdentity) {
  const mechanicsPackage = getInstalledVerifiedCombatMechanicsPackage();
  const bindings = [
    ...(mechanicsPackage?.controlBindings ?? []),
    ...(mechanicsPackage?.actionVariantControlBindings ?? []),
  ];
  for (const binding of bindings) {
    const hit = (binding.hits ?? []).find(
      entry => entry.hitIdentity === hitIdentity
    );
    if (hit) return hit;
  }
  const conditionalMatch = String(hitIdentity ?? '').match(
    /^conditional-damage:(.+):(\d+)$/
  );
  if (conditionalMatch) {
    const group = (
      mechanicsPackage?.actionVariantGraph?.tuningMarkConditionalDamageGroups ??
      []
    ).find(candidate => candidate.groupIdentity === conditionalMatch[1]);
    if (group) {
      const hitCount =
        Math.max(1, group.triggerFrames?.length ?? 0) *
        Math.max(1, group.hitDelaysMs?.length ?? 0);
      const hitIndex = Number(conditionalMatch[2]);
      if (hitIndex >= 1 && hitIndex <= hitCount) {
        return {
          hitIdentity,
          damage: group.baseTemplate ?? group.enhancedTemplate ?? null,
          sourceIdentity: group.sourceIdentity ?? null,
        };
      }
    }
  }
  return null;
}

function isHitCriticalEligible(hit) {
  return ![6, 10].includes(Number(hit?.damage?.damageType));
}

function collectCriticalStateEffectIdentities(hit) {
  return [
    ...new Set(
      [
        ...(hit?.criticalStateEffectIdentities ?? []),
        ...(hit?.damage?.criticalStateEffectIdentities ?? []),
      ]
        .map(value => String(value ?? '').trim())
        .filter(Boolean)
    ),
  ];
}
function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function nonNegativeIntegerOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function pickDefined(source, keys) {
  const result = {};
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null) result[key] = value;
  }
  return result;
}

function requireMechanicsPackage() {
  const mechanicsPackage = getInstalledVerifiedCombatMechanicsPackage();
  if (!mechanicsPackage) {
    throw new MachineAxisValidationError([
      createMachineAxisDiagnostic(
        'machine-axis-mechanics-package-not-installed',
        '',
        'Verified combat mechanics package is not installed'
      ),
    ]);
  }
  return mechanicsPackage;
}
