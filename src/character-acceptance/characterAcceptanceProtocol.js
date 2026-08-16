import generatedManifestIndex from '../data/generated/character-acceptance-manifest-index.json' with { type: 'json' };
import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization.js';
import { deriveCharacterAcceptanceArtifacts } from './characterAcceptanceDerivation.js';

export {
  OPTIMIZATION_OBJECT_ALIAS_BUNDLE_CONTRACT_NAME,
  OPTIMIZATION_OBJECT_ALIAS_SELECTION_CONTRACT_NAME,
  inspectOptimizationObjectSourceAliasSelection,
  validateOptimizationObjectAliasAcceptanceBundle,
} from './optimizationObjectAliasProtocol.js';

export const CHARACTER_ACCEPTANCE_SCHEMA_VERSION = 1;
export const CHARACTER_ACCEPTANCE_CONTRACT_NAME =
  'AzPrCharacterAcceptanceProtocol';
export const CHARACTER_ACCEPTANCE_PROTOCOL_IDENTITY =
  'm11-d-character-acceptance-v1';
export const CHARACTER_ACCEPTANCE_MANIFEST_INDEX_SCHEMA_VERSION = 1;
export const CHARACTER_ACCEPTANCE_MANIFEST_INDEX_CONTRACT_NAME =
  'AzPrCharacterAcceptanceManifestIndex';
export const PRODUCT_VISUAL_SCREENSHOT_EVIDENCE_KIND =
  'workbench-playwright-screenshot';
export const MACHINE_TRACE_EVIDENCE_KIND = 'machine-axis-trace';

export const CHARACTER_ACCEPTANCE_MATURITY_STATES = Object.freeze([
  'extracted',
  'runtime-integrated',
  'visually-accepted',
  'optimization-ready',
]);

export const CHARACTER_ACCEPTANCE_LEDGER_STATUSES = Object.freeze([
  'runtime-evidence-required',
  'static-evidence-gap',
  'unknown-formula',
]);

export const UNNAMED_SECONDARY_PASSIVE_REASON =
  'unnamed-secondary-passive-not-implemented-current-client';

export function finalizeCharacterAcceptanceManifest(
  input,
  {
    signoffRecordVerified = input?.signoffRecordVerified ?? false,
    signoffRecordAuthentication =
      input?.signoffRecordAuthentication ?? null,
  } = {}
) {
  const base = structuredClone(input ?? {});
  delete base.maturity;
  delete base.validation;
  delete base.manifestHash;
  delete base.qualificationSubjectHash;
  delete base.derivation;
  const derivedArtifacts = deriveManifestArtifacts(base);
  const providedArtifacts = pickDerivedArtifacts(base);
  const providedDerivedArtifacts = hasProvidedDerivedArtifacts(base);
  const derivedArtifactsMismatch =
    providedDerivedArtifacts &&
    canonical(providedArtifacts) !== canonical(derivedArtifacts);
  Object.assign(base, derivedArtifacts);
  const qualificationSubjectHash = hashCanonicalValue(
    createQualificationSubject(base)
  );
  base.evidence = {
    ...(base.evidence ?? {}),
    productVisualAcceptance: deriveProductVisualAcceptance({
      productVisualAcceptance: base.evidence?.productVisualAcceptance ?? {},
      ownerId: base.owner?.ownerId,
      qualificationSubjectHash,
      scenarioCases: base.scenarioCases,
      signoffRecordVerified,
      signoffRecordAuthentication,
    }),
  };
  base.derivation = {
    status: derivedArtifactsMismatch
      ? 'provided-derived-artifacts-mismatch'
      : 'derived-artifacts-verified',
    inputIncludedDerivedArtifacts: providedDerivedArtifacts,
    sourceOfTruthHash: hashCanonicalValue({
      requirementInventoryHash: base.requirementInventory.inventoryHash,
      sourceGapInventoryHash: base.sourceGapInventory.inventoryHash,
      scenarioSetHash: base.scenarioCases.scenarioSetHash,
    }),
  };
  const maturity = deriveCharacterAcceptanceMaturity(
    collectCharacterAcceptanceFacts(base)
  );
  const draft = { ...base, qualificationSubjectHash, maturity };
  const issues = collectCharacterAcceptanceManifestIssues(draft, {
    checkHash: false,
    checkPublication: false,
  });
  const value = {
    ...draft,
    validation: {
      status: issues.length
        ? 'character-acceptance-manifest-invalid'
        : 'character-acceptance-manifest-valid',
      issues,
    },
  };
  return {
    ...value,
    manifestHash: hashCanonicalValue(value),
  };
}

export function collectCharacterAcceptanceFacts(manifest = {}) {
  const goldens = manifest.evidence?.canonicalGoldens ?? [];
  const scenarios = manifest.evidence?.machineScenarios ?? [];
  const requirements = manifest.matrix?.requirements ?? [];
  const blockingLedger = (manifest.ledger?.records ?? []).filter(
    record => record?.blocking === true
  );
  const requiredRequirements = requirements.filter(
    requirement => requirement?.required === true
  );
  const passedRequiredRequirements = requiredRequirements.filter(
    requirement =>
      requirement?.status === 'passed' ||
      requirement?.status === 'not-applicable'
  );
  const canonicalGoldenPassed =
    goldens.length > 0 && goldens.every(golden => golden?.status === 'passed');
  const headlessReplayPassed =
    scenarios.length > 0 &&
    scenarios.every(scenario => scenario?.status === 'passed');
  const canonicalReplayStable =
    scenarios.length > 0 &&
    scenarios.every(scenario => scenario?.stableReplay === true);
  const workbenchImportPassed =
    scenarios.length > 0 &&
    scenarios.every(scenario => scenario?.workbenchRoundTrip === 'passed');
  const productVisualAccepted =
    manifest.evidence?.productVisualAcceptance?.status === 'accepted' &&
    manifest.evidence?.productVisualAcceptance?.bindingStatus === 'verified' &&
    hasCompleteProductVisualScreenshotCoverage(
      manifest.evidence?.productVisualAcceptance
    );
  const functionalFailureCount =
    goldens.filter(golden => golden?.status !== 'passed').length +
    scenarios.filter(scenario => scenario?.status !== 'passed').length;

  return {
    profileValid:
      manifest.source?.profileValidationStatus ===
      'character-combat-profile-valid',
    sourceEvidenceIndexed: Boolean(
      manifest.source?.profileIdentity &&
      manifest.source?.profileHash &&
      manifest.source?.sourcePackageHash
    ),
    canonicalGoldenCount: goldens.length,
    canonicalGoldenPassed,
    machineScenarioCount: scenarios.length,
    headlessReplayPassed,
    canonicalReplayStable,
    workbenchImportPassed,
    productVisualAccepted,
    matrixRequiredCount: requiredRequirements.length,
    matrixPassedCount: passedRequiredRequirements.length,
    matrixComplete:
      requiredRequirements.length > 0 &&
      passedRequiredRequirements.length === requiredRequirements.length,
    blockingLedgerCount: blockingLedger.length,
    functionalFailureCount,
  };
}

export function deriveCharacterAcceptanceMaturity(facts = {}) {
  const gates = {
    extracted:
      facts.profileValid === true && facts.sourceEvidenceIndexed === true,
    runtimeIntegrated: false,
    visuallyAccepted: false,
    optimizationReady: false,
  };
  gates.runtimeIntegrated =
    gates.extracted &&
    facts.canonicalGoldenPassed === true &&
    facts.headlessReplayPassed === true &&
    facts.canonicalReplayStable === true &&
    facts.functionalFailureCount === 0;
  gates.visuallyAccepted =
    gates.runtimeIntegrated &&
    facts.workbenchImportPassed === true &&
    facts.productVisualAccepted === true;
  gates.optimizationReady =
    gates.visuallyAccepted &&
    facts.matrixComplete === true &&
    Number(facts.blockingLedgerCount) === 0;

  const earnedStates = [];
  if (gates.extracted) earnedStates.push('extracted');
  if (gates.runtimeIntegrated) earnedStates.push('runtime-integrated');
  if (gates.visuallyAccepted) earnedStates.push('visually-accepted');
  if (gates.optimizationReady) earnedStates.push('optimization-ready');

  const blockers = [];
  if (!gates.extracted) blockers.push('acceptance-extraction-gate-failed');
  if (!facts.canonicalGoldenPassed)
    blockers.push('acceptance-canonical-golden-gate-failed');
  if (!facts.headlessReplayPassed)
    blockers.push('acceptance-headless-replay-gate-failed');
  if (!facts.canonicalReplayStable)
    blockers.push('acceptance-canonical-replay-stability-gate-failed');
  if (Number(facts.functionalFailureCount) > 0)
    blockers.push('acceptance-functional-failure-present');
  if (!facts.workbenchImportPassed)
    blockers.push('acceptance-workbench-round-trip-gate-failed');
  if (!facts.productVisualAccepted)
    blockers.push('acceptance-product-visual-signoff-pending');
  if (!facts.matrixComplete)
    blockers.push('acceptance-required-matrix-incomplete');
  if (Number(facts.blockingLedgerCount) > 0)
    blockers.push('acceptance-blocking-ledger-not-empty');

  return {
    currentState: earnedStates.at(-1) ?? null,
    earnedStates,
    optimizationReady: gates.optimizationReady,
    facts: structuredClone(facts),
    gates,
    blockers,
  };
}

export function validateCharacterAcceptanceManifest(
  manifest,
  {
    publishedManifestIndex = generatedManifestIndex,
    checkPublication = true,
  } = {}
) {
  const issues = collectCharacterAcceptanceManifestIssues(manifest, {
    checkHash: true,
    checkPublication,
    publishedManifestIndex,
  });
  return {
    valid: issues.length === 0,
    issues,
    derivedMaturity: deriveCharacterAcceptanceMaturity(
      collectCharacterAcceptanceFacts(manifest)
    ),
  };
}

export function assertCharacterOptimizationReady(manifest, options) {
  const validation = validateCharacterAcceptanceManifest(manifest, options);
  if (!validation.valid) {
    throw new CharacterAcceptanceError(
      'character-acceptance-manifest-invalid',
      validation.issues
    );
  }
  if (!validation.derivedMaturity.optimizationReady) {
    throw new CharacterAcceptanceError(
      'character-not-optimization-ready',
      validation.derivedMaturity.blockers
    );
  }
  return manifest;
}

export function validateCharacterAcceptanceManifestIndex(index) {
  const issues = [];
  if (
    index?.schemaVersion !== CHARACTER_ACCEPTANCE_MANIFEST_INDEX_SCHEMA_VERSION
  ) {
    issues.push('character-acceptance-manifest-index-schema-version-invalid');
  }
  if (
    index?.contractName !== CHARACTER_ACCEPTANCE_MANIFEST_INDEX_CONTRACT_NAME
  ) {
    issues.push('character-acceptance-manifest-index-contract-name-invalid');
  }
  if (index?.kind !== 'azpr-character-acceptance-manifest-index') {
    issues.push('character-acceptance-manifest-index-kind-invalid');
  }
  if (index?.protocolIdentity !== CHARACTER_ACCEPTANCE_PROTOCOL_IDENTITY) {
    issues.push('character-acceptance-manifest-index-protocol-invalid');
  }
  if (!Array.isArray(index?.entries)) {
    issues.push('character-acceptance-manifest-index-entries-required');
  }
  const owners = new Set();
  for (const entry of index?.entries ?? []) {
    const ownerId = Number(entry?.ownerId);
    if (!Number.isInteger(ownerId) || owners.has(ownerId)) {
      issues.push(
        'character-acceptance-manifest-index-owner-invalid:' + ownerId
      );
    }
    owners.add(ownerId);
  }
  if (index && typeof index === 'object') {
    const copy = structuredClone(index);
    delete copy.indexHash;
    if (index.indexHash !== hashCanonicalValue(copy)) {
      issues.push('character-acceptance-manifest-index-hash-mismatch');
    }
  }
  return { valid: issues.length === 0, issues };
}
export class CharacterAcceptanceError extends Error {
  constructor(code, details = []) {
    super(code);
    this.name = 'CharacterAcceptanceError';
    this.code = code;
    this.details = structuredClone(details);
  }
}

function collectCharacterAcceptanceManifestIssues(
  manifest,
  {
    checkHash,
    checkPublication = false,
    publishedManifestIndex = generatedManifestIndex,
  }
) {
  const issues = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return ['character-acceptance-manifest-object-required'];
  }
  if (manifest.schemaVersion !== CHARACTER_ACCEPTANCE_SCHEMA_VERSION) {
    issues.push('character-acceptance-schema-version-invalid');
  }
  if (manifest.contractName !== CHARACTER_ACCEPTANCE_CONTRACT_NAME) {
    issues.push('character-acceptance-contract-name-invalid');
  }
  if (manifest.kind !== 'azpr-character-acceptance-manifest') {
    issues.push('character-acceptance-kind-invalid');
  }
  if (manifest.protocolIdentity !== CHARACTER_ACCEPTANCE_PROTOCOL_IDENTITY) {
    issues.push('character-acceptance-protocol-identity-invalid');
  }
  if (!Number.isInteger(Number(manifest.owner?.ownerId))) {
    issues.push('character-acceptance-owner-id-required');
  }
  if (!String(manifest.owner?.ownerName ?? '').trim()) {
    issues.push('character-acceptance-owner-name-required');
  }
  if (!Array.isArray(manifest.evidence?.canonicalGoldens)) {
    issues.push('character-acceptance-canonical-goldens-required');
  }
  if (!Array.isArray(manifest.evidence?.machineScenarios)) {
    issues.push('character-acceptance-machine-scenarios-required');
  }
  if (!Array.isArray(manifest.requirementInventory?.records)) {
    issues.push('character-acceptance-requirement-inventory-required');
  }
  if (!Array.isArray(manifest.sourceGapInventory?.records)) {
    issues.push('character-acceptance-source-gap-inventory-required');
  }
  if (!Array.isArray(manifest.scenarioCases?.records)) {
    issues.push('character-acceptance-scenario-cases-required');
  }
  if (!Array.isArray(manifest.coverage?.edges)) {
    issues.push('character-acceptance-coverage-edges-required');
  }
  if (!Array.isArray(manifest.matrix?.requirements)) {
    issues.push('character-acceptance-matrix-requirements-required');
  }
  if (!Array.isArray(manifest.ledger?.records)) {
    issues.push('character-acceptance-ledger-records-required');
  }
  if (!Array.isArray(manifest.notApplicableRecords)) {
    issues.push('character-acceptance-not-applicable-records-required');
  }

  collectDuplicateIdentityIssue(
    issues,
    manifest.matrix?.requirements,
    'requirementIdentity',
    'character-acceptance-requirement-identity-duplicate'
  );
  collectDuplicateIdentityIssue(
    issues,
    manifest.ledger?.records,
    'recordIdentity',
    'character-acceptance-ledger-identity-duplicate'
  );
  collectDuplicateIdentityIssue(
    issues,
    manifest.notApplicableRecords,
    'recordIdentity',
    'character-acceptance-not-applicable-identity-duplicate'
  );

  for (const record of manifest.ledger?.records ?? []) {
    if (!CHARACTER_ACCEPTANCE_LEDGER_STATUSES.includes(record?.status)) {
      issues.push(
        `character-acceptance-ledger-status-invalid:${record?.recordIdentity}`
      );
    }
    if (record?.blocking !== true) {
      issues.push(
        `character-acceptance-ledger-record-must-block:${record?.recordIdentity}`
      );
    }
    if (record?.reason === UNNAMED_SECONDARY_PASSIVE_REASON) {
      issues.push(
        `character-acceptance-unnamed-passive-must-be-not-applicable:${record?.recordIdentity}`
      );
    }
  }
  for (const record of manifest.notApplicableRecords ?? []) {
    if (record?.status !== 'not-applicable') {
      issues.push(
        `character-acceptance-not-applicable-status-invalid:${record?.recordIdentity}`
      );
    }
  }

  const expectedArtifacts = deriveManifestArtifacts(manifest);
  if (
    canonical(pickDerivedArtifacts(manifest)) !== canonical(expectedArtifacts)
  ) {
    issues.push('character-acceptance-derived-artifacts-mismatch');
  }
  if (manifest.derivation?.status !== 'derived-artifacts-verified') {
    issues.push('character-acceptance-derived-artifacts-mismatch');
  }

  const productVisual = manifest.evidence?.productVisualAcceptance ?? {};
  const scenarioByIdentity = new Map(
    (manifest.evidence?.machineScenarios ?? []).map(scenario => [
      scenario?.scenarioIdentity,
      scenario,
    ])
  );
  const visualScenarioIdentities = new Set(
    productVisual.scenarioIdentities ?? []
  );
  if (
    productVisual.status === 'accepted' &&
    visualScenarioIdentities.size === 0
  ) {
    issues.push('character-acceptance-visual-scenario-set-empty');
  }
  const visualEvidenceCounts = new Map();
  for (const evidence of productVisual.automatedEvidence ?? []) {
    const identity = evidence?.scenarioIdentity;
    visualEvidenceCounts.set(
      identity,
      (visualEvidenceCounts.get(identity) ?? 0) + 1
    );
  }
  for (const scenarioIdentity of visualScenarioIdentities) {
    if (!scenarioByIdentity.has(scenarioIdentity)) {
      issues.push(
        'character-acceptance-visual-scenario-unknown:' +
          String(scenarioIdentity ?? '')
      );
    }
    if ((visualEvidenceCounts.get(scenarioIdentity) ?? 0) === 0) {
      issues.push(
        'character-acceptance-visual-evidence-missing:' +
          String(scenarioIdentity ?? '')
      );
    }
    if ((visualEvidenceCounts.get(scenarioIdentity) ?? 0) > 1) {
      issues.push(
        'character-acceptance-visual-evidence-duplicate:' +
          String(scenarioIdentity ?? '')
      );
    }
  }
  for (const evidence of productVisual.automatedEvidence ?? []) {
    const scenarioIdentity = evidence?.scenarioIdentity;
    const scenario = scenarioByIdentity.get(scenarioIdentity);
    if (!visualScenarioIdentities.has(scenarioIdentity)) {
      issues.push(
        'character-acceptance-visual-evidence-scenario-not-declared:' +
          String(scenarioIdentity ?? '')
      );
    }
    if (!scenario) {
      issues.push(
        'character-acceptance-visual-evidence-scenario-unknown:' +
          String(scenarioIdentity ?? '')
      );
    }
    const evidenceKind =
      evidence?.evidenceKind ??
      (evidence?.screenshotPath
        ? PRODUCT_VISUAL_SCREENSHOT_EVIDENCE_KIND
        : null);
    if (evidenceKind !== PRODUCT_VISUAL_SCREENSHOT_EVIDENCE_KIND) {
      issues.push(
        'character-acceptance-visual-evidence-kind-invalid:' +
          String(scenarioIdentity ?? '')
      );
    }
    if (evidence?.status !== 'automated-workbench-import-passed') {
      issues.push(
        'character-acceptance-visual-evidence-status-invalid:' +
          String(scenarioIdentity ?? '')
      );
    }
    if (!evidence?.screenshotPath) {
      issues.push(
        'character-acceptance-visual-evidence-path-missing:' +
          String(scenarioIdentity ?? '')
      );
    }
    if (!/^[0-9a-f]{64}$/.test(String(evidence?.screenshotSha256 ?? ''))) {
      issues.push(
        'character-acceptance-visual-evidence-hash-invalid:' +
          String(scenarioIdentity ?? '')
      );
    }
    if (evidence?.traceSha256 != null) {
      issues.push(
        'character-acceptance-visual-evidence-trace-hash-forbidden:' +
          String(scenarioIdentity ?? '')
      );
    }
    const fixtureBindingProvided =
      evidence?.fixturePath != null || evidence?.fixtureSha256 != null;
    if (
      fixtureBindingProvided &&
      (evidence?.fixturePath !== scenario?.fixturePath ||
        !/^[0-9a-f]{64}$/.test(String(evidence?.fixtureSha256 ?? '')))
    ) {
      issues.push(
        'character-acceptance-visual-evidence-fixture-binding-invalid:' +
          String(scenarioIdentity ?? '')
      );
    }
    if (
      evidence?.canonicalTraceHash != null &&
      evidence.canonicalTraceHash !== scenario?.canonicalHashes?.trace
    ) {
      issues.push(
        'character-acceptance-visual-evidence-trace-binding-invalid:' +
          String(scenarioIdentity ?? '')
      );
    }
  }
  for (const evidence of manifest.evidence?.machineEvidence ?? []) {
    const scenarioIdentity = evidence?.scenarioIdentity;
    const scenario = scenarioByIdentity.get(scenarioIdentity);
    if (!scenario) {
      issues.push(
        'character-acceptance-machine-evidence-scenario-unknown:' +
          String(scenarioIdentity ?? '')
      );
    }
    if (evidence?.evidenceKind !== MACHINE_TRACE_EVIDENCE_KIND) {
      issues.push(
        'character-acceptance-machine-evidence-kind-invalid:' +
          String(scenarioIdentity ?? '')
      );
    }
    if (evidence?.status !== 'automated-machine-axis-passed') {
      issues.push(
        'character-acceptance-machine-evidence-status-invalid:' +
          String(scenarioIdentity ?? '')
      );
    }
    if (
      evidence?.canonicalTraceHash !== scenario?.canonicalHashes?.trace ||
      !/^[0-9a-f]{64}$/.test(String(evidence?.traceSha256 ?? ''))
    ) {
      issues.push(
        'character-acceptance-machine-evidence-trace-binding-invalid:' +
          String(scenarioIdentity ?? '')
      );
    }
  }
  if (
    productVisual.status === 'accepted' &&
    productVisual.bindingStatus !== 'verified'
  ) {
    issues.push('character-acceptance-product-record-binding-invalid');
  }

  const expectedMaturity = deriveCharacterAcceptanceMaturity(
    collectCharacterAcceptanceFacts(manifest)
  );
  if (canonical(expectedMaturity) !== canonical(manifest.maturity)) {
    issues.push('character-acceptance-maturity-not-derived');
  }
  if (
    manifest.maturity?.optimizationReady === true &&
    manifest.maturity?.currentState !== 'optimization-ready'
  ) {
    issues.push('character-acceptance-optimization-ready-state-invalid');
  }
  const expectedQualificationSubjectHash = hashCanonicalValue(
    createQualificationSubject(manifest)
  );
  if (manifest.qualificationSubjectHash !== expectedQualificationSubjectHash) {
    issues.push('character-acceptance-qualification-subject-hash-mismatch');
  }
  if (checkPublication) {
    const indexValidation = validateCharacterAcceptanceManifestIndex(
      publishedManifestIndex
    );
    for (const issue of indexValidation.issues) {
      issues.push('character-acceptance-publication-index-invalid:' + issue);
    }
    const publishedEntry = (publishedManifestIndex?.entries ?? []).find(
      entry => Number(entry?.ownerId) === Number(manifest.owner?.ownerId)
    );
    if (!publishedEntry) {
      issues.push('character-acceptance-publication-index-entry-missing');
    } else if (
      publishedEntry.manifestHash !== manifest.manifestHash ||
      publishedEntry.qualificationSubjectHash !==
        manifest.qualificationSubjectHash ||
      publishedEntry.sourceOfTruthHash !==
        manifest.derivation?.sourceOfTruthHash ||
      publishedEntry.requirementInventoryHash !==
        manifest.requirementInventory?.inventoryHash ||
      publishedEntry.scenarioSetHash !==
        manifest.scenarioCases?.scenarioSetHash ||
      publishedEntry.profileHash !== manifest.source?.profileHash
    ) {
      issues.push('character-acceptance-publication-index-mismatch');
    }
  }
  if (checkHash) {
    const expectedHash = hashCanonicalValue(withoutManifestHash(manifest));
    if (manifest.manifestHash !== expectedHash) {
      issues.push('character-acceptance-manifest-hash-mismatch');
    }
  }
  return issues;
}

function deriveManifestArtifacts(manifest) {
  return deriveCharacterAcceptanceArtifacts({
    requirementInventory: manifest.requirementInventory ?? { records: [] },
    sourceGapInventory: manifest.sourceGapInventory ?? { records: [] },
    scenarioCases: manifest.scenarioCases ?? { records: [] },
    denominator:
      manifest.coverageContext?.denominator ??
      manifest.coverage?.denominator ??
      {},
    runtimeCoverageSummary:
      manifest.coverageContext?.runtimeCoverageSummary ??
      manifest.coverage?.runtimeCoverageSummary ??
      {},
  });
}

function pickDerivedArtifacts(manifest) {
  return {
    requirementInventory: manifest.requirementInventory,
    sourceGapInventory: manifest.sourceGapInventory,
    scenarioCases: manifest.scenarioCases,
    coverage: manifest.coverage,
    matrix: manifest.matrix,
    ledger: manifest.ledger,
    notApplicableRecords: manifest.notApplicableRecords,
  };
}

function hasProvidedDerivedArtifacts(manifest) {
  return ['coverage', 'matrix', 'ledger', 'notApplicableRecords'].some(
    key => manifest[key] != null
  );
}

function createQualificationSubject(manifest) {
  return {
    schemaVersion: manifest.schemaVersion,
    contractName: manifest.contractName,
    protocolIdentity: manifest.protocolIdentity,
    owner: manifest.owner,
    source: manifest.source,
    coverageContext: manifest.coverageContext,
    canonicalGoldens: manifest.evidence?.canonicalGoldens ?? [],
    machineScenarios: manifest.evidence?.machineScenarios ?? [],
    requirementInventory: manifest.requirementInventory,
    sourceGapInventory: manifest.sourceGapInventory,
    scenarioCases: manifest.scenarioCases,
    coverage: manifest.coverage,
    matrix: manifest.matrix,
    ledger: manifest.ledger,
    notApplicableRecords: manifest.notApplicableRecords,
  };
}

function deriveProductVisualAcceptance({
  productVisualAcceptance,
  ownerId,
  qualificationSubjectHash,
  scenarioCases,
  signoffRecordVerified = false,
  signoffRecordAuthentication = null,
}) {
  const automatedEvidence = structuredClone(
    productVisualAcceptance.automatedEvidence ?? []
  ).map(evidence => ({
    ...evidence,
    evidenceKind:
      evidence?.evidenceKind ??
      (evidence?.screenshotPath
        ? PRODUCT_VISUAL_SCREENSHOT_EVIDENCE_KIND
        : null),
  }));
  const scenarioIdentities = [
    ...new Set(
      (
        productVisualAcceptance.scenarioIdentities ??
        automatedEvidence.map(evidence => evidence?.scenarioIdentity)
      ).filter(Boolean)
    ),
  ].sort();
  const scenarioSetHash = hashCanonicalValue(
    scenarioIdentities.map(scenarioIdentity => {
      const scenario = (scenarioCases?.records ?? []).find(
        record => record.scenarioIdentity === scenarioIdentity
      );
      return {
        scenarioIdentity,
        scenarioCaseHash: scenario?.scenarioCaseHash ?? null,
      };
    })
  );
  const acceptanceCommit = productVisualAcceptance.acceptanceCommit ?? null;
  const expectedRecordIdentity =
    'character-product-acceptance:' +
    Number(ownerId) +
    ':' +
    String(acceptanceCommit ?? '') +
    ':' +
    qualificationSubjectHash;
  const accepted = productVisualAcceptance.status === 'accepted';
  // signoff record 认证（P1-1 修复）：accepted 且 binding 判定要求
  // acceptanceCommit 指向的 git 对象确实包含不可变 signoff record，且
  // record 内容（subject/package/harness hash/截图 SHA）与当前派生一致。
  // signoffRecordVerified 由调用方（生成器）用 git show 读取并认证。
  const bindingVerified =
    accepted &&
    signoffRecordVerified === true &&
    /^[0-9a-f]{40}$/.test(String(acceptanceCommit ?? '')) &&
    productVisualAcceptance.recordIdentity === expectedRecordIdentity &&
    productVisualAcceptance.qualificationSubjectHash ===
      qualificationSubjectHash &&
    productVisualAcceptance.scenarioSetHash === scenarioSetHash &&
    canonical(productVisualAcceptance.scenarioIdentities ?? []) ===
      canonical(scenarioIdentities);
  return {
    status: productVisualAcceptance.status ?? 'pending',
    scenarioIdentities,
    acceptanceCommit,
    recordIdentity: productVisualAcceptance.recordIdentity ?? null,
    qualificationSubjectHash:
      productVisualAcceptance.qualificationSubjectHash ?? null,
    scenarioSetHash: productVisualAcceptance.scenarioSetHash ?? null,
    signoffRecordAuthentication:
      accepted && signoffRecordAuthentication != null
        ? structuredClone(signoffRecordAuthentication)
        : null,
    bindingStatus: accepted
      ? bindingVerified
        ? 'verified'
        : 'invalid'
      : 'not-requested',
    bindingExpectation: {
      recordIdentity: expectedRecordIdentity,
      qualificationSubjectHash,
      scenarioSetHash,
      scenarioIdentities,
    },
    automatedEvidence,
  };
}

function hasCompleteProductVisualScreenshotCoverage(productVisual) {
  const scenarioIdentities = productVisual?.scenarioIdentities ?? [];
  const uniqueScenarioIdentities = new Set(scenarioIdentities);
  const automatedEvidence = productVisual?.automatedEvidence ?? [];
  if (
    scenarioIdentities.length === 0 ||
    uniqueScenarioIdentities.size !== scenarioIdentities.length ||
    automatedEvidence.length !== scenarioIdentities.length
  ) {
    return false;
  }
  return scenarioIdentities.every(scenarioIdentity => {
    const matchingEvidence = automatedEvidence.filter(
      evidence => evidence?.scenarioIdentity === scenarioIdentity
    );
    if (matchingEvidence.length !== 1) return false;
    const evidence = matchingEvidence[0];
    return (
      evidence?.evidenceKind === PRODUCT_VISUAL_SCREENSHOT_EVIDENCE_KIND &&
      evidence?.status === 'automated-workbench-import-passed' &&
      Boolean(evidence?.screenshotPath) &&
      /^[0-9a-f]{64}$/.test(String(evidence?.screenshotSha256 ?? '')) &&
      evidence?.traceSha256 == null
    );
  });
}

function collectDuplicateIdentityIssue(
  issues,
  rows = [],
  identityKey,
  issueCode
) {
  const seen = new Set();
  for (const row of rows ?? []) {
    const identity = String(row?.[identityKey] ?? '');
    if (!identity || seen.has(identity))
      issues.push(`${issueCode}:${identity}`);
    seen.add(identity);
  }
}

function withoutManifestHash(value) {
  const copy = structuredClone(value);
  delete copy.manifestHash;
  return copy;
}

function canonical(value) {
  return JSON.stringify(value);
}
