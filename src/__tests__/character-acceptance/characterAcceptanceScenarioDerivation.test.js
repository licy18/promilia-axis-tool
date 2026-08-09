import xiaoyuProfile from '../../data/generated/character-combat-profiles/101010.json';
import xiaoyuRuntimeCoverage from '../../../reports/m10/101010/runtime-coverage.json';
import xiaoyuGolden from '../../../reports/m10/101010/golden-trace.json';
import {
  applyCharacterAcceptanceSourceGapDispositions,
  createCharacterAcceptanceMatrix,
  createCharacterAcceptanceRequirementSources,
  hasRepeatedApplyRefreshLifecycle,
} from '../../../scripts/character-acceptance/character-acceptance-generation.mjs';
import {
  deriveCoverageEdges,
  finalizeScenarioCases,
  finalizeRequirementInventory,
  finalizeSourceGapInventory,
} from '../../character-acceptance/characterAcceptanceDerivation';

describe('character acceptance scenario derivation', () => {
  it('recognizes a same-effect repeated apply with extended expiry as a real refresh lifecycle', () => {
    const lifecycle = [
      {
        effectId: 'synthetic-effect',
        targetId: 'actor-a',
        operation: 'apply',
        expiresAtMs: 6000,
      },
      {
        effectId: 'synthetic-effect',
        targetId: 'actor-a',
        operation: 'apply',
        expiresAtMs: 6500,
      },
      {
        effectId: 'synthetic-effect',
        targetId: 'actor-a',
        operation: 'expire',
      },
    ];

    expect(hasRepeatedApplyRefreshLifecycle(lifecycle)).toBe(true);
    expect(
      hasRepeatedApplyRefreshLifecycle([
        lifecycle[0],
        { ...lifecycle[1], targetId: 'actor-b' },
        lifecycle[2],
      ])
    ).toBe(false);
    expect(
      hasRepeatedApplyRefreshLifecycle([
        lifecycle[0],
        lifecycle[2],
        lifecycle[1],
      ])
    ).toBe(false);
  });

  it('preserves source-backed passive-scenario N/A as structured scope', () => {
    const [projected] = applyCharacterAcceptanceSourceGapDispositions(
      [
        {
          recordIdentity: 'fixture:passive-scenario-gap',
          status: 'not-applicable',
          impactClassification: 'not-applicable',
          reasons: [
            'passive-boss-does-not-produce-required-defense-events',
            'scenario-out-of-scope-not-applicable',
          ],
          sourceIdentity: 'fixture:defense-source',
        },
      ],
      [],
      {
        policyIdentity: 'fixture-passive-boss-v1',
        sourceIdentity: 'fixture:scenario-policy',
      }
    );
    const inventory = finalizeSourceGapInventory([projected]);

    expect(inventory.records[0]).toMatchObject({
      status: 'not-applicable',
      blocking: false,
      scenarioScope: {
        disposition: 'not-applicable',
        policyIdentity: 'fixture-passive-boss-v1',
        reason: 'passive-boss-does-not-produce-required-defense-events',
        sourceIdentity: 'fixture:defense-source',
      },
    });
  });

  it('classifies input timing by its source control while other dimensions use execution control', () => {
    const sourceControlSkillId = 25;
    const executionControlSkillId = 42;
    const sourceIdentity = 'fixture:source-to-execution-input-edge';
    const profile = {
      owner: { ownerId: 999001 },
      contracts: {
        timingInputEdges: [
          {
            identity: 'fixture-input-edge',
            sourceControlSkillId,
            sourceSubSkillIndex: 0,
            executionControlSkillId,
            executionSubSkillIndex: 1,
            sourceIdentity,
            status: 'applied',
            applied: true,
          },
        ],
        variantEdges: [
          {
            identity: 'fixture-variant-edge',
            sourceControlSkillId,
            sourceSubSkillIndex: 0,
            executionControlSkillId,
            executionSubSkillIndex: 1,
            sourceIdentity,
            status: 'applied',
            applied: true,
          },
        ],
      },
    };
    const requirements = createCharacterAcceptanceRequirementSources({
      profile,
      recipe: {
        scenarioScope: {
          policyIdentity: 'fixture-source-control-scope',
          reason: 'fixture-execution-control-is-derived',
          sourceIdentity: 'fixture:scope-policy',
          includedControlSubskills: [
            { controlSkillId: sourceControlSkillId, subSkillIndex: 0 },
          ],
        },
      },
    });
    const inputTiming = requirements.find(
      requirement => requirement.dimension === 'input-timing'
    );
    const variantEdge = requirements.find(
      requirement => requirement.dimension === 'variant-edge'
    );

    expect(inputTiming).toMatchObject({
      sourceDisposition: 'applied',
      contractStatus: 'applied',
    });
    expect(inputTiming).not.toHaveProperty('scenarioScope');
    expect(variantEdge).toMatchObject({
      sourceDisposition: 'not-applicable',
      scenarioScope: {
        disposition: 'not-applicable',
        controlSkillId: executionControlSkillId,
        subSkillIndex: 1,
        policyIdentity: 'fixture-source-control-scope',
      },
    });
  });

  it('fails closed for an unmatched declared source-gap disposition', () => {
    expect(() =>
      applyCharacterAcceptanceSourceGapDispositions(
        [],
        [
          {
            recordIdentity: 'fixture:missing-gap',
            status: 'not-applicable',
            policyIdentity: 'fixture-passive-boss-v1',
            reason: 'fixture-out-of-scope',
            sourceIdentity: 'fixture:source',
          },
        ],
        {
          policyIdentity: 'fixture-passive-boss-v1',
          sourceIdentity: 'fixture:scenario-policy',
        }
      )
    ).toThrow(
      'Character acceptance source-gap disposition did not match source'
    );
  });

  it('derives a formerly hardcoded critical gate from an executed scenario assertion', () => {
    const scenarioIdentity = 'synthetic-critical-zero-rate';
    const matrix = createCharacterAcceptanceMatrix({
      profile: xiaoyuProfile,
      runtimeCoverage: xiaoyuRuntimeCoverage,
      goldens: [
        {
          path: 'reports/m10/101010/golden-trace.json',
          report: xiaoyuGolden,
        },
      ],
      visualScenario: {
        scenarioIdentity,
        status: 'passed',
        fixturePath: 'fixtures/synthetic-critical-zero-rate.json',
        workbenchRoundTrip: 'passed',
        stableReplay: true,
        criticalMatrix: {},
        traceProjection: {
          actionForms: [],
          hits: [],
          effects: [],
          resources: [],
          states: [],
          diagnostics: [],
          criticalDecisions: [
            {
              projectionIdentity: 'synthetic-critical-zero',
              effectiveThresholdBasisPoints: 0,
            },
          ],
          facts: {},
        },
        assertionResults: [
          {
            assertionIdentity: 'critical-rate-zero',
            status: 'passed',
            selector: {
              kind: 'critical-effective-threshold',
              expectedBasisPoints: 0,
            },
          },
        ],
      },
    });
    const requirement = matrix.requirements.find(
      row => row.requirementIdentity === 'protocol:101010:critical-rate-zero'
    );

    expect(requirement).toMatchObject({
      status: 'passed',
      evidenceScenarioIds: [scenarioIdentity],
      reasons: [],
    });
  });

  it('does not turn an observed false scenario fact into a failing positive assertion', () => {
    const cases = finalizeScenarioCases([
      {
        scenarioIdentity: 'synthetic-fact-projection',
        status: 'passed',
        traceProjection: {
          facts: {
            observed: true,
            notObserved: false,
          },
        },
      },
    ]);

    expect(cases.records[0].assertions).toMatchObject([
      {
        assertionIdentity: 'scenario-fact:observed',
        status: 'passed',
      },
    ]);
    expect(
      cases.records[0].assertions.some(
        assertion => assertion.assertionIdentity === 'scenario-fact:notObserved'
      )
    ).toBe(false);
  });

  it('keeps same-element effect requirements isolated by source trigger coordinates', () => {
    const requirementInventory = finalizeRequirementInventory([
      {
        requirementIdentity: 'synthetic:judgment:173',
        dimension: 'effect',
        sourceDisposition: 'applied',
        coverageSelector: {
          kind: 'effect',
          effectIdentity: 'battle-element:9001',
          controlSkillId: 900101,
          subSkillIndex: 0,
          triggerFrame: 173,
          behaviorPathId: 'behavior-a',
        },
      },
      {
        requirementIdentity: 'synthetic:judgment:237',
        dimension: 'effect',
        sourceDisposition: 'applied',
        coverageSelector: {
          kind: 'effect',
          effectIdentity: 'battle-element:9001',
          controlSkillId: 900101,
          subSkillIndex: 0,
          triggerFrame: 237,
          behaviorPathId: 'behavior-b',
        },
      },
    ]);
    const scenarioCases = finalizeScenarioCases([
      {
        scenarioIdentity: 'synthetic:single-judgment',
        status: 'passed',
        traceProjection: {
          effects: [
            {
              projectionIdentity: 'synthetic-effect-173',
              actionId: 'synthetic-action',
              effectIdentity: 'battle-element:9001',
              operation: 'evaluate',
              controlSkillId: 900101,
              subSkillIndex: 0,
              triggerFrame: 173,
              behaviorPathId: 'behavior-a',
            },
          ],
        },
      },
    ]);

    const coverage = deriveCoverageEdges(requirementInventory, scenarioCases);

    expect(coverage.edges.map(edge => edge.requirementIdentity)).toEqual([
      'synthetic:judgment:173',
    ]);
    expect(scenarioCases.records[0].assertions[0].selector).toMatchObject({
      controlSkillId: 900101,
      subSkillIndex: 0,
      triggerFrame: 173,
      behaviorPathId: 'behavior-a',
    });
  });

  it('derives action-effect binding selectors with their owning control coordinate', () => {
    const sources = createCharacterAcceptanceRequirementSources({
      profile: {
        owner: { ownerId: 900001 },
        contracts: {
          actionEffectBindings: [
            {
              bindingIdentity: 'synthetic-binding-a',
              controlSkillId: 900101,
              subSkillIndex: 0,
              elementId: 9001,
              sourceIdentity: 'fixture:binding-a',
              status: 'applied',
              applied: true,
            },
            {
              bindingIdentity: 'synthetic-binding-b',
              controlSkillId: 900102,
              subSkillIndex: 1,
              elementId: 9001,
              sourceIdentity: 'fixture:binding-b',
              status: 'applied',
              applied: true,
            },
          ],
        },
      },
    }).filter(row => row.dimension === 'action-effect-binding');

    expect(sources.map(row => row.coverageSelector)).toEqual([
      {
        kind: 'effect',
        effectIdentity: 'battle-element:9001',
        controlSkillId: 900101,
        subSkillIndex: 0,
      },
      {
        kind: 'effect',
        effectIdentity: 'battle-element:9001',
        controlSkillId: 900102,
        subSkillIndex: 1,
      },
    ]);
  });
});
