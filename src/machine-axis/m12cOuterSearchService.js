import { AZPR_DEFAULT_EFFECTIVE_MAX_SP } from '../domain/spUnitContract.js';
import { createVerifiedJointAttackRuntimeBinding } from '../domain/verifiedJointAttackRuntimeContract.js';
import { getInstalledVerifiedCombatMechanicsPackage } from '../data/verifiedCombatMechanicsPackage';
import { createOptimizationScenarioPolicyBinding } from '../optimization-scenario/optimizationScenarioPolicy';
import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization.js';
import { createMachineAxisService } from './machineAxisService';
import {
  MACHINE_AXIS_PRIMARY_OBJECTIVE_IDS,
  createMachineAxisObjectiveContract,
} from './machineAxisObjectiveContract';
import {
  createMachineAxisSearchEngine,
  normalizeSearchOptions,
  selectTopN,
} from './machineAxisSearchEngine';
import { createMachineAxisSearchReport } from './machineAxisSearchReport';
import {
  applySearchGuidance,
  normalizeSearchGuidance,
} from './machineAxisSearchGuidance';
import { createM12cInitialStatePresetBinding } from './m12cInitialStatePolicy';
import {
  M12C_OPTIONAL_OPTIMIZATION_OBJECT_IDS,
  M12C_REQUIRED_OPTIMIZATION_OBJECT_ID,
  validateM12cBuildCandidate,
} from './m12cOuterBuildPool';
import { createM12cOuterBuildService } from './m12cOuterBuildService';

export const M12C_OUTER_SEARCH_SCHEMA_VERSION = 1;
export const M12C_OUTER_SEARCH_REQUEST_CONTRACT_NAME =
  'AzPrM12COuterSearchRequest';
export const M12C_OUTER_SEARCH_REPORT_CONTRACT_NAME =
  'AzPrM12COuterSearchReport';
export const M12C_OUTER_SEARCH_KIND = 'azpr-m12c-outer-search';
export const M12C_OUTER_SEARCH_REPORT_KIND = 'azpr-m12c-outer-search-report';
export const M12C_OUTER_SEARCH_ENEMY_ID = 310054;
export const M12C_OUTER_SEARCH_ENEMY_LEVEL = 80;

const DEFAULT_OUTER_OPTIONS = Object.freeze({
  maxSourceConfigs: 35,
  maxBuildsPerSourceConfig: 1,
  maxBuildsTotal: 35,
  maxVariantSearches: 105,
  initialFrontPolicy: 'all-team-members',
});
const OUTER_INTEGER_FIELDS = Object.freeze([
  'maxSourceConfigs',
  'maxBuildsPerSourceConfig',
  'maxBuildsTotal',
  'maxVariantSearches',
]);
const ROSTER_OBJECT_IDS = new Set([
  M12C_REQUIRED_OPTIMIZATION_OBJECT_ID,
  ...M12C_OPTIONAL_OPTIMIZATION_OBJECT_IDS,
]);
const SUMMARY_COUNTER_FIELDS = Object.freeze([
  'steps',
  'candidatesEvaluated',
  'invalidCandidates',
  'mergedCandidates',
  'prunedCandidates',
  'expandedCandidates',
  'completedCandidates',
  'formalSurfaceRejectedCandidates',
]);
const OUTER_REPORT_SAMPLE_LIMIT = 1_000;

export class M12cOuterSearchError extends Error {
  constructor(message, issues = []) {
    super(message);
    this.name = 'M12cOuterSearchError';
    this.issues = normalizeIssues(issues);
  }
}

export function createM12cOuterSearchService({
  machineAxisService = createMachineAxisService(),
  outerBuildService = createM12cOuterBuildService(),
  createSearchEngine = options => createMachineAxisSearchEngine(options),
  createSearchReport = createMachineAxisSearchReport,
  getMechanicsPackage = getInstalledVerifiedCombatMechanicsPackage,
} = {}) {
  if (
    !machineAxisService ||
    typeof machineAxisService.prepare !== 'function' ||
    typeof machineAxisService.simulate !== 'function'
  ) {
    throw new TypeError(
      'M12-C outer search requires a Machine Axis service with prepare and simulate'
    );
  }
  if (
    !outerBuildService ||
    typeof outerBuildService.pool !== 'function' ||
    typeof outerBuildService.plan !== 'function' ||
    typeof outerBuildService.iterate !== 'function'
  ) {
    throw new TypeError(
      'M12-C outer search requires the authoritative outer build service'
    );
  }

  let cachedEnemyProfile = null;
  let cachedEnemyProfileKey = null;
  let cachedBuildValidation = null;
  let cachedBuildValidationKey = null;

  async function bind({
    contract,
    build,
    objective,
    initialFrontOptimizationObjectId,
    initialState = {},
  } = {}) {
    const pool = outerBuildService.pool();
    const mechanicsPackage = requireMechanicsPackage(getMechanicsPackage);
    assertTemplateBoundary(contract, mechanicsPackage);
    assertPrimaryObjective(objective);
    assertInitialStateInput(initialState);
    const buildValidationKey = `${pool.poolHash}:${hashCanonicalValue(build)}`;
    if (
      !cachedBuildValidation ||
      cachedBuildValidationKey !== buildValidationKey
    ) {
      cachedBuildValidation = validateM12cBuildCandidate(build, { pool });
      cachedBuildValidationKey = buildValidationKey;
    }
    const buildValidation = cachedBuildValidation;
    if (!buildValidation.scoreable) {
      throw new M12cOuterSearchError(
        'M12-C outer search build is not scoreable',
        buildValidation.issues
      );
    }
    assertInitialStateForBuild(initialState, build);
    const initialFront = resolveInitialFront(
      build,
      initialFrontOptimizationObjectId
    );
    const enemyProfile = await resolveEnemyProfile({
      contract,
      build,
      objective,
      initialFront,
      initialState,
      pool,
      mechanicsPackage,
    });
    const boundContract = createM12cBuildSearchContract({
      contractTemplate: contract,
      build,
      objective,
      initialFrontOptimizationObjectId: initialFront.optimizationObjectId,
      initialState,
      mechanicsPackage,
      qualificationCatalogHash: pool.authority.qualificationCatalogHash,
      enemyProfile,
      qualificationMode: 'formal',
    });
    const prepared = machineAxisService.prepare(boundContract);
    if (prepared.valid !== true) {
      throw new M12cOuterSearchError(
        'M12-C build could not enter formal inner search',
        prepared.issues
      );
    }
    return {
      schemaVersion: M12C_OUTER_SEARCH_SCHEMA_VERSION,
      contractName: 'AzPrM12COuterSearchBinding',
      kind: 'azpr-m12c-outer-search-binding',
      valid: true,
      issues: [],
      build,
      initialFront: projectInitialFront(initialFront),
      variantKey: createM12cSearchVariantKey(build, initialFront),
      contract: prepared.contract ?? boundContract,
    };
  }

  async function resolveEnemyProfile({
    contract,
    build,
    objective,
    initialFront,
    initialState,
    pool,
    mechanicsPackage,
  }) {
    const supplied = contract?.scenario?.enemy?.profile;
    if (
      supplied &&
      Number(supplied.enemyId) === M12C_OUTER_SEARCH_ENEMY_ID &&
      Number(supplied.level) === M12C_OUTER_SEARCH_ENEMY_LEVEL
    ) {
      return structuredClone(supplied);
    }
    const profileKey = hashCanonicalValue({
      packageHash: mechanicsPackage.packageHash,
      mechanicsProfileId: contract?.dataIdentity?.mechanicsProfileId,
      mechanicsProfileVersion: contract?.dataIdentity?.mechanicsProfileVersion,
      enemyId: M12C_OUTER_SEARCH_ENEMY_ID,
      level: M12C_OUTER_SEARCH_ENEMY_LEVEL,
    });
    if (cachedEnemyProfile && cachedEnemyProfileKey === profileKey) {
      return structuredClone(cachedEnemyProfile);
    }
    const researchContract = createM12cBuildSearchContract({
      contractTemplate: contract,
      build,
      objective,
      initialFrontOptimizationObjectId: initialFront.optimizationObjectId,
      initialState,
      mechanicsPackage,
      qualificationCatalogHash: pool.authority.qualificationCatalogHash,
      enemyProfile: null,
      qualificationMode: 'research',
    });
    const prepared = machineAxisService.prepare(researchContract);
    const derived = prepared.contract?.scenario?.enemy?.profile ?? null;
    if (prepared.valid !== true || !derived) {
      throw new M12cOuterSearchError(
        'Authoritative level-80 Thunder Crown Yak profile could not be resolved',
        [
          ...(prepared.issues ?? []),
          'm12c-outer-search-enemy-profile-unresolved',
        ]
      );
    }
    cachedEnemyProfileKey = profileKey;
    cachedEnemyProfile = structuredClone(derived);
    return structuredClone(derived);
  }

  async function search(envelope = {}, overrides = {}) {
    const startedAt = Date.now();
    const request = normalizeSearchEnvelope(envelope);
    const pool = outerBuildService.pool();
    const mechanicsPackage = requireMechanicsPackage(getMechanicsPackage);
    assertTemplateBoundary(request.contract, mechanicsPackage);
    assertInitialStateInput(request.initialState);

    const guidanceInput =
      overrides.guidance ??
      request.guidance ??
      request.options.guidance ??
      null;
    const guidanceApplication = normalizeGuidanceApplication(guidanceInput);
    const baseInnerOptions = {
      ...request.options,
      ...pickDefined(overrides, [
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
    delete baseInnerOptions.guidance;
    const effectiveOptions = resolveEffectiveInnerOptions({
      baseInnerOptions,
      guidanceApplication,
    });
    const normalizedInnerOptions = normalizeSearchOptions(effectiveOptions);
    assertPrimaryObjective(normalizedInnerOptions.objective);

    const outerOptions = normalizeOuterOptions({
      ...request.outer,
      ...pickDefined(overrides.outer ?? overrides, OUTER_INTEGER_FIELDS),
      ...(guidanceApplication.appliesOuter
        ? (guidanceApplication.normalized.guidance.outer ?? {})
        : {}),
    });
    const sourceConfigs = selectSourceConfigs(pool, outerOptions);
    const buildConstraints = normalizeBuildConstraints(
      request.buildConstraints
    );
    const buildConstraintsApplied = Object.keys(buildConstraints).length > 0;
    const dynamicOuterPruningApplied =
      typeof overrides.shouldPrune === 'function';
    const engine = createSearchEngine({ service: machineAxisService });
    if (!engine || typeof engine.search !== 'function') {
      throw new TypeError('M12-C outer search engine factory is invalid');
    }

    const processedVariantKeys = [];
    let processedVariantKeyCount = 0;
    let processedVariantKeyChainHash = hashCanonicalValue({
      schemaVersion: 1,
      poolHash: pool.poolHash,
      kind: 'm12c-outer-processed-variant-chain',
    });
    let candidateEntries = [];
    let candidateResultCount = 0;
    const candidateMetadata = new WeakMap();
    const failures = [];
    const failureIssueCounts = new Map();
    let failureCount = 0;
    const aggregateInnerSummary = createAggregateInnerSummary();
    const planSummaries = [];
    let buildCount = 0;
    let variantSearchCount = 0;
    let variantBudgetExhausted = false;
    let buildBudgetExhausted = false;

    function recordFailure(input) {
      const failure = createFailure(input);
      failureCount += 1;
      for (const issue of failure.issues) {
        failureIssueCounts.set(
          issue,
          Number(failureIssueCounts.get(issue) ?? 0) + 1
        );
      }
      if (failures.length < OUTER_REPORT_SAMPLE_LIMIT) {
        failures.push(failure);
      }
    }

    function recordProcessedVariant(variantKey) {
      processedVariantKeyCount += 1;
      processedVariantKeyChainHash = hashCanonicalValue({
        previousHash: processedVariantKeyChainHash,
        index: processedVariantKeyCount,
        variantKey,
      });
      if (processedVariantKeys.length < OUTER_REPORT_SAMPLE_LIMIT) {
        processedVariantKeys.push(variantKey);
      }
    }

    sourceLoop: for (const sourceConfig of sourceConfigs.selected) {
      const planResult = outerBuildService.plan({
        sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
        constraints: {
          perActor: constraintsForSourceConfig(buildConstraints, sourceConfig),
        },
      });
      if (!planResult.valid || !planResult.plan) {
        recordFailure({
          stage: 'build-plan',
          sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
          issues: planResult.issues,
        });
        continue;
      }
      let enumeratedBuildCount = 0;
      const estimatedBuildCount = BigInt(planResult.plan.estimatedBuildCount);
      for (const build of outerBuildService.iterate(planResult.plan, {
        maxCandidates: outerOptions.maxBuildsPerSourceConfig,
        shouldPrune: overrides.shouldPrune,
      })) {
        if (buildCount >= outerOptions.maxBuildsTotal) {
          buildBudgetExhausted = true;
          break sourceLoop;
        }
        if (
          variantSearchCount + build.actors.length >
          outerOptions.maxVariantSearches
        ) {
          variantBudgetExhausted = true;
          break sourceLoop;
        }
        enumeratedBuildCount += 1;
        buildCount += 1;
        for (const initialFront of build.actors) {
          const variantKey = createM12cSearchVariantKey(build, initialFront);
          let binding;
          try {
            binding = await bind({
              contract: request.contract,
              build,
              objective: normalizedInnerOptions.objective,
              initialFrontOptimizationObjectId:
                initialFront.optimizationObjectId,
              initialState: request.initialState,
            });
          } catch (error) {
            recordFailure({
              stage: 'build-binding',
              sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
              buildHash: build.buildHash,
              variantKey,
              initialFront,
              issues: error?.issues ?? [error?.message ?? String(error)],
            });
            continue;
          }
          variantSearchCount += 1;
          try {
            const innerResult = await engine.search({
              contract: binding.contract,
              options: createEngineOptions({
                baseInnerOptions,
                guidanceApplication,
                objective: normalizedInnerOptions.objective,
              }),
            });
            accumulateInnerSummary(
              aggregateInnerSummary,
              innerResult.summary ?? {}
            );
            const metadata = {
              build,
              initialFront: binding.initialFront,
              sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
            };
            const variantEntries = [];
            for (const entry of innerResult.results ?? []) {
              const candidateEntry = {
                ...entry,
                teamCandidateId: variantKey,
              };
              candidateMetadata.set(candidateEntry, metadata);
              variantEntries.push(candidateEntry);
            }
            candidateResultCount += variantEntries.length;
            candidateEntries = selectTopN(
              [...candidateEntries, ...variantEntries],
              normalizedInnerOptions.topN
            );
            if ((innerResult.results ?? []).length === 0) {
              recordFailure({
                stage: 'inner-search-empty',
                sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
                buildHash: build.buildHash,
                variantKey,
                initialFront,
                issues: innerResult.issues,
              });
            }
          } catch (error) {
            recordFailure({
              stage: 'inner-search',
              sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
              buildHash: build.buildHash,
              variantKey,
              initialFront,
              issues: error?.issues ?? [error?.message ?? String(error)],
            });
          } finally {
            recordProcessedVariant(variantKey);
          }
        }
      }
      const sourceConfigComplete =
        BigInt(enumeratedBuildCount) >= estimatedBuildCount ||
        enumeratedBuildCount < outerOptions.maxBuildsPerSourceConfig;
      planSummaries.push({
        sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
        planHash: planResult.plan.planHash,
        estimatedBuildCount: planResult.plan.estimatedBuildCount,
        enumeratedBuildCount,
        complete: sourceConfigComplete,
      });
    }

    const selectedEntries = selectTopN(
      candidateEntries,
      normalizedInnerOptions.topN
    );
    const selectedVariantMetadata = new Map(
      selectedEntries.map(entry => [
        entry.teamCandidateId,
        candidateMetadata.get(entry),
      ])
    );
    const sourceConfigSelectionComplete =
      sourceConfigs.selected.length === sourceConfigs.requested.length;
    const enumerationComplete =
      sourceConfigSelectionComplete &&
      !buildBudgetExhausted &&
      !variantBudgetExhausted &&
      planSummaries.length === sourceConfigs.selected.length &&
      planSummaries.every(plan => plan.complete);
    const fullPoolSourceConfigCoverage =
      enumerationComplete &&
      sourceConfigs.requested.length ===
        pool.teamCatalog.sourceConfigs.length &&
      new Set(sourceConfigs.requested.map(row => row.sourceConfigIdentity))
        .size === pool.teamCatalog.sourceConfigs.length;
    const fullPoolEnumerationComplete =
      fullPoolSourceConfigCoverage &&
      !buildConstraintsApplied &&
      !dynamicOuterPruningApplied;
    const formalRankingReady =
      fullPoolEnumerationComplete &&
      failureCount === 0 &&
      selectedEntries.length > 0 &&
      selectedEntries.every(entry => entry.finalScoreEligible === true);
    const summary = {
      ...aggregateInnerSummary,
      objective: normalizedInnerOptions.objective,
      topN: normalizedInnerOptions.topN,
      wallTimeMs: Date.now() - startedAt,
      requestedSourceConfigCount: sourceConfigs.requested.length,
      selectedSourceConfigCount: sourceConfigs.selected.length,
      plannedSourceConfigCount: planSummaries.length,
      buildCount,
      variantSearchCount,
      candidateResultCount,
      topResultCount: selectedEntries.length,
      failureCount,
      failureSampleCount: failures.length,
      failureSampleTruncated: failureCount > failures.length,
      buildBudgetExhausted,
      variantBudgetExhausted,
      enumerationComplete,
      fullPoolSourceConfigCoverage,
      fullPoolEnumerationComplete,
      buildConstraintsApplied,
      dynamicOuterPruningApplied,
      formalRankingReady,
      rankingStatus: formalRankingReady
        ? 'formal-exhaustive-top-n-ready'
        : enumerationComplete &&
            failureCount === 0 &&
            selectedEntries.length > 0 &&
            selectedEntries.every(entry => entry.finalScoreEligible === true)
          ? 'bounded-domain-top-n-ready-not-full-pool'
          : 'partial-bounded-not-formal-ranking',
      outerSearchIntegration: {
        implemented: true,
        poolBound: true,
        buildContractBound: true,
        allInitialFrontsBound: true,
        globalTopNBound: true,
      },
    };
    const rawSearchResult = {
      schemaVersion: 1,
      contractName: 'AzPrMachineAxisSearch',
      kind: 'azpr-machine-axis-search',
      options: normalizedInnerOptions,
      summary,
      issues: failures.flatMap(failure => failure.issues),
      results: selectedEntries,
    };
    const innerReport =
      selectedEntries.length > 0
        ? createSearchReport({
            searchResult: rawSearchResult,
            contract: selectedEntries[0].axis,
            service: machineAxisService,
          })
        : { results: [] };
    const results = (innerReport.results ?? []).map(row => {
      const metadata = selectedVariantMetadata.get(row.teamCandidateId);
      return {
        ...row,
        m12c: metadata
          ? {
              buildHash: metadata.build.buildHash,
              poolHash: metadata.build.poolHash,
              teamIdentity: metadata.build.teamIdentity,
              sourceConfigIdentity: metadata.sourceConfigIdentity,
              initialFront: metadata.initialFront,
              fixedCultivationProfile: metadata.build.fixedCultivationProfile,
              build: metadata.build,
            }
          : null,
      };
    });
    const reportPayload = {
      schemaVersion: M12C_OUTER_SEARCH_SCHEMA_VERSION,
      contractName: M12C_OUTER_SEARCH_REPORT_CONTRACT_NAME,
      kind: M12C_OUTER_SEARCH_REPORT_KIND,
      valid: results.length > 0,
      objective: normalizedInnerOptions.objective,
      objectiveContract: createMachineAxisObjectiveContract(
        normalizedInnerOptions.objective
      ),
      options: normalizedInnerOptions,
      outerOptions,
      guidance:
        guidanceApplication.normalized == null
          ? null
          : {
              guidanceHash: guidanceApplication.normalized.guidanceHash,
              guidanceVersion:
                guidanceApplication.normalized.guidance.guidanceVersion,
              layer: guidanceApplication.normalized.guidance.layer,
            },
      pool: {
        poolHash: pool.poolHash,
        authority: pool.authority,
        summary: pool.summary,
      },
      summary,
      plans: planSummaries,
      failures,
      failureSummary: Object.fromEntries(
        [...failureIssueCounts.entries()].sort(([left], [right]) =>
          left.localeCompare(right, 'en')
        )
      ),
      issues: [...failureIssueCounts.keys()].sort((left, right) =>
        left.localeCompare(right, 'en')
      ),
      executionLedger: {
        poolHash: pool.poolHash,
        processedVariantKeyCount,
        processedVariantKeyChainHash,
        processedVariantKeys: [...new Set(processedVariantKeys)].sort(),
        processedVariantKeysTruncated:
          processedVariantKeyCount > processedVariantKeys.length,
      },
      results,
    };
    return {
      ...reportPayload,
      requestHash: hashCanonicalValue({
        contract: request.contract,
        initialState: normalizeInitialStateInput(request.initialState),
        buildConstraints,
        options: normalizedInnerOptions,
        outerOptions,
        guidanceHash: guidanceApplication.normalized?.guidanceHash ?? null,
        poolHash: pool.poolHash,
      }),
    };
  }

  return Object.freeze({
    schemaVersion: M12C_OUTER_SEARCH_SCHEMA_VERSION,
    contractName: 'AzPrM12COuterSearchService',
    pool: () => outerBuildService.pool(),
    bind,
    search,
  });
}

export function createM12cBuildSearchContract({
  contractTemplate,
  build,
  objective,
  initialFrontOptimizationObjectId,
  initialState = {},
  mechanicsPackage,
  qualificationCatalogHash,
  enemyProfile = null,
  qualificationMode = 'formal',
} = {}) {
  if (!build || !Array.isArray(build.actors) || build.actors.length !== 3) {
    throw new M12cOuterSearchError('M12-C build must contain three actors', [
      'm12c-outer-search-build-invalid',
    ]);
  }
  assertPrimaryObjective(objective);
  assertInitialStateInput(initialState);
  assertInitialStateForBuild(initialState, build);
  const initialFront = resolveInitialFront(
    build,
    initialFrontOptimizationObjectId
  );
  const normalizedInitialState = normalizeInitialStateInput(initialState);
  const team = build.actors.map(actor => ({
    slotId: actor.actorSlotId,
    characterId: Number(actor.sourceCharacterId),
    level: Number(actor.characterCultivation.level),
    initialSp: Number(
      normalizedInitialState.actorSpByOptimizationObjectId[
        actor.optimizationObjectId
      ] ?? 0
    ),
    loadout: {
      kiboId: Number(actor.kibo.kiboId),
      soulessenceId: Number(actor.soulEssence.soulEssenceId),
      equipment: Object.fromEntries(
        actor.equipment.map(item => [item.slot, Number(item.equipmentId)])
      ),
    },
  }));
  const initialRuntimeState = createM12cInitialRuntimeState({
    build,
    initialFront,
    initialState: normalizedInitialState,
    mechanicsPackage,
  });
  const objectiveContract = createMachineAxisObjectiveContract(objective);
  const scenarioId = `m12c-${objective}-${build.buildHash}-${initialFront.optimizationObjectId}`;
  const scenario = {
    id: scenarioId,
    name: `M12-C ${objective} ${build.buildHash} front ${initialFront.optimizationObjectId}`,
    fps: 60,
    durationFrames: Number(contractTemplate?.scenario?.durationFrames),
    team,
    enemy: {
      enemyId: M12C_OUTER_SEARCH_ENEMY_ID,
      level: M12C_OUTER_SEARCH_ENEMY_LEVEL,
      hpMultiplier: 1,
      defenseMultiplier: 1,
      toughnessMultiplier: 1,
      initialToughnessRatio: 1,
      elementDefenseOverrides: {},
      ...(enemyProfile == null
        ? {}
        : { profile: structuredClone(enemyProfile) }),
    },
    initialRuntimeState,
    projectile: { targetDistance: 0, defaultWillHit: true },
    critical: structuredClone(
      contractTemplate?.scenario?.critical ?? {
        policy: 'expected',
        seed: null,
      }
    ),
    optimizationScenarioPolicy: createOptimizationScenarioPolicyBinding(),
    objectiveContract,
    jointAttackRuntime: createVerifiedJointAttackRuntimeBinding(),
    optimizationQualification: {
      mode: qualificationMode,
      catalogHash: qualificationCatalogHash,
    },
    cultivationProfile: createM12cCultivationProfileFromBuild(build),
    target: structuredClone(objectiveContract.targetPolicy),
  };
  if (qualificationMode === 'formal') {
    scenario.initialStatePreset = createM12cInitialStatePresetBinding({
      presetId:
        normalizedInitialState.presetId ??
        `m12c-outer-${objective}-${hashCanonicalValue(normalizedInitialState)}`,
      objectiveId: objective,
      team,
      initialRuntimeState,
      mechanicsPackage,
    });
  }
  return {
    schemaVersion: 1,
    contractName: 'AzPrMachineAxis',
    kind: 'azpr-machine-axis',
    dataIdentity: {
      verifiedMechanicsPackageId: mechanicsPackage?.packageId ?? null,
      verifiedMechanicsPackageHash: mechanicsPackage?.packageHash ?? null,
      mechanicsProfileId:
        contractTemplate?.dataIdentity?.mechanicsProfileId ?? null,
      mechanicsProfileVersion:
        contractTemplate?.dataIdentity?.mechanicsProfileVersion ?? null,
    },
    scenario,
    actions: [],
    metadata: {
      ...(contractTemplate?.metadata ?? {}),
      m12c: {
        poolHash: build.poolHash,
        buildHash: build.buildHash,
        teamIdentity: build.teamIdentity,
        sourceConfigIdentity: build.sourceConfigIdentity,
        initialFront: projectInitialFront(initialFront),
      },
    },
  };
}

export function createM12cCultivationProfileFromBuild(build) {
  return {
    schemaVersion: 1,
    contractName: 'AzPrOptimizationCultivationProfile',
    profileId: `m12c-outer-build:${build.buildHash}`,
    actors: build.actors.map(actor => ({
      slotId: actor.actorSlotId,
      character: {
        level: Number(actor.characterCultivation.level),
        starGiftRank: Number(actor.characterCultivation.starGiftRank),
        starGiftNodeIds:
          actor.characterCultivation.currentRankNodeIds.map(Number),
      },
      kibo: {
        level: Number(actor.kibo.level),
        talents: Object.entries(actor.kibo.talentLevels)
          .map(([attributeId, level]) => ({
            attributeId: Number(attributeId),
            level: Number(level),
          }))
          .sort((left, right) => left.attributeId - right.attributeId),
        dnaFactors: [],
        bondLevel: Number(actor.kibo.bondLevel),
      },
      soulEssence: {
        level: Number(actor.soulEssence.level),
        rank: Number(actor.soulEssence.rank),
        star: Number(actor.soulEssence.star),
      },
      equipment: Object.fromEntries(
        actor.equipment.map(item => [
          item.slot,
          {
            rarity: Number(item.rarity),
            enhancementLevel: Number(item.enhancementLevel),
            tuningScore: Number(item.tuningScore),
            instanceTier: item.instanceTier,
            maxValue: Number(
              build.fixedCultivationProfile?.equipmentInstanceSource?.maximum ??
                item.tuningScore
            ),
          },
        ])
      ),
    })),
  };
}

export function createM12cSearchVariantKey(build, initialFront) {
  return `m12c-variant:${hashCanonicalValue({
    buildHash: build?.buildHash ?? null,
    initialFrontActorSlotId: initialFront?.actorSlotId ?? null,
    initialFrontOptimizationObjectId:
      initialFront?.optimizationObjectId ?? null,
    initialFrontSourceCharacterId: initialFront?.sourceCharacterId ?? null,
  })}`;
}

function createM12cInitialRuntimeState({
  build,
  initialFront,
  initialState,
  mechanicsPackage,
}) {
  const specialResourceProfiles = new Map(
    (mechanicsPackage?.specialResourceCatalog?.profiles ?? []).map(profile => [
      String(profile.resourceIdentity),
      profile,
    ])
  );
  const actorByObjectId = new Map(
    build.actors.map(actor => [actor.optimizationObjectId, actor])
  );
  return {
    controlledActor: {
      actorId: `actor-${Number(initialFront.sourceCharacterId)}`,
      characterId: Number(initialFront.sourceCharacterId),
    },
    kiboEnergyBySlot: build.actors.map(actor => ({
      slotId: actor.actorSlotId,
      actorId: `actor-${Number(actor.sourceCharacterId)}`,
      characterId: Number(actor.sourceCharacterId),
      kiboId: Number(actor.kibo.kiboId),
      currentValue: Number(
        initialState.kiboSpByOptimizationObjectId[actor.optimizationObjectId] ??
          0
      ),
      maxValue: AZPR_DEFAULT_EFFECTIVE_MAX_SP,
    })),
    tuningMarks: structuredClone(initialState.tuningMarks),
    specialResourcesByActor: initialState.specialResources.flatMap(row => {
      const actor = actorByObjectId.get(row.optimizationObjectId);
      if (!actor) return [];
      const profile = specialResourceProfiles.get(String(row.resourceIdentity));
      return [
        {
          actorId: `actor-${Number(actor.sourceCharacterId)}`,
          characterId: Number(actor.sourceCharacterId),
          resourceIdentity: String(row.resourceIdentity),
          currentValue: Number(row.currentValue),
          maxValue: Number(row.maxValue ?? profile?.capacity),
          inputStep: Number(row.inputStep ?? profile?.inputStep),
          scenarioConfigurable:
            row.scenarioConfigurable ?? profile?.scenarioConfigurable ?? false,
          activeStates: structuredClone(row.activeStates ?? []),
        },
      ];
    }),
  };
}

function normalizeSearchEnvelope(envelope) {
  const source = isRecord(envelope) ? envelope : {};
  const contract = source.contract ?? source.contractTemplate ?? envelope;
  if (!isRecord(contract) || contract === source) {
    throw new M12cOuterSearchError(
      'M12-C outer search request requires contract or contractTemplate',
      ['m12c-outer-search-contract-required']
    );
  }
  if (
    source.schemaVersion != null &&
    Number(source.schemaVersion) !== M12C_OUTER_SEARCH_SCHEMA_VERSION
  ) {
    throw new M12cOuterSearchError(
      'M12-C outer search schema version is invalid',
      ['m12c-outer-search-schema-version-invalid']
    );
  }
  if (
    source.contractName != null &&
    source.contractName !== M12C_OUTER_SEARCH_REQUEST_CONTRACT_NAME
  ) {
    throw new M12cOuterSearchError(
      'M12-C outer search contract name is invalid',
      ['m12c-outer-search-contract-name-invalid']
    );
  }
  if (source.kind != null && source.kind !== M12C_OUTER_SEARCH_KIND) {
    throw new M12cOuterSearchError('M12-C outer search kind is invalid', [
      'm12c-outer-search-kind-invalid',
    ]);
  }
  return {
    contract,
    options: isRecord(source.options) ? source.options : {},
    outer: isRecord(source.outer) ? source.outer : {},
    guidance: source.guidance ?? null,
    initialState: isRecord(source.initialState) ? source.initialState : {},
    buildConstraints: isRecord(source.buildConstraints)
      ? source.buildConstraints
      : {},
  };
}

function normalizeGuidanceApplication(input) {
  if (input == null) {
    return {
      normalized: null,
      appliesInner: false,
      appliesOuter: false,
    };
  }
  const normalized = normalizeSearchGuidance(input);
  if (!normalized.valid) {
    throw new M12cOuterSearchError(
      'M12-C outer search guidance is invalid',
      normalized.issues
    );
  }
  const appliesInner = ['inner', 'both'].includes(normalized.guidance.layer);
  const appliesOuter = ['outer', 'both'].includes(normalized.guidance.layer);
  return {
    normalized,
    appliesInner,
    appliesOuter,
  };
}

function resolveEffectiveInnerOptions({
  baseInnerOptions,
  guidanceApplication,
}) {
  const effective = guidanceApplication.appliesInner
    ? applySearchGuidance(
        baseInnerOptions,
        guidanceApplication.normalized.guidance
      ).options
    : { ...baseInnerOptions };
  if (
    !guidanceApplication.appliesInner &&
    guidanceApplication.normalized?.guidance.objective
  ) {
    effective.objective = guidanceApplication.normalized.guidance.objective;
  }
  return effective;
}

function createEngineOptions({
  baseInnerOptions,
  guidanceApplication,
  objective,
}) {
  const options = { ...baseInnerOptions, objective };
  if (guidanceApplication.appliesInner) {
    options.guidance = guidanceApplication.normalized.guidance;
  }
  return options;
}

function normalizeOuterOptions(input = {}) {
  const issues = [];
  const normalized = { ...DEFAULT_OUTER_OPTIONS };
  for (const field of OUTER_INTEGER_FIELDS) {
    const value = input[field] ?? DEFAULT_OUTER_OPTIONS[field];
    const number = Number(value);
    if (!Number.isInteger(number) || number <= 0) {
      issues.push(`m12c-outer-search-${field}-invalid`);
    } else {
      normalized[field] = number;
    }
  }
  const sourceConfigIdentities =
    input.sourceConfigIdentities == null
      ? []
      : Array.isArray(input.sourceConfigIdentities)
        ? input.sourceConfigIdentities.map(String)
        : null;
  if (sourceConfigIdentities == null) {
    issues.push('m12c-outer-search-source-config-identities-invalid');
  }
  if (
    input.initialFrontPolicy != null &&
    input.initialFrontPolicy !== 'all-team-members'
  ) {
    issues.push('m12c-outer-search-initial-front-policy-invalid');
  }
  if (issues.length > 0) {
    throw new M12cOuterSearchError(
      'M12-C outer search options are invalid',
      issues
    );
  }
  return {
    ...normalized,
    sourceConfigIdentities: [...new Set(sourceConfigIdentities)].sort(),
  };
}

function selectSourceConfigs(pool, outerOptions) {
  const all = pool.teamCatalog.sourceConfigs;
  const requested =
    outerOptions.sourceConfigIdentities.length === 0
      ? [...all]
      : outerOptions.sourceConfigIdentities.map(identity => {
          const match = all.find(
            source => source.sourceConfigIdentity === identity
          );
          if (!match) {
            throw new M12cOuterSearchError(
              'M12-C outer search source config is not authoritative',
              ['m12c-outer-search-source-config-unknown']
            );
          }
          return match;
        });
  return {
    requested,
    selected: requested.slice(0, outerOptions.maxSourceConfigs),
  };
}

function normalizeBuildConstraints(input = {}) {
  const normalized = {};
  for (const [objectId, constraints] of Object.entries(input)) {
    if (!ROSTER_OBJECT_IDS.has(String(objectId)) || !isRecord(constraints)) {
      throw new M12cOuterSearchError(
        'M12-C outer build constraints are invalid',
        ['m12c-outer-search-build-constraints-invalid']
      );
    }
    normalized[String(objectId)] = structuredClone(constraints);
  }
  return normalized;
}

function constraintsForSourceConfig(constraints, sourceConfig) {
  return Object.fromEntries(
    sourceConfig.actors
      .filter(actor => constraints[actor.optimizationObjectId] != null)
      .map(actor => [
        actor.optimizationObjectId,
        constraints[actor.optimizationObjectId],
      ])
  );
}

function normalizeInitialStateInput(input = {}) {
  return {
    presetId:
      input.presetId == null || input.presetId === ''
        ? null
        : String(input.presetId),
    actorSpByOptimizationObjectId: normalizeSpMap(
      input.actorSpByOptimizationObjectId
    ),
    kiboSpByOptimizationObjectId: normalizeSpMap(
      input.kiboSpByOptimizationObjectId
    ),
    tuningMarks: Array.isArray(input.tuningMarks)
      ? structuredClone(input.tuningMarks)
      : [],
    specialResources: Array.isArray(input.specialResources)
      ? input.specialResources.map(resource => ({
          ...structuredClone(resource),
          optimizationObjectId: String(resource.optimizationObjectId),
        }))
      : [],
  };
}

function assertInitialStateInput(input = {}) {
  const issues = [];
  for (const field of [
    'actorSpByOptimizationObjectId',
    'kiboSpByOptimizationObjectId',
  ]) {
    if (input[field] != null && !isRecord(input[field])) {
      issues.push(`m12c-outer-search-initial-state-${field}-invalid`);
      continue;
    }
    for (const [objectId, value] of Object.entries(input[field] ?? {})) {
      if (
        !ROSTER_OBJECT_IDS.has(String(objectId)) ||
        !Number.isInteger(Number(value)) ||
        Number(value) < 0 ||
        Number(value) > AZPR_DEFAULT_EFFECTIVE_MAX_SP
      ) {
        issues.push(`m12c-outer-search-initial-state-${field}-invalid`);
      }
    }
  }
  if (input.tuningMarks != null && !Array.isArray(input.tuningMarks)) {
    issues.push('m12c-outer-search-initial-state-tuning-marks-invalid');
  }
  if (
    input.specialResources != null &&
    !Array.isArray(input.specialResources)
  ) {
    issues.push('m12c-outer-search-initial-state-resources-invalid');
  }
  for (const resource of input.specialResources ?? []) {
    if (
      !isRecord(resource) ||
      !ROSTER_OBJECT_IDS.has(String(resource.optimizationObjectId)) ||
      !resource.resourceIdentity ||
      !Number.isFinite(Number(resource.currentValue))
    ) {
      issues.push('m12c-outer-search-initial-state-resource-invalid');
    }
  }
  if (issues.length > 0) {
    throw new M12cOuterSearchError(
      'M12-C outer initial state is invalid',
      issues
    );
  }
}

function assertInitialStateForBuild(input = {}, build) {
  const memberIds = new Set(
    (build?.actors ?? []).map(actor => String(actor.optimizationObjectId))
  );
  const issues = [];
  for (const field of [
    'actorSpByOptimizationObjectId',
    'kiboSpByOptimizationObjectId',
  ]) {
    for (const objectId of Object.keys(input[field] ?? {})) {
      if (!memberIds.has(String(objectId))) {
        issues.push(`m12c-outer-search-initial-state-${field}-not-in-build`);
      }
    }
  }
  for (const resource of input.specialResources ?? []) {
    if (!memberIds.has(String(resource.optimizationObjectId))) {
      issues.push('m12c-outer-search-initial-state-resource-not-in-build');
    }
  }
  if (issues.length > 0) {
    throw new M12cOuterSearchError(
      'M12-C initial-state values must belong to the selected build',
      issues
    );
  }
}

function normalizeSpMap(value) {
  return Object.fromEntries(
    Object.entries(isRecord(value) ? value : {})
      .map(([key, amount]) => [String(key), Number(amount)])
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
  );
}

function resolveInitialFront(build, optimizationObjectId) {
  const actor = build.actors.find(
    candidate =>
      candidate.optimizationObjectId === String(optimizationObjectId ?? '')
  );
  if (!actor) {
    throw new M12cOuterSearchError(
      'M12-C initial front must be one member of the selected build',
      ['m12c-outer-search-initial-front-invalid']
    );
  }
  return actor;
}

function projectInitialFront(actor) {
  return {
    actorSlotId: actor.actorSlotId,
    optimizationObjectId: actor.optimizationObjectId,
    sourceCharacterId: Number(actor.sourceCharacterId),
  };
}

function assertTemplateBoundary(contract, mechanicsPackage) {
  const issues = [];
  if (!isRecord(contract)) {
    issues.push('m12c-outer-search-contract-required');
  }
  if (
    contract?.schemaVersion !== 1 ||
    contract?.contractName !== 'AzPrMachineAxis' ||
    (contract?.kind != null && contract.kind !== 'azpr-machine-axis')
  ) {
    issues.push('m12c-outer-search-machine-axis-template-invalid');
  }
  if (!Number.isInteger(Number(contract?.scenario?.durationFrames))) {
    issues.push('m12c-outer-search-duration-required');
  }
  if (Number(contract?.scenario?.fps ?? 60) !== 60) {
    issues.push('m12c-outer-search-fps-invalid');
  }
  if (
    Number(contract?.scenario?.enemy?.enemyId) !== M12C_OUTER_SEARCH_ENEMY_ID ||
    Number(contract?.scenario?.enemy?.level) !== M12C_OUTER_SEARCH_ENEMY_LEVEL
  ) {
    issues.push('m12c-outer-search-enemy-template-invalid');
  }
  if (!contract?.dataIdentity?.mechanicsProfileId) {
    issues.push('m12c-outer-search-mechanics-profile-required');
  }
  if (
    contract?.dataIdentity?.verifiedMechanicsPackageId != null &&
    contract.dataIdentity.verifiedMechanicsPackageId !==
      mechanicsPackage.packageId
  ) {
    issues.push('m12c-outer-search-mechanics-package-id-mismatch');
  }
  if (
    contract?.dataIdentity?.verifiedMechanicsPackageHash != null &&
    contract.dataIdentity.verifiedMechanicsPackageHash !==
      mechanicsPackage.packageHash
  ) {
    issues.push('m12c-outer-search-mechanics-package-mismatch');
  }
  if (issues.length > 0) {
    throw new M12cOuterSearchError(
      'M12-C outer search template is invalid',
      issues
    );
  }
}

function assertPrimaryObjective(objective) {
  if (!MACHINE_AXIS_PRIMARY_OBJECTIVE_IDS.includes(String(objective))) {
    throw new M12cOuterSearchError(
      'M12-C outer search requires one primary objective',
      ['m12c-outer-search-objective-invalid']
    );
  }
}

function requireMechanicsPackage(getMechanicsPackage) {
  const mechanicsPackage = getMechanicsPackage();
  if (!mechanicsPackage) {
    throw new M12cOuterSearchError(
      'Verified combat mechanics package is not installed',
      ['machine-axis-mechanics-package-not-installed']
    );
  }
  return mechanicsPackage;
}

function createAggregateInnerSummary() {
  return {
    ...Object.fromEntries(SUMMARY_COUNTER_FIELDS.map(field => [field, 0])),
    rejectionCounts: {},
  };
}

function accumulateInnerSummary(target, summary) {
  for (const field of SUMMARY_COUNTER_FIELDS) {
    target[field] += Number(summary?.[field] ?? 0);
  }
  for (const [code, count] of Object.entries(summary?.rejectionCounts ?? {})) {
    target.rejectionCounts[code] =
      Number(target.rejectionCounts[code] ?? 0) + Number(count ?? 0);
  }
  return target;
}

function createFailure({
  stage,
  sourceConfigIdentity = null,
  buildHash = null,
  variantKey = null,
  initialFront = null,
  issues = [],
}) {
  return {
    stage,
    sourceConfigIdentity,
    buildHash,
    variantKey,
    initialFront:
      initialFront == null ? null : projectInitialFront(initialFront),
    issues: normalizeIssues(issues),
  };
}

function normalizeIssues(issues) {
  return [
    ...new Set(
      (Array.isArray(issues) ? issues : [issues])
        .filter(Boolean)
        .map(issue =>
          typeof issue === 'string'
            ? issue
            : String(issue.code ?? issue.message ?? 'm12c-outer-search-unknown')
        )
    ),
  ].sort();
}

function pickDefined(source, fields) {
  return Object.fromEntries(
    fields
      .filter(field => source?.[field] != null)
      .map(field => [field, source[field]])
  );
}

function isRecord(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
