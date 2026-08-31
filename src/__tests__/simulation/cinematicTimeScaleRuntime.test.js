import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';
import {
  advanceClockTime,
  advanceEnemyClockTime,
  createCinematicTimeScaleRuntime,
} from '../../simulation/mechanics/cinematicTimeScaleRuntime';
import { createVerifiedActionVariantRuntime } from '../../simulation/mechanics/verifiedActionVariantRuntime';

beforeEach(() => {
  installVerifiedCombatMechanicsPackage(mechanicsPackage);
});

afterEach(() => {
  clearInstalledVerifiedCombatMechanicsPackage();
});

describe('client cinematic time-scale runtime', () => {
  it('advances a filtered entity clock around pause windows without changing wall time', () => {
    expect(advanceClockTime([{ startMs: 1000, endMs: 3000 }], 500, 2000)).toBe(
      4500
    );
    expect(advanceClockTime([{ startMs: 1000, endMs: 3000 }], 1500, 1000)).toBe(
      4000
    );
  });

  it('projects Moyin ultimate as one enemy pause window while score and actor clocks continue', () => {
    const action = {
      id: 'moyin-ultimate',
      type: 'skill',
      actionKind: 'ultimate',
      actorId: 'actor-109001',
      actor: { characterId: 109001 },
      actorCharacterId: 109001,
      skillId: 10900113,
      actionVariantIndex: 0,
      startMs: 1000,
      durationMs: 3916.666667,
    };
    const runtime = createCinematicTimeScaleRuntime({
      scenario: {
        actions: [action],
        combatScenario: {},
      },
      actionExecutionPlan: {
        actions: [{ actionId: action.id, execute: true }],
      },
    });

    expect(runtime).toMatchObject({
      status: 'cinematic-time-scale-runtime-ready',
      wallClockPolicy: 'continues',
      scoreClockPolicy: 'wall-time-includes-cinematic-window',
      dungeonTimerPolicy: 'continues-without-pause-world',
      actionOccupancyPolicy: 'unchanged',
      complete: true,
      applied: true,
      summary: {
        actionWindowCount: 2,
        enemyPauseWindowCount: 1,
        playerHeroPauseWindowCount: 0,
        enemyPausedDurationMs: 2083.333333,
      },
    });
    expect(runtime.enemyPauseWindows[0]).toMatchObject({
      startMs: 1000,
      endMs: 3083.333333,
      durationMs: 2083.333333,
      sourceActionIds: ['moyin-ultimate'],
      sourceSkillIds: [10900113],
    });
    expect(advanceEnemyClockTime(runtime, 500, 2000)).toBe(4583.333333);
  });

  it('disables client cinematic time scale in multiplayer and Kibo battle modes', () => {
    const action = {
      id: 'moyin-ultimate',
      type: 'skill',
      actionKind: 'ultimate',
      actorId: 'actor-109001',
      actor: { characterId: 109001 },
      skillId: 10900113,
      actionVariantIndex: 0,
      startMs: 0,
    };
    for (const combatScenario of [
      { multiplayerOnline: true },
      { kiboBattle: true },
    ]) {
      const runtime = createCinematicTimeScaleRuntime({
        scenario: { actions: [action], combatScenario },
      });
      expect(runtime).toMatchObject({
        status: 'cinematic-time-scale-runtime-disabled-by-client-mode',
        disabledByRuntimeMode: true,
        applied: false,
        enemyPauseWindows: [],
      });
    }
  });

  it('does not require missing single-player cinematic evidence when the client mode disables the behavior', () => {
    const action = {
      id: 'ainis-ultimate-disabled-mode',
      type: 'skill',
      actionKind: 'ultimate',
      actorId: 'actor-112002',
      actor: { characterId: 112002 },
      actorCharacterId: 112002,
      skillId: 11200213,
      actionVariantIndex: 0,
      startMs: 0,
      durationMs: 1000,
    };
    const runtime = createVerifiedActionVariantRuntime({
      scenario: {
        time: { durationMs: 5000, fps: 60 },
        actors: [
          {
            id: 'actor-112002',
            characterId: 112002,
            initialSp: 100,
          },
        ],
        actions: [action],
        combatScenario: {
          multiplayerOnline: true,
          objectiveContract: { classification: 'primary' },
        },
      },
      actionExecutionPlan: {
        actions: [{ actionId: action.id, execute: true }],
      },
    });

    expect(runtime.executionBlocks).toEqual([]);
    expect(runtime.cinematicTimeScaleRuntime).toMatchObject({
      status: 'cinematic-time-scale-runtime-disabled-by-client-mode',
      disabledByRuntimeMode: true,
      complete: true,
      unresolved: [],
    });
  });

  it('fails closed in formal scoring when a public ultimate has no client cinematic time-scale source', () => {
    const action = {
      id: 'ainis-ultimate',
      type: 'skill',
      actionKind: 'ultimate',
      actorId: 'actor-112002',
      actor: { characterId: 112002 },
      actorCharacterId: 112002,
      skillId: 11200213,
      actionVariantIndex: 0,
      startMs: 0,
      durationMs: 1000,
    };
    const runtime = createVerifiedActionVariantRuntime({
      scenario: {
        time: { durationMs: 5000, fps: 60 },
        actors: [
          {
            id: 'actor-112002',
            characterId: 112002,
            initialSp: 100,
          },
        ],
        actions: [action],
        combatScenario: {
          objectiveContract: {
            classification: 'primary',
          },
        },
      },
      actionExecutionPlan: {
        actions: [{ actionId: action.id, execute: true }],
      },
    });

    expect(runtime.executionBlocks).toEqual([
      expect.objectContaining({
        code: 'CINEMATIC_TIME_SCALE_UNRESOLVED',
        status: 'unresolved',
        reason: 'cinematic-time-scale-unresolved',
        actionId: 'ainis-ultimate',
        skillId: 11200213,
      }),
    ]);
    expect(runtime.actionResolutionById.get(action.id)).toMatchObject({
      ready: false,
      applied: false,
      status: 'cinematic-time-scale-unresolved',
      reasons: ['ultimate-cinematic-time-scale-source-missing'],
    });
  });

  it('keeps non-formal mechanics replay executable while publishing missing cinematic evidence', () => {
    const action = {
      id: 'ainis-ultimate-non-formal',
      type: 'skill',
      actionKind: 'ultimate',
      actorId: 'actor-112002',
      actor: { characterId: 112002 },
      actorCharacterId: 112002,
      skillId: 11200213,
      actionVariantIndex: 0,
      startMs: 0,
      durationMs: 1000,
    };
    const runtime = createVerifiedActionVariantRuntime({
      scenario: {
        time: { durationMs: 5000, fps: 60 },
        actors: [
          {
            id: 'actor-112002',
            characterId: 112002,
            initialSp: 100,
          },
        ],
        actions: [action],
        combatScenario: {},
      },
      actionExecutionPlan: {
        actions: [{ actionId: action.id, execute: true }],
      },
    });

    expect(runtime.executionBlocks).toEqual([]);
    expect(runtime.cinematicTimeScaleRuntime).toMatchObject({
      status: 'cinematic-time-scale-runtime-unresolved',
      complete: false,
      unresolved: [
        expect.objectContaining({
          actionId: action.id,
          skillId: 11200213,
        }),
      ],
    });
    expect(runtime.actionResolutionById.get(action.id)).toMatchObject({
      ready: true,
      applied: true,
    });
  });
});
