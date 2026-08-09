import { beforeEach, describe, expect, it } from 'vitest';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import generatedCatalog from '../../data/generated/workbench-kibo-action-catalog.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import { projectWorkbenchKiboActionCatalog } from '../../data/workbenchKiboActionCatalog';
import { createDefaultWorkbenchDemoDraftState } from '../../domain/workbenchDraftStorage';
import {
  createWorkbenchProject,
  getWorkbenchGameData,
} from '../../domain/workbenchProjectFactory';
import {
  createKiboAutoCastGeneration,
  expandKiboAutoCastActions,
  isAuthoritativeKiboAutoCastGeneration,
} from '../../machine-axis/kiboAutoCastScheduler';
import { createMachineAxisObjectiveContract } from '../../machine-axis/machineAxisObjectiveContract';
import {
  createVerifiedKiboAutoCastDerivation,
  materializeVerifiedKiboAutoCastDerivationRegistry,
  VERIFIED_KIBO_AUTO_CAST_SOURCE_SEQUENCE_SOURCE,
  validateVerifiedKiboAutoCastDerivation,
} from '../../domain/verifiedBackgroundActionDerivation';
import { compileProject } from '../../simulation/compiler/compileProject';
import {
  ACTION_RULE_CODES,
  createActionRuleDiagnostics,
} from '../../simulation/runtime/actionRuleDiagnostics';

const catalog = projectWorkbenchKiboActionCatalog(generatedCatalog);
const KIBO_CATALOG = new Map(
  catalog.items.map(item => [Number(item.kiboId), item])
);

function createContract({ actions = [], durationFrames = 720 } = {}) {
  return {
    scenario: {
      durationFrames,
      team: [
        {
          slotId: 'slot-a',
          characterId: 101007,
          loadout: { kiboId: 500001 },
        },
        {
          slotId: 'slot-b',
          characterId: 101010,
          loadout: { kiboId: 500021 },
        },
        {
          slotId: 'slot-c',
          characterId: 103002,
          loadout: { kiboId: 500022 },
        },
      ],
      initialRuntimeState: {
        controlledActor: {
          actorId: 'actor-101007',
          characterId: 101007,
        },
      },
    },
    actions,
  };
}

function switchAction({ id, frame, fromSlotId, toSlotId }) {
  return {
    id,
    owner: { kind: 'actor', slotId: fromSlotId },
    intent: { kind: 'switch', targetSlotId: toSlotId },
    schedule: { mode: 'absolute', frame },
  };
}

function generate(contract) {
  return createKiboAutoCastGeneration(contract, {
    kiboCatalogById: KIBO_CATALOG,
    fps: 60,
  });
}

describe('controlled Kibo auto-cast scheduler', () => {
  beforeEach(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
  });

  it('does not invent tag-0 frame, priority, cadence, cooldown, or resource transactions without the NodeCanvas graph', () => {
    const result = generate(createContract({ durationFrames: 360 }));

    expect(result.generatedActions).toEqual([]);
    expect(result.scheduleExclusions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'kibo-auto-cast-schedule-unresolved',
          ownerSlotId: 'slot-a',
          actionKind: 'normal-attack',
          triggerTag: '0',
          disposition: 'not-generated-without-nodecanvas-schedule',
        }),
        expect.objectContaining({
          code: 'kibo-auto-cast-schedule-unresolved',
          ownerSlotId: 'slot-a',
          actionKind: 'active',
          triggerTag: '0',
          disposition: 'not-generated-without-nodecanvas-schedule',
        }),
      ])
    );
    expect(result.derivationGeneration).toMatchObject({
      evidenceStatus: 'scheduler-evidence-open',
      summary: {
        generatedActionCount: 0,
        scheduleExclusionCount: expect.any(Number),
      },
    });
  });

  it('does not let a caller mint registry authority with generationAuthoritative=true', () => {
    const generated = generate(
      createContract({ actions: [], durationFrames: 0 })
    ).derivationGeneration;
    const forged = structuredClone(generated);
    const source = createContract().scenario;
    const actors = source.team.map(slot => ({
      id: `actor-${slot.characterId}`,
      characterId: slot.characterId,
      loadout: structuredClone(slot.loadout),
    }));
    const team = {
      slots: source.team.map(slot => ({
        slotId: slot.slotId,
        actorId: `actor-${slot.characterId}`,
      })),
    };

    expect(isAuthoritativeKiboAutoCastGeneration(forged)).toBe(false);
    expect(
      materializeVerifiedKiboAutoCastDerivationRegistry({
        generation: forged,
        generationAuthoritative: true,
        actions: [],
        actors,
        team,
        initialRuntimeState: source.initialRuntimeState,
        time: { fps: 60, durationMs: 0 },
      })
    ).toMatchObject({
      valid: false,
      registry: null,
      issues: [
        expect.objectContaining({
          code: 'verified-kibo-auto-cast-generation-not-authoritative',
        }),
      ],
    });
  });

  it('rejects a scheduler-minted generation that does not match this compilation catalog', () => {
    const source = createContract({ actions: [], durationFrames: 120 });
    const foreignGeneration = createKiboAutoCastGeneration(source, {
      kiboCatalogById: new Map(),
      fps: 60,
    }).derivationGeneration;
    const actors = source.scenario.team.map(slot => ({
      id: `actor-${slot.characterId}`,
      characterId: slot.characterId,
      loadout: structuredClone(slot.loadout),
    }));
    const team = {
      slots: source.scenario.team.map(slot => ({
        slotId: slot.slotId,
        actorId: `actor-${slot.characterId}`,
      })),
    };

    expect(isAuthoritativeKiboAutoCastGeneration(foreignGeneration)).toBe(true);
    expect(
      materializeVerifiedKiboAutoCastDerivationRegistry({
        generation: foreignGeneration,
        actions: [],
        actors,
        team,
        initialRuntimeState: source.scenario.initialRuntimeState,
        time: { fps: 60, durationMs: 2000 },
      })
    ).toMatchObject({
      valid: false,
      registry: null,
      issues: [
        expect.objectContaining({
          code: 'verified-kibo-auto-cast-generation-compilation-mismatch',
        }),
      ],
    });
  });

  it('records closed foreground eligibility without inventing autonomous casts', () => {
    const result = generate(createContract({ durationFrames: 360 }));

    expect(result.generatedActions).toEqual([]);
    expect(
      new Set(result.scheduleExclusions.map(entry => entry.ownerSlotId))
    ).toEqual(new Set(['slot-a']));
    expect(
      result.scheduleExclusions.every(
        entry =>
          entry.controlledIntervalStartFrame === 0 &&
          entry.controlledIntervalEndFrame === 360 &&
          entry.eligibilityStatus === 'foreground-owner-eligibility-closed'
      )
    ).toBe(true);
    expect(result.derivationGeneration.eligibilityContract).toMatchObject({
      status: 'foreground-kibo-eligibility-closed',
      evidenceClosed: true,
      requirements: {
        ownerActorMustBeControlled: true,
        controlledInterval: '[startFrame,endFrame)',
      },
      contractHash: expect.any(String),
    });
    expect(result.controlledTimeline).toMatchObject({
      initialActorId: 'actor-101007',
      transitions: [],
    });
    expect(
      isAuthoritativeKiboAutoCastGeneration(result.derivationGeneration)
    ).toBe(true);
    expect(
      isAuthoritativeKiboAutoCastGeneration(
        structuredClone(result.derivationGeneration)
      )
    ).toBe(false);
  });

  it('does not schedule a source-open auto cast for an explicitly dead controlled Kibo and hashes the vital boundary', () => {
    const alive = createContract({ durationFrames: 360 });
    const dead = structuredClone(alive);
    dead.scenario.initialRuntimeState.kiboVitalsBySlot = [
      {
        slotId: 'slot-a',
        actorId: 'actor-101007',
        kiboId: 500001,
        currentValue: 0,
        maxValue: 100,
      },
    ];

    const aliveResult = generate(alive);
    const deadResult = generate(dead);

    expect(deadResult.scheduleExclusions).toEqual([]);
    expect(deadResult.triggerExclusions).toEqual([]);
    expect(deadResult.generatedActions).toEqual([]);
    expect(deadResult.derivationGeneration.schedulerInputHash).not.toBe(
      aliveResult.derivationGeneration.schedulerInputHash
    );
  });

  it('projects right-open foreground eligibility across A to B and never grants C', () => {
    const result = generate(
      createContract({
        actions: [
          switchAction({
            id: 'switch-a-b',
            frame: 180,
            fromSlotId: 'slot-a',
            toSlotId: 'slot-b',
          }),
        ],
        durationFrames: 480,
      })
    );
    const bySlot = Object.groupBy(
      result.scheduleExclusions,
      entry => entry.ownerSlotId
    );

    expect(result.generatedActions).toEqual([]);
    expect(bySlot['slot-a']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          controlledIntervalStartFrame: 0,
          controlledIntervalEndFrame: 180,
        }),
      ])
    );
    expect(
      bySlot['slot-a'].every(entry => entry.controlledIntervalEndFrame === 180)
    ).toBe(true);
    expect(bySlot['slot-b']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          controlledIntervalStartFrame: 180,
          controlledIntervalEndFrame: 480,
        }),
      ])
    );
    expect(
      bySlot['slot-b'].every(
        entry => entry.controlledIntervalStartFrame === 180
      )
    ).toBe(true);
    expect(bySlot['slot-c']).toBeUndefined();
    expect(result.controlledTimeline.transitions).toEqual([
      {
        switchActionId: 'switch-a-b',
        frame: 180,
        sourceSequencePath: [0],
        fromActorId: 'actor-101007',
        toActorId: 'actor-101010',
      },
    ]);
  });
  it('preserves distinct eligibility intervals without inferring cooldown or cadence across switch-back', () => {
    const result = generate(
      createContract({
        actions: [
          switchAction({
            id: 'switch-a-b',
            frame: 120,
            fromSlotId: 'slot-a',
            toSlotId: 'slot-b',
          }),
          switchAction({
            id: 'switch-b-a',
            frame: 180,
            fromSlotId: 'slot-b',
            toSlotId: 'slot-a',
          }),
        ],
        durationFrames: 420,
      })
    );
    const aIntervals = [
      ...new Set(
        result.scheduleExclusions
          .filter(entry => entry.ownerSlotId === 'slot-a')
          .map(
            entry =>
              `${entry.controlledIntervalStartFrame}:${entry.controlledIntervalEndFrame}`
          )
      ),
    ];

    expect(result.generatedActions).toEqual([]);
    expect(aIntervals).toEqual(['0:120', '180:420']);
    expect(
      result.scheduleExclusions.every(
        entry =>
          entry.disposition === 'not-generated-without-nodecanvas-schedule'
      )
    ).toBe(true);
    expect(
      result.scheduleExclusions.some(
        entry =>
          'scheduledFrame' in entry ||
          'sequenceIndex' in entry ||
          'cooldownFrames' in entry
      )
    ).toBe(false);
  });
  it('records an off-field switch for the shared legality gate without granting background Kibo casts', () => {
    const result = generate(
      createContract({
        actions: [
          switchAction({
            id: 'forged-b-c-switch',
            frame: 30,
            fromSlotId: 'slot-b',
            toSlotId: 'slot-c',
          }),
        ],
        durationFrames: 240,
      })
    );

    expect(result.issues).toEqual([]);
    expect(result.controlledTimeline).toMatchObject({
      transitions: [],
      rejections: [
        expect.objectContaining({
          code: 'kibo-controlled-timeline-switch-source-not-controlled',
          actionId: 'forged-b-c-switch',
        }),
      ],
    });
    expect(result.generatedActions).toEqual([]);
    expect(
      new Set(result.scheduleExclusions.map(entry => entry.ownerSlotId))
    ).toEqual(new Set(['slot-a']));
  });
  it('does not synthesize a nonzero-tag Kibo trigger and preserves the open evidence in the generation hash', () => {
    const contract = createContract({
      actions: [
        switchAction({
          id: 'switch-a-b-at-160',
          frame: 160,
          fromSlotId: 'slot-a',
          toSlotId: 'slot-b',
        }),
      ],
      durationFrames: 300,
    });
    contract.scenario.team[1].loadout.kiboId = 500002;
    const result = generate(contract);

    expect(
      result.generatedActions.some(action => action.owner.slotId === 'slot-b')
    ).toBe(false);
    expect(result.triggerExclusions).toEqual([
      expect.objectContaining({
        code: 'kibo-auto-cast-trigger-unresolved',
        ownerSlotId: 'slot-b',
        kiboId: 500002,
        publicActionId: 502015,
        actionKind: 'normal-attack',
        triggerTag: '10|7',
        disposition: 'not-generated-without-closed-trigger',
      }),
    ]);
    expect(result.derivationGeneration).toMatchObject({
      evidenceStatus: 'scheduler-evidence-open',
      summary: { triggerExclusionCount: 1 },
      triggerExclusions: result.triggerExclusions,
    });
  });

  it('does not invent a crossing cast or tail while the NodeCanvas schedule is unresolved', () => {
    const result = generate(
      createContract({
        actions: [
          switchAction({
            id: 'switch-a-b',
            frame: 30,
            fromSlotId: 'slot-a',
            toSlotId: 'slot-b',
          }),
        ],
        durationFrames: 240,
      })
    );

    expect(result.generatedActions).toEqual([]);
    expect(result.scheduleExclusions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ownerSlotId: 'slot-a',
          controlledIntervalStartFrame: 0,
          controlledIntervalEndFrame: 30,
        }),
        expect.objectContaining({
          ownerSlotId: 'slot-b',
          controlledIntervalStartFrame: 30,
          controlledIntervalEndFrame: 240,
        }),
      ])
    );
    expect(
      result.scheduleExclusions.some(
        entry =>
          'switchExitTailStatus' in entry || 'switchExitTailPolicyHash' in entry
      )
    ).toBe(false);
  });
  it('keeps the action-only facade free of invented Kibo inputs', () => {
    const contract = createContract({ durationFrames: 240 });
    const expanded = expandKiboAutoCastActions(contract, {
      kiboCatalogById: KIBO_CATALOG,
    });

    expect(expanded).toEqual(contract.actions);
    expect(expanded.some(action => action.autoCast === true)).toBe(false);
  });
  it('never treats a self-signed embedded rule as compiler authority', () => {
    const actor = {
      id: 'actor-101007',
      characterId: 101007,
      loadout: { kiboId: 500001 },
    };
    const rule = createVerifiedKiboAutoCastDerivation({
      actionId: 'self-signed-auto',
      slotId: 'team-slot-1',
      canonicalSlotId: 'team-slot-1',
      ownerActorId: actor.id,
      ownerCharacterId: actor.characterId,
      kiboId: 500001,
      publicActionId: 504003,
      actionKind: 'normal-attack',
      scheduledFrame: 30,
      sequenceIndex: 1,
      sourceSequencePath: [0],
      sourceSequenceSource: VERIFIED_KIBO_AUTO_CAST_SOURCE_SEQUENCE_SOURCE,
      trigger: 'unconditional',
      triggerTag: '0',
      evidenceStatus: 'static-evidence-closed',
    });
    const action = {
      id: 'self-signed-auto',
      type: 'kiboEvent',
      actorId: actor.id,
      actor,
      kiboId: 500001,
      skillId: 504003,
      eventType: 'normal-attack',
      startMs: 500,
      autoCast: true,
      autoCastRule: rule,
      sourceSequencePath: [0],
      sourceSequenceSource: VERIFIED_KIBO_AUTO_CAST_SOURCE_SEQUENCE_SOURCE,
    };

    expect(
      validateVerifiedKiboAutoCastDerivation(action, {
        time: { fps: 60 },
        actors: [actor],
        team: { slots: [{ slotId: 'team-slot-1', actorId: actor.id }] },
      })
    ).toMatchObject({
      valid: false,
      structurallyValid: true,
      evidenceClosed: false,
      authoritativeRegistryMatch: false,
      reasons: expect.arrayContaining([
        'authoritative-derivation-registry-missing',
      ]),
    });
  });

  it('materializes only schedule-open compiler evidence and makes it a formal hard gate', () => {
    const draft = createDefaultWorkbenchDemoDraftState();
    const project = createWorkbenchProject(draft.selection, {
      teamSlots: draft.teamSlots,
      actorConfigs: draft.actorConfigs,
      enemyConfig: draft.enemyConfig,
      actions: [],
      durationMs: 3000,
    });
    const scenario = compileProject(project, getWorkbenchGameData());

    expect(scenario.actions.filter(action => action.autoCast === true)).toEqual(
      []
    );
    expect(scenario.kiboAutoCastDerivationRegistry).toMatchObject({
      status:
        'verified-kibo-auto-cast-derivation-registry-ready-with-open-evidence',
      evidenceClosed: false,
      entries: [],
      eligibilityContract: {
        status: 'foreground-kibo-eligibility-closed',
        evidenceClosed: true,
      },
      scheduleExclusions: expect.arrayContaining([
        expect.objectContaining({
          code: 'kibo-auto-cast-schedule-unresolved',
          ownerActorId: `actor-${draft.teamSlots[0].characterId}`,
          triggerTag: '0',
        }),
      ]),
      summary: {
        entryCount: 0,
        scheduleExclusionCount: expect.any(Number),
        triggerExclusionCount: expect.any(Number),
        controlledTransitionCount: 0,
      },
      registryHash: expect.any(String),
    });

    const diagnostics = createActionRuleDiagnostics({
      scenario: { ...scenario, formalActionLegality: true },
    });
    expect(diagnostics.executable).toBe(false);
    expect(diagnostics.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: ACTION_RULE_CODES.KIBO_AUTO_CAST_SCHEDULE_UNRESOLVED,
          status: 'violated',
          actionId: null,
          appliedToSimulationResults: true,
        }),
      ])
    );
    expect(
      diagnostics.summary.kiboAutoCastScheduleUnresolvedCount
    ).toBeGreaterThan(0);
  }, 30000);

  it('applies the same schedule hard gate to all three primary objectives', () => {
    const draft = createDefaultWorkbenchDemoDraftState();
    const project = createWorkbenchProject(draft.selection, {
      teamSlots: draft.teamSlots,
      actorConfigs: draft.actorConfigs,
      enemyConfig: draft.enemyConfig,
      actions: [],
      durationMs: 3000,
    });
    const scenario = compileProject(project, getWorkbenchGameData());

    for (const objectiveId of [
      'cycle-dps-no-toughness',
      'cycle-dps-with-toughness',
      'fastest-kill',
    ]) {
      const diagnostics = createActionRuleDiagnostics({
        scenario: {
          ...scenario,
          combatScenario: {
            ...scenario.combatScenario,
            objectiveContract: createMachineAxisObjectiveContract(objectiveId),
          },
        },
      });
      expect(diagnostics.executable, objectiveId).toBe(false);
      expect(diagnostics.diagnostics, objectiveId).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: ACTION_RULE_CODES.KIBO_AUTO_CAST_SCHEDULE_UNRESOLVED,
            status: 'violated',
            appliedToSimulationResults: true,
          }),
        ])
      );
    }
  }, 30000);
  it('regenerates the same schedule-open eligibility registry across an exact-boundary switch and JSON replay', () => {
    const draft = createDefaultWorkbenchDemoDraftState();
    const [firstSlot, secondSlot, thirdSlot] = draft.teamSlots;
    const actorConfigs = structuredClone(draft.actorConfigs);
    actorConfigs[1].loadout.kiboId = 500001;
    const project = createWorkbenchProject(draft.selection, {
      teamSlots: draft.teamSlots,
      actorConfigs,
      enemyConfig: draft.enemyConfig,
      durationMs: 6000,
      actions: [
        {
          id: 'pre-switch-wait',
          type: 'wait',
          startMs: 0,
          durationMs: 500,
          note: 'preserve first plain source position',
        },
        {
          id: 'pre-switch-annotation',
          type: 'annotation',
          startMs: 1000,
          note: 'preserve second plain source position',
        },
        {
          id: 'switch-at-kibo-action-end',
          type: 'switch',
          actorCharacterId: firstSlot.characterId,
          targetCharacterId: secondSlot.characterId,
          startMs: (160 * 1000) / 60,
          durationMs: 0,
          note: 'exact controlled-owner boundary',
        },
      ],
    });
    const first = compileProject(project, getWorkbenchGameData());
    const replay = compileProject(
      JSON.parse(JSON.stringify(project)),
      getWorkbenchGameData()
    );

    expect(first.actions.filter(action => action.autoCast === true)).toEqual(
      []
    );
    expect(replay.actions.filter(action => action.autoCast === true)).toEqual(
      []
    );
    expect(replay.kiboAutoCastDerivationRegistry).toEqual(
      first.kiboAutoCastDerivationRegistry
    );
    const exclusions =
      first.kiboAutoCastDerivationRegistry.scheduleExclusions ?? [];
    expect(exclusions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ownerActorId: `actor-${firstSlot.characterId}`,
          controlledIntervalStartFrame: 0,
          controlledIntervalEndFrame: 160,
        }),
        expect.objectContaining({
          ownerActorId: `actor-${secondSlot.characterId}`,
          controlledIntervalStartFrame: 160,
        }),
      ])
    );
    expect(
      exclusions.some(
        entry => entry.ownerActorId === `actor-${thirdSlot.characterId}`
      )
    ).toBe(false);
    expect(
      replay.kiboAutoCastDerivationRegistry.controlledTimeline.transitions
    ).toEqual([
      expect.objectContaining({
        switchActionId: 'switch-at-kibo-action-end',
        frame: 160,
        sourceSequencePath: [2],
        fromActorId: `actor-${firstSlot.characterId}`,
        toActorId: `actor-${secondSlot.characterId}`,
      }),
    ]);
  }, 30000);
  it('lifts an equipped Kibo nonzero trigger tag into the shared formal legality proof without fabricating a cast', () => {
    const draft = createDefaultWorkbenchDemoDraftState();
    const [firstSlot, secondSlot] = draft.teamSlots;
    const project = createWorkbenchProject(draft.selection, {
      teamSlots: draft.teamSlots,
      actorConfigs: draft.actorConfigs,
      enemyConfig: draft.enemyConfig,
      durationMs: 6000,
      actions: [
        {
          id: 'switch-to-open-trigger-kibo',
          type: 'switch',
          actorCharacterId: firstSlot.characterId,
          targetCharacterId: secondSlot.characterId,
          startMs: (160 * 1000) / 60,
          durationMs: 0,
        },
      ],
    });
    const scenario = compileProject(project, getWorkbenchGameData());
    const secondActorId = `actor-${secondSlot.characterId}`;

    expect(
      scenario.actions.some(
        action => action.autoCast === true && action.actorId === secondActorId
      )
    ).toBe(false);
    expect(scenario.kiboAutoCastDerivationRegistry).toMatchObject({
      evidenceClosed: false,
      triggerExclusions: [
        expect.objectContaining({
          ownerActorId: secondActorId,
          kiboId: draft.actorConfigs[1].loadout.kiboId,
          triggerTag: '10|7',
        }),
      ],
    });
    const diagnostics = createActionRuleDiagnostics({
      scenario: { ...scenario, formalActionLegality: true },
    });
    expect(diagnostics.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: ACTION_RULE_CODES.KIBO_AUTO_CAST_TRIGGER_UNRESOLVED,
          status: 'violated',
          actorId: secondActorId,
        }),
      ])
    );
  }, 30000);

  it('retains trigger exclusions when the controlled Kibo produces zero generated actions', () => {
    const draft = createDefaultWorkbenchDemoDraftState();
    const firstSlot = draft.teamSlots[0];
    const actorConfigs = draft.actorConfigs.map((actor, index) =>
      index === 0
        ? {
            ...actor,
            loadout: { ...actor.loadout, kiboId: 500002 },
          }
        : actor
    );
    const project = createWorkbenchProject(draft.selection, {
      teamSlots: draft.teamSlots,
      actorConfigs,
      enemyConfig: draft.enemyConfig,
      durationMs: 3000,
      actions: [],
    });
    const scenario = compileProject(project, getWorkbenchGameData());
    const controlledActorId = `actor-${firstSlot.characterId}`;

    expect(scenario.actions.filter(action => action.autoCast === true)).toEqual(
      []
    );
    expect(scenario.kiboAutoCastDerivationRegistry).toMatchObject({
      evidenceClosed: false,
      entries: [],
      triggerExclusions: [
        expect.objectContaining({
          ownerActorId: controlledActorId,
          kiboId: 500002,
          triggerTag: '10|7',
        }),
      ],
    });
    const diagnostics = createActionRuleDiagnostics({
      scenario: { ...scenario, formalActionLegality: true },
    });
    expect(diagnostics.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: ACTION_RULE_CODES.KIBO_AUTO_CAST_TRIGGER_UNRESOLVED,
          status: 'violated',
          actorId: controlledActorId,
        }),
      ])
    );
  }, 30000);
});
