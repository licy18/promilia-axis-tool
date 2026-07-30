import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization.js';

export const CHARACTER_ACCEPTANCE_SCHEMA_VERSION = 1;
export const CHARACTER_ACCEPTANCE_CONTRACT_NAME =
  'AzPrCharacterAcceptanceProtocol';
export const CHARACTER_ACCEPTANCE_PROTOCOL_IDENTITY =
  'm11-d-character-acceptance-v1';

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

export function finalizeCharacterAcceptanceManifest(input) {
  const base = structuredClone(input ?? {});
  delete base.maturity;
  delete base.validation;
  delete base.manifestHash;
  const maturity = deriveCharacterAcceptanceMaturity(
    collectCharacterAcceptanceFacts(base)
  );
  const draft = { ...base, maturity };
  const issues = collectCharacterAcceptanceManifestIssues(draft, {
    checkHash: false,
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
    manifest.evidence?.productVisualAcceptance?.status === 'accepted';
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

export function validateCharacterAcceptanceManifest(manifest) {
  const issues = collectCharacterAcceptanceManifestIssues(manifest, {
    checkHash: true,
  });
  return {
    valid: issues.length === 0,
    issues,
    derivedMaturity: deriveCharacterAcceptanceMaturity(
      collectCharacterAcceptanceFacts(manifest)
    ),
  };
}

export function assertCharacterOptimizationReady(manifest) {
  const validation = validateCharacterAcceptanceManifest(manifest);
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

export class CharacterAcceptanceError extends Error {
  constructor(code, details = []) {
    super(code);
    this.name = 'CharacterAcceptanceError';
    this.code = code;
    this.details = structuredClone(details);
  }
}

function collectCharacterAcceptanceManifestIssues(manifest, { checkHash }) {
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

  const productVisual = manifest.evidence?.productVisualAcceptance ?? {};
  const scenarioIdentities = new Set(
    (manifest.evidence?.machineScenarios ?? []).map(
      scenario => scenario?.scenarioIdentity
    )
  );
  const automatedScenarioIdentities = new Set(
    (productVisual.automatedEvidence ?? []).map(
      evidence => evidence?.scenarioIdentity
    )
  );
  for (const scenarioIdentity of scenarioIdentities) {
    if (!automatedScenarioIdentities.has(scenarioIdentity)) {
      issues.push(
        'character-acceptance-visual-evidence-missing:' +
          String(scenarioIdentity ?? '')
      );
    }
  }
  for (const evidence of productVisual.automatedEvidence ?? []) {
    if (!scenarioIdentities.has(evidence?.scenarioIdentity)) {
      issues.push(
        'character-acceptance-visual-evidence-scenario-unknown:' +
          String(evidence?.scenarioIdentity ?? '')
      );
    }
    if (!/^[0-9a-f]{64}$/.test(String(evidence?.screenshotSha256 ?? ''))) {
      issues.push(
        'character-acceptance-visual-evidence-hash-invalid:' +
          String(evidence?.scenarioIdentity ?? '')
      );
    }
  }
  if (productVisual.status === 'accepted') {
    if (!String(productVisual.acceptanceCommit ?? '').trim()) {
      issues.push('character-acceptance-product-commit-required');
    }
    if (!String(productVisual.recordIdentity ?? '').trim()) {
      issues.push('character-acceptance-product-record-required');
    }
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
  if (checkHash) {
    const expectedHash = hashCanonicalValue(withoutManifestHash(manifest));
    if (manifest.manifestHash !== expectedHash) {
      issues.push('character-acceptance-manifest-hash-mismatch');
    }
  }
  return issues;
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
    if (!identity || seen.has(identity)) issues.push(`${issueCode}:${identity}`);
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
