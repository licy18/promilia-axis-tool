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
  36: { name: 'UnloadSkill', frameAnchor: 'loadout-uninstall' },
});

const SUPPORTED_FRAME_ANCHORS = new Set([
  'action-start',
  'action-end',
  'hit-after-damage',
  'element-before-acquire',
  'element-after-acquire',
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
      sourceSnapshotHash: hashCanonicalValue({
        battleElements: battleSource.metadata,
        controlClosure: controlSource.metadata,
        setSkillControlClosure: setSkillControlSource.metadata,
        propertyTagContractHash: propertyTagContract.contractHash,
        triggerContractHash: triggerContract.contractHash,
        tuningMechanicsHash,
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
        definition => definition.thresholdActivation.status === 'source-indexed'
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
      lifecycle: definition.lifecycle,
      resourceTransactions: definition.resourceTransactions,
      vitalChanges: definition.vitalChanges,
      delayedEvents: definition.delayedEvents,
      loopPersistence: definition.loopPersistence,
      evidenceStatus: definition.evidenceStatus,
      runtimeStatus: definition.runtimeStatus,
      runtimeGaps: definition.runtimeGaps,
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
  const runtimeGaps = uniqueStrings([
    ...evidenceGaps,
    'set-skill-runtime-operator-not-implemented',
  ]);
  const value = {
    setId: Number(setSkill.setId),
    pieces: Number(setSkill.pieces),
    skillId: Number(setSkill.skillId),
    thresholdActivation: {
      selectedPieceCountRequired: Number(setSkill.pieces),
      comparison: 'selected-piece-count-greater-than-or-equal',
      status: 'source-indexed',
      appliedToRuntimeEffect: false,
      sourceIdentity: setSkill.sourceIdentity,
    },
    mechanismFamily:
      mechanismFamilies.length === 1
        ? mechanismFamilies[0]
        : 'set-skill-composite-effect',
    mechanismFamilies,
    triggers,
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
        status: 'source-indexed-runtime-unapplied',
      })),
    loopPersistence: {
      status: 'runtime-unapplied',
      reason: 'set-skill-runtime-operator-not-implemented',
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
    },
    evidenceStatus:
      evidenceGaps.length === 0
        ? 'source-closure-indexed'
        : 'static-evidence-gap',
    runtimeStatus: 'source-indexed-runtime-unapplied',
    runtimeGaps,
    sourceIdentity: [setSkill.sourceIdentity, control?.sourceIdentity]
      .filter(Boolean)
      .join('|'),
  };
  return { ...value, mechanicsHash: hashCanonicalValue(value) };
}

function projectTriggerEvidence(row) {
  const tree = row.typetree ?? {};
  const event = TRIGGER_EVENT_BY_ID[Number(tree.triggerParam1)] ?? null;
  return {
    elementId: Number(tree.elementConfigId),
    pathId: Number(row.path_id),
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
  const logicBinding = triggerContract.logicBindings.find(
    binding => Number(binding.value) === Number(conditionLogicValue)
  );
  const compiledConditions = (conditions ?? []).map((condition, index) => {
    const conditionType = Number(condition?.conditionParam1);
    const conditionValue = Number(condition?.conditionParam2);
    const typeBinding = triggerContract.conditionTypeBindings.find(
      binding => Number(binding.value) === conditionType
    );
    const valueBindings =
      typeBinding?.selectorKind === 'skill-slot'
        ? triggerContract.skillSlotBindings
        : typeBinding?.selectorKind === 'skill-tag'
          ? triggerContract.skillTagBindings
          : [];
    const valueBinding = valueBindings.find(
      binding => Number(binding.value) === conditionValue
    );
    const tuningProfiles = resolveTuningConditionProfiles({
      selectorKind: typeBinding?.selectorKind,
      conditionValue,
      tuningMechanicsCatalog,
    });
    const valueApplied =
      valueBinding?.status === 'applied' || tuningProfiles.length > 0;
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
    return base;
  });
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
      if (
        selectorKind === 'held-element-id' ||
        selectorKind === 'event-element-id'
      ) {
        return Number(profile.markId) === conditionValue;
      }
      if (selectorKind === 'target-element-id') {
        return Number(profile.overlimitPacket?.elementId) === conditionValue;
      }
      return (profile.overlimitDamage?.template?.elementTypes ?? []).includes(
        conditionValue
      );
    })
    .map(profile => ({
      profileKey: profile.key,
      markId: Number(profile.markId),
      overlimitPacketElementId: Number(profile.overlimitPacket?.elementId),
      damageElementId: Number(
        profile.overlimitDamage?.template?.elementConfigId
      ),
      elementTypes: uniqueNumbers(
        profile.overlimitDamage?.template?.elementTypes ?? []
      ),
      sourceIdentity: [
        profile.sourceIdentity,
        profile.overlimitPacket?.sourceIdentity,
        profile.overlimitDamage?.template?.elementTypeSourceIdentity,
      ]
        .filter(Boolean)
        .join('|'),
      status: 'applied',
    }))
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
  const damageRows = closure.rows.filter(row => isDamageElement(row.typetree));
  const trigger = activeTriggers.length === 1 ? activeTriggers[0] : null;
  const activationPrerequisiteRows = trigger
    ? closure.rows.filter(row => {
        if (Number(row.path_id) === Number(trigger.path_id)) return false;
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
          reachable => Number(reachable.path_id) === Number(trigger.path_id)
        );
      })
    : [];
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
  const compiledCondition = compileTriggerCondition({
    trigger,
    conditions,
    conditionLogicValue: Number(triggerTree.triggerConditionType),
    triggerContract,
    tuningMechanicsCatalog,
  });
  const triggerEvent = triggerContract.eventBindings.find(
    binding => Number(binding.value) === Number(triggerTree.triggerParam1)
  );
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
  const formulaFamily = resolveFormulaFamily({
    commonFunctionId,
    baseFunctionId,
  });
  const starValues = compileStarValues({
    rows: valueRowsBySkillId.get(effectSkillId) ?? [],
    elementId: Number(propertyTree.elementConfigId),
  });
  const runtimeGaps = [];
  if (!control) runtimeGaps.push('effect-control-source-missing');
  if (missingPathIds.length)
    runtimeGaps.push('effect-resource-reference-missing');
  if (activeTriggers.length !== 1) {
    runtimeGaps.push('effect-active-trigger-not-unique');
  }
  if (!triggerEvent || !SUPPORTED_FRAME_ANCHORS.has(triggerEvent.frameAnchor)) {
    runtimeGaps.push('effect-trigger-event-operator-unsupported');
  }
  if (!triggerTargetBinding) {
    runtimeGaps.push('effect-trigger-source-target-unsupported');
  }
  if (activationPrerequisiteRows.length > 0) {
    runtimeGaps.push('effect-activation-condition-operator-unsupported');
  }
  if (compiledCondition?.status !== 'applied') {
    runtimeGaps.push('effect-skill-tag-condition-operator-unsupported');
  }
  if (reachablePropertyRows.length !== 1) {
    runtimeGaps.push('effect-property-leaf-not-unique');
  }
  if (damageRows.length) runtimeGaps.push('effect-damage-branch-unapplied');
  if (!(Number(lifecycle?.durationMs) > 0)) {
    runtimeGaps.push('effect-property-duration-unresolved');
  }
  if (
    (effectPathRows.length > 1 && wrapperRows.length !== 1) ||
    wrapperRows.length > 1
  ) {
    runtimeGaps.push('effect-wrapper-lifecycle-not-unique');
  }
  if (![3, 4].includes(Number(propertyTree.combineType))) {
    runtimeGaps.push('effect-property-stack-operator-unsupported');
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
  if (triggerEffectRows.length !== 1 || !targetBinding) {
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
    trigger:
      trigger == null
        ? null
        : {
            elementId: Number(triggerTree.elementConfigId),
            pathId: trigger.path_id,
            eventId: Number(triggerTree.triggerParam1),
            event: triggerEvent?.name ?? null,
            frameAnchor: triggerEvent?.frameAnchor ?? null,
            condition: compiledCondition,
            triggerTargetType: numberOrNull(triggerTree.triggerTargetType),
            triggerTargetTypeSourceIdentity: `${createElementIdentity(trigger)}.triggerTargetType`,
            triggerTarget:
              triggerTargetBinding == null
                ? null
                : {
                    kind: triggerTargetBinding.sourceKind,
                    triggerTargetType: Number(triggerTargetBinding.value),
                    triggerTargetTypeName: triggerTargetBinding.enumName,
                    sourceIdentity: `${createElementIdentity(trigger)}.triggerTargetType|${triggerTargetBinding.sourceIdentity}`,
                  },
            target:
              targetBinding == null
                ? null
                : {
                    kind: targetBinding.targetKind,
                    effectTargetType: Number(targetBinding.value),
                    effectTargetTypeName: targetBinding.enumName,
                    effectListIndex: triggerEffectRows[0].effectListIndex,
                    targetElementPathId: Number(
                      triggerEffectRows[0]?.effectRow?.targetElement?.m_PathID
                    ),
                    sourceIdentity: `${createElementIdentity(trigger)}.triggerEffectList[${triggerEffectRows[0].effectListIndex}].targetType|${targetBinding.sourceIdentity}`,
                  },
            targetKind: targetBinding?.targetKind ?? 'unresolved',
            sourceIdentity: createElementIdentity(trigger),
          },
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
              Number(propertyTree.combineType) === 4 ? 'stack' : 'refresh',
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
    bySkillId.set(skillId, {
      sourceIdentity:
        root?.sourceIdentity ?? normalizePath(monoRoot, projectRoot),
      resourcePathIds,
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
