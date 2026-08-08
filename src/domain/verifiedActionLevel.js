export const VERIFIED_ACTION_LEVEL_MINIMUM = 1;
export const VERIFIED_ACTION_LEVEL_MAXIMUM = 12;
export const VERIFIED_ACTION_LEVEL_DEFAULT = 1;

export class VerifiedActionLevelContractError extends RangeError {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'VerifiedActionLevelContractError';
    this.code = code;
    this.details = details;
  }
}

export function resolveVerifiedActionLevel(action = {}) {
  const canonical = readExplicitLevel(action, 'level');
  const legacy = readExplicitLevel(action, 'skillLevel');

  if (!canonical.present && !legacy.present) {
    return {
      level: VERIFIED_ACTION_LEVEL_DEFAULT,
      source: 'verified-action-level-default',
      legacyFallback: false,
    };
  }

  const canonicalLevel = canonical.present
    ? normalizeExplicitLevel(canonical.value, 'action.level')
    : null;
  const legacyLevel = legacy.present
    ? normalizeExplicitLevel(legacy.value, 'action.skillLevel')
    : null;

  if (
    canonicalLevel != null &&
    legacyLevel != null &&
    canonicalLevel !== legacyLevel
  ) {
    throw new VerifiedActionLevelContractError(
      'verified-action-level-conflict',
      `Conflicting action levels: action.level=${canonicalLevel}, action.skillLevel=${legacyLevel}`,
      {
        canonicalField: 'action.level',
        canonicalLevel,
        legacyField: 'action.skillLevel',
        legacyLevel,
      }
    );
  }

  if (canonicalLevel != null) {
    return {
      level: canonicalLevel,
      source: 'action.level',
      legacyFallback: false,
      ...(legacyLevel == null ? {} : { legacyLevelStatus: 'consistent' }),
    };
  }

  return {
    level: legacyLevel,
    source: 'action.skillLevel',
    legacyFallback: true,
  };
}

export function resolveVerifiedActionLevelValue(action = {}) {
  return resolveVerifiedActionLevel(action).level;
}

function readExplicitLevel(action, field) {
  const value = action?.[field];
  return {
    present:
      Object.prototype.hasOwnProperty.call(action ?? {}, field) &&
      value != null,
    value,
  };
}

function normalizeExplicitLevel(value, field) {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < VERIFIED_ACTION_LEVEL_MINIMUM ||
    value > VERIFIED_ACTION_LEVEL_MAXIMUM
  ) {
    throw new VerifiedActionLevelContractError(
      'verified-action-level-invalid',
      `${field} must be an integer from ${VERIFIED_ACTION_LEVEL_MINIMUM} through ${VERIFIED_ACTION_LEVEL_MAXIMUM}`,
      {
        field,
        value,
        minimum: VERIFIED_ACTION_LEVEL_MINIMUM,
        maximum: VERIFIED_ACTION_LEVEL_MAXIMUM,
      }
    );
  }
  return value;
}
