import { describe, expect, it } from 'vitest';
import {
  layoutTimelineOperationMarkers,
  projectTimelineOperationInputs,
} from '../../simulation/projection/projectTimelineOperationInputs';

describe('projectTimelineOperationInputs', () => {
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

  it('maps skills, kibo input and team switches through the central PC profile', () => {
    const actors = [
      { id: 'actor-a', characterId: 101003, name: '角色一' },
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
      {
        id: 'kibo',
        type: 'kiboEvent',
        skillId: 50046903,
        name: '奇波技能',
        startMs: 300,
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
    });

    expect(
      projection.markers.map(marker => [marker.actionId, marker.keyLabel])
    ).toEqual([
      ['skill', 'E'],
      ['ultimate', 'R'],
      ['kibo', 'Q'],
      ['switch-1', '1'],
      ['switch-2', '2'],
      ['switch-3', '3'],
    ]);
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
  startMs = 0,
  durationMs = 500,
}) {
  return {
    id,
    type: 'skill',
    actionKind,
    attackSequenceIndex,
    name,
    startMs,
    durationMs,
  };
}
