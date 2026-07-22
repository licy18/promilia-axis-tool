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
        appliedProfileCount: 17,
        unresolvedProfileCount: 3,
        appliedOnEnterProfileCount: 11,
        appliedOnExitProfileCount: 6,
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

  it('retains the three source gaps instead of inventing child actions', () => {
    expect(coverage.unresolvedProfiles.map(profile => profile.ownerId)).toEqual(
      [102001, 199001, 199002]
    );
    expect(getVerifiedSwitchTriggerProfile(102001, 'on-exit')).toMatchObject({
      applied: false,
      resolutionStatus: 'static-evidence-gap',
      reasons: ['star-carry-action-mapping-missing'],
    });
  });
});
