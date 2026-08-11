import { describe, expect, it } from 'vitest';
import fixture from '../../../fixtures/character-acceptance/102001-visual.json';
import manifest from '../../../reports/m11/character-acceptance/102001/manifest.json';
import scenarioCases from '../../../reports/m11/character-acceptance/102001/scenario-cases.json';
import { validateCharacterAcceptanceManifest } from '../../character-acceptance/characterAcceptanceProtocol';

const SCENARIO_POLICY = 'm12c-zero-distance-passive-boss-v1';

describe('Lily M12-B3 owner character acceptance', () => {
  it('publishes a complete accepted owner-only matrix', () => {
    expect(
      validateCharacterAcceptanceManifest(manifest, {
        checkPublication: false,
      })
    ).toMatchObject({ valid: true, issues: [] });
    expect(manifest.owner).toMatchObject({
      ownerId: 102001,
      ownerName: '莉莉',
    });
    expect(manifest.requirementInventory.summary).toMatchObject({
      recordCount: 260,
      appliedCount: 108,
      gapCount: 0,
      notApplicableCount: 152,
    });
    expect(manifest.matrix.summary).toMatchObject({
      requiredCount: 108,
      passedCount: 108,
      blockedCount: 0,
      notApplicableCount: 152,
    });
    expect(manifest.sourceGapInventory.summary).toMatchObject({
      blockingCount: 0,
      nonBlockingCount: 33,
    });
    expect(manifest.ledger.summary).toMatchObject({
      uniqueBlockingCount: 0,
      sourceGapCount: 0,
      acceptanceGapCount: 0,
    });
    expect(manifest.maturity).toMatchObject({
      currentState: 'optimization-ready',
      optimizationReady: true,
      gates: {
        extracted: true,
        runtimeIntegrated: true,
        visuallyAccepted: true,
        optimizationReady: true,
      },
      blockers: [],
    });
    expect(manifest.evidence.productVisualAcceptance).toMatchObject({
      status: 'accepted',
      acceptanceCommit: 'be60e68d1c1bcf77a962426ddb0af37fc384c4da',
      bindingStatus: 'verified',
      scenarioIdentities: ['m12-b3-102001-zero-distance-acceptance'],
      automatedEvidence: [
        {
          scenarioIdentity: 'm12-b3-102001-zero-distance-acceptance',
          status: 'automated-workbench-import-passed',
          screenshotPath:
            'reports/m11-d-character-acceptance-102001-desktop.png',
          screenshotSha256:
            '71f35e3e964093414d56841759d63d33b38dde7cdf432f30b0e85c8c6799b516',
        },
      ],
    });
  }, 15000);

  it('passes every declared assertion including the refresh lifecycle fact', () => {
    expect(scenarioCases.summary).toMatchObject({
      scenarioCount: 2,
      executionPassedCount: 2,
    });
    expect(
      manifest.matrix.requirements.filter(requirement =>
        requirement.reasons.includes('joint-attack-trigger-unresolved')
      )
    ).toHaveLength(4);
    expect(scenarioCases.summary.assertionCount).toBeGreaterThan(0);
    expect(scenarioCases.summary.assertionPassedCount).toBe(
      scenarioCases.summary.assertionCount
    );
    expect(
      scenarioCases.records
        .flatMap(record => record.assertions)
        .every(assertion => assertion.status === 'passed')
    ).toBe(true);

    const goldenScenario = scenarioCases.records.find(
      record =>
        record.scenarioIdentity === 'm12-b3-102001:active-surface-golden'
    );
    expect(
      goldenScenario.assertions.find(
        assertion =>
          assertion.assertionIdentity ===
          'scenario-fact:buff-apply-refresh-stack-expire'
      )
    ).toMatchObject({
      status: 'passed',
      actualProjectionIdentities: ['fact:buff-apply-refresh-stack-expire'],
      reasons: [],
    });
  });

  it('locks landed-hit cardinality, interruption, gates, and exact lifecycles to real traces', () => {
    const scenario = manifest.evidence.machineScenarios[0];
    expect(scenario).toMatchObject({
      status: 'passed',
      stableReplay: true,
      workbenchRoundTrip: 'passed',
      assertionSummary: { failedCount: 0 },
    });
    expect(scenario.assertionSummary.passedCount).toBe(
      scenario.assertionSummary.assertionCount
    );

    const probes = new Map(
      scenario.probeResults.map(result => [result.identity, result])
    );
    expect(probes.get('probe:trace-query:star-five-direct-sp')).toMatchObject({
      passed: true,
      actual: {
        count: 5,
        rows: [
          { absoluteFrame: 2032, change: 0.5 },
          { absoluteFrame: 2037, change: 0.5 },
          { absoluteFrame: 2042, change: 0.5 },
          { absoluteFrame: 2048, change: 0.5 },
          { absoluteFrame: 2054, change: 0.5 },
        ],
      },
    });
    expect(
      probes.get('probe:trace-query:ultimate-three-wind-marks')
    ).toMatchObject({
      passed: true,
      actual: {
        count: 3,
        rows: [
          { frameIndex: 1861, before: 0, after: 1 },
          { frameIndex: 1866, before: 1, after: 2 },
          { frameIndex: 1870, before: 2, after: 3 },
        ],
      },
    });
    expect(
      probes.get('probe:trace-duration:will-exact-seven-second-duration')
    ).toMatchObject({ passed: true, actual: { durationMs: 7000 } });
    expect(
      probes.get('probe:trace-query:star-carry-level-one-guard')
    ).toMatchObject({
      passed: true,
      actual: {
        rows: [
          { absoluteFrame: 2851, 'modifiers.0.valueRaw': 1900 },
          { absoluteFrame: 3211, 'modifiers.0.valueRaw': 1900 },
        ],
      },
    });
    expect(
      scenario.mechanismProbes.negativeActionCases.every(
        result => result.passed
      )
    ).toBe(true);
    const actionLevels = new Map(
      scenario.mechanismProbes.actionLevelCases.map(result => [
        result.identity,
        result,
      ])
    );
    expect([...actionLevels.values()].every(result => result.passed)).toBe(
      true
    );
    expect(
      actionLevels.get('action-level:canonical-level-twelve')
    ).toMatchObject({
      actual: {
        resolution: {
          level: 12,
          source: 'action.level',
          legacyFallback: false,
        },
        failure: null,
      },
    });
    expect(
      actionLevels.get('action-level:canonical-legacy-conflict')
    ).toMatchObject({
      actual: {
        resolution: null,
        failure: { code: 'verified-action-level-conflict' },
      },
    });
    expect(
      actionLevels.get('action-level:invalid-canonical-does-not-fallback')
    ).toMatchObject({
      actual: {
        resolution: null,
        failure: { code: 'verified-action-level-invalid' },
      },
    });
    expect(
      scenario.mechanismProbes.isolatedActionCases.map(result => [
        result.identity,
        result.passed,
      ])
    ).toEqual([
      ['isolated:ultimate-last-mark-only', true],
      ['isolated:ultimate-all-mark-hits-miss', true],
      ['isolated:star-at-sp-cap', true],
    ]);
    expect(
      scenario.mechanismProbes.runtimeInterruptionCases.map(result => ({
        identity: result.identity,
        passed: result.passed,
        directSpCount: result.actual.directSpCount,
        remainingTuningMarkFrames: result.actual.remainingTuningMarkFrames,
      }))
    ).toEqual([
      {
        identity: 'runtime-interruption:star-skill-interrupted-at-44f',
        passed: true,
        directSpCount: 3,
        remainingTuningMarkFrames: [],
      },
      {
        identity: 'runtime-interruption:ultimate-interrupted-at-218f',
        passed: true,
        directSpCount: 0,
        remainingTuningMarkFrames: [211, 216],
      },
    ]);
    expect(
      scenario.mechanismProbes.runtimeInterruptionCases[0].actual
        .targetStateChangeCountByIdentityAndOperation
    ).toEqual({
      'lily-will:gain': 1,
      'lily-will:expire': 1,
    });
  });

  it('retains enemy-driven sources as structured N/A without Boss stimuli', () => {
    expect(fixture.scenario.projectile).toEqual({
      targetDistance: 0,
      defaultWillHit: true,
    });
    expect(fixture.actions.every(action => action.owner.kind === 'actor')).toBe(
      true
    );
    const scenarioScoped = manifest.notApplicableRecords.filter(
      record => record.scenarioScope?.policyIdentity === SCENARIO_POLICY
    );
    for (const reason of [
      'enemy-hit-driven-perfect-defense-branch-not-applicable-in-passive-boss-scenario',
      'perfect-defense-state-required-not-applicable-in-passive-boss-scenario',
      'passive-boss-does-not-produce-received-damage-events',
      'passive-boss-does-not-produce-required-defense-events',
    ]) {
      const matching = scenarioScoped.filter(record =>
        record.reason.includes(reason)
      );
      expect(matching.length).toBeGreaterThan(0);
      expect(
        matching.every(
          record =>
            record.status === 'not-applicable' &&
            record.sourceIdentities.length > 0
        )
      ).toBe(true);
    }
  });
});
