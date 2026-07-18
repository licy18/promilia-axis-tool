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

export function createKiboEnergyRuntimeCurves({
  scenario,
  verifiedCombatRuntime = null,
} = {}) {
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

  if (verifiedCombatRuntime?.ready) {
    return createVerifiedKiboEnergyRuntimeCurves({
      groups,
      actorById,
      verifiedCombatRuntime,
    });
  }

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

function createVerifiedKiboEnergyRuntimeCurves({
  groups,
  actorById,
  verifiedCombatRuntime,
}) {
  const initialBySlot = new Map(
    (verifiedCombatRuntime.initialState?.kiboEnergy ?? []).map(entry => [
      entry.slotId,
      entry,
    ])
  );
  const finalBySlot = new Map(
    (verifiedCombatRuntime.finalState?.kiboEnergy ?? []).map(entry => [
      entry.slotId,
      entry,
    ])
  );
  const eventsBySlot = new Map();
  for (const event of verifiedCombatRuntime.kiboResourceEvents ?? []) {
    const slotId = event.payload?.slotId;
    if (!slotId) continue;
    const events = eventsBySlot.get(slotId) ?? [];
    events.push(event);
    eventsBySlot.set(slotId, events);
  }

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
    const initialState = initialBySlot.get(slotId) ?? null;
    const finalState = finalBySlot.get(slotId) ?? initialState;
    const initialValue = numberOrNull(initialState?.currentValue) ?? 0;
    const currentValue = numberOrNull(finalState?.currentValue) ?? initialValue;
    const maxValue =
      numberOrNull(finalState?.maxValue ?? initialState?.maxValue) ?? 1;
    const points = (eventsBySlot.get(slotId) ?? [])
      .map((event, eventIndex) => ({
        sourceDeltaId: [
          'verified-kibo-energy',
          slotId,
          event.actionId ?? 'system',
          event.hitKey ?? eventIndex,
          timeToFrame(event.timeMs),
        ].join('|'),
        trackKey: 'kiboEnergyChange',
        actionId: event.actionId ?? '',
        actorId: event.actorId ?? actorId,
        hitKey: event.hitKey ?? null,
        hitIndex: event.hitIndex ?? null,
        hitSkillId: event.hitSkillId ?? null,
        timeMs: roundNumber(event.timeMs),
        frameIndex: timeToFrame(event.timeMs),
        delta: roundNumber(event.payload?.change ?? 0),
        reason: event.payload?.reason ?? null,
        sourceIdentity: event.payload?.sourceIdentity ?? null,
        stateSnapshot: {
          after: {
            kiboEnergy: {
              currentValue: roundNumber(event.payload?.currentValue ?? 0),
              maxValue,
            },
          },
        },
      }))
      .sort(
        (left, right) =>
          left.timeMs - right.timeMs ||
          String(left.sourceDeltaId).localeCompare(String(right.sourceDeltaId))
      );
    const baselineStatus = kiboId
      ? 'verified-kibo-sp-runtime-baseline'
      : 'tracking-slot-unconfigured';
    const applied = Boolean(kiboId && initialState);
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
      semanticResource: 'kibo-sp',
      sourceSemantics: {
        sourceKind: 'azpr-verified-combat-runtime-kibo-sp',
        semanticResource: 'kibo-sp',
        status: applied
          ? 'verified-kibo-sp-runtime-applied'
          : 'verified-kibo-slot-unconfigured',
        valueSourceStatus: applied ? 'verified-formula-package' : 'unresolved',
        packageId: verifiedCombatRuntime.packageId,
        trackingOnly: !applied,
        appliedToCalculators: applied,
      },
      baseline: {
        sourceKind: 'azpr-verified-combat-runtime-kibo-sp',
        status: baselineStatus,
        initialValue,
        currentValue,
        maxValue,
        confirmed: applied,
        appliedToCalculators: applied,
      },
      stateMetric: {
        key: 'kiboEnergy',
        label: '奇波能量',
        valueUnit: 'sp',
        semanticResource: 'kibo-sp',
        initialValue,
        currentValue,
        maxValue,
        delta: roundNumber(currentValue - initialValue),
        baselineStatus,
        baselineConfirmed: applied,
        stateLabel: '当前',
      },
      delta: roundNumber(currentValue - initialValue),
      pointCount: points.length,
      points,
      trackingOnly: !applied,
      appliedToCalculators: applied,
      applied,
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
        event.ready !== cdTime <= 0 ||
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

function timeToFrame(timeMs) {
  return Math.max(0, Math.round(Number(timeMs) / AZPR_TIMELINE_FRAME_MS));
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
