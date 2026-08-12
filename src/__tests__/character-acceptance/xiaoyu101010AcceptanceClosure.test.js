import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import runtimeCapturePlan from '../../../reports/m10/101010/runtime-capture-plan.json';
import unresolvedLedger from '../../../reports/m10/101010/unresolved-ledger.json';
import acceptanceLedger from '../../../reports/m11/character-acceptance/101010/ledger.json';
import manifest from '../../../reports/m11/character-acceptance/101010/manifest.json';
import requirementInventory from '../../../reports/m11/character-acceptance/101010/requirement-inventory.json';
import scenarioCases from '../../../reports/m11/character-acceptance/101010/scenario-cases.json';
import scenarioMatrix from '../../../reports/m11/character-acceptance/101010/scenario-matrix.json';
import sourceGapInventory from '../../../reports/m11/character-acceptance/101010/source-gap-inventory.json';

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..'
);

function findProbe(scenario, identity) {
  return scenario.probeResults.find(probe => probe.identity === identity);
}

describe('Xiaoyu 101010 acceptance closure', () => {
  it('keeps every source closure decision traceable and removes runtime capture blockers', () => {
    const closedRecords = unresolvedLedger.records.filter(
      record => record.sourceClosureDisposition != null
    );
    const policyIdentities = new Set(
      closedRecords.map(record => record.sourceClosurePolicyIdentity)
    );

    expect(unresolvedLedger.summary).toMatchObject({
      gameplayImpactingCount: 0,
      sourceClosureAppliedCount: 50,
      sourceClosureNotApplicableCount: 34,
    });
    expect(policyIdentities.size).toBe(14);
    expect(closedRecords).toHaveLength(84);
    expect(
      closedRecords.every(
        record =>
          record.sourceClosurePolicyIdentity &&
          record.sourceClosureSourceIdentity &&
          record.sourceClosureReasons.length > 0
      )
    ).toBe(true);
    expect(runtimeCapturePlan.summary).toEqual({
      captureCount: 0,
      zeroDistanceBlockingCaptureCount: 0,
      realClientEvidenceCaptureCount: 0,
    });
  });

  it('passes all required rows while retaining frozen reactive and movement sources as structured N/A', () => {
    expect(requirementInventory.summary).toMatchObject({
      recordCount: 383,
      appliedCount: 202,
      gapCount: 0,
      notApplicableCount: 181,
    });
    expect(scenarioMatrix.summary).toMatchObject({
      requirementCount: 383,
      requiredCount: 202,
      passedCount: 202,
      blockedCount: 0,
      notApplicableCount: 181,
    });
    expect(
      scenarioMatrix.requirements.every(
        requirement => !requirement.required || requirement.status === 'passed'
      )
    ).toBe(true);
    expect(
      scenarioMatrix.requirements
        .filter(requirement => requirement.dimension === 'critical')
        .every(requirement => requirement.status === 'passed')
    ).toBe(true);
    expect(
      scenarioMatrix.requirements.filter(
        requirement => requirement.dimension === 'critical'
      )
    ).toHaveLength(9);
    expect(
      scenarioMatrix.requirements.some(
        requirement =>
          requirement.status === 'not-applicable' &&
          requirement.scenarioScope?.policyIdentity ===
            'm12c-zero-distance-passive-boss-v1'
      )
    ).toBe(true);
    expect(sourceGapInventory.summary).toMatchObject({
      uniqueGapCount: 162,
      blockingCount: 0,
      nonBlockingCount: 162,
    });
    expect(acceptanceLedger.summary).toMatchObject({
      uniqueBlockingCount: 0,
      sourceGapCount: 0,
      acceptanceGapCount: 0,
    });
    const formalJointAttackRows = scenarioMatrix.requirements.filter(
      requirement =>
        requirement.sourceIdentities.includes(
          'src/domain/verifiedJointAttackContract.js#JOINT_ATTACK_TRIGGER_STATUS'
        )
    );
    expect(formalJointAttackRows).toHaveLength(4);
    expect(
      formalJointAttackRows.every(
        requirement =>
          requirement.status === 'not-applicable' &&
          requirement.required === false &&
          requirement.reasons.includes('joint-attack-trigger-unresolved')
      )
    ).toBe(true);
    expect(
      acceptanceLedger.records.some(record =>
        record.sourceIdentities.includes(
          'src/domain/verifiedJointAttackContract.js#JOINT_ATTACK_TRIGGER_STATUS'
        )
      )
    ).toBe(false);
  });

  it('proves threshold ordering, right-open expiry, input windows, and miss or blocked suppression', () => {
    const main = manifest.evidence.machineScenarios.find(
      scenario => scenario.scenarioIdentity === 'm11-d-101010-visual-acceptance'
    );
    const threshold = findProbe(main, 'resource-exact-and-insufficient');
    const a4Positive = findProbe(
      main,
      'a4-four-landed-hits-share-direct-sp-to-two-allies'
    );
    const blocked = findProbe(main, 'blocked-hit-suppresses-damage');
    const insufficient = findProbe(main, 'condition-insufficient-negative');
    const isolated = main.mechanismProbes.isolatedActionCases.find(
      entry => entry.identity === 'isolated:a4-miss-and-blocked-no-direct-sp'
    );
    const interrupted = main.mechanismProbes.runtimeInterruptionCases.find(
      entry =>
        entry.identity ===
        'runtime-interruption:a4-interrupted-before-third-hit'
    );

    expect(threshold).toMatchObject({
      passed: true,
      actual: {
        exactSameFrame: true,
        insufficientThresholds: [],
      },
    });
    expect(threshold.actual.thresholdIndex).toBeGreaterThan(
      threshold.actual.exactGainIndex
    );
    expect(main.mechanismProbes.buffLifecycle.passed).toBe(true);
    expect(
      main.mechanismProbes.buffLifecycle.details.rightOpenMatches.every(
        match => match.duration === 10_000 && match.passed === true
      )
    ).toBe(true);
    expect(main.mechanismProbes.inputWindowBoundaries).toMatchObject({
      passed: true,
      details: {
        sourceWindow: '[75,100) source frames',
      },
    });
    expect(
      main.mechanismProbes.inputWindowBoundaries.details.cases.map(entry => [
        entry.expectedOffset,
        entry.actualSubSkillIndex,
      ])
    ).toEqual([
      [-200, 0],
      [75, 1],
      [99, 1],
      [100, 0],
    ]);
    expect(main.mechanismProbes.negativeActionCases).toEqual([
      expect.objectContaining({
        identity:
          'negative:charged-input-window-start-minus-one-74f-lane-overlap',
        passed: true,
      }),
    ]);
    expect(a4Positive).toMatchObject({
      passed: true,
      actual: {
        count: 8,
        rows: [
          expect.objectContaining({ absoluteFrame: 1125, change: 0.299988 }),
          expect.objectContaining({ absoluteFrame: 1125, change: 0.299988 }),
          expect.objectContaining({ absoluteFrame: 1129, change: 0.299988 }),
          expect.objectContaining({ absoluteFrame: 1129, change: 0.299988 }),
          expect.objectContaining({ absoluteFrame: 1133, change: 0.299988 }),
          expect.objectContaining({ absoluteFrame: 1133, change: 0.299988 }),
          expect.objectContaining({ absoluteFrame: 1137, change: 0.299988 }),
          expect.objectContaining({ absoluteFrame: 1137, change: 0.299988 }),
        ],
      },
    });
    expect(blocked).toMatchObject({ passed: true, actual: { count: 0 } });
    expect(insufficient).toMatchObject({ passed: true, actual: { count: 0 } });
    expect(isolated).toMatchObject({ passed: true });
    expect(
      isolated.actual.probeResults
        .filter(probe => /no-combat-hit|no-direct-sp/.test(probe.identity))
        .every(probe => probe.actual.count === 0)
    ).toBe(true);
    expect(interrupted).toMatchObject({
      passed: true,
      actual: {
        effectiveEndFrame: 18,
        directSpCount: 2,
        landedHitRuntimeMisses: [
          {
            bindingIdentity: 'xiaoyu-a4-zero-distance-hit-sp',
            triggerFrame: 18,
            withinOccupancy: false,
          },
          {
            bindingIdentity: 'xiaoyu-a4-zero-distance-hit-sp',
            triggerFrame: 22,
            withinOccupancy: false,
          },
        ],
      },
    });
    expect(
      interrupted.actual.trace.directSpEvents.map(event => event.value)
    ).toEqual([0.6, 0.6]);
  });

  it('binds wind and light tuning consumption to landed source effects and distinct packet paths', () => {
    const main = scenarioCases.records.find(
      scenario => scenario.scenarioIdentity === 'm11-d-101010-visual-acceptance'
    );
    const lightUltimate = scenarioCases.records.find(
      scenario => scenario.scenarioIdentity === 'm12-b3-101010-light-ultimate'
    );
    const mainTuningEffects = main.traceProjection.effects.filter(effect =>
      String(effect.operation).startsWith('tuning-consume')
    );
    const ultimateTuningEffects = lightUltimate.traceProjection.effects.filter(
      effect => String(effect.operation).startsWith('tuning-consume')
    );

    expect(
      mainTuningEffects.filter(
        effect =>
          effect.actionId ===
            'xiaoyu-switch-back-for-star-carry--on-enter--actor-101010--star-carry' &&
          effect.operation === 'tuning-consume-packet'
      )
    ).toEqual([
      expect.objectContaining({
        effectIdentity: 'battle-element:799',
        sourceIdentity: expect.stringContaining('battle-effect:10101021:0:'),
      }),
    ]);
    expect(
      mainTuningEffects.find(
        effect =>
          effect.actionId === 'xiaoyu-star-source' &&
          effect.operation === 'tuning-consume-packet'
      )
    ).toMatchObject({
      effectIdentity: 'battle-element:999',
      sourceIdentity: expect.stringContaining('battle-effect:10101012:0:'),
    });
    expect(
      mainTuningEffects.some(
        effect => effect.actionId === 'xiaoyu-wind-insufficient'
      )
    ).toBe(false);
    expect(
      ultimateTuningEffects.filter(
        effect => effect.operation === 'tuning-consume-packet'
      )
    ).toHaveLength(3);
    expect(
      ultimateTuningEffects.filter(
        effect => effect.operation === 'tuning-consume-judgment'
      )
    ).toHaveLength(3);
    expect(
      ultimateTuningEffects.every(
        effect =>
          effect.actionId === 'xiaoyu-light-ultimate' &&
          effect.sourceIdentity.includes('battle-effect:10101013:0:')
      )
    ).toBe(true);
    expect(
      ultimateTuningEffects
        .filter(effect => effect.operation === 'tuning-consume-packet')
        .every(effect => effect.effectIdentity === 'battle-element:999')
    ).toBe(true);
  });

  it('publishes stable technical evidence with accepted product binding', () => {
    expect(scenarioCases.summary).toMatchObject({
      scenarioCount: 4,
      executionPassedCount: 4,
      assertionCount: 1312,
      assertionPassedCount: 1312,
    });
    expect(
      scenarioCases.records.every(
        scenario =>
          scenario.execution.status === 'passed' &&
          scenario.execution.stableReplay === true &&
          scenario.assertions.every(assertion => assertion.status === 'passed')
      )
    ).toBe(true);
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
      acceptanceCommit: '13d28aa515312a63395f49ddff3c778967e1b20f',
      recordIdentity:
        'character-product-acceptance:101010:13d28aa515312a63395f49ddff3c778967e1b20f:6c361b4ae3dc61a8',
      qualificationSubjectHash: '6c361b4ae3dc61a8',
      scenarioSetHash: 'eca42d0ce3b24bf0',
      bindingStatus: 'verified',
      automatedEvidence: [
        expect.objectContaining({
          scenarioIdentity: 'm11-d-101010-visual-acceptance',
          evidenceKind: 'workbench-playwright-screenshot',
          status: 'automated-workbench-import-passed',
          fixturePath: 'fixtures/character-acceptance/101010-visual.json',
          fixtureSha256:
            '0b9128883b509b8c7cd0a096b9d9c36ad7f5407a74864a9d1b6b21ff8d2a914a',
          screenshotPath:
            'work/m12-c/product-review/visual-evidence/2026-08-12/20260812-bda6696e-101010-canonical-trace.png',
          screenshotSha256:
            '05005798c185bf4c7bff789f2256694317e0fc336eea65c248364bb173a66cfa',
        }),
      ],
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

  it('keeps shared compiler and runtime changes free of owner identity branches', () => {
    const sharedSources = [
      'scripts/character-acceptance/character-acceptance-generation.mjs',
      'scripts/character-combat/character-combat-production-orchestrator.mjs',
      'src/machine-axis/machineAxisService.js',
      'src/machine-axis/workbenchMachineAxisAdapter.js',
      'src/simulation/mechanics/verifiedActionVariantRuntime.js',
    ];
    const generatorSource = fs.readFileSync(
      path.join(REPO_ROOT, 'scripts/generate-character-acceptance.mjs'),
      'utf8'
    );
    const legacyMitiProbeStart = generatorSource.indexOf(
      'function inspectMitiForegroundBackgroundSwitch('
    );
    const legacyMitiProbeEnd = generatorSource.indexOf(
      'function projectVerifiedTuningComponentEffects(',
      legacyMitiProbeStart
    );
    const genericGeneratorSource =
      generatorSource.slice(0, legacyMitiProbeStart) +
      generatorSource.slice(legacyMitiProbeEnd);
    const offenders = sharedSources.filter(relativePath =>
      /101010|Xiaoyu|小玉/i.test(
        fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
      )
    );

    expect(offenders).toEqual([]);
    expect(genericGeneratorSource).not.toMatch(/101010|Xiaoyu|小玉/i);
  });
});
