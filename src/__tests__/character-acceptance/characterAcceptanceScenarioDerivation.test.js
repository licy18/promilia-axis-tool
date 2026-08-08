import xiaoyuProfile from '../../data/generated/character-combat-profiles/101010.json';
import xiaoyuRuntimeCoverage from '../../../reports/m10/101010/runtime-coverage.json';
import xiaoyuGolden from '../../../reports/m10/101010/golden-trace.json';
import {
  applyCharacterAcceptanceSourceGapDispositions,
  createCharacterAcceptanceMatrix,
  hasRepeatedApplyRefreshLifecycle,
} from '../../../scripts/character-acceptance/character-acceptance-generation.mjs';
import {
  finalizeScenarioCases,
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
});
