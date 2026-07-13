export const KIBO_ENERGY_RUNTIME_CURVES_CONTRACT_NAME =
  'AzPrKiboEnergyRuntimeCurves';
export const KIBO_ENERGY_RUNTIME_CURVES_CONTRACT_VERSION = 2;

function createKiboEnergySourceSemantics() {
  return {
    sourceKind: 'azpr-pet-ultimate-cooldown-observation',
    semanticResource: 'pet-ultimate-readiness',
    presentationResource: 'kibo-energy',
    status: 'observable-contract-confirmed-values-unresolved',
    observation: {
      api: 'PetUltimateCdTime',
      remainingValue: 'cdTime',
      totalValue: 'totalTime',
      readyWhen: 'cdTime <= 0',
      uiFillExpression: 'cdTime / totalTime',
      valueUnit: 'seconds',
    },
    evidenceRefs: [
      'ResourcesAssets/Lua/64/src/ui/pages/battle/moduleBattlePetSkill.lua',
      'ResourcesAssets/Lua/64/src/ui/pages/battle/moduleBattleControl.lua',
    ],
    initialValueSourceStatus: 'unresolved',
    totalValueSourceStatus: 'unresolved',
    eventValueSourceStatus: 'unresolved',
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
      ? 'tracking-zero-source-semantics-confirmed-value-unresolved'
      : 'tracking-slot-unconfigured';
    const sourceSemantics = createKiboEnergySourceSemantics();
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
      semanticResource: sourceSemantics.semanticResource,
      sourceSemantics,
      baseline,
      stateMetric: {
        key: 'kiboEnergy',
        label: '奇波能量',
        valueUnit: 'kibo-energy',
        semanticResource: sourceSemantics.semanticResource,
        observedSourceValueUnit: sourceSemantics.observation.valueUnit,
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
