import { WORKBENCH_FRAME_MS, snapMsToFrame } from './timebase';
import { createWorkbenchActionDraft } from './workbenchProjectFactory';
import {
  createNextWorkbenchActionRelationIdFromUsedIds,
  normalizeWorkbenchActionRelations,
} from './workbenchActionRelations';

export const WORKBENCH_ACTION_CLIPBOARD_KIND =
  'promilia-workbench-action-clipboard';

export function normalizeWorkbenchActionSelection(
  actions = [],
  selectedActionIds = [],
  primaryActionId = ''
) {
  const actionIds = actions.map(action => action.id);
  const availableActionIds = new Set(actionIds);
  const requestedActionIds = new Set(
    (Array.isArray(selectedActionIds) ? selectedActionIds : []).filter(
      actionId => availableActionIds.has(actionId)
    )
  );
  let normalizedActionIds = actionIds.filter(actionId =>
    requestedActionIds.has(actionId)
  );
  const requestedPrimaryActionId = availableActionIds.has(primaryActionId)
    ? primaryActionId
    : '';

  if (normalizedActionIds.length === 0 && requestedPrimaryActionId) {
    normalizedActionIds = [requestedPrimaryActionId];
  }
  if (normalizedActionIds.length === 0 && actionIds.length > 0) {
    normalizedActionIds = [actionIds[0]];
  }

  return {
    selectedActionIds: normalizedActionIds,
    primaryActionId: normalizedActionIds.includes(requestedPrimaryActionId)
      ? requestedPrimaryActionId
      : (normalizedActionIds[0] ?? ''),
  };
}

export function createWorkbenchActionSelectionRange(
  actions = [],
  anchorActionId = '',
  targetActionId = ''
) {
  const anchorIndex = actions.findIndex(action => action.id === anchorActionId);
  const targetIndex = actions.findIndex(action => action.id === targetActionId);
  if (targetIndex < 0) {
    return [];
  }
  if (anchorIndex < 0) {
    return [targetActionId];
  }

  const startIndex = Math.min(anchorIndex, targetIndex);
  const endIndex = Math.max(anchorIndex, targetIndex);
  return actions.slice(startIndex, endIndex + 1).map(action => action.id);
}

export function createWorkbenchActionClipboard(
  actions = [],
  selectedActionIds = [],
  actionRelations = []
) {
  const selectedActionIdSet = new Set(selectedActionIds);
  const selectedActions = actions.filter(action =>
    selectedActionIdSet.has(action.id)
  );
  if (selectedActions.length === 0) {
    return null;
  }

  const baseStartMs = Math.min(
    ...selectedActions.map(action => normalizeStartMs(action.startMs))
  );
  const baseEndMs = Math.max(
    ...selectedActions.map(
      action => normalizeStartMs(action.startMs) + resolveDurationMs(action)
    )
  );
  const copiedRelations = normalizeWorkbenchActionRelations(
    actionRelations,
    actions
  ).filter(
    relation =>
      selectedActionIdSet.has(relation.fromActionId) &&
      selectedActionIdSet.has(relation.toActionId)
  );

  return {
    schemaVersion: 1,
    kind: WORKBENCH_ACTION_CLIPBOARD_KIND,
    sourceActionIds: selectedActions.map(action => action.id),
    baseStartMs,
    baseEndMs,
    durationMs: Math.max(WORKBENCH_FRAME_MS, baseEndMs - baseStartMs),
    actions: cloneValue(selectedActions),
    relations: cloneValue(copiedRelations),
    nextPasteStartMs: baseEndMs + WORKBENCH_FRAME_MS,
  };
}

export function pasteWorkbenchActionClipboard(
  clipboard,
  {
    existingActions = [],
    existingRelations = [],
    timelineDurationMs = 0,
    targetStartMs = null,
    createActionId,
    createRelationId = createNextWorkbenchActionRelationIdFromUsedIds,
    pasteGapMs = WORKBENCH_FRAME_MS,
    clampToTimeline = true,
    normalizeSourceAction = action => action,
  } = {}
) {
  if (
    clipboard?.kind !== WORKBENCH_ACTION_CLIPBOARD_KIND ||
    !Array.isArray(clipboard.actions) ||
    clipboard.actions.length === 0 ||
    typeof createActionId !== 'function'
  ) {
    return null;
  }

  const durationMs = Math.max(0, Number(timelineDurationMs) || 0);
  const clipboardSpanMs = Math.max(
    WORKBENCH_FRAME_MS,
    Number(clipboard.baseEndMs) - Number(clipboard.baseStartMs) ||
      Number(clipboard.durationMs) ||
      WORKBENCH_FRAME_MS
  );
  const maxPasteStartMs = Math.max(0, durationMs - clipboardSpanMs);
  const hasExplicitTarget =
    targetStartMs !== null &&
    targetStartMs !== undefined &&
    targetStartMs !== '' &&
    Number.isFinite(Number(targetStartMs));
  const requestedPasteStartMs = hasExplicitTarget
    ? Number(targetStartMs)
    : Number(clipboard.nextPasteStartMs);
  const pasteStartMs = clampToTimeline
    ? clampNumber(snapMsToFrame(requestedPasteStartMs), 0, maxPasteStartMs)
    : Math.max(0, snapMsToFrame(requestedPasteStartMs));
  const usedActionIds = new Set(existingActions.map(action => action.id));
  const actionIdMap = new Map();
  const pastedActions = clipboard.actions.map(sourceAction => {
    const id = createActionId(usedActionIds);
    usedActionIds.add(id);
    actionIdMap.set(sourceAction.id, id);
    const relativeStartMs =
      normalizeStartMs(sourceAction.startMs) - Number(clipboard.baseStartMs);
    const normalizedSourceAction = normalizeSourceAction(
      cloneValue(sourceAction)
    );
    return createWorkbenchActionDraft({
      ...normalizedSourceAction,
      id,
      startMs: pasteStartMs + relativeStartMs,
      insertion: null,
      generationBatch: null,
      effectCommands: remapEffectCommands(sourceAction.effectCommands, id),
    });
  });
  const usedRelationIds = new Set(
    existingRelations.map(relation => relation.id)
  );
  const pastedRelations = normalizeWorkbenchActionRelations(
    (clipboard.relations ?? []).map(sourceRelation => ({
      ...sourceRelation,
      id: createRelationId(usedRelationIds),
      fromActionId: actionIdMap.get(sourceRelation.fromActionId),
      toActionId: actionIdMap.get(sourceRelation.toActionId),
    })),
    pastedActions
  );
  const pastedActionIds = pastedActions.map(action => action.id);
  const nextPasteStartMs = clampNumber(
    snapMsToFrame(pasteStartMs + clipboardSpanMs + Number(pasteGapMs || 0)),
    0,
    maxPasteStartMs
  );

  return {
    pastedActions,
    pastedRelations,
    selectedActionIds: pastedActionIds,
    primaryActionId: pastedActionIds[0] ?? '',
    pasteStartMs,
    nextClipboard: {
      ...cloneValue(clipboard),
      nextPasteStartMs,
    },
  };
}

export function shiftWorkbenchActionDrafts(
  actions = [],
  selectedActionIds = [],
  requestedOffsetMs = 0,
  timelineDurationMs = 0
) {
  const selectedActionIdSet = new Set(selectedActionIds);
  const selectedActions = actions.filter(action =>
    selectedActionIdSet.has(action.id)
  );
  if (selectedActions.length === 0) {
    return { actions, appliedOffsetMs: 0, affectedActionIds: [] };
  }

  const minStartMs = Math.min(
    ...selectedActions.map(action => normalizeStartMs(action.startMs))
  );
  const maxEndMs = Math.max(
    ...selectedActions.map(
      action => normalizeStartMs(action.startMs) + resolveDurationMs(action)
    )
  );
  const durationMs = Math.max(0, Number(timelineDurationMs) || 0);
  const appliedOffsetMs = clampNumber(
    snapMsToFrame(Number(requestedOffsetMs) || 0),
    -minStartMs,
    Math.max(-minStartMs, durationMs - maxEndMs)
  );
  if (appliedOffsetMs === 0) {
    return {
      actions,
      appliedOffsetMs,
      affectedActionIds: selectedActions.map(action => action.id),
    };
  }

  return {
    actions: actions.map(action =>
      selectedActionIdSet.has(action.id)
        ? createWorkbenchActionDraft({
            ...action,
            startMs: normalizeStartMs(action.startMs) + appliedOffsetMs,
            insertion: null,
          })
        : action
    ),
    appliedOffsetMs,
    affectedActionIds: selectedActions.map(action => action.id),
  };
}

function remapEffectCommands(effectCommands = [], actionId) {
  return (Array.isArray(effectCommands) ? effectCommands : []).map(
    (command, index) => ({
      ...command,
      id: `${actionId}-effect-${String(index + 1).padStart(2, '0')}`,
    })
  );
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

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}
