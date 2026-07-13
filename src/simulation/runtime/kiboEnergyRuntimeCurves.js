export const KIBO_ENERGY_RUNTIME_CURVES_CONTRACT_NAME =
  'AzPrKiboEnergyRuntimeCurves';
export const KIBO_ENERGY_RUNTIME_CURVES_CONTRACT_VERSION = 1;

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
    const kiboId = positiveIntegerOrNull(
      group.kiboEnergyCurve?.kiboId ??
        group.kiboLane?.kiboId ??
        actor?.loadout?.kiboId
    );
    const kiboName =
      group.kiboEnergyCurve?.kiboName ??
      group.kiboLane?.kiboName ??
      (kiboId ? `奇波 ${kiboId}` : '未绑定奇波');
    const baselineStatus = kiboId
      ? 'tracking-default-zero-unconfirmed'
      : 'tracking-slot-unconfigured';
    const baseline = {
      sourceKind: 'workbench-kibo-energy-tracking-baseline',
      status: baselineStatus,
      initialValue: 0,
      currentValue: 0,
      maxValue: null,
      confirmed: false,
      appliedToCalculators: false,
    };

    return {
      schemaVersion: 1,
      contractName: KIBO_ENERGY_RUNTIME_CURVES_CONTRACT_NAME,
      contractVersion: KIBO_ENERGY_RUNTIME_CURVES_CONTRACT_VERSION,
      resourceOwnerKind: 'kibo',
      slotId: group.slotId ?? `team-slot-${index + 1}`,
      actorId: group.actorId ?? actor?.id ?? '',
      actorName: actor?.name ?? '',
      characterId: Number(group.characterId ?? actor?.characterId) || null,
      kiboId,
      kiboName,
      resource: 'kibo-energy',
      baseline,
      stateMetric: {
        key: 'kiboEnergy',
        label: '奇波能量',
        valueUnit: 'kibo-energy',
        initialValue: 0,
        currentValue: 0,
        maxValue: null,
        delta: 0,
        baselineStatus,
        baselineConfirmed: false,
        stateLabel: '当前',
      },
      delta: 0,
      pointCount: 0,
      points: [],
      trackingOnly: true,
      appliedToCalculators: false,
      applied: false,
      order: Number(group.position ?? index),
    };
  });
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
