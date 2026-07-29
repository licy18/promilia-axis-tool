export const COMBAT_CRITICAL_SCENARIO_SCHEMA_VERSION = 1;
export const COMBAT_CRITICAL_SCENARIO_CONTRACT = 'AzPrCombatCriticalScenario';

export const COMBAT_CRITICAL_POLICIES = Object.freeze({
  SAMPLED: 'sampled',
  EXPECTED: 'expected',
  CRITICAL: 'critical',
  NON_CRITICAL: 'non-critical',
});

export const ACTION_HIT_CRITICAL_POLICIES = Object.freeze({
  INHERIT: 'inherit',
  ...COMBAT_CRITICAL_POLICIES,
});

export const DEFAULT_COMBAT_CRITICAL_POLICY =
  COMBAT_CRITICAL_POLICIES.NON_CRITICAL;
export const CRITICAL_RANDOM_ALGORITHM = 'seeded-xorshift32-stream-v1';

const SCENARIO_POLICIES = new Set(Object.values(COMBAT_CRITICAL_POLICIES));
const HIT_POLICIES = new Set(Object.values(ACTION_HIT_CRITICAL_POLICIES));

export function normalizeCombatCriticalScenario(value = null) {
  const policy = normalizeCombatCriticalPolicy(value?.policy);
  return {
    schemaVersion: COMBAT_CRITICAL_SCENARIO_SCHEMA_VERSION,
    contractName: COMBAT_CRITICAL_SCENARIO_CONTRACT,
    policy,
    seed: normalizeCriticalSeed(value?.seed),
    randomAlgorithm:
      normalizeText(value?.randomAlgorithm) ?? CRITICAL_RANDOM_ALGORITHM,
  };
}

export function normalizeCombatCriticalPolicy(value) {
  const policy = normalizeText(value);
  return SCENARIO_POLICIES.has(policy)
    ? policy
    : DEFAULT_COMBAT_CRITICAL_POLICY;
}

export function normalizeActionHitCriticalPolicy(value) {
  const policy = normalizeText(value);
  return HIT_POLICIES.has(policy)
    ? policy
    : ACTION_HIT_CRITICAL_POLICIES.INHERIT;
}

export function resolveActionHitCriticalPolicy(
  action,
  hitIdentity,
  scenarioPolicy = DEFAULT_COMBAT_CRITICAL_POLICY
) {
  const identity = normalizeText(hitIdentity);
  const override = identity ? action?.hitOverrides?.[identity] : null;
  const overridePolicy = normalizeActionHitCriticalPolicy(
    override?.criticalPolicy
  );
  return overridePolicy === ACTION_HIT_CRITICAL_POLICIES.INHERIT
    ? normalizeCombatCriticalPolicy(scenarioPolicy)
    : overridePolicy;
}

export function normalizeCriticalSeed(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  const text = normalizeText(value);
  return text;
}

export function validateCombatCriticalScenario(value = null) {
  const normalized = normalizeCombatCriticalScenario(value);
  const issues = [];
  if (value != null && (typeof value !== 'object' || Array.isArray(value))) {
    issues.push({
      code: 'critical-contract-invalid',
      field: 'combatScenario.critical',
      message: 'critical contract must be an object',
    });
  }
  const rawPolicy = normalizeText(value?.policy);
  if (rawPolicy && !SCENARIO_POLICIES.has(rawPolicy)) {
    issues.push({
      code: 'critical-policy-unsupported',
      field: 'combatScenario.critical.policy',
      message: `unsupported critical policy: ${rawPolicy}`,
    });
  }
  if (
    value?.schemaVersion != null &&
    Number(value.schemaVersion) !== COMBAT_CRITICAL_SCENARIO_SCHEMA_VERSION
  ) {
    issues.push({
      code: 'critical-schema-version-unsupported',
      field: 'combatScenario.critical.schemaVersion',
      message: `unsupported critical schema version: ${value.schemaVersion}`,
    });
  }
  const contractName = normalizeText(value?.contractName);
  if (contractName && contractName !== COMBAT_CRITICAL_SCENARIO_CONTRACT) {
    issues.push({
      code: 'critical-contract-name-unsupported',
      field: 'combatScenario.critical.contractName',
      message: `unsupported critical contract: ${contractName}`,
    });
  }
  const randomAlgorithm = normalizeText(value?.randomAlgorithm);
  if (randomAlgorithm && randomAlgorithm !== CRITICAL_RANDOM_ALGORITHM) {
    issues.push({
      code: 'critical-random-algorithm-unsupported',
      field: 'combatScenario.critical.randomAlgorithm',
      message: `unsupported critical random algorithm: ${randomAlgorithm}`,
    });
  }
  if (
    normalized.policy === COMBAT_CRITICAL_POLICIES.SAMPLED &&
    normalized.seed == null
  ) {
    issues.push({
      code: 'critical-sampled-seed-required',
      field: 'combatScenario.critical.seed',
      message: 'sampled critical policy requires an explicit seed',
    });
  }
  return {
    valid: issues.length === 0,
    normalized,
    issues,
  };
}

function normalizeText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}
