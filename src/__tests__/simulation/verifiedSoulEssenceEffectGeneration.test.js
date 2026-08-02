import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import soulEssenceEffectCatalog from '../../data/generated/soulessence-effect-mechanics.json';
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
  normalizeWorkbenchActorConfigs,
} from '../../domain/workbenchProjectFactory';
import { createWorkbenchAttackInputChainDrafts } from '../../domain/workbenchAttackInputChain';
import { frameToMs } from '../../domain/timebase';
import { createSwitchAction } from '../../domain/projectSchema';
import { compileProject } from '../../simulation/compiler/compileProject';
import { createActionExecutionPlan } from '../../simulation/engine/actionExecutionPlan';
import { simulateScenario } from '../../simulation/engine/simulateScenario';
import { createVerifiedCombatRuntime } from '../../simulation/mechanics/verifiedCombatRuntime';
import { createVerifiedSoulEssenceEffectGeneration } from '../../simulation/mechanics/verifiedSoulEssenceEffectGeneration';
import {
  matchesVerifiedBattlePropertyTags,
  resolveVerifiedBattlePropertyTagsForHit,
} from '../../simulation/mechanics/verifiedBattlePropertyTags';
import {
  createEffectRuntimeTimeline,
  resolveActiveEffectsAt,
} from '../../simulation/runtime/effectRuntimeTimeline';
import { createControlledActorTimeline } from '../../simulation/runtime/controlledActorTimeline';

const SOUL_ID = 10001;
const SOUL_SKILL_ID = 1900480;
const OWNER_ID = 101007;
const PROPERTY_TAG_TEST_KIBO_ID = 500216;
const PROPERTY_TAG_TEST_KIBO_SKILL_ID = 50021601;

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
    soulEssenceId: 10055,
    event: 'AfterSkill',
    frameAnchor: 'action-end',
    actionKind: 'ultimate',
    durationMs: 20000,
    stackMode: 'refresh',
    maxStacks: 1,
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
    soulEssenceId: 10093,
    event: 'AfterSkill',
    frameAnchor: 'action-end',
    actionKind: 'ultimate',
    durationMs: 24000,
    stackMode: 'refresh',
    maxStacks: 1,
    attributeId: 229,
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
    soulEssenceId: 10097,
    event: 'BeforeSkill',
    frameAnchor: 'action-start',
    actionKind: 'limit-counter',
    durationMs: 8000,
    stackMode: 'refresh',
    maxStacks: 1,
    attributeId: 229,
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
  {
    soulEssenceId: 10147,
    event: 'BeforeSkill',
    frameAnchor: 'action-start',
    actionKind: 'star-carry',
    durationMs: 6000,
    stackMode: 'refresh',
    maxStacks: 1,
    attributeId: 222,
  },
  {
    soulEssenceId: 10151,
    event: 'BeforeSkill',
    frameAnchor: 'action-start',
    actionKind: 'star-carry',
    durationMs: 10000,
    stackMode: 'refresh',
    maxStacks: 1,
    attributeId: 222,
  },
  {
    soulEssenceId: 10124,
    contextual: true,
    event: 'BeforeSkill',
    frameAnchor: 'action-start',
    actionKind: 'ultimate',
    durationMs: 20000,
    stackMode: 'refresh',
    maxStacks: 1,
    attributeId: 8,
  },
  {
    soulEssenceId: 10131,
    contextual: true,
    event: 'AfterDamage',
    frameAnchor: 'hit-after-damage',
    actionKind: null,
    durationMs: 3000,
    stackMode: 'refresh',
    maxStacks: 1,
    attributeId: 222,
  },
  {
    soulEssenceId: 10136,
    contextual: true,
    event: 'AfterDamage',
    frameAnchor: 'hit-after-damage',
    actionKind: 'normal-attack',
    durationMs: 8000,
    stackMode: 'refresh',
    maxStacks: 1,
    attributeId: 222,
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
      runtimeAppliedCount: 17,
      unresolvedCount: 45,
    });
    expect(
      soulEssenceEffectCatalog.definitions.every(
        definition => definition.sourceClosure.controlSourceIdentity
      )
    ).toBe(true);
    expect(
      soulEssenceEffectCatalog.definitions.find(
        definition => definition.soulEssenceId === 10032
      )
    ).toMatchObject({
      runtimeStatus: 'source-indexed-runtime-unapplied',
      runtimeGaps: expect.arrayContaining([
        'effect-damage-branch-unapplied',
        'effect-skill-tag-condition-operator-unsupported',
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
        propertyTags: [301],
        propertyTagMatchMode: 'single-exact',
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

    expect(
      appliedDefinitions.map(definition => definition.soulEssenceId)
    ).toEqual(
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
          condition: {
            actionKinds:
              expected.actionKind == null ? [] : [expected.actionKind],
          },
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

  it.each([
    {
      soulEssenceId: 10055,
      expectedByStar: [60, 75, 90, 105],
      durationMs: 20000,
    },
    {
      soulEssenceId: 10093,
      expectedByStar: [93.8, 125, 156.3, 187.5],
      durationMs: 24000,
    },
  ])(
    'targets every hero and evaluates all stars for soul $soulEssenceId',
    expected => {
      const definition = soulEssenceEffectCatalog.definitions.find(
        entry => entry.soulEssenceId === expected.soulEssenceId
      );
      const action = {
        ...createRealSoulActionDraft({
          id: `ultimate-${expected.soulEssenceId}`,
          actionKind: 'ultimate',
          startFrame: 60,
        }),
        actorId: 'actor-101007',
      };
      const resolution = resolveVerifiedCombatActionMechanics(action);
      const actionEndMs = action.startMs + action.durationMs;

      expect(resolution).toMatchObject({
        actionBinding: {
          actionKind: 'ultimate',
          bindingSourceIdentity: expect.stringContaining('slot=4'),
        },
        controlBinding: {
          logic: { skillTag: '4' },
        },
      });

      expected.expectedByStar.forEach((expectedValue, starIndex) => {
        const actorId = String(action.actorId);
        const actors = [
          createSoulMatrixActor({
            actorId,
            definition,
            star: starIndex + 1,
          }),
          { id: 'actor-team-2', name: 'team-2', loadout: {} },
          { id: 'actor-team-3', name: 'team-3', loadout: {} },
        ];
        const scenario = {
          time: { fps: 60, durationMs: 40000 },
          actors,
          actions: [action],
        };
        const actionExecutionPlan = {
          actions: [{ actionId: action.id, execute: true }],
        };
        const generation = createVerifiedSoulEssenceEffectGeneration({
          scenario,
          actionExecutionPlan,
          actionResolutionById: new Map([[action.id, resolution]]),
        });
        const timeline = createEffectRuntimeTimeline({
          scenario,
          actionExecutionPlan,
          generatedCommands: generation.effectCommands,
        });

        expect(generation.effectCommands).toHaveLength(3);
        expect(
          generation.effectCommands.map(command => command.targetId)
        ).toEqual(actors.map(actor => String(actor.id)));
        expect(
          generation.effectCommands.every(
            command =>
              String(command.sourceActorId) === actorId &&
              String(command.formulaSourceActorId) === actorId &&
              String(command.effectAdderActorId) === actorId &&
              command.semanticTargetKind === 'team-actors' &&
              command.targetKind === 'actor'
          )
        ).toBe(true);
        expect(
          generation.effectCommands.map(
            command => command.modifiers[0].formulaResult.sourceRawA
          )
        ).toEqual(
          Array(3).fill(definition.effect.valuesByStar[starIndex].valueRaw)
        );
        for (const command of generation.effectCommands) {
          expect(command.timeMs).toBe(actionEndMs);
          expect(command.modifiers[0].valueRaw).toBeCloseTo(expectedValue, 3);
          expect(command.modifiers[0].evaluatedValue).toBeCloseTo(
            expectedValue,
            3
          );
          expect(command.modifiers[0].formulaIdentity).toBe(
            definition.effect.formula.formulaIdentity
          );
          expect(command.modifiers[0].formulaResult).toMatchObject({
            sourceRawA: definition.effect.valuesByStar[starIndex].valueRaw,
            formulaIdentity: definition.effect.formula.formulaIdentity,
            q16Trace: expect.arrayContaining([
              expect.objectContaining({ step: 'q16.16-multiply' }),
            ]),
          });
        }
        for (const actor of actors) {
          expect(
            resolveActiveEffectsAt(timeline, actionEndMs, {
              targetKind: 'actor',
              targetId: actor.id,
              calculatorOnly: true,
              settlingActionId: 'following-action',
            })
          ).toHaveLength(1);
          expect(
            resolveActiveEffectsAt(
              timeline,
              actionEndMs + expected.durationMs,
              {
                targetKind: 'actor',
                targetId: actor.id,
                calculatorOnly: true,
              }
            )
          ).toEqual([]);
        }
      });
    }
  );

  it('checks inherited thunder marks at 10124 action-start and applies real AllHero critical damage', () => {
    const ownerCharacterId = 112001;
    const ultimateStartFrame = 60;
    const activeHitFrame = 500;
    const expiredHitFrame = ultimateStartFrame + 1200;
    const thunderMark = createInheritedTuningMark(250, 1, 30_000);
    const actionPlan = [
      {
        id: 'tuning-state-ultimate',
        actionKind: 'ultimate',
        actorCharacterId: ownerCharacterId,
        startFrame: ultimateStartFrame,
      },
      {
        id: 'teammate-critical-active',
        actionKind: 'normal-attack',
        actorCharacterId: 101010,
        startFrame: activeHitFrame,
      },
      {
        id: 'teammate-critical-expired',
        actionKind: 'normal-attack',
        actorCharacterId: 101010,
        startFrame: expiredHitFrame,
      },
    ];
    const simulate = effectSkillId =>
      createRealSoulScenario({
        actorCharacterId: ownerCharacterId,
        soulEssenceId: 10124,
        effectSkillId,
        durationMs: 30_000,
        teamCharacterIds: [ownerCharacterId, 101010, 101007],
        combatScenario: { critical: { policy: 'critical' } },
        initialRuntimeState: { tuningMarks: [thunderMark] },
        actionPlan,
      });
    const withSoul = simulate(1900410);
    const withoutSoul = simulate(0);
    const commands =
      withSoul.verifiedSoulEssenceEffectGeneration.effectCommands;
    const damage = (result, actionId) =>
      result.verifiedCombatRuntime.damageEvents
        .filter(
          event =>
            event.type === 'VERIFIED_COMBAT_HIT' && event.actionId === actionId
        )
        .reduce((sum, event) => sum + Number(event.payload.rawDamage), 0);

    expect(commands).toHaveLength(3);
    expect(commands.map(command => command.targetId).sort()).toEqual([
      'actor-101007',
      'actor-101010',
      'actor-112001',
    ]);
    expect(commands[0]).toMatchObject({
      sourceSoulEssenceId: 10124,
      timeMs: frameToMs(ultimateStartFrame),
      durationMs: 20000,
      modifiers: [expect.objectContaining({ attributeId: 8, valueRaw: 2150 })],
      sourceIdentity: expect.objectContaining({
        triggerEventContext: expect.objectContaining({
          heldElementIds: expect.arrayContaining([250]),
        }),
      }),
    });
    expect(damage(withSoul, 'teammate-critical-active')).toBeGreaterThan(
      damage(withoutSoul, 'teammate-critical-active')
    );
    expect(damage(withSoul, 'teammate-critical-expired')).toBeCloseTo(
      damage(withoutSoul, 'teammate-critical-expired'),
      6
    );

    for (const tuningMarks of [
      [],
      [createInheritedTuningMark(750, 1, 30_000)],
      [createInheritedTuningMark(250, 1, frameToMs(ultimateStartFrame))],
    ]) {
      const negative = createRealSoulScenario({
        actorCharacterId: ownerCharacterId,
        soulEssenceId: 10124,
        effectSkillId: 1900410,
        durationMs: 8_000,
        teamCharacterIds: [ownerCharacterId, 101010, 101007],
        initialRuntimeState: { tuningMarks },
        actionPlan: [actionPlan[0]],
      });
      expect(
        negative.verifiedSoulEssenceEffectGeneration.effectCommands
      ).toEqual([]);
    }

    const blocked = createRealSoulScenario({
      actorCharacterId: ownerCharacterId,
      ownerInitialSp: 0,
      soulEssenceId: 10124,
      effectSkillId: 1900410,
      durationMs: 8_000,
      initialRuntimeState: { tuningMarks: [thunderMark] },
      actionPlan: [actionPlan[0]],
    });
    expect(blocked.verifiedSoulEssenceEffectGeneration.effectCommands).toEqual(
      []
    );
  });

  it.each([
    { markId: 250, profileKey: 'thunder', packetElementId: 299 },
    { markId: 450, profileKey: 'dark', packetElementId: 499 },
  ])(
    'triggers 10131 only from a landed $profileKey overlimit packet and not its own settlement',
    ({ markId, profileKey, packetElementId }) => {
      const ownerCharacterId = 112001;
      const sourceOnly = createRealSoulScenario({
        actorCharacterId: ownerCharacterId,
        soulEssenceId: null,
        effectSkillId: null,
        durationMs: 12_000,
        initialRuntimeState: {
          tuningMarks: [createInheritedTuningMark(markId, 2, 20_000)],
        },
        actionPlan: [
          {
            id: `overlimit-${profileKey}-source`,
            actionKind: 'ultimate',
            actorCharacterId: ownerCharacterId,
            startFrame: 60,
          },
        ],
      });
      const packet = sourceOnly.verifiedTuningMarkGeneration.combatEvents.find(
        event =>
          event.kind === 'overlimit-damage' && event.profile.key === profileKey
      );
      expect(packet).toBeDefined();
      const packetFrame = runtimeFrame(packet.timeMs);
      const actionPlan = [
        {
          id: `overlimit-${profileKey}-source`,
          actionKind: 'ultimate',
          actorCharacterId: ownerCharacterId,
          startFrame: 60,
        },
      ];
      const simulate = effectSkillId =>
        createRealSoulScenario({
          actorCharacterId: ownerCharacterId,
          soulEssenceId: 10131,
          effectSkillId,
          durationMs: 16_000,
          initialRuntimeState: {
            enemy: {
              hp: { currentValue: 1_000_000, maxValue: 1_000_000 },
              toughness: { currentValue: 1_000_000, maxValue: 1_000_000 },
            },
            tuningMarks: [createInheritedTuningMark(markId, 2, 20_000)],
          },
          actionPlan,
        });
      const withSoul = simulate(1900270);
      const withoutSoul = simulate(0);
      const command =
        withSoul.verifiedSoulEssenceEffectGeneration.effectCommands.find(
          entry => entry.sourceSoulEssenceId === 10131
        );
      const tuningDamage = result =>
        result.verifiedCombatRuntime.damageEvents.find(
          event =>
            event.type === 'VERIFIED_TUNING_DAMAGE' &&
            event.payload.profileKey === profileKey &&
            event.payload.elementId === packet.template.elementConfigId
        );
      const toughness = (runtime, actionId) =>
        runtime.damageEvents
          .filter(event => event.actionId === actionId)
          .reduce(
            (sum, event) => sum + Number(event.payload.toughnessDamage ?? 0),
            0
          );
      const activeChargedId = `overlimit-${profileKey}-active-charged`;
      const activeReplay = replayRealActionWithSoulCommands({
        actorCharacterId: ownerCharacterId,
        soulEssenceId: 10131,
        actionId: activeChargedId,
        actionKind: 'charged-attack',
        startFrame: packetFrame + 1,
        commands: [command],
      });
      const expiredChargedId = `overlimit-${profileKey}-expired-charged`;
      const expiredReplay = replayRealActionWithSoulCommands({
        actorCharacterId: ownerCharacterId,
        soulEssenceId: 10131,
        actionId: expiredChargedId,
        actionKind: 'charged-attack',
        startFrame: packetFrame + 180,
        commands: [command],
      });

      expect(packet).toMatchObject({
        eventContext: expect.objectContaining({
          elementId: packet.template.elementConfigId,
          targetElementIds: [packetElementId],
          profileKey,
          landed: true,
        }),
      });
      expect(command).toMatchObject({
        sourceSoulEssenceId: 10131,
        sourceTuningEventIdentity: packet.eventIdentity,
        timeMs: packet.timeMs,
        durationMs: 3000,
        modifiers: [
          expect.objectContaining({ attributeId: 222, valueRaw: 4460 }),
        ],
      });
      expect(tuningDamage(withSoul).payload.rawDamage).toBeCloseTo(
        tuningDamage(withoutSoul).payload.rawDamage,
        6
      );
      expect(
        activeReplay.withCommands.actionResolutionById.get(activeChargedId)
      ).toMatchObject({
        actionBinding: expect.objectContaining({
          controlSkillId: 11200110,
          selectedSubSkillIndex: 0,
        }),
      });
      expect(
        toughness(activeReplay.withCommands, activeChargedId)
      ).toBeGreaterThan(
        toughness(activeReplay.withoutCommands, activeChargedId)
      );
      expect(
        toughness(expiredReplay.withCommands, expiredChargedId)
      ).toBeCloseTo(
        toughness(expiredReplay.withoutCommands, expiredChargedId),
        6
      );

      const missed = createRealSoulScenario({
        actorCharacterId: ownerCharacterId,
        soulEssenceId: 10131,
        effectSkillId: 1900270,
        durationMs: 12_000,
        combatScenario: {
          projectile: { targetDistance: 0, defaultWillHit: false },
        },
        initialRuntimeState: {
          tuningMarks: [createInheritedTuningMark(markId, 2, 20_000)],
        },
        actionPlan: [actionPlan[0]],
      });
      expect(missed.verifiedSoulEssenceEffectGeneration.effectCommands).toEqual(
        []
      );
      expect(
        missed.verifiedCombatRuntime.damageEvents.filter(
          event =>
            event.type === 'VERIFIED_TUNING_DAMAGE' &&
            event.payload.profileKey === profileKey
        )
      ).toEqual([]);
    }
  );

  it('requires the real wind overlimit element types and final normal-attack tag for 10136', () => {
    const ownerCharacterId = 111001;
    const initialWind = createInheritedTuningMark(750, 1, 20_000);
    const sourceOnly = createRealSoulScenario({
      actorCharacterId: ownerCharacterId,
      soulEssenceId: null,
      effectSkillId: null,
      durationMs: 12_000,
      initialRuntimeState: { tuningMarks: [initialWind] },
      actionPlan: [
        {
          id: 'wind-normal-overlimit-source',
          actionKind: 'normal-attack',
          actorCharacterId: ownerCharacterId,
          startFrame: 60,
          controlSubSkillIndex: 4,
        },
      ],
    });
    const packet = sourceOnly.verifiedTuningMarkGeneration.combatEvents.find(
      event => event.kind === 'overlimit-damage' && event.profile.key === 'wind'
    );
    expect(packet).toBeDefined();
    const packetFrame = runtimeFrame(packet.timeMs);
    const activeChargedFrame = 60 + 95;
    const expiredFrame = Math.max(activeChargedFrame + 265, packetFrame + 480);
    const actionPlan = [
      {
        id: 'wind-normal-overlimit-source',
        actionKind: 'normal-attack',
        actorCharacterId: ownerCharacterId,
        startFrame: 60,
        controlSubSkillIndex: 4,
      },
      {
        id: 'wind-overlimit-active-charged',
        actionKind: 'charged-attack',
        actorCharacterId: ownerCharacterId,
        startFrame: activeChargedFrame,
      },
      {
        id: 'wind-overlimit-expired-charged',
        actionKind: 'charged-attack',
        actorCharacterId: ownerCharacterId,
        startFrame: expiredFrame,
      },
    ];
    const simulate = effectSkillId =>
      createRealSoulScenario({
        actorCharacterId: ownerCharacterId,
        soulEssenceId: 10136,
        effectSkillId,
        durationMs: 20_000,
        initialRuntimeState: {
          enemy: {
            hp: { currentValue: 1_000_000, maxValue: 1_000_000 },
            toughness: { currentValue: 1_000_000, maxValue: 1_000_000 },
          },
          tuningMarks: [initialWind],
        },
        actionPlan,
      });
    const withSoul = simulate(1900210);
    const withoutSoul = simulate(0);
    const command =
      withSoul.verifiedSoulEssenceEffectGeneration.effectCommands.find(
        entry => entry.sourceSoulEssenceId === 10136
      );
    const toughness = (result, actionId) =>
      result.verifiedCombatRuntime.damageEvents
        .filter(event => event.actionId === actionId)
        .reduce(
          (sum, event) => sum + Number(event.payload.toughnessDamage ?? 0),
          0
        );

    expect(packet).toMatchObject({
      template: expect.objectContaining({
        elementConfigId: 796,
        elementTypes: [22, 32, 43, 307],
      }),
      eventContext: expect.objectContaining({
        elementId: 796,
        elementTypes: [22, 32, 43, 307],
        targetElementIds: [799],
        skillTagIds: [1],
        landed: true,
      }),
    });
    expect(command).toMatchObject({
      sourceSoulEssenceId: 10136,
      sourceTuningEventIdentity: packet.eventIdentity,
      timeMs: packet.timeMs,
      durationMs: 8000,
    });
    const sourcePacket = result =>
      result.verifiedCombatRuntime.damageEvents.find(
        event =>
          event.type === 'VERIFIED_TUNING_DAMAGE' &&
          event.actionId === 'wind-normal-overlimit-source' &&
          event.payload.profileKey === 'wind'
      );
    expect(sourcePacket(withSoul).payload.toughnessDamage).toBeCloseTo(
      sourcePacket(withoutSoul).payload.toughnessDamage,
      6
    );
    expect(
      withSoul.verifiedActionVariantRuntime.selectionByActionId.get(
        'wind-normal-overlimit-source'
      )
    ).toMatchObject({
      controlSkillId: 11100101,
      selectedSubSkillIndex: 4,
      actualDurationFrames: 95,
    });
    expect(
      toughness(withSoul, 'wind-overlimit-active-charged')
    ).toBeGreaterThan(toughness(withoutSoul, 'wind-overlimit-active-charged'));
    expect(toughness(withSoul, 'wind-overlimit-expired-charged')).toBeCloseTo(
      toughness(withoutSoul, 'wind-overlimit-expired-charged'),
      6
    );

    const wrongSkillTag = createRealSoulScenario({
      actorCharacterId: ownerCharacterId,
      soulEssenceId: 10136,
      effectSkillId: 1900210,
      durationMs: 14_000,
      initialRuntimeState: { tuningMarks: [initialWind] },
      actionPlan: [
        {
          id: 'wind-ultimate-overlimit-source',
          actionKind: 'ultimate',
          actorCharacterId: ownerCharacterId,
          startFrame: 60,
        },
      ],
    });
    expect(
      wrongSkillTag.verifiedSoulEssenceEffectGeneration.effectCommands
    ).toEqual([]);
  });

  it('evaluates every 10097 star through the same base-3 Q16.16 formula', () => {
    const definition = soulEssenceEffectCatalog.definitions.find(
      entry => entry.soulEssenceId === 10097
    );
    const action = {
      ...createRealSoulActionDraft({
        id: 'xiaoyu-limit-counter-stars',
        actionKind: 'limit-counter',
        startFrame: 60,
        actorCharacterId: 101010,
      }),
      actorId: 'actor-101010',
    };
    const resolution = resolveVerifiedCombatActionMechanics(action);
    const expectedValues = [112.5, 150, 187.5, 225];

    expectedValues.forEach((expectedValue, starIndex) => {
      const actor = createSoulMatrixActor({
        actorId: action.actorId,
        definition,
        star: starIndex + 1,
      });
      const generation = createVerifiedSoulEssenceEffectGeneration({
        scenario: {
          time: { fps: 60, durationMs: 12000 },
          actors: [actor],
          actions: [action],
        },
        actionExecutionPlan: {
          actions: [{ actionId: action.id, execute: true }],
        },
        actionResolutionById: new Map([[action.id, resolution]]),
      });
      const modifier = generation.effectCommands[0]?.modifiers?.[0];

      expect(modifier).toMatchObject({
        sourceRawA: definition.effect.valuesByStar[starIndex].valueRaw,
        formulaIdentity: definition.effect.formula.formulaIdentity,
        formulaResult: {
          family: 'basis-point-property-a-with-common-ratio',
          sourceRawA: definition.effect.valuesByStar[starIndex].valueRaw,
          q16Trace: expect.arrayContaining([
            expect.objectContaining({
              step: 'base-function-3-a-per-10000',
            }),
          ]),
        },
      });
      expect(modifier.evaluatedValue).toBeCloseTo(expectedValue, 3);
    });
  });

  it('matches the verified ultimate slot or tag independently and rejects an AND reinterpretation', () => {
    const definition = soulEssenceEffectCatalog.definitions.find(
      entry => entry.soulEssenceId === 10055
    );
    const actor = createSoulMatrixActor({
      actorId: 'actor-or-source',
      definition,
      star: 1,
    });
    const actions = [
      {
        id: 'ultimate-slot-only',
        actorId: actor.id,
        actionKind: 'normal-attack',
        startMs: 0,
        durationMs: 100,
      },
      {
        id: 'ultimate-tag-only',
        actorId: actor.id,
        actionKind: 'normal-attack',
        startMs: 200,
        durationMs: 100,
      },
      {
        id: 'not-an-ultimate',
        actorId: actor.id,
        actionKind: 'normal-attack',
        startMs: 400,
        durationMs: 100,
      },
    ];
    const actionResolutionById = new Map([
      [
        'ultimate-slot-only',
        {
          actionBinding: {
            actionKind: 'normal-attack',
            skillSlotType: 4,
          },
          controlBinding: { logic: { skillTag: '1' } },
        },
      ],
      [
        'ultimate-tag-only',
        {
          actionBinding: { actionKind: 'normal-attack' },
          controlBinding: { logic: { skillTag: '4' } },
        },
      ],
      [
        'not-an-ultimate',
        {
          actionBinding: {
            actionKind: 'normal-attack',
            skillSlotType: 1,
          },
          controlBinding: { logic: { skillTag: '1' } },
        },
      ],
    ]);
    const scenario = {
      time: { fps: 60, durationMs: 2000 },
      actors: [actor],
      actions,
    };
    const actionExecutionPlan = {
      actions: actions.map(action => ({ actionId: action.id, execute: true })),
    };
    const catalog = {
      ...soulEssenceEffectCatalog,
      definitions: [definition],
    };

    const generation = createVerifiedSoulEssenceEffectGeneration({
      scenario,
      actionExecutionPlan,
      actionResolutionById,
      catalog,
    });
    expect(
      generation.effectCommands.map(command => command.sourceActionId)
    ).toEqual(['ultimate-slot-only', 'ultimate-tag-only']);
    expect(
      generation.effectCommands.map(
        command => command.sourceIdentity.matchedConditionIdentities.length
      )
    ).toEqual([1, 1]);

    const andCatalog = {
      ...catalog,
      definitions: [
        {
          ...definition,
          trigger: {
            ...definition.trigger,
            condition: {
              ...definition.trigger.condition,
              logic: 'and',
            },
          },
        },
      ],
    };
    expect(
      createVerifiedSoulEssenceEffectGeneration({
        scenario,
        actionExecutionPlan,
        actionResolutionById,
        catalog: andCatalog,
      }).effectCommands
    ).toEqual([]);
  });

  it('uses the real limit-counter binding for 10097 and applies before its hits', () => {
    const definition = soulEssenceEffectCatalog.definitions.find(
      entry => entry.soulEssenceId === 10097
    );
    const action = {
      ...createRealSoulActionDraft({
        id: 'xiaoyu-real-limit-counter',
        actionKind: 'limit-counter',
        startFrame: 120,
        actorCharacterId: 101010,
      }),
      actorId: 'actor-101010',
    };
    const resolution = resolveVerifiedCombatActionMechanics(action);
    const actor = createSoulMatrixActor({
      actorId: action.actorId,
      definition,
      star: 1,
    });
    const scenario = {
      time: { fps: 60, durationMs: 12000 },
      actors: [actor],
      actions: [action],
    };
    const actionExecutionPlan = {
      actions: [{ actionId: action.id, execute: true }],
    };
    const generation = createVerifiedSoulEssenceEffectGeneration({
      scenario,
      actionExecutionPlan,
      actionResolutionById: new Map([[action.id, resolution]]),
    });
    const timeline = createEffectRuntimeTimeline({
      scenario,
      actionExecutionPlan,
      generatedCommands: generation.effectCommands,
    });

    expect(resolution).toMatchObject({
      actionBinding: { actionKind: 'limit-counter' },
      controlBinding: { logic: { skillTag: '11' } },
    });
    expect(resolution.hits.length).toBeGreaterThan(0);
    expect(generation.effectCommands).toEqual([
      expect.objectContaining({
        sourceSoulEssenceId: 10097,
        sourceActionId: action.id,
        targetId: String(action.actorId),
        timeMs: action.startMs,
        modifiers: [
          expect.objectContaining({
            attributeId: 229,
            bucket: 'dynamicExtra',
            sourceRawA: 1125000,
            evaluatedValue: expect.closeTo(112.5, 3),
          }),
        ],
      }),
    ]);
    expect(
      resolveActiveEffectsAt(timeline, action.startMs, {
        targetKind: 'actor',
        targetId: action.actorId,
        calculatorOnly: true,
        settlingActionId: action.id,
      })
    ).toHaveLength(1);
  });

  it.each([
    [10055, 1900930, 60],
    [10093, 1900230, 93.8],
  ])(
    'keeps real AllHero soul %s active across two switches and off the triggering ultimate hits',
    (soulEssenceId, effectSkillId, expectedValue) => {
      const result = createRealSoulScenario({
        soulEssenceId,
        effectSkillId,
        durationMs: 40_000,
        teamCharacterIds: [101007, 101003, 101010],
        actionPlan: [
          {
            id: 'ultimate-source',
            actionKind: 'ultimate',
            actorCharacterId: 101007,
            startFrame: 0,
          },
          {
            id: 'owner-follow-up',
            actionKind: 'normal-attack',
            actorCharacterId: 101007,
            startFrame: 451,
          },
          {
            id: 'switch-team-2',
            actionKind: 'switch',
            sourceCharacterId: 101007,
            targetCharacterId: 101003,
            startFrame: 600,
          },
          {
            id: 'team-2-follow-up',
            actionKind: 'normal-attack',
            actorCharacterId: 101003,
            startFrame: 900,
          },
          {
            id: 'switch-team-3',
            actionKind: 'switch',
            sourceCharacterId: 101003,
            targetCharacterId: 101010,
            startFrame: 1000,
          },
          {
            id: 'team-3-follow-up',
            actionKind: 'normal-attack',
            actorCharacterId: 101010,
            startFrame: 1310,
          },
        ],
      });
      const effectId = `soulessence:${soulEssenceId}:element:${
        soulEssenceId === 10055 ? 19009302 : 19002302
      }`;
      const commands =
        result.verifiedSoulEssenceEffectGeneration.effectCommands.filter(
          command => command.sourceActionId === 'ultimate-source'
        );
      const sourceTraces = actionId =>
        result.verifiedCombatRuntime.damageEvents
          .filter(
            event =>
              event.type === 'VERIFIED_COMBAT_HIT' &&
              event.actionId === actionId
          )
          .flatMap(event => event.payload.dynamicPropertyTrace?.source ?? [])
          .filter(trace => trace.attributeId === 229)
          .flatMap(trace => trace.effects ?? []);

      expect(commands).toHaveLength(3);
      expect(new Set(commands.map(command => command.targetId)).size).toBe(3);
      expect(
        commands.every(
          command =>
            command.targetKind === 'actor' &&
            command.semanticTargetKind === 'team-actors'
        )
      ).toBe(true);
      for (const command of commands) {
        expect(command.modifiers[0].evaluatedValue).toBeCloseTo(
          expectedValue,
          3
        );
      }
      expect(commands.some(command => command.targetKind === 'kibo')).toBe(
        false
      );
      expect(sourceTraces('ultimate-source')).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ effectId })])
      );
      for (const actionId of [
        'owner-follow-up',
        'team-2-follow-up',
        'team-3-follow-up',
      ]) {
        expect(
          result.actionExecutionPlan.actions.find(
            entry => entry.actionId === actionId
          ),
          actionId
        ).toMatchObject({ execute: true });
        expect(sourceTraces(actionId), actionId).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              effectId,
            }),
          ])
        );
      }
    }
  );

  it('settles real 10097 limit-counter hits with the action-start layer while executed misses still trigger', () => {
    const result = createRealSoulScenario({
      actorCharacterId: 101010,
      soulEssenceId: 10097,
      effectSkillId: 1900470,
      actionPlan: [
        {
          id: 'real-limit-counter',
          actionKind: 'limit-counter',
          actorCharacterId: 101010,
          startFrame: 120,
        },
      ],
    });
    const hits = result.verifiedCombatRuntime.damageEvents.filter(
      event =>
        event.type === 'VERIFIED_COMBAT_HIT' &&
        event.actionId === 'real-limit-counter'
    );
    const effectId = 'soulessence:10097:element:19004701';

    expect(result.actionExecutionPlan.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'real-limit-counter',
          execute: true,
        }),
      ])
    );
    expect(hits.length).toBeGreaterThan(0);
    expect(
      hits.every(event =>
        (event.payload.dynamicPropertyTrace?.source ?? []).some(
          trace =>
            trace.attributeId === 229 &&
            (trace.effects ?? []).some(
              effect =>
                effect.effectId === effectId &&
                Math.abs(Number(effect.valueRaw) - 112.5) < 0.001
            )
        )
      )
    ).toBe(true);

    const definition = soulEssenceEffectCatalog.definitions.find(
      entry => entry.soulEssenceId === 10097
    );
    const actor = createSoulMatrixActor({
      actorId: 'actor-blocked',
      definition,
      star: 1,
    });
    const blockedAction = {
      ...createRealSoulActionDraft({
        id: 'blocked-limit-counter',
        actionKind: 'limit-counter',
        startFrame: 0,
        actorCharacterId: 101010,
      }),
      actorId: actor.id,
    };
    const blockedResolution =
      resolveVerifiedCombatActionMechanics(blockedAction);
    const missedAction = {
      ...blockedAction,
      id: 'missed-limit-counter',
      startMs: 2000,
      hitOverrides: Object.fromEntries(
        blockedResolution.hits.map(hit => [
          String(
            hit.identity ??
              hit.hitIdentity ??
              hit.sourceIdentity ??
              `${hit.elementId ?? 'element'}|${hit.hitIndex ?? 'hit'}`
          ),
          { willHit: false },
        ])
      ),
    };
    const blockedGeneration = createVerifiedSoulEssenceEffectGeneration({
      scenario: {
        time: { fps: 60, durationMs: 4000 },
        actors: [actor],
        actions: [blockedAction, missedAction],
      },
      actionExecutionPlan: {
        actions: [
          { actionId: blockedAction.id, execute: false },
          { actionId: missedAction.id, execute: true },
        ],
      },
      actionResolutionById: new Map([
        [blockedAction.id, blockedResolution],
        [missedAction.id, blockedResolution],
      ]),
      catalog: {
        ...soulEssenceEffectCatalog,
        definitions: [definition],
      },
    });
    expect(blockedGeneration.effectCommands).toEqual([
      expect.objectContaining({
        sourceActionId: missedAction.id,
        sourceSoulEssenceId: 10097,
        timeMs: missedAction.startMs,
      }),
    ]);
    expect(
      blockedGeneration.effectCommands.some(
        command => command.sourceActionId === blockedAction.id
      )
    ).toBe(false);
    expect(blockedGeneration.suppressions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: missedAction.id,
          reason: 'soulessence-effect-no-landed-source-hit',
        }),
      ])
    );
  });

  it.each([
    {
      soulEssenceId: 10055,
      actionKind: 'ultimate',
      actorCharacterId: 101010,
      commandCount: 3,
    },
    {
      soulEssenceId: 10093,
      actionKind: 'ultimate',
      actorCharacterId: 101010,
      commandCount: 3,
    },
    {
      soulEssenceId: 10060,
      actionKind: 'star-skill',
      actorCharacterId: 101007,
      commandCount: 3,
    },
    {
      soulEssenceId: 10094,
      actionKind: 'star-skill',
      actorCharacterId: 101007,
      commandCount: 1,
    },
  ])(
    'fires the $soulEssenceId action event after an executed all-miss $actionKind',
    ({ soulEssenceId, actionKind, actorCharacterId, commandCount }) => {
      const definition = soulEssenceEffectCatalog.definitions.find(
        entry => entry.soulEssenceId === soulEssenceId
      );
      const actor = createSoulMatrixActor({
        actorId: 'actor-action-event-source',
        definition,
      });
      const sourceAction = {
        ...createRealSoulActionDraft({
          id: `executed-miss-${soulEssenceId}`,
          actionKind,
          startFrame: 60,
          actorCharacterId,
        }),
        actorId: actor.id,
      };
      const resolution = resolveVerifiedCombatActionMechanics(sourceAction);
      expect(resolution.hits.length).toBeGreaterThan(0);
      const allMissAction = {
        ...sourceAction,
        hitOverrides: Object.fromEntries(
          resolution.hits.map(hit => [
            String(
              hit.identity ??
                hit.hitIdentity ??
                hit.sourceIdentity ??
                `${hit.elementId ?? 'element'}|${hit.hitIndex ?? 'hit'}`
            ),
            { willHit: false },
          ])
        ),
      };
      const blockedAction = {
        ...allMissAction,
        id: `blocked-miss-${soulEssenceId}`,
        startMs: allMissAction.startMs + allMissAction.durationMs + 1000,
      };
      const scenario = {
        time: { fps: 60, durationMs: 20_000 },
        actors: [
          actor,
          { id: 'actor-action-event-team-2', loadout: {} },
          { id: 'actor-action-event-team-3', loadout: {} },
        ],
        actions: [allMissAction, blockedAction],
      };
      const generation = createVerifiedSoulEssenceEffectGeneration({
        scenario,
        actionExecutionPlan: {
          actions: [
            { actionId: allMissAction.id, execute: true },
            { actionId: blockedAction.id, execute: false },
          ],
        },
        actionResolutionById: new Map([
          [allMissAction.id, resolution],
          [blockedAction.id, resolution],
        ]),
        catalog: {
          ...soulEssenceEffectCatalog,
          definitions: [definition],
        },
      });

      expect(generation.effectCommands).toHaveLength(commandCount);
      expect(
        new Set(
          generation.effectCommands.map(command => command.sourceActionId)
        )
      ).toEqual(new Set([allMissAction.id]));
      expect(generation.suppressions).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actionId: allMissAction.id,
            reason: 'soulessence-effect-no-landed-source-hit',
          }),
        ])
      );
    }
  );

  it.each([
    [10055, 1900930, 60],
    [10093, 1900230, 93.8],
  ])(
    'raises non-source teammate tuning damage for soul %s and expires cleanly',
    (soulEssenceId, effectSkillId, expectedMasteryGain) => {
      const fireProfile =
        verifiedCombatMechanicsPackage.tuningMechanicsCatalog.profiles.find(
          profile => profile.key === 'fire'
        );
      const initialRuntimeState = {
        tuningMarks: [
          {
            markId: fireProfile.markId,
            profileKey: fireProfile.key,
            elementName: fireProfile.element,
            decayRemainingMs: 60_000,
            heldReadyRemainingMs: 0,
            layers: [
              {
                sourceActionId: 'inherited-fire-mark',
                sourceActorId: 'actor-101003',
                sourceIdentity: { profile: fireProfile.sourceIdentity },
              },
            ],
          },
        ],
      };
      const actionPlan = [
        {
          id: 'tuning-buff-source-ultimate',
          actionKind: 'ultimate',
          actorCharacterId: 101007,
          startFrame: 0,
        },
        {
          id: 'tuning-buff-switch',
          actionKind: 'switch',
          sourceCharacterId: 101007,
          targetCharacterId: 101003,
          startFrame: 600,
        },
        {
          id: 'tuning-buff-active-hit',
          actionKind: 'normal-attack',
          actorCharacterId: 101003,
          startFrame: 900,
        },
        {
          id: 'tuning-buff-expired-hit',
          actionKind: 'normal-attack',
          actorCharacterId: 101003,
          startFrame: 2200,
        },
      ];
      const simulate = equippedSoulEssenceId =>
        createRealSoulScenario({
          soulEssenceId: equippedSoulEssenceId,
          effectSkillId: equippedSoulEssenceId == null ? null : effectSkillId,
          durationMs: 42_000,
          teamCharacterIds: [101007, 101003, 101010],
          initialRuntimeState,
          actionPlan,
        });
      const withSoul = simulate(soulEssenceId);
      const withoutSoul = simulate(null);
      const tuningPayload = (result, actionId) =>
        result.verifiedCombatRuntime.damageEvents.find(
          event =>
            event.type === 'VERIFIED_TUNING_DAMAGE' &&
            event.actionId === actionId
        )?.payload;
      const activeWithSoul = tuningPayload(withSoul, 'tuning-buff-active-hit');
      const activeWithoutSoul = tuningPayload(
        withoutSoul,
        'tuning-buff-active-hit'
      );
      const expiredWithSoul = tuningPayload(
        withSoul,
        'tuning-buff-expired-hit'
      );
      const expiredWithoutSoul = tuningPayload(
        withoutSoul,
        'tuning-buff-expired-hit'
      );

      expect(activeWithSoul).toBeTruthy();
      expect(activeWithoutSoul).toBeTruthy();
      expect(activeWithSoul.mastery - activeWithoutSoul.mastery).toBeCloseTo(
        expectedMasteryGain,
        3
      );
      expect(activeWithSoul.rawDamage).toBeGreaterThan(
        activeWithoutSoul.rawDamage
      );
      expect(expiredWithSoul.mastery).toBeCloseTo(
        expiredWithoutSoul.mastery,
        6
      );
      expect(expiredWithSoul.rawDamage).toBeCloseTo(
        expiredWithoutSoul.rawDamage,
        6
      );
    }
  );

  it('derives only verified normal and charged hit property tags from the action binding', () => {
    const resolutions = new Map(
      [
        ['normal-attack', 10100701, 0],
        ['charged-attack', 10100701, 1],
        ['star-skill', 10100712, 0],
        ['ultimate', 10100713, 0],
      ].map(([actionKind, skillId, actionVariantIndex]) => {
        const action = createRealSoulActionDraft({
          id: `property-tag-${actionKind}`,
          actionKind,
          startFrame: 0,
          mappingOverride: verifiedCombatMechanicsPackage.actionMappings.find(
            entry =>
              entry.ownerId === OWNER_ID &&
              entry.sourceSkillId === skillId &&
              entry.actionVariantIndex === actionVariantIndex
          ),
        });
        return [
          actionKind,
          resolveVerifiedBattlePropertyTagsForHit({
            action,
            resolution: resolveVerifiedCombatActionMechanics(action),
          }),
        ];
      })
    );

    expect(resolutions.get('normal-attack')).toMatchObject({
      status: 'verified-battle-property-tags-ready',
      skillTags: [1],
      propertyTags: [300],
      applied: true,
    });
    expect(resolutions.get('charged-attack')).toMatchObject({
      status: 'verified-battle-property-tags-ready',
      skillTags: [2],
      propertyTags: [301],
      applied: true,
    });
    for (const actionKind of ['star-skill', 'ultimate']) {
      expect(resolutions.get(actionKind)).toMatchObject({
        status: 'battle-property-tag-action-mapping-evidence-gap',
        propertyTags: [],
        applied: false,
      });
    }
    for (const [skillTag, reason] of [
      [null, 'battle-property-tag-source-skill-tag-missing'],
      ['1|2', 'battle-property-tag-multi-skill-tag-semantics-evidence-gap'],
      ['99', 'battle-property-tag-action-mapping-evidence-gap'],
    ]) {
      expect(
        resolveVerifiedBattlePropertyTagsForHit({
          action: { actionKind: 'normal-attack' },
          resolution: {
            actionBinding: { actionKind: 'normal-attack' },
            controlBinding: {
              logic: { skillTag, sourceIdentity: 'synthetic:skill-tag' },
            },
          },
        })
      ).toMatchObject({
        status: 'battle-property-tag-action-mapping-evidence-gap',
        propertyTags: [],
        reason,
        applied: false,
      });
    }

    const kiboMapping = verifiedCombatMechanicsPackage.actionMappings.find(
      entry => entry.ownerKind === 'kibo' && entry.actionKind === 'active'
    );
    const kiboAction = createWorkbenchActionDraft({
      id: 'property-tag-kibo-active',
      type: 'kiboEvent',
      actorCharacterId: OWNER_ID,
      kiboId: kiboMapping.ownerId,
      skillId: kiboMapping.sourceSkillId,
    });
    expect(
      resolveVerifiedBattlePropertyTagsForHit({
        action: kiboAction,
        resolution: resolveVerifiedCombatActionMechanics(kiboAction),
      })
    ).toMatchObject({
      status: 'battle-property-tag-action-mapping-evidence-gap',
      propertyTags: [],
      applied: false,
    });

    expect(matchesVerifiedBattlePropertyTags([], [])).toBe(true);
    expect(matchesVerifiedBattlePropertyTags([300], [300])).toBe(true);
    expect(matchesVerifiedBattlePropertyTags([301], [301])).toBe(true);
    expect(matchesVerifiedBattlePropertyTags([301], [])).toBe(false);
    expect(matchesVerifiedBattlePropertyTags([301], [300])).toBe(false);
    expect(matchesVerifiedBattlePropertyTags([301], [300, 301])).toBe(false);
    expect(matchesVerifiedBattlePropertyTags([300, 301], [301])).toBe(false);
  });

  it.each(APPLIED_SOUL_EFFECT_MATRIX.filter(expected => !expected.contextual))(
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
          ...(expected.actionKind === 'star-carry'
            ? createSyntheticEntrySkillProvenance('switch-allowed-1')
            : {}),
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
          ...(expected.actionKind === 'star-carry'
            ? createSyntheticEntrySkillProvenance('switch-allowed-2')
            : {}),
        },
      ];
      const scenario = {
        time: { fps: 60, durationMs: 30_000 },
        actors: [createSoulMatrixActor({ actorId, definition })],
        actions,
      };
      const actionExecutionPlan = {
        actions: actions.map(action => ({
          actionId: action.id,
          execute: true,
        })),
      };
      const actionResolutionById = new Map(
        actions.map(action => [
          action.id,
          createSyntheticVerifiedActionResolution(action.actionKind),
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
    const inheritedRemainingMs = boundaryEffect.expiresAtMs - boundaryFrameMs;
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
      modifiers: [
        expect.objectContaining({
          propertyTags: [301],
          propertyTagMatchMode: 'single-exact',
        }),
      ],
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
    expect(refreshedEffect).toMatchObject({
      stacks: 2,
      modifiers: [
        expect.objectContaining({
          propertyTags: [301],
          propertyTagMatchMode: 'single-exact',
        }),
      ],
    });
    expect(refreshedEffect.expiresAtMs).toBeCloseTo(triggerTimeMs + 4000, 3);
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
            event.payload.formulaBreakdown?.weaknessInput?.weaknessSkillDamageUp
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
    expect(
      result.verifiedSoulEssenceEffectGeneration.effectCommands.every(
        command =>
          command.modifiers[0].propertyTags.join('|') === '301' &&
          command.modifiers[0].propertyTagMatchMode === 'single-exact'
      )
    ).toBe(true);
  });

  it.each([
    {
      soulEssenceId: 10060,
      effectSkillId: 1900900,
      matchingActionId: 'normal-after-trigger',
      rejectedActionId: 'charged-after-normal',
      otherSkillActionId: 'ultimate-during-layer',
      propertyTag: 300,
      valueRaw: 610,
    },
    {
      soulEssenceId: 10094,
      effectSkillId: 1900660,
      matchingActionId: 'charged-after-normal',
      rejectedActionId: 'normal-after-trigger',
      otherSkillActionId: 'ultimate-during-layer',
      propertyTag: 301,
      valueRaw: 1220,
    },
  ])(
    'scopes real soul $soulEssenceId to its source property tag across action kinds',
    expected => {
      const result = createRealSoulScenario({
        soulEssenceId: expected.soulEssenceId,
        effectSkillId: expected.effectSkillId,
        actionPlan: [
          { id: 'star-skill-trigger', actionKind: 'star-skill' },
          { id: 'normal-after-trigger', actionKind: 'normal-attack' },
          { id: 'charged-after-normal', actionKind: 'charged-attack' },
          { id: expected.otherSkillActionId, actionKind: 'ultimate' },
        ],
      });
      const sourceTraces = actionId =>
        result.verifiedCombatRuntime.damageEvents
          .filter(event => event.actionId === actionId)
          .flatMap(event => event.payload.dynamicPropertyTrace?.source ?? [])
          .filter(trace => trace.attributeId === 21);

      expect(sourceTraces('star-skill-trigger')).toEqual([]);
      expect(sourceTraces(expected.matchingActionId)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            dynamicExtraRaw: expected.valueRaw,
            effects: [
              expect.objectContaining({
                propertyTags: [expected.propertyTag],
                propertyTagMatchMode: 'single-exact',
              }),
            ],
          }),
        ])
      );
      expect(sourceTraces(expected.rejectedActionId)).toEqual([]);
      expect(sourceTraces(expected.otherSkillActionId)).toEqual([]);
    }
  );

  it.each([
    {
      soulEssenceId: 10147,
      effectSkillId: 1900110,
      durationFrames: 360,
      effectElementId: 19001002,
      chargedOnly: true,
      expectedValueRaw: 8930,
    },
    {
      soulEssenceId: 10151,
      effectSkillId: 1900130,
      durationFrames: 600,
      effectElementId: 19001302,
      chargedOnly: false,
      expectedValueRaw: 3720,
    },
  ])(
    'triggers real EntrySkill 22 for soul $soulEssenceId and settles its scoped toughness lifecycle',
    expected => {
      const switchFrame = 60;
      const activeChargedFrame = 160;
      const activeNormalFrame = 260;
      const expiredChargedFrame = switchFrame + expected.durationFrames;
      const actionPlan = [
        {
          id: 'entry-soul-switch',
          actionKind: 'switch',
          sourceCharacterId: 101007,
          targetCharacterId: 101010,
          startFrame: switchFrame,
        },
        {
          id: 'entry-soul-active-charged',
          actionKind: 'charged-attack',
          actorCharacterId: 101010,
          startFrame: activeChargedFrame,
        },
        {
          id: 'entry-soul-active-normal',
          actionKind: 'normal-attack',
          actorCharacterId: 101010,
          startFrame: activeNormalFrame,
        },
        {
          id: 'entry-soul-expired-charged',
          actionKind: 'charged-attack',
          actorCharacterId: 101010,
          startFrame: expiredChargedFrame,
        },
      ];
      const simulate = effectSkillId =>
        createRealSoulScenario({
          actorCharacterId: 101010,
          soulEssenceId: expected.soulEssenceId,
          effectSkillId,
          durationMs: 24_000,
          teamCharacterIds: [101007, 101003, 101010],
          initialRuntimeState: {
            controlledActor: {
              actorId: 'actor-101007',
              characterId: 101007,
            },
            enemy: {
              toughness: {
                currentValue: 1_000_000,
                maxValue: 1_000_000,
              },
            },
          },
          actionPlan,
        });
      const withSoul = simulate(expected.effectSkillId);
      const withoutSoul = simulate(null);
      const entryActionId =
        'entry-soul-switch--on-enter--actor-101010--star-carry';
      const command =
        withSoul.verifiedSoulEssenceEffectGeneration.effectCommands.find(
          entry => entry.sourceActionId === entryActionId
        );
      const toughness = (result, actionId) =>
        result.verifiedCombatRuntime.damageEvents
          .filter(
            event =>
              event.type === 'VERIFIED_COMBAT_HIT' &&
              event.actionId === actionId
          )
          .reduce(
            (total, event) => total + Number(event.payload.toughnessDamage),
            0
          );

      expect(command).toMatchObject({
        sourceSoulEssenceId: expected.soulEssenceId,
        sourceActionId: entryActionId,
        timeMs: frameToMs(switchFrame),
        durationMs: frameToMs(expected.durationFrames),
        targetId: 'actor-101010',
        modifiers: [
          expect.objectContaining({
            attributeId: 222,
            bucket: 'dynamicExtra',
            valueRaw: expected.expectedValueRaw,
            propertyTags: expected.chargedOnly ? [301] : [],
          }),
        ],
        sourceIdentity: expect.objectContaining({
          actionSkillTagIds: [22],
          switchTrigger: expect.objectContaining({
            kind: 'switch-triggered-star-carry',
            triggerPhase: 'on-enter',
          }),
          lifecycle: expect.objectContaining({
            durationMs: frameToMs(expected.durationFrames),
          }),
        }),
      });
      expect(toughness(withSoul, 'entry-soul-active-charged')).toBeGreaterThan(
        toughness(withoutSoul, 'entry-soul-active-charged')
      );
      expect(toughness(withSoul, 'entry-soul-active-normal')).toBeCloseTo(
        toughness(withoutSoul, 'entry-soul-active-normal'),
        6
      );
      expect(toughness(withSoul, 'entry-soul-expired-charged')).toBeCloseTo(
        toughness(withoutSoul, 'entry-soul-expired-charged'),
        6
      );
      expect(
        resolveActiveEffectsAt(
          withSoul.effectTimeline,
          frameToMs(expiredChargedFrame),
          {
            targetKind: 'actor',
            targetId: 'actor-101010',
            calculatorOnly: true,
          }
        ).filter(
          effect =>
            effect.effectId ===
            `soulessence:${expected.soulEssenceId}:element:${expected.effectElementId}`
        )
      ).toEqual([]);
    }
  );

  it('requires a real on-enter switch child while preserving all-miss and cooldown gates', () => {
    const entryMapping = verifiedCombatMechanicsPackage.actionMappings.find(
      entry => entry.ownerId === 101010 && entry.actionKind === 'star-carry'
    );
    const allMissOverrides = Object.fromEntries(
      entryMapping.selectedHitIdentities.map(identity => [
        identity,
        { willHit: false },
      ])
    );
    const shared = {
      actorCharacterId: 101010,
      soulEssenceId: 10147,
      effectSkillId: 1900110,
      durationMs: 32_000,
      teamCharacterIds: [101007, 101003, 101010],
      initialRuntimeState: {
        controlledActor: {
          actorId: 'actor-101007',
          characterId: 101007,
        },
      },
    };
    const allMiss = createRealSoulScenario({
      ...shared,
      actionPlan: [
        {
          id: 'all-miss-entry-switch',
          actionKind: 'switch',
          sourceCharacterId: 101007,
          targetCharacterId: 101010,
          startFrame: 60,
          hitOverrides: allMissOverrides,
        },
      ],
    });
    const entryActionId =
      'all-miss-entry-switch--on-enter--actor-101010--star-carry';
    expect(
      allMiss.verifiedCombatRuntime.damageEvents.filter(
        event =>
          event.type === 'VERIFIED_COMBAT_HIT' &&
          event.actionId === entryActionId
      )
    ).toEqual([]);
    expect(allMiss.verifiedSoulEssenceEffectGeneration.effectCommands).toEqual([
      expect.objectContaining({
        sourceActionId: entryActionId,
        sourceSoulEssenceId: 10147,
      }),
    ]);

    const cooldownReplay = createRealSoulScenario({
      ...shared,
      actionPlan: [
        {
          id: 'first-entry-switch',
          actionKind: 'switch',
          sourceCharacterId: 101007,
          targetCharacterId: 101010,
          startFrame: 60,
        },
        {
          id: 'switch-away-from-owner',
          actionKind: 'switch',
          sourceCharacterId: 101010,
          targetCharacterId: 101007,
          startFrame: 200,
        },
        {
          id: 'entry-during-cooldown',
          actionKind: 'switch',
          sourceCharacterId: 101007,
          targetCharacterId: 101010,
          startFrame: 300,
        },
        {
          id: 'charged-after-return',
          actionKind: 'charged-attack',
          actorCharacterId: 101010,
          startFrame: 320,
        },
      ],
    });
    expect(
      cooldownReplay.verifiedSoulEssenceEffectGeneration.effectCommands.map(
        command => command.sourceActionId
      )
    ).toEqual(['first-entry-switch--on-enter--actor-101010--star-carry']);
    expect(
      cooldownReplay.actionExecutionPlan.actions.some(
        entry =>
          entry.actionId ===
          'entry-during-cooldown--on-enter--actor-101010--star-carry'
      )
    ).toBe(false);
    expect(
      resolveActiveEffectsAt(cooldownReplay.effectTimeline, frameToMs(320), {
        targetKind: 'actor',
        targetId: 'actor-101010',
        calculatorOnly: true,
      }).filter(
        effect => effect.effectId === 'soulessence:10147:element:19001002'
      )
    ).toEqual([
      expect.objectContaining({
        effectId: 'soulessence:10147:element:19001002',
        sourceActionId:
          'first-entry-switch--on-enter--actor-101010--star-carry',
      }),
    ]);
    expect(
      cooldownReplay.verifiedCombatRuntime.damageEvents
        .filter(event => event.actionId === 'charged-after-return')
        .flatMap(event => event.payload.dynamicPropertyTrace?.source ?? [])
        .flatMap(trace => trace.effects ?? [])
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          effectId: 'soulessence:10147:element:19001002',
          propertyTags: [301],
        }),
      ])
    );

    const exitOnly = createRealSoulScenario({
      actorCharacterId: 101003,
      soulEssenceId: 10151,
      effectSkillId: 1900130,
      durationMs: 10_000,
      teamCharacterIds: [101003, 101007, 101010],
      initialRuntimeState: {
        controlledActor: {
          actorId: 'actor-101003',
          characterId: 101003,
        },
      },
      actionPlan: [
        {
          id: 'exit-skill-only-switch',
          actionKind: 'switch',
          sourceCharacterId: 101003,
          targetCharacterId: 101007,
          startFrame: 60,
        },
      ],
    });
    expect(exitOnly.verifiedSoulEssenceEffectGeneration.effectCommands).toEqual(
      []
    );
    expect(exitOnly.verifiedSoulEssenceEffectGeneration.suppressions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'exit-skill-only-switch--on-exit--actor-101003--star-carry',
          actualSkillTagIds: [8],
        }),
      ])
    );

    const manualOnly = createRealSoulScenario({
      actorCharacterId: 101010,
      soulEssenceId: 10147,
      effectSkillId: 1900110,
      durationMs: 10_000,
      actionPlan: [
        {
          id: 'manual-forged-star-carry',
          actionKind: 'star-carry',
          actorCharacterId: 101010,
          startFrame: 60,
        },
      ],
    });
    expect(manualOnly.actionExecutionPlan.skippedActionIds).toContain(
      'manual-forged-star-carry'
    );
    expect(
      manualOnly.verifiedSoulEssenceEffectGeneration.effectCommands
    ).toEqual([]);
  });

  it.each([
    [10147, 1900110, 6000, [301]],
    [10151, 1900130, 10000, []],
  ])(
    'inherits and refreshes real EntrySkill soul %i across a replay boundary',
    (soulEssenceId, effectSkillId, durationMs, propertyTags) => {
      const definition = soulEssenceEffectCatalog.definitions.find(
        entry => entry.soulEssenceId === soulEssenceId
      );
      const actorId = `actor-entry-${soulEssenceId}`;
      const action = {
        id: `entry-cycle-${soulEssenceId}`,
        actorId,
        actionKind: 'star-carry',
        startMs: 100,
        durationMs: 400,
        sourceSequenceIndex: 0,
        sourceSequencePath: [0],
        ...createSyntheticEntrySkillProvenance(`switch-${soulEssenceId}`),
      };
      const scenario = {
        time: { fps: 60, durationMs: 1000 },
        actors: [createSoulMatrixActor({ actorId, definition })],
        actions: [action],
      };
      const executionPlan = {
        actions: [{ actionId: action.id, execute: true }],
      };
      const generation = createVerifiedSoulEssenceEffectGeneration({
        scenario,
        actionExecutionPlan: executionPlan,
        actionResolutionById: new Map([
          [action.id, createSyntheticVerifiedActionResolution('star-carry')],
        ]),
      });
      const firstTimeline = createEffectRuntimeTimeline({
        scenario,
        actionExecutionPlan: executionPlan,
        generatedCommands: generation.effectCommands,
      });
      const boundaryMs = 1000;
      const boundaryEffect = resolveActiveEffectsAt(firstTimeline, boundaryMs, {
        targetKind: 'actor',
        targetId: actorId,
        calculatorOnly: true,
      })[0];
      const secondScenario = {
        ...scenario,
        initialRuntimeState: {
          activeEffects: [
            {
              ...boundaryEffect,
              remainingDurationMs: boundaryEffect.expiresAtMs - boundaryMs,
            },
          ],
        },
      };
      const secondTimeline = createEffectRuntimeTimeline({
        scenario: secondScenario,
        actionExecutionPlan: executionPlan,
        generatedCommands: generation.effectCommands,
      });
      const refreshed = resolveActiveEffectsAt(
        secondTimeline,
        generation.effectCommands[0].timeMs,
        {
          targetKind: 'actor',
          targetId: actorId,
          calculatorOnly: true,
        }
      )[0];

      expect(generation.effectCommands).toEqual([
        expect.objectContaining({
          sourceSoulEssenceId: soulEssenceId,
          durationMs,
          modifiers: [expect.objectContaining({ propertyTags })],
        }),
      ]);
      expect(secondTimeline.events[0]).toMatchObject({
        type: 'EFFECT_INHERITED',
        after: { stacks: 1 },
      });
      expect(refreshed).toMatchObject({
        stacks: 1,
        expiresAtMs: generation.effectCommands[0].timeMs + durationMs,
      });
      expect(effectSkillId).toBe(definition.effectSkillId);
    }
  );

  it.each([
    ['normal attack', 'normal-attack'],
    ['star skill', 'star-skill'],
    ['ultimate', 'ultimate'],
    ['Kibo signature', 'kibo-signature'],
  ])(
    'keeps a live 10098 charged layer off a following %s',
    (_label, actionKind) => {
      const targetActionId = `${actionKind}-during-layer`;
      const result = createRealSoulScenario({
        actorCharacterId: 101010,
        soulEssenceId: 10098,
        effectSkillId: 1900670,
        actionPlan: [
          { id: 'charged-layer-source', actionKind: 'charged-attack' },
          { id: targetActionId, actionKind },
        ],
      });
      const targetHits = result.verifiedCombatRuntime.damageEvents.filter(
        event => event.actionId === targetActionId
      );

      expect(targetHits.length).toBeGreaterThan(0);
      expect(
        targetHits.flatMap(event =>
          (event.payload.dynamicPropertyTrace?.source ?? []).flatMap(
            trace => trace.effects ?? []
          )
        )
      ).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            effectId: 'soulessence:10098:element:19006702',
          }),
        ])
      );
    }
  );

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
        ['legacy-heavy', { actionBinding: { actionKind: 'charged-attack' } }],
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
  actorCharacterId = OWNER_ID,
  soulEssenceId = SOUL_ID,
  effectSkillId = SOUL_SKILL_ID,
  actionPlan = null,
  durationMs = 20_000,
  teamCharacterIds = null,
  initialRuntimeState = null,
  combatScenario = null,
  ownerInitialSp = 100,
} = {}) {
  const requestedActions =
    actionPlan ??
    ['pangpang-heavy-1', 'pangpang-heavy-2'].map(id => ({
      id,
      actionKind: 'charged-attack',
    }));
  const includesKiboAction = requestedActions.some(
    action => action.actionKind === 'kibo-signature'
  );
  const selection = {
    ...DEFAULT_WORKBENCH_SELECTION,
    characterId: actorCharacterId,
  };
  const teamSlots = createDefaultWorkbenchTeamSlots(selection).map(
    (slot, index) => ({
      ...slot,
      characterId:
        Number(teamCharacterIds?.[index]) || Number(slot.characterId),
    })
  );
  const ownerSlotId = teamSlots.find(
    slot => Number(slot.characterId) === actorCharacterId
  )?.slotId;
  const actorConfigs = normalizeWorkbenchActorConfigs(
    createDefaultWorkbenchActorConfigs(selection),
    selection,
    teamSlots
  ).map(config =>
    Number(config.characterId) === actorCharacterId
      ? {
          ...config,
          initialSp: ownerInitialSp,
          loadout: {
            ...config.loadout,
            kiboId: includesKiboAction
              ? PROPERTY_TAG_TEST_KIBO_ID
              : config.loadout?.kiboId,
            soulessenceId: soulEssenceId,
            soulessenceLevel: soulEssenceId == null ? null : 80,
            soulessenceRank: soulEssenceId == null ? null : 1,
            soulessenceStar: soulEssenceId == null ? null : 1,
            soulessenceCultivation:
              soulEssenceId == null
                ? null
                : {
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
  let startFrame = 0;
  const actions = requestedActions.map(requested => {
    const requestedStartFrame = Number.isFinite(Number(requested.startFrame))
      ? Number(requested.startFrame)
      : startFrame;
    if (requested.actionKind === 'switch') {
      const action = createSwitchAction({
        id: requested.id,
        actorId: `actor-${requested.sourceCharacterId}`,
        targetActorId: `actor-${requested.targetCharacterId}`,
        targetCharacterId: requested.targetCharacterId,
        startMs: frameToMs(requestedStartFrame),
        hitOverrides: requested.hitOverrides ?? null,
      });
      startFrame = requestedStartFrame;
      return action;
    }
    const action = createRealSoulActionDraft({
      id: requested.id,
      actionKind: requested.actionKind,
      startFrame: requestedStartFrame,
      actorCharacterId: Number(requested.actorCharacterId) || actorCharacterId,
      hitOverrides: requested.hitOverrides ?? null,
      controlSubSkillIndex: requested.controlSubSkillIndex ?? null,
    });
    const actionDurationFrames =
      Number(action.durationFrames) ||
      Math.max(1, Math.round((Number(action.durationMs) * 60) / 1000));
    startFrame = requestedStartFrame + actionDurationFrames;
    return action;
  });
  const project = createWorkbenchProject(selection, {
    durationMs,
    teamSlots,
    actorConfigs,
    actions,
    initialRuntimeState: {
      ...(initialRuntimeState ?? {}),
      ...(includesKiboAction && ownerSlotId
        ? {
            kiboEnergyBySlot: [
              {
                slotId: ownerSlotId,
                kiboId: PROPERTY_TAG_TEST_KIBO_ID,
                currentValue: 100,
                maxValue: 100,
              },
            ],
          }
        : {}),
    },
    combatScenario,
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  return simulateScenario(compileProject(project, getWorkbenchGameData()));
}

function createRealSoulActionDraft({
  id,
  actionKind,
  startFrame,
  actorCharacterId = OWNER_ID,
  mappingOverride = null,
  hitOverrides = null,
  controlSubSkillIndex = null,
}) {
  if (actionKind === 'kibo-signature') {
    const mapping = verifiedCombatMechanicsPackage.actionMappings.find(
      entry =>
        entry.ownerKind === 'kibo' &&
        entry.ownerId === PROPERTY_TAG_TEST_KIBO_ID &&
        entry.sourceSkillId === PROPERTY_TAG_TEST_KIBO_SKILL_ID
    );
    if (!mapping) throw new Error('missing property-tag Kibo signature');
    const durationFrames = mapping.actionTiming.occupancy.durationFrames;
    return createWorkbenchActionDraft({
      id,
      type: 'kiboEvent',
      actorCharacterId,
      kiboId: PROPERTY_TAG_TEST_KIBO_ID,
      skillId: PROPERTY_TAG_TEST_KIBO_SKILL_ID,
      actionVariantIndex: mapping.actionVariantIndex,
      eventType: 'signature',
      startMs: frameToMs(startFrame),
      durationMs: frameToMs(durationFrames),
      durationFrames,
      timingSource: 'azpr-unity-skill-control-root',
      timingStatus: 'verified',
      needsTimingData: false,
    });
  }
  const mapping =
    mappingOverride ??
    verifiedCombatMechanicsPackage.actionMappings.find(
      entry =>
        entry.ownerId === actorCharacterId && entry.actionKind === actionKind
    );
  if (!mapping) throw new Error(`missing test action kind ${actionKind}`);
  if (actionKind === 'normal-attack') {
    const [action] = createWorkbenchAttackInputChainDrafts({
      entry: mapping,
      actorCharacterId,
      skillId: mapping.sourceSkillId,
      startMs: frameToMs(startFrame),
      createActionId: (_segment, index) =>
        index === 0 ? id : `${id}-unused-${index + 1}`,
    });
    if (!action) throw new Error(`missing test attack input for ${actionKind}`);
    return {
      ...action,
      hitOverrides,
      ...(controlSubSkillIndex == null ? {} : { controlSubSkillIndex }),
    };
  }
  const durationFrames = mapping.actionTiming.occupancy.durationFrames;
  return createWorkbenchActionDraft({
    id,
    type: 'skill',
    actorCharacterId,
    skillId: mapping.sourceSkillId,
    actionVariantIndex: mapping.actionVariantIndex,
    startMs: frameToMs(startFrame),
    durationMs: frameToMs(durationFrames),
    durationFrames,
    hitOverrides,
    ...(controlSubSkillIndex == null ? {} : { controlSubSkillIndex }),
  });
}

function replayRealActionWithSoulCommands({
  actorCharacterId,
  soulEssenceId,
  actionId,
  actionKind,
  startFrame,
  commands,
}) {
  const projection = createRealSoulScenario({
    actorCharacterId,
    soulEssenceId,
    effectSkillId: 0,
    durationMs: frameToMs(startFrame + 480),
    initialRuntimeState: {
      enemy: {
        hp: { currentValue: 1_000_000, maxValue: 1_000_000 },
        toughness: { currentValue: 1_000_000, maxValue: 1_000_000 },
      },
    },
    actionPlan: [
      {
        id: actionId,
        actionKind,
        actorCharacterId,
        startFrame,
      },
    ],
  });
  const scenario = projection.effectiveActionTimeline.scenario;
  const actionExecutionPlan =
    projection.actionExecutionPlan ??
    createActionExecutionPlan({
      scenario,
      actionRuleDiagnostics: projection.actionRuleDiagnostics,
    });
  const controlledActorTimeline =
    projection.controlledActorTimeline ??
    createControlledActorTimeline({ scenario, actionExecutionPlan });
  const createRuntime = generatedCommands =>
    createVerifiedCombatRuntime({
      scenario,
      actionExecutionPlan,
      controlledActorTimeline,
      actionVariantRuntime: projection.verifiedActionVariantRuntime,
      effectTimeline: createEffectRuntimeTimeline({
        scenario,
        actionExecutionPlan,
        controlledActorTimeline,
        generatedCommands,
      }),
    });
  return {
    withCommands: createRuntime(commands),
    withoutCommands: createRuntime([]),
  };
}

function createInheritedTuningMark(markId, currentValue, decayRemainingMs) {
  return {
    markId,
    currentValue,
    maxValue: 5,
    decayRemainingMs,
    heldReadyRemainingMs: 0,
    layers: Array.from({ length: currentValue }, (_value, index) => ({
      sourceActionId: `fixture:tuning:${markId}:${index}`,
      sourceActorId: null,
      sourceIdentity: `fixture:tuning:${markId}:${index}`,
    })),
  };
}

function runtimeFrame(timeMs) {
  return Math.round((Number(timeMs) * 60) / 1000);
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
          propertyTags: [301],
          propertyTagMatchMode: 'single-exact',
          propertyTagSourceIdentity: 'synthetic:effect.defaultPropertyTags',
          durationMs: 4000,
          maxStacks: 6,
        },
      },
    ],
  };
}

function createSoulMatrixActor({ actorId, definition, star = 1 }) {
  const starValue = definition.effect.valuesByStar.find(
    row => Number(row.star) === Number(star)
  );
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

function createSyntheticVerifiedActionResolution(actionKind) {
  const bindingByActionKind = {
    'normal-attack': { skillSlotId: 1, skillTagId: 1 },
    'charged-attack': { skillSlotId: 2, skillTagId: 2 },
    'star-skill': { skillSlotId: 3, skillTagId: 3 },
    ultimate: { skillSlotId: 4, skillTagId: 4 },
    'dodge-attack': { skillSlotId: 204, skillTagId: 6 },
    'plunging-attack': { skillSlotId: 301, skillTagId: 9 },
    'limit-counter': { skillSlotId: 207, skillTagId: 11 },
    'perfect-parry': { skillSlotId: 209, skillTagId: 12 },
    'star-combo': { skillSlotId: 208, skillTagId: 17 },
    'star-carry': { skillSlotId: 200, skillTagId: 22 },
  };
  const binding = bindingByActionKind[actionKind] ?? {};
  return {
    actionBinding: {
      identity: `synthetic-binding:${actionKind}`,
      actionKind,
      bindingSourceIdentity: `characters.items[id=fixture].skillSlots[group=ground,slot=${binding.skillSlotId ?? 999}]`,
    },
    controlBinding: {
      frameRate: 60,
      logic: {
        skillTag: String(binding.skillTagId ?? 999),
        sourceIdentity: `NewTable/skillsub_logic.rows[skillId=fixture:${actionKind}]`,
      },
    },
  };
}

function createSyntheticEntrySkillProvenance(parentActionId) {
  return {
    parentActionId,
    switchTriggerBinding: {
      triggerPhase: 'on-enter',
      resolutionStatus: 'applied',
      applied: true,
    },
    derivedAction: {
      schemaVersion: 1,
      kind: 'switch-triggered-star-carry',
      parentActionId,
      readOnly: true,
    },
    readOnly: true,
  };
}
