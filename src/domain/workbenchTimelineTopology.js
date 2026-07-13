export const WORKBENCH_TIMELINE_TOPOLOGY_CONTRACT_NAME =
  'AzPrWorkbenchTimelineTopology';
export const WORKBENCH_TIMELINE_TOPOLOGY_CONTRACT_VERSION = 2;
export const WORKBENCH_TEAM_SLOT_COUNT = 3;

export function createWorkbenchTimelineTopology({
  teamSlots = [],
  actorConfigs = [],
  kibos = [],
  enemyId = null,
} = {}) {
  const configsByCharacterId = new Map(
    actorConfigs.map(config => [Number(config?.characterId), config])
  );
  const kibosById = new Map(kibos.map(kibo => [Number(kibo?.id), kibo]));
  const actorGroups = teamSlots
    .slice(0, WORKBENCH_TEAM_SLOT_COUNT)
    .map(slot => {
      const characterId = Number(slot.characterId);
      const actorId = `actor-${characterId}`;
      const config = configsByCharacterId.get(characterId);
      const kiboId = positiveIntegerOrNull(config?.loadout?.kiboId);
      const kibo = kibosById.get(kiboId);
      return {
        groupId: `actor-group-${slot.position + 1}`,
        slotId: slot.slotId,
        position: slot.position,
        characterId,
        actorId,
        actionLane: { laneId: actorId, kind: 'actor-action', editable: true },
        kiboLane: {
          laneId: `kibo-${slot.slotId}`,
          kind: 'actor-kibo',
          editable: true,
          kiboId,
          kiboName: kibo?.name ?? null,
          appliedToCalculators: false,
        },
        energyCurve: {
          laneId: `energy-${actorId}`,
          kind: 'actor-energy-curve',
          trackKey: 'selfEnergyChange',
          actorId,
        },
        kiboEnergyCurve: {
          laneId: `kibo-energy-${slot.slotId}`,
          kind: 'kibo-energy-curve',
          trackKey: 'kiboEnergyChange',
          slotId: slot.slotId,
          actorId,
          characterId,
          kiboId,
          kiboName: kibo?.name ?? null,
          appliedToCalculators: false,
          trackingOnly: true,
        },
      };
    });
  const enemyGroup = {
    groupId: 'enemy-group',
    enemyId: positiveIntegerOrNull(enemyId),
    eventLane: {
      laneId: 'enemy-events',
      kind: 'enemy-event',
      editable: true,
    },
    hpCurve: {
      laneId: 'enemy-hp-curve',
      kind: 'enemy-hp-curve',
      trackKey: 'enemyHpDamage',
    },
    toughnessCurve: {
      laneId: 'enemy-toughness-curve',
      kind: 'enemy-toughness-curve',
      trackKey: 'enemyToughnessDamage',
    },
  };
  const ready = actorGroups.length === WORKBENCH_TEAM_SLOT_COUNT;

  return {
    schemaVersion: 2,
    contractName: WORKBENCH_TIMELINE_TOPOLOGY_CONTRACT_NAME,
    contractVersion: WORKBENCH_TIMELINE_TOPOLOGY_CONTRACT_VERSION,
    status: ready
      ? 'workbench-timeline-topology-ready'
      : 'workbench-timeline-topology-incomplete',
    ready,
    actorGroups,
    enemyGroup,
    policy: {
      fixedActorSlotCount: WORKBENCH_TEAM_SLOT_COUNT,
      kiboEffectsAppliedToCalculators: false,
      actorEnergyCurvesIndependent: true,
      kiboEnergyCurvesIndependent: true,
      kiboEnergyChangesAppliedToCalculators: false,
      enemyStateCurvesIndependent: true,
    },
    summary: {
      actorGroupCount: actorGroups.length,
      actorActionLaneCount: actorGroups.length,
      kiboLaneCount: actorGroups.length,
      actorEnergyCurveCount: actorGroups.length,
      kiboEnergyCurveCount: actorGroups.length,
      energyCurveCount: actorGroups.length * 2,
      enemyEventLaneCount: 1,
      enemyStateCurveCount: 2,
      stateCurveCount: actorGroups.length * 2 + 2,
    },
  };
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
