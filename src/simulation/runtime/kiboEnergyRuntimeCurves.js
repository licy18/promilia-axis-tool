export const KIBO_ENERGY_RUNTIME_CURVES_CONTRACT_NAME =
  'AzPrKiboEnergyRuntimeCurves';
export const KIBO_ENERGY_RUNTIME_CURVES_CONTRACT_VERSION = 3;

const AZPR_TIMELINE_FRAME_MS = 1000 / 60;

function createKiboEnergySourceSemantics() {
  return {
    sourceKind: 'azpr-pet-ultimate-cooldown-observation',
    semanticResource: 'pet-ultimate-readiness',
    status: 'observable-contract-confirmed-values-unresolved',
    observation: {
      api: 'PetUltimateCdTime',
      valueUnit: 'seconds',
    },
    valueSourceStatus: 'unresolved',
    trackingOnly: true,
    appliedToCalculators: false,
  };
}

export function createKiboEnergyRuntimeCurves({ scenario } = {}) {
  const topologyGroups =
    scenario?.sourceProject?.metadata?.timelineTopology?.actorGroups ?? [];
  const actors = Array.isArray(scenario?.actors) ? scenario.actors : [];
  const actorById = new Map(actors.map(actor => [String(actor?.id), actor]));
  const groups = topologyGroups.length
    ? topologyGroups
    : actors.map((actor, index) => ({
        slotId: `team-slot-${index + 1}`,
        position: index,
        actorId: actor.id,
        characterId: actor.characterId,
        kiboLane: {
          kiboId: actor.loadout?.kiboId ?? null,
          kiboName: null,
        },
      }));

  return groups.map((group, index) => {
    const actor = actorById.get(String(group.actorId));
    const slotId = group.slotId ?? `team-slot-${index + 1}`;
    const actorId = group.actorId ?? actor?.id ?? '';
    const kiboId = positiveIntegerOrNull(
      group.kiboEnergyCurve?.kiboId ??
        group.kiboLane?.kiboId ??
        actor?.loadout?.kiboId
    );
    const kiboName =
      group.kiboEnergyCurve?.kiboName ??
      group.kiboLane?.kiboName ??
      (kiboId ? `奇波 ${kiboId}` : '未绑定奇波');
    const observations = createKiboEnergyObservations({
      scenario,
      slotId,
      actorId,
      kiboId,
    });
    const firstObservation = observations[0];
    const lastObservation = observations.at(-1);
    const baselineConfirmed = firstObservation?.frameIndex === 0;
    const initialValue = baselineConfirmed
      ? getReadinessValue(firstObservation)
      : 0;
    const currentValue = lastObservation
      ? getReadinessValue(lastObservation)
      : initialValue;
    const maxValue = observations.length
      ? Math.max(...observations.map(observation => observation.totalTime))
      : null;
    const baselineStatus = kiboId
      ? baselineConfirmed
        ? 'runtime-observed-pet-ultimate-readiness-baseline'
        : observations.length > 0
          ? 'runtime-observed-pet-ultimate-readiness-baseline-unresolved'
          : 'tracking-zero-source-semantics-confirmed-value-unresolved'
      : 'tracking-slot-unconfigured';
    const sourceSemantics = createKiboEnergySourceSemantics();
    if (observations.length > 0) {
      sourceSemantics.status =
        'runtime-pet-ultimate-cooldown-observations-validated';
      sourceSemantics.valueSourceStatus = baselineConfirmed
        ? 'runtime-observed-at-frame-zero'
        : 'unresolved-before-first-observation';
    }
    const baseline = {
      sourceKind: baselineConfirmed
        ? 'runtime-pet-ultimate-readiness-observation'
        : 'workbench-kibo-energy-tracking-baseline',
      status: baselineStatus,
      initialValue,
      currentValue,
      maxValue,
      confirmed: baselineConfirmed,
      appliedToCalculators: false,
    };
    const points = createKiboEnergyCurvePoints({
      observations,
      slotId,
      kiboId,
    });

    return {
      schemaVersion: 1,
      contractName: KIBO_ENERGY_RUNTIME_CURVES_CONTRACT_NAME,
      contractVersion: KIBO_ENERGY_RUNTIME_CURVES_CONTRACT_VERSION,
      resourceOwnerKind: 'kibo',
      slotId,
      actorId,
      actorName: actor?.name ?? '',
      characterId: Number(group.characterId ?? actor?.characterId) || null,
      kiboId,
      kiboName,
      resource: 'kibo-energy',
      semanticResource: sourceSemantics.semanticResource,
      sourceSemantics,
      baseline,
      stateMetric: {
        key: 'kiboEnergy',
        label: '奇波能量',
        valueUnit: 'kibo-energy',
        semanticResource: sourceSemantics.semanticResource,
        observedSourceValueUnit: 'seconds',
        initialValue,
        currentValue,
        maxValue,
        delta: roundNumber(currentValue - initialValue),
        baselineStatus,
        baselineConfirmed,
        stateLabel: '当前',
      },
      delta: roundNumber(currentValue - initialValue),
      pointCount: points.length,
      points,
      trackingOnly: true,
      appliedToCalculators: false,
      applied: points.length > 0,
      order: Number(group.position ?? index),
    };
  });
}

function createKiboEnergyObservations({ scenario, slotId, actorId, kiboId }) {
  if (!kiboId) {
    return [];
  }
  const durationMs = numberOrNull(scenario?.time?.durationMs);
  const byFrame = new Map();
  for (const capture of scenario?.runtimeSampleCaptures ?? []) {
    for (const [eventIndex, event] of (capture?.events ?? []).entries()) {
      if (
        event?.eventType !== 'pet-ultimate-cooldown-observed' ||
        event.slotId !== slotId ||
        event.actorId !== actorId ||
        positiveIntegerOrNull(event.kiboId) !== kiboId ||
        event.api !== 'PetUltimateCdTime' ||
        !positiveIntegerOrNull(event.petEntityId) ||
        !event.petEntityPointer
      ) {
        continue;
      }
      const cdTime = numberOrNull(event.cdTime);
      const totalTime = numberOrNull(event.totalTime);
      const observedTimeMs = numberOrNull(event.timeMs);
      const observedFrameIndex = integerOrNull(event.frameIndex);
      const frameIndex =
        observedFrameIndex ??
        (observedTimeMs == null
          ? null
          : Math.round(observedTimeMs / AZPR_TIMELINE_FRAME_MS));
      if (
        cdTime == null ||
        cdTime < 0 ||
        totalTime == null ||
        totalTime <= 0 ||
        event.ready !== (cdTime <= 0) ||
        frameIndex == null ||
        frameIndex < 0
      ) {
        continue;
      }
      const timeMs = roundNumber(frameIndex * AZPR_TIMELINE_FRAME_MS);
      if (
        (observedFrameIndex != null &&
          observedTimeMs != null &&
          Math.abs(observedTimeMs - timeMs) > AZPR_TIMELINE_FRAME_MS / 2) ||
        (durationMs != null && timeMs > durationMs)
      ) {
        continue;
      }
      byFrame.set(frameIndex, {
        ...event,
        captureSessionId:
          event.captureSessionId ?? capture.captureSessionId ?? null,
        eventIndex: integerOrNull(event.eventIndex) ?? eventIndex,
        frameIndex,
        timeMs,
        cdTime: roundNumber(cdTime),
        totalTime: roundNumber(totalTime),
      });
    }
  }
  return [...byFrame.values()].sort(
    (left, right) => left.frameIndex - right.frameIndex
  );
}

function createKiboEnergyCurvePoints({ observations, slotId, kiboId }) {
  return observations.map((observation, index) => {
    const currentValue = getReadinessValue(observation);
    const sourceDeltaId = [
      'kibo-energy-observation',
      slotId,
      kiboId,
      observation.captureSessionId ?? 'capture',
      observation.frameIndex,
      observation.eventIndex ?? index,
    ].join('|');
    return {
      sourceDeltaId,
      trackKey: 'kiboEnergyChange',
      actionId: observation.actionId ?? '',
      petEntityId: observation.petEntityId,
      timeMs: observation.timeMs,
      frameIndex: observation.frameIndex,
      cdTime: observation.cdTime,
      totalTime: observation.totalTime,
      ready: observation.ready,
      stateSnapshot: {
        after: {
          kiboEnergy: {
            currentValue,
            maxValue: observation.totalTime,
          },
        },
      },
    };
  });
}

function getReadinessValue(observation) {
  return roundNumber(
    observation.totalTime - Math.min(observation.cdTime, observation.totalTime)
  );
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function integerOrNull(value) {
  const number = Number(value);
  return value != null && value !== '' && Number.isInteger(number)
    ? number
    : null;
}

function numberOrNull(value) {
  const number = Number(value);
  return value != null && value !== '' && Number.isFinite(number)
    ? number
    : null;
}

function roundNumber(value) {
  return Number.isFinite(value) ? Number(value.toFixed(6)) : 0;
}
