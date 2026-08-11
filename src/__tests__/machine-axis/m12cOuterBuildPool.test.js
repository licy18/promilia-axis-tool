import formalAdmissionBinding from '../../../reports/m12/m12-b3-binding-matrix.json';
import qualificationCatalog from '../../data/generated/optimization-qualification-catalog.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';
import {
  M12C_BUILD_SELECTION_CONTRACT_NAME,
  M12C_EQUIPMENT_SLOTS,
  M12C_OUTER_BUILD_POOL_SCHEMA_VERSION,
  createM12cBuildCandidate,
  createM12cBuildEnumerationPlan,
  createM12cOuterBuildPool,
  createM12cTeamCatalog,
  deriveM12cSetBonuses,
  iterateM12cBuildCandidates,
  resolveM12cTeamSourceConfig,
  validateM12cBuildCandidate,
  validateM12cBuildSelection,
  validateM12cOuterBuildAuthority,
} from '../../machine-axis/m12cOuterBuildPool';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';
import { describe, expect, it } from 'vitest';

const FIXED_INSTANCE = Object.freeze({
  rarity: 4,
  enhancementLevel: 9,
  tuningScore: 110,
  instanceTier: 'starborn',
  bGoldSide: true,
});

describe('M12-C outer team and build pool', () => {
  it('enumerates 28 canonical team identities and 35 source configs', () => {
    const catalog = createM12cTeamCatalog();

    expect(catalog.summary).toEqual({
      teamCount: 28,
      sourceConfigCount: 35,
      starbornTeamCount: 7,
      starbornSourceConfigCount: 14,
    });
    expect(new Set(catalog.teams.map(team => team.teamIdentity)).size).toBe(28);
    expect(
      new Set(catalog.sourceConfigs.map(config => config.sourceConfigIdentity))
        .size
    ).toBe(35);
    expect(
      catalog.teams.every(
        team =>
          team.optimizationObjectIds.length === 3 &&
          team.optimizationObjectIds.includes('109001') &&
          [...team.optimizationObjectIds].sort(compareObjectIds).join('|') ===
            team.optimizationObjectIds.join('|')
      )
    ).toBe(true);
    expect(
      catalog.sourceConfigs
        .filter(config => config.optimizationObjectIds.includes('STARBORN'))
        .every(config =>
          [199001, 199002].includes(config.starbornSourceCharacterId)
        )
    ).toBe(true);
  });

  it('keeps STARBORN as one object with exactly one explicit source alias', () => {
    const valid = resolveM12cTeamSourceConfig({
      optimizationObjectIds: ['STARBORN', '109001', '101010'],
      sourceCharacterIdsByObjectId: { STARBORN: 199002 },
    });
    const missing = resolveM12cTeamSourceConfig({
      optimizationObjectIds: ['101010', '109001', 'STARBORN'],
      sourceCharacterIdsByObjectId: {},
    });
    const doubled = resolveM12cTeamSourceConfig({
      optimizationObjectIds: ['101010', '109001', 'STARBORN'],
      sourceCharacterIdsByObjectId: { STARBORN: [199001, 199002] },
    });
    const orphanAlias = resolveM12cTeamSourceConfig({
      optimizationObjectIds: ['101010', '102001', '109001'],
      sourceCharacterIdsByObjectId: { STARBORN: 199001 },
    });

    expect(valid.valid).toBe(true);
    expect(valid.sourceConfig.starbornSourceCharacterId).toBe(199002);
    expect(missing.issues).toContain(
      'm12c-team-starborn-single-alias-required'
    );
    expect(doubled.issues).toContain(
      'm12c-team-starborn-single-alias-required'
    );
    expect(orphanAlias.issues).toContain(
      'm12c-team-starborn-alias-without-object'
    );
  });

  it('rejects duplicate raw roster entries before canonicalization', () => {
    const duplicated = resolveM12cTeamSourceConfig({
      optimizationObjectIds: ['109001', '101010', '102001', '102001'],
      sourceCharacterIdsByObjectId: {},
    });
    const nonArray = resolveM12cTeamSourceConfig({
      optimizationObjectIds: '109001',
      sourceCharacterIdsByObjectId: {},
    });

    expect(duplicated.valid).toBe(false);
    expect(duplicated.issues).toEqual(
      expect.arrayContaining([
        'm12c-team-object-count-invalid',
        'm12c-team-object-duplicate',
      ])
    );
    expect(nonArray.valid).toBe(false);
    expect(nonArray.issues).toContain('m12c-team-object-count-invalid');
  });

  it('materializes a scoreable canonical build for every one of the 35 source configs', () => {
    const pool = createM12cOuterBuildPool();
    const builds = pool.teamCatalog.sourceConfigs.map(sourceConfig =>
      createM12cBuildCandidate(createLegalSelection(pool, sourceConfig), {
        pool,
      })
    );

    expect(builds).toHaveLength(35);
    expect(builds.every(result => result.scoreable && result.build)).toBe(true);
    expect(new Set(builds.map(result => result.build.buildHash)).size).toBe(35);
  });

  it('derives the qualified 43/62/137 catalogs and the 53-instance M12-C projection', () => {
    const pool = createM12cOuterBuildPool();

    expect(pool.summary).toMatchObject({
      teamCount: 28,
      sourceConfigCount: 35,
      kiboCount: 43,
      soulEssenceCount: 62,
      globalEquipmentQualifiedCount: 137,
      m12cEquipmentProjectionCount: 53,
      m12cEquipmentProjectionCountBySlot: {
        weapon: 17,
        top: 9,
        bottom: 9,
        earring: 9,
        ring: 9,
      },
      setSkillThresholdCount: 12,
    });
    expect(pool.domains.equipment).toHaveLength(53);
    expect(
      pool.domains.equipment.every(
        item => item.rarity === 4 && item.maximumEnhancementLevel >= 9
      )
    ).toBe(true);
    expect(pool.fixedCultivationProfile).toMatchObject({
      character: {
        level: 80,
        starGiftRank: 7,
        completedStarGiftAttributeRank: 6,
        currentRankNodeSelection: 'all',
      },
      kibo: {
        level: 80,
        resolvedTalentValuesByAttributeId: {
          1: 120,
          3: 120,
          4: 120,
          5: 120,
        },
        bondLevel: 1,
        inheritanceBasisPoints: 900,
        dnaFactors: [],
      },
      soulEssence: { level: 80, rank: 6, star: 1 },
      equipment: {
        rarity: 4,
        enhancementLevel: 9,
        tuningScore: 110,
        instanceTier: 'starborn',
        bGoldSide: true,
      },
      heroRankInput: 'excluded',
    });
    expect(pool.poolHash).toMatch(/^[0-9a-f]{16}$/);

    for (const actorDomain of pool.domains.actorLoadoutDomains) {
      const expectedEquipmentIds = pool.domains.equipment
        .filter(profile =>
          qualificationCatalog.bindingMatrix.actorEquipment.some(
            edge =>
              edge.actorObjectId === actorDomain.optimizationObjectId &&
              Number(edge.equipmentId) === profile.equipmentId &&
              edge.slot === profile.slot &&
              edge.compatible === true &&
              edge.qualificationReady === true
          )
        )
        .map(profile => profile.equipmentId)
        .sort((left, right) => left - right);

      expect(actorDomain.equipmentIds).toEqual(expectedEquipmentIds);
      expect(actorDomain.equipmentBindings).toHaveLength(
        expectedEquipmentIds.length
      );
      expect(
        actorDomain.equipmentBindings.every(
          binding =>
            binding.compatible === true &&
            binding.qualificationReady === true &&
            binding.reason === 'public-equipment-slot-contract'
        )
      ).toBe(true);
    }
  });

  it('creates a canonical build hash that excludes initial front, axis, and preset', () => {
    const pool = createM12cOuterBuildPool();
    const sourceConfig = nonStarbornSourceConfig(pool);
    const selection = createLegalSelection(pool, sourceConfig);
    const shuffled = structuredClone(selection);
    shuffled.actors.reverse();
    shuffled.actors.forEach(actor => actor.equipment.reverse());

    const first = createM12cBuildCandidate(selection, {
      pool,
      initialFront: selection.actors[0].optimizationObjectId,
      axis: { actions: ['fixture-a'] },
      initialStatePreset: { actorSp: 100 },
    });
    const second = createM12cBuildCandidate(shuffled, {
      pool,
      initialFront: selection.actors[2].optimizationObjectId,
      axis: { actions: ['fixture-b'] },
      initialStatePreset: { actorSp: 0 },
    });

    expect(first.scoreable).toBe(true);
    expect(first.build.buildHash).toBe(second.build.buildHash);
    expect(first.build.identityPolicy.excludes).toEqual([
      'initialFront',
      'axis',
      'initialStatePreset',
    ]);
    expect(first.build.authority).toMatchObject({
      qualificationCatalogHash: qualificationCatalog.catalogHash,
      qualificationBindingMatrixHash: qualificationCatalog.bindingMatrixHash,
      formalAdmissionBindingHash: formalAdmissionBinding.bindingMatrixHash,
      verifiedMechanicsPackageHash:
        formalAdmissionBinding.hashes.verifiedMechanicsPackageHash,
    });
  });

  it('canonicalizes numeric equipment instance inputs before build hashing', () => {
    const pool = createM12cOuterBuildPool();
    const sourceConfig = nonStarbornSourceConfig(pool);
    const numeric = createLegalSelection(pool, sourceConfig);
    const numericStrings = structuredClone(numeric);
    numericStrings.actors.forEach(actor => {
      actor.equipment.forEach(item => {
        item.rarity = String(item.rarity);
        item.enhancementLevel = String(item.enhancementLevel);
        item.tuningScore = String(item.tuningScore);
      });
    });

    const numericBuild = createM12cBuildCandidate(numeric, { pool }).build;
    const stringBuild = createM12cBuildCandidate(numericStrings, {
      pool,
    }).build;

    expect(stringBuild.buildHash).toBe(numericBuild.buildHash);
    expect(
      stringBuild.actors.every(actor =>
        actor.equipment.every(
          item =>
            typeof item.rarity === 'number' &&
            typeof item.enhancementLevel === 'number' &&
            typeof item.tuningScore === 'number'
        )
      )
    ).toBe(true);
  });

  it('binds a STARBORN source alias into buildHash without changing teamIdentity', () => {
    const pool = createM12cOuterBuildPool();
    const starbornConfigs = pool.teamCatalog.sourceConfigs.filter(
      config =>
        config.optimizationObjectIds.includes('STARBORN') &&
        config.optimizationObjectIds.includes('101010')
    );
    const grouped = Object.values(
      Object.groupBy(starbornConfigs, row => row.teamIdentity)
    );
    const pair = grouped.find(rows => rows.length === 2);
    const first = createM12cBuildCandidate(
      createLegalSelection(pool, pair[0]),
      { pool }
    ).build;
    const second = createM12cBuildCandidate(
      createLegalSelection(pool, pair[1]),
      { pool }
    ).build;

    expect(first.teamIdentity).toBe(second.teamIdentity);
    expect(first.sourceConfigIdentity).not.toBe(second.sourceConfigIdentity);
    expect(first.buildHash).not.toBe(second.buildHash);
    expect(
      first.actors.find(actor => actor.optimizationObjectId === 'STARBORN')
        .sourceCharacterId
    ).not.toBe(
      second.actors.find(actor => actor.optimizationObjectId === 'STARBORN')
        .sourceCharacterId
    );
  });

  it('rejects profession mismatch, wrong slots, non-53 equipment, and duplicate slots as illegal', () => {
    const pool = createM12cOuterBuildPool();
    const sourceConfig = nonStarbornSourceConfig(pool);
    const base = createLegalSelection(pool, sourceConfig);
    const actor = base.actors[0];
    const actorDomain = domainFor(pool, actor.optimizationObjectId);
    const incompatibleSoul = pool.domains.soulEssenceIds.find(
      soulId => !actorDomain.soulEssenceIds.includes(soulId)
    );
    const globalNonProjectionEquipment =
      qualificationCatalog.admission.equipment
        .map(Number)
        .find(
          equipmentId =>
            !pool.domains.equipment.some(row => row.equipmentId === equipmentId)
        );

    const professionMismatch = structuredClone(base);
    professionMismatch.actors[0].soulEssenceId = incompatibleSoul;
    const wrongSlot = structuredClone(base);
    wrongSlot.actors[0].equipment.find(
      item => item.slot === 'weapon'
    ).equipmentId = pool.domains.equipmentIdsBySlot.top[0];
    const outsideProjection = structuredClone(base);
    outsideProjection.actors[0].equipment.find(
      item => item.slot === 'weapon'
    ).equipmentId = globalNonProjectionEquipment;
    const duplicateSlot = structuredClone(base);
    duplicateSlot.actors[0].equipment.find(item => item.slot === 'ring').slot =
      'top';

    expect(
      validateM12cBuildSelection(professionMismatch, { pool })
    ).toMatchObject({
      classification: 'illegal',
      illegal: true,
      scoreable: false,
    });
    expect(validateM12cBuildSelection(wrongSlot, { pool }).issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('equipment-slot-mismatch'),
      ])
    );
    expect(
      validateM12cBuildSelection(outsideProjection, { pool }).issues
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('equipment-not-in-53-projection'),
      ])
    );
    expect(validateM12cBuildSelection(duplicateSlot, { pool }).issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('equipment-slot-duplicate'),
        expect.stringContaining('equipment-slot-cardinality-invalid'),
      ])
    );
  });

  it('rejects non-stellar instance values before scoring', () => {
    const pool = createM12cOuterBuildPool();
    const sourceConfig = nonStarbornSourceConfig(pool);
    const selection = createLegalSelection(pool, sourceConfig);
    selection.actors[0].equipment[0].tuningScore = 100;

    const validation = validateM12cBuildSelection(selection, { pool });
    expect(validation.classification).toBe('illegal');
    expect(validation.issues).toContain(
      `m12c-build-equipment-instance-invalid:${selection.actors[0].optimizationObjectId}:weapon`
    );
  });

  it('derives 2+2+1 and 4/5-piece thresholds exactly once from equipment', () => {
    const pool = createM12cOuterBuildPool();
    const twoPlusTwo = [
      equipmentFor(pool, 1, 'weapon'),
      equipmentFor(pool, 1, 'top'),
      equipmentFor(pool, 2, 'bottom'),
      equipmentFor(pool, 2, 'earring'),
      neutralEquipmentFor(pool, 'ring'),
    ];
    const fourPiece = [
      equipmentFor(pool, 1, 'weapon'),
      equipmentFor(pool, 1, 'top'),
      equipmentFor(pool, 1, 'bottom'),
      equipmentFor(pool, 1, 'earring'),
      neutralEquipmentFor(pool, 'ring'),
    ];
    const fivePiece = M12C_EQUIPMENT_SLOTS.map(slot =>
      equipmentFor(pool, 1, slot)
    );

    expect(
      deriveM12cSetBonuses(twoPlusTwo, { pool }).setBonuses.map(
        row => `${row.setId}:${row.pieces}`
      )
    ).toEqual(['1:2', '2:2']);
    expect(
      deriveM12cSetBonuses(fourPiece, { pool }).setBonuses.map(
        row => `${row.setId}:${row.pieces}`
      )
    ).toEqual(['1:2', '1:4']);
    expect(
      deriveM12cSetBonuses(fivePiece, { pool }).setBonuses.map(
        row => `${row.setId}:${row.pieces}`
      )
    ).toEqual(['1:2', '1:4']);
  });

  it('fails set derivation closed unless all five legal slots are present exactly once', () => {
    const pool = createM12cOuterBuildPool();
    const invalid = M12C_EQUIPMENT_SLOTS.map(slot =>
      equipmentFor(pool, 1, slot)
    );
    invalid.find(item => item.slot === 'ring').slot = 'top';

    const result = deriveM12cSetBonuses(invalid, { pool });

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        'm12c-set-derivation-slot-duplicate',
        'm12c-set-derivation-slot-cardinality-invalid:ring',
      ])
    );
    expect(result.setBonuses).toEqual([]);
  });

  it('allows cross-actor base-id reuse while isolating Kibo runtime owners by slot', () => {
    const pool = createM12cOuterBuildPool();
    const sourceConfig = sourceConfigWithCommonSoul(pool);
    const selection = createLegalSelection(pool, sourceConfig, {
      shareComponentsAcrossActors: true,
    });
    const created = createM12cBuildCandidate(selection, { pool });

    expect(created.scoreable).toBe(true);
    expect(
      new Set(created.build.actors.map(actor => actor.kibo.kiboId)).size
    ).toBe(1);
    expect(
      new Set(
        created.build.actors.map(actor => actor.soulEssence.soulEssenceId)
      ).size
    ).toBe(1);
    for (const slot of M12C_EQUIPMENT_SLOTS) {
      expect(
        new Set(
          created.build.actors.map(
            actor =>
              actor.equipment.find(item => item.slot === slot).equipmentId
          )
        ).size
      ).toBe(1);
    }
    expect(
      new Set(
        created.build.actors.map(actor => actor.kibo.runtimeOwnerIdentity)
      ).size
    ).toBe(3);
    expect(
      created.build.actors.every(actor =>
        actor.kibo.runtimeOwnerIdentity.startsWith(`${actor.actorSlotId}+`)
      )
    ).toBe(true);
  });

  it('builds constrained lazy plans without materializing the global Cartesian product', () => {
    const pool = createM12cOuterBuildPool();
    const sourceConfig = sourceConfigWithCommonSoul(pool);
    const commonSoul = commonSoulForConfig(pool, sourceConfig);
    const constraints = { perActor: {} };
    sourceConfig.actors.forEach((actor, index) => {
      constraints.perActor[actor.actorSlotId] = {
        kiboIds: pool.domains.kiboIds.slice(0, index === 0 ? 2 : 1),
        soulEssenceIds: [commonSoul],
        equipmentIdsBySlot: Object.fromEntries(
          M12C_EQUIPMENT_SLOTS.map(slot => [
            slot,
            [pool.domains.equipmentIdsBySlot[slot][0]],
          ])
        ),
      };
    });
    const planned = createM12cBuildEnumerationPlan(
      { sourceConfigIdentity: sourceConfig.sourceConfigIdentity, constraints },
      { pool }
    );
    const seenStages = [];
    const candidates = [
      ...iterateM12cBuildCandidates(planned.plan, {
        pool,
        maxCandidates: 1,
        shouldPrune(context) {
          seenStages.push(context.stage);
          return (
            context.stage === 'kibo' &&
            context.actorSlotId === sourceConfig.actors[0].actorSlotId &&
            context.kiboId === pool.domains.kiboIds[0]
          );
        },
      }),
    ];

    expect(planned.valid).toBe(true);
    expect(planned.plan.estimatedBuildCount).toBe('2');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].buildHash).toMatch(/^[0-9a-f]{16}$/);
    expect(seenStages).toEqual(
      expect.arrayContaining([
        'kibo',
        'soul-essence',
        'equipment',
        'actor-loadout',
      ])
    );
    expect(planned.plan).not.toHaveProperty('initialFront');
  });

  it('exposes the authoritative pool and lazy iterator through the production service', () => {
    clearInstalledVerifiedCombatMechanicsPackage();
    const service = createMachineAxisService();
    let missingPackageError = null;
    try {
      service.createM12cOuterBuildPool();
    } catch (error) {
      missingPackageError = error;
    }
    expect(missingPackageError).toMatchObject({
      issues: [
        expect.objectContaining({
          code: 'machine-axis-mechanics-package-not-installed',
        }),
      ],
    });

    installVerifiedCombatMechanicsPackage(mechanicsPackage);
    try {
      const pool = service.createM12cOuterBuildPool();
      const sourceConfig = nonStarbornSourceConfig(pool);
      const planned = service.createM12cBuildEnumerationPlan({
        sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
      });
      const candidates = [
        ...service.iterateM12cBuildCandidates(planned.plan, {
          maxCandidates: 1,
        }),
      ];

      expect(pool.summary).toMatchObject({
        teamCount: 28,
        sourceConfigCount: 35,
      });
      expect(pool.authority.verifiedMechanicsPackageHash).toBe(
        mechanicsPackage.packageHash
      );
      expect(planned.valid).toBe(true);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].authority.verifiedMechanicsPackageHash).toBe(
        mechanicsPackage.packageHash
      );
    } finally {
      clearInstalledVerifiedCombatMechanicsPackage();
    }
  });

  it('fails closed on forged qualification, binding, pool, and build hashes', () => {
    const forgedQualification = structuredClone(qualificationCatalog);
    forgedQualification.records.find(
      record => record.objectKind === 'kibo'
    ).optimizationReady = false;
    const forgedBinding = structuredClone(formalAdmissionBinding);
    forgedBinding.summary.allPassed = false;

    expect(
      validateM12cOuterBuildAuthority({
        qualification: forgedQualification,
        admissionBinding: formalAdmissionBinding,
      }).valid
    ).toBe(false);
    expect(
      validateM12cOuterBuildAuthority({
        qualification: qualificationCatalog,
        admissionBinding: forgedBinding,
      }).issues
    ).toEqual(
      expect.arrayContaining([
        'm12c-outer-formal-admission-not-passed',
        'm12c-outer-formal-admission-hash-invalid',
      ])
    );

    const pool = createM12cOuterBuildPool();
    const sourceConfig = nonStarbornSourceConfig(pool);
    const selection = createLegalSelection(pool, sourceConfig);
    const forgedPool = structuredClone(pool);
    forgedPool.poolHash = '0000000000000000';
    const unscoreable = validateM12cBuildSelection(selection, {
      pool: forgedPool,
    });
    expect(unscoreable).toMatchObject({
      classification: 'unscoreable',
      illegal: false,
      unscoreable: true,
      scoreable: false,
    });

    const build = structuredClone(
      createM12cBuildCandidate(selection, { pool }).build
    );
    build.authority.qualificationCatalogHash = 'forged';
    const buildValidation = validateM12cBuildCandidate(build, { pool });
    expect(buildValidation.scoreable).toBe(false);
    expect(buildValidation.unscoreableIssues).toContain(
      'm12c-build-candidate-canonical-mismatch'
    );
  });
});

function createLegalSelection(
  pool,
  sourceConfig,
  { shareComponentsAcrossActors = false } = {}
) {
  const sharedSoul = shareComponentsAcrossActors
    ? commonSoulForConfig(pool, sourceConfig)
    : null;
  return {
    schemaVersion: M12C_OUTER_BUILD_POOL_SCHEMA_VERSION,
    contractName: M12C_BUILD_SELECTION_CONTRACT_NAME,
    teamIdentity: sourceConfig.teamIdentity,
    sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
    actors: sourceConfig.actors.map(actor => {
      const domain = domainFor(pool, actor.optimizationObjectId);
      return {
        actorSlotId: actor.actorSlotId,
        optimizationObjectId: actor.optimizationObjectId,
        sourceCharacterId: actor.sourceCharacterId,
        kiboId: pool.domains.kiboIds[0],
        soulEssenceId: sharedSoul ?? domain.soulEssenceIds[0],
        equipment: M12C_EQUIPMENT_SLOTS.map(slot => ({
          slot,
          equipmentId: pool.domains.equipmentIdsBySlot[slot][0],
          ...FIXED_INSTANCE,
        })),
      };
    }),
  };
}

function nonStarbornSourceConfig(pool) {
  return pool.teamCatalog.sourceConfigs.find(
    config => !config.optimizationObjectIds.includes('STARBORN')
  );
}

function sourceConfigWithCommonSoul(pool) {
  return pool.teamCatalog.sourceConfigs.find(
    config => commonSoulForConfig(pool, config) != null
  );
}

function commonSoulForConfig(pool, sourceConfig) {
  const domains = sourceConfig.actors.map(actor =>
    domainFor(pool, actor.optimizationObjectId)
  );
  return pool.domains.soulEssenceIds.find(soulEssenceId =>
    domains.every(domain => domain.soulEssenceIds.includes(soulEssenceId))
  );
}

function domainFor(pool, optimizationObjectId) {
  return pool.domains.actorLoadoutDomains.find(
    domain => domain.optimizationObjectId === optimizationObjectId
  );
}

function equipmentFor(pool, setId, slot) {
  const profile = pool.domains.equipment.find(
    item => item.setId === setId && item.slot === slot
  );
  return { slot, equipmentId: profile.equipmentId, ...FIXED_INSTANCE };
}

function neutralEquipmentFor(pool, slot) {
  const profile = pool.domains.equipment.find(
    item => item.setId == null && item.slot === slot
  );
  return { slot, equipmentId: profile.equipmentId, ...FIXED_INSTANCE };
}

function compareObjectIds(left, right) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isInteger(leftNumber) && Number.isInteger(rightNumber)) {
    return leftNumber - rightNumber;
  }
  if (Number.isInteger(leftNumber)) return -1;
  if (Number.isInteger(rightNumber)) return 1;
  return String(left).localeCompare(String(right), 'en');
}
