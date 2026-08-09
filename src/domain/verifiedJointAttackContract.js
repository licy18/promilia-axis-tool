import {
  getInstalledVerifiedCombatMechanicsPackage,
  getVerifiedCombatActionInputMapping,
} from '../data/verifiedCombatMechanicsPackage';
import { ACTION_TYPES } from './projectSchema';
import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization';

export const VERIFIED_KIBO_JOINT_ATTACK_SKILL_TAG = 15;
export const JOINT_ATTACK_TRIGGER_UNRESOLVED_CODE =
  'joint-attack-trigger-unresolved';
export const JOINT_ATTACK_TRIGGER_STATUS =
  'preweakbreak-static-predicate-partially-closed';

const JOINT_ATTACK_ELIGIBILITY_LEAVES_OPEN = Object.freeze([
  'prebreak-threshold-formula-id-source-field-identity',
  'controlled-entity-offset-0x40-field-identity',
  'service-cannot-be-joint-strike-set-runtime-input',
]);
const JOINT_ATTACK_POST_CAST_LEAVES_OPEN = Object.freeze([
  'joint-strike-post-cast-effect-chain',
  'server-authoritative-weakness-point-clear',
]);

export function resolveVerifiedKiboJointAttackBinding(
  action = {},
  actionMapping = null
) {
  if (action?.type !== ACTION_TYPES.KIBO_EVENT) return null;
  const mapping =
    actionMapping?.controlLogic != null
      ? actionMapping
      : getVerifiedCombatActionInputMapping(action);
  const ownerId = positiveIntegerOrNull(mapping?.ownerId);
  const actionKiboId = positiveIntegerOrNull(action?.kiboId);
  const sourceSkillId = positiveIntegerOrNull(mapping?.sourceSkillId);
  const actionSkillId = positiveIntegerOrNull(action?.skillId);
  const expectedSourceIdentity =
    ownerId == null ? null : `NewTable/pet.rows[id=${ownerId}].breakSkillList`;
  if (
    mapping?.ownerKind !== 'kibo' ||
    mapping?.actionKind !== 'break' ||
    ownerId == null ||
    actionKiboId !== ownerId ||
    sourceSkillId == null ||
    actionSkillId !== sourceSkillId ||
    Number(mapping?.controlLogic?.skillTag) !==
      VERIFIED_KIBO_JOINT_ATTACK_SKILL_TAG ||
    mapping?.controlVariantSourceIdentity !== expectedSourceIdentity
  ) {
    return null;
  }
  const mechanicsPackage = getInstalledVerifiedCombatMechanicsPackage();
  if (
    !mapping.identity ||
    !mapping.controlLogic?.sourceIdentity ||
    !mechanicsPackage?.packageId ||
    !mechanicsPackage?.packageHash
  ) {
    return null;
  }
  return Object.freeze({
    status: 'verified-kibo-joint-attack-binding',
    ownerId,
    sourceSkillId,
    mappingIdentity: mapping.identity ?? null,
    skillTag: VERIFIED_KIBO_JOINT_ATTACK_SKILL_TAG,
    controlBindingSourceIdentity: mapping.controlLogic?.sourceIdentity ?? null,
    breakSkillListSourceIdentity: expectedSourceIdentity,
    mechanicsPackageId: mechanicsPackage?.packageId ?? null,
    mechanicsPackageHash: mechanicsPackage?.packageHash ?? null,
    triggerStatus: JOINT_ATTACK_TRIGGER_STATUS,
    triggerResolved: false,
  });
}

export function isVerifiedKiboJointAttack(action = {}, actionMapping = null) {
  return resolveVerifiedKiboJointAttackBinding(action, actionMapping) != null;
}

export function createJointAttackTriggerUnresolvedEvidence({
  actorAction = null,
  kiboAction = null,
  binding = null,
} = {}) {
  const identity = {
    actorActionId: actorAction?.id ?? null,
    kiboActionId: kiboAction?.id ?? null,
    actorId: actorAction?.actorId ?? kiboAction?.actorId ?? null,
    kiboId: binding?.ownerId ?? kiboAction?.kiboId ?? null,
    targetId: actorAction?.targetId ?? kiboAction?.targetId ?? null,
    mappingIdentity: binding?.mappingIdentity ?? null,
  };
  const value = {
    code: JOINT_ATTACK_TRIGGER_UNRESOLVED_CODE,
    status: JOINT_ATTACK_TRIGGER_STATUS,
    formalEligible: false,
    pairIdentity: `joint-pair:${hashCanonicalValue(identity)}`,
    ...identity,
    skillTag: binding?.skillTag ?? VERIFIED_KIBO_JOINT_ATTACK_SKILL_TAG,
    sourceIdentities: [
      binding?.breakSkillListSourceIdentity,
      binding?.controlBindingSourceIdentity,
    ].filter(Boolean),
    mechanicsPackageId: binding?.mechanicsPackageId ?? null,
    mechanicsPackageHash: binding?.mechanicsPackageHash ?? null,
    sourceLedger: [
      {
        sourceKind: 'azpr-client-research-state',
        sourceIdentity:
          'work/blue-origin-mechanics-review/STATE.md#2026-08-06-joint-strike-trigger',
        status: 'reviewed-static-chain',
      },
      {
        sourceKind: 'il2cpp-client-method',
        sourceIdentity: 'PreWeakBreakSystem.OnUpdateDeltaTime@0x13FB720',
        status: 'static-control-flow-closed',
      },
      {
        sourceKind: 'il2cpp-client-method',
        sourceIdentity: 'PreWeakBreakSystem.UpdatePreBreakThreshold@0x13FCB20',
        status: 'static-predicate-chain-partially-closed',
      },
    ],
    eligibilityEvidence: {
      status: 'client-static-predicate-chain-partially-closed',
      sourceMethod: 'PreWeakBreakSystem.OnUpdateDeltaTime@0x13FB720',
      thresholdMethod: 'UpdatePreBreakThreshold@0x13FCB20',
      resultField: 'PetData.m_ExistPetBreakTarget@0x460',
      evaluationCadence: 'per-client-update-not-fixed-window',
      thresholdFormula:
        'enemyMaxWeaknessPoint*WP_BREAK_TOUGH*kiboWP_BREAK_PERCENT',
      closedPredicates: [
        'enemy-alive-and-breakable',
        'enemy-not-broken-or-rage',
        'weakness-point-below-prebreak-threshold-or-force-break',
        'trigger-distance-height-hysteresis-and-connectivity',
        'controlled-hero-and-kibo-alive-state-ready',
        'player-slot-208-and-kibo-slot-601-ready',
        'ultimate-and-joint-fsm-conflicts-absent',
        'input-gate-open',
      ],
      leavesOpen: [...JOINT_ATTACK_ELIGIBILITY_LEAVES_OPEN],
    },
    postCastEvidence: {
      status: 'server-effect-and-weakness-cleanup-open',
      leavesOpen: [...JOINT_ATTACK_POST_CAST_LEAVES_OPEN],
    },
    leavesOpen: [
      ...JOINT_ATTACK_ELIGIBILITY_LEAVES_OPEN,
      ...JOINT_ATTACK_POST_CAST_LEAVES_OPEN,
    ],
  };
  return Object.freeze({
    ...value,
    evidenceHash: hashCanonicalValue(value),
  });
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
