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
import { projectVerifiedAttackInputChainSegment } from '../../domain/verifiedActionContextScheduling';
import { frameToMs } from '../../domain/timebase';
import { createSwitchAction } from '../../domain/projectSchema';
import { compileProject } from '../../simulation/compiler/compileProject';
import { createActionExecutionPlan } from '../../simulation/engine/actionExecutionPlan';
import { simulateScenario } from '../../simulation/engine/simulateScenario';
import { createVerifiedBattleEffectGeneration } from '../../simulation/mechanics/verifiedBattleEffectGeneration';
import { createVerifiedCombatRuntime } from '../../simulation/mechanics/verifiedCombatRuntime';
import { createVerifiedDamageEventGeneration } from '../../simulation/mechanics/verifiedDamageEventGeneration';
import { createVerifiedNonDamageEventGeneration } from '../../simulation/mechanics/verifiedNonDamageEventGeneration';
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
  {
    soulEssenceId: 10043,
    contextual: true,
    event: 'BeforeGetElement',
    frameAnchor: 'element-before-acquire',
    actionKind: null,
    durationMs: 16000,
    stackMode: 'stack',
    maxStacks: 5,
    attributeId: 229,
  },
  {
    soulEssenceId: 10149,
    contextual: true,
    event: 'AfterGetElement',
    frameAnchor: 'element-after-acquire',
    actionKind: null,
    durationMs: 24000,
    stackMode: 'refresh',
    maxStacks: 1,
    attributeId: 229,
  },
  {
    soulEssenceId: 10052,
    contextual: true,
    event: 'AfterGetElement',
    frameAnchor: 'element-after-acquire',
    actionKind: null,
    durationMs: 10000,
    stackMode: 'refresh',
    maxStacks: 1,
    attributeId: 23,
  },
  {
    soulEssenceId: 10044,
    contextual: true,
    event: 'BeforeDamage',
    frameAnchor: 'hit-before-damage',
    actionKind: null,
    durationMs: 16000,
    stackMode: 'refresh',
    maxStacks: 1,
    attributeId: 52,
  },
  {
    soulEssenceId: 10123,
    contextual: true,
    event: 'BeforeDamage',
    frameAnchor: 'hit-before-damage',
    actionKind: null,
    durationMs: 8000,
    stackMode: 'refresh',
    maxStacks: 1,
    attributeId: 21,
  },
  {
    soulEssenceId: 10130,
    contextual: true,
    event: 'BeforeDamage',
    frameAnchor: 'hit-before-damage',
    actionKind: null,
    durationMs: 5000,
    stackMode: 'refresh',
    maxStacks: 1,
    attributeId: 21,
  },
  {
    soulEssenceId: 10150,
    contextual: true,
    event: 'BeforeDamage',
    frameAnchor: 'hit-before-damage',
    actionKind: null,
    durationMs: 8000,
    stackMode: 'stack',
    maxStacks: 5,
    attributeId: 21,
  },
  {
    soulEssenceId: 10048,
    contextual: true,
    event: 'SwitchEnter',
    frameAnchor: 'switch-enter',
    actionKind: null,
    durationMs: 8000,
    stackMode: 'refresh',
    maxStacks: 1,
    attributeId: 1,
  },
  {
    soulEssenceId: 10175,
    contextual: true,
    event: 'AfterHeal',
    frameAnchor: 'heal-after-settlement',
    actionKind: 'ultimate',
    durationMs: 2000,
    stackMode: 'refresh',
    maxStacks: 1,
    attributeId: 1,
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
      runtimeAppliedCount: 26,
      unresolvedCount: 36,
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

    const matchingPacket = createRealSoulScenario({
      actorCharacterId: 101010,
      soulEssenceId: 10018,
      effectSkillId: 1900400,
      durationMs: 12_000,
      initialRuntimeState: {
        tuningMarks: [createInheritedTuningMark(750, 1, 20_000)],
      },
      actionPlan: [
        {
          id: 'c6-10018-a5-context',
          actionKind: 'normal-attack',
          actorCharacterId: 101010,
          startFrame: 60,
          attackInputSequenceIndex: 5,
        },
        {
          id: 'c6-10018-matching-wind-packet',
          actionKind: 'charged-attack',
          actorCharacterId: 101010,
          startFrame: 97,
        },
      ],
    });
    expect(
      matchingPacket.verifiedCombatRuntime.damageEvents.some(
        event =>
          event.type === 'VERIFIED_TUNING_DAMAGE' &&
          event.payload.elementId === 796
      )
    ).toBe(true);
    expect(
      matchingPacket.verifiedSoulEssenceEffectGeneration?.effectCommands ?? []
    ).toEqual([]);
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

  it('selects one 112001260 priority packet before evaluating 10131 AfterDamage', () => {
    const createScenario = defaultWillHit =>
      createRealSoulScenario({
        actorCharacterId: 112001,
        soulEssenceId: 10131,
        effectSkillId: 1900270,
        durationMs: 12_000,
        combatScenario: {
          projectile: { targetDistance: 0, defaultWillHit },
        },
        initialRuntimeState: {
          tuningMarks: [
            createInheritedTuningMark(250, 2, 20_000),
            createInheritedTuningMark(450, 2, 20_000),
          ],
        },
        actionPlan: [
          {
            id: 'dual-priority-overlimit-source',
            actionKind: 'ultimate',
            actorCharacterId: 112001,
            startFrame: 60,
          },
        ],
      });
    const landed = createScenario(true);
    const replayed = createScenario(true);
    const missed = createScenario(false);
    const project = result => ({
      consumes: result.verifiedTuningMarkGeneration.events
        .filter(event => event.kind === 'consume')
        .map(event => ({
          markId: event.markId,
          before: event.before,
          after: event.after,
          selection: event.selectedPriorityCandidate,
        })),
      packets: result.verifiedTuningMarkGeneration.combatEvents
        .filter(event => event.kind === 'overlimit-damage')
        .map(event => ({
          profileKey: event.profile.key,
          targetElementIds: event.eventContext.targetElementIds,
          landed: event.eventContext.landed,
          selection: event.eventContext.selectedPriorityCandidate,
        })),
      finalMarks: result.verifiedTuningMarkGeneration.finalState
        .filter(state => [250, 450].includes(state.markId))
        .map(state => ({ markId: state.markId, value: state.currentValue })),
      commands: result.verifiedSoulEssenceEffectGeneration.effectCommands
        .filter(command => command.sourceSoulEssenceId === 10131)
        .map(command => ({
          sourceTuningEventIdentity: command.sourceTuningEventIdentity,
          sourceActorId: command.sourceActorId,
          targetId: command.targetId,
        })),
    });

    expect(project(landed)).toEqual({
      consumes: [
        {
          markId: 250,
          before: 2,
          after: 0,
          selection: {
            priorityIndex: 0,
            markId: 250,
            packetElementId: 299,
          },
        },
      ],
      packets: [
        {
          profileKey: 'thunder',
          targetElementIds: [299],
          landed: true,
          selection: {
            priorityIndex: 0,
            markId: 250,
            packetElementId: 299,
          },
        },
      ],
      finalMarks: [
        { markId: 250, value: 0 },
        { markId: 450, value: 2 },
      ],
      commands: [expect.objectContaining({ sourceActorId: 'actor-112001' })],
    });
    expect(project(replayed)).toEqual(project(landed));
    expect(project(missed)).toMatchObject({
      packets: [
        {
          profileKey: 'thunder',
          targetElementIds: [299],
          landed: false,
          selection: {
            priorityIndex: 0,
            markId: 250,
            packetElementId: 299,
          },
        },
      ],
      commands: [],
    });
    expect(
      project(missed).packets.some(packet => packet.profileKey === 'dark')
    ).toBe(false);
  });

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

  it('bridges a real wind-mark acquisition to 10043 before mutation and changes teammate tuning settlement', () => {
    const sourceActorId = 107002;
    const sourceActionId = 'c5-wind-acquire-source';
    const activeActionId = 'c5-wind-buff-active';
    const expiredActionId = 'c5-wind-buff-expired';
    const actionPlan = [
      {
        id: sourceActionId,
        actionKind: 'star-skill',
        actorCharacterId: sourceActorId,
        startFrame: 60,
      },
      {
        id: 'c5-wind-switch',
        actionKind: 'switch',
        sourceCharacterId: sourceActorId,
        targetCharacterId: 101003,
        startFrame: 420,
      },
      {
        id: activeActionId,
        actionKind: 'normal-attack',
        actorCharacterId: 101003,
        startFrame: 720,
      },
      {
        id: expiredActionId,
        actionKind: 'normal-attack',
        actorCharacterId: 101003,
        startFrame: 1200,
      },
    ];
    const simulate = effectSkillId =>
      createRealSoulScenario({
        actorCharacterId: sourceActorId,
        soulEssenceId: effectSkillId == null ? null : 10043,
        effectSkillId,
        durationMs: frameToMs(1400),
        teamCharacterIds: [sourceActorId, 101003, 101010],
        actionPlan,
      });
    const withSoul = simulate(1900330);
    const withoutSoul = simulate(null);
    const commands =
      withSoul.verifiedSoulEssenceEffectGeneration.effectCommands.filter(
        command => command.sourceSoulEssenceId === 10043
      );
    const getEvents =
      withSoul.verifiedTuningMarkGeneration.getElementEvents.filter(
        event => event.actionId === sourceActionId && event.markId === 750
      );
    const tuningPayload = (result, actionId) =>
      result.verifiedCombatRuntime.damageEvents.find(
        event =>
          event.type === 'VERIFIED_TUNING_DAMAGE' &&
          event.actionId === actionId &&
          event.payload.profileKey === 'wind'
      )?.payload;
    const activeWithSoul = tuningPayload(withSoul, activeActionId);
    const activeWithoutSoul = tuningPayload(withoutSoul, activeActionId);
    const expiredWithSoul = tuningPayload(withSoul, expiredActionId);
    const expiredWithoutSoul = tuningPayload(withoutSoul, expiredActionId);

    expect(getEvents).toHaveLength(2);
    expect(getEvents.map(event => event.eventId)).toEqual([9, 10]);
    expect(getEvents[0]).toMatchObject({
      phase: 'before-mutation',
      before: 0,
      delta: 1,
      after: 1,
      eventContext: expect.objectContaining({
        elementId: 750,
        acquisitionSourceKind: 'verified-action-effect',
        sourceActorId: 'actor-107002',
      }),
    });
    expect(commands).toHaveLength(3);
    expect(commands.map(command => command.targetId).sort()).toEqual([
      'actor-101003',
      'actor-101010',
      'actor-107002',
    ]);
    expect(commands[0]).toMatchObject({
      sourceActionId,
      sourceActorId: 'actor-107002',
      sourceTuningEventIdentity: getEvents[0].eventIdentity,
      timeMs: frameToMs(150),
      durationMs: 16000,
      stackMode: 'stack',
      maxStacks: 5,
      modifiers: [
        expect.objectContaining({
          attributeId: 229,
          sourceRawA: 75000,
          evaluatedValue: 7.5,
        }),
      ],
    });
    expect(activeWithSoul.mastery - activeWithoutSoul.mastery).toBeCloseTo(
      7.5,
      6
    );
    expect(activeWithSoul.rawDamage).toBeGreaterThanOrEqual(
      activeWithoutSoul.rawDamage
    );
    expect(expiredWithSoul.mastery).toBeCloseTo(expiredWithoutSoul.mastery, 6);
    expect(expiredWithSoul.rawDamage).toBeCloseTo(
      expiredWithoutSoul.rawDamage,
      6
    );
  });

  it('stacks 10043 from canonical before-acquire transactions, caps at five and refreshes at cap', () => {
    const definition = soulEssenceEffectCatalog.definitions.find(
      entry => entry.soulEssenceId === 10043
    );
    const actorId = 'actor-107002';
    const action = {
      ...createRealSoulActionDraft({
        id: 'c5-wind-stack-source',
        actionKind: 'star-skill',
        startFrame: 60,
        actorCharacterId: 107002,
      }),
      actorId,
    };
    const resolution = resolveVerifiedCombatActionMechanics(action);
    const events = Array.from({ length: 6 }, (_value, index) =>
      createCanonicalGetElementEvent({
        action,
        markId: 750,
        eventId: 9,
        transactionIndex: index,
        before: Math.min(index, 5),
        after: Math.min(index + 1, 5),
      })
    );
    const scenario = {
      time: { fps: 60, durationMs: 30000 },
      actors: [createSoulMatrixActor({ actorId, definition })],
      actions: [action],
    };
    const actionExecutionPlan = {
      actions: [{ actionId: action.id, execute: true }],
    };
    const generation = createVerifiedSoulEssenceEffectGeneration({
      scenario,
      actionExecutionPlan,
      actionResolutionById: new Map([[action.id, resolution]]),
      tuningGeneration: { getElementEvents: events },
    });
    const timeline = createEffectRuntimeTimeline({
      scenario,
      actionExecutionPlan,
      generatedCommands: generation.effectCommands,
    });
    const finalTriggerTime = events.at(-1).timeMs;
    const active = resolveActiveEffectsAt(timeline, finalTriggerTime, {
      targetKind: 'actor',
      targetId: actorId,
      calculatorOnly: true,
    });

    expect(generation.effectCommands).toHaveLength(6);
    expect(active).toHaveLength(1);
    expect(active[0].stacks).toBe(5);
    expect(active[0].expiresAtMs).toBeCloseTo(finalTriggerTime + 16000, 3);
    expect(
      resolveActiveEffectsAt(timeline, finalTriggerTime + 16000, {
        targetKind: 'actor',
        targetId: actorId,
        calculatorOnly: true,
      })
    ).toEqual([]);
  });

  it('keeps 10043 scoped to the equipped actor and ignores inherited, wrong-element and blocked acquisition attempts', () => {
    const inheritedOnly = createRealSoulScenario({
      actorCharacterId: 107002,
      soulEssenceId: 10043,
      effectSkillId: 1900330,
      initialRuntimeState: {
        tuningMarks: [createInheritedTuningMark(750, 1, 20_000)],
      },
      actionPlan: [],
    });
    const wrongElement = createRealSoulScenario({
      actorCharacterId: 108001,
      soulEssenceId: 10043,
      effectSkillId: 1900330,
      actionPlan: [
        {
          id: 'c5-before-wrong-fire',
          actionKind: 'star-skill',
          actorCharacterId: 108001,
          startFrame: 60,
        },
      ],
    });
    const wrongSource = createRealSoulScenario({
      actorCharacterId: 107002,
      soulEssenceId: 10043,
      effectSkillId: 1900330,
      durationMs: frameToMs(900),
      teamCharacterIds: [107002, 107001, 101003],
      actionPlan: [
        {
          id: 'c5-before-source-switch',
          actionKind: 'switch',
          sourceCharacterId: 107002,
          targetCharacterId: 107001,
          startFrame: 0,
        },
        {
          id: 'c5-before-teammate-wind',
          actionKind: 'star-skill',
          actorCharacterId: 107001,
          startFrame: 300,
        },
      ],
    });
    const blocked = createRealSoulScenario({
      actorCharacterId: 107002,
      soulEssenceId: 10043,
      effectSkillId: 1900330,
      actionPlan: [
        {
          id: 'c5-before-allowed',
          actionKind: 'star-skill',
          actorCharacterId: 107002,
          startFrame: 60,
        },
        {
          id: 'c5-before-cooldown-blocked',
          actionKind: 'star-skill',
          actorCharacterId: 107002,
          startFrame: 420,
        },
      ],
    });
    const allMiss = createRealSoulScenario({
      actorCharacterId: 107002,
      soulEssenceId: 10043,
      effectSkillId: 1900330,
      combatScenario: {
        projectile: { targetDistance: 0, defaultWillHit: false },
      },
      actionPlan: [
        {
          id: 'c5-before-all-miss',
          actionKind: 'star-skill',
          actorCharacterId: 107002,
          startFrame: 60,
        },
      ],
    });

    expect(
      inheritedOnly.verifiedSoulEssenceEffectGeneration.effectCommands
    ).toEqual([]);
    expect(
      wrongElement.verifiedSoulEssenceEffectGeneration.effectCommands
    ).toEqual([]);
    expect(
      wrongSource.verifiedTuningMarkGeneration.getElementEvents.some(
        event => event.actionId === 'c5-before-teammate-wind'
      )
    ).toBe(true);
    expect(
      wrongSource.verifiedSoulEssenceEffectGeneration.effectCommands
    ).toEqual([]);
    expect(
      blocked.verifiedSoulEssenceEffectGeneration.effectCommands.some(
        command => command.sourceActionId === 'c5-before-cooldown-blocked'
      )
    ).toBe(false);
    expect(
      allMiss.verifiedSoulEssenceEffectGeneration.effectCommands.filter(
        command => command.sourceActionId === 'c5-before-all-miss'
      )
    ).toHaveLength(3);
  });

  it('bridges a real fire-mark acquisition to 10149 after mutation, refreshes and changes teammate tuning settlement', () => {
    const sourceActorId = 108001;
    const sourceActionId = 'c5-fire-acquire-source';
    const activeActionId = 'c5-fire-buff-active';
    const actionPlan = [
      {
        id: sourceActionId,
        actionKind: 'star-skill',
        actorCharacterId: sourceActorId,
        startFrame: 60,
      },
      {
        id: 'c5-fire-switch',
        actionKind: 'switch',
        sourceCharacterId: sourceActorId,
        targetCharacterId: 101003,
        startFrame: 400,
      },
      {
        id: activeActionId,
        actionKind: 'normal-attack',
        actorCharacterId: 101003,
        startFrame: 720,
      },
    ];
    const simulate = effectSkillId =>
      createRealSoulScenario({
        actorCharacterId: sourceActorId,
        soulEssenceId: effectSkillId == null ? null : 10149,
        effectSkillId,
        durationMs: frameToMs(1000),
        teamCharacterIds: [sourceActorId, 101003, 101010],
        actionPlan,
      });
    const withSoul = simulate(1900220);
    const withoutSoul = simulate(null);
    const commands =
      withSoul.verifiedSoulEssenceEffectGeneration.effectCommands.filter(
        command => command.sourceSoulEssenceId === 10149
      );
    const getEvents =
      withSoul.verifiedTuningMarkGeneration.getElementEvents.filter(
        event => event.actionId === sourceActionId && event.markId === 150
      );
    const tuningPayload = result =>
      result.verifiedCombatRuntime.damageEvents.find(
        event =>
          event.type === 'VERIFIED_TUNING_DAMAGE' &&
          event.actionId === activeActionId &&
          event.payload.profileKey === 'fire'
      )?.payload;
    const activeWithSoul = tuningPayload(withSoul);
    const activeWithoutSoul = tuningPayload(withoutSoul);

    expect(getEvents).toHaveLength(2);
    expect(getEvents.map(event => event.eventId)).toEqual([9, 10]);
    expect(getEvents[1]).toMatchObject({
      phase: 'after-mutation',
      before: 0,
      delta: 1,
      after: 1,
      eventContext: expect.objectContaining({
        elementId: 150,
        sourceActorId: 'actor-108001',
      }),
    });
    expect(commands).toHaveLength(3);
    expect(commands[0]).toMatchObject({
      sourceActionId,
      sourceActorId: 'actor-108001',
      sourceTuningEventIdentity: getEvents[1].eventIdentity,
      timeMs: frameToMs(79),
      durationMs: 24000,
      stackMode: 'refresh',
      maxStacks: 1,
      modifiers: [
        expect.objectContaining({
          attributeId: 229,
          sourceRawA: 45,
          evaluatedValue: 45,
        }),
      ],
    });
    expect(activeWithSoul.mastery - activeWithoutSoul.mastery).toBeCloseTo(
      45,
      6
    );
    expect(activeWithSoul.rawDamage).toBeGreaterThan(
      activeWithoutSoul.rawDamage
    );

    const targetCommand = commands.find(
      command => command.targetId === 'actor-101003'
    );
    const inheritedFire = createInheritedTuningMark(150, 1, 60_000);
    const activeReplay = replayRealActionWithSoulCommands({
      actorCharacterId: 101003,
      soulEssenceId: 10149,
      actionId: 'c5-fire-replay-active',
      actionKind: 'normal-attack',
      startFrame: 720,
      commands: [targetCommand],
      initialRuntimeState: { tuningMarks: [inheritedFire] },
    });
    const expiredReplay = replayRealActionWithSoulCommands({
      actorCharacterId: 101003,
      soulEssenceId: 10149,
      actionId: 'c5-fire-replay-expired',
      actionKind: 'normal-attack',
      startFrame: 1520,
      commands: [targetCommand],
      initialRuntimeState: { tuningMarks: [inheritedFire] },
    });
    const replayPayload = (runtime, actionId) =>
      runtime.damageEvents.find(
        event =>
          event.type === 'VERIFIED_TUNING_DAMAGE' &&
          event.actionId === actionId &&
          event.payload.profileKey === 'fire'
      )?.payload;
    expect(
      replayPayload(activeReplay.withCommands, 'c5-fire-replay-active')
        .rawDamage
    ).toBeGreaterThan(
      replayPayload(activeReplay.withoutCommands, 'c5-fire-replay-active')
        .rawDamage
    );
    expect(
      replayPayload(expiredReplay.withCommands, 'c5-fire-replay-expired')
        .rawDamage
    ).toBeCloseTo(
      replayPayload(expiredReplay.withoutCommands, 'c5-fire-replay-expired')
        .rawDamage,
      6
    );
  });

  it('refreshes 10149 from repeated real acquisitions and rejects inherited, wrong-element, wrong-source and blocked events', () => {
    const sourceActorId = 108001;
    const refreshed = createRealSoulScenario({
      actorCharacterId: sourceActorId,
      soulEssenceId: 10149,
      effectSkillId: 1900220,
      durationMs: frameToMs(2800),
      teamCharacterIds: [sourceActorId, 101003, 101010],
      actionPlan: [
        {
          id: 'c5-fire-refresh-1',
          actionKind: 'star-skill',
          actorCharacterId: sourceActorId,
          startFrame: 60,
        },
        {
          id: 'c5-fire-refresh-2',
          actionKind: 'star-skill',
          actorCharacterId: sourceActorId,
          startFrame: 1200,
        },
      ],
    });
    const commands =
      refreshed.verifiedSoulEssenceEffectGeneration.effectCommands.filter(
        command => command.sourceSoulEssenceId === 10149
      );
    const sourceCommands = commands.filter(
      command => command.targetId === 'actor-108001'
    );
    const secondTriggerTime = sourceCommands.at(-1).timeMs;

    expect(sourceCommands.map(command => command.sourceActionId)).toEqual([
      'c5-fire-refresh-1',
      'c5-fire-refresh-2',
    ]);
    const refreshedSoulEffects = resolveActiveEffectsAt(
      refreshed.effectTimeline,
      secondTriggerTime + 0.001,
      {
        targetKind: 'actor',
        targetId: 'actor-108001',
        calculatorOnly: true,
      }
    ).filter(effect => effect.effectId === sourceCommands[0].effectId);
    expect(refreshedSoulEffects).toHaveLength(1);
    expect(refreshedSoulEffects[0].stacks).toBe(1);
    expect(refreshedSoulEffects[0].refreshCount).toBe(1);
    expect(refreshedSoulEffects[0].expiresAtMs).toBeCloseTo(
      secondTriggerTime + 24000,
      3
    );

    const inheritedOnly = createRealSoulScenario({
      actorCharacterId: sourceActorId,
      soulEssenceId: 10149,
      effectSkillId: 1900220,
      initialRuntimeState: {
        tuningMarks: [createInheritedTuningMark(150, 1, 20_000)],
      },
      actionPlan: [],
    });
    const wrongElement = createRealSoulScenario({
      actorCharacterId: 107002,
      soulEssenceId: 10149,
      effectSkillId: 1900220,
      actionPlan: [
        {
          id: 'c5-wrong-wind-acquire',
          actionKind: 'star-skill',
          actorCharacterId: 107002,
          startFrame: 60,
        },
      ],
    });
    const blocked = createRealSoulScenario({
      actorCharacterId: sourceActorId,
      soulEssenceId: 10149,
      effectSkillId: 1900220,
      actionPlan: [
        {
          id: 'c5-fire-allowed',
          actionKind: 'star-skill',
          actorCharacterId: sourceActorId,
          startFrame: 60,
        },
        {
          id: 'c5-fire-cooldown-blocked',
          actionKind: 'star-skill',
          actorCharacterId: sourceActorId,
          startFrame: 400,
        },
      ],
    });
    const wrongSource = createRealSoulScenario({
      actorCharacterId: sourceActorId,
      soulEssenceId: 10149,
      effectSkillId: 1900220,
      durationMs: frameToMs(900),
      teamCharacterIds: [sourceActorId, 101003, 101010],
      actionPlan: [
        {
          id: 'c5-after-source-switch',
          actionKind: 'switch',
          sourceCharacterId: sourceActorId,
          targetCharacterId: 101003,
          startFrame: 0,
        },
        {
          id: 'c5-after-teammate-fire',
          actionKind: 'star-skill',
          actorCharacterId: 101003,
          startFrame: 300,
        },
      ],
    });
    const atCap = createRealSoulScenario({
      actorCharacterId: sourceActorId,
      soulEssenceId: 10149,
      effectSkillId: 1900220,
      initialRuntimeState: {
        tuningMarks: [createInheritedTuningMark(150, 5, 20_000)],
      },
      actionPlan: [
        {
          id: 'c5-after-refresh-at-cap',
          actionKind: 'star-skill',
          actorCharacterId: sourceActorId,
          startFrame: 60,
        },
      ],
    });
    const allMiss = createRealSoulScenario({
      actorCharacterId: sourceActorId,
      soulEssenceId: 10149,
      effectSkillId: 1900220,
      combatScenario: {
        projectile: { targetDistance: 0, defaultWillHit: false },
      },
      actionPlan: [
        {
          id: 'c5-fire-all-miss',
          actionKind: 'star-skill',
          actorCharacterId: sourceActorId,
          startFrame: 60,
        },
      ],
    });

    expect(
      inheritedOnly.verifiedSoulEssenceEffectGeneration.effectCommands
    ).toEqual([]);
    expect(
      wrongElement.verifiedSoulEssenceEffectGeneration.effectCommands
    ).toEqual([]);
    expect(
      blocked.verifiedSoulEssenceEffectGeneration.effectCommands.some(
        command => command.sourceActionId === 'c5-fire-cooldown-blocked'
      )
    ).toBe(false);
    expect(
      wrongSource.verifiedTuningMarkGeneration.getElementEvents.some(
        event => event.actionId === 'c5-after-teammate-fire'
      )
    ).toBe(true);
    expect(
      wrongSource.verifiedSoulEssenceEffectGeneration.effectCommands
    ).toEqual([]);
    expect(
      atCap.verifiedTuningMarkGeneration.getElementEvents.find(
        event =>
          event.actionId === 'c5-after-refresh-at-cap' && event.eventId === 10
      )
    ).toMatchObject({
      before: 5,
      delta: 0,
      after: 5,
      outcome: 'refresh-at-cap',
      applied: true,
    });
    expect(
      atCap.verifiedSoulEssenceEffectGeneration.effectCommands.filter(
        command => command.sourceActionId === 'c5-after-refresh-at-cap'
      )
    ).toHaveLength(3);
    expect(
      allMiss.verifiedSoulEssenceEffectGeneration.effectCommands.filter(
        command => command.sourceActionId === 'c5-fire-all-miss'
      )
    ).toHaveLength(3);
  });

  it('turns a real type-41 mark acquisition into 10052 healing output with right-open expiry', () => {
    const run = ({
      soulEssenceStar,
      generatedCommands = true,
      initialCurrentHp = 1,
      healFrames = [149, 151, 750],
    }) => {
      const sourceActionId = `c8-wind-mark-star-${soulEssenceStar}`;
      const projection = createRealSoulScenario({
        actorCharacterId: 107002,
        soulEssenceId: 10052,
        effectSkillId: 1900910,
        soulEssenceStar,
        durationMs: frameToMs(900),
        initialRuntimeState: {
          actorVitalsByActor: [
            {
              actorId: 'actor-107002',
              characterId: 107002,
              currentValue: initialCurrentHp,
            },
          ],
        },
        actionPlan: [
          {
            id: sourceActionId,
            actionKind: 'star-skill',
            actorCharacterId: 107002,
            startFrame: 60,
          },
        ],
      });
      const scenario = projection.effectiveActionTimeline.scenario;
      const sourceAction = scenario.actions.find(
        action => action.id === sourceActionId
      );
      const sourceResolution =
        projection.verifiedActionVariantRuntime.actionResolutionById.get(
          sourceActionId
        );
      const command =
        projection.verifiedSoulEssenceEffectGeneration.effectCommands.find(
          entry => entry.sourceSoulEssenceId === 10052
        );
      const triggerSequencePath = command.sourceIdentity.triggerSequencePath;
      const directHpEvents = healFrames.map((entry, index) => {
        const frame = typeof entry === 'number' ? entry : entry.frame;
        const relativeToTrigger =
          typeof entry === 'number' ? null : entry.relativeToTrigger;
        const triggerTail = Number(triggerSequencePath.at(-1));
        const sourceSequencePath = relativeToTrigger
          ? [
              ...triggerSequencePath.slice(0, -1),
              triggerTail + (relativeToTrigger === 'before' ? -1 : 1),
            ]
          : createFixtureDirectEffectSourceSequencePath(
              sourceAction,
              frame,
              index
            );
        return {
          eventIdentity: `fixture:c8-direct-heal:${soulEssenceStar}:${frame}:${index}`,
          timeMs: frameToMs(frame),
          action: sourceAction,
          actionId: sourceAction.id,
          actorId: sourceAction.actorId,
          target: { kind: 'actor', id: sourceAction.actorId },
          value: 100,
          sourceSequencePath,
          sourceSequenceStatus: 'verified-direct-effect-source-sequence-ready',
          applied: true,
          effect: {
            effectIdentity: `fixture:c8-direct-heal-effect:${index}`,
          },
          resolution: sourceResolution,
          sourceIdentity: 'fixture:c8-direct-heal-settlement',
        };
      });
      const effectTimeline = createEffectRuntimeTimeline({
        scenario,
        actionExecutionPlan: projection.actionExecutionPlan,
        controlledActorTimeline: projection.controlledActorTimeline,
        generatedCommands: generatedCommands ? [command] : [],
      });
      const runtime = createVerifiedCombatRuntime({
        scenario,
        actionExecutionPlan: projection.actionExecutionPlan,
        controlledActorTimeline: projection.controlledActorTimeline,
        effectGeneration: {
          ...projection.verifiedBattleEffectGeneration,
          directHpEvents,
        },
        tuningGeneration: projection.verifiedTuningMarkGeneration,
        damageEventGeneration: projection.verifiedDamageEventGeneration,
        effectTimeline,
        actionVariantRuntime: projection.verifiedActionVariantRuntime,
        kiboPassiveGeneration: projection.verifiedKiboPassiveGeneration,
      });
      return {
        command,
        getElementEvents:
          projection.verifiedTuningMarkGeneration.getElementEvents,
        heals: runtime.vitalEvents.filter(
          event => event.type === 'VERIFIED_DIRECT_HEAL'
        ),
        runtime,
        effectTimeline,
      };
    };

    const star1 = run({ soulEssenceStar: 1 });
    const star4 = run({ soulEssenceStar: 4 });
    const baseline = run({ soulEssenceStar: 1, generatedCommands: false });

    expect(
      star1.getElementEvents.map(event => event.eventContext.elementId)
    ).toEqual([750, 750]);
    expect(
      star1.getElementEvents.some(event =>
        [751, 752].includes(event.eventContext.elementId)
      )
    ).toBe(false);
    expect(star1.getElementEvents[1].eventContext).toMatchObject({
      elementId: 750,
      elementTypes: [32, 41, 1001],
      elementTypeSourceIdentity:
        'battle-element-assets.jsonl#path_id=1474042154774785480.types',
    });
    expect(star1.command).toMatchObject({
      sourceSoulEssenceId: 10052,
      sourceActorId: 'actor-107002',
      targetId: 'actor-107002',
      timeMs: frameToMs(150),
      durationMs: 10000,
      stackMode: 'refresh',
      maxStacks: 1,
      modifiers: [
        expect.objectContaining({
          attributeId: 23,
          sourceRawA: 1070,
          evaluatedValue: 1070,
        }),
      ],
    });
    expect(star1.heals.map(event => event.payload.requestedChange)).toEqual([
      100, 111, 100,
    ]);
    expect(
      star1.heals.map(event => event.payload.sourceShootHealUpRaw)
    ).toEqual([0, 1070, 0]);
    expect(star4.heals.map(event => event.payload.requestedChange)).toEqual([
      100, 119, 100,
    ]);
    expect(star4.heals[1].payload).toMatchObject({
      sourceShootHealUpRaw: 1870,
      targetSufferHealUpRaw: 0,
      healUpFactor: 1.187,
      roundingPolicy: 'nearest-ties-to-even',
    });
    expect(baseline.heals.map(event => event.payload.requestedChange)).toEqual([
      100, 100, 100,
    ]);

    const maximumHp = star1.runtime.initialState.actorVitals.find(
      entry => entry.actorId === 'actor-107002'
    ).maximumHp;
    const clamped = run({
      soulEssenceStar: 1,
      initialCurrentHp: maximumHp - 50,
      healFrames: [151],
    });
    expect(clamped.heals[0].payload).toMatchObject({
      requestedChange: 111,
      change: 50,
      overheal: 61,
      sourceShootHealUpRaw: 1070,
    });

    const sameFrame = run({
      soulEssenceStar: 1,
      healFrames: [
        { frame: 150, relativeToTrigger: 'before' },
        { frame: 150, relativeToTrigger: 'after' },
      ],
    });
    expect(sameFrame.heals.map(event => event.payload.requestedChange)).toEqual(
      [100, 111]
    );
  });

  it('keeps generated direct-effect settlement order local to its source provenance', () => {
    const sourceActionId = 'c8-r1-generated-direct-effects';
    const projection = createRealSoulScenario({
      actorCharacterId: 107002,
      soulEssenceId: 10052,
      effectSkillId: 1900910,
      soulEssenceStar: 1,
      durationMs: frameToMs(900),
      initialRuntimeState: {
        actorVitalsByActor: [
          {
            actorId: 'actor-107002',
            characterId: 107002,
            currentValue: 1,
          },
        ],
      },
      actionPlan: [
        {
          id: sourceActionId,
          actionKind: 'star-skill',
          actorCharacterId: 107002,
          startFrame: 60,
        },
      ],
    });
    const scenario = projection.effectiveActionTimeline.scenario;
    const action = scenario.actions.find(entry => entry.id === sourceActionId);
    const resolution =
      projection.verifiedActionVariantRuntime.actionResolutionById.get(
        sourceActionId
      );
    const markEffect = resolution.effects.find(
      effect =>
        Number(effect.tuningMark?.markId) === 750 &&
        Number(effect.trigger?.startFrame) === 90
    );
    expect(markEffect.sourceOrder).toMatchObject({
      status: 'verified-battle-effect-source-order-ready',
      mapIndex: 0,
      referenceKind: 'elements',
      elementIndex: 3,
    });

    const createSourceOrder = (elementIndex, sourceIdentity) => ({
      ...markEffect.sourceOrder,
      elementIndex,
      nodeTraversalIndex: 0,
      triggerIndex: 0,
      sourceIdentity,
    });
    const valueByLevel = Object.fromEntries(
      Array.from({ length: 12 }, (_, index) => [String(index + 1), 100])
    );
    const createDirectEffect = ({
      effectIdentity,
      kind,
      elementIndex,
      startFrame = 90,
    }) => ({
      effectIdentity,
      role: 'gameplay-effect',
      classification: 'applied',
      trigger: {
        ...markEffect.trigger,
        startFrame,
      },
      target: {
        kind: 'source-owner',
        sourceIdentity: `fixture:${effectIdentity}:target`,
      },
      lifecycle: {
        durationMs: null,
        stackMode: 'replace',
        stackDelta: 1,
        maxStacks: 1,
      },
      propertyChange: null,
      directSp: kind === 'direct-sp' ? { valueByLevel } : null,
      heal: kind === 'direct-heal' ? { valueByLevel } : null,
      shield: kind === 'direct-shield' ? { valueByLevel } : null,
      formula: {
        commonFunctionId: 1,
        baseFunctionId: 5,
      },
      sourceOrder: createSourceOrder(
        elementIndex,
        `fixture:${effectIdentity}:source-order`
      ),
      sourceIdentity: `fixture:${effectIdentity}`,
    });
    const directEffects = [
      createDirectEffect({
        effectIdentity: 'fixture:c8-r1:heal-before-acquire',
        kind: 'direct-heal',
        elementIndex: 2,
      }),
      createDirectEffect({
        effectIdentity: 'fixture:c8-r1:heal-after-acquire',
        kind: 'direct-heal',
        elementIndex: 4,
      }),
      createDirectEffect({
        effectIdentity: 'fixture:c8-r1:direct-sp-provenance',
        kind: 'direct-sp',
        elementIndex: 5,
        startFrame: 91,
      }),
      createDirectEffect({
        effectIdentity: 'fixture:c8-r1:direct-shield-provenance',
        kind: 'direct-shield',
        elementIndex: 6,
        startFrame: 92,
      }),
    ];
    const generated = createVerifiedBattleEffectGeneration({
      scenario,
      actionExecutionPlan: projection.actionExecutionPlan,
      actionResolutionById: new Map([
        [
          sourceActionId,
          {
            ...resolution,
            semanticEffects: directEffects,
            effects: directEffects,
          },
        ],
      ]),
      controlledActorTimeline: projection.controlledActorTimeline,
    });
    expect(generated.directHpEvents).toHaveLength(2);
    expect(
      generated.directHpEvents.map(event => event.sourceSequenceStatus)
    ).toEqual([
      'verified-direct-effect-source-sequence-ready',
      'verified-direct-effect-source-sequence-ready',
    ]);
    expect(generated.directSpEvents[0].sourceSequencePath).toEqual(
      expect.any(Array)
    );
    expect(generated.shieldEvents[0].sourceSequencePath).toEqual(
      expect.any(Array)
    );
    const reversedGeneration = createVerifiedBattleEffectGeneration({
      scenario,
      actionExecutionPlan: projection.actionExecutionPlan,
      actionResolutionById: new Map([
        [
          sourceActionId,
          {
            ...resolution,
            semanticEffects: [...directEffects].reverse(),
            effects: [...directEffects].reverse(),
          },
        ],
      ]),
      controlledActorTimeline: projection.controlledActorTimeline,
    });
    const indexDirectPaths = generation =>
      Object.fromEntries(
        [
          ...generation.directHpEvents,
          ...generation.directSpEvents,
          ...generation.shieldEvents,
        ].map(event => [event.eventIdentity, event.sourceSequencePath])
      );
    expect(indexDirectPaths(reversedGeneration)).toEqual(
      indexDirectPaths(generated)
    );

    const command =
      projection.verifiedSoulEssenceEffectGeneration.effectCommands.find(
        entry => entry.sourceSoulEssenceId === 10052
      );
    const effectTimeline = createEffectRuntimeTimeline({
      scenario,
      actionExecutionPlan: projection.actionExecutionPlan,
      controlledActorTimeline: projection.controlledActorTimeline,
      generatedCommands: [command],
    });
    const createDecoy = index => ({
      eventIdentity: `fixture:c8-r1:out-of-horizon:${index}`,
      kind: 'direct-sp',
      timeMs: frameToMs(901 + index),
      action,
      actionId: action.id,
      actorId: action.actorId,
      target: { kind: 'actor', id: action.actorId },
      value: 0,
      effect: { effectIdentity: `fixture:c8-r1:decoy:${index}` },
      resolution,
      sourceIdentity: 'fixture:c8-r1:legacy-decoy',
    });
    const run = decoyCount =>
      createVerifiedCombatRuntime({
        scenario,
        actionExecutionPlan: projection.actionExecutionPlan,
        controlledActorTimeline: projection.controlledActorTimeline,
        effectGeneration: {
          ...generated,
          directSpEvents: [
            ...Array.from({ length: decoyCount }, (_, index) =>
              createDecoy(index)
            ),
            ...generated.directSpEvents,
          ],
        },
        tuningGeneration: projection.verifiedTuningMarkGeneration,
        damageEventGeneration: projection.verifiedDamageEventGeneration,
        effectTimeline,
        actionVariantRuntime: projection.verifiedActionVariantRuntime,
        kiboPassiveGeneration: projection.verifiedKiboPassiveGeneration,
      });
    const baseline = run(0);
    const withUnexecutedDescriptors = run(30);
    const requestedChanges = runtime =>
      runtime.vitalEvents
        .filter(event => event.type === 'VERIFIED_DIRECT_HEAL')
        .map(event => event.payload.requestedChange);
    expect(requestedChanges(baseline)).toEqual([100, 111]);
    expect(requestedChanges(withUnexecutedDescriptors)).toEqual([100, 111]);

    const legacyGenerated = {
      ...generated,
      directHpEvents: [
        {
          ...generated.directHpEvents[0],
          sourceSequencePath: undefined,
          sourceSequenceStatus: undefined,
        },
      ],
      directSpEvents: [],
      shieldEvents: [],
    };
    const legacyRuntime = createVerifiedCombatRuntime({
      scenario,
      actionExecutionPlan: projection.actionExecutionPlan,
      controlledActorTimeline: projection.controlledActorTimeline,
      effectGeneration: legacyGenerated,
      tuningGeneration: projection.verifiedTuningMarkGeneration,
      damageEventGeneration: projection.verifiedDamageEventGeneration,
      effectTimeline,
      actionVariantRuntime: projection.verifiedActionVariantRuntime,
      kiboPassiveGeneration: projection.verifiedKiboPassiveGeneration,
    });
    expect(
      legacyRuntime.vitalEvents.filter(
        event => event.type === 'VERIFIED_DIRECT_HEAL'
      )
    ).toEqual([]);
    expect(legacyRuntime.eventLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'VERIFIED_DIRECT_EFFECT_SOURCE_SEQUENCE_UNRESOLVED',
          actionId: sourceActionId,
        }),
      ])
    );
  });

  it('matches 10052 from native mark-container types without linked-leaf or damage-element double dispatch', () => {
    const realAcquire = ({ actorCharacterId, actionId }) =>
      createRealSoulScenario({
        actorCharacterId,
        soulEssenceId: 10052,
        effectSkillId: 1900910,
        durationMs: frameToMs(900),
        actionPlan: [
          {
            id: actionId,
            actionKind: 'star-skill',
            actorCharacterId,
            startFrame: 60,
          },
        ],
      });
    const wind = realAcquire({
      actorCharacterId: 107002,
      actionId: 'c8-native-wind-mark',
    });
    const fire = realAcquire({
      actorCharacterId: 108001,
      actionId: 'c8-native-fire-mark',
    });
    const windCommands =
      wind.verifiedSoulEssenceEffectGeneration.effectCommands.filter(
        command => command.sourceSoulEssenceId === 10052
      );
    const fireCommands =
      fire.verifiedSoulEssenceEffectGeneration.effectCommands.filter(
        command => command.sourceSoulEssenceId === 10052
      );

    expect(windCommands).toHaveLength(1);
    expect(fireCommands).toHaveLength(1);
    expect(
      wind.verifiedTuningMarkGeneration.getElementEvents.map(event => [
        event.eventId,
        event.eventContext.elementId,
        event.eventContext.elementTypes,
      ])
    ).toEqual([
      [9, 750, [32, 41, 1001]],
      [10, 750, [32, 41, 1001]],
    ]);
    expect(
      fire.verifiedTuningMarkGeneration.getElementEvents.map(event => [
        event.eventId,
        event.eventContext.elementId,
        event.eventContext.elementTypes,
      ])
    ).toEqual([
      [9, 150, [31, 41, 1001]],
      [10, 150, [31, 41, 1001]],
    ]);
    for (const result of [wind, fire]) {
      expect(
        result.verifiedTuningMarkGeneration.getElementEvents.some(event =>
          [751, 752].includes(event.eventContext.elementId)
        )
      ).toBe(false);
    }

    const wrongSource = createRealSoulScenario({
      actorCharacterId: 107002,
      soulEssenceId: 10052,
      effectSkillId: 1900910,
      durationMs: frameToMs(900),
      teamCharacterIds: [107002, 101003, 101010],
      actionPlan: [
        {
          id: 'c8-switch-to-teammate',
          actionKind: 'switch',
          sourceCharacterId: 107002,
          targetCharacterId: 101003,
          startFrame: 0,
        },
        {
          id: 'c8-teammate-fire-mark',
          actionKind: 'star-skill',
          actorCharacterId: 101003,
          startFrame: 60,
        },
      ],
    });
    const inherited = createRealSoulScenario({
      actorCharacterId: 107002,
      soulEssenceId: 10052,
      effectSkillId: 1900910,
      initialRuntimeState: {
        tuningMarks: [createInheritedTuningMark(750, 1, 20_000)],
      },
      actionPlan: [],
    });
    const blocked = createRealSoulScenario({
      actorCharacterId: 107002,
      soulEssenceId: 10052,
      effectSkillId: 1900910,
      actionPlan: [
        {
          id: 'c8-wind-allowed',
          actionKind: 'star-skill',
          actorCharacterId: 107002,
          startFrame: 60,
        },
        {
          id: 'c8-wind-cooldown-blocked',
          actionKind: 'star-skill',
          actorCharacterId: 107002,
          startFrame: 420,
        },
      ],
    });

    expect(
      wrongSource.verifiedTuningMarkGeneration.getElementEvents.some(
        event => event.actionId === 'c8-teammate-fire-mark'
      )
    ).toBe(true);
    expect(
      wrongSource.verifiedSoulEssenceEffectGeneration.effectCommands
    ).toEqual([]);
    expect(inherited.verifiedTuningMarkGeneration.getElementEvents).toEqual([]);
    expect(
      inherited.verifiedSoulEssenceEffectGeneration.effectCommands
    ).toEqual([]);
    expect(
      blocked.verifiedSoulEssenceEffectGeneration.effectCommands.some(
        command => command.sourceActionId === 'c8-wind-cooldown-blocked'
      )
    ).toBe(false);
  });

  it('enforces the native 10ms trigger interval for 10052 and refreshes one self instance', () => {
    const definition = soulEssenceEffectCatalog.definitions.find(
      entry => entry.soulEssenceId === 10052
    );
    const actorId = 'actor-107002';
    const action = {
      ...createRealSoulActionDraft({
        id: 'c8-trigger-interval-source',
        actionKind: 'star-skill',
        startFrame: 0,
        actorCharacterId: 107002,
      }),
      actorId,
      sourceSequenceIndex: 0,
      sourceSequencePath: [0],
    };
    const resolution = resolveVerifiedCombatActionMechanics(action);
    const events = [1000, 1009, 1010].map((timeMs, index) => {
      const event = createCanonicalGetElementEvent({
        action,
        markId: 750,
        eventId: 10,
        transactionIndex: index,
        before: index === 2 ? 5 : index,
        after: index === 2 ? 5 : index + 1,
      });
      event.timeMs = timeMs;
      event.eventContext.timeMs = timeMs;
      return event;
    });
    const scenario = {
      time: { fps: 60, durationMs: 12000 },
      actors: [createSoulMatrixActor({ actorId, definition })],
      actions: [action],
    };
    const actionExecutionPlan = {
      actions: [{ actionId: action.id, execute: true }],
    };
    const generation = createVerifiedSoulEssenceEffectGeneration({
      scenario,
      actionExecutionPlan,
      actionResolutionById: new Map([[action.id, resolution]]),
      tuningGeneration: { getElementEvents: events },
    });
    const timeline = createEffectRuntimeTimeline({
      scenario,
      actionExecutionPlan,
      generatedCommands: generation.effectCommands,
    });

    expect(generation.effectCommands.map(command => command.timeMs)).toEqual([
      1000, 1010,
    ]);
    expect(events[2]).toMatchObject({
      delta: 0,
      outcome: 'refresh-at-cap',
      applied: true,
    });
    expect(generation.suppressions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          timeMs: 1009,
          intervalMs: 10,
          reason: 'soulessence-effect-trigger-interval-active',
        }),
      ])
    );
    expect(
      resolveActiveEffectsAt(timeline, 1010.001, {
        targetKind: 'actor',
        targetId: actorId,
        calculatorOnly: true,
      })
    ).toEqual([
      expect.objectContaining({
        targetId: actorId,
        stacks: 1,
        refreshCount: 1,
        expiresAtMs: 11010,
      }),
    ]);
    expect(
      resolveActiveEffectsAt(timeline, 11010, {
        targetKind: 'actor',
        targetId: actorId,
        calculatorOnly: true,
      })
    ).toEqual([]);
  });

  it('settles 10044 before the matching overlimit packet without leaking fire damage into wind', () => {
    const fireActionId = 'c6-ruby-enhanced-e3-before-damage';
    const simulateFire = effectSkillId =>
      createRealSoulScenario({
        actorCharacterId: 103002,
        soulEssenceId: 10044,
        effectSkillId,
        durationMs: 12_000,
        initialRuntimeState: {
          enemy: {
            hp: { currentValue: 1_000_000, maxValue: 1_000_000 },
            toughness: { currentValue: 1_000_000, maxValue: 1_000_000 },
          },
          tuningMarks: [createInheritedTuningMark(150, 1, 20_000)],
          specialResourcesByActor: [
            {
              actorId: 'actor-103002',
              characterId: 103002,
              resourceIdentity: 'actor:103002:element:103002047',
              currentValue: 12,
              maxValue: 12,
            },
          ],
        },
        actionPlan: [
          {
            id: 'c6-ruby-enhanced-e1-before-damage',
            rubyEnhancedSequenceIndex: 1,
            startFrame: 60,
          },
          {
            id: 'c6-ruby-enhanced-e2-before-damage',
            rubyEnhancedSequenceIndex: 2,
          },
          { id: fireActionId, rubyEnhancedSequenceIndex: 3 },
        ],
      });
    const fireWithSoul = simulateFire(1900550);
    const fireWithoutSoul = simulateFire(0);
    const fireCommand =
      fireWithSoul.verifiedSoulEssenceEffectGeneration.effectCommands.find(
        command => command.sourceSoulEssenceId === 10044
      );
    const fireTransaction =
      fireWithSoul.verifiedDamageEventGeneration.transactions.find(
        transaction =>
          transaction.sourceKind === 'tuning-damage' &&
          transaction.sourceActionId === fireActionId &&
          transaction.beforeEvent.eventContext.damageElementId === 196
      );
    const tuningDamage = (result, actionId, profileKey) =>
      (result.verifiedCombatRuntime ?? result).damageEvents.find(
        event =>
          event.type === 'VERIFIED_TUNING_DAMAGE' &&
          event.actionId === actionId &&
          event.payload.profileKey === profileKey
      );
    const fireDamageWithSoul = tuningDamage(fireWithSoul, fireActionId, 'fire');
    const fireDamageWithoutSoul = tuningDamage(
      fireWithoutSoul,
      fireActionId,
      'fire'
    );

    expect(fireTransaction).toMatchObject({
      beforeEvent: {
        eventContext: expect.objectContaining({
          eventId: 1,
          phase: 'before-damage',
          elementId: 196,
          elementTypes: [22, 31, 43, 307],
          profileKey: 'fire',
          landed: true,
        }),
      },
    });
    expect(fireCommand).toMatchObject({
      sourceSoulEssenceId: 10044,
      sourceActionId: fireActionId,
      timeMs: fireTransaction.timeMs,
      durationMs: 16000,
      sourceIdentity: expect.objectContaining({
        triggerEventContext: expect.objectContaining({
          eventIdentity: fireTransaction.beforeEvent.eventIdentity,
          transactionIdentity: fireTransaction.transactionIdentity,
        }),
      }),
      modifiers: [
        expect.objectContaining({
          attributeId: 52,
          sourceRawA: 1220,
          evaluatedValue: 1220,
          propertyTags: [],
        }),
      ],
    });
    expect(fireDamageWithSoul.payload.rawDamage).toBeGreaterThan(
      fireDamageWithoutSoul.payload.rawDamage
    );
    expect(fireDamageWithSoul.payload.damageEventContext).toMatchObject({
      transactionIdentity: fireTransaction.transactionIdentity,
      settlementSourceSequencePath:
        fireTransaction.settlementSourceSequencePath,
    });

    const windActionId = 'c6-wind-before-damage';
    const simulateWind = effectSkillId =>
      createRealSoulScenario({
        actorCharacterId: 111001,
        soulEssenceId: 10044,
        effectSkillId,
        durationMs: 12_000,
        initialRuntimeState: {
          enemy: {
            hp: { currentValue: 1_000_000, maxValue: 1_000_000 },
            toughness: { currentValue: 1_000_000, maxValue: 1_000_000 },
          },
          tuningMarks: [createInheritedTuningMark(750, 1, 20_000)],
        },
        actionPlan: [
          {
            id: windActionId,
            actionKind: 'normal-attack',
            actorCharacterId: 111001,
            startFrame: 60,
            controlSubSkillIndex: 4,
          },
        ],
      });
    const windWithSoul = simulateWind(1900550);
    const windWithoutSoul = simulateWind(0);
    const windCommand =
      windWithSoul.verifiedSoulEssenceEffectGeneration.effectCommands.find(
        command => command.sourceSoulEssenceId === 10044
      );
    const windWithSoulDamage = tuningDamage(windWithSoul, windActionId, 'wind');
    const windWithoutSoulDamage = tuningDamage(
      windWithoutSoul,
      windActionId,
      'wind'
    );

    expect(windCommand).toMatchObject({
      sourceHitElementId: 796,
      modifiers: [expect.objectContaining({ attributeId: 52 })],
    });
    expect(windWithSoulDamage.payload.rawDamage).toBeCloseTo(
      windWithoutSoulDamage.payload.rawDamage,
      6
    );

    const windTriggerFrame = runtimeFrame(windCommand.timeMs);
    const fireReplay = replayRealActionWithSoulCommands({
      actorCharacterId: 111001,
      soulEssenceId: 10044,
      actionId: 'c6-fire-after-wind-trigger',
      actionKind: 'normal-attack',
      startFrame: windTriggerFrame + 1,
      commands: [windCommand],
      initialRuntimeState: {
        tuningMarks: [createInheritedTuningMark(150, 1, 20_000)],
      },
    });
    expect(
      tuningDamage(
        fireReplay.withCommands,
        'c6-fire-after-wind-trigger',
        'fire'
      ).payload.rawDamage
    ).toBeGreaterThan(
      tuningDamage(
        fireReplay.withoutCommands,
        'c6-fire-after-wind-trigger',
        'fire'
      ).payload.rawDamage
    );
  });

  it('uses real damage element types and charged property tags for 10123 and 10130', () => {
    const windActionId = 'c6-wind-special-charged-source';
    const simulateWindCharged = effectSkillId =>
      createRealSoulScenario({
        actorCharacterId: 101010,
        soulEssenceId: 10123,
        effectSkillId,
        durationMs: 12_000,
        initialRuntimeState: {
          enemy: {
            hp: { currentValue: 1_000_000, maxValue: 1_000_000 },
            toughness: { currentValue: 1_000_000, maxValue: 1_000_000 },
          },
          tuningMarks: [createInheritedTuningMark(750, 1, 20_000)],
        },
        actionPlan: [
          {
            id: 'c6-wind-a5-context',
            actionKind: 'normal-attack',
            actorCharacterId: 101010,
            startFrame: 60,
            attackInputSequenceIndex: 5,
          },
          {
            id: windActionId,
            actionKind: 'charged-attack',
            actorCharacterId: 101010,
            startFrame: 97,
          },
        ],
      });
    const windWithSoul = simulateWindCharged(1900590);
    const windWithoutSoul = simulateWindCharged(0);
    const windCommand =
      windWithSoul.verifiedSoulEssenceEffectGeneration.effectCommands.find(
        command => command.sourceSoulEssenceId === 10123
      );
    const tuningDamage = (result, actionId, profileKey) =>
      result.verifiedCombatRuntime.damageEvents.find(
        event =>
          event.type === 'VERIFIED_TUNING_DAMAGE' &&
          event.actionId === actionId &&
          event.payload.profileKey === profileKey
      );

    expect(windCommand).toMatchObject({
      sourceHitElementId: 796,
      durationMs: 8000,
      modifiers: [
        expect.objectContaining({
          attributeId: 21,
          sourceRawA: 1130,
          propertyTags: [301],
          propertyTagMatchMode: 'single-exact',
        }),
      ],
    });
    expect(
      tuningDamage(windWithSoul, windActionId, 'wind').payload.rawDamage
    ).toBeGreaterThan(
      tuningDamage(windWithoutSoul, windActionId, 'wind').payload.rawDamage
    );

    const normalWindActionId = 'c6-wind-normal-wrong-property-tag';
    const simulateWindNormal = effectSkillId =>
      createRealSoulScenario({
        actorCharacterId: 111001,
        soulEssenceId: 10123,
        effectSkillId,
        durationMs: 12_000,
        initialRuntimeState: {
          enemy: {
            hp: { currentValue: 1_000_000, maxValue: 1_000_000 },
            toughness: { currentValue: 1_000_000, maxValue: 1_000_000 },
          },
          tuningMarks: [createInheritedTuningMark(750, 1, 20_000)],
        },
        actionPlan: [
          {
            id: normalWindActionId,
            actionKind: 'normal-attack',
            actorCharacterId: 111001,
            startFrame: 60,
            controlSubSkillIndex: 4,
          },
        ],
      });
    const normalWindWithSoul = simulateWindNormal(1900590);
    const normalWindWithoutSoul = simulateWindNormal(0);
    expect(
      normalWindWithSoul.verifiedSoulEssenceEffectGeneration.effectCommands
    ).toHaveLength(1);
    expect(
      tuningDamage(normalWindWithSoul, normalWindActionId, 'wind').payload
        .rawDamage
    ).toBeCloseTo(
      tuningDamage(normalWindWithoutSoul, normalWindActionId, 'wind').payload
        .rawDamage,
      6
    );

    const thunderActionId = 'c6-thunder-type-37-source';
    const simulateThunder = effectSkillId =>
      createRealSoulScenario({
        actorCharacterId: 112001,
        soulEssenceId: 10130,
        effectSkillId,
        durationMs: 12_000,
        initialRuntimeState: {
          enemy: {
            hp: { currentValue: 1_000_000, maxValue: 1_000_000 },
            toughness: { currentValue: 1_000_000, maxValue: 1_000_000 },
          },
          tuningMarks: [createInheritedTuningMark(250, 2, 20_000)],
        },
        actionPlan: [
          {
            id: thunderActionId,
            actionKind: 'ultimate',
            actorCharacterId: 112001,
            startFrame: 60,
          },
        ],
      });
    const thunderWithSoul = simulateThunder(1900280);
    const thunderWithoutSoul = simulateThunder(0);
    const thunderCommand =
      thunderWithSoul.verifiedSoulEssenceEffectGeneration.effectCommands.find(
        command =>
          command.sourceSoulEssenceId === 10130 &&
          command.sourceHitElementId === 296
      );
    const thunderTransaction =
      thunderWithSoul.verifiedDamageEventGeneration.transactions.find(
        transaction =>
          transaction.sourceKind === 'tuning-damage' &&
          transaction.sourceActionId === thunderActionId &&
          transaction.beforeEvent.eventContext.elementId === 296
      );

    expect(thunderTransaction.beforeEvent.eventContext.elementTypes).toEqual([
      22, 37, 43, 307,
    ]);
    expect(thunderCommand).toMatchObject({
      sourceHitElementId: 296,
      durationMs: 5000,
      modifiers: [
        expect.objectContaining({
          attributeId: 21,
          propertyTags: [301],
        }),
      ],
    });
    expect(
      tuningDamage(thunderWithSoul, thunderActionId, 'thunder').payload
        .rawDamage
    ).toBeCloseTo(
      tuningDamage(thunderWithoutSoul, thunderActionId, 'thunder').payload
        .rawDamage,
      6
    );

    const activeFrame = runtimeFrame(thunderCommand.timeMs) + 1;
    const activeReplay = replayRealActionWithSoulCommands({
      actorCharacterId: 112001,
      soulEssenceId: 10130,
      actionId: 'c6-thunder-type-active-charged',
      actionKind: 'charged-attack',
      startFrame: activeFrame,
      commands: [thunderCommand],
    });
    const expiredReplay = replayRealActionWithSoulCommands({
      actorCharacterId: 112001,
      soulEssenceId: 10130,
      actionId: 'c6-thunder-type-expired-charged',
      actionKind: 'charged-attack',
      startFrame: runtimeFrame(thunderCommand.timeMs) + 300,
      commands: [thunderCommand],
    });
    const toughness = (runtime, actionId) =>
      runtime.damageEvents
        .filter(event => event.actionId === actionId)
        .reduce(
          (sum, event) => sum + Number(event.payload.toughnessDamage ?? 0),
          0
        );
    expect(
      toughness(activeReplay.withCommands, 'c6-thunder-type-active-charged')
    ).toBeGreaterThan(
      toughness(activeReplay.withoutCommands, 'c6-thunder-type-active-charged')
    );
    expect(
      toughness(expiredReplay.withCommands, 'c6-thunder-type-expired-charged')
    ).toBeCloseTo(
      toughness(
        expiredReplay.withoutCommands,
        'c6-thunder-type-expired-charged'
      ),
      6
    );

    const wrongType = createRealSoulScenario({
      actorCharacterId: 111001,
      soulEssenceId: 10130,
      effectSkillId: 1900280,
      durationMs: 12_000,
      initialRuntimeState: {
        tuningMarks: [createInheritedTuningMark(750, 1, 20_000)],
      },
      actionPlan: [
        {
          id: 'c6-wind-does-not-match-type-37',
          actionKind: 'normal-attack',
          actorCharacterId: 111001,
          startFrame: 60,
          controlSubSkillIndex: 4,
        },
      ],
    });
    expect(
      wrongType.verifiedSoulEssenceEffectGeneration.effectCommands
    ).toEqual([]);
  });

  it('orders one BeforeDamage transaction per ordinary hit and stacks 10150 through source sequence', () => {
    const definition = soulEssenceEffectCatalog.definitions.find(
      entry => entry.soulEssenceId === 10150
    );
    const actorId = 'actor-c6-ordinary-source';
    const action = {
      id: 'c6-ordinary-six-hit-source',
      actorId,
      actorCharacterId: 999001,
      actionKind: 'charged-attack',
      sourceSequenceIndex: 4,
      sourceSequencePath: [4],
      startMs: 1000,
      durationMs: 1000,
    };
    const hits = Array.from({ length: 6 }, (_value, index) => ({
      hitIndex: index + 1,
      elementId: 196,
      sourceIdentity: `c6:ordinary:fire:${index + 1}`,
      trigger: { startFrame: 5 },
      damage: {
        elementConfigId: 196,
        elementTypes: [22, 31, 43, 307],
        damageType: 0,
      },
    }));
    const resolution = {
      ready: true,
      actionBinding: {
        identity: 'c6:ordinary:charged-binding',
        actionKind: 'charged-attack',
        controlSkillId: 99900110,
        selectedSubSkillIndex: 0,
      },
      controlBinding: {
        frameRate: 60,
        selectedSubSkillIndex: 0,
        logic: { skillTag: '2' },
      },
      hits,
    };
    const scenario = {
      time: { fps: 60, durationMs: 12_000 },
      combatScenario: { projectile: { defaultWillHit: true } },
      actors: [createSoulMatrixActor({ actorId, definition })],
      actions: [action],
    };
    const createGeneration = ({
      actionValue = action,
      resolutionValue = resolution,
      execute = true,
    } = {}) => {
      const scenarioValue = { ...scenario, actions: [actionValue] };
      const actionExecutionPlan = {
        actions: [{ actionId: actionValue.id, execute }],
      };
      const actionResolutionById = new Map([[actionValue.id, resolutionValue]]);
      const damageEventGeneration = createVerifiedDamageEventGeneration({
        scenario: scenarioValue,
        actionExecutionPlan,
        actionResolutionById,
      });
      const generation = createVerifiedSoulEssenceEffectGeneration({
        scenario: scenarioValue,
        actionExecutionPlan,
        actionResolutionById,
        damageEventGeneration,
        catalog: {
          ...soulEssenceEffectCatalog,
          definitions: [definition],
        },
      });
      return {
        scenarioValue,
        actionExecutionPlan,
        damageEventGeneration,
        generation,
      };
    };
    const applied = createGeneration();

    expect(applied.damageEventGeneration.summary).toMatchObject({
      transactionCount: 6,
      ordinaryHitTransactionCount: 6,
      tuningDamageTransactionCount: 0,
    });
    expect(applied.generation.effectCommands).toHaveLength(6);
    applied.damageEventGeneration.transactions.forEach((transaction, index) => {
      expect(transaction).toMatchObject({
        sourceKind: 'ordinary-hit',
        baseSourceSequencePath: [4, index + 1],
        settlementSourceSequencePath: [4, index + 1, 1],
        beforeEvent: {
          sourceSequencePath: [4, index + 1, 0],
          eventContext: expect.objectContaining({
            phase: 'before-damage',
            elementId: 196,
            propertyTags: [301],
            landed: true,
          }),
        },
        afterEvent: {
          sourceSequencePath: [4, index + 1, 2],
        },
      });
    });
    const timeline = createEffectRuntimeTimeline({
      scenario: applied.scenarioValue,
      actionExecutionPlan: applied.actionExecutionPlan,
      generatedCommands: applied.generation.effectCommands,
    });
    applied.damageEventGeneration.transactions.forEach((transaction, index) => {
      expect(
        resolveActiveEffectsAt(timeline, transaction.timeMs, {
          targetKind: 'actor',
          targetId: actorId,
          calculatorOnly: true,
          settlingSourceSequencePath: transaction.settlementSourceSequencePath,
        })[0]
      ).toMatchObject({
        stacks: Math.min(index + 1, 5),
        maxStacks: 5,
      });
    });
    const lastCommand = applied.generation.effectCommands.at(-1);
    expect(
      resolveActiveEffectsAt(timeline, lastCommand.timeMs + 8000 - 0.001, {
        targetKind: 'actor',
        targetId: actorId,
        calculatorOnly: true,
      })[0]
    ).toMatchObject({ stacks: 5 });
    expect(
      resolveActiveEffectsAt(timeline, lastCommand.timeMs + 8000, {
        targetKind: 'actor',
        targetId: actorId,
        calculatorOnly: true,
      })
    ).toEqual([]);

    const thirdTransaction = applied.damageEventGeneration.transactions[2];
    const boundaryEffect = resolveActiveEffectsAt(
      timeline,
      thirdTransaction.timeMs,
      {
        targetKind: 'actor',
        targetId: actorId,
        calculatorOnly: true,
        settlingSourceSequencePath:
          thirdTransaction.settlementSourceSequencePath,
      }
    )[0];
    const inheritedScenario = {
      ...scenario,
      actions: [],
      initialRuntimeState: {
        activeEffects: [
          {
            ...boundaryEffect,
            remainingDurationMs:
              boundaryEffect.expiresAtMs - thirdTransaction.timeMs,
          },
        ],
      },
    };
    const replayCommands = applied.generation.effectCommands
      .slice(3, 5)
      .map((command, index) => ({
        ...command,
        timeMs: 100 + index * 100,
      }));
    const createInheritedReplay = () =>
      createEffectRuntimeTimeline({
        scenario: inheritedScenario,
        actionExecutionPlan: { actions: [] },
        generatedCommands: replayCommands,
      });
    const inheritedReplay = createInheritedReplay();
    expect(createInheritedReplay().events).toEqual(inheritedReplay.events);
    expect(
      resolveActiveEffectsAt(inheritedReplay, 200, {
        targetKind: 'actor',
        targetId: actorId,
        calculatorOnly: true,
      })[0]
    ).toMatchObject({ stacks: 5, maxStacks: 5 });

    const missOverrides = Object.fromEntries(
      hits.map(hit => [hit.sourceIdentity, { willHit: false }])
    );
    const missed = createGeneration({
      actionValue: {
        ...action,
        id: 'c6-ordinary-all-miss',
        hitOverrides: missOverrides,
      },
    });
    expect(missed.damageEventGeneration.transactions).toEqual([]);
    expect(missed.generation.effectCommands).toEqual([]);

    const blocked = createGeneration({ execute: false });
    expect(blocked.damageEventGeneration.transactions).toEqual([]);
    expect(blocked.generation.effectCommands).toEqual([]);

    const wrongElement = createGeneration({
      resolutionValue: {
        ...resolution,
        hits: hits.map(hit => ({
          ...hit,
          elementId: 999196,
          damage: { ...hit.damage, elementConfigId: 999196 },
        })),
      },
    });
    expect(wrongElement.damageEventGeneration.transactions).toHaveLength(6);
    expect(wrongElement.generation.effectCommands).toEqual([]);
  });

  it('applies 10150 to a real wind overlimit packet and keeps Self ownership across switching', () => {
    const sourceActionId = 'c6-10150-wind-special-charged';
    const actionPlan = [
      {
        id: 'c6-10150-a5-context',
        actionKind: 'normal-attack',
        actorCharacterId: 101010,
        startFrame: 60,
        attackInputSequenceIndex: 5,
      },
      {
        id: sourceActionId,
        actionKind: 'charged-attack',
        actorCharacterId: 101010,
        startFrame: 97,
      },
    ];
    const simulate = ({
      effectSkillId = 1900560,
      tuningMarks = [createInheritedTuningMark(750, 1, 20_000)],
      combatScenario = null,
      actions = actionPlan,
      teamCharacterIds = null,
      actorCharacterId = 101010,
    } = {}) =>
      createRealSoulScenario({
        actorCharacterId,
        soulEssenceId: 10150,
        effectSkillId,
        durationMs: 16_000,
        teamCharacterIds,
        combatScenario,
        initialRuntimeState: {
          enemy: {
            hp: { currentValue: 1_000_000, maxValue: 1_000_000 },
            toughness: { currentValue: 1_000_000, maxValue: 1_000_000 },
          },
          tuningMarks,
        },
        actionPlan: actions,
      });
    const withSoul = simulate();
    const withoutSoul = simulate({ effectSkillId: 0 });
    const command =
      withSoul.verifiedSoulEssenceEffectGeneration.effectCommands.find(
        entry => entry.sourceActionId === sourceActionId
      );
    const tuningDamage = result =>
      result.verifiedCombatRuntime.damageEvents.find(
        event =>
          event.type === 'VERIFIED_TUNING_DAMAGE' &&
          event.actionId === sourceActionId &&
          event.payload.elementId === 796
      );

    expect(command).toMatchObject({
      sourceSoulEssenceId: 10150,
      targetId: 'actor-101010',
      sourceHitElementId: 796,
      durationMs: 8000,
      stackMode: 'stack',
      maxStacks: 5,
      modifiers: [
        expect.objectContaining({
          attributeId: 21,
          sourceRawA: 230,
          propertyTags: [301],
        }),
      ],
    });
    expect(tuningDamage(withSoul).payload.rawDamage).toBeGreaterThan(
      tuningDamage(withoutSoul).payload.rawDamage
    );

    const allMiss = simulate({
      combatScenario: {
        projectile: { targetDistance: 0, defaultWillHit: false },
      },
    });
    expect(allMiss.verifiedSoulEssenceEffectGeneration.effectCommands).toEqual(
      []
    );
    const heldWithoutPacket = simulate({
      actions: [
        {
          id: 'c6-10150-held-mark-without-packet',
          actionKind: 'normal-attack',
          actorCharacterId: 101010,
          startFrame: 60,
          attackInputSequenceIndex: 1,
        },
      ],
    });
    expect(
      heldWithoutPacket.verifiedSoulEssenceEffectGeneration.effectCommands
    ).toEqual([]);
    const consumeFailed = simulate({
      tuningMarks: [],
      actions: [
        {
          id: 'c6-10150-no-mark-no-packet',
          actionKind: 'normal-attack',
          actorCharacterId: 101010,
          startFrame: 60,
          attackInputSequenceIndex: 1,
        },
      ],
    });
    expect(
      consumeFailed.verifiedSoulEssenceEffectGeneration.effectCommands
    ).toEqual([]);

    const wrongSource = simulate({
      actorCharacterId: 101010,
      teamCharacterIds: [101010, 111001, 101003],
      actions: [
        {
          id: 'c6-10150-wrong-source-wind-packet',
          actionKind: 'normal-attack',
          actorCharacterId: 111001,
          startFrame: 60,
          controlSubSkillIndex: 4,
        },
      ],
    });
    expect(
      wrongSource.verifiedCombatRuntime.damageEvents.some(
        event =>
          event.type === 'VERIFIED_TUNING_DAMAGE' &&
          event.payload.elementId === 796
      )
    ).toBe(true);
    expect(
      wrongSource.verifiedSoulEssenceEffectGeneration.effectCommands
    ).toEqual([]);

    const switchFrame = runtimeFrame(command.timeMs) + 30;
    const switched = simulate({
      teamCharacterIds: [101010, 101003, 101007],
      actions: [
        ...actionPlan,
        {
          id: 'c6-10150-switch-away',
          actionKind: 'switch',
          sourceCharacterId: 101010,
          targetCharacterId: 101003,
          startFrame: switchFrame,
        },
      ],
    });
    const afterSwitchMs = frameToMs(switchFrame + 1);
    expect(
      resolveActiveEffectsAt(switched.effectTimeline, afterSwitchMs, {
        targetKind: 'actor',
        targetId: 'actor-101010',
        calculatorOnly: true,
      }).filter(effect => effect.effectId.includes('soulessence:10150:'))
    ).toHaveLength(1);
    expect(
      resolveActiveEffectsAt(switched.effectTimeline, afterSwitchMs, {
        targetKind: 'actor',
        targetId: 'actor-101003',
        calculatorOnly: true,
      }).filter(effect => effect.effectId.includes('soulessence:10150:'))
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
      ready: true,
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
    const actionResolutionById = new Map([
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
    ]);
    const damageEventGeneration = createVerifiedDamageEventGeneration({
      scenario,
      actionExecutionPlan,
      actionResolutionById,
    });
    const generation = createVerifiedSoulEssenceEffectGeneration({
      scenario,
      actionExecutionPlan,
      actionResolutionById,
      damageEventGeneration,
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
        settlingSourceSequencePath: [0, 1, 1],
      })
    ).toEqual([]);
    expect(
      resolveActiveEffectsAt(timeline, hitTimeMs, {
        targetKind: 'actor',
        targetId: 'actor-synthetic',
        calculatorOnly: true,
        settlingSourceSequencePath: [0, 2, 1],
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
      ready: true,
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
    const actionResolutionById = new Map([[action.id, resolution]]);
    const damageEventGeneration = createVerifiedDamageEventGeneration({
      scenario: baseScenario,
      actionExecutionPlan: executionPlan,
      actionResolutionById,
    });
    const generation = createVerifiedSoulEssenceEffectGeneration({
      scenario: baseScenario,
      actionExecutionPlan: executionPlan,
      actionResolutionById,
      damageEventGeneration,
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

  it('projects real switch transactions into the 10048 team buff and refreshes on re-entry', () => {
    const actionPlan = [
      {
        id: 'switch-into-10048-owner',
        actionKind: 'switch',
        sourceCharacterId: 101007,
        targetCharacterId: 101010,
        startFrame: 60,
      },
      {
        id: 'switch-away-from-10048-owner',
        actionKind: 'switch',
        sourceCharacterId: 101010,
        targetCharacterId: 101003,
        startFrame: 120,
      },
      {
        id: 'switch-back-into-10048-owner',
        actionKind: 'switch',
        sourceCharacterId: 101003,
        targetCharacterId: 101010,
        startFrame: 240,
      },
    ];
    const simulate = soulEssenceId =>
      createRealSoulScenario({
        actorCharacterId: 101010,
        soulEssenceId,
        effectSkillId: soulEssenceId == null ? null : 1900920,
        durationMs: 15_000,
        teamCharacterIds: [101007, 101003, 101010],
        initialRuntimeState: {
          controlledActor: {
            actorId: 'actor-101007',
            characterId: 101007,
          },
        },
        actionPlan,
      });
    const result = simulate(10048);
    const switchEvents = result.verifiedNonDamageEventGeneration.events.filter(
      event => event.eventId === 34
    );
    const commands =
      result.verifiedSoulEssenceEffectGeneration.effectCommands.filter(
        command => command.sourceSoulEssenceId === 10048
      );

    expect(
      switchEvents.map(event => [event.absoluteFrame, event.actorId])
    ).toEqual([
      [60, 'actor-101010'],
      [120, 'actor-101003'],
      [240, 'actor-101010'],
    ]);
    expect(commands).toHaveLength(6);
    expect(commands.map(command => [command.timeMs, command.targetId])).toEqual(
      [
        [frameToMs(60), 'actor-101007'],
        [frameToMs(60), 'actor-101003'],
        [frameToMs(60), 'actor-101010'],
        [frameToMs(240), 'actor-101007'],
        [frameToMs(240), 'actor-101003'],
        [frameToMs(240), 'actor-101010'],
      ]
    );
    expect(
      result.effectTimeline.events.filter(
        event =>
          event.effectId === 'soulessence:10048:element:19009202' &&
          event.timeMs === frameToMs(240)
      )
    ).toHaveLength(3);
    expect(
      resolveActiveEffectsAt(result.effectTimeline, frameToMs(241), {
        targetKind: 'actor',
        calculatorOnly: true,
      }).filter(
        effect => effect.effectId === 'soulessence:10048:element:19009202'
      )
    ).toHaveLength(3);
    const replayAt = (actorCharacterId, actionId, startFrame) =>
      replayRealActionWithSoulCommands({
        actorCharacterId,
        soulEssenceId: 10048,
        actionId,
        actionKind: 'normal-attack',
        startFrame,
        commands,
      });
    const active = replayAt(101003, 'c7-10048-team-active-hit', 130);
    const expired = replayAt(101010, 'c7-10048-expired-hit', 721);
    const damage = (runtime, actionId) =>
      runtime.damageEvents
        .filter(
          event =>
            event.type === 'VERIFIED_COMBAT_HIT' && event.actionId === actionId
        )
        .reduce((sum, event) => sum + Number(event.payload.rawDamage), 0);
    expect(
      damage(active.withCommands, 'c7-10048-team-active-hit')
    ).toBeGreaterThan(
      damage(active.withoutCommands, 'c7-10048-team-active-hit')
    );
    expect(damage(expired.withCommands, 'c7-10048-expired-hit')).toBeCloseTo(
      damage(expired.withoutCommands, 'c7-10048-expired-hit'),
      6
    );
  });

  it('applies 10175 to the healed actor and changes real damage only inside its right-open lifetime', () => {
    const definition = soulEssenceEffectCatalog.definitions.find(
      entry => entry.soulEssenceId === 10175
    );
    const sourceActorId = 'actor-101007';
    const targetActorId = 'actor-101003';
    const sourceAction = {
      ...createRealSoulActionDraft({
        id: 'c7-ultimate-heal-source',
        actionKind: 'ultimate',
        startFrame: 0,
        actorCharacterId: 101007,
      }),
      actorId: sourceActorId,
      sourceSequenceIndex: 0,
      sourceSequencePath: [0],
    };
    const sourceResolution = resolveVerifiedCombatActionMechanics(sourceAction);
    const scenario = {
      time: { fps: 60, durationMs: 12_000 },
      actors: [
        createSoulMatrixActor({
          actorId: sourceActorId,
          definition,
          star: 1,
        }),
        { id: targetActorId, characterId: 101003, name: 'heal-target' },
        { id: 'actor-101010', characterId: 101010, name: 'third-actor' },
      ],
      actions: [sourceAction],
    };
    const actionExecutionPlan = {
      actions: [{ actionId: sourceAction.id, execute: true }],
    };
    const actionResolutionById = new Map([[sourceAction.id, sourceResolution]]);
    const healFrame = 300;
    const healTimeMs = frameToMs(healFrame);
    const nonDamageEventGeneration = createVerifiedNonDamageEventGeneration({
      scenario,
      actionExecutionPlan,
      controlledActorTimeline: { transitions: [] },
      actionResolutionById,
      verifiedCombatRuntime: {
        vitalEvents: [
          {
            type: 'VERIFIED_DIRECT_HEAL',
            timeMs: healTimeMs,
            absoluteFrame: healFrame,
            actionId: sourceAction.id,
            actorId: sourceActorId,
            targetId: targetActorId,
            runtimeSequenceIndex: 0,
            payload: {
              sourceEventIdentity: 'c7-native-ultimate-heal',
              sourceActorId,
              targetKind: 'actor',
              before: 900,
              requestedChange: 100,
              change: 100,
              after: 1000,
              maximum: 1000,
              applied: true,
              appliedToCalculators: true,
              afterHealDispatchEligible: true,
              actionProvenanceAvailable: true,
            },
          },
        ],
      },
    });
    const generation = createVerifiedSoulEssenceEffectGeneration({
      scenario,
      actionExecutionPlan,
      actionResolutionById,
      nonDamageEventGeneration,
    });
    const commands = generation.effectCommands.filter(
      command => command.sourceSoulEssenceId === 10175
    );

    expect(commands).toEqual([
      expect.objectContaining({
        sourceActionId: sourceAction.id,
        sourceActorId,
        targetId: targetActorId,
        semanticTargetKind: 'event-target-actor',
        timeMs: healTimeMs,
        durationMs: 2000,
        modifiers: [
          expect.objectContaining({
            attributeId: 1,
            bucket: 'dynamicPercent',
            sourceRawA: 900,
          }),
        ],
      }),
    ]);

    const replayAt = (actionId, startFrame) =>
      replayRealActionWithSoulCommands({
        actorCharacterId: 101003,
        soulEssenceId: null,
        actionId,
        actionKind: 'normal-attack',
        startFrame,
        commands,
      });
    const active = replayAt('c7-healed-target-active-hit', 310);
    const expired = replayAt('c7-healed-target-expired-hit', 421);
    const damage = (runtime, actionId) =>
      runtime.damageEvents
        .filter(
          event =>
            event.type === 'VERIFIED_COMBAT_HIT' && event.actionId === actionId
        )
        .reduce((sum, event) => sum + Number(event.payload.rawDamage), 0);

    expect(
      damage(active.withCommands, 'c7-healed-target-active-hit')
    ).toBeGreaterThan(
      damage(active.withoutCommands, 'c7-healed-target-active-hit')
    );
    expect(
      damage(expired.withCommands, 'c7-healed-target-expired-hit')
    ).toBeCloseTo(
      damage(expired.withoutCommands, 'c7-healed-target-expired-hit'),
      6
    );
  });

  it('keeps resource-funded direct heals executable in the non-damage event projection', () => {
    const result = createRealSoulScenario({
      actorCharacterId: 112002,
      soulEssenceId: 10175,
      effectSkillId: 1900140,
      ownerInitialSp: 0,
      durationMs: 7000,
      teamCharacterIds: [112002, 101003, 101010],
      initialRuntimeState: {
        controlledActor: {
          actorId: 'actor-112002',
          characterId: 112002,
        },
        actorVitalsByActor: [
          {
            actorId: 'actor-112002',
            characterId: 112002,
            currentValue: 1000,
            maxValue: 5000,
            valueShields: [],
          },
        ],
      },
      actionPlan: [
        {
          id: 'c7-r1-manual-sp-before-heal',
          actionKind: 'resource',
          actorCharacterId: 112002,
          startFrame: 30,
          resource: 'sp',
          change: 100,
        },
        {
          id: 'c7-r1-costed-ultimate-heal',
          actionKind: 'ultimate',
          actorCharacterId: 112002,
          startFrame: 60,
        },
      ],
    });
    const scenario = result.effectiveActionTimeline.scenario;
    const sourceAction = scenario.actions.find(
      action => action.id === 'c7-r1-costed-ultimate-heal'
    );
    const sourceResolution =
      result.verifiedActionVariantRuntime.actionResolutionById.get(
        sourceAction.id
      );
    const effectGeneration = {
      ...result.verifiedBattleEffectGeneration,
      directHpEvents: [
        ...(result.verifiedBattleEffectGeneration?.directHpEvents ?? []),
        {
          eventIdentity: 'fixture:c7-r1-costed-direct-heal',
          timeMs: frameToMs(180),
          action: sourceAction,
          actionId: sourceAction.id,
          actorId: sourceAction.actorId,
          target: { kind: 'actor', id: sourceAction.actorId },
          value: 100,
          effect: {
            effectIdentity: 'fixture:c7-r1-direct-heal-effect',
          },
          resolution: sourceResolution,
          sourceIdentity: 'fixture:c7-r1-direct-heal-settlement',
          sourceSequencePath: createFixtureDirectEffectSourceSequencePath(
            sourceAction,
            180,
            0
          ),
          sourceSequenceStatus: 'verified-direct-effect-source-sequence-ready',
          applied: true,
        },
      ],
      shieldEvents: [
        ...(result.verifiedBattleEffectGeneration?.shieldEvents ?? []),
        {
          eventIdentity: 'fixture:c7-r1-costed-direct-shield',
          timeMs: frameToMs(181),
          action: sourceAction,
          actionId: sourceAction.id,
          actorId: sourceAction.actorId,
          target: { kind: 'actor', id: sourceAction.actorId },
          value: 100,
          effect: {
            effectIdentity: 'fixture:c7-r1-direct-shield-effect',
          },
          resolution: sourceResolution,
          sourceIdentity: 'fixture:c7-r1-direct-shield-settlement',
          sourceSequencePath: createFixtureDirectEffectSourceSequencePath(
            sourceAction,
            181,
            0
          ),
          sourceSequenceStatus: 'verified-direct-effect-source-sequence-ready',
          applied: true,
        },
      ],
    };
    const runtimeArguments = {
      scenario,
      actionExecutionPlan: result.actionExecutionPlan,
      controlledActorTimeline: result.controlledActorTimeline,
      effectGeneration,
      tuningGeneration: result.verifiedTuningMarkGeneration,
      damageEventGeneration: result.verifiedDamageEventGeneration,
      effectTimeline: result.effectTimeline,
      actionVariantRuntime: result.verifiedActionVariantRuntime,
      kiboPassiveGeneration: result.verifiedKiboPassiveGeneration,
    };
    const fullRuntime = createVerifiedCombatRuntime(runtimeArguments);
    const projectionRuntime = createVerifiedCombatRuntime({
      ...runtimeArguments,
      runtimeMode: 'non-damage-event-projection',
    });
    const nonDamageEventGeneration = createVerifiedNonDamageEventGeneration({
      scenario,
      actionExecutionPlan: result.actionExecutionPlan,
      controlledActorTimeline: result.controlledActorTimeline,
      actionResolutionById:
        result.verifiedActionVariantRuntime.actionResolutionById,
      verifiedCombatRuntime: projectionRuntime,
    });
    const soulGeneration = createVerifiedSoulEssenceEffectGeneration({
      scenario,
      actionExecutionPlan: result.actionExecutionPlan,
      actionResolutionById:
        result.verifiedActionVariantRuntime.actionResolutionById,
      tuningGeneration: result.verifiedTuningMarkGeneration,
      damageEventGeneration: result.verifiedDamageEventGeneration,
      nonDamageEventGeneration,
    });
    const cost = fullRuntime.resourceEvents.find(
      event =>
        event.actionId === 'c7-r1-costed-ultimate-heal' &&
        event.payload.reason === 'verified-skill-cost'
    );
    const heal = fullRuntime.vitalEvents.find(
      event =>
        event.actionId === 'c7-r1-costed-ultimate-heal' &&
        event.type === 'VERIFIED_DIRECT_HEAL'
    );
    const projectionHeal = projectionRuntime.vitalEvents.find(
      event =>
        event.actionId === 'c7-r1-costed-ultimate-heal' &&
        event.type === 'VERIFIED_DIRECT_HEAL'
    );
    const projectionShield = projectionRuntime.vitalEvents.find(
      event =>
        event.actionId === 'c7-r1-costed-ultimate-heal' &&
        event.type === 'VERIFIED_DIRECT_SHIELD'
    );
    const afterHealEvents = nonDamageEventGeneration.events.filter(
      event =>
        event.eventId === 44 && event.actionId === 'c7-r1-costed-ultimate-heal'
    );
    const commands = soulGeneration.effectCommands.filter(
      command =>
        command.sourceSoulEssenceId === 10175 &&
        command.sourceActionId === 'c7-r1-costed-ultimate-heal'
    );

    expect(cost?.payload).toMatchObject({
      beforeValue: 100,
      change: -100,
      afterValue: 0,
    });
    expect(heal).toMatchObject({
      actorId: 'actor-112002',
      targetId: 'actor-112002',
      payload: {
        applied: true,
        afterHealDispatchEligible: true,
      },
    });
    expect(projectionHeal).toMatchObject({
      actorId: 'actor-112002',
      targetId: 'actor-112002',
      payload: {
        applied: true,
        afterHealDispatchEligible: true,
      },
    });
    expect(projectionShield).toMatchObject({
      actorId: 'actor-112002',
      targetId: 'actor-112002',
      payload: {
        applied: true,
        requestedChange: 100,
      },
    });
    expect(projectionRuntime.damageEvents).toEqual([]);
    expect(afterHealEvents).toHaveLength(1);
    expect(commands).toEqual([
      expect.objectContaining({
        sourceActorId: 'actor-112002',
        targetId: 'actor-112002',
        semanticTargetKind: 'event-target-actor',
      }),
    ]);
  });

  it('projects inherited wood-mark periodic healing without borrowing its source action skill tags', () => {
    const sourceActionId = 'c7-inherited-wood-source-ultimate';
    const result = createRealSoulScenario({
      actorCharacterId: 101007,
      soulEssenceId: 10175,
      effectSkillId: 1900140,
      durationMs: 6000,
      teamCharacterIds: [101007, 101003, 101010],
      actionPlan: [
        {
          id: sourceActionId,
          actionKind: 'ultimate',
          actorCharacterId: 101007,
          startFrame: 0,
        },
      ],
      initialRuntimeState: {
        controlledActor: {
          actorId: 'actor-101007',
          characterId: 101007,
        },
        actorVitalsByActor: [
          {
            actorId: 'actor-101007',
            characterId: 101007,
            currentValue: 1000,
            maxValue: 2000,
            valueShields: [],
          },
        ],
        tuningMarks: [
          {
            markId: 550,
            profileKey: 'wood',
            decayRemainingMs: 10_000,
            layers: [
              {
                sourceActionId,
                sourceActorId: 'actor-101007',
                sourceIdentity: 'fixture:c7-inherited-wood-mark',
              },
            ],
          },
        ],
      },
    });
    const periodicHeal = result.verifiedCombatRuntime.vitalEvents.find(
      event => event.type === 'VERIFIED_TUNING_PERIODIC_HEAL'
    );
    const afterHeal = result.verifiedNonDamageEventGeneration.events.find(
      event =>
        event.eventId === 44 &&
        event.eventContext.sourceDescriptorIdentity ===
          periodicHeal?.payload.sourceEventIdentity
    );

    expect(periodicHeal).toMatchObject({
      timeMs: 5000,
      actionId: sourceActionId,
      targetId: 'actor-101007',
      payload: {
        actionProvenanceAvailable: false,
        afterHealDispatchEligible: true,
        change: expect.any(Number),
      },
    });
    expect(periodicHeal.payload.change).toBeGreaterThan(0);
    expect(afterHeal).toMatchObject({
      eventId: 44,
      actionId: sourceActionId,
      actorId: 'actor-101007',
      targetId: 'actor-101007',
      eventContext: {
        actionProvenanceAvailable: false,
        skillSlotIds: [],
        skillTagIds: [],
        outcome: 'heal-applied',
      },
    });
    expect(
      result.verifiedSoulEssenceEffectGeneration.effectCommands.filter(
        command => command.sourceSoulEssenceId === 10175
      )
    ).toEqual([]);
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
  soulEssenceStar = 1,
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
            soulessenceStar: soulEssenceId == null ? null : soulEssenceStar,
            soulessenceCultivation:
              soulEssenceId == null
                ? null
                : {
                    effectSkill: {
                      skillId: effectSkillId,
                      star: soulEssenceStar,
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
    if (requested.actionKind === 'resource') {
      const action = createWorkbenchActionDraft({
        id: requested.id,
        type: 'resource',
        actorCharacterId:
          Number(requested.actorCharacterId) || actorCharacterId,
        startMs: frameToMs(requestedStartFrame),
        resource: requested.resource ?? 'sp',
        change: requested.change ?? 0,
        reason: requested.reason ?? 'test-resource-parity',
      });
      startFrame = requestedStartFrame;
      return action;
    }
    if (Number.isInteger(Number(requested.rubyEnhancedSequenceIndex))) {
      const action = createRubyEnhancedActionDraft({
        id: requested.id,
        startFrame: requestedStartFrame,
        sequenceIndex: Number(requested.rubyEnhancedSequenceIndex),
      });
      startFrame = requestedStartFrame + Number(action.durationFrames);
      return action;
    }
    const action = createRealSoulActionDraft({
      id: requested.id,
      actionKind: requested.actionKind,
      startFrame: requestedStartFrame,
      actorCharacterId: Number(requested.actorCharacterId) || actorCharacterId,
      hitOverrides: requested.hitOverrides ?? null,
      controlSubSkillIndex: requested.controlSubSkillIndex ?? null,
      attackInputSequenceIndex: requested.attackInputSequenceIndex ?? null,
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

function createRubyEnhancedActionDraft({ id, startFrame, sequenceIndex }) {
  const chain =
    verifiedCombatMechanicsPackage.actionVariantGraph.attackInputChains.find(
      item => item.chainIdentity === 'ruby-enhanced-twelve-inputs'
    );
  const mapping = verifiedCombatMechanicsPackage.actionMappings.find(
    item =>
      Number(item.ownerId) === 103002 && item.actionKind === 'normal-attack'
  );
  const segment = chain?.segments?.[sequenceIndex - 1];
  const sourceSegment = mapping?.attackInputSourceSegments?.find(
    item => Number(item.controlSkillId) === Number(segment?.controlSkillId)
  );
  if (!chain || !mapping || !segment || !sourceSegment) {
    throw new Error(`missing Ruby enhanced E${sequenceIndex} contract`);
  }
  const attackInput = {
    ...projectVerifiedAttackInputChainSegment(
      sourceSegment,
      segment,
      sequenceIndex,
      chain.segments.length,
      chain.chainIdentity
    ),
    attackInputChainIdentity: chain.chainIdentity,
  };
  return {
    id,
    type: 'skill',
    actorCharacterId: 103002,
    skillId: 10300201,
    actionKind: 'normal-attack',
    actionVariantIndex: 0,
    startMs: frameToMs(startFrame),
    durationMs: frameToMs(Number(segment.durationFrames)),
    durationFrames: Number(segment.durationFrames),
    level: 1,
    attackGroupId: 'c6-ruby-enhanced-chain',
    attackSequenceIndex: sequenceIndex,
    attackSequenceTotal: chain.segments.length,
    attackInputChainIdentity: chain.chainIdentity,
    attackInput,
  };
}

function createRealSoulActionDraft({
  id,
  actionKind,
  startFrame,
  actorCharacterId = OWNER_ID,
  mappingOverride = null,
  hitOverrides = null,
  controlSubSkillIndex = null,
  attackInputSequenceIndex = null,
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
    const actions = createWorkbenchAttackInputChainDrafts({
      entry: mapping,
      actorCharacterId,
      skillId: mapping.sourceSkillId,
      startMs: frameToMs(startFrame),
      createActionId: (_segment, index) =>
        index === 0 ? id : `${id}-unused-${index + 1}`,
    });
    const action =
      attackInputSequenceIndex != null &&
      Number.isInteger(Number(attackInputSequenceIndex))
        ? actions[Number(attackInputSequenceIndex) - 1]
        : actions[0];
    if (!action) throw new Error(`missing test attack input for ${actionKind}`);
    return {
      ...action,
      id,
      startMs: frameToMs(startFrame),
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
  initialRuntimeState = null,
}) {
  const replayTeamCharacterIds = [
    actorCharacterId,
    ...[101007, 101003, 101010].filter(
      characterId => Number(characterId) !== Number(actorCharacterId)
    ),
  ].slice(0, 3);
  const projection = createRealSoulScenario({
    actorCharacterId,
    soulEssenceId,
    effectSkillId: 0,
    durationMs: frameToMs(startFrame + 480),
    teamCharacterIds: replayTeamCharacterIds,
    initialRuntimeState: {
      ...(initialRuntimeState ?? {}),
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
      tuningGeneration: projection.verifiedTuningMarkGeneration,
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

function createCanonicalGetElementEvent({
  action,
  markId,
  eventId,
  transactionIndex,
  before,
  after,
}) {
  const markProfile =
    verifiedCombatMechanicsPackage.tuningMechanicsCatalog.profiles.find(
      profile => Number(profile.markId) === Number(markId)
    );
  const elementTypes = [...(markProfile?.markContainer?.elementTypes ?? [])];
  const phase = eventId === 9 ? 'before-mutation' : 'after-mutation';
  const eventKind =
    eventId === 9 ? 'element-before-acquire' : 'element-after-acquire';
  const timeMs = frameToMs(90 + transactionIndex);
  const transactionIdentity = `fixture:get-element:${action.id}:${transactionIndex}`;
  const eventIdentity = `${transactionIdentity}:event:${eventId}`;
  const sourceSequencePath = [
    ...(action.sourceSequencePath ?? [action.sourceSequenceIndex ?? 0]),
    eventId === 9 ? 19 : 21,
    transactionIndex,
    markId,
  ];
  const eventContext = {
    eventIdentity,
    transactionIdentity,
    eventKind,
    eventId,
    phase,
    timeMs,
    absoluteFrame: 90 + transactionIndex,
    sourceSequencePath,
    transactionSourceSequencePath: [
      ...(action.sourceSequencePath ?? [action.sourceSequenceIndex ?? 0]),
      20,
      transactionIndex,
      markId,
    ],
    phaseSequenceIndex: eventId === 9 ? 0 : 1,
    elementId: markId,
    elementTypes,
    elementTypeSourceIdentity:
      markProfile?.markContainer?.elementTypeSourceIdentity ?? null,
    markContainerSourceIdentity:
      markProfile?.markContainer?.sourceIdentity ?? null,
    markId,
    profileKey: markId === 750 ? 'wind' : 'fire',
    before,
    requested: 1,
    delta: after - before,
    after,
    outcome: after > before ? 'layers-added' : 'refresh-at-cap',
    applied: true,
    success: true,
    initialState: false,
    acquisitionSourceKind: 'verified-action-effect',
    sourceActionId: action.id,
    sourceActorId: action.actorId,
    sourceHitIdentity: null,
    sourceEffectIdentity: `fixture:mark:${markId}:${transactionIndex}`,
  };
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-verified-tuning-get-element-event',
    status: 'verified-tuning-get-element-event-applied',
    eventIdentity,
    transactionIdentity,
    kind: eventKind,
    eventId,
    phase,
    timeMs,
    frameIndex: eventContext.absoluteFrame,
    absoluteFrame: eventContext.absoluteFrame,
    sourceSequencePath,
    transactionSourceSequencePath: eventContext.transactionSourceSequencePath,
    phaseSequenceIndex: eventContext.phaseSequenceIndex,
    actionId: action.id,
    actorId: action.actorId,
    markId,
    profileKey: eventContext.profileKey,
    before,
    delta: after - before,
    after,
    outcome: eventContext.outcome,
    eventContext,
    appliedToCalculators: true,
    applied: true,
  };
}

function createFixtureDirectEffectSourceSequencePath(action, ...suffix) {
  return [
    ...(action.sourceSequencePath ?? [Number(action.sourceSequenceIndex ?? 0)]),
    90,
    ...suffix.map(value => Number(value)),
  ];
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
