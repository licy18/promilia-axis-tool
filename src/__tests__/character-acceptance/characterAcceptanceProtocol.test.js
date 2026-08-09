import {
  UNNAMED_SECONDARY_PASSIVE_REASON,
  assertCharacterOptimizationReady,
  finalizeCharacterAcceptanceManifest,
  validateCharacterAcceptanceManifest,
} from '../../character-acceptance/characterAcceptanceProtocol';
import xiaoyuManifest from '../../../reports/m11/character-acceptance/101010/manifest.json';

function createManifestInput({
  productVisualStatus = 'accepted',
  matrixStatus = 'passed',
  scenarioStatus = 'passed',
  stableReplay = true,
  workbenchRoundTrip = 'passed',
  ledger = [],
  profileValid = true,
} = {}) {
  const scenarioIdentity = 'synthetic-scenario';
  const input = {
    schemaVersion: 1,
    contractName: 'AzPrCharacterAcceptanceProtocol',
    kind: 'azpr-character-acceptance-manifest',
    protocolIdentity: 'm11-d-character-acceptance-v1',
    owner: { ownerId: 999001, ownerName: 'Synthetic' },
    source: {
      profileIdentity: 'synthetic-profile',
      profileHash: 'profile-hash',
      profileValidationStatus: profileValid
        ? 'character-combat-profile-valid'
        : 'character-combat-profile-invalid',
      sourcePackageHash: 'source-package-hash',
    },
    evidence: {
      canonicalGoldens: [
        {
          evidenceIdentity: 'synthetic-golden',
          reportPath: 'reports/synthetic.json',
          status: scenarioStatus,
          replayHash: 'replay-hash',
          summaryHash: 'summary-hash',
          canonicalHashes: {
            input: '0000000000000001',
            data: '0000000000000002',
            trace: '0000000000000003',
            evaluation: null,
          },
          assertionCount: 1,
        },
      ],
      machineScenarios: [
        {
          scenarioIdentity,
          fixturePath: 'fixtures/synthetic.json',
          status: scenarioStatus,
          stableReplay,
          workbenchRoundTrip,
          canonicalHashes: {
            input: '0000000000000001',
            data: '0000000000000002',
            trace: '0000000000000003',
            evaluation: '0000000000000004',
          },
        },
      ],
      productVisualAcceptance: {
        status: 'pending',
        scenarioIdentities: [scenarioIdentity],
        acceptanceCommit:
          productVisualStatus === 'accepted' ? 'a'.repeat(40) : null,
        recordIdentity: null,
        qualificationSubjectHash: null,
        scenarioSetHash: null,
        automatedEvidence: [
          {
            scenarioIdentity,
            evidenceKind: 'workbench-playwright-screenshot',
            status: 'automated-workbench-import-passed',
            fixturePath: 'fixtures/synthetic.json',
            fixtureSha256: '1'.repeat(64),
            canonicalTraceHash: '0000000000000003',
            screenshotPath: 'reports/synthetic.png',
            screenshotSha256: '0'.repeat(64),
          },
        ],
      },
    },
    requirementInventory: {
      records: [
        {
          requirementIdentity: 'synthetic:required',
          dimension: 'action-form',
          subjectIdentity: 'synthetic-form',
          sourceDisposition: 'applied',
          contractStatus: 'applied',
          impactClassification: 'gameplay-impacting',
          coverageSelector: {
            kind: 'action-form',
            ownerId: 999001,
            controlSkillId: 99900101,
            subSkillIndex: 0,
          },
          sourceIdentities: ['synthetic-source'],
          reasons: [],
        },
      ],
    },
    sourceGapInventory: {
      records: ledger.map(record => ({
        ...record,
        impactClassification: 'gameplay-impacting',
      })),
    },
    scenarioCases: {
      records: [
        {
          scenarioIdentity,
          runnerKind: 'machine-axis',
          inputReference: {
            fixturePath: 'fixtures/synthetic.json',
            inputHash: '0000000000000001',
          },
          execution: {
            status: scenarioStatus,
            stableReplay,
            workbenchRoundTrip,
            canonicalHashes: {
              input: '0000000000000001',
              data: '0000000000000002',
              trace: '0000000000000003',
              evaluation: '0000000000000004',
            },
          },
          traceProjection: {
            actionForms:
              matrixStatus === 'passed'
                ? [
                    {
                      projectionIdentity: 'synthetic-action-form',
                      actionId: 'synthetic-action',
                      ownerId: 999001,
                      controlSkillId: 99900101,
                      subSkillIndex: 0,
                    },
                  ]
                : [],
            hits: [],
            effects: [],
            resources: [],
            states: [],
            diagnostics: [],
            criticalDecisions: [],
            facts: {},
          },
        },
      ],
    },
    coverageContext: {
      denominator: {},
      runtimeCoverageSummary: {},
    },
  };
  if (productVisualStatus !== 'accepted') return input;

  const preview = finalizeCharacterAcceptanceManifest(input);
  const binding = preview.evidence.productVisualAcceptance.bindingExpectation;
  input.evidence.productVisualAcceptance = {
    ...input.evidence.productVisualAcceptance,
    status: 'accepted',
    scenarioIdentities: binding.scenarioIdentities,
    recordIdentity: binding.recordIdentity,
    qualificationSubjectHash: binding.qualificationSubjectHash,
    scenarioSetHash: binding.scenarioSetHash,
  };
  return input;
}

describe('character acceptance protocol', () => {
  it('derives optimization-ready only from fully reproducible facts', () => {
    const manifest = finalizeCharacterAcceptanceManifest(createManifestInput());

    expect(manifest.maturity).toMatchObject({
      currentState: 'optimization-ready',
      earnedStates: [
        'extracted',
        'runtime-integrated',
        'visually-accepted',
        'optimization-ready',
      ],
      optimizationReady: true,
      blockers: [],
    });
    expect(
      validateCharacterAcceptanceManifest(manifest, { checkPublication: false })
    ).toMatchObject({
      valid: true,
      issues: [],
    });
  });

  it('revokes optimizer eligibility when visual signoff, matrix, or ledger facts fail', () => {
    const pending = finalizeCharacterAcceptanceManifest(
      createManifestInput({ productVisualStatus: 'pending' })
    );
    const matrixGap = finalizeCharacterAcceptanceManifest(
      createManifestInput({ matrixStatus: 'blocked' })
    );
    const ledgerGap = finalizeCharacterAcceptanceManifest(
      createManifestInput({
        ledger: [
          {
            recordIdentity: 'synthetic-ledger-gap',
            status: 'static-evidence-gap',
            reason: 'synthetic-gap',
            sourceIdentities: ['synthetic-source'],
            blocking: true,
          },
        ],
      })
    );

    expect(pending.maturity.currentState).toBe('runtime-integrated');
    expect(matrixGap.maturity.currentState).toBe('visually-accepted');
    expect(ledgerGap.maturity.currentState).toBe('visually-accepted');
    expect(
      [pending, matrixGap, ledgerGap].every(
        manifest => manifest.maturity.optimizationReady === false
      )
    ).toBe(true);
  });

  it('does not claim extracted when the source profile gate fails', () => {
    const manifest = finalizeCharacterAcceptanceManifest(
      createManifestInput({ profileValid: false })
    );

    expect(manifest.maturity.currentState).toBeNull();
    expect(manifest.maturity.earnedStates).toEqual([]);
    expect(manifest.maturity.blockers).toContain(
      'acceptance-extraction-gate-failed'
    );
  });

  it('rejects hand-authored maturity and unnamed-passive leakage into the blocking ledger', () => {
    const manifest = finalizeCharacterAcceptanceManifest(createManifestInput());
    manifest.maturity.currentState = 'extracted';
    manifest.maturity.optimizationReady = false;
    const tampered = validateCharacterAcceptanceManifest(manifest, {
      checkPublication: false,
    });
    expect(tampered.valid).toBe(false);
    expect(tampered.issues).toContain(
      'character-acceptance-maturity-not-derived'
    );
    expect(tampered.issues).toContain(
      'character-acceptance-manifest-hash-mismatch'
    );

    const passiveLeak = finalizeCharacterAcceptanceManifest(
      createManifestInput({
        ledger: [
          {
            recordIdentity: 'unnamed-passive-leak',
            status: 'static-evidence-gap',
            reason: UNNAMED_SECONDARY_PASSIVE_REASON,
            sourceIdentities: ['actor:999001:skill:99900162'],
            blocking: true,
          },
        ],
      })
    );
    expect(passiveLeak.ledger.records).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: UNNAMED_SECONDARY_PASSIVE_REASON }),
      ])
    );
    expect(passiveLeak.notApplicableRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'not-applicable',
          reason: UNNAMED_SECONDARY_PASSIVE_REASON,
        }),
      ])
    );

    const pendingVisualInput = createManifestInput({
      productVisualStatus: 'pending',
    });
    pendingVisualInput.evidence.productVisualAcceptance.automatedEvidence = [];
    const pendingVisual =
      finalizeCharacterAcceptanceManifest(pendingVisualInput);
    expect(pendingVisual.validation.issues).toContain(
      'character-acceptance-visual-evidence-missing:synthetic-scenario'
    );
    expect(pendingVisual.validation.status).toBe(
      'character-acceptance-manifest-invalid'
    );
    expect(pendingVisual.maturity.optimizationReady).toBe(false);

    const pendingUnknownVisualInput = createManifestInput({
      productVisualStatus: 'pending',
    });
    pendingUnknownVisualInput.evidence.productVisualAcceptance.automatedEvidence =
      [
        {
          scenarioIdentity: 'unknown-scenario',
          status: 'automated-workbench-import-passed',
          screenshotPath: 'reports/unknown.png',
          screenshotSha256: 'a'.repeat(64),
        },
      ];
    const pendingUnknownVisual = finalizeCharacterAcceptanceManifest(
      pendingUnknownVisualInput
    );
    expect(pendingUnknownVisual.validation.issues).toEqual(
      expect.arrayContaining([
        'character-acceptance-visual-evidence-missing:synthetic-scenario',
        'character-acceptance-visual-evidence-scenario-unknown:unknown-scenario',
      ])
    );
    expect(pendingUnknownVisual.validation.status).toBe(
      'character-acceptance-manifest-invalid'
    );

    const acceptedVisualGapInput = createManifestInput();
    acceptedVisualGapInput.evidence.productVisualAcceptance.automatedEvidence =
      [];
    const acceptedVisualGap = finalizeCharacterAcceptanceManifest(
      acceptedVisualGapInput
    );
    expect(acceptedVisualGap.validation.issues).toContain(
      'character-acceptance-visual-evidence-missing:synthetic-scenario'
    );
  });

  it('keeps machine trace evidence structurally separate from visual screenshot evidence', () => {
    const traceOnlyInput = createManifestInput({
      productVisualStatus: 'pending',
    });
    traceOnlyInput.evidence.productVisualAcceptance.automatedEvidence = [
      {
        scenarioIdentity: 'synthetic-scenario',
        evidenceKind: 'machine-axis-trace',
        status: 'automated-machine-axis-passed',
        traceSha256: '0'.repeat(64),
      },
    ];
    const traceOnly = finalizeCharacterAcceptanceManifest(traceOnlyInput);
    expect(traceOnly.validation.issues).toEqual(
      expect.arrayContaining([
        'character-acceptance-visual-evidence-kind-invalid:synthetic-scenario',
        'character-acceptance-visual-evidence-status-invalid:synthetic-scenario',
        'character-acceptance-visual-evidence-path-missing:synthetic-scenario',
        'character-acceptance-visual-evidence-hash-invalid:synthetic-scenario',
        'character-acceptance-visual-evidence-trace-hash-forbidden:synthetic-scenario',
      ])
    );

    const machineOnlyInput = createManifestInput({
      productVisualStatus: 'pending',
    });
    machineOnlyInput.evidence.productVisualAcceptance.automatedEvidence = [];
    machineOnlyInput.evidence.machineEvidence = [
      {
        scenarioIdentity: 'synthetic-scenario',
        evidenceKind: 'machine-axis-trace',
        status: 'automated-machine-axis-passed',
        canonicalTraceHash: '0000000000000003',
        traceSha256: '0'.repeat(64),
      },
    ];
    const machineOnly = finalizeCharacterAcceptanceManifest(machineOnlyInput);
    expect(machineOnly.validation.issues).toContain(
      'character-acceptance-visual-evidence-missing:synthetic-scenario'
    );
    expect(
      machineOnly.validation.issues.some(issue =>
        issue.startsWith('character-acceptance-machine-evidence-')
      )
    ).toBe(false);
  });

  it('rejects N/A, empty-ledger, and fake-signoff qualification forged from a committed manifest', () => {
    const forgedInput = structuredClone(xiaoyuManifest);
    for (const requirement of forgedInput.matrix.requirements) {
      if (!requirement.required) continue;
      requirement.status = 'not-applicable';
      requirement.required = false;
      requirement.evidenceScenarioIds = [];
      requirement.reasons = ['forged-not-applicable'];
    }
    forgedInput.matrix.summary = {
      requirementCount: forgedInput.matrix.requirements.length,
      requiredCount: 0,
      passedCount: 0,
      blockedCount: 0,
      notApplicableCount: forgedInput.matrix.requirements.length,
      statusCounts: {
        'not-applicable': forgedInput.matrix.requirements.length,
      },
      dimensionCounts: {},
    };
    forgedInput.ledger = {
      records: [],
      summary: {
        recordCount: 0,
        statusCounts: {},
        reasonCounts: {},
      },
    };
    forgedInput.evidence.productVisualAcceptance = {
      ...forgedInput.evidence.productVisualAcceptance,
      status: 'accepted',
      acceptanceCommit: 'fake',
      recordIdentity: 'fake',
    };

    const forged = finalizeCharacterAcceptanceManifest(forgedInput);
    const validation = validateCharacterAcceptanceManifest(forged);

    expect(forged.maturity.optimizationReady).toBe(false);
    expect(validation.valid).toBe(false);
    expect(validation.issues).toEqual(
      expect.arrayContaining([
        'character-acceptance-derived-artifacts-mismatch',
        'character-acceptance-product-record-binding-invalid',
        'character-acceptance-publication-index-mismatch',
      ])
    );
    expect(() => assertCharacterOptimizationReady(forged)).toThrow(
      'character-acceptance-manifest-invalid'
    );
  });
});
