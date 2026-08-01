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
  const actorRows = profile.actors.map(actor => {
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
      character: structuredClone(actor.character),
      kibo: {
        ...structuredClone(actor.kibo),
        talents: talentRows,
        inheritanceBasisPoints: Number(bondSource.inheritanceBasisPoints),
        inheritanceRatio: Number(bondSource.inheritanceBasisPoints) / 10000,
        bondSourceIdentity: bondSource.sourceIdentity,
      },
      soulEssence: structuredClone(actor.soulEssence),
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
    'kibo.level',
    'kibo.talents',
    'kibo.bondLevel',
    'soulEssence.level',
    'soulEssence.rank',
    'equipment.enhancementLevel',
    'equipment.tuningScore',
  ];
  const unresolvedDimensions = [
    'character.starGiftNodeIds',
    'character.ascensionRank',
    'kibo.dnaFactors',
    'soulEssence.star',
    'equipment.instanceTier',
  ];
  return {
    actorConfigPatch: {
      level: Number(resolvedActor.character.level),
      cultivation: {
        starGiftRank: Number(resolvedActor.character.starGiftRank),
      },
      loadout: {
        soulessenceLevel: Number(resolvedActor.soulEssence.level),
        soulessenceRank: Number(resolvedActor.soulEssence.rank),
        soulessenceStar: Number(resolvedActor.soulEssence.star),
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
  const teamSlots = new Set(team.map(slot => String(slot.slotId)));
  const profileSlots = new Set();
  profile.actors.forEach((actor, actorIndex) => {
    const basePath = `scenario.cultivationProfile.actors.${actorIndex}`;
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
    if (
      !Array.isArray(actor.character?.starGiftNodeIds) ||
      actor.character.starGiftNodeIds.some(value => !isPositiveInteger(value)) ||
      new Set(actor.character.starGiftNodeIds).size !==
        actor.character.starGiftNodeIds.length
    ) {
      issues.push(
        createIssue(
          'machine-axis-cultivation-star-gift-nodes-invalid',
          `${basePath}.character.starGiftNodeIds`
        )
      );
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
    validateEquipment(
      actor.equipment,
      basePath,
      catalog,
      issues,
      team[actorIndex]?.loadout?.equipment
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
