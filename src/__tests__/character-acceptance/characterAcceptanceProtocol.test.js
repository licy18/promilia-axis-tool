import {
  UNNAMED_SECONDARY_PASSIVE_REASON,
  finalizeCharacterAcceptanceManifest,
  validateCharacterAcceptanceManifest,
} from '../../character-acceptance/characterAcceptanceProtocol';

function createManifestInput({
  productVisualStatus = 'accepted',
  matrixStatus = 'passed',
  scenarioStatus = 'passed',
  stableReplay = true,
  workbenchRoundTrip = 'passed',
  ledger = [],
  profileValid = true,
} = {}) {
  return {
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
          scenarioIdentity: 'synthetic-scenario',
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
        status: productVisualStatus,
        scenarioIdentities: ['synthetic-scenario'],
        acceptanceCommit:
          productVisualStatus === 'accepted' ? 'synthetic-commit' : null,
        recordIdentity:
          productVisualStatus === 'accepted'
            ? 'synthetic-product-acceptance'
            : null,
        automatedEvidence: [
          {
            scenarioIdentity: 'synthetic-scenario',
            status: 'automated-workbench-import-passed',
            screenshotPath: 'reports/synthetic.png',
            screenshotSha256: '0'.repeat(64),
          },
        ],
      },
    },
    matrix: {
      requirements: [
        {
          requirementIdentity: 'synthetic:required',
          dimension: 'action-form',
          subjectIdentity: 'synthetic-form',
          required: true,
          status: matrixStatus,
          evidenceScenarioIds:
            matrixStatus === 'passed' ? ['synthetic-scenario'] : [],
          sourceIdentities: ['synthetic-source'],
          reasons:
            matrixStatus === 'passed' ? [] : ['synthetic-gap'],
        },
      ],
      summary: {},
    },
    coverage: {},
    ledger: { records: ledger, summary: {} },
    notApplicableRecords: [],
    maturity: {
      currentState: 'optimization-ready',
      earnedStates: ['optimization-ready'],
      optimizationReady: true,
    },
  };
}

describe('character acceptance protocol', () => {
  it('derives optimization-ready only from fully reproducible facts', () => {
    const manifest = finalizeCharacterAcceptanceManifest(
      createManifestInput()
    );

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
    expect(validateCharacterAcceptanceManifest(manifest)).toMatchObject({
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
    const manifest = finalizeCharacterAcceptanceManifest(
      createManifestInput()
    );
    manifest.maturity.currentState = 'extracted';
    manifest.maturity.optimizationReady = false;
    const tampered = validateCharacterAcceptanceManifest(manifest);
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
    expect(passiveLeak.validation.issues).toContain(
      'character-acceptance-unnamed-passive-must-be-not-applicable:unnamed-passive-leak'
    );

    const visualGapInput = createManifestInput();
    visualGapInput.evidence.productVisualAcceptance.automatedEvidence = [];
    const visualGap = finalizeCharacterAcceptanceManifest(visualGapInput);
    expect(visualGap.validation.issues).toContain(
      'character-acceptance-visual-evidence-missing:synthetic-scenario'
    );
  });
});
