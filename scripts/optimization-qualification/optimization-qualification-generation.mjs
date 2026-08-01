import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

import { hashCanonicalValue } from '../../src/simulation/headless/canonicalSerialization.js';

export const OPTIMIZATION_QUALIFICATION_GENERATED_AT =
  '2026-08-01T00:00:00.000Z';

export const FROZEN_B3_SOURCE_HASHES = Object.freeze({
  characters: '4a73f5e393f7410f5af80a811cac604d97ca6bf74ca8e0be66445ca932fb5052',
  kibos: '1cca2e3d0d1cb5a0a984164ab0c6b05ef0b6c5416b0e9872f0c8ab36394519c4',
  equipment: 'd718604a7b28f84163c175f7f7d0b4d26f891606bb18acf22939e2ef16eaf593',
  soulessences:
    '385dbb96cf0feca4b42c7d3d63040c506c310beeb62ed7f9f37ac68fd012dcbe',
  verifiedMechanics:
    'f38a6c56ad1c7113bd87caa66be27118c0f3fe793e7f0c91e5a76ba80c3cca49',
});

export const FROZEN_B3_DENOMINATORS = Object.freeze({
  characterOptimizationObjects: 11,
  sourceCharacterAliases: 12,
  kibos: 43,
  soulEssences: 62,
  equipment: 137,
  setSkills: 12,
});

const TARGET_ELEMENTS = new Set(['风', '雷']);
const STARBORN_SOURCE_CHARACTER_IDS = Object.freeze([199001, 199002]);
const EQUIPMENT_SLOT_BY_TYPE = Object.freeze({
  1: 'weapon',
  2: 'top',
  3: 'bottom',
  4: 'earring',
  5: 'ring',
});
const CULTIVATION_SOURCE_FILES = Object.freeze([
  'accessory.json',
  'accessory_main.json',
  'accessory_customed.json',
  'accessory_level.json',
  'accessory_set.json',
  'accessory_sub_parameter.json',
  'game.json',
  'hero_break.json',
  'hero_rank.json',
  'pet_talent_upgrade.json',
  'pet_favorability.json',
  'soulessence.json',
  'soulessence_rank.json',
  'soulessence_value.json',
  'talent_rank.json',
  'talent_rune.json',
]);

export async function createOptimizationQualificationArtifacts({
  projectRoot,
  newTableRoot =
    'C:/PC2/Codex/AzPr/Assets/ResourcesAssets/Config/NewTable',
} = {}) {
  if (!projectRoot) throw new TypeError('projectRoot is required');
  const generatedRoot = path.join(projectRoot, 'src', 'data', 'generated');
  const sourceDefinitions = {
    characters: path.join(generatedRoot, 'characters.json'),
    kibos: path.join(generatedRoot, 'kibos.json'),
    equipment: path.join(generatedRoot, 'equipment.json'),
    soulessences: path.join(generatedRoot, 'soulessences.json'),
    verifiedMechanics: path.join(
      generatedRoot,
      'verified-combat-mechanics-package.json'
    ),
    characterAcceptance: path.join(
      generatedRoot,
      'character-acceptance-catalog.json'
    ),
    kiboPassives: path.join(
      generatedRoot,
      'kibo-passive-mechanics.json'
    ),
    kiboMaturity: path.join(
      projectRoot,
      'reports',
      'kibo-headless',
      'kibo-maturity-matrix.json'
    ),
  };
  const sources = {};
  for (const [key, sourcePath] of Object.entries(sourceDefinitions)) {
    sources[key] = await readSource(sourcePath, projectRoot);
  }
  for (const fileName of CULTIVATION_SOURCE_FILES) {
    sources[`newTable:${fileName}`] = await readSource(
      path.join(newTableRoot, fileName),
      projectRoot
    );
  }
  assertFrozenSourceHashes(sources);

  const characters = sources.characters.value.items ?? [];
  const kibos = sources.kibos.value.items ?? [];
  const equipment = sources.equipment.value.items ?? [];
  const soulEssences = sources.soulessences.value.items ?? [];
  const mechanics = sources.verifiedMechanics.value;
  const staticCatalog = mechanics.staticPropertyCatalog ?? {};
  const publicEquipmentIds = new Set(equipment.map(row => Number(row.id)));
  const publicKiboIds = new Set(
    (sources.kiboMaturity.value.rows ?? []).map(row => Number(row.kiboId))
  );

  const targetCharacters = characters
    .filter(character => hasTargetElement(character.element?.abbrName))
    .sort(sortByNumericId);
  const starbornAliases = STARBORN_SOURCE_CHARACTER_IDS.map(characterId =>
    requireById(characters, characterId, 'STARBORN source character')
  );
  const starbornProjections = starbornAliases.map(projectStarbornMechanics);
  const starbornMechanismHashes = starbornProjections.map(hashCanonicalValue);
  if (new Set(starbornMechanismHashes).size !== 1) {
    throw new Error(
      `optimization-qualification-starborn-mechanism-drift:${starbornMechanismHashes.join(',')}`
    );
  }

  const characterObjects = [
    ...targetCharacters.map(character =>
      projectCharacterOptimizationObject(character)
    ),
    {
      optimizationObjectId: 'STARBORN',
      displayName: '星临者',
      sourceCharacterIds: [...STARBORN_SOURCE_CHARACTER_IDS],
      sourceNames: starbornAliases.map(character => character.name),
      elements: ['无'],
      position: starbornAliases[0].position?.name ?? null,
      weaponType: starbornAliases[0].weaponType?.name ?? null,
      mechanismHash: starbornMechanismHashes[0],
      aliasMechanismHashes: Object.fromEntries(
        STARBORN_SOURCE_CHARACTER_IDS.map((characterId, index) => [
          characterId,
          starbornMechanismHashes[index],
        ])
      ),
      sourceIdentity:
        'generated/characters.json#items[id=199001|199002]:normalized-mechanics',
    },
  ];
  const targetKibos = kibos
    .filter(kibo => publicKiboIds.has(Number(kibo.id)))
    .filter(kibo => hasTargetElement(kibo.element))
    .sort(sortByNumericId)
    .map(projectKiboRosterRecord);
  const soulEssenceProfilesById = new Map(
    (staticCatalog.soulessences ?? []).map(profile => [
      Number(profile.soulessenceId),
      profile,
    ])
  );
  const publicSoulEssences = soulEssences
    .slice()
    .sort(sortByNumericId)
    .map(item =>
      projectSoulEssenceRosterRecord(
        item,
        soulEssenceProfilesById.get(Number(item.id)) ?? null
      )
    );
  const equipmentProfilesById = new Map(
    (staticCatalog.equipment ?? []).map(profile => [
      Number(profile.equipmentId),
      profile,
    ])
  );
  const publicEquipment = equipment
    .slice()
    .sort(sortByNumericId)
    .map(item =>
      projectEquipmentRosterRecord(
        item,
        equipmentProfilesById.get(Number(item.id)) ?? null
      )
    );
  const setSkills = (staticCatalog.accessorySets ?? [])
    .slice()
    .sort((left, right) =>
      Number(left.setId) - Number(right.setId) ||
      Number(left.pieces) - Number(right.pieces)
    )
    .map(projectSetSkillRosterRecord);

  const denominators = {
    characterOptimizationObjects: characterObjects.length,
    sourceCharacterAliases:
      targetCharacters.length + STARBORN_SOURCE_CHARACTER_IDS.length,
    kibos: targetKibos.length,
    soulEssences: publicSoulEssences.length,
    equipment: publicEquipment.length,
    setSkills: setSkills.length,
  };
  assertDenominators(denominators);
  if (
    publicEquipment.some(record => !publicEquipmentIds.has(record.equipmentId))
  ) {
    throw new Error('optimization-qualification-public-equipment-subset-drift');
  }

  const cultivationCatalog = createCultivationCatalog({
    sources,
    characterObjects,
    targetKibos,
    publicSoulEssences,
    publicEquipment,
  });
  const manifests = createQualificationManifests({
    characterObjects,
    targetKibos,
    publicSoulEssences,
    publicEquipment,
    setSkills,
    staticCatalog,
    characterAcceptance: sources.characterAcceptance.value,
    kiboPassives: sources.kiboPassives.value,
    kiboMaturity: sources.kiboMaturity.value,
  });
  const bindingMatrix = createBindingMatrix({
    characterObjects,
    targetKibos,
    publicSoulEssences,
    publicEquipment,
    manifests,
  });
  const sourceSnapshot = createSourceSnapshot(sources);
  const roster = finalizeHash(
    {
      schemaVersion: 1,
      contractName: 'AzPrOptimizationQualificationRoster',
      kind: 'azpr-optimization-qualification-roster',
      generatedAt: OPTIMIZATION_QUALIFICATION_GENERATED_AT,
      phase: 'M12-B3-A',
      sourceSnapshot,
      filterContract: {
        characterElements: ['风', '雷'],
        characterElementField: 'characters.items[].element.abbrName',
        kiboElements: ['风', '雷'],
        kiboElementField: 'kibos.items[].element',
        discreteTagDelimiter: '、',
        kiboPublicDenominator:
          'reports/kibo-headless/kibo-maturity-matrix.json#rows',
        starbornOptimizationObject: 'STARBORN',
        starbornSourceCharacterIds: [...STARBORN_SOURCE_CHARACTER_IDS],
      },
      denominators,
      characters: characterObjects,
      kibos: targetKibos,
      soulEssences: publicSoulEssences,
      equipment: publicEquipment,
      setSkills,
      starborn: {
        optimizationObjectId: 'STARBORN',
        sourceCharacterIds: [...STARBORN_SOURCE_CHARACTER_IDS],
        normalizedMechanismHash: starbornMechanismHashes[0],
        aliasHashesEqual: new Set(starbornMechanismHashes).size === 1,
        projection: starbornProjections[0],
      },
    },
    'rosterHash'
  );
  const manifestDocument = finalizeHash(
    {
      schemaVersion: 1,
      contractName: 'AzPrOptimizationQualificationManifests',
      kind: 'azpr-optimization-qualification-manifests',
      generatedAt: OPTIMIZATION_QUALIFICATION_GENERATED_AT,
      rosterHash: roster.rosterHash,
      records: manifests,
      summary: summarizeManifests(manifests),
    },
    'manifestsHash'
  );
  const bindingDocument = finalizeHash(
    {
      schemaVersion: 1,
      contractName: 'AzPrOptimizationQualificationBindingMatrix',
      kind: 'azpr-optimization-qualification-binding-matrix',
      generatedAt: OPTIMIZATION_QUALIFICATION_GENERATED_AT,
      rosterHash: roster.rosterHash,
      ...bindingMatrix,
    },
    'bindingMatrixHash'
  );
  const gaps = createGapLedger(manifests);
  const implementationCapabilities = createImplementationCapabilities({
    roster,
    cultivationCatalog,
    bindingDocument,
  });
  const gapDocument = finalizeHash(
    {
      schemaVersion: 1,
      contractName: 'AzPrOptimizationQualificationGapLedger',
      kind: 'azpr-optimization-qualification-gap-ledger',
      generatedAt: OPTIMIZATION_QUALIFICATION_GENERATED_AT,
      rosterHash: roster.rosterHash,
      implementedCapabilities: implementationCapabilities,
      records: gaps,
      summary: summarizeGaps(gaps),
    },
    'ledgerHash'
  );
  const catalog = createQualificationCatalog({
    roster,
    manifestDocument,
    gapDocument,
    bindingDocument,
    cultivationCatalog,
  });
  const summary = createSummary({
    roster,
    manifestDocument,
    gapDocument,
    bindingDocument,
    catalog,
  });
  return {
    roster,
    manifests: manifestDocument,
    gaps: gapDocument,
    bindingMatrix: bindingDocument,
    catalog,
    summary,
    markdown: createMarkdownSummary(summary, catalog),
  };
}

function createQualificationManifests({
  characterObjects,
  targetKibos,
  publicSoulEssences,
  publicEquipment,
  setSkills,
  staticCatalog,
  characterAcceptance,
  kiboPassives,
  kiboMaturity,
}) {
  const actorStaticIds = new Set(
    (staticCatalog.actor?.profiles ?? []).map(profile =>
      Number(profile.characterId)
    )
  );
  const characterAcceptanceById = new Map(
    (characterAcceptance.entries ?? []).map(entry => [
      Number(entry.ownerId),
      entry,
    ])
  );
  const kiboMaturityById = new Map(
    (kiboMaturity.rows ?? []).map(row => [Number(row.kiboId), row])
  );
  const unresolvedPassiveByKiboId = new Map();
  for (const unresolved of kiboPassives.unresolved ?? []) {
    for (const kiboId of unresolved.kiboIds ?? []) {
      unresolvedPassiveByKiboId.set(Number(kiboId), unresolved);
    }
  }
  const records = [];
  for (const actor of characterObjects) {
    const sourceIds = actor.sourceCharacterIds.map(Number);
    const acceptanceEntries = sourceIds
      .map(characterId => characterAcceptanceById.get(characterId))
      .filter(Boolean);
    const blockers = [];
    if (!sourceIds.every(characterId => actorStaticIds.has(characterId))) {
      blockers.push(
        blocker(
          'actor-static-profile-missing',
          'not-implemented',
          'Verified static actor profile is missing for at least one source identity.'
        )
      );
    }
    if (acceptanceEntries.length !== sourceIds.length) {
      blockers.push(
        blocker(
          'character-acceptance-not-published',
          'not-implemented',
          'No published M11-D acceptance manifest covers every source identity.'
        )
      );
    }
    if (
      acceptanceEntries.length !== sourceIds.length ||
      acceptanceEntries.some(entry => entry.optimizationReady !== true)
    ) {
      blockers.push(
        blocker(
          'character-not-optimization-ready',
          'not-implemented',
          'Character acceptance maturity has not reached optimization-ready.'
        )
      );
    }
    blockers.push(
      blocker(
        'strict-character-cultivation-runtime-partial',
        'not-implemented',
        'Level and star-gift rank are applied; selected star-gift nodes and ascension inputs remain unapplied.'
      )
    );
    records.push(
      qualificationRecord({
        objectKind: 'character',
        objectId: actor.optimizationObjectId,
        displayName: actor.displayName,
        sourceIdentities: sourceIds.map(
          id => `generated/characters.json#items[id=${id}]`
        ),
        maturityState:
          acceptanceEntries.length === sourceIds.length
            ? 'runtime-integrated'
            : 'extracted',
        blockers,
        evidence: {
          sourceCharacterIds: sourceIds,
          mechanismHash: actor.mechanismHash,
          characterAcceptanceManifestHashes: acceptanceEntries.map(
            entry => entry.manifestHash
          ),
        },
      })
    );
  }
  for (const kibo of targetKibos) {
    const maturity = kiboMaturityById.get(kibo.kiboId);
    const unresolvedPassive = unresolvedPassiveByKiboId.get(kibo.kiboId);
    const blockers = [
      blocker(
        'kibo-visual-acceptance-not-published',
        'not-implemented',
        'No product visual acceptance manifest exists for this Kibo.'
      ),
      blocker(
        'strict-kibo-cultivation-runtime-partial',
        'not-implemented',
        'Kibo level, four talent values, and bond inheritance are applied; DNA factors remain unapplied.'
      ),
      blocker(
        'kibo-dna-factor-catalog-unavailable',
        'evidence-insufficient',
        'The current generated source does not expose a complete DNA factor identity and interaction catalog.'
      ),
    ];
    if (!maturity || maturity.machineOptimizationReady !== true) {
      blockers.push(
        blocker(
          'kibo-headless-maturity-not-ready',
          'not-implemented',
          'Kibo headless maturity has not reached machine optimization ready.'
        )
      );
    }
    if (unresolvedPassive) {
      blockers.push(
        blocker(
          'kibo-passive-static-evidence-gap',
          'evidence-insufficient',
          (unresolvedPassive.reasons ?? []).join('|') ||
            'Kibo passive evidence remains unresolved.',
          { skillId: unresolvedPassive.skillId }
        )
      );
    }
    records.push(
      qualificationRecord({
        objectKind: 'kibo',
        objectId: String(kibo.kiboId),
        displayName: kibo.name,
        sourceIdentities: [
          `generated/kibos.json#items[id=${kibo.kiboId}]`,
          `reports/kibo-headless/kibo-maturity-matrix.json#rows[kiboId=${kibo.kiboId}]`,
        ],
        maturityState:
          maturity?.actions &&
          Object.values(maturity.actions).every(action => action?.runnable)
            ? 'runtime-integrated'
            : 'extracted',
        blockers,
        evidence: {
          kiboId: kibo.kiboId,
          actionCount: kibo.actionCount,
          passiveSkillId: unresolvedPassive?.skillId ?? null,
          headlessRuntimeReady: maturity?.machineOptimizationReady === true,
        },
      })
    );
  }
  for (const soul of publicSoulEssences) {
    const blockers = [
      blocker(
        'soulessence-effect-skill-dynamic-unapplied',
        'not-implemented',
        'The soul essence effect skill is tracked but not applied by the dynamic runtime.',
        { skillId: soul.effectSkillId }
      ),
      blocker(
        'strict-soulessence-cultivation-runtime-partial',
        'not-implemented',
        'Soul essence level and rank are applied; star-driven dynamic skill levels remain unapplied.'
      ),
      blocker(
        'soulessence-visual-acceptance-not-published',
        'not-implemented',
        'No product visual acceptance manifest exists for this soul essence.'
      ),
    ];
    records.push(
      qualificationRecord({
        objectKind: 'soul-essence',
        objectId: String(soul.soulEssenceId),
        displayName: soul.name,
        sourceIdentities: [
          `generated/soulessences.json#items[id=${soul.soulEssenceId}]`,
          soul.sourceIdentity,
        ].filter(Boolean),
        maturityState: 'extracted',
        blockers,
        evidence: soul,
      })
    );
  }
  for (const item of publicEquipment) {
    const blockers = [
      blocker(
        'strict-equipment-cultivation-runtime-partial',
        'not-implemented',
        'Equipment enhancement and source-backed tuning formula are applied; instance-tier legality remains evidence-blocked.'
      ),
      blocker(
        'equipment-instance-tier-source-evidence-missing',
        'evidence-insufficient',
        'The current source snapshot does not contain bGoldSide/maxValue instance evidence required to distinguish normal and starborn tuning caps.'
      ),
      blocker(
        'equipment-visual-acceptance-not-published',
        'not-implemented',
        'No product visual acceptance manifest exists for this equipment instance contract.'
      ),
    ];
    if (!item.staticProfileApplied) {
      blockers.push(
        blocker(
          'equipment-static-profile-missing',
          'not-implemented',
          'No verified static equipment profile is available.'
        )
      );
    }
    records.push(
      qualificationRecord({
        objectKind: 'equipment',
        objectId: String(item.equipmentId),
        displayName: item.name,
        sourceIdentities: [
          `generated/equipment.json#items[id=${item.equipmentId}]`,
          item.sourceIdentity,
        ].filter(Boolean),
        maturityState: 'extracted',
        blockers,
        evidence: item,
      })
    );
  }
  for (const setSkill of setSkills) {
    records.push(
      qualificationRecord({
        objectKind: 'set-skill',
        objectId: `${setSkill.setId}:${setSkill.pieces}`,
        displayName: `套装 ${setSkill.setId} ${setSkill.pieces}件`,
        sourceIdentities: [setSkill.sourceIdentity],
        maturityState: 'extracted',
        blockers: [
          blocker(
            'set-skill-dynamic-unapplied',
            'not-implemented',
            'The accessory set skill is tracked but not applied by the dynamic runtime.',
            { skillId: setSkill.skillId }
          ),
          blocker(
            'set-skill-visual-acceptance-not-published',
            'not-implemented',
            'No product visual acceptance manifest exists for this set skill.'
          ),
        ],
        evidence: setSkill,
      })
    );
  }
  return records.sort(compareQualificationRecords);
}

function createCultivationCatalog({
  sources,
  characterObjects,
  targetKibos,
  publicSoulEssences,
  publicEquipment,
}) {
  const talentRows = sources['newTable:pet_talent_upgrade.json'].value.rows;
  const favorabilityRows =
    sources['newTable:pet_favorability.json'].value.rows;
  const talentValues = Object.fromEntries(
    [1, 3, 4, 5].map(attributeId => [
      attributeId,
      talentRows
        .filter(row => Number(row.attrId) === attributeId)
        .sort((left, right) => Number(left.level) - Number(right.level))
        .map(row => ({
          level: Number(row.level),
          value: Number(row.InterA),
          nextValue: Number(row.InterB),
          sourceIdentity: `NewTable/pet_talent_upgrade.rows[id=${row.id}]`,
        })),
    ])
  );
  const bondLevels = favorabilityRows
    .slice()
    .sort((left, right) => Number(left.level) - Number(right.level))
    .map(row => ({
      level: Number(row.level),
      inheritanceBasisPoints: Number(row.levelEffect),
      sourceIdentity: `NewTable/pet_favorability.rows[level=${row.level}]`,
    }));
  const equipmentBySlot = Object.fromEntries(
    Object.values(EQUIPMENT_SLOT_BY_TYPE).map(slot => [
      slot,
      publicEquipment
        .filter(item => item.slot === slot)
        .map(item => item.equipmentId),
    ])
  );
  const equipmentScoreFormula =
    sources['newTable:game.json'].value.rows.find(
      row => row.title === 'EQUIPMENT_SCORE_FORMULA_PARAM'
    );
  const equipmentScoreFormulaParameters = String(
    equipmentScoreFormula?.value ?? ''
  )
    .split('|')
    .filter(Boolean)
    .map(Number);
  return {
    schemaVersion: 1,
    contractName: 'AzPrOptimizationCultivationCatalog',
    character: {
      optimizationObjectIds: characterObjects.map(
        item => item.optimizationObjectId
      ),
      level: { minimum: 1, maximum: 100 },
      starGiftRank: { minimum: 0, maximum: 7 },
      ascensionRank: { minimum: 0, maximum: 6 },
      starGiftNodes: {
        status: 'source-indexed-runtime-application-incomplete',
        sourceIdentity: 'NewTable/talent_rank|NewTable/talent_rune',
      },
    },
    kibo: {
      kiboIds: targetKibos.map(item => item.kiboId),
      level: { minimum: 1, maximum: 100 },
      coreTalentAttributeIds: [1, 3, 4, 5],
      talentLevel: { minimum: 1, maximum: 20 },
      talentValues,
      dnaFactors: {
        status: 'evidence-insufficient',
        sourceIdentity: null,
      },
      bondLevel: { minimum: 1, maximum: 10 },
      bondLevels,
      initialEffectiveBondLevel: 1,
      initialInheritanceBasisPoints: 900,
    },
    soulEssence: {
      soulEssenceIds: publicSoulEssences.map(item => item.soulEssenceId),
      level: { minimum: 1, maximum: 100 },
      rank: { minimum: 1, maximum: 6 },
      star: { minimum: 1, maximum: 5 },
      effectStatus: 'dynamic-unapplied',
    },
    equipment: {
      equipmentIdsBySlot: equipmentBySlot,
      profiles: publicEquipment.map(item => ({
        equipmentId: item.equipmentId,
        slot: item.slot,
        rarity: item.rarity,
        maximumEnhancementLevel: item.maximumLevel,
        sourceIdentity: item.sourceIdentity,
      })),
      rarity: { minimum: 1, maximum: 4 },
      enhancementLevelByRarity: {
        1: { minimum: 0, maximum: 0 },
        2: { minimum: 0, maximum: 3 },
        3: { minimum: 0, maximum: 6 },
        4: { minimum: 0, maximum: 9 },
      },
      tuningScore: {
        minimum: 0,
        maximumFromCurrentTable: 80,
        ordinaryMaximum: null,
        starbornMaximum: null,
        status: 'instance-tier-source-evidence-missing',
        sourceIdentity:
          'NewTable/accessory_customed.score|scoreLimit; bGoldSide/maxValue absent from current snapshot',
      },
      tuningFormula: {
        status:
          equipmentScoreFormulaParameters.length === 4 &&
          equipmentScoreFormulaParameters.every(Number.isFinite)
            ? 'source-indexed-static-runtime-applied'
            : 'evidence-insufficient',
        parameters: equipmentScoreFormulaParameters,
        expression:
          'ceil(base*0.85)+ceil(base*0.6*0.0125*(tuningScore-20))',
        sourceIdentity:
          'NewTable/game.rows[title=EQUIPMENT_SCORE_FORMULA_PARAM]',
      },
      instanceTiers: ['normal', 'starborn'],
    },
  };
}

function createBindingMatrix({
  characterObjects,
  targetKibos,
  publicSoulEssences,
  publicEquipment,
  manifests,
}) {
  const manifestByKey = new Map(
    manifests.map(record => [
      `${record.objectKind}:${record.objectId}`,
      record,
    ])
  );
  const actorKibo = characterObjects.flatMap(actor =>
    targetKibos.map(kibo => ({
      actorObjectId: String(actor.optimizationObjectId),
      kiboId: kibo.kiboId,
      compatible: true,
      qualificationReady:
        manifestByKey.get(`character:${actor.optimizationObjectId}`)
          ?.optimizationReady === true &&
        manifestByKey.get(`kibo:${kibo.kiboId}`)?.optimizationReady === true,
      runtimeOwnerIdentity: 'actorSlotId+kiboId',
    }))
  );
  const actorSoulEssence = characterObjects.flatMap(actor =>
    publicSoulEssences.map(soul => {
      const compatible =
        !soul.profession || soul.profession === actor.position;
      return {
        actorObjectId: String(actor.optimizationObjectId),
        soulEssenceId: soul.soulEssenceId,
        compatible,
        reason: compatible
          ? soul.profession
            ? 'profession-match'
            : 'universal-profession'
          : 'profession-mismatch',
        qualificationReady:
          compatible &&
          manifestByKey.get(`character:${actor.optimizationObjectId}`)
            ?.optimizationReady === true &&
          manifestByKey.get(`soul-essence:${soul.soulEssenceId}`)
            ?.optimizationReady === true,
      };
    })
  );
  return {
    policy: {
      duplicateKiboSpeciesAcrossDifferentActors: 'allowed',
      sameActorSlotDuplicateKiboBinding: 'not-applicable-one-kibo-per-slot',
      kiboCooldownOwnerIdentity: 'actorSlotId+kiboId',
      sourceIdentity: 'product-contract:m11-r1-duplicate-kibo-slot-runtime',
    },
    actorKibo,
    actorSoulEssence,
    equipmentSlots: Object.fromEntries(
      Object.values(EQUIPMENT_SLOT_BY_TYPE).map(slot => [
        slot,
        publicEquipment
          .filter(item => item.slot === slot)
          .map(item => item.equipmentId),
      ])
    ),
    summary: {
      actorKiboEdgeCount: actorKibo.length,
      actorKiboQualifiedEdgeCount: actorKibo.filter(
        edge => edge.qualificationReady
      ).length,
      actorSoulEssenceEdgeCount: actorSoulEssence.length,
      actorSoulEssenceCompatibleEdgeCount: actorSoulEssence.filter(
        edge => edge.compatible
      ).length,
      actorSoulEssenceQualifiedEdgeCount: actorSoulEssence.filter(
        edge => edge.qualificationReady
      ).length,
      equipmentSlotCount: Object.keys(EQUIPMENT_SLOT_BY_TYPE).length,
    },
  };
}

function createQualificationCatalog({
  roster,
  manifestDocument,
  gapDocument,
  bindingDocument,
  cultivationCatalog,
}) {
  const records = manifestDocument.records.map(record => ({
    objectKind: record.objectKind,
    objectId: record.objectId,
    displayName: record.displayName,
    maturityState: record.maturityState,
    optimizationReady: record.optimizationReady,
    blockerCodes: record.blockers.map(item => item.code),
    manifestHash: record.manifestHash,
  }));
  const value = {
    schemaVersion: 1,
    contractName: 'AzPrOptimizationQualificationCatalog',
    kind: 'azpr-optimization-qualification-catalog',
    generatedAt: OPTIMIZATION_QUALIFICATION_GENERATED_AT,
    rosterHash: roster.rosterHash,
    manifestsHash: manifestDocument.manifestsHash,
    gapLedgerHash: gapDocument.ledgerHash,
    bindingMatrixHash: bindingDocument.bindingMatrixHash,
    sourceSnapshotHash: roster.sourceSnapshot.sourceSnapshotHash,
    denominators: roster.denominators,
    records,
    admission: {
      characters: records
        .filter(
          record =>
            record.objectKind === 'character' && record.optimizationReady
        )
        .map(record => record.objectId),
      kibos: records
        .filter(
          record => record.objectKind === 'kibo' && record.optimizationReady
        )
        .map(record => Number(record.objectId)),
      soulEssences: records
        .filter(
          record =>
            record.objectKind === 'soul-essence' && record.optimizationReady
        )
        .map(record => Number(record.objectId)),
      equipment: records
        .filter(
          record =>
            record.objectKind === 'equipment' && record.optimizationReady
        )
        .map(record => Number(record.objectId)),
      setSkills: records
        .filter(
          record =>
            record.objectKind === 'set-skill' && record.optimizationReady
        )
        .map(record => record.objectId),
    },
    cultivation: cultivationCatalog,
    summary: {
      ...manifestDocument.summary,
      gameplayBlockingGapCount: gapDocument.summary.blockingUniqueGapCount,
      bindingQualifiedEdgeCount:
        bindingDocument.summary.actorKiboQualifiedEdgeCount +
        bindingDocument.summary.actorSoulEssenceQualifiedEdgeCount,
      formalOptimizationUnlocked: false,
      m12cLocked: true,
    },
  };
  return finalizeHash(value, 'catalogHash');
}

function createSummary({
  roster,
  manifestDocument,
  gapDocument,
  bindingDocument,
  catalog,
}) {
  return {
    phase: 'M12-B3-A',
    status: 'checkpoint-ready-qualification-blocked',
    denominators: roster.denominators,
    sourceSnapshotHash: roster.sourceSnapshot.sourceSnapshotHash,
    rosterHash: roster.rosterHash,
    manifestsHash: manifestDocument.manifestsHash,
    ledgerHash: gapDocument.ledgerHash,
    bindingMatrixHash: bindingDocument.bindingMatrixHash,
    catalogHash: catalog.catalogHash,
    maturityCounts: manifestDocument.summary.maturityCounts,
    optimizationReadyCounts: manifestDocument.summary.optimizationReadyCounts,
    gapCounts: gapDocument.summary,
    m12cLocked: true,
  };
}

function projectCharacterOptimizationObject(character) {
  return {
    optimizationObjectId: String(character.id),
    displayName: character.name,
    sourceCharacterIds: [Number(character.id)],
    sourceNames: [character.name],
    elements: splitTags(character.element?.abbrName),
    position: character.position?.name ?? null,
    weaponType: character.weaponType?.name ?? null,
    mechanismHash: hashCanonicalValue(projectCharacterSourceMechanics(character)),
    sourceIdentity: `generated/characters.json#items[id=${character.id}]`,
  };
}

function projectCharacterSourceMechanics(character) {
  return {
    rarity: character.rarity,
    position: character.position,
    element: character.element,
    weaponType: character.weaponType,
    battleTags: character.battleTags,
    cost: character.cost,
    baseAttributes: character.property?.baseAttributes ?? [],
    skillSlots: (character.skillSlots ?? []).map(slot => ({
      group: slot.group,
      slot: slot.slot,
      skillId: Number(slot.skillId),
    })),
  };
}

function projectStarbornMechanics(character) {
  const ownerPrefix = Number(character.id) * 100;
  const normalizeSkillId = skillId => {
    const numericSkillId = Number(skillId);
    return Math.trunc(numericSkillId / 100) === Number(character.id)
      ? { ownerSkillSuffix: numericSkillId - ownerPrefix }
      : { sharedSkillId: numericSkillId };
  };
  return {
    rarity: character.rarity,
    position: character.position,
    element: character.element,
    weaponType: character.weaponType,
    battleTags: character.battleTags,
    cost: character.cost,
    baseAttributes: character.property?.baseAttributes ?? [],
    skillIds: (character.skillIds ?? []).map(normalizeSkillId),
    skillSlots: (character.skillSlots ?? []).map(slot => ({
      group: slot.group,
      slot: slot.slot,
      skillIdentity: normalizeSkillId(slot.skillId),
    })),
  };
}

function projectKiboRosterRecord(kibo) {
  const actions = (kibo.skills ?? []).filter(skill =>
    ['signature', 'active', 'break'].includes(skill.kind)
  );
  return {
    kiboId: Number(kibo.id),
    name: kibo.name,
    elements: splitTags(kibo.element),
    elementClass: splitTags(kibo.element).length === 1 ? 'single' : 'dual',
    race: kibo.race ?? null,
    stage: kibo.stage ?? null,
    actionCount: actions.length,
    actions: actions.map(action => ({
      publicActionId: Number(action.skillId),
      actionKind: action.kind,
      name: action.name ?? null,
    })),
    pvePassiveSkillIds: (kibo.sourceSkills?.fixedSkillIds ?? []).filter(
      skillId => Number(skillId) >= 520000 && Number(skillId) < 530000
    ),
    sourceIdentity: `generated/kibos.json#items[id=${kibo.id}]`,
  };
}

function projectSoulEssenceRosterRecord(item, profile) {
  return {
    soulEssenceId: Number(item.id),
    name: item.name,
    rarity: item.rarity ?? null,
    profession: item.profession ?? null,
    effectSkillName: item.skill?.name ?? null,
    maximumLevel: profile?.maximumLevel ?? null,
    maximumRank: profile?.maximumRank ?? null,
    staticProfileApplied: profile?.applied === true,
    effectSkillId: profile?.effectSkill?.skillId ?? null,
    effectStatus: profile?.effectSkill?.status ?? 'profile-missing',
    sourceIdentity: profile?.sourceIdentity ?? null,
  };
}

function projectEquipmentRosterRecord(item, profile) {
  const slot = slotFromEquipmentType(item.type, profile?.slotType);
  return {
    equipmentId: Number(item.id),
    name: item.name,
    slot,
    rarity: parseRarity(item.rarity),
    setName: item.set || null,
    setId: profile?.setId ?? null,
    maximumLevel: profile?.maximumLevel ?? null,
    fixedSubAttributeCount: (profile?.subAttributes ?? []).filter(
      attribute => attribute.status === 'verified-fixed-sub-attribute'
    ).length,
    variableSubAttributeCount: (profile?.subAttributes ?? []).filter(
      attribute => attribute.minimum !== attribute.maximum
    ).length,
    staticProfileApplied: profile?.applied === true,
    sourceIdentity: profile?.sourceIdentity ?? null,
  };
}

function projectSetSkillRosterRecord(record) {
  return {
    setId: Number(record.setId),
    pieces: Number(record.pieces),
    skillId: Number(record.skillId),
    status: record.status,
    appliedToStaticPanel: record.appliedToStaticPanel === true,
    sourceIdentity: record.sourceIdentity,
  };
}

function qualificationRecord({
  objectKind,
  objectId,
  displayName,
  sourceIdentities,
  maturityState,
  blockers,
  evidence,
}) {
  const value = {
    objectKind,
    objectId: String(objectId),
    displayName,
    sourceIdentities,
    maturityState,
    optimizationReady: blockers.length === 0 && maturityState === 'optimization-ready',
    blockers,
    evidence,
  };
  return { ...value, manifestHash: hashCanonicalValue(value) };
}

function blocker(code, category, message, details = {}) {
  return { code, category, message, ...details };
}

function createGapLedger(manifests) {
  return manifests.flatMap(manifest =>
    manifest.blockers.map(item => {
      const value = {
        gapIdentity: `${manifest.objectKind}:${manifest.objectId}:${item.code}`,
        objectKind: manifest.objectKind,
        objectId: manifest.objectId,
        code: item.code,
        category: item.category,
        blocking: true,
        message: item.message,
        sourceIdentities: manifest.sourceIdentities,
        details: Object.fromEntries(
          Object.entries(item).filter(
            ([key]) => !['code', 'category', 'message'].includes(key)
          )
        ),
      };
      return { ...value, gapHash: hashCanonicalValue(value) };
    })
  );
}

function createImplementationCapabilities({
  roster,
  cultivationCatalog,
  bindingDocument,
}) {
  return [
    {
      capabilityIdentity: 'b3-frozen-roster-and-source-drift-gate',
      status: 'implemented',
      evidence: [roster.sourceSnapshot.sourceSnapshotHash, roster.rosterHash],
    },
    {
      capabilityIdentity: 'b3-starborn-single-object-alias-normalization',
      status: 'implemented',
      evidence: [roster.starborn.normalizedMechanismHash],
    },
    {
      capabilityIdentity: 'b3-strict-cultivation-schema-and-canonical-hash',
      status: 'implemented',
      evidence: [
        'schemas/azpr-optimization-cultivation-profile-v1.schema.json',
      ],
    },
    {
      capabilityIdentity: 'b3-supported-cultivation-static-runtime-projection',
      status: 'implemented',
      evidence: [
        'src/optimization-qualification/optimizationQualificationProtocol.js',
        'src/simulation/mechanics/verifiedCombatStaticProperties.js',
      ],
    },
    {
      capabilityIdentity: 'b3-kibo-four-talent-source-mapping',
      status: 'implemented',
      evidence: [
        cultivationCatalog.kibo.talentValues['1'].find(
          row => row.level === 10
        ).sourceIdentity,
      ],
    },
    {
      capabilityIdentity: 'b3-kibo-bond-level-one-nine-percent',
      status: 'implemented',
      evidence: [cultivationCatalog.kibo.bondLevels[0].sourceIdentity],
    },
    {
      capabilityIdentity: 'b3-equipment-tuning-formula-source-index',
      status:
        cultivationCatalog.equipment.tuningFormula.status ===
        'source-indexed-static-runtime-applied'
          ? 'implemented'
          : 'evidence-insufficient',
      evidence: [cultivationCatalog.equipment.tuningFormula.sourceIdentity],
    },
    {
      capabilityIdentity: 'b3-duplicate-kibo-species-slot-runtime-binding',
      status: 'implemented',
      evidence: [bindingDocument.policy.sourceIdentity],
    },
    {
      capabilityIdentity: 'b3-formal-catalog-hard-rejection',
      status: 'implemented',
      evidence: [
        'src/optimization-qualification/optimizationQualificationProtocol.js',
      ],
    },
  ];
}

function summarizeManifests(records) {
  return {
    objectCount: records.length,
    maturityCounts: countBy(records, record => record.maturityState),
    optimizationReadyCounts: Object.fromEntries(
      ['character', 'kibo', 'soul-essence', 'equipment', 'set-skill'].map(
        kind => [
          kind,
          records.filter(
            record => record.objectKind === kind && record.optimizationReady
          ).length,
        ]
      )
    ),
    optimizationReadyTotal: records.filter(record => record.optimizationReady)
      .length,
  };
}

function summarizeGaps(records) {
  return {
    blockingUniqueGapCount: records.filter(record => record.blocking).length,
    byCategory: countBy(records, record => record.category),
    byCode: countBy(records, record => record.code),
    byObjectKind: countBy(records, record => record.objectKind),
  };
}

function createSourceSnapshot(sources) {
  const files = Object.fromEntries(
    Object.entries(sources).map(([key, source]) => [
      key,
      {
        path: source.path,
        sha256: source.sha256,
        bytes: source.bytes,
      },
    ])
  );
  return {
    files,
    sourceSnapshotHash: hashCanonicalValue(files),
  };
}

function createMarkdownSummary(summary, catalog) {
  const ready = summary.optimizationReadyCounts;
  const gapCounts = summary.gapCounts.byCategory;
  return `# M12-B3-A Optimization Qualification Baseline\n\n` +
    `- Status: \`${summary.status}\`\n` +
    `- Source snapshot: \`${summary.sourceSnapshotHash}\`\n` +
    `- Roster: \`${summary.rosterHash}\`\n` +
    `- Catalog: \`${summary.catalogHash}\`\n` +
    `- Denominators: characters ${summary.denominators.characterOptimizationObjects}, Kibo ${summary.denominators.kibos}, soul essence ${summary.denominators.soulEssences}, equipment ${summary.denominators.equipment}, set skills ${summary.denominators.setSkills}\n` +
    `- Optimization ready: characters ${ready.character}, Kibo ${ready.kibo}, soul essence ${ready['soul-essence']}, equipment ${ready.equipment}, set skills ${ready['set-skill']}\n` +
    `- Blocking gaps: not implemented ${gapCounts['not-implemented'] ?? 0}, evidence insufficient ${gapCounts['evidence-insufficient'] ?? 0}\n` +
    `- Implemented baseline capabilities: frozen source drift gate, STARBORN alias normalization, strict cultivation schema/hash, Kibo talent/bond resolution, tuning formula source index, duplicate-Kibo slot identity, and formal hard rejection.\n` +
    `- STARBORN alias mechanism hash: \`${catalog.records.find(record => record.objectId === 'STARBORN')?.manifestHash ?? 'missing'}\` (source aliases 199001/199002 are one optimization object)\n` +
    `- Duplicate Kibo species across different actor slots: allowed; runtime owner is \`actorSlotId+kiboId\`.\n` +
    `- M12-C remains locked. This baseline does not run team, loadout, or axis search.\n`;
}

async function readSource(sourcePath, projectRoot) {
  const bytes = await fs.readFile(sourcePath);
  return {
    path: normalizeSourcePath(sourcePath, projectRoot),
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    value: JSON.parse(bytes.toString('utf8')),
  };
}

function assertFrozenSourceHashes(sources) {
  for (const [key, expectedHash] of Object.entries(FROZEN_B3_SOURCE_HASHES)) {
    const actualHash = sources[key]?.sha256;
    if (actualHash !== expectedHash) {
      throw new Error(
        `optimization-qualification-source-drift:${key}:expected=${expectedHash}:actual=${actualHash ?? 'missing'}`
      );
    }
  }
}

function assertDenominators(actual) {
  for (const [key, expected] of Object.entries(FROZEN_B3_DENOMINATORS)) {
    if (actual[key] !== expected) {
      throw new Error(
        `optimization-qualification-denominator-drift:${key}:expected=${expected}:actual=${actual[key]}`
      );
    }
  }
}

function finalizeHash(value, key) {
  return { ...value, [key]: hashCanonicalValue(value) };
}

function normalizeSourcePath(sourcePath, projectRoot) {
  const relative = path.relative(projectRoot, sourcePath);
  return relative.startsWith('..')
    ? sourcePath.replaceAll('\\', '/')
    : relative.replaceAll('\\', '/');
}

function splitTags(value) {
  return String(value ?? '')
    .split('、')
    .map(entry => entry.trim())
    .filter(Boolean);
}

function hasTargetElement(value) {
  return splitTags(value).some(element => TARGET_ELEMENTS.has(element));
}

function requireById(rows, id, label) {
  const row = rows.find(entry => Number(entry.id) === Number(id));
  if (!row) throw new Error(`${label} missing: ${id}`);
  return row;
}

function sortByNumericId(left, right) {
  return Number(left.id) - Number(right.id);
}

function compareQualificationRecords(left, right) {
  const byKind = left.objectKind.localeCompare(right.objectKind, 'en');
  if (byKind) return byKind;
  return left.objectId.localeCompare(right.objectId, 'en', { numeric: true });
}

function slotFromEquipmentType(typeName, slotType) {
  const byName = {
    武器: 'weapon',
    上装: 'top',
    下装: 'bottom',
    耳饰: 'earring',
    戒指: 'ring',
  };
  return byName[typeName] ?? EQUIPMENT_SLOT_BY_TYPE[Number(slotType)] ?? null;
}

function parseRarity(value) {
  const match = String(value ?? '').match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function countBy(records, selector) {
  return Object.fromEntries(
    [...records.reduce((map, record) => {
      const key = String(selector(record));
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map())].sort(([left], [right]) => left.localeCompare(right, 'en'))
  );
}
