import { frameToMs } from './timebase';
import {
  isRuntimeConditionSatisfied,
  resolveDerivedAttackChainEntry,
  resolveVerifiedNormalAttackInputEntryBase,
} from './verifiedActionContextScheduling';

export function resolveVerifiedNormalAttackInputEntry(options = {}) {
  return resolveVerifiedNormalAttackInputEntryBase({
    ...options,
    projectPhaseTransitions: projectNormalAttackPhaseTransitions,
  });
}

function projectNormalAttackPhaseTransitions({
  entry,
  graph,
  ownerId,
  actorId,
  timeMs,
  effectIntervals,
  variantRuntime,
  excludedActionIds,
  acceptedAction,
  acceptedSelection,
}) {
  if (
    !acceptedAction ||
    acceptedAction.actionKind !== 'normal-attack' ||
    acceptedAction.id == null
  ) {
    return [];
  }
  const acceptedChainIdentity =
    acceptedSelection?.attackInputChainIdentity ??
    acceptedAction.attackInputChainIdentity ??
    acceptedAction.attackInput?.attackInputChainIdentity ??
    null;
  const matches = (graph?.attackInputChains ?? [])
    .filter(
      chain =>
        chain.applied === true &&
        Number(chain.ownerId) === Number(ownerId) &&
        Number(chain.sourceSkillId) === Number(entry.skillId) &&
        isRuntimeConditionSatisfied({
          condition: chain.stateCondition,
          actorId,
          timeMs,
          effectIntervals,
          variantRuntime,
          excludedActionIds,
        })
    )
    .map(chain =>
      resolveDerivedAttackChainEntry({
        chain,
        graph,
        actorId,
        timeMs,
        actions: [acceptedAction],
        runtimeSelections: [acceptedSelection].filter(Boolean),
        includePendingPhaseTransition: true,
        sourceChainIdentity: acceptedChainIdentity,
      })
    )
    .filter(
      match =>
        match?.transition &&
        isRuntimeConditionSatisfied({
          condition: match.transition.condition,
          actorId,
          timeMs,
          effectIntervals,
          variantRuntime,
          excludedActionIds,
        })
    );
  if (matches.length !== 1) return [];
  const { chain: targetChain, transition } = matches[0];
  const targetSegments = (targetChain.segments ?? []).filter(segment =>
    isNormalAttackWindowTarget(segment, transition.inputWindow)
  );
  if (targetSegments.length !== 1) return [];
  const targetSegment = targetSegments[0];
  const frameRate = Number(transition.inputWindow?.frameRate) || 60;
  const startsAtMs =
    Number(acceptedAction.startMs) +
    frameToMs(transition.inputWindow?.startFrame, frameRate);
  const endsAtMs =
    Number(acceptedAction.startMs) +
    frameToMs(transition.inputWindow?.endFrame, frameRate);
  if (endsAtMs <= startsAtMs || Number(timeMs) >= endsAtMs) return [];
  return [
    {
      actorId,
      sourceKind: 'attack-chain-phase-transition',
      sourceActionId: acceptedAction.id,
      sourceIdentity: transition.sourceIdentity,
      chainIdentity: targetChain.chainIdentity,
      sequenceIndex: Number(targetSegment.sequenceIndex),
      controlSkillId: Number(targetSegment.controlSkillId),
      subSkillIndex: Number(targetSegment.subSkillIndex),
      groupId:
        acceptedSelection?.attackGroupId ??
        acceptedAction.attackGroupId ??
        null,
      startsAtMs,
      endsAtMs,
    },
  ];
}

function isNormalAttackWindowTarget(segment, window) {
  return (
    Number(segment.controlSkillId) === Number(window.targetControlSkillId) &&
    Number(segment.subSkillIndex ?? segment.selectedSubSkillIndex) ===
      Number(window.targetSubSkillIndex) &&
    (window.targetSequenceIndex == null ||
      Number(segment.sequenceIndex) === Number(window.targetSequenceIndex)) &&
    (window.targetChainIdentity == null ||
      String(segment.attackInputChainIdentity ?? '') ===
        String(window.targetChainIdentity))
  );
}
