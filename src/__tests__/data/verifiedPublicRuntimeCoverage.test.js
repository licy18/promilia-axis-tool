import { describe, expect, it } from 'vitest';
import coverage from '../../../reports/verified-public-runtime-coverage.json';

describe('M9 public runtime coverage', () => {
  it('guards the fixed public action, actor, and kibo denominator', () => {
    expect(coverage.fixedProductDenominator).toEqual({
      publicActionCount: 562,
      actorOwnerCount: 20,
      kiboOwnerCount: 122,
    });
    expect(coverage.complete).toBe(true);
    expect(coverage.gate).toEqual({
      passed: true,
      checks: expect.objectContaining({
        publicActionDenominator: true,
        actorOwnerDenominator: true,
        kiboOwnerDenominator: true,
        everyPublicActionClassified: true,
        requiredActorCoreActionsPresent: true,
        requiredKiboActionsPresent: true,
        everyUnresolvedActionExplained: true,
        everyNonzeroRecoveryElementScoped: true,
      }),
    });
    expect(coverage.actions).toHaveLength(562);
    expect(new Set(coverage.actions.map(action => action.identity)).size).toBe(
      562
    );
    expect(coverage.actorCoreActions).toHaveLength(60);
    expect(coverage.kiboCoreActions).toHaveLength(366);
  });

  it('keeps every unresolved public action explicit and source-scoped', () => {
    expect(coverage.summary).toMatchObject({
      runnableActionCount: 373,
      verifiedZeroActionCount: 0,
      unresolvedActionCount: 189,
      unclassifiedUnresolvedActionCount: 0,
      unresolvedStatusCounts: {
        'runtime-and-evidence-gap': 118,
        'static-evidence-gap': 71,
      },
    });
    expect(
      coverage.unresolvedActions.every(
        action =>
          action.reasons.length > 0 &&
          action.sourceIdentity &&
          [
            'runtime-dependent',
            'runtime-and-evidence-gap',
            'static-evidence-gap',
          ].includes(action.runtimeStatus)
      )
    ).toBe(true);
    expect(
      coverage.unresolvedActions.flatMap(action => action.reasons)
    ).not.toEqual(
      expect.arrayContaining([
        'pack-lifecycle-runtime-unimplemented',
        'judgment-condition-runtime-unimplemented',
        'nested-damage-trigger-lifecycle-not-expanded',
      ])
    );
  });

  it('separates current public recovery gaps from variants and catalog-external elements', () => {
    expect(coverage.summary.nonzeroRecoveryElementCount).toBe(667);
    expect(coverage.summary.recoveryScopeCounts).toEqual({
      'applied-current-public-action': 153,
      'current-public-action-unresolved': 38,
      'outside-current-public-action-catalog': 400,
      'public-unselected-control-variant': 76,
    });
    expect(
      coverage.recoveryCoverage.filter(
        item => item.productScope === 'current-public-action-unresolved'
      )
    ).toHaveLength(38);
    expect(
      coverage.actions.every(action =>
        [
          'enemyHp',
          'enemyToughness',
          'actorSp',
          'kiboSp',
          'healing',
          'shield',
          'dynamicProperty',
          'tuningMark',
        ].every(dimension => action.dimensions[dimension] != null)
      )
    ).toBe(true);
  });
});
