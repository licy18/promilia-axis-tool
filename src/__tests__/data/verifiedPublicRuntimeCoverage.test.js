import { describe, expect, it } from 'vitest';
import coverage from '../../../reports/verified-public-runtime-coverage.json';

describe('M9 public runtime coverage', () => {
  it('guards the fixed public action, actor, and kibo denominator', () => {
    expect(coverage.fixedProductDenominator).toEqual({
      publicActionCount: 563,
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
    expect(coverage.actions).toHaveLength(563);
    expect(new Set(coverage.actions.map(action => action.identity)).size).toBe(
      563
    );
    expect(coverage.actorCoreActions).toHaveLength(60);
    expect(coverage.kiboCoreActions).toHaveLength(366);
  });

  it('keeps every unresolved public action explicit and source-scoped', () => {
    expect(coverage.summary).toMatchObject({
      runnableActionCount: 550,
      sourceAppliedActionCount: 440,
      sourceRuntimeDependentActionCount: 110,
      scenarioResolvedActionCount: 504,
      verifiedZeroActionCount: 0,
      unresolvedActionCount: 13,
      unclassifiedUnresolvedActionCount: 0,
      unresolvedStatusCounts: {
        'runtime-and-evidence-gap': 9,

        'static-evidence-gap': 4,
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
            'runtime-evidence-required',
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

    expect(
      coverage.actions.find(
        action =>
          action.identity === 'actor|103002|10300221|2|10300227'
      )
    ).toMatchObject({
      ownerId: 103002,
      actionKind: 'perfect-parry',
      controlSkillId: 10300227,
      runtimeStatus: 'runnable',
      sourceEvidenceStatus: 'applied',
      timing: {
        status: 'applied',
        durationFrames: 35,
        schedulingKind: 'exact-public-action-execution-form-occupancy',
      },
      reasons: [],
    });
  });

  it('separates current public recovery gaps from variants and catalog-external elements', () => {
    expect(coverage.summary.nonzeroRecoveryElementCount).toBe(667);
    expect(coverage.summary.recoveryScopeCounts).toEqual({
      'applied-current-public-action': 203,
      'current-public-action-unresolved': 35,
      'outside-current-public-action-catalog': 399,
      'public-unselected-control-variant': 30,
    });
    expect(
      coverage.recoveryCoverage.filter(
        item => item.productScope === 'current-public-action-unresolved'
      )
    ).toHaveLength(35);
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
