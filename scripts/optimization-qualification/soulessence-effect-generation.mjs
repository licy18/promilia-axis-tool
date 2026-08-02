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
  36: { name: 'UnloadSkill', frameAnchor: 'loadout-uninstall' },
});

const SUPPORTED_FRAME_ANCHORS = new Set([
  'action-start',
  'action-end',
  'hit-after-damage',
]);

const ACTION_KINDS_BY_SKILL_TAG = Object.freeze({
  1: ['normal-attack'],
  2: ['charged-attack'],
  3: ['star-skill'],
  4: ['ultimate'],
  6: ['dodge-attack'],
  7: ['plunging-attack'],
  9: ['plunging-attack'],
  11: ['limit-counter'],
  12: ['perfect-parry'],
  17: ['star-combo'],
});

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
} = {}) {
  const definitionBySoulId = new Map(
    (soulDefinitionRows ?? []).map(row => [Number(row.id), row])
  );
  const logicBySkillId = new Map(
    (skillLogicRows ?? []).map(row => [Number(row.skillId), row])
  );
  const valueRowsBySkillId = groupBy(
    skillElementValueRows ?? [],
    row => Number(row.skillId)
  );
  const publicSouls = (soulEssences ?? []).map(item => ({
    soulEssenceId: Number(item.id ?? item.soulEssenceId),
    name: item.name ?? null,
  }));
  const effectSkillIds = publicSouls.map(item =>
    Number(definitionBySoulId.get(item.soulEssenceId)?.reishiSkill)
  );
  if (effectSkillIds.some(skillId => !Number.isInteger(skillId) || skillId <= 0)) {
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
      sourceSnapshotHash: hashCanonicalValue({
        battleElements: battleSource.metadata,
        controlClosure: controlSource.metadata,
        setSkillControlClosure: setSkillControlSource.metadata,
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
    definitions,
    setSkillDefinitions,
    unresolved,
    summary: {
      soulEssenceCount: definitions.length,
      controlClosureCount: controlSource.bySkillId.size,
      resourceReferenceCount: definitions.reduce(
        (total, definition) => total + definition.sourceClosure.resourcePathIds.length,
        0
      ),
      missingResourceReferenceCount: definitions.reduce(
        (total, definition) => total + definition.sourceClosure.missingPathIds.length,
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
      },
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
    policy: {
      thresholdActivationIsNotRuntimeApplication: true,
      descriptionsAreDiscoveryOnly: true,
      unsupportedEffectsRemainBlocking: true,
    },
    records,
    summary: {
      soulEssenceCount: records.filter(row => row.objectKind === 'soul-essence')
        .length,
      setSkillCount: records.filter(row => row.objectKind === 'set-skill').length,
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
  if (missingPathIds.length) evidenceGaps.push('set-skill-resource-reference-missing');
  if (closure.rows.length === 0) evidenceGaps.push('set-skill-element-closure-empty');
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
      .filter(row =>
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
      elementIds: closure.rows.map(row => Number(row.typetree?.elementConfigId)),
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
    conditions: projectConditions(tree.triggerConditionList),
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
    bucket: PROPERTY_BUCKET_BY_CALCULATE_TYPE[Number(tree.calculateType)] ?? null,
    calculateType: numberOrNull(tree.calculateType),
    durationMs: numberOrNull(tree.time),
    combineType: numberOrNull(tree.combineType),
    combineNumber: numberOrNull(tree.combineNumber),
    executeTargetType: numberOrNull(tree.executeTargetType),
    inheritType: numberOrNull(tree.inheritType),
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
        stackMode: effect.stackMode,
        stackDelta: effect.stackDelta,
        maxStacks: effect.maxStacks,
      };
}

function compileSoulEffectDefinition({
  soul,
  sourceDefinition,
  logicBySkillId,
  valueRowsBySkillId,
  battleElementsByPathId,
  control,
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
  const propertyRows = closure.rows.filter(row =>
    Number.isInteger(Number(row.typetree?.attributeID)) &&
    Number.isInteger(Number(row.typetree?.calculateType))
  );
  const damageRows = closure.rows.filter(row =>
    isDamageElement(row.typetree)
  );
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
        ).some(reachable => Number(reachable.path_id) === Number(trigger.path_id));
      })
    : [];
  const reachablePropertyRows = trigger
    ? collectReachableRows(trigger.path_id, closure.edges, battleElementsByPathId)
        .filter(row => propertyRows.some(property => property.path_id === row.path_id))
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
  const conditions = Array.isArray(triggerTree.triggerConditionList)
    ? triggerTree.triggerConditionList
    : [];
  const skillTagCondition =
    conditions.length === 1 && Number(conditions[0]?.conditionParam1) === 11
      ? conditions[0]
      : null;
  const triggerEvent = TRIGGER_EVENT_BY_ID[Number(triggerTree.triggerParam1)];
  const actionKinds = ACTION_KINDS_BY_SKILL_TAG[
    Number(skillTagCondition?.conditionParam2)
  ];
  const starValues = compileStarValues({
    rows: valueRowsBySkillId.get(effectSkillId) ?? [],
    elementId: Number(propertyTree.elementConfigId),
  });
  const runtimeGaps = [];
  if (!control) runtimeGaps.push('effect-control-source-missing');
  if (missingPathIds.length) runtimeGaps.push('effect-resource-reference-missing');
  if (activeTriggers.length !== 1) {
    runtimeGaps.push('effect-active-trigger-not-unique');
  }
  if (!triggerEvent || !SUPPORTED_FRAME_ANCHORS.has(triggerEvent.frameAnchor)) {
    runtimeGaps.push('effect-trigger-event-operator-unsupported');
  }
  if (activationPrerequisiteRows.length > 0) {
    runtimeGaps.push('effect-activation-condition-operator-unsupported');
  }
  if (!skillTagCondition || !actionKinds?.length) {
    runtimeGaps.push('effect-skill-tag-condition-operator-unsupported');
  }
  if (reachablePropertyRows.length !== 1) {
    runtimeGaps.push('effect-property-leaf-not-unique');
  }
  if (damageRows.length) runtimeGaps.push('effect-damage-branch-unapplied');
  if (!(Number(propertyTree.time) > 0)) {
    runtimeGaps.push('effect-property-duration-unresolved');
  }
  if (![3, 4].includes(Number(propertyTree.combineType))) {
    runtimeGaps.push('effect-property-stack-operator-unsupported');
  }
  if (!PROPERTY_BUCKET_BY_CALCULATE_TYPE[Number(propertyTree.calculateType)]) {
    runtimeGaps.push('effect-property-bucket-unsupported');
  }
  if (
    commonFunctionId !== 1 ||
    baseFunctionId !== 5 ||
    commonRatioRaw !== 10_000
  ) {
    runtimeGaps.push('effect-formula-family-operator-unsupported');
  }
  if (starValues.length !== 4) runtimeGaps.push('effect-star-values-incomplete');
  if (Number(triggerTree.triggerTargetType) !== 0) {
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
          skillLogicType: Number(logicBySkillId.get(effectSkillId).skillLogicType),
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
            condition:
              skillTagCondition == null
                ? null
                : {
                    kind: 'skill-tag',
                    conditionType: 11,
                    skillTagId: Number(skillTagCondition.conditionParam2),
                    actionKinds: actionKinds ?? [],
                  },
            targetKind: Number(triggerTree.triggerTargetType) === 0 ? 'self-actor' : 'unresolved',
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
            bucket: PROPERTY_BUCKET_BY_CALCULATE_TYPE[
              Number(propertyTree.calculateType)
            ] ?? null,
            calculateType: Number(propertyTree.calculateType),
            formula: {
              commonFunctionId,
              baseFunctionId,
              commonRatioRaw,
              family:
                commonFunctionId === 1 && baseFunctionId === 5
                  ? 'literal-a-with-common-ratio'
                  : `unsupported-${commonFunctionId || 0}-${baseFunctionId || 0}`,
            },
            durationMs: Number(propertyTree.time),
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
      names = (await fs.readdir(monoRoot)).filter(name => name.endsWith('.json'));
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
    const root = documents.find(document =>
      Number(document.value?.skillControlData?.skillId) === Number(skillId)
    );
    const resourcePathIds = uniqueNumbers(
      (root?.value?.skillResourceMaps ?? []).flatMap(resourceMap =>
        (resourceMap.elements ?? []).map(reference => Number(reference.m_PathID))
      )
    );
    bySkillId.set(skillId, {
      sourceIdentity: root?.sourceIdentity ?? normalizePath(monoRoot, projectRoot),
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
    rows: rows.sort((left, right) => Number(left.path_id) - Number(right.path_id)),
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
      .filter(([key, amount]) => Number.isFinite(key) && Number.isFinite(amount))
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
