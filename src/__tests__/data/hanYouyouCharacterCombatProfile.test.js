import { describe, expect, it } from 'vitest';
import goldenTrace from '../../../reports/m10/101003/golden-trace.json';
import ultimateSwitchGolden from '../../../reports/m10/101003/ultimate-controlled-buff-switch-golden.json';
import inheritanceAudit from '../../../reports/m10/controlled-actor-inheritance-audit.json';
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
        reachableControlCount: 29,
        executionFormCount: 14,
        hitCount: 73,
        semanticEffectCount: 36,
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
      ownerContract.contracts.publicActions.filter(
        action => action.runtimeReady
      )
    ).toHaveLength(10);
    expect(ownerContract.contracts.actionForms).toHaveLength(14);
    expect(
      ownerContract.contracts.actionForms.filter(form => form.applied)
    ).toHaveLength(14);
    expect(runtimeCoverage.summary).toMatchObject({
      actionCount: 10,
      runtimeReadyActionCount: 10,
      executionFormCount: 14,
      controlCount: 29,
      hitCount: 73,
      targetStateProfileCount: 1,
      targetStateTransactionCount: 7,
      conditionalHitGroupCount: 2,
      runtimeEffectBindingCount: 6,
      passiveCount: 1,
      switchTriggerCount: 1,
    });
    expect(sourceManifest.summary.identityCount).toBe(536);
    expect(reachableGraph.summary).toMatchObject({
      controlCount: 29,
      exclusionCount: 7,
      nodeKindCounts: {
        'public-action': 10,
        'action-form': 14,
        hit: 73,
        'target-state': 1,
        'conditional-hit-group': 2,
        'runtime-effect': 6,
        'passive-listener': 1,
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
      goldenTrace.actual.actions.selectionByActionId['han-charged-stage-one']
    ).toMatchObject({
      semanticName: '重击1段',
      controlSkillId: 10100310,
      subSkillIndex: 0,
      actualDurationFrames: 65,
    });
    expect(
      goldenTrace.actual.actions.selectionByActionId['han-charged-stage-two']
    ).toMatchObject({
      semanticName: '重击2段',
      controlSkillId: 10100341,
      subSkillIndex: 0,
      actualDurationFrames: 71,
    });
    expect(goldenTrace.actual.combat.ownerHitCountByActionId).toMatchObject({
      'han-normal-a1': 1,
      'han-normal-a2': 2,
      'han-normal-a3': 3,
      'han-normal-a4': 4,
      'han-normal-a5': 4,
      'han-charged-stage-one': 9,
      'han-charged-stage-two': 11,
    });
  });

  it('compiles Firework, conditional explosions, tuning, and the implemented named passive from one owner contract', () => {
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
    expect(ownerContract.contracts.targetStateTransactions).toHaveLength(7);
    expect(
      ownerContract.contracts.targetStateTransactions.map(
        transaction => transaction.triggerFrame
      )
    ).toEqual([61, 68, 73, 94, 99, 104, 109]);
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
    ]);
    expect(
      ownerContract.contracts.targetStateTransactions.some(
        transaction =>
          transaction.transactionIdentity ===
          'han-star-skill-final-hit-extra-firework'
      )
    ).toBe(false);
    expect(
      mechanicsPackage.specialResourceCatalog.passiveEffects.some(
        passive => Number(passive.skillId) === 10100362
      )
    ).toBe(false);
    expect(
      mechanicsPackage.actionVariantGraph.targetStateProfiles.some(
        state =>
          Number(state.ownerId) === HAN_ID &&
          state.stateIdentity === FIREWORK_STATE_IDENTITY
      )
    ).toBe(true);
    expect(
      profile.coverage.find(item => item.dimension === 'stateMachines')
    ).toMatchObject({
      status: 'applied',
      recordCount: 10,
      appliedCount: 10,
      unresolvedCount: 0,
    });
    expect(
      profile.coverage.find(item => item.dimension === 'dynamicProperties')
    ).toMatchObject({
      status: 'applied',
      recordCount: 15,
      appliedCount: 15,
      unresolvedCount: 0,
    });
  });

  it('publishes both independent Ultimate tuning effects to the semantic runtime catalog', () => {
    const ultimateEffects =
      mechanicsPackage.semanticEffectCatalog.semanticEffects.filter(
        effect =>
          Number(effect.controlSkillId) === 10100313 &&
          [101003205, 101003207].includes(Number(effect.elementId))
      );
    expect(ultimateEffects).toHaveLength(2);
    expect(
      ultimateEffects
        .map(effect => ({
          elementId: effect.elementId,
          targetKind: effect.target.kind,
          durationMs: effect.lifecycle.durationMs,
          stackDelta: effect.lifecycle.stackDelta,
          maxStacks: effect.lifecycle.maxStacks,
          classification: effect.classification,
        }))
        .sort((left, right) => left.elementId - right.elementId)
    ).toEqual([
      {
        elementId: 101003205,
        targetKind: 'team-actors',
        durationMs: 24000,
        stackDelta: 2,
        maxStacks: 2,
        classification: 'applied',
      },
      {
        elementId: 101003207,
        targetKind: 'controlling-actor',
        durationMs: 15000,
        stackDelta: 1,
        maxStacks: 1,
        classification: 'applied',
      },
    ]);
    expect(
      mechanicsPackage.semanticEffectCatalog.formulas.find(
        formula =>
          formula.formulaIdentity ===
          ultimateEffects.find(effect => Number(effect.elementId) === 101003207)
            .formulaIdentity
      )?.formula
    ).toMatchObject({
      commonFunctionId: 1,
      baseFunctionId: 2008,
    });
    expect(
      ultimateEffects.find(effect => Number(effect.elementId) === 101003207)
        ?.lifecycle?.inheritance
    ).toMatchObject({
      inheritOnControlledActorSwitch: true,
      inheritType: 'source',
      isTeamElement: true,
      containerElementId: 101003206,
      status: 'verified-element-inheritance-ready',
    });
    expect(
      ownerContract.contracts.actionEffectBindings.find(
        binding => Number(binding.elementId) === 101003207
      )?.inheritance
    ).toMatchObject({
      inheritOnControlledActorSwitch: true,
      inheritType: 'source',
      isTeamElement: true,
      containerElementId: 101003206,
    });
  });

  it('audits inheritType independently from the team-element flag', () => {
    expect(inheritanceAudit).toMatchObject({
      status: 'verified-element-inheritance-field-audit-ready',
      policy: {
        controlledActorTransferGate: 'inheritType',
        teamElementField: 'inherit',
        teamElementAffectsTransfer: false,
      },
      summary: {
        nonzeroInheritTypeRecordCount: 82,
        matrix: {
          'self|team-element-true': 70,
          'self|team-element-false': 2,
          'source|team-element-true': 4,
          'source|team-element-false': 6,
        },
      },
    });
    expect(
      inheritanceAudit.legacyUnreachableEvidence.map(record => [
        record.elementId,
        record.status,
      ])
    ).toEqual([
      [101010030, 'legacy-unreachable-evidence'],
      [101010039, 'legacy-unreachable-evidence'],
      [101010081, 'legacy-unreachable-evidence'],
      [103002040, 'legacy-unreachable-evidence'],
      [103002079, 'legacy-unreachable-evidence'],
      [103002157, 'legacy-unreachable-evidence'],
    ]);
  });

  it('replays the Ultimate Source buff through a real switch without refreshing it', () => {
    expect(ultimateSwitchGolden).toMatchObject({
      status: 'authoritative-golden-runtime-verified',
      validation: {
        passed: true,
        failedCount: 0,
      },
      actual: {
        effects: {
          inheritanceTransferCountByEffectId: {
            'battle-element:101003205': 0,
            'battle-element:101003207': 1,
          },
          inheritanceTransfers: [
            {
              effectId: 'battle-element:101003207',
              frame: 400,
              previousTargetId: 'actor-101003',
              nextTargetId: 'actor-101010',
              inheritType: 'source',
              formulaSourceActorId: 'actor-101003',
              effectAdderActorId: 'actor-101003',
              expiresAtMs: 18466.667,
              formulaValues: [1042.0045928955078],
            },
          ],
        },
        comparison: {
          primaryEffectFormulaValuesById: {
            'battle-element:101003207': [1042.0045928955078],
          },
          baselineEffectFormulaValuesById: {
            'battle-element:101003207': [1019.9066162109375],
          },
        },
      },
    });
  });

  it('replays an authoritative three-person golden and fails on a tampered Firework settlement', () => {
    expect(goldenTrace.status).toBe('authoritative-golden-runtime-verified');
    expect(goldenTrace.validation).toMatchObject({
      passed: true,
      failedCount: 0,
    });
    expect(goldenTrace.actual.resources.targetStateSummary).toMatchObject({
      profileCount: 3,
      eventCount: 9,
      appliedGroupCount: 2,
      skippedGroupCount: 0,
      directSpEventCount: 2,
    });
    expect(goldenTrace.actual.resources.conditionalHitGroups).toEqual([
      expect.objectContaining({
        beforeStacks: 7,
        consumedStacks: 6,
        afterStacks: 1,
        applied: true,
      }),
      expect.objectContaining({
        beforeStacks: 1,
        consumedStacks: 1,
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
      selectedEffectSummaryByElementId: {
        101003205: {
          effectNames: ['全队调谐强度提升'],
          targetIds: ['actor-101003', 'actor-101010', 'actor-103002'],
          appliedEventCount: 3,
          expiredEventCount: 3,
          firstAppliedFrame: 208,
          firstExpiredFrame: 1648,
          maxStacks: 2,
          formulaValues: [18],
        },
        101003207: {
          effectNames: ['主控角色调谐强度提升'],
          targetIds: ['actor-101003'],
          appliedEventCount: 1,
          expiredEventCount: 1,
          firstAppliedFrame: 208,
          firstExpiredFrame: 1108,
          maxStacks: 1,
          formulaValues: [1019.9066162109375],
        },
      },
      inheritanceTransferCountByEffectId: {
        'battle-element:480124006': 1,
      },
      passiveTrace: expect.arrayContaining([
        expect.objectContaining({
          frame: 2900,
          operation: 'transfer',
          previousTargetId: 'actor-101003',
          nextTargetId: 'actor-101010',
          inheritType: 'self',
          effectAdderActorId: 'actor-101010',
          expiresAtMs: 60250,
        }),
        expect.objectContaining({
          frame: 3615,
          operation: 'expire',
          targetId: 'actor-101010',
        }),
      ]),
    });
    expect(goldenTrace.actual.dynamicProperties).toMatchObject({
      maxPercentRawByAttributeId: { 1: 1300 },
      maxExtraRawByAttributeId: { 229: 1055.9066162109375 },
    });
    expect(goldenTrace.actual.comparison).toMatchObject({
      damageDelta: 6968,
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

  it('classifies the unreachable hidden Ultimate explosion as non-gameplay legacy evidence', () => {
    expect(runtimeCapturePlan.summary.captureCount).toBe(10);
    expect(runtimeCapturePlan.summary.zeroDistanceBlockingCaptureCount).toBe(0);
    expect(
      runtimeCapturePlan.entries.some(
        entry =>
          entry.sourceIdentity ===
          'Battle/Element/ast_101003144.asset|Battle/Item/ast_480133.asset'
      )
    ).toBe(false);
    expect(unresolvedLedger.records).toContainEqual(
      expect.objectContaining({
        sourceKind: 'legacy-unreachable-element',
        rawRecordIdentities: [
          'actor:101003:ultimate:hidden-firework-explosion',
        ],
        status: 'not-applicable',
        impactClassification: 'not-applicable',
        reasons: expect.arrayContaining([
          'legacy-or-unreachable-current-client',
          'hidden-ultimate-firework-explosion-discarded-current-client',
        ]),
        sourceIdentity:
          'Battle/Element/ast_101003144.asset|Battle/Item/ast_480133.asset',
      })
    );
    expect(profile.characterComplete).toBe(false);
  });
});
