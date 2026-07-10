import { ACTION_TYPES } from '../../domain/projectSchema';

export const ACTION_RULE_DIAGNOSTICS_CONTRACT_NAME =
  'AzPrActionRuleDiagnostics';

export const ACTION_RULE_CODES = Object.freeze({
  LANE_OVERLAP: 'action-lane-overlap',
  SKILL_COOLDOWN_ACTIVE: 'skill-cooldown-active',
  SKILL_SP_PRECONDITION_UNRESOLVED: 'skill-sp-precondition-unresolved',
});

export const ACTION_RULE_STATUSES = Object.freeze({
  VIOLATED: 'violated',
  UNRESOLVED: 'unresolved',
});

export function createActionRuleDiagnostics({ scenario = {} } = {}) {
  const actions = [...(scenario.actions ?? [])].sort(compareActions);
  const diagnostics = [
    ...createLaneOverlapDiagnostics(actions),
    ...createSkillCooldownDiagnostics(actions),
    ...createSkillSpPreconditionDiagnostics(actions, scenario.actors ?? []),
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
    summary: {
      actionCount: actions.length,
      ruleCount: 3,
      diagnosticCount: diagnostics.length,
      violationCount,
      unresolvedCount,
      errorCount: diagnostics.filter(item => item.severity === 'error').length,
      warningCount: diagnostics.filter(item => item.severity === 'warning')
        .length,
      affectedActionCount: affectedActionIds.length,
      affectedActionIds,
      laneOverlapCount: diagnostics.filter(
        item => item.code === ACTION_RULE_CODES.LANE_OVERLAP
      ).length,
      cooldownViolationCount: diagnostics.filter(
        item => item.code === ACTION_RULE_CODES.SKILL_COOLDOWN_ACTIVE
      ).length,
      unresolvedSpPreconditionCount: diagnostics.filter(
        item => item.code === ACTION_RULE_CODES.SKILL_SP_PRECONDITION_UNRESOLVED
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
        if (candidate.startMs >= blocking.endMs) {
          break;
        }
        const overlapEndMs = Math.min(blocking.endMs, candidate.endMs);
        if (overlapEndMs <= candidate.startMs) {
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
            sourceKind: 'project-action-timing',
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

function createSkillCooldownDiagnostics(actions) {
  const cooldownStateBySkillOwner = new Map();
  const diagnostics = [];
  for (const action of actions) {
    if (action.type !== ACTION_TYPES.SKILL || !action.actorId) {
      continue;
    }
    const cooldown = createSkillCooldownRequirement(action);
    if (!cooldown) {
      continue;
    }
    const key = `${action.actorId}|${action.skillId}`;
    const state = releaseReadyCooldownCharges(
      cooldownStateBySkillOwner.get(key) ??
        createSkillCooldownState(cooldown.cooldownCount),
      action.startMs
    );
    const blocking = state.rechargeQueue[0] ?? null;
    if (state.availableCharges <= 0 && blocking) {
      diagnostics.push({
        schemaVersion: 1,
        id: createDiagnosticId(
          ACTION_RULE_CODES.SKILL_COOLDOWN_ACTIVE,
          action.id,
          blocking.actionId
        ),
        code: ACTION_RULE_CODES.SKILL_COOLDOWN_ACTIVE,
        ruleKey: 'skill-logic-cooldown',
        status: ACTION_RULE_STATUSES.VIOLATED,
        severity: 'error',
        actionId: action.id,
        actionIds: [blocking.actionId, action.id],
        actionName: action.name,
        actorId: action.actorId,
        actorName: action.actor?.name ?? action.actorId,
        blockingActionId: blocking.actionId,
        blockingActionName: blocking.actionName,
        timeMs: action.startMs,
        cooldownMs: cooldown.cooldownMs,
        cooldownCount: cooldown.cooldownCount,
        readyAtMs: blocking.readyAtMs,
        remainingMs: blocking.readyAtMs - action.startMs,
        suggestedStartMs: blocking.readyAtMs,
        editFieldKey: 'startMs',
        message: `${action.name} 可用次数已耗尽，尚有 ${blocking.readyAtMs - action.startMs}ms 冷却`,
        source: cooldown.source,
        appliedToSimulationResults: false,
      });
      cooldownStateBySkillOwner.set(key, state);
      continue;
    }
    state.availableCharges -= 1;
    state.rechargeQueue.push({
      actionId: action.id,
      actionName: action.name,
      readyAtMs: action.startMs + cooldown.cooldownMs,
    });
    state.rechargeQueue.sort(
      (left, right) =>
        left.readyAtMs - right.readyAtMs ||
        left.actionId.localeCompare(right.actionId)
    );
    cooldownStateBySkillOwner.set(key, state);
  }
  return diagnostics;
}

function createSkillCooldownState(cooldownCount) {
  return {
    maxCharges: cooldownCount,
    availableCharges: cooldownCount,
    rechargeQueue: [],
  };
}

function releaseReadyCooldownCharges(state, timeMs) {
  const rechargeQueue = [];
  let availableCharges = state.availableCharges;
  for (const charge of state.rechargeQueue) {
    if (charge.readyAtMs <= timeMs) {
      availableCharges = Math.min(state.maxCharges, availableCharges + 1);
    } else {
      rechargeQueue.push(charge);
    }
  }
  return {
    ...state,
    availableCharges,
    rechargeQueue,
  };
}

function createSkillSpPreconditionDiagnostics(actions, actors) {
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
        requiredSpRaw: requirement.spCost,
        actorInitialSp: finiteNumberOrNull(actor?.initialSp),
        actorMaxSp: finiteNumberOrNull(actor?.stats?.maxSp),
        suggestedStartMs: null,
        editFieldKey: '',
        message: `${action.name} 需要 SP ${requirement.spCost}，与角色 0-1 能量单位的换算待确认`,
        source: requirement.source,
        unresolved: ['skill-sp-cost-to-runtime-energy-unit'],
        appliedToSimulationResults: false,
      };
    })
    .filter(Boolean);
}

function createSkillCooldownRequirement(action) {
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
  return (
    Boolean(action?.actorId) &&
    [ACTION_TYPES.SKILL, ACTION_TYPES.SWITCH].includes(action.type)
  );
}

function createActionRange(action) {
  const startMs = Math.max(0, Number(action.startMs) || 0);
  const durationMs = Math.max(1, Number(action.durationMs) || 1);
  return {
    actionId: action.id,
    actionName: action.name ?? action.id,
    actorId: action.actorId,
    actorName: action.actor?.name ?? action.actorId,
    startMs,
    endMs: startMs + durationMs,
  };
}

function createDiagnosticId(code, ...parts) {
  return [code, ...parts].map(value => String(value ?? 'none')).join('|');
}

function compareActions(left, right) {
  return (
    Number(left.startMs) - Number(right.startMs) ||
    String(left.id).localeCompare(String(right.id))
  );
}

function compareRanges(left, right) {
  return (
    left.startMs - right.startMs ||
    left.endMs - right.endMs ||
    left.actionId.localeCompare(right.actionId)
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

function uniqueValues(values) {
  return [...new Set((values ?? []).filter(Boolean))];
}
