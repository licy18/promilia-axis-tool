import { describe, expect, it } from 'vitest';
import goldenTrace from '../../../reports/m10/103002/golden-trace.json';
import actionPhaseCoverage from '../../../reports/m10/103002/action-phase-coverage.json';
import actionTransitionCoverage from '../../../reports/m10/103002/action-transition-coverage.json';
import descriptionCoverage from '../../../reports/m10/103002/description-coverage.json';
import reachableGraph from '../../../reports/m10/103002/reachable-graph.json';
import runtimeCapturePlan from '../../../reports/m10/103002/runtime-capture-plan.json';
import runtimeCoverage from '../../../reports/m10/103002/runtime-coverage.json';
import sourceManifest from '../../../reports/m10/103002/source-manifest.json';
import unresolvedLedger from '../../../reports/m10/103002/unresolved-ledger.json';
import publicRuntimeCoverage from '../../../reports/verified-public-runtime-coverage.json';
import {
  resolveGoldenAttackInputSourceSegment,
  resolveGoldenSelectedSubSkillIndex,
} from '../../../scripts/character-combat/character-combat-golden-selection.mjs';
import { validateCharacterCombatGoldenRuntime } from '../../../scripts/character-combat/character-combat-golden-validation.mjs';
import catalog from '../../data/generated/character-combat-profile-catalog.json';
import ownerContract from '../../data/generated/character-combat-owner-contracts/103002.json';
import profile from '../../data/generated/character-combat-profiles/103002.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';

const RUBY_ID = 103002;
const RUBY_RESOURCE_IDENTITY = 'actor:103002:element:103002047';

describe('M10-B1 Ruby character combat profile', () => {
  it('publishes the honest public-action and reachable-control denominator', () => {
    expect(profile).toMatchObject({
      owner: {
        ownerId: RUBY_ID,
        ownerName: '红宝石',
      },
      pipelineMaturity: 'runtime-applied',
      combatCoverageState: 'partial',
      characterComplete: false,
      zeroDistanceSimulationComplete: true,
      realClientEvidenceComplete: false,
      completionState: 'runtime-applied',
      denominator: {
        publicActionCount: 10,
        reachableControlCount: 27,
        executionFormCount: 24,
        hitCount: 124,
        semanticEffectCount: 63,
        excludedControlCount: 6,
      },
      validation: {
        status: 'character-combat-profile-valid',
        issues: [],
      },
    });
    expect(
      catalog.profiles.find(item => Number(item.ownerId) === RUBY_ID)
    ).toMatchObject({
      profileIdentity: profile.profileIdentity,
      profileHash: profile.profileHash,
      runtimeContractHash: profile.runtimeCompilation.contractHash,
      pipelineMaturity: 'runtime-applied',
      combatCoverageState: 'partial',
      characterComplete: false,
      zeroDistanceSimulationComplete: true,
      realClientEvidenceComplete: false,
    });
    expect(profile.runtimeCompilation.sourceCompilation.ownerContractHash).toBe(
      ownerContract.contractHash
    );
    expect(ownerContract.contracts.publicActions).toHaveLength(10);
    expect(
      ownerContract.contracts.publicActions.filter(
        action => action.runtimeReady
      )
    ).toHaveLength(10);
    expect(
      ownerContract.contracts.publicActions
        .filter(action => !action.runtimeReady)
        .map(action => action.actionKind)
        .sort()
    ).toEqual([]);
    expect(ownerContract.contracts.actionForms).toHaveLength(24);
    expect(
      ownerContract.contracts.actionForms.filter(form => form.applied)
    ).toHaveLength(24);
    expect(
      ownerContract.contracts.actionForms
        .filter(form => !form.applied)
        .map(form => form.publicActionKind)
        .sort()
    ).toEqual([]);
    expect(runtimeCoverage.summary).toMatchObject({
      actionCount: 10,
      runtimeReadyActionCount: 10,
      executionFormCount: 24,
      controlCount: 27,
      hitCount: 124,
      resourceProfileCount: 1,
      resourceTransactionCount: 42,
      passiveCount: 1,
      switchTriggerCount: 1,
    });
    expect(sourceManifest.ownerId).toBe(RUBY_ID);
    expect(sourceManifest.summary.identityCount).toBeGreaterThan(1000);
    expect(reachableGraph.summary).toMatchObject({
      controlCount: 27,
      exclusionCount: 6,
      nodeKindCounts: {
        'public-action': 10,
        'action-form': 24,
        hit: 124,
        'personal-resource': 1,
        'passive-listener': 1,
        'switch-trigger': 1,
      },
    });
  });

  it('publishes the re-exported Star Skill settlement as seven source-backed hits', () => {
    const control = mechanicsPackage.controlBindings.find(
      binding => Number(binding.controlSkillId) === 10300212
    );
    const hits = control.hits.filter(hit => Number(hit.mapIndex) === 0);

    expect(hits).toHaveLength(7);
    expect(hits.map(hit => hit.trigger.startFrame)).toEqual([
      37, 44, 49, 54, 59, 64, 69,
    ]);
    expect(hits.map(hit => hit.elementId)).toEqual([
      103002247, 103002248, 103002248, 103002248, 103002248, 103002248,
      103002248,
    ]);
    expect(
      hits.map(hit => ({
        weakBreakDamageRateBasisPoints:
          hit.damage.weakBreakDamageRateBasisPoints,
        recoverSp: hit.energy.recoverSp,
        petRecoverSp: hit.energy.petRecoverSp,
        recoverIntervalMs: hit.energy.recoverIntervalMs,
        sourceEvidenceStatus: hit.sourceEvidenceStatus,
        scenarioRuntimeStatus: hit.scenarioRuntimeStatus,
      }))
    ).toEqual(
      Array.from({ length: 7 }, () => ({
        weakBreakDamageRateBasisPoints: 7000,
        recoverSp: 3000,
        petRecoverSp: 11900,
        recoverIntervalMs: 9999,
        sourceEvidenceStatus: 'applied',
        scenarioRuntimeStatus: 'source-verified',
      }))
    );
    expect(new Set(hits.map(hit => hit.hitIdentity)).size).toBe(7);
    expect(
      hits.every(hit =>
        hit.trigger.sourceIdentity.includes(
          'Program/Battle/Character/Config/Hero/103002/SubSkill/ast_17425494451660000.asset'
        )
      )
    ).toBe(true);
  });

  it('keeps re-exported behavior tracks scoped to their owning subskill', () => {
    const controls = [
      ...mechanicsPackage.controlBindings,
      ...mechanicsPackage.actionVariantControlBindings,
    ];
    const hitFrames = (controlSkillId, subSkillIndex) =>
      controls
        .find(control => Number(control.controlSkillId) === controlSkillId)
        ?.hits.filter(hit => Number(hit.mapIndex) === subSkillIndex)
        .map(hit => Number(hit.trigger.startFrame)) ?? [];

    expect(hitFrames(10300201, 0)).toEqual([11]);
    expect(hitFrames(10300201, 1)).toEqual([17, 21, 26]);
    expect(hitFrames(10300201, 2)).toEqual([19, 24, 29]);
    expect(hitFrames(10300201, 3)).toEqual([26, 31, 36]);
    expect(hitFrames(10300202, 0)).toEqual([13]);
    expect(hitFrames(10300202, 1)).toEqual([17, 21, 26]);
    expect(hitFrames(10300202, 2)).toEqual([19, 24, 29]);
    expect(hitFrames(10300202, 3)).toEqual([26, 31, 36]);
    expect(hitFrames(10300203, 0)).toEqual([18, 23]);
    expect(hitFrames(10300203, 1)).toEqual([17, 21, 25, 29]);
    expect(hitFrames(10300203, 2)).toEqual([19, 24, 29, 34]);
    expect(hitFrames(10300203, 3)).toEqual([26, 31, 35, 39]);
    expect(hitFrames(10300204, 0)).toEqual([19, 24, 29, 34]);
    expect(hitFrames(10300204, 1)).toEqual([26, 31, 36, 40]);
    expect(hitFrames(10300204, 2)).toEqual([29, 33, 39, 45]);
    expect(hitFrames(10300204, 3)).toEqual([17, 21, 25, 29]);
    expect(hitFrames(10300204, 4)).toEqual([28, 33]);
    expect(hitFrames(10300225, 0)).toEqual([18, 23, 28]);
    expect(hitFrames(10300225, 1)).toEqual([18, 23, 28]);
    expect(hitFrames(10300244, 0)).toEqual([29, 33, 39, 45]);
    expect(hitFrames(10300244, 1)).toEqual([29, 33, 39, 45]);
    expect(hitFrames(10300249, 1)).toEqual([15, 20, 25]);

    for (const controlSkillId of [
      10300201, 10300202, 10300203, 10300204, 10300225, 10300244, 10300249,
    ]) {
      const hits = controls.find(
        control => Number(control.controlSkillId) === controlSkillId
      ).hits;
      const semanticKeys = hits.map(
        hit => `${hit.mapIndex}|${hit.elementId}|${hit.trigger.startFrame}`
      );
      expect(new Set(semanticKeys).size).toBe(semanticKeys.length);
    }

    const focusCounter = controls.find(
      control => Number(control.controlSkillId) === 10300249
    );
    expect(focusCounter.hits.map(hit => hit.trigger.behaviorPathId)).toEqual([
      '-3641915522962639021',
      '4086983151447619411',
      '2941305154071279443',
    ]);
    expect(
      focusCounter.hits.some(hit =>
        String(hit.trigger.behaviorPathId).startsWith('character-combat:')
      )
    ).toBe(false);
    expect(
      sourceManifest.entries.some(entry =>
        entry.sourceIdentity.includes(
          'Hero/103002/SubSkill/ast_17387499981690000.asset'
        )
      )
    ).toBe(true);
  });

  it('settles Star Skill and Star Combo from their own public-form evidence', () => {
    const starSkillActionIdentity = 'actor|103002|10300212|0|10300212';
    const starComboActionIdentity = 'actor|103002|10300212|1|10300226';
    const starSkillRow = runtimeCoverage.actionRows.find(
      row => row.actionIdentity === starSkillActionIdentity
    );
    const starComboRow = runtimeCoverage.actionRows.find(
      row => row.actionIdentity === starComboActionIdentity
    );

    expect(starSkillRow).toMatchObject({
      actionKind: 'star-skill',
      sourceSkillId: 10300212,
      rawRuntimeReady: true,
      runtimeReady: true,
      hitCount: 7,
      requiresDamageSettlement: true,
      settlementStatus: 'applied',
      publicFormSettlements: [
        expect.objectContaining({
          publicFormId: `${starSkillActionIdentity}:default`,
          executionControlSkillId: 10300212,
          executionSubSkillIndex: 0,
          hitCount: 7,
          status: 'applied',
        }),
      ],
    });
    expect(starComboRow).toMatchObject({
      actionKind: 'star-combo',
      sourceSkillId: 10300212,
      runtimeReady: true,
      hitCount: 1,
      requiresDamageSettlement: true,
      settlementStatus: 'applied',
      publicFormSettlements: [
        expect.objectContaining({
          publicFormId: `${starComboActionIdentity}:default`,
          executionControlSkillId: 10300226,
          executionSubSkillIndex: 0,
          hitCount: 1,
          status: 'applied',
        }),
      ],
    });

    const starSkillDamageClause = descriptionCoverage.entries.find(
      entry =>
        entry.skillId === 10300212 &&
        entry.text.startsWith('【星鸣技】') &&
        entry.mechanicKinds.includes('action-settlement')
    );
    const starComboDamageClause = descriptionCoverage.entries.find(
      entry =>
        entry.skillId === 10300212 &&
        entry.text.startsWith('【星结合击】') &&
        entry.mechanicKinds.includes('action-settlement')
    );
    expect(starSkillDamageClause).toMatchObject({
      status: 'applied',
      coverageReferences: expect.arrayContaining([
        starSkillActionIdentity,
        `${starSkillActionIdentity}:default`,
        'hit:10300212|0|elements|30|3779689614933439892|37|1',
        'hit:10300212|0|elements|33|372918963524026542|69|7',
      ]),
      publicFormSettlements: [
        expect.objectContaining({
          publicFormId: `${starSkillActionIdentity}:default`,
          executionSubSkillIndex: 0,
          hitCount: 7,
          status: 'applied',
        }),
      ],
      reasons: [],
    });
    expect(starSkillDamageClause.coverageReferences).not.toContain(
      starComboActionIdentity
    );
    expect(starSkillDamageClause.coverageReferences).not.toContain(
      'hit:10300226|0|elements|2|7932730177002622605|40|1'
    );
    expect(starComboDamageClause).toMatchObject({
      status: 'applied',
      coverageReferences: expect.arrayContaining([
        starComboActionIdentity,
        `${starComboActionIdentity}:default`,
        'hit:10300226|0|elements|2|7932730177002622605|40|1',
      ]),
      publicFormSettlements: [
        expect.objectContaining({
          publicFormId: `${starComboActionIdentity}:default`,
          executionSubSkillIndex: 0,
          hitCount: 1,
          status: 'applied',
        }),
      ],
    });

    const globalStarSkill = publicRuntimeCoverage.actions.find(
      row => row.identity === starSkillActionIdentity
    );
    const globalStarCombo = publicRuntimeCoverage.actions.find(
      row => row.identity === starComboActionIdentity
    );
    expect(globalStarSkill).toMatchObject({
      runtimeStatus: 'runnable',
      rawRuntimeReady: true,
      runnable: true,
      dimensions: {
        enemyHp: { applied: 7 },
        enemyToughness: { applied: 7 },
        actorSp: { applied: 7 },
        kiboSp: { applied: 7 },
      },
      settlement: {
        required: true,
        status: 'applied',
        hitCount: 7,
        publicForms: [
          expect.objectContaining({
            publicFormId: `${starSkillActionIdentity}:default`,
            hitCount: 7,
            status: 'applied',
          }),
        ],
      },
    });
    expect(globalStarCombo).toMatchObject({
      runtimeStatus: 'runnable',
      runnable: true,
      dimensions: {
        enemyHp: { applied: 1 },
        enemyToughness: { applied: 1 },
        actorSp: { applied: 1 },
        kiboSp: { applied: 1 },
      },
      settlement: {
        required: true,
        status: 'applied',
        hitCount: 1,
      },
    });

    expect(
      unresolvedLedger.records.some(record =>
        record.rawRecordIdentities?.includes(
          'actor:103002:public-form:10300212:0:star-skill:damage-settlement'
        )
      )
    ).toBe(false);
    expect(JSON.stringify(unresolvedLedger)).not.toContain('stubOnly');
  });

  it('resolves golden source segments without collapsing nullable subskills', () => {
    const normalMapping = mechanicsPackage.actionMappings.find(
      mapping =>
        mapping.ownerKind === 'actor' &&
        Number(mapping.ownerId) === RUBY_ID &&
        mapping.actionKind === 'normal-attack'
    );
    const enhancedChain =
      mechanicsPackage.actionVariantGraph.attackInputChains.find(
        chain => chain.chainIdentity === 'ruby-enhanced-twelve-inputs'
      );
    const e10 = enhancedChain.segments.find(
      segment => Number(segment.sequenceIndex) === 10
    );
    expect(
      resolveGoldenAttackInputSourceSegment(normalMapping, e10)
    ).toMatchObject({
      controlSkillId: 10300204,
      selectedSubSkillIndex: 0,
    });

    const perfectParryMapping = mechanicsPackage.actionMappings.find(
      mapping =>
        mapping.ownerKind === 'actor' &&
        Number(mapping.ownerId) === RUBY_ID &&
        mapping.actionKind === 'perfect-parry'
    );
    expect(
      resolveGoldenSelectedSubSkillIndex({
        action: {},
        mapping: perfectParryMapping,
        mechanicsPackage,
      })
    ).toBe(1);
    expect(
      resolveGoldenSelectedSubSkillIndex({
        action: { selectedSubSkillIndex: null },
        mapping: perfectParryMapping,
        mechanicsPackage,
      })
    ).toBeNull();
  });

  it('compiles the normal phase, gated enhanced phase, and Star Skill resource transaction', () => {
    expect(ownerContract.contracts.resourceProfiles).toEqual([
      expect.objectContaining({
        ownerId: RUBY_ID,
        resourceIdentity: RUBY_RESOURCE_IDENTITY,
        elementId: 103002047,
        name: '子弹',
        capacity: 12,
        initialValue: 0,
        inputStep: 1,
        scenarioConfigurable: true,
        initialValueStatus: 'scenario-configurable-initial-state',
        initialValueSourceIdentity: expect.stringContaining(
          'initialRuntimeState.specialResourcesByActor'
        ),
        status: 'verified-special-resource-profile-ready',
        applied: true,
      }),
    ]);
    expect(
      countBy(ownerContract.contracts.resourceTransactions, transaction =>
        transaction.applied
          ? 'applied'
          : transaction.status === 'not-applicable'
            ? 'not-applicable'
            : 'unresolved'
      )
    ).toEqual({
      applied: 23,
      'not-applicable': 19,
    });

    const empty = ownerContract.contracts.attackInputChains.find(
      chain => chain.chainIdentity === 'ruby-normal-default-three-inputs'
    );
    const loaded = ownerContract.contracts.attackInputChains.find(
      chain => chain.chainIdentity === 'ruby-enhanced-twelve-inputs'
    );
    expect(empty).toMatchObject({
      stateCondition: { kind: 'always' },
      entryPolicy: {
        kind: 'default',
      },
      phaseTransition: {
        targetChainIdentity: 'ruby-enhanced-twelve-inputs',
        inputCommand: 'normal-attack',
        sourceSequenceIndex: 3,
        condition: {
          kind: 'resource-at-least',
          resourceIdentity: RUBY_RESOURCE_IDENTITY,
          value: 1,
        },
        inputWindow: {
          startFrame: 34,
          endFrame: 79,
          targetControlSkillId: 10300201,
          targetSubSkillIndex: 1,
        },
        status: 'applied',
      },
    });
    expect(
      empty.segments.map(segment => [
        segment.controlSkillId,
        segment.subSkillIndex,
        segment.durationFrames,
      ])
    ).toEqual([
      [10300201, 0, 15],
      [10300202, 0, 23],
      [10300203, 0, 34],
    ]);
    expect(loaded).toMatchObject({
      stateCondition: {
        kind: 'resource-at-least',
        resourceIdentity: RUBY_RESOURCE_IDENTITY,
        value: 1,
      },
      entryPolicy: {
        kind: 'derived-or-quick-entry',
      },
      segmentLimit: {
        kind: 'resource-current-value',
        resourceIdentity: RUBY_RESOURCE_IDENTITY,
        costPerSegment: 1,
        maximum: 12,
      },
    });
    expect(
      loaded.segments.map(segment => [
        segment.controlSkillId,
        segment.subSkillIndex,
        segment.durationFrames,
      ])
    ).toEqual([
      [10300201, 1, 24],
      [10300201, 2, 24],
      [10300201, 3, 32],
      [10300202, 1, 24],
      [10300202, 2, 24],
      [10300202, 3, 32],
      [10300203, 1, 18],
      [10300203, 2, 18],
      [10300203, 3, 28],
      [10300204, 0, 18],
      [10300204, 1, 37],
      [10300204, 2, 57],
    ]);
    expect(
      ownerContract.contracts.resourceTransactions.find(
        transaction =>
          transaction.controlSkillId === 10300210 &&
          transaction.subSkillIndex === 0 &&
          transaction.operation === 'gain'
      )
    ).toMatchObject({
      triggerFrame: 24,
      amountByLevel: { 1: 6 },
      applied: true,
    });
    expect(
      ownerContract.contracts.resourceTransactions.find(
        transaction =>
          transaction.controlSkillId === 10300213 &&
          transaction.operation === 'set-to-capacity' &&
          transaction.applied
      )
    ).toMatchObject({
      triggerFrame: 113,
      amountByLevel: { 1: 12 },
      applied: true,
    });
    expect(
      ownerContract.contracts.resourceTransactions.find(
        transaction =>
          transaction.controlSkillId === 10300212 &&
          transaction.sourceElementId === 103002048 &&
          transaction.applied
      )
    ).toMatchObject({
      triggerFrame: 0,
      operation: 'set-to-capacity',
      amountByLevel: { 1: 12 },
      applied: true,
      status: 'verified-special-resource-operation-ready',
      reasons: [],
      sourceIdentity: expect.stringContaining(
        'ast_17425494451660000__4452502413130359845.json#startFrame'
      ),
    });
    expect(
      ownerContract.contracts.variantWindowBindings.find(
        binding =>
          binding.sourceControlSkillId === 10300212 &&
          binding.targetControlSkillId === 10300201 &&
          binding.targetSubSkillIndex === 1
      )
    ).toMatchObject({
      activationFrame: 0,
      durationMs: 4000,
      status: 'applied',
      applied: true,
    });
    expect(
      ownerContract.contracts.actionEffectBindings.find(
        binding =>
          binding.controlSkillId === 10300212 && binding.elementId === 150
      )
    ).toMatchObject({
      triggerFrame: 0,
      status: 'applied',
      applied: true,
      tuningMark: {
        profileKey: 'fire',
        markId: 150,
        stackDelta: 1,
        applied: true,
      },
    });
    expect(
      ownerContract.contracts.variantWindowBindings.find(
        binding =>
          binding.bindingIdentity === 'ruby-star-carry-direct-enhanced-entry'
      )
    ).toMatchObject({
      sourceControlSkillId: 10300221,
      sourceSubSkillIndex: 0,
      targetControlSkillId: 10300201,
      targetSubSkillIndex: 1,
      inputWindow: {
        startFrame: 80,
        endFrame: 112,
      },
      status: 'applied',
      applied: true,
    });
    expect(
      ownerContract.contracts.actionEffectBindings.find(
        binding =>
          binding.bindingIdentity === 'ruby-star-carry-thunder-tuning-mark'
      )
    ).toMatchObject({
      controlSkillId: 10300221,
      subSkillIndex: 0,
      triggerFrame: 54,
      tuningMark: {
        profileKey: 'thunder',
        stackDelta: 1,
        applied: true,
      },
      applied: true,
    });
    expect(
      ownerContract.contracts.resourceTransactions.find(
        transaction =>
          transaction.operationIdentity ===
          'actor:103002:element:103002047|10300249|1|focus-dodge-counter-gain|15'
      )
    ).toMatchObject({
      controlSkillId: 10300249,
      subSkillIndex: 1,
      operation: 'gain',
      triggerFrame: 15,
      amountByLevel: { 1: 1 },
      applied: true,
    });
    expect(ownerContract.contracts.actionHitBindings).toEqual([]);
    expect(
      ownerContract.contracts.publicActions.find(
        action => action.actionKind === 'perfect-parry'
      )
    ).toMatchObject({
      runtimeReady: true,
      publicActionExecutionForms: [
        expect.objectContaining({
          semanticName: '集中闪避反击',
          executionControlSkillId: 10300249,
          executionSubSkillIndex: 1,
          selectionKind: 'wrapper-derived-execution',
        }),
      ],
      actionScheduling: {
        status: 'exact',
        durationFrames: 35,
        selectedSubSkillIndex: 1,
      },
    });
    expect(actionPhaseCoverage).toMatchObject({
      ownerId: RUBY_ID,
      status: 'character-combat-action-phase-coverage-ready',
      summary: {
        phaseCount: 2,
        appliedPhaseCount: 2,
        inputSegmentCount: 15,
        phaseTransitionCount: 1,
        publicActionCount: 10,
        runtimeReadyActionCount: 10,
        appliedResourceTransactionCount: 23,
        appliedActionEffectCount: 3,
      },
    });
    expect(
      actionPhaseCoverage.phases.find(
        phase => phase.phaseIdentity === 'ruby-normal-default-three-inputs'
      )
    ).toMatchObject({
      inputCount: 3,
      exitCondition: {
        kind: 'chain-complete',
        maximumInputCount: 3,
      },
      phaseTransition: {
        targetChainIdentity: 'ruby-enhanced-twelve-inputs',
        inputWindow: {
          startFrame: 34,
          endFrame: 79,
        },
        status: 'applied',
      },
    });
    expect(
      actionPhaseCoverage.phases.find(
        phase => phase.phaseIdentity === 'ruby-enhanced-twelve-inputs'
      )
    ).toMatchObject({
      inputCount: 12,
      exitCondition: {
        kind: 'resource-exhausted-or-input-limit-reached',
        resourceIdentity: RUBY_RESOURCE_IDENTITY,
        costPerInput: 1,
        maximumInputCount: 12,
      },
    });
    expect(
      actionPhaseCoverage.quickEntries.map(entry => [
        entry.sourceControlSkillId,
        entry.activationFrame,
        entry.targetControlSkillId,
        entry.targetSubSkillIndex,
      ])
    ).toEqual(
      expect.arrayContaining([
        [10300210, 24, 10300201, 1],
        [10300212, 0, 10300201, 1],
        [10300213, 297, 10300201, 1],
        [10300221, 80, 10300201, 1],
      ])
    );
    expect(actionTransitionCoverage).toMatchObject({
      ownerId: RUBY_ID,
      summary: {
        publicActionCount: 10,
        rawWindowCount: 159,
        semanticTransitionCount: 37,
        appliedTransitionCount: 37,
        gameplayGapCount: 0,
      },
    });
    expect(
      actionTransitionCoverage.transitions.find(
        transition =>
          transition.transitionIdentity ===
          'ruby-enhanced-dodge-chain-continuity'
      )
    ).toMatchObject({
      sourceControlSkillId: 10300215,
      sourceSubSkillIndex: 0,
      inputWindow: { startFrame: 30, endFrame: 246 },
      targetChainIdentity: 'ruby-enhanced-twelve-inputs',
      targetSequenceIndex: 'next',
      transitionSemantics: 'resume-next-chain-segment',
      applied: true,
    });
    expect(
      actionTransitionCoverage.transitions.find(
        transition =>
          transition.transitionIdentity ===
          'ruby-star-carry-direct-enhanced-entry'
      )
    ).toMatchObject({
      sourceControlSkillId: 10300221,
      sourceSubSkillIndex: 0,
      inputWindow: { startFrame: 80, endFrame: 112 },
      targetChainIdentity: 'ruby-enhanced-twelve-inputs',
      targetSequenceIndex: 1,
      e2eCoverage: 'm10-b1-r3-ruby-star-carry-entry',
      applied: true,
    });
    expect(
      actionTransitionCoverage.transitions.find(
        transition =>
          transition.transitionIdentity ===
          'ruby-star-skill-quick-enhanced-entry'
      )
    ).toMatchObject({
      e2eCoverage: 'm10-b1-r1-ruby-star-skill',
      applied: true,
    });
    expect(
      actionTransitionCoverage.publicActionCoverage.every(
        action => action.publicActionIdentity
      )
    ).toBe(true);
  });

  it('applies the verified passive branch and keeps the remaining gaps explicit', () => {
    expect(ownerContract.contracts.passives).toEqual([
      expect.objectContaining({
        passiveIdentity: 'actor:103002:passive:10300261',
        skillId: 10300261,
        name: '以心燃焰',
        durationMs: 15000,
        maxStacks: 6,
        runtimeGenerationMode: 'action-variant-runtime',
        status: 'verified-semantic-passive-effect-profile-ready',
        applied: true,
        triggerBindings: expect.arrayContaining([
          expect.objectContaining({
            controlSkillId: 10300201,
            subSkillIndex: 1,
            triggerFrame: 0,
            applied: true,
          }),
        ]),
        modifiers: [
          expect.objectContaining({
            attributeId: 229,
            bucket: 'dynamicExtra',
            valueRaw: 20,
          }),
        ],
      }),
    ]);
    expect(ownerContract.contracts.passives[0].triggerBindings).toHaveLength(
      15
    );
    expect(
      ownerContract.contracts.passives[0].triggerBindings.find(
        trigger => trigger.controlSkillId === 10300213
      )
    ).toMatchObject({
      subSkillIndex: 0,
      triggerFrame: 114,
      stackDelta: 6,
      applied: true,
    });
    expect(
      unresolvedLedger.records.some(record =>
        record.reasons.includes('passive-listener-closure-static-evidence-gap')
      )
    ).toBe(false);
    expect(
      unresolvedLedger.records.some(record =>
        record.reasons.includes(
          'passive-attack-percent-trigger-binding-static-evidence-gap'
        )
      )
    ).toBe(false);
    expect(
      unresolvedLedger.records.find(record =>
        record.reasons.includes(
          'unnamed-secondary-passive-not-implemented-current-client'
        )
      )
    ).toMatchObject({
      sourceKind: 'passive-or-skill',
      status: 'not-applicable',
      impactClassification: 'not-applicable',
      rawRecordIdentities: ['actor:103002:skill:10300262'],
    });
    expect(unresolvedLedger.summary).toMatchObject({
      semanticRecordCount: 430,
      rawRecordCount: 438,
      semanticStatusCounts: {
        'not-applicable': 22,
        'runtime-evidence-required': 4,
        'static-evidence-gap': 404,
      },
      impactClassificationCounts: {
        'gameplay-impacting': 132,
        'not-applicable': 22,
        'superseded-by-semantic-transition-closure': 253,
        'wrapper-or-duplicate': 23,
      },
      transitionCandidateSupersededCount: 253,
    });
    expect(
      unresolvedLedger.records.some(record =>
        record.reasons.includes('initial-ammo-runtime-evidence-required')
      )
    ).toBe(false);
    expect(
      unresolvedLedger.records.find(
        record =>
          record.sourceKind === 'legacy-unreachable-element' &&
          record.reasons.includes('legacy-or-unreachable-current-client')
      )
    ).toMatchObject({
      status: 'not-applicable',
      impactClassification: 'not-applicable',
      sourceIdentity: expect.stringContaining('referenceCount=0'),
    });
    expect(ownerContract.contracts.passives).toEqual([
      expect.objectContaining({
        skillId: 10300261,
        effectElementId: 103002275,
        propertyElementId: 103002276,
        applied: true,
      }),
    ]);
    expect(JSON.stringify(ownerContract.contracts)).not.toContain('103002252');
    expect(JSON.stringify(ownerContract.contracts)).not.toContain('103002253');
    expect(JSON.stringify(ownerContract.contracts)).not.toContain('10300253');
    expect(JSON.stringify(unresolvedLedger.rawRecords)).toContain(
      'actor:103002:internal-control:10300253'
    );
    expect(JSON.stringify(unresolvedLedger.rawRecords)).toContain(
      'reexported-subskill-container-unreachable-from-current-skill-list'
    );
    expect(runtimeCapturePlan).toMatchObject({
      ownerId: RUBY_ID,
      status: 'runtime-evidence-required',
      summary: {
        captureCount: 4,
        zeroDistanceBlockingCaptureCount: 0,
        realClientEvidenceCaptureCount: 4,
      },
    });
    expect(runtimeCapturePlan.entries).toHaveLength(4);
    expect(
      runtimeCapturePlan.entries.every(
        entry =>
          entry.evidenceScope === 'real-client-projectile-impact' &&
          entry.blocksZeroDistanceSimulation === false &&
          entry.scenarioRuntimeStatus === 'scenario-assumed-zero-distance' &&
          entry.referenceKinds.includes('bulletElements')
      )
    ).toBe(true);
    expect(
      runtimeCapturePlan.entries.some(
        entry =>
          entry.sourceMetadata?.externalContainerPath ===
          'Assets/Program/Battle/Character/Config/Hero/103002/SubSkill/ast_17425494451660000.asset'
      )
    ).toBe(false);
    expect(profile.simulationScopes).toMatchObject({
      zeroDistance: {
        status: 'complete',
        complete: true,
        scenarioContract: {
          targetDistance: 0,
          defaultWillHit: true,
          projectileTravelFrames: 0,
          projectileImpactPolicy: 'scenario-assumed-zero-distance',
        },
        gates: {
          declared: true,
          publicActionsRuntimeReady: true,
          actionFormsApplied: true,
          semanticTransitionClosureComplete: true,
          requiredResourcesApplied: true,
          requiredActionEffectsApplied: true,
          requiredPassivesApplied: true,
          zeroDistanceRuntimeCapturesResolved: true,
          authoritativeGoldenPassed: true,
        },
        sourceEvidenceGapCount: 132,
        sourceEvidenceGapsRemainAuditable: true,
        realClientEvidenceCaptureCount: 4,
      },
      realClientEvidence: {
        status: 'incomplete',
        complete: false,
        runtimeCaptureCount: 4,
        staticEvidenceGapCount: 128,
      },
    });
  });

  it('replays the authoritative 120-second combat trace and rejects tampering', () => {
    expect(goldenTrace).toMatchObject({
      kind: 'azpr-character-combat-authoritative-golden-runtime',
      status: 'authoritative-golden-runtime-verified',
      ownerId: RUBY_ID,
      durationMs: 120000,
      compilerPath:
        'src/simulation/headless/canonicalHeadlessCombatCore.js#compile',
      simulatorPath:
        'src/simulation/headless/canonicalHeadlessCombatCore.js#simulate',
      validation: {
        status: 'authoritative-golden-runtime-expectation-passed',
        passed: true,
        assertionCount: 129,
        failedCount: 0,
      },
    });
    expect(goldenTrace.actual).toMatchObject({
      project: {
        durationMs: 120000,
        actionCount: 15,
        teamCharacterIds: [103002, 101010, 101003],
      },
      actions: {
        blockedActionIds: ['ruby-insufficient-shot'],
      },
      combat: {
        ownerDamageEventCount: 185,
        ownerHitEventCount: 64,
        ownerHitCountByActionId: {
          'ruby-star-skill': 7,
        },
        ownerHitSummaryByActionId: {
          'ruby-star-skill': {
            hitCount: 7,
            frames: [1887, 1894, 1899, 1904, 1909, 1914, 1919],
            totalHpDamage: 664,
            totalToughnessDamage: 464,
          },
        },
        ownerTotalHpDamage: 164422,
        ownerTotalToughnessDamage: 2220,
        enemy: {
          initialHp: 862800,
          finalHp: 698284,
        },
      },
      effects: {
        passiveMaxStacks: 6,
        firstPassiveMaxStackFrame: 1350,
        inheritanceTransferCountByEffectId: {
          'battle-element:103002275': 0,
        },
        passiveTrace: expect.arrayContaining([
          expect.objectContaining({
            frame: 2720,
            targetId: 'actor-103002',
          }),
          expect.objectContaining({
            frame: 3620,
            operation: 'expire',
            targetId: 'actor-103002',
          }),
        ]),
      },
      comparison: {
        primaryDamage: 297,
        baselineDamage: 126,
        damageDelta: 171,
      },
    });
    expect(
      goldenTrace.actual.resources.specialResourceTrace.map(event => [
        event.actionId,
        event.frame,
        event.beforeValue,
        event.change,
        event.afterValue,
      ])
    ).toEqual(
      expect.arrayContaining([
        ['ruby-reload', 24, 0, 6, 6],
        ['ruby-enhanced-shot-1', 200, 6, -1, 5],
        ['ruby-enhanced-shot-6', 1350, 1, -1, 0],
        ['ruby-star-skill', 1850, 0, 12, 12],
        ['ruby-ultimate', 2313, 12, 0, 12],
        ['ruby-post-ultimate-shot', 2720, 12, -1, 11],
        ['ruby-limit-counter', 3015, 11, 1, 12],
      ])
    );
    expect(goldenTrace.actual.resources.tuningMarkTrace[0]).toMatchObject({
      actionId: 'ruby-star-skill',
      frame: 1850,
      kind: 'acquire',
      profileKey: 'fire',
      markId: 150,
      before: 0,
      delta: 1,
      after: 1,
      maximum: 5,
    });
    expect(
      goldenTrace.actual.resources.actorSpByActorId['actor-103002']
    ).toMatchObject({
      initialValue: 100,
      currentValue: 17.469559,
      autoRecovery: [
        {
          reason: 'verified-auto-sp-background',
          totalChange: 0.5203,
        },
        {
          reason: 'verified-auto-sp-foreground',
          totalChange: 16.329152,
        },
      ],
    });
    expect(
      goldenTrace.actual.resources.kiboSpBySlotId['team-slot-1']
    ).toMatchObject({
      kiboId: 500039,
      initialValue: 100,
      currentValue: 13.559189,
    });
    expect(goldenTrace.actual.dynamicProperties.ownerSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attributeId: 1,
          dynamicPercentRaw: 60,
          effectIds: ['tuning-mark:150:persistent'],
        }),
        expect.objectContaining({
          attributeId: 229,
          dynamicExtraRaw: 120,
        }),
      ])
    );
    expect(
      goldenTrace.actual.effects.passiveTrace.find(
        event => event.actionId === 'ruby-ultimate'
      )
    ).toMatchObject({
      frame: 2314,
      beforeStacks: null,
      afterStacks: 6,
    });
    expect(goldenTrace.replayHash).toMatch(/^[a-f0-9]{64}$/);

    const expected = structuredClone(goldenTrace.expected);
    expected.exact['resources.specialResourceTrace.0.afterValue'] = 7;
    const validation = validateCharacterCombatGoldenRuntime({
      actual: goldenTrace.actual,
      expected,
    });
    expect(validation).toMatchObject({
      passed: false,
      failedCount: 1,
    });
    expect(
      validation.assertions.find(assertion => !assertion.passed)
    ).toMatchObject({
      jsonPath: 'resources.specialResourceTrace.0.afterValue',
      expected: 7,
      actual: 6,
    });
  });

  it('publishes the same owner contract through the verified mechanics package', () => {
    const metadata =
      mechanicsPackage.characterCombatProfileCatalog.profiles.find(
        item => Number(item.ownerId) === RUBY_ID
      );
    expect(metadata).toMatchObject({
      profileIdentity: profile.profileIdentity,
      profileHash: profile.profileHash,
      runtimeContractHash: profile.runtimeCompilation.contractHash,
      pipelineMaturity: 'runtime-applied',
      combatCoverageState: 'partial',
      characterComplete: false,
      zeroDistanceSimulationComplete: true,
      realClientEvidenceComplete: false,
    });
    expect(
      mechanicsPackage.actionMappings.filter(
        mapping =>
          mapping.ownerKind === 'actor' && Number(mapping.ownerId) === RUBY_ID
      )
    ).toHaveLength(10);
    expect(
      mechanicsPackage.specialResourceCatalog.profiles.find(
        resource => resource.resourceIdentity === RUBY_RESOURCE_IDENTITY
      )
    ).toMatchObject({
      capacity: 12,
      inputStep: 1,
      scenarioConfigurable: true,
      initialValue: 0,
      applied: true,
    });
  });
});

function countBy(values, selector) {
  return values.reduce((counts, value) => {
    const key = selector(value);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}
