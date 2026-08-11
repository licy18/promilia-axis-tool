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
          actorId: 'actor-101007',
          characterId: 101007,
          loadout: { kiboId: 500001 },
        },
        {
          slotId: 'slot-b',
          actorId: 'actor-101010',
          characterId: 101010,
          loadout: { kiboId: 500021 },
        },
        {
          slotId: 'slot-c',
          actorId: 'actor-103002',
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

describe('product-deferred Kibo autonomous action scheduler', () => {
  beforeEach(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
  });

  it('catalogues normal and active skills without generating, scheduling, or scoring them', () => {
    const result = generate(createContract({ durationFrames: 360 }));

    expect(result.generatedActions).toEqual([]);
    expect(result.triggerExclusions).toEqual([]);
    expect(result.scheduleExclusions).toEqual([]);
    expect(result.scopeExclusions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'kibo-autonomous-action-product-deferred',
          ownerSlotId: 'slot-a',
          actionKind: 'normal-attack',
          disposition: 'product-deferred-autonomous-action',
          calculationStatus: 'not-generated-not-scheduled-not-scored',
        }),
        expect.objectContaining({
          code: 'kibo-autonomous-action-product-deferred',
          ownerSlotId: 'slot-a',
          actionKind: 'active',
          disposition: 'product-deferred-autonomous-action',
          calculationStatus: 'not-generated-not-scheduled-not-scored',
        }),
      ])
    );
    expect(result.derivationGeneration).toMatchObject({
      evidenceStatus: 'static-evidence-closed',
      scopePolicy: {
        includedAxisActionKinds: ['signature', 'break'],
        retainedCalculationSurfaces: ['signature', 'joint-attack', 'passive'],
      },
      summary: {
        generatedActionCount: 0,
        scopeExclusionCount: 2,
        triggerExclusionCount: 0,
        scheduleExclusionCount: 0,
      },
    });
    expect(
      isAuthoritativeKiboAutoCastGeneration(result.derivationGeneration)
    ).toBe(true);
  });

  it('keeps right-open controlled-owner evidence without reviving autonomous casts', () => {
    const result = generate(
      createContract({
        durationFrames: 240,
        actions: [
          switchAction({
            id: 'switch-a-b',
            frame: 30,
            fromSlotId: 'slot-a',
            toSlotId: 'slot-b',
          }),
        ],
      })
    );

    expect(result.generatedActions).toEqual([]);
    expect(result.controlledTimeline.transitions).toEqual([
      expect.objectContaining({
        switchActionId: 'switch-a-b',
        frame: 30,
        fromActorId: 'actor-101007',
        toActorId: 'actor-101010',
      }),
    ]);
    expect(result.scopeExclusions).toEqual(
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
      result.scopeExclusions.some(entry => entry.ownerSlotId === 'slot-c')
    ).toBe(false);
  });

  it('does not project scope entries for an explicitly dead controlled Kibo', () => {
    const contract = createContract({ durationFrames: 120 });
    contract.scenario.initialRuntimeState.kiboVitalsBySlot = [
      { slotId: 'slot-a', kiboId: 500001, currentValue: 0, maxValue: 100 },
    ];

    const result = generate(contract);
    expect(result.generatedActions).toEqual([]);
    expect(result.scopeExclusions).toEqual([]);
  });

  it('keeps the action-only facade free of invented Kibo inputs', () => {
    const contract = createContract({ durationFrames: 240 });
    const expanded = expandKiboAutoCastActions(contract, {
      kiboCatalogById: KIBO_CATALOG,
    });

    expect(expanded).toEqual(contract.actions);
    expect(expanded.some(action => action.autoCast === true)).toBe(false);
  });

  it('does not let a caller mint scheduler authority', () => {
    const generated = generate(
      createContract({ actions: [], durationFrames: 0 })
    ).derivationGeneration;
    const forged = structuredClone(generated);
    const source = createContract().scenario;
    const actors = source.team.map(slot => ({
      id: slot.actorId,
      characterId: slot.characterId,
      loadout: structuredClone(slot.loadout),
    }));
    const team = {
      slots: source.team.map(slot => ({
        slotId: slot.slotId,
        actorId: slot.actorId,
      })),
    };

    expect(isAuthoritativeKiboAutoCastGeneration(forged)).toBe(false);
    expect(
      materializeVerifiedKiboAutoCastDerivationRegistry({
        generation: forged,
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

  it('never treats a self-signed embedded autonomous rule as compiler authority', () => {
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

  it('compiles no autonomous registry and leaves all three objectives free of cadence blockers', () => {
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
    expect(scenario.kiboAutoCastDerivationRegistry).toBeNull();
    const diagnostics = createActionRuleDiagnostics({
      scenario: { ...scenario, formalActionLegality: true },
    });
    expect(diagnostics.diagnostics.map(entry => entry.code)).not.toEqual(
      expect.arrayContaining([
        ACTION_RULE_CODES.KIBO_AUTO_CAST_SCHEDULE_UNRESOLVED,
        ACTION_RULE_CODES.KIBO_AUTO_CAST_TRIGGER_UNRESOLVED,
      ])
    );
    expect(
      scenario.actors.every(
        actor => actor.verifiedStaticKiboProperties?.ready === true
      )
    ).toBe(true);

    const firstSlot = draft.teamSlots[0];
    const firstKiboId = Number(draft.actorConfigs[0].loadout.kiboId);
    const deferredAction = KIBO_CATALOG.get(firstKiboId).actions.find(
      action => action.kind === 'normal-attack'
    );
    const importedProject = createWorkbenchProject(draft.selection, {
      teamSlots: draft.teamSlots,
      actorConfigs: draft.actorConfigs,
      enemyConfig: draft.enemyConfig,
      actions: [
        {
          id: 'imported-deferred-kibo-normal',
          type: 'kiboEvent',
          actorCharacterId: firstSlot.characterId,
          kiboId: firstKiboId,
          skillId: deferredAction.skillId,
          eventType: deferredAction.kind,
          name: deferredAction.name,
          startMs: 0,
          durationMs: 100,
        },
      ],
      durationMs: 3000,
    });
    const importedScenario = compileProject(
      importedProject,
      getWorkbenchGameData()
    );
    const importedDiagnostics = createActionRuleDiagnostics({
      scenario: { ...importedScenario, formalActionLegality: true },
    });
    expect(importedDiagnostics.executable).toBe(false);
    expect(importedDiagnostics.diagnostics).toContainEqual(
      expect.objectContaining({
        code: ACTION_RULE_CODES.BACKGROUND_DERIVATION_INVALID,
        actionId: 'imported-deferred-kibo-normal',
        reason: expect.stringContaining(
          'autonomous-kibo-action-product-deferred'
        ),
        source: expect.objectContaining({
          sourceKind: 'azpr-kibo-axis-action-scope-policy',
          sourceStatus: 'product-deferred-autonomous-action',
        }),
      })
    );
  }, 30_000);
});
