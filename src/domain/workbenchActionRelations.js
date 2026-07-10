import {
  ACTION_RELATION_ANCHORS,
  ACTION_RELATION_KINDS,
  createActionRelation,
} from './projectSchema';
import { WORKBENCH_FRAME_MS, snapMsToFrame } from './timebase';

export function normalizeWorkbenchActionRelations(
  actionRelations = [],
  actions = []
) {
  const actionsById = new Map(actions.map(action => [action.id, action]));
  const usedRelationIds = new Set();
  const edgeKeys = new Set();
  const normalizedRelations = [];

  for (const sourceRelation of Array.isArray(actionRelations)
    ? actionRelations
    : []) {
    const fromActionId = String(sourceRelation?.fromActionId ?? '').trim();
    const toActionId = String(sourceRelation?.toActionId ?? '').trim();
    if (
      !actionsById.has(fromActionId) ||
      !actionsById.has(toActionId) ||
      fromActionId === toActionId
    ) {
      continue;
    }

    const edgeKey = createRelationEdgeKey(fromActionId, toActionId);
    if (
      edgeKeys.has(edgeKey) ||
      wouldCreateRelationCycle(normalizedRelations, fromActionId, toActionId)
    ) {
      continue;
    }

    const requestedId = String(sourceRelation?.id ?? '').trim();
    const id =
      requestedId && !usedRelationIds.has(requestedId)
        ? requestedId
        : createNextWorkbenchActionRelationIdFromUsedIds(usedRelationIds);
    usedRelationIds.add(id);
    edgeKeys.add(edgeKey);
    normalizedRelations.push(
      createActionRelation({
        id,
        kind: ACTION_RELATION_KINDS.SEQUENCE,
        fromActionId,
        toActionId,
        sourceAnchor: ACTION_RELATION_ANCHORS.SOURCE_END,
        targetAnchor: ACTION_RELATION_ANCHORS.TARGET_START,
        gapMs: resolveWorkbenchActionRelationGapMs(
          actionsById.get(fromActionId),
          actionsById.get(toActionId)
        ),
      })
    );
  }

  return normalizedRelations;
}

export function createWorkbenchActionRelationChain(
  actionRelations = [],
  actions = [],
  selectedActionIds = [],
  createRelationId = createNextWorkbenchActionRelationIdFromUsedIds
) {
  const normalizedRelations = normalizeWorkbenchActionRelations(
    actionRelations,
    actions
  );
  const selectedActionIdSet = new Set(selectedActionIds);
  const actionOrder = new Map(
    actions.map((action, index) => [action.id, index])
  );
  const selectedActions = actions
    .filter(action => selectedActionIdSet.has(action.id))
    .sort(
      (left, right) =>
        normalizeStartMs(left.startMs) - normalizeStartMs(right.startMs) ||
        (actionOrder.get(left.id) ?? 0) - (actionOrder.get(right.id) ?? 0)
    );
  if (selectedActions.length < 2) {
    return { relations: normalizedRelations, createdRelations: [] };
  }

  const usedRelationIds = new Set(
    normalizedRelations.map(relation => relation.id)
  );
  const edgeKeys = new Set(
    normalizedRelations.map(relation =>
      createRelationEdgeKey(relation.fromActionId, relation.toActionId)
    )
  );
  const createdRelations = [];
  for (let index = 1; index < selectedActions.length; index += 1) {
    const fromAction = selectedActions[index - 1];
    const toAction = selectedActions[index];
    const edgeKey = createRelationEdgeKey(fromAction.id, toAction.id);
    const currentRelations = [...normalizedRelations, ...createdRelations];
    if (
      edgeKeys.has(edgeKey) ||
      wouldCreateRelationCycle(currentRelations, fromAction.id, toAction.id)
    ) {
      continue;
    }

    const id = createRelationId(usedRelationIds);
    usedRelationIds.add(id);
    edgeKeys.add(edgeKey);
    createdRelations.push(
      createActionRelation({
        id,
        kind: ACTION_RELATION_KINDS.SEQUENCE,
        fromActionId: fromAction.id,
        toActionId: toAction.id,
        gapMs: resolveWorkbenchActionRelationGapMs(fromAction, toAction),
      })
    );
  }

  return {
    relations: [...normalizedRelations, ...createdRelations],
    createdRelations,
  };
}

export function removeWorkbenchActionRelationsForActions(
  actionRelations = [],
  actionIds = []
) {
  const actionIdSet = new Set(actionIds);
  return actionRelations.filter(
    relation =>
      !actionIdSet.has(relation.fromActionId) &&
      !actionIdSet.has(relation.toActionId)
  );
}

export function synchronizeWorkbenchActionRelationGaps(
  actionRelations = [],
  actions = []
) {
  return normalizeWorkbenchActionRelations(actionRelations, actions);
}

export function createNextWorkbenchActionRelationIdFromUsedIds(
  usedRelationIds
) {
  const usedIds = usedRelationIds ?? new Set();
  const maxIndex = [...usedIds].reduce((maximum, relationId) => {
    const match = String(relationId).match(/^relation-(\d+)$/);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  let nextIndex = maxIndex + 1;
  let relationId = `relation-${String(nextIndex).padStart(4, '0')}`;
  while (usedIds.has(relationId)) {
    nextIndex += 1;
    relationId = `relation-${String(nextIndex).padStart(4, '0')}`;
  }
  usedIds.add(relationId);
  return relationId;
}

export function resolveWorkbenchActionRelationGapMs(fromAction, toAction) {
  const sourceEndMs =
    normalizeStartMs(fromAction?.startMs) + resolveDurationMs(fromAction);
  return snapMsToFrame(normalizeStartMs(toAction?.startMs) - sourceEndMs);
}

export function wouldCreateRelationCycle(
  actionRelations,
  fromActionId,
  toActionId
) {
  if (!fromActionId || !toActionId || fromActionId === toActionId) {
    return true;
  }
  const graph = new Map();
  for (const relation of actionRelations ?? []) {
    if (!graph.has(relation.fromActionId)) {
      graph.set(relation.fromActionId, new Set());
    }
    graph.get(relation.fromActionId).add(relation.toActionId);
  }

  const pending = [toActionId];
  const visited = new Set();
  while (pending.length > 0) {
    const actionId = pending.pop();
    if (actionId === fromActionId) {
      return true;
    }
    if (visited.has(actionId)) {
      continue;
    }
    visited.add(actionId);
    pending.push(...(graph.get(actionId) ?? []));
  }
  return false;
}

function createRelationEdgeKey(fromActionId, toActionId) {
  return `${fromActionId}->${toActionId}`;
}

function resolveDurationMs(action) {
  return Math.max(
    WORKBENCH_FRAME_MS,
    Number(action?.durationMs) || WORKBENCH_FRAME_MS
  );
}

function normalizeStartMs(value) {
  return Math.max(0, Number(value) || 0);
}
