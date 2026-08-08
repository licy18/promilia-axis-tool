import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization.js';

export const MACHINE_AXIS_OBJECTIVE_SCHEMA_VERSION = 1;
export const MACHINE_AXIS_OBJECTIVE_CONTRACT_NAME =
  'AzPrMachineAxisObjectiveContract';
export const MACHINE_AXIS_OBJECTIVE_POLICY_SCHEMA_VERSION = 1;
export const MACHINE_AXIS_OBJECTIVE_POLICY_CONTRACT_NAME =
  'AzPrMachineAxisObjectivePolicy';
export const MACHINE_AXIS_OBJECTIVE_POLICY_ID = 'm12-primary-objectives-v1';
export const MACHINE_AXIS_DEFAULT_PRIMARY_OBJECTIVE = 'cycle-dps-no-toughness';

export const MACHINE_AXIS_PRIMARY_OBJECTIVE_IDS = Object.freeze([
  'cycle-dps-no-toughness',
  'cycle-dps-with-toughness',
  'fastest-kill',
]);

export const MACHINE_AXIS_LEGACY_DIAGNOSTIC_OBJECTIVE_IDS = Object.freeze([
  'damage',
  'burst',
  'toughness',
]);

const OBJECTIVE_DEFINITIONS = Object.freeze({
  'cycle-dps-no-toughness': {
    classification: 'primary',
    formalEligible: true,
    targetPolicy: {
      hpMode: 'infinite',
      toughnessMode: 'disabled',
      breakMode: 'disabled',
      deathTruncation: 'disabled',
    },
    scoring: {
      metric: 'closed-cycle-hp-dps',
      direction: 'maximize',
      damageBasis: 'settled-post-defense-hp-damage',
      formula: 'loopHpDamage / loopDurationSeconds',
      finalRankingEligibility: 'accepted-loop-proof-only',
    },
    proofRequirements: {
      loopBoundary: 'strict-half-open-replayable-loop',
      actorBoundary: 'non-degrading-and-next-loop-ready',
      enemyBoundary: 'defense-and-level-inputs-stable',
      toughnessSettlement: 'disabled',
      killRequired: false,
      enemyProfile: 'resolved-defense-and-level-inputs',
    },
  },
  'cycle-dps-with-toughness': {
    classification: 'primary',
    formalEligible: true,
    targetPolicy: {
      hpMode: 'infinite',
      toughnessMode: 'enabled',
      breakMode: 'enabled',
      deathTruncation: 'disabled',
    },
    scoring: {
      metric: 'closed-cycle-hp-dps',
      direction: 'maximize',
      damageBasis: 'settled-post-defense-hp-damage',
      formula: 'loopHpDamage / loopDurationSeconds',
      finalRankingEligibility: 'accepted-loop-proof-only',
    },
    proofRequirements: {
      loopBoundary: 'strict-half-open-replayable-loop',
      actorBoundary: 'non-degrading-and-next-loop-ready',
      enemyBoundary: 'toughness-break-state-and-recovery-phase-closed',
      toughnessSettlement:
        'packet-ordered-toughness-break-double-damage-recovery',
      killRequired: false,
      enemyProfile: 'resolved-defense-level-and-toughness-inputs',
    },
  },
  'fastest-kill': {
    classification: 'primary',
    formalEligible: true,
    targetPolicy: {
      hpMode: 'finite',
      toughnessMode: 'enabled',
      breakMode: 'enabled',
      deathTruncation: 'enabled',
    },
    scoring: {
      metric: 'first-lethal-settlement-time',
      direction: 'minimize',
      damageBasis: 'settled-post-defense-hp-damage',
      formula: 'firstLethalFrameThenTimeMs',
      finalRankingEligibility: 'real-kill-candidate-only',
    },
    proofRequirements: {
      loopBoundary: 'not-applicable',
      actorBoundary: 'runtime-legality-through-lethal-settlement',
      enemyBoundary: 'first-lethal-settlement-and-post-death-truncation',
      toughnessSettlement:
        'packet-ordered-toughness-break-double-damage-recovery',
      killRequired: true,
      enemyProfile: 'fully-resolved-hp-defense-level-and-toughness-profile',
    },
  },
  damage: {
    classification: 'legacy-diagnostic',
    formalEligible: false,
    targetPolicy: null,
    scoring: {
      metric: 'fixed-duration-total-hp-damage',
      direction: 'maximize',
      damageBasis: 'settled-hp-damage-diagnostic',
      formula: 'totalHpDamage',
      finalRankingEligibility: 'diagnostic-only',
    },
    proofRequirements: legacyProofRequirements(),
  },
  burst: {
    classification: 'legacy-diagnostic',
    formalEligible: false,
    targetPolicy: null,
    scoring: {
      metric: 'sliding-window-hp-damage',
      direction: 'maximize',
      damageBasis: 'settled-hp-damage-diagnostic',
      formula: 'maxWindowHpDamage',
      finalRankingEligibility: 'diagnostic-only',
    },
    proofRequirements: legacyProofRequirements(),
  },
  toughness: {
    classification: 'legacy-diagnostic',
    formalEligible: false,
    targetPolicy: null,
    scoring: {
      metric: 'raw-toughness-damage',
      direction: 'maximize',
      damageBasis: 'raw-toughness-damage-diagnostic',
      formula: 'totalToughnessDamage',
      finalRankingEligibility: 'diagnostic-only',
      companionMetric: 'net-toughness-damage',
    },
    proofRequirements: legacyProofRequirements(),
  },
});

const OBJECTIVE_CONTRACT_KEYS = Object.freeze([
  'schemaVersion',
  'contractName',
  'objectiveId',
  'classification',
  'formalEligible',
  'targetPolicy',
  'scoring',
  'proofRequirements',
  'objectiveHash',
]);

const OBJECTIVE_POLICY_KEYS = Object.freeze([
  'schemaVersion',
  'contractName',
  'policyId',
  'defaultPrimaryObjectiveId',
  'primaryObjectiveIds',
  'legacyDiagnosticObjectiveIds',
  'objectivesById',
  'objectivePolicyHash',
]);

export function createMachineAxisObjectiveContract(
  objectiveId = MACHINE_AXIS_DEFAULT_PRIMARY_OBJECTIVE
) {
  const normalizedId = String(objectiveId ?? '');
  const definition = OBJECTIVE_DEFINITIONS[normalizedId];
  if (!definition) {
    throw new RangeError(`machine-axis-objective-unsupported:${normalizedId}`);
  }
  const contract = {
    schemaVersion: MACHINE_AXIS_OBJECTIVE_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_OBJECTIVE_CONTRACT_NAME,
    objectiveId: normalizedId,
    ...structuredClone(definition),
  };
  return {
    ...contract,
    objectiveHash: hashCanonicalValue(contract),
  };
}

export function validateMachineAxisObjectiveContract(
  value,
  { formal = false } = {}
) {
  const issues = [];
  if (!isRecord(value)) {
    return invalidResult([
      issue(
        'machine-axis-objective-contract-required',
        '',
        'A structured objective contract is required'
      ),
    ]);
  }

  validateExactKeys(value, OBJECTIVE_CONTRACT_KEYS, '', issues);
  if (value.schemaVersion !== MACHINE_AXIS_OBJECTIVE_SCHEMA_VERSION) {
    issues.push(
      issue(
        'machine-axis-objective-schema-version-invalid',
        'schemaVersion',
        `Objective schemaVersion must be ${MACHINE_AXIS_OBJECTIVE_SCHEMA_VERSION}`
      )
    );
  }
  if (value.contractName !== MACHINE_AXIS_OBJECTIVE_CONTRACT_NAME) {
    issues.push(
      issue(
        'machine-axis-objective-contract-name-invalid',
        'contractName',
        `Objective contractName must be ${MACHINE_AXIS_OBJECTIVE_CONTRACT_NAME}`
      )
    );
  }

  const objectiveId =
    typeof value.objectiveId === 'string' ? value.objectiveId : '';
  const definition = OBJECTIVE_DEFINITIONS[objectiveId];
  if (!definition) {
    issues.push(
      issue(
        'machine-axis-objective-unsupported',
        'objectiveId',
        `Unsupported objective: ${objectiveId || '<missing>'}`
      )
    );
  }

  const hashInput = structuredClone(value);
  delete hashInput.objectiveHash;
  if (
    typeof value.objectiveHash !== 'string' ||
    value.objectiveHash !== hashCanonicalValue(hashInput)
  ) {
    issues.push(
      issue(
        'machine-axis-objective-hash-mismatch',
        'objectiveHash',
        'Objective hash does not match the complete objective contract'
      )
    );
  }

  if (definition) {
    const expected = createMachineAxisObjectiveContract(objectiveId);
    if (hashCanonicalValue(value) !== hashCanonicalValue(expected)) {
      issues.push(
        issue(
          'machine-axis-objective-definition-mismatch',
          '',
          'Objective contract does not match the frozen objective definition'
        )
      );
    }
    if (formal && expected.formalEligible !== true) {
      issues.push(
        issue(
          'machine-axis-objective-formal-ineligible',
          'objectiveId',
          `Objective ${objectiveId} is legacy diagnostic only`
        )
      );
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    contract: issues.length === 0 ? structuredClone(value) : null,
  };
}

export function createMachineAxisObjectivePolicy() {
  const objectiveIds = [
    ...MACHINE_AXIS_PRIMARY_OBJECTIVE_IDS,
    ...MACHINE_AXIS_LEGACY_DIAGNOSTIC_OBJECTIVE_IDS,
  ];
  const policy = {
    schemaVersion: MACHINE_AXIS_OBJECTIVE_POLICY_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_OBJECTIVE_POLICY_CONTRACT_NAME,
    policyId: MACHINE_AXIS_OBJECTIVE_POLICY_ID,
    defaultPrimaryObjectiveId: MACHINE_AXIS_DEFAULT_PRIMARY_OBJECTIVE,
    primaryObjectiveIds: [...MACHINE_AXIS_PRIMARY_OBJECTIVE_IDS],
    legacyDiagnosticObjectiveIds: [
      ...MACHINE_AXIS_LEGACY_DIAGNOSTIC_OBJECTIVE_IDS,
    ],
    objectivesById: Object.fromEntries(
      objectiveIds.map(objectiveId => [
        objectiveId,
        createMachineAxisObjectiveContract(objectiveId),
      ])
    ),
  };
  return {
    ...policy,
    objectivePolicyHash: hashCanonicalValue(policy),
  };
}

export function validateMachineAxisObjectivePolicy(value) {
  const issues = [];
  if (!isRecord(value)) {
    return {
      valid: false,
      issues: [
        issue(
          'machine-axis-objective-policy-required',
          '',
          'A structured objective policy is required'
        ),
      ],
      policy: null,
    };
  }
  validateExactKeys(value, OBJECTIVE_POLICY_KEYS, '', issues);
  if (value.schemaVersion !== MACHINE_AXIS_OBJECTIVE_POLICY_SCHEMA_VERSION) {
    issues.push(
      issue(
        'machine-axis-objective-policy-schema-version-invalid',
        'schemaVersion',
        `Objective policy schemaVersion must be ${MACHINE_AXIS_OBJECTIVE_POLICY_SCHEMA_VERSION}`
      )
    );
  }
  if (value.contractName !== MACHINE_AXIS_OBJECTIVE_POLICY_CONTRACT_NAME) {
    issues.push(
      issue(
        'machine-axis-objective-policy-contract-name-invalid',
        'contractName',
        `Objective policy contractName must be ${MACHINE_AXIS_OBJECTIVE_POLICY_CONTRACT_NAME}`
      )
    );
  }
  if (value.policyId !== MACHINE_AXIS_OBJECTIVE_POLICY_ID) {
    issues.push(
      issue(
        'machine-axis-objective-policy-id-invalid',
        'policyId',
        `Objective policyId must be ${MACHINE_AXIS_OBJECTIVE_POLICY_ID}`
      )
    );
  }

  const indexed = isRecord(value.objectivesById) ? value.objectivesById : {};
  const expectedIds = [
    ...MACHINE_AXIS_PRIMARY_OBJECTIVE_IDS,
    ...MACHINE_AXIS_LEGACY_DIAGNOSTIC_OBJECTIVE_IDS,
  ];
  validateExactKeys(indexed, expectedIds, 'objectivesById', issues);
  for (const objectiveId of expectedIds) {
    const validation = validateMachineAxisObjectiveContract(
      indexed[objectiveId]
    );
    issues.push(
      ...validation.issues.map(entry => ({
        ...entry,
        field: joinField(`objectivesById.${objectiveId}`, entry.field),
      }))
    );
  }

  const hashInput = structuredClone(value);
  delete hashInput.objectivePolicyHash;
  if (
    typeof value.objectivePolicyHash !== 'string' ||
    value.objectivePolicyHash !== hashCanonicalValue(hashInput)
  ) {
    issues.push(
      issue(
        'machine-axis-objective-policy-hash-mismatch',
        'objectivePolicyHash',
        'Objective policy hash does not match the complete objective policy'
      )
    );
  }
  if (
    hashCanonicalValue(value) !==
    hashCanonicalValue(createMachineAxisObjectivePolicy())
  ) {
    issues.push(
      issue(
        'machine-axis-objective-policy-definition-mismatch',
        '',
        'Objective policy does not match the frozen objective policy'
      )
    );
  }

  return {
    valid: issues.length === 0,
    issues,
    policy: issues.length === 0 ? structuredClone(value) : null,
  };
}

export function getMachineAxisObjectiveContract(objectiveId) {
  try {
    return createMachineAxisObjectiveContract(objectiveId);
  } catch {
    return null;
  }
}

export function isMachineAxisPrimaryObjective(objectiveId) {
  return MACHINE_AXIS_PRIMARY_OBJECTIVE_IDS.includes(String(objectiveId ?? ''));
}

export function isMachineAxisLegacyDiagnosticObjective(objectiveId) {
  return MACHINE_AXIS_LEGACY_DIAGNOSTIC_OBJECTIVE_IDS.includes(
    String(objectiveId ?? '')
  );
}

function legacyProofRequirements() {
  return {
    loopBoundary: 'not-required',
    actorBoundary: 'runtime-legality-only',
    enemyBoundary: 'scenario-defined',
    toughnessSettlement: 'diagnostic-only',
    killRequired: false,
    enemyProfile: 'diagnostic-scenario-inputs',
  };
}

function validateExactKeys(value, expectedKeys, field, issues) {
  const expected = new Set(expectedKeys);
  for (const key of expectedKeys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      issues.push(
        issue(
          'machine-axis-objective-field-missing',
          joinField(field, key),
          `Required objective field is missing: ${joinField(field, key)}`
        )
      );
    }
  }
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) {
      issues.push(
        issue(
          'machine-axis-objective-additional-property',
          joinField(field, key),
          `Unexpected objective field: ${joinField(field, key)}`
        )
      );
    }
  }
}

function invalidResult(issues) {
  return { valid: false, issues, contract: null };
}

function issue(code, field, message) {
  return { code, field, message };
}

function joinField(prefix, key) {
  return prefix ? `${prefix}.${key}` : key;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
