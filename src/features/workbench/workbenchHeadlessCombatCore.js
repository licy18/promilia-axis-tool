import { DEFAULT_HEADLESS_COMBAT_CORE } from '../../simulation/headless/defaultHeadlessCombatCore';

export const WORKBENCH_HEADLESS_COMBAT_CORE = DEFAULT_HEADLESS_COMBAT_CORE;

export function compileWorkbenchHeadlessCombat(project, options = {}) {
  return WORKBENCH_HEADLESS_COMBAT_CORE.compile(
    {
      schemaVersion: 1,
      project,
    },
    options
  );
}

export function simulateWorkbenchHeadlessCombat(input, options = {}) {
  return WORKBENCH_HEADLESS_COMBAT_CORE.simulate(input, options);
}
