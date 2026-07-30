import xiaoyuManifest from '../../../reports/m11/character-acceptance/101010/manifest.json';
import rubyManifest from '../../../reports/m11/character-acceptance/103002/manifest.json';
import hanManifest from '../../../reports/m11/character-acceptance/101003/manifest.json';
import xiaoyuProfile from '../../data/generated/character-combat-profiles/101010.json';
import rubyProfile from '../../data/generated/character-combat-profiles/103002.json';
import hanProfile from '../../data/generated/character-combat-profiles/101003.json';
import generatedCatalog from '../../data/generated/character-acceptance-catalog.json';
import { WORKBENCH_HEADLESS_COMBAT_CORE } from '../../features/workbench/workbenchHeadlessCombatCore';
import {
  assertCharacterIsOptimizationReady,
  validateCharacterAcceptanceCatalog,
} from '../../character-acceptance/characterAcceptanceCatalog';
import {
  UNNAMED_SECONDARY_PASSIVE_REASON,
  validateCharacterAcceptanceManifest,
} from '../../character-acceptance/characterAcceptanceProtocol';

const owners = [
  { ownerId: 101010, passiveId: 10101062, manifest: xiaoyuManifest, profile: xiaoyuProfile },
  { ownerId: 103002, passiveId: 10300262, manifest: rubyManifest, profile: rubyProfile },
  { ownerId: 101003, passiveId: 10100362, manifest: hanManifest, profile: hanProfile },
];

describe('generated character acceptance manifests', () => {
  it('publishes exactly the three M11-D owners with a valid hashed catalog', () => {
    expect(generatedCatalog.entries.map(entry => entry.ownerId)).toEqual([
      101003,
      101010,
      103002,
    ]);
    expect(generatedCatalog.summary).toMatchObject({
      ownerCount: 3,
      maturityCounts: { 'runtime-integrated': 3 },
      optimizationReadyCount: 0,
    });
    expect(validateCharacterAcceptanceCatalog(generatedCatalog)).toEqual({
      valid: true,
      issues: [],
    });
    expect(WORKBENCH_HEADLESS_COMBAT_CORE.acceptanceCatalog()).toEqual(
      generatedCatalog
    );
    expect(
      WORKBENCH_HEADLESS_COMBAT_CORE.acceptanceFor(101010)
    ).toMatchObject({
      ownerId: 101010,
      maturityState: 'runtime-integrated',
      optimizationReady: false,
    });
    expect(() =>
      WORKBENCH_HEADLESS_COMBAT_CORE.assertOptimizationReady(101010)
    ).toThrow('character-not-optimization-ready');

    const tampered = structuredClone(generatedCatalog);
    tampered.entries[0].optimizationReady = true;
    expect(validateCharacterAcceptanceCatalog(tampered)).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        'character-acceptance-catalog-ready-state-invalid:101003',
        'character-acceptance-catalog-hash-mismatch',
      ]),
    });
  });

  it.each(owners)(
    'derives $ownerId as runtime-integrated and keeps it outside the optimizer',
    ({ ownerId, manifest }) => {
      expect(validateCharacterAcceptanceManifest(manifest)).toMatchObject({
        valid: true,
        issues: [],
      });
      expect(manifest.maturity).toMatchObject({
        currentState: 'runtime-integrated',
        optimizationReady: false,
        gates: {
          extracted: true,
          runtimeIntegrated: true,
          visuallyAccepted: false,
          optimizationReady: false,
        },
      });
      expect(
        manifest.evidence.productVisualAcceptance.automatedEvidence
      ).toEqual([
        expect.objectContaining({
          scenarioIdentity:
            manifest.evidence.machineScenarios[0].scenarioIdentity,
          status: 'automated-workbench-import-passed',
          screenshotSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        }),
      ]);
      expect(manifest.maturity.blockers).toEqual(
        expect.arrayContaining([
          'acceptance-product-visual-signoff-pending',
          'acceptance-required-matrix-incomplete',
          'acceptance-blocking-ledger-not-empty',
        ])
      );
      expect(() => assertCharacterIsOptimizationReady(ownerId)).toThrow(
        'character-not-optimization-ready'
      );
    }
  );

  it.each(owners)(
    'covers every indexed action form for $ownerId exactly once',
    ({ manifest, profile }) => {
      const expected = profile.contracts.actionForms
        .map(form => form.formIdentity)
        .sort();
      const actual = manifest.matrix.requirements
        .filter(requirement => requirement.dimension === 'action-form')
        .map(requirement => requirement.subjectIdentity)
        .sort();
      expect(actual).toEqual(expected);
      expect(new Set(actual).size).toBe(actual.length);
    }
  );

  it.each(owners)(
    'keeps unnamed secondary passive $passiveId auditable but non-blocking',
    ({ passiveId, manifest }) => {
      const passiveToken = String(passiveId);
      const records = manifest.notApplicableRecords.filter(
        record =>
          record.reason === UNNAMED_SECONDARY_PASSIVE_REASON &&
          record.sourceIdentities.some(identity => identity.includes(passiveToken))
      );
      const leaked = manifest.ledger.records.filter(record =>
        record.sourceIdentities.some(identity => identity.includes(passiveToken))
      );
      expect(records).toHaveLength(1);
      expect(leaked).toHaveLength(0);
      expect(manifest.coverage.unnamedSecondaryPassive).toMatchObject({
        reason: UNNAMED_SECONDARY_PASSIVE_REASON,
        recordCount: 1,
      });
    }
  );
});
