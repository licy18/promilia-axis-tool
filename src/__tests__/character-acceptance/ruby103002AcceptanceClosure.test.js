import activeSurfaceFixture from '../../../fixtures/character-acceptance/103002-active-surface-closure.json';
import mainFixture from '../../../fixtures/character-acceptance/103002-visual.json';
import acceptanceLedger from '../../../reports/m11/character-acceptance/103002/ledger.json';
import manifest from '../../../reports/m11/character-acceptance/103002/manifest.json';
import requirementInventory from '../../../reports/m11/character-acceptance/103002/requirement-inventory.json';
import scenarioCases from '../../../reports/m11/character-acceptance/103002/scenario-cases.json';
import scenarioMatrix from '../../../reports/m11/character-acceptance/103002/scenario-matrix.json';
import sourceGapInventory from '../../../reports/m11/character-acceptance/103002/source-gap-inventory.json';

const DEFAULT_CHAIN_IDENTITY = 'ruby-normal-default-three-inputs';
const ENHANCED_CHAIN_IDENTITY = 'ruby-enhanced-twelve-inputs';

describe('Ruby 103002 acceptance closure', () => {
  it('keeps every default opener on a complete A1-A2-A3 chain', () => {
    const groups = Map.groupBy(
      activeSurfaceFixture.actions.filter(
        action =>
          action.intent?.attackInput?.chainIdentity === DEFAULT_CHAIN_IDENTITY
      ),
      action => action.intent.attackInput.groupId
    );

    expect(groups.size).toBe(10);
    for (const actions of groups.values()) {
      const chain = actions.toSorted(
        (left, right) =>
          left.intent.attackInput.sequenceIndex -
          right.intent.attackInput.sequenceIndex
      );
      expect(
        chain.map(action => action.intent.attackInput.sequenceIndex)
      ).toEqual([1, 2, 3]);
      expect(
        chain.map(action => action.intent.attackInput.contextActionId ?? null)
      ).toEqual([null, chain[0].id, chain[1].id]);
    }
  });

  it('enters enhanced E1 through the sourced default A3 phase transition', () => {
    const actions = ['ruby-chain-a1', 'ruby-chain-a2', 'ruby-chain-a3'].map(
      actionId => mainFixture.actions.find(action => action.id === actionId)
    );
    const enhanced = mainFixture.actions.find(
      action => action.id === 'ruby-chain-e1'
    );
    const scenario = manifest.evidence.machineScenarios.find(
      entry => entry.scenarioIdentity === 'm11-d-103002-visual-acceptance'
    );
    const selection = scenario.probeResults.find(
      probe => probe.identity === 'probe:variant-selection:ruby-chain-e1'
    );
    const resource = scenario.probeResults.find(
      probe => probe.identity === 'probe:special-resource-change:ruby-chain-e1'
    );

    expect(
      actions.map(action => ({
        id: action.id,
        sequenceIndex: action.intent.attackInput.sequenceIndex,
        chainIdentity: action.intent.attackInput.chainIdentity,
        contextActionId: action.intent.attackInput.contextActionId ?? null,
      }))
    ).toEqual([
      {
        id: 'ruby-chain-a1',
        sequenceIndex: 1,
        chainIdentity: DEFAULT_CHAIN_IDENTITY,
        contextActionId: null,
      },
      {
        id: 'ruby-chain-a2',
        sequenceIndex: 2,
        chainIdentity: DEFAULT_CHAIN_IDENTITY,
        contextActionId: 'ruby-chain-a1',
      },
      {
        id: 'ruby-chain-a3',
        sequenceIndex: 3,
        chainIdentity: DEFAULT_CHAIN_IDENTITY,
        contextActionId: 'ruby-chain-a2',
      },
    ]);
    expect(enhanced).toMatchObject({
      schedule: { mode: 'absolute', frame: 672 },
      intent: {
        attackInput: {
          sequenceIndex: 1,
          groupId: 'm11-d-ruby-normal',
          chainIdentity: ENHANCED_CHAIN_IDENTITY,
          contextActionId: 'ruby-chain-a3',
        },
      },
    });
    expect(selection).toMatchObject({
      passed: true,
      actual: {
        controlSkillId: 10300201,
        subSkillIndex: 1,
        sourceKind: 'attack-chain-phase-transition',
        attackInputChainIdentity: ENHANCED_CHAIN_IDENTITY,
      },
    });
    expect(resource).toMatchObject({
      passed: true,
      actual: {
        payload: { beforeValue: 6, change: -1, afterValue: 5 },
      },
    });
  });

  it('keeps enhanced E1-E12 on one contextual chain after the ultimate reopen', () => {
    const chain = activeSurfaceFixture.actions
      .filter(
        action =>
          action.intent?.attackInput?.chainIdentity === ENHANCED_CHAIN_IDENTITY
      )
      .toSorted(
        (left, right) =>
          left.intent.attackInput.sequenceIndex -
          right.intent.attackInput.sequenceIndex
      );

    expect(chain.map(action => action.id)).toEqual(
      Array.from({ length: 12 }, (_, index) => `ruby-e${index + 1}`)
    );
    expect(chain.map(action => action.schedule.frame)).toEqual([
      2129, 2153, 2177, 2209, 2233, 2257, 2289, 2307, 2325, 2353, 2371, 2408,
    ]);
    expect(
      chain.map(action => action.intent.attackInput.contextActionId)
    ).toEqual([
      'ruby-ultimate',
      ...chain.slice(0, -1).map(action => action.id),
    ]);
  });

  it('locks the reload window to the sourced right-open [24,264) boundary', () => {
    const scenario = manifest.evidence.machineScenarios.find(
      entry =>
        entry.scenarioIdentity === 'm12-b3-103002-reload-window-boundaries'
    );

    expect(scenario.mechanismProbes.inputWindowBoundaries).toMatchObject({
      passed: true,
      details: {
        sourceWindow: '[24,264) source frames',
      },
    });
    expect(
      scenario.mechanismProbes.inputWindowBoundaries.details.cases.map(
        entry => [entry.expectedOffset, entry.actualSubSkillIndex, entry.passed]
      )
    ).toEqual([
      [-300, 0, true],
      [24, 1, true],
      [263, 1, true],
      [264, 0, true],
    ]);
    expect(scenario.mechanismProbes.negativeActionCases).toEqual([
      expect.objectContaining({
        identity: 'negative:reload-window-start-minus-one-23f-lane-overlap',
        passed: true,
      }),
    ]);
  });

  it('publishes complete technical and accepted product evidence', () => {
    expect(requirementInventory.summary).toMatchObject({
      recordCount: 696,
      appliedCount: 190,
      gapCount: 0,
      notApplicableCount: 506,
    });
    expect(scenarioMatrix.summary).toMatchObject({
      requirementCount: 696,
      requiredCount: 190,
      passedCount: 190,
      blockedCount: 0,
      notApplicableCount: 506,
    });
    expect(
      scenarioMatrix.requirements.every(
        requirement => !requirement.required || requirement.status === 'passed'
      )
    ).toBe(true);
    expect(acceptanceLedger.summary).toMatchObject({
      uniqueBlockingCount: 0,
      sourceGapCount: 0,
      acceptanceGapCount: 0,
    });
    expect(sourceGapInventory.summary).toMatchObject({
      uniqueGapCount: 368,
      blockingCount: 0,
      nonBlockingCount: 368,
    });
    expect(scenarioCases.summary).toMatchObject({
      scenarioCount: 6,
      executionPassedCount: 6,
      assertionCount: 1778,
      assertionPassedCount: 1778,
    });
    expect(
      manifest.evidence.machineScenarios.every(
        scenario =>
          scenario.status === 'passed' &&
          scenario.stableReplay === true &&
          scenario.workbenchRoundTrip === 'passed' &&
          scenario.assertionSummary.failedCount === 0
      )
    ).toBe(true);
    expect(manifest.evidence.productVisualAcceptance).toMatchObject({
      status: 'accepted',
      acceptanceCommit: '829d628bff9476c489d03e152e9377fd8c8e9e3c',
      recordIdentity:
        'character-product-acceptance:103002:829d628bff9476c489d03e152e9377fd8c8e9e3c:67a6fedbbd8963ab',
      qualificationSubjectHash: '67a6fedbbd8963ab',
      scenarioSetHash: '1fe9a92cf776d16e',
      bindingStatus: 'verified',
    });
    expect(manifest.maturity).toMatchObject({
      currentState: 'optimization-ready',
      optimizationReady: true,
      gates: {
        visuallyAccepted: true,
        optimizationReady: true,
      },
      blockers: [],
    });
  });
});
