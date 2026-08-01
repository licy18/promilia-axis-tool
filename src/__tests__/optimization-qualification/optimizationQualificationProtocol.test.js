import path from 'node:path';
import { fileURLToPath } from 'node:url';

import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import qualificationCatalog from '../../data/generated/optimization-qualification-catalog.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';
import { createWorkbenchMachineAxisAdapter } from '../../machine-axis/workbenchMachineAxisAdapter';
import {
  resolveOptimizationCultivationProfile,
  validateOptimizationCultivationProfile,
  validateOptimizationQualificationCatalog,
} from '../../optimization-qualification/optimizationQualificationProtocol';
import { createOptimizationQualificationArtifacts } from '../../../scripts/optimization-qualification/optimization-qualification-generation.mjs';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
);

function createCultivationProfile({ bondLevel = 1, actorLevel = 80 } = {}) {
  return {
    schemaVersion: 1,
    contractName: 'AzPrOptimizationCultivationProfile',
    profileId: 'm12-b3-strict-profile-test',
    actors: ['slot-1', 'slot-2', 'slot-3'].map(slotId => ({
      slotId,
      character: {
        level: actorLevel,
        starGiftRank: 7,
        starGiftNodeIds: [1, 2, 3, 4],
        ascensionRank: 6,
      },
      kibo: {
        level: 80,
        talents: [1, 3, 4, 5].map(attributeId => ({
          attributeId,
          level: 10,
        })),
        dnaFactors: [],
        bondLevel,
      },
      soulEssence: { level: 80, rank: 6, star: 1 },
      equipment: Object.fromEntries(
        ['weapon', 'top', 'bottom', 'earring', 'ring'].map(equipmentSlot => [
          equipmentSlot,
          {
            rarity: 4,
            enhancementLevel: 9,
            tuningScore: 110,
            instanceTier: 'starborn',
          },
        ])
      ),
    })),
  };
}

function createAxis({ profile = createCultivationProfile(), mode = 'research' } = {}) {
  const equipment = qualificationCatalog.cultivation.equipment.equipmentIdsBySlot;
  return {
    schemaVersion: 1,
    contractName: 'AzPrMachineAxis',
    dataIdentity: {
      verifiedMechanicsPackageId: mechanicsPackage.packageId,
      verifiedMechanicsPackageHash: mechanicsPackage.packageHash,
      mechanicsProfileId: 'azpr-three-value-verified-tc-20260718',
      mechanicsProfileVersion: 1,
    },
    scenario: {
      id: 'm12-b3-qualification-test',
      name: 'M12 B3 Qualification Test',
      fps: 60,
      durationFrames: 600,
      team: [101010, 103002, 102001].map((characterId, index) => ({
        slotId: `slot-${index + 1}`,
        characterId,
        level: 80,
        initialSp: 0,
        loadout: {
          kiboId: 500001,
          soulessenceId: 10001,
          equipment: Object.fromEntries(
            ['weapon', 'top', 'bottom', 'earring', 'ring'].map(slot => [
              slot,
              equipment[slot][0],
            ])
          ),
        },
      })),
      enemy: { enemyId: 300032 },
      initialRuntimeState: {},
      projectile: { targetDistance: 0, defaultWillHit: true },
      critical: { policy: 'expected', seed: null },
      optimizationQualification: {
        mode,
        catalogHash: qualificationCatalog.catalogHash,
      },
      cultivationProfile: profile,
    },
    actions: [],
  };
}

describe('M12-B3 optimization qualification generation', () => {
  it(
    'recomputes the frozen 11/43/62/137/12 roster and honest blockers',
    async () => {
      const artifacts = await createOptimizationQualificationArtifacts({
        projectRoot,
      });

      expect(artifacts.summary.denominators).toEqual({
        characterOptimizationObjects: 11,
        sourceCharacterAliases: 12,
        kibos: 43,
        soulEssences: 62,
        equipment: 137,
        setSkills: 12,
      });
      expect(artifacts.roster.starborn).toMatchObject({
        sourceCharacterIds: [199001, 199002],
        aliasHashesEqual: true,
      });
      expect(artifacts.catalog.admission).toEqual({
        characters: [],
        kibos: [],
        soulEssences: [],
        equipment: [],
        setSkills: [],
      });
      expect(
        artifacts.gaps.records.filter(
          record =>
            record.code === 'soulessence-effect-skill-dynamic-unapplied'
        )
      ).toHaveLength(62);
      expect(
        artifacts.gaps.records.filter(
          record => record.code === 'set-skill-dynamic-unapplied'
        )
      ).toHaveLength(12);
      expect(
        artifacts.gaps.records.filter(
          record => record.code === 'kibo-passive-static-evidence-gap'
        )
      ).toHaveLength(4);
      expect(artifacts.catalog.cultivation.equipment.tuningFormula).toEqual({
        status: 'source-indexed-runtime-application-incomplete',
        parameters: [8500, 6000, 125, 200000],
        expression:
          'ceil(base*0.85)+ceil(base*0.6*0.0125*(tuningScore-20))',
        sourceIdentity:
          'NewTable/game.rows[title=EQUIPMENT_SCORE_FORMULA_PARAM]',
      });
      expect(artifacts.gaps.implementedCapabilities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            capabilityIdentity: 'b3-equipment-tuning-formula-source-index',
            status: 'implemented',
          }),
          expect.objectContaining({
            capabilityIdentity: 'b3-formal-catalog-hard-rejection',
            status: 'implemented',
          }),
        ])
      );
    },
    30_000
  );

  it('rejects catalog tampering even when an admission row is manually added', () => {
    const tampered = structuredClone(qualificationCatalog);
    tampered.records.find(record => record.objectKind === 'character').optimizationReady =
      true;
    tampered.admission.characters.push(
      tampered.records.find(record => record.objectKind === 'character').objectId
    );

    expect(validateOptimizationQualificationCatalog(tampered)).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.stringMatching(/ready-record-invalid|catalog-hash-mismatch/),
      ]),
    });
  });
});

describe('M12-B3 strict cultivation profile', () => {
  beforeEach(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
  });

  it('resolves level 10 Kibo talents to 120 and bond level 1 to 9 percent', () => {
    const profile = createCultivationProfile();
    const result = resolveOptimizationCultivationProfile(profile, {
      team: createAxis({ profile }).scenario.team,
    });

    expect(result.valid).toBe(true);
    expect(result.profile.actors[0].kibo.talents).toEqual(
      [1, 3, 4, 5].map(attributeId =>
        expect.objectContaining({ attributeId, level: 10, value: 120 })
      )
    );
    expect(result.profile.actors[0].kibo).toMatchObject({
      bondLevel: 1,
      inheritanceBasisPoints: 900,
      inheritanceRatio: 0.09,
    });
  });

  it('rejects bond level zero instead of treating it as an initial default', () => {
    const profile = createCultivationProfile({ bondLevel: 0 });
    const result = validateOptimizationCultivationProfile(profile, {
      team: createAxis({ profile: createCultivationProfile() }).scenario.team,
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'machine-axis-cultivation-kibo-bond-level-invalid',
        }),
      ])
    );
  });

  it('puts raw and resolved cultivation into the canonical input hash', () => {
    const service = createMachineAxisService();
    const first = service.compile(createAxis({
      profile: createCultivationProfile({ actorLevel: 80 }),
    }));
    const second = service.compile(createAxis({
      profile: createCultivationProfile({ actorLevel: 79 }),
    }));

    expect(first.project.optimizationCultivationProfile).toMatchObject({
      contractName: 'AzPrOptimizationCultivationProfile',
      actors: expect.any(Array),
    });
    expect(first.hashes.input).not.toBe(second.hashes.input);
  });

  it('round-trips the strict profile through the Workbench adapter without drift', () => {
    const service = createMachineAxisService();
    const adapter = createWorkbenchMachineAxisAdapter({ service });
    const axis = createAxis();
    const imported = adapter.importContract(axis);
    const exported = adapter.exportProject(imported.project);
    const replay = service.simulate(exported);

    expect(exported.scenario.cultivationProfile).toEqual(
      axis.scenario.cultivationProfile
    );
    expect(exported.scenario.optimizationQualification).toEqual(
      axis.scenario.optimizationQualification
    );
    expect(replay.hashes).toEqual(imported.canonicalRun.hashes);
  });

  it('hard rejects every currently unqualified object in formal mode', () => {
    const service = createMachineAxisService();
    const prepared = service.prepare(createAxis({ mode: 'formal' }));

    expect(prepared.valid).toBe(false);
    expect(prepared.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'machine-axis-optimization-object-not-qualified',
          objectKind: 'character',
          objectId: '101010',
        }),
        expect.objectContaining({
          code: 'machine-axis-optimization-object-not-qualified',
          objectKind: 'kibo',
          objectId: '500001',
        }),
      ])
    );
    expect(prepared.project).toBeNull();
  });

  it('keeps duplicate Kibo species legal across different actor slots', () => {
    const service = createMachineAxisService();
    const prepared = service.prepare(createAxis({ mode: 'research' }));

    expect(prepared.valid).toBe(true);
    expect(
      prepared.issues.some(issue => issue.code.includes('kibo-duplicate'))
    ).toBe(false);
    expect(
      service.catalog().optimizationQualification.summary.m12cLocked
    ).toBe(true);
  });
});
