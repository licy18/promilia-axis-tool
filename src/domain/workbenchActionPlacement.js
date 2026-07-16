import {
  ACTION_RULE_CODES,
  ACTION_RULE_STATUSES,
} from '../simulation/runtime/actionRuleDiagnostics';
import { WORKBENCH_FRAME_MS, snapMsToFrame } from './timebase';

export const WORKBENCH_ACTION_PLACEMENT_CONTRACT_NAME =
  'AzPrActionPlacementProposal';

export const WORKBENCH_ACTION_PLACEMENT_STATUSES = Object.freeze({
  VALID: 'valid',
  ADJUSTABLE: 'adjustable',
  BLOCKED: 'blocked',
  UNRESOLVED: 'unresolved',
});

const AUTO_ADJUSTABLE_RULE_CODES = new Set([
  ACTION_RULE_CODES.LANE_OVERLAP,
  ACTION_RULE_CODES.SKILL_COOLDOWN_ACTIVE,
]);
const MAX_ADJUSTMENT_PASSES = 24;

export function createWorkbenchActionPlacementProposal({
  currentActions = [],
  requestedActions = [],
  actionRelations = [],
  timelineDurationMs = 0,
  requestedLaneId = '',
  evaluateCandidate = null,
  preflightIssues = [],
} = {}) {
  const normalizedRequestedActions = normalizeRequestedActions(requestedActions);
  const requestedActionIds = normalizedRequestedActions.map(action => action.id);
  const requestedActionIdSet = new Set(requestedActionIds);
  const relationIds = collectPlacementRelationIds(
    actionRelations,
    requestedActionIdSet
  );
  const requestedRange = createActionGroupRange(normalizedRequestedActions);
  const durationMs = Math.max(0, Number(timelineDurationMs) || 0);
  const blockingPreflight = preflightIssues.filter(
    issue => issue?.status === WORKBENCH_ACTION_PLACEMENT_STATUSES.BLOCKED
  );
  const unresolvedPreflight = preflightIssues.filter(
    issue => issue?.status === WORKBENCH_ACTION_PLACEMENT_STATUSES.UNRESOLVED
  );

  if (!normalizedRequestedActions.length) {
    return createBlockedProposal({
      requestedActionIds,
      relationIds,
      requestedLaneId,
      requestedRange,
      conflicts: [
        createPlacementIssue(
          'placement-action-group-empty',
          '没有可放置的动作',
          'workbench-placement-request'
        ),
      ],
    });
  }
  if (blockingPreflight.length) {
    return createBlockedProposal({
      requestedActionIds,
      relationIds,
      requestedLaneId,
      requestedRange,
      conflicts: blockingPreflight,
      unresolved: unresolvedPreflight,
    });
  }
  if (requestedRange.durationMs > durationMs) {
    return createBlockedProposal({
      requestedActionIds,
      relationIds,
      requestedLaneId,
      requestedRange,
      conflicts: [
        createPlacementIssue(
          'placement-group-exceeds-timeline',
          '动作组总跨度超过时间轴',
          'project.time.durationMs'
        ),
      ],
      unresolved: unresolvedPreflight,
    });
  }
  if (typeof evaluateCandidate !== 'function') {
    return createBlockedProposal({
      requestedActionIds,
      relationIds,
      requestedLaneId,
      requestedRange,
      conflicts: [
        createPlacementIssue(
          'placement-rule-evaluator-missing',
          '缺少统一规则评估入口',
          'AzPrActionRuleDiagnostics'
        ),
      ],
      unresolved: unresolvedPreflight,
    });
  }

  let proposedActions = shiftActionGroup(
    normalizedRequestedActions,
    Math.max(0, -requestedRange.startMs)
  );
  let appliedOffsetMs =
    proposedActions[0].startMs - normalizedRequestedActions[0].startMs;
  let lastEvaluation = null;
  let lastViolations = [];
  let internalConflicts = [];
  const encounteredRuleSources = new Set();
  const encounteredAdjustments = [];

  for (let pass = 0; pass < MAX_ADJUSTMENT_PASSES; pass += 1) {
    const proposedRange = createActionGroupRange(proposedActions);
    if (proposedRange.endMs > durationMs) {
      return createBlockedProposal({
        requestedActionIds,
        relationIds,
        requestedLaneId,
        requestedRange,
        proposedActions,
        appliedOffsetMs,
        conflicts: [
          ...lastViolations,
          createPlacementIssue(
            'placement-group-exceeds-timeline-end',
            '时间轴末端没有足够空间容纳整个动作组',
            'project.time.durationMs'
          ),
        ],
        unresolved: [
          ...unresolvedPreflight,
          ...collectUnresolvedIssues(lastEvaluation, requestedActionIdSet),
        ],
        evaluation: withEncounteredRuleSources(
          lastEvaluation,
          encounteredRuleSources
        ),
        adjustments: encounteredAdjustments,
      });
    }

    const candidateActions = mergePlacementActions(
      currentActions,
      proposedActions,
      requestedActionIdSet
    );
    lastEvaluation = normalizePlacementEvaluation(
      evaluateCandidate(candidateActions, {
        requestedActionIds,
        relationIds,
        requestedLaneId,
      })
    );
    for (const sourceKind of [
      ...lastEvaluation.ruleSources,
      ...lastEvaluation.diagnostics.map(
        diagnostic => diagnostic?.source?.sourceKind
      ),
    ]) {
      if (sourceKind) encounteredRuleSources.add(sourceKind);
    }
    lastViolations = collectPlacementDiagnostics(
      lastEvaluation.diagnostics,
      requestedActionIdSet,
      ACTION_RULE_STATUSES.VIOLATED
    );
    encounteredAdjustments.push(...lastViolations);
    if (!lastViolations.length) {
      const unresolved = uniqueIssues([
        ...unresolvedPreflight,
        ...collectUnresolvedIssues(lastEvaluation, requestedActionIdSet),
      ]);
      const adjusted = appliedOffsetMs > 0;
      const status = adjusted
        ? WORKBENCH_ACTION_PLACEMENT_STATUSES.ADJUSTABLE
        : unresolved.length
          ? WORKBENCH_ACTION_PLACEMENT_STATUSES.UNRESOLVED
          : WORKBENCH_ACTION_PLACEMENT_STATUSES.VALID;
      return createProposal({
        status,
        requestedActionIds,
        relationIds,
        requestedLaneId,
        requestedRange,
        proposedActions,
        appliedOffsetMs,
        conflicts: [],
        unresolved,
        evaluation: withEncounteredRuleSources(
          lastEvaluation,
          encounteredRuleSources
        ),
        adjustments: encounteredAdjustments,
      });
    }

    internalConflicts = lastViolations.filter(diagnostic =>
      isInternalGroupConflict(diagnostic, requestedActionIdSet)
    );
    const nonAdjustableConflicts = lastViolations.filter(
      diagnostic =>
        !AUTO_ADJUSTABLE_RULE_CODES.has(diagnostic.code) ||
        isInternalGroupConflict(diagnostic, requestedActionIdSet)
    );
    if (nonAdjustableConflicts.length) {
      return createBlockedProposal({
        requestedActionIds,
        relationIds,
        requestedLaneId,
        requestedRange,
        proposedActions,
        appliedOffsetMs,
        conflicts: nonAdjustableConflicts,
        unresolved: [
          ...unresolvedPreflight,
          ...collectUnresolvedIssues(lastEvaluation, requestedActionIdSet),
        ],
        evaluation: withEncounteredRuleSources(
          lastEvaluation,
          encounteredRuleSources
        ),
        adjustments: encounteredAdjustments,
      });
    }

    const nextOffsetMs = resolveNextPlacementOffset({
      violations: lastViolations,
      proposedActions,
      candidateActions,
      requestedActionIdSet,
    });
    if (!(nextOffsetMs > 0)) {
      break;
    }
    proposedActions = shiftActionGroup(proposedActions, nextOffsetMs);
    appliedOffsetMs += nextOffsetMs;
  }

  return createBlockedProposal({
    requestedActionIds,
    relationIds,
    requestedLaneId,
    requestedRange,
    proposedActions,
    appliedOffsetMs,
    conflicts:
      internalConflicts.length > 0
        ? internalConflicts
        : lastViolations.length > 0
          ? lastViolations
          : [
              createPlacementIssue(
                'placement-adjustment-did-not-converge',
                '未能在时间轴内找到确定的合法位置',
                'AzPrActionRuleDiagnostics'
              ),
            ],
    unresolved: [
      ...unresolvedPreflight,
      ...collectUnresolvedIssues(lastEvaluation, requestedActionIdSet),
    ],
    evaluation: withEncounteredRuleSources(
      lastEvaluation,
      encounteredRuleSources
    ),
    adjustments: encounteredAdjustments,
  });
}

export function expandWorkbenchPlacementActionIds({
  actions = [],
  actionIds = [],
  actionRelations = [],
} = {}) {
  const availableIds = new Set(actions.map(action => action.id));
  const expandedIds = new Set(
    actionIds.filter(actionId => availableIds.has(actionId))
  );
  if (!expandedIds.size) return [];

  let changed = true;
  while (changed) {
    changed = false;
    for (const relation of actionRelations ?? []) {
      const fromActionId = relation?.fromActionId;
      const toActionId = relation?.toActionId;
      if (!availableIds.has(fromActionId) || !availableIds.has(toActionId)) {
        continue;
      }
      if (
        expandedIds.has(fromActionId) !== expandedIds.has(toActionId)
      ) {
        expandedIds.add(fromActionId);
        expandedIds.add(toActionId);
        changed = true;
      }
    }
  }
  return actions
    .filter(action => expandedIds.has(action.id))
    .map(action => action.id);
}

function createProposal({
  status,
  requestedActionIds,
  relationIds,
  requestedLaneId,
  requestedRange,
  proposedActions,
  appliedOffsetMs,
  conflicts,
  unresolved,
  evaluation = null,
  adjustments = [],
}) {
  const proposedRange = createActionGroupRange(proposedActions);
  return {
    schemaVersion: 1,
    contractName: WORKBENCH_ACTION_PLACEMENT_CONTRACT_NAME,
    sourceKind: 'workbench-action-placement-proposal',
    status,
    committable:
      status !== WORKBENCH_ACTION_PLACEMENT_STATUSES.BLOCKED,
    requestedActionIds,
    affectedActionIds: [...requestedActionIds],
    relationIds,
    requestedLaneId: requestedLaneId || null,
    suggestedLaneId: requestedLaneId || null,
    requestedStartMs: requestedRange.startMs,
    suggestedStartMs: proposedRange.startMs,
    requestedEndMs: requestedRange.endMs,
    suggestedEndMs: proposedRange.endMs,
    appliedOffsetMs: snapMsToFrame(appliedOffsetMs),
    proposedActions: proposedActions.map(action => ({ ...action })),
    adjustments: uniqueIssues(adjustments),
    conflicts: uniqueIssues(conflicts),
    unresolved: uniqueIssues(unresolved),
    ruleSources: uniqueValues([
      ...conflicts.map(issue => issue?.source?.sourceKind),
      ...unresolved.map(issue => issue?.source?.sourceKind),
      ...(evaluation?.ruleSources ?? []),
    ]),
    appliedToCalculators: false,
  };
}

function createBlockedProposal(options) {
  return createProposal({
    status: WORKBENCH_ACTION_PLACEMENT_STATUSES.BLOCKED,
    proposedActions: options.proposedActions ?? [],
    appliedOffsetMs: options.appliedOffsetMs ?? 0,
    unresolved: options.unresolved ?? [],
    evaluation: options.evaluation ?? null,
    adjustments: options.adjustments ?? [],
    ...options,
  });
}

function normalizeRequestedActions(actions) {
  return (actions ?? [])
    .filter(action => action?.id)
    .map(action => ({
      ...action,
      startMs: snapMsToFrame(Number(action.startMs) || 0),
      durationMs: Math.max(
        WORKBENCH_FRAME_MS,
        snapMsToFrame(Number(action.durationMs) || WORKBENCH_FRAME_MS)
      ),
    }));
}

function mergePlacementActions(
  currentActions,
  proposedActions,
  requestedActionIdSet
) {
  const proposedById = new Map(
    proposedActions.map(action => [action.id, action])
  );
  const merged = currentActions.map(action =>
    requestedActionIdSet.has(action.id)
      ? { ...proposedById.get(action.id) }
      : action
  );
  for (const action of proposedActions) {
    if (!currentActions.some(current => current.id === action.id)) {
      merged.push({ ...action });
    }
  }
  return merged;
}

function shiftActionGroup(actions, offsetMs) {
  const snappedOffsetMs = snapMsToFrame(offsetMs);
  return actions.map(action => ({
    ...action,
    startMs: snapMsToFrame(Number(action.startMs) + snappedOffsetMs),
  }));
}

function createActionGroupRange(actions) {
  if (!actions?.length) {
    return { startMs: 0, endMs: 0, durationMs: 0 };
  }
  const startMs = Math.min(...actions.map(action => Number(action.startMs) || 0));
  const endMs = Math.max(
    ...actions.map(
      action =>
        (Number(action.startMs) || 0) +
        Math.max(WORKBENCH_FRAME_MS, Number(action.durationMs) || 0)
    )
  );
  return {
    startMs,
    endMs,
    durationMs: Math.max(0, endMs - startMs),
  };
}

function normalizePlacementEvaluation(evaluation) {
  const diagnostics =
    evaluation?.actionRuleDiagnostics?.diagnostics ??
    evaluation?.diagnostics ??
    [];
  return {
    diagnostics: Array.isArray(diagnostics) ? diagnostics : [],
    unresolved: Array.isArray(evaluation?.unresolved)
      ? evaluation.unresolved
      : [],
    ruleSources: uniqueValues([
      evaluation?.actionRuleDiagnostics?.sourceKind,
      evaluation?.sourceKind,
      ...(evaluation?.ruleSources ?? []),
    ]),
  };
}

function withEncounteredRuleSources(evaluation, encounteredRuleSources) {
  return {
    ...(evaluation ?? {}),
    ruleSources: [
      ...(encounteredRuleSources ?? []),
      ...(evaluation?.ruleSources ?? []),
    ],
  };
}

function collectPlacementDiagnostics(
  diagnostics,
  requestedActionIdSet,
  status
) {
  return (diagnostics ?? []).filter(
    diagnostic =>
      diagnostic?.status === status &&
      diagnosticTouchesGroup(diagnostic, requestedActionIdSet)
  );
}

function collectUnresolvedIssues(evaluation, requestedActionIdSet) {
  return uniqueIssues([
    ...collectPlacementDiagnostics(
      evaluation?.diagnostics,
      requestedActionIdSet,
      ACTION_RULE_STATUSES.UNRESOLVED
    ),
    ...(evaluation?.unresolved ?? []),
  ]);
}

function diagnosticTouchesGroup(diagnostic, requestedActionIdSet) {
  return (
    requestedActionIdSet.has(diagnostic?.actionId) ||
    (diagnostic?.actionIds ?? []).some(actionId =>
      requestedActionIdSet.has(actionId)
    )
  );
}

function isInternalGroupConflict(diagnostic, requestedActionIdSet) {
  const actionIds = uniqueValues([
    diagnostic?.actionId,
    diagnostic?.blockingActionId,
    ...(diagnostic?.actionIds ?? []),
  ]);
  return (
    actionIds.length > 1 &&
    actionIds.every(actionId => requestedActionIdSet.has(actionId))
  );
}

function resolveNextPlacementOffset({
  violations,
  proposedActions,
  candidateActions,
  requestedActionIdSet,
}) {
  const proposedById = new Map(
    proposedActions.map(action => [action.id, action])
  );
  const candidateById = new Map(
    candidateActions.map(action => [action.id, action])
  );
  const offsets = [];
  for (const diagnostic of violations) {
    const targetAction = proposedById.get(diagnostic.actionId);
    if (
      targetAction &&
      Number.isFinite(Number(diagnostic.suggestedStartMs))
    ) {
      offsets.push(
        Number(diagnostic.suggestedStartMs) -
          Number(targetAction.startMs)
      );
      continue;
    }

    const blockingAction = proposedById.get(diagnostic.blockingActionId);
    const externalAction = candidateById.get(diagnostic.actionId);
    if (
      !blockingAction ||
      !externalAction ||
      requestedActionIdSet.has(externalAction.id)
    ) {
      continue;
    }
    if (diagnostic.code === ACTION_RULE_CODES.LANE_OVERLAP) {
      offsets.push(
        Number(externalAction.startMs) +
          Number(externalAction.durationMs) -
          Number(blockingAction.startMs)
      );
    } else if (
      diagnostic.code === ACTION_RULE_CODES.SKILL_COOLDOWN_ACTIVE
    ) {
      offsets.push(
        Number(externalAction.startMs) +
          Number(
            diagnostic.effectiveCooldownMs ??
              diagnostic.cooldownMs ??
              0
          ) -
          Number(blockingAction.startMs)
      );
    }
  }

  const offsetMs = Math.max(0, ...offsets);
  return offsetMs > 0
    ? Math.max(WORKBENCH_FRAME_MS, snapMsToFrame(offsetMs))
    : 0;
}

function collectPlacementRelationIds(relations, requestedActionIdSet) {
  return (relations ?? [])
    .filter(
      relation =>
        requestedActionIdSet.has(relation?.fromActionId) &&
        requestedActionIdSet.has(relation?.toActionId)
    )
    .map(relation => relation.id)
    .filter(Boolean);
}

function createPlacementIssue(code, message, sourceKind) {
  return {
    schemaVersion: 1,
    code,
    status: WORKBENCH_ACTION_PLACEMENT_STATUSES.BLOCKED,
    message,
    source: { sourceKind },
  };
}

function uniqueIssues(issues) {
  const seen = new Set();
  return (issues ?? []).filter(issue => {
    const key = String(issue?.id ?? issue?.code ?? issue?.message ?? '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueValues(values) {
  return [...new Set((values ?? []).filter(Boolean))];
}
