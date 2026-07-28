import { describe, expect, it } from 'vitest';
import goldenTrace from '../../../reports/m10/101003/golden-trace.json';
import reachableGraph from '../../../reports/m10/101003/reachable-graph.json';
import runtimeCapturePlan from '../../../reports/m10/101003/runtime-capture-plan.json';
import runtimeCoverage from '../../../reports/m10/101003/runtime-coverage.json';
import sourceManifest from '../../../reports/m10/101003/source-manifest.json';
import unresolvedLedger from '../../../reports/m10/101003/unresolved-ledger.json';
import { validateCharacterCombatGoldenRuntime } from '../../../scripts/character-combat/character-combat-golden-validation.mjs';
import catalog from '../../data/generated/character-combat-profile-catalog.json';
import ownerContract from '../../data/generated/character-combat-owner-contracts/101003.json';
import profile from '../../data/generated/character-combat-profiles/101003.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';

const HAN_ID = 101003;
const FIREWORK_STATE_IDENTITY = 'enemy:firework';

describe('M10-B2 Han Youyou character combat profile', () => {
  it('publishes the honest public-action and reachable-control denominator', () => {
    expect(profile).toMatchObject({
      owner: {
        ownerId: HAN_ID,
        ownerName: '寒悠悠',
      },
      pipelineMaturity: 'runtime-applied',
      combatCoverageState: 'partial',
      characterComplete: false,
      completionState: 'runtime-applied',
      denominator: {
        publicActionCount: 10,
        reachableControlCount: 30,
        executionFormCount: 14,
        hitCount: 73,
        semanticEffectCount: 40,
        excludedControlCount: 7,
      },
      validation: {
        status: 'character-combat-profile-valid',
        issues: [],
      },
    });
    expect(
      catalog.profiles.find(item => Number(item.ownerId) === HAN_ID)
    ).toMatchObject({
      profileIdentity: profile.profileIdentity,
      profileHash: profile.profileHash,
      pipelineMaturity: 'runtime-applied',
      combatCoverageState: 'partial',
      characterComplete: false,
    });
    expect(ownerContract.contracts.publicActions).toHaveLength(10);
    expect(
      ownerContract.contracts.publicActions.filter(action => action.runtimeReady)
    ).toHaveLength(10);
    expect(ownerContract.contracts.actionForms).toHaveLength(14);
    expect(
      ownerContract.contracts.actionForms.filter(form => form.applied)
    ).toHaveLength(14);
    expect(runtimeCoverage.summary).toMatchObject({
      actionCount: 10,
      runtimeReadyActionCount: 10,
      executionFormCount: 14,
      controlCount: 30,
      hitCount: 73,
      passiveCount: 2,
      switchTriggerCount: 1,
    });
    expect(sourceManifest.summary.identityCount).toBe(473);
    expect(reachableGraph.summary).toMatchObject({
      controlCount: 30,
      exclusionCount: 7,
      nodeKindCounts: {
        'public-action': 10,
        'action-form': 14,
        hit: 73,
        'passive-listener': 2,
        'switch-trigger': 1,
      },
    });
  });

  it('keeps five normal inputs and two sourced charged forms independent', () => {
    const normal = ownerContract.contracts.attackInputChains.find(
      chain => chain.chainIdentity === 'han-normal-five-inputs'
    );
    expect(
      normal.segments.map(segment => [
        segment.sequenceIndex,
        segment.controlSkillId,
        segment.subSkillIndex,
        segment.durationFrames,
      ])
    ).toEqual([
      [1, 10100301, 0, 18],
      [2, 10100302, 0, 38],
      [3, 10100303, 0, 32],
      [4, 10100304, 0, 51],
      [5, 10100305, 0, 85],
    ]);
    expect(
      goldenTrace.actual.actions.selectionByActionId[
        'han-charged-stage-one'
      ]
    ).toMatchObject({
      semanticName: '重击1段',
      controlSkillId: 10100310,
      subSkillIndex: 0,
      actualDurationFrames: 65,
    });
    expect(
      goldenTrace.actual.actions.selectionByActionId[
        'han-charged-stage-two'
      ]
    ).toMatchObject({
      semanticName: '重击2段',
      controlSkillId: 10100341,
      subSkillIndex: 0,
      actualDurationFrames: 71,
    });
    expect(
      goldenTrace.actual.combat.ownerHitCountByActionId
    ).toMatchObject({
      'han-normal-a1': 1,
      'han-normal-a2': 2,
      'han-normal-a3': 3,
      'han-normal-a4': 4,
      'han-normal-a5': 4,
      'han-charged-stage-one': 9,
      'han-charged-stage-two': 11,
    });
  });

  it('compiles Firework, conditional explosions, tuning, and both passives from one owner contract', () => {
    expect(ownerContract.contracts.targetStateProfiles).toEqual([
      expect.objectContaining({
        ownerId: HAN_ID,
        stateIdentity: FIREWORK_STATE_IDENTITY,
        name: '焰火',
        durationMs: 10000,
        maxStacks: 15,
        expiryMode: 'independent-layer',
        applied: true,
      }),
    ]);
    expect(ownerContract.contracts.targetStateTransactions).toHaveLength(8);
    expect(
      ownerContract.contracts.targetStateTransactions.map(
        transaction => transaction.triggerFrame
      )
    ).toEqual([61, 68, 73, 94, 99, 104, 109, 109]);
    expect(ownerContract.contracts.conditionalHitGroups).toEqual([
      expect.objectContaining({
        groupIdentity: 'han-charged-stage-one-firework-explosion',
        controlSkillId: 10100310,
        triggerFrames: [31, 55, 58, 62, 65],
        decisionFrame: 28,
        minimumStacks: 1,
        consumeBands: [
          expect.objectContaining({ minimumStacks: 6, amount: 6 }),
        ],
        applied: true,
      }),
      expect.objectContaining({
        groupIdentity: 'han-charged-stage-two-firework-explosion',
        controlSkillId: 10100341,
        triggerFrames: [27, 51, 54, 58, 61],
        decisionFrame: 24,
        minimumStacks: 1,
        consumeBands: [
          expect.objectContaining({ minimumStacks: 10, amount: 10 }),
          expect.objectContaining({ minimumStacks: 8, amount: 8 }),
        ],
        tuningMark: expect.objectContaining({
          profileKey: 'fire',
          stackDelta: 1,
        }),
        applied: true,
      }),
    ]);
    expect(ownerContract.contracts.runtimeEffectBindings).toHaveLength(6);
    expect(
      ownerContract.contracts.runtimeEffectBindings.filter(
        binding => binding.directSp?.value === 2
      )
    ).toHaveLength(2);
    expect(ownerContract.contracts.passives).toEqual([
      expect.objectContaining({
        passiveIdentity: 'actor:101003:passive:10100361',
        runtimeGenerationMode: 'target-state-runtime',
        durationMs: 24000,
        maxStacks: 1,
        modifiers: [
          expect.objectContaining({
            attributeId: 1,
            bucket: 'dynamicPercent',
            valueRaw: 1000,
          }),
        ],
        applied: true,
      }),
      expect.objectContaining({
        passiveIdentity: 'actor:101003:passive:10100362',
        runtimeGenerationMode: 'target-state-runtime',
        durationMs: 15000,
        maxStacks: 15,
        modifiers: [
          expect.objectContaining({
            kind: 'target-state',
            stateIdentity: FIREWORK_STATE_IDENTITY,
            amount: 1,
          }),
        ],
        applied: true,
      }),
    ]);
    expect(
      mechanicsPackage.actionVariantGraph.targetStateProfiles.some(
        state =>
          Number(state.ownerId) === HAN_ID &&
          state.stateIdentity === FIREWORK_STATE_IDENTITY
      )
    ).toBe(true);
  });

  it('replays an authoritative three-person golden and fails on a tampered Firework settlement', () => {
    expect(goldenTrace.status).toBe(
      'authoritative-golden-runtime-verified'
    );
    expect(goldenTrace.validation).toMatchObject({
      passed: true,
      failedCount: 0,
    });
    expect(goldenTrace.actual.resources.targetStateSummary).toMatchObject({
      profileCount: 1,
      eventCount: 10,
      appliedGroupCount: 2,
      skippedGroupCount: 0,
      directSpEventCount: 2,
    });
    expect(goldenTrace.actual.resources.conditionalHitGroups).toEqual([
      expect.objectContaining({
        beforeStacks: 8,
        consumedStacks: 6,
        afterStacks: 2,
        applied: true,
      }),
      expect.objectContaining({
        beforeStacks: 2,
        consumedStacks: 2,
        afterStacks: 0,
        applied: true,
      }),
    ]);
    expect(goldenTrace.actual.resources.ownerDirectSp).toEqual({
      eventCount: 2,
      totalChange: 4,
    });
    expect(
      goldenTrace.actual.resources.tuningMarkAcquireByActionId
    ).toMatchObject({
      'han-star-skill': { eventCount: 2, totalDelta: 2 },
      'han-charged-stage-two': { eventCount: 1, totalDelta: 1 },
      'han-ultimate': { eventCount: 3, totalDelta: 3 },
    });
    expect(goldenTrace.actual.effects).toMatchObject({
      passiveMaxStacks: 1,
      firstPassiveMaxStackFrame: 2029,
    });
    expect(goldenTrace.actual.dynamicProperties).toMatchObject({
      maxPercentRawByAttributeId: { 1: 1300 },
      maxExtraRawByAttributeId: { 229: 36 },
    });
    expect(goldenTrace.actual.comparison).toMatchObject({
      damageDelta: 1960,
    });

    const tampered = structuredClone(goldenTrace.actual);
    tampered.resources.conditionalHitGroups[0].afterStacks = 3;
    expect(
      validateCharacterCombatGoldenRuntime({
        actual: tampered,
        expected: goldenTrace.expected,
      })
    ).toMatchObject({
      passed: false,
      failedCount: 1,
      assertions: expect.arrayContaining([
        expect.objectContaining({
          jsonPath: 'resources.conditionalHitGroups.0.afterStacks',
          passed: false,
        }),
      ]),
    });
  });

  it('keeps the hidden Ultimate explosion in the runtime-evidence ledger instead of applying it', () => {
    expect(runtimeCapturePlan.summary.captureCount).toBe(11);
    expect(
      unresolvedLedger.records.some(record =>
        record.reasons?.includes(
          'ultimate-hidden-firework-explosion-trigger-reachability-runtime-evidence-required'
        )
      )
    ).toBe(true);
    expect(profile.characterComplete).toBe(false);
  });
});
