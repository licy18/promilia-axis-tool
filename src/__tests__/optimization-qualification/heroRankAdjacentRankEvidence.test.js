import { describe, expect, it } from 'vitest';
import evidence from '../../../scripts/optimization-qualification/evidence/hero-rank-runtime-evidence.json';
import equipmentCatalog from '../../data/generated/equipment.json';
import qualificationCatalog from '../../data/generated/optimization-qualification-catalog.json';
import charactersCatalog from '../../data/generated/characters.json';
import skillsCatalog from '../../data/generated/skills.json';
import {
  assertHeroRankExpectedDeltaCoverage,
  validateHeroRankAdjacentRankCaptureComparisons,
} from '../../../scripts/optimization-qualification/optimization-qualification-generation.mjs';
import {
  projectResolvedOptimizationCultivationActor,
  resolveOptimizationCultivationProfile,
  resolveStarGiftSkillIndexToSkillId,
  resolveStarGiftSkillLevelBonusesBySkillId,
} from '../../optimization-qualification/optimizationQualificationProtocol';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';

const ROSTER_SOURCE_IDS = [
  101010, 102001, 103002, 107001, 107002, 108001, 108003, 109001, 111001,
  112001, 199001, 199002,
];

function createStrictProfile(characterId) {
  const sourceProfile =
    qualificationCatalog.cultivation.character.profiles.find(
      entry => Number(entry.characterId) === Number(characterId)
    );
  const sourceRank = sourceProfile?.starGiftRanks.find(
    entry => Number(entry.rank) === 7
  );
  const nodeIdsFor = characterIdArg => {
    const profile =
      qualificationCatalog.cultivation.character.profiles.find(
        entry => Number(entry.characterId) === Number(characterIdArg)
      );
    return (profile?.starGiftRanks ?? [])
      .find(entry => Number(entry.rank) === 7)
      ?.nodes.map(node => Number(node.runeId));
  };
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
  const loadout = {
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
  };
  return {
    team: [
      {
        slotId: 'slot-1',
        characterId,
        level: 80,
        initialSp: 0,
        loadout,
      },
      {
        slotId: 'slot-2',
        characterId: 101010,
        level: 80,
        initialSp: 0,
        loadout,
      },
      {
        slotId: 'slot-3',
        characterId: 103002,
        level: 80,
        initialSp: 0,
        loadout,
      },
    ],
    profile: {
      schemaVersion: 1,
      contractName: 'AzPrOptimizationCultivationProfile',
      profileId: `m12-b3-strict-profile-${characterId}`,
      actors: [
        {
          slotId: 'slot-1',
          character: {
            level: 80,
            starGiftRank: 7,
            starGiftNodeIds: nodeIdsFor(characterId),
          },
          kibo: {
            level: 80,
            talents: [1, 3, 4, 5].map(attributeId => ({
              attributeId,
              level: 10,
            })),
            dnaFactors: [],
            bondLevel: 1,
          },
          soulEssence: { level: 80, rank: 6, star: 1 },
          equipment: Object.fromEntries(
            ['weapon', 'top', 'bottom', 'earring', 'ring'].map(slot => [
              slot,
              {
                rarity: 4,
                enhancementLevel: 9,
                tuningScore: 110,
                instanceTier: 'starborn',
                maxValue: 110,
              },
            ])
          ),
        },
        {
          slotId: 'slot-2',
          character: {
            level: 80,
            starGiftRank: 7,
            starGiftNodeIds: nodeIdsFor(101010),
          },
          kibo: {
            level: 80,
            talents: [1, 3, 4, 5].map(attributeId => ({
              attributeId,
              level: 10,
            })),
            dnaFactors: [],
            bondLevel: 1,
          },
          soulEssence: { level: 80, rank: 6, star: 1 },
          equipment: Object.fromEntries(
            ['weapon', 'top', 'bottom', 'earring', 'ring'].map(slot => [
              slot,
              {
                rarity: 4,
                enhancementLevel: 9,
                tuningScore: 110,
                instanceTier: 'starborn',
                maxValue: 110,
              },
            ])
          ),
        },
        {
          slotId: 'slot-3',
          character: {
            level: 80,
            starGiftRank: 7,
            starGiftNodeIds: nodeIdsFor(103002),
          },
          kibo: {
            level: 80,
            talents: [1, 3, 4, 5].map(attributeId => ({
              attributeId,
              level: 10,
            })),
            dnaFactors: [],
            bondLevel: 1,
          },
          soulEssence: { level: 80, rank: 6, star: 1 },
          equipment: Object.fromEntries(
            ['weapon', 'top', 'bottom', 'earring', 'ring'].map(slot => [
              slot,
              {
                rarity: 4,
                enhancementLevel: 9,
                tuningScore: 110,
                instanceTier: 'starborn',
                maxValue: 110,
              },
            ])
          ),
        },
      ],
    },
  };
}

describe('E20-1 strict character cultivation runtime baseline (hero_rank dead config)', () => {
  it('maps star-gift skillIndex to client skill ids and aggregates level bonuses', () => {
    const characterById = new Map(
      charactersCatalog.items.map(item => [Number(item.id), item])
    );
    const xiaoyu = characterById.get(101010);
    expect(resolveStarGiftSkillIndexToSkillId(xiaoyu, 0)).toBe(10101001);
    expect(resolveStarGiftSkillIndexToSkillId(xiaoyu, 1)).toBe(10101012);
    expect(resolveStarGiftSkillIndexToSkillId(xiaoyu, 2)).toBe(10101013);
    expect(resolveStarGiftSkillIndexToSkillId(xiaoyu, 3)).toBe(10101021);

    const sourceProfile =
      qualificationCatalog.cultivation.character.profiles.find(
        entry => Number(entry.characterId) === 101010
      );
    const selectedNodes = sourceProfile.starGiftRanks
      .filter(row => Number(row.rank) <= 7)
      .flatMap(row => row.nodes);
    const bonuses = resolveStarGiftSkillLevelBonusesBySkillId({
      character: xiaoyu,
      starGiftNodeSkillLevels: selectedNodes
        .filter(node => node.skillUpgrade)
        .map(node => ({
          skillIndex: node.skillUpgrade.skillIndex,
          level: node.skillUpgrade.level,
        })),
    });
    expect(bonuses[10101001]).toBe(7); // 普通攻击 upgrade nodes across ranks 1..7
    expect(bonuses[10101012]).toBeGreaterThan(0);
    expect(bonuses[10101013]).toBeGreaterThan(0);
    expect(bonuses[10101021]).toBeGreaterThan(0);

    const starborn = characterById.get(199001);
    expect(resolveStarGiftSkillIndexToSkillId(starborn, 0)).toBe(19900101);
    expect(resolveStarGiftSkillIndexToSkillId(starborn, 1)).toBe(19900112);
    expect(resolveStarGiftSkillIndexToSkillId(starborn, 2)).toBe(19900113);
    expect(resolveStarGiftSkillIndexToSkillId(starborn, 3)).toBe(19900122);

    const starbornSourceProfile =
      qualificationCatalog.cultivation.character.profiles.find(
        entry => Number(entry.characterId) === 199001
      );
    const starbornNodes = starbornSourceProfile.starGiftRanks
      .filter(row => Number(row.rank) <= 7)
      .flatMap(row => row.nodes);
    const starbornBonuses = resolveStarGiftSkillLevelBonusesBySkillId({
      character: starborn,
      starGiftNodeSkillLevels: starbornNodes
        .filter(node => node.skillUpgrade)
        .map(node => ({
          skillIndex: node.skillUpgrade.skillIndex,
          level: node.skillUpgrade.level,
        })),
    });
    expect(starbornBonuses[19900101]).toBe(5); // 普攻
    expect(starbornBonuses[19900112]).toBe(7); // 星鸣技
    expect(starbornBonuses[19900113]).toBe(5); // 星决技
    expect(starbornBonuses[19900122]).toBe(7); // 星携技（ground/201 退场型）
  });

  it('maps skillIndex 3 to the character star-carry slot for every roster profile', () => {
    const skillsById = new Map(
      (skillsCatalog.items ?? []).map(skill => [Number(skill.id), skill])
    );
    for (const sourceProfile of qualificationCatalog.cultivation.character
      .profiles) {
      const character = charactersCatalog.items.find(
        item => Number(item.id) === Number(sourceProfile.characterId)
      );
      const skillId = resolveStarGiftSkillIndexToSkillId(character, 3);
      expect(skillId, `character=${sourceProfile.characterId}`).not.toBeNull();
      const skill = skillsById.get(Number(skillId));
      expect(skill?.displayType, `character=${sourceProfile.characterId}`).toBe(
        5
      );
      const groundSlot = character.skillSlots.find(
        slot =>
          slot.group === 'ground' && Number(slot.skillId) === Number(skillId)
      );
      expect(
        [201, 203].includes(Number(groundSlot?.slot)),
        `character=${sourceProfile.characterId}`
      ).toBe(true);
    }
  });

  it('applies star-gift skill level bonuses to machine axis action drafts', async () => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
    const { team, profile } = createStrictProfile(109001);
    const service = createMachineAxisService();
    const prepared = service.prepare({
      schemaVersion: 1,
      contractName: 'AzPrMachineAxis',
      kind: 'azpr-machine-axis',
      dataIdentity: {
        verifiedMechanicsPackageId: mechanicsPackage.packageId,
        verifiedMechanicsPackageHash: mechanicsPackage.packageHash,
        mechanicsProfileId: 'azpr-three-value-verified-tc-20260718',
        mechanicsProfileVersion: 1,
      },
      scenario: {
        id: 'e20-1a-star-gift-skill-level',
        name: 'E20-1a',
        fps: 60,
        durationFrames: 600,
        team,
        enemy: { enemyId: 300032 },
        initialRuntimeState: {},
        projectile: { targetDistance: 0, defaultWillHit: true },
        critical: { policy: 'expected', seed: null },
        optimizationQualification: {
          mode: 'research',
          catalogHash: qualificationCatalog.catalogHash,
        },
        cultivationProfile: profile,
      },
      actions: [
        {
          id: 'moyin-star-skill',
          owner: { kind: 'actor', slotId: 'slot-1' },
          intent: {
            kind: 'public-action',
            publicActionId: 10900112,
            actionKind: 'star-skill',
            level: 1,
          },
          schedule: { mode: 'absolute', frame: 0 },
        },
      ],
    });
    if (!prepared.valid) {
      console.log(
        'ISSUES',
        JSON.stringify(prepared.issues?.slice(0, 6), null, 1)
      );
    }
    expect(prepared.valid).toBe(true);
    const draft = prepared.project.actions.find(
      action => action.id === 'moyin-star-skill'
    );
    expect(draft.level).toBeGreaterThan(1);
    const expectedBonus = resolveStarGiftSkillLevelBonusesBySkillId({
      character: charactersCatalog.items.find(item => Number(item.id) === 109001),
      starGiftNodeSkillLevels:
        prepared.project.actors[0].cultivation.starGiftNodeSkillLevels,
    })[10900112];
    expect(draft.level).toBe(1 + expectedBonus);
  });

  it('archives adjacent-rank expected deltas for all 11 optimization objects', () => {
    expect(() => assertHeroRankExpectedDeltaCoverage(evidence)).not.toThrow();
    const deltas = evidence.adjacentRankCapture.expectedDeltas;
    expect(deltas).toHaveLength(12);
    expect(new Set(deltas.map(delta => Number(delta.sourceCharacterId)))).toEqual(
      new Set(ROSTER_SOURCE_IDS)
    );
    const bySource = new Map(
      deltas.map(delta => [Number(delta.sourceCharacterId), delta])
    );
    expect(bySource.get(101010).expectedDelta).toBe('1001#810');
    expect(bySource.get(107001).expectedDelta).toBe('7#750');
    expect(bySource.get(109001).expectedDelta).toBe('58#830');
    expect(bySource.get(199001).expectedDelta).toBe('1001#810');
    expect(bySource.get(199002).expectedDelta).toBe('1001#810');
    expect(bySource.get(111001).expectedDelta).toBe('53#830');
  });

  it('validates a captured adjacent-rank comparison against expected deltas', () => {
    const matching = {
      status: 'captured',
      captureIdentity: '2026-08-07-unit-test-capture',
      expectedDeltas: evidence.adjacentRankCapture.expectedDeltas,
      comparisons: [
        {
          sourceCharacterId: 101010,
          level: 80,
          lowerRank: 2,
          higherRank: 3,
          emptyLoadout: true,
          actualDelta: '1001#810',
        },
      ],
    };
    expect(() =>
      validateHeroRankAdjacentRankCaptureComparisons({
        adjacentRankCapture: matching,
      })
    ).not.toThrow();

    const mismatched = structuredClone(matching);
    mismatched.comparisons[0].actualDelta = '1001#810|7#750';
    expect(() =>
      validateHeroRankAdjacentRankCaptureComparisons({
        adjacentRankCapture: mismatched,
      })
    ).toThrow(
      'optimization-qualification-hero-rank-evidence-capture-delta-mismatch:101010'
    );

    const wrongRanks = structuredClone(matching);
    wrongRanks.comparisons[0].lowerRank = 3;
    expect(() =>
      validateHeroRankAdjacentRankCaptureComparisons({
        adjacentRankCapture: wrongRanks,
      })
    ).toThrow(
      'optimization-qualification-hero-rank-evidence-capture-comparison-invalid:101010'
    );
  });

  it('resolves strict cultivation for all 9 formal objects with hero_rank closed as unimplemented dead config', () => {
    const objectIds = [
      '101010',
      '102001',
      '103002',
      '107001',
      '107002',
      '108003',
      '109001',
      '112001',
      'STARBORN',
    ];
    const characterIdByObject = {
      '101010': 101010,
      '102001': 102001,
      '103002': 103002,
      '107001': 107001,
      '107002': 107002,
      '108003': 108003,
      '109001': 109001,
      '112001': 112001,
      STARBORN: 199001,
    };
    for (const objectId of objectIds) {
      const characterId = characterIdByObject[objectId];
      const { team, profile } = createStrictProfile(characterId);
      const resolved = resolveOptimizationCultivationProfile(profile, {
        team,
        catalog: qualificationCatalog,
      });
      expect(resolved.valid, objectId).toBe(true);
      expect(resolved.profileHash, objectId).toBeTruthy();
      const application = projectResolvedOptimizationCultivationActor(
        resolved.profile.actors[0],
        {
          profileHash: resolved.profileHash,
          catalog: qualificationCatalog,
        }
      );
      for (const dimension of [
        'character.level',
        'character.starGiftRank',
        'character.starGiftNodeAttributes',
        'character.completedStarGiftAttributes',
        'character.starGiftNodeSkillLevels',
        'kibo.level',
        'kibo.talents',
        'kibo.bondLevel',
        'kibo.dnaFactors',
        'soulEssence.level',
        'soulEssence.rank',
        'soulEssence.effectSkillLevel',
        'equipment.enhancementLevel',
        'equipment.tuningScore',
        'equipment.instanceTier',
      ]) {
        expect(
          application.application.appliedDimensions,
          `${objectId}:${dimension}`
        ).toContain(dimension);
      }
      const expectedUnresolved = [];
      if (
        application.application.unresolvedDimensions.includes(
          'soulEssence.effectSkillRuntime'
        )
      ) {
        expectedUnresolved.push('soulEssence.effectSkillRuntime');
      }
      expect(application.application.unresolvedDimensions, objectId).toEqual(
        expectedUnresolved
      );
      expect(
        resolved.profile.actors[0].character.levelBreakthroughSkillDeclarations,
        objectId
      ).toEqual([]);
      expect(
        resolved.profile.actors[0].character.staticSources
          .unappliedStaticSources,
        objectId
      ).toEqual([]);
      expect(
        resolved.profile.actors[0].character.staticSources
          .unappliedSkillSources,
        objectId
      ).toEqual([]);
    }
  });

  it('ignores a legacy hero_rank field without changing resolved values', () => {
    const { team, profile } = createStrictProfile(109001);
    profile.actors[0].character.levelBreakthroughRank = 4;
    const resolved = resolveOptimizationCultivationProfile(profile, {
      team,
      catalog: qualificationCatalog,
    });
    expect(resolved.valid).toBe(true);
    expect(resolved.profile.actors[0].character.staticSources).toMatchObject({
      levelBreakthroughSources: [],
      levelBreakthroughAttributeSources: [],
      unappliedStaticSources: [],
      unappliedSkillSources: [],
    });
    expect(
      resolved.profile.actors[0].character.levelBreakthroughSkillDeclarations
    ).toEqual([]);
  });
});
