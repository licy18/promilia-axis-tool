import { sha256Utf8 } from '../domain/headlessAssumptionContract.js';
import { AZPR_DEFAULT_EFFECTIVE_MAX_SP } from '../domain/spUnitContract.js';
import { stableStringify } from '../simulation/headless/canonicalSerialization.js';

export const M12C_INITIAL_STATE_SCHEMA_VERSION = 1;
export const M12C_INITIAL_STATE_CONTRACT_NAME = 'AzPrM12CInitialStatePreset';
export const M12C_INITIAL_STATE_POLICY_ID = 'm12c-initial-state-v1';
export const M12C_INITIAL_STATE_POLICY_VERSION = '1.0.0';
export const M12C_SCENARIO_POLICY_ID = 'm12c-zero-distance-passive-boss-v1';
export const M12C_RUBY_AMMO_RESOURCE_IDENTITY =
  'actor:103002:element:103002047';

const CYCLE_OBJECTIVES = new Set([
  'cycle-dps-no-toughness',
  'cycle-dps-with-toughness',
]);
const KILL_OBJECTIVE = 'fastest-kill';
const BINDING_KEYS = Object.freeze([
  'schemaVersion',
  'contractName',
  'policyId',
  'policyVersion',
  'policyHash',
  'presetId',
  'objectiveId',
  'objectiveScope',
  'mechanicsPackageId',
  'mechanicsPackageHash',
  'presetHash',
]);
const INITIAL_STATE_KEYS = new Set([
  'schemaVersion',
  'contractName',
  'sourceKind',
  'status',
  'source',
  'controlledActor',
  'enemy',
  'selfEnergyByActor',
  'kiboEnergyBySlot',
  'actorVitalsByActor',
  'kiboVitalsBySlot',
  'activeEffects',
  'tuningMarks',
  'specialResourcesByActor',
  'applied',
]);

const POLICY_PAYLOAD = Object.freeze({
  schemaVersion: M12C_INITIAL_STATE_SCHEMA_VERSION,
  contractName: M12C_INITIAL_STATE_CONTRACT_NAME,
  policyId: M12C_INITIAL_STATE_POLICY_ID,
  policyVersion: M12C_INITIAL_STATE_POLICY_VERSION,
  actorSp: {
    sourceField: 'scenario.team[].initialSp',
    minimum: 0,
    maximum: AZPR_DEFAULT_EFFECTIVE_MAX_SP,
    inputStep: 1,
  },
  kiboSp: {
    sourceField: 'scenario.initialRuntimeState.kiboEnergyBySlot',
    minimum: 0,
    maximum: AZPR_DEFAULT_EFFECTIVE_MAX_SP,
    inputStep: 1,
  },
  cycle: {
    objectiveIds: [...CYCLE_OBJECTIVES],
    tuningMarks: 'source-profile-full-duration-at-frame-zero',
    specialResources: 'scenario-configurable-source-profiles-only',
  },
  kill: {
    objectiveIds: [KILL_OBJECTIVE],
    tuningMarks: 'fixed-zero',
    specialResources: [M12C_RUBY_AMMO_RESOURCE_IDENTITY],
  },
  forbiddenRuntimeState: [
    'enemy',
    'selfEnergyByActor',
    'actorVitalsByActor',
    'kiboVitalsBySlot',
    'activeEffects',
    'source.boundaryId',
    'cooldown-progress',
    'pending-events',
  ],
});

export const M12C_INITIAL_STATE_POLICY_HASH = sha256Utf8(
  stableStringify(POLICY_PAYLOAD)
);

export function isM12cFormalInitialStateRequired(scenario = {}) {
  return (
    scenario?.optimizationQualification?.mode === 'formal' &&
    scenario?.optimizationScenarioPolicy?.policyId === M12C_SCENARIO_POLICY_ID
  );
}

export function normalizeM12cInitialStatePresetBinding(value = {}) {
  const source = isRecord(value) ? value : {};
  return {
    schemaVersion: integerOrNull(source.schemaVersion),
    contractName: textOrNull(source.contractName),
    policyId: textOrNull(source.policyId),
    policyVersion: textOrNull(source.policyVersion),
    policyHash: textOrNull(source.policyHash),
    presetId: textOrNull(source.presetId),
    objectiveId: textOrNull(source.objectiveId),
    objectiveScope: textOrNull(source.objectiveScope),
    mechanicsPackageId: textOrNull(source.mechanicsPackageId),
    mechanicsPackageHash: textOrNull(source.mechanicsPackageHash),
    presetHash: textOrNull(source.presetHash),
  };
}

export function validateM12cInitialStatePresetBindingShape(value = {}) {
  const binding = normalizeM12cInitialStatePresetBinding(value);
  const issues = [];
  if (binding.schemaVersion !== M12C_INITIAL_STATE_SCHEMA_VERSION) {
    issues.push(
      issue(
        'm12c-initial-state-schema-version-invalid',
        'scenario.initialStatePreset.schemaVersion',
        'M12-C initial-state schema version is invalid'
      )
    );
  }
  if (binding.contractName !== M12C_INITIAL_STATE_CONTRACT_NAME) {
    issues.push(
      issue(
        'm12c-initial-state-contract-name-invalid',
        'scenario.initialStatePreset.contractName',
        'M12-C initial-state contract name is invalid'
      )
    );
  }
  if (binding.policyId !== M12C_INITIAL_STATE_POLICY_ID) {
    issues.push(
      issue(
        'm12c-initial-state-policy-id-invalid',
        'scenario.initialStatePreset.policyId',
        'M12-C initial-state policy identity is invalid'
      )
    );
  }
  if (binding.policyVersion !== M12C_INITIAL_STATE_POLICY_VERSION) {
    issues.push(
      issue(
        'm12c-initial-state-policy-version-invalid',
        'scenario.initialStatePreset.policyVersion',
        'M12-C initial-state policy version is invalid'
      )
    );
  }
  if (binding.policyHash !== M12C_INITIAL_STATE_POLICY_HASH) {
    issues.push(
      issue(
        'm12c-initial-state-policy-hash-invalid',
        'scenario.initialStatePreset.policyHash',
        'M12-C initial-state policy hash is invalid'
      )
    );
  }
  for (const key of [
    'presetId',
    'objectiveId',
    'objectiveScope',
    'mechanicsPackageId',
    'mechanicsPackageHash',
    'presetHash',
  ]) {
    if (!binding[key]) {
      issues.push(
        issue(
          `m12c-initial-state-${key}-required`,
          `scenario.initialStatePreset.${key}`,
          `M12-C initial-state ${key} is required`
        )
      );
    }
  }
  const actualKeys = isRecord(value) ? Object.keys(value).sort() : [];
  const expectedKeys = [...BINDING_KEYS].sort();
  if (actualKeys.join('|') !== expectedKeys.join('|')) {
    issues.push(
      issue(
        'm12c-initial-state-binding-shape-invalid',
        'scenario.initialStatePreset',
        'M12-C initial-state binding has unexpected or missing fields'
      )
    );
  }
  return { valid: issues.length === 0, issues, binding };
}

export function createM12cInitialStatePresetBinding({
  presetId,
  objectiveId,
  team,
  initialRuntimeState,
  mechanicsPackage,
} = {}) {
  const analysis = analyzeM12cInitialState({
    presetId,
    objectiveId,
    team,
    initialRuntimeState,
    mechanicsPackage,
  });
  if (analysis.issues.length > 0) {
    throw new Error(
      `Invalid M12-C initial state: ${analysis.issues
        .map(entry => entry.code)
        .join(', ')}`
    );
  }
  return analysis.expectedBinding;
}

export function validateM12cInitialStatePreset({
  binding,
  objectiveId,
  team,
  initialRuntimeState,
  mechanicsPackage,
} = {}) {
  const shape = validateM12cInitialStatePresetBindingShape(binding);
  const analysis = analyzeM12cInitialState({
    presetId: shape.binding.presetId,
    objectiveId,
    team,
    initialRuntimeState,
    mechanicsPackage,
  });
  const issues = [...shape.issues, ...analysis.issues];
  if (analysis.expectedBinding) {
    for (const key of BINDING_KEYS) {
      if (shape.binding[key] !== analysis.expectedBinding[key]) {
        issues.push(
          issue(
            `m12c-initial-state-binding-${key}-mismatch`,
            `scenario.initialStatePreset.${key}`,
            `M12-C initial-state ${key} does not match the authoritative projection`
          )
        );
      }
    }
  }
  return {
    valid: issues.length === 0,
    issues: dedupeIssues(issues),
    binding: shape.binding,
    expectedBinding: analysis.expectedBinding,
    projection: analysis.projection,
  };
}

function analyzeM12cInitialState({
  presetId,
  objectiveId,
  team,
  initialRuntimeState,
  mechanicsPackage,
}) {
  const issues = [];
  const objectiveScope = resolveObjectiveScope(objectiveId);
  if (!objectiveScope) {
    issues.push(
      issue(
        'm12c-initial-state-objective-invalid',
        'scenario.initialStatePreset.objectiveId',
        `Unsupported M12-C objective: ${objectiveId ?? 'missing'}`
      )
    );
  }
  if (!textOrNull(presetId)) {
    issues.push(
      issue(
        'm12c-initial-state-preset-id-required',
        'scenario.initialStatePreset.presetId',
        'M12-C initial-state preset identity is required'
      )
    );
  }
  if (!isRecord(mechanicsPackage)) {
    issues.push(
      issue(
        'm12c-initial-state-mechanics-package-required',
        'dataIdentity',
        'Verified mechanics package is required for M12-C initial-state validation'
      )
    );
  }

  const slots = Array.isArray(team) ? team : [];
  const slotById = new Map();
  const slotByCharacterId = new Map();
  for (const slot of slots) {
    const slotId = textOrNull(slot?.slotId);
    const characterId = positiveIntegerOrNull(slot?.characterId);
    if (!slotId || !characterId) continue;
    slotById.set(slotId, slot);
    slotByCharacterId.set(characterId, slot);
  }
  const state = isRecord(initialRuntimeState) ? initialRuntimeState : {};
  for (const key of Object.keys(state)) {
    if (!INITIAL_STATE_KEYS.has(key)) {
      issues.push(
        issue(
          'm12c-initial-state-field-forbidden',
          `scenario.initialRuntimeState.${key}`,
          `Initial runtime field is not allowed by M12-C v1: ${key}`
        )
      );
    }
  }
  validateControlledActor(state.controlledActor, slotByCharacterId, issues);
  validateForbiddenState(state, issues);

  const actorSp = slots
    .map(slot => {
      const currentValue = numberOrDefault(slot?.initialSp, 0);
      if (!isSteppedValue(currentValue, 0, AZPR_DEFAULT_EFFECTIVE_MAX_SP, 1)) {
        issues.push(
          issue(
            'm12c-initial-state-actor-sp-out-of-range',
            `scenario.team.${textOrNull(slot?.slotId) ?? 'unknown'}.initialSp`,
            'Actor initial SP must be an integer from 0 through 100'
          )
        );
      }
      return {
        slotId: textOrNull(slot?.slotId),
        currentValue,
      };
    })
    .sort(compareBy('slotId'));

  const kiboSp = [];
  const usedKiboSlots = new Set();
  for (const [index, row] of arrayOrEmpty(state.kiboEnergyBySlot).entries()) {
    const slotId = textOrNull(row?.slotId);
    const slot = slotById.get(slotId);
    const equippedKiboId = resolveEquippedKiboId(slot);
    const currentValue = numberOrNull(row?.currentValue);
    if (!slot || usedKiboSlots.has(slotId)) {
      issues.push(
        issue(
          'm12c-initial-state-kibo-slot-invalid',
          `scenario.initialRuntimeState.kiboEnergyBySlot.${index}.slotId`,
          'Kibo SP must reference one unique current team slot'
        )
      );
      continue;
    }
    usedKiboSlots.add(slotId);
    if (
      !equippedKiboId ||
      Number(row?.kiboId) !== equippedKiboId ||
      (row?.characterId != null &&
        Number(row.characterId) !== Number(slot.characterId)) ||
      (textOrNull(row?.actorId) &&
        textOrNull(row.actorId) !== `actor-${Number(slot.characterId)}`)
    ) {
      issues.push(
        issue(
          'm12c-initial-state-kibo-binding-mismatch',
          `scenario.initialRuntimeState.kiboEnergyBySlot.${index}`,
          'Kibo SP does not match the Kibo equipped in the referenced actor slot'
        )
      );
    }
    if (
      !isSteppedValue(currentValue, 0, AZPR_DEFAULT_EFFECTIVE_MAX_SP, 1) ||
      (row?.maxValue != null &&
        Number(row.maxValue) !== AZPR_DEFAULT_EFFECTIVE_MAX_SP)
    ) {
      issues.push(
        issue(
          'm12c-initial-state-kibo-sp-out-of-range',
          `scenario.initialRuntimeState.kiboEnergyBySlot.${index}.currentValue`,
          'Kibo initial SP must be an integer from 0 through 100 with authoritative maxValue 100'
        )
      );
    }
    kiboSp.push({ slotId, currentValue });
  }
  kiboSp.sort(compareBy('slotId'));

  const tuningMarks = validateAndProjectTuningMarks({
    rows: state.tuningMarks,
    objectiveScope,
    mechanicsPackage,
    issues,
  });
  const specialResources = validateAndProjectSpecialResources({
    rows: state.specialResourcesByActor,
    objectiveScope,
    slotByCharacterId,
    mechanicsPackage,
    issues,
  });
  const projection = {
    policyId: M12C_INITIAL_STATE_POLICY_ID,
    policyVersion: M12C_INITIAL_STATE_POLICY_VERSION,
    objectiveScope,
    mechanicsPackageId: textOrNull(mechanicsPackage?.packageId),
    mechanicsPackageHash: textOrNull(mechanicsPackage?.packageHash),
    actorSp,
    kiboSp,
    tuningMarks,
    specialResources,
  };
  const expectedBinding = objectiveScope
    ? {
        schemaVersion: M12C_INITIAL_STATE_SCHEMA_VERSION,
        contractName: M12C_INITIAL_STATE_CONTRACT_NAME,
        policyId: M12C_INITIAL_STATE_POLICY_ID,
        policyVersion: M12C_INITIAL_STATE_POLICY_VERSION,
        policyHash: M12C_INITIAL_STATE_POLICY_HASH,
        presetId: textOrNull(presetId),
        objectiveId: textOrNull(objectiveId),
        objectiveScope,
        mechanicsPackageId: projection.mechanicsPackageId,
        mechanicsPackageHash: projection.mechanicsPackageHash,
        presetHash: sha256Utf8(stableStringify(projection)),
      }
    : null;
  return { issues: dedupeIssues(issues), projection, expectedBinding };
}

function validateControlledActor(value, slotByCharacterId, issues) {
  const characterId = positiveIntegerOrNull(value?.characterId);
  const actorId = textOrNull(value?.actorId);
  if (!characterId || !actorId) {
    issues.push(
      issue(
        'm12c-initial-state-controlled-actor-required',
        'scenario.initialRuntimeState.controlledActor',
        'M12-C requires an explicit initial controlled actor'
      )
    );
    return;
  }
  if (
    !slotByCharacterId.has(characterId) ||
    actorId !== `actor-${characterId}`
  ) {
    issues.push(
      issue(
        'm12c-initial-state-controlled-actor-not-in-team',
        'scenario.initialRuntimeState.controlledActor',
        'Initial controlled actor must identify one current team member'
      )
    );
  }
}

function validateForbiddenState(state, issues) {
  if (isRecord(state.source) && Object.values(state.source).some(hasValue)) {
    issues.push(
      issue(
        'm12c-initial-state-inherited-boundary-forbidden',
        'scenario.initialRuntimeState.source',
        'M12-C presets cannot inherit a prior runtime boundary'
      )
    );
  }
  if (isRecord(state.enemy) && Object.keys(state.enemy).length > 0) {
    issues.push(
      issue(
        'm12c-initial-state-enemy-state-forbidden',
        'scenario.initialRuntimeState.enemy',
        'Enemy state is fixed by the M12-C objective and cannot be preset'
      )
    );
  }
  for (const field of [
    'selfEnergyByActor',
    'actorVitalsByActor',
    'kiboVitalsBySlot',
    'activeEffects',
  ]) {
    if (arrayOrEmpty(state[field]).length > 0) {
      issues.push(
        issue(
          'm12c-initial-state-runtime-state-forbidden',
          `scenario.initialRuntimeState.${field}`,
          `${field} is not an allowed M12-C v1 preset field`
        )
      );
    }
  }
}

function validateAndProjectTuningMarks({
  rows,
  objectiveScope,
  mechanicsPackage,
  issues,
}) {
  const sourceRows = arrayOrEmpty(rows);
  if (objectiveScope === 'kill' && sourceRows.length > 0) {
    issues.push(
      issue(
        'm12c-initial-state-kill-marks-must-be-zero',
        'scenario.initialRuntimeState.tuningMarks',
        'Fastest-kill presets must start with zero tuning marks'
      )
    );
    return [];
  }
  const profileByMarkId = new Map(
    arrayOrEmpty(mechanicsPackage?.tuningMechanicsCatalog?.profiles).map(
      profile => [Number(profile.markId), profile]
    )
  );
  const used = new Set();
  return sourceRows
    .flatMap((row, index) => {
      const markId = positiveIntegerOrNull(row?.markId);
      const profile = profileByMarkId.get(markId);
      const layers = arrayOrEmpty(row?.layers);
      if (!profile || used.has(markId)) {
        issues.push(
          issue(
            'm12c-initial-state-mark-identity-invalid',
            `scenario.initialRuntimeState.tuningMarks.${index}.markId`,
            'Tuning mark must reference one unique verified mark profile'
          )
        );
        return [];
      }
      used.add(markId);
      if (
        layers.length < 1 ||
        layers.length > Number(profile.maxStacks) ||
        Number(row?.decayRemainingMs) !== Number(profile.layerDurationMs) ||
        Number(row?.heldReadyRemainingMs ?? 0) !== 0 ||
        (textOrNull(row?.profileKey) &&
          textOrNull(row.profileKey) !== textOrNull(profile.key))
      ) {
        issues.push(
          issue(
            'm12c-initial-state-mark-state-invalid',
            `scenario.initialRuntimeState.tuningMarks.${index}`,
            'Cycle tuning marks must start within source max stacks and full fresh duration semantics'
          )
        );
      }
      return [
        {
          markId,
          profileKey: textOrNull(profile.key),
          stackCount: layers.length,
          decayRemainingMs: Number(profile.layerDurationMs),
          sourceIdentity: textOrNull(profile.sourceIdentity),
        },
      ];
    })
    .sort((left, right) => left.markId - right.markId);
}

function validateAndProjectSpecialResources({
  rows,
  objectiveScope,
  slotByCharacterId,
  mechanicsPackage,
  issues,
}) {
  const profileByIdentity = new Map(
    arrayOrEmpty(mechanicsPackage?.specialResourceCatalog?.profiles).map(
      profile => [String(profile.resourceIdentity), profile]
    )
  );
  const used = new Set();
  return arrayOrEmpty(rows)
    .flatMap((row, index) => {
      const identity = textOrNull(row?.resourceIdentity);
      const profile = profileByIdentity.get(identity);
      const ownerId = positiveIntegerOrNull(
        row?.characterId ?? profile?.ownerId
      );
      const currentValue = numberOrNull(row?.currentValue);
      const path = `scenario.initialRuntimeState.specialResourcesByActor.${index}`;
      if (
        !identity ||
        !profile ||
        used.has(identity) ||
        !ownerId ||
        !slotByCharacterId.has(ownerId) ||
        Number(profile.ownerId) !== ownerId ||
        textOrNull(row?.actorId) !== `actor-${ownerId}`
      ) {
        issues.push(
          issue(
            'm12c-initial-state-special-resource-binding-invalid',
            path,
            'Special resource must bind one verified resource owned by a current team actor'
          )
        );
        return [];
      }
      used.add(identity);
      const allowed =
        objectiveScope === 'cycle'
          ? profile.scenarioConfigurable === true
          : identity === M12C_RUBY_AMMO_RESOURCE_IDENTITY;
      if (!allowed) {
        issues.push(
          issue(
            objectiveScope === 'kill'
              ? 'm12c-initial-state-kill-special-resource-forbidden'
              : 'm12c-initial-state-cycle-special-resource-forbidden',
            path,
            'Special resource is not allowed by the selected M12-C objective scope'
          )
        );
      }
      if (
        !isSteppedValue(
          currentValue,
          0,
          Number(profile.capacity),
          Number(profile.inputStep)
        ) ||
        (row?.maxValue != null &&
          Number(row.maxValue) !== Number(profile.capacity)) ||
        (row?.inputStep != null &&
          Number(row.inputStep) !== Number(profile.inputStep)) ||
        (row?.scenarioConfigurable != null && row.scenarioConfigurable !== true)
      ) {
        issues.push(
          issue(
            'm12c-initial-state-special-resource-value-invalid',
            path,
            'Special resource value, maximum, step, or configurability does not match source'
          )
        );
      }
      const activeStates = validateAndProjectActiveResourceStates({
        rows: row?.activeStates,
        profile,
        path,
        objectiveScope,
        issues,
      });
      return [
        {
          actorId: `actor-${ownerId}`,
          characterId: ownerId,
          resourceIdentity: identity,
          currentValue,
          capacity: Number(profile.capacity),
          inputStep: Number(profile.inputStep),
          activeStates,
          sourceIdentity: textOrNull(profile.sourceIdentity),
        },
      ];
    })
    .sort(compareBy('resourceIdentity'));
}

function validateAndProjectActiveResourceStates({
  rows,
  profile,
  path,
  objectiveScope,
  issues,
}) {
  const sourceRows = arrayOrEmpty(rows);
  if (objectiveScope === 'kill' && sourceRows.length > 0) {
    issues.push(
      issue(
        'm12c-initial-state-kill-active-resource-state-forbidden',
        `${path}.activeStates`,
        'Fastest-kill v1 does not allow timed special-resource states'
      )
    );
    return [];
  }
  const stateByElementId = new Map(
    arrayOrEmpty(profile?.stateElements).map(state => [
      Number(state.elementId),
      state,
    ])
  );
  const used = new Set();
  return sourceRows
    .flatMap((row, index) => {
      const elementId = positiveIntegerOrNull(row?.elementId);
      const state = stateByElementId.get(elementId);
      const remainingDurationMs = numberOrNull(row?.remainingDurationMs);
      if (
        !state ||
        used.has(elementId) ||
        !remainingDurationMs ||
        remainingDurationMs > Number(state.durationMs) ||
        textOrNull(row?.sourceIdentity) !== textOrNull(state.sourceIdentity)
      ) {
        issues.push(
          issue(
            'm12c-initial-state-active-resource-state-invalid',
            `${path}.activeStates.${index}`,
            'Timed resource state must bind an exact source state and remaining duration'
          )
        );
        return [];
      }
      used.add(elementId);
      return [
        {
          elementId,
          remainingDurationMs,
          sourceIdentity: textOrNull(state.sourceIdentity),
        },
      ];
    })
    .sort((left, right) => left.elementId - right.elementId);
}

function resolveObjectiveScope(objectiveId) {
  if (CYCLE_OBJECTIVES.has(String(objectiveId))) return 'cycle';
  if (String(objectiveId) === KILL_OBJECTIVE) return 'kill';
  return null;
}

function resolveEquippedKiboId(slot) {
  return positiveIntegerOrNull(
    slot?.loadout?.kiboId ?? slot?.loadout?.kiboConfig?.kiboId
  );
}

function issue(code, path, message) {
  return { code, path, message };
}

function dedupeIssues(values) {
  return [
    ...new Map(
      values.map(entry => [`${entry.code}|${entry.path}`, entry])
    ).values(),
  ];
}

function compareBy(key) {
  return (left, right) =>
    String(left?.[key] ?? '').localeCompare(String(right?.[key] ?? ''), 'en');
}

function isSteppedValue(value, minimum, maximum, step) {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(minimum) ||
    !Number.isFinite(maximum) ||
    !Number.isFinite(step) ||
    step <= 0 ||
    value < minimum ||
    value > maximum
  ) {
    return false;
  }
  const offset = (value - minimum) / step;
  return Math.abs(offset - Math.round(offset)) < 1e-9;
}

function hasValue(value) {
  return value != null && value !== '' && value !== false && value !== 0;
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function textOrNull(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function numberOrNull(value) {
  const number = Number(value);
  return value != null && value !== '' && Number.isFinite(number)
    ? number
    : null;
}

function numberOrDefault(value, fallback) {
  return numberOrNull(value) ?? fallback;
}

function integerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
