import { describe, expect, it } from 'vitest';
import goldenTrace from '../../../reports/m10/107002/golden-trace.json';
import runtimeCoverage from '../../../reports/m10/107002/runtime-coverage.json';
import unresolvedLedger from '../../../reports/m10/107002/unresolved-ledger.json';
import ownerContract from '../../data/generated/character-combat-owner-contracts/107002.json';
import profile from '../../data/generated/character-combat-profiles/107002.json';

const MISA_ID = 107002;

describe('M12-B3 Misa reduced action surface profile', () => {
  it('publishes an honest runtime-applied partial profile without qualification claims', () => {
    expect(ownerContract).toMatchObject({
      compilerVersion: 8,
      ownerId: MISA_ID,
      status: 'character-combat-owner-contracts-compiled',
      summary: {
        attackInputMechanicWindowCount: 1,
        actionEffectBindingCount: 4,
        actionHitBindingCount: 1,
        targetStateProfileCount: 1,
        targetStateTransactionCount: 2,
        rawDirectEffectBindingCount: 2,
        pickupProfileCount: 4,
        pickupSpawnBindingCount: 12,
        pickupAbsorbBindingCount: 1,
        scenarioOutOfScopeActionCount: 5,
      },
    });
    expect(profile).toMatchObject({
      owner: { ownerId: MISA_ID, ownerName: '米砂' },
      pipelineMaturity: 'runtime-applied',
      combatCoverageState: 'partial',
      characterComplete: false,
      completionState: 'runtime-applied',
      maturityGates: {
        gameplayGapCount: 0,
        runtimeApplied: true,
        uiVerified: false,
      },
      validation: {
        status: 'character-combat-profile-valid',
        issues: [],
      },
    });
    expect(profile).not.toHaveProperty('formalAdmission');
    expect(profile).not.toHaveProperty('optimizationReady');
    expect(runtimeCoverage.summary).toMatchObject({
      actionCount: 10,
      runtimeReadyActionCount: 4,
      executionFormCount: 10,
      controlCount: 15,
      hitCount: 67,
      targetStateProfileCount: 1,
      targetStateTransactionCount: 2,
      switchTriggerCount: 1,
    });
    expect(unresolvedLedger.summary.gameplayImpactingCount).toBe(0);
    expect(ownerContract.contracts.attackInputMechanicWindows).toEqual([
      expect.objectContaining({
        bindingIdentity: 'misa-a4-focused-mechanic-window',
        sequenceIndex: 4,
        controlSkillId: 10700204,
        lastCoveredHitFrame: 102,
        durationFrames: 103,
        coverageKind: 'focused-mechanic-window',
        fullOccupancyClaim: false,
      }),
    ]);
  });

  it('binds A3 and Ultimate pickups to distinct source-backed pools', () => {
    const pickupByIdentity = Object.fromEntries(
      ownerContract.contracts.pickupProfiles.map(pickup => [
        pickup.pickupIdentity,
        pickup,
      ])
    );
    expect(pickupByIdentity['misa-a3-hp-pickup']).toMatchObject({
      unitId: 480042,
      poolKey: 'summon-temp:107002220',
      countType: 'SummonTempData',
      lifetimeFrames: 900,
      collisionDelayFrames: 2,
      maxCount: 6,
      atCapacityPolicy: 'reject-new-conservative',
      autoCollect: false,
      collectionMode: 'owner-source-action-absorb-only',
      reward: {
        kind: 'direct-heal',
        formula: {
          commonFunctionId: 1,
          baseFunctionId: 104,
          sourceRawA: 300,
        },
      },
      tuningEffect: {
        durationMs: 24000,
        maxStacks: 4,
        expiryMode: 'independent-layer',
        atCapacityPolicy: 'ignore-new-no-refresh',
        attributeId: 229,
        bucket: 'dynamicPercent',
        valueRaw: 600,
      },
    });
    expect(pickupByIdentity['misa-star-sp-pickup']).toMatchObject({
      unitId: 480041,
      poolKey: 'summon-temp:107002214',
      countType: 'SummonTempData',
      reward: {
        kind: 'direct-sp',
        directSp: { value: 1, shareType: 2 },
      },
    });
    expect(pickupByIdentity['misa-ultimate-hp-pickup']).toMatchObject({
      unitId: 480042,
      poolKey: 'summon-id:480042',
      countType: 'SummonId',
    });
    expect(pickupByIdentity['misa-ultimate-sp-pickup']).toMatchObject({
      unitId: 480041,
      poolKey: 'summon-id:480041',
      countType: 'SummonId',
    });

    const pickupFrames = identity =>
      ownerContract.contracts.pickupSpawnBindings
        .filter(binding => binding.pickupIdentity === identity)
        .map(binding => binding.triggerFrame);
    expect(pickupFrames('misa-a3-hp-pickup')).toEqual([40, 46, 52, 58, 64, 70]);
    expect(pickupFrames('misa-star-sp-pickup')).toEqual([74, 82, 90, 99]);
    expect(
      ownerContract.contracts.pickupSpawnBindings
        .filter(binding => binding.pickupIdentity.startsWith('misa-ultimate'))
        .map(binding => [
          binding.pickupIdentity,
          binding.triggerFrame,
          binding.count,
          binding.sourceOrder,
        ])
    ).toEqual([
      ['misa-ultimate-hp-pickup', 135, 3, 20],
      ['misa-ultimate-sp-pickup', 135, 3, 21],
    ]);
    expect(ownerContract.contracts.pickupAbsorbBindings).toEqual([
      expect.objectContaining({
        bindingIdentity: 'misa-charged-absorb-all-live-pickups',
        ownerId: MISA_ID,
        controlSkillId: 10700210,
        subSkillIndex: 0,
        triggerFrame: 70,
        triggerElementId: 107002233,
        triggerElementIndex: 7,
        sourceTrackOrder: 15,
        pickupIdentities: [
          'misa-a3-hp-pickup',
          'misa-star-sp-pickup',
          'misa-ultimate-hp-pickup',
          'misa-ultimate-sp-pickup',
        ],
        collector: 'action-owner',
        settlementGate: 'successful-action-execute',
        requiresHit: false,
        sameFrameSpawnPolicy: 'exclude-same-frame-fail-closed',
        sameFrameExpiryPolicy: 'expire-before-absorb',
        triggerEvidence: expect.objectContaining({
          displacementType: 2,
          targetType: 2,
          entityFilterData: 64,
          radius: 9,
        }),
        applied: true,
      }),
    ]);
  });

  it('keeps enemy DEF, star consume, and independent wind injection ordered', () => {
    expect(ownerContract.contracts.targetStateProfiles).toEqual([
      expect.objectContaining({
        stateIdentity: 'misa-def-down',
        targetKind: 'enemy',
        durationMs: 24000,
        maxStacks: 1,
        expiryMode: 'shared-instance',
        atCapacityPolicy: 'refresh-oldest',
        modifiers: [
          expect.objectContaining({
            attributeId: 3,
            bucket: 'dynamicPercent',
            valueRaw: -1000,
          }),
          expect.objectContaining({
            attributeId: 4,
            bucket: 'dynamicPercent',
            valueRaw: -1000,
          }),
        ],
      }),
    ]);
    expect(
      ownerContract.contracts.targetStateTransactions.map(transaction => [
        transaction.controlSkillId,
        transaction.triggerFrame,
        transaction.hitSettlementOrder,
        transaction.requiresHitElementId,
      ])
    ).toEqual([
      [10700204, 84, 'after-hit', 107002242],
      [10700210, 76, 'after-hit', 107002224],
    ]);

    const starBindings = ownerContract.contracts.actionEffectBindings.filter(
      binding => Number(binding.controlSkillId) === 10700226
    );
    expect(
      starBindings.map(binding => [
        binding.bindingIdentity,
        binding.triggerFrame,
        binding.elementId,
      ])
    ).toEqual([
      ['misa-star-independent-wind-mark', 90, 750],
      ['misa-star-wood-priority-consume', 82, 599],
    ]);
    expect(
      starBindings.find(
        binding => binding.bindingIdentity === 'misa-star-wood-priority-consume'
      )?.tuningConsumeSuccessEffect
    ).toMatchObject({
      effectId: 'battle-element:107002265',
      availabilityElementId: 107002272,
      candidateMarkIds: [550, 750],
      targetKind: 'source-owner',
      durationMs: 30000,
      maxStacks: 1,
      modifiers: [
        expect.objectContaining({ attributeId: 55, valueRaw: 5 }),
        expect.objectContaining({ attributeId: 53, valueRaw: 5 }),
      ],
    });
    expect(ownerContract.contracts.actionHitBindings).toEqual([
      expect.objectContaining({
        bindingIdentity: 'misa-star-main-combo-hits',
        controlSkillId: 10700226,
        sourceControlSkillId: 10700212,
        triggerFrames: [74, 82, 90, 99, 107, 114],
        replaceTargetSubSkillElements: true,
      }),
    ]);
  });

  it('routes Target, ShareAll, and AllHero effects without broadening', () => {
    expect(ownerContract.contracts.rawDirectEffectBindings).toEqual([
      expect.objectContaining({
        bindingIdentity: 'misa-ultimate-allhero-heal',
        controlSkillId: 10700213,
        triggerFrames: [143, 155, 167, 181, 193],
        effectKind: 'heal',
        targetKind: 'team-actors',
      }),
      expect.objectContaining({
        bindingIdentity: 'misa-star-carry-allhero-heal',
        controlSkillId: 10700222,
        triggerFrames: [46, 61, 79, 98],
        effectKind: 'heal',
        targetKind: 'team-actors',
      }),
    ]);
    expect(
      goldenTrace.actual.combat.ownerDirectHealSummaryByActionId['misa-charged']
    ).toMatchObject({
      eventCount: 6,
      frames: [670, 670, 670, 670, 670, 670],
      targetIds: ['actor-107002'],
      requestedChangeTotal: 966,
      baseFunctionIds: [104],
      maximumHpSubjects: ['source-actor'],
    });
    expect(goldenTrace.actual.resources.directSpSummaryByActionId).toEqual({});
    expect(goldenTrace.actual.resources.pickupSummary).toMatchObject({
      spawnedEntityCount: 24,
      collectedEntityCount: 0,
      absorbedEntityCount: 6,
      absorbAttemptCount: 1,
      directHpEventCount: 6,
      directSpEventCount: 0,
    });
    expect(
      goldenTrace.actual.combat.ownerDirectHealSummaryByActionId[
        'misa-ultimate'
      ]
    ).toMatchObject({
      eventCount: 15,
      targetIds: ['actor-101010', 'actor-103002', 'actor-107002'],
      baseFunctionIds: [],
    });
  });

  it('keeps frozen passive-Boss exclusions structured and verifies focused replay', () => {
    expect(
      ownerContract.contracts.scenarioOutOfScopeActions
        .map(action => Number(action.controlSkillId))
        .sort((left, right) => left - right)
    ).toEqual([10700205, 10700211, 10700215, 10700225, 10700227]);
    expect(
      ownerContract.contracts.scenarioOutOfScopeActions.every(
        action => action.status === 'not-applicable' && action.applied === false
      )
    ).toBe(true);
    expect(goldenTrace).toMatchObject({
      status: 'authoritative-golden-runtime-verified',
      ownerId: MISA_ID,
      validation: {
        status: 'authoritative-golden-runtime-expectation-passed',
        passed: true,
        failedCount: 0,
      },
    });
    expect(goldenTrace.actual.actions.blockedActionIds).toEqual([
      'misa-star-before-cooldown-boundary',
    ]);
    expect(
      goldenTrace.actual.resources.tuningMarkUnresolvedByActionId[
        'misa-star-no-consume-candidate'
      ]
    ).toEqual({
      eventCount: 1,
      kinds: ['tuning-consume-no-sufficient-priority-candidate'],
      statuses: ['verified-tuning-consume-not-executed'],
    });
  });
});
