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
    const dynamicExtra = evaluateVerifiedBattleEffectFormula({
      effect: createEffect({
        a: 938000,
        baseFunctionId: 3,
        bucket: 'dynamicExtra',
        formulaIdentity: 'battle-effect-formula:19002302',
      }),
    });
    expect(dynamicExtra).toMatchObject({
      family: 'basis-point-property-a-with-common-ratio',
      sourceRawA: 938000,
      formulaIdentity: 'battle-effect-formula:19002302',
      value: dynamicExtra.evaluatedValue,
      reason: null,
    });
    expect(dynamicExtra.evaluatedValue).toBeCloseTo(93.8, 3);
    expect(dynamicExtra.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          step: 'base-function-3-a-per-10000',
          input: 938000,
        }),
      ])
    );
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

  it('evaluates base 104 healing from the source maximum HP only', () => {
    const effect = createEffect({ a: 300, baseFunctionId: 104 });
    const result = evaluateVerifiedBattleEffectFormula({
      effect,
      sourceActor: {
        stats: {
          maxHp: 10000,
        },
      },
    });

    expect(classifyVerifiedBattleEffectFormula(effect)).toMatchObject({
      family: 'source-max-hp-ratio-heal',
      evaluator: 'q16.16-source-max-hp-times-a-per-10000',
      applied: true,
    });
    expect(result).toMatchObject({
      value: 299.98779296875,
      sourceRawA: 300,
      sourceMaximumHp: 10000,
      reason: null,
    });
    expect(result.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          step: 'source-actor-maximum-hp',
          input: 10000,
        }),
        expect.objectContaining({
          step: 'base-function-104-a-per-10000',
          input: 300,
        }),
      ])
    );
  });

  it('fails closed for base 104 when source maximum HP is unavailable', () => {
    expect(
      evaluateVerifiedBattleEffectFormula({
        effect: createEffect({ a: 300, baseFunctionId: 104 }),
        sourceActor: {
          stats: {
            maxHp: undefined,
          },
        },
      })
    ).toMatchObject({
      status: 'unresolved',
      applied: false,
      value: null,
      reason: 'source-actor-maximum-hp-missing',
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
        const contract = classifyVerifiedBattleEffectFormula(effect);
        const sourceTuning =
          contract.family === 'source-tuning-ratio-with-common-ratio'
            ? 100
            : null;
        const sourceAtkHeal =
          contract.family === 'source-atk-ratio-heal' ? 10000 : null;
        const sourceMaxHpHeal =
          contract.family === 'source-max-hp-ratio-heal' ? 10000 : null;
        const result = evaluateVerifiedBattleEffectFormula({
          effect,
          level,
          sourceActor:
            sourceTuning == null &&
            sourceAtkHeal == null &&
            sourceMaxHpHeal == null
              ? null
              : {
                  stats: {
                    tuningStrength: sourceTuning,
                    attack: sourceAtkHeal,
                    maxHp: sourceMaxHpHeal,
                  },
                },
        });
        const legacyValues = sourceEffect.rawEffectIdentities
          .map(identity => {
            const rawEffect = rawEffectByIdentity.get(identity);
            const valueByLevel =
              rawEffect?.propertyChange?.valueByLevel ??
              rawEffect?.directSp?.valueByLevel ??
              rawEffect?.heal?.valueByLevel ??
              rawEffect?.shield?.valueByLevel ??
              null;
            return valueByLevel?.[level];
          })
          .filter(Number.isFinite);

        expect(legacyValues.length).toBeGreaterThan(0);
        if (
          [
            'source-tuning-ratio-with-common-ratio',
            'source-max-hp-ratio-heal',
          ].includes(contract.family)
        ) {
          expect(new Set(legacyValues)).toEqual(
            new Set([
              effect.formula.valueByLevel[level] ??
                effect.formula.valueByLevel[String(level)],
            ])
          );
          expect(result).toMatchObject({
            status: 'applied',
            reason: null,
          });
          expect(result.value).toBeGreaterThan(0);
        } else {
          expect(new Set(legacyValues)).toEqual(new Set([result.value]));
        }
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
  bucket = null,
  formulaIdentity = 'battle-effect-formula:fixture',
} = {}) {
  return {
    property: bucket == null ? undefined : { bucket },
    bucket,
    formula: {
      formulaIdentity,
      commonFunctionId,
      baseFunctionId,
      paramsByLevel: {
        1: [a, 0, 0, 0, 0, 0, g],
      },
    },
    sourceIdentities: ['fixture:battle-effect'],
  };
}
