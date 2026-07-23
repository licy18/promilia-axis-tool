import { describe, expect, it } from 'vitest';

import {
  resolveVerifiedAttackInputChainEntry,
  resolveVerifiedContextActionStartMs,
} from '../../domain/verifiedActionContextScheduling';
import { frameToMs } from '../../domain/timebase';

describe('verified action context scheduling', () => {
  it('projects the state-selected normal attack chain without persisting runtime state', () => {
    const entry = createNormalAttackEntry();
    const graph = createVariantGraph();

    const normal = resolveVerifiedAttackInputChainEntry({
      entry,
      graph,
      ownerId: 101010,
      actorId: 'actor-jade',
      timeMs: 1000,
      effectIntervals: [],
    });
    expect(normal.status).toBe('selected');
    expect(normal.entry.attackInputSegments).toHaveLength(5);
    expect(
      normal.entry.attackInputSegments.map(segment => [
        segment.controlSkillId,
        segment.selectedSubSkillIndex,
        segment.durationFrames,
      ])
    ).toEqual([
      [10101001, 0, 20],
      [10101002, 0, 35],
      [10101003, 0, 47],
      [10101004, 0, 30],
      [10101005, 0, 80],
    ]);

    const burst = resolveVerifiedAttackInputChainEntry({
      entry,
      graph,
      ownerId: 101010,
      actorId: 'actor-jade',
      timeMs: 1000,
      effectIntervals: [
        {
          effectId: 'battle-element:101010129',
          targetId: 'actor-jade',
          startMs: 500,
          endMs: 10_500,
        },
      ],
    });
    expect(burst.status).toBe('selected');
    expect(
      burst.entry.attackInputSegments.map(segment => [
        segment.sequenceIndex,
        segment.sequenceTotal,
        segment.controlSkillId,
        segment.selectedSubSkillIndex,
        segment.durationFrames,
      ])
    ).toEqual([
      [1, 3, 10101001, 1, 72],
      [2, 3, 10101004, 1, 75],
      [3, 3, 10101005, 1, 72],
    ]);
    expect(entry.attackInputSegments).toHaveLength(5);
  });

  it('snaps a derived heavy input to the sourced A5 context window', () => {
    const graph = createVariantGraph();
    const normalA5 = {
      id: 'jade-a5',
      actorCharacterId: 101010,
      startMs: 2000,
    };
    expect(
      resolveVerifiedContextActionStartMs({
        actions: [normalA5],
        selections: [
          {
            actionId: normalA5.id,
            controlSkillId: 10101005,
            selectedSubSkillIndex: 0,
          },
        ],
        graph,
        ownerId: 101010,
        actorId: 'actor-jade',
        targetControlSkillId: 10101010,
        effectIntervals: [],
        timelineDurationMs: 30_000,
      })
    ).toMatchObject({
      actionId: normalA5.id,
      startMs: 2000 + frameToMs(101),
      endMs: 2000 + frameToMs(248),
    });

    const burstA5 = {
      id: 'jade-burst-a5',
      actorCharacterId: 101010,
      startMs: 5000,
    };
    const burstContext = resolveVerifiedContextActionStartMs({
      actions: [burstA5],
      selections: [
        {
          actionId: burstA5.id,
          controlSkillId: 10101005,
          selectedSubSkillIndex: 1,
        },
      ],
      graph,
      ownerId: 101010,
      actorId: 'actor-jade',
      targetControlSkillId: 10101010,
      effectIntervals: [
        {
          effectId: 'battle-element:101010129',
          targetId: 'actor-jade',
          startMs: 4500,
          endMs: 15_000,
        },
      ],
      timelineDurationMs: 30_000,
    });
    expect(burstContext).toMatchObject({
      actionId: burstA5.id,
      startMs: 5000 + frameToMs(72),
    });
    expect(burstContext.endMs).toBeCloseTo(5000 + frameToMs(319), 5);
  });
});

function createNormalAttackEntry() {
  return {
    skillId: 10101001,
    attackInputSegments: [10101001, 10101002, 10101003, 10101004, 10101005].map(
      (controlSkillId, index) => ({
        identity: `jade-a${index + 1}`,
        sequenceIndex: index + 1,
        sequenceTotal: 5,
        label: `A${index + 1}`,
        controlSkillId,
        selectedSubSkillIndex: 0,
        effectiveDurationFrames: 100 + index,
        durationFrames: 100 + index,
        durationStatus: 'applied',
        durationBasis: 'fixture',
        durationSourceIdentity: `fixture:${controlSkillId}`,
        sourceIdentity: `fixture:${controlSkillId}`,
      })
    ),
  };
}

function createVariantGraph() {
  const stateElementId = 101010129;
  return {
    attackInputChains: [
      {
        chainIdentity: 'jade-default',
        ownerId: 101010,
        sourceSkillId: 10101001,
        stateCondition: {
          kind: 'resource-state-inactive',
          stateElementId,
        },
        segments: [
          [10101001, 0, 20],
          [10101002, 0, 35],
          [10101003, 0, 47],
          [10101004, 0, 30],
          [10101005, 0, 80],
        ].map(([controlSkillId, subSkillIndex, durationFrames], index) => ({
          sequenceIndex: index + 1,
          sequenceTotal: 5,
          controlSkillId,
          subSkillIndex,
          durationFrames,
          sourceIdentity: `fixture:default:${controlSkillId}`,
        })),
        applied: true,
      },
      {
        chainIdentity: 'jade-burst',
        ownerId: 101010,
        sourceSkillId: 10101001,
        stateCondition: {
          kind: 'resource-state-active',
          stateElementId,
        },
        segments: [
          [10101001, 1, 72],
          [10101004, 1, 75],
          [10101005, 1, 72],
        ].map(([controlSkillId, subSkillIndex, durationFrames], index) => ({
          sequenceIndex: index + 1,
          sequenceTotal: 3,
          controlSkillId,
          subSkillIndex,
          durationFrames,
          sourceIdentity: `fixture:burst:${controlSkillId}`,
        })),
        applied: true,
      },
    ],
    contextEdges: [
      {
        edgeIdentity: 'jade-default-a5-heavy',
        ownerId: 101010,
        sourceControlSkillId: 10101005,
        sourceSubSkillIndex: 0,
        targetControlSkillId: 10101010,
        targetSubSkillIndex: 1,
        inputWindow: { startFrame: 101, endFrame: 248, frameRate: 60 },
        condition: {
          kind: 'resource-state-inactive',
          stateElementId,
        },
        applied: true,
      },
      {
        edgeIdentity: 'jade-burst-a5-heavy',
        ownerId: 101010,
        sourceControlSkillId: 10101005,
        sourceSubSkillIndex: 1,
        targetControlSkillId: 10101010,
        targetSubSkillIndex: 2,
        inputWindow: { startFrame: 72, endFrame: 319, frameRate: 60 },
        condition: {
          kind: 'resource-state-active',
          stateElementId,
        },
        applied: true,
      },
    ],
  };
}
