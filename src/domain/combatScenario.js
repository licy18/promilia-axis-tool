import { normalizeCombatCriticalScenario } from './combatCriticalPolicy';
import { normalizeOptimizationScenarioPolicyBinding } from '../optimization-scenario/optimizationScenarioPolicy';

export const DEFAULT_PROJECTILE_TARGET_DISTANCE = 0;

export const DEFAULT_COMBAT_SCENARIO = Object.freeze({
  projectile: Object.freeze({
    targetDistance: DEFAULT_PROJECTILE_TARGET_DISTANCE,
    defaultWillHit: true,
  }),
  critical: Object.freeze(normalizeCombatCriticalScenario()),
});

export function normalizeCombatScenario(value = null) {
  const projectile = value?.projectile ?? {};
  return {
    projectile: {
      targetDistance: nonNegativeNumberOrDefault(
        projectile.targetDistance,
        DEFAULT_PROJECTILE_TARGET_DISTANCE
      ),
      defaultWillHit:
        projectile.defaultWillHit == null
          ? DEFAULT_COMBAT_SCENARIO.projectile.defaultWillHit
          : Boolean(projectile.defaultWillHit),
    },
    critical: normalizeCombatCriticalScenario(value?.critical),
    ...(value?.pickups == null
      ? {}
      : { pickups: normalizeCombatPickupPolicy(value.pickups) }),
    ...(value?.optimizationScenarioPolicy == null
      ? {}
      : {
          optimizationScenarioPolicy:
            normalizeOptimizationScenarioPolicyBinding(
              value.optimizationScenarioPolicy
            ),
        }),
    ...(value?.objectiveContract == null
      ? {}
      : { objectiveContract: structuredClone(value.objectiveContract) }),
    ...(value?.target == null
      ? {}
      : { target: normalizeCombatTargetPolicy(value.target) }),
  };
}

export function normalizeCombatPickupPolicy(value = null) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    policyId: String(source.policyId ?? ''),
    policyVersion: positiveIntegerOrDefault(source.policyVersion, 1),
    policyHash: String(source.policyHash ?? ''),
    autoCollect: source.autoCollect === true,
    movementPolicy:
      source.movementPolicy === 'explicit-scenario-movement'
        ? 'explicit-scenario-movement'
        : 'no-implicit-movement',
    collectionPolicy:
      source.collectionPolicy === 'explicit-collision'
        ? 'explicit-collision'
        : 'owner-source-action-absorb-only',
    sameFrameSpawnPolicy:
      source.sameFrameSpawnPolicy === 'include-same-frame'
        ? 'include-same-frame'
        : 'exclude-same-frame-fail-closed',
    sameFrameExpiryPolicy: 'expire-before-absorb',
    ...(Number.isFinite(Number(source.distance)) && Number(source.distance) >= 0
      ? { distance: Number(source.distance) }
      : {}),
  };
}

export function normalizeCombatTargetPolicy(value = null) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    hpMode: source.hpMode === 'infinite' ? 'infinite' : 'finite',
    toughnessMode: source.toughnessMode === 'disabled' ? 'disabled' : 'enabled',
    breakMode: source.breakMode === 'disabled' ? 'disabled' : 'enabled',
    deathTruncation:
      source.deathTruncation === 'disabled' ? 'disabled' : 'enabled',
  };
}

function nonNegativeNumberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function positiveIntegerOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}
