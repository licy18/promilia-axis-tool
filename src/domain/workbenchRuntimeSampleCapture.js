export const WORKBENCH_RUNTIME_SAMPLE_FILE_SCHEMA_VERSION = 1;
export const WORKBENCH_RUNTIME_SAMPLE_FILE_TYPE = 'runtime-sample-captures';

const SUPPORTED_RUNTIME_SAMPLE_FILE_TYPES = new Set([
  WORKBENCH_RUNTIME_SAMPLE_FILE_TYPE,
  'runtime-sample-capture',
]);

const RECOVER_SP_REQUIRED_EVENT_TYPES = [
  'recover-sp-modifier-property-read',
  'recover-sp-args-built',
  'recover-sp-ontransmit-12f',
  'recover-sp-applied',
  'recover-sp-share-rebroadcast',
];
const TOUGHNESS_REQUIRED_EVENT_TYPES = ['toughness-damage-applied'];
const KIBO_ENERGY_REQUIRED_EVENT_TYPES = ['pet-ultimate-cooldown-observed'];
const NON_PRODUCTION_SOURCE_PATTERN =
  /(?:fixture|synthetic|template|mock|example|manual|self[-_ ]?test)/iu;

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

    const resourceOwnerBinding = validateCaptureResourceOwnerBinding({
      capture,
      project,
      action: binding.action,
    });
    if (!resourceOwnerBinding.valid) {
      rejectedCaptures.push({
        captureSessionId: capture.captureSessionId,
        reason: resourceOwnerBinding.reason,
        sourceActionIds: binding.sourceActionIds,
        sourceSkillIds: binding.sourceSkillIds,
        resourceOwnerIssues: resourceOwnerBinding.issues,
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

function validateCaptureResourceOwnerBinding({ capture, project, action }) {
  const observations = capture.events.filter(
    event => event.eventType === 'pet-ultimate-cooldown-observed'
  );
  if (observations.length === 0) {
    return { valid: true, reason: null, issues: [] };
  }

  const actorGroups = project?.metadata?.timelineTopology?.actorGroups;
  if (!Array.isArray(actorGroups) || actorGroups.length === 0) {
    return {
      valid: false,
      reason: 'runtime-sample-resource-owner-topology-missing',
      issues: observations.map(event =>
        createKiboObservationOwnerIssue(event, 'timeline-topology-missing')
      ),
    };
  }

  const issues = observations.flatMap(event => {
    const group = actorGroups.find(
      candidate => candidate?.slotId === event.slotId
    );
    const expectedKiboId = positiveIntegerOrNull(
      group?.kiboEnergyCurve?.kiboId ?? group?.kiboLane?.kiboId
    );
    const observedKiboId = positiveIntegerOrNull(event.kiboId);
    const mismatches = [];
    if (!group) {
      mismatches.push('slot-not-found');
    } else {
      if (event.actorId !== group.actorId) {
        mismatches.push('actor-mismatch');
      }
      if (observedKiboId == null || observedKiboId !== expectedKiboId) {
        mismatches.push('kibo-mismatch');
      }
      if (action.actorId !== group.actorId) {
        mismatches.push('action-owner-mismatch');
      }
    }
    return mismatches.map(reason =>
      createKiboObservationOwnerIssue(event, reason, {
        expectedActorId: group?.actorId ?? null,
        expectedKiboId,
        actionActorId: action.actorId,
      })
    );
  });

  return issues.length > 0
    ? {
        valid: false,
        reason: 'runtime-sample-resource-owner-mismatch',
        issues,
      }
    : { valid: true, reason: null, issues: [] };
}

function createKiboObservationOwnerIssue(event, reason, expected = {}) {
  return {
    eventType: event.eventType,
    reason,
    slotId: stringOrNull(event.slotId),
    actorId: stringOrNull(event.actorId),
    kiboId: positiveIntegerOrNull(event.kiboId),
    ...expected,
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

export function createRuntimeSampleCaptureProductionAudit(capturesInput = []) {
  const captures = normalizeWorkbenchRuntimeSampleCaptures(capturesInput);
  const captureAudits = captures.map(createProductionCaptureAudit);
  const realCaptureClaimAllowed =
    captureAudits.length > 0 &&
    captureAudits.every(capture => capture.productionEligible);

  return {
    schemaVersion: 1,
    status: realCaptureClaimAllowed
      ? 'production-runtime-captures-ready'
      : captureAudits.length > 0
        ? 'production-runtime-captures-incomplete'
        : 'production-runtime-captures-empty',
    captureCount: captureAudits.length,
    productionEligibleCaptureCount: captureAudits.filter(
      capture => capture.productionEligible
    ).length,
    realCaptureClaimAllowed,
    captureAudits,
    applied: false,
  };
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
    return parseJsonLinesValue(value);
  }
}

function parseJsonLinesValue(value) {
  const lines = String(value)
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return null;
  }

  const records = [];
  for (const line of lines) {
    try {
      records.push(JSON.parse(line));
    } catch {
      return null;
    }
  }

  const sessionMetadataById = new Map();
  const eventsBySessionId = new Map();
  const sessionOrder = [];

  for (const record of records) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      return null;
    }
    if (record.recordType === 'capture-session') {
      const captureSessionId = stringOrNull(
        record.captureSessionId ?? record.sessionId
      );
      if (!captureSessionId || sessionMetadataById.has(captureSessionId)) {
        return null;
      }
      const metadata = { ...record };
      delete metadata.recordType;
      delete metadata.events;
      metadata.captureSessionId = captureSessionId;
      sessionMetadataById.set(captureSessionId, metadata);
      if (!eventsBySessionId.has(captureSessionId)) {
        eventsBySessionId.set(captureSessionId, []);
        sessionOrder.push(captureSessionId);
      }
      continue;
    }
    if (record.recordType && record.recordType !== 'event') {
      return null;
    }

    const event =
      record.recordType === 'event' &&
      record.event &&
      typeof record.event === 'object'
        ? { ...record.event }
        : { ...record };
    delete event.recordType;
    delete event.event;
    const captureSessionId = stringOrNull(
      event.captureSessionId ?? record.captureSessionId ?? record.sessionId
    );
    if (!captureSessionId) {
      return null;
    }
    event.captureSessionId = captureSessionId;
    if (!eventsBySessionId.has(captureSessionId)) {
      eventsBySessionId.set(captureSessionId, []);
      sessionOrder.push(captureSessionId);
    }
    eventsBySessionId.get(captureSessionId).push(event);
  }

  return {
    schemaVersion: WORKBENCH_RUNTIME_SAMPLE_FILE_SCHEMA_VERSION,
    game: 'azur-promilia',
    type: WORKBENCH_RUNTIME_SAMPLE_FILE_TYPE,
    captures: sessionOrder.map(captureSessionId => ({
      ...(sessionMetadataById.get(captureSessionId) ?? {}),
      captureSessionId,
      events: eventsBySessionId.get(captureSessionId) ?? [],
    })),
  };
}

function createProductionCaptureAudit(capture) {
  const source = stringOrNull(capture.source ?? capture.captureSource);
  const clientRegion = stringOrNull(capture.clientRegion);
  const clientBuild = stringOrNull(capture.clientBuild);
  const captureTool = capture.captureTool ?? {};
  const eventTypes = uniqueStrings(
    capture.events.map(event => event.eventType)
  );
  const hasRecoverSpEvents = eventTypes.some(eventType =>
    eventType.startsWith('recover-sp-')
  );
  const hasToughnessEvents = eventTypes.some(eventType =>
    eventType.startsWith('toughness-')
  );
  const hasKiboEnergyEvents = eventTypes.some(eventType =>
    eventType.startsWith('pet-ultimate-')
  );
  const requiredEventTypes = [
    ...(hasRecoverSpEvents ? RECOVER_SP_REQUIRED_EVENT_TYPES : []),
    ...(hasToughnessEvents ? TOUGHNESS_REQUIRED_EVENT_TYPES : []),
    ...(hasKiboEnergyEvents ? KIBO_ENERGY_REQUIRED_EVENT_TYPES : []),
  ];
  const missingEventTypes = requiredEventTypes.filter(
    eventType => !eventTypes.includes(eventType)
  );
  const recoverSpSequenceOrdered =
    !hasRecoverSpEvents ||
    containsOrderedEventTypes(
      capture.events.map(event => event.eventType),
      RECOVER_SP_REQUIRED_EVENT_TYPES
    );
  const timingComplete = capture.events.every(
    event =>
      numberOrNull(event.frameIndex) != null ||
      numberOrNull(event.timeMs) != null
  );
  const sourceIdentityComplete = capture.events.every(event => {
    if (event.eventType === 'pet-ultimate-cooldown-observed') {
      return Boolean(
        stringOrNull(event.slotId) &&
        stringOrNull(event.actorId) &&
        positiveIntegerOrNull(event.kiboId) &&
        positiveIntegerOrNull(event.petEntityId) &&
        stringOrNull(event.petEntityPointer)
      );
    }
    return Boolean(
      numberOrNull(event.sourceElementConfigId ?? event.elementConfigId) !=
        null || stringOrNull(event.pathId) != null
    );
  });
  const eventValuesComplete = capture.events.every(event => {
    if (event.eventType !== 'pet-ultimate-cooldown-observed') {
      return true;
    }
    const cdTime = numberOrNull(event.cdTime);
    const totalTime = numberOrNull(event.totalTime);
    return Boolean(
      event.api === 'PetUltimateCdTime' &&
      cdTime != null &&
      cdTime >= 0 &&
      totalTime != null &&
      totalTime > 0 &&
      typeof event.ready === 'boolean' &&
      event.ready === (cdTime <= 0)
    );
  });
  const captureToolComplete = Boolean(
    stringOrNull(captureTool.name) &&
    stringOrNull(captureTool.version) &&
    stringOrNull(captureTool.hookManifestId ?? captureTool.hookManifestSha256)
  );
  const productionMarkerText = [
    capture.captureSessionId,
    source,
    clientRegion,
    clientBuild,
    captureTool.name,
    captureTool.version,
  ]
    .filter(Boolean)
    .join('|');
  const sourceLooksNonProduction =
    !source ||
    !/(?:runtime|source-game)/iu.test(source) ||
    NON_PRODUCTION_SOURCE_PATTERN.test(productionMarkerText);
  const checks = {
    sourceDeclared: Boolean(source),
    sourceLooksProduction: !sourceLooksNonProduction,
    clientRegionDeclared: Boolean(clientRegion),
    clientBuildDeclared: Boolean(clientBuild),
    captureToolDeclared: captureToolComplete,
    eventSequenceComplete:
      requiredEventTypes.length > 0 &&
      missingEventTypes.length === 0 &&
      recoverSpSequenceOrdered,
    eventTimingComplete: timingComplete,
    eventSourceIdentityComplete: sourceIdentityComplete,
    eventValuesComplete,
  };
  const productionEligible = Object.values(checks).every(Boolean);

  return {
    captureSessionId: capture.captureSessionId,
    status: productionEligible
      ? 'production-runtime-capture-ready'
      : 'production-runtime-capture-incomplete',
    source,
    clientRegion,
    clientBuild,
    eventCount: capture.events.length,
    eventTypes,
    requiredEventTypes,
    missingEventTypes,
    recoverSpSequenceOrdered,
    checks,
    productionEligible,
  };
}

function containsOrderedEventTypes(eventTypes, requiredEventTypes) {
  let requiredIndex = 0;
  for (const eventType of eventTypes) {
    if (eventType === requiredEventTypes[requiredIndex]) {
      requiredIndex += 1;
    }
    if (requiredIndex === requiredEventTypes.length) {
      return true;
    }
  }
  return false;
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

function positiveIntegerOrNull(value) {
  const numeric = numberOrNull(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
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
