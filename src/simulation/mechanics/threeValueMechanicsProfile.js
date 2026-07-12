import {
  DEFAULT_WORKBENCH_MECHANICS_PROFILE_ID,
  normalizeWorkbenchMechanicsProfileSelection,
} from '../../domain/workbenchMechanicsProfileSelection';

export const THREE_VALUE_MECHANICS_PROFILE_CONTRACT_NAME =
  'AzPrMechanicsProfile';

export const THREE_VALUE_MECHANICS_PROFILE_CONTRACT_VERSION = 2;

export const DEFAULT_THREE_VALUE_MECHANICS_PROFILE_ID =
  DEFAULT_WORKBENCH_MECHANICS_PROFILE_ID;

const TRACK_KEYS = [
  'enemyHpDamage',
  'enemyToughnessDamage',
  'selfEnergyChange',
];

export const THREE_VALUE_STATE_EFFECT_BY_TRACK_KEY = {
  enemyHpDamage: {
    readMetric: 'enemyHp',
    writeMetric: 'enemyHp',
    target: 'targetEnemy',
    applyMode: 'decrease',
  },
  enemyToughnessDamage: {
    readMetric: 'enemyToughness',
    writeMetric: 'enemyToughness',
    target: 'targetEnemy',
    applyMode: 'decrease',
  },
  selfEnergyChange: {
    readMetric: 'selfEnergy',
    writeMetric: 'selfEnergy',
    target: 'energyOwner',
    applyMode: 'increase',
  },
};

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
          stateEffectTrackKeys: ['enemyHpDamage'],
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
          stateEffectTrackKeys: ['selfEnergyChange'],
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
          stateEffectTrackKeys: ['enemyToughnessDamage'],
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
          stateEffectTrackKeys: ['selfEnergyChange'],
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
          stateEffectTrackKeys: TRACK_KEYS,
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
        stateEffect: THREE_VALUE_STATE_EFFECT_BY_TRACK_KEY.enemyHpDamage,
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
        stateEffect: THREE_VALUE_STATE_EFFECT_BY_TRACK_KEY.enemyToughnessDamage,
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
        stateEffect: THREE_VALUE_STATE_EFFECT_BY_TRACK_KEY.selfEnergyChange,
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

export function resolveThreeValueMechanicsProfileSelection(
  selection,
  registeredProfiles = []
) {
  const normalizedSelection =
    normalizeWorkbenchMechanicsProfileSelection(selection);
  const profiles = [
    DEFAULT_THREE_VALUE_MECHANICS_PROFILE,
    ...normalizeRegisteredProfiles(registeredProfiles),
  ];
  const selectedProfile = profiles.find(
    profile =>
      profile?.profileId === normalizedSelection.profileId &&
      Number(profile?.profileVersion) === normalizedSelection.profileVersion
  );
  const resolution = resolveThreeValueMechanicsProfile(selectedProfile);
  return {
    ...resolution,
    selection: normalizedSelection,
    fallback: selectedProfile ? resolution.fallback : true,
    fallbackReason: selectedProfile
      ? resolution.fallbackReason
      : 'mechanics-profile-not-registered',
  };
}

function normalizeRegisteredProfiles(registeredProfiles) {
  if (registeredProfiles instanceof Map) {
    return [...registeredProfiles.values()];
  }
  if (Array.isArray(registeredProfiles)) {
    return registeredProfiles;
  }
  return registeredProfiles && typeof registeredProfiles === 'object'
    ? Object.values(registeredProfiles)
    : [];
}

export function validateThreeValueMechanicsProfile(profile) {
  const issues = [];
  if (profile?.contractName !== THREE_VALUE_MECHANICS_PROFILE_CONTRACT_NAME) {
    issues.push('contract-name-invalid');
  }
  if (
    Number(profile?.contractVersion) !==
    THREE_VALUE_MECHANICS_PROFILE_CONTRACT_VERSION
  ) {
    issues.push('contract-version-invalid');
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
    for (const trackKey of capability?.trackKeys ?? []) {
      if (
        !resolveThreeValueStateEffectDeclaration(profile, capability, trackKey)
          .ready
      ) {
        issues.push(
          `operand-state-effect-invalid:${kind || 'unknown'}:${trackKey}`
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

export function resolveThreeValueStateEffectDeclaration(
  profile,
  capability,
  trackKey
) {
  const expected = THREE_VALUE_STATE_EFFECT_BY_TRACK_KEY[trackKey] ?? null;
  const step = [...(capability?.steps ?? [])]
    .reverse()
    .find(item => item?.stateEffectTrackKeys?.includes(trackKey));
  const declaration = profile?.tracks?.[trackKey]?.stateEffect ?? null;
  const ready = Boolean(
    expected &&
    declaration &&
    Object.keys(expected).every(key => declaration[key] === expected[key])
  );
  return {
    ready,
    stepKey: step?.key ?? null,
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
