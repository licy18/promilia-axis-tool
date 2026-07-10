export const WORKBENCH_RUNTIME_SAMPLE_FILE_SCHEMA_VERSION = 1;
export const WORKBENCH_RUNTIME_SAMPLE_FILE_TYPE = 'runtime-sample-captures';

const SUPPORTED_RUNTIME_SAMPLE_FILE_TYPES = new Set([
  WORKBENCH_RUNTIME_SAMPLE_FILE_TYPE,
  'runtime-sample-capture',
]);

export function parseWorkbenchRuntimeSampleCaptureFile(rawFile) {
  const payload = parseJsonValue(rawFile);
  const captureInputs = extractCaptureInputs(payload);
  if (!captureInputs || captureInputs.length === 0) {
    return null;
  }

  const captures = captureInputs.map(normalizeRuntimeSampleCapture);
  if (captures.some(capture => capture == null)) {
    return null;
  }

  return {
    schemaVersion: WORKBENCH_RUNTIME_SAMPLE_FILE_SCHEMA_VERSION,
    game: 'azur-promilia',
    type: WORKBENCH_RUNTIME_SAMPLE_FILE_TYPE,
    captures,
    summary: summarizeRuntimeSampleCaptures(captures),
  };
}

export function normalizeWorkbenchRuntimeSampleCaptures(capturesInput = []) {
  return arrayOrSingle(capturesInput)
    .map(normalizeRuntimeSampleCapture)
    .filter(Boolean);
}

export function bindWorkbenchRuntimeSampleCaptures({
  captures,
  project,
  selectedActionId,
} = {}) {
  const normalizedCaptures = normalizeWorkbenchRuntimeSampleCaptures(captures);
  const actions = project?.actions ?? [];
  const actionsById = new Map(actions.map(action => [action.id, action]));
  const selectedAction =
    actionsById.get(selectedActionId) ?? actions[0] ?? null;
  const boundCaptures = [];
  const rejectedCaptures = [];

  for (const capture of normalizedCaptures) {
    const binding = resolveCaptureActionBinding({
      capture,
      actionsById,
      selectedAction,
    });
    if (!binding.action) {
      rejectedCaptures.push({
        captureSessionId: capture.captureSessionId,
        reason: binding.reason,
        sourceActionIds: binding.sourceActionIds,
        sourceSkillIds: binding.sourceSkillIds,
      });
      continue;
    }

    const targetId = binding.action.targetId ?? project?.enemy?.id ?? null;
    if (!binding.action.actorId || !targetId) {
      rejectedCaptures.push({
        captureSessionId: capture.captureSessionId,
        reason: 'workbench-action-actor-or-target-missing',
        sourceActionIds: binding.sourceActionIds,
        sourceSkillIds: binding.sourceSkillIds,
      });
      continue;
    }

    boundCaptures.push(
      createBoundRuntimeSampleCapture({
        capture,
        action: binding.action,
        targetId,
        sourceActionIds: binding.sourceActionIds,
        sourceSkillIds: binding.sourceSkillIds,
      })
    );
  }

  return {
    status:
      rejectedCaptures.length > 0
        ? boundCaptures.length > 0
          ? 'runtime-sample-binding-partial'
          : 'runtime-sample-binding-rejected'
        : boundCaptures.length > 0
          ? 'runtime-sample-binding-ready'
          : 'runtime-sample-binding-empty',
    captures: boundCaptures,
    rejectedCaptures,
    summary: {
      inputCaptureCount: normalizedCaptures.length,
      boundCaptureCount: boundCaptures.length,
      rejectedCaptureCount: rejectedCaptures.length,
      boundEventCount: boundCaptures.reduce(
        (sum, capture) => sum + capture.events.length,
        0
      ),
      actionIds: uniqueStrings(
        boundCaptures.map(capture => capture.workbenchBinding?.actionId)
      ),
      actorIds: uniqueStrings(
        boundCaptures.map(capture => capture.workbenchBinding?.actorId)
      ),
      targetIds: uniqueStrings(
        boundCaptures.map(capture => capture.workbenchBinding?.targetId)
      ),
    },
  };
}

export function mergeWorkbenchRuntimeSampleCaptures(
  currentCaptures,
  incomingCaptures
) {
  const merged = normalizeWorkbenchRuntimeSampleCaptures(currentCaptures);
  const indexBySessionId = new Map(
    merged.map((capture, index) => [capture.captureSessionId, index])
  );

  for (const capture of normalizeWorkbenchRuntimeSampleCaptures(
    incomingCaptures
  )) {
    const existingIndex = indexBySessionId.get(capture.captureSessionId);
    if (existingIndex == null) {
      indexBySessionId.set(capture.captureSessionId, merged.length);
      merged.push(capture);
    } else {
      merged[existingIndex] = capture;
    }
  }

  return merged;
}

function extractCaptureInputs(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  if (payload.game && payload.game !== 'azur-promilia') {
    return null;
  }
  if (
    payload.type &&
    !SUPPORTED_RUNTIME_SAMPLE_FILE_TYPES.has(String(payload.type))
  ) {
    return null;
  }
  if (Array.isArray(payload.captures)) {
    return payload.captures;
  }
  if (Array.isArray(payload.runtimeSampleCaptures)) {
    return payload.runtimeSampleCaptures;
  }
  if (Array.isArray(payload.events)) {
    return [payload];
  }
  return null;
}

function normalizeRuntimeSampleCapture(capture) {
  if (!capture || typeof capture !== 'object') {
    return null;
  }
  const captureSessionId = stringOrNull(
    capture.captureSessionId ?? capture.sessionId
  );
  const eventInputs = Array.isArray(capture.events) ? capture.events : [];
  if (!captureSessionId || eventInputs.length === 0) {
    return null;
  }

  const events = eventInputs.map(normalizeRuntimeSampleEvent);
  if (events.some(event => event == null)) {
    return null;
  }

  return {
    ...capture,
    schemaVersion: positiveIntegerOrDefault(capture.schemaVersion, 1),
    captureSessionId,
    events,
  };
}

function normalizeRuntimeSampleEvent(event) {
  if (!event || typeof event !== 'object') {
    return null;
  }
  const eventType = stringOrNull(event.eventType ?? event.type);
  if (!eventType) {
    return null;
  }
  return {
    ...event,
    eventType,
  };
}

function resolveCaptureActionBinding({ capture, actionsById, selectedAction }) {
  const persistedSourceActionIds = uniqueStrings(
    capture.workbenchBinding?.sourceActionIds ?? []
  );
  const persistedSourceSkillIds = uniqueNumbers(
    capture.workbenchBinding?.sourceSkillIds ?? []
  );
  const sourceActionIds =
    persistedSourceActionIds.length > 0
      ? persistedSourceActionIds
      : uniqueStrings([
          capture.actionId,
          ...capture.events.map(event => event.actionId),
        ]);
  const sourceSkillIds =
    persistedSourceSkillIds.length > 0
      ? persistedSourceSkillIds
      : uniqueNumbers([
          capture.skillId,
          ...capture.events.flatMap(event => [
            event.skillId,
            event.args?.skillId,
          ]),
        ]);
  const exactActions = uniqueObjects(
    sourceActionIds.map(actionId => actionsById.get(actionId)).filter(Boolean),
    action => action.id
  );

  if (exactActions.length > 1) {
    return {
      action: null,
      reason: 'capture-spans-multiple-workbench-actions',
      sourceActionIds,
      sourceSkillIds,
    };
  }
  if (exactActions.length === 1 && exactActions[0]) {
    if (sourceActionIds.some(actionId => actionId !== exactActions[0].id)) {
      return {
        action: null,
        reason: 'capture-has-ambiguous-source-actions',
        sourceActionIds,
        sourceSkillIds,
      };
    }
    if (!isCaptureSkillCompatible(exactActions[0], sourceSkillIds)) {
      return {
        action: null,
        reason: 'workbench-action-skill-mismatch',
        sourceActionIds,
        sourceSkillIds,
      };
    }
    return {
      action: exactActions[0],
      reason: null,
      sourceActionIds,
      sourceSkillIds,
    };
  }
  if (sourceActionIds.length > 1) {
    return {
      action: null,
      reason: 'capture-has-ambiguous-source-actions',
      sourceActionIds,
      sourceSkillIds,
    };
  }
  if (!selectedAction) {
    return {
      action: null,
      reason: 'selected-workbench-action-missing',
      sourceActionIds,
      sourceSkillIds,
    };
  }
  if (!isCaptureSkillCompatible(selectedAction, sourceSkillIds)) {
    return {
      action: null,
      reason: 'selected-workbench-action-skill-mismatch',
      sourceActionIds,
      sourceSkillIds,
    };
  }

  return {
    action: selectedAction,
    reason: null,
    sourceActionIds,
    sourceSkillIds,
  };
}

function createBoundRuntimeSampleCapture({
  capture,
  action,
  targetId,
  sourceActionIds,
  sourceSkillIds,
}) {
  const events = capture.events.map(event => ({
    ...event,
    sourceWorkbenchBinding: event.sourceWorkbenchBinding ?? {
      actionId: event.actionId ?? null,
      actorId: event.actorId ?? null,
      targetId: event.targetId ?? null,
    },
    actionId: action.id,
    actorId: action.actorId,
    targetId,
  }));

  return {
    ...capture,
    actionId: action.id,
    events,
    workbenchBinding: {
      status: 'bound-to-workbench-project',
      actionId: action.id,
      actorId: action.actorId,
      targetId,
      skillId: numberOrNull(action.skillId),
      sourceActionIds,
      sourceSkillIds,
    },
  };
}

function isCaptureSkillCompatible(action, sourceSkillIds) {
  return (
    sourceSkillIds.length === 0 ||
    sourceSkillIds.includes(Number(action?.skillId))
  );
}

function summarizeRuntimeSampleCaptures(captures) {
  return {
    captureCount: captures.length,
    eventCount: captures.reduce(
      (sum, capture) => sum + capture.events.length,
      0
    ),
    captureSessionIds: captures.map(capture => capture.captureSessionId),
    eventTypes: uniqueStrings(
      captures.flatMap(capture => capture.events.map(event => event.eventType))
    ),
  };
}

function parseJsonValue(value) {
  if (!value) {
    return null;
  }
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function arrayOrSingle(value) {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function stringOrNull(value) {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

function numberOrNull(value) {
  if (value == null || value === '') {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function positiveIntegerOrDefault(value, fallback) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
}

function uniqueStrings(values) {
  return [...new Set(values.map(stringOrNull).filter(value => value != null))];
}

function uniqueNumbers(values) {
  return [...new Set(values.map(numberOrNull).filter(value => value != null))];
}

function uniqueObjects(values, getKey) {
  const seen = new Set();
  return values.filter(value => {
    const key = getKey(value);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
