import qualificationCatalog from '../data/generated/optimization-qualification-catalog.json';
import verifiedMechanicsPackage from '../data/generated/verified-combat-mechanics-package.json';
import {
  getOptimizationQualificationCatalog,
  validateOptimizationQualificationCatalog,
} from '../optimization-qualification/optimizationQualificationProtocol.js';
import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization.js';
import {
  M12C_OPTIONAL_OPTIMIZATION_OBJECT_IDS,
  M12C_REQUIRED_OPTIMIZATION_OBJECT_ID,
  M12C_STARBORN_SOURCE_CHARACTER_IDS,
} from './m12cSearchScopeContract.js';

export {
  M12C_OPTIONAL_OPTIMIZATION_OBJECT_IDS,
  M12C_REQUIRED_OPTIMIZATION_OBJECT_ID,
  M12C_STARBORN_SOURCE_CHARACTER_IDS,
} from './m12cSearchScopeContract.js';

export const M12C_OUTER_BUILD_POOL_SCHEMA_VERSION = 1;
export const M12C_OUTER_BUILD_POOL_CONTRACT_NAME = 'AzPrM12COuterBuildPool';
export const M12C_OUTER_TEAM_CATALOG_CONTRACT_NAME = 'AzPrM12COuterTeamCatalog';
export const M12C_BUILD_SELECTION_CONTRACT_NAME = 'AzPrM12COuterBuildSelection';
export const M12C_BUILD_CONTRACT_NAME = 'AzPrM12COuterBuild';
export const M12C_BUILD_ENUMERATION_PLAN_CONTRACT_NAME =
  'AzPrM12CBuildEnumerationPlan';

export const M12C_EQUIPMENT_SLOTS = Object.freeze([
  'weapon',
  'top',
  'bottom',
  'earring',
  'ring',
]);

const TEAM_ID_PREFIX = 'm12c-team-v1';
const SOURCE_CONFIG_ID_PREFIX = 'm12c-source-v1';
const ACTOR_SLOT_ID_PREFIX = 'm12c-slot';
const EXPECTED_TEAM_COUNT = 28;
const EXPECTED_SOURCE_CONFIG_COUNT = 35;
const AUTHORITATIVE_QUALIFICATION_HASHES = deepFreeze(
  extractQualificationAuthority(qualificationCatalog)
);
const AUTHORITATIVE_VERIFIED_MECHANICS_PACKAGE_HASH =
  verifiedMechanicsPackage.packageHash;
export class M12cOuterBuildPoolError extends Error {
  constructor(message, issues = []) {
    super(message);
    this.name = 'M12cOuterBuildPoolError';
    this.issues = [...issues];
  }
}

export function validateM12cOuterBuildAuthority({
  qualification = getOptimizationQualificationCatalog(),
  admissionBinding = null,
} = {}) {
  const issues = [];
  const qualificationValidation =
    validateOptimizationQualificationCatalog(qualification);
  for (const issue of qualificationValidation.issues ?? []) {
    issues.push(normalizeIssueCode(issue));
  }

  const authority = extractQualificationAuthority(qualification);
  for (const [key, expected] of Object.entries(
    AUTHORITATIVE_QUALIFICATION_HASHES
  )) {
    if (authority[key] !== expected) {
      issues.push(`m12c-outer-qualification-authority-mismatch:${key}`);
    }
  }

  const productReleaseIssues = validateFormalAdmissionBinding(
    admissionBinding,
    qualification
  );

  const fixedProfile = qualification?.cultivation?.fixedOptimizationProfile;
  if (!isFixedM12cCultivationProfile(fixedProfile)) {
    issues.push('m12c-outer-fixed-cultivation-profile-invalid');
  }

  const uniqueIssues = [...new Set(issues)].sort();
  return {
    valid: uniqueIssues.length === 0,
    issues: uniqueIssues,
    authority: {
      ...authority,
      verifiedMechanicsPackageHash:
        AUTHORITATIVE_VERIFIED_MECHANICS_PACKAGE_HASH,
      searchAdmissionPolicy: 'headless-data-snapshot-v1',
    },
    productReleaseAdvisory: {
      ready: productReleaseIssues.length === 0,
      status: productReleaseIssues.length === 0 ? 'ready' : 'blocked',
      blockingForHeadlessSearch: false,
      issues: productReleaseIssues,
      bindingMatrixHash: admissionBinding?.bindingMatrixHash ?? null,
    },
  };
}

export function createM12cTeamCatalog(options = {}) {
  const qualification =
    options.qualification ?? getOptimizationQualificationCatalog();
  const admissionBinding = options.admissionBinding ?? null;
  const authorityValidation = validateM12cOuterBuildAuthority({
    qualification,
    admissionBinding,
  });
  if (!authorityValidation.valid) {
    throw new M12cOuterBuildPoolError(
      'M12-C outer team authority is invalid',
      authorityValidation.issues
    );
  }
  return deepFreeze(
    createM12cTeamCatalogSnapshot(qualification, authorityValidation.authority)
  );
}

export function resolveM12cTeamSourceConfig(input, options = {}) {
  const teamCatalog = options.teamCatalog ?? createM12cTeamCatalog(options);
  const issues = [];
  const rawObjectIds = input?.optimizationObjectIds;
  const objectIds = normalizeOptimizationObjectIds(rawObjectIds ?? []);
  if (!Array.isArray(rawObjectIds) || rawObjectIds.length !== 3) {
    issues.push('m12c-team-object-count-invalid');
  }
  if (objectIds.length !== 3) {
    issues.push('m12c-team-object-count-invalid');
  }
  if (!objectIds.includes(M12C_REQUIRED_OPTIMIZATION_OBJECT_ID)) {
    issues.push('m12c-team-required-moyin-missing');
  }
  const allowed = new Set([
    M12C_REQUIRED_OPTIMIZATION_OBJECT_ID,
    ...M12C_OPTIONAL_OPTIMIZATION_OBJECT_IDS,
  ]);
  if (objectIds.some(objectId => !allowed.has(objectId))) {
    issues.push('m12c-team-object-out-of-roster');
  }
  if (
    Array.isArray(rawObjectIds) &&
    new Set(rawObjectIds.map(value => String(value))).size !==
      rawObjectIds.length
  ) {
    issues.push('m12c-team-object-duplicate');
  }

  const teamIdentity = createTeamIdentity(objectIds);
  const team = teamCatalog.teams.find(row => row.teamIdentity === teamIdentity);
  if (!team) issues.push('m12c-team-identity-not-enumerated');

  const rawSources = input?.sourceCharacterIdsByObjectId ?? {};
  const starbornSources = normalizeSourceCharacterIdList(rawSources.STARBORN);
  if (objectIds.includes('STARBORN')) {
    if (
      starbornSources.length !== 1 ||
      !M12C_STARBORN_SOURCE_CHARACTER_IDS.includes(starbornSources[0])
    ) {
      issues.push('m12c-team-starborn-single-alias-required');
    }
  } else if (starbornSources.length > 0) {
    issues.push('m12c-team-starborn-alias-without-object');
  }

  const actors = objectIds.map(optimizationObjectId => {
    const expectedSource =
      optimizationObjectId === 'STARBORN'
        ? (starbornSources[0] ?? null)
        : Number(optimizationObjectId);
    const declaredSources = normalizeSourceCharacterIdList(
      rawSources[optimizationObjectId]
    );
    if (
      optimizationObjectId !== 'STARBORN' &&
      declaredSources.length > 0 &&
      (declaredSources.length !== 1 || declaredSources[0] !== expectedSource)
    ) {
      issues.push(
        `m12c-team-source-character-mismatch:${optimizationObjectId}`
      );
    }
    return {
      actorSlotId: createActorSlotId(optimizationObjectId),
      optimizationObjectId,
      sourceCharacterId: expectedSource,
    };
  });
  const sourceConfigIdentity = createSourceConfigIdentity(actors);
  const sourceConfig = teamCatalog.sourceConfigs.find(
    row => row.sourceConfigIdentity === sourceConfigIdentity
  );
  if (!sourceConfig) issues.push('m12c-source-config-not-enumerated');

  const uniqueIssues = [...new Set(issues)].sort();
  return {
    valid: uniqueIssues.length === 0,
    issues: uniqueIssues,
    team: uniqueIssues.length === 0 ? team : null,
    sourceConfig: uniqueIssues.length === 0 ? sourceConfig : null,
  };
}

export function createM12cOuterBuildPool(options = {}) {
  const qualification =
    options.qualification ?? getOptimizationQualificationCatalog();
  const admissionBinding = options.admissionBinding ?? null;
  const authorityValidation = validateM12cOuterBuildAuthority({
    qualification,
    admissionBinding,
  });
  if (!authorityValidation.valid) {
    throw new M12cOuterBuildPoolError(
      'M12-C outer build authority is invalid',
      authorityValidation.issues
    );
  }
  const snapshot = createM12cOuterBuildPoolSnapshot({
    qualification,
    authority: authorityValidation.authority,
  });
  const poolHash = hashCanonicalValue(snapshot);
  return deepFreeze({ ...snapshot, poolHash });
}

export function validateM12cOuterBuildPool(pool) {
  const issues = [];
  if (pool?.schemaVersion !== M12C_OUTER_BUILD_POOL_SCHEMA_VERSION) {
    issues.push('m12c-outer-build-pool-schema-version-invalid');
  }
  if (pool?.contractName !== M12C_OUTER_BUILD_POOL_CONTRACT_NAME) {
    issues.push('m12c-outer-build-pool-contract-name-invalid');
  }
  if (pool && typeof pool === 'object') {
    const payload = structuredClone(pool);
    delete payload.poolHash;
    if (pool.poolHash !== hashCanonicalValue(payload)) {
      issues.push('m12c-outer-build-pool-hash-mismatch');
    }
  }
  const expected = createM12cOuterBuildPool();
  if (pool?.poolHash !== expected.poolHash) {
    issues.push('m12c-outer-build-pool-authority-mismatch');
  }
  const uniqueIssues = [...new Set(issues)].sort();
  return { valid: uniqueIssues.length === 0, issues: uniqueIssues };
}

export function createM12cBuildEnumerationPlan(
  input,
  { pool = createM12cOuterBuildPool() } = {}
) {
  const issues = [];
  const poolValidation = validateM12cOuterBuildPool(pool);
  issues.push(...poolValidation.issues);
  const sourceConfig = pool.teamCatalog.sourceConfigs.find(
    row => row.sourceConfigIdentity === input?.sourceConfigIdentity
  );
  if (!sourceConfig) issues.push('m12c-build-plan-source-config-invalid');

  const constraints = input?.constraints ?? {};
  const perActorConstraints = constraints.perActor ?? {};
  const actorPlans = (sourceConfig?.actors ?? []).map(actor => {
    const actorDomain = pool.domains.actorLoadoutDomains.find(
      row => row.optimizationObjectId === actor.optimizationObjectId
    );
    const constraint =
      perActorConstraints[actor.actorSlotId] ??
      perActorConstraints[actor.optimizationObjectId] ??
      {};
    const kiboIds = constrainNumericDomain({
      base: actorDomain?.kiboIds ?? [],
      requested: constraint.kiboIds,
      issueCode: `m12c-build-plan-kibo-constraint-invalid:${actor.actorSlotId}`,
      issues,
    });
    const soulEssenceIds = constrainNumericDomain({
      base: actorDomain?.soulEssenceIds ?? [],
      requested: constraint.soulEssenceIds,
      issueCode: `m12c-build-plan-soul-constraint-invalid:${actor.actorSlotId}`,
      issues,
    });
    const equipmentIdsBySlot = Object.fromEntries(
      M12C_EQUIPMENT_SLOTS.map(slot => [
        slot,
        constrainNumericDomain({
          base: actorDomain?.equipmentIdsBySlot?.[slot] ?? [],
          requested: constraint.equipmentIdsBySlot?.[slot],
          issueCode: `m12c-build-plan-equipment-constraint-invalid:${actor.actorSlotId}:${slot}`,
          issues,
        }),
      ])
    );
    const equipmentCombinationCount = M12C_EQUIPMENT_SLOTS.reduce(
      (product, slot) => product * BigInt(equipmentIdsBySlot[slot].length),
      1n
    );
    const estimatedLoadoutCount =
      BigInt(kiboIds.length) *
      BigInt(soulEssenceIds.length) *
      equipmentCombinationCount;
    return {
      ...actor,
      kiboIds,
      soulEssenceIds,
      equipmentIdsBySlot,
      equipmentCombinationCount: equipmentCombinationCount.toString(),
      estimatedLoadoutCount: estimatedLoadoutCount.toString(),
    };
  });
  const unknownConstraintActors = Object.keys(perActorConstraints).filter(
    identity =>
      !actorPlans.some(
        actor =>
          actor.actorSlotId === identity ||
          actor.optimizationObjectId === identity
      )
  );
  if (unknownConstraintActors.length > 0) {
    issues.push('m12c-build-plan-actor-constraint-unknown');
  }
  const estimatedBuildCount = actorPlans
    .reduce(
      (product, actor) => product * BigInt(actor.estimatedLoadoutCount),
      1n
    )
    .toString();
  const uniqueIssues = [...new Set(issues)].sort();
  if (uniqueIssues.length > 0) {
    return { valid: false, issues: uniqueIssues, plan: null };
  }
  const planPayload = {
    schemaVersion: M12C_OUTER_BUILD_POOL_SCHEMA_VERSION,
    contractName: M12C_BUILD_ENUMERATION_PLAN_CONTRACT_NAME,
    kind: 'azpr-m12c-build-enumeration-plan',
    poolHash: pool.poolHash,
    teamIdentity: sourceConfig.teamIdentity,
    sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
    actors: actorPlans,
    estimatedBuildCount,
    pruningContract: {
      staticConstraints: 'per-actor-domain-intersection',
      dynamicStages: ['kibo', 'soul-essence', 'equipment', 'actor-loadout'],
      materialization: 'lazy-generator',
    },
  };
  const plan = deepFreeze({
    ...planPayload,
    planHash: hashCanonicalValue(planPayload),
  });
  return { valid: true, issues: [], plan };
}

export function* iterateM12cBuildCandidates(
  plan,
  {
    pool = createM12cOuterBuildPool(),
    maxCandidates = 1,
    shouldPrune = null,
  } = {}
) {
  const planIssues = validateM12cBuildEnumerationPlan(plan, pool);
  if (planIssues.length > 0) {
    throw new M12cOuterBuildPoolError(
      'M12-C build enumeration plan is invalid',
      planIssues
    );
  }
  if (!Number.isInteger(maxCandidates) || maxCandidates <= 0) {
    throw new M12cOuterBuildPoolError(
      'M12-C build enumeration requires a positive finite candidate limit',
      ['m12c-build-enumeration-limit-invalid']
    );
  }
  if (shouldPrune != null && typeof shouldPrune !== 'function') {
    throw new M12cOuterBuildPoolError(
      'M12-C build pruning callback is invalid',
      ['m12c-build-pruning-callback-invalid']
    );
  }

  let yielded = 0;
  const selectedActors = [];
  const recurseActors = function* (actorIndex) {
    if (yielded >= maxCandidates) return;
    if (actorIndex >= plan.actors.length) {
      const selection = {
        schemaVersion: M12C_OUTER_BUILD_POOL_SCHEMA_VERSION,
        contractName: M12C_BUILD_SELECTION_CONTRACT_NAME,
        teamIdentity: plan.teamIdentity,
        sourceConfigIdentity: plan.sourceConfigIdentity,
        actors: structuredClone(selectedActors),
      };
      const created = createM12cBuildCandidate(selection, { pool });
      if (!created.scoreable || !created.build) {
        throw new M12cOuterBuildPoolError(
          'M12-C lazy enumeration produced an invalid build',
          created.issues
        );
      }
      yielded += 1;
      yield created.build;
      return;
    }

    const actorPlan = plan.actors[actorIndex];
    for (const actorSelection of iterateActorLoadouts(actorPlan, {
      selectedActors,
      shouldPrune,
    })) {
      if (yielded >= maxCandidates) return;
      selectedActors.push(actorSelection);
      const pruneActor = invokePrune(shouldPrune, {
        stage: 'actor-loadout',
        actorSlotId: actorPlan.actorSlotId,
        optimizationObjectId: actorPlan.optimizationObjectId,
        selectedActors: structuredClone(selectedActors),
      });
      if (!pruneActor) yield* recurseActors(actorIndex + 1);
      selectedActors.pop();
    }
  };

  yield* recurseActors(0);
}

export function validateM12cBuildSelection(
  selection,
  { pool = createM12cOuterBuildPool() } = {}
) {
  const illegalIssues = [];
  const unscoreableIssues = [];
  const poolValidation = validateM12cOuterBuildPool(pool);
  unscoreableIssues.push(...poolValidation.issues);

  if (!isRecord(selection)) {
    illegalIssues.push('m12c-build-selection-required');
    return createBuildValidation(illegalIssues, unscoreableIssues);
  }
  if (
    selection.schemaVersion !== M12C_OUTER_BUILD_POOL_SCHEMA_VERSION ||
    selection.contractName !== M12C_BUILD_SELECTION_CONTRACT_NAME
  ) {
    illegalIssues.push('m12c-build-selection-contract-invalid');
  }
  const sourceConfig = pool.teamCatalog.sourceConfigs.find(
    row => row.sourceConfigIdentity === selection.sourceConfigIdentity
  );
  if (!sourceConfig) {
    illegalIssues.push('m12c-build-source-config-invalid');
  } else if (selection.teamIdentity !== sourceConfig.teamIdentity) {
    illegalIssues.push('m12c-build-team-source-config-mismatch');
  }
  if (!Array.isArray(selection.actors) || selection.actors.length !== 3) {
    illegalIssues.push('m12c-build-actor-count-invalid');
    return createBuildValidation(illegalIssues, unscoreableIssues);
  }

  const actorSlots = selection.actors.map(actor => actor?.actorSlotId);
  if (new Set(actorSlots).size !== actorSlots.length) {
    illegalIssues.push('m12c-build-actor-slot-duplicate');
  }
  const actorObjects = selection.actors.map(actor =>
    String(actor?.optimizationObjectId ?? '')
  );
  if (new Set(actorObjects).size !== actorObjects.length) {
    illegalIssues.push('m12c-build-actor-object-duplicate');
  }

  for (const expectedActor of sourceConfig?.actors ?? []) {
    const actor = selection.actors.find(
      row => row?.optimizationObjectId === expectedActor.optimizationObjectId
    );
    if (!actor) {
      illegalIssues.push(
        `m12c-build-actor-missing:${expectedActor.optimizationObjectId}`
      );
      continue;
    }
    validateBuildActor({
      actor,
      expectedActor,
      pool,
      illegalIssues,
      unscoreableIssues,
    });
  }
  for (const actor of selection.actors) {
    if (
      !(sourceConfig?.actors ?? []).some(
        row => row.optimizationObjectId === actor?.optimizationObjectId
      )
    ) {
      illegalIssues.push(
        `m12c-build-actor-not-in-source-config:${actor?.optimizationObjectId}`
      );
    }
  }
  return createBuildValidation(illegalIssues, unscoreableIssues);
}

export function createM12cBuildCandidate(selection, options = {}) {
  const pool = options.pool ?? createM12cOuterBuildPool();
  const validation = validateM12cBuildSelection(selection, { pool });
  if (!validation.scoreable) {
    return { ...validation, build: null };
  }
  const sourceConfig = pool.teamCatalog.sourceConfigs.find(
    row => row.sourceConfigIdentity === selection.sourceConfigIdentity
  );
  const selectionByObjectId = new Map(
    selection.actors.map(actor => [actor.optimizationObjectId, actor])
  );
  const actors = sourceConfig.actors.map(expectedActor =>
    materializeBuildActor({
      actor: selectionByObjectId.get(expectedActor.optimizationObjectId),
      expectedActor,
      pool,
    })
  );
  const buildPayload = {
    schemaVersion: M12C_OUTER_BUILD_POOL_SCHEMA_VERSION,
    contractName: M12C_BUILD_CONTRACT_NAME,
    kind: 'azpr-m12c-outer-build',
    identityPolicy: {
      teamOrder: 'canonical-optimization-object-order',
      actorSlotIdentity: 'canonical-optimization-object-slot',
      kiboRuntimeOwnerIdentity: 'actorSlotId+kiboId',
      excludes: ['initialFront', 'axis', 'initialStatePreset'],
    },
    teamIdentity: sourceConfig.teamIdentity,
    sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
    optimizationObjectIds: [...sourceConfig.optimizationObjectIds],
    actors,
    fixedCultivationProfile: structuredClone(pool.fixedCultivationProfile),
    authority: structuredClone(pool.authority),
    poolHash: pool.poolHash,
  };
  const build = deepFreeze({
    ...buildPayload,
    buildHash: hashCanonicalValue(buildPayload),
  });
  return { ...validation, build };
}

export function validateM12cBuildCandidate(
  build,
  { pool = createM12cOuterBuildPool() } = {}
) {
  const illegalIssues = [];
  const unscoreableIssues = [];
  const poolValidation = validateM12cOuterBuildPool(pool);
  unscoreableIssues.push(...poolValidation.issues);
  if (!isRecord(build)) {
    illegalIssues.push('m12c-build-candidate-required');
    return createBuildValidation(illegalIssues, unscoreableIssues);
  }
  if (
    build.schemaVersion !== M12C_OUTER_BUILD_POOL_SCHEMA_VERSION ||
    build.contractName !== M12C_BUILD_CONTRACT_NAME
  ) {
    illegalIssues.push('m12c-build-candidate-contract-invalid');
  }
  if (build.poolHash !== pool.poolHash) {
    unscoreableIssues.push('m12c-build-candidate-pool-hash-mismatch');
  }
  const selection = {
    schemaVersion: M12C_OUTER_BUILD_POOL_SCHEMA_VERSION,
    contractName: M12C_BUILD_SELECTION_CONTRACT_NAME,
    teamIdentity: build.teamIdentity,
    sourceConfigIdentity: build.sourceConfigIdentity,
    actors: (build.actors ?? []).map(actor => ({
      actorSlotId: actor.actorSlotId,
      optimizationObjectId: actor.optimizationObjectId,
      sourceCharacterId: actor.sourceCharacterId,
      kiboId: actor.kibo?.kiboId,
      soulEssenceId: actor.soulEssence?.soulEssenceId,
      equipment: (actor.equipment ?? []).map(item => ({
        slot: item.slot,
        equipmentId: item.equipmentId,
        rarity: item.rarity,
        enhancementLevel: item.enhancementLevel,
        tuningScore: item.tuningScore,
        instanceTier: item.instanceTier,
        bGoldSide: item.bGoldSide,
      })),
    })),
  };
  const selectionValidation = validateM12cBuildSelection(selection, { pool });
  illegalIssues.push(...selectionValidation.illegalIssues);
  unscoreableIssues.push(...selectionValidation.unscoreableIssues);
  if (selectionValidation.scoreable) {
    const expected = createM12cBuildCandidate(selection, { pool }).build;
    if (
      build.buildHash !== expected.buildHash ||
      hashCanonicalValue(build) !== hashCanonicalValue(expected)
    ) {
      unscoreableIssues.push('m12c-build-candidate-canonical-mismatch');
    }
  }
  return createBuildValidation(illegalIssues, unscoreableIssues);
}

export function deriveM12cSetBonuses(
  equipment,
  { pool = createM12cOuterBuildPool() } = {}
) {
  const issues = [];
  const profiles = [];
  const selectedEquipment = Array.isArray(equipment) ? equipment : [];
  if (selectedEquipment.length !== M12C_EQUIPMENT_SLOTS.length) {
    issues.push('m12c-set-derivation-equipment-count-invalid');
  }
  const selectedSlots = selectedEquipment.map(item => item?.slot);
  if (new Set(selectedSlots).size !== selectedSlots.length) {
    issues.push('m12c-set-derivation-slot-duplicate');
  }
  for (const slot of M12C_EQUIPMENT_SLOTS) {
    if (
      selectedSlots.filter(selectedSlot => selectedSlot === slot).length !== 1
    ) {
      issues.push(`m12c-set-derivation-slot-cardinality-invalid:${slot}`);
    }
  }
  if (selectedSlots.some(slot => !M12C_EQUIPMENT_SLOTS.includes(slot))) {
    issues.push('m12c-set-derivation-slot-unknown');
  }
  for (const item of selectedEquipment) {
    const profile = pool.domains.equipment.find(
      row =>
        row.equipmentId === Number(item?.equipmentId) && row.slot === item?.slot
    );
    if (!profile) {
      issues.push(`m12c-set-derivation-equipment-invalid:${item?.slot}`);
    } else {
      profiles.push(profile);
    }
  }
  let uniqueIssues = [...new Set(issues)].sort();
  if (uniqueIssues.length > 0) {
    return { valid: false, issues: uniqueIssues, setBonuses: [] };
  }
  const counts = new Map();
  for (const profile of profiles) {
    if (profile.setId == null) continue;
    counts.set(profile.setId, (counts.get(profile.setId) ?? 0) + 1);
  }
  const setBonuses = [];
  for (const [setId, count] of [...counts.entries()].sort(
    ([left], [right]) => left - right
  )) {
    for (const pieces of [2, 4]) {
      if (count < pieces) continue;
      const threshold = pool.domains.setSkillThresholds.find(
        row => row.setId === setId && row.pieces === pieces
      );
      if (!threshold?.searchEligible) {
        issues.push(`m12c-set-threshold-unscoreable:${setId}:${pieces}`);
        continue;
      }
      setBonuses.push({
        setId,
        pieces,
        skillId: threshold.skillId,
        equippedPieceCount: count,
        manifestHash: threshold.manifestHash,
        sourceIdentity: threshold.sourceIdentity,
      });
    }
  }
  uniqueIssues = [...new Set(issues)].sort();
  return {
    valid: uniqueIssues.length === 0,
    issues: uniqueIssues,
    setBonuses: uniqueIssues.length === 0 ? setBonuses : [],
  };
}

function createM12cTeamCatalogSnapshot(qualification, authority) {
  const recordsByKey = new Map(
    qualification.records.map(record => [
      `${record.objectKind}:${record.objectId}`,
      record,
    ])
  );
  const characterProfiles = qualification.cultivation.character.profiles;
  const teams = [];
  const sourceConfigs = [];
  for (
    let left = 0;
    left < M12C_OPTIONAL_OPTIMIZATION_OBJECT_IDS.length;
    left += 1
  ) {
    for (
      let right = left + 1;
      right < M12C_OPTIONAL_OPTIMIZATION_OBJECT_IDS.length;
      right += 1
    ) {
      const optimizationObjectIds = normalizeOptimizationObjectIds([
        M12C_REQUIRED_OPTIMIZATION_OBJECT_ID,
        M12C_OPTIONAL_OPTIMIZATION_OBJECT_IDS[left],
        M12C_OPTIONAL_OPTIMIZATION_OBJECT_IDS[right],
      ]);
      const teamIdentity = createTeamIdentity(optimizationObjectIds);
      const team = {
        teamIdentity,
        optimizationObjectIds,
        characterManifestHashes: Object.fromEntries(
          optimizationObjectIds.map(objectId => [
            objectId,
            recordsByKey.get(`character:${objectId}`)?.manifestHash ?? null,
          ])
        ),
      };
      teams.push(team);
      const aliases = optimizationObjectIds.includes('STARBORN')
        ? M12C_STARBORN_SOURCE_CHARACTER_IDS
        : [null];
      for (const alias of aliases) {
        const actors = optimizationObjectIds.map(optimizationObjectId => {
          const sourceCharacterId =
            optimizationObjectId === 'STARBORN'
              ? alias
              : Number(optimizationObjectId);
          const sourceProfile = characterProfiles.find(
            row => Number(row.characterId) === Number(sourceCharacterId)
          );
          return {
            actorSlotId: createActorSlotId(optimizationObjectId),
            optimizationObjectId,
            sourceCharacterId,
            position: sourceProfile?.position ?? null,
            sourceProfileHash: sourceProfile
              ? hashCanonicalValue(sourceProfile)
              : null,
          };
        });
        sourceConfigs.push({
          sourceConfigIdentity: createSourceConfigIdentity(actors),
          teamIdentity,
          optimizationObjectIds,
          starbornSourceCharacterId: alias,
          actors,
        });
      }
    }
  }
  teams.sort((left, right) =>
    left.teamIdentity.localeCompare(right.teamIdentity, 'en')
  );
  sourceConfigs.sort((left, right) =>
    left.sourceConfigIdentity.localeCompare(right.sourceConfigIdentity, 'en')
  );
  const payload = {
    schemaVersion: M12C_OUTER_BUILD_POOL_SCHEMA_VERSION,
    contractName: M12C_OUTER_TEAM_CATALOG_CONTRACT_NAME,
    kind: 'azpr-m12c-outer-team-catalog',
    authority,
    rosterPolicy: {
      requiredOptimizationObjectId: M12C_REQUIRED_OPTIMIZATION_OBJECT_ID,
      chooseCountFromOptionalRoster: 2,
      optionalOptimizationObjectIds: [...M12C_OPTIONAL_OPTIMIZATION_OBJECT_IDS],
      starbornAliasPolicy: 'exactly-one-alias-when-present',
      canonicalTeamOrder: 'numeric-object-id-then-symbolic-object-id',
      initialFrontIdentity: 'excluded-axis-only',
    },
    teams,
    sourceConfigs,
    summary: {
      teamCount: teams.length,
      sourceConfigCount: sourceConfigs.length,
      starbornTeamCount: teams.filter(team =>
        team.optimizationObjectIds.includes('STARBORN')
      ).length,
      starbornSourceConfigCount: sourceConfigs.filter(
        config => config.starbornSourceCharacterId != null
      ).length,
    },
  };
  if (
    payload.summary.teamCount !== EXPECTED_TEAM_COUNT ||
    payload.summary.sourceConfigCount !== EXPECTED_SOURCE_CONFIG_COUNT
  ) {
    throw new M12cOuterBuildPoolError('M12-C team census mismatch', [
      'm12c-team-census-mismatch',
    ]);
  }
  return {
    ...payload,
    teamCatalogHash: hashCanonicalValue(payload),
  };
}

function createM12cOuterBuildPoolSnapshot({ qualification, authority }) {
  const teamCatalog = createM12cTeamCatalogSnapshot(qualification, authority);
  const recordsByKey = new Map(
    qualification.records.map(record => [
      `${record.objectKind}:${record.objectId}`,
      record,
    ])
  );
  const kiboIds = qualification.records
    .filter(record => record?.objectKind === 'kibo')
    .map(record => record.objectId)
    .map(Number)
    .sort(numberSort);
  // 搜索域直接使用当前数据快照里的场景装配域；产品视觉签收不裁剪搜索空间。
  const scopedSoulEssenceIds =
    qualification.cultivation?.soulEssence?.soulEssenceIds ?? [];
  const soulEssenceIds = scopedSoulEssenceIds.map(Number).sort(numberSort);
  const equipmentProfiles = qualification.cultivation.equipment.profiles;
  const fixedEquipment =
    qualification.cultivation.fixedOptimizationProfile.equipment;
  const equipment = equipmentProfiles
    .filter(
      profile =>
        Number(profile.rarity) === Number(fixedEquipment.rarity) &&
        Number(profile.maximumEnhancementLevel) >=
          Number(fixedEquipment.enhancementLevel)
    )
    .map(profile => ({
      equipmentId: Number(profile.equipmentId),
      slot: profile.slot,
      setId: profile.setId == null ? null : Number(profile.setId),
      rarity: Number(profile.rarity),
      maximumEnhancementLevel: Number(profile.maximumEnhancementLevel),
      sourceIdentity: profile.sourceIdentity,
      manifestHash: recordsByKey.get(`equipment:${profile.equipmentId}`)
        ?.manifestHash,
    }))
    .sort(compareEquipmentProfiles);
  const equipmentIdsBySlot = Object.fromEntries(
    M12C_EQUIPMENT_SLOTS.map(slot => [
      slot,
      equipment
        .filter(profile => profile.slot === slot)
        .map(profile => profile.equipmentId),
    ])
  );
  const soulProfileById = new Map(
    qualification.cultivation.soulEssence.profiles.map(profile => [
      Number(profile.soulEssenceId),
      profile,
    ])
  );
  const souls = soulEssenceIds.map(soulEssenceId => {
    const profile = soulProfileById.get(soulEssenceId);
    return {
      soulEssenceId,
      profession: profile?.profession ?? null,
      rarity: Number(profile?.rarity),
      sourceIdentity: profile?.sourceIdentity ?? null,
      profileHash: profile ? hashCanonicalValue(profile) : null,
      manifestHash: recordsByKey.get(`soul-essence:${soulEssenceId}`)
        ?.manifestHash,
    };
  });
  const kibos = kiboIds.map(kiboId => ({
    kiboId,
    manifestHash: recordsByKey.get(`kibo:${kiboId}`)?.manifestHash ?? null,
  }));
  const admittedKiboIds = new Set(kiboIds);
  const admittedSoulEssenceIds = new Set(soulEssenceIds);
  const projectedEquipmentById = new Map(
    equipment.map(profile => [profile.equipmentId, profile])
  );
  const actorLoadoutDomains = normalizeOptimizationObjectIds([
    M12C_REQUIRED_OPTIMIZATION_OBJECT_ID,
    ...M12C_OPTIONAL_OPTIMIZATION_OBJECT_IDS,
  ]).map(optimizationObjectId => {
    const kiboEdges = qualification.bindingMatrix.actorKibo.filter(
      edge =>
        edge.actorObjectId === optimizationObjectId &&
        edge.compatible !== false &&
        edge.runtimeOwnerIdentity === 'actorSlotId+kiboId' &&
        admittedKiboIds.has(Number(edge.kiboId))
    );
    const soulEdges = qualification.bindingMatrix.actorSoulEssence.filter(
      edge =>
        edge.actorObjectId === optimizationObjectId &&
        edge.compatible === true &&
        admittedSoulEssenceIds.has(Number(edge.soulEssenceId))
    );
    const equipmentEdges = qualification.bindingMatrix.actorEquipment.filter(
      edge => {
        const profile = projectedEquipmentById.get(Number(edge.equipmentId));
        return (
          edge.actorObjectId === optimizationObjectId &&
          edge.compatible === true &&
          profile != null &&
          edge.slot === profile.slot
        );
      }
    );
    const equipmentBindings = equipmentEdges
      .map(edge => ({
        equipmentId: Number(edge.equipmentId),
        slot: edge.slot,
        setId: edge.setId == null ? null : Number(edge.setId),
        compatible: true,
        reason: edge.reason,
        searchEligible: true,
      }))
      .sort(compareEquipmentProfiles);
    const equipmentIdsBySlot = Object.fromEntries(
      M12C_EQUIPMENT_SLOTS.map(slot => [
        slot,
        equipmentBindings
          .filter(binding => binding.slot === slot)
          .map(binding => binding.equipmentId),
      ])
    );
    return {
      optimizationObjectId,
      kiboIds: kiboEdges.map(edge => Number(edge.kiboId)).sort(numberSort),
      soulEssenceIds: soulEdges
        .map(edge => Number(edge.soulEssenceId))
        .sort(numberSort),
      soulBindings: soulEdges
        .map(edge => ({
          soulEssenceId: Number(edge.soulEssenceId),
          reason: edge.reason,
          searchEligible: true,
        }))
        .sort((left, right) => left.soulEssenceId - right.soulEssenceId),
      equipmentIds: equipmentBindings.map(binding => binding.equipmentId),
      equipmentIdsBySlot,
      equipmentBindings,
    };
  });
  const setSkillThresholds = qualification.bindingMatrix.setSkillThresholds
    .map(edge => ({
      setId: Number(edge.setId),
      pieces: Number(edge.pieces),
      skillId: Number(edge.skillId),
      searchEligible: true,
      sourceIdentity: edge.sourceIdentity,
      manifestHash: recordsByKey.get(`set-skill:${edge.setId}:${edge.pieces}`)
        ?.manifestHash,
    }))
    .sort(
      (left, right) => left.setId - right.setId || left.pieces - right.pieces
    );
  const starbornInstance =
    qualification.cultivation.equipment.instanceTiers.find(
      tier => tier.identity === 'starborn'
    );
  const characterSources = qualification.cultivation.character.profiles
    .filter(profile =>
      teamCatalog.sourceConfigs.some(config =>
        config.actors.some(
          actor =>
            Number(actor.sourceCharacterId) === Number(profile.characterId)
        )
      )
    )
    .map(profile => {
      const rankSeven = profile.starGiftRanks.find(
        rank => Number(rank.rank) === 7
      );
      return {
        sourceCharacterId: Number(profile.characterId),
        position: profile.position,
        completedRankSourceIdentities: profile.starGiftRanks
          .filter(rank => Number(rank.rank) <= 6)
          .map(rank => rank.sourceIdentity),
        currentRankNodeIds: (rankSeven?.nodes ?? []).map(node =>
          Number(node.runeId)
        ),
        currentRankNodeSourceIdentities: (rankSeven?.nodes ?? []).map(
          node => node.sourceIdentity
        ),
        currentRankSourceIdentity: rankSeven?.sourceIdentity ?? null,
        sourceProfileHash: hashCanonicalValue(profile),
      };
    })
    .sort((left, right) => left.sourceCharacterId - right.sourceCharacterId);

  const equipmentCatalogCount = equipmentProfiles.length;
  return {
    schemaVersion: M12C_OUTER_BUILD_POOL_SCHEMA_VERSION,
    contractName: M12C_OUTER_BUILD_POOL_CONTRACT_NAME,
    kind: 'azpr-m12c-outer-build-pool',
    authority,
    teamCatalog,
    fixedCultivationProfile: {
      ...structuredClone(qualification.cultivation.fixedOptimizationProfile),
      heroRankInput: 'excluded',
      equipmentInstanceSource: {
        identity: starbornInstance.identity,
        bGoldSide: starbornInstance.bGoldSide,
        maximum: Number(starbornInstance.maximum),
        maximumRule: starbornInstance.maximumRule,
        sourceIdentity: starbornInstance.sourceIdentity,
      },
    },
    domains: {
      kibos,
      kiboIds,
      souls,
      soulEssenceIds,
      globalEquipmentQualifiedCount: equipmentCatalogCount,
      equipment,
      equipmentIdsBySlot,
      setSkillThresholds,
      actorLoadoutDomains,
      characterSources,
    },
    policies: {
      enumeration: 'lazy-layered-no-global-cartesian-materialization',
      componentReuseAcrossActors: {
        kiboBaseId: 'allowed',
        soulEssenceBaseId: 'allowed',
        equipmentBaseId: 'allowed',
      },
      kiboRuntimeOwnerIdentity: 'actorSlotId+kiboId',
      equipmentSlots: [...M12C_EQUIPMENT_SLOTS],
      setDerivation: 'equipment-only-2-and-4-piece-once-each',
      rejection: {
        illegal: 'selection-contract-or-loadout-domain-violation',
        unscoreable: 'qualification-source-binding-or-hash-not-authoritative',
        bothExcludedBeforeScoring: true,
      },
      buildIdentityExcludes: ['initialFront', 'axis', 'initialStatePreset'],
    },
    summary: {
      teamCount: teamCatalog.summary.teamCount,
      sourceConfigCount: teamCatalog.summary.sourceConfigCount,
      kiboCount: kiboIds.length,
      soulEssenceCount: soulEssenceIds.length,
      globalEquipmentQualifiedCount: equipmentCatalogCount,
      m12cEquipmentProjectionCount: equipment.length,
      m12cEquipmentProjectionCountBySlot: Object.fromEntries(
        M12C_EQUIPMENT_SLOTS.map(slot => [
          slot,
          equipmentIdsBySlot[slot].length,
        ])
      ),
      setSkillThresholdCount: setSkillThresholds.length,
    },
  };
}

function validateBuildActor({
  actor,
  expectedActor,
  pool,
  illegalIssues,
  unscoreableIssues,
}) {
  const actorIdentity = expectedActor.optimizationObjectId;
  if (actor.actorSlotId !== expectedActor.actorSlotId) {
    illegalIssues.push(`m12c-build-actor-slot-invalid:${actorIdentity}`);
  }
  if (Number(actor.sourceCharacterId) !== expectedActor.sourceCharacterId) {
    illegalIssues.push(`m12c-build-source-alias-invalid:${actorIdentity}`);
  }
  const domain = pool.domains.actorLoadoutDomains.find(
    row => row.optimizationObjectId === actorIdentity
  );
  const kiboId = Number(actor.kiboId);
  if (!pool.domains.kiboIds.includes(kiboId)) {
    illegalIssues.push(`m12c-build-kibo-not-qualified:${actorIdentity}`);
  } else if (!domain?.kiboIds.includes(kiboId)) {
    unscoreableIssues.push(
      `m12c-build-kibo-binding-unscoreable:${actorIdentity}`
    );
  }
  const soulEssenceId = Number(actor.soulEssenceId);
  if (!pool.domains.soulEssenceIds.includes(soulEssenceId)) {
    illegalIssues.push(`m12c-build-soul-not-qualified:${actorIdentity}`);
  } else if (!domain?.soulEssenceIds.includes(soulEssenceId)) {
    illegalIssues.push(
      `m12c-build-soul-profession-incompatible:${actorIdentity}`
    );
  }

  if (!Array.isArray(actor.equipment) || actor.equipment.length !== 5) {
    illegalIssues.push(`m12c-build-equipment-count-invalid:${actorIdentity}`);
    return;
  }
  const slots = actor.equipment.map(item => item?.slot);
  if (new Set(slots).size !== slots.length) {
    illegalIssues.push(`m12c-build-equipment-slot-duplicate:${actorIdentity}`);
  }
  for (const slot of M12C_EQUIPMENT_SLOTS) {
    const items = actor.equipment.filter(item => item?.slot === slot);
    if (items.length !== 1) {
      illegalIssues.push(
        `m12c-build-equipment-slot-cardinality-invalid:${actorIdentity}:${slot}`
      );
      continue;
    }
    const item = items[0];
    const equipmentId = Number(item.equipmentId);
    const profile = pool.domains.equipment.find(
      row => row.equipmentId === equipmentId
    );
    if (!profile) {
      illegalIssues.push(
        `m12c-build-equipment-not-in-53-projection:${actorIdentity}:${slot}`
      );
      continue;
    }
    if (profile.slot !== slot) {
      illegalIssues.push(
        `m12c-build-equipment-slot-mismatch:${actorIdentity}:${slot}`
      );
    }
    const fixed = pool.fixedCultivationProfile.equipment;
    if (
      Number(item.rarity) !== Number(fixed.rarity) ||
      Number(item.enhancementLevel) !== Number(fixed.enhancementLevel) ||
      Number(item.tuningScore) !== Number(fixed.tuningScore) ||
      item.instanceTier !== fixed.instanceTier ||
      item.bGoldSide !== fixed.bGoldSide
    ) {
      illegalIssues.push(
        `m12c-build-equipment-instance-invalid:${actorIdentity}:${slot}`
      );
    }
    if (!domain?.equipmentIds.includes(equipmentId)) {
      unscoreableIssues.push(
        `m12c-build-equipment-binding-unscoreable:${actorIdentity}:${slot}`
      );
    }
  }
  if (slots.some(slot => !M12C_EQUIPMENT_SLOTS.includes(slot))) {
    illegalIssues.push(`m12c-build-equipment-slot-unknown:${actorIdentity}`);
  }
}

function materializeBuildActor({ actor, expectedActor, pool }) {
  const characterSource = pool.domains.characterSources.find(
    source => source.sourceCharacterId === expectedActor.sourceCharacterId
  );
  const kibo = pool.domains.kibos.find(
    row => row.kiboId === Number(actor.kiboId)
  );
  const soul = pool.domains.souls.find(
    row => row.soulEssenceId === Number(actor.soulEssenceId)
  );
  const actorDomain = pool.domains.actorLoadoutDomains.find(
    row => row.optimizationObjectId === expectedActor.optimizationObjectId
  );
  const soulBinding = actorDomain.soulBindings.find(
    row => row.soulEssenceId === soul.soulEssenceId
  );
  const equipment = M12C_EQUIPMENT_SLOTS.map(slot => {
    const selected = actor.equipment.find(item => item.slot === slot);
    const profile = pool.domains.equipment.find(
      row => row.equipmentId === Number(selected.equipmentId)
    );
    const equipmentBinding = actorDomain.equipmentBindings.find(
      row => row.equipmentId === profile.equipmentId && row.slot === slot
    );
    const fixedEquipment = pool.fixedCultivationProfile.equipment;
    return {
      slot,
      equipmentId: profile.equipmentId,
      setId: profile.setId,
      rarity: Number(fixedEquipment.rarity),
      enhancementLevel: Number(fixedEquipment.enhancementLevel),
      tuningScore: Number(fixedEquipment.tuningScore),
      instanceTier: fixedEquipment.instanceTier,
      bGoldSide: fixedEquipment.bGoldSide,
      compatibilityReason: equipmentBinding.reason,
      manifestHash: profile.manifestHash,
      sourceIdentity: profile.sourceIdentity,
    };
  });
  const setBonuses = deriveM12cSetBonuses(equipment, { pool }).setBonuses;
  return {
    actorSlotId: expectedActor.actorSlotId,
    optimizationObjectId: expectedActor.optimizationObjectId,
    sourceCharacterId: expectedActor.sourceCharacterId,
    position: expectedActor.position,
    characterCultivation: {
      level: pool.fixedCultivationProfile.character.level,
      starGiftRank: pool.fixedCultivationProfile.character.starGiftRank,
      completedStarGiftAttributeRank:
        pool.fixedCultivationProfile.character.completedStarGiftAttributeRank,
      currentRankNodeSelection:
        pool.fixedCultivationProfile.character.currentRankNodeSelection,
      currentRankNodeIds: characterSource.currentRankNodeIds,
      completedRankSourceIdentities:
        characterSource.completedRankSourceIdentities,
      currentRankNodeSourceIdentities:
        characterSource.currentRankNodeSourceIdentities,
      currentRankSourceIdentity: characterSource.currentRankSourceIdentity,
      sourceProfileHash: characterSource.sourceProfileHash,
    },
    kibo: {
      kiboId: kibo.kiboId,
      runtimeOwnerIdentity: `${expectedActor.actorSlotId}+${kibo.kiboId}`,
      runtimeOwnerContract: 'actorSlotId+kiboId',
      level: pool.fixedCultivationProfile.kibo.level,
      talents: structuredClone(
        pool.fixedCultivationProfile.kibo.resolvedTalentValuesByAttributeId
      ),
      talentLevels: structuredClone(
        pool.fixedCultivationProfile.kibo.talentLevelsByAttributeId
      ),
      bondLevel: pool.fixedCultivationProfile.kibo.bondLevel,
      inheritanceBasisPoints:
        pool.fixedCultivationProfile.kibo.inheritanceBasisPoints,
      dnaFactors: [],
      manifestHash: kibo.manifestHash,
    },
    soulEssence: {
      soulEssenceId: soul.soulEssenceId,
      profession: soul.profession,
      compatibilityReason: soulBinding.reason,
      level: pool.fixedCultivationProfile.soulEssence.level,
      rank: pool.fixedCultivationProfile.soulEssence.rank,
      star: pool.fixedCultivationProfile.soulEssence.star,
      manifestHash: soul.manifestHash,
      sourceIdentity: soul.sourceIdentity,
      profileHash: soul.profileHash,
    },
    equipment,
    setBonuses,
  };
}

function* iterateActorLoadouts(actorPlan, { selectedActors, shouldPrune }) {
  for (const kiboId of actorPlan.kiboIds) {
    if (
      invokePrune(shouldPrune, {
        stage: 'kibo',
        actorSlotId: actorPlan.actorSlotId,
        optimizationObjectId: actorPlan.optimizationObjectId,
        kiboId,
        selectedActors: structuredClone(selectedActors),
      })
    ) {
      continue;
    }
    for (const soulEssenceId of actorPlan.soulEssenceIds) {
      if (
        invokePrune(shouldPrune, {
          stage: 'soul-essence',
          actorSlotId: actorPlan.actorSlotId,
          optimizationObjectId: actorPlan.optimizationObjectId,
          kiboId,
          soulEssenceId,
          selectedActors: structuredClone(selectedActors),
        })
      ) {
        continue;
      }
      const selectedEquipment = [];
      const recurseEquipment = function* (slotIndex) {
        if (slotIndex >= M12C_EQUIPMENT_SLOTS.length) {
          yield {
            actorSlotId: actorPlan.actorSlotId,
            optimizationObjectId: actorPlan.optimizationObjectId,
            sourceCharacterId: actorPlan.sourceCharacterId,
            kiboId,
            soulEssenceId,
            equipment: structuredClone(selectedEquipment),
          };
          return;
        }
        const slot = M12C_EQUIPMENT_SLOTS[slotIndex];
        for (const equipmentId of actorPlan.equipmentIdsBySlot[slot]) {
          const item = createFixedEquipmentSelection(slot, equipmentId);
          selectedEquipment.push(item);
          const prune = invokePrune(shouldPrune, {
            stage: 'equipment',
            actorSlotId: actorPlan.actorSlotId,
            optimizationObjectId: actorPlan.optimizationObjectId,
            kiboId,
            soulEssenceId,
            slot,
            equipmentId,
            selectedEquipment: structuredClone(selectedEquipment),
            selectedActors: structuredClone(selectedActors),
          });
          if (!prune) yield* recurseEquipment(slotIndex + 1);
          selectedEquipment.pop();
        }
      };
      yield* recurseEquipment(0);
    }
  }
}

function validateM12cBuildEnumerationPlan(plan, pool) {
  const issues = [];
  const poolValidation = validateM12cOuterBuildPool(pool);
  issues.push(...poolValidation.issues);
  if (
    plan?.schemaVersion !== M12C_OUTER_BUILD_POOL_SCHEMA_VERSION ||
    plan?.contractName !== M12C_BUILD_ENUMERATION_PLAN_CONTRACT_NAME
  ) {
    issues.push('m12c-build-plan-contract-invalid');
  }
  if (plan?.poolHash !== pool.poolHash) {
    issues.push('m12c-build-plan-pool-hash-mismatch');
  }
  if (plan && typeof plan === 'object') {
    const payload = structuredClone(plan);
    delete payload.planHash;
    if (plan.planHash !== hashCanonicalValue(payload)) {
      issues.push('m12c-build-plan-hash-mismatch');
    }
  }
  return [...new Set(issues)].sort();
}

function validateFormalAdmissionBinding(binding, qualification) {
  const issues = [];
  if (
    binding?.schemaVersion !== 1 ||
    binding?.contractName !== 'AzPrM12B3BindingMatrix' ||
    binding?.kind !== 'azpr-m12-b3-binding-matrix' ||
    binding?.phase !== 'M12-B3-E22'
  ) {
    issues.push('m12c-outer-formal-admission-contract-invalid');
  }
  if (
    binding?.summary?.allPassed !== true ||
    Number(binding?.summary?.blockedCount) !== 0 ||
    Number(binding?.summary?.passedCount) !==
      Number(binding?.summary?.checkCount)
  ) {
    issues.push('m12c-outer-formal-admission-not-passed');
  }
  const hashPayload = structuredClone(binding ?? {});
  delete hashPayload.generatedAt;
  delete hashPayload.bindingMatrixHash;
  const expectedHash = hashCanonicalValue({
    ...hashPayload,
    bindingMatrixHash: null,
  });
  if (binding?.bindingMatrixHash !== expectedHash) {
    issues.push('m12c-outer-formal-admission-hash-invalid');
  }
  const expectedHashes = {
    rosterHash: qualification?.rosterHash,
    manifestsHash: qualification?.manifestsHash,
    ledgerHash: qualification?.gapLedgerHash,
    bindingMatrixHash: qualification?.bindingMatrixHash,
    qualificationCatalogHash: qualification?.catalogHash,
  };
  for (const [key, expected] of Object.entries(expectedHashes)) {
    if (binding?.hashes?.[key] !== expected) {
      issues.push(`m12c-outer-formal-admission-binding-mismatch:${key}`);
    }
  }
  return issues;
}

function isFixedM12cCultivationProfile(profile) {
  if (!isRecord(profile)) return false;
  const value = structuredClone(profile);
  const fixedProfileHash = value.fixedProfileHash;
  delete value.fixedProfileHash;
  return (
    fixedProfileHash === hashCanonicalValue(value) &&
    Number(value.character?.level) === 80 &&
    Number(value.character?.starGiftRank) === 7 &&
    Number(value.character?.completedStarGiftAttributeRank) === 6 &&
    value.character?.currentRankNodeSelection === 'all' &&
    value.character?.heroRank == null &&
    Number(value.kibo?.level) === 80 &&
    hashCanonicalValue(value.kibo?.talentLevelsByAttributeId) ===
      hashCanonicalValue({ 1: 10, 3: 10, 4: 10, 5: 10 }) &&
    hashCanonicalValue(value.kibo?.resolvedTalentValuesByAttributeId) ===
      hashCanonicalValue({ 1: 120, 3: 120, 4: 120, 5: 120 }) &&
    Number(value.kibo?.bondLevel) === 1 &&
    Number(value.kibo?.inheritanceBasisPoints) === 900 &&
    hashCanonicalValue(value.kibo?.dnaFactors) === hashCanonicalValue([]) &&
    Number(value.soulEssence?.level) === 80 &&
    Number(value.soulEssence?.rank) === 6 &&
    Number(value.soulEssence?.star) === 1 &&
    Number(value.equipment?.rarity) === 4 &&
    Number(value.equipment?.enhancementLevel) === 9 &&
    Number(value.equipment?.tuningScore) === 110 &&
    value.equipment?.instanceTier === 'starborn' &&
    value.equipment?.bGoldSide === true &&
    Number(value.equipment?.maxValue) === 110
  );
}

function extractQualificationAuthority(catalog) {
  return {
    qualificationCatalogHash: catalog?.catalogHash ?? null,
    qualificationBindingMatrixHash: catalog?.bindingMatrixHash ?? null,
    sourceSnapshotHash: catalog?.sourceSnapshotHash ?? null,
    rosterHash: catalog?.rosterHash ?? null,
    manifestsHash: catalog?.manifestsHash ?? null,
    gapLedgerHash: catalog?.gapLedgerHash ?? null,
    fixedCultivationProfileHash:
      catalog?.cultivation?.fixedOptimizationProfile?.fixedProfileHash ?? null,
  };
}

function createBuildValidation(illegalIssues, unscoreableIssues) {
  const illegal = [...new Set(illegalIssues)].sort();
  const unscoreable = [...new Set(unscoreableIssues)].sort();
  const classification =
    illegal.length > 0
      ? 'illegal'
      : unscoreable.length > 0
        ? 'unscoreable'
        : 'scoreable';
  return {
    valid: classification === 'scoreable',
    scoreable: classification === 'scoreable',
    classification,
    illegal: illegal.length > 0,
    unscoreable: unscoreable.length > 0,
    issues: [...new Set([...illegal, ...unscoreable])].sort(),
    illegalIssues: illegal,
    unscoreableIssues: unscoreable,
  };
}

function createFixedEquipmentSelection(slot, equipmentId) {
  return {
    slot,
    equipmentId,
    rarity: 4,
    enhancementLevel: 9,
    tuningScore: 110,
    instanceTier: 'starborn',
    bGoldSide: true,
  };
}

function constrainNumericDomain({ base, requested, issueCode, issues }) {
  if (requested == null) return [...base];
  if (!Array.isArray(requested) || requested.length === 0) {
    issues.push(issueCode);
    return [];
  }
  const normalized = [...new Set(requested.map(Number))].sort(numberSort);
  if (
    normalized.some(value => !Number.isInteger(value) || !base.includes(value))
  ) {
    issues.push(issueCode);
    return [];
  }
  return normalized;
}

function createTeamIdentity(objectIds) {
  return `${TEAM_ID_PREFIX}:${objectIds.join('+')}`;
}

function createSourceConfigIdentity(actors) {
  return `${SOURCE_CONFIG_ID_PREFIX}:${actors
    .map(actor => `${actor.optimizationObjectId}=${actor.sourceCharacterId}`)
    .join('+')}`;
}

function createActorSlotId(optimizationObjectId) {
  return `${ACTOR_SLOT_ID_PREFIX}:${optimizationObjectId}`;
}

function normalizeOptimizationObjectIds(values) {
  const entries = Array.isArray(values) ? values : [];
  return [...new Set(entries.map(String))].sort(compareObjectIds);
}

function normalizeSourceCharacterIdList(value) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return [...new Set(values.map(Number))]
    .filter(Number.isInteger)
    .sort(numberSort);
}

function compareObjectIds(left, right) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  const leftNumeric =
    Number.isInteger(leftNumber) && String(leftNumber) === left;
  const rightNumeric =
    Number.isInteger(rightNumber) && String(rightNumber) === right;
  if (leftNumeric && rightNumeric) return leftNumber - rightNumber;
  if (leftNumeric) return -1;
  if (rightNumeric) return 1;
  return left.localeCompare(right, 'en');
}

function compareEquipmentProfiles(left, right) {
  return (
    M12C_EQUIPMENT_SLOTS.indexOf(left.slot) -
      M12C_EQUIPMENT_SLOTS.indexOf(right.slot) ||
    left.equipmentId - right.equipmentId
  );
}

function numberSort(left, right) {
  return left - right;
}

function invokePrune(callback, context) {
  return callback ? callback(context) === true : false;
}

function normalizeIssueCode(issue) {
  if (typeof issue === 'string') return issue;
  return issue?.code ?? 'm12c-outer-qualification-validation-unknown';
}

function isRecord(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
