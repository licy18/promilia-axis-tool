import crypto from 'node:crypto';

export const CHARACTER_COMBAT_COMPILER_VERSION = 5;
const TARGET_STATE_CONDITIONAL_COMMON_FUNCTION_ID = 101100;
const SELF_STATE_CONDITIONAL_COMMON_FUNCTION_ID = 102100;
const ELEMENT_LAYER_CONDITIONAL_FORMULA_FAMILIES = new Map([
  [
    TARGET_STATE_CONDITIONAL_COMMON_FUNCTION_ID,
    {
      subjectKind: 'target',
      expression: 'IF(target.ELEMENT_LAYERS[M]>I,T,F)',
    },
  ],
  [
    SELF_STATE_CONDITIONAL_COMMON_FUNCTION_ID,
    {
      subjectKind: 'self',
      expression: 'IF(self.ELEMENT_LAYERS[M]>I,T,F)',
    },
  ],
]);

export function compileCharacterCombatRecipeContracts({
  recipe,
  character,
  evidence,
  operators,
}) {
  const ownerId = Number(recipe?.ownerId);
  if (!Number.isInteger(ownerId) || ownerId <= 0) {
    throw new Error('character combat recipe owner is invalid');
  }
  if (Number(character?.id) !== ownerId) {
    throw new Error(
      `character combat recipe owner mismatch: ${ownerId}/${character?.id}`
    );
  }
  const compilerRecipe = recipe?.compiler;
  if (!compilerRecipe || typeof compilerRecipe !== 'object') {
    throw new Error(`character combat compiler recipe missing: ${ownerId}`);
  }
  const normalizedOperators = normalizeOperators(operators);
  const controls = [...(evidence?.controls ?? [])];
  const controlBySkillId = new Map(
    controls.map(control => [Number(control.controlSkillId), control])
  );
  const resourceProfiles = (evidence?.specialResourceProfiles ?? []).filter(
    profile => Number(profile.ownerId) === ownerId
  );
  const resourceOperations = (evidence?.specialResourceOperations ?? []).filter(
    operation => Number(operation.ownerId) === ownerId
  );
  const managesResourceContracts = Array.isArray(
    compilerRecipe.specialResources
  );
  const specialResourceContracts = compileSpecialResourceContracts({
    ownerId,
    definitions: compilerRecipe.specialResources ?? [],
    resourceProfiles,
    resourceOperations,
    operators: normalizedOperators,
  });
  const managedResourceElementIds = new Set(
    (compilerRecipe.specialResources ?? []).map(definition =>
      Number(definition.resourceElementId)
    )
  );
  const compiledResourceProfiles = [
    ...resourceProfiles.filter(
      profile => !managedResourceElementIds.has(Number(profile.elementId))
    ),
    ...specialResourceContracts.profiles,
  ];
  const compiledResourceOperations = [
    ...resourceOperations.filter(operation => {
      const profile = resourceProfiles.find(
        item => item.resourceIdentity === operation.resourceIdentity
      );
      return !managedResourceElementIds.has(Number(profile?.elementId));
    }),
    ...specialResourceContracts.operations,
  ];
  const contextEdges = compileContextInputEdges({
    ownerId,
    definitions: compilerRecipe.contextInputEdges ?? [],
    controlBySkillId,
    resourceProfiles: compiledResourceProfiles,
    operators: normalizedOperators,
  });
  const publicActionForms = compilePublicActionForms({
    ownerId,
    definitions: compilerRecipe.publicActionForms ?? [],
    controlBySkillId,
    resourceProfiles: compiledResourceProfiles,
    contextEdges,
    operators: normalizedOperators,
  });
  const attackInputChains = compileAttackInputChains({
    ownerId,
    definitions: compilerRecipe.attackInputChains ?? [],
    controlBySkillId,
    resourceProfiles: compiledResourceProfiles,
    operators: normalizedOperators,
  });
  const inputVariantSelectors = compileInputVariantSelectors({
    ownerId,
    definitions: compilerRecipe.inputVariantSelectors ?? [],
    controlBySkillId,
    operators: normalizedOperators,
  });
  const controlTransitionWindows = compileControlTransitionWindows({
    ownerId,
    reachableControlSkillIds: compilerRecipe.reachableControlSkillIds ?? [],
    controlBySkillId,
    operators: normalizedOperators,
  });
  const variantWindowBindings = compileVariantWindowBindings({
    ownerId,
    definitions: compilerRecipe.variantWindowBindings ?? [],
    controlBySkillId,
    resourceProfiles: compiledResourceProfiles,
    operators: normalizedOperators,
  });
  const targetStateProfiles = compileTargetStateProfiles({
    ownerId,
    definitions: compilerRecipe.targetStateProfiles ?? [],
    operators: normalizedOperators,
  });
  const targetStateTransactions = compileTargetStateTransactions({
    ownerId,
    definitions: compilerRecipe.targetStateTransactions ?? [],
    controlBySkillId,
    targetStateProfiles,
    tuningMarkProfiles: evidence?.tuningMarkProfiles ?? [],
    operators: normalizedOperators,
  });
  const conditionalHitGroups = compileConditionalHitGroups({
    ownerId,
    definitions: compilerRecipe.conditionalHitGroups ?? [],
    controlBySkillId,
    targetStateProfiles,
    tuningMarkProfiles: evidence?.tuningMarkProfiles ?? [],
    operators: normalizedOperators,
  });
  const tuningMarkConditionalDamageGroups =
    compileTuningMarkConditionalDamageGroups({
      ownerId,
      definitions: compilerRecipe.tuningMarkConditionalDamageGroups ?? [],
      controlBySkillId,
      tuningMarkProfiles: evidence?.tuningMarkProfiles ?? [],
      operators: normalizedOperators,
    });
  const actionHitBindings = compileActionHitBindings({
    ownerId,
    definitions: [
      ...(compilerRecipe.actionHitBindings ?? []),
      ...conditionalHitGroups.map(createConditionalGroupHitBinding),
    ],
    controlBySkillId,
  });
  const actionEffectBindings = compileActionEffectBindings({
    ownerId,
    definitions: compilerRecipe.actionEffectBindings ?? [],
    controlBySkillId,
    resourceProfiles: compiledResourceProfiles,
    targetStateProfiles,
    tuningMarkProfiles: evidence?.tuningMarkProfiles ?? [],
    actionHitBindings,
    operators: normalizedOperators,
  });
  validateActionEffectHitGates({
    ownerId,
    actionEffectBindings,
    tuningMarkConditionalDamageGroups,
  });
  const runtimeEffectBindings = compileRuntimeEffectBindings({
    ownerId,
    definitions: compilerRecipe.runtimeEffectBindings ?? [],
    controlBySkillId,
    conditionalHitGroups,
    targetStateProfiles,
    operators: normalizedOperators,
  });
  const thresholdTransitions = compileThresholdTransitions({
    ownerId,
    definitions: compilerRecipe.thresholdTransitions ?? [],
    resourceProfiles: compiledResourceProfiles,
    resourceOperations: compiledResourceOperations,
    tuningMarkProfiles: evidence?.tuningMarkProfiles ?? [],
    controlBySkillId,
    operators: normalizedOperators,
  });
  const passiveEffects = compilePassiveEffects({
    ownerId,
    definitions: compilerRecipe.passiveEffects ?? [],
    controls,
    controlBySkillId,
    skills: evidence?.skills ?? [],
    targetStateTransactions,
    runtimeEffectBindings,
    tuningMarkProfiles: evidence?.tuningMarkProfiles ?? [],
    operators: normalizedOperators,
  });
  const contracts = {
    contextEdges,
    publicActionForms,
    attackInputChains,
    inputVariantSelectors,
    controlTransitionWindows,
    variantWindowBindings,
    actionEffectBindings,
    actionHitBindings,
    targetStateProfiles,
    targetStateTransactions,
    conditionalHitGroups,
    tuningMarkConditionalDamageGroups,
    runtimeEffectBindings,
    resourceProfiles: specialResourceContracts.profiles,
    resourceTransactions: specialResourceContracts.operations,
    thresholdTransitions,
    passiveEffects,
  };
  const compilerInput = {
    ownerId,
    characterIdentity:
      character.sourceIdentity ?? `character-catalog:actor:${ownerId}`,
    recipe: compilerRecipe,
    evidenceIdentities: collectSourceIdentities([
      controls,
      resourceProfiles,
      resourceOperations,
    ]),
  };
  return {
    schemaVersion: 1,
    kind: 'azpr-character-combat-owner-compilation',
    compilerVersion: CHARACTER_COMBAT_COMPILER_VERSION,
    ownerId,
    ownerName: character.name ?? null,
    recipeIdentity: `actor:${ownerId}:character-combat-recipe:v${
      Number(recipe.schemaVersion) || 1
    }`,
    recipeHash: sha256Json(recipe),
    compilerInputHash: sha256Json(compilerInput),
    timingPolicy: compilerRecipe.timingPolicy ?? 'standalone-animation',
    managesResourceContracts,
    reachableControlSkillIds: [
      ...new Set(
        (compilerRecipe.reachableControlSkillIds ?? [])
          .map(Number)
          .filter(Number.isInteger)
      ),
    ].sort((left, right) => left - right),
    contracts,
    contractHash: sha256Json(contracts),
    status: 'character-combat-owner-contracts-compiled',
    summary: {
      contextEdgeCount: contracts.contextEdges.length,
      publicActionFormCount: contracts.publicActionForms.length,
      attackInputChainCount: contracts.attackInputChains.length,
      inputVariantSelectorCount: contracts.inputVariantSelectors.length,
      controlTransitionWindowCount: contracts.controlTransitionWindows.length,
      variantWindowBindingCount: contracts.variantWindowBindings.length,
      actionEffectBindingCount: contracts.actionEffectBindings.length,
      actionHitBindingCount: contracts.actionHitBindings.length,
      targetStateProfileCount: contracts.targetStateProfiles.length,
      targetStateTransactionCount: contracts.targetStateTransactions.length,
      conditionalHitGroupCount: contracts.conditionalHitGroups.length,
      tuningMarkConditionalDamageGroupCount:
        contracts.tuningMarkConditionalDamageGroups.length,
      runtimeEffectBindingCount: contracts.runtimeEffectBindings.length,
      resourceProfileCount: contracts.resourceProfiles.length,
      resourceTransactionCount: contracts.resourceTransactions.length,
      appliedResourceTransactionCount: contracts.resourceTransactions.filter(
        item => item.applied
      ).length,
      notApplicableResourceTransactionCount:
        contracts.resourceTransactions.filter(
          item => item.status === 'not-applicable'
        ).length,
      thresholdTransitionCount: contracts.thresholdTransitions.length,
      passiveEffectCount: contracts.passiveEffects.length,
    },
  };
}

export function mergeCharacterCombatOwnerCompilations({
  actionVariantGraph,
  specialResourceCatalog,
  compilations,
}) {
  const ownerIds = new Set(compilations.map(item => Number(item.ownerId)));
  const replaceOwnerRecords = (records, additions) => [
    ...(records ?? []).filter(record => !ownerIds.has(Number(record.ownerId))),
    ...additions,
  ];
  const contextEdges = replaceOwnerRecords(
    actionVariantGraph.contextEdges,
    compilations.flatMap(item => item.contracts.contextEdges)
  );
  const publicActionForms = replaceOwnerRecords(
    actionVariantGraph.publicActionForms,
    compilations.flatMap(item => item.contracts.publicActionForms)
  );
  const attackInputChains = replaceOwnerRecords(
    actionVariantGraph.attackInputChains,
    compilations.flatMap(item => item.contracts.attackInputChains)
  );
  const inputVariantSelectors = compilations.flatMap(
    item => item.contracts.inputVariantSelectors ?? []
  );
  const variantWindowBindings = compilations.flatMap(
    item => item.contracts.variantWindowBindings
  );
  const actionEffectBindings = compilations.flatMap(
    item => item.contracts.actionEffectBindings
  );
  const actionHitBindings = compilations.flatMap(
    item => item.contracts.actionHitBindings ?? []
  );
  const targetStateProfiles = replaceOwnerRecords(
    actionVariantGraph.targetStateProfiles,
    compilations.flatMap(item => item.contracts.targetStateProfiles ?? [])
  );
  const targetStateTransactions = replaceOwnerRecords(
    actionVariantGraph.targetStateTransactions,
    compilations.flatMap(item => item.contracts.targetStateTransactions ?? [])
  );
  const conditionalHitGroups = replaceOwnerRecords(
    actionVariantGraph.conditionalHitGroups,
    compilations.flatMap(item => item.contracts.conditionalHitGroups ?? [])
  );
  const tuningMarkConditionalDamageGroups = replaceOwnerRecords(
    actionVariantGraph.tuningMarkConditionalDamageGroups,
    compilations.flatMap(
      item => item.contracts.tuningMarkConditionalDamageGroups ?? []
    )
  );
  const runtimeEffectBindings = replaceOwnerRecords(
    actionVariantGraph.runtimeEffectBindings,
    compilations.flatMap(item => item.contracts.runtimeEffectBindings ?? [])
  );
  const thresholdTransitions = replaceOwnerRecords(
    specialResourceCatalog.thresholdTransitions,
    compilations.flatMap(item => item.contracts.thresholdTransitions)
  );
  const passiveEffects = replaceOwnerRecords(
    specialResourceCatalog.passiveEffects,
    compilations.flatMap(item => item.contracts.passiveEffects)
  );
  const resourceOwnerIds = new Set(
    compilations
      .filter(item => item.managesResourceContracts)
      .map(item => Number(item.ownerId))
  );
  const replaceResourceOwnerRecords = (records, additions) => [
    ...(records ?? []).filter(
      record => !resourceOwnerIds.has(Number(record.ownerId))
    ),
    ...additions,
  ];
  const resourceProfiles = replaceResourceOwnerRecords(
    specialResourceCatalog.profiles,
    compilations
      .filter(item => item.managesResourceContracts)
      .flatMap(item => item.contracts.resourceProfiles)
  );
  const resourceTransactions = replaceResourceOwnerRecords(
    specialResourceCatalog.operationBindings,
    compilations
      .filter(item => item.managesResourceContracts)
      .flatMap(item => item.contracts.resourceTransactions)
  );

  actionVariantGraph.contextEdges = contextEdges;
  actionVariantGraph.publicActionForms = publicActionForms;
  actionVariantGraph.attackInputChains = attackInputChains;
  actionVariantGraph.targetStateProfiles = targetStateProfiles;
  actionVariantGraph.targetStateTransactions = targetStateTransactions;
  actionVariantGraph.conditionalHitGroups = conditionalHitGroups;
  actionVariantGraph.tuningMarkConditionalDamageGroups =
    tuningMarkConditionalDamageGroups;
  actionVariantGraph.runtimeEffectBindings = runtimeEffectBindings;
  actionVariantGraph.derivedControlContracts =
    applyCompiledInputVariantSelectors({
      contracts: actionVariantGraph.derivedControlContracts ?? [],
      bindings: inputVariantSelectors,
    });
  actionVariantGraph.edges = applyVariantWindowBindings({
    edges: actionVariantGraph.edges ?? [],
    bindings: variantWindowBindings,
  });
  actionVariantGraph.summary = {
    ...(actionVariantGraph.summary ?? {}),
    contextEdgeCount: contextEdges.length,
    appliedContextEdgeCount: contextEdges.filter(edge => edge.applied).length,
    publicActionFormCount: publicActionForms.length,
    attackInputChainCount: attackInputChains.length,
    compiledInputVariantSelectorCount: inputVariantSelectors.length,
    appliedEdgeCount: actionVariantGraph.edges.filter(edge => edge.applied)
      .length,
    compiledVariantWindowBindingCount: variantWindowBindings.length,
    targetStateProfileCount: targetStateProfiles.length,
    targetStateTransactionCount: targetStateTransactions.length,
    conditionalHitGroupCount: conditionalHitGroups.length,
    tuningMarkConditionalDamageGroupCount:
      tuningMarkConditionalDamageGroups.length,
    runtimeEffectBindingCount: runtimeEffectBindings.length,
  };
  specialResourceCatalog.thresholdTransitions = thresholdTransitions;
  specialResourceCatalog.passiveEffects = passiveEffects;
  specialResourceCatalog.profiles = resourceProfiles;
  specialResourceCatalog.operationBindings = resourceTransactions;
  specialResourceCatalog.summary = {
    ...(specialResourceCatalog.summary ?? {}),
    profileCount: resourceProfiles.length,
    appliedProfileCount: resourceProfiles.filter(item => item.applied).length,
    operationCount: resourceTransactions.length,
    appliedOperationCount: resourceTransactions.filter(item => item.applied)
      .length,
    notApplicableOperationCount: resourceTransactions.filter(
      item => item.status === 'not-applicable'
    ).length,
    unresolvedOperationCount: resourceTransactions.filter(
      item => !item.applied && item.status !== 'not-applicable'
    ).length,
    thresholdTransitionCount: thresholdTransitions.length,
    passiveEffectCount: passiveEffects.length,
    appliedPassiveEffectCount: passiveEffects.filter(item => item.applied)
      .length,
  };

  return {
    actionVariantGraph,
    specialResourceCatalog,
    compilations,
    actionEffectBindings,
    actionHitBindings,
    targetStateProfiles,
    targetStateTransactions,
    conditionalHitGroups,
    tuningMarkConditionalDamageGroups,
    runtimeEffectBindings,
  };
}

export function applyCharacterCombatActionHitBindings({
  controls,
  compilations,
}) {
  const bindings = (compilations ?? []).flatMap(
    compilation => compilation.contracts.actionHitBindings ?? []
  );
  for (const binding of bindings) {
    const control = (controls ?? []).find(
      item => Number(item.controlSkillId) === Number(binding.controlSkillId)
    );
    if (!control) {
      throw new Error(
        `character combat action hit control missing: ${binding.ownerId}/${binding.controlSkillId}`
      );
    }
    const sourceControl = (controls ?? []).find(
      item =>
        Number(item.controlSkillId) ===
        Number(binding.sourceControlSkillId ?? binding.controlSkillId)
    );
    if (!sourceControl) {
      throw new Error(
        `character combat action hit source control missing: ${binding.ownerId}/${binding.sourceControlSkillId}`
      );
    }
    const sourceIndexes = (sourceControl.elements ?? [])
      .map((element, index) => ({ element, index }))
      .filter(
        ({ element }) =>
          Number(element.mapIndex) ===
            Number(binding.sourceSubSkillIndex ?? binding.subSkillIndex) &&
          Number(element.elementId) === Number(binding.elementId) &&
          (!binding.sourceReferenceKind ||
            element.referenceKind === binding.sourceReferenceKind)
      );
    if (sourceIndexes.length !== 1) {
      throw new Error(
        `character combat action hit source match mismatch: ${binding.ownerId}/${binding.sourceControlSkillId}/${binding.sourceSubSkillIndex}/${binding.elementId} received ${sourceIndexes.length}`
      );
    }
    const sourceElement = sourceIndexes[0].element;
    const targetIndexes = (control.elements ?? [])
      .map((element, index) => ({ element, index }))
      .filter(
        ({ element }) =>
          Number(element.mapIndex) === Number(binding.subSkillIndex) &&
          Number(element.elementId) === Number(binding.elementId) &&
          (!binding.targetReferenceKind ||
            element.referenceKind === binding.targetReferenceKind)
      );
    if (targetIndexes.length > 1) {
      throw new Error(
        `character combat action hit target match mismatch: ${binding.ownerId}/${binding.controlSkillId}/${binding.subSkillIndex}/${binding.elementId} received ${targetIndexes.length}`
      );
    }
    const index =
      targetIndexes[0]?.index ??
      (control.elements ?? (control.elements = [])).push({
        ...sourceElement,
        mapIndex: Number(binding.subSkillIndex),
        triggers: [],
        projectedFromControlSkillId: Number(
          binding.sourceControlSkillId ?? binding.controlSkillId
        ),
        projectedFromSubSkillIndex: Number(
          binding.sourceSubSkillIndex ?? binding.subSkillIndex
        ),
      }) - 1;
    const element = control.elements[index];
    const normalizedElement = binding.formulaNormalization?.applied
      ? normalizeConditionalHitElement({
          element,
          formulaNormalization: binding.formulaNormalization,
        })
      : element;
    const existingTriggers = normalizedElement.triggers ?? [];
    const boundTriggers = binding.triggerFrames.map((startFrame, hitIndex) => ({
      behaviorPathId: `character-combat:${binding.bindingIdentity}:${hitIndex + 1}`,
      startFrame,
      frameCount: binding.frameCount,
      behaviorIndex: null,
      timelineGroupIndex: 0,
      targetCode: binding.targetCode,
      targetKind: binding.targetKind,
      targetSourceField: 'character-combat-verified-hit-binding',
      sourceIdentity: binding.sourceIdentity,
      conditionalGroupIdentity: binding.conditionalGroupIdentity ?? null,
      runtimeCondition: binding.runtimeCondition ?? null,
      sourceBindingIdentity: binding.bindingIdentity,
      hitActivation: binding.hitActivation ?? null,
    }));
    control.elements[index] = {
      ...normalizedElement,
      triggers: dedupeBy(
        [...existingTriggers, ...boundTriggers],
        trigger => `${trigger.behaviorPathId}|${trigger.startFrame}`
      ).sort(
        (left, right) =>
          Number(left.startFrame) - Number(right.startFrame) ||
          String(left.behaviorPathId).localeCompare(
            String(right.behaviorPathId)
          )
      ),
      classification: 'applied',
      scenarioClassification: 'applied',
      status: 'verified-action-hit-binding-applied',
      confidence: 'high',
      issues: (normalizedElement.issues ?? []).filter(
        reason =>
          reason !== 'trigger-frame-missing' &&
          reason !== 'common-function-unverified'
      ),
      applied: true,
      projectedFromControlSkillId: Number(
        binding.sourceControlSkillId ?? binding.controlSkillId
      ),
      projectedFromSubSkillIndex: Number(
        binding.sourceSubSkillIndex ?? binding.subSkillIndex
      ),
      sourceIdentity: [element.sourceIdentity, binding.sourceIdentity]
        .filter(Boolean)
        .join('|'),
    };
  }
  return controls;
}

function normalizeConditionalHitElement({ element, formulaNormalization }) {
  const damageType = Number(element.damage?.damageType);
  const weakBreakDamageRate = Number(
    element.damage?.weakBreakDamageRateBasisPoints
  );
  return {
    ...element,
    formula: {
      ...element.formula,
      commonFunctionId: formulaNormalization.normalizedCommonFunctionId,
      commonExpression: '1',
      conditionalNormalization: formulaNormalization,
    },
    dimensions: {
      ...element.dimensions,
      hp:
        damageType === 8
          ? {
              status: 'verified-zero',
              reasons: ['pure-weakness-damage-type'],
              sourceField: 'damageType',
            }
          : {
              status: 'applied',
              reasons: [],
              sourceField: 'formulaParams',
            },
      toughness:
        weakBreakDamageRate === 0
          ? {
              status: 'verified-zero',
              reasons: ['weak-break-damage-rate-explicit-zero'],
              sourceField: 'weakBreakDamageRate',
            }
          : {
              status: 'applied',
              reasons: [],
              sourceField: 'weakBreakDamageRate',
            },
    },
  };
}

export function applyCharacterCombatActionEffectBindings({
  controls,
  compilations,
}) {
  const bindings = (compilations ?? []).flatMap(
    compilation => compilation.contracts.actionEffectBindings ?? []
  );
  for (const binding of bindings) {
    const control = (controls ?? []).find(
      item => Number(item.controlSkillId) === Number(binding.controlSkillId)
    );
    if (!control) {
      throw new Error(
        `character combat action effect control missing: ${binding.ownerId}/${binding.controlSkillId}`
      );
    }
    const elementMatches = (control.effects ?? []).filter(
      effect =>
        Number(effect.mapIndex) === Number(binding.mapIndex) &&
        Number(effect.elementId) === Number(binding.elementId) &&
        (!binding.sourceReferenceKind ||
          effect.sourceOrder?.referenceKind === binding.sourceReferenceKind)
    );
    const triggerMatches = elementMatches.filter(
      effect =>
        Number(effect.trigger?.startFrame) === Number(binding.triggerFrame)
    );
    const matches =
      triggerMatches.length === 1
        ? triggerMatches
        : elementMatches.length === 1
          ? elementMatches
          : triggerMatches;
    if (matches.length !== 1) {
      throw new Error(
        `character combat action effect match mismatch: ${binding.ownerId}/${binding.controlSkillId}/${binding.mapIndex}/${binding.elementId} received ${matches.length}`
      );
    }
    const matchedEffect = matches[0];
    const activationDescendants =
      binding.activationConditionScope === 'matched-effect-subtree'
        ? (control.effects ?? []).filter(
            effect =>
              effect !== matchedEffect &&
              effect.graphIdentity === matchedEffect.graphIdentity &&
              Number(effect.depth) >= Number(matchedEffect.depth)
          )
        : [];
    control.effects = control.effects.map(effect => {
      if (effect === matchedEffect) {
        return applyActionEffectBinding(effect, binding);
      }
      if (activationDescendants.includes(effect)) {
        return applyActionEffectActivationBinding(effect, binding);
      }
      return effect;
    });
  }
  return controls;
}

export function applyCharacterCombatResourceOperationBindings({
  controls,
  compilations,
}) {
  const operations = (compilations ?? [])
    .flatMap(compilation => compilation.contracts.resourceTransactions ?? [])
    .filter(
      operation =>
        operation.applied === true &&
        operation.operation === 'transform-remove' &&
        Number.isInteger(Number(operation.sourceElementId)) &&
        Number.isInteger(Number(operation.stateElementId))
    );
  for (const operation of operations) {
    const control = (controls ?? []).find(
      item => Number(item.controlSkillId) === Number(operation.controlSkillId)
    );
    if (!control) {
      throw new Error(
        `character combat resource operation control missing: ${operation.ownerId}/${operation.controlSkillId}`
      );
    }
    const candidates = (control.effects ?? []).filter(
      effect =>
        Number(effect.mapIndex) === Number(operation.subSkillIndex) &&
        Number(effect.rootElementId) === Number(operation.sourceElementId) &&
        Number(effect.trigger?.startFrame) === Number(operation.triggerFrame)
    );
    const removedStatePathIds = new Set(
      candidates
        .filter(
          effect =>
            Number(effect.elementId) === Number(operation.stateElementId)
        )
        .map(effect => String(effect.pathId))
    );
    if (removedStatePathIds.size === 0) continue;
    control.effects = (control.effects ?? []).map(effect => {
      if (!candidates.includes(effect)) return effect;
      const isRemovedState = removedStatePathIds.has(String(effect.pathId));
      const isRemovedStateDescendant = (effect.relationPath ?? []).some(edge =>
        [...removedStatePathIds].some(
          pathId => edge.from === `element:${pathId}`
        )
      );
      if (!isRemovedState && !isRemovedStateDescendant) return effect;
      return {
        ...effect,
        classification: 'not-applicable',
        scenarioClassification: 'not-applicable',
        status: 'not-applicable',
        confidence: 'high',
        applied: false,
        reasons: [
          ...new Set([
            ...(effect.reasons ?? []),
            'source-driven-transform-remove-handles-state-subtree',
          ]),
        ],
        sourceDrivenResourceOperation: {
          operationIdentity: operation.operationIdentity,
          operation: operation.operation,
          sourceElementId: Number(operation.sourceElementId),
          stateElementId: Number(operation.stateElementId),
          sourceIdentity: operation.sourceIdentity,
        },
      };
    });
  }
  return controls;
}

export function applyCharacterCombatAttackInputPhaseMappings({
  mechanicsPackage,
  compilations,
}) {
  const mappings = mechanicsPackage?.actionMappings ?? [];
  for (const compilation of compilations ?? []) {
    const defaultChains = (
      compilation.contracts.attackInputChains ?? []
    ).filter(chain => chain.entryPolicy?.kind === 'default');
    for (const chain of defaultChains) {
      const matches = mappings.filter(
        mapping =>
          Number(mapping.ownerId) === Number(compilation.ownerId) &&
          Number(mapping.sourceSkillId) === Number(chain.sourceSkillId) &&
          mapping.actionKind === (chain.actionKind ?? 'normal-attack')
      );
      if (matches.length !== 1) {
        throw new Error(
          `character combat default attack phase mapping mismatch: ${compilation.ownerId}/${chain.chainIdentity} received ${matches.length}`
        );
      }
      const mapping = matches[0];
      const sourceSegments = [
        ...(mapping.attackInputSourceSegments ??
          mapping.attackInputSegments ??
          []),
      ];
      const projectedSegments = (chain.segments ?? []).map((segment, index) => {
        const source = sourceSegments.find(candidate => {
          if (
            Number(candidate.controlSkillId) !== Number(segment.controlSkillId)
          ) {
            return false;
          }
          const candidateSubSkillIndex = Number(
            candidate.selectedSubSkillIndex ?? candidate.subSkillIndex ?? 0
          );
          return (
            candidateSubSkillIndex === Number(segment.subSkillIndex) ||
            candidateSubSkillIndex === 0
          );
        });
        if (!source) {
          throw new Error(
            `character combat default attack phase source segment missing: ${compilation.ownerId}/${chain.chainIdentity}/${segment.controlSkillId}/sub${segment.subSkillIndex}`
          );
        }
        const sequenceIndex = index + 1;
        return {
          ...source,
          sequenceIndex,
          sequenceTotal: chain.segments.length,
          label: segment.label ?? `A${sequenceIndex}`,
          semanticName:
            segment.semanticName ??
            source.semanticName ??
            `普通攻击 A${sequenceIndex}`,
          selectedSubSkillIndex: Number(segment.subSkillIndex),
          effectiveDurationFrames: Number(segment.durationFrames),
          durationFrames: Number(segment.durationFrames),
          durationStatus: segment.applied === false ? 'unresolved' : 'applied',
          durationBasis: 'character-combat-default-attack-phase',
          durationSourceIdentity: segment.sourceIdentity,
          attackInputChainIdentity: chain.chainIdentity,
        };
      });
      mapping.attackInputSourceSegments = sourceSegments;
      mapping.attackInputSegments = projectedSegments;
      mapping.attackInputChainIdentity = chain.chainIdentity;
      mapping.attackInputPhaseStatus =
        'character-combat-default-attack-phase-applied';
      mapping.attackInputPhaseSourceIdentity = chain.sourceIdentity;
    }
    const appliedExecutionForms = (
      compilation.contracts.publicActionForms ?? []
    ).filter(
      form =>
        form.applied === true &&
        [
          'direct-execution',
          'single-control-verified-occupancy',
          'wrapper-derived-execution',
        ].includes(form.selectionKind)
    );
    for (const form of appliedExecutionForms) {
      const matches = mappings.filter(
        mapping =>
          Number(mapping.ownerId) === Number(compilation.ownerId) &&
          Number(mapping.controlSkillId) ===
            Number(form.publicControlSkillId) &&
          mapping.actionKind === form.publicActionKind
      );
      if (matches.length !== 1) {
        throw new Error(
          `character combat public execution form mapping mismatch: ${compilation.ownerId}/${form.formIdentity} received ${matches.length}`
        );
      }
      const mapping = matches[0];
      const executionControl = [
        ...(mechanicsPackage.controlBindings ?? []),
        ...(mechanicsPackage.actionVariantControlBindings ?? []),
      ].find(
        control =>
          Number(control.controlSkillId) ===
          Number(form.executionControlSkillId)
      );
      const hits = (executionControl?.hits ?? []).filter(
        hit => Number(hit.mapIndex) === Number(form.executionSubSkillIndex)
      );
      const effects = (executionControl?.effects ?? []).filter(
        effect =>
          Number(effect.mapIndex) === Number(form.executionSubSkillIndex) &&
          effect.classification === 'applied'
      );
      if (!executionControl || (hits.length === 0 && effects.length === 0)) {
        throw new Error(
          `character combat public execution form runtime missing: ${compilation.ownerId}/${form.formIdentity}`
        );
      }
      const occupancy = form.executionTiming?.occupancy;
      mapping.runtimeReady = true;
      mapping.classification = 'applied';
      mapping.sourceEvidenceStatus = 'applied';
      mapping.scenarioRuntimeStatus = 'source-verified';
      mapping.runtimeHitCount = hits.length;
      mapping.runtimeEffectCount = effects.length;
      mapping.publicActionExecutionForms = [form];
      mapping.publicActionExecutionStatus =
        'verified-public-action-execution-form-ready';
      mapping.selectedHitIdentities = hits.map(hit => hit.hitIdentity);
      mapping.reasons = [];
      mapping.actionTiming = {
        ...(mapping.actionTiming ?? {}),
        occupancy,
        animation: form.executionTiming?.animation ?? null,
        status: 'applied',
        sourceKind: form.selectionKind,
        sourceIdentity: form.sourceIdentity,
        reasons: [],
      };
      mapping.actionScheduling = {
        status: 'exact',
        kind: 'exact-public-action-execution-form-occupancy',
        durationFrames: Number(occupancy?.durationFrames),
        planningDurationFrames: null,
        selectedSubSkillIndex: Number(form.executionSubSkillIndex),
        sourceIdentity: form.sourceIdentity,
        sourceStatus: 'verified-input-occupancy',
        variantModelStatus: 'resolved',
        reasons: [],
      };
    }
  }
  return mechanicsPackage;
}

function applyVariantWindowBindings({ edges, bindings }) {
  if (!(bindings ?? []).length) return edges;
  const output = [...edges];
  for (const binding of bindings) {
    if (binding.evidenceKind === 'control-transition-window') {
      output.push({
        edgeIdentity: `character-combat:${binding.ownerId}:variant-window:${binding.bindingIdentity}`,
        ownerKind: 'actor',
        ownerId: binding.ownerId,
        sourceControlSkillId: binding.sourceControlSkillId,
        sourceSubSkillIndex: binding.sourceSubSkillIndex,
        sourceElementId: null,
        targetControlSkillId: binding.targetControlSkillId,
        targetSubSkillIndex: binding.targetSubSkillIndex,
        activationFrame: binding.activationFrame,
        decisionFrame: binding.decisionFrame,
        durationMs: binding.durationMs,
        inputWindow: binding.inputWindow,
        relationType: binding.relationType,
        inputCommand: binding.inputCommand,
        condition: binding.condition,
        sourceIdentity: binding.sourceIdentity,
        compilerBindingIdentity: binding.bindingIdentity,
        status: 'verified-action-variant-edge-ready',
        reasons: [],
        applied: true,
      });
      continue;
    }
    const indexes = output
      .map((edge, index) => ({ edge, index }))
      .filter(({ edge }) => matchesVariantWindowBinding(edge, binding))
      .map(item => item.index);
    if (indexes.length < 1) {
      throw new Error(
        `character combat variant window match mismatch: ${binding.ownerId}/${binding.bindingIdentity} received ${indexes.length}`
      );
    }
    const index = indexes[0];
    const edge = output[index];
    output[index] = {
      ...edge,
      rawStatus: edge.status,
      rawReasons: [...(edge.reasons ?? [])],
      activationFrame: binding.activationFrame,
      decisionFrame: binding.decisionFrame,
      durationMs: binding.durationMs,
      inputWindow: binding.inputWindow,
      relationType: binding.relationType,
      inputCommand: binding.inputCommand,
      condition: binding.condition,
      sourceIdentity: [edge.sourceIdentity, binding.sourceIdentity]
        .filter(Boolean)
        .join('|'),
      compilerBindingIdentity: binding.bindingIdentity,
      status: 'verified-action-variant-edge-ready',
      reasons: [],
      applied: true,
    };
    for (const duplicateIndex of indexes.slice(1)) {
      const duplicate = output[duplicateIndex];
      output[duplicateIndex] = {
        ...duplicate,
        rawStatus: duplicate.status,
        rawReasons: [...(duplicate.reasons ?? [])],
        compilerBindingIdentity: binding.bindingIdentity,
        status: 'verified-action-variant-edge-superseded',
        reasons: [
          `duplicate-variant-window-normalized:${binding.bindingIdentity}`,
        ],
        applied: false,
      };
    }
  }
  return output;
}

function matchesVariantWindowBinding(edge, binding) {
  for (const key of [
    'ownerId',
    'sourceControlSkillId',
    'sourceSubSkillIndex',
    'sourceElementId',
    'targetControlSkillId',
    'targetSubSkillIndex',
  ]) {
    if (Number(edge[key]) !== Number(binding[key])) return false;
  }
  return true;
}

function applyActionEffectBinding(effect, binding) {
  const targetKind =
    binding.targetKindOverride ??
    effect.target?.kind ??
    effect.trigger?.targetKind ??
    'unresolved';
  const trigger = {
    behaviorPathId: `character-combat:${binding.bindingIdentity}`,
    startFrame: binding.triggerFrame,
    frameCount: binding.frameCount,
    behaviorIndex: null,
    timelineGroupIndex: 0,
    targetCode: effect.trigger?.targetCode ?? 0,
    targetKind,
    targetSourceField:
      effect.trigger?.targetSourceField ?? 'character-combat-verified-binding',
    sourceIdentity: binding.sourceIdentity,
  };
  if (binding.bindingKind === 'lifecycle-override') {
    return {
      ...effect,
      effectIdentity: `${effect.graphIdentity}|${binding.triggerFrame}|${effect.depth ?? 0}`,
      trigger,
      lifecycle: {
        ...(effect.lifecycle ?? {}),
        durationMs:
          binding.durationMsOverride ?? effect.lifecycle?.durationMs ?? null,
        stackDelta: binding.lifecycleStackDelta,
        maxStacks:
          binding.lifecycleMaxStacks ??
          effect.lifecycle?.maxStacks ??
          binding.lifecycleStackDelta,
        inheritance: binding.inheritance ?? null,
      },
      inheritance: binding.inheritance ?? null,
      targetStateActivationCondition:
        binding.targetStateActivationCondition ?? null,
      sourceIdentity: [effect.sourceIdentity, binding.sourceIdentity]
        .filter(Boolean)
        .join('|'),
      target: {
        ...(effect.target ?? {}),
        kind: targetKind,
        sourceIdentity: binding.sourceIdentity,
      },
      dimensions: {
        ...(effect.dimensions ?? {}),
        dynamicProperty: {
          status: 'applied',
          sourceField: 'formulaParams.formulaParamValues[0]',
        },
      },
      classification: 'applied',
      reasons: [],
      status: 'verified-action-effect-lifecycle-binding-applied',
      confidence: 'high',
      applied: true,
    };
  }
  if (binding.bindingKind === 'activation-condition') {
    return applyActionEffectActivationBinding(
      {
        ...effect,
        effectIdentity: `${effect.graphIdentity}|${binding.triggerFrame}|${effect.depth ?? 0}`,
        trigger,
        target: {
          ...(effect.target ?? {}),
          kind: targetKind,
          sourceIdentity: binding.sourceIdentity,
        },
      },
      binding
    );
  }
  return {
    ...effect,
    effectIdentity: `${effect.graphIdentity}|${binding.triggerFrame}|${effect.depth ?? 0}`,
    trigger,
    target: {
      ...(effect.target ?? {}),
      kind: targetKind,
      sourceIdentity: binding.sourceIdentity,
    },
    tuningMark: binding.tuningMark,
    hitGate: binding.hitGate ?? null,
    targetStateActivationCondition:
      binding.targetStateActivationCondition ?? null,
    hitActivation: binding.hitActivation ?? null,
    sourceIdentity: [effect.sourceIdentity, binding.sourceIdentity]
      .filter(Boolean)
      .join('|'),
    dimensions: {
      ...(effect.dimensions ?? {}),
      mark: {
        status: 'applied',
        sourceField: 'elementConfigId|layerInfoList|additionalHitRefreshTime',
      },
    },
    classification: 'applied',
    reasons: [],
    status: 'verified-action-effect-binding-applied',
    confidence: 'high',
    applied: true,
  };
}

function compileSpecialResourceContracts({
  ownerId,
  definitions,
  resourceProfiles,
  resourceOperations,
  operators,
}) {
  const profiles = [];
  const operations = [];
  for (const definition of definitions) {
    const elementId = Number(definition.resourceElementId);
    const discoveredProfile = resourceProfiles.find(
      item => Number(item.elementId) === elementId
    );
    const profile =
      discoveredProfile ??
      compileAssetDeclaredResourceProfile({
        ownerId,
        definition,
        operators,
      });
    if (!profile) {
      throw new Error(
        `character combat resource profile missing: ${ownerId}/${elementId}`
      );
    }
    if (
      definition.expectedCapacity != null &&
      Number(profile.capacity) !== Number(definition.expectedCapacity)
    ) {
      throw new Error(
        `character combat resource capacity mismatch: ${ownerId}/${elementId} expected ${definition.expectedCapacity}, received ${profile.capacity}`
      );
    }
    const initialStatePolicy = compileSpecialResourceInitialStatePolicy({
      ownerId,
      elementId,
      capacity: profile.capacity,
      definition: definition.initialStatePolicy,
      fallbackProfile: profile,
    });
    profiles.push({
      ...profile,
      ...initialStatePolicy,
      contractSourceIdentity:
        definition.sourceIdentity ??
        `character-combat-recipe:${ownerId}#compiler.specialResources[elementId=${elementId}]`,
    });
    const sourceOperations = resourceOperations.filter(
      operation => operation.resourceIdentity === profile.resourceIdentity
    );
    const normalized = [
      ...sourceOperations.map(operation =>
        classifyResourceOperation(operation, definition.operationRules ?? [])
      ),
      ...compileDeclaredResourceOperations({
        ownerId,
        profile,
        declarations: definition.operationDeclarations ?? [],
      }),
    ];
    const appliedCount = normalized.filter(item => item.applied).length;
    const notApplicableCount = normalized.filter(
      item => item.status === 'not-applicable'
    ).length;
    const unresolvedCount =
      normalized.length - appliedCount - notApplicableCount;
    const expected = definition.expectedOperationCounts ?? {};
    for (const [key, actual] of Object.entries({
      total: normalized.length,
      applied: appliedCount,
      notApplicable: notApplicableCount,
      unresolved: unresolvedCount,
    })) {
      if (expected[key] != null && Number(expected[key]) !== actual) {
        throw new Error(
          `character combat resource operation count mismatch: ${ownerId}/${elementId}/${key} expected ${expected[key]}, received ${actual}`
        );
      }
    }
    operations.push(...normalized);
  }
  return {
    profiles: sortByIdentity(profiles),
    operations: sortByIdentity(operations),
  };
}

function compileAssetDeclaredResourceProfile({
  ownerId,
  definition,
  operators,
}) {
  const declaration = definition.assetDeclaredProfile;
  if (!declaration || typeof declaration !== 'object') return null;
  const elementId = Number(definition.resourceElementId);
  const asset = operators.readElementAsset(elementId);
  const tree = asset?.tree;
  const capacity = Number(tree?.combineNumber);
  const combineType = Number(tree?.combineType);
  const expectedCombineType = Number(
    declaration.expectedCombineType ?? combineType
  );
  if (
    !asset ||
    Number(tree?.elementConfigId) !== elementId ||
    combineType !== expectedCombineType ||
    !Number.isInteger(capacity) ||
    capacity <= 0
  ) {
    throw new Error(
      `character combat asset-declared resource profile invalid: ${ownerId}/${elementId}`
    );
  }
  const stateElements = (declaration.stateElements ?? []).map(state => {
    const stateElementId = Number(state.elementId);
    const stateAsset = operators.readElementAsset(stateElementId);
    const durationMs = Number(stateAsset?.tree?.time);
    if (
      !stateAsset ||
      Number(stateAsset.tree?.elementConfigId) !== stateElementId ||
      (state.expectedDurationMs != null &&
        durationMs !== Number(state.expectedDurationMs)) ||
      (state.expectedCombineType != null &&
        Number(stateAsset.tree?.combineType) !==
          Number(state.expectedCombineType))
    ) {
      throw new Error(
        `character combat asset-declared resource state invalid: ${ownerId}/${elementId}/${stateElementId}`
      );
    }
    return {
      elementId: stateElementId,
      pathId: String(stateAsset.pathId),
      name: state.name ?? stateAsset.tree?.elementName ?? null,
      displayLabel:
        state.displayLabel ??
        state.name ??
        stateAsset.tree?.elementName ??
        null,
      sourceNameStatus: stateAsset.tree?.elementName
        ? 'source-name-ready'
        : 'source-name-missing',
      durationMs: Number.isFinite(durationMs) ? durationMs : null,
      combineType: Number(stateAsset.tree?.combineType),
      sourceIdentity: [stateAsset.sourceIdentity, state.sourceIdentity]
        .filter(Boolean)
        .join('|'),
      status: 'verified-special-resource-state-ready',
      applied: true,
    };
  });
  return {
    ownerId,
    elementId,
    pathId: String(asset.pathId),
    resourceIdentity: `actor:${ownerId}:element:${elementId}`,
    name: declaration.name ?? tree.elementName ?? `资源 ${elementId}`,
    displayLabel:
      declaration.displayLabel ?? declaration.name ?? tree.elementName ?? null,
    rawSourceName: tree.elementName ?? null,
    sourceNameStatus: tree.elementName
      ? 'source-name-ready'
      : 'source-name-missing',
    capacity,
    combineType,
    stateElements,
    sourceIdentity: [asset.sourceIdentity, declaration.sourceIdentity]
      .filter(Boolean)
      .join('|'),
    status: 'verified-special-resource-profile-ready',
    reasons: [],
    applied: true,
  };
}

function compileSpecialResourceInitialStatePolicy({
  ownerId,
  elementId,
  capacity,
  definition,
  fallbackProfile,
}) {
  const source =
    definition && typeof definition === 'object' ? definition : null;
  const kind =
    source?.kind ??
    fallbackProfile?.initialValueStatus ??
    'scenario-configurable-initial-state';
  if (kind !== 'scenario-configurable-initial-state') {
    throw new Error(
      `character combat resource initial-state policy unsupported: ${ownerId}/${elementId}/${kind}`
    );
  }
  const maxValue = Number(capacity);
  const defaultValue = Number(
    source?.defaultValue ?? fallbackProfile?.initialValue ?? 0
  );
  const inputStep = Number(
    source?.inputStep ?? fallbackProfile?.inputStep ?? 1
  );
  if (
    !Number.isFinite(maxValue) ||
    maxValue <= 0 ||
    !Number.isFinite(defaultValue) ||
    defaultValue < 0 ||
    defaultValue > maxValue ||
    !Number.isFinite(inputStep) ||
    inputStep <= 0
  ) {
    throw new Error(
      `character combat resource initial-state policy invalid: ${ownerId}/${elementId}`
    );
  }
  return {
    initialValue: defaultValue,
    inputStep,
    scenarioConfigurable: true,
    initialValueStatus: 'scenario-configurable-initial-state',
    initialValueSourceIdentity:
      source?.sourceIdentity ??
      fallbackProfile?.initialValueSourceIdentity ??
      'AzPrCombatScenario#initialRuntimeState.specialResourcesByActor',
  };
}

function compileDeclaredResourceOperations({ ownerId, profile, declarations }) {
  return declarations.map(declaration => {
    const triggerFrame = Number(declaration.triggerFrame);
    const frameRate = Number(declaration.frameRate) || 60;
    const amount = Number(declaration.amount);
    if (
      !declaration.operationIdentity ||
      !Number.isInteger(Number(declaration.controlSkillId)) ||
      !Number.isInteger(Number(declaration.subSkillIndex)) ||
      ![
        'gain',
        'consume',
        'clear',
        'transform',
        'transform-remove',
        'set-to-capacity',
      ].includes(declaration.operation) ||
      !Number.isInteger(triggerFrame) ||
      triggerFrame < 0 ||
      !Number.isFinite(amount)
    ) {
      throw new Error(
        `invalid declared character combat resource operation: ${ownerId}/${declaration.operationIdentity ?? 'missing'}`
      );
    }
    return {
      operationIdentity: declaration.operationIdentity,
      ownerId,
      resourceIdentity: profile.resourceIdentity,
      controlSkillId: Number(declaration.controlSkillId),
      subSkillIndex: Number(declaration.subSkillIndex),
      operation: declaration.operation,
      amountByLevel: { 1: amount },
      requiredValue:
        declaration.requiredValue == null
          ? null
          : Number(declaration.requiredValue),
      stateElementId:
        declaration.stateElementId == null
          ? null
          : Number(declaration.stateElementId),
      stateName: declaration.stateName ?? null,
      stateDurationMs:
        declaration.stateDurationMs == null
          ? null
          : Number(declaration.stateDurationMs),
      triggerFrame,
      frameRate,
      behaviorPathId: declaration.behaviorPathId ?? null,
      sourceElementId:
        declaration.sourceElementId == null
          ? Number(profile.elementId)
          : Number(declaration.sourceElementId),
      sourcePathId: declaration.sourcePathId ?? null,
      sourceIdentity: declaration.sourceIdentity,
      hitGate: compileActionHitGate(declaration.hitGate),
      status: 'verified-special-resource-operation-ready',
      reasons: [],
      impactClassification: 'gameplay-resource-transaction',
      classificationSourceIdentity: declaration.sourceIdentity,
      applied: true,
    };
  });
}

function compileActionHitGate(definition) {
  if (definition == null) return null;
  if (!definition || typeof definition !== 'object') {
    throw new Error('character combat action hit gate is invalid');
  }
  if (definition.kind === 'landed-action-hit') {
    const elementId = Number(definition.elementId);
    const triggerFrame = Number(definition.triggerFrame);
    const maximumMatches = Number(definition.maximumMatches ?? 1);
    if (
      !Number.isInteger(elementId) ||
      !Number.isInteger(triggerFrame) ||
      triggerFrame < 0 ||
      !Number.isInteger(maximumMatches) ||
      maximumMatches <= 0
    ) {
      throw new Error('character combat landed action hit gate is invalid');
    }
    return {
      kind: 'landed-action-hit',
      elementId,
      triggerFrame,
      behaviorPathId: definition.behaviorPathId ?? null,
      maximumMatches,
      sourceIdentity: definition.sourceIdentity ?? null,
    };
  }
  if (definition.kind === 'conditional-damage-group-hit') {
    const hitIndex = Number(definition.hitIndex ?? 1);
    if (
      !definition.groupIdentity ||
      !Number.isInteger(hitIndex) ||
      hitIndex <= 0
    ) {
      throw new Error(
        'character combat conditional damage action hit gate is invalid'
      );
    }
    return {
      kind: 'conditional-damage-group-hit',
      groupIdentity: String(definition.groupIdentity),
      hitIndex,
      sourceIdentity: definition.sourceIdentity ?? null,
    };
  }
  throw new Error(
    `character combat action hit gate kind unsupported: ${definition.kind}`
  );
}

function validateActionEffectHitGates({
  ownerId,
  actionEffectBindings,
  tuningMarkConditionalDamageGroups,
}) {
  const groupIdentities = new Set(
    (tuningMarkConditionalDamageGroups ?? []).map(group => group.groupIdentity)
  );
  for (const binding of actionEffectBindings ?? []) {
    const gate = binding.hitGate;
    if (
      gate?.kind === 'conditional-damage-group-hit' &&
      !groupIdentities.has(gate.groupIdentity)
    ) {
      throw new Error(
        `character combat action effect hit gate group missing: ${ownerId}/${binding.bindingIdentity}/${gate.groupIdentity}`
      );
    }
  }
}

function classifyResourceOperation(operation, rules) {
  const rule = rules.find(candidate =>
    matchesResourceOperationRule(operation, candidate.match ?? {})
  );
  if (!rule) return operation;
  if (rule.status === 'applied') {
    const triggerFrame = Number(rule.triggerFrame);
    const frameRate =
      Number(rule.frameRate) || Number(operation.frameRate) || 60;
    if (
      !Number.isInteger(triggerFrame) ||
      triggerFrame < 0 ||
      ![
        'gain',
        'consume',
        'clear',
        'transform',
        'transform-remove',
        'set-to-capacity',
      ].includes(rule.operation ?? operation.operation)
    ) {
      throw new Error(
        `invalid applied character combat resource operation rule: ${operation.operationIdentity}`
      );
    }
    return {
      ...operation,
      rawOperation: operation.operation,
      rawStatus: operation.status,
      rawReasons: [...(operation.reasons ?? [])],
      operation: rule.operation ?? operation.operation,
      triggerFrame,
      frameRate,
      sourceIdentity: [operation.sourceIdentity, rule.sourceIdentity]
        .filter(Boolean)
        .join('|'),
      status: 'verified-special-resource-operation-ready',
      reasons: [],
      impactClassification:
        rule.impactClassification ?? 'gameplay-resource-transaction',
      classificationSourceIdentity:
        rule.sourceIdentity ?? operation.sourceIdentity ?? null,
      applied: true,
    };
  }
  if (rule.status !== 'not-applicable') {
    throw new Error(
      `unsupported character combat resource operation rule status: ${rule.status}`
    );
  }
  return {
    ...operation,
    rawStatus: operation.status,
    rawReasons: [...(operation.reasons ?? [])],
    status: 'not-applicable',
    reasons: [rule.reason ?? 'structural-resource-reference'],
    impactClassification: rule.impactClassification ?? 'wrapper-or-duplicate',
    classificationSourceIdentity:
      rule.sourceIdentity ?? operation.sourceIdentity ?? null,
    applied: false,
  };
}

function matchesResourceOperationRule(operation, match) {
  if (
    match.operation != null &&
    operation.operation !== String(match.operation)
  ) {
    return false;
  }
  for (const key of [
    'controlSkillId',
    'subSkillIndex',
    'sourceElementId',
    'sourcePathId',
  ]) {
    if (match[key] != null && Number(operation[key]) !== Number(match[key])) {
      return false;
    }
  }
  if (
    match.triggerFrameStatus === 'missing' &&
    operation.triggerFrame != null
  ) {
    return false;
  }
  if (
    match.triggerFrameStatus === 'present' &&
    operation.triggerFrame == null
  ) {
    return false;
  }
  return true;
}

export function createCharacterCombatOwnerRuntimeContracts({
  compilation,
  publicActions,
  controls,
  variantEdges,
  hits,
  resourceProfiles,
  resourceTransactions,
  rawEffects,
  semanticEffects,
  switchTriggers,
  statDependencies,
}) {
  const ownerId = Number(compilation.ownerId);
  const contracts = {
    publicActions: sortByIdentity(publicActions ?? []),
    actionForms: createCompiledActionForms({
      ownerId,
      publicActions: publicActions ?? [],
      publicActionForms: compilation.contracts.publicActionForms,
      attackInputChains: compilation.contracts.attackInputChains,
    }),
    controls: sortByIdentity(controls ?? []),
    timingInputEdges: compilation.contracts.contextEdges,
    variantEdges: sortByIdentity(variantEdges ?? []),
    attackInputChains: compilation.contracts.attackInputChains,
    controlTransitionWindows: compilation.contracts.controlTransitionWindows,
    variantWindowBindings: compilation.contracts.variantWindowBindings,
    actionEffectBindings: compilation.contracts.actionEffectBindings,
    actionHitBindings: compilation.contracts.actionHitBindings,
    targetStateProfiles: compilation.contracts.targetStateProfiles,
    targetStateTransactions: compilation.contracts.targetStateTransactions,
    conditionalHitGroups: compilation.contracts.conditionalHitGroups,
    tuningMarkConditionalDamageGroups:
      compilation.contracts.tuningMarkConditionalDamageGroups,
    runtimeEffectBindings: compilation.contracts.runtimeEffectBindings,
    hits: sortByIdentity(hits ?? []),
    resourceProfiles: sortByIdentity(resourceProfiles ?? []),
    resourceTransactions: sortByIdentity(resourceTransactions ?? []),
    stateMachines: compilation.contracts.thresholdTransitions,
    effects: {
      raw: sortByIdentity(rawEffects ?? []),
      semantic: sortByIdentity(semanticEffects ?? []),
    },
    passives: compilation.contracts.passiveEffects,
    switchTriggers: sortByIdentity(switchTriggers ?? []),
    statDependencies: statDependencies ?? { static: [], dynamic: [] },
  };
  return {
    ...compilation,
    recipeContractHash: compilation.contractHash,
    contracts,
    contractHash: sha256Json(contracts),
  };
}

export function createCharacterCombatStatDependencies({
  ownerId,
  staticPropertyCatalog,
  actorProfiles,
  passiveEffects,
  semanticEffects,
}) {
  const staticActor = (staticPropertyCatalog?.actorProfiles ?? []).find(
    profile => Number(profile.characterId) === Number(ownerId)
  );
  const actorSp = (actorProfiles ?? []).find(
    profile => Number(profile.characterId) === Number(ownerId)
  );
  const dynamic = [
    ...(passiveEffects ?? []).flatMap(passive =>
      (passive.modifiers ?? []).map(modifier => ({
        sourceKind: 'passive-dynamic-property',
        passiveIdentity: passive.passiveIdentity,
        ...modifier,
        status: passive.applied ? 'applied' : 'static-evidence-gap',
      }))
    ),
    ...(semanticEffects ?? [])
      .filter(
        effect => effect.dimensions?.dynamicProperty?.status === 'applied'
      )
      .map(effect => ({
        sourceKind: 'semantic-effect-dynamic-property',
        semanticIdentity: effect.semanticIdentity,
        attributeId: effect.propertyChange?.attributeId ?? null,
        bucket: effect.propertyChange?.bucket ?? null,
        sourceIdentity: effect.sourceIdentities?.join('|') ?? null,
        status: effect.classification,
      })),
  ];
  const staticDependencies = [
    staticActor
      ? {
          sourceKind: 'verified-static-actor-profile',
          characterId: Number(ownerId),
          sourceIdentity:
            staticActor.sourceIdentity ??
            `verified-static-property-catalog:actor:${ownerId}`,
          status: 'applied',
        }
      : null,
    actorSp
      ? {
          sourceKind: 'verified-actor-sp-profile',
          characterId: Number(ownerId),
          sourceIdentity:
            actorSp.sourceIdentity ?? `verified-owner-profile:actor:${ownerId}`,
          status: 'applied',
        }
      : null,
  ].filter(Boolean);
  return {
    static: staticDependencies,
    dynamic,
    sourceIdentity: [
      ...staticDependencies.map(item => item.sourceIdentity),
      ...dynamic.map(item => item.sourceIdentity),
    ]
      .filter(Boolean)
      .join('|'),
  };
}

export function createCompiledActionForms({
  ownerId,
  publicActions,
  publicActionForms,
  attackInputChains,
}) {
  const chainForms = attackInputChains.flatMap(chain =>
    chain.segments.map(segment => ({
      formIdentity: `${chain.chainIdentity}:segment:${segment.sequenceIndex}`,
      ownerId,
      publicActionIdentity: `actor:${ownerId}:normal-attack`,
      publicActionKind: 'normal-attack',
      actionKind: 'normal-attack',
      sourceSkillId: chain.sourceSkillId,
      sourceControlSkillId: segment.controlSkillId,
      sourceSubSkillIndex: segment.subSkillIndex,
      executionControlSkillId: segment.controlSkillId,
      executionSubSkillIndex: segment.subSkillIndex,
      sequenceIndex: segment.sequenceIndex,
      sequenceTotal: segment.sequenceTotal,
      semanticName: `${chain.semanticNamePrefix ?? '普通攻击'} A${segment.sequenceIndex}`,
      executionTiming: segment.executionTiming,
      sourceIdentity: segment.sourceIdentity,
      status: segment.applied ? 'applied' : 'static-evidence-gap',
      applied: segment.applied === true,
      reasons: segment.reasons ?? [],
    }))
  );
  const coveredKinds = new Set([
    ...chainForms.map(form => form.publicActionKind),
    ...publicActionForms.map(form => form.publicActionKind),
  ]);
  const normalizedPublicActionForms = publicActionForms.map(form => ({
    ...form,
    status: form.applied === true ? 'applied' : 'static-evidence-gap',
    reasons:
      form.applied === true
        ? []
        : [...new Set(form.reasons ?? ['public-action-form-unresolved'])],
  }));
  const defaultForms = publicActions
    .filter(action => !coveredKinds.has(action.actionKind))
    .map(action => {
      const applied =
        action.classification === 'applied' ||
        (action.schedulable !== false &&
          action.actionScheduling?.status === 'applied');
      return {
        formIdentity: `${action.identity}:default`,
        ownerId,
        publicActionIdentity: action.identity,
        publicActionKind: action.actionKind,
        actionKind: action.actionKind,
        sourceSkillId: action.sourceSkillId,
        sourceControlSkillId: action.controlSkillId,
        sourceSubSkillIndex: action.selectedSubSkillIndex ?? 0,
        executionControlSkillId: action.controlSkillId,
        executionSubSkillIndex: action.selectedSubSkillIndex ?? 0,
        semanticName:
          action.actionVariantLabel ??
          action.sourceSkillName ??
          action.actionKind,
        executionTiming: action.executionTiming ?? null,
        sourceIdentity:
          action.sourceIdentity ?? action.bindingSourceIdentity ?? null,
        status: applied ? 'applied' : 'static-evidence-gap',
        applied,
        reasons: applied
          ? []
          : [...new Set(action.reasons ?? [action.classification])].filter(
              Boolean
            ),
      };
    });
  return dedupeBy(
    [...chainForms, ...normalizedPublicActionForms, ...defaultForms],
    form => form.formIdentity
  ).sort(compareIdentity);
}

function compileContextInputEdges({
  ownerId,
  definitions,
  controlBySkillId,
  resourceProfiles,
  operators,
}) {
  return definitions.flatMap(definition => {
    const sourceControl = requireControl(
      controlBySkillId,
      definition.sourceControlSkillId,
      'context source'
    );
    const executionControl = requireControl(
      controlBySkillId,
      definition.executionControlSkillId,
      'context execution'
    );
    const declaredWindow = definition.inputWindow
      ? {
          kind: 'declared-control-transition-window',
          startFrame: Number(definition.inputWindow.startFrame),
          endFrame: Number(definition.inputWindow.endFrame),
          frameRate: Number(definition.inputWindow.frameRate) || 60,
          targetControlSkillId: Number(definition.executionControlSkillId),
          targetSubSkillIndex: Number(definition.executionSubSkillIndex),
          allowAttack: definition.inputCommand === 'normal-attack',
          allowedInputCommands: [definition.inputCommand].filter(Boolean),
          bridgeType: definition.inputWindow.bridgeType ?? null,
          continuousAttackType:
            definition.inputWindow.continuousAttackType ?? null,
          interruptBehavior: definition.inputWindow.interruptBehavior ?? null,
          baseOnInput: definition.inputWindow.baseOnInput ?? null,
          inputToIndex: definition.inputWindow.inputToIndex ?? null,
          sourceIdentity: definition.sourceIdentity,
        }
      : null;
    const windows = (
      declaredWindow
        ? [declaredWindow]
        : operators.normalizeControlWindows(
            sourceControl,
            definition.sourceSubSkillIndex
          )
    ).filter(
      window =>
        Number(window.targetControlSkillId) ===
          Number(definition.executionControlSkillId) &&
        Number(window.targetSubSkillIndex) ===
          Number(definition.executionSubSkillIndex)
    );
    if (windows.length !== Number(definition.expectedWindowCount)) {
      throw new Error(
        `character combat context window count mismatch: ${ownerId}/${definition.sourceControlSkillId}/${definition.sourceSubSkillIndex} expected ${definition.expectedWindowCount}, received ${windows.length}`
      );
    }
    const baseCondition = compileCondition(
      definition.condition,
      ownerId,
      resourceProfiles,
      operators
    );
    const requiredSwitchAsset = definition.requiredSwitchElementId
      ? operators.readElementAsset(definition.requiredSwitchElementId)
      : null;
    const condition =
      requiredSwitchAsset && baseCondition.kind === 'always'
        ? {
            ...baseCondition,
            sourceIdentity: requiredSwitchAsset.sourceIdentity,
          }
        : baseCondition;
    return windows.map(window => {
      const executionTiming = applyDeclaredExecutionOccupancy({
        timing: operators.resolveControlVariantTiming({
          control: executionControl,
          subSkillIndex: definition.executionSubSkillIndex,
          actionKind: definition.publicActionKind,
        }),
        declaration: definition.executionOccupancy,
        ownerId,
        identity: definition.semanticIdentity,
      });
      const sourceExecutionTiming = applyDeclaredExecutionOccupancy({
        timing: operators.resolveControlVariantTiming({
          control: sourceControl,
          subSkillIndex: definition.sourceSubSkillIndex,
          actionKind: definition.sourcePublicActionKind,
        }),
        declaration: definition.sourceOccupancy,
        ownerId,
        identity: `${definition.semanticIdentity}:source`,
      });
      const inputScheduling = createContextInputScheduling({
        window,
        sourceExecutionTiming,
      });
      const targetMatches =
        Number(window.targetControlSkillId) ===
          Number(definition.executionControlSkillId) &&
        Number(window.targetSubSkillIndex) ===
          Number(definition.executionSubSkillIndex);
      const switchMatches =
        requiredSwitchAsset == null ||
        (Number(requiredSwitchAsset?.tree?.skillID) ===
          Number(definition.executionControlSkillId) &&
          Number(requiredSwitchAsset?.tree?.subSkillIndex) ===
            Number(definition.executionSubSkillIndex));
      const applied =
        targetMatches &&
        switchMatches &&
        inputScheduling.status === 'applied' &&
        executionTiming?.occupancy?.status === 'applied';
      const edgeIdentity = [
        `actor:${ownerId}`,
        `control:${definition.sourceControlSkillId}`,
        `sub:${definition.sourceSubSkillIndex}`,
        `context:${window.startFrame}-${window.endFrame}`,
        `public-control:${definition.publicControlSkillId}`,
        `execution-control:${definition.executionControlSkillId}`,
        `sub:${definition.executionSubSkillIndex}`,
      ].join('|');
      return {
        edgeIdentity,
        ownerId,
        relationType: 'input-context-derived',
        inputCommand:
          definition.inputCommand ??
          resolveInputCommand(window, definition.publicActionKind),
        sourceControlSkillId: definition.sourceControlSkillId,
        sourceSubSkillIndex: definition.sourceSubSkillIndex,
        sourcePublicActionKind: definition.sourcePublicActionKind,
        sourcePublicActionIdentity: [
          `actor:${ownerId}`,
          definition.sourcePublicActionKind,
          `control:${definition.sourceControlSkillId}`,
          `sub:${definition.sourceSubSkillIndex}`,
        ].join('|'),
        sourceSemanticName: definition.sourceSemanticName,
        targetControlSkillId: definition.publicControlSkillId,
        executionControlSkillId: definition.executionControlSkillId,
        targetSubSkillIndex: definition.executionSubSkillIndex,
        semanticIdentity: definition.semanticIdentity,
        semanticName: definition.semanticName,
        publicActionKind: definition.publicActionKind,
        publicActionIdentity: `actor:${ownerId}:${definition.publicActionKind}`,
        executionTiming: toRuntimeExecutionTiming(executionTiming),
        sourceExecutionTiming: toRuntimeExecutionTiming(sourceExecutionTiming),
        decisionFrame: Number(definition.decisionFrame) || 0,
        inputWindow: {
          startFrame: window.startFrame,
          endFrame: window.endFrame,
          frameRate: window.frameRate ?? 60,
          bridgeType: window.bridgeType,
          continuousAttackType: window.continuousAttackType,
          interruptBehavior: window.interruptBehavior,
          frameIndex: window.frameIndex,
          baseOnInput: window.baseOnInput,
          inputToIndex: window.inputToIndex,
          allowedInputCommands: window.allowedInputCommands ?? [],
          sourceIdentity: window.sourceIdentity,
        },
        inputScheduling,
        condition,
        sourceIdentity: [
          window.sourceIdentity,
          requiredSwitchAsset?.sourceIdentity,
          condition?.sourceIdentity,
          inputScheduling.sourceIdentity,
          executionTiming?.sourceIdentity,
        ]
          .filter(Boolean)
          .join('|'),
        status: applied
          ? 'verified-input-context-variant-edge-ready'
          : 'unresolved-input-context-variant-edge',
        reasons: [
          ...(targetMatches ? [] : ['context-window-target-mismatch']),
          ...(switchMatches ? [] : ['context-switch-target-mismatch']),
          ...(inputScheduling.status === 'applied'
            ? []
            : inputScheduling.reasons),
          ...(executionTiming?.occupancy?.status === 'applied'
            ? []
            : ['context-execution-occupancy-unresolved']),
        ],
        applied,
      };
    });
  });
}

function compilePublicActionForms({
  ownerId,
  definitions,
  controlBySkillId,
  resourceProfiles,
  contextEdges,
  operators,
}) {
  return definitions.map(definition => {
    const control = requireControl(
      controlBySkillId,
      definition.executionControlSkillId,
      'public action form'
    );
    const timing = applyDeclaredExecutionOccupancy({
      timing: operators.resolveControlVariantTiming({
        control,
        subSkillIndex: definition.executionSubSkillIndex,
        actionKind: definition.publicActionKind,
      }),
      declaration: definition.executionOccupancy,
      ownerId,
      identity: definition.semanticIdentity,
    });
    const condition = compileCondition(
      definition.condition,
      ownerId,
      resourceProfiles,
      operators
    );
    const executionPrerequisite = compileExecutionPrerequisite(
      definition.executionPrerequisite,
      ownerId,
      definition.semanticIdentity
    );
    const switchAsset = definition.switchElementId
      ? operators.readElementAsset(definition.switchElementId)
      : null;
    const contextSources = contextEdges
      .filter(edge => edge.semanticIdentity === definition.semanticIdentity)
      .map(edge => edge.sourceIdentity);
    const variantSourceIdentity = control.variants?.find(
      variant =>
        Number(variant.subSkillIndex) ===
        Number(definition.executionSubSkillIndex)
    )?.sourceIdentity;
    const definitionSources = switchAsset?.sourceIdentity
      ? [switchAsset.sourceIdentity, ...contextSources]
      : contextSources.length > 0
        ? contextSources
        : [variantSourceIdentity];
    const applied = timing?.occupancy?.status === 'applied';
    return {
      formIdentity: `actor:${ownerId}:${definition.publicActionKind}:${definition.semanticIdentity}`,
      ownerId,
      publicActionKind: definition.publicActionKind,
      publicControlSkillId: definition.publicControlSkillId,
      semanticIdentity: definition.semanticIdentity,
      semanticName: definition.semanticName,
      executionControlSkillId: definition.executionControlSkillId,
      executionSubSkillIndex: definition.executionSubSkillIndex,
      selectionKind: definition.selectionKind,
      condition,
      executionPrerequisite,
      executionTiming: toRuntimeExecutionTiming(timing),
      sourceIdentity: [...definitionSources, timing?.sourceIdentity]
        .filter(Boolean)
        .join('|'),
      status: applied
        ? 'verified-public-action-form-ready'
        : 'unresolved-public-action-form',
      reasons: applied ? [] : ['public-action-form-occupancy-unresolved'],
      applied,
    };
  });
}

function applyDeclaredExecutionOccupancy({
  timing,
  declaration,
  ownerId,
  identity,
}) {
  if (!declaration) return timing;
  const durationFrames = Number(declaration.durationFrames);
  const frameRate =
    Number(declaration.frameRate) || Number(timing?.frameRate) || 60;
  const animationDurationFrames = Number(timing?.animation?.durationFrames);
  if (
    !Number.isInteger(durationFrames) ||
    durationFrames <= 0 ||
    !declaration.sourceIdentity ||
    (Number.isFinite(animationDurationFrames) &&
      durationFrames > animationDurationFrames)
  ) {
    throw new Error(
      `invalid declared character combat occupancy: ${ownerId}/${identity}`
    );
  }
  const occupancy = {
    startFrame: 0,
    endFrame: durationFrames,
    durationFrames,
    frameRate,
    status: 'applied',
    sourceKind: declaration.sourceKind ?? 'declared-verified-input-occupancy',
    sourceIdentity: declaration.sourceIdentity,
    conversion: `${durationFrames} source frames at ${frameRate}fps`,
    reasons: [],
  };
  return {
    ...(timing ?? {}),
    occupancy,
    status: 'applied',
    sourceKind: occupancy.sourceKind,
    sourceIdentity: [timing?.sourceIdentity, declaration.sourceIdentity]
      .filter(Boolean)
      .join('|'),
    reasons: (timing?.reasons ?? []).filter(
      reason =>
        reason !== 'verified-action-effective-occupancy-window-unresolved'
    ),
  };
}

function compileInputVariantSelectors({
  ownerId,
  definitions,
  controlBySkillId,
  operators,
}) {
  return definitions.map(definition => {
    const publicControl = requireControl(
      controlBySkillId,
      definition.publicControlSkillId,
      'input variant public control'
    );
    const actionKinds = [
      ...new Set((definition.actionKinds ?? []).map(String).filter(Boolean)),
    ];
    const options = (definition.options ?? []).map((option, index) => {
      const executionControl = requireControl(
        controlBySkillId,
        option.executionControlSkillId,
        'input variant execution control'
      );
      const executionTiming = applyDeclaredExecutionOccupancy({
        timing: operators.resolveControlVariantTiming({
          control: executionControl,
          subSkillIndex: option.executionSubSkillIndex,
          actionKind: actionKinds[0] ?? null,
        }),
        declaration: option.executionOccupancy,
        ownerId,
        identity: option.selectorIdentity,
      });
      const publicVariantIndex = Number(option.publicVariantIndex);
      const executionSubSkillIndex = Number(option.executionSubSkillIndex);
      if (
        !option.selectorIdentity ||
        !Number.isInteger(publicVariantIndex) ||
        publicVariantIndex < 0 ||
        !Number.isInteger(executionSubSkillIndex) ||
        executionSubSkillIndex < 0 ||
        executionTiming?.occupancy?.status !== 'applied'
      ) {
        throw new Error(
          `character combat input variant evidence missing: ${ownerId}/${definition.selectorIdentity}/${index}`
        );
      }
      return {
        selectorIdentity: option.selectorIdentity,
        label: option.label ?? `Variant ${index + 1}`,
        publicVariantIndex,
        executionControlSkillId: Number(option.executionControlSkillId),
        executionSubSkillIndex,
        subSkillIndex: executionSubSkillIndex,
        playerSkillId:
          executionControl.variants?.find(
            variant => Number(variant.subSkillIndex) === executionSubSkillIndex
          )?.playerSkillId ?? null,
        durationFrames: executionTiming.occupancy.durationFrames,
        chargeTier:
          option.chargeTier == null ? null : Number(option.chargeTier),
        executionTiming: toRuntimeExecutionTiming(executionTiming),
        sourceIdentity: [option.sourceIdentity, executionTiming.sourceIdentity]
          .filter(Boolean)
          .join('|'),
        resolutionStatus: 'applied',
      };
    });
    if (
      !definition.selectorIdentity ||
      actionKinds.length === 0 ||
      options.length < 2 ||
      new Set(options.map(option => option.selectorIdentity)).size !==
        options.length ||
      new Set(options.map(option => option.publicVariantIndex)).size !==
        options.length
    ) {
      throw new Error(
        `character combat input variant selector invalid: ${ownerId}/${definition.selectorIdentity}`
      );
    }
    const inputSelector = {
      selectorIdentity: definition.selectorIdentity,
      kind: definition.kind ?? 'input-variant',
      mode: definition.mode ?? 'press',
      holdRange:
        definition.holdRange && typeof definition.holdRange === 'object'
          ? { ...definition.holdRange }
          : null,
      options,
      sourceIdentity: [
        definition.sourceIdentity,
        publicControl.sourcePath,
        ...options.map(option => option.sourceIdentity),
      ]
        .filter(Boolean)
        .join('|'),
      resolutionStatus: 'applied',
    };
    return {
      selectorIdentity: definition.selectorIdentity,
      ownerId,
      publicControlSkillId: Number(definition.publicControlSkillId),
      actionKinds,
      decisionFrame: Number(definition.decisionFrame) || 0,
      options,
      inputSelector,
      sourceIdentity: inputSelector.sourceIdentity,
      resolutionStatus: 'applied',
      applied: true,
    };
  });
}

function applyCompiledInputVariantSelectors({ contracts, bindings }) {
  const nextContracts = [...contracts];
  for (const binding of bindings) {
    const index = nextContracts.findIndex(
      contract =>
        Number(contract.ownerId) === Number(binding.ownerId) &&
        Number(contract.controlSkillId) === Number(binding.publicControlSkillId)
    );
    const current = index >= 0 ? nextContracts[index] : null;
    const next = {
      ...(current ?? {}),
      contractIdentity:
        current?.contractIdentity ??
        `actor:${binding.ownerId}|control:${binding.publicControlSkillId}|derived-control`,
      ownerKind: 'actor',
      ownerId: Number(binding.ownerId),
      controlSkillId: Number(binding.publicControlSkillId),
      actionKinds: [
        ...new Set([
          ...(current?.actionKinds ?? []),
          ...(binding.actionKinds ?? []),
        ]),
      ],
      publicActions: current?.publicActions ?? [],
      controlSource: 'input-controlled',
      candidateControlSources: [
        ...new Set([
          ...(current?.candidateControlSources ?? []),
          'input-controlled',
        ]),
      ],
      decisionFrame: binding.decisionFrame,
      inputSelector: binding.inputSelector,
      inputRelations: current?.inputRelations ?? [],
      holdRange: binding.inputSelector.holdRange,
      chargeTier: binding.options,
      resourceCondition: current?.resourceCondition ?? [],
      resourceCost: current?.resourceCost ?? [],
      stateCondition: current?.stateCondition ?? [],
      automaticFollowUps: current?.automaticFollowUps ?? [],
      selectedSubSkillIndex: null,
      defaultSelection: current?.defaultSelection ?? null,
      variants: binding.options.map(option => ({
        executionControlSkillId: option.executionControlSkillId,
        subSkillIndex: option.executionSubSkillIndex,
        playerSkillId: option.playerSkillId,
        durationFrames: option.durationFrames,
        sourceIdentity: option.sourceIdentity,
      })),
      sourceIdentity: [
        ...(Array.isArray(current?.sourceIdentity)
          ? current.sourceIdentity
          : [current?.sourceIdentity].filter(Boolean)),
        binding.sourceIdentity,
      ],
      resolutionStatus: 'applied',
      reasons: [],
    };
    if (index >= 0) nextContracts[index] = next;
    else nextContracts.push(next);
  }
  return nextContracts.sort(
    (left, right) =>
      Number(left.ownerId) - Number(right.ownerId) ||
      Number(left.controlSkillId) - Number(right.controlSkillId) ||
      String(left.contractIdentity).localeCompare(
        String(right.contractIdentity)
      )
  );
}

function compileAttackInputChains({
  ownerId,
  definitions,
  controlBySkillId,
  resourceProfiles,
  operators,
}) {
  const chains = definitions.map(definition => {
    const condition = compileCondition(
      definition.condition,
      ownerId,
      resourceProfiles,
      operators
    );
    const segments = definition.segments.map((segment, index) => {
      const control = requireControl(
        controlBySkillId,
        segment.controlSkillId,
        'attack input chain'
      );
      const timing = operators.resolveNormalAttackTiming({
        control,
        subSkillIndex: segment.subSkillIndex,
        nextControlSkillId: segment.nextControlSkillId,
      });
      const applied = timing?.occupancy?.status === 'applied';
      if (!applied) {
        throw new Error(
          `character combat attack input timing unresolved: ${ownerId}/${segment.controlSkillId}/${segment.subSkillIndex}`
        );
      }
      return {
        sequenceIndex: index + 1,
        sequenceTotal: definition.segments.length,
        label: `${definition.segmentLabelPrefix ?? 'A'}${index + 1}`,
        semanticName: definition.semanticNamePrefix
          ? `${definition.semanticNamePrefix} ${definition.segmentLabelPrefix ?? 'A'}${index + 1}`
          : null,
        controlSkillId: segment.controlSkillId,
        subSkillIndex: segment.subSkillIndex,
        nextControlSkillId: segment.nextControlSkillId,
        durationFrames: timing.occupancy.durationFrames,
        executionTiming: timing,
        sourceIdentity: timing.occupancy.sourceIdentity,
        status: 'verified-attack-input-chain-segment-ready',
        applied: true,
      };
    });
    return {
      chainIdentity: definition.chainIdentity,
      ownerId,
      sourceSkillId: definition.sourceSkillId,
      semanticNamePrefix: definition.semanticNamePrefix ?? null,
      segmentLabelPrefix: definition.segmentLabelPrefix ?? 'A',
      decisionFrame: Number(definition.decisionFrame) || 0,
      stateCondition: condition,
      entryPolicy: {
        kind: definition.entryPolicy?.kind ?? 'condition-selected',
        sourceIdentity:
          definition.entryPolicy?.sourceIdentity ??
          definition.sourceIdentity ??
          null,
      },
      segmentLimit: compileAttackInputSegmentLimit({
        definition: definition.segmentLimit,
        ownerId,
        resourceProfiles,
      }),
      continuityRules: compileAttackChainContinuityRules({
        ownerId,
        definitions: definition.continuityRules ?? [],
        controlBySkillId,
        resourceProfiles,
        operators,
      }),
      segments,
      sourceIdentity: segments.map(item => item.sourceIdentity).join('|'),
      status: 'verified-attack-input-chain-ready',
      applied: true,
    };
  });
  const chainByIdentity = new Map(
    chains.map(chain => [chain.chainIdentity, chain])
  );
  return chains.map((chain, index) => {
    const definition = definitions[index];
    if (!definition.phaseTransition) return chain;
    const sourceSegment = chain.segments.find(
      segment =>
        Number(segment.sequenceIndex) ===
        Number(definition.phaseTransition.sourceSequenceIndex)
    );
    const targetChain = chainByIdentity.get(
      definition.phaseTransition.targetChainIdentity
    );
    const targetSegment = targetChain?.segments?.[0] ?? null;
    const inputWindow = sourceSegment?.executionTiming?.occupancy?.linkWindow;
    const targetMatches =
      inputWindow &&
      targetSegment &&
      Number(inputWindow.targetControlSkillId) ===
        Number(targetSegment.controlSkillId) &&
      Number(inputWindow.targetSubSkillIndex) ===
        Number(targetSegment.subSkillIndex);
    if (!targetMatches) {
      throw new Error(
        `character combat attack phase transition evidence mismatch: ${ownerId}/${chain.chainIdentity}/${definition.phaseTransition.targetChainIdentity}`
      );
    }
    return {
      ...chain,
      phaseTransition: {
        targetChainIdentity: targetChain.chainIdentity,
        inputCommand:
          definition.phaseTransition.inputCommand ?? 'normal-attack',
        sourceSequenceIndex: sourceSegment.sequenceIndex,
        condition: compileCondition(
          definition.phaseTransition.condition,
          ownerId,
          resourceProfiles,
          operators
        ),
        inputWindow: {
          startFrame: Number(inputWindow.startFrame),
          endFrame: Number(inputWindow.endFrame),
          frameRate: Number(inputWindow.frameRate) || 60,
          targetControlSkillId: Number(inputWindow.targetControlSkillId),
          targetSubSkillIndex: Number(inputWindow.targetSubSkillIndex),
          sourceIdentity: inputWindow.sourceIdentity,
        },
        sourceIdentity: [
          sourceSegment.sourceIdentity,
          inputWindow.sourceIdentity,
          definition.phaseTransition.sourceIdentity,
        ]
          .filter(Boolean)
          .join('|'),
        status: 'applied',
        applied: true,
      },
    };
  });
}

function compileAttackChainContinuityRules({
  ownerId,
  definitions,
  controlBySkillId,
  resourceProfiles,
  operators,
}) {
  return definitions.map(definition => {
    const intermediaryControl = requireControl(
      controlBySkillId,
      definition.intermediaryControlSkillId,
      'attack chain continuity intermediary'
    );
    requireControl(
      controlBySkillId,
      definition.requiredActiveTargetControlSkillId,
      'attack chain continuity active target'
    );
    const startFrame = Number(definition.inputWindow?.startFrame);
    const endFrame = Number(definition.inputWindow?.endFrame);
    const inputCommand = definition.inputCommand ?? 'normal-attack';
    const matchingWindows = operators
      .normalizeControlWindows(
        intermediaryControl,
        definition.intermediarySubSkillIndex
      )
      .filter(
        window =>
          Number(window.startFrame) === startFrame &&
          Number(window.endFrame) === endFrame &&
          (window.allowAttack === true ||
            (window.allowedInputCommands ?? []).includes(inputCommand))
      );
    if (
      !Number.isInteger(startFrame) ||
      startFrame < 0 ||
      !Number.isInteger(endFrame) ||
      endFrame <= startFrame ||
      matchingWindows.length !== 1
    ) {
      throw new Error(
        `character combat attack chain continuity evidence mismatch: ${ownerId}/${definition.ruleIdentity} received ${matchingWindows.length}`
      );
    }
    const sourceWindow = matchingWindows[0];
    return {
      ruleIdentity: definition.ruleIdentity,
      ownerId,
      intermediaryControlSkillId: Number(definition.intermediaryControlSkillId),
      intermediarySubSkillIndex: Number(definition.intermediarySubSkillIndex),
      requiredActiveTargetControlSkillId: Number(
        definition.requiredActiveTargetControlSkillId
      ),
      requiredActiveTargetSubSkillIndex: Number(
        definition.requiredActiveTargetSubSkillIndex
      ),
      inputCommand,
      inputWindow: {
        startFrame,
        endFrame,
        durationFrames: endFrame - startFrame,
      },
      resumePolicy: definition.resumePolicy ?? 'next-segment',
      condition: compileCondition(
        definition.condition,
        ownerId,
        resourceProfiles,
        operators
      ),
      exitRules: definition.exitRules ?? null,
      sourceIdentity: [sourceWindow.sourceIdentity, definition.sourceIdentity]
        .filter(Boolean)
        .join('|'),
      status: 'applied',
      applied: true,
    };
  });
}

function compileAttackInputSegmentLimit({
  definition,
  ownerId,
  resourceProfiles,
}) {
  if (!definition) return null;
  if (definition.kind !== 'resource-current-value') {
    throw new Error(
      `unsupported attack input segment limit: ${ownerId}/${definition.kind}`
    );
  }
  const profile = resourceProfiles.find(
    item => Number(item.elementId) === Number(definition.resourceElementId)
  );
  const costPerSegment = Number(definition.costPerSegment);
  const maximum = Number(definition.maximum);
  if (
    !profile ||
    !(costPerSegment > 0) ||
    !Number.isInteger(maximum) ||
    maximum <= 0
  ) {
    throw new Error(
      `character combat attack input segment limit evidence missing: ${ownerId}/${definition.resourceElementId}`
    );
  }
  return {
    kind: definition.kind,
    resourceIdentity: profile.resourceIdentity,
    costPerSegment,
    maximum: Math.min(maximum, Number(profile.capacity)),
    sourceIdentity: [profile.sourceIdentity, definition.sourceIdentity]
      .filter(Boolean)
      .join('|'),
  };
}

function compileVariantWindowBindings({
  ownerId,
  definitions,
  controlBySkillId,
  resourceProfiles,
  operators,
}) {
  return definitions.map(definition => {
    const sourceControl = requireControl(
      controlBySkillId,
      definition.sourceControlSkillId,
      'variant window binding'
    );
    requireControl(
      controlBySkillId,
      definition.targetControlSkillId,
      'variant window target'
    );
    if (definition.evidenceKind === 'control-transition-window') {
      return compileControlTransitionWindowBinding({
        ownerId,
        definition,
        sourceControl,
        resourceProfiles,
        operators,
      });
    }
    const sourceElement = operators.readElementAsset(
      definition.sourceElementId
    );
    const activationFrame = Number(definition.activationFrame);
    const durationMs = Number(definition.durationMs);
    if (
      !sourceElement ||
      !Number.isInteger(activationFrame) ||
      activationFrame < 0 ||
      !(durationMs > 0)
    ) {
      throw new Error(
        `character combat variant window evidence missing: ${ownerId}/${definition.bindingIdentity}`
      );
    }
    const inputWindow = normalizeVariantInputWindow({
      inputWindow: definition.inputWindow,
      activationFrame,
      durationMs,
      frameRate: Number(sourceControl.frameRate) || 60,
    });
    return {
      bindingIdentity: definition.bindingIdentity,
      evidenceKind: definition.evidenceKind ?? 'element-state-window',
      ownerId,
      sourceControlSkillId: Number(definition.sourceControlSkillId),
      sourceSubSkillIndex: Number(definition.sourceSubSkillIndex),
      sourceElementId: Number(definition.sourceElementId),
      targetControlSkillId: Number(definition.targetControlSkillId),
      targetSubSkillIndex: Number(definition.targetSubSkillIndex),
      activationFrame,
      decisionFrame: Number(definition.decisionFrame) || activationFrame,
      durationMs,
      inputWindow,
      relationType: definition.relationType ?? 'input-derived',
      inputCommand: definition.inputCommand ?? 'normal-attack',
      condition: compileCondition(
        definition.condition,
        ownerId,
        resourceProfiles,
        operators
      ),
      sourceIdentity: [sourceElement.sourceIdentity, definition.sourceIdentity]
        .filter(Boolean)
        .join('|'),
      verification:
        definition.verification && typeof definition.verification === 'object'
          ? { ...definition.verification }
          : null,
      status: 'applied',
      applied: true,
    };
  });
}

function compileControlTransitionWindows({
  ownerId,
  reachableControlSkillIds,
  controlBySkillId,
  operators,
}) {
  const windows = [];
  for (const rawControlSkillId of reachableControlSkillIds ?? []) {
    const controlSkillId = Number(rawControlSkillId);
    const control = controlBySkillId.get(controlSkillId);
    if (!control) continue;
    for (const variant of control.variants ?? []) {
      const sourceSubSkillIndex = Number(variant.subSkillIndex);
      if (!Number.isInteger(sourceSubSkillIndex)) continue;
      for (const window of operators.normalizeControlWindows(
        control,
        sourceSubSkillIndex
      )) {
        const startFrame = Number(window.startFrame);
        const endFrame = Number(window.endFrame);
        if (
          !Number.isInteger(startFrame) ||
          startFrame < 0 ||
          !Number.isInteger(endFrame) ||
          endFrame <= startFrame
        ) {
          continue;
        }
        const targetControlSkillId = nonNegativeIntegerOrNull(
          window.targetControlSkillId
        );
        const targetSubSkillIndex = nonNegativeIntegerOrNull(
          window.targetSubSkillIndex
        );
        windows.push({
          windowIdentity: [
            `actor:${ownerId}`,
            `control:${controlSkillId}`,
            `sub:${sourceSubSkillIndex}`,
            `${startFrame}-${endFrame}`,
            targetControlSkillId == null
              ? window.kind
              : `target:${targetControlSkillId}/sub:${targetSubSkillIndex}`,
            window.sourceIdentity,
          ]
            .filter(Boolean)
            .join('|'),
          ownerId,
          sourceControlSkillId: controlSkillId,
          sourceSubSkillIndex,
          kind: window.kind ?? 'unresolved',
          startFrame,
          endFrame,
          durationFrames: endFrame - startFrame,
          targetControlSkillId,
          targetSubSkillIndex,
          allowedInputCommands: [...(window.allowedInputCommands ?? [])],
          allowAttack: window.allowAttack === true,
          baseOnInput: window.baseOnInput === true,
          inputToIndex: window.inputToIndex === true,
          bridgeType: nonNegativeIntegerOrNull(window.bridgeType),
          continuousAttackType: nonNegativeIntegerOrNull(
            window.continuousAttackType
          ),
          interruptBehavior: nonNegativeIntegerOrNull(window.interruptBehavior),
          frameIndex: nonNegativeIntegerOrNull(window.frameIndex),
          behaviorLineName: window.behaviorLineName ?? null,
          sourceIdentity: window.sourceIdentity ?? control.sourcePath ?? null,
          status: 'applied',
          applied: true,
        });
      }
    }
  }
  return dedupeBy(
    windows.sort((left, right) =>
      left.windowIdentity.localeCompare(right.windowIdentity)
    ),
    window => window.windowIdentity
  );
}

function compileControlTransitionWindowBinding({
  ownerId,
  definition,
  sourceControl,
  resourceProfiles,
  operators,
}) {
  const expectedWindow = definition.inputWindow ?? {};
  const startFrame = Number(expectedWindow.startFrame);
  const endFrame = Number(expectedWindow.endFrame);
  const sourceSubSkillIndex = Number(definition.sourceSubSkillIndex);
  const targetControlSkillId = Number(definition.targetControlSkillId);
  const targetSubSkillIndex = Number(definition.targetSubSkillIndex);
  const matches = operators
    .normalizeControlWindows(sourceControl, sourceSubSkillIndex)
    .filter(
      window =>
        Number(window.startFrame) === startFrame &&
        Number(window.endFrame) === endFrame &&
        Number(window.targetControlSkillId) === targetControlSkillId &&
        Number(window.targetSubSkillIndex) === targetSubSkillIndex
    );
  if (
    !Number.isInteger(startFrame) ||
    startFrame < 0 ||
    !Number.isInteger(endFrame) ||
    endFrame <= startFrame ||
    matches.length !== 1
  ) {
    throw new Error(
      `character combat control transition evidence mismatch: ${ownerId}/${definition.bindingIdentity} received ${matches.length}`
    );
  }
  const frameRate = Number(sourceControl.frameRate) || 60;
  const durationFrames = endFrame - startFrame;
  const sourceWindow = matches[0];
  return {
    bindingIdentity: definition.bindingIdentity,
    evidenceKind: 'control-transition-window',
    ownerId,
    sourceControlSkillId: Number(definition.sourceControlSkillId),
    sourceSubSkillIndex,
    sourceElementId: null,
    targetControlSkillId,
    targetSubSkillIndex,
    activationFrame: startFrame,
    decisionFrame: Number(definition.decisionFrame) || startFrame,
    durationMs: (durationFrames * 1000) / frameRate,
    inputWindow: {
      startFrame,
      endFrame,
      durationFrames,
    },
    relationType: definition.relationType ?? 'input-derived',
    inputCommand: definition.inputCommand ?? 'normal-attack',
    condition: compileCondition(
      definition.condition,
      ownerId,
      resourceProfiles,
      operators
    ),
    sourceIdentity: [sourceWindow.sourceIdentity, definition.sourceIdentity]
      .filter(Boolean)
      .join('|'),
    verification:
      definition.verification && typeof definition.verification === 'object'
        ? { ...definition.verification }
        : null,
    status: 'applied',
    applied: true,
  };
}

function normalizeVariantInputWindow({
  inputWindow,
  activationFrame,
  durationMs,
  frameRate,
}) {
  const startFrame = Number(inputWindow?.startFrame ?? activationFrame);
  const endFrame = Number(
    inputWindow?.endFrame ??
      startFrame + Math.round((Number(durationMs) * Number(frameRate)) / 1000)
  );
  if (
    !Number.isInteger(startFrame) ||
    startFrame < 0 ||
    !Number.isInteger(endFrame) ||
    endFrame <= startFrame
  ) {
    throw new Error('character combat variant input window is invalid');
  }
  return {
    startFrame,
    endFrame,
    durationFrames: endFrame - startFrame,
  };
}

function compileActionEffectBindings({
  ownerId,
  definitions,
  controlBySkillId,
  resourceProfiles,
  targetStateProfiles,
  tuningMarkProfiles,
  actionHitBindings,
  operators,
}) {
  const targetStateProfileByIdentity = new Map(
    (targetStateProfiles ?? []).map(profile => [profile.stateIdentity, profile])
  );
  return definitions.map(definition => {
    const control = requireControl(
      controlBySkillId,
      definition.controlSkillId,
      'action effect binding'
    );
    const element = operators.readElementAsset(definition.elementId);
    const inheritanceContainer =
      definition.inheritanceContainerElementId == null
        ? null
        : operators.readElementAsset(definition.inheritanceContainerElementId);
    const inheritance = compileElementInheritance(inheritanceContainer);
    const triggerFrame = Number(definition.triggerFrame);
    const tuningProfile = definition.tuningMarkProfileKey
      ? (tuningMarkProfiles ?? []).find(
          profile =>
            (profile.profileKey ?? profile.key) ===
            definition.tuningMarkProfileKey
        )
      : null;
    const lifecycleStackDelta = Number(definition.lifecycleStackDelta);
    const lifecycleBinding =
      Number.isFinite(lifecycleStackDelta) && lifecycleStackDelta > 0;
    const targetStateActivationCondition =
      compileActionEffectTargetStateActivationCondition({
        ownerId,
        definition: definition.targetStateActivationCondition,
        targetStateProfileByIdentity,
        operators,
      });
    const hitActivation = compileActionEffectHitActivation({
      ownerId,
      definition: definition.hitActivation,
      control,
      subSkillIndex: definition.subSkillIndex,
      actionHitBindings,
      sourceReferenceKind: definition.sourceReferenceKind,
    });
    if (
      !element ||
      !Number.isInteger(triggerFrame) ||
      triggerFrame < 0 ||
      (!tuningProfile?.applied &&
        !lifecycleBinding &&
        !targetStateActivationCondition?.applied)
    ) {
      throw new Error(
        `character combat action effect evidence missing: ${ownerId}/${definition.bindingIdentity}`
      );
    }
    return {
      bindingIdentity: definition.bindingIdentity,
      ownerId,
      controlSkillId: Number(definition.controlSkillId),
      subSkillIndex: Number(definition.subSkillIndex),
      mapIndex: Number(definition.mapIndex),
      elementId: Number(definition.elementId),
      triggerFrame,
      frameCount: Math.max(1, Number(definition.frameCount) || 1),
      sourceIdentity: [
        element.sourceIdentity,
        targetStateActivationCondition?.sourceIdentity,
        hitActivation?.sourceIdentity,
        definition.sourceIdentity,
      ]
        .filter(Boolean)
        .join('|'),
      bindingKind: lifecycleBinding
        ? 'lifecycle-override'
        : tuningProfile?.applied
          ? 'tuning-mark'
          : 'activation-condition',
      tuningMark: tuningProfile
        ? {
            ...tuningProfile,
            profileKey: tuningProfile.profileKey ?? tuningProfile.key,
            stackDelta: Number(definition.stackDelta) || 1,
            occurrenceIdentity: `action-effect-binding:${definition.bindingIdentity}`,
            applied: true,
          }
        : null,
      lifecycleStackDelta: lifecycleBinding ? lifecycleStackDelta : null,
      lifecycleMaxStacks:
        definition.lifecycleMaxStacks == null
          ? null
          : Number(definition.lifecycleMaxStacks),
      durationMsOverride:
        definition.durationMsOverride == null
          ? null
          : Number(definition.durationMsOverride),
      targetKindOverride: definition.targetKindOverride ?? null,
      targetStateActivationCondition,
      hitActivation,
      sourceReferenceKind: definition.sourceReferenceKind ?? null,
      hitGate: compileActionHitGate(definition.hitGate),
      activationConditionScope:
        definition.activationConditionScope ?? 'matched-effect',
      inheritance,
      status: 'applied',
      applied: true,
    };
  });
}

function compileActionEffectHitActivation({
  ownerId,
  definition,
  control,
  subSkillIndex,
  actionHitBindings,
  sourceReferenceKind,
}) {
  if (!definition) return null;
  const elementId = Number(definition.elementId);
  const triggerFrames = [
    ...new Set((definition.triggerFrames ?? []).map(Number)),
  ].sort((left, right) => left - right);
  const syntheticHits = (actionHitBindings ?? [])
    .filter(
      binding =>
        Number(binding.controlSkillId) === Number(control?.controlSkillId) &&
        Number(binding.subSkillIndex) === Number(subSkillIndex)
    )
    .flatMap(binding =>
      binding.triggerFrames.map(frame => ({
        sourceBindingIdentity: binding.bindingIdentity,
        elementId: binding.elementId,
        mapIndex: binding.subSkillIndex,
        conditionalGroupIdentity: binding.conditionalGroupIdentity,
        trigger: { startFrame: frame },
        sourceIdentity: binding.sourceIdentity,
      }))
    );
  const sourceElementHits = (control?.elements ?? [])
    .filter(
      element =>
        Number(element.mapIndex) === Number(subSkillIndex) &&
        Number(element.elementId) === elementId &&
        (!sourceReferenceKind || element.referenceKind === sourceReferenceKind)
    )
    .flatMap(element =>
      [...(element.scenarioTriggers ?? []), ...(element.triggers ?? [])].map(
        trigger => ({
          elementId: element.elementId,
          mapIndex: element.mapIndex,
          conditionalGroupIdentity: trigger.conditionalGroupIdentity ?? null,
          trigger: { startFrame: trigger.startFrame },
          sourceIdentity: [element.sourceIdentity, trigger.sourceIdentity]
            .filter(Boolean)
            .join('|'),
        })
      )
    );
  const matchingHits = [
    ...(control?.hits ?? []),
    ...sourceElementHits,
    ...syntheticHits,
  ].filter(
    hit =>
      Number(hit.mapIndex) === Number(subSkillIndex) &&
      Number(hit.elementId) === elementId &&
      (triggerFrames.length === 0 ||
        triggerFrames.includes(Number(hit.trigger?.startFrame))) &&
      (definition.includeConditionalHits !== false ||
        !hit.conditionalGroupIdentity) &&
      (definition.conditionalGroupIdentity == null ||
        hit.conditionalGroupIdentity === definition.conditionalGroupIdentity) &&
      (definition.sourceBindingIdentity == null ||
        hit.sourceBindingIdentity === definition.sourceBindingIdentity)
  );
  const minimumLandedCount = Math.max(
    1,
    Number(definition.minimumLandedCount) || 1
  );
  const stackDeltaMode = definition.stackDeltaMode ?? 'fixed';
  if (
    !Number.isInteger(elementId) ||
    matchingHits.length < minimumLandedCount ||
    !['fixed', 'per-landed-hit'].includes(stackDeltaMode)
  ) {
    throw new Error(
      `character combat action effect hit activation evidence missing: ${ownerId}/${elementId}`
    );
  }
  return {
    kind: 'landed-hit-cardinality',
    elementId,
    triggerFrames,
    includeConditionalHits: definition.includeConditionalHits !== false,
    conditionalGroupIdentity: definition.conditionalGroupIdentity ?? null,
    sourceBindingIdentity: definition.sourceBindingIdentity ?? null,
    minimumLandedCount,
    maximumLandedCount:
      definition.maximumLandedCount == null
        ? null
        : Math.max(1, Number(definition.maximumLandedCount) || 1),
    stackDeltaMode,
    perLandedHitStackDelta: Math.max(
      1,
      Number(definition.perLandedHitStackDelta) || 1
    ),
    sourceIdentity: [
      ...matchingHits.map(hit => hit.sourceIdentity),
      definition.sourceIdentity,
    ]
      .filter(Boolean)
      .join('|'),
    status: 'verified-action-effect-hit-activation-ready',
    applied: true,
  };
}

function compileActionEffectTargetStateActivationCondition({
  ownerId,
  definition,
  targetStateProfileByIdentity,
  operators,
}) {
  if (!definition) return null;
  const profile = targetStateProfileByIdentity.get(
    String(definition.stateIdentity)
  );
  const sourceElementId = Number(definition.sourceElementId);
  const asset = operators.readElementAsset(sourceElementId);
  const tree = asset?.tree;
  const parameters =
    tree?.formulaParams?.formulaParamValues ?? tree?.functionParams ?? [];
  const commonFunctionId = Number(tree?.formulaParams?.function_1);
  const family =
    ELEMENT_LAYER_CONDITIONAL_FORMULA_FAMILIES.get(commonFunctionId);
  const stateElementId = Number(parameters[12]);
  const threshold = Number(parameters[8]);
  const trueValue = Number(parameters[19]);
  const falseValue = Number(parameters[5]);
  const minimumStacks = threshold + 1;
  if (
    !asset ||
    !profile ||
    !family ||
    stateElementId !== Number(profile.elementId) ||
    minimumStacks !== Number(definition.minimumStacks ?? 1) ||
    trueValue !== 1 ||
    falseValue !== 0 ||
    (definition.subjectKind != null &&
      family.subjectKind !== definition.subjectKind)
  ) {
    throw new Error(
      `character combat action effect activation condition evidence missing: ${ownerId}/${definition.stateIdentity}/${sourceElementId}`
    );
  }
  return {
    kind: 'element-layer-formula-activation-condition',
    commonFunctionId,
    expression: family.expression,
    subjectKind: family.subjectKind,
    stateIdentity: profile.stateIdentity,
    stateElementId,
    comparison: 'greater-than',
    threshold,
    minimumStacks,
    trueValue,
    falseValue,
    sourceElementId,
    sourceIdentity: [
      asset.sourceIdentity,
      `element_formula[${commonFunctionId}]#${family.expression}`,
      definition.sourceIdentity,
    ]
      .filter(Boolean)
      .join('|'),
    status: 'verified-element-layer-formula-activation-condition-ready',
    applied: true,
  };
}

function compileTargetStateProfiles({ ownerId, definitions, operators }) {
  return definitions.map(definition => {
    const stateAsset = operators.readElementAsset(definition.elementId);
    const capacityAsset = operators.readElementAsset(
      definition.capacityElementId ?? definition.elementId
    );
    const durationMs = Number(stateAsset?.tree?.time);
    const configuredMaxStacks = Number(capacityAsset?.tree?.combineNumber);
    // Buff-type state elements commonly carry combineNumber=-1 (marker);
    // allow an explicit recipe-declared capacity to override it.
    const maxStacks =
      configuredMaxStacks > 0
        ? configuredMaxStacks
        : Number(definition.expectedMaxStacks ?? 0);
    if (
      !stateAsset ||
      !capacityAsset ||
      !(durationMs > 0) ||
      !(maxStacks > 0) ||
      (definition.expectedDurationMs != null &&
        durationMs !== Number(definition.expectedDurationMs)) ||
      (definition.expectedMaxStacks != null &&
        maxStacks !== Number(definition.expectedMaxStacks))
    ) {
      throw new Error(
        `character combat target state evidence missing: ${ownerId}/${definition.stateIdentity}`
      );
    }
    return {
      stateIdentity: String(definition.stateIdentity),
      ownerId,
      name:
        definition.name ??
        stateAsset.tree?.elementName ??
        `状态 ${definition.elementId}`,
      targetKind: definition.targetKind ?? 'enemy',
      elementId: Number(definition.elementId),
      capacityElementId: Number(
        definition.capacityElementId ?? definition.elementId
      ),
      durationMs,
      maxStacks,
      expiryMode: definition.expiryMode ?? 'independent-layer',
      atCapacityPolicy: definition.atCapacityPolicy ?? 'ignore',
      sourceIdentity: [
        stateAsset.sourceIdentity,
        `${stateAsset.sourceIdentity}#time=${durationMs}`,
        capacityAsset.sourceIdentity,
        configuredMaxStacks > 0
          ? `${capacityAsset.sourceIdentity}#combineNumber=${maxStacks}`
          : `${capacityAsset.sourceIdentity}#combineNumber=${configuredMaxStacks}|declared-capacity-override=${maxStacks}`,
        definition.sourceIdentity,
      ]
        .filter(Boolean)
        .join('|'),
      status: 'verified-target-state-profile-ready',
      applied: true,
    };
  });
}

function compileTargetStateTransactions({
  ownerId,
  definitions,
  controlBySkillId,
  targetStateProfiles,
  operators,
}) {
  const profileByIdentity = new Map(
    targetStateProfiles.map(profile => [profile.stateIdentity, profile])
  );
  return definitions.map(definition => {
    const control = requireControl(
      controlBySkillId,
      definition.controlSkillId,
      'target state transaction'
    );
    const profile = profileByIdentity.get(String(definition.stateIdentity));
    const transactionAsset = operators.readElementAsset(
      definition.transactionElementId ?? profile?.elementId
    );
    const triggerFrame = Number(definition.triggerFrame);
    const amount = Number(definition.amount);
    const hitElementId =
      definition.requiresHitElementId == null
        ? null
        : Number(definition.requiresHitElementId);
    const hitEvidence =
      hitElementId == null
        ? null
        : (control.elements ?? []).find(
            element =>
              Number(element.mapIndex) === Number(definition.subSkillIndex) &&
              Number(element.elementId) === hitElementId &&
              (element.triggers ?? []).some(
                trigger => Number(trigger.startFrame) === triggerFrame
              )
          );
    if (
      !profile ||
      !transactionAsset ||
      !Number.isInteger(triggerFrame) ||
      triggerFrame < 0 ||
      !Number.isInteger(amount) ||
      amount <= 0 ||
      (hitElementId != null && !hitEvidence)
    ) {
      throw new Error(
        `character combat target state transaction evidence missing: ${ownerId}/${definition.transactionIdentity}`
      );
    }
    return {
      transactionIdentity: String(definition.transactionIdentity),
      ownerId,
      stateIdentity: profile.stateIdentity,
      controlSkillId: Number(definition.controlSkillId),
      subSkillIndex: Number(definition.subSkillIndex),
      triggerFrame,
      frameRate: Number(control.frameRate) || 60,
      operation: definition.operation ?? 'gain',
      amount,
      durationMs:
        definition.durationMs == null
          ? profile.durationMs
          : Number(definition.durationMs),
      requiresHitElementId: hitElementId,
      passiveSkillId:
        definition.passiveSkillId == null
          ? null
          : Number(definition.passiveSkillId),
      priority: Number(definition.priority) || 0,
      sourceIdentity: [
        transactionAsset.sourceIdentity,
        hitEvidence?.sourceIdentity,
        definition.sourceIdentity,
      ]
        .filter(Boolean)
        .join('|'),
      status: 'verified-target-state-transaction-ready',
      applied: true,
    };
  });
}

function compileConditionalHitGroups({
  ownerId,
  definitions,
  controlBySkillId,
  targetStateProfiles,
  tuningMarkProfiles,
  operators,
}) {
  const profileByIdentity = new Map(
    targetStateProfiles.map(profile => [profile.stateIdentity, profile])
  );
  return definitions.map(definition => {
    const targetControl = requireControl(
      controlBySkillId,
      definition.controlSkillId,
      'conditional hit target'
    );
    const sourceControl = requireControl(
      controlBySkillId,
      definition.sourceControlSkillId,
      'conditional hit source'
    );
    const profile = profileByIdentity.get(String(definition.stateIdentity));
    const sourceElement = (sourceControl.elements ?? []).find(
      element =>
        Number(element.mapIndex) === Number(definition.sourceSubSkillIndex) &&
        Number(element.elementId) === Number(definition.elementId) &&
        (!definition.sourceReferenceKind ||
          element.referenceKind === definition.sourceReferenceKind)
    );
    const formulaNormalization =
      resolveTargetStateConditionalFormulaNormalization({
        sourceElement,
        profile,
        minimumStacks: Math.max(1, Number(definition.minimumStacks) || 1),
        operators,
      });
    const decisionFrame = Number(definition.decisionFrame);
    const triggerFrames = [...new Set(definition.triggerFrames.map(Number))];
    const consumeBands = (definition.consumeBands ?? []).map(band => {
      const asset = operators.readElementAsset(band.sourceElementId);
      const amount = Number(band.amount);
      const minimumStacks = Number(band.minimumStacks ?? 1);
      if (
        !asset ||
        !Number.isInteger(amount) ||
        amount <= 0 ||
        !Number.isInteger(minimumStacks) ||
        minimumStacks <= 0
      ) {
        throw new Error(
          `character combat conditional consume evidence missing: ${ownerId}/${definition.groupIdentity}/${band.sourceElementId}`
        );
      }
      return {
        minimumStacks,
        amount,
        sourceElementId: Number(band.sourceElementId),
        sourceIdentity: [asset.sourceIdentity, band.sourceIdentity]
          .filter(Boolean)
          .join('|'),
        status: 'verified-target-state-consume-band-ready',
        applied: true,
      };
    });
    const tuningMark = definition.tuningMarkProfileKey
      ? (tuningMarkProfiles ?? []).find(
          profile =>
            (profile.profileKey ?? profile.key) ===
            definition.tuningMarkProfileKey
        )
      : null;
    if (
      !targetControl ||
      !sourceElement ||
      !profile ||
      !Number.isInteger(decisionFrame) ||
      decisionFrame < 0 ||
      triggerFrames.length === 0 ||
      triggerFrames.some(
        frame => !Number.isInteger(frame) || frame < decisionFrame
      ) ||
      (definition.tuningMarkProfileKey && !tuningMark?.applied) ||
      (!Object.values(sourceElement.dimensions ?? {}).some(
        dimension => dimension.status === 'applied'
      ) &&
        !formulaNormalization?.applied)
    ) {
      throw new Error(
        `character combat conditional hit evidence missing: ${ownerId}/${definition.groupIdentity} ${JSON.stringify(
          {
            targetControl: Boolean(targetControl),
            sourceElement: Boolean(sourceElement),
            targetStateProfile: Boolean(profile),
            decisionFrame,
            triggerFrames,
            tuningMarkApplied: definition.tuningMarkProfileKey
              ? Boolean(tuningMark?.applied)
              : null,
            appliedDimensionCount: Object.values(
              sourceElement?.dimensions ?? {}
            ).filter(dimension => dimension.status === 'applied').length,
            conditionalFormulaNormalized:
              formulaNormalization?.applied === true,
          }
        )}`
      );
    }
    return {
      groupIdentity: String(definition.groupIdentity),
      ownerId,
      controlSkillId: Number(definition.controlSkillId),
      subSkillIndex: Number(definition.subSkillIndex),
      sourceControlSkillId: Number(definition.sourceControlSkillId),
      sourceSubSkillIndex: Number(definition.sourceSubSkillIndex),
      sourceReferenceKind: definition.sourceReferenceKind ?? null,
      elementId: Number(definition.elementId),
      triggerFrames: triggerFrames.sort((left, right) => left - right),
      decisionFrame,
      frameRate: Number(targetControl.frameRate) || 60,
      stateIdentity: profile.stateIdentity,
      minimumStacks: Math.max(1, Number(definition.minimumStacks) || 1),
      consumePolicy: definition.consumePolicy ?? 'consume-band-or-all',
      consumeBands: consumeBands.sort(
        (left, right) => right.minimumStacks - left.minimumStacks
      ),
      fallbackConsumeAll: definition.fallbackConsumeAll !== false,
      formulaNormalization,
      tuningMark: tuningMark?.applied
        ? {
            ...tuningMark,
            profileKey: tuningMark.profileKey ?? tuningMark.key,
            stackDelta: Math.max(
              1,
              Number(definition.tuningMarkStackDelta) || 1
            ),
            occurrenceIdentity: `conditional-hit-group:${definition.groupIdentity}`,
            triggerFrame: Number(
              definition.tuningMarkTriggerFrame ?? decisionFrame
            ),
            applied: true,
          }
        : null,
      tuningMarkPerLandedHit: definition.tuningMarkPerLandedHit === true,
      tuningMarkHitElementId:
        definition.tuningMarkHitElementId == null
          ? null
          : Number(definition.tuningMarkHitElementId),
      semanticName:
        definition.semanticName ??
        sourceElement.name ??
        `条件命中 ${definition.elementId}`,
      sourceIdentity: [
        sourceElement.sourceIdentity,
        definition.sourceIdentity,
        ...consumeBands.map(band => band.sourceIdentity),
      ]
        .filter(Boolean)
        .join('|'),
      status: 'verified-conditional-hit-group-ready',
      applied: true,
    };
  });
}

function resolveTargetStateConditionalFormulaNormalization({
  sourceElement,
  profile,
  minimumStacks,
  operators,
}) {
  if (
    !sourceElement ||
    Number(sourceElement.formula?.commonFunctionId) !==
      TARGET_STATE_CONDITIONAL_COMMON_FUNCTION_ID
  ) {
    return null;
  }
  const asset = operators.readElementAsset(sourceElement.elementId);
  const tree = asset?.tree;
  const parameters =
    tree?.formulaParams?.formulaParamValues ?? tree?.functionParams ?? [];
  const stateElementId = Number(parameters[12]);
  const threshold = Number(parameters[8]);
  const trueValue = Number(parameters[19]);
  const falseValue = Number(parameters[5]);
  const expectedMinimumStacks = threshold + 1;
  const ratioAtLevelOne = Number(sourceElement.formula?.ratiosByLevel?.[1]);
  if (
    Number(tree?.formulaParams?.function_1) !==
      TARGET_STATE_CONDITIONAL_COMMON_FUNCTION_ID ||
    stateElementId !== Number(profile?.elementId) ||
    expectedMinimumStacks !== Number(minimumStacks) ||
    trueValue !== 1 ||
    falseValue !== 0 ||
    !Number.isFinite(ratioAtLevelOne) ||
    !Number.isFinite(Number(sourceElement.damage?.damageType))
  ) {
    return null;
  }
  return {
    kind: 'target-state-condition-to-unity-common-factor',
    originalCommonFunctionId: TARGET_STATE_CONDITIONAL_COMMON_FUNCTION_ID,
    normalizedCommonFunctionId: 1,
    stateIdentity: profile.stateIdentity,
    stateElementId,
    comparison: 'greater-than',
    threshold,
    minimumStacks: expectedMinimumStacks,
    trueValue,
    falseValue,
    sourceIdentity: [
      asset.sourceIdentity,
      `element_formula[${TARGET_STATE_CONDITIONAL_COMMON_FUNCTION_ID}]#IF(target.ELEMENT_LAYERS[M]>I,T,F)`,
    ]
      .filter(Boolean)
      .join('|'),
    status: 'verified-target-state-conditional-formula-normalized',
    applied: true,
  };
}

function createConditionalGroupHitBinding(group) {
  return {
    bindingIdentity: `conditional-hit-group:${group.groupIdentity}`,
    controlSkillId: group.controlSkillId,
    subSkillIndex: group.subSkillIndex,
    sourceControlSkillId: group.sourceControlSkillId,
    sourceSubSkillIndex: group.sourceSubSkillIndex,
    sourceReferenceKind: group.sourceReferenceKind,
    elementId: group.elementId,
    triggerFrames: group.triggerFrames,
    frameCount: 1,
    targetCode: 0,
    targetKind: 'enemy',
    conditionalGroupIdentity: group.groupIdentity,
    runtimeCondition: {
      kind: 'target-state-at-least',
      stateIdentity: group.stateIdentity,
      minimumStacks: group.minimumStacks,
      decisionFrame: group.decisionFrame,
    },
    formulaNormalization: group.formulaNormalization ?? null,
    sourceIdentity: group.sourceIdentity,
  };
}

function compileRuntimeEffectBindings({
  ownerId,
  definitions,
  controlBySkillId,
  conditionalHitGroups,
  targetStateProfiles,
  operators,
}) {
  const groupByIdentity = new Map(
    conditionalHitGroups.map(group => [group.groupIdentity, group])
  );
  const stateProfileByIdentity = new Map(
    targetStateProfiles.map(profile => [profile.stateIdentity, profile])
  );
  return definitions.map(definition => {
    const triggerKind = definition.triggerKind;
    const group =
      triggerKind === 'conditional-hit-group-applied'
        ? groupByIdentity.get(String(definition.conditionalGroupIdentity))
        : null;
    const actionTriggerKinds = [
      'action-frame',
      'action-frame-with-state',
      'action-hit-landed',
      'action-periodic',
    ];
    const control = actionTriggerKinds.includes(triggerKind)
      ? requireControl(
          controlBySkillId,
          definition.controlSkillId,
          'runtime effect binding'
        )
      : null;
    const triggerFrame = Number(
      definition.triggerFrame ?? group?.decisionFrame
    );
    const stateProfile =
      triggerKind === 'action-frame-with-state'
        ? stateProfileByIdentity.get(String(definition.stateIdentity))
        : null;
    const minimumStacks =
      triggerKind === 'action-frame-with-state'
        ? Number(definition.minimumStacks)
        : null;
    const propertyAsset =
      definition.propertyElementId == null
        ? null
        : operators.readElementAsset(definition.propertyElementId);
    const directSpAsset =
      definition.directSpElementId == null
        ? null
        : operators.readElementAsset(definition.directSpElementId);
    const durationAsset =
      definition.durationElementId == null
        ? propertyAsset
        : operators.readElementAsset(definition.durationElementId);
    const inheritance = compileElementInheritance(durationAsset);
    const modifier = propertyAsset
      ? compileRuntimePropertyModifier({
          asset: propertyAsset,
          expectedAttributeId: definition.expectedAttributeId,
          expectedBucket: definition.expectedBucket,
          expectedValueRaw: definition.expectedValueRaw,
        })
      : null;
    const directSp = directSpAsset
      ? compileRuntimeDirectSp({
          asset: directSpAsset,
          expectedValue: definition.expectedDirectSpValue,
          expectedShareType: definition.expectedShareType,
        })
      : null;
    const requiredHitElementId =
      definition.requiresHitElementId == null
        ? null
        : Number(definition.requiresHitElementId);
    const requiredHitFrame =
      definition.requiresHitFrame == null
        ? null
        : Number(definition.requiresHitFrame);
    const runtimeHitEvidence = [
      ...(control?.hits ?? []),
      ...(control?.elements ?? []).flatMap(element =>
        [...(element.scenarioTriggers ?? []), ...(element.triggers ?? [])].map(
          trigger => ({
            elementId: element.elementId,
            mapIndex: element.mapIndex,
            trigger,
            sourceIdentity: [element.sourceIdentity, trigger.sourceIdentity]
              .filter(Boolean)
              .join('|'),
          })
        )
      ),
    ];
    const hitEvidence =
      triggerKind !== 'action-hit-landed'
        ? null
        : runtimeHitEvidence.filter(
            hit =>
              Number(hit.mapIndex) === Number(definition.subSkillIndex) &&
              Number(hit.elementId) === requiredHitElementId &&
              (requiredHitFrame == null ||
                Number(hit.trigger?.startFrame) === requiredHitFrame)
          );
    const periodicAsset =
      definition.periodicElementId == null
        ? null
        : operators.readElementAsset(definition.periodicElementId);
    const periodic =
      triggerKind === 'action-periodic' && periodicAsset
        ? compileRuntimePeriodicTrigger({
            asset: periodicAsset,
            expectedDurationMs: definition.expectedPeriodicDurationMs,
            expectedIntervalMs: definition.expectedPeriodicIntervalMs,
            expectedTimeExeFirstFrame: definition.expectedTimeExeFirstFrame,
            firstTickFrameOffset: definition.firstTickFrameOffset,
          })
        : null;
    const durationMs = Number(
      definition.durationMs ?? durationAsset?.tree?.time
    );
    if (
      ![
        'conditional-hit-group-applied',
        'action-frame',
        'action-frame-with-state',
        'action-hit-landed',
        'action-periodic',
      ].includes(triggerKind) ||
      (triggerKind === 'conditional-hit-group-applied' && !group) ||
      (triggerKind === 'action-frame' && !control) ||
      (triggerKind === 'action-frame-with-state' &&
        (!control || !stateProfile || !(minimumStacks > 0))) ||
      (triggerKind === 'action-hit-landed' &&
        (!control ||
          !Number.isInteger(requiredHitElementId) ||
          hitEvidence.length === 0)) ||
      (triggerKind === 'action-periodic' && (!control || !periodic)) ||
      !Number.isInteger(triggerFrame) ||
      triggerFrame < 0 ||
      (!modifier && !directSp) ||
      (modifier && !(durationMs > 0))
    ) {
      throw new Error(
        `character combat runtime effect evidence missing: ${ownerId}/${definition.bindingIdentity}`
      );
    }
    return {
      bindingIdentity: String(definition.bindingIdentity),
      ownerId,
      triggerKind,
      conditionalGroupIdentity: group?.groupIdentity ?? null,
      stateIdentity:
        triggerKind === 'action-frame-with-state'
          ? stateProfile.stateIdentity
          : null,
      stateName:
        triggerKind === 'action-frame-with-state' ? stateProfile.name : null,
      minimumStacks,
      controlSkillId: actionTriggerKinds.includes(triggerKind)
        ? Number(definition.controlSkillId)
        : group.controlSkillId,
      subSkillIndex: actionTriggerKinds.includes(triggerKind)
        ? Number(definition.subSkillIndex)
        : group.subSkillIndex,
      triggerFrame,
      frameRate: Number(control?.frameRate ?? group?.frameRate) || 60,
      targetKind: definition.targetKind,
      effectId:
        definition.effectId ??
        `battle-element:${
          propertyAsset?.elementId ?? directSpAsset?.elementId
        }`,
      effectName:
        definition.effectName ??
        propertyAsset?.tree?.elementName ??
        directSpAsset?.tree?.elementName ??
        definition.bindingIdentity,
      durationMs: modifier ? durationMs : (periodic?.durationMs ?? null),
      stackMode: definition.stackMode ?? 'refresh',
      stackDelta: Math.max(1, Number(definition.stackDelta) || 1),
      maxStacks: Math.max(1, Number(definition.maxStacks) || 1),
      modifiers: modifier ? [modifier] : [],
      directSp,
      requiredHitElementId,
      requiredHitFrame,
      periodic,
      inheritance,
      sourceIdentity: [
        propertyAsset?.sourceIdentity,
        directSpAsset?.sourceIdentity,
        periodicAsset?.sourceIdentity,
        ...(hitEvidence ?? []).map(hit => hit.sourceIdentity),
        durationAsset?.sourceIdentity,
        definition.sourceIdentity,
      ]
        .filter(Boolean)
        .join('|'),
      status: 'verified-runtime-effect-binding-ready',
      applied: true,
    };
  });
}

export function compileElementInheritance(asset) {
  if (!asset) return null;
  const teamElementRaw = Number(asset.tree?.inherit);
  const isTeamElement = teamElementRaw === 1;
  const inheritTypeRaw = Number(asset.tree?.inheritType);
  if (!Number.isInteger(inheritTypeRaw) || inheritTypeRaw < 0) {
    throw new Error(
      `character combat element inheritance type invalid: ${asset.elementId}/${asset.tree?.inheritType}`
    );
  }
  if (inheritTypeRaw === 0) {
    return {
      inheritOnControlledActorSwitch: false,
      inheritType: null,
      inheritTypeRaw,
      isTeamElement,
      teamElementRaw,
      containerElementId: Number(asset.elementId),
      containerPathId: asset.pathId ?? null,
      sourceIdentity: asset.sourceIdentity,
      status: 'verified-element-no-controlled-actor-inheritance',
      applied: true,
    };
  }
  const inheritType =
    inheritTypeRaw === 1 ? 'self' : inheritTypeRaw === 2 ? 'source' : null;
  if (!inheritType) {
    throw new Error(
      `character combat element inheritance type unsupported: ${asset.elementId}/${inheritTypeRaw}`
    );
  }
  return {
    inheritOnControlledActorSwitch: true,
    inheritType,
    inheritTypeRaw,
    isTeamElement,
    teamElementRaw,
    containerElementId: Number(asset.elementId),
    containerPathId: asset.pathId ?? null,
    sourceIdentity: asset.sourceIdentity,
    status: 'verified-element-inheritance-ready',
    applied: true,
  };
}

function compileRuntimePropertyModifier({
  asset,
  expectedAttributeId,
  expectedBucket,
  expectedValueRaw,
}) {
  const tree = asset.tree ?? {};
  const attributeId = Number(tree.attributeID);
  const baseFunctionId = Number(tree.formulaParams?.function_2);
  const bucket =
    baseFunctionId === 3
      ? 'dynamicPercent'
      : baseFunctionId === 5
        ? 'dynamicExtra'
        : null;
  const valueRaw = Number(tree.functionParams?.[0]);
  if (
    !Number.isInteger(attributeId) ||
    !bucket ||
    !Number.isFinite(valueRaw) ||
    (expectedAttributeId != null &&
      attributeId !== Number(expectedAttributeId)) ||
    (expectedBucket != null && bucket !== expectedBucket) ||
    (expectedValueRaw != null && valueRaw !== Number(expectedValueRaw))
  ) {
    throw new Error(
      `character combat runtime property evidence mismatch: ${asset.elementId}`
    );
  }
  return {
    kind: 'battle-property',
    attributeId,
    bucket,
    valueRaw,
    propertyTags: [],
    sourceIdentity: `${asset.sourceIdentity}#attributeID=${attributeId};function=${baseFunctionId};A=${valueRaw}`,
  };
}

function compileRuntimeDirectSp({ asset, expectedValue, expectedShareType }) {
  const rawValue = Number(asset.tree?.functionParams?.[0]);
  const baseFunctionId = Number(asset.tree?.formulaParams?.function_2);
  const value =
    baseFunctionId === 3
      ? rawValue / 10_000
      : baseFunctionId === 5
        ? rawValue
        : Number.NaN;
  const shareType = Number(asset.tree?.shareType ?? 0);
  const stopSharing = Number(asset.tree?.stopSharing ?? 0);
  if (
    !Number.isFinite(value) ||
    (expectedValue != null && value !== Number(expectedValue)) ||
    (expectedShareType != null && shareType !== Number(expectedShareType))
  ) {
    throw new Error(
      `character combat runtime direct SP evidence mismatch: ${asset.elementId}`
    );
  }
  return {
    elementId: Number(asset.elementId),
    value,
    enhanceable: false,
    shareType,
    stopSharing: stopSharing === 1,
    sourceIdentity: `${asset.sourceIdentity}#function_2=${baseFunctionId};A=${rawValue};shareType=${shareType};stopSharing=${stopSharing}`,
  };
}

function compileRuntimePeriodicTrigger({
  asset,
  expectedDurationMs,
  expectedIntervalMs,
  expectedTimeExeFirstFrame,
  firstTickFrameOffset,
}) {
  const durationMs = Number(asset.tree?.duration ?? asset.tree?.time);
  const intervalMs = Number(asset.tree?.triggerParam2);
  const timeExeFirstFrame = Number(asset.tree?.timeExeFirstFrame) === 1;
  const resolvedFirstTickFrameOffset = Number(firstTickFrameOffset ?? 1);
  if (
    !(durationMs > 0) ||
    !(intervalMs > 0) ||
    !Number.isInteger(resolvedFirstTickFrameOffset) ||
    resolvedFirstTickFrameOffset < 0 ||
    (expectedDurationMs != null && durationMs !== Number(expectedDurationMs)) ||
    (expectedIntervalMs != null && intervalMs !== Number(expectedIntervalMs)) ||
    (expectedTimeExeFirstFrame != null &&
      timeExeFirstFrame !== Boolean(expectedTimeExeFirstFrame))
  ) {
    throw new Error(
      `character combat runtime periodic evidence mismatch: ${asset.elementId}`
    );
  }
  return {
    elementId: Number(asset.elementId),
    durationMs,
    intervalMs,
    timeExeFirstFrame,
    firstTickFrameOffset: resolvedFirstTickFrameOffset,
    sourceIdentity: `${asset.sourceIdentity}#duration=${durationMs};triggerParam2=${intervalMs};timeExeFirstFrame=${Number(timeExeFirstFrame)}`,
    status: 'verified-runtime-periodic-trigger-ready',
    applied: true,
  };
}

function compileActionHitBindings({ ownerId, definitions, controlBySkillId }) {
  const bindings = definitions.map(definition => {
    requireControl(
      controlBySkillId,
      definition.controlSkillId,
      'action hit target binding'
    );
    const sourceControlSkillId = Number(
      definition.sourceControlSkillId ?? definition.controlSkillId
    );
    const sourceSubSkillIndex = Number(
      definition.sourceSubSkillIndex ?? definition.subSkillIndex
    );
    const sourceControl = requireControl(
      controlBySkillId,
      sourceControlSkillId,
      'action hit source binding'
    );
    const matches = (sourceControl.elements ?? []).filter(
      element =>
        Number(element.mapIndex) === sourceSubSkillIndex &&
        Number(element.elementId) === Number(definition.elementId) &&
        (!definition.sourceReferenceKind ||
          element.referenceKind === definition.sourceReferenceKind)
    );
    const triggerFrames = [
      ...new Set((definition.triggerFrames ?? []).map(Number)),
    ].sort((left, right) => left - right);
    const sourceElement = matches[0];
    if (
      matches.length !== 1 ||
      triggerFrames.length === 0 ||
      triggerFrames.some(frame => !Number.isInteger(frame) || frame < 0) ||
      (!Object.values(sourceElement?.dimensions ?? {}).some(
        dimension => dimension.status === 'applied'
      ) &&
        !definition.formulaNormalization?.applied)
    ) {
      throw new Error(
        `character combat action hit evidence missing: ${ownerId}/${definition.bindingIdentity} ${JSON.stringify(
          {
            matchCount: matches.length,
            matches: matches.map(match => ({
              referenceKind: match.referenceKind,
              pathId: match.pathId,
              scenarioTriggerCount: match.scenarioTriggers?.length ?? 0,
              triggerCount: match.triggers?.length ?? 0,
            })),
            sourceControlSkillId,
            sourceSubSkillIndex,
            elementId: Number(definition.elementId),
            triggerFrames,
            appliedDimensionCount: Object.values(
              sourceElement?.dimensions ?? {}
            ).filter(dimension => dimension.status === 'applied').length,
            formulaNormalizationApplied:
              definition.formulaNormalization?.applied === true,
          }
        )}`
      );
    }
    return {
      bindingIdentity: definition.bindingIdentity,
      ownerId,
      controlSkillId: Number(definition.controlSkillId),
      subSkillIndex: Number(definition.subSkillIndex),
      sourceControlSkillId,
      sourceSubSkillIndex,
      sourceReferenceKind: definition.sourceReferenceKind ?? null,
      targetReferenceKind:
        definition.targetReferenceKind ??
        definition.sourceReferenceKind ??
        null,
      elementId: Number(definition.elementId),
      elementPathId: sourceElement.pathId ?? null,
      triggerFrames,
      frameCount: Math.max(1, Number(definition.frameCount) || 1),
      targetCode: Number(definition.targetCode) || 0,
      targetKind: definition.targetKind ?? 'enemy',
      conditionalGroupIdentity: definition.conditionalGroupIdentity ?? null,
      runtimeCondition: definition.runtimeCondition ?? null,
      hitActivation: null,
      formulaNormalization: definition.formulaNormalization ?? null,
      sourceIdentity: [sourceElement.sourceIdentity, definition.sourceIdentity]
        .filter(Boolean)
        .join('|'),
      status: 'applied',
      applied: true,
    };
  });
  return bindings.map((binding, index) => {
    const definition = definitions[index];
    if (!definition.hitActivation) return binding;
    const control = requireControl(
      controlBySkillId,
      definition.controlSkillId,
      'action hit activation binding'
    );
    const hitActivation = compileActionEffectHitActivation({
      ownerId,
      definition: {
        ...definition.hitActivation,
        elementId: Number(
          definition.hitActivation.elementId ??
            definition.hitActivation.sourceElementId
        ),
      },
      control,
      subSkillIndex: definition.subSkillIndex,
      actionHitBindings: bindings,
      sourceReferenceKind: definition.hitActivation.sourceReferenceKind ?? null,
    });
    return {
      ...binding,
      hitActivation,
      sourceIdentity: [binding.sourceIdentity, hitActivation?.sourceIdentity]
        .filter(Boolean)
        .join('|'),
    };
  });
}

function compileTuningMarkConditionalDamageGroups({
  ownerId,
  definitions,
  controlBySkillId,
  tuningMarkProfiles,
  operators,
}) {
  return definitions.map(definition =>
    compileTuningMarkConditionalDamageGroup({
      ownerId,
      definition,
      controlBySkillId,
      tuningMarkProfiles,
      operators,
      requireSourceControl: true,
    })
  );
}

function compileTuningMarkConditionalDamageGroup({
  ownerId,
  definition,
  controlBySkillId,
  tuningMarkProfiles,
  operators,
  requireSourceControl,
}) {
  const groupIdentity = String(definition.groupIdentity ?? '').trim();
  const controlSkillId = Number(definition.controlSkillId);
  const subSkillIndex = Number(definition.subSkillIndex);
  if (requireSourceControl) {
    requireControl(
      controlBySkillId,
      controlSkillId,
      'tuning mark conditional damage group'
    );
  }
  const profile = (tuningMarkProfiles ?? []).find(
    candidate =>
      (candidate.profileKey ?? candidate.key) ===
      definition.tuningMarkProfileKey
  );
  const judgment = operators.readElementAsset(definition.judgmentElementId);
  const base = operators.readElementAsset(definition.baseElementId);
  const enhanced = operators.readElementAsset(definition.enhancedElementId);
  const triggerFrames = [
    ...new Set((definition.triggerFrames ?? []).map(Number)),
  ].sort((left, right) => left - right);
  const hitDelaysMs = (definition.hitDelaysMs ?? [0]).map(Number);
  const markId = Number(profile?.markId);
  const minimumStacks = Number(judgment?.tree?.consumeLayerNum);
  const basePathIds = readElementPathIds(
    judgment?.tree?.injectElementDataList_1
  );
  const enhancedPathIds = readElementPathIds(
    judgment?.tree?.injectElementDataList_2
  );
  if (
    !groupIdentity ||
    !Number.isInteger(controlSkillId) ||
    !Number.isInteger(subSkillIndex) ||
    subSkillIndex < 0 ||
    !profile?.applied ||
    !judgment ||
    !base ||
    !enhanced ||
    Number(judgment.tree?.judgmentType) !== 5 ||
    !Array.isArray(judgment.tree?.elementArr) ||
    !judgment.tree.elementArr.map(Number).includes(markId) ||
    !Number.isInteger(minimumStacks) ||
    minimumStacks <= 0 ||
    Number(judgment.tree?.canConsume) !== 0 ||
    !basePathIds.includes(String(base.pathId)) ||
    !enhancedPathIds.includes(String(enhanced.pathId)) ||
    triggerFrames.length === 0 ||
    triggerFrames.some(frame => !Number.isInteger(frame) || frame < 0) ||
    hitDelaysMs.length === 0 ||
    hitDelaysMs.some(delay => !Number.isFinite(delay) || delay < 0)
  ) {
    throw new Error(
      `character combat tuning mark conditional damage evidence missing: ${ownerId}/${groupIdentity || definition.judgmentElementId}`
    );
  }
  return {
    groupIdentity,
    ownerId,
    controlSkillId,
    subSkillIndex,
    triggerFrames,
    hitDelaysMs,
    frameRate: Number(definition.frameRate) || 60,
    targetKind: definition.targetKind ?? 'enemy',
    judgmentElementId: Number(definition.judgmentElementId),
    tuningMarkProfileKey: profile.profileKey ?? profile.key,
    markId,
    minimumStacks,
    consumesStacks: false,
    baseTemplate: compileConditionalDamageTemplate(base),
    enhancedTemplate: compileConditionalDamageTemplate(enhanced),
    sourceIdentity: [
      judgment.sourceIdentity,
      base.sourceIdentity,
      enhanced.sourceIdentity,
      definition.sourceIdentity,
    ]
      .filter(Boolean)
      .join('|'),
    status: 'verified-tuning-mark-conditional-damage-group-ready',
    applied: true,
  };
}

function compileConditionalDamageTemplate(asset) {
  const tree = asset.tree ?? {};
  const formulaValues =
    tree.formulaParams?.formulaParamValues ?? tree.functionParams ?? [];
  const coefficientRaw = Number(formulaValues[1]);
  if (!Number.isInteger(coefficientRaw) || coefficientRaw < 0) {
    throw new Error(
      `character combat conditional damage coefficient invalid: ${asset.elementId}`
    );
  }
  return {
    elementConfigId: Number(asset.elementId),
    pathId: String(asset.pathId),
    name: tree.elementName ?? null,
    damageType: Number(tree.damageType),
    elementalType: Number(tree.damageElementalType),
    coefficientRaw,
    weakBreakDamageRateBasisPoints: finiteNumberOrNull(
      tree.weakBreakDamageRate
    ),
    physicalPenetrationBasisPoints: finiteNumberOrNull(tree.armerPenetration),
    magicPenetrationBasisPoints: finiteNumberOrNull(tree.magicPenetration),
    elementCalculationFactorBasisPoints: finiteNumberOrNull(
      tree.elementCalFactor
    ),
    physicalRatioBasisPoints: finiteNumberOrNull(tree.physicalRatio),
    magicRatioBasisPoints: finiteNumberOrNull(tree.magicRatio),
    propertyTags: (tree.defaultPropertyTags ?? [])
      .map(Number)
      .filter(Number.isInteger),
    elementTypes: [...new Set((tree.types ?? []).map(Number))]
      .filter(Number.isInteger)
      .sort((left, right) => left - right),
    sourceIdentity: asset.sourceIdentity,
  };
}

function readElementPathIds(entries) {
  return (entries ?? [])
    .map(entry => String(entry?.m_PathID ?? ''))
    .filter(value => /^-?\d+$/.test(value));
}

function finiteNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function compileThresholdTransitions({
  ownerId,
  definitions,
  resourceProfiles,
  resourceOperations,
  tuningMarkProfiles,
  controlBySkillId,
  operators,
}) {
  return definitions.map(definition => {
    const profile = resourceProfiles.find(
      item => Number(item.elementId) === Number(definition.resourceElementId)
    );
    const state = profile?.stateElements?.find(
      item => Number(item.elementId) === Number(definition.stateElementId)
    );
    const resourceAsset = operators.readElementAsset(
      definition.resourceElementId
    );
    const stateAsset = operators.readElementAsset(definition.stateElementId);
    if (!profile || !state || !resourceAsset || !stateAsset) {
      throw new Error(
        `character combat threshold evidence missing: ${ownerId}/${definition.resourceElementId}/${definition.stateElementId}`
      );
    }
    const suppressedOperationIdentities = resourceOperations
      .filter(operation =>
        (definition.suppressedOperationSelectors ?? []).some(
          selector =>
            Number(operation.controlSkillId) ===
              Number(selector.controlSkillId) &&
            Number(operation.subSkillIndex) ===
              Number(selector.subSkillIndex) &&
            selector.operations.includes(operation.operation)
        )
      )
      .map(operation => operation.operationIdentity)
      .sort();
    const tuningMarkGrants = (definition.tuningMarkGrants ?? []).map(grant => {
      const profile = tuningMarkProfiles.find(
        item => item.key === grant.profileKey
      );
      const markAsset = profile
        ? operators.readElementAsset(profile.markId)
        : null;
      const sourceEntries = stateAsset.tree?.[grant.sourceField];
      if (!profile || !markAsset || !Array.isArray(sourceEntries)) {
        throw new Error(
          `character combat threshold tuning mark evidence missing: ${ownerId}/${definition.stateElementId}/${grant.profileKey}`
        );
      }
      const markPathId = String(markAsset.pathId);
      const sourcePathIds = sourceEntries
        .map(entry => String(entry?.m_PathID ?? ''))
        .filter(value => /^-?\d+$/.test(value));
      const stackDelta = sourcePathIds.filter(
        pathId => pathId === markPathId
      ).length;
      if (
        stackDelta <= 0 ||
        (Number.isInteger(Number(grant.expectedMultiplicity)) &&
          stackDelta !== Number(grant.expectedMultiplicity))
      ) {
        throw new Error(
          `character combat threshold tuning mark multiplicity mismatch: ${ownerId}/${definition.stateElementId}/${grant.profileKey}/${stackDelta}`
        );
      }
      return {
        profileKey: profile.key,
        markId: profile.markId,
        stackDelta,
        sourceField: grant.sourceField,
        markPathId,
        sourceIdentity: [
          `${stateAsset.sourceIdentity}#${grant.sourceField}[m_PathID=${markPathId}]x${stackDelta}`,
          markAsset.sourceIdentity,
          grant.sourceIdentity,
        ]
          .filter(Boolean)
          .join('|'),
        status: 'verified-threshold-tuning-mark-grant-ready',
        applied: true,
      };
    });
    const effectGrants = (definition.effectGrants ?? []).map(grant =>
      compileThresholdEffectGrant({
        ownerId,
        stateAsset,
        grant,
        operators,
      })
    );
    const companionProfile = definition.companionProfile
      ? compileThresholdCompanionProfile({
          ownerId,
          definition: definition.companionProfile,
          stateDurationMs: state.durationMs,
          controlBySkillId,
          tuningMarkProfiles,
          operators,
        })
      : null;
    return {
      transitionIdentity: [
        profile.resourceIdentity,
        'threshold',
        profile.capacity,
        definition.stateElementId,
      ].join('|'),
      ownerId,
      resourceIdentity: profile.resourceIdentity,
      threshold: profile.capacity,
      comparison: definition.comparison,
      resourceOperation: definition.resourceOperation,
      suppressGainWhileStateActive:
        definition.suppressGainWhileStateActive === true,
      suppressedOperationIdentities,
      stateElementId: definition.stateElementId,
      stateName: state.name,
      stateDurationMs: state.durationMs,
      tuningMarkGrants,
      effectGrants,
      companionProfile,
      sourceIdentity: [
        resourceAsset.sourceIdentity,
        `${resourceAsset.sourceIdentity}#combineType=${resourceAsset.tree?.combineType};combineNumber=${resourceAsset.tree?.combineNumber}`,
        stateAsset.sourceIdentity,
        `${stateAsset.sourceIdentity}#time=${stateAsset.tree?.time}`,
        definition.runtimeSourceIdentity,
        ...tuningMarkGrants.map(grant => grant.sourceIdentity),
        ...effectGrants.map(grant => grant.sourceIdentity),
        companionProfile?.sourceIdentity,
      ]
        .filter(Boolean)
        .join('|'),
      status: 'verified-special-resource-threshold-transition-ready',
      applied: true,
    };
  });
}

function compileThresholdEffectGrant({
  ownerId,
  stateAsset,
  grant,
  operators,
}) {
  const asset = operators.readElementAsset(grant.elementId);
  const sourceEntries = stateAsset.tree?.[grant.sourceField];
  const sourcePathIds = readElementPathIds(sourceEntries);
  const multiplicity = asset
    ? sourcePathIds.filter(pathId => pathId === String(asset.pathId)).length
    : 0;
  const tree = asset?.tree;
  const formulaId = Number(tree?.formulaParams?.function_2);
  const bucket =
    {
      3: 'dynamicPercent',
      5: 'dynamicExtra',
    }[formulaId] ?? null;
  const valueRaw = Number(
    tree?.formulaParams?.formulaParamValues?.[0] ?? tree?.functionParams?.[0]
  );
  const propertyTags = (tree?.defaultPropertyTags ?? [])
    .map(Number)
    .filter(Number.isInteger);
  if (
    !asset ||
    !Array.isArray(sourceEntries) ||
    multiplicity <= 0 ||
    (grant.expectedMultiplicity != null &&
      multiplicity !== Number(grant.expectedMultiplicity)) ||
    (grant.expectedDurationMs != null &&
      Number(tree.time) !== Number(grant.expectedDurationMs)) ||
    (grant.expectedAttributeId != null &&
      Number(tree.attributeID) !== Number(grant.expectedAttributeId)) ||
    (grant.expectedBucket != null && bucket !== grant.expectedBucket) ||
    (grant.expectedValueRaw != null &&
      valueRaw !== Number(grant.expectedValueRaw)) ||
    (grant.expectedPropertyTags != null &&
      JSON.stringify(propertyTags) !==
        JSON.stringify(grant.expectedPropertyTags.map(Number)))
  ) {
    throw new Error(
      `character combat threshold effect grant evidence missing: ${ownerId}/${grant.elementId}`
    );
  }
  return {
    effectId: `battle-element:${Number(grant.elementId)}`,
    elementId: Number(grant.elementId),
    pathId: String(asset.pathId),
    name: tree.elementName ?? null,
    durationMs: Number(tree.time),
    stackMode: 'refresh',
    maxStacks: 1,
    sourceField: grant.sourceField,
    multiplicity,
    modifiers: [
      {
        kind: 'battle-property',
        attributeId: Number(tree.attributeID),
        bucket,
        valueRaw,
        propertyTags,
        sourceIdentity: asset.sourceIdentity,
      },
    ],
    sourceIdentity: [
      `${stateAsset.sourceIdentity}#${grant.sourceField}[m_PathID=${asset.pathId}]x${multiplicity}`,
      asset.sourceIdentity,
      grant.sourceIdentity,
    ]
      .filter(Boolean)
      .join('|'),
    status: 'verified-threshold-effect-grant-ready',
    applied: true,
  };
}

function compileThresholdCompanionProfile({
  ownerId,
  definition,
  stateDurationMs,
  controlBySkillId,
  tuningMarkProfiles,
  operators,
}) {
  if (typeof operators.readNewTableRows !== 'function') {
    throw new Error('character combat companion NewTable operator missing');
  }
  const summon = operators.readElementAsset(definition.summonElementId);
  const unitId = Number(definition.unitId);
  const unitRows = operators.readNewTableRows('battlefield_item', 'id', unitId);
  const unitRow = unitRows.length === 1 ? unitRows[0] : null;
  const skillIds = String(unitRow?.skillList ?? '')
    .split('|')
    .map(entry => Number(entry.split('#')[1]))
    .filter(Number.isInteger);
  const periodicDefinition = definition.periodicAttack;
  const periodicSkillId = Number(periodicDefinition?.skillId);
  const periodicLogicRows = operators.readNewTableRows(
    'skillsub_logic',
    'skillId',
    periodicSkillId
  );
  const periodicLogic =
    periodicLogicRows.length === 1 ? periodicLogicRows[0] : null;
  const cadenceMs = Number(periodicLogic?.aiTokenResetCD) * 1000;
  const periodicAttack = compileCompanionAttackProfile({
    ownerId,
    definition: periodicDefinition,
    controlBySkillId,
    tuningMarkProfiles,
    operators,
    cadenceMs,
  });
  const actionResponses = (definition.actionResponses ?? []).map(response =>
    compileCompanionAttackProfile({
      ownerId,
      definition: response,
      controlBySkillId,
      tuningMarkProfiles,
      operators,
      cadenceMs: null,
    })
  );
  const tree = summon?.tree;
  if (
    !summon ||
    Number(tree?.summonUnitId) !== unitId ||
    Number(tree?.summonLifeTime) !== Number(stateDurationMs) ||
    Number(tree?.summonCount) !== 1 ||
    Number(tree?.summonTotalMaxCount) !== 1 ||
    !unitRow ||
    unitRow.param !== definition.expectedBornParam ||
    !skillIds.includes(periodicSkillId) ||
    !periodicLogic ||
    Number(periodicLogic.aiToken) !== 1 ||
    Number(periodicLogic.aiTokenType) !== 1 ||
    cadenceMs !== Number(periodicDefinition.cadenceMs) ||
    Number(periodicDefinition.initialDelayMs) !== cadenceMs
  ) {
    throw new Error(
      `character combat threshold companion evidence missing: ${ownerId}/${definition.companionIdentity}`
    );
  }
  return {
    companionIdentity: String(definition.companionIdentity),
    ownerId,
    summonElementId: Number(definition.summonElementId),
    unitId,
    durationMs: Number(tree.summonLifeTime),
    maximumCount: Number(tree.summonTotalMaxCount),
    dieWithOwner: Number(tree.dieWithOwner) === 1,
    dieWithChangeHero: Number(tree.dieWithChangeHero) === 1,
    dieWithOutBattle: Number(tree.dieWithOutBattle) === 1,
    ownership: 'summoning-actor',
    targetKind: 'enemy',
    periodicAttack,
    actionResponses,
    sourceIdentity: [
      summon.sourceIdentity,
      `NewTable/battlefield_item.rows[id=${unitId}]#param=${unitRow.param};skillList=${unitRow.skillList}`,
      `NewTable/skillsub_logic.rows[skillId=${periodicSkillId}]#aiToken=${periodicLogic.aiToken};aiTokenResetCD=${periodicLogic.aiTokenResetCD};aiTokenType=${periodicLogic.aiTokenType}`,
      definition.sourceIdentity,
    ]
      .filter(Boolean)
      .join('|'),
    status: 'verified-threshold-companion-profile-ready',
    applied: true,
  };
}

function compileCompanionAttackProfile({
  ownerId,
  definition,
  controlBySkillId,
  tuningMarkProfiles,
  operators,
  cadenceMs,
}) {
  const skillId = Number(definition.skillId);
  requireControl(controlBySkillId, skillId, 'companion attack profile');
  if (definition.sourceControlSkillId != null) {
    requireControl(
      controlBySkillId,
      definition.sourceControlSkillId,
      'companion response source'
    );
  }
  const conditionalDamageGroup = compileTuningMarkConditionalDamageGroup({
    ownerId,
    definition: {
      ...definition.conditionalDamageGroup,
      controlSkillId: skillId,
      subSkillIndex: Number(definition.subSkillIndex),
      triggerFrames: definition.triggerFrames,
      hitDelaysMs: definition.hitDelaysMs,
    },
    controlBySkillId,
    tuningMarkProfiles,
    operators,
    requireSourceControl: true,
  });
  return {
    attackIdentity: String(definition.attackIdentity),
    skillId,
    subSkillIndex: Number(definition.subSkillIndex),
    sourceControlSkillId:
      definition.sourceControlSkillId == null
        ? null
        : Number(definition.sourceControlSkillId),
    sourceSubSkillIndex:
      definition.sourceSubSkillIndex == null
        ? null
        : Number(definition.sourceSubSkillIndex),
    initialDelayMs:
      definition.initialDelayMs == null
        ? null
        : Number(definition.initialDelayMs),
    cadenceMs,
    cancelPeriodicOnStart: definition.cancelPeriodicOnStart === true,
    endsCompanionAtFrame:
      definition.endsCompanionAtFrame == null
        ? null
        : Number(definition.endsCompanionAtFrame),
    conditionalDamageGroup,
    sourceIdentity: [
      conditionalDamageGroup.sourceIdentity,
      definition.sourceIdentity,
    ]
      .filter(Boolean)
      .join('|'),
    status: 'verified-companion-attack-profile-ready',
    applied: true,
  };
}

function compilePassiveEffects({
  ownerId,
  definitions,
  controls,
  controlBySkillId,
  skills,
  targetStateTransactions,
  runtimeEffectBindings,
  tuningMarkProfiles,
  operators,
}) {
  return definitions.map(definition => {
    if (
      definition.runtimeGenerationMode ===
      'tuning-mark-threshold-property-runtime'
    ) {
      return compileTuningMarkThresholdPassiveEffect({
        ownerId,
        definition,
        controlBySkillId,
        skills,
        tuningMarkProfiles,
        operators,
      });
    }
    if (definition.runtimeGenerationMode === 'target-state-runtime') {
      return compileTargetStateRuntimePassiveEffect({
        ownerId,
        definition,
        controlBySkillId,
        skills,
        targetStateTransactions,
        runtimeEffectBindings,
        operators,
      });
    }
    if (definition.runtimeGenerationMode === 'persistent-property-runtime') {
      return compilePersistentPropertyPassiveEffect({
        ownerId,
        definition,
        controlBySkillId,
        skills,
        operators,
      });
    }
    if (
      ['semantic-effect-catalog', 'action-variant-runtime'].includes(
        definition.runtimeGenerationMode
      )
    ) {
      return compileSemanticCatalogPassiveEffect({
        ownerId,
        definition,
        controls,
        controlBySkillId,
        skills,
        operators,
      });
    }
    const passiveControl = controlBySkillId.get(Number(definition.skillId));
    const marker = operators.readElementAsset(definition.markerElementId);
    const wrapper = operators.readElementAsset(definition.wrapperElementId);
    const property = operators.readElementAsset(definition.propertyElementId);
    const directTriggers = [];
    for (const control of controls) {
      if (Number(operators.resolveControlOwnerId(control)) !== ownerId)
        continue;
      for (const root of control.effectGraph ?? []) {
        const node = root.nodes?.find(
          item => Number(item.elementId) === Number(definition.wrapperElementId)
        );
        if (!node) continue;
        for (const trigger of operators.createSemanticRootTriggers(
          control,
          root
        )) {
          if (
            trigger.resolution !== 'static-resolved' ||
            !Number.isInteger(trigger.startFrame)
          ) {
            continue;
          }
          directTriggers.push({
            triggerIdentity: [
              definition.skillId,
              control.controlSkillId,
              root.mapIndex,
              trigger.startFrame,
              node.pathId,
            ].join('|'),
            controlSkillId: control.controlSkillId,
            subSkillIndex: root.mapIndex,
            triggerFrame: trigger.startFrame,
            frameRate: control.frameRate ?? 60,
            sourceElementId: node.elementId,
            sourcePathId: node.pathId,
            sourceIdentity: [
              root.sourceIdentity,
              node.sourceIdentity,
              trigger.sourceIdentity,
            ]
              .filter(Boolean)
              .join('|'),
            status: 'verified-passive-trigger-binding-ready',
            applied: true,
          });
        }
      }
    }
    if ((definition.publicTriggerAliases ?? []).length > 0) {
      throw new Error(
        `character combat passive public trigger aliases cannot infer derived execution: ${ownerId}/${definition.skillId}`
      );
    }
    const triggerBindings = dedupeBy(
      directTriggers,
      item => item.triggerIdentity
    ).sort(
      (left, right) =>
        left.controlSkillId - right.controlSkillId ||
        left.subSkillIndex - right.subSkillIndex ||
        left.triggerFrame - right.triggerFrame
    );
    const unresolvedTriggerBindings = (
      definition.unresolvedTriggerAliases ?? []
    ).map(alias => {
      const runtimeTrigger = directTriggers.find(
        trigger =>
          Number(trigger.controlSkillId) === Number(alias.runtimeControlSkillId)
      );
      return {
        triggerIdentity: [
          definition.skillId,
          alias.publicControlSkillId,
          'runtime-control',
          alias.runtimeControlSkillId,
        ].join('|'),
        controlSkillId: alias.publicControlSkillId,
        runtimeControlSkillId: alias.runtimeControlSkillId,
        status: 'static-evidence-gap',
        reasons: [alias.reason],
        sourceIdentity: runtimeTrigger
          ? [
              `skill_control_${alias.publicControlSkillId}.asset`,
              runtimeTrigger.sourceIdentity,
            ].join('|')
          : null,
        applied: false,
      };
    });
    const modifiers = (property?.tree?.changePeopertyConditionArrayDatas ?? [])
      .map(entry => entry?.changeProperty)
      .filter(Boolean)
      .map(change => ({
        attributeId: Number(change.attributeID),
        bucket:
          Number(change.calculateType) === 2 && Number(change.functionId) === 3
            ? 'dynamicPercent'
            : null,
        valueRaw: Number(change.functionParams?.[0]),
        calculateType: Number(change.calculateType),
        functionId: Number(change.functionId),
        propertyTags: change.propertyTags ?? [],
        sourceIdentity: `${property?.sourceIdentity}#changePeopertyConditionArrayDatas[attributeID=${change.attributeID}]`,
      }));
    const applied =
      passiveControl != null &&
      marker != null &&
      wrapper != null &&
      property != null &&
      Number(wrapper.tree?.time) === Number(definition.expectedDurationMs) &&
      Number(wrapper.tree?.combineNumber) ===
        Number(definition.expectedMaxStacks) &&
      triggerBindings.length > 0 &&
      modifiers.length === Number(definition.expectedModifierCount) &&
      modifiers.every(
        modifier =>
          modifier.bucket === 'dynamicPercent' &&
          Number.isFinite(modifier.valueRaw)
      );
    return {
      passiveIdentity: `actor:${ownerId}:passive:${definition.skillId}`,
      ownerId,
      skillId: definition.skillId,
      name:
        skills.find(skill => Number(skill.id) === Number(definition.skillId))
          ?.name ?? `被动 ${definition.skillId}`,
      effectId: `battle-element:${definition.wrapperElementId}`,
      effectElementId: definition.wrapperElementId,
      markerElementId: definition.markerElementId,
      propertyElementId: definition.propertyElementId,
      durationMs: Number(wrapper?.tree?.time) || null,
      stackMode: 'stack',
      maxStacks: Number(wrapper?.tree?.combineNumber) || null,
      stackDelta: 1,
      triggerBindings,
      unresolvedTriggerBindings,
      modifiers,
      sourceIdentity: [
        passiveControl?.sourcePath,
        marker?.sourceIdentity,
        wrapper?.sourceIdentity,
        property?.sourceIdentity,
      ]
        .filter(Boolean)
        .join('|'),
      status: applied
        ? 'verified-passive-effect-profile-ready'
        : 'unresolved-passive-effect-profile',
      reasons: [
        ...(passiveControl ? [] : ['passive-skill-control-missing']),
        ...(marker ? [] : ['passive-marker-element-missing']),
        ...(wrapper ? [] : ['passive-wrapper-element-missing']),
        ...(property ? [] : ['passive-property-element-missing']),
        ...(triggerBindings.length > 0
          ? []
          : ['passive-trigger-bindings-missing']),
        ...(modifiers.length === Number(definition.expectedModifierCount)
          ? []
          : ['passive-property-change-count-mismatch']),
        ...(modifiers.every(item => item.bucket === 'dynamicPercent')
          ? []
          : ['passive-property-formula-not-verified-percent']),
      ],
      applied,
    };
  });
}

function compileTuningMarkThresholdPassiveEffect({
  ownerId,
  definition,
  controlBySkillId,
  skills,
  tuningMarkProfiles,
  operators,
}) {
  const passiveControl = controlBySkillId.get(Number(definition.skillId));
  const profile = (tuningMarkProfiles ?? []).find(
    candidate =>
      (candidate.profileKey ?? candidate.key) ===
      definition.tuningMarkProfileKey
  );
  const property = operators.readElementAsset(definition.propertyElementId);
  const tree = property?.tree;
  const formulaId = Number(tree?.formulaParams?.function_2);
  const bucket =
    {
      3: 'dynamicPercent',
      5: 'dynamicExtra',
    }[formulaId] ?? null;
  const valueRaw = Number(
    tree?.formulaParams?.formulaParamValues?.[0] ?? tree?.functionParams?.[0]
  );
  const minimumStacks = Number(definition.minimumStacks);
  const propertyTags = (tree?.defaultPropertyTags ?? [])
    .map(Number)
    .filter(Number.isInteger);
  const applied =
    passiveControl != null &&
    profile?.applied === true &&
    property != null &&
    Number.isInteger(minimumStacks) &&
    minimumStacks > 0 &&
    minimumStacks <= Number(profile.maxStacks) &&
    (definition.expectedDurationMs == null ||
      Number(tree.time) === Number(definition.expectedDurationMs)) &&
    (definition.expectedAttributeId == null ||
      Number(tree.attributeID) === Number(definition.expectedAttributeId)) &&
    (definition.expectedBucket == null ||
      bucket === definition.expectedBucket) &&
    (definition.expectedValueRaw == null ||
      valueRaw === Number(definition.expectedValueRaw));
  return {
    passiveIdentity: `actor:${ownerId}:passive:${definition.skillId}`,
    ownerId,
    skillId: Number(definition.skillId),
    name:
      skills.find(skill => Number(skill.id) === Number(definition.skillId))
        ?.name ?? `被动 ${definition.skillId}`,
    effectId: `battle-element:${Number(definition.propertyElementId)}`,
    effectElementId: Number(definition.propertyElementId),
    markerElementId: Number(profile?.markId) || null,
    propertyElementId: Number(definition.propertyElementId),
    durationMs: null,
    stackMode: 'refresh',
    maxStacks: 1,
    stackDelta: 1,
    runtimeGenerationMode: 'tuning-mark-threshold-property-runtime',
    tuningMarkProfileKey: profile?.profileKey ?? profile?.key ?? null,
    markId: Number(profile?.markId) || null,
    minimumStacks,
    triggerBindings: [],
    unresolvedTriggerBindings: [],
    modifiers: property
      ? [
          {
            kind: 'battle-property',
            attributeId: Number(tree.attributeID),
            bucket,
            valueRaw,
            propertyTags,
            sourceIdentity: property.sourceIdentity,
          },
        ]
      : [],
    sourceIdentity: [
      passiveControl?.sourcePath,
      profile?.sourceIdentity,
      property?.sourceIdentity,
      definition.sourceIdentity,
    ]
      .filter(Boolean)
      .join('|'),
    status: applied
      ? 'verified-tuning-mark-threshold-passive-profile-ready'
      : 'unresolved-tuning-mark-threshold-passive-profile',
    reasons: [
      ...(passiveControl ? [] : ['passive-skill-control-missing']),
      ...(profile?.applied ? [] : ['passive-tuning-mark-profile-missing']),
      ...(property ? [] : ['passive-property-element-missing']),
      ...(applied ? [] : ['passive-threshold-property-evidence-mismatch']),
    ],
    applied,
  };
}

function compileTargetStateRuntimePassiveEffect({
  ownerId,
  definition,
  controlBySkillId,
  skills,
  targetStateTransactions,
  runtimeEffectBindings,
  operators,
}) {
  const passiveControl = controlBySkillId.get(Number(definition.skillId));
  const sourceOnlyPassiveEvidence =
    !passiveControl && typeof definition.sourceOnlyPassiveEvidence === 'string'
      ? definition.sourceOnlyPassiveEvidence.trim()
      : '';
  const sourceAssets = (definition.sourceElementIds ?? []).map(elementId =>
    operators.readElementAsset(Number(elementId))
  );
  const selectedRuntimeBindings = (
    definition.runtimeBindingIdentities ?? []
  ).map(identity =>
    runtimeEffectBindings.find(binding => binding.bindingIdentity === identity)
  );
  const selectedTransactions = (
    definition.targetStateTransactionIdentities ?? []
  ).map(identity =>
    targetStateTransactions.find(
      transaction => transaction.transactionIdentity === identity
    )
  );
  const triggerBindings = [
    ...selectedRuntimeBindings.filter(Boolean).map(binding => ({
      triggerIdentity: `runtime-effect:${binding.bindingIdentity}`,
      controlSkillId: binding.controlSkillId,
      subSkillIndex: binding.subSkillIndex,
      triggerFrame: binding.triggerFrame,
      frameRate: binding.frameRate,
      conditionalGroupIdentity: binding.conditionalGroupIdentity,
      sourceIdentity: binding.sourceIdentity,
      status: 'verified-target-state-passive-runtime-trigger-ready',
      applied: true,
    })),
    ...selectedTransactions.filter(Boolean).map(transaction => ({
      triggerIdentity: `target-state:${transaction.transactionIdentity}`,
      controlSkillId: transaction.controlSkillId,
      subSkillIndex: transaction.subSkillIndex,
      triggerFrame: transaction.triggerFrame,
      frameRate: transaction.frameRate,
      requiresHitElementId: transaction.requiresHitElementId,
      sourceIdentity: transaction.sourceIdentity,
      status: 'verified-target-state-passive-transaction-trigger-ready',
      applied: true,
    })),
  ];
  const modifiers = dedupeBy(
    [
      ...selectedRuntimeBindings
        .filter(Boolean)
        .flatMap(binding => binding.modifiers ?? []),
      ...selectedRuntimeBindings
        .filter(binding => binding?.directSp)
        .map(binding => ({
          kind: 'direct-sp',
          value: Number(binding.directSp.value),
          shareType: Number(binding.directSp.shareType),
          stopSharing: binding.directSp.stopSharing === true,
          sourceIdentity: binding.directSp.sourceIdentity,
        })),
      ...selectedTransactions.filter(Boolean).map(transaction => ({
        kind: 'target-state',
        stateIdentity: transaction.stateIdentity,
        operation: transaction.operation,
        amount: transaction.amount,
        durationMs: transaction.durationMs,
        sourceIdentity: transaction.sourceIdentity,
      })),
    ],
    modifier =>
      [
        modifier.kind,
        modifier.attributeId ?? '',
        modifier.bucket ?? '',
        modifier.valueRaw ?? '',
        modifier.stateIdentity ?? '',
        modifier.operation ?? '',
        modifier.amount ?? '',
      ].join('|')
  );
  const expectedRuntimeBindingCount = (
    definition.runtimeBindingIdentities ?? []
  ).length;
  const expectedTransactionCount = (
    definition.targetStateTransactionIdentities ?? []
  ).length;
  const applied =
    (passiveControl != null || Boolean(sourceOnlyPassiveEvidence)) &&
    sourceAssets.length > 0 &&
    sourceAssets.every(Boolean) &&
    selectedRuntimeBindings.filter(Boolean).length ===
      expectedRuntimeBindingCount &&
    selectedTransactions.filter(Boolean).length === expectedTransactionCount &&
    triggerBindings.length > 0 &&
    modifiers.length > 0;
  return {
    passiveIdentity: `actor:${ownerId}:passive:${definition.skillId}`,
    ownerId,
    skillId: Number(definition.skillId),
    name:
      skills.find(skill => Number(skill.id) === Number(definition.skillId))
        ?.name ?? `被动 ${definition.skillId}`,
    effectId:
      definition.effectId ??
      `battle-element:${Number(definition.sourceElementIds?.[0])}`,
    effectElementId:
      Number(definition.effectElementId) ||
      Number(definition.sourceElementIds?.[0]),
    markerElementId:
      Number(definition.markerElementId) ||
      Number(definition.sourceElementIds?.[0]),
    propertyElementId:
      Number(definition.propertyElementId) ||
      Number(definition.sourceElementIds?.at(-1)),
    durationMs:
      Number(definition.durationMs) ||
      Math.max(
        0,
        ...selectedRuntimeBindings
          .filter(Boolean)
          .map(binding => Number(binding.durationMs) || 0),
        ...selectedTransactions
          .filter(Boolean)
          .map(transaction => Number(transaction.durationMs) || 0)
      ) ||
      null,
    stackMode: definition.stackMode ?? 'refresh',
    maxStacks: Math.max(1, Number(definition.maxStacks) || 1),
    stackDelta: Math.max(1, Number(definition.stackDelta) || 1),
    runtimeGenerationMode: 'target-state-runtime',
    triggerBindings,
    unresolvedTriggerBindings: [],
    modifiers,
    sourceIdentity: [
      passiveControl?.sourcePath,
      sourceOnlyPassiveEvidence,
      ...sourceAssets.filter(Boolean).map(asset => asset.sourceIdentity),
      ...triggerBindings.map(trigger => trigger.sourceIdentity),
      definition.sourceIdentity,
    ]
      .filter(Boolean)
      .join('|'),
    status: applied
      ? 'verified-target-state-runtime-passive-profile-ready'
      : 'unresolved-target-state-runtime-passive-profile',
    reasons: [
      ...(passiveControl || sourceOnlyPassiveEvidence
        ? []
        : ['passive-skill-control-missing']),
      ...(sourceAssets.length > 0 && sourceAssets.every(Boolean)
        ? []
        : ['passive-source-element-missing']),
      ...(selectedRuntimeBindings.filter(Boolean).length ===
      expectedRuntimeBindingCount
        ? []
        : ['passive-runtime-binding-missing']),
      ...(selectedTransactions.filter(Boolean).length ===
      expectedTransactionCount
        ? []
        : ['passive-target-state-transaction-missing']),
      ...(triggerBindings.length > 0
        ? []
        : ['passive-runtime-trigger-missing']),
      ...(modifiers.length > 0 ? [] : ['passive-runtime-output-missing']),
    ],
    applied,
  };
}

function applyActionEffectActivationBinding(effect, binding) {
  return {
    ...effect,
    targetStateActivationCondition:
      binding.targetStateActivationCondition ?? null,
    sourceIdentity: [effect.sourceIdentity, binding.sourceIdentity]
      .filter(Boolean)
      .join('|'),
    classification: 'applied',
    reasons: [],
    status: 'verified-action-effect-activation-condition-applied',
    confidence: 'high',
    applied: true,
  };
}

function compilePersistentPropertyPassiveEffect({
  ownerId,
  definition,
  controlBySkillId,
  skills,
  operators,
}) {
  const passiveControl = controlBySkillId.get(Number(definition.skillId));
  const sourceElementIds = (definition.sourceElementIds ?? [])
    .map(Number)
    .filter(Number.isInteger);
  const sourceAssets = sourceElementIds.map(elementId =>
    operators.readElementAsset(elementId)
  );
  const derivedModifiers = (passiveControl?.effects ?? [])
    .filter(
      effect =>
        sourceElementIds.includes(Number(effect.elementId)) &&
        effect.propertyChange != null
    )
    .map(effect => ({
      attributeId: Number(effect.propertyChange.attributeId),
      bucket: effect.propertyChange.bucket ?? null,
      valueRaw: Number(effect.propertyChange.valueByLevel?.['1']),
      calculateType: Number(effect.propertyChange.calculateType),
      functionId: Number(effect.propertyChange.functionId ?? 5),
      propertyTags: effect.propertyChange.defaultPropertyTags ?? [],
      sourceIdentity:
        effect.sourceIdentity ?? effect.propertyChange.sourceIdentity ?? null,
    }));
  const declaredModifiers = (definition.modifiers ?? []).map(modifier => ({
    attributeId: Number(modifier.attributeId),
    bucket: modifier.bucket ?? null,
    valueRaw: Number(modifier.valueRaw),
    calculateType:
      modifier.calculateType == null ? null : Number(modifier.calculateType),
    functionId:
      modifier.functionId == null ? null : Number(modifier.functionId),
    propertyTags: (modifier.propertyTags ?? [])
      .map(Number)
      .filter(Number.isInteger),
    sourceIdentity: modifier.sourceIdentity ?? null,
  }));
  const modifiers = dedupeBy(
    [...derivedModifiers, ...declaredModifiers],
    modifier =>
      [
        modifier.attributeId,
        modifier.bucket,
        modifier.valueRaw,
        modifier.calculateType ?? '',
        modifier.functionId ?? '',
        (modifier.propertyTags ?? []).join(','),
      ].join('|')
  );
  const triggerBindings = [
    {
      triggerIdentity: `${definition.skillId}|battle-start|0`,
      controlSkillId: null,
      subSkillIndex: null,
      triggerFrame: 0,
      frameRate: 60,
      sourceElementId: sourceElementIds[0] ?? null,
      sourcePathId:
        sourceAssets[0]?.pathId == null ? null : String(sourceAssets[0].pathId),
      sourceIdentity:
        passiveControl?.sourcePath ??
        definition.sourceIdentity ??
        `character-combat-recipe:${ownerId}#passiveEffects[skillId=${definition.skillId}]`,
      status: 'verified-persistent-passive-battle-start-trigger-ready',
      applied: true,
    },
  ];
  const applied =
    passiveControl != null &&
    sourceElementIds.length > 0 &&
    sourceAssets.every(Boolean) &&
    modifiers.length > 0;
  return {
    passiveIdentity: `actor:${ownerId}:passive:${definition.skillId}`,
    ownerId,
    skillId: Number(definition.skillId),
    name:
      skills.find(skill => Number(skill.id) === Number(definition.skillId))
        ?.name ?? `被动 ${definition.skillId}`,
    effectId: `battle-element:${sourceElementIds[0]}`,
    effectElementId: sourceElementIds[0],
    markerElementId: null,
    propertyElementId: sourceElementIds[0],
    durationMs: null,
    stackMode: 'persistent',
    maxStacks: 1,
    stackDelta: 1,
    runtimeGenerationMode: 'persistent-property-runtime',
    triggerBindings,
    unresolvedTriggerBindings: [],
    modifiers,
    sourceIdentity: [
      passiveControl?.sourcePath,
      ...sourceAssets.filter(Boolean).map(asset => asset.sourceIdentity),
      definition.sourceIdentity,
    ]
      .filter(Boolean)
      .join('|'),
    status: applied
      ? 'verified-persistent-passive-effect-profile-ready'
      : 'unresolved-persistent-passive-effect-profile',
    reasons: [
      ...(passiveControl ? [] : ['passive-skill-control-missing']),
      ...(sourceElementIds.length > 0 && sourceAssets.every(Boolean)
        ? []
        : ['passive-source-element-missing']),
      ...(modifiers.length > 0 ? [] : ['passive-persistent-modifier-missing']),
    ],
    applied,
  };
}

function compileSemanticCatalogPassiveEffect({
  ownerId,
  definition,
  controls,
  controlBySkillId,
  skills,
  operators,
}) {
  const passiveControl = controlBySkillId.get(Number(definition.skillId));
  const marker = operators.readElementAsset(definition.markerElementId);
  const wrapper = operators.readElementAsset(definition.wrapperElementId);
  const property = operators.readElementAsset(definition.propertyElementId);
  const matchingEffects = controls.flatMap(control =>
    (control.effects ?? [])
      .filter(
        effect =>
          Number(effect.elementId) === Number(definition.propertyElementId) &&
          Number(effect.rootElementId) ===
            Number(definition.wrapperElementId) &&
          Number.isInteger(Number(effect.trigger?.startFrame))
      )
      .map(effect => ({ control, effect }))
  );
  const discoveredTriggerBindings = matchingEffects.map(
    ({ control, effect }) => ({
      triggerIdentity: [
        definition.skillId,
        control.controlSkillId,
        effect.mapIndex,
        effect.trigger.startFrame,
        effect.rootPathId,
      ].join('|'),
      controlSkillId: Number(control.controlSkillId),
      subSkillIndex: Number(effect.mapIndex),
      triggerFrame: Number(effect.trigger.startFrame),
      frameRate: Number(control.frameRate) || 60,
      sourceElementId: Number(effect.rootElementId),
      sourcePathId: String(effect.rootPathId),
      semanticEffectElementId: Number(effect.elementId),
      sourceIdentity: [effect.sourceIdentity, effect.trigger?.sourceIdentity]
        .filter(Boolean)
        .join('|'),
      status: 'verified-semantic-passive-trigger-binding-ready',
      applied: true,
    })
  );
  const declaredTriggerBindings = (definition.triggerOverrides ?? []).map(
    trigger => {
      requireControl(
        controlBySkillId,
        trigger.controlSkillId,
        'passive trigger override'
      );
      const sourceElement = operators.readElementAsset(
        trigger.sourceElementId ?? definition.wrapperElementId
      );
      if (
        !sourceElement ||
        !Number.isInteger(Number(trigger.subSkillIndex)) ||
        !Number.isInteger(Number(trigger.triggerFrame)) ||
        Number(trigger.triggerFrame) < 0 ||
        !Number.isFinite(Number(trigger.stackDelta)) ||
        Number(trigger.stackDelta) <= 0
      ) {
        throw new Error(
          `character combat passive trigger override invalid: ${ownerId}/${definition.skillId}/${trigger.triggerIdentity ?? trigger.controlSkillId}`
        );
      }
      return {
        triggerIdentity:
          trigger.triggerIdentity ??
          [
            definition.skillId,
            trigger.controlSkillId,
            trigger.subSkillIndex,
            trigger.triggerFrame,
            'declared',
          ].join('|'),
        controlSkillId: Number(trigger.controlSkillId),
        subSkillIndex: Number(trigger.subSkillIndex),
        triggerFrame: Number(trigger.triggerFrame),
        frameRate: Number(trigger.frameRate) || 60,
        stackDelta: Number(trigger.stackDelta),
        sourceElementId: Number(
          trigger.sourceElementId ?? definition.wrapperElementId
        ),
        sourcePathId: sourceElement.pathId ?? null,
        semanticEffectElementId: Number(definition.propertyElementId),
        sourceIdentity: [sourceElement.sourceIdentity, trigger.sourceIdentity]
          .filter(Boolean)
          .join('|'),
        status: 'verified-declared-passive-trigger-binding-ready',
        applied: true,
      };
    }
  );
  const triggerBindings = dedupeBy(
    [...discoveredTriggerBindings, ...declaredTriggerBindings],
    item => item.triggerIdentity
  ).sort(
    (left, right) =>
      left.controlSkillId - right.controlSkillId ||
      left.subSkillIndex - right.subSkillIndex ||
      left.triggerFrame - right.triggerFrame
  );
  const modifierCandidates = matchingEffects
    .map(({ effect }) => effect.propertyChange)
    .filter(Boolean)
    .map(change => ({
      attributeId: Number(change.attributeId),
      bucket: change.bucket ?? null,
      valueRaw: Number(change.valueByLevel?.['1']),
      calculateType: Number(change.calculateType),
      functionId: Number(change.functionId ?? 5),
      propertyTags: change.defaultPropertyTags ?? [],
      sourceIdentity: matchingEffects.find(
        ({ effect }) => effect.propertyChange === change
      )?.effect?.sourceIdentity,
    }));
  const modifiers = dedupeBy(modifierCandidates, modifier =>
    [
      modifier.attributeId,
      modifier.bucket,
      modifier.valueRaw,
      modifier.calculateType,
      modifier.functionId,
    ].join('|')
  );
  const applied =
    passiveControl != null &&
    marker != null &&
    wrapper != null &&
    property != null &&
    Number(wrapper.tree?.time) === Number(definition.expectedDurationMs) &&
    Number(wrapper.tree?.combineNumber) ===
      Number(definition.expectedMaxStacks) &&
    triggerBindings.length > 0 &&
    modifiers.length === Number(definition.expectedModifierCount) &&
    modifiers.every(
      modifier =>
        Number.isInteger(modifier.attributeId) &&
        modifier.bucket != null &&
        Number.isFinite(modifier.valueRaw)
    );
  return {
    passiveIdentity: `actor:${ownerId}:passive:${definition.skillId}`,
    ownerId,
    skillId: Number(definition.skillId),
    name:
      skills.find(skill => Number(skill.id) === Number(definition.skillId))
        ?.name ?? `被动 ${definition.skillId}`,
    effectId: `battle-element:${definition.wrapperElementId}`,
    effectElementId: Number(definition.wrapperElementId),
    markerElementId: Number(definition.markerElementId),
    propertyElementId: Number(definition.propertyElementId),
    durationMs: Number(wrapper?.tree?.time) || null,
    stackMode: 'stack',
    maxStacks: Number(wrapper?.tree?.combineNumber) || null,
    stackDelta: 1,
    runtimeGenerationMode:
      definition.runtimeGenerationMode ?? 'semantic-effect-catalog',
    triggerBindings,
    unresolvedTriggerBindings: [],
    modifiers,
    sourceIdentity: [
      passiveControl?.sourcePath,
      marker?.sourceIdentity,
      wrapper?.sourceIdentity,
      property?.sourceIdentity,
      ...triggerBindings.map(item => item.sourceIdentity),
    ]
      .filter(Boolean)
      .join('|'),
    status: applied
      ? 'verified-semantic-passive-effect-profile-ready'
      : 'unresolved-semantic-passive-effect-profile',
    reasons: [
      ...(passiveControl ? [] : ['passive-skill-control-missing']),
      ...(marker ? [] : ['passive-marker-element-missing']),
      ...(wrapper ? [] : ['passive-wrapper-element-missing']),
      ...(property ? [] : ['passive-property-element-missing']),
      ...(triggerBindings.length > 0
        ? []
        : ['passive-semantic-trigger-bindings-missing']),
      ...(modifiers.length === Number(definition.expectedModifierCount)
        ? []
        : ['passive-property-change-count-mismatch']),
    ],
    applied,
  };
}

function compileCondition(definition, ownerId, resourceProfiles, operators) {
  if (!definition || definition.kind === 'always') {
    return { kind: 'always' };
  }
  const profile = resourceProfiles.find(
    item => Number(item.elementId) === Number(definition.resourceElementId)
  );
  if (['resource-at-least', 'resource-below'].includes(definition.kind)) {
    const value = Number(definition.value);
    if (!profile || !Number.isFinite(value)) {
      throw new Error(
        `character combat numeric resource condition evidence missing: ${ownerId}/${definition.resourceElementId}/${definition.value}`
      );
    }
    return {
      kind: definition.kind,
      resourceIdentity: profile.resourceIdentity,
      value,
      sourceIdentity: profile.sourceIdentity,
    };
  }
  const state = profile?.stateElements?.find(
    item => Number(item.elementId) === Number(definition.stateElementId)
  );
  const stateAsset = operators.readElementAsset(definition.stateElementId);
  if (!profile || !state) {
    throw new Error(
      `character combat state condition evidence missing: ${ownerId}/${definition.resourceElementId}/${definition.stateElementId}`
    );
  }
  return {
    kind: definition.kind,
    resourceIdentity: profile.resourceIdentity,
    stateElementId: state.elementId,
    stateName: state.name,
    sourceIdentity: state.sourceIdentity ?? stateAsset?.sourceIdentity ?? null,
  };
}

function compileExecutionPrerequisite(definition, ownerId, identity) {
  if (!definition) return null;
  if (definition.kind !== 'scenario-event-at-action-frame') {
    throw new Error(
      `character combat execution prerequisite kind unsupported: ${ownerId}/${identity}/${definition.kind}`
    );
  }
  const eventType = String(definition.eventType ?? '').trim();
  const toleranceFrames = Number(definition.toleranceFrames ?? 0);
  if (
    !eventType ||
    !Number.isInteger(toleranceFrames) ||
    toleranceFrames < 0 ||
    !definition.sourceIdentity
  ) {
    throw new Error(
      `character combat execution prerequisite invalid: ${ownerId}/${identity}`
    );
  }
  return {
    kind: definition.kind,
    eventType,
    toleranceFrames,
    sourceIdentity: definition.sourceIdentity,
    status: 'verified-scenario-execution-prerequisite-ready',
    applied: true,
  };
}

function createContextInputScheduling({ window, sourceExecutionTiming }) {
  const inputSemantics = classifyInputSemantics(window);
  const predecessorGenericEndFrame = nonNegativeIntegerOrNull(
    sourceExecutionTiming?.occupancy?.durationFrames
  );
  let canonicalInputFrame = null;
  if (
    predecessorGenericEndFrame != null &&
    predecessorGenericEndFrame >= Number(window?.startFrame) &&
    predecessorGenericEndFrame < Number(window?.endFrame)
  ) {
    canonicalInputFrame = predecessorGenericEndFrame;
  } else if (
    predecessorGenericEndFrame != null &&
    predecessorGenericEndFrame === Number(window?.endFrame)
  ) {
    canonicalInputFrame = Number(window.endFrame) - 1;
  }
  const immediate = ['immediate-interrupt', 'immediate-continuous'].includes(
    inputSemantics
  );
  const edgeIntentApplied =
    inputSemantics !== 'unresolved' &&
    canonicalInputFrame != null &&
    canonicalInputFrame >= Number(window?.startFrame) &&
    canonicalInputFrame < Number(window?.endFrame);
  const canonicalExecutionStartFrame = edgeIntentApplied
    ? immediate
      ? canonicalInputFrame
      : predecessorGenericEndFrame
    : null;
  return {
    schemaVersion: 1,
    kind: 'verified-context-input-scheduling',
    status:
      window && sourceExecutionTiming?.occupancy?.status === 'applied'
        ? inputSemantics === 'unresolved'
          ? 'unresolved'
          : 'applied'
        : 'unresolved',
    inputSemantics,
    interval: '[start,end)',
    predecessorGenericEndFrame,
    predecessorAnimationDurationFrames:
      sourceExecutionTiming?.animation?.durationFrames ?? null,
    predecessorHitEnvelope: sourceExecutionTiming?.hitEnvelope ?? null,
    windowClassification: classifyWindowAgainstOccupancy({
      window,
      occupancyEndFrame: predecessorGenericEndFrame,
    }),
    bufferUntilFrame:
      inputSemantics === 'buffered-until-frame'
        ? (nonNegativeIntegerOrNull(window?.frameIndex) ??
          predecessorGenericEndFrame)
        : null,
    edgeIntent: {
      status: edgeIntentApplied ? 'applied' : 'not-applicable',
      predecessorGenericEndFrame,
      canonicalInputFrame,
      canonicalExecutionStartFrame,
      canonicalPredecessorEndFrame: canonicalExecutionStartFrame,
      policy: edgeIntentApplied
        ? immediate
          ? 'latest-verified-immediate-input-at-or-before-generic-edge'
          : 'verified-buffered-input-with-generic-edge-execution'
        : 'no-verified-edge-intent-mapping',
    },
    sourceIdentity: [
      window?.sourceIdentity,
      sourceExecutionTiming?.occupancy?.sourceIdentity,
      'client-runtime:EventBridgeBehavior.Start/OnEvent/Update',
    ]
      .filter(Boolean)
      .join('|'),
    reasons: [
      ...(window ? [] : ['context-input-window-missing']),
      ...(sourceExecutionTiming?.occupancy?.status === 'applied'
        ? []
        : ['predecessor-effective-occupancy-unresolved']),
      ...(inputSemantics === 'unresolved'
        ? ['event-bridge-input-execution-semantics-unresolved']
        : []),
    ],
  };
}

function classifyInputSemantics(window) {
  if (Number(window?.bridgeType) === 3) return 'immediate-interrupt';
  if (
    Number(window?.bridgeType) === 0 &&
    Number(window?.continuousAttackType) === 0
  ) {
    return 'buffered-until-frame';
  }
  if (
    Number(window?.bridgeType) === 0 &&
    Number(window?.continuousAttackType) === 1
  ) {
    return 'immediate-continuous';
  }
  return 'unresolved';
}

function classifyWindowAgainstOccupancy({ window, occupancyEndFrame }) {
  if (!window || occupancyEndFrame == null) return 'unresolved';
  const startFrame = Number(window.startFrame);
  const endFrame = Number(window.endFrame);
  if (startFrame === occupancyEndFrame) {
    return 'window-start-equals-generic-occupancy';
  }
  if (startFrame < occupancyEndFrame && occupancyEndFrame < endFrame) {
    return 'generic-occupancy-inside-window';
  }
  if (endFrame === occupancyEndFrame) {
    return 'window-end-equals-generic-occupancy';
  }
  if (endFrame < occupancyEndFrame) return 'window-before-generic-occupancy';
  if (startFrame > occupancyEndFrame) return 'window-after-generic-occupancy';
  return 'unresolved';
}

function normalizeOperators(operators = {}) {
  const required = [
    'normalizeControlWindows',
    'resolveControlVariantTiming',
    'resolveNormalAttackTiming',
    'readElementAsset',
    'createSemanticRootTriggers',
    'resolveControlOwnerId',
  ];
  for (const name of required) {
    if (typeof operators[name] !== 'function') {
      throw new Error(`character combat compiler operator missing: ${name}`);
    }
  }
  return operators;
}

function requireControl(controlBySkillId, rawId, sourceKind) {
  const control = controlBySkillId.get(Number(rawId));
  if (!control) {
    throw new Error(
      `character combat ${sourceKind} control missing: ${Number(rawId)}`
    );
  }
  return control;
}

function toRuntimeExecutionTiming(timing) {
  if (!timing) return null;
  return {
    subSkillIndex: timing.subSkillIndex,
    frameRate: timing.frameRate,
    input: timing.input,
    occupancy: timing.occupancy,
    animation: timing.animation,
    sourceIdentity: timing.sourceIdentity,
  };
}

function resolveInputCommand(window, fallback = null) {
  const commands = window?.allowedInputCommands ?? [];
  for (const command of [
    'charged-attack',
    'normal-attack',
    'star-skill',
    'ultimate',
  ]) {
    if (commands.includes(command)) return command;
  }
  return fallback;
}

function collectSourceIdentities(value) {
  const identities = new Set();
  const visit = item => {
    if (item == null) return;
    if (Array.isArray(item)) {
      for (const entry of item) visit(entry);
      return;
    }
    if (typeof item !== 'object') return;
    if (typeof item.sourceIdentity === 'string' && item.sourceIdentity) {
      identities.add(item.sourceIdentity);
    }
    for (const entry of Object.values(item)) visit(entry);
  };
  visit(value);
  return [...identities].sort();
}

function sortByIdentity(records) {
  return [...records].sort(compareIdentity);
}

function compareIdentity(left, right) {
  return resolveIdentity(left).localeCompare(resolveIdentity(right));
}

function resolveIdentity(value) {
  return String(
    value?.identity ??
      value?.edgeIdentity ??
      value?.formIdentity ??
      value?.chainIdentity ??
      value?.transitionIdentity ??
      value?.passiveIdentity ??
      value?.operationIdentity ??
      value?.hitIdentity ??
      value?.sourceIdentity ??
      ''
  );
}

function dedupeBy(records, keySelector) {
  const output = [];
  const seen = new Set();
  for (const record of records) {
    const key = keySelector(record);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(record);
  }
  return output;
}

function nonNegativeIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function sha256Json(value) {
  return crypto
    .createHash('sha256')
    .update(stableStringify(value))
    .digest('hex');
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
