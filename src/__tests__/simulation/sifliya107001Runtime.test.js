import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ownerContract from '../../data/generated/character-combat-owner-contracts/107001.json';
import profile from '../../data/generated/character-combat-profiles/107001.json';
import descriptionCoverage from '../../../reports/m10/107001/description-coverage.json';
import runtimeCoverage from '../../../reports/m10/107001/runtime-coverage.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';
import { createControlledActorTimeline } from '../../simulation/runtime/controlledActorTimeline';
import { createEffectRuntimeTimeline } from '../../simulation/runtime/effectRuntimeTimeline';
import { createVerifiedActionVariantRuntime } from '../../simulation/mechanics/verifiedActionVariantRuntime';
import {
  createVerifiedCombatRuntime,
  VERIFIED_COMBAT_MECHANICS_PROFILE_ID,
} from '../../simulation/mechanics/verifiedCombatRuntime';
import { createVerifiedDamageEventGeneration } from '../../simulation/mechanics/verifiedDamageEventGeneration';
import { createVerifiedTuningMarkGeneration } from '../../simulation/mechanics/verifiedTuningMarkGeneration';

const OWNER_ID = 107001;
const ACTOR_ID = 'actor-107001';
const WIND_WORD_IDENTITY = 'actor:107001:element:107001006';
const WIND_MARK_ID = 750;
const ownerRuntimePackage = createOwnerRuntimePackage();

beforeEach(() => {
  installVerifiedCombatMechanicsPackage(ownerRuntimePackage);
});

afterEach(() => {
  clearInstalledVerifiedCombatMechanicsPackage();
});

describe('107001 Sifliya source contract', () => {
  it('keeps resource, skill-logic, tuning, and Lumi values tied to source fields', () => {
    const contracts = ownerContract.contracts;
    expect(ownerContract).toMatchObject({
      compilerVersion: 7,
      ownerId: OWNER_ID,
      status: 'character-combat-owner-contracts-compiled',
      managesResourceContracts: true,
    });

    expect(contracts.resourceProfiles).toEqual([
      expect.objectContaining({
        ownerId: OWNER_ID,
        elementId: 107001006,
        resourceIdentity: WIND_WORD_IDENTITY,
        name: '风语',
        capacity: 10,
        combineType: 4,
        stateElements: [
          expect.objectContaining({
            elementId: 107001133,
            durationMs: 12_000,
          }),
        ],
        applied: true,
      }),
    ]);
    expect(
      contracts.resourceTransactions.map(transaction => ({
        identity: transaction.operationIdentity,
        controlSkillId: transaction.controlSkillId,
        subSkillIndex: transaction.subSkillIndex,
        operation: transaction.operation,
        triggerFrame: transaction.triggerFrame,
        hitGate: transaction.hitGate?.kind ?? null,
      }))
    ).toEqual([
      {
        identity: 'sifliya-a1-wind-word-arrow-1',
        controlSkillId: 10700101,
        subSkillIndex: 0,
        operation: 'gain',
        triggerFrame: 12,
        hitGate: 'landed-action-hit',
      },
      {
        identity: 'sifliya-a2-wind-word-arrow-1',
        controlSkillId: 10700102,
        subSkillIndex: 4,
        operation: 'gain',
        triggerFrame: 7,
        hitGate: 'landed-action-hit',
      },
      {
        identity: 'sifliya-a2-wind-word-arrow-2',
        controlSkillId: 10700102,
        subSkillIndex: 4,
        operation: 'gain',
        triggerFrame: 17,
        hitGate: 'landed-action-hit',
      },
      {
        identity: 'sifliya-a3-wind-word-arrow-1',
        controlSkillId: 10700103,
        subSkillIndex: 4,
        operation: 'gain',
        triggerFrame: 31,
        hitGate: 'landed-action-hit',
      },
      {
        identity: 'sifliya-a3-wind-word-arrow-2',
        controlSkillId: 10700103,
        subSkillIndex: 4,
        operation: 'gain',
        triggerFrame: 31,
        hitGate: 'landed-action-hit',
      },
      {
        identity: 'sifliya-a3-wind-word-arrow-3',
        controlSkillId: 10700103,
        subSkillIndex: 4,
        operation: 'gain',
        triggerFrame: 31,
        hitGate: 'landed-action-hit',
      },
      {
        identity: 'sifliya-star-clear-wind-word-immunity',
        controlSkillId: 10700112,
        subSkillIndex: 0,
        operation: 'transform-remove',
        triggerFrame: 53,
        hitGate: null,
      },
    ]);

    const transition = contracts.stateMachines[0];
    expect(transition).toMatchObject({
      threshold: 10,
      resourceOperation: 'clear',
      suppressGainWhileStateActive: true,
      stateElementId: 107001133,
      stateDurationMs: 12_000,
      tuningMarkGrants: [
        expect.objectContaining({ markId: WIND_MARK_ID, stackDelta: 1 }),
      ],
      effectGrants: [
        expect.objectContaining({
          effectId: 'battle-element:107001262',
          durationMs: 24_000,
          stackMode: 'refresh',
          modifiers: [
            expect.objectContaining({
              attributeId: 21,
              bucket: 'dynamicExtra',
              valueRaw: 3000,
              propertyTags: [301],
            }),
          ],
        }),
      ],
      companionProfile: expect.objectContaining({
        unitId: 480056,
        durationMs: 12_000,
        maximumCount: 1,
        dieWithOwner: true,
        dieWithChangeHero: true,
        dieWithOutBattle: false,
        ownership: 'summoning-actor',
        targetKind: 'enemy',
      }),
    });
    expect(transition.companionProfile.periodicAttack).toMatchObject({
      skillId: 48005601,
      initialDelayMs: 5000,
      cadenceMs: 5000,
      conditionalDamageGroup: expect.objectContaining({
        triggerFrames: [24, 29, 34],
        markId: WIND_MARK_ID,
        minimumStacks: 3,
        consumesStacks: false,
        baseTemplate: expect.objectContaining({ coefficientRaw: 2300 }),
        enhancedTemplate: expect.objectContaining({ coefficientRaw: 2760 }),
      }),
    });
    expect(transition.companionProfile.actionResponses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skillId: 48005602,
          sourceControlSkillId: 10700110,
          cancelPeriodicOnStart: false,
          conditionalDamageGroup: expect.objectContaining({
            triggerFrames: [23],
            hitDelaysMs: [0, 100, 200, 300, 400],
            baseTemplate: expect.objectContaining({ coefficientRaw: 1000 }),
            enhancedTemplate: expect.objectContaining({
              coefficientRaw: 1200,
            }),
          }),
        }),
        expect.objectContaining({
          skillId: 48005603,
          sourceControlSkillId: 10700112,
          cancelPeriodicOnStart: true,
          endsCompanionAtFrame: 105,
          conditionalDamageGroup: expect.objectContaining({
            triggerFrames: [80, 85, 90, 95, 100],
          }),
        }),
      ])
    );

    expect(contracts.tuningMarkConditionalDamageGroups).toHaveLength(8);
    expect(
      contracts.tuningMarkConditionalDamageGroups.every(
        group =>
          group.markId === WIND_MARK_ID &&
          group.minimumStacks === 3 &&
          group.consumesStacks === false
      )
    ).toBe(true);
    expect(profile.contracts.tuningMarkConditionalDamageGroups).toHaveLength(8);
    expect(
      profile.runtimeCompilation.outputBindings.find(
        binding =>
          binding.packagePath ===
          'actionVariantGraph.tuningMarkConditionalDamageGroups'
      )
    ).toMatchObject({
      operator: 'tuning-mark-conditional-damage',
      recordCount: 8,
    });
    const sourceDrivenRows = Object.fromEntries(
      runtimeCoverage.actionRows.map(row => [row.actionKind, row])
    );
    expect(sourceDrivenRows['star-skill']).toMatchObject({
      sourceDrivenConditionalDamageReady: true,
      runtimeReady: true,
      hitCount: 7,
      settlementStatus: 'applied',
    });
    expect(sourceDrivenRows.ultimate).toMatchObject({
      sourceDrivenConditionalDamageReady: true,
      runtimeReady: true,
      hitCount: 6,
      settlementStatus: 'applied',
    });
    expect(sourceDrivenRows['star-combo']).toMatchObject({
      sourceDrivenConditionalDamageReady: false,
      runtimeReady: true,
      hitCount: 1,
    });
    expect(
      descriptionCoverage.entries
        .flatMap(entry => entry.publicFormSettlements)
        .find(row => row.actionKind === 'star-skill')?.settlementEvidence
    ).toContain(
      'tuning-mark-conditional-damage-group:sifliya-star-final-projectiles'
    );
    expect(contracts.passives).toEqual([
      expect.objectContaining({
        skillId: 10700161,
        runtimeGenerationMode: 'tuning-mark-threshold-property-runtime',
        markId: WIND_MARK_ID,
        minimumStacks: 3,
        modifiers: [
          expect.objectContaining({
            attributeId: 1,
            bucket: 'dynamicPercent',
            valueRaw: 1600,
          }),
        ],
      }),
    ]);

    expect(findControl(10700110).logic).toMatchObject({
      cooldownMs: 0,
      spCost: 0,
      holdTriggerTimeMs: 250,
    });
    expect(findControl(10700112).logic).toMatchObject({
      cooldownMs: 18_000,
      spCost: 0,
    });
    expect(findControl(10700113).logic).toMatchObject({
      cooldownMs: 0,
      spCost: 100,
    });
    expect(findControl(10700121).logic).toMatchObject({
      cooldownMs: 24_000,
      spCost: 0,
    });
    expect(findControl(10700121).hits).toHaveLength(5);
    expect(
      findControl(10700121).hits.map(hit => hit.trigger.startFrame)
    ).toEqual([60, 60, 60, 60, 60]);
    expect(
      findControl(10700126).hits.filter(
        hit => Number(hit.trigger?.subSkillIndexes?.[0]) === 0
      )
    ).toHaveLength(1);
  });
});

describe('107001 Sifliya focused runtime', () => {
  it('counts landed arrows independently, clears at ten, and rejects miss or execution-block counterexamples', () => {
    const actions = [
      createNormalAction('cycle-1-a1', 1, 0),
      createNormalAction('cycle-1-a2', 2, 100),
      createNormalAction('cycle-1-a3', 3, 200),
      createNormalAction('cycle-2-a1', 1, 400),
      createNormalAction('cycle-2-a2', 2, 500),
      createNormalAction('cycle-2-a3', 3, 600),
    ];
    const result = runFocusedRuntime({ actions, durationMs: 13_000 });
    const gains = result.actionRuntime.resourceEvents.filter(
      event => event.payload.operation === 'gain'
    );
    const clears = result.actionRuntime.resourceEvents.filter(
      event => event.payload.operation === 'threshold-clear'
    );

    expect(result.actionRuntime.resourceGateEvents).toHaveLength(12);
    expect(
      result.actionRuntime.resourceGateEvents.every(
        event => event.payload.passed === true
      )
    ).toBe(true);
    expect(gains).toHaveLength(10);
    expect(gains.map(event => event.payload.afterValue)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(clears).toEqual([
      expect.objectContaining({
        actionId: 'cycle-2-a3',
        payload: expect.objectContaining({
          beforeValue: 10,
          afterValue: 0,
          stateElementId: 107001133,
          stateDurationMs: 12_000,
        }),
      }),
    ]);
    expect(result.actionRuntime.finalState[0].currentValue).toBe(0);

    const a3HitIdentities = findControl(10700103)
      .hits.filter(hit => hit.mapIndex === 4 && hit.elementId === 107001009)
      .map(hit => hit.hitIdentity);
    const missed = createNormalAction('missed-a3', 3, 0, {
      hitOverrides: {
        [a3HitIdentities[0]]: { willHit: false },
      },
    });
    const missResult = runFocusedRuntime({
      actions: [missed],
      durationMs: 2000,
      initialSpecialResource: 7,
    });
    expect(
      missResult.actionRuntime.resourceGateEvents.map(
        event => event.payload.passed
      )
    ).toEqual([false, true, true]);
    expect(
      missResult.actionRuntime.resourceEvents.filter(
        event => event.payload.operation === 'gain'
      )
    ).toHaveLength(2);
    expect(missResult.actionRuntime.finalState[0].currentValue).toBe(9);
    expect(
      missResult.actionRuntime.resourceEvents.some(
        event => event.payload.operation === 'threshold-clear'
      )
    ).toBe(false);

    const blocked = runFocusedRuntime({
      actions: [createNormalAction('blocked-a3', 3, 0)],
      durationMs: 2000,
      initialSpecialResource: 7,
      executionByActionId: { 'blocked-a3': false },
    });
    expect(blocked.actionRuntime.resourceGateEvents).toEqual([]);
    expect(blocked.actionRuntime.resourceEvents).toEqual([]);
    expect(blocked.actionRuntime.finalState[0].currentValue).toBe(7);
  });

  it('summons Lumi for twelve seconds and runs two five-second periodic volleys against the owner target', () => {
    const result = runFocusedRuntime({
      actions: [createNormalAction('summon-lumi', 1, 0)],
      durationMs: 13_000,
      initialSpecialResource: 9,
      initialWindMarks: 2,
    });
    const companionResults =
      result.tuningRuntime.conditionalDamageResults.filter(
        entry => entry.sourceKind === 'companion'
      );

    expect(projectCompanionEvents(result.actionRuntime)).toEqual([
      { kind: 'summon', timeMs: 200, reason: null, attackCount: null },
      { kind: 'periodic', timeMs: 5200, reason: null, attackCount: 3 },
      { kind: 'periodic', timeMs: 10_200, reason: null, attackCount: 3 },
      {
        kind: 'despawn',
        timeMs: 12_200,
        reason: 'duration-expired',
        attackCount: null,
      },
    ]);
    expect(result.actionRuntime.companionAttackTransactions).toHaveLength(6);
    expect(
      result.actionRuntime.companionAttackTransactions.map(transaction => ({
        timeMs: roundMs(transaction.timeMs),
        unitId: transaction.companionUnitId,
        ownership: transaction.ownership,
        targetKind: transaction.targetKind,
      }))
    ).toEqual([
      {
        timeMs: 5600,
        unitId: 480056,
        ownership: 'summoning-actor',
        targetKind: 'enemy',
      },
      {
        timeMs: 5683.333333,
        unitId: 480056,
        ownership: 'summoning-actor',
        targetKind: 'enemy',
      },
      {
        timeMs: 5766.666667,
        unitId: 480056,
        ownership: 'summoning-actor',
        targetKind: 'enemy',
      },
      {
        timeMs: 10_600,
        unitId: 480056,
        ownership: 'summoning-actor',
        targetKind: 'enemy',
      },
      {
        timeMs: 10_683.333333,
        unitId: 480056,
        ownership: 'summoning-actor',
        targetKind: 'enemy',
      },
      {
        timeMs: 10_766.666667,
        unitId: 480056,
        ownership: 'summoning-actor',
        targetKind: 'enemy',
      },
    ]);
    expect(companionResults).toHaveLength(6);
    expect(
      companionResults.every(
        entry =>
          entry.groupIdentity === 'sifliya-lumi-periodic-volley-damage' &&
          entry.markCountAtJudgment === 3 &&
          entry.selectedBranch === 'enhanced' &&
          entry.selectedElementId === 107001155 &&
          entry.companionUnitId === 480056 &&
          entry.ownership === 'summoning-actor'
      )
    ).toBe(true);
    expect(
      result.tuningRuntime.effectCommands.filter(
        command => command.effectId === 'battle-element:107001162'
      )
    ).toEqual([
      expect.objectContaining({
        operation: 'apply',
        timeMs: 200,
      }),
    ]);
  });

  it('links Lumi to charged and star actions while a character switch removes it immediately', () => {
    const charged = runFocusedRuntime({
      actions: [
        createNormalAction('summon-before-charged', 1, 0),
        createSkillAction('charged-response', 'charged-attack', 60),
      ],
      durationMs: 13_000,
      initialSpecialResource: 9,
      initialWindMarks: 2,
    });
    const chargedTransactions =
      charged.actionRuntime.companionAttackTransactions.filter(
        transaction =>
          transaction.attackProfile.attackIdentity ===
          'sifliya-lumi-charged-response'
      );
    const chargedDamage = charged.tuningRuntime.conditionalDamageResults.filter(
      entry => entry.groupIdentity === 'sifliya-lumi-charged-response-damage'
    );
    expect(chargedTransactions).toHaveLength(5);
    expect(
      chargedTransactions.map(transaction => roundMs(transaction.timeMs))
    ).toEqual([
      1383.333333, 1483.333333, 1583.333333, 1683.333333, 1783.333333,
    ]);
    expect(chargedDamage).toHaveLength(5);
    expect(
      chargedDamage.every(
        entry =>
          entry.selectedBranch === 'enhanced' &&
          entry.selectedElementId === 107001157 &&
          entry.markCountAtJudgment === 3
      )
    ).toBe(true);
    expect(
      charged.actionRuntime.companionEvents.filter(
        event => event.kind === 'periodic'
      )
    ).toHaveLength(2);

    const star = runFocusedRuntime({
      actions: [
        createNormalAction('summon-before-star', 1, 0),
        createSkillAction('star-response', 'star-skill', 60),
      ],
      durationMs: 6000,
      initialSpecialResource: 9,
      initialWindMarks: 2,
    });
    const starCompanionDamage =
      star.tuningRuntime.conditionalDamageResults.filter(
        entry => entry.groupIdentity === 'sifliya-lumi-star-response-damage'
      );
    expect(starCompanionDamage).toHaveLength(5);
    expect(
      starCompanionDamage.every(
        entry =>
          entry.selectedBranch === 'enhanced' &&
          entry.selectedElementId === 107001159
      )
    ).toBe(true);
    expect(
      star.actionRuntime.companionEvents.filter(
        event => event.kind === 'periodic'
      )
    ).toEqual([]);
    expect(projectCompanionEvents(star.actionRuntime).at(-1)).toEqual({
      kind: 'despawn',
      timeMs: 2750,
      reason: 'action-response-complete',
      attackCount: null,
    });

    const switched = runFocusedRuntime({
      actions: [
        createNormalAction('summon-before-switch', 1, 0),
        createSwitchAction('switch-away', 60),
      ],
      durationMs: 6000,
      initialSpecialResource: 9,
      initialWindMarks: 2,
    });
    expect(switched.actionRuntime.companionAttackTransactions).toEqual([]);
    expect(projectCompanionEvents(switched.actionRuntime).at(-1)).toEqual({
      kind: 'despawn',
      timeMs: 1000,
      reason: 'controlled-character-switched',
      attackCount: null,
    });
  });

  it('clears the threshold immunity, rebuilds ten arrows, and summons a fresh Lumi before switch-out', () => {
    const result = runFocusedRuntime({
      actions: [
        createNormalAction('first-threshold', 1, 0),
        createSkillAction('clear-threshold-state', 'star-skill', 60),
        createNormalAction('rebuild-a3-1', 3, 200),
        createNormalAction('rebuild-a3-2', 3, 320),
        createNormalAction('rebuild-a3-3', 3, 440),
        createNormalAction('rebuild-a1', 1, 560),
        createSwitchAction('switch-second-lumi', 600),
      ],
      durationMs: 11_000,
      initialSpecialResource: 9,
    });
    const lifecycle = projectCompanionEvents(result.actionRuntime).filter(
      event => ['summon', 'despawn'].includes(event.kind)
    );

    expect(lifecycle).toEqual([
      {
        kind: 'summon',
        timeMs: frameTime(12),
        reason: null,
        attackCount: null,
      },
      {
        kind: 'despawn',
        timeMs: frameTime(165),
        reason: 'action-response-complete',
        attackCount: null,
      },
      {
        kind: 'summon',
        timeMs: frameTime(572),
        reason: null,
        attackCount: null,
      },
      {
        kind: 'despawn',
        timeMs: frameTime(600),
        reason: 'controlled-character-switched',
        attackCount: null,
      },
    ]);
    expect(
      result.actionRuntime.resourceEvents.filter(
        event => event.payload.operation === 'threshold-clear'
      )
    ).toHaveLength(2);
    expect(result.actionRuntime.finalState[0].currentValue).toBe(0);
  });

  it('acquires wind before same-frame star and ultimate judgments, and a missed first hit grants nothing', () => {
    for (const testCase of [
      {
        actionKind: 'star-skill',
        actionId: 'star-first-hit',
        groupIdentity: 'sifliya-star-hit-1',
        enhancedElementId: 107001219,
        expectedHitCount: 7,
        lastGroupIdentity: 'sifliya-star-final-projectiles',
        lastHitTimeMs: 1530,
      },
      {
        actionKind: 'ultimate',
        actionId: 'ultimate-first-hit',
        groupIdentity: 'sifliya-ultimate-hit-1',
        enhancedElementId: 107001150,
        expectedHitCount: 6,
        lastGroupIdentity: 'sifliya-ultimate-hit-6',
        lastHitTimeMs: frameTime(165),
      },
    ]) {
      const action = createSkillAction(
        testCase.actionId,
        testCase.actionKind,
        0
      );
      const landed = runFocusedRuntime({
        actions: [action],
        durationMs: 4000,
        initialWindMarks: 2,
      });
      const acquire = landed.tuningRuntime.events.find(
        event => event.kind === 'acquire' && event.actionId === action.id
      );
      const firstDamage = landed.tuningRuntime.conditionalDamageResults.find(
        entry => entry.groupIdentity === testCase.groupIdentity
      );
      expect(acquire).toMatchObject({ before: 2, after: 3, delta: 1 });
      expect(firstDamage).toMatchObject({
        timeMs: acquire.timeMs,
        markCountAtJudgment: 3,
        selectedBranch: 'enhanced',
        selectedElementId: testCase.enhancedElementId,
        landed: true,
      });
      expect(landed.tuningRuntime.conditionalDamageResults).toHaveLength(
        testCase.expectedHitCount
      );
      expect(
        landed.tuningRuntime.conditionalDamageResults
          .filter(entry => entry.groupIdentity === testCase.lastGroupIdentity)
          .at(-1)
      ).toMatchObject({
        timeMs: testCase.lastHitTimeMs,
        landed: true,
        applied: true,
      });

      const hitIdentity = `conditional-damage:${testCase.groupIdentity}:1`;
      const missedAction = {
        ...createSkillAction(
          `${testCase.actionId}-missed`,
          testCase.actionKind,
          0
        ),
        hitOverrides: { [hitIdentity]: { willHit: false } },
      };
      const missed = runFocusedRuntime({
        actions: [missedAction],
        durationMs: 4000,
        initialWindMarks: 2,
      });
      const missedDamage = missed.tuningRuntime.conditionalDamageResults.find(
        entry => entry.groupIdentity === testCase.groupIdentity
      );
      expect(
        missed.tuningRuntime.events.some(
          event =>
            event.kind === 'acquire' && event.actionId === missedAction.id
        )
      ).toBe(false);
      expect(missed.tuningRuntime.acquisitionGateResults).toEqual([]);
      expect(missedDamage).toMatchObject({
        markCountAtJudgment: 2,
        selectedBranch: 'base',
        landed: false,
        applied: false,
      });
      expect(findWindState(missed.tuningRuntime).currentValue).toBe(2);

      const blocked = runFocusedRuntime({
        actions: [
          createSkillAction(
            `${testCase.actionId}-blocked`,
            testCase.actionKind,
            0
          ),
        ],
        durationMs: 4000,
        initialWindMarks: 2,
        executionByActionId: {
          [`${testCase.actionId}-blocked`]: false,
        },
      });
      expect(blocked.tuningRuntime.conditionalDamageResults).toEqual([]);
      expect(findWindState(blocked.tuningRuntime).currentValue).toBe(2);
    }
  });

  it('refreshes the shared twenty-second decay at cap and expires before an exact-time acquisition', () => {
    const capped = runFocusedRuntime({
      actions: [createSkillAction('star-at-cap', 'star-skill', 0)],
      durationMs: 1000,
      initialWindMarks: 5,
      initialWindDecayMs: 5000,
    });
    expect(
      capped.tuningRuntime.events.find(
        event => event.kind === 'acquire' && event.actionId === 'star-at-cap'
      )
    ).toMatchObject({ before: 5, after: 5, delta: 0 });
    expect(findWindState(capped.tuningRuntime)).toMatchObject({
      currentValue: 5,
      decayRemainingMs: 19_166.666667,
    });

    const exactTimeAction = createSkillAction(
      'star-at-decay-boundary',
      'star-skill',
      1190
    );
    const exactTime = runFocusedRuntime({
      actions: [exactTimeAction],
      durationMs: 21_000,
      initialWindMarks: 3,
      initialWindDecayMs: 20_000,
    });
    const boundaryEvents = exactTime.tuningRuntime.events.filter(
      event => event.markId === WIND_MARK_ID && event.timeMs === 20_000
    );
    expect(boundaryEvents.map(event => event.kind)).toEqual([
      'expire',
      'acquire',
    ]);
    expect(boundaryEvents).toEqual([
      expect.objectContaining({ before: 3, after: 2, delta: -1 }),
      expect.objectContaining({ before: 2, after: 3, delta: 1 }),
    ]);
    expect(
      exactTime.tuningRuntime.conditionalDamageResults.find(
        entry => entry.groupIdentity === 'sifliya-star-hit-1'
      )
    ).toMatchObject({
      timeMs: 20_000,
      markCountAtJudgment: 3,
      selectedBranch: 'enhanced',
    });

    const sequential = runFocusedRuntime({
      actions: [createSkillAction('star-sequential-decay', 'star-skill', 0)],
      durationMs: 41_000,
      initialWindMarks: 2,
      initialWindDecayMs: 20_000,
    });
    const expiryTimes = sequential.tuningRuntime.events
      .filter(event => event.kind === 'expire' && event.markId === WIND_MARK_ID)
      .map(event => event.timeMs);
    expect(expiryTimes.slice(0, 2)).toEqual([20_166.666667, 40_166.666667]);
    expect(expiryTimes[1] - expiryTimes[0]).toBeCloseTo(20_000, 8);
  });

  it('keeps the last star projectile packet and drops it when occupancy is interrupted at frame 90', () => {
    const full = runFocusedRuntime({
      actions: [createSkillAction('star-full', 'star-skill', 0)],
      durationMs: 3000,
      initialWindMarks: 2,
    });
    const fullResults = full.tuningRuntime.conditionalDamageResults.filter(
      entry => entry.sourceKind === 'owner-action'
    );
    expect(fullResults).toHaveLength(7);
    expect(
      fullResults
        .filter(
          entry => entry.groupIdentity === 'sifliya-star-final-projectiles'
        )
        .map(entry => entry.timeMs)
    ).toEqual([1500, 1515, 1530]);

    const interruptedAction = {
      ...createSkillAction('star-interrupted', 'star-skill', 0),
      contextualEffectiveEndMs: frameTime(90),
    };
    const interrupted = runFocusedRuntime({
      actions: [interruptedAction],
      durationMs: 3000,
      initialWindMarks: 2,
    });
    const interruptedResults =
      interrupted.tuningRuntime.conditionalDamageResults.filter(
        entry => entry.sourceKind === 'owner-action'
      );
    expect(interruptedResults).toHaveLength(4);
    expect(
      interruptedResults.some(
        entry => entry.groupIdentity === 'sifliya-star-final-projectiles'
      )
    ).toBe(false);
  });

  it('settles source coefficient conditional hits through the ordinary damage path', () => {
    const prepared = runFocusedRuntime({
      actions: [createSkillAction('star-damage-settlement', 'star-skill', 0)],
      durationMs: 3000,
      initialWindMarks: 2,
    });
    const damageEventGeneration = createVerifiedDamageEventGeneration({
      scenario: prepared.scenario,
      actionExecutionPlan: prepared.actionExecutionPlan,
      actionResolutionById: prepared.actionRuntime.actionResolutionById,
      tuningGeneration: prepared.tuningRuntime,
    });
    expect(damageEventGeneration.summary).toMatchObject({
      conditionalHitTransactionCount: 7,
    });
    expect(
      damageEventGeneration.transactions
        .filter(transaction => transaction.sourceKind === 'conditional-hit')
        .every(
          transaction =>
            transaction.hit.formula.coefficientRaw > 0 &&
            transaction.beforeEvent.eventContext.sourceHitIdentity.startsWith(
              'conditional-damage:'
            )
        )
    ).toBe(true);

    const controlledActorTimeline = createControlledActorTimeline({
      scenario: prepared.scenario,
      actionExecutionPlan: prepared.actionExecutionPlan,
    });
    const effectTimeline = createEffectRuntimeTimeline({
      scenario: prepared.scenario,
      actionExecutionPlan: prepared.actionExecutionPlan,
      controlledActorTimeline,
      generatedCommands: [
        ...prepared.actionRuntime.effectCommands,
        ...prepared.tuningRuntime.effectCommands,
      ],
    });
    const combatRuntime = createVerifiedCombatRuntime({
      scenario: prepared.scenario,
      actionExecutionPlan: prepared.actionExecutionPlan,
      controlledActorTimeline,
      tuningGeneration: prepared.tuningRuntime,
      damageEventGeneration,
      effectTimeline,
      actionVariantRuntime: prepared.actionRuntime,
    });
    const conditionalHits = combatRuntime.damageEvents.filter(
      event => event.payload.tuningConditionalDamage === true
    );
    expect(conditionalHits).toHaveLength(7);
    expect(
      conditionalHits.every(
        event =>
          event.actionId === 'star-damage-settlement' &&
          event.payload.tuningConditionalDamageBranch === 'enhanced' &&
          event.payload.tuningConditionalDamageMarkCount >= 3 &&
          event.payload.rawDamage > 0 &&
          event.payload.damageEventContext?.sourceKind === 'conditional-hit'
      )
    ).toBe(true);
  });

  it('uses a right-open twenty-four-second effect interval for refresh versus reapply', () => {
    const runBoundary = secondActionStartMs => {
      clearInstalledVerifiedCombatMechanicsPackage();
      installVerifiedCombatMechanicsPackage(
        createEffectBoundaryRuntimePackage()
      );
      return runFocusedRuntime({
        actions: [
          createNormalAction('effect-proc-1', 1, 0),
          createNormalAction(
            'effect-proc-2',
            1,
            (secondActionStartMs * 60) / 1000
          ),
        ],
        durationMs: 25_000,
      }).actionRuntime.effectCommands.filter(
        command => command.effectId === 'battle-element:107001262'
      );
    };

    const overlapping = runBoundary(23_999);
    expect(overlapping.map(command => command.operation)).toEqual([
      'apply',
      'refresh',
    ]);
    expect(overlapping.map(command => command.timeMs)).toEqual([200, 24_199]);

    const exactExpiry = runBoundary(24_000);
    expect(exactExpiry.map(command => command.operation)).toEqual([
      'apply',
      'apply',
    ]);
    expect(exactExpiry.map(command => command.timeMs)).toEqual([200, 24_200]);
  });
});

function createOwnerRuntimePackage() {
  const result = structuredClone(mechanicsPackage);
  const contracts = ownerContract.contracts;
  const replaceOwner = (records, additions) => [
    ...(records ?? []).filter(record => Number(record.ownerId) !== OWNER_ID),
    ...structuredClone(additions),
  ];
  const controlSkillIds = new Set(
    contracts.controls.map(control => Number(control.controlSkillId))
  );

  result.actionMappings = replaceOwner(
    result.actionMappings,
    contracts.publicActions
  );
  result.actionVariantControlBindings = [
    ...(result.actionVariantControlBindings ?? []).filter(
      control => !controlSkillIds.has(Number(control.controlSkillId))
    ),
    ...structuredClone(contracts.controls),
  ];
  result.actionVariantGraph.publicActionForms = replaceOwner(
    result.actionVariantGraph.publicActionForms,
    contracts.actionForms
  );
  result.actionVariantGraph.attackInputChains = replaceOwner(
    result.actionVariantGraph.attackInputChains,
    contracts.attackInputChains
  );
  result.actionVariantGraph.tuningMarkConditionalDamageGroups = replaceOwner(
    result.actionVariantGraph.tuningMarkConditionalDamageGroups,
    contracts.tuningMarkConditionalDamageGroups
  );
  result.specialResourceCatalog.profiles = replaceOwner(
    result.specialResourceCatalog.profiles,
    contracts.resourceProfiles
  );
  result.specialResourceCatalog.operationBindings = replaceOwner(
    result.specialResourceCatalog.operationBindings,
    contracts.resourceTransactions
  );
  result.specialResourceCatalog.thresholdTransitions = replaceOwner(
    result.specialResourceCatalog.thresholdTransitions,
    contracts.stateMachines
  );
  result.specialResourceCatalog.passiveEffects = replaceOwner(
    result.specialResourceCatalog.passiveEffects,
    contracts.passives
  );
  return result;
}

function createEffectBoundaryRuntimePackage() {
  const result = createOwnerRuntimePackage();
  const profile = result.specialResourceCatalog.profiles.find(
    item => Number(item.ownerId) === OWNER_ID
  );
  profile.capacity = 1;
  const a1 = result.specialResourceCatalog.operationBindings.find(
    item => item.operationIdentity === 'sifliya-a1-wind-word-arrow-1'
  );
  result.specialResourceCatalog.operationBindings = [
    ...result.specialResourceCatalog.operationBindings.filter(
      item => Number(item.ownerId) !== OWNER_ID
    ),
    a1,
  ];
  const transition = result.specialResourceCatalog.thresholdTransitions.find(
    item => Number(item.ownerId) === OWNER_ID
  );
  transition.threshold = 1;
  transition.tuningMarkGrants = [];
  transition.companionProfile = null;
  return result;
}

function createNormalAction(id, sequenceIndex, startFrame, overrides = {}) {
  const mapping = ownerContract.contracts.publicActions.find(
    action => action.actionKind === 'normal-attack'
  );
  const segment = mapping.attackInputSegments.find(
    item => Number(item.sequenceIndex) === Number(sequenceIndex)
  );
  return {
    id,
    type: 'skill',
    name: id,
    actorId: ACTOR_ID,
    actor: createActor(),
    skillId: mapping.sourceSkillId,
    skillLevel: 1,
    actionKind: 'normal-attack',
    actionVariantIndex: mapping.actionVariantIndex,
    controlSubSkillIndex: segment.selectedSubSkillIndex,
    startMs: frameTime(startFrame),
    durationMs: frameTime(segment.durationFrames),
    durationFrames: segment.durationFrames,
    attackGroupId: `${id}-group`,
    attackSequenceIndex: sequenceIndex,
    attackSequenceTotal: segment.sequenceTotal,
    attackInput: structuredClone(segment),
    ...overrides,
  };
}

function createSkillAction(id, actionKind, startFrame) {
  const mapping = ownerContract.contracts.publicActions.find(
    action => action.actionKind === actionKind
  );
  const durationFrames =
    mapping.actionTiming?.occupancy?.durationFrames ??
    findControl(mapping.controlSkillId).frameCounts[0].frameCount;
  return {
    id,
    type: 'skill',
    name: id,
    actorId: ACTOR_ID,
    actor: createActor(),
    skillId: mapping.sourceSkillId,
    skillLevel: 1,
    actionKind,
    actionVariantIndex: mapping.actionVariantIndex,
    controlSubSkillIndex: mapping.selectedSubSkillIndex,
    startMs: frameTime(startFrame),
    durationMs: frameTime(durationFrames),
    durationFrames,
  };
}

function createSwitchAction(id, startFrame) {
  return {
    id,
    type: 'switch',
    name: id,
    actorId: ACTOR_ID,
    actor: createActor(),
    startMs: frameTime(startFrame),
    durationMs: 0,
  };
}

function createActor() {
  return {
    id: ACTOR_ID,
    characterId: OWNER_ID,
    name: '西芙莉雅',
    initialSp: 100,
    baseAttributes: [
      { key: 'ATK', value: 1000 },
      { key: 'MAXHP', value: 10_000 },
      { key: 'CRI', value: 0 },
      { key: 'CRI_DMG', value: 5000 },
      { key: 'SHOOT_DMGUP', value: 0 },
      { key: 'PHYSICAL_SHOOTDMGUP', value: 0 },
      { key: 'MAGIC_SHOOTDMGDUP', value: 0 },
      { key: 'WIND_SHOOTDMGUP', value: 0 },
    ],
  };
}

function runFocusedRuntime({
  actions,
  durationMs,
  initialSpecialResource = 0,
  initialWindMarks = 0,
  initialWindDecayMs = 20_000,
  executionByActionId = {},
}) {
  const scenario = {
    time: { durationMs, fps: 60 },
    actors: [createActor()],
    enemy: {
      id: 'boss-passive',
      enemyId: 300032,
      name: '静止 Boss',
      level: 1,
      stats: {
        maxHp: 10_000_000,
        physicalDefense: 0,
        magicalDefense: 0,
        initialToughness: 6667,
        maxToughness: 6667,
      },
      baseAttributes: [{ key: 'CRI_DEFENSE', value: 0 }],
    },
    mechanicsProfile: { profileId: VERIFIED_COMBAT_MECHANICS_PROFILE_ID },
    combatScenario: {
      projectile: { targetDistance: 0, defaultWillHit: true },
    },
    actions,
    initialRuntimeState: {
      specialResourcesByActor: [
        {
          actorId: ACTOR_ID,
          resourceIdentity: WIND_WORD_IDENTITY,
          currentValue: initialSpecialResource,
        },
      ],
      tuningMarks:
        initialWindMarks > 0
          ? [
              {
                markId: WIND_MARK_ID,
                profileKey: 'wind',
                decayRemainingMs: initialWindDecayMs,
                heldReadyRemainingMs: 0,
                layers: Array.from(
                  { length: initialWindMarks },
                  (_, index) => ({
                    sourceActionId: `inherited-wind-${index + 1}`,
                    sourceActorId: ACTOR_ID,
                    sourceIdentity: `test:inherited-wind:${index + 1}`,
                  })
                ),
              },
            ]
          : [],
    },
  };
  const actionExecutionPlan = {
    actions: actions.map(action => ({
      actionId: action.id,
      execute: executionByActionId[action.id] !== false,
    })),
  };
  const actionRuntime = createVerifiedActionVariantRuntime({
    scenario,
    actionExecutionPlan,
  });
  const tuningRuntime = createVerifiedTuningMarkGeneration({
    scenario,
    actionExecutionPlan,
    actionVariantRuntime: actionRuntime,
  });
  return { scenario, actionExecutionPlan, actionRuntime, tuningRuntime };
}

function projectCompanionEvents(runtime) {
  return runtime.companionEvents.map(event => ({
    kind: event.kind,
    timeMs: event.timeMs,
    reason: event.payload.reason ?? null,
    attackCount: event.payload.attackCount ?? null,
  }));
}

function findControl(controlSkillId) {
  return ownerContract.contracts.controls.find(
    control => Number(control.controlSkillId) === Number(controlSkillId)
  );
}

function findWindState(runtime) {
  return runtime.finalState.find(state => state.markId === WIND_MARK_ID);
}

function frameTime(frame) {
  return Math.round(((Number(frame) * 1000) / 60) * 1_000_000) / 1_000_000;
}

function roundMs(value) {
  return Math.round(Number(value) * 1_000_000) / 1_000_000;
}
