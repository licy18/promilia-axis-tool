import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import kiboPassiveMechanicsCatalog from '../../data/generated/kibo-passive-mechanics.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
  resolveVerifiedCombatActionMechanics,
} from '../../data/verifiedCombatMechanicsPackage';
import { createVerifiedWorkbenchMechanicsProfileSelection } from '../../domain/workbenchMechanicsProfileSelection';
import {
  DEFAULT_WORKBENCH_SELECTION,
  createWorkbenchActionDraft,
  createWorkbenchProject,
  getWorkbenchGameData,
  normalizeWorkbenchActorConfigs,
} from '../../domain/workbenchProjectFactory';
import { compileProject } from '../../simulation/compiler/compileProject';
import { simulateScenario } from '../../simulation/engine/simulateScenario';
import {
  calculateAutoSp,
  calculateHitSp,
} from '../../simulation/mechanics/verifiedCombatFormulaRuntime';
import { createVerifiedKiboPassiveGeneration } from '../../simulation/mechanics/verifiedKiboPassiveGeneration';
import { resolveActiveEffectsAt } from '../../simulation/runtime/effectRuntimeTimeline';

const OWNER_ID = 107003;
const WRONG_OWNER_ID = 101003;
const THIRD_ACTOR_ID = 103002;
const KIBO_ID = 500023;
const PASSIVE_SKILL_ID = 520019;
const PUBLIC_SKILL_ID = 10700301;
const ACTION_VARIANT_INDEX = 6;
const CONTROL_SKILL_ID = 10700315;
const ACTION_DURATION_FRAMES = 185;
const HIT_FRAME = 22;
const ACTION_STARTS = [0, 11000, 22000, 33000, 44000];
const OWNER_SLOT_ID = 'team-slot-1';
const PASSIVE_EFFECT_ID = 'kibo-passive:520019:520019003';
const REAL_HIT_IDENTITY = mechanicsPackage.controlBindings
  .find(binding => Number(binding.controlSkillId) === CONTROL_SKILL_ID)
  .hits.find(hit => hit.damage).hitIdentity;

beforeEach(() => {
  installVerifiedCombatMechanicsPackage(mechanicsPackage);
});

afterEach(() => {
  clearInstalledVerifiedCombatMechanicsPackage();
});

describe('verified Kibo PetOwner damage passive', () => {
  it('uses real 500023 + 10700301 variant 6 water Hits to stack SPGETUP and affect later SP recovery', () => {
    const scenario = createScenario({
      actions: ACTION_STARTS.map((startMs, index) =>
        createOwnerAction({ id: `water-dodge-${index + 1}`, startMs })
      ),
      durationMs: 48000,
    });
    const result = simulateScenario(scenario);
    const commands = passiveCommands(result);
    const ownerActorId = findActorId(scenario, OWNER_ID);

    expect(
      result.verifiedCombatRuntime.damageEvents
        .filter(event => event.actionId?.startsWith('water-dodge-'))
        .map(event => ({
          actionId: event.actionId,
          hitSkillId: event.hitSkillId,
          hitIndex: event.hitIndex,
        }))
    ).toEqual(
      ACTION_STARTS.map((_, index) => ({
        actionId: `water-dodge-${index + 1}`,
        hitSkillId: CONTROL_SKILL_ID,
        hitIndex: 1,
      }))
    );
    expect(commands).toHaveLength(5);
    expect(
      commands.map(command => ({
        actionId: command.sourceActionId,
        targetKind: command.targetKind,
        targetId: command.targetId,
        valueRaw: command.modifiers[0].valueRaw,
        elementalType: command.sourceIdentity.triggerElementalType,
      }))
    ).toEqual(
      ACTION_STARTS.map((_, index) => ({
        actionId: `water-dodge-${index + 1}`,
        targetKind: 'actor',
        targetId: ownerActorId,
        valueRaw: 400,
        elementalType: 6,
      }))
    );
    expect(
      resolveActiveEffectsAt(result.effectTimeline, scenario.time.durationMs, {
        targetKind: 'actor',
        targetId: ownerActorId,
        calculatorOnly: true,
      }).filter(effect => effect.effectId === PASSIVE_EFFECT_ID)
    ).toEqual([
      expect.objectContaining({
        effectId: PASSIVE_EFFECT_ID,
        stacks: 5,
        expiresAtMs: null,
        modifiers: [
          expect.objectContaining({
            attributeId: 105,
            bucket: 'dynamicExtra',
            valueRaw: 400,
          }),
        ],
      }),
    ]);

    const hitRecoveries = result.verifiedCombatRuntime.resourceEvents.filter(
      event =>
        event.actorId === ownerActorId &&
        event.actionId?.startsWith('water-dodge-') &&
        event.payload.reason === 'verified-hit-sp-recovery'
    );
    const expectedHitRecoveries = ACTION_STARTS.map((_, index) =>
      calculateHitSp({
        recoverSp: 8999,
        pet: false,
        spGetUp: index * 0.04,
        spGetUpAttack: 0,
        maximumSp: Number.MAX_SAFE_INTEGER,
        recoverInterval: 9999,
      })
    );
    expect(
      hitRecoveries.map(event => ({
        actionId: event.actionId,
        raw: event.payload.formula.raw,
        value: event.payload.formula.value,
      }))
    ).toEqual(
      expectedHitRecoveries.map((formula, index) => ({
        actionId: `water-dodge-${index + 1}`,
        raw: formula.raw,
        value: formula.value,
      }))
    );
    expect(hitRecoveries.map(event => event.payload.formula.value)).toEqual(
      [...hitRecoveries]
        .map(event => event.payload.formula.value)
        .sort((left, right) => left - right)
    );

    const fifthEffectAtMs = ACTION_STARTS[4] + (HIT_FRAME * 1000) / 60 + 0.001;
    const laterAutoSp = result.verifiedCombatRuntime.resourceEvents.find(
      event =>
        event.actorId === ownerActorId &&
        event.timeMs > fifthEffectAtMs &&
        event.payload.reason === 'verified-auto-sp-foreground'
    );
    const expected = calculateAutoSp({
      background: false,
      sprSec: 0.2084,
      sprSecBack: 0.1042,
      spGetUp: 0.2,
      spRetAuto: 0,
      tickSeconds: 0.1,
      maximumSp: 100,
    });

    expect(laterAutoSp).toBeTruthy();
    expect(laterAutoSp.payload.formula).toMatchObject({
      mode: expected.mode,
      raw: expected.raw,
      value: expected.value,
    });
    expect(
      laterAutoSp.payload.formula.trace.find(
        step => step.name === 'auto_sp_bonus'
      )
    ).toEqual(expected.trace.find(step => step.name === 'auto_sp_bonus'));
  });

  it('does not publish the passive from a Kibo equipped by a different actor', () => {
    const scenario = createScenario({
      actions: [createOwnerAction({ id: 'wrong-wearer-water', startMs: 0 })],
      kiboByCharacterId: {
        [WRONG_OWNER_ID]: KIBO_ID,
      },
    });
    const result = simulateScenario(scenario);

    expect(
      result.verifiedCombatRuntime.damageEvents.some(
        event => event.actionId === 'wrong-wearer-water'
      )
    ).toBe(true);
    expect(passiveCommands(result)).toEqual([]);
  });

  it.each([
    {
      label: 'fire',
      elementalType: 1,
      commandCount: 0,
      suppressionCount: 1,
    },
    {
      label: 'light',
      elementalType: 8,
      commandCount: 1,
      suppressionCount: 0,
    },
  ])(
    'uses the controlled $label element branch for the water-or-light condition',
    ({ elementalType, commandCount, suppressionCount }) => {
      installVerifiedCombatMechanicsPackage(
        createControlledElementPackage(elementalType)
      );
      const scenario = createScenario({
        actions: [
          createOwnerAction({
            id: `controlled-element-${elementalType}`,
            startMs: 0,
          }),
        ],
      });
      const result = simulateScenario(scenario);
      const commands = passiveCommands(result);
      const suppressions =
        result.verifiedKiboPassiveGeneration.conditionSuppressions.filter(
          row => Number(row.skillId) === PASSIVE_SKILL_ID
        );

      expect(commands).toHaveLength(commandCount);
      expect(suppressions).toHaveLength(suppressionCount);
      if (elementalType === 8) {
        expect(commands[0]).toMatchObject({
          targetKind: 'actor',
          targetId: findActorId(scenario, OWNER_ID),
          sourceIdentity: {
            passiveSkillId: PASSIVE_SKILL_ID,
            triggerDamageType: 3,
            triggerElementalType: 8,
          },
          modifiers: [
            expect.objectContaining({
              attributeId: 105,
              valueRaw: 400,
            }),
          ],
        });
      } else {
        expect(suppressions[0]).toMatchObject({
          actionId: 'controlled-element-1',
          conditionScope: 'damage-hit',
          actualDamageType: 3,
          actualElementalType: 1,
          reason: 'kibo-passive-hit-damage-condition-not-matched',
        });
      }
    }
  );

  it('does not trigger when the real water Hit is overridden to miss', () => {
    const scenario = createScenario({
      actions: [
        createOwnerAction({
          id: 'missed-water-hit',
          startMs: 0,
          hitOverrides: {
            [REAL_HIT_IDENTITY]: { willHit: false },
          },
        }),
      ],
    });
    const result = simulateScenario(scenario);

    expect(
      result.verifiedCombatRuntime.damageEvents.some(
        event => event.actionId === 'missed-water-hit'
      )
    ).toBe(false);
    expect(passiveCommands(result)).toEqual([]);
  });

  it('keeps clearType80 active for this battle and starts a fresh battle without leaked stacks', () => {
    const firstScenario = createScenario({
      actions: [createOwnerAction({ id: 'persistent-water-hit', startMs: 0 })],
      durationMs: 6000,
    });
    const first = simulateScenario(firstScenario);
    const firstOwnerActorId = findActorId(firstScenario, OWNER_ID);
    const firstEffects = resolveActiveEffectsAt(
      first.effectTimeline,
      firstScenario.time.durationMs,
      {
        targetKind: 'actor',
        targetId: firstOwnerActorId,
        calculatorOnly: true,
      }
    ).filter(effect => effect.effectId === PASSIVE_EFFECT_ID);

    expect(passiveCommands(first)[0]).toMatchObject({
      durationMs: null,
      clearType: 80,
      clearTypeFlags: expect.arrayContaining([
        'executorExitBattleFieldClear',
        'ExitBattleClear',
      ]),
      clearCarrierActorId: firstOwnerActorId,
      stackMode: 'stack',
      maxStacks: 5,
      sourceIdentity: {
        passiveSkillId: PASSIVE_SKILL_ID,
        effectElementId: 520019003,
      },
    });
    expect(firstEffects).toEqual([
      expect.objectContaining({
        stacks: 1,
        expiresAtMs: null,
      }),
    ]);

    const secondScenario = createScenario({
      actions: [],
      durationMs: 1000,
    });
    const second = simulateScenario(secondScenario);
    const secondOwnerActorId = findActorId(secondScenario, OWNER_ID);

    expect(passiveCommands(second)).toEqual([]);
    expect(
      resolveActiveEffectsAt(
        second.effectTimeline,
        secondScenario.time.durationMs,
        {
          targetKind: 'actor',
          targetId: secondOwnerActorId,
          calculatorOnly: true,
        }
      ).filter(effect => effect.effectId === PASSIVE_EFFECT_ID)
    ).toEqual([]);
  });

  it('removes clearType80 when the PetOwner carrier exits on a real Workbench switch', () => {
    const switchActionId = 'switch-pet-owner-out';
    const switchAtMs = 3500;
    const scenario = createScenario({
      actions: [
        createOwnerAction({ id: 'water-before-switch', startMs: 0 }),
        createOwnerSwitchAction({ id: switchActionId, startMs: switchAtMs }),
      ],
      durationMs: 5000,
    });
    const result = simulateScenario(scenario);
    const ownerActorId = findActorId(scenario, OWNER_ID);
    const command = passiveCommands(result)[0];
    const removed = result.effectTimeline.events.find(
      event =>
        event.type === 'EFFECT_REMOVED' && event.effectId === PASSIVE_EFFECT_ID
    );

    expect(command).toMatchObject({
      sourceActionId: 'water-before-switch',
      targetKind: 'actor',
      targetId: ownerActorId,
      clearType: 80,
      clearTypeFlags: expect.arrayContaining([
        'executorExitBattleFieldClear',
        'ExitBattleClear',
      ]),
      clearCarrierActorId: ownerActorId,
    });
    expect(
      resolveActiveEffectsAt(result.effectTimeline, switchAtMs - 0.001, {
        targetKind: 'actor',
        targetId: ownerActorId,
        calculatorOnly: true,
      }).filter(effect => effect.effectId === PASSIVE_EFFECT_ID)
    ).toEqual([
      expect.objectContaining({
        stacks: 1,
        clearType: 80,
        clearTypeFlags: expect.arrayContaining([
          'executorExitBattleFieldClear',
          'ExitBattleClear',
        ]),
        clearCarrierActorId: ownerActorId,
      }),
    ]);
    expect(removed).toMatchObject({
      type: 'EFFECT_REMOVED',
      timeMs: switchAtMs,
      status: 'effect-runtime-executor-exit-battlefield-cleared',
      operation: 'remove',
      effectId: PASSIVE_EFFECT_ID,
      targetKind: 'actor',
      targetId: ownerActorId,
      stackBefore: 1,
      stackAfter: 0,
      controlledActorTransitionActionId: switchActionId,
      before: {
        active: true,
        clearType: 80,
        clearTypeFlags: expect.arrayContaining([
          'executorExitBattleFieldClear',
          'ExitBattleClear',
        ]),
        clearCarrierActorId: ownerActorId,
      },
      after: null,
    });
    expect(
      resolveActiveEffectsAt(result.effectTimeline, switchAtMs, {
        targetKind: 'actor',
        targetId: ownerActorId,
        calculatorOnly: true,
      }).filter(effect => effect.effectId === PASSIVE_EFFECT_ID)
    ).toEqual([]);
    expect(
      result.effectTimeline.activeEffects.filter(
        effect => effect.effectId === PASSIVE_EFFECT_ID
      )
    ).toEqual([]);
  });

  it('fails closed when the source-verified definition still declares a runtime gap', () => {
    const { scenario, action, resolution } = createDirectGenerationFixture();
    const catalog = createControlledPassiveCatalog({
      runtimeGaps: ['test-runtime-gap'],
    });
    const generation = createVerifiedKiboPassiveGeneration({
      scenario,
      actionResolutionById: new Map([[action.id, resolution]]),
      catalog,
    });

    expect(resolution).toMatchObject({
      ready: true,
      actionBinding: {
        ownerKind: 'actor',
        ownerId: OWNER_ID,
        controlSkillId: CONTROL_SKILL_ID,
      },
      hits: [
        expect.objectContaining({
          hitIdentity: REAL_HIT_IDENTITY,
          damage: expect.objectContaining({ elementalType: 6 }),
        }),
      ],
    });
    expect(generation.effectCommands).toEqual([]);
    expect(generation.unresolved).toEqual([
      expect.objectContaining({
        actionId: null,
        sourceActorId: action.actorId,
        kiboId: KIBO_ID,
        skillId: PASSIVE_SKILL_ID,
        status: 'kibo-passive-runtime-unresolved',
        reasons: ['test-runtime-gap'],
        evidence: {
          status: 'evidence-closed-runtime-gap',
          mechanismFamily: 'on-pet-owner-damage-source-property-effect',
        },
      }),
    ]);
  });

  it('fails closed with runtime actor evidence when the actor binding template ID mismatches', () => {
    const { scenario, action, resolution } = createDirectGenerationFixture();
    const mismatchedBindingOwnerId = OWNER_ID + 999;
    const mismatchedResolution = {
      ...resolution,
      actionBinding: {
        ...resolution.actionBinding,
        ownerId: mismatchedBindingOwnerId,
      },
    };
    const generation = createVerifiedKiboPassiveGeneration({
      scenario,
      actionResolutionById: new Map([[action.id, mismatchedResolution]]),
      catalog: createControlledPassiveCatalog(),
    });

    expect(generation.effectCommands).toEqual([]);
    expect(generation.unresolved).toEqual([
      expect.objectContaining({
        actionId: action.id,
        sourceActorId: action.actorId,
        kiboId: KIBO_ID,
        skillId: PASSIVE_SKILL_ID,
        status: 'kibo-passive-runtime-unresolved',
        reasons: ['actor-action-owner-binding-mismatch'],
        evidence: {
          actionActorId: action.actorId,
          bindingOwnerId: mismatchedBindingOwnerId,
          actorOwnerCandidates: expect.arrayContaining([
            {
              source: 'action.actor.characterId',
              value: OWNER_ID,
              identityKind: 'actor-template',
            },
            {
              source: 'scenario.actors[].characterId',
              value: OWNER_ID,
              identityKind: 'actor-template',
            },
          ]),
        },
      }),
    ]);
  });
});

function createScenario({
  actions,
  durationMs = 4000,
  kiboByCharacterId = { [OWNER_ID]: KIBO_ID },
}) {
  const teamSlots = [
    { slotId: OWNER_SLOT_ID, position: 0, characterId: OWNER_ID },
    {
      slotId: 'team-slot-2',
      position: 1,
      characterId: WRONG_OWNER_ID,
    },
    { slotId: 'team-slot-3', position: 2, characterId: THIRD_ACTOR_ID },
  ];
  const selection = {
    ...DEFAULT_WORKBENCH_SELECTION,
    characterId: OWNER_ID,
    secondaryCharacterId: WRONG_OWNER_ID,
  };
  const actorConfigs = normalizeWorkbenchActorConfigs(
    [],
    selection,
    teamSlots
  ).map(config => ({
    ...config,
    initialSp: 0,
    loadout: {
      ...config.loadout,
      kiboId:
        kiboByCharacterId[Number(config.characterId)] ??
        kiboByCharacterId[String(config.characterId)] ??
        null,
    },
  }));
  const project = createWorkbenchProject(selection, {
    durationMs,
    teamSlots,
    actorConfigs,
    actions,
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  return compileProject(project, getWorkbenchGameData());
}

function createOwnerAction({ id, startMs, hitOverrides = null }) {
  return createWorkbenchActionDraft({
    id,
    type: 'skill',
    actorCharacterId: OWNER_ID,
    skillId: PUBLIC_SKILL_ID,
    actionVariantIndex: ACTION_VARIANT_INDEX,
    startMs,
    durationFrames: ACTION_DURATION_FRAMES,
    durationMs: (ACTION_DURATION_FRAMES * 1000) / 60,
    hitOverrides,
  });
}

function createOwnerSwitchAction({ id, startMs }) {
  return createWorkbenchActionDraft({
    id,
    type: 'switch',
    actorCharacterId: OWNER_ID,
    targetCharacterId: WRONG_OWNER_ID,
    startMs,
    durationMs: 0,
  });
}

function createDirectGenerationFixture() {
  const scenario = createScenario({
    actions: [createOwnerAction({ id: 'direct-water-hit', startMs: 0 })],
  });
  const action = scenario.actions[0];
  const resolution = resolveVerifiedCombatActionMechanics(action, {
    combatScenario: scenario.combatScenario,
  });
  return { scenario, action, resolution };
}

function createControlledPassiveCatalog({ runtimeGaps = [] } = {}) {
  const definition = kiboPassiveMechanicsCatalog.definitions.find(
    row => Number(row.skillId) === PASSIVE_SKILL_ID
  );
  return {
    ...kiboPassiveMechanicsCatalog,
    definitions: [{ ...definition, runtimeGaps: [...runtimeGaps] }],
    unresolved: [],
  };
}

function passiveCommands(result) {
  return result.verifiedKiboPassiveGeneration.effectCommands.filter(
    command =>
      Number(command.sourceIdentity?.passiveSkillId) === PASSIVE_SKILL_ID
  );
}

function findActorId(scenario, characterId) {
  return scenario.actors.find(
    actor => Number(actor.characterId) === Number(characterId)
  ).id;
}

function createControlledElementPackage(elementalType) {
  return {
    ...mechanicsPackage,
    controlBindings: mechanicsPackage.controlBindings.map(binding =>
      Number(binding.controlSkillId) === CONTROL_SKILL_ID
        ? {
            ...binding,
            hits: binding.hits.map(hit => ({
              ...hit,
              damage: hit.damage
                ? { ...hit.damage, elementalType }
                : hit.damage,
              sourceEvidenceStatus: 'test-controlled-element-branch',
              scenarioRuntimeStatus: 'test-controlled-element-branch',
            })),
          }
        : binding
    ),
  };
}
