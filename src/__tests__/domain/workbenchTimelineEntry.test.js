import { describe, expect, it } from 'vitest';
import { ACTION_TYPES } from '../../domain/projectSchema';
import {
  WORKBENCH_TIMELINE_LANE_KINDS,
  createWorkbenchTimelineBatchLaneMovePlan,
  createWorkbenchTimelineEntry,
  isWorkbenchTimelineEntryAllowedInLane,
  resolveWorkbenchTimelineLaneKind,
} from '../../domain/workbenchTimelineEntry';

describe('workbench timeline entry contract', () => {
  it('maps schedulable entry types to their only legal lane kind', () => {
    expect(resolveWorkbenchTimelineLaneKind({ type: ACTION_TYPES.SKILL })).toBe(
      WORKBENCH_TIMELINE_LANE_KINDS.ACTOR_ACTION
    );
    expect(
      resolveWorkbenchTimelineLaneKind({ type: ACTION_TYPES.KIBO_EVENT })
    ).toBe(WORKBENCH_TIMELINE_LANE_KINDS.ACTOR_KIBO);
    expect(
      resolveWorkbenchTimelineLaneKind({ type: ACTION_TYPES.ENEMY_EVENT })
    ).toBe(WORKBENCH_TIMELINE_LANE_KINDS.ENEMY_EVENT);
    expect(
      isWorkbenchTimelineEntryAllowedInLane(
        { type: ACTION_TYPES.KIBO_EVENT },
        { kind: WORKBENCH_TIMELINE_LANE_KINDS.ACTOR_ACTION }
      )
    ).toBe(false);
    expect(
      isWorkbenchTimelineEntryAllowedInLane(
        { type: ACTION_TYPES.KIBO_EVENT },
        { kind: WORKBENCH_TIMELINE_LANE_KINDS.ACTOR_KIBO }
      )
    ).toBe(true);
  });

  it('normalizes draggable entries and rejects unsupported system actions', () => {
    expect(
      createWorkbenchTimelineEntry({
        type: ACTION_TYPES.SKILL,
        skillId: '10900101',
        actionVariantIndex: 2,
        durationMs: 1000,
        icon: 'tex_icon_skill_109001_00.png',
        label: '普通攻击',
      })
    ).toMatchObject({
      type: ACTION_TYPES.SKILL,
      skillId: 10900101,
      actionVariantIndex: 2,
      durationMs: 1000,
      icon: 'tex_icon_skill_109001_00.png',
      label: '普通攻击',
    });
    expect(
      createWorkbenchTimelineEntry({ type: ACTION_TYPES.WAIT })
    ).toBeNull();
  });

  it('plans one actor ownership move for a mixed action and kibo selection', () => {
    const plan = createWorkbenchTimelineBatchLaneMovePlan({
      actions: [
        { id: 'skill-a', type: ACTION_TYPES.SKILL, actorId: 'actor-a' },
        {
          id: 'kibo-a',
          type: ACTION_TYPES.KIBO_EVENT,
          actorId: 'actor-a',
        },
      ],
      actionIds: ['skill-a', 'kibo-a'],
      primaryActionId: 'skill-a',
      targetLane: {
        id: 'actor-b',
        kind: WORKBENCH_TIMELINE_LANE_KINDS.ACTOR_ACTION,
        actorId: 'actor-b',
      },
    });

    expect(plan).toMatchObject({
      actionIds: ['skill-a', 'kibo-a'],
      primaryActionId: 'skill-a',
      sourceOwnerId: 'actor-a',
      targetOwnerId: 'actor-b',
      targetLaneId: 'actor-b',
      changesOwner: true,
    });
    expect(plan.entries.map(entry => entry.laneKind)).toEqual([
      WORKBENCH_TIMELINE_LANE_KINDS.ACTOR_ACTION,
      WORKBENCH_TIMELINE_LANE_KINDS.ACTOR_KIBO,
    ]);
  });

  it('rejects ambiguous multi-owner and enemy batch lane moves', () => {
    const targetLane = {
      id: 'actor-c',
      kind: WORKBENCH_TIMELINE_LANE_KINDS.ACTOR_ACTION,
      actorId: 'actor-c',
    };
    expect(
      createWorkbenchTimelineBatchLaneMovePlan({
        actions: [
          { id: 'action-a', type: ACTION_TYPES.SKILL, actorId: 'actor-a' },
          { id: 'action-b', type: ACTION_TYPES.SKILL, actorId: 'actor-b' },
        ],
        actionIds: ['action-a', 'action-b'],
        primaryActionId: 'action-a',
        targetLane,
      })
    ).toBeNull();
    expect(
      createWorkbenchTimelineBatchLaneMovePlan({
        actions: [
          { id: 'action-a', type: ACTION_TYPES.SKILL, actorId: 'actor-a' },
          {
            id: 'enemy-a',
            type: ACTION_TYPES.ENEMY_EVENT,
            actorId: null,
          },
        ],
        actionIds: ['action-a', 'enemy-a'],
        primaryActionId: 'action-a',
        targetLane,
      })
    ).toBeNull();
  });
});
