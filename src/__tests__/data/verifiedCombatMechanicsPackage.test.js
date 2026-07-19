import { afterEach, describe, expect, it } from 'vitest';
import audit from '../../../reports/verified-combat-mechanics-audit.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import spUnitContract from '../../data/generated/verified-sp-unit-contract.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  getInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
  loadVerifiedCombatMechanicsPackage,
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
      packageVersion: 2,
      clientBuild: 'il2cpp-tc-catch-20260709',
      validation: { status: 'verified-18-of-18', passed: 18, failed: 0 },
      summary: {
        appliedActionBindingCount: 224,
        appliedHitBindingCount: 1763,
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
