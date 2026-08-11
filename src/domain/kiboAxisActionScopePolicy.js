import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization.js';

export const KIBO_AXIS_ACTION_SCOPE_SCHEMA_VERSION = 1;
export const KIBO_AXIS_ACTION_SCOPE_CONTRACT = 'AzPrKiboAxisActionScopePolicy';
export const KIBO_AXIS_ACTION_SCOPE_POLICY_ID =
  'm12c-kibo-axis-action-scope-v1';
export const KIBO_AXIS_ACTION_SCOPE_POLICY_VERSION = '1.0.0';

export const KIBO_AXIS_INCLUDED_ACTION_KINDS = Object.freeze([
  'signature',
  'break',
]);
export const KIBO_AXIS_DEFERRED_AUTONOMOUS_ACTION_KINDS = Object.freeze([
  'normal-attack',
  'active',
]);
export const KIBO_RETAINED_CALCULATION_SURFACES = Object.freeze([
  'signature',
  'joint-attack',
  'passive',
]);

const includedKinds = new Set(KIBO_AXIS_INCLUDED_ACTION_KINDS);
const deferredKinds = new Set(KIBO_AXIS_DEFERRED_AUTONOMOUS_ACTION_KINDS);
const policyProjection = {
  schemaVersion: KIBO_AXIS_ACTION_SCOPE_SCHEMA_VERSION,
  contractName: KIBO_AXIS_ACTION_SCOPE_CONTRACT,
  policyId: KIBO_AXIS_ACTION_SCOPE_POLICY_ID,
  policyVersion: KIBO_AXIS_ACTION_SCOPE_POLICY_VERSION,
  disposition: 'product-deferred-autonomous-actions',
  includedAxisActionKinds: [...KIBO_AXIS_INCLUDED_ACTION_KINDS],
  deferredAutonomousActionKinds: [
    ...KIBO_AXIS_DEFERRED_AUTONOMOUS_ACTION_KINDS,
  ],
  retainedCalculationSurfaces: [...KIBO_RETAINED_CALCULATION_SURFACES],
  deferredCalculationStatus: 'not-generated-not-scheduled-not-scored',
  passiveCalculationStatus: 'verified-runtime-retained',
  reintroductionRequirement:
    'versioned-policy-change-and-closed-autonomous-runtime-authority',
};

export const KIBO_AXIS_ACTION_SCOPE_POLICY_HASH =
  hashCanonicalValue(policyProjection);

const policy = deepFreeze({
  ...policyProjection,
  policyHash: KIBO_AXIS_ACTION_SCOPE_POLICY_HASH,
});

export function getKiboAxisActionScopePolicy() {
  return policy;
}

export function createKiboAxisActionScopeBinding() {
  return Object.freeze({
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    policyHash: policy.policyHash,
  });
}

export function validateKiboAxisActionScopePolicy(value = policy) {
  const issues = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, issues: ['kibo-axis-action-scope-policy-missing'] };
  }
  if (value.schemaVersion !== KIBO_AXIS_ACTION_SCOPE_SCHEMA_VERSION) {
    issues.push('kibo-axis-action-scope-schema-version-invalid');
  }
  if (value.contractName !== KIBO_AXIS_ACTION_SCOPE_CONTRACT) {
    issues.push('kibo-axis-action-scope-contract-name-invalid');
  }
  if (value.policyId !== KIBO_AXIS_ACTION_SCOPE_POLICY_ID) {
    issues.push('kibo-axis-action-scope-policy-id-invalid');
  }
  if (value.policyVersion !== KIBO_AXIS_ACTION_SCOPE_POLICY_VERSION) {
    issues.push('kibo-axis-action-scope-policy-version-invalid');
  }
  if (value.disposition !== policyProjection.disposition) {
    issues.push('kibo-axis-action-scope-disposition-invalid');
  }
  if (
    !sameArray(value.includedAxisActionKinds, KIBO_AXIS_INCLUDED_ACTION_KINDS)
  ) {
    issues.push('kibo-axis-action-scope-included-kinds-invalid');
  }
  if (
    !sameArray(
      value.deferredAutonomousActionKinds,
      KIBO_AXIS_DEFERRED_AUTONOMOUS_ACTION_KINDS
    )
  ) {
    issues.push('kibo-axis-action-scope-deferred-kinds-invalid');
  }
  if (
    !sameArray(
      value.retainedCalculationSurfaces,
      KIBO_RETAINED_CALCULATION_SURFACES
    )
  ) {
    issues.push('kibo-axis-action-scope-retained-surfaces-invalid');
  }
  if (
    value.deferredCalculationStatus !==
    policyProjection.deferredCalculationStatus
  ) {
    issues.push('kibo-axis-action-scope-deferred-status-invalid');
  }
  if (
    value.passiveCalculationStatus !== policyProjection.passiveCalculationStatus
  ) {
    issues.push('kibo-axis-action-scope-passive-status-invalid');
  }
  if (
    value.reintroductionRequirement !==
    policyProjection.reintroductionRequirement
  ) {
    issues.push('kibo-axis-action-scope-reintroduction-requirement-invalid');
  }
  const copy = structuredClone(value);
  const policyHash = copy.policyHash;
  delete copy.policyHash;
  if (policyHash !== hashCanonicalValue(copy)) {
    issues.push('kibo-axis-action-scope-policy-hash-invalid');
  }
  return { valid: issues.length === 0, issues };
}

export function isKiboAxisActionKindIncluded(actionKind) {
  return includedKinds.has(String(actionKind ?? ''));
}

export function isKiboAutonomousActionKindDeferred(actionKind) {
  return deferredKinds.has(String(actionKind ?? ''));
}

export function classifyKiboAxisActionKind(actionKind) {
  const normalizedActionKind = String(actionKind ?? '');
  if (includedKinds.has(normalizedActionKind)) {
    return Object.freeze({
      ...createKiboAxisActionScopeBinding(),
      actionKind: normalizedActionKind,
      disposition: 'axis-and-optimization-included',
      calculationStatus: 'calculated',
    });
  }
  if (deferredKinds.has(normalizedActionKind)) {
    return Object.freeze({
      ...createKiboAxisActionScopeBinding(),
      actionKind: normalizedActionKind,
      disposition: 'product-deferred-autonomous-action',
      calculationStatus: policy.deferredCalculationStatus,
    });
  }
  return Object.freeze({
    ...createKiboAxisActionScopeBinding(),
    actionKind: normalizedActionKind || null,
    disposition: 'unsupported-kibo-action-kind',
    calculationStatus: 'rejected',
  });
}

function sameArray(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
