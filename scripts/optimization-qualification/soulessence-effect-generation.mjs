import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

import { hashCanonicalValue } from '../../src/simulation/headless/canonicalSerialization.js';

const PROPERTY_BUCKET_BY_CALCULATE_TYPE = Object.freeze({
  0: 'dynamicForce',
  1: 'dynamicExtra',
  2: 'dynamicPercent',
});

const TRIGGER_EVENT_BY_ID = Object.freeze({
  1: { name: 'BeforeDamage', frameAnchor: 'hit-before-damage' },
  2: { name: 'AfterDamage', frameAnchor: 'hit-after-damage' },
  5: { name: 'BeforeSkill', frameAnchor: 'action-start' },
  6: { name: 'AfterSkill', frameAnchor: 'action-end' },
  9: { name: 'BeforeGetElement', frameAnchor: 'element-before-acquire' },
  10: { name: 'AfterGetElement', frameAnchor: 'element-after-acquire' },
  34: { name: 'SwitchEnter', frameAnchor: 'switch-enter' },
  36: { name: 'UnloadSkill', frameAnchor: 'loadout-uninstall' },
  40: { name: 'OnGotShield', frameAnchor: 'shield-after-acquire' },
  44: { name: 'AfterHeal', frameAnchor: 'heal-after-settlement' },
});

const SUPPORTED_FRAME_ANCHORS = new Set([
  'action-start',
  'action-end',
  'hit-before-damage',
  'hit-after-damage',
  'element-before-acquire',
  'element-after-acquire',
  'switch-enter',
  'shield-after-acquire',
  'heal-after-settlement',
]);

export const SOULESSENCE_EFFECT_CATALOG_CONTRACT_NAME =
  'AzPrSoulEssenceEffectMechanicsCatalog';

export async function createSoulEssenceEffectMechanicsCatalog({
  soulEssences,
  soulDefinitionRows,
  skillLogicRows,
  skillElementValueRows,
  battleElementAssetsPath,
  skillControlRoot,
  generatedAt,
  projectRoot,
  setSkills = [],
  propertyTagContract = null,
  triggerContract = null,
  tuningMechanicsCatalog = null,
  persistentLoadoutPropertyRuntimeEvidence = null,
  periodicPersistentPropertyRuntimeEvidence = null,
  fourPieceSetStackRuntimeEvidence = null,
  beforeSkillCompositeRuntimeEvidence = null,
  afterDamageTargetPropertyRuntimeEvidence = null,
  afterDamageEmptyConditionRuntimeEvidence = null,
  beforeDamageEmptyConditionRuntimeEvidence = null,
  activationConditionRuntimeEvidence = null,
  elementFormulaRows = [],
  setThreeSourceIdentityEvidence = null,
} = {}) {
  if (
    propertyTagContract?.sourceKind !== 'il2cpp-battle-property-tag-contract' ||
    !propertyTagContract?.contractHash
  ) {
    throw new Error('soulessence-property-tag-contract-missing');
  }
  if (
    triggerContract?.sourceKind !== 'il2cpp-soulessence-trigger-contract' ||
    !triggerContract?.contractHash
  ) {
    throw new Error('soulessence-trigger-contract-missing');
  }
  if (
    tuningMechanicsCatalog?.contractName !==
      'AzPrVerifiedTuningMechanicsCatalog' ||
    tuningMechanicsCatalog?.applied !== true
  ) {
    throw new Error('soulessence-tuning-mechanics-contract-missing');
  }
  if (
    persistentLoadoutPropertyRuntimeEvidence?.contractName !==
      'AzPrPersistentLoadoutPropertyRuntimeEvidence' ||
    persistentLoadoutPropertyRuntimeEvidence?.conclusion?.status !== 'applied'
  ) {
    throw new Error('soulessence-persistent-loadout-property-evidence-missing');
  }
  if (
    periodicPersistentPropertyRuntimeEvidence?.contractName !==
      'AzPrPeriodicPersistentPropertyRuntimeEvidence' ||
    periodicPersistentPropertyRuntimeEvidence?.conclusion?.status !== 'applied'
  ) {
    throw new Error(
      'soulessence-periodic-persistent-property-evidence-missing'
    );
  }
  if (
    fourPieceSetStackRuntimeEvidence?.contractName !==
      'AzPrFourPieceSetBeforeDamageStackRuntimeEvidence' ||
    fourPieceSetStackRuntimeEvidence?.conclusion?.status !== 'applied'
  ) {
    throw new Error('soulessence-four-piece-set-stack-evidence-missing');
  }
  if (
    beforeSkillCompositeRuntimeEvidence?.contractName !==
      'AzPrBeforeSkillCompositeImmediateRuntimeEvidence' ||
    beforeSkillCompositeRuntimeEvidence?.conclusion?.status !== 'applied'
  ) {
    throw new Error('soulessence-before-skill-composite-evidence-missing');
  }
  if (
    afterDamageTargetPropertyRuntimeEvidence?.contractName !==
      'AzPrAfterDamageTargetPropertyRuntimeEvidence' ||
    afterDamageTargetPropertyRuntimeEvidence?.conclusion?.status !== 'applied'
  ) {
    throw new Error(
      'soulessence-after-damage-target-property-evidence-missing'
    );
  }
  if (
    setThreeSourceIdentityEvidence?.contractName !==
      'AzPrSetThreeSourceIdentityEvidence' ||
    setThreeSourceIdentityEvidence?.conclusion?.status !==
      'evidence-insufficient'
  ) {
    throw new Error('soulessence-set-three-source-identity-evidence-missing');
  }
  const tuningMechanicsHash = hashCanonicalValue(tuningMechanicsCatalog);
  const definitionBySoulId = new Map(
    (soulDefinitionRows ?? []).map(row => [Number(row.id), row])
  );
  const logicBySkillId = new Map(
    (skillLogicRows ?? []).map(row => [Number(row.skillId), row])
  );
  const valueRowsBySkillId = groupBy(skillElementValueRows ?? [], row =>
    Number(row.skillId)
  );
  const publicSouls = (soulEssences ?? []).map(item => ({
    soulEssenceId: Number(item.id ?? item.soulEssenceId),
    name: item.name ?? null,
  }));
  const effectSkillIds = publicSouls.map(item =>
    Number(definitionBySoulId.get(item.soulEssenceId)?.reishiSkill)
  );
  if (
    effectSkillIds.some(skillId => !Number.isInteger(skillId) || skillId <= 0)
  ) {
    throw new Error('soulessence-effect-skill-source-missing');
  }

  const battleSource = await readBattleElementAssets(battleElementAssetsPath);
  const controlSource = await readControlClosures({
    effectSkillIds,
    skillControlRoot,
    projectRoot,
  });
  const setSkillControlSource = await readControlClosures({
    effectSkillIds: (setSkills ?? []).map(item => Number(item.skillId)),
    skillControlRoot,
    projectRoot,
  });
  const definitions = publicSouls.map(item =>
    compileSoulEffectDefinition({
      soul: item,
      sourceDefinition: definitionBySoulId.get(item.soulEssenceId),
      logicBySkillId,
      valueRowsBySkillId,
      battleElementsByPathId: battleSource.byPathId,
      propertyTagContract,
      triggerContract,
      tuningMechanicsCatalog,
      persistentLoadoutPropertyRuntimeEvidence,
      periodicPersistentPropertyRuntimeEvidence,
      afterDamageEmptyConditionRuntimeEvidence,
      beforeDamageEmptyConditionRuntimeEvidence,
      activationConditionRuntimeEvidence,
      elementFormulaRows,
      control: controlSource.bySkillId.get(
        Number(definitionBySoulId.get(item.soulEssenceId)?.reishiSkill)
      ),
    })
  );
  const unresolved = definitions
    .filter(definition => definition.runtimeStatus !== 'runtime-applied')
    .map(definition => ({
      soulEssenceId: definition.soulEssenceId,
      effectSkillId: definition.effectSkillId,
      status: definition.runtimeStatus,
      reasons: definition.runtimeGaps,
      sourceIdentity: definition.sourceIdentity,
    }));
  const setSkillDefinitions = (setSkills ?? []).map(item =>
    compileSetSkillEffectDefinition({
      setSkill: item,
      battleElementsByPathId: battleSource.byPathId,
      control: setSkillControlSource.bySkillId.get(Number(item.skillId)),
      propertyTagContract,
      triggerContract,
      tuningMechanicsCatalog,
      persistentLoadoutPropertyRuntimeEvidence,
      fourPieceSetStackRuntimeEvidence,
      beforeSkillCompositeRuntimeEvidence,
      afterDamageTargetPropertyRuntimeEvidence,
      setThreeSourceIdentityEvidence,
    })
  );
  const value = {
    schemaVersion: 1,
    contractName: SOULESSENCE_EFFECT_CATALOG_CONTRACT_NAME,
    kind: 'azpr-soulessence-effect-mechanics-catalog',
    generatedAt,
    sourceSnapshot: {
      battleElements: battleSource.metadata,
      controlClosure: controlSource.metadata,
      setSkillControlClosure: setSkillControlSource.metadata,
      propertyTagContract: {
        sourceIdentity: propertyTagContract.sourceIdentity,
        contractHash: propertyTagContract.contractHash,
      },
      triggerContract: {
        sourceIdentity: triggerContract.sourceIdentity,
        contractHash: triggerContract.contractHash,
      },
      tuningMechanics: {
        sourceIdentity: tuningMechanicsCatalog.sourceIdentity,
        contractHash: tuningMechanicsHash,
      },
      persistentLoadoutPropertyRuntimeEvidence: {
        sourceIdentity:
          persistentLoadoutPropertyRuntimeEvidence.conclusion.sourceIdentity,
        contractHash: hashCanonicalValue(
          persistentLoadoutPropertyRuntimeEvidence
        ),
      },
      fourPieceSetStackRuntimeEvidence: {
        sourceIdentity:
          fourPieceSetStackRuntimeEvidence.conclusion.sourceIdentity,
        contractHash: hashCanonicalValue(fourPieceSetStackRuntimeEvidence),
      },
      beforeSkillCompositeRuntimeEvidence: {
        sourceIdentity:
          beforeSkillCompositeRuntimeEvidence.conclusion.sourceIdentity,
        contractHash: hashCanonicalValue(beforeSkillCompositeRuntimeEvidence),
      },
      afterDamageTargetPropertyRuntimeEvidence: {
        sourceIdentity:
          afterDamageTargetPropertyRuntimeEvidence.conclusion.sourceIdentity,
        contractHash: hashCanonicalValue(
          afterDamageTargetPropertyRuntimeEvidence
        ),
      },
      setThreeSourceIdentityEvidence: {
        sourceIdentity:
          setThreeSourceIdentityEvidence.conclusion.sourceIdentity,
        contractHash: hashCanonicalValue(setThreeSourceIdentityEvidence),
      },
      sourceSnapshotHash: hashCanonicalValue({
        battleElements: battleSource.metadata,
        controlClosure: controlSource.metadata,
        setSkillControlClosure: setSkillControlSource.metadata,
        propertyTagContractHash: propertyTagContract.contractHash,
        triggerContractHash: triggerContract.contractHash,
        tuningMechanicsHash,
        persistentLoadoutPropertyRuntimeEvidenceHash: hashCanonicalValue(
          persistentLoadoutPropertyRuntimeEvidence
        ),
        fourPieceSetStackRuntimeEvidenceHash: hashCanonicalValue(
          fourPieceSetStackRuntimeEvidence
        ),
        beforeSkillCompositeRuntimeEvidenceHash: hashCanonicalValue(
          beforeSkillCompositeRuntimeEvidence
        ),
        afterDamageTargetPropertyRuntimeEvidenceHash: hashCanonicalValue(
          afterDamageTargetPropertyRuntimeEvidence
        ),
        setThreeSourceIdentityEvidenceHash: hashCanonicalValue(
          setThreeSourceIdentityEvidence
        ),
      }),
    },
    policy: {
      descriptionUsage: 'discovery-and-cross-check-only',
      runtimeApplication:
        'only definitions with evidence-closed trigger, condition, target, property, lifecycle, and star values',
      supportedOperatorFamilies: [
        'equipped-actor-skill-tag-property-after-skill',
        'equipped-actor-skill-tag-property-before-skill',
        'equipped-actor-skill-tag-property-after-damage',
        'equipped-actor-persistent-property-root',
        'set-skill-persistent-property',
        'set-skill-before-damage-stacking-property',
        'set-skill-before-skill-composite-immediate',
        'set-skill-after-damage-target-property',
        'set-skill-source-identity-conflict',
      ],
    },
    propertyTagContract,
    triggerContract,
    definitions,
    setSkillDefinitions,
    unresolved,
    summary: {
      soulEssenceCount: definitions.length,
      controlClosureCount: controlSource.bySkillId.size,
      resourceReferenceCount: definitions.reduce(
        (total, definition) =>
          total + definition.sourceClosure.resourcePathIds.length,
        0
      ),
      missingResourceReferenceCount: definitions.reduce(
        (total, definition) =>
          total + definition.sourceClosure.missingPathIds.length,
        0
      ),
      runtimeAppliedCount: definitions.filter(
        definition => definition.runtimeStatus === 'runtime-applied'
      ).length,
      unresolvedCount: unresolved.length,
      setSkillCount: setSkillDefinitions.length,
      setSkillThresholdIndexedCount: setSkillDefinitions.filter(
        definition => definition.thresholdActivation != null
      ).length,
      setSkillRuntimeAppliedCount: setSkillDefinitions.filter(
        definition => definition.runtimeStatus === 'runtime-applied'
      ).length,
      byMechanismFamily: countBy(
        definitions,
        definition => definition.mechanismFamily
      ),
      byRuntimeStatus: countBy(
        definitions,
        definition => definition.runtimeStatus
      ),
    },
  };
  return { ...value, catalogHash: hashCanonicalValue(value) };
}

export function createDynamicLoadoutEffectCensus(catalog) {
  const records = [
    ...(catalog?.definitions ?? []).map(definition => ({
      objectKind: 'soul-essence',
      objectId: String(definition.soulEssenceId),
      displayName: definition.name,
      effectSkillId: definition.effectSkillId,
      mechanismFamily: definition.mechanismFamily,
      trigger: definition.trigger,
      activationPrerequisites: definition.activationPrerequisites ?? [],
      sourceTarget: {
        source: 'equipped-actor',
        target: definition.trigger?.targetKind ?? null,
        targetEvidence: definition.trigger?.target ?? null,
      },
      formula: definition.effect?.formula ?? null,
      effectPropertyTags: definition.effect?.propertyTags ?? [],
      effectPropertyTagMatchMode:
        definition.effect?.propertyTagMatchMode ?? null,
      effectPropertyTagSourceIdentity:
        definition.effect?.propertyTagSourceIdentity ?? null,
      persistentRoot: definition.persistentRoot ?? null,
      lifecycle: projectEffectLifecycle(definition.effect),
      resourceTransactions: [],
      vitalChanges: [],
      delayedEvents: [],
      loopPersistence: {
        status:
          definition.runtimeStatus === 'runtime-applied'
            ? 'canonical-effect-timeline-applied'
            : 'runtime-unapplied',
      },
      evidenceStatus:
        definition.runtimeStatus === 'runtime-applied'
          ? 'runtime-applied'
          : 'source-indexed-runtime-unapplied',
      runtimeStatus: definition.runtimeStatus,
      runtimeGaps: definition.runtimeGaps,
      sourceIdentity: definition.sourceIdentity,
    })),
    ...(catalog?.setSkillDefinitions ?? []).map(definition => ({
      objectKind: 'set-skill',
      objectId: `${definition.setId}:${definition.pieces}`,
      displayName: `set-${definition.setId}-${definition.pieces}-piece`,
      effectSkillId: definition.skillId,
      mechanismFamily: definition.mechanismFamily,
      thresholdActivation: definition.thresholdActivation,
      trigger: definition.triggers,
      activationPrerequisites: definition.activationPrerequisites,
      sourceTarget: definition.sourceTarget,
      persistentRoot: definition.persistentRoot ?? null,
      lifecycle: definition.lifecycle,
      resourceTransactions: definition.resourceTransactions,
      vitalChanges: definition.vitalChanges,
      delayedEvents: definition.delayedEvents,
      loopPersistence: definition.loopPersistence,
      evidenceStatus: definition.evidenceStatus,
      runtimeStatus: definition.runtimeStatus,
      runtimeGaps: definition.runtimeGaps,
      sourceIdentityConflict: definition.sourceIdentityConflict ?? null,
      sourceIdentity: definition.sourceIdentity,
    })),
  ].sort(
    (left, right) =>
      left.objectKind.localeCompare(right.objectKind) ||
      left.objectId.localeCompare(right.objectId, 'en', { numeric: true })
  );
  const value = {
    schemaVersion: 1,
    contractName: 'AzPrDynamicLoadoutEffectMechanismCensus',
    kind: 'azpr-dynamic-loadout-effect-mechanism-census',
    generatedAt: catalog?.generatedAt ?? null,
    sourceCatalogHash: catalog?.catalogHash ?? null,
    propertyTagContract: catalog?.propertyTagContract ?? null,
    triggerContract: catalog?.triggerContract ?? null,
    policy: {
      thresholdActivationIsNotRuntimeApplication: true,
      descriptionsAreDiscoveryOnly: true,
      unsupportedEffectsRemainBlocking: true,
    },
    records,
    summary: {
      soulEssenceCount: records.filter(row => row.objectKind === 'soul-essence')
        .length,
      setSkillCount: records.filter(row => row.objectKind === 'set-skill')
        .length,
      runtimeAppliedCount: records.filter(
        row => row.runtimeStatus === 'runtime-applied'
      ).length,
      runtimeUnappliedCount: records.filter(
        row => row.runtimeStatus !== 'runtime-applied'
      ).length,
      byMechanismFamily: countBy(records, row => row.mechanismFamily),
      byEvidenceStatus: countBy(records, row => row.evidenceStatus),
    },
  };
  return { ...value, censusHash: hashCanonicalValue(value) };
}

function compileSetSkillEffectDefinition({
  setSkill,
  battleElementsByPathId,
  control,
  propertyTagContract,
  triggerContract,
  tuningMechanicsCatalog,
  persistentLoadoutPropertyRuntimeEvidence,
  fourPieceSetStackRuntimeEvidence,
  beforeSkillCompositeRuntimeEvidence,
  afterDamageTargetPropertyRuntimeEvidence,
  setThreeSourceIdentityEvidence,
}) {
  const resourcePathIds = uniqueNumbers(control?.resourcePathIds ?? []);
  const missingPathIds = resourcePathIds.filter(
    pathId => !battleElementsByPathId.has(pathId)
  );
  const closure = collectElementClosure({
    rootPathIds: resourcePathIds,
    battleElementsByPathId,
  });
  const triggerRows = closure.rows.filter(
    row => Number(row.typetree?.triggerType) === 1
  );
  const activeTriggerRows = triggerRows.filter(
    row => Number(row.typetree?.triggerParam1) !== 36
  );
  const propertyRows = closure.rows.filter(row =>
    Number.isInteger(Number(row.typetree?.attributeID))
  );
  const damageRows = closure.rows.filter(row => isDamageElement(row.typetree));
  const resourceRows = closure.rows.filter(row =>
    Object.hasOwn(row.typetree ?? {}, 'recoverType')
  );
  const triggers = activeTriggerRows.map(projectTriggerEvidence);
  const properties = propertyRows.map(projectPropertyEvidence);
  const persistentCandidate =
    Number(setSkill.pieces) === 2 &&
    activeTriggerRows.length === 0 &&
    propertyRows.length > 0;
  const persistentRoot = persistentCandidate
    ? compilePersistentPropertyRoot({
        ownerKind: 'set-skill',
        ownerId: `${setSkill.setId}:${setSkill.pieces}`,
        skillId: Number(setSkill.skillId),
        control,
        closure,
        propertyRows,
        unloadTriggers: triggerRows.filter(
          row => Number(row.typetree?.triggerParam1) === 36
        ),
        damageRows,
        battleElementsByPathId,
        propertyTagContract,
        persistentLoadoutPropertyRuntimeEvidence,
        resolveValues: () => [],
      })
    : null;
  const beforeDamageStack = compileFourPieceSetBeforeDamageStack({
    setSkill,
    control,
    closure,
    activeTriggerRows,
    triggerRows,
    propertyRows,
    damageRows,
    resourceRows,
    battleElementsByPathId,
    propertyTagContract,
    triggerContract,
    tuningMechanicsCatalog,
    fourPieceSetStackRuntimeEvidence,
  });
  const afterHealProperty = compileFourPieceSetAfterHealProperty({
    setSkill,
    control,
    closure,
    activeTriggerRows,
    triggerRows,
    propertyRows,
    damageRows,
    resourceRows,
    battleElementsByPathId,
    propertyTagContract,
    triggerContract,
    tuningMechanicsCatalog,
  });
  const beforeSkillComposite = compileFourPieceSetBeforeSkillComposite({
    setSkill,
    control,
    closure,
    activeTriggerRows,
    triggerRows,
    propertyRows,
    damageRows,
    resourceRows,
    battleElementsByPathId,
    triggerContract,
    tuningMechanicsCatalog,
    beforeSkillCompositeRuntimeEvidence,
  });
  const afterDamageTargetProperty =
    compileFourPieceSetAfterDamageTargetProperty({
      setSkill,
      control,
      closure,
      activeTriggerRows,
      triggerRows,
      propertyRows,
      damageRows,
      resourceRows,
      battleElementsByPathId,
      propertyTagContract,
      triggerContract,
      tuningMechanicsCatalog,
      afterDamageTargetPropertyRuntimeEvidence,
    });
  const compiledDynamicEffect =
    beforeDamageStack ??
    afterHealProperty ??
    beforeSkillComposite ??
    afterDamageTargetProperty;
  const sourceIdentityConflict = resolveSetSkillSourceIdentityConflict({
    setSkill,
    evidence: setThreeSourceIdentityEvidence,
  });
  const mechanismFamilies = uniqueStrings([
    ...triggers.map(trigger =>
      trigger.event == null
        ? 'set-skill-trigger-event-source-indexed'
        : `set-skill-${String(trigger.event).toLowerCase()}-effect`
    ),
    ...(triggers.length === 0 && properties.length > 0
      ? ['set-skill-persistent-property']
      : []),
    ...(damageRows.length > 0 ? ['set-skill-vital-change'] : []),
  ]);
  const evidenceGaps = [];
  if (!control) evidenceGaps.push('set-skill-control-source-missing');
  if (missingPathIds.length)
    evidenceGaps.push('set-skill-resource-reference-missing');
  if (closure.rows.length === 0)
    evidenceGaps.push('set-skill-element-closure-empty');
  const runtimeGaps = uniqueStrings(
    persistentCandidate
      ? [...evidenceGaps, ...(persistentRoot?.runtimeGaps ?? [])]
      : compiledDynamicEffect != null
        ? [...evidenceGaps, ...(compiledDynamicEffect.runtimeGaps ?? [])]
        : [
            ...evidenceGaps,
            sourceIdentityConflict?.gapCode ??
              'set-skill-runtime-operator-not-implemented',
          ]
  );
  const runtimeStatus = runtimeGaps.length
    ? 'source-indexed-runtime-unapplied'
    : 'runtime-applied';
  const value = {
    setId: Number(setSkill.setId),
    pieces: Number(setSkill.pieces),
    skillId: Number(setSkill.skillId),
    thresholdActivation: {
      selectedPieceCountRequired: Number(setSkill.pieces),
      comparison: 'selected-piece-count-greater-than-or-equal',
      status:
        runtimeStatus === 'runtime-applied'
          ? 'runtime-applied'
          : 'source-indexed',
      appliedToRuntimeEffect: runtimeStatus === 'runtime-applied',
      sourceIdentity: setSkill.sourceIdentity,
    },
    mechanismFamily:
      runtimeStatus === 'runtime-applied'
        ? compiledDynamicEffect != null
          ? compiledDynamicEffect.mechanismFamily
          : 'set-skill-persistent-property'
        : sourceIdentityConflict != null
          ? 'set-skill-source-identity-conflict'
          : mechanismFamilies.length === 1
            ? mechanismFamilies[0]
            : 'set-skill-composite-effect',
    mechanismFamilies,
    triggers,
    trigger: compiledDynamicEffect?.trigger ?? null,
    effect: compiledDynamicEffect?.effect ?? null,
    immediateEffects: compiledDynamicEffect?.immediateEffects ?? [],
    activationPrerequisites: closure.rows
      .filter(
        row =>
          Array.isArray(row.typetree?.triggerConditionList) &&
          row.typetree.triggerConditionList.length > 0
      )
      .map(row => ({
        elementId: Number(row.typetree?.elementConfigId),
        pathId: Number(row.path_id),
        conditions: projectConditions(row.typetree.triggerConditionList),
        sourceIdentity: createElementIdentity(row),
      })),
    sourceTarget: {
      source: 'equipped-actor',
      triggerTargetTypes: uniqueNumbers(
        activeTriggerRows.map(row => Number(row.typetree?.triggerTargetType))
      ),
      executeTargetTypes: uniqueNumbers(
        closure.rows.map(row => Number(row.typetree?.executeTargetType))
      ),
    },
    lifecycle: {
      properties,
      cooldowns: triggers.map(trigger => ({
        triggerElementId: trigger.elementId,
        intervalMs: trigger.intervalMs,
        triggerCounter: trigger.triggerCounter,
      })),
      inheritTypes: uniqueNumbers(
        closure.rows.map(row => Number(row.typetree?.inheritType))
      ),
    },
    persistentRoot:
      persistentRoot == null
        ? null
        : { ...persistentRoot, status: runtimeStatus },
    resourceTransactions: resourceRows.map(row => ({
      elementId: Number(row.typetree?.elementConfigId),
      recoverType: numberOrNull(row.typetree?.recoverType),
      shareType: numberOrNull(row.typetree?.shareType),
      valueRaw: numberOrNull(
        row.typetree?.formulaParams?.formulaParamValues?.[0] ??
          row.typetree?.functionParams?.[0]
      ),
      sourceIdentity: createElementIdentity(row),
    })),
    vitalChanges: damageRows.map(row => ({
      elementId: Number(row.typetree?.elementConfigId),
      damageType: numberOrNull(row.typetree?.damageType),
      damageElementalType: numberOrNull(row.typetree?.damageElementalType),
      recoverSpRaw: numberOrNull(row.typetree?.recoverSP),
      petRecoverSpRaw: numberOrNull(row.typetree?.petRecoverSP),
      formula: {
        commonFunctionId: numberOrNull(row.typetree?.formulaParams?.function_1),
        baseFunctionId: numberOrNull(row.typetree?.formulaParams?.function_2),
        valueRaw: numberOrNull(
          row.typetree?.formulaParams?.formulaParamValues?.[0]
        ),
      },
      sourceIdentity: createElementIdentity(row),
    })),
    delayedEvents: triggers
      .filter(trigger => Number(trigger.intervalMs) > 0)
      .map(trigger => ({
        triggerElementId: trigger.elementId,
        delayOrIntervalMs: trigger.intervalMs,
        sourceIdentity: trigger.sourceIdentity,
        status: runtimeStatus,
      })),
    loopPersistence: {
      status:
        runtimeStatus === 'runtime-applied'
          ? compiledDynamicEffect != null
            ? 'canonical-effect-timeline-applied'
            : 'canonical-static-loadout-applied'
          : 'runtime-unapplied',
      reason:
        runtimeStatus === 'runtime-applied'
          ? null
          : (runtimeGaps[0] ?? 'set-skill-runtime-operator-not-implemented'),
    },
    sourceClosure: {
      controlSkillId: Number(setSkill.skillId),
      controlSourceIdentity: control?.sourceIdentity ?? null,
      resourcePathIds,
      missingPathIds,
      reachablePathIds: closure.rows.map(row => Number(row.path_id)),
      elementIds: closure.rows.map(row =>
        Number(row.typetree?.elementConfigId)
      ),
      propertyElementIds: propertyRows.map(row =>
        Number(row.typetree?.elementConfigId)
      ),
      timelineInjections: structuredClone(control?.timelineInjections ?? []),
    },
    evidenceStatus:
      runtimeStatus === 'runtime-applied'
        ? 'runtime-applied'
        : runtimeGaps.length > 0 &&
            runtimeGaps.every(reason =>
              String(reason).endsWith('-evidence-gap')
            )
          ? 'evidence-insufficient'
          : evidenceGaps.length === 0
            ? 'source-closure-indexed'
            : 'static-evidence-gap',
    runtimeStatus,
    runtimeGaps,
    sourceIdentityConflict,
    sourceIdentity: [setSkill.sourceIdentity, control?.sourceIdentity]
      .concat(compiledDynamicEffect?.sourceIdentity ?? [])
      .concat(sourceIdentityConflict?.sourceIdentity ?? [])
      .filter(Boolean)
      .join('|'),
  };
  return { ...value, mechanicsHash: hashCanonicalValue(value) };
}

function resolveSetSkillSourceIdentityConflict({ setSkill, evidence }) {
  const conclusion = evidence?.conclusion;
  const expectedIdentity = `set-skill:${Number(setSkill.setId)}:${Number(
    setSkill.pieces
  )}`;
  if (
    conclusion?.status !== 'evidence-insufficient' ||
    conclusion?.setSkillIdentity !== expectedIdentity ||
    Number(conclusion?.skillId) !== Number(setSkill.skillId)
  ) {
    return null;
  }
  return {
    status: conclusion.status,
    gapCode: conclusion.gapCode,
    formalTextSemantics: evidence.sourceConflict?.formalTextSemantics ?? null,
    reachableGraphSemantics:
      evidence.sourceConflict?.reachableGraphSemantics ?? null,
    whichSourceIsStale: evidence.sourceConflict?.whichSourceIsStale ?? null,
    safeRuntimeDisposition:
      evidence.sourceConflict?.safeRuntimeDisposition ?? null,
    missingEvidence: structuredClone(
      evidence.sourceConflict?.missingEvidence ?? []
    ),
    sourceIdentity: conclusion.sourceIdentity,
  };
}

function compileFourPieceSetBeforeDamageStack({
  setSkill,
  control,
  closure,
  activeTriggerRows,
  triggerRows,
  propertyRows,
  damageRows,
  resourceRows,
  battleElementsByPathId,
  propertyTagContract,
  triggerContract,
  tuningMechanicsCatalog,
  fourPieceSetStackRuntimeEvidence,
}) {
  if (Number(setSkill.pieces) !== 4) return null;
  const reviewed = fourPieceSetStackRuntimeEvidence?.reviewedDefinitions?.find(
    row =>
      Number(row.setId) === Number(setSkill.setId) &&
      Number(row.pieces) === Number(setSkill.pieces) &&
      Number(row.skillId) === Number(setSkill.skillId)
  );
  if (!reviewed) return null;

  const runtimeGaps = [];
  const trigger = activeTriggerRows.length === 1 ? activeTriggerRows[0] : null;
  const triggerTree = trigger?.typetree ?? {};
  const triggerEffects = Array.isArray(triggerTree.triggerEffectList)
    ? triggerTree.triggerEffectList
    : [];
  const targetPathId = Number(triggerEffects[0]?.targetElement?.m_PathID);
  const reachablePropertyRows = trigger
    ? collectReachableRows(
        Number(trigger.path_id),
        closure.edges,
        battleElementsByPathId
      ).filter(row => propertyRows.some(item => item.path_id === row.path_id))
    : [];
  const property =
    reachablePropertyRows.length === 1 ? reachablePropertyRows[0] : null;
  const propertyTree = property?.typetree ?? {};
  const effectPath = property
    ? findElementPath(targetPathId, Number(property.path_id), closure.edges)
    : null;
  const eventBinding = triggerContract?.eventBindings?.find(
    row => Number(row.value) === Number(triggerTree.triggerParam1)
  );
  const triggerTargetBinding = triggerContract?.triggerTargetBindings?.find(
    row => Number(row.value) === Number(triggerTree.triggerTargetType)
  );
  const effectTargetBinding = triggerContract?.targetBindings?.find(
    row => Number(row.value) === Number(triggerEffects[0]?.targetType)
  );
  const condition = compileTriggerCondition({
    trigger,
    conditions: triggerTree.triggerConditionList ?? [],
    conditionLogicValue: Number(triggerTree.triggerConditionType),
    triggerContract,
    tuningMechanicsCatalog,
    frameAnchor: eventBinding?.frameAnchor ?? null,
    emptyConditionEvidence: {
      status: fourPieceSetStackRuntimeEvidence?.conclusion?.status,
      eventId: Number(reviewed.eventId),
      sourceIdentity:
        fourPieceSetStackRuntimeEvidence?.conclusion?.sourceIdentity,
    },
  });
  const lifecycle = compilePropertyLifecycle({
    property,
    wrapperRows: [],
    unloadTriggers: triggerRows.filter(
      row => Number(row.typetree?.triggerParam1) === 36
    ),
    closure,
    battleElementsByPathId,
    wrapperContract: triggerContract?.buffElementWrapper,
  });
  const unloadPaths = lifecycle?.removalPaths ?? [];
  const matchingUnload = unloadPaths.find(
    row =>
      Number(row.triggerElementId) ===
        Number(reviewed.unloadTriggerElementId) &&
      Number(row.removerElementId) === Number(reviewed.removerElementId) &&
      sameNumbers(row.removedElementIds, reviewed.removedElementIds)
  );
  const commonFunctionId = Number(
    propertyTree.formulaParams?.function_1 ?? propertyTree.baseIntParams?.[0]
  );
  const baseFunctionId = Number(
    propertyTree.formulaParams?.function_2 ?? propertyTree.baseIntParams?.[1]
  );
  const sourceRawA = Number(
    propertyTree.formulaParams?.formulaParamValues?.[0] ??
      propertyTree.functionParams?.[0]
  );
  const commonRatioRaw = Number(
    propertyTree.formulaParams?.formulaParamValues?.[6] ??
      propertyTree.functionParams?.[6]
  );
  const propertyTags = uniqueNumbers(propertyTree.defaultPropertyTags ?? []);
  const supportedPropertyTags = new Set(
    (propertyTagContract?.bindings ?? [])
      .filter(binding => binding.status === 'applied')
      .map(binding => Number(binding.propertyTag))
  );

  if (!control) runtimeGaps.push('set-stack-control-source-missing');
  if (activeTriggerRows.length !== 1)
    runtimeGaps.push('set-stack-active-trigger-not-unique');
  if (
    Number(triggerTree.elementConfigId) !== Number(reviewed.triggerElementId) ||
    Number(triggerTree.triggerParam1) !== Number(reviewed.eventId) ||
    eventBinding?.frameAnchor !== 'hit-before-damage'
  ) {
    runtimeGaps.push('set-stack-before-damage-trigger-source-drift');
  }
  if (
    Number(triggerTree.triggerTargetType) !==
      Number(reviewed.triggerTargetType) ||
    triggerTargetBinding?.sourceKind !== 'equipped-actor-source-events'
  ) {
    runtimeGaps.push('set-stack-trigger-subject-source-drift');
  }
  if (
    Number(triggerTree.triggerConditionType) !==
      Number(reviewed.conditionLogicValue) ||
    !sameConditions(triggerTree.triggerConditionList, reviewed.conditions) ||
    condition?.status !== 'applied'
  ) {
    runtimeGaps.push('set-stack-trigger-condition-source-drift');
  }
  if (
    triggerEffects.length !== 1 ||
    Number(triggerEffects[0]?.targetType) !==
      Number(reviewed.effectTargetType) ||
    effectTargetBinding?.targetKind !== 'self-actor' ||
    !effectPath
  ) {
    runtimeGaps.push('set-stack-effect-target-source-drift');
  }
  if (
    propertyRows.length !== 1 ||
    reachablePropertyRows.length !== 1 ||
    Number(propertyTree.elementConfigId) !==
      Number(reviewed.propertyElementId) ||
    Number(propertyTree.attributeID) !== Number(reviewed.attributeId) ||
    Number(propertyTree.calculateType) !== Number(reviewed.calculateType) ||
    Number(propertyTree.time) !== Number(reviewed.durationMs) ||
    Number(propertyTree.combineType) !== Number(reviewed.combineType) ||
    Number(propertyTree.combineNumber) !== Number(reviewed.combineNumber) ||
    Number(propertyTree.executeTargetType) !==
      Number(reviewed.executeTargetType) ||
    Number(propertyTree.inheritType) !== Number(reviewed.inheritType)
  ) {
    runtimeGaps.push('set-stack-property-source-drift');
  }
  if (
    Number(propertyTree.combineType) !== 4 ||
    fourPieceSetStackRuntimeEvidence?.semantics?.combineType !==
      'overlying-capped-single-aggregate-layer'
  ) {
    runtimeGaps.push('set-stack-overlying-native-evidence-gap');
  }
  if (
    sourceRawA !== Number(reviewed.sourceRawA) ||
    commonFunctionId !== Number(reviewed.commonFunctionId) ||
    baseFunctionId !== Number(reviewed.baseFunctionId) ||
    commonRatioRaw !== Number(reviewed.commonRatioRaw) ||
    commonFunctionId !== 1 ||
    ![3, 5].includes(baseFunctionId)
  ) {
    runtimeGaps.push('set-stack-formula-source-drift');
  }
  if (
    propertyTags.length > 1 ||
    (propertyTags.length === 1 && !supportedPropertyTags.has(propertyTags[0]))
  ) {
    runtimeGaps.push('set-stack-property-tag-source-gap');
  }
  if (damageRows.length > 0 || resourceRows.length > 0) {
    runtimeGaps.push('set-stack-side-branch-unapplied');
  }
  if (!matchingUnload) runtimeGaps.push('set-stack-unload-source-drift');

  const formulaFamily = resolveFormulaFamily({
    commonFunctionId,
    baseFunctionId,
  });
  const sourceIdentity = [
    fourPieceSetStackRuntimeEvidence?.conclusion?.sourceIdentity,
    trigger ? createElementIdentity(trigger) : null,
    property ? createElementIdentity(property) : null,
    matchingUnload?.sourceIdentity,
  ].filter(Boolean);
  return {
    mechanismFamily: 'set-skill-before-damage-stacking-property',
    runtimeGaps: uniqueStrings(runtimeGaps),
    sourceIdentity,
    trigger:
      trigger == null
        ? null
        : {
            elementId: Number(triggerTree.elementConfigId),
            pathId: Number(trigger.path_id),
            eventId: Number(triggerTree.triggerParam1),
            event: eventBinding?.name ?? null,
            frameAnchor: eventBinding?.frameAnchor ?? null,
            intervalMs: numberOrNull(triggerTree.triggerInv),
            intervalSourceIdentity: `${createElementIdentity(trigger)}.triggerInv`,
            condition,
            triggerTargetType: numberOrNull(triggerTree.triggerTargetType),
            triggerTarget: triggerTargetBinding
              ? {
                  kind: triggerTargetBinding.sourceKind,
                  triggerTargetType: Number(triggerTargetBinding.value),
                  triggerTargetTypeName: triggerTargetBinding.enumName,
                  sourceIdentity: `${createElementIdentity(trigger)}.triggerTargetType|${triggerTargetBinding.sourceIdentity}`,
                }
              : null,
            target: effectTargetBinding
              ? {
                  kind: effectTargetBinding.targetKind,
                  effectTargetType: Number(effectTargetBinding.value),
                  effectTargetTypeName: effectTargetBinding.enumName,
                  effectListIndex: 0,
                  targetElementPathId: targetPathId,
                  sourceIdentity: `${createElementIdentity(trigger)}.triggerEffectList[0].targetType|${effectTargetBinding.sourceIdentity}`,
                }
              : null,
            targetKind: effectTargetBinding?.targetKind ?? 'unresolved',
            sourceIdentity: createElementIdentity(trigger),
          },
    effect:
      property == null
        ? null
        : {
            elementId: Number(propertyTree.elementConfigId),
            pathId: Number(property.path_id),
            name: propertyTree.elementName ?? property.name ?? null,
            attributeId: Number(propertyTree.attributeID),
            bucket:
              PROPERTY_BUCKET_BY_CALCULATE_TYPE[
                Number(propertyTree.calculateType)
              ] ?? null,
            calculateType: Number(propertyTree.calculateType),
            propertyTags,
            propertyTagMatchMode:
              propertyTags.length === 0 ? 'unscoped' : 'single-exact',
            propertyTagSourceIdentity: `${createElementIdentity(property)}.defaultPropertyTags`,
            formula: {
              formulaIdentity: `battle-effect-formula:set-skill:${Number(setSkill.skillId)}:${Number(propertyTree.elementConfigId)}:${property.path_id}`,
              commonFunctionId,
              commonExpression: commonFunctionId === 1 ? 'G/10000' : null,
              baseFunctionId,
              baseExpression: baseFunctionId === 3 ? 'A/10000' : 'A',
              commonRatioRaw,
              sourceParameterEncoding: 'battle-element-raw-a',
              family: formulaFamily,
              sourceIdentity: `${createElementIdentity(property)}.formulaParams|functionParams`,
            },
            sourceRawA,
            durationMs: Number(lifecycle?.durationMs),
            leafDurationMs: Number(propertyTree.time),
            lifecycle: {
              ...lifecycle,
              stackLifetime:
                fourPieceSetStackRuntimeEvidence?.semantics?.stackLifetime,
              expiryInterval:
                fourPieceSetStackRuntimeEvidence?.semantics?.expiryInterval,
              unload: matchingUnload,
            },
            stackMode: 'stack',
            stackDelta: 1,
            maxStacks: Math.max(1, Number(propertyTree.combineNumber) || 1),
            combineType: Number(propertyTree.combineType),
            combineNumber: Number(propertyTree.combineNumber),
            valuesByStar: [
              {
                star: 1,
                valueRaw: sourceRawA,
                sourceIdentity: `${createElementIdentity(property)}.formulaParams.formulaParamValues[0]`,
              },
            ],
            sourceIdentity: createElementIdentity(property),
          },
  };
}

function compileFourPieceSetAfterDamageTargetProperty({
  setSkill,
  control,
  closure,
  activeTriggerRows,
  triggerRows,
  propertyRows,
  damageRows,
  resourceRows,
  battleElementsByPathId,
  propertyTagContract,
  triggerContract,
  tuningMechanicsCatalog,
  afterDamageTargetPropertyRuntimeEvidence,
}) {
  if (Number(setSkill.pieces) !== 4) return null;
  const reviewed = afterDamageTargetPropertyRuntimeEvidence?.reviewedDefinition;
  if (
    Number(reviewed?.setId) !== Number(setSkill.setId) ||
    Number(reviewed?.pieces) !== Number(setSkill.pieces) ||
    Number(reviewed?.skillId) !== Number(setSkill.skillId)
  ) {
    return null;
  }

  const runtimeGaps = [];
  const trigger = activeTriggerRows.length === 1 ? activeTriggerRows[0] : null;
  const triggerTree = trigger?.typetree ?? {};
  const triggerEffects = Array.isArray(triggerTree.triggerEffectList)
    ? triggerTree.triggerEffectList
    : [];
  const targetPathId = Number(triggerEffects[0]?.targetElement?.m_PathID);
  const wrapper = battleElementsByPathId.get(targetPathId) ?? null;
  const wrapperTree = wrapper?.typetree ?? {};
  const injectedPathIds = uniqueNumbers(
    (wrapperTree.injectElementDataList ?? []).map(entry =>
      Number(entry?.m_PathID)
    )
  );
  const reviewedProperties = (reviewed.properties ?? []).map(source => ({
    source,
    row:
      propertyRows.find(
        row =>
          Number(row.path_id) === Number(source.pathId) &&
          Number(row.typetree?.elementConfigId) === Number(source.elementId)
      ) ?? null,
  }));
  const eventBinding = triggerContract?.eventBindings?.find(
    row => Number(row.value) === Number(triggerTree.triggerParam1)
  );
  const triggerTargetBinding = triggerContract?.triggerTargetBindings?.find(
    row => Number(row.value) === Number(triggerTree.triggerTargetType)
  );
  const effectTargetBinding = triggerContract?.targetBindings?.find(
    row => Number(row.value) === Number(triggerEffects[0]?.targetType)
  );
  const condition = compileTriggerCondition({
    trigger,
    conditions: triggerTree.triggerConditionList ?? [],
    conditionLogicValue: Number(triggerTree.triggerConditionType),
    triggerContract,
    tuningMechanicsCatalog,
    frameAnchor: eventBinding?.frameAnchor ?? null,
  });
  const unloadTriggers = triggerRows.filter(
    row => Number(row.typetree?.triggerParam1) === 36
  );
  const propertyLifecycles = reviewedProperties.map(({ row }) =>
    compilePropertyLifecycle({
      property: row,
      wrapperRows: wrapper ? [wrapper] : [],
      unloadTriggers,
      closure,
      battleElementsByPathId,
      wrapperContract: triggerContract?.buffElementWrapper,
    })
  );
  const matchingUnload = (propertyLifecycles[0]?.removalPaths ?? []).find(
    row =>
      Number(row.triggerElementId) ===
        Number(reviewed.unloadTriggerElementId) &&
      Number(row.triggerPathId) === Number(reviewed.unloadTriggerPathId) &&
      Number(row.removerElementId) === Number(reviewed.removerElementId) &&
      Number(row.removerPathId) === Number(reviewed.removerPathId) &&
      sameNumbers(row.removedElementIds, reviewed.removedElementIds)
  );
  const supportedPropertyTags = new Set(
    (propertyTagContract?.bindings ?? [])
      .filter(binding => binding.status === 'applied')
      .map(binding => Number(binding.propertyTag))
  );

  if (!control)
    runtimeGaps.push('set-after-damage-target-control-source-missing');
  if (activeTriggerRows.length !== 1)
    runtimeGaps.push('set-after-damage-target-active-trigger-not-unique');
  if (
    Number(triggerTree.elementConfigId) !== Number(reviewed.triggerElementId) ||
    Number(trigger?.path_id) !== Number(reviewed.triggerPathId) ||
    Number(triggerTree.triggerType) !== Number(reviewed.triggerType) ||
    Number(triggerTree.triggerParam1) !== Number(reviewed.eventId) ||
    eventBinding?.frameAnchor !== 'hit-after-damage' ||
    Number(triggerTree.triggerCounter) !== Number(reviewed.triggerCounter)
  ) {
    runtimeGaps.push('set-after-damage-target-trigger-source-drift');
  }
  if (
    Number(triggerTree.triggerTargetType) !==
      Number(reviewed.triggerTargetType) ||
    triggerTargetBinding?.sourceKind !== 'equipped-actor-source-events'
  ) {
    runtimeGaps.push('set-after-damage-target-observer-source-drift');
  }
  if (
    Number(triggerTree.triggerConditionType) !==
      Number(reviewed.conditionLogicValue) ||
    !sameConditions(triggerTree.triggerConditionList, reviewed.conditions) ||
    condition?.status !== 'applied' ||
    condition?.logic !== 'or'
  ) {
    runtimeGaps.push('set-after-damage-target-condition-source-drift');
  }
  if (
    triggerEffects.length !== 1 ||
    Number(triggerEffects[0]?.targetType) !==
      Number(reviewed.effectTargetType) ||
    effectTargetBinding?.enumName !== 'Target' ||
    effectTargetBinding?.status !== 'applied' ||
    !wrapper ||
    Number(wrapper.path_id) !== Number(reviewed.wrapperPathId) ||
    Number(wrapperTree.elementConfigId) !== Number(reviewed.wrapperElementId)
  ) {
    runtimeGaps.push('set-after-damage-target-routing-source-drift');
  }
  if (
    Number(wrapperTree.time) !== Number(reviewed.wrapperDurationMs) ||
    Number(wrapperTree.combineType) !== Number(reviewed.wrapperCombineType) ||
    !sameNumbers(
      injectedPathIds,
      (reviewed.properties ?? []).map(row => Number(row.pathId))
    )
  ) {
    runtimeGaps.push('set-after-damage-target-wrapper-source-drift');
  }
  if (
    propertyRows.length !== reviewedProperties.length ||
    reviewedProperties.some(({ row }) => !row)
  ) {
    runtimeGaps.push('set-after-damage-target-property-set-source-drift');
  }
  for (const [index, { source, row }] of reviewedProperties.entries()) {
    const tree = row?.typetree ?? {};
    const lifecycle = propertyLifecycles[index];
    const propertyTags = uniqueNumbers(tree.defaultPropertyTags ?? []);
    if (
      Number(tree.elementConfigId) !== Number(source.elementId) ||
      Number(row?.path_id) !== Number(source.pathId) ||
      Number(tree.attributeID) !== Number(source.attributeId) ||
      Number(tree.calculateType) !== Number(source.calculateType) ||
      Number(tree.formulaParams?.formulaParamValues?.[0]) !==
        Number(source.sourceRawA) ||
      Number(tree.formulaParams?.function_1) !==
        Number(source.commonFunctionId) ||
      Number(tree.formulaParams?.function_2) !==
        Number(source.baseFunctionId) ||
      Number(tree.formulaParams?.formulaParamValues?.[6]) !==
        Number(source.commonRatioRaw) ||
      Number(tree.time) !== Number(source.leafDurationMs) ||
      Number(tree.combineType) !== Number(source.combineType) ||
      Number(tree.combineNumber) !== Number(source.combineNumber) ||
      Number(tree.executeTargetType) !== Number(source.executeTargetType) ||
      Number(tree.inheritType) !== Number(source.inheritType) ||
      !findElementPath(targetPathId, Number(row?.path_id), closure.edges) ||
      lifecycle?.sourceKind !== 'battle-buff-element-wrapper' ||
      Number(lifecycle?.durationMs) !== Number(reviewed.wrapperDurationMs)
    ) {
      runtimeGaps.push(
        `set-after-damage-target-property-${Number(source.elementId)}-source-drift`
      );
    }
    if (
      propertyTags.length > 1 ||
      (propertyTags.length === 1 && !supportedPropertyTags.has(propertyTags[0]))
    ) {
      runtimeGaps.push(
        `set-after-damage-target-property-${Number(source.elementId)}-tag-gap`
      );
    }
  }
  if (damageRows.length > 0 || resourceRows.length > 0) {
    runtimeGaps.push('set-after-damage-target-side-branch-unapplied');
  }
  if (!matchingUnload)
    runtimeGaps.push('set-after-damage-target-unload-source-drift');
  if (
    afterDamageTargetPropertyRuntimeEvidence?.semantics
      ?.currentPacketVisibility !== 'not-visible-to-triggering-packet' ||
    afterDamageTargetPropertyRuntimeEvidence?.semantics
      ?.triggerCounterLifetime !==
      'finite-positive-999999-not-unlimited-sentinel' ||
    afterDamageTargetPropertyRuntimeEvidence?.semantics
      ?.triggerCounterCommit !==
      'increment-on-accepted-trigger-and-free-source-at-positive-limit' ||
    afterDamageTargetPropertyRuntimeEvidence?.semantics?.effectTarget !==
      'native-damage-event-target-entity' ||
    afterDamageTargetPropertyRuntimeEvidence?.sourceConflict?.resolution !==
      'executable-wrapper-and-property-leaves-control-value-and-duration'
  ) {
    runtimeGaps.push('set-after-damage-target-native-evidence-drift');
  }

  const propertyEffects = reviewedProperties.map(({ source, row }, index) => {
    const tree = row?.typetree ?? {};
    const propertyTags = uniqueNumbers(tree.defaultPropertyTags ?? []);
    const commonFunctionId = Number(tree.formulaParams?.function_1);
    const baseFunctionId = Number(tree.formulaParams?.function_2);
    const sourceRawA = Number(tree.formulaParams?.formulaParamValues?.[0]);
    return {
      elementId: Number(tree.elementConfigId),
      pathId: Number(row?.path_id),
      name: tree.elementName ?? row?.name ?? null,
      attributeId: Number(tree.attributeID),
      bucket:
        PROPERTY_BUCKET_BY_CALCULATE_TYPE[Number(tree.calculateType)] ?? null,
      calculateType: Number(tree.calculateType),
      propertyTags,
      propertyTagMatchMode:
        propertyTags.length === 0 ? 'unscoped' : 'single-exact',
      propertyTagSourceIdentity: `${createElementIdentity(row)}.defaultPropertyTags`,
      formula: {
        formulaIdentity: `battle-effect-formula:set-skill:${Number(setSkill.skillId)}:${Number(tree.elementConfigId)}:${row?.path_id}`,
        commonFunctionId,
        commonExpression: commonFunctionId === 1 ? 'G/10000' : null,
        baseFunctionId,
        baseExpression: baseFunctionId === 3 ? 'A/10000' : 'A',
        commonRatioRaw: Number(tree.formulaParams?.formulaParamValues?.[6]),
        sourceParameterEncoding: 'battle-element-raw-a',
        family: resolveFormulaFamily({ commonFunctionId, baseFunctionId }),
        sourceIdentity: `${createElementIdentity(row)}.formulaParams|functionParams`,
      },
      sourceRawA,
      valuesByStar: [
        {
          star: 1,
          valueRaw: sourceRawA,
          sourceIdentity: `${createElementIdentity(row)}.formulaParams.formulaParamValues[0]`,
        },
      ],
      leafDurationMs: Number(tree.time),
      lifecycle: propertyLifecycles[index],
      sourceIdentity: createElementIdentity(row),
    };
  });
  const sourceIdentity = [
    afterDamageTargetPropertyRuntimeEvidence?.conclusion?.sourceIdentity,
    trigger ? createElementIdentity(trigger) : null,
    wrapper ? createElementIdentity(wrapper) : null,
    ...reviewedProperties.map(({ row }) =>
      row ? createElementIdentity(row) : null
    ),
    matchingUnload?.sourceIdentity,
  ].filter(Boolean);
  return {
    mechanismFamily: 'set-skill-after-damage-target-property',
    runtimeGaps: uniqueStrings(runtimeGaps),
    sourceIdentity,
    trigger:
      trigger == null
        ? null
        : {
            elementId: Number(triggerTree.elementConfigId),
            pathId: Number(trigger.path_id),
            eventId: Number(triggerTree.triggerParam1),
            event: eventBinding?.name ?? null,
            frameAnchor: eventBinding?.frameAnchor ?? null,
            triggerType: numberOrNull(triggerTree.triggerType),
            intervalMs: numberOrNull(triggerTree.triggerInv),
            intervalSourceIdentity: `${createElementIdentity(trigger)}.triggerInv`,
            triggerCounter: numberOrNull(triggerTree.triggerCounter),
            condition,
            triggerTargetType: numberOrNull(triggerTree.triggerTargetType),
            triggerTarget: triggerTargetBinding
              ? {
                  kind: triggerTargetBinding.sourceKind,
                  triggerTargetType: Number(triggerTargetBinding.value),
                  triggerTargetTypeName: triggerTargetBinding.enumName,
                  sourceIdentity: `${createElementIdentity(trigger)}.triggerTargetType|${triggerTargetBinding.sourceIdentity}`,
                }
              : null,
            target: {
              kind: 'event-target-entity',
              effectTargetType: Number(triggerEffects[0]?.targetType),
              effectTargetTypeName: effectTargetBinding?.enumName ?? null,
              effectListIndex: 0,
              targetElementPathId: targetPathId,
              sourceIdentity: `${createElementIdentity(trigger)}.triggerEffectList[0].targetType|${effectTargetBinding?.sourceIdentity ?? 'unresolved'}|${afterDamageTargetPropertyRuntimeEvidence?.conclusion?.sourceIdentity}`,
            },
            targetKind: 'event-target-entity',
            sourceIdentity: createElementIdentity(trigger),
          },
    effect:
      wrapper == null
        ? null
        : {
            elementId: Number(wrapperTree.elementConfigId),
            pathId: Number(wrapper.path_id),
            name: wrapperTree.elementName ?? wrapper.name ?? null,
            durationMs: Number(wrapperTree.time),
            stackMode: 'refresh',
            stackDelta: 1,
            maxStacks: 1,
            combineType: Number(wrapperTree.combineType),
            combineNumber: Number(wrapperTree.combineNumber),
            propertyEffects,
            lifecycle: {
              sourceKind: 'battle-buff-element-wrapper',
              durationMs: Number(wrapperTree.time),
              wrapper: propertyLifecycles[0]?.wrapper ?? null,
              propertyLifecycles,
              unload: matchingUnload ?? null,
              unloadDisposition:
                afterDamageTargetPropertyRuntimeEvidence?.semantics?.unload,
              expiryInterval:
                afterDamageTargetPropertyRuntimeEvidence?.semantics
                  ?.expiryInterval,
            },
            sourceConflict: structuredClone(
              afterDamageTargetPropertyRuntimeEvidence?.sourceConflict ?? null
            ),
            sourceIdentity: createElementIdentity(wrapper),
          },
  };
}

function compileFourPieceSetBeforeSkillComposite({
  setSkill,
  control,
  closure,
  activeTriggerRows,
  triggerRows,
  propertyRows,
  damageRows,
  resourceRows,
  battleElementsByPathId,
  triggerContract,
  tuningMechanicsCatalog,
  beforeSkillCompositeRuntimeEvidence,
}) {
  if (Number(setSkill.pieces) !== 4) return null;
  const reviewed = beforeSkillCompositeRuntimeEvidence?.reviewedDefinition;
  if (
    Number(reviewed?.setId) !== Number(setSkill.setId) ||
    Number(reviewed?.pieces) !== Number(setSkill.pieces) ||
    Number(reviewed?.skillId) !== Number(setSkill.skillId)
  ) {
    return null;
  }

  const runtimeGaps = [];
  const trigger = activeTriggerRows.length === 1 ? activeTriggerRows[0] : null;
  const triggerTree = trigger?.typetree ?? {};
  const triggerEffects = Array.isArray(triggerTree.triggerEffectList)
    ? triggerTree.triggerEffectList
    : [];
  const eventBinding = triggerContract?.eventBindings?.find(
    binding => Number(binding.value) === Number(triggerTree.triggerParam1)
  );
  const triggerTargetBinding = triggerContract?.triggerTargetBindings?.find(
    binding => Number(binding.value) === Number(triggerTree.triggerTargetType)
  );
  const condition = compileTriggerCondition({
    trigger,
    conditions: triggerTree.triggerConditionList ?? [],
    conditionLogicValue: Number(triggerTree.triggerConditionType),
    triggerContract,
    tuningMechanicsCatalog,
    frameAnchor: eventBinding?.frameAnchor ?? null,
  });
  const effectRows = triggerEffects.map(
    effect =>
      battleElementsByPathId.get(Number(effect?.targetElement?.m_PathID)) ??
      null
  );
  const removalPaths = projectUnloadRemovalPaths({
    unloadTriggers: triggerRows.filter(
      row => Number(row.typetree?.triggerParam1) === 36
    ),
    closure,
    battleElementsByPathId,
  });
  const matchingUnload = removalPaths.find(
    row =>
      Number(row.triggerElementId) ===
        Number(reviewed.unloadTriggerElementId) &&
      Number(row.removerElementId) === Number(reviewed.removerElementId) &&
      sameNumbers(row.removedElementIds, reviewed.removedElementIds)
  );

  if (!control)
    runtimeGaps.push('set-before-skill-composite-control-source-missing');
  if (activeTriggerRows.length !== 1) {
    runtimeGaps.push('set-before-skill-composite-active-trigger-not-unique');
  }
  if (
    Number(triggerTree.elementConfigId) !== Number(reviewed.triggerElementId) ||
    Number(trigger?.path_id) !== Number(reviewed.triggerPathId) ||
    Number(triggerTree.triggerParam1) !== Number(reviewed.eventId) ||
    eventBinding?.frameAnchor !== 'action-start'
  ) {
    runtimeGaps.push('set-before-skill-composite-trigger-source-drift');
  }
  if (
    Number(triggerTree.triggerTargetType) !==
      Number(reviewed.triggerTargetType) ||
    triggerTargetBinding?.sourceKind !== 'equipped-actor-source-events'
  ) {
    runtimeGaps.push('set-before-skill-composite-trigger-subject-source-drift');
  }
  if (
    Number(triggerTree.triggerConditionType) !==
      Number(reviewed.conditionLogicValue) ||
    !sameConditions(triggerTree.triggerConditionList, reviewed.conditions) ||
    condition?.logic !== 'and' ||
    condition?.status !== 'applied'
  ) {
    runtimeGaps.push('set-before-skill-composite-condition-source-drift');
  }
  if (
    Number(triggerTree.triggerInv) !== Number(reviewed.intervalMs) ||
    Number(triggerTree.triggerCounter) !== Number(reviewed.triggerCounter) ||
    beforeSkillCompositeRuntimeEvidence?.semantics
      ?.conditionFailureConsumesInterval !== false ||
    beforeSkillCompositeRuntimeEvidence?.semantics?.intervalBoundary !==
      'right-open-suppression-exact-boundary-admitted'
  ) {
    runtimeGaps.push('set-before-skill-composite-interval-source-drift');
  }
  if (
    triggerEffects.length !== reviewed.effects.length ||
    effectRows.some(
      (row, index) =>
        Number(row?.typetree?.elementConfigId) !==
        Number(reviewed.effects[index]?.elementId)
    )
  ) {
    runtimeGaps.push('set-before-skill-composite-effect-order-source-drift');
  }
  if (
    propertyRows.length > 0 ||
    damageRows.length !== 1 ||
    resourceRows.length !== 1
  ) {
    runtimeGaps.push('set-before-skill-composite-effect-family-source-drift');
  }
  if (!matchingUnload) {
    runtimeGaps.push('set-before-skill-composite-unload-source-drift');
  }

  const immediateEffects = reviewed.effects.map((reviewedEffect, index) => {
    const effectRow = effectRows[index];
    const tree = effectRow?.typetree ?? {};
    const sourceEffect = triggerEffects[index];
    const targetBinding = triggerContract?.targetBindings?.find(
      binding => Number(binding.value) === Number(sourceEffect?.targetType)
    );
    const commonFunctionId = numberOrNull(
      tree.formulaParams?.function_1 ?? tree.baseIntParams?.[0]
    );
    const baseFunctionId = numberOrNull(
      tree.formulaParams?.function_2 ?? tree.baseIntParams?.[1]
    );
    const sourceRawA = numberOrNull(
      tree.formulaParams?.formulaParamValues?.[0] ?? tree.functionParams?.[0]
    );
    if (
      Number(sourceEffect?.targetType) !== Number(reviewedEffect.targetType) ||
      Number(sourceEffect?.targetElement?.m_PathID) !==
        Number(reviewedEffect.pathId) ||
      targetBinding?.targetKind == null ||
      commonFunctionId !== Number(reviewedEffect.commonFunctionId) ||
      baseFunctionId !== Number(reviewedEffect.baseFunctionId)
    ) {
      runtimeGaps.push(
        `set-before-skill-composite-effect-${index}-source-drift`
      );
    }
    const sourceIdentity = [
      `${createElementIdentity(trigger)}.triggerEffectList[${index}]`,
      effectRow ? createElementIdentity(effectRow) : null,
      targetBinding?.sourceIdentity,
      beforeSkillCompositeRuntimeEvidence?.conclusion?.sourceIdentity,
    ]
      .filter(Boolean)
      .join('|');
    if (reviewedEffect.kind === 'direct-sp') {
      if (
        Number(tree.recoverType) !== Number(reviewedEffect.recoverType) ||
        Number(tree.shareType) !== Number(reviewedEffect.shareType) ||
        Number(tree.petShareType) !== Number(reviewedEffect.petShareType) ||
        Number(tree.mainPetShareType) !==
          Number(reviewedEffect.mainPetShareType) ||
        sourceRawA !== Number(reviewedEffect.sourceRawValue)
      ) {
        runtimeGaps.push('set-before-skill-composite-sp-source-drift');
      }
      return {
        kind: 'direct-sp',
        effectIndex: index,
        elementId: Number(tree.elementConfigId),
        pathId: Number(effectRow?.path_id),
        targetKind: targetBinding?.targetKind ?? 'unresolved',
        targetType: Number(sourceEffect?.targetType),
        recoverType: Number(tree.recoverType),
        shareType: Number(tree.shareType),
        petShareType: Number(tree.petShareType),
        mainPetShareType: Number(tree.mainPetShareType),
        sourceRawValue: sourceRawA,
        formula: {
          commonFunctionId,
          baseFunctionId,
          commonExpression: 'G/10000',
          baseExpression: 'A',
          sourceRawA,
          sourceIdentity: `${createElementIdentity(effectRow)}.formulaParams|functionParams`,
        },
        sourceIdentity,
      };
    }
    if (
      Number(tree.damageType) !== Number(reviewedEffect.damageType) ||
      sourceRawA !== Number(reviewedEffect.sourceRawA) ||
      reviewedEffect.baseExpression !== '(target.MAXHP[0]*A)/10000'
    ) {
      runtimeGaps.push('set-before-skill-composite-heal-source-drift');
    }
    return {
      kind: 'direct-heal',
      effectIndex: index,
      elementId: Number(tree.elementConfigId),
      pathId: Number(effectRow?.path_id),
      targetKind: targetBinding?.targetKind ?? 'unresolved',
      targetType: Number(sourceEffect?.targetType),
      damageType: Number(tree.damageType),
      sourceRawValue: sourceRawA,
      formula: {
        formulaIdentity: `battle-effect-formula:set-skill:${Number(setSkill.skillId)}:${Number(tree.elementConfigId)}:${Number(effectRow?.path_id)}`,
        commonFunctionId,
        commonExpression: 'G/10000',
        baseFunctionId,
        baseExpression: reviewedEffect.baseExpression,
        sourceRawA,
        commonRatioRaw: numberOrNull(
          tree.formulaParams?.formulaParamValues?.[6] ??
            tree.functionParams?.[6]
        ),
        sourceIdentity: `${createElementIdentity(effectRow)}.formulaParams|functionParams|NewTable/element_formula.rows[id=${baseFunctionId}]`,
      },
      sourceIdentity,
    };
  });

  return {
    mechanismFamily: 'set-skill-before-skill-composite-immediate',
    runtimeGaps: uniqueStrings(runtimeGaps),
    sourceIdentity: [
      beforeSkillCompositeRuntimeEvidence?.conclusion?.sourceIdentity,
      trigger ? createElementIdentity(trigger) : null,
      ...immediateEffects.map(effect => effect.sourceIdentity),
      matchingUnload?.sourceIdentity,
    ].filter(Boolean),
    trigger:
      trigger == null
        ? null
        : {
            elementId: Number(triggerTree.elementConfigId),
            pathId: Number(trigger.path_id),
            eventId: Number(triggerTree.triggerParam1),
            event: eventBinding?.name ?? null,
            frameAnchor: eventBinding?.frameAnchor ?? null,
            intervalMs: numberOrNull(triggerTree.triggerInv),
            triggerCounter: numberOrNull(triggerTree.triggerCounter),
            intervalSourceIdentity: `${createElementIdentity(trigger)}.triggerInv|${beforeSkillCompositeRuntimeEvidence?.conclusion?.sourceIdentity}`,
            condition,
            triggerTargetType: numberOrNull(triggerTree.triggerTargetType),
            triggerTarget: triggerTargetBinding
              ? {
                  kind: triggerTargetBinding.sourceKind,
                  triggerTargetType: Number(triggerTargetBinding.value),
                  triggerTargetTypeName: triggerTargetBinding.enumName,
                  sourceIdentity: `${createElementIdentity(trigger)}.triggerTargetType|${triggerTargetBinding.sourceIdentity}`,
                }
              : null,
            target: null,
            targetKind: 'composite-effect-targets',
            sourceIdentity: createElementIdentity(trigger),
          },
    effect: null,
    immediateEffects,
    unload: matchingUnload ?? null,
  };
}

function compileFourPieceSetAfterHealProperty({
  setSkill,
  control,
  closure,
  activeTriggerRows,
  triggerRows,
  propertyRows,
  damageRows,
  resourceRows,
  battleElementsByPathId,
  propertyTagContract,
  triggerContract,
  tuningMechanicsCatalog,
}) {
  if (Number(setSkill.pieces) !== 4) return null;
  const trigger = activeTriggerRows.length === 1 ? activeTriggerRows[0] : null;
  const triggerTree = trigger?.typetree ?? {};
  const eventBinding = triggerContract?.eventBindings?.find(
    binding => Number(binding.value) === Number(triggerTree.triggerParam1)
  );
  if (eventBinding?.frameAnchor !== 'heal-after-settlement') return null;

  const runtimeGaps = [];
  const triggerEffects = Array.isArray(triggerTree.triggerEffectList)
    ? triggerTree.triggerEffectList
    : [];
  const targetPathId = Number(triggerEffects[0]?.targetElement?.m_PathID);
  const reachablePropertyRows = trigger
    ? collectReachableRows(
        Number(trigger.path_id),
        closure.edges,
        battleElementsByPathId
      ).filter(row => propertyRows.some(item => item.path_id === row.path_id))
    : [];
  const property =
    reachablePropertyRows.length === 1 ? reachablePropertyRows[0] : null;
  const propertyTree = property?.typetree ?? {};
  const effectPath = property
    ? findElementPath(targetPathId, Number(property.path_id), closure.edges)
    : null;
  const triggerTargetBinding = triggerContract?.triggerTargetBindings?.find(
    binding => Number(binding.value) === Number(triggerTree.triggerTargetType)
  );
  const effectTargetBinding = triggerContract?.targetBindings?.find(
    binding => Number(binding.value) === Number(triggerEffects[0]?.targetType)
  );
  const condition = compileTriggerCondition({
    trigger,
    conditions: triggerTree.triggerConditionList ?? [],
    conditionLogicValue: Number(triggerTree.triggerConditionType),
    triggerContract,
    tuningMechanicsCatalog,
    frameAnchor: eventBinding.frameAnchor,
  });
  const lifecycle = compilePropertyLifecycle({
    property,
    wrapperRows: [],
    unloadTriggers: triggerRows.filter(
      row => Number(row.typetree?.triggerParam1) === 36
    ),
    closure,
    battleElementsByPathId,
    wrapperContract: triggerContract?.buffElementWrapper,
  });
  const commonFunctionId = Number(
    propertyTree.formulaParams?.function_1 ?? propertyTree.baseIntParams?.[0]
  );
  const baseFunctionId = Number(
    propertyTree.formulaParams?.function_2 ?? propertyTree.baseIntParams?.[1]
  );
  const sourceRawA = Number(
    propertyTree.formulaParams?.formulaParamValues?.[0] ??
      propertyTree.functionParams?.[0]
  );
  const commonRatioRaw = Number(
    propertyTree.formulaParams?.formulaParamValues?.[6] ??
      propertyTree.functionParams?.[6]
  );
  const propertyTags = uniqueNumbers(propertyTree.defaultPropertyTags ?? []);
  const supportedPropertyTags = new Set(
    (propertyTagContract?.bindings ?? [])
      .filter(binding => binding.status === 'applied')
      .map(binding => Number(binding.propertyTag))
  );
  const removalPaths = lifecycle?.removalPaths ?? [];
  const sourceObserver = triggerContract?.nonDamageRuntime?.sourceObserver;

  if (!control) runtimeGaps.push('set-after-heal-control-source-missing');
  if (activeTriggerRows.length !== 1)
    runtimeGaps.push('set-after-heal-active-trigger-not-unique');
  if (
    Number(triggerTree.triggerParam1) !== 44 ||
    eventBinding.frameAnchor !== 'heal-after-settlement' ||
    triggerContract?.nonDamageRuntime?.afterHeal?.dispatchAfterSettlement !==
      true
  ) {
    runtimeGaps.push('set-after-heal-event-source-drift');
  }
  if (
    Number(triggerTree.triggerTargetType) !== 2 ||
    triggerTargetBinding?.sourceKind !== 'event-source-actor-events' ||
    Number(sourceObserver?.triggerTargetType) !== 2 ||
    sourceObserver?.runtimeSourceKind !== 'event-source-actor-events'
  ) {
    runtimeGaps.push('set-after-heal-source-observer-evidence-gap');
  }
  if (
    Number(triggerTree.triggerConditionType) !== 1 ||
    (triggerTree.triggerConditionList ?? []).length !== 0 ||
    condition?.kind !== 'always' ||
    condition?.logic !== 'or' ||
    condition?.status !== 'applied' ||
    triggerContract?.nonDamageRuntime?.emptyConditionSemantics
      ?.emptyOrResult !== true
  ) {
    runtimeGaps.push('set-after-heal-empty-or-evidence-gap');
  }
  if (
    triggerEffects.length !== 1 ||
    Number(triggerEffects[0]?.targetType) !== 1 ||
    effectTargetBinding?.targetKind !== 'event-target-actor' ||
    !effectPath
  ) {
    runtimeGaps.push('set-after-heal-target-routing-source-drift');
  }
  if (
    propertyRows.length !== 1 ||
    reachablePropertyRows.length !== 1 ||
    Number(propertyTree.calculateType) !== 2 ||
    !(Number(lifecycle?.durationMs) > 0) ||
    Number(propertyTree.combineType) !== 3 ||
    Number(propertyTree.combineNumber) !== -1 ||
    Number(propertyTree.inheritType) !== 0
  ) {
    runtimeGaps.push('set-after-heal-property-source-drift');
  }
  if (
    commonFunctionId !== 1 ||
    baseFunctionId !== 3 ||
    commonRatioRaw !== 10_000 ||
    !Number.isFinite(sourceRawA)
  ) {
    runtimeGaps.push('set-after-heal-formula-source-drift');
  }
  if (
    propertyTags.length > 1 ||
    (propertyTags.length === 1 && !supportedPropertyTags.has(propertyTags[0]))
  ) {
    runtimeGaps.push('set-after-heal-property-tag-source-gap');
  }
  if (damageRows.length > 0 || resourceRows.length > 0) {
    runtimeGaps.push('set-after-heal-side-branch-unapplied');
  }
  if (removalPaths.length === 0) {
    runtimeGaps.push('set-after-heal-unload-source-drift');
  }

  const formulaFamily = resolveFormulaFamily({
    commonFunctionId,
    baseFunctionId,
  });
  const sourceIdentity = [
    triggerContract?.nonDamageRuntime?.sourceIdentity,
    trigger ? createElementIdentity(trigger) : null,
    property ? createElementIdentity(property) : null,
    ...removalPaths.map(row => row.sourceIdentity),
  ].filter(Boolean);
  return {
    mechanismFamily: 'set-skill-after-heal-source-to-target-property',
    runtimeGaps: uniqueStrings(runtimeGaps),
    sourceIdentity,
    trigger:
      trigger == null
        ? null
        : {
            elementId: Number(triggerTree.elementConfigId),
            pathId: Number(trigger.path_id),
            eventId: Number(triggerTree.triggerParam1),
            event: eventBinding.name,
            frameAnchor: eventBinding.frameAnchor,
            intervalMs: numberOrNull(triggerTree.triggerInv),
            intervalSourceIdentity: `${createElementIdentity(trigger)}.triggerInv`,
            condition,
            triggerTargetType: numberOrNull(triggerTree.triggerTargetType),
            triggerTarget: {
              kind: triggerTargetBinding?.sourceKind ?? 'unresolved',
              triggerTargetType: Number(triggerTargetBinding?.value),
              triggerTargetTypeName: triggerTargetBinding?.enumName ?? null,
              sourceIdentity: `${createElementIdentity(trigger)}.triggerTargetType|${triggerTargetBinding?.sourceIdentity ?? 'unresolved'}`,
            },
            target: {
              kind: effectTargetBinding?.targetKind ?? 'unresolved',
              effectTargetType: Number(effectTargetBinding?.value),
              effectTargetTypeName: effectTargetBinding?.enumName ?? null,
              effectListIndex: 0,
              targetElementPathId: targetPathId,
              sourceIdentity: `${createElementIdentity(trigger)}.triggerEffectList[0].targetType|${effectTargetBinding?.sourceIdentity ?? 'unresolved'}`,
            },
            targetKind: effectTargetBinding?.targetKind ?? 'unresolved',
            sourceIdentity: createElementIdentity(trigger),
          },
    effect:
      property == null
        ? null
        : {
            elementId: Number(propertyTree.elementConfigId),
            pathId: Number(property.path_id),
            name: propertyTree.elementName ?? property.name ?? null,
            attributeId: Number(propertyTree.attributeID),
            bucket:
              PROPERTY_BUCKET_BY_CALCULATE_TYPE[
                Number(propertyTree.calculateType)
              ] ?? null,
            calculateType: Number(propertyTree.calculateType),
            propertyTags,
            propertyTagMatchMode:
              propertyTags.length === 0 ? 'unscoped' : 'single-exact',
            propertyTagSourceIdentity: `${createElementIdentity(property)}.defaultPropertyTags`,
            formula: {
              formulaIdentity: `battle-effect-formula:set-skill:${Number(setSkill.skillId)}:${Number(propertyTree.elementConfigId)}:${property.path_id}`,
              commonFunctionId,
              commonExpression: 'G/10000',
              baseFunctionId,
              baseExpression: 'A/10000',
              commonRatioRaw,
              sourceParameterEncoding: 'battle-element-raw-a',
              family: formulaFamily,
              sourceIdentity: `${createElementIdentity(property)}.formulaParams|functionParams`,
            },
            sourceRawA,
            durationMs: Number(lifecycle?.durationMs),
            leafDurationMs: Number(propertyTree.time),
            lifecycle: {
              ...lifecycle,
              expiryInterval: 'right-open',
              unload: removalPaths,
            },
            stackMode: 'refresh',
            stackDelta: 1,
            maxStacks: 1,
            combineType: Number(propertyTree.combineType),
            combineNumber: Number(propertyTree.combineNumber),
            valuesByStar: [
              {
                star: 1,
                valueRaw: sourceRawA,
                sourceIdentity: `${createElementIdentity(property)}.formulaParams.formulaParamValues[0]`,
              },
            ],
            sourceIdentity: createElementIdentity(property),
          },
  };
}

function sameConditions(left, right) {
  return (
    JSON.stringify(projectConditions(left ?? [])) ===
    JSON.stringify(
      (right ?? []).map(row => ({
        conditionType: numberOrNull(row.conditionType),
        conditionValue: numberOrNull(row.conditionValue),
        conditionExtra: numberOrNull(row.conditionExtra),
      }))
    )
  );
}

function sameNumbers(left, right) {
  return (
    JSON.stringify(uniqueNumbers(left ?? []).sort((a, b) => a - b)) ===
    JSON.stringify(uniqueNumbers(right ?? []).sort((a, b) => a - b))
  );
}

function projectTriggerEvidence(row) {
  const tree = row.typetree ?? {};
  const event = TRIGGER_EVENT_BY_ID[Number(tree.triggerParam1)] ?? null;
  return {
    elementId: Number(tree.elementConfigId),
    pathId: Number(row.path_id),
    triggerType: numberOrNull(tree.triggerType),
    eventId: Number(tree.triggerParam1),
    event: event?.name ?? null,
    frameAnchor: event?.frameAnchor ?? null,
    triggerTargetType: numberOrNull(tree.triggerTargetType),
    triggerConditionType: numberOrNull(tree.triggerConditionType),
    conditions: projectConditions(tree.triggerConditionList),
    triggerEffects: (tree.triggerEffectList ?? []).map((effect, index) => ({
      effectIndex: index,
      effectType: numberOrNull(effect?.effectType),
      targetType: numberOrNull(effect?.targetType),
      targetElementPathId: numberOrNull(effect?.targetElement?.m_PathID),
      sourceIdentity: `${createElementIdentity(row)}.triggerEffectList[${index}]`,
    })),
    intervalMs: numberOrNull(tree.triggerInv),
    triggerCounter: numberOrNull(tree.triggerCounter),
    sourceIdentity: createElementIdentity(row),
  };
}

function projectPropertyEvidence(row) {
  const tree = row.typetree ?? {};
  return {
    elementId: Number(tree.elementConfigId),
    pathId: Number(row.path_id),
    attributeId: Number(tree.attributeID),
    bucket:
      PROPERTY_BUCKET_BY_CALCULATE_TYPE[Number(tree.calculateType)] ?? null,
    calculateType: numberOrNull(tree.calculateType),
    durationMs: numberOrNull(tree.time),
    combineType: numberOrNull(tree.combineType),
    combineNumber: numberOrNull(tree.combineNumber),
    executeTargetType: numberOrNull(tree.executeTargetType),
    inheritType: numberOrNull(tree.inheritType),
    defaultPropertyTags: uniqueNumbers(tree.defaultPropertyTags ?? []),
    propertyTagSourceIdentity: `${createElementIdentity(row)}.defaultPropertyTags`,
    sourceIdentity: createElementIdentity(row),
  };
}

function projectConditions(conditions) {
  return (conditions ?? []).map(condition => ({
    conditionType: numberOrNull(condition?.conditionParam1),
    conditionValue: numberOrNull(condition?.conditionParam2),
    conditionExtra: numberOrNull(condition?.conditionParam3),
  }));
}

function projectEffectLifecycle(effect) {
  return effect == null
    ? null
    : {
        durationMs: effect.durationMs,
        leafDurationMs: effect.leafDurationMs ?? effect.durationMs,
        sourceKind: effect.lifecycle?.sourceKind ?? 'property-leaf-duration',
        wrapper: effect.lifecycle?.wrapper ?? null,
        removalPaths: effect.lifecycle?.removalPaths ?? [],
        stackMode: effect.stackMode,
        stackDelta: effect.stackDelta,
        maxStacks: effect.maxStacks,
      };
}

function compileTriggerCondition({
  trigger,
  conditions,
  conditionLogicValue,
  triggerContract,
  tuningMechanicsCatalog,
  frameAnchor,
  emptyConditionEvidence = null,
  elementFormulaRows = [],
  activationConditionRuntimeEvidence = null,
  elementFunctionParams = [],
  knownElementIds = null,
  knownElementTypes = null,
}) {
  if (!trigger) {
    return {
      kind: 'condition-group',
      logic: 'unresolved',
      logicValue: null,
      conditions: [],
      actionKinds: [],
      status: 'static-evidence-gap',
      sourceIdentity: 'battle-element-trigger-source-not-unique',
    };
  }
  const triggerEventId = Number(trigger.typetree?.triggerParam1);
  const logicBinding = triggerContract.logicBindings.find(
    binding => Number(binding.value) === Number(conditionLogicValue)
  );
  const compiledConditions = (conditions ?? []).map((condition, index) => {
    const conditionType = Number(condition?.conditionParam1);
    const conditionValue = Number(condition?.conditionParam2);
    if (conditionType === 10000) {
      const formulaId = conditionValue;
      const formula = (elementFormulaRows ?? []).find(
        row => Number(row.id) === formulaId
      );
      const match = String(formula?.functionOutput ?? '').match(
        /^IF\(self\.ELEMENT_LAYERS\[([A-Z])\]>([A-Z]),([A-Z]),0\)$/u
      );
      const resolveVariable = letter => {
        const raw = elementFunctionParams[letter.charCodeAt(0) - 65];
        return Number.isFinite(Number(raw)) ? Number(raw) : null;
      };
      const markId = match ? resolveVariable(match[1]) : null;
      const minLayers = match ? resolveVariable(match[2]) : null;
      const valueRaw = match ? resolveVariable(match[3]) : null;
      const applied =
        activationConditionRuntimeEvidence?.conclusion?.status === 'applied' &&
        match &&
        markId != null &&
        minLayers != null;
      return {
        kind: 'element-formula-layer-gt',
        conditionType,
        conditionValue,
        formulaId,
        markId,
        minLayers,
        valueRaw,
        formula: formula?.functionOutput ?? null,
        actionKinds: [],
        provenanceRequirement: null,
        tuningProfiles: [],
        sourceIdentity: `${createElementIdentity(trigger)}.triggerConditionList[${index}]|NewTable/element_formula.json#rows[id=${formulaId}]|${activationConditionRuntimeEvidence?.conclusion?.sourceIdentity ?? 'activation-condition-evidence-missing'}`,
        status: applied ? 'applied' : 'static-evidence-gap',
      };
    }
    const typeBinding = triggerContract.conditionTypeBindings.find(
      binding => Number(binding.value) === conditionType
    );
    const valueBindings =
      typeBinding?.selectorKind === 'skill-slot'
        ? triggerContract.skillSlotBindings
        : typeBinding?.selectorKind === 'skill-tag'
          ? triggerContract.skillTagBindings
          : typeBinding?.selectorKind === 'self-stay-type'
            ? triggerContract.stayTypeBindings
            : [];
    const valueBinding = valueBindings.find(
      binding => Number(binding.value) === conditionValue
    );
    const tuningProfiles = resolveTuningConditionProfiles({
      selectorKind: typeBinding?.selectorKind,
      conditionValue,
      tuningMechanicsCatalog,
      frameAnchor,
      elementTypeConditionRuntime:
        triggerContract.getElementRuntime?.elementTypeCondition,
    });
    const valueApplied =
      valueBinding?.status === 'applied' ||
      tuningProfiles.length > 0 ||
      (typeBinding?.selectorKind === 'event-element-id' &&
        knownElementIds?.has(conditionValue)) ||
      (typeBinding?.selectorKind === 'event-element-type' &&
        knownElementTypes?.has(conditionValue));
    const conditionValueSourceIdentity =
      valueBinding?.sourceIdentity ??
      tuningProfiles.map(profile => profile.sourceIdentity).join('|') ??
      'condition-value-unresolved';
    const base = {
      kind: typeBinding?.selectorKind ?? 'unresolved',
      conditionType,
      conditionTypeName: typeBinding?.enumName ?? null,
      conditionValue,
      actionKinds: valueBinding?.actionKinds ?? [],
      provenanceRequirement: valueBinding?.provenanceRequirement ?? null,
      tuningProfiles,
      sourceIdentity: `${createElementIdentity(trigger)}.triggerConditionList[${index}]|${typeBinding?.sourceIdentity ?? 'condition-type-unresolved'}|${conditionValueSourceIdentity || 'condition-value-unresolved'}`,
      status:
        typeBinding?.status === 'applied' && valueApplied
          ? 'applied'
          : 'static-evidence-gap',
    };
    if (typeBinding?.selectorKind === 'skill-slot') {
      return {
        ...base,
        skillSlotId: conditionValue,
        skillSlotName: valueBinding?.enumName ?? null,
      };
    }
    if (typeBinding?.selectorKind === 'skill-tag') {
      return {
        ...base,
        skillTagId: conditionValue,
        skillTagName: valueBinding?.enumName ?? null,
      };
    }
    if (typeBinding?.selectorKind === 'self-stay-type') {
      return {
        ...base,
        stayType: conditionValue,
        stayTypeName: valueBinding?.enumName ?? null,
        runtimeKind: valueBinding?.runtimeKind ?? null,
      };
    }
    return base;
  });
  const emptyConditionSourceIdentity = (
    triggerContract.nonDamageRuntime?.emptyConditionEvents ?? []
  ).includes(triggerEventId)
    ? triggerContract.nonDamageRuntime?.sourceIdentity
    : emptyConditionEvidence?.status === 'applied' &&
        Number(emptyConditionEvidence?.eventId) === triggerEventId
      ? emptyConditionEvidence.sourceIdentity
      : null;
  if (
    compiledConditions.length === 0 &&
    logicBinding &&
    emptyConditionSourceIdentity
  ) {
    return {
      kind: 'always',
      logic: logicBinding.runtimeLogic,
      logicValue: Number(logicBinding.value),
      logicName: logicBinding.enumName,
      conditions: [],
      actionKinds: [],
      status: 'applied',
      sourceIdentity: `${createElementIdentity(trigger)}.triggerConditionType|triggerConditionList|${logicBinding.sourceIdentity}|${emptyConditionSourceIdentity}`,
    };
  }
  if (
    !logicBinding ||
    compiledConditions.length === 0 ||
    compiledConditions.some(condition => condition.status !== 'applied')
  ) {
    return {
      kind: 'condition-group',
      logic: logicBinding?.runtimeLogic ?? 'unresolved',
      logicValue: Number.isInteger(conditionLogicValue)
        ? conditionLogicValue
        : null,
      conditions: compiledConditions,
      actionKinds: [],
      status: 'static-evidence-gap',
      sourceIdentity: `${createElementIdentity(trigger)}.triggerConditionType|triggerConditionList`,
    };
  }
  const actionKinds = resolveConditionActionKinds({
    logic: logicBinding.runtimeLogic,
    conditions: compiledConditions,
  });
  const single = compiledConditions.length === 1 ? compiledConditions[0] : null;
  return {
    kind: single?.kind ?? 'condition-group',
    conditionType: single?.conditionType ?? null,
    skillSlotId: single?.skillSlotId ?? null,
    skillSlotName: single?.skillSlotName ?? null,
    skillTagId: single?.skillTagId ?? null,
    skillTagName: single?.skillTagName ?? null,
    stayType: single?.stayType ?? null,
    stayTypeName: single?.stayTypeName ?? null,
    logic: logicBinding.runtimeLogic,
    logicValue: Number(logicBinding.value),
    logicName: logicBinding.enumName,
    conditions: compiledConditions,
    actionKinds,
    status: 'applied',
    sourceIdentity: `${createElementIdentity(trigger)}.triggerConditionType|triggerConditionList|${logicBinding.sourceIdentity}`,
  };
}

function resolveConditionActionKinds({ logic, conditions }) {
  const rows = conditions
    .map(condition => new Set(condition.actionKinds ?? []))
    .filter(row => row.size > 0);
  if (rows.length === 0) return [];
  if (logic === 'or') {
    return uniqueStrings(rows.flatMap(row => [...row]));
  }
  if (logic === 'and') {
    return [...rows[0]].filter(actionKind =>
      rows.slice(1).every(row => row.has(actionKind))
    );
  }
  return [];
}

function resolveTuningConditionProfiles({
  selectorKind,
  conditionValue,
  tuningMechanicsCatalog,
  frameAnchor,
  elementTypeConditionRuntime,
}) {
  if (
    ![
      'event-element-type',
      'event-element-id',
      'held-element-id',
      'target-element-id',
    ].includes(selectorKind)
  ) {
    return [];
  }
  return (tuningMechanicsCatalog?.profiles ?? [])
    .filter(profile => {
      if (selectorKind === 'held-element-id') {
        return Number(profile.markId) === conditionValue;
      }
      if (selectorKind === 'event-element-id') {
        if (
          frameAnchor === 'element-before-acquire' ||
          frameAnchor === 'element-after-acquire'
        ) {
          return Number(profile.markId) === conditionValue;
        }
        if (
          frameAnchor === 'hit-before-damage' ||
          frameAnchor === 'hit-after-damage'
        ) {
          return (
            Number(profile.overlimitDamage?.template?.elementConfigId) ===
            conditionValue
          );
        }
        return false;
      }
      if (selectorKind === 'target-element-id') {
        return Number(profile.overlimitPacket?.elementId) === conditionValue;
      }
      if (
        selectorKind === 'event-element-type' &&
        frameAnchor !== 'hit-before-damage' &&
        frameAnchor !== 'hit-after-damage' &&
        frameAnchor !== 'element-before-acquire' &&
        frameAnchor !== 'element-after-acquire'
      ) {
        return false;
      }
      if (
        selectorKind === 'event-element-type' &&
        (frameAnchor === 'element-before-acquire' ||
          frameAnchor === 'element-after-acquire')
      ) {
        return (
          elementTypeConditionRuntime?.status === 'applied' &&
          elementTypeConditionRuntime?.selector ===
            'current-event-element-params-types-contains-condition-value' &&
          (profile.markContainer?.elementTypes ?? []).includes(conditionValue)
        );
      }
      return (profile.overlimitDamage?.template?.elementTypes ?? []).includes(
        conditionValue
      );
    })
    .map(profile => {
      const usesMarkContainer =
        selectorKind === 'event-element-type' &&
        (frameAnchor === 'element-before-acquire' ||
          frameAnchor === 'element-after-acquire');
      return {
        profileKey: profile.key,
        markId: Number(profile.markId),
        overlimitPacketElementId: Number(profile.overlimitPacket?.elementId),
        damageElementId: Number(
          profile.overlimitDamage?.template?.elementConfigId
        ),
        elementTypes: uniqueNumbers(
          usesMarkContainer
            ? (profile.markContainer?.elementTypes ?? [])
            : (profile.overlimitDamage?.template?.elementTypes ?? [])
        ),
        elementTypeSourceKind: usesMarkContainer
          ? 'mark-container'
          : 'damage-template',
        sourceIdentity: [
          profile.sourceIdentity,
          usesMarkContainer
            ? profile.markContainer?.elementTypeSourceIdentity
            : profile.overlimitPacket?.sourceIdentity,
          usesMarkContainer
            ? elementTypeConditionRuntime?.sourceIdentity
            : profile.overlimitDamage?.template?.elementTypeSourceIdentity,
        ]
          .filter(Boolean)
          .join('|'),
        status: 'applied',
      };
    })
    .sort((left, right) => left.markId - right.markId);
}

function resolveFormulaFamily({ commonFunctionId, baseFunctionId }) {
  if (commonFunctionId === 1 && baseFunctionId === 5) {
    return 'literal-a-with-common-ratio';
  }
  if (commonFunctionId === 1 && baseFunctionId === 3) {
    return 'basis-point-property-a-with-common-ratio';
  }
  return `unsupported-${commonFunctionId || 0}-${baseFunctionId || 0}`;
}

function compileActivationConditions({
  activationPrerequisiteRows,
  elementFormulaRows,
  activationConditionRuntimeEvidence,
}) {
  if (activationPrerequisiteRows.length === 0) return [];
  const supported =
    activationConditionRuntimeEvidence?.conclusion?.status === 'applied';
  const formulaById = new Map(
    (elementFormulaRows ?? []).map(row => [Number(row.id), row])
  );
  return activationPrerequisiteRows.flatMap(row => {
    const tree = row.typetree ?? {};
    const functionParams = Array.isArray(tree.functionParams)
      ? tree.functionParams
      : [];
    const rowIdentity = createElementIdentity(row);
    return (tree.triggerConditionList ?? []).map((condition, conditionIndex) => {
      const conditionType = Number(condition?.conditionParam1);
      const sourceIdentity = `${rowIdentity}.triggerConditionList[${conditionIndex}]`;
      if (conditionType !== 10000) {
        return {
          kind: 'unsupported-condition-type',
          conditionType,
          status: 'static-evidence-gap',
          sourceIdentity,
        };
      }
      const formulaId = Number(condition?.conditionParam2);
      const formula = formulaById.get(formulaId);
      const match = String(formula?.functionOutput ?? '').match(
        /^IF\(self\.ELEMENT_LAYERS\[([A-Z])\]>([A-Z]),([A-Z]),0\)$/u
      );
      const resolveVariable = letter => {
        const index = letter.charCodeAt(0) - 65;
        const raw = functionParams[index];
        return Number.isFinite(Number(raw)) ? Number(raw) : null;
      };
      const markId = match ? resolveVariable(match[1]) : null;
      const minLayers = match ? resolveVariable(match[2]) : null;
      const valueRaw = match ? resolveVariable(match[3]) : null;
      if (!supported || !match || markId == null || minLayers == null) {
        return {
          kind: 'element-formula-layer-gt',
          formulaId,
          status: 'static-evidence-gap',
          sourceIdentity,
        };
      }
      return {
        kind: 'element-formula-layer-gt',
        formulaId,
        markId,
        minLayers,
        valueRaw,
        formula: formula.functionOutput,
        status: 'applied',
        sourceIdentity: `${sourceIdentity}|NewTable/element_formula.json#rows[id=${formulaId}]|${activationConditionRuntimeEvidence.conclusion.sourceIdentity}`,
      };
    });
  });
}

function buildSoulTriggerEntry({
  triggerRow,
  property,
  closure,
  battleElementsByPathId,
  propertyRows,
  triggerContract,
  tuningMechanicsCatalog,
  elementFormulaRows,
  activationConditionRuntimeEvidence,
  afterDamageEmptyConditionRuntimeEvidence,
  beforeDamageEmptyConditionRuntimeEvidence = null,
  knownElementIds = null,
  knownElementTypes = null,
  effectRowCandidates = null,
  requiresLeaf = true,
}) {
  const tree = triggerRow?.typetree ?? {};
  const eventBinding = triggerContract.eventBindings.find(
    binding => Number(binding.value) === Number(tree.triggerParam1)
  );
  const frameAnchor = eventBinding?.frameAnchor ?? null;
  const supported = SUPPORTED_FRAME_ANCHORS.has(frameAnchor);
  const conditions = Array.isArray(tree.triggerConditionList)
    ? tree.triggerConditionList
    : [];
  const eventId = Number(eventBinding?.value);
  const emptyConditionEvidence =
    eventId === 2 &&
    afterDamageEmptyConditionRuntimeEvidence?.conclusion?.status === 'applied'
      ? {
          status: afterDamageEmptyConditionRuntimeEvidence.conclusion.status,
          eventId: 2,
          sourceIdentity:
            afterDamageEmptyConditionRuntimeEvidence.conclusion.sourceIdentity,
        }
      : eventId === 1 &&
          beforeDamageEmptyConditionRuntimeEvidence?.conclusion?.status ===
            'applied'
        ? {
            status:
              beforeDamageEmptyConditionRuntimeEvidence.conclusion.status,
            eventId: 1,
            sourceIdentity:
              beforeDamageEmptyConditionRuntimeEvidence.conclusion
                .sourceIdentity,
          }
        : null;
  const compiledCondition = compileTriggerCondition({
    trigger: triggerRow,
    conditions,
    conditionLogicValue: Number(tree.triggerConditionType),
    triggerContract,
    tuningMechanicsCatalog,
    frameAnchor,
    emptyConditionEvidence,
    elementFormulaRows,
    activationConditionRuntimeEvidence,
    elementFunctionParams: Array.isArray(tree.functionParams)
      ? tree.functionParams
      : [],
    knownElementIds,
    knownElementTypes,
  });
  const triggerTargetBinding = triggerContract.triggerTargetBindings.find(
    binding => Number(binding.value) === Number(tree.triggerTargetType)
  );
  const candidates = effectRowCandidates ?? propertyRows;
  const reachableEffectRows = triggerRow
    ? collectReachableRows(
        Number(triggerRow.path_id),
        closure.edges,
        battleElementsByPathId
      ).filter(row =>
        candidates.some(item => item.path_id === row.path_id)
      )
    : [];
  const triggerEffectRows = Array.isArray(tree.triggerEffectList)
    ? tree.triggerEffectList
        .map((effectRow, effectListIndex) => ({
          effectRow,
          effectListIndex,
          targetPathId: Number(effectRow?.targetElement?.m_PathID),
          matchesLeaf: reachableEffectRows.some(
            effectRowCandidate =>
              findElementPath(
                Number(effectRow?.targetElement?.m_PathID),
                Number(effectRowCandidate.path_id),
                closure.edges
              ) != null
          ),
        }))
        .filter(entry => entry.matchesLeaf)
    : [];
  const targetBinding =
    triggerEffectRows.length >= 1
      ? (triggerContract.targetBindings.find(
          binding =>
            Number(binding.value) ===
            Number(triggerEffectRows[0]?.effectRow?.targetType)
        ) ?? null)
      : null;
  const rowTargetBindings = triggerEffectRows.map(row =>
    triggerContract.targetBindings.find(
      binding =>
        Number(binding.value) === Number(row.effectRow?.targetType)
    ) ?? null
  );
  const sharedLeaf =
    property != null &&
    reachableEffectRows.length === 1 &&
    Number(reachableEffectRows[0].path_id) === Number(property.path_id);
  const baseValid =
    supported &&
    compiledCondition?.status === 'applied' &&
    triggerTargetBinding != null &&
    rowTargetBindings.length > 0 &&
    rowTargetBindings.every(binding => binding != null) &&
    (!requiresLeaf || reachableEffectRows.length > 0);
  const valid = baseValid && sharedLeaf;
  return {
    valid,
    baseValid,
    value: {
      leafPathIds: reachableEffectRows.map(row => Number(row.path_id)),
      elementId: Number(tree.elementConfigId),
      pathId: Number(triggerRow.path_id),
      eventId: Number(tree.triggerParam1),
      event: eventBinding?.name ?? null,
      frameAnchor,
      intervalMs: numberOrNull(tree.triggerInv),
      intervalSourceIdentity: `${createElementIdentity(triggerRow)}.triggerInv|${triggerContract.nonDamageRuntime?.consumer?.triggerIntervalParse?.identity ?? 'trigger-interval-contract-unresolved'}`,
      condition: compiledCondition,
      triggerTargetType: numberOrNull(tree.triggerTargetType),
      triggerTargetTypeSourceIdentity: `${createElementIdentity(triggerRow)}.triggerTargetType`,
      triggerTarget:
        triggerTargetBinding == null
          ? null
          : {
              kind: triggerTargetBinding.sourceKind,
              triggerTargetType: Number(triggerTargetBinding.value),
              triggerTargetTypeName: triggerTargetBinding.enumName,
              sourceIdentity: `${createElementIdentity(triggerRow)}.triggerTargetType|${triggerTargetBinding.sourceIdentity}`,
            },
      target:
        targetBinding == null
          ? null
          : {
              kind: targetBinding.targetKind,
              effectTargetType: Number(targetBinding.value),
              effectTargetTypeName: targetBinding.enumName,
              effectListIndex: triggerEffectRows[0]?.effectListIndex ?? null,
              targetElementPathId: triggerEffectRows[0]
                ? Number(triggerEffectRows[0]?.effectRow?.targetElement?.m_PathID)
                : null,
              sourceIdentity: triggerEffectRows[0]
                ? `${createElementIdentity(triggerRow)}.triggerEffectList[${triggerEffectRows[0].effectListIndex}].targetType|${targetBinding.sourceIdentity}`
                : null,
            },
      targets: triggerEffectRows.map((row, rowIndex) => {
        const rowTargetBinding = rowTargetBindings[rowIndex];
        return rowTargetBinding == null
          ? null
          : {
              kind: rowTargetBinding.targetKind,
              effectTargetType: Number(rowTargetBinding.value),
              effectTargetTypeName: rowTargetBinding.enumName,
              effectListIndex: row.effectListIndex,
              targetElementPathId: Number(
                row.effectRow?.targetElement?.m_PathID
              ),
              sourceIdentity: `${createElementIdentity(triggerRow)}.triggerEffectList[${row.effectListIndex}].targetType|${rowTargetBinding.sourceIdentity}`,
            };
      }),
      targetKind: targetBinding?.targetKind ?? 'unresolved',
      sourceIdentity: createElementIdentity(triggerRow),
    },
  };
}

function compileSoulEffectLeaf({
  leafRow,
  effectSkillId,
  valueRowsBySkillId,
  propertyTagContract,
  unloadTriggers,
  closure,
  battleElementsByPathId,
  triggerContract,
}) {
  const tree = leafRow?.typetree ?? {};
  const commonFunctionId = Number(
    tree.formulaParams?.function_1 ?? tree.baseIntParams?.[0]
  );
  const baseFunctionId = Number(
    tree.formulaParams?.function_2 ?? tree.baseIntParams?.[1]
  );
  const commonRatioRaw = Number(
    tree.formulaParams?.formulaParamValues?.[6] ?? tree.functionParams?.[6]
  );
  const propertyTags = uniqueNumbers(tree.defaultPropertyTags ?? []);
  const supportedPropertyTags = new Set(
    (propertyTagContract?.bindings ?? [])
      .filter(binding => binding.status === 'applied')
      .map(binding => Number(binding.propertyTag))
  );
  const lifecycle = compilePropertyLifecycle({
    property: leafRow,
    wrapperRows: [],
    unloadTriggers,
    closure,
    battleElementsByPathId,
    wrapperContract: triggerContract?.buffElementWrapper,
  });
  const formulaFamily = resolveFormulaFamily({
    commonFunctionId,
    baseFunctionId,
  });
  const starValues = compileStarValues({
    rows: valueRowsBySkillId.get(effectSkillId) ?? [],
    elementId: Number(tree.elementConfigId),
  });
  const gaps = [];
  if (!PROPERTY_BUCKET_BY_CALCULATE_TYPE[Number(tree.calculateType)]) {
    gaps.push('effect-property-bucket-unsupported');
  }
  if (!(Number(lifecycle?.durationMs) > 0)) {
    gaps.push('effect-property-duration-unresolved');
  }
  if (![3, 4, 5].includes(Number(tree.combineType))) {
    gaps.push('effect-property-stack-operator-unsupported');
  }
  if (
    commonFunctionId !== 1 ||
    ![3, 5].includes(baseFunctionId) ||
    commonRatioRaw !== 10_000
  ) {
    gaps.push('effect-formula-family-operator-unsupported');
  }
  if (starValues.length !== 4) gaps.push('effect-star-values-incomplete');
  if (propertyTags.length > 1) {
    gaps.push('effect-property-tag-composition-evidence-gap');
  } else if (
    propertyTags.length === 1 &&
    !supportedPropertyTags.has(propertyTags[0])
  ) {
    gaps.push('effect-property-tag-action-mapping-evidence-gap');
  }
  return {
    valid: gaps.length === 0,
    gaps,
    effect: {
      elementId: Number(tree.elementConfigId),
      pathId: Number(leafRow.path_id),
      name: tree.elementName ?? leafRow.name ?? null,
      attributeId: Number(tree.attributeID),
      bucket:
        PROPERTY_BUCKET_BY_CALCULATE_TYPE[Number(tree.calculateType)] ?? null,
      calculateType: Number(tree.calculateType),
      propertyTags,
      propertyTagMatchMode:
        propertyTags.length === 0
          ? 'unscoped'
          : propertyTags.length === 1
            ? 'single-exact'
            : 'evidence-open-multi-tag',
      propertyTagSourceIdentity: `${createElementIdentity(leafRow)}.defaultPropertyTags`,
      formula: {
        formulaIdentity: `battle-effect-formula:soulessence:${effectSkillId}:${Number(tree.elementConfigId)}:${leafRow.path_id}`,
        commonFunctionId,
        commonExpression: commonFunctionId === 1 ? 'G/10000' : null,
        baseFunctionId,
        baseExpression:
          baseFunctionId === 3
            ? 'A/10000'
            : baseFunctionId === 5
              ? 'A'
              : null,
        commonRatioRaw,
        sourceParameterEncoding: 'battle-element-raw-a',
        family: formulaFamily,
        sourceIdentity: `${createElementIdentity(leafRow)}.formulaParams|functionParams`,
      },
      durationMs: Number(lifecycle?.durationMs),
      leafDurationMs: Number(tree.time),
      lifecycle,
      stackMode:
        Number(tree.combineType) === 4
          ? 'stack'
          : Number(tree.combineType) === 5
            ? 'block'
            : 'refresh',
      stackDelta: 1,
      maxStacks:
        Number(tree.combineType) === 4
          ? Math.max(1, Number(tree.combineNumber) || 1)
          : 1,
      combineType: Number(tree.combineType),
      combineNumber: Number(tree.combineNumber),
      valuesByStar: starValues,
      sourceIdentity: createElementIdentity(leafRow),
    },
  };
}

function compileSoulImmediateEffectDefinition({
  soul,
  effectSkillId,
  logicBySkillId,
  activeTriggers,
  unloadTriggers,
  immediateEffectRows,
  closure,
  battleElementsByPathId,
  triggerContract,
  tuningMechanicsCatalog,
  elementFormulaRows,
  activationConditionRuntimeEvidence,
  afterDamageEmptyConditionRuntimeEvidence,
  beforeDamageEmptyConditionRuntimeEvidence,
  knownElementIds,
  knownElementTypes,
  activationPrerequisiteRows,
  control,
  missingPathIds,
  damageRows,
}) {
  const triggerEntries = activeTriggers.map(triggerRow =>
    buildSoulTriggerEntry({
      triggerRow,
      property: null,
      closure,
      battleElementsByPathId,
      propertyRows: immediateEffectRows,
      triggerContract,
      tuningMechanicsCatalog,
      elementFormulaRows,
      activationConditionRuntimeEvidence,
      afterDamageEmptyConditionRuntimeEvidence,
      beforeDamageEmptyConditionRuntimeEvidence,
      knownElementIds,
      knownElementTypes,
      effectRowCandidates: immediateEffectRows,
      requiresLeaf: false,
    })
  );
  const rowTargetByPathId = new Map();
  for (const triggerRow of activeTriggers) {
    const tree = triggerRow.typetree ?? {};
    for (const [effectListIndex, effectRow] of (
      tree.triggerEffectList ?? []
    ).entries()) {
      const targetPathId = Number(effectRow?.targetElement?.m_PathID);
      const reached = immediateEffectRows.find(
        row =>
          findElementPath(
            targetPathId,
            Number(row.path_id),
            closure.edges
          ) != null
      );
      if (!reached) continue;
      const binding = triggerContract.targetBindings.find(
        candidate => Number(candidate.value) === Number(effectRow?.targetType)
      );
      rowTargetByPathId.set(Number(reached.path_id), {
        targetKind: binding?.targetKind ?? 'unresolved',
        targetType: Number(effectRow?.targetType),
        effectListIndex,
        targetElementPathId: targetPathId,
        sourceIdentity: `${createElementIdentity(triggerRow)}.triggerEffectList[${effectListIndex}].targetType|${binding?.sourceIdentity ?? 'target-binding-unresolved'}`,
      });
    }
  }
  const immediateEffects = [];
  const effectIssues = [];
  const seenPathIds = new Set();
  for (const row of immediateEffectRows) {
    const pathId = Number(row.path_id);
    if (seenPathIds.has(pathId)) continue;
    seenPathIds.add(pathId);
    const tree = row.typetree ?? {};
    const target = rowTargetByPathId.get(pathId);
    const commonFunctionId = Number(
      tree.formulaParams?.function_1 ?? tree.baseIntParams?.[0]
    );
    const baseFunctionId = Number(
      tree.formulaParams?.function_2 ?? tree.baseIntParams?.[1]
    );
    const commonRatioRaw = Number(
      tree.formulaParams?.formulaParamValues?.[6] ?? tree.functionParams?.[6]
    );
    const sourceRawA = Number(
      tree.formulaParams?.formulaParamValues?.[0] ?? tree.functionParams?.[0]
    );
    if (!target || target.targetKind === 'unresolved') {
      effectIssues.push(`soul-immediate-effect-target-unresolved:${pathId}`);
      continue;
    }
    const isSp = Object.hasOwn(tree, 'recoverType');
    const baseExpression = isSp
      ? 'A'
      : '(target.MAXHP[0]*A)/10000';
    immediateEffects.push({
      kind: isSp ? 'direct-sp' : 'direct-heal',
      effectIndex: target.effectListIndex,
      elementId: Number(tree.elementConfigId),
      pathId,
      targetKind: target.targetKind,
      targetType: target.targetType,
      ...(isSp
        ? {
            recoverType: Number(tree.recoverType),
            shareType: Number(tree.shareType),
            petShareType: Number(tree.petShareType),
            mainPetShareType: Number(tree.mainPetShareType),
          }
        : {
            damageType: Number(tree.damageType),
          }),
      sourceRawValue: sourceRawA,
      formula: {
        formulaIdentity: `battle-effect-formula:soulessence:${effectSkillId}:${Number(tree.elementConfigId)}:${pathId}`,
        commonFunctionId,
        commonExpression: commonFunctionId === 1 ? 'G/10000' : null,
        baseFunctionId,
        baseExpression,
        sourceRawA,
        commonRatioRaw,
        sourceIdentity: `${createElementIdentity(row)}.formulaParams|functionParams`,
      },
      sourceIdentity: `${target.sourceIdentity}|${createElementIdentity(row)}`,
    });
  }
  const triggersValid =
    triggerEntries.length > 0 && triggerEntries.every(entry => entry.baseValid);
  const effectsValid =
    immediateEffects.length === immediateEffectRows.length &&
    effectIssues.length === 0;
  const gaps = [];
  if (!control) gaps.push('effect-control-source-missing');
  if (missingPathIds.length) gaps.push('effect-resource-reference-missing');
  if (!triggersValid) gaps.push('effect-active-trigger-not-unique');
  if (damageRows.length) gaps.push('effect-damage-branch-unapplied');
  if (!effectsValid) gaps.push('effect-immediate-effect-unresolved');
  const runtimeStatus = gaps.length
    ? 'source-indexed-runtime-unapplied'
    : 'runtime-applied';
  return {
    soulEssenceId: soul.soulEssenceId,
    name: soul.name,
    effectSkillId,
    effectSkillLogic: logicBySkillId.get(effectSkillId)
      ? {
          skillLogicType: Number(
            logicBySkillId.get(effectSkillId).skillLogicType
          ),
          sourceIdentity: `NewTable/skillsub_logic.rows[skillId=${effectSkillId}]`,
        }
      : null,
    runtimeStatus,
    mechanismFamily:
      runtimeStatus === 'runtime-applied'
        ? 'equipped-actor-immediate-resource-heal-effect'
        : 'source-indexed-composite-effect',
    activationPrerequisites: activationPrerequisiteRows.map(row => ({
      elementId: Number(row.typetree?.elementConfigId),
      pathId: Number(row.path_id),
      triggerType: Number(row.typetree?.triggerType),
      conditions: (row.typetree?.triggerConditionList ?? []).map(condition => ({
        conditionType: Number(condition?.conditionParam1),
        conditionValue: Number(condition?.conditionParam2),
        conditionExtra: Number.isFinite(Number(condition?.conditionParam3))
          ? Number(condition.conditionParam3)
          : null,
      })),
      sourceIdentity: createElementIdentity(row),
    })),
    activationConditions: compileActivationConditions({
      activationPrerequisiteRows,
      elementFormulaRows,
      activationConditionRuntimeEvidence,
    }),
    trigger: triggerEntries[0]?.value ?? null,
    triggers: triggerEntries.map(entry => entry.value),
    effect: null,
    effectLeaves: [],
    immediateEffects,
    sourceClosure: {
      controlSkillId: effectSkillId,
      controlSourceIdentity: control?.sourceIdentity ?? null,
      resourcePathIds: uniqueNumbers(control?.resourcePathIds ?? []),
      missingPathIds,
      reachablePathIds: closure.rows.map(row => row.path_id),
      activeTriggerElementIds: activeTriggers.map(row =>
        Number(row.typetree?.elementConfigId)
      ),
      unloadTriggerElementIds: unloadTriggers.map(row =>
        Number(row.typetree?.elementConfigId)
      ),
      propertyElementIds: [],
      wrapperElementIds: [],
      effectPathElementIds: immediateEffectRows.map(row =>
        Number(row.typetree?.elementConfigId)
      ),
      removalPaths: [],
      damageElementIds: damageRows.map(row =>
        Number(row.typetree?.elementConfigId)
      ),
      activationPrerequisiteElementIds: activationPrerequisiteRows.map(row =>
        Number(row.typetree?.elementConfigId)
      ),
    },
    runtimeGaps: uniqueStrings(gaps),
    sourceIdentity: [
      `NewTable/soulessence.rows[id=${soul.soulEssenceId}].reishiSkill`,
      control?.sourceIdentity,
      ...immediateEffectRows.map(createElementIdentity),
    ]
      .filter(Boolean)
      .join('|'),
  };
}

function compileSoulEffectDefinition({
  soul,
  sourceDefinition,
  logicBySkillId,
  valueRowsBySkillId,
  battleElementsByPathId,
  control,
  propertyTagContract,
  triggerContract,
  tuningMechanicsCatalog,
  persistentLoadoutPropertyRuntimeEvidence,
  periodicPersistentPropertyRuntimeEvidence,
  afterDamageEmptyConditionRuntimeEvidence = null,
  beforeDamageEmptyConditionRuntimeEvidence = null,
  activationConditionRuntimeEvidence = null,
  elementFormulaRows = [],
}) {
  const effectSkillId = Number(sourceDefinition?.reishiSkill);
  const resourcePathIds = uniqueNumbers(control?.resourcePathIds ?? []);
  const missingPathIds = resourcePathIds.filter(
    pathId => !battleElementsByPathId.has(pathId)
  );
  const closure = collectElementClosure({
    rootPathIds: resourcePathIds,
    battleElementsByPathId,
  });
  const activeTriggers = closure.rows.filter(row => {
    const tree = row.typetree ?? {};
    return Number(tree.triggerType) === 1 && Number(tree.triggerParam1) !== 36;
  });
  const unloadTriggers = closure.rows.filter(
    row =>
      Number(row.typetree?.triggerType) === 1 &&
      Number(row.typetree?.triggerParam1) === 36
  );
  const propertyRows = closure.rows.filter(
    row =>
      Number.isInteger(Number(row.typetree?.attributeID)) &&
      Number.isInteger(Number(row.typetree?.calculateType))
  );
  const resourceRows = closure.rows.filter(row =>
    Object.hasOwn(row.typetree ?? {}, 'recoverType')
  );
  const healRows = closure.rows.filter(row => {
    const tree = row.typetree ?? {};
    const base = Number(
      tree.formulaParams?.function_2 ?? tree.baseIntParams?.[1]
    );
    return (
      Number.isInteger(Number(tree.damageType)) &&
      [104, 108].includes(base)
    );
  });
  const damageRows = closure.rows.filter(
    row => isDamageElement(row.typetree) && !healRows.includes(row)
  );
  const immediateEffectRows = [...resourceRows, ...healRows];
  const unhandledImmediateEffectRows = immediateEffectRows.filter(
    row => !propertyRows.includes(row)
  );
  const knownElementIds = new Set(
    [...battleElementsByPathId.values()]
      .map(row => Number(row.typetree?.elementConfigId))
      .filter(value => Number.isInteger(value) && value > 0)
  );
  const knownElementTypes = new Set(
    [...battleElementsByPathId.values()].flatMap(row =>
      Array.isArray(row.typetree?.types)
        ? row.typetree.types.map(Number)
      : []
    )
  );
  const primaryTriggerRow = activeTriggers[0] ?? null;
  const activationPrerequisiteRows = primaryTriggerRow
    ? closure.rows.filter(row => {
        if (Number(row.path_id) === Number(primaryTriggerRow.path_id)) {
          return false;
        }
        const tree = row.typetree ?? {};
        if (
          Number(tree.triggerType) !== 0 ||
          !Array.isArray(tree.triggerConditionList) ||
          tree.triggerConditionList.length === 0
        ) {
          return false;
        }
        return collectReachableRows(
          row.path_id,
          closure.edges,
          battleElementsByPathId
        ).some(
          reachable =>
            Number(reachable.path_id) === Number(primaryTriggerRow.path_id)
        );
      })
    : [];
  if (activeTriggers.length === 0 && propertyRows.length > 0) {
    return compilePersistentSoulEffectDefinition({
      soul,
      effectSkillId,
      effectSkillLogic: logicBySkillId.get(effectSkillId),
      valueRows: valueRowsBySkillId.get(effectSkillId) ?? [],
      control,
      closure,
      propertyRows,
      unloadTriggers,
      damageRows,
      missingPathIds,
      battleElementsByPathId,
      propertyTagContract,
      persistentLoadoutPropertyRuntimeEvidence,
      periodicPersistentPropertyRuntimeEvidence,
      unhandledImmediateEffectRows,
    });
  }
  if (
    immediateEffectRows.length > 0 &&
    activeTriggers.length > 0 &&
    propertyRows.length === 0 &&
    damageRows.length === 0
  ) {
    return compileSoulImmediateEffectDefinition({
      soul,
      effectSkillId,
      logicBySkillId,
      activeTriggers,
      unloadTriggers,
      immediateEffectRows,
      closure,
      battleElementsByPathId,
      triggerContract,
      tuningMechanicsCatalog,
      elementFormulaRows,
      activationConditionRuntimeEvidence,
      afterDamageEmptyConditionRuntimeEvidence,
      beforeDamageEmptyConditionRuntimeEvidence,
      knownElementIds,
      knownElementTypes,
      activationPrerequisiteRows,
      control,
      missingPathIds,
      damageRows,
    });
  }
  const trigger = primaryTriggerRow;
  const reachablePropertyRows = trigger
    ? collectReachableRows(
        trigger.path_id,
        closure.edges,
        battleElementsByPathId
      ).filter(row =>
        propertyRows.some(property => property.path_id === row.path_id)
      )
    : [];
  const property =
    reachablePropertyRows.length === 1 ? reachablePropertyRows[0] : null;
  const triggerTree = trigger?.typetree ?? {};
  const propertyTree = property?.typetree ?? {};
  const commonFunctionId = Number(
    propertyTree.formulaParams?.function_1 ?? propertyTree.baseIntParams?.[0]
  );
  const baseFunctionId = Number(
    propertyTree.formulaParams?.function_2 ?? propertyTree.baseIntParams?.[1]
  );
  const commonRatioRaw = Number(
    propertyTree.formulaParams?.formulaParamValues?.[6] ??
      propertyTree.functionParams?.[6]
  );
  const propertyTags = uniqueNumbers(propertyTree.defaultPropertyTags ?? []);
  const supportedPropertyTags = new Set(
    (propertyTagContract?.bindings ?? [])
      .filter(binding => binding.status === 'applied')
      .map(binding => Number(binding.propertyTag))
  );
  const conditions = Array.isArray(triggerTree.triggerConditionList)
    ? triggerTree.triggerConditionList
    : [];
  const triggerEvent = triggerContract.eventBindings.find(
    binding => Number(binding.value) === Number(triggerTree.triggerParam1)
  );
  const emptyConditionEvidence =
    Number(triggerEvent?.value) === 2 &&
    afterDamageEmptyConditionRuntimeEvidence?.conclusion?.status === 'applied'
      ? {
          status: afterDamageEmptyConditionRuntimeEvidence.conclusion.status,
          eventId: 2,
          sourceIdentity:
            afterDamageEmptyConditionRuntimeEvidence.conclusion.sourceIdentity,
        }
      : null;
  const compiledCondition = compileTriggerCondition({
    trigger,
    conditions,
    conditionLogicValue: Number(triggerTree.triggerConditionType),
    triggerContract,
    tuningMechanicsCatalog,
    frameAnchor: triggerEvent?.frameAnchor ?? null,
    emptyConditionEvidence,
  });
  const triggerTargetBinding = triggerContract.triggerTargetBindings.find(
    binding => Number(binding.value) === Number(triggerTree.triggerTargetType)
  );
  const triggerEffectRows = Array.isArray(triggerTree.triggerEffectList)
    ? triggerTree.triggerEffectList
        .map((effectRow, effectListIndex) => ({
          effectRow,
          effectListIndex,
          targetPathId: Number(effectRow?.targetElement?.m_PathID),
        }))
        .filter(
          ({ targetPathId }) =>
            property != null &&
            findElementPath(
              targetPathId,
              Number(property.path_id),
              closure.edges
            ) != null
        )
    : [];
  const effectPathIds =
    triggerEffectRows.length === 1 && property != null
      ? findElementPath(
          triggerEffectRows[0].targetPathId,
          Number(property.path_id),
          closure.edges
        )
      : null;
  const effectPathRows = (effectPathIds ?? [])
    .map(pathId => battleElementsByPathId.get(pathId))
    .filter(Boolean);
  const wrapperRows = effectPathRows.filter(
    row =>
      Number(row.path_id) !== Number(property?.path_id) &&
      isBuffElementWrapper(row)
  );
  const lifecycle = compilePropertyLifecycle({
    property,
    wrapperRows,
    unloadTriggers,
    closure,
    battleElementsByPathId,
    wrapperContract: triggerContract.buffElementWrapper,
  });
  const targetBinding =
    triggerEffectRows.length === 1
      ? (triggerContract.targetBindings.find(
          binding =>
            Number(binding.value) ===
            Number(triggerEffectRows[0]?.effectRow?.targetType)
        ) ?? null)
      : null;
  const rowTargetBindings = triggerEffectRows.map(row =>
    triggerContract.targetBindings.find(
      binding =>
        Number(binding.value) === Number(row.effectRow?.targetType)
    ) ?? null
  );
  const formulaFamily = resolveFormulaFamily({
    commonFunctionId,
    baseFunctionId,
  });
  const starValues = compileStarValues({
    rows: valueRowsBySkillId.get(effectSkillId) ?? [],
    elementId: Number(propertyTree.elementConfigId),
  });
  const triggerEntries = activeTriggers.map(triggerRow =>
    buildSoulTriggerEntry({
      triggerRow,
      property,
      closure,
      battleElementsByPathId,
      propertyRows,
      triggerContract,
      tuningMechanicsCatalog,
      elementFormulaRows,
      activationConditionRuntimeEvidence,
      afterDamageEmptyConditionRuntimeEvidence,
      beforeDamageEmptyConditionRuntimeEvidence,
      knownElementIds,
      knownElementTypes,
    })
  );
  const leafRowsByPathId = new Map();
  for (const entry of triggerEntries) {
    for (const pathId of entry.value.leafPathIds ?? []) {
      if (leafRowsByPathId.has(pathId)) continue;
      const row = propertyRows.find(
        candidate => Number(candidate.path_id) === Number(pathId)
      );
      if (row) leafRowsByPathId.set(Number(pathId), row);
    }
  }
  const leafRows = [...leafRowsByPathId.values()];
  const multiLeaf =
    leafRows.length > 1 ||
    triggerEntries.some(
      entry => (entry.value.leafPathIds ?? []).length > 1
    );
  if (multiLeaf) {
    const compiledLeaves = leafRows.map(leafRow =>
      compileSoulEffectLeaf({
        leafRow,
        effectSkillId,
        valueRowsBySkillId,
        propertyTagContract,
        unloadTriggers,
        closure,
        battleElementsByPathId,
        triggerContract,
      })
    );
    const leafValid =
      compiledLeaves.length > 0 &&
      compiledLeaves.every(leaf => leaf.valid);
    const compiledLeafPathIds = new Set(
      compiledLeaves.map(leaf => Number(leaf.effect.pathId))
    );
    const triggersValid = triggerEntries.every(entry => {
      const pathIds = entry.value.leafPathIds ?? [];
      return (
        entry.baseValid &&
        pathIds.length > 0 &&
        pathIds.every(pathId => compiledLeafPathIds.has(Number(pathId)))
      );
    });
    const gaps = [];
    if (!control) gaps.push('effect-control-source-missing');
    if (missingPathIds.length) gaps.push('effect-resource-reference-missing');
    if (!triggersValid) gaps.push('effect-active-trigger-not-unique');
    if (damageRows.length) gaps.push('effect-damage-branch-unapplied');
    if (unhandledImmediateEffectRows.length)
      gaps.push('effect-immediate-effect-unapplied');
    if (!leafValid) gaps.push('effect-property-leaf-not-unique');
    for (const leaf of compiledLeaves) gaps.push(...leaf.gaps);
    const effectLeaves = compiledLeaves.map(leaf => leaf.effect);
    const multiRuntimeStatus = gaps.length
      ? 'source-indexed-runtime-unapplied'
      : 'runtime-applied';
    return {
      soulEssenceId: soul.soulEssenceId,
      name: soul.name,
      effectSkillId,
      effectSkillLogic: logicBySkillId.get(effectSkillId)
        ? {
            skillLogicType: Number(
              logicBySkillId.get(effectSkillId).skillLogicType
            ),
            sourceIdentity: `NewTable/skillsub_logic.rows[skillId=${effectSkillId}]`,
          }
        : null,
      runtimeStatus: multiRuntimeStatus,
      mechanismFamily:
        multiRuntimeStatus === 'runtime-applied'
          ? 'equipped-actor-composite-property-effects'
          : 'source-indexed-composite-effect',
      activationPrerequisites: activationPrerequisiteRows.map(row => ({
        elementId: Number(row.typetree?.elementConfigId),
        pathId: Number(row.path_id),
        triggerType: Number(row.typetree?.triggerType),
        conditions: (row.typetree?.triggerConditionList ?? []).map(condition => ({
          conditionType: Number(condition?.conditionParam1),
          conditionValue: Number(condition?.conditionParam2),
          conditionExtra: Number.isFinite(Number(condition?.conditionParam3))
            ? Number(condition.conditionParam3)
            : null,
        })),
        sourceIdentity: createElementIdentity(row),
      })),
      activationConditions: compileActivationConditions({
        activationPrerequisiteRows,
        elementFormulaRows,
        activationConditionRuntimeEvidence,
      }),
      trigger: triggerEntries[0]?.value ?? null,
      triggers: triggerEntries.map(entry => entry.value),
      effect: effectLeaves[0] ?? null,
      effectLeaves,
      sourceClosure: {
        controlSkillId: effectSkillId,
        controlSourceIdentity: control?.sourceIdentity ?? null,
        resourcePathIds,
        missingPathIds,
        reachablePathIds: closure.rows.map(row => row.path_id),
        activeTriggerElementIds: activeTriggers.map(row =>
          Number(row.typetree?.elementConfigId)
        ),
        unloadTriggerElementIds: unloadTriggers.map(row =>
          Number(row.typetree?.elementConfigId)
        ),
        propertyElementIds: leafRows.map(row =>
          Number(row.typetree?.elementConfigId)
        ),
        wrapperElementIds: [],
        effectPathElementIds: leafRows.map(row =>
          Number(row.typetree?.elementConfigId)
        ),
        removalPaths: compiledLeaves.flatMap(leaf =>
          leaf.effect.lifecycle?.removalPaths ?? []
        ),
        damageElementIds: damageRows.map(row =>
          Number(row.typetree?.elementConfigId)
        ),
        activationPrerequisiteElementIds: activationPrerequisiteRows.map(row =>
          Number(row.typetree?.elementConfigId)
        ),
      },
      runtimeGaps: uniqueStrings(gaps),
      sourceIdentity: [
        `NewTable/soulessence.rows[id=${soul.soulEssenceId}].reishiSkill`,
        control?.sourceIdentity,
        ...leafRows.map(createElementIdentity),
      ]
        .filter(Boolean)
        .join('|'),
    };
  }
  const runtimeGaps = [];
  if (!control) runtimeGaps.push('effect-control-source-missing');
  if (missingPathIds.length)
    runtimeGaps.push('effect-resource-reference-missing');
  if (
    triggerEntries.length === 0 ||
    triggerEntries.some(entry => !entry.valid)
  ) {
    runtimeGaps.push('effect-active-trigger-not-unique');
  }
  if (!triggerEvent || !SUPPORTED_FRAME_ANCHORS.has(triggerEvent.frameAnchor)) {
    runtimeGaps.push('effect-trigger-event-operator-unsupported');
  }
  if (!triggerTargetBinding) {
    runtimeGaps.push('effect-trigger-source-target-unsupported');
  }
  if (
    triggerEvent?.frameAnchor === 'shield-after-acquire' &&
    triggerContract.nonDamageRuntime?.onGotShield
      ?.refreshReplacementSemantics !== 'applied'
  ) {
    runtimeGaps.push(
      'effect-shield-refresh-replacement-semantics-evidence-gap'
    );
  }
  const activationConditions = compileActivationConditions({
    activationPrerequisiteRows,
    elementFormulaRows,
    activationConditionRuntimeEvidence,
  });
  if (
    activationPrerequisiteRows.length > 0 &&
    activationConditions.some(condition => condition.status !== 'applied')
  ) {
    runtimeGaps.push('effect-activation-condition-operator-unsupported');
  }
  const primaryTriggerCondition =
    triggerEntries[0]?.value?.condition ?? compiledCondition;
  if (primaryTriggerCondition?.status !== 'applied') {
    runtimeGaps.push('effect-skill-tag-condition-operator-unsupported');
  }
  if (reachablePropertyRows.length !== 1) {
    runtimeGaps.push('effect-property-leaf-not-unique');
  }
  if (damageRows.length) runtimeGaps.push('effect-damage-branch-unapplied');
  if (unhandledImmediateEffectRows.length)
    runtimeGaps.push('effect-immediate-effect-unapplied');
  if (!(Number(lifecycle?.durationMs) > 0)) {
    runtimeGaps.push('effect-property-duration-unresolved');
  }
  if (
    (effectPathRows.length > 1 && wrapperRows.length !== 1) ||
    wrapperRows.length > 1
  ) {
    runtimeGaps.push('effect-wrapper-lifecycle-not-unique');
  }
  if (![3, 4, 5].includes(Number(propertyTree.combineType))) {
    runtimeGaps.push('effect-property-stack-operator-unsupported');
  }
  if (
    Number(propertyTree.combineType) === 5 &&
    triggerContract.nonDamageRuntime?.combineSemantics?.block?.runtimeMode !==
      'block-while-active-same-config'
  ) {
    runtimeGaps.push('effect-property-block-native-evidence-gap');
  }
  if (!PROPERTY_BUCKET_BY_CALCULATE_TYPE[Number(propertyTree.calculateType)]) {
    runtimeGaps.push('effect-property-bucket-unsupported');
  }
  if (propertyTags.length > 1) {
    runtimeGaps.push('effect-property-tag-composition-evidence-gap');
  } else if (
    propertyTags.length === 1 &&
    !supportedPropertyTags.has(propertyTags[0])
  ) {
    runtimeGaps.push('effect-property-tag-action-mapping-evidence-gap');
  }
  if (
    commonFunctionId !== 1 ||
    ![3, 5].includes(baseFunctionId) ||
    commonRatioRaw !== 10_000
  ) {
    runtimeGaps.push('effect-formula-family-operator-unsupported');
  }
  if (starValues.length !== 4)
    runtimeGaps.push('effect-star-values-incomplete');
  if (
    triggerEffectRows.length === 0 ||
    rowTargetBindings.some(binding => binding == null)
  ) {
    runtimeGaps.push('effect-trigger-target-unsupported');
  }
  const runtimeStatus = runtimeGaps.length
    ? 'source-indexed-runtime-unapplied'
    : 'runtime-applied';
  const mechanismFamily = createMechanismFamily(triggerEvent);
  return {
    soulEssenceId: soul.soulEssenceId,
    name: soul.name,
    effectSkillId,
    effectSkillLogic: logicBySkillId.get(effectSkillId)
      ? {
          skillLogicType: Number(
            logicBySkillId.get(effectSkillId).skillLogicType
          ),
          sourceIdentity: `NewTable/skillsub_logic.rows[skillId=${effectSkillId}]`,
        }
      : null,
    runtimeStatus,
    mechanismFamily,
    activationPrerequisites: activationPrerequisiteRows.map(row => ({
      elementId: Number(row.typetree?.elementConfigId),
      pathId: Number(row.path_id),
      triggerType: Number(row.typetree?.triggerType),
      conditions: (row.typetree?.triggerConditionList ?? []).map(condition => ({
        conditionType: Number(condition?.conditionParam1),
        conditionValue: Number(condition?.conditionParam2),
        conditionExtra: Number.isFinite(Number(condition?.conditionParam3))
          ? Number(condition.conditionParam3)
          : null,
      })),
      sourceIdentity: createElementIdentity(row),
    })),
    activationConditions,
    trigger: triggerEntries[0]?.value ?? null,
    triggers:
      activeTriggers.length > 1
        ? triggerEntries.map(entry => entry.value)
        : [],
    effect:
      property == null
        ? null
        : {
            elementId: Number(propertyTree.elementConfigId),
            pathId: property.path_id,
            name: propertyTree.elementName ?? property.name ?? null,
            attributeId: Number(propertyTree.attributeID),
            bucket:
              PROPERTY_BUCKET_BY_CALCULATE_TYPE[
                Number(propertyTree.calculateType)
              ] ?? null,
            calculateType: Number(propertyTree.calculateType),
            propertyTags,
            propertyTagMatchMode:
              propertyTags.length === 0
                ? 'unscoped'
                : propertyTags.length === 1
                  ? 'single-exact'
                  : 'evidence-open-multi-tag',
            propertyTagSourceIdentity: `${createElementIdentity(property)}.defaultPropertyTags`,
            formula: {
              formulaIdentity: `battle-effect-formula:soulessence:${effectSkillId}:${Number(propertyTree.elementConfigId)}:${property.path_id}`,
              commonFunctionId,
              commonExpression: commonFunctionId === 1 ? 'G/10000' : null,
              baseFunctionId,
              baseExpression:
                baseFunctionId === 3
                  ? 'A/10000'
                  : baseFunctionId === 5
                    ? 'A'
                    : null,
              commonRatioRaw,
              sourceParameterEncoding: 'battle-element-raw-a',
              family: formulaFamily,
              sourceIdentity: `${createElementIdentity(property)}.formulaParams|functionParams`,
            },
            durationMs: Number(lifecycle?.durationMs),
            leafDurationMs: Number(propertyTree.time),
            lifecycle,
            stackMode:
              Number(propertyTree.combineType) === 4
                ? 'stack'
                : Number(propertyTree.combineType) === 5
                  ? 'block'
                  : 'refresh',
            stackDelta: 1,
            maxStacks:
              Number(propertyTree.combineType) === 4
                ? Math.max(1, Number(propertyTree.combineNumber) || 1)
                : 1,
            combineType: Number(propertyTree.combineType),
            combineNumber: Number(propertyTree.combineNumber),
            valuesByStar: starValues,
            sourceIdentity: createElementIdentity(property),
          },
    sourceClosure: {
      controlSkillId: effectSkillId,
      controlSourceIdentity: control?.sourceIdentity ?? null,
      resourcePathIds,
      missingPathIds,
      reachablePathIds: closure.rows.map(row => row.path_id),
      activeTriggerElementIds: activeTriggers.map(row =>
        Number(row.typetree?.elementConfigId)
      ),
      unloadTriggerElementIds: unloadTriggers.map(row =>
        Number(row.typetree?.elementConfigId)
      ),
      propertyElementIds: propertyRows.map(row =>
        Number(row.typetree?.elementConfigId)
      ),
      wrapperElementIds: wrapperRows.map(row =>
        Number(row.typetree?.elementConfigId)
      ),
      effectPathElementIds: effectPathRows.map(row =>
        Number(row.typetree?.elementConfigId)
      ),
      removalPaths: lifecycle?.removalPaths ?? [],
      damageElementIds: damageRows.map(row =>
        Number(row.typetree?.elementConfigId)
      ),
      activationPrerequisiteElementIds: activationPrerequisiteRows.map(row =>
        Number(row.typetree?.elementConfigId)
      ),
    },
    runtimeGaps: uniqueStrings(runtimeGaps),
    sourceIdentity: [
      `NewTable/soulessence.rows[id=${soul.soulEssenceId}].reishiSkill`,
      control?.sourceIdentity,
      trigger ? createElementIdentity(trigger) : null,
      ...wrapperRows.map(createElementIdentity),
      property ? createElementIdentity(property) : null,
    ]
      .filter(Boolean)
      .join('|'),
  };
}

function compilePersistentSoulEffectDefinition({
  soul,
  effectSkillId,
  effectSkillLogic,
  valueRows,
  control,
  closure,
  propertyRows,
  unloadTriggers,
  damageRows,
  missingPathIds,
  battleElementsByPathId,
  propertyTagContract,
  persistentLoadoutPropertyRuntimeEvidence,
  periodicPersistentPropertyRuntimeEvidence,
  unhandledImmediateEffectRows = [],
}) {
  const persistentRoot = compilePersistentPropertyRoot({
    ownerKind: 'soul-essence',
    ownerId: soul.soulEssenceId,
    skillId: effectSkillId,
    control,
    closure,
    propertyRows,
    unloadTriggers,
    damageRows,
    battleElementsByPathId,
    propertyTagContract,
    persistentLoadoutPropertyRuntimeEvidence,
    periodicPersistentPropertyRuntimeEvidence,
    resolveValues: property =>
      compileStarValues({
        rows: valueRows,
        elementId: Number(property.typetree?.elementConfigId),
      }),
  });
  const runtimeGaps = uniqueStrings([
    ...(control ? [] : ['effect-control-source-missing']),
    ...(missingPathIds.length ? ['effect-resource-reference-missing'] : []),
    ...(unhandledImmediateEffectRows.length
      ? ['effect-immediate-effect-unapplied']
      : []),
    ...persistentRoot.runtimeGaps,
  ]);
  const runtimeStatus = runtimeGaps.length
    ? 'source-indexed-runtime-unapplied'
    : 'runtime-applied';
  return {
    soulEssenceId: soul.soulEssenceId,
    name: soul.name,
    effectSkillId,
    effectSkillLogic: effectSkillLogic
      ? {
          skillLogicType: Number(effectSkillLogic.skillLogicType),
          sourceIdentity: `NewTable/skillsub_logic.rows[skillId=${effectSkillId}]`,
        }
      : null,
    runtimeStatus,
    mechanismFamily:
      runtimeStatus === 'runtime-applied'
        ? persistentRoot.activationMode ===
          'periodic-conditional-finite-leaf'
          ? 'equipped-loadout-periodic-conditional-property-root'
          : 'equipped-actor-persistent-property-root'
        : 'source-indexed-composite-effect',
    activationPrerequisites: persistentRoot.activationPrerequisites,
    trigger: null,
    effect: null,
    persistentRoot: {
      ...persistentRoot,
      status: runtimeStatus,
    },
    sourceClosure: {
      controlSkillId: effectSkillId,
      controlSourceIdentity: control?.sourceIdentity ?? null,
      resourcePathIds: uniqueNumbers(control?.resourcePathIds ?? []),
      missingPathIds,
      reachablePathIds: closure.rows.map(row => row.path_id),
      activeTriggerElementIds: [],
      unloadTriggerElementIds: unloadTriggers.map(row =>
        Number(row.typetree?.elementConfigId)
      ),
      propertyElementIds: propertyRows.map(row =>
        Number(row.typetree?.elementConfigId)
      ),
      wrapperElementIds: persistentRoot.wrapperElementIds,
      effectPathElementIds: persistentRoot.effectPathElementIds,
      removalPaths: persistentRoot.unload.removalPaths,
      damageElementIds: damageRows.map(row =>
        Number(row.typetree?.elementConfigId)
      ),
      activationPrerequisiteElementIds:
        persistentRoot.activationPrerequisites.map(row => row.elementId),
      timelineInjections: structuredClone(control?.timelineInjections ?? []),
    },
    runtimeGaps,
    sourceIdentity: [
      `NewTable/soulessence.rows[id=${soul.soulEssenceId}].reishiSkill`,
      control?.sourceIdentity,
      persistentRoot.sourceIdentity,
    ]
      .filter(Boolean)
      .join('|'),
  };
}

function compilePersistentPropertyRoot({
  ownerKind,
  ownerId,
  skillId,
  control,
  closure,
  propertyRows,
  unloadTriggers,
  damageRows,
  battleElementsByPathId,
  propertyTagContract,
  persistentLoadoutPropertyRuntimeEvidence,
  periodicPersistentPropertyRuntimeEvidence,
  resolveValues,
}) {
  const supportedPropertyTags = new Set(
    (propertyTagContract?.bindings ?? [])
      .filter(binding => binding.status === 'applied')
      .map(binding => Number(binding.propertyTag))
  );
  const installationCandidates = (control?.timelineInjections ?? [])
    .filter(
      injection =>
        Number(injection.startFrame) === 0 &&
        Number(injection.directInjectTargetType) === 0 &&
        injection.removeElementOnEnd === false
    )
    .map(injection => ({
      injection,
      root: battleElementsByPathId.get(Number(injection.elementPathId)),
    }))
    .filter(({ root }) => {
      if (!root) return false;
      if (
        Number(root.typetree?.triggerType) === 1 &&
        Number(root.typetree?.triggerParam1) === 36
      ) {
        return false;
      }
      return collectReachableRows(
        root.path_id,
        closure.edges,
        battleElementsByPathId
      ).some(reachable =>
        propertyRows.some(property => property.path_id === reachable.path_id)
      );
    });
  const installation =
    installationCandidates.length === 1 ? installationCandidates[0] : null;
  const rootRow = installation?.root ?? null;
  const rootElementId = numberOrNull(rootRow?.typetree?.elementConfigId);
  const periodicEvidenceContract =
    periodicPersistentPropertyRuntimeEvidence?.rootContracts?.find(
      row => Number(row.rootElementId) === rootElementId
    ) ?? null;
  const periodicRoot = periodicEvidenceContract != null;
  const periodicRuntimeApplied =
    periodicEvidenceContract?.disposition === 'runtime-applied';
  const reachableRows = rootRow
    ? collectReachableRows(
        rootRow.path_id,
        closure.edges,
        battleElementsByPathId
      )
    : [];
  const effects = reachableRows
    .filter(row =>
      propertyRows.some(property => property.path_id === row.path_id)
    )
    .map(property =>
      compilePersistentPropertyEffect({
        ownerKind,
        ownerId,
        skillId,
        property,
        values: resolveValues(property),
      })
    )
    .sort(
      (left, right) =>
        left.elementId - right.elementId || left.pathId - right.pathId
    );
  const wrapperRows = reachableRows.filter(
    row =>
      row.path_id !== rootRow?.path_id &&
      !effects.some(effect => effect.pathId === Number(row.path_id))
  );
  const conditionalRows = reachableRows.filter(row => {
    const tree = row.typetree ?? {};
    return (
      Number(tree.triggerType) === 0 ||
      (Array.isArray(tree.triggerConditionList) &&
        tree.triggerConditionList.length > 0)
    );
  });
  const unloadCandidates = (control?.timelineInjections ?? [])
    .map(injection => ({
      injection,
      trigger: unloadTriggers.find(
        row => Number(row.path_id) === Number(injection.elementPathId)
      ),
    }))
    .filter(
      ({ injection, trigger }) =>
        trigger != null &&
        Number(injection.startFrame) === 0 &&
        Number(injection.directInjectTargetType) === 0 &&
        injection.removeElementOnEnd === false
    );
  const unloadCandidate =
    unloadCandidates.length === 1 ? unloadCandidates[0] : null;
  const removalPath =
    unloadCandidate?.trigger && rootRow
      ? findElementPath(
          unloadCandidate.trigger.path_id,
          rootRow.path_id,
          closure.edges
        )
      : null;
  const runtimeGaps = [];
  if (
    persistentLoadoutPropertyRuntimeEvidence?.conclusion?.status !== 'applied'
  ) {
    runtimeGaps.push('effect-persistent-root-native-evidence-gap');
  }
  if (installationCandidates.length !== 1) {
    runtimeGaps.push('effect-persistent-root-installation-not-unique');
  }
  if (periodicRoot) {
    if (
      periodicPersistentPropertyRuntimeEvidence?.conclusion?.status !==
      'applied'
    ) {
      runtimeGaps.push('effect-periodic-root-native-evidence-gap');
    }
    if (!periodicRuntimeApplied) {
      runtimeGaps.push(
        periodicEvidenceContract?.disposition ===
          'evidence-insufficient-multi-property-tag-match'
          ? 'effect-periodic-root-multi-property-tag-semantics-evidence-gap'
          : 'effect-periodic-root-source-evidence-insufficient'
      );
    }
  } else if (conditionalRows.length > 0) {
    runtimeGaps.push('effect-persistent-root-conditional-wrapper-unsupported');
  }
  if (damageRows.length > 0) {
    runtimeGaps.push('effect-persistent-root-damage-branch-unapplied');
  }
  if (effects.length === 0) {
    runtimeGaps.push('effect-persistent-root-property-leaf-missing');
  }
  if (
    !periodicRoot &&
    rootRow &&
    Object.hasOwn(rootRow.typetree ?? {}, 'time') &&
    Number(rootRow.typetree?.time) !== -1
  ) {
    runtimeGaps.push('effect-persistent-root-lifetime-not-permanent');
    runtimeGaps.push('effect-persistent-root-conditional-wrapper-unsupported');
  }
  for (const effect of effects) {
    if (!periodicRoot && effect.durationMs !== -1) {
      runtimeGaps.push('effect-persistent-root-lifetime-not-permanent');
      runtimeGaps.push(
        'effect-persistent-root-conditional-wrapper-unsupported'
      );
    }
    if (periodicRoot && !(effect.durationMs > 0)) {
      runtimeGaps.push('effect-periodic-root-leaf-duration-invalid');
    }
    if (
      effect.combineType !== 3 ||
      (!periodicRoot && effect.combineNumber !== -1) ||
      (periodicRoot && ![0, -1].includes(effect.combineNumber)) ||
      effect.executeTargetType !== 0 ||
      effect.inheritType !== 0
    ) {
      runtimeGaps.push('effect-persistent-root-lifecycle-unsupported');
    }
    if (!['dynamicExtra', 'dynamicPercent'].includes(effect.bucket)) {
      runtimeGaps.push('effect-persistent-root-property-bucket-unsupported');
    }
    if (
      effect.formula.commonFunctionId !== 1 ||
      ![3, 5].includes(effect.formula.baseFunctionId) ||
      effect.formula.commonRatioRaw !== 10_000
    ) {
      runtimeGaps.push('effect-persistent-root-formula-unsupported');
    }
    if (
      effect.propertyTags.length > 1 ||
      (effect.propertyTags.length === 1 &&
        !supportedPropertyTags.has(effect.propertyTags[0]))
    ) {
      runtimeGaps.push(
        periodicRoot && effect.propertyTags.length > 1
          ? 'effect-periodic-root-multi-property-tag-semantics-evidence-gap'
          : 'effect-persistent-root-property-tag-unsupported'
      );
    }
    if (ownerKind === 'soul-essence' && effect.valuesByStar.length !== 4) {
      runtimeGaps.push('effect-persistent-root-star-values-incomplete');
    }
  }
  if (unloadCandidates.length !== 1 || !removalPath) {
    runtimeGaps.push('effect-persistent-root-unload-path-unresolved');
  }
  const evidenceSourceIdentity =
    persistentLoadoutPropertyRuntimeEvidence?.conclusion?.sourceIdentity ??
    'persistent-loadout-property-native-evidence-unresolved';
  const periodicEvidenceSourceIdentity = periodicRoot
    ? (periodicPersistentPropertyRuntimeEvidence?.conclusion
        ?.sourceIdentity ?? 'periodic-persistent-property-evidence-unresolved')
    : null;
  return {
    status: runtimeGaps.length
      ? 'source-indexed-runtime-unapplied'
      : 'runtime-applied',
    installation: {
      frame: installation?.injection?.startFrame ?? null,
      targetKind:
        Number(installation?.injection?.directInjectTargetType) === 0
          ? 'self-actor'
          : 'unresolved',
      directInjectTargetType:
        installation?.injection?.directInjectTargetType ?? null,
      removeElementOnEnd: installation?.injection?.removeElementOnEnd ?? null,
      rootElementId,
      rootPathId: numberOrNull(rootRow?.path_id),
      sourceSequencePath: structuredClone(
        installation?.injection?.sourceSequencePath ?? []
      ),
      sourceIdentity: [
        installation?.injection?.sourceIdentity,
        rootRow ? createElementIdentity(rootRow) : null,
        evidenceSourceIdentity,
        periodicEvidenceSourceIdentity,
      ]
        .filter(Boolean)
        .join('|'),
    },
    lifecycle: {
      durationMode: periodicRoot
        ? 'persistent-root-periodic-finite-property-leaf'
        : 'until-loadout-uninstall',
      leafDurationMs:
        effects.length > 0 &&
        effects.every(effect => effect.durationMs === effects[0].durationMs)
          ? effects[0].durationMs
          : null,
      combineMode: 'cover-by-source-identity',
      inheritType: 0,
      sourceIdentity: evidenceSourceIdentity,
    },
    activationMode: periodicRoot
      ? 'periodic-conditional-finite-leaf'
      : 'scenario-start-permanent',
    periodicActivation: periodicRoot
      ? {
          triggerType: numberOrNull(rootRow?.typetree?.triggerType),
          timeTriggerType: numberOrNull(rootRow?.typetree?.triggerParam1),
          intervalMs: numberOrNull(rootRow?.typetree?.triggerParam2),
          timeExecuteFirstFrame:
            Number(rootRow?.typetree?.timeExeFirstFrame) === 1,
          triggerCounter: numberOrNull(rootRow?.typetree?.triggerCounter),
          conditionLogic:
            Number(rootRow?.typetree?.triggerConditionType) === 0
              ? 'and'
              : 'unresolved',
          conditions: structuredClone(periodicEvidenceContract?.conditions ?? []),
          conditionFailureConsumesPeriod: true,
          firstTick: 'first-positive-runtime-update',
          subsequentTickBoundary:
            'strict-elapsed-greater-than-ordinal-times-interval',
          sameFramePhase: 'after-action-and-tuning-transactions',
          target:
            Number(periodicEvidenceContract?.targetType) === 13
              ? {
                  kind: 'self-kibo',
                  targetType: 13,
                  sourceIdentity: periodicEvidenceSourceIdentity,
                }
              : Number(periodicEvidenceContract?.targetType) === 0
                ? {
                    kind: 'self-actor',
                    targetType: 0,
                    sourceIdentity: periodicEvidenceSourceIdentity,
                  }
                : {
                    kind: 'unresolved',
                    targetType: numberOrNull(
                      periodicEvidenceContract?.targetType
                    ),
                    sourceIdentity: periodicEvidenceSourceIdentity,
                  },
          sourceIdentity: [
            rootRow ? createElementIdentity(rootRow) : null,
            periodicEvidenceSourceIdentity,
          ]
            .filter(Boolean)
            .join('|'),
        }
      : null,
    unload: {
      eventId: 36,
      triggerElementId: numberOrNull(
        unloadCandidate?.trigger?.typetree?.elementConfigId
      ),
      triggerPathId: numberOrNull(unloadCandidate?.trigger?.path_id),
      removalPaths: removalPath
        ? [
            {
              pathIds: removalPath,
              elementIds: removalPath
                .map(pathId => battleElementsByPathId.get(pathId))
                .filter(Boolean)
                .map(row => Number(row.typetree?.elementConfigId)),
            },
          ]
        : [],
      sourceIdentity: [
        unloadCandidate?.injection?.sourceIdentity,
        unloadCandidate?.trigger
          ? createElementIdentity(unloadCandidate.trigger)
          : null,
        evidenceSourceIdentity,
      ]
        .filter(Boolean)
        .join('|'),
    },
    effects,
    activationPrerequisites: conditionalRows.map(row => ({
      elementId: Number(row.typetree?.elementConfigId),
      pathId: Number(row.path_id),
      triggerType: numberOrNull(row.typetree?.triggerType),
      conditions: projectConditions(row.typetree?.triggerConditionList),
      sourceIdentity: createElementIdentity(row),
    })),
    wrapperElementIds: wrapperRows.map(row =>
      Number(row.typetree?.elementConfigId)
    ),
    effectPathElementIds: reachableRows.map(row =>
      Number(row.typetree?.elementConfigId)
    ),
    runtimeGaps: uniqueStrings(runtimeGaps),
    sourceIdentity: [
      installation?.injection?.sourceIdentity,
      rootRow ? createElementIdentity(rootRow) : null,
      ...effects.map(effect => effect.sourceIdentity),
      unloadCandidate?.injection?.sourceIdentity,
      unloadCandidate?.trigger
        ? createElementIdentity(unloadCandidate.trigger)
        : null,
      evidenceSourceIdentity,
      periodicEvidenceSourceIdentity,
    ]
      .filter(Boolean)
      .join('|'),
  };
}

function compilePersistentPropertyEffect({
  ownerKind,
  ownerId,
  skillId,
  property,
  values,
}) {
  const tree = property.typetree ?? {};
  const commonFunctionId = Number(
    tree.formulaParams?.function_1 ?? tree.baseIntParams?.[0]
  );
  const baseFunctionId = Number(
    tree.formulaParams?.function_2 ?? tree.baseIntParams?.[1]
  );
  const formulaParams = structuredClone(
    tree.formulaParams?.formulaParamValues ?? tree.functionParams ?? []
  ).map(Number);
  return {
    elementId: Number(tree.elementConfigId),
    pathId: Number(property.path_id),
    name: tree.elementName ?? property.name ?? null,
    attributeId: Number(tree.attributeID),
    bucket:
      PROPERTY_BUCKET_BY_CALCULATE_TYPE[Number(tree.calculateType)] ?? null,
    calculateType: numberOrNull(tree.calculateType),
    durationMs: numberOrNull(tree.time),
    combineType: numberOrNull(tree.combineType),
    combineNumber: numberOrNull(tree.combineNumber),
    executeTargetType: numberOrNull(tree.executeTargetType),
    inheritType: numberOrNull(tree.inheritType),
    propertyTags: uniqueNumbers(tree.defaultPropertyTags ?? []),
    propertyTagMatchMode:
      (tree.defaultPropertyTags ?? []).length === 0
        ? 'unscoped'
        : (tree.defaultPropertyTags ?? []).length === 1
          ? 'single-exact'
          : 'evidence-open-multi-tag',
    propertyTagSourceIdentity: `${createElementIdentity(property)}.defaultPropertyTags`,
    formula: {
      formulaIdentity: `battle-effect-formula:${ownerKind}:${ownerId}:${skillId}:${Number(tree.elementConfigId)}:${property.path_id}`,
      commonFunctionId,
      commonExpression: commonFunctionId === 1 ? 'G/10000' : null,
      baseFunctionId,
      baseExpression:
        baseFunctionId === 3 ? 'A/10000' : baseFunctionId === 5 ? 'A' : null,
      commonRatioRaw: Number(formulaParams[6]),
      formulaParams,
      sourceParameterEncoding: 'battle-element-raw-a',
      family: resolveFormulaFamily({ commonFunctionId, baseFunctionId }),
      sourceIdentity: `${createElementIdentity(property)}.formulaParams|functionParams`,
    },
    sourceRawA: numberOrNull(formulaParams[0]),
    valuesByStar: structuredClone(values ?? []),
    sourceIdentity: createElementIdentity(property),
  };
}

function createMechanismFamily(triggerEvent) {
  if (triggerEvent?.frameAnchor === 'action-start') {
    return 'equipped-actor-skill-tag-property-before-skill';
  }
  if (triggerEvent?.frameAnchor === 'action-end') {
    return 'equipped-actor-skill-tag-property-after-skill';
  }
  if (triggerEvent?.frameAnchor === 'hit-before-damage') {
    return 'equipped-actor-skill-tag-property-before-damage';
  }
  if (triggerEvent?.frameAnchor === 'hit-after-damage') {
    return 'equipped-actor-skill-tag-property-after-damage';
  }
  if (triggerEvent?.frameAnchor === 'element-before-acquire') {
    return 'equipped-actor-get-element-property-before-acquire';
  }
  if (triggerEvent?.frameAnchor === 'element-after-acquire') {
    return 'equipped-actor-get-element-property-after-acquire';
  }
  if (triggerEvent?.frameAnchor === 'switch-enter') {
    return 'equipped-actor-switch-enter-team-property';
  }
  if (triggerEvent?.frameAnchor === 'shield-after-acquire') {
    return 'equipped-actor-shield-acquire-team-property';
  }
  if (triggerEvent?.frameAnchor === 'heal-after-settlement') {
    return 'equipped-actor-heal-event-target-property';
  }
  return 'source-indexed-composite-effect';
}

async function readBattleElementAssets(sourcePath) {
  const bytes = await fs.readFile(sourcePath);
  const byPathId = new Map();
  for (const line of bytes.toString('utf8').split(/\r?\n/u)) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    byPathId.set(Number(row.path_id), row);
  }
  return {
    byPathId,
    metadata: {
      path: sourcePath.replaceAll('\\', '/'),
      bytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      rowCount: byPathId.size,
    },
  };
}

async function readControlClosures({
  effectSkillIds,
  skillControlRoot,
  projectRoot,
}) {
  const bySkillId = new Map();
  const hash = createHash('sha256');
  let bytes = 0;
  let fileCount = 0;
  for (const skillId of [...effectSkillIds].sort((a, b) => a - b)) {
    const monoRoot = path.join(
      skillControlRoot,
      `skill_control_${skillId}.asset`,
      'MonoBehaviour'
    );
    let names = [];
    try {
      names = (await fs.readdir(monoRoot)).filter(name =>
        name.endsWith('.json')
      );
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    names.sort();
    const documents = [];
    for (const name of names) {
      const filePath = path.join(monoRoot, name);
      const fileBytes = await fs.readFile(filePath);
      const relative = normalizePath(filePath, projectRoot);
      hash.update(relative).update('\0').update(fileBytes).update('\0');
      bytes += fileBytes.byteLength;
      fileCount += 1;
      documents.push({
        name,
        pathId: documentPathId(name),
        sourceIdentity: relative,
        value: JSON.parse(fileBytes.toString('utf8')),
      });
    }
    const root = documents.find(
      document =>
        Number(document.value?.skillControlData?.skillId) === Number(skillId)
    );
    const resourcePathIds = uniqueNumbers(
      (root?.value?.skillResourceMaps ?? []).flatMap(resourceMap =>
        (resourceMap.elements ?? []).map(reference =>
          Number(reference.m_PathID)
        )
      )
    );
    const documentByPathId = new Map();
    for (const document of documents.filter(item =>
      Number.isFinite(item.pathId)
    )) {
      const pathId = Number(document.pathId);
      const current = documentByPathId.get(pathId);
      if (
        !current ||
        documentSemanticScore(document) > documentSemanticScore(current)
      ) {
        documentByPathId.set(pathId, document);
      }
    }
    const timelineInjections = [];
    for (const [skillPlayerIndex, skillPlayer] of (
      root?.value?.skillControlData?.skillPlayers ?? []
    ).entries()) {
      for (const [trackListIndex, trackReference] of (
        skillPlayer?.skillTrackDatas ?? []
      ).entries()) {
        const track = documentByPathId.get(Number(trackReference?.m_PathID));
        for (const [behaviorLineIndex, behaviorLine] of (
          track?.value?.behaviorlineControl ?? []
        ).entries()) {
          for (const [behaviorListIndex, behaviorReference] of (
            behaviorLine?.behaviorList ?? []
          ).entries()) {
            const behavior = documentByPathId.get(
              Number(behaviorReference?.m_PathID)
            );
            const behaviorValue = behavior?.value ?? {};
            for (const [elementIndex, elementReference] of (
              behaviorValue.elementDataList ?? []
            ).entries()) {
              timelineInjections.push({
                skillPlayerIndex,
                trackListIndex,
                trackPathId: numberOrNull(trackReference?.m_PathID),
                trackIndex: numberOrNull(track?.value?.trackIndex),
                behaviorLineIndex,
                behaviorListIndex,
                behaviorPathId: numberOrNull(behaviorReference?.m_PathID),
                elementIndex,
                elementPathId: Number(elementReference?.m_PathID),
                startFrame: Number(
                  behaviorValue.startFrame ?? behaviorLine?.startFrame ?? 0
                ),
                frameCount: numberOrNull(behaviorValue.frameCount),
                directInjectTargetType: numberOrNull(
                  behaviorValue.directInjectTargetType
                ),
                removeElementOnEnd:
                  Number(behaviorValue.removeElementOnEnd) === 1,
                sourceSequencePath: [
                  skillPlayerIndex,
                  trackListIndex,
                  behaviorLineIndex,
                  behaviorListIndex,
                  elementIndex,
                ],
                sourceIdentity: [
                  track?.sourceIdentity,
                  `behaviorlineControl[${behaviorLineIndex}].behaviorList[${behaviorListIndex}]`,
                  behavior?.sourceIdentity,
                  `elementDataList[${elementIndex}]`,
                ]
                  .filter(Boolean)
                  .join('|'),
              });
            }
          }
        }
      }
    }
    bySkillId.set(skillId, {
      sourceIdentity:
        root?.sourceIdentity ?? normalizePath(monoRoot, projectRoot),
      resourcePathIds,
      timelineInjections: timelineInjections.sort(compareTimelineInjections),
      documentCount: documents.length,
    });
  }
  return {
    bySkillId,
    metadata: {
      path: normalizePath(skillControlRoot, projectRoot),
      skillCount: bySkillId.size,
      fileCount,
      bytes,
      sha256: hash.digest('hex'),
    },
  };
}

function documentPathId(name) {
  const match = String(name).match(/__(-?\d+)\.json$/u);
  return match ? Number(match[1]) : null;
}

function documentSemanticScore(document) {
  const value = document?.value ?? {};
  return (
    (value.skillControlData ? 16 : 0) +
    (Array.isArray(value.behaviorlineControl) ? 8 : 0) +
    (Array.isArray(value.elementDataList) ? 4 : 0) +
    (Number.isFinite(Number(value.startFrame)) ? 2 : 0) +
    (value.m_Name != null ? 1 : 0)
  );
}

function compareTimelineInjections(left, right) {
  const leftPath = left.sourceSequencePath ?? [];
  const rightPath = right.sourceSequencePath ?? [];
  const length = Math.max(leftPath.length, rightPath.length);
  for (let index = 0; index < length; index += 1) {
    const delta =
      Number(leftPath[index] ?? -1) - Number(rightPath[index] ?? -1);
    if (delta !== 0) return delta;
  }
  return Number(left.elementPathId) - Number(right.elementPathId);
}

function collectElementClosure({ rootPathIds, battleElementsByPathId }) {
  const rows = [];
  const edges = new Map();
  const queue = [...rootPathIds];
  const visited = new Set();
  while (queue.length) {
    const pathId = Number(queue.shift());
    if (visited.has(pathId)) continue;
    visited.add(pathId);
    const row = battleElementsByPathId.get(pathId);
    if (!row) continue;
    rows.push(row);
    const targets = uniqueNumbers(
      collectPathReferences(row.typetree).filter(reference =>
        battleElementsByPathId.has(reference)
      )
    );
    edges.set(pathId, targets);
    queue.push(...targets);
  }
  return {
    rows: rows.sort(
      (left, right) => Number(left.path_id) - Number(right.path_id)
    ),
    edges,
  };
}

function collectReachableRows(rootPathId, edges, battleElementsByPathId) {
  const queue = [Number(rootPathId)];
  const visited = new Set();
  const rows = [];
  while (queue.length) {
    const pathId = Number(queue.shift());
    if (visited.has(pathId)) continue;
    visited.add(pathId);
    const row = battleElementsByPathId.get(pathId);
    if (row) rows.push(row);
    queue.push(...(edges.get(pathId) ?? []));
  }
  return rows;
}

function findElementPath(rootPathId, targetPathId, edges) {
  const root = Number(rootPathId);
  const target = Number(targetPathId);
  if (!Number.isInteger(root) || !Number.isInteger(target)) return null;
  const queue = [[root]];
  const visited = new Set();
  while (queue.length) {
    const path = queue.shift();
    const current = path.at(-1);
    if (current === target) return path;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of edges.get(current) ?? []) {
      if (!visited.has(next)) queue.push([...path, next]);
    }
  }
  return null;
}

function isBuffElementWrapper(row) {
  const tree = row?.typetree ?? {};
  return (
    Array.isArray(tree.injectElementDataList) &&
    Array.isArray(tree.notDelElementDataList) &&
    Number.isFinite(Number(tree.time)) &&
    !Number.isInteger(Number(tree.attributeID))
  );
}

function compilePropertyLifecycle({
  property,
  wrapperRows,
  unloadTriggers,
  closure,
  battleElementsByPathId,
  wrapperContract,
}) {
  if (!property) return null;
  const leafDurationMs = Number(property.typetree?.time);
  const removalPaths = projectUnloadRemovalPaths({
    unloadTriggers,
    closure,
    battleElementsByPathId,
  });
  if (leafDurationMs > 0 && wrapperRows.length === 0) {
    return {
      sourceKind: 'property-leaf-duration',
      durationMs: leafDurationMs,
      leafDurationMs,
      durationSourceIdentity: `${createElementIdentity(property)}.time`,
      wrapper: null,
      removalPaths,
    };
  }
  const wrapper = wrapperRows.length === 1 ? wrapperRows[0] : null;
  const wrapperDurationMs = Number(wrapper?.typetree?.time);
  const injectedPathIds = uniqueNumbers(
    (wrapper?.typetree?.injectElementDataList ?? []).map(entry =>
      Number(entry?.m_PathID)
    )
  );
  if (
    leafDurationMs === -1 &&
    wrapperDurationMs > 0 &&
    injectedPathIds.includes(Number(property.path_id)) &&
    wrapperContract?.status === 'applied'
  ) {
    return {
      sourceKind: 'battle-buff-element-wrapper',
      durationMs: wrapperDurationMs,
      leafDurationMs,
      durationSourceIdentity: `${createElementIdentity(wrapper)}.time|${wrapperContract.sourceIdentity}`,
      wrapper: {
        elementId: Number(wrapper.typetree?.elementConfigId),
        pathId: Number(wrapper.path_id),
        durationMs: wrapperDurationMs,
        inheritType: numberOrNull(wrapper.typetree?.inheritType),
        isTeamElement: Number(wrapper.typetree?.inherit) === 1,
        injectedElementIds: injectedPathIds
          .map(pathId => battleElementsByPathId.get(pathId))
          .filter(Boolean)
          .map(row => Number(row.typetree?.elementConfigId)),
        detachedElementIds: uniqueNumbers(
          (wrapper.typetree?.notDelElementDataList ?? []).map(entry =>
            Number(entry?.m_PathID)
          )
        )
          .map(pathId => battleElementsByPathId.get(pathId))
          .filter(Boolean)
          .map(row => Number(row.typetree?.elementConfigId)),
        sourceIdentity: `${createElementIdentity(wrapper)}|${wrapperContract.sourceIdentity}`,
      },
      removalPaths,
    };
  }
  return {
    sourceKind: 'unresolved',
    durationMs: null,
    leafDurationMs,
    durationSourceIdentity: null,
    wrapper:
      wrapper == null
        ? null
        : {
            elementId: Number(wrapper.typetree?.elementConfigId),
            pathId: Number(wrapper.path_id),
            durationMs: wrapperDurationMs,
            sourceIdentity: createElementIdentity(wrapper),
          },
    removalPaths,
  };
}

function projectUnloadRemovalPaths({
  unloadTriggers,
  closure,
  battleElementsByPathId,
}) {
  return unloadTriggers.flatMap(trigger =>
    (trigger.typetree?.triggerEffectList ?? []).map((effect, effectIndex) => {
      const removerPathId = Number(effect?.targetElement?.m_PathID);
      const remover = battleElementsByPathId.get(removerPathId) ?? null;
      const removedPathIds = uniqueNumbers(
        (remover?.typetree?.elementDataList ?? []).map(entry =>
          Number(entry?.m_PathID)
        )
      ).filter(
        pathId =>
          closure.edges.has(pathId) || battleElementsByPathId.has(pathId)
      );
      return {
        triggerElementId: Number(trigger.typetree?.elementConfigId),
        triggerPathId: Number(trigger.path_id),
        triggerEventId: Number(trigger.typetree?.triggerParam1),
        effectIndex,
        removerElementId: numberOrNull(remover?.typetree?.elementConfigId),
        removerPathId: Number.isInteger(removerPathId) ? removerPathId : null,
        removedElementIds: removedPathIds
          .map(pathId => battleElementsByPathId.get(pathId))
          .filter(Boolean)
          .map(row => Number(row.typetree?.elementConfigId)),
        sourceIdentity: [
          `${createElementIdentity(trigger)}.triggerEffectList[${effectIndex}]`,
          remover ? createElementIdentity(remover) : null,
        ]
          .filter(Boolean)
          .join('|'),
      };
    })
  );
}

function collectPathReferences(value, output = []) {
  if (Array.isArray(value)) {
    value.forEach(entry => collectPathReferences(entry, output));
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  if (Object.hasOwn(value, 'm_PathID')) {
    const pathId = Number(value.m_PathID);
    if (Number.isInteger(pathId) && pathId !== 0) output.push(pathId);
  }
  Object.values(value).forEach(entry => collectPathReferences(entry, output));
  return output;
}

function compileStarValues({ rows, elementId }) {
  return rows
    .filter(row => Number(row.elementId) === Number(elementId))
    .map(row => ({
      star: Number(row.level),
      valueRaw: parseValueParam(row.valueParam).get(1) ?? null,
      sourceIdentity: `NewTable/skillsub_ele_value.rows[id=${row.id},skillId=${row.skillId},level=${row.level},elementId=${row.elementId}]`,
    }))
    .filter(row => Number.isFinite(row.valueRaw))
    .sort((left, right) => left.star - right.star);
}

function parseValueParam(value) {
  return new Map(
    String(value ?? '')
      .split('|')
      .map(part => part.split('#').map(Number))
      .filter(
        ([key, amount]) => Number.isFinite(key) && Number.isFinite(amount)
      )
  );
}

function isDamageElement(tree = {}) {
  return (
    Number.isInteger(Number(tree.damageType)) &&
    (Object.hasOwn(tree, 'formulaId') ||
      Object.hasOwn(tree, 'damageFormulaId') ||
      Object.hasOwn(tree, 'damageType'))
  );
}

function createElementIdentity(row) {
  return `battle-element-assets.jsonl#path_id=${row.path_id};elementId=${row.typetree?.elementConfigId ?? 'unknown'}`;
}

function normalizePath(value, projectRoot) {
  const relative = path.relative(projectRoot, value);
  return (relative.startsWith('..') ? value : relative).replaceAll('\\', '/');
}

function groupBy(rows, selector) {
  const result = new Map();
  for (const row of rows) {
    const key = selector(row);
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(row);
  }
  return result;
}

function countBy(rows, selector) {
  const counts = {};
  for (const row of rows) {
    const key = selector(row) ?? 'unknown';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))
  );
}

function uniqueNumbers(values) {
  return [...new Set(values.filter(Number.isInteger))].sort((a, b) => a - b);
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
