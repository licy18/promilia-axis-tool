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
      packageVersion: 6,
      clientBuild: 'il2cpp-tc-catch-20260709',
      validation: { status: 'verified-18-of-18', passed: 18, failed: 0 },
      summary: {
        candidateActionCount: 562,
        classifiedActionCount: 562,
        appliedActionBindingCount: 352,
        appliedHitBindingCount: 1175,
        unresolvedActionCount: 244,
        actorProfileCount: 20,
        kiboProfileCount: 122,
        enemyProfileCount: 208,
        appliedEnemyProfileCount: 204,
        attackInputChainCount: 20,
        attackInputSegmentCount: 95,
        appliedAttackInputSegmentCount: 49,
        unresolvedAttackInputSegmentCount: 46,
        appliedAttackInputTimingCount: 63,
        unresolvedAttackInputTimingCount: 32,
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
      mechanicsPackage.actionBindings
        .filter(binding => binding.actionKind === 'normal-attack')
        .every(binding => binding.attackSequenceIndex != null)
    ).toBe(true);
    const verifiedChargedInput = mechanicsPackage.actionMappings.find(
      mapping =>
        mapping.actionKind === 'charged-attack' &&
        mapping.inputTrigger?.mode === 'hold'
    );
    expect(verifiedChargedInput?.inputTrigger).toMatchObject({
      triggerType: 1,
      mode: 'hold',
      holdTriggerTimeMs: 250,
      sourceKind: 'azpr-skillsub-logic-input-trigger',
      status: 'verified-input-trigger-ready',
      confidence: 'high',
    });
    expect(
      mechanicsPackage.actionMappings
        .flatMap(mapping => mapping.attackInputSegments ?? [])
        .some(segment => segment.inputTrigger?.mode === 'press')
    ).toBe(true);
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

  it('maps normal attacks to real input controls instead of aggregate hit blocks', () => {
    const fiveInput = mechanicsPackage.actionMappings.find(
      mapping =>
        mapping.ownerId === 102001 && mapping.actionKind === 'normal-attack'
    );
    const fourInput = mechanicsPackage.actionMappings.find(
      mapping =>
        mapping.ownerId === 101007 && mapping.actionKind === 'normal-attack'
    );
    const threeInput = mechanicsPackage.actionMappings.find(
      mapping =>
        mapping.ownerId === 108003 && mapping.actionKind === 'normal-attack'
    );

    expect(fiveInput.attackInputSegments).toHaveLength(5);
    expect(fourInput.attackInputSegments).toHaveLength(4);
    expect(threeInput.attackInputSegments).toHaveLength(3);
    expect(fiveInput.attackInputSegments.map(segment => segment.label)).toEqual(
      ['A1', 'A2', 'A3', 'A4', 'A5']
    );
    expect(fiveInput.attackInputSegments[2]).toMatchObject({
      controlSkillId: 10200103,
      durationFrames: 40,
      effectiveDurationFrames: 40,
      animationDurationFrames: 282,
      hitEndFrame: 30,
      linkWindow: {
        startFrame: 40,
        endFrame: 96,
        continuousAttackType: 1,
      },
      hitCount: 6,
    });
    expect(
      fiveInput.attackInputSegments.map(segment => segment.durationFrames)
    ).toEqual([19, 32, 40, 42, 56]);
    expect(
      fiveInput.attackInputSegments.map(
        segment => segment.animationDurationFrames
      )
    ).toEqual([155, 221, 282, 192, 293]);
    expect(
      fiveInput.attackInputSegments.every(
        segment =>
          segment.durationFrames >= (segment.hitEndFrame ?? 0) &&
          segment.durationFrames <= segment.linkWindow.endFrame
      )
    ).toBe(true);
    const fullHitSafeSegment = mechanicsPackage.actionMappings
      .find(
        mapping =>
          mapping.ownerId === 107002 && mapping.actionKind === 'normal-attack'
      )
      .attackInputSegments.find(segment => segment.sequenceIndex === 3);
    expect(fullHitSafeSegment).toMatchObject({
      controlSkillId: 10700203,
      hitEndFrame: 100,
      effectiveDurationFrames: 100,
      linkWindow: { startFrame: 87, endFrame: 126 },
      linkTimingStatus: 'applied',
    });
    const hitIdentities = fiveInput.attackInputSegments.flatMap(
      segment => segment.selectedHitIdentities
    );
    expect(new Set(hitIdentities).size).toBe(hitIdentities.length);

    installVerifiedCombatMechanicsPackage(mechanicsPackage);
    const aggregate = resolveVerifiedCombatActionMechanics({
      id: 'legacy-normal-attack',
      type: 'skill',
      skillId: fiveInput.sourceSkillId,
      actor: { characterId: 102001 },
    });
    expect(aggregate).toMatchObject({
      ready: false,
      status: 'verified-normal-attack-legacy-aggregate-unresolved',
    });

    const segment = fiveInput.attackInputSegments[2];
    const resolved = resolveVerifiedCombatActionMechanics({
      id: 'normal-attack-a3',
      type: 'skill',
      skillId: fiveInput.sourceSkillId,
      attackSequenceIndex: segment.sequenceIndex,
      attackInput: segment,
      actor: { characterId: 102001 },
    });
    expect(resolved).toMatchObject({
      ready: true,
      actionBinding: {
        identity: segment.identity,
        controlSkillId: 10200103,
        attackInputSegment: { sequenceIndex: 3 },
      },
    });
    expect(resolved.hits).toHaveLength(6);
    expect(resolved.hits.every(hit => hit.mapIndex === 0)).toBe(true);
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
        attackInputChainCount: 20,
        attackInputSegmentCount: 95,
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
    expect(actionCoverage.attackInputChains).toHaveLength(20);
    expect(
      actionCoverage.attackInputChains.every(
        chain =>
          chain.sequenceTotal === chain.segments.length &&
          chain.segments.every(
            (segment, index) => segment.sequenceIndex === index + 1
          )
      )
    ).toBe(true);
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
