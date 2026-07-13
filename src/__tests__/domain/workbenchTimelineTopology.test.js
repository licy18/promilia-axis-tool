import { describe, expect, it } from 'vitest';
import { createWorkbenchTimelineTopology } from '../../domain/workbenchTimelineTopology';

describe('workbench timeline topology', () => {
  it('defines three actor groups, six energy curves, and two enemy curves', () => {
    const topology = createWorkbenchTimelineTopology({
      teamSlots: [
        { slotId: 'team-slot-1', position: 0, characterId: 109001 },
        { slotId: 'team-slot-2', position: 1, characterId: 101003 },
        { slotId: 'team-slot-3', position: 2, characterId: 101007 },
      ],
      actorConfigs: [
        { characterId: 109001, loadout: { kiboId: 500001 } },
        { characterId: 101003, loadout: { kiboId: 500002 } },
        { characterId: 101007, loadout: { kiboId: 500003 } },
      ],
      kibos: [
        { id: 500001, name: '奇波一' },
        { id: 500002, name: '奇波二' },
        { id: 500003, name: '奇波三' },
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
        kiboEnergyCurvesIndependent: true,
        kiboEnergyChangesAppliedToCalculators: false,
        enemyStateCurvesIndependent: true,
      },
      summary: {
        actorGroupCount: 3,
        actorActionLaneCount: 3,
        kiboLaneCount: 3,
        actorEnergyCurveCount: 3,
        kiboEnergyCurveCount: 3,
        energyCurveCount: 6,
        enemyEventLaneCount: 1,
        enemyStateCurveCount: 2,
        stateCurveCount: 8,
      },
    });
    expect(
      topology.actorGroups.map(group => group.energyCurve.actorId)
    ).toEqual(['actor-109001', 'actor-101003', 'actor-101007']);
    expect(topology.actorGroups[0].kiboLane).toMatchObject({
      kiboId: 500001,
      kiboName: '奇波一',
      appliedToCalculators: false,
    });
    expect(topology.actorGroups.map(group => group.kiboEnergyCurve)).toEqual([
      expect.objectContaining({
        slotId: 'team-slot-1',
        kiboId: 500001,
        kiboName: '奇波一',
        trackKey: 'kiboEnergyChange',
        trackingOnly: true,
        appliedToCalculators: false,
      }),
      expect.objectContaining({
        slotId: 'team-slot-2',
        kiboId: 500002,
        kiboName: '奇波二',
      }),
      expect.objectContaining({
        slotId: 'team-slot-3',
        kiboId: 500003,
        kiboName: '奇波三',
      }),
    ]);
    expect(topology.enemyGroup).toMatchObject({
      eventLane: { laneId: 'enemy-events' },
      hpCurve: { trackKey: 'enemyHpDamage' },
      toughnessCurve: { trackKey: 'enemyToughnessDamage' },
    });
  });
});
