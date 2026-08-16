import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const EXPECTED_CHARACTER_OPTIMIZATION_OBJECT_COUNT = 9;

const KIBO_AXIS_ACTION_SCOPE_CONTRACT = 'AzPrM12CKiboAxisActionScope';

export const FORMAL_SEARCH_ADMISSION_CHECK_IDS = Object.freeze([
  'search-authority-executed-pass',
  'database-content-hash-recorded',
  'headless-character-scope-ready',
  'formal-initial-state-authority',
  'deterministic-canonical-proof',
  'unresolved-skipped-pre-score-pruning',
  'normal-attack-combo-authority',
  'kibo-axis-action-scope-applied',
  'formal-runtime-baseline-ready',
  'client-parity-policy-satisfied',
]);

export async function loadFormalSearchAdmissionEvidence({
  repositoryRoot,
  searchCoreProof,
  releaseProof,
  deterministicProof,
} = {}) {
  const root = path.resolve(repositoryRoot);
  const [
    qualificationSummary,
    qualificationCatalog,
    bindingReport,
    characterAcceptanceCatalog,
    starbornManifest,
    initialStateModule,
    settlementModule,
    kiboScopeModule,
    normalAttackInputAuthorityModule,
    outerBuildPoolModule,
    kiboActionCatalogSource,
    kiboSchedulerSource,
    kiboSearchGeneratorSource,
    machineAxisServiceSource,
  ] = await Promise.all([
    readOptionalJson(
      root,
      'reports/m12/m12-b3-optimization-qualification-summary.json'
    ),
    readOptionalJson(
      root,
      'src/data/generated/optimization-qualification-catalog.json'
    ),
    readOptionalJson(root, 'reports/m12/m12-b3-binding-matrix.json'),
    readOptionalJson(
      root,
      'src/data/generated/character-acceptance-catalog.json'
    ),
    readOptionalJson(
      root,
      'reports/m11/character-acceptance/optimization-objects/STARBORN/manifest.json'
    ),
    importRepositoryModule(root, 'src/machine-axis/m12cInitialStatePolicy.js'),
    importRepositoryModule(
      root,
      'src/machine-axis/machineAxisEnemySettlementContract.js'
    ),
    importRepositoryModule(root, 'src/domain/kiboAxisActionScopePolicy.js'),
    importRepositoryModule(
      root,
      'src/domain/verifiedNormalAttackInputAuthority.js'
    ),
    importRepositoryModule(root, 'src/machine-axis/m12cOuterBuildPool.js'),
    readFile(
      path.join(
        root,
        'src',
        'data',
        'generated',
        'workbench-kibo-action-catalog.json'
      )
    ),
    readFile(
      path.join(root, 'src', 'machine-axis', 'kiboAutoCastScheduler.js')
    ),
    readFile(
      path.join(root, 'src', 'machine-axis', 'machineAxisSearchGenerator.js')
    ),
    readFile(path.join(root, 'src', 'machine-axis', 'machineAxisService.js')),
  ]);
  let databaseContentHash = null;
  try {
    databaseContentHash =
      JSON.parse(
        await readFile(
          path.join(root, 'src', 'data', 'database', 'manifest.json'),
          'utf8'
        )
      )?.contentHash ?? null;
  } catch {
    databaseContentHash = null;
  }
  const settlementReadiness =
    settlementModule.getMachineAxisEnemySettlementFormalReadiness();
  const settlementContract =
    settlementModule.getMachineAxisEnemySettlementContract();
  const formalRoster = [
    outerBuildPoolModule.M12C_REQUIRED_OPTIMIZATION_OBJECT_ID,
    ...outerBuildPoolModule.M12C_OPTIONAL_OPTIMIZATION_OBJECT_IDS,
  ];
  const starbornSourceCharacterIds = [
    ...outerBuildPoolModule.M12C_STARBORN_SOURCE_CHARACTER_IDS,
  ];
  const normalRoster = formalRoster.filter(identity => identity !== 'STARBORN');
  const headlessManifestOwnerIds = uniqueSortedNumbers([
    ...normalRoster,
    ...starbornSourceCharacterIds,
  ]);
  const [headlessProfiles, headlessGoldens] = await Promise.all([
    Promise.all(
      headlessManifestOwnerIds.map(ownerId =>
        readJson(
          root,
          `src/data/generated/character-combat-profiles/${ownerId}.json`
        )
      )
    ),
    Promise.all(
      headlessManifestOwnerIds.map(ownerId =>
        readJson(root, `reports/m10/${ownerId}/golden-trace.json`)
      )
    ),
  ]);
  const normalAcceptance = normalRoster.map(identity => {
    const entry = characterAcceptanceCatalog?.entries?.find(
      candidate => String(candidate.ownerId) === String(identity)
    );
    return {
      identity,
      present: Boolean(entry),
      maturityState: entry?.maturityState ?? null,
      optimizationReady: entry?.optimizationReady === true,
      blockerCount: entry?.blockers?.length ?? null,
    };
  });
  return {
    repositoryRoot: root,
    searchCoreProof,
    releaseProof,
    deterministicProof,
    qualificationSummary,
    qualificationCatalog,
    bindingReport,
    productAcceptance: {
      formalRoster,
      normalAcceptance,
      starborn: {
        status: starbornManifest?.status ?? null,
        formalAdmission: starbornManifest?.formalAdmission ?? null,
        optimizationReady: starbornManifest?.optimizationReady === true,
        productVisualAcceptance:
          starbornManifest?.productVisualAcceptance ?? null,
        validation: starbornManifest?.validation ?? null,
      },
    },
    headlessCharacterScope: createHeadlessCharacterSearchScope({
      formalRoster,
      starbornSourceCharacterIds,
      profiles: headlessProfiles,
      goldens: headlessGoldens,
    }),
    initialStateAuthority: {
      schemaVersion: initialStateModule.M12C_INITIAL_STATE_SCHEMA_VERSION,
      contractName: initialStateModule.M12C_INITIAL_STATE_CONTRACT_NAME,
      policyId: initialStateModule.M12C_INITIAL_STATE_POLICY_ID,
      policyVersion: initialStateModule.M12C_INITIAL_STATE_POLICY_VERSION,
      policyHash: initialStateModule.M12C_INITIAL_STATE_POLICY_HASH,
      scenarioPolicyId: initialStateModule.M12C_SCENARIO_POLICY_ID,
    },
    normalAttackInputAuthority:
      normalAttackInputAuthorityModule.getVerifiedNormalAttackInputAuthorityDescriptor(),
    formalRuntimeBaseline: {
      ...settlementReadiness,
      clientParityRequiredForCurrentFormalScore:
        settlementContract.formalScoring
          .clientParityRequiredForCurrentFormalScore,
    },
    databaseContentHash,
    kiboAxisActionScope: createKiboAxisActionScopeEvidence({
      kiboActionCatalog: JSON.parse(kiboActionCatalogSource.toString('utf8')),
      actionCatalogSource: kiboActionCatalogSource,
      schedulerSource: kiboSchedulerSource,
      searchGeneratorSource: kiboSearchGeneratorSource,
      machineAxisServiceSource,
      scopePolicyModule: kiboScopeModule,
    }),
  };
}

export function createKiboAxisActionScopeEvidence({
  kiboActionCatalog,
  actionCatalogSource,
  schedulerSource,
  searchGeneratorSource,
  machineAxisServiceSource,
  scopePolicyModule,
} = {}) {
  const admittedKiboIds = uniqueSortedNumbers(
    (kiboActionCatalog?.items ?? []).map(item => item?.kiboId)
  );
  const itemByKiboId = new Map(
    (kiboActionCatalog?.items ?? []).map(item => [Number(item.kiboId), item])
  );
  const missingCatalogKiboIds = admittedKiboIds.filter(
    kiboId => !itemByKiboId.has(kiboId)
  );
  const actions = admittedKiboIds
    .flatMap(kiboId =>
      (itemByKiboId.get(kiboId)?.actions ?? []).map(action => ({
        key: [kiboId, action.kind, Number(action.skillId)].join(':'),
        kiboId,
        skillId: Number(action.skillId),
        kind: String(action.kind),
        triggerTag: String(action.petSkillLogicTag ?? ''),
      }))
    )
    .sort((left, right) => left.key.localeCompare(right.key));
  const scopePolicy = scopePolicyModule?.getKiboAxisActionScopePolicy?.();
  const policyValidation =
    scopePolicyModule?.validateKiboAxisActionScopePolicy?.(scopePolicy) ?? {
      valid: false,
      issues: ['kibo-axis-action-scope-policy-module-invalid'],
    };
  const deferredSurfaces = actions.filter(action =>
    scopePolicyModule?.isKiboAutonomousActionKindDeferred?.(action.kind)
  );
  const includedSurfaces = actions.filter(action =>
    scopePolicyModule?.isKiboAxisActionKindIncluded?.(action.kind)
  );
  const unexpectedSurfaces = actions.filter(
    action =>
      !scopePolicyModule?.isKiboAutonomousActionKindDeferred?.(action.kind) &&
      !scopePolicyModule?.isKiboAxisActionKindIncluded?.(action.kind)
  );
  const invalidDeferredClassifications = deferredSurfaces.filter(action => {
    const classification = scopePolicyModule?.classifyKiboAxisActionKind?.(
      action.kind
    );
    return (
      classification?.disposition !== 'product-deferred-autonomous-action' ||
      classification?.calculationStatus !==
        'not-generated-not-scheduled-not-scored' ||
      classification?.policyHash !== scopePolicy?.policyHash
    );
  });
  const kiboIdsWithoutDeferredSurface = admittedKiboIds.filter(
    kiboId => !deferredSurfaces.some(surface => surface.kiboId === kiboId)
  );
  const kiboIdsMissingIncludedKind = admittedKiboIds.filter(kiboId =>
    (scopePolicy?.includedAxisActionKinds ?? []).some(
      kind =>
        !includedSurfaces.some(
          surface => surface.kiboId === kiboId && surface.kind === kind
        )
    )
  );
  const authority = {
    actionCatalogKiboCount: admittedKiboIds.length,
    actionCatalogSha256: sha256(
      actionCatalogSource ??
        Buffer.from(JSON.stringify(kiboActionCatalog ?? null))
    ),
    schedulerSourceSha256: sha256(schedulerSource ?? Buffer.alloc(0)),
    searchGeneratorSourceSha256: sha256(
      searchGeneratorSource ?? Buffer.alloc(0)
    ),
    machineAxisServiceSourceSha256: sha256(
      machineAxisServiceSource ?? Buffer.alloc(0)
    ),
    scopePolicyId: scopePolicy?.policyId ?? null,
    scopePolicyHash: scopePolicy?.policyHash ?? null,
  };
  const census = {
    admittedKiboCount: admittedKiboIds.length,
    catalogKiboCount: admittedKiboIds.length - missingCatalogKiboIds.length,
    deferredAutonomousSurfaceCount: deferredSurfaces.length,
    normalAttackSurfaceCount: deferredSurfaces.filter(
      surface => surface.kind === 'normal-attack'
    ).length,
    activeSurfaceCount: deferredSurfaces.filter(
      surface => surface.kind === 'active'
    ).length,
    includedActionSurfaceCount: includedSurfaces.length,
    signatureSurfaceCount: includedSurfaces.filter(
      surface => surface.kind === 'signature'
    ).length,
    jointAttackSurfaceCount: includedSurfaces.filter(
      surface => surface.kind === 'break'
    ).length,
    missingCatalogKiboIds,
    kiboIdsWithoutDeferredSurface,
    kiboIdsMissingIncludedKind,
    unexpectedSurfaceKeys: unexpectedSurfaces.map(surface => surface.key),
    invalidDeferredSurfaceKeys: invalidDeferredClassifications.map(
      surface => surface.key
    ),
  };
  const ready =
    policyValidation.valid &&
    admittedKiboIds.length > 0 &&
    census.catalogKiboCount === census.admittedKiboCount &&
    missingCatalogKiboIds.length === 0 &&
    kiboIdsWithoutDeferredSurface.length === 0 &&
    kiboIdsMissingIncludedKind.length === 0 &&
    unexpectedSurfaces.length === 0 &&
    invalidDeferredClassifications.length === 0;
  return {
    schemaVersion: 2,
    contractName: KIBO_AXIS_ACTION_SCOPE_CONTRACT,
    status: ready
      ? 'kibo-axis-action-scope-ready'
      : 'kibo-axis-action-scope-invalid',
    ready,
    authority,
    policy: scopePolicy ?? null,
    policyValidation,
    coveragePolicy: {
      databaseCardinality: 'record-current-catalog-do-not-freeze-count',
      catalogCoverage: 'every-current-kibo',
      includedActionKinds: 'every-current-kibo',
      deferredActionKinds: 'at-least-one-per-current-kibo',
    },
    census,
    issues: ready
      ? []
      : [
          ...policyValidation.issues,
          ...(missingCatalogKiboIds.length
            ? ['kibo-axis-action-scope-catalog-coverage-incomplete']
            : []),
          ...(kiboIdsWithoutDeferredSurface.length
            ? ['kibo-axis-action-scope-deferred-coverage-incomplete']
            : []),
          ...(kiboIdsMissingIncludedKind.length
            ? ['kibo-axis-action-scope-included-coverage-incomplete']
            : []),
          ...(unexpectedSurfaces.length
            ? ['kibo-axis-action-scope-unexpected-kind']
            : []),
          ...(invalidDeferredClassifications.length
            ? ['kibo-axis-action-scope-classification-invalid']
            : []),
        ],
  };
}

export function createHeadlessCharacterSearchScope({
  formalRoster = [],
  starbornSourceCharacterIds = [],
  profiles = [],
  goldens = [],
} = {}) {
  const normalizedRoster = [...new Set(formalRoster.map(String))];
  const normalObjectIds = normalizedRoster.filter(
    identity => identity !== 'STARBORN'
  );
  const starbornAliases = uniqueSortedNumbers(starbornSourceCharacterIds);
  const profileByOwnerId = new Map(
    profiles
      .filter(profile => Number.isInteger(Number(profile?.owner?.ownerId)))
      .map(profile => [Number(profile.owner.ownerId), profile])
  );
  const goldenByOwnerId = new Map(
    goldens
      .filter(golden => Number.isInteger(Number(golden?.ownerId)))
      .map(golden => [Number(golden.ownerId), golden])
  );
  const sourceOwnerIds = uniqueSortedNumbers([
    ...normalObjectIds,
    ...starbornAliases,
  ]);
  const sources = sourceOwnerIds.map(ownerId => {
    const profile = profileByOwnerId.get(ownerId);
    const golden = goldenByOwnerId.get(ownerId);
    const checks = {
      profilePresent: Boolean(profile),
      profileValid:
        profile?.validation?.status === 'character-combat-profile-valid' &&
        Array.isArray(profile?.validation?.issues) &&
        profile.validation.issues.length === 0,
      goldenPresent: Boolean(golden),
      goldenReplayPassed:
        golden?.status === 'authoritative-golden-runtime-verified' &&
        golden?.validation?.passed === true &&
        golden?.validation?.failedCount === 0,
      profileHashBound:
        typeof profile?.profileHash === 'string' &&
        profile.profileHash.length > 0 &&
        golden?.profileHash === profile.profileHash,
      packageHashBound:
        typeof profile?.sourcePackage?.packageHash === 'string' &&
        profile.sourcePackage.packageHash.length > 0 &&
        golden?.sourcePackageHash === profile.sourcePackage.packageHash,
    };
    const blockers = Object.entries(checks)
      .filter(([, passed]) => passed !== true)
      .map(([check]) => `headless-search-${check}`);
    const ready = blockers.length === 0;
    return {
      ownerId,
      present: Boolean(profile) && Boolean(golden),
      profileHash: profile?.profileHash ?? null,
      sourcePackageHash: profile?.sourcePackage?.packageHash ?? null,
      replayHash: golden?.replayHash ?? null,
      ready,
      status: ready
        ? 'headless-character-search-ready'
        : 'headless-character-search-blocked',
      checks,
      blockers,
    };
  });
  const sourceByOwnerId = new Map(
    sources.map(source => [source.ownerId, source])
  );
  const objects = normalObjectIds.map(objectId => {
    const ownerId = Number(objectId);
    const source = sourceByOwnerId.get(ownerId);
    return {
      optimizationObjectId: objectId,
      sourceOwnerIds: [ownerId],
      ready: source?.ready === true,
      blockers: source?.blockers ?? ['headless-search-profile-missing'],
    };
  });
  if (normalizedRoster.includes('STARBORN')) {
    const aliasSources = starbornAliases.map(ownerId =>
      sourceByOwnerId.get(ownerId)
    );
    objects.push({
      optimizationObjectId: 'STARBORN',
      sourceOwnerIds: starbornAliases,
      ready:
        starbornAliases.length === 2 &&
        aliasSources.every(source => source?.ready === true),
      blockers: [
        ...(starbornAliases.length === 2
          ? []
          : ['headless-search-starborn-alias-census-invalid']),
        ...aliasSources.flatMap(source => source?.blockers ?? []),
      ],
    });
  }
  const issues = [];
  if (
    normalizedRoster.length !== EXPECTED_CHARACTER_OPTIMIZATION_OBJECT_COUNT
  ) {
    issues.push('headless-search-character-object-census-invalid');
  }
  if (!normalizedRoster.includes('STARBORN')) {
    issues.push('headless-search-starborn-object-missing');
  }
  if (starbornAliases.length !== 2) {
    issues.push('headless-search-starborn-alias-census-invalid');
  }
  for (const object of objects) {
    if (!object.ready) {
      issues.push(
        `headless-search-character-object-not-ready:${object.optimizationObjectId}`
      );
    }
  }
  return {
    schemaVersion: 2,
    contractName: 'AzPrM12CHeadlessCharacterSearchScope',
    status:
      issues.length === 0
        ? 'headless-character-scope-ready'
        : 'headless-character-scope-blocked',
    ready: issues.length === 0,
    formalRoster: normalizedRoster,
    starbornSourceCharacterIds: starbornAliases,
    objects,
    sources,
    issues: [...new Set(issues)].sort(),
  };
}

export async function evaluateFormalSearchAdmission(evidence) {
  const liveNormalAttackInputAuthority =
    await loadLiveNormalAttackInputAuthority(evidence?.repositoryRoot);
  const checks = [];
  const add = (id, passed, details, category = 'contract') => {
    const expectedId = FORMAL_SEARCH_ADMISSION_CHECK_IDS[checks.length];
    if (id !== expectedId) {
      throw new Error(
        `Formal Search Admission check authority drifted at index ${checks.length}: expected ${expectedId ?? '<none>'}, received ${id}`
      );
    }
    checks.push({ id, passed: passed === true, category, details });
  };

  const searchAuthority = evidence.searchCoreProof ?? evidence.releaseProof;
  const requiredSearchGates = [
    'character-combat',
    'kibo-headless',
    'machine-axis-settlement',
    'determinism',
  ];
  const gateProofs = Array.isArray(searchAuthority?.gates)
    ? searchAuthority.gates
    : [];
  const fullReleaseProof = searchAuthority?.gate === 'release-verify';
  const searchCoreProofComplete =
    searchAuthority?.kind === 'azpr-search-core-authority' &&
    searchAuthority?.gate === 'search-core-authority' &&
    /^[a-f0-9]{40}$/u.test(searchAuthority?.head ?? '') &&
    /^[a-f0-9]{64}$/u.test(searchAuthority?.workingTreeFingerprint ?? '') &&
    gateProofs.length === requiredSearchGates.length &&
    requiredSearchGates.every(gate => {
      const matchingProofs = gateProofs.filter(proof => proof?.gate === gate);
      const proof = matchingProofs[0];
      return (
        matchingProofs.length === 1 &&
        proof?.status === 'pass' &&
        proof?.mode === 'executed' &&
        proof?.exitCode === 0 &&
        /^[a-f0-9]{64}$/u.test(proof?.recordId ?? '') &&
        /^[a-f0-9]{64}$/u.test(proof?.dependencyFingerprint ?? '') &&
        Number.isInteger(proof?.gateDefinitionVersion) &&
        proof.gateDefinitionVersion > 0
      );
    });
  add(
    'search-authority-executed-pass',
    searchAuthority?.status === 'pass' &&
      searchAuthority?.mode === 'executed' &&
      searchAuthority?.exitCode === 0 &&
      (fullReleaseProof || searchCoreProofComplete),
    {
      gate: searchAuthority?.gate ?? null,
      kind: searchAuthority?.kind ?? null,
      status: searchAuthority?.status ?? null,
      mode: searchAuthority?.mode ?? null,
      exitCode: searchAuthority?.exitCode ?? null,
      head: searchAuthority?.head ?? null,
      requiredSearchGates,
      searchCoreProofComplete,
      gateProofs,
    }
  );

  // 阶段 C：不再验证数据库正确性（263 项资格/冻结分母），只记录数据库 contentHash 作为输入指纹。
  add(
    'database-content-hash-recorded',
    typeof evidence.databaseContentHash === 'string' &&
      /^[a-f0-9]{64}$/.test(evidence.databaseContentHash),
    { databaseContentHash: evidence.databaseContentHash ?? null }
  );
  const headlessCharacterScope = evidence.headlessCharacterScope;
  add(
    'headless-character-scope-ready',
    headlessCharacterScope?.ready === true &&
      headlessCharacterScope?.status === 'headless-character-scope-ready',
    headlessCharacterScope ?? null
  );

  const authority = evidence.initialStateAuthority;
  add(
    'formal-initial-state-authority',
    authority?.schemaVersion === 1 &&
      authority?.contractName === 'AzPrM12CInitialStatePreset' &&
      authority?.policyId === 'm12c-initial-state-v1' &&
      authority?.scenarioPolicyId === 'm12c-zero-distance-passive-boss-v1' &&
      /^[a-f0-9]{64}$/u.test(authority?.policyHash ?? ''),
    authority ?? null
  );

  const deterministic = evidence.deterministicProof;
  const coverage = deterministic?.coverage ?? {};
  add(
    'deterministic-canonical-proof',
    deterministic?.status === 'pass' &&
      deterministic?.mode === 'executed' &&
      [
        'outerBuildHash',
        'canonicalSearchState',
        'cliReproducibility',
        'cycleObjectiveDeterminism',
        'workbenchReplayConsistency',
        'initialStateAuthority',
      ].every(key => coverage[key] === true),
    {
      status: deterministic?.status ?? null,
      mode: deterministic?.mode ?? null,
      coverage,
    }
  );
  add(
    'unresolved-skipped-pre-score-pruning',
    deterministic?.status === 'pass' && coverage.preScorePruning === true,
    { preScorePruning: coverage.preScorePruning ?? null }
  );
  const normalAttackInputAuthority = evidence.normalAttackInputAuthority;
  add(
    'normal-attack-combo-authority',
    deterministic?.status === 'pass' &&
      coverage.normalAttackComboAuthority === true &&
      coverage.comboContinuationPreScore === true &&
      coverage.specialContinuationFailClosed === true &&
      normalAttackInputAuthority?.schemaVersion === 1 &&
      normalAttackInputAuthority?.contractName ===
        'AzPrVerifiedNormalAttackInputAuthority' &&
      normalAttackInputAuthority?.policyVersion === 2 &&
      normalAttackInputAuthority?.structuralFallbackPolicy ===
        'verified-graph-then-unique-mapping-reachable-prefix' &&
      normalAttackInputAuthority?.reachablePrefixPolicy ===
        'unique-a1-exact-control-subskill-contiguous-adjacency' &&
      /^[a-f0-9]{16}$/u.test(normalAttackInputAuthority?.contractHash ?? '') &&
      stableJson(normalAttackInputAuthority) ===
        stableJson(liveNormalAttackInputAuthority),
    {
      authority: normalAttackInputAuthority ?? null,
      liveAuthority: liveNormalAttackInputAuthority ?? null,
      coverage: {
        normalAttackComboAuthority: coverage.normalAttackComboAuthority ?? null,
        comboContinuationPreScore: coverage.comboContinuationPreScore ?? null,
        specialContinuationFailClosed:
          coverage.specialContinuationFailClosed ?? null,
      },
    }
  );

  const kiboScope = evidence.kiboAxisActionScope;
  add(
    'kibo-axis-action-scope-applied',
    kiboScope?.ready === true &&
      kiboScope?.status === 'kibo-axis-action-scope-ready' &&
      kiboScope?.policyValidation?.valid === true,
    {
      status: kiboScope?.status ?? null,
      issues: kiboScope?.issues ?? [],
      policy: kiboScope?.policy ?? null,
      census: kiboScope?.census ?? null,
      authority: kiboScope?.authority ?? null,
    }
  );

  const runtime = evidence.formalRuntimeBaseline;
  add(
    'formal-runtime-baseline-ready',
    runtime?.formalReady === true &&
      runtime?.formalStatus === 'formal-score-ready-runtime-baseline',
    {
      formalReady: runtime?.formalReady ?? null,
      formalStatus: runtime?.formalStatus ?? null,
      scoreAuthority: runtime?.scoreAuthority ?? null,
    }
  );
  add(
    'client-parity-policy-satisfied',
    runtime?.clientParityRequiredForCurrentFormalScore !== true ||
      runtime?.clientParityReady === true,
    {
      clientParityReady: runtime?.clientParityReady ?? null,
      clientParityRequiredForCurrentFormalScore:
        runtime?.clientParityRequiredForCurrentFormalScore ?? null,
    }
  );

  if (checks.length !== FORMAL_SEARCH_ADMISSION_CHECK_IDS.length) {
    throw new Error(
      `Formal Search Admission check authority is incomplete: expected ${FORMAL_SEARCH_ADMISSION_CHECK_IDS.length}, received ${checks.length}`
    );
  }

  const blockers = checks.filter(check => !check.passed).map(check => check.id);
  const productReleaseReady =
    evidence.qualificationSummary?.m12cLocked === false &&
    evidence.qualificationCatalog?.summary?.m12cLocked === false &&
    evidence.bindingReport?.summary?.allPassed === true &&
    evidence.bindingReport?.reLock?.status === 'passed';
  return {
    schemaVersion: 2,
    kind: 'azpr-formal-search-admission',
    status: blockers.length === 0 ? 'ready' : 'blocked',
    ready: blockers.length === 0,
    blockers,
    checks,
    productRelease: {
      ready: productReleaseReady,
      status: productReleaseReady ? 'ready' : 'blocked',
      blockingForHeadlessSearch: false,
      qualificationLocked:
        evidence.qualificationSummary?.m12cLocked !== false ||
        evidence.qualificationCatalog?.summary?.m12cLocked !== false,
      bindingPassed:
        evidence.bindingReport?.summary?.allPassed === true &&
        evidence.bindingReport?.reLock?.status === 'passed',
    },
    clientParity: {
      ready: runtime?.clientParityReady === true,
      blockingForCurrentFormalScore:
        runtime?.clientParityRequiredForCurrentFormalScore === true,
      status: runtime?.clientParityReady === true ? 'ready' : 'pending',
      warnings: runtime?.warnings ?? [],
    },
  };
}

export function validateFormalSearchAdmissionRecord(admission) {
  const issues = [];
  const checks = Array.isArray(admission?.checks) ? admission.checks : [];
  const actualCheckIds = checks.map(check => String(check?.id ?? ''));

  if (admission?.ready !== true || admission?.status !== 'ready') {
    issues.push('formal-search-admission-not-ready');
  }
  if (!Array.isArray(admission?.blockers) || admission.blockers.length !== 0) {
    issues.push('formal-search-admission-blockers-present');
  }
  if (
    actualCheckIds.length !== FORMAL_SEARCH_ADMISSION_CHECK_IDS.length ||
    actualCheckIds.some(
      (checkId, index) => checkId !== FORMAL_SEARCH_ADMISSION_CHECK_IDS[index]
    )
  ) {
    issues.push('formal-search-admission-check-authority-mismatch');
  }
  if (checks.some(check => check?.passed !== true)) {
    issues.push('formal-search-admission-check-not-passed');
  }
  if (
    admission?.clientParity?.ready !== false ||
    admission?.clientParity?.status !== 'pending'
  ) {
    issues.push('formal-search-admission-client-parity-boundary-drifted');
  }

  return {
    valid: issues.length === 0,
    issues,
    expectedCheckIds: [...FORMAL_SEARCH_ADMISSION_CHECK_IDS],
    actualCheckIds,
  };
}

async function readJson(root, relativePath) {
  const file = path.join(root, ...relativePath.split('/'));
  return JSON.parse(await readFile(file, 'utf8'));
}

async function readOptionalJson(root, relativePath) {
  try {
    return await readJson(root, relativePath);
  } catch {
    return null;
  }
}

async function importRepositoryModule(root, relativePath) {
  const file = path.join(root, ...relativePath.split('/'));
  return import(pathToFileURL(file).href);
}

async function loadLiveNormalAttackInputAuthority(repositoryRoot) {
  if (typeof repositoryRoot !== 'string' || repositoryRoot.length === 0) {
    return null;
  }
  try {
    const module = await importRepositoryModule(
      path.resolve(repositoryRoot),
      'src/domain/verifiedNormalAttackInputAuthority.js'
    );
    return module.getVerifiedNormalAttackInputAuthorityDescriptor();
  } catch {
    return null;
  }
}

function uniqueSortedNumbers(values) {
  return [...new Set(values.map(Number).filter(Number.isInteger))].sort(
    (left, right) => left - right
  );
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function stableJson(value) {
  return JSON.stringify(normalizeStableValue(value));
}

function normalizeStableValue(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeStableValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, normalizeStableValue(value[key])])
    );
  }
  return value;
}
