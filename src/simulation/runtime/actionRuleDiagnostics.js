import { ACTION_TYPES } from '../../domain/projectSchema';
import { isFrameWithinVerifiedInputWindow } from '../../domain/verifiedActionContextScheduling';
import { compareActionSourceSequence } from '../../domain/actionSourceSequence';
import { VERIFIED_WORKBENCH_MECHANICS_PROFILE_ID } from '../../domain/workbenchMechanicsProfileSelection';
import {
  getInstalledVerifiedCombatMechanicsPackage,
  getVerifiedCombatActionMapping,
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
      appliedToSimulationResults: false,
    },
    acceptedSkillStartTransitions:
      cooldownEvaluation.acceptedSkillStartTransitions,
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
        !isSwitchTriggeredDerivedAction(action)
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
    summary: {
      actionCount: actionRows.length,
      readyActionCount: actionRows.filter(action => action.status === 'ready')
        .length,
      blockedActionCount,
      unresolvedActionCount,
      cooldownTrackedActionCount: actionRows.filter(action => action.cooldown)
        .length,
      cooldownWindowCount: cooldownEvaluation.cooldownWindows.length,
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

function collectCooldownReductionEvents(actions, scenario) {
  const reductionsByOwner = new Map();
  if (!scenario) return reductionsByOwner;
  for (const action of actions ?? []) {
    if (action.type !== ACTION_TYPES.SKILL || !action.actorId) continue;
    const characterId = Number(action.actor?.characterId);
    if (!Number.isInteger(characterId) || characterId <= 0) continue;
    const resolution = resolveVerifiedCombatActionMechanics(action, {
      combatScenario: scenario.combatScenario,
    });
    const effect = (resolution?.effects ?? []).find(
      candidate => candidate.cooldownReduction
    );
    const raw = Number(effect?.cooldownReduction?.valueByLevel?.['1']);
    if (!Number.isFinite(raw) || raw >= 0) continue;
    const ownerKey = String(characterId);
    const list = reductionsByOwner.get(ownerKey) ?? [];
    list.push({
      timeMs: Math.max(0, Number(action.startMs) || 0),
      reductionMs: -raw * 1000,
      sourceActionId: action.id,
    });
    reductionsByOwner.set(ownerKey, list);
  }
  return reductionsByOwner;
}

function collectStarSkillIdByOwner() {
  const packageValue = getInstalledVerifiedCombatMechanicsPackage();
  const byOwner = new Map();
  for (const mapping of packageValue?.actionMappings ?? []) {
    if (
      mapping.ownerKind === 'actor' &&
      mapping.actionKind === 'star-skill'
    ) {
      byOwner.set(String(mapping.ownerId), Number(mapping.controlSkillId));
    }
  }
  return byOwner;
}

function applyCooldownChargeReductions({
  state,
  characterId,
  skillId,
  actionStartMs,
  reductionsByOwner,
  starSkillIdByOwner,
}) {
  const starSkillId = starSkillIdByOwner.get(String(characterId));
  if (!starSkillId || Number(skillId) !== starSkillId) return;
  const reductions = (reductionsByOwner.get(String(characterId)) ?? []).filter(
    reduction => reduction.timeMs <= Number(actionStartMs)
  );
  if (reductions.length === 0) return;
  const totalReductionMs = reductions.reduce(
    (sum, reduction) => sum + reduction.reductionMs,
    0
  );
  if (!(totalReductionMs > 0)) return;
  const target = [...state.charges].sort(
    (left, right) => right.readyAtMs - left.readyAtMs
  )[0];
  if (!target) return;
  target.readyAtMs = Math.max(0, target.readyAtMs - totalReductionMs);
  target.cooldownReductionMs = totalReductionMs;
  target.cooldownReductionSourceActionIds = reductions.map(
    reduction => reduction.sourceActionId
  );
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
  const cooldownReductionsByOwner = collectCooldownReductionEvents(
    actions,
    scenario
  );
  const starSkillIdByOwner = collectStarSkillIdByOwner();
  const diagnostics = [];
  const snapshotsByActionId = new Map();
  const cooldownWindows = [];
  const acceptedSkillStartTransitions = [];
  const cooldownModifierSession = createVerifiedKiboCooldownModifierSession({
    scenario,
  });
  for (const [actionOrderIndex, action] of actions.entries()) {
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
      cooldownStateBySkillOwner.get(key) ?? createSkillCooldownState(cooldown);
    applyCooldownChargeReductions({
      state,
      characterId: Number(action.actor?.characterId),
      skillId: Number(action.skillId),
      actionStartMs: action.startMs,
      reductionsByOwner: cooldownReductionsByOwner,
      starSkillIdByOwner,
    });
    cooldownStateBySkillOwner.set(key, state);
    const chargesBefore = cloneCooldownCharges(state.charges);
    const availableCharges = state.charges
      .filter(charge => charge.readyAtMs <= action.startMs)
      .sort((left, right) => left.chargeIndex - right.chargeIndex);
    const blocking = [...state.charges].sort(compareCooldownCharges)[0] ?? null;
    if (availableCharges.length === 0 && blocking) {
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
          chargesBefore,
          chargesAfter: chargesBefore,
          consumedChargeIndex: null,
          windowId: null,
        })
      );
      cooldownStateBySkillOwner.set(key, state);
      continue;
    }

    const consumedCharge = availableCharges[0];
    const readyAtMs = action.startMs + cooldown.cooldownMs;
    state.charges = state.charges.map(charge =>
      charge.chargeIndex === consumedCharge.chargeIndex
        ? {
            ...charge,
            readyAtMs,
            sourceActionId: action.id,
            sourceActionName: action.name,
          }
        : charge
    );
    const window = {
      schemaVersion: 1,
      sourceKind: 'azpr-skill-cooldown-window',
      status: 'skill-cooldown-window-active',
      windowId: `${action.id}|cooldown-charge|${consumedCharge.chargeIndex}`,
      actionId: action.id,
      actionName: action.name,
      actorId: action.actorId,
      actorName: action.actor?.name ?? action.actorId,
      ownerKind,
      ownerId,
      runtimeOwnerIdentity,
      kiboId: action.kiboId ?? null,
      skillId: action.skillId,
      actionOrderIndex,
      chargeIndex: consumedCharge.chargeIndex,
      cooldownCount: cooldown.cooldownCount,
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
      cooldownWindowId: window.windowId,
      passiveTransitions,
    });
    window.acceptedSkillStartTransition = acceptedSkillStartTransition;
    cooldownWindows.push(window);
    acceptedSkillStartTransitions.push(acceptedSkillStartTransition);
    snapshotsByActionId.set(
      action.id,
      createCooldownReadinessSnapshot({
        action,
        cooldown,
        status: 'cooldown-charge-consumed',
        chargesBefore,
        chargesAfter: cloneCooldownCharges(state.charges),
        consumedChargeIndex: consumedCharge.chargeIndex,
        windowId: window.windowId,
      })
    );
    cooldownStateBySkillOwner.set(key, state);
  }
  return {
    diagnostics,
    snapshotsByActionId,
    acceptedSkillStartTransitions,
    cooldownModifierSession: cooldownModifierSession.snapshot(),
    cooldownWindows: cooldownWindows.sort(
      (left, right) =>
        left.startMs - right.startMs ||
        left.endMs - right.endMs ||
        left.actionOrderIndex - right.actionOrderIndex
    ),
  };
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

function createSkillCooldownState(cooldown) {
  return {
    maxCharges: cooldown.cooldownCount,
    charges: Array.from(
      { length: cooldown.cooldownCount },
      (_, chargeIndex) => ({
        chargeIndex,
        readyAtMs: 0,
        sourceActionId: null,
        sourceActionName: null,
      })
    ),
  };
}

function createCooldownReadinessSnapshot({
  action,
  cooldown,
  status,
  chargesBefore,
  chargesAfter,
  consumedChargeIndex,
  windowId,
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
      ownerKind:
        action.type === ACTION_TYPES.KIBO_EVENT ? 'kibo' : 'actor',
      ownerId:
        action.type === ACTION_TYPES.KIBO_EVENT
          ? action.kiboId
          : action.actorId,
    }),
    kiboId: action.kiboId ?? null,
    skillId: action.skillId ?? null,
    availableBefore: countAvailableCharges(chargesBefore, action.startMs),
    availableAfter: countAvailableCharges(chargesAfter, action.startMs),
    consumedChargeIndex,
    nextReadyAtMs: getNextReadyAtMs(chargesAfter, action.startMs),
    chargesBefore,
    chargesAfter,
    windowId,
    source: cooldown.source,
    sourceIdentity: cooldown.sourceIdentity,
    confidence: cooldown.confidence,
    cooldownEvaluation: cooldown.evaluation,
    modifierCount: cooldown.evaluation.appliedModifierCount,
    trackingStatus: 'applied-to-readiness',
    appliedToSimulationResults: false,
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
