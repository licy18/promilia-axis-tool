import { describe, expect, it } from 'vitest';

import { frameToMs } from '../../domain/timebase';
import { projectScenarioEffectiveActionTimeline } from '../../simulation/mechanics/actionEffectiveTimeline';

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
});
