import { describe, expect, it } from 'vitest';
import { createWorkbenchTimelineTopology } from '../../domain/workbenchTimelineTopology';

describe('workbench timeline topology', () => {
  it('defines three actor groups, three kibo lanes, and five independent curves', () => {
    const topology = createWorkbenchTimelineTopology({
      teamSlots: [
        { slotId: 'team-slot-1', position: 0, characterId: 109001 },
        { slotId: 'team-slot-2', position: 1, characterId: 101003 },
        { slotId: 'team-slot-3', position: 2, characterId: 101007 },
      ],
      actorConfigs: [
        { characterId: 109001, loadout: { kiboId: 500001 } },
        { characterId: 101003 },
        { characterId: 101007 },
      ],
      enemyId: 300032,
    });

    expect(topology).toMatchObject({
      contractName: 'AzPrWorkbenchTimelineTopology',
      status: 'workbench-timeline-topology-ready',
      ready: true,
      policy: {
        fixedActorSlotCount: 3,
        kiboEffectsAppliedToCalculators: false,
        actorEnergyCurvesIndependent: true,
        enemyStateCurvesIndependent: true,
      },
      summary: {
        actorGroupCount: 3,
        actorActionLaneCount: 3,
        kiboLaneCount: 3,
        actorEnergyCurveCount: 3,
        enemyEventLaneCount: 1,
        enemyStateCurveCount: 2,
        stateCurveCount: 5,
      },
    });
    expect(
      topology.actorGroups.map(group => group.energyCurve.actorId)
    ).toEqual(['actor-109001', 'actor-101003', 'actor-101007']);
    expect(topology.actorGroups[0].kiboLane).toMatchObject({
      kiboId: 500001,
      appliedToCalculators: false,
    });
    expect(topology.enemyGroup).toMatchObject({
      eventLane: { laneId: 'enemy-events' },
      hpCurve: { trackKey: 'enemyHpDamage' },
      toughnessCurve: { trackKey: 'enemyToughnessDamage' },
    });
  });
});
