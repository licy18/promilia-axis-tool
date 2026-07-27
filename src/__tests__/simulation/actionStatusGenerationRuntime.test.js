import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';
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
  beforeEach(() => installVerifiedCombatMechanicsPackage(mechanicsPackage));
  afterEach(() => clearInstalledVerifiedCombatMechanicsPackage());

  it('runs a real catalog lifecycle through execution, effect runtime, intervals, and relations', () => {
    const project = createStatusLifecycleProject([
      createStatusAction({ id: 'status-action-1', startMs: 0 }),
    ]);
    const result = runSimulation(project, getWorkbenchGameData());
    const derivedActionId = createStatusDerivedActionId('status-action-1');
    const intervalProjection = projectEffectRuntimeIntervals({
      effectTimeline: result.effectTimeline,
      durationMs: project.time.durationMs,
      frameRate: project.time.fps,
    });

    expect(
      result.actionExecutionPlan.actions.find(
        action => action.actionId === derivedActionId
      )
    ).toMatchObject({ execute: true });
    expect(
      result.actionRuleDiagnostics.readinessTimeline.cooldownWindows.filter(
        window => window.actionId === derivedActionId
      )
    ).toEqual([
      expect.objectContaining({
        actionId: derivedActionId,
        startMs: 0,
        endMs: 24000,
        confidence: 'confirmed-structured-data',
        trackingStatus: 'applied-to-readiness',
        sourceIdentity: expect.objectContaining({
          subSkillId: 10100322,
        }),
      }),
    ]);
    expect(
      result.effectTimeline.events.filter(
        event => event.actionId === derivedActionId
      )
    ).toEqual([
      expect.objectContaining({
        type: 'EFFECT_APPLIED',
        timeMs: 950,
        frameIndex: 57,
        actionId: derivedActionId,
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
    expect(
      intervalProjection.intervals.filter(
        interval => interval.sourceActionId === derivedActionId
      )
    ).toEqual([
      expect.objectContaining({
        effectId: 'buff-101003141',
        effectName: '防御力降低',
        icon: 'tex_icon_buff_defdown.png',
        startMs: 950,
        endMs: 8950,
        startFrame: 57,
        endFrame: 537,
        sourceActionId: derivedActionId,
        confidence: 'medium',
        trackingStatus: 'unapplied',
        sourceStatus: 'generated-from-azpr-action-status-catalog',
        appliedToCalculators: false,
      }),
    ]);
    expect(
      result.actionEffectRelationGraph.edges.filter(
        edge => edge.commandActionId === derivedActionId
      )
    ).toEqual([
      expect.objectContaining({
        commandActionId: derivedActionId,
        effectId: 'buff-101003141',
        targetTimeMs: 950,
        trackingStatus: 'unapplied',
        sourceIdentity: expect.objectContaining({
          elementConfigId: 101003141,
        }),
      }),
    ]);
    expect(result.effectTimeline.summary.calculatorAppliedEffectCount).toBe(0);
  });

  it('does not emit lifecycle state for a cooldown-blocked generated action', () => {
    const project = createStatusLifecycleProject([
      createStatusAction({ id: 'status-action-1', startMs: 0 }),
      createStatusReturnAction({ id: 'status-action-return', startMs: 500 }),
      createStatusAction({ id: 'status-action-blocked', startMs: 1000 }),
    ]);
    const scenario = compileProject(project, getWorkbenchGameData());
    const result = simulateScenario(scenario);
    const firstDerivedActionId = createStatusDerivedActionId('status-action-1');
    const blockedDerivedActionId = createStatusDerivedActionId(
      'status-action-blocked'
    );

    expect(
      result.actionExecutionPlan.actions.find(
        action => action.actionId === firstDerivedActionId
      )
    ).toMatchObject({ execute: true });
    expect(
      scenario.actions.find(action => action.id === blockedDerivedActionId)
    ).toBeUndefined();
    expect(
      scenario.switchTriggerGeneration.bindings.find(
        binding => binding.switchEventId === 'status-action-blocked'
      )
    ).toMatchObject({
      resolutionStatus: 'suppressed-cooldown-active',
      materializationStatus: 'not-materialized',
      starCarryActionIdentity: 'actor|101003|10100322|0|10100322',
      applied: false,
    });
    expect(result.effectTimeline.input.summary).toMatchObject({
      inputCommandCount: expect.any(Number),
      executableInputCommandCount: expect.any(Number),
      blockedCommandCount: expect.any(Number),
      commandCount: expect.any(Number),
    });
    expect(
      result.effectTimeline.events.filter(
        event => event.actionId === blockedDerivedActionId
      )
    ).toEqual([]);
    expect(
      result.actionEffectRelationGraph.edges.filter(
        edge => edge.commandActionId === blockedDerivedActionId
      )
    ).toEqual([]);
    expect(scenario.switchTriggerGeneration.summary).toMatchObject({
      cooldownSuppressedBindingCount: 2,
    });
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

  it('shows the sourced water spirit signature cooldown and evaluates future modifiers before conflicts', () => {
    const project = createStatusProject(
      [
        createKiboStatusAction({
          id: 'water-signature-1',
          startMs: 0,
          kiboId: 500003,
          skillId: 50000302,
          actorCharacterId: 101007,
          name: '灵偶涟漪',
        }),
        createKiboStatusAction({
          id: 'water-signature-2',
          startMs: 13000,
          kiboId: 500003,
          skillId: 50000302,
          actorCharacterId: 101007,
          name: '灵偶涟漪',
        }),
      ],
      {
        actorConfigs: [
          {
            characterId: 101007,
            loadout: { kiboId: 500003 },
          },
        ],
      }
    );
    const baseline = runSimulation(project, getWorkbenchGameData());

    expect(
      baseline.actionRuleDiagnostics.readinessTimeline.cooldownWindows
    ).toEqual([
      expect.objectContaining({
        actionId: 'water-signature-1',
        ownerKind: 'kibo',
        ownerId: 500003,
        skillId: 50000302,
        baseDurationMs: 24000,
        effectiveDurationMs: 24000,
        durationMs: 24000,
      }),
    ]);
    expect(
      baseline.actionRuleDiagnostics.readinessTimeline.actions.find(
        action => action.actionId === 'water-signature-2'
      )
    ).toMatchObject({
      status: 'blocked',
      executable: false,
      violationCodes: ['skill-cooldown-active'],
      cooldown: {
        status: 'blocked-no-charge-ready',
        baseCooldownMs: 24000,
        effectiveCooldownMs: 24000,
      },
    });
    expect(
      baseline.eventLog.filter(event => event.type === 'COOLDOWN_START')
    ).toEqual([
      expect.objectContaining({
        actionId: 'water-signature-1',
        payload: expect.objectContaining({
          cooldownMs: 24000,
          baseCooldownMs: 24000,
          ownerKind: 'kibo',
          ownerId: 500003,
          skillId: 50000302,
        }),
      }),
    ]);

    const adapted = runSimulation(project, getWorkbenchGameData(), {
      actionCooldownEvaluationAdapter: {
        adapterId: 'test-water-cooldown-buff',
        evaluate(request) {
          return request.skillId === 50000302
            ? {
                effectiveDurationMs: 12000,
                modifiers: [
                  {
                    sourceKind: 'test-only-cooldown-buff',
                    sourceId: 'test-buff-1',
                  },
                ],
                sourceStatus: 'test-only-modifier-applied',
              }
            : {};
        },
      },
    });

    expect(
      adapted.actionRuleDiagnostics.readinessTimeline.actions.find(
        action => action.actionId === 'water-signature-2'
      )
    ).toMatchObject({
      status: 'ready',
      executable: true,
    });
    expect(
      adapted.actionRuleDiagnostics.readinessTimeline.cooldownWindows
    ).toEqual([
      expect.objectContaining({
        actionId: 'water-signature-1',
        baseDurationMs: 24000,
        effectiveDurationMs: 12000,
        durationMs: 12000,
        modifierCount: 1,
        cooldownEvaluation: expect.objectContaining({
          status: 'cooldown-evaluation-adapted',
          appliedModifierCount: 1,
        }),
      }),
      expect.objectContaining({
        actionId: 'water-signature-2',
        startMs: 13000,
        endMs: 25000,
        durationMs: 12000,
      }),
    ]);
    expect(
      adapted.eventLog
        .filter(event => event.type === 'COOLDOWN_START')
        .map(event => event.payload)
    ).toEqual([
      expect.objectContaining({
        cooldownMs: 12000,
        baseCooldownMs: 24000,
        modifierCount: 1,
      }),
      expect.objectContaining({
        cooldownMs: 12000,
        baseCooldownMs: 24000,
        modifierCount: 1,
      }),
    ]);

    const recoveredWithoutTimingSource = runSimulation(
      createStatusProject(
        [
          createWorkbenchActionDraft({
            id: 'water-signature-recovered',
            type: 'kiboEvent',
            kiboId: 500003,
            skillId: 50000302,
            actorCharacterId: 101007,
            name: '灵偶涟漪',
            startMs: 0,
            durationMs: 1550,
            timingSource: null,
          }),
        ],
        {
          actorConfigs: [
            {
              characterId: 101007,
              loadout: { kiboId: 500003 },
            },
          ],
        }
      ),
      getWorkbenchGameData()
    );
    expect(
      recoveredWithoutTimingSource.actionRuleDiagnostics.readinessTimeline
        .cooldownWindows
    ).toEqual([
      expect.objectContaining({
        actionId: 'water-signature-recovered',
        kiboId: 500003,
        skillId: 50000302,
        durationMs: 24000,
      }),
    ]);
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

  it('blocks a confirmed ultimate reused before its sourced cooldown ends', () => {
    const result = runSimulation(
      createStatusProject([
        createWorkbenchActionDraft({
          id: 'ultimate-conflict-1',
          skillId: 10100713,
          actorCharacterId: 101007,
          startMs: 0,
        }),
        createWorkbenchActionDraft({
          id: 'ultimate-conflict-2',
          skillId: 10100713,
          actorCharacterId: 101007,
          startMs: 5000,
        }),
      ]),
      getWorkbenchGameData()
    );

    expect(
      result.actionRuleDiagnostics.readinessTimeline.actions.find(
        action => action.actionId === 'ultimate-conflict-2'
      )
    ).toMatchObject({
      status: 'blocked',
      executable: false,
      violationCodes: ['skill-cooldown-active'],
    });
    expect(
      result.actionExecutionPlan.actions.find(
        action => action.actionId === 'ultimate-conflict-2'
      )
    ).toMatchObject({
      execute: false,
      status: 'skipped-rule-blocked',
    });
    expect(
      result.eventLog.filter(event => event.type === 'COOLDOWN_START')
    ).toEqual([
      expect.objectContaining({
        actionId: 'ultimate-conflict-1',
        payload: expect.objectContaining({
          cooldownMs: 20000,
          baseCooldownMs: 20000,
          ownerKind: 'actor',
          skillId: 10100713,
        }),
      }),
    ]);
  });

  it('recomputes trigger timing and removes stale state after project edits', () => {
    const moved = runSimulation(
      createStatusLifecycleProject([
        createStatusAction({ id: 'status-action-moved', startMs: 5000 }),
      ]),
      getWorkbenchGameData()
    );
    const movedActionId = createStatusDerivedActionId('status-action-moved');
    expect(
      moved.effectTimeline.events
        .filter(event => event.actionId === movedActionId)
        .map(event => event.timeMs)
    ).toEqual([5950, 13950]);

    const removed = runSimulation(
      createStatusLifecycleProject([]),
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
    const sourceProject = createStatusLifecycleProject([
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

    expect(
      inheritedState.activeEffects.filter(
        effect => effect.sourceIdentity?.skillId === 10100322
      )
    ).toEqual([
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
      createStatusLifecycleProject([], { initialRuntimeState: inheritedState }),
      getWorkbenchGameData()
    );
    expect(
      inheritedResult.effectTimeline.events.filter(
        event => event.effectId === 'buff-101003141'
      )
    ).toEqual([
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
    type: 'switch',
    actorCharacterId: 101003,
    targetCharacterId: 101007,
    startMs,
    durationMs: 0,
  });
}

function createStatusReturnAction({ id, startMs }) {
  return createWorkbenchActionDraft({
    id,
    type: 'switch',
    actorCharacterId: 101007,
    targetCharacterId: 101003,
    startMs,
    durationMs: 0,
  });
}

function createStatusDerivedActionId(parentActionId) {
  return `${parentActionId}--on-exit--actor-101003--star-carry`;
}

function createKiboStatusAction({
  id,
  startMs,
  kiboId = 500001,
  skillId = 50000102,
  actorCharacterId = 109001,
  name = '迅风刃',
}) {
  return createWorkbenchActionDraft({
    id,
    type: 'kiboEvent',
    kiboId,
    skillId,
    actorCharacterId,
    name,
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

function createStatusLifecycleProject(
  actions,
  { initialRuntimeState = null } = {}
) {
  const teamSlots = [
    { slotId: 'team-slot-1', position: 0, characterId: 101003 },
    { slotId: 'team-slot-2', position: 1, characterId: 101007 },
    { slotId: 'team-slot-3', position: 2, characterId: 109001 },
  ];
  return createWorkbenchProject(
    {
      characterId: 101003,
      secondaryCharacterId: 101007,
      tertiaryCharacterId: 109001,
      skillId: 10100301,
      enemyId: 300032,
    },
    {
      actions,
      teamSlots,
      durationMs: 30000,
      initialRuntimeState: initialRuntimeState ?? {
        controlledActor: {
          actorId: 'actor-101003',
          characterId: 101003,
        },
      },
    }
  );
}
