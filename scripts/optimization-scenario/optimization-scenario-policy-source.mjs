import verifiedMechanicsPackage from '../../src/data/generated/verified-combat-mechanics-package.json' with { type: 'json' };
import {
  MACHINE_AXIS_DEFAULT_PRIMARY_OBJECTIVE,
  createMachineAxisObjectivePolicy,
} from '../../src/machine-axis/machineAxisObjectiveContract.js';
import { hashCanonicalValue } from '../../src/simulation/headless/canonicalSerialization.js';

export const M12C_OPTIMIZATION_SCENARIO_POLICY_REASON =
  'm12c-zero-distance-passive-boss-out-of-scope';
export const M12C_OPTIMIZATION_ROSTER_EXCLUSION_REASON =
  'm12c-no-in-scope-wind-or-thunder-mark-production';

const EXCLUDED_ACTION_KINDS = Object.freeze([
  'dodge-attack',
  'limit-counter',
  'perfect-parry',
  'plunging-attack',
]);
const RETAINED_ACTION_KINDS = Object.freeze([
  'charged-attack',
  'normal-attack',
  'star-carry',
  'star-combo',
  'star-skill',
  'ultimate',
]);
const GRANDFATHERED_CHARACTER_IDS = Object.freeze([101010, 103002, 109001]);
const MARK_PRODUCER_CHARACTER_IDS = Object.freeze([
  102001, 107001, 107002, 108003, 112001,
]);
const PRODUCT_EXCLUDED_CHARACTER_IDS = Object.freeze([108001, 111001]);
const FORMAL_MARK_IDS = new Set([250, 750]);
const OBJECTIVE_POLICY = createMachineAxisObjectivePolicy();

const POLICY_SOURCE = Object.freeze({
  schemaVersion: 1,
  contractName: 'AzPrOptimizationScenarioPolicy',
  policyId: 'm12c-zero-distance-passive-boss-v1',
  phase: 'M12-C',
  status: 'product-frozen',
  reason: M12C_OPTIMIZATION_SCENARIO_POLICY_REASON,
  assumptions: {
    actorTargetInitialDistance: 0,
    actorTargetDistanceMode: 'fixed-zero',
    projectileImpactPolicy: 'zero-distance-immediate-hit',
    enemyBehavior: 'passive-static-target',
    enemyActiveAttacks: false,
    enemyReactionStimuli: false,
    targetPolicy: structuredClone(
      OBJECTIVE_POLICY.objectivesById[MACHINE_AXIS_DEFAULT_PRIMARY_OBJECTIVE]
        .targetPolicy
    ),
  },
  optimizationSurface: {
    excludedActionKinds: [...EXCLUDED_ACTION_KINDS],
    retainedActionKinds: [...RETAINED_ACTION_KINDS],
    excludedTriggerFamilies: [
      'enemy-active-attack',
      'player-receive-damage',
      'player-dodge',
      'player-block',
      'player-parry',
      'player-counter',
      'position-or-airborne-required',
    ],
    runtimeRetention: 'manual-runtime-preserved',
    formalCandidateDisposition: 'reject-before-search',
  },
  consumers: [
    'character-acceptance',
    'machine-axis-candidate-surface',
    'machine-axis-formal-admission',
    'machine-axis-cycle-replay',
    'trial-release',
    'workbench-machine-axis-import-export',
  ],
  hashBindings: ['input', 'data', 'trace', 'build'],
});

export function createOptimizationScenarioPolicy() {
  const roster = createCandidateRosterPolicy();
  const policy = {
    ...structuredClone(POLICY_SOURCE),
    objectivePolicy: createMachineAxisObjectivePolicy(),
    candidateRoster: roster,
  };
  return {
    ...policy,
    policyHash: hashCanonicalValue(policy),
  };
}

function createCandidateRosterPolicy() {
  const grandfatheredCharacters = GRANDFATHERED_CHARACTER_IDS.map(
    characterId => ({
      characterId,
      name: ownerName(characterId),
      optimizationObjectId: String(characterId),
      disposition: 'included-grandfathered',
      inclusionBasis: 'existing-product-scope-not-retrospectively-removed',
      sourceIdentity: actionMappingSourceIdentity(characterId),
    })
  );
  const markProducerCharacters = MARK_PRODUCER_CHARACTER_IDS.map(
    characterId => {
      const productionEvidence = createProductionEvidence(characterId);
      if (productionEvidence.length === 0) {
        throw new Error(
          `optimization-roster-producer-evidence-missing:${characterId}`
        );
      }
      return {
        characterId,
        name: ownerName(characterId),
        optimizationObjectId: String(characterId),
        disposition: 'included-verified-mark-producer',
        inclusionBasis: 'in-scope-active-action-produces-wind-or-thunder-mark',
        productionEvidence,
        consumptionEvidence: createConsumptionEvidence(characterId),
      };
    }
  );
  const productScenarioExcludedCharacters = PRODUCT_EXCLUDED_CHARACTER_IDS.map(
    characterId => {
      const productionEvidence = createProductionEvidence(characterId);
      if (productionEvidence.length > 0) {
        throw new Error(
          `optimization-roster-excluded-character-has-production:${characterId}`
        );
      }
      return {
        characterId,
        name: ownerName(characterId),
        optimizationObjectId: String(characterId),
        disposition: 'product-scenario-excluded',
        reason: M12C_OPTIMIZATION_ROSTER_EXCLUSION_REASON,
        productionEvidence,
        consumptionEvidence: createConsumptionEvidence(characterId),
        sourceRetention: 'source-data-manual-runtime-and-coverage-retained',
      };
    }
  );
  const formalOptimizationObjectIds = [
    ...grandfatheredCharacters.map(item => item.optimizationObjectId),
    ...markProducerCharacters.map(item => item.optimizationObjectId),
    'STARBORN',
  ];
  const roster = {
    schemaVersion: 1,
    contractName: 'AzPrOptimizationCandidateRosterPolicy',
    rosterPolicyId: 'm12c-wind-thunder-mark-producer-roster-v1',
    status: 'product-frozen',
    inclusionCriterion: {
      scope: 'remaining-normal-characters',
      requiredMarkIds: [250, 750],
      requiredOperation: 'tuningMark-positive-stack-delta',
      requiredActionDisposition: 'optimization-in-scope-active-action',
      rejectedEvidenceKinds: [
        'tuningOverlimit-consumption',
        'judgment-read',
        'excluded-action-association',
      ],
    },
    verifiedMechanicsSource: {
      sourceIdentity:
        'src/data/generated/verified-combat-mechanics-package.json#actionMappings|controlBindings.effects',
      packageId: verifiedMechanicsPackage.packageId,
      packageHash: verifiedMechanicsPackage.packageHash,
    },
    formalDenominator: 9,
    formalOptimizationObjectIds,
    grandfatheredCharacters,
    markProducerCharacters,
    starborn: {
      optimizationObjectId: 'STARBORN',
      disposition: 'included-single-unified-object',
      sourceCharacterIds: [199001, 199002],
    },
    productScenarioExcludedCharacters,
  };
  if (formalOptimizationObjectIds.length !== roster.formalDenominator) {
    throw new Error('optimization-roster-formal-denominator-mismatch');
  }
  return {
    ...roster,
    rosterHash: hashCanonicalValue(roster),
  };
}

function createProductionEvidence(characterId) {
  return collectInScopeEffects(characterId)
    .filter(({ effect }) =>
      FORMAL_MARK_IDS.has(Number(effect.tuningMark?.markId))
    )
    .filter(({ effect }) => Number(effect.tuningMark?.stackDelta ?? 0) > 0)
    .map(({ mapping, effect }) => ({
      actionIdentity: mapping.identity,
      actionKind: mapping.actionKind,
      controlSkillId: Number(mapping.controlSkillId),
      effectIdentity: effect.effectIdentity,
      elementId: Number(effect.elementId),
      markId: Number(effect.tuningMark.markId),
      stackDelta: Number(effect.tuningMark.stackDelta),
      depth: Number(effect.depth),
      startFrame: integerOrNull(effect.trigger?.startFrame),
      relationPath: structuredClone(effect.relationPath ?? []),
      sourceIdentity:
        effect.sourceOrder?.sourceIdentity ?? effect.sourceIdentity,
      tuningMarkSourceIdentity: effect.tuningMark.sourceIdentity,
    }))
    .sort(sortEffectEvidence);
}

function createConsumptionEvidence(characterId) {
  return collectInScopeEffects(characterId)
    .filter(({ effect }) =>
      FORMAL_MARK_IDS.has(Number(effect.tuningOverlimit?.markId))
    )
    .map(({ mapping, effect }) => ({
      actionIdentity: mapping.identity,
      actionKind: mapping.actionKind,
      controlSkillId: Number(mapping.controlSkillId),
      effectIdentity: effect.effectIdentity,
      operation: 'tuningOverlimit-consumption',
      markId: Number(effect.tuningOverlimit.markId),
      packetElementId: Number(effect.tuningOverlimit.packetElementId),
      judgmentElementId: integerOrNull(
        effect.tuningOverlimit.judgmentElementId
      ),
      startFrame: integerOrNull(effect.trigger?.startFrame),
      sourceIdentity:
        effect.sourceOrder?.sourceIdentity ?? effect.sourceIdentity,
    }))
    .sort(sortEffectEvidence);
}

function collectInScopeEffects(characterId) {
  const controlsById = new Map(
    (verifiedMechanicsPackage.controlBindings ?? []).map(control => [
      Number(control.controlSkillId),
      control,
    ])
  );
  return (verifiedMechanicsPackage.actionMappings ?? [])
    .filter(mapping => Number(mapping.ownerId) === Number(characterId))
    .filter(mapping => mapping.schedulable === true)
    .filter(
      mapping => !EXCLUDED_ACTION_KINDS.includes(String(mapping.actionKind))
    )
    .flatMap(mapping => {
      const control = controlsById.get(Number(mapping.controlSkillId));
      return (control?.effects ?? []).map(effect => ({ mapping, effect }));
    });
}

function ownerName(characterId) {
  const mapping = (verifiedMechanicsPackage.actionMappings ?? []).find(
    item => Number(item.ownerId) === Number(characterId)
  );
  if (!mapping?.ownerName) {
    throw new Error(`optimization-roster-owner-name-missing:${characterId}`);
  }
  return mapping.ownerName;
}

function actionMappingSourceIdentity(characterId) {
  const identities = (verifiedMechanicsPackage.actionMappings ?? [])
    .filter(item => Number(item.ownerId) === Number(characterId))
    .map(item => item.identity)
    .filter(Boolean)
    .sort();
  if (identities.length === 0) {
    throw new Error(`optimization-roster-action-source-missing:${characterId}`);
  }
  return `src/data/generated/verified-combat-mechanics-package.json#actionMappings[identity=${identities[0]}]`;
}

function sortEffectEvidence(left, right) {
  return (
    Number(left.controlSkillId) - Number(right.controlSkillId) ||
    Number(left.startFrame ?? Number.MAX_SAFE_INTEGER) -
      Number(right.startFrame ?? Number.MAX_SAFE_INTEGER) ||
    String(left.effectIdentity).localeCompare(
      String(right.effectIdentity),
      'en'
    )
  );
}

function integerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}
