import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import runtimeCapturePlan from '../../../reports/m10/107001/runtime-capture-plan.json';
import unresolvedLedger from '../../../reports/m10/107001/unresolved-ledger.json';
import acceptanceLedger from '../../../reports/m11/character-acceptance/107001/ledger.json';
import manifest from '../../../reports/m11/character-acceptance/107001/manifest.json';
import requirementInventory from '../../../reports/m11/character-acceptance/107001/requirement-inventory.json';
import scenarioCases from '../../../reports/m11/character-acceptance/107001/scenario-cases.json';
import scenarioMatrix from '../../../reports/m11/character-acceptance/107001/scenario-matrix.json';
import sourceGapInventory from '../../../reports/m11/character-acceptance/107001/source-gap-inventory.json';

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..'
);

describe('Sifliya 107001 acceptance closure', () => {
  it('keeps every source closure policy traceable and removes runtime capture blockers', () => {
    const closedRecords = unresolvedLedger.records.filter(
      record => record.sourceClosureDisposition != null
    );

    expect(unresolvedLedger.summary).toMatchObject({
      gameplayImpactingCount: 0,
      sourceClosureAppliedCount: 26,
      sourceClosureNotApplicableCount: 47,
    });
    expect(closedRecords).toHaveLength(73);
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

  it('applies selected source closures while retaining unselected client variants as N/A', () => {
    const selected = unresolvedLedger.records.find(
      record =>
        record.sourceClosurePolicyIdentity ===
        'sifliya-selected-arrow-source-driven-effects'
    );
    const unselected = unresolvedLedger.records.find(
      record =>
        record.sourceClosurePolicyIdentity ===
        'sifliya-unselected-projectile-control-variants'
    );

    expect(selected).toMatchObject({
      status: 'source-closure-applied',
      sourceClosureDisposition: 'applied',
      impactClassification: 'source-runtime-resolved',
    });
    expect(unselected).toMatchObject({
      status: 'not-applicable',
      sourceClosureDisposition: 'not-applicable',
      impactClassification: 'unreachable',
    });
    expect(
      runtimeCapturePlan.entries.some(
        entry => entry.sourceRecordIdentity === unselected.recordIdentity
      )
    ).toBe(false);
  });

  it('passes every required row and leaves only structured nonblocking source records', () => {
    expect(requirementInventory.summary).toMatchObject({
      recordCount: 266,
      appliedCount: 86,
      gapCount: 0,
      notApplicableCount: 180,
    });
    expect(scenarioMatrix.summary).toMatchObject({
      requirementCount: 266,
      requiredCount: 86,
      passedCount: 86,
      blockedCount: 0,
      notApplicableCount: 180,
    });
    expect(
      scenarioMatrix.requirements.every(
        requirement => !requirement.required || requirement.status === 'passed'
      )
    ).toBe(true);
    expect(sourceGapInventory.summary).toMatchObject({
      uniqueGapCount: 116,
      blockingCount: 0,
      nonBlockingCount: 116,
    });
    expect(acceptanceLedger.summary).toMatchObject({
      uniqueBlockingCount: 0,
      sourceGapCount: 0,
      acceptanceGapCount: 0,
    });
  });

  it('publishes only stable automated evidence without self-signing product acceptance', () => {
    expect(scenarioCases.summary).toMatchObject({
      scenarioCount: 3,
      executionPassedCount: 3,
      assertionCount: 805,
      assertionPassedCount: 805,
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
    expect(manifest.evidence.productVisualAcceptance.status).toBe('pending');
    expect(manifest.maturity).toMatchObject({
      optimizationReady: false,
      gates: {
        visuallyAccepted: false,
        optimizationReady: false,
      },
    });
  });

  it('keeps shared compiler and runtime changes free of owner identity branches', () => {
    const sharedSources = [
      'scripts/character-acceptance/character-acceptance-generation.mjs',
      'scripts/generate-character-acceptance.mjs',
      'src/character-acceptance/characterAcceptanceDerivation.js',
      'src/character-acceptance/characterAcceptanceProtocol.js',
      'src/domain/actionHitOverrides.js',
      'src/machine-axis/machineAxisContract.js',
      'src/machine-axis/machineAxisService.js',
      'src/machine-axis/workbenchMachineAxisAdapter.js',
      'src/simulation/headless/canonicalHeadlessCombatCore.js',
      'src/simulation/mechanics/verifiedActionVariantRuntime.js',
    ];
    const pipelineSource = fs.readFileSync(
      path.join(
        REPO_ROOT,
        'scripts/character-combat/character-combat-profile-pipeline.mjs'
      ),
      'utf8'
    );
    const closurePolicySource = pipelineSource.slice(
      pipelineSource.indexOf('function applyUnresolvedRecordPolicy('),
      pipelineSource.indexOf('function classifyUnresolvedImpactClassification(')
    );

    const offenders = sharedSources.filter(relativePath =>
      /107001|Sifliya|西芙莉雅/i.test(
        fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
      )
    );

    expect(offenders).toEqual([]);
    expect(closurePolicySource).not.toMatch(/107001|Sifliya|西芙莉雅/i);
  });
});
