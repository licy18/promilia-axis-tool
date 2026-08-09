import fs from 'node:fs';
import path from 'node:path';
import {
  applyCharacterCombatAttackInputPhaseMappings,
  applyCharacterCombatActionEffectBindings,
  applyCharacterCombatActionHitBindings,
  applyCharacterCombatResourceOperationBindings,
  applyCharacterCombatRawDirectEffectBindings,
  compileCharacterCombatRecipeContracts,
  createCharacterCombatOwnerRuntimeContracts,
  mergeCharacterCombatOwnerCompilations,
} from './character-combat-contract-compiler.mjs';
import { createCharacterCombatPipelineArtifacts } from './character-combat-profile-pipeline.mjs';

export function discoverCharacterCombatRecipes({ recipeRoot }) {
  if (!recipeRoot || !fs.existsSync(recipeRoot)) {
    throw new Error(`character combat recipe root missing: ${recipeRoot}`);
  }
  const entries = fs
    .readdirSync(recipeRoot, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => {
      const filePath = path.join(recipeRoot, entry.name);
      const recipe = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return { filePath, recipe };
    })
    .sort(
      (left, right) =>
        Number(left.recipe.ownerId) - Number(right.recipe.ownerId)
    );
  const ownerIds = new Set();
  for (const { filePath, recipe } of entries) {
    const ownerId = Number(recipe.ownerId);
    if (
      recipe.kind !== 'azpr-character-combat-profile-recipe' ||
      !Number.isInteger(ownerId) ||
      ownerId <= 0
    ) {
      throw new Error(`invalid character combat recipe: ${filePath}`);
    }
    if (ownerIds.has(ownerId)) {
      throw new Error(`duplicate character combat recipe owner: ${ownerId}`);
    }
    ownerIds.add(ownerId);
  }
  return entries.map(entry => entry.recipe);
}

export function collectCharacterCombatRequiredControlSkillIds(recipes) {
  const controlSkillIds = new Set();
  for (const recipe of recipes ?? []) {
    for (const value of recipe.compiler?.reachableControlSkillIds ?? []) {
      const controlSkillId = Number(value);
      if (Number.isInteger(controlSkillId)) controlSkillIds.add(controlSkillId);
    }
    collectNamedControlSkillIds(recipe.mechanicsDiscovery, controlSkillIds);
    for (const policy of recipe.runtimePolicies?.controlPolicies ?? []) {
      const controlSkillId = Number(policy.controlSkillId);
      if (Number.isInteger(controlSkillId)) controlSkillIds.add(controlSkillId);
    }
  }
  return [...controlSkillIds].sort((left, right) => left - right);
}

export function createCharacterCombatControlPolicyIndex(recipes) {
  const policies = new Map();
  for (const recipe of recipes ?? []) {
    const ownerId = Number(recipe.ownerId);
    const defaultPolicy = recipe.runtimePolicies?.defaultControlPolicy ?? null;
    if (defaultPolicy) {
      for (const controlSkillId of collectCharacterCombatRequiredControlSkillIds(
        [recipe]
      )) {
        if (policies.has(controlSkillId)) {
          throw new Error(
            `duplicate character combat control policy: ${controlSkillId}`
          );
        }
        policies.set(controlSkillId, {
          ...defaultPolicy,
          ownerId,
          controlSkillId,
          sourceIdentity: `${
            defaultPolicy.sourceIdentity ??
            `${recipe.sourceIdentity ?? `actor:${ownerId}:recipe`}|runtimePolicies.defaultControlPolicy`
          }|controlSkillId=${controlSkillId}`,
        });
      }
    }
    for (const policy of recipe.runtimePolicies?.controlPolicies ?? []) {
      const controlSkillId = Number(policy.controlSkillId);
      if (!Number.isInteger(controlSkillId)) {
        throw new Error(
          `character combat control policy id invalid: ${ownerId}/${policy.controlSkillId}`
        );
      }
      const inheritedPolicy = policies.get(controlSkillId);
      if (inheritedPolicy && inheritedPolicy.ownerId !== ownerId) {
        throw new Error(
          `duplicate character combat control policy: ${controlSkillId}`
        );
      }
      policies.set(controlSkillId, {
        ...inheritedPolicy,
        ...policy,
        ownerId,
        controlSkillId,
        sourceIdentity:
          policy.sourceIdentity ??
          inheritedPolicy?.sourceIdentity ??
          `${recipe.sourceIdentity ?? `actor:${ownerId}:recipe`}|runtimePolicies.controlPolicies[controlSkillId=${controlSkillId}]`,
      });
    }
  }
  return policies;
}

export function augmentCharacterCombatActionCandidates({
  candidates,
  recipes,
  characterCatalog,
  skills,
}) {
  const output = [...(candidates ?? [])];
  const characters = Array.isArray(characterCatalog)
    ? characterCatalog
    : (characterCatalog?.items ?? []);
  const characterByOwnerId = new Map(
    characters.map(character => [Number(character.id), character])
  );
  const skillById = new Map(
    (skills ?? []).map(skill => [Number(skill.id), skill])
  );
  const identityOf = candidate =>
    [
      candidate.ownerKind,
      Number(candidate.ownerId),
      Number(candidate.sourceSkillId),
      Number(candidate.actionVariantIndex),
      Number(candidate.controlSkillId),
    ].join('|');
  const indexByIdentity = new Map(
    output.map((candidate, index) => [identityOf(candidate), index])
  );

  for (const recipe of recipes ?? []) {
    const ownerId = Number(recipe.ownerId);
    const character = characterByOwnerId.get(ownerId);
    if (!character) {
      throw new Error(
        `character combat public action owner missing: ${ownerId}`
      );
    }
    for (const declaration of recipe.compiler?.publicActionDeclarations ?? []) {
      const sourceSkillId = Number(declaration.sourceSkillId);
      const actionVariantIndex = Number(declaration.actionVariantIndex);
      const controlSkillId = Number(declaration.controlSkillId);
      const skill = skillById.get(sourceSkillId);
      if (
        !skill ||
        Number(skill.characterId) !== ownerId ||
        !Number.isInteger(actionVariantIndex) ||
        actionVariantIndex < 0 ||
        !Number.isInteger(controlSkillId) ||
        !declaration.actionKind
      ) {
        throw new Error(
          `character combat public action declaration invalid: ${ownerId}/${sourceSkillId}/${declaration.actionKind}`
        );
      }
      const sourceVariant = skill.level?.labels?.[actionVariantIndex] ?? null;
      const candidate = {
        ownerKind: 'actor',
        ownerId,
        ownerName: character.name ?? skill.characterName ?? null,
        sourceSkillId,
        sourceSkillName: skill.name ?? skill.displayName ?? null,
        actionVariantIndex,
        actionVariantLabel:
          declaration.actionVariantLabel ??
          declaration.catalogLabel ??
          sourceVariant ??
          declaration.actionKind,
        actionKind: declaration.actionKind,
        publicVariants: [
          {
            index: actionVariantIndex,
            label:
              declaration.catalogLabel ??
              declaration.actionVariantLabel ??
              sourceVariant ??
              declaration.actionKind,
            sourceIdentity:
              declaration.sourceIdentity ??
              `character-combat-recipe:${ownerId}#compiler.publicActionDeclarations`,
          },
        ],
        controlSkillId,
        bindingKind: 'character-combat-recipe-public-action-control',
        bindingSourceIdentity:
          declaration.sourceIdentity ??
          `character-combat-recipe:${ownerId}#compiler.publicActionDeclarations[controlSkillId=${controlSkillId}]`,
        bindingEligible: true,
        catalogDeclaration: {
          label:
            declaration.catalogLabel ??
            declaration.actionVariantLabel ??
            declaration.actionKind,
          sourceStatus: declaration.sourceStatus ?? 'verified-static-evidence',
          sourceIdentity:
            declaration.sourceIdentity ??
            `character-combat-recipe:${ownerId}#compiler.publicActionDeclarations[controlSkillId=${controlSkillId}]`,
        },
      };
      const identity = identityOf(candidate);
      const previousIndex = indexByIdentity.get(identity);
      if (previousIndex != null) {
        const previous = output[previousIndex];
        if (String(previous.actionKind) !== String(candidate.actionKind)) {
          throw new Error(
            `character combat public action declaration conflicts candidate action kind: ${identity}/${previous.actionKind}/${candidate.actionKind}`
          );
        }
        if (previous.catalogDeclaration != null) {
          throw new Error(
            `character combat public action declaration duplicates declared candidate: ${identity}`
          );
        }
        output[previousIndex] = {
          ...previous,
          catalogDeclaration: candidate.catalogDeclaration,
        };
        continue;
      }
      indexByIdentity.set(identity, output.length);
      output.push(candidate);
    }
  }
  return output;
}

export async function createCharacterCombatProductionBuild({
  recipes,
  characterCatalog,
  skills,
  productBoundaryReport = null,
  productBoundaryMarkdown = null,
  compilerEvidence,
  compilerOperators,
  actionVariantGraph,
  specialResourceCatalog,
  prepareCompiledOwners,
  createMechanicsPackage,
  createGoldenRuntimeForOwner = async () => null,
  createReportsForOwner = () => ({}),
  createStatDependenciesForOwner = () => ({ static: [], dynamic: [] }),
  finalizeMechanicsPackage,
}) {
  const normalizedRecipes = normalizeRecipes(recipes);
  if (typeof createMechanicsPackage !== 'function') {
    throw new Error('character combat mechanics package builder missing');
  }
  const characters = Array.isArray(characterCatalog)
    ? characterCatalog
    : (characterCatalog?.items ?? []);
  const characterByOwnerId = new Map(
    characters.map(character => [Number(character.id), character])
  );
  const ownerCompilations = normalizedRecipes.map(recipe =>
    compileCharacterCombatRecipeContracts({
      recipe,
      character: characterByOwnerId.get(Number(recipe.ownerId)),
      evidence: compilerEvidence,
      operators: compilerOperators,
    })
  );

  mergeCharacterCombatOwnerCompilations({
    actionVariantGraph,
    specialResourceCatalog,
    compilations: ownerCompilations,
  });
  const unresolvedContextEdges = (actionVariantGraph.contextEdges ?? []).filter(
    edge => edge.applied !== true
  );
  if (unresolvedContextEdges.length > 0) {
    throw new Error(
      `character combat context edge compilation incomplete: ${unresolvedContextEdges
        .map(
          edge =>
            `${
              edge.edgeIdentity ??
              `${edge.ownerId}/${edge.sourceControlSkillId}/${edge.sourceSubSkillIndex}->${edge.executionControlSkillId}/${edge.executionSubSkillIndex}`
            } [${(edge.reasons ?? []).join('|')}]`
        )
        .join(', ')}`
    );
  }
  applyCharacterCombatActionHitBindings({
    controls: compilerEvidence?.controls ?? [],
    compilations: ownerCompilations,
  });
  applyCharacterCombatActionEffectBindings({
    controls: compilerEvidence?.controls ?? [],
    compilations: ownerCompilations,
  });
  applyCharacterCombatResourceOperationBindings({
    controls: compilerEvidence?.controls ?? [],
    compilations: ownerCompilations,
  });
  applyCharacterCombatRawDirectEffectBindings({
    controls: compilerEvidence?.controls ?? [],
    compilations: ownerCompilations,
  });
  if (typeof prepareCompiledOwners === 'function') {
    await prepareCompiledOwners({
      recipes: normalizedRecipes,
      ownerCompilations,
      actionVariantGraph,
      specialResourceCatalog,
    });
  }

  const packageResult = await createMechanicsPackage({
    recipes: normalizedRecipes,
    ownerCompilations,
    actionVariantGraph,
    specialResourceCatalog,
  });
  const mechanicsPackage =
    packageResult?.mechanicsPackage ?? packageResult ?? null;
  const sharedContext = packageResult?.mechanicsPackage
    ? (packageResult.sharedContext ?? {})
    : {};
  if (!mechanicsPackage) {
    throw new Error('character combat mechanics package builder returned null');
  }
  applyCharacterCombatAttackInputPhaseMappings({
    mechanicsPackage,
    compilations: ownerCompilations,
  });
  mechanicsPackage.actionVariantGraph = actionVariantGraph;
  mechanicsPackage.specialResourceCatalog = specialResourceCatalog;

  const ownerRuntimeContracts = ownerCompilations.map(compilation => {
    const ownerId = Number(compilation.ownerId);
    const ownerControls = collectOwnerControls({
      mechanicsPackage,
      reachableControlSkillIds: compilation.reachableControlSkillIds,
    });
    const semanticEffects = collectOwnerSemanticEffects({
      mechanicsPackage,
      semanticEffectCatalog: sharedContext.semanticEffectCatalog,
      ownerId,
    });
    return createCharacterCombatOwnerRuntimeContracts({
      compilation,
      publicActions: (mechanicsPackage.actionMappings ?? []).filter(
        mapping =>
          mapping.ownerKind === 'actor' && Number(mapping.ownerId) === ownerId
      ),
      controls: ownerControls,
      variantEdges: (actionVariantGraph.edges ?? []).filter(
        edge => Number(edge.ownerId) === ownerId
      ),
      hits: ownerControls.flatMap(control =>
        (control.hits ?? []).map(hit => ({
          ...hit,
          controlSkillId: control.controlSkillId,
          frameRate: control.frameRate,
        }))
      ),
      resourceProfiles: (specialResourceCatalog.profiles ?? []).filter(
        profile => Number(profile.ownerId) === ownerId
      ),
      resourceTransactions: (
        specialResourceCatalog.operationBindings ?? []
      ).filter(operation => Number(operation.ownerId) === ownerId),
      rawEffects: ownerControls.flatMap(control =>
        (control.effects ?? []).map(effect => ({
          ...effect,
          controlSkillId: control.controlSkillId,
        }))
      ),
      semanticEffects,
      switchTriggers: (
        mechanicsPackage.switchTriggerCatalog?.profiles ?? []
      ).filter(profile => Number(profile.ownerId) === ownerId),
      statDependencies: createStatDependenciesForOwner({
        ownerId,
        recipe: normalizedRecipes.find(
          item => Number(item.ownerId) === ownerId
        ),
        compilation,
        mechanicsPackage,
        semanticEffects,
        sharedContext,
      }),
    });
  });

  const goldenRuntimeByOwner = new Map();
  const reportsByOwner = new Map();
  for (const recipe of normalizedRecipes) {
    const ownerId = Number(recipe.ownerId);
    const compilation = ownerCompilations.find(
      item => Number(item.ownerId) === ownerId
    );
    const runtimeContract = ownerRuntimeContracts.find(
      item => Number(item.ownerId) === ownerId
    );
    const goldenRuntime = await createGoldenRuntimeForOwner({
      ownerId,
      recipe,
      compilation,
      runtimeContract,
      mechanicsPackage,
      sharedContext,
    });
    if (goldenRuntime) goldenRuntimeByOwner.set(ownerId, goldenRuntime);
    reportsByOwner.set(
      ownerId,
      (await createReportsForOwner({
        ownerId,
        recipe,
        compilation,
        runtimeContract,
        mechanicsPackage,
        sharedContext,
      })) ?? {}
    );
  }

  const pipelineArtifacts = createCharacterCombatPipelineArtifacts({
    mechanicsPackage,
    characterCatalog,
    skills,
    recipes: normalizedRecipes,
    productBoundaryReport,
    productBoundaryMarkdown,
    compiledOwnerContracts: ownerRuntimeContracts,
    goldenRuntimeByOwner,
    reportsByOwner,
  });
  mechanicsPackage.characterCombatProfileCatalog = pipelineArtifacts.catalog;
  if (typeof finalizeMechanicsPackage === 'function') {
    await finalizeMechanicsPackage({
      mechanicsPackage,
      pipelineArtifacts,
      ownerCompilations,
      ownerRuntimeContracts,
      sharedContext,
    });
  }

  return {
    recipes: normalizedRecipes,
    ownerCompilations,
    ownerRuntimeContracts,
    mechanicsPackage,
    pipelineArtifacts,
    goldenRuntimeByOwner,
    reportsByOwner,
    sharedContext,
  };
}

function normalizeRecipes(recipes) {
  const normalized = [...(recipes ?? [])].sort(
    (left, right) => Number(left.ownerId) - Number(right.ownerId)
  );
  const ownerIds = new Set();
  for (const recipe of normalized) {
    const ownerId = Number(recipe.ownerId);
    if (!Number.isInteger(ownerId) || ownerIds.has(ownerId)) {
      throw new Error(`invalid character combat recipe owner set: ${ownerId}`);
    }
    ownerIds.add(ownerId);
  }
  return normalized;
}

function collectNamedControlSkillIds(value, output, key = '') {
  if (Array.isArray(value)) {
    value.forEach(item => collectNamedControlSkillIds(item, output, key));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [childKey, childValue] of Object.entries(value)) {
    if (/controlskillid$/i.test(childKey)) {
      const controlSkillId = Number(childValue);
      if (Number.isInteger(controlSkillId)) output.add(controlSkillId);
      continue;
    }
    collectNamedControlSkillIds(childValue, output, childKey);
  }
}

function collectOwnerControls({ mechanicsPackage, reachableControlSkillIds }) {
  const reachable = new Set((reachableControlSkillIds ?? []).map(Number));
  return [
    ...(mechanicsPackage.controlBindings ?? []),
    ...(mechanicsPackage.actionVariantControlBindings ?? []),
  ].filter(control => reachable.has(Number(control.controlSkillId)));
}

function collectOwnerSemanticEffects({
  mechanicsPackage,
  semanticEffectCatalog,
  ownerId,
}) {
  return (
    semanticEffectCatalog?.semanticEffects ??
    mechanicsPackage.semanticEffectCatalog?.semanticEffects ??
    []
  ).filter(effect =>
    (effect.owners ?? []).some(
      owner =>
        owner.ownerKind === 'actor' && Number(owner.ownerId) === Number(ownerId)
    )
  );
}
