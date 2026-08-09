import { getInstalledVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import soulEssenceEffectCatalog from '../../data/generated/soulessence-effect-mechanics.json';
import { evaluateVerifiedBattleEffectFormula } from './verifiedBattleEffectFormulaRuntime';

const CORE_ATTRIBUTE_KEYS = Object.freeze({
  1: 'ATK',
  3: 'DEF',
  4: 'MDEF',
  5: 'MAXHP',
});
const DEFAULT_ACTOR_LEVEL = 80;
const DEFAULT_KIBO_LEVEL = 80;
const DEFAULT_KIBO_HOBBY_ID = 1;
const DEFAULT_KIBO_COMPREHENSION = 100;
const DEFAULT_KIBO_INTIMACY_LEVEL = 1;
const indexCache = new WeakMap();

export function compileVerifiedStaticActorProperties({
  actor,
  mechanicsPackage = getInstalledVerifiedCombatMechanicsPackage(),
  position = null,
} = {}) {
  const catalog = mechanicsPackage?.staticPropertyCatalog;
  if (!catalog) {
    return createUnavailableResult(
      actor,
      'verified-static-property-catalog-not-installed'
    );
  }
  const indexes = getCatalogIndexes(catalog);
  const characterId = Number(actor?.characterId);
  const profile = indexes.actorProfiles.get(characterId);
  if (
    profile?.optimizationObject &&
    !isOptimizationObjectSourceAliasProfileBound(profile, characterId)
  ) {
    return createUnavailableResult(
      actor,
      'verified-static-actor-source-alias-binding-invalid',
      {
        sourceIdentity: profile?.sourceIdentity ?? null,
        sourceAliasIdentity:
          profile?.optimizationObject?.sourceAliasIdentity ?? null,
      }
    );
  }
  if (!profile?.applied) {
    return createUnavailableResult(
      actor,
      'verified-static-actor-profile-unresolved',
      {
        sourceIdentity: profile?.sourceIdentity ?? null,
        identityClassification:
          indexes.actorIdentity.get(characterId)?.classification ??
          'identity-not-classified',
      }
    );
  }

  const level = clampInteger(
    actor?.level,
    1,
    indexes.actorMaximumLevel,
    DEFAULT_ACTOR_LEVEL
  );
  const growth = indexes.actorGrowth.get(level);
  if (!growth) {
    return createUnavailableResult(
      actor,
      'verified-static-actor-level-growth-unresolved',
      { level, sourceIdentity: profile.sourceIdentity }
    );
  }

  const sources = [];
  const unresolved = [];
  const unapplied = [];
  const heroTemplate = new Map(
    profile.templateAttributes.map(entry => [
      Number(entry.id),
      Number(entry.value),
    ])
  );
  const growthAttributes = new Map(
    growth.attributes.map(entry => [Number(entry.id), Number(entry.value)])
  );
  const cultivation = actor?.cultivation ?? {};
  const preserveLevelPrecision =
    cultivation?.optimizationStaticSources?.levelTemplatePrecision ===
    'panel-round-after-source-sum';
  const levelAttributes = [];
  for (const [attributeId, value] of heroTemplate) {
    if (CORE_ATTRIBUTE_KEYS[attributeId]) {
      const growthValue = growthAttributes.get(attributeId);
      if (!Number.isFinite(growthValue)) {
        unresolved.push({
          kind: 'actor-level-growth',
          attributeId,
          reason: 'level-growth-attribute-missing',
          sourceIdentity: growth.sourceIdentity,
        });
        continue;
      }
      levelAttributes.push({
        id: attributeId,
        value: preserveLevelPrecision
          ? roundToFour((value * growthValue) / 10000)
          : integrate((value * growthValue) / 10000),
      });
      continue;
    }
    if (attributeId === 6) {
      levelAttributes.push({
        id: attributeId,
        value: Number(
          mechanicsPackage.spUnitContract?.actor?.maxSpGrowthMultiplier
        )
          ? value *
            Number(mechanicsPackage.spUnitContract.actor.maxSpGrowthMultiplier)
          : value,
      });
      continue;
    }
    if (
      preserveLevelPrecision &&
      Number.isFinite(growthAttributes.get(attributeId))
    ) {
      levelAttributes.push({
        id: attributeId,
        value: roundToFour(
          (value * Number(growthAttributes.get(attributeId))) / 10000
        ),
      });
      continue;
    }
    levelAttributes.push({ id: attributeId, value });
  }
  sources.push(
    createAppliedSource({
      kind: 'actor-level-template',
      sourceId: `${characterId}@${level}`,
      sourceIdentity: `${profile.sourceIdentity}|${growth.sourceIdentity}`,
      attributes: levelAttributes,
    })
  );

  const strictCharacterCultivationApplied =
    applyOptimizationCharacterCultivationSources({
      characterId,
      cultivation,
      sources,
      unresolved,
      unapplied,
    });
  if (!strictCharacterCultivationApplied) {
    applyStarGiftSources({
      characterId,
      cultivation,
      indexes,
      sources,
      unresolved,
    });
  }
  applyFavorabilitySources({
    characterId,
    cultivation,
    indexes,
    sources,
  });
  applySoulessenceSource({
    characterId,
    loadout: actor?.loadout,
    indexes,
    sources,
    unresolved,
    unapplied,
    actorPosition: position,
  });
  const setSkillActivations = applyEquipmentSources({
    characterId,
    loadout: actor?.loadout,
    indexes,
    sources,
    unresolved,
    unapplied,
  });

  const aggregate = aggregateStaticAttributes({
    catalog,
    sources,
  });
  const complete = unresolved.length === 0;
  const result = {
    schemaVersion: 1,
    contractName: 'AzPrVerifiedStaticActorProperties',
    status: complete
      ? 'verified-static-actor-properties-ready'
      : 'verified-static-actor-properties-partial',
    packageId: mechanicsPackage.packageId,
    packageHash: mechanicsPackage.packageHash,
    characterId,
    level,
    attributes: aggregate.attributes,
    core: aggregate.core,
    stats: createActorStats(aggregate),
    resourceProfile: createResourceProfile({
      attributes: aggregate.attributes,
      sourceIdentity: `verified-static-actor:${characterId}|${mechanicsPackage.packageHash}`,
    }),
    sources,
    unresolved,
    unapplied,
    setSkillActivations,
    sourceIdentity: `verified-static-actor:${characterId}|${mechanicsPackage.packageHash}`,
    complete,
    ready: complete,
    applied: complete,
  };
  result.kibo = compileVerifiedStaticKiboProperties({
    actor,
    actorProperties: result,
    mechanicsPackage,
  });
  return result;
}

export function compileVerifiedStaticKiboProperties({
  actor,
  actorProperties,
  mechanicsPackage = getInstalledVerifiedCombatMechanicsPackage(),
} = {}) {
  const kiboId = positiveIntegerOrNull(actor?.loadout?.kiboId);
  if (!kiboId) {
    return {
      schemaVersion: 1,
      contractName: 'AzPrVerifiedStaticKiboProperties',
      status: 'verified-static-kibo-not-equipped',
      kiboId: null,
      ready: false,
      applied: false,
    };
  }
  const catalog = mechanicsPackage?.staticPropertyCatalog;
  if (!catalog) {
    return createUnavailableKiboResult(
      kiboId,
      'verified-static-property-catalog-not-installed'
    );
  }
  const indexes = getCatalogIndexes(catalog);
  const profile = indexes.kiboProfiles.get(kiboId);
  if (!profile?.applied) {
    return createUnavailableKiboResult(
      kiboId,
      'verified-static-kibo-profile-unresolved',
      indexes.kiboIdentity.get(kiboId)?.classification ??
        'identity-not-classified'
    );
  }
  if (!actorProperties?.complete) {
    return createUnavailableKiboResult(
      kiboId,
      'verified-static-actor-inheritance-source-incomplete'
    );
  }

  const config = actor?.loadout?.kiboConfig ?? {};
  const level = clampInteger(
    config.level,
    1,
    indexes.kiboMaximumLevel,
    DEFAULT_KIBO_LEVEL
  );
  const hobbyId =
    positiveIntegerOrNull(config.hobbyId) ?? DEFAULT_KIBO_HOBBY_ID;
  const intimacyLevel = clampInteger(
    config.intimacyLevel,
    1,
    indexes.kiboMaximumIntimacyLevel,
    DEFAULT_KIBO_INTIMACY_LEVEL
  );
  const growth = indexes.kiboGrowth.get(level);
  const hobby = indexes.kiboHobbies.get(hobbyId);
  const intimacy = indexes.kiboIntimacy.get(intimacyLevel);
  const unresolved = [];
  if (!growth)
    unresolved.push(createKiboIssue('kibo-level-growth-missing', level));
  if (!hobby) unresolved.push(createKiboIssue('kibo-hobby-missing', hobbyId));
  if (!intimacy) {
    unresolved.push(
      createKiboIssue('kibo-intimacy-level-missing', intimacyLevel)
    );
  }
  if (unresolved.length) {
    return {
      ...createUnavailableKiboResult(
        kiboId,
        'verified-static-kibo-configuration-unresolved'
      ),
      level,
      hobbyId,
      intimacyLevel,
      unresolved,
    };
  }

  const species = new Map(
    profile.speciesAttributes.map(entry => [
      Number(entry.id),
      Number(entry.value),
    ])
  );
  const growthAttributes = new Map(
    growth.attributes.map(entry => [Number(entry.id), Number(entry.value)])
  );
  const hobbyAttributes = new Map(
    hobby.attributes.map(entry => [Number(entry.id), Number(entry.value)])
  );
  const comprehensionByAttribute = normalizeComprehensionConfig(
    config.comprehensionByAttribute
  );
  const ownAttributes = new Map();
  for (const [attributeId, speciesValue] of species) {
    if (CORE_ATTRIBUTE_KEYS[attributeId]) {
      const levelBase = integrate(
        (speciesValue * Number(growthAttributes.get(attributeId) ?? 0)) / 10000
      );
      const hobbyFactor = Number(hobbyAttributes.get(attributeId) ?? 100) / 100;
      const comprehensionFactor =
        Number(
          comprehensionByAttribute[attributeId] ?? DEFAULT_KIBO_COMPREHENSION
        ) / 100;
      ownAttributes.set(
        attributeId,
        integrate(levelBase * hobbyFactor * comprehensionFactor)
      );
      continue;
    }
    if (attributeId === 6) {
      ownAttributes.set(
        attributeId,
        Number(mechanicsPackage.spUnitContract?.kibo?.maxSpGrowthMultiplier)
          ? speciesValue *
              Number(mechanicsPackage.spUnitContract.kibo.maxSpGrowthMultiplier)
          : speciesValue
      );
      continue;
    }
    ownAttributes.set(attributeId, speciesValue);
  }

  const actorAttributes = new Map(
    actorProperties.attributes.map(entry => [Number(entry.id), entry])
  );
  const inheritanceRate = Number(intimacy.inheritanceBasisPoints) / 10000;
  const inherited = calculateKiboInheritance({
    actorAttributes,
    groups: catalog.attributeGroups,
    inheritance: catalog.kibo.inheritance,
    inheritanceRate,
  });
  const finalValues = new Map(ownAttributes);
  for (const [attributeId, value] of inherited.values) {
    finalValues.set(
      attributeId,
      Number(finalValues.get(attributeId) ?? 0) + value
    );
  }
  for (const group of catalog.attributeGroups ?? []) {
    const attributeId = Number(group.baseAttrId);
    const externalBase = Number(finalValues.get(attributeId) ?? 0);
    const externalPercentRaw = Number(
      finalValues.get(Number(group.percentAttrId)) ?? 0
    );
    const externalExtra = Number(
      finalValues.get(Number(group.extraAttrId)) ?? 0
    );
    const effective =
      externalBase * (1 + externalPercentRaw / group.rawPercentScale) +
      externalExtra;
    finalValues.set(
      attributeId,
      attributeId === 5 ? Math.floor(effective) : Math.round(effective)
    );
  }

  const attributes = createAttributeOutput({
    values: finalValues,
    definitions: indexes.attributeDefinitions,
  });
  const sourceIdentity = `verified-static-kibo:${actor.characterId}:${kiboId}|${mechanicsPackage.packageHash}`;
  return {
    schemaVersion: 1,
    contractName: 'AzPrVerifiedStaticKiboProperties',
    status: 'verified-static-kibo-properties-ready',
    packageId: mechanicsPackage.packageId,
    packageHash: mechanicsPackage.packageHash,
    characterId: Number(actor.characterId),
    kiboId,
    level,
    hobbyId,
    intimacyLevel,
    comprehensionByAttribute,
    attributes,
    core: createCoreOutputFromAttributes(attributes),
    stats: createKiboStats(attributes),
    resourceProfile: createResourceProfile({ attributes, sourceIdentity }),
    inheritance: {
      rate: inheritanceRate,
      basisPoints: Number(intimacy.inheritanceBasisPoints),
      core: inherited.core,
      scalar: inherited.scalar,
      sourceIdentity: intimacy.sourceIdentity,
    },
    sources: [
      {
        kind: 'kibo-species-level-hobby-comprehension',
        sourceId: `${kiboId}@${level}`,
        sourceIdentity: `${profile.sourceIdentity}|${growth.sourceIdentity}|${hobby.sourceIdentity}`,
        status: 'applied',
        applied: true,
      },
      {
        kind: 'kibo-actor-intimacy-inheritance',
        sourceId: `${actor.characterId}@${intimacyLevel}`,
        sourceIdentity: `${actorProperties.sourceIdentity}|${intimacy.sourceIdentity}`,
        status: 'applied',
        applied: true,
      },
    ],
    unresolved: [],
    unapplied: [],
    sourceIdentity,
    complete: true,
    ready: true,
    applied: true,
  };
}

function applyStarGiftSources({
  characterId,
  cultivation,
  indexes,
  sources,
  unresolved,
}) {
  const profile = indexes.starGifts.get(characterId);
  const requestedRank = nonNegativeInteger(cultivation.starGiftRank);
  if (!requestedRank) return;
  if (!profile) {
    unresolved.push({
      kind: 'star-gift',
      sourceId: characterId,
      reason: 'star-gift-profile-missing',
    });
    return;
  }
  const maximumRank = profile.ranks.at(-1)?.rank ?? 0;
  const rank = Math.min(requestedRank, maximumRank);
  for (const row of profile.ranks.filter(item => item.rank <= rank)) {
    sources.push(
      createAppliedSource({
        kind: 'star-gift-rank',
        sourceId: `${characterId}:${row.rank}`,
        sourceIdentity: row.sourceIdentity,
        attributes: [...row.attributes, ...row.runeAttributes],
      })
    );
  }
}

function applyOptimizationCharacterCultivationSources({
  characterId,
  cultivation,
  sources,
  unresolved,
  unapplied,
}) {
  const contract = cultivation?.optimizationStaticSources;
  if (!contract) return false;
  if (
    contract.contractName !== 'AzPrOptimizationCharacterStaticSources' ||
    Number(contract.characterId) !== Number(characterId)
  ) {
    unresolved.push({
      kind: 'optimization-character-cultivation',
      sourceId: characterId,
      reason: 'optimization-character-static-source-contract-invalid',
      sourceIdentity: null,
    });
    return true;
  }
  const sourceGroups = [
    ['completedStarGiftAttributeSources', 'star-gift-completed-rank'],
    ['starGiftNodeSources', 'star-gift-node'],
  ];
  for (const [field, expectedKind] of sourceGroups) {
    for (const row of contract[field] ?? []) {
      if (
        row.kind !== expectedKind ||
        !Array.isArray(row.attributes) ||
        row.attributes.some(
          attribute =>
            !Number.isInteger(Number(attribute.id)) ||
            !Number.isFinite(Number(attribute.value))
        )
      ) {
        unresolved.push({
          kind: expectedKind,
          sourceId: row.sourceId ?? characterId,
          reason: 'optimization-character-static-source-invalid',
          sourceIdentity: row.sourceIdentity ?? null,
        });
        continue;
      }
      sources.push(
        createAppliedSource({
          kind: expectedKind,
          sourceId: row.sourceId,
          sourceIdentity: row.sourceIdentity,
          attributes: row.attributes.map(attribute => ({
            id: Number(attribute.id),
            value: Number(attribute.value),
          })),
        })
      );
    }
  }
  for (const row of contract.unappliedStaticSources ?? []) {
    unapplied.push({
      ...structuredClone(row),
      appliedToStaticPanel: false,
    });
  }
  for (const row of contract.unappliedSkillSources ?? []) {
    unapplied.push({
      ...structuredClone(row),
      appliedToStaticPanel: false,
    });
  }
  return true;
}

function applyFavorabilitySources({
  characterId,
  cultivation,
  indexes,
  sources,
}) {
  const requestedLevel = nonNegativeInteger(cultivation.favorabilityLevel);
  if (!requestedLevel) return;
  const profile = indexes.favorability.get(characterId);
  for (const row of profile?.levels ?? []) {
    if (row.level > requestedLevel || !row.attributes.length) continue;
    sources.push(
      createAppliedSource({
        kind: 'favorability',
        sourceId: `${characterId}:${row.level}`,
        sourceIdentity: row.sourceIdentity,
        attributes: row.attributes,
      })
    );
  }
}

function applySoulessenceSource({
  characterId,
  loadout,
  indexes,
  sources,
  unresolved,
  unapplied,
  actorPosition = null,
}) {
  const soulessenceId = positiveIntegerOrNull(loadout?.soulessenceId);
  if (!soulessenceId) return;
  const profile = indexes.soulessences.get(soulessenceId);
  if (!profile?.applied) {
    unresolved.push({
      kind: 'soulessence',
      sourceId: soulessenceId,
      reason: 'soulessence-static-profile-missing',
      sourceIdentity: profile?.sourceIdentity ?? null,
    });
    return;
  }
  const requestedLevel = clampInteger(
    loadout?.soulessenceLevel,
    1,
    profile.maximumLevel,
    profile.maximumLevel
  );
  const level = findAtOrBefore(profile.levels, requestedLevel, 'level');
  if (!level) {
    unresolved.push({
      kind: 'soulessence',
      sourceId: soulessenceId,
      reason: 'soulessence-level-source-missing',
    });
    return;
  }
  sources.push(
    createAppliedSource({
      kind: 'soulessence-level',
      sourceId: `${soulessenceId}:${level.level}`,
      sourceIdentity: level.sourceIdentity,
      attributes: level.attributes,
    })
  );
  const maximumRankForLevel = profile.ranks
    .filter(row => row.levelLimit <= level.level)
    .at(-1)?.rank;
  const rank = clampInteger(
    loadout?.soulessenceRank,
    1,
    maximumRankForLevel ?? profile.maximumRank,
    maximumRankForLevel ?? profile.maximumRank
  );
  const rankSource = findAtOrBefore(profile.ranks, rank, 'rank');
  if (rankSource?.attributes?.length) {
    sources.push(
      createAppliedSource({
        kind: 'soulessence-rank',
        sourceId: `${soulessenceId}:${rankSource.rank}`,
        sourceIdentity: rankSource.sourceIdentity,
        attributes: rankSource.attributes,
      })
    );
  }
  if (profile.effectSkill?.skillId) {
    const cultivationEffect = loadout?.soulessenceCultivation?.effectSkill;
    const effectDefinition = indexes.soulessenceEffects.get(soulessenceId);
    const requiredProfession = effectDefinition?.profession
      ? String(effectDefinition.profession).trim()
      : '';
    const position = actorPosition ? String(actorPosition).trim() : '';
    const professionMismatch =
      Boolean(requiredProfession) &&
      Boolean(position) &&
      requiredProfession !== position;
    if (professionMismatch) {
      unapplied.push({
        kind: 'soulessence-effect-skill',
        sourceId: profile.effectSkill.skillId,
        ...(Number(cultivationEffect?.skillId) ===
        Number(profile.effectSkill.skillId)
          ? {
              skillLevel: Number(cultivationEffect.skillLevel),
              star: Number(cultivationEffect.star),
              cultivationSourceIdentity:
                cultivationEffect.sourceIdentity ?? null,
            }
          : {}),
        reason: 'soulessence-profession-mismatch',
        requiredProfession,
        actorPosition: position,
        sourceIdentity: profile.effectSkill.sourceIdentity,
        appliedToStaticPanel: false,
      });
      return;
    }
    const persistentValidation = validatePersistentLoadoutPropertyRoot(
      effectDefinition?.persistentRoot,
      {
        requiresStarValues: true,
        expectedPropertyElementIds:
          effectDefinition?.sourceClosure?.propertyElementIds,
      }
    );
    const persistentDeclared =
      cultivationEffect?.runtimeStatus === 'runtime-applied' &&
      effectDefinition?.runtimeStatus === 'runtime-applied' &&
      effectDefinition?.persistentRoot != null &&
      effectDefinition.persistentRoot.activationMode !==
        'periodic-conditional-finite-leaf';
    const persistentApplied =
      persistentDeclared &&
      Number(cultivationEffect?.skillId) ===
        Number(profile.effectSkill.skillId) &&
      persistentValidation.valid;
    if (persistentApplied) {
      applyPersistentSoulEffectSources({
        characterId,
        soulessenceId,
        effectDefinition,
        cultivationEffect,
        indexes,
        sources,
        unresolved,
      });
    } else if (persistentDeclared && !persistentValidation.valid) {
      unresolved.push({
        kind: 'soulessence-persistent-property',
        sourceId: soulessenceId,
        reason: 'soulessence-persistent-property-contract-invalid',
        issueCodes: persistentValidation.issueCodes,
        sourceIdentity: effectDefinition?.sourceIdentity ?? null,
      });
    } else if (cultivationEffect?.runtimeStatus !== 'runtime-applied') {
      unapplied.push({
        kind: 'soulessence-effect-skill',
        sourceId: profile.effectSkill.skillId,
        ...(Number(cultivationEffect?.skillId) ===
        Number(profile.effectSkill.skillId)
          ? {
              skillLevel: Number(cultivationEffect.skillLevel),
              star: Number(cultivationEffect.star),
              cultivationSourceIdentity:
                cultivationEffect.sourceIdentity ?? null,
            }
          : {}),
        reason: profile.effectSkill.status,
        sourceIdentity: profile.effectSkill.sourceIdentity,
        appliedToStaticPanel: false,
      });
    }
  }
}

function applyPersistentSoulEffectSources({
  characterId,
  soulessenceId,
  effectDefinition,
  cultivationEffect,
  indexes,
  sources,
  unresolved,
}) {
  const star = Number(cultivationEffect?.star);
  for (const effect of effectDefinition.persistentRoot.effects ?? []) {
    const starValue = effect.valuesByStar?.find(
      row => Number(row.star) === star
    );
    if (!starValue) {
      unresolved.push({
        kind: 'soulessence-persistent-property',
        sourceId: `${soulessenceId}:${effect.elementId}`,
        reason: 'soulessence-persistent-property-star-value-missing',
        star,
        sourceIdentity: effect.sourceIdentity,
      });
      continue;
    }
    const formulaResult = evaluatePersistentPropertyFormula({
      effect,
      level: star,
      sourceRawA: Number(starValue.valueRaw),
    });
    const attribute = projectPersistentPropertyAttribute({
      effect,
      formulaResult,
      indexes,
    });
    if (!attribute) {
      unresolved.push({
        kind: 'soulessence-persistent-property',
        sourceId: `${soulessenceId}:${effect.elementId}`,
        reason:
          formulaResult?.reason ??
          'soulessence-persistent-property-formula-or-bucket-unresolved',
        sourceIdentity: effect.sourceIdentity,
      });
      continue;
    }
    sources.push({
      ...createAppliedSource({
        kind: 'soulessence-persistent-property',
        sourceId: `${soulessenceId}:${effect.elementId}:star-${star}`,
        sourceIdentity: [
          effectDefinition.persistentRoot.installation.sourceIdentity,
          effect.sourceIdentity,
          starValue.sourceIdentity,
          effectDefinition.persistentRoot.unload.sourceIdentity,
        ]
          .filter(Boolean)
          .join('|'),
        attributes: [attribute],
      }),
      sourceSequencePath: createPersistentLoadoutSourceSequencePath({
        characterId,
        loadoutKind: 'soulessence',
        ownerId: soulessenceId,
        skillId: effectDefinition.effectSkillId,
        elementId: effect.elementId,
        graphPath:
          effectDefinition.persistentRoot.installation.sourceSequencePath,
      }),
      sourceSequenceStatus:
        'verified-persistent-loadout-property-source-sequence-ready',
      formulaResult,
      lifecycle: structuredClone(effectDefinition.persistentRoot.lifecycle),
      unload: structuredClone(effectDefinition.persistentRoot.unload),
    });
  }
}

function applyEquipmentSources({
  characterId,
  loadout,
  indexes,
  sources,
  unresolved,
  unapplied,
}) {
  const selectedSetCounts = new Map();
  for (const [slotKey, rawEquipmentId] of Object.entries(
    loadout?.equipment ?? {}
  )) {
    const equipmentId = positiveIntegerOrNull(rawEquipmentId);
    if (!equipmentId) continue;
    const profile = indexes.equipment.get(equipmentId);
    if (!profile?.applied) {
      unresolved.push({
        kind: 'equipment',
        sourceId: equipmentId,
        slotKey,
        reason: 'equipment-static-profile-missing',
        sourceIdentity: profile?.sourceIdentity ?? null,
      });
      continue;
    }
    const requestedLevel = clampInteger(
      loadout?.equipmentLevels?.[slotKey],
      0,
      profile.maximumLevel,
      profile.maximumLevel
    );
    const level = findAtOrBefore(profile.mainLevels, requestedLevel, 'level');
    if (!level) {
      unresolved.push({
        kind: 'equipment',
        sourceId: equipmentId,
        slotKey,
        reason: 'equipment-main-level-source-missing',
      });
      continue;
    }
    const equipmentCultivation = loadout?.equipmentCultivation?.[slotKey];
    const instance = equipmentCultivation?.instance;
    if (
      equipmentCultivation &&
      (!instance ||
        !['normal', 'starborn'].includes(instance.identity) ||
        typeof instance.bGoldSide !== 'boolean' ||
        !Number.isInteger(Number(instance.maxValue)))
    ) {
      unresolved.push({
        kind: 'equipment-instance',
        sourceId: equipmentId,
        slotKey,
        reason: 'equipment-instance-contract-invalid',
        sourceIdentity: instance?.sourceIdentity ?? null,
      });
    } else if (equipmentCultivation) {
      sources.push({
        ...createAppliedSource({
          kind: 'equipment-instance',
          sourceId: `${equipmentId}:${slotKey}:${instance.identity}:${instance.maxValue}`,
          sourceIdentity: instance.sourceIdentity,
          attributes: [],
        }),
        instance: structuredClone(instance),
      });
    }
    sources.push(
      createAppliedSource({
        kind: 'equipment-main',
        sourceId: `${equipmentId}:${slotKey}:${level.level}`,
        sourceIdentity: level.sourceIdentity,
        attributes: level.attributes,
      })
    );
    applyEquipmentTuningSource({
      equipmentId,
      slotKey,
      sourceKind: 'equipment-tuning-main',
      attributes: level.attributes,
      cultivation: equipmentCultivation,
      sources,
      unresolved,
    });
    const fixedSubAttributes = profile.subAttributes.filter(
      entry => entry.status === 'verified-fixed-sub-attribute'
    );
    if (fixedSubAttributes.length) {
      sources.push(
        createAppliedSource({
          kind: 'equipment-sub',
          sourceId: `${equipmentId}:${slotKey}`,
          sourceIdentity: fixedSubAttributes
            .map(entry => entry.sourceIdentity)
            .join('|'),
          attributes: fixedSubAttributes.map(entry => ({
            id: entry.id,
            value: entry.value,
          })),
        })
      );
      applyEquipmentTuningSource({
        equipmentId,
        slotKey,
        sourceKind: 'equipment-tuning-sub',
        attributes: fixedSubAttributes.map(entry => ({
          id: entry.id,
          value: entry.value,
        })),
        cultivation: equipmentCultivation,
        sources,
        unresolved,
      });
    }
    for (const entry of profile.subAttributes.filter(
      item => item.status !== 'verified-fixed-sub-attribute'
    )) {
      unresolved.push({
        kind: 'equipment-sub',
        sourceId: equipmentId,
        slotKey,
        reason: entry.status,
        sourceIdentity: entry.sourceIdentity,
      });
    }
    if (profile.setId) {
      selectedSetCounts.set(
        profile.setId,
        (selectedSetCounts.get(profile.setId) ?? 0) + 1
      );
    }
  }
  const setSkillActivations = indexes.accessorySets.map(setProfile => {
    const selectedPieceCount = selectedSetCounts.get(setProfile.setId) ?? 0;
    const thresholdMet = selectedPieceCount >= setProfile.pieces;
    const effectDefinition = indexes.setSkillEffects.get(
      `${setProfile.setId}:${setProfile.pieces}`
    );
    const persistentValidation = validatePersistentLoadoutPropertyRoot(
      effectDefinition?.persistentRoot,
      {
        expectedPropertyElementIds:
          effectDefinition?.sourceClosure?.propertyElementIds,
      }
    );
    const persistentDeclared =
      thresholdMet &&
      effectDefinition?.runtimeStatus === 'runtime-applied' &&
      effectDefinition?.persistentRoot != null &&
      effectDefinition.persistentRoot.activationMode !==
        'periodic-conditional-finite-leaf';
    const persistentApplied = persistentDeclared && persistentValidation.valid;
    const dynamicPropertyEffects =
      effectDefinition?.effect?.propertyEffects?.length > 0
        ? effectDefinition.effect.propertyEffects
        : [effectDefinition?.effect].filter(Boolean);
    const dynamicPropertyRuntimeApplied =
      thresholdMet &&
      effectDefinition?.runtimeStatus === 'runtime-applied' &&
      effectDefinition?.trigger?.frameAnchor != null &&
      effectDefinition?.trigger?.condition?.status === 'applied' &&
      effectDefinition?.trigger?.target?.kind != null &&
      dynamicPropertyEffects.length > 0 &&
      dynamicPropertyEffects.every(effect => effect?.formula != null) &&
      Number(effectDefinition?.effect?.durationMs) > 0;
    const immediateEffectRuntimeApplied =
      thresholdMet &&
      effectDefinition?.runtimeStatus === 'runtime-applied' &&
      effectDefinition?.trigger?.frameAnchor != null &&
      effectDefinition?.trigger?.condition?.status === 'applied' &&
      Array.isArray(effectDefinition?.immediateEffects) &&
      effectDefinition.immediateEffects.length > 0 &&
      effectDefinition.immediateEffects.every(
        effect =>
          ['direct-sp', 'direct-heal'].includes(effect?.kind) &&
          Number.isInteger(Number(effect?.effectIndex)) &&
          Number.isInteger(Number(effect?.elementId)) &&
          Number.isFinite(Number(effect?.sourceRawValue)) &&
          effect?.targetKind != null &&
          effect?.sourceIdentity != null
      );
    const dynamicRuntimeApplied =
      dynamicPropertyRuntimeApplied || immediateEffectRuntimeApplied;
    if (persistentDeclared && !persistentValidation.valid) {
      unresolved.push({
        kind: 'accessory-set-persistent-property',
        sourceId: `${setProfile.setId}:${setProfile.pieces}`,
        reason: 'set-persistent-property-contract-invalid',
        issueCodes: persistentValidation.issueCodes,
        sourceIdentity: effectDefinition?.sourceIdentity ?? null,
      });
    }
    if (persistentApplied) {
      for (const effect of effectDefinition.persistentRoot.effects ?? []) {
        const formulaResult = evaluatePersistentPropertyFormula({
          effect,
          level: 1,
          sourceRawA: effect.sourceRawA,
        });
        const attribute = projectPersistentPropertyAttribute({
          effect,
          formulaResult,
          indexes,
        });
        if (!attribute) {
          unresolved.push({
            kind: 'accessory-set-persistent-property',
            sourceId: `${setProfile.setId}:${setProfile.pieces}:${effect.elementId}`,
            reason:
              formulaResult?.reason ??
              'set-persistent-property-formula-or-bucket-unresolved',
            sourceIdentity: effect.sourceIdentity,
          });
          continue;
        }
        sources.push({
          ...createAppliedSource({
            kind: 'accessory-set-persistent-property',
            sourceId: `${setProfile.setId}:${setProfile.pieces}:${effect.elementId}`,
            sourceIdentity: [
              setProfile.sourceIdentity,
              effectDefinition.persistentRoot.installation.sourceIdentity,
              effect.sourceIdentity,
              effectDefinition.persistentRoot.unload.sourceIdentity,
            ]
              .filter(Boolean)
              .join('|'),
            attributes: [attribute],
          }),
          sourceSequencePath: createPersistentLoadoutSourceSequencePath({
            characterId,
            loadoutKind: 'accessory-set',
            ownerId: setProfile.setId,
            skillId: setProfile.skillId,
            elementId: effect.elementId,
            graphPath:
              effectDefinition.persistentRoot.installation.sourceSequencePath,
            threshold: setProfile.pieces,
          }),
          sourceSequenceStatus:
            'verified-persistent-loadout-property-source-sequence-ready',
          formulaResult,
          lifecycle: structuredClone(effectDefinition.persistentRoot.lifecycle),
          unload: structuredClone(effectDefinition.persistentRoot.unload),
        });
      }
    }
    return {
      kind: 'accessory-set-skill-threshold',
      setId: setProfile.setId,
      pieces: setProfile.pieces,
      skillId: setProfile.skillId,
      selectedPieceCount,
      thresholdMet,
      thresholdStatus: thresholdMet
        ? 'set-skill-piece-threshold-met'
        : 'set-skill-piece-threshold-not-met',
      runtimeEffectStatus: effectDefinition?.runtimeStatus ?? setProfile.status,
      sourceIdentity: setProfile.sourceIdentity,
      appliedToCalculators: persistentApplied,
      appliedToRuntimeEffect: dynamicRuntimeApplied,
      runtimeEffectDefinitionIdentity: dynamicRuntimeApplied
        ? effectDefinition.sourceIdentity
        : null,
    };
  });
  for (const activation of setSkillActivations) {
    if (
      !activation.thresholdMet ||
      activation.appliedToCalculators ||
      activation.appliedToRuntimeEffect
    ) {
      continue;
    }
    unapplied.push({
      kind: 'accessory-set-skill',
      sourceId: activation.skillId,
      setId: activation.setId,
      pieces: activation.pieces,
      selectedPieceCount: activation.selectedPieceCount,
      thresholdStatus: activation.thresholdStatus,
      reason: activation.runtimeEffectStatus,
      sourceIdentity: activation.sourceIdentity,
      appliedToStaticPanel: false,
    });
  }
  return setSkillActivations;
}

function createPersistentLoadoutSourceSequencePath({
  characterId,
  loadoutKind,
  ownerId,
  skillId,
  elementId,
  graphPath,
  threshold = 0,
}) {
  const loadoutKindIndex = loadoutKind === 'soulessence' ? 1 : 2;
  return [
    0,
    Number(characterId),
    loadoutKindIndex,
    Number(ownerId),
    Number(threshold),
    Number(skillId),
    ...structuredClone(graphPath ?? []).map(Number),
    Number(elementId),
  ];
}

export function validatePersistentLoadoutPropertyRoot(
  root,
  { requiresStarValues = false, expectedPropertyElementIds = null } = {}
) {
  const issueCodes = [];
  if (root?.status !== 'runtime-applied') {
    issueCodes.push('persistent-root-status-not-applied');
  }
  if (
    Number(root?.installation?.frame) !== 0 ||
    root?.installation?.targetKind !== 'self-actor' ||
    Number(root?.installation?.directInjectTargetType) !== 0 ||
    root?.installation?.removeElementOnEnd !== false ||
    !Array.isArray(root?.installation?.sourceSequencePath) ||
    root.installation.sourceSequencePath.length === 0 ||
    !String(root?.installation?.sourceIdentity ?? '').length
  ) {
    issueCodes.push('persistent-root-installation-invalid');
  }
  if (
    root?.lifecycle?.durationMode !== 'until-loadout-uninstall' ||
    Number(root?.lifecycle?.leafDurationMs) !== -1 ||
    root?.lifecycle?.combineMode !== 'cover-by-source-identity' ||
    Number(root?.lifecycle?.inheritType) !== 0 ||
    !String(root?.lifecycle?.sourceIdentity ?? '').length
  ) {
    issueCodes.push('persistent-root-lifecycle-invalid');
  }
  if (
    Number(root?.unload?.eventId) !== 36 ||
    !(root?.unload?.removalPaths?.length > 0) ||
    !String(root?.unload?.sourceIdentity ?? '').length
  ) {
    issueCodes.push('persistent-root-unload-invalid');
  }
  if (!(root?.effects?.length > 0)) {
    issueCodes.push('persistent-root-effects-empty');
  }
  if (Array.isArray(expectedPropertyElementIds)) {
    const expected = [...new Set(expectedPropertyElementIds.map(Number))].sort(
      (left, right) => left - right
    );
    const actual = [
      ...new Set((root?.effects ?? []).map(effect => Number(effect.elementId))),
    ].sort((left, right) => left - right);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      issueCodes.push('persistent-root-effect-closure-incomplete');
    }
  }
  for (const effect of root?.effects ?? []) {
    if (
      !Number.isInteger(Number(effect?.elementId)) ||
      !Number.isInteger(Number(effect?.attributeId)) ||
      !['dynamicExtra', 'dynamicPercent'].includes(effect?.bucket) ||
      Number(effect?.durationMs) !== -1 ||
      Number(effect?.combineType) !== 3 ||
      ![-1, 0].includes(Number(effect?.combineNumber)) ||
      Number(effect?.executeTargetType) !== 0 ||
      Number(effect?.inheritType) !== 0 ||
      !String(effect?.sourceIdentity ?? '').length
    ) {
      issueCodes.push('persistent-root-effect-contract-invalid');
    }
    if (
      Number(effect?.formula?.commonFunctionId) !== 1 ||
      ![3, 5].includes(Number(effect?.formula?.baseFunctionId)) ||
      Number(effect?.formula?.commonRatioRaw) !== 10000 ||
      !String(effect?.formula?.sourceIdentity ?? '').length
    ) {
      issueCodes.push('persistent-root-effect-formula-invalid');
    }
    if (
      requiresStarValues &&
      (!(effect?.valuesByStar?.length === 4) ||
        effect.valuesByStar.some(
          row =>
            !Number.isInteger(Number(row?.star)) ||
            !Number.isFinite(Number(row?.valueRaw)) ||
            !String(row?.sourceIdentity ?? '').length
        ))
    ) {
      issueCodes.push('persistent-root-effect-star-values-invalid');
    }
  }
  return {
    valid: issueCodes.length === 0,
    issueCodes: [...new Set(issueCodes)],
  };
}

function evaluatePersistentPropertyFormula({ effect, level, sourceRawA }) {
  const params = Array.from({ length: 26 }, (_, index) =>
    Number(effect.formula?.formulaParams?.[index] ?? 0)
  );
  params[0] = Number(sourceRawA);
  params[6] = Number(effect.formula?.commonRatioRaw);
  return evaluateVerifiedBattleEffectFormula({
    effect: {
      ...effect,
      property: { bucket: effect.bucket },
      formula: {
        ...effect.formula,
        paramsByLevel: { [level]: params },
      },
    },
    level,
  });
}

function projectPersistentPropertyAttribute({
  effect,
  formulaResult,
  indexes,
}) {
  if (formulaResult?.applied !== true) return null;
  const attributeId = Number(effect.attributeId);
  const group = indexes.attributeGroups.find(
    entry => Number(entry.baseAttrId) === attributeId
  );
  if (effect.bucket === 'dynamicPercent') {
    if (!group) return null;
    return {
      id: Number(group.percentAttrId),
      value: Number(formulaResult.value),
    };
  }
  if (effect.bucket === 'dynamicExtra') {
    return {
      id: Number(group?.extraAttrId ?? attributeId),
      value: Number(formulaResult.value),
    };
  }
  return null;
}

function applyEquipmentTuningSource({
  equipmentId,
  slotKey,
  sourceKind,
  attributes,
  cultivation,
  sources,
  unresolved,
}) {
  if (!cultivation) return;
  const tuningScore = Number(cultivation.tuningScore);
  const formula = cultivation.tuningFormula;
  const parameters = formula?.parameters?.map(Number) ?? [];
  if (!Number.isInteger(tuningScore) || tuningScore < 0) {
    unresolved.push({
      kind: sourceKind,
      sourceId: equipmentId,
      slotKey,
      reason: 'equipment-tuning-score-invalid',
      tuningScore,
    });
    return;
  }
  if (
    !Number.isInteger(Number(cultivation.instance?.maxValue)) ||
    tuningScore > Number(cultivation.instance.maxValue)
  ) {
    unresolved.push({
      kind: sourceKind,
      sourceId: equipmentId,
      slotKey,
      reason: 'equipment-tuning-score-exceeds-instance-max',
      tuningScore,
      maximum: cultivation.instance?.maxValue ?? null,
      sourceIdentity: cultivation.instance?.sourceIdentity ?? null,
    });
    return;
  }
  if (
    parameters.length !== 4 ||
    parameters.some(parameter => !Number.isFinite(parameter))
  ) {
    unresolved.push({
      kind: sourceKind,
      sourceId: equipmentId,
      slotKey,
      reason: 'equipment-tuning-formula-unresolved',
      sourceIdentity: formula?.sourceIdentity ?? null,
    });
    return;
  }
  const tunedAttributes = attributes.map(attribute => ({
    id: Number(attribute.id),
    value:
      calculateEquipmentTunedValue(
        Number(attribute.value),
        tuningScore,
        parameters
      ) - Number(attribute.value),
  }));
  sources.push(
    createAppliedSource({
      kind: sourceKind,
      sourceId: `${equipmentId}:${slotKey}:${tuningScore}`,
      sourceIdentity: `${formula.sourceIdentity}|equipment:${equipmentId}|slot:${slotKey}`,
      attributes: tunedAttributes,
    })
  );
}

function calculateEquipmentTunedValue(baseValue, tuningScore, parameters) {
  const [baseBasisPoints, extraBasisPoints, scoreStepBasisPoints, baselineRaw] =
    parameters;
  const baselineScore = baselineRaw / 10000;
  return (
    Math.ceil((baseValue * baseBasisPoints) / 10000) +
    Math.ceil(
      baseValue *
        (extraBasisPoints / 10000) *
        (scoreStepBasisPoints / 10000) *
        (tuningScore - baselineScore)
    )
  );
}

function aggregateStaticAttributes({ catalog, sources }) {
  const values = new Map();
  for (const source of sources) {
    if (!source.applied) continue;
    for (const entry of source.attributes) {
      values.set(
        Number(entry.id),
        Number(values.get(Number(entry.id)) ?? 0) + Number(entry.value)
      );
    }
  }
  const core = {};
  for (const group of catalog.attributeGroups ?? []) {
    const externalBase = Number(values.get(Number(group.baseAttrId)) ?? 0);
    const externalPercentRaw = Number(
      values.get(Number(group.percentAttrId)) ?? 0
    );
    const externalExtra = Number(values.get(Number(group.extraAttrId)) ?? 0);
    const effectiveValue =
      externalBase * (1 + externalPercentRaw / group.rawPercentScale) +
      externalExtra;
    const displayValue =
      Number(group.baseAttrId) === 5
        ? Math.floor(effectiveValue)
        : Math.round(effectiveValue);
    values.set(Number(group.baseAttrId), effectiveValue);
    core[CORE_ATTRIBUTE_KEYS[group.baseAttrId]] = {
      attributeId: Number(group.baseAttrId),
      externalBase,
      externalPercentRaw,
      externalPercent: externalPercentRaw / group.rawPercentScale,
      externalExtra,
      effectiveValue,
      displayValue,
      formula: 'S=EB*(1+EP_raw/10000)+EE',
    };
  }
  const attributes = createAttributeOutput({
    values,
    definitions: new Map(
      catalog.attributeDefinitions.map(entry => [Number(entry.id), entry])
    ),
  });
  for (const group of catalog.attributeGroups ?? []) {
    const entry = attributes.find(
      attribute => attribute.id === Number(group.baseAttrId)
    );
    const detail = core[CORE_ATTRIBUTE_KEYS[group.baseAttrId]];
    if (!entry || !detail) continue;
    entry.externalBase = detail.externalBase;
    entry.externalPercentRaw = detail.externalPercentRaw;
    entry.externalExtra = detail.externalExtra;
    entry.displayValue = detail.displayValue;
  }
  return {
    values,
    attributes,
    core,
  };
}

function calculateKiboInheritance({
  actorAttributes,
  groups,
  inheritance,
  inheritanceRate,
}) {
  const values = new Map();
  const core = {};
  const scalar = [];
  const inheritanceBySource = new Map(
    inheritance.map(entry => [Number(entry.sourceAttributeId), entry])
  );
  const groupedSourceIds = new Set();
  for (const group of groups ?? []) {
    const baseId = Number(group.baseAttrId);
    const percentId = Number(group.percentAttrId);
    const extraId = Number(group.extraAttrId);
    groupedSourceIds.add(baseId);
    groupedSourceIds.add(percentId);
    groupedSourceIds.add(extraId);
    const actorBase = Number(actorAttributes.get(baseId)?.externalBase ?? 0);
    const actorPercent = Number(actorAttributes.get(percentId)?.rawValue ?? 0);
    const actorExtra = Number(actorAttributes.get(extraId)?.rawValue ?? 0);
    const baseAdjustment = Number(
      inheritanceBySource.get(baseId)?.adjustment ?? 0
    );
    const extraAdjustment = Number(
      inheritanceBySource.get(extraId)?.adjustment ?? 0
    );
    const actorAdd = Math.floor(
      actorBase * (actorPercent / group.rawPercentScale) + actorExtra
    );
    const inheritedBase = Math.floor(
      (actorBase + baseAdjustment) * inheritanceRate
    );
    const inheritedAdd = Math.floor(
      (actorAdd + extraAdjustment) * inheritanceRate
    );
    const targetAttributeId =
      inheritanceBySource.get(baseId)?.targetAttributeId ?? baseId;
    const total = inheritedBase + inheritedAdd;
    values.set(targetAttributeId, (values.get(targetAttributeId) ?? 0) + total);
    core[CORE_ATTRIBUTE_KEYS[baseId]] = {
      sourceAttributeId: baseId,
      targetAttributeId,
      actorBase,
      actorPercentRaw: actorPercent,
      actorExtra,
      actorAdd,
      inheritedBase,
      inheritedAdd,
      total,
    };
  }
  for (const rule of inheritance) {
    const sourceAttributeId = Number(rule.sourceAttributeId);
    if (groupedSourceIds.has(sourceAttributeId)) continue;
    const source = actorAttributes.get(sourceAttributeId);
    if (!source) continue;
    const inheritedValue = Math.floor(
      (Number(source.rawValue ?? 0) + Number(rule.adjustment ?? 0)) *
        inheritanceRate
    );
    values.set(
      Number(rule.targetAttributeId),
      Number(values.get(Number(rule.targetAttributeId)) ?? 0) + inheritedValue
    );
    scalar.push({
      sourceAttributeId,
      targetAttributeId: Number(rule.targetAttributeId),
      adjustment: Number(rule.adjustment ?? 0),
      sourceValue: Number(source.rawValue ?? 0),
      inheritedValue,
      sourceIdentity: rule.sourceIdentity,
    });
  }
  return { values, core, scalar };
}

function createAttributeOutput({ values, definitions }) {
  return [...values.entries()]
    .map(([id, rawValue]) => {
      const definition = definitions.get(Number(id)) ?? null;
      return {
        id: Number(id),
        key: definition?.key ?? `ATTRIBUTE_${id}`,
        tableKey: definition?.tableKey ?? null,
        rawValue: Number(rawValue),
        runtimeValue:
          Number(rawValue) / positiveNumber(definition?.rawScale, 1),
        rawScale: positiveNumber(definition?.rawScale, 1),
        isRatio: definition?.isRatio === true,
        groupId: definition?.groupId ?? null,
        groupType: definition?.groupType ?? null,
        externalBase: null,
        externalPercentRaw: null,
        externalExtra: null,
        displayValue: Math.floor(Number(rawValue)),
      };
    })
    .sort((left, right) => left.id - right.id);
}

function createCoreOutputFromAttributes(attributes) {
  return Object.fromEntries(
    Object.entries(CORE_ATTRIBUTE_KEYS).map(([id, key]) => {
      const attribute = attributes.find(entry => entry.id === Number(id));
      return [
        key,
        {
          attributeId: Number(id),
          effectiveValue: Number(attribute?.rawValue ?? 0),
          displayValue:
            Number(id) === 5
              ? Math.floor(Number(attribute?.rawValue ?? 0))
              : Math.round(Number(attribute?.rawValue ?? 0)),
        },
      ];
    })
  );
}

function createActorStats(aggregate) {
  const byId = new Map(aggregate.attributes.map(entry => [entry.id, entry]));
  return {
    attack: aggregate.core.ATK?.effectiveValue ?? null,
    maxHp: aggregate.core.MAXHP?.effectiveValue ?? null,
    physicalDefense: aggregate.core.DEF?.effectiveValue ?? null,
    magicalDefense: aggregate.core.MDEF?.effectiveValue ?? null,
    critRate: byId.get(7)?.runtimeValue ?? null,
    critDamage: byId.get(8)?.runtimeValue ?? null,
    damageAmplification: byId.get(21)?.runtimeValue ?? null,
    tuningStrength: byId.get(229)?.rawValue ?? null,
  };
}

function createKiboStats(attributes) {
  const byId = new Map(attributes.map(entry => [entry.id, entry]));
  return {
    attack: byId.get(1)?.rawValue ?? null,
    maxHp: byId.get(5)?.rawValue ?? null,
    physicalDefense: byId.get(3)?.rawValue ?? null,
    magicalDefense: byId.get(4)?.rawValue ?? null,
    critRate: byId.get(7)?.runtimeValue ?? null,
    critDamage: byId.get(8)?.runtimeValue ?? null,
    damageAmplification: byId.get(21)?.runtimeValue ?? null,
    tuningStrength: byId.get(229)?.rawValue ?? null,
  };
}

function createResourceProfile({ attributes, sourceIdentity }) {
  const byId = new Map(attributes.map(entry => [entry.id, entry.rawValue]));
  const effectiveMaxSp = positiveNumber(byId.get(6), 100);
  return {
    effectiveMaxSp,
    maxSp: effectiveMaxSp,
    sprSecBasisPoints: finiteNumberOrNull(byId.get(110)),
    sprSecBackBasisPoints: finiteNumberOrNull(byId.get(226)),
    spGetUpBasisPoints: finiteNumberOrNull(byId.get(105)),
    spRetAutoBasisPoints: finiteNumberOrNull(byId.get(227)),
    spGetUpAttackBasisPoints: finiteNumberOrNull(byId.get(228)),
    sourceIdentity,
    status: 'verified-static-resource-profile-ready',
    applied: true,
  };
}

function createAppliedSource({ kind, sourceId, sourceIdentity, attributes }) {
  return {
    kind,
    sourceId,
    sourceIdentity,
    attributes: (attributes ?? []).map(entry => ({
      id: Number(entry.id),
      value: Number(entry.value),
    })),
    status: 'applied',
    applied: true,
  };
}

function isOptimizationObjectSourceAliasProfileBound(profile, characterId) {
  const alias = profile?.optimizationObject;
  const sourceIdentity = String(alias?.sourceIdentity ?? '');
  return Boolean(
    String(alias?.optimizationObjectId ?? '').trim() &&
      Number(alias?.sourceCharacterId) === Number(characterId) &&
      String(alias?.sourceAliasIdentity ?? '').trim() &&
      sourceIdentity.includes(
        `src/data/generated/characters.json#items[id=${characterId}]`
      ) &&
      sourceIdentity.includes(`NewTable/hero.rows[id=${characterId}]`) &&
      String(profile?.sourceIdentity ?? '').includes(sourceIdentity)
  );
}

function getCatalogIndexes(catalog) {
  if (indexCache.has(catalog)) return indexCache.get(catalog);
  const indexes = {
    actorProfiles: indexBy(catalog.actor?.profiles, 'characterId'),
    actorGrowth: indexBy(catalog.actor?.levelGrowth, 'level'),
    actorMaximumLevel: maximumOf(catalog.actor?.levelGrowth, 'level', 100),
    starGifts: indexBy(catalog.actor?.starGifts, 'characterId'),
    favorability: indexBy(catalog.actor?.favorability, 'characterId'),
    soulessences: indexBy(catalog.soulessences, 'soulessenceId'),
    equipment: indexBy(catalog.equipment, 'equipmentId'),
    accessorySets: catalog.accessorySets ?? [],
    soulessenceEffects: new Map(
      (soulEssenceEffectCatalog.definitions ?? []).map(definition => [
        Number(definition.soulEssenceId),
        definition,
      ])
    ),
    setSkillEffects: new Map(
      (soulEssenceEffectCatalog.setSkillDefinitions ?? []).map(definition => [
        `${definition.setId}:${definition.pieces}`,
        definition,
      ])
    ),
    attributeGroups: catalog.attributeGroups ?? [],
    kiboProfiles: indexBy(catalog.kibo?.profiles, 'kiboId'),
    kiboGrowth: indexBy(catalog.kibo?.levelGrowth, 'level'),
    kiboMaximumLevel: maximumOf(catalog.kibo?.levelGrowth, 'level', 100),
    kiboHobbies: indexBy(catalog.kibo?.hobbies, 'hobbyId'),
    kiboIntimacy: indexBy(catalog.kibo?.intimacyLevels, 'level'),
    kiboMaximumIntimacyLevel: maximumOf(
      catalog.kibo?.intimacyLevels,
      'level',
      10
    ),
    attributeDefinitions: indexBy(catalog.attributeDefinitions, 'id'),
    actorIdentity: indexBy(catalog.identityAudit?.actors, 'id'),
    kiboIdentity: indexBy(catalog.identityAudit?.kibos, 'id'),
  };
  indexCache.set(catalog, indexes);
  return indexes;
}

function indexBy(values, key) {
  return new Map((values ?? []).map(value => [Number(value[key]), value]));
}

function maximumOf(values, key, fallback) {
  const maximum = Math.max(
    ...(values ?? []).map(value => Number(value[key])).filter(Number.isFinite)
  );
  return Number.isFinite(maximum) ? maximum : fallback;
}

function findAtOrBefore(values, requested, key) {
  return [...(values ?? [])]
    .filter(value => Number(value[key]) <= Number(requested))
    .sort((left, right) => Number(left[key]) - Number(right[key]))
    .at(-1);
}

function normalizeComprehensionConfig(value) {
  return Object.fromEntries(
    [1, 3, 4, 5].map(attributeId => [
      attributeId,
      clampNumber(
        value?.[attributeId] ?? value?.[String(attributeId)],
        75,
        170,
        DEFAULT_KIBO_COMPREHENSION
      ),
    ])
  );
}

function createUnavailableResult(actor, reason, extra = {}) {
  return {
    schemaVersion: 1,
    contractName: 'AzPrVerifiedStaticActorProperties',
    status: reason,
    characterId: Number(actor?.characterId) || null,
    attributes: [],
    core: {},
    stats: {},
    sources: [],
    unresolved: [{ kind: 'actor-static-properties', reason, ...extra }],
    unapplied: [],
    complete: false,
    ready: false,
    applied: false,
  };
}

function createUnavailableKiboResult(kiboId, reason, classification = null) {
  return {
    schemaVersion: 1,
    contractName: 'AzPrVerifiedStaticKiboProperties',
    status: reason,
    kiboId,
    attributes: [],
    core: {},
    stats: {},
    sources: [],
    unresolved: [{ kind: 'kibo-static-properties', reason, classification }],
    unapplied: [],
    complete: false,
    ready: false,
    applied: false,
  };
}

function createKiboIssue(reason, value) {
  return { kind: 'kibo-static-properties', reason, value };
}

function integrate(value) {
  return Math.floor(Math.round(Number(value) * 10000) / 10000);
}

function roundToFour(value) {
  return Math.round(Number(value) * 10000) / 10000;
}

function clampInteger(value, minimum, maximum, fallback) {
  const normalized = Number(value);
  const safeFallback = Number(fallback);
  const result = Number.isInteger(normalized) ? normalized : safeFallback;
  return Math.min(Number(maximum), Math.max(Number(minimum), result));
}

function clampNumber(value, minimum, maximum, fallback) {
  const normalized = Number(value);
  const result = Number.isFinite(normalized) ? normalized : Number(fallback);
  return Math.min(Number(maximum), Math.max(Number(minimum), result));
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function finiteNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
