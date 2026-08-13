import { normalizeAttackInputSegments } from '../domain/workbenchAttackInputChain';
import { resolveActionHitWillHit } from '../domain/actionHitOverrides';
import { normalizeCombatScenario } from '../domain/combatScenario';
import { isSourceDisplayTextSafe } from '../domain/sourceDisplayText';
import {
  HEADLESS_ASSUMPTION_HASH_ALGORITHM,
  computeHeadlessAssumptionHash,
} from '../domain/headlessAssumptionContract';

const packageUrl = new URL(
  './generated/verified-combat-mechanics-package.json',
  import.meta.url
);

let installedPackage = null;
let packagePromise = null;
let actionMappingByIdentity = new Map();
let controlBindingBySkillId = new Map();
let effectBindingByIdentity = new Map();
let semanticEffectByRawIdentity = new Map();
let semanticFormulaByIdentity = new Map();
let specialResourceProfileByOwnerId = new Map();
let derivedControlContractByOwnerAndControl = new Map();
let switchTriggerProfileByOwnerAndPhase = new Map();
let characterCombatProfileMetadataByOwnerId = new Map();

export async function loadVerifiedCombatMechanicsPackage(fetchImpl = fetch) {
  if (installedPackage) return installedPackage;
  if (!packagePromise) {
    packagePromise = fetchImpl(packageUrl)
      .then(async response => {
        if (!response.ok) {
          throw new Error(
            `Unable to load verified combat mechanics package: ${response.status}`
          );
        }
        return response.json();
      })
      .then(installVerifiedCombatMechanicsPackage)
      .catch(error => {
        packagePromise = null;
        throw error;
      });
  }
  return packagePromise;
}

export function installVerifiedCombatMechanicsPackage(value) {
  const validation = validateVerifiedCombatMechanicsPackage(value);
  if (!validation.valid) {
    throw new Error(
      `Invalid verified combat mechanics package: ${validation.issues.join(', ')}`
    );
  }
  installedPackage = value;
  actionMappingByIdentity = new Map(
    value.actionMappings.map(mapping => [mapping.identity, mapping])
  );
  const allControlBindings = [
    ...value.controlBindings,
    ...(value.actionVariantControlBindings ?? []),
  ];
  controlBindingBySkillId = new Map(
    allControlBindings.map(binding => [binding.controlSkillId, binding])
  );
  effectBindingByIdentity = new Map(
    allControlBindings.flatMap(binding =>
      (binding.effects ?? []).map(effect => [effect.effectIdentity, effect])
    )
  );
  semanticEffectByRawIdentity = new Map();
  semanticFormulaByIdentity = new Map(
    (value.semanticEffectCatalog?.formulas ?? []).map(entry => [
      entry.formulaIdentity,
      entry.formula,
    ])
  );
  for (const sourceEffect of value.semanticEffectCatalog?.semanticEffects ??
    []) {
    const effect = {
      ...sourceEffect,
      formula:
        semanticFormulaByIdentity.get(sourceEffect.formulaIdentity) ?? null,
    };
    for (const identity of effect.rawEffectIdentities ?? []) {
      const effects = semanticEffectByRawIdentity.get(identity) ?? [];
      effects.push(effect);
      semanticEffectByRawIdentity.set(identity, effects);
    }
  }
  specialResourceProfileByOwnerId = new Map(
    (value.specialResourceCatalog?.profiles ?? []).map(profile => [
      Number(profile.ownerId),
      profile,
    ])
  );
  derivedControlContractByOwnerAndControl = new Map(
    (value.actionVariantGraph?.derivedControlContracts ?? []).map(contract => [
      `${contract.ownerKind ?? 'actor'}|${Number(contract.ownerId)}|${Number(
        contract.controlSkillId
      )}`,
      contract,
    ])
  );
  switchTriggerProfileByOwnerAndPhase = new Map(
    (value.switchTriggerCatalog?.profiles ?? []).map(profile => [
      `${Number(profile.ownerId)}|${profile.triggerPhase}`,
      profile,
    ])
  );
  characterCombatProfileMetadataByOwnerId = new Map(
    (value.characterCombatProfileCatalog?.profiles ?? []).map(profile => [
      Number(profile.ownerId),
      profile,
    ])
  );
  return value;
}

export function getInstalledVerifiedCombatMechanicsPackage() {
  return installedPackage;
}

export function getVerifiedCombatActionMapping(action = {}) {
  if (!installedPackage) return null;
  const candidates = findActionMappings(action);
  return candidates.length === 1 ? candidates[0] : null;
}

export function getVerifiedCombatActionMappingByIdentity(identity) {
  return actionMappingByIdentity.get(String(identity ?? '')) ?? null;
}

export function getVerifiedCombatActionInputMapping(action = {}) {
  const actionMapping = getVerifiedCombatActionMapping(action);
  if (!actionMapping) return null;
  const controlBinding = controlBindingBySkillId.get(
    actionMapping.controlSkillId
  );
  return {
    ...actionMapping,
    controlLogic: controlBinding?.logic ?? null,
  };
}

export function getVerifiedSpecialResourceProfile(characterId) {
  return specialResourceProfileByOwnerId.get(Number(characterId)) ?? null;
}

export function getVerifiedActionVariantGraph() {
  return installedPackage?.actionVariantGraph ?? null;
}

export function getVerifiedDerivedControlContract({
  ownerKind = 'actor',
  ownerId = null,
  controlSkillId = null,
} = {}) {
  const normalizedOwnerId = Number(ownerId);
  const normalizedControlSkillId = Number(controlSkillId);
  if (
    !Number.isInteger(normalizedOwnerId) ||
    !Number.isInteger(normalizedControlSkillId)
  ) {
    return null;
  }
  return (
    derivedControlContractByOwnerAndControl.get(
      `${ownerKind}|${normalizedOwnerId}|${normalizedControlSkillId}`
    ) ?? null
  );
}

export function getVerifiedDerivedControlContractForAction(action = {}) {
  const mapping = getVerifiedCombatActionMapping(action);
  if (!mapping) return null;
  const controlSkillId =
    mapping.actionKind === 'normal-attack' && mapping.ownerKind !== 'kibo'
      ? Number(action.attackInput?.controlSkillId)
      : Number(mapping.controlSkillId);
  return getVerifiedDerivedControlContract({
    ownerKind: mapping.ownerKind ?? 'actor',
    ownerId: mapping.ownerId,
    controlSkillId,
  });
}

export function getVerifiedSpecialResourceCatalog() {
  return installedPackage?.specialResourceCatalog ?? null;
}

export function getVerifiedSwitchTriggerCatalog() {
  return installedPackage?.switchTriggerCatalog ?? null;
}

export function getVerifiedCharacterCombatProfileCatalog() {
  return installedPackage?.characterCombatProfileCatalog ?? null;
}

export function getVerifiedCharacterCombatProfileMetadata(ownerId) {
  return characterCombatProfileMetadataByOwnerId.get(Number(ownerId)) ?? null;
}

export function getVerifiedSwitchTriggerProfile(ownerId, triggerPhase = null) {
  const normalizedOwnerId = Number(ownerId);
  if (!Number.isInteger(normalizedOwnerId)) return null;
  if (triggerPhase) {
    return (
      switchTriggerProfileByOwnerAndPhase.get(
        `${normalizedOwnerId}|${triggerPhase}`
      ) ?? null
    );
  }
  return (
    installedPackage?.switchTriggerCatalog?.profiles?.find(
      profile => Number(profile.ownerId) === normalizedOwnerId
    ) ?? null
  );
}

export function clearInstalledVerifiedCombatMechanicsPackage() {
  installedPackage = null;
  packagePromise = null;
  actionMappingByIdentity = new Map();
  controlBindingBySkillId = new Map();
  effectBindingByIdentity = new Map();
  semanticEffectByRawIdentity = new Map();
  semanticFormulaByIdentity = new Map();
  specialResourceProfileByOwnerId = new Map();
  derivedControlContractByOwnerAndControl = new Map();
  switchTriggerProfileByOwnerAndPhase = new Map();
  characterCombatProfileMetadataByOwnerId = new Map();
}

export function resolveVerifiedCombatActionMechanics(
  action = {},
  {
    selectedSubSkillIndex = null,
    selectedControlSkillId = null,
    selectionSource = null,
    combatScenario = null,
  } = {}
) {
  if (!installedPackage) {
    return createUnresolvedActionMechanics(
      action,
      'verified-combat-mechanics-package-not-installed'
    );
  }
  const owner = resolveActionOwner(action);
  const characterCombatProfile =
    characterCombatProfileMetadataByOwnerId.get(Number(owner.id)) ?? null;
  const candidates = findActionMappings(action, owner);
  if (candidates.length !== 1) {
    return createUnresolvedActionMechanics(
      action,
      candidates.length > 1
        ? 'verified-action-binding-ambiguous'
        : 'verified-action-binding-missing',
      {
        owner,
        characterCombatProfile,
        candidateCount: candidates.length,
      }
    );
  }
  const actionMapping = candidates[0];
  const resolvedActionBinding = resolveActionBinding(actionMapping, action);
  if (!resolvedActionBinding.binding) {
    return createUnresolvedActionMechanics(
      action,
      resolvedActionBinding.reason,
      {
        owner,
        characterCombatProfile,
        actionBinding: actionMapping,
        candidateCount: resolvedActionBinding.candidateCount ?? 0,
      }
    );
  }
  const dynamicBinding = applySelectedSubSkillOverride({
    action,
    actionMapping,
    actionBinding: resolvedActionBinding.binding,
    selectedControlSkillId,
    selectedSubSkillIndex:
      selectedSubSkillIndex ?? action.controlSubSkillIndex ?? null,
    selectionSource,
  });
  if (!dynamicBinding.binding) {
    return createUnresolvedActionMechanics(action, dynamicBinding.reason, {
      owner,
      characterCombatProfile,
      actionBinding: resolvedActionBinding.binding,
      selectedSubSkillIndex,
      reasons: dynamicBinding.reasons ?? [],
    });
  }
  const actionBinding = dynamicBinding.binding;
  const hasAppliedSpecialResourceOperation =
    hasVerifiedSpecialResourceOperation(actionBinding);
  const appliedRuntimeEffectBindings =
    getVerifiedRuntimeEffectBindings(actionBinding);
  const hasAppliedRuntimeEffectBinding =
    appliedRuntimeEffectBindings.length > 0;
  if (actionBinding?.classification !== 'applied') {
    const partialControlBinding = controlBindingBySkillId.get(
      actionBinding?.controlSkillId
    );
    const verifiedEmptyNormalAttack =
      createVerifiedEmptyNormalAttackMechanicsProof({
        actionMapping,
        actionBinding,
        controlBinding: partialControlBinding,
        appliedRuntimeEffectBindings,
        hasAppliedSpecialResourceOperation,
      });
    if (verifiedEmptyNormalAttack) {
      return {
        schemaVersion: 1,
        sourceKind: 'azpr-verified-combat-action-mechanics-resolution',
        status: 'verified-combat-action-mechanics-verified-empty-timing-only',
        packageId: installedPackage.packageId,
        packageHash: installedPackage.packageHash,
        owner,
        characterCombatProfile,
        actionBinding,
        controlBinding: partialControlBinding,
        hits: [],
        effects: resolveSelectedEffects(actionBinding, partialControlBinding),
        semanticEffects: resolveSelectedSemanticEffects(actionBinding),
        runtimeEffectBindingIdentities: appliedRuntimeEffectBindings.map(
          binding => binding.bindingIdentity
        ),
        reasons: actionBinding.reasons,
        mechanicsSurface: verifiedEmptyNormalAttack,
        complete: true,
        ready: true,
        applied: true,
      };
    }
    if (
      actionBinding?.selectedSubSkillIndex != null &&
      (Number(partialControlBinding?.logic?.spCost) > 0 ||
        hasAppliedSpecialResourceOperation ||
        hasAppliedRuntimeEffectBinding)
    ) {
      return {
        schemaVersion: 1,
        sourceKind: 'azpr-verified-combat-action-mechanics-resolution',
        status: hasAppliedRuntimeEffectBinding
          ? 'verified-combat-action-mechanics-declarative-runtime-only'
          : 'verified-combat-action-mechanics-resource-only',
        packageId: installedPackage.packageId,
        packageHash: installedPackage.packageHash,
        owner,
        characterCombatProfile,
        actionBinding,
        controlBinding: partialControlBinding,
        hits: [],
        effects: resolveSelectedEffects(actionBinding, partialControlBinding),
        semanticEffects: resolveSelectedSemanticEffects(actionBinding),
        runtimeEffectBindingIdentities: appliedRuntimeEffectBindings.map(
          binding => binding.bindingIdentity
        ),
        reasons: actionBinding.reasons ?? [],
        complete: false,
        ready: true,
        applied: true,
      };
    }
    return createUnresolvedActionMechanics(
      action,
      `verified-action-binding-${actionBinding?.classification ?? 'missing'}`,
      {
        owner,
        characterCombatProfile,
        actionBinding,
        reasons: actionBinding?.reasons ?? [],
      }
    );
  }
  const controlBinding = controlBindingBySkillId.get(
    actionBinding.controlSkillId
  );
  const selectedHitIdentities = new Set(
    actionBinding.selectedHitIdentities ?? []
  );
  const allHits = (controlBinding?.hits ?? []).filter(
    hit =>
      hit.mapIndex === actionBinding.selectedSubSkillIndex &&
      (!selectedHitIdentities.size ||
        selectedHitIdentities.has(hit.hitIdentity))
  );
  const normalizedScenario = normalizeCombatScenario(
    combatScenario ?? action.combatScenario
  );
  const scenarioEligibleHits = allHits.filter(
    hit =>
      hit.scenarioRuntimeStatus !== 'scenario-assumed-zero-distance' ||
      normalizedScenario.projectile.targetDistance === 0
  );
  const directlyEnabledHits = scenarioEligibleHits.filter(hit =>
    resolveActionHitWillHit(
      action,
      hit.hitIdentity,
      hit.referenceKind === 'bulletElements'
        ? normalizedScenario.projectile.defaultWillHit
        : true
    )
  );
  const {
    hits,
    evaluations: hitActivationEvaluations,
    suppressedHitIdentities: hitActivationSuppressedHitIdentities,
  } = resolveHitActivatedHits({
    scenarioEligibleHits,
    directlyEnabledHits,
  });
  const scenarioUnavailableHitIdentities = allHits
    .filter(hit => !scenarioEligibleHits.includes(hit))
    .map(hit => hit.hitIdentity);
  const disabledHitIdentities = allHits
    .filter(
      hit =>
        !resolveActionHitWillHit(
          action,
          hit.hitIdentity,
          hit.referenceKind === 'bulletElements'
            ? normalizedScenario.projectile.defaultWillHit
            : true
        )
    )
    .map(hit => hit.hitIdentity);
  const suppressedHitIdentities = new Set([
    ...disabledHitIdentities,
    ...scenarioUnavailableHitIdentities,
    ...hitActivationSuppressedHitIdentities,
  ]);
  const suppressedHits = allHits.filter(hit =>
    suppressedHitIdentities.has(hit.hitIdentity)
  );
  const effects = resolveSelectedEffects(actionBinding, controlBinding).filter(
    effect => !isEffectTriggeredByDisabledHit(effect, suppressedHits)
  );
  const semanticEffects = resolveSemanticEffectsForRawEffects(effects);
  const hasAppliedCost = Number(controlBinding?.logic?.spCost) > 0;
  const hasAppliedEffect = effects.some(
    effect => effect.classification === 'applied'
  );
  if (
    !controlBinding ||
    (!allHits.length &&
      !hasAppliedCost &&
      !hasAppliedEffect &&
      !hasAppliedSpecialResourceOperation &&
      !hasAppliedRuntimeEffectBinding)
  ) {
    return createUnresolvedActionMechanics(
      action,
      'verified-control-binding-missing',
      { owner, characterCombatProfile, actionBinding }
    );
  }
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-verified-combat-action-mechanics-resolution',
    status: 'verified-combat-action-mechanics-ready',
    packageId: installedPackage.packageId,
    packageHash: installedPackage.packageHash,
    owner,
    characterCombatProfile,
    actionBinding,
    controlBinding,
    hits,
    allHits,
    disabledHitIdentities,
    scenarioUnavailableHitIdentities,
    hitActivationSuppressedHitIdentities,
    hitActivationEvaluations,
    effects,
    semanticEffects,
    runtimeEffectBindingIdentities: appliedRuntimeEffectBindings.map(
      binding => binding.bindingIdentity
    ),
    complete: true,
    effectCoverageComplete: actionBinding.complete !== false,
    reasons: actionBinding.reasons ?? [],
    ready: true,
    applied: true,
    variantSelection: actionBinding.variantSelection ?? null,
  };
}

function createVerifiedEmptyNormalAttackMechanicsProof({
  actionMapping,
  actionBinding,
  controlBinding,
  appliedRuntimeEffectBindings,
  hasAppliedSpecialResourceOperation,
}) {
  const selectedSubSkillIndex = Number(actionBinding?.selectedSubSkillIndex);
  const selectedControlHits = (controlBinding?.hits ?? []).filter(
    hit => Number(hit.mapIndex) === selectedSubSkillIndex
  );
  const selectedControlEffects = (controlBinding?.effects ?? []).filter(
    effect => Number(effect.mapIndex) === selectedSubSkillIndex
  );
  const selectedControlVariants = (controlBinding?.variants ?? []).filter(
    variant => Number(variant.subSkillIndex) === selectedSubSkillIndex
  );
  const selectedControlVariant = selectedControlVariants[0] ?? null;
  if (
    actionMapping?.actionKind !== 'normal-attack' ||
    actionBinding?.durationStatus !== 'applied' ||
    !(Number(actionBinding?.durationFrames) > 0) ||
    !actionBinding?.sourceIdentity ||
    !Number.isInteger(selectedSubSkillIndex) ||
    actionBinding?.reasons?.length !== 1 ||
    actionBinding.reasons[0] !==
      'selected-control-variant-has-no-three-value-elements' ||
    (actionBinding.selectedHitIdentities ?? []).length !== 0 ||
    (actionBinding.selectedEffectIdentities ?? []).length !== 0 ||
    resolveSelectedSemanticEffects(actionBinding).length !== 0 ||
    selectedControlHits.length !== 0 ||
    selectedControlEffects.length !== 0 ||
    (controlBinding?.effectGraph ?? []).length !== 0 ||
    selectedControlVariants.length !== 1 ||
    !selectedControlVariant?.sourceIdentity ||
    [
      'directElementReferenceCount',
      'bulletElementReferenceCount',
      'elementCount',
      'runnableElementCount',
      'effectNodeCount',
      'runnableEffectCount',
    ].some(key => Number(selectedControlVariant[key]) !== 0) ||
    (appliedRuntimeEffectBindings ?? []).length !== 0 ||
    hasAppliedSpecialResourceOperation ||
    Number(controlBinding?.logic?.spCost) !== 0 ||
    !controlBinding?.logic?.sourceIdentity ||
    controlBinding?.logic?.status !== 'verified-skill-logic-ready' ||
    controlBinding?.logic?.applied !== true
  ) {
    return null;
  }
  return {
    kind: 'verified-empty-normal-attack-timing',
    status: 'verified-empty-combat-surface',
    selectedSubSkillIndex,
    durationFrames: Number(actionBinding.durationFrames),
    hitCount: 0,
    effectCount: 0,
    runtimeEffectCount: 0,
    specialResourceOperationCount: 0,
    spCost: 0,
    sourceIdentity: [
      actionBinding.sourceIdentity,
      selectedControlVariant.sourceIdentity,
      controlBinding.logic.sourceIdentity,
    ]
      .filter(Boolean)
      .join('|'),
    reason: actionBinding.reasons[0],
  };
}

function resolveHitActivatedHits({
  scenarioEligibleHits,
  directlyEnabledHits,
}) {
  let activeHits = [...directlyEnabledHits];
  let evaluations = [];
  for (let pass = 0; pass <= scenarioEligibleHits.length; pass += 1) {
    const activeHitIdentities = new Set(
      activeHits.map(hit => String(hit.hitIdentity))
    );
    const nextEvaluations = directlyEnabledHits
      .filter(hit => hit.hitActivation?.applied)
      .map(hit =>
        evaluateHitActivation({
          hit,
          scenarioEligibleHits,
          activeHitIdentities,
        })
      );
    const appliedByIdentity = new Map(
      nextEvaluations.map(evaluation => [
        evaluation.hitIdentity,
        evaluation.applied,
      ])
    );
    const nextActiveHits = directlyEnabledHits.filter(
      hit => appliedByIdentity.get(String(hit.hitIdentity)) !== false
    );
    evaluations = nextEvaluations;
    if (
      nextActiveHits.length === activeHits.length &&
      nextActiveHits.every(
        (hit, index) => hit.hitIdentity === activeHits[index]?.hitIdentity
      )
    ) {
      activeHits = nextActiveHits;
      break;
    }
    activeHits = nextActiveHits;
  }
  const activeHitIdentities = new Set(
    activeHits.map(hit => String(hit.hitIdentity))
  );
  evaluations = directlyEnabledHits
    .filter(hit => hit.hitActivation?.applied)
    .map(hit =>
      evaluateHitActivation({
        hit,
        scenarioEligibleHits,
        activeHitIdentities,
      })
    );
  return {
    hits: activeHits,
    evaluations,
    suppressedHitIdentities: evaluations
      .filter(evaluation => !evaluation.applied)
      .map(evaluation => evaluation.hitIdentity),
  };
}

function evaluateHitActivation({
  hit,
  scenarioEligibleHits,
  activeHitIdentities,
}) {
  const condition = hit.hitActivation;
  const matchingHits = scenarioEligibleHits.filter(sourceHit => {
    if (Number(sourceHit.elementId) !== Number(condition.elementId)) {
      return false;
    }
    if (
      condition.triggerFrames?.length > 0 &&
      !condition.triggerFrames.includes(Number(sourceHit.trigger?.startFrame))
    ) {
      return false;
    }
    if (
      condition.includeConditionalHits === false &&
      sourceHit.conditionalGroupIdentity
    ) {
      return false;
    }
    if (
      condition.conditionalGroupIdentity != null &&
      sourceHit.conditionalGroupIdentity !== condition.conditionalGroupIdentity
    ) {
      return false;
    }
    if (
      condition.sourceBindingIdentity != null &&
      sourceHit.sourceBindingIdentity !== condition.sourceBindingIdentity
    ) {
      return false;
    }
    return true;
  });
  const landedHits = matchingHits.filter(sourceHit =>
    activeHitIdentities.has(String(sourceHit.hitIdentity))
  );
  const boundedLandedCount = Math.min(
    landedHits.length,
    condition.maximumLandedCount ?? Number.POSITIVE_INFINITY
  );
  const applied = boundedLandedCount >= condition.minimumLandedCount;
  return {
    hitIdentity: String(hit.hitIdentity),
    sourceBindingIdentity: hit.sourceBindingIdentity ?? null,
    conditionKind: condition.kind,
    matchingHitIdentities: matchingHits.map(sourceHit =>
      String(sourceHit.hitIdentity)
    ),
    landedHitIdentities: landedHits.map(sourceHit =>
      String(sourceHit.hitIdentity)
    ),
    matchingHitCount: matchingHits.length,
    landedHitCount: landedHits.length,
    boundedLandedCount,
    reason: applied
      ? 'required-source-hit-landed'
      : 'required-source-hit-not-landed',
    sourceIdentity: condition.sourceIdentity ?? null,
    status: applied
      ? 'verified-action-hit-activation-applied'
      : 'verified-action-hit-activation-suppressed',
    applied,
  };
}

function hasVerifiedSpecialResourceOperation(actionBinding) {
  return (
    installedPackage?.specialResourceCatalog?.operationBindings?.some(
      operation =>
        operation.applied === true &&
        Number(operation.ownerId) === Number(actionBinding?.ownerId) &&
        Number(operation.controlSkillId) ===
          Number(actionBinding?.controlSkillId) &&
        Number(operation.subSkillIndex) ===
          Number(actionBinding?.selectedSubSkillIndex)
    ) ?? false
  );
}

function getVerifiedRuntimeEffectBindings(actionBinding) {
  const ownerId = Number(actionBinding?.ownerId);
  const controlSkillId = Number(actionBinding?.controlSkillId);
  const subSkillIndex = Number(actionBinding?.selectedSubSkillIndex);
  if (
    !Number.isInteger(ownerId) ||
    !Number.isInteger(controlSkillId) ||
    !Number.isInteger(subSkillIndex)
  ) {
    return [];
  }
  return (
    installedPackage?.actionVariantGraph?.runtimeEffectBindings ?? []
  ).filter(
    binding =>
      binding.applied === true &&
      Number(binding.ownerId) === ownerId &&
      Number(binding.controlSkillId) === controlSkillId &&
      Number(binding.subSkillIndex) === subSkillIndex
  );
}

function isEffectTriggeredByDisabledHit(effect, disabledHits) {
  const landedCondition = effect?.landedHitActivationCondition;
  if (
    landedCondition?.applied === true &&
    disabledHits.some(
      hit => String(hit.hitIdentity) === String(landedCondition.hitIdentity)
    )
  ) {
    return true;
  }
  const launchIdentity = String(effect?.trigger?.launchIdentity ?? '');
  const launchEventIdentity = createLaunchEventIdentity(launchIdentity);
  if (
    launchEventIdentity &&
    disabledHits.some(
      hit =>
        createLaunchEventIdentity(hit?.trigger?.launchIdentity) ===
        launchEventIdentity
    )
  ) {
    return true;
  }
  const effectPathId = String(effect?.pathId ?? '');
  const effectFrame = frameOrNull(effect?.trigger?.startFrame);
  if (!effectPathId || effectFrame == null) return false;
  return disabledHits.some(
    hit =>
      String(hit?.pathId ?? '') === effectPathId &&
      frameOrNull(hit?.trigger?.impactFrame ?? hit?.trigger?.startFrame) ===
        effectFrame
  );
}

function createLaunchEventIdentity(value) {
  const identity = String(value ?? '');
  const actionIndex = identity.indexOf('|action:');
  return actionIndex >= 0 ? identity.slice(0, actionIndex) : identity;
}

function frameOrNull(value) {
  const frame = Number(value);
  return Number.isFinite(frame) && frame >= 0 ? frame : null;
}

function resolveSemanticEffectsForRawEffects(effects) {
  const semanticEffects = effects.flatMap(
    effect => semanticEffectByRawIdentity.get(effect.effectIdentity) ?? []
  );
  return [
    ...new Map(
      semanticEffects.map(effect => [effect.semanticIdentity, effect])
    ).values(),
  ];
}

function applySelectedSubSkillOverride({
  action,
  actionMapping,
  actionBinding,
  selectedControlSkillId,
  selectedSubSkillIndex,
  selectionSource,
}) {
  if (selectedSubSkillIndex == null) return { binding: actionBinding };
  const subSkillIndex = Number(selectedSubSkillIndex);
  const publicControlSkillId = Number(actionBinding.controlSkillId);
  const executionControlSkillId = Number(
    selectedControlSkillId ?? publicControlSkillId
  );
  const controlBinding = controlBindingBySkillId.get(executionControlSkillId);
  const variant = (controlBinding?.variants ?? []).find(
    item => Number(item.subSkillIndex) === subSkillIndex
  );
  if (!variant) {
    return {
      binding: null,
      reason: 'verified-action-selected-variant-missing',
      reasons: ['selected-control-subskill-index-missing'],
    };
  }
  const timingCandidates =
    executionControlSkillId === publicControlSkillId
      ? actionBinding.attackInputSegment
        ? actionBinding.attackInputSegment.variantTimings
        : actionMapping.actionTiming?.variantTimings
      : [];
  const timing =
    (selectionSource?.executionTiming &&
    Number(selectionSource.executionTiming.subSkillIndex) === subSkillIndex
      ? selectionSource.executionTiming
      : null) ??
    (timingCandidates ?? []).find(
      item => Number(item.subSkillIndex) === subSkillIndex
    );
  if (!timing) {
    return {
      binding: null,
      reason: 'verified-action-selected-variant-timing-missing',
      reasons: ['selected-control-player-variant-timing-missing'],
    };
  }
  const exactTiming = timing.occupancy?.status === 'applied';
  const planningDurationFrames = Number(
    action?.actionScheduling?.planningDurationFrames ??
      timing.animation?.durationFrames
  );
  if (!exactTiming && !(planningDurationFrames > 0)) {
    return {
      binding: null,
      reason: 'verified-action-selected-variant-duration-unresolved',
      reasons: timing.occupancy?.reasons ?? [
        'selected-control-player-variant-duration-unresolved',
      ],
    };
  }
  const hits = (controlBinding?.hits ?? []).filter(
    hit => Number(hit.mapIndex) === subSkillIndex
  );
  const effects = (controlBinding?.effects ?? []).filter(
    effect => Number(effect.mapIndex) === subSkillIndex
  );
  const hasAppliedCost = Number(controlBinding?.logic?.spCost) > 0;
  const hasAppliedEffect = effects.some(
    effect => effect.classification === 'applied'
  );
  const classification =
    hits.length > 0 || hasAppliedCost || hasAppliedEffect
      ? 'applied'
      : effects.length > 0 &&
          effects.every(effect => effect.classification === 'verified-zero')
        ? 'verified-zero'
        : 'unresolved';
  const variantSelection = {
    selectedSubSkillIndex: subSkillIndex,
    defaultSubSkillIndex: actionBinding.selectedSubSkillIndex,
    changed:
      Number(actionBinding.selectedSubSkillIndex) !== Number(subSkillIndex),
    sourceKind:
      selectionSource?.sourceKind ?? 'verified-action-variant-runtime',
    sourceIdentity:
      selectionSource?.sourceIdentity ?? variant.sourceIdentity ?? null,
    decisionFrame: Number(selectionSource?.decisionFrame) || 0,
    status: 'verified-action-variant-selected',
  };
  return {
    binding: {
      ...actionBinding,
      identity: [
        actionBinding.identity,
        `execution-control:${executionControlSkillId}`,
        `sub:${subSkillIndex}`,
      ].join('|'),
      publicControlSkillId,
      controlSkillId: executionControlSkillId,
      executionControlSkillId,
      selectedSubSkillIndex: subSkillIndex,
      semanticIdentity: selectionSource?.semanticIdentity ?? null,
      semanticName:
        selectionSource?.semanticName ??
        actionBinding.actionName ??
        action.name ??
        null,
      ...(actionBinding.attackInputSegment
        ? {
            attackInputSegment: {
              ...actionBinding.attackInputSegment,
              selectedSubSkillIndex: subSkillIndex,
              playerSkillId: variant.playerSkillId ?? null,
              resourceMapIndex: variant.resourceMapIndex ?? null,
              durationFrames: exactTiming
                ? timing.occupancy.durationFrames
                : null,
              effectiveDurationFrames: exactTiming
                ? timing.occupancy.durationFrames
                : null,
              durationStatus: exactTiming ? 'applied' : 'unresolved',
              durationBasis: exactTiming
                ? timing.occupancy.sourceKind
                : 'source-animation-planning-duration',
              durationSourceIdentity:
                timing.occupancy.sourceIdentity ??
                timing.animation?.sourceIdentity ??
                null,
              actionScheduling: action.actionScheduling ?? null,
              classification,
              reasons: [],
            },
          }
        : {}),
      selectedHitIdentities: hits.map(hit => hit.hitIdentity),
      selectedEffectIdentities: effects.map(effect => effect.effectIdentity),
      runtimeHitCount: hits.length,
      runtimeEffectCount: effects.filter(
        effect => effect.classification === 'applied'
      ).length,
      classification,
      runtimeReady: classification === 'applied',
      timingStatus: exactTiming ? 'applied' : 'unresolved',
      actionTiming: {
        ...(actionBinding.actionTiming ?? actionMapping.actionTiming),
        status: exactTiming ? 'applied' : 'unresolved',
        selectedSubSkillIndex: subSkillIndex,
        occupancy: timing.occupancy,
        animation: timing.animation,
        input: timing.input,
        sourceIdentity:
          timing.occupancy.sourceIdentity ?? timing.animation?.sourceIdentity,
        reasons: exactTiming ? [] : (timing.occupancy?.reasons ?? []),
      },
      variantSelection,
      animationDurationFrames: timing.animation?.durationFrames ?? null,
      effectiveOccupancyFrames: Number(
        exactTiming ? timing.occupancy.durationFrames : planningDurationFrames
      ),
      actualDurationFrames: exactTiming
        ? timing.occupancy.durationFrames
        : planningDurationFrames,
      actualDurationMs:
        (Number(
          exactTiming ? timing.occupancy.durationFrames : planningDurationFrames
        ) *
          1000) /
        (Number(timing.frameRate) || 60),
    },
  };
}

function resolveSelectedEffects(actionBinding, controlBinding) {
  const selectedEffectIdentities = new Set(
    actionBinding?.selectedEffectIdentities ?? []
  );
  if (selectedEffectIdentities.size === 0) return [];
  return [...selectedEffectIdentities]
    .map(
      identity =>
        effectBindingByIdentity.get(identity) ??
        (controlBinding?.effects ?? []).find(
          effect => effect.effectIdentity === identity
        )
    )
    .filter(Boolean);
}

function resolveSelectedSemanticEffects(actionBinding) {
  const selectedEffectIdentities = new Set(
    actionBinding?.selectedEffectIdentities ?? []
  );
  const semanticEffects = [...selectedEffectIdentities].flatMap(
    identity => semanticEffectByRawIdentity.get(identity) ?? []
  );
  return [
    ...new Map(
      semanticEffects.map(effect => [effect.semanticIdentity, effect])
    ).values(),
  ];
}

export function createVerifiedCombatActionBindingIdentity({
  ownerKind,
  ownerId,
  sourceSkillId,
  actionVariantIndex,
  controlSkillId,
  actionKind,
} = {}) {
  const identity = [
    ownerKind ?? 'unknown',
    Number(ownerId) || 0,
    Number(sourceSkillId) || 0,
    Math.max(0, Number(actionVariantIndex) || 0),
    controlSkillId == null ? '' : Number(controlSkillId) || 0,
  ];
  if (actionKind != null && String(actionKind) !== '') {
    identity.push(String(actionKind));
  }
  return identity.join('|');
}

export function validateVerifiedCombatMechanicsPackage(value) {
  const issues = [];
  if (value?.schemaVersion !== 1) issues.push('schema-version-invalid');
  if (value?.kind !== 'azpr-verified-combat-mechanics-package') {
    issues.push('package-kind-invalid');
  }
  if (value?.status !== 'verified-combat-mechanics-package-ready') {
    issues.push('package-status-invalid');
  }
  if (!/^[a-f0-9]{64}$/.test(String(value?.packageHash ?? ''))) {
    issues.push('package-hash-invalid');
  }
  if (
    value?.mechanismEvidence?.status !==
      'verified-mechanism-evidence-manifest-ready' ||
    !Array.isArray(value?.mechanismEvidence?.sources) ||
    value.mechanismEvidence.sources.length < 7 ||
    value.mechanismEvidence.sources.some(
      source =>
        source.validationStatus !== 'verified-source-structure-ready' ||
        !/^[a-f0-9]{64}$/.test(String(source.sha256 ?? ''))
    )
  ) {
    issues.push('mechanism-evidence-invalid');
  }
  if (
    value?.staticPropertyCatalog?.status !==
      'verified-static-property-catalog-ready' ||
    value?.staticPropertyCatalog?.identityAudit?.verifiedActorCount !== 17 ||
    value?.staticPropertyCatalog?.identityAudit?.verifiedKiboCount !== 147
  ) {
    issues.push('static-property-catalog-invalid');
  }
  if (
    value?.validation?.status !== 'verified-18-of-18' ||
    value?.validation?.passed !== 18 ||
    value?.validation?.failed !== 0
  ) {
    issues.push('package-validation-invalid');
  }
  if (!Array.isArray(value?.actionBindings)) {
    issues.push('action-bindings-missing');
  }
  if (
    !Array.isArray(value?.actionMappings) ||
    value.actionMappings.length !== value?.summary?.candidateActionCount ||
    value.actionMappings.some(
      mapping =>
        !['applied', 'verified-zero', 'unresolved'].includes(
          mapping.classification
        )
    )
  ) {
    issues.push('action-mappings-invalid');
  }
  if (!Array.isArray(value?.controlBindings)) {
    issues.push('control-bindings-missing');
  }
  if (!Array.isArray(value?.actionVariantControlBindings)) {
    issues.push('action-variant-control-bindings-missing');
  }
  if (
    value?.packageVersion < 13 ||
    value?.battleEffectCatalog?.status !==
      'verified-battle-effect-node-catalog-ready' ||
    !Array.isArray(value?.battleEffectCatalog?.nodes) ||
    value.battleEffectCatalog.nodes.some(
      node =>
        !node.catalogIdentity ||
        !['applied', 'verified-zero', 'unresolved'].includes(
          node.classification
        )
    ) ||
    [
      ...(value?.controlBindings ?? []),
      ...(value?.actionVariantControlBindings ?? []),
    ].some(binding =>
      (binding.effectGraph ?? []).some(
        root =>
          !Array.isArray(root.nodeIdentities) ||
          Object.hasOwn(root, 'nodes') ||
          (Object.hasOwn(root, 'nodeClassifications') &&
            !isPublishedControlRootNodeClassificationValid(root))
      )
    )
  ) {
    issues.push('battle-effect-catalog-invalid');
  }
  if (
    value?.semanticEffectCatalog?.status !==
      'verified-semantic-battle-effect-runtime-catalog-ready' ||
    !Array.isArray(value?.semanticEffectCatalog?.semanticEffects) ||
    !Array.isArray(value?.semanticEffectCatalog?.formulas) ||
    value.semanticEffectCatalog.summary?.runtimeEffectCount !==
      value.semanticEffectCatalog.semanticEffects.length ||
    value.semanticEffectCatalog.summary?.runtimeFormulaCount !==
      value.semanticEffectCatalog.formulas.length ||
    value.semanticEffectCatalog.formulas.some(
      entry => !entry.formulaIdentity || !entry.formula
    ) ||
    value.semanticEffectCatalog.semanticEffects.some(
      effect =>
        !effect.semanticIdentity ||
        effect.role !== 'gameplay-effect' ||
        effect.classification !== 'applied' ||
        effect.placementResolution !== 'static-resolved' ||
        !effect.formulaIdentity ||
        !value.semanticEffectCatalog.formulas.some(
          entry => entry.formulaIdentity === effect.formulaIdentity
        )
    )
  ) {
    issues.push('semantic-effect-catalog-invalid');
  }
  if (
    value?.specialResourceCatalog?.status !==
      'verified-special-resource-catalog-ready' ||
    !Array.isArray(value.specialResourceCatalog.profiles) ||
    value.specialResourceCatalog.profiles.some(
      profile =>
        profile.applied !== true ||
        !profile.resourceIdentity ||
        !(Number(profile.capacity) > 0)
    ) ||
    !Array.isArray(value.specialResourceCatalog.operationBindings) ||
    !Array.isArray(value.specialResourceCatalog.thresholdTransitions) ||
    value.specialResourceCatalog.thresholdTransitions.some(
      transition =>
        transition.applied !== true ||
        !(Number(transition.threshold) > 0) ||
        !Number.isInteger(Number(transition.stateElementId))
    ) ||
    !Array.isArray(value.specialResourceCatalog.passiveEffects) ||
    value.specialResourceCatalog.passiveEffects.some(
      profile =>
        profile.applied !== true ||
        !Array.isArray(profile.triggerBindings) ||
        (profile.triggerBindings.length === 0 &&
          profile.runtimeGenerationMode !==
            'tuning-mark-threshold-property-runtime') ||
        !Array.isArray(profile.modifiers) ||
        profile.modifiers.length === 0
    )
  ) {
    issues.push('special-resource-catalog-invalid');
  }
  if (
    value?.actionVariantGraph?.status !==
      'verified-action-variant-graph-ready' ||
    !Array.isArray(value.actionVariantGraph.nodes) ||
    !Array.isArray(value.actionVariantGraph.edges) ||
    !Array.isArray(value.actionVariantGraph.defaultSelections) ||
    !Array.isArray(value.actionVariantGraph.contextEdges) ||
    value.actionVariantGraph.contextEdges.some(
      edge =>
        edge.applied !== true || !isVerifiedContextEdgeIdentityConsistent(edge)
    ) ||
    !Array.isArray(value.actionVariantGraph.attackInputChains) ||
    value.actionVariantGraph.attackInputChains.some(
      chain =>
        chain.applied !== true ||
        !Array.isArray(chain.segments) ||
        chain.segments.length === 0
    )
  ) {
    issues.push('action-variant-graph-invalid');
  }
  const assumptionContracts =
    value?.actionVariantGraph?.headlessAssumptionContracts ?? [];
  const chargingReleaseBindings =
    value?.actionVariantGraph?.chargingReleaseBindings ?? [];
  const breakTriggerWatchers =
    value?.actionVariantGraph?.breakTriggerWatchers ?? [];
  const assumptionContractByOwnerId = new Map(
    assumptionContracts.map(contract => [Number(contract.ownerId), contract])
  );
  const recomputedAssumptionHashByOwnerId = new Map(
    assumptionContracts.map(contract => [
      Number(contract.ownerId),
      computeHeadlessAssumptionHash(contract),
    ])
  );
  if (
    assumptionContracts.some(
      contract =>
        contract.applied !== true ||
        contract.policyAuthority !== 'user-approved-headless-assumption' ||
        contract.clientParityReady !== false ||
        !String(contract.assumptionVersion ?? '').trim() ||
        contract.assumptionHashAlgorithm !==
          HEADLESS_ASSUMPTION_HASH_ALGORITHM ||
        !/^[a-f0-9]{64}$/.test(String(contract.assumptionHash ?? '')) ||
        contract.assumptionHash !==
          recomputedAssumptionHashByOwnerId.get(Number(contract.ownerId)) ||
        !Array.isArray(contract.assumptions) ||
        contract.assumptions.length === 0 ||
        contract.assumptions.some(
          assumption =>
            ![
              'resolved-by-product-assumption',
              'resolved-by-installed-client-static-evidence',
            ].includes(assumption.resolution) ||
            !String(assumption.identity ?? '').trim()
        )
    ) ||
    [...chargingReleaseBindings, ...breakTriggerWatchers].some(binding => {
      const contract = assumptionContractByOwnerId.get(Number(binding.ownerId));
      const recomputedAssumptionHash = recomputedAssumptionHashByOwnerId.get(
        Number(binding.ownerId)
      );
      return (
        binding.applied !== true ||
        !contract ||
        binding.assumptionVersion !== contract.assumptionVersion ||
        binding.assumptionHash !== recomputedAssumptionHash ||
        !contract.assumptions.some(
          assumption => assumption.identity === binding.assumptionIdentity
        )
      );
    })
  ) {
    issues.push('headless-assumption-contract-invalid');
  }
  if (!hasValidSwitchTriggerCatalog(value?.switchTriggerCatalog)) {
    issues.push('switch-trigger-catalog-invalid');
  }
  if (
    value?.characterCombatProfileCatalog?.status !==
      'character-combat-profile-catalog-ready' ||
    value.characterCombatProfileCatalog.profileSchema !==
      'azpr://schemas/character-combat-profile/v1' ||
    !/^[a-f0-9]{64}$/.test(
      String(value.characterCombatProfileCatalog.sourcePackageHash ?? '')
    ) ||
    !Array.isArray(value.characterCombatProfileCatalog.profiles) ||
    value.characterCombatProfileCatalog.summary?.publicCharacterCount !== 20 ||
    value.characterCombatProfileCatalog.summary?.compiledProfileCount !==
      value.characterCombatProfileCatalog.profiles.length ||
    value.characterCombatProfileCatalog.summary?.runtimeAppliedProfileCount !==
      value.characterCombatProfileCatalog.profiles.filter(profile =>
        ['runtime-applied', 'ui-verified'].includes(profile.pipelineMaturity)
      ).length ||
    value.characterCombatProfileCatalog.summary?.uiVerifiedProfileCount !==
      value.characterCombatProfileCatalog.profiles.filter(
        profile => profile.pipelineMaturity === 'ui-verified'
      ).length ||
    value.characterCombatProfileCatalog.summary?.characterCompleteCount !==
      value.characterCombatProfileCatalog.profiles.filter(
        profile => profile.characterComplete === true
      ).length ||
    value.characterCombatProfileCatalog.profiles.some(
      profile =>
        !Number.isInteger(Number(profile.ownerId)) ||
        !profile.profileIdentity ||
        !/^[a-f0-9]{64}$/.test(String(profile.profileHash ?? '')) ||
        !/^[a-f0-9]{64}$/.test(String(profile.runtimeContractHash ?? '')) ||
        !['profile-compiled', 'runtime-applied', 'ui-verified'].includes(
          profile.pipelineMaturity
        ) ||
        !['evidence-required', 'partial', 'complete'].includes(
          profile.combatCoverageState
        ) ||
        profile.completionState !== profile.pipelineMaturity ||
        !profile.sourcePath ||
        profile.status !== 'character-combat-profile-valid'
    ) ||
    value?.summary?.characterCombatProfileCount !==
      value.characterCombatProfileCatalog.summary.compiledProfileCount ||
    value?.summary?.characterCombatRuntimeAppliedProfileCount !==
      value.characterCombatProfileCatalog.summary.runtimeAppliedProfileCount ||
    value?.summary?.characterCombatUiVerifiedProfileCount !==
      value.characterCombatProfileCatalog.summary.uiVerifiedProfileCount ||
    value?.summary?.characterCombatCompleteProfileCount !==
      value.characterCombatProfileCatalog.summary.characterCompleteCount
  ) {
    issues.push('character-combat-profile-catalog-invalid');
  }
  if (
    value?.tuningMechanicsCatalog?.status !==
      'verified-tuning-mechanics-catalog-ready' ||
    !Array.isArray(value?.tuningMechanicsCatalog?.profiles) ||
    value.tuningMechanicsCatalog.profiles.length !== 9 ||
    new Set(
      value.tuningMechanicsCatalog.profiles.map(profile => profile.markId)
    ).size !== 9 ||
    value.tuningMechanicsCatalog.profiles.some(
      profile =>
        profile.applied !== true ||
        profile.maxStacks !== 5 ||
        profile.layerDurationMs !== 20_000 ||
        profile.heldReadyMs !== 5_000 ||
        !profile.overlimitPacket?.sourceIdentity
    )
  ) {
    issues.push('tuning-mechanics-catalog-invalid');
  }
  if (!hasValidAttackInputChains(value)) {
    issues.push('attack-input-segments-invalid');
  }
  if (!hasValidActionTimingContracts(value)) {
    issues.push('action-timing-contracts-invalid');
  }
  if (!Array.isArray(value?.ownerProfiles?.enemy)) {
    issues.push('enemy-profiles-missing');
  }
  if (
    value?.spUnitContract?.status !== 'verified-sp-unit-contract-ready' ||
    value?.spUnitContract?.valueUnit !== 'absolute-sp-points'
  ) {
    issues.push('sp-unit-contract-invalid');
  }
  if (
    !Array.isArray(value?.ownerProfiles?.actor) ||
    value.ownerProfiles.actor.some(
      profile =>
        Number(profile.maxSpBase) !== 1 ||
        Number(profile.maxSpGrowthMultiplier) !== 100 ||
        Number(profile.effectiveMaxSp) !== 100
    )
  ) {
    issues.push('actor-sp-profiles-invalid');
  }
  if (
    !Array.isArray(value?.ownerProfiles?.kibo) ||
    value.ownerProfiles.kibo.some(
      profile =>
        Number(profile.maxSpBase) !== 1 ||
        Number(profile.maxSpGrowthMultiplier) !== 100 ||
        Number(profile.effectiveMaxSp) !== 100
    )
  ) {
    issues.push('kibo-sp-profiles-invalid');
  }
  if (
    Number(value?.packageVersion) >= 14 &&
    !hasSafePublishedSourceDisplayLabels(value)
  ) {
    issues.push('published-source-display-label-invalid');
  }
  return {
    valid: issues.length === 0,
    status: issues.length
      ? 'verified-combat-mechanics-package-invalid'
      : 'verified-combat-mechanics-package-valid',
    issues,
  };
}

function isVerifiedContextEdgeIdentityConsistent(edge) {
  const expectedIdentity = [
    `actor:${Number(edge?.ownerId)}`,
    `control:${Number(edge?.sourceControlSkillId)}`,
    `sub:${Number(edge?.sourceSubSkillIndex)}`,
    `context:${Number(edge?.inputWindow?.startFrame)}-${Number(
      edge?.inputWindow?.endFrame
    )}`,
    `public-control:${Number(edge?.targetControlSkillId)}`,
    `execution-control:${Number(edge?.executionControlSkillId)}`,
    `sub:${Number(edge?.targetSubSkillIndex)}`,
  ].join('|');
  return String(edge?.edgeIdentity ?? '') === expectedIdentity;
}

function isPublishedControlRootNodeClassificationValid(root) {
  if (
    !Array.isArray(root.nodeClassifications) ||
    root.nodeClassifications.length !== root.nodeIdentities.length
  ) {
    return false;
  }
  const expectedIdentities = [...root.nodeIdentities].map(String).sort();
  const actualIdentities = root.nodeClassifications
    .map(node => String(node?.nodeCatalogIdentity ?? ''))
    .sort();
  if (
    new Set(actualIdentities).size !== actualIdentities.length ||
    expectedIdentities.some(
      (identity, index) => identity !== actualIdentities[index]
    )
  ) {
    return false;
  }
  const counts = {
    applied: 0,
    'verified-zero': 0,
    unresolved: 0,
  };
  for (const node of root.nodeClassifications) {
    if (
      !node?.nodeCatalogIdentity ||
      !node.nodeIdentity ||
      !Number.isInteger(node.sourceTraversalIndex) ||
      node.sourceTraversalIndex < 0 ||
      !Number.isInteger(node.elementId) ||
      node.elementId <= 0 ||
      !String(node.kind ?? '').trim() ||
      !Object.hasOwn(counts, node.classification) ||
      !Array.isArray(node.reasons) ||
      !String(node.sourceIdentity ?? '').trim() ||
      ['damage', 'toughness', 'sp'].some(
        dimension =>
          !['applied', 'verified-zero', 'unresolved'].includes(
            node.dimensions?.[dimension]?.status
          )
      )
    ) {
      return false;
    }
    counts[node.classification] += 1;
  }
  return (
    counts.applied === Number(root.appliedNodeCount ?? 0) &&
    counts['verified-zero'] === Number(root.verifiedZeroNodeCount ?? 0) &&
    counts.unresolved === Number(root.unresolvedNodeCount ?? 0)
  );
}

function hasValidSwitchTriggerCatalog(catalog) {
  if (
    catalog?.status !== 'verified-switch-trigger-catalog-ready' ||
    !Array.isArray(catalog.profiles) ||
    catalog.profiles.length !== 20
  ) {
    return false;
  }
  const profiles = catalog.profiles;
  const appliedProfiles = profiles.filter(profile => profile.applied === true);
  const unresolvedProfiles = profiles.filter(
    profile => profile.applied !== true
  );
  const onEnterProfiles = profiles.filter(
    profile => profile.triggerPhase === 'on-enter'
  );
  const onExitProfiles = profiles.filter(
    profile => profile.triggerPhase === 'on-exit'
  );
  const summary = catalog.summary ?? {};
  return (
    summary.profileCount === profiles.length &&
    summary.appliedProfileCount === appliedProfiles.length &&
    summary.unresolvedProfileCount === unresolvedProfiles.length &&
    summary.onEnterProfileCount === onEnterProfiles.length &&
    summary.onExitProfileCount === onExitProfiles.length &&
    summary.appliedOnEnterProfileCount ===
      onEnterProfiles.filter(profile => profile.applied === true).length &&
    summary.appliedOnExitProfileCount ===
      onExitProfiles.filter(profile => profile.applied === true).length &&
    summary.switchTriggeredOnlyCount ===
      profiles.filter(
        profile => profile.manualReleaseStatus === 'switch-trigger-only'
      ).length &&
    profiles.every(
      profile =>
        ['on-enter', 'on-exit'].includes(profile.triggerPhase) &&
        [201, 203].includes(Number(profile.skillSlot)) &&
        Boolean(profile.sourceIdentity) &&
        Array.isArray(profile.sourceIdentities) &&
        profile.sourceIdentities.length >= 3 &&
        (profile.applied === true
          ? Boolean(profile.starCarryActionIdentity) &&
            profile.resolutionStatus === 'applied'
          : profile.resolutionStatus === 'static-evidence-gap')
    )
  );
}

function hasSafePublishedSourceDisplayLabels(value) {
  const hits = [
    ...(value?.controlBindings ?? []),
    ...(value?.actionVariantControlBindings ?? []),
  ].flatMap(binding => binding.hits ?? []);
  const specialResources = value?.specialResourceCatalog?.profiles ?? [];
  const published = [
    ...hits,
    ...(value?.battleEffectCatalog?.nodes ?? []),
    ...(value?.semanticEffectCatalog?.semanticEffects ?? []),
    ...specialResources,
    ...specialResources.flatMap(profile => profile.stateElements ?? []),
    ...(value?.specialResourceCatalog?.passiveEffects ?? []).map(profile => ({
      displayLabel: profile.name,
      sourceNameStatus: 'source-name-ready',
    })),
  ];
  return published.every(
    entry =>
      typeof entry?.displayLabel === 'string' &&
      entry.displayLabel.length > 0 &&
      isSourceDisplayTextSafe(entry.displayLabel) &&
      [
        'source-name-ready',
        'source-name-missing',
        'corrupt-source-encoding',
      ].includes(entry.sourceNameStatus)
  );
}

function resolveActionOwner(action) {
  const kiboId = Number(action.kiboId ?? action.actor?.loadout?.kiboId);
  if (action.type === 'kiboEvent' && Number.isInteger(kiboId) && kiboId > 0) {
    return { kind: 'kibo', id: kiboId };
  }
  const characterId = Number(
    action.actor?.characterId ?? action.actorCharacterId
  );
  return {
    kind: 'actor',
    id: Number.isInteger(characterId) && characterId > 0 ? characterId : null,
  };
}

function findActionMappings(action, owner = resolveActionOwner(action)) {
  const identity = createVerifiedCombatActionBindingIdentity({
    ownerKind: owner.kind,
    ownerId: owner.id,
    sourceSkillId: action.skillId,
    actionVariantIndex:
      action.actionVariantIndex ?? action.damageSegmentIndex ?? 0,
    controlSkillId: null,
  });
  const prefix = identity.slice(0, identity.lastIndexOf('|') + 1);
  const matches = installedPackage.actionMappings.filter(mapping =>
    mapping.identity.startsWith(prefix)
  );
  const requestedKind = String(
    action.actionKind ?? action.eventType ?? action.intent?.actionKind ?? ''
  ).trim();
  if (!requestedKind || matches.length <= 1) {
    return matches;
  }
  const kindMatches = matches.filter(
    mapping => String(mapping.actionKind) === requestedKind
  );
  return kindMatches.length === 1 ? kindMatches : matches;
}

function resolveActionBinding(actionMapping, action) {
  if (
    actionMapping?.actionKind !== 'normal-attack' ||
    actionMapping?.ownerKind === 'kibo'
  ) {
    return { binding: actionMapping };
  }
  const segmentIdentity = String(action.attackInput?.identity ?? '').trim();
  const controlSkillId = Number(action.attackInput?.controlSkillId);
  const sequenceIndex = Number(action.attackSequenceIndex);
  if (!segmentIdentity && !controlSkillId && !sequenceIndex) {
    return {
      binding: null,
      reason: 'verified-normal-attack-legacy-aggregate-unresolved',
    };
  }
  const requestedChainIdentity =
    action.attackInputChainIdentity ??
    action.attackInput?.attackInputChainIdentity ??
    null;
  const baseSegments =
    actionMapping.attackInputSourceSegments ??
    actionMapping.attackInputSegments ??
    [];
  const profileSegments = actionMapping.profileAttackInputSegments ?? [];
  const segmentPool =
    requestedChainIdentity != null &&
    requestedChainIdentity === actionMapping.attackInputChainIdentity
      ? baseSegments
      : requestedChainIdentity != null &&
          String(requestedChainIdentity).startsWith('context-form:')
        ? [...baseSegments, ...profileSegments]
        : baseSegments;
  const candidates = segmentPool.filter(
    segment =>
      (segmentIdentity &&
        (segment.identity === segmentIdentity ||
          segmentIdentity.startsWith(`${segment.identity}|`))) ||
      (!segmentIdentity &&
        (!controlSkillId || segment.controlSkillId === controlSkillId) &&
        (!sequenceIndex || segment.sequenceIndex === sequenceIndex))
  );
  if (candidates.length !== 1) {
    return {
      binding: null,
      reason:
        candidates.length > 1
          ? 'verified-normal-attack-input-segment-ambiguous'
          : 'verified-normal-attack-input-segment-missing',
      candidateCount: candidates.length,
    };
  }
  const segment = candidates[0];
  return {
    binding: {
      ...actionMapping,
      ...segment,
      identity: segment.identity,
      aggregateIdentity: actionMapping.identity,
      runtimeHitCount: segment.hitCount,
      attackInputSegment: segment,
    },
  };
}

function hasValidAttackInputChains(value) {
  const normalMappings = (value?.actionMappings ?? []).filter(
    mapping =>
      mapping.actionKind === 'normal-attack' && mapping.ownerKind !== 'kibo'
  );
  if (!normalMappings.length) return false;
  const controlIds = new Set(
    (value?.controlBindings ?? []).map(binding => binding.controlSkillId)
  );
  return normalMappings.every(mapping => {
    const normalized = normalizeAttackInputSegments(
      mapping.attackInputSegments
    );
    return (
      normalized.length === mapping.attackInputSegments?.length &&
      normalized.every(segment => controlIds.has(segment.controlSkillId))
    );
  });
}

function hasValidActionTimingContracts(value) {
  return (value?.actionMappings ?? []).every(mapping => {
    const timing = mapping.actionTiming;
    if (!['applied', 'unresolved'].includes(timing?.status)) return false;
    if (!hasValidTimingOccupancy(timing.occupancy, timing.status)) return false;
    if (
      (timing.variantTimings ?? []).some(
        variant =>
          !hasValidTimingOccupancy(variant.occupancy, variant.occupancy?.status)
      )
    ) {
      return false;
    }
    return (mapping.attackInputSegments ?? []).every(segment => {
      if (!['applied', 'unresolved'].includes(segment.durationStatus)) {
        return false;
      }
      if (segment.durationStatus === 'applied') {
        return Number(segment.durationFrames) > 1;
      }
      return (
        segment.durationFrames == null &&
        segment.effectiveDurationFrames == null
      );
    });
  });
}

function hasValidTimingOccupancy(occupancy, status) {
  if (status === 'applied') {
    return Number(occupancy?.durationFrames) > 1;
  }
  return status === 'unresolved' && occupancy?.durationFrames == null;
}

function createUnresolvedActionMechanics(action, reason, extra = {}) {
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-verified-combat-action-mechanics-resolution',
    status: reason,
    actionId: action.id ?? null,
    sourceSkillId: Number(action.skillId) || null,
    hits: [],
    ready: false,
    applied: false,
    ...extra,
  };
}
