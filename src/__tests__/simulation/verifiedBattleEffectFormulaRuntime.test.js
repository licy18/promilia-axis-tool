import { describe, expect, it } from 'vitest';
import verifiedCombatMechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  classifyVerifiedBattleEffectFormula,
  evaluateVerifiedBattleEffectFormula,
} from '../../simulation/mechanics/verifiedBattleEffectFormulaRuntime';

describe('verified Battle effect formula registry', () => {
  it('evaluates the verified literal A x G/10000 family through Q16.16', () => {
    const effect = createEffect({ a: 216, g: 5000 });

    expect(classifyVerifiedBattleEffectFormula(effect)).toMatchObject({
      family: 'literal-a-with-common-ratio',
      status: 'applied',
      applied: true,
    });
    expect(
      evaluateVerifiedBattleEffectFormula({ effect, level: 1 })
    ).toMatchObject({
      value: 108,
      raw: String(108 * 65536),
      reason: null,
    });
  });

  it('evaluates verified percent and source-tuning property families', () => {
    expect(
      evaluateVerifiedBattleEffectFormula({
        effect: createEffect({ a: 1000, baseFunctionId: 3 }),
      })
    ).toMatchObject({
      family: 'basis-point-property-a-with-common-ratio',
      value: 1000,
      reason: null,
    });
    expect(
      evaluateVerifiedBattleEffectFormula({
        effect: createEffect({ a: 1800, baseFunctionId: 2008 }),
        sourceActor: {
          stats: {
            tuningStrength: 100,
          },
        },
      })
    ).toMatchObject({
      family: 'source-tuning-ratio-with-common-ratio',
      value: 17.999267578125,
      raw: '1179600',
      reason: null,
    });
  });

  it('delegates verified tuning families and rejects unverified formulas', () => {
    expect(
      classifyVerifiedBattleEffectFormula(
        createEffect({ baseFunctionId: 107205 })
      )
    ).toMatchObject({
      family: 'verified-tuning-state-formula',
      status: 'delegated',
      applied: false,
    });
    expect(
      evaluateVerifiedBattleEffectFormula({
        effect: createEffect({ baseFunctionId: 4 }),
      })
    ).toMatchObject({
      status: 'unresolved',
      value: null,
      reason: 'formula-family-not-verified-for-battle-effect-runtime',
    });
  });

  it('keeps every published semantic runtime value equal to the M8 binding', () => {
    const formulaByIdentity = new Map(
      verifiedCombatMechanicsPackage.semanticEffectCatalog.formulas.map(
        entry => [entry.formulaIdentity, entry.formula]
      )
    );
    const rawEffectByIdentity = new Map(
      verifiedCombatMechanicsPackage.controlBindings.flatMap(binding =>
        binding.effects.map(effect => [effect.effectIdentity, effect])
      )
    );
    let comparisonCount = 0;

    for (const sourceEffect of verifiedCombatMechanicsPackage
      .semanticEffectCatalog.semanticEffects) {
      const effect = {
        ...sourceEffect,
        formula: formulaByIdentity.get(sourceEffect.formulaIdentity),
      };
      for (let level = 1; level <= 12; level += 1) {
        const result = evaluateVerifiedBattleEffectFormula({ effect, level });
        const legacyValues = sourceEffect.rawEffectIdentities
          .map(
            identity =>
              rawEffectByIdentity.get(identity)?.propertyChange?.valueByLevel?.[
                level
              ]
          )
          .filter(Number.isFinite);

        expect(legacyValues.length).toBeGreaterThan(0);
        expect(new Set(legacyValues)).toEqual(new Set([result.value]));
        comparisonCount += 1;
      }
    }

    expect(comparisonCount).toBe(
      verifiedCombatMechanicsPackage.semanticEffectCatalog.semanticEffects
        .length * 12
    );
  });
});

function createEffect({
  a = 100,
  g = 10000,
  commonFunctionId = 1,
  baseFunctionId = 5,
} = {}) {
  return {
    formula: {
      commonFunctionId,
      baseFunctionId,
      paramsByLevel: {
        1: [a, 0, 0, 0, 0, 0, g],
      },
    },
    sourceIdentities: ['fixture:battle-effect'],
  };
}
