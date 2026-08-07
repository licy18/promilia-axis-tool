import { describe, expect, it } from 'vitest';
import evidence from '../../../scripts/optimization-qualification/evidence/hero-rank-runtime-evidence.json';
import equipmentCatalog from '../../data/generated/equipment.json';
import qualificationCatalog from '../../data/generated/optimization-qualification-catalog.json';
import {
  assertHeroRankExpectedDeltaCoverage,
  validateHeroRankAdjacentRankCaptureComparisons,
} from '../../../scripts/optimization-qualification/optimization-qualification-generation.mjs';
import {
  projectResolvedOptimizationCultivationActor,
  resolveOptimizationCultivationProfile,
} from '../../optimization-qualification/optimizationQualificationProtocol';

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
            levelBreakthroughRank: 3,
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
            levelBreakthroughRank: 3,
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
            levelBreakthroughRank: 3,
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

describe('E20-1 strict character cultivation runtime baseline', () => {
  it('indexes adjacent-rank expected deltas for all 11 optimization objects', () => {
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

  it('resolves strict cultivation for all 11 objects with only the hero_rank evidence boundary unresolved', () => {
    const objectIds = [
      '101010',
      '102001',
      '103002',
      '107001',
      '107002',
      '108001',
      '108003',
      '109001',
      '111001',
      '112001',
      'STARBORN',
    ];
    const characterIdByObject = {
      '101010': 101010,
      '102001': 102001,
      '103002': 103002,
      '107001': 107001,
      '107002': 107002,
      '108001': 108001,
      '108003': 108003,
      '109001': 109001,
      '111001': 111001,
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
        'character.levelBreakthroughLegality',
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
      const expectedUnresolved = [
        'character.starGiftNodeSkillLevels',
        'character.levelBreakthroughAttributes',
        'character.levelBreakthroughSkillUnlocks',
      ];
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
    }
  });
});
