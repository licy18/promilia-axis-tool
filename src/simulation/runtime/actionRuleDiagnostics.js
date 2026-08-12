import { ACTION_TYPES } from '../../domain/projectSchema';
import { isFrameWithinVerifiedInputWindow } from '../../domain/verifiedActionContextScheduling';
import {
  compareActionSourceSequence,
  compareSourceSequencePaths,
  getActionSourceSequencePath,
} from '../../domain/actionSourceSequence';
import { createVerifiedEffectSourceSequencePath } from '../../domain/verifiedEffectSourceSequence';
import {
  matchVerifiedNormalAttackInput,
  resolveVerifiedNormalAttackInputPhase,
} from '../../domain/verifiedNormalAttackInputAuthority';
import { VERIFIED_WORKBENCH_MECHANICS_PROFILE_ID } from '../../domain/workbenchMechanicsProfileSelection';
import {
  getInstalledVerifiedCombatMechanicsPackage,
  getVerifiedCombatActionMapping,
  resolveVerifiedCombatActionMechanics,
} from '../../data/verifiedCombatMechanicsPackage';
import { createActionCooldownEvaluation } from './actionCooldownEvaluation';
import {
  isVerifiedSwitchTriggeredDerivedAction,
  validateSwitchTriggeredDerivedAction,
} from '../generation/switchTriggeredActionGeneration';
import { createVerifiedKiboCooldownModifierSession } from '../mechanics/verifiedKiboCooldownModifierSession';
import {
  isAuthoritativeKiboAutoCastDerivationRegistry,
  validateVerifiedKiboAutoCastDerivation,
} from '../../domain/verifiedBackgroundActionDerivation';
import {
  getKiboAxisActionScopePolicy,
  isKiboAutonomousActionKindDeferred,
} from '../../domain/kiboAxisActionScopePolicy';
import {
  JOINT_ATTACK_TRIGGER_UNRESOLVED_CODE,
  createJointAttackTriggerUnresolvedEvidence,
  resolveVerifiedKiboJointAttackBinding,
} from '../../domain/verifiedJointAttackContract';
import {
  VERIFIED_JOINT_ATTACK_PAIR_SOURCE_ORDER_INVALID,
  createVerifiedJointAttackRuntimeEvidence,
  createVerifiedJointAttackRuntimePair,
} from '../../domain/verifiedJointAttackRuntimePair';
import {
  VERIFIED_JOINT_ATTACK_RUNTIME_CONTRACT_REQUIRED_CODE,
  VERIFIED_JOINT_ATTACK_RUNTIME_READY_CODE,
} from '../../domain/verifiedJointAttackRuntimeContract';
import {
  ACTOR_SWITCH_EXIT_TAIL_UNRESOLVED,
  KIBO_SWITCH_EXIT_TAIL_UNRESOLVED,
  isVerifiedSwitchExitTailPolicy,
} from '../generation/verifiedSwitchExitTailPolicy';

export const ACTION_RULE_DIAGNOSTICS_CONTRACT_NAME =
  'AzPrActionRuleDiagnostics';
export const ACTION_READINESS_TIMELINE_CONTRACT_NAME =
  'AzPrActionReadinessTimeline';
const ACTION_BOUNDARY_EPSILON_MS = 0.001;

export const ACTION_RULE_CODES = Object.freeze({
  LANE_OVERLAP: 'action-lane-overlap',
  SWITCH_OCCUPANCY_UNRESOLVED: 'switch-action-cancel-window-unresolved',
  SWITCH_FRAME_CONFLICT: 'switch-frame-conflict',
  CONTROLLED_ACTOR_UNAVAILABLE: 'controlled-actor-action-unavailable',
  CONTROLLED_ACTOR_SOURCE_ORDER_UNRESOLVED:
    'controlled-actor-source-order-unresolved',
  CONTROLLED_ACTOR_FRAME_INPUT_CONFLICT:
    'controlled-actor-frame-input-conflict',
  BACKGROUND_DERIVATION_INVALID: 'background-action-derivation-invalid',
  KIBO_AUTO_CAST_TRIGGER_UNRESOLVED: 'kibo-auto-cast-trigger-unresolved',
  KIBO_AUTO_CAST_SCHEDULE_UNRESOLVED: 'kibo-auto-cast-schedule-unresolved',
  ACTOR_SWITCH_EXIT_TAIL_UNRESOLVED,
  KIBO_SWITCH_EXIT_TAIL_UNRESOLVED,
  SWITCH_EXIT_TAIL_POLICY_INVALID: 'switch-exit-tail-policy-invalid',
  SKILL_COOLDOWN_ACTIVE: 'skill-cooldown-active',
  SKILL_SP_PRECONDITION_UNRESOLVED: 'skill-sp-precondition-unresolved',
  ATTACK_INPUT_CHAIN_INCOMPLETE: 'attack-input-chain-incomplete',
  ATTACK_INPUT_CHAIN_ORDER_INVALID: 'attack-input-chain-order-invalid',
  ATTACK_INPUT_LINK_TIMING_UNRESOLVED: 'attack-input-link-timing-unresolved',
  ATTACK_INPUT_LINK_TOO_EARLY: 'attack-input-link-too-early',
  ATTACK_INPUT_LINK_TOO_LATE: 'attack-input-link-too-late',
  ATTACK_INPUT_LEGACY_UNRESOLVED: 'attack-input-legacy-unresolved',
  ATTACK_INPUT_CONTEXT_CONFLICT: 'attack-input-context-conflict',
  JOINT_ATTACK_KIBO_REQUIRED: 'joint-attack-kibo-required',
  JOINT_ATTACK_PAIR_MISSING: 'joint-attack-pair-missing',
  JOINT_ATTACK_FRAME_MISMATCH: 'joint-attack-frame-mismatch',
  JOINT_ATTACK_TARGET_MISMATCH: 'joint-attack-target-mismatch',
  JOINT_ATTACK_DUPLICATE_SIDE: 'joint-attack-duplicate-side',
  JOINT_ATTACK_COUNTERPART_BLOCKED: 'joint-attack-counterpart-blocked',
  JOINT_ATTACK_TRIGGER_UNRESOLVED: JOINT_ATTACK_TRIGGER_UNRESOLVED_CODE,
  JOINT_ATTACK_RUNTIME_READY: VERIFIED_JOINT_ATTACK_RUNTIME_READY_CODE,
  JOINT_ATTACK_RUNTIME_CONTRACT_REQUIRED:
    VERIFIED_JOINT_ATTACK_RUNTIME_CONTRACT_REQUIRED_CODE,
  JOINT_ATTACK_PAIR_SOURCE_ORDER_INVALID:
    VERIFIED_JOINT_ATTACK_PAIR_SOURCE_ORDER_INVALID,
  STAR_CARRY_SWITCH_TRIGGER_REQUIRED: 'star-carry-switch-trigger-required',
  KIBO_PASSIVE_SKILL_TAG_UNRESOLVED:
    'kibo-passive-cooldown-skill-tag-unresolved',
});

export const ACTION_RULE_STATUSES = Object.freeze({
  VIOLATED: 'violated',
  UNRESOLVED: 'unresolved',
  VERIFIED: 'verified',
});

export function createActionRuleDiagnostics({
  scenario = {},
  cooldownEvaluationAdapter = null,
  externallyBlockedActionIds = [],
  actionResolutionById = null,
} = {}) {
  const actions = [...(scenario.actions ?? [])].sort(compareActions);
  const baseNonCooldownDiagnostics = [
    ...createLaneOverlapDiagnostics(actions),
    ...createSwitchOccupancyDiagnostics(
      actions,
      scenario.time?.fps,
      isFormalActionLegalityScenario(scenario)
    ),
    ...createSwitchFrameConflictDiagnostics(actions, scenario.time?.fps),
    ...createSwitchExitTailDiagnostics(actions, scenario),
    ...createKiboAutoCastTriggerDiagnostics(scenario),
    ...createKiboAutoCastScheduleDiagnostics(scenario),
    ...createBackgroundActionDerivationDiagnostics(actions, scenario),
    ...createStandaloneStarCarryDiagnostics(actions, scenario),
    ...createSkillSpPreconditionDiagnostics(
      actions,
      scenario.actors ?? [],
      scenario
    ),
    ...createAttackInputChainDiagnostics(
      actions,
      scenario.time?.fps,
      isFormalActionLegalityScenario(scenario)
    ),
    ...createNormalAttackInputPhaseDiagnostics(
      actions,
      scenario.time?.fps,
      isFormalActionLegalityScenario(scenario)
    ),
    ...createJointAttackDiagnostics(
      actions,
      scenario.actors ?? [],
      scenario.time?.fps,
      scenario
    ),
  ];
  const controlledActorDiagnostics = createControlledActorActionDiagnostics({
    actions,
    actors: scenario.actors ?? [],
    scenario,
    blockingDiagnostics: baseNonCooldownDiagnostics,
    externallyBlockedActionIds,
  });
  const blockedDerivedActionDiagnostics = createBlockedDerivedActionDiagnostics(
    {
      actions,
      scenario,
      blockingDiagnostics: [
        ...baseNonCooldownDiagnostics,
        ...controlledActorDiagnostics,
      ],
      externallyBlockedActionIds,
    }
  );
  const nonCooldownDiagnostics = [
    ...baseNonCooldownDiagnostics,
    ...controlledActorDiagnostics,
    ...blockedDerivedActionDiagnostics,
  ];
  const preblockedActionIds = new Set([
    ...externallyBlockedActionIds.map(String),
    ...nonCooldownDiagnostics
      .filter(item => item.status === ACTION_RULE_STATUSES.VIOLATED)
      .map(item => String(item.actionId)),
  ]);
  let cooldownEvaluation = createSkillCooldownEvaluation(actions, {
    scenario,
    cooldownEvaluationAdapter,
    preblockedActionIds,
    actionResolutionById,
  });
  let preliminaryDiagnostics = [
    ...nonCooldownDiagnostics,
    ...cooldownEvaluation.diagnostics,
    ...createKiboCooldownSessionDiagnostics(
      cooldownEvaluation.cooldownModifierSession
    ),
  ];
  const blockedJointCounterparts = createBlockedJointCounterpartDiagnostics({
    jointDiagnostics: nonCooldownDiagnostics,
    blockingDiagnostics: preliminaryDiagnostics,
    externallyBlockedActionIds,
  });
  if (blockedJointCounterparts.length > 0) {
    for (const diagnostic of blockedJointCounterparts) {
      preblockedActionIds.add(String(diagnostic.actionId));
    }
    cooldownEvaluation = createSkillCooldownEvaluation(actions, {
      scenario,
      cooldownEvaluationAdapter,
      preblockedActionIds,
    });
    preliminaryDiagnostics = [
      ...nonCooldownDiagnostics,
      ...blockedJointCounterparts,
      ...cooldownEvaluation.diagnostics,
      ...createKiboCooldownSessionDiagnostics(
        cooldownEvaluation.cooldownModifierSession
      ),
    ];
  }
  const diagnostics = [
    ...preliminaryDiagnostics,
    ...createBlockedAttackInputPredecessorDiagnostics(
      actions,
      preliminaryDiagnostics
    ),
  ].sort(compareDiagnostics);
  const violationCount = diagnostics.filter(
    item => item.status === ACTION_RULE_STATUSES.VIOLATED
  ).length;
  const unresolvedCount = diagnostics.filter(
    item => item.status === ACTION_RULE_STATUSES.UNRESOLVED
  ).length;
  const affectedActionIds = uniqueValues(
    diagnostics.flatMap(item => item.actionIds)
  );
  const readinessTimeline = createActionReadinessTimeline({
    actions,
    diagnostics,
    cooldownEvaluation,
    fps: scenario.time?.fps,
  });

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-scenario-action-rule-diagnostics',
    contractName: ACTION_RULE_DIAGNOSTICS_CONTRACT_NAME,
    status:
      violationCount > 0
        ? 'action-rules-violated'
        : unresolvedCount > 0
          ? 'action-rules-ready-with-unresolved-conditions'
          : 'action-rules-ready',
    executable: violationCount === 0,
    diagnostics,
    readinessTimeline,
    summary: {
      actionCount: actions.length,
      ruleCount: Object.keys(ACTION_RULE_CODES).length,
      diagnosticCount: diagnostics.length,
      violationCount,
      unresolvedCount,
      errorCount: diagnostics.filter(item => item.severity === 'error').length,
      warningCount: diagnostics.filter(item => item.severity === 'warning')
        .length,
      affectedActionCount: affectedActionIds.length,
      affectedActionIds,
      externallyBlockedActionCount: externallyBlockedActionIds.length,
      laneOverlapCount: diagnostics.filter(
        item => item.code === ACTION_RULE_CODES.LANE_OVERLAP
      ).length,
      switchOccupancyDiagnosticCount: diagnostics.filter(
        item => item.code === ACTION_RULE_CODES.SWITCH_OCCUPANCY_UNRESOLVED
      ).length,
      switchFrameConflictCount: diagnostics.filter(
        item => item.code === ACTION_RULE_CODES.SWITCH_FRAME_CONFLICT
      ).length,
      controlledActorViolationCount: diagnostics.filter(item =>
        [
          ACTION_RULE_CODES.CONTROLLED_ACTOR_UNAVAILABLE,
          ACTION_RULE_CODES.CONTROLLED_ACTOR_SOURCE_ORDER_UNRESOLVED,
        ].includes(item.code)
      ).length,
      backgroundDerivationDiagnosticCount: diagnostics.filter(
        item => item.code === ACTION_RULE_CODES.BACKGROUND_DERIVATION_INVALID
      ).length,
      kiboAutoCastScheduleUnresolvedCount: diagnostics.filter(
        item =>
          item.code === ACTION_RULE_CODES.KIBO_AUTO_CAST_SCHEDULE_UNRESOLVED
      ).length,
      cooldownViolationCount: diagnostics.filter(
        item => item.code === ACTION_RULE_CODES.SKILL_COOLDOWN_ACTIVE
      ).length,
      unresolvedSpPreconditionCount: diagnostics.filter(
        item => item.code === ACTION_RULE_CODES.SKILL_SP_PRECONDITION_UNRESOLVED
      ).length,
      attackInputChainDiagnosticCount: diagnostics.filter(item =>
        [
          ACTION_RULE_CODES.ATTACK_INPUT_CHAIN_INCOMPLETE,
          ACTION_RULE_CODES.ATTACK_INPUT_CHAIN_ORDER_INVALID,
          ACTION_RULE_CODES.ATTACK_INPUT_LINK_TIMING_UNRESOLVED,
          ACTION_RULE_CODES.ATTACK_INPUT_LINK_TOO_EARLY,
          ACTION_RULE_CODES.ATTACK_INPUT_LINK_TOO_LATE,
          ACTION_RULE_CODES.ATTACK_INPUT_LEGACY_UNRESOLVED,
          ACTION_RULE_CODES.ATTACK_INPUT_CONTEXT_CONFLICT,
        ].includes(item.code)
      ).length,
      jointAttackViolationCount: diagnostics.filter(item =>
        [
          ACTION_RULE_CODES.JOINT_ATTACK_KIBO_REQUIRED,
          ACTION_RULE_CODES.JOINT_ATTACK_PAIR_MISSING,
          ACTION_RULE_CODES.JOINT_ATTACK_FRAME_MISMATCH,
          ACTION_RULE_CODES.JOINT_ATTACK_TARGET_MISMATCH,
          ACTION_RULE_CODES.JOINT_ATTACK_DUPLICATE_SIDE,
          ACTION_RULE_CODES.JOINT_ATTACK_COUNTERPART_BLOCKED,
          ACTION_RULE_CODES.JOINT_ATTACK_RUNTIME_CONTRACT_REQUIRED,
          ACTION_RULE_CODES.JOINT_ATTACK_PAIR_SOURCE_ORDER_INVALID,
        ].includes(item.code)
      ).length,
      jointAttackTriggerUnresolvedCount: diagnostics.filter(
        item => item.code === ACTION_RULE_CODES.JOINT_ATTACK_TRIGGER_UNRESOLVED
      ).length,
      jointAttackRuntimeReadyCount: diagnostics.filter(
        item => item.code === ACTION_RULE_CODES.JOINT_ATTACK_RUNTIME_READY
      ).length,
      standaloneStarCarryViolationCount: diagnostics.filter(
        item =>
          item.code === ACTION_RULE_CODES.STAR_CARRY_SWITCH_TRIGGER_REQUIRED
      ).length,
      readinessStatus: readinessTimeline.status,
      readinessActionCount: readinessTimeline.summary.actionCount,
      cooldownWindowCount: readinessTimeline.summary.cooldownWindowCount,
      cooldownModifiedWindowCount:
        readinessTimeline.summary.cooldownModifiedWindowCount,
      cooldownReductionTransactionCount:
        readinessTimeline.summary.cooldownReductionTransactionCount,
      appliedCooldownReductionTransactionCount:
        readinessTimeline.summary.appliedCooldownReductionTransactionCount,
      appliedToSimulationResults: false,
    },
    acceptedSkillStartTransitions:
      cooldownEvaluation.acceptedSkillStartTransitions,
    cooldownReductionTransactions:
      cooldownEvaluation.cooldownReductionTransactions,
    cooldownState: cooldownEvaluation.cooldownState,
    cooldownModifierSession: cooldownEvaluation.cooldownModifierSession,
    appliedToSimulationResults: false,
  };
}

function createControlledActorActionDiagnostics({
  actions,
  actors,
  scenario,
  blockingDiagnostics = [],
  externallyBlockedActionIds = [],
}) {
  const actorsById = new Map(
    (actors ?? []).map(actor => [
      String(actor.id ?? actor.actorId ?? ''),
      actor,
    ])
  );
  let controlledActorId = resolveInitialControlledActorId({
    actors,
    actorsById,
    scenario,
  });
  const sourceOrderDiagnostics = createControlledActorSourceOrderDiagnostics(
    actions,
    scenario
  );
  const blockedActionIds = new Set([
    ...(externallyBlockedActionIds ?? []).map(String),
    ...(blockingDiagnostics ?? [])
      .filter(diagnostic => diagnostic.status === ACTION_RULE_STATUSES.VIOLATED)
      .map(diagnostic => String(diagnostic.actionId)),
    ...sourceOrderDiagnostics.flatMap(diagnostic =>
      (diagnostic.actionIds ?? []).map(String)
    ),
  ]);
  const diagnostics = [...sourceOrderDiagnostics];
  for (const action of actions ?? []) {
    const actionId = String(action.id ?? '');
    const isBlocked = blockedActionIds.has(actionId);
    const actorId = String(action.actorId ?? '');
    if (action.type === ACTION_TYPES.SWITCH) {
      if (
        !isBlocked &&
        controlledActorId != null &&
        actorId &&
        actorId !== controlledActorId
      ) {
        diagnostics.push(
          createControlledActorUnavailableDiagnostic({
            action,
            controlledActorId,
            reason: 'switch-source-is-not-current-controlled-actor',
          })
        );
        blockedActionIds.add(actionId);
        continue;
      }
      const targetActorId = String(action.targetActorId ?? '');
      if (!isBlocked && targetActorId && actorsById.has(targetActorId)) {
        controlledActorId = targetActorId;
      }
      continue;
    }
    if (!isControlledInputAction(action, scenario) || isBlocked) continue;
    if (controlledActorId != null && actorId && actorId !== controlledActorId) {
      diagnostics.push(
        createControlledActorUnavailableDiagnostic({
          action,
          controlledActorId,
          reason: 'action-owner-is-not-current-controlled-actor',
        })
      );
      blockedActionIds.add(actionId);
    }
  }
  return diagnostics;
}

function createControlledActorSourceOrderDiagnostics(actions, scenario) {
  const fps = Number(scenario?.time?.fps) || 60;
  const diagnostics = [];
  const switches = (actions ?? []).filter(
    action => action.type === ACTION_TYPES.SWITCH
  );
  const inputs = (actions ?? []).filter(action =>
    isControlledInputAction(action, scenario)
  );
  diagnostics.push(...createControlledActorFrameInputConflicts(inputs, fps));
  for (const switchAction of switches) {
    for (const inputAction of inputs) {
      if (
        msToFrame(switchAction.startMs, fps) !==
        msToFrame(inputAction.startMs, fps)
      ) {
        continue;
      }
      const switchPath = getActionSourceSequencePath(switchAction);
      const inputPath = getActionSourceSequencePath(inputAction);
      const ordered =
        switchPath != null &&
        inputPath != null &&
        compareSourceSequencePaths(switchPath, inputPath) !== 0;
      if (ordered) continue;
      const actionIds = [switchAction.id, inputAction.id].map(String).sort();
      for (const action of [switchAction, inputAction]) {
        diagnostics.push({
          schemaVersion: 1,
          id: createDiagnosticId(
            ACTION_RULE_CODES.CONTROLLED_ACTOR_SOURCE_ORDER_UNRESOLVED,
            ...actionIds,
            action.id
          ),
          code: ACTION_RULE_CODES.CONTROLLED_ACTOR_SOURCE_ORDER_UNRESOLVED,
          ruleKey: 'current-controlled-actor-source-order',
          status: ACTION_RULE_STATUSES.VIOLATED,
          severity: 'error',
          actionId: action.id,
          actionIds,
          actorId: action.actorId ?? null,
          timeMs: Number(action.startMs) || 0,
          reason: 'same-frame-switch-input-source-order-unresolved',
          sourceSequencePath: action.sourceSequencePath ?? null,
          message: `同帧 switch/input 缺少可验证的 sourceSequencePath 顺序，${action.id} 不执行`,
          source: {
            sourceKind: 'azpr-controlled-actor-runtime-timeline',
            sourceStatus: 'same-frame-switch-input-order-fail-closed',
            fieldPaths: [
              'action.sourceSequencePath',
              'action.sourceSequenceSource',
            ],
          },
          appliedToSimulationResults: true,
        });
      }
    }
  }
  return diagnostics;
}

function createControlledActorFrameInputConflicts(inputs, fps) {
  const diagnostics = [];
  const byFrame = groupByKey(inputs, action =>
    String(msToFrame(action.startMs, fps))
  );
  for (const [frameKey, frameInputs] of byFrame) {
    const actorIds = uniqueValues(
      frameInputs.map(action => String(action.actorId ?? '')).filter(Boolean)
    );
    if (actorIds.length < 2) continue;
    const actionIds = frameInputs.map(action => String(action.id)).sort();
    for (const action of frameInputs) {
      diagnostics.push({
        schemaVersion: 1,
        id: createDiagnosticId(
          ACTION_RULE_CODES.CONTROLLED_ACTOR_FRAME_INPUT_CONFLICT,
          ...actionIds,
          action.id
        ),
        code: ACTION_RULE_CODES.CONTROLLED_ACTOR_FRAME_INPUT_CONFLICT,
        ruleKey: 'single-controlled-actor-input-per-frame',
        status: ACTION_RULE_STATUSES.VIOLATED,
        severity: 'error',
        actionId: action.id,
        actionIds,
        actorId: action.actorId ?? null,
        actorIds,
        frameIndex: Number(frameKey),
        timeMs: Number(action.startMs) || 0,
        reason: 'multiple-actors-declared-player-input-in-one-frame',
        sourceSequencePath: action.sourceSequencePath ?? null,
        message: `同一帧只能由一个当前主控角色响应玩家输入，${action.id} 不执行`,
        source: {
          sourceKind: 'azpr-controlled-actor-runtime-timeline',
          sourceStatus: 'same-frame-cross-actor-input-conflict-applied',
          fieldPaths: [
            'action.actorId',
            'action.startMs',
            'scenario.initialRuntimeState.controlledActor',
          ],
        },
        appliedToSimulationResults: true,
      });
    }
  }
  return diagnostics;
}

function resolveInitialControlledActorId({ actors, actorsById, scenario }) {
  const initial = scenario?.initialRuntimeState?.controlledActor;
  if (initial?.actorId != null && actorsById.has(String(initial.actorId))) {
    return String(initial.actorId);
  }
  if (initial?.characterId != null) {
    const actor = (actors ?? []).find(
      candidate => Number(candidate.characterId) === Number(initial.characterId)
    );
    if (actor) return String(actor.id ?? actor.actorId);
  }
  const teamActorId = scenario?.team?.slots?.[0]?.actorId;
  if (teamActorId != null && actorsById.has(String(teamActorId))) {
    return String(teamActorId);
  }
  const first = (actors ?? [])[0];
  return first == null ? null : String(first.id ?? first.actorId ?? '');
}

function isControlledInputAction(action, scenario) {
  const kiboDerivation = validateVerifiedKiboAutoCastDerivation(
    action,
    scenario
  );
  if (
    isVerifiedSwitchTriggeredDerivedAction(action, scenario) ||
    (kiboDerivation.valid === true &&
      kiboDerivation.evidenceClosed === true &&
      kiboDerivation.authoritativeRegistryMatch === true)
  ) {
    return false;
  }
  return [ACTION_TYPES.SKILL, ACTION_TYPES.KIBO_EVENT].includes(action?.type);
}

function createControlledActorUnavailableDiagnostic({
  action,
  controlledActorId,
  reason,
}) {
  return {
    schemaVersion: 1,
    id: createDiagnosticId(
      ACTION_RULE_CODES.CONTROLLED_ACTOR_UNAVAILABLE,
      action.id,
      controlledActorId
    ),
    code: ACTION_RULE_CODES.CONTROLLED_ACTOR_UNAVAILABLE,
    ruleKey: 'current-controlled-actor-action-readiness',
    status: ACTION_RULE_STATUSES.VIOLATED,
    severity: 'error',
    actionId: action.id,
    actionIds: [action.id],
    actionName: action.name ?? action.id,
    actorId: action.actorId ?? null,
    controlledActorId,
    timeMs: Number(action.startMs) || 0,
    reason,
    message: `${action.name ?? action.id} 的 owner 不是该时刻当前主控角色，动作不执行`,
    source: {
      sourceKind: 'azpr-controlled-actor-runtime-timeline',
      sourceStatus: 'controlled-actor-input-readiness-applied',
      fieldPaths: [
        'scenario.initialRuntimeState.controlledActor',
        'action.actorId',
        'action.sourceSequencePath',
      ],
    },
    appliedToSimulationResults: true,
  };
}

function createBlockedJointCounterpartDiagnostics({
  jointDiagnostics,
  blockingDiagnostics,
  externallyBlockedActionIds = [],
}) {
  const blockedActionIds = new Set([
    ...(externallyBlockedActionIds ?? []).map(String),
    ...(blockingDiagnostics ?? [])
      .filter(diagnostic => diagnostic.status === ACTION_RULE_STATUSES.VIOLATED)
      .map(diagnostic => String(diagnostic.actionId)),
  ]);
  const diagnostics = [];
  for (const pair of (jointDiagnostics ?? []).filter(
    diagnostic =>
      [
        ACTION_RULE_CODES.JOINT_ATTACK_TRIGGER_UNRESOLVED,
        ACTION_RULE_CODES.JOINT_ATTACK_RUNTIME_READY,
        ACTION_RULE_CODES.JOINT_ATTACK_RUNTIME_CONTRACT_REQUIRED,
        ACTION_RULE_CODES.JOINT_ATTACK_PAIR_SOURCE_ORDER_INVALID,
      ].includes(diagnostic.code) && (diagnostic.actionIds ?? []).length === 2
  )) {
    const pairIds = uniqueValues(pair.actionIds.map(String));
    const blockingActionId = pairIds.find(actionId =>
      blockedActionIds.has(actionId)
    );
    if (!blockingActionId) continue;
    for (const actionId of pairIds) {
      if (blockedActionIds.has(actionId)) continue;
      diagnostics.push({
        schemaVersion: 1,
        id: createDiagnosticId(
          ACTION_RULE_CODES.JOINT_ATTACK_COUNTERPART_BLOCKED,
          actionId,
          blockingActionId
        ),
        code: ACTION_RULE_CODES.JOINT_ATTACK_COUNTERPART_BLOCKED,
        ruleKey: 'joint-attack-atomic-pair',
        status: ACTION_RULE_STATUSES.VIOLATED,
        severity: 'error',
        actionId,
        actionIds: pairIds,
        blockingActionId,
        timeMs: Number(pair.timeMs) || 0,
        message: `合击配对的 ${blockingActionId} 未被接受，${actionId} 同步回滚`,
        source: {
          sourceKind: 'azpr-joint-attack-input-contract',
          sourceStatus: 'joint-attack-atomic-pair-rollback-applied',
          fieldPaths: ['action.id', 'action.sourceSequencePath'],
        },
        appliedToSimulationResults: true,
      });
      blockedActionIds.add(actionId);
    }
  }
  return diagnostics;
}

function createBackgroundActionDerivationDiagnostics(actions, scenario) {
  return (actions ?? []).flatMap(action => {
    const switchDerivation = validateSwitchTriggeredDerivedAction(
      action,
      scenario
    );
    const kiboDerivation = validateVerifiedKiboAutoCastDerivation(
      action,
      scenario
    );
    const originConflict =
      switchDerivation.declared === true && kiboDerivation.declared === true;
    const deferredAutonomousKiboAction =
      action.type === ACTION_TYPES.KIBO_EVENT &&
      isKiboAutonomousActionKindDeferred(action.eventType ?? action.actionKind);
    const declared =
      switchDerivation.declared ||
      kiboDerivation.declared ||
      deferredAutonomousKiboAction;
    const valid =
      !originConflict &&
      !deferredAutonomousKiboAction &&
      ((switchDerivation.declared && switchDerivation.valid) ||
        (kiboDerivation.declared && kiboDerivation.valid));
    if (!declared || valid) return [];
    const reasons = uniqueValues([
      ...(originConflict ? ['derived-action-origin-conflict'] : []),
      ...(deferredAutonomousKiboAction
        ? ['autonomous-kibo-action-product-deferred']
        : []),
      ...(switchDerivation.reasons ?? []),
      ...(kiboDerivation.reasons ?? []),
    ]).sort((left, right) => left.localeCompare(right, 'en'));
    const evidenceOnlyOpen =
      kiboDerivation.structurallyValid === true &&
      kiboDerivation.evidenceClosed === false &&
      (switchDerivation.declared !== true || switchDerivation.valid === true);
    const status =
      evidenceOnlyOpen && !isFormalActionLegalityScenario(scenario)
        ? ACTION_RULE_STATUSES.UNRESOLVED
        : ACTION_RULE_STATUSES.VIOLATED;
    return [
      {
        schemaVersion: 1,
        id: createDiagnosticId(
          ACTION_RULE_CODES.BACKGROUND_DERIVATION_INVALID,
          action.id
        ),
        code: ACTION_RULE_CODES.BACKGROUND_DERIVATION_INVALID,
        ruleKey: 'verified-source-derived-action-only',
        status,
        severity:
          status === ACTION_RULE_STATUSES.VIOLATED ? 'error' : 'warning',
        actionId: action.id,
        actionIds: [action.id],
        actorId: action.actorId ?? null,
        timeMs: Number(action.startMs) || 0,
        reason: reasons.join('|') || 'derivation-declaration-invalid',
        sourceIdentity: deferredAutonomousKiboAction
          ? getKiboAxisActionScopePolicy().policyHash
          : (switchDerivation.bindingId ??
            kiboDerivation.sourceIdentity ??
            null),
        sourceSequencePath: action.sourceSequencePath ?? null,
        message: deferredAutonomousKiboAction
          ? `${action.name ?? action.id} 属于当前产品延后的奇波自主动作，不进入排轴、优化或伤害结算`
          : `${action.name ?? action.id} 声明为后台派生动作，但其触发、owner 或来源顺序合同无效`,
        source: {
          sourceKind: deferredAutonomousKiboAction
            ? 'azpr-kibo-axis-action-scope-policy'
            : 'azpr-verified-background-action-derivation',
          sourceStatus: deferredAutonomousKiboAction
            ? 'product-deferred-autonomous-action'
            : 'background-action-derivation-fail-closed',
          fieldPaths: [
            'action.derivedAction',
            'action.switchTriggerBinding',
            'action.autoCastRule',
            'action.sourceSequencePath',
          ],
        },
        appliedToSimulationResults: status === ACTION_RULE_STATUSES.VIOLATED,
      },
    ];
  });
}

function createBlockedDerivedActionDiagnostics({
  actions,
  scenario,
  blockingDiagnostics = [],
  externallyBlockedActionIds = [],
}) {
  const blockingByActionId = new Map();
  for (const actionId of externallyBlockedActionIds ?? []) {
    blockingByActionId.set(String(actionId), {
      code: 'externally-blocked-action',
      actionId: String(actionId),
    });
  }
  for (const diagnostic of blockingDiagnostics ?? []) {
    if (
      diagnostic.status !== ACTION_RULE_STATUSES.VIOLATED ||
      diagnostic.actionId == null
    ) {
      continue;
    }
    const key = String(diagnostic.actionId);
    if (!blockingByActionId.has(key)) {
      blockingByActionId.set(key, diagnostic);
    }
  }
  return (actions ?? []).flatMap(action => {
    const derivation = validateSwitchTriggeredDerivedAction(action, scenario);
    if (derivation.valid !== true || derivation.parentActionId == null) {
      return [];
    }
    const blocker = blockingByActionId.get(String(derivation.parentActionId));
    if (!blocker) return [];
    return [
      {
        schemaVersion: 1,
        id: createDiagnosticId(
          ACTION_RULE_CODES.BACKGROUND_DERIVATION_INVALID,
          action.id,
          derivation.parentActionId
        ),
        code: ACTION_RULE_CODES.BACKGROUND_DERIVATION_INVALID,
        ruleKey: 'verified-source-derived-action-only',
        status: ACTION_RULE_STATUSES.VIOLATED,
        severity: 'error',
        actionId: action.id,
        actionIds: uniqueValues([derivation.parentActionId, action.id]),
        actorId: action.actorId ?? null,
        blockingActionId: derivation.parentActionId,
        timeMs: Number(action.startMs) || 0,
        reason: 'source-trigger-action-not-accepted',
        sourceIdentity: derivation.bindingId ?? null,
        sourceSequencePath: action.sourceSequencePath ?? null,
        message: `${action.name ?? action.id} 的触发输入 ${derivation.parentActionId} 未被接受，派生事务同步回滚`,
        source: {
          sourceKind: 'azpr-verified-background-action-derivation',
          sourceStatus: 'parent-trigger-atomic-rollback-applied',
          fieldPaths: [
            'action.derivedAction.parentActionId',
            'action.switchTriggerBinding.bindingId',
            'action.sourceSequencePath',
          ],
        },
        appliedToSimulationResults: true,
      },
    ];
  });
}

function createStandaloneStarCarryDiagnostics(actions, scenario) {
  return actions
    .filter(
      action =>
        action.type === ACTION_TYPES.SKILL &&
        action.actionKind === 'star-carry' &&
        !isVerifiedSwitchTriggeredDerivedAction(action, scenario)
    )
    .map(action => ({
      schemaVersion: 1,
      id: createDiagnosticId(
        ACTION_RULE_CODES.STAR_CARRY_SWITCH_TRIGGER_REQUIRED,
        action.id
      ),
      code: ACTION_RULE_CODES.STAR_CARRY_SWITCH_TRIGGER_REQUIRED,
      ruleKey: 'verified-switch-triggered-star-carry-only',
      status: ACTION_RULE_STATUSES.VIOLATED,
      severity: 'error',
      actionId: action.id,
      actionIds: [action.id],
      actionName: action.name ?? action.id,
      actorId: action.actorId ?? null,
      actorName: action.actor?.name ?? null,
      timeMs: Number(action.startMs) || 0,
      message: `${action.name ?? '星携技'} 只能由已验证的入场或退场切人事件触发`,
      source: {
        sourceKind: 'azpr-verified-switch-trigger-catalog',
        sourceStatus: 'standalone-star-carry-release-not-supported',
        fieldPaths: [
          'action.actionKind',
          'action.switchTriggerBinding',
          'action.derivedAction.kind',
        ],
      },
      appliedToSimulationResults: true,
    }));
}

function createJointAttackDiagnostics(
  actions,
  actors,
  fps = 60,
  scenario = {}
) {
  const actorById = new Map(
    actors.map(actor => [String(actor.id ?? ''), actor])
  );
  const actorCombos = actions.filter(isActorJointAttack);
  const kiboCombos = actions
    .map(action => ({
      action,
      binding: resolveVerifiedKiboJointAttackBinding(action),
    }))
    .filter(entry => entry.binding != null);
  const defaultTargetId = resolveScenarioDefaultTargetIdentity(scenario);
  const actionIndexById = new Map(
    actions.map((action, index) => [String(action.id), index])
  );
  const duplicateDiagnostics = createJointAttackDuplicateDiagnostics({
    actorCombos,
    kiboCombos,
    actorById,
    fps,
    defaultTargetId,
  });
  const duplicateActionIds = new Set(
    duplicateDiagnostics.map(diagnostic => String(diagnostic.actionId))
  );
  return [
    ...duplicateDiagnostics,
    ...actorCombos
      .filter(action => !duplicateActionIds.has(String(action.id)))
      .map(action =>
        createJointAttackDiagnostic({
          action,
          counterpartActions: kiboCombos.map(entry => entry.action),
          kiboBindings: kiboCombos,
          actorById,
          fps,
          defaultTargetId,
          actionIndexById,
          scenario,
          side: 'actor',
        })
      ),
    ...kiboCombos
      .filter(({ action }) => !duplicateActionIds.has(String(action.id)))
      .map(({ action, binding }) =>
        createJointAttackDiagnostic({
          action,
          counterpartActions: actorCombos,
          kiboBindings: [{ action, binding }],
          actorById,
          fps,
          defaultTargetId,
          actionIndexById,
          scenario,
          side: 'kibo',
        })
      ),
  ].filter(Boolean);
}

function createJointAttackDiagnostic({
  action,
  counterpartActions,
  actorById,
  fps,
  side,
  kiboBindings = [],
  defaultTargetId = null,
  actionIndexById = new Map(),
  scenario = {},
}) {
  const actor = actorById.get(String(action.actorId ?? '')) ?? action.actor;
  const configuredKiboId = positiveIntegerOrNull(actor?.loadout?.kiboId);
  const actionKiboId = positiveIntegerOrNull(action.kiboId);
  if (
    configuredKiboId == null ||
    (side === 'kibo' && actionKiboId !== configuredKiboId)
  ) {
    return createJointAttackDiagnosticRecord({
      code: ACTION_RULE_CODES.JOINT_ATTACK_KIBO_REQUIRED,
      action,
      actor,
      configuredKiboId,
      message:
        side === 'actor'
          ? `${action.name} 需要角色先装备奇波并与其合击技同时发动`
          : `${action.name} 不属于该角色当前装备的奇波，不能发动合击`,
    });
  }

  const compatibleActions = counterpartActions.filter(counterpart => {
    if (String(counterpart.actorId ?? '') !== String(action.actorId ?? '')) {
      return false;
    }
    return (
      side === 'kibo' ||
      positiveIntegerOrNull(counterpart.kiboId) === configuredKiboId
    );
  });
  const actionFrame = msToFrame(action.startMs, fps);
  const sameFrameCandidates = compatibleActions.filter(
    counterpart => msToFrame(counterpart.startMs, fps) === actionFrame
  );
  const sameFrame = sameFrameCandidates.find(counterpart =>
    jointAttackTargetsCompatible(action, counterpart, defaultTargetId)
  );
  if (sameFrame) {
    if (side === 'kibo') return null;
    const binding = kiboBindings.find(
      entry => String(entry.action.id) === String(sameFrame.id)
    )?.binding;
    const pair = createVerifiedJointAttackRuntimePair({
      actorAction: action,
      kiboAction: sameFrame,
      actor,
      scenario,
      fps,
      actorActionIndex: actionIndexById.get(String(action.id)),
      kiboActionIndex: actionIndexById.get(String(sameFrame.id)),
    });
    if (pair.ready) {
      return createJointAttackRuntimeReadyDiagnostic(pair);
    }
    if (
      pair.code === VERIFIED_JOINT_ATTACK_RUNTIME_CONTRACT_REQUIRED_CODE ||
      pair.code === VERIFIED_JOINT_ATTACK_PAIR_SOURCE_ORDER_INVALID
    ) {
      return createJointAttackRuntimeBlockedDiagnostic({
        actorAction: action,
        kiboAction: sameFrame,
        binding,
        pair,
      });
    }
    return createJointAttackTriggerUnresolvedDiagnostic({
      actorAction: action,
      kiboAction: sameFrame,
      binding,
    });
  }
  if (sameFrameCandidates.length > 0) {
    const counterpart = sameFrameCandidates.sort(
      compareActionSourceSequence
    )[0];
    return createJointAttackDiagnosticRecord({
      code: ACTION_RULE_CODES.JOINT_ATTACK_TARGET_MISMATCH,
      action,
      actor,
      configuredKiboId,
      counterpart,
      message: `${action.name} 与 ${counterpart.name} 必须指向同一目标`,
    });
  }

  const nearest = compatibleActions.sort(
    (left, right) =>
      Math.abs(Number(left.startMs) - Number(action.startMs)) -
        Math.abs(Number(right.startMs) - Number(action.startMs)) ||
      compareActionSourceSequence(left, right)
  )[0];
  if (!nearest) {
    return createJointAttackDiagnosticRecord({
      code: ACTION_RULE_CODES.JOINT_ATTACK_PAIR_MISSING,
      action,
      actor,
      configuredKiboId,
      message:
        side === 'actor'
          ? `${action.name} 缺少同帧的奇波合击技`
          : `${action.name} 缺少同帧的角色星结合击`,
    });
  }
  return createJointAttackDiagnosticRecord({
    code: ACTION_RULE_CODES.JOINT_ATTACK_FRAME_MISMATCH,
    action,
    actor,
    configuredKiboId,
    counterpart: nearest,
    suggestedStartMs: Number(nearest.startMs) || 0,
    message: `${action.name} 必须与 ${nearest.name} 在同一帧发动`,
  });
}

function createJointAttackDuplicateDiagnostics({
  actorCombos,
  kiboCombos,
  actorById,
  fps,
  defaultTargetId,
}) {
  const diagnostics = [];
  for (const entries of [
    actorCombos.map(action => ({ action, side: 'actor' })),
    kiboCombos.map(entry => ({ ...entry, side: 'kibo' })),
  ]) {
    const groups = groupByKey(entries, entry => {
      const action = entry.action;
      return [
        entry.side,
        String(action.actorId ?? ''),
        msToFrame(action.startMs, fps),
        resolveJointAttackTargetIdentity(action, defaultTargetId) ??
          'default-target',
      ].join('|');
    });
    groups.forEach(group => {
      if (group.length < 2) return;
      const actionIds = group.map(entry => entry.action.id);
      for (const { action } of group) {
        const actor =
          actorById.get(String(action.actorId ?? '')) ?? action.actor;
        diagnostics.push({
          ...createJointAttackDiagnosticRecord({
            code: ACTION_RULE_CODES.JOINT_ATTACK_DUPLICATE_SIDE,
            action,
            actor,
            configuredKiboId: positiveIntegerOrNull(actor?.loadout?.kiboId),
            message: `${action.name} 的同帧同目标合击侧重复，不能组成唯一原子配对`,
          }),
          actionIds,
          duplicateActionIds: actionIds,
        });
      }
    });
  }
  return diagnostics;
}

function resolveJointAttackTargetIdentity(action, defaultTargetId = null) {
  const value =
    action?.targetId ?? action?.target?.id ?? defaultTargetId ?? null;
  return value == null ? null : String(value);
}

function jointAttackTargetsCompatible(left, right, defaultTargetId) {
  const leftTarget = resolveJointAttackTargetIdentity(left, defaultTargetId);
  const rightTarget = resolveJointAttackTargetIdentity(right, defaultTargetId);
  return (
    leftTarget == null || rightTarget == null || leftTarget === rightTarget
  );
}

function resolveScenarioDefaultTargetIdentity(scenario) {
  return (
    scenario?.enemies?.[0]?.id ??
    scenario?.enemy?.id ??
    scenario?.target?.id ??
    null
  );
}

function createJointAttackTriggerUnresolvedDiagnostic({
  actorAction,
  kiboAction,
  binding,
}) {
  const evidence = createJointAttackTriggerUnresolvedEvidence({
    actorAction,
    kiboAction,
    binding,
  });
  return {
    schemaVersion: 1,
    id: createDiagnosticId(
      ACTION_RULE_CODES.JOINT_ATTACK_TRIGGER_UNRESOLVED,
      actorAction.id,
      kiboAction.id
    ),
    code: ACTION_RULE_CODES.JOINT_ATTACK_TRIGGER_UNRESOLVED,
    ruleKey: 'joint-attack-trigger',
    status: ACTION_RULE_STATUSES.UNRESOLVED,
    severity: 'warning',
    actionId: actorAction.id,
    actionIds: [actorAction.id, kiboAction.id],
    actionName: actorAction.name,
    actorId: actorAction.actorId ?? null,
    kiboId: binding?.ownerId ?? kiboAction.kiboId ?? null,
    timeMs: Number(actorAction.startMs) || 0,
    message:
      '合击动作映射、PreWeakBreak 静态资格谓词与同帧配对已分层确认，但未命名运行时字段及释放后服务端效果仍未闭合',
    evidence,
    source: {
      sourceKind: 'azpr-joint-attack-trigger-contract',
      sourceStatus: evidence.status,
      fieldPaths: [
        'petCsEntity.data.existPetBreakTarget',
        'PreWeakBreakSystem.OnUpdateDeltaTime@0x13FB720',
        'PreWeakBreakSystem.UpdatePreBreakThreshold@0x13FCB20',
        'NewTable/pet.breakSkillList',
        'controlBinding.logic.skillTag',
      ],
    },
    appliedToSimulationResults: false,
  };
}

function createJointAttackRuntimeReadyDiagnostic(pair) {
  const evidence = createVerifiedJointAttackRuntimeEvidence(pair);
  return {
    schemaVersion: 1,
    id: createDiagnosticId(
      ACTION_RULE_CODES.JOINT_ATTACK_RUNTIME_READY,
      pair.actorActionId,
      pair.kiboActionId
    ),
    code: ACTION_RULE_CODES.JOINT_ATTACK_RUNTIME_READY,
    ruleKey: 'joint-attack-runtime-assumption',
    status: ACTION_RULE_STATUSES.VERIFIED,
    severity: 'info',
    actionId: pair.actorActionId,
    actionIds: [pair.actorActionId, pair.kiboActionId],
    actorId: pair.actorId,
    kiboId: pair.kiboId,
    targetId: pair.targetId,
    timeMs: Number(pair.actorAction.startMs) || 0,
    pairIdentity: pair.pairIdentity,
    runtimeBindingHash: pair.runtimeBinding.bindingHash,
    mappingIdentity: pair.kiboMappingIdentity,
    message:
      '合击按版本化产品 assumption 通过输入资格门；客户端 parity 仍单独标记为未就绪',
    evidence,
    source: {
      sourceKind: 'azpr-joint-attack-runtime-assumption',
      sourceStatus: 'resolved-by-product-assumption',
      fieldPaths: [
        'combatScenario.jointAttackRuntime',
        'NewTable/pet.breakSkillList',
        'controlBinding.logic.skillTag',
        'action.sourceSequencePath',
      ],
    },
    appliedToSimulationResults: true,
  };
}

function createJointAttackRuntimeBlockedDiagnostic({
  actorAction,
  kiboAction,
  binding,
  pair,
}) {
  const code = pair.code;
  return {
    schemaVersion: 1,
    id: createDiagnosticId(code, actorAction.id, kiboAction.id),
    code,
    ruleKey: 'joint-attack-runtime-assumption',
    status: ACTION_RULE_STATUSES.VIOLATED,
    severity: 'error',
    actionId: actorAction.id,
    actionIds: [actorAction.id, kiboAction.id],
    actorId: actorAction.actorId ?? null,
    kiboId: binding?.ownerId ?? kiboAction.kiboId ?? null,
    timeMs: Number(actorAction.startMs) || 0,
    issues: pair.issues ?? [],
    message:
      code === VERIFIED_JOINT_ATTACK_PAIR_SOURCE_ORDER_INVALID
        ? '合击两半必须是同一原子输入的相邻、确定 source sequence'
        : '合击缺少有效的 m12-joint-attack-runtime-v1 产品 assumption 绑定',
    source: {
      sourceKind: 'azpr-joint-attack-runtime-assumption',
      sourceStatus: code,
      fieldPaths: [
        'combatScenario.jointAttackRuntime',
        'action.sourceSequencePath',
      ],
    },
    appliedToSimulationResults: true,
  };
}

function createJointAttackDiagnosticRecord({
  code,
  action,
  actor,
  configuredKiboId,
  counterpart = null,
  suggestedStartMs = null,
  message,
}) {
  return {
    schemaVersion: 1,
    id: createDiagnosticId(code, action.id, counterpart?.id),
    code,
    ruleKey: 'joint-attack-pairing',
    status: ACTION_RULE_STATUSES.VIOLATED,
    severity: 'error',
    actionId: action.id,
    actionIds: uniqueValues([action.id, counterpart?.id].filter(Boolean)),
    actionName: action.name,
    actorId: action.actorId ?? null,
    actorName: actor?.name ?? action.actorId ?? null,
    kiboId: action.kiboId ?? configuredKiboId,
    pairedActionId: counterpart?.id ?? null,
    timeMs: Number(action.startMs) || 0,
    suggestedStartMs,
    editFieldKey: suggestedStartMs == null ? '' : 'startMs',
    message,
    source: {
      sourceKind: 'azpr-joint-attack-input-contract',
      sourceStatus: 'verified-joint-attack-pairing-required',
      fieldPaths: [
        'action.actionKind',
        'action.eventType',
        'action.startMs',
        'action.actorId',
        'action.kiboId',
        'actor.loadout.kiboId',
      ],
    },
    appliedToSimulationResults: true,
  };
}

function isActorJointAttack(action) {
  return (
    action.type === ACTION_TYPES.SKILL && action.actionKind === 'star-combo'
  );
}

function createAttackInputChainDiagnostics(actions, fps = 60, strict = false) {
  const structuralStatus = strict
    ? ACTION_RULE_STATUSES.VIOLATED
    : ACTION_RULE_STATUSES.UNRESOLVED;
  const diagnostics = actions
    .filter(action => action.attackInputLegacyStatus === 'legacy-unresolved')
    .map(action =>
      createAttackInputDiagnostic({
        code: ACTION_RULE_CODES.ATTACK_INPUT_LEGACY_UNRESOLVED,
        action,
        message: `${action.name} 是无法唯一拆分的旧版聚合普攻，不参与三值结算`,
        status: ACTION_RULE_STATUSES.UNRESOLVED,
      })
    );
  for (const action of actions) {
    const identities = uniqueValues(
      [
        action.attackInputChainIdentity,
        action.attackInput?.attackInputChainIdentity,
        action.attackInputIntent?.chainIdentity,
      ]
        .filter(value => value != null && value !== '')
        .map(String)
    );
    if (identities.length <= 1) continue;
    diagnostics.push(
      createAttackInputDiagnostic({
        code: ACTION_RULE_CODES.ATTACK_INPUT_CONTEXT_CONFLICT,
        action,
        message: `${action.name} 的显式普攻链与上下文链身份冲突`,
        extra: {
          reason: 'attack-input-explicit-context-chain-conflict',
          conflictingChainIdentities: identities,
        },
        status: structuralStatus,
      })
    );
  }
  const groups = groupByKey(
    actions.filter(action => action.attackGroupId),
    action => action.attackGroupId
  );
  groups.forEach(groupActions => {
    const byTimeline = [...groupActions].sort(compareActions);
    const bySequence = [...groupActions].sort(
      (left, right) =>
        Number(left.attackSequenceIndex) - Number(right.attackSequenceIndex) ||
        compareActions(left, right)
    );
    const duplicatesBySequence = groupByKey(bySequence, action =>
      Number(action.attackSequenceIndex)
    );
    duplicatesBySequence.forEach(duplicates => {
      for (const duplicate of duplicates.slice(1)) {
        diagnostics.push(
          createAttackInputDiagnostic({
            code: ACTION_RULE_CODES.ATTACK_INPUT_CHAIN_ORDER_INVALID,
            action: duplicate,
            groupActions: duplicates,
            message: `${duplicate.name} 重复消费了同一普攻前置段`,
            extra: { reason: 'attack-input-predecessor-already-consumed' },
            status: structuralStatus,
          })
        );
      }
    });
    const inverted = bySequence.find(
      (action, index) =>
        index > 0 &&
        Number(action.startMs) < Number(bySequence[index - 1].startMs)
    );
    if (inverted) {
      diagnostics.push(
        createAttackInputDiagnostic({
          code: ACTION_RULE_CODES.ATTACK_INPUT_CHAIN_ORDER_INVALID,
          action: inverted,
          groupActions: bySequence,
          message: `普攻输入链顺序已改变，${inverted.name} 早于前一输入段`,
          extra: { reason: 'attack-input-sequence-order-inverted' },
          status: structuralStatus,
        })
      );
    }
    for (const action of byTimeline) {
      const sequenceIndex = Number(action.attackSequenceIndex) || 0;
      if (sequenceIndex <= 1) continue;
      const predecessorCandidates = bySequence.filter(
        candidate =>
          Number(candidate.attackSequenceIndex) === sequenceIndex - 1 &&
          (Number(candidate.startMs) < Number(action.startMs) ||
            (Number(candidate.startMs) === Number(action.startMs) &&
              compareActionSourceSequence(candidate, action) < 0))
      );
      const predecessor = predecessorCandidates
        .filter(
          candidate => Number(candidate.startMs) <= Number(action.startMs)
        )
        .sort((left, right) => compareActions(right, left))[0];
      if (!predecessor) {
        const missingSequenceIndexes = Array.from(
          { length: sequenceIndex - 1 },
          (_, index) => index + 1
        ).filter(
          index =>
            !bySequence.some(
              candidate => Number(candidate.attackSequenceIndex) === index
            )
        );
        diagnostics.push(
          createAttackInputDiagnostic({
            code: ACTION_RULE_CODES.ATTACK_INPUT_CHAIN_INCOMPLETE,
            action,
            groupActions: bySequence,
            message: `${action.name} 缺少已接受的 A${sequenceIndex - 1} 前置输入`,
            extra: {
              missingSequenceIndexes:
                missingSequenceIndexes.length > 0
                  ? missingSequenceIndexes
                  : [sequenceIndex - 1],
              reason: 'attack-input-predecessor-required',
            },
            status: structuralStatus,
          })
        );
        continue;
      }
      if (String(predecessor.actorId ?? '') !== String(action.actorId ?? '')) {
        diagnostics.push(
          createAttackInputDiagnostic({
            code: ACTION_RULE_CODES.ATTACK_INPUT_CHAIN_ORDER_INVALID,
            action,
            groupActions: [predecessor, action],
            message: `${action.name} 不能消费其他角色的普攻前置段`,
            extra: { reason: 'attack-input-cross-actor-predecessor' },
            status: structuralStatus,
          })
        );
        continue;
      }
      if (
        action.contextActionId != null &&
        String(action.contextActionId) !== String(predecessor.id)
      ) {
        diagnostics.push(
          createAttackInputDiagnostic({
            code: ACTION_RULE_CODES.ATTACK_INPUT_CHAIN_ORDER_INVALID,
            action,
            groupActions: [predecessor, action],
            message: `${action.name} 引用的前置段不是已接受的同链上一段`,
            extra: {
              reason: 'attack-input-predecessor-identity-mismatch',
              expectedContextActionId: predecessor.id,
              actualContextActionId: action.contextActionId,
            },
            status: structuralStatus,
          })
        );
        continue;
      }
      const predecessorChainIdentity =
        predecessor.attackInputChainIdentity ??
        predecessor.attackInput?.attackInputChainIdentity ??
        null;
      const actionChainIdentity =
        action.attackInputChainIdentity ??
        action.attackInput?.attackInputChainIdentity ??
        null;
      if (
        predecessorChainIdentity != null &&
        actionChainIdentity != null &&
        String(predecessorChainIdentity) !== String(actionChainIdentity)
      ) {
        diagnostics.push(
          createAttackInputDiagnostic({
            code: ACTION_RULE_CODES.ATTACK_INPUT_CHAIN_ORDER_INVALID,
            action,
            groupActions: [predecessor, action],
            message: `${action.name} 与前置段不属于同一来源化普攻链`,
            extra: { reason: 'attack-input-cross-chain-predecessor' },
            status: structuralStatus,
          })
        );
        continue;
      }
      const predecessorIndex = actions.indexOf(predecessor);
      const actionIndex = actions.indexOf(action);
      let continuityBridge = null;
      const interruption = actions
        .slice(predecessorIndex + 1, actionIndex)
        .find(candidate => {
          if (candidate.type === ACTION_TYPES.SWITCH) return true;
          if (
            String(candidate.actorId ?? '') !== String(action.actorId ?? '') ||
            String(candidate.attackGroupId ?? '') ===
              String(action.attackGroupId ?? '')
          ) {
            return false;
          }
          const bridge = resolveVerifiedAttackChainContinuityBridge({
            predecessor,
            intermediary: candidate,
            successor: action,
          });
          if (bridge && continuityBridge == null) {
            continuityBridge = { ...bridge, action: candidate };
            return false;
          }
          return true;
        });
      if (interruption) {
        diagnostics.push(
          createAttackInputDiagnostic({
            code: ACTION_RULE_CODES.ATTACK_INPUT_CHAIN_ORDER_INVALID,
            action,
            groupActions: [predecessor, action],
            message: `${action.name} 的普攻前置段已被 ${interruption.name ?? interruption.id} 中断`,
            extra: {
              reason: 'attack-input-chain-interrupted',
              blockingActionId: interruption.id,
            },
            status: structuralStatus,
          })
        );
        continue;
      }
      const linkSourceAction = continuityBridge?.action ?? predecessor;
      const linkWindow =
        continuityBridge?.rule?.inputWindow ??
        predecessor.attackInput?.linkWindow;
      const linkTimingApplied =
        continuityBridge != null ||
        predecessor.attackInput?.linkTimingStatus === 'applied';
      if (!linkTimingApplied || !linkWindow) {
        diagnostics.push(
          createAttackInputDiagnostic({
            code: ACTION_RULE_CODES.ATTACK_INPUT_LINK_TIMING_UNRESOLVED,
            action,
            groupActions: [predecessor, linkSourceAction, action],
            message: `${linkSourceAction.name} 到 ${action.name} 的真实输入窗口尚未确认`,
            status: ACTION_RULE_STATUSES.UNRESOLVED,
          })
        );
        continue;
      }
      const relativeStartFrame = msToFrame(
        Number(action.startMs) - Number(linkSourceAction.startMs),
        fps
      );
      if (isFrameWithinVerifiedInputWindow(relativeStartFrame, linkWindow)) {
        continue;
      }
      const tooEarly = relativeStartFrame < linkWindow.startFrame;
      const latestStartFrame = Math.max(
        Number(linkWindow.startFrame),
        Number(linkWindow.endFrame) - 1
      );
      diagnostics.push(
        createAttackInputDiagnostic({
          code: tooEarly
            ? ACTION_RULE_CODES.ATTACK_INPUT_LINK_TOO_EARLY
            : ACTION_RULE_CODES.ATTACK_INPUT_LINK_TOO_LATE,
          action,
          groupActions: [predecessor, linkSourceAction, action],
          message: tooEarly
            ? `${action.name} 比 ${linkSourceAction.name} 的最早输入窗口提前 ${linkWindow.startFrame - relativeStartFrame}F`
            : `${action.name} 已超过 ${linkSourceAction.name} 的输入窗口 ${relativeStartFrame - latestStartFrame}F`,
          extra: {
            relativeStartFrame,
            suggestedStartMs:
              Number(linkSourceAction.startMs) +
              ((tooEarly ? linkWindow.startFrame : latestStartFrame) * 1000) /
                (Number(fps) || 60),
            editFieldKey: 'startMs',
            ...(continuityBridge
              ? {
                  continuityRuleIdentity: continuityBridge.rule.ruleIdentity,
                  continuitySourceIdentity:
                    continuityBridge.rule.sourceIdentity,
                }
              : {}),
          },
          status: structuralStatus,
        })
      );
    }
  });
  return diagnostics;
}

function createNormalAttackInputPhaseDiagnostics(
  actions,
  fps = 60,
  strict = false
) {
  const status = strict
    ? ACTION_RULE_STATUSES.VIOLATED
    : ACTION_RULE_STATUSES.UNRESOLVED;
  const diagnostics = [];
  const acceptedByActorId = new Map();
  for (const action of [...actions].sort(compareActions)) {
    if (action.type === ACTION_TYPES.SWITCH) {
      acceptedByActorId.clear();
      continue;
    }
    const mapping = getVerifiedCombatActionMapping(action);
    const actorId = String(action.actorId ?? '');
    if (mapping?.actionKind !== 'normal-attack') {
      if (actorId) acceptedByActorId.delete(actorId);
      continue;
    }
    if (Number(action.attackSequenceIndex) !== 1) continue;
    if (
      action.attackInputChainIdentity != null ||
      action.attackInput?.attackInputChainIdentity != null
    ) {
      acceptedByActorId.delete(actorId);
      continue;
    }
    const runtimeContextIntent =
      action.attackInputIntent?.kind === 'public-normal-attack' &&
      action.attackInputIntent?.selectionMode === 'runtime-context' &&
      action.attackInputChainSelectionSource !== 'user-explicit';
    if (runtimeContextIntent) {
      acceptedByActorId.delete(actorId);
      continue;
    }
    const accepted = acceptedByActorId.get(actorId) ?? null;
    const phase = resolveVerifiedNormalAttackInputPhase({
      mapping,
      acceptedAction: accepted?.action ?? null,
      acceptedSelection: null,
      actorId,
      inputTimeMs: Number(action.startMs) || 0,
      fps,
    });
    const match = matchVerifiedNormalAttackInput({ action, mapping, phase });
    if (!match.accepted) {
      diagnostics.push(
        createAttackInputDiagnostic({
          code: ACTION_RULE_CODES.ATTACK_INPUT_CONTEXT_CONFLICT,
          action,
          groupActions: [accepted?.action, action].filter(Boolean),
          message: `${action.name} 不符合当前普攻输入阶段 ${phase.phase}`,
          extra: {
            reason: match.reason,
            formIdentity: phase.formIdentity,
            sourceKind: phase.sourceKind,
            sourceActionId: phase.sourceActionId,
            sourceIdentity: phase.sourceIdentity,
            expectedAttackInput: phase.expected,
            actualAttackInput: match.actual,
          },
          status,
        })
      );
      continue;
    }
    acceptedByActorId.set(actorId, { action });
  }
  return diagnostics;
}

function resolveVerifiedAttackChainContinuityBridge({
  predecessor,
  intermediary,
  successor,
}) {
  const mechanicsPackage = getInstalledVerifiedCombatMechanicsPackage();
  const chainIdentity =
    predecessor?.attackInputChainIdentity ??
    predecessor?.attackInput?.attackInputChainIdentity ??
    null;
  const successorChainIdentity =
    successor?.attackInputChainIdentity ??
    successor?.attackInput?.attackInputChainIdentity ??
    null;
  const predecessorSequence = Number(predecessor?.attackSequenceIndex) || 0;
  const successorSequence = Number(successor?.attackSequenceIndex) || 0;
  if (
    !chainIdentity ||
    (successorChainIdentity != null &&
      String(successorChainIdentity) !== String(chainIdentity)) ||
    successorSequence !== predecessorSequence + 1
  ) {
    return null;
  }
  const chain = (
    mechanicsPackage?.actionVariantGraph?.attackInputChains ?? []
  ).find(
    candidate =>
      candidate.applied === true &&
      String(candidate.chainIdentity) === String(chainIdentity)
  );
  const mapping = getVerifiedCombatActionMapping(intermediary);
  if (!chain || !mapping || Number(mapping.ownerId) !== Number(chain.ownerId)) {
    return null;
  }
  const rule = (chain.continuityRules ?? []).find(
    candidate =>
      candidate.applied === true &&
      Number(candidate.intermediaryControlSkillId) ===
        Number(mapping.controlSkillId) &&
      Number(candidate.intermediarySubSkillIndex) ===
        Number(mapping.selectedSubSkillIndex) &&
      candidate.resumePolicy === 'next-segment' &&
      candidate.inputCommand === 'normal-attack' &&
      Number.isInteger(Number(candidate.inputWindow?.startFrame)) &&
      Number.isInteger(Number(candidate.inputWindow?.endFrame)) &&
      Number(candidate.inputWindow.endFrame) >
        Number(candidate.inputWindow.startFrame) &&
      typeof candidate.sourceIdentity === 'string' &&
      candidate.sourceIdentity.length > 0
  );
  return rule
    ? {
        rule,
        mappingIdentity: mapping.identity ?? null,
        runtimeConditionRequired: true,
      }
    : null;
}

function isFormalActionLegalityScenario(scenario) {
  return (
    scenario?.formalActionLegality === true ||
    scenario?.optimizationQualification?.mode === 'formal' ||
    scenario?.combatScenario?.objectiveContract?.classification === 'primary' ||
    scenario?.objectiveContract?.classification === 'primary'
  );
}

function createAttackInputDiagnostic({
  code,
  action,
  groupActions = [action],
  message,
  extra = {},
  status = ACTION_RULE_STATUSES.VIOLATED,
}) {
  return {
    schemaVersion: 1,
    id: createDiagnosticId(code, action.id, action.attackGroupId),
    code,
    ruleKey: 'normal-attack-input-chain',
    status,
    severity: status === ACTION_RULE_STATUSES.VIOLATED ? 'error' : 'warning',
    actionId: action.id,
    actionIds: groupActions.map(item => item.id),
    actionName: action.name,
    actorId: action.actorId,
    actorName: action.actor?.name ?? action.actorId,
    timeMs: action.startMs,
    attackGroupId: action.attackGroupId,
    message,
    source: {
      sourceKind: 'project-action-attack-input-sequence',
      sourceStatus: code,
      fieldPaths: [
        'action.attackGroupId',
        'action.attackSequenceIndex',
        'action.attackSequenceTotal',
        'action.attackInputLegacyStatus',
      ],
    },
    appliedToSimulationResults: status === ACTION_RULE_STATUSES.VIOLATED,
    ...extra,
  };
}

function createBlockedAttackInputPredecessorDiagnostics(
  actions,
  existingDiagnostics
) {
  const blockedActionIds = new Set(
    existingDiagnostics
      .filter(item => item.status === ACTION_RULE_STATUSES.VIOLATED)
      .map(item => String(item.actionId))
  );
  const diagnostics = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const action of actions) {
      const sequenceIndex = Number(action.attackSequenceIndex) || 0;
      if (
        sequenceIndex <= 1 ||
        action.attackGroupId == null ||
        blockedActionIds.has(String(action.id))
      ) {
        continue;
      }
      const predecessor = [...actions]
        .filter(
          candidate =>
            String(candidate.attackGroupId ?? '') ===
              String(action.attackGroupId) &&
            String(candidate.actorId ?? '') === String(action.actorId ?? '') &&
            Number(candidate.attackSequenceIndex) === sequenceIndex - 1 &&
            Number(candidate.startMs) <= Number(action.startMs)
        )
        .sort((left, right) => compareActions(right, left))[0];
      if (!predecessor || !blockedActionIds.has(String(predecessor.id))) {
        continue;
      }
      diagnostics.push(
        createAttackInputDiagnostic({
          code: ACTION_RULE_CODES.ATTACK_INPUT_CHAIN_INCOMPLETE,
          action,
          groupActions: [predecessor, action],
          message: `${action.name} 的前置段 ${predecessor.name} 未被接受，后续输入不执行`,
          extra: {
            reason: 'attack-input-predecessor-not-accepted',
            blockingActionId: predecessor.id,
            missingSequenceIndexes: [sequenceIndex - 1],
          },
          status: ACTION_RULE_STATUSES.VIOLATED,
        })
      );
      blockedActionIds.add(String(action.id));
      changed = true;
    }
  }
  return diagnostics;
}

function createActionReadinessTimeline({
  actions,
  diagnostics,
  cooldownEvaluation,
  fps = 60,
}) {
  const diagnosticsByActionId = groupByKey(
    diagnostics,
    diagnostic => diagnostic.actionId
  );
  const actionRows = actions.map((action, index) => {
    const actionDiagnostics = diagnosticsByActionId.get(action.id) ?? [];
    const violations = actionDiagnostics.filter(
      item => item.status === ACTION_RULE_STATUSES.VIOLATED
    );
    const unresolved = actionDiagnostics.filter(
      item => item.status === ACTION_RULE_STATUSES.UNRESOLVED
    );
    const status =
      violations.length > 0
        ? 'blocked'
        : unresolved.length > 0
          ? 'ready-with-unresolved-conditions'
          : 'ready';
    return {
      schemaVersion: 1,
      sourceKind: 'azpr-action-readiness-state',
      status,
      executable: violations.length === 0,
      actionId: action.id,
      actionName: action.name ?? action.id,
      actionType: action.type,
      actionIndex: index,
      actorId: action.actorId ?? null,
      actorName: action.actor?.name ?? null,
      skillId: action.skillId ?? null,
      startMs: Number(action.startMs) || 0,
      frameIndex: msToFrame(Number(action.startMs) || 0, fps),
      diagnosticIds: actionDiagnostics.map(item => item.id),
      violationCodes: uniqueValues(violations.map(item => item.code)),
      unresolvedCodes: uniqueValues(unresolved.map(item => item.code)),
      cooldown: cooldownEvaluation.snapshotsByActionId.get(action.id) ?? null,
      appliedToSimulationResults: false,
    };
  });
  const blockedActionCount = actionRows.filter(
    action => !action.executable
  ).length;
  const unresolvedActionCount = actionRows.filter(
    action => action.unresolvedCodes.length > 0
  ).length;

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-action-readiness-timeline',
    contractName: ACTION_READINESS_TIMELINE_CONTRACT_NAME,
    status:
      blockedActionCount > 0
        ? 'action-readiness-timeline-ready-with-blocked-actions'
        : unresolvedActionCount > 0
          ? 'action-readiness-timeline-ready-with-unresolved-conditions'
          : 'action-readiness-timeline-ready',
    actions: actionRows,
    cooldownWindows: cooldownEvaluation.cooldownWindows,
    cooldownReductionTransactions:
      cooldownEvaluation.cooldownReductionTransactions,
    cooldownState: cooldownEvaluation.cooldownState,
    summary: {
      actionCount: actionRows.length,
      readyActionCount: actionRows.filter(action => action.status === 'ready')
        .length,
      blockedActionCount,
      unresolvedActionCount,
      cooldownTrackedActionCount: actionRows.filter(action => action.cooldown)
        .length,
      cooldownWindowCount: cooldownEvaluation.cooldownWindows.length,
      cooldownReductionTransactionCount:
        cooldownEvaluation.cooldownReductionTransactions.length,
      appliedCooldownReductionTransactionCount:
        cooldownEvaluation.cooldownReductionTransactions.filter(
          transaction => transaction.appliedToSimulationResults
        ).length,
      cooldownModifiedWindowCount: cooldownEvaluation.cooldownWindows.filter(
        window =>
          window.cooldownEvaluation?.status === 'cooldown-evaluation-adapted'
      ).length,
      appliedToSimulationResults: false,
    },
    appliedToSimulationResults: false,
  };
}

function createLaneOverlapDiagnostics(actions) {
  const rangesByActor = new Map();
  for (const action of actions) {
    if (!isBlockingActorAction(action)) {
      continue;
    }
    if (!rangesByActor.has(action.actorId)) {
      rangesByActor.set(action.actorId, []);
    }
    rangesByActor.get(action.actorId).push(createActionRange(action));
  }

  const diagnostics = [];
  rangesByActor.forEach(ranges => {
    const sortedRanges = [...ranges].sort(compareRanges);
    for (let index = 0; index < sortedRanges.length; index += 1) {
      const blocking = sortedRanges[index];
      for (
        let candidateIndex = index + 1;
        candidateIndex < sortedRanges.length;
        candidateIndex += 1
      ) {
        const candidate = sortedRanges[candidateIndex];
        if (candidate.startMs >= blocking.endMs - ACTION_BOUNDARY_EPSILON_MS) {
          break;
        }
        const overlapEndMs = Math.min(blocking.endMs, candidate.endMs);
        if (overlapEndMs - candidate.startMs <= ACTION_BOUNDARY_EPSILON_MS) {
          continue;
        }
        if (
          blocking.contextActionId === candidate.actionId ||
          candidate.contextActionId === blocking.actionId
        ) {
          continue;
        }
        diagnostics.push({
          schemaVersion: 1,
          id: createDiagnosticId(
            ACTION_RULE_CODES.LANE_OVERLAP,
            candidate.actionId,
            blocking.actionId
          ),
          code: ACTION_RULE_CODES.LANE_OVERLAP,
          ruleKey: 'actor-action-occupancy',
          status: ACTION_RULE_STATUSES.VIOLATED,
          severity: 'error',
          actionId: candidate.actionId,
          actionIds: [blocking.actionId, candidate.actionId],
          actionName: candidate.actionName,
          actorId: candidate.actorId,
          actorName: candidate.actorName,
          blockingActionId: blocking.actionId,
          blockingActionName: blocking.actionName,
          timeMs: candidate.startMs,
          range: {
            startMs: candidate.startMs,
            endMs: overlapEndMs,
            durationMs: overlapEndMs - candidate.startMs,
          },
          suggestedStartMs: blocking.endMs,
          editFieldKey: 'startMs',
          message: `${candidate.actionName} 与 ${blocking.actionName} 在同一角色轨重叠`,
          source: {
            sourceKind: 'azpr-action-effective-timeline',
            sourceStatus: 'project-action-range-confirmed',
            fieldPaths: [
              'action.startMs',
              'action.durationMs',
              'action.actorId',
            ],
          },
          appliedToSimulationResults: false,
        });
      }
    }
  });
  return diagnostics;
}

function createSwitchOccupancyDiagnostics(actions, fps = 60, strict = false) {
  const status = strict
    ? ACTION_RULE_STATUSES.VIOLATED
    : ACTION_RULE_STATUSES.UNRESOLVED;
  const actorActions = (actions ?? []).filter(isBlockingActorAction);
  const diagnostics = [];
  const acceptedSwitchByFrame = new Map();
  for (const switchAction of (actions ?? [])
    .filter(action => action.type === ACTION_TYPES.SWITCH)
    .sort(compareActions)) {
    const frame = msToFrame(switchAction.startMs, Number(fps) || 60);
    if (acceptedSwitchByFrame.has(frame)) continue;
    acceptedSwitchByFrame.set(frame, switchAction);
    const switchStartMs = Math.max(0, Number(switchAction.startMs) || 0);
    const blocking = actorActions
      .filter(action => {
        if (
          String(action.actorId ?? '') !== String(switchAction.actorId ?? '')
        ) {
          return false;
        }
        const range = createActionRange(action);
        const actionPrecedesSwitch =
          range.startMs < switchStartMs ||
          (range.startMs === switchStartMs &&
            compareActionSourceSequence(action, switchAction) < 0);
        const tailPolicy = action.switchExitTailPolicy;
        const verifiedTailContinuation =
          isVerifiedSwitchExitTailPolicy(tailPolicy) &&
          tailPolicy.evidenceClosed === true &&
          String(tailPolicy.switchActionId ?? '') ===
            String(switchAction.id ?? '');
        return (
          actionPrecedesSwitch &&
          switchStartMs < range.endMs - ACTION_BOUNDARY_EPSILON_MS &&
          !verifiedTailContinuation
        );
      })
      .sort((left, right) => compareActions(right, left))[0];
    if (!blocking) continue;
    const blockingRange = createActionRange(blocking);
    diagnostics.push({
      schemaVersion: 1,
      id: createDiagnosticId(
        ACTION_RULE_CODES.SWITCH_OCCUPANCY_UNRESOLVED,
        switchAction.id,
        blocking.id
      ),
      code: ACTION_RULE_CODES.SWITCH_OCCUPANCY_UNRESOLVED,
      ruleKey: 'actor-switch-cancel-window',
      status,
      severity: status === ACTION_RULE_STATUSES.VIOLATED ? 'error' : 'warning',
      actionId: switchAction.id,
      actionIds: [blocking.id, switchAction.id],
      actorId: switchAction.actorId ?? null,
      blockingActionId: blocking.id,
      timeMs: switchStartMs,
      range: {
        startMs: blockingRange.startMs,
        endMs: blockingRange.endMs,
      },
      suggestedStartMs: blockingRange.endMs,
      editFieldKey: 'startMs',
      reason: 'verified-switch-cancel-window-missing',
      message: `${switchAction.name ?? switchAction.id} 位于 ${blocking.name ?? blocking.id} 的占用区间内，但没有已验证的切人取消窗口`,
      source: {
        sourceKind: 'azpr-action-effective-timeline',
        sourceStatus: 'switch-cancel-window-evidence-open',
        fieldPaths: [
          'action.startMs',
          'action.durationMs',
          'action.actionScheduling.cancelWindows',
        ],
      },
      appliedToSimulationResults: status === ACTION_RULE_STATUSES.VIOLATED,
    });
  }
  return diagnostics;
}

function createSwitchExitTailDiagnostics(actions, scenario) {
  return (actions ?? []).flatMap(action => {
    const policy = action?.switchExitTailPolicy;
    if (policy == null) return [];
    const valid = isVerifiedSwitchExitTailPolicy(policy);
    if (valid && policy.evidenceClosed === true) return [];
    const code = valid
      ? policy.rejectionCode ||
        ACTION_RULE_CODES.SWITCH_EXIT_TAIL_POLICY_INVALID
      : ACTION_RULE_CODES.SWITCH_EXIT_TAIL_POLICY_INVALID;
    const status =
      valid && !isFormalActionLegalityScenario(scenario)
        ? ACTION_RULE_STATUSES.UNRESOLVED
        : ACTION_RULE_STATUSES.VIOLATED;
    return [
      {
        schemaVersion: 1,
        id: createDiagnosticId(code, action.id, policy.switchActionId),
        code,
        ruleKey: 'verified-switch-exit-tail-materialization',
        status,
        severity:
          status === ACTION_RULE_STATUSES.VIOLATED ? 'error' : 'warning',
        actionId: action.id,
        actionIds: uniqueValues([action.id, policy.switchActionId]),
        actorId: action.actorId ?? null,
        timeMs: Number(action.startMs) || 0,
        switchActionId: policy.switchActionId ?? null,
        switchBoundaryFrame: policy.switchBoundaryFrame ?? null,
        reason: valid
          ? policy.status
          : 'compiler-switch-exit-tail-policy-invalid',
        sourceIdentity: policy.policyHash ?? null,
        sourceSequencePath: action.sourceSequencePath ?? null,
        message: `${action.name ?? action.id} 在切换边界后的未物化 owner-bound 尾包缺少可验证继续结算来源，动作不执行`,
        source: {
          sourceKind: 'azpr-client-static-switch-exit-tail-v1',
          sourceStatus: 'switch-exit-tail-fail-closed',
          fieldPaths: [
            'action.switchExitTailPolicy',
            'action.sourceSequencePath',
          ],
        },
        appliedToSimulationResults: status === ACTION_RULE_STATUSES.VIOLATED,
      },
    ];
  });
}

function createKiboAutoCastTriggerDiagnostics(scenario) {
  const registry = scenario?.kiboAutoCastDerivationRegistry;
  if (!isAuthoritativeKiboAutoCastDerivationRegistry(registry)) return [];
  const formal = isFormalActionLegalityScenario(scenario);
  const fps = Number(scenario?.time?.fps) || 60;
  return (registry.triggerExclusions ?? []).map((exclusion, index) => {
    const status = formal
      ? ACTION_RULE_STATUSES.VIOLATED
      : ACTION_RULE_STATUSES.UNRESOLVED;
    const startFrame = Number(exclusion.controlledIntervalStartFrame);
    return {
      schemaVersion: 1,
      id: createDiagnosticId(
        ACTION_RULE_CODES.KIBO_AUTO_CAST_TRIGGER_UNRESOLVED,
        exclusion.ownerActorId,
        exclusion.kiboId,
        exclusion.publicActionId,
        exclusion.controlledIntervalIdentity,
        index
      ),
      code: ACTION_RULE_CODES.KIBO_AUTO_CAST_TRIGGER_UNRESOLVED,
      ruleKey: 'verified-kibo-autonomous-trigger',
      status,
      severity: status === ACTION_RULE_STATUSES.VIOLATED ? 'error' : 'warning',
      actionId: null,
      actionIds: [],
      actorId: exclusion.ownerActorId ?? null,
      timeMs:
        Number.isInteger(startFrame) && startFrame >= 0
          ? (startFrame * 1000) / fps
          : 0,
      reason: 'autonomous-trigger-evidence-open',
      sourceIdentity: registry.registryHash ?? null,
      message: `Kibo ${exclusion.kiboId} action ${exclusion.publicActionId} trigger ${exclusion.triggerTag} is unresolved and was not scheduled`,
      kiboId: exclusion.kiboId ?? null,
      publicActionId: exclusion.publicActionId ?? null,
      actionKind: exclusion.actionKind ?? null,
      triggerTag: exclusion.triggerTag ?? null,
      controlledIntervalIdentity: exclusion.controlledIntervalIdentity ?? null,
      source: {
        sourceKind: 'azpr-controlled-kibo-auto-cast-scheduler',
        sourceStatus: 'autonomous-trigger-fail-closed',
        fieldPaths: [
          'scenario.kiboAutoCastDerivationRegistry.triggerExclusions',
        ],
      },
      appliedToSimulationResults: formal,
    };
  });
}

function createKiboAutoCastScheduleDiagnostics(scenario) {
  const registry = scenario?.kiboAutoCastDerivationRegistry;
  if (!isAuthoritativeKiboAutoCastDerivationRegistry(registry)) return [];
  const formal = isFormalActionLegalityScenario(scenario);
  const fps = Number(scenario?.time?.fps) || 60;
  return (registry.scheduleExclusions ?? []).map((exclusion, index) => {
    const status = formal
      ? ACTION_RULE_STATUSES.VIOLATED
      : ACTION_RULE_STATUSES.UNRESOLVED;
    const startFrame = Number(exclusion.controlledIntervalStartFrame);
    return {
      schemaVersion: 1,
      id: createDiagnosticId(
        ACTION_RULE_CODES.KIBO_AUTO_CAST_SCHEDULE_UNRESOLVED,
        exclusion.ownerActorId,
        exclusion.kiboId,
        exclusion.publicActionId,
        exclusion.controlledIntervalIdentity,
        index
      ),
      code: ACTION_RULE_CODES.KIBO_AUTO_CAST_SCHEDULE_UNRESOLVED,
      ruleKey: 'verified-kibo-autonomous-schedule',
      status,
      severity: status === ACTION_RULE_STATUSES.VIOLATED ? 'error' : 'warning',
      actionId: null,
      actionIds: [],
      actorId: exclusion.ownerActorId ?? null,
      timeMs:
        Number.isInteger(startFrame) && startFrame >= 0
          ? (startFrame * 1000) / fps
          : 0,
      reason: 'autonomous-nodecanvas-schedule-evidence-open',
      sourceIdentity: registry.registryHash ?? null,
      message: `Kibo ${exclusion.kiboId} action ${exclusion.publicActionId} is eligible only while its owner is controlled, but its NodeCanvas frame, arbitration priority, and cadence are unresolved`,
      kiboId: exclusion.kiboId ?? null,
      publicActionId: exclusion.publicActionId ?? null,
      actionKind: exclusion.actionKind ?? null,
      triggerTag: exclusion.triggerTag ?? null,
      eligibilityStatus: exclusion.eligibilityStatus ?? null,
      eligibilityContractHash: exclusion.eligibilityContractHash ?? null,
      controlledIntervalIdentity: exclusion.controlledIntervalIdentity ?? null,
      leavesOpen: (exclusion.leavesOpen ?? []).map(String),
      source: {
        sourceKind: 'azpr-controlled-kibo-auto-cast-scheduler',
        sourceStatus: 'nodecanvas-schedule-fail-closed',
        fieldPaths: [
          'scenario.kiboAutoCastDerivationRegistry.eligibilityContract',
          'scenario.kiboAutoCastDerivationRegistry.scheduleExclusions',
        ],
      },
      appliedToSimulationResults: formal,
    };
  });
}

function createSwitchFrameConflictDiagnostics(actions, fps = 60) {
  const frameRate = Number(fps) || 60;
  const switchesByFrame = groupByKey(
    actions.filter(action => action.type === ACTION_TYPES.SWITCH),
    action => msToFrame(action.startMs, frameRate)
  );
  const diagnostics = [];
  switchesByFrame.forEach((switches, frameIndex) => {
    const ordered = [...switches].sort(compareActions);
    const accepted = ordered[0];
    for (const action of ordered.slice(1)) {
      diagnostics.push({
        schemaVersion: 1,
        id: createDiagnosticId(
          ACTION_RULE_CODES.SWITCH_FRAME_CONFLICT,
          action.id,
          accepted.id
        ),
        code: ACTION_RULE_CODES.SWITCH_FRAME_CONFLICT,
        ruleKey: 'single-controlled-actor-transition-per-frame',
        status: ACTION_RULE_STATUSES.VIOLATED,
        severity: 'error',
        actionId: action.id,
        actionIds: [accepted.id, action.id],
        actionName: action.name ?? action.id,
        actorId: action.actorId ?? null,
        actorName: action.actor?.name ?? null,
        blockingActionId: accepted.id,
        blockingActionName: accepted.name ?? accepted.id,
        timeMs: Number(action.startMs) || 0,
        frameIndex: Number(frameIndex),
        suggestedStartMs: Number(
          (((Number(frameIndex) + 1) * 1000) / frameRate).toFixed(6)
        ),
        editFieldKey: 'startMs',
        message: `${action.name ?? action.id} 与 ${accepted.name ?? accepted.id} 位于同一帧；按场景 source sequence 保留 ${accepted.id}`,
        source: {
          sourceKind: 'azpr-exact-frame-source-sequence-contract',
          sourceStatus: 'project-switch-frame-conflict-confirmed',
          fieldPaths: [
            'action.startMs',
            'action.sourceSequenceIndex',
            'action.sourceSequencePath',
          ],
        },
        appliedToSimulationResults: true,
      });
    }
  });
  return diagnostics;
}

function createSkillCooldownEvaluation(
  actions,
  {
    scenario = null,
    cooldownEvaluationAdapter = null,
    preblockedActionIds = new Set(),
    actionResolutionById = null,
  } = {}
) {
  const cooldownStateBySkillOwner = new Map();
  const diagnostics = [];
  const snapshotsByActionId = new Map();
  const cooldownWindows = [];
  const pendingCooldownReductionTransactions = [];
  const cooldownReductionTransactions = [];
  const acceptedSkillStartTransitions = [];
  const cooldownModifierSession = createVerifiedKiboCooldownModifierSession({
    scenario,
  });
  for (const [actionOrderIndex, action] of actions.entries()) {
    settleCooldownReductionTransactions({
      pending: pendingCooldownReductionTransactions,
      settled: cooldownReductionTransactions,
      cooldownStateBySkillOwner,
      cooldownWindows,
      throughTimeMs: Number(action.startMs) || 0,
      boundaryAction: action,
    });
    if (
      ![ACTION_TYPES.SKILL, ACTION_TYPES.KIBO_EVENT].includes(action.type) ||
      !action.actorId ||
      (action.type === ACTION_TYPES.KIBO_EVENT && !action.kiboId)
    ) {
      continue;
    }
    if (preblockedActionIds.has(String(action.id))) {
      continue;
    }
    const ownerKind =
      action.type === ACTION_TYPES.KIBO_EVENT ? 'kibo' : 'actor';
    const ownerId = ownerKind === 'kibo' ? action.kiboId : action.actorId;
    const runtimeOwnerIdentity = createCooldownRuntimeOwnerIdentity({
      action,
      ownerKind,
      ownerId,
    });
    const baseCooldown = createSkillCooldownRequirement(action);
    if (!baseCooldown) {
      const cooldownPolicy = {
        setCd: false,
        source: 'no-positive-cooldown-requirement',
      };
      const passiveTransitions = cooldownModifierSession.onActionAccepted({
        action,
        ownerKind,
        ownerId,
        actionOrderIndex,
        cooldownPolicy,
      });
      acceptedSkillStartTransitions.push(
        createAcceptedSkillStartTransition({
          action,
          ownerKind,
          ownerId,
          actionOrderIndex,
          cooldownPolicy,
          cooldownWindowId: null,
          passiveTransitions,
        })
      );
      enqueueAcceptedCooldownReductionTransactions({
        action,
        actionOrderIndex,
        scenario,
        actionResolutionById,
        pending: pendingCooldownReductionTransactions,
      });
      settleCooldownReductionTransactions({
        pending: pendingCooldownReductionTransactions,
        settled: cooldownReductionTransactions,
        cooldownStateBySkillOwner,
        cooldownWindows,
        throughTimeMs: Number(action.startMs) || 0,
        boundaryAction: null,
      });
      continue;
    }
    let evaluation = createActionCooldownEvaluation({
      action,
      ownerKind,
      ownerId,
      baseCooldown,
      scenario,
      priorCooldownWindows: cooldownWindows,
      adapter: cooldownEvaluationAdapter,
    });
    if (!evaluation) {
      continue;
    }
    const verifiedKiboEvaluation = cooldownModifierSession.evaluate({
      action,
      ownerKind,
      ownerId,
      baseCooldown: evaluation.base,
      currentEffectiveCooldown: evaluation.effective,
    });
    evaluation = applyVerifiedKiboCooldownEvaluation({
      evaluation,
      verifiedKiboEvaluation,
    });
    const cooldown = {
      ...baseCooldown,
      cooldownMs: evaluation.effective.durationMs,
      cooldownCount: evaluation.effective.chargeCount,
      evaluation,
    };
    const cooldownIdentity = cooldown.source?.subSkillId ?? action.skillId;
    const key = `${ownerKind}|${runtimeOwnerIdentity}|${cooldownIdentity}`;
    const state =
      cooldownStateBySkillOwner.get(key) ??
      createSkillCooldownState(cooldown, {
        key,
        action,
        ownerKind,
        ownerId,
        runtimeOwnerIdentity,
        cooldownIdentity,
      });
    cooldownStateBySkillOwner.set(key, state);
    settleSkillCooldownStateToTime({
      state,
      timeMs: Number(action.startMs) || 0,
      cooldownWindows,
    });
    const cooldownStateBefore = snapshotSkillCooldownState(state);
    const availableCount = getAvailableCooldownCount(state, action.startMs);
    const blocking = getBlockingCooldownState(state, action.startMs);
    if (availableCount === 0 && blocking) {
      diagnostics.push({
        schemaVersion: 1,
        id: createDiagnosticId(
          ACTION_RULE_CODES.SKILL_COOLDOWN_ACTIVE,
          action.id,
          blocking.sourceActionId
        ),
        code: ACTION_RULE_CODES.SKILL_COOLDOWN_ACTIVE,
        ruleKey: 'skill-logic-cooldown',
        status: ACTION_RULE_STATUSES.VIOLATED,
        severity: 'error',
        actionId: action.id,
        actionIds: [blocking.sourceActionId, action.id],
        actionName: action.name,
        actorId: action.actorId,
        actorName: action.actor?.name ?? action.actorId,
        ownerKind,
        ownerId,
        runtimeOwnerIdentity,
        kiboId: action.kiboId ?? null,
        blockingActionId: blocking.sourceActionId,
        blockingActionName: blocking.sourceActionName,
        timeMs: action.startMs,
        cooldownMs: cooldown.cooldownMs,
        baseCooldownMs: evaluation.base.durationMs,
        effectiveCooldownMs: evaluation.effective.durationMs,
        cooldownCount: cooldown.cooldownCount,
        readyAtMs: blocking.readyAtMs,
        remainingMs: blocking.readyAtMs - action.startMs,
        suggestedStartMs: blocking.readyAtMs,
        editFieldKey: 'startMs',
        message: `${action.name} 可用次数已耗尽，尚有 ${blocking.readyAtMs - action.startMs}ms 冷却`,
        source: cooldown.source,
        cooldownEvaluation: evaluation,
        appliedToSimulationResults: false,
      });
      snapshotsByActionId.set(
        action.id,
        createCooldownReadinessSnapshot({
          action,
          cooldown,
          status: 'blocked-no-charge-ready',
          cooldownStateBefore,
          cooldownStateAfter: cooldownStateBefore,
          consumedChargeIndex: null,
          windowId: null,
          cooldownReductionTransactions: state.cooldownReductionTransactions,
        })
      );
      cooldownStateBySkillOwner.set(key, state);
      continue;
    }

    const consumption = consumeSkillCooldownAvailability({
      state,
      action,
      actionOrderIndex,
      cooldown,
      evaluation,
      cooldownWindows,
    });
    const window = consumption.window;
    const cooldownPolicy = {
      setCd: true,
      source: cooldown.source?.sourceKind ?? 'positive-cooldown-requirement',
    };
    const passiveTransitions = cooldownModifierSession.onActionAccepted({
      action,
      ownerKind,
      ownerId,
      actionOrderIndex,
      cooldownPolicy,
    });
    const acceptedSkillStartTransition = createAcceptedSkillStartTransition({
      action,
      ownerKind,
      ownerId,
      actionOrderIndex,
      cooldownPolicy,
      cooldownWindowId: window?.windowId ?? null,
      passiveTransitions,
    });
    if (window) {
      window.acceptedSkillStartTransition ??= acceptedSkillStartTransition;
      window.acceptedSkillStartTransitions = [
        ...(window.acceptedSkillStartTransitions ?? []),
        acceptedSkillStartTransition,
      ];
    }
    acceptedSkillStartTransitions.push(acceptedSkillStartTransition);
    snapshotsByActionId.set(
      action.id,
      createCooldownReadinessSnapshot({
        action,
        cooldown,
        status: 'cooldown-charge-consumed',
        cooldownStateBefore,
        cooldownStateAfter: snapshotSkillCooldownState(state),
        consumedChargeIndex: consumption.consumedChargeIndex,
        windowId: window?.windowId ?? null,
        cooldownReductionTransactions: state.cooldownReductionTransactions,
      })
    );
    cooldownStateBySkillOwner.set(key, state);
    enqueueAcceptedCooldownReductionTransactions({
      action,
      actionOrderIndex,
      scenario,
      actionResolutionById,
      pending: pendingCooldownReductionTransactions,
    });
    settleCooldownReductionTransactions({
      pending: pendingCooldownReductionTransactions,
      settled: cooldownReductionTransactions,
      cooldownStateBySkillOwner,
      cooldownWindows,
      throughTimeMs: Number(action.startMs) || 0,
      boundaryAction: null,
    });
  }
  settleCooldownReductionTransactions({
    pending: pendingCooldownReductionTransactions,
    settled: cooldownReductionTransactions,
    cooldownStateBySkillOwner,
    cooldownWindows,
    throughTimeMs:
      Number(scenario?.time?.durationMs) || Number.POSITIVE_INFINITY,
    boundaryAction: null,
  });
  settleAllCooldownStatesToTime({
    cooldownStateBySkillOwner,
    cooldownWindows,
    timeMs: Number(scenario?.time?.durationMs) || 0,
  });
  return {
    diagnostics,
    snapshotsByActionId,
    acceptedSkillStartTransitions,
    cooldownModifierSession: cooldownModifierSession.snapshot(),
    cooldownReductionTransactions,
    cooldownState: [...cooldownStateBySkillOwner.values()].map(state => ({
      key: state.key,
      ownerKind: state.ownerKind,
      ownerId: state.ownerId,
      runtimeOwnerIdentity: state.runtimeOwnerIdentity,
      skillId: state.skillId,
      cooldownIdentity: state.cooldownIdentity,
      cooldownType: state.cooldownType,
      fullCooldownMs: state.fullCooldownMs,
      chargeMaxCount: state.chargeMaxCount ?? null,
      currentChargeCount: state.currentChargeCount ?? null,
      coolTimeMs: state.coolTimeMs ?? null,
      sharedTimerRunning: state.sharedTimerRunning ?? false,
      nextReadyAtMs: getNextCooldownReadyAtMs(state),
      lastSettlementTimeMs: state.lastSettlementTimeMs ?? null,
      lastSettlementIdentity: state.lastSettlementIdentity ?? null,
      lastCooldownReductionTransactionId:
        state.lastCooldownReductionTransactionId ?? null,
      missingChargeSourceActionIds: (state.missingChargeSources ?? []).map(
        source => source.actionId
      ),
      charges:
        state.cooldownType === 'single'
          ? cloneCooldownCharges(state.charges)
          : [],
      cooldownReductionTransactions: [...state.cooldownReductionTransactions],
    })),
    cooldownWindows: cooldownWindows.sort(
      (left, right) =>
        left.startMs - right.startMs ||
        left.endMs - right.endMs ||
        left.actionOrderIndex - right.actionOrderIndex
    ),
  };
}

function enqueueAcceptedCooldownReductionTransactions({
  action,
  actionOrderIndex,
  scenario,
  actionResolutionById = null,
  pending,
}) {
  if (action.type !== ACTION_TYPES.SKILL || !action.actorId) return;
  const resolution =
    actionResolutionById?.get?.(action.id) ??
    resolveVerifiedCombatActionMechanics(action, {
      combatScenario: scenario?.combatScenario,
    });
  const frameRate = Number(resolution?.controlBinding?.frameRate) || 60;
  for (const [effectIndex, effect] of (resolution?.effects ?? []).entries()) {
    const reduction = effect.cooldownReduction;
    const rawValue = Number(reduction?.valueByLevel?.['1']);
    if (
      Number(reduction?.recoverType) !== 3 ||
      !Number.isFinite(rawValue) ||
      rawValue >= 0
    ) {
      continue;
    }
    const triggerFrame = Number(effect.trigger?.startFrame);
    if (!Number.isInteger(triggerFrame) || triggerFrame < 0) continue;
    const sourceSequencePath = createVerifiedEffectSourceSequencePath({
      action,
      effect,
      phase: 'settlement',
      localSequenceSuffix: [effectIndex],
    }) ?? [Number(actionOrderIndex), 20, effectIndex];
    pending.push({
      schemaVersion: 1,
      sourceKind: 'azpr-cooldown-reduction-transaction',
      status: 'cooldown-reduction-transaction-pending',
      eventIdentity: `cooldown-reduction|${action.id}|${effect.effectIdentity ?? effect.elementId}|${effectIndex}`,
      timeMs: resolveActionFrameTimeMs(action, triggerFrame, frameRate),
      sourceActionId: action.id,
      sourceActionName: action.name ?? action.id,
      sourceActorId: action.actorId,
      sourceSkillId: Number(action.skillId),
      sourceEffectIdentity: effect.effectIdentity ?? null,
      sourceElementId: Number(effect.elementId),
      triggerFrame,
      frameRate,
      recoverType: 3,
      slot: Number(reduction.slot),
      cdRecoveryType: Number(reduction.cdRecoveryType),
      rawValue,
      reductionMs: -rawValue * 1000,
      sourceSequencePath,
      sourceSequenceStatus: Array.isArray(sourceSequencePath)
        ? 'verified-cooldown-reduction-source-sequence-ready'
        : 'verified-cooldown-reduction-source-sequence-unresolved',
      sourceIdentity: effect.sourceIdentity ?? null,
      appliedToSimulationResults: false,
      consumed: false,
    });
  }
  pending.sort(compareCooldownReductionTransactions);
}

function resolveActionFrameTimeMs(action, relativeFrame, frameRate) {
  const resolvedFrameRate = Number(frameRate) || 60;
  const actionStartFrame = Number.isInteger(Number(action.startFrame))
    ? Number(action.startFrame)
    : Math.round(((Number(action.startMs) || 0) * resolvedFrameRate) / 1000);
  return Number(
    (((actionStartFrame + relativeFrame) * 1000) / resolvedFrameRate).toFixed(6)
  );
}

function settleCooldownReductionTransactions({
  pending,
  settled,
  cooldownStateBySkillOwner,
  cooldownWindows,
  throughTimeMs,
  boundaryAction,
}) {
  while (
    pending.length > 0 &&
    isCooldownReductionTransactionDue(pending[0], throughTimeMs, boundaryAction)
  ) {
    const transaction = pending.shift();
    const result = applyCooldownReductionTransaction({
      transaction,
      cooldownStateBySkillOwner,
      cooldownWindows,
    });
    settled.push(result);
  }
}

function isCooldownReductionTransactionDue(
  transaction,
  throughTimeMs,
  boundaryAction
) {
  if (transaction.timeMs < throughTimeMs) return true;
  if (transaction.timeMs > throughTimeMs) return false;
  if (!boundaryAction) return true;
  const boundaryPath = getActionSourceSequencePath(boundaryAction);
  return (
    compareSourceSequencePaths(transaction.sourceSequencePath, boundaryPath) <=
    0
  );
}

function applyCooldownReductionTransaction({
  transaction,
  cooldownStateBySkillOwner,
  cooldownWindows,
}) {
  settleAllCooldownStatesToTime({
    cooldownStateBySkillOwner,
    cooldownWindows,
    timeMs: transaction.timeMs,
  });
  const runtimeOwnerIdentity = `actor:${String(transaction.sourceActorId)}`;
  let candidates = [...cooldownStateBySkillOwner.values()].filter(
    state =>
      state.ownerKind === 'actor' &&
      state.runtimeOwnerIdentity === runtimeOwnerIdentity &&
      Number(state.skillId) !== Number(transaction.sourceSkillId) &&
      hasActiveCooldownAtTime(state, transaction.timeMs)
  );
  if (transaction.slot !== -1) {
    candidates = candidates.filter(
      state => Number(state.skillSlot) === Number(transaction.slot)
    );
  }
  if (candidates.length !== 1) {
    return {
      ...transaction,
      status:
        candidates.length === 0
          ? 'cooldown-reduction-transaction-consumed-no-active-target'
          : 'cooldown-reduction-transaction-consumed-ambiguous-target',
      targetResolutionStatus:
        candidates.length === 0
          ? 'no-active-cooldown-at-effect-time'
          : 'multiple-active-cooldowns-at-effect-time',
      candidateSkillIds: candidates.map(state => state.skillId),
      appliedToSimulationResults: false,
      consumed: true,
    };
  }
  if (transaction.cdRecoveryType !== 0) {
    return {
      ...transaction,
      status: 'cooldown-reduction-transaction-consumed-unsupported-mode',
      targetResolutionStatus: 'cooldown-recovery-mode-not-fixed',
      targetSkillId: candidates[0].skillId,
      appliedToSimulationResults: false,
      consumed: true,
    };
  }
  const state = candidates[0];
  if (state.cooldownType === 'charge') {
    return applySharedChargeCooldownReduction({
      state,
      transaction,
      cooldownWindows,
    });
  }
  const targetCharge = state.charges
    .filter(
      charge =>
        charge.readyAtMs > transaction.timeMs + ACTION_BOUNDARY_EPSILON_MS
    )
    .sort(compareCooldownCharges)[0];
  if (!targetCharge) {
    return {
      ...transaction,
      status: 'cooldown-reduction-transaction-consumed-no-active-target',
      targetResolutionStatus: 'no-active-charge-at-effect-time',
      targetSkillId: state.skillId,
      appliedToSimulationResults: false,
      consumed: true,
    };
  }
  const beforeReadyAtMs = targetCharge.readyAtMs;
  const afterReadyAtMs = Math.max(
    transaction.timeMs,
    beforeReadyAtMs - transaction.reductionMs
  );
  targetCharge.readyAtMs = afterReadyAtMs;
  targetCharge.cooldownReductionMs =
    (Number(targetCharge.cooldownReductionMs) || 0) +
    (beforeReadyAtMs - afterReadyAtMs);
  targetCharge.cooldownReductionSourceActionIds = [
    ...(targetCharge.cooldownReductionSourceActionIds ?? []),
    transaction.sourceActionId,
  ];
  targetCharge.cooldownReductionTransactionIds = [
    ...(targetCharge.cooldownReductionTransactionIds ?? []),
    transaction.eventIdentity,
  ];
  const window = cooldownWindows.find(
    candidate => candidate.windowId === targetCharge.windowId
  );
  if (window) {
    window.endMs = afterReadyAtMs;
    window.durationMs = Math.max(0, afterReadyAtMs - window.startMs);
    window.status =
      afterReadyAtMs <= transaction.timeMs
        ? 'skill-cooldown-window-reset-by-transaction'
        : 'skill-cooldown-window-reduced-by-transaction';
    window.cooldownReductionTransactionIds = [
      ...(window.cooldownReductionTransactionIds ?? []),
      transaction.eventIdentity,
    ];
  }
  const result = {
    ...transaction,
    status: 'cooldown-reduction-transaction-applied',
    targetResolutionStatus: 'single-active-cooldown-resolved',
    targetSkillId: state.skillId,
    targetCooldownIdentity: state.cooldownIdentity,
    targetChargeIndex: targetCharge.chargeIndex,
    targetWindowId: targetCharge.windowId ?? null,
    beforeReadyAtMs,
    afterReadyAtMs,
    appliedReductionMs: beforeReadyAtMs - afterReadyAtMs,
    restoredChargeCount: afterReadyAtMs <= transaction.timeMs ? 1 : 0,
    appliedToSimulationResults: true,
    consumed: true,
  };
  state.lastSettlementTimeMs = transaction.timeMs;
  state.lastSettlementIdentity = transaction.eventIdentity;
  state.lastCooldownReductionTransactionId = transaction.eventIdentity;
  state.cooldownReductionTransactions.push(result);
  return result;
}

function hasActiveCooldownAtTime(state, timeMs) {
  return state.cooldownType === 'charge'
    ? state.currentChargeCount < state.chargeMaxCount &&
        state.sharedTimerRunning &&
        state.coolTimeMs > 0
    : state.charges.some(
        charge => charge.readyAtMs > timeMs + ACTION_BOUNDARY_EPSILON_MS
      );
}

function applySharedChargeCooldownReduction({
  state,
  transaction,
  cooldownWindows,
}) {
  const beforeChargeCount = state.currentChargeCount;
  const beforeCoolTimeMs = state.coolTimeMs;
  const beforeSharedTimerRunning = state.sharedTimerRunning === true;
  const beforeReadyAtMs = Number(
    (transaction.timeMs + beforeCoolTimeMs).toFixed(6)
  );
  const targetWindow = findActiveSharedChargeWindow(state, cooldownWindows);
  const targetWindowId = targetWindow?.windowId ?? null;
  const appliedReductionMs = Math.min(
    beforeCoolTimeMs,
    transaction.reductionMs
  );
  const remainingCoolTimeMs = Math.max(
    0,
    beforeCoolTimeMs - transaction.reductionMs
  );
  let restoredChargeCount = 0;
  let afterReadyAtMs;
  if (remainingCoolTimeMs <= ACTION_BOUNDARY_EPSILON_MS) {
    completeSharedChargeWindow({
      state,
      cooldownWindows,
      endMs: transaction.timeMs,
      status: 'skill-charge-cooldown-cycle-reset-by-transaction',
    });
    state.missingChargeSources.shift();
    state.currentChargeCount = Math.min(
      state.chargeMaxCount,
      state.currentChargeCount + 1
    );
    state.coolTimeMs = state.fullCooldownMs;
    restoredChargeCount = 1;
    afterReadyAtMs = transaction.timeMs;
    if (state.currentChargeCount < state.chargeMaxCount) {
      state.sharedTimerRunning = true;
      openSharedChargeWindow({
        state,
        cooldownWindows,
        startMs: transaction.timeMs,
        source: state.missingChargeSources[0],
      });
    } else {
      state.sharedTimerRunning = false;
    }
  } else {
    state.coolTimeMs = remainingCoolTimeMs;
    state.sharedTimerRunning = true;
    afterReadyAtMs = Number(
      (transaction.timeMs + remainingCoolTimeMs).toFixed(6)
    );
    if (targetWindow) {
      targetWindow.endMs = afterReadyAtMs;
      targetWindow.durationMs = Math.max(
        0,
        afterReadyAtMs - targetWindow.startMs
      );
      targetWindow.status =
        'skill-charge-cooldown-cycle-reduced-by-transaction';
    }
  }
  if (targetWindow) {
    targetWindow.cooldownReductionTransactionIds = [
      ...(targetWindow.cooldownReductionTransactionIds ?? []),
      transaction.eventIdentity,
    ];
  }
  state.lastSettlementTimeMs = transaction.timeMs;
  state.lastSettlementIdentity = transaction.eventIdentity;
  state.lastCooldownReductionTransactionId = transaction.eventIdentity;
  const result = {
    ...transaction,
    status: 'cooldown-reduction-transaction-applied',
    targetResolutionStatus: 'single-active-shared-charge-timer-resolved',
    targetSkillId: state.skillId,
    targetCooldownIdentity: state.cooldownIdentity,
    targetChargeIndex: null,
    targetWindowId,
    cooldownType: 'charge',
    beforeChargeCount,
    afterChargeCount: state.currentChargeCount,
    beforeCoolTimeMs,
    afterCoolTimeMs: state.coolTimeMs,
    beforeSharedTimerRunning,
    afterSharedTimerRunning: state.sharedTimerRunning === true,
    beforeReadyAtMs,
    afterReadyAtMs,
    nextReadyAtMs: getNextCooldownReadyAtMs(state),
    appliedReductionMs,
    discardedReductionMs: Math.max(
      0,
      transaction.reductionMs - appliedReductionMs
    ),
    restoredChargeCount,
    appliedToSimulationResults: true,
    consumed: true,
  };
  state.cooldownReductionTransactions.push(result);
  return result;
}

function compareCooldownReductionTransactions(left, right) {
  return (
    Number(left.timeMs) - Number(right.timeMs) ||
    compareSourceSequencePaths(
      left.sourceSequencePath,
      right.sourceSequencePath
    ) ||
    String(left.eventIdentity).localeCompare(String(right.eventIdentity))
  );
}

function applyVerifiedKiboCooldownEvaluation({
  evaluation,
  verifiedKiboEvaluation,
}) {
  if (
    !verifiedKiboEvaluation ||
    verifiedKiboEvaluation.status ===
      'verified-kibo-cooldown-modifier-not-applicable'
  ) {
    return evaluation;
  }
  const effectiveDurationMs = Number(
    verifiedKiboEvaluation.effectiveDurationMs
  );
  const durationChanged =
    Number.isFinite(effectiveDurationMs) &&
    effectiveDurationMs !== evaluation.effective.durationMs;
  const modifiers = [
    ...(evaluation.modifiers ?? []),
    ...(verifiedKiboEvaluation.modifiers ?? []),
  ];
  return {
    ...evaluation,
    status:
      durationChanged || modifiers.length > 0
        ? 'cooldown-evaluation-adapted'
        : evaluation.status,
    upstreamStatus: evaluation.status,
    effective: {
      ...evaluation.effective,
      durationMs: Number.isFinite(effectiveDurationMs)
        ? effectiveDurationMs
        : evaluation.effective.durationMs,
    },
    modifiers,
    appliedModifierCount: modifiers.length,
    verifiedKiboPassiveCooldown: verifiedKiboEvaluation,
  };
}

function createAcceptedSkillStartTransition({
  action,
  ownerKind,
  ownerId,
  actionOrderIndex,
  cooldownPolicy,
  cooldownWindowId,
  passiveTransitions,
}) {
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-accepted-skill-start-transition',
    status: 'accepted-skill-start',
    actionId: action.id,
    actionName: action.name ?? action.id,
    actionOrderIndex,
    orderKey: `${Number(action.startMs) || 0}|${actionOrderIndex}`,
    timeMs: Number(action.startMs) || 0,
    actorId: action.actorId ?? null,
    ownerKind,
    ownerId,
    runtimeOwnerIdentity: createCooldownRuntimeOwnerIdentity({
      action,
      ownerKind,
      ownerId,
    }),
    kiboId: action.kiboId ?? null,
    skillId: action.skillId ?? null,
    cooldownPolicy,
    cooldownWindowId,
    passiveTransitions,
    appliedToSimulationResults: true,
  };
}

function createKiboCooldownSessionDiagnostics(session) {
  return (session?.unresolvedTransitions ?? []).map(transition => ({
    schemaVersion: 1,
    id: createDiagnosticId(
      ACTION_RULE_CODES.KIBO_PASSIVE_SKILL_TAG_UNRESOLVED,
      transition.actionId,
      transition.passiveSkillId,
      transition.sourceElementId
    ),
    code: ACTION_RULE_CODES.KIBO_PASSIVE_SKILL_TAG_UNRESOLVED,
    ruleKey: 'verified-kibo-passive-accepted-skill-start-condition',
    status: ACTION_RULE_STATUSES.UNRESOLVED,
    severity: 'warning',
    actionId: transition.actionId,
    actionIds: [transition.actionId],
    actionName: transition.actionName,
    actorId: transition.actorId,
    ownerKind: transition.ownerKind,
    ownerId: transition.ownerId,
    kiboId: transition.kiboId,
    timeMs: transition.timeMs,
    message: `${transition.actionName ?? transition.actionId} 已通过动作准入，但奇波被动 ${transition.passiveSkillId} 的真实 skillTag 无法解析，未增加冷却层数`,
    source: {
      sourceKind: 'azpr-kibo-passive-mechanics-catalog',
      sourceStatus: transition.reason,
      passiveSkillId: transition.passiveSkillId,
      sourceElementId: transition.sourceElementId,
      skillTagSource: transition.skillTagSource,
      provenance: transition.provenance,
    },
    appliedToSimulationResults: true,
  }));
}

function createSkillCooldownState(
  cooldown,
  { key, action, ownerKind, ownerId, runtimeOwnerIdentity, cooldownIdentity }
) {
  const cooldownType = cooldown.cooldownCount > 1 ? 'charge' : 'single';
  const common = {
    key,
    ownerKind,
    ownerId,
    runtimeOwnerIdentity,
    cooldownIdentity,
    skillId: Number(action.skillId),
    skillSlot: finiteNumberOrNull(
      action.skillSlot ?? action.slot ?? action.logicModel?.logic?.slot
    ),
    cooldownType,
    fullCooldownMs: cooldown.cooldownMs,
    lastSettlementTimeMs: 0,
    lastSettlementIdentity: 'cooldown-state-initialized',
    lastCooldownReductionTransactionId: null,
    cooldownReductionTransactions: [],
  };
  if (cooldownType === 'charge') {
    return {
      ...common,
      chargeMaxCount: cooldown.cooldownCount,
      currentChargeCount: cooldown.cooldownCount,
      coolTimeMs: 0,
      sharedTimerRunning: false,
      activeWindowId: null,
      windowSequence: 0,
      missingChargeSources: [],
      charges: [],
    };
  }
  return {
    ...common,
    maxCharges: 1,
    charges: Array.from({ length: 1 }, (_, chargeIndex) => ({
      chargeIndex,
      readyAtMs: 0,
      sourceActionId: null,
      sourceActionName: null,
    })),
  };
}

function createCooldownReadinessSnapshot({
  action,
  cooldown,
  status,
  cooldownStateBefore,
  cooldownStateAfter,
  consumedChargeIndex,
  windowId,
  cooldownReductionTransactions = [],
}) {
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-action-cooldown-readiness',
    status,
    cooldownMs: cooldown.cooldownMs,
    baseCooldownMs: cooldown.evaluation.base.durationMs,
    effectiveCooldownMs: cooldown.evaluation.effective.durationMs,
    cooldownCount: cooldown.cooldownCount,
    ownerKind: action.type === ACTION_TYPES.KIBO_EVENT ? 'kibo' : 'actor',
    ownerId:
      action.type === ACTION_TYPES.KIBO_EVENT ? action.kiboId : action.actorId,
    runtimeOwnerIdentity: createCooldownRuntimeOwnerIdentity({
      action,
      ownerKind: action.type === ACTION_TYPES.KIBO_EVENT ? 'kibo' : 'actor',
      ownerId:
        action.type === ACTION_TYPES.KIBO_EVENT
          ? action.kiboId
          : action.actorId,
    }),
    kiboId: action.kiboId ?? null,
    skillId: action.skillId ?? null,
    cooldownType: cooldownStateAfter.cooldownType,
    availableBefore: cooldownStateBefore.availableCount,
    availableAfter: cooldownStateAfter.availableCount,
    consumedChargeIndex,
    nextReadyAtMs: cooldownStateAfter.nextReadyAtMs,
    chargesBefore: cooldownStateBefore.charges ?? [],
    chargesAfter: cooldownStateAfter.charges ?? [],
    chargeStateBefore:
      cooldownStateBefore.cooldownType === 'charge'
        ? cooldownStateBefore
        : null,
    chargeStateAfter:
      cooldownStateAfter.cooldownType === 'charge' ? cooldownStateAfter : null,
    windowId,
    cooldownReductionTransactions: [...cooldownReductionTransactions],
    source: cooldown.source,
    sourceIdentity: cooldown.sourceIdentity,
    confidence: cooldown.confidence,
    cooldownEvaluation: cooldown.evaluation,
    modifierCount: cooldown.evaluation.appliedModifierCount,
    trackingStatus: 'applied-to-readiness',
    appliedToSimulationResults: false,
  };
}

function settleAllCooldownStatesToTime({
  cooldownStateBySkillOwner,
  cooldownWindows,
  timeMs,
}) {
  for (const state of cooldownStateBySkillOwner.values()) {
    settleSkillCooldownStateToTime({ state, timeMs, cooldownWindows });
  }
}

function settleSkillCooldownStateToTime({ state, timeMs, cooldownWindows }) {
  if (state.cooldownType !== 'charge') return;
  const targetTimeMs = Math.max(
    Number(state.lastSettlementTimeMs) || 0,
    Number(timeMs) || 0
  );
  let cursorMs = Number(state.lastSettlementTimeMs) || 0;
  let elapsedMs = targetTimeMs - cursorMs;
  if (
    state.currentChargeCount >= state.chargeMaxCount ||
    !(state.coolTimeMs > 0)
  ) {
    state.sharedTimerRunning = false;
    state.lastSettlementTimeMs = targetTimeMs;
    return;
  }
  state.sharedTimerRunning = true;
  while (
    elapsedMs + ACTION_BOUNDARY_EPSILON_MS >= state.coolTimeMs &&
    state.currentChargeCount < state.chargeMaxCount
  ) {
    const recoveryTimeMs = Number((cursorMs + state.coolTimeMs).toFixed(6));
    const recoveredSource = state.missingChargeSources.shift() ?? null;
    completeSharedChargeWindow({
      state,
      cooldownWindows,
      endMs: recoveryTimeMs,
      status: 'skill-charge-cooldown-cycle-completed-naturally',
    });
    state.currentChargeCount += 1;
    state.coolTimeMs = state.fullCooldownMs;
    state.lastSettlementTimeMs = recoveryTimeMs;
    state.lastSettlementIdentity = `cooldown-natural-recovery|${state.cooldownIdentity}`;
    cursorMs = recoveryTimeMs;
    elapsedMs = Math.max(0, targetTimeMs - cursorMs);
    if (state.currentChargeCount < state.chargeMaxCount) {
      openSharedChargeWindow({
        state,
        cooldownWindows,
        startMs: recoveryTimeMs,
        source: state.missingChargeSources[0] ?? recoveredSource,
      });
    } else {
      state.sharedTimerRunning = false;
    }
  }
  if (state.currentChargeCount < state.chargeMaxCount) {
    state.coolTimeMs = Math.max(0, state.coolTimeMs - elapsedMs);
    state.sharedTimerRunning = true;
  }
  state.lastSettlementTimeMs = targetTimeMs;
}

function consumeSkillCooldownAvailability({
  state,
  action,
  actionOrderIndex,
  cooldown,
  evaluation,
  cooldownWindows,
}) {
  if (state.cooldownType === 'charge') {
    state.currentChargeCount -= 1;
    const source = createSharedChargeSource({
      action,
      actionOrderIndex,
      cooldown,
      evaluation,
    });
    state.missingChargeSources.push(source);
    if (!(state.coolTimeMs > 0)) {
      state.fullCooldownMs = cooldown.cooldownMs;
      state.coolTimeMs = cooldown.cooldownMs;
    }
    state.sharedTimerRunning = true;
    state.lastSettlementTimeMs = Number(action.startMs) || 0;
    state.lastSettlementIdentity = `cooldown-charge-cast|${action.id}`;
    if (!state.activeWindowId) {
      openSharedChargeWindow({
        state,
        cooldownWindows,
        startMs: Number(action.startMs) || 0,
        source: state.missingChargeSources[0],
      });
    }
    return {
      consumedChargeIndex: null,
      window: findActiveSharedChargeWindow(state, cooldownWindows),
    };
  }

  const consumedCharge = state.charges
    .filter(
      charge => charge.readyAtMs <= action.startMs + ACTION_BOUNDARY_EPSILON_MS
    )
    .sort((left, right) => left.chargeIndex - right.chargeIndex)[0];
  const readyAtMs = action.startMs + cooldown.cooldownMs;
  const windowId = `${action.id}|cooldown-charge|${consumedCharge.chargeIndex}`;
  state.charges = state.charges.map(charge =>
    charge.chargeIndex === consumedCharge.chargeIndex
      ? {
          ...charge,
          readyAtMs,
          sourceActionId: action.id,
          sourceActionName: action.name,
          windowId,
        }
      : charge
  );
  state.lastSettlementTimeMs = Number(action.startMs) || 0;
  state.lastSettlementIdentity = `cooldown-cast|${action.id}`;
  const window = {
    schemaVersion: 1,
    sourceKind: 'azpr-skill-cooldown-window',
    status: 'skill-cooldown-window-active',
    windowId,
    actionId: action.id,
    actionName: action.name,
    actorId: action.actorId,
    actorName: action.actor?.name ?? action.actorId,
    ownerKind: state.ownerKind,
    ownerId: state.ownerId,
    runtimeOwnerIdentity: state.runtimeOwnerIdentity,
    kiboId: action.kiboId ?? null,
    skillId: action.skillId,
    actionOrderIndex,
    chargeIndex: consumedCharge.chargeIndex,
    cooldownCount: cooldown.cooldownCount,
    cooldownType: 'single',
    startMs: action.startMs,
    endMs: readyAtMs,
    durationMs: cooldown.cooldownMs,
    baseDurationMs: evaluation.base.durationMs,
    effectiveDurationMs: evaluation.effective.durationMs,
    source: cooldown.source,
    sourceIdentity: cooldown.sourceIdentity,
    confidence: cooldown.confidence,
    cooldownEvaluation: evaluation,
    modifierCount: evaluation.appliedModifierCount,
    trackingStatus: 'applied-to-readiness',
    appliedToSimulationResults: false,
  };
  cooldownWindows.push(window);
  return { consumedChargeIndex: consumedCharge.chargeIndex, window };
}

function createSharedChargeSource({
  action,
  actionOrderIndex,
  cooldown,
  evaluation,
}) {
  return {
    actionId: action.id,
    actionName: action.name,
    actorId: action.actorId,
    actorName: action.actor?.name ?? action.actorId,
    kiboId: action.kiboId ?? null,
    skillId: action.skillId,
    actionOrderIndex,
    cooldown,
    evaluation,
  };
}

function openSharedChargeWindow({ state, cooldownWindows, startMs, source }) {
  if (!source || state.activeWindowId) return;
  state.windowSequence += 1;
  const windowId = `${state.runtimeOwnerIdentity}|${state.cooldownIdentity}|charge-cycle|${state.windowSequence}`;
  const window = {
    schemaVersion: 1,
    sourceKind: 'azpr-shared-charge-cooldown-window',
    status: 'skill-charge-cooldown-cycle-active',
    windowId,
    actionId: source.actionId,
    actionName: source.actionName,
    actorId: source.actorId,
    actorName: source.actorName,
    ownerKind: state.ownerKind,
    ownerId: state.ownerId,
    runtimeOwnerIdentity: state.runtimeOwnerIdentity,
    kiboId: source.kiboId,
    skillId: state.skillId,
    actionOrderIndex: source.actionOrderIndex,
    chargeIndex: null,
    cooldownCount: state.chargeMaxCount,
    cooldownType: 'charge',
    startMs,
    endMs: Number((startMs + state.coolTimeMs).toFixed(6)),
    durationMs: state.coolTimeMs,
    baseDurationMs: source.evaluation.base.durationMs,
    effectiveDurationMs: source.evaluation.effective.durationMs,
    source: source.cooldown.source,
    sourceIdentity: source.cooldown.sourceIdentity,
    confidence: source.cooldown.confidence,
    cooldownEvaluation: source.evaluation,
    modifierCount: source.evaluation.appliedModifierCount,
    trackingStatus: 'applied-to-readiness',
    appliedToSimulationResults: false,
  };
  state.activeWindowId = windowId;
  cooldownWindows.push(window);
}

function completeSharedChargeWindow({ state, cooldownWindows, endMs, status }) {
  const window = findActiveSharedChargeWindow(state, cooldownWindows);
  if (!window) return null;
  window.endMs = endMs;
  window.durationMs = Math.max(0, endMs - window.startMs);
  window.status = status;
  state.activeWindowId = null;
  return window;
}

function findActiveSharedChargeWindow(state, cooldownWindows) {
  return (
    cooldownWindows.find(window => window.windowId === state.activeWindowId) ??
    null
  );
}

function getAvailableCooldownCount(state, timeMs) {
  return state.cooldownType === 'charge'
    ? state.currentChargeCount
    : countAvailableCharges(state.charges, timeMs);
}

function getBlockingCooldownState(state, timeMs) {
  if (state.cooldownType === 'charge') {
    if (state.currentChargeCount > 0 || !state.sharedTimerRunning) return null;
    const source = state.missingChargeSources[0] ?? {};
    return {
      sourceActionId: source.actionId ?? null,
      sourceActionName: source.actionName ?? null,
      readyAtMs: getNextCooldownReadyAtMs(state),
    };
  }
  return (
    state.charges
      .filter(charge => charge.readyAtMs > timeMs + ACTION_BOUNDARY_EPSILON_MS)
      .sort(compareCooldownCharges)[0] ?? null
  );
}

function getNextCooldownReadyAtMs(state) {
  if (state.cooldownType === 'charge') {
    return state.sharedTimerRunning &&
      state.currentChargeCount < state.chargeMaxCount
      ? Number(
          (
            (Number(state.lastSettlementTimeMs) || 0) +
            (Number(state.coolTimeMs) || 0)
          ).toFixed(6)
        )
      : null;
  }
  return getNextReadyAtMs(state.charges, state.lastSettlementTimeMs);
}

function snapshotSkillCooldownState(state) {
  if (state.cooldownType === 'charge') {
    return {
      cooldownType: 'charge',
      fullCooldownMs: state.fullCooldownMs,
      chargeMaxCount: state.chargeMaxCount,
      currentChargeCount: state.currentChargeCount,
      availableCount: state.currentChargeCount,
      coolTimeMs: Number((Number(state.coolTimeMs) || 0).toFixed(6)),
      sharedTimerRunning: state.sharedTimerRunning === true,
      nextReadyAtMs: getNextCooldownReadyAtMs(state),
      lastSettlementTimeMs: state.lastSettlementTimeMs,
      lastSettlementIdentity: state.lastSettlementIdentity,
      lastCooldownReductionTransactionId:
        state.lastCooldownReductionTransactionId ?? null,
      activeWindowId: state.activeWindowId ?? null,
      missingChargeSourceActionIds: state.missingChargeSources.map(
        source => source.actionId
      ),
      cooldownReductionTransactionIds: state.cooldownReductionTransactions.map(
        transaction => transaction.eventIdentity
      ),
    };
  }
  return {
    cooldownType: 'single',
    fullCooldownMs: state.fullCooldownMs,
    availableCount: countAvailableCharges(
      state.charges,
      state.lastSettlementTimeMs
    ),
    nextReadyAtMs: getNextReadyAtMs(state.charges, state.lastSettlementTimeMs),
    lastSettlementTimeMs: state.lastSettlementTimeMs,
    lastSettlementIdentity: state.lastSettlementIdentity,
    lastCooldownReductionTransactionId:
      state.lastCooldownReductionTransactionId ?? null,
    charges: cloneCooldownCharges(state.charges),
    cooldownReductionTransactionIds: state.cooldownReductionTransactions.map(
      transaction => transaction.eventIdentity
    ),
  };
}

function createCooldownRuntimeOwnerIdentity({ action, ownerKind, ownerId }) {
  return ownerKind === 'kibo'
    ? `${String(action.actorId)}|kibo:${Number(action.kiboId)}`
    : `actor:${String(ownerId)}`;
}

function countAvailableCharges(charges, timeMs) {
  return charges.filter(
    charge => charge.readyAtMs <= timeMs + ACTION_BOUNDARY_EPSILON_MS
  ).length;
}

function getNextReadyAtMs(charges, timeMs) {
  return (
    charges
      .map(charge => charge.readyAtMs)
      .filter(readyAtMs => readyAtMs > timeMs + ACTION_BOUNDARY_EPSILON_MS)
      .sort((left, right) => left - right)[0] ?? null
  );
}

function cloneCooldownCharges(charges) {
  return charges.map(charge => ({ ...charge }));
}

function compareCooldownCharges(left, right) {
  return (
    left.readyAtMs - right.readyAtMs || left.chargeIndex - right.chargeIndex
  );
}

function createSkillSpPreconditionDiagnostics(actions, actors, scenario) {
  if (
    scenario?.mechanicsProfile?.profileId ===
    VERIFIED_WORKBENCH_MECHANICS_PROFILE_ID
  ) {
    return [];
  }
  const actorById = new Map(actors.map(actor => [actor.id, actor]));
  return actions
    .filter(action => action.type === ACTION_TYPES.SKILL && action.actorId)
    .map(action => {
      const requirement = createSkillSpRequirement(action);
      if (!requirement) {
        return null;
      }
      const actor = actorById.get(action.actorId) ?? action.actor ?? null;
      return {
        schemaVersion: 1,
        id: createDiagnosticId(
          ACTION_RULE_CODES.SKILL_SP_PRECONDITION_UNRESOLVED,
          action.id
        ),
        code: ACTION_RULE_CODES.SKILL_SP_PRECONDITION_UNRESOLVED,
        ruleKey: 'skill-logic-sp-precondition',
        status: ACTION_RULE_STATUSES.UNRESOLVED,
        severity: 'warning',
        actionId: action.id,
        actionIds: [action.id],
        actionName: action.name,
        actorId: action.actorId,
        actorName: actor?.name ?? action.actorId,
        timeMs: action.startMs,
        requiredSp: requirement.spCost,
        actorInitialSp: finiteNumberOrNull(actor?.initialSp),
        actorMaxSp: finiteNumberOrNull(actor?.stats?.maxSp),
        suggestedStartMs: null,
        editFieldKey: '',
        message: `${action.name} 需要 SP ${requirement.spCost}，当前 ${finiteNumberOrNull(actor?.initialSp) ?? 0}/${finiteNumberOrNull(actor?.stats?.maxSp) ?? '待定'}；当前机制配置未应用该消耗`,
        source: requirement.source,
        unresolved: ['skill-sp-cost-not-applied-by-selected-profile'],
        appliedToSimulationResults: false,
      };
    })
    .filter(Boolean);
}

function createSkillCooldownRequirement(action) {
  const verifiedActionMapping = getVerifiedCombatActionMapping(action);
  const verifiedControlSkillId = Number(verifiedActionMapping?.controlSkillId);
  const verifiedCooldown = verifiedActionMapping?.actionTiming?.cooldown;
  const verifiedCooldownMs = Number(verifiedCooldown?.cooldownMs);
  const directKiboControl =
    action.type === ACTION_TYPES.KIBO_EVENT &&
    verifiedActionMapping?.ownerKind === 'kibo';
  if (
    Number.isInteger(verifiedControlSkillId) &&
    (verifiedControlSkillId !== Number(action.skillId) || directKiboControl) &&
    verifiedCooldown?.status === 'applied' &&
    Number.isFinite(verifiedCooldownMs)
  ) {
    if (verifiedCooldownMs <= 0) {
      return null;
    }
    const cooldownCount = Math.max(
      1,
      Math.trunc(Number(verifiedCooldown.chargeCount) || 1)
    );
    return {
      cooldownMs: verifiedCooldownMs,
      cooldownCount,
      source: {
        sourceKind: 'azpr-verified-action-control-cooldown',
        sourceStatus: 'confirmed-control-variant-cooldown',
        fieldPath: verifiedCooldown.sourceIdentity ?? null,
        cooldownCount,
        subSkillId: verifiedControlSkillId,
      },
      sourceIdentity: {
        sourceKind: 'azpr-verified-action-control-cooldown',
        sourceStatus: 'confirmed-control-variant-cooldown',
        subSkillId: verifiedControlSkillId,
        durationFieldPath: verifiedCooldown.sourceIdentity ?? null,
        actionBindingIdentity: verifiedActionMapping.identity,
      },
      confidence: 'confirmed-structured-data',
    };
  }
  const generatedCooldown = action.statusGeneration?.cooldown;
  const generatedDurationMs = Number(generatedCooldown?.durationMs);
  if (
    generatedCooldown?.status === 'confirmed-cooldown' &&
    Number.isFinite(generatedDurationMs) &&
    generatedDurationMs > 0
  ) {
    const cooldownCount = Math.max(
      1,
      Math.trunc(Number(generatedCooldown.chargeCount) || 1)
    );
    return {
      cooldownMs: generatedDurationMs,
      cooldownCount,
      source: {
        sourceKind:
          generatedCooldown.sourceIdentity?.sourceKind ??
          'azpr-action-status-generation',
        sourceStatus: generatedCooldown.status,
        fieldPath: generatedCooldown.sourceIdentity?.durationFieldPath ?? null,
        cooldownCount,
        subSkillId:
          generatedCooldown.sourceIdentity?.subSkillId ?? action.skillId,
      },
      sourceIdentity: generatedCooldown.sourceIdentity ?? null,
      confidence: 'confirmed-structured-data',
    };
  }
  const logic = action.logicModel?.logic;
  const cooldownMs = Number(logic?.cooldownMs);
  if (!Number.isFinite(cooldownMs) || cooldownMs <= 0) {
    return null;
  }
  return {
    cooldownMs,
    cooldownCount: Math.max(1, Math.trunc(Number(logic.cooldownCount) || 1)),
    source: {
      sourceKind: logic.sourceKind ?? 'azpr-newtable-skill-logic-index',
      sourceStatus: action.logicModel?.status ?? 'mapped',
      fieldPath: logic.fieldPaths?.cooldownMs ?? null,
      cooldownCount: Math.max(1, Math.trunc(Number(logic.cooldownCount) || 1)),
      subSkillId: logic.subSkillId ?? action.skillId,
    },
    sourceIdentity: {
      sourceKind: logic.sourceKind ?? 'azpr-newtable-skill-logic-index',
      sourceStatus: action.logicModel?.status ?? 'mapped',
      subSkillId: logic.subSkillId ?? action.skillId,
      durationFieldPath: logic.fieldPaths?.cooldownMs ?? null,
      chargeCountFieldPath: logic.fieldPaths?.cooldownCount ?? null,
    },
    confidence: 'confirmed-structured-data',
  };
}

function createSkillSpRequirement(action) {
  const logic = action.logicModel?.logic;
  const spCost = Number(logic?.spCost);
  if (!Number.isFinite(spCost) || spCost <= 0) {
    return null;
  }
  return {
    spCost,
    source: {
      sourceKind: logic.sourceKind ?? 'azpr-newtable-skill-logic-index',
      sourceStatus: action.logicModel?.status ?? 'mapped',
      fieldPath: logic.fieldPaths?.spCost ?? null,
      subSkillId: logic.subSkillId ?? action.skillId,
    },
  };
}

function isBlockingActorAction(action) {
  return Boolean(action?.actorId) && action.type === ACTION_TYPES.SKILL;
}

function createActionRange(action) {
  const startMs = Math.max(0, Number(action.startMs) || 0);
  const durationMs =
    action.contextualEffectiveEndMs == null
      ? Math.max(1, Number(action.durationMs) || 1)
      : Math.max(0, Number(action.durationMs) || 0);
  return {
    actionId: action.id,
    actionName: action.name ?? action.id,
    actorId: action.actorId,
    actorName: action.actor?.name ?? action.actorId,
    startMs,
    endMs: startMs + durationMs,
    contextActionId:
      action.runtimeContextActionId ?? action.contextActionId ?? null,
    sourceSequenceIndex: action.sourceSequenceIndex ?? null,
    sourceSequencePath: action.sourceSequencePath ?? null,
  };
}

function createDiagnosticId(code, ...parts) {
  return [code, ...parts].map(value => String(value ?? 'none')).join('|');
}

function compareActions(left, right) {
  return (
    Number(left.startMs) - Number(right.startMs) ||
    compareActionSourceSequence(left, right)
  );
}

function compareRanges(left, right) {
  return (
    left.startMs - right.startMs ||
    left.endMs - right.endMs ||
    compareActionSourceSequence(left, right)
  );
}

function compareDiagnostics(left, right) {
  return (
    severityPriority(left.severity) - severityPriority(right.severity) ||
    Number(left.timeMs) - Number(right.timeMs) ||
    left.id.localeCompare(right.id)
  );
}

function severityPriority(severity) {
  return severity === 'error' ? 0 : severity === 'warning' ? 1 : 2;
}

function finiteNumberOrNull(value) {
  if (value == null || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function uniqueValues(values) {
  return [...new Set((values ?? []).filter(Boolean))];
}

function groupByKey(items, getKey) {
  const groups = new Map();
  for (const item of items ?? []) {
    const key = getKey(item);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  }
  return groups;
}

function msToFrame(timeMs, fps) {
  return Math.round((Number(timeMs) * (Number(fps) || 60)) / 1000);
}
