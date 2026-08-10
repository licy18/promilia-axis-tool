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
      appliedCount: 80,
      gapCount: 0,
      notApplicableCount: 186,
    });
    expect(scenarioMatrix.summary).toMatchObject({
      requirementCount: 266,
      requiredCount: 80,
      passedCount: 80,
      blockedCount: 0,
      notApplicableCount: 186,
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
    const formalJointAttackRows = scenarioMatrix.requirements.filter(
      requirement =>
        requirement.sourceIdentities.includes(
          'src/domain/verifiedJointAttackContract.js#JOINT_ATTACK_TRIGGER_STATUS'
        )
    );
    expect(formalJointAttackRows).toHaveLength(6);
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

  it('publishes stable visual and machine evidence for central product acceptance', () => {
    expect(scenarioCases.summary).toMatchObject({
      scenarioCount: 5,
      executionPassedCount: 5,
      assertionCount: 692,
      assertionPassedCount: 692,
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
      acceptanceCommit: 'eb06acc456ee309245a78455e7691738a2ee808b',
      bindingStatus: 'verified',
    });
    expect(
      manifest.evidence.productVisualAcceptance.scenarioIdentities
    ).toEqual(['m12-b3-107001-focused-acceptance']);
    expect(manifest.evidence.productVisualAcceptance.automatedEvidence).toEqual(
      [
        expect.objectContaining({
          scenarioIdentity: 'm12-b3-107001-focused-acceptance',
          evidenceKind: 'workbench-playwright-screenshot',
          status: 'automated-workbench-import-passed',
          fixturePath:
            'fixtures/character-acceptance/107001-active-surface-closure.json',
          fixtureSha256:
            'c0076775d267ae7314d561471f9e26d07a797f122ab768fe1ef632d3a4fbc06a',
          screenshotPath: 'reports/m12-b3-107001-workbench-visual-evidence.png',
          screenshotSha256:
            'cd96f58561aa39af7a7469467d08e3c2b8e1ad70846eeb192b38cbab740ee260',
        }),
      ]
    );
    expect(
      manifest.evidence.productVisualAcceptance.automatedEvidence[0]
    ).not.toHaveProperty('traceSha256');
    expect(manifest.evidence.machineEvidence).toEqual([
      expect.objectContaining({
        scenarioIdentity: 'm12-b3-107001-wind-expiry-boundary',
        evidenceKind: 'machine-axis-trace',
        canonicalTraceHash: 'bff623d319b94a16',
        traceSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    ]);
    expect(manifest.maturity).toMatchObject({
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
