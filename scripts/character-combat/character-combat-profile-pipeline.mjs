import crypto from 'node:crypto';

export const CHARACTER_COMBAT_PROFILE_SCHEMA_VERSION = 1;
export const CHARACTER_COMBAT_PROFILE_STATUSES = Object.freeze([
  'applied',
  'runtime-evidence-required',
  'static-evidence-gap',
  'not-applicable',
]);
export const CHARACTER_COMBAT_PROGRESS_STATES = Object.freeze([
  'not-started',
  'evidence-indexed',
  'profile-compiled',
  'runtime-applied',
  'ui-verified',
]);
export const CHARACTER_COMBAT_COVERAGE_STATES = Object.freeze([
  'evidence-required',
  'partial',
  'complete',
]);

export const M10_PUBLIC_CHARACTER_ORDER = Object.freeze([
  101010, 103002, 101003, 101007, 102001, 107001, 107002, 107003, 108001,
  108002, 108003, 108005, 109001, 109002, 111001, 112001, 112002, 199001,
  199002, 199003,
]);

const EXPECTED_PUBLIC_CHARACTER_NAMES = Object.freeze([
  '涂山小玉',
  '红宝石',
  '寒悠悠',
  '芃芃',
  '莉莉',
  '西芙莉雅',
  '米砂',
  '阿比',
  '忒拉拉',
  '璐璐卡',
  '米蒂',
  '卡塔露',
  '末音',
  '夏儿',
  '法兰塔',
  '姬瑟贝露',
  '艾妮丝',
  '女主角',
  '男主角',
  '诺诺',
]);

const COVERAGE_DIMENSIONS = Object.freeze([
  'publicActions',
  'hiddenAndDerivedForms',
  'inputAndExecutionTiming',
  'effectiveOccupancy',
  'hitsAndProjectiles',
  'hpDamage',
  'toughnessDamage',
  'actorSp',
  'kiboSp',
  'cooldowns',
  'personalResources',
  'teamResourcesAndMarks',
  'buffsAndDebuffs',
  'passives',
  'dynamicProperties',
  'healingAndShields',
  'stateMachines',
  'switchAndStarCarry',
  'frontBackDifferences',
  'loadoutAndTeamStatPropagation',
]);

export function createCharacterCombatProfileSchema() {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'azpr://schemas/character-combat-profile/v1',
    title: 'Azur Promilia Character Combat Profile',
    type: 'object',
    required: [
      'schemaVersion',
      'kind',
      'profileIdentity',
      'profileHash',
      'pipelineMaturity',
      'combatCoverageState',
      'zeroDistanceSimulationComplete',
      'realClientEvidenceComplete',
      'simulationScopes',
      'owner',
      'sourcePackage',
      'denominator',
      'contracts',
      'runtimeCompilation',
      'coverage',
      'unresolvedRecords',
      'validation',
    ],
    properties: {
      schemaVersion: {
        const: CHARACTER_COMBAT_PROFILE_SCHEMA_VERSION,
      },
      kind: {
        const: 'azpr-character-combat-profile',
      },
      profileIdentity: {
        type: 'string',
        minLength: 1,
      },
      profileHash: {
        type: 'string',
        pattern: '^[a-f0-9]{64}$',
      },
      completionState: {
        enum: [...CHARACTER_COMBAT_PROGRESS_STATES],
      },
      pipelineMaturity: {
        enum: [...CHARACTER_COMBAT_PROGRESS_STATES],
      },
      combatCoverageState: {
        enum: [...CHARACTER_COMBAT_COVERAGE_STATES],
      },
      zeroDistanceSimulationComplete: {
        type: 'boolean',
      },
      realClientEvidenceComplete: {
        type: 'boolean',
      },
      simulationScopes: {
        type: 'object',
        required: ['zeroDistance', 'realClientEvidence'],
      },
      owner: {
        type: 'object',
        required: ['ownerKind', 'ownerId', 'ownerName'],
      },
      sourcePackage: {
        type: 'object',
        required: ['packageId', 'packageHash'],
      },
      denominator: {
        type: 'object',
        required: [
          'publicActionCount',
          'reachableControlCount',
          'executionFormCount',
          'verifiedWindowCount',
        ],
      },
      contracts: {
        type: 'object',
        required: [
          'publicActions',
          'actionForms',
          'controls',
          'timingInputEdges',
          'hits',
          'resourceTransactions',
          'stateMachines',
          'effects',
          'passives',
          'switchTriggers',
          'statDependencies',
        ],
      },
      runtimeCompilation: {
        type: 'object',
        required: [
          'status',
          'operatorContractVersion',
          'operators',
          'outputBindings',
          'sourceCompilation',
          'contractHash',
        ],
      },
      coverage: {
        type: 'array',
        items: {
          type: 'object',
          required: ['dimension', 'status', 'sourceIdentities'],
          properties: {
            status: {
              enum: [...CHARACTER_COMBAT_PROFILE_STATUSES],
            },
          },
        },
      },
      unresolvedRecords: {
        type: 'array',
      },
      validation: {
        type: 'object',
        required: ['status', 'issues'],
      },
    },
  };
}

export function createCharacterCombatOutputRecords(artifacts) {
  const records = [
    createJsonOutput(
      'src/data/generated/character-combat-profile-schema.json',
      artifacts.schema
    ),
    createJsonOutput(
      'src/data/generated/character-combat-profile-catalog.json',
      artifacts.catalog
    ),
    createJsonOutput(
      'reports/m10/all-character-coverage-manifest.json',
      artifacts.coverageManifest
    ),
    createTextOutput(
      'reports/m10/all-character-coverage-manifest.md',
      artifacts.coverageMarkdown
    ),
  ];
  if (artifacts.productBoundaryReport) {
    records.push(
      createJsonOutput(
        'reports/m10/character-product-boundaries.json',
        artifacts.productBoundaryReport
      ),
      createTextOutput(
        'reports/m10/character-product-boundaries.md',
        artifacts.productBoundaryMarkdown
      )
    );
  }
  for (const artifact of artifacts.ownerArtifacts) {
    const ownerId = artifact.profile.owner.ownerId;
    const reportRoot = `reports/m10/${ownerId}`;
    records.push(
      createJsonOutput(
        `src/data/generated/character-combat-owner-contracts/${ownerId}.json`,
        artifact.compiledOwnerContract
      ),
      createJsonOutput(
        `src/data/generated/character-combat-profiles/${ownerId}.json`,
        artifact.profile
      ),
      createJsonOutput(
        `${reportRoot}/source-manifest.json`,
        artifact.sourceManifest
      ),
      createJsonOutput(
        `${reportRoot}/reachable-graph.json`,
        artifact.reachableGraph
      ),
      createJsonOutput(
        `${reportRoot}/description-coverage.json`,
        artifact.descriptionCoverage
      ),
      createJsonOutput(
        `${reportRoot}/runtime-coverage.json`,
        artifact.runtimeCoverage
      ),
      createJsonOutput(
        `${reportRoot}/action-phase-coverage.json`,
        artifact.actionPhaseCoverage
      ),
      createTextOutput(
        `${reportRoot}/action-phase-coverage.md`,
        artifact.actionPhaseMarkdown
      ),
      createJsonOutput(
        `${reportRoot}/action-transition-coverage.json`,
        artifact.actionTransitionCoverage
      ),
      createTextOutput(
        `${reportRoot}/action-transition-coverage.md`,
        artifact.actionTransitionMarkdown
      ),
      createJsonOutput(
        `${reportRoot}/unresolved-ledger.json`,
        artifact.unresolvedLedger
      ),
      createJsonOutput(
        `${reportRoot}/runtime-capture-plan.json`,
        artifact.capturePlan
      ),
      createJsonOutput(
        `${reportRoot}/golden-trace.json`,
        artifact.goldenFixture
      ),
      createTextOutput(`${reportRoot}/summary.md`, artifact.summaryMarkdown)
    );
  }
  return records;
}

export function createCharacterCombatPipelineArtifacts({
  mechanicsPackage,
  characterCatalog,
  skills,
  recipes = [],
  productBoundaryReport = null,
  productBoundaryMarkdown = null,
  compiledOwnerContracts = [],
  goldenRuntimeByOwner = new Map(),
  reportsByOwner = new Map(),
}) {
  assertMechanicsPackage(mechanicsPackage);
  const characters = normalizeCharacters(characterCatalog);
  assertPublicCharacterDenominator(characters);
  const recipeByOwnerId = new Map(
    recipes.map(recipe => [Number(recipe.ownerId), recipe])
  );
  const compiledOwnerContractsByOwnerId = new Map(
    compiledOwnerContracts.map(compilation => [
      Number(compilation.ownerId),
      compilation,
    ])
  );
  const compiledProfiles = [];
  const ownerArtifacts = [];
  for (const recipe of recipes) {
    const ownerId = Number(recipe.ownerId);
    const reports = reportsByOwner.get(ownerId) ?? {};
    const artifacts = createCharacterCombatOwnerArtifacts({
      mechanicsPackage,
      character: characters.find(item => Number(item.id) === ownerId),
      skills,
      recipe,
      compiledOwnerContract: compiledOwnerContractsByOwnerId.get(ownerId),
      goldenRuntime: goldenRuntimeByOwner.get(ownerId),
      reports,
    });
    compiledProfiles.push(artifacts.profile);
    ownerArtifacts.push(artifacts);
  }
  const coverageManifest = createAllCharacterCoverageManifest({
    mechanicsPackage,
    characters,
    recipeByOwnerId,
    compiledProfiles,
    productBoundaryReport,
  });
  const sourcePackageHash =
    mechanicsPackage.characterCombatProfileCatalog?.sourcePackageHash ??
    mechanicsPackage.packageHash;
  const catalog = {
    schemaVersion: 1,
    kind: 'azpr-character-combat-profile-catalog',
    status: 'character-combat-profile-catalog-ready',
    sourcePackageHash,
    profileSchema: 'azpr://schemas/character-combat-profile/v1',
    profiles: compiledProfiles.map(profile => ({
      ownerId: profile.owner.ownerId,
      ownerName: profile.owner.ownerName,
      profileIdentity: profile.profileIdentity,
      profileHash: profile.profileHash,
      pipelineMaturity: profile.pipelineMaturity,
      combatCoverageState: profile.combatCoverageState,
      characterComplete: profile.characterComplete,
      zeroDistanceSimulationComplete:
        profile.zeroDistanceSimulationComplete === true,
      realClientEvidenceComplete: profile.realClientEvidenceComplete === true,
      completionState: profile.completionState,
      runtimeContractHash: profile.runtimeCompilation.contractHash,
      sourcePath: `src/data/generated/character-combat-profiles/${profile.owner.ownerId}.json`,
      status: profile.validation.status,
    })),
    coverageManifestHash: sha256Json(coverageManifest),
    summary: {
      publicCharacterCount: characters.length,
      compiledProfileCount: compiledProfiles.length,
      runtimeAppliedProfileCount: compiledProfiles.filter(profile =>
        ['runtime-applied', 'ui-verified'].includes(profile.pipelineMaturity)
      ).length,
      uiVerifiedProfileCount: compiledProfiles.filter(
        profile => profile.pipelineMaturity === 'ui-verified'
      ).length,
      characterCompleteCount: compiledProfiles.filter(
        profile => profile.characterComplete === true
      ).length,
      zeroDistanceSimulationCompleteCount: compiledProfiles.filter(
        profile => profile.zeroDistanceSimulationComplete === true
      ).length,
      realClientEvidenceCompleteCount: compiledProfiles.filter(
        profile => profile.realClientEvidenceComplete === true
      ).length,
    },
  };
  return {
    schema: createCharacterCombatProfileSchema(),
    catalog,
    profiles: compiledProfiles,
    ownerArtifacts,
    productBoundaryReport,
    productBoundaryMarkdown,
    coverageManifest,
    coverageMarkdown: createAllCharacterCoverageMarkdown(coverageManifest),
  };
}

export function createCharacterCombatOwnerArtifacts({
  mechanicsPackage,
  character,
  skills,
  recipe,
  compiledOwnerContract,
  goldenRuntime,
  reports = {},
}) {
  if (!character) {
    throw new Error(`character combat owner missing: ${recipe?.ownerId}`);
  }
  const ownerId = Number(character.id);
  if (ownerId !== Number(recipe?.ownerId)) {
    throw new Error(
      `character combat recipe owner mismatch: ${recipe?.ownerId}/${ownerId}`
    );
  }
  const sourcePackageHash =
    mechanicsPackage.characterCombatProfileCatalog?.sourcePackageHash ??
    mechanicsPackage.packageHash;
  if (
    !compiledOwnerContract ||
    Number(compiledOwnerContract.ownerId) !== ownerId ||
    compiledOwnerContract.status !== 'character-combat-owner-contracts-compiled'
  ) {
    throw new Error(
      `character combat compiled owner contracts missing: ${ownerId}`
    );
  }
  const compiledContracts = compiledOwnerContract.contracts ?? {};
  const publicActions = sortByIdentity(compiledContracts.publicActions ?? []);
  const ownerContextEdges = sortByIdentity(
    compiledContracts.timingInputEdges ?? []
  );
  const ownerVariantEdges = sortByIdentity(
    compiledContracts.variantEdges ?? []
  );
  const attackInputChains = sortByIdentity(
    compiledContracts.attackInputChains ?? []
  );
  const controlTransitionWindows = sortByIdentity(
    compiledContracts.controlTransitionWindows ?? []
  );
  const variantWindowBindings = sortByIdentity(
    compiledContracts.variantWindowBindings ?? []
  );
  const actionEffectBindings = sortByIdentity(
    compiledContracts.actionEffectBindings ?? []
  );
  const targetStateProfiles = sortByIdentity(
    compiledContracts.targetStateProfiles ?? []
  );
  const targetStateTransactions = sortByIdentity(
    compiledContracts.targetStateTransactions ?? []
  );
  const conditionalHitGroups = sortByIdentity(
    compiledContracts.conditionalHitGroups ?? []
  );
  const tuningMarkConditionalDamageGroups = sortByIdentity(
    compiledContracts.tuningMarkConditionalDamageGroups ?? []
  );
  const runtimeEffectBindings = sortByIdentity(
    compiledContracts.runtimeEffectBindings ?? []
  );
  const actionForms = sortByIdentity(compiledContracts.actionForms ?? []);
  const specialResourceProfiles = sortByIdentity(
    compiledContracts.resourceProfiles ?? []
  );
  const resourceTransactions = sortByIdentity(
    compiledContracts.resourceTransactions ?? []
  );
  const thresholdTransitions = sortByIdentity(
    compiledContracts.stateMachines ?? []
  );
  const passives = sortByIdentity(compiledContracts.passives ?? []);
  const switchTriggers = sortByIdentity(compiledContracts.switchTriggers ?? []);
  const controls = sortByIdentity(compiledContracts.controls ?? []);
  const hits = sortByIdentity(compiledContracts.hits ?? []);
  const rawEffects = sortByIdentity(compiledContracts.effects?.raw ?? []);
  const semanticEffects = sortByIdentity(
    compiledContracts.effects?.semantic ?? []
  );
  const statDependencies = compiledContracts.statDependencies ?? {
    static: [],
    dynamic: [],
  };
  const hiddenAudit = reports.hiddenInputDerivation ?? null;
  const occupancyAudit = reports.actionOccupancy ?? null;
  const reachable = discoverReachableControls({
    ownerId,
    character,
    publicActions,
    actionForms,
    ownerContextEdges,
    ownerVariantEdges,
    resourceTransactions,
    passives,
    switchTriggers,
    hiddenAudit,
  });
  const actionTransitionCoverage = createActionTransitionCoverage({
    ownerId,
    publicActions,
    attackInputChains,
    controlTransitionWindows,
    variantEdges: ownerVariantEdges,
    variantWindowBindings,
    resourceTransactions,
    actionEffectBindings,
    rawEffects,
  });
  const unresolvedLedger = createUnresolvedLedger({
    ownerId,
    publicActions,
    controls,
    resourceTransactions,
    ownerContextEdges,
    ownerVariantEdges,
    passives,
    switchTriggers,
    hiddenAudit,
    occupancyAudit,
    recipe,
    actionTransitionCoverage,
    tuningMarkConditionalDamageGroups,
  });
  const unresolvedRecords = unresolvedLedger.records;
  const coverage = createCoverage({
    publicActions,
    actionForms,
    ownerContextEdges,
    hiddenAudit,
    occupancyAudit,
    controls,
    hits,
    rawEffects,
    semanticEffects,
    specialResourceProfiles,
    resourceTransactions,
    thresholdTransitions,
    targetStateProfiles,
    targetStateTransactions,
    conditionalHitGroups,
    tuningMarkConditionalDamageGroups,
    runtimeEffectBindings,
    passives,
    switchTriggers,
    statDependencies,
    unresolvedRecords,
    mechanicsPackage,
    ownerId,
  });
  const sourceManifest = createSourceManifest({
    ownerId,
    mechanicsPackage,
    values: [
      publicActions,
      actionForms,
      controls,
      ownerContextEdges,
      ownerVariantEdges,
      attackInputChains,
      controlTransitionWindows,
      variantWindowBindings,
      actionEffectBindings,
      specialResourceProfiles,
      resourceTransactions,
      thresholdTransitions,
      targetStateProfiles,
      targetStateTransactions,
      conditionalHitGroups,
      tuningMarkConditionalDamageGroups,
      runtimeEffectBindings,
      passives,
      switchTriggers,
      semanticEffects,
    ],
    recipe,
  });
  const reachableGraph = createReachableGraph({
    ownerId,
    publicActions,
    actionForms,
    controls,
    ownerContextEdges,
    ownerVariantEdges,
    specialResourceProfiles,
    resourceTransactions,
    thresholdTransitions,
    targetStateProfiles,
    targetStateTransactions,
    conditionalHitGroups,
    tuningMarkConditionalDamageGroups,
    runtimeEffectBindings,
    passives,
    switchTriggers,
    hits,
    reachable,
  });
  const descriptionCoverage = createDescriptionCoverage({
    ownerId,
    skills: (skills ?? []).filter(
      skill => Number(skill.characterId) === ownerId
    ),
    publicActions,
    actionForms,
    ownerContextEdges,
    hits,
    specialResourceProfiles,
    resourceTransactions,
    thresholdTransitions,
    targetStateProfiles,
    targetStateTransactions,
    conditionalHitGroups,
    tuningMarkConditionalDamageGroups,
    runtimeEffectBindings,
    passives,
    switchTriggers,
    semanticEffects,
    recipe,
  });
  const runtimeCoverage = createRuntimeCoverage({
    ownerId,
    sourcePackageHash,
    publicActions,
    actionForms,
    controls,
    hits,
    rawEffects,
    semanticEffects,
    specialResourceProfiles,
    resourceTransactions,
    thresholdTransitions,
    targetStateProfiles,
    targetStateTransactions,
    conditionalHitGroups,
    tuningMarkConditionalDamageGroups,
    runtimeEffectBindings,
    passives,
    switchTriggers,
    coverage,
    descriptionCoverage,
  });
  const actionPhaseCoverage = createActionPhaseCoverage({
    ownerId,
    publicActions,
    attackInputChains,
    variantEdges: ownerVariantEdges,
    variantWindowBindings,
    resourceTransactions,
    actionEffectBindings,
  });
  const capturePlan = createRuntimeCapturePlan(unresolvedRecords, ownerId);
  const goldenFixture = createGoldenFixture({
    ownerId,
    goldenRuntime,
    sourcePackageHash,
  });
  const denominator = {
    publicActionCount: publicActions.length,
    reachableControlCount: controls.length,
    executionFormCount: actionForms.length,
    verifiedWindowCount:
      hiddenAudit?.rows?.length ??
      ownerContextEdges.reduce(
        (sum, edge) => sum + (edge.inputWindow ? 1 : 0),
        0
      ),
    hitCount: hits.length,
    semanticEffectCount: semanticEffects.length,
    excludedControlCount: reachable.exclusions.length,
  };
  const contracts = {
    publicActions,
    actionForms,
    controls,
    timingInputEdges: ownerContextEdges,
    variantEdges: ownerVariantEdges,
    attackInputChains,
    controlTransitionWindows,
    variantWindowBindings,
    actionEffectBindings,
    hits,
    resourceProfiles: specialResourceProfiles,
    resourceTransactions,
    stateMachines: thresholdTransitions,
    targetStateProfiles,
    targetStateTransactions,
    conditionalHitGroups,
    tuningMarkConditionalDamageGroups,
    runtimeEffectBindings,
    effects: {
      raw: rawEffects,
      semantic: semanticEffects,
    },
    passives,
    switchTriggers,
    statDependencies,
  };
  const profileIdentity = `actor:${ownerId}:character-combat-profile:v${CHARACTER_COMBAT_PROFILE_SCHEMA_VERSION}`;
  const runtimeCompilation = createRuntimeCompilation({
    ownerId,
    profileIdentity,
    contracts,
    sourceCompilation: compiledOwnerContract,
  });
  const lifecycle = deriveCharacterCombatLifecycle({
    coverage,
    publicActions,
    actionForms,
    unresolvedRecords,
    runtimeCompilation,
    runtimeCoverage,
    uiVerification: recipe.uiVerification,
  });
  const simulationScopes = deriveCharacterCombatSimulationScopes({
    recipe,
    publicActions,
    actionForms,
    specialResourceProfiles,
    actionEffectBindings,
    passives,
    actionTransitionCoverage,
    capturePlan,
    goldenFixture,
    unresolvedRecords,
    runtimeCoverage,
  });
  const profileBase = {
    schemaVersion: CHARACTER_COMBAT_PROFILE_SCHEMA_VERSION,
    kind: 'azpr-character-combat-profile',
    profileIdentity,
    pipelineMaturity: lifecycle.pipelineMaturity,
    combatCoverageState: lifecycle.combatCoverageState,
    characterComplete: lifecycle.characterComplete,
    zeroDistanceSimulationComplete:
      simulationScopes.zeroDistance.complete === true,
    realClientEvidenceComplete:
      simulationScopes.realClientEvidence.complete === true,
    simulationScopes,
    maturityGates: lifecycle.gates,
    completionState: lifecycle.pipelineMaturity,
    targetPipelineMaturity: recipe.targetPipelineMaturity ?? 'profile-compiled',
    owner: {
      ownerKind: 'actor',
      ownerId,
      ownerName: character.name ?? null,
      englishName: character.englishName ?? null,
    },
    sourcePackage: {
      packageId: mechanicsPackage.packageId,
      packageHash: sourcePackageHash,
      region: mechanicsPackage.region,
      clientBuild: mechanicsPackage.clientBuild,
    },
    policy: {
      sourceStatuses: [...CHARACTER_COMBAT_PROFILE_STATUSES],
      descriptionsAreDiscoveryOnly: true,
      unresolvedValuesAreNeverZero: true,
      runtimeOperatorsAreOwnerAgnostic: true,
      uiDoesNotMaintainCharacterRules: true,
    },
    denominator,
    contracts,
    runtimeCompilation,
    coverage,
    unresolvedRecords,
    validation: {
      status: 'pending',
      issues: [],
    },
  };
  const validation = validateCharacterCombatProfile({
    profile: profileBase,
    recipe,
    sourceManifest,
    reachableGraph,
    descriptionCoverage,
    runtimeCoverage,
    goldenFixture,
  });
  const profileWithoutHash = {
    ...profileBase,
    validation,
  };
  const profile = {
    ...profileWithoutHash,
    profileHash: sha256Json(profileWithoutHash),
  };
  if (profile.validation.status !== 'character-combat-profile-valid') {
    throw new Error(
      `character combat profile invalid for ${ownerId}: ${profile.validation.issues.join(
        ', '
      )}`
    );
  }
  return {
    compiledOwnerContract,
    profile,
    sourceManifest: {
      ...sourceManifest,
      profileHash: profile.profileHash,
    },
    reachableGraph: {
      ...reachableGraph,
      profileHash: profile.profileHash,
    },
    descriptionCoverage: {
      ...descriptionCoverage,
      profileHash: profile.profileHash,
    },
    runtimeCoverage: {
      ...runtimeCoverage,
      profileHash: profile.profileHash,
    },
    actionPhaseCoverage: {
      ...actionPhaseCoverage,
      profileHash: profile.profileHash,
    },
    actionPhaseMarkdown: createActionPhaseCoverageMarkdown({
      ...actionPhaseCoverage,
      profileHash: profile.profileHash,
    }),
    actionTransitionCoverage: {
      ...actionTransitionCoverage,
      profileHash: profile.profileHash,
    },
    actionTransitionMarkdown: createActionTransitionCoverageMarkdown({
      ...actionTransitionCoverage,
      profileHash: profile.profileHash,
    }),
    unresolvedLedger: {
      schemaVersion: 1,
      kind: 'azpr-character-combat-unresolved-ledger',
      ownerId,
      profileHash: profile.profileHash,
      summary: unresolvedLedger.summary,
      records: unresolvedRecords,
      rawRecords: unresolvedLedger.rawRecords,
    },
    capturePlan: {
      ...capturePlan,
      profileHash: profile.profileHash,
    },
    goldenFixture: {
      ...goldenFixture,
      profileHash: profile.profileHash,
    },
    summaryMarkdown: createOwnerSummaryMarkdown({
      profile,
      sourceManifest,
      reachableGraph,
      descriptionCoverage,
      runtimeCoverage,
      capturePlan,
    }),
  };
}

export function validateCharacterCombatProfile({
  profile,
  recipe,
  sourceManifest,
  reachableGraph,
  descriptionCoverage,
  runtimeCoverage,
  goldenFixture,
}) {
  const issues = [];
  if (profile.schemaVersion !== CHARACTER_COMBAT_PROFILE_SCHEMA_VERSION) {
    issues.push('schema-version-invalid');
  }
  if (!CHARACTER_COMBAT_PROGRESS_STATES.includes(profile.completionState)) {
    issues.push('completion-state-invalid');
  }
  if (
    !CHARACTER_COMBAT_PROGRESS_STATES.includes(profile.pipelineMaturity) ||
    profile.completionState !== profile.pipelineMaturity
  ) {
    issues.push('pipeline-maturity-invalid');
  }
  if (
    !CHARACTER_COMBAT_COVERAGE_STATES.includes(profile.combatCoverageState) ||
    profile.characterComplete !==
      (profile.combatCoverageState === 'complete' &&
        profile.pipelineMaturity === 'ui-verified')
  ) {
    issues.push('combat-coverage-state-invalid');
  }
  if (
    profile.zeroDistanceSimulationComplete !==
      (profile.simulationScopes?.zeroDistance?.complete === true) ||
    profile.realClientEvidenceComplete !==
      (profile.simulationScopes?.realClientEvidence?.complete === true)
  ) {
    issues.push('simulation-scope-state-invalid');
  }
  if (
    profile.coverage.length !== COVERAGE_DIMENSIONS.length ||
    profile.coverage.some(
      item => !CHARACTER_COMBAT_PROFILE_STATUSES.includes(item.status)
    )
  ) {
    issues.push('coverage-dimension-contract-invalid');
  }
  if (
    profile.contracts.publicActions.some(
      action =>
        Number(action.ownerId) !== profile.owner.ownerId || !action.identity
    )
  ) {
    issues.push('public-action-owner-or-identity-invalid');
  }
  if (
    profile.contracts.controls.some(
      control => !Number.isInteger(Number(control.controlSkillId))
    )
  ) {
    issues.push('control-identity-invalid');
  }
  if (
    profile.contracts.timingInputEdges.some(
      edge =>
        edge.applied !== true ||
        edge.inputScheduling?.status !== 'applied' ||
        !edge.sourceIdentity
    )
  ) {
    issues.push('context-input-edge-invalid');
  }
  if (!sourceManifest.entries.length || !reachableGraph.nodes.length) {
    issues.push('source-or-reachable-graph-empty');
  }
  if (
    descriptionCoverage.entries.some(
      entry => !CHARACTER_COMBAT_PROFILE_STATUSES.includes(entry.status)
    )
  ) {
    issues.push('description-coverage-status-invalid');
  }
  if (runtimeCoverage.sourcePackageHash !== profile.sourcePackage.packageHash) {
    issues.push('runtime-coverage-package-hash-mismatch');
  }
  const expectedRuntimeCompilation = createRuntimeCompilation({
    ownerId: profile.owner.ownerId,
    profileIdentity: profile.profileIdentity,
    contracts: profile.contracts,
    sourceCompilation: profile.runtimeCompilation.sourceCompilation,
  });
  if (
    profile.runtimeCompilation?.status !==
      'character-combat-runtime-contract-compiled' ||
    profile.runtimeCompilation.contractHash !==
      expectedRuntimeCompilation.contractHash
  ) {
    issues.push('runtime-compilation-contract-invalid');
  }
  if (goldenFixture.durationMs !== 120_000) {
    issues.push('golden-fixture-duration-invalid');
  }
  if (
    goldenFixture.kind !==
      'azpr-character-combat-authoritative-golden-runtime' ||
    goldenFixture.status !== 'authoritative-golden-runtime-verified' ||
    goldenFixture.validation?.passed !== true ||
    goldenFixture.validation?.assertionCount < 1 ||
    !/^[a-f0-9]{64}$/.test(String(goldenFixture.replayHash ?? ''))
  ) {
    issues.push('golden-authoritative-replay-invalid');
  }
  for (const [field, expected] of Object.entries(recipe.expected ?? {})) {
    const actual = resolveExpectedMetric(profile, field);
    if (actual !== Number(expected)) {
      issues.push(`expected-${field}-mismatch:${actual}/${expected}`);
    }
  }
  return {
    status:
      issues.length === 0
        ? 'character-combat-profile-valid'
        : 'character-combat-profile-invalid',
    issues,
    deterministicInputHash: sha256Json({
      owner: profile.owner,
      sourcePackage: profile.sourcePackage,
      denominator: profile.denominator,
      contracts: profile.contracts,
      runtimeCompilation: profile.runtimeCompilation,
      unresolvedRecords: profile.unresolvedRecords,
    }),
  };
}

function resolveExpectedMetric(profile, field) {
  const metrics = {
    publicActionCount: profile.denominator.publicActionCount,
    publicExecutionFormCount: profile.denominator.executionFormCount,
    verifiedWindowCount: profile.denominator.verifiedWindowCount,
    contextEdgeCount: profile.contracts.timingInputEdges.length,
    attackInputChainCount: profile.contracts.attackInputChains.length,
    specialResourceProfileCount: profile.contracts.resourceProfiles.length,
    thresholdTransitionCount: profile.contracts.stateMachines.length,
    passiveEffectCount: profile.contracts.passives.length,
  };
  return Number(metrics[field]);
}

function createActionForms({
  ownerId,
  publicActions,
  publicActionForms,
  attackInputChains,
  hiddenAudit,
}) {
  if (Array.isArray(hiddenAudit?.publicExecutionForms)) {
    return hiddenAudit.publicExecutionForms.map(form => ({
      ...form,
      ownerId,
      sourceKind: 'verified-hidden-input-public-execution-form',
    }));
  }
  return dedupeBy(
    [
      ...publicActions.map(action => ({
        formIdentity: `${action.identity}:default`,
        ownerId,
        publicActionIdentity: action.identity,
        actionKind: action.actionKind,
        sourceSkillId: action.sourceSkillId,
        controlSkillId: action.controlSkillId,
        subSkillIndex: action.selectedSubSkillIndex ?? 0,
        status:
          action.classification === 'applied'
            ? 'applied'
            : 'static-evidence-gap',
        sourceIdentity: action.sourceIdentity,
      })),
      ...attackInputChains.flatMap(chain =>
        chain.segments.map(segment => ({
          formIdentity: `${chain.chainIdentity}:segment:${segment.sequenceIndex}`,
          ownerId,
          publicActionIdentity: `actor:${ownerId}:normal-attack`,
          actionKind: 'normal-attack',
          sourceSkillId: chain.sourceSkillId,
          controlSkillId: segment.controlSkillId,
          subSkillIndex: segment.subSkillIndex,
          sequenceIndex: segment.sequenceIndex,
          sequenceTotal: segment.sequenceTotal,
          status: segment.applied ? 'applied' : 'static-evidence-gap',
          sourceIdentity: segment.sourceIdentity,
        }))
      ),
      ...publicActionForms,
    ],
    form =>
      form.formIdentity ??
      [
        form.publicActionIdentity,
        form.controlSkillId ?? form.executionControlSkillId,
        form.subSkillIndex ?? form.executionSubSkillIndex,
      ].join('|')
  ).sort(compareIdentity);
}

function discoverReachableControls({
  ownerId,
  character,
  publicActions,
  actionForms,
  ownerContextEdges,
  ownerVariantEdges,
  resourceTransactions,
  passives,
  switchTriggers,
  hiddenAudit,
}) {
  const controlIds = new Set();
  const add = value => {
    const id = Number(value);
    if (Number.isInteger(id) && id > 0) controlIds.add(id);
  };
  for (const action of publicActions) {
    add(action.controlSkillId);
    for (const segment of action.attackInputSegments ?? []) {
      add(segment.controlSkillId);
    }
  }
  for (const form of actionForms) {
    add(form.controlSkillId);
    add(form.publicControlSkillId);
    add(form.executionControlSkillId);
    add(form.sourceControlSkillId);
    add(form.targetControlSkillId);
  }
  for (const edge of [...ownerContextEdges, ...ownerVariantEdges]) {
    add(edge.sourceControlSkillId);
    add(edge.targetControlSkillId);
    add(edge.executionControlSkillId);
  }
  for (const operation of resourceTransactions) add(operation.controlSkillId);
  for (const passive of passives) {
    add(passive.skillId);
    for (const trigger of passive.triggerBindings ?? []) {
      add(trigger.controlSkillId);
      add(trigger.runtimeControlSkillId);
    }
  }
  for (const profile of switchTriggers) {
    add(profile.controlSkillId);
    add(profile.sourceControlSkillId);
    add(profile.executionControlSkillId);
  }
  for (const form of hiddenAudit?.publicExecutionForms ?? []) {
    add(form.sourceControlSkillId);
    add(form.executionControlSkillId);
  }
  for (const row of hiddenAudit?.rows ?? []) {
    if (row.applied || row.publiclyReachable) {
      add(row.sourceControlSkillId);
      add(row.targetControlSkillId);
    }
  }
  const exclusions = (character.skillSlots ?? [])
    .filter(slot => slot.group === 'backup')
    .filter(slot => !controlIds.has(Number(slot.skillId)))
    .map(slot => ({
      ownerId,
      controlSkillId: Number(slot.skillId),
      sourceIdentity: `characters.items[id=${ownerId}].skillSlots[group=backup,skillId=${slot.skillId}]`,
      status: 'not-applicable',
      exclusionReason:
        'backup-control-not-reachable-from-public-action-or-verified-runtime-edge',
    }))
    .sort((left, right) => left.controlSkillId - right.controlSkillId);
  return { controlIds, exclusions };
}

function createCoverage(input) {
  const dimensions = {
    publicActions: statusForRecords(
      input.publicActions,
      action => action.classification === 'applied',
      action => action.reasons
    ),
    hiddenAndDerivedForms: statusForRecords(
      input.actionForms,
      form => ['applied', true].includes(form.status) || form.applied === true,
      form => form.reasons
    ),
    inputAndExecutionTiming: statusForRecords(
      input.ownerContextEdges,
      edge =>
        edge.applied === true && edge.inputScheduling?.status === 'applied',
      edge => edge.reasons
    ),
    effectiveOccupancy: statusForRecords(
      input.occupancyAudit?.rows ?? input.actionForms,
      row =>
        row.status === 'applied' ||
        row.occupancyStatus === 'applied' ||
        row.applied === true,
      row => row.reasons
    ),
    hitsAndProjectiles: statusForRecords(
      input.hits,
      hit =>
        ['applied', 'source-verified'].includes(hit.sourceEvidenceStatus) &&
        !hit.reasons?.length,
      hit => hit.reasons
    ),
    hpDamage: statusFromActionDimension(input.publicActions, 'hp'),
    toughnessDamage: statusFromActionDimension(
      input.publicActions,
      'toughness'
    ),
    actorSp: statusFromActionDimension(input.publicActions, 'actorSp'),
    kiboSp: statusFromActionDimension(input.publicActions, 'kiboSp'),
    cooldowns: statusForRecords(
      input.controls,
      control =>
        control.logic?.cooldownMs != null ||
        control.logic?.status === 'verified-skill-logic-ready',
      control => [
        ...(control.logic ? [] : ['skill-logic-missing']),
        ...(control.logic?.cooldownMs == null
          ? ['cooldown-field-unresolved']
          : []),
      ]
    ),
    personalResources: statusForRecords(
      [
        ...input.specialResourceProfiles,
        ...input.resourceTransactions,
        ...input.thresholdTransitions,
      ],
      item => item.applied === true || item.status === 'not-applicable',
      item => item.reasons
    ),
    teamResourcesAndMarks: input.mechanicsPackage.tuningMechanicsCatalog
      ?.profiles?.length
      ? createCoverageStatus('applied', [
          'verified-combat-mechanics-package.tuningMechanicsCatalog',
        ])
      : createCoverageStatus('static-evidence-gap', []),
    buffsAndDebuffs: statusForRecords(
      [
        ...input.semanticEffects,
        ...input.passives,
        ...input.runtimeEffectBindings,
      ],
      item => item.classification === 'applied' || item.applied === true,
      item => item.reasons
    ),
    passives: statusForRecords(
      input.passives,
      item => item.applied === true,
      item => item.reasons
    ),
    dynamicProperties: statusForRecords(
      [
        ...input.statDependencies.dynamic,
        ...input.runtimeEffectBindings.flatMap(binding =>
          (binding.modifiers ?? [])
            .filter(modifier => modifier.kind === 'battle-property')
            .map(modifier => ({
              ...modifier,
              status: binding.applied ? 'applied' : binding.status,
              sourceIdentity: binding.sourceIdentity,
              reasons: binding.reasons,
            }))
        ),
      ],
      item => item.status === 'applied',
      item => item.reasons
    ),
    healingAndShields: statusForRecords(
      input.semanticEffects.filter(
        effect =>
          effect.kind === 'heal' ||
          effect.kind === 'shield' ||
          effect.dimensions?.hp?.status === 'applied' ||
          effect.dimensions?.shield?.status === 'applied'
      ),
      item => item.classification === 'applied',
      item => item.reasons,
      'not-applicable'
    ),
    stateMachines: statusForRecords(
      [
        ...input.thresholdTransitions,
        ...input.targetStateProfiles,
        ...input.targetStateTransactions,
        ...input.conditionalHitGroups,
        ...input.tuningMarkConditionalDamageGroups,
      ],
      item => item.applied === true,
      item => item.reasons
    ),
    switchAndStarCarry: statusForRecords(
      input.switchTriggers,
      item => item.applied === true,
      item => item.reasons
    ),
    frontBackDifferences:
      input.mechanicsPackage.spUnitContract?.status ===
      'verified-sp-unit-contract-ready'
        ? createCoverageStatus('applied', [
            'verified-combat-mechanics-package.spUnitContract',
          ])
        : createCoverageStatus('static-evidence-gap', []),
    loadoutAndTeamStatPropagation:
      input.statDependencies.static.length > 0
        ? createCoverageStatus(
            'applied',
            input.statDependencies.static.map(item => item.sourceIdentity)
          )
        : createCoverageStatus('static-evidence-gap', []),
  };
  return COVERAGE_DIMENSIONS.map(dimension => ({
    dimension,
    ...dimensions[dimension],
  }));
}

function createStatDependencies({
  ownerId,
  mechanicsPackage,
  passives,
  semanticEffects,
}) {
  const staticActor = (
    mechanicsPackage.staticPropertyCatalog?.actorProfiles ?? []
  ).find(profile => Number(profile.characterId) === ownerId);
  const actorSp = (mechanicsPackage.ownerProfiles?.actor ?? []).find(
    profile => Number(profile.characterId) === ownerId
  );
  const dynamic = [
    ...passives.flatMap(passive =>
      (passive.modifiers ?? []).map(modifier => ({
        sourceKind: 'passive-dynamic-property',
        passiveIdentity: passive.passiveIdentity,
        ...modifier,
        status: passive.applied ? 'applied' : 'static-evidence-gap',
      }))
    ),
    ...semanticEffects
      .filter(
        effect => effect.dimensions?.dynamicProperty?.status === 'applied'
      )
      .map(effect => ({
        sourceKind: 'semantic-effect-dynamic-property',
        semanticIdentity: effect.semanticIdentity,
        attributeId: effect.propertyChange?.attributeId ?? null,
        bucket: effect.propertyChange?.bucket ?? null,
        sourceIdentity: effect.sourceIdentities?.join('|') ?? null,
        status: effect.classification,
      })),
  ];
  const staticDependencies = [
    staticActor
      ? {
          sourceKind: 'verified-static-actor-profile',
          characterId: ownerId,
          sourceIdentity:
            staticActor.sourceIdentity ??
            `verified-static-property-catalog:actor:${ownerId}`,
          status: 'applied',
        }
      : null,
    actorSp
      ? {
          sourceKind: 'verified-actor-sp-profile',
          characterId: ownerId,
          sourceIdentity:
            actorSp.sourceIdentity ?? `verified-owner-profile:actor:${ownerId}`,
          status: 'applied',
        }
      : null,
  ].filter(Boolean);
  return {
    static: staticDependencies,
    dynamic,
    propagation: {
      equipmentAndSoulessence:
        staticActor != null ? 'applied' : 'static-evidence-gap',
      teamEffects: semanticEffects.some(
        effect => effect.target?.kind === 'team-actors'
      )
        ? 'applied'
        : 'not-applicable',
      kiboInheritance:
        mechanicsPackage.staticPropertyCatalog?.kiboProfiles?.length > 0
          ? 'applied'
          : 'static-evidence-gap',
    },
  };
}

function createSourceManifest({ ownerId, mechanicsPackage, values, recipe }) {
  const identities = new Set();
  for (const value of values) collectSourceIdentities(value, identities);
  const entries = [...identities]
    .filter(Boolean)
    .sort()
    .map(identity => ({
      identity,
      sourceIdentity: identity,
      identityHash: sha256(identity),
      sourceKind: classifySourceIdentity(identity),
      status: 'evidence-indexed',
    }));
  return {
    schemaVersion: 1,
    kind: 'azpr-character-combat-source-manifest',
    ownerId,
    sourcePackage: {
      packageId: mechanicsPackage.packageId,
      packageHash:
        mechanicsPackage.characterCombatProfileCatalog?.sourcePackageHash ??
        mechanicsPackage.packageHash,
    },
    recipeIdentity: `scripts/character-combat/profile-recipes/${ownerId}.json`,
    recipeHash: sha256Json(recipe),
    authoritativeSources: (mechanicsPackage.sourceFiles ?? []).map(source => ({
      id: source.id,
      sourceIdentity: `source-file:${source.id}:${source.sha256}`,
      sha256: source.sha256,
      bytes: source.bytes,
      validationStatus: source.validationStatus ?? 'verified',
    })),
    entries,
    summary: {
      identityCount: entries.length,
      sourceKindCounts: countBy(entries, entry => entry.sourceKind),
    },
  };
}

function createReachableGraph({
  ownerId,
  publicActions,
  actionForms,
  controls,
  ownerContextEdges,
  ownerVariantEdges,
  specialResourceProfiles,
  resourceTransactions,
  thresholdTransitions,
  targetStateProfiles,
  targetStateTransactions,
  conditionalHitGroups,
  tuningMarkConditionalDamageGroups,
  runtimeEffectBindings,
  passives,
  switchTriggers,
  hits,
  reachable,
}) {
  const nodes = [];
  const edges = [];
  const addNode = (nodeIdentity, nodeKind, data = {}) => {
    nodes.push({ nodeIdentity, nodeKind, ...data });
  };
  const addEdge = (from, to, relation, data = {}) => {
    if (!from || !to) return;
    edges.push({
      edgeIdentity: `${from}->${relation}->${to}`,
      from,
      to,
      relation,
      ...data,
    });
  };
  for (const action of publicActions) {
    addNode(action.identity, 'public-action', {
      actionKind: action.actionKind,
      sourceSkillId: action.sourceSkillId,
      status: mapClassification(action.classification),
    });
    addEdge(
      action.identity,
      `control:${action.controlSkillId}`,
      'executes-control'
    );
  }
  for (const form of actionForms) {
    const identity =
      form.formIdentity ??
      `${form.publicActionIdentity}:control:${form.controlSkillId}:sub:${form.subSkillIndex}`;
    addNode(identity, 'action-form', {
      semanticName: form.semanticName ?? form.actionName ?? null,
      status: mapClassification(form.status ?? form.applied),
    });
    addEdge(
      form.publicActionIdentity ??
        publicActions.find(action => action.actionKind === form.actionKind)
          ?.identity,
      identity,
      'has-form'
    );
    addEdge(
      identity,
      `control:${
        form.executionControlSkillId ??
        form.controlSkillId ??
        form.sourceControlSkillId
      }`,
      'executes-control'
    );
  }
  for (const control of controls) {
    addNode(`control:${control.controlSkillId}`, 'control', {
      controlSkillId: control.controlSkillId,
      sourceIdentity: control.sourcePath,
      status: control.applied ? 'applied' : 'static-evidence-gap',
    });
    for (const variant of control.variants ?? []) {
      const variantIdentity = `control:${control.controlSkillId}:sub:${variant.subSkillIndex}`;
      addNode(variantIdentity, 'control-variant', {
        controlSkillId: control.controlSkillId,
        subSkillIndex: variant.subSkillIndex,
        sourceIdentity: variant.sourceIdentity,
        status: 'applied',
      });
      addEdge(
        `control:${control.controlSkillId}`,
        variantIdentity,
        'has-subskill'
      );
    }
  }
  for (const context of ownerContextEdges) {
    addEdge(
      `control:${context.sourceControlSkillId}:sub:${context.sourceSubSkillIndex}`,
      `control:${context.executionControlSkillId}:sub:${context.targetSubSkillIndex}`,
      'context-input-derived',
      {
        inputWindow: context.inputWindow,
        inputScheduling: context.inputScheduling,
        status: mapClassification(context.applied),
        sourceIdentity: context.sourceIdentity,
      }
    );
  }
  for (const edge of ownerVariantEdges) {
    addEdge(edge.from, edge.to, edge.relationType ?? 'variant', {
      condition: edge.condition,
      status: mapClassification(edge.applied),
      sourceIdentity: edge.sourceIdentity,
    });
  }
  for (const hit of hits) {
    const identity = `hit:${hit.hitIdentity}`;
    addNode(identity, 'hit', {
      controlSkillId: hit.controlSkillId,
      frame: hit.trigger?.impactFrame ?? hit.trigger?.startFrame ?? null,
      status: mapClassification(hit.sourceEvidenceStatus),
      sourceIdentity: hit.sourceIdentity,
    });
    addEdge(
      `control:${hit.controlSkillId}:sub:${hit.mapIndex}`,
      identity,
      'emits-hit'
    );
  }
  for (const profile of specialResourceProfiles) {
    addNode(profile.resourceIdentity, 'personal-resource', {
      capacity: profile.capacity,
      status: mapClassification(profile.applied),
      sourceIdentity: profile.sourceIdentity,
    });
  }
  for (const operation of resourceTransactions) {
    addEdge(
      `control:${operation.controlSkillId}:sub:${operation.subSkillIndex}`,
      operation.resourceIdentity,
      `resource-${operation.operation}`,
      {
        triggerFrame: operation.triggerFrame,
        status: mapClassification(operation.applied),
        sourceIdentity: operation.sourceIdentity,
      }
    );
  }
  for (const transition of thresholdTransitions) {
    const stateIdentity = `state:${transition.stateElementId}`;
    addNode(stateIdentity, 'state', {
      durationMs: transition.stateDurationMs,
      status: mapClassification(transition.applied),
      sourceIdentity: transition.sourceIdentity,
    });
    addEdge(transition.resourceIdentity, stateIdentity, 'threshold-transform', {
      threshold: transition.threshold,
      status: mapClassification(transition.applied),
    });
  }
  for (const profile of targetStateProfiles) {
    const stateIdentity = `target-state:${profile.stateIdentity}`;
    addNode(stateIdentity, 'target-state', {
      targetKind: profile.targetKind,
      durationMs: profile.durationMs,
      capacity: profile.maxStacks,
      status: mapClassification(profile.applied),
      sourceIdentity: profile.sourceIdentity,
    });
  }
  for (const transaction of targetStateTransactions) {
    addEdge(
      `control:${transaction.controlSkillId}:sub:${transaction.subSkillIndex}`,
      `target-state:${transaction.stateIdentity}`,
      `target-state-${transaction.operation}`,
      {
        triggerFrame: transaction.triggerFrame,
        amount: transaction.amount,
        requiresHitElementId: transaction.requiresHitElementId,
        status: mapClassification(transaction.applied),
        sourceIdentity: transaction.sourceIdentity,
      }
    );
  }
  for (const group of conditionalHitGroups) {
    const groupIdentity = `conditional-hit-group:${group.groupIdentity}`;
    addNode(groupIdentity, 'conditional-hit-group', {
      decisionFrame: group.decisionFrame,
      minimumStacks: group.minimumStacks,
      status: mapClassification(group.applied),
      sourceIdentity: group.sourceIdentity,
    });
    addEdge(
      `target-state:${group.stateIdentity}`,
      groupIdentity,
      'conditions-hit-group',
      {
        status: mapClassification(group.applied),
        sourceIdentity: group.sourceIdentity,
      }
    );
    addEdge(
      groupIdentity,
      `control:${group.controlSkillId}:sub:${group.subSkillIndex}`,
      'materializes-conditional-hits',
      {
        status: mapClassification(group.applied),
        sourceIdentity: group.sourceIdentity,
      }
    );
  }
  for (const group of tuningMarkConditionalDamageGroups) {
    const groupIdentity = `tuning-mark-conditional-damage-group:${group.groupIdentity}`;
    addNode(groupIdentity, 'tuning-mark-conditional-damage-group', {
      triggerFrames: group.triggerFrames,
      minimumStacks: group.minimumStacks,
      tuningMarkProfileKey: group.tuningMarkProfileKey,
      status: mapClassification(group.applied),
      sourceIdentity: group.sourceIdentity,
    });
    addEdge(
      `control:${group.controlSkillId}:sub:${group.subSkillIndex}`,
      groupIdentity,
      'materializes-tuning-mark-conditional-damage',
      {
        status: mapClassification(group.applied),
        sourceIdentity: group.sourceIdentity,
      }
    );
  }
  for (const binding of runtimeEffectBindings) {
    const effectIdentity = `runtime-effect:${binding.bindingIdentity}`;
    addNode(effectIdentity, 'runtime-effect', {
      effectId: binding.effectId,
      targetKind: binding.targetKind,
      status: mapClassification(binding.applied),
      sourceIdentity: binding.sourceIdentity,
    });
    addEdge(
      binding.triggerKind === 'conditional-hit-group-applied'
        ? `conditional-hit-group:${binding.conditionalGroupIdentity}`
        : `control:${binding.controlSkillId}:sub:${binding.subSkillIndex}`,
      effectIdentity,
      'triggers-runtime-effect',
      {
        triggerFrame: binding.triggerFrame,
        status: mapClassification(binding.applied),
        sourceIdentity: binding.sourceIdentity,
      }
    );
  }
  for (const passive of passives) {
    addNode(passive.passiveIdentity, 'passive-listener', {
      skillId: passive.skillId,
      status: mapClassification(passive.applied),
      sourceIdentity: passive.sourceIdentity,
    });
    for (const trigger of passive.triggerBindings ?? []) {
      addEdge(
        `control:${trigger.controlSkillId}:sub:${trigger.subSkillIndex}`,
        passive.passiveIdentity,
        'triggers-passive',
        {
          triggerFrame: trigger.triggerFrame,
          sourceIdentity: trigger.sourceIdentity,
          status: mapClassification(trigger.applied),
        }
      );
    }
  }
  for (const profile of switchTriggers) {
    const identity = `switch-trigger:${ownerId}:${profile.triggerPhase}`;
    addNode(identity, 'switch-trigger', {
      triggerPhase: profile.triggerPhase,
      status: mapClassification(profile.applied),
      sourceIdentity: profile.sourceIdentity,
    });
    addEdge(identity, profile.starCarryActionIdentity, 'derives-star-carry', {
      status: mapClassification(profile.applied),
    });
  }
  return {
    schemaVersion: 1,
    kind: 'azpr-character-combat-reachable-graph',
    ownerId,
    nodes: dedupeBy(nodes, node => node.nodeIdentity).sort(compareIdentity),
    edges: dedupeBy(edges, edge => edge.edgeIdentity).sort(compareIdentity),
    exclusions: reachable.exclusions,
    summary: {
      nodeCount: dedupeBy(nodes, node => node.nodeIdentity).length,
      edgeCount: dedupeBy(edges, edge => edge.edgeIdentity).length,
      controlCount: controls.length,
      exclusionCount: reachable.exclusions.length,
      nodeKindCounts: countBy(nodes, node => node.nodeKind),
      edgeRelationCounts: countBy(edges, edge => edge.relation),
    },
  };
}

function createDescriptionCoverage({
  ownerId,
  skills,
  publicActions,
  actionForms,
  ownerContextEdges,
  hits,
  tuningMarkConditionalDamageGroups,
  specialResourceProfiles,
  resourceTransactions,
  thresholdTransitions,
  passives,
  switchTriggers,
  semanticEffects,
  recipe,
}) {
  const notApplicableBySkillId = new Map(
    (recipe.notApplicableSkills ?? []).map(item => [Number(item.skillId), item])
  );
  const entries = [];
  for (const skill of skills) {
    const clauses = splitDescriptionClauses(
      String(skill.description?.plain ?? skill.description?.raw ?? '')
    );
    const notApplicable = notApplicableBySkillId.get(Number(skill.id));
    clauses.forEach(({ text, paragraphIndex, clauseIndex }) => {
      const references = [];
      const mechanicKinds = [];
      const skillActions = publicActions.filter(
        action => Number(action.sourceSkillId) === Number(skill.id)
      );
      const actionKinds = resolveDescriptionActionKinds(text);
      const actions =
        actionKinds.length > 0
          ? skillActions.filter(action =>
              actionKinds.includes(action.actionKind)
            )
          : skillActions;
      let publicFormSettlements = [];
      if (/伤害/.test(text)) {
        mechanicKinds.push('action-settlement');
        references.push(...actions.map(action => action.identity));
        publicFormSettlements = actions.flatMap(action =>
          createPublicFormSettlementRows({
            action,
            actionForms,
            hits,
            tuningMarkConditionalDamageGroups,
            recipe,
          })
        );
        references.push(
          ...publicFormSettlements.flatMap(row => [
            row.publicFormId,
            ...row.settlementEvidence,
          ])
        );
      }
      if (actionKinds.length > 0) {
        mechanicKinds.push('action-form');
        references.push(
          ...actionForms
            .filter(form => actionKinds.includes(form.actionKind))
            .map(resolveActionFormIdentity)
            .filter(Boolean),
          ...ownerContextEdges
            .filter(edge => actionKinds.includes(edge.publicActionKind))
            .map(edge => edge.edgeIdentity)
        );
      }
      if (/缘结值|与君结缘/.test(text)) {
        mechanicKinds.push('personal-resource');
        references.push(
          ...specialResourceProfiles.map(profile => profile.resourceIdentity),
          ...resourceTransactions.map(operation => operation.operationIdentity),
          ...thresholdTransitions.map(
            transition => transition.transitionIdentity
          )
        );
      }
      if (/调谐印记|超限/.test(text)) {
        mechanicKinds.push('team-tuning-mark');
        references.push('verified-tuning-mechanics-catalog');
      }
      if (Number(skill.id) === Number(passives[0]?.skillId)) {
        mechanicKinds.push('passive-listener');
        references.push(...passives.map(passive => passive.passiveIdentity));
      }
      if (/入场时触发/.test(text)) {
        mechanicKinds.push('switch-trigger');
        references.push(
          ...switchTriggers.map(
            profile =>
              `switch-trigger:${profile.ownerId}:${profile.triggerPhase}`
          )
        );
      }
      references.push(
        ...semanticEffects
          .filter(effect =>
            (effect.publicActions ?? []).some(effectAction =>
              actions.some(
                action =>
                  effectAction.actionIdentity === action.identity ||
                  (Number(effectAction.sourceSkillId) ===
                    Number(action.sourceSkillId) &&
                    effectAction.actionKind === action.actionKind)
              )
            )
          )
          .map(effect => effect.semanticIdentity)
      );
      const uniqueReferences = [...new Set(references.filter(Boolean))].sort();
      const settlementStatuses = publicFormSettlements.map(row => row.status);
      const settlementStatus =
        mechanicKinds.includes('action-settlement') &&
        publicFormSettlements.length > 0
          ? settlementStatuses.every(status => status === 'applied')
            ? 'applied'
            : settlementStatuses.every(status => status === 'not-applicable')
              ? 'not-applicable'
              : settlementStatuses.includes('runtime-evidence-required')
                ? 'runtime-evidence-required'
                : 'static-evidence-gap'
          : null;
      const status = notApplicable
        ? 'not-applicable'
        : (settlementStatus ??
          (uniqueReferences.length > 0 ? 'applied' : 'static-evidence-gap'));
      const settlementReasons = publicFormSettlements.flatMap(
        row => row.reasons ?? []
      );
      entries.push({
        coverageIdentity: `actor:${ownerId}:skill:${skill.id}:description:${paragraphIndex}:${clauseIndex}`,
        skillId: Number(skill.id),
        skillName: skill.name ?? null,
        paragraphIndex,
        clauseIndex,
        text,
        mechanicKinds: [...new Set(mechanicKinds)].sort(),
        status,
        coverageReferences: uniqueReferences,
        publicFormSettlements,
        reasons: notApplicable
          ? [notApplicable.reason]
          : ['applied', 'not-applicable'].includes(status)
            ? []
            : [
                ...new Set(
                  settlementReasons.length > 0
                    ? settlementReasons
                    : [
                        'description-executable-effect-not-linked-to-static-profile',
                      ]
                ),
              ].sort(),
        sourceIdentity:
          notApplicable?.sourceIdentity ??
          skill.source?.heroModule ??
          `workbench-seed.skills[id=${skill.id}].description`,
      });
    });
  }
  return {
    schemaVersion: 1,
    kind: 'azpr-character-combat-description-coverage',
    ownerId,
    policy: {
      descriptionIsDiscoveryAndCrossCheckOnly: true,
      descriptionNeverCreatesAppliedValues: true,
    },
    entries: entries.sort(compareIdentity),
    summary: {
      entryCount: entries.length,
      statusCounts: countBy(entries, entry => entry.status),
    },
  };
}

function createPublicFormSettlementRows({
  action,
  actionForms,
  hits,
  tuningMarkConditionalDamageGroups,
  recipe,
}) {
  const forms = actionForms.filter(
    form =>
      String(form.formIdentity ?? '').startsWith(`${action.identity}:`) ||
      (form.publicActionKind === action.actionKind &&
        Number(form.ownerId) === Number(action.ownerId) &&
        Number(form.publicControlSkillId ?? action.controlSkillId) ===
          Number(action.controlSkillId))
  );
  const normalizedForms =
    forms.length > 0
      ? forms
      : [
          {
            formIdentity: `${action.identity}:default`,
            executionControlSkillId: action.controlSkillId,
            executionSubSkillIndex: null,
            syntheticFallback: true,
          },
        ];

  return normalizedForms.map(form => {
    const controlSelectors =
      form.syntheticFallback === true &&
      action.actionKind === 'normal-attack' &&
      (action.attackInputSegments ?? []).length > 0
        ? action.attackInputSegments.map(segment => ({
            controlSkillId: Number(segment.controlSkillId),
            subSkillIndex: normalizeOptionalInteger(
              segment.selectedSubSkillIndex ?? segment.subSkillIndex
            ),
          }))
        : [
            {
              controlSkillId: Number(
                form.executionControlSkillId ?? action.controlSkillId
              ),
              subSkillIndex: normalizeOptionalInteger(
                form.executionSubSkillIndex ?? form.subSkillIndex
              ),
            },
          ];
    const formHits = dedupeBy(
      hits.filter(hit =>
        controlSelectors.some(
          selector =>
            Number(hit.controlSkillId) === selector.controlSkillId &&
            (selector.subSkillIndex == null ||
              Number(hit.subSkillIndex ?? hit.mapIndex) ===
                selector.subSkillIndex)
        )
      ),
      hit => hit.hitIdentity
    );
    const formConditionalDamageGroups = dedupeBy(
      tuningMarkConditionalDamageGroups.filter(group =>
        controlSelectors.some(
          selector =>
            Number(group.controlSkillId) === selector.controlSkillId &&
            (selector.subSkillIndex == null ||
              Number(group.subSkillIndex) === selector.subSkillIndex)
        )
      ),
      group => group.groupIdentity
    );
    const conditionalHitCount = formConditionalDamageGroups.reduce(
      (sum, group) =>
        sum +
        Math.max(1, group.triggerFrames?.length ?? 0) *
          Math.max(1, group.hitDelaysMs?.length ?? 0),
      0
    );
    const gap = (recipe.unresolvedRecords ?? []).find(
      item =>
        item.sourceKind === 'public-form-settlement' &&
        (item.publicFormId === form.formIdentity ||
          item.publicActionIdentity === action.identity ||
          (Number(item.sourceSkillId) === Number(action.sourceSkillId) &&
            item.actionKind === action.actionKind &&
            (item.subSkillIndex == null ||
              Number(item.subSkillIndex) ===
                Number(form.executionSubSkillIndex))))
    );
    const status =
      formHits.length + conditionalHitCount > 0
        ? 'applied'
        : (gap?.status ?? 'static-evidence-gap');
    const dimensionSummary = createPublicFormHitDimensionSummary(
      formHits,
      formConditionalDamageGroups
    );
    return {
      actionIdentity: action.identity,
      publicFormId: form.formIdentity,
      actionKind: action.actionKind,
      sourceSkillId: Number(action.sourceSkillId),
      executionControlSkillId: Number(
        form.executionControlSkillId ?? action.controlSkillId
      ),
      executionSubSkillIndex: normalizeOptionalInteger(
        form.executionSubSkillIndex ?? form.subSkillIndex
      ),
      hitCount: formHits.length + conditionalHitCount,
      settlementEvidence: [
        ...formHits.map(hit => `hit:${hit.hitIdentity}`),
        ...formConditionalDamageGroups.map(
          group => `tuning-mark-conditional-damage-group:${group.groupIdentity}`
        ),
      ].sort(),
      dimensionSummary,
      status,
      reasons:
        status === 'applied'
          ? []
          : [
              ...new Set([
                'public-action-damage-settlement-evidence-missing',
                ...(gap?.reasons ?? []),
              ]),
            ].sort(),
      sourceIdentity:
        gap?.sourceIdentity ??
        form.sourceIdentity ??
        action.sourceIdentity ??
        null,
    };
  });
}

function createPublicFormHitDimensionSummary(
  hits,
  tuningMarkConditionalDamageGroups = []
) {
  const conditionalHitCount = tuningMarkConditionalDamageGroups.reduce(
    (sum, group) =>
      sum +
      Math.max(1, group.triggerFrames?.length ?? 0) *
        Math.max(1, group.hitDelaysMs?.length ?? 0),
    0
  );
  if (hits.length === 0 && conditionalHitCount === 0) {
    return Object.fromEntries(
      ['hp', 'toughness', 'actorSp', 'kiboSp'].map(dimension => [
        dimension,
        { unresolved: 1 },
      ])
    );
  }
  const statusForValue = value =>
    value == null
      ? 'unresolved'
      : Number(value) === 0
        ? 'verified-zero'
        : 'applied';
  const summary = {
    hp: countBy(hits, hit =>
      hit.formula && hit.damage ? 'applied' : 'unresolved'
    ),
    toughness: countBy(hits, hit =>
      statusForValue(hit.damage?.weakBreakDamageRateBasisPoints)
    ),
    actorSp: countBy(hits, hit => statusForValue(hit.energy?.recoverSp)),
    kiboSp: countBy(hits, hit => statusForValue(hit.energy?.petRecoverSp)),
  };
  if (conditionalHitCount > 0) {
    summary.hp.applied = Number(summary.hp.applied ?? 0) + conditionalHitCount;
    summary.toughness.applied =
      Number(summary.toughness.applied ?? 0) + conditionalHitCount;
    summary.actorSp.unresolved =
      Number(summary.actorSp.unresolved ?? 0) + conditionalHitCount;
    summary.kiboSp.unresolved =
      Number(summary.kiboSp.unresolved ?? 0) + conditionalHitCount;
  }
  return summary;
}

function normalizeOptionalInteger(value) {
  if (value == null) return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function splitDescriptionClauses(value) {
  const paragraphs = String(value)
    .replaceAll('\\n', '\n')
    .split(/\n{2,}/)
    .map(text => text.trim())
    .filter(Boolean);
  return paragraphs.flatMap((paragraph, paragraphIndex) =>
    paragraph
      .split(/(?<=[。；！？])|\n+/u)
      .map(text => text.trim())
      .filter(Boolean)
      .map((text, clauseIndex) => ({
        text,
        paragraphIndex,
        clauseIndex,
      }))
  );
}

function resolveDescriptionActionKinds(text) {
  const kinds = [];
  const patterns = [
    ['normal-attack', /普攻/],
    ['charged-attack', /重击/],
    ['dodge-attack', /闪击|闪避攻击/],
    ['plunging-attack', /跃击|下落攻击/],
    ['star-skill', /星鸣技/],
    ['star-combo', /星结合击/],
    ['star-carry', /星携技/],
    ['limit-counter', /极限反击/],
    ['perfect-parry', /完美招架/],
    ['ultimate', /星决技/],
  ];
  for (const [kind, pattern] of patterns) {
    if (pattern.test(text)) kinds.push(kind);
  }
  return kinds;
}

function resolveActionFormIdentity(form) {
  if (form.formIdentity) return form.formIdentity;
  const controlSkillId =
    form.executionControlSkillId ??
    form.sourceControlSkillId ??
    form.controlSkillId;
  const subSkillIndex =
    form.targetSubSkillIndex ?? form.sourceSubSkillIndex ?? form.subSkillIndex;
  if (
    !Number.isInteger(Number(controlSkillId)) ||
    !Number.isInteger(Number(subSkillIndex))
  ) {
    return null;
  }
  return `control:${Number(controlSkillId)}:sub:${Number(subSkillIndex)}`;
}

function createRuntimeCoverage({
  ownerId,
  sourcePackageHash,
  publicActions,
  actionForms,
  controls,
  hits,
  rawEffects,
  semanticEffects,
  specialResourceProfiles,
  resourceTransactions,
  thresholdTransitions,
  targetStateProfiles,
  targetStateTransactions,
  conditionalHitGroups,
  tuningMarkConditionalDamageGroups,
  runtimeEffectBindings,
  passives,
  switchTriggers,
  coverage,
  descriptionCoverage,
}) {
  const actionRows = publicActions.map(action => {
    const actionControlIds = new Set([
      Number(action.controlSkillId),
      ...(action.attackInputSegments ?? []).map(segment =>
        Number(segment.controlSkillId)
      ),
    ]);
    const actionHits = hits.filter(hit =>
      actionControlIds.has(Number(hit.controlSkillId))
    );
    const actionConditionalDamageGroups =
      tuningMarkConditionalDamageGroups.filter(group =>
        actionControlIds.has(Number(group.controlSkillId))
      );
    const settlementClauses = (descriptionCoverage?.entries ?? []).filter(
      entry =>
        entry.mechanicKinds?.includes('action-settlement') &&
        (entry.publicFormSettlements ?? []).some(
          row => row.actionIdentity === action.identity
        )
    );
    const publicFormSettlements = dedupeBy(
      settlementClauses.flatMap(entry =>
        (entry.publicFormSettlements ?? []).filter(
          row => row.actionIdentity === action.identity
        )
      ),
      row => row.publicFormId
    );
    const requiresDamageSettlement = settlementClauses.length > 0;
    const settlementStatus = requiresDamageSettlement
      ? publicFormSettlements.every(row => row.status === 'applied')
        ? 'applied'
        : publicFormSettlements.every(row => row.status === 'not-applicable')
          ? 'not-applicable'
          : publicFormSettlements.some(
                row => row.status === 'runtime-evidence-required'
              )
            ? 'runtime-evidence-required'
            : 'static-evidence-gap'
      : 'not-required';
    const sourceDrivenConditionalDamageReady =
      actionConditionalDamageGroups.length > 0 &&
      actionConditionalDamageGroups.every(group => group.applied === true);
    const runtimeReady =
      (action.runtimeReady === true || sourceDrivenConditionalDamageReady) &&
      (!requiresDamageSettlement || settlementStatus === 'applied');
    return {
      actionIdentity: action.identity,
      actionKind: action.actionKind,
      sourceSkillId: action.sourceSkillId,
      controlSkillIds: [...actionControlIds].filter(Number.isInteger).sort(),
      schedulable: action.schedulable !== false,
      sourceEvidenceStatus:
        action.sourceEvidenceStatus ?? mapClassification(action.classification),
      scenarioRuntimeStatus: runtimeReady
        ? (action.scenarioRuntimeStatus ?? 'applied')
        : settlementStatus,
      rawRuntimeReady: action.runtimeReady === true,
      sourceDrivenConditionalDamageReady,
      runtimeReady,
      notApplicable: settlementStatus === 'not-applicable',
      hitCount:
        publicFormSettlements.length > 0
          ? publicFormSettlements.reduce(
              (sum, row) => sum + Number(row.hitCount ?? 0),
              0
            )
          : actionHits.length,
      requiresDamageSettlement,
      settlementStatus,
      publicFormSettlements,
      dimensionSummary: action.dimensionSummary ?? null,
      reasons: [
        ...new Set([
          ...(action.reasons ?? []),
          ...(!runtimeReady &&
          requiresDamageSettlement &&
          settlementStatus !== 'not-applicable'
            ? ['public-action-damage-settlement-evidence-missing']
            : []),
        ]),
      ].sort(),
    };
  });
  return {
    schemaVersion: 1,
    kind: 'azpr-character-combat-runtime-coverage',
    ownerId,
    sourcePackageHash,
    actionRows,
    summary: {
      actionCount: publicActions.length,
      runtimeReadyActionCount: actionRows.filter(action => action.runtimeReady)
        .length,
      executionFormCount: actionForms.length,
      controlCount: controls.length,
      hitCount: hits.length,
      rawEffectCount: rawEffects.length,
      semanticEffectCount: semanticEffects.length,
      resourceProfileCount: specialResourceProfiles.length,
      resourceTransactionCount: resourceTransactions.length,
      thresholdTransitionCount: thresholdTransitions.length,
      targetStateProfileCount: targetStateProfiles.length,
      targetStateTransactionCount: targetStateTransactions.length,
      conditionalHitGroupCount: conditionalHitGroups.length,
      tuningMarkConditionalDamageGroupCount:
        tuningMarkConditionalDamageGroups.length,
      runtimeEffectBindingCount: runtimeEffectBindings.length,
      passiveCount: passives.length,
      switchTriggerCount: switchTriggers.length,
      coverageStatusCounts: countBy(coverage, item => item.status),
    },
  };
}

function deriveCharacterCombatLifecycle({
  coverage,
  publicActions,
  actionForms,
  unresolvedRecords,
  runtimeCompilation,
  runtimeCoverage,
  uiVerification,
}) {
  const requiredCoverageComplete = coverage.every(item =>
    ['applied', 'not-applicable'].includes(item.status)
  );
  const publicActionsComplete = (
    runtimeCoverage?.actionRows ?? publicActions
  ).every(
    action =>
      action.runtimeReady === true ||
      action.classification === 'verified-zero' ||
      action.notApplicable === true
  );
  const actionFormsComplete = actionForms.every(form =>
    ['applied', 'not-applicable'].includes(form.status)
  );
  const gameplayGapCount = unresolvedRecords.filter(
    record =>
      record.impactClassification === 'gameplay-impacting' &&
      record.status !== 'not-applicable'
  ).length;
  const combatCoverageState =
    requiredCoverageComplete &&
    publicActionsComplete &&
    actionFormsComplete &&
    gameplayGapCount === 0
      ? 'complete'
      : coverage.some(item => item.status === 'applied')
        ? 'partial'
        : 'evidence-required';
  const runtimeApplied =
    runtimeCompilation?.status ===
      'character-combat-runtime-contract-compiled' &&
    runtimeCompilation.outputBindings.some(binding => binding.recordCount > 0);
  const uiVerified =
    runtimeApplied &&
    combatCoverageState === 'complete' &&
    uiVerification?.status === 'passed' &&
    typeof uiVerification.scenarioIdentity === 'string' &&
    /^[a-f0-9]{64}$/.test(String(uiVerification.resultHash ?? ''));
  return {
    pipelineMaturity: uiVerified
      ? 'ui-verified'
      : runtimeApplied
        ? 'runtime-applied'
        : 'profile-compiled',
    combatCoverageState,
    characterComplete: uiVerified,
    gates: {
      requiredCoverageComplete,
      publicActionsComplete,
      actionFormsComplete,
      gameplayGapCount,
      runtimeApplied,
      uiVerified,
    },
  };
}

function deriveCharacterCombatSimulationScopes({
  recipe,
  publicActions,
  actionForms,
  specialResourceProfiles,
  actionEffectBindings,
  passives,
  actionTransitionCoverage,
  capturePlan,
  goldenFixture,
  unresolvedRecords,
  runtimeCoverage,
}) {
  const requirements =
    recipe?.simulationScopeRequirements?.zeroDistance ?? null;
  const declared = requirements != null;
  const requiredResourceIdentities = [
    ...new Set(requirements?.requiredResourceIdentities ?? []),
  ].sort();
  const requiredActionEffectBindingIdentities = [
    ...new Set(requirements?.requiredActionEffectBindingIdentities ?? []),
  ].sort();
  const requiredPassiveIdentities = [
    ...new Set(requirements?.requiredPassiveIdentities ?? []),
  ].sort();
  const resourceByIdentity = new Map(
    specialResourceProfiles.map(profile => [profile.resourceIdentity, profile])
  );
  const actionEffectByIdentity = new Map(
    actionEffectBindings.map(binding => [binding.bindingIdentity, binding])
  );
  const passiveByIdentity = new Map(
    passives.map(passive => [passive.passiveIdentity, passive])
  );
  const requiredResourcesApplied = requiredResourceIdentities.every(
    identity => {
      const profile = resourceByIdentity.get(identity);
      return (
        profile?.applied === true &&
        profile.scenarioConfigurable === true &&
        Number(profile.capacity) > 0 &&
        Number(profile.inputStep) > 0
      );
    }
  );
  const requiredActionEffectsApplied =
    requiredActionEffectBindingIdentities.every(
      identity => actionEffectByIdentity.get(identity)?.applied === true
    );
  const requiredPassivesApplied = requiredPassiveIdentities.every(
    identity => passiveByIdentity.get(identity)?.applied === true
  );
  const notApplicableActionIdentities = new Set(
    (runtimeCoverage?.actionRows ?? [])
      .filter(action => action.notApplicable === true)
      .map(action => action.actionIdentity)
  );
  const scenarioTransitionGameplayGapCount = (
    actionTransitionCoverage?.publicActionCoverage ?? []
  ).filter(
    action =>
      !['applied', 'not-applicable'].includes(action.status) &&
      !notApplicableActionIdentities.has(action.publicActionIdentity)
  ).length;
  const semanticTransitionClosureComplete =
    Number(actionTransitionCoverage?.summary?.semanticTransitionCount) > 0 &&
    Number(actionTransitionCoverage?.summary?.appliedTransitionCount) ===
      Number(actionTransitionCoverage?.summary?.semanticTransitionCount) &&
    scenarioTransitionGameplayGapCount === 0;
  const zeroDistanceBlockingCaptureCount = Number(
    capturePlan?.summary?.zeroDistanceBlockingCaptureCount ??
      capturePlan?.entries?.filter(
        entry => entry.blocksZeroDistanceSimulation !== false
      ).length ??
      0
  );
  const sourceGameplayGapCount = unresolvedRecords.filter(
    record =>
      record.impactClassification === 'gameplay-impacting' &&
      record.status !== 'not-applicable'
  ).length;
  const sourceStaticEvidenceGapCount = unresolvedRecords.filter(
    record =>
      record.status === 'static-evidence-gap' &&
      record.impactClassification === 'gameplay-impacting'
  ).length;
  const gates = {
    declared,
    scenarioPolicyIsZeroDistance:
      requirements?.projectileImpactPolicy === 'scenario-assumed-zero-distance',
    publicActionsRuntimeReady: (
      runtimeCoverage?.actionRows ?? publicActions
    ).every(
      action =>
        action.runtimeReady === true ||
        action.classification === 'verified-zero' ||
        action.notApplicable === true
    ),
    actionFormsApplied: actionForms.every(
      form =>
        ['applied', 'not-applicable'].includes(form.status) ||
        [...notApplicableActionIdentities].some(identity =>
          String(
            form.formIdentity ?? form.publicActionIdentity ?? ''
          ).startsWith(identity)
        )
    ),
    semanticTransitionClosureComplete,
    requiredResourcesApplied,
    requiredActionEffectsApplied,
    requiredPassivesApplied,
    zeroDistanceRuntimeCapturesResolved: zeroDistanceBlockingCaptureCount === 0,
    authoritativeGoldenPassed:
      goldenFixture?.validation?.passed === true &&
      goldenFixture?.validation?.status ===
        'authoritative-golden-runtime-expectation-passed',
  };
  const zeroDistanceComplete = declared && Object.values(gates).every(Boolean);
  const realClientEvidenceGates = {
    zeroDistanceSimulationComplete: zeroDistanceComplete,
    runtimeCapturePlanEmpty:
      Number(capturePlan?.summary?.captureCount ?? 0) === 0,
    sourceGameplayGapCountIsZero: sourceGameplayGapCount === 0,
  };
  return {
    zeroDistance: {
      status: declared
        ? zeroDistanceComplete
          ? 'complete'
          : 'incomplete'
        : 'not-declared',
      complete: zeroDistanceComplete,
      scenarioContract: {
        targetDistance: 0,
        defaultWillHit: true,
        projectileTravelFrames: 0,
        projectileImpactPolicy: requirements?.projectileImpactPolicy ?? null,
      },
      requiredResourceIdentities,
      requiredActionEffectBindingIdentities,
      requiredPassiveIdentities,
      gates,
      sourceEvidenceGapCount: sourceGameplayGapCount,
      sourceEvidenceGapsRemainAuditable: sourceGameplayGapCount > 0,
      realClientEvidenceCaptureCount: Number(
        capturePlan?.summary?.realClientEvidenceCaptureCount ?? 0
      ),
    },
    realClientEvidence: {
      status: Object.values(realClientEvidenceGates).every(Boolean)
        ? 'complete'
        : 'incomplete',
      complete: Object.values(realClientEvidenceGates).every(Boolean),
      gates: realClientEvidenceGates,
      runtimeCaptureCount: Number(capturePlan?.summary?.captureCount ?? 0),
      staticEvidenceGapCount: sourceStaticEvidenceGapCount,
    },
  };
}

function createRuntimeCompilation({
  ownerId,
  profileIdentity,
  contracts,
  sourceCompilation,
}) {
  const outputBindings = [
    createRuntimeOutputBinding(
      'actionMappings',
      contracts.publicActions,
      'public-action-binding'
    ),
    createRuntimeOutputBinding(
      'actionVariantGraph.publicActionForms',
      contracts.actionForms,
      'action-form-resolution'
    ),
    createRuntimeOutputBinding(
      'actionVariantGraph.contextEdges',
      contracts.timingInputEdges,
      'contextual-input-scheduling'
    ),
    createRuntimeOutputBinding(
      'actionVariantGraph.edges',
      contracts.variantEdges,
      'state-and-resource-variant-selection'
    ),
    createRuntimeOutputBinding(
      'actionVariantGraph.tuningMarkConditionalDamageGroups',
      contracts.tuningMarkConditionalDamageGroups,
      'tuning-mark-conditional-damage'
    ),
    createRuntimeOutputBinding(
      'actionVariantGraph.attackInputChains',
      contracts.attackInputChains,
      'attack-input-chain'
    ),
    createRuntimeOutputBinding(
      'controlBindings.hits',
      contracts.hits,
      'three-value-hit-settlement'
    ),
    createRuntimeOutputBinding(
      'specialResourceCatalog.profiles',
      contracts.resourceProfiles,
      'special-resource-profile'
    ),
    createRuntimeOutputBinding(
      'specialResourceCatalog.operationBindings',
      contracts.resourceTransactions,
      'special-resource-transaction'
    ),
    createRuntimeOutputBinding(
      'specialResourceCatalog.thresholdTransitions',
      contracts.stateMachines,
      'threshold-state-machine'
    ),
    createRuntimeOutputBinding(
      'specialResourceCatalog.passiveEffects',
      contracts.passives,
      'passive-stack'
    ),
    createRuntimeOutputBinding(
      'switchTriggerCatalog.profiles',
      contracts.switchTriggers,
      'switch-trigger'
    ),
    createRuntimeOutputBinding(
      'staticPropertyCatalog',
      contracts.statDependencies,
      'static-and-dynamic-stat-propagation'
    ),
  ];
  return {
    schemaVersion: 1,
    kind: 'azpr-character-combat-runtime-compilation',
    status: 'character-combat-runtime-contract-compiled',
    ownerId,
    profileIdentity,
    operatorContractVersion: 1,
    sourceCompilation: {
      compilerVersion: sourceCompilation?.compilerVersion ?? null,
      recipeIdentity: sourceCompilation?.recipeIdentity ?? null,
      recipeHash: sourceCompilation?.recipeHash ?? null,
      compilerInputHash: sourceCompilation?.compilerInputHash ?? null,
      recipeContractHash: sourceCompilation?.recipeContractHash ?? null,
      ownerContractHash: sourceCompilation?.contractHash ?? null,
    },
    operators: outputBindings.map(binding => binding.operator),
    outputBindings,
    contractHash: sha256Json(
      outputBindings.map(binding => ({
        packagePath: binding.packagePath,
        operator: binding.operator,
        recordCount: binding.recordCount,
        recordsHash: binding.recordsHash,
      }))
    ),
  };
}

function createRuntimeOutputBinding(packagePath, records, operator) {
  const normalizedRecords = Array.isArray(records)
    ? records
    : records == null
      ? []
      : [records];
  return {
    packagePath,
    operator,
    recordCount: normalizedRecords.length,
    recordsHash: sha256Json(normalizedRecords),
  };
}

function createUnresolvedLedger({
  ownerId,
  publicActions,
  controls,
  resourceTransactions,
  ownerContextEdges,
  ownerVariantEdges,
  passives,
  switchTriggers,
  hiddenAudit,
  occupancyAudit,
  recipe,
  actionTransitionCoverage,
  tuningMarkConditionalDamageGroups,
}) {
  const records = [];
  const append = ({
    identity,
    sourceKind,
    reasons,
    sourceIdentity,
    forcedStatus,
    referenceKind,
    sourceEvidenceStatus,
    scenarioRuntimeStatus,
    metadata,
  }) => {
    const normalizedReasons = [
      ...new Set((reasons ?? []).filter(Boolean).map(String)),
    ].sort();
    const status =
      forcedStatus ?? classifyGapStatus(normalizedReasons, sourceKind);
    if (status === 'applied') return;
    records.push({
      recordIdentity: identity,
      ownerId,
      sourceKind,
      status,
      reasons: normalizedReasons,
      sourceIdentity: sourceIdentity ?? null,
      referenceKind: referenceKind ?? null,
      sourceEvidenceStatus: sourceEvidenceStatus ?? null,
      scenarioRuntimeStatus: scenarioRuntimeStatus ?? null,
      metadata: metadata ?? null,
    });
  };
  for (const action of publicActions) {
    if (action.classification === 'applied') continue;
    append({
      identity: action.identity,
      sourceKind: 'public-action',
      reasons: action.reasons ?? [action.classification],
      sourceIdentity: action.sourceIdentity,
    });
  }
  for (const control of controls) {
    for (const hit of control.hits ?? []) {
      if (
        ['applied', 'source-verified'].includes(hit.sourceEvidenceStatus) &&
        !(hit.reasons ?? []).length
      ) {
        continue;
      }
      append({
        identity: `hit:${hit.hitIdentity}`,
        sourceKind: 'hit',
        reasons: hit.reasons ?? [hit.sourceEvidenceStatus],
        sourceIdentity: hit.sourceIdentity,
        referenceKind: hit.referenceKind,
        sourceEvidenceStatus: hit.sourceEvidenceStatus,
        scenarioRuntimeStatus: hit.scenarioRuntimeStatus,
      });
    }
    for (const effect of control.effects ?? []) {
      if (effect.classification === 'applied') continue;
      append({
        identity: `effect:${effect.effectIdentity}`,
        sourceKind: 'effect',
        reasons: effect.reasons?.length
          ? effect.reasons
          : [effect.classification],
        sourceIdentity: effect.sourceIdentity,
      });
    }
  }
  for (const transaction of resourceTransactions ?? []) {
    if (transaction.applied) continue;
    if (transaction.status === 'not-applicable') {
      append({
        identity: transaction.operationIdentity,
        sourceKind: 'special-resource-transaction',
        reasons: transaction.reasons,
        sourceIdentity:
          transaction.classificationSourceIdentity ??
          transaction.sourceIdentity,
        forcedStatus: 'not-applicable',
      });
      continue;
    }
    // Unresolved operations originate from the same raw effect already recorded
    // above. Recipe-level records carry any resource-specific product gap once.
  }
  for (const edge of [...ownerContextEdges, ...ownerVariantEdges]) {
    if (edge.applied) continue;
    append({
      identity: edge.edgeIdentity,
      sourceKind: 'variant-edge',
      reasons: edge.reasons,
      sourceIdentity: edge.sourceIdentity,
    });
  }
  for (const passive of passives) {
    for (const unresolved of passive.unresolvedTriggerBindings ?? []) {
      append({
        identity: unresolved.triggerIdentity,
        sourceKind: 'passive-trigger',
        reasons: unresolved.reasons,
        sourceIdentity: unresolved.sourceIdentity,
      });
    }
  }
  for (const profile of switchTriggers) {
    if (profile.applied) continue;
    append({
      identity: `switch-trigger:${ownerId}:${profile.triggerPhase}`,
      sourceKind: 'switch-trigger',
      reasons: profile.reasons,
      sourceIdentity: profile.sourceIdentity,
    });
  }
  for (const row of hiddenAudit?.rows ?? []) {
    if (row.applied || row.status === 'applied') continue;
    const reasons = [row.exclusionReason, ...(row.reasons ?? [])].filter(
      Boolean
    );
    if (reasons.length === 0) continue;
    append({
      identity:
        row.edgeIdentity ??
        row.rowIdentity ??
        [
          row.publicActionIdentity,
          row.sourceControlSkillId,
          row.sourceSubSkillIndex,
          row.window?.startFrame,
          row.targetControlSkillId,
          row.targetSubSkillIndex,
        ].join('|'),
      sourceKind: 'hidden-input-window',
      reasons,
      sourceIdentity: row.sourceIdentity,
      forcedStatus:
        row.status === 'not-applicable' ? 'not-applicable' : undefined,
    });
  }
  for (const row of occupancyAudit?.rows ?? []) {
    if (
      row.status === 'applied' ||
      row.occupancyStatus === 'applied' ||
      row.applied
    ) {
      continue;
    }
    append({
      identity:
        row.formIdentity ??
        `${row.controlSkillId}:${row.subSkillIndex}:occupancy`,
      sourceKind: 'effective-occupancy',
      reasons: row.reasons ?? [row.status ?? row.occupancyStatus],
      sourceIdentity: row.sourceIdentity,
    });
  }
  for (const item of recipe.notApplicableSkills ?? []) {
    append({
      identity: `actor:${ownerId}:skill:${item.skillId}`,
      sourceKind: 'passive-or-skill',
      reasons: [item.reason],
      sourceIdentity: item.sourceIdentity,
      forcedStatus: 'not-applicable',
    });
  }
  for (const item of recipe.unresolvedRecords ?? []) {
    append({
      identity: item.identity,
      sourceKind: item.sourceKind,
      reasons: item.reasons,
      sourceIdentity: item.sourceIdentity,
      forcedStatus: item.status,
      metadata: item.metadata,
    });
  }
  const rawRecords = dedupeBy(records, record => record.recordIdentity).sort(
    compareIdentity
  );
  const semanticGroups = new Map();
  for (const record of rawRecords) {
    const impactClassification = classifyUnresolvedImpactClassification(
      record,
      {
        recipe,
        actionTransitionCoverage,
        tuningMarkConditionalDamageGroups,
      }
    );
    const canonicalKey = createUnresolvedCanonicalKey(
      record,
      impactClassification
    );
    const existing = semanticGroups.get(canonicalKey);
    if (existing) {
      existing.rawRecordIdentities.push(record.recordIdentity);
      if (record.sourceIdentity) {
        existing.sourceIdentities.push(record.sourceIdentity);
      }
      if (record.referenceKind) {
        existing.referenceKinds.push(record.referenceKind);
      }
      if (record.sourceEvidenceStatus) {
        existing.sourceEvidenceStatuses.push(record.sourceEvidenceStatus);
      }
      if (record.scenarioRuntimeStatus) {
        existing.scenarioRuntimeStatuses.push(record.scenarioRuntimeStatus);
      }
      continue;
    }
    semanticGroups.set(canonicalKey, {
      recordIdentity: `semantic-gap:${sha256Json(canonicalKey).slice(0, 20)}`,
      ownerId,
      sourceKind: record.sourceKind,
      status: record.status,
      impactClassification,
      reasons: record.reasons,
      sourceIdentity: record.sourceIdentity,
      sourceIdentities: record.sourceIdentity ? [record.sourceIdentity] : [],
      referenceKinds: record.referenceKind ? [record.referenceKind] : [],
      sourceEvidenceStatuses: record.sourceEvidenceStatus
        ? [record.sourceEvidenceStatus]
        : [],
      scenarioRuntimeStatuses: record.scenarioRuntimeStatus
        ? [record.scenarioRuntimeStatus]
        : [],
      metadata: record.metadata ?? null,
      rawRecordIdentities: [record.recordIdentity],
    });
  }
  const semanticRecords = [...semanticGroups.values()]
    .map(record => ({
      ...record,
      sourceIdentities: [...new Set(record.sourceIdentities)].sort(),
      referenceKinds: [...new Set(record.referenceKinds)].sort(),
      sourceEvidenceStatuses: [
        ...new Set(record.sourceEvidenceStatuses),
      ].sort(),
      scenarioRuntimeStatuses: [
        ...new Set(record.scenarioRuntimeStatuses),
      ].sort(),
      rawRecordIdentities: [...new Set(record.rawRecordIdentities)].sort(),
      rawRecordCount: new Set(record.rawRecordIdentities).size,
    }))
    .sort(compareIdentity);
  return {
    records: semanticRecords,
    rawRecords,
    summary: {
      semanticRecordCount: semanticRecords.length,
      rawRecordCount: rawRecords.length,
      semanticStatusCounts: countBy(semanticRecords, record => record.status),
      rawStatusCounts: countBy(rawRecords, record => record.status),
      impactClassificationCounts: countBy(
        semanticRecords,
        record => record.impactClassification
      ),
      gameplayImpactingCount: semanticRecords.filter(
        record => record.impactClassification === 'gameplay-impacting'
      ).length,
      wrapperOrDuplicateCount: semanticRecords.filter(
        record =>
          record.impactClassification === 'wrapper-or-duplicate' ||
          record.impactClassification ===
            'superseded-by-semantic-transition-closure'
      ).length,
      transitionCandidateSupersededCount: semanticRecords.filter(
        record =>
          record.impactClassification ===
          'superseded-by-semantic-transition-closure'
      ).length,
      unreachableOrNotApplicableCount: semanticRecords.filter(record =>
        ['unreachable', 'not-applicable'].includes(record.impactClassification)
      ).length,
    },
  };
}

function classifyUnresolvedImpactClassification(
  record,
  {
    recipe,
    actionTransitionCoverage,
    tuningMarkConditionalDamageGroups = [],
  } = {}
) {
  if (record.status === 'not-applicable') return 'not-applicable';
  const recipeOverride = (recipe.unresolvedRecords ?? []).find(
    item =>
      item.status === 'not-applicable' &&
      String(item.identity ?? '') === String(record.recordIdentity ?? '')
  );
  if (recipeOverride) return 'not-applicable';
  const reasons = new Set(record.reasons ?? []);
  if (
    record.sourceKind === 'effect' &&
    [...reasons].some(reason => /^source-driven-/i.test(reason))
  ) {
    return 'wrapper-or-duplicate';
  }
  if (
    record.sourceKind === 'effect' &&
    reasons.has('judgment-condition-runtime-unimplemented') &&
    isEffectCoveredByTuningMarkConditionalDamageGroup(
      record,
      tuningMarkConditionalDamageGroups
    )
  ) {
    return 'wrapper-or-duplicate';
  }
  if (
    reasons.has('system-or-movement-control-is-not-public-action') ||
    reasons.has('window-does-not-select-an-action-control')
  ) {
    return 'unreachable';
  }
  if (
    record.sourceKind === 'effect' &&
    [...reasons].some(reason =>
      /wrapper-classified|nested-effect-wrapper|duplicate/i.test(reason)
    )
  ) {
    return 'wrapper-or-duplicate';
  }
  const transitionClosurePolicy =
    recipe?.coveragePolicies
      ?.semanticTransitionClosureSupersedesRawCandidateGaps === true;
  const transitionClosureComplete =
    Number(actionTransitionCoverage?.summary?.semanticTransitionCount) > 0 &&
    Number(actionTransitionCoverage?.summary?.appliedTransitionCount) ===
      Number(actionTransitionCoverage?.summary?.semanticTransitionCount) &&
    Number(actionTransitionCoverage?.summary?.gameplayGapCount) === 0;
  if (
    transitionClosurePolicy &&
    transitionClosureComplete &&
    record.sourceKind === 'variant-edge'
  ) {
    return 'superseded-by-semantic-transition-closure';
  }
  return 'gameplay-impacting';
}

function isEffectCoveredByTuningMarkConditionalDamageGroup(record, groups) {
  const match = String(record.recordIdentity ?? '').match(
    /^effect:(\d+)\|(\d+)\|/
  );
  if (!match) return false;
  const controlSkillId = Number(match[1]);
  const subSkillIndex = Number(match[2]);
  return groups.some(
    group =>
      Number(group.controlSkillId) === controlSkillId &&
      Number(group.subSkillIndex) === subSkillIndex
  );
}

function createUnresolvedCanonicalKey(record, impactClassification) {
  const reasonKey = [...(record.reasons ?? [])].sort().join(',');
  if (record.sourceKind === 'effect') {
    const match = String(record.sourceIdentity ?? '').match(
      /^battle-effect:([^:]+):([^:]+):([^:]+):/
    );
    const semanticEffectIdentity = match
      ? `${match[1]}:${match[2]}:${match[3]}`
      : record.recordIdentity;
    return [
      record.ownerId,
      record.sourceKind,
      impactClassification,
      semanticEffectIdentity,
      reasonKey,
      record.status,
    ].join('|');
  }
  return [
    record.ownerId,
    record.sourceKind,
    impactClassification,
    record.recordIdentity,
    reasonKey,
    record.status,
  ].join('|');
}

function createRuntimeCapturePlan(records, ownerId) {
  const entries = records
    .filter(record => record.status === 'runtime-evidence-required')
    .map(record => {
      const zeroDistanceScenarioResolved =
        record.sourceKind === 'hit' &&
        record.referenceKinds?.includes('bulletElements') &&
        record.scenarioRuntimeStatuses?.includes(
          'scenario-assumed-zero-distance'
        );
      return {
        captureIdentity: `capture:${record.recordIdentity}`,
        ownerId,
        sourceRecordIdentity: record.recordIdentity,
        triggerScenario: inferCaptureScenario(record),
        observe: inferCaptureFields(record),
        successCriteria:
          'captured runtime identity resolves the listed condition without changing static source status',
        evidenceScope: zeroDistanceScenarioResolved
          ? 'real-client-projectile-impact'
          : 'runtime-mechanism',
        blocksZeroDistanceSimulation: !zeroDistanceScenarioResolved,
        scenarioRuntimeStatus: zeroDistanceScenarioResolved
          ? 'scenario-assumed-zero-distance'
          : (record.scenarioRuntimeStatuses?.[0] ?? null),
        sourceEvidenceStatus:
          record.sourceEvidenceStatuses?.[0] ?? record.status,
        referenceKinds: record.referenceKinds ?? [],
        sourceIdentity:
          record.sourceIdentity ??
          `character-combat-record:${record.recordIdentity}`,
        sourceMetadata: record.metadata ?? null,
      };
    });
  return {
    schemaVersion: 1,
    kind: 'azpr-character-combat-runtime-capture-plan',
    ownerId,
    status: entries.length > 0 ? 'runtime-evidence-required' : 'not-applicable',
    entries,
    summary: {
      captureCount: entries.length,
      zeroDistanceBlockingCaptureCount: entries.filter(
        entry => entry.blocksZeroDistanceSimulation
      ).length,
      realClientEvidenceCaptureCount: entries.filter(
        entry => entry.evidenceScope === 'real-client-projectile-impact'
      ).length,
    },
  };
}

export function createActionPhaseCoverage({
  ownerId,
  publicActions = [],
  attackInputChains = [],
  variantEdges = [],
  variantWindowBindings = [],
  resourceTransactions = [],
  actionEffectBindings = [],
}) {
  const phases = attackInputChains.map(chain => {
    const segmentLimit = chain.segmentLimit ?? null;
    const phaseTransition = chain.phaseTransition ?? null;
    const segments = (chain.segments ?? []).map(segment => ({
      sequenceIndex: Number(segment.sequenceIndex),
      sequenceTotal: Number(segment.sequenceTotal),
      semanticName: segment.semanticName ?? segment.label ?? null,
      controlSkillId: numberOrNull(segment.controlSkillId),
      subSkillIndex: numberOrNull(segment.subSkillIndex),
      durationFrames: numberOrNull(segment.durationFrames),
      status: segment.status ?? null,
      applied: segment.applied === true,
      sourceIdentity: segment.sourceIdentity ?? null,
    }));
    return {
      phaseIdentity: chain.chainIdentity,
      publicActionIdentity: chain.sourceMappingIdentity ?? null,
      actionKind: chain.actionKind ?? 'normal-attack',
      entryPolicy: chain.entryPolicy ?? null,
      prerequisite: chain.stateCondition ?? null,
      inputCount: segments.length,
      selectedExecutionSegments: segments,
      segmentLimit,
      phaseTransition,
      exitCondition:
        segmentLimit?.kind === 'resource-current-value'
          ? {
              kind: 'resource-exhausted-or-input-limit-reached',
              resourceIdentity: segmentLimit.resourceIdentity ?? null,
              costPerInput: numberOrNull(segmentLimit.costPerSegment),
              maximumInputCount: numberOrNull(segmentLimit.maximum),
            }
          : {
              kind: 'chain-complete',
              maximumInputCount: segments.length,
            },
      sourceIdentities: uniqueStrings([
        chain.sourceIdentity,
        chain.entryPolicy?.sourceIdentity,
        chain.stateCondition?.sourceIdentity,
        chain.segmentLimit?.sourceIdentity,
        chain.phaseTransition?.sourceIdentity,
        ...segments.map(segment => segment.sourceIdentity),
      ]),
      status:
        segments.length > 0 && segments.every(segment => segment.applied)
          ? 'applied'
          : 'static-evidence-gap',
    };
  });
  const derivedTargets = new Set(
    attackInputChains
      .filter(chain => chain.entryPolicy?.kind === 'derived-or-quick-entry')
      .map(chain => chain.segments?.[0])
      .filter(Boolean)
      .map(
        segment =>
          `${Number(segment.controlSkillId)}|${Number(segment.subSkillIndex)}`
      )
  );
  const quickEntryBindings = dedupeBy(
    [
      ...variantWindowBindings,
      ...variantEdges.filter(
        edge =>
          edge.applied === true &&
          derivedTargets.has(
            `${Number(edge.targetControlSkillId)}|${Number(
              edge.targetSubSkillIndex
            )}`
          )
      ),
    ],
    binding =>
      [
        Number(binding.sourceControlSkillId),
        Number(binding.sourceSubSkillIndex),
        Number(binding.targetControlSkillId),
        Number(binding.targetSubSkillIndex),
        Number(binding.activationFrame ?? binding.triggerFrame),
        Number(binding.durationMs),
        Number(binding.sourceElementId),
      ].join('|')
  );
  const quickEntries = quickEntryBindings.map(binding => ({
    bindingIdentity: binding.bindingIdentity ?? null,
    sourceControlSkillId: numberOrNull(binding.sourceControlSkillId),
    sourceSubSkillIndex: numberOrNull(binding.sourceSubSkillIndex),
    sourceElementId: numberOrNull(binding.sourceElementId),
    inputCommand: binding.inputCommand ?? null,
    activationFrame: numberOrNull(
      binding.activationFrame ?? binding.triggerFrame
    ),
    durationMs: numberOrNull(binding.durationMs),
    targetControlSkillId: numberOrNull(binding.targetControlSkillId),
    targetSubSkillIndex: numberOrNull(binding.targetSubSkillIndex),
    condition: binding.condition ?? null,
    status: binding.status ?? null,
    applied: binding.applied === true,
    sourceIdentity: binding.sourceIdentity ?? null,
  }));
  const publicActionReview = publicActions.map(action => ({
    publicActionIdentity: action.mappingIdentity ?? action.id ?? null,
    actionKind: action.actionKind ?? null,
    sourceSkillId: numberOrNull(action.sourceSkillId),
    runtimeReady: action.runtimeReady === true,
    classification: action.mechanicsClassification ?? null,
    residualReasons: uniqueStrings(action.reasons ?? []),
    status: action.runtimeReady
      ? action.reasons?.length
        ? 'applied-with-residual-gaps'
        : 'applied'
      : 'static-evidence-gap',
  }));
  const resourceActionRows = resourceTransactions
    .filter(transaction => transaction.applied === true)
    .map(transaction => ({
      controlSkillId: numberOrNull(transaction.controlSkillId),
      subSkillIndex: numberOrNull(transaction.subSkillIndex),
      operation: transaction.operation ?? null,
      triggerFrame: numberOrNull(transaction.triggerFrame),
      resourceIdentity: transaction.resourceIdentity ?? null,
      sourceIdentity: transaction.sourceIdentity ?? null,
    }));
  const actionEffectRows = actionEffectBindings.map(binding => ({
    controlSkillId: numberOrNull(binding.controlSkillId),
    subSkillIndex: numberOrNull(binding.subSkillIndex),
    elementId: numberOrNull(binding.elementId),
    triggerFrame: numberOrNull(binding.triggerFrame),
    effectKind: binding.tuningMark ? 'tuning-mark' : 'action-effect',
    profileKey: binding.tuningMark?.profileKey ?? null,
    stackDelta: numberOrNull(binding.tuningMark?.stackDelta),
    status: binding.status ?? null,
    applied: binding.applied === true,
    sourceIdentity: binding.sourceIdentity ?? null,
  }));
  return {
    schemaVersion: 1,
    kind: 'azpr-character-combat-action-phase-coverage',
    status: 'character-combat-action-phase-coverage-ready',
    ownerId: Number(ownerId),
    summary: {
      phaseCount: phases.length,
      appliedPhaseCount: phases.filter(phase => phase.status === 'applied')
        .length,
      inputSegmentCount: phases.reduce(
        (sum, phase) => sum + phase.inputCount,
        0
      ),
      phaseTransitionCount: phases.filter(phase => phase.phaseTransition)
        .length,
      quickEntryCount: quickEntries.length,
      appliedQuickEntryCount: quickEntries.filter(entry => entry.applied)
        .length,
      publicActionCount: publicActionReview.length,
      runtimeReadyActionCount: publicActionReview.filter(
        action => action.runtimeReady
      ).length,
      appliedResourceTransactionCount: resourceActionRows.length,
      appliedActionEffectCount: actionEffectRows.filter(
        effect => effect.applied
      ).length,
    },
    phases,
    quickEntries,
    resourceTransactions: resourceActionRows,
    actionEffects: actionEffectRows,
    publicActionReview,
  };
}

export function createActionTransitionCoverage({
  ownerId,
  publicActions = [],
  attackInputChains = [],
  controlTransitionWindows = [],
  variantEdges = [],
  variantWindowBindings = [],
  resourceTransactions = [],
  actionEffectBindings = [],
  rawEffects = [],
}) {
  const publicActionByControl = new Map();
  for (const action of publicActions) {
    const key = `${numberOrNull(action.controlSkillId)}|${numberOrNull(
      action.selectedSubSkillIndex
    )}`;
    if (!publicActionByControl.has(key)) publicActionByControl.set(key, action);
  }
  const chainSegmentByExecution = new Map();
  const chainByIdentity = new Map(
    attackInputChains.map(chain => [chain.chainIdentity, chain])
  );
  for (const chain of attackInputChains) {
    for (const segment of chain.segments ?? []) {
      chainSegmentByExecution.set(
        `${Number(segment.controlSkillId)}|${Number(segment.subSkillIndex)}`,
        { chain, segment }
      );
    }
  }
  const transitions = [];
  for (const chain of attackInputChains) {
    for (let index = 0; index < (chain.segments ?? []).length - 1; index += 1) {
      const sourceSegment = chain.segments[index];
      const targetSegment = chain.segments[index + 1];
      const inputWindow =
        sourceSegment.executionTiming?.occupancy?.linkWindow ?? null;
      transitions.push(
        createTransitionCoverageRow({
          ownerId,
          identity: `${chain.chainIdentity}:segment:${sourceSegment.sequenceIndex}->${targetSegment.sequenceIndex}`,
          sourceControlSkillId: sourceSegment.controlSkillId,
          sourceSubSkillIndex: sourceSegment.subSkillIndex,
          sourcePublicAction: publicActionByControl.get(
            `${Number(sourceSegment.controlSkillId)}|${Number(
              sourceSegment.subSkillIndex
            )}`
          ),
          triggerPhase: 'input-window',
          inputCommand: 'normal-attack',
          inputWindow,
          targetChain: chain,
          targetSegment,
          transitionSemantics: 'continue-chain',
          exitRules: {
            kind: 'chain-interrupted-or-complete',
            maximumInputCount: chain.segments.length,
          },
          condition: chain.stateCondition,
          evidenceKind: 'compiled-attack-chain-link',
          sourceIdentity: uniqueStrings([
            sourceSegment.sourceIdentity,
            inputWindow?.sourceIdentity,
            targetSegment.sourceIdentity,
          ]).join('|'),
          status: inputWindow ? 'applied' : 'static-evidence-gap',
          applied: Boolean(inputWindow),
          resourceTransactions,
          actionEffectBindings,
          rawEffects,
        })
      );
    }
    const phaseTransition = chain.phaseTransition;
    if (phaseTransition?.targetChainIdentity) {
      const sourceSegment = (chain.segments ?? []).find(
        segment =>
          Number(segment.sequenceIndex) ===
          Number(phaseTransition.sourceSequenceIndex)
      );
      const targetChain = chainByIdentity.get(
        phaseTransition.targetChainIdentity
      );
      const targetSegment = targetChain?.segments?.[0] ?? null;
      transitions.push(
        createTransitionCoverageRow({
          ownerId,
          identity: `${chain.chainIdentity}:phase-transition:${phaseTransition.targetChainIdentity}`,
          sourceControlSkillId: sourceSegment?.controlSkillId,
          sourceSubSkillIndex: sourceSegment?.subSkillIndex,
          sourcePublicAction: publicActionByControl.get(
            `${Number(sourceSegment?.controlSkillId)}|${Number(
              sourceSegment?.subSkillIndex
            )}`
          ),
          triggerPhase: 'input-window',
          inputCommand: phaseTransition.inputCommand,
          inputWindow: phaseTransition.inputWindow,
          targetChain,
          targetSegment,
          transitionSemantics: 'replace-action-phase',
          exitRules: targetChain?.segmentLimit
            ? {
                kind: 'resource-exhausted-or-input-limit-reached',
                segmentLimit: targetChain.segmentLimit,
              }
            : { kind: 'chain-complete' },
          condition: phaseTransition.condition,
          evidenceKind: 'compiled-attack-phase-transition',
          sourceIdentity: phaseTransition.sourceIdentity,
          status: phaseTransition.applied ? 'applied' : 'static-evidence-gap',
          applied: phaseTransition.applied === true,
          resourceTransactions,
          actionEffectBindings,
          rawEffects,
        })
      );
    }
    for (const continuityRule of chain.continuityRules ?? []) {
      transitions.push(
        createTransitionCoverageRow({
          ownerId,
          identity: continuityRule.ruleIdentity,
          sourceControlSkillId: continuityRule.intermediaryControlSkillId,
          sourceSubSkillIndex: continuityRule.intermediarySubSkillIndex,
          sourcePublicAction: publicActionByControl.get(
            `${Number(continuityRule.intermediaryControlSkillId)}|${Number(
              continuityRule.intermediarySubSkillIndex
            )}`
          ),
          triggerPhase: 'input-window',
          inputCommand: continuityRule.inputCommand,
          inputWindow: continuityRule.inputWindow,
          targetChain: chain,
          targetSegment: null,
          targetSequenceIndex: 'next',
          transitionSemantics: 'resume-next-chain-segment',
          exitRules: continuityRule.exitRules,
          condition: continuityRule.condition,
          evidenceKind: 'compiled-attack-chain-continuity',
          sourceIdentity: continuityRule.sourceIdentity,
          status: continuityRule.status,
          applied: continuityRule.applied === true,
          resourceTransactions,
          actionEffectBindings,
          rawEffects,
        })
      );
    }
  }

  for (const binding of variantWindowBindings) {
    const target = chainSegmentByExecution.get(
      `${Number(binding.targetControlSkillId)}|${Number(
        binding.targetSubSkillIndex
      )}`
    );
    transitions.push(
      createTransitionCoverageRow({
        ownerId,
        identity: binding.bindingIdentity,
        sourceControlSkillId: binding.sourceControlSkillId,
        sourceSubSkillIndex: binding.sourceSubSkillIndex,
        sourcePublicAction: publicActionByControl.get(
          `${Number(binding.sourceControlSkillId)}|${Number(
            binding.sourceSubSkillIndex
          )}`
        ),
        triggerPhase:
          binding.triggerPhase ??
          (binding.evidenceKind === 'control-transition-window'
            ? 'input-window'
            : 'state-activation'),
        inputCommand: binding.inputCommand,
        inputWindow: binding.inputWindow,
        targetChain: target?.chain,
        targetSegment: target?.segment,
        transitionSemantics:
          binding.transitionSemantics ??
          (Number(target?.segment?.sequenceIndex) === 1
            ? 'direct-entry'
            : 'continue-chain'),
        exitRules: binding.exitRules ?? null,
        condition: binding.condition,
        evidenceKind: binding.evidenceKind,
        sourceIdentity: binding.sourceIdentity,
        status: binding.status,
        applied: binding.applied === true,
        verification: binding.verification,
        resourceTransactions,
        actionEffectBindings,
        rawEffects,
      })
    );
  }

  const coveredTransitionKeys = new Set(
    transitions.map(createTransitionSemanticKey)
  );
  for (const edge of variantEdges) {
    if (edge.applied !== true || edge.inputCommand !== 'normal-attack') {
      continue;
    }
    const target = chainSegmentByExecution.get(
      `${Number(edge.targetControlSkillId)}|${Number(edge.targetSubSkillIndex)}`
    );
    if (!target) continue;
    const row = createTransitionCoverageRow({
      ownerId,
      identity:
        edge.compilerBindingIdentity ??
        edge.edgeIdentity ??
        edge.sourceIdentity,
      sourceControlSkillId: edge.sourceControlSkillId,
      sourceSubSkillIndex: edge.sourceSubSkillIndex,
      sourcePublicAction: publicActionByControl.get(
        `${Number(edge.sourceControlSkillId)}|${Number(
          edge.sourceSubSkillIndex
        )}`
      ),
      triggerPhase: 'state-activation',
      inputCommand: edge.inputCommand,
      inputWindow:
        edge.inputWindow ??
        createFrameWindowFromDuration(edge.activationFrame, edge.durationMs),
      targetChain: target.chain,
      targetSegment: target.segment,
      transitionSemantics:
        Number(target.segment.sequenceIndex) === 1
          ? 'direct-entry'
          : 'continue-chain',
      exitRules: null,
      condition: edge.condition,
      evidenceKind: 'battle-effect-variant-window',
      sourceIdentity: edge.sourceIdentity,
      status: edge.status,
      applied: true,
      resourceTransactions,
      actionEffectBindings,
      rawEffects,
    });
    const key = createTransitionSemanticKey(row);
    if (coveredTransitionKeys.has(key)) continue;
    coveredTransitionKeys.add(key);
    transitions.push(row);
  }

  const rawWindows = controlTransitionWindows.map(window => {
    const sourcePublicAction = publicActionByControl.get(
      `${Number(window.sourceControlSkillId)}|${Number(
        window.sourceSubSkillIndex
      )}`
    );
    const target = chainSegmentByExecution.get(
      `${Number(window.targetControlSkillId)}|${Number(
        window.targetSubSkillIndex
      )}`
    );
    const semanticKey = createTransitionSemanticKey({
      sourceControlSkillId: window.sourceControlSkillId,
      sourceSubSkillIndex: window.sourceSubSkillIndex,
      targetControlSkillId: window.targetControlSkillId,
      targetSubSkillIndex: window.targetSubSkillIndex,
      inputWindow: {
        startFrame: window.startFrame,
        endFrame: window.endFrame,
      },
    });
    const appliedTransition = transitions.find(
      transition => createTransitionSemanticKey(transition) === semanticKey
    );
    return {
      ...window,
      sourcePublicActionIdentity:
        sourcePublicAction?.mappingIdentity ?? sourcePublicAction?.id ?? null,
      sourceActionKind: sourcePublicAction?.actionKind ?? 'hidden-control',
      targetChainIdentity: target?.chain?.chainIdentity ?? null,
      targetSequenceIndex: numberOrNull(target?.segment?.sequenceIndex),
      targetSemanticName:
        target?.segment?.semanticName ?? target?.segment?.label ?? null,
      runtimeBindingIdentity: appliedTransition?.transitionIdentity ?? null,
      runtimeStatus: appliedTransition
        ? 'applied'
        : target
          ? 'static-evidence-indexed'
          : 'not-runtime-transition',
      applied: Boolean(appliedTransition),
    };
  });

  const sortedTransitions = dedupeBy(
    transitions,
    createTransitionSemanticKey
  ).sort(compareTransitionCoverageRows);
  const publicActionCoverage = publicActions.map(action => {
    const actionTransitions = sortedTransitions.filter(
      transition =>
        Number(transition.sourceControlSkillId) ===
          Number(action.controlSkillId) &&
        Number(transition.sourceSubSkillIndex) ===
          Number(action.selectedSubSkillIndex)
    );
    const resourceCount = resourceTransactions.filter(
      transaction =>
        transaction.applied === true &&
        Number(transaction.controlSkillId) === Number(action.controlSkillId) &&
        Number(transaction.subSkillIndex) ===
          Number(action.selectedSubSkillIndex)
    ).length;
    const tuningEffectCount = rawEffects.filter(
      effect =>
        Number(effect.controlSkillId) === Number(action.controlSkillId) &&
        Number(effect.mapIndex) === Number(action.selectedSubSkillIndex) &&
        (effect.tuningMark?.applied === true ||
          effect.tuningOverlimit?.applied === true)
    ).length;
    const directWindowCount = rawWindows.filter(
      window =>
        Number(window.sourceControlSkillId) === Number(action.controlSkillId) &&
        Number(window.sourceSubSkillIndex) ===
          Number(action.selectedSubSkillIndex)
    ).length;
    const gameplayGap =
      action.runtimeReady !== true &&
      (action.reasons ?? []).some(reason =>
        /window|pack|state|resource|effect/.test(String(reason))
      );
    return {
      publicActionIdentity:
        action.identity ?? action.mappingIdentity ?? action.id ?? null,
      actionKind: action.actionKind ?? null,
      sourceSkillId: numberOrNull(action.sourceSkillId),
      controlSkillId: numberOrNull(action.controlSkillId),
      subSkillIndex: numberOrNull(action.selectedSubSkillIndex),
      transitionCount: actionTransitions.length,
      appliedTransitionCount: actionTransitions.filter(item => item.applied)
        .length,
      directWindowCount,
      appliedResourceTransactionCount: resourceCount,
      appliedTuningEffectCount: tuningEffectCount,
      status: gameplayGap
        ? 'static-evidence-gap'
        : actionTransitions.length || resourceCount || tuningEffectCount
          ? 'applied'
          : 'not-applicable',
      reasons: gameplayGap ? uniqueStrings(action.reasons ?? []) : [],
      sourceIdentity:
        action.bindingSourceIdentity ?? action.sourceIdentity ?? null,
    };
  });
  return {
    schemaVersion: 1,
    kind: 'azpr-character-combat-action-transition-coverage',
    status: 'character-combat-action-transition-coverage-ready',
    ownerId: Number(ownerId),
    summary: {
      publicActionCount: publicActionCoverage.length,
      rawWindowCount: rawWindows.length,
      semanticTransitionCount: sortedTransitions.length,
      appliedTransitionCount: sortedTransitions.filter(row => row.applied)
        .length,
      staticEvidenceOnlyWindowCount: rawWindows.filter(
        row => row.runtimeStatus === 'static-evidence-indexed'
      ).length,
      gameplayGapCount: publicActionCoverage.filter(
        row => row.status === 'static-evidence-gap'
      ).length,
      notApplicableActionCount: publicActionCoverage.filter(
        row => row.status === 'not-applicable'
      ).length,
    },
    transitions: sortedTransitions,
    publicActionCoverage,
    rawWindows,
  };
}

function createTransitionCoverageRow({
  ownerId,
  identity,
  sourceControlSkillId,
  sourceSubSkillIndex,
  sourcePublicAction,
  triggerPhase,
  inputCommand,
  inputWindow,
  targetChain,
  targetSegment,
  targetSequenceIndex = null,
  transitionSemantics,
  exitRules,
  condition,
  evidenceKind,
  sourceIdentity,
  status,
  applied,
  verification = null,
  resourceTransactions,
  actionEffectBindings,
  rawEffects,
}) {
  const normalizedInputWindow = inputWindow
    ? {
        startFrame: numberOrNull(inputWindow.startFrame),
        endFrame: numberOrNull(inputWindow.endFrame),
        durationFrames:
          numberOrNull(inputWindow.durationFrames) ??
          Number(inputWindow.endFrame) - Number(inputWindow.startFrame),
      }
    : null;
  const sourceTransactions = resourceTransactions
    .filter(
      transaction =>
        transaction.applied === true &&
        Number(transaction.controlSkillId) === Number(sourceControlSkillId) &&
        Number(transaction.subSkillIndex) === Number(sourceSubSkillIndex)
    )
    .map(transaction => ({
      operation: transaction.operation ?? null,
      triggerFrame: numberOrNull(transaction.triggerFrame),
      value: numberOrNull(
        transaction.amount ?? transaction.amountByLevel?.['1']
      ),
      resourceIdentity: transaction.resourceIdentity ?? null,
      sourceIdentity: transaction.sourceIdentity ?? null,
    }));
  const boundEffects = [
    ...actionEffectBindings
      .filter(
        binding =>
          binding.applied === true &&
          Number(binding.controlSkillId) === Number(sourceControlSkillId) &&
          Number(binding.subSkillIndex) === Number(sourceSubSkillIndex)
      )
      .map(binding => ({
        kind: binding.tuningMark ? 'tuning-mark' : 'action-effect',
        triggerFrame: numberOrNull(binding.triggerFrame),
        profileKey: binding.tuningMark?.profileKey ?? null,
        stackDelta: numberOrNull(binding.tuningMark?.stackDelta),
        sourceIdentity: binding.sourceIdentity ?? null,
      })),
    ...rawEffects
      .filter(
        effect =>
          effect.applied === true &&
          Number(effect.controlSkillId) === Number(sourceControlSkillId) &&
          Number(effect.mapIndex) === Number(sourceSubSkillIndex) &&
          (effect.tuningMark?.applied === true ||
            effect.tuningOverlimit?.applied === true)
      )
      .map(effect => ({
        kind: effect.tuningMark ? 'tuning-mark' : 'tuning-overlimit',
        triggerFrame: numberOrNull(effect.trigger?.startFrame),
        profileKey:
          effect.tuningMark?.profileKey ??
          effect.tuningOverlimit?.profileKey ??
          null,
        stackDelta:
          numberOrNull(effect.tuningMark?.stackDelta) ??
          numberOrNull(effect.tuningOverlimit?.stackDelta),
        sourceIdentity: effect.sourceIdentity ?? null,
      })),
  ];
  return {
    transitionIdentity:
      identity ??
      [
        ownerId,
        sourceControlSkillId,
        sourceSubSkillIndex,
        targetSegment?.controlSkillId,
        targetSegment?.subSkillIndex,
        normalizedInputWindow?.startFrame,
        normalizedInputWindow?.endFrame,
      ].join('|'),
    ownerId: Number(ownerId),
    sourcePublicActionIdentity:
      sourcePublicAction?.identity ??
      sourcePublicAction?.mappingIdentity ??
      sourcePublicAction?.id ??
      null,
    sourceActionKind: sourcePublicAction?.actionKind ?? 'hidden-control',
    sourceControlSkillId: numberOrNull(sourceControlSkillId),
    sourceSubSkillIndex: numberOrNull(sourceSubSkillIndex),
    triggerPhase: triggerPhase ?? null,
    resourceTransactions: dedupeBy(
      sourceTransactions,
      transaction =>
        `${transaction.operation}|${transaction.triggerFrame}|${transaction.resourceIdentity}`
    ),
    actionEffects: dedupeBy(
      boundEffects,
      effect =>
        `${effect.kind}|${effect.triggerFrame}|${effect.profileKey}|${effect.stackDelta}`
    ),
    inputCommand: inputCommand ?? null,
    inputWindow: normalizedInputWindow,
    condition: condition ?? null,
    targetChainIdentity: targetChain?.chainIdentity ?? null,
    targetSequenceIndex:
      targetSequenceIndex === 'next'
        ? 'next'
        : numberOrNull(targetSequenceIndex ?? targetSegment?.sequenceIndex),
    targetControlSkillId: numberOrNull(targetSegment?.controlSkillId),
    targetSubSkillIndex: numberOrNull(targetSegment?.subSkillIndex),
    targetSemanticName:
      targetSegment?.semanticName ?? targetSegment?.label ?? null,
    transitionSemantics: transitionSemantics ?? null,
    exitRules: exitRules ?? null,
    evidenceKind: evidenceKind ?? null,
    sourceIdentity: sourceIdentity ?? null,
    runtimeCoverage: applied ? 'applied' : 'not-applied',
    workbenchCoverage: applied ? 'generic-runtime-projection' : 'not-covered',
    e2eCoverage: verification?.e2e ?? 'not-covered',
    status: status ?? (applied ? 'applied' : 'static-evidence-gap'),
    applied: applied === true,
  };
}

function createTransitionSemanticKey(transition) {
  return [
    Number(transition.sourceControlSkillId),
    Number(transition.sourceSubSkillIndex),
    Number(transition.targetControlSkillId),
    Number(transition.targetSubSkillIndex),
    Number(transition.inputWindow?.startFrame),
    Number(transition.inputWindow?.endFrame),
  ].join('|');
}

function createFrameWindowFromDuration(startFrame, durationMs) {
  const normalizedStart = numberOrNull(startFrame);
  const normalizedDuration = Number(durationMs);
  if (normalizedStart == null || !(normalizedDuration > 0)) return null;
  const durationFrames = Math.round((normalizedDuration * 60) / 1000);
  return {
    startFrame: normalizedStart,
    endFrame: normalizedStart + durationFrames,
    durationFrames,
  };
}

function compareTransitionCoverageRows(left, right) {
  return (
    Number(left.sourceControlSkillId) - Number(right.sourceControlSkillId) ||
    Number(left.sourceSubSkillIndex) - Number(right.sourceSubSkillIndex) ||
    Number(left.inputWindow?.startFrame ?? -1) -
      Number(right.inputWindow?.startFrame ?? -1) ||
    String(left.transitionIdentity).localeCompare(
      String(right.transitionIdentity)
    )
  );
}

function createActionTransitionCoverageMarkdown(report) {
  const lines = [
    `# ${report.ownerId} 动作衔接与派生闭包`,
    '',
    `- 公开动作：${report.summary.publicActionCount}`,
    `- 原始控制窗口：${report.summary.rawWindowCount}`,
    `- 语义转移：${report.summary.appliedTransitionCount}/${report.summary.semanticTransitionCount}`,
    `- 仅索引未接入窗口：${report.summary.staticEvidenceOnlyWindowCount}`,
    `- 玩法影响缺口：${report.summary.gameplayGapCount}`,
    '',
    '## 已归一转移',
    '',
    '| 来源 | 触发 | 输入窗 | 资源/印记 | 目标 | 语义 | 状态 |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...report.transitions.map(transition => {
      const source = `${transition.sourceActionKind} ${transition.sourceControlSkillId}/sub${transition.sourceSubSkillIndex}`;
      const window = transition.inputWindow
        ? `[${transition.inputWindow.startFrame},${transition.inputWindow.endFrame})`
        : '-';
      const transactions = [
        ...transition.resourceTransactions.map(
          item => `${item.operation}@${item.triggerFrame}F`
        ),
        ...transition.actionEffects.map(
          item => `${item.kind}:${item.profileKey ?? '-'}@${item.triggerFrame}F`
        ),
      ].join('；');
      const target = transition.targetChainIdentity
        ? `${transition.targetChainIdentity} / ${transition.targetSemanticName}`
        : `${transition.targetControlSkillId}/sub${transition.targetSubSkillIndex}`;
      return `| ${markdownCell(source)} | ${markdownCell(
        transition.triggerPhase
      )} | ${markdownCell(window)} | ${markdownCell(
        transactions || '-'
      )} | ${markdownCell(target)} | ${markdownCell(
        transition.transitionSemantics
      )} | ${transition.status} |`;
    }),
    '',
    '## 公开动作覆盖',
    '',
    '| 动作 | control/sub | 转移 | 资源事务 | 调谐效果 | 状态 |',
    '| --- | --- | ---: | ---: | ---: | --- |',
    ...report.publicActionCoverage.map(
      action =>
        `| ${markdownCell(action.actionKind)} | ${action.controlSkillId}/sub${
          action.subSkillIndex
        } | ${action.appliedTransitionCount}/${action.transitionCount} | ${
          action.appliedResourceTransactionCount
        } | ${action.appliedTuningEffectCount} | ${action.status} |`
    ),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function createActionPhaseCoverageMarkdown(report) {
  const lines = [
    `# ${report.ownerId} 动作阶段与派生入口审计`,
    '',
    `- 阶段：${report.summary.phaseCount}（已应用 ${report.summary.appliedPhaseCount}）`,
    `- 输入段：${report.summary.inputSegmentCount}`,
    `- 阶段切换：${report.summary.phaseTransitionCount}`,
    `- 快速入口：${report.summary.appliedQuickEntryCount}/${report.summary.quickEntryCount}`,
    `- 公开动作就绪：${report.summary.runtimeReadyActionCount}/${report.summary.publicActionCount}`,
    '',
    '## 动作阶段',
    '',
    '| 阶段 | 入口 | 前置 | 输入段 | 执行 control/sub | 退出条件 | 状态 |',
    '| --- | --- | --- | ---: | --- | --- | --- |',
    ...report.phases.map(phase => {
      const controls = phase.selectedExecutionSegments
        .map(
          segment =>
            `${segment.semanticName ?? `#${segment.sequenceIndex}`}=${segment.controlSkillId}/sub${segment.subSkillIndex}`
        )
        .join('；');
      return `| ${markdownCell(phase.phaseIdentity)} | ${markdownCell(
        phase.entryPolicy?.kind
      )} | ${markdownCell(phase.prerequisite?.kind)} | ${
        phase.inputCount
      } | ${markdownCell(controls)} | ${markdownCell(
        phase.exitCondition?.kind
      )} | ${phase.status} |`;
    }),
    '',
    '## 阶段切换与快速入口',
    '',
    '| 来源 | 触发帧/窗口 | 目标 | 条件 | 状态 |',
    '| --- | --- | --- | --- | --- |',
    ...report.phases
      .filter(phase => phase.phaseTransition)
      .map(phase => {
        const transition = phase.phaseTransition;
        return `| ${markdownCell(
          `${phase.phaseIdentity}#${transition.sourceSequenceIndex}`
        )} | ${markdownCell(
          transition.inputWindow
            ? `[${transition.inputWindow.startFrame},${transition.inputWindow.endFrame})`
            : null
        )} | ${markdownCell(transition.targetChainIdentity)} | ${markdownCell(
          transition.condition?.kind
        )} | ${transition.status ?? 'unresolved'} |`;
      }),
    ...report.quickEntries.map(entry => {
      return `| ${markdownCell(
        `${entry.sourceControlSkillId}/sub${entry.sourceSubSkillIndex}`
      )} | ${markdownCell(
        `${entry.activationFrame}F + ${entry.durationMs}ms`
      )} | ${markdownCell(
        `${entry.targetControlSkillId}/sub${entry.targetSubSkillIndex}`
      )} | ${markdownCell(entry.condition?.kind)} | ${entry.status} |`;
    }),
    '',
    '## 公开动作复核',
    '',
    '| 动作 | 就绪 | 状态 | 剩余缺口 |',
    '| --- | --- | --- | --- |',
    ...report.publicActionReview.map(action => {
      return `| ${markdownCell(action.actionKind)} | ${
        action.runtimeReady ? '是' : '否'
      } | ${action.status} | ${markdownCell(
        action.residualReasons.join('；')
      )} |`;
    }),
    '',
    '> 本报告由 owner contract 生成；描述只用于发现与命名，运行状态以 control、资源事务、派生窗口和效果绑定为准。',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function markdownCell(value) {
  return String(value ?? '-')
    .replaceAll('|', '\\|')
    .replaceAll('\n', ' ');
}

function createGoldenFixture({ ownerId, goldenRuntime, sourcePackageHash }) {
  if (
    !goldenRuntime ||
    Number(goldenRuntime.ownerId) !== Number(ownerId) ||
    goldenRuntime.kind !== 'azpr-character-combat-authoritative-golden-runtime'
  ) {
    throw new Error(`authoritative golden runtime missing for ${ownerId}`);
  }
  if (
    goldenRuntime.status !== 'authoritative-golden-runtime-verified' ||
    goldenRuntime.validation?.passed !== true
  ) {
    throw new Error(
      `authoritative golden runtime failed for ${ownerId}: ${
        goldenRuntime.validation?.failedCount ?? 'unknown'
      } ${JSON.stringify(
        goldenRuntime.validation?.assertions
          ?.filter?.(assertion => !assertion.passed)
          .slice(0, 5) ?? []
      )}`
    );
  }
  return {
    ...goldenRuntime,
    sourcePackageHash,
  };
}

function createAllCharacterCoverageManifest({
  mechanicsPackage,
  characters,
  recipeByOwnerId,
  compiledProfiles,
  productBoundaryReport,
}) {
  const profileByOwnerId = new Map(
    compiledProfiles.map(profile => [profile.owner.ownerId, profile])
  );
  const productBoundariesByOwnerId = new Map(
    (productBoundaryReport?.entries ?? []).map(entry => [
      Number(entry.ownerId),
      entry,
    ])
  );
  const rows = M10_PUBLIC_CHARACTER_ORDER.map((ownerId, orderIndex) => {
    const character = characters.find(item => Number(item.id) === ownerId);
    const actions = (mechanicsPackage.actionMappings ?? []).filter(
      action =>
        action.ownerKind === 'actor' && Number(action.ownerId) === ownerId
    );
    const controls = new Set(
      actions.flatMap(action => [
        Number(action.controlSkillId),
        ...(action.attackInputSegments ?? []).map(segment =>
          Number(segment.controlSkillId)
        ),
      ])
    );
    const graph = mechanicsPackage.actionVariantGraph ?? {};
    const variantNodes = (graph.nodes ?? []).filter(
      node => Number(node.ownerId) === ownerId
    );
    const variantEdges = [
      ...(graph.edges ?? []),
      ...(graph.contextEdges ?? []),
    ].filter(edge => Number(edge.ownerId) === ownerId);
    const resources = (
      mechanicsPackage.specialResourceCatalog?.profiles ?? []
    ).filter(profile => Number(profile.ownerId) === ownerId);
    const states = (
      mechanicsPackage.specialResourceCatalog?.thresholdTransitions ?? []
    ).filter(transition => Number(transition.ownerId) === ownerId);
    const passives = (
      mechanicsPackage.specialResourceCatalog?.passiveEffects ?? []
    ).filter(passive => Number(passive.ownerId) === ownerId);
    const switches = (
      mechanicsPackage.switchTriggerCatalog?.profiles ?? []
    ).filter(profile => Number(profile.ownerId) === ownerId);
    const runtimeReady = actions.filter(action => action.runtimeReady).length;
    const sourceGapCount = actions.filter(
      action =>
        action.sourceEvidenceStatus === 'static-evidence-gap' ||
        action.classification === 'unresolved'
    ).length;
    const runtimeEvidenceCount = actions.filter(
      action =>
        action.sourceEvidenceStatus === 'runtime-dependent' ||
        action.scenarioRuntimeStatus === 'runtime-dependent'
    ).length;
    const profile = profileByOwnerId.get(ownerId);
    const recipe = recipeByOwnerId.get(ownerId);
    const productBoundary = productBoundariesByOwnerId.get(ownerId) ?? null;
    const route = resolveCharacterCombatRoute({
      ownerId,
      orderIndex,
      resources,
      states,
      variantEdges,
      passives,
      switches,
      sourceGapCount,
      runtimeEvidenceCount,
    });
    return {
      ownerId,
      ownerName: character?.name ?? null,
      recommendedOrder: orderIndex + 1,
      reviewBatch: route.reviewBatch,
      mechanicFocus: route.mechanicFocus,
      estimatedWorkUnits: 1,
      progressState:
        profile?.pipelineMaturity ??
        (actions.length ? 'evidence-indexed' : 'not-started'),
      targetPipelineMaturity: recipe?.targetPipelineMaturity ?? 'ui-verified',
      combatCoverageState:
        profile?.combatCoverageState ??
        (actions.length ? 'evidence-required' : 'evidence-required'),
      characterComplete: profile?.characterComplete === true,
      zeroDistanceSimulationComplete:
        profile?.zeroDistanceSimulationComplete === true,
      realClientEvidenceComplete: profile?.realClientEvidenceComplete === true,
      publicActionCount: actions.length,
      reachableFormCount:
        variantNodes.length +
        actions.reduce(
          (sum, action) => sum + (action.attackInputSegments?.length ?? 0),
          0
        ),
      indexedControlCount: controls.size,
      specialResourceCount: resources.length,
      stateMachineCount: states.length,
      derivedEdgeCount: variantEdges.length,
      passiveCount: passives.length,
      unnamedSecondaryPassive: productBoundary
        ? {
            skillId: Number(productBoundary.skillId),
            status: productBoundary.classification,
            reason: productBoundary.reason,
          }
        : null,
      switchRelationCount: switches.length,
      switchTriggerPhases: [
        ...new Set(switches.map(item => item.triggerPhase).filter(Boolean)),
      ].sort(),
      runtimeReadyActionCount: runtimeReady,
      runtimeReadyRatio:
        actions.length > 0
          ? Number((runtimeReady / actions.length).toFixed(4))
          : 0,
      staticEvidenceGapCount: sourceGapCount,
      runtimeEvidenceRequiredCount: runtimeEvidenceCount,
      mechanismTypes: [
        ...(resources.length ? ['personal-resource'] : []),
        ...(states.length ? ['state-machine'] : []),
        ...(variantEdges.length ? ['derived-action'] : []),
        ...(passives.length ? ['passive-listener'] : []),
        ...(switches.length ? ['switch-trigger'] : []),
      ],
      profileIdentity: profile?.profileIdentity ?? null,
      profileHash: profile?.profileHash ?? null,
    };
  });
  return {
    schemaVersion: 1,
    kind: 'azpr-m10-character-combat-coverage-manifest',
    status: 'm10-character-combat-coverage-manifest-ready',
    sourcePackageHash:
      mechanicsPackage.characterCombatProfileCatalog?.sourcePackageHash ??
      mechanicsPackage.packageHash,
    denominator: {
      sourceKind: 'current-client-public-character-catalog',
      publicCharacterCount: rows.length,
      expectedNames: [...EXPECTED_PUBLIC_CHARACTER_NAMES],
    },
    policy: {
      states: [...CHARACTER_COMBAT_PROGRESS_STATES],
      oneCharacterPerReviewCommitAfterM10A: true,
      automaticBulkGreenIsForbidden: true,
      unnamedSecondaryPassiveClassification: 'not-applicable',
      recommendedSecondProfileOwnerId: 103002,
      recommendedThirdProfileOwnerId: 101003,
    },
    rows,
    summary: {
      characterCount: rows.length,
      progressStateCounts: countBy(rows, row => row.progressState),
      totalPublicActionCount: rows.reduce(
        (sum, row) => sum + row.publicActionCount,
        0
      ),
      totalRuntimeReadyActionCount: rows.reduce(
        (sum, row) => sum + row.runtimeReadyActionCount,
        0
      ),
      unnamedSecondaryPassiveCount: rows.filter(
        row => row.unnamedSecondaryPassive
      ).length,
      zeroDistanceSimulationCompleteCount: rows.filter(
        row => row.zeroDistanceSimulationComplete
      ).length,
      realClientEvidenceCompleteCount: rows.filter(
        row => row.realClientEvidenceComplete
      ).length,
    },
  };
}

function createAllCharacterCoverageMarkdown(report) {
  const lines = [
    '# M10 全角色逐个解析队列',
    '',
    `- 当前客户端公开角色：${report.summary.characterCount}`,
    `- 公开动作：${report.summary.totalPublicActionCount}`,
    `- 当前动作级 runtime ready：${report.summary.totalRuntimeReadyActionCount}`,
    '- M10-A 只完成涂山小玉金标准；后续每个角色独立提交和验收。',
    '',
    '| 顺序 | 批次 | 角色 | 状态 | 动作 | 可运行 | 资源/状态 | 派生 | 被动 | 静态缺口 | 实测需求 | 机制焦点 |',
    '| ---: | --- | --- | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- |',
    ...report.rows.map(
      row =>
        `| ${row.recommendedOrder} | ${row.reviewBatch} | ${row.ownerName} (${row.ownerId}) | ${row.progressState} | ${row.publicActionCount} | ${row.runtimeReadyActionCount} | ${row.specialResourceCount}/${row.stateMachineCount} | ${row.derivedEdgeCount} | ${row.passiveCount} | ${row.staticEvidenceGapCount} | ${row.runtimeEvidenceRequiredCount} | ${row.mechanicFocus.join('、') || '基础动作闭环'} |`
    ),
    '',
    '> 推荐先后：涂山小玉金标准完成后，先红宝石（弹药/特殊资源），再寒悠悠（队伍印记/支援链）；其余顺序由本清单的机制类型和证据缺口决定。',
    '',
  ];
  return lines.join('\n');
}

function resolveCharacterCombatRoute({
  ownerId,
  orderIndex,
  resources,
  states,
  variantEdges,
  passives,
  switches,
  sourceGapCount,
  runtimeEvidenceCount,
}) {
  const reviewBatch =
    orderIndex === 0
      ? 'M10-A'
      : orderIndex === 1
        ? 'M10-B1'
        : orderIndex === 2
          ? 'M10-B2'
          : orderIndex <= 7
            ? 'M10-C1'
            : orderIndex <= 14
              ? 'M10-C2'
              : 'M10-C3';
  const mechanicFocus = [
    ...(resources.length ? ['个人资源'] : []),
    ...(states.length ? ['状态机'] : []),
    ...(variantEdges.length ? ['派生形态'] : []),
    ...(passives.length ? ['被动监听'] : []),
    ...(switches.length ? ['切人/星携技'] : []),
    ...(runtimeEvidenceCount ? ['运行证据'] : []),
    ...(sourceGapCount ? ['静态缺口'] : []),
  ];
  if (ownerId === 103002) {
    mechanicFocus.unshift('弹药');
  } else if (ownerId === 101003) {
    mechanicFocus.unshift('队伍印记/支援链');
  }
  return {
    reviewBatch,
    mechanicFocus: [...new Set(mechanicFocus)],
  };
}

function createOwnerSummaryMarkdown({
  profile,
  sourceManifest,
  reachableGraph,
  descriptionCoverage,
  runtimeCoverage,
  capturePlan,
}) {
  const lines = [
    `# ${profile.owner.ownerName}角色战斗 profile`,
    '',
    `- Owner: \`${profile.owner.ownerId}\``,
    `- Profile: \`${profile.profileIdentity}\``,
    `- Hash: \`${profile.profileHash}\``,
    `- 流水线成熟度：${profile.pipelineMaturity}`,
    `- 战斗覆盖：${profile.combatCoverageState}`,
    `- 角色完成：${profile.characterComplete ? 'yes' : 'no'}`,
    `- 公开动作：${profile.denominator.publicActionCount}`,
    `- 执行形态：${profile.denominator.executionFormCount}`,
    `- 可达 control：${profile.denominator.reachableControlCount}`,
    `- 窗口：${profile.denominator.verifiedWindowCount}`,
    `- Hit：${profile.denominator.hitCount}`,
    `- 来源 identity：${sourceManifest.summary.identityCount}`,
    `- 战斗图：${reachableGraph.summary.nodeCount} nodes / ${reachableGraph.summary.edgeCount} edges`,
    `- 描述覆盖：${descriptionCoverage.summary.entryCount}`,
    `- Runtime ready 动作：${runtimeCoverage.summary.runtimeReadyActionCount}/${runtimeCoverage.summary.actionCount}`,
    `- Runtime capture：${capturePlan.summary.captureCount}`,
    `- 零距离模拟完整：${profile.zeroDistanceSimulationComplete ? 'yes' : 'no'}`,
    `- 实机证据完整：${profile.realClientEvidenceComplete ? 'yes' : 'no'}`,
    `- 零距离阻断 capture：${profile.simulationScopes.zeroDistance.gates.zeroDistanceRuntimeCapturesResolved ? 0 : capturePlan.summary.zeroDistanceBlockingCaptureCount}`,
    `- 实机证据 capture：${profile.simulationScopes.realClientEvidence.runtimeCaptureCount}`,
    '',
    '## 维度状态',
    '',
    '| 维度 | 状态 | 已应用 | 未解析 | 总数 |',
    '| --- | --- | ---: | ---: | ---: |',
    ...profile.coverage.map(
      item =>
        `| ${item.dimension} | ${item.status} | ${item.appliedCount ?? 0} | ${item.unresolvedCount ?? 0} | ${item.recordCount} |`
    ),
    '',
    '## 未闭环',
    '',
  ];
  const gaps = profile.unresolvedRecords.filter(
    record => record.status !== 'not-applicable'
  );
  if (gaps.length === 0) {
    lines.push('- 无。');
  } else {
    for (const [status, count] of Object.entries(
      countBy(gaps, record => record.status)
    )) {
      lines.push(`- ${status}: ${count}`);
    }
  }
  lines.push(
    '',
    '> JSON 是权威产物；本摘要不作为运行时输入，也不从描述推断数值。',
    ''
  );
  return lines.join('\n');
}

function statusFromActionDimension(actions, dimension) {
  const summaries = actions.map(
    action => action.dimensionSummary?.[dimension] ?? {}
  );
  const applied = summaries.reduce(
    (sum, summary) => sum + Number(summary.applied ?? 0),
    0
  );
  const verifiedZero = summaries.reduce(
    (sum, summary) => sum + Number(summary['verified-zero'] ?? 0),
    0
  );
  const unresolved = summaries.reduce(
    (sum, summary) => sum + Number(summary.unresolved ?? 0),
    0
  );
  const status =
    unresolved > 0
      ? 'static-evidence-gap'
      : applied > 0 || verifiedZero > 0
        ? 'applied'
        : 'not-applicable';
  return {
    status,
    recordCount: applied + verifiedZero + unresolved,
    appliedCount: applied,
    verifiedZeroCount: verifiedZero,
    unresolvedCount: unresolved,
    sourceIdentities: actions.map(action => action.identity).sort(),
  };
}

function statusForRecords(
  records,
  isApplied,
  getReasons,
  emptyStatus = 'not-applicable'
) {
  if (!records.length) return createCoverageStatus(emptyStatus, []);
  const unresolved = records.filter(record => !isApplied(record));
  const runtime = unresolved.filter(record =>
    hasRuntimeReason(getReasons(record) ?? [])
  );
  const status =
    unresolved.length === 0
      ? 'applied'
      : runtime.length === unresolved.length
        ? 'runtime-evidence-required'
        : 'static-evidence-gap';
  return {
    status,
    recordCount: records.length,
    appliedCount: records.length - unresolved.length,
    unresolvedCount: unresolved.length,
    sourceIdentities: records
      .flatMap(record => [
        record.sourceIdentity,
        record.identity,
        record.formIdentity,
        record.edgeIdentity,
        record.hitIdentity,
      ])
      .filter(Boolean)
      .map(String)
      .sort(),
  };
}

function createCoverageStatus(status, sourceIdentities) {
  return {
    status,
    recordCount: sourceIdentities.length,
    appliedCount: status === 'applied' ? sourceIdentities.length : 0,
    unresolvedCount: [
      'runtime-evidence-required',
      'static-evidence-gap',
    ].includes(status)
      ? sourceIdentities.length
      : 0,
    sourceIdentities: [...new Set(sourceIdentities.filter(Boolean))].sort(),
  };
}

function classifyGapStatus(reasons, sourceKind) {
  if (
    reasons.some(reason =>
      /not-applicable|not-implemented|unreachable|excluded|window-does-not-select-an-action-control/i.test(
        reason
      )
    )
  ) {
    return 'not-applicable';
  }
  if (hasStaticEvidenceReason(reasons)) return 'static-evidence-gap';
  if (hasRuntimeReason(reasons)) return 'runtime-evidence-required';
  if (sourceKind === 'public-action' && reasons.length === 0) {
    return 'static-evidence-gap';
  }
  return 'static-evidence-gap';
}

function hasRuntimeReason(reasons) {
  return reasons.some(reason =>
    /runtime-dependent|runtime-evidence-required|collision|random-target|selected-target|actual-target|capture-required/i.test(
      String(reason)
    )
  );
}

function hasStaticEvidenceReason(reasons) {
  return reasons.some(reason => {
    const value = String(reason);
    if (/runtime-dependent|runtime-evidence-required/i.test(value)) {
      return false;
    }
    return /static-evidence-gap|missing|unresolved|unverified|incomplete|not-yet-modeled|ambiguous/i.test(
      value
    );
  });
}

function inferCaptureScenario(record) {
  const joined = record.reasons.join(' ');
  if (/projectile|collision/i.test(joined)) {
    return 'release the referenced action against a stationary target at known distance and capture launch/impact identities';
  }
  if (/target|random/i.test(joined)) {
    return 'repeat the referenced action with controlled target count and capture selected target identity';
  }
  return 'execute the referenced action while recording the unresolved runtime field and its source identity';
}

function inferCaptureFields(record) {
  const joined = record.reasons.join(' ');
  const fields = ['ownerId', 'actionId', 'controlSkillId', 'subSkillIndex'];
  if (/projectile|collision/i.test(joined)) {
    fields.push('launchFrame', 'impactFrame', 'hitIdentity');
  }
  if (/target|random/i.test(joined)) fields.push('targetIdentity');
  fields.push('sourceIdentity');
  return fields;
}

function classifySourceIdentity(identity) {
  if (/skill_control_/i.test(identity)) return 'skill-control';
  if (/battle-element|\/Element\/ast_/i.test(identity)) {
    return 'battle-element';
  }
  if (/dump\.cs|GameAssembly/i.test(identity)) return 'client-code';
  if (/NewTable|\.rows\[/i.test(identity)) return 'new-table';
  if (/hero-module/i.test(identity)) return 'public-skill-description';
  if (/runtime/i.test(identity)) return 'runtime-contract';
  return 'other';
}

function collectSourceIdentities(value, output, seen = new Set()) {
  if (value == null) return;
  if (typeof value === 'string') return;
  if (typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  if (typeof value.sourceIdentity === 'string' && value.sourceIdentity) {
    output.add(value.sourceIdentity);
  }
  for (const identity of value.sourceIdentities ?? []) {
    if (typeof identity === 'string' && identity) output.add(identity);
  }
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    collectSourceIdentities(child, output, seen);
  }
}

function assertMechanicsPackage(value) {
  if (
    value?.kind !== 'azpr-verified-combat-mechanics-package' ||
    value?.status !== 'verified-combat-mechanics-package-ready' ||
    !/^[a-f0-9]{64}$/.test(String(value?.packageHash ?? ''))
  ) {
    throw new Error('verified combat mechanics package is invalid');
  }
}

function normalizeCharacters(value) {
  return Array.isArray(value) ? value : (value?.items ?? []);
}

function assertPublicCharacterDenominator(characters) {
  const names = M10_PUBLIC_CHARACTER_ORDER.map(
    ownerId =>
      characters.find(character => Number(character.id) === ownerId)?.name
  );
  if (
    characters.length !== M10_PUBLIC_CHARACTER_ORDER.length ||
    names.some((name, index) => name !== EXPECTED_PUBLIC_CHARACTER_NAMES[index])
  ) {
    throw new Error(
      `public character denominator drift: expected ${M10_PUBLIC_CHARACTER_ORDER.length}, received ${characters.length}`
    );
  }
}

function mapClassification(value) {
  if (value === true || value === 'applied' || value === 'source-verified') {
    return 'applied';
  }
  if (value === 'runtime-dependent') return 'runtime-evidence-required';
  if (
    value === 'verified-zero' ||
    value === false ||
    value == null ||
    value === 'unresolved'
  ) {
    return 'static-evidence-gap';
  }
  return CHARACTER_COMBAT_PROFILE_STATUSES.includes(value)
    ? value
    : 'static-evidence-gap';
}

function createJsonOutput(relativePath, value) {
  return {
    relativePath,
    content: `${JSON.stringify(value, null, 2)}\n`,
  };
}

function createTextOutput(relativePath, value) {
  return {
    relativePath,
    content: `${String(value).trimEnd()}\n`,
  };
}

function sortByIdentity(values) {
  return [...values].sort(compareIdentity);
}

function compareIdentity(left, right) {
  return resolveIdentity(left).localeCompare(resolveIdentity(right));
}

function resolveIdentity(value) {
  return String(
    value?.profileIdentity ??
      value?.recordIdentity ??
      value?.coverageIdentity ??
      value?.nodeIdentity ??
      value?.edgeIdentity ??
      value?.formIdentity ??
      value?.actionIdentity ??
      value?.identity ??
      value?.semanticIdentity ??
      value?.operationIdentity ??
      value?.transitionIdentity ??
      value?.passiveIdentity ??
      value?.triggerIdentity ??
      value?.hitIdentity ??
      value?.controlSkillId ??
      ''
  );
}

function dedupeBy(values, keyOf) {
  const map = new Map();
  for (const value of values) {
    const key = keyOf(value);
    if (!map.has(key)) map.set(key, value);
  }
  return [...map.values()];
}

function countBy(values, keyOf) {
  const counts = {};
  for (const value of values) {
    const key = String(keyOf(value) ?? 'unknown');
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))
  );
}

function uniqueStrings(values) {
  return [
    ...new Set(
      (values ?? [])
        .flat()
        .filter(value => value != null && String(value).length > 0)
        .map(String)
    ),
  ].sort();
}

function numberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function sha256Json(value) {
  return sha256(JSON.stringify(value));
}

function frameToMs(frame, frameRate) {
  return (Number(frame) * 1000) / Number(frameRate);
}
