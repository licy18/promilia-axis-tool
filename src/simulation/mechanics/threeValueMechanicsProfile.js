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
      trackKeys: ['enemyHpDamage'],
      steps: [
        {
          key: 'raw-product',
          operation: 'round-clamped-product',
          layerKeys: ['baseAttack', 'actionMultiplier'],
        },
      ],
      status: 'applied-preview-formula-partial',
      applied: true,
    },
    'explicit-self-energy-event-sum': {
      trackKeys: ['selfEnergyChange'],
      steps: [
        {
          key: 'explicit-resource-sum',
          operation: 'sum',
          layerKeys: ['explicitResourceDelta'],
        },
      ],
      status: 'applied-explicit-resource-events',
      applied: true,
    },
    'validated-toughness-before-after': {
      trackKeys: ['enemyToughnessDamage'],
      steps: [
        {
          key: 'validated-before-after',
          operation: 'before-minus-after',
          layerKeys: ['validatedRuntimeSample'],
        },
      ],
      status: 'applied-validated-runtime-sample',
      applied: true,
    },
    'validated-self-energy-before-after': {
      trackKeys: ['selfEnergyChange'],
      steps: [
        {
          key: 'validated-after-before',
          operation: 'after-minus-before',
          layerKeys: ['validatedRuntimeSample'],
        },
      ],
      status: 'applied-validated-runtime-sample',
      applied: true,
    },
    'source-value-identity': {
      trackKeys: TRACK_KEYS,
      steps: [
        {
          key: 'source-identity',
          operation: 'identity',
          layerKeys: [],
        },
      ],
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
    if (!Array.isArray(capability?.trackKeys)) {
      issues.push(`operand-kind-track-keys-missing:${kind || 'unknown'}`);
    }
    if (!Array.isArray(capability?.steps) || capability.steps.length === 0) {
      issues.push(`operand-kind-steps-missing:${kind || 'unknown'}`);
    }
    for (const [index, step] of (capability?.steps ?? []).entries()) {
      if (!String(step?.key ?? '').trim()) {
        issues.push(`operand-step-key-missing:${kind || 'unknown'}:${index}`);
      }
      if (!String(step?.operation ?? '').trim()) {
        issues.push(
          `operand-step-operation-missing:${kind || 'unknown'}:${index}`
        );
      }
      if (!Array.isArray(step?.layerKeys)) {
        issues.push(
          `operand-step-layer-keys-missing:${kind || 'unknown'}:${index}`
        );
      }
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
  const stepsReady = Boolean(
    capability?.steps?.length > 0 &&
      capability.steps.every(
        step =>
          String(step?.key ?? '').trim() &&
          String(step?.operation ?? '').trim() &&
          Array.isArray(step?.layerKeys)
      )
  );
  const ready = Boolean(capability && trackSupported && stepsReady);

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
          : 'mechanics-profile-steps-invalid'
        : 'mechanics-profile-operand-kind-unsupported',
  };
}
