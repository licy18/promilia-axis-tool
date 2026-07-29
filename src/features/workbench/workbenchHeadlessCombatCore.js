import { getWorkbenchGameData } from '../../domain/workbenchProjectFactory';
import { DEFAULT_THREE_VALUE_MECHANICS_PROFILE_CATALOG } from '../../simulation/mechanics/threeValueMechanicsProfileCatalog';
import { createCanonicalHeadlessCombatCore } from '../../simulation/headless/canonicalHeadlessCombatCore';

export const WORKBENCH_HEADLESS_COMBAT_CORE = createCanonicalHeadlessCombatCore(
  {
    gameData: getWorkbenchGameData(),
    compileOptions: {
      threeValueMechanicsProfileCatalog:
        DEFAULT_THREE_VALUE_MECHANICS_PROFILE_CATALOG,
    },
  }
);

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
