import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import verifiedCombatMechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
  resolveVerifiedCombatActionMechanics,
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
import { compileProject } from '../../simulation/compiler/compileProject';
import { createActionExecutionPlan } from '../../simulation/engine/actionExecutionPlan';
import { simulateScenario } from '../../simulation/engine/simulateScenario';
import { createVerifiedCombatRuntime } from '../../simulation/mechanics/verifiedCombatRuntime';
import { createVerifiedKiboPassiveGeneration } from '../../simulation/mechanics/verifiedKiboPassiveGeneration';
import { createActionRuleDiagnostics } from '../../simulation/runtime/actionRuleDiagnostics';
import { createControlledActorTimeline } from '../../simulation/runtime/controlledActorTimeline';
import {
  createEffectRuntimeTimeline,
  resolveActiveEffectsAt,
} from '../../simulation/runtime/effectRuntimeTimeline';

const OWNER_CHARACTER_ID = 101007;
const KIBO_ID = 500001;
const SIGNATURE_SKILL_ID = 50000102;
const MUYIN_NORMAL_MAPPING = verifiedCombatMechanicsPackage.actionMappings.find(
  mapping =>
    Number(mapping.ownerId) === 109001 && mapping.actionKind === 'normal-attack'
);
const MUYIN_FIRST_ATTACK_INPUT = MUYIN_NORMAL_MAPPING.attackInputSegments[0];

beforeEach(() => {
  installVerifiedCombatMechanicsPackage(verifiedCombatMechanicsPackage);
});

afterEach(() => {
  clearInstalledVerifiedCombatMechanicsPackage();
});

describe('verified kibo passive generation', () => {
  it('applies damage-triggered defense stacks after the triggering hit and caps at five', () => {
    const scenario = createSwiftWolfScenario();
    const action = scenario.actions[0];
    const resolution = resolveVerifiedCombatActionMechanics(action, {
      combatScenario: scenario.combatScenario,
    });
    const actionResolutionById = new Map([[action.id, resolution]]);
    const actionRuleDiagnostics = createActionRuleDiagnostics({ scenario });
    const actionExecutionPlan = createActionExecutionPlan({
      scenario,
      actionRuleDiagnostics,
    });
    const controlledActorTimeline = createControlledActorTimeline({
      scenario,
      actionExecutionPlan,
    });
    const generation = createVerifiedKiboPassiveGeneration({
      scenario,
      actionExecutionPlan,
      actionResolutionById,
    });
    const effectTimeline = createEffectRuntimeTimeline({
      scenario,
      actionExecutionPlan,
      generatedCommands: generation.effectCommands,
    });
    const withPassive = createVerifiedCombatRuntime({
      scenario,
      actionExecutionPlan,
      controlledActorTimeline,
      effectTimeline,
    });
    const withoutPassive = createVerifiedCombatRuntime({
      scenario,
      actionExecutionPlan,
      controlledActorTimeline,
      effectTimeline: createEffectRuntimeTimeline({
        scenario,
        actionExecutionPlan,
      }),
    });
    const integrated = simulateScenario(scenario);

    expect(resolution.ready).toBe(true);
    expect(generation.unresolved).toEqual([]);
    expect(generation.effectCommands).toHaveLength(
      resolution.hits.filter(hit => hit.damage).length
    );
    expect(generation.effectCommands[0]).toMatchObject({
      sourceActionId: 'swift-wolf-signature',
      sourceKiboId: KIBO_ID,
      effectId: 'kibo-passive:520084:520084002',
      targetKind: 'enemy',
      targetId: String(scenario.enemy.id),
      durationMs: null,
      stackMode: 'stack',
      stackDelta: 1,
      maxStacks: 5,
      sourceStatus: 'verified-passive-effect-generated',
      generatedVerified: true,
      appliedToCalculators: true,
      modifiers: [
        expect.objectContaining({
          attributeId: 3,
          bucket: 'dynamicPercent',
          valueRaw: -500,
        }),
        expect.objectContaining({
          attributeId: 4,
          bucket: 'dynamicPercent',
          valueRaw: -500,
        }),
      ],
    });
    const firstHitTime = Math.min(
      ...withPassive.damageEvents
        .filter(event => event.actionId === action.id)
        .map(event => event.timeMs)
    );
    const firstHitEvents = withPassive.damageEvents.filter(
      event => event.actionId === action.id && event.timeMs === firstHitTime
    );
    expect(
      firstHitEvents.flatMap(event => event.payload.dynamicPropertyTrace.target)
    ).toEqual([]);
    const laterDefenseTraces = withPassive.damageEvents
      .filter(
        event => event.actionId === action.id && event.timeMs > firstHitTime
      )
      .flatMap(event => event.payload.dynamicPropertyTrace.target)
      .filter(trace => [3, 4].includes(trace.attributeId));
    expect(
      Math.min(...laterDefenseTraces.map(trace => trace.dynamicPercentRaw))
    ).toBe(-2500);
    expect(sumDamage(withPassive, action.id)).toBeGreaterThan(
      sumDamage(withoutPassive, action.id)
    );
    expect(
      resolveActiveEffectsAt(effectTimeline, scenario.time.durationMs, {
        targetKind: 'enemy',
        targetId: String(scenario.enemy.id),
        calculatorOnly: true,
      })
    ).toEqual([
      expect.objectContaining({
        effectId: 'kibo-passive:520084:520084002',
        stacks: 5,
        expiresAtMs: null,
      }),
    ]);
    expect(integrated.verifiedKiboPassiveGeneration.summary).toMatchObject({
      evidenceClosedDefinitionCount: 38,
      scenarioAssumedDefinitionCount: 0,
      unresolvedDefinitionCount: 6,
      effectCommandCount: generation.effectCommands.length,
    });
    expect(
      integrated.effectTimeline.activeEffects.find(
        effect => effect.effectId === 'kibo-passive:520084:520084002'
      )
    ).toMatchObject({
      stacks: 5,
      targetKind: 'enemy',
      sourceStatus: 'verified-passive-effect-generated',
      appliedToCalculators: true,
    });
  });

  it('does not trigger for an execution block or a per-hit miss override', () => {
    const scenario = createSwiftWolfScenario();
    const action = scenario.actions[0];
    const baselineResolution = resolveVerifiedCombatActionMechanics(action, {
      combatScenario: scenario.combatScenario,
    });
    const disabledIdentity = baselineResolution.hits[0].hitIdentity;
    const missedScenario = {
      ...scenario,
      actions: [
        {
          ...action,
          hitOverrides: {
            [disabledIdentity]: {
              willHit: false,
            },
          },
        },
      ],
    };
    const missedAction = missedScenario.actions[0];
    const missedResolution = resolveVerifiedCombatActionMechanics(
      missedAction,
      {
        combatScenario: missedScenario.combatScenario,
      }
    );
    const missedGeneration = createVerifiedKiboPassiveGeneration({
      scenario: missedScenario,
      actionResolutionById: new Map([[missedAction.id, missedResolution]]),
    });
    const blockedGeneration = createVerifiedKiboPassiveGeneration({
      scenario,
      actionExecutionPlan: {
        actions: [{ actionId: action.id, execute: false }],
      },
      actionResolutionById: new Map([[action.id, baselineResolution]]),
    });

    expect(missedResolution.hits).toHaveLength(
      baselineResolution.hits.length - 1
    );
    expect(missedGeneration.effectCommands).toHaveLength(
      baselineResolution.hits.length - 1
    );
    expect(
      missedGeneration.effectCommands.some(
        command => command.sourceIdentity.hitIdentity === disabledIdentity
      )
    ).toBe(false);
    expect(blockedGeneration.effectCommands).toEqual([]);
    expect(blockedGeneration.unresolved).toEqual([]);
  });

  it('applies a source-verified timed enemy debuff only after the hit and expires it', () => {
    const action = {
      id: 'ice-spirit-hit',
      type: 'kiboEvent',
      actorId: 'actor-101007',
      name: '寒气',
      startMs: 0,
      durationMs: 1000,
    };
    const scenario = {
      actions: [action],
      enemy: { id: 'enemy-300032' },
      time: { durationMs: 12000, fps: 60 },
    };
    const resolution = {
      ready: true,
      actionBinding: {
        identity: 'kibo|500114|50011402|0|50011402',
        ownerKind: 'kibo',
        ownerId: 500114,
      },
      controlBinding: { frameRate: 60 },
      hits: [
        {
          hitIdentity: 'fixture-ice-spirit-hit',
          hitIndex: 1,
          elementId: 5001140201,
          trigger: { startFrame: 6 },
          damage: { elementalType: 5 },
        },
      ],
    };
    const generation = createVerifiedKiboPassiveGeneration({
      scenario,
      actionResolutionById: new Map([[action.id, resolution]]),
    });
    const timeline = createEffectRuntimeTimeline({
      scenario,
      generatedCommands: generation.effectCommands,
    });
    const command = generation.effectCommands[0];

    expect(generation.unresolved).toEqual([]);
    expect(command).toMatchObject({
      effectId: 'kibo-passive:520050:520050002',
      sourceKiboId: 500114,
      targetKind: 'enemy',
      targetId: 'enemy-300032',
      timeMs: 100.001,
      durationMs: 10000,
      stackMode: 'refresh',
      maxStacks: 1,
      modifiers: [
        expect.objectContaining({
          attributeId: 45,
          bucket: 'dynamicExtra',
          valueRaw: -1000,
        }),
        expect.objectContaining({
          attributeId: 66,
          bucket: 'dynamicExtra',
          valueRaw: -800,
        }),
      ],
    });
    expect(
      resolveActiveEffectsAt(timeline, 100, {
        targetKind: 'enemy',
        targetId: 'enemy-300032',
        calculatorOnly: true,
      })
    ).toEqual([]);
    expect(
      resolveActiveEffectsAt(timeline, 10000, {
        targetKind: 'enemy',
        targetId: 'enemy-300032',
        calculatorOnly: true,
      })
    ).toEqual([
      expect.objectContaining({
        effectId: 'kibo-passive:520050:520050002',
        stacks: 1,
        expiresAtMs: 10100.001,
      }),
    ]);
    expect(
      resolveActiveEffectsAt(timeline, 10100.001, {
        targetKind: 'enemy',
        targetId: 'enemy-300032',
        calculatorOnly: true,
      })
    ).toEqual([]);
  });

  it('enforces a definition-driven internal cooldown across hits and actions', () => {
    const firstAction = {
      id: 'icd-action-1',
      type: 'kiboEvent',
      actorId: 'actor-101007',
      startMs: 0,
      durationMs: 1000,
    };
    const secondAction = {
      id: 'icd-action-2',
      type: 'kiboEvent',
      actorId: 'actor-101007',
      startMs: 15000,
      durationMs: 1000,
    };
    const scenario = {
      actions: [secondAction, firstAction],
      enemy: { id: 'enemy-300032' },
      time: { durationMs: 25000, fps: 60 },
    };
    const createResolution = (action, frames) => ({
      ready: true,
      actionBinding: {
        identity: `fixture:${action.id}`,
        ownerKind: 'kibo',
        ownerId: 500206,
      },
      controlBinding: { frameRate: 60 },
      hits: frames.map((frame, index) => ({
        hitIdentity: `${action.id}:hit:${index + 1}`,
        hitIndex: index + 1,
        elementId: 900000000 + index,
        trigger: { startFrame: frame },
        damage: { elementalType: 6 },
      })),
    });
    const catalog = {
      kind: 'fixture-kibo-passive-mechanics-catalog',
      generatedAt: 'fixture',
      definitions: [
        {
          skillId: 990008,
          kiboIds: [500206],
          name: 'fixture-internal-cooldown-debuff',
          confidence: 'high',
          provenance: ['fixture:verified-condition-family'],
          mechanismFamily: 'on-kibo-damage-enemy-property-effect',
          trigger: {
            event: 'damage-dealt',
            sourceScope: 'equipped-kibo',
            target: 'hit-enemy',
            internalCooldownMs: 15000,
            activationOrder: 'after-triggering-hit',
            activationDelayMs: 0.001,
            sourceElementId: 990008001,
            sourcePathId: 'fixture-trigger',
          },
          effect: {
            target: 'enemy',
            durationMs: 8000,
            expiration: 'duration',
            stackMode: 'refresh',
            stackDelta: 1,
            maxStacks: 1,
            refreshRule: 'refresh-duration',
            sourceElementId: 990008002,
            sourcePathId: 'fixture-effect',
            modifiers: [
              {
                kind: 'battle-property',
                attributeId: 45,
                bucket: 'dynamicExtra',
                valueRaw: -2000,
              },
            ],
          },
        },
      ],
      unresolved: [],
    };
    const generation = createVerifiedKiboPassiveGeneration({
      scenario,
      catalog,
      actionResolutionById: new Map([
        [firstAction.id, createResolution(firstAction, [6, 12])],
        [secondAction.id, createResolution(secondAction, [6])],
      ]),
    });
    const timeline = createEffectRuntimeTimeline({
      scenario,
      generatedCommands: generation.effectCommands,
    });

    expect(generation.effectCommands.map(command => command.timeMs)).toEqual([
      100.001, 15100.001,
    ]);
    expect(generation.internalCooldownSuppressions).toEqual([
      expect.objectContaining({
        actionId: 'icd-action-1',
        hitIdentity: 'icd-action-1:hit:2',
        hitTimeMs: 200,
        lastTriggerAtMs: 100,
        internalCooldownMs: 15000,
        reason: 'kibo-passive-internal-cooldown-active',
      }),
    ]);
    expect(generation.summary).toMatchObject({
      effectCommandCount: 2,
      internalCooldownSuppressedTriggerCount: 1,
      statefulPassiveRuntimeStateCount: 1,
    });
    expect(generation.runtimeStates).toEqual([
      expect.objectContaining({
        stateIdentity: 'kibo-passive-runtime:actor-101007|500206|990008',
        actorId: 'actor-101007',
        kiboId: 500206,
        skillId: 990008,
        internalCooldownMs: 15000,
        lastTriggerAtMs: 15100,
        cooldownReadyAtMs: 30100,
        triggerCount: 2,
        maxTriggerCount: null,
        remainingTriggerCount: null,
      }),
    ]);
    expect(
      resolveActiveEffectsAt(timeline, 9000, {
        targetKind: 'enemy',
        targetId: 'enemy-300032',
        calculatorOnly: true,
      })
    ).toEqual([]);
    expect(
      resolveActiveEffectsAt(timeline, 16000, {
        targetKind: 'enemy',
        targetId: 'enemy-300032',
        calculatorOnly: true,
      })
    ).toHaveLength(1);
  });

  it('evaluates OR TargetEntityType conditions before the shared ICD and lifecycle', () => {
    const action = {
      id: 'slime-condition-action',
      type: 'kiboEvent',
      actorId: 'actor-slime-kibo',
      startMs: 0,
      durationMs: 1000,
    };
    const createScenario = entityType => ({
      actors: [
        {
          id: 'actor-slime-kibo',
          loadout: { kiboId: 500206 },
        },
      ],
      actions: [action],
      enemy: {
        id: 'enemy-condition-target',
        ...(entityType == null ? {} : { entityType }),
      },
      time: { durationMs: 20000, fps: 60 },
    });
    const resolution = {
      ready: true,
      actionBinding: {
        identity: 'fixture:slime-condition-action',
        ownerKind: 'kibo',
        ownerId: 500206,
      },
      controlBinding: { frameRate: 60 },
      hits: [
        {
          hitIdentity: 'slime-hit-1',
          hitIndex: 1,
          elementId: 990008001,
          trigger: { startFrame: 6 },
          damage: { elementalType: 6 },
        },
        {
          hitIdentity: 'slime-hit-2',
          hitIndex: 2,
          elementId: 990008002,
          trigger: { startFrame: 12 },
          damage: { elementalType: 6 },
        },
      ],
    };
    const positiveScenario = createScenario(14);
    const positive = createVerifiedKiboPassiveGeneration({
      scenario: positiveScenario,
      actionResolutionById: new Map([[action.id, resolution]]),
    });
    const timeline = createEffectRuntimeTimeline({
      scenario: positiveScenario,
      generatedCommands: positive.effectCommands,
    });
    const negative = createVerifiedKiboPassiveGeneration({
      scenario: createScenario(1),
      actionResolutionById: new Map([[action.id, resolution]]),
    });
    const unknown = createVerifiedKiboPassiveGeneration({
      scenario: createScenario(null),
      actionResolutionById: new Map([[action.id, resolution]]),
    });
    const compiledMonsterScenario = createScenario(null);
    compiledMonsterScenario.enemy.source = {
      enemy: { id: 'td-enemy-source-row' },
    };
    const compiledMonster = createVerifiedKiboPassiveGeneration({
      scenario: compiledMonsterScenario,
      actionResolutionById: new Map([[action.id, resolution]]),
    });

    expect(positive.unresolved).toEqual([]);
    expect(positive.conditionSuppressions).toEqual([]);
    expect(positive.effectCommands).toEqual([
      expect.objectContaining({
        effectId: 'kibo-passive:520008:520008002',
        timeMs: 100.001,
        durationMs: 8000,
        stackMode: 'refresh',
        maxStacks: 1,
      }),
    ]);
    expect(positive.internalCooldownSuppressions).toEqual([
      expect.objectContaining({
        hitIdentity: 'slime-hit-2',
        internalCooldownMs: 15000,
        reason: 'kibo-passive-internal-cooldown-active',
      }),
    ]);
    expect(
      resolveActiveEffectsAt(timeline, 8100, {
        targetKind: 'enemy',
        targetId: 'enemy-condition-target',
        calculatorOnly: true,
      })
    ).toHaveLength(1);
    expect(
      resolveActiveEffectsAt(timeline, 8100.001, {
        targetKind: 'enemy',
        targetId: 'enemy-condition-target',
        calculatorOnly: true,
      })
    ).toEqual([]);
    expect(negative.effectCommands).toEqual([]);
    expect(negative.conditionSuppressions).toEqual([
      expect.objectContaining({
        actualTargetEntityType: 1,
        entityTypeSource: 'scenario.enemy.entityType',
        reason: 'kibo-passive-target-entity-type-condition-not-matched',
      }),
    ]);
    expect(unknown.effectCommands).toEqual([]);
    expect(unknown.conditionSuppressions).toEqual([
      expect.objectContaining({
        actualTargetEntityType: null,
        entityTypeSource: 'scenario-enemy-entity-type-missing',
        reason: 'kibo-passive-target-entity-type-unresolved',
      }),
    ]);
    expect(compiledMonster.effectCommands).toHaveLength(1);
    expect(compiledMonster.conditionSuppressions).toEqual([]);
  });

  it('loads source-verified self properties at scenario start and expires timed ones', () => {
    const scenario = {
      actors: [
        {
          id: 'actor-timed-kibo',
          name: '后台搭档',
          loadout: { kiboId: 500120 },
        },
        {
          id: 'actor-persistent-kibo',
          name: '前台搭档',
          loadout: { kiboId: 500025 },
        },
        {
          id: 'actor-without-kibo',
          name: '未装备奇波',
          loadout: { kiboId: null },
        },
      ],
      actions: [],
      enemy: { id: 'enemy-static-passive' },
      time: { durationMs: 20000, fps: 60 },
    };
    const generation = createVerifiedKiboPassiveGeneration({ scenario });
    const timeline = createEffectRuntimeTimeline({
      scenario,
      generatedCommands: generation.effectCommands,
    });

    expect(generation.unresolved).toEqual([]);
    expect(generation.summary).toMatchObject({
      equippedKiboCount: 2,
      staticSelfEffectCommandCount: 2,
      effectCommandCount: 2,
    });
    expect(generation.effectCommands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKiboId: 500120,
          sourceActorId: 'actor-timed-kibo',
          effectId: 'kibo-passive:520057:520057001',
          targetKind: 'kibo',
          targetId: 'actor-timed-kibo',
          timeMs: 0,
          durationMs: 15000,
          modifiers: [
            expect.objectContaining({
              attributeId: 45,
              bucket: 'dynamicExtra',
              valueRaw: 3000,
            }),
          ],
        }),
        expect.objectContaining({
          sourceKiboId: 500025,
          sourceActorId: 'actor-persistent-kibo',
          effectId: 'kibo-passive:520014:520014001',
          targetKind: 'kibo',
          targetId: 'actor-persistent-kibo',
          timeMs: 0,
          durationMs: null,
        }),
      ])
    );
    expect(
      resolveActiveEffectsAt(timeline, 14999.999, {
        targetKind: 'kibo',
        targetId: 'actor-timed-kibo',
        calculatorOnly: true,
      })
    ).toHaveLength(1);
    expect(
      resolveActiveEffectsAt(timeline, 15000, {
        targetKind: 'kibo',
        targetId: 'actor-timed-kibo',
        calculatorOnly: true,
      })
    ).toEqual([]);
    expect(
      resolveActiveEffectsAt(timeline, 20000, {
        targetKind: 'kibo',
        targetId: 'actor-persistent-kibo',
        calculatorOnly: true,
      })
    ).toEqual([
      expect.objectContaining({
        effectId: 'kibo-passive:520014:520014001',
        stacks: 1,
        expiresAtMs: null,
      }),
    ]);
    expect(
      generation.effectCommands.some(
        command => command.targetId === 'actor-without-kibo'
      )
    ).toBe(false);
  });

  it('applies every root of a timed self passive to the real kibo damage source', () => {
    const scenario = createActualKiboScenario({
      kiboId: 500042,
      skillId: 506006,
      actionId: 'gladiator-lizard-active',
      eventType: 'active',
    });
    const action = scenario.actions[0];
    const resolution = resolveVerifiedCombatActionMechanics(action, {
      combatScenario: scenario.combatScenario,
    });
    const actionResolutionById = new Map([[action.id, resolution]]);
    const actionRuleDiagnostics = createActionRuleDiagnostics({ scenario });
    const actionExecutionPlan = createActionExecutionPlan({
      scenario,
      actionRuleDiagnostics,
    });
    const controlledActorTimeline = createControlledActorTimeline({
      scenario,
      actionExecutionPlan,
    });
    const generation = createVerifiedKiboPassiveGeneration({
      scenario,
      actionExecutionPlan,
      actionResolutionById,
    });
    const effectTimeline = createEffectRuntimeTimeline({
      scenario,
      actionExecutionPlan,
      generatedCommands: generation.effectCommands,
    });
    const withPassive = createVerifiedCombatRuntime({
      scenario,
      actionExecutionPlan,
      controlledActorTimeline,
      effectTimeline,
    });
    const withoutPassive = createVerifiedCombatRuntime({
      scenario,
      actionExecutionPlan,
      controlledActorTimeline,
      effectTimeline: createEffectRuntimeTimeline({
        scenario,
        actionExecutionPlan,
      }),
    });
    const integrated = simulateScenario(scenario);

    expect(resolution.ready).toBe(true);
    expect(resolution.controlBinding.logic.skillTag).toBe('13');
    expect(generation.unresolved).toEqual([]);
    expect(generation.conditionSuppressions).toEqual([
      expect.objectContaining({
        actionId: action.id,
        kiboId: 500042,
        skillId: 520083,
        actualSkillTags: [13],
        skillTagSource: 'resolution.controlBinding.logic.skillTag',
        reason: 'kibo-passive-skill-tag-condition-not-matched',
      }),
    ]);
    expect(
      generation.effectCommands.some(
        command => command.effectId === 'kibo-passive:520083:520083002'
      )
    ).toBe(false);
    expect(generation.effectCommands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          effectId: 'kibo-passive:520080:520080001',
          targetKind: 'kibo',
          durationMs: 10000,
          modifiers: [
            expect.objectContaining({
              attributeId: 1,
              bucket: 'dynamicPercent',
              valueRaw: 6000,
            }),
          ],
        }),
        expect.objectContaining({
          effectId: 'kibo-passive:520080:520080002',
          targetKind: 'kibo',
          durationMs: 10000,
          modifiers: [
            expect.objectContaining({
              attributeId: 22,
              bucket: 'dynamicExtra',
              valueRaw: -2000,
            }),
          ],
        }),
      ])
    );
    expect(sumDamage(withPassive, action.id)).toBeGreaterThan(
      sumDamage(withoutPassive, action.id)
    );
    expect(sumDamage(integrated.verifiedCombatRuntime, action.id)).toBe(
      sumDamage(withPassive, action.id)
    );
    expect(
      withPassive.damageEvents.flatMap(
        event => event.payload.dynamicPropertyTrace.source
      )
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attributeId: 1,
          dynamicPercentRaw: 6000,
        }),
      ])
    );
    expect(
      resolveActiveEffectsAt(effectTimeline, 9999.999, {
        targetKind: 'kibo',
        targetId: action.actorId,
        calculatorOnly: true,
      })
    ).toHaveLength(2);
    expect(
      resolveActiveEffectsAt(effectTimeline, 10000, {
        targetKind: 'kibo',
        targetId: action.actorId,
        calculatorOnly: true,
      })
    ).toEqual([]);
  });

  it('applies the real PetUltraSkill debuff once, reports later hits, and expires at 40 seconds', () => {
    const scenario = createActualKiboScenario({
      kiboId: 500042,
      skillId: 50004202,
      actionId: 'gladiator-lizard-signature',
      eventType: 'signature',
      durationMs: 43000,
    });
    const action = scenario.actions[0];
    const resolution = resolveVerifiedCombatActionMechanics(action, {
      combatScenario: scenario.combatScenario,
    });
    const actionResolutionById = new Map([[action.id, resolution]]);
    const actionRuleDiagnostics = createActionRuleDiagnostics({ scenario });
    const actionExecutionPlan = createActionExecutionPlan({
      scenario,
      actionRuleDiagnostics,
    });
    const controlledActorTimeline = createControlledActorTimeline({
      scenario,
      actionExecutionPlan,
    });
    const generation = createVerifiedKiboPassiveGeneration({
      scenario,
      actionExecutionPlan,
      actionResolutionById,
    });
    const effectTimeline = createEffectRuntimeTimeline({
      scenario,
      actionExecutionPlan,
      generatedCommands: generation.effectCommands,
    });
    const runtime = createVerifiedCombatRuntime({
      scenario,
      actionExecutionPlan,
      controlledActorTimeline,
      effectTimeline,
    });
    const passiveCommands = generation.effectCommands.filter(
      command => command.effectId === 'kibo-passive:520083:520083002'
    );
    const passiveCommand = passiveCommands[0];

    expect(resolution.ready).toBe(true);
    expect(resolution.controlBinding.logic.skillTag).toBe('14');
    expect(generation.unresolved).toEqual([]);
    expect(generation.conditionSuppressions).toEqual([]);
    expect(passiveCommands).toHaveLength(1);
    expect(passiveCommand).toMatchObject({
      sourceActionId: action.id,
      sourceKiboId: 500042,
      targetKind: 'enemy',
      targetId: String(scenario.enemy.id),
      durationMs: 40000,
      stackMode: 'refresh',
      maxStacks: 1,
      modifiers: [
        expect.objectContaining({
          attributeId: 45,
          bucket: 'dynamicExtra',
          valueRaw: -1000,
        }),
        expect.objectContaining({
          attributeId: 3,
          bucket: 'dynamicPercent',
          valueRaw: -600,
        }),
        expect.objectContaining({
          attributeId: 4,
          bucket: 'dynamicPercent',
          valueRaw: -600,
        }),
      ],
      sourceIdentity: expect.objectContaining({
        configuredTriggerCounter: 1,
        maxTriggerCount: 1,
        triggerCondition: expect.objectContaining({
          requiredSkillTags: [14],
        }),
      }),
    });
    expect(generation.triggerLimitSuppressions.length).toBeGreaterThan(0);
    expect(generation.triggerLimitSuppressions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: action.id,
          kiboId: 500042,
          skillId: 520083,
          triggerCount: 1,
          maxTriggerCount: 1,
          triggerLimitScope: 'passive-element-lifetime',
          reason: 'kibo-passive-trigger-count-limit-reached',
        }),
      ])
    );
    expect(generation.runtimeStates).toEqual([
      expect.objectContaining({
        stateIdentity: 'kibo-passive-runtime:actor-101007|500042|520083',
        actorId: 'actor-101007',
        kiboId: 500042,
        skillId: 520083,
        triggerCount: 1,
        configuredTriggerCounter: 1,
        triggerLifetime: 'finite',
        maxTriggerCount: 1,
        remainingTriggerCount: 0,
        triggerLimitScope: 'passive-element-lifetime',
      }),
    ]);
    expect(
      runtime.damageEvents
        .filter(event => event.actionId === action.id)
        .find(event => event.timeMs < passiveCommand.timeMs)?.payload
        .dynamicPropertyTrace.target ?? []
    ).toEqual([]);
    expect(
      runtime.damageEvents
        .filter(
          event =>
            event.actionId === action.id && event.timeMs > passiveCommand.timeMs
        )
        .flatMap(event => event.payload.dynamicPropertyTrace.target)
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attributeId: 3,
          dynamicPercentRaw: -600,
        }),
        expect.objectContaining({
          attributeId: 4,
          dynamicPercentRaw: -600,
        }),
      ])
    );
    expect(
      resolveActiveEffectsAt(
        effectTimeline,
        passiveCommand.timeMs + 39999.999,
        {
          targetKind: 'enemy',
          targetId: String(scenario.enemy.id),
          calculatorOnly: true,
        }
      ).filter(effect => effect.effectId === passiveCommand.effectId)
    ).toHaveLength(1);
    expect(
      resolveActiveEffectsAt(effectTimeline, passiveCommand.timeMs + 40000, {
        targetKind: 'enemy',
        targetId: String(scenario.enemy.id),
        calculatorOnly: true,
      }).filter(effect => effect.effectId === passiveCommand.effectId)
    ).toEqual([]);

    const missingTagResolution = {
      ...resolution,
      controlBinding: {
        ...resolution.controlBinding,
        logic: {
          ...resolution.controlBinding.logic,
          skillTag: null,
        },
      },
    };
    const missingTag = createVerifiedKiboPassiveGeneration({
      scenario,
      actionExecutionPlan,
      actionResolutionById: new Map([[action.id, missingTagResolution]]),
    });
    expect(
      missingTag.effectCommands.some(
        command => command.effectId === 'kibo-passive:520083:520083002'
      )
    ).toBe(false);
    expect(missingTag.conditionSuppressions).toEqual([
      expect.objectContaining({
        actionId: action.id,
        skillId: 520083,
        actualSkillTags: null,
        skillTagSource: 'resolution.controlBinding.logic.skillTag-missing',
        reason: 'kibo-passive-skill-tag-unresolved',
      }),
    ]);
  });

  it('applies the real BeforeSkill attack stack to Self and PetOwner at action start', () => {
    const scenario = createActualKiboScenario({
      kiboId: 500043,
      skillId: 50004302,
      actionId: 'small-butterfly-signature-start',
      eventType: 'signature',
      durationMs: 40000,
    });
    const action = scenario.actions[0];
    const resolution = resolveVerifiedCombatActionMechanics(action, {
      combatScenario: scenario.combatScenario,
    });
    const actionResolutionById = new Map([[action.id, resolution]]);
    const actionRuleDiagnostics = createActionRuleDiagnostics({ scenario });
    const actionExecutionPlan = createActionExecutionPlan({
      scenario,
      actionRuleDiagnostics,
    });
    const generation = createVerifiedKiboPassiveGeneration({
      scenario,
      actionExecutionPlan,
      actionResolutionById,
    });
    const effectTimeline = createEffectRuntimeTimeline({
      scenario,
      actionExecutionPlan,
      generatedCommands: generation.effectCommands,
    });
    const passiveCommands = generation.effectCommands.filter(
      command => command.effectId === 'kibo-passive:520087:520087002'
    );

    expect(resolution.ready).toBe(true);
    expect(resolution.controlBinding.logic.skillTag).toBe('14');
    expect(passiveCommands).toEqual([
      expect.objectContaining({
        sourceActionId: action.id,
        targetKind: 'kibo',
        targetId: action.actorId,
        timeMs: action.startMs,
        durationMs: 30000,
        stackMode: 'stack',
        maxStacks: 6,
        sourceIdentity: expect.objectContaining({
          triggerEvent: 'skill-before',
          triggerEffectTargetType: 0,
          triggerEffectTargetName: 'Self',
        }),
      }),
      expect.objectContaining({
        sourceActionId: action.id,
        targetKind: 'actor',
        targetId: action.actorId,
        timeMs: action.startMs,
        sourceIdentity: expect.objectContaining({
          triggerEvent: 'skill-before',
          triggerEffectTargetType: 8,
          triggerEffectTargetName: 'PetOwner',
        }),
      }),
    ]);
    expect(
      resolveActiveEffectsAt(effectTimeline, action.startMs, {
        targetId: action.actorId,
        calculatorOnly: true,
      })
        .filter(effect => effect.effectId === 'kibo-passive:520087:520087002')
        .map(effect => effect.targetKind)
    ).toEqual(['actor', 'kibo']);
    expect(resolution.hits.filter(hit => hit.damage)).toEqual([]);
    expect(generation.summary.beforeSkillEffectCommandCount).toBe(2);
  });

  it('caps BeforeSkill stacks at six, refreshes both targets, and diagnoses non-signature tags', () => {
    const baseScenario = createActualKiboScenario({
      kiboId: 500043,
      skillId: 50004302,
      actionId: 'small-butterfly-signature',
      eventType: 'signature',
      durationMs: 40000,
    });
    const baseAction = baseScenario.actions[0];
    const resolution = resolveVerifiedCombatActionMechanics(baseAction, {
      combatScenario: baseScenario.combatScenario,
    });
    const actions = Array.from({ length: 7 }, (_, index) => ({
      ...baseAction,
      id: `small-butterfly-signature-${index + 1}`,
      startMs: index * 1000,
    }));
    const scenario = { ...baseScenario, actions };
    const actionResolutionById = new Map(
      actions.map(action => [action.id, resolution])
    );
    const generation = createVerifiedKiboPassiveGeneration({
      scenario,
      actionResolutionById,
    });
    const effectTimeline = createEffectRuntimeTimeline({
      scenario,
      generatedCommands: generation.effectCommands,
    });

    expect(resolution.ready).toBe(true);
    expect(resolution.controlBinding.logic.skillTag).toBe('14');
    expect(generation.effectCommands).toHaveLength(14);
    expect(generation.runtimeStates).toContainEqual(
      expect.objectContaining({
        actorId: baseAction.actorId,
        kiboId: 500043,
        skillId: 520087,
        triggerCount: 7,
        configuredTriggerCounter: 9999999,
        triggerLifetime: 'unlimited',
        maxTriggerCount: null,
        remainingTriggerCount: null,
      })
    );
    expect(generation.triggerLimitSuppressions).toEqual([]);
    expect(
      resolveActiveEffectsAt(effectTimeline, 6000, {
        targetId: baseAction.actorId,
        calculatorOnly: true,
      })
        .filter(effect => effect.effectId === 'kibo-passive:520087:520087002')
        .map(effect => ({
          targetKind: effect.targetKind,
          stacks: effect.stacks,
          expiresAtMs: effect.expiresAtMs,
        }))
    ).toEqual([
      { targetKind: 'actor', stacks: 6, expiresAtMs: 36000 },
      { targetKind: 'kibo', stacks: 6, expiresAtMs: 36000 },
    ]);
    expect(
      resolveActiveEffectsAt(effectTimeline, 35999.999, {
        targetId: baseAction.actorId,
        calculatorOnly: true,
      }).filter(effect => effect.effectId === 'kibo-passive:520087:520087002')
    ).toHaveLength(2);
    expect(
      resolveActiveEffectsAt(effectTimeline, 36000, {
        targetId: baseAction.actorId,
        calculatorOnly: true,
      }).filter(effect => effect.effectId === 'kibo-passive:520087:520087002')
    ).toEqual([]);

    const activeScenario = createActualKiboScenario({
      kiboId: 500043,
      skillId: 504012,
      actionId: 'small-butterfly-active',
      eventType: 'active',
    });
    const activeAction = activeScenario.actions[0];
    const activeResolution = resolveVerifiedCombatActionMechanics(
      activeAction,
      { combatScenario: activeScenario.combatScenario }
    );
    const activeGeneration = createVerifiedKiboPassiveGeneration({
      scenario: activeScenario,
      actionResolutionById: new Map([[activeAction.id, activeResolution]]),
    });
    expect(activeResolution.ready).toBe(true);
    expect(activeGeneration.effectCommands).toEqual([]);
    expect(activeGeneration.conditionSuppressions).toEqual([
      expect.objectContaining({
        actionId: activeAction.id,
        kiboId: 500043,
        skillId: 520087,
        reason: 'kibo-passive-skill-tag-condition-not-matched',
      }),
    ]);

    const mismatchedTagResolution = {
      ...resolution,
      controlBinding: {
        ...resolution.controlBinding,
        logic: { ...resolution.controlBinding.logic, skillTag: '13' },
      },
    };
    const mismatch = createVerifiedKiboPassiveGeneration({
      scenario: baseScenario,
      actionResolutionById: new Map([[baseAction.id, mismatchedTagResolution]]),
    });
    expect(mismatch.effectCommands).toEqual([]);
    expect(mismatch.conditionSuppressions).toEqual([
      expect.objectContaining({
        actionId: baseAction.id,
        skillId: 520087,
        actualSkillTags: [13],
        reason: 'kibo-passive-skill-tag-condition-not-matched',
      }),
    ]);

    const missingTagResolution = {
      ...resolution,
      controlBinding: {
        ...resolution.controlBinding,
        logic: { ...resolution.controlBinding.logic, skillTag: null },
      },
    };
    const missingTag = createVerifiedKiboPassiveGeneration({
      scenario: baseScenario,
      actionResolutionById: new Map([[baseAction.id, missingTagResolution]]),
    });
    expect(missingTag.conditionSuppressions).toEqual([
      expect.objectContaining({
        actionId: baseAction.id,
        skillId: 520087,
        actualSkillTags: null,
        skillTagSource: 'resolution.controlBinding.logic.skillTag-missing',
        reason: 'kibo-passive-skill-tag-unresolved',
      }),
    ]);
  });

  it('applies every verified damage-triggered root from one hit and caps both at five', () => {
    const scenario = createActualKiboScenario({
      kiboId: 500020,
      skillId: 503001,
      actionId: 'small-snow-wolf-active',
      eventType: 'active',
      durationMs: 12000,
    });
    const action = scenario.actions[0];
    const resolution = resolveVerifiedCombatActionMechanics(action, {
      combatScenario: scenario.combatScenario,
    });
    const actionResolutionById = new Map([[action.id, resolution]]);
    const actionRuleDiagnostics = createActionRuleDiagnostics({ scenario });
    const actionExecutionPlan = createActionExecutionPlan({
      scenario,
      actionRuleDiagnostics,
    });
    const controlledActorTimeline = createControlledActorTimeline({
      scenario,
      actionExecutionPlan,
    });
    const generation = createVerifiedKiboPassiveGeneration({
      scenario,
      actionExecutionPlan,
      actionResolutionById,
    });
    const effectTimeline = createEffectRuntimeTimeline({
      scenario,
      actionExecutionPlan,
      generatedCommands: generation.effectCommands,
    });
    const withPassive = createVerifiedCombatRuntime({
      scenario,
      actionExecutionPlan,
      controlledActorTimeline,
      effectTimeline,
    });
    const withoutPassive = createVerifiedCombatRuntime({
      scenario,
      actionExecutionPlan,
      controlledActorTimeline,
      effectTimeline: createEffectRuntimeTimeline({
        scenario,
        actionExecutionPlan,
      }),
    });
    const withDefenseRootsOnly = createVerifiedCombatRuntime({
      scenario,
      actionExecutionPlan,
      controlledActorTimeline,
      effectTimeline: createEffectRuntimeTimeline({
        scenario,
        actionExecutionPlan,
        generatedCommands: generation.effectCommands.filter(
          command => command.effectId === 'kibo-passive:520051:520051002'
        ),
      }),
    });
    const damageHits = resolution.hits.filter(hit => hit.damage);
    const passiveCommands = generation.effectCommands.filter(command =>
      command.effectId.startsWith('kibo-passive:520051:')
    );
    const firstHitTime = Math.min(
      ...withPassive.damageEvents
        .filter(event => event.actionId === action.id)
        .map(event => event.timeMs)
    );
    const firstHitTargetTrace = withPassive.damageEvents
      .filter(
        event => event.actionId === action.id && event.timeMs === firstHitTime
      )
      .flatMap(event => event.payload.dynamicPropertyTrace.target)
      .filter(trace => [3, 4, 66].includes(trace.attributeId));
    const laterTargetTrace = withPassive.damageEvents
      .filter(
        event => event.actionId === action.id && event.timeMs > firstHitTime
      )
      .flatMap(event => event.payload.dynamicPropertyTrace.target)
      .filter(trace => [3, 4, 66].includes(trace.attributeId));

    expect(resolution.ready).toBe(true);
    expect(generation.unresolved).toEqual([]);
    expect(passiveCommands).toHaveLength(damageHits.length * 2);
    expect(passiveCommands.slice(0, 2)).toEqual([
      expect.objectContaining({
        effectId: 'kibo-passive:520051:520051002',
        timeMs: expect.any(Number),
        durationMs: null,
        stackMode: 'stack',
        maxStacks: 5,
        modifiers: [
          expect.objectContaining({
            attributeId: 3,
            valueRaw: -160,
          }),
          expect.objectContaining({
            attributeId: 4,
            valueRaw: -160,
          }),
        ],
      }),
      expect.objectContaining({
        effectId: 'kibo-passive:520051:520051005',
        timeMs: expect.any(Number),
        durationMs: null,
        stackMode: 'stack',
        maxStacks: 5,
        modifiers: [
          expect.objectContaining({
            attributeId: 66,
            valueRaw: -60,
          }),
        ],
      }),
    ]);
    expect(passiveCommands[0].timeMs).toBe(passiveCommands[1].timeMs);
    expect(firstHitTargetTrace).toEqual([]);
    const maxObservedPriorStacks = Math.min(
      Math.max(damageHits.length - 1, 0),
      5
    );
    expect(
      Math.min(
        ...laterTargetTrace
          .filter(trace => trace.attributeId === 3)
          .map(trace => trace.dynamicPercentRaw)
      )
    ).toBe(-160 * maxObservedPriorStacks);
    expect(
      Math.min(
        ...laterTargetTrace
          .filter(trace => trace.attributeId === 4)
          .map(trace => trace.dynamicPercentRaw)
      )
    ).toBe(-160 * maxObservedPriorStacks);
    expect(sumDamage(withPassive, action.id)).toBeGreaterThan(
      sumDamage(withDefenseRootsOnly, action.id)
    );
    expect(sumDamage(withDefenseRootsOnly, action.id)).toBe(
      sumDamage(withoutPassive, action.id)
    );
    expect(
      resolveActiveEffectsAt(effectTimeline, scenario.time.durationMs, {
        targetKind: 'enemy',
        targetId: String(scenario.enemy.id),
        calculatorOnly: true,
      })
        .filter(effect => effect.effectId.startsWith('kibo-passive:520051:'))
        .map(effect => ({ effectId: effect.effectId, stacks: effect.stacks }))
    ).toEqual([
      {
        effectId: 'kibo-passive:520051:520051002',
        stacks: Math.min(damageHits.length, 5),
      },
      {
        effectId: 'kibo-passive:520051:520051005',
        stacks: Math.min(damageHits.length, 5),
      },
    ]);

    const repeatedAction = {
      ...action,
      id: `${action.id}-repeat`,
      startMs: 3000,
    };
    const repeatedScenario = {
      ...scenario,
      actions: [action, repeatedAction],
    };
    const repeatedGeneration = createVerifiedKiboPassiveGeneration({
      scenario: repeatedScenario,
      actionResolutionById: new Map([
        [action.id, resolution],
        [repeatedAction.id, resolution],
      ]),
    });
    const repeatedTimeline = createEffectRuntimeTimeline({
      scenario: repeatedScenario,
      generatedCommands: repeatedGeneration.effectCommands,
    });
    expect(repeatedGeneration.effectCommands).toHaveLength(
      damageHits.length * 2 * 2
    );
    expect(
      resolveActiveEffectsAt(
        repeatedTimeline,
        repeatedScenario.time.durationMs,
        {
          targetKind: 'enemy',
          targetId: String(repeatedScenario.enemy.id),
          calculatorOnly: true,
        }
      )
        .filter(effect => effect.effectId.startsWith('kibo-passive:520051:'))
        .map(effect => ({ effectId: effect.effectId, stacks: effect.stacks }))
    ).toEqual([
      { effectId: 'kibo-passive:520051:520051002', stacks: 5 },
      { effectId: 'kibo-passive:520051:520051005', stacks: 5 },
    ]);
  });

  it('runs a control-reachable static resistance and damage-triggered debuff from one composite passive', () => {
    const scenario = createActualKiboScenario({
      kiboId: 500261,
      skillId: 502001,
      actionId: 'beaver-active',
      eventType: 'active',
      durationMs: 27000,
    });
    const action = scenario.actions[0];
    const resolution = resolveVerifiedCombatActionMechanics(action, {
      combatScenario: scenario.combatScenario,
    });
    const actionResolutionById = new Map([[action.id, resolution]]);
    const actionRuleDiagnostics = createActionRuleDiagnostics({ scenario });
    const actionExecutionPlan = createActionExecutionPlan({
      scenario,
      actionRuleDiagnostics,
    });
    const controlledActorTimeline = createControlledActorTimeline({
      scenario,
      actionExecutionPlan,
    });
    const generation = createVerifiedKiboPassiveGeneration({
      scenario,
      actionExecutionPlan,
      actionResolutionById,
    });
    const staticCommand = generation.effectCommands.find(
      command => command.effectId === 'kibo-passive:520082:520082003'
    );
    const damageCommands = generation.effectCommands.filter(
      command => command.effectId === 'kibo-passive:520082:520082004'
    );
    const effectTimeline = createEffectRuntimeTimeline({
      scenario,
      actionExecutionPlan,
      generatedCommands: generation.effectCommands,
    });
    const staticOnlyTimeline = createEffectRuntimeTimeline({
      scenario,
      actionExecutionPlan,
      generatedCommands: [staticCommand],
    });
    const withCompositePassive = createVerifiedCombatRuntime({
      scenario,
      actionExecutionPlan,
      controlledActorTimeline,
      effectTimeline,
    });
    const withStaticOnly = createVerifiedCombatRuntime({
      scenario,
      actionExecutionPlan,
      controlledActorTimeline,
      effectTimeline: staticOnlyTimeline,
    });
    const compositeDamageEvents = withCompositePassive.damageEvents.filter(
      event => event.actionId === action.id
    );
    const staticOnlyDamageEvents = withStaticOnly.damageEvents.filter(
      event => event.actionId === action.id
    );

    expect(resolution.ready).toBe(true);
    expect(resolution.hits.filter(hit => hit.damage)).toHaveLength(3);
    expect(
      actionExecutionPlan.actions.map(entry => ({
        actionId: entry.actionId,
        execute: entry.execute,
      }))
    ).toEqual([{ actionId: action.id, execute: true }]);
    expect(generation.unresolved).toEqual([]);
    expect(staticCommand).toMatchObject({
      sourceActionId: null,
      targetKind: 'kibo',
      targetId: String(action.actorId),
      timeMs: 0,
      durationMs: null,
      sourceIdentity: {
        triggerEvent: 'scenario-start',
        effectElementId: 520082003,
      },
      modifiers: [
        expect.objectContaining({
          attributeId: 67,
          bucket: 'dynamicExtra',
          valueRaw: 800,
        }),
      ],
    });
    expect(damageCommands).toHaveLength(3);
    expect(generation.runtimeStates).toContainEqual(
      expect.objectContaining({
        actorId: action.actorId,
        kiboId: 500261,
        skillId: 520082,
        triggerCount: 3,
        configuredTriggerCounter: 9999999,
        triggerLifetime: 'unlimited',
        maxTriggerCount: null,
        remainingTriggerCount: null,
      })
    );
    expect(generation.triggerLimitSuppressions).toEqual([]);
    expect(damageCommands[0]).toMatchObject({
      sourceActionId: action.id,
      targetKind: 'enemy',
      durationMs: 20000,
      stackMode: 'refresh',
      maxStacks: 1,
      sourceIdentity: expect.objectContaining({
        triggerEvent: 'damage-dealt',
        triggerElementId: 520082001,
        effectElementId: 520082004,
      }),
      modifiers: [
        expect.objectContaining({
          attributeId: 67,
          bucket: 'dynamicExtra',
          valueRaw: -1000,
        }),
      ],
    });
    expect(
      damageCommands.every(command => command.sourceActionId === action.id)
    ).toBe(true);
    expect(
      resolveActiveEffectsAt(effectTimeline, 0, {
        targetKind: 'kibo',
        targetId: String(action.actorId),
        calculatorOnly: true,
      }).map(effect => effect.effectId)
    ).toContain('kibo-passive:520082:520082003');
    expect(compositeDamageEvents).toHaveLength(3);
    expect(staticOnlyDamageEvents).toHaveLength(3);
    expect(compositeDamageEvents[0].payload.rawDamage).toBe(
      staticOnlyDamageEvents[0].payload.rawDamage
    );
    expect(
      compositeDamageEvents
        .slice(1)
        .every(
          (event, index) =>
            event.payload.rawDamage >
            staticOnlyDamageEvents[index + 1].payload.rawDamage
        )
    ).toBe(true);
    const refreshedEffectTimeMs = damageCommands.at(-1).timeMs;
    expect(
      resolveActiveEffectsAt(
        effectTimeline,
        refreshedEffectTimeMs + 19999.999,
        {
          targetKind: 'enemy',
          targetId: String(scenario.enemy.id),
          calculatorOnly: true,
        }
      ).filter(effect => effect.effectId === 'kibo-passive:520082:520082004')
    ).toHaveLength(1);
    expect(
      resolveActiveEffectsAt(effectTimeline, refreshedEffectTimeMs + 20000, {
        targetKind: 'enemy',
        targetId: String(scenario.enemy.id),
        calculatorOnly: true,
      }).filter(effect => effect.effectId === 'kibo-passive:520082:520082004')
    ).toHaveLength(0);
  });

  it('runs the verified fire derived hit after the triggering hit without recovery or recursion', () => {
    const scenario = createActualKiboScenario({
      kiboId: 500058,
      skillId: 501002,
      actionId: 'flame-feather-active',
      eventType: 'active',
      durationMs: 4000,
    });
    const action = scenario.actions[0];
    const resolution = resolveVerifiedCombatActionMechanics(action, {
      combatScenario: scenario.combatScenario,
    });
    const actionResolutionById = new Map([[action.id, resolution]]);
    const actionRuleDiagnostics = createActionRuleDiagnostics({ scenario });
    const actionExecutionPlan = createActionExecutionPlan({
      scenario,
      actionRuleDiagnostics,
    });
    const controlledActorTimeline = createControlledActorTimeline({
      scenario,
      actionExecutionPlan,
    });
    const generation = createVerifiedKiboPassiveGeneration({
      scenario,
      actionExecutionPlan,
      actionResolutionById,
    });
    const withPassive = createVerifiedCombatRuntime({
      scenario,
      actionExecutionPlan,
      controlledActorTimeline,
      kiboPassiveGeneration: generation,
    });
    const withoutPassive = createVerifiedCombatRuntime({
      scenario,
      actionExecutionPlan,
      controlledActorTimeline,
    });
    const integrated = simulateScenario(scenario);
    const sourceDamageHits = resolution.hits.filter(hit => hit.damage);
    const derivedEvents = withPassive.damageEvents.filter(
      event => event.payload.kiboPassiveDerivedDamage
    );
    const originalEvents = withPassive.damageEvents.filter(
      event =>
        event.type === 'VERIFIED_COMBAT_HIT' &&
        !event.payload.kiboPassiveDerivedDamage
    );

    expect(resolution.ready).toBe(true);
    expect(actionExecutionPlan.actions[0].execute).toBe(true);
    expect(sourceDamageHits.length).toBeGreaterThan(0);
    expect(generation.unresolved).toEqual([]);
    expect(generation.effectCommands).toEqual([]);
    expect(generation.derivedDamageCommands).toHaveLength(1);
    expect(generation.internalCooldownSuppressions).toHaveLength(
      sourceDamageHits.length - 1
    );
    expect(generation.derivedDamageCommands[0]).toMatchObject({
      sourceActionId: action.id,
      sourceKiboId: 500058,
      targetKind: 'enemy',
      passiveSkillId: 520041,
      ignoreDamageEvent: true,
      emitsDamageTriggerEvents: false,
      recursivePassiveTrigger: false,
      sourceStatus: 'verified-passive-derived-damage-generated',
      hit: {
        elementId: 520041002,
        formula: {
          baseFunctionId: 4,
          coefficientRaw: 3000,
          ratiosByLevel: expect.objectContaining({ 1: 3000 }),
        },
        damage: {
          elementalType: 1,
          elementalTypeName: 'Fire',
          weakBreakDamageRateBasisPoints: 2000,
          recoverSp: 0,
          petRecoverSp: 0,
        },
      },
    });
    expect(derivedEvents).toHaveLength(1);
    expect(derivedEvents[0].timeMs).toBe(originalEvents[0].timeMs + 0.001);
    expect(derivedEvents[0].payload).toMatchObject({
      kiboPassiveDerivedDamage: true,
      passiveSkillId: 520041,
      sourceKiboId: 500058,
      triggerHitIdentity:
        generation.derivedDamageCommands[0].triggerHitIdentity,
      derivedHitIdentity:
        generation.derivedDamageCommands[0].derivedHitIdentity,
      ignoreDamageEvent: true,
      emitsDamageTriggerEvents: false,
      recursivePassiveTrigger: false,
      elementId: 520041002,
      segment: { multiplier: 0.3, elementId: 520041002 },
    });
    expect(derivedEvents[0].payload.rawDamage).toBeGreaterThan(0);
    expect(derivedEvents[0].payload.toughnessDamage).toBeGreaterThan(0);
    expect(withPassive.summary.kiboPassiveDerivedDamageEventCount).toBe(1);
    expect(withPassive.resourceEvents).toHaveLength(
      withoutPassive.resourceEvents.length
    );
    expect(withPassive.kiboResourceEvents).toHaveLength(
      withoutPassive.kiboResourceEvents.length
    );
    expect(
      [...withPassive.resourceEvents, ...withPassive.kiboResourceEvents].some(
        event =>
          String(event.hitKey ?? event.payload?.hitKey ?? '').includes(
            'kibo-passive'
          )
      )
    ).toBe(false);
    expect(withPassive.finalState.enemy.hp).toBeLessThan(
      withoutPassive.finalState.enemy.hp
    );
    expect(
      integrated.verifiedCombatRuntime.damageEvents.filter(
        event => event.payload.kiboPassiveDerivedDamage
      )
    ).toHaveLength(1);
    expect(
      integrated.verifiedKiboPassiveGeneration.summary.derivedDamageCommandCount
    ).toBe(1);
  });

  it('consumes a missed derived hit, suppresses a repeat inside two seconds, and allows a later trigger', () => {
    const baseScenario = createActualKiboScenario({
      kiboId: 500058,
      skillId: 501002,
      actionId: 'flame-feather-active-first',
      eventType: 'active',
      durationMs: 5000,
    });
    const firstAction = baseScenario.actions[0];
    const firstResolution = resolveVerifiedCombatActionMechanics(firstAction, {
      combatScenario: baseScenario.combatScenario,
    });
    const firstSourceHit = firstResolution.hits.find(hit => hit.damage);
    const derivedHitIdentity = `kibo-passive:520041:derived:520041002:${firstSourceHit.hitIdentity}`;
    const missedFirstAction = {
      ...firstAction,
      hitOverrides: {
        ...firstAction.hitOverrides,
        [derivedHitIdentity]: { willHit: false },
      },
    };
    const insideIcdAction = {
      ...firstAction,
      id: 'flame-feather-active-inside-icd',
      startMs: 1000,
    };
    const afterIcdAction = {
      ...firstAction,
      id: 'flame-feather-active-after-icd',
      startMs: 2500,
    };
    const scenario = {
      ...baseScenario,
      actions: [missedFirstAction, insideIcdAction, afterIcdAction],
    };
    const resolutions = new Map(
      scenario.actions.map(action => [
        action.id,
        resolveVerifiedCombatActionMechanics(action, {
          combatScenario: scenario.combatScenario,
        }),
      ])
    );
    const generation = createVerifiedKiboPassiveGeneration({
      scenario,
      actionResolutionById: resolutions,
    });

    expect(firstResolution.ready).toBe(true);
    expect(firstSourceHit).toBeTruthy();
    expect([...resolutions.values()].every(item => item.ready)).toBe(true);
    expect(generation.derivedHitMissSuppressions).toEqual([
      expect.objectContaining({
        actionId: missedFirstAction.id,
        skillId: 520041,
        triggerHitIdentity: firstSourceHit.hitIdentity,
        derivedHitIdentity,
        reason: 'kibo-passive-derived-hit-overridden-to-miss',
      }),
    ]);
    const suppressionCountByAction = Object.fromEntries(
      scenario.actions.map(action => [
        action.id,
        generation.internalCooldownSuppressions.filter(
          row => row.actionId === action.id
        ).length,
      ])
    );
    expect(suppressionCountByAction).toEqual({
      [missedFirstAction.id]:
        firstResolution.hits.filter(hit => hit.damage).length - 1,
      [insideIcdAction.id]: resolutions
        .get(insideIcdAction.id)
        .hits.filter(hit => hit.damage).length,
      [afterIcdAction.id]:
        resolutions.get(afterIcdAction.id).hits.filter(hit => hit.damage)
          .length - 1,
    });
    expect(
      generation.internalCooldownSuppressions.every(
        row =>
          row.skillId === 520041 &&
          row.internalCooldownMs === 2000 &&
          row.reason === 'kibo-passive-internal-cooldown-active'
      )
    ).toBe(true);
    expect(generation.derivedDamageCommands).toEqual([
      expect.objectContaining({
        sourceActionId: afterIcdAction.id,
        passiveSkillId: 520041,
      }),
    ]);
  });

  it('stacks the verified Self attack effect to ten, refreshes it, expires it, and rejects Hero targets', () => {
    const baseScenario = createActualKiboScenario({
      kiboId: 500469,
      skillId: 506002,
      actionId: 'scarecrow-active-1',
      eventType: 'active',
      durationMs: 50000,
    });
    const baseAction = baseScenario.actions[0];
    const actions = Array.from({ length: 11 }, (_, index) => ({
      ...baseAction,
      id: `scarecrow-active-${index + 1}`,
      startMs: index * 2500,
    }));
    const scenario = { ...baseScenario, actions };
    const actionResolutionById = new Map(
      actions.map(action => [
        action.id,
        resolveVerifiedCombatActionMechanics(action, {
          combatScenario: scenario.combatScenario,
        }),
      ])
    );
    const generation = createVerifiedKiboPassiveGeneration({
      scenario,
      actionResolutionById,
    });
    const effectTimeline = createEffectRuntimeTimeline({
      scenario,
      generatedCommands: generation.effectCommands,
    });
    const controlledActorTimeline = createControlledActorTimeline({ scenario });
    const withPassive = createVerifiedCombatRuntime({
      scenario,
      controlledActorTimeline,
      effectTimeline,
    });
    const withoutPassive = createVerifiedCombatRuntime({
      scenario,
      controlledActorTimeline,
      effectTimeline: createEffectRuntimeTimeline({ scenario }),
    });
    const firstResolution = actionResolutionById.get(actions[0].id);
    const sourceDamageHitCount = [...actionResolutionById.values()].reduce(
      (sum, resolution) =>
        sum + resolution.hits.filter(hit => hit.damage).length,
      0
    );
    const lastCommandTimeMs = generation.effectCommands.at(-1).timeMs;
    const activeBeforeExpiry = resolveActiveEffectsAt(
      effectTimeline,
      lastCommandTimeMs + 19999.999,
      {
        targetKind: 'kibo',
        targetId: String(baseAction.actorId),
        calculatorOnly: true,
      }
    );
    const heroScenario = {
      ...scenario,
      enemy: { ...scenario.enemy, entityType: 1 },
    };
    const heroGeneration = createVerifiedKiboPassiveGeneration({
      scenario: heroScenario,
      actionResolutionById,
    });
    const firstWithPassiveEvent = withPassive.damageEvents.find(
      event => event.actionId === actions[0].id
    );
    const firstWithoutPassiveEvent = withoutPassive.damageEvents.find(
      event => event.actionId === actions[0].id
    );
    const laterDamageTrace = withPassive.damageEvents
      .filter(event => event.actionId === actions[1].id)
      .flatMap(event => event.payload.dynamicPropertyTrace.source)
      .find(trace => trace.attributeId === 1);

    expect([...actionResolutionById.values()].every(item => item.ready)).toBe(
      true
    );
    expect(firstResolution.hits.some(hit => hit.damage)).toBe(true);
    expect(generation.unresolved).toEqual([]);
    expect(generation.effectCommands).toHaveLength(sourceDamageHitCount);
    expect(generation.effectCommands[0]).toMatchObject({
      sourceActionId: actions[0].id,
      sourceKiboId: 500469,
      effectId: 'kibo-passive:520090:520090002',
      targetKind: 'kibo',
      targetId: String(baseAction.actorId),
      durationMs: 20000,
      stackMode: 'stack',
      maxStacks: 10,
      modifiers: [
        expect.objectContaining({
          attributeId: 1,
          bucket: 'dynamicPercent',
          valueRaw: 400,
        }),
      ],
      sourceIdentity: expect.objectContaining({
        passiveSkillId: 520090,
        triggerEffectTargetType: 0,
        triggerEffectTargetName: 'Self',
      }),
    });
    expect(firstWithPassiveEvent.payload.rawDamage).toBe(
      firstWithoutPassiveEvent.payload.rawDamage
    );
    expect(sumDamage(withPassive, actions[1].id)).toBeGreaterThan(
      sumDamage(withoutPassive, actions[1].id)
    );
    expect(laterDamageTrace).toMatchObject({
      attributeId: 1,
      dynamicPercentRaw: expect.any(Number),
    });
    expect(laterDamageTrace.dynamicPercentRaw).toBeGreaterThanOrEqual(400);
    expect(activeBeforeExpiry).toEqual([
      expect.objectContaining({
        effectId: 'kibo-passive:520090:520090002',
        targetKind: 'kibo',
        stacks: 10,
      }),
    ]);
    expect(activeBeforeExpiry[0].expiresAtMs).toBeCloseTo(
      lastCommandTimeMs + 20000,
      6
    );
    expect(
      resolveActiveEffectsAt(effectTimeline, lastCommandTimeMs + 20000, {
        targetKind: 'kibo',
        targetId: String(baseAction.actorId),
        calculatorOnly: true,
      })
    ).toEqual([]);
    expect(heroGeneration.effectCommands).toEqual([]);
    expect(heroGeneration.conditionSuppressions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skillId: 520090,
          actualTargetEntityType: 1,
          reason: 'kibo-passive-target-entity-type-condition-not-matched',
        }),
      ])
    );
  });

  it('dispatches the AfterReceiveDamage property effect from a kibo receive-damage event', () => {
    const scenario = createActorSkillWithKiboScenario(500081);
    const action = scenario.actions[0];
    const resolution = resolveVerifiedCombatActionMechanics(action, {
      combatScenario: scenario.combatScenario,
    });
    const actionRuleDiagnostics = createActionRuleDiagnostics({ scenario });
    const actionExecutionPlan = createActionExecutionPlan({
      scenario,
      actionRuleDiagnostics,
    });
    const generation = createVerifiedKiboPassiveGeneration({
      scenario,
      actionExecutionPlan,
      actionResolutionById: new Map([[action.id, resolution]]),
      kiboReceiveDamageEvents: [
        {
          kiboId: 500081,
          actorId: action.actorId,
          timeMs: 1000,
          sourceEventIdentity: 'test:receive:520018',
          applied: true,
        },
      ],
    });
    const commands = generation.effectCommands.filter(
      command => command.sourceIdentity?.passiveSkillId === 520018
    );

    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({
      sourceKiboId: 500081,
      timeMs: 1000,
      durationMs: 8000,
      modifiers: [
        expect.objectContaining({
          attributeId: 66,
          bucket: 'dynamicExtra',
          valueRaw: -500,
        }),
      ],
      sourceIdentity: expect.objectContaining({
        triggerEvent: 'damage-received',
        receiveDamageEventIdentity: 'test:receive:520018',
      }),
    });
    expect(
      generation.unresolved.some(row => row.skillId === 520018)
    ).toBe(false);
    const withoutEvents = createVerifiedKiboPassiveGeneration({
      scenario,
      actionExecutionPlan,
      actionResolutionById: new Map([[action.id, resolution]]),
    });
    expect(
      withoutEvents.effectCommands.some(
        command => command.sourceIdentity?.passiveSkillId === 520018
      )
    ).toBe(false);
  });

  it('targets PetOwner as the actor without leaking the effect to the kibo', () => {
    const scenario = createActorSkillWithKiboScenario(500220);
    const action = scenario.actions[0];
    const resolution = resolveVerifiedCombatActionMechanics(action, {
      combatScenario: scenario.combatScenario,
    });
    const actionResolutionById = new Map([[action.id, resolution]]);
    const actionRuleDiagnostics = createActionRuleDiagnostics({ scenario });
    const actionExecutionPlan = createActionExecutionPlan({
      scenario,
      actionRuleDiagnostics,
    });
    const generation = createVerifiedKiboPassiveGeneration({
      scenario,
      actionExecutionPlan,
      actionResolutionById,
    });
    const effectTimeline = createEffectRuntimeTimeline({
      scenario,
      actionExecutionPlan,
      generatedCommands: generation.effectCommands,
    });
    const ownerCommand = generation.effectCommands.find(
      command => command.effectId === 'kibo-passive:520055:520055001'
    );

    expect(ownerCommand).toMatchObject({
      sourceKiboId: 500220,
      targetKind: 'actor',
      targetId: action.actorId,
      timeMs: 0,
      durationMs: null,
      modifiers: [
        expect.objectContaining({
          attributeId: 105,
          bucket: 'dynamicExtra',
          valueRaw: 3000,
        }),
      ],
      sourceIdentity: expect.objectContaining({
        directInjectTargetType: 7,
        directInjectTargetName: 'PetOwner',
      }),
    });
    expect(
      generation.effectCommands.some(
        command =>
          command.effectId === 'kibo-passive:520055:520055001' &&
          command.targetKind === 'kibo'
      )
    ).toBe(false);
    expect(generation.unresolved).toEqual([]);
    expect(
      resolveActiveEffectsAt(effectTimeline, 4000, {
        targetKind: 'actor',
        targetId: action.actorId,
        calculatorOnly: true,
      }).filter(effect => effect.effectId === 'kibo-passive:520055:520055001')
    ).toEqual([
      expect.objectContaining({
        effectId: 'kibo-passive:520055:520055001',
        targetKind: 'actor',
        targetId: action.actorId,
        expiresAtMs: null,
      }),
    ]);
    expect(
      resolveActiveEffectsAt(effectTimeline, 4000, {
        targetKind: 'kibo',
        targetId: action.actorId,
        calculatorOnly: true,
      }).filter(effect => effect.effectId === 'kibo-passive:520055:520055001')
    ).toEqual([]);
  });

  it('applies the reachable movement property only to Self and PetOwner while excluding orphan dodge elements', () => {
    const scenario = {
      actors: [
        {
          id: 'actor-floating-owner',
          name: '飘浮搭档',
          loadout: { kiboId: 500046 },
        },
        {
          id: 'actor-floating-teammate',
          name: '未受影响队友',
          loadout: {},
        },
      ],
      actions: [],
      enemy: { id: 'enemy-floating' },
      time: { durationMs: 5000, fps: 60 },
    };
    const generation = createVerifiedKiboPassiveGeneration({ scenario });
    const timeline = createEffectRuntimeTimeline({
      scenario,
      generatedCommands: generation.effectCommands,
    });
    const movementCommands = generation.effectCommands.filter(
      command => command.sourceIdentity?.passiveSkillId === 520002
    );

    expect(generation.unresolved).toEqual([]);
    expect(movementCommands).toEqual([
      expect.objectContaining({
        targetKind: 'kibo',
        targetId: 'actor-floating-owner',
        durationMs: null,
        modifiers: [
          expect.objectContaining({
            attributeId: 45,
            bucket: 'dynamicExtra',
            valueRaw: 1000,
            sourceElementId: 520002005,
          }),
        ],
        sourceIdentity: expect.objectContaining({
          directInjectTargetType: 0,
          directInjectTargetName: 'Self',
          provenance: expect.arrayContaining([
            expect.stringContaining('SPEED_RATIO=45'),
          ]),
        }),
      }),
      expect.objectContaining({
        targetKind: 'actor',
        targetId: 'actor-floating-owner',
        durationMs: null,
        sourceIdentity: expect.objectContaining({
          directInjectTargetType: 7,
          directInjectTargetName: 'PetOwner',
        }),
      }),
    ]);
    expect(movementCommands.flatMap(command => command.modifiers)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attributeId: 225,
          sourceElementId: 520002002,
        }),
      ])
    );
    expect(
      resolveActiveEffectsAt(timeline, 5000, {
        targetId: 'actor-floating-owner',
        calculatorOnly: true,
      }).map(effect => effect.targetKind)
    ).toEqual(['actor', 'kibo']);
    expect(
      resolveActiveEffectsAt(timeline, 5000, {
        targetId: 'actor-floating-teammate',
        calculatorOnly: true,
      })
    ).toEqual([]);

    const withoutEquippedKibo = createVerifiedKiboPassiveGeneration({
      scenario: {
        ...scenario,
        actors: scenario.actors.map(actor => ({ ...actor, loadout: {} })),
      },
    });
    expect(withoutEquippedKibo.effectCommands).toEqual([]);
    expect(withoutEquippedKibo.unresolved).toEqual([]);
  });

  it('loads every control-map reachable static root without executing orphan asset elements', () => {
    const scenario = {
      actors: [
        {
          id: 'actor-small-body',
          loadout: { kiboId: 500132 },
        },
        {
          id: 'actor-rock-skin',
          loadout: { kiboId: 500051 },
        },
        {
          id: 'actor-night-vision',
          loadout: { kiboId: 500354 },
        },
      ],
      actions: [],
      enemy: { id: 'enemy-static-roots' },
      time: { durationMs: 6000, fps: 60 },
    };
    const generation = createVerifiedKiboPassiveGeneration({ scenario });
    const timeline = createEffectRuntimeTimeline({
      scenario,
      generatedCommands: generation.effectCommands,
    });

    expect(generation.unresolved).toEqual([]);
    expect(generation.effectCommands).toHaveLength(5);
    expect(
      generation.effectCommands.map(command => ({
        passiveSkillId: command.sourceIdentity.passiveSkillId,
        effectElementId: command.sourceIdentity.effectElementId,
        targetKind: command.targetKind,
        targetId: command.targetId,
      }))
    ).toEqual([
      {
        passiveSkillId: 520086,
        effectElementId: 520086000,
        targetKind: 'kibo',
        targetId: 'actor-night-vision',
      },
      {
        passiveSkillId: 520067,
        effectElementId: 520067000,
        targetKind: 'kibo',
        targetId: 'actor-rock-skin',
      },
      {
        passiveSkillId: 520067,
        effectElementId: 520067004,
        targetKind: 'kibo',
        targetId: 'actor-rock-skin',
      },
      {
        passiveSkillId: 520067,
        effectElementId: 520067005,
        targetKind: 'kibo',
        targetId: 'actor-rock-skin',
      },
      {
        passiveSkillId: 520026,
        effectElementId: 520026004,
        targetKind: 'kibo',
        targetId: 'actor-small-body',
      },
    ]);
    expect(
      generation.effectCommands.flatMap(command => [
        command.sourceIdentity.effectElementId,
        ...command.modifiers.map(modifier => modifier.sourceElementId),
      ])
    ).not.toEqual(
      expect.arrayContaining([
        520026001, 520026002, 520026003, 520026006, 520067001, 520086001,
      ])
    );
    expect(
      resolveActiveEffectsAt(timeline, 6000, {
        calculatorOnly: true,
      })
    ).toHaveLength(5);
  });

  it('duplicates a shared source element only across its verified Self and PetOwner targets', () => {
    const scenario = {
      actors: [
        {
          id: 'actor-dual-target',
          name: '茂盛花木搭档',
          loadout: { kiboId: 500209 },
        },
      ],
      actions: [],
      enemy: { id: 'enemy-dual-target' },
      time: { durationMs: 5000, fps: 60 },
    };
    const generation = createVerifiedKiboPassiveGeneration({ scenario });
    const timeline = createEffectRuntimeTimeline({
      scenario,
      generatedCommands: generation.effectCommands,
    });

    expect(generation.unresolved).toEqual([]);
    expect(
      generation.effectCommands.filter(
        command => command.effectId === 'kibo-passive:520062:520062001'
      )
    ).toEqual([
      expect.objectContaining({
        targetKind: 'kibo',
        targetId: 'actor-dual-target',
        sourceIdentity: expect.objectContaining({
          directInjectTargetType: 0,
          directInjectTargetName: 'Self',
        }),
      }),
      expect.objectContaining({
        targetKind: 'actor',
        targetId: 'actor-dual-target',
        sourceIdentity: expect.objectContaining({
          directInjectTargetType: 7,
          directInjectTargetName: 'PetOwner',
        }),
      }),
    ]);
    expect(
      resolveActiveEffectsAt(timeline, 5000, {
        targetId: 'actor-dual-target',
        calculatorOnly: true,
      }).map(effect => effect.targetKind)
    ).toEqual(['actor', 'kibo']);
  });

  it('projects PlayerAllEntity movement to every local actor and equipped kibo without stacking duplicate sources', () => {
    const scenario = createPlayerTeamPassiveScenario({
      loadoutByCharacterId: {
        109001: 500126,
        101003: 500127,
        101007: 500001,
      },
    });
    const actorIdByCharacterId = new Map(
      scenario.actors.map(actor => [
        Number(actor.characterId),
        String(actor.id),
      ])
    );
    const generation = createVerifiedKiboPassiveGeneration({ scenario });
    const movementCommands = generation.effectCommands.filter(
      command => command.sourceIdentity?.passiveSkillId === 520054
    );
    const timeline = createEffectRuntimeTimeline({
      scenario,
      generatedCommands: generation.effectCommands,
    });
    const activeMovementEffects = resolveActiveEffectsAt(timeline, 5000, {
      calculatorOnly: true,
    }).filter(effect => effect.effectId === 'kibo-passive:520054:520054001');

    expect(generation.unresolved).toEqual([]);
    expect(movementCommands).toHaveLength(12);
    expect(
      new Set(
        movementCommands.map(
          command => `${command.targetKind}:${command.targetId}`
        )
      )
    ).toEqual(
      new Set(
        scenario.actors.flatMap(actor => [
          `actor:${actor.id}`,
          `kibo:${actor.id}`,
        ])
      )
    );
    expect(
      new Set(movementCommands.map(command => command.sourceActorId))
    ).toEqual(
      new Set([
        actorIdByCharacterId.get(109001),
        actorIdByCharacterId.get(101003),
      ])
    );
    expect(
      movementCommands.find(
        command => command.sourceActorId === actorIdByCharacterId.get(101003)
      )
    ).toMatchObject({
      sourceSlotId: 'team-slot-2',
      sourcePosition: 1,
      sourceIdentity: {
        directInjectTargetType: 15,
        directInjectTargetName: 'Player',
        teamElementTag: 1000,
        teamElementTagName: 'PlayerAllEntity',
        projectionScope: 'local-player-all-entities',
      },
    });
    expect(
      movementCommands.every(command =>
        command.modifiers.some(
          modifier =>
            modifier.attributeId === 45 &&
            modifier.bucket === 'dynamicExtra' &&
            modifier.valueRaw === 500 &&
            modifier.sourceElementId === 520054001
        )
      )
    ).toBe(true);
    expect(
      movementCommands.flatMap(command => [
        command.sourceIdentity.effectElementId,
        ...command.modifiers.map(modifier => modifier.sourceElementId),
      ])
    ).not.toContain(520054002);
    expect(activeMovementEffects).toHaveLength(6);
    expect(
      activeMovementEffects.every(
        effect =>
          effect.stacks === 1 &&
          effect.modifiers.length === 1 &&
          effect.modifiers[0].valueRaw === 500
      )
    ).toBe(true);

    const withoutSource = createPlayerTeamPassiveScenario({
      loadoutByCharacterId: {
        109001: 500129,
        101003: 500001,
        101007: null,
      },
    });
    expect(
      createVerifiedKiboPassiveGeneration({
        scenario: withoutSource,
      }).effectCommands.filter(
        command => command.sourceIdentity?.passiveSkillId === 520054
      )
    ).toEqual([]);

    const sparseTeam = createPlayerTeamPassiveScenario({
      loadoutByCharacterId: {
        109001: 500126,
        101003: 500001,
        101007: null,
      },
    });
    const sparseMovementCommands = createVerifiedKiboPassiveGeneration({
      scenario: sparseTeam,
    }).effectCommands.filter(
      command => command.sourceIdentity?.passiveSkillId === 520054
    );
    expect(
      sparseMovementCommands.map(
        command => `${command.targetKind}:${command.targetId}`
      )
    ).toEqual(
      sparseTeam.actors.flatMap(actor => [
        `actor:${actor.id}`,
        ...(actor.loadout.kiboId ? [`kibo:${actor.id}`] : []),
      ])
    );
  });

  it('rebinds the Thunder condition to each PlayerAllEntity copy and feeds attribute 58 into damage', () => {
    const scenario = createPlayerTeamPassiveScenario({
      secondaryCharacterId: 103002,
      includeThunderAction: true,
      loadoutByCharacterId: {
        109001: 500129,
        103002: 500001,
        101007: 500173,
      },
    });
    const actorByCharacterId = new Map(
      scenario.actors.map(actor => [Number(actor.characterId), actor])
    );
    const thunderActor = actorByCharacterId.get(109001);
    const displayOnlyThunderActor = actorByCharacterId.get(103002);
    const backgroundSourceActor = actorByCharacterId.get(101007);
    const action = scenario.actions[0];
    const resolution = resolveVerifiedCombatActionMechanics(action, {
      combatScenario: scenario.combatScenario,
    });
    const actionResolutionById = new Map([[action.id, resolution]]);
    const actionRuleDiagnostics = createActionRuleDiagnostics({ scenario });
    const actionExecutionPlan = createActionExecutionPlan({
      scenario,
      actionRuleDiagnostics,
    });
    const controlledActorTimeline = createControlledActorTimeline({
      scenario,
      actionExecutionPlan,
    });
    const generation = createVerifiedKiboPassiveGeneration({
      scenario,
      actionExecutionPlan,
      actionResolutionById,
    });
    const thunderCommands = generation.effectCommands.filter(
      command => command.sourceIdentity?.passiveSkillId === 520070
    );
    const effectTimeline = createEffectRuntimeTimeline({
      scenario,
      actionExecutionPlan,
      generatedCommands: generation.effectCommands,
    });
    const withPassive = createVerifiedCombatRuntime({
      scenario,
      actionExecutionPlan,
      controlledActorTimeline,
      effectTimeline,
    });
    const withoutPassive = createVerifiedCombatRuntime({
      scenario,
      actionExecutionPlan,
      controlledActorTimeline,
      effectTimeline: createEffectRuntimeTimeline({
        scenario,
        actionExecutionPlan,
      }),
    });
    const activeThunderEffects = resolveActiveEffectsAt(effectTimeline, 5000, {
      calculatorOnly: true,
    }).filter(effect => effect.effectId === 'kibo-passive:520070:520070002');
    const thunderPropertyTrace = withPassive.damageEvents
      .filter(event => event.actionId === action.id)
      .flatMap(event => event.payload.dynamicPropertyTrace.source)
      .find(trace => trace.attributeId === 58);

    expect(resolution.ready).toBe(true);
    expect(actionExecutionPlan.actions[0].execute).toBe(true);
    expect(generation.unresolved).toEqual([]);
    expect(displayOnlyThunderActor.source.character.element.abbrName).toContain(
      '雷'
    );
    expect(displayOnlyThunderActor.elementId).toBe(1);
    expect(
      thunderCommands.map(
        command => `${command.targetKind}:${command.targetId}`
      )
    ).toEqual([
      `actor:${thunderActor.id}`,
      `kibo:${thunderActor.id}`,
      `kibo:${backgroundSourceActor.id}`,
    ]);
    expect(thunderCommands[0]).toMatchObject({
      sourceActorId: String(backgroundSourceActor.id),
      sourceKiboId: 500173,
      sourceSlotId: 'team-slot-3',
      sourcePosition: 2,
      modifiers: [
        expect.objectContaining({
          attributeId: 58,
          bucket: 'dynamicExtra',
          valueRaw: 1300,
          sourceElementId: 520070002,
        }),
      ],
      sourceIdentity: {
        directInjectTargetType: 15,
        directInjectTargetName: 'Player',
        teamElementTag: 1000,
        elementalTypeMask: 128,
        condition: expect.objectContaining({
          checkType: 0,
          targetType: 1,
          elementalTypeMask: 128,
        }),
      },
    });
    expect(
      thunderCommands.flatMap(command => [
        command.sourceIdentity.effectElementId,
        ...command.modifiers.map(modifier => modifier.sourceElementId),
      ])
    ).not.toContain(520070001);
    expect(
      generation.conditionSuppressions
        .filter(row => row.skillId === 520070)
        .map(row => ({
          targetKind: row.targetKind,
          targetId: row.targetId,
          actualElementalTypeMask: row.actualElementalTypeMask,
          reason: row.reason,
        }))
    ).toEqual([
      {
        targetKind: 'actor',
        targetId: String(displayOnlyThunderActor.id),
        actualElementalTypeMask: 2,
        reason: 'entity-elemental-type-mask-not-matched',
      },
      {
        targetKind: 'kibo',
        targetId: String(displayOnlyThunderActor.id),
        actualElementalTypeMask: 4,
        reason: 'entity-elemental-type-mask-not-matched',
      },
      {
        targetKind: 'actor',
        targetId: String(backgroundSourceActor.id),
        actualElementalTypeMask: 2,
        reason: 'entity-elemental-type-mask-not-matched',
      },
    ]);
    expect(activeThunderEffects).toHaveLength(3);
    expect(
      activeThunderEffects.every(
        effect =>
          effect.stacks === 1 &&
          effect.modifiers[0].attributeId === 58 &&
          effect.modifiers[0].valueRaw === 1300
      )
    ).toBe(true);
    expect(thunderPropertyTrace).toMatchObject({
      attributeId: 58,
      dynamicExtraRaw: 1300,
    });
    expect(sumDamage(withPassive, action.id)).toBeGreaterThan(
      sumDamage(withoutPassive, action.id)
    );

    const missingKiboReference = structuredClone(scenario);
    const missingReferenceActor =
      missingKiboReference.mechanismConfiguration.actors.find(
        actor => String(actor.actorId) === String(thunderActor.id)
      );
    missingReferenceActor.loadout.gameDataReferences.kibo.record = null;
    const unresolvedProjection = createVerifiedKiboPassiveGeneration({
      scenario: missingKiboReference,
      actionExecutionPlan,
      actionResolutionById,
    });
    expect(unresolvedProjection.unresolved).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceActorId: String(backgroundSourceActor.id),
          kiboId: 500173,
          skillId: 520070,
          targetKind: 'kibo',
          targetId: String(thunderActor.id),
          reasons: ['player-team-target-elemental-type-unresolved'],
          evidence: expect.objectContaining({
            elementalTypeResolution: expect.objectContaining({
              reason: 'equipped-kibo-game-data-reference-missing-or-mismatched',
              expectedKiboId: 500129,
            }),
          }),
        }),
      ])
    );
    expect(
      unresolvedProjection.effectCommands.some(
        command =>
          command.sourceIdentity?.passiveSkillId === 520070 &&
          command.targetKind === 'kibo' &&
          command.targetId === String(thunderActor.id)
      )
    ).toBe(false);
  });
});

function createPlayerTeamPassiveScenario({
  loadoutByCharacterId,
  secondaryCharacterId = 101003,
  includeThunderAction = false,
}) {
  const selection = {
    ...DEFAULT_WORKBENCH_SELECTION,
    secondaryCharacterId,
  };
  const teamSlots = createDefaultWorkbenchTeamSlots(selection);
  const actorConfigs = createDefaultWorkbenchActorConfigs(selection).map(
    config => ({
      ...config,
      loadout: {
        ...config.loadout,
        kiboId:
          loadoutByCharacterId[Number(config.characterId)] ??
          loadoutByCharacterId[String(config.characterId)] ??
          null,
      },
    })
  );
  const actions = includeThunderAction
    ? [
        createWorkbenchActionDraft({
          id: 'player-team-thunder-actor-action',
          type: 'skill',
          actorCharacterId: 109001,
          skillId: 10900101,
          actionVariantIndex: 0,
          startMs: 0,
          durationMs: (MUYIN_FIRST_ATTACK_INPUT.durationFrames / 60) * 1000,
          durationFrames: MUYIN_FIRST_ATTACK_INPUT.durationFrames,
          attackGroupId: 'player-team-thunder-normal-chain',
          attackSequenceIndex: MUYIN_FIRST_ATTACK_INPUT.sequenceIndex,
          attackSequenceTotal: MUYIN_FIRST_ATTACK_INPUT.sequenceTotal,
          attackInput: MUYIN_FIRST_ATTACK_INPUT,
          actionScheduling: MUYIN_FIRST_ATTACK_INPUT.actionScheduling,
        }),
      ]
    : [];
  const project = createWorkbenchProject(selection, {
    durationMs: 5000,
    teamSlots,
    actorConfigs,
    actions,
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  return compileProject(project, getWorkbenchGameData());
}

function createSwiftWolfScenario() {
  const teamSlots = createDefaultWorkbenchTeamSlots();
  const actorConfigs = createDefaultWorkbenchActorConfigs(
    DEFAULT_WORKBENCH_SELECTION
  ).map(config =>
    Number(config.characterId) === OWNER_CHARACTER_ID
      ? {
          ...config,
          loadout: {
            ...config.loadout,
            kiboId: KIBO_ID,
          },
        }
      : config
  );
  const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
    durationMs: 4000,
    teamSlots,
    actorConfigs,
    actions: [
      createWorkbenchActionDraft({
        id: 'swift-wolf-signature',
        type: 'kiboEvent',
        actorCharacterId: OWNER_CHARACTER_ID,
        skillId: SIGNATURE_SKILL_ID,
        kiboId: KIBO_ID,
        actionVariantIndex: 0,
        startMs: 0,
        durationMs: 2000,
        eventType: 'signature',
      }),
    ],
    initialRuntimeState: {
      kiboEnergyBySlot: [
        {
          slotId: 'team-slot-3',
          kiboId: KIBO_ID,
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

function createActualKiboScenario({
  kiboId,
  skillId,
  actionId,
  eventType,
  durationMs = 12000,
}) {
  const teamSlots = createDefaultWorkbenchTeamSlots();
  const actorConfigs = createDefaultWorkbenchActorConfigs(
    DEFAULT_WORKBENCH_SELECTION
  ).map(config =>
    Number(config.characterId) === OWNER_CHARACTER_ID
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
    durationMs,
    teamSlots,
    actorConfigs,
    actions: [
      createWorkbenchActionDraft({
        id: actionId,
        type: 'kiboEvent',
        actorCharacterId: OWNER_CHARACTER_ID,
        skillId,
        kiboId,
        actionVariantIndex: 0,
        startMs: 0,
        durationMs: 2000,
        eventType,
      }),
    ],
    initialRuntimeState: {
      kiboEnergyBySlot: [
        {
          slotId: 'team-slot-3',
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

function createActorSkillWithKiboScenario(kiboId) {
  const teamSlots = createDefaultWorkbenchTeamSlots();
  const actorConfigs = createDefaultWorkbenchActorConfigs(
    DEFAULT_WORKBENCH_SELECTION
  ).map(config =>
    Number(config.characterId) ===
    Number(DEFAULT_WORKBENCH_SELECTION.characterId)
      ? {
          ...config,
          initialSp: 0,
          loadout: {
            ...config.loadout,
            kiboId,
          },
        }
      : config
  );
  const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
    durationMs: 4000,
    teamSlots,
    actorConfigs,
    actions: [
      createWorkbenchActionDraft({
        id: 'pet-owner-sp-action',
        type: 'skill',
        actorCharacterId: DEFAULT_WORKBENCH_SELECTION.characterId,
        skillId: DEFAULT_WORKBENCH_SELECTION.skillId,
        startMs: 0,
        durationMs: 1000,
      }),
    ],
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  return compileProject(project, getWorkbenchGameData());
}

function sumDamage(runtime, actionId) {
  return runtime.damageEvents
    .filter(event => event.actionId === actionId)
    .reduce((sum, event) => sum + Number(event.payload.rawDamage ?? 0), 0);
}
