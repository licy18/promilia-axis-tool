import { describe, expect, it } from 'vitest';

import { frameToMs } from '../../domain/timebase';
import {
  isActionFrameWithinContextualOccupancy,
  projectScenarioEffectiveActionTimeline,
} from '../../simulation/mechanics/actionEffectiveTimeline';

describe('action effective timeline', () => {
  it('keeps source animation evidence separate from authoritative occupancy', () => {
    const action = {
      id: 'jade-charged',
      type: 'skill',
      name: '重击',
      startMs: 0,
      durationMs: frameToMs(310),
    };
    const result = projectScenarioEffectiveActionTimeline({
      scenario: {
        time: { durationMs: 10_000, fps: 60 },
        actions: [action],
      },
      actionResolutionById: new Map([
        [
          action.id,
          {
            actionBinding: {
              semanticName: '普通重击',
              executionControlSkillId: 10101010,
              selectedSubSkillIndex: 0,
              animationDurationFrames: 310,
              animationDurationMs: frameToMs(310),
              effectiveOccupancy: {
                status: 'applied',
                durationFrames: 75,
                sourceIdentity: 'fixture:charged-reopen',
              },
              effectiveOccupancyFrames: 75,
              actualDurationMs: frameToMs(75),
            },
          },
        ],
      ]),
    });

    expect(result.scenario.actions[0]).toMatchObject({
      name: '普通重击',
      durationMs: frameToMs(75),
    });
    expect(action).toMatchObject({
      name: '重击',
      durationMs: frameToMs(310),
    });
  });

  it('projects contextual input, execution, and predecessor end independently', () => {
    const predecessor = {
      id: 'jade-star-skill',
      type: 'skill',
      name: '星鸣技',
      actorId: 'actor-jade',
      startMs: 0,
      durationMs: frameToMs(120),
    };
    const successor = {
      id: 'jade-special-charged',
      type: 'skill',
      name: '重击',
      actorId: 'actor-jade',
      startMs: frameToMs(120),
      durationMs: frameToMs(75),
    };
    const contextualInputScheduling = {
      resolutionKind: 'edge-intent-contextual-transition',
      inputSemantics: 'immediate-interrupt',
      inputFrame: 119,
      inputOffsetFrame: 119,
      inputTimeMs: frameToMs(119),
      executionStartFrame: 119,
      executionStartMs: frameToMs(119),
      predecessorEffectiveEndFrame: 119,
      predecessorEffectiveEndMs: frameToMs(119),
      status: 'verified-context-input-scheduling-ready',
      applied: true,
    };
    const result = projectScenarioEffectiveActionTimeline({
      scenario: {
        time: { durationMs: 10_000, fps: 60 },
        actions: [predecessor, successor],
      },
      actionResolutionById: new Map([
        [
          predecessor.id,
          { actionBinding: { actualDurationMs: frameToMs(120) } },
        ],
        [
          successor.id,
          {
            actionBinding: {
              semanticName: '特殊重击',
              actualDurationMs: frameToMs(90),
            },
          },
        ],
      ]),
      actionSelectionById: new Map([
        [
          successor.id,
          {
            contextActionId: predecessor.id,
            contextualInputScheduling,
          },
        ],
      ]),
    });

    expect(result.scenario.actions).toEqual([
      expect.objectContaining({
        id: predecessor.id,
        startMs: 0,
        durationMs: frameToMs(119),
        contextualEffectiveEndMs: frameToMs(119),
      }),
      expect.objectContaining({
        id: successor.id,
        name: '特殊重击',
        requestedStartMs: frameToMs(120),
        startMs: frameToMs(119),
        durationMs: frameToMs(90),
        contextualInputScheduling,
      }),
    ]);
    expect(result.summary).toEqual({
      contextualTransitionCount: 1,
      contextuallyTruncatedActionCount: 1,
    });
  });

  it('excludes source events at and after an immediate contextual end', () => {
    const action = {
      id: 'contextually-interrupted-source',
      type: 'skill',
      startMs: frameToMs(300),
      contextualEffectiveEndMs: frameToMs(419),
    };

    expect(isActionFrameWithinContextualOccupancy(action, 118, 60)).toBe(true);
    expect(isActionFrameWithinContextualOccupancy(action, 119, 60)).toBe(
      false
    );
    expect(isActionFrameWithinContextualOccupancy(action, 120, 60)).toBe(
      false
    );
  });
});
