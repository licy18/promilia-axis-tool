import { afterEach, describe, expect, it } from 'vitest';
import audit from '../../../reports/verified-combat-mechanics-audit.json';
import actionCoverage from '../../../reports/verified-combat-action-coverage.json';
import actionTimingCoverage from '../../../reports/verified-combat-action-timing-coverage.json';
import effectCoverage from '../../../reports/verified-combat-effect-coverage.json';
import variantResourceCoverage from '../../../reports/verified-action-variant-resource-coverage.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import spUnitContract from '../../data/generated/verified-sp-unit-contract.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  getVerifiedCombatActionInputMapping,
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
      packageVersion: 11,
      clientBuild: 'il2cpp-tc-catch-20260709',
      validation: { status: 'verified-18-of-18', passed: 18, failed: 0 },
      summary: {
        candidateActionCount: 562,
        classifiedActionCount: 562,
        appliedActionBindingCount: 415,
        appliedHitBindingCount: 1310,
        appliedEffectBindingCount: 125,
        verifiedZeroEffectBindingCount: 2,
        unresolvedEffectBindingCount: 3208,
        actionVariantSupportControlBindingCount: 25,
        specialResourceProfileCount: 2,
        specialResourceOperationCount: 43,
        actionVariantNodeCount: 79,
        actionVariantEdgeCount: 85,
        battleEffectNodeCount: 3673,
        unresolvedActionCount: 189,
        actorProfileCount: 20,
        kiboProfileCount: 122,
        enemyProfileCount: 208,
        collectibleActorProfileCount: 17,
        battleKiboProfileCount: 147,
        workbenchActorIdentityCount: 20,
        workbenchKiboIdentityCount: 122,
        appliedEnemyProfileCount: 204,
        attackInputChainCount: 20,
        attackInputSegmentCount: 95,
        appliedAttackInputSegmentCount: 48,
        unresolvedAttackInputSegmentCount: 47,
        appliedAttackInputTimingCount: 64,
        unresolvedAttackInputTimingCount: 31,
      },
      mechanismEvidence: {
        contractName: 'AzPrVerifiedMechanismEvidenceManifest',
        status: 'verified-mechanism-evidence-manifest-ready',
        sources: expect.arrayContaining([
          expect.objectContaining({
            id: 'combat-formula-knowledge',
            validationStatus: 'verified-source-structure-ready',
            sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          }),
          expect.objectContaining({ id: 'combat-property-sources' }),
          expect.objectContaining({ id: 'combat-sp-recovery-sharing' }),
          expect.objectContaining({ id: 'combat-overlimit-mechanics' }),
          expect.objectContaining({ id: 'combat-formulas-evidence' }),
          expect.objectContaining({ id: 'combat-coefficient-ranges' }),
          expect.objectContaining({ id: 'combat-enemy-break-profiles' }),
        ]),
      },
      staticPropertyCatalog: {
        status: 'verified-static-property-catalog-ready',
        identityAudit: {
          status: 'verified-static-property-identity-audit-ready',
          workbenchActorCount: 20,
          verifiedActorCount: 17,
          workbenchKiboCount: 122,
          verifiedKiboCount: 147,
          actorClassifications: {
            applicable: 17,
            'non-current-public-directory': 3,
          },
          kiboClassifications: {
            applicable: 122,
            'not-exposed-in-current-workbench-catalog': 25,
          },
        },
      },
      battleEffectCatalog: {
        status: 'verified-battle-effect-node-catalog-ready',
        summary: {
          nodeCount: 3673,
          appliedNodeCount: 265,
          verifiedZeroNodeCount: 855,
          unresolvedNodeCount: 2553,
        },
      },
      tuningMechanicsCatalog: {
        status: 'verified-tuning-mechanics-catalog-ready',
        summary: {
          profileCount: 9,
          markContainerCount: 9,
          heldDamageTemplateCount: 10,
          overlimitPacketCount: 9,
        },
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
      mechanicsPackage.tuningMechanicsCatalog.profiles.find(
        profile => profile.key === 'dark'
      ).persistentModifiers
    ).toEqual(
      expect.arrayContaining(
        [51, 52, 53, 54, 55, 56, 57, 58, 59, 60].map(attributeId =>
          expect.objectContaining({ attributeId, valueRaw: 81 })
        )
      )
    );
    expect(
      mechanicsPackage.tuningMechanicsCatalog.profiles
        .flatMap(profile => profile.persistentModifiers)
        .some(modifier => modifier.attributeId === 0)
    ).toBe(false);
    expect(effectCoverage.summary).toMatchObject({
      effectBindingCount: 3335,
      appliedEffectBindingCount: 125,
      verifiedZeroEffectBindingCount: 2,
      unresolvedEffectBindingCount: 3208,
      bindingKindCounts: {
        damage: 447,
        inject: 1376,
        judgment: 80,
        pack: 166,
        'property-change': 1013,
        shield: 10,
        sp: 89,
        stack: 154,
      },
      dimensions: expect.objectContaining({
        damage: expect.any(Object),
        toughness: expect.any(Object),
        sp: expect.any(Object),
        hp: expect.any(Object),
        shield: expect.any(Object),
        dynamicProperty: expect.objectContaining({ applied: 50 }),
        mark: expect.any(Object),
      }),
    });
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
    expect(mechanicsPackage.specialResourceCatalog).toMatchObject({
      status: 'verified-special-resource-catalog-ready',
      summary: {
        profileCount: 2,
        appliedProfileCount: 2,
        operationCount: 71,
        appliedOperationCount: 43,
        unresolvedOperationCount: 28,
        unresolvedOwnerCount: 1,
      },
      profiles: expect.arrayContaining([
        expect.objectContaining({
          ownerId: 101010,
          elementId: 101010115,
          capacity: 100,
          initialValue: 0,
        }),
        expect.objectContaining({
          ownerId: 103002,
          elementId: 103002047,
          name: '子弹',
          capacity: 12,
          initialValue: 0,
        }),
      ]),
    });
    expect(mechanicsPackage.actionVariantGraph).toMatchObject({
      status: 'verified-action-variant-graph-ready',
      summary: {
        ownerCount: 2,
        nodeCount: 79,
        edgeCount: 318,
        appliedEdgeCount: 85,
        unresolvedEdgeCount: 233,
      },
    });
    expect(variantResourceCoverage.summary).toMatchObject({
      profileCount: 2,
      appliedProfileCount: 2,
      appliedOperationCount: 43,
      appliedEdgeCount: 85,
    });
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

  it('exposes verified kibo SP cost to the operation input projection', () => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);

    expect(
      getVerifiedCombatActionInputMapping({
        type: 'kiboEvent',
        kiboId: 500001,
        skillId: 50000102,
        actionVariantIndex: 0,
      })
    ).toMatchObject({
      actionKind: 'signature',
      controlSkillId: 50000102,
      controlLogic: { spCost: 100 },
    });
    expect(
      getVerifiedCombatActionInputMapping({
        type: 'kiboEvent',
        kiboId: 500001,
        skillId: 504004,
        actionVariantIndex: 0,
      })
    ).toMatchObject({
      actionKind: 'active',
      controlSkillId: 504004,
      controlLogic: { spCost: 0 },
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

    const unresolvedChain = mechanicsPackage.actionMappings.find(
      mapping =>
        mapping.ownerId === 103002 && mapping.actionKind === 'normal-attack'
    );
    const unresolvedSegment = unresolvedChain.attackInputSegments[0];
    expect(
      resolveVerifiedCombatActionMechanics({
        id: 'ruby-normal-attack-a1',
        type: 'skill',
        skillId: unresolvedChain.sourceSkillId,
        attackSequenceIndex: unresolvedSegment.sequenceIndex,
        attackInput: unresolvedSegment,
        actor: { characterId: 103002 },
      })
    ).toMatchObject({
      ready: false,
      applied: false,
      status: 'verified-action-duration-unresolved',
      hits: [],
    });
  });

  it('keeps action occupancy separate from animation, hits, windows, and cooldown', () => {
    expect(actionTimingCoverage).toMatchObject({
      status: 'verified-combat-action-timing-coverage-ready',
      sourceDenominator: {
        publicActionCount: 562,
        publicVariantCount: 592,
        normalAttackInputSegmentCount: 95,
      },
      summary: {
        appliedActionCount: 527,
        unresolvedActionCount: 35,
        appliedAttackInputSegmentCount: 64,
        unresolvedAttackInputSegmentCount: 31,
        oneFrameCount: 0,
      },
      oneFrame: [],
    });

    const ruby = findNormalAttackMapping(103002);
    const jade = findNormalAttackMapping(101010);
    expect(
      ruby.attackInputSegments.map(segment => segment.durationFrames)
    ).toEqual([null, null, null, null, null]);
    expect(
      ruby.attackInputSegments.map(segment =>
        segment.variantTimings.map(variant => variant.occupancy.durationFrames)
      )
    ).toEqual([
      [15, null, null, null],
      [23, null, null, null],
      [null, null, null, null],
      [null, null, null, null, 33],
      [44, 43, 74],
    ]);
    expect(
      jade.attackInputSegments.map(segment => segment.durationFrames)
    ).toEqual([null, null, 47, null, null]);
    expect(
      [...ruby.attackInputSegments, ...jade.attackInputSegments]
        .filter(segment => segment.durationStatus === 'unresolved')
        .every(segment => segment.durationFrames == null)
    ).toBe(true);

    const representativeIdentities = [
      'actor|101007|10100701|1|10100710',
      'actor|101003|10100312|0|10100312',
      'actor|101003|10100313|0|10100313',
      'actor|101003|10100312|1|10100326',
      'kibo|500001|504004|0|504004',
    ];
    for (const identity of representativeIdentities) {
      const mapping = mechanicsPackage.actionMappings.find(
        action => action.identity === identity
      );
      expect(mapping.actionTiming).toMatchObject({
        status: 'applied',
        occupancy: {
          status: 'applied',
          durationFrames: expect.any(Number),
        },
        animation: { status: 'applied' },
        hitEnvelope: expect.any(Object),
        cooldown: expect.any(Object),
      });
      expect(mapping.actionTiming.occupancy.durationFrames).toBeGreaterThan(1);
    }
    const starSkill = mechanicsPackage.actionMappings.find(
      action => action.identity === 'actor|101003|10100312|0|10100312'
    );
    expect(starSkill.actionTiming).toMatchObject({
      occupancy: { durationFrames: 180 },
      hitEnvelope: { lastFrame: 109 },
      cooldown: { cooldownMs: 24000 },
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

function findNormalAttackMapping(ownerId) {
  return mechanicsPackage.actionMappings.find(
    mapping =>
      mapping.ownerKind === 'actor' &&
      mapping.ownerId === ownerId &&
      mapping.actionKind === 'normal-attack'
  );
}
