import { describe, expect, it } from 'vitest';
import {
  createWorkbenchActionDraft,
  createWorkbenchProject,
  getWorkbenchGameData,
} from '../../domain/workbenchProjectFactory';
import {
  compileProject,
  runSimulation,
  simulateScenario,
} from '../../simulation';
import { createInitialRuntimeStateAtBoundary } from '../../simulation/projection/projectCycleBoundaryInheritance';
import { projectEffectRuntimeIntervals } from '../../simulation/projection/projectEffectIntervals';

describe('generated action status runtime', () => {
  it('runs a real catalog lifecycle through execution, effect runtime, intervals, and relations', () => {
    const project = createStatusProject([
      createStatusAction({ id: 'status-action-1', startMs: 0 }),
    ]);
    const result = runSimulation(project, getWorkbenchGameData());
    const intervalProjection = projectEffectRuntimeIntervals({
      effectTimeline: result.effectTimeline,
      durationMs: project.time.durationMs,
      frameRate: project.time.fps,
    });

    expect(result.actionExecutionPlan.actions).toEqual([
      expect.objectContaining({
        actionId: 'status-action-1',
        execute: true,
      }),
    ]);
    expect(result.actionRuleDiagnostics.readinessTimeline).toMatchObject({
      summary: {
        cooldownWindowCount: 1,
      },
      cooldownWindows: [
        expect.objectContaining({
          actionId: 'status-action-1',
          startMs: 0,
          endMs: 24000,
          confidence: 'confirmed-structured-data',
          trackingStatus: 'applied-to-readiness',
          sourceIdentity: expect.objectContaining({
            subSkillId: 10100322,
          }),
        }),
      ],
    });
    expect(result.effectTimeline.events).toEqual([
      expect.objectContaining({
        type: 'EFFECT_APPLIED',
        timeMs: 950,
        frameIndex: 57,
        actionId: 'status-action-1',
        effectId: 'buff-101003141',
        effectName: '防御力降低',
        targetKind: 'enemy',
        confidence: 'medium',
        trackingStatus: 'unapplied',
        sourceIdentity: expect.objectContaining({
          elementConfigId: 101003141,
          behaviorPathId: '-5797025868792535592',
        }),
        appliedToCalculators: false,
      }),
      expect.objectContaining({
        type: 'EFFECT_EXPIRED',
        timeMs: 8950,
        frameIndex: 537,
        effectId: 'buff-101003141',
        trackingStatus: 'unapplied',
        appliedToCalculators: false,
      }),
    ]);
    expect(intervalProjection.intervals).toEqual([
      expect.objectContaining({
        effectId: 'buff-101003141',
        effectName: '防御力降低',
        icon: 'tex_icon_buff_defdown.png',
        startMs: 950,
        endMs: 8950,
        startFrame: 57,
        endFrame: 537,
        sourceActionId: 'status-action-1',
        confidence: 'medium',
        trackingStatus: 'unapplied',
        sourceStatus: 'generated-from-azpr-action-status-catalog',
        appliedToCalculators: false,
      }),
    ]);
    expect(result.actionEffectRelationGraph).toMatchObject({
      summary: {
        triggerEdgeCount: 1,
        satisfiedEdgeCount: 1,
        blockedEdgeCount: 0,
      },
      edges: [
        expect.objectContaining({
          commandActionId: 'status-action-1',
          effectId: 'buff-101003141',
          targetTimeMs: 950,
          trackingStatus: 'unapplied',
          sourceIdentity: expect.objectContaining({
            elementConfigId: 101003141,
          }),
        }),
      ],
    });
    expect(result.effectTimeline.summary.calculatorAppliedEffectCount).toBe(0);
  });

  it('does not emit lifecycle state for a cooldown-blocked generated action', () => {
    const project = createStatusProject([
      createStatusAction({ id: 'status-action-1', startMs: 0 }),
      createStatusAction({ id: 'status-action-blocked', startMs: 1000 }),
    ]);
    const result = runSimulation(project, getWorkbenchGameData());

    expect(result.actionExecutionPlan.actions).toEqual([
      expect.objectContaining({
        actionId: 'status-action-1',
        execute: true,
      }),
      expect.objectContaining({
        actionId: 'status-action-blocked',
        execute: false,
        status: 'skipped-rule-blocked',
      }),
    ]);
    expect(result.effectTimeline.input.summary).toMatchObject({
      inputCommandCount: 2,
      executableInputCommandCount: 1,
      blockedCommandCount: 1,
      commandCount: 1,
    });
    expect(
      result.effectTimeline.events.filter(
        event => event.actionId === 'status-action-blocked'
      )
    ).toEqual([]);
    expect(result.actionEffectRelationGraph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          commandActionId: 'status-action-blocked',
          status: 'blocked',
          runtimeEventId: null,
        }),
      ])
    );
  });

  it('uses the sourced kibo cooldown on the kibo owner lane and blocks reuse', () => {
    const project = createStatusProject(
      [
        createKiboStatusAction({ id: 'kibo-status-action-1', startMs: 0 }),
        createKiboStatusAction({
          id: 'kibo-status-action-blocked',
          startMs: 1000,
        }),
      ],
      {
        actorConfigs: [
          {
            characterId: 109001,
            loadout: { kiboId: 500001 },
          },
        ],
      }
    );
    const result = runSimulation(project, getWorkbenchGameData());

    expect(result.actionExecutionPlan.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'kibo-status-action-1',
          execute: true,
        }),
        expect.objectContaining({
          actionId: 'kibo-status-action-blocked',
          execute: false,
          status: 'skipped-rule-blocked',
        }),
      ])
    );
    expect(
      result.actionRuleDiagnostics.readinessTimeline.cooldownWindows
    ).toEqual([
      expect.objectContaining({
        actionId: 'kibo-status-action-1',
        actorId: 'actor-109001',
        ownerKind: 'kibo',
        ownerId: 500001,
        kiboId: 500001,
        skillId: 50000102,
        startMs: 0,
        endMs: 18000,
        durationMs: 18000,
        sourceIdentity: expect.objectContaining({
          sourceKind: 'azpr-newtable-kibo-standard-battle-cooldown',
          cooldownMode: 'standard-battle',
        }),
      }),
    ]);

    const unbound = runSimulation(
      createStatusProject([
        createKiboStatusAction({ id: 'kibo-status-unbound', startMs: 0 }),
      ]),
      getWorkbenchGameData()
    );
    expect(
      unbound.actionRuleDiagnostics.readinessTimeline.cooldownWindows
    ).toEqual([]);
  });

  it('creates an ultimate cooldown only when skill-level provides a positive value', () => {
    const confirmed = runSimulation(
      createStatusProject([
        createWorkbenchActionDraft({
          id: 'ultimate-status-confirmed',
          skillId: 10100713,
          actorCharacterId: 101007,
          startMs: 0,
        }),
      ]),
      getWorkbenchGameData()
    );
    expect(
      confirmed.actionRuleDiagnostics.readinessTimeline.cooldownWindows
    ).toEqual([
      expect.objectContaining({
        actionId: 'ultimate-status-confirmed',
        ownerKind: 'actor',
        skillId: 10100713,
        durationMs: 20000,
        sourceIdentity: expect.objectContaining({
          sourceKind: 'azpr-newtable-skill-level-display',
          sourceStatus: 'confirmed-display-cooldown-logic-zero',
        }),
      }),
    ]);

    const unavailable = runSimulation(
      createStatusProject([
        createWorkbenchActionDraft({
          id: 'ultimate-status-unavailable',
          skillId: 10100313,
          actorCharacterId: 101003,
          startMs: 0,
        }),
      ]),
      getWorkbenchGameData()
    );
    expect(
      unavailable.actionRuleDiagnostics.readinessTimeline.cooldownWindows
    ).toEqual([]);
  });

  it('recomputes trigger timing and removes stale state after project edits', () => {
    const moved = runSimulation(
      createStatusProject([
        createStatusAction({ id: 'status-action-moved', startMs: 5000 }),
      ]),
      getWorkbenchGameData()
    );
    expect(moved.effectTimeline.events.map(event => event.timeMs)).toEqual([
      5950, 13950,
    ]);

    const removed = runSimulation(
      createStatusProject([]),
      getWorkbenchGameData()
    );
    expect(removed.effectTimeline).toMatchObject({
      status: 'effect-runtime-timeline-ready-no-events',
      events: [],
      activeEffects: [],
      summary: {
        inputCommandCount: 0,
        eventCount: 0,
      },
    });
  });

  it('inherits a generated tracking-only effect through the existing cycle runtime', () => {
    const sourceProject = createStatusProject([
      createStatusAction({ id: 'status-action-cycle-source', startMs: 0 }),
    ]);
    const sourceScenario = compileProject(
      sourceProject,
      getWorkbenchGameData()
    );
    const sourceResult = simulateScenario(sourceScenario);
    const inheritedState = createInitialRuntimeStateAtBoundary({
      scenario: sourceScenario,
      runtimeOutputs: sourceResult.runtimeOutputs,
      boundary: { id: 'cycle-m3', timeMs: 5000 },
      sourceScenarioId: 'scenario-m3-source',
      sourceScenarioName: 'M3 source',
    });

    expect(inheritedState.activeEffects).toEqual([
      expect.objectContaining({
        effectId: 'buff-101003141',
        effectName: '防御力降低',
        remainingDurationMs: 3950,
        trackingStatus: 'unapplied',
        sourceIdentity: expect.objectContaining({
          skillId: 10100322,
          elementConfigId: 101003141,
        }),
        appliedToCalculators: false,
      }),
    ]);

    const inheritedResult = runSimulation(
      createStatusProject([], { initialRuntimeState: inheritedState }),
      getWorkbenchGameData()
    );
    expect(inheritedResult.effectTimeline.events).toEqual([
      expect.objectContaining({
        type: 'EFFECT_INHERITED',
        timeMs: 0,
        effectId: 'buff-101003141',
        trackingStatus: 'unapplied',
      }),
      expect.objectContaining({
        type: 'EFFECT_EXPIRED',
        timeMs: 3950,
        effectId: 'buff-101003141',
        trackingStatus: 'unapplied',
      }),
    ]);
  });
});

function createStatusAction({ id, startMs }) {
  return createWorkbenchActionDraft({
    id,
    skillId: 10100322,
    actorCharacterId: 101003,
    actionVariantIndex: 0,
    startMs,
    durationMs: 1200,
  });
}

function createKiboStatusAction({ id, startMs }) {
  return createWorkbenchActionDraft({
    id,
    type: 'kiboEvent',
    skillId: 50000102,
    actorCharacterId: 109001,
    name: '迅风刃',
    startMs,
    durationMs: 1200,
    timingSource: 'azpr-unity-skill-control-root',
    needsTimingData: false,
  });
}

function createStatusProject(
  actions,
  { initialRuntimeState = null, actorConfigs = null } = {}
) {
  return createWorkbenchProject(
    {
      characterId: 109001,
      secondaryCharacterId: 101003,
      skillId: 10900101,
      enemyId: 300032,
    },
    {
      actions,
      durationMs: 30000,
      initialRuntimeState,
      actorConfigs,
    }
  );
}
