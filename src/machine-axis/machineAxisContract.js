export { MACHINE_AXIS_TRANSPORT_METADATA_KEY } from './machineAxisTransport';
import { validateRawMachineAxisSchema } from './machineAxisSchemaValidation';
import { normalizeOptimizationScenarioPolicyBinding } from '../optimization-scenario/optimizationScenarioPolicy';
import {
  normalizeMachineAxisEnemyProfile,
  validateMachineAxisEnemyProfile,
} from './machineAxisEnemyProfileContract';
import { validateMachineAxisObjectiveContract } from './machineAxisObjectiveContract';

export const MACHINE_AXIS_SCHEMA_VERSION = 1;
export const MACHINE_AXIS_CONTRACT_NAME = 'AzPrMachineAxis';
export const MACHINE_AXIS_KIND = 'azpr-machine-axis';
export const MACHINE_AXIS_SUPPORTED_FPS = 60;

export const MACHINE_AXIS_SCHEDULE_MODES = Object.freeze([
  'absolute',
  'after-previous-end',
  'after-action-end',
]);
export const MACHINE_AXIS_INTENT_KINDS = Object.freeze([
  'public-action',
  'switch',
  'wait',
]);
export const MACHINE_AXIS_OWNER_KINDS = Object.freeze([
  'actor',
  'kibo',
  'enemy',
  'system',
]);
export const MACHINE_AXIS_LANDED_MODES = Object.freeze([
  'inherit',
  'hit',
  'miss',
]);
export const MACHINE_AXIS_CRITICAL_MODES = Object.freeze([
  'inherit',
  'sampled',
  'expected',
  'critical',
  'non-critical',
]);

const SCENARIO_CRITICAL_POLICIES = new Set(
  MACHINE_AXIS_CRITICAL_MODES.filter(value => value !== 'inherit')
);
const SCHEDULE_MODES = new Set(MACHINE_AXIS_SCHEDULE_MODES);
const INTENT_KINDS = new Set(MACHINE_AXIS_INTENT_KINDS);
const OWNER_KINDS = new Set(MACHINE_AXIS_OWNER_KINDS);
const LANDED_MODES = new Set(MACHINE_AXIS_LANDED_MODES);
const CRITICAL_MODES = new Set(MACHINE_AXIS_CRITICAL_MODES);

export function normalizeMachineAxisContract(value = {}) {
  const source = isRecord(value) ? value : {};
  const scenario = isRecord(source.scenario) ? source.scenario : {};
  const actions = Array.isArray(source.actions) ? source.actions : [];
  return {
    schemaVersion: Number(source.schemaVersion) || MACHINE_AXIS_SCHEMA_VERSION,
    contractName: textOrNull(source.contractName) ?? MACHINE_AXIS_CONTRACT_NAME,
    kind: textOrNull(source.kind) ?? MACHINE_AXIS_KIND,
    dataIdentity: normalizeDataIdentity(source.dataIdentity),
    scenario: {
      id: textOrNull(scenario.id) ?? 'machine-axis-scenario',
      name: textOrNull(scenario.name) ?? 'Machine Axis Scenario',
      fps: positiveIntegerOrNull(scenario.fps) ?? MACHINE_AXIS_SUPPORTED_FPS,
      durationFrames:
        positiveIntegerOrNull(scenario.durationFrames) ??
        MACHINE_AXIS_SUPPORTED_FPS * 120,
      team: normalizeTeam(scenario.team),
      enemy: normalizeEnemy(scenario.enemy),
      initialRuntimeState: normalizePlainRecord(scenario.initialRuntimeState),
      projectile: normalizeProjectile(scenario.projectile),
      critical: normalizeCritical(scenario.critical),
      ...(scenario.optimizationScenarioPolicy == null
        ? {}
        : {
            optimizationScenarioPolicy:
              normalizeOptimizationScenarioPolicyBinding(
                scenario.optimizationScenarioPolicy
              ),
          }),
      ...(scenario.objectiveContract == null
        ? {}
        : { objectiveContract: structuredClone(scenario.objectiveContract) }),
      ...(scenario.optimizationQualification == null
        ? {}
        : {
            optimizationQualification: normalizeOptimizationQualification(
              scenario.optimizationQualification
            ),
          }),
      ...(scenario.cultivationProfile == null
        ? {}
        : {
            cultivationProfile: normalizeCultivationProfile(
              scenario.cultivationProfile
            ),
          }),
      ...(scenario.target == null
        ? {}
        : { target: normalizeTargetPolicy(scenario.target) }),
    },
    actions: actions.map((action, index) =>
      normalizeMachineAxisAction(action, index)
    ),
    metadata: normalizePlainRecord(source.metadata),
  };
}

export function validateMachineAxisContract(value = {}) {
  const issues = validateRawMachineAxisSchema(value);
  if (issues.some(issue => issue.severity === 'error')) {
    return {
      schemaVersion: MACHINE_AXIS_SCHEMA_VERSION,
      kind: 'azpr-machine-axis-contract-validation',
      valid: false,
      issues,
      normalized: null,
    };
  }
  if (!isRecord(value)) {
    issues.push(
      diagnostic(
        'machine-axis-contract-invalid',
        '',
        'Machine Axis input must be an object'
      )
    );
  }
  const normalized = normalizeMachineAxisContract(value);
  if (Number(value?.schemaVersion) !== MACHINE_AXIS_SCHEMA_VERSION) {
    issues.push(
      diagnostic(
        'machine-axis-schema-version-unsupported',
        'schemaVersion',
        `Unsupported Machine Axis schema version: ${value?.schemaVersion ?? 'missing'}`
      )
    );
  }
  if (value?.contractName !== MACHINE_AXIS_CONTRACT_NAME) {
    issues.push(
      diagnostic(
        'machine-axis-contract-name-unsupported',
        'contractName',
        `Unsupported Machine Axis contract: ${value?.contractName ?? 'missing'}`
      )
    );
  }
  if (value?.kind != null && value.kind !== MACHINE_AXIS_KIND) {
    issues.push(
      diagnostic(
        'machine-axis-kind-unsupported',
        'kind',
        `Unsupported Machine Axis kind: ${value.kind}`
      )
    );
  }
  validateDataIdentity(normalized.dataIdentity, issues);
  validateScenario(normalized.scenario, issues);
  validateActions(normalized.actions, issues);
  validateSampledSeed(normalized, issues);
  return {
    schemaVersion: MACHINE_AXIS_SCHEMA_VERSION,
    kind: 'azpr-machine-axis-contract-validation',
    valid: issues.every(issue => issue.severity !== 'error'),
    issues,
    normalized,
  };
}

export function resolveMachineAxisSchedules(
  actions,
  { resolveDurationFrames, scenarioDurationFrames = null } = {}
) {
  const source = Array.isArray(actions) ? actions : [];
  const issues = [];
  const byId = new Map(source.map(action => [action.id, action]));
  const resolved = new Map();
  const visiting = new Set();

  function resolve(action, index) {
    if (resolved.has(action.id)) return resolved.get(action.id);
    if (visiting.has(action.id)) {
      issues.push(
        diagnostic(
          'machine-axis-schedule-cycle',
          `actions.${index}.schedule`,
          `Schedule cycle includes action ${action.id}`,
          { actionId: action.id }
        )
      );
      return null;
    }
    visiting.add(action.id);
    const schedule = action.schedule;
    let startFrame = null;
    if (schedule.mode === 'absolute') {
      startFrame = schedule.frame;
    } else {
      const predecessor =
        schedule.mode === 'after-previous-end'
          ? (source[index - 1] ?? null)
          : (byId.get(schedule.actionId) ?? null);
      if (!predecessor) {
        issues.push(
          diagnostic(
            schedule.mode === 'after-previous-end'
              ? 'machine-axis-previous-action-missing'
              : 'machine-axis-schedule-reference-missing',
            `actions.${index}.schedule`,
            `Unable to resolve predecessor for action ${action.id}`,
            {
              actionId: action.id,
              relatedActionId: schedule.actionId ?? null,
            }
          )
        );
      } else {
        const predecessorIndex = source.indexOf(predecessor);
        const predecessorSchedule = resolve(predecessor, predecessorIndex);
        const durationFrames = normalizeDuration(
          resolveDurationFrames?.(predecessor, predecessorSchedule)
        );
        if (predecessorSchedule && durationFrames != null) {
          startFrame =
            predecessorSchedule.startFrame +
            durationFrames +
            schedule.offsetFrames;
        } else if (predecessorSchedule) {
          issues.push(
            diagnostic(
              'machine-axis-schedule-duration-unresolved',
              `actions.${index}.schedule`,
              `Predecessor duration is unresolved for action ${action.id}`,
              {
                actionId: action.id,
                relatedActionId: predecessor.id,
              }
            )
          );
        }
      }
    }
    visiting.delete(action.id);
    if (startFrame == null) return null;
    const result = {
      actionId: action.id,
      startFrame,
      sourceMode: schedule.mode,
      relatedActionId: schedule.actionId ?? null,
      offsetFrames: schedule.offsetFrames,
    };
    if (startFrame < 0) {
      issues.push(
        diagnostic(
          'machine-axis-schedule-start-before-zero',
          `actions.${index}.schedule`,
          `Action ${action.id} starts before frame zero`,
          { actionId: action.id, startFrame }
        )
      );
    }
    if (
      Number.isInteger(scenarioDurationFrames) &&
      startFrame > scenarioDurationFrames
    ) {
      issues.push(
        diagnostic(
          'machine-axis-schedule-start-after-horizon',
          `actions.${index}.schedule`,
          `Action ${action.id} starts after the scenario horizon`,
          { actionId: action.id, startFrame, scenarioDurationFrames }
        )
      );
    }
    const actionDurationFrames = normalizeDuration(
      resolveDurationFrames?.(action, result)
    );
    if (
      Number.isInteger(scenarioDurationFrames) &&
      actionDurationFrames != null &&
      startFrame <= scenarioDurationFrames &&
      startFrame + actionDurationFrames > scenarioDurationFrames
    ) {
      issues.push(
        diagnostic(
          'machine-axis-action-crosses-horizon',
          `actions.${index}.schedule`,
          `Action ${action.id} crosses the scenario horizon`,
          {
            actionId: action.id,
            startFrame,
            endFrame: startFrame + actionDurationFrames,
            durationFrames: actionDurationFrames,
            scenarioDurationFrames,
          }
        )
      );
    }
    resolved.set(action.id, result);
    return result;
  }

  const schedules = source.map((action, index) => resolve(action, index));
  return {
    valid: issues.length === 0 && schedules.every(Boolean),
    schedules,
    byActionId: Object.fromEntries(
      schedules.filter(Boolean).map(entry => [entry.actionId, entry])
    ),
    issues,
  };
}

export function createMachineAxisDiagnostic(code, path, message, details = {}) {
  return diagnostic(code, path, message, details);
}

function normalizeMachineAxisAction(value, index) {
  const source = isRecord(value) ? value : {};
  const owner = isRecord(source.owner) ? source.owner : {};
  const intent = isRecord(source.intent) ? source.intent : {};
  const schedule = isRecord(source.schedule) ? source.schedule : {};
  return {
    id: textOrNull(source.id) ?? `machine-action-${index + 1}`,
    owner: {
      kind: textOrNull(owner.kind) ?? 'actor',
      slotId: textOrNull(owner.slotId),
    },
    intent: {
      kind: textOrNull(intent.kind) ?? 'public-action',
      publicActionId: positiveIntegerOrNull(intent.publicActionId),
      actionKind: textOrNull(intent.actionKind),
      targetSlotId: textOrNull(intent.targetSlotId),
      durationFrames: nonNegativeIntegerOrNull(intent.durationFrames),
      level: positiveIntegerOrNull(intent.level),
      semanticVariant: normalizeSemanticVariant(intent.semanticVariant),
      attackInput: normalizeAttackInput(intent.attackInput),
    },
    schedule: {
      mode: textOrNull(schedule.mode) ?? 'absolute',
      frame: nonNegativeIntegerOrNull(schedule.frame),
      actionId: textOrNull(schedule.actionId),
      offsetFrames: integerOrNull(schedule.offsetFrames) ?? 0,
    },
    hitOverrides: normalizeHitOverrides(source.hitOverrides),
    note: textOrNull(source.note),
  };
}

function normalizeSemanticVariant(value) {
  if (!isRecord(value)) return null;
  const selectorIdentity = textOrNull(value.selectorIdentity);
  const publicVariantIndex = nonNegativeIntegerOrNull(value.publicVariantIndex);
  const chargeTier = positiveIntegerOrNull(value.chargeTier);
  const mode = ['press', 'hold'].includes(value.mode) ? value.mode : null;
  if (
    !selectorIdentity &&
    publicVariantIndex == null &&
    chargeTier == null &&
    !mode
  ) {
    return null;
  }
  return {
    selectorIdentity,
    selectorKind: textOrNull(value.selectorKind),
    publicVariantIndex,
    chargeTier,
    mode,
  };
}

function normalizeAttackInput(value) {
  if (!isRecord(value)) return null;
  const sequenceIndex = positiveIntegerOrNull(value.sequenceIndex);
  if (sequenceIndex == null) return null;
  return {
    sequenceIndex,
    groupId: textOrNull(value.groupId),
    contextActionId: textOrNull(value.contextActionId),
  };
}

function normalizeHitOverrides(value) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([identity, override]) => {
        const hitIdentity = textOrNull(identity);
        if (!hitIdentity || !isRecord(override)) return null;
        return [
          hitIdentity,
          {
            landed: textOrNull(override.landed) ?? 'inherit',
            criticalMode: textOrNull(override.criticalMode) ?? 'inherit',
            criticalRoll: integerOrNull(override.criticalRoll),
          },
        ];
      })
      .filter(Boolean)
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
  );
}

function normalizeDataIdentity(value) {
  const source = isRecord(value) ? value : {};
  return {
    verifiedMechanicsPackageId: textOrNull(source.verifiedMechanicsPackageId),
    verifiedMechanicsPackageHash: textOrNull(
      source.verifiedMechanicsPackageHash
    ),
    mechanicsProfileId: textOrNull(source.mechanicsProfileId),
    mechanicsProfileVersion: textOrNull(source.mechanicsProfileVersion),
  };
}

function normalizeTeam(value) {
  return (Array.isArray(value) ? value : []).map((entry, index) => {
    const source = isRecord(entry) ? entry : {};
    return {
      slotId: textOrNull(source.slotId) ?? `slot-${index + 1}`,
      characterId: positiveIntegerOrNull(source.characterId),
      level: positiveIntegerOrNull(source.level),
      initialSp: finiteNumberOrNull(source.initialSp),
      loadout: normalizePlainRecord(source.loadout),
      cultivation: normalizePlainRecord(source.cultivation),
    };
  });
}

function normalizeEnemy(value) {
  const source = isRecord(value) ? value : {};
  return {
    enemyId: positiveIntegerOrNull(source.enemyId),
    level: positiveIntegerOrNull(source.level),
    hpMultiplier: positiveNumberOrNull(source.hpMultiplier),
    defenseMultiplier: positiveNumberOrNull(source.defenseMultiplier),
    toughnessMultiplier: positiveNumberOrNull(source.toughnessMultiplier),
    initialToughnessRatio: finiteNumberOrNull(source.initialToughnessRatio),
    elementDefenseOverrides: normalizePlainRecord(
      source.elementDefenseOverrides
    ),
    ...(source.profile == null
      ? {}
      : { profile: normalizeMachineAxisEnemyProfile(source.profile) }),
  };
}

function normalizeProjectile(value) {
  const source = isRecord(value) ? value : {};
  return {
    targetDistance: nonNegativeNumberOrNull(source.targetDistance) ?? 0,
    defaultWillHit:
      source.defaultWillHit == null ? true : Boolean(source.defaultWillHit),
  };
}
function normalizeCritical(value) {
  const source = isRecord(value) ? value : {};
  return {
    policy: textOrNull(source.policy) ?? 'non-critical',
    seed:
      source.seed == null || source.seed === ''
        ? null
        : typeof source.seed === 'number'
          ? Math.trunc(source.seed)
          : String(source.seed),
  };
}

function normalizeTargetPolicy(value) {
  const source = isRecord(value) ? value : {};
  return {
    hpMode: textOrNull(source.hpMode) ?? 'finite',
    toughnessMode: textOrNull(source.toughnessMode) ?? 'enabled',
    breakMode: textOrNull(source.breakMode) ?? 'enabled',
    deathTruncation: textOrNull(source.deathTruncation) ?? 'enabled',
  };
}

function normalizeCultivationProfile(value) {
  const profile = structuredClone(value);
  if (!isRecord(profile) || !Array.isArray(profile.actors)) return profile;
  profile.actors = profile.actors.map(actor => {
    if (!isRecord(actor) || !isRecord(actor.kibo)) return actor;
    return {
      ...actor,
      kibo: {
        ...actor.kibo,
        dnaFactors:
          actor.kibo.dnaFactors === undefined ? [] : actor.kibo.dnaFactors,
      },
    };
  });
  return profile;
}

function normalizeOptimizationQualification(value) {
  const source = isRecord(value) ? value : {};
  return {
    mode: textOrNull(source.mode) ?? 'research',
    catalogHash: textOrNull(source.catalogHash),
  };
}

function validateDataIdentity(value, issues) {
  if (!value.verifiedMechanicsPackageId) {
    issues.push(
      diagnostic(
        'machine-axis-data-package-id-required',
        'dataIdentity.verifiedMechanicsPackageId',
        'verified mechanics package identity is required'
      )
    );
  }
  if (!value.verifiedMechanicsPackageHash) {
    issues.push(
      diagnostic(
        'machine-axis-data-package-hash-required',
        'dataIdentity.verifiedMechanicsPackageHash',
        'verified mechanics package hash is required'
      )
    );
  }
  if (!value.mechanicsProfileId) {
    issues.push(
      diagnostic(
        'machine-axis-mechanics-profile-id-required',
        'dataIdentity.mechanicsProfileId',
        'mechanics profile identity is required'
      )
    );
  }
}

function validateScenario(value, issues) {
  if (value.fps !== MACHINE_AXIS_SUPPORTED_FPS) {
    issues.push(
      diagnostic(
        'machine-axis-fps-unsupported',
        'scenario.fps',
        `Machine Axis currently supports only ${MACHINE_AXIS_SUPPORTED_FPS} FPS`,
        { actualFps: value.fps, supportedFps: MACHINE_AXIS_SUPPORTED_FPS }
      )
    );
  }
  if (value.durationFrames <= 0) {
    issues.push(
      diagnostic(
        'machine-axis-duration-invalid',
        'scenario.durationFrames',
        'durationFrames must be a positive integer'
      )
    );
  }
  if (value.team.length !== 3) {
    issues.push(
      diagnostic(
        'machine-axis-team-size-invalid',
        'scenario.team',
        'Machine Axis requires exactly three actor slots'
      )
    );
  }
  const slotIds = new Set();
  const characterIds = new Set();
  value.team.forEach((slot, index) => {
    if (!slot.characterId) {
      issues.push(
        diagnostic(
          'machine-axis-character-required',
          `scenario.team.${index}.characterId`,
          'team slot characterId is required'
        )
      );
    }
    if (slotIds.has(slot.slotId)) {
      issues.push(
        diagnostic(
          'machine-axis-team-slot-duplicate',
          `scenario.team.${index}.slotId`,
          `duplicate team slot: ${slot.slotId}`
        )
      );
    }
    if (slot.characterId && characterIds.has(slot.characterId)) {
      issues.push(
        diagnostic(
          'machine-axis-character-duplicate',
          `scenario.team.${index}.characterId`,
          `duplicate team character: ${slot.characterId}`
        )
      );
    }
    slotIds.add(slot.slotId);
    if (slot.characterId) characterIds.add(slot.characterId);
  });
  if (!value.enemy.enemyId) {
    issues.push(
      diagnostic(
        'machine-axis-enemy-required',
        'scenario.enemy.enemyId',
        'enemyId is required'
      )
    );
  }
  if (value.enemy.profile != null) {
    issues.push(
      ...validateMachineAxisEnemyProfile(value.enemy.profile, {
        scenarioEnemy: value.enemy,
      }).issues
    );
  }
  if (value.objectiveContract != null) {
    issues.push(
      ...validateMachineAxisObjectiveContract(
        value.objectiveContract
      ).issues.map(entry => ({
        severity: 'error',
        code: entry.code,
        path: `scenario.objectiveContract${entry.field ? `.${entry.field}` : ''}`,
        message: entry.message,
      }))
    );
  }
  if (!SCENARIO_CRITICAL_POLICIES.has(value.critical.policy)) {
    issues.push(
      diagnostic(
        'machine-axis-critical-policy-unsupported',
        'scenario.critical.policy',
        `unsupported critical policy: ${value.critical.policy}`
      )
    );
  }
}

function validateActions(actions, issues) {
  const ids = new Set();
  actions.forEach((action, index) => {
    const path = `actions.${index}`;
    if (ids.has(action.id)) {
      issues.push(
        diagnostic(
          'machine-axis-action-id-duplicate',
          `${path}.id`,
          `duplicate action id: ${action.id}`,
          { actionId: action.id }
        )
      );
    }
    ids.add(action.id);
    if (!OWNER_KINDS.has(action.owner.kind)) {
      issues.push(
        diagnostic(
          'machine-axis-owner-kind-unsupported',
          `${path}.owner.kind`,
          `unsupported owner kind: ${action.owner.kind}`,
          { actionId: action.id }
        )
      );
    }
    if (!action.owner.slotId && action.owner.kind !== 'system') {
      issues.push(
        diagnostic(
          'machine-axis-owner-slot-required',
          `${path}.owner.slotId`,
          'owner slotId is required',
          { actionId: action.id }
        )
      );
    }
    if (!INTENT_KINDS.has(action.intent.kind)) {
      issues.push(
        diagnostic(
          'machine-axis-intent-kind-unsupported',
          `${path}.intent.kind`,
          `unsupported action intent: ${action.intent.kind}`,
          { actionId: action.id }
        )
      );
    }
    validateIntent(action, index, issues);
    validateSchedule(action, index, ids, issues);
    validateHitOverrides(action, index, issues);
  });
}

function validateIntent(action, index, issues) {
  const path = `actions.${index}.intent`;
  if (action.intent.kind === 'public-action' && !action.intent.publicActionId) {
    issues.push(
      diagnostic(
        'machine-axis-public-action-id-required',
        `${path}.publicActionId`,
        'publicActionId is required for public actions',
        { actionId: action.id }
      )
    );
  }
  if (action.intent.kind === 'switch' && !action.intent.targetSlotId) {
    issues.push(
      diagnostic(
        'machine-axis-switch-target-required',
        `${path}.targetSlotId`,
        'targetSlotId is required for switch actions',
        { actionId: action.id }
      )
    );
  }
  if (action.intent.kind === 'wait' && action.intent.durationFrames == null) {
    issues.push(
      diagnostic(
        'machine-axis-wait-duration-required',
        `${path}.durationFrames`,
        'wait durationFrames is required',
        { actionId: action.id }
      )
    );
  }
}

function validateSchedule(action, index, knownIds, issues) {
  const path = `actions.${index}.schedule`;
  const schedule = action.schedule;
  if (!SCHEDULE_MODES.has(schedule.mode)) {
    issues.push(
      diagnostic(
        'machine-axis-schedule-mode-unsupported',
        `${path}.mode`,
        `unsupported schedule mode: ${schedule.mode}`,
        { actionId: action.id }
      )
    );
    return;
  }
  if (schedule.mode === 'absolute' && schedule.frame == null) {
    issues.push(
      diagnostic(
        'machine-axis-absolute-frame-required',
        `${path}.frame`,
        'absolute schedule requires frame',
        { actionId: action.id }
      )
    );
  }
  if (schedule.mode === 'after-previous-end' && index === 0) {
    issues.push(
      diagnostic(
        'machine-axis-previous-action-missing',
        path,
        'first action cannot use after-previous-end',
        { actionId: action.id }
      )
    );
  }
  if (
    schedule.mode === 'after-action-end' &&
    (!schedule.actionId || !knownIds.has(schedule.actionId))
  ) {
    issues.push(
      diagnostic(
        'machine-axis-schedule-reference-missing',
        `${path}.actionId`,
        `referenced action must precede ${action.id}`,
        {
          actionId: action.id,
          relatedActionId: schedule.actionId,
        }
      )
    );
  }
}

function validateHitOverrides(action, index, issues) {
  for (const [hitIdentity, override] of Object.entries(action.hitOverrides)) {
    const path = `actions.${index}.hitOverrides.${hitIdentity}`;
    if (!LANDED_MODES.has(override.landed)) {
      issues.push(
        diagnostic(
          'machine-axis-hit-landed-mode-unsupported',
          `${path}.landed`,
          `unsupported landed mode: ${override.landed}`,
          { actionId: action.id, hitIdentity }
        )
      );
    }
    if (!CRITICAL_MODES.has(override.criticalMode)) {
      issues.push(
        diagnostic(
          'machine-axis-hit-critical-mode-unsupported',
          `${path}.criticalMode`,
          `unsupported critical mode: ${override.criticalMode}`,
          { actionId: action.id, hitIdentity }
        )
      );
    }
    if (
      override.criticalRoll != null &&
      (override.criticalRoll < 0 || override.criticalRoll >= 10_000)
    ) {
      issues.push(
        diagnostic(
          'machine-axis-hit-critical-roll-out-of-range',
          `${path}.criticalRoll`,
          'criticalRoll must be an integer from 0 through 9999',
          { actionId: action.id, hitIdentity }
        )
      );
    }
  }
}

function validateSampledSeed(contract, issues) {
  const requiresSeed =
    contract.scenario.critical.policy === 'sampled' ||
    contract.actions.some(action =>
      Object.values(action.hitOverrides).some(
        override => override.criticalMode === 'sampled'
      )
    );
  if (requiresSeed && contract.scenario.critical.seed == null) {
    issues.push(
      diagnostic(
        'machine-axis-sampled-seed-required',
        'scenario.critical.seed',
        'sampled critical mode requires an explicit seed'
      )
    );
  }
}

function diagnostic(code, path, message, details = {}) {
  return {
    ...details,
    severity: 'error',
    code,
    path,
    message,
    actionId: details.actionId ?? null,
    hitIdentity: details.hitIdentity ?? null,
    relatedActionId: details.relatedActionId ?? null,
  };
}

function normalizePlainRecord(value) {
  return isRecord(value) ? { ...value } : {};
}

function normalizeDuration(value) {
  if (isRecord(value)) {
    return nonNegativeIntegerOrNull(value.durationFrames);
  }
  return nonNegativeIntegerOrNull(value);
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function textOrNull(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function finiteNumberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nonNegativeNumberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
function positiveNumberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function integerOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function nonNegativeIntegerOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function positiveIntegerOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
