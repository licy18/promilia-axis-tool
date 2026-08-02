import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import soulEssenceEffectCatalog from '../../data/generated/soulessence-effect-mechanics.json';
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
import { createVerifiedSoulEssenceEffectGeneration } from '../../simulation/mechanics/verifiedSoulEssenceEffectGeneration';
import {
  createEffectRuntimeTimeline,
  resolveActiveEffectsAt,
} from '../../simulation/runtime/effectRuntimeTimeline';

const SOUL_ID = 10001;
const SOUL_SKILL_ID = 1900480;
const OWNER_ID = 101007;

const APPLIED_SOUL_EFFECT_MATRIX = [
  {
    soulEssenceId: 10001,
    event: 'AfterSkill',
    frameAnchor: 'action-end',
    actionKind: 'charged-attack',
    durationMs: 5000,
    stackMode: 'stack',
    maxStacks: 4,
    attributeId: 222,
  },
  {
    soulEssenceId: 10002,
    event: 'BeforeSkill',
    frameAnchor: 'action-start',
    actionKind: 'star-skill',
    durationMs: 12000,
    stackMode: 'refresh',
    maxStacks: 1,
    attributeId: 53,
  },
  {
    soulEssenceId: 10037,
    event: 'BeforeSkill',
    frameAnchor: 'action-start',
    actionKind: 'star-skill',
    durationMs: 11000,
    stackMode: 'stack',
    maxStacks: 3,
    attributeId: 229,
  },
  {
    soulEssenceId: 10060,
    event: 'AfterSkill',
    frameAnchor: 'action-end',
    actionKind: 'star-skill',
    durationMs: 24000,
    stackMode: 'refresh',
    maxStacks: 1,
    attributeId: 21,
  },
  {
    soulEssenceId: 10094,
    event: 'AfterSkill',
    frameAnchor: 'action-end',
    actionKind: 'star-skill',
    durationMs: 15000,
    stackMode: 'refresh',
    maxStacks: 1,
    attributeId: 21,
  },
  {
    soulEssenceId: 10125,
    event: 'BeforeSkill',
    frameAnchor: 'action-start',
    actionKind: 'normal-attack',
    durationMs: 5000,
    stackMode: 'stack',
    maxStacks: 15,
    attributeId: 52,
  },
  {
    soulEssenceId: 10154,
    event: 'AfterSkill',
    frameAnchor: 'action-end',
    actionKind: 'normal-attack',
    durationMs: 15000,
    stackMode: 'stack',
    maxStacks: 5,
    attributeId: 229,
  },
  {
    soulEssenceId: 10155,
    event: 'AfterSkill',
    frameAnchor: 'action-end',
    actionKind: 'normal-attack',
    durationMs: 15000,
    stackMode: 'stack',
    maxStacks: 5,
    attributeId: 52,
  },
];

beforeEach(() => {
  installVerifiedCombatMechanicsPackage(verifiedCombatMechanicsPackage);
});

afterEach(() => {
  clearInstalledVerifiedCombatMechanicsPackage();
});

describe('verified soul essence effect generation', () => {
  it('publishes a complete 62-control source census and keeps unsupported formulas unresolved', () => {
    expect(soulEssenceEffectCatalog.summary).toMatchObject({
      soulEssenceCount: 62,
      controlClosureCount: 62,
      resourceReferenceCount: 282,
      missingResourceReferenceCount: 0,
      runtimeAppliedCount: 9,
      unresolvedCount: 53,
    });
    expect(
      soulEssenceEffectCatalog.definitions.every(
        definition => definition.sourceClosure.controlSourceIdentity
      )
    ).toBe(true);
    expect(
      soulEssenceEffectCatalog.definitions.find(
        definition => definition.soulEssenceId === 10097
      )
    ).toMatchObject({
      runtimeStatus: 'source-indexed-runtime-unapplied',
      runtimeGaps: expect.arrayContaining([
        'effect-formula-family-operator-unsupported',
      ]),
    });
  });

  it('binds the real 10098 AfterDamage charged-hit stacking contract', () => {
    expect(
      soulEssenceEffectCatalog.definitions.find(
        definition => definition.soulEssenceId === 10098
      )
    ).toMatchObject({
      name: '此身为枪',
      effectSkillId: 1900670,
      runtimeStatus: 'runtime-applied',
      mechanismFamily: 'equipped-actor-skill-tag-property-after-damage',
      trigger: {
        elementId: 19006701,
        eventId: 2,
        event: 'AfterDamage',
        frameAnchor: 'hit-after-damage',
        condition: {
          skillTagId: 2,
          actionKinds: ['charged-attack'],
        },
      },
      effect: {
        elementId: 19006702,
        attributeId: 21,
        durationMs: 4000,
        stackMode: 'stack',
        maxStacks: 6,
        valuesByStar: expect.arrayContaining([
          expect.objectContaining({ star: 1, valueRaw: 190 }),
          expect.objectContaining({ star: 4, valueRaw: 380 }),
        ]),
      },
      activationPrerequisites: [],
      runtimeGaps: [],
    });
  });

  it('keeps 10018 blocked by its outer tuning-mark activation condition', () => {
    expect(
      soulEssenceEffectCatalog.definitions.find(
        definition => definition.soulEssenceId === 10018
      )
    ).toMatchObject({
      runtimeStatus: 'source-indexed-runtime-unapplied',
      activationPrerequisites: [
        expect.objectContaining({
          elementId: 19004001,
          triggerType: 0,
          conditions: [
            expect.objectContaining({
              conditionType: 10000,
              conditionValue: 1007,
            }),
          ],
        }),
      ],
      runtimeGaps: expect.arrayContaining([
        'effect-activation-condition-operator-unsupported',
      ]),
    });
  });

  it('binds the real 10001 AfterSkill charged-attack property contract', () => {
    const definition = soulEssenceEffectCatalog.definitions.find(
      entry => entry.soulEssenceId === SOUL_ID
    );

    expect(definition).toMatchObject({
      effectSkillId: SOUL_SKILL_ID,
      runtimeStatus: 'runtime-applied',
      mechanismFamily: 'equipped-actor-skill-tag-property-after-skill',
      trigger: {
        elementId: 19004801,
        event: 'AfterSkill',
        frameAnchor: 'action-end',
        condition: {
          kind: 'skill-tag',
          skillTagId: 2,
          actionKinds: ['charged-attack'],
        },
      },
      effect: {
        elementId: 19004802,
        attributeId: 222,
        bucket: 'dynamicExtra',
        durationMs: 5000,
        stackMode: 'stack',
        stackDelta: 1,
        maxStacks: 4,
        formula: {
          commonFunctionId: 1,
          baseFunctionId: 5,
          commonRatioRaw: 10000,
        },
        valuesByStar: [
          expect.objectContaining({ star: 1, valueRaw: 1120 }),
          expect.objectContaining({ star: 2, valueRaw: 1490 }),
          expect.objectContaining({ star: 3, valueRaw: 1860 }),
          expect.objectContaining({ star: 4, valueRaw: 2230 }),
        ],
      },
      runtimeGaps: [],
    });
  });

  it('covers every runtime-integrated soul through one data-driven trigger contract', () => {
    const appliedDefinitions = soulEssenceEffectCatalog.definitions.filter(
      definition => definition.runtimeStatus === 'runtime-applied'
    );

    expect(appliedDefinitions.map(definition => definition.soulEssenceId)).toEqual(
      [...APPLIED_SOUL_EFFECT_MATRIX.map(row => row.soulEssenceId), 10098].sort(
        (left, right) => left - right
      )
    );
    for (const expected of APPLIED_SOUL_EFFECT_MATRIX) {
      expect(
        appliedDefinitions.find(
          definition => definition.soulEssenceId === expected.soulEssenceId
        )
      ).toMatchObject({
        trigger: {
          event: expected.event,
          frameAnchor: expected.frameAnchor,
          condition: { actionKinds: [expected.actionKind] },
        },
        effect: {
          durationMs: expected.durationMs,
          stackMode: expected.stackMode,
          maxStacks: expected.maxStacks,
          attributeId: expected.attributeId,
        },
      });
    }
  });

  it.each(APPLIED_SOUL_EFFECT_MATRIX)(
    'applies, suppresses, stacks or refreshes, and expires soul $soulEssenceId',
    expected => {
      const definition = soulEssenceEffectCatalog.definitions.find(
        entry => entry.soulEssenceId === expected.soulEssenceId
      );
      const actorId = `actor-soul-${expected.soulEssenceId}`;
      const wrongActionKind =
        expected.actionKind === 'normal-attack'
          ? 'charged-attack'
          : 'normal-attack';
      const actions = [
        {
          id: 'allowed-1',
          actorId,
          actionKind: expected.actionKind,
          startMs: 100,
          durationMs: 400,
        },
        {
          id: 'wrong-kind',
          actorId,
          actionKind: wrongActionKind,
          startMs: 700,
          durationMs: 300,
        },
        {
          id: 'allowed-2',
          actorId,
          actionKind: expected.actionKind,
          startMs: 1000,
          durationMs: 400,
        },
      ];
      const scenario = {
        time: { fps: 60, durationMs: 30_000 },
        actors: [createSoulMatrixActor({ actorId, definition })],
        actions,
      };
      const actionExecutionPlan = {
        actions: actions.map(action => ({ actionId: action.id, execute: true })),
      };
      const actionResolutionById = new Map(
        actions.map(action => [
          action.id,
          { actionBinding: { actionKind: action.actionKind } },
        ])
      );
      const generation = createVerifiedSoulEssenceEffectGeneration({
        scenario,
        actionExecutionPlan,
        actionResolutionById,
      });
      const timeline = createEffectRuntimeTimeline({
        scenario,
        actionExecutionPlan,
        generatedCommands: generation.effectCommands,
      });
      const expectedCommandTimes =
        expected.frameAnchor === 'action-end' ? [500, 1400] : [100, 1000];

      expect(generation.effectCommands.map(command => command.timeMs)).toEqual(
        expectedCommandTimes
      );
      expect(generation.suppressions).toEqual([
        expect.objectContaining({
          actionId: 'wrong-kind',
          reason: 'soulessence-effect-action-kind-condition-not-matched',
        }),
      ]);
      const afterSecondTrigger = resolveActiveEffectsAt(
        timeline,
        expectedCommandTimes[1],
        {
          targetKind: 'actor',
          targetId: actorId,
          calculatorOnly: true,
        }
      );
      expect(afterSecondTrigger).toHaveLength(1);
      expect(afterSecondTrigger[0]).toMatchObject({
        stacks: expected.stackMode === 'stack' ? 2 : 1,
        expiresAtMs: expectedCommandTimes[1] + expected.durationMs,
      });
      expect(
        resolveActiveEffectsAt(
          timeline,
          expectedCommandTimes[1] + expected.durationMs - 1,
          { targetKind: 'actor', targetId: actorId, calculatorOnly: true }
        )
      ).toHaveLength(1);
      expect(
        resolveActiveEffectsAt(
          timeline,
          expectedCommandTimes[1] + expected.durationMs,
          { targetKind: 'actor', targetId: actorId, calculatorOnly: true }
        )
      ).toEqual([]);

      const sameActionBoundary = resolveActiveEffectsAt(
        timeline,
        expectedCommandTimes[0],
        {
          targetKind: 'actor',
          targetId: actorId,
          calculatorOnly: true,
          settlingActionId: 'allowed-1',
        }
      );
      expect(sameActionBoundary).toHaveLength(
        expected.event === 'AfterSkill' ? 0 : 1
      );
      expect(
        resolveActiveEffectsAt(timeline, expectedCommandTimes[0], {
          targetKind: 'actor',
          targetId: actorId,
          calculatorOnly: true,
          settlingActionId: 'following-action',
        })
      ).toHaveLength(1);
    }
  );

  it('uses one generic operator for a synthetic owner and stacks at actual action ends', () => {
    const catalog = createSyntheticCatalog();
    const actions = Array.from({ length: 5 }, (_, index) => ({
      id: `synthetic-heavy-${index + 1}`,
      actorId: 'actor-synthetic',
      name: `synthetic-heavy-${index + 1}`,
      actionKind: 'charged-attack',
      startMs: index * 1000,
      durationMs: 600,
    }));
    const scenario = {
      time: { fps: 60, durationMs: 12_000 },
      actors: [
        {
          id: 'actor-synthetic',
          name: 'synthetic-owner',
          loadout: {
            soulessenceId: 999001,
            soulessenceStar: 2,
            soulessenceCultivation: {
              effectSkill: {
                skillId: 999010,
                star: 2,
                skillLevel: 2,
                runtimeStatus: 'runtime-applied',
              },
            },
          },
        },
      ],
      actions: [
        ...actions,
        {
          id: 'synthetic-normal',
          actorId: 'actor-synthetic',
          name: 'synthetic-normal',
          actionKind: 'normal-attack',
          startMs: 7000,
          durationMs: 500,
        },
      ],
    };
    const actionExecutionPlan = {
      actions: scenario.actions.map(action => ({
        actionId: action.id,
        execute: true,
      })),
    };
    const actionResolutionById = new Map(
      scenario.actions.map(action => [
        action.id,
        { actionBinding: { actionKind: action.actionKind } },
      ])
    );
    const generation = createVerifiedSoulEssenceEffectGeneration({
      scenario,
      actionExecutionPlan,
      actionResolutionById,
      catalog,
    });
    const timeline = createEffectRuntimeTimeline({
      scenario,
      actionExecutionPlan,
      generatedCommands: generation.effectCommands,
    });

    expect(generation.effectCommands).toHaveLength(5);
    expect(generation.effectCommands.map(command => command.timeMs)).toEqual([
      600, 1600, 2600, 3600, 4600,
    ]);
    expect(generation.suppressions).toEqual([
      expect.objectContaining({
        actionId: 'synthetic-normal',
        reason: 'soulessence-effect-action-kind-condition-not-matched',
      }),
    ]);
    expect(
      resolveActiveEffectsAt(timeline, 3600, {
        targetKind: 'actor',
        targetId: 'actor-synthetic',
        calculatorOnly: true,
      })[0]
    ).toMatchObject({
      stacks: 4,
      maxStacks: 4,
      modifiers: [
        expect.objectContaining({
          attributeId: 222,
          bucket: 'dynamicExtra',
          valueRaw: 222,
        }),
      ],
    });
    expect(
      resolveActiveEffectsAt(timeline, 4600, {
        targetKind: 'actor',
        targetId: 'actor-synthetic',
        calculatorOnly: true,
      })[0]
    ).toMatchObject({ stacks: 4, expiresAtMs: 9600 });
  });

  it('applies a hit-triggered effect after each landed hit without buffing that same hit', () => {
    const catalog = createSyntheticHitCatalog();
    const action = {
      id: 'synthetic-multi-hit',
      actorId: 'actor-synthetic',
      name: 'synthetic-multi-hit',
      actionKind: 'charged-attack',
      sourceSequenceIndex: 0,
      sourceSequencePath: [0],
      startMs: 100,
      durationMs: 600,
    };
    const wrongAction = {
      ...action,
      id: 'synthetic-wrong-kind',
      actionKind: 'normal-attack',
      sourceSequenceIndex: 1,
      sourceSequencePath: [1],
      startMs: 1000,
    };
    const missedAction = {
      ...action,
      id: 'synthetic-missed-hit',
      sourceSequenceIndex: 2,
      sourceSequencePath: [2],
      startMs: 2000,
    };
    const overriddenMissAction = {
      ...action,
      id: 'synthetic-overridden-miss',
      sourceSequenceIndex: 3,
      sourceSequencePath: [3],
      startMs: 3000,
      hitOverrides: {
        'synthetic:hit:1': { willHit: false },
        'synthetic:hit:2': { willHit: false },
      },
    };
    const resolution = {
      actionBinding: {
        identity: 'synthetic:charged-binding',
        actionKind: 'charged-attack',
      },
      controlBinding: { frameRate: 60 },
      hits: [
        {
          hitIndex: 1,
          elementId: 999101,
          sourceIdentity: 'synthetic:hit:1',
          trigger: { startFrame: 5 },
        },
        {
          hitIndex: 2,
          elementId: 999102,
          sourceIdentity: 'synthetic:hit:2',
          trigger: { startFrame: 5 },
        },
      ],
    };
    const scenario = {
      time: { fps: 60, durationMs: 10_000 },
      actors: [
        createSoulMatrixActor({
          actorId: 'actor-synthetic',
          definition: catalog.definitions[0],
        }),
      ],
      actions: [action, wrongAction, missedAction, overriddenMissAction],
    };
    const actionExecutionPlan = {
      actions: scenario.actions.map(entry => ({
        actionId: entry.id,
        execute: true,
      })),
    };
    const generation = createVerifiedSoulEssenceEffectGeneration({
      scenario,
      actionExecutionPlan,
      actionResolutionById: new Map([
        [action.id, resolution],
        [
          wrongAction.id,
          {
            ...resolution,
            actionBinding: {
              ...resolution.actionBinding,
              actionKind: 'normal-attack',
            },
          },
        ],
        [missedAction.id, { ...resolution, hits: [] }],
        [overriddenMissAction.id, resolution],
      ]),
      catalog,
    });
    const timeline = createEffectRuntimeTimeline({
      scenario,
      actionExecutionPlan,
      generatedCommands: generation.effectCommands,
    });
    const hitTimeMs = 183.333333;

    expect(generation.effectCommands).toHaveLength(2);
    expect(generation.suppressions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: wrongAction.id,
          reason: 'soulessence-effect-action-kind-condition-not-matched',
        }),
        expect.objectContaining({
          actionId: missedAction.id,
          reason: 'soulessence-effect-no-landed-source-hit',
        }),
        expect.objectContaining({
          actionId: overriddenMissAction.id,
          reason: 'soulessence-effect-no-landed-source-hit',
        }),
      ])
    );
    expect(generation.effectCommands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
        timeMs: hitTimeMs,
        sourceHitIdentity: 'synthetic:hit:1',
        sourceHitIndex: 1,
        }),
        expect.objectContaining({
        timeMs: hitTimeMs,
        sourceHitIdentity: 'synthetic:hit:2',
        sourceHitIndex: 2,
        }),
      ])
    );
    expect(
      resolveActiveEffectsAt(timeline, hitTimeMs, {
        targetKind: 'actor',
        targetId: 'actor-synthetic',
        calculatorOnly: true,
        settlingSourceSequencePath: [0, 1],
      })
    ).toEqual([]);
    expect(
      resolveActiveEffectsAt(timeline, hitTimeMs, {
        targetKind: 'actor',
        targetId: 'actor-synthetic',
        calculatorOnly: true,
        settlingSourceSequencePath: [0, 2],
      })[0]
    ).toMatchObject({ stacks: 1 });
    expect(
      resolveActiveEffectsAt(timeline, hitTimeMs, {
        targetKind: 'actor',
        targetId: 'actor-synthetic',
        calculatorOnly: true,
      })[0]
    ).toMatchObject({ stacks: 2 });
    expect(
      resolveActiveEffectsAt(timeline, hitTimeMs + 4000, {
        targetKind: 'actor',
        targetId: 'actor-synthetic',
        calculatorOnly: true,
      })
    ).toEqual([]);
  });

  it('inherits hit-triggered stacks across a replay boundary and refreshes from the inherited state', () => {
    const catalog = createSyntheticHitCatalog();
    const definition = catalog.definitions[0];
    const actorId = 'actor-synthetic';
    const action = {
      id: 'cycle-hit-source',
      actorId,
      actionKind: 'charged-attack',
      sourceSequenceIndex: 0,
      sourceSequencePath: [0],
      startMs: 100,
      durationMs: 600,
    };
    const resolution = {
      actionBinding: {
        identity: 'synthetic:cycle-charged-binding',
        actionKind: 'charged-attack',
      },
      controlBinding: { frameRate: 60 },
      hits: [
        {
          hitIndex: 1,
          elementId: 999101,
          sourceIdentity: 'synthetic:cycle-hit:1',
          trigger: { startFrame: 5 },
        },
      ],
    };
    const baseScenario = {
      time: { fps: 60, durationMs: 1000 },
      actors: [createSoulMatrixActor({ actorId, definition })],
      actions: [action],
    };
    const executionPlan = {
      actions: [{ actionId: action.id, execute: true }],
    };
    const generation = createVerifiedSoulEssenceEffectGeneration({
      scenario: baseScenario,
      actionExecutionPlan: executionPlan,
      actionResolutionById: new Map([[action.id, resolution]]),
      catalog,
    });
    const firstTimeline = createEffectRuntimeTimeline({
      scenario: baseScenario,
      actionExecutionPlan: executionPlan,
      generatedCommands: generation.effectCommands,
    });
    const boundaryFrameMs = 1000;
    const boundaryEffect = resolveActiveEffectsAt(
      firstTimeline,
      boundaryFrameMs,
      {
        targetKind: 'actor',
        targetId: actorId,
        calculatorOnly: true,
      }
    )[0];
    const inheritedRemainingMs =
      boundaryEffect.expiresAtMs - boundaryFrameMs;
    const secondScenario = {
      ...baseScenario,
      initialRuntimeState: {
        activeEffects: [
          {
            ...boundaryEffect,
            remainingDurationMs: inheritedRemainingMs,
          },
        ],
      },
    };
    const secondTimeline = createEffectRuntimeTimeline({
      scenario: secondScenario,
      actionExecutionPlan: executionPlan,
      generatedCommands: generation.effectCommands,
    });
    const triggerTimeMs = generation.effectCommands[0].timeMs;

    expect(boundaryEffect).toMatchObject({
      stacks: 1,
      appliedToCalculators: true,
    });
    expect(inheritedRemainingMs).toBeCloseTo(3183.333, 3);
    expect(secondTimeline.events[0]).toMatchObject({
      type: 'EFFECT_INHERITED',
      after: { stacks: 1, appliedToCalculators: true },
    });
    const refreshedEffect = resolveActiveEffectsAt(
      secondTimeline,
      triggerTimeMs,
      {
        targetKind: 'actor',
        targetId: actorId,
        calculatorOnly: true,
      }
    )[0];
    expect(refreshedEffect).toMatchObject({ stacks: 2 });
    expect(refreshedEffect.expiresAtMs).toBeCloseTo(
      triggerTimeMs + 4000,
      3
    );
  });

  it('runs the real source profile through compileProject and canonical simulation', () => {
    const result = createRealSoulScenario();
    const generation = result.verifiedSoulEssenceEffectGeneration;
    const firstCommand = generation.effectCommands.find(
      command => command.sourceActionId === 'pangpang-heavy-1'
    );

    expect(generation.summary).toMatchObject({
      equippedBindingCount: 1,
      effectCommandCount: 2,
      unresolvedCount: 0,
    });
    expect(firstCommand).toMatchObject({
      sourceSoulEssenceId: SOUL_ID,
      timeMs: frameToMs(137),
      durationMs: 5000,
      targetKind: 'actor',
      targetId: 'actor-101007',
      modifiers: [
        expect.objectContaining({
          attributeId: 222,
          bucket: 'dynamicExtra',
          valueRaw: 1120,
        }),
      ],
      sourceIdentity: expect.objectContaining({
        effectSkillId: SOUL_SKILL_ID,
        triggerEvent: 'AfterSkill',
        star: 1,
      }),
    });
    expect(
      result.effectTimeline.events.some(
        event =>
          event.type === 'EFFECT_APPLIED' &&
          event.effectId === 'soulessence:10001:element:19004802'
      )
    ).toBe(true);
    expect(
      result.verifiedCombatRuntime.damageEvents
        .filter(event => event.actionId === 'pangpang-heavy-2')
        .flatMap(event => event.payload.dynamicPropertyTrace?.source ?? [])
        .some(
          trace => trace.attributeId === 222 && trace.dynamicExtraRaw === 1120
        )
    ).toBe(true);
    expect(
      result.verifiedCombatRuntime.damageEvents
        .filter(event => event.actionId === 'pangpang-heavy-1')
        .flatMap(event => event.payload.dynamicPropertyTrace?.source ?? [])
        .some(trace => trace.attributeId === 222)
    ).toBe(false);
    const firstToughnessDamage = result.verifiedCombatRuntime.damageEvents
      .filter(event => event.actionId === 'pangpang-heavy-1')
      .reduce((sum, event) => sum + Number(event.payload.toughnessDamage), 0);
    const secondToughnessDamage = result.verifiedCombatRuntime.damageEvents
      .filter(event => event.actionId === 'pangpang-heavy-2')
      .reduce((sum, event) => sum + Number(event.payload.toughnessDamage), 0);
    expect(secondToughnessDamage).toBeGreaterThan(firstToughnessDamage);
    expect(
      result.verifiedCombatRuntime.damageEvents
        .filter(event => event.actionId === 'pangpang-heavy-2')
        .map(
          event =>
            event.payload.formulaBreakdown?.weaknessInput
              ?.weaknessSkillDamageUp
        )
    ).toEqual(expect.arrayContaining([1.112]));
  });

  it('replays real 10098 hit stacks through canonical damage settlement order', () => {
    const result = createRealSoulScenario({
      soulEssenceId: 10098,
      effectSkillId: 1900670,
    });
    const firstActionHits = result.verifiedCombatRuntime.damageEvents.filter(
      event =>
        event.type === 'VERIFIED_COMBAT_HIT' &&
        event.actionId === 'pangpang-heavy-1'
    );
    const secondActionHits = result.verifiedCombatRuntime.damageEvents.filter(
      event =>
        event.type === 'VERIFIED_COMBAT_HIT' &&
        event.actionId === 'pangpang-heavy-2'
    );
    const damageUpTrace = event =>
      event.payload.dynamicPropertyTrace.source.find(
        trace => trace.attributeId === 21
      );

    expect(firstActionHits).toHaveLength(8);
    expect(secondActionHits).toHaveLength(8);
    expect(damageUpTrace(firstActionHits[0])).toBeUndefined();
    expect(damageUpTrace(firstActionHits[1])).toMatchObject({
      dynamicExtraRaw: 190,
    });
    expect(damageUpTrace(firstActionHits.at(-1))).toMatchObject({
      dynamicExtraRaw: 1140,
    });
    expect(damageUpTrace(secondActionHits[0])).toMatchObject({
      dynamicExtraRaw: 1140,
    });
    expect(
      result.verifiedSoulEssenceEffectGeneration.effectCommands.filter(
        command => command.sourceSoulEssenceId === 10098
      )
    ).toHaveLength(16);
  });

  it('does not bind legacy loadouts that omit the strict runtime contract', () => {
    const definition = soulEssenceEffectCatalog.definitions.find(
      entry => entry.soulEssenceId === SOUL_ID
    );
    const scenario = {
      time: { fps: 60, durationMs: 2000 },
      actors: [
        {
          id: 'actor-legacy',
          loadout: { soulessenceId: SOUL_ID },
        },
      ],
      actions: [
        {
          id: 'legacy-heavy',
          actorId: 'actor-legacy',
          actionKind: 'charged-attack',
          startMs: 0,
          durationMs: 1000,
        },
      ],
    };
    const generation = createVerifiedSoulEssenceEffectGeneration({
      scenario,
      actionExecutionPlan: {
        actions: [{ actionId: 'legacy-heavy', execute: true }],
      },
      actionResolutionById: new Map([
        [
          'legacy-heavy',
          { actionBinding: { actionKind: 'charged-attack' } },
        ],
      ]),
      catalog: {
        ...soulEssenceEffectCatalog,
        definitions: [definition],
      },
    });

    expect(generation.effectCommands).toEqual([]);
    expect(generation.unresolved).toEqual([]);
    expect(generation.summary.equippedBindingCount).toBe(0);
  });
});

function createRealSoulScenario({
  soulEssenceId = SOUL_ID,
  effectSkillId = SOUL_SKILL_ID,
} = {}) {
  const mapping = verifiedCombatMechanicsPackage.actionMappings.find(
    entry =>
      entry.ownerId === OWNER_ID &&
      entry.actionKind === 'charged-attack' &&
      entry.actionVariantIndex === 1
  );
  const durationFrames = mapping.actionTiming.occupancy.durationFrames;
  const durationMs = frameToMs(durationFrames);
  const actorConfigs = createDefaultWorkbenchActorConfigs(
    DEFAULT_WORKBENCH_SELECTION
  ).map(config =>
    Number(config.characterId) === OWNER_ID
      ? {
          ...config,
          loadout: {
            ...config.loadout,
            soulessenceId: soulEssenceId,
            soulessenceLevel: 80,
            soulessenceRank: 1,
            soulessenceStar: 1,
            soulessenceCultivation: {
              effectSkill: {
                skillId: effectSkillId,
                star: 1,
                skillLevel: 1,
                runtimeStatus: 'runtime-applied',
                sourceIdentity: 'fixture:strict-soulessence-star-1',
              },
            },
          },
        }
      : config
  );
  const actions = ['pangpang-heavy-1', 'pangpang-heavy-2'].map(
    (id, index) =>
      createWorkbenchActionDraft({
        id,
        type: 'skill',
        actorCharacterId: OWNER_ID,
        skillId: 10100701,
        actionVariantIndex: 1,
        startMs: index * durationMs,
        durationMs,
        durationFrames,
      })
  );
  const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
    durationMs: 10_000,
    teamSlots: createDefaultWorkbenchTeamSlots(),
    actorConfigs,
    actions,
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  return simulateScenario(compileProject(project, getWorkbenchGameData()));
}

function createSyntheticCatalog() {
  return {
    kind: 'synthetic-soulessence-effect-catalog',
    catalogHash: 'synthetic-catalog-hash',
    definitions: [
      {
        soulEssenceId: 999001,
        name: 'synthetic-soul',
        effectSkillId: 999010,
        runtimeStatus: 'runtime-applied',
        mechanismFamily: 'equipped-actor-skill-tag-property-after-skill',
        trigger: {
          elementId: 999011,
          pathId: 999011,
          event: 'AfterSkill',
          frameAnchor: 'action-end',
          condition: {
            kind: 'skill-tag',
            skillTagId: 2,
            actionKinds: ['charged-attack'],
          },
        },
        effect: {
          elementId: 999012,
          pathId: 999012,
          name: 'synthetic-property',
          attributeId: 222,
          bucket: 'dynamicExtra',
          durationMs: 5000,
          stackMode: 'stack',
          stackDelta: 1,
          maxStacks: 4,
          formula: { family: 'literal-a-with-common-ratio' },
          valuesByStar: [
            { star: 1, valueRaw: 111, sourceIdentity: 'synthetic:star:1' },
            { star: 2, valueRaw: 222, sourceIdentity: 'synthetic:star:2' },
          ],
        },
        sourceIdentity: 'synthetic:source',
      },
    ],
  };
}

function createSyntheticHitCatalog() {
  const catalog = createSyntheticCatalog();
  const definition = catalog.definitions[0];
  return {
    ...catalog,
    definitions: [
      {
        ...definition,
        mechanismFamily: 'equipped-actor-skill-tag-property-after-damage',
        trigger: {
          ...definition.trigger,
          eventId: 2,
          event: 'AfterDamage',
          frameAnchor: 'hit-after-damage',
        },
        effect: {
          ...definition.effect,
          attributeId: 21,
          durationMs: 4000,
          maxStacks: 6,
        },
      },
    ],
  };
}

function createSoulMatrixActor({ actorId, definition }) {
  const starValue = definition.effect.valuesByStar[0];
  return {
    id: actorId,
    name: actorId,
    loadout: {
      soulessenceId: definition.soulEssenceId,
      soulessenceStar: starValue.star,
      soulessenceCultivation: {
        effectSkill: {
          skillId: definition.effectSkillId,
          star: starValue.star,
          skillLevel: starValue.star,
          runtimeStatus: 'runtime-applied',
          sourceIdentity: `fixture:soul:${definition.soulEssenceId}`,
        },
      },
    },
  };
}
