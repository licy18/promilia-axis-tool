export const THREE_VALUE_MECHANICS_PROFILE_CONTRACT_NAME =
  'AzPrMechanicsProfile';

export const THREE_VALUE_MECHANICS_PROFILE_CONTRACT_VERSION = 1;

export const DEFAULT_THREE_VALUE_MECHANICS_PROFILE_ID =
  'azpr-three-value-preview-v1';

const TRACK_KEYS = [
  'enemyHpDamage',
  'enemyToughnessDamage',
  'selfEnergyChange',
];

export const DEFAULT_THREE_VALUE_MECHANICS_PROFILE =
  createDefaultThreeValueMechanicsProfile();

export function createDefaultThreeValueMechanicsProfile() {
  const operandKinds = {
    'hp-raw-preview-product': {
      operation: 'round-clamped-product',
      trackKeys: ['enemyHpDamage'],
      layerKeys: ['baseAttack', 'actionMultiplier'],
      status: 'applied-preview-formula-partial',
      applied: true,
    },
    'explicit-self-energy-event-sum': {
      operation: 'sum',
      trackKeys: ['selfEnergyChange'],
      layerKeys: ['explicitResourceDelta'],
      status: 'applied-explicit-resource-events',
      applied: true,
    },
    'validated-toughness-before-after': {
      operation: 'before-minus-after',
      trackKeys: ['enemyToughnessDamage'],
      layerKeys: ['validatedRuntimeSample'],
      status: 'applied-validated-runtime-sample',
      applied: true,
    },
    'validated-self-energy-before-after': {
      operation: 'after-minus-before',
      trackKeys: ['selfEnergyChange'],
      layerKeys: ['validatedRuntimeSample'],
      status: 'applied-validated-runtime-sample',
      applied: true,
    },
    'source-value-identity': {
      operation: 'identity',
      trackKeys: TRACK_KEYS,
      layerKeys: [],
      status: 'compatibility-and-diagnostic-fallback',
      applied: false,
    },
  };

  return {
    schemaVersion: 1,
    contractName: THREE_VALUE_MECHANICS_PROFILE_CONTRACT_NAME,
    contractVersion: THREE_VALUE_MECHANICS_PROFILE_CONTRACT_VERSION,
    profileId: DEFAULT_THREE_VALUE_MECHANICS_PROFILE_ID,
    profileVersion: 1,
    sourceKind: 'built-in-azpr-preview-mechanics-profile',
    status: 'azpr-preview-mechanics-profile-ready',
    ready: true,
    operandKinds,
    supportedOperandKinds: Object.keys(operandKinds),
    tracks: {
      enemyHpDamage: {
        outputField: 'hpDelta',
        appliedLayers: ['baseAttack', 'actionMultiplier'],
        unappliedLayers: [
          'enemyDefense',
          'enemyResistance',
          'critical',
          'damageBonus',
          'loadout',
          'enemyLevel',
        ],
      },
      enemyToughnessDamage: {
        outputField: 'toughnessDelta',
        appliedLayers: ['validatedRuntimeSample'],
        unappliedLayers: [
          'actionToughnessValue',
          'weaknessOrBreakModifier',
          'loadout',
          'enemyLevel',
        ],
      },
      selfEnergyChange: {
        outputField: 'energyDelta',
        appliedLayers: ['explicitResourceDelta', 'validatedRuntimeSample'],
        unappliedLayers: [
          'actionChargeGain',
          'hitEnergyGain',
          'passiveEnergyModifiers',
          'loadout',
        ],
      },
    },
    policy: {
      unconfirmedFormulaLayersApplied: false,
      unconfirmedCultivationEffectsApplied: false,
      runtimeSamplesRequireValidation: true,
      unsupportedOperandsFallbackToGenerationDelta: true,
    },
    summary: {
      trackCount: TRACK_KEYS.length,
      supportedOperandKindCount: Object.keys(operandKinds).length,
      appliedOperandKindCount: Object.values(operandKinds).filter(
        item => item.applied
      ).length,
    },
  };
}

export function resolveThreeValueMechanicsProfile(profile) {
  const validation = validateThreeValueMechanicsProfile(profile);
  if (validation.valid) {
    return {
      profile,
      validation,
      fallback: false,
      fallbackReason: null,
    };
  }
  return {
    profile: DEFAULT_THREE_VALUE_MECHANICS_PROFILE,
    validation: validateThreeValueMechanicsProfile(
      DEFAULT_THREE_VALUE_MECHANICS_PROFILE
    ),
    fallback: true,
    fallbackReason: profile
      ? 'mechanics-profile-invalid'
      : 'mechanics-profile-missing',
  };
}

export function validateThreeValueMechanicsProfile(profile) {
  const issues = [];
  if (profile?.contractName !== THREE_VALUE_MECHANICS_PROFILE_CONTRACT_NAME) {
    issues.push('contract-name-invalid');
  }
  if (!String(profile?.profileId ?? '').trim()) {
    issues.push('profile-id-missing');
  }
  if (!Number.isFinite(Number(profile?.profileVersion))) {
    issues.push('profile-version-invalid');
  }
  if (!profile?.operandKinds || typeof profile.operandKinds !== 'object') {
    issues.push('operand-kinds-missing');
  }
  for (const [kind, capability] of Object.entries(
    profile?.operandKinds ?? {}
  )) {
    if (!kind || !String(capability?.operation ?? '').trim()) {
      issues.push(`operand-kind-operation-missing:${kind || 'unknown'}`);
    }
    if (!Array.isArray(capability?.trackKeys)) {
      issues.push(`operand-kind-track-keys-missing:${kind || 'unknown'}`);
    }
    if (!Array.isArray(capability?.layerKeys)) {
      issues.push(`operand-kind-layer-keys-missing:${kind || 'unknown'}`);
    }
  }
  return {
    valid: issues.length === 0,
    status:
      issues.length === 0
        ? 'mechanics-profile-valid'
        : 'mechanics-profile-invalid',
    issues,
  };
}

export function resolveThreeValueMechanicsProfileCapability({
  profile,
  operands,
} = {}) {
  const profileResolution = resolveThreeValueMechanicsProfile(profile);
  const resolvedProfile = profileResolution.profile;
  const capability = resolvedProfile.operandKinds?.[operands?.kind] ?? null;
  const trackSupported = Boolean(
    capability?.trackKeys?.includes(operands?.trackKey)
  );
  const operationMatches = Boolean(
    capability?.operation && capability.operation === operands?.operation
  );
  const ready = Boolean(capability && trackSupported && operationMatches);

  return {
    profile: resolvedProfile,
    profileResolution,
    capability,
    ready,
    status: ready
      ? 'mechanics-profile-capability-ready'
      : capability
        ? 'mechanics-profile-capability-mismatch'
        : 'mechanics-profile-capability-unsupported',
    fallbackReason: ready
      ? null
      : capability
        ? !trackSupported
          ? 'mechanics-profile-track-unsupported'
          : 'mechanics-profile-operation-mismatch'
        : 'mechanics-profile-operand-kind-unsupported',
  };
}
