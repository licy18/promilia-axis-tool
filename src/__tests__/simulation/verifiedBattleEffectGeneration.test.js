import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import verifiedCombatMechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';
import { createVerifiedWorkbenchMechanicsProfileSelection } from '../../domain/workbenchMechanicsProfileSelection';
import {
  DEFAULT_WORKBENCH_SELECTION,
  createDefaultWorkbenchActorConfigs,
  createDefaultWorkbenchTeamSlots,
  createWorkbenchActionDraft,
  createWorkbenchProject,
  getWorkbenchGameData,
} from '../../domain/workbenchProjectFactory';
import { frameToMs } from '../../domain/timebase';
import { compileProject } from '../../simulation/compiler/compileProject';
import { simulateScenario } from '../../simulation/engine/simulateScenario';
import { createActionExecutionPlan } from '../../simulation/engine/actionExecutionPlan';
import { createVerifiedBattleEffectGeneration } from '../../simulation/mechanics/verifiedBattleEffectGeneration';
import { createVerifiedCombatRuntime } from '../../simulation/mechanics/verifiedCombatRuntime';
import { createActionRuleDiagnostics } from '../../simulation/runtime/actionRuleDiagnostics';
import { createControlledActorTimeline } from '../../simulation/runtime/controlledActorTimeline';
import { evaluateVerifiedBattleEffectConditions } from '../../simulation/mechanics/verifiedBattleEffectGeneration';
import {
  createEffectRuntimeTimeline,
  resolveActiveEffectsAt,
} from '../../simulation/runtime/effectRuntimeTimeline';

const OWNER_CHARACTER_ID = 101007;
const FIRE_KIBO_ID = 500039;
const FIRE_KIBO_SKILL_ID = 50003901;
const THUNDER_CHARACTER_ID = 109001;
const IRONMANE_KIBO_ID = 500231;
const IRONMANE_KIBO_SKILL_ID = 50023101;

beforeEach(() => {
  installVerifiedCombatMechanicsPackage(verifiedCombatMechanicsPackage);
});

afterEach(() => {
  clearInstalledVerifiedCombatMechanicsPackage();
});

describe('verified Battle effect generation', () => {
  it('evaluates property-change activation conditions by current skill id and tag', () => {
    const action = { controlSkillId: 50004302 };
    const resolution = {
      controlBinding: { logic: { skillTag: '14' } },
    };
    expect(
      evaluateVerifiedBattleEffectConditions({
        conditions: [{ conditionType: 2, skillId: 50004302 }],
        action,
        resolution,
      })
    ).toEqual({ matched: true, reason: null });
    expect(
      evaluateVerifiedBattleEffectConditions({
        conditions: [{ conditionType: 2, skillId: 50004301 }],
        action,
        resolution,
      })
    ).toMatchObject({ matched: false });
    expect(
      evaluateVerifiedBattleEffectConditions({
        conditions: [{ conditionType: 5, skillTag: 14 }],
        action,
        resolution,
      })
    ).toEqual({ matched: true, reason: null });
    expect(
      evaluateVerifiedBattleEffectConditions({
        conditions: [{ conditionType: 5, skillTag: 15 }],
        action,
        resolution,
      })
    ).toMatchObject({ matched: false });
    expect(
      evaluateVerifiedBattleEffectConditions({
        conditions: [{ conditionType: 3, elementTag: 54 }],
        action,
        resolution,
      })
    ).toMatchObject({
      matched: false,
      reason:
        'verified-effect-property-condition-element-tag-target-unresolved',
    });
    const elementTagLayers = new Map([
      ['actor:actor-101010', new Map([[54, 2]])],
    ]);
    const elementIdsHeld = new Map([
      ['actor:actor-101010', new Set([500206002])],
    ]);
    expect(
      evaluateVerifiedBattleEffectConditions({
        conditions: [
          {
            conditionType: 3,
            elementTag: 54,
            subConditionType: 0,
            maxChangeCount: 1,
          },
        ],
        action,
        resolution,
        targetKind: 'actor',
        targetId: 'actor-101010',
        elementTagLayers,
        elementIdsHeld,
      })
    ).toEqual({ matched: true, reason: null });
    expect(
      evaluateVerifiedBattleEffectConditions({
        conditions: [
          {
            conditionType: 3,
            elementTag: 54,
            subConditionType: 0,
            maxChangeCount: 3,
          },
        ],
        action,
        resolution,
        targetKind: 'actor',
        targetId: 'actor-101010',
        elementTagLayers,
        elementIdsHeld,
      })
    ).toMatchObject({
      matched: false,
      reason: 'verified-effect-property-condition-element-tag-not-matched',
    });
    expect(
      evaluateVerifiedBattleEffectConditions({
        conditions: [
          {
            conditionType: 4,
            elementId: 500206002,
            subConditionType: 0,
            maxChangeCount: 1,
          },
        ],
        action,
        resolution,
        targetKind: 'actor',
        targetId: 'actor-101010',
        elementTagLayers,
        elementIdsHeld,
      })
    ).toEqual({ matched: true, reason: null });
    expect(
      evaluateVerifiedBattleEffectConditions({
        conditions: [{ conditionType: 4, elementId: 500206002 }],
        action,
        resolution,
        targetKind: 'actor',
        targetId: 'actor-999999',
        elementTagLayers,
        elementIdsHeld,
      })
    ).toMatchObject({
      matched: false,
      reason: 'verified-effect-property-condition-element-id-not-matched',
    });
    const stackElementLayers = new Map([
      ['actor:actor-101010', new Map([[750, 3]])],
    ]);
    expect(
      evaluateVerifiedBattleEffectConditions({
        conditions: [
          { conditionType: 6, layerElementId: 750, minLayerCount: 1 },
        ],
        action,
        resolution,
        targetKind: 'actor',
        targetId: 'actor-101010',
        stackElementLayers,
      })
    ).toEqual({ matched: true, reason: null });
    expect(
      evaluateVerifiedBattleEffectConditions({
        conditions: [
          { conditionType: 6, layerElementId: 750, minLayerCount: 5 },
        ],
        action,
        resolution,
        targetKind: 'actor',
        targetId: 'actor-101010',
        stackElementLayers,
      })
    ).toMatchObject({
      matched: false,
      reason: 'verified-effect-property-condition-element-layer-not-matched',
    });
    expect(
      evaluateVerifiedBattleEffectConditions({
        conditions: [{ conditionType: 1, entityElementalType: 128 }],
        action,
        resolution,
        targetKind: 'actor',
        targetId: 'actor-109001',
        targetElementId: 7,
      })
    ).toEqual({ matched: true, reason: null });
    expect(
      evaluateVerifiedBattleEffectConditions({
        conditions: [{ conditionType: 1, entityElementalType: 128 }],
        action,
        resolution,
        targetKind: 'actor',
        targetId: 'actor-107002',
        targetElementId: 4,
      })
    ).toMatchObject({
      matched: false,
      reason: 'verified-effect-property-condition-entity-element-not-matched',
    });
    expect(
      evaluateVerifiedBattleEffectConditions({
        conditions: [{ conditionType: 1, entityElementalType: 128 }],
        action,
        resolution,
        targetKind: 'actor',
        targetId: 'actor-unknown',
      })
    ).toMatchObject({
      matched: false,
      reason:
        'verified-effect-property-condition-entity-element-target-unresolved',
    });
    expect(
      evaluateVerifiedBattleEffectConditions({
        conditions: [
          { conditionType: 6, layerElementId: 750, minLayerCount: 1 },
        ],
        action,
        resolution,
        targetKind: 'actor',
        targetId: 'actor-101010',
        stackElementLayers: new Map(),
      })
    ).toMatchObject({
      matched: false,
      reason: 'verified-effect-property-condition-element-layer-not-matched',
    });
    expect(
      evaluateVerifiedBattleEffectConditions({
        conditions: [],
        action,
        resolution,
      })
    ).toEqual({ matched: true, reason: null });
  });

  it('projects all verified Kibo element-limited packs and inherits the filter to their children', () => {
    const expectedMasksByPackElementId = new Map([
      [500025018, 128],
      [500052042, 8],
      [500053037, 8],
      [500186004, 64],
      [500187005, 64],
      [500231005, 128],
      [500322012, 4],
      [500323017, 4],
      [500324006, 4],
      [500469085, 8],
      [500470036, 8],
    ]);
    const packs =
      verifiedCombatMechanicsPackage.battleEffectCatalog.nodes.filter(
        node =>
          node.kind === 'pack' &&
          expectedMasksByPackElementId.has(Number(node.elementId))
      );
    expect(packs).toHaveLength(expectedMasksByPackElementId.size);
    for (const pack of packs) {
      expect(pack.activationConditions).toContainEqual(
        expect.objectContaining({
          conditionType: 1,
          entityElementalType: expectedMasksByPackElementId.get(
            Number(pack.elementId)
          ),
          sourceConditionType: 10,
          sourceConditionTypeName: 'CheckSelfElementalType',
        })
      );
      const childEffects = verifiedCombatMechanicsPackage.controlBindings
        .flatMap(binding => binding.effects ?? [])
        .filter(effect =>
          (effect.relationPath ?? []).some(
            edge => edge.from === `element:${pack.pathId}`
          )
        );
      expect(childEffects.length).toBeGreaterThan(0);
      expect(childEffects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            activationConditions: expect.arrayContaining([
              expect.objectContaining({
                conditionType: 1,
                entityElementalType: expectedMasksByPackElementId.get(
                  Number(pack.elementId)
                ),
              }),
            ]),
          }),
        ])
      );
    }
  });

  it('applies Ironmane tuning strength only to Thunder actors', () => {
    const scenario = createIronmaneScenario();
    const actionRuleDiagnostics = createActionRuleDiagnostics({ scenario });
    const actionExecutionPlan = createActionExecutionPlan({
      scenario,
      actionRuleDiagnostics,
    });
    const generation = createVerifiedBattleEffectGeneration({
      scenario,
      actionExecutionPlan,
      mechanicsPackage: verifiedCombatMechanicsPackage,
    });
    const tuningStrengthCommands = generation.effectCommands.filter(command =>
      command.modifiers?.some(
        modifier =>
          modifier.kind === 'battle-property' && modifier.attributeId === 229
      )
    );

    expect(tuningStrengthCommands).toHaveLength(1);
    expect(tuningStrengthCommands[0]).toMatchObject({
      sourceActionId: 'ironmane-signature',
      targetKind: 'actor',
      targetId: `actor-${THUNDER_CHARACTER_ID}`,
      timeMs: 500,
      durationMs: 16000,
      modifiers: [
        expect.objectContaining({
          attributeId: 229,
          bucket: 'dynamicExtra',
        }),
      ],
    });
    expect(Number(tuningStrengthCommands[0].modifiers[0].valueRaw)).toBeCloseTo(
      72.06,
      3
    );
    expect(generation.knownGaps).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'ironmane-signature',
          reason: expect.stringMatching(/pack-element-filter|element-limited/),
        }),
      ])
    );
  });

  it.each([
    {
      name: '雾粘蛙',
      kiboId: 500095,
      skillId: 50009501,
      intervalMs: 200,
      occurrenceCount: 5,
    },
    {
      name: '雾球蛙',
      kiboId: 500096,
      skillId: 50009601,
      intervalMs: 270,
      occurrenceCount: 11,
    },
    {
      name: '嘻哈蝠',
      kiboId: 500180,
      skillId: 50018001,
      intervalMs: 150,
      occurrenceCount: 8,
    },
  ])(
    'refreshes $name resistance reduction at every verified interval',
    ({ kiboId, skillId, intervalMs, occurrenceCount }) => {
      const scenario = createPeriodicPropertyKiboScenario({
        kiboId,
        skillId,
      });
      const actionRuleDiagnostics = createActionRuleDiagnostics({ scenario });
      const actionExecutionPlan = createActionExecutionPlan({
        scenario,
        actionRuleDiagnostics,
      });
      const generation = createVerifiedBattleEffectGeneration({
        scenario,
        actionExecutionPlan,
        mechanicsPackage: verifiedCombatMechanicsPackage,
      });
      const commands = generation.effectCommands.filter(command =>
        command.modifiers?.some(
          modifier =>
            modifier.kind === 'battle-property' && modifier.attributeId === 70
        )
      );

      expect(commands).toHaveLength(occurrenceCount);
      expect(new Set(commands.map(command => command.id)).size).toBe(
        occurrenceCount
      );
      expect(commands.map(command => command.triggerOccurrenceIndex)).toEqual(
        Array.from({ length: occurrenceCount }, (_, index) => index)
      );
      expect(commands).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            targetKind: 'enemy',
            triggerIntervalMs: intervalMs,
            durationMs: 16000,
          }),
        ])
      );

      const timeline = createEffectRuntimeTimeline({
        scenario,
        actionExecutionPlan,
        generatedCommands: commands,
      });
      const firstTimeMs = commands[0].timeMs;
      const lastTimeMs = commands.at(-1).timeMs;
      expect(
        resolveActiveEffectsAt(timeline, firstTimeMs + 16001, {
          targetKind: 'enemy',
          targetId: scenario.enemy.id,
          calculatorOnly: true,
        })
      ).toHaveLength(1);
      expect(
        resolveActiveEffectsAt(timeline, lastTimeMs + 16001, {
          targetKind: 'enemy',
          targetId: scenario.enemy.id,
          calculatorOnly: true,
        })
      ).toHaveLength(0);
    }
  );

  it('generates a real kibo property lifecycle and changes later verified hits', () => {
    const scenario = createFireKiboScenario();
    const actionRuleDiagnostics = createActionRuleDiagnostics({ scenario });
    const actionExecutionPlan = createActionExecutionPlan({
      scenario,
      actionRuleDiagnostics,
    });
    const controlledActorTimeline = createControlledActorTimeline({
      scenario,
      actionExecutionPlan,
    });
    const generation = createVerifiedBattleEffectGeneration({
      scenario,
      actionExecutionPlan,
      mechanicsPackage: verifiedCombatMechanicsPackage,
    });
    const timeline = createEffectRuntimeTimeline({
      scenario,
      actionExecutionPlan,
      generatedCommands: generation.effectCommands,
    });
    const withEffect = createVerifiedCombatRuntime({
      scenario,
      actionExecutionPlan,
      controlledActorTimeline,
      effectGeneration: generation,
      effectTimeline: timeline,
    });
    const withoutEffect = createVerifiedCombatRuntime({
      scenario,
      actionExecutionPlan,
      controlledActorTimeline,
      effectGeneration: generation,
      effectTimeline: createEffectRuntimeTimeline({
        scenario,
        actionExecutionPlan,
      }),
    });
    const integrated = simulateScenario(scenario);

    expect(generation.effectCommands).toHaveLength(4);
    expect(generation.effectCommands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceActionId: 'fire-kibo-signature',
          targetKind: 'actor',
          targetId: 'actor-101007',
          timeMs: 0,
          durationMs: 16000,
          appliedToCalculators: true,
          modifiers: [
            expect.objectContaining({
              kind: 'battle-property',
              attributeId: 52,
              bucket: 'dynamicExtra',
              valueRaw: 216,
              formulaResult: expect.objectContaining({
                family: 'literal-a-with-common-ratio',
                value: 216,
              }),
            }),
          ],
        }),
        expect.objectContaining({
          sourceActionId: 'fire-kibo-signature',
          targetKind: 'kibo',
          targetId: 'actor-101007',
          timeMs: 0,
          durationMs: 16000,
          appliedToCalculators: true,
          modifiers: [
            expect.objectContaining({
              kind: 'battle-property',
              attributeId: 52,
              bucket: 'dynamicExtra',
              valueRaw: 216,
            }),
          ],
        }),
      ])
    );
    expect(
      generation.effectCommands
        .filter(command => command.targetKind === 'actor')
        .map(command => command.targetId)
        .sort()
    ).toEqual(['actor-101003', 'actor-101007', 'actor-109001']);
    expect(
      resolveActiveEffectsAt(timeline, 1000, {
        targetKind: 'kibo',
        targetId: 'actor-101007',
        calculatorOnly: true,
      })
    ).toHaveLength(1);
    expect(
      resolveActiveEffectsAt(timeline, 16001, {
        targetKind: 'kibo',
        targetId: 'actor-101007',
        calculatorOnly: true,
      })
    ).toHaveLength(0);

    const appliedDamage = sumDamage(withEffect, 'fire-kibo-signature');
    const baselineDamage = sumDamage(withoutEffect, 'fire-kibo-signature');
    expect(appliedDamage).toBeGreaterThan(baselineDamage);
    expect(integrated.verifiedBattleEffectGeneration.summary).toMatchObject({
      effectCommandCount: 4,
      generatedCount: 4,
    });
    expect(integrated.verifiedKiboPassiveGeneration.effectCommands).toEqual([
      expect.objectContaining({
        sourceActionId: 'fire-kibo-signature',
        sourceKiboId: FIRE_KIBO_ID,
        effectId: 'kibo-passive:520040:520040002',
        targetKind: 'enemy',
        durationMs: null,
        stackMode: 'stack',
        maxStacks: 6,
        sourceIdentity: expect.objectContaining({
          passiveSkillId: 520040,
          triggerElementId: 520040001,
          effectElementId: 520040002,
        }),
        modifiers: [
          expect.objectContaining({
            attributeId: 62,
            bucket: 'dynamicExtra',
            valueRaw: -100,
          }),
        ],
      }),
    ]);
    expect(integrated.effectTimeline.summary).toMatchObject({
      calculatorAppliedEffectCount: 10,
    });
    expect(
      sumDamage(integrated.verifiedCombatRuntime, 'fire-kibo-signature')
    ).toBeGreaterThan(appliedDamage);
    expect(
      withEffect.damageEvents.flatMap(
        event => event.payload.dynamicPropertyTrace.source
      )
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attributeId: 52,
          dynamicExtraRaw: 216,
        }),
      ])
    );
  });

  it('does not generate effects for an execution-blocked action', () => {
    const scenario = createFireKiboScenario();
    const generation = createVerifiedBattleEffectGeneration({
      scenario,
      mechanicsPackage: verifiedCombatMechanicsPackage,
      actionExecutionPlan: {
        actions: [
          {
            actionId: 'fire-kibo-signature',
            execute: false,
          },
        ],
      },
    });

    expect(generation.effectCommands).toEqual([]);
    expect(generation.directSpEvents).toEqual([]);
    expect(generation.actionResolutionById.size).toBe(0);
  });

  it('does not duplicate raw direct SP owned by a verified runtime binding', () => {
    const action = {
      id: 'runtime-managed-direct-sp',
      type: 'skill',
      actorId: 'actor-fixture',
      actor: { id: 'actor-fixture', stats: {} },
      startMs: 0,
      durationMs: frameToMs(60),
    };
    const effect = {
      semanticIdentity: 'semantic-effect:runtime-managed-direct-sp',
      elementId: 9010,
      kind: 'sp',
      role: 'gameplay-effect',
      classification: 'applied',
      trigger: { startFrame: 0 },
      target: { kind: 'source-owner' },
      directSp: {
        recoverType: 0,
        shareType: 0,
        stopSharing: true,
      },
      formula: {
        commonFunctionId: 1,
        baseFunctionId: 5,
        paramsByLevel: { 1: [2, 0, 0, 0, 0, 0, 10000] },
      },
      sourceIdentities: ['fixture:runtime-managed-direct-sp'],
    };
    const mechanicsPackage = createFixtureMechanicsPackage();
    const resolution = createFixtureResolution({
      semanticEffects: [effect],
    });
    const generatedEvent = {
      eventIdentity: 'runtime-binding:periodic-direct-sp',
      actionId: action.id,
      value: 2,
    };
    const generate = runtimeManagedDirectSpEffects =>
      createVerifiedBattleEffectGeneration({
        scenario: { actions: [action], actors: [action.actor] },
        mechanicsPackage,
        actionResolutionById: new Map([[action.id, resolution]]),
        generatedDirectSpEvents: [generatedEvent],
        runtimeManagedDirectSpEffects,
      });

    expect(generate([]).directSpEvents).toHaveLength(2);
    expect(
      generate([
        {
          actionId: action.id,
          elementId: effect.elementId,
          bindingIdentity: 'fixture-periodic-binding',
        },
      ]).directSpEvents
    ).toEqual([generatedEvent]);
  });

  it('keeps same-frame property effects distinct by element identity', () => {
    const action = {
      id: 'same-frame-tuning-effects',
      type: 'skill',
      actorId: 'actor-101003',
      actor: {
        id: 'actor-101003',
        stats: {
          tuningStrength: 100,
        },
      },
      startMs: 0,
      durationMs: frameToMs(180),
    };
    const generation = createVerifiedBattleEffectGeneration({
      scenario: {
        actions: [action],
        actors: [
          action.actor,
          {
            id: 'actor-101007',
          },
        ],
        combatScenario: {},
      },
      mechanicsPackage: createFixtureMechanicsPackage(),
      controlledActorTimeline: {
        initialActor: {
          actorId: 'actor-101007',
          characterId: 101007,
          actorName: 'fixture-controlled-actor',
        },
        transitions: [],
      },
      actionResolutionById: new Map([
        [
          action.id,
          {
            ready: true,
            packageId: 'fixture-package',
            packageHash: 'fixture-hash',
            actionBinding: {
              identity: 'fixture-action-binding',
              controlVariantSkillLevel: 1,
            },
            controlBinding: {
              frameRate: 60,
            },
            semanticEffects: [
              createPropertyEffect({
                semanticIdentity: 'team-tuning',
                elementId: 101003205,
                pathId: '-4841411980842434486',
                targetKind: 'team-actors',
                durationMs: 24000,
                stackDelta: 2,
                maxStacks: 2,
                a: 18,
              }),
              createPropertyEffect({
                semanticIdentity: 'controlled-tuning',
                elementId: 101003207,
                pathId: '-5652413049857383353',
                targetKind: 'controlling-actor',
                durationMs: 15000,
                a: 1000,
                baseFunctionId: 2008,
                inheritance: {
                  inheritOnControlledActorSwitch: true,
                  inheritType: 'source',
                  isTeamElement: true,
                  containerElementId: 101003206,
                  containerPathId: '-87352517346442030',
                  sourceIdentity: 'fixture:container:101003206',
                },
              }),
            ],
          },
        ],
      ]),
    });

    expect(
      generation.effectCommands.map(command => [
        command.effectId,
        command.sourceIdentity.elementId,
        command.targetId,
        command.durationMs,
      ])
    ).toEqual([
      ['battle-element:-4841411980842434486', 101003205, 'actor-101003', 24000],
      ['battle-element:-4841411980842434486', 101003205, 'actor-101007', 24000],
      ['battle-element:-5652413049857383353', 101003207, 'actor-101007', 15000],
    ]);
    expect(
      generation.effectCommands.filter(
        command => command.targetId === 'actor-101007'
      )
    ).toHaveLength(2);
    expect(
      generation.effectCommands.find(
        command => command.sourceIdentity.elementId === 101003207
      )
    ).toMatchObject({
      semanticTargetKind: 'controlling-actor',
      inheritOnControlledActorSwitch: true,
      inheritType: 'source',
      inheritanceContainerElementId: 101003206,
      inheritanceContainerPathId: '-87352517346442030',
      inheritanceSourceIdentity: 'fixture:container:101003206',
      formulaSourceActorId: 'actor-101003',
    });
  });

  it('drops applied and unresolved effect rows at an immediate interrupt boundary', () => {
    const action = {
      id: 'contextually-interrupted-effect-source',
      type: 'skill',
      startMs: 0,
      durationMs: frameToMs(120),
      contextualEffectiveEndMs: frameToMs(119),
    };
    const generation = createVerifiedBattleEffectGeneration({
      scenario: {
        actions: [action],
        combatScenario: {},
      },
      actionResolutionById: new Map([
        [
          action.id,
          {
            ready: true,
            packageId: 'fixture-package',
            packageHash: 'fixture-hash',
            controlBinding: { frameRate: 60 },
            semanticEffects: [
              {
                effectIdentity: 'effect-before-interrupt',
                role: 'gameplay-effect',
                classification: 'unresolved',
                trigger: { startFrame: 118 },
              },
              {
                effectIdentity: 'effect-at-interrupt',
                role: 'gameplay-effect',
                classification: 'unresolved',
                trigger: { startFrame: 119 },
              },
              {
                effectIdentity: 'effect-after-interrupt',
                role: 'gameplay-effect',
                classification: 'unresolved',
                trigger: { startFrame: 120 },
              },
            ],
          },
        ],
      ]),
      mechanicsPackage: createFixtureMechanicsPackage(),
    });

    expect(generation.unresolved.map(effect => effect.effectIdentity)).toEqual([
      'effect-before-interrupt',
    ]);
  });

  it('uses scenario hit defaults and explicit overrides for every hit-gated effect', () => {
    const conditionalHitIdentity =
      'conditional-damage:fixture-conditional-group:1';
    const landedHitIdentity = 'fixture-landed-hit';
    const baseAction = {
      id: 'hit-gated-effects',
      type: 'skill',
      actorId: 'actor-fixture',
      actor: { id: 'actor-fixture', stats: { tuningStrength: 100 } },
      startMs: 0,
      durationMs: frameToMs(180),
    };
    const effects = [
      {
        ...createPropertyEffect({
          semanticIdentity: 'fixture-conditional-wrapper',
          elementId: 700001,
          pathId: 'fixture-conditional-wrapper-path',
          targetKind: 'source-owner',
          durationMs: 12000,
          a: 100,
        }),
        hitGate: {
          kind: 'conditional-damage-group-hit',
          groupIdentity: 'fixture-conditional-group',
          hitIndex: 1,
        },
      },
      {
        ...createPropertyEffect({
          semanticIdentity: 'fixture-landed-wrapper',
          elementId: 700002,
          pathId: 'fixture-landed-wrapper-path',
          targetKind: 'source-owner',
          durationMs: 12000,
          a: 100,
        }),
        hitGate: {
          kind: 'landed-action-hit',
          elementId: 700099,
          triggerFrame: 148,
          maximumMatches: 1,
        },
      },
    ];
    const mechanicsPackage = createFixtureMechanicsPackage();
    const generate = ({ defaultWillHit, hitOverrides = undefined }) => {
      const action = { ...baseAction, hitOverrides };
      return createVerifiedBattleEffectGeneration({
        scenario: {
          actions: [action],
          actors: [action.actor],
          combatScenario: { projectile: { defaultWillHit } },
        },
        mechanicsPackage,
        actionResolutionById: new Map([
          [
            action.id,
            createFixtureResolution({
              semanticEffects: effects,
              hits: [
                {
                  hitIdentity: landedHitIdentity,
                  elementId: 700099,
                  trigger: { startFrame: 148 },
                },
              ],
            }),
          ],
        ]),
      });
    };

    expect(generate({ defaultWillHit: false }).effectCommands).toEqual([]);
    expect(
      generate({
        defaultWillHit: false,
        hitOverrides: {
          [conditionalHitIdentity]: { willHit: true },
          [landedHitIdentity]: { willHit: true },
        },
      }).effectCommands.map(command => command.sourceIdentity.effectIdentity)
    ).toEqual(['fixture-conditional-wrapper', 'fixture-landed-wrapper']);
    expect(
      generate({
        defaultWillHit: true,
        hitOverrides: {
          [conditionalHitIdentity]: { willHit: false },
          [landedHitIdentity]: { willHit: false },
        },
      }).effectCommands
    ).toEqual([]);
  });

  it('binds watcher suppression to the explicitly supplied mechanics package', () => {
    const action = {
      id: 'package-bound-watchers',
      type: 'skill',
      actorId: 'actor-fixture',
      actor: { id: 'actor-fixture', stats: { tuningStrength: 100 } },
      startMs: 0,
      durationMs: frameToMs(180),
    };
    const watcherEffects = ['fixture-watcher-a', 'fixture-watcher-b'].map(
      (semanticIdentity, index) =>
        createPropertyEffect({
          semanticIdentity,
          elementId: 710000 + index,
          pathId: `fixture-watcher-path-${index}`,
          targetKind: 'source-owner',
          durationMs: 8000,
          a: 100,
        })
    );
    const packageA = createFixtureMechanicsPackage({
      packageId: 'fixture-package-a',
      packageHash: 'fixture-hash-a',
      suppressedEffectIdentities: ['fixture-watcher-a'],
    });
    const packageB = createFixtureMechanicsPackage({
      packageId: 'fixture-package-b',
      packageHash: 'fixture-hash-b',
      suppressedEffectIdentities: ['fixture-watcher-b'],
    });
    const generate = mechanicsPackage =>
      createVerifiedBattleEffectGeneration({
        scenario: { actions: [action], actors: [action.actor] },
        mechanicsPackage,
        actionResolutionById: new Map([
          [
            action.id,
            createFixtureResolution({
              packageId: mechanicsPackage.packageId,
              packageHash: mechanicsPackage.packageHash,
              semanticEffects: watcherEffects,
            }),
          ],
        ]),
      });

    expect(
      generate(packageA).effectCommands.map(
        command => command.sourceIdentity.effectIdentity
      )
    ).toEqual(['fixture-watcher-b']);
    expect(
      generate(packageB).effectCommands.map(
        command => command.sourceIdentity.effectIdentity
      )
    ).toEqual(['fixture-watcher-a']);
    expect(() =>
      createVerifiedBattleEffectGeneration({
        scenario: { actions: [action], actors: [action.actor] },
        mechanicsPackage: packageB,
        actionResolutionById: new Map([
          [
            action.id,
            createFixtureResolution({
              packageId: packageA.packageId,
              packageHash: packageA.packageHash,
              semanticEffects: watcherEffects,
            }),
          ],
        ]),
      })
    ).toThrow(
      'verified-battle-effect-generation-mechanics-package-binding-mismatch'
    );
  });
});

function createFireKiboScenario() {
  const teamSlots = createDefaultWorkbenchTeamSlots();
  const actorConfigs = createDefaultWorkbenchActorConfigs(
    DEFAULT_WORKBENCH_SELECTION
  ).map(config =>
    Number(config.characterId) === OWNER_CHARACTER_ID
      ? {
          ...config,
          loadout: {
            ...config.loadout,
            kiboId: FIRE_KIBO_ID,
          },
        }
      : config
  );
  const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
    durationMs: 18000,
    teamSlots,
    actorConfigs,
    actions: [
      createWorkbenchActionDraft({
        id: 'fire-kibo-signature',
        type: 'kiboEvent',
        actorCharacterId: OWNER_CHARACTER_ID,
        skillId: FIRE_KIBO_SKILL_ID,
        kiboId: FIRE_KIBO_ID,
        actionVariantIndex: 0,
        startMs: 0,
        durationMs: 3000,
        eventType: 'signature',
      }),
    ],
    initialRuntimeState: {
      controlledActor: {
        actorId: `actor-${OWNER_CHARACTER_ID}`,
        characterId: OWNER_CHARACTER_ID,
      },
      kiboEnergyBySlot: [
        {
          slotId: 'team-slot-3',
          kiboId: FIRE_KIBO_ID,
          currentValue: 100,
          maxValue: 100,
        },
      ],
    },
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  return compileProject(project, getWorkbenchGameData());
}

function createIronmaneScenario() {
  const teamSlots = createDefaultWorkbenchTeamSlots();
  const actorConfigs = createDefaultWorkbenchActorConfigs(
    DEFAULT_WORKBENCH_SELECTION
  ).map(config =>
    Number(config.characterId) === THUNDER_CHARACTER_ID
      ? {
          ...config,
          loadout: {
            ...config.loadout,
            kiboId: IRONMANE_KIBO_ID,
          },
        }
      : config
  );
  const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
    durationMs: 5000,
    teamSlots,
    actorConfigs,
    actions: [
      createWorkbenchActionDraft({
        id: 'ironmane-signature',
        type: 'kiboEvent',
        actorCharacterId: THUNDER_CHARACTER_ID,
        skillId: IRONMANE_KIBO_SKILL_ID,
        kiboId: IRONMANE_KIBO_ID,
        actionVariantIndex: 0,
        startMs: 0,
        durationMs: 3250,
        eventType: 'signature',
      }),
    ],
    initialRuntimeState: {
      controlledActor: {
        actorId: `actor-${THUNDER_CHARACTER_ID}`,
        characterId: THUNDER_CHARACTER_ID,
      },
      kiboEnergyBySlot: [
        {
          slotId: 'team-slot-1',
          kiboId: IRONMANE_KIBO_ID,
          currentValue: 100,
          maxValue: 100,
        },
      ],
    },
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  return compileProject(project, getWorkbenchGameData());
}

function createPeriodicPropertyKiboScenario({ kiboId, skillId }) {
  const teamSlots = createDefaultWorkbenchTeamSlots();
  const actorConfigs = createDefaultWorkbenchActorConfigs(
    DEFAULT_WORKBENCH_SELECTION
  ).map(config =>
    Number(config.characterId) === THUNDER_CHARACTER_ID
      ? {
          ...config,
          loadout: {
            ...config.loadout,
            kiboId,
          },
        }
      : config
  );
  const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
    durationMs: 22000,
    teamSlots,
    actorConfigs,
    actions: [
      createWorkbenchActionDraft({
        id: `periodic-property-${kiboId}`,
        type: 'kiboEvent',
        actorCharacterId: THUNDER_CHARACTER_ID,
        skillId,
        kiboId,
        actionVariantIndex: 0,
        startMs: 0,
        durationMs: 5000,
        eventType: 'signature',
      }),
    ],
    initialRuntimeState: {
      controlledActor: {
        actorId: `actor-${THUNDER_CHARACTER_ID}`,
        characterId: THUNDER_CHARACTER_ID,
      },
      kiboEnergyBySlot: [
        {
          slotId: 'team-slot-1',
          kiboId,
          currentValue: 100,
          maxValue: 100,
        },
      ],
    },
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  return compileProject(project, getWorkbenchGameData());
}

function createPropertyEffect({
  semanticIdentity,
  elementId,
  pathId,
  targetKind,
  durationMs,
  stackDelta = 1,
  maxStacks = 1,
  a,
  baseFunctionId = 5,
  inheritance = null,
}) {
  return {
    semanticIdentity,
    elementId,
    pathId,
    role: 'gameplay-effect',
    classification: 'applied',
    trigger: {
      startFrame: 148,
    },
    target: {
      kind: targetKind,
    },
    propertyChange: {
      attributeId: 229,
      bucket: 'dynamicExtra',
    },
    lifecycle: {
      durationMs,
      stackMode: 'stack',
      stackDelta,
      maxStacks,
      inheritance,
    },
    formula: {
      commonFunctionId: 1,
      baseFunctionId,
      paramsByLevel: {
        1: [a, 0, 0, 0, 0, 0, 10000],
      },
    },
    sourceIdentities: [`fixture:${semanticIdentity}`],
  };
}

function createFixtureMechanicsPackage({
  packageId = 'fixture-package',
  packageHash = 'fixture-hash',
  suppressedEffectIdentities = [],
} = {}) {
  return {
    packageId,
    packageHash,
    actionVariantGraph: {
      breakTriggerWatchers: suppressedEffectIdentities.length
        ? [{ suppressedEffectIdentities }]
        : [],
    },
  };
}

function createFixtureResolution({
  packageId = 'fixture-package',
  packageHash = 'fixture-hash',
  semanticEffects = [],
  hits = [],
} = {}) {
  return {
    ready: true,
    packageId,
    packageHash,
    actionBinding: {
      identity: 'fixture-action-binding',
      controlVariantSkillLevel: 1,
    },
    controlBinding: { frameRate: 60 },
    hits,
    allHits: hits,
    semanticEffects,
    effects: [],
  };
}

function sumDamage(runtime, actionId) {
  return runtime.damageEvents
    .filter(event => event.actionId === actionId)
    .reduce((sum, event) => sum + Number(event.payload.rawDamage ?? 0), 0);
}
