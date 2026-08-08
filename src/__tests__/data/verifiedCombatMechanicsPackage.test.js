import { afterEach, describe, expect, it } from 'vitest';
import audit from '../../../reports/verified-combat-mechanics-audit.json';
import actionCoverage from '../../../reports/verified-combat-action-coverage.json';
import actionTimingCoverage from '../../../reports/verified-combat-action-timing-coverage.json';
import effectCoverage from '../../../reports/verified-combat-effect-coverage.json';
import xiaoyuActionOccupancyAudit from '../../../reports/m9-r3-r2-xiaoyu-action-occupancy-audit.json';
import xiaoyuHiddenInputAudit from '../../../reports/m9-r3-r2-r2-xiaoyu-hidden-input-audit.json';
import contextualInputSchedulingAudit from '../../../reports/m9-r3-r2-r3-contextual-input-scheduling-audit.json';
import variantResourceCoverage from '../../../reports/verified-action-variant-resource-coverage.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import spUnitContract from '../../data/generated/verified-sp-unit-contract.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  getVerifiedCombatActionInputMapping,
  getVerifiedCharacterCombatProfileCatalog,
  getVerifiedCharacterCombatProfileMetadata,
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
      packageVersion: 15,
      clientBuild: 'il2cpp-tc-catch-20260709',
      validation: { status: 'verified-18-of-18', passed: 18, failed: 0 },
      summary: {
        candidateActionCount: 646,
        classifiedActionCount: 646,
        appliedActionBindingCount: 695,
        appliedHitBindingCount: 3465,
        appliedEffectBindingCount: 1786,
        verifiedZeroEffectBindingCount: 12,
        unresolvedEffectBindingCount: 1304,
        actionVariantSupportControlBindingCount: 81,
        specialResourceProfileCount: 3,
        specialResourceOperationCount: 53,
        actionVariantNodeCount: 735,
        actionVariantEdgeCount: 64,
        switchTriggerProfileCount: 20,
        appliedSwitchTriggerProfileCount: 18,
        unresolvedSwitchTriggerProfileCount: 2,
        battleEffectNodeCount: 3731,
        unresolvedActionCount: 12,
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
        appliedAttackInputSegmentCount: 80,
        unresolvedAttackInputSegmentCount: 15,
        appliedAttackInputTimingCount: 78,
        unresolvedAttackInputTimingCount: 17,
        semanticEffectCount: 3440,
        semanticGameplayEffectCount: 1863,
        semanticAppliedEffectCount: 1065,
        characterCombatProfileCount: 7,
        characterCombatUiVerifiedProfileCount: 0,
      },
      excludedDeadBranches: expect.arrayContaining([
        expect.objectContaining({
          controlSkillId: 50008104,
          elementId: 500081044,
          pathId: '3531304960055990726',
          decision: 'product-confirmed-dead-branch',
          decisionSource: expect.stringContaining(
            'user-confirmation-2026-08-07'
          ),
        }),
      ]),
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
          nodeCount: 3731,
          appliedNodeCount: 1027,
          verifiedZeroNodeCount: 879,
          unresolvedNodeCount: 1825,
        },
      },
      semanticEffectCatalog: {
        status: 'verified-semantic-battle-effect-runtime-catalog-ready',
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
      characterCombatProfileCatalog: {
        status: 'character-combat-profile-catalog-ready',
        profileSchema: 'azpr://schemas/character-combat-profile/v1',
        summary: {
          publicCharacterCount: 20,
          compiledProfileCount: 7,
          uiVerifiedProfileCount: 0,
        },
      },
    });
    expect(mechanicsPackage.packageHash).toMatch(/^[a-f0-9]{64}$/);
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
    expect(getVerifiedCharacterCombatProfileCatalog()).toBe(
      mechanicsPackage.characterCombatProfileCatalog
    );
    expect(getVerifiedCharacterCombatProfileMetadata(101010)).toMatchObject({
      ownerName: '涂山小玉',
      completionState: 'runtime-applied',
      profileHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      runtimeContractHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
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
      semanticEffectCount: 3440,
      semanticGameplayEffectCount: 1863,
      semanticStructuralCount: 1577,
      semanticAppliedCount: 1065,
      semanticVerifiedZeroCount: 7,
      semanticUnresolvedCount: 791,
      semanticPlacementCounts: {
        'runtime-dependent': 106,
        'static-evidence-gap': 447,
        'static-resolved': 1310,
      },
      effectBindingCount: 3120,
      appliedEffectBindingCount: 1785,
      verifiedZeroEffectBindingCount: 12,
      unresolvedEffectBindingCount: 1304,
      bindingKindCounts: {
        damage: 464,
        inject: 1309,
        judgment: 107,
        pack: 175,
        'property-change': 827,
        shield: 15,
        sp: 88,
        stack: 135,
      },
      dimensions: expect.objectContaining({
        damage: expect.any(Object),
        toughness: expect.any(Object),
        sp: expect.any(Object),
        hp: expect.any(Object),
        shield: expect.any(Object),
        dynamicProperty: expect.objectContaining({
          applied: 695,
          unresolved: 117,
          'verified-zero': 2308,
        }),
        mark: expect.any(Object),
      }),
    });
    expect(
      mechanicsPackage.actionBindings
        .filter(
          binding =>
            binding.actionKind === 'normal-attack' &&
            binding.ownerKind === 'actor'
        )
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
          profileCount: 3,
          appliedProfileCount: 3,
          operationCount: 79,
          appliedOperationCount: 53,
        unresolvedOperationCount: 7,
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
        ownerCount: 142,
        nodeCount: 735,
        edgeCount: 346,
        appliedEdgeCount: 64,
        unresolvedEdgeCount: 286,
      },
    });
    expect(effectCoverage.sourceDenominator.rawReferenceEdgeCount).toBe(1809);
    expect(variantResourceCoverage.summary).toMatchObject({
      profileCount: 3,
      appliedProfileCount: 3,
      appliedOperationCount: 53,
      appliedEdgeCount: 64,
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
    expect(
      resolveVerifiedCombatActionMechanics({
        id: 'normal-attack-a3-active-chain',
        type: 'skill',
        skillId: fiveInput.sourceSkillId,
        attackSequenceIndex: segment.sequenceIndex,
        attackInput: {
          ...segment,
          identity: `${segment.identity}|active-chain|input:3`,
        },
        actor: { characterId: 102001 },
      })
    ).toMatchObject({
      ready: true,
      actionBinding: {
        identity: segment.identity,
        attackInputSegment: { sequenceIndex: 3 },
      },
    });

    const scenarioChain = mechanicsPackage.actionMappings.find(
      mapping =>
        mapping.ownerId === 103002 && mapping.actionKind === 'normal-attack'
    );
    const scenarioSegment = scenarioChain.attackInputSegments[0];
    expect(
      resolveVerifiedCombatActionMechanics({
        id: 'ruby-normal-attack-a1',
        type: 'skill',
        skillId: scenarioChain.sourceSkillId,
        attackSequenceIndex: scenarioSegment.sequenceIndex,
        attackInput: scenarioSegment,
        actor: { characterId: 103002 },
      })
    ).toMatchObject({
      ready: true,
      applied: true,
      status: 'verified-combat-action-mechanics-ready',
      hits: [
        expect.objectContaining({
          sourceEvidenceStatus: 'runtime-dependent',
          scenarioRuntimeStatus: 'scenario-assumed-zero-distance',
        }),
      ],
    });
  });

  it('keeps action occupancy separate from animation, hits, windows, and cooldown', () => {
    expect(actionTimingCoverage).toMatchObject({
      status: 'verified-combat-action-timing-coverage-ready',
      sourceDenominator: {
        publicActionCount: 646,
        publicVariantCount: 676,
        normalAttackInputSegmentCount: 95,
      },
      summary: {
        appliedActionCount: 634,
        unresolvedActionCount: 12,
        appliedAttackInputSegmentCount: 78,
        unresolvedAttackInputSegmentCount: 17,
        exactSelectedVariantOccupancyCount: 703,
        sourceAnimationPlanningDurationCount: 28,
        genericPlanningDurationCount: 1,
        variantConditionFocusCount: 23,
        oneFrameCount: 0,
      },
      oneFrame: [],
    });

    const ruby = findNormalAttackMapping(103002);
    const jade = findNormalAttackMapping(101010);
    expect(
      ruby.attackInputSegments.map(segment => segment.durationFrames)
    ).toEqual([15, 23, 34]);
    expect(
      ruby.attackInputSegments.map(segment =>
        segment.variantTimings.map(variant => variant.occupancy.durationFrames)
      )
    ).toEqual([
      [15, null, null, null],
      [23, null, null, null],
      [null, null, null, null],
    ]);
    expect(
      ruby.attackInputSourceSegments.map(segment => segment.durationFrames)
    ).toEqual([15, 23, null, null, 44]);
    expect(
      ruby.attackInputSourceSegments.map(segment =>
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
    ).toEqual([20, 35, 47, 30, 80]);
    expect(jade.attackInputSegments[4]).toMatchObject({
      durationFrames: 80,
      durationStatus: 'applied',
      durationBasis: 'attack-reopen-window',
      variantTimings: [
        expect.objectContaining({
          subSkillIndex: 0,
          occupancy: expect.objectContaining({ durationFrames: 80 }),
        }),
        expect.objectContaining({
          subSkillIndex: 1,
          occupancy: expect.objectContaining({ durationFrames: 72 }),
        }),
      ],
    });
    expect(
      [...ruby.attackInputSourceSegments, ...jade.attackInputSegments]
        .filter(segment => segment.durationStatus === 'unresolved')
        .every(segment => segment.durationFrames == null)
    ).toBe(true);

    const genericPlanning = [
      ...actionTimingCoverage.actions,
      ...actionTimingCoverage.attackInputSegments,
    ].filter(row => row.schedulingKind === 'generic-planning-duration');
    expect(genericPlanning).toEqual([
      expect.objectContaining({
        ownerId: 107002,
        controlSkillId: 10700205,
        sequenceIndex: 5,
        planningDurationFrames: 30,
        variantModelStatus: 'unresolved-control-identity',
      }),
    ]);
    expect(
      actionTimingCoverage.attackInputSegments.find(
        segment => segment.ownerId === 111001 && segment.sequenceIndex === 5
      )
    ).toMatchObject({
      durationFrames: 58,
      sourceKind: 'attack-reopen-window',
      schedulingKind: 'exact-selected-variant-occupancy',
    });

    const jadeCharged = mechanicsPackage.actionMappings.find(
      action =>
        action.ownerId === 101010 && action.actionKind === 'charged-attack'
    );
    expect(jadeCharged).toMatchObject({
      selectedSubSkillIndex: 0,
      variantModelStatus: 'partially-resolved',
      controlVariantResolution: {
        kind: 'verified-client-default-subskill-index',
      },
      actionScheduling: {
        kind: 'exact-selected-variant-occupancy',
        durationFrames: 75,
        selectedSubSkillIndex: 0,
      },
    });
    expect(
      jadeCharged.actionTiming.variantTimings.map(timing => ({
        subSkillIndex: timing.subSkillIndex,
        animationFrames: timing.animation.durationFrames,
        occupancyFrames: timing.occupancy.durationFrames,
        sourceKind: timing.occupancy.sourceKind,
      }))
    ).toEqual([
      {
        subSkillIndex: 0,
        animationFrames: 310,
        occupancyFrames: 75,
        sourceKind: 'verified-specific-input-window',
      },
      {
        subSkillIndex: 1,
        animationFrames: 230,
        occupancyFrames: 75,
        sourceKind: 'verified-specific-input-window',
      },
      {
        subSkillIndex: 2,
        animationFrames: 250,
        occupancyFrames: 64,
        sourceKind: 'verified-unconditional-attack-reopen-window',
      },
    ]);
    expect(mechanicsPackage.actionVariantGraph.summary).toMatchObject({
      ownerCount: 142,
      nodeCount: 735,
      modeledOwnerCount: 4,
      conditionDiscoveryCount: 216,
      conditionDiscoveryStatusCounts: {
        'partially-resolved': 6,
        resolved: 2,
        'static-evidence-gap': 4,
        'variant-condition-not-yet-modeled': 204,
      },
    });
    expect(
      mechanicsPackage.actionVariantGraph.edges.some(
        edge =>
          edge.ownerId === 101010 &&
          edge.targetControlSkillId === 10101010 &&
          edge.targetSubSkillIndex === 2 &&
          edge.applied
      )
    ).toBe(true);
    expect(
      mechanicsPackage.actionVariantGraph.contextEdges
        .filter(edge => edge.ownerId === 101010)
        .map(edge => ({
          sourceSubSkillIndex: edge.sourceSubSkillIndex,
          targetControlSkillId: edge.targetControlSkillId,
          executionControlSkillId: edge.executionControlSkillId,
          targetSubSkillIndex: edge.targetSubSkillIndex,
          startFrame: edge.inputWindow.startFrame,
          endFrame: edge.inputWindow.endFrame,
          condition: edge.condition.kind,
          semanticName: edge.semanticName,
        }))
    ).toEqual([
      {
        sourceSubSkillIndex: 0,
        targetControlSkillId: 10101010,
        executionControlSkillId: 10101042,
        targetSubSkillIndex: 0,
        startFrame: 37,
        endFrame: 102,
        condition: 'resource-state-inactive',
        semanticName: '特殊重击',
      },
      {
        sourceSubSkillIndex: 1,
        targetControlSkillId: 10101010,
        executionControlSkillId: 10101042,
        targetSubSkillIndex: 1,
        startFrame: 0,
        endFrame: 20,
        condition: 'resource-state-active',
        semanticName: '强化特殊重击',
      },
      {
        sourceSubSkillIndex: 1,
        targetControlSkillId: 10101010,
        executionControlSkillId: 10101042,
        targetSubSkillIndex: 1,
        startFrame: 40,
        endFrame: 72,
        condition: 'resource-state-active',
        semanticName: '强化特殊重击',
      },
      {
        sourceSubSkillIndex: 0,
        targetControlSkillId: 10101010,
        executionControlSkillId: 10101042,
        targetSubSkillIndex: 0,
        startFrame: 86,
        endFrame: 120,
        condition: 'always',
        semanticName: '特殊重击',
      },
      {
        sourceSubSkillIndex: 0,
        targetControlSkillId: 10101010,
        executionControlSkillId: 10101042,
        targetSubSkillIndex: 1,
        startFrame: 295,
        endFrame: 329,
        condition: 'always',
        semanticName: '强化特殊重击',
      },
      {
        sourceSubSkillIndex: 0,
        targetControlSkillId: 10101010,
        executionControlSkillId: 10101042,
        targetSubSkillIndex: 0,
        startFrame: 60,
        endFrame: 96,
        condition: 'always',
        semanticName: '特殊重击',
      },
      {
        sourceSubSkillIndex: 0,
        targetControlSkillId: 10101010,
        executionControlSkillId: 10101010,
        targetSubSkillIndex: 1,
        startFrame: 75,
        endFrame: 100,
        condition: 'always',
        semanticName: '连续重击',
      },
    ]);
    expect(
      mechanicsPackage.actionVariantGraph.contextEdges.map(edge => ({
        source: `${edge.sourceControlSkillId}/sub${edge.sourceSubSkillIndex}`,
        window: [edge.inputWindow.startFrame, edge.inputWindow.endFrame],
        semantics: edge.inputScheduling.inputSemantics,
        genericEnd: edge.inputScheduling.edgeIntent.predecessorGenericEndFrame,
        canonicalInput: edge.inputScheduling.edgeIntent.canonicalInputFrame,
        executionStart:
          edge.inputScheduling.edgeIntent.canonicalExecutionStartFrame,
        predecessorEnd:
          edge.inputScheduling.edgeIntent.canonicalPredecessorEndFrame,
      }))
    ).toEqual([
      {
        source: '10100349/sub0',
        window: [19, 160],
        semantics: 'buffered-until-frame',
        genericEnd: 19,
        canonicalInput: 19,
        executionStart: 19,
        predecessorEnd: 19,
      },
      {
        source: '10101005/sub0',
        window: [37, 102],
        semantics: 'immediate-interrupt',
        genericEnd: 80,
        canonicalInput: 80,
        executionStart: 80,
        predecessorEnd: 80,
      },
      {
        source: '10101005/sub1',
        window: [0, 20],
        semantics: 'immediate-interrupt',
        genericEnd: 72,
        canonicalInput: null,
        executionStart: null,
        predecessorEnd: null,
      },
      {
        source: '10101005/sub1',
        window: [40, 72],
        semantics: 'immediate-interrupt',
        genericEnd: 72,
        canonicalInput: 71,
        executionStart: 71,
        predecessorEnd: 71,
      },
      {
        source: '10101012/sub0',
        window: [86, 120],
        semantics: 'immediate-interrupt',
        genericEnd: 120,
        canonicalInput: 119,
        executionStart: 119,
        predecessorEnd: 119,
      },
      {
        source: '10101013/sub0',
        window: [295, 329],
        semantics: 'immediate-interrupt',
        genericEnd: 329,
        canonicalInput: 328,
        executionStart: 328,
        predecessorEnd: 328,
      },
      {
        source: '10101025/sub0',
        window: [60, 96],
        semantics: 'immediate-interrupt',
        genericEnd: 60,
        canonicalInput: 60,
        executionStart: 60,
        predecessorEnd: 60,
      },
      {
        source: '10101010/sub0',
        window: [75, 100],
        semantics: 'immediate-interrupt',
        genericEnd: 75,
        canonicalInput: 75,
        executionStart: 75,
        predecessorEnd: 75,
      },
      {
        source: '10300249/sub0',
        window: [25, 166],
        semantics: 'buffered-until-frame',
        genericEnd: 25,
        canonicalInput: 25,
        executionStart: 25,
        predecessorEnd: 25,
      },
    ]);
    expect(contextualInputSchedulingAudit).toMatchObject({
      kind: 'verified-contextual-input-scheduling-audit',
      frameRate: 60,
      policy: {
        sourceWindowInterval: '[start,end)',
      },
      summary: {
        publicTimingSourceCount: 1550,
        verifiedWindowCount: 1735,
        resolvedInputSemanticsCount: 1698,
        unresolvedInputSemanticsCount: 37,
        xiaoyuPublicExecutionFormCount: 21,
        xiaoyuWindowAuditRowCount: 89,
        xiaoyuAppliedContextEdgeCount: 7,
      },
      xiaoyu: {
        publicExecutionFormCount: 21,
        rowCount: 89,
        expectedRowCount: 89,
      },
    });
    expect(
      contextualInputSchedulingAudit.xiaoyu.rows.filter(
        row => row.contextEdgeIdentity != null
      )
    ).toHaveLength(7);
    expect(
      mechanicsPackage.actionVariantGraph.hiddenInputDerivationCatalog
    ).toMatchObject({
      ownerId: 101010,
      publicExecutionFormCount: 21,
      publicExecutionFormsCovered: 21,
      starCarryConclusion: {
        sourceControlSkillId: 10101021,
        targetControlSkillId: 10101042,
        status: 'verified-not-found-in-current-client',
        applied: false,
      },
      summary: {
        appliedContextEdgeCount: 7,
        missingPublicExecutionFormCount: 0,
      },
    });
    expect(
      mechanicsPackage.actionVariantGraph.publicActionForms
        .filter(
          form =>
            form.ownerId === 101010 &&
            form.publicActionKind === 'charged-attack'
        )
        .map(form => ({
          semanticName: form.semanticName,
          executionControlSkillId: form.executionControlSkillId,
          executionSubSkillIndex: form.executionSubSkillIndex,
          animationFrames: form.executionTiming.animation.durationFrames,
          occupancyFrames: form.executionTiming.occupancy.durationFrames,
        }))
    ).toEqual([
      {
        semanticName: '普通重击',
        executionControlSkillId: 10101010,
        executionSubSkillIndex: 0,
        animationFrames: 310,
        occupancyFrames: 75,
      },
      {
        semanticName: '强化重击',
        executionControlSkillId: 10101010,
        executionSubSkillIndex: 2,
        animationFrames: 250,
        occupancyFrames: 64,
      },
      {
        semanticName: '特殊重击',
        executionControlSkillId: 10101042,
        executionSubSkillIndex: 0,
        animationFrames: 280,
        occupancyFrames: 90,
      },
      {
        semanticName: '强化特殊重击',
        executionControlSkillId: 10101042,
        executionSubSkillIndex: 1,
        animationFrames: 205,
        occupancyFrames: 60,
      },
      {
        semanticName: '连续重击',
        executionControlSkillId: 10101010,
        executionSubSkillIndex: 1,
        animationFrames: 230,
        occupancyFrames: 75,
      },
    ]);
    expect(
      mechanicsPackage.actionVariantGraph.publicActionForms.filter(
        form =>
          form.ownerId === 101010 &&
          ['star-carry', 'perfect-parry'].includes(form.publicActionKind)
      )
    ).toEqual([
      expect.objectContaining({
        publicActionKind: 'star-carry',
        semanticName: '星携技',
        executionControlSkillId: 10101021,
        executionSubSkillIndex: 0,
        executionTiming: expect.objectContaining({
          animation: expect.objectContaining({ durationFrames: 295 }),
          occupancy: expect.objectContaining({ durationFrames: 95 }),
        }),
      }),
      expect.objectContaining({
        publicActionKind: 'perfect-parry',
        semanticName: '完美招架反击',
        executionControlSkillId: 10101049,
        executionSubSkillIndex: 1,
        executionPrerequisite: expect.objectContaining({
          kind: 'scenario-event-at-action-frame',
          eventType: 'successful-parry',
          applied: true,
        }),
        executionTiming: expect.objectContaining({
          animation: expect.objectContaining({ durationFrames: 300 }),
          occupancy: expect.objectContaining({ durationFrames: 36 }),
        }),
      }),
    ]);
    const xiaoyuDerivedControl =
      mechanicsPackage.actionVariantControlBindings.find(
        control => control.controlSkillId === 10101042
      );
    expect(
      xiaoyuDerivedControl.hits.map(hit => ({
        subSkillIndex: hit.mapIndex,
        elementId: hit.elementId,
        frame: hit.trigger.startFrame,
      }))
    ).toEqual(
      expect.arrayContaining([
        { subSkillIndex: 0, elementId: 101010130, frame: 53 },
        { subSkillIndex: 0, elementId: 101010157, frame: 53 },
        { subSkillIndex: 1, elementId: 101010155, frame: 31 },
        { subSkillIndex: 1, elementId: 101010156, frame: 31 },
      ])
    );
    expect(
      mechanicsPackage.actionVariantGraph.attackInputChains
        .filter(chain => chain.ownerId === 101010)
        .map(chain => ({
          condition: chain.stateCondition.kind,
          controls: chain.segments.map(segment => segment.controlSkillId),
          subSkills: chain.segments.map(segment => segment.subSkillIndex),
          durations: chain.segments.map(segment => segment.durationFrames),
        }))
    ).toEqual([
      {
        condition: 'resource-state-inactive',
        controls: [10101001, 10101002, 10101003, 10101004, 10101005],
        subSkills: [0, 0, 0, 0, 0],
        durations: [20, 35, 47, 30, 80],
      },
      {
        condition: 'resource-state-active',
        controls: [10101001, 10101004, 10101005],
        subSkills: [1, 1, 1],
        durations: [72, 75, 72],
      },
    ]);
    expect(xiaoyuActionOccupancyAudit.summary).toEqual({
      rowCount: 23,
      exactOccupancyCount: 23,
      planningOccupancyCount: 0,
      unresolvedOccupancyCount: 0,
      animationTailRemovedCount: 23,
      publicActionKindCount: 10,
    });
    expect(
      xiaoyuActionOccupancyAudit.rows
        .filter(row => row.actionKind === 'charged-attack')
        .map(row => [
          row.semanticName,
          row.controlSkillId,
          row.subSkillIndex,
          row.animationDurationFrames,
          row.effectiveOccupancyFrames,
        ])
    ).toEqual([
      ['普通重击', 10101010, 0, 310, 75],
      ['连续重击', 10101010, 1, 230, 75],
      ['强化重击', 10101010, 2, 250, 64],
      ['特殊重击', 10101042, 0, 280, 90],
      ['强化特殊重击', 10101042, 1, 205, 60],
    ]);
    expect(
      xiaoyuActionOccupancyAudit.rows.every(
        row =>
          row.occupancyStatus === 'applied' &&
          row.animationDurationFrames > row.effectiveOccupancyFrames
      )
    ).toBe(true);
    expect(xiaoyuHiddenInputAudit.summary).toMatchObject({
      publicExecutionFormCount: 21,
      publicExecutionFormsCovered: 21,
      missingPublicExecutionFormCount: 0,
      appliedContextEdgeCount: 7,
    });
    expect(
      xiaoyuHiddenInputAudit.rows
        .filter(row => row.status === 'verified-input-context-edge-applied')
        .map(row => [
          row.sourceControlSkillId,
          row.sourceSubSkillIndex,
          row.inputWindow.startFrame,
          row.inputWindow.endFrame,
          row.targetControlSkillId,
          row.targetSubSkillIndex,
        ])
        .sort((left, right) => left.join('|').localeCompare(right.join('|')))
    ).toEqual([
      [10101005, 0, 37, 102, 10101042, 0],
      [10101005, 1, 0, 20, 10101042, 1],
      [10101005, 1, 40, 72, 10101042, 1],
      [10101010, 0, 75, 100, 10101010, 1],
      [10101012, 0, 86, 120, 10101042, 0],
      [10101013, 0, 295, 329, 10101042, 1],
      [10101025, 0, 60, 96, 10101042, 0],
    ]);
    expect(xiaoyuHiddenInputAudit.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceControlSkillId: 10101015,
          sourceSubSkillIndex: 0,
          targetControlSkillId: 10101001,
          targetSubSkillIndex: 0,
          relationType: 'direct-control-input',
          applied: true,
        }),
        expect.objectContaining({
          sourceControlSkillId: 10101042,
          sourceSubSkillIndex: 0,
          targetControlSkillId: 10101003,
          targetSubSkillIndex: 0,
          relationType: 'direct-control-input',
          applied: true,
        }),
        expect.objectContaining({
          sourceControlSkillId: 10101042,
          sourceSubSkillIndex: 1,
          targetControlSkillId: 10101001,
          targetSubSkillIndex: 1,
          condition: expect.objectContaining({
            kind: 'resource-state-active',
          }),
          applied: true,
        }),
        expect.objectContaining({
          sourceControlSkillId: 10101014,
          targetControlSkillId: 10101041,
          targetSubSkillIndex: 0,
          relationType: 'conditional-wrapper-trigger',
          applied: true,
        }),
        expect.objectContaining({
          sourceControlSkillId: 10101024,
          targetControlSkillId: 10101041,
          targetSubSkillIndex: 1,
          relationType: 'conditional-wrapper-trigger',
          applied: true,
        }),
        expect.objectContaining({
          sourceControlSkillId: 10101041,
          targetControlSkillId: 10101025,
          targetSubSkillIndex: 0,
          relationType: 'direct-control-input',
          applied: true,
        }),
      ])
    );
    expect(xiaoyuHiddenInputAudit.starCarryConclusion).toMatchObject({
      switchSkillSlot: 203,
      sourceControlSkillId: 10101021,
      directDerivedEdgeCount: 0,
      wrapperSourceControlSkillIds: [10101014, 10101024],
      status: 'verified-not-found-in-current-client',
      applied: false,
    });
    expect(
      mechanicsPackage.specialResourceCatalog.thresholdTransitions.find(
        transition => transition.ownerId === 101010
      )
    ).toMatchObject({
      resourceIdentity: 'actor:101010:element:101010115',
      threshold: 100,
      comparison: 'reaches-capacity',
      resourceOperation: 'clear',
      suppressGainWhileStateActive: true,
      stateElementId: 101010129,
      stateDurationMs: 10000,
      applied: true,
    });
    const xiaoyuPassive =
      mechanicsPackage.specialResourceCatalog.passiveEffects.find(
        passive => passive.ownerId === 101010
      );
    expect(xiaoyuPassive).toMatchObject({
      skillId: 10101061,
      name: '玉未央',
      durationMs: 8000,
      stackMode: 'stack',
      maxStacks: 4,
      triggerBindings: expect.arrayContaining([
        expect.objectContaining({
          controlSkillId: 10101010,
          subSkillIndex: 0,
          triggerFrame: 1,
        }),
        expect.objectContaining({
          controlSkillId: 10101010,
          subSkillIndex: 1,
          triggerFrame: 1,
        }),
        expect.objectContaining({
          controlSkillId: 10101010,
          subSkillIndex: 2,
          triggerFrame: 1,
        }),
        expect.objectContaining({
          controlSkillId: 10101013,
          subSkillIndex: 0,
          triggerFrame: 1,
        }),
        expect.objectContaining({
          controlSkillId: 10101021,
          subSkillIndex: 0,
          triggerFrame: 1,
        }),
        expect.objectContaining({
          controlSkillId: 10101042,
          subSkillIndex: 0,
          triggerFrame: 1,
        }),
        expect.objectContaining({
          controlSkillId: 10101042,
          subSkillIndex: 1,
          triggerFrame: 1,
        }),
        expect.objectContaining({
          controlSkillId: 10101049,
          subSkillIndex: 1,
          triggerFrame: 1,
        }),
      ]),
      unresolvedTriggerBindings: [],
      modifiers: expect.arrayContaining([
        expect.objectContaining({
          attributeId: 1,
          bucket: 'dynamicPercent',
          valueRaw: 500,
        }),
        expect.objectContaining({
          attributeId: 229,
          bucket: 'dynamicPercent',
          valueRaw: 3200,
        }),
      ]),
      applied: true,
    });
    expect(xiaoyuPassive.triggerBindings).toHaveLength(8);
    expect(
      xiaoyuPassive.triggerBindings.some(
        binding => binding.controlSkillId === 10101025
      )
    ).toBe(false);
    expect(
      mechanicsPackage.specialResourceCatalog.passiveEffects.some(
        passive => passive.skillId === 10101062
      )
    ).toBe(false);

    const reviewedNonNormalControls = [
      10101010, 10200110, 10200127, 10300210, 10700215, 10700212, 10700226,
      10700225, 10700321, 10800110, 10800210, 10800310, 10800510, 11100110,
      11100113, 11200110, 11200125, 11200210, 19900110, 19900210, 19900321,
      19900327, 50030404,
    ];
    expect(
      actionTimingCoverage.variantConditionFocus
        .map(discovery => discovery.controlSkillId)
        .sort((left, right) => left - right)
    ).toEqual(
      [...reviewedNonNormalControls].sort((left, right) => left - right)
    );
    const reviewedDiscoveries = reviewedNonNormalControls.map(controlSkillId =>
      mechanicsPackage.actionVariantGraph.conditionDiscoveries.find(
        discovery => discovery.controlSkillId === controlSkillId
      )
    );
    expect(reviewedDiscoveries.every(Boolean)).toBe(true);
    expect(reviewedDiscoveries[0]).toMatchObject({
      ownerId: 101010,
      controlSkillId: 10101010,
      status: 'partially-resolved',
      defaultSelection: { subSkillIndex: 0 },
      sourceFamilies: expect.arrayContaining([
        expect.objectContaining({ kind: 'skillsub-logic' }),
        expect.objectContaining({ kind: 'public-skill-slots-and-labels' }),
        expect.objectContaining({ kind: 'battle-switch-relations' }),
        expect.objectContaining({
          kind: 'resource-state-judgment',
          status: 'applied',
        }),
        expect.objectContaining({ kind: 'input-hold-chain' }),
      ]),
    });
    expect(
      reviewedDiscoveries
        .slice(1)
        .every(
          discovery => discovery.status === 'variant-condition-not-yet-modeled'
        )
    ).toBe(true);
    const liliChargedDiscovery = reviewedDiscoveries.find(
      discovery => discovery.controlSkillId === 10200110
    );
    expect(
      liliChargedDiscovery.sourceFamilies.find(
        source => source.kind === 'battle-switch-relations'
      )
    ).toMatchObject({
      status: 'candidate-not-yet-modeled',
      globalCandidates: expect.arrayContaining([
        expect.objectContaining({
          kind: 'legacy-trigger-effect-variant-candidate',
          targetSubSkillIndex: 2,
        }),
      ]),
    });
    expect(
      actionTimingCoverage.unresolved.some(row =>
        row.reasons.includes('control-player-variant-duration-not-invariant')
      )
    ).toBe(false);

    const representativeIdentities = [
      'actor|101007|10100701|1|10100710|charged-attack',
      'actor|101003|10100312|0|10100312|star-skill',
      'actor|101003|10100313|0|10100313|ultimate',
      'actor|101003|10100312|1|10100326|star-combo',
      'kibo|500001|504004|0|504004|active',
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
      action =>
        action.identity === 'actor|101003|10100312|0|10100312|star-skill'
    );
    expect(starSkill.actionTiming).toMatchObject({
      occupancy: { durationFrames: 93 },
      animation: { durationFrames: 180 },
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
        actionCount: 646,
      },
      summary: {
        directoryActionCount: 646,
        classifiedActionCount: 646,
        attackInputChainCount: 20,
        attackInputSegmentCount: 95,
      },
      missingRequiredActorActions: [],
    });
    expect(mechanicsPackage.actionMappings).toHaveLength(646);
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
    ).toBe(448);
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

  it('resolves zero-distance projectiles and applies hit overrides per stable hit identity', () => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
    const normal = mechanicsPackage.actionMappings.find(
      mapping =>
        mapping.ownerId === 101003 && mapping.actionKind === 'normal-attack'
    );
    const segment = normal.attackInputSegments.find(
      item => item.controlSkillId === 10100303
    );
    const baseAction = {
      id: 'han-projectile-a3',
      type: 'skill',
      skillId: normal.sourceSkillId,
      attackSequenceIndex: segment.sequenceIndex,
      attackInput: segment,
      actor: { characterId: 101003 },
    };
    const resolved = resolveVerifiedCombatActionMechanics(baseAction);
    expect(resolved.hits).toHaveLength(3);
    expect(resolved.hits.map(hit => hit.trigger.impactFrame)).toEqual([
      13, 16, 19,
    ]);
    expect(
      resolved.hits.every(
        hit =>
          hit.sourceEvidenceStatus === 'runtime-dependent' &&
          hit.scenarioRuntimeStatus === 'scenario-assumed-zero-distance' &&
          hit.trigger.travelFrames === 0 &&
          hit.trigger.impactFrame === hit.trigger.launchFrame
      )
    ).toBe(true);
    expect(new Set(resolved.hits.map(hit => hit.hitIdentity)).size).toBe(3);

    const disabledIdentity = resolved.hits[1].hitIdentity;
    const overridden = resolveVerifiedCombatActionMechanics({
      ...baseAction,
      hitOverrides: { [disabledIdentity]: { willHit: false } },
    });
    expect(overridden.allHits).toHaveLength(3);
    expect(overridden.disabledHitIdentities).toEqual([disabledIdentity]);
    expect(overridden.hits.map(hit => hit.trigger.impactFrame)).toEqual([
      13, 19,
    ]);
    const outsideZeroDistanceScenario = resolveVerifiedCombatActionMechanics(
      baseAction,
      {
        combatScenario: {
          projectile: { targetDistance: 1, defaultWillHit: true },
        },
      }
    );
    expect(outsideZeroDistanceScenario.hits).toEqual([]);
    expect(
      outsideZeroDistanceScenario.scenarioUnavailableHitIdentities
    ).toHaveLength(3);

    const mixedMapping = mechanicsPackage.actionMappings.find(
      mapping =>
        mapping.identity === 'actor|111001|11100121|0|11100121|star-carry'
    );
    const mixed = resolveVerifiedCombatActionMechanics({
      id: 'falanta-mixed-hit',
      type: 'skill',
      skillId: mixedMapping.sourceSkillId,
      actionVariantIndex: mixedMapping.actionVariantIndex,
      actor: { characterId: mixedMapping.ownerId },
    });
    const projectile = mixed.hits.find(
      hit => hit.referenceKind === 'bulletElements'
    );
    const directIdentities = mixed.hits
      .filter(hit => hit.referenceKind !== 'bulletElements')
      .map(hit => hit.hitIdentity);
    const mixedOverride = resolveVerifiedCombatActionMechanics({
      id: 'falanta-mixed-hit',
      type: 'skill',
      skillId: mixedMapping.sourceSkillId,
      actionVariantIndex: mixedMapping.actionVariantIndex,
      actor: { characterId: mixedMapping.ownerId },
      hitOverrides: { [projectile.hitIdentity]: { willHit: false } },
    });
    expect(mixedOverride.hits.map(hit => hit.hitIdentity)).toEqual(
      expect.arrayContaining(directIdentities)
    );
    expect(
      mixedOverride.hits.some(hit => hit.hitIdentity === projectile.hitIdentity)
    ).toBe(false);
  });

  it('suppresses Miti spawned orb streams when their parent arrow misses', () => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
    const chargedMapping = mechanicsPackage.actionMappings.find(
      mapping =>
        mapping.ownerId === 108003 &&
        mapping.sourceSkillId === 10800301 &&
        mapping.actionKind === 'charged-attack'
    );
    const derivedControl = mechanicsPackage.actionVariantGraph.derivedControlContracts.find(
      contract =>
        contract.ownerId === 108003 && contract.controlSkillId === 10800310
    );
    const fullCharge = derivedControl.inputSelector.options.find(
      option => option.selectorIdentity === 'miti-charged-full'
    );
    const control = mechanicsPackage.actionVariantControlBindings.find(
      binding => binding.controlSkillId === fullCharge.executionControlSkillId
    );
    const arrows = control.hits.filter(hit => hit.elementId === 108003126);
    const resolveFullCharge = hitOverrides =>
      resolveVerifiedCombatActionMechanics(
        {
          id: 'miti-full-charge-hit-activation',
          type: 'skill',
          skillId: chargedMapping.sourceSkillId,
          actionVariantIndex: chargedMapping.actionVariantIndex,
          actor: { characterId: 108003 },
          hitOverrides,
        },
        {
          selectedControlSkillId: fullCharge.executionControlSkillId,
          selectedSubSkillIndex: fullCharge.executionSubSkillIndex,
          selectionSource: {
            ...fullCharge,
            sourceKind: 'verified-action-variant-runtime',
          },
        }
      );

    const baseline = resolveFullCharge({});
    expect(baseline.hits.filter(hit => hit.elementId === 108003126)).toHaveLength(
      3
    );
    expect(baseline.hits.filter(hit => hit.elementId === 108003129)).toHaveLength(
      36
    );

    const firstExtraArrow = arrows.find(
      hit =>
        hit.sourceBindingIdentity ===
        'conditional-hit-group:miti-electrified-full-charge-extra-arrows'
    );
    const partialMiss = resolveFullCharge({
      [firstExtraArrow.hitIdentity]: { willHit: false },
    });
    expect(
      partialMiss.hits.filter(hit => hit.elementId === 108003126)
    ).toHaveLength(2);
    expect(
      partialMiss.hits.filter(hit => hit.elementId === 108003129)
    ).toHaveLength(24);
    expect(partialMiss.hitActivationSuppressedHitIdentities).toHaveLength(12);

    const allMiss = resolveFullCharge(
      Object.fromEntries(
        arrows.map(hit => [hit.hitIdentity, { willHit: false }])
      )
    );
    expect(allMiss.hits).toEqual([]);
    expect(allMiss.disabledHitIdentities).toHaveLength(3);
    expect(allMiss.hitActivationSuppressedHitIdentities).toHaveLength(36);
    expect(
      allMiss.hitActivationEvaluations.every(
        evaluation =>
          evaluation.applied === false &&
          evaluation.reason === 'required-source-hit-not-landed'
      )
    ).toBe(true);
  });

  it('hydrates deduplicated semantic effects for the selected action variant', () => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
    const resolution = resolveVerifiedCombatActionMechanics({
      id: 'fire-kibo-signature',
      type: 'kiboEvent',
      skillId: 50003901,
      actionVariantIndex: 0,
      kiboId: 500039,
      actor: {
        characterId: 101007,
        loadout: { kiboId: 500039 },
      },
    });

    expect(mechanicsPackage.semanticEffectCatalog.summary).toMatchObject({
      fullSemanticEffectCount: 3440,
      runtimeEffectCount: 392,
      compiledPassiveEffectCount: 41,
      runtimeFormulaCount: 161,
    });
    expect(
      mechanicsPackage.semanticEffectCatalog.semanticEffects.every(
        effect =>
          effect.role === 'gameplay-effect' &&
          effect.classification === 'applied' &&
          effect.placementResolution === 'static-resolved'
      )
    ).toBe(true);
    expect(resolution.semanticEffects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'gameplay-effect',
          classification: 'applied',
          target: expect.objectContaining({ kind: 'team-actors' }),
          formula: expect.objectContaining({
            commonFunctionId: 1,
            baseFunctionId: 5,
            parameterSets: expect.any(Array),
          }),
        }),
        expect.objectContaining({
          target: expect.objectContaining({ kind: 'team-kibos' }),
        }),
      ])
    );
  });

  it('accepts only an exact declarative runtime binding as zero-hit action mechanics', () => {
    const fixture = structuredClone(mechanicsPackage);
    installVerifiedCombatMechanicsPackage(fixture);
    const mapping = fixture.actionMappings.find(
      candidate =>
        candidate.ownerKind === 'actor' &&
        candidate.actionKind === 'star-carry' &&
        candidate.classification === 'applied' &&
        candidate.selectedSubSkillIndex != null
    );
    expect(mapping).toBeTruthy();
    const controlBinding = [
      ...fixture.controlBindings,
      ...fixture.actionVariantControlBindings,
    ].find(candidate => candidate.controlSkillId === mapping.controlSkillId);
    expect(controlBinding).toBeTruthy();
    controlBinding.hits = [];
    controlBinding.effects = [];
    controlBinding.logic = {
      ...(controlBinding.logic ?? {}),
      spCost: 0,
    };
    mapping.selectedHitIdentities = [];
    mapping.selectedEffectIdentities = [];
    mapping.runtimeHitCount = 0;
    mapping.runtimeEffectCount = 0;
    fixture.specialResourceCatalog.operationBindings =
      fixture.specialResourceCatalog.operationBindings.filter(
        operation =>
          !(
            Number(operation.ownerId) === Number(mapping.ownerId) &&
            Number(operation.controlSkillId) ===
              Number(mapping.controlSkillId) &&
            Number(operation.subSkillIndex) ===
              Number(mapping.selectedSubSkillIndex)
          )
      );
    const binding = {
      ownerId: mapping.ownerId,
      bindingIdentity: 'synthetic-zero-hit-runtime-effect',
      triggerKind: 'action-frame',
      controlSkillId: mapping.controlSkillId,
      subSkillIndex: mapping.selectedSubSkillIndex,
      triggerFrame: 1,
      frameRate: 60,
      targetKind: 'source-actor',
      effectId: 'battle-element:990001',
      durationMs: 1000,
      modifiers: [],
      directSp: null,
      runtimeOwnerScope: 'scenario-roster',
      applied: true,
    };
    fixture.actionVariantGraph.runtimeEffectBindings ??= [];
    fixture.actionVariantGraph.runtimeEffectBindings.push(binding);
    const action = {
      id: 'synthetic-zero-hit-runtime-action',
      type: 'skill',
      skillId: mapping.sourceSkillId,
      actionVariantIndex: mapping.actionVariantIndex,
      actor: { characterId: mapping.ownerId },
    };

    expect(resolveVerifiedCombatActionMechanics(action)).toMatchObject({
      status: 'verified-combat-action-mechanics-ready',
      ready: true,
      applied: true,
      hits: [],
      effects: [],
      runtimeEffectBindingIdentities: ['synthetic-zero-hit-runtime-effect'],
    });

    binding.controlSkillId += 1;
    expect(resolveVerifiedCombatActionMechanics(action)).toMatchObject({
      status: 'verified-control-binding-missing',
      ready: false,
      applied: false,
    });
  });

  it('validates switch-trigger summaries from their profiles instead of a frozen resolution count', () => {
    const upgraded = structuredClone(mechanicsPackage);
    const profiles = upgraded.switchTriggerCatalog.profiles;
    const candidateIndex = profiles.findIndex(
      profile => profile.applied !== true
    );
    expect(candidateIndex).toBeGreaterThanOrEqual(0);
    profiles[candidateIndex] = {
      ...profiles[candidateIndex],
      starCarryActionIdentity: 'fixture:resolved-star-carry-action',
      mechanicsClassification: 'applied',
      mechanicsReasons: [],
      resolutionStatus: 'applied',
      reasons: [],
      applied: true,
    };
    const appliedProfiles = profiles.filter(
      profile => profile.applied === true
    );
    const unresolvedProfiles = profiles.filter(
      profile => profile.applied !== true
    );
    const onEnterProfiles = profiles.filter(
      profile => profile.triggerPhase === 'on-enter'
    );
    const onExitProfiles = profiles.filter(
      profile => profile.triggerPhase === 'on-exit'
    );
    upgraded.switchTriggerCatalog.summary = {
      ...upgraded.switchTriggerCatalog.summary,
      profileCount: profiles.length,
      appliedProfileCount: appliedProfiles.length,
      unresolvedProfileCount: unresolvedProfiles.length,
      onEnterProfileCount: onEnterProfiles.length,
      onExitProfileCount: onExitProfiles.length,
      appliedOnEnterProfileCount: onEnterProfiles.filter(
        profile => profile.applied === true
      ).length,
      appliedOnExitProfileCount: onExitProfiles.filter(
        profile => profile.applied === true
      ).length,
      switchTriggeredOnlyCount: profiles.filter(
        profile => profile.manualReleaseStatus === 'switch-trigger-only'
      ).length,
    };

    expect(validateVerifiedCombatMechanicsPackage(upgraded)).toMatchObject({
      valid: true,
      issues: [],
    });

    const inconsistent = structuredClone(upgraded);
    inconsistent.switchTriggerCatalog.summary.appliedProfileCount -= 1;
    expect(validateVerifiedCombatMechanicsPackage(inconsistent)).toMatchObject({
      valid: false,
      issues: expect.arrayContaining(['switch-trigger-catalog-invalid']),
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

  it('publishes the incrementally resynced Battle source names', () => {
    const source = mechanicsPackage.sourceFiles.find(
      item => item.id === 'battle-element-index'
    );
    const nodes = mechanicsPackage.battleEffectCatalog.nodes;

    expect(source).toMatchObject({
      sha256:
        '059535b45b7b64db59e5cdc49eb6f60bf9fc4b1bb547aaa74f773f2752406346',
      bytes: 43759616,
    });
    expect(nodes.find(node => node.elementId === 101003087)).toMatchObject({
      rawSourceName: '普攻1 子弹hit1',
      sourceNameStatus: 'source-name-ready',
      displayLabel: '普攻1 子弹hit1',
    });
    expect(nodes.find(node => node.elementId === 600014)).toMatchObject({
      rawSourceName: '【正式】宠物通用技能震屏（弱）',
      sourceNameStatus: 'source-name-ready',
      displayLabel: '【正式】宠物通用技能震屏（弱）',
    });
    expect(nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rawSourceName: '普攻2|第1段伤害',
          sourceNameStatus: 'source-name-ready',
          displayLabel: '普攻2|第1段伤害',
        }),
      ])
    );
  });

  it('rejects corrupt source text from published display labels', () => {
    const bindingIndex = mechanicsPackage.controlBindings.findIndex(
      binding => binding.hits.length > 0
    );
    const binding = mechanicsPackage.controlBindings[bindingIndex];
    const corruptPackage = {
      ...mechanicsPackage,
      controlBindings: mechanicsPackage.controlBindings.map((item, index) =>
        index === bindingIndex
          ? {
              ...item,
              hits: item.hits.map((hit, hitIndex) =>
                hitIndex === 0
                  ? { ...hit, displayLabel: '\uFFFD\uFFFD hit 1' }
                  : hit
              ),
            }
          : item
      ),
    };

    expect(
      validateVerifiedCombatMechanicsPackage(corruptPackage)
    ).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        'published-source-display-label-invalid',
      ]),
    });
    expect(binding.hits[0].displayLabel).not.toContain('\uFFFD');
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
