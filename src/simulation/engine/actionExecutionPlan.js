import { createActionRuleDiagnostics } from '../runtime/actionRuleDiagnostics';

export const ACTION_EXECUTION_PLAN_CONTRACT_NAME = 'AzPrActionExecutionPlan';

export const ACTION_EXECUTION_STATUSES = Object.freeze({
  SCHEDULED: 'scheduled',
  SCHEDULED_WITH_UNRESOLVED_CONDITIONS: 'scheduled-with-unresolved-conditions',
  SKIPPED_RULE_BLOCKED: 'skipped-rule-blocked',
});

export function createActionExecutionPlan({
  scenario = {},
  actionRuleDiagnostics = null,
} = {}) {
  const diagnostics =
    actionRuleDiagnostics ?? createActionRuleDiagnostics({ scenario });
  const readinessByActionId = new Map(
    (diagnostics.readinessTimeline?.actions ?? []).map(entry => [
      entry.actionId,
      entry,
    ])
  );
  let executionIndex = 0;
  const actions = (scenario.actions ?? []).map((action, actionIndex) => {
    const readiness = readinessByActionId.get(action.id) ?? null;
    const execute = readiness?.executable !== false;
    const unresolved = readiness?.status === 'ready-with-unresolved-conditions';
    const entry = {
      schemaVersion: 1,
      sourceKind: 'azpr-action-execution-plan-entry',
      status: execute
        ? unresolved
          ? ACTION_EXECUTION_STATUSES.SCHEDULED_WITH_UNRESOLVED_CONDITIONS
          : ACTION_EXECUTION_STATUSES.SCHEDULED
        : ACTION_EXECUTION_STATUSES.SKIPPED_RULE_BLOCKED,
      execute,
      actionId: action.id,
      actionName: action.name ?? action.id,
      actionType: action.type,
      actionIndex,
      executionIndex: execute ? executionIndex : null,
      sourceSequenceIndex: action.sourceSequenceIndex ?? actionIndex,
      sourceSequencePath: action.sourceSequencePath ?? [actionIndex],
      sourceSequenceSource:
        action.sourceSequenceSource ?? 'scenario-action-array-order',
      actorId: action.actorId ?? null,
      actorName: action.actor?.name ?? null,
      contextActionId: action.contextActionId ?? null,
      skillId: action.skillId ?? null,
      startMs: Number(action.startMs) || 0,
      durationMs: Number(action.durationMs) || 0,
      readinessStatus: readiness?.status ?? 'ready',
      diagnosticIds: [...(readiness?.diagnosticIds ?? [])],
      violationCodes: [...(readiness?.violationCodes ?? [])],
      unresolvedCodes: [...(readiness?.unresolvedCodes ?? [])],
      skipReason: execute ? null : 'confirmed-action-rule-violation',
      readiness,
      appliedToSimulationResults: true,
    };
    if (execute) {
      executionIndex += 1;
    }
    return entry;
  });
  const executedActionIds = actions
    .filter(action => action.execute)
    .map(action => action.actionId);
  const skippedActionIds = actions
    .filter(action => !action.execute)
    .map(action => action.actionId);
  const unresolvedExecutedActionIds = actions
    .filter(
      action =>
        action.status ===
        ACTION_EXECUTION_STATUSES.SCHEDULED_WITH_UNRESOLVED_CONDITIONS
    )
    .map(action => action.actionId);

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-action-execution-plan',
    contractName: ACTION_EXECUTION_PLAN_CONTRACT_NAME,
    status:
      skippedActionIds.length > 0
        ? 'action-execution-plan-ready-with-skipped-actions'
        : unresolvedExecutedActionIds.length > 0
          ? 'action-execution-plan-ready-with-unresolved-conditions'
          : 'action-execution-plan-ready',
    actions,
    executedActionIds,
    skippedActionIds,
    unresolvedExecutedActionIds,
    summary: {
      actionCount: actions.length,
      executedActionCount: executedActionIds.length,
      skippedActionCount: skippedActionIds.length,
      unresolvedExecutedActionCount: unresolvedExecutedActionIds.length,
      appliedToSimulationResults: true,
    },
    appliedToSimulationResults: true,
  };
}

export function createActionExecutionPlanIndex(actionExecutionPlan) {
  return new Map(
    (actionExecutionPlan?.actions ?? []).map(entry => [entry.actionId, entry])
  );
}
