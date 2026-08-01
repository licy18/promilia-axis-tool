import path from 'node:path';
import { fileURLToPath } from 'node:url';

import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import equipmentCatalog from '../../data/generated/equipment.json';
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
const TEST_CHARACTER_IDS = Object.freeze([101010, 103002, 102001]);

function createCultivationProfile({
  bondLevel = 1,
  actorLevel = 80,
  starGiftRank = 7,
  ascensionRank = 6,
  dnaFactors = [],
  soulEssenceLevel = 80,
  soulEssenceRank = 6,
  soulEssenceStar = 1,
  enhancementLevel = 9,
  tuningScore = 110,
  selectedStarGiftNodeIdsByCharacterId = {},
} = {}) {
  return {
    schemaVersion: 1,
    contractName: 'AzPrOptimizationCultivationProfile',
    profileId: 'm12-b3-strict-profile-test',
    actors: ['slot-1', 'slot-2', 'slot-3'].map((slotId, index) => {
      const characterId = TEST_CHARACTER_IDS[index];
      const sourceProfile = qualificationCatalog.cultivation.character.profiles.find(
        entry => Number(entry.characterId) === characterId
      );
      const sourceRank = sourceProfile?.starGiftRanks.find(
        entry => Number(entry.rank) === Number(starGiftRank)
      );
      const selectedNodeIds =
        selectedStarGiftNodeIdsByCharacterId[characterId] ??
        (sourceRank?.nodes ?? []).map(node => Number(node.runeId));
      return {
        slotId,
        character: {
          level: actorLevel,
          starGiftRank,
          starGiftNodeIds: selectedNodeIds,
          ascensionRank,
        },
      kibo: {
        level: 80,
        talents: [1, 3, 4, 5].map(attributeId => ({
          attributeId,
          level: 10,
        })),
        dnaFactors: structuredClone(dnaFactors),
        bondLevel,
      },
      soulEssence: {
        level: soulEssenceLevel,
        rank: soulEssenceRank,
        star: soulEssenceStar,
      },
      equipment: Object.fromEntries(
        ['weapon', 'top', 'bottom', 'earring', 'ring'].map(equipmentSlot => [
          equipmentSlot,
          {
            rarity: 4,
            enhancementLevel,
            tuningScore,
            instanceTier: 'starborn',
          },
        ])
      ),
      };
    }),
  };
}

function createAxis({ profile = createCultivationProfile(), mode = 'research' } = {}) {
  const equipmentRecords = equipmentCatalog.items.filter(
    record => record.rarity === '4星'
  );
  const equipmentTypeBySlot = {
    weapon: '武器',
    top: '上装',
    bottom: '下装',
    earring: '耳环',
    ring: '戒指',
  };
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
      team: TEST_CHARACTER_IDS.map((characterId, index) => ({
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
              Number(
                equipmentRecords.find(
                  record => record.type === equipmentTypeBySlot[slot]
                ).id
              ),
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
        status: 'source-indexed-static-runtime-applied',
        parameters: [8500, 6000, 125, 200000],
        expression:
          'ceil(base*0.85)+ceil(base*0.6*0.0125*(tuningScore-20))',
        sourceIdentity:
          'NewTable/game.rows[title=EQUIPMENT_SCORE_FORMULA_PARAM]',
      });
      expect(artifacts.catalog.cultivation.kibo.dnaFactors).toEqual({
        status: 'not-applicable',
        reason: 'kibo-dna-out-of-scope-current-version',
        normalizedValue: [],
        acceptedInput: 'empty-only',
        nonEmptyInputCode:
          'machine-axis-cultivation-kibo-dna-unsupported-in-current-version',
      });
      expect(artifacts.roster.productScope.kiboDna).toEqual({
        status: 'not-applicable',
        reason: 'kibo-dna-out-of-scope-current-version',
        canonicalValue: [],
      });
      expect(
        artifacts.manifests.records.flatMap(record => record.blockers)
      ).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: expect.stringContaining('dna') }),
        ])
      );
      expect(
        artifacts.gaps.records.some(record =>
          String(record.code).includes('dna')
        )
      ).toBe(false);
      expect(artifacts.catalog.cultivation.soulEssence).toMatchObject({
        star: { minimum: 1, maximum: 4 },
        profiles: expect.arrayContaining([
          expect.objectContaining({
            soulEssenceId: 10001,
            effectSkill: expect.objectContaining({
              skillId: 1900480,
              starLevels: [
                expect.objectContaining({ star: 1, skillLevel: 1 }),
                expect.objectContaining({ star: 2, skillLevel: 2 }),
                expect.objectContaining({ star: 3, skillLevel: 3 }),
                expect.objectContaining({ star: 4, skillLevel: 4 }),
              ],
            }),
          }),
        ]),
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

  it('rejects cultivation rarity that does not match the selected equipment source', () => {
    const profile = createCultivationProfile();
    profile.actors[0].equipment.weapon.rarity = 3;
    const result = validateOptimizationCultivationProfile(profile, {
      team: createAxis({ profile: createCultivationProfile() }).scenario.team,
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'machine-axis-cultivation-equipment-rarity-mismatch',
          path: 'scenario.cultivationProfile.actors.0.equipment.weapon.rarity',
        }),
      ])
    );
  });

  it('normalizes omitted Kibo DNA to an explicit empty canonical value', () => {
    const service = createMachineAxisService();
    const explicit = createAxis();
    const omitted = structuredClone(explicit);
    omitted.scenario.cultivationProfile.actors.forEach(actor => {
      delete actor.kibo.dnaFactors;
    });

    const explicitRun = service.compile(explicit);
    const omittedRun = service.compile(omitted);

    expect(
      omittedRun.contract.scenario.cultivationProfile.actors.map(
        actor => actor.kibo.dnaFactors
      )
    ).toEqual([[], [], []]);
    expect(
      omittedRun.project.optimizationCultivationProfile.actors.map(
        actor => actor.kibo.dnaFactors
      )
    ).toEqual([[], [], []]);
    expect(omittedRun.hashes.input).toBe(explicitRun.hashes.input);
  });

  it('rejects non-empty Kibo DNA before validate, compile, and search execution', async () => {
    const service = createMachineAxisService();
    const profile = createCultivationProfile({
      dnaFactors: [{ factorId: 531001, rank: 3 }],
    });
    const axis = createAxis({ profile });
    const expectedIssue = expect.objectContaining({
      code: 'machine-axis-cultivation-kibo-dna-unsupported-in-current-version',
      path: 'scenario.cultivationProfile.actors.0.kibo.dnaFactors',
      status: 'unsupported-in-current-version',
    });

    expect(
      validateOptimizationCultivationProfile(profile, {
        team: axis.scenario.team,
      }).issues
    ).toEqual(expect.arrayContaining([expectedIssue]));
    expect(service.validate(axis).issues).toEqual(
      expect.arrayContaining([expectedIssue])
    );

    let compileError = null;
    try {
      service.compile(axis);
    } catch (error) {
      compileError = error;
    }
    expect(compileError?.issues).toEqual(expect.arrayContaining([expectedIssue]));
    await expect(service.search({ contract: axis })).rejects.toMatchObject({
      issues: expect.arrayContaining([expectedIssue]),
    });
  });

  it('rejects soul-essence star five and level beyond the selected rank limit', () => {
    const invalidStar = createCultivationProfile({ soulEssenceStar: 5 });
    const invalidRankLevel = createCultivationProfile({
      soulEssenceLevel: 80,
      soulEssenceRank: 1,
    });
    const team = createAxis({ profile: createCultivationProfile() }).scenario.team;

    expect(
      validateOptimizationCultivationProfile(invalidStar, { team }).issues
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'machine-axis-cultivation-soulessence-star-invalid',
        }),
      ])
    );
    expect(
      validateOptimizationCultivationProfile(invalidRankLevel, { team }).issues
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'machine-axis-cultivation-soulessence-level-exceeds-rank-limit',
          maximumLevel: 30,
          actualLevel: 80,
        }),
      ])
    );
  });

  it('rejects soul-essence star five at the public Machine Axis schema boundary', () => {
    const prepared = createMachineAxisService().prepare(
      createAxis({
        profile: createCultivationProfile({ soulEssenceStar: 5 }),
      })
    );

    expect(prepared.valid).toBe(false);
    expect(prepared.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'machine-axis-schema-maximum',
          path: 'scenario.cultivationProfile.actors.0.soulEssence.star',
          maximum: 4,
          actual: 5,
        }),
      ])
    );
  });

  it('rejects a star-gift node that does not belong to the selected character rank', () => {
    const profile = createCultivationProfile();
    profile.actors[0].character.starGiftNodeIds = [999999];
    const result = validateOptimizationCultivationProfile(profile, {
      team: createAxis({ profile: createCultivationProfile() }).scenario.team,
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'machine-axis-cultivation-star-gift-node-not-in-selected-rank',
          path:
            'scenario.cultivationProfile.actors.0.character.starGiftNodeIds.0',
          characterId: 101010,
          starGiftRank: 7,
          runeId: 999999,
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

  it('keeps empty DNA explicit while resolving the soul-essence star skill level', () => {
    const profile = createCultivationProfile({
      soulEssenceStar: 4,
    });
    const result = resolveOptimizationCultivationProfile(profile, {
      team: createAxis({ profile }).scenario.team,
    });

    expect(result.valid).toBe(true);
    expect(result.profile.actors[0].kibo.dnaFactors).toEqual([]);
    expect(result.profile.actors[0].soulEssence.effectSkill).toMatchObject({
      skillId: 1900480,
      star: 4,
      skillLevel: 4,
    });
    const compilation = createMachineAxisService().compile(createAxis({ profile }));
    expect(
      compilation.project.metadata.actorConfigs[0]
        .optimizationCultivationApplication.unresolvedDimensions
    ).not.toContain('kibo.dnaFactorRuntime');
  });

  it('projects the supported cultivation dimensions into the authoritative static compiler', () => {
    const service = createMachineAxisService();
    const compilation = service.compile(createAxis());
    const actorConfig = compilation.project.metadata.actorConfigs[0];
    const actor = compilation.canonicalCompilation.scenario.actors.find(
      entry => entry.characterId === 101010
    );

    expect(actorConfig).toMatchObject({
      level: 80,
      cultivation: {
        starGiftRank: 7,
      },
      loadout: {
        soulessenceLevel: 80,
        soulessenceRank: 6,
        equipmentLevels: {
          weapon: 9,
          top: 9,
          bottom: 9,
          earring: 9,
          ring: 9,
        },
        kiboConfig: {
          level: 80,
          intimacyLevel: 1,
          comprehensionByAttribute: {
            1: 120,
            3: 120,
            4: 120,
            5: 120,
          },
        },
      },
      optimizationCultivationApplication: {
        status: 'partially-applied',
        appliedDimensions: expect.arrayContaining([
          'character.level',
          'character.starGiftRank',
          'character.starGiftNodeAttributes',
          'character.ascensionAttributes',
          'kibo.level',
          'kibo.talents',
          'kibo.bondLevel',
          'kibo.dnaFactors',
          'soulEssence.level',
          'soulEssence.rank',
          'soulEssence.effectSkillLevel',
          'equipment.enhancementLevel',
          'equipment.tuningScore',
        ]),
        unresolvedDimensions: expect.arrayContaining([
          'character.starGiftNodeSkillLevels',
          'character.ascensionSkillUnlocks',
          'soulEssence.effectSkillRuntime',
          'equipment.instanceTier',
        ]),
      },
    });
    expect(
      actorConfig.optimizationCultivationApplication.unresolvedDimensions
    ).not.toContain('kibo.dnaFactorRuntime');
    expect(actor.verifiedStaticProperties.sources.map(source => source.kind)).toEqual(
      expect.arrayContaining([
        'star-gift-rank',
        'star-gift-node',
        'actor-ascension',
        'soulessence-level',
        'soulessence-rank',
        'equipment-main',
        'equipment-sub',
        'equipment-tuning-main',
        'equipment-tuning-sub',
      ])
    );
    expect(
      actor.verifiedStaticProperties.sources
        .find(
          source =>
            source.kind === 'equipment-tuning-main' &&
            source.sourceId.startsWith('1310011:weapon:')
        )
        .attributes.find(attribute => attribute.id === 2001)
    ).toEqual({ id: 2001, value: 229 });
    expect(actor.verifiedStaticKiboProperties).toMatchObject({
      level: 80,
      intimacyLevel: 1,
      comprehensionByAttribute: {
        1: 120,
        3: 120,
        4: 120,
        5: 120,
      },
    });
    expect(
      actor.verifiedStaticProperties.unapplied.find(
        source => source.kind === 'soulessence-effect-skill'
      )
    ).toMatchObject({
      sourceId: 1900480,
      skillLevel: 1,
      star: 1,
      appliedToStaticPanel: false,
    });
  });

  it('applies selected current-rank nodes and ascension attributes without folding in unselected nodes', () => {
    const service = createMachineAxisService();
    const fullProfile = createCultivationProfile();
    const currentNodes = fullProfile.actors[0].character.starGiftNodeIds;
    const withoutOneNode = createCultivationProfile({
      selectedStarGiftNodeIdsByCharacterId: {
        101010: currentNodes.slice(0, -1),
      },
    });
    const noAscension = createCultivationProfile({ ascensionRank: 0 });
    const full = service.compile(createAxis({ profile: fullProfile }));
    const partial = service.compile(createAxis({ profile: withoutOneNode }));
    const base = service.compile(createAxis({ profile: noAscension }));
    const fullActor = full.canonicalCompilation.scenario.actors.find(
      entry => entry.characterId === 101010
    );
    const partialActor = partial.canonicalCompilation.scenario.actors.find(
      entry => entry.characterId === 101010
    );
    const baseActor = base.canonicalCompilation.scenario.actors.find(
      entry => entry.characterId === 101010
    );

    expect(
      fullActor.verifiedStaticProperties.sources.filter(
        source => source.kind === 'star-gift-node'
      )
    ).toHaveLength(35);
    expect(
      partialActor.verifiedStaticProperties.sources.filter(
        source => source.kind === 'star-gift-node'
      )
    ).toHaveLength(34);
    expect(
      fullActor.verifiedStaticProperties.sources.filter(
        source => source.kind === 'actor-ascension'
      )
    ).toHaveLength(6);
    expect(
      baseActor.verifiedStaticProperties.sources.filter(
        source => source.kind === 'actor-ascension'
      )
    ).toHaveLength(0);
    expect(fullActor.stats).not.toEqual(partialActor.stats);
    expect(fullActor.stats).not.toEqual(baseActor.stats);
    expect(fullActor.verifiedStaticKiboProperties.stats).not.toEqual(
      partialActor.verifiedStaticKiboProperties.stats
    );
    expect(full.hashes.input).not.toBe(partial.hashes.input);
    expect(full.hashes.input).not.toBe(base.hashes.input);
  });

  it('changes static actor and inherited Kibo values with a fixed tuning score', () => {
    const service = createMachineAxisService();
    const low = service.compile(
      createAxis({
        profile: createCultivationProfile({ tuningScore: 20 }),
      })
    );
    const high = service.compile(
      createAxis({
        profile: createCultivationProfile({ tuningScore: 110 }),
      })
    );
    const lowActor = low.canonicalCompilation.scenario.actors.find(
      entry => entry.characterId === 101010
    );
    const highActor = high.canonicalCompilation.scenario.actors.find(
      entry => entry.characterId === 101010
    );

    expect(highActor.stats.attack).toBeGreaterThan(lowActor.stats.attack);
    expect(highActor.verifiedStaticKiboProperties.stats.attack).toBeGreaterThan(
      lowActor.verifiedStaticKiboProperties.stats.attack
    );
    expect(high.hashes.input).not.toBe(low.hashes.input);
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
