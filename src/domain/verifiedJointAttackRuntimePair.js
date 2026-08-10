import { ACTION_TYPES } from './projectSchema';
import {
  compareSourceSequencePaths,
  getActionSourceSequencePath,
} from './actionSourceSequence';
import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization';
import { resolveVerifiedKiboJointAttackBinding } from './verifiedJointAttackContract';
import {
  VERIFIED_JOINT_ATTACK_RUNTIME_READY_CODE,
  resolveVerifiedJointAttackRuntimeBinding,
} from './verifiedJointAttackRuntimeContract';

export const VERIFIED_JOINT_ATTACK_PAIR_SOURCE_ORDER_INVALID =
  'joint-attack-pair-source-order-invalid';

export function createVerifiedJointAttackRuntimePair({
  actorAction,
  kiboAction,
  actor = null,
  scenario = {},
  fps = 60,
  actorActionIndex = null,
  kiboActionIndex = null,
} = {}) {
  if (!isActorJointAttack(actorAction)) {
    return rejected('joint-attack-actor-side-invalid');
  }
  const kiboBinding = resolveVerifiedKiboJointAttackBinding(kiboAction);
  if (!kiboBinding) return rejected('joint-attack-kibo-side-invalid');
  const configuredKiboId = positiveIntegerOrNull(actor?.loadout?.kiboId);
  if (
    configuredKiboId == null ||
    configuredKiboId !== positiveIntegerOrNull(kiboBinding.ownerId) ||
    String(actorAction?.actorId ?? '') !== String(kiboAction?.actorId ?? '')
  ) {
    return rejected('joint-attack-owner-or-equipped-kibo-mismatch');
  }
  const actorFrame = msToFrame(actorAction.startMs, fps);
  const kiboFrame = msToFrame(kiboAction.startMs, fps);
  if (actorFrame !== kiboFrame) {
    return rejected('joint-attack-frame-mismatch');
  }
  const defaultTargetId = resolveScenarioTargetIdentity(scenario);
  const actorTargetId = resolveVerifiedJointAttackTargetIdentity(
    actorAction,
    defaultTargetId
  );
  const kiboTargetId = resolveVerifiedJointAttackTargetIdentity(
    kiboAction,
    defaultTargetId
  );
  if (
    actorTargetId != null &&
    kiboTargetId != null &&
    actorTargetId !== kiboTargetId
  ) {
    return rejected('joint-attack-target-mismatch');
  }
  const targetId = actorTargetId ?? kiboTargetId ?? defaultTargetId;
  const actorSourceSequencePath = getActionSourceSequencePath(
    actorAction,
    actorActionIndex
  );
  const kiboSourceSequencePath = getActionSourceSequencePath(
    kiboAction,
    kiboActionIndex
  );
  if (
    !isAtomicPairSourceOrder(actorSourceSequencePath, kiboSourceSequencePath)
  ) {
    return rejected(VERIFIED_JOINT_ATTACK_PAIR_SOURCE_ORDER_INVALID);
  }
  const runtimeValidation = resolveVerifiedJointAttackRuntimeBinding(scenario);
  if (!runtimeValidation.valid) {
    return rejected(
      'joint-attack-runtime-contract-required',
      runtimeValidation.issues
    );
  }
  const orderedActionIds = [actorAction, kiboAction]
    .sort((left, right) =>
      compareSourceSequencePaths(
        getActionSourceSequencePath(left, actorActionIndex),
        getActionSourceSequencePath(right, kiboActionIndex)
      )
    )
    .map(action => String(action.id));
  const identity = {
    contractId: runtimeValidation.binding.contractId,
    bindingHash: runtimeValidation.binding.bindingHash,
    actorActionId: String(actorAction.id),
    kiboActionId: String(kiboAction.id),
    orderedActionIds,
    actorId: String(actorAction.actorId),
    kiboId: configuredKiboId,
    targetId,
    inputFrame: actorFrame,
    actorSourceSequencePath,
    kiboSourceSequencePath,
    kiboMappingIdentity: kiboBinding.mappingIdentity,
    mechanicsPackageHash: kiboBinding.mechanicsPackageHash,
  };
  return Object.freeze({
    ready: true,
    code: VERIFIED_JOINT_ATTACK_RUNTIME_READY_CODE,
    pairIdentity: `joint-pair:${hashCanonicalValue(identity)}`,
    ...identity,
    actorAction,
    kiboAction,
    kiboBinding,
    runtimeBinding: runtimeValidation.binding,
  });
}

export function createVerifiedJointAttackRuntimeEvidence(pair) {
  if (pair?.ready !== true) return null;
  const value = {
    code: VERIFIED_JOINT_ATTACK_RUNTIME_READY_CODE,
    status: 'resolved-by-product-assumption',
    formalEligible: true,
    clientParityReady: false,
    pairIdentity: pair.pairIdentity,
    actorActionId: pair.actorActionId,
    kiboActionId: pair.kiboActionId,
    orderedActionIds: pair.orderedActionIds,
    actorId: pair.actorId,
    kiboId: pair.kiboId,
    targetId: pair.targetId,
    inputFrame: pair.inputFrame,
    actorSourceSequencePath: pair.actorSourceSequencePath,
    kiboSourceSequencePath: pair.kiboSourceSequencePath,
    mappingIdentity: pair.kiboMappingIdentity,
    mechanicsPackageHash: pair.mechanicsPackageHash,
    runtimeContractId: pair.runtimeBinding.contractId,
    runtimeContractHash: pair.runtimeBinding.contractHash,
    runtimeBindingHash: pair.runtimeBinding.bindingHash,
    triggerResolution:
      'known-client-predicates-plus-versioned-product-fallback',
    settlementResolution:
      'first-source-ordered-verified-kibo-landed-hit-anchored-post-damage-toughness-clear',
    sourceLedger: pair.runtimeBinding.evidence.sourceLedger,
    resolvedByProductAssumption:
      pair.runtimeBinding.evidence.resolvedByProductAssumption,
    leavesOpen: pair.runtimeBinding.evidence.leavesOpen,
  };
  return Object.freeze({
    ...value,
    evidenceHash: hashCanonicalValue(value),
  });
}

export function resolveVerifiedJointAttackTargetIdentity(
  action,
  defaultTargetId = null
) {
  const value = action?.targetId ?? action?.target?.id ?? defaultTargetId;
  return value == null ? null : String(value);
}

export function isActorJointAttack(action) {
  return (
    action?.type === ACTION_TYPES.SKILL && action?.actionKind === 'star-combo'
  );
}

function isAtomicPairSourceOrder(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (compareSourceSequencePaths(left, right) === 0) return false;
  if (left.length !== 1 || right.length !== 1) return false;
  return Math.abs(Number(left[0]) - Number(right[0])) === 1;
}

function resolveScenarioTargetIdentity(scenario) {
  const value =
    scenario?.enemies?.[0]?.id ??
    scenario?.enemy?.id ??
    scenario?.enemy?.enemyId ??
    scenario?.target?.id ??
    null;
  return value == null ? null : String(value);
}

function rejected(code, issues = []) {
  return Object.freeze({ ready: false, code, issues: [...(issues ?? [])] });
}

function msToFrame(timeMs, fps) {
  return Math.round((Number(timeMs ?? 0) * Number(fps || 60)) / 1000);
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
