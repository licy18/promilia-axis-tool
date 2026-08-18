import { ACTION_TYPES } from '../../domain/projectSchema';
import {
  compareActionSourceSequence,
  compareSourceSequencePaths,
  getActionSourceSequencePath,
} from '../../domain/actionSourceSequence';
import {
  getInstalledVerifiedCombatMechanicsPackage,
  getVerifiedCombatActionMapping,
  getVerifiedCombatActionMappingByIdentity,
} from '../../data/verifiedCombatMechanicsPackage';
import { hashCanonicalValue } from '../headless/canonicalSerialization';

export const VERIFIED_SWITCH_EXIT_TAIL_POLICY_CONTRACT =
  'AzPrVerifiedSwitchExitTailPolicy';
export const VERIFIED_RUNTIME_SWITCH_EXIT_TAIL_ASSESSMENT_CONTRACT =
  'AzPrVerifiedRuntimeSwitchExitTailAssessment';
export const KIBO_SWITCH_EXIT_TAIL_UNRESOLVED =
  'kibo-switch-exit-tail-order-unresolved';
export const ACTOR_SWITCH_EXIT_TAIL_UNRESOLVED =
  'actor-switch-exit-tail-order-unresolved';

const SETTLEMENT_ACTION_TYPES = new Set([
  ACTION_TYPES.SKILL,
  ACTION_TYPES.KIBO_EVENT,
]);
const QUEUED_KIBO_FLUENT_ACTION_KINDS = new Set(['signature', 'break']);
const authoritativeSwitchExitTailPolicies = new WeakSet();

/**
 * Compiler-owned projection of the static client switch-exit ruling.
 * Hero switch-exit forces the actor FSM from Skill to Idle; SkillState.OnLeave
 * emits SkillStop and AliveSkillSystem interrupts the current SkillPlayer.
 * Packets already settled/materialized before that boundary survive, while a
 * known future actor-bound packet is cancelled. Kibo signature and joint
 * strike behaviors finish before the queued pet/hero switch-exit behavior, so
 * their known future packets survive. Unknown phase/order remains fail-closed.
 */
export function attachVerifiedSwitchExitTailPolicies({
  actions = [],
  actors = [],
  team = null,
  initialRuntimeState = null,
  time = null,
} = {}) {
  const fps = positiveNumber(time?.fps, 60);
  const timeline = createAcceptedSwitchTimeline({
    actions,
    actors,
    team,
    initialRuntimeState,
    fps,
  });
  const mechanicsPackage = getInstalledVerifiedCombatMechanicsPackage();
  return actions.map(action => {
    if (!SETTLEMENT_ACTION_TYPES.has(action?.type)) return action;
    const transition = timeline.transitions.find(candidate =>
      transitionFollowsAction(candidate, action, fps)
    );
    if (!transition) return action;
    const mapping = getVerifiedCombatActionMapping(action);
    const durationFrames = resolveActionDurationFrames(action, mapping, fps);
    const policy = createVerifiedSwitchExitTailPolicy({
      ownerKind: action.type === ACTION_TYPES.KIBO_EVENT ? 'kibo' : 'actor',
      actionId: action.id,
      ownerActorId: action.actorId,
      actionStartFrame: msToFrame(action.startMs, fps),
      actionDurationFrames: durationFrames,
      actionSourceSequencePath: getActionSourceSequencePath(action),
      mapping,
      mechanicsPackage,
      switchActionId: transition.switchActionId,
      switchBoundaryFrame: transition.frame,
      switchBoundarySourceSequencePath: transition.sourceSequencePath,
      switchToActorId: transition.toActorId,
    });
    authoritativeSwitchExitTailPolicies.add(policy);
    return { ...action, switchExitTailPolicy: policy };
  });
}

export function createVerifiedSwitchExitTailPolicy({
  ownerKind,
  actionId,
  ownerActorId,
  actionStartFrame,
  actionDurationFrames,
  actionSourceSequencePath,
  mapping,
  mechanicsPackage = getInstalledVerifiedCombatMechanicsPackage(),
  switchActionId,
  switchBoundaryFrame,
  switchBoundarySourceSequencePath,
  switchToActorId = null,
}) {
  const projection = createSwitchExitTailProjection({
    ownerKind,
    actionId,
    ownerActorId,
    actionStartFrame,
    actionDurationFrames,
    actionSourceSequencePath,
    mapping,
    mechanicsPackage,
    switchActionId,
    switchBoundaryFrame,
    switchBoundarySourceSequencePath,
    switchToActorId,
  });
  return deepFreeze({
    ...projection,
    policyHash: hashCanonicalValue(projection),
  });
}

/**
 * Refines the compiler-owned boundary with the exact action form selected by
 * the runtime preflight. The client separates ResourceMap (preload/catalog)
 * from SkillPlayerData.skillTrackDatas (execution). A selected resource with
 * no behavior trigger is therefore not a scheduled packet. It remains an
 * action-mechanics coverage gap, but it cannot become an immortal exit tail.
 *
 * The refinement still fails closed for an applied effect without a trigger,
 * for a future owner-bound hit/effect, and while an incomplete action crosses
 * the switch boundary. Already launched projectiles and already injected
 * effects retain the compiler policy's continuation semantics.
 */
export function createVerifiedRuntimeSwitchExitTailAssessment({
  policy,
  resolution,
  mechanicsPackage = getInstalledVerifiedCombatMechanicsPackage(),
} = {}) {
  if (
    !isVerifiedSwitchExitTailPolicy(policy) ||
    !resolution ||
    resolution.ready !== true ||
    resolution.applied !== true ||
    !resolution.actionBinding ||
    !resolution.controlBinding ||
    String(resolution.packageHash ?? '') !==
      String(policy.mechanicsPackageHash ?? '') ||
    String(mechanicsPackage?.packageHash ?? '') !==
      String(policy.mechanicsPackageHash ?? '')
  ) {
    return null;
  }

  const hits = [...(resolution.hits ?? [])];
  const effects = (resolution.effects ?? []).filter(isSettlementEffectPacket);
  const actionBinding = resolution.actionBinding;
  const installedMapping = getVerifiedCombatActionMappingByIdentity(
    policy.mappingIdentity
  );
  const actionDurationFrames = firstNonNegativeInteger([
    actionBinding.actualDurationFrames,
    actionBinding.effectiveOccupancyFrames,
    actionBinding.actionTiming?.occupancy?.durationFrames,
    policy.actionDurationFrames,
  ]);
  if (actionDurationFrames == null) return null;
  const runtimeMapping = {
    identity: actionBinding.identity ?? policy.mappingIdentity,
    controlSkillId: actionBinding.controlSkillId,
    actionKind: installedMapping?.actionKind ?? null,
    // Effect-value coverage and packet-timing coverage are separate. The
    // runtime-selected form supplies the exact duration and concrete packet
    // set; unresolved value semantics do not make the switch order unknown.
    complete: true,
    selectedHitIdentities: hits.map(hit => hit.hitIdentity),
    selectedEffectIdentities: effects.map(effect => effect.effectIdentity),
  };
  const runtimeBinding = {
    ...resolution.controlBinding,
    applied: true,
    hits,
    effects,
  };
  const projection = createSwitchExitTailProjection({
    ownerKind: policy.ownerKind,
    actionId: policy.actionId,
    ownerActorId: policy.ownerActorId,
    actionStartFrame: policy.actionStartFrame,
    actionDurationFrames,
    actionSourceSequencePath: policy.actionSourceSequencePath,
    mapping: runtimeMapping,
    mechanicsPackage,
    binding: runtimeBinding,
    switchActionId: policy.switchActionId,
    switchBoundaryFrame: policy.switchBoundaryFrame,
    switchBoundarySourceSequencePath: policy.switchBoundarySourceSequencePath,
    switchToActorId: policy.switchToActorId,
  });
  const assessmentProjection = {
    ...projection,
    contractName: VERIFIED_RUNTIME_SWITCH_EXIT_TAIL_ASSESSMENT_CONTRACT,
    sourceKind: 'azpr-client-static-switch-exit-tail-runtime-v3',
    compilerPolicyHash: policy.policyHash,
    runtimeResolutionStatus: resolution.status ?? null,
    runtimeActionBindingIdentity: actionBinding.identity ?? null,
    runtimeControlSkillId: integerOrNull(actionBinding.controlSkillId),
    runtimeSelectedHitCount: hits.length,
    runtimeSelectedEffectCount: effects.length,
    sourceEvidence: {
      ...projection.sourceEvidence,
      resourceCatalogExecutionBoundary:
        'dump.cs:SkillControlConfig.skillResourceMaps(ResourceMap preload catalog)|SkillPlayer.Initialize(SkillControlData)|SkillPlayer.Update|SkillBehaviorBase.startFrame/Start/Update',
      inactiveOwnerExecutionBoundary:
        'dump.cs:FluentBehaviorSystem:IInactiveUpdate|AliveSkillSystem:IUpdate(no IInactiveUpdate)',
      kiboQueuedSwitchExitBoundary:
        'GameAssembly.dll:PetFluentBehaviorSystem.OnSwitchExit@0x1813DBA80 -> FluentBehaviorSystem.AddBehavior@0x1813CC500 (no ClearBehaviors/InterruptBehaviors)|HeroFluentBehaviorSystem.OnSwitchExit@0x1813D13A0 -> AddBehavior@0x1813CC500',
      kiboFluentCompletionBoundary:
        'GameAssembly.dll:FluentBehaviorSystem.OnUpdateDeltaTime@0x1813CC900 -> current OnStart/OnUpdate/IsFinished/OnFinish -> Dequeue|CastPetUltimateAction.IsFinished@0x1813C40B0 waits for the pet skill and Interrupt@0x1813C4000 is the unused-on-switch SkillStop(17) path|PetUltimateBehavior.OnFinish@0x1813DF800 -> PetUltimateFinish(122)|JointStrikeSkillCastSkillAction.IsFinished@0x1819B67A0|JointStrikeSkillBehavior.OnFinish@0x1813D6220 -> PetJointStrikeFinish(123)',
      detachedProjectileLifetime:
        'dump.cs:CreateBulletBehavior.Start|BulletEntity|BulletAliveSystem:IUpdate|BulletLogicSystem:IUpdate|BulletMoveSystem:IUpdate',
    },
  };
  return deepFreeze({
    ...assessmentProjection,
    assessmentHash: hashCanonicalValue(assessmentProjection),
  });
}

export function applyVerifiedSwitchExitTailSettlement({
  policy,
  resolution,
  mechanicsPackage = getInstalledVerifiedCombatMechanicsPackage(),
} = {}) {
  const assessment = createVerifiedRuntimeSwitchExitTailAssessment({
    policy,
    resolution,
    mechanicsPackage,
  });
  if (!assessment?.evidenceClosed) return resolution;

  const cancelledPackets = assessment.packetEvidence.filter(
    packet => packet.disposition === 'future-owner-bound-packet-cancelled'
  );
  const cancelledHitIds = new Set(
    cancelledPackets
      .filter(packet => packet.packetKind === 'hit')
      .map(packet => packet.packetIdentity)
  );
  const cancelledEffectIds = new Set(
    cancelledPackets
      .filter(packet => packet.packetKind === 'effect')
      .map(packet => packet.packetIdentity)
  );
  const hits = (resolution.hits ?? []).filter(
    hit => !cancelledHitIds.has(hit.hitIdentity)
  );
  const allHits = (resolution.allHits ?? resolution.hits ?? []).filter(
    hit => !cancelledHitIds.has(hit.hitIdentity)
  );
  const effects = (resolution.effects ?? []).filter(
    effect => !cancelledEffectIds.has(effect.effectIdentity)
  );
  const semanticEffects = (resolution.semanticEffects ?? []).filter(
    effect =>
      !(effect.rawEffectIdentities ?? []).some(identity =>
        cancelledEffectIds.has(identity)
      )
  );
  const settlementProjection = {
    schemaVersion: 1,
    contractName: 'AzPrVerifiedSwitchExitTailSettlement',
    sourceKind: 'azpr-client-static-switch-exit-tail-runtime-v3',
    status:
      cancelledPackets.length > 0
        ? 'owner-bound-tail-cancelled-at-switch-boundary'
        : 'switch-exit-tail-settlement-closed',
    assessmentHash: assessment.assessmentHash,
    compilerPolicyHash: policy.policyHash,
    cancelledPacketCount: cancelledPackets.length,
    cancelledHitIdentities: [...cancelledHitIds].sort((left, right) =>
      String(left).localeCompare(String(right), 'en')
    ),
    cancelledEffectIdentities: [...cancelledEffectIds].sort((left, right) =>
      String(left).localeCompare(String(right), 'en')
    ),
    retainedHitCount: hits.length,
    retainedEffectCount: effects.length,
  };
  return {
    ...resolution,
    hits,
    allHits,
    effects,
    semanticEffects,
    actionBinding: resolution.actionBinding
      ? {
          ...resolution.actionBinding,
          selectedHitIdentities: (
            resolution.actionBinding.selectedHitIdentities ?? []
          ).filter(identity => !cancelledHitIds.has(identity)),
          selectedEffectIdentities: (
            resolution.actionBinding.selectedEffectIdentities ?? []
          ).filter(identity => !cancelledEffectIds.has(identity)),
          runtimeHitCount: hits.length,
          runtimeEffectCount: effects.filter(
            effect => effect.classification === 'applied'
          ).length,
        }
      : resolution.actionBinding,
    switchExitTailSettlement: deepFreeze({
      ...settlementProjection,
      settlementHash: hashCanonicalValue(settlementProjection),
    }),
  };
}

function createSwitchExitTailProjection({
  ownerKind,
  actionId,
  ownerActorId,
  actionStartFrame,
  actionDurationFrames,
  actionSourceSequencePath,
  mapping,
  mechanicsPackage,
  binding: suppliedBinding = null,
  switchActionId,
  switchBoundaryFrame,
  switchBoundarySourceSequencePath,
  switchToActorId = null,
}) {
  const normalizedOwnerKind = ownerKind === 'kibo' ? 'kibo' : 'actor';
  const unresolvedCode =
    normalizedOwnerKind === 'kibo'
      ? KIBO_SWITCH_EXIT_TAIL_UNRESOLVED
      : ACTOR_SWITCH_EXIT_TAIL_UNRESOLVED;
  const startFrame = integerOrNull(actionStartFrame);
  const boundaryFrame = integerOrNull(switchBoundaryFrame);
  const durationFrames = nonNegativeIntegerOrNull(actionDurationFrames);
  const actionPath = normalizePath(actionSourceSequencePath);
  const switchPath = normalizePath(switchBoundarySourceSequencePath);
  const boundaryOffset =
    startFrame == null || boundaryFrame == null
      ? null
      : boundaryFrame - startFrame;
  const binding =
    suppliedBinding ??
    (mechanicsPackage?.controlBindings ?? []).find(
      candidate =>
        Number(candidate.controlSkillId) === Number(mapping?.controlSkillId)
    );
  const packets = createSelectedPacketEvidence({
    ownerKind: normalizedOwnerKind,
    mapping,
    binding,
    actionStartFrame: startFrame,
    actionDurationFrames: durationFrames,
    actionSourceSequencePath: actionPath,
    switchBoundaryFrame: boundaryFrame,
    switchBoundarySourceSequencePath: switchPath,
  });
  const actionCrossesBoundary =
    boundaryOffset != null &&
    durationFrames != null &&
    durationFrames > boundaryOffset;
  const packetEvidenceReady =
    mapping != null &&
    binding != null &&
    mapping.complete === true &&
    binding.applied === true &&
    Array.isArray(mapping.selectedHitIdentities) &&
    Array.isArray(mapping.selectedEffectIdentities);
  const unresolvedPackets = packets.filter(
    packet => packet.disposition === 'future-owner-bound-packet-unresolved'
  );
  const cancelledPackets = packets.filter(
    packet => packet.disposition === 'future-owner-bound-packet-cancelled'
  );
  let status = 'settled-before-switch-boundary';
  if (
    startFrame == null ||
    boundaryFrame == null ||
    actionPath == null ||
    switchPath == null ||
    boundaryOffset < 0
  ) {
    status = unresolvedCode;
  } else if (unresolvedPackets.length > 0) {
    status = unresolvedCode;
  } else if (actionCrossesBoundary && !packetEvidenceReady) {
    status = unresolvedCode;
  } else if (cancelledPackets.length > 0) {
    status = 'owner-bound-tail-cancelled-at-switch-boundary';
  } else if (
    packets.some(
      packet => packet.disposition === 'queued-kibo-fluent-packet-retained'
    )
  ) {
    status = 'queued-kibo-fluent-continuation-closed';
  } else if (
    packets.some(packet => packet.disposition === 'detached-packet-retained')
  ) {
    status = 'detached-packet-continuation-closed';
  } else if (
    packets.some(
      packet => packet.disposition === 'pre-materialized-effect-retained'
    )
  ) {
    status = 'pre-materialized-effect-continuation-closed';
  } else if (actionCrossesBoundary) {
    status = 'accepted-continuation-has-no-post-switch-packet';
  }
  const projection = {
    schemaVersion: 1,
    contractName: VERIFIED_SWITCH_EXIT_TAIL_POLICY_CONTRACT,
    sourceKind: 'azpr-client-static-switch-exit-tail-v2',
    ownerKind: normalizedOwnerKind,
    actionId: actionId == null ? null : String(actionId),
    ownerActorId: ownerActorId == null ? null : String(ownerActorId),
    actionStartFrame: startFrame,
    actionDurationFrames: durationFrames,
    actionSourceSequencePath: actionPath,
    switchActionId: switchActionId == null ? null : String(switchActionId),
    switchBoundaryFrame: boundaryFrame,
    switchBoundarySourceSequencePath: switchPath,
    switchToActorId: switchToActorId == null ? null : String(switchToActorId),
    interval: '[accepted-action,switch-boundary)',
    status,
    evidenceClosed: status !== unresolvedCode,
    rejectionCode: status === unresolvedCode ? unresolvedCode : null,
    mappingIdentity: mapping?.identity ?? null,
    mechanicsPackageId: mechanicsPackage?.packageId ?? null,
    mechanicsPackageHash: mechanicsPackage?.packageHash ?? null,
    packetEvidenceReady,
    packetEvidence: packets,
    sourceEvidence: {
      clientBinarySha256:
        'c60d13795629f0851b1399338f375eb378aef2098515d41841f30ccc3463c22b',
      heroSwitchExit:
        'GameAssembly.dll:SwitchExitBehavior.Initialize@0x1813E4B70 -> Fsm.ChangeState(Idle)@0x1813E4D3B',
      heroSkillStop:
        'GameAssembly.dll:Common.SkillState.Leave@0x181A24990 -> OnLeave@0x181A25260 -> Entity.Transmit(SkillStop=17)@0x181A24C54|AliveSkillSystem.OnTransmit(case 17) -> InterruptSkill@0x1813ECF90',
      kiboSwitchExit:
        'dump.cs:PetSwitchExitBehavior.Initialize@0x13DE530|OnStart@0x13DEF40|OnFinish@0x13DED70',
      kiboQueuedSwitchExit:
        'GameAssembly.dll:PetFluentBehaviorSystem.OnSwitchExit@0x1813DBA80 -> FluentBehaviorSystem.AddBehavior@0x1813CC500 (no ClearBehaviors/InterruptBehaviors)|HeroFluentBehaviorSystem.OnSwitchExit@0x1813D13A0 -> AddBehavior@0x1813CC500',
      kiboFluentCompletion:
        'GameAssembly.dll:FluentBehaviorSystem.OnUpdateDeltaTime@0x1813CC900 -> current OnStart/OnUpdate/IsFinished/OnFinish -> Dequeue|CastPetUltimateAction.IsFinished@0x1813C40B0 waits for the pet skill and Interrupt@0x1813C4000 is the unused-on-switch SkillStop(17) path|PetUltimateBehavior.OnFinish@0x1813DF800 -> PetUltimateFinish(122)|JointStrikeSkillCastSkillAction.IsFinished@0x1819B67A0|JointStrikeSkillBehavior.OnFinish@0x1813D6220 -> PetJointStrikeFinish(123)',
      interruptDispatch:
        'AliveSkillSystem.OnTransmit:InterruptSkill only ForceSkillStart(14)|SkillStop(17)',
    },
  };
  return projection;
}

export function projectVerifiedSwitchExitTailPolicy(value) {
  if (!value || typeof value !== 'object') return null;
  return structuredClone({
    schemaVersion: value.schemaVersion ?? null,
    contractName: value.contractName ?? null,
    sourceKind: value.sourceKind ?? null,
    ownerKind: value.ownerKind ?? null,
    actionId: value.actionId ?? null,
    ownerActorId: value.ownerActorId ?? null,
    actionStartFrame: value.actionStartFrame ?? null,
    actionDurationFrames: value.actionDurationFrames ?? null,
    actionSourceSequencePath: value.actionSourceSequencePath ?? null,
    switchActionId: value.switchActionId ?? null,
    switchBoundaryFrame: value.switchBoundaryFrame ?? null,
    switchBoundarySourceSequencePath:
      value.switchBoundarySourceSequencePath ?? null,
    switchToActorId: value.switchToActorId ?? null,
    interval: value.interval ?? null,
    status: value.status ?? null,
    evidenceClosed: value.evidenceClosed === true,
    rejectionCode: value.rejectionCode ?? null,
    mappingIdentity: value.mappingIdentity ?? null,
    mechanicsPackageId: value.mechanicsPackageId ?? null,
    mechanicsPackageHash: value.mechanicsPackageHash ?? null,
    packetEvidenceReady: value.packetEvidenceReady === true,
    packetEvidence: value.packetEvidence ?? [],
    sourceEvidence: value.sourceEvidence ?? null,
    policyHash: value.policyHash ?? null,
  });
}

export function isVerifiedSwitchExitTailPolicy(value) {
  if (
    !value ||
    !authoritativeSwitchExitTailPolicies.has(value) ||
    value.contractName !== VERIFIED_SWITCH_EXIT_TAIL_POLICY_CONTRACT
  ) {
    return false;
  }
  const projection = projectVerifiedSwitchExitTailPolicy(value);
  delete projection.policyHash;
  return value.policyHash === hashCanonicalValue(projection);
}

function createAcceptedSwitchTimeline({
  actions,
  actors,
  team,
  initialRuntimeState,
  fps,
}) {
  const actorsById = new Map(
    (actors ?? []).map(actor => [String(actor.id ?? ''), actor])
  );
  let controlledActorId = resolveInitialControlledActorId({
    actors,
    actorsById,
    team,
    initialRuntimeState,
  });
  const acceptedSwitchFrames = new Set();
  const transitions = [];
  for (const action of [...(actions ?? [])].sort((left, right) =>
    compareActions(left, right, fps)
  )) {
    if (action.type !== ACTION_TYPES.SWITCH) continue;
    const frame = msToFrame(action.startMs, fps);
    if (acceptedSwitchFrames.has(frame)) continue;
    acceptedSwitchFrames.add(frame);
    if (String(action.actorId ?? '') !== String(controlledActorId ?? '')) {
      continue;
    }
    const targetActorId = String(action.targetActorId ?? '');
    if (!actorsById.has(targetActorId) || targetActorId === controlledActorId) {
      continue;
    }
    transitions.push({
      switchActionId: String(action.id),
      frame,
      sourceSequencePath: getActionSourceSequencePath(action),
      fromActorId: controlledActorId,
      toActorId: targetActorId,
    });
    controlledActorId = targetActorId;
  }
  return { transitions };
}

function transitionFollowsAction(transition, action, fps) {
  if (String(transition.fromActorId) !== String(action.actorId ?? '')) {
    return false;
  }
  const actionFrame = msToFrame(action.startMs, fps);
  if (transition.frame > actionFrame) return true;
  if (transition.frame < actionFrame) return false;
  const actionPath = getActionSourceSequencePath(action);
  return (
    actionPath != null &&
    transition.sourceSequencePath != null &&
    compareSourceSequencePaths(actionPath, transition.sourceSequencePath) < 0
  );
}

function createSelectedPacketEvidence({
  ownerKind,
  mapping,
  binding,
  actionStartFrame,
  actionDurationFrames,
  actionSourceSequencePath,
  switchBoundaryFrame,
  switchBoundarySourceSequencePath,
}) {
  if (!mapping || !binding) return [];
  const selectedHitIds = new Set(mapping.selectedHitIdentities ?? []);
  const selectedEffectIds = new Set(mapping.selectedEffectIdentities ?? []);
  const packets = [
    ...(binding.hits ?? [])
      .filter(hit => selectedHitIds.has(hit.hitIdentity))
      .map(hit => ({
        packetKind: 'hit',
        packetIdentity: hit.hitIdentity,
        trigger: hit.trigger ?? {},
      })),
    ...(binding.effects ?? [])
      .filter(
        effect =>
          selectedEffectIds.has(effect.effectIdentity) &&
          isSettlementEffectPacket(effect)
      )
      .map(effect => ({
        packetKind: 'effect',
        packetIdentity: effect.effectIdentity,
        trigger: effect.trigger ?? {},
      })),
  ];
  return packets
    .map(packet => {
      const trigger = packet.trigger;
      const settlementOffset = finiteNumber(
        trigger.impactFrame ?? trigger.startFrame ?? trigger.frame
      );
      const projectile = String(trigger.kind ?? '').includes('projectile');
      const materializationOffset = finiteNumber(
        projectile
          ? (trigger.launchFrame ?? trigger.startFrame)
          : trigger.startFrame
      );
      const settlementFrame =
        actionStartFrame == null || settlementOffset == null
          ? null
          : actionStartFrame + settlementOffset;
      const materializationFrame =
        actionStartFrame == null || materializationOffset == null
          ? null
          : actionStartFrame + materializationOffset;
      const actionCompletionFrame =
        actionStartFrame == null || actionDurationFrames == null
          ? null
          : actionStartFrame + actionDurationFrames;
      const queuedKiboActivationFrame = projectile
        ? materializationFrame
        : settlementFrame;
      const settledBefore = eventPrecedesSwitch({
        frame: settlementFrame,
        actionStartFrame,
        actionSourceSequencePath,
        switchBoundaryFrame,
        switchBoundarySourceSequencePath,
      });
      const materializedBefore = eventPrecedesSwitch({
        frame: materializationFrame,
        actionStartFrame,
        actionSourceSequencePath,
        switchBoundaryFrame,
        switchBoundarySourceSequencePath,
      });
      let disposition = 'future-owner-bound-packet-unresolved';
      if (packet.packetKind === 'effect' && materializedBefore === true) {
        disposition = 'pre-materialized-effect-retained';
      } else if (settledBefore === true) {
        disposition = 'settled-before-switch';
      } else if (projectile && materializedBefore === true) {
        disposition = 'detached-packet-retained';
      } else if (
        ownerKind === 'kibo' &&
        QUEUED_KIBO_FLUENT_ACTION_KINDS.has(
          String(mapping?.actionKind ?? '')
        ) &&
        queuedKiboActivationFrame != null &&
        actionCompletionFrame != null &&
        queuedKiboActivationFrame < actionCompletionFrame
      ) {
        // Kibo signature and joint-strike behaviors own the current fluent
        // queue entry. Switch-exit is appended behind them and both fluent
        // systems implement IInactiveUpdate, so the current behavior reaches
        // OnFinish before the pet/hero exit behavior can start.
        disposition = 'queued-kibo-fluent-packet-retained';
      } else if (
        ownerKind === 'actor' &&
        settledBefore === false &&
        (!projectile || materializedBefore === false)
      ) {
        // The client advances skill behaviors through AliveSkillSystem, which
        // is not an IInactiveUpdate system. Once the owner switches out, a
        // known future owner-bound behavior never materializes. It is
        // deterministically cancelled, not an unresolved continuation.
        disposition = 'future-owner-bound-packet-cancelled';
      }
      return {
        packetKind: packet.packetKind,
        packetIdentity: packet.packetIdentity,
        triggerKind: trigger.kind ?? 'timeline-direct',
        settlementFrame,
        materializationFrame,
        actionCompletionFrame,
        settlementBoundaryOrder:
          settlementFrame === switchBoundaryFrame
            ? settlementFrame === actionStartFrame
              ? 'action-input-source-order'
              : 'delayed-packet-order-unresolved'
            : 'different-frame',
        materializationBoundaryOrder:
          materializationFrame === switchBoundaryFrame
            ? materializationFrame === actionStartFrame
              ? 'action-input-source-order'
              : 'delayed-packet-order-unresolved'
            : 'different-frame',
        disposition,
        sourceIdentity: trigger.sourceIdentity ?? null,
      };
    })
    .sort(
      (left, right) =>
        nullLast(left.settlementFrame) - nullLast(right.settlementFrame) ||
        String(left.packetIdentity).localeCompare(
          String(right.packetIdentity),
          'en'
        )
    );
}

function isSettlementEffectPacket(effect) {
  if (!effect || typeof effect !== 'object') return false;
  // Client SkillControlConfig.skillResourceMaps is a preload/catalog surface.
  // Execution comes from SkillPlayerData.skillTrackDatas and concrete
  // SkillBehaviorBase instances. A triggerless non-applied catalog node is not
  // a future packet. An applied node without a trigger remains fail-closed.
  return effect.trigger != null || effect.classification === 'applied';
}

function eventPrecedesSwitch({
  frame,
  actionStartFrame,
  actionSourceSequencePath,
  switchBoundaryFrame,
  switchBoundarySourceSequencePath,
}) {
  if (frame == null || switchBoundaryFrame == null) return null;
  if (frame < switchBoundaryFrame) return true;
  if (frame > switchBoundaryFrame) return false;
  // The source path orders an input/materialization that occurs at action
  // start. It does not prove the phase of a delayed owner-bound packet that
  // happens to land on a later switch frame.
  if (frame !== actionStartFrame) return null;
  if (
    actionSourceSequencePath == null ||
    switchBoundarySourceSequencePath == null
  ) {
    return null;
  }
  return (
    compareSourceSequencePaths(
      actionSourceSequencePath,
      switchBoundarySourceSequencePath
    ) < 0
  );
}

function resolveActionDurationFrames(action, mapping, fps) {
  const mappingDuration = Number(
    mapping?.actionTiming?.occupancy?.durationFrames
  );
  if (Number.isInteger(mappingDuration) && mappingDuration >= 0) {
    return mappingDuration;
  }
  const durationMs = Number(action?.durationMs);
  return Number.isFinite(durationMs) && durationMs >= 0
    ? Math.ceil((durationMs * fps) / 1000)
    : null;
}

function resolveInitialControlledActorId({
  actors,
  actorsById,
  team,
  initialRuntimeState,
}) {
  const initial = initialRuntimeState?.controlledActor;
  if (initial?.actorId && actorsById.has(String(initial.actorId))) {
    return String(initial.actorId);
  }
  const byCharacter = (actors ?? []).find(
    actor => Number(actor.characterId) === Number(initial?.characterId)
  );
  if (byCharacter) return String(byCharacter.id);
  const firstTeamActorId = team?.slots?.[0]?.actorId;
  if (firstTeamActorId != null && actorsById.has(String(firstTeamActorId))) {
    return String(firstTeamActorId);
  }
  return actors?.[0]?.id == null ? null : String(actors[0].id);
}

function compareActions(left, right, fps = 60) {
  return (
    msToFrame(left?.startMs, fps) - msToFrame(right?.startMs, fps) ||
    compareActionSourceSequence(left, right)
  );
}

function normalizePath(value) {
  if (!Array.isArray(value) || value.length === 0) return null;
  const normalized = value.map(Number);
  return normalized.every(Number.isSafeInteger) ? normalized : null;
}

function msToFrame(value, fps) {
  return Math.round(((Number(value) || 0) * fps) / 1000);
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function integerOrNull(value) {
  if (value == null) return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function nonNegativeIntegerOrNull(value) {
  const number = integerOrNull(value);
  return number != null && number >= 0 ? number : null;
}

function firstNonNegativeInteger(values) {
  for (const value of values ?? []) {
    const normalized = nonNegativeIntegerOrNull(value);
    if (normalized != null) return normalized;
  }
  return null;
}

function finiteNumber(value) {
  if (value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nullLast(value) {
  return value == null ? Number.MAX_SAFE_INTEGER : Number(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
