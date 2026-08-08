import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization';

export const MACHINE_AXIS_ENEMY_PROFILE_SCHEMA_VERSION = 1;
export const MACHINE_AXIS_ENEMY_PROFILE_CONTRACT_NAME = 'AzPrEnemyProfile';

const PROFILE_KEYS = new Set([
  'schemaVersion',
  'contractName',
  'profileId',
  'profileHash',
  'enemyId',
  'level',
  'source',
  'attributes',
  'breakRules',
]);
const SOURCE_KEYS = new Set(['status', 'kind', 'identity', 'hash']);
const ATTRIBUTE_KEYS = new Set([
  'maxHp',
  'physicalDefense',
  'magicalDefense',
  'maxToughness',
  'elementDefenses',
]);
const BREAK_RULE_KEYS = new Set([
  'recoveryDelayMs',
  'recoveryRateBasisPoints',
  'breakTimeMs',
  'breakEndTimeMs',
  'breakDamageUpBasisPoints',
  'weaknessDamageMaximum',
  'weaknessDamageMinimum',
  'typeMultipliersBasisPoints',
  'elementMultipliersBasisPoints',
]);
const ELEMENT_DEFENSE_KEYS = new Set([
  'NORMAL_DEFENSE',
  'FIRE_DEFENSE',
  'WIND_DEFENSE',
  'EARTH_DEFENSE',
  'WOOD_DEFENSE',
  'ICE_DEFENSE',
  'WATER_DEFENSE',
  'ELEC_DEFENSE',
  'LIGHT_DEFENSE',
  'DARK_DEFENSE',
]);

export function createMachineAxisEnemyProfile(value = {}) {
  const normalized = normalizeMachineAxisEnemyProfile(value);
  const source = { ...normalized };
  delete source.profileHash;
  return {
    ...source,
    profileHash: hashCanonicalValue(source),
  };
}

export function createMachineAxisEnemyProfileFromCompiledEnemy({
  enemy,
  breakProfile,
} = {}) {
  const levelScaling = enemy?.levelScaling;
  const levelStats = levelScaling?.stats;
  if (
    levelScaling?.status !== 'ready' ||
    breakProfile?.applied !== true ||
    Number(breakProfile.enemyId) !== Number(enemy?.enemyId)
  ) {
    return null;
  }
  const requiredNumbers = [
    enemy?.enemyId,
    enemy?.level,
    levelStats?.maxHp,
    levelStats?.physicalDefense,
    levelStats?.magicalDefense,
    levelStats?.maxToughness,
    breakProfile?.recoveryDelayMs,
    breakProfile?.recoveryRateBasisPoints,
    breakProfile?.breakTimeMs,
    breakProfile?.breakEndTimeMs,
    breakProfile?.breakDamageUpBasisPoints,
    breakProfile?.weaknessDamageMaximum,
    breakProfile?.weaknessDamageMinimum,
  ];
  if (requiredNumbers.some(value => !Number.isFinite(Number(value)))) {
    return null;
  }
  const elementDefenses = Object.fromEntries(
    (enemy?.elementDefenses ?? [])
      .filter(
        row =>
          ELEMENT_DEFENSE_KEYS.has(String(row?.attributeKey ?? '')) &&
          Number.isFinite(Number(row?.baseValue))
      )
      .map(row => [String(row.attributeKey), Number(row.baseValue)])
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
  );
  const sourceEvidence = {
    enemyId: Number(enemy.enemyId),
    level: Number(enemy.level),
    levelScalingSource: structuredClone(levelScaling.source),
    breakProfile: {
      sourceIdentity: String(breakProfile.sourceIdentity ?? ''),
      status: String(breakProfile.status ?? ''),
      enemyId: Number(breakProfile.enemyId),
    },
  };
  const sourceHash = hashCanonicalValue(sourceEvidence);
  return createMachineAxisEnemyProfile({
    profileId: `enemy:${Number(enemy.enemyId)}:level:${Number(enemy.level)}:${sourceHash}`,
    enemyId: Number(enemy.enemyId),
    level: Number(enemy.level),
    source: {
      status: 'authoritative-resolved',
      kind: 'enemy-level-and-break-profile-pipeline',
      identity: `${String(levelScaling.source?.profileId ?? '')}#level=${Number(enemy.level)}|${String(breakProfile.sourceIdentity ?? '')}`,
      hash: sourceHash,
    },
    attributes: {
      maxHp: Number(levelStats.maxHp),
      physicalDefense: Number(levelStats.physicalDefense),
      magicalDefense: Number(levelStats.magicalDefense),
      maxToughness: Number(levelStats.maxToughness),
      elementDefenses,
    },
    breakRules: {
      recoveryDelayMs: Number(breakProfile.recoveryDelayMs),
      recoveryRateBasisPoints: Number(
        breakProfile.recoveryRateBasisPoints
      ),
      breakTimeMs: Number(breakProfile.breakTimeMs),
      breakEndTimeMs: Number(breakProfile.breakEndTimeMs),
      breakDamageUpBasisPoints: Number(
        breakProfile.breakDamageUpBasisPoints
      ),
      weaknessDamageMaximum: Number(breakProfile.weaknessDamageMaximum),
      weaknessDamageMinimum: Number(breakProfile.weaknessDamageMinimum),
      typeMultipliersBasisPoints: structuredClone(
        breakProfile.typeMultipliersBasisPoints ?? {}
      ),
      elementMultipliersBasisPoints: structuredClone(
        breakProfile.elementMultipliersBasisPoints ?? {}
      ),
    },
  });
}

export function normalizeMachineAxisEnemyProfile(value = {}) {
  const source = isRecord(value) ? value : {};
  const provenance = isRecord(source.source) ? source.source : {};
  const attributes = isRecord(source.attributes) ? source.attributes : {};
  const breakRules = isRecord(source.breakRules) ? source.breakRules : {};
  return {
    schemaVersion:
      Number(source.schemaVersion) || MACHINE_AXIS_ENEMY_PROFILE_SCHEMA_VERSION,
    contractName:
      textOrNull(source.contractName) ??
      MACHINE_AXIS_ENEMY_PROFILE_CONTRACT_NAME,
    profileId: textOrNull(source.profileId),
    profileHash: textOrNull(source.profileHash),
    enemyId: positiveIntegerOrNull(source.enemyId),
    level: positiveIntegerOrNull(source.level),
    source: {
      status: textOrNull(provenance.status),
      kind: textOrNull(provenance.kind),
      identity: textOrNull(provenance.identity),
      hash: textOrNull(provenance.hash),
    },
    attributes: {
      maxHp: positiveNumberOrNull(attributes.maxHp),
      physicalDefense: nonNegativeNumberOrNull(attributes.physicalDefense),
      magicalDefense: nonNegativeNumberOrNull(attributes.magicalDefense),
      maxToughness: positiveNumberOrNull(attributes.maxToughness),
      elementDefenses: normalizeNumericRecord(attributes.elementDefenses),
    },
    breakRules: {
      recoveryDelayMs: nonNegativeNumberOrNull(breakRules.recoveryDelayMs),
      recoveryRateBasisPoints: nonNegativeNumberOrNull(
        breakRules.recoveryRateBasisPoints
      ),
      breakTimeMs: positiveNumberOrNull(breakRules.breakTimeMs),
      breakEndTimeMs: nonNegativeNumberOrNull(breakRules.breakEndTimeMs),
      breakDamageUpBasisPoints: nonNegativeNumberOrNull(
        breakRules.breakDamageUpBasisPoints
      ),
      weaknessDamageMaximum: finiteNumberOrNull(
        breakRules.weaknessDamageMaximum
      ),
      weaknessDamageMinimum: finiteNumberOrNull(
        breakRules.weaknessDamageMinimum
      ),
      typeMultipliersBasisPoints: normalizeNumericRecord(
        breakRules.typeMultipliersBasisPoints
      ),
      elementMultipliersBasisPoints: normalizeNumericRecord(
        breakRules.elementMultipliersBasisPoints
      ),
    },
  };
}

export function validateMachineAxisEnemyProfile(value, { scenarioEnemy } = {}) {
  const issues = [];
  if (!isRecord(value)) {
    return invalid([
      issue(
        'machine-axis-enemy-profile-object-required',
        'scenario.enemy.profile',
        'A structured enemy profile is required'
      ),
    ]);
  }
  rejectAdditionalKeys(value, PROFILE_KEYS, 'scenario.enemy.profile', issues);
  rejectAdditionalKeys(
    value.source,
    SOURCE_KEYS,
    'scenario.enemy.profile.source',
    issues
  );
  rejectAdditionalKeys(
    value.attributes,
    ATTRIBUTE_KEYS,
    'scenario.enemy.profile.attributes',
    issues
  );
  rejectAdditionalKeys(
    value.breakRules,
    BREAK_RULE_KEYS,
    'scenario.enemy.profile.breakRules',
    issues
  );
  requireExactKeys(value, PROFILE_KEYS, 'scenario.enemy.profile', issues);
  requireExactKeys(
    value.source,
    SOURCE_KEYS,
    'scenario.enemy.profile.source',
    issues
  );
  if (isRecord(value.attributes?.elementDefenses)) {
    for (const key of Object.keys(value.attributes.elementDefenses)) {
      if (!ELEMENT_DEFENSE_KEYS.has(key)) {
        issues.push(
          issue(
            'machine-axis-enemy-profile-element-defense-key-invalid',
            `scenario.enemy.profile.attributes.elementDefenses.${key}`,
            `Unsupported enemy element defense key: ${key}`
          )
        );
      }
    }
  }
  requireExactKeys(
    value.attributes,
    ATTRIBUTE_KEYS,
    'scenario.enemy.profile.attributes',
    issues
  );
  requireExactKeys(
    value.breakRules,
    BREAK_RULE_KEYS,
    'scenario.enemy.profile.breakRules',
    issues
  );
  const normalized = normalizeMachineAxisEnemyProfile(value);
  if (value.schemaVersion !== MACHINE_AXIS_ENEMY_PROFILE_SCHEMA_VERSION) {
    issues.push(
      issue(
        'machine-axis-enemy-profile-schema-version-unsupported',
        'scenario.enemy.profile.schemaVersion',
        `Unsupported enemy profile schema version: ${value.schemaVersion ?? 'missing'}`
      )
    );
  }
  if (value.contractName !== MACHINE_AXIS_ENEMY_PROFILE_CONTRACT_NAME) {
    issues.push(
      issue(
        'machine-axis-enemy-profile-contract-name-unsupported',
        'scenario.enemy.profile.contractName',
        `Unsupported enemy profile contract: ${value.contractName ?? 'missing'}`
      )
    );
  }
  for (const [path, fieldValue] of [
    ['profileId', normalized.profileId],
    ['profileHash', normalized.profileHash],
    ['source.status', normalized.source.status],
    ['source.kind', normalized.source.kind],
    ['source.identity', normalized.source.identity],
    ['source.hash', normalized.source.hash],
  ]) {
    if (!fieldValue) {
      issues.push(
        issue(
          'machine-axis-enemy-profile-identity-required',
          `scenario.enemy.profile.${path}`,
          `Enemy profile ${path} is required`
        )
      );
    }
  }
  for (const [path, fieldValue] of [
    ['enemyId', normalized.enemyId],
    ['level', normalized.level],
    ['attributes.maxHp', normalized.attributes.maxHp],
    ['attributes.physicalDefense', normalized.attributes.physicalDefense],
    ['attributes.magicalDefense', normalized.attributes.magicalDefense],
    ['attributes.maxToughness', normalized.attributes.maxToughness],
    ['breakRules.recoveryDelayMs', normalized.breakRules.recoveryDelayMs],
    [
      'breakRules.recoveryRateBasisPoints',
      normalized.breakRules.recoveryRateBasisPoints,
    ],
    ['breakRules.breakTimeMs', normalized.breakRules.breakTimeMs],
    ['breakRules.breakEndTimeMs', normalized.breakRules.breakEndTimeMs],
    [
      'breakRules.breakDamageUpBasisPoints',
      normalized.breakRules.breakDamageUpBasisPoints,
    ],
    [
      'breakRules.weaknessDamageMaximum',
      normalized.breakRules.weaknessDamageMaximum,
    ],
    [
      'breakRules.weaknessDamageMinimum',
      normalized.breakRules.weaknessDamageMinimum,
    ],
  ]) {
    if (fieldValue == null) {
      issues.push(
        issue(
          'machine-axis-enemy-profile-attribute-required',
          `scenario.enemy.profile.${path}`,
          `Resolved enemy profile ${path} is required`
        )
      );
    }
  }
  for (const [path, fieldValue] of [
    ['attributes.elementDefenses', normalized.attributes.elementDefenses],
    [
      'breakRules.typeMultipliersBasisPoints',
      normalized.breakRules.typeMultipliersBasisPoints,
    ],
    [
      'breakRules.elementMultipliersBasisPoints',
      normalized.breakRules.elementMultipliersBasisPoints,
    ],
  ]) {
    if (!isRecord(fieldValue)) {
      issues.push(
        issue(
          'machine-axis-enemy-profile-attribute-required',
          `scenario.enemy.profile.${path}`,
          `Resolved enemy profile ${path} is required`
        )
      );
    }
  }
  if (
    scenarioEnemy?.enemyId != null &&
    Number(normalized.enemyId) !== Number(scenarioEnemy.enemyId)
  ) {
    issues.push(
      issue(
        'machine-axis-enemy-profile-enemy-id-mismatch',
        'scenario.enemy.profile.enemyId',
        'Enemy profile enemyId does not match scenario.enemy.enemyId',
        {
          expected: Number(scenarioEnemy.enemyId),
          actual: normalized.enemyId,
        }
      )
    );
  }
  if (
    scenarioEnemy?.level != null &&
    Number(normalized.level) !== Number(scenarioEnemy.level)
  ) {
    issues.push(
      issue(
        'machine-axis-enemy-profile-level-mismatch',
        'scenario.enemy.profile.level',
        'Enemy profile level does not match scenario.enemy.level',
        { expected: Number(scenarioEnemy.level), actual: normalized.level }
      )
    );
  }
  const hashSource = { ...normalized };
  delete hashSource.profileHash;
  const expectedHash = hashCanonicalValue(hashSource);
  if (normalized.profileHash !== expectedHash) {
    issues.push(
      issue(
        'machine-axis-enemy-profile-hash-mismatch',
        'scenario.enemy.profile.profileHash',
        'Enemy profile hash does not match its canonical contents',
        { expected: expectedHash, actual: normalized.profileHash }
      )
    );
  }
  return {
    valid: issues.length === 0,
    issues,
    normalized: issues.length === 0 ? normalized : null,
    expectedHash,
  };
}

export function createEnemyProfileIdentity(value) {
  const normalized = normalizeMachineAxisEnemyProfile(value);
  return {
    contractName: normalized.contractName,
    schemaVersion: normalized.schemaVersion,
    profileId: normalized.profileId,
    profileHash: normalized.profileHash,
    enemyId: normalized.enemyId,
    level: normalized.level,
    sourceStatus: normalized.source.status,
    sourceIdentity: normalized.source.identity,
    sourceHash: normalized.source.hash,
  };
}

function rejectAdditionalKeys(value, allowed, path, issues) {
  if (!isRecord(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      issues.push(
        issue(
          'machine-axis-enemy-profile-additional-property',
          `${path}.${key}`,
          `Additional enemy profile property is not allowed: ${key}`
        )
      );
    }
  }
}

function requireExactKeys(value, required, path, issues) {
  if (!isRecord(value)) {
    issues.push(
      issue(
        'machine-axis-enemy-profile-object-required',
        path,
        `Structured enemy profile object is required at ${path}`
      )
    );
    return;
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) {
      issues.push(
        issue(
          'machine-axis-enemy-profile-property-required',
          `${path}.${key}`,
          `Required enemy profile property is missing: ${key}`
        )
      );
    }
  }
}

function normalizeNumericRecord(value) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entry]) => [String(key), finiteNumberOrNull(entry)])
      .filter(([, entry]) => entry != null)
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
  );
}

function invalid(issues) {
  return { valid: false, issues, normalized: null, expectedHash: null };
}

function issue(code, path, message, details = {}) {
  return { severity: 'error', code, path, message, ...details };
}

function isRecord(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function textOrNull(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function finiteNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function positiveNumberOrNull(value) {
  const number = finiteNumberOrNull(value);
  return number != null && number > 0 ? number : null;
}

function nonNegativeNumberOrNull(value) {
  const number = finiteNumberOrNull(value);
  return number != null && number >= 0 ? number : null;
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
