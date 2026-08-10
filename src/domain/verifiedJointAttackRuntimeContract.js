import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization';

export const VERIFIED_JOINT_ATTACK_RUNTIME_SCHEMA_VERSION = 1;
export const VERIFIED_JOINT_ATTACK_RUNTIME_CONTRACT_NAME =
  'AzPrVerifiedJointAttackRuntimeAssumption';
export const VERIFIED_JOINT_ATTACK_RUNTIME_CONTRACT_ID =
  'm12-joint-attack-runtime-v1';
export const VERIFIED_JOINT_ATTACK_RUNTIME_READY_CODE =
  'joint-attack-runtime-assumption-ready';
export const VERIFIED_JOINT_ATTACK_RUNTIME_CONTRACT_REQUIRED_CODE =
  'joint-attack-runtime-contract-required';

const RUNTIME_INPUT_KEYS = Object.freeze([
  'forceBreak',
  'cannotBeJointStrike',
  'controlledEntityGate',
  'enemyRage',
  'distanceEligible',
  'heightEligible',
  'connectivityEligible',
  'actorConflict',
  'kiboConflict',
]);

const DEFAULT_RUNTIME_INPUTS = deepFreeze({
  forceBreak: false,
  cannotBeJointStrike: null,
  controlledEntityGate: null,
  enemyRage: false,
  distanceEligible: true,
  heightEligible: true,
  connectivityEligible: true,
  actorConflict: false,
  kiboConflict: false,
});

const CONTRACT_PAYLOAD = deepFreeze({
  schemaVersion: VERIFIED_JOINT_ATTACK_RUNTIME_SCHEMA_VERSION,
  contractName: VERIFIED_JOINT_ATTACK_RUNTIME_CONTRACT_NAME,
  contractId: VERIFIED_JOINT_ATTACK_RUNTIME_CONTRACT_ID,
  formalReady: true,
  clientParityReady: false,
  semantics: {
    releaseAuthority: 'explicit-player-input-only-not-automatic-release',
    foregroundAuthority:
      'current-controlled-actor-and-current-equipped-live-kibo',
    kiboIdentity:
      'verified-break-skill-list-and-skill-tag-15-pet-joint-strike-skill',
    thresholdFormula:
      'maxWeaknessPoint*WP_BREAK_TOUGH/10000*kibo.WP_BREAK_PERCENT/10000',
    thresholdBoundary: 'current-weakness-point-strictly-less-than-threshold',
    triggerTiming:
      'first-source-ordered-cursor-where-all-known-conditions-pass',
    pairAtomicity:
      'actor-star-combo-and-equipped-kibo-joint-strike-commit-or-rollback-together',
    attachedToughnessAnchor:
      'first-source-ordered-verified-kibo-joint-strike-landed-hit-derived-from-mapping-and-hit-identity',
    jointDamageBreakState:
      'pair-hp-packets-at-kibo-anchor-frame-settle-before-attached-clear-then-later-packets-read-canonical-state',
    attachedToughnessEffect:
      'after-anchor-frame-pair-hp-packets-clear-current-toughness-once',
    breakTransition:
      'enter-break-once-after-attached-toughness-clear-if-not-already-broken',
    subsequentPacketVisibility:
      'only-source-ordered-packets-after-attached-clear-observe-new-break',
  },
  fallbackPolicy: {
    missingCannotBeJointStrike: 'assume-no-service-exclusion',
    missingControlledEntityGate: 'assume-open-after-known-input-and-fsm-gates',
    explicitCannotBeJointStrikeTrue: 'reject',
    explicitControlledEntityGateFalse: 'reject',
    futureClientConflict:
      'bump-contract-version-and-recompute-all-affected-hashes-and-scores',
  },
  thresholdInputs: {
    enemyWpBreakToughBasisPoints: 10000,
    sourceStatus: 'verified-current-client-catalog-invariant',
    sourceIdentity:
      'generated/enemies.items[*].property.baseAttributes[key=WP_BREAK_TOUGH]',
    sourceInvariant: 'all-current-nonmissing-WP_BREAK_TOUGH-values-equal-10000',
  },
  evidence: {
    resolutionStatus: 'resolved-by-product-assumption',
    clientParityStatus: 'not-claimed',
    sourceLedger: [
      'PreWeakBreakSystem.OnUpdateDeltaTime@0x13FB720',
      'PreWeakBreakSystem.UpdatePreBreakThreshold@0x13FCB20',
      'NewTable/element_formula.rows[id=223].functionOutput',
      'NewTable/battle_info.rows[attrID=WP_BREAK_TOUGH]',
      'NewTable/battle_info.rows[attrID=WP_BREAK_PERCENT]',
      'NewTable/pet.breakSkillList',
      'verified-control-binding:skillTag=15/PetJointStrikeSkill',
      'verified-kibo-joint-strike-action-mapping-and-hit-identity',
    ],
    resolvedByProductAssumption: [
      'controlled-entity-offset-0x40-field-identity',
      'service-cannot-be-joint-strike-set-runtime-input',
      'joint-strike-post-cast-effect-chain',
      'server-authoritative-weakness-point-clear',
    ],
    leavesOpen: [
      'client-server-parity-for-product-fallback-gates',
      'client-server-parity-for-kibo-hit-anchored-post-damage-toughness-clear-order',
    ],
  },
});

export function getVerifiedJointAttackRuntimeContract() {
  const payload = structuredClone(CONTRACT_PAYLOAD);
  return deepFreeze({
    ...payload,
    contractHash: hashCanonicalValue(payload),
  });
}

export function createVerifiedJointAttackRuntimeBinding(runtimeInputs = {}) {
  const contract = getVerifiedJointAttackRuntimeContract();
  const normalizedInputs = normalizeRuntimeInputs(runtimeInputs);
  const value = {
    ...structuredClone(contract),
    runtimeInputs: normalizedInputs,
  };
  return deepFreeze({
    ...value,
    bindingHash: hashCanonicalValue(value),
  });
}

export function validateVerifiedJointAttackRuntimeBinding(value) {
  const issues = [];
  if (!isRecord(value)) {
    return invalid([
      issue(
        VERIFIED_JOINT_ATTACK_RUNTIME_CONTRACT_REQUIRED_CODE,
        'combatScenario.jointAttackRuntime',
        'A verified joint-attack runtime assumption binding is required'
      ),
    ]);
  }
  const expectedContract = getVerifiedJointAttackRuntimeContract();
  const expectedTopKeys = new Set([
    ...Object.keys(expectedContract),
    'runtimeInputs',
    'bindingHash',
  ]);
  rejectAdditionalKeys(
    value,
    expectedTopKeys,
    'combatScenario.jointAttackRuntime',
    issues
  );
  requireKeys(
    value,
    expectedTopKeys,
    'combatScenario.jointAttackRuntime',
    issues
  );
  if (!isRecord(value.runtimeInputs)) {
    issues.push(
      issue(
        'joint-attack-runtime-inputs-required',
        'combatScenario.jointAttackRuntime.runtimeInputs',
        'Joint-attack runtimeInputs must be an object'
      )
    );
  } else {
    const allowed = new Set(RUNTIME_INPUT_KEYS);
    rejectAdditionalKeys(
      value.runtimeInputs,
      allowed,
      'combatScenario.jointAttackRuntime.runtimeInputs',
      issues
    );
    requireKeys(
      value.runtimeInputs,
      allowed,
      'combatScenario.jointAttackRuntime.runtimeInputs',
      issues
    );
    for (const key of RUNTIME_INPUT_KEYS) {
      const input = value.runtimeInputs[key];
      const nullable = ['cannotBeJointStrike', 'controlledEntityGate'].includes(
        key
      );
      if (typeof input !== 'boolean' && !(nullable && input === null)) {
        issues.push(
          issue(
            'joint-attack-runtime-input-type-invalid',
            `combatScenario.jointAttackRuntime.runtimeInputs.${key}`,
            `${key} must be ${nullable ? 'boolean or null' : 'boolean'}`
          )
        );
      }
    }
  }

  for (const [key, expected] of Object.entries(expectedContract)) {
    if (hashCanonicalValue(value[key]) !== hashCanonicalValue(expected)) {
      issues.push(
        issue(
          'joint-attack-runtime-contract-semantic-mismatch',
          `combatScenario.jointAttackRuntime.${key}`,
          `Joint-attack runtime contract field does not match ${VERIFIED_JOINT_ATTACK_RUNTIME_CONTRACT_ID}: ${key}`
        )
      );
    }
  }
  const bindingSource = { ...value };
  delete bindingSource.bindingHash;
  const expectedBindingHash = hashCanonicalValue(bindingSource);
  if (value.bindingHash !== expectedBindingHash) {
    issues.push(
      issue(
        'joint-attack-runtime-binding-hash-mismatch',
        'combatScenario.jointAttackRuntime.bindingHash',
        'Joint-attack runtime binding hash does not match its canonical contents'
      )
    );
  }
  return {
    valid: issues.length === 0,
    issues,
    binding: issues.length === 0 ? deepFreeze(structuredClone(value)) : null,
    expectedBindingHash,
  };
}

export function resolveVerifiedJointAttackRuntimeBinding(scenario = {}) {
  const value =
    scenario?.combatScenario?.jointAttackRuntime ??
    scenario?.jointAttackRuntime ??
    null;
  return validateVerifiedJointAttackRuntimeBinding(value);
}

export function calculateVerifiedJointAttackThreshold({
  maxWeaknessPoint,
  enemyWpBreakToughBasisPoints,
  kiboWpBreakPercentBasisPoints,
} = {}) {
  const maximum = finiteNumberOrNull(maxWeaknessPoint);
  const enemyFactor = finiteNumberOrNull(enemyWpBreakToughBasisPoints);
  const kiboFactor = finiteNumberOrNull(kiboWpBreakPercentBasisPoints);
  if (
    maximum == null ||
    maximum <= 0 ||
    enemyFactor == null ||
    enemyFactor <= 0 ||
    kiboFactor == null ||
    kiboFactor <= 0
  ) {
    return null;
  }
  return roundValue(maximum * (enemyFactor / 10000) * (kiboFactor / 10000));
}

export function evaluateVerifiedJointAttackRuntimeEligibility({
  binding,
  enemy,
  enemyWpBreakToughBasisPoints,
  kiboWpBreakPercentBasisPoints,
  actorAlive,
  kiboAlive,
  actorId,
  controlledActorId,
  targetId,
  expectedTargetId,
} = {}) {
  const validation = validateVerifiedJointAttackRuntimeBinding(binding);
  if (!validation.valid) {
    return rejected(
      VERIFIED_JOINT_ATTACK_RUNTIME_CONTRACT_REQUIRED_CODE,
      null,
      validation.issues
    );
  }
  const runtimeInputs = validation.binding.runtimeInputs;
  const contractEnemyFactor =
    validation.binding.thresholdInputs.enemyWpBreakToughBasisPoints;
  const suppliedEnemyFactor = finiteNumberOrNull(enemyWpBreakToughBasisPoints);
  if (
    suppliedEnemyFactor != null &&
    suppliedEnemyFactor !== Number(contractEnemyFactor)
  ) {
    return rejected('joint-attack-enemy-threshold-source-mismatch', null);
  }
  const threshold = calculateVerifiedJointAttackThreshold({
    maxWeaknessPoint: enemy?.maxToughness,
    enemyWpBreakToughBasisPoints: contractEnemyFactor,
    kiboWpBreakPercentBasisPoints,
  });
  if (
    enemy?.targetPolicy?.toughnessMode !== 'enabled' ||
    enemy?.targetPolicy?.breakMode !== 'enabled' ||
    !(Number(enemy?.maxToughness) > 0)
  ) {
    return rejected('joint-attack-breakable-toughness-required', threshold);
  }
  if (!(Number(enemy?.hp) > 0)) {
    return rejected('joint-attack-target-dead', threshold);
  }
  if (enemy?.inBreak === true) {
    return rejected('joint-attack-target-already-broken', threshold);
  }
  if (runtimeInputs.enemyRage) {
    return rejected('joint-attack-target-rage-active', threshold);
  }
  if (runtimeInputs.cannotBeJointStrike === true) {
    return rejected('joint-attack-service-excluded', threshold);
  }
  if (runtimeInputs.controlledEntityGate === false) {
    return rejected('joint-attack-controlled-entity-gate-closed', threshold);
  }
  if (!runtimeInputs.distanceEligible) {
    return rejected('joint-attack-distance-gate-failed', threshold);
  }
  if (!runtimeInputs.heightEligible) {
    return rejected('joint-attack-height-gate-failed', threshold);
  }
  if (!runtimeInputs.connectivityEligible) {
    return rejected('joint-attack-connectivity-gate-failed', threshold);
  }
  if (runtimeInputs.actorConflict || runtimeInputs.kiboConflict) {
    return rejected('joint-attack-fsm-conflict', threshold);
  }
  if (actorAlive !== true) {
    return rejected('joint-attack-actor-not-alive', threshold);
  }
  if (kiboAlive !== true) {
    return rejected('joint-attack-kibo-not-alive', threshold);
  }
  if (String(actorId ?? '') !== String(controlledActorId ?? '')) {
    return rejected('joint-attack-actor-not-controlled', threshold);
  }
  if (
    targetId != null &&
    expectedTargetId != null &&
    String(targetId) !== String(expectedTargetId)
  ) {
    return rejected('joint-attack-target-mismatch', threshold);
  }
  if (threshold == null) {
    return rejected('joint-attack-threshold-inputs-unresolved', null);
  }
  const current = finiteNumberOrNull(enemy?.toughness);
  if (current == null || current < 0) {
    return rejected('joint-attack-current-toughness-invalid', threshold);
  }
  if (!runtimeInputs.forceBreak && !(current < threshold)) {
    return rejected('joint-attack-threshold-not-reached', threshold);
  }
  return deepFreeze({
    eligible: true,
    code: VERIFIED_JOINT_ATTACK_RUNTIME_READY_CODE,
    threshold,
    currentToughness: roundValue(current),
    forceBreak: runtimeInputs.forceBreak,
    fallbackApplications: [
      ...(runtimeInputs.cannotBeJointStrike == null
        ? ['missing-cannot-be-joint-strike-assumed-no-exclusion']
        : []),
      ...(runtimeInputs.controlledEntityGate == null
        ? ['missing-controlled-entity-gate-assumed-open']
        : []),
    ],
    bindingHash: validation.binding.bindingHash,
  });
}

function normalizeRuntimeInputs(value) {
  const source = isRecord(value) ? value : {};
  return {
    forceBreak: source.forceBreak === true,
    cannotBeJointStrike:
      typeof source.cannotBeJointStrike === 'boolean'
        ? source.cannotBeJointStrike
        : null,
    controlledEntityGate:
      typeof source.controlledEntityGate === 'boolean'
        ? source.controlledEntityGate
        : null,
    enemyRage: source.enemyRage === true,
    distanceEligible:
      source.distanceEligible == null
        ? DEFAULT_RUNTIME_INPUTS.distanceEligible
        : source.distanceEligible === true,
    heightEligible:
      source.heightEligible == null
        ? DEFAULT_RUNTIME_INPUTS.heightEligible
        : source.heightEligible === true,
    connectivityEligible:
      source.connectivityEligible == null
        ? DEFAULT_RUNTIME_INPUTS.connectivityEligible
        : source.connectivityEligible === true,
    actorConflict: source.actorConflict === true,
    kiboConflict: source.kiboConflict === true,
  };
}

function rejected(code, threshold, issues = []) {
  return deepFreeze({
    eligible: false,
    code,
    threshold,
    issues: structuredClone(issues),
  });
}

function issue(code, path, message) {
  return { severity: 'error', code, path, message };
}

function invalid(issues) {
  return { valid: false, issues, binding: null, expectedBindingHash: null };
}

function rejectAdditionalKeys(value, allowed, path, issues) {
  if (!isRecord(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      issues.push(
        issue(
          'joint-attack-runtime-additional-property',
          `${path}.${key}`,
          `Additional joint-attack runtime property is not allowed: ${key}`
        )
      );
    }
  }
}

function requireKeys(value, required, path, issues) {
  if (!isRecord(value)) return;
  for (const key of required) {
    if (!Object.hasOwn(value, key)) {
      issues.push(
        issue(
          'joint-attack-runtime-property-required',
          `${path}.${key}`,
          `Required joint-attack runtime property is missing: ${key}`
        )
      );
    }
  }
}

function finiteNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundValue(value) {
  return Math.round(Number(value) * 1e9) / 1e9;
}

function isRecord(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function deepFreeze(value) {
  if (value == null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const entry of Object.values(value)) deepFreeze(entry);
  return Object.freeze(value);
}
