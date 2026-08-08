import generatedPolicy from '../data/generated/optimization-scenario-policy.json' with { type: 'json' };
import {
  MACHINE_AXIS_DEFAULT_PRIMARY_OBJECTIVE,
  getMachineAxisObjectiveContract,
  validateMachineAxisObjectivePolicy,
} from '../machine-axis/machineAxisObjectiveContract.js';
import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization.js';

export const OPTIMIZATION_SCENARIO_POLICY_SCHEMA_VERSION = 1;
export const OPTIMIZATION_SCENARIO_POLICY_CONTRACT_NAME =
  'AzPrOptimizationScenarioPolicy';
export const OPTIMIZATION_SCENARIO_POLICY_REASON =
  'm12c-zero-distance-passive-boss-out-of-scope';
export const OPTIMIZATION_ROSTER_EXCLUSION_REASON =
  'm12c-no-in-scope-wind-or-thunder-mark-production';

const excludedActionKinds = new Set(
  generatedPolicy.optimizationSurface.excludedActionKinds
);
const formalOptimizationObjectIds = new Set(
  generatedPolicy.candidateRoster.formalOptimizationObjectIds.map(String)
);
const productScenarioExcludedCharacterIds = new Set(
  generatedPolicy.candidateRoster.productScenarioExcludedCharacters.map(item =>
    Number(item.characterId)
  )
);
const starbornSourceCharacterIds = new Set(
  generatedPolicy.candidateRoster.starborn.sourceCharacterIds.map(Number)
);

export function getOptimizationScenarioPolicy() {
  return generatedPolicy;
}

export function getOptimizationCandidateRosterPolicy() {
  return generatedPolicy.candidateRoster;
}

export function getOptimizationObjectivePolicy() {
  return generatedPolicy.objectivePolicy;
}

export function getOptimizationObjectiveContract(
  objectiveId = MACHINE_AXIS_DEFAULT_PRIMARY_OBJECTIVE
) {
  const contract =
    generatedPolicy.objectivePolicy?.objectivesById?.[objectiveId];
  return contract == null ? null : structuredClone(contract);
}

export function validateOptimizationScenarioPolicy(policy = generatedPolicy) {
  const copy = structuredClone(policy);
  const policyHash = copy.policyHash;
  delete copy.policyHash;
  const issues = [];
  const rosterCopy = structuredClone(policy.candidateRoster);
  const rosterHash = rosterCopy?.rosterHash;
  delete rosterCopy?.rosterHash;
  if (policy.schemaVersion !== OPTIMIZATION_SCENARIO_POLICY_SCHEMA_VERSION) {
    issues.push('optimization-scenario-policy-schema-version-invalid');
  }
  if (policy.contractName !== OPTIMIZATION_SCENARIO_POLICY_CONTRACT_NAME) {
    issues.push('optimization-scenario-policy-contract-name-invalid');
  }
  if (policy.reason !== OPTIMIZATION_SCENARIO_POLICY_REASON) {
    issues.push('optimization-scenario-policy-reason-invalid');
  }
  const objectivePolicyValidation = validateMachineAxisObjectivePolicy(
    policy.objectivePolicy
  );
  if (!objectivePolicyValidation.valid) {
    issues.push(
      ...objectivePolicyValidation.issues.map(
        issue => `optimization-scenario-${issue.code}`
      )
    );
  }
  const defaultObjective = getMachineAxisObjectiveContract(
    MACHINE_AXIS_DEFAULT_PRIMARY_OBJECTIVE
  );
  if (
    hashCanonicalValue(policy.assumptions?.targetPolicy) !==
    hashCanonicalValue(defaultObjective?.targetPolicy)
  ) {
    issues.push('optimization-scenario-default-target-policy-mismatch');
  }
  if (rosterHash !== hashCanonicalValue(rosterCopy)) {
    issues.push('optimization-candidate-roster-hash-mismatch');
  }
  if (
    policy.candidateRoster?.formalOptimizationObjectIds?.length !==
    policy.candidateRoster?.formalDenominator
  ) {
    issues.push('optimization-candidate-roster-denominator-mismatch');
  }
  if (policyHash !== hashCanonicalValue(copy)) {
    issues.push('optimization-scenario-policy-hash-mismatch');
  }
  return { valid: issues.length === 0, issues };
}

export function createOptimizationScenarioPolicyBinding() {
  return {
    policyId: generatedPolicy.policyId,
    policyHash: generatedPolicy.policyHash,
    rosterPolicyId: generatedPolicy.candidateRoster.rosterPolicyId,
    rosterHash: generatedPolicy.candidateRoster.rosterHash,
  };
}

export function createOptimizationObjectivePolicyBinding() {
  return {
    policyId: generatedPolicy.objectivePolicy.policyId,
    objectivePolicyHash: generatedPolicy.objectivePolicy.objectivePolicyHash,
    defaultPrimaryObjectiveId:
      generatedPolicy.objectivePolicy.defaultPrimaryObjectiveId,
  };
}

export function validateOptimizationObjectivePolicyBinding(value) {
  const expected = createOptimizationObjectivePolicyBinding();
  const issueCodes = {
    policyId: 'optimization-objective-policy-id-mismatch',
    objectivePolicyHash: 'optimization-objective-policy-hash-mismatch',
    defaultPrimaryObjectiveId:
      'optimization-objective-policy-default-primary-objective-mismatch',
  };
  const actual = isRecord(value)
    ? {
        policyId: textOrNull(value.policyId),
        objectivePolicyHash: textOrNull(value.objectivePolicyHash),
        defaultPrimaryObjectiveId: textOrNull(value.defaultPrimaryObjectiveId),
      }
    : {
        policyId: null,
        objectivePolicyHash: null,
        defaultPrimaryObjectiveId: null,
      };
  const issues = [];
  for (const key of Object.keys(expected)) {
    if (actual[key] !== expected[key]) {
      issues.push({
        code: issueCodes[key],
        expected: expected[key],
        actual: actual[key],
      });
    }
  }
  if (
    !isRecord(value) ||
    Object.keys(value).sort().join('|') !==
      Object.keys(expected).sort().join('|')
  ) {
    issues.push({
      code: 'optimization-objective-policy-binding-shape-invalid',
      expected: Object.keys(expected).sort(),
      actual: isRecord(value) ? Object.keys(value).sort() : [],
    });
  }
  return { valid: issues.length === 0, issues, actual, expected };
}

export function normalizeOptimizationScenarioPolicyBinding(value = null) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    policyId: textOrNull(source.policyId),
    policyHash: textOrNull(source.policyHash),
    rosterPolicyId: textOrNull(source.rosterPolicyId),
    rosterHash: textOrNull(source.rosterHash),
  };
}

export function validateOptimizationScenarioPolicyBinding(value) {
  const normalized = normalizeOptimizationScenarioPolicyBinding(value);
  const expected = createOptimizationScenarioPolicyBinding();
  const issues = [];
  if (normalized.policyId !== expected.policyId) {
    issues.push({
      code: 'optimization-scenario-policy-id-mismatch',
      expected: expected.policyId,
      actual: normalized.policyId,
    });
  }
  if (normalized.policyHash !== expected.policyHash) {
    issues.push({
      code: 'optimization-scenario-policy-hash-mismatch',
      expected: expected.policyHash,
      actual: normalized.policyHash,
    });
  }
  if (normalized.rosterPolicyId !== expected.rosterPolicyId) {
    issues.push({
      code: 'optimization-candidate-roster-policy-id-mismatch',
      expected: expected.rosterPolicyId,
      actual: normalized.rosterPolicyId,
    });
  }
  if (normalized.rosterHash !== expected.rosterHash) {
    issues.push({
      code: 'optimization-candidate-roster-hash-mismatch',
      expected: expected.rosterHash,
      actual: normalized.rosterHash,
    });
  }
  return { valid: issues.length === 0, issues, normalized, expected };
}

export function isOptimizationScenarioActionKindInScope(actionKind) {
  return !excludedActionKinds.has(String(actionKind ?? ''));
}

export function isOptimizationCandidateRosterObjectInScope(ownerId) {
  return formalOptimizationObjectIds.has(String(ownerId));
}

export function isOptimizationCandidateCharacterInScope(characterId) {
  return (
    isOptimizationCandidateRosterObjectInScope(Number(characterId)) ||
    (formalOptimizationObjectIds.has('STARBORN') &&
      starbornSourceCharacterIds.has(Number(characterId)))
  );
}

export function classifyOptimizationCandidateCharacter(characterId) {
  const normalizedCharacterId = Number(characterId);
  const inScope = isOptimizationCandidateCharacterInScope(
    normalizedCharacterId
  );
  return {
    rosterPolicyId: generatedPolicy.candidateRoster.rosterPolicyId,
    rosterHash: generatedPolicy.candidateRoster.rosterHash,
    characterId: normalizedCharacterId,
    disposition: inScope
      ? 'formal-optimization-roster-included'
      : productScenarioExcludedCharacterIds.has(normalizedCharacterId)
        ? 'product-scenario-excluded'
        : 'not-in-formal-optimization-roster',
    reason: inScope
      ? null
      : productScenarioExcludedCharacterIds.has(normalizedCharacterId)
        ? OPTIMIZATION_ROSTER_EXCLUSION_REASON
        : 'm12c-character-not-in-frozen-formal-roster',
  };
}

export function classifyOptimizationScenarioActionKind(actionKind) {
  const normalizedActionKind = textOrNull(actionKind);
  const inScope = isOptimizationScenarioActionKindInScope(normalizedActionKind);
  return {
    policyId: generatedPolicy.policyId,
    policyHash: generatedPolicy.policyHash,
    actionKind: normalizedActionKind,
    disposition: inScope ? 'optimization-in-scope' : 'scenario-out-of-scope',
    reason: inScope ? null : generatedPolicy.reason,
  };
}

export function createOptimizationScenarioRequirementClassifier(profile) {
  const publicActions = profile?.contracts?.publicActions ?? [];
  const excludedActions = publicActions.filter(action =>
    excludedActionKinds.has(String(action.actionKind ?? ''))
  );
  const includedActions = publicActions.filter(
    action => !excludedActionKinds.has(String(action.actionKind ?? ''))
  );
  const excludedActionIdentities = new Set(
    excludedActions.map(action => String(action.identity))
  );
  const includedActionIdentities = new Set(
    includedActions.map(action => String(action.identity))
  );
  const excludedControls = collectActionControlIds(excludedActions);
  const includedControls = collectActionControlIds(includedActions);
  const exclusivelyExcludedControls = new Set(
    [...excludedControls].filter(controlId => !includedControls.has(controlId))
  );

  return function classify(record = {}) {
    const actionRefs = Array.isArray(record.publicActions)
      ? record.publicActions
      : [];
    const actionKinds = uniqueStrings(
      actionRefs.map(action => action.actionKind).filter(Boolean)
    );
    const actionIdentities = uniqueStrings(
      actionRefs.map(action => action.actionIdentity).filter(Boolean)
    );
    const explicitActionKind =
      record.actionKind ?? record.publicActionKind ?? null;
    if (explicitActionKind) actionKinds.push(String(explicitActionKind));
    const recordIdentity =
      record.identity ?? record.publicActionIdentity ?? null;
    if (recordIdentity) actionIdentities.push(String(recordIdentity));
    const controlIds = uniqueIntegers([
      record.executionControlSkillId,
      record.controlSkillId,
      record.sourceControlSkillId,
      record.publicControlSkillId,
      ...collectIdentityControlIds(record),
    ]);
    const hasIncludedAction =
      actionKinds.some(kind => !excludedActionKinds.has(kind)) ||
      actionIdentities.some(identity => includedActionIdentities.has(identity));
    const excludedKinds = uniqueStrings(
      actionKinds.filter(kind => excludedActionKinds.has(kind))
    );
    const excludedIdentityMatch = actionIdentities.some(identity =>
      excludedActionIdentities.has(identity)
    );
    const excludedControlMatches = controlIds.filter(controlId =>
      exclusivelyExcludedControls.has(controlId)
    );
    const outOfScope =
      !hasIncludedAction &&
      (excludedKinds.length > 0 ||
        excludedIdentityMatch ||
        excludedControlMatches.length > 0);
    return outOfScope
      ? {
          policyId: generatedPolicy.policyId,
          policyHash: generatedPolicy.policyHash,
          disposition: 'scenario-out-of-scope',
          reason: generatedPolicy.reason,
          actionKinds: excludedKinds,
          actionIdentities,
          controlSkillIds: excludedControlMatches,
        }
      : null;
  };
}

function collectActionControlIds(actions) {
  return new Set(
    actions
      .flatMap(action => [
        Number(action.controlSkillId),
        ...collectIdentityControlIds(action),
      ])
      .filter(Number.isInteger)
  );
}

function collectIdentityControlIds(value) {
  const identities = [
    ...(value.selectedHitIdentities ?? []),
    ...(value.selectedEffectIdentities ?? []),
    ...(value.rawEffectIdentities ?? []),
  ];
  return identities
    .map(identity => Number(String(identity).split('|')[0]))
    .filter(Number.isInteger);
}

function uniqueStrings(values) {
  return [...new Set(values.map(String))].sort();
}

function uniqueIntegers(values) {
  return [...new Set(values.map(Number).filter(Number.isInteger))].sort(
    (left, right) => left - right
  );
}

function textOrNull(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
