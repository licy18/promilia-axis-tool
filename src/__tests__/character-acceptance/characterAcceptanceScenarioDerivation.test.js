import xiaoyuProfile from '../../data/generated/character-combat-profiles/101010.json';
import xiaoyuRuntimeCoverage from '../../../reports/m10/101010/runtime-coverage.json';
import xiaoyuGolden from '../../../reports/m10/101010/golden-trace.json';
import { createCharacterAcceptanceMatrix } from '../../../scripts/character-acceptance/character-acceptance-generation.mjs';

describe('character acceptance scenario derivation', () => {
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
});
