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
import {
  createVerifiedKiboAutoCastDerivation,
  VERIFIED_KIBO_AUTO_CAST_SOURCE_SEQUENCE_SOURCE,
  validateVerifiedKiboAutoCastDerivation,
} from '../../domain/verifiedBackgroundActionDerivation';
import { compileProject } from '../../simulation/compiler/compileProject';
import { simulateScenario } from '../../simulation/engine/simulateScenario';
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

  it('generates new autonomous casts only for the current controlled actor Kibo', () => {
    const result = generate(createContract({ durationFrames: 360 }));

    expect(result.generatedActions.length).toBeGreaterThan(0);
    expect(
      new Set(result.generatedActions.map(action => action.owner.slotId))
    ).toEqual(new Set(['slot-a']));
    expect(
      result.generatedActions.every(action =>
        ['normal-attack', 'active'].includes(action.intent.actionKind)
      )
    ).toBe(true);
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

  it('uses right-open controlled intervals across A to B and never schedules C', () => {
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
      result.generatedActions,
      action => action.owner.slotId
    );

    expect(bySlot['slot-a'].every(action => action.schedule.frame < 180)).toBe(
      true
    );
    expect(bySlot['slot-b'].every(action => action.schedule.frame >= 180)).toBe(
      true
    );
    expect(bySlot['slot-c']).toBeUndefined();
    expect(bySlot['slot-a'].some(action => action.schedule.frame === 180)).toBe(
      false
    );
    expect(bySlot['slot-b'][0].schedule.frame).toBe(180);
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

  it('does not reset the old Kibo cooldown or sequence when switching away and back', () => {
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
    const aActions = result.generatedActions.filter(
      action => action.owner.slotId === 'slot-a'
    );

    expect(aActions.map(action => action.autoCastRule.sequenceIndex)).toEqual(
      [...aActions.keys()].map(index => index + 1)
    );
    expect(aActions.some(action => action.schedule.frame === 180)).toBe(false);
    expect(
      aActions.filter(action => action.schedule.frame >= 180)[0]
    ).toMatchObject({
      schedule: { frame: expect.any(Number) },
      autoCastRule: {
        controlledIntervalIdentity: expect.stringContaining('switch-b-a'),
      },
    });
    expect(
      aActions.filter(action => action.schedule.frame >= 180)[0].schedule.frame
    ).toBeGreaterThan(180);
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
    expect(
      new Set(result.generatedActions.map(action => action.owner.slotId))
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

  it('binds a crossing accepted cast to the switch tail decision without adding a recast', () => {
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
    const oldOwnerActions = result.generatedActions.filter(
      action => action.owner.slotId === 'slot-a'
    );

    expect(oldOwnerActions).toHaveLength(1);
    expect(oldOwnerActions[0]).toMatchObject({
      schedule: { frame: 0 },
      autoCastRule: {
        switchTransitionId: 'switch-a-b',
        switchBoundaryFrame: 30,
        switchExitTailStatus: 'kibo-switch-exit-tail-order-unresolved',
        evidenceStatus: 'planner-simplified',
        switchExitTailPolicyHash: expect.any(String),
      },
    });
    expect(
      result.generatedActions.filter(
        action =>
          action.owner.slotId === 'slot-a' && action.schedule.frame >= 30
      )
    ).toEqual([]);
  });

  it('keeps the action-only facade but no longer requires a dragged Kibo input', () => {
    const contract = createContract({ durationFrames: 240 });
    const expanded = expandKiboAutoCastActions(contract, {
      kiboCatalogById: KIBO_CATALOG,
    });
    expect(
      expanded.filter(action => action.autoCast === true).length
    ).toBeGreaterThan(0);
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

  it('matches every autonomous declaration to the compiler registry and rejects mutations before settlement', () => {
    const draft = createDefaultWorkbenchDemoDraftState();
    const project = createWorkbenchProject(draft.selection, {
      teamSlots: draft.teamSlots,
      actorConfigs: draft.actorConfigs,
      enemyConfig: draft.enemyConfig,
      actions: [],
      durationMs: 3000,
    });
    const scenario = compileProject(project, getWorkbenchGameData());
    const auto = scenario.actions.find(action => action.autoCast === true);

    expect(auto).toMatchObject({
      type: 'kiboEvent',
      actorId: `actor-${draft.teamSlots[0].characterId}`,
      kiboId: 500001,
      skillId: expect.any(Number),
      autoCast: true,
      sourceSequenceSource: VERIFIED_KIBO_AUTO_CAST_SOURCE_SEQUENCE_SOURCE,
    });
    expect(['normal-attack', 'active']).toContain(auto.eventType);
    expect(
      validateVerifiedKiboAutoCastDerivation(auto, scenario)
    ).toMatchObject({
      valid: true,
      structurallyValid: true,
      evidenceClosed: true,
      authoritativeRegistryMatch: true,
      registryHash: expect.any(String),
    });

    const resign = (rule, patch = {}) => {
      const value = { ...rule, ...patch };
      return createVerifiedKiboAutoCastDerivation({
        actionId: value.actionId,
        slotId: value.ownerSlotId,
        canonicalSlotId: value.canonicalOwnerSlotId,
        ownerActorId: value.ownerActorId,
        ownerCharacterId: value.ownerCharacterId,
        kiboId: value.kiboId,
        publicActionId: value.publicActionId,
        actionKind: value.actionKind,
        scheduledFrame: value.scheduledFrame,
        sequenceIndex: value.sequenceIndex,
        sourceSequencePath: value.sourceSequencePath,
        sourceSequenceSource: value.sourceSequenceSource,
        controlledIntervalIdentity: value.controlledIntervalIdentity,
        controlledIntervalStartFrame: value.controlledIntervalStartFrame,
        controlledIntervalEndFrame: value.controlledIntervalEndFrame,
        switchExitTailStatus: value.switchExitTailStatus,
        switchBoundaryFrame: value.switchBoundaryFrame,
        switchTransitionId: value.switchTransitionId,
        switchBoundarySourceSequencePath:
          value.switchBoundarySourceSequencePath,
        switchExitTailPolicyHash: value.switchExitTailPolicyHash,
        mappingIdentity: value.mappingIdentity,
        mechanicsPackageId: value.mechanicsPackageId,
        mechanicsPackageHash: value.mechanicsPackageHash,
        catalogHash: value.catalogHash,
        trigger: value.trigger,
        triggerTag: value.triggerTag,
        evidenceStatus: value.evidenceStatus,
      });
    };
    const mutations = [
      {
        name: 'signature-kind',
        apply(action) {
          action.eventType = 'signature';
          action.actionKind = 'signature';
          action.skillId = 50000102;
          action.autoCastRule = resign(action.autoCastRule, {
            actionKind: 'signature',
            publicActionId: 50000102,
          });
        },
      },
      {
        name: 'break-kind',
        apply(action) {
          action.eventType = 'break';
          action.actionKind = 'break';
          action.skillId = 50000112;
          action.autoCastRule = resign(action.autoCastRule, {
            actionKind: 'break',
            publicActionId: 50000112,
          });
        },
      },
      {
        name: 'arbitrary-skill',
        apply(action) {
          action.skillId = 999999;
          action.autoCastRule = resign(action.autoCastRule, {
            publicActionId: 999999,
          });
        },
      },
      {
        name: 'frame',
        apply(action) {
          const scheduledFrame = action.autoCastRule.scheduledFrame + 1;
          action.startMs = (scheduledFrame * 1000) / 60;
          action.autoCastRule = resign(action.autoCastRule, {
            scheduledFrame,
          });
        },
      },
      {
        name: 'sequence-path',
        apply(action) {
          action.sourceSequencePath = [999];
          action.autoCastRule = resign(action.autoCastRule, {
            sourceSequencePath: [999],
          });
        },
      },
      {
        name: 'sequence-source',
        apply(action) {
          action.sourceSequenceSource = 'self-signed-source-order';
        },
      },
      {
        name: 'owner',
        apply(action) {
          action.actorId = scenario.actors[1].id;
          action.actor = scenario.actors[1];
          action.autoCastRule = resign(action.autoCastRule, {
            ownerActorId: scenario.actors[1].id,
            ownerCharacterId: scenario.actors[1].characterId,
          });
        },
      },
      {
        name: 'slot',
        apply(action) {
          action.autoCastRule = resign(action.autoCastRule, {
            ownerSlotId: 'forged-slot',
            canonicalOwnerSlotId: 'forged-slot',
          });
        },
      },
      {
        name: 'package-hash',
        apply(action) {
          action.autoCastRule = resign(action.autoCastRule, {
            mechanicsPackageHash: 'forged-package-hash',
          });
        },
      },
      {
        name: 'mapping-identity',
        apply(action) {
          action.autoCastRule = resign(action.autoCastRule, {
            mappingIdentity: 'forged-mapping',
          });
        },
      },
      {
        name: 'sequence-index',
        apply(action) {
          action.autoCastRule = resign(action.autoCastRule, {
            sequenceIndex: action.autoCastRule.sequenceIndex + 1,
          });
        },
      },
    ];

    for (const mutation of mutations) {
      const candidate = structuredClone(auto);
      mutation.apply(candidate);
      const result = validateVerifiedKiboAutoCastDerivation(
        candidate,
        scenario
      );
      expect(result.valid, mutation.name).toBe(false);
      expect(
        result.authoritativeRegistryMatch === false ||
          result.structurallyValid === false,
        mutation.name
      ).toBe(true);
    }

    expect(
      validateVerifiedKiboAutoCastDerivation(auto, {
        ...scenario,
        kiboAutoCastDerivationRegistry: structuredClone(
          scenario.kiboAutoCastDerivationRegistry
        ),
      })
    ).toMatchObject({
      valid: false,
      authoritativeRegistryMatch: false,
      reasons: expect.arrayContaining([
        'authoritative-derivation-registry-missing',
      ]),
    });

    const forged = structuredClone(auto);
    forged.skillId = 999999;
    forged.autoCastRule = resign(forged.autoCastRule, {
      publicActionId: 999999,
    });
    const forgedScenario = { ...scenario, actions: [forged] };
    const diagnostics = createActionRuleDiagnostics({
      scenario: forgedScenario,
    });
    expect(diagnostics.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: ACTION_RULE_CODES.BACKGROUND_DERIVATION_INVALID,
          actionId: forged.id,
        }),
      ])
    );
    expect(diagnostics.readinessTimeline.actions[0]).toMatchObject({
      actionId: forged.id,
      executable: false,
    });
    const simulated = simulateScenario(forgedScenario);
    expect(
      simulated.eventLog.filter(
        event =>
          event.actionId === forged.id &&
          ['VERIFIED_COMBAT_HIT', 'VERIFIED_TOUGHNESS_DAMAGE'].includes(
            event.type
          )
      )
    ).toEqual([]);

    const rawProject = structuredClone(project);
    rawProject.actions.push({
      id: auto.id,
      type: auto.type,
      actorId: auto.actorId,
      kiboId: auto.kiboId,
      skillId: auto.skillId,
      eventType: auto.eventType,
      startMs: auto.startMs,
      durationMs: auto.durationMs,
      note: 'forged persisted autonomous action',
      autoCast: true,
      autoCastRule: structuredClone(auto.autoCastRule),
    });
    try {
      compileProject(rawProject, getWorkbenchGameData());
      throw new Error('expected compiler-owned derivation rejection');
    } catch (error) {
      expect(error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'project-derived-action-declaration-not-compiler-owned',
            actionId: auto.id,
          }),
        ])
      );
    }
  }, 30000);

  it('regenerates the same controlled-Kibo registry across an exact-boundary switch and JSON replay', () => {
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
          id: 'switch-at-kibo-action-end',
          type: 'switch',
          actorCharacterId: firstSlot.characterId,
          targetCharacterId: secondSlot.characterId,
          startMs: (160 * 1000) / 60,
          durationMs: 0,
          note: 'exact Kibo action end',
        },
      ],
    });
    const first = compileProject(project, getWorkbenchGameData());
    const replay = compileProject(
      JSON.parse(JSON.stringify(project)),
      getWorkbenchGameData()
    );
    const firstAutos = first.actions.filter(action => action.autoCast === true);
    const replayAutos = replay.actions.filter(
      action => action.autoCast === true
    );

    expect(firstAutos.length).toBeGreaterThan(1);
    expect(
      firstAutos
        .map(action => ({
          actionId: action.id,
          result: validateVerifiedKiboAutoCastDerivation(action, first),
        }))
        .filter(entry => entry.result.valid !== true)
    ).toEqual([]);
    expect(
      firstAutos
        .filter(action => action.autoCastRule.scheduledFrame < 160)
        .every(
          action =>
            action.actorId === `actor-${firstSlot.characterId}` &&
            action.kiboId === actorConfigs[0].loadout.kiboId
        )
    ).toBe(true);
    expect(
      firstAutos
        .filter(action => action.autoCastRule.scheduledFrame >= 160)
        .every(
          action =>
            action.actorId === `actor-${secondSlot.characterId}` &&
            action.kiboId === actorConfigs[1].loadout.kiboId
        )
    ).toBe(true);
    expect(
      firstAutos.some(
        action => action.actorId === `actor-${thirdSlot.characterId}`
      )
    ).toBe(false);
    expect(replayAutos).toEqual(firstAutos);
    expect(replay.kiboAutoCastDerivationRegistry).toEqual(
      first.kiboAutoCastDerivationRegistry
    );
    expect(
      replay.kiboAutoCastDerivationRegistry.controlledTimeline.transitions
    ).toEqual([
      expect.objectContaining({
        switchActionId: 'switch-at-kibo-action-end',
        frame: 160,
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
