export const WORKBENCH_TIMELINE_TOPOLOGY_CONTRACT_NAME =
  'AzPrWorkbenchTimelineTopology';
export const WORKBENCH_TIMELINE_TOPOLOGY_CONTRACT_VERSION = 1;
export const WORKBENCH_TEAM_SLOT_COUNT = 3;

export function createWorkbenchTimelineTopology({
  teamSlots = [],
  actorConfigs = [],
  enemyId = null,
} = {}) {
  const configsByCharacterId = new Map(
    actorConfigs.map(config => [Number(config?.characterId), config])
  );
  const actorGroups = teamSlots
    .slice(0, WORKBENCH_TEAM_SLOT_COUNT)
    .map(slot => {
      const characterId = Number(slot.characterId);
      const actorId = `actor-${characterId}`;
      const config = configsByCharacterId.get(characterId);
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
          kiboId: positiveIntegerOrNull(config?.loadout?.kiboId),
          appliedToCalculators: false,
        },
        energyCurve: {
          laneId: `energy-${actorId}`,
          kind: 'actor-energy-curve',
          trackKey: 'selfEnergyChange',
          actorId,
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
    schemaVersion: 1,
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
      enemyStateCurvesIndependent: true,
    },
    summary: {
      actorGroupCount: actorGroups.length,
      actorActionLaneCount: actorGroups.length,
      kiboLaneCount: actorGroups.length,
      actorEnergyCurveCount: actorGroups.length,
      enemyEventLaneCount: 1,
      enemyStateCurveCount: 2,
      stateCurveCount: actorGroups.length + 2,
    },
  };
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
