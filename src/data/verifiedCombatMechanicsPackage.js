import { normalizeAttackInputSegments } from '../domain/workbenchAttackInputChain';

const packageUrl = new URL(
  './generated/verified-combat-mechanics-package.json',
  import.meta.url
);

let installedPackage = null;
let packagePromise = null;
let controlBindingBySkillId = new Map();
let effectBindingByIdentity = new Map();
let semanticEffectByRawIdentity = new Map();
let semanticFormulaByIdentity = new Map();
let specialResourceProfileByOwnerId = new Map();

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

export function getVerifiedSpecialResourceCatalog() {
  return installedPackage?.specialResourceCatalog ?? null;
}

export function clearInstalledVerifiedCombatMechanicsPackage() {
  installedPackage = null;
  packagePromise = null;
  controlBindingBySkillId = new Map();
  effectBindingByIdentity = new Map();
  semanticEffectByRawIdentity = new Map();
  semanticFormulaByIdentity = new Map();
  specialResourceProfileByOwnerId = new Map();
}

export function resolveVerifiedCombatActionMechanics(
  action = {},
  { selectedSubSkillIndex = null, selectionSource = null } = {}
) {
  if (!installedPackage) {
    return createUnresolvedActionMechanics(
      action,
      'verified-combat-mechanics-package-not-installed'
    );
  }
  const owner = resolveActionOwner(action);
  const candidates = findActionMappings(action, owner);
  if (candidates.length !== 1) {
    return createUnresolvedActionMechanics(
      action,
      candidates.length > 1
        ? 'verified-action-binding-ambiguous'
        : 'verified-action-binding-missing',
      { owner, candidateCount: candidates.length }
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
        actionBinding: actionMapping,
        candidateCount: resolvedActionBinding.candidateCount ?? 0,
      }
    );
  }
  const dynamicBinding = applySelectedSubSkillOverride({
    action,
    actionMapping,
    actionBinding: resolvedActionBinding.binding,
    selectedSubSkillIndex,
    selectionSource,
  });
  if (!dynamicBinding.binding) {
    return createUnresolvedActionMechanics(action, dynamicBinding.reason, {
      owner,
      actionBinding: resolvedActionBinding.binding,
      selectedSubSkillIndex,
      reasons: dynamicBinding.reasons ?? [],
    });
  }
  const actionBinding = dynamicBinding.binding;
  const actionTimingStatus = actionBinding.attackInputSegment
    ? actionBinding.attackInputSegment.durationStatus
    : actionBinding.timingStatus;
  if (actionTimingStatus !== 'applied') {
    return createUnresolvedActionMechanics(
      action,
      'verified-action-duration-unresolved',
      {
        owner,
        actionBinding,
        reasons:
          actionBinding.attackInputSegment?.linkTimingReasons ??
          actionBinding.actionTiming?.reasons ??
          actionBinding.reasons ??
          [],
      }
    );
  }
  if (actionBinding?.classification !== 'applied') {
    const partialControlBinding = controlBindingBySkillId.get(
      actionBinding?.controlSkillId
    );
    if (
      actionBinding?.selectedSubSkillIndex != null &&
      Number(partialControlBinding?.logic?.spCost) > 0
    ) {
      return {
        schemaVersion: 1,
        sourceKind: 'azpr-verified-combat-action-mechanics-resolution',
        status: 'verified-combat-action-mechanics-resource-only',
        packageId: installedPackage.packageId,
        packageHash: installedPackage.packageHash,
        owner,
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
  const hits = (controlBinding?.hits ?? []).filter(
    hit =>
      hit.mapIndex === actionBinding.selectedSubSkillIndex &&
      (!selectedHitIdentities.size ||
        selectedHitIdentities.has(hit.hitIdentity))
  );
  const effects = resolveSelectedEffects(actionBinding, controlBinding);
  const semanticEffects = resolveSelectedSemanticEffects(actionBinding);
  const hasAppliedCost = Number(controlBinding?.logic?.spCost) > 0;
  const hasAppliedEffect = effects.some(
    effect => effect.classification === 'applied'
  );
  if (
    !controlBinding ||
    (!hits.length && !hasAppliedCost && !hasAppliedEffect)
  ) {
    return createUnresolvedActionMechanics(
      action,
      'verified-control-binding-missing',
      { owner, actionBinding }
    );
  }
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-verified-combat-action-mechanics-resolution',
    status: 'verified-combat-action-mechanics-ready',
    packageId: installedPackage.packageId,
    packageHash: installedPackage.packageHash,
    owner,
    actionBinding,
    controlBinding,
    hits,
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

function applySelectedSubSkillOverride({
  action,
  actionMapping,
  actionBinding,
  selectedSubSkillIndex,
  selectionSource,
}) {
  if (selectedSubSkillIndex == null) return { binding: actionBinding };
  const subSkillIndex = Number(selectedSubSkillIndex);
  const controlBinding = controlBindingBySkillId.get(
    actionBinding.controlSkillId
  );
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
  const timingCandidates = actionBinding.attackInputSegment
    ? actionBinding.attackInputSegment.variantTimings
    : actionMapping.actionTiming?.variantTimings;
  const timing = (timingCandidates ?? []).find(
    item => Number(item.subSkillIndex) === subSkillIndex
  );
  if (timing?.occupancy?.status !== 'applied') {
    return {
      binding: null,
      reason: 'verified-action-selected-variant-duration-unresolved',
      reasons: timing?.occupancy?.reasons ?? [
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
      selectedSubSkillIndex: subSkillIndex,
      ...(actionBinding.attackInputSegment
        ? {
            attackInputSegment: {
              ...actionBinding.attackInputSegment,
              selectedSubSkillIndex: subSkillIndex,
              playerSkillId: variant.playerSkillId ?? null,
              resourceMapIndex: variant.resourceMapIndex ?? null,
              durationFrames: timing.occupancy.durationFrames,
              effectiveDurationFrames: timing.occupancy.durationFrames,
              durationStatus: 'applied',
              durationBasis: timing.occupancy.sourceKind,
              durationSourceIdentity: timing.occupancy.sourceIdentity,
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
      timingStatus: 'applied',
      actionTiming: {
        ...(actionBinding.actionTiming ?? actionMapping.actionTiming),
        status: 'applied',
        selectedSubSkillIndex: subSkillIndex,
        occupancy: timing.occupancy,
        input: timing.input,
        sourceIdentity: timing.occupancy.sourceIdentity,
        reasons: [],
      },
      variantSelection,
      actualDurationFrames: timing.occupancy.durationFrames,
      actualDurationMs:
        (Number(timing.occupancy.durationFrames) * 1000) /
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
    value?.packageVersion < 12 ||
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
    !Array.isArray(value.specialResourceCatalog.operationBindings)
  ) {
    issues.push('special-resource-catalog-invalid');
  }
  if (
    value?.actionVariantGraph?.status !==
      'verified-action-variant-graph-ready' ||
    !Array.isArray(value.actionVariantGraph.nodes) ||
    !Array.isArray(value.actionVariantGraph.edges) ||
    !Array.isArray(value.actionVariantGraph.defaultSelections)
  ) {
    issues.push('action-variant-graph-invalid');
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
  return {
    valid: issues.length === 0,
    status: issues.length
      ? 'verified-combat-mechanics-package-invalid'
      : 'verified-combat-mechanics-package-valid',
    issues,
  };
}

function resolveActionOwner(action) {
  const kiboId = Number(action.kiboId ?? action.actor?.loadout?.kiboId);
  if (action.type === 'kiboEvent' && Number.isInteger(kiboId) && kiboId > 0) {
    return { kind: 'kibo', id: kiboId };
  }
  const characterId = Number(action.actor?.characterId);
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
  const candidates = (actionMapping.attackInputSegments ?? []).filter(
    segment =>
      (segmentIdentity && segment.identity === segmentIdentity) ||
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
