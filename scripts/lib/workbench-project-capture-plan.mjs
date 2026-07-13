const REQUIRED_SLOT_IDS = ['team-slot-1', 'team-slot-2', 'team-slot-3'];
const WORKBENCH_PROJECT_TYPES = new Set([
  'workbench-project',
  'workbench-draft',
]);
const WORKBENCH_PROJECT_SCHEMA_MAX_VERSION = 16;

export function createSixResourceCapturePlanFromWorkbenchProject(
  rawProject,
  {
    planId,
    outputDirectory,
    durationSeconds = 30,
    roleActionIdsBySlot = {},
    kiboActionIdsBySlot = {},
  } = {}
) {
  const project = parseJson(rawProject);
  if (!project || typeof project !== 'object' || Array.isArray(project)) {
    throw new Error('Workbench project must be a JSON object');
  }
  if (
    project.game !== 'azur-promilia' ||
    !WORKBENCH_PROJECT_TYPES.has(project.type) ||
    !Number.isInteger(Number(project.schemaVersion)) ||
    Number(project.schemaVersion) < 1 ||
    Number(project.schemaVersion) > WORKBENCH_PROJECT_SCHEMA_MAX_VERSION
  ) {
    throw new Error('Workbench project identity is invalid or unsupported');
  }
  const normalizedPlanId = requiredString(planId, 'planId');
  const normalizedOutputDirectory = requiredString(
    outputDirectory,
    'outputDirectory'
  );
  const normalizedDurationSeconds = finiteNumberOrDefault(durationSeconds, 30);
  if (normalizedDurationSeconds < 0) {
    throw new Error('durationSeconds must be zero or positive');
  }

  const teamSlots = normalizeWorkbenchProjectTeamSlots(project.teamSlots);
  const actorConfigs = Array.isArray(project.actorConfigs)
    ? project.actorConfigs
    : [];
  const actionDrafts = Array.isArray(project.actionDrafts)
    ? project.actionDrafts
    : [];
  const enemyId = positiveIntegerOrNull(project.selection?.enemyId);
  if (enemyId == null) {
    throw new Error('Workbench project selection.enemyId is required');
  }

  const owners = teamSlots.map(slot => {
    const actorConfig = actorConfigs.find(
      config => Number(config?.characterId) === slot.characterId
    );
    const kiboId = positiveIntegerOrNull(actorConfig?.loadout?.kiboId);
    if (kiboId == null) {
      throw new Error(`${slot.slotId} does not have a bound kibo`);
    }
    const actorId = `actor-${slot.characterId}`;
    const roleAction = resolveWorkbenchProjectCaptureAction({
      actionDrafts,
      characterId: slot.characterId,
      slotId: slot.slotId,
      captureKind: 'role-sp',
      overrideActionId: roleActionIdsBySlot[slot.slotId],
    });
    const kiboAction = resolveWorkbenchProjectCaptureAction({
      actionDrafts,
      characterId: slot.characterId,
      slotId: slot.slotId,
      captureKind: 'kibo-energy',
      kiboId,
      overrideActionId: kiboActionIdsBySlot[slot.slotId],
    });
    return { ...slot, actorId, kiboId, roleAction, kiboAction };
  });

  return {
    schemaVersion: 1,
    game: 'azur-promilia',
    type: 'six-resource-runtime-capture-plan',
    template: false,
    planId: normalizedPlanId,
    targetId: `enemy-${enemyId}`,
    durationSeconds: normalizedDurationSeconds,
    outputDirectory: normalizedOutputDirectory,
    projectBinding: {
      projectType: project.type,
      projectSchemaVersion: Number(project.schemaVersion),
      savedAt: project.savedAt ?? project.exportedAt ?? null,
      selectedCharacterIds: owners.map(owner => owner.characterId),
      selectedKiboIds: owners.map(owner => owner.kiboId),
      selectedEnemyId: enemyId,
    },
    sessions: [
      ...owners.map(owner => ({
        captureSessionId: `${normalizedPlanId}-role-${owner.slotId}`,
        captureKind: 'role-sp',
        slotId: owner.slotId,
        actionId: owner.roleAction.id,
        actorId: owner.actorId,
        outputFile: `role-${owner.slotId}.jsonl`,
      })),
      ...owners.map(owner => ({
        captureSessionId: `${normalizedPlanId}-kibo-${owner.slotId}`,
        captureKind: 'kibo-energy',
        slotId: owner.slotId,
        actionId: owner.kiboAction.id,
        actorId: owner.actorId,
        kiboId: owner.kiboId,
        outputFile: `kibo-${owner.slotId}.jsonl`,
      })),
    ],
  };
}

function normalizeWorkbenchProjectTeamSlots(teamSlotsInput) {
  if (!Array.isArray(teamSlotsInput) || teamSlotsInput.length !== 3) {
    throw new Error('Workbench project must contain exactly 3 teamSlots');
  }
  const teamSlots = teamSlotsInput.map((slot, index) => {
    const slotId = requiredString(slot?.slotId, `teamSlots[${index}].slotId`);
    const characterId = positiveIntegerOrNull(slot?.characterId);
    if (characterId == null) {
      throw new Error(`teamSlots[${index}].characterId must be positive`);
    }
    return { slotId, characterId };
  });
  const actualSlotIds = teamSlots.map(slot => slot.slotId).sort();
  if (actualSlotIds.join('|') !== [...REQUIRED_SLOT_IDS].sort().join('|')) {
    throw new Error(
      'Workbench project must cover team-slot-1, team-slot-2, and team-slot-3 exactly once'
    );
  }
  assertUnique(teamSlots, slot => slot.characterId, 'team characterId');
  return REQUIRED_SLOT_IDS.map(slotId =>
    teamSlots.find(slot => slot.slotId === slotId)
  );
}

function resolveWorkbenchProjectCaptureAction({
  actionDrafts,
  characterId,
  slotId,
  captureKind,
  kiboId = null,
  overrideActionId = null,
}) {
  const ownedActions = actionDrafts.filter(
    action =>
      Number(action?.actorCharacterId) === characterId &&
      typeof action?.id === 'string' &&
      action.id.trim()
  );
  const candidates =
    captureKind === 'kibo-energy'
      ? ownedActions.filter(
          action =>
            action.type === 'kiboEvent' &&
            (positiveIntegerOrNull(action.kiboId) == null ||
              Number(action.kiboId) === kiboId)
        )
      : resolveRoleCaptureActionCandidates(ownedActions);
  const sortedCandidates = [...candidates].sort(
    (left, right) =>
      finiteNumberOrDefault(left.startMs, 0) -
        finiteNumberOrDefault(right.startMs, 0) ||
      left.id.localeCompare(right.id)
  );
  const normalizedOverrideActionId =
    typeof overrideActionId === 'string' ? overrideActionId.trim() : '';
  if (normalizedOverrideActionId) {
    const override = sortedCandidates.find(
      action => action.id === normalizedOverrideActionId
    );
    if (!override) {
      throw new Error(
        `${slotId} ${captureKind} override is not a compatible owner action: ${normalizedOverrideActionId}; candidates=${formatActionCandidates(sortedCandidates)}`
      );
    }
    return override;
  }
  if (sortedCandidates.length !== 1) {
    const optionName =
      captureKind === 'kibo-energy' ? '--kibo-action' : '--role-action';
    throw new Error(
      `${slotId} ${captureKind} requires exactly one compatible action; candidates=${formatActionCandidates(sortedCandidates)}; pass ${optionName} ${slotId}=ACTION_ID`
    );
  }
  return sortedCandidates[0];
}

function resolveRoleCaptureActionCandidates(ownedActions) {
  const skillActions = ownedActions.filter(action => action.type === 'skill');
  return skillActions.length > 0
    ? skillActions
    : ownedActions.filter(action => action.type === 'resource');
}

function formatActionCandidates(actions) {
  return actions.length > 0
    ? actions.map(action => `${action.id}:${action.type}`).join(',')
    : 'none';
}

function requiredString(value, field) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    throw new Error(`${field} is required`);
  }
  return text;
}

function finiteNumberOrDefault(value, fallback) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number)) {
    throw new Error(`Expected a finite number, received: ${value}`);
  }
  return number;
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function parseJson(value) {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function assertUnique(items, getValue, label) {
  const seen = new Set();
  for (const item of items) {
    const value = getValue(item);
    if (seen.has(value)) {
      throw new Error(`Duplicate ${label}: ${value}`);
    }
    seen.add(value);
  }
}
