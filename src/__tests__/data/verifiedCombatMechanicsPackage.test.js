import { afterEach, describe, expect, it } from 'vitest';
import audit from '../../../reports/verified-combat-mechanics-audit.json';
import actionCoverage from '../../../reports/verified-combat-action-coverage.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import spUnitContract from '../../data/generated/verified-sp-unit-contract.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  getInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
  loadVerifiedCombatMechanicsPackage,
  resolveVerifiedCombatActionMechanics,
  validateVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';

afterEach(() => {
  clearInstalledVerifiedCombatMechanicsPackage();
});

describe('verified combat mechanics package', () => {
  it('ships the 18/18 evidence identity and strict source coverage', () => {
    expect(validateVerifiedCombatMechanicsPackage(mechanicsPackage)).toEqual({
      valid: true,
      status: 'verified-combat-mechanics-package-valid',
      issues: [],
    });
    expect(mechanicsPackage).toMatchObject({
      packageId: 'azpr-tc-2026-07-18',
      packageVersion: 3,
      clientBuild: 'il2cpp-tc-catch-20260709',
      validation: { status: 'verified-18-of-18', passed: 18, failed: 0 },
      summary: {
        candidateActionCount: 562,
        classifiedActionCount: 562,
        appliedActionBindingCount: 318,
        appliedHitBindingCount: 1028,
        unresolvedActionCount: 244,
        actorProfileCount: 20,
        kiboProfileCount: 122,
        enemyProfileCount: 208,
        appliedEnemyProfileCount: 204,
      },
      spUnitContract: {
        valueUnit: 'absolute-sp-points',
        actor: {
          maxSpGrowthTemplateId: 1001001,
          maxSpGrowthMultiplier: 100,
        },
        kibo: {
          petGrowthBaseId: 5001000,
          maxSpGrowthTemplateId: 5001001,
          maxSpGrowthMultiplier: 100,
        },
        skillCost: { sourceField: 'spCost', divisor: null },
      },
    });
    expect(mechanicsPackage.packageHash).toMatch(/^[a-f0-9]{64}$/);
    expect(
      mechanicsPackage.sourceFiles.every(source =>
        /^[a-f0-9]{64}$/.test(source.sha256)
      )
    ).toBe(true);
    expect(mechanicsPackage.ownerProfiles.enemy[0]).toMatchObject({
      enemyId: 300032,
      maxWeakness: 6667,
      recoveryDelayMs: 60000,
      recoveryRateBasisPoints: 1000,
      breakTimeMs: 11000,
      breakEndTimeMs: 1000,
      breakDamageUpBasisPoints: 10000,
      status: 'verified-enemy-break-profile-ready',
      applied: true,
    });
    expect(spUnitContract).toEqual(mechanicsPackage.spUnitContract);
    expect(
      mechanicsPackage.ownerProfiles.actor.find(
        profile => profile.characterId === 101007
      )
    ).toMatchObject({
      maxSpBase: 1,
      maxSpGrowthTemplateId: 1001001,
      maxSpGrowthMultiplier: 100,
      effectiveMaxSp: 100,
      maxSp: 100,
    });
    expect(
      mechanicsPackage.ownerProfiles.kibo.find(
        profile => profile.kiboId === 500469
      )
    ).toMatchObject({
      maxSpBase: 1,
      maxSpGrowthTemplateId: 5001001,
      maxSpGrowthMultiplier: 100,
      effectiveMaxSp: 100,
      maxSp: 100,
    });
    expect(
      mechanicsPackage.controlBindings.find(
        binding => binding.controlSkillId === 50046903
      )?.logic
    ).toMatchObject({ spCost: 100 });
    expect(
      mechanicsPackage.controlBindings.some(binding =>
        Object.hasOwn(binding.logic, 'spCostPercent')
      )
    ).toBe(false);
    expect(audit).toMatchObject({
      status: 'verified-combat-mechanics-sync-audit-ready',
      packageId: mechanicsPackage.packageId,
      packageHash: mechanicsPackage.packageHash,
    });
  });

  it('classifies the independent public action denominator without silent omissions', () => {
    expect(actionCoverage).toMatchObject({
      status: 'verified-combat-action-coverage-ready',
      complete: true,
      sourceDenominator: {
        actorOwnerCount: 20,
        kiboOwnerCount: 122,
        actionCount: 562,
      },
      summary: {
        directoryActionCount: 562,
        classifiedActionCount: 562,
      },
      missingRequiredActorActions: [],
    });
    expect(mechanicsPackage.actionMappings).toHaveLength(562);
    expect(
      mechanicsPackage.actionMappings.every(mapping =>
        ['applied', 'verified-zero', 'unresolved'].includes(
          mapping.classification
        )
      )
    ).toBe(true);
    expect(
      actionCoverage.unresolvedActions.every(
        action => action.reasons.length > 0
      )
    ).toBe(true);
    expect(
      actionCoverage.nonzeroRecoveryCoverage.every(
        element =>
          ['applied', 'unresolved'].includes(element.classification) &&
          (element.classification === 'applied' || element.reasons.length > 0)
      )
    ).toBe(true);
    expect(actionCoverage.summary.publicVariantCount).toBeGreaterThan(562);
    expect(
      actionCoverage.publicVariantCoverage.every(
        variant =>
          ['applied', 'verified-zero', 'unresolved'].includes(
            variant.classification
          ) && variant.sourceIdentity
      )
    ).toBe(true);
    expect(
      actionCoverage.publicVariantCoverage.some(
        variant =>
          !variant.selected &&
          variant.reasons.includes(
            'public-variant-to-control-subskill-association-missing'
          )
      )
    ).toBe(true);

    for (const owner of actionCoverage.byOwner.filter(
      item => item.ownerKind === 'actor'
    )) {
      expect(owner.actionKinds).toMatchObject({
        'normal-attack': 1,
        'star-skill': 1,
        ultimate: 1,
      });
    }
    expect(
      actionCoverage.byOwner
        .filter(item => item.ownerKind === 'kibo')
        .reduce((sum, owner) => sum + owner.directoryActionCount, 0)
    ).toBe(366);
  });

  it('resolves only the selected resource map for a shared kibo control', () => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
    const resolution = resolveVerifiedCombatActionMechanics({
      id: 'kibo-shared-control',
      type: 'kiboEvent',
      skillId: 504004,
      actionVariantIndex: 0,
      kiboId: 500001,
      actor: {
        characterId: 101007,
        loadout: { kiboId: 500001 },
      },
    });

    expect(resolution).toMatchObject({
      ready: true,
      complete: true,
      actionBinding: { selectedSubSkillIndex: 0 },
    });
    expect(resolution.controlBinding.variants.length).toBeGreaterThan(1);
    expect(resolution.hits.length).toBeGreaterThan(0);
    expect(resolution.hits.every(hit => hit.mapIndex === 0)).toBe(true);
    expect(resolution.hits.length).toBeLessThan(
      resolution.controlBinding.hits.length
    );
  });

  it('loads the large catalog on demand and caches the installed package', async () => {
    let requestCount = 0;
    const fetchImpl = async () => {
      requestCount += 1;
      return {
        ok: true,
        json: async () => mechanicsPackage,
      };
    };

    expect(getInstalledVerifiedCombatMechanicsPackage()).toBeNull();
    const first = await loadVerifiedCombatMechanicsPackage(fetchImpl);
    const second = await loadVerifiedCombatMechanicsPackage(fetchImpl);

    expect(first).toBe(mechanicsPackage);
    expect(second).toBe(mechanicsPackage);
    expect(getInstalledVerifiedCombatMechanicsPackage()).toBe(mechanicsPackage);
    expect(requestCount).toBe(1);
  });

  it('rejects packages that lose the verified evidence gate', () => {
    expect(() =>
      installVerifiedCombatMechanicsPackage({
        ...mechanicsPackage,
        validation: { ...mechanicsPackage.validation, failed: 1 },
      })
    ).toThrow(/package-validation-invalid/);
  });

  it('rejects packages that lose the enemy Break profile source', () => {
    expect(() =>
      installVerifiedCombatMechanicsPackage({
        ...mechanicsPackage,
        ownerProfiles: {
          ...mechanicsPackage.ownerProfiles,
          enemy: null,
        },
      })
    ).toThrow(/enemy-profiles-missing/);
  });
});
