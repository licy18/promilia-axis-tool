import { normalizeCombatCriticalScenario } from './combatCriticalPolicy';

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
  };
}

function nonNegativeNumberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}
