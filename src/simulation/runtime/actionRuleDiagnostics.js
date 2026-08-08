import { ACTION_TYPES } from '../../domain/projectSchema';
import { isFrameWithinVerifiedInputWindow } from '../../domain/verifiedActionContextScheduling';
import {
  compareActionSourceSequence,
  compareSourceSequencePaths,
  getActionSourceSequencePath,
} from '../../domain/actionSourceSequence';
import { createVerifiedEffectSourceSequencePath } from '../../domain/verifiedEffectSourceSequence';
import { VERIFIED_WORKBENCH_MECHANICS_PROFILE_ID } from '../../domain/workbenchMechanicsProfileSelection';
import {
  getVerifiedCombatActionMapping,
  getVerifiedCombatActionMappingByIdentity,
  resolveVerifiedCombatActionMechanics,
} from '../../data/verifiedCombatMechanicsPackage';
import { createActionCooldownEvaluation } from './actionCooldownEvaluation';
import { isSwitchTriggeredDerivedAction } from '../generation/switchTriggeredActionGeneration';
import { createVerifiedKiboCooldownModifierSession } from '../mechanics/verifiedKiboCooldownModifierSession';

export const ACTION_RULE_DIAGNOSTICS_CONTRACT_NAME =
  'AzPrActionRuleDiagnostics';
export const ACTION_READINESS_TIMELINE_CONTRACT_NAME =
  'AzPrActionReadinessTimeline';
const ACTION_BOUNDARY_EPSILON_MS = 0.001;

export const ACTION_RULE_CODES = Object.freeze({
  LANE_OVERLAP: 'action-lane-overlap',
  SWITCH_FRAME_CONFLICT: 'switch-frame-conflict',
  SKILL_COOLDOWN_ACTIVE: 'skill-cooldown-active',
  SKILL_SP_PRECONDITION_UNRESOLVED: 'skill-sp-precondition-unresolved',
  ATTACK_INPUT_CHAIN_INCOMPLETE: 'attack-input-chain-incomplete',
  ATTACK_INPUT_CHAIN_ORDER_INVALID: 'attack-input-chain-order-invalid',
  ATTACK_INPUT_LINK_TIMING_UNRESOLVED: 'attack-input-link-timing-unresolved',
  ATTACK_INPUT_LINK_TOO_EARLY: 'attack-input-link-too-early',
  ATTACK_INPUT_LINK_TOO_LATE: 'attack-input-link-too-late',
  ATTACK_INPUT_LEGACY_UNRESOLVED: 'attack-input-legacy-unresolved',
  JOINT_ATTACK_KIBO_REQUIRED: 'joint-attack-kibo-required',
  JOINT_ATTACK_PAIR_MISSING: 'joint-attack-pair-missing',
  JOINT_ATTACK_FRAME_MISMATCH: 'joint-attack-frame-mismatch',
  STAR_CARRY_SWITCH_TRIGGER_REQUIRED: 'star-carry-switch-trigger-required',
  KIBO_PASSIVE_SKILL_TAG_UNRESOLVED:
    'kibo-passive-cooldown-skill-tag-unresolved',
});

export const ACTION_RULE_STATUSES = Object.freeze({
  VIOLATED: 'violated',
  UNRESOLVED: 'unresolved',
});

export function createActionRuleDiagnostics({
  scenario = {},
  cooldownEvaluationAdapter = null,
  externallyBlockedActionIds = [],
} = {}) {
  const actions = [...(scenario.actions ?? [])].sort(compareActions);
  const nonCooldownDiagnostics = [
    ...createLaneOverlapDiagnostics(actions),
    ...createSwitchFrameConflictDiagnostics(actions, scenario.time?.fps),
    ...createStandaloneStarCarryDiagnostics(actions),
    ...createSkillSpPreconditionDiagnostics(
      actions,
      scenario.actors ?? [],
      scenario
    ),
    ...createAttackInputChainDiagnostics(actions, scenario.time?.fps),
    ...createJointAttackDiagnostics(
      actions,
      scenario.actors ?? [],
      scenario.time?.fps
    ),
  ];
  const preblockedActionIds = new Set([
    ...externallyBlockedActionIds.map(String),
    ...nonCooldownDiagnostics
      .filter(item => item.status === ACTION_RULE_STATUSES.VIOLATED)
      .map(item => String(item.actionId)),
  ]);
  const cooldownEvaluation = createSkillCooldownEvaluation(actions, {
    scenario,
    cooldownEvaluationAdapter,
    preblockedActionIds,
  });
  const diagnostics = [
    ...nonCooldownDiagnostics,
    ...cooldownEvaluation.diagnostics,
    ...createKiboCooldownSessionDiagnostics(
      cooldownEvaluation.cooldownModifierSession
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
      ruleCount: 15,
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
      switchFrameConflictCount: diagnostics.filter(
        item => item.code === ACTION_RULE_CODES.SWITCH_FRAME_CONFLICT
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
        ].includes(item.code)
      ).length,
      jointAttackViolationCount: diagnostics.filter(item =>
        [
          ACTION_RULE_CODES.JOINT_ATTACK_KIBO_REQUIRED,
          ACTION_RULE_CODES.JOINT_ATTACK_PAIR_MISSING,
          ACTION_RULE_CODES.JOINT_ATTACK_FRAME_MISMATCH,
        ].includes(item.code)
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

function createStandaloneStarCarryDiagnostics(actions) {
  return actions
    .filter(
      action =>
        action.type === ACTION_TYPES.SKILL &&
        action.actionKind === 'star-carry' &&
        !isSwitchTriggeredDerivedAction(action) &&
        !isVerifiedDeclaredPublicAction(action)
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

function isVerifiedDeclaredPublicAction(action) {
  const intent = action?.verifiedDeclaredPublicActionIntent;
  if (
    intent?.schemaVersion !== 1 ||
    intent?.contractName !== 'AzPrVerifiedDeclaredPublicAction' ||
    String(intent.actionId ?? '') !== String(action?.id ?? '')
  ) {
    return false;
  }
  const mapping = getVerifiedCombatActionMappingByIdentity(
    intent.mappingIdentity
  );
  return Boolean(
    mapping?.schedulable === true &&
    mapping.catalogDeclaration &&
    String(mapping.identity) === String(intent.mappingIdentity) &&
    Number(mapping.ownerId) === Number(intent.ownerId) &&
    Number(mapping.ownerId) === Number(action?.actor?.characterId) &&
    Number(mapping.sourceSkillId) === Number(action?.skillId) &&
    String(mapping.actionKind) === String(action?.actionKind)
  );
}

function createJointAttackDiagnostics(actions, actors, fps = 60) {
  const actorById = new Map(
    actors.map(actor => [String(actor.id ?? ''), actor])
  );
  const actorCombos = actions.filter(isActorJointAttack);
  const kiboCombos = actions.filter(isKiboJointAttack);
  return [
    ...actorCombos.map(action =>
      createJointAttackDiagnostic({
        action,
        counterpartActions: kiboCombos,
        actorById,
        fps,
        side: 'actor',
      })
    ),
    ...kiboCombos.map(action =>
      createJointAttackDiagnostic({
        action,
        counterpartActions: actorCombos,
        actorById,
        fps,
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
  const sameFrame = compatibleActions.find(
    counterpart => msToFrame(counterpart.startMs, fps) === actionFrame
  );
  if (sameFrame) return null;

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

function isKiboJointAttack(action) {
  return (
    action.type === ACTION_TYPES.KIBO_EVENT &&
    (action.eventType === 'break' || action.actionKind === 'break')
  );
}

function createAttackInputChainDiagnostics(actions, fps = 60) {
  const diagnostics = actions
    .filter(action => action.attackInputLegacyStatus === 'legacy-unresolved')
    .map(action =>
      createAttackInputDiagnostic({
        code: ACTION_RULE_CODES.ATTACK_INPUT_LEGACY_UNRESOLVED,
        action,
        message: `${action.name} 是无法唯一拆分的旧版聚合普攻，不参与三值结算`,
      })
    );
  const groups = groupByKey(
    actions.filter(action => action.attackGroupId),
    action => action.attackGroupId
  );
  groups.forEach(groupActions => {
    const bySequence = [...groupActions].sort(
      (left, right) =>
        Number(left.attackSequenceIndex) - Number(right.attackSequenceIndex)
    );
    const expectedTotal = Math.max(
      ...bySequence.map(action => Number(action.attackSequenceTotal) || 0)
    );
    const presentIndexes = new Set(
      bySequence.map(action => Number(action.attackSequenceIndex))
    );
    const missingIndexes = Array.from(
      { length: expectedTotal },
      (_, index) => index + 1
    ).filter(index => !presentIndexes.has(index));
    if (missingIndexes.length) {
      const action = bySequence[0];
      diagnostics.push(
        createAttackInputDiagnostic({
          code: ACTION_RULE_CODES.ATTACK_INPUT_CHAIN_INCOMPLETE,
          action,
          groupActions: bySequence,
          message: `普攻输入链缺少 ${missingIndexes.map(index => `A${index}`).join('、')}，其余输入段保持独立`,
          extra: { missingSequenceIndexes: missingIndexes },
        })
      );
    }
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
        })
      );
    }
    for (const action of bySequence) {
      const sequenceIndex = Number(action.attackSequenceIndex) || 0;
      if (sequenceIndex <= 0 || sequenceIndex >= expectedTotal) continue;
      const nextAction = bySequence.find(
        candidate => Number(candidate.attackSequenceIndex) === sequenceIndex + 1
      );
      if (!nextAction) continue;
      const linkWindow = action.attackInput?.linkWindow;
      if (action.attackInput?.linkTimingStatus !== 'applied' || !linkWindow) {
        diagnostics.push(
          createAttackInputDiagnostic({
            code: ACTION_RULE_CODES.ATTACK_INPUT_LINK_TIMING_UNRESOLVED,
            action,
            groupActions: [action, nextAction],
            message: `${action.name} 到 ${nextAction.name} 的真实输入窗口尚未确认，当前自由排布不会被自动修正`,
          })
        );
        continue;
      }
      const relativeStartFrame = msToFrame(
        Number(nextAction.startMs) - Number(action.startMs),
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
          action: nextAction,
          groupActions: [action, nextAction],
          message: tooEarly
            ? `${nextAction.name} 比 ${action.name} 的最早输入窗口提前 ${linkWindow.startFrame - relativeStartFrame}F`
            : `${nextAction.name} 已超过 ${action.name} 的输入窗口 ${relativeStartFrame - latestStartFrame}F`,
          extra: {
            relativeStartFrame,
            suggestedStartMs:
              Number(action.startMs) +
              ((tooEarly ? linkWindow.startFrame : latestStartFrame) * 1000) /
                (Number(fps) || 60),
            editFieldKey: 'startMs',
          },
        })
      );
    }
  });
  return diagnostics;
}

function createAttackInputDiagnostic({
  code,
  action,
  groupActions = [action],
  message,
  extra = {},
}) {
  return {
    schemaVersion: 1,
    id: createDiagnosticId(code, action.id, action.attackGroupId),
    code,
    ruleKey: 'normal-attack-input-chain',
    status: ACTION_RULE_STATUSES.UNRESOLVED,
    severity: 'warning',
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
    appliedToSimulationResults: false,
    ...extra,
  };
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
  pending,
}) {
  if (action.type !== ACTION_TYPES.SKILL || !action.actorId) return;
  const resolution = resolveVerifiedCombatActionMechanics(action, {
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
    .filter(charge => charge.readyAtMs > transaction.timeMs)
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
    : state.charges.some(charge => charge.readyAtMs > timeMs);
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
    .filter(charge => charge.readyAtMs <= action.startMs)
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
      .filter(charge => charge.readyAtMs > timeMs)
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
  return charges.filter(charge => charge.readyAtMs <= timeMs).length;
}

function getNextReadyAtMs(charges, timeMs) {
  return (
    charges
      .map(charge => charge.readyAtMs)
      .filter(readyAtMs => readyAtMs > timeMs)
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
  if (
    Number.isInteger(verifiedControlSkillId) &&
    verifiedControlSkillId !== Number(action.skillId) &&
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
