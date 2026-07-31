import { getWorkbenchGameData } from '../../domain/workbenchProjectFactory';
import { DEFAULT_THREE_VALUE_MECHANICS_PROFILE_CATALOG } from '../mechanics/threeValueMechanicsProfileCatalog';
import { createCanonicalHeadlessCombatCore } from './canonicalHeadlessCombatCore';

export const DEFAULT_HEADLESS_COMBAT_CORE = createCanonicalHeadlessCombatCore({
  gameData: getWorkbenchGameData(),
  compileOptions: {
    threeValueMechanicsProfileCatalog:
      DEFAULT_THREE_VALUE_MECHANICS_PROFILE_CATALOG,
  },
});
