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

const KIBO_AUTONOMOUS_READINESS_PROOF_PATH =
  'reports/m12/m12-c-kibo-autonomous-readiness.json';
const KIBO_AUTONOMOUS_READINESS_CONTRACT = 'AzPrM12CKiboAutonomousReadiness';
const KIBO_AUTONOMOUS_ACTION_KINDS = new Set(['normal-attack', 'active']);

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
    kiboActionCatalogSource,
    kiboSchedulerSource,
    kiboReadinessProof,
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
    readOptionalJson(root, KIBO_AUTONOMOUS_READINESS_PROOF_PATH),
  ]);
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
    formalRuntimeBaseline: {
      ...settlementReadiness,
      clientParityRequiredForCurrentFormalScore:
        settlementContract.formalScoring
          .clientParityRequiredForCurrentFormalScore,
    },
    kiboAutonomousReadiness: createKiboAutonomousReadinessEvidence({
      qualificationCatalog,
      kiboActionCatalog: JSON.parse(kiboActionCatalogSource.toString('utf8')),
      actionCatalogSource: kiboActionCatalogSource,
      schedulerSource: kiboSchedulerSource,
      readinessProof: kiboReadinessProof,
    }),
  };
}

export function createKiboAutonomousReadinessEvidence({
  qualificationCatalog,
  kiboActionCatalog,
  actionCatalogSource,
  schedulerSource,
  readinessProof,
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
  const surfaces = admittedKiboIds
    .flatMap(kiboId =>
      (itemByKiboId.get(kiboId)?.actions ?? [])
        .filter(action => KIBO_AUTONOMOUS_ACTION_KINDS.has(String(action.kind)))
        .map(action => ({
          key: [kiboId, action.kind, Number(action.skillId)].join(':'),
          kiboId,
          skillId: Number(action.skillId),
          kind: String(action.kind),
          triggerTag: String(action.petSkillLogicTag ?? ''),
          openEvidenceKind:
            String(action.petSkillLogicTag ?? '') === '0'
              ? 'schedule-cadence'
              : 'trigger-condition',
        }))
    )
    .sort((left, right) => left.key.localeCompare(right.key));
  const surfaceKeys = surfaces.map(surface => surface.key);
  const kiboIdsWithoutAutonomousSurface = admittedKiboIds.filter(
    kiboId => !surfaces.some(surface => surface.kiboId === kiboId)
  );
  const authority = {
    qualificationCatalogHash: qualificationCatalog?.catalogHash ?? null,
    actionCatalogSha256: sha256(
      actionCatalogSource ??
        Buffer.from(JSON.stringify(kiboActionCatalog ?? null))
    ),
    schedulerSourceSha256: sha256(schedulerSource ?? Buffer.alloc(0)),
  };
  const proofValidation = validateKiboAutonomousReadinessProof({
    proofEnvelope: readinessProof,
    authority,
    admittedKiboIds,
    surfaceKeys,
  });
  const openKiboIds = uniqueSortedNumbers(
    surfaces.map(surface => surface.kiboId)
  );
  const census = {
    admittedKiboCount: admittedKiboIds.length,
    catalogKiboCount: admittedKiboIds.length - missingCatalogKiboIds.length,
    autonomousSurfaceCount: surfaces.length,
    normalAttackSurfaceCount: surfaces.filter(
      surface => surface.kind === 'normal-attack'
    ).length,
    activeSurfaceCount: surfaces.filter(surface => surface.kind === 'active')
      .length,
    scheduleCadenceEvidenceOpenCount: surfaces.filter(
      surface => surface.openEvidenceKind === 'schedule-cadence'
    ).length,
    triggerConditionEvidenceOpenCount: surfaces.filter(
      surface => surface.openEvidenceKind === 'trigger-condition'
    ).length,
    kiboWithOpenAutonomousSurfaceCount: openKiboIds.length,
    missingCatalogKiboIds,
    kiboIdsWithoutAutonomousSurface,
  };
  const ready =
    proofValidation.valid &&
    missingCatalogKiboIds.length === 0 &&
    kiboIdsWithoutAutonomousSurface.length === 0;
  return {
    schemaVersion: 1,
    contractName: KIBO_AUTONOMOUS_READINESS_CONTRACT,
    status: ready
      ? 'kibo-autonomous-search-runtime-ready'
      : 'kibo-autonomous-search-runtime-blocked',
    ready,
    proofPath: KIBO_AUTONOMOUS_READINESS_PROOF_PATH,
    authority,
    census,
    proof: proofValidation,
    issues: ready
      ? []
      : [
          ...proofValidation.issues,
          ...(missingCatalogKiboIds.length
            ? ['kibo-autonomous-catalog-coverage-incomplete']
            : []),
          ...(kiboIdsWithoutAutonomousSurface.length
            ? ['kibo-autonomous-surface-coverage-incomplete']
            : []),
        ],
  };
}

export function evaluateFormalSearchAdmission(evidence) {
  const checks = [];
  const add = (id, passed, details, category = 'contract') => {
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

  const qualification = evidence.qualificationCatalog?.summary;
  const stage = qualification?.qualificationStage;
  const counts = qualification?.optimizationReadyCounts ?? {};
  add(
    'optimization-qualification-complete',
    Object.entries(EXPECTED_DENOMINATORS).every(
      ([kind, expected]) => counts[kind] === expected
    ) &&
      qualification?.gameplayBlockingGapCount === 0 &&
      qualification?.formalOptimizationUnlocked === true,
    {
      expected: EXPECTED_DENOMINATORS,
      actual: counts,
      gameplayBlockingGapCount: qualification?.gameplayBlockingGapCount ?? null,
      formalOptimizationUnlocked:
        qualification?.formalOptimizationUnlocked ?? null,
    }
  );
  add(
    'm12c-lock-open',
    evidence.qualificationSummary?.m12cLocked === false &&
      qualification?.m12cLocked === false &&
      stage?.m12cLocked === false,
    {
      summary: evidence.qualificationSummary?.m12cLocked ?? null,
      catalog: qualification?.m12cLocked ?? null,
      stage: stage?.m12cLocked ?? null,
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

  const kiboAutonomous = evidence.kiboAutonomousReadiness;
  add(
    'kibo-autonomous-runtime-ready',
    kiboAutonomous?.ready === true &&
      kiboAutonomous?.status === 'kibo-autonomous-search-runtime-ready' &&
      kiboAutonomous?.proof?.valid === true,
    {
      status: kiboAutonomous?.status ?? null,
      proofPath: kiboAutonomous?.proofPath ?? null,
      proofStatus: kiboAutonomous?.proof?.status ?? null,
      issues: kiboAutonomous?.issues ?? [],
      census: kiboAutonomous?.census ?? null,
      authority: kiboAutonomous?.authority ?? null,
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

  const normalAcceptance = evidence.productAcceptance?.normalAcceptance ?? [];
  add(
    'required-character-product-acceptance',
    normalAcceptance.length === 8 &&
      normalAcceptance.every(
        entry =>
          entry.present &&
          entry.maturityState === 'optimization-ready' &&
          entry.optimizationReady &&
          entry.blockerCount === 0
      ),
    normalAcceptance,
    'product-acceptance'
  );
  const starborn = evidence.productAcceptance?.starborn;
  add(
    'starborn-product-object-acceptance',
    starborn?.productVisualAcceptance === 'accepted' &&
      starborn?.formalAdmission === true &&
      starborn?.optimizationReady === true,
    starborn ?? null,
    'product-acceptance'
  );

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

async function readJson(root, relativePath) {
  const file = path.join(root, ...relativePath.split('/'));
  return JSON.parse(await readFile(file, 'utf8'));
}

async function readOptionalJson(root, relativePath) {
  const file = path.join(root, ...relativePath.split('/'));
  try {
    return {
      exists: true,
      value: JSON.parse(await readFile(file, 'utf8')),
      error: null,
    };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { exists: false, value: null, error: null };
    }
    return {
      exists: true,
      value: null,
      error: error?.message ?? String(error),
    };
  }
}

async function importRepositoryModule(root, relativePath) {
  const file = path.join(root, ...relativePath.split('/'));
  return import(pathToFileURL(file).href);
}

function validateKiboAutonomousReadinessProof({
  proofEnvelope,
  authority,
  admittedKiboIds,
  surfaceKeys,
}) {
  if (!proofEnvelope?.exists) {
    return {
      valid: false,
      status: 'missing',
      issues: ['kibo-autonomous-readiness-proof-missing'],
      summary: null,
    };
  }
  if (proofEnvelope.error) {
    return {
      valid: false,
      status: 'corrupt',
      issues: ['kibo-autonomous-readiness-proof-corrupt'],
      summary: null,
      error: proofEnvelope.error,
    };
  }
  const proof = proofEnvelope.value;
  const issues = [];
  if (
    proof?.schemaVersion !== 1 ||
    proof?.contractName !== KIBO_AUTONOMOUS_READINESS_CONTRACT
  ) {
    issues.push('kibo-autonomous-readiness-proof-contract-invalid');
  }
  if (proof?.status !== 'ready' || proof?.ready !== true) {
    issues.push('kibo-autonomous-readiness-proof-not-ready');
  }
  for (const [key, expected] of Object.entries(authority)) {
    if (proof?.authority?.[key] !== expected) {
      issues.push(`kibo-autonomous-readiness-authority-mismatch:${key}`);
    }
  }
  if (!sameArray(proof?.coverage?.admittedKiboIds, admittedKiboIds)) {
    issues.push('kibo-autonomous-readiness-kibo-coverage-mismatch');
  }
  if (!sameArray(proof?.coverage?.autonomousSurfaceKeys, surfaceKeys)) {
    issues.push('kibo-autonomous-readiness-surface-coverage-mismatch');
  }
  if (
    proof?.summary?.admittedKiboCount !== admittedKiboIds.length ||
    proof?.summary?.autonomousSurfaceCount !== surfaceKeys.length
  ) {
    issues.push('kibo-autonomous-readiness-denominator-mismatch');
  }
  if (
    proof?.summary?.unresolvedScheduleCount !== 0 ||
    proof?.summary?.unresolvedTriggerCount !== 0
  ) {
    issues.push('kibo-autonomous-readiness-unresolved-surfaces');
  }
  return {
    valid: issues.length === 0,
    status: issues.length === 0 ? 'valid' : 'invalid',
    issues,
    summary: proof?.summary ?? null,
  };
}

function uniqueSortedNumbers(values) {
  return [...new Set(values.map(Number).filter(Number.isInteger))].sort(
    (left, right) => left - right
  );
}

function sameArray(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
