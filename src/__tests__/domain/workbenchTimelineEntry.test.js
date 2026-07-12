import { describe, expect, it } from 'vitest';
import { ACTION_TYPES } from '../../domain/projectSchema';
import {
  WORKBENCH_TIMELINE_LANE_KINDS,
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
        label: '普通攻击',
      })
    ).toMatchObject({
      type: ACTION_TYPES.SKILL,
      skillId: 10900101,
      actionVariantIndex: 2,
      durationMs: 1000,
      label: '普通攻击',
    });
    expect(
      createWorkbenchTimelineEntry({ type: ACTION_TYPES.WAIT })
    ).toBeNull();
  });
});
