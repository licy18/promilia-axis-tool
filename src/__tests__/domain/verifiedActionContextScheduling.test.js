import { describe, expect, it } from 'vitest';

import verifiedCombatMechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  resolveVerifiedAttackInputChainEntry,
  resolveVerifiedContextActionStartMs,
} from '../../domain/verifiedActionContextScheduling';
import { frameToMs } from '../../domain/timebase';
import {
  ACTION_RULE_CODES,
  createActionRuleDiagnostics,
} from '../../simulation/runtime/actionRuleDiagnostics';

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

  it('projects the verified burst chain link contract into ready A1-A3 drafts', () => {
    const entry = verifiedCombatMechanicsPackage.actionMappings.find(
      mapping =>
        Number(mapping.ownerId) === 101010 &&
        Number(mapping.sourceSkillId) === 10101001 &&
        Number(mapping.actionVariantIndex) === 0
    );
    const resolved = resolveVerifiedAttackInputChainEntry({
      entry: { ...entry, skillId: entry.sourceSkillId },
      graph: verifiedCombatMechanicsPackage.actionVariantGraph,
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

    expect(resolved.status).toBe('selected');
    expect(
      resolved.entry.attackInputSegments.map(segment => ({
        sequenceIndex: segment.sequenceIndex,
        controlSkillId: segment.controlSkillId,
        selectedSubSkillIndex: segment.selectedSubSkillIndex,
        linkTimingStatus: segment.linkTimingStatus,
        linkTimingBasis: segment.linkTimingBasis,
        linkTargetControlSkillId: segment.linkWindow?.targetControlSkillId,
        linkTargetSubSkillIndex: segment.linkWindow?.targetSubSkillIndex,
        linkStartFrame: segment.linkWindow?.startFrame,
        linkEndFrame: segment.linkWindow?.endFrame,
      }))
    ).toEqual([
      {
        sequenceIndex: 1,
        controlSkillId: 10101001,
        selectedSubSkillIndex: 1,
        linkTimingStatus: 'applied',
        linkTimingBasis: 'next-control-input-window',
        linkTargetControlSkillId: 10101004,
        linkTargetSubSkillIndex: 1,
        linkStartFrame: 72,
        linkEndFrame: 108,
      },
      {
        sequenceIndex: 2,
        controlSkillId: 10101004,
        selectedSubSkillIndex: 1,
        linkTimingStatus: 'applied',
        linkTimingBasis: 'next-control-input-window',
        linkTargetControlSkillId: 10101005,
        linkTargetSubSkillIndex: 1,
        linkStartFrame: 75,
        linkEndFrame: 120,
      },
      {
        sequenceIndex: 3,
        controlSkillId: 10101005,
        selectedSubSkillIndex: 1,
        linkTimingStatus: 'applied',
        linkTimingBasis: 'attack-reopen-window',
        linkTargetControlSkillId: 80102,
        linkTargetSubSkillIndex: 0,
        linkStartFrame: 72,
        linkEndFrame: 319,
      },
    ]);

    let cursorFrame = 0;
    const actions = resolved.entry.attackInputSegments.map(segment => {
      const action = {
        id: `burst-a${segment.sequenceIndex}`,
        type: 'skill',
        name: `A${segment.sequenceIndex}`,
        actorId: 'actor-jade',
        actorCharacterId: 101010,
        skillId: 10101001,
        startMs: frameToMs(cursorFrame),
        durationMs: frameToMs(segment.durationFrames),
        attackGroupId: 'burst-chain',
        attackSequenceIndex: segment.sequenceIndex,
        attackSequenceTotal: segment.sequenceTotal,
        attackInput: segment,
      };
      cursorFrame += segment.durationFrames;
      return action;
    });
    const diagnostics = createActionRuleDiagnostics({
      scenario: {
        time: { fps: 60 },
        actors: [
          { id: 'actor-jade', characterId: 101010, name: '涂山小玉' },
        ],
        actions,
      },
    });

    expect(
      diagnostics.diagnostics.filter(
        diagnostic =>
          diagnostic.code ===
          ACTION_RULE_CODES.ATTACK_INPUT_LINK_TIMING_UNRESOLVED
      )
    ).toEqual([]);
    expect(
      diagnostics.diagnostics.filter(diagnostic =>
        [
          ACTION_RULE_CODES.ATTACK_INPUT_LINK_TOO_EARLY,
          ACTION_RULE_CODES.ATTACK_INPUT_LINK_TOO_LATE,
        ].includes(diagnostic.code)
      )
    ).toEqual([]);
    expect(
      diagnostics.readinessTimeline.actions.map(action => action.status)
    ).toEqual(['ready', 'ready', 'ready']);
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
      startMs: 2000 + frameToMs(37),
      endMs: 2000 + frameToMs(102),
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
      startMs: 5000,
    });
    expect(burstContext.endMs).toBeCloseTo(5000 + frameToMs(20), 5);

    const ordinaryCharged = {
      id: 'jade-ordinary-charged',
      actorCharacterId: 101010,
      startMs: 8000,
    };
    expect(
      resolveVerifiedContextActionStartMs({
        actions: [ordinaryCharged],
        selections: [
          {
            actionId: ordinaryCharged.id,
            controlSkillId: 10101010,
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
      actionId: ordinaryCharged.id,
      startMs: 8000 + frameToMs(75),
      endMs: 8000 + frameToMs(105),
      edge: {
        semanticName: '连续重击',
        executionControlSkillId: 10101010,
        targetSubSkillIndex: 1,
      },
    });
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
        executionControlSkillId: 10101042,
        targetSubSkillIndex: 0,
        inputWindow: { startFrame: 37, endFrame: 102, frameRate: 60 },
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
        executionControlSkillId: 10101042,
        targetSubSkillIndex: 1,
        inputWindow: { startFrame: 0, endFrame: 20, frameRate: 60 },
        condition: {
          kind: 'resource-state-active',
          stateElementId,
        },
        applied: true,
      },
      {
        edgeIdentity: 'jade-charged-continuation',
        ownerId: 101010,
        sourceControlSkillId: 10101010,
        sourceSubSkillIndex: 0,
        targetControlSkillId: 10101010,
        executionControlSkillId: 10101010,
        targetSubSkillIndex: 1,
        semanticName: '连续重击',
        inputWindow: { startFrame: 75, endFrame: 105, frameRate: 60 },
        condition: { kind: 'always' },
        applied: true,
      },
    ],
  };
}
