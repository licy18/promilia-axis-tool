import xiaoyuManifest from '../../../reports/m11/character-acceptance/101010/manifest.json';
import rubyManifest from '../../../reports/m11/character-acceptance/103002/manifest.json';
import hanManifest from '../../../reports/m11/character-acceptance/101003/manifest.json';
import lilyManifest from '../../../reports/m11/character-acceptance/102001/manifest.json';
import sifliyaManifest from '../../../reports/m11/character-acceptance/107001/manifest.json';
import moyinManifest from '../../../reports/m11/character-acceptance/109001/manifest.json';
import mitiManifest from '../../../reports/m11/character-acceptance/108003/manifest.json';
import misaManifest from '../../../reports/m11/character-acceptance/107002/manifest.json';
import giseleManifest from '../../../reports/m11/character-acceptance/112001/manifest.json';
import femaleStarbornManifest from '../../../reports/m11/character-acceptance/199001/manifest.json';
import maleStarbornManifest from '../../../reports/m11/character-acceptance/199002/manifest.json';
import xiaoyuProfile from '../../data/generated/character-combat-profiles/101010.json';
import rubyProfile from '../../data/generated/character-combat-profiles/103002.json';
import hanProfile from '../../data/generated/character-combat-profiles/101003.json';
import lilyProfile from '../../data/generated/character-combat-profiles/102001.json';
import sifliyaProfile from '../../data/generated/character-combat-profiles/107001.json';
import moyinProfile from '../../data/generated/character-combat-profiles/109001.json';
import mitiProfile from '../../data/generated/character-combat-profiles/108003.json';
import misaProfile from '../../data/generated/character-combat-profiles/107002.json';
import giseleProfile from '../../data/generated/character-combat-profiles/112001.json';
import femaleStarbornProfile from '../../data/generated/character-combat-profiles/199001.json';
import maleStarbornProfile from '../../data/generated/character-combat-profiles/199002.json';
import generatedCatalog from '../../data/generated/character-acceptance-catalog.json';
import generatedManifestIndex from '../../data/generated/character-acceptance-manifest-index.json';
import { hashCanonicalValue } from '../../simulation/headless/canonicalSerialization';
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
  {
    ownerId: 101010,
    passiveId: 10101062,
    manifest: xiaoyuManifest,
    profile: xiaoyuProfile,
  },
  {
    ownerId: 103002,
    passiveId: 10300262,
    manifest: rubyManifest,
    profile: rubyProfile,
  },
  {
    ownerId: 101003,
    passiveId: 10100362,
    manifest: hanManifest,
    profile: hanProfile,
  },
  {
    ownerId: 102001,
    passiveId: 10200162,
    manifest: lilyManifest,
    profile: lilyProfile,
    unnamedSecondaryPassiveBoundary: false,
  },
  {
    ownerId: 107001,
    passiveId: 10700162,
    manifest: sifliyaManifest,
    profile: sifliyaProfile,
  },
  {
    ownerId: 108003,
    passiveId: 10800362,
    manifest: mitiManifest,
    profile: mitiProfile,
    unnamedSecondaryPassiveBoundary: false,
  },
  {
    ownerId: 107002,
    passiveId: 10700262,
    manifest: misaManifest,
    profile: misaProfile,
    unnamedSecondaryPassiveBoundary: false,
  },
  {
    ownerId: 109001,
    passiveId: 10900162,
    manifest: moyinManifest,
    profile: moyinProfile,
  },
  {
    ownerId: 112001,
    passiveId: 11200162,
    manifest: giseleManifest,
    profile: giseleProfile,
    unnamedSecondaryPassiveBoundary: false,
  },
  {
    ownerId: 199001,
    passiveId: 19900162,
    manifest: femaleStarbornManifest,
    profile: femaleStarbornProfile,
  },
  {
    ownerId: 199002,
    passiveId: 19900262,
    manifest: maleStarbornManifest,
    profile: maleStarbornProfile,
  },
];

describe('generated character acceptance manifests', () => {
  it('publishes every source owner while preserving the nine-object formal denominator', () => {
    expect(generatedCatalog.entries.map(entry => entry.ownerId)).toEqual([
      101003, 101010, 102001, 103002, 107001, 107002, 108003, 109001,
      112001, 199001, 199002,
    ]);
    expect(generatedCatalog.summary).toMatchObject({
      ownerCount: 11,
      formalCharacterDenominator: 9,
      productScenarioExcludedCharacterCount: 2,
      maturityCounts: {
        'runtime-integrated': 1,
        'optimization-ready': 9,
      },
      optimizationReadyCount: 9,
    });
    expect(generatedCatalog.manifestIndexHash).toBe(
      generatedManifestIndex.indexHash
    );
    expect(generatedManifestIndex.entries.map(entry => entry.ownerId)).toEqual([
      101003, 101010, 102001, 103002, 107001, 107002, 108003, 109001,
      112001, 199001, 199002,
    ]);
    for (const entry of generatedCatalog.entries) {
      const indexed = generatedManifestIndex.entries.find(
        candidate => candidate.ownerId === entry.ownerId
      );
      expect(indexed).toMatchObject({
        manifestHash: entry.manifestHash,
        qualificationSubjectHash: entry.qualificationSubjectHash,
        sourceOfTruthHash: entry.sourceOfTruthHash,
        profileHash: entry.profileHash,
        catalogEntryHash: hashCanonicalValue(entry),
      });
    }
    expect(validateCharacterAcceptanceCatalog(generatedCatalog)).toEqual({
      valid: true,
      issues: [],
    });
    expect(WORKBENCH_HEADLESS_COMBAT_CORE.acceptanceCatalog()).toEqual(
      generatedCatalog
    );
    expect(WORKBENCH_HEADLESS_COMBAT_CORE.acceptanceFor(101010)).toMatchObject({
      ownerId: 101010,
      maturityState: 'optimization-ready',
      optimizationReady: true,
    });
    expect(() =>
      WORKBENCH_HEADLESS_COMBAT_CORE.assertOptimizationReady(101010)
    ).not.toThrow();
    expect(WORKBENCH_HEADLESS_COMBAT_CORE.acceptanceFor(101003)).toMatchObject({
      ownerId: 101003,
      maturityState: 'runtime-integrated',
      optimizationReady: false,
    });
    expect(() =>
      WORKBENCH_HEADLESS_COMBAT_CORE.assertOptimizationReady(101003)
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

    const rehashedForgery = structuredClone(generatedCatalog);
    rehashedForgery.entries[0].optimizationReady = true;
    rehashedForgery.entries[0].maturityState = 'optimization-ready';
    rehashedForgery.entries[0].earnedStates = [
      'extracted',
      'runtime-integrated',
      'visually-accepted',
      'optimization-ready',
    ];
    rehashedForgery.entries[0].blockers = [];
    delete rehashedForgery.catalogHash;
    rehashedForgery.catalogHash = hashCanonicalValue(rehashedForgery);
    expect(validateCharacterAcceptanceCatalog(rehashedForgery)).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        'character-acceptance-catalog-manifest-index-mismatch:101003',
      ]),
    });
  });

  it.each(owners)(
    'derives $ownerId from the current product acceptance record',
    ({ ownerId, manifest, profile, automatedEvidenceExpected = true }) => {
      expect(validateCharacterAcceptanceManifest(manifest)).toMatchObject({
        valid: true,
        issues: [],
      });
      const productAccepted = [
        101010, 102001, 103002, 107001, 107002, 108003, 109001, 199001,
        199002,
      ].includes(ownerId);
      const functionallyComplete =
        manifest.matrix.summary.blockedCount === 0 &&
        manifest.ledger.summary.uniqueBlockingCount === 0;
      const acceptanceCommit = productAccepted
        ? ({
            101010: 'd2ba1bb2e834cfca1c91ebce557819894cbc0b1b',
            103002: '2a0be63030616ad887df683e6d2e8b7fa22c8aad',
            107002: '5ee914e2f5134d280f2a5da0ea6a28604242957c',
            199001: 'c86046c4f32a2c20e6d3128fe37d3e7ca771f2ee',
            199002: 'c86046c4f32a2c20e6d3128fe37d3e7ca771f2ee',
          })[ownerId] ?? 'eb06acc456ee309245a78455e7691738a2ee808b'
        : null;
      const runtimeIntegrated = ownerId !== 112001;
      expect(manifest.maturity).toMatchObject({
        currentState: productAccepted
          ? 'optimization-ready'
          : runtimeIntegrated
            ? 'runtime-integrated'
            : 'extracted',
        optimizationReady: productAccepted,
        gates: {
          extracted: true,
          runtimeIntegrated,
          visuallyAccepted: productAccepted,
          optimizationReady: productAccepted,
        },
      });
      expect(manifest.evidence.productVisualAcceptance).toMatchObject(
        productAccepted
          ? {
              status: 'accepted',
              acceptanceCommit,
              bindingStatus: 'verified',
            }
          : {
              status: 'pending',
              acceptanceCommit: null,
              bindingStatus: 'not-requested',
            }
      );
      if (automatedEvidenceExpected) {
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
      } else {
        expect(
          manifest.evidence.productVisualAcceptance.automatedEvidence
        ).toEqual([]);
        expect(profile.optimizationObject).toMatchObject({
          optimizationObjectId: 'STARBORN',
          sourceCharacterId: ownerId,
          status: 'verified-optimization-object-source-alias-ready',
          applied: true,
        });
      }
      if (productAccepted) {
        expect(manifest.maturity.blockers).toEqual([]);
      } else if (functionallyComplete) {
        expect(manifest.maturity.blockers).toEqual(
          runtimeIntegrated
            ? ['acceptance-product-visual-signoff-pending']
            : [
                'acceptance-headless-replay-gate-failed',
                'acceptance-functional-failure-present',
                'acceptance-product-visual-signoff-pending',
              ]
        );
      } else {
        expect(manifest.maturity.blockers).toEqual(
          expect.arrayContaining([
            'acceptance-required-matrix-incomplete',
            'acceptance-blocking-ledger-not-empty',
          ])
        );
      }
      if (productAccepted) {
        expect(() => assertCharacterIsOptimizationReady(ownerId)).not.toThrow();
      } else {
        expect(manifest.maturity.blockers).toContain(
          'acceptance-product-visual-signoff-pending'
        );
        expect(() => assertCharacterIsOptimizationReady(ownerId)).toThrow(
          'character-not-optimization-ready'
        );
      }
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
    'links every passed requirement for $ownerId to a replayed scenario assertion',
    ({ manifest }) => {
      const scenarioById = new Map(
        manifest.scenarioCases.records.map(scenario => [
          scenario.scenarioIdentity,
          scenario,
        ])
      );
      const edgeById = new Map(
        manifest.coverage.edges.map(edge => [edge.edgeIdentity, edge])
      );
      for (const requirement of manifest.matrix.requirements) {
        if (requirement.status !== 'passed') continue;
        expect(requirement.coverageEdgeIds.length).toBeGreaterThan(0);
        for (const edgeIdentity of requirement.coverageEdgeIds) {
          const edge = edgeById.get(edgeIdentity);
          expect(edge).toMatchObject({
            requirementIdentity: requirement.requirementIdentity,
            status: 'verified',
          });
          const scenario = scenarioById.get(edge.scenarioIdentity);
          expect(scenario.execution.status).toBe('passed');
          expect(
            scenario.assertions.find(
              assertion =>
                assertion.assertionIdentity === edge.assertionIdentity
            )
          ).toMatchObject({ status: 'passed' });
        }
      }
    }
  );

  it.each(owners)(
    'keeps source and acceptance gaps unique and wrappers non-blocking for $ownerId',
    ({ manifest }) => {
      const blockingIds = manifest.ledger.records.map(
        record => record.uniqueGapIdentity
      );
      expect(new Set(blockingIds).size).toBe(blockingIds.length);
      expect(manifest.ledger.summary.uniqueBlockingCount).toBe(
        blockingIds.length
      );
      expect(
        manifest.ledger.sourceGaps.some(sourceGap =>
          manifest.ledger.acceptanceGaps.some(
            acceptanceGap =>
              acceptanceGap.uniqueGapIdentity === sourceGap.uniqueGapIdentity
          )
        )
      ).toBe(false);
      const wrappers = manifest.sourceGapInventory.records.filter(record =>
        record.reason.includes('semantic-wrapper-not-gameplay-effect')
      );
      expect(wrappers.every(record => record.blocking === false)).toBe(true);
      expect(
        manifest.ledger.records.some(record =>
          record.reason.includes('semantic-wrapper-not-gameplay-effect')
        )
      ).toBe(false);
    }
  );
  it('attributes an M10-only Xiaoyu form only to the golden scenario that executed it', () => {
    const requirement = xiaoyuManifest.matrix.requirements.find(
      row =>
        row.subjectIdentity ===
        'actor:101010:charged-attack:xiaoyu-enhanced-special-charged'
    );

    expect(requirement).toMatchObject({
      status: 'passed',
      evidenceScenarioIds: ['m10-a:101010:120s-three-actor-golden'],
    });
    expect(requirement.evidenceScenarioIds).not.toContain(
      'm11-d-101010-visual-acceptance'
    );
  });

  it.each(
    owners.filter(owner => owner.unnamedSecondaryPassiveBoundary !== false)
  )(
    'keeps unnamed secondary passive $passiveId auditable but non-blocking',
    ({ passiveId, manifest, implemented = false }) => {
      const passiveToken = String(passiveId);
      const records = manifest.notApplicableRecords.filter(
        record =>
          record.reason === UNNAMED_SECONDARY_PASSIVE_REASON &&
          record.sourceIdentities.some(identity =>
            identity.includes(passiveToken)
          )
      );
      const leaked = manifest.ledger.records.filter(record =>
        record.sourceIdentities.some(identity =>
          identity.includes(passiveToken)
        )
      );
      const sourceBoundary = manifest.sourceGapInventory.records.filter(
        record =>
          record.reason === UNNAMED_SECONDARY_PASSIVE_REASON &&
          record.sourceIdentities.some(identity =>
            identity.includes(passiveToken)
          )
      );
      if (implemented) {
        expect(records).toHaveLength(0);
        expect(sourceBoundary).toHaveLength(0);
        expect(leaked.length).toBeGreaterThan(0);
        expect(
          leaked.every(
            record => record.reason === 'acceptance-scenario-coverage-missing'
          )
        ).toBe(true);
        return;
      }
      expect(records).toHaveLength(1);
      expect(leaked).toHaveLength(0);
      expect(sourceBoundary).toEqual([
        expect.objectContaining({
          status: 'not-applicable',
          impactClassification: 'not-applicable',
          blocking: false,
        }),
      ]);
    }
  );
});
