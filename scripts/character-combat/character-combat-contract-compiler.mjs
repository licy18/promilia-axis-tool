import crypto from 'node:crypto';

export const CHARACTER_COMBAT_COMPILER_VERSION = 1;

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
  const resourceOperations = (
    evidence?.specialResourceOperations ?? []
  ).filter(operation => Number(operation.ownerId) === ownerId);
  const managesResourceContracts = Array.isArray(
    compilerRecipe.specialResources
  );
  const specialResourceContracts = compileSpecialResourceContracts({
    ownerId,
    definitions: compilerRecipe.specialResources ?? [],
    resourceProfiles,
    resourceOperations,
  });
  const contextEdges = compileContextInputEdges({
    ownerId,
    definitions: compilerRecipe.contextInputEdges ?? [],
    controlBySkillId,
    resourceProfiles,
    operators: normalizedOperators,
  });
  const publicActionForms = compilePublicActionForms({
    ownerId,
    definitions: compilerRecipe.publicActionForms ?? [],
    controlBySkillId,
    resourceProfiles,
    contextEdges,
    operators: normalizedOperators,
  });
  const attackInputChains = compileAttackInputChains({
    ownerId,
    definitions: compilerRecipe.attackInputChains ?? [],
    controlBySkillId,
    resourceProfiles,
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
    resourceProfiles,
    operators: normalizedOperators,
  });
  const actionEffectBindings = compileActionEffectBindings({
    ownerId,
    definitions: compilerRecipe.actionEffectBindings ?? [],
    controlBySkillId,
    resourceProfiles,
    tuningMarkProfiles: evidence?.tuningMarkProfiles ?? [],
    operators: normalizedOperators,
  });
  const actionHitBindings = compileActionHitBindings({
    ownerId,
    definitions: compilerRecipe.actionHitBindings ?? [],
    controlBySkillId,
  });
  const thresholdTransitions = compileThresholdTransitions({
    ownerId,
    definitions: compilerRecipe.thresholdTransitions ?? [],
    resourceProfiles,
    resourceOperations,
    operators: normalizedOperators,
  });
  const passiveEffects = compilePassiveEffects({
    ownerId,
    definitions: compilerRecipe.passiveEffects ?? [],
    controls,
    controlBySkillId,
    skills: evidence?.skills ?? [],
    operators: normalizedOperators,
  });
  const contracts = {
    contextEdges,
    publicActionForms,
    attackInputChains,
    controlTransitionWindows,
    variantWindowBindings,
    actionEffectBindings,
    actionHitBindings,
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
    recipeIdentity: `actor:${ownerId}:character-combat-recipe:v${Number(
      recipe.schemaVersion
    ) || 1}`,
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
      controlTransitionWindowCount:
        contracts.controlTransitionWindows.length,
      variantWindowBindingCount: contracts.variantWindowBindings.length,
      actionEffectBindingCount: contracts.actionEffectBindings.length,
      actionHitBindingCount: contracts.actionHitBindings.length,
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
  const replaceOwnerRecords = (records, additions) =>
    [
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
  const variantWindowBindings = compilations.flatMap(
    item => item.contracts.variantWindowBindings
  );
  const actionEffectBindings = compilations.flatMap(
    item => item.contracts.actionEffectBindings
  );
  const actionHitBindings = compilations.flatMap(
    item => item.contracts.actionHitBindings ?? []
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
    appliedEdgeCount: actionVariantGraph.edges.filter(edge => edge.applied)
      .length,
    compiledVariantWindowBindingCount: variantWindowBindings.length,
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
    const indexes = (control.elements ?? [])
      .map((element, index) => ({ element, index }))
      .filter(
        ({ element }) =>
          Number(element.mapIndex) === Number(binding.subSkillIndex) &&
          Number(element.elementId) === Number(binding.elementId)
      );
    if (indexes.length !== 1) {
      throw new Error(
        `character combat action hit match mismatch: ${binding.ownerId}/${binding.controlSkillId}/${binding.subSkillIndex}/${binding.elementId} received ${indexes.length}`
      );
    }
    const index = indexes[0].index;
    const element = control.elements[index];
    const existingTriggers = element.triggers ?? [];
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
    }));
    control.elements[index] = {
      ...element,
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
      issues: (element.issues ?? []).filter(
        reason => reason !== 'trigger-frame-missing'
      ),
      applied: true,
      sourceIdentity: [element.sourceIdentity, binding.sourceIdentity]
        .filter(Boolean)
        .join('|'),
    };
  }
  return controls;
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
    const matches = (control.effects ?? []).filter(
      effect =>
        Number(effect.mapIndex) === Number(binding.mapIndex) &&
        Number(effect.elementId) === Number(binding.elementId) &&
        (binding.bindingKind !== 'lifecycle-override' ||
          Number(effect.trigger?.startFrame) ===
            Number(binding.triggerFrame))
    );
    if (matches.length !== 1) {
      throw new Error(
        `character combat action effect match mismatch: ${binding.ownerId}/${binding.controlSkillId}/${binding.mapIndex}/${binding.elementId} received ${matches.length}`
      );
    }
    control.effects = control.effects.map(effect =>
      matches.includes(effect)
        ? applyActionEffectBinding(effect, binding)
        : effect
    );
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
      const projectedSegments = (chain.segments ?? []).map(
        (segment, index) => {
          const source = sourceSegments.find(candidate => {
            if (
              Number(candidate.controlSkillId) !==
              Number(segment.controlSkillId)
            ) {
              return false;
            }
            const candidateSubSkillIndex = Number(
              candidate.selectedSubSkillIndex ??
                candidate.subSkillIndex ??
                0
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
            durationStatus:
              segment.applied === false ? 'unresolved' : 'applied',
            durationBasis: 'character-combat-default-attack-phase',
            durationSourceIdentity: segment.sourceIdentity,
            attackInputChainIdentity: chain.chainIdentity,
          };
        }
      );
      mapping.attackInputSourceSegments = sourceSegments;
      mapping.attackInputSegments = projectedSegments;
      mapping.attackInputChainIdentity = chain.chainIdentity;
      mapping.attackInputPhaseStatus =
        'character-combat-default-attack-phase-applied';
      mapping.attackInputPhaseSourceIdentity = chain.sourceIdentity;
    }
    const directExecutionForms = (
      compilation.contracts.publicActionForms ?? []
    ).filter(
      form =>
        form.applied === true &&
        ['direct-execution', 'wrapper-derived-execution'].includes(
          form.selectionKind
        )
    );
    for (const form of directExecutionForms) {
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
        hit =>
          Number(hit.mapIndex) === Number(form.executionSubSkillIndex)
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
      .filter(({ edge }) =>
        matchesVariantWindowBinding(edge, binding)
      )
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
  const trigger = {
    behaviorPathId: `character-combat:${binding.bindingIdentity}`,
    startFrame: binding.triggerFrame,
    frameCount: binding.frameCount,
    behaviorIndex: null,
    timelineGroupIndex: 0,
    targetCode: effect.trigger?.targetCode ?? 0,
    targetKind: effect.target?.kind ?? effect.trigger?.targetKind ?? 'unresolved',
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
        stackDelta: binding.lifecycleStackDelta,
        maxStacks:
          binding.lifecycleMaxStacks ??
          effect.lifecycle?.maxStacks ??
          binding.lifecycleStackDelta,
      },
      sourceIdentity: [effect.sourceIdentity, binding.sourceIdentity]
        .filter(Boolean)
        .join('|'),
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
  return {
    ...effect,
    effectIdentity: `${effect.graphIdentity}|${binding.triggerFrame}|${effect.depth ?? 0}`,
    trigger,
    tuningMark: binding.tuningMark,
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
}) {
  const profiles = [];
  const operations = [];
  for (const definition of definitions) {
    const elementId = Number(definition.resourceElementId);
    const profile = resourceProfiles.find(
      item => Number(item.elementId) === elementId
    );
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
    profiles.push({
      ...profile,
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
    const unresolvedCount = normalized.length - appliedCount - notApplicableCount;
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

function compileDeclaredResourceOperations({
  ownerId,
  profile,
  declarations,
}) {
  return declarations.map(declaration => {
    const triggerFrame = Number(declaration.triggerFrame);
    const frameRate = Number(declaration.frameRate) || 60;
    const amount = Number(declaration.amount);
    if (
      !declaration.operationIdentity ||
      !Number.isInteger(Number(declaration.controlSkillId)) ||
      !Number.isInteger(Number(declaration.subSkillIndex)) ||
      !['gain', 'consume', 'clear', 'transform', 'set-to-capacity'].includes(
        declaration.operation
      ) ||
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
      status: 'verified-special-resource-operation-ready',
      reasons: [],
      impactClassification: 'gameplay-resource-transaction',
      classificationSourceIdentity: declaration.sourceIdentity,
      applied: true,
    };
  });
}

function classifyResourceOperation(operation, rules) {
  const rule = rules.find(candidate =>
    matchesResourceOperationRule(operation, candidate.match ?? {})
  );
  if (!rule) return operation;
  if (rule.status === 'applied') {
    const triggerFrame = Number(rule.triggerFrame);
    const frameRate = Number(rule.frameRate) || Number(operation.frameRate) || 60;
    if (
      !Number.isInteger(triggerFrame) ||
      triggerFrame < 0 ||
      !['gain', 'consume', 'clear', 'transform', 'set-to-capacity'].includes(
        rule.operation ?? operation.operation
      )
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
    impactClassification:
      rule.impactClassification ?? 'wrapper-or-duplicate',
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
    controlTransitionWindows:
      compilation.contracts.controlTransitionWindows,
    variantWindowBindings: compilation.contracts.variantWindowBindings,
    actionEffectBindings: compilation.contracts.actionEffectBindings,
    actionHitBindings: compilation.contracts.actionHitBindings,
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
            actorSp.sourceIdentity ??
            `verified-owner-profile:actor:${ownerId}`,
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
      semanticName:
        `${chain.semanticNamePrefix ?? '普通攻击'} A${segment.sequenceIndex}`,
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
          interruptBehavior:
            definition.inputWindow.interruptBehavior ?? null,
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
      executionTiming: toRuntimeExecutionTiming(timing),
      sourceIdentity: [
        ...definitionSources,
        timing?.sourceIdentity,
      ]
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
  const animationDurationFrames = Number(
    timing?.animation?.durationFrames
  );
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
    sourceKind:
      declaration.sourceKind ?? 'declared-verified-input-occupancy',
    sourceIdentity: declaration.sourceIdentity,
    conversion: `${durationFrames} source frames at ${frameRate}fps`,
    reasons: [],
  };
  return {
    ...(timing ?? {}),
    occupancy,
    status: 'applied',
    sourceKind: occupancy.sourceKind,
    sourceIdentity: [
      timing?.sourceIdentity,
      declaration.sourceIdentity,
    ]
      .filter(Boolean)
      .join('|'),
    reasons: (timing?.reasons ?? []).filter(
      reason =>
        reason !== 'verified-action-effective-occupancy-window-unresolved'
    ),
  };
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
      intermediaryControlSkillId: Number(
        definition.intermediaryControlSkillId
      ),
      intermediarySubSkillIndex: Number(
        definition.intermediarySubSkillIndex
      ),
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
    sourceIdentity: [
      profile.sourceIdentity,
      definition.sourceIdentity,
    ]
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
      sourceIdentity: [
        sourceElement.sourceIdentity,
        definition.sourceIdentity,
      ]
        .filter(Boolean)
        .join('|'),
      verification:
        definition.verification &&
        typeof definition.verification === 'object'
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
          interruptBehavior: nonNegativeIntegerOrNull(
            window.interruptBehavior
          ),
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
  tuningMarkProfiles,
  operators,
}) {
  return definitions.map(definition => {
    requireControl(
      controlBySkillId,
      definition.controlSkillId,
      'action effect binding'
    );
    const element = operators.readElementAsset(definition.elementId);
    const triggerFrame = Number(definition.triggerFrame);
    const tuningProfile = definition.tuningMarkProfileKey
      ? (tuningMarkProfiles ?? []).find(
          profile =>
            (profile.profileKey ?? profile.key) ===
            definition.tuningMarkProfileKey
        )
      : null;
    const lifecycleStackDelta = Number(
      definition.lifecycleStackDelta
    );
    const lifecycleBinding =
      Number.isFinite(lifecycleStackDelta) &&
      lifecycleStackDelta > 0;
    if (
      !element ||
      !Number.isInteger(triggerFrame) ||
      triggerFrame < 0 ||
      (!tuningProfile?.applied && !lifecycleBinding)
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
      sourceIdentity: [element.sourceIdentity, definition.sourceIdentity]
        .filter(Boolean)
        .join('|'),
      bindingKind: lifecycleBinding
        ? 'lifecycle-override'
        : 'tuning-mark',
      tuningMark: tuningProfile
        ? {
            ...tuningProfile,
            profileKey: tuningProfile.profileKey ?? tuningProfile.key,
            stackDelta: Number(definition.stackDelta) || 1,
            applied: true,
          }
        : null,
      lifecycleStackDelta: lifecycleBinding
        ? lifecycleStackDelta
        : null,
      lifecycleMaxStacks:
        definition.lifecycleMaxStacks == null
          ? null
          : Number(definition.lifecycleMaxStacks),
      status: 'applied',
      applied: true,
    };
  });
}

function compileActionHitBindings({
  ownerId,
  definitions,
  controlBySkillId,
}) {
  return definitions.map(definition => {
    const control = requireControl(
      controlBySkillId,
      definition.controlSkillId,
      'action hit binding'
    );
    const matches = (control.elements ?? []).filter(
      element =>
        Number(element.mapIndex) === Number(definition.subSkillIndex) &&
        Number(element.elementId) === Number(definition.elementId)
    );
    const triggerFrames = [
      ...new Set((definition.triggerFrames ?? []).map(Number)),
    ].sort((left, right) => left - right);
    const sourceElement = matches[0];
    if (
      matches.length !== 1 ||
      triggerFrames.length === 0 ||
      triggerFrames.some(
        frame => !Number.isInteger(frame) || frame < 0
      ) ||
      !Object.values(sourceElement?.dimensions ?? {}).some(
        dimension => dimension.status === 'applied'
      )
    ) {
      throw new Error(
        `character combat action hit evidence missing: ${ownerId}/${definition.bindingIdentity}`
      );
    }
    return {
      bindingIdentity: definition.bindingIdentity,
      ownerId,
      controlSkillId: Number(definition.controlSkillId),
      subSkillIndex: Number(definition.subSkillIndex),
      elementId: Number(definition.elementId),
      elementPathId: sourceElement.pathId ?? null,
      triggerFrames,
      frameCount: Math.max(1, Number(definition.frameCount) || 1),
      targetCode: Number(definition.targetCode) || 0,
      targetKind: definition.targetKind ?? 'enemy',
      sourceIdentity: [
        sourceElement.sourceIdentity,
        definition.sourceIdentity,
      ]
        .filter(Boolean)
        .join('|'),
      status: 'applied',
      applied: true,
    };
  });
}

function compileThresholdTransitions({
  ownerId,
  definitions,
  resourceProfiles,
  resourceOperations,
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
      sourceIdentity: [
        resourceAsset.sourceIdentity,
        `${resourceAsset.sourceIdentity}#combineType=${resourceAsset.tree?.combineType};combineNumber=${resourceAsset.tree?.combineNumber}`,
        stateAsset.sourceIdentity,
        `${stateAsset.sourceIdentity}#time=${stateAsset.tree?.time}`,
        definition.runtimeSourceIdentity,
      ]
        .filter(Boolean)
        .join('|'),
      status: 'verified-special-resource-threshold-transition-ready',
      applied: true,
    };
  });
}

function compilePassiveEffects({
  ownerId,
  definitions,
  controls,
  controlBySkillId,
  skills,
  operators,
}) {
  return definitions.map(definition => {
    if (
      [
        'semantic-effect-catalog',
        'action-variant-runtime',
      ].includes(definition.runtimeGenerationMode)
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
      if (Number(operators.resolveControlOwnerId(control)) !== ownerId) continue;
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
    const aliasTriggers = (definition.publicTriggerAliases ?? []).flatMap(
      alias => {
        const sourceControl = controlBySkillId.get(
          Number(alias.publicControlSkillId)
        );
        const runtimeTrigger = directTriggers.find(
          trigger =>
            Number(trigger.controlSkillId) ===
              Number(alias.runtimeControlSkillId) &&
            Number(trigger.subSkillIndex) ===
              Number(alias.runtimeSubSkillIndex)
        );
        const bridge = operators
          .normalizeControlWindows(sourceControl, alias.publicSubSkillIndex)
          .find(
            window =>
              Number(window.targetControlSkillId) ===
                Number(alias.runtimeControlSkillId) &&
              Number(window.targetSubSkillIndex) ===
                Number(alias.runtimeSubSkillIndex)
          );
        if (!runtimeTrigger || !bridge) return [];
        return [
          {
            ...runtimeTrigger,
            triggerIdentity: [
              definition.skillId,
              alias.publicControlSkillId,
              alias.publicSubSkillIndex,
              bridge.startFrame + runtimeTrigger.triggerFrame,
              'runtime-control',
              alias.runtimeControlSkillId,
            ].join('|'),
            controlSkillId: alias.publicControlSkillId,
            subSkillIndex: alias.publicSubSkillIndex,
            triggerFrame: bridge.startFrame + runtimeTrigger.triggerFrame,
            sourceIdentity: [
              bridge.sourceIdentity,
              runtimeTrigger.sourceIdentity,
            ].join('|'),
            status: 'verified-passive-public-trigger-binding-ready',
            applied: true,
          },
        ];
      }
    );
    const triggerBindings = dedupeBy(
      [...directTriggers, ...aliasTriggers],
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
          Number(trigger.controlSkillId) ===
          Number(alias.runtimeControlSkillId)
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
    const modifiers = (
      property?.tree?.changePeopertyConditionArrayDatas ?? []
    )
      .map(entry => entry?.changeProperty)
      .filter(Boolean)
      .map(change => ({
        attributeId: Number(change.attributeID),
        bucket:
          Number(change.calculateType) === 2 &&
          Number(change.functionId) === 3
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
          Number(effect.rootElementId) === Number(definition.wrapperElementId) &&
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
      sourceIdentity: [
        effect.sourceIdentity,
        effect.trigger?.sourceIdentity,
      ]
        .filter(Boolean)
        .join('|'),
      status: 'verified-semantic-passive-trigger-binding-ready',
      applied: true,
    })
  );
  const declaredTriggerBindings = (
    definition.triggerOverrides ?? []
  ).map(trigger => {
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
      sourceIdentity: [
        sourceElement.sourceIdentity,
        trigger.sourceIdentity,
      ]
        .filter(Boolean)
        .join('|'),
      status: 'verified-declared-passive-trigger-binding-ready',
      applied: true,
    };
  });
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
  const modifiers = dedupeBy(
    modifierCandidates,
    modifier =>
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
  if (
    ['resource-at-least', 'resource-below'].includes(definition.kind)
  ) {
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
