import { normalizeAttackInputSegments } from '../domain/workbenchAttackInputChain';
import { resolveActionHitWillHit } from '../domain/actionHitOverrides';
import { normalizeCombatScenario } from '../domain/combatScenario';
import { isSourceDisplayTextSafe } from '../domain/sourceDisplayText';

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
    mapping.actionKind === 'normal-attack'
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
  if (actionBinding?.classification !== 'applied') {
    const partialControlBinding = controlBindingBySkillId.get(
      actionBinding?.controlSkillId
    );
    if (
      actionBinding?.selectedSubSkillIndex != null &&
      (Number(partialControlBinding?.logic?.spCost) > 0 ||
        hasAppliedSpecialResourceOperation)
    ) {
      return {
        schemaVersion: 1,
        sourceKind: 'azpr-verified-combat-action-mechanics-resolution',
        status: 'verified-combat-action-mechanics-resource-only',
        packageId: installedPackage.packageId,
        packageHash: installedPackage.packageHash,
        owner,
        characterCombatProfile,
        actionBinding,
        controlBinding: partialControlBinding,
        hits: [],
        effects: resolveSelectedEffects(actionBinding, partialControlBinding),
        semanticEffects: resolveSelectedSemanticEffects(actionBinding),
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
  const hits = scenarioEligibleHits.filter(hit =>
    resolveActionHitWillHit(
      action,
      hit.hitIdentity,
      hit.referenceKind === 'bulletElements'
        ? normalizedScenario.projectile.defaultWillHit
        : true
    )
  );
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
      !hasAppliedSpecialResourceOperation)
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
    effects,
    semanticEffects,
    complete: true,
    effectCoverageComplete: actionBinding.complete !== false,
    reasons: actionBinding.reasons ?? [],
    ready: true,
    applied: true,
    variantSelection: actionBinding.variantSelection ?? null,
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

function isEffectTriggeredByDisabledHit(effect, disabledHits) {
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
} = {}) {
  return [
    ownerKind ?? 'unknown',
    Number(ownerId) || 0,
    Number(sourceSkillId) || 0,
    Math.max(0, Number(actionVariantIndex) || 0),
    controlSkillId == null ? '' : Number(controlSkillId) || 0,
  ].join('|');
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
          !Array.isArray(root.nodeIdentities) || Object.hasOwn(root, 'nodes')
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
        profile.triggerBindings.length === 0 ||
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
    value.actionVariantGraph.contextEdges.some(edge => edge.applied !== true) ||
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
  if (
    value?.switchTriggerCatalog?.status !==
      'verified-switch-trigger-catalog-ready' ||
    !Array.isArray(value.switchTriggerCatalog.profiles) ||
    value.switchTriggerCatalog.profiles.length !== 20 ||
    value.switchTriggerCatalog.summary?.profileCount !== 20 ||
    value.switchTriggerCatalog.summary?.appliedProfileCount !== 17 ||
    value.switchTriggerCatalog.summary?.unresolvedProfileCount !== 3 ||
    value.switchTriggerCatalog.summary?.onEnterProfileCount !== 11 ||
    value.switchTriggerCatalog.summary?.onExitProfileCount !== 9 ||
    value.switchTriggerCatalog.profiles.some(
      profile =>
        !['on-enter', 'on-exit'].includes(profile.triggerPhase) ||
        ![201, 203].includes(Number(profile.skillSlot)) ||
        !profile.sourceIdentity ||
        !Array.isArray(profile.sourceIdentities) ||
        profile.sourceIdentities.length < 3 ||
        (profile.applied === true && !profile.starCarryActionIdentity) ||
        (profile.applied !== true &&
          profile.resolutionStatus !== 'static-evidence-gap')
    )
  ) {
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
  return installedPackage.actionMappings.filter(mapping =>
    mapping.identity.startsWith(prefix)
  );
}

function resolveActionBinding(actionMapping, action) {
  if (actionMapping?.actionKind !== 'normal-attack') {
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
  const segmentPool =
    requestedChainIdentity &&
    requestedChainIdentity !== actionMapping.attackInputChainIdentity
      ? (actionMapping.attackInputSourceSegments ??
        actionMapping.attackInputSegments ??
        [])
      : (actionMapping.attackInputSegments ?? []);
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
    mapping => mapping.actionKind === 'normal-attack'
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
