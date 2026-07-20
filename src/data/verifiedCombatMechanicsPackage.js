import { normalizeAttackInputSegments } from '../domain/workbenchAttackInputChain';

const packageUrl = new URL(
  './generated/verified-combat-mechanics-package.json',
  import.meta.url
);

let installedPackage = null;
let packagePromise = null;
let controlBindingBySkillId = new Map();

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
  controlBindingBySkillId = new Map(
    value.controlBindings.map(binding => [binding.controlSkillId, binding])
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

export function clearInstalledVerifiedCombatMechanicsPackage() {
  installedPackage = null;
  packagePromise = null;
  controlBindingBySkillId = new Map();
}

export function resolveVerifiedCombatActionMechanics(action = {}) {
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
  const actionBinding = resolvedActionBinding.binding;
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
  const hasAppliedCost = Number(controlBinding?.logic?.spCost) > 0;
  if (!controlBinding || (!hits.length && !hasAppliedCost)) {
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
    complete: true,
    ready: true,
    applied: true,
  };
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
  if (!hasValidAttackInputChains(value)) {
    issues.push('attack-input-segments-invalid');
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
