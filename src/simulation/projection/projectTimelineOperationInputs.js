import {
  AZPR_PC_DEFAULT_INPUT_PROFILE_ID,
  resolveAzPrActionInputBinding,
  resolveAzPrSwitchInputBinding,
} from '../../domain/azprInputCommandProfile';
import { isVerifiedKiboJointAttack } from '../../domain/verifiedJointAttackContract';

export const TIMELINE_OPERATION_INPUT_SCHEMA_VERSION = 1;
export const TIMELINE_OPERATION_INPUT_CONTRACT_NAME =
  'AzPrTimelineOperationInputProjection';

export function projectTimelineOperationInputs({
  actions = [],
  actors = [],
  controlledActorTimeline = null,
  durationMs = 0,
  resolveActionMapping = () => null,
} = {}) {
  const normalizedDurationMs = Math.max(0, finiteNumber(durationMs));
  const transitionsByActionId = new Map(
    (controlledActorTimeline?.transitions ?? []).map(transition => [
      String(transition.actionId ?? ''),
      transition,
    ])
  );
  const jointAttackPairs = createJointAttackPairs(
    actions,
    actors,
    resolveActionMapping
  );
  const pairedKiboActionIds = new Set(
    [...jointAttackPairs.values()].map(pair => pair.kiboAction.id)
  );
  const markers = [];

  for (const action of actions) {
    if (isVerifiedKiboJointAttack(action, resolveActionMapping(action))) {
      continue;
    }
    const jointAttackPair = jointAttackPairs.get(action.id) ?? null;
    if (isActorJointAttack(action) && !jointAttackPair) {
      continue;
    }
    const marker =
      action?.type === 'switch'
        ? createSwitchMarker({
            action,
            actors,
            transition: transitionsByActionId.get(String(action.id ?? '')),
            durationMs: normalizedDurationMs,
          })
        : createActionMarker({
            action,
            durationMs: normalizedDurationMs,
            actionMapping: resolveActionMapping(action),
            jointAttackPair,
          });
    if (marker) markers.push(marker);
  }

  markers.sort(
    (left, right) =>
      left.startMs - right.startMs || left.id.localeCompare(right.id)
  );
  return {
    schemaVersion: TIMELINE_OPERATION_INPUT_SCHEMA_VERSION,
    contractName: TIMELINE_OPERATION_INPUT_CONTRACT_NAME,
    profileId: AZPR_PC_DEFAULT_INPUT_PROFILE_ID,
    sourceKind: 'azpr-project-action-input-projection',
    status: 'timeline-operation-input-projection-ready',
    markers,
    summary: {
      markerCount: markers.length,
      pressCount: markers.filter(marker => marker.mode === 'press').length,
      holdCount: markers.filter(marker => marker.mode === 'hold').length,
      unresolvedCount: markers.filter(marker => !marker.applied).length,
      jointAttackCount: jointAttackPairs.size,
      pairedKiboActionCount: pairedKiboActionIds.size,
    },
    applied: true,
  };
}

export function layoutTimelineOperationMarkers(
  markers = [],
  {
    durationMs = 0,
    trackWidthPx = 900,
    pressWidthPx = 30,
    holdLabelMinWidthPx = 68,
    gapPx = 3,
  } = {}
) {
  const normalizedDurationMs = Math.max(1, finiteNumber(durationMs));
  const normalizedTrackWidthPx = Math.max(1, finiteNumber(trackWidthPx));
  const normalizedPressWidthPx = Math.max(1, finiteNumber(pressWidthPx));
  const rowEnds = [];
  const positionedMarkers = [...markers]
    .sort(
      (left, right) =>
        left.startMs - right.startMs || left.id.localeCompare(right.id)
    )
    .map(marker => {
      const leftPx =
        (clamp(marker.startMs, 0, normalizedDurationMs) /
          normalizedDurationMs) *
        normalizedTrackWidthPx;
      const intervalWidthPx =
        marker.mode === 'hold' && marker.endMs != null
          ? ((clamp(marker.endMs, marker.startMs, normalizedDurationMs) -
              clamp(marker.startMs, 0, normalizedDurationMs)) /
              normalizedDurationMs) *
            normalizedTrackWidthPx
          : normalizedPressWidthPx;
      const widthPx = Math.max(
        marker.mode === 'hold'
          ? Math.max(1, finiteNumber(holdLabelMinWidthPx))
          : normalizedPressWidthPx,
        intervalWidthPx
      );
      const rightPx = leftPx + widthPx;
      let rowIndex = rowEnds.findIndex(
        occupiedRight => occupiedRight + gapPx <= leftPx
      );
      if (rowIndex < 0) {
        rowIndex = rowEnds.length;
        rowEnds.push(rightPx);
      } else {
        rowEnds[rowIndex] = rightPx;
      }
      return {
        ...marker,
        rowIndex,
        leftPx,
        intervalWidthPx,
        widthPx,
        rightPx,
      };
    });
  return {
    markers: positionedMarkers,
    rowCount: Math.max(1, rowEnds.length),
  };
}

function createActionMarker({
  action,
  durationMs,
  actionMapping,
  jointAttackPair,
}) {
  const binding = resolveAzPrActionInputBinding(action, actionMapping);
  if (!binding) return null;
  const inputTrigger = resolveActionInputTrigger(action, actionMapping);
  const mode = inputTrigger?.mode ?? binding.defaultMode ?? 'press';
  const holdDurationMs =
    mode === 'hold' && finiteNumber(inputTrigger?.holdTriggerTimeMs) > 0
      ? finiteNumber(inputTrigger.holdTriggerTimeMs)
      : null;
  const contextualInputScheduling = action.contextualInputScheduling ?? null;
  const physicalInput = action.physicalInput ?? null;
  const physicalFrameRate =
    finiteNumber(inputTrigger?.physicalInput?.frameRate) || 60;
  const physicalPressMs =
    mode === 'hold' && physicalInput?.pressFrame != null
      ? (finiteNumber(physicalInput.pressFrame) * 1000) / physicalFrameRate
      : null;
  const startMs = clamp(
    finiteNumber(
      physicalPressMs ??
        contextualInputScheduling?.inputTimeMs ??
        action.startMs
    ),
    0,
    durationMs
  );
  const endMs =
    mode === 'hold' && physicalInput?.executionFrame != null
      ? clamp(
          (finiteNumber(physicalInput.executionFrame) * 1000) /
            physicalFrameRate,
          startMs,
          durationMs
        )
      : holdDurationMs == null
        ? null
        : clamp(startMs + holdDurationMs, startMs, durationMs);
  const holdResolved = mode !== 'hold' || endMs > startMs;
  return {
    schemaVersion: TIMELINE_OPERATION_INPUT_SCHEMA_VERSION,
    id: `operation-action-${action.id}`,
    command: binding.command,
    mode,
    keyCode: binding.keyCode,
    keyLabel: binding.keyLabel,
    displayLabel:
      mode === 'hold' ? `${binding.keyLabel} (Hold)` : binding.keyLabel,
    startMs,
    endMs,
    durationMs: endMs == null ? 0 : endMs - startMs,
    actionId: String(action.id ?? ''),
    relatedActionIds: jointAttackPair
      ? [String(action.id), String(jointAttackPair.kiboAction.id)]
      : [String(action.id ?? '')],
    switchTransitionId: null,
    actionName: jointAttackPair
      ? `${action.name} + ${jointAttackPair.kiboAction.name}`
      : String(action.name ?? action.actionKind ?? binding.command),
    actionKind: action.actionKind ?? action.type,
    executionStartMs: finiteNumber(
      contextualInputScheduling?.executionStartMs ?? action.startMs
    ),
    predecessorEffectiveEndMs:
      contextualInputScheduling?.predecessorEffectiveEndMs ?? null,
    contextualInputScheduling,
    physicalInput,
    attackSequenceIndex: positiveIntegerOrNull(action.attackSequenceIndex),
    sourceKind: binding.sourceKind,
    sourceIdentity: binding.sourceIdentity,
    triggerSourceKind: inputTrigger?.sourceKind ?? null,
    triggerSourceIdentity: inputTrigger?.sourceIdentity ?? null,
    confidence: holdResolved
      ? binding.confidence
      : (inputTrigger?.confidence ?? 'low'),
    status: holdResolved
      ? binding.status
      : 'timeline-operation-hold-duration-unresolved',
    applied: holdResolved,
  };
}

function createJointAttackPairs(actions, actors, resolveActionMapping) {
  const actorById = new Map(
    actors.map(actor => [String(actor.id ?? ''), actor])
  );
  const kiboCombos = actions.filter(action =>
    isVerifiedKiboJointAttack(action, resolveActionMapping(action))
  );
  const pairs = new Map();
  for (const action of actions.filter(isActorJointAttack)) {
    const actor = actorById.get(String(action.actorId ?? '')) ?? action.actor;
    const configuredKiboId = positiveIntegerOrNull(actor?.loadout?.kiboId);
    if (configuredKiboId == null) continue;
    const frameIndex = timelineFrameIndex(action.startMs);
    const kiboAction = kiboCombos.find(
      candidate =>
        String(candidate.actorId ?? '') === String(action.actorId ?? '') &&
        positiveIntegerOrNull(candidate.kiboId) === configuredKiboId &&
        timelineFrameIndex(candidate.startMs) === frameIndex
    );
    if (kiboAction) {
      pairs.set(action.id, { actorAction: action, kiboAction, frameIndex });
    }
  }
  return pairs;
}

function isActorJointAttack(action) {
  return action.type === 'skill' && action.actionKind === 'star-combo';
}

function timelineFrameIndex(timeMs) {
  return Math.round(finiteNumber(timeMs) / (1000 / 60));
}

function createSwitchMarker({ action, actors, transition, durationMs }) {
  const binding = resolveAzPrSwitchInputBinding({ action, actors });
  if (!binding) return null;
  const targetActor = actors[binding.slot - 1] ?? null;
  const startMs = clamp(
    finiteNumber(transition?.timeMs ?? action.startMs),
    0,
    durationMs
  );
  return {
    schemaVersion: TIMELINE_OPERATION_INPUT_SCHEMA_VERSION,
    id: `operation-switch-${transition?.transitionId ?? action.id}`,
    command: binding.command,
    mode: 'press',
    keyCode: binding.keyCode,
    keyLabel: binding.keyLabel,
    displayLabel: binding.keyLabel,
    startMs,
    endMs: null,
    durationMs: 0,
    actionId: String(action.id ?? ''),
    relatedActionIds: [String(action.id ?? '')],
    switchTransitionId: transition?.transitionId ?? null,
    actionName: `切换至 ${targetActor?.name ?? `角色 ${binding.slot}`}`,
    actionKind: 'switch',
    attackSequenceIndex: null,
    sourceKind: binding.sourceKind,
    sourceIdentity: binding.sourceIdentity,
    triggerSourceKind: controlledTransitionSourceKind(transition),
    triggerSourceIdentity: transition?.transitionId ?? null,
    confidence: binding.confidence,
    status: transition?.status ?? binding.status,
    applied: transition ? transition.applied !== false : true,
  };
}

function resolveActionInputTrigger(action, actionMapping) {
  if (action?.actionKind !== 'normal-attack') {
    return actionMapping?.inputTrigger ?? null;
  }
  const segmentIdentity = String(action.attackInput?.identity ?? '').trim();
  const controlSkillId = Number(action.attackInput?.controlSkillId);
  const sequenceIndex = Number(action.attackSequenceIndex);
  const segment = (actionMapping?.attackInputSegments ?? []).find(candidate =>
    segmentIdentity
      ? candidate.identity === segmentIdentity
      : (!controlSkillId || candidate.controlSkillId === controlSkillId) &&
        (!sequenceIndex || candidate.sequenceIndex === sequenceIndex)
  );
  return segment?.inputTrigger ?? actionMapping?.inputTrigger ?? null;
}

function controlledTransitionSourceKind(transition) {
  return transition
    ? 'azpr-controlled-actor-runtime-transition'
    : 'azpr-project-switch-action';
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
