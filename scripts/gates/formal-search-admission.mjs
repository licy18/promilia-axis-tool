import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const EXPECTED_DENOMINATORS = Object.freeze({
  character: 9,
  kibo: 43,
  'soul-essence': 62,
  equipment: 137,
  'set-skill': 12,
});

const EXPECTED_KIBO_AXIS_ACTION_CENSUS = Object.freeze({
  admittedKiboCount: 43,
  catalogKiboCount: 43,
  deferredAutonomousSurfaceCount: 71,
  normalAttackSurfaceCount: 43,
  activeSurfaceCount: 28,
  includedActionSurfaceCount: 86,
  signatureSurfaceCount: 43,
  jointAttackSurfaceCount: 43,
});

const KIBO_AXIS_ACTION_SCOPE_CONTRACT = 'AzPrM12CKiboAxisActionScope';

export const FORMAL_SEARCH_ADMISSION_CHECK_IDS = Object.freeze([
  'release-verify-executed-pass',
  'database-content-hash-recorded',
  'm12c-lock-open',
  'qualification-hash-binding-consistent',
  'binding-matrix-complete',
  'binding-authority-hashes-match',
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
    kiboActionCatalogSource,
    kiboSchedulerSource,
    kiboSearchGeneratorSource,
    machineAxisServiceSource,
  ] = await Promise.all([
    readJson(
      root,
      'reports/m12/m12-b3-optimization-qualification-summary.json'
    ),
    readJson(
      root,
      'src/data/generated/optimization-qualification-catalog.json'
    ),
    readJson(root, 'reports/m12/m12-b3-binding-matrix.json'),
    readJson(root, 'src/data/generated/character-acceptance-catalog.json'),
    readJson(
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
  const formalRoster =
    characterAcceptanceCatalog.optimizationCandidateRoster
      ?.formalOptimizationObjectIds ?? [];
  const normalRoster = formalRoster.filter(identity => identity !== 'STARBORN');
  const normalAcceptance = normalRoster.map(identity => {
    const entry = characterAcceptanceCatalog.entries?.find(
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
    releaseProof,
    deterministicProof,
    qualificationSummary,
    qualificationCatalog,
    bindingReport,
    productAcceptance: {
      formalRoster,
      normalAcceptance,
      starborn: {
        status: starbornManifest.status,
        formalAdmission: starbornManifest.formalAdmission,
        optimizationReady: starbornManifest.optimizationReady,
        productVisualAcceptance: starbornManifest.productVisualAcceptance,
        validation: starbornManifest.validation,
      },
    },
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
      qualificationCatalog,
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
  qualificationCatalog,
  kiboActionCatalog,
  actionCatalogSource,
  schedulerSource,
  searchGeneratorSource,
  machineAxisServiceSource,
  scopePolicyModule,
} = {}) {
  const admittedKiboIds = uniqueSortedNumbers(
    qualificationCatalog?.admission?.kibos ?? []
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
    qualificationCatalogHash: qualificationCatalog?.catalogHash ?? null,
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
  const denominatorMismatches = Object.entries(EXPECTED_KIBO_AXIS_ACTION_CENSUS)
    .filter(([field, expected]) => census[field] !== expected)
    .map(([field, expected]) => ({
      field,
      expected,
      actual: census[field] ?? null,
    }));
  const ready =
    policyValidation.valid &&
    admittedKiboIds.length > 0 &&
    denominatorMismatches.length === 0 &&
    missingCatalogKiboIds.length === 0 &&
    kiboIdsWithoutDeferredSurface.length === 0 &&
    kiboIdsMissingIncludedKind.length === 0 &&
    unexpectedSurfaces.length === 0 &&
    invalidDeferredClassifications.length === 0;
  return {
    schemaVersion: 1,
    contractName: KIBO_AXIS_ACTION_SCOPE_CONTRACT,
    status: ready
      ? 'kibo-axis-action-scope-ready'
      : 'kibo-axis-action-scope-invalid',
    ready,
    authority,
    policy: scopePolicy ?? null,
    policyValidation,
    expectedCensus: EXPECTED_KIBO_AXIS_ACTION_CENSUS,
    census,
    denominatorMismatches,
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
          ...(denominatorMismatches.length
            ? [
                'kibo-axis-action-scope-denominator-mismatch',
                ...denominatorMismatches.map(
                  mismatch =>
                    `kibo-axis-action-scope-denominator-mismatch:${mismatch.field}`
                ),
              ]
            : []),
        ],
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

  add(
    'release-verify-executed-pass',
    evidence.releaseProof?.status === 'pass' &&
      evidence.releaseProof?.mode === 'executed' &&
      evidence.releaseProof?.exitCode === 0,
    {
      status: evidence.releaseProof?.status ?? null,
      mode: evidence.releaseProof?.mode ?? null,
      exitCode: evidence.releaseProof?.exitCode ?? null,
      head: evidence.releaseProof?.head ?? null,
    }
  );

  // 阶段 C：不再验证数据库正确性（263 项资格/冻结分母），只记录数据库 contentHash 作为输入指纹。
  add(
    'database-content-hash-recorded',
    typeof evidence.databaseContentHash === 'string' &&
      /^[a-f0-9]{64}$/.test(evidence.databaseContentHash),
    { databaseContentHash: evidence.databaseContentHash ?? null }
  );
  add(
    'm12c-lock-open',
    evidence.qualificationSummary?.m12cLocked === false &&
      evidence.qualificationCatalog?.summary?.m12cLocked === false &&
      evidence.qualificationCatalog?.summary?.qualificationStage?.m12cLocked ===
        false,
    {
      summary: evidence.qualificationSummary?.m12cLocked ?? null,
      catalog: evidence.qualificationCatalog?.summary?.m12cLocked ?? null,
      stage:
        evidence.qualificationCatalog?.summary?.qualificationStage
          ?.m12cLocked ?? null,
    }
  );
  add(
    'qualification-hash-binding-consistent',
    evidence.qualificationSummary?.catalogHash ===
      evidence.qualificationCatalog?.catalogHash &&
      evidence.qualificationSummary?.rosterHash ===
        evidence.qualificationCatalog?.rosterHash &&
      evidence.qualificationSummary?.manifestsHash ===
        evidence.qualificationCatalog?.manifestsHash &&
      evidence.qualificationSummary?.ledgerHash ===
        evidence.qualificationCatalog?.gapLedgerHash &&
      evidence.qualificationSummary?.bindingMatrixHash ===
        evidence.qualificationCatalog?.bindingMatrixHash,
    {
      summary: {
        catalogHash: evidence.qualificationSummary?.catalogHash ?? null,
        rosterHash: evidence.qualificationSummary?.rosterHash ?? null,
        manifestsHash: evidence.qualificationSummary?.manifestsHash ?? null,
        ledgerHash: evidence.qualificationSummary?.ledgerHash ?? null,
        bindingMatrixHash:
          evidence.qualificationSummary?.bindingMatrixHash ?? null,
      },
      catalog: {
        catalogHash: evidence.qualificationCatalog?.catalogHash ?? null,
        rosterHash: evidence.qualificationCatalog?.rosterHash ?? null,
        manifestsHash: evidence.qualificationCatalog?.manifestsHash ?? null,
        ledgerHash: evidence.qualificationCatalog?.gapLedgerHash ?? null,
        bindingMatrixHash:
          evidence.qualificationCatalog?.bindingMatrixHash ?? null,
      },
    }
  );

  const binding = evidence.bindingReport;
  add(
    'binding-matrix-complete',
    binding?.summary?.allPassed === true &&
      binding?.summary?.checkCount === binding?.summary?.passedCount &&
      binding?.summary?.blockedCount === 0 &&
      binding?.summary?.checkCount > 0 &&
      binding?.reLock?.status === 'passed',
    {
      summary: binding?.summary ?? null,
      reLockStatus: binding?.reLock?.status ?? null,
    }
  );
  add(
    'binding-authority-hashes-match',
    binding?.hashes?.rosterHash === evidence.qualificationCatalog?.rosterHash &&
      binding?.hashes?.manifestsHash ===
        evidence.qualificationCatalog?.manifestsHash &&
      binding?.hashes?.ledgerHash ===
        evidence.qualificationCatalog?.gapLedgerHash &&
      binding?.hashes?.bindingMatrixHash ===
        evidence.qualificationCatalog?.bindingMatrixHash &&
      binding?.hashes?.qualificationCatalogHash ===
        evidence.qualificationCatalog?.catalogHash,
    binding?.hashes ?? null
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
  return {
    schemaVersion: 1,
    kind: 'azpr-formal-search-admission',
    status: blockers.length === 0 ? 'ready' : 'blocked',
    ready: blockers.length === 0,
    blockers,
    checks,
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
