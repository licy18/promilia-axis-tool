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
const TOUGHNESS_REQUIRED_EVENT_TYPES = [
  'toughness-packet-execution',
  'toughness-weak-state-read',
  'toughness-break-property-read',
  'toughness-damage-applied',
  'toughness-weak-state-write',
  'toughness-hp-change-dispatch',
  'toughness-hp-applied',
  'toughness-state-update',
];
const TOUGHNESS_OUTPUT_EVENT_TYPES = new Set([
  'toughness-hp-output-calculated',
  'toughness-real-output-calculated',
  'toughness-output-calculated',
]);
const TOUGHNESS_PACKET_CORRELATED_EVENT_TYPES = new Set([
  'toughness-packet-execution',
  'toughness-hp-output-calculated',
  'toughness-real-output-calculated',
  'toughness-output-calculated',
  'toughness-break-property-read',
  'toughness-damage-applied',
  'toughness-hp-change-dispatch',
  'toughness-hp-applied',
]);
const KIBO_ENERGY_REQUIRED_EVENT_TYPES = ['pet-ultimate-cooldown-observed'];
const ISOLATED_CAPTURE_KINDS = new Set(['role-sp', 'kibo-energy', 'toughness']);
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
      actions,
      actionsById,
      selectedAction,
    });
    if (!binding.action) {
      rejectedCaptures.push({
        captureSessionId: capture.captureSessionId,
        reason: binding.reason,
        sourceActionIds: binding.sourceActionIds,
        sourceSkillIds: binding.sourceSkillIds,
        resourceOwnerActorIds: binding.resourceOwnerActorIds,
        candidateActionIds: binding.candidateActionIds,
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
        resolutionKind: binding.resolutionKind,
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
      bindingKinds: uniqueStrings(
        boundCaptures.map(capture => capture.workbenchBinding?.resolutionKind)
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

function resolveCaptureActionBinding({
  capture,
  actions,
  actionsById,
  selectedAction,
}) {
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
      resolutionKind: 'source-action-id',
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

  const ownerBinding = resolveCaptureResourceOwnerActionBinding({
    capture,
    actions,
    selectedAction,
    sourceSkillIds,
  });
  if (ownerBinding.handled) {
    return {
      action: ownerBinding.action,
      reason: ownerBinding.reason,
      sourceActionIds,
      sourceSkillIds,
      resourceOwnerActorIds: ownerBinding.resourceOwnerActorIds,
      candidateActionIds: ownerBinding.candidateActionIds,
      resolutionKind: ownerBinding.action ? 'resource-owner-action' : null,
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
    resolutionKind: 'selected-action-fallback',
  };
}

function resolveCaptureResourceOwnerActionBinding({
  capture,
  actions,
  selectedAction,
  sourceSkillIds,
}) {
  const persistedActorId = stringOrNull(capture.workbenchBinding?.actorId);
  const resourceOwnerActorIds = persistedActorId
    ? [persistedActorId]
    : uniqueStrings(capture.events.map(event => event.actorId));
  if (resourceOwnerActorIds.length > 1) {
    return {
      handled: true,
      action: null,
      reason: 'capture-spans-multiple-resource-owners',
      resourceOwnerActorIds,
      candidateActionIds: [],
    };
  }

  const actorId = resourceOwnerActorIds[0];
  const actorActions = actorId
    ? actions.filter(action => action.actorId === actorId)
    : [];
  if (!actorId || actorActions.length === 0) {
    return {
      handled: false,
      action: null,
      reason: null,
      resourceOwnerActorIds,
      candidateActionIds: [],
    };
  }

  const hasRecoverSpEvents = capture.events.some(event =>
    event.eventType.startsWith('recover-sp-')
  );
  const kiboObservationIds = uniqueNumbers(
    capture.events
      .filter(event => event.eventType === 'pet-ultimate-cooldown-observed')
      .map(event => event.kiboId)
  );
  let candidates = actorActions;
  if (sourceSkillIds.length > 0) {
    candidates = candidates.filter(action =>
      isCaptureSkillCompatible(action, sourceSkillIds)
    );
  } else if (kiboObservationIds.length > 0 && !hasRecoverSpEvents) {
    const kiboActions = candidates.filter(
      action => action.type === 'kiboEvent'
    );
    const exactKiboActions = kiboActions.filter(action =>
      kiboObservationIds.includes(Number(action.kiboId))
    );
    candidates = exactKiboActions.length > 0 ? exactKiboActions : kiboActions;
  }

  const candidateActionIds = candidates.map(action => action.id);
  if (candidates.length === 0) {
    return {
      handled: true,
      action: null,
      reason:
        sourceSkillIds.length > 0
          ? selectedAction?.actorId === actorId
            ? 'selected-workbench-action-skill-mismatch'
            : 'resource-owner-action-skill-mismatch'
          : 'resource-owner-action-missing',
      resourceOwnerActorIds,
      candidateActionIds,
    };
  }

  const selectedCandidate = candidates.find(
    action => action.id === selectedAction?.id
  );
  if (selectedCandidate) {
    return {
      handled: true,
      action: selectedCandidate,
      reason: null,
      resourceOwnerActorIds,
      candidateActionIds,
    };
  }
  if (candidates.length === 1) {
    return {
      handled: true,
      action: candidates[0],
      reason: null,
      resourceOwnerActorIds,
      candidateActionIds,
    };
  }

  return {
    handled: true,
    action: null,
    reason: 'resource-owner-action-ambiguous',
    resourceOwnerActorIds,
    candidateActionIds,
  };
}

function createBoundRuntimeSampleCapture({
  capture,
  action,
  targetId,
  sourceActionIds,
  sourceSkillIds,
  resolutionKind,
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
      resolutionKind,
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
  const sessionIntegrityById = new Map();
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
    if (record.recordType === 'capture-session-end') {
      const captureSessionId = stringOrNull(
        record.captureSessionId ?? record.sessionId
      );
      if (!captureSessionId || sessionIntegrityById.has(captureSessionId)) {
        return null;
      }
      const integrity = { ...record };
      delete integrity.recordType;
      integrity.captureSessionId = captureSessionId;
      sessionIntegrityById.set(captureSessionId, integrity);
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
      ...(sessionIntegrityById.has(captureSessionId)
        ? { captureIntegrity: sessionIntegrityById.get(captureSessionId) }
        : {}),
      events: eventsBySessionId.get(captureSessionId) ?? [],
    })),
  };
}

function createProductionCaptureAudit(capture) {
  const source = stringOrNull(capture.source ?? capture.captureSource);
  const clientRegion = stringOrNull(capture.clientRegion);
  const clientBuild = stringOrNull(capture.clientBuild);
  const captureKind = stringOrNull(capture.captureKind);
  const captureBinding = capture.binding ?? {};
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
  const hasToughnessOutputEvent = eventTypes.some(eventType =>
    TOUGHNESS_OUTPUT_EVENT_TYPES.has(eventType)
  );
  if (hasToughnessEvents && !hasToughnessOutputEvent) {
    missingEventTypes.push('toughness-*-output-calculated');
  }
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
  const toughnessEvents = capture.events.filter(event =>
    event.eventType.startsWith('toughness-')
  );
  const toughnessSequenceAudit = createToughnessSequenceAudit({
    capture,
    events: toughnessEvents,
  });
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
    if (event.eventType === 'toughness-state-update') {
      return Boolean(
        stringOrNull(event.methodKey) &&
        stringOrNull(event.eventIdentity) &&
        stringOrNull(event.hookInvocationIdentity)
      );
    }
    if (event.eventType.startsWith('toughness-')) {
      const correlationComplete = Boolean(
        stringOrNull(event.eventIdentity) &&
        Array.isArray(event.sourceSequencePath) &&
        stringOrNull(event.hookInvocationIdentity)
      );
      if (!correlationComplete) return false;
      if (!TOUGHNESS_PACKET_CORRELATED_EVENT_TYPES.has(event.eventType)) {
        return true;
      }
      return Boolean(
        numberOrNull(event.sourceElementConfigId ?? event.elementConfigId) !=
          null &&
        stringOrNull(event.damageElementPointer) &&
        event.sourceSequencePath.length > 0
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
      event.ready === cdTime <= 0
    );
  });
  const captureToolComplete = Boolean(
    stringOrNull(captureTool.name) &&
    stringOrNull(captureTool.version) &&
    stringOrNull(captureTool.hookManifestId ?? captureTool.hookManifestSha256)
  );
  const captureScopeDeclared = ISOLATED_CAPTURE_KINDS.has(captureKind);
  const captureScopeMatchesEvents =
    captureKind === 'role-sp'
      ? hasRecoverSpEvents && !hasToughnessEvents && !hasKiboEnergyEvents
      : captureKind === 'kibo-energy'
        ? hasKiboEnergyEvents && !hasRecoverSpEvents && !hasToughnessEvents
        : captureKind === 'toughness'
          ? hasToughnessEvents && !hasRecoverSpEvents && !hasKiboEnergyEvents
          : false;
  const captureBindingComplete = Boolean(
    stringOrNull(captureBinding.actionId) &&
    stringOrNull(captureBinding.actorId) &&
    stringOrNull(captureBinding.targetId) &&
    (captureKind !== 'kibo-energy' ||
      (stringOrNull(captureBinding.slotId) &&
        positiveIntegerOrNull(captureBinding.kiboId)))
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
    captureScopeDeclared,
    captureScopeMatchesEvents,
    captureBindingComplete,
    eventSequenceComplete:
      requiredEventTypes.length > 0 &&
      missingEventTypes.length === 0 &&
      recoverSpSequenceOrdered,
    eventTimingComplete: timingComplete,
    eventSourceIdentityComplete: sourceIdentityComplete,
    eventValuesComplete,
    toughnessCaptureSequenceComplete:
      !hasToughnessEvents || toughnessSequenceAudit.captureSequenceComplete,
    toughnessFrameClockComplete:
      !hasToughnessEvents || toughnessSequenceAudit.frameClockComplete,
    toughnessHookInvocationComplete:
      !hasToughnessEvents || toughnessSequenceAudit.hookInvocationComplete,
    toughnessSourceCorrelationComplete:
      !hasToughnessEvents || toughnessSequenceAudit.sourceCorrelationComplete,
    toughnessThreadConsistencyComplete:
      !hasToughnessEvents || toughnessSequenceAudit.threadConsistencyComplete,
    toughnessSessionIntegrityComplete:
      !hasToughnessEvents || toughnessSequenceAudit.sessionIntegrityComplete,
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
    captureKind,
    eventCount: capture.events.length,
    eventTypes,
    requiredEventTypes,
    missingEventTypes,
    recoverSpSequenceOrdered,
    toughnessSequenceAudit,
    checks,
    productionEligible,
  };
}

function createToughnessSequenceAudit({ capture, events }) {
  const captureSequences = events.map(event =>
    positiveIntegerOrNull(event.captureSequence)
  );
  const captureSequenceComplete =
    events.length > 0 &&
    captureSequences.every(Boolean) &&
    captureSequences.every((value, index) => value === index + 1);
  const frameClockComplete = events.every(
    event =>
      nonNegativeIntegerOrNull(event.clientFrameCount) != null &&
      nonNegativeNumberOrNull(event.clientDeltaTimeSeconds) != null &&
      positiveIntegerOrNull(event.threadId) != null
  );

  const invocationGroups = groupEventsBy(events, event =>
    stringOrNull(event.hookInvocationIdentity)
  );
  const eventGroups = groupEventsBy(
    events.filter(event => event.eventType !== 'toughness-state-update'),
    event => stringOrNull(event.eventIdentity)
  );
  const hookInvocationIdentitiesComplete = events.every(event =>
    Boolean(
      stringOrNull(event.hookInvocationIdentity) &&
      stringOrNull(event.hookMethodKey)
    )
  );
  const hookInvocationRowsUnique = invocationGroups.every(group => {
    const rowKeys = group.map(event =>
      [event.eventType, event.phase ?? null, event.methodKey ?? null].join('|')
    );
    return new Set(rowKeys).size === rowKeys.length;
  });
  const hookInvocationMethodsConsistent = invocationGroups.every(
    group =>
      new Set(group.map(event => stringOrNull(event.hookMethodKey))).size === 1
  );
  const hookInvocationPhasesComplete = invocationGroups.every(group => {
    const phases = group
      .map(event => normalizeHookPhase(event.phase))
      .filter(Boolean);
    if (phases.length === 0) return group.length === 1;
    return (
      phases.length === group.length &&
      phases.filter(phase => phase === 'entry').length === 1 &&
      phases.filter(phase => phase === 'exit').length === 1 &&
      phases.length === 2
    );
  });
  const hookInvocationComplete =
    events.length > 0 &&
    hookInvocationIdentitiesComplete &&
    hookInvocationRowsUnique &&
    hookInvocationMethodsConsistent &&
    hookInvocationPhasesComplete;
  const sourceCorrelationComplete = eventGroups.every(group => {
    const sourcePaths = group.map(event =>
      JSON.stringify(event.sourceSequencePath ?? null)
    );
    const packetSequences = group.map(event =>
      positiveIntegerOrNull(event.damagePacketSequence)
    );
    const sourcePath = group[0]?.sourceSequencePath;
    const packetSequence = packetSequences[0];
    const requiresPacketCorrelation = group.some(event =>
      TOUGHNESS_PACKET_CORRELATED_EVENT_TYPES.has(event.eventType)
    );
    if (!requiresPacketCorrelation && packetSequence == null) {
      return Boolean(
        Array.isArray(sourcePath) &&
        sourcePath.length === 0 &&
        new Set(sourcePaths).size === 1 &&
        packetSequences.every(value => value == null)
      );
    }
    return Boolean(
      Array.isArray(sourcePath) &&
      sourcePath.length > 0 &&
      packetSequence != null &&
      sourcePath.at(-1) === packetSequence &&
      new Set(sourcePaths).size === 1 &&
      new Set(packetSequences).size === 1
    );
  });
  const threadConsistencyComplete = [...invocationGroups, ...eventGroups].every(
    group =>
      new Set(group.map(event => positiveIntegerOrNull(event.threadId)))
        .size === 1
  );

  const integrity = capture.captureIntegrity ?? {};
  const finalSequence = captureSequences.at(-1) ?? null;
  const observedDamagePacketCount = new Set(
    events
      .filter(
        event =>
          event.eventType === 'toughness-packet-execution' &&
          normalizeHookPhase(event.phase) === 'entry'
      )
      .map(event => stringOrNull(event.eventIdentity))
      .filter(Boolean)
  ).size;
  const observedHookInvocationCount = invocationGroups.length;
  const sessionIntegrityComplete = Boolean(
    integrity.status === 'capture-complete' &&
    nonNegativeIntegerOrNull(integrity.agentEmittedEventCount) ===
      events.length &&
    nonNegativeIntegerOrNull(integrity.hostReceivedEventCount) ===
      events.length &&
    positiveIntegerOrNull(integrity.finalCaptureSequence) === finalSequence &&
    nonNegativeIntegerOrNull(integrity.damagePacketCount) ===
      observedDamagePacketCount &&
    nonNegativeIntegerOrNull(integrity.hookInvocationCount) >=
      observedHookInvocationCount &&
    nonNegativeIntegerOrNull(integrity.openThreadStateCount) === 0 &&
    nonNegativeIntegerOrNull(integrity.diagnosticCount) === 0 &&
    Array.isArray(integrity.diagnostics) &&
    integrity.diagnostics.length === 0 &&
    stringOrNull(integrity.completedAt)
  );

  return {
    captureSequenceComplete,
    frameClockComplete,
    hookInvocationComplete,
    hookInvocationRowsUnique,
    hookInvocationMethodsConsistent,
    hookInvocationPhasesComplete,
    sourceCorrelationComplete,
    threadConsistencyComplete,
    sessionIntegrityComplete,
    observedFinalCaptureSequence: finalSequence,
    observedDamagePacketCount,
    observedHookInvocationCount,
    agentEmittedEventCount: nonNegativeIntegerOrNull(
      integrity.agentEmittedEventCount
    ),
    hostReceivedEventCount: nonNegativeIntegerOrNull(
      integrity.hostReceivedEventCount
    ),
    agentDamagePacketCount: nonNegativeIntegerOrNull(
      integrity.damagePacketCount
    ),
    agentHookInvocationCount: nonNegativeIntegerOrNull(
      integrity.hookInvocationCount
    ),
    openThreadStateCount: nonNegativeIntegerOrNull(
      integrity.openThreadStateCount
    ),
    diagnosticCount: nonNegativeIntegerOrNull(integrity.diagnosticCount),
  };
}

function normalizeHookPhase(value) {
  const phase = stringOrNull(value);
  if (!phase) return null;
  if (phase === 'entry' || phase.endsWith('-entry')) return 'entry';
  if (phase === 'exit' || phase.endsWith('-exit')) return 'exit';
  return null;
}

function groupEventsBy(events, identitySelector) {
  const groups = new Map();
  let missingIdentityIndex = 0;
  for (const event of events) {
    const identity = identitySelector(event);
    const groupIdentity = identity ?? `__missing__${missingIdentityIndex++}`;
    const group = groups.get(groupIdentity) ?? [];
    group.push(event);
    groups.set(groupIdentity, group);
  }
  return [...groups.values()];
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

function nonNegativeIntegerOrNull(value) {
  const numeric = numberOrNull(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
}

function nonNegativeNumberOrNull(value) {
  const numeric = numberOrNull(value);
  return numeric != null && numeric >= 0 ? numeric : null;
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
