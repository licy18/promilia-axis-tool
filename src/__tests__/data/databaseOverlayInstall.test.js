import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { validateVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';

describe('database overlay install (P1-1)', () => {
  it('database-covered package passes install validation', () => {
    const root = process.cwd();
    const pkg = JSON.parse(
      fs.readFileSync(
        root + '/src/data/generated/verified-combat-mechanics-package.json',
        'utf8'
      )
    );
    const dbActions = JSON.parse(
      fs.readFileSync(root + '/src/data/database/actions.json', 'utf8')
    );
    const dbEffects = JSON.parse(
      fs.readFileSync(root + '/src/data/database/effects.json', 'utf8')
    );
    pkg.actionMappings = dbActions.actionMappings;
    pkg.controlBindings = dbActions.controlBindings;
    pkg.actionVariantControlBindings = dbActions.actionVariantControlBindings;
    pkg.semanticEffectCatalog = {
      ...pkg.semanticEffectCatalog,
      formulas: dbEffects.formulas,
      semanticEffects: dbEffects.semanticEffects,
    };
    const result = validateVerifiedCombatMechanicsPackage(pkg);
    expect(result).toMatchObject({
      valid: true,
      status: 'verified-combat-mechanics-package-valid',
    });
  });
});
