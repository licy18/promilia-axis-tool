import generatedQualificationCatalog from '../data/generated/optimization-qualification-catalog.json';
import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization';

export const OPTIMIZATION_QUALIFICATION_SCHEMA_VERSION = 1;
export const OPTIMIZATION_QUALIFICATION_CATALOG_CONTRACT_NAME =
  'AzPrOptimizationQualificationCatalog';
export const OPTIMIZATION_CULTIVATION_PROFILE_SCHEMA_VERSION = 1;
export const OPTIMIZATION_CULTIVATION_PROFILE_CONTRACT_NAME =
  'AzPrOptimizationCultivationProfile';

const EQUIPMENT_SLOTS = Object.freeze([
  'weapon',
  'top',
  'bottom',
  'earring',
  'ring',
]);
const KIBO_TALENT_ATTRIBUTE_IDS = Object.freeze([1, 3, 4, 5]);

export function getOptimizationQualificationCatalog() {
  return generatedQualificationCatalog;
}

export function validateOptimizationQualificationCatalog(
  catalog = generatedQualificationCatalog
) {
  const issues = [];
  if (catalog?.schemaVersion !== OPTIMIZATION_QUALIFICATION_SCHEMA_VERSION) {
    issues.push('optimization-qualification-catalog-schema-version-invalid');
  }
  if (
    catalog?.contractName !==
    OPTIMIZATION_QUALIFICATION_CATALOG_CONTRACT_NAME
  ) {
    issues.push('optimization-qualification-catalog-contract-name-invalid');
  }
  if (!Array.isArray(catalog?.records)) {
    issues.push('optimization-qualification-catalog-records-required');
  }
  const keys = new Set();
  for (const record of catalog?.records ?? []) {
    const key = `${record?.objectKind}:${record?.objectId}`;
    if (!record?.objectKind || !record?.objectId || keys.has(key)) {
      issues.push(`optimization-qualification-catalog-record-invalid:${key}`);
    }
    keys.add(key);
    if (
      record?.optimizationReady === true &&
      (record?.maturityState !== 'optimization-ready' ||
        (record?.blockerCodes ?? []).length > 0)
    ) {
      issues.push(`optimization-qualification-ready-record-invalid:${key}`);
    }
  }
  const expectedAdmission = {
    characters: readyIds(catalog, 'character'),
    kibos: readyIds(catalog, 'kibo').map(Number),
    soulEssences: readyIds(catalog, 'soul-essence').map(Number),
    equipment: readyIds(catalog, 'equipment').map(Number),
    setSkills: readyIds(catalog, 'set-skill'),
  };
  if (hashCanonicalValue(catalog?.admission ?? {}) !== hashCanonicalValue(expectedAdmission)) {
    issues.push('optimization-qualification-catalog-admission-mismatch');
  }
  const bondLevelOne = catalog?.cultivation?.kibo?.bondLevels?.find(
    row => Number(row.level) === 1
  );
  if (
    Number(catalog?.cultivation?.kibo?.initialEffectiveBondLevel) !== 1 ||
    Number(bondLevelOne?.inheritanceBasisPoints) !== 900
  ) {
    issues.push('optimization-qualification-kibo-initial-bond-contract-invalid');
  }
  for (const attributeId of KIBO_TALENT_ATTRIBUTE_IDS) {
    const levelTen = catalog?.cultivation?.kibo?.talentValues?.[
      String(attributeId)
    ]?.find(row => Number(row.level) === 10);
    if (Number(levelTen?.value) !== 120) {
      issues.push(
        `optimization-qualification-kibo-talent-level-ten-invalid:${attributeId}`
      );
    }
  }
  if (
    catalog?.cultivation?.kibo?.dnaFactors?.status !==
      'source-indexed-runtime-unapplied' ||
    Number(catalog?.cultivation?.kibo?.dnaFactors?.factorCount) !== 215 ||
    Number(catalog?.cultivation?.kibo?.dnaFactors?.linkCount) !== 8
  ) {
    issues.push('optimization-qualification-kibo-dna-catalog-invalid');
  }
  if (
    Number(catalog?.cultivation?.soulEssence?.star?.minimum) !== 1 ||
    Number(catalog?.cultivation?.soulEssence?.star?.maximum) !== 4 ||
    catalog?.cultivation?.soulEssence?.profiles?.length !== 62 ||
    catalog.cultivation.soulEssence.profiles.some(
      profile =>
        profile.effectSkill?.status !==
          'source-indexed-runtime-unapplied' ||
        profile.effectSkill.starLevels?.length !== 4
    )
  ) {
    issues.push(
      'optimization-qualification-soulessence-star-catalog-invalid'
    );
  }
  if (catalog && typeof catalog === 'object') {
    const copy = structuredClone(catalog);
    delete copy.catalogHash;
    if (catalog.catalogHash !== hashCanonicalValue(copy)) {
      issues.push('optimization-qualification-catalog-hash-mismatch');
    }
  }
  return { valid: issues.length === 0, issues };
}

export function resolveOptimizationCultivationProfile(
  profile,
  {
    team = [],
    catalog = generatedQualificationCatalog,
  } = {}
) {
  const validation = validateOptimizationCultivationProfile(profile, {
    team,
    catalog,
  });
  if (!validation.valid) {
    return {
      valid: false,
      issues: validation.issues,
      profile: null,
      profileHash: null,
    };
  }
  const teamBySlot = new Map(
    team.map(slot => [String(slot.slotId), slot])
  );
  const dnaProfileById = new Map(
    (catalog.cultivation.kibo.dnaFactors.profiles ?? []).map(source => [
      Number(source.factorId),
      source,
    ])
  );
  const soulEssenceProfileById = new Map(
    (catalog.cultivation.soulEssence.profiles ?? []).map(source => [
      Number(source.soulEssenceId),
      source,
    ])
  );
  const actorRows = profile.actors.map(actor => {
    const teamSlot = teamBySlot.get(String(actor.slotId));
    const characterSourceProfile = findCharacterCultivationSourceProfile(
      catalog,
      teamSlot?.characterId
    );
    const talentRows = actor.kibo.talents.map(talent => {
      const source = catalog.cultivation.kibo.talentValues[
        String(talent.attributeId)
      ].find(row => Number(row.level) === Number(talent.level));
      return {
        attributeId: talent.attributeId,
        level: talent.level,
        value: Number(source.value),
        sourceIdentity: source.sourceIdentity,
      };
    });
    const bondSource = catalog.cultivation.kibo.bondLevels.find(
      row => Number(row.level) === Number(actor.kibo.bondLevel)
    );
    return {
      slotId: actor.slotId,
      character: resolveCharacterCultivation(
        actor.character,
        characterSourceProfile
      ),
      kibo: {
        ...structuredClone(actor.kibo),
        talents: talentRows,
        dnaFactors: actor.kibo.dnaFactors.map(factor => {
          const source = dnaProfileById.get(Number(factor.factorId));
          return {
            factorId: Number(source.factorId),
            rank: Number(source.rank),
            type: Number(source.type),
            skillId: Number(source.skillId),
            skillLevel: Number(source.skillLevel),
            runtimeStatus: source.runtimeStatus,
            sourceIdentities: structuredClone(source.sourceIdentities),
          };
        }),
        inheritanceBasisPoints: Number(bondSource.inheritanceBasisPoints),
        inheritanceRatio: Number(bondSource.inheritanceBasisPoints) / 10000,
        bondSourceIdentity: bondSource.sourceIdentity,
      },
      soulEssence: resolveSoulEssenceCultivation(
        actor.soulEssence,
        soulEssenceProfileById.get(Number(teamSlot?.loadout?.soulessenceId))
      ),
      equipment: structuredClone(actor.equipment),
    };
  });
  const resolved = {
    schemaVersion: OPTIMIZATION_CULTIVATION_PROFILE_SCHEMA_VERSION,
    contractName: OPTIMIZATION_CULTIVATION_PROFILE_CONTRACT_NAME,
    profileId: profile.profileId,
    qualificationCatalogHash: catalog.catalogHash,
    actors: actorRows,
  };
  return {
    valid: true,
    issues: validation.issues,
    profile: { ...resolved, profileHash: hashCanonicalValue(resolved) },
    profileHash: hashCanonicalValue(resolved),
  };
}

export function projectResolvedOptimizationCultivationActor(
  resolvedActor,
  { profileHash = null } = {}
) {
  if (!isRecord(resolvedActor)) return null;
  const talentValues = Object.fromEntries(
    (resolvedActor.kibo?.talents ?? []).map(talent => [
      Number(talent.attributeId),
      Number(talent.value),
    ])
  );
  const equipmentLevels = Object.fromEntries(
    EQUIPMENT_SLOTS.map(slot => [
      slot,
      Number(resolvedActor.equipment?.[slot]?.enhancementLevel),
    ])
  );
  const equipmentCultivation = Object.fromEntries(
    EQUIPMENT_SLOTS.map(slot => [
      slot,
      {
        ...structuredClone(resolvedActor.equipment?.[slot]),
        tuningFormula: structuredClone(
          generatedQualificationCatalog.cultivation.equipment.tuningFormula
        ),
      },
    ])
  );
  const appliedDimensions = [
    'character.level',
    'character.starGiftRank',
    'character.starGiftNodeAttributes',
    'character.ascensionAttributes',
    'kibo.level',
    'kibo.talents',
    'kibo.bondLevel',
    'kibo.dnaFactorIdentity',
    'soulEssence.level',
    'soulEssence.rank',
    'soulEssence.effectSkillLevel',
    'equipment.enhancementLevel',
    'equipment.tuningScore',
  ];
  const unresolvedDimensions = [
    ...(resolvedActor.character?.staticSources?.unappliedSkillSources?.some(
      source => source.kind === 'star-gift-node-skill-level'
    )
      ? ['character.starGiftNodeSkillLevels']
      : []),
    ...(resolvedActor.character?.staticSources?.unappliedSkillSources?.some(
      source => source.kind === 'actor-ascension-skill-unlock'
    )
      ? ['character.ascensionSkillUnlocks']
      : []),
    ...(resolvedActor.kibo?.dnaFactors?.length
      ? ['kibo.dnaFactorRuntime']
      : []),
    ...(resolvedActor.soulEssence?.effectSkill
      ? ['soulEssence.effectSkillRuntime']
      : []),
    'equipment.instanceTier',
  ];
  return {
    actorConfigPatch: {
      level: Number(resolvedActor.character.level),
      cultivation: {
        starGiftRank: Number(resolvedActor.character.starGiftRank),
        optimizationStaticSources: structuredClone(
          resolvedActor.character.staticSources
        ),
      },
      loadout: {
        soulessenceLevel: Number(resolvedActor.soulEssence.level),
        soulessenceRank: Number(resolvedActor.soulEssence.rank),
        soulessenceStar: Number(resolvedActor.soulEssence.star),
        soulessenceCultivation: {
          effectSkill: structuredClone(
            resolvedActor.soulEssence.effectSkill
          ),
        },
        equipmentLevels,
        equipmentCultivation,
        kiboConfig: {
          level: Number(resolvedActor.kibo.level),
          intimacyLevel: Number(resolvedActor.kibo.bondLevel),
          comprehensionByAttribute: talentValues,
        },
      },
    },
    application: {
      schemaVersion: 1,
      contractName: 'AzPrOptimizationCultivationApplication',
      status: 'partially-applied',
      profileHash,
      qualificationCatalogHash:
        generatedQualificationCatalog.catalogHash,
      appliedDimensions,
      unresolvedDimensions,
    },
  };
}

export function validateOptimizationCultivationProfile(
  profile,
  {
    team = [],
    catalog = generatedQualificationCatalog,
  } = {}
) {
  const issues = [];
  const catalogValidation = validateOptimizationQualificationCatalog(catalog);
  for (const issue of catalogValidation.issues) {
    issues.push(createIssue(issue, 'scenario.cultivationProfile'));
  }
  if (!isRecord(profile)) {
    issues.push(
      createIssue(
        'machine-axis-cultivation-profile-required',
        'scenario.cultivationProfile'
      )
    );
    return { valid: false, issues };
  }
  if (
    profile.schemaVersion !== OPTIMIZATION_CULTIVATION_PROFILE_SCHEMA_VERSION
  ) {
    issues.push(
      createIssue(
        'machine-axis-cultivation-schema-version-invalid',
        'scenario.cultivationProfile.schemaVersion'
      )
    );
  }
  if (profile.contractName !== OPTIMIZATION_CULTIVATION_PROFILE_CONTRACT_NAME) {
    issues.push(
      createIssue(
        'machine-axis-cultivation-contract-name-invalid',
        'scenario.cultivationProfile.contractName'
      )
    );
  }
  if (!Array.isArray(profile.actors) || profile.actors.length !== 3) {
    issues.push(
      createIssue(
        'machine-axis-cultivation-actor-count-invalid',
        'scenario.cultivationProfile.actors'
      )
    );
    return { valid: false, issues };
  }
  const teamBySlot = new Map(
    team.map(slot => [String(slot.slotId), slot])
  );
  const teamSlots = new Set(teamBySlot.keys());
  const dnaProfileById = new Map(
    (catalog.cultivation.kibo.dnaFactors.profiles ?? []).map(source => [
      Number(source.factorId),
      source,
    ])
  );
  const soulEssenceProfileById = new Map(
    (catalog.cultivation.soulEssence.profiles ?? []).map(source => [
      Number(source.soulEssenceId),
      source,
    ])
  );
  const profileSlots = new Set();
  profile.actors.forEach((actor, actorIndex) => {
    const basePath = `scenario.cultivationProfile.actors.${actorIndex}`;
    const teamSlot = teamBySlot.get(String(actor.slotId));
    const characterSourceProfile = findCharacterCultivationSourceProfile(
      catalog,
      teamSlot?.characterId
    );
    if (profileSlots.has(actor.slotId)) {
      issues.push(
        createIssue(
          'machine-axis-cultivation-slot-duplicate',
          `${basePath}.slotId`,
          { slotId: actor.slotId }
        )
      );
    }
    profileSlots.add(actor.slotId);
    if (teamSlots.size && !teamSlots.has(String(actor.slotId))) {
      issues.push(
        createIssue(
          'machine-axis-cultivation-slot-unknown',
          `${basePath}.slotId`,
          { slotId: actor.slotId }
        )
      );
    }
    validateRange(
      actor.character?.level,
      catalog.cultivation.character.level,
      `${basePath}.character.level`,
      'machine-axis-cultivation-character-level-invalid',
      issues
    );
    validateRange(
      actor.character?.starGiftRank,
      catalog.cultivation.character.starGiftRank,
      `${basePath}.character.starGiftRank`,
      'machine-axis-cultivation-star-gift-rank-invalid',
      issues
    );
    validateRange(
      actor.character?.ascensionRank,
      catalog.cultivation.character.ascensionRank,
      `${basePath}.character.ascensionRank`,
      'machine-axis-cultivation-ascension-rank-invalid',
      issues
    );
    if (teamSlot && !characterSourceProfile) {
      issues.push(
        createIssue(
          'machine-axis-cultivation-character-source-profile-missing',
          `${basePath}.character`,
          { characterId: Number(teamSlot.characterId) }
        )
      );
    }
    const selectedStarGiftRank = Number(actor.character?.starGiftRank);
    const selectedStarGiftSource = characterSourceProfile?.starGiftRanks.find(
      row => Number(row.rank) === selectedStarGiftRank
    );
    if (
      characterSourceProfile &&
      selectedStarGiftRank > 0 &&
      !selectedStarGiftSource
    ) {
      issues.push(
        createIssue(
          'machine-axis-cultivation-star-gift-rank-source-missing',
          `${basePath}.character.starGiftRank`,
          {
            characterId: Number(teamSlot.characterId),
            starGiftRank: selectedStarGiftRank,
          }
        )
      );
    }
    if (
      characterSourceProfile &&
      Number(actor.character?.ascensionRank) >
        characterSourceProfile.ascensionRanks.length
    ) {
      issues.push(
        createIssue(
          'machine-axis-cultivation-ascension-rank-source-missing',
          `${basePath}.character.ascensionRank`,
          {
            characterId: Number(teamSlot.characterId),
            maximum: characterSourceProfile.ascensionRanks.length,
            actual: actor.character?.ascensionRank,
          }
        )
      );
    }
    const starGiftNodeIdsValid =
      Array.isArray(actor.character?.starGiftNodeIds) &&
      actor.character.starGiftNodeIds.every(isPositiveInteger) &&
      new Set(actor.character.starGiftNodeIds).size ===
        actor.character.starGiftNodeIds.length;
    if (
      !starGiftNodeIdsValid
    ) {
      issues.push(
        createIssue(
          'machine-axis-cultivation-star-gift-nodes-invalid',
          `${basePath}.character.starGiftNodeIds`
        )
      );
    } else {
      const allowedNodeIds = new Set(
        (selectedStarGiftSource?.nodes ?? []).map(node => Number(node.runeId))
      );
      actor.character.starGiftNodeIds.forEach((runeId, nodeIndex) => {
        if (!allowedNodeIds.has(Number(runeId))) {
          issues.push(
            createIssue(
              'machine-axis-cultivation-star-gift-node-not-in-selected-rank',
              `${basePath}.character.starGiftNodeIds.${nodeIndex}`,
              {
                characterId: Number(teamSlot?.characterId) || null,
                starGiftRank: selectedStarGiftRank,
                runeId: Number(runeId),
              }
            )
          );
        }
      });
    }
    validateRange(
      actor.kibo?.level,
      catalog.cultivation.kibo.level,
      `${basePath}.kibo.level`,
      'machine-axis-cultivation-kibo-level-invalid',
      issues
    );
    validateKiboTalents(actor.kibo?.talents, basePath, catalog, issues);
    validateRange(
      actor.kibo?.bondLevel,
      catalog.cultivation.kibo.bondLevel,
      `${basePath}.kibo.bondLevel`,
      'machine-axis-cultivation-kibo-bond-level-invalid',
      issues
    );
    if (!Array.isArray(actor.kibo?.dnaFactors)) {
      issues.push(
        createIssue(
          'machine-axis-cultivation-kibo-dna-required',
          `${basePath}.kibo.dnaFactors`
        )
      );
    } else {
      const factorIds = actor.kibo.dnaFactors.map(entry => entry.factorId);
      if (
        actor.kibo.dnaFactors.some(
          entry =>
            !isPositiveInteger(entry?.factorId) ||
            !isPositiveInteger(entry?.rank)
        ) ||
        new Set(factorIds).size !== factorIds.length
      ) {
        issues.push(
          createIssue(
            'machine-axis-cultivation-kibo-dna-invalid',
            `${basePath}.kibo.dnaFactors`
          )
        );
      } else {
        actor.kibo.dnaFactors.forEach((factor, factorIndex) => {
          const source = dnaProfileById.get(Number(factor.factorId));
          const factorPath = `${basePath}.kibo.dnaFactors.${factorIndex}`;
          if (!source) {
            issues.push(
              createIssue(
                'machine-axis-cultivation-kibo-dna-factor-unknown',
                `${factorPath}.factorId`,
                { factorId: Number(factor.factorId) }
              )
            );
            return;
          }
          if (Number(factor.rank) !== Number(source.rank)) {
            issues.push(
              createIssue(
                'machine-axis-cultivation-kibo-dna-rank-mismatch',
                `${factorPath}.rank`,
                {
                  factorId: Number(factor.factorId),
                  expected: Number(source.rank),
                  actual: Number(factor.rank),
                }
              )
            );
          }
        });
      }
    }
    validateRange(
      actor.soulEssence?.level,
      catalog.cultivation.soulEssence.level,
      `${basePath}.soulEssence.level`,
      'machine-axis-cultivation-soulessence-level-invalid',
      issues
    );
    validateRange(
      actor.soulEssence?.rank,
      catalog.cultivation.soulEssence.rank,
      `${basePath}.soulEssence.rank`,
      'machine-axis-cultivation-soulessence-rank-invalid',
      issues
    );
    validateRange(
      actor.soulEssence?.star,
      catalog.cultivation.soulEssence.star,
      `${basePath}.soulEssence.star`,
      'machine-axis-cultivation-soulessence-star-invalid',
      issues
    );
    const selectedSoulEssenceId = Number(
      teamSlot?.loadout?.soulessenceId
    );
    const soulEssenceSource = soulEssenceProfileById.get(
      selectedSoulEssenceId
    );
    if (teamSlot && !soulEssenceSource) {
      issues.push(
        createIssue(
          'machine-axis-cultivation-soulessence-source-profile-missing',
          `${basePath}.soulEssence`,
          { soulEssenceId: selectedSoulEssenceId || null }
        )
      );
    } else if (soulEssenceSource) {
      const rankSource = soulEssenceSource.ranks.find(
        row => Number(row.rank) === Number(actor.soulEssence?.rank)
      );
      if (!rankSource) {
        issues.push(
          createIssue(
            'machine-axis-cultivation-soulessence-rank-source-missing',
            `${basePath}.soulEssence.rank`,
            {
              soulEssenceId: selectedSoulEssenceId,
              rank: actor.soulEssence?.rank,
            }
          )
        );
      } else if (
        Number(actor.soulEssence?.level) > Number(rankSource.levelLimit)
      ) {
        issues.push(
          createIssue(
            'machine-axis-cultivation-soulessence-level-exceeds-rank-limit',
            `${basePath}.soulEssence.level`,
            {
              soulEssenceId: selectedSoulEssenceId,
              rank: Number(rankSource.rank),
              maximumLevel: Number(rankSource.levelLimit),
              actualLevel: Number(actor.soulEssence?.level),
            }
          )
        );
      }
      const starSource = soulEssenceSource.effectSkill.starLevels.find(
        row => Number(row.star) === Number(actor.soulEssence?.star)
      );
      if (!starSource) {
        issues.push(
          createIssue(
            'machine-axis-cultivation-soulessence-star-source-missing',
            `${basePath}.soulEssence.star`,
            {
              soulEssenceId: selectedSoulEssenceId,
              star: actor.soulEssence?.star,
            }
          )
        );
      }
    }
    validateEquipment(
      actor.equipment,
      basePath,
      catalog,
      issues,
      teamSlot?.loadout?.equipment
    );
  });
  if (
    teamSlots.size &&
    [...teamSlots].some(slotId => !profileSlots.has(slotId))
  ) {
    issues.push(
      createIssue(
        'machine-axis-cultivation-team-slot-missing',
        'scenario.cultivationProfile.actors'
      )
    );
  }
  return {
    valid: issues.every(issue => issue.severity !== 'error'),
    issues,
  };
}

export function createOptimizationQualificationIssuesForContract(
  contract,
  { catalog = generatedQualificationCatalog } = {}
) {
  const issues = [];
  const qualification = contract?.scenario?.optimizationQualification ?? null;
  const profile = contract?.scenario?.cultivationProfile ?? null;
  if (profile) {
    issues.push(
      ...validateOptimizationCultivationProfile(profile, {
        team: contract.scenario.team,
        catalog,
      }).issues
    );
  }
  if (qualification?.mode !== 'formal') return issues;
  if (qualification.catalogHash !== catalog.catalogHash) {
    issues.push(
      createIssue(
        'machine-axis-optimization-catalog-hash-mismatch',
        'scenario.optimizationQualification.catalogHash',
        {
          expected: catalog.catalogHash,
          actual: qualification.catalogHash ?? null,
        }
      )
    );
  }
  if (!profile) {
    issues.push(
      createIssue(
        'machine-axis-cultivation-profile-required-for-formal-optimization',
        'scenario.cultivationProfile'
      )
    );
  }
  const recordByKey = new Map(
    catalog.records.map(record => [
      `${record.objectKind}:${record.objectId}`,
      record,
    ])
  );
  contract.scenario.team.forEach((slot, index) => {
    const basePath = `scenario.team.${index}`;
    const characterObjectId = [199001, 199002].includes(
      Number(slot.characterId)
    )
      ? 'STARBORN'
      : String(slot.characterId);
    assertQualifiedRecord(
      recordByKey,
      'character',
      characterObjectId,
      `${basePath}.characterId`,
      issues
    );
    const loadout = slot.loadout ?? {};
    if (loadout.kiboId == null) {
      issues.push(
        createIssue(
          'machine-axis-optimization-kibo-required',
          `${basePath}.loadout.kiboId`
        )
      );
    } else {
      assertQualifiedRecord(
        recordByKey,
        'kibo',
        String(loadout.kiboId),
        `${basePath}.loadout.kiboId`,
        issues
      );
    }
    if (loadout.soulessenceId == null) {
      issues.push(
        createIssue(
          'machine-axis-optimization-soulessence-required',
          `${basePath}.loadout.soulessenceId`
        )
      );
    } else {
      assertQualifiedRecord(
        recordByKey,
        'soul-essence',
        String(loadout.soulessenceId),
        `${basePath}.loadout.soulessenceId`,
        issues
      );
    }
    for (const equipmentSlot of EQUIPMENT_SLOTS) {
      const equipmentId = loadout.equipment?.[equipmentSlot];
      if (equipmentId == null) {
        issues.push(
          createIssue(
            'machine-axis-optimization-equipment-required',
            `${basePath}.loadout.equipment.${equipmentSlot}`,
            { equipmentSlot }
          )
        );
      } else {
        assertQualifiedRecord(
          recordByKey,
          'equipment',
          String(equipmentId),
          `${basePath}.loadout.equipment.${equipmentSlot}`,
          issues
        );
      }
    }
  });
  return issues;
}

function findCharacterCultivationSourceProfile(catalog, characterId) {
  const normalizedCharacterId = Number(characterId);
  if (!Number.isInteger(normalizedCharacterId)) return null;
  return (
    catalog?.cultivation?.character?.profiles?.find(
      profile => Number(profile.characterId) === normalizedCharacterId
    ) ?? null
  );
}

function resolveCharacterCultivation(value, sourceProfile) {
  const selectedRank = Number(value.starGiftRank);
  const selectedNodeIds = new Set(value.starGiftNodeIds.map(Number));
  const selectedRanks = sourceProfile.starGiftRanks.filter(
    row => Number(row.rank) <= selectedRank
  );
  const starGiftRankSources = selectedRanks.map(row => ({
    kind: 'star-gift-rank',
    sourceId: `${sourceProfile.characterId}:${row.rank}`,
    rank: Number(row.rank),
    attributes: structuredClone(row.attributes),
    sourceIdentity: row.sourceIdentity,
  }));
  const selectedNodes = selectedRanks.flatMap(row =>
    row.nodes
      .filter(
        node =>
          Number(row.rank) < selectedRank ||
          selectedNodeIds.has(Number(node.runeId))
      )
      .map(node => ({
        ...structuredClone(node),
        rank: Number(row.rank),
        kind: 'star-gift-node',
        sourceId: `${sourceProfile.characterId}:${row.rank}:${node.runeId}`,
        sourceIdentity: [row.sourceIdentity, node.sourceIdentity]
          .filter(Boolean)
          .join('|'),
      }))
  );
  const ascensionSources = sourceProfile.ascensionRanks
    .filter(row => Number(row.ordinal) <= Number(value.ascensionRank))
    .map(row => ({
      ...structuredClone(row),
      kind: 'actor-ascension',
      sourceId: `${sourceProfile.characterId}:${row.ordinal}`,
    }));
  const unappliedSkillSources = [
    ...selectedNodes
      .filter(node => node.skillUpgrade)
      .map(node => ({
        kind: 'star-gift-node-skill-level',
        sourceId: node.sourceId,
        rank: node.rank,
        runeId: node.runeId,
        skillIndex: node.skillUpgrade.skillIndex,
        level: node.skillUpgrade.level,
        reason: 'star-gift-node-skill-level-runtime-unapplied',
        sourceIdentity: node.sourceIdentity,
      })),
    ...ascensionSources
      .filter(row => row.unlockedSkillId)
      .map(row => ({
        kind: 'actor-ascension-skill-unlock',
        sourceId: row.sourceId,
        ordinal: row.ordinal,
        skillId: row.unlockedSkillId,
        reason: 'actor-ascension-skill-unlock-runtime-unapplied',
        sourceIdentity: row.sourceIdentity,
      })),
  ];
  return {
    ...structuredClone(value),
    sourceCharacterId: Number(sourceProfile.characterId),
    staticSources: {
      schemaVersion: 1,
      contractName: 'AzPrOptimizationCharacterStaticSources',
      characterId: Number(sourceProfile.characterId),
      starGiftRankSources,
      starGiftNodeSources: selectedNodes.map(node => ({
        kind: node.kind,
        sourceId: node.sourceId,
        rank: node.rank,
        runeId: node.runeId,
        attributes: structuredClone(node.attributes),
        sourceIdentity: node.sourceIdentity,
      })),
      ascensionSources: ascensionSources.map(row => ({
        kind: row.kind,
        sourceId: row.sourceId,
        ordinal: row.ordinal,
        sourceRank: row.sourceRank,
        levelLimit: row.levelLimit,
        attributes: structuredClone(row.attributes),
        sourceIdentity: row.sourceIdentity,
      })),
      unappliedSkillSources,
    },
  };
}

function resolveSoulEssenceCultivation(value, sourceProfile) {
  const starSource = sourceProfile.effectSkill.starLevels.find(
    row => Number(row.star) === Number(value.star)
  );
  return {
    ...structuredClone(value),
    sourceSoulEssenceId: Number(sourceProfile.soulEssenceId),
    effectSkill: {
      skillId: Number(sourceProfile.effectSkill.skillId),
      star: Number(value.star),
      skillLevel: Number(starSource.skillLevel),
      runtimeStatus: 'dynamic-unapplied',
      sourceIdentity: `${sourceProfile.effectSkill.sourceIdentity}|${starSource.sourceIdentity}`,
    },
  };
}

function validateKiboTalents(value, basePath, catalog, issues) {
  if (!Array.isArray(value) || value.length !== 4) {
    issues.push(
      createIssue(
        'machine-axis-cultivation-kibo-talents-required',
        `${basePath}.kibo.talents`
      )
    );
    return;
  }
  const ids = value.map(entry => Number(entry.attributeId)).sort((a, b) => a - b);
  if (ids.join(',') !== [...KIBO_TALENT_ATTRIBUTE_IDS].sort((a, b) => a - b).join(',')) {
    issues.push(
      createIssue(
        'machine-axis-cultivation-kibo-talent-attributes-invalid',
        `${basePath}.kibo.talents`,
        { expectedAttributeIds: [...KIBO_TALENT_ATTRIBUTE_IDS], actualAttributeIds: ids }
      )
    );
  }
  value.forEach((talent, index) => {
    validateRange(
      talent.level,
      catalog.cultivation.kibo.talentLevel,
      `${basePath}.kibo.talents.${index}.level`,
      'machine-axis-cultivation-kibo-talent-level-invalid',
      issues
    );
  });
}

function validateEquipment(
  value,
  basePath,
  catalog,
  issues,
  selectedEquipment = {}
) {
  if (!isRecord(value)) {
    issues.push(
      createIssue(
        'machine-axis-cultivation-equipment-required',
        `${basePath}.equipment`
      )
    );
    return;
  }
  const equipmentProfiles = new Map(
    (catalog.cultivation.equipment.profiles ?? []).map(profile => [
      Number(profile.equipmentId),
      profile,
    ])
  );
  for (const slot of EQUIPMENT_SLOTS) {
    const item = value[slot];
    const itemPath = `${basePath}.equipment.${slot}`;
    if (!isRecord(item)) {
      issues.push(
        createIssue('machine-axis-cultivation-equipment-slot-required', itemPath, {
          equipmentSlot: slot,
        })
      );
      continue;
    }
    const selectedEquipmentId = Number(selectedEquipment?.[slot]);
    const equipmentProfile = equipmentProfiles.get(selectedEquipmentId);
    if (!equipmentProfile) {
      issues.push(
        createIssue(
          'machine-axis-cultivation-equipment-profile-missing',
          itemPath,
          { equipmentSlot: slot, equipmentId: selectedEquipmentId || null }
        )
      );
    } else {
      if (equipmentProfile.slot !== slot) {
        issues.push(
          createIssue(
            'machine-axis-cultivation-equipment-slot-mismatch',
            itemPath,
            {
              equipmentSlot: slot,
              equipmentId: selectedEquipmentId,
              actualSlot: equipmentProfile.slot,
            }
          )
        );
      }
      if (Number(item.rarity) !== Number(equipmentProfile.rarity)) {
        issues.push(
          createIssue(
            'machine-axis-cultivation-equipment-rarity-mismatch',
            `${itemPath}.rarity`,
            {
              equipmentId: selectedEquipmentId,
              expected: equipmentProfile.rarity,
              actual: item.rarity,
            }
          )
        );
      }
      if (
        Number.isInteger(equipmentProfile.maximumEnhancementLevel) &&
        Number(item.enhancementLevel) >
          Number(equipmentProfile.maximumEnhancementLevel)
      ) {
        issues.push(
          createIssue(
            'machine-axis-cultivation-equipment-enhancement-unsupported',
            `${itemPath}.enhancementLevel`,
            {
              equipmentId: selectedEquipmentId,
              maximum: equipmentProfile.maximumEnhancementLevel,
              actual: item.enhancementLevel,
            }
          )
        );
      }
    }
    validateRange(
      item.rarity,
      catalog.cultivation.equipment.rarity,
      `${itemPath}.rarity`,
      'machine-axis-cultivation-equipment-rarity-invalid',
      issues
    );
    const enhancementRange =
      catalog.cultivation.equipment.enhancementLevelByRarity[
        String(item.rarity)
      ];
    validateRange(
      item.enhancementLevel,
      enhancementRange,
      `${itemPath}.enhancementLevel`,
      'machine-axis-cultivation-equipment-enhancement-invalid',
      issues
    );
    if (!Number.isInteger(item.tuningScore) || item.tuningScore < 0 || item.tuningScore > 110) {
      issues.push(
        createIssue(
          'machine-axis-cultivation-equipment-tuning-score-invalid',
          `${itemPath}.tuningScore`,
          { actual: item.tuningScore }
        )
      );
    }
    if (!['normal', 'starborn'].includes(item.instanceTier)) {
      issues.push(
        createIssue(
          'machine-axis-cultivation-equipment-instance-tier-invalid',
          `${itemPath}.instanceTier`,
          { actual: item.instanceTier }
        )
      );
    }
  }
}

function assertQualifiedRecord(recordByKey, kind, id, path, issues) {
  const record = recordByKey.get(`${kind}:${id}`);
  if (!record) {
    issues.push(
      createIssue('machine-axis-optimization-object-unknown', path, {
        objectKind: kind,
        objectId: id,
      })
    );
    return;
  }
  if (record.optimizationReady !== true) {
    issues.push(
      createIssue('machine-axis-optimization-object-not-qualified', path, {
        objectKind: kind,
        objectId: id,
        maturityState: record.maturityState,
        blockerCodes: record.blockerCodes,
      })
    );
  }
}

function readyIds(catalog, kind) {
  return (catalog?.records ?? [])
    .filter(record => record.objectKind === kind && record.optimizationReady)
    .map(record => record.objectId);
}

function validateRange(value, range, path, code, issues) {
  if (
    !Number.isInteger(value) ||
    !range ||
    value < Number(range.minimum) ||
    value > Number(range.maximum)
  ) {
    issues.push(
      createIssue(code, path, {
        minimum: range?.minimum ?? null,
        maximum: range?.maximum ?? null,
        actual: value ?? null,
      })
    );
  }
}

function createIssue(code, path, details = {}) {
  return {
    severity: 'error',
    code,
    path,
    message: code,
    actionId: null,
    hitIdentity: null,
    relatedActionId: null,
    ...details,
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}
