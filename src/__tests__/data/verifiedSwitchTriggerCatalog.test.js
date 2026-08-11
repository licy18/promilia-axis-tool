import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import coverage from '../../../reports/verified-switch-trigger-coverage.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  getVerifiedCombatActionMappingByIdentity,
  getVerifiedSwitchTriggerCatalog,
  getVerifiedSwitchTriggerProfile,
  installVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';

describe('verified switch trigger catalog', () => {
  beforeEach(() => installVerifiedCombatMechanicsPackage(mechanicsPackage));
  afterEach(() => clearInstalledVerifiedCombatMechanicsPackage());

  it('classifies every public actor switch slot without silent omissions', () => {
    expect(coverage).toMatchObject({
      status: 'verified-switch-trigger-coverage-ready',
      sourceDenominator: {
        actorOwnerCount: 20,
        switchSkillSlotCount: 20,
        onEnterSlotCount: 11,
        onExitSlotCount: 9,
      },
      summary: {
        profileCount: 20,
        appliedProfileCount: 20,
        unresolvedProfileCount: 0,
        appliedOnEnterProfileCount: 11,
        appliedOnExitProfileCount: 9,
      },
    });
    expect(getVerifiedSwitchTriggerCatalog()?.profiles).toHaveLength(20);
  });

  it('keeps verified enter and exit identities separate from mechanics coverage', () => {
    const exit = getVerifiedSwitchTriggerProfile(101003, 'on-exit');
    const enter = getVerifiedSwitchTriggerProfile(101007, 'on-enter');
    expect(exit).toMatchObject({
      skillSlot: 201,
      sourceSkillId: 10100322,
      triggerPhase: 'on-exit',
      resolutionStatus: 'applied',
      manualReleaseStatus: 'switch-trigger-only',
    });
    expect(enter).toMatchObject({
      skillSlot: 203,
      sourceSkillId: 10100721,
      triggerPhase: 'on-enter',
      resolutionStatus: 'applied',
      manualReleaseStatus: 'switch-trigger-only',
    });
    expect(
      getVerifiedCombatActionMappingByIdentity(exit.starCarryActionIdentity)
        ?.actionKind
    ).toBe('star-carry');
  });

  it('binds every verified exit profile to its own star-carry action', () => {
    expect(coverage.unresolvedProfiles).toEqual([]);
    for (const ownerId of [102001, 199001, 199002]) {
      const profile = getVerifiedSwitchTriggerProfile(ownerId, 'on-exit');
      expect(profile).toMatchObject({
        ownerId,
        triggerPhase: 'on-exit',
        applied: true,
        resolutionStatus: 'applied',
        reasons: [],
      });
      expect(
        getVerifiedCombatActionMappingByIdentity(
          profile.starCarryActionIdentity
        )?.actionKind
      ).toBe('star-carry');
    }
  });
});
