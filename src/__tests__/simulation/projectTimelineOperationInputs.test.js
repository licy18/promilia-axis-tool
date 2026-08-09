import { describe, expect, it } from 'vitest';
import { frameToMs } from '../../domain/timebase';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import {
  layoutTimelineOperationMarkers,
  projectTimelineOperationInputs,
} from '../../simulation/projection/projectTimelineOperationInputs';

describe('projectTimelineOperationInputs', () => {
  beforeAll(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
  });

  it('projects a contextual input marker independently from action execution', () => {
    const projection = projectTimelineOperationInputs({
      actions: [
        {
          id: 'buffered-derived-action',
          type: 'skill',
          actionKind: 'charged-attack',
          name: '特殊重击',
          actorId: 'actor-jade',
          startMs: frameToMs(120),
          contextualInputScheduling: {
            inputTimeMs: frameToMs(86),
            executionStartMs: frameToMs(120),
            predecessorEffectiveEndMs: frameToMs(120),
            applied: true,
          },
        },
      ],
      actors: [{ id: 'actor-jade', characterId: 101010 }],
      durationMs: 10_000,
      resolveActionMapping: () => ({
        actionKind: 'charged-attack',
        inputTrigger: { mode: 'press' },
      }),
    });

    expect(projection.markers[0]).toMatchObject({
      actionId: 'buffered-derived-action',
      startMs: frameToMs(86),
      executionStartMs: frameToMs(120),
      predecessorEffectiveEndMs: frameToMs(120),
    });
  });

  it('projects one press for every independent normal attack input segment', () => {
    const actions = Array.from({ length: 5 }, (_, index) =>
      createAction({
        id: `lilly-a${index + 1}`,
        name: `A${index + 1}`,
        actionKind: 'normal-attack',
        attackSequenceIndex: index + 1,
        startMs: index * 400,
      })
    );
    const projection = projectTimelineOperationInputs({
      actions,
      durationMs: 3000,
    });

    expect(projection.markers).toHaveLength(5);
    expect(
      projection.markers.map(marker => [
        marker.actionId,
        marker.keyLabel,
        marker.mode,
        marker.startMs,
      ])
    ).toEqual([
      ['lilly-a1', 'LMB', 'press', 0],
      ['lilly-a2', 'LMB', 'press', 400],
      ['lilly-a3', 'LMB', 'press', 800],
      ['lilly-a4', 'LMB', 'press', 1200],
      ['lilly-a5', 'LMB', 'press', 1600],
    ]);
  });

  it('moves and removes only the marker derived from the edited attack input', () => {
    const actions = Array.from({ length: 3 }, (_, index) =>
      createAction({
        id: `attack-a${index + 1}`,
        name: `A${index + 1}`,
        actionKind: 'normal-attack',
        attackSequenceIndex: index + 1,
        startMs: index * 500,
      })
    );
    const baseline = projectTimelineOperationInputs({
      actions,
      durationMs: 3000,
    });
    const edited = projectTimelineOperationInputs({
      actions: actions
        .filter(action => action.id !== 'attack-a3')
        .map(action =>
          action.id === 'attack-a2' ? { ...action, startMs: 1250 } : action
        ),
      durationMs: 3000,
    });

    expect(
      baseline.markers.map(marker => [marker.actionId, marker.startMs])
    ).toEqual([
      ['attack-a1', 0],
      ['attack-a2', 500],
      ['attack-a3', 1000],
    ]);
    expect(
      edited.markers.map(marker => [marker.actionId, marker.startMs])
    ).toEqual([
      ['attack-a1', 0],
      ['attack-a2', 1250],
    ]);
  });

  it('uses the verified hold input window instead of the action animation duration', () => {
    const projection = projectTimelineOperationInputs({
      actions: [
        createAction({
          id: 'charged-attack',
          name: '重击',
          actionKind: 'charged-attack',
          startMs: 1000,
          durationMs: 1800,
        }),
      ],
      durationMs: 3000,
      resolveActionMapping: () => ({
        inputTrigger: {
          mode: 'hold',
          holdTriggerTimeMs: 250,
          sourceKind: 'azpr-skillsub-logic-input-trigger',
          sourceIdentity: 'skillsub_logic[skillId=10100310]',
          confidence: 'high',
        },
      }),
    });
    const [marker] = projection.markers;
    const layout = layoutTimelineOperationMarkers(projection.markers, {
      durationMs: 3000,
      trackWidthPx: 900,
    });

    expect(marker).toMatchObject({
      mode: 'hold',
      startMs: 1000,
      endMs: 1250,
      durationMs: 250,
      applied: true,
    });
    expect(layout.markers[0].widthPx).toBe(75);
    expect(layout.markers[0].intervalWidthPx).toBe(75);
  });

  it('maps actor and energy-consuming kibo inputs through the central PC profile', () => {
    const actors = [
      {
        id: 'actor-a',
        characterId: 101003,
        name: '角色一',
        loadout: { kiboId: 500001 },
      },
      { id: 'actor-b', characterId: 101004, name: '角色二' },
      { id: 'actor-c', characterId: 101005, name: '角色三' },
    ];
    const actions = [
      createAction({
        id: 'skill',
        name: '星鸣技',
        actionKind: 'star-skill',
        startMs: 100,
      }),
      createAction({
        id: 'ultimate',
        name: '星决技',
        actionKind: 'ultimate',
        startMs: 200,
      }),
      createAction({
        id: 'actor-combo',
        name: '星结合击',
        actionKind: 'star-combo',
        actorId: 'actor-a',
        startMs: 250,
      }),
      {
        id: 'kibo-energy-skill',
        type: 'kiboEvent',
        skillId: 50000102,
        actorId: 'actor-a',
        kiboId: 500001,
        eventType: 'signature',
        name: '奇波能量技',
        startMs: 300,
      },
      {
        id: 'kibo-active-zero-cost',
        type: 'kiboEvent',
        skillId: 504004,
        actorId: 'actor-a',
        kiboId: 500001,
        eventType: 'active',
        name: '奇波普通主动动作',
        startMs: 350,
      },
      {
        id: 'kibo-combo',
        type: 'kiboEvent',
        skillId: 50000112,
        actorId: 'actor-a',
        kiboId: 500001,
        eventType: 'break',
        name: '奇波合击',
        startMs: 250,
      },
      ...actors.map((actor, index) => ({
        id: `switch-${index + 1}`,
        type: 'switch',
        targetActorId: actor.id,
        startMs: 500 + index * 100,
        name: '切人',
      })),
      createAction({
        id: 'automatic-star-carry',
        name: '星携技',
        actionKind: 'star-carry',
        startMs: 900,
      }),
    ];
    const projection = projectTimelineOperationInputs({
      actions,
      actors,
      durationMs: 3000,
      resolveActionMapping(action) {
        if (action.id === 'kibo-energy-skill') {
          return {
            actionKind: 'signature',
            controlLogic: { spCost: 100 },
          };
        }
        if (action.id === 'kibo-active-zero-cost') {
          return {
            actionKind: 'active',
            controlLogic: { spCost: 0 },
          };
        }
        if (action.id === 'kibo-combo') {
          return {
            identity: 'kibo:500001:break:50000112',
            ownerKind: 'kibo',
            ownerId: 500001,
            actionKind: 'break',
            sourceSkillId: 50000112,
            controlVariantSourceIdentity:
              'NewTable/pet.rows[id=500001].breakSkillList',
            controlLogic: {
              spCost: 0,
              skillTag: 15,
              sourceIdentity: 'kibo-control-binding.rows[id=50000112].skillTag',
            },
          };
        }
        return null;
      },
    });

    expect(
      projection.markers.map(marker => [marker.actionId, marker.keyLabel])
    ).toEqual([
      ['skill', 'E'],
      ['ultimate', 'R'],
      ['actor-combo', 'F'],
      ['kibo-energy-skill', 'Q'],
      ['switch-1', '1'],
      ['switch-2', '2'],
      ['switch-3', '3'],
    ]);
    expect(
      projection.markers.some(
        marker => marker.actionId === 'kibo-active-zero-cost'
      )
    ).toBe(false);
    expect(
      projection.markers.find(marker => marker.actionId === 'actor-combo')
        ?.relatedActionIds
    ).toEqual(['actor-combo', 'kibo-combo']);
    expect(
      projection.markers.some(marker => marker.actionId === 'kibo-combo')
    ).toBe(false);
  });

  it('layers nearby inputs without changing their exact timeline starts', () => {
    const projection = projectTimelineOperationInputs({
      actions: [
        createAction({ id: 'a', startMs: 100 }),
        createAction({ id: 'b', startMs: 105 }),
        createAction({ id: 'c', startMs: 300 }),
      ],
      durationMs: 1000,
    });
    const layout = layoutTimelineOperationMarkers(projection.markers, {
      durationMs: 1000,
      trackWidthPx: 1000,
      pressWidthPx: 30,
    });

    expect(layout.rowCount).toBe(2);
    expect(layout.markers.map(marker => marker.leftPx)).toEqual([
      100, 105, 300,
    ]);
    for (let rowIndex = 0; rowIndex < layout.rowCount; rowIndex += 1) {
      const row = layout.markers.filter(marker => marker.rowIndex === rowIndex);
      for (let index = 1; index < row.length; index += 1) {
        expect(row[index].leftPx).toBeGreaterThanOrEqual(
          row[index - 1].rightPx + 3
        );
      }
    }
  });
});

function createAction({
  id,
  name = '普通攻击',
  actionKind = 'normal-attack',
  attackSequenceIndex = null,
  actorId = null,
  startMs = 0,
  durationMs = 500,
}) {
  return {
    id,
    type: 'skill',
    actionKind,
    attackSequenceIndex,
    actorId,
    name,
    startMs,
    durationMs,
  };
}
