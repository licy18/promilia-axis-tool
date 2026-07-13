import {
  ACTION_RELATION_KINDS,
  EFFECT_OPERATIONS,
} from '../../domain/projectSchema';

const ACTION_EFFECT_RELATION_GRAPH_CONTRACT_NAME =
  'AzPrActionEffectRelationGraph';
export const ACTION_EFFECT_RELATION_KINDS = Object.freeze({
  SEQUENCE: 'sequence',
  TRIGGER: 'effect-trigger',
  REFRESH: 'effect-refresh',
  CONSUME: 'effect-consume',
});
const ACTION = 'action';
const EFFECT = 'effect';
const { SEQUENCE, TRIGGER, REFRESH, CONSUME } = ACTION_EFFECT_RELATION_KINDS;
const SATISFIED = 'satisfied';
const UNSATISFIED = 'unsatisfied';
const BLOCKED = 'blocked';
const INVALID = 'invalid';
const RELATION_KIND_ORDER = [SEQUENCE, TRIGGER, REFRESH, CONSUME];

export function createActionEffectRelationId(commandId) {
  return `effect-relation:${String(commandId ?? '').trim() || 'missing-command'}`;
}

export function resolveActionEffectRelationKind(operation) {
  return operation === EFFECT_OPERATIONS.REMOVE
    ? CONSUME
    : operation === EFFECT_OPERATIONS.REFRESH
      ? REFRESH
      : TRIGGER;
}

export function createActionEffectRelationGraph({
  scenario = {},
  effectTimeline = null,
  actionExecutionPlan = null,
} = {}) {
  const actions = scenario.actions ?? [];
  const actionById = new Map(actions.map(action => [action.id, action]));
  const executionByActionId = new Map(
    (actionExecutionPlan?.actions ?? []).map(entry => [entry.actionId, entry])
  );
  const runtimeCommandById = new Map(
    (effectTimeline?.input?.commands ?? []).map(command => [
      command.commandId,
      command,
    ])
  );
  const runtimeEventByCommandId = new Map(
    (effectTimeline?.events ?? [])
      .filter(event => event.commandId)
      .map(event => [event.commandId, event])
  );
  const commandEntries = actions.flatMap(action =>
    (action.effectCommands ?? []).map((command, commandIndex) => ({
      action,
      command,
      commandIndex,
      commandId: String(
        command?.id ?? `${action.id}|effect-command|${commandIndex}`
      ),
    }))
  );
  const effectNodes = new Map();

  for (const entry of commandEntries) {
    const runtimeCommand = runtimeCommandById.get(entry.commandId);
    const runtimeEvent = runtimeEventByCommandId.get(entry.commandId);
    const state = runtimeEvent?.after ?? runtimeEvent?.before;
    const targetKind =
      runtimeCommand?.targetKind ??
      state?.targetKind ??
      entry.command.targetKind;
    const targetId =
      runtimeCommand?.targetId ?? state?.targetId ?? entry.command.targetId;
    const effectId =
      runtimeCommand?.effectId ??
      state?.effectId ??
      entry.command.effectId ??
      '';
    const instanceKey =
      runtimeCommand?.instanceKey ??
      state?.instanceKey ??
      [targetKind, targetId, effectId].map(idPart).join('|');
    const nodeId = `effect:${instanceKey}`;
    const current = effectNodes.get(nodeId);
    const sourceActionIds = new Set(current?.sourceActionIds ?? []);
    if (entry.command.operation !== EFFECT_OPERATIONS.REMOVE) {
      sourceActionIds.add(runtimeCommand?.sourceActionId ?? entry.action.id);
    }
    effectNodes.set(nodeId, {
      nodeId,
      endpointKind: EFFECT,
      instanceKey,
      effectId,
      effectName:
        runtimeCommand?.effectName ??
        state?.effectName ??
        entry.command.effectName ??
        effectId,
      targetKind,
      targetId,
      targetName: runtimeEvent?.targetName ?? state?.targetName ?? null,
      sourceActionIds: [...sourceActionIds],
    });
    entry.effectNodeId = nodeId;
  }

  const nodes = [
    ...actions.map(action => ({
      nodeId: `action:${action.id}`,
      endpointKind: ACTION,
      actionId: action.id,
      label: action.name ?? action.id,
      startMs: nonNegative(action.startMs),
      endMs: round(
        nonNegative(action.startMs) + nonNegative(action.durationMs)
      ),
    })),
    ...effectNodes.values(),
  ];
  const edges = [
    ...(scenario.actionRelations ?? [])
      .filter(
        relation =>
          (relation?.kind ?? ACTION_RELATION_KINDS.SEQUENCE) ===
          ACTION_RELATION_KINDS.SEQUENCE
      )
      .map(relation =>
        createSequenceEdge(relation, actionById, executionByActionId)
      ),
    ...commandEntries.map(entry =>
      createEffectEdge(
        entry,
        effectNodes.get(entry.effectNodeId),
        runtimeCommandById.get(entry.commandId),
        runtimeEventByCommandId.get(entry.commandId),
        executionByActionId.get(entry.action.id)
      )
    ),
  ].sort(
    (left, right) =>
      RELATION_KIND_ORDER.indexOf(left.kind) -
        RELATION_KIND_ORDER.indexOf(right.kind) ||
      finiteOrMax(left.targetTimeMs) - finiteOrMax(right.targetTimeMs) ||
      left.edgeId.localeCompare(right.edgeId)
  );
  const issues = edges
    .filter(edge => edge.status !== SATISFIED)
    .map(edge => ({
      code: edge.diagnosticCode,
      status: edge.status,
      edgeId: edge.edgeId,
      relationKind: edge.kind,
      commandActionId: edge.commandActionId,
      effectCommandId: edge.effectCommandId,
      runtimeEventId: edge.runtimeEventId,
    }));
  const edgeCount = kind => edges.filter(edge => edge.kind === kind).length;
  const statusCount = status =>
    edges.filter(edge => edge.status === status).length;

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-action-effect-relation-graph',
    contractName: ACTION_EFFECT_RELATION_GRAPH_CONTRACT_NAME,
    status: issues.length
      ? 'action-effect-relation-graph-ready-with-diagnostics'
      : edges.length
        ? 'action-effect-relation-graph-ready'
        : 'action-effect-relation-graph-ready-no-edges',
    nodes,
    edges,
    diagnostics: {
      valid: issues.every(issue => issue.status !== INVALID),
      issueCount: issues.length,
      issues,
    },
    summary: {
      nodeCount: nodes.length,
      actionNodeCount: actions.length,
      effectNodeCount: effectNodes.size,
      edgeCount: edges.length,
      sequenceEdgeCount: edgeCount(SEQUENCE),
      triggerEdgeCount: edgeCount(TRIGGER),
      refreshEdgeCount: edgeCount(REFRESH),
      consumeEdgeCount: edgeCount(CONSUME),
      satisfiedEdgeCount: statusCount(SATISFIED),
      unsatisfiedEdgeCount: statusCount(UNSATISFIED),
      blockedEdgeCount: statusCount(BLOCKED),
      invalidEdgeCount: statusCount(INVALID),
      runtimeEventBoundEdgeCount: edges.filter(edge => edge.runtimeEventId)
        .length,
      appliedToCalculators: false,
    },
    appliedToCalculators: false,
  };
}

function createSequenceEdge(relation, actionById, executionByActionId) {
  const source = actionById.get(relation.fromActionId);
  const target = actionById.get(relation.toActionId);
  const sourceTime = source
    ? nonNegative(source.startMs) + nonNegative(source.durationMs)
    : null;
  const targetTime = target ? nonNegative(target.startMs) : null;
  const actualGapMs = source && target ? round(targetTime - sourceTime) : null;
  const expectedGapMs = round(relation.gapMs);
  let status = SATISFIED;
  let diagnosticCode = 'sequence-relation-satisfied';
  if (!source || !target) {
    status = INVALID;
    diagnosticCode = 'sequence-relation-endpoint-missing';
  } else if (
    executionByActionId.get(source.id)?.execute === false ||
    executionByActionId.get(target.id)?.execute === false
  ) {
    status = BLOCKED;
    diagnosticCode = 'sequence-relation-action-blocked';
  } else if (Math.abs(actualGapMs - expectedGapMs) > 0.001) {
    status = UNSATISFIED;
    diagnosticCode = 'sequence-relation-gap-mismatch';
  }
  return {
    edgeId: relation.id,
    kind: SEQUENCE,
    status,
    diagnosticCode,
    sourceEndpoint: actionEndpoint(relation.fromActionId, 'end'),
    targetEndpoint: actionEndpoint(relation.toActionId, 'start'),
    sourceActionId: relation.fromActionId,
    targetActionId: relation.toActionId,
    sourceTimeMs: sourceTime,
    targetTimeMs: targetTime,
    expectedGapMs,
    actualGapMs,
    appliedToCalculators: false,
  };
}

function createEffectEdge(
  entry,
  effectNode,
  runtimeCommand,
  runtimeEvent,
  executionEntry
) {
  const kind = resolveActionEffectRelationKind(entry.command.operation);
  const consume = kind === CONSUME;
  let status = SATISFIED;
  let diagnosticCode = `${kind}-satisfied`;
  if (executionEntry?.execute === false) {
    status = BLOCKED;
    diagnosticCode = 'effect-relation-action-blocked';
  } else if (!runtimeCommand) {
    status = INVALID;
    diagnosticCode = 'effect-relation-command-invalid';
  } else if (!runtimeEvent) {
    status = UNSATISFIED;
    diagnosticCode = 'effect-relation-runtime-event-missing';
  } else if (consume && !runtimeEvent.before) {
    status = UNSATISFIED;
    diagnosticCode = 'effect-consume-active-instance-missing';
  } else if (kind === REFRESH && runtimeEvent.type !== 'EFFECT_REFRESHED') {
    status = UNSATISFIED;
    diagnosticCode = 'effect-refresh-active-instance-missing';
  }
  const effectEndpoint = {
    endpointKind: EFFECT,
    nodeId: effectNode.nodeId,
    instanceKey: effectNode.instanceKey,
    effectId: effectNode.effectId,
    targetKind: effectNode.targetKind,
    targetId: effectNode.targetId,
    anchor: 'lifecycle',
  };
  const sourceActionIds = consume
    ? effectNode.sourceActionIds
    : [entry.action.id];
  const relationId = createActionEffectRelationId(entry.commandId);
  return {
    edgeId: relationId,
    kind,
    status,
    diagnosticCode,
    sourceEndpoint: consume
      ? effectEndpoint
      : actionEndpoint(entry.action.id, 'start'),
    targetEndpoint: consume
      ? actionEndpoint(entry.action.id, 'start')
      : effectEndpoint,
    sourceActionId: consume ? (sourceActionIds[0] ?? null) : entry.action.id,
    sourceActionIds,
    targetActionId: consume ? entry.action.id : null,
    commandActionId: entry.action.id,
    effectCommandId: entry.commandId,
    effectId: effectNode.effectId,
    effectName: effectNode.effectName,
    instanceKey: effectNode.instanceKey,
    targetId: effectNode.targetId,
    sourceTimeMs: consume
      ? (runtimeEvent?.before?.appliedAtMs ?? runtimeCommand?.timeMs ?? null)
      : nonNegative(entry.action.startMs),
    targetTimeMs: runtimeEvent?.timeMs ?? runtimeCommand?.timeMs ?? null,
    frameIndex: runtimeEvent?.frameIndex ?? runtimeCommand?.frameIndex ?? null,
    runtimeEventId: runtimeEvent?.eventId ?? null,
    runtimeEventType: runtimeEvent?.type ?? null,
    appliedToCalculators: false,
  };
}

function actionEndpoint(actionId, anchor) {
  return {
    endpointKind: ACTION,
    nodeId: `action:${actionId}`,
    actionId,
    anchor,
  };
}

function idPart(value) {
  return String(value ?? '')
    .trim()
    .replace(/\|/g, '/');
}

function nonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function finiteOrMax(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.MAX_SAFE_INTEGER;
}

function round(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}
