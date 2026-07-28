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
import {
  createEffectRuntimeTimeline,
  resolveActiveEffectsAt,
} from '../../simulation/runtime/effectRuntimeTimeline';

const OWNER_CHARACTER_ID = 101007;
const FIRE_KIBO_ID = 500039;
const FIRE_KIBO_SKILL_ID = 50003901;

beforeEach(() => {
  installVerifiedCombatMechanicsPackage(verifiedCombatMechanicsPackage);
});

afterEach(() => {
  clearInstalledVerifiedCombatMechanicsPackage();
});

describe('verified Battle effect generation', () => {
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
    expect(integrated.effectTimeline.summary).toMatchObject({
      calculatorAppliedEffectCount: 8,
    });
    expect(
      sumDamage(integrated.verifiedCombatRuntime, 'fire-kibo-signature')
    ).toBe(appliedDamage);
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
    });

    expect(generation.unresolved.map(effect => effect.effectIdentity)).toEqual([
      'effect-before-interrupt',
    ]);
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

function sumDamage(runtime, actionId) {
  return runtime.damageEvents
    .filter(event => event.actionId === actionId)
    .reduce((sum, event) => sum + Number(event.payload.rawDamage ?? 0), 0);
}
